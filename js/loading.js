const SUPABASE_URL = 'https://mfhfeytlgmkxuzlclawx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_TBRrwMbabN6X0NcO5656ew_imJDTeaj';

let supabaseClient = null;

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

function getGreetingByHour(date = new Date()) {
    const hour = date.getHours();

    if (hour < 12) {
        return 'Buenos dias';
    }

    if (hour < 19) {
        return 'Buenas tardes';
    }

    return 'Buenas noches';
}

function getSafeName(localUser) {
    const rawName = localUser?.name || localUser?.full_name || localUser?.username || localUser?.email || 'estudiante';
    return String(rawName).split('@')[0].trim() || 'estudiante';
}

function buildLocalUser(user, profile) {
    const emailFallback = user?.email || '';
    const emailName = emailFallback ? emailFallback.split('@')[0] : 'estudiante';

    return {
        id: user?.id || '',
        email: profile?.email || emailFallback,
        name: profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || emailName,
        username: profile?.username || user?.user_metadata?.username || emailName,
        role: profile?.role || user?.user_metadata?.role || 'student',
        avatar_url: profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null,
    };
}

async function fetchUserProfile(client, userId) {
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

function setAvatar(localUser) {
    const avatarContainer = document.getElementById('loadingAvatar');
    const avatarImage = document.getElementById('loadingAvatarImage');

    if (!avatarContainer || !avatarImage) {
        return;
    }

    const avatarUrl = localUser?.avatar_url;
    if (!avatarUrl) {
        avatarContainer.classList.remove('has-image');
        avatarImage.removeAttribute('src');
        return;
    }

    avatarImage.src = avatarUrl;
    avatarContainer.classList.add('has-image');
}

function setGreeting(localUser) {
    const greetingElement = document.getElementById('loadingGreeting');
    if (!greetingElement) {
        return;
    }

    const greeting = getGreetingByHour();
    const name = getSafeName(localUser);
    greetingElement.textContent = `${greeting}, ${name}`;
}

function getTargetPage(localUser) {
    if (!localUser) {
        return '/pages/login.html';
    }

    const targetFromSession = sessionStorage.getItem('postLoginTarget');
    if (
        targetFromSession === '/pages/admin_dashboard.html' ||
        targetFromSession === '/pages/curso_dashboard.html'
    ) {
        return targetFromSession;
    }

    if (localUser.role === 'admin') {
        return '/pages/admin_dashboard.html';
    }

    return '/pages/curso_dashboard.html';
}

async function resolveLoggedUser() {
    const stored = sessionStorage.getItem('user');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.id) {
                return parsed;
            }
        } catch (error) {
            console.warn('Sesion local invalida:', error.message);
        }
    }

    const client = getSupabaseClient();
    if (!client) {
        return null;
    }

    const { data, error } = await client.auth.getSession();
    if (error || !data?.session?.user) {
        return null;
    }

    const sessionUser = data.session.user;
    const profile = await fetchUserProfile(client, sessionUser.id);
    const localUser = buildLocalUser(sessionUser, profile);

    sessionStorage.setItem('user', JSON.stringify(localUser));

    if (data.session.access_token) {
        sessionStorage.setItem('accessToken', data.session.access_token);
    } else {
        sessionStorage.removeItem('accessToken');
    }

    return localUser;
}

async function initializeLoadingScreen() {
    const localUser = await resolveLoggedUser();

    setGreeting(localUser);
    setAvatar(localUser);

    const targetPage = getTargetPage(localUser);

    window.setTimeout(() => {
        document.body.classList.add('is-exiting');
    }, 2200);

    window.setTimeout(() => {
        sessionStorage.removeItem('postLoginTarget');
        window.location.href = targetPage;
    }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    initializeLoadingScreen().catch(error => {
        console.error('Error en pantalla de carga:', error);

        window.setTimeout(() => {
            window.location.href = '/pages/login.html';
        }, 3000);
    });
});
