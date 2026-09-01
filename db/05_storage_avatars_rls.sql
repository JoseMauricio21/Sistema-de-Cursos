-- =========================================================
-- PASO 05: CONFIGURACIÓN DE STORAGE PARA AVATARES + RLS
-- Proyecto: Sistema de Cursos
-- Ejecutar en SQL Editor de Supabase DESPUÉS del script 00
-- =========================================================

-- =========================================================
-- 1) CREAR BUCKET PÚBLICO "avatars" (si no existe)
-- =========================================================
-- NOTA: Este INSERT funcionará SIEMPRE que no exista un bucket con ese id.
-- El bucket es PUBLIC para que las imágenes se puedan mostrar sin firmar URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at)
VALUES (
    'avatars',
    'avatars',
    TRUE,
    5242880,                              -- 5 MB máximo por imagen
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']::text[],
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- =========================================================
-- 2) POLÍTICAS RLS PARA storage.objects EN EL BUCKET "avatars"
--    (permitir a admin y student subir/leer/borrar SUS PROPIOS avatares)
--
-- NOTA: Usamos DROP IF EXISTS + CREATE en lugar de CREATE ... IF NOT EXISTS
-- por compatibilidad con versiones antiguas de PostgreSQL en Supabase.
-- =========================================================

-- Habilitar RLS en la tabla storage.objects (suele estar habilitado pero por si acaso)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas previas con el mismo nombre (si existen) para evitar duplicados
DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;

-- 2.1 POLÍTICA: TODOS los usuarios (incluidos no autenticados) PUEDEN LEER avatares (bucket público)
CREATE POLICY "avatars_select_public"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- 2.2 POLÍTICA: Usuarios autenticados PUEDEN SUBIR archivos SÓLO a avatares/{su_user_id}/
CREATE POLICY "avatars_insert_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2.3 POLÍTICA: Usuarios autenticados PUEDEN ACTUALIZAR (reemplazar) SÓLO sus archivos
CREATE POLICY "avatars_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2.4 POLÍTICA: Usuarios autenticados PUEDEN BORRAR SÓLO sus archivos
CREATE POLICY "avatars_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- =========================================================
-- 3) FUNCIÓN HELPER: Construye URL pública de avatar desde storage
--    (usa desde SELECT si quieres resolver la URL en SQL)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_avatar_url(user_id UUID, path TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    base_url TEXT := 'https://piiaoucyrlvrodzxwjeh.supabase.co';
BEGIN
    IF path IS NULL OR path = '' THEN
        RETURN NULL;
    END IF;

    -- Si el path ya empieza por http, devuélvelo tal cual
    IF path LIKE 'http%' THEN
        RETURN path;
    END IF;

    RETURN base_url || '/storage/v1/object/public/avatars/' || LTRIM(path, '/');
END;
$$;

-- =========================================================
-- 4) VERIFICACIÓN RÁPIDA:
-- =========================================================
-- A. Confirmar bucket creado
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id = 'avatars';

-- B. Confirmar políticas creadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage';
