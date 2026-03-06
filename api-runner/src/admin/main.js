/**
 * Admin UI Module for API Runner
 * Handles admin authentication, score viewing, CSV export, and reset functionality
 */

import { getClickCount } from '../lib/supabase';

// API base URL - configurable via environment variable
const API_BASE = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:8787';

let authToken = null;
let currentScores = [];
let currentEventId = '';

// DOM Elements
const loginSection = document.getElementById('login-section');
const adminSection = document.getElementById('admin-section');
const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');
const adminMessage = document.getElementById('admin-message');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const eventIdInput = document.getElementById('event-id');
const loadBtn = document.getElementById('load-btn');
const exportBtn = document.getElementById('export-btn');
const resetBtn = document.getElementById('reset-btn');
const totalCountEl = document.getElementById('total-count');
const topScoreEl = document.getElementById('top-score');
const tableContent = document.getElementById('table-content');
const adspClickCountEl = document.getElementById('adsp-click-count');
const refreshClicksBtn = document.getElementById('refresh-clicks-btn');
const clickErrorEl = document.getElementById('click-error');

// Reset modal elements
const resetModal = document.getElementById('reset-modal');
const confirmEventIdInput = document.getElementById('confirm-event-id');
const cancelResetBtn = document.getElementById('cancel-reset-btn');
const confirmResetBtn = document.getElementById('confirm-reset-btn');

// Helper functions
function showMessage(el, text, type) {
    el.textContent = text;
    el.className = `message visible ${type}`;
}

function hideMessage(el) {
    el.className = 'message';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Auth functions
function checkAuth() {
    const stored = sessionStorage.getItem('adminToken');
    if (stored) {
        authToken = stored;
        showAdminSection();
    }
}

function showAdminSection() {
    loginSection.style.display = 'none';
    adminSection.classList.add('visible');
}

function showLoginSection() {
    loginSection.style.display = 'block';
    adminSection.classList.remove('visible');
    authToken = null;
    sessionStorage.removeItem('adminToken');
}

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage(loginMessage);

    const password = passwordInput.value;
    if (!password) return;

    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';

    try {
        const res = await fetch(`${API_BASE}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const data = await res.json();

        if (!res.ok) {
            showMessage(loginMessage, data.error || 'Login failed', 'error');
            return;
        }

        authToken = data.token;
        sessionStorage.setItem('adminToken', authToken);
        passwordInput.value = '';
        showAdminSection();
    } catch (err) {
        console.error('Login error:', err);
        showMessage(loginMessage, `Connection failed. Is the admin server running at ${API_BASE}?`, 'error');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    showLoginSection();
});

// Load Scores
loadBtn.addEventListener('click', async () => {
    const eventId = eventIdInput.value.trim();
    if (!eventId) {
        showMessage(adminMessage, 'Please enter an Event ID', 'error');
        return;
    }

    currentEventId = eventId;
    hideMessage(adminMessage);
    loadBtn.disabled = true;
    loadBtn.textContent = 'Loading...';
    tableContent.innerHTML = '<div class="loading">Loading scores...</div>';

    try {
        const res = await fetch(`${API_BASE}/api/admin/scores?eventId=${encodeURIComponent(eventId)}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (res.status === 401) {
            showMessage(adminMessage, 'Session expired. Please login again.', 'error');
            showLoginSection();
            return;
        }

        const data = await res.json();

        if (!res.ok) {
            showMessage(adminMessage, data.error || 'Failed to load scores', 'error');
            tableContent.innerHTML = '<div class="empty">Failed to load scores.</div>';
            return;
        }

        currentScores = data.scores;
        renderScores(currentScores);
        exportBtn.disabled = currentScores.length === 0;
        resetBtn.disabled = currentScores.length === 0;

        // Also refresh click count when loading scores
        loadClickCount();

    } catch (err) {
        console.error('Load error:', err);
        showMessage(adminMessage, 'Connection failed', 'error');
        tableContent.innerHTML = '<div class="empty">Connection failed.</div>';
    } finally {
        loadBtn.disabled = false;
        loadBtn.textContent = 'Load Scores';
    }
});

// Render scores table
function renderScores(scores) {
    totalCountEl.textContent = scores.length;
    topScoreEl.textContent = scores.length > 0 ? scores[0].score : 0;

    if (scores.length === 0) {
        tableContent.innerHTML = '<div class="empty">No scores found for this event.</div>';
        return;
    }

    let html = `
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Email</th>
                    <th>Nickname</th>
                    <th>Score</th>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody>
    `;

    scores.forEach((score, index) => {
        const date = new Date(score.created_at).toLocaleString();
        html += `
            <tr>
                <td class="rank">${index + 1}</td>
                <td class="email">${escapeHtml(score.email)}</td>
                <td>${escapeHtml(score.nickname)}</td>
                <td class="score">${score.score}</td>
                <td>${date}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    tableContent.innerHTML = html;
}

// Export CSV
exportBtn.addEventListener('click', () => {
    if (currentScores.length === 0) return;

    const headers = ['Rank', 'Email', 'Nickname', 'Score', 'Date'];
    const rows = currentScores.map((s, i) => [
        i + 1,
        `"${s.email.replace(/"/g, '""')}"`,
        `"${s.nickname.replace(/"/g, '""')}"`,
        s.score,
        `"${new Date(s.created_at).toISOString()}"`
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `api-runner-${currentEventId}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    URL.revokeObjectURL(url);
    showMessage(adminMessage, 'CSV exported!', 'success');
});

// Reset - Show modal
resetBtn.addEventListener('click', () => {
    confirmEventIdInput.value = '';
    resetModal.classList.add('visible');
});

// Cancel reset
cancelResetBtn.addEventListener('click', () => {
    resetModal.classList.remove('visible');
});

// Confirm reset
confirmResetBtn.addEventListener('click', async () => {
    const typedEventId = confirmEventIdInput.value.trim();

    if (typedEventId !== currentEventId) {
        alert(`Event ID doesn't match!\n\nExpected: ${currentEventId}\nYou typed: ${typedEventId}`);
        return;
    }

    resetModal.classList.remove('visible');
    hideMessage(adminMessage);
    resetBtn.disabled = true;
    resetBtn.textContent = 'Deleting...';

    try {
        const res = await fetch(`${API_BASE}/api/admin/reset`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ eventId: currentEventId })
        });

        if (res.status === 401) {
            showMessage(adminMessage, 'Session expired. Please login again.', 'error');
            showLoginSection();
            return;
        }

        const data = await res.json();

        if (!res.ok) {
            showMessage(adminMessage, data.error || 'Failed to reset', 'error');
            return;
        }

        showMessage(adminMessage, `Deleted ${data.deletedCount} scores!`, 'success');
        currentScores = [];
        renderScores([]);
        exportBtn.disabled = true;
        resetBtn.disabled = true;

    } catch (err) {
        console.error('Reset error:', err);
        showMessage(adminMessage, 'Connection failed', 'error');
    } finally {
        resetBtn.disabled = false;
        resetBtn.textContent = 'Reset Leaderboard';
    }
});

// Close modal on outside click
resetModal.addEventListener('click', (e) => {
    if (e.target === resetModal) {
        resetModal.classList.remove('visible');
    }
});

// Load ADSP link click count
async function loadClickCount() {
    const eventId = eventIdInput.value.trim();
    if (!eventId) {
        adspClickCountEl.textContent = '-';
        clickErrorEl.textContent = '';
        return;
    }

    refreshClicksBtn.disabled = true;
    adspClickCountEl.textContent = '...';
    clickErrorEl.textContent = '';

    try {
        const result = await getClickCount(eventId, 'learn_adsp');

        if (result.error) {
            adspClickCountEl.textContent = '-';
            clickErrorEl.textContent = result.error;
        } else {
            adspClickCountEl.textContent = result.count ?? 0;
            clickErrorEl.textContent = '';
        }
    } catch (err) {
        console.error('Click count error:', err);
        adspClickCountEl.textContent = '-';
        clickErrorEl.textContent = 'Failed to load';
    } finally {
        refreshClicksBtn.disabled = false;
    }
}

// Refresh click count button
refreshClicksBtn.addEventListener('click', loadClickCount);

// Initialize
checkAuth();

console.log('Admin UI initialized. API URL:', API_BASE);
