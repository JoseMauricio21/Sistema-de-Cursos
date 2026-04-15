// Dashboard de Administración de Usuarios
import { getAllUsers, deleteUser, updateUserProfile } from '../db/authUtils.js';

let users = [];

// Cargar usuarios al abrir la página
document.addEventListener('DOMContentLoaded', async () => {
    await loadUsers();
    setupEventListeners();
});

// Cargar todos los usuarios
async function loadUsers() {
    const result = await getAllUsers();
    if (result.success) {
        users = result.users;
        renderUsersTable();
    } else {
        console.error('Error cargando usuarios:', result.error);
        showNotification('Error al cargar usuarios: ' + result.error, 'error');
    }
}

// Renderizar tabla de usuarios
function renderUsersTable() {
    const tbody = document.querySelector('#usersTable tbody');
    tbody.innerHTML = '';

    users.forEach((user, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${user.email}</td>
            <td>${user.full_name}</td>
            <td>${new Date(user.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn-edit" onclick="editUser('${user.id}')">Editar</button>
                <button class="btn-delete" onclick="deleteUserConfirm('${user.id}')">Eliminar</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Eliminar usuario con confirmación
async function deleteUserConfirm(userId) {
    if (confirm('¿Está seguro de que desea eliminar este usuario?')) {
        const result = await deleteUser(userId);
        if (result.success) {
            showNotification('Usuario eliminado exitosamente', 'success');
            await loadUsers();
        } else {
            showNotification('Error al eliminar usuario: ' + result.error, 'error');
        }
    }
}

// Editar usuario
function editUser(userId) {
    const user = users.find(u => u.id === userId);
    if (user) {
        const newName = prompt('Nuevo nombre:', user.full_name);
        if (newName && newName !== user.full_name) {
            updateUserProfileFn(userId, { full_name: newName });
        }
    }
}

// Actualizar perfil del usuario
async function updateUserProfileFn(userId, updates) {
    const result = await updateUserProfile(userId, updates);
    if (result.success) {
        showNotification('Usuario actualizado exitosamente', 'success');
        await loadUsers();
    } else {
        showNotification('Error al actualizar usuario: ' + result.error, 'error');
    }
}

// Buscar usuarios
function searchUsers() {
    const searchTerm = document.querySelector('#searchInput').value.toLowerCase();
    const filteredUsers = users.filter(user =>
        user.email.toLowerCase().includes(searchTerm) ||
        user.full_name.toLowerCase().includes(searchTerm)
    );

    const tbody = document.querySelector('#usersTable tbody');
    tbody.innerHTML = '';

    filteredUsers.forEach((user, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${user.email}</td>
            <td>${user.full_name}</td>
            <td>${new Date(user.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn-edit" onclick="editUser('${user.id}')">Editar</button>
                <button class="btn-delete" onclick="deleteUserConfirm('${user.id}')">Eliminar</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Exportar usuarios a CSV
function exportUsersCSV() {
    let csv = 'Email,Nombre,Fecha Registro\n';
    users.forEach(user => {
        csv += `"${user.email}","${user.full_name}","${new Date(user.created_at).toLocaleDateString()}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usuarios_${new Date().toISOString()}.csv`;
    a.click();
}

// Configurar event listeners
function setupEventListeners() {
    document.querySelector('#searchInput').addEventListener('keyup', searchUsers);
    document.querySelector('#exportBtn').addEventListener('click', exportUsersCSV);
    document.querySelector('#refreshBtn').addEventListener('click', loadUsers);
}

// Mostrar notificaciones
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#28a745' : '#dc3545'};
        color: white;
        border-radius: 5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), 3000);
}
