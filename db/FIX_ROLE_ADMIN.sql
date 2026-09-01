-- =========================================================
-- FIX COMPLETO: Rol admin NO se sobreescribe a student
-- + Usuario Tiffany configurado con contrasena: qwer1234
-- =========================================================
-- EJECUTA ESTE SCRIPT COMPLETO EN:
-- Supabase Dashboard > SQL Editor > New Query
-- Pega TODO y presiona RUN

BEGIN;

-- =========================================================
-- PASO 0: Habilitar extension pgcrypto (para encriptar contrasena)
-- =========================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- PASO 1: Asegurar que la tabla profiles tenga role y username
-- =========================================================
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS username TEXT;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'profiles_role_check'
          AND conrelid = 'public.profiles'::regclass
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_role_check
            CHECK (role IN ('student', 'admin'));
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique
    ON public.profiles (LOWER(username))
    WHERE username IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);

-- =========================================================
-- PASO 2: FIX - Funcion create_user_profile (NO sobreescribir role)
-- =========================================================
CREATE OR REPLACE FUNCTION public.create_user_profile(
    user_id UUID,
    user_email TEXT,
    user_full_name TEXT,
    p_username TEXT DEFAULT NULL,
    p_role TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_username TEXT;
    v_full_name TEXT;
    v_role TEXT;
    v_existing_role TEXT;
BEGIN
    v_full_name := TRIM(COALESCE(user_full_name, ''));
    IF v_full_name = '' THEN
        v_full_name := SPLIT_PART(COALESCE(user_email, ''), '@', 1);
    END IF;

    v_username := TRIM(COALESCE(p_username, ''));
    IF v_username = '' THEN
        v_username := SPLIT_PART(LOWER(COALESCE(user_email, '')), '@', 1);
    END IF;
    v_username := LOWER(v_username);

    -- SI EL PERFIL YA EXISTIA, CONSERVAR SU ROL (nunca sobreescribir a student)
    SELECT role INTO v_existing_role
    FROM public.profiles
    WHERE id = user_id;

    IF v_existing_role IS NOT NULL THEN
        v_role := v_existing_role;
    ELSIF LOWER(COALESCE(p_role, 'student')) IN ('admin', 'student') THEN
        v_role := LOWER(p_role);
    ELSE
        v_role := 'student';
    END IF;

    INSERT INTO public.profiles (
        id, email, full_name, username, role, avatar_url, created_at, updated_at
    )
    VALUES (
        user_id, LOWER(user_email), v_full_name, v_username, v_role, NULL, NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        username = EXCLUDED.username,
        updated_at = NOW();

    RETURN JSONB_BUILD_OBJECT(
        'success', TRUE,
        'id', user_id,
        'email', LOWER(user_email),
        'full_name', v_full_name,
        'username', v_username,
        'role', v_role
    );
EXCEPTION WHEN OTHERS THEN
    RETURN JSONB_BUILD_OBJECT(
        'success', FALSE,
        'error', SQLERRM
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_user_profile(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_user_profile(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- =========================================================
-- PASO 3: FIX - Trigger handle_new_user (NO sobreescribir role)
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_username TEXT;
    v_full_name TEXT;
    v_existing_role TEXT;
BEGIN
    v_username := COALESCE(
        NULLIF(TRIM(LOWER(NEW.raw_user_meta_data->>'username')), ''),
        SPLIT_PART(LOWER(NEW.email), '@', 1)
    );

    v_full_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
        SPLIT_PART(NEW.email, '@', 1)
    );

    -- SI EL PERFIL YA EXISTIA (por UPDATE manual), CONSERVAR SU ROL
    SELECT role INTO v_existing_role
    FROM public.profiles
    WHERE id = NEW.id;

    INSERT INTO public.profiles (
        id, email, full_name, username, role, avatar_url, created_at, updated_at
    )
    VALUES (
        NEW.id,
        LOWER(NEW.email),
        v_full_name,
        v_username,
        COALESCE(v_existing_role, 'student'),
        NULL,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        username = EXCLUDED.username,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

-- Asegurar trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- PASO 4: Asegurar que is_admin exista
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = user_id
          AND p.role = 'admin'
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;

-- =========================================================
-- PASO 5: Asegurar que admin_permissions exista
-- =========================================================
CREATE TABLE IF NOT EXISTS public.admin_permissions (
    id BIGSERIAL PRIMARY KEY,
    admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    permission_code TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (admin_id, permission_code)
);
ALTER TABLE IF EXISTS public.admin_permissions ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- PASO 6: CONFIGURAR USUARIO ADMIN TIFFANY
-- =========================================================
-- Email:       tiffanyoropeza@eleth.com.mx
-- Contrasena:  qwer1234
-- Username:    tiffany

-- 6a. Actualizar la contrasena en auth.users directamente
--     (solo funciona SI el usuario ya fue creado en Auth > Users del Dashboard)
UPDATE auth.users
SET
    encrypted_password = extensions.crypt('qwer1234', extensions.gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    updated_at = NOW()
WHERE email = 'tiffanyoropeza@eleth.com.mx';

-- 6b. Crear o actualizar perfil en public.profiles y PROMOVER A ADMIN
INSERT INTO public.profiles (
    id, email, full_name, username, role, created_at, updated_at
)
SELECT
    id,
    LOWER(email),
    COALESCE(NULLIF(TRIM(raw_user_meta_data->>'full_name'), ''), 'Tiffany Oropeza'),
    'tiffany',
    'admin',
    NOW(),
    NOW()
FROM auth.users
WHERE email = 'tiffanyoropeza@eleth.com.mx'
ON CONFLICT (id) DO UPDATE
SET
    role = 'admin',
    username = 'tiffany',
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = NOW();

-- 6c. Asignar permisos de admin a Tiffany
INSERT INTO public.admin_permissions (admin_id, permission_code, is_enabled)
SELECT p.id, perm.code, TRUE
FROM public.profiles p
CROSS JOIN (
    VALUES
        ('courses.read'),
        ('courses.create'),
        ('students.manage'),
        ('live.manage'),
        ('exams.manage'),
        ('groups.manage')
) AS perm(code)
WHERE p.email = 'tiffanyoropeza@eleth.com.mx'
ON CONFLICT (admin_id, permission_code) DO NOTHING;

-- =========================================================
-- PASO 7: Asegurar trigger de updated_at en profiles
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- PASO 8: VERIFICACION FINAL
-- =========================================================
DO $$ BEGIN
    RAISE NOTICE '===== VERIFICACION: Usuario ADMIN =====';
END $$;

SELECT
    'AUTH> Existe usuario Tiffany' as paso,
    EXISTS (SELECT 1 FROM auth.users WHERE email = 'tiffanyoropeza@eleth.com.mx') as ok;

SELECT
    p.id,
    p.email,
    p.full_name,
    p.username,
    p.role,
    p.created_at
FROM public.profiles p
WHERE p.email = 'tiffanyoropeza@eleth.com.mx';

SELECT
    COUNT(*) as total_permisos_admin
FROM public.admin_permissions ap
JOIN public.profiles p ON p.id = ap.admin_id
WHERE p.email = 'tiffanyoropeza@eleth.com.mx';

COMMIT;

-- =========================================================
-- POST-PASO (si el usuario NO existia en Auth > Users):
-- VE AL DASHBOARD DE SUPABASE:
-- 1. Authentication > Users > Add user
-- 2. Email:      tiffanyoropeza@eleth.com.mx
--    Password:   qwer1234
--    (desmarca "Auto confirm" o marca "Confirm email")
-- 3. Clic en Create user
-- 4. VUELVE A EJECUTAR ESTE SCRIPT (solo para actualizar profile.role)
--
-- LUEGO PRUEBA EN LA APP:
--   Usuario:  tiffanyoropeza@eleth.com.mx  (o username: tiffany)
--   Password: qwer1234
--   → Ahora debe abrir el ADMIN DASHBOARD, no el de alumno.
-- =========================================================
