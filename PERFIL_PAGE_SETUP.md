# Configuración de Página de Perfil

## ¿Qué se hizo?

Se creó un sistema completo de edición de perfil de usuario que permite:

1. **Ver datos del perfil** - Nombre, email, biografía y foto
2. **Editar datos** - Actualizar nombre, biografía y URL de foto
3. **Cambiar foto de perfil** - Subir una imagen o usar URL
4. **Sincronizar con Supabase** - Todos los cambios se guardan en la base de datos

## Archivos Creados

### Frontend
- `pages/perfil.html` - Página de edición de perfil
- `css/perfil.css` - Estilos completos y responsivos
- `js/perfil.js` - Lógica de carga y actualización de perfil

### Backend
- `server.js` - Nuevos endpoints:
  - `POST /api/update-profile` - Actualizar datos de perfil
  - `POST /api/upload-profile-photo` - Subir foto de perfil

### Base de Datos
- `db/03_update_profiles_table_for_profile_page.sql` - Migración SQL

## Campos disponibles en la tabla `profiles`

```
- id (UUID) - ID único del usuario
- email (TEXT) - Email del usuario
- full_name (TEXT) - Nombre completo
- avatar_url (TEXT) - URL de la foto de perfil
- bio (TEXT) - Biografía del usuario (máx. 500 caracteres)
- created_at (TIMESTAMP) - Fecha de creación
- updated_at (TIMESTAMP) - Fecha de última actualización
```

## Configuración Requerida

### 1. Ejecutar migración SQL en Supabase

1. Ir a: https://app.supabase.com/project/[TU_PROYECTO]/sql/new
2. Copiar el contenido de `db/03_update_profiles_table_for_profile_page.sql`
3. Ejecutar el script

### 2. Verificar políticas de RLS

Los endpoints del servidor ya manejan la autorización, pero verifica que existan estas políticas:

```sql
-- Usuarios pueden ver su propio perfil
CREATE POLICY "Usuarios pueden ver su propio perfil"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

-- Usuarios pueden actualizar su propio perfil
CREATE POLICY "Usuarios pueden actualizar su propio perfil"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);
```

## Cómo Funciona

### Flujo de Edición de Perfil

1. Usuario hace click en la foto de perfil en la página "Inicio"
2. Se abre `perfil.html`
3. El JavaScript carga los datos del perfil desde Supabase
4. Usuario edita los campos (nombre, biografía, foto)
5. Al hacer click en "Guardar Cambios", se envía una petición a `/api/update-profile`
6. El servidor valida y actualiza los datos en Supabase
7. Se muestra un mensaje de éxito
8. Los datos se sincronizan en localStorage

### Cambio de Foto

Hay dos formas de cambiar la foto:

1. **Usando el botón de cámara** - Se abre un selector de archivos
2. **Usando URL** - Pegar la URL directa de una imagen

El endpoint `/api/upload-profile-photo` actualmente devuelve una URL de avatar generada. Para producción, implementa:
- Supabase Storage
- Cloudinary
- AWS S3
- Otro servicio de almacenamiento

## Navegación

- **Acceder al perfil**: Click en la foto de perfil en la página "Inicio"
- **Volver al dashboard**: Click en el botón "Volver" o usar el navegador

## Seguridad

- La email no puede ser editada (campo deshabilitado)
- Solo usuarios autenticados pueden acceder
- Los cambios son validados en el servidor
- Las políticas de RLS protegen los datos en Supabase

## Próximas Mejoras Recomendadas

1. **Implementar almacenamiento de fotos**
   - Usar Supabase Storage para subir imágenes directamente
   - O integrar con Cloudinary

2. **Validaciones adicionales**
   - Validar longitud de nombre
   - Validar URL de imagen antes de guardar

3. **Interfaz de usuario mejorada**
   - Previsualizaciones de imagen
   - Crop de imagen
   - Efecto de hover mejorado

4. **Campos adicionales**
   - País/Ciudad
   - Teléfono
   - Fecha de nacimiento
   - Preferencias de idioma

## Troubleshooting

### Error "No user found"
- Verifica que has hecho login correctamente
- Comprueba que los datos del usuario están en localStorage

### Error "Profile not found"
- Es normal en el primer acceso
- El perfil se crea automáticamente

### Error al actualizar perfil
- Verifica que la migración SQL se ejecutó correctamente
- Comprueba que las políticas de RLS están habilitadas
- Revisa los logs del servidor

### Foto no se carga
- El formato de URL debe ser correcto
- La imagen debe ser accesible públicamente
- Verifica el endpoint de upload-profile-photo

---

**Creado en**: Abril 2026
**Versión**: 1.0
