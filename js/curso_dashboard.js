// ========================================
// CURSO DASHBOARD - MAIN SCRIPT
// ========================================

// SUPABASE CONFIGURATION
const SUPABASE_URL = 'https://mfhfeytlgmkxuzlclawx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_TBRrwMbabN6X0NcO5656ew_imJDTeaj';
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        storage: window.sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});

document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

// ========================================
// INITIALIZE DASHBOARD
// ========================================

function initializeDashboard() {
    // Get user data from sessionStorage
    const userJson = sessionStorage.getItem('user');
    if (!userJson) {
        window.location.href = '/pages/login.html';
        return;
    }

    let user = {};
    try {
        user = JSON.parse(userJson);
    } catch (error) {
        console.warn('Sesión de usuario inválida:', error.message);
    }

    if (!user.id) {
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('accessToken');
        window.location.href = '/pages/login.html';
        return;
    }

    if (user.role === 'admin') {
        window.location.href = '/pages/admin_dashboard.html';
        return;
    }

    if (user.name) {
        const welcomeUsername = document.getElementById('welcomeUsername');
        if (welcomeUsername) {
            welcomeUsername.textContent = user.name;
        }
    }

    // Initialize sidebar toggle
    initializeSidebarToggle();

    // Initialize navigation
    initializeNavigation();

    // Initialize logout
    initializeLogout();

    // Initialize FAB
    initializeFAB();

    // Set first section as active
    setActiveSection('inicio');
}

// ========================================
// SIDEBAR TOGGLE (Removed - Now using horizontal nav)
// ========================================

function initializeSidebarToggle() {
    // Sidebar functionality moved to horizontal header navigation
    // This function is kept for compatibility but does nothing
}

// ========================================
// NAVIGATION
// ========================================

function initializeNavigation() {
    const radioInputs = document.querySelectorAll('.radio-inputs input[name="nav-radio"]');

    radioInputs.forEach(input => {
        input.addEventListener('change', function() {
            const section = this.value;
            setActiveSection(section);
        });
    });
}

function setActiveSection(section) {
    // Remove active class from all radio inputs
    document.querySelectorAll('.radio-inputs input[name="nav-radio"]').forEach(input => {
        input.checked = false;
    });

    // Set the selected radio as checked
    const selectedRadio = document.querySelector(`input[value="${section}"]`);
    if (selectedRadio) {
        selectedRadio.checked = true;
    }

    // Load content from HTML file (async but don't wait for it)
    loadSectionContent(section).catch(error => {
        console.error('Error in setActiveSection:', error);
    });

    // Update page title
    updatePageTitle(section);

    // Save current section preference
    localStorage.setItem('lastSection', section);
}

// Load content from separate HTML files
async function loadSectionContent(section) {
    const contentWrapper = document.getElementById('contentWrapper');
    const fabButton = document.querySelector('.fab-add-course');
    const fileNames = {
        'inicio': './inicio.html',
        'mis-cursos': './mis-cursos.html',
        'examenes': './examenes.html',
        'mis-calificaciones': './mis-calificaciones.html',
        'en-vivo': './en-vivo.html'
    };

    const fileName = fileNames[section];
    if (!fileName) return;

    try {
        const response = await fetch(fileName);
        const html = await response.text();
        
        contentWrapper.innerHTML = html;
        
        // Show FAB only in mis-cursos section
        if (fabButton) {
            if (section === 'mis-cursos') {
                fabButton.classList.add('visible');
            } else {
                fabButton.classList.remove('visible');
            }
        }
        
        // Update user data if loading inicio section
        if (section === 'inicio') {
            await loadProfileFromSupabase();
            
            // Setup profile link button
            const profileLinkBtn = document.getElementById('profileLinkBtn');
            if (profileLinkBtn) {
                profileLinkBtn.addEventListener('click', () => {
                    window.location.href = './perfil.html';
                });
            }
        }

        if (section === 'mis-cursos') {
            await loadAssignedCourses();
        }

        if (section === 'examenes') {
            await loadAssignedExams();
        }

        if (section === 'en-vivo') {
            await loadAssignedLives();
        }
    } catch (error) {
        console.error('Error loading section:', error);
        contentWrapper.innerHTML = '<p>Error al cargar el contenido</p>';
    }
}

function updatePageTitle(section) {
    const titles = {
        'inicio': 'Inicio',
        'mis-cursos': 'Mis Cursos',
        'examenes': 'Exámenes',
        'mis-calificaciones': 'Mis Calificaciones',
        'en-vivo': 'En Vivo'
    };

    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        pageTitle.textContent = titles[section] || 'Cursos';
    }
}

// ========================================
// LOAD PROFILE FROM SUPABASE
// ========================================

async function loadProfileFromSupabase() {
    try {
        const user = JSON.parse(sessionStorage.getItem('user') || '{}');
        if (!user.id) {
            console.log('⚠️ No user ID found');
            return;
        }

        console.log('📥 Loading profile from Supabase...');

        // Fetch profile from Supabase
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) {
            console.log('⚠️ Profile not found:', error.message);
            return;
        }

        console.log('✅ Profile loaded from Supabase:', profile);

        // Update welcome username
        const welcomeUsername = document.getElementById('welcomeUsername');
        if (welcomeUsername && profile.full_name) {
            welcomeUsername.textContent = profile.full_name;
        }

        // Update profile picture
        const profilePic = document.getElementById('welcomeProfilePic');
        if (profilePic && profile.avatar_url) {
            profilePic.src = profile.avatar_url;
            console.log('✅ Profile photo loaded:', profile.avatar_url);
        }

    } catch (error) {
        console.error('❌ Error loading profile from Supabase:', error);
    }
}

function getCurrentSessionUser() {
    try {
        return JSON.parse(sessionStorage.getItem('user') || '{}');
    } catch (error) {
        return {};
    }
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function extractYouTubeVideoId(rawUrl) {
    if (!rawUrl) {
        return '';
    }

    try {
        const parsed = new URL(rawUrl);
        const hostname = parsed.hostname.replace(/^www\./i, '').toLowerCase();

        if (hostname === 'youtu.be') {
            return (parsed.pathname.split('/').filter(Boolean)[0] || '').trim();
        }

        if (hostname === 'youtube.com' || hostname === 'm.youtube.com' || hostname.endsWith('.youtube.com')) {
            const searchId = parsed.searchParams.get('v');
            if (searchId) {
                return searchId.trim();
            }

            const pathParts = parsed.pathname.split('/').filter(Boolean);
            const markerIndex = pathParts.findIndex((part) => ['embed', 'shorts', 'live', 'v'].includes(part.toLowerCase()));
            if (markerIndex >= 0 && pathParts[markerIndex + 1]) {
                return pathParts[markerIndex + 1].trim();
            }
        }
    } catch (error) {
        // Ignore parse errors and use regex fallback.
    }

    const match = String(rawUrl).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([A-Za-z0-9_-]{6,})/i);
    return match ? match[1] : '';
}

function buildYouTubeThumbnailUrl(rawUrl) {
    const videoId = extractYouTubeVideoId(rawUrl);
    if (!videoId) {
        return '';
    }

    return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}

function renderStudentEmpty(target, iconClass, title, subtitle) {
    if (!target) {
        return;
    }

    target.innerHTML = `
        <div class="empty-state">
            <i class="fas ${iconClass}"></i>
            <p>${escapeHtml(title)}</p>
            <p class="small-text">${escapeHtml(subtitle)}</p>
        </div>
    `;
}

async function loadAssignedCourses() {
    const container = document.getElementById('studentCoursesGrid') || document.querySelector('.courses-grid');
    if (!container) {
        return;
    }

    const user = getCurrentSessionUser();
    if (!user.id) {
        renderStudentEmpty(container, 'fa-user-lock', 'No tienes sesion activa', 'Inicia sesion para ver tus cursos.');
        return;
    }

    const { data: assignments, error: assignmentError } = await supabaseClient
        .from('course_assignments')
        .select('course_id')
        .eq('student_id', user.id)
        .eq('is_visible', true);

    if (assignmentError) {
        renderStudentEmpty(container, 'fa-book', 'No se pudieron cargar tus cursos', assignmentError.message);
        return;
    }

    if (!assignments?.length) {
        renderStudentEmpty(container, 'fa-book', 'Aun no tienes cursos asignados', 'Tu admin puede asignarte cursos desde el panel de administracion.');
        return;
    }

    const courseIds = assignments.map((item) => item.course_id);
    const { data: courses, error: courseError } = await supabaseClient
        .from('courses')
        .select('id, title, description, cover_image_url, status')
        .in('id', courseIds)
        .order('created_at', { ascending: false });

    if (courseError) {
        renderStudentEmpty(container, 'fa-book', 'No se pudieron cargar detalles de cursos', courseError.message);
        return;
    }

    if (!courses?.length) {
        renderStudentEmpty(container, 'fa-book', 'Sin cursos visibles', 'No hay cursos publicados para tu usuario.');
        return;
    }

    container.innerHTML = courses
        .map((course) => `
            <article class="course-card">
                <div class="course-header">
                    <img class="course-image" src="${escapeHtml(course.cover_image_url || '../images/logo t.png')}" alt="Portada del curso">
                    <span class="course-badge">${escapeHtml(course.status === 'published' ? 'Disponible' : 'Borrador')}</span>
                </div>
                <div class="course-body">
                    <h3>${escapeHtml(course.title)}</h3>
                    <p class="course-description">${escapeHtml(course.description || 'Curso sin descripcion')}</p>
                </div>
                <div class="course-footer">
                    <button class="btn btn-primary">Continuar</button>
                </div>
            </article>
        `)
        .join('');
}

async function loadAssignedExams() {
    const container = document.getElementById('studentExamsList') || document.querySelector('.exams-list');
    if (!container) {
        return;
    }

    const user = getCurrentSessionUser();
    if (!user.id) {
        renderStudentEmpty(container, 'fa-file-alt', 'No tienes sesion activa', 'Inicia sesion para ver tus examenes.');
        return;
    }

    const { data: assignments, error: assignmentError } = await supabaseClient
        .from('exam_assignments')
        .select('exam_id, status, score')
        .eq('student_id', user.id)
        .order('assigned_at', { ascending: false });

    if (assignmentError) {
        renderStudentEmpty(container, 'fa-file-alt', 'No se pudieron cargar tus examenes', assignmentError.message);
        return;
    }

    if (!assignments?.length) {
        renderStudentEmpty(container, 'fa-file-alt', 'No hay examenes asignados', 'Cuando el admin te asigne examenes apareceran aqui.');
        return;
    }

    const examIds = assignments.map((item) => item.exam_id);
    const { data: exams, error: examError } = await supabaseClient
        .from('exams')
        .select('id, title, description, available_from, status')
        .in('id', examIds);

    if (examError) {
        renderStudentEmpty(container, 'fa-file-alt', 'No se pudieron cargar detalles de examenes', examError.message);
        return;
    }

    const assignmentMap = new Map(assignments.map((item) => [item.exam_id, item]));

    container.innerHTML = (exams || [])
        .sort((a, b) => new Date(b.available_from || 0) - new Date(a.available_from || 0))
        .map((exam) => {
            const assignment = assignmentMap.get(exam.id) || {};
            const examDate = exam.available_from ? new Date(exam.available_from) : null;
            const day = examDate ? String(examDate.getDate()).padStart(2, '0') : '--';
            const month = examDate
                ? examDate.toLocaleDateString('es-ES', { month: 'short' })
                : 'sin fecha';

            const isCompleted = assignment.status === 'completed';
            const buttonText = isCompleted ? 'Revisar' : 'Empezar';
            const scoreText = isCompleted && assignment.score !== null && assignment.score !== undefined
                ? `Calificacion: ${assignment.score}`
                : 'Pendiente';

            return `
                <article class="exam-card ${isCompleted ? 'completed' : ''}">
                    <div class="exam-date">
                        <span class="day">${day}</span>
                        <span class="month">${escapeHtml(month)}</span>
                    </div>
                    <div class="exam-details">
                        <h3>${escapeHtml(exam.title)}</h3>
                        <p class="exam-course">${escapeHtml(exam.description || 'Examen asignado por tu admin')}</p>
                        <p class="exam-time">Estado: ${escapeHtml(assignment.status || exam.status || 'assigned')}</p>
                        <p class="exam-score">${escapeHtml(scoreText)}</p>
                    </div>
                    <button class="btn btn-primary">${buttonText}</button>
                </article>
            `;
        })
        .join('');
}

async function loadAssignedLives() {
    const container = document.getElementById('liveClassesList') || document.querySelector('.live-classes-list');
    if (!container) {
        return;
    }

    const user = getCurrentSessionUser();
    if (!user.id) {
        renderStudentEmpty(container, 'fa-video', 'No tienes sesion activa', 'Inicia sesion para ver lives.');
        return;
    }

    const { data: assignments, error: assignmentError } = await supabaseClient
        .from('live_assignments')
        .select('live_id')
        .eq('student_id', user.id)
        .eq('is_visible', true)
        .order('assigned_at', { ascending: false });

    if (assignmentError) {
        renderStudentEmpty(container, 'fa-video', 'No se pudieron cargar lives', assignmentError.message);
        return;
    }

    if (!assignments?.length) {
        renderStudentEmpty(container, 'fa-video', 'No hay lives asignados', 'Tu admin aun no ha publicado lives para ti.');
        return;
    }

    const liveIds = assignments.map((item) => item.live_id);
    const { data: lives, error: liveError } = await supabaseClient
        .from('live_events')
        .select('id, title, description, youtube_url, starts_at, status')
        .in('id', liveIds)
        .eq('status', 'published')
        .order('starts_at', { ascending: false });

    if (liveError) {
        renderStudentEmpty(container, 'fa-video', 'No se pudieron cargar detalles de lives', liveError.message);
        return;
    }

    if (!lives?.length) {
        renderStudentEmpty(container, 'fa-video', 'No hay lives publicados', 'Tus lives asignados estan en borrador o aun no se publican.');
        return;
    }

    container.innerHTML = lives
        .map((live) => {
            const liveDate = live.starts_at ? new Date(live.starts_at) : null;
            const timeText = liveDate
                ? liveDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                : 'Sin hora';
            const dateText = liveDate
                ? liveDate.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })
                : 'Sin fecha';
            const liveUrl = String(live.youtube_url || '').trim();
            const youtubeThumb = buildYouTubeThumbnailUrl(liveUrl);
            const platformLabel = youtubeThumb ? 'YouTube' : 'Enlace online';
            const description = String(live.description || 'Live asignado por tu admin');
            const shortDescription = description.length > 130
                ? `${description.slice(0, 127)}...`
                : description;
            const actionLabel = liveUrl ? 'Unirme ahora' : 'Sin enlace';

            return `
                <article class="live-class-card live">
                    <div class="live-card-media ${youtubeThumb ? 'has-preview' : 'no-preview'}">
                        ${youtubeThumb
                            ? `<img src="${escapeHtml(youtubeThumb)}" alt="Caratula de ${escapeHtml(live.title)}" loading="lazy" referrerpolicy="no-referrer">`
                            : `
                                <div class="live-card-fallback">
                                    <i class="fas fa-video"></i>
                                    <span>Sin preview</span>
                                </div>
                            `
                        }
                        <span class="live-badge">LIVE</span>
                    </div>

                    <div class="live-card-body">
                        <div class="live-card-topline">
                            <p class="live-card-date"><i class="fas fa-calendar-alt" aria-hidden="true"></i> ${escapeHtml(dateText)} - ${escapeHtml(timeText)}</p>
                            <p class="live-card-platform">${escapeHtml(platformLabel)}</p>
                        </div>
                        <h3>${escapeHtml(live.title)}</h3>
                        <p class="class-time">${escapeHtml(shortDescription)}</p>
                        <div class="live-card-footer">
                            <button class="btn btn-primary btn-small" data-live-url="${escapeHtml(liveUrl)}" ${liveUrl ? '' : 'disabled'}>${actionLabel}</button>
                        </div>
                    </div>
                </article>
            `;
        })
        .join('');

    container.querySelectorAll('[data-live-url]').forEach((button) => {
        button.addEventListener('click', () => {
            const url = button.getAttribute('data-live-url');
            if (url) {
                window.open(url, '_blank', 'noopener');
            }
        });
    });
}

// ========================================
// LOGOUT
// ========================================

function initializeLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutModal = document.getElementById('logoutConfirmModal');
    const closeModalBtn = document.getElementById('logoutModalClose');
    const cancelBtn = document.getElementById('logoutCancelBtn');
    const confirmBtn = document.getElementById('logoutConfirmBtn');

    if (!logoutBtn || !logoutModal || !closeModalBtn || !cancelBtn || !confirmBtn) {
        return;
    }

    const openLogoutModal = () => {
        logoutModal.classList.add('visible');
    };

    const closeLogoutModal = () => {
        logoutModal.classList.remove('visible');
    };

    logoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        openLogoutModal();
    });

    closeModalBtn.addEventListener('click', closeLogoutModal);
    cancelBtn.addEventListener('click', closeLogoutModal);

    logoutModal.addEventListener('click', function(e) {
        if (e.target === logoutModal) {
            closeLogoutModal();
        }
    });

    confirmBtn.addEventListener('click', async function() {
        closeLogoutModal();
        await logout();
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && logoutModal.classList.contains('visible')) {
            closeLogoutModal();
        }
    });
}

async function logout() {
    try {
        await supabaseClient.auth.signOut();
    } catch (error) {
        console.warn('No se pudo cerrar sesión en Supabase:', error.message);
    }

    // Clear session auth data
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('videoTime');

    // Remove legacy persisted auth keys
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    localStorage.removeItem('sb-mfhfeytlgmkxuzlclawx-auth-token');

    // Keep preferences cleanup behavior
    localStorage.removeItem('sidebarCollapsed');
    localStorage.removeItem('lastSection');

    // Redirect to login page
    window.location.href = '/pages/login.html';
}

// ========================================
// FLOATING ACTION BUTTON
// ========================================

function initializeFAB() {
    const fabBtn = document.querySelector('.fab-add-course');
    const modal = document.getElementById('courseCodeModal');
    const modalClose = document.getElementById('modalClose');
    const courseCodeForm = document.getElementById('courseCodeForm');
    
    if (fabBtn) {
        fabBtn.addEventListener('click', function() {
            if (modal) {
                modal.classList.add('visible');
            }
        });
    }
    
    // Close modal when close button is clicked
    if (modalClose) {
        modalClose.addEventListener('click', function() {
            if (modal) {
                modal.classList.remove('visible');
            }
        });
    }
    
    // Close modal when overlay is clicked
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.classList.remove('visible');
            }
        });
    }
    
    // Handle form submission
    if (courseCodeForm) {
        courseCodeForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const codeInput = document.getElementById('courseCode');
            const code = codeInput.value.trim();
            
            if (code) {
                console.log('Código de curso ingresado:', code);
                alert('Te has unido al curso con código: ' + code);
                codeInput.value = '';
                modal.classList.remove('visible');
            }
        });
    }
}

// ========================================
// RESTORE LAST SECTION ON PAGE LOAD
// ========================================

window.addEventListener('load', function() {
    const lastSection = localStorage.getItem('lastSection') || 'inicio';
    setActiveSection(lastSection);
});

// ========================================
// ADDITIONAL FEATURES
// ========================================

// Add event listeners for buttons in courses
document.addEventListener('click', function(e) {
    const clickedButton = e.target.closest('.btn');
    if (!clickedButton) {
        return;
    }

    if (clickedButton.hasAttribute('data-live-url')) {
        return;
    }

    if (clickedButton.classList.contains('btn')) {
        // Handle button click based on button type
        const buttonText = clickedButton.textContent.trim();

        if (buttonText === 'Continuar' || buttonText === 'Empezar') {
            // Redirect to course
            console.log('Abriendo curso...');
            // window.location.href = '/pages/course.html';
        } else if (buttonText === 'Revisar') {
            console.log('Revisando curso...');
        } else if (buttonText === 'Prepararse') {
            console.log('Preparándose para examen...');
        } else if (buttonText === 'Ver detalles') {
            console.log('Viendo detalles del examen...');
        } else if (buttonText === 'Unirme ahora') {
            console.log('Uniéndose a la clase...');
            // Simulate joining live class
            alert('¡Te has unido a la clase en vivo!');
        } else if (buttonText === 'Recordar') {
            console.log('Clase agregada a recordatorios');
            alert('¡Se ha agregado a tus recordatorios!');
        }
    }
});

// ========================================
// CHECK AUTHENTICATION
// ========================================

function checkAuthentication() {
    const token = sessionStorage.getItem('accessToken');
    if (!token) {
        // Redirect to login if not authenticated
        window.location.href = '/pages/login.html';
    }
}

// Check authentication on page load
checkAuthentication();

// ========================================
// RESPONSIVE SIDEBAR BEHAVIOR
// ========================================

// Close sidebar on mobile when navigating to a section
window.addEventListener('load', function() {
    const navItems = document.querySelectorAll('.nav-item:not(.logout-btn)');
    const sidebar = document.getElementById('sidebar');

    navItems.forEach(item => {
        item.addEventListener('click', function() {
            // Close sidebar on mobile when a section is clicked
            if (window.innerWidth <= 768) {
                sidebar.classList.add('collapsed');
            }
        });
    });
});

// ========================================
// ACCESSIBILITY ENHANCEMENTS
// ========================================

// Keyboard navigation
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + K to toggle sidebar
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('sidebarToggle').click();
    }

    // Alt + arrow keys to navigate sections
    if (e.altKey) {
        const navItems = document.querySelectorAll('.nav-item:not(.logout-btn)');
        const activeNav = document.querySelector('.nav-item.active');
        let currentIndex = Array.from(navItems).indexOf(activeNav);

        if (e.key === 'ArrowDown' && currentIndex < navItems.length - 1) {
            e.preventDefault();
            navItems[currentIndex + 1].click();
        } else if (e.key === 'ArrowUp' && currentIndex > 0) {
            e.preventDefault();
            navItems[currentIndex - 1].click();
        }
    }
});

// Add focus visible styles for keyboard navigation
const style = document.createElement('style');
style.textContent = `
    .nav-item:focus-visible {
        outline: 2px solid white;
        outline-offset: 2px;
    }

    .btn:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
    }
`;
document.head.appendChild(style);

// ========================================
// THEME SUPPORT
// ========================================

// Check for dark mode preference
function initializeTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme === 'dark' || (!savedTheme && prefersDark.matches)) {
        document.documentElement.style.filter = 'invert(1) hue-rotate(180deg)';
    }
}

// Call theme initialization
// initializeTheme(); // Uncomment if dark mode is needed
