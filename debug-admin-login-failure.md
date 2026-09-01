# DEBUG: Admin Login Failure
- **Session ID**: admin-login-failure
- **Status**: [OPEN]
- **Created**: 2026-09-01
- **Symptom**: Usuario admin (tiffanyoropeza@eleth.com.mx) no puede iniciar sesión a pesar de estar creado y con role=admin en profiles.
- **Expected**: Login exitoso → redirección a admin_dashboard.html
---

## HIPÓTESIS (Falsificables)
| # | Hipótesis | Punto de observación |
|---|-----------|----------------------|
| H1 | El servidor Express (`server.js`) no está corriendo o no se pudo conectar a Supabase | Logs de consola del servidor; status code response de /api/login |
| H2 | Las políticas RLS de `public.profiles` bloquean la lectura del propio perfil por parte del usuario autenticado | Logs de Supabase; intento SELECT desde el cliente con la sesión activa |
| H3 | `.env.local` no es cargado correctamente por `server.js` → `SUPABASE_SECRET_KEY` es undefined | Logs de inicio del server; variables impresas al arranque |
| H4 | El flujo de login en `pages/login.html` usa el endpoint `/api/login` pero devuelve error 400/500 | Network tab del navegador; response body de /api/login |
| H5 | `script.js` (lado cliente) tiene problema de inicialización de cliente Supabase o caché de credenciales vieja | Consola del navegador (errores JS); Network tab de peticiones a Supabase |

---

## EVIDENCIA RECOLECTADA
*(Se llenará después de instrumentar y reproducir)*

| Paso | Evidencia | Confirmada / Rechazada |
|------|-----------|------------------------|
| - | - | - |

---

## FIXES APLICADOS
*(Se llenará después de confirmar causa raíz)*

---

## POST-FIX VERIFICATION
| Prueba | Resultado pre-fix | Resultado post-fix |
|--------|-------------------|--------------------|
| Login admin | - | - |
