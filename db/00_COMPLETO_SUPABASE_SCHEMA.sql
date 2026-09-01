-- =========================================================
-- SCRIPT COMPLETO PARA SUPABASE - PLATAFORMA DE CURSOS DE INGLES
-- =========================================================
-- Ejecuta este script COMPLETO en el SQL Editor de Supabase.
-- Crea TODAS las tablas, funciones, triggers, indices y politicas RLS.
-- Compatible con: Autenticacion, Perfiles, Admin Dashboard,
--                 Cursos, Clases en Vivo, Examenes, Grupos
-- =========================================================

BEGIN;

-- =========================================================
-- PASO 0: HABILITAR EXTENSIONES
-- =========================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- PASO 1: ELIMINAR TABLAS EXISTENTES (en orden correcto)
-- =========================================================
DROP TABLE IF EXISTS public.group_course_assignments CASCADE;
DROP TABLE IF EXISTS public.group_members CASCADE;
DROP TABLE IF EXISTS public.student_groups CASCADE;
DROP TABLE IF EXISTS public.exam_assignments CASCADE;
DROP TABLE IF EXISTS public.exam_questions CASCADE;
DROP TABLE IF EXISTS public.exams CASCADE;
DROP TABLE IF EXISTS public.live_assignments CASCADE;
DROP TABLE IF EXISTS public.live_events CASCADE;
DROP TABLE IF EXISTS public.lesson_questions CASCADE;
DROP TABLE IF EXISTS public.lesson_blocks CASCADE;
DROP TABLE IF EXISTS public.course_lessons CASCADE;
DROP TABLE IF EXISTS public.course_assignments CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.admin_permissions CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- =========================================================
-- PASO 2: CREAR TABLAS BASE
-- =========================================================

-- Tabla principal de perfiles de usuario
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL DEFAULT '',
    username TEXT,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Tabla de logs de actividad
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    description TEXT,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Tabla de sesiones personalizadas
CREATE TABLE public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Tabla de permisos de administrador
CREATE TABLE public.admin_permissions (
    id BIGSERIAL PRIMARY KEY,
    admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    permission_code TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (admin_id, permission_code)
);

ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- PASO 3: CREAR TABLAS DE LMS (Sistema de Gestion de Cursos)
-- =========================================================

-- Cursos
CREATE TABLE public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Asignaciones de cursos a estudiantes
CREATE TABLE public.course_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (course_id, student_id)
);

ALTER TABLE public.course_assignments ENABLE ROW LEVEL SECURITY;

-- Lecciones dentro de los cursos
CREATE TABLE public.course_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    position INTEGER NOT NULL DEFAULT 1,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (course_id, position)
);

ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;

-- Bloques de contenido en cada leccion (texto, imagen, video)
CREATE TABLE public.lesson_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    block_type TEXT NOT NULL CHECK (block_type IN ('text', 'image', 'youtube')),
    content_text TEXT,
    media_url TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (lesson_id, position)
);

ALTER TABLE public.lesson_blocks ENABLE ROW LEVEL SECURITY;

-- Preguntas/Quices de las lecciones
CREATE TABLE public.lesson_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL DEFAULT 'single' CHECK (question_type IN ('single', 'multiple', 'short')),
    options JSONB,
    correct_answer JSONB,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.lesson_questions ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- PASO 4: EVENTOS EN VIVO
-- =========================================================

CREATE TABLE public.live_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT,
    youtube_url TEXT NOT NULL,
    starts_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.live_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.live_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    live_id UUID NOT NULL REFERENCES public.live_events(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (live_id, student_id)
);

ALTER TABLE public.live_assignments ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- PASO 5: EXAMENES
-- =========================================================

CREATE TABLE public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    available_from TIMESTAMPTZ,
    available_to TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.exam_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL DEFAULT 'single' CHECK (question_type IN ('single', 'multiple', 'short')),
    options JSONB,
    correct_answer JSONB,
    points NUMERIC(6,2) NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (exam_id, position)
);

ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.exam_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'published', 'completed')),
    score NUMERIC(6,2),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (exam_id, student_id)
);

ALTER TABLE public.exam_assignments ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- PASO 6: GRUPOS DE ESTUDIANTES
-- =========================================================

CREATE TABLE public.student_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (name)
);

ALTER TABLE public.student_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.student_groups(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    added_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (group_id, student_id)
);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_course_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.student_groups(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (group_id, course_id)
);

ALTER TABLE public.group_course_assignments ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- PASO 7: INDICES PARA RENDIMIENTO
-- =========================================================

-- Profiles
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique
    ON public.profiles (LOWER(username))
    WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);

-- Activity / Sessions
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions (user_id);

-- Cursos y Lecciones
CREATE INDEX IF NOT EXISTS idx_courses_created_by ON public.courses(created_by);
CREATE INDEX IF NOT EXISTS idx_courses_status ON public.courses(status);
CREATE INDEX IF NOT EXISTS idx_course_assignments_student ON public.course_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON public.course_lessons(course_id, position);
CREATE INDEX IF NOT EXISTS idx_blocks_lesson ON public.lesson_blocks(lesson_id, position);
CREATE INDEX IF NOT EXISTS idx_lesson_questions_lesson ON public.lesson_questions(lesson_id);

-- En Vivo
CREATE INDEX IF NOT EXISTS idx_live_events_status ON public.live_events(status);
CREATE INDEX IF NOT EXISTS idx_live_assignments_student ON public.live_assignments(student_id);

-- Examenes
CREATE INDEX IF NOT EXISTS idx_exams_status ON public.exams(status);
CREATE INDEX IF NOT EXISTS idx_exam_assignments_student ON public.exam_assignments(student_id);

-- Grupos
CREATE INDEX IF NOT EXISTS idx_group_members_student ON public.group_members(student_id);

-- =========================================================
-- PASO 8: FUNCIONES HELPER
-- =========================================================

-- Funcion para actualizar automaticamente updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Funcion: verificar si un usuario es administrador
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

-- Funcion: resolver login por username o email
CREATE OR REPLACE FUNCTION public.resolve_login_email(p_identifier TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_identifier TEXT;
    v_email TEXT;
BEGIN
    v_identifier := LOWER(TRIM(COALESCE(p_identifier, '')));

    IF v_identifier = '' THEN
        RETURN NULL;
    END IF;

    -- Si es un email, devolverlo directamente
    IF POSITION('@' IN v_identifier) > 0 THEN
        RETURN v_identifier;
    END IF;

    -- Buscar por username
    SELECT p.email
    INTO v_email
    FROM public.profiles p
    WHERE LOWER(p.username) = v_identifier
    LIMIT 1;

    RETURN v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_login_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(TEXT) TO anon, authenticated;

-- =========================================================
-- PASO 9: FUNCION PARA CREAR PERFILES (llamada desde el server)
-- =========================================================

CREATE OR REPLACE FUNCTION public.create_user_profile(
    user_id UUID,
    user_email TEXT,
    user_full_name TEXT,
    p_username TEXT DEFAULT NULL,
    p_role TEXT DEFAULT 'student'
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
BEGIN
    -- Procesar nombre completo
    v_full_name := TRIM(COALESCE(user_full_name, ''));
    IF v_full_name = '' THEN
        v_full_name := SPLIT_PART(COALESCE(user_email, ''), '@', 1);
    END IF;

    -- Procesar username
    v_username := TRIM(COALESCE(p_username, ''));
    IF v_username = '' THEN
        v_username := SPLIT_PART(LOWER(COALESCE(user_email, '')), '@', 1);
    END IF;
    v_username := LOWER(v_username);

    -- Validar rol
    IF LOWER(COALESCE(p_role, 'student')) IN ('admin', 'student') THEN
        v_role := LOWER(p_role);
    ELSE
        v_role := 'student';
    END IF;

    -- Insertar o actualizar perfil
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
        role = EXCLUDED.role,
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
-- PASO 10: TRIGGER AUTOMATICO - Crear perfil al registrar usuario
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
BEGIN
    -- Obtener username desde metadata o email
    v_username := COALESCE(
        NULLIF(TRIM(LOWER(NEW.raw_user_meta_data->>'username')), ''),
        SPLIT_PART(LOWER(NEW.email), '@', 1)
    );

    -- Obtener nombre completo desde metadata o email
    v_full_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
        SPLIT_PART(NEW.email, '@', 1)
    );

    -- Insertar perfil automaticamente
    INSERT INTO public.profiles (
        id, email, full_name, username, role, avatar_url, created_at, updated_at
    )
    VALUES (
        NEW.id,
        LOWER(NEW.email),
        v_full_name,
        v_username,
        'student',
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- PASO 11: FUNCION DE ADMIN - Actualizar perfil y contrasena de estudiante
-- =========================================================

CREATE OR REPLACE FUNCTION public.admin_update_student_profile(
    p_student_id UUID,
    p_email TEXT DEFAULT NULL,
    p_password TEXT DEFAULT NULL,
    p_full_name TEXT DEFAULT NULL,
    p_username TEXT DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
    v_clean_password TEXT;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Only admins can execute this function';
    END IF;

    -- Actualizar email en auth.users si se proporciona
    IF p_email IS NOT NULL AND LENGTH(TRIM(p_email)) > 0 THEN
        UPDATE auth.users
        SET email = TRIM(LOWER(p_email)),
            updated_at = NOW()
        WHERE id = p_student_id;
    END IF;

    -- Actualizar contrasena en auth.users si se proporciona
    IF p_password IS NOT NULL AND LENGTH(TRIM(p_password)) > 0 THEN
        v_clean_password := TRIM(p_password);

        IF LENGTH(v_clean_password) < 6 THEN
            RAISE EXCEPTION 'Password must have at least 6 characters';
        END IF;

        UPDATE auth.users
        SET encrypted_password = extensions.crypt(v_clean_password, extensions.gen_salt('bf')),
            updated_at = NOW()
        WHERE id = p_student_id;
    END IF;

    -- Actualizar perfil en public.profiles
    UPDATE public.profiles
    SET email = COALESCE(NULLIF(TRIM(LOWER(p_email)), ''), email),
        full_name = COALESCE(NULLIF(TRIM(p_full_name), ''), full_name),
        username = COALESCE(NULLIF(TRIM(LOWER(p_username)), ''), username),
        avatar_url = COALESCE(NULLIF(TRIM(p_avatar_url), ''), avatar_url),
        updated_at = NOW()
    WHERE id = p_student_id
    RETURNING * INTO v_profile;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student profile not found';
    END IF;

    RETURN TO_JSONB(v_profile);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_student_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_student_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- =========================================================
-- PASO 12: TRIGGERS DE updated_at AUTOMATICOS
-- =========================================================

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_courses_updated_at ON public.courses;
CREATE TRIGGER trg_courses_updated_at
BEFORE UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_course_lessons_updated_at ON public.course_lessons;
CREATE TRIGGER trg_course_lessons_updated_at
BEFORE UPDATE ON public.course_lessons
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_live_events_updated_at ON public.live_events;
CREATE TRIGGER trg_live_events_updated_at
BEFORE UPDATE ON public.live_events
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_exams_updated_at ON public.exams;
CREATE TRIGGER trg_exams_updated_at
BEFORE UPDATE ON public.exams
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- PASO 13: POLITICAS ROW LEVEL SECURITY (RLS)
-- =========================================================

-- ===========================
-- POLITICAS: PROFILES
-- ===========================
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles FOR SELECT
USING (auth.uid() = id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin"
ON public.profiles FOR UPDATE
USING (auth.uid() = id OR public.is_admin(auth.uid()))
WITH CHECK (auth.uid() = id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "profiles_delete_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_delete_own_or_admin"
ON public.profiles FOR DELETE
USING (auth.uid() = id OR public.is_admin(auth.uid()));

-- ===========================
-- POLITICAS: ACTIVITY LOGS
-- ===========================
DROP POLICY IF EXISTS "activity_logs_select_own_or_admin" ON public.activity_logs;
CREATE POLICY "activity_logs_select_own_or_admin"
ON public.activity_logs FOR SELECT
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "activity_logs_insert_own_or_admin" ON public.activity_logs;
CREATE POLICY "activity_logs_insert_own_or_admin"
ON public.activity_logs FOR INSERT
WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- ===========================
-- POLITICAS: SESSIONS
-- ===========================
DROP POLICY IF EXISTS "sessions_select_own_or_admin" ON public.sessions;
CREATE POLICY "sessions_select_own_or_admin"
ON public.sessions FOR SELECT
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "sessions_insert_own_or_admin" ON public.sessions;
CREATE POLICY "sessions_insert_own_or_admin"
ON public.sessions FOR INSERT
WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "sessions_update_own_or_admin" ON public.sessions;
CREATE POLICY "sessions_update_own_or_admin"
ON public.sessions FOR UPDATE
USING (auth.uid() = user_id OR public.is_admin(auth.uid()))
WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "sessions_delete_own_or_admin" ON public.sessions;
CREATE POLICY "sessions_delete_own_or_admin"
ON public.sessions FOR DELETE
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- ===========================
-- POLITICAS: ADMIN PERMISSIONS
-- ===========================
DROP POLICY IF EXISTS "admin_permissions_admin_only" ON public.admin_permissions;
CREATE POLICY "admin_permissions_admin_only"
ON public.admin_permissions FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- ===========================
-- POLITICAS: COURSES
-- ===========================
DROP POLICY IF EXISTS "courses_admin_manage" ON public.courses;
CREATE POLICY "courses_admin_manage"
ON public.courses FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "courses_student_read_assigned" ON public.courses;
CREATE POLICY "courses_student_read_assigned"
ON public.courses FOR SELECT
USING (
    public.is_admin(auth.uid())
    OR EXISTS (
        SELECT 1
        FROM public.course_assignments ca
        WHERE ca.course_id = courses.id
          AND ca.student_id = auth.uid()
          AND ca.is_visible = TRUE
    )
);

-- ===========================
-- POLITICAS: COURSE ASSIGNMENTS
-- ===========================
DROP POLICY IF EXISTS "course_assignments_admin_manage" ON public.course_assignments;
CREATE POLICY "course_assignments_admin_manage"
ON public.course_assignments FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "course_assignments_student_read_own" ON public.course_assignments;
CREATE POLICY "course_assignments_student_read_own"
ON public.course_assignments FOR SELECT
USING (student_id = auth.uid());

-- ===========================
-- POLITICAS: COURSE LESSONS
-- ===========================
DROP POLICY IF EXISTS "lessons_admin_manage" ON public.course_lessons;
CREATE POLICY "lessons_admin_manage"
ON public.course_lessons FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "lessons_student_read" ON public.course_lessons;
CREATE POLICY "lessons_student_read"
ON public.course_lessons FOR SELECT
USING (
    public.is_admin(auth.uid())
    OR (
        is_published = TRUE
        AND EXISTS (
            SELECT 1
            FROM public.course_assignments ca
            WHERE ca.course_id = course_lessons.course_id
              AND ca.student_id = auth.uid()
              AND ca.is_visible = TRUE
        )
    )
);

-- ===========================
-- POLITICAS: LESSON BLOCKS
-- ===========================
DROP POLICY IF EXISTS "lesson_blocks_admin_manage" ON public.lesson_blocks;
CREATE POLICY "lesson_blocks_admin_manage"
ON public.lesson_blocks FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "lesson_blocks_student_read" ON public.lesson_blocks;
CREATE POLICY "lesson_blocks_student_read"
ON public.lesson_blocks FOR SELECT
USING (
    public.is_admin(auth.uid())
    OR EXISTS (
        SELECT 1
        FROM public.course_lessons l
        JOIN public.course_assignments ca ON ca.course_id = l.course_id
        WHERE l.id = lesson_blocks.lesson_id
          AND l.is_published = TRUE
          AND ca.student_id = auth.uid()
          AND ca.is_visible = TRUE
    )
);

-- ===========================
-- POLITICAS: LESSON QUESTIONS
-- ===========================
DROP POLICY IF EXISTS "lesson_questions_admin_manage" ON public.lesson_questions;
CREATE POLICY "lesson_questions_admin_manage"
ON public.lesson_questions FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "lesson_questions_student_read" ON public.lesson_questions;
CREATE POLICY "lesson_questions_student_read"
ON public.lesson_questions FOR SELECT
USING (
    public.is_admin(auth.uid())
    OR EXISTS (
        SELECT 1
        FROM public.course_lessons l
        JOIN public.course_assignments ca ON ca.course_id = l.course_id
        WHERE l.id = lesson_questions.lesson_id
          AND l.is_published = TRUE
          AND ca.student_id = auth.uid()
          AND ca.is_visible = TRUE
    )
);

-- ===========================
-- POLITICAS: LIVE EVENTS
-- ===========================
DROP POLICY IF EXISTS "live_events_admin_manage" ON public.live_events;
CREATE POLICY "live_events_admin_manage"
ON public.live_events FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "live_events_student_read" ON public.live_events;
CREATE POLICY "live_events_student_read"
ON public.live_events FOR SELECT
USING (
    public.is_admin(auth.uid())
    OR (
        status = 'published'
        AND EXISTS (
            SELECT 1
            FROM public.live_assignments la
            WHERE la.live_id = live_events.id
              AND la.student_id = auth.uid()
              AND la.is_visible = TRUE
        )
    )
);

-- ===========================
-- POLITICAS: LIVE ASSIGNMENTS
-- ===========================
DROP POLICY IF EXISTS "live_assignments_admin_manage" ON public.live_assignments;
CREATE POLICY "live_assignments_admin_manage"
ON public.live_assignments FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "live_assignments_student_read" ON public.live_assignments;
CREATE POLICY "live_assignments_student_read"
ON public.live_assignments FOR SELECT
USING (student_id = auth.uid());

-- ===========================
-- POLITICAS: EXAMS
-- ===========================
DROP POLICY IF EXISTS "exams_admin_manage" ON public.exams;
CREATE POLICY "exams_admin_manage"
ON public.exams FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "exams_student_read" ON public.exams;
CREATE POLICY "exams_student_read"
ON public.exams FOR SELECT
USING (
    public.is_admin(auth.uid())
    OR (
        status = 'published'
        AND EXISTS (
            SELECT 1
            FROM public.exam_assignments ea
            WHERE ea.exam_id = exams.id
              AND ea.student_id = auth.uid()
        )
    )
);

-- ===========================
-- POLITICAS: EXAM QUESTIONS
-- ===========================
DROP POLICY IF EXISTS "exam_questions_admin_manage" ON public.exam_questions;
CREATE POLICY "exam_questions_admin_manage"
ON public.exam_questions FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "exam_questions_student_read" ON public.exam_questions;
CREATE POLICY "exam_questions_student_read"
ON public.exam_questions FOR SELECT
USING (
    public.is_admin(auth.uid())
    OR EXISTS (
        SELECT 1
        FROM public.exams e
        JOIN public.exam_assignments ea ON ea.exam_id = e.id
        WHERE e.id = exam_questions.exam_id
          AND e.status = 'published'
          AND ea.student_id = auth.uid()
    )
);

-- ===========================
-- POLITICAS: EXAM ASSIGNMENTS
-- ===========================
DROP POLICY IF EXISTS "exam_assignments_admin_manage" ON public.exam_assignments;
CREATE POLICY "exam_assignments_admin_manage"
ON public.exam_assignments FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "exam_assignments_student_read" ON public.exam_assignments;
CREATE POLICY "exam_assignments_student_read"
ON public.exam_assignments FOR SELECT
USING (student_id = auth.uid());

DROP POLICY IF EXISTS "exam_assignments_student_update" ON public.exam_assignments;
CREATE POLICY "exam_assignments_student_update"
ON public.exam_assignments FOR UPDATE
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

-- ===========================
-- POLITICAS: STUDENT GROUPS
-- ===========================
DROP POLICY IF EXISTS "groups_admin_manage" ON public.student_groups;
CREATE POLICY "groups_admin_manage"
ON public.student_groups FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "groups_student_read" ON public.student_groups;
CREATE POLICY "groups_student_read"
ON public.student_groups FOR SELECT
USING (
    public.is_admin(auth.uid())
    OR EXISTS (
        SELECT 1
        FROM public.group_members gm
        WHERE gm.group_id = student_groups.id
          AND gm.student_id = auth.uid()
    )
);

-- ===========================
-- POLITICAS: GROUP MEMBERS
-- ===========================
DROP POLICY IF EXISTS "group_members_admin_manage" ON public.group_members;
CREATE POLICY "group_members_admin_manage"
ON public.group_members FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "group_members_student_read" ON public.group_members;
CREATE POLICY "group_members_student_read"
ON public.group_members FOR SELECT
USING (student_id = auth.uid());

-- ===========================
-- POLITICAS: GROUP COURSE ASSIGNMENTS
-- ===========================
DROP POLICY IF EXISTS "group_course_assignments_admin_manage" ON public.group_course_assignments;
CREATE POLICY "group_course_assignments_admin_manage"
ON public.group_course_assignments FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "group_course_assignments_student_read" ON public.group_course_assignments;
CREATE POLICY "group_course_assignments_student_read"
ON public.group_course_assignments FOR SELECT
USING (
    public.is_admin(auth.uid())
    OR EXISTS (
        SELECT 1
        FROM public.group_members gm
        WHERE gm.group_id = group_course_assignments.group_id
          AND gm.student_id = auth.uid()
    )
);

-- =========================================================
-- PASO 14: CONFIGURAR USUARIO ADMIN INICIAL (OPCIONAL)
-- =========================================================
-- PASOS PARA CREAR ADMIN:
-- 1. En Supabase Dashboard > Authentication > Users, crea el usuario:
--    Email:    admin@tuplataforma.com
--    Password: TuContraseñaSegura123!
--
-- 2. Despues, ejecuta ESTE bloque (cambia el email si usaste otro):
--
--    UPDATE public.profiles
--    SET full_name = 'Administrador',
--        username = 'admin',
--        role = 'admin',
--        updated_at = NOW()
--    WHERE email = 'admin@tuplataforma.com';
--
-- 3. (Opcional) Asignar permisos de admin:
--
--    INSERT INTO public.admin_permissions (admin_id, permission_code, is_enabled)
--    SELECT p.id, perm.code, TRUE
--    FROM public.profiles p
--    CROSS JOIN (
--        VALUES
--            ('courses.read'),
--            ('courses.create'),
--            ('students.manage'),
--            ('live.manage'),
--            ('exams.manage'),
--            ('groups.manage')
--    ) AS perm(code)
--    WHERE p.email = 'admin@tuplataforma.com'
--    ON CONFLICT (admin_id, permission_code) DO NOTHING;

-- =========================================================
-- PASO 15: VERIFICACION FINAL
-- =========================================================

-- Listar tablas creadas
SELECT
    table_name,
    is_insertable_into
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Listar funciones creadas
SELECT
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
      'set_updated_at',
      'is_admin',
      'resolve_login_email',
      'create_user_profile',
      'handle_new_user',
      'admin_update_student_profile'
  )
ORDER BY routine_name;

COMMIT;

-- =========================================================
-- FIN DEL SCRIPT
-- =========================================================
-- PASOS POST-INSTALACION:
-- 1. Copia .env.example a .env.local en tu proyecto
-- 2. Agrega tus credenciales de Supabase:
--    - VITE_SUPABASE_URL        → Project Settings > API > Project URL
--    - VITE_SUPABASE_ANON_KEY   → Project Settings > API > anon public
--    - SUPABASE_SECRET_KEY      → Project Settings > API > service_role (solo para server.js)
-- 3. Crea tu usuario admin en Auth > Users
-- 4. Ejecuta el bloque del PASO 14 para darle rol de admin
-- 5. Reinicia el dev server: npm run dev
-- =========================================================
