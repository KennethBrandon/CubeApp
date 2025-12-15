import { state } from '../shared/state.js';
import { enableDebugButton } from './ui.js';
import { showDebugMenu } from './components/DebugMenu.js';
import { showLeaderboard } from './components/LeaderboardModal.js';
import { startScramble, handleResetClick, hardReset } from '../game/scramble.js';
import { toggleMirrors } from '../core/environment.js';
import { playSolveAnimation, animateVictory } from '../animations/victory.js';

import { showWinModal, togglePanel, openDetailModal, updateHistoryUI, updateActivePuzzleTab, initHistoryWindow } from './ui.js';
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

    // Initialize Draggable Windows
    initHistoryWindow();

    // Menu Item: History
    document.getElementById('btn-menu-history')?.addEventListener('click', () => {
        const win = document.getElementById('history-window');
        const menu = document.getElementById('main-menu-dropdown');
        if (win) {
            win.classList.toggle('hidden');
            // If opening, ensure not overlapped by menu? 
            // Just close menu
            if (!win.classList.contains('hidden')) {
                // Ensure it's on top if needed, but z-index handles it.
            }
        }
        if (menu) {
            menu.classList.add('opacity-0', 'scale-95');
            setTimeout(() => menu.classList.add('hidden'), 200);
        }
        gtag('event', 'toggle_history_window');
    });

    // Main Menu Toggle & Dismiss Logic
    const menuBtn = document.getElementById('btn-main-menu-toggle');
    const menuDropdown = document.getElementById('main-menu-dropdown');

    if (menuBtn && menuDropdown) {
        console.log("Main Menu Logic Initialized");
        // Toggle Menu
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = menuDropdown.classList.contains('hidden');
            if (isHidden) {
                menuDropdown.classList.remove('hidden');
                // Small delay to allow transition from display:none
                setTimeout(() => {
                    menuDropdown.classList.remove('opacity-0', 'scale-95');
                }, 10);
            } else {
                menuDropdown.classList.add('opacity-0', 'scale-95');
                setTimeout(() => {
                    menuDropdown.classList.add('hidden');
                }, 200);
            }
        });

        // Close when clicking outside (Capture phase to catch canvas clicks)
        // Use pointerdown to catch touch events that might be preventDefault'ed by canvas controls
        document.addEventListener('pointerdown', (e) => {
            if (menuDropdown.classList.contains('hidden')) return;

            if (!menuDropdown.contains(e.target) && !menuBtn.contains(e.target)) {
                menuDropdown.classList.add('opacity-0', 'scale-95');
                setTimeout(() => {
                    menuDropdown.classList.add('hidden');
                }, 200);
            }
        }, { capture: true });
    }




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
            // Find the icon/path to color it, or just color the button text
            if (state.freeRotation) {
                // Free Rotation (Unlocked) -> Gray/Default
                btn.classList.add('text-gray-400');
                btn.classList.remove('text-yellow-400', 'text-amber-400');

                // Update icon content if needed, but we wanted to preserve SVG.
                // Actually the SVG path differs for lock/unlock.
                // We can swap the SVG content CAREFULLY or just use opacity.
                // For now, let's keep the icon swap BUT respect the container classes.
                // The icon needs to be swapped because "Locked" has a closed padlock.

                // Simpler: Just swap the SVG path? Or the whole SVG?
                // The requirements said: "When 'Locked,' simply change the Icon Color to the accent color"
                // But we still need to visually show closed vs open padlock if we want to be correct.
                // Assuming we want to show state:

                // UNLOCKED STATE
                btn.innerHTML = `
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"></path>
                </svg>`;
                /* Note: The above path is a rough "Unlock" or "Lock". Ideally we keep the one from HTML. */

                // Let's stick to the prompt's instruction: "Remove solid background. Change Icon Color."
                // But wait, the previous code SWAPPED icons.
                // Let's rewrite innerHTML but with the NEW styling (no background classes).

                btn.innerHTML = `
                 <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                 </svg>`;
                // This is the UNLOCKED icon (shackle up)? Actually M12 15v2... 
                // Wait, the original HTML has the LOCK icon as default?
                // Let's look at the original SVG in index.html line 89: 
                // d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                // That looks like a LOCKED padlock (body + shackle down).

                // So if Free Rotation is ON (Unlocked), we should show UNLOCKED icon.
                btn.innerHTML = `
                 <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"></path>
                 </svg>`;

                btn.title = "Disable Free Rotation (Lock)";
            } else {
                // Locked State
                btn.classList.remove('text-gray-400');
                btn.classList.add('text-yellow-400');

                // Show LOCKED icon
                btn.innerHTML = `
                 <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                 </svg>`;
                btn.title = "Enable Free Rotation (Unlock)";
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


