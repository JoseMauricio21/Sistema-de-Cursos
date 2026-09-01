-- ========================================
-- 1. CREAR TABLA DE PERFILES DE USUARIOS
-- ========================================
-- Ejecuta este script PRIMERO en Supabase SQL Editor

DROP TABLE IF EXISTS profiles CASCADE;

CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- POLÍTICA 1: Ver el perfil propio
CREATE POLICY "Usuarios pueden ver su propio perfil"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

-- POLÍTICA 2: Actualizar el perfil propio
CREATE POLICY "Usuarios pueden actualizar su propio perfil"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- POLÍTICA 3: Eliminar el perfil propio
CREATE POLICY "Usuarios pueden eliminar su propio perfil"
    ON profiles FOR DELETE
    USING (auth.uid() = id);

-- POLÍTICA 4: Insertar perfil (permite cualquier usuario autenticado agregar su perfil)
CREATE POLICY "Usuarios pueden insertar su propio perfil"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Crear índices para mejor rendimiento
CREATE INDEX idx_profiles_email ON profiles(email);

-- ✅ Script completado. Ahora ejecuta: 02_create_profile_function.sql
