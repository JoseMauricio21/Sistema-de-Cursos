// Control de video continuo entre páginas
window.addEventListener('load', function() {
    const video = document.querySelector('.video-bg');
    if (video) {
        // Recuperar el tiempo guardado del video
        const savedTime = sessionStorage.getItem('videoTime');
        if (savedTime) {
            video.currentTime = parseFloat(savedTime);
        }
        
        // Guardar el tiempo actual del video cada segundo
        setInterval(function() {
            if (video && !video.paused) {
                sessionStorage.setItem('videoTime', video.currentTime);
            }
        }, 1000);
    }
});

// Guardar el tiempo del video antes de navegar
window.addEventListener('beforeunload', function() {
    const video = document.querySelector('.video-bg');
    if (video) {
        sessionStorage.setItem('videoTime', video.currentTime);
    }
});

// Validar email
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Validar contraseña
function validatePassword(password) {
    return password.length >= 6;
}

// Validar formulario de login
async function validateLoginForm(event) {
    event.preventDefault();
    
    console.log('🔴 INICIANDO VALIDACIÓN DE LOGIN');
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    console.log('📝 Datos del formulario:', { email, password: password ? '***' : '' });
    
    let isValid = true;
    
    // Limpiar mensajes de error previos
    document.querySelectorAll('.error-message').forEach(el => el.remove());
    
    // Validar email
    if (!email) {
        showError('email', 'El email es requerido');
        isValid = false;
    } else if (!validateEmail(email)) {
        showError('email', 'El email no es válido');
        isValid = false;
    }
    
    // Validar contraseña
    if (!password) {
        showError('password', 'La contraseña es requerida');
        isValid = false;
    } else if (!validatePassword(password)) {
        showError('password', 'La contraseña debe tener al menos 6 caracteres');
        isValid = false;
    }
    
    if (isValid) {
        try {
            console.log('📤 Enviando solicitud a /api/login');
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });
            
            console.log('📥 Respuesta recibida:', response.status);
            const data = await response.json();
            console.log('📊 Datos de respuesta:', data);
            
            if (response.ok) {
                // Guardar token y datos de usuario
                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                console.log('✅ Login exitoso, redirigiendo...');
                // Redireccionar según el rol
                if (data.user.role === 'admin') {
                    window.location.href = '/pages/admin.html';
                } else {
                    window.location.href = '/pages/curso_dashboard.html';
                }
            } else {
                console.error('❌ Error en respuesta:', data.error);
                showError('email', data.error || 'Error en el login');
            }
        } catch (error) {
            console.error('❌ Error de conexión:', error);
            showError('email', 'Error de conexión con el servidor');
        }
    }
    
    return false;
}

// Validar formulario de registro
async function validateRegisterForm(event) {
    event.preventDefault();
    
    console.log('🔴 INICIANDO VALIDACIÓN DE REGISTRO');
    
    const fullname = document.getElementById('fullname').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    console.log('📝 Datos del formulario:', { fullname, email, password: password ? '***' : '', confirmPassword: confirmPassword ? '***' : '' });
    
    let isValid = true;
    
    // Limpiar mensajes de error previos
    document.querySelectorAll('.error-message').forEach(el => el.remove());
    
    // Validar nombre
    if (!fullname) {
        showError('fullname', 'El nombre completo es requerido');
        isValid = false;
    } else if (fullname.length < 3) {
        showError('fullname', 'El nombre debe tener al menos 3 caracteres');
        isValid = false;
    }
    
    // Validar email
    if (!email) {
        showError('email', 'El email es requerido');
        isValid = false;
    } else if (!validateEmail(email)) {
        showError('email', 'El email no es válido');
        isValid = false;
    }
    
    // Validar contraseña
    if (!password) {
        showError('password', 'La contraseña es requerida');
        isValid = false;
    } else if (!validatePassword(password)) {
        showError('password', 'La contraseña debe tener al menos 6 caracteres');
        isValid = false;
    }
    
    // Validar confirmación de contraseña
    if (!confirmPassword) {
        showError('confirmPassword', 'Debe confirmar la contraseña');
        isValid = false;
    } else if (password !== confirmPassword) {
        showError('confirmPassword', 'Las contraseñas no coinciden');
        isValid = false;
    }
    
    if (isValid) {
        try {
            console.log('📤 Enviando solicitud a /api/register');
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ fullname, email, password, confirmPassword })
            });
            
            console.log('📥 Respuesta recibida:', response.status);
            const data = await response.json();
            console.log('📊 Datos de respuesta:', data);
            
            if (response.ok) {
                alert('¡Registro exitoso! Por favor inicia sesión.');
                window.location.href = '/pages/login.html';
            } else {
                console.error('❌ Error en respuesta:', data.error);
                showError('email', data.error || 'Error en el registro');
            }
        } catch (error) {
            console.error('❌ Error de conexión:', error);
            showError('email', 'Error de conexión con el servidor');
        }
    }
    
    return false;
}

// Mostrar mensaje de error
function showError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    field.parentElement.appendChild(errorDiv);
}

// Mostrar/Ocultar contraseña
function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
    } else {
        input.type = 'password';
    }
}

// Login con Google
function loginWithGoogle() {
    alert('Función de Google Login - A implementar con credenciales de Google OAuth');
    console.log('Iniciando login con Google');
}
