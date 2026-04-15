# ✅ Checklist de Configuración Supabase

## 🔍 Antes de Usar la App

### Paso 1️⃣: Verificar que la tabla `profiles` existe
En Supabase → SQL Editor → Ejecuta:
```sql
SELECT * FROM profiles LIMIT 1;
```
**Resultado esperado**: Mensaje "0 rows" (tabla vacía, pero existe)

❌ Si da error "relation profiles does not exist":
- Abre el archivo: `db/01_create_profiles_table.sql`
- Copia TODO el contenido
- Pégalo en Supabase SQL Editor
- Haz clic en Run

---

### Paso 2️⃣: Verificar que la función `create_user_profile` existe
En Supabase → SQL Editor → Ejecuta:
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema='public' AND routine_name='create_user_profile';
```
**Resultado esperado**: Una fila con `create_user_profile`

❌ Si NO aparece:
- Abre el archivo: `db/02_create_profile_function.sql`
- Copia TODO el contenido
- Pégalo en Supabase SQL Editor
- Haz clic en Run

---

### Paso 3️⃣: Verificar las políticas RLS
En Supabase → SQL Editor → Ejecuta:
```sql
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```
**Resultado esperado**: 4 filas (4 políticas)

❌ Si hay menos de 4:
- Vuelve a ejecutar `db/01_create_profiles_table.sql`

---

### Paso 4️⃣: Verificar las claves en `.env.local`
En tu editor, abre `.env.local` y verifica:
- [ ] `VITE_SUPABASE_URL=https://mfhfeytlgmkxuzlclawx.supabase.co`
- [ ] `VITE_SUPABASE_ANON_KEY=sb_publishable_...` (debe comenzar con `sb_publishable_`)
- [ ] `SUPABASE_SECRET_KEY=sb_secret_...` (debe comenzar con `sb_secret_`)

---

## 🚀 Después de Verificar Todo

```bash
# 1. Reinicia el servidor
npm run dev

# 2. Abre el navegador
http://localhost:3000/pages/register.html

# 3. Prueba registro con datos de prueba:
- Nombre: Juan Prueba
- Email: juan@test.com
- Contraseña: 123456
- Confirmar: 123456

# 4. Haz clic en "Crear Cuenta"
```

---

## 📊 Verificar que todo funcionó

Después de registrar un usuario, en Supabase:

### Verificar usuario en Auth:
1. Ve a **Authentication → Users**
2. Debes ver el nuevo usuario (juan@test.com)

### Verificar perfil creado:
En Supabase → SQL Editor → Ejecuta:
```sql
SELECT * FROM profiles WHERE email = 'juan@test.com';
```
**Resultado esperado**: Una fila con los datos del usuario

---

## 🐛 Si Sigue Dando Error

Abre DevTools (F12) en el navegador y:
1. Ve a **Console**
2. Intenta registrar de nuevo
3. Busca los mensajes de error
4. Copia cualquier error y comparte

O revisa los logs del servidor:
```bash
# En la terminal donde corre el servidor, busca líneas con:
# ⚠️ o ❌ o "Error"
```

---

## 📝 Archivos Importantes

| Archivo | Propósito |
|---------|-----------|
| `db/01_create_profiles_table.sql` | Crea tabla y políticas RLS |
| `db/02_create_profile_function.sql` | Crea función SQL para perfiles |
| `.env.local` | Variables de entorno (🔐 secreto) |
| `server.js` | Servidor Node.js con endpoints |
| `pages/register.html` | Formulario de registro |

---

¿LISTO? ¡Ejecuta los pasos! 🚀
