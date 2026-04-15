// Cliente de Supabase mejorado para manejo de sesiones
import { supabase } from './supabaseConfig.js';

// Estado de sesión global
let currentSession = null;

// Inicializar sesión
export async function initializeSession() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        currentSession = session;
        return session;
    } catch (error) {
        console.error('Error inicializando sesión:', error);
        return null;
    }
}

// Escuchar cambios de autenticación
export function listenAuthChanges(callback) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
            currentSession = session;
            callback(event, session);
        }
    );
    return subscription;
}

// Obtener sesión actual
export function getCurrentSession() {
    return currentSession;
}

// Obtener usuario actual
export async function getCurrentUserData() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    } catch (error) {
        console.error('Error obteniendo usuario:', error);
        return null;
    }
}

// Verificar si el usuario está autenticado
export function isAuthenticated() {
    return currentSession !== null;
}

// Refrescar token si es necesario
export async function refreshSession() {
    try {
        const { data: { session }, error } = await supabase.auth.refreshSession();
        if (error) throw error;
        currentSession = session;
        return session;
    } catch (error) {
        console.error('Error refrescando sesión:', error);
        return null;
    }
}

// Interceptor para rutas protegidas
export function requireAuth(callback) {
    return async (...args) => {
        if (!isAuthenticated()) {
            console.warn('Se requiere autenticación');
            window.location.href = '/pages/login.html';
            return;
        }
        return callback(...args);
    };
}

// Guard para funciones que requieren autenticación
export const withAuth = requireAuth;
