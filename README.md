# English Learning Platform

Una plataforma web para el aprendizaje de inglés con sistema de autenticación completo.

## 📁 Estructura del Proyecto

```
Pagina de Ingles/
│
├── index.html                 # Página principal con introducción
│
├── css/
│   └── styles.css            # Estilos principales (compartidos)
│
├── js/
│   └── script.js             # Validaciones con JavaScript
│
├── pages/
│   ├── login.html            # Página de iniciar sesión
│   └── register.html         # Página de registro
│
├── images/                    # Carpeta para imágenes (vacía)
│
└── README.md                 # Este archivo
```

## 🎨 Características

- **Página Principal (index.html)**
  - Introducción a la plataforma
  - Botones para Iniciar Sesión y Registrarse
  - Sección de características disponibles
  - Diseño responsivo

- **Página de Login (pages/login.html)**
  - Formulario con validación
  - Campo de email y contraseña
  - Validación en tiempo real
  - Enlace a registro

- **Página de Registro (pages/register.html)**
  - Formulario completo de registro
  - Campos: Nombre, Email, Contraseña, Confirmar Contraseña
  - Validaciones de seguridad
  - Verificación de coincidencia de contraseñas

## 🎯 Validaciones Incluidas

- ✅ Email válido
- ✅ Contraseña mínimo 6 caracteres
- ✅ Nombre completo de al menos 3 caracteres
- ✅ Confirmación de contraseña
- ✅ Mensajes de error claros

## 🚀 Cómo Usar

1. Abre `index.html` en tu navegador
2. Haz clic en "Iniciar Sesión" para ver la página de login
3. Haz clic en "Registrarse" para ver la página de registro
4. Completa los formularios y prueba las validaciones

## 🎨 Diseño

- Gradiente de colores atractivo (azul a púrpura)
- Interfaz moderna y limpia
- Totalmente responsivo (funciona en móvil, tablet y desktop)
- Botones con efectos hover
- Transiciones suaves

## 📝 Notas

- Los formularios incluyen validaciones básicas del lado del cliente
- Para una aplicación real, se debe implementar validación del lado del servidor
- Los datos actualmente no se guardan (es un prototipo)
- Los estilos están centralizados en `css/styles.css` para mantener consistencia
- Las validaciones están en `js/script.js` para reutilización

## 🔧 Próximas Mejoras Sugeridas

- Integración con base de datos
- Autenticación segura del lado del servidor
- Hash de contraseñas
- Confirmación de email
- Recuperación de contraseña
- Autenticación con redes sociales
