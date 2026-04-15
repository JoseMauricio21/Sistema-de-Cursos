# 🔧 Configuración de Supabase - Guía Completa

## ✅ Estado Actual
- ✅ Claves configuradas en `.env.local`
- ✅ Servidor actualizado con SECRET KEY
- ✅ Cliente actualizado con ANON KEY  
- ⏳ **PENDIENTE**: Ejecutar scripts SQL en Supabase

---

## 📋 Pasos para Configurar Supabase

### 1️⃣ Accede a tu Proyecto Supabase
1. Ve a [https://app.supabase.com](https://app.supabase.com)
2. Selecciona tu proyecto
3. Abre la pestaña **SQL Editor**

---

### 2️⃣ Ejecuta el Schema (Crear Tablas)

⚠️ **Copia SOLO el código SQL (sin los backticks)** y pégalo en el **SQL Editor** de Supabase:

```
-- ========================================
-- CREAR TABLA DE PERFILES DE USUARIOS
-- ========================================
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

-- 📌 POLÍTICA 1: Ver el perfil propio
CREATE POLICY "Usuarios pueden ver su propio perfil"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

-- 📌 POLÍTICA 2: Actualizar el perfil propio
CREATE POLICY "Usuarios pueden actualizar su propio perfil"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- 📌 POLÍTICA 3: Eliminar el perfil propio
CREATE POLICY "Usuarios pueden eliminar su propio perfil"
    ON profiles FOR DELETE
    USING (auth.uid() = id);

-- 📌 POLÍTICA 4: Insertar perfil (permite cualquier usuario autenticado agregar su perfil)
CREATE POLICY "Usuarios pueden insertar su propio perfil"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Crear índices para mejor rendimiento
CREATE INDEX idx_profiles_email ON profiles(email);
```

---

### 3️⃣ Crea la Función SQL para Perfiles

⚠️ **Copia SOLO el código SQL (sin los backticks)** y pégalo en el **SQL Editor** y ejecutalo:

```
-- ========================================
-- FUNCIÓN PARA CREAR PERFILES
-- ========================================
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
```

---

### 4️⃣ Habilitar Email en Auth (Opcional)
Si quieres que los usuarios confirmen su email:

1. Ve a **Authentication → Providers → Email**
2. Activa: ✅ "Confirm email"
3. Otros settings según prefieras

---

## 🚀 Iniciar el Servidor

```bash
# Instalar dependencias
npm install

# Iniciar servidor
npm run dev
# o
npm start
```

El servidor correrá en: **http://localhost:3000**

---

## 🧪 Pruebas

### Registro:
1. Abre http://localhost:3000/pages/register.html
2. Completa el formulario
3. Haz clic en "Crear Cuenta"
4. Verifica en Supabase: **Authentication → Users** (debe aparecer ahí)
5. Verifica en Supabase: **SQL Editor** ejecuta:
   ```sql
   SELECT * FROM profiles;
   ```

### Login:
1. Abre http://localhost:3000/pages/login.html
2. Usa las credenciales que registraste
3. Debería redirigirte al dashboard

---

## 🐛 Solución de Problemas

### ❌ "Credenciales de Supabase no configuradas"
- Verifica que `.env.local` tenga las claves correctas
- Reinicia el servidor

### ❌ "Error al crear perfil"
- Asegúrate de ejecutar los scripts SQL en orden
- Verifica que la función `create_user_profile` exista
- Comprueba que las políticas RLS estén activas

### ❌ "Usuario no se registra"
- Abre DevTools (F12) → Consola
- Busca el error exacto
- Verifica que el servidor esté corriendo

### ❌ "Error al iniciar sesión después de registrar"
- El usuario necesita confirmar su email (si está habilitado)
- O hay un error en las políticas RLS

---

## 📂 Archivos Clave

- **server.js** - Servidor Express con endpoints de auth
- **db/supabaseConfig.js** - Config del cliente Supabase
- **.env.local** - Variables de entorno (🔐 NO COMPARTIR)
- **pages/register.html** - Formulario de registro
- **pages/login.html** - Formulario de login
- **js/script.js** - Lógica de validación de formularios

---

## ✅ Checklist Final

- [ ] Scripts SQL ejecutados en Supabase
- [ ] `.env.local` tiene claves correctas
- [ ] npm install completado
- [ ] Servidor corriendo sin errores
- [ ] Pruebas de registro y login funciona
- [ ] Usuarios aparecen en Supabase

¡Listo! 🎉
