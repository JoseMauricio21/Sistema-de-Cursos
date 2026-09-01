-- =========================================================
-- FIX COMPLETO: Admin puede VER/EDITAR TODOS los alumnos
-- + Políticas RLS correctas para TODO el admin dashboard
-- =========================================================
-- EJECUTA ESTE SCRIPT EN: Supabase > SQL Editor > New Query
-- Pega TODO y presiona RUN

BEGIN;

-- =========================================================
-- PASO 0: Asegurar que la funcion is_admin() exista
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
-- PASO 1: TABLA PROFILES - Admin VE + EDITA TODOS los perfiles
-- (ESTA ES LA CAUSA PRINCIPAL de "0 alumnos")
-- =========================================================
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Eliminar politicas antiguas con nombres distintos
DROP POLICY IF EXISTS "Usuarios pueden ver su propio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuarios pueden eliminar su propio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuarios pueden insertar su propio perfil" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_own_or_admin" ON public.profiles;

-- SELECT: Usuario ve su perfil, o si es ADMIN ve TODOS los perfiles
CREATE POLICY profiles_select_own_or_admin
ON public.profiles
FOR SELECT
USING (auth.uid() = id OR public.is_admin(auth.uid()));

-- INSERT: Admin puede insertar, o usuario su propio id
CREATE POLICY profiles_insert_own_or_admin
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id OR public.is_admin(auth.uid()));

-- UPDATE: Admin actualiza a cualquiera, usuario solo el suyo
CREATE POLICY profiles_update_own_or_admin
ON public.profiles
FOR UPDATE
USING (auth.uid() = id OR public.is_admin(auth.uid()))
WITH CHECK (auth.uid() = id OR public.is_admin(auth.uid()));

-- DELETE: Admin borra cualquiera, usuario solo el suyo
CREATE POLICY profiles_delete_own_or_admin
ON public.profiles
FOR DELETE
USING (auth.uid() = id OR public.is_admin(auth.uid()));

-- =========================================================
-- PASO 2: Asegurar campos basicos en profiles (si faltan)
-- =========================================================
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS username TEXT;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS bio TEXT;

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
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);

-- =========================================================
-- PASO 3: TABLA ADMIN_PERMISSIONS - Solo admin accede
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

DROP POLICY IF EXISTS admin_permissions_admin_only ON public.admin_permissions;
CREATE POLICY admin_permissions_admin_only
ON public.admin_permissions
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- PASO 4: TABLAS LMS - Admin gestiona TODO
-- =========================================================

-- ---- COURSES ----
ALTER TABLE IF EXISTS public.courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS courses_admin_manage ON public.courses;
DROP POLICY IF EXISTS courses_student_read_assigned ON public.courses;

CREATE POLICY courses_admin_manage
ON public.courses
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY courses_student_read_assigned
ON public.courses
FOR SELECT
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

-- ---- COURSE ASSIGNMENTS ----
ALTER TABLE IF EXISTS public.course_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS course_assignments_admin_manage ON public.course_assignments;
DROP POLICY IF EXISTS course_assignments_student_read_own ON public.course_assignments;

CREATE POLICY course_assignments_admin_manage
ON public.course_assignments
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY course_assignments_student_read_own
ON public.course_assignments
FOR SELECT
USING (student_id = auth.uid());

-- ---- COURSE LESSONS ----
ALTER TABLE IF EXISTS public.course_lessons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lessons_admin_manage ON public.course_lessons;
DROP POLICY IF EXISTS lessons_student_read ON public.course_lessons;

CREATE POLICY lessons_admin_manage
ON public.course_lessons
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY lessons_student_read
ON public.course_lessons
FOR SELECT
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

-- ---- LESSON BLOCKS ----
ALTER TABLE IF EXISTS public.lesson_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lesson_blocks_admin_manage ON public.lesson_blocks;
DROP POLICY IF EXISTS lesson_blocks_student_read ON public.lesson_blocks;

CREATE POLICY lesson_blocks_admin_manage
ON public.lesson_blocks
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY lesson_blocks_student_read
ON public.lesson_blocks
FOR SELECT
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

-- ---- LESSON QUESTIONS ----
ALTER TABLE IF EXISTS public.lesson_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lesson_questions_admin_manage ON public.lesson_questions;
DROP POLICY IF EXISTS lesson_questions_student_read ON public.lesson_questions;

CREATE POLICY lesson_questions_admin_manage
ON public.lesson_questions
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY lesson_questions_student_read
ON public.lesson_questions
FOR SELECT
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

-- =========================================================
-- PASO 5: LIVE EVENTS - Admin gestiona TODO
-- =========================================================
ALTER TABLE IF EXISTS public.live_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.live_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS live_events_admin_manage ON public.live_events;
DROP POLICY IF EXISTS live_events_student_read ON public.live_events;
DROP POLICY IF EXISTS live_assignments_admin_manage ON public.live_assignments;
DROP POLICY IF EXISTS live_assignments_student_read ON public.live_assignments;

CREATE POLICY live_events_admin_manage
ON public.live_events
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY live_events_student_read
ON public.live_events
FOR SELECT
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

CREATE POLICY live_assignments_admin_manage
ON public.live_assignments
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY live_assignments_student_read
ON public.live_assignments
FOR SELECT
USING (student_id = auth.uid());

-- =========================================================
-- PASO 6: EXAMENES - Admin gestiona TODO
-- =========================================================
ALTER TABLE IF EXISTS public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exam_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exams_admin_manage ON public.exams;
DROP POLICY IF EXISTS exams_student_read ON public.exams;
DROP POLICY IF EXISTS exam_questions_admin_manage ON public.exam_questions;
DROP POLICY IF EXISTS exam_questions_student_read ON public.exam_questions;
DROP POLICY IF EXISTS exam_assignments_admin_manage ON public.exam_assignments;
DROP POLICY IF EXISTS exam_assignments_student_read ON public.exam_assignments;
DROP POLICY IF EXISTS exam_assignments_student_update ON public.exam_assignments;

CREATE POLICY exams_admin_manage
ON public.exams
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY exams_student_read
ON public.exams
FOR SELECT
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

CREATE POLICY exam_questions_admin_manage
ON public.exam_questions
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY exam_questions_student_read
ON public.exam_questions
FOR SELECT
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

CREATE POLICY exam_assignments_admin_manage
ON public.exam_assignments
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY exam_assignments_student_read
ON public.exam_assignments
FOR SELECT
USING (student_id = auth.uid());

CREATE POLICY exam_assignments_student_update
ON public.exam_assignments
FOR UPDATE
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

-- =========================================================
-- PASO 7: GRUPOS - Admin gestiona TODO
-- =========================================================
ALTER TABLE IF EXISTS public.student_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.group_course_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS groups_admin_manage ON public.student_groups;
DROP POLICY IF EXISTS groups_student_read ON public.student_groups;
DROP POLICY IF EXISTS group_members_admin_manage ON public.group_members;
DROP POLICY IF EXISTS group_members_student_read ON public.group_members;
DROP POLICY IF EXISTS group_course_assignments_admin_manage ON public.group_course_assignments;
DROP POLICY IF EXISTS group_course_assignments_student_read ON public.group_course_assignments;

CREATE POLICY groups_admin_manage
ON public.student_groups
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY groups_student_read
ON public.student_groups
FOR SELECT
USING (
    public.is_admin(auth.uid())
    OR EXISTS (
        SELECT 1
        FROM public.group_members gm
        WHERE gm.group_id = student_groups.id
          AND gm.student_id = auth.uid()
    )
);

CREATE POLICY group_members_admin_manage
ON public.group_members
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY group_members_student_read
ON public.group_members
FOR SELECT
USING (student_id = auth.uid());

CREATE POLICY group_course_assignments_admin_manage
ON public.group_course_assignments
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY group_course_assignments_student_read
ON public.group_course_assignments
FOR SELECT
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
-- PASO 8: ACTIVITY LOGS + SESSIONS - Admin gestiona TODO
-- =========================================================
ALTER TABLE IF EXISTS public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_logs_select_own_or_admin ON public.activity_logs;
DROP POLICY IF EXISTS activity_logs_insert_own_or_admin ON public.activity_logs;
DROP POLICY IF EXISTS sessions_select_own_or_admin ON public.sessions;
DROP POLICY IF EXISTS sessions_insert_own_or_admin ON public.sessions;
DROP POLICY IF EXISTS sessions_update_own_or_admin ON public.sessions;
DROP POLICY IF EXISTS sessions_delete_own_or_admin ON public.sessions;

CREATE POLICY activity_logs_select_own_or_admin
ON public.activity_logs
FOR SELECT
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY activity_logs_insert_own_or_admin
ON public.activity_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY sessions_select_own_or_admin
ON public.sessions
FOR SELECT
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY sessions_insert_own_or_admin
ON public.sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY sessions_update_own_or_admin
ON public.sessions
FOR UPDATE
USING (auth.uid() = user_id OR public.is_admin(auth.uid()))
WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY sessions_delete_own_or_admin
ON public.sessions
FOR DELETE
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- =========================================================
-- PASO 9: Funcion admin_update_student_profile (editar alumno)
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

    -- Actualizar email en auth.users
    IF p_email IS NOT NULL AND LENGTH(TRIM(p_email)) > 0 THEN
        UPDATE auth.users
        SET email = TRIM(LOWER(p_email)),
            updated_at = NOW()
        WHERE id = p_student_id;
    END IF;

    -- Actualizar contrasena en auth.users (encriptada)
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
    SET
        email = COALESCE(NULLIF(TRIM(LOWER(p_email)), ''), email),
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
-- PASO 10: Funcion resolve_login_email (para login con username)
-- =========================================================
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
    IF POSITION('@' IN v_identifier) > 0 THEN
        RETURN v_identifier;
    END IF;
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
-- PASO 11: Trigger de updated_at automatico en profiles
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
-- PASO 12: VERIFICACION FINAL
-- =========================================================
DO $$ BEGIN
    RAISE NOTICE '===== RLS POLICIES APLICADAS CORRECTAMENTE =====';
END $$;

-- Ver cuantos alumnos hay (sin contar al admin)
SELECT
    COUNT(*) FILTER (WHERE role = 'student') AS total_alumnos,
    COUNT(*) FILTER (WHERE role = 'admin') AS total_admins
FROM public.profiles;

-- Listar los perfiles (ver que Tiffany sea admin)
SELECT
    id,
    email,
    full_name,
    username,
    role,
    created_at
FROM public.profiles
ORDER BY role DESC, created_at DESC;

COMMIT;

-- =========================================================
-- LISTO. El admin dashboard ya debe mostrar los alumnos.
-- Si no hay alumnos registrados: ve a register.html y crea uno
-- o en Supabase > Authentication > Users > Add user
-- =========================================================
