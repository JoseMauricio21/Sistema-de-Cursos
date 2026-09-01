// Configuración de Supabase
// Obtén estas credenciales de: https://app.supabase.com

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// CLAVE ANON (PÚBLICA) - Segura para usar en el cliente
const runtimeConfig = typeof window !== 'undefined' && window.__SUPABASE_CONFIG__ ? window.__SUPABASE_CONFIG__ : {};
const SUPABASE_URL = runtimeConfig.url || 'https://piiaoucyrlvrodzxwjeh.supabase.co';
const SUPABASE_ANON_KEY = runtimeConfig.anonKey || 'sb_publishable_DblZb-R3rmsPTZSKBeXHCw_8GM5B4qh';

// Validar que las credenciales estén configuradas
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('⚠️ Credenciales de Supabase no configuradas correctamente');
}

const supabaseOptions = typeof window !== 'undefined' && window.sessionStorage
    ? {
        auth: {
            storage: window.sessionStorage,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    }
    : {};

// Crear cliente de Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, supabaseOptions);

export { SUPABASE_URL, SUPABASE_ANON_KEY };
export default supabase;
