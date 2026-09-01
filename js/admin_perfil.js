const SUPABASE_URL = 'https://piiaoucyrlvrodzxwjeh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DblZb-R3rmsPTZSKBeXHCw_8GM5B4qh';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        storage: window.sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});

const elements = {
    form: document.getElementById('adminProfileForm'),
    backBtn: document.getElementById('adminProfileBackBtn'),
    cancelBtn: document.getElementById('adminProfileCancelBtn'),
    saveBtn: document.getElementById('adminProfileSaveBtn'),
    message: document.getElementById('adminProfileMessage'),
    nameInput: document.getElementById('adminProfileName'),
    emailInput: document.getElementById('adminProfileEmail'),
    passwordInput: document.getElementById('adminProfilePassword'),
    passwordConfirmInput: document.getElementById('adminProfilePasswordConfirm'),
    avatarUrlInput: document.getElementById('adminProfileAvatarUrl'),
    avatarWrap: document.getElementById('adminProfileAvatar'),
    avatarImage: document.getElementById('adminProfileAvatarImage'),
    uploadBtn: document.getElementById('adminProfileUploadBtn'),
    photoInput: document.getElementById('adminProfilePhotoInput'),
};

const state = {
    admin: null,
};

document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    initAdminProfilePage();
});

function bindEvents() {
    if (elements.backBtn) {
        elements.backBtn.addEventListener('click', () => {
            window.location.href = './admin_dashboard.html';
        });
    }

    if (elements.cancelBtn) {
        elements.cancelBtn.addEventListener('click', () => {
            window.location.href = './admin_dashboard.html';
        });
    }

    if (elements.form) {
        elements.form.addEventListener('submit', saveAdminProfile);
    }

    if (elements.nameInput) {
        elements.nameInput.addEventListener('input', () => {
            updateAvatarPreview(elements.avatarUrlInput?.value || '', elements.nameInput.value);
        });
    }

    if (elements.avatarUrlInput) {
        elements.avatarUrlInput.addEventListener('input', () => {
            updateAvatarPreview(elements.avatarUrlInput.value, elements.nameInput?.value || '');
        });
    }

    if (elements.uploadBtn && elements.photoInput) {
        elements.uploadBtn.addEventListener('click', () => {
            elements.photoInput.click();
        });
        elements.photoInput.addEventListener('change', handleAdminPhotoChange);
    }
}

async function initAdminProfilePage() {
    const rawUser = sessionStorage.getItem('user');
    if (!rawUser) {
        window.location.href = '/pages/login.html';
        return;
    }

    let sessionUser;
    try {
        sessionUser = JSON.parse(rawUser);
    } catch (error) {
        window.location.href = '/pages/login.html';
        return;
    }

    if (!sessionUser.id) {
        window.location.href = '/pages/login.html';
        return;
    }

    const profile = await fetchAdminProfile(sessionUser);
    if (!profile) {
        return;
    }

    state.admin = {
        id: profile.id,
        role: profile.role || 'admin',
        name: profile.full_name || 'Admin',
        email: profile.email || sessionUser.email || '',
        avatar_url: profile.avatar_url || null,
    };

    renderProfileState();
}

async function fetchAdminProfile(sessionUser) {
    let data;
    let error;

    ({ data, error } = await supabaseClient
        .from('profiles')
        .select('id, email, full_name, avatar_url, role')
        .eq('id', sessionUser.id)
        .maybeSingle());

    if (error && (error.message || '').toLowerCase().includes('role')) {
        ({ data, error } = await supabaseClient
            .from('profiles')
            .select('id, email, full_name, avatar_url')
            .eq('id', sessionUser.id)
            .maybeSingle());

        if (data) {
            data.role = sessionUser.role || 'admin';
        }
    }

    if (error) {
        showMessage('No se pudo cargar el perfil: ' + error.message, 'error');
        return null;
    }

    if (!data) {
        showMessage('No se encontro informacion del perfil.', 'error');
        return null;
    }

    const role = data.role || sessionUser.role || 'student';
    if (role !== 'admin') {
        showMessage('Acceso denegado para perfil admin.', 'error');
        window.setTimeout(() => {
            window.location.href = './curso_dashboard.html';
        }, 800);
        return null;
    }

    return data;
}

function renderProfileState() {
    if (!state.admin) {
        return;
    }

    if (elements.nameInput) {
        elements.nameInput.value = state.admin.name;
    }

    if (elements.emailInput) {
        elements.emailInput.value = state.admin.email;
    }

    if (elements.avatarUrlInput) {
        elements.avatarUrlInput.value = state.admin.avatar_url || '';
    }

    if (elements.passwordInput) {
        elements.passwordInput.value = '';
    }

    if (elements.passwordConfirmInput) {
        elements.passwordConfirmInput.value = '';
    }

    updateAvatarPreview(state.admin.avatar_url, state.admin.name);
    showMessage('Perfil cargado. Puedes editar y guardar.', 'info');
}

function updateAvatarPreview(avatarUrl, displayName) {
    const safeName = String(displayName || 'Admin').trim();
    const initial = safeName ? safeName.charAt(0).toUpperCase() : 'A';

    if (elements.avatarWrap) {
        elements.avatarWrap.setAttribute('data-initial', initial);
    }

    if (!elements.avatarImage) {
        return;
    }

    const url = String(avatarUrl || '').trim();
    if (!url) {
        elements.avatarImage.removeAttribute('src');
        elements.avatarImage.style.display = 'none';
        return;
    }

    elements.avatarImage.src = url;
    elements.avatarImage.style.display = 'block';
    elements.avatarImage.onerror = () => {
        elements.avatarImage.removeAttribute('src');
        elements.avatarImage.style.display = 'none';
    };
}

function setSavingState(isSaving) {
    if (!elements.saveBtn || !elements.form) {
        return;
    }

    elements.saveBtn.disabled = isSaving;
    elements.saveBtn.textContent = isSaving ? 'Guardando...' : 'Guardar cambios';
    Array.from(elements.form.elements).forEach((field) => {
        if (field instanceof HTMLElement && field !== elements.saveBtn) {
            field.toggleAttribute('disabled', isSaving);
        }
    });
}

async function saveAdminProfile(event) {
    event.preventDefault();

    if (!state.admin) {
        showMessage('No se pudo validar el admin actual.', 'error');
        return;
    }

    const fullName = String(elements.nameInput?.value || '').trim();
    const email = String(elements.emailInput?.value || '').trim().toLowerCase();
    const password = String(elements.passwordInput?.value || '').trim();
    const passwordConfirm = String(elements.passwordConfirmInput?.value || '').trim();
    const avatarUrl = String(elements.avatarUrlInput?.value || '').trim();

    if (!fullName) {
        showMessage('El nombre es obligatorio.', 'error');
        return;
    }

    if (!email) {
        showMessage('El correo es obligatorio.', 'error');
        return;
    }

    if (password && password.length < 6) {
        showMessage('La contrasena debe tener al menos 6 caracteres.', 'error');
        return;
    }

    if (password !== passwordConfirm) {
        showMessage('La confirmacion de contrasena no coincide.', 'error');
        return;
    }

    setSavingState(true);

    try {
        const emailChanged = email !== String(state.admin.email || '').toLowerCase();
        const authPayload = {};

        if (emailChanged) {
            authPayload.email = email;
        }

        if (password) {
            authPayload.password = password;
        }

        if (Object.keys(authPayload).length) {
            const { error: authError } = await supabaseClient.auth.updateUser(authPayload);
            if (authError) {
                throw new Error(authError.message);
            }
        }

        const profilePayload = {
            full_name: fullName,
            email,
            avatar_url: avatarUrl || null,
        };

        const { error: profileError } = await supabaseClient
            .from('profiles')
            .update(profilePayload)
            .eq('id', state.admin.id);

        if (profileError) {
            throw new Error(profileError.message);
        }

        state.admin.name = fullName;
        state.admin.email = email;
        state.admin.avatar_url = avatarUrl || null;

        const savedUser = JSON.parse(sessionStorage.getItem('user') || '{}');
        savedUser.id = state.admin.id;
        savedUser.role = 'admin';
        savedUser.name = fullName;
        savedUser.full_name = fullName;
        savedUser.email = email;
        savedUser.avatar_url = avatarUrl || null;
        sessionStorage.setItem('user', JSON.stringify(savedUser));

        if (elements.passwordInput) {
            elements.passwordInput.value = '';
        }

        if (elements.passwordConfirmInput) {
            elements.passwordConfirmInput.value = '';
        }

        updateAvatarPreview(state.admin.avatar_url, state.admin.name);

        const successMessage = emailChanged
            ? 'Perfil actualizado. Si cambiaste el correo revisa tu bandeja para confirmar.'
            : 'Perfil actualizado correctamente.';

        showMessage(successMessage, 'success');
    } catch (error) {
        showMessage('No se pudo guardar: ' + (error.message || 'Error desconocido'), 'error');
    } finally {
        setSavingState(false);
    }
}

async function handleAdminPhotoChange(e) {
    const file = e.target.files[0];
    if (!file || !state.admin) return;

    try {
        showMessage('Subiendo foto al almacenamiento...', 'info');

        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            throw new Error('Tipo de archivo no permitido. Usa PNG, JPG, WEBP o GIF.');
        }
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('Archivo muy grande. Máximo 5 MB.');
        }

        const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError || !sessionData.session) {
            throw new Error('Sesión no válida. Cierra sesión y vuelve a entrar.');
        }

        const userId = state.admin.id;
        const ext = file.name.split('.').pop() || 'png';
        const safeFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const bucketPath = `${userId}/${safeFileName}`;

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

        const { data: publicUrlData } = supabaseClient.storage
            .from('avatars')
            .getPublicUrl(bucketPath);
        const photoUrl = publicUrlData.publicUrl;

        if (elements.avatarUrlInput) elements.avatarUrlInput.value = photoUrl;
        updateAvatarPreview(photoUrl, state.admin.name);
        showMessage('Foto subida correctamente. Recuerda darle a Guardar cambios.', 'success');
    } catch (error) {
        console.error('❌ Error uploading admin photo:', error);
        showMessage('Error al subir la foto: ' + (error.message || 'Error desconocido'), 'error');
    } finally {
        if (elements.photoInput) elements.photoInput.value = '';
    }
}

function showMessage(message, type) {
    if (!elements.message) {
        return;
    }

    elements.message.className = 'profile-message ' + type;
    elements.message.textContent = message;
}
