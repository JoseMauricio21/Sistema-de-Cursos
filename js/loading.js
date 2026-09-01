// #region debug-point H5:loading-init
(()=>{try{const s='admin-login-failure';fetch('http://127.0.0.1:7777/event',{method:'POST',body:JSON.stringify({sessionId:s,runId:'pre',hypothesisId:'H5',location:'js/loading.js:1',msg:'[DEBUG] loading.js cargado',data:{url:window?.location?.href||''},ts:Date.now()})}).catch(()=>{})}catch{}})();
console.log('[LOADING-DEBUG] 🔄 loading.js cargado (modulo) en:', window.location.href);
// #endregion

const SUPABASE_URL = 'https://piiaoucyrlvrodzxwjeh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DblZb-R3rmsPTZSKBeXHCw_8GM5B4qh';

let supabaseClient = null;

const POST_GREETING_MIN_MS = 1200;

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

function showGreetingCard() {
    const card = document.getElementById('loadingCard');
    if (card) {
        card.classList.add('is-visible');
    }
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
        console.log('[LOADING-DEBUG] fetchUserProfile: FALTA client o userId', { client: !!client, userId });
        return null;
    }

    console.log('[LOADING-DEBUG] fetchUserProfile: SELECT profiles WHERE id =', userId);

    const { data, error } = await client
        .from('profiles')
        .select('id, email, full_name, username, role, avatar_url')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        console.warn('[LOADING-DEBUG] ❌ fetchUserProfile ERROR:', error.code, error.message, error.details, error.hint);
        return null;
    }

    console.log('[LOADING-DEBUG] ✅ fetchUserProfile EXITO, data =', JSON.stringify(data, null, 2));
    console.log('[LOADING-DEBUG] 👉 ROLe leído =', data?.role);
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
        console.log('[LOADING-DEBUG] getTargetPage: localUser NULL → login.html');
        return '/pages/login.html';
    }

    const targetFromSession = sessionStorage.getItem('postLoginTarget');
    console.log('[LOADING-DEBUG] getTargetPage: targetFromSession =', targetFromSession);
    console.log('[LOADING-DEBUG] getTargetPage: localUser.role =', localUser?.role);

    if (
        targetFromSession === '/pages/admin_dashboard.html' ||
        targetFromSession === '/pages/curso_dashboard.html'
    ) {
        console.log('[LOADING-DEBUG] getTargetPage: ✅ Usando target de sessionStorage:', targetFromSession);
        return targetFromSession;
    }

    if (localUser.role === 'admin') {
        console.log('[LOADING-DEBUG] getTargetPage: ✅ localUser es ADMIN → admin_dashboard.html');
        return '/pages/admin_dashboard.html';
    }

    console.log('[LOADING-DEBUG] getTargetPage: ⚠️ NO admin, role =', localUser?.role, '→ curso_dashboard.html');
    return '/pages/curso_dashboard.html';
}

async function resolveLoggedUser() {
    console.log('[LOADING-DEBUG] resolveLoggedUser INICIADO');

    const stored = sessionStorage.getItem('user');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.id) {
                console.log('[LOADING-DEBUG] ✅ Usuario LEÍDO de sessionStorage, role =', parsed?.role);
                console.log('[LOADING-DEBUG]    sessionStorage.user =', JSON.stringify(parsed, null, 2));
                return parsed;
            }
        } catch (error) {
            console.warn('[LOADING-DEBUG] Sesion local invalida:', error.message);
        }
    } else {
        console.log('[LOADING-DEBUG] ⚠️ sessionStorage.user NO EXISTE');
    }

    const client = getSupabaseClient();
    if (!client) {
        console.log('[LOADING-DEBUG] ❌ No hay cliente Supabase');
        return null;
    }

    console.log('[LOADING-DEBUG] Consultando sesión en Supabase Auth...');
    const { data, error } = await client.auth.getSession();
    if (error || !data?.session?.user) {
        console.log('[LOADING-DEBUG] ❌ No hay sesión Auth:', error?.message || 'sin sesion');
        return null;
    }

    console.log('[LOADING-DEBUG] ✅ Sesión Auth encontrada, user =', data.session.user.email);
    const sessionUser = data.session.user;
    const profile = await fetchUserProfile(client, sessionUser.id);
    const localUser = buildLocalUser(sessionUser, profile);

    console.log('[LOADING-DEBUG] 👤 localUser re-construido desde DB =', JSON.stringify(localUser, null, 2));
    console.log('[LOADING-DEBUG] 👉 ROLe =', localUser.role);

    sessionStorage.setItem('user', JSON.stringify(localUser));

    if (data.session.access_token) {
        sessionStorage.setItem('accessToken', data.session.access_token);
    } else {
        sessionStorage.removeItem('accessToken');
    }

    return localUser;
}

async function initializeLoadingScreen() {
    const lottiePlayback = (window.WelcomeLottie && window.WelcomeLottie.play)
        ? window.WelcomeLottie.play()
        : Promise.resolve({ played: false, durationMs: 0 });

    const [lottieResult, localUser] = await Promise.all([
        lottiePlayback,
        resolveLoggedUser(),
    ]);

    showGreetingCard();
    setGreeting(localUser);
    setAvatar(localUser);

    const targetPage = getTargetPage(localUser);

    const greetingStayMs = POST_GREETING_MIN_MS;

    window.setTimeout(() => {
        document.body.classList.add('is-exiting');
    }, greetingStayMs);

    window.setTimeout(() => {
        sessionStorage.removeItem('postLoginTarget');
        window.location.href = targetPage;
    }, greetingStayMs + 800);
}

document.addEventListener('DOMContentLoaded', () => {
    initializeLoadingScreen().catch(error => {
        console.error('Error en pantalla de carga:', error);

        window.setTimeout(() => {
            window.location.href = '/pages/login.html';
        }, 3000);
    });
});
