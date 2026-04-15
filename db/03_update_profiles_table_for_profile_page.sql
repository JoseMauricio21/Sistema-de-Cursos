-- ========================================
-- 03_UPDATE_PROFILES_TABLE_FOR_PROFILE_PAGE
-- ========================================
-- Ejecuta este script en Supabase SQL Editor para agregar/actualizar campos

-- Si la tabla profiles ya existe pero necesita actualizaciones:
-- 1. Verificar que avatar_url existe
-- 2. Agregar bio si no existe

-- Agregar columna avatar_url si no existe
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Agregar columna bio si no existe
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS bio TEXT;

-- Actualizar el índice para avatar_url (opcional pero recomendado)
CREATE INDEX IF NOT EXISTS idx_profiles_avatar_url ON profiles(avatar_url);

-- Ver la estructura actual de la tabla
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

-- ✅ Script completado
-- Los siguientes campos están disponibles en la tabla profiles:
-- - id (UUID) - ID único del usuario
-- - email (TEXT) - Email del usuario
-- - full_name (TEXT) - Nombre completo
-- - avatar_url (TEXT) - URL de la foto de perfil
-- - bio (TEXT) - Biografía del usuario
-- - created_at (TIMESTAMP) - Fecha de creación
-- - updated_at (TIMESTAMP) - Fecha de última actualización
