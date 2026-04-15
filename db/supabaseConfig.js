// Configuración de Supabase
// Obtén estas credenciales de: https://app.supabase.com

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// CLAVE ANON (PÚBLICA) - Segura para usar en el cliente
const SUPABASE_URL = 'https://mfhfeytlgmkxuzlclawx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_TBRrwMbabN6X0NcO5656ew_imJDTeaj';

// Validar que las credenciales estén configuradas
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('⚠️ Credenciales de Supabase no configuradas correctamente');
}

// Crear cliente de Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { SUPABASE_URL, SUPABASE_ANON_KEY };
export default supabase;
