import { state } from '../shared/state.js';
import { enableDebugButton } from './ui.js';
import { showDebugMenu } from './components/DebugMenu.js';
import { showLeaderboard } from './components/LeaderboardModal.js';
import { startScramble, handleResetClick, hardReset } from '../game/scramble.js';
import { toggleMirrors, updateBackMirrorHeight, getMirrorHeight } from '../core/environment.js';
import { playSolveAnimation, animateVictory } from '../animations/victory.js';
import { showWinModal, togglePanel, openDetailModal, updateHistoryUI, updateActivePuzzleTab } from './ui.js';
import { submitScore, fetchLeaderboard } from '../leaderboard/firebase.js';
import { playCubeAnimation, animateWrapperReset } from '../animations/transitions.js';
import { adjustCameraForCubeSize } from '../core/controls.js';
import { onWindowResize, updateZoomDisplay } from '../core/scene.js';
import { onKeyDown, onKeyUp } from '../game/moves.js';
import { soundManager } from '../core/sound.js';
import { StandardCube } from '../puzzles/StandardCube.js';
import { MirrorCube } from '../puzzles/MirrorCube.js';
import { checkSolved } from '../game/timer.js';
import { setupPuzzleSelector, openPuzzleSelector } from './puzzleSelector.js';
import { setupLeaderboardUI, openLeaderboardModal } from './leaderboardUi.js';
import { overlayManager } from './overlayManager.js';

import { isOnline } from '../utils/network.js';

export function setupUIEventListeners() {
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    setupPuzzleSelector();
    setupLeaderboardUI();

    document.getElementById('btn-scramble').addEventListener('click', () => {
        gtag('event', 'scramble_click');
        startScramble();
    });
    document.getElementById('btn-reset').addEventListener('click', () => {
        gtag('event', 'reset_click');
        handleResetClick();
    });

    document.getElementById('btn-close-modal').addEventListener('click', () => {
        overlayManager.close();
    });

    document.getElementById('btn-play-again').addEventListener('click', async () => {
        overlayManager.close();
        setTimeout(async () => {
            await hardReset(true);
        }, 500);
    });

    const btnToggleSound = document.getElementById('btn-toggle-sound');
    if (btnToggleSound) {
        // Set initial state
        updateSoundButton(btnToggleSound);

        btnToggleSound.addEventListener('click', () => {
            soundManager.toggleMute();
            updateSoundButton(btnToggleSound);
            // Also init on click if not already
            soundManager.init();
            gtag('event', 'toggle_sound', { state: soundManager.isMuted ? 'off' : 'on' });
        });
    }

    // Initialize audio context on first interaction
    const initAudio = () => {
        soundManager.init();
        window.removeEventListener('click', initAudio);
        window.removeEventListener('keydown', initAudio);
        window.removeEventListener('touchstart', initAudio);
    };
    window.addEventListener('click', initAudio);
    window.addEventListener('keydown', initAudio);
    window.addEventListener('touchstart', initAudio);

    // Leaderboard Listeners
    document.getElementById('btn-leaderboard').addEventListener('click', () => {
        showLeaderboard();
        gtag('event', 'open_leaderboard');
    });

    document.getElementById('btn-close-detail').addEventListener('click', () => {
        overlayManager.close();
    });




    document.getElementById('btn-toggle-mirrors').addEventListener('click', () => {
        const newState = !state.showMirrors;
        toggleMirrors(newState);
        gtag('event', 'toggle_mirror', { state: newState ? 'on' : 'off' });
        handleDebugSequence('mirror');
    });

    // Debug Menu Secret Sequence: Mirror -> Lock -> Mirror -> Lock -> Mirror -> Lock (3 cycles)
    // Must be completed within 3 seconds
    let lastDebugButton = null;
    let lastDebugButtonTime = 0;
    const DEBUG_TIMEOUT_MS = 3000;

    function handleDebugSequence(buttonType) {
        const now = Date.now();

        // Check if timeout has expired
        if (now - lastDebugButtonTime > DEBUG_TIMEOUT_MS) {
            state.debugSequenceCount = 0;
            lastDebugButton = null;
        }

        lastDebugButtonTime = now;

        // Expected pattern: alternating mirror and lock
        if (buttonType === 'mirror') {
            if (lastDebugButton === 'lock' || lastDebugButton === null) {
                state.debugSequenceCount++;
                lastDebugButton = 'mirror';
            } else {
                // Same button twice in a row, reset
                state.debugSequenceCount = 1;
                lastDebugButton = 'mirror';
            }
        } else if (buttonType === 'lock') {
            if (lastDebugButton === 'mirror') {
                state.debugSequenceCount++;
                lastDebugButton = 'lock';
            } else {
                // Same button twice or lock first, reset
                state.debugSequenceCount = 0;
                lastDebugButton = null;
            }
        }

        // Check if sequence is complete (6 taps = 3 complete cycles)
        if (state.debugSequenceCount >= 6) {
            showDebugMenu();
            gtag('event', 'open_debug_sequence');
            state.debugSequenceCount = 0;
            lastDebugButton = null;

            // Show persistent debug button
            enableDebugButton();
        }
    }


    const updateAxisLockButton = () => {
        const btn = document.getElementById('btn-toggle-axis-lock');
        const checkbox = document.getElementById('toggle-free-rotation');

        if (btn) {
            if (state.freeRotation) {
                btn.innerHTML = '<span class="text-lg">🔓</span>';
                btn.classList.remove('bg-orange-700', 'hover:bg-orange-600');
                btn.classList.add('bg-blue-600', 'hover:bg-blue-500');
                btn.title = "Disable Free Rotation";
            } else {
                btn.innerHTML = '<span class="text-lg">🔒</span>';
                btn.classList.remove('bg-blue-600', 'hover:bg-blue-500');
                btn.classList.add('bg-orange-700', 'hover:bg-orange-600');
                btn.title = "Enable Free Rotation";
            }
        }

        if (checkbox) {
            checkbox.checked = state.freeRotation;
        }
    };

    document.getElementById('btn-toggle-axis-lock').addEventListener('click', () => {
        state.freeRotation = !state.freeRotation;
        updateAxisLockButton();
        if (!state.freeRotation) {
            animateWrapperReset();
        }
        gtag('event', 'toggle_free_rotation', { state: state.freeRotation ? 'on' : 'off' });
        handleDebugSequence('lock');
    });


    // Initialize button state
    updateAxisLockButton();



    document.getElementById('btn-submit-score').addEventListener('click', async () => {
        const submitButton = document.getElementById('btn-submit-score');
        if (!isOnline()) {
            alert("You are offline. Cannot submit score.");
            return;
        }

        const nameInput = document.getElementById('player-name');
        const name = nameInput.value.trim();
        if (!name) {
            alert("Please enter a name!");
            return;
        }

        // Disable button to prevent double-submissions
        submitButton.disabled = true;
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Submitting...';

        try {
            const timeStr = document.getElementById('final-time').textContent;
            const scramble = state.scrambleSequence.join(" ");
            const solution = state.moveHistory.join(" ");

            const puzzleType = await submitScore(name, state.finalTimeMs, timeStr, scramble, solution);

            if (puzzleType) {
                overlayManager.close(); // Close solved modal
                setTimeout(() => {
                    openLeaderboardModal();
                }, 100);
            }
        } finally {
            // Re-enable button in all cases (success or failure)
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    });
}

function updateSoundButton(btn) {
    if (soundManager.isMuted) {
        btn.innerHTML = '<span class="text-lg">🔇</span>';
        btn.classList.remove('bg-green-700', 'hover:bg-green-600');
        btn.classList.add('bg-gray-600', 'hover:bg-gray-500');
    } else {
        btn.innerHTML = '<span class="text-lg">🔊</span>';
        btn.classList.remove('bg-gray-600', 'hover:bg-gray-500');
        btn.classList.add('bg-green-700', 'hover:bg-green-600');
    }
}


