const SUPABASE_URL = 'https://mfhfeytlgmkxuzlclawx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_TBRrwMbabN6X0NcO5656ew_imJDTeaj';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        storage: window.sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});

const SECTION_TITLES = {
    coursesSection: 'Cursos',
    createCourseSection: 'Crear curso',
    studentsSection: 'Alumnos',
    liveSection: 'Hacer live',
    examsSection: 'Examenes',
    groupsSection: 'Mis grupos',
    createGroupSection: 'Crear grupo',
};

const state = {
    currentAdmin: null,
    students: [],
    courses: [],
    groups: [],
    lessonBlocksBuffer: [],
    lessonQuestionsBuffer: [],
    lessonDrafts: [],
    examQuestionsBuffer: [],
};

document.addEventListener('DOMContentLoaded', async () => {
    bindNavigation();
    bindCourseBuilderEvents();
    bindStudentsEvents();
    bindLiveEvents();
    bindExamEvents();
    bindGroupEvents();
    bindLogoutEvents();

    const hasAccess = await ensureAdminAccess();
    if (!hasAccess) {
        return;
    }

    await loadInitialData();
    switchSection('coursesSection');
});

function bindNavigation() {
    document.querySelectorAll('#adminNav button').forEach((button) => {
        button.addEventListener('click', () => {
            switchSection(button.dataset.section);
        });
    });
}

function switchSection(sectionId) {
    document.querySelectorAll('#adminNav button').forEach((button) => {
        button.classList.toggle('active', button.dataset.section === sectionId);
    });

    document.querySelectorAll('.section-card').forEach((section) => {
        section.classList.toggle('active', section.id === sectionId);
    });

    const title = SECTION_TITLES[sectionId] || 'Admin';
    const titleEl = document.getElementById('sectionTitle');
    if (titleEl) {
        titleEl.textContent = title;
    }
}

async function ensureAdminAccess() {
    const rawSessionUser = sessionStorage.getItem('user');
    if (!rawSessionUser) {
        window.location.href = '/pages/login.html';
        return false;
    }

    let sessionUser;
    try {
        sessionUser = JSON.parse(rawSessionUser);
    } catch (error) {
        window.location.href = '/pages/login.html';
        return false;
    }

    if (!sessionUser.id) {
        window.location.href = '/pages/login.html';
        return false;
    }

    const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('id, email, full_name, username, role, avatar_url')
        .eq('id', sessionUser.id)
        .maybeSingle();

    let isAdmin = false;
    let resolvedProfile = {
        id: sessionUser.id,
        email: sessionUser.email || '',
        full_name: sessionUser.name || 'Admin',
        username: '',
        role: sessionUser.role || 'student',
        avatar_url: sessionUser.avatar_url || null,
    };

    if (!error && profile) {
        resolvedProfile = profile;
        isAdmin = profile.role === 'admin';
    } else if (error) {
        const message = (error.message || '').toLowerCase();
        const fallbackIdentity = `${sessionUser.email || ''} ${sessionUser.name || ''}`.toLowerCase();
        const canFallback = message.includes('role') && (fallbackIdentity.includes('tiff') || fallbackIdentity.includes('tiffany'));

        if (canFallback) {
            isAdmin = true;
            showToast('No se detecto columna role. Ejecuta el SQL nuevo para seguridad completa.', 'warning');
        }
    }

    if (!isAdmin) {
        showToast('Acceso denegado: esta vista es solo para rol admin.', 'error');
        window.location.href = '/pages/curso_dashboard.html';
        return false;
    }

    state.currentAdmin = {
        id: resolvedProfile.id,
        email: resolvedProfile.email,
        name: resolvedProfile.full_name || 'Admin',
        username: resolvedProfile.username || '',
        role: 'admin',
        avatar_url: resolvedProfile.avatar_url || null,
    };

    sessionStorage.setItem('user', JSON.stringify(state.currentAdmin));
    const userNameEl = document.getElementById('adminUserName');
    if (userNameEl) {
        userNameEl.textContent = state.currentAdmin.name;
    }

    return true;
}

async function loadInitialData() {
    await loadStudents();
    await loadCourses();
    await loadLiveEvents();
    await loadExams();
    await loadGroups();
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) {
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3800);
}

function renderEmpty(targetId, text) {
    const target = document.getElementById(targetId);
    if (!target) {
        return;
    }
    target.innerHTML = `<div class="empty-box">${escapeHtml(text)}</div>`;
}

function parseOptions(raw) {
    if (!raw) {
        return [];
    }

    return raw
        .split(/\n|,/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function normalizeYoutubeUrl(rawUrl) {
    const value = String(rawUrl || '').trim();
    if (!value) {
        return '';
    }

    if (value.includes('youtube.com') || value.includes('youtu.be')) {
        return value;
    }

    return '';
}

function getSelectedValues(selectId) {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) {
        return [];
    }

    return Array.from(selectEl.selectedOptions).map((opt) => opt.value);
}

function populateStudentSelectors() {
    const selectors = [
        'courseAssignedStudents',
        'liveTargetStudents',
        'examTargetStudents',
        'groupStudentMembers',
    ];

    selectors.forEach((id) => {
        const select = document.getElementById(id);
        if (!select) {
            return;
        }

        if (!state.students.length) {
            select.innerHTML = '<option disabled>No hay alumnos disponibles</option>';
            return;
        }

        select.innerHTML = state.students
            .map((student) => `<option value="${student.id}">${escapeHtml(student.full_name || 'Alumno')} (${escapeHtml(student.username || student.email)})</option>`)
            .join('');
    });
}

function populateCourseSelectorForGroups() {
    const select = document.getElementById('groupCourseList');
    if (!select) {
        return;
    }

    if (!state.courses.length) {
        select.innerHTML = '<option disabled>No hay cursos creados</option>';
        return;
    }

    select.innerHTML = state.courses
        .map((course) => `<option value="${course.id}">${escapeHtml(course.title)}</option>`)
        .join('');
}

// ========================================
// STUDENTS
// ========================================

async function loadStudents() {
    let data;
    let error;

    ({ data, error } = await supabaseClient
        .from('profiles')
        .select('id, email, full_name, username, avatar_url, role, created_at')
        .order('created_at', { ascending: false }));

    if (error && (error.message || '').toLowerCase().includes('role')) {
        ({ data, error } = await supabaseClient
            .from('profiles')
            .select('id, email, full_name, username, avatar_url, created_at')
            .order('created_at', { ascending: false }));

        if (!error && Array.isArray(data)) {
            data = data.map((row) => ({ ...row, role: 'student' }));
        }
    }

    if (error) {
        renderEmpty('studentsTableBody', 'No se pudieron cargar alumnos: ' + error.message);
        showToast('Error cargando alumnos: ' + error.message, 'error');
        return;
    }

    state.students = (data || []).filter((student) => {
        const role = student.role || 'student';
        return role !== 'admin' && student.id !== state.currentAdmin.id;
    });

    renderStudentsTable();
    populateStudentSelectors();
}

function renderStudentsTable() {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) {
        return;
    }

    if (!state.students.length) {
        tbody.innerHTML = '<tr><td colspan="5">No hay alumnos registrados.</td></tr>';
        return;
    }

    tbody.innerHTML = state.students
        .map((student) => `
            <tr>
                <td>${escapeHtml(student.full_name || 'Sin nombre')}</td>
                <td>${escapeHtml(student.username || '-')}</td>
                <td>${escapeHtml(student.email || '-')}</td>
                <td>${escapeHtml(student.role || 'student')}</td>
                <td>
                    <button class="btn btn-secondary" data-edit-student="${student.id}">Editar</button>
                </td>
            </tr>
        `)
        .join('');
}

function bindStudentsEvents() {
    const refreshBtn = document.getElementById('refreshStudentsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadStudents);
    }

    const tbody = document.getElementById('studentsTableBody');
    if (tbody) {
        tbody.addEventListener('click', (event) => {
            const target = event.target.closest('[data-edit-student]');
            if (!target) {
                return;
            }
            openStudentEditModal(target.getAttribute('data-edit-student'));
        });
    }

    const cancelBtn = document.getElementById('cancelStudentEditBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeStudentEditModal);
    }

    const saveBtn = document.getElementById('saveStudentEditBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveStudentChanges);
    }
}

function openStudentEditModal(studentId) {
    const student = state.students.find((item) => item.id === studentId);
    if (!student) {
        return;
    }

    document.getElementById('editStudentId').value = student.id;
    document.getElementById('editStudentName').value = student.full_name || '';
    document.getElementById('editStudentUsername').value = student.username || '';
    document.getElementById('editStudentEmail').value = student.email || '';
    document.getElementById('editStudentPassword').value = '';
    document.getElementById('editStudentAvatar').value = student.avatar_url || '';

    document.getElementById('studentEditModal').classList.add('visible');
}

function closeStudentEditModal() {
    document.getElementById('studentEditModal').classList.remove('visible');
}

async function saveStudentChanges() {
    const studentId = document.getElementById('editStudentId').value;
    if (!studentId) {
        return;
    }

    const payload = {
        p_student_id: studentId,
        p_email: document.getElementById('editStudentEmail').value.trim() || null,
        p_password: document.getElementById('editStudentPassword').value.trim() || null,
        p_full_name: document.getElementById('editStudentName').value.trim() || null,
        p_username: document.getElementById('editStudentUsername').value.trim().toLowerCase() || null,
        p_avatar_url: document.getElementById('editStudentAvatar').value.trim() || null,
    };

    let rpcWorked = false;

    const { error } = await supabaseClient.rpc('admin_update_student_profile', payload);
    if (!error) {
        rpcWorked = true;
    }

    if (!rpcWorked) {
        const fallbackUpdates = {
            full_name: payload.p_full_name,
            username: payload.p_username,
            avatar_url: payload.p_avatar_url,
            email: payload.p_email,
        };

        const { error: fallbackError } = await supabaseClient
            .from('profiles')
            .update(fallbackUpdates)
            .eq('id', studentId);

        if (fallbackError) {
            showToast('No se pudo actualizar alumno: ' + fallbackError.message, 'error');
            return;
        }

        if (payload.p_password) {
            showToast('Password no actualizado. Ejecuta el SQL para habilitar RPC admin_update_student_profile.', 'warning');
        }
    }

    closeStudentEditModal();
    await loadStudents();
    showToast('Alumno actualizado correctamente.', 'success');
}

// ========================================
// COURSES + LESSON BUILDER
// ========================================

function bindCourseBuilderEvents() {
    const refreshBtn = document.getElementById('refreshCoursesBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadCourses);
    }

    const addBlockBtn = document.getElementById('addLessonBlockBtn');
    if (addBlockBtn) {
        addBlockBtn.addEventListener('click', addLessonBlockToBuffer);
    }

    const addQuestionBtn = document.getElementById('addLessonQuestionBtn');
    if (addQuestionBtn) {
        addQuestionBtn.addEventListener('click', addLessonQuestionToBuffer);
    }

    const addLessonDraftBtn = document.getElementById('addLessonDraftBtn');
    if (addLessonDraftBtn) {
        addLessonDraftBtn.addEventListener('click', addLessonToCourseDraft);
    }

    const lessonDraftList = document.getElementById('lessonDraftList');
    if (lessonDraftList) {
        lessonDraftList.addEventListener('click', (event) => {
            const removeBtn = event.target.closest('[data-remove-lesson]');
            if (!removeBtn) {
                return;
            }

            const index = Number(removeBtn.getAttribute('data-remove-lesson'));
            state.lessonDrafts.splice(index, 1);
            renderLessonDrafts();
        });
    }

    const form = document.getElementById('createCourseForm');
    if (form) {
        form.addEventListener('submit', createCourse);
    }
}

async function loadCourses() {
    const { data, error } = await supabaseClient
        .from('courses')
        .select('id, title, description, status, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        renderEmpty('coursesList', 'No se pudo leer cursos. Ejecuta SQL primero.');
        showToast('Error cargando cursos: ' + error.message, 'error');
        return;
    }

    state.courses = data || [];

    const courseIds = state.courses.map((course) => course.id);
    const lessonCountMap = {};
    const assignmentCountMap = {};

    if (courseIds.length) {
        const { data: lessonRows } = await supabaseClient
            .from('course_lessons')
            .select('course_id')
            .in('course_id', courseIds);

        (lessonRows || []).forEach((row) => {
            lessonCountMap[row.course_id] = (lessonCountMap[row.course_id] || 0) + 1;
        });

        const { data: assignmentRows } = await supabaseClient
            .from('course_assignments')
            .select('course_id')
            .in('course_id', courseIds);

        (assignmentRows || []).forEach((row) => {
            assignmentCountMap[row.course_id] = (assignmentCountMap[row.course_id] || 0) + 1;
        });
    }

    renderCourses(lessonCountMap, assignmentCountMap);
    populateCourseSelectorForGroups();
}

function renderCourses(lessonCountMap, assignmentCountMap) {
    const target = document.getElementById('coursesList');
    if (!target) {
        return;
    }

    if (!state.courses.length) {
        target.innerHTML = '<div class="empty-box">Aun no hay cursos creados.</div>';
        return;
    }

    target.innerHTML = state.courses
        .map((course) => {
            const lessons = lessonCountMap[course.id] || 0;
            const students = assignmentCountMap[course.id] || 0;
            const statusClass = course.status === 'published' ? 'published' : 'draft';

            return `
                <article class="mini-card">
                    <div class="mini-row">
                        <h4>${escapeHtml(course.title)}</h4>
                        <span class="tag ${statusClass}">${escapeHtml(course.status)}</span>
                    </div>
                    <p class="inline-help">Lecciones: ${lessons} | Alumnos asignados: ${students}</p>
                    <p class="inline-help">Creado: ${new Date(course.created_at).toLocaleString()}</p>
                    <p style="margin-top: 8px; color: #334155;">${escapeHtml(course.description || 'Sin descripcion.')}</p>
                </article>
            `;
        })
        .join('');
}

function addLessonBlockToBuffer() {
    const type = document.getElementById('lessonBlockType').value;
    const text = document.getElementById('lessonBlockText').value.trim();
    const url = document.getElementById('lessonBlockUrl').value.trim();

    if (type === 'text' && !text) {
        showToast('Para bloque de texto, agrega contenido.', 'warning');
        return;
    }

    if ((type === 'image' || type === 'youtube') && !url) {
        showToast('Para imagen o YouTube, agrega una URL.', 'warning');
        return;
    }

    if (type === 'youtube' && !normalizeYoutubeUrl(url)) {
        showToast('URL de YouTube invalida.', 'warning');
        return;
    }

    state.lessonBlocksBuffer.push({
        block_type: type,
        content_text: text || null,
        media_url: url || null,
        metadata: {},
    });

    document.getElementById('lessonBlockText').value = '';
    document.getElementById('lessonBlockUrl').value = '';
    renderLessonComposerBuffers();
}

function addLessonQuestionToBuffer() {
    const text = document.getElementById('lessonQuestionText').value.trim();
    const optionsRaw = document.getElementById('lessonQuestionOptions').value.trim();
    const answerRaw = document.getElementById('lessonQuestionAnswer').value.trim();

    if (!text) {
        showToast('Escribe una pregunta para la leccion.', 'warning');
        return;
    }

    const options = parseOptions(optionsRaw);
    let answerPayload = null;

    if (answerRaw) {
        const parsedIndex = Number(answerRaw);
        if (!Number.isNaN(parsedIndex) && parsedIndex > 0 && options.length >= parsedIndex) {
            answerPayload = { index: parsedIndex - 1, value: options[parsedIndex - 1] };
        } else {
            answerPayload = { value: answerRaw };
        }
    }

    state.lessonQuestionsBuffer.push({
        question_text: text,
        question_type: options.length ? 'single' : 'short',
        options: options.length ? options : null,
        correct_answer: answerPayload,
        is_required: true,
    });

    document.getElementById('lessonQuestionText').value = '';
    document.getElementById('lessonQuestionOptions').value = '';
    document.getElementById('lessonQuestionAnswer').value = '';
    renderLessonComposerBuffers();
}

function renderLessonComposerBuffers() {
    const blocksTarget = document.getElementById('lessonBlocksDraft');
    const questionsTarget = document.getElementById('lessonQuestionsDraft');

    if (blocksTarget) {
        blocksTarget.innerHTML = state.lessonBlocksBuffer.length
            ? state.lessonBlocksBuffer
                .map((block, index) => `<div class="mini-card">#${index + 1} - ${escapeHtml(block.block_type)} ${escapeHtml(block.content_text || block.media_url || '')}</div>`)
                .join('')
            : '<div class="empty-box">Sin bloques agregados.</div>';
    }

    if (questionsTarget) {
        questionsTarget.innerHTML = state.lessonQuestionsBuffer.length
            ? state.lessonQuestionsBuffer
                .map((question, index) => `<div class="mini-card">#${index + 1} - ${escapeHtml(question.question_text)}</div>`)
                .join('')
            : '<div class="empty-box">Sin preguntas agregadas.</div>';
    }
}

function addLessonToCourseDraft() {
    const lessonTitle = document.getElementById('lessonTitle').value.trim();
    const lessonDescription = document.getElementById('lessonDescription').value.trim();

    if (!lessonTitle) {
        showToast('Agrega titulo de leccion.', 'warning');
        return;
    }

    if (!state.lessonBlocksBuffer.length) {
        showToast('Agrega al menos un bloque antes de guardar la leccion.', 'warning');
        return;
    }

    state.lessonDrafts.push({
        title: lessonTitle,
        description: lessonDescription || null,
        blocks: [...state.lessonBlocksBuffer],
        questions: [...state.lessonQuestionsBuffer],
    });

    document.getElementById('lessonTitle').value = '';
    document.getElementById('lessonDescription').value = '';
    state.lessonBlocksBuffer = [];
    state.lessonQuestionsBuffer = [];

    renderLessonComposerBuffers();
    renderLessonDrafts();
}

function renderLessonDrafts() {
    const target = document.getElementById('lessonDraftList');
    if (!target) {
        return;
    }

    if (!state.lessonDrafts.length) {
        target.innerHTML = '<div class="empty-box">No hay lecciones en borrador para este curso.</div>';
        return;
    }

    target.innerHTML = state.lessonDrafts
        .map((lesson, index) => `
            <article class="mini-card">
                <div class="mini-row">
                    <h4>Leccion ${index + 1}: ${escapeHtml(lesson.title)}</h4>
                    <button class="btn btn-muted" type="button" data-remove-lesson="${index}">Eliminar</button>
                </div>
                <p class="inline-help">Bloques: ${lesson.blocks.length} | Preguntas: ${lesson.questions.length}</p>
                <p class="inline-help">${escapeHtml(lesson.description || 'Sin descripcion')}</p>
            </article>
        `)
        .join('');
}

async function createCourse(event) {
    event.preventDefault();

    if (!state.lessonDrafts.length) {
        showToast('Debes guardar al menos una leccion para crear el curso.', 'warning');
        return;
    }

    const title = document.getElementById('courseTitle').value.trim();
    const description = document.getElementById('courseDescription').value.trim();
    const cover = document.getElementById('courseCover').value.trim();
    const status = document.getElementById('courseStatus').value;

    if (!title) {
        showToast('El curso necesita titulo.', 'warning');
        return;
    }

    const { data: newCourse, error: courseError } = await supabaseClient
        .from('courses')
        .insert({
            created_by: state.currentAdmin.id,
            title,
            description: description || null,
            cover_image_url: cover || null,
            status,
        })
        .select('id')
        .single();

    if (courseError) {
        showToast('No se pudo crear curso: ' + courseError.message, 'error');
        return;
    }

    for (let lessonIndex = 0; lessonIndex < state.lessonDrafts.length; lessonIndex += 1) {
        const lesson = state.lessonDrafts[lessonIndex];

        const { data: insertedLesson, error: lessonError } = await supabaseClient
            .from('course_lessons')
            .insert({
                course_id: newCourse.id,
                title: lesson.title,
                description: lesson.description,
                position: lessonIndex + 1,
                is_published: true,
            })
            .select('id')
            .single();

        if (lessonError) {
            showToast('Error creando leccion: ' + lessonError.message, 'error');
            continue;
        }

        if (lesson.blocks.length) {
            const blocksPayload = lesson.blocks.map((block, blockIndex) => ({
                lesson_id: insertedLesson.id,
                position: blockIndex + 1,
                block_type: block.block_type,
                content_text: block.content_text,
                media_url: block.media_url,
                metadata: block.metadata || {},
            }));

            const { error: blockError } = await supabaseClient
                .from('lesson_blocks')
                .insert(blocksPayload);

            if (blockError) {
                showToast('Error guardando bloques: ' + blockError.message, 'error');
            }
        }

        if (lesson.questions.length) {
            const questionsPayload = lesson.questions.map((question) => ({
                lesson_id: insertedLesson.id,
                question_text: question.question_text,
                question_type: question.question_type,
                options: question.options,
                correct_answer: question.correct_answer,
                is_required: question.is_required,
            }));

            const { error: questionError } = await supabaseClient
                .from('lesson_questions')
                .insert(questionsPayload);

            if (questionError) {
                showToast('Error guardando preguntas de leccion: ' + questionError.message, 'error');
            }
        }
    }

    let studentIds = getSelectedValues('courseAssignedStudents');
    if (document.getElementById('courseAssignAll').checked) {
        studentIds = state.students.map((student) => student.id);
    }

    if (studentIds.length) {
        const assignmentRows = studentIds.map((studentId) => ({
            course_id: newCourse.id,
            student_id: studentId,
            assigned_by: state.currentAdmin.id,
            is_visible: true,
        }));

        const { error: assignmentError } = await supabaseClient
            .from('course_assignments')
            .upsert(assignmentRows, {
                onConflict: 'course_id,student_id',
                ignoreDuplicates: true,
            });

        if (assignmentError) {
            showToast('Curso creado, pero no se pudo asignar a alumnos: ' + assignmentError.message, 'warning');
        }
    }

    document.getElementById('createCourseForm').reset();
    state.lessonBlocksBuffer = [];
    state.lessonQuestionsBuffer = [];
    state.lessonDrafts = [];
    renderLessonComposerBuffers();
    renderLessonDrafts();

    await loadCourses();
    showToast('Curso creado correctamente.', 'success');
    switchSection('coursesSection');
}

// ========================================
// LIVE EVENTS
// ========================================

function bindLiveEvents() {
    const form = document.getElementById('liveForm');
    if (form) {
        form.addEventListener('submit', createLiveEvent);
    }
}

async function createLiveEvent(event) {
    event.preventDefault();

    const title = document.getElementById('liveTitle').value.trim();
    const description = document.getElementById('liveDescription').value.trim();
    const youtubeUrl = normalizeYoutubeUrl(document.getElementById('liveYoutubeUrl').value.trim());
    const status = document.getElementById('liveStatus').value;
    const startsAtValue = document.getElementById('liveStartsAt').value;
    const publishForAll = document.getElementById('liveForAll').checked;

    let studentIds = getSelectedValues('liveTargetStudents');
    if (publishForAll || (status === 'published' && !studentIds.length)) {
        studentIds = state.students.map((student) => student.id);
    }

    if (!title || !youtubeUrl) {
        showToast('Completa titulo y URL valida de YouTube.', 'warning');
        return;
    }

    if (status === 'published' && !studentIds.length) {
        showToast('No hay alumnos disponibles para asignar este live publicado.', 'warning');
        return;
    }

    const { data: live, error: liveError } = await supabaseClient
        .from('live_events')
        .insert({
            created_by: state.currentAdmin.id,
            title,
            description: description || null,
            youtube_url: youtubeUrl,
            starts_at: startsAtValue ? new Date(startsAtValue).toISOString() : null,
            status,
        })
        .select('id')
        .single();

    if (liveError) {
        showToast('No se pudo crear live: ' + liveError.message, 'error');
        return;
    }

    if (!studentIds.length) {
        showToast('Live creado sin alumnos objetivo. Asigna al menos uno.', 'warning');
    } else {
        const assignments = studentIds.map((studentId) => ({
            live_id: live.id,
            student_id: studentId,
            assigned_by: state.currentAdmin.id,
            is_visible: true,
        }));

        const { error: assignError } = await supabaseClient
            .from('live_assignments')
            .upsert(assignments, {
                onConflict: 'live_id,student_id',
                ignoreDuplicates: true,
            });

        if (assignError) {
            showToast('Live creado pero fallo asignacion: ' + assignError.message, 'warning');
        }
    }

    document.getElementById('liveForm').reset();
    await loadLiveEvents();
    if (status === 'published') {
        showToast(`Live publicado correctamente para ${studentIds.length} alumno(s).`, 'success');
    } else {
        showToast('Live creado correctamente en borrador.', 'success');
    }
}

async function loadLiveEvents() {
    const { data, error } = await supabaseClient
        .from('live_events')
        .select('id, title, status, youtube_url, starts_at, created_at')
        .order('created_at', { ascending: false });

    const target = document.getElementById('liveEventsList');
    if (!target) {
        return;
    }

    if (error) {
        target.innerHTML = `<div class="empty-box">No se pudieron cargar lives: ${escapeHtml(error.message)}</div>`;
        return;
    }

    const lives = data || [];
    if (!lives.length) {
        target.innerHTML = '<div class="empty-box">No hay lives creados.</div>';
        return;
    }

    const liveIds = lives.map((live) => live.id);
    const assignmentCountMap = {};

    const { data: assignments } = await supabaseClient
        .from('live_assignments')
        .select('live_id')
        .in('live_id', liveIds);

    (assignments || []).forEach((row) => {
        assignmentCountMap[row.live_id] = (assignmentCountMap[row.live_id] || 0) + 1;
    });

    target.innerHTML = lives
        .map((live) => {
            const statusClass = live.status === 'published' ? 'published' : 'draft';
            const assigned = assignmentCountMap[live.id] || 0;
            return `
                <article class="mini-card">
                    <div class="mini-row">
                        <h4>${escapeHtml(live.title)}</h4>
                        <span class="tag ${statusClass}">${escapeHtml(live.status)}</span>
                    </div>
                    <p class="inline-help">Alumnos asignados: ${assigned}</p>
                    <p class="inline-help">Inicio: ${live.starts_at ? new Date(live.starts_at).toLocaleString() : 'Sin fecha'}</p>
                    <a href="${escapeHtml(live.youtube_url)}" target="_blank" rel="noopener" class="inline-help">Abrir YouTube</a>
                </article>
            `;
        })
        .join('');
}

// ========================================
// EXAMS
// ========================================

function bindExamEvents() {
    const addQuestionBtn = document.getElementById('addExamQuestionBtn');
    if (addQuestionBtn) {
        addQuestionBtn.addEventListener('click', addExamQuestionToBuffer);
    }

    const form = document.getElementById('examForm');
    if (form) {
        form.addEventListener('submit', createExam);
    }
}

function addExamQuestionToBuffer() {
    const text = document.getElementById('examQuestionText').value.trim();
    const optionsRaw = document.getElementById('examQuestionOptions').value.trim();
    const answerRaw = document.getElementById('examQuestionAnswer').value.trim();
    const pointsRaw = Number(document.getElementById('examQuestionPoints').value || 1);

    if (!text) {
        showToast('Agrega texto de la pregunta.', 'warning');
        return;
    }

    const options = parseOptions(optionsRaw);
    let correct = null;

    if (answerRaw) {
        const parsedIndex = Number(answerRaw);
        if (!Number.isNaN(parsedIndex) && parsedIndex > 0 && options.length >= parsedIndex) {
            correct = { index: parsedIndex - 1, value: options[parsedIndex - 1] };
        } else {
            correct = { value: answerRaw };
        }
    }

    state.examQuestionsBuffer.push({
        question_text: text,
        question_type: options.length ? 'single' : 'short',
        options: options.length ? options : null,
        correct_answer: correct,
        points: Number.isFinite(pointsRaw) && pointsRaw > 0 ? pointsRaw : 1,
    });

    document.getElementById('examQuestionText').value = '';
    document.getElementById('examQuestionOptions').value = '';
    document.getElementById('examQuestionAnswer').value = '';
    document.getElementById('examQuestionPoints').value = '1';
    renderExamQuestionDrafts();
}

function renderExamQuestionDrafts() {
    const target = document.getElementById('examQuestionsDraft');
    if (!target) {
        return;
    }

    if (!state.examQuestionsBuffer.length) {
        target.innerHTML = '<div class="empty-box">Sin preguntas en borrador.</div>';
        return;
    }

    target.innerHTML = state.examQuestionsBuffer
        .map((question, index) => `
            <article class="mini-card">
                <div class="mini-row">
                    <h4>Pregunta ${index + 1}</h4>
                    <button class="btn btn-muted" type="button" data-remove-exam-question="${index}">Eliminar</button>
                </div>
                <p>${escapeHtml(question.question_text)}</p>
                <p class="inline-help">Puntos: ${question.points}</p>
            </article>
        `)
        .join('');

    target.querySelectorAll('[data-remove-exam-question]').forEach((button) => {
        button.addEventListener('click', () => {
            const index = Number(button.getAttribute('data-remove-exam-question'));
            state.examQuestionsBuffer.splice(index, 1);
            renderExamQuestionDrafts();
        });
    });
}

async function createExam(event) {
    event.preventDefault();

    if (!state.examQuestionsBuffer.length) {
        showToast('Agrega al menos una pregunta al examen.', 'warning');
        return;
    }

    const title = document.getElementById('examTitle').value.trim();
    const description = document.getElementById('examDescription').value.trim();
    const status = document.getElementById('examStatus').value;
    const availableFrom = document.getElementById('examAvailableFrom').value;
    const availableTo = document.getElementById('examAvailableTo').value;

    if (!title) {
        showToast('El examen necesita titulo.', 'warning');
        return;
    }

    const { data: exam, error: examError } = await supabaseClient
        .from('exams')
        .insert({
            created_by: state.currentAdmin.id,
            title,
            description: description || null,
            status,
            available_from: availableFrom ? new Date(availableFrom).toISOString() : null,
            available_to: availableTo ? new Date(availableTo).toISOString() : null,
        })
        .select('id')
        .single();

    if (examError) {
        showToast('No se pudo crear examen: ' + examError.message, 'error');
        return;
    }

    const questionRows = state.examQuestionsBuffer.map((question, index) => ({
        exam_id: exam.id,
        position: index + 1,
        question_text: question.question_text,
        question_type: question.question_type,
        options: question.options,
        correct_answer: question.correct_answer,
        points: question.points,
    }));

    const { error: questionError } = await supabaseClient
        .from('exam_questions')
        .insert(questionRows);

    if (questionError) {
        showToast('Examen creado, pero preguntas fallaron: ' + questionError.message, 'warning');
    }

    let studentIds = getSelectedValues('examTargetStudents');
    if (document.getElementById('examForAll').checked) {
        studentIds = state.students.map((student) => student.id);
    }

    if (!studentIds.length) {
        showToast('Examen creado sin alumnos asignados.', 'warning');
    } else {
        const assignmentRows = studentIds.map((studentId) => ({
            exam_id: exam.id,
            student_id: studentId,
            assigned_by: state.currentAdmin.id,
            status: status === 'published' ? 'published' : 'assigned',
        }));

        const { error: assignmentError } = await supabaseClient
            .from('exam_assignments')
            .upsert(assignmentRows, {
                onConflict: 'exam_id,student_id',
                ignoreDuplicates: true,
            });

        if (assignmentError) {
            showToast('Examen creado, pero asignacion fallo: ' + assignmentError.message, 'warning');
        }
    }

    document.getElementById('examForm').reset();
    state.examQuestionsBuffer = [];
    renderExamQuestionDrafts();
    await loadExams();
    showToast('Examen creado y asignado.', 'success');
}

async function loadExams() {
    const { data, error } = await supabaseClient
        .from('exams')
        .select('id, title, status, created_at, available_from, available_to')
        .order('created_at', { ascending: false });

    const target = document.getElementById('examsList');
    if (!target) {
        return;
    }

    if (error) {
        target.innerHTML = `<div class="empty-box">No se pudieron cargar examenes: ${escapeHtml(error.message)}</div>`;
        return;
    }

    const exams = data || [];
    if (!exams.length) {
        target.innerHTML = '<div class="empty-box">No hay examenes creados.</div>';
        return;
    }

    const examIds = exams.map((exam) => exam.id);
    const assignmentMap = {};
    const questionMap = {};

    const { data: assignmentRows } = await supabaseClient
        .from('exam_assignments')
        .select('exam_id')
        .in('exam_id', examIds);

    (assignmentRows || []).forEach((row) => {
        assignmentMap[row.exam_id] = (assignmentMap[row.exam_id] || 0) + 1;
    });

    const { data: questionRows } = await supabaseClient
        .from('exam_questions')
        .select('exam_id')
        .in('exam_id', examIds);

    (questionRows || []).forEach((row) => {
        questionMap[row.exam_id] = (questionMap[row.exam_id] || 0) + 1;
    });

    target.innerHTML = exams
        .map((exam) => {
            const statusClass = exam.status === 'published' ? 'published' : 'draft';
            return `
                <article class="mini-card">
                    <div class="mini-row">
                        <h4>${escapeHtml(exam.title)}</h4>
                        <span class="tag ${statusClass}">${escapeHtml(exam.status)}</span>
                    </div>
                    <p class="inline-help">Preguntas: ${questionMap[exam.id] || 0}</p>
                    <p class="inline-help">Alumnos asignados: ${assignmentMap[exam.id] || 0}</p>
                    <p class="inline-help">Ventana: ${exam.available_from ? new Date(exam.available_from).toLocaleString() : '-'} a ${exam.available_to ? new Date(exam.available_to).toLocaleString() : '-'}</p>
                </article>
            `;
        })
        .join('');
}

// ========================================
// GROUPS
// ========================================

function bindGroupEvents() {
    const refreshBtn = document.getElementById('refreshGroupsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadGroups);
    }

    const form = document.getElementById('createGroupForm');
    if (form) {
        form.addEventListener('submit', createGroup);
    }
}

async function createGroup(event) {
    event.preventDefault();

    const name = document.getElementById('groupName').value.trim();
    const description = document.getElementById('groupDescription').value.trim();
    const studentIds = getSelectedValues('groupStudentMembers');
    const selectedCourseIds = getSelectedValues('groupCourseList');

    if (!name) {
        showToast('El grupo necesita nombre.', 'warning');
        return;
    }

    if (!studentIds.length) {
        showToast('Selecciona al menos un alumno para el grupo.', 'warning');
        return;
    }

    const { data: group, error: groupError } = await supabaseClient
        .from('student_groups')
        .insert({
            created_by: state.currentAdmin.id,
            name,
            description: description || null,
        })
        .select('id')
        .single();

    if (groupError) {
        showToast('No se pudo crear grupo: ' + groupError.message, 'error');
        return;
    }

    const memberRows = studentIds.map((studentId) => ({
        group_id: group.id,
        student_id: studentId,
        added_by: state.currentAdmin.id,
    }));

    const { error: memberError } = await supabaseClient
        .from('group_members')
        .upsert(memberRows, {
            onConflict: 'group_id,student_id',
            ignoreDuplicates: true,
        });

    if (memberError) {
        showToast('Grupo creado, pero fallo la insercion de alumnos: ' + memberError.message, 'warning');
    }

    if (selectedCourseIds.length) {
        const groupCourseRows = selectedCourseIds.map((courseId) => ({
            group_id: group.id,
            course_id: courseId,
            assigned_by: state.currentAdmin.id,
        }));

        const { error: groupCourseError } = await supabaseClient
            .from('group_course_assignments')
            .upsert(groupCourseRows, {
                onConflict: 'group_id,course_id',
                ignoreDuplicates: true,
            });

        if (groupCourseError) {
            showToast('Grupo creado, pero fallo asignacion de cursos al grupo: ' + groupCourseError.message, 'warning');
        }

        const courseAssignments = [];
        selectedCourseIds.forEach((courseId) => {
            studentIds.forEach((studentId) => {
                courseAssignments.push({
                    course_id: courseId,
                    student_id: studentId,
                    assigned_by: state.currentAdmin.id,
                    is_visible: true,
                });
            });
        });

        if (courseAssignments.length) {
            const { error: courseAssignError } = await supabaseClient
                .from('course_assignments')
                .upsert(courseAssignments, {
                    onConflict: 'course_id,student_id',
                    ignoreDuplicates: true,
                });

            if (courseAssignError) {
                showToast('Grupo creado, pero fallo auto-asignacion de cursos: ' + courseAssignError.message, 'warning');
            }
        }
    }

    document.getElementById('createGroupForm').reset();
    await loadGroups();
    await loadCourses();
    showToast('Grupo creado correctamente.', 'success');
}

async function loadGroups() {
    const { data, error } = await supabaseClient
        .from('student_groups')
        .select('id, name, description, created_at')
        .order('created_at', { ascending: false });

    const target = document.getElementById('groupsList');
    if (!target) {
        return;
    }

    if (error) {
        target.innerHTML = `<div class="empty-box">No se pudieron cargar grupos: ${escapeHtml(error.message)}</div>`;
        return;
    }

    state.groups = data || [];

    if (!state.groups.length) {
        target.innerHTML = '<div class="empty-box">Todavia no hay grupos creados.</div>';
        return;
    }

    const groupIds = state.groups.map((group) => group.id);
    const memberMap = {};
    const courseMap = {};

    const { data: memberRows } = await supabaseClient
        .from('group_members')
        .select('group_id')
        .in('group_id', groupIds);

    (memberRows || []).forEach((row) => {
        memberMap[row.group_id] = (memberMap[row.group_id] || 0) + 1;
    });

    const { data: courseRows } = await supabaseClient
        .from('group_course_assignments')
        .select('group_id')
        .in('group_id', groupIds);

    (courseRows || []).forEach((row) => {
        courseMap[row.group_id] = (courseMap[row.group_id] || 0) + 1;
    });

    target.innerHTML = state.groups
        .map((group) => `
            <article class="mini-card">
                <div class="mini-row">
                    <h4>${escapeHtml(group.name)}</h4>
                    <span class="tag published">Grupo</span>
                </div>
                <p>${escapeHtml(group.description || 'Sin descripcion')}</p>
                <p class="inline-help">Miembros: ${memberMap[group.id] || 0} | Cursos vinculados: ${courseMap[group.id] || 0}</p>
                <p class="inline-help">Creado: ${new Date(group.created_at).toLocaleString()}</p>
            </article>
        `)
        .join('');
}

// ========================================
// LOGOUT
// ========================================

function bindLogoutEvents() {
    const logoutButton = document.getElementById('adminLogoutBtn');
    const logoutModal = document.getElementById('adminLogoutModal');
    const cancelBtn = document.getElementById('cancelAdminLogoutBtn');
    const confirmBtn = document.getElementById('confirmAdminLogoutBtn');

    if (!logoutButton || !logoutModal || !cancelBtn || !confirmBtn) {
        return;
    }

    logoutButton.addEventListener('click', () => {
        logoutModal.classList.add('visible');
    });

    cancelBtn.addEventListener('click', () => {
        logoutModal.classList.remove('visible');
    });

    logoutModal.addEventListener('click', (event) => {
        if (event.target === logoutModal) {
            logoutModal.classList.remove('visible');
        }
    });

    confirmBtn.addEventListener('click', async () => {
        await logoutAdmin();
    });
}

async function logoutAdmin() {
    try {
        await supabaseClient.auth.signOut();
    } catch (error) {
        console.warn('No se pudo cerrar sesion en Supabase:', error.message);
    }

    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('user');

    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    localStorage.removeItem('sb-mfhfeytlgmkxuzlclawx-auth-token');

    window.location.href = '/pages/login.html';
}
