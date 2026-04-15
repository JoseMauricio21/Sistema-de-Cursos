// ========================================
// CURSO DASHBOARD - MAIN SCRIPT
// ========================================

// SUPABASE CONFIGURATION
const SUPABASE_URL = 'https://mfhfeytlgmkxuzlclawx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_TBRrwMbabN6X0NcO5656ew_imJDTeaj';
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

// ========================================
// INITIALIZE DASHBOARD
// ========================================

function initializeDashboard() {
    // Get user data from localStorage
    const user = JSON.parse(localStorage.getItem('user') || '{}');
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
        const user = JSON.parse(localStorage.getItem('user') || '{}');
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

// ========================================
// LOGOUT
// ========================================

function initializeLogout() {
    const logoutBtn = document.getElementById('logoutBtn');

    logoutBtn.addEventListener('click', function(e) {
        e.preventDefault();

        // Confirm logout
        if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
            logout();
        }
    });
}

function logout() {
    // Clear localStorage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    localStorage.removeItem('videoTime');
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
    if (e.target.classList.contains('btn')) {
        // Handle button click based on button type
        const buttonText = e.target.textContent.trim();

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
    const token = localStorage.getItem('accessToken');
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
