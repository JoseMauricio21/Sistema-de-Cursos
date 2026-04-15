# Configuración de Supabase

Este directorio contiene la configuración y utilidades para conectar la aplicación con Supabase.

## Archivos

- **supabaseConfig.js** - Configuración de conexión a Supabase
- **authUtils.js** - Funciones de autenticación y gestión de usuarios
- **schema.sql** - Script SQL para crear las tablas en Supabase

## Pasos para Configurar Supabase

### 1. Crear Proyecto en Supabase
1. Ir a https://app.supabase.com
2. Haz clic en "New Project" o "Create a new project"
3. Rellena los datos del proyecto:
   - Nombre del proyecto
   - Base de datos password
   - Región (elige la más cercana)
4. Espera a que se cree el proyecto (2-3 minutos)

### 2. Obtener Credenciales
1. Una vez creado, ve a "Settings" > "API"
2. Copia:
   - **Project URL** (SUPABASE_URL)
   - **anon public** (SUPABASE_ANON_KEY)
3. Actualiza estos valores en `supabaseConfig.js`

### 3. Crear Tablas
1. En Supabase, ve a "SQL Editor"
2. Haz clic en "New Query"
3. Copia todo el contenido de `schema.sql`
4. Pega en el editor SQL
5. Haz clic en "Run"

### 4. Configurar Autenticación
1. Ve a "Authentication" en Supabase
2. En la pestaña "Providers", activa:
   - Email (siempre está habilitado)
3. En "Email Templates", personaliza los emails si lo deseas

## Uso en la Aplicación

### Registrar Usuario
```javascript
import { signUp } from './db/authUtils.js';

const result = await signUp('user@example.com', 'password123', 'Juan Pérez');
if (result.success) {
    console.log('Usuario registrado:', result.user);
}
```

### Iniciar Sesión
```javascript
import { signIn } from './db/authUtils.js';

const result = await signIn('user@example.com', 'password123');
if (result.success) {
    console.log('Sesión iniciada:', result.session);
}
```

### Cerrar Sesión
```javascript
import { signOut } from './db/authUtils.js';

await signOut();
```

### Obtener Usuario Actual
```javascript
import { getCurrentUser } from './db/authUtils.js';

const user = await getCurrentUser();
console.log('Usuario actual:', user);
```

## Talas de Supabase

### profiles
- `id` (UUID, PK) - ID del usuario
- `email` (TEXT) - Email del usuario
- `full_name` (TEXT) - Nombre completo
- `avatar_url` (TEXT) - URL de avatar
- `bio` (TEXT) - Biografía
- `created_at` (TIMESTAMP) - Fecha de creación
- `updated_at` (TIMESTAMP) - Fecha de actualización

### activity_logs
- `id` (UUID, PK) - ID del log
- `user_id` (UUID, FK) - ID del usuario
- `action` (TEXT) - Acción realizada
- `description` (TEXT) - Descripción
- `ip_address` (INET) - IP del usuario
- `created_at` (TIMESTAMP) - Fecha de creación

### sessions
- `id` (UUID, PK) - ID de sesión
- `user_id` (UUID, FK) - ID del usuario
- `session_token` (TEXT) - Token de sesión
- `expires_at` (TIMESTAMP) - Fecha de expiración
- `created_at` (TIMESTAMP) - Fecha de creación

## Variables de Entorno (Opcional)

Puedes crear un archivo `.env` en la raíz del proyecto:

```
VITE_SUPABASE_URL=https://your-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Luego actualiza `supabaseConfig.js`:

```javascript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
```

## Row Level Security (RLS)

Las tablas tienen habilitado RLS para proteger los datos:
- Los usuarios solo pueden ver/editar su propio perfil
- Los logs de actividad solo son visibles para el usuario propietario

## Recursos Útiles

- [Documentación de Supabase](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Autenticación en Supabase](https://supabase.com/docs/guides/auth)
