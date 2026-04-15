# Guía de Despliegue en Cloudflare Pages

## Requisitos Previos
- Cuenta en Cloudflare (https://dash.cloudflare.com/)
- Repositorio conectado en GitHub
- Wrangler CLI instalado (opcional)

## Pasos para Desplegar

### 1. Conectar Repositorio en Cloudflare Dashboard

1. Ve a [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Selecciona **Pages** en el menú lateral izquierdo
3. Haz clic en **Crear un proyecto**
4. Selecciona **Conectar a Git**
5. Autoriza Cloudflare para acceder a tu GitHub
6. Selecciona el repositorio `Sistema-de-Cursos`

### 2. Configurar Compilación

En el formulario de configuración:

- **Nombre del Proyecto**: `pagina-de-ingles` (o el que prefieras)
- **Rama de Producción**: `main` (o `master`)
- **Framework preset**: `None`
- **Comando de compilación**: Dejar vacío (sitio estático multipágina)
- **Directorio de salida de compilación**: `/` (raíz del proyecto)

> Importante: si ves en logs `Executing user deploy command: npx wrangler versions upload`, el proyecto está usando flujo de **Workers** en vez de **Pages**. En Cloudflare Pages no uses ese comando; configura despliegue estático de la raíz o usa `wrangler pages deploy`.

### 3. Variables de Entorno (si es necesario)

Si usas variables de entorno, agrégalas en:
- **Settings** > **Environment Variables**

Variables recomendadas:
```
VITE_SUPABASE_URL=https://mfhfeytlgmkxuzlclawx.supabase.co
```

(Las claves secretas NO deben exponerse. Úsalas únicamente en el servidor)

### 4. Despliegue Automático

- Cada push a `main` se desplegará automáticamente
- Los cambios estarán disponibles en: `https://pagina-de-ingles.pages.dev`

## Despliegue Manual con Wrangler

### Instalar Wrangler
```bash
npm install -g @cloudflare/wrangler
```

### Desplegar
```bash
wrangler pages deploy . --project-name pagina-de-ingles
```

## Estructura de Archivos Especiales

- `_redirects` - Configuración de redirecciones
- `_headers` - Headers HTTP personalizados
- `wrangler.toml` - Configuración de Wrangler
- `.env` - Variables de entorno locales (NO se sube)

## Solución de Problemas

### Los estilos o scripts no cargan
- Verifica que las rutas sean relativas: `css/styles.css`, `js/script.js`
- Limpia el caché del navegador (Ctrl+Shift+Delete)

### Las imágenes no aparecen
- Verifica que estén en la carpeta `images/`
- Las rutas deben ser relativas: `images/logo.png`

### Error de CORS
- Revisa el archivo `_headers` para ver las configuraciones de CORS
- Cloudflare maneja CORS automáticamente para solicitudes entre dominios

## Monitoreo

1. Ve a **Pages** en Cloudflare Dashboard
2. Selecciona tu proyecto
3. Revisa:
   - **Analytics** - Tráfico y rendimiento
   - **Deployments** - Historial de despliegues
   - **Settings** - Configuración del proyecto

## Dominio Personalizado

Para conectar un dominio personalizado:
1. En **Pages** > **Tu Proyecto** > **Settings**
2. En **Domain** añade tu dominio
3. Actualiza los registros DNS en tu proveedor de dominios

---

¡Tu sitio estará disponible en Cloudflare Pages! 🚀
