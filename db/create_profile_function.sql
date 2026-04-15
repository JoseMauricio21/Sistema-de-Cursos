-- ========================================
-- SOLUCIÓN ALTERNATIVA - FUNCIÓN PARA CREAR PERFIL
-- ========================================
-- Ejecuta esto en SQL Editor de Supabase

-- 1. CREAR FUNCIÓN QUE INSERTA PERFIL (sin restricciones RLS)
CREATE OR REPLACE FUNCTION public.create_user_profile(
    user_id UUID,
    user_email TEXT,
    user_full_name TEXT
)
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    INSERT INTO public.profiles (id, email, full_name, created_at)
    VALUES (user_id, user_email, user_full_name, now())
    ON CONFLICT (id) DO UPDATE
    SET updated_at = now();
    
    SELECT json_build_object(
        'success', true,
        'id', user_id,
        'email', user_email,
        'full_name', user_full_name
    ) INTO result;
    
    RETURN result;
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. PERMITIR QUE ROLE ANON EJECUTE LA FUNCIÓN
GRANT EXECUTE ON FUNCTION public.create_user_profile(UUID, TEXT, TEXT) TO anon, authenticated;

-- 3. ELIMINAR TRIGGER ANTERIOR (si da error, ignora)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 4. LISTO - Ahora el servidor puede llamar create_user_profile() directamente
