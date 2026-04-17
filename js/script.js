// Supabase configuration for browser auth flows
const SUPABASE_URL = 'https://mfhfeytlgmkxuzlclawx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_TBRrwMbabN6X0NcO5656ew_imJDTeaj';
const POST_LOGIN_LOADING_PATH = '/pages/loading.html';

let supabaseClient = null;

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

    const isAuthPage = document.getElementById('loginForm') || document.getElementById('registerForm');
    if (isAuthPage) {
        clearLegacyLocalAuthData();
        redirectIfAuthenticated().catch(error => {
            console.warn('No se pudo restaurar la sesión:', error.message);
        });
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

function validateUsername(username) {
    const re = /^[a-zA-Z0-9._-]{3,30}$/;
    return re.test(username);
}

// Validar contraseña
function validatePassword(password) {
    return password.length >= 6;
}

function clearLegacyLocalAuthData() {
    // Remove legacy keys from previous builds that persisted auth in localStorage.
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    localStorage.removeItem('sb-mfhfeytlgmkxuzlclawx-auth-token');
}

function getSupabaseClient() {
    if (supabaseClient) {
        return supabaseClient;
    }

    if (!window.supabase || !window.supabase.createClient) {
        return null;
    }

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            storage: window.sessionStorage,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    });
    return supabaseClient;
}

function getFriendlyAuthError(error) {
    const rawMessage = error?.message || 'Error de autenticación.';
    const normalized = rawMessage.toLowerCase();

    if (normalized.includes('invalid login credentials')) {
        return 'Email o contraseña incorrectos.';
    }

    if (normalized.includes('email not confirmed')) {
        return 'Debes confirmar tu email antes de iniciar sesión.';
    }

    if (normalized.includes('user already registered')) {
        return 'Este email ya está registrado.';
    }

    if (normalized.includes('password')) {
        return 'La contraseña no cumple los requisitos mínimos.';
    }

    return rawMessage;
}

async function fetchUserProfile(userId) {
    const client = getSupabaseClient();
    if (!client || !userId) {
        return null;
    }

    const { data, error } = await client
        .from('profiles')
        .select('id, email, full_name, username, role, avatar_url')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        console.warn('No se pudo leer el perfil:', error.message);
        return null;
    }

    return data;
}

async function ensureUserProfile(user, fullName) {
    const client = getSupabaseClient();
    if (!client || !user?.id) {
        return;
    }

    const fallbackName = fullName || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Estudiante';
    const fallbackUsername = (user.user_metadata?.username || user.email?.split('@')[0] || '').toLowerCase() || null;

    // Intento 1: usar la RPC si existe
    try {
        const { error: rpcError } = await client.rpc('create_user_profile', {
            user_id: user.id,
            user_email: user.email,
            user_full_name: fallbackName,
        });

        if (!rpcError) {
            return;
        }

        console.warn('RPC create_user_profile no disponible:', rpcError.message);
    } catch (rpcException) {
        console.warn('No se pudo ejecutar create_user_profile:', rpcException.message);
    }

    // Intento 2: upsert directo en profiles
    const { error: upsertError } = await client
        .from('profiles')
        .upsert(
            {
                id: user.id,
                email: user.email,
                full_name: fallbackName,
                username: fallbackUsername,
            },
            { onConflict: 'id' }
        );

    if (upsertError) {
        console.warn('No se pudo crear perfil automáticamente:', upsertError.message);
    }
}

function buildLocalUser(user, profile, fallbackName) {
    const nameFromEmail = user?.email ? user.email.split('@')[0] : 'Estudiante';

    return {
        id: user?.id || '',
        email: profile?.email || user?.email || '',
        name: profile?.full_name || user?.user_metadata?.full_name || fallbackName || nameFromEmail,
        username: profile?.username || user?.user_metadata?.username || nameFromEmail,
        role: profile?.role || user?.user_metadata?.role || 'student',
        avatar_url: profile?.avatar_url || null,
    };
}

function getPostLoginTarget(localUser) {
    if (localUser?.role === 'admin') {
        return '/pages/admin_dashboard.html';
    }

    return '/pages/curso_dashboard.html';
}

async function resolveEmailForLogin(loginIdentifier) {
    const normalized = loginIdentifier.trim().toLowerCase();

    if (normalized.includes('@')) {
        if (!validateEmail(normalized)) {
            throw new Error('El email no es valido.');
        }
        return normalized;
    }

    if (!validateUsername(normalized)) {
        throw new Error('El usuario debe tener 3-30 caracteres y solo letras, numeros, punto, guion o guion bajo.');
    }

    const client = getSupabaseClient();
    if (!client) {
        throw new Error('No se pudo inicializar Supabase.');
    }

    const { data, error } = await client
        .rpc('resolve_login_email', { p_identifier: normalized });

    if (error) {
        throw new Error('No se pudo resolver el usuario. Verifica la funcion SQL resolve_login_email.');
    }

    if (!data) {
        throw new Error('Usuario no encontrado.');
    }

    return data;
}

async function redirectIfAuthenticated() {
    const client = getSupabaseClient();
    if (!client) {
        return;
    }

    const { data, error } = await client.auth.getSession();
    if (error || !data?.session?.user) {
        return;
    }

    const currentUser = data.session.user;
    const profile = await fetchUserProfile(currentUser.id);
    const localUser = buildLocalUser(currentUser, profile);

    sessionStorage.setItem('user', JSON.stringify(localUser));
    if (data.session.access_token) {
        sessionStorage.setItem('accessToken', data.session.access_token);
    }

    if (localUser.role === 'admin') {
        window.location.href = '/pages/admin_dashboard.html';
        return;
    }

    window.location.href = '/pages/curso_dashboard.html';
}

// Validar formulario de login
async function validateLoginForm(event) {
    event.preventDefault();

    const loginIdentifier = document.getElementById('email').value.trim();
    const passwordInput = document.getElementById('password').value;
    const password = passwordInput;

    let isValid = true;

    // Limpiar mensajes de error previos
    document.querySelectorAll('.error-message').forEach(el => el.remove());

    // Validar email
    if (!loginIdentifier) {
        showError('email', 'El usuario o email es requerido');
        isValid = false;
    } else if (loginIdentifier.includes('@') && !validateEmail(loginIdentifier)) {
        showError('email', 'El email no es valido');
        isValid = false;
    } else if (!loginIdentifier.includes('@') && !validateUsername(loginIdentifier.toLowerCase())) {
        showError('email', 'El usuario no es valido');
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

    if (!isValid) {
        return false;
    }

    const client = getSupabaseClient();
    if (!client) {
        showError('email', 'No se pudo inicializar Supabase. Recarga la página.');
        return false;
    }

    try {
        const resolvedEmail = await resolveEmailForLogin(loginIdentifier);

        let { data, error } = await client.auth.signInWithPassword({
            email: resolvedEmail,
            password,
        });

        // Retry once with trimmed password when users paste credentials with accidental spaces.
        if (
            error &&
            error.message &&
            error.message.toLowerCase().includes('invalid login credentials') &&
            passwordInput !== passwordInput.trim() &&
            passwordInput.trim().length >= 6
        ) {
            ({ data, error } = await client.auth.signInWithPassword({
                email: resolvedEmail,
                password: passwordInput.trim(),
            }));
        }

        if (error) {
            showError('email', getFriendlyAuthError(error));
            return false;
        }

        const profile = await fetchUserProfile(data.user.id);
        const localUser = buildLocalUser(data.user, profile);

        sessionStorage.setItem('user', JSON.stringify(localUser));
        if (data.session?.access_token) {
            sessionStorage.setItem('accessToken', data.session.access_token);
        } else {
            sessionStorage.removeItem('accessToken');
        }

        sessionStorage.setItem('postLoginTarget', getPostLoginTarget(localUser));
        window.location.href = POST_LOGIN_LOADING_PATH;
    } catch (error) {
        console.error('Error de login:', error);
        showError('email', getFriendlyAuthError(error));
    }

    return false;
}

// Validar formulario de registro
async function validateRegisterForm(event) {
    event.preventDefault();

    const fullname = document.getElementById('fullname').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

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

    if (!isValid) {
        return false;
    }

    const client = getSupabaseClient();
    if (!client) {
        showError('email', 'No se pudo inicializar Supabase. Recarga la página.');
        return false;
    }

    try {
        const { data, error } = await client.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullname,
                    username: email.split('@')[0].toLowerCase(),
                },
                emailRedirectTo: `${window.location.origin}/pages/login.html`,
            },
        });

        if (error) {
            showError('email', getFriendlyAuthError(error));
            return false;
        }

        if (data.user) {
            await ensureUserProfile(data.user, fullname);
        }

        if (data.session?.user) {
            const profile = await fetchUserProfile(data.session.user.id);
            const localUser = buildLocalUser(data.session.user, profile, fullname);
            sessionStorage.setItem('user', JSON.stringify(localUser));

            if (data.session.access_token) {
                sessionStorage.setItem('accessToken', data.session.access_token);
            }

            window.location.href = '/pages/curso_dashboard.html';
            return false;
        }

        alert('Registro exitoso. Revisa tu email para confirmar la cuenta y luego inicia sesión.');
        window.location.href = '/pages/login.html';
    } catch (error) {
        console.error('Error de registro:', error);
        showError('email', 'Error de conexión con Supabase.');
    }

    return false;
}

// Mostrar mensaje de error
function showError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field || !field.parentElement) {
        alert(message);
        return;
    }

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
async function loginWithGoogle() {
    const client = getSupabaseClient();
    if (!client) {
        alert('No se pudo inicializar Supabase.');
        return;
    }

    const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${window.location.origin}${POST_LOGIN_LOADING_PATH}`,
        },
    });

    if (error) {
        alert('No se pudo iniciar sesión con Google: ' + getFriendlyAuthError(error));
    }
}
