import { state } from '../shared/state.js';
import { enableDebugButton } from './ui.js';
import { showDebugMenu } from './components/DebugMenu.js';
import { showLeaderboard } from './components/LeaderboardModal.js';
import { startScramble, handleResetClick, hardReset } from '../game/scramble.js';
import { toggleMirrors } from '../core/environment.js';
import { playSolveAnimation, animateVictory } from '../animations/victory.js';

import { showWinModal, togglePanel, openDetailModal, updateHistoryUI, updateActivePuzzleTab, initHistoryWindow, toggleDrawer } from './ui.js';
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

    // Sound Toggle (Drawer)
    const btnDrawerSound = document.getElementById('btn-drawer-sound');
    if (btnDrawerSound) {
        updateSoundButton(); // Initial state
        btnDrawerSound.addEventListener('click', () => {
            soundManager.toggleMute();
            updateSoundButton();
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
    // Leaderboard (Drawer)
    document.getElementById('btn-drawer-leaderboard')?.addEventListener('click', () => {
        toggleDrawer(false);
        setTimeout(() => showLeaderboard(), 300);
        gtag('event', 'open_leaderboard');
    });

    document.getElementById('btn-close-detail').addEventListener('click', () => {
        overlayManager.close();
    });

    // Initialize Draggable Windows
    initHistoryWindow();

    // Menu Item: History
    // History (Drawer)
    document.getElementById('btn-drawer-history')?.addEventListener('click', () => {
        toggleDrawer(false);
        const win = document.getElementById('history-window');
        if (win) {
            win.classList.remove('hidden');
        }
        gtag('event', 'toggle_history_window');
    });


    // About (Drawer)
    document.getElementById('btn-drawer-about')?.addEventListener('click', () => {
        toggleDrawer(false);
        overlayManager.open('about-modal');
        gtag('event', 'open_about_modal');
    });

    // Handle External Links (e.g. Grinch Credit)
    document.getElementById('link-grinch-credit')?.addEventListener('click', (e) => {
        // If in Capacitor/Mobile, force open in system browser
        if (window.Capacitor) {
            e.preventDefault();
            window.open(e.target.href, '_system');
        }
        gtag('event', 'click_external_link', { url: e.target.href });
    });

    // Side Drawer Logic
    const btnMenu = document.getElementById('btn-main-menu-toggle');
    const btnCloseDrawer = document.getElementById('btn-close-drawer');
    const drawerBackdrop = document.getElementById('side-drawer-backdrop');

    if (btnMenu) {
        btnMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDrawer(true);
        });
    }

    if (btnCloseDrawer) {
        btnCloseDrawer.addEventListener('click', () => {
            toggleDrawer(false);
        });
    }

    if (drawerBackdrop) {
        drawerBackdrop.addEventListener('click', () => {
            toggleDrawer(false);
        });
    }




    // Mirror Toggle (Drawer)
    const updateMirrorUI = () => {
        const bg = document.getElementById('drawer-mirror-toggle-bg');
        const dot = document.getElementById('drawer-mirror-toggle-dot');
        if (state.showMirrors) {
            if (bg) { bg.classList.remove('bg-gray-600'); bg.classList.add('bg-purple-600'); }
            if (dot) { dot.classList.remove('left-1'); dot.classList.add('left-5'); }
        } else {
            if (bg) { bg.classList.remove('bg-purple-600'); bg.classList.add('bg-gray-600'); }
            if (dot) { dot.classList.remove('left-5'); dot.classList.add('left-1'); }
        }
    };
    // Init state
    updateMirrorUI();

    document.getElementById('btn-drawer-mirror')?.addEventListener('click', () => {
        const newState = !state.showMirrors;
        toggleMirrors(newState);
        updateMirrorUI();
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
                    showLeaderboard();
                }, 100);
            }
        } finally {
            // Re-enable button in all cases (success or failure)
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    });
}

export function updateSoundButton(unusedBtn) {
    // We ignore the passed button because we now target specific IDs in the drawer

    const icon = document.getElementById('drawer-sound-icon');
    const bg = document.getElementById('drawer-sound-toggle-bg');
    const dot = document.getElementById('drawer-sound-toggle-dot');

    // Also update any other sound indicators if they exist

    if (soundManager.isMuted) {
        if (icon) icon.textContent = '🔇';
        if (bg) {
            bg.classList.remove('bg-green-600');
            bg.classList.add('bg-gray-600');
        }
        if (dot) {
            dot.style.transform = 'translateX(0px)';
            dot.classList.remove('left-5');
            dot.classList.add('left-1');
        }
    } else {
        if (icon) icon.textContent = '🔊';
        if (bg) {
            bg.classList.remove('bg-gray-600');
            bg.classList.add('bg-green-600');
        }
        if (dot) {
            dot.style.transform = 'translateX(0px)'; // logic handled by class usually
            dot.classList.remove('left-1');
            dot.classList.add('left-5');
        }
    }
}
