import StartGame from './game/main';
import { submitScore, getTopScores, trackLinkClick } from './lib/supabase';

const STORAGE_KEYS = {
    email: 'apiRunner.email',
    nickname: 'apiRunner.nickname',
    eventId: 'apiRunner.eventId',
    characterId: 'apiRunner.characterId',
    nyanUnlocked: 'apiRunner.nyanUnlocked'
};

let game = null;
let currentScore = 0;
let scoreSubmitted = false;

document.addEventListener('DOMContentLoaded', () => {
    const startScreen = document.getElementById('start-screen');
    const startForm = document.getElementById('start-form');
    const emailInput = document.getElementById('email');
    const nicknameInput = document.getElementById('nickname');
    const eventIdInput = document.getElementById('eventId');
    const clearInfoLink = document.getElementById('clear-info');
    const gameLogo = document.getElementById('game-logo');

    // Logo starts on start screen (smaller on phones)
    gameLogo.classList.add('on-start-screen');

    // Character selection elements
    const characterCards = document.querySelectorAll('.character-card');
    const nyanCard = document.getElementById('nyan-card');
    const titleEl = startForm.querySelector('h1');
    const toast = document.getElementById('toast');

    // Secret unlock state
    let titleTapTimes = [];

    const gameOverScreen = document.getElementById('game-over-screen');
    const finalScoreEl = document.getElementById('final-score');
    const failureMessageEl = document.getElementById('failure-message');
    const playAgainBtn = document.getElementById('play-again-btn');
    const changeInfoBtn = document.getElementById('change-info-btn');

    // New elements for Supabase integration
    const submitScoreBtn = document.getElementById('submit-score-btn');
    const viewLeaderboardBtn = document.getElementById('view-leaderboard-btn');
    const submitStatus = document.getElementById('submit-status');
    const leaderboardContainer = document.getElementById('leaderboard-container');
    const leaderboardList = document.getElementById('leaderboard-list');
    const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');

    // Pre-fill form from localStorage
    const savedEmail = localStorage.getItem(STORAGE_KEYS.email);
    const savedNickname = localStorage.getItem(STORAGE_KEYS.nickname);
    const savedEventId = localStorage.getItem(STORAGE_KEYS.eventId);

    if (savedEmail) emailInput.value = savedEmail;
    if (savedNickname) nicknameInput.value = savedNickname;
    if (savedEventId) eventIdInput.value = savedEventId;

    // Character selection initialization (nyan unlock uses sessionStorage - resets on player change)
    let savedCharacter = localStorage.getItem(STORAGE_KEYS.characterId) || 'suit';
    const nyanUnlocked = sessionStorage.getItem(STORAGE_KEYS.nyanUnlocked) === 'true';

    // If nyan was selected but not unlocked this session, fall back to suit
    if (savedCharacter === 'nyan' && !nyanUnlocked) {
        savedCharacter = 'suit';
        localStorage.setItem(STORAGE_KEYS.characterId, 'suit');
    }

    // Show nyan card if unlocked this session
    if (nyanUnlocked && nyanCard) {
        nyanCard.classList.remove('hidden');
    }

    // Set initial selected character
    function selectCharacter(characterId) {
        characterCards.forEach(card => {
            card.classList.toggle('selected', card.dataset.character === characterId);
        });
        localStorage.setItem(STORAGE_KEYS.characterId, characterId);
    }

    // Initialize selection
    selectCharacter(savedCharacter);

    // Character card click handlers
    characterCards.forEach(card => {
        card.addEventListener('click', () => {
            selectCharacter(card.dataset.character);
        });
    });

    // Secret unlock: tap title 5 times within 2 seconds
    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('visible');
        setTimeout(() => {
            toast.classList.remove('visible');
        }, 3000);
    }

    titleEl.addEventListener('click', () => {
        // Already unlocked this session, no need to track
        if (sessionStorage.getItem(STORAGE_KEYS.nyanUnlocked) === 'true') return;

        const now = Date.now();
        titleTapTimes.push(now);

        // Keep only taps within the last 2 seconds
        titleTapTimes = titleTapTimes.filter(t => now - t < 2000);

        // Check for 5 taps
        if (titleTapTimes.length >= 5) {
            // Unlock nyan runner for this session only
            sessionStorage.setItem(STORAGE_KEYS.nyanUnlocked, 'true');
            nyanCard.classList.remove('hidden');
            showToast('✨ Nyan Runner unlocked!');
            titleTapTimes = [];
        }
    });

    function resetGameOverUI() {
        scoreSubmitted = false;
        submitScoreBtn.disabled = false;
        submitScoreBtn.textContent = 'Submit Score';
        submitStatus.classList.add('hidden');
        submitStatus.classList.remove('success', 'error');
        leaderboardContainer.classList.add('hidden');
    }

    function initGame() {
        // Clear existing game if any
        if (game) {
            game.destroy(true);
        }

        // Reset UI state
        resetGameOverUI();

        // Hide HTML logo during gameplay (Phaser logo takes over)
        gameLogo.classList.add('in-game');
        gameLogo.classList.remove('on-start-screen', 'on-game-over');

        // Start a new game
        game = StartGame('game-container');

        // Listen for game over event
        game.events.on('gameOver', (data) => {
            currentScore = data.score;
            finalScoreEl.textContent = `Score: ${data.score}`;
            failureMessageEl.textContent = data.message;
            gameOverScreen.classList.remove('hidden');
            // Show HTML logo on game over screen (smaller on phones)
            gameLogo.classList.remove('in-game');
            gameLogo.classList.add('on-game-over');
        });
    }

    // Handle form submission
    startForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const email = emailInput.value.trim();
        const nickname = nicknameInput.value.trim();
        const eventId = eventIdInput.value.trim();

        // Validate all fields are non-empty
        if (!email || !nickname || !eventId) {
            alert('Please fill in all fields');
            return;
        }

        // Save to localStorage
        localStorage.setItem(STORAGE_KEYS.email, email);
        localStorage.setItem(STORAGE_KEYS.nickname, nickname);
        localStorage.setItem(STORAGE_KEYS.eventId, eventId);

        // Hide overlay and start game
        startScreen.classList.add('hidden');
        initGame();
    });

    // Handle clear info
    clearInfoLink.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem(STORAGE_KEYS.email);
        localStorage.removeItem(STORAGE_KEYS.nickname);
        localStorage.removeItem(STORAGE_KEYS.eventId);
        // Reset nyan unlock and character selection
        sessionStorage.removeItem(STORAGE_KEYS.nyanUnlocked);
        localStorage.setItem(STORAGE_KEYS.characterId, 'suit');
        window.location.reload();
    });

    // Handle play again
    playAgainBtn.addEventListener('click', () => {
        gameOverScreen.classList.add('hidden');
        initGame();
    });

    // Handle change player info
    changeInfoBtn.addEventListener('click', () => {
        gameOverScreen.classList.add('hidden');
        if (game) {
            game.destroy(true);
            game = null;
        }
        startScreen.classList.remove('hidden');
        // Ensure HTML logo is visible on start screen with start-screen sizing
        gameLogo.classList.remove('in-game', 'on-game-over');
        gameLogo.classList.add('on-start-screen');

        // Reset nyan unlock for new player session
        sessionStorage.removeItem(STORAGE_KEYS.nyanUnlocked);
        nyanCard.classList.add('hidden');
        titleTapTimes = [];

        // If nyan was selected, fall back to suit
        if (localStorage.getItem(STORAGE_KEYS.characterId) === 'nyan') {
            selectCharacter('suit');
        }
    });

    // Handle submit score
    let isSubmitting = false;

    submitScoreBtn.addEventListener('click', async () => {
        // Prevent double-clicks and re-submission
        if (scoreSubmitted || isSubmitting) {
            console.log('Submit blocked: scoreSubmitted=', scoreSubmitted, 'isSubmitting=', isSubmitting);
            return;
        }

        const email = localStorage.getItem(STORAGE_KEYS.email);
        const nickname = localStorage.getItem(STORAGE_KEYS.nickname);
        const eventId = localStorage.getItem(STORAGE_KEYS.eventId);

        if (!email || !nickname || !eventId) {
            console.log('Submit blocked: Missing player info');
            submitStatus.textContent = 'Missing player info';
            submitStatus.classList.remove('hidden', 'success');
            submitStatus.classList.add('error');
            return;
        }

        // Set submitting state immediately
        isSubmitting = true;
        submitScoreBtn.disabled = true;
        submitScoreBtn.textContent = 'Submitting...';
        submitStatus.classList.add('hidden');
        submitStatus.classList.remove('success', 'error');

        // Log payload (no email for privacy)
        console.log('Submitting score:', { eventId, nickname, score: currentScore });

        try {
            const result = await submitScore({
                event_id: eventId,
                email: email,
                nickname: nickname,
                score: currentScore
            });

            console.log('Submit result:', result);

            if (result.success) {
                scoreSubmitted = true;
                submitScoreBtn.textContent = 'Submitted!';
                submitStatus.textContent = 'Score submitted!';
                submitStatus.classList.remove('hidden', 'error');
                submitStatus.classList.add('success');
                // Refresh leaderboard to show updated scores
                loadLeaderboard();
            } else {
                // Re-enable button on error
                submitScoreBtn.disabled = false;
                submitScoreBtn.textContent = 'Submit Score';
                submitStatus.textContent = result.error || 'Failed to submit';
                submitStatus.classList.remove('hidden', 'success');
                submitStatus.classList.add('error');
            }
        } catch (err) {
            // Catch any unexpected errors
            console.error('Unexpected submit error:', err);
            submitScoreBtn.disabled = false;
            submitScoreBtn.textContent = 'Submit Score';
            submitStatus.textContent = 'Unexpected error. Please try again.';
            submitStatus.classList.remove('hidden', 'success');
            submitStatus.classList.add('error');
        } finally {
            // Always reset submitting state
            isSubmitting = false;
            console.log('Submit flow completed. isSubmitting reset to false');
        }
    });

    // Handle view leaderboard
    const leaderboardTitle = leaderboardContainer.querySelector('h2');

    // Reusable function to load/refresh leaderboard
    async function loadLeaderboard() {
        const eventId = localStorage.getItem(STORAGE_KEYS.eventId);

        // Update title to show event ID
        leaderboardTitle.textContent = eventId
            ? `Top 10 — Event: ${eventId}`
            : 'Top 10';

        if (!eventId) {
            leaderboardList.innerHTML = '<div class="leaderboard-error">No event ID set</div>';
            leaderboardContainer.classList.remove('hidden');
            return;
        }

        leaderboardList.innerHTML = '<div class="leaderboard-loading">Loading...</div>';
        leaderboardContainer.classList.remove('hidden');

        // Log RPC call arguments
        console.log('Leaderboard RPC call:', { eventId, rpc: 'get_top10', param: 'event_id_param' });

        const result = await getTopScores(eventId);

        // Log returned rows count
        const rowCount = result.data ? result.data.length : 0;
        console.log('Leaderboard result:', { eventId, rowsReturned: rowCount, error: result.error || null });

        if (result.error) {
            leaderboardList.innerHTML = `
                <div class="leaderboard-error">${result.error}</div>
                <div class="leaderboard-debug">Queried eventId: ${escapeHtml(eventId)}<br>Rows returned: 0</div>
            `;
            return;
        }

        if (!result.data || result.data.length === 0) {
            leaderboardList.innerHTML = `
                <div class="leaderboard-empty">No scores yet. Be the first!</div>
                <div class="leaderboard-debug">Queried eventId: ${escapeHtml(eventId)}<br>Rows returned: 0</div>
            `;
            return;
        }

        // Build leaderboard HTML
        let html = `
            <div class="leaderboard-row header">
                <span class="leaderboard-rank">#</span>
                <span class="leaderboard-nickname">Player</span>
                <span class="leaderboard-score">Score</span>
            </div>
        `;

        result.data.forEach((entry, index) => {
            html += `
                <div class="leaderboard-row">
                    <span class="leaderboard-rank">${index + 1}</span>
                    <span class="leaderboard-nickname">${escapeHtml(entry.nickname)}</span>
                    <span class="leaderboard-score">${entry.score}</span>
                </div>
            `;
        });

        // Add debug info at bottom
        html += `<div class="leaderboard-debug">Queried eventId: ${escapeHtml(eventId)}<br>Rows returned: ${rowCount}</div>`;

        leaderboardList.innerHTML = html;
    }

    viewLeaderboardBtn.addEventListener('click', loadLeaderboard);

    // Handle close leaderboard
    closeLeaderboardBtn.addEventListener('click', () => {
        leaderboardContainer.classList.add('hidden');
    });

    // Handle Learn ADSP link click tracking
    const learnAdspLink = document.getElementById('learn-adsp-link');
    if (learnAdspLink) {
        learnAdspLink.addEventListener('click', () => {
            const email = localStorage.getItem(STORAGE_KEYS.email);
            const eventId = localStorage.getItem(STORAGE_KEYS.eventId);

            if (email && eventId) {
                // Fire-and-forget: track the click without blocking navigation
                trackLinkClick({
                    event_id: eventId,
                    email: email,
                    link_key: 'learn_adsp'
                });
            }
            // Link navigation happens naturally via href - no need to call window.open
        });
    }
});

// Simple HTML escape to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
