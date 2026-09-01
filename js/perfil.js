// ========================================
// PROFILE PAGE - SUPABASE CONFIGURATION
// ========================================

const runtimeConfig = typeof window !== 'undefined' && window.__SUPABASE_CONFIG__ ? window.__SUPABASE_CONFIG__ : {};
const SUPABASE_URL = runtimeConfig.url || 'https://piiaoucyrlvrodzxwjeh.supabase.co';
const SUPABASE_KEY = runtimeConfig.anonKey || 'sb_publishable_DblZb-R3rmsPTZSKBeXHCw_8GM5B4qh';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        storage: window.sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});

// ========================================
// DOM ELEMENTS
// ========================================

const backBtn = document.getElementById('backBtn');
const profileForm = document.getElementById('profileForm');
const fullNameInput = document.getElementById('fullName');
const emailInput = document.getElementById('email');
const avatarUrlInput = document.getElementById('avatarUrl');
const profileImage = document.getElementById('profileImage');
const uploadBtn = document.getElementById('uploadBtn');
const photoInput = document.getElementById('photoInput');
const loadingMessage = document.getElementById('loadingMessage');
const successMessage = document.getElementById('successMessage');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');

// ========================================
// STATE
// ========================================

let currentUser = null;
let currentProfile = null;

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('📄 Profile page loaded');
    
    // Get user from sessionStorage
    const userJson = sessionStorage.getItem('user');
    if (!userJson) {
        console.log('❌ No user found, redirecting to login');
        window.location.href = '/pages/login.html';
        return;
    }

    currentUser = JSON.parse(userJson);
    console.log('✅ User found:', currentUser.email);

    // Load user profile from Supabase
    await loadProfile();
    
    // Setup event listeners
    setupEventListeners();
});

// ========================================
// LOAD PROFILE FROM SUPABASE
// ========================================

async function loadProfile() {
    try {
        console.log('📥 Loading profile from Supabase...');
        
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error) {
            console.log('⚠️ Profile not found, using defaults');
            currentProfile = {
                id: currentUser.id,
                email: currentUser.email,
                full_name: currentUser.name || '',
                avatar_url: null
            };
        } else {
            console.log('✅ Profile loaded:', profile);
            currentProfile = profile;
        }

        // Populate form
        populateForm();
    } catch (error) {
        console.error('❌ Error loading profile:', error);
        showError('Error al cargar el perfil');
    }
}

// ========================================
// POPULATE FORM
// ========================================

function populateForm() {
    fullNameInput.value = currentProfile.full_name || '';
    emailInput.value = currentProfile.email || '';
    avatarUrlInput.value = currentProfile.avatar_url || '';
    
    // Update profile image
    if (currentProfile.avatar_url) {
        profileImage.src = currentProfile.avatar_url;
    }
}

// ========================================
// SETUP EVENT LISTENERS
// ========================================

function setupEventListeners() {
    // Back button
    backBtn.addEventListener('click', () => {
        window.history.back();
    });

    // Form submission
    profileForm.addEventListener('submit', handleFormSubmit);

    // Upload button
    uploadBtn.addEventListener('click', () => {
        photoInput.click();
    });

    // Photo input change
    photoInput.addEventListener('change', handlePhotoChange);

    // Avatar URL change
    avatarUrlInput.addEventListener('change', () => {
        if (avatarUrlInput.value) {
            profileImage.src = avatarUrlInput.value;
        }
    });
}

// ========================================
// HANDLE PHOTO CHANGE
// ========================================

async function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        showLoading();
        console.log('📤 Uploading photo directly to Supabase Storage...');

        // Validar tipo y tamaño (max 5MB)
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            throw new Error('Tipo de archivo no permitido. Usa PNG, JPG, WEBP o GIF.');
        }
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('Archivo muy grande. Máximo 5 MB.');
        }

        // 1) Obtener sesión actual de Supabase (importante para RLS de storage)
        const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError || !sessionData.session) {
            throw new Error('Sesión no válida. Cierra sesión y vuelve a entrar.');
        }
        const userId = currentUser.id;

        // 2) Generar path: {userId}/{timestamp}-{ext}
        const ext = file.name.split('.').pop() || 'png';
        const safeFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const bucketPath = `${userId}/${safeFileName}`;

        // 3) Borrar el avatar anterior si ya existía (misma carpeta de usuario)
        try {
            const { data: listData } = await supabaseClient.storage
                .from('avatars')
                .list(userId, { limit: 100 });
            if (listData && listData.length > 0) {
                const toDelete = listData.map(f => `${userId}/${f.name}`);
                await supabaseClient.storage.from('avatars').remove(toDelete);
            }
        } catch (cleanErr) {
            console.warn('⚠ No se pudo limpiar avatar previo (continuando):', cleanErr.message);
        }

        // 4) Subir a bucket "avatars" (RLS permite a auth.uid() escribir en carpeta con su propio id)
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('avatars')
            .upload(bucketPath, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type,
            });

        if (uploadError) {
            console.error('❌ Storage upload error:', uploadError);
            throw new Error(uploadError.message || 'Fallo la subida al almacenamiento');
        }

        // 5) Construir URL pública (bucket es público)
        const { data: publicUrlData } = supabaseClient.storage
            .from('avatars')
            .getPublicUrl(bucketPath);
        const photoUrl = publicUrlData.publicUrl;

        console.log('✅ Photo uploaded successfully:', photoUrl);

        // 6) Actualizar la imagen y el input
        profileImage.src = photoUrl;
        avatarUrlInput.value = photoUrl;

        hideLoading();
        showSuccess('Foto actualizada correctamente');
        setTimeout(() => { successMessage.style.display = 'none'; }, 2000);
    } catch (error) {
        console.error('❌ Error uploading photo:', error);
        hideLoading();
        showError(error.message || 'Error al subir la foto');
    }
}

// ========================================
// HANDLE FORM SUBMISSION
// ========================================

async function handleFormSubmit(e) {
    e.preventDefault();

    try {
        showLoading();

        const fullName = fullNameInput.value.trim();
        const avatarUrl = avatarUrlInput.value.trim();

        if (!fullName) {
            throw new Error('El nombre completo es requerido');
        }

        console.log('📝 Updating profile via Supabase client...');

        // Actualizar directamente en Supabase (RLS permite al usuario actualizar su propia fila)
        const { data: updatedRows, error: profileError } = await supabaseClient
            .from('profiles')
            .update({
                full_name: fullName,
                avatar_url: avatarUrl || null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', currentUser.id)
            .select();

        if (profileError) {
            console.error('❌ Update profile error:', profileError);
            throw new Error(profileError.message || 'No se pudo actualizar el perfil');
        }

        const updatedProfile = Array.isArray(updatedRows) && updatedRows[0] ? updatedRows[0] : {
            id: currentUser.id,
            full_name: fullName,
            avatar_url: avatarUrl || null,
        };
        console.log('✅ Profile updated:', updatedProfile);

        currentProfile = updatedProfile;

        // Keep in-memory user info aligned for this browser session.
        const currentSessionUser = JSON.parse(sessionStorage.getItem('user') || '{}');
        currentSessionUser.name = updatedProfile.full_name || currentSessionUser.name;
        currentSessionUser.full_name = updatedProfile.full_name || currentSessionUser.full_name || currentSessionUser.name;
        currentSessionUser.avatar_url = updatedProfile.avatar_url || currentSessionUser.avatar_url || null;
        sessionStorage.setItem('user', JSON.stringify(currentSessionUser));

        hideLoading();
        showSuccess('Perfil actualizado correctamente');

        setTimeout(() => {
            window.location.href = './curso_dashboard.html';
        }, 1500);
    } catch (error) {
        console.error('❌ Error updating profile:', error);
        hideLoading();
        showError(error.message || 'Error al actualizar el perfil');
    }
}

// ========================================
// UI HELPERS
// ========================================

function showLoading() {
    loadingMessage.style.display = 'flex';
    successMessage.style.display = 'none';
    errorMessage.style.display = 'none';
    profileForm.style.opacity = '0.5';
    profileForm.style.pointerEvents = 'none';
}

function hideLoading() {
    loadingMessage.style.display = 'none';
    profileForm.style.opacity = '1';
    profileForm.style.pointerEvents = 'auto';
}

function showSuccess(message) {
    const span = successMessage.querySelector('span');
    span.textContent = '✓ ' + message;
    successMessage.style.display = 'flex';
    errorMessage.style.display = 'none';
}

function showError(message) {
    const span = errorMessage.querySelector('span');
    span.textContent = message;
    errorMessage.style.display = 'flex';
    successMessage.style.display = 'none';
}

console.log('✅ Profile JS loaded');
