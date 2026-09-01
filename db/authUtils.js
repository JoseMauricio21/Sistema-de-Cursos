// Utilidades de Autenticación con Supabase
import { supabase } from './supabaseConfig.js';

// Registrar nuevo usuario
export async function signUp(email, password, fullName) {
    try {
        // Crear usuario en Supabase Auth
        // El trigger de la BD creará automáticamente el perfil
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                }
            }
        });

        if (error) throw error;

        return { success: true, user: data.user, message: 'Usuario registrado exitosamente. Por favor, verifica tu email.' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Iniciar sesión
export async function signIn(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;

        return { success: true, user: data.user, session: data.session };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Cerrar sesión
export async function signOut() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Obtener usuario actual
export async function getCurrentUser() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    } catch (error) {
        console.error('Error obteniendo usuario:', error);
        return null;
    }
}

// Obtener perfil del usuario
export async function getUserProfile(userId) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error obteniendo perfil:', error);
        return null;
    }
}

// Actualizar perfil del usuario
export async function updateUserProfile(userId, updates) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Obtener todos los usuarios (solo para administrador)
export async function getAllUsers() {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*');

        if (error) throw error;
        return { success: true, users: data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Eliminar usuario
export async function deleteUser(userId) {
    try {
        // Eliminar de la tabla profiles
        const { error: profileError } = await supabase
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (profileError) throw profileError;

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Escuchar cambios en la autenticación
export function onAuthStateChange(callback) {
    const { data: authListener } = supabase.auth.onAuthStateChange(
        (event, session) => {
            callback(event, session);
        }
    );

    return authListener;
}
