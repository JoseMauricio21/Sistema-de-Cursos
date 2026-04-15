// ========================================
// PROFILE PAGE - SUPABASE CONFIGURATION
// ========================================

const SUPABASE_URL = 'https://mfhfeytlgmkxuzlclawx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_TBRrwMbabN6X0NcO5656ew_imJDTeaj';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

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
    
    // Get user from localStorage
    const userJson = localStorage.getItem('user');
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

        // Create FormData for upload
        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', currentUser.id);

        console.log('📤 Uploading photo...');
        
        // Send to server to handle upload
        const response = await fetch('/api/upload-profile-photo', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Upload failed');
        }

        const result = await response.json();
        console.log('✅ Photo uploaded:', result.photoUrl);

        // Update the image and input
        profileImage.src = result.photoUrl;
        avatarUrlInput.value = result.photoUrl;

        hideLoading();
        showSuccess('Foto actualizada correctamente');
        
        // Hide success message after 2 seconds
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 2000);
    } catch (error) {
        console.error('❌ Error uploading photo:', error);
        hideLoading();
        showError('Error al subir la foto');
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

        console.log('📝 Updating profile via server...');

        // Call server endpoint to update profile
        const response = await fetch('/api/update-profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.id,
                fullName: fullName,
                avatarUrl: avatarUrl
            })
        });

        if (!response.ok) {
            throw new Error('Update failed');
        }

        const result = await response.json();
        console.log('✅ Profile updated:', result);

        // Update currentProfile
        currentProfile = result.profile;

        hideLoading();
        showSuccess('Perfil actualizado correctamente');

        // Redirect back to dashboard after 1.5 seconds
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
