-- ========================================
-- CORRECCIÓN COMPLETA DE RLS Y TRIGGERS
-- ========================================
-- Ejecuta esto en SQL Editor de Supabase

-- 1. ELIMINAR POLÍTICAS EXISTENTES
-- Profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON profiles;

-- Activity Logs
DROP POLICY IF EXISTS "Users can view their own logs" ON activity_logs;

-- Sessions
DROP POLICY IF EXISTS "Users can view their own sessions" ON sessions;

-- 2. CREAR O ACTUALIZAR LA TABLA PROFILES
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    role TEXT DEFAULT 'student',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. HABILITAR RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. CREAR POLÍTICAS RLS CORRECTAS
-- Permiso para ver el perfil propio
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Permiso para actualizar el perfil propio
CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Permiso para insertar (permite al sistema durante registro - IMPORTANTE)
CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT
    WITH CHECK (true);

-- Permiso para eliminar el perfil propio
CREATE POLICY "Users can delete their own profile" ON profiles
    FOR DELETE
    USING (auth.uid() = id);

-- 5. CREAR FUNCIÓN PARA INSERTAR PERFIL AUTOMÁTICAMENTE
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at)
  VALUES (new.id, new.email, COALESCE(new.user_metadata->>'full_name', new.email), now())
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. CREAR TRIGGER PARA EJECUTAR LA FUNCIÓN
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. CREAR TABLA ACTIVITY_LOGS
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    description TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Recrear políticas para activity_logs
DROP POLICY IF EXISTS "Users can view their own logs" ON activity_logs;
CREATE POLICY "Users can view their own logs" ON activity_logs
    FOR SELECT
    USING (auth.uid() = user_id);

-- 8. CREAR TABLA SESSIONS
CREATE TABLE IF NOT EXISTS sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    session_token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Recrear políticas para sessions
DROP POLICY IF EXISTS "Users can view their own sessions" ON sessions;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions" ON sessions
    FOR SELECT
    USING (auth.uid() = user_id);

-- 9. CREAR ÍNDICES
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- ========================================
-- VERIFICACIÓN Y DEBUGGING
-- ========================================
-- Ejecuta estas consultas si aún hay problemas:
-- SELECT * FROM pg_policy WHERE schemaname = 'public' AND tablename = 'profiles';
-- SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
-- SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created';
