-- ========================================
-- 2. CREAR FUNCIÓN PARA GENERAR PERFILES
-- ========================================
-- Ejecuta este script DESPUÉS de 01_create_profiles_table.sql

DROP FUNCTION IF EXISTS public.create_user_profile(UUID, TEXT, TEXT);

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

-- Permitir que usuarios ejecuten la función
GRANT EXECUTE ON FUNCTION public.create_user_profile(UUID, TEXT, TEXT) TO anon, authenticated;

-- ✅ Script completado. Tu base de datos está lista.
