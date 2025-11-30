import { state } from '../shared/state.js';
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

export function setupUIEventListeners() {
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    setupPuzzleSelector();

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

    document.getElementById('btn-play-again').addEventListener('click', () => {
        overlayManager.close();
        setTimeout(() => {
            hardReset(true);
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
    setupLeaderboardUI();

    document.getElementById('btn-leaderboard').addEventListener('click', () => {
        openLeaderboardModal();
        gtag('event', 'open_leaderboard');
    });

    document.getElementById('btn-close-leaderboard').addEventListener('click', () => {
        overlayManager.close();
    });

    document.getElementById('btn-close-detail').addEventListener('click', () => {
        overlayManager.close();
    });



    // Mirror Cube Debug UI Listeners
    const updateMirrorStickers = () => {
        if (state.activePuzzle instanceof MirrorCube) {
            const margin = parseFloat(document.getElementById('sticker-margin').value);
            const radius = parseFloat(document.getElementById('sticker-radius').value);
            document.getElementById('margin-val').textContent = margin.toFixed(3);
            document.getElementById('radius-val').textContent = radius.toFixed(3);
            state.activePuzzle.updateStickers(margin, radius);
        }
    };

    const marginSlider = document.getElementById('sticker-margin');
    const radiusSlider = document.getElementById('sticker-radius');
    if (marginSlider) marginSlider.addEventListener('input', updateMirrorStickers);
    if (radiusSlider) radiusSlider.addEventListener('input', updateMirrorStickers);

    // Toggle Switch
    document.getElementById('toggle-sticker-tuner').addEventListener('change', (e) => {
        const ui = document.getElementById('mirror-debug-ui');
        if (ui) {
            if (e.target.checked) {
                ui.classList.remove('hidden');
            } else {
                ui.classList.add('hidden');
            }
        }
    });

    // Close Button (on the UI itself)
    document.getElementById('close-sticker-tuner').addEventListener('click', () => {
        const ui = document.getElementById('mirror-debug-ui');
        if (ui) ui.classList.add('hidden');
        // Also uncheck the toggle
        const toggle = document.getElementById('toggle-sticker-tuner');
        if (toggle) toggle.checked = false;
    });

    // Dimension Tuner Listeners
    const updateMirrorDimensions = () => {
        if (state.activePuzzle instanceof MirrorCube) {
            const left = parseFloat(document.getElementById('dim-left').value);
            const right = parseFloat(document.getElementById('dim-right').value);
            const bottom = parseFloat(document.getElementById('dim-bottom').value);
            const top = parseFloat(document.getElementById('dim-top').value);
            const back = parseFloat(document.getElementById('dim-back').value);
            const front = parseFloat(document.getElementById('dim-front').value);

            document.getElementById('val-left').textContent = left.toFixed(1);
            document.getElementById('val-right').textContent = right.toFixed(1);
            document.getElementById('val-bottom').textContent = bottom.toFixed(1);
            document.getElementById('val-top').textContent = top.toFixed(1);
            document.getElementById('val-back').textContent = back.toFixed(1);
            document.getElementById('val-front').textContent = front.toFixed(1);

            state.activePuzzle.updateDimensions({ left, right, bottom, top, back, front });
        }
    };

    ['dim-left', 'dim-right', 'dim-bottom', 'dim-top', 'dim-back', 'dim-front'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateMirrorDimensions);
    });

    // Reset Defaults Button
    const btnResetDefaults = document.getElementById('btn-reset-mirror-defaults');
    if (btnResetDefaults) {
        btnResetDefaults.addEventListener('click', () => {
            // Defaults: Left 1.4, Right 1.6, Bottom 2.2, Top 0.8, Back 1.1, Front 1.9
            const defaults = {
                'dim-left': 1.4,
                'dim-right': 1.6,
                'dim-bottom': 2.2,
                'dim-top': 0.8,
                'dim-back': 1.1,
                'dim-front': 1.9
            };

            for (const [id, val] of Object.entries(defaults)) {
                const el = document.getElementById(id);
                if (el) {
                    el.value = val;
                    // Trigger input event to update display and cube
                    el.dispatchEvent(new Event('input'));
                }
            }
        });
    }

    // Material Property Listeners
    const updateMirrorMaterials = () => {
        if (state.activePuzzle instanceof MirrorCube && state.activePuzzle.stickers) {
            const metalness = parseFloat(document.getElementById('material-metalness').value);
            const roughness = parseFloat(document.getElementById('material-roughness').value);
            const normalIntensity = parseFloat(document.getElementById('normal-intensity').value);
            const sparkleEnabled = document.getElementById('toggle-sparkle-texture').checked;

            // Update display values
            document.getElementById('metalness-val').textContent = metalness.toFixed(2);
            document.getElementById('roughness-val').textContent = roughness.toFixed(2);
            document.getElementById('normal-intensity-val').textContent = normalIntensity.toFixed(2);

            // Update all sticker materials
            state.activePuzzle.stickers.forEach(sticker => {
                if (sticker.material) {
                    sticker.material.metalness = metalness;
                    sticker.material.roughness = roughness;
                    sticker.material.normalMap = sparkleEnabled ? state.activePuzzle.sparkleMap : null;
                    sticker.material.normalScale.set(normalIntensity, normalIntensity);
                    sticker.material.needsUpdate = true;
                }
            });
        }
    };

    const metalnessSlider = document.getElementById('material-metalness');
    const roughnessSlider = document.getElementById('material-roughness');
    const normalIntensitySlider = document.getElementById('normal-intensity');
    const sparkleToggle = document.getElementById('toggle-sparkle-texture');

    if (metalnessSlider) metalnessSlider.addEventListener('input', updateMirrorMaterials);
    if (roughnessSlider) roughnessSlider.addEventListener('input', updateMirrorMaterials);
    if (normalIntensitySlider) normalIntensitySlider.addEventListener('input', updateMirrorMaterials);
    if (sparkleToggle) sparkleToggle.addEventListener('change', updateMirrorMaterials);


    // Custom Puzzle Panel Logic - Live Preview
    const updateCustomDimension = (id, valId) => {
        const el = document.getElementById(id);
        const valEl = document.getElementById(valId);
        if (el && valEl) {
            valEl.textContent = el.value;
        }
    };

    ['custom-x', 'custom-y', 'custom-z'].forEach(axis => {
        const id = `dim-${axis}`; // wait, these IDs are for the custom puzzle creator, not mirror tuner
        // The custom puzzle creator uses 'custom-x', 'custom-y', 'custom-z' inputs?
        // Let's check index.html... ah, 'custom-puzzle-input' is a text input.
        // There are no sliders for custom puzzle creator dimensions in the code I saw earlier.
        // The code I'm replacing seems to be a placeholder or I misread the context.
        // Let's just insert the drag logic here.
    });

    // Drag Logic for Mirror Tuner & Custom Puzzle
    const makeDraggable = (elmnt, handleId) => {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const header = document.getElementById(handleId);

        // Use header if found, otherwise fallback to element
        const dragTarget = header || elmnt;

        dragTarget.onmousedown = dragMouseDown;
        dragTarget.ontouchstart = dragTouchStart;

        function dragMouseDown(e) {
            e = e || window.event;

            // Allow interaction with inputs, buttons, and sliders
            if (['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'LABEL'].includes(e.target.tagName)) {
                return;
            }

            e.preventDefault();
            // Get the mouse cursor position at startup:
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function dragTouchStart(e) {
            // Allow interaction with inputs, buttons, and sliders
            if (['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'LABEL'].includes(e.target.tagName)) {
                return;
            }

            // e.preventDefault(); // Don't prevent default immediately, might want to click
            // Actually for dragging a modal, we usually want to prevent scroll
            if (e.cancelable) e.preventDefault();

            const touch = e.touches[0];
            pos3 = touch.clientX;
            pos4 = touch.clientY;

            document.ontouchend = closeDragElement;
            document.ontouchmove = elementTouchDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            // Calculate the new cursor position:
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            // Set the element's new position:
            elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
            elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
            // Clear right/bottom to allow free movement if they were set
            elmnt.style.right = 'auto';
            elmnt.style.bottom = 'auto';
        }

        function elementTouchDrag(e) {
            if (e.cancelable) e.preventDefault();
            const touch = e.touches[0];

            // Calculate the new cursor position:
            pos1 = pos3 - touch.clientX;
            pos2 = pos4 - touch.clientY;
            pos3 = touch.clientX;
            pos4 = touch.clientY;

            // Set the element's new position:
            elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
            elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
            elmnt.style.right = 'auto';
            elmnt.style.bottom = 'auto';
        }

        function closeDragElement() {
            // Stop moving when mouse button is released:
            document.onmouseup = null;
            document.onmousemove = null;
            document.ontouchend = null;
            document.ontouchmove = null;
        }
    };

    const tunerUI = document.getElementById('mirror-debug-ui');
    if (tunerUI) {
        makeDraggable(tunerUI, 'mirror-debug-header');
    }

    const cubeTunerUI = document.getElementById('cube-tuner-ui');
    if (cubeTunerUI) {
        makeDraggable(cubeTunerUI, 'cube-tuner-header');
    }

    const molecubeTunerUI = document.getElementById('molecube-tuner-ui');
    if (molecubeTunerUI) {
        makeDraggable(molecubeTunerUI, 'molecube-tuner-header');
    }



    const fpsCounter = document.getElementById('fps-counter');
    if (fpsCounter) {
        makeDraggable(fpsCounter, 'fps-counter');
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
            overlayManager.open('debug-modal');
            gtag('event', 'open_debug_sequence');
            state.debugSequenceCount = 0;
            lastDebugButton = null;
        }
    }

    document.getElementById('btn-close-debug').addEventListener('click', () => {
        overlayManager.close();
    });

    document.getElementById('speed-slider').addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        state.animationSpeed = val;
        document.getElementById('speed-value').textContent = val;
    });

    document.getElementById('toggle-fps').addEventListener('change', (e) => {
        const fpsCounter = document.getElementById('fps-counter');
        if (e.target.checked) {
            fpsCounter.classList.remove('hidden');
        } else {
            fpsCounter.classList.add('hidden');
        }
    });

    const updateFloatingControlsVisibility = () => {
        const zoomVisible = document.getElementById('toggle-zoom-bar').checked;
        const mirrorVisible = document.getElementById('toggle-mirror-slider').checked;
        // const radiusVisible = document.getElementById('toggle-radius-slider').checked;
        const radiusVisible = false; // Deprecated
        const container = document.getElementById('floating-controls');

        if (zoomVisible || mirrorVisible || radiusVisible) {
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }

        if (zoomVisible) {
            document.getElementById('zoom-controls').classList.remove('hidden');
            updateZoomDisplay();
        } else {
            document.getElementById('zoom-controls').classList.add('hidden');
        }

        if (mirrorVisible) {
            document.getElementById('mirror-controls').classList.remove('hidden');
        } else {
            document.getElementById('mirror-controls').classList.add('hidden');
        }

        if (radiusVisible) {
            // document.getElementById('radius-controls').classList.remove('hidden');
        } else {
            // document.getElementById('radius-controls').classList.add('hidden');
        }
    };

    document.getElementById('toggle-zoom-bar').addEventListener('change', (e) => {
        updateFloatingControlsVisibility();
        gtag('event', 'toggle_controls_ui', { control: 'zoom', state: e.target.checked ? 'on' : 'off' });
    });
    document.getElementById('toggle-mirror-slider').addEventListener('change', (e) => {
        updateFloatingControlsVisibility();
        gtag('event', 'toggle_controls_ui', { control: 'mirror', state: e.target.checked ? 'on' : 'off' });
    });

    // Cube Tuner Toggle
    document.getElementById('toggle-cube-tuner').addEventListener('change', (e) => {
        const ui = document.getElementById('cube-tuner-ui');
        if (ui) {
            if (e.target.checked) {
                ui.classList.remove('hidden');
            } else {
                ui.classList.add('hidden');
            }
        }
        gtag('event', 'toggle_cube_tuner', { state: e.target.checked ? 'on' : 'off' });
    });

    document.getElementById('close-cube-tuner').addEventListener('click', () => {
        const ui = document.getElementById('cube-tuner-ui');
        if (ui) ui.classList.add('hidden');
        const toggle = document.getElementById('toggle-cube-tuner');
        if (toggle) toggle.checked = false;
    });

    // Cube Tuner Sliders
    const updateCubeTuner = () => {
        if (!state.activePuzzle) return;

        const cubieRadius = parseFloat(document.getElementById('cubie-radius-slider').value);
        const cubieGap = parseFloat(document.getElementById('cubie-gap-slider').value);
        const stickerSize = parseFloat(document.getElementById('sticker-size-slider').value);
        const stickerRadius = parseFloat(document.getElementById('sticker-radius-slider').value);

        document.getElementById('cubie-radius-val').textContent = cubieRadius.toFixed(3);
        document.getElementById('cubie-gap-val').textContent = cubieGap.toFixed(3);
        document.getElementById('sticker-size-val').textContent = stickerSize.toFixed(3);
        document.getElementById('sticker-radius-val').textContent = stickerRadius.toFixed(3);

        if (state.activePuzzle.updateRadius) state.activePuzzle.updateRadius(cubieRadius);
        if (state.activePuzzle.updateSpacing) state.activePuzzle.updateSpacing(cubieGap);
        if (state.activePuzzle.updateStickers) state.activePuzzle.updateStickers(stickerSize, stickerRadius);
    };

    ['cubie-radius-slider', 'cubie-gap-slider', 'sticker-size-slider', 'sticker-radius-slider'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateCubeTuner);
    });

    document.getElementById('btn-reset-tuner-defaults').addEventListener('click', () => {
        // Defaults
        const defaults = {
            'cubie-radius-slider': 0.074,
            'cubie-gap-slider': 0.004,
            'sticker-size-slider': 0.800,
            'sticker-radius-slider': 0.200
        };

        for (const [id, val] of Object.entries(defaults)) {
            const el = document.getElementById(id);
            if (el) {
                el.value = val;
                el.dispatchEvent(new Event('input'));
            }
        }
    });

    // Molecube Tuner Toggle
    document.getElementById('toggle-molecube-tuner').addEventListener('change', (e) => {
        const ui = document.getElementById('molecube-tuner-ui');
        if (ui) {
            if (e.target.checked) {
                ui.classList.remove('hidden');
            } else {
                ui.classList.add('hidden');
            }
        }
        gtag('event', 'toggle_molecube_tuner', { state: e.target.checked ? 'on' : 'off' });
    });

    document.getElementById('close-molecube-tuner').addEventListener('click', () => {
        const ui = document.getElementById('molecube-tuner-ui');
        if (ui) ui.classList.add('hidden');
        const toggle = document.getElementById('toggle-molecube-tuner');
        if (toggle) toggle.checked = false;
    });

    // Molecube Tuner Sliders
    const updateMolecubeTuner = () => {
        if (!state.activePuzzle) return;

        const ballSize = parseFloat(document.getElementById('molecube-ball-size-slider').value);
        const cylinderSize = parseFloat(document.getElementById('molecube-cylinder-size-slider').value);
        const spacing = parseFloat(document.getElementById('molecube-spacing-slider').value);

        document.getElementById('molecube-ball-size-val').textContent = ballSize.toFixed(3);
        document.getElementById('molecube-cylinder-size-val').textContent = cylinderSize.toFixed(3);
        document.getElementById('molecube-spacing-val').textContent = spacing.toFixed(3);

        if (state.activePuzzle.updateMolecubeParams) {
            state.activePuzzle.updateMolecubeParams({ ballSize, cylinderSize, spacing });
        }
    };

    ['molecube-ball-size-slider', 'molecube-cylinder-size-slider', 'molecube-spacing-slider'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateMolecubeTuner);
    });

    document.getElementById('btn-reset-molecube-defaults').addEventListener('click', () => {
        // Defaults
        const defaults = {
            'molecube-ball-size-slider': 0.500,
            'molecube-cylinder-size-slider': 0.300,
            'molecube-spacing-slider': 0.020
        };

        for (const [id, val] of Object.entries(defaults)) {
            const el = document.getElementById(id);
            if (el) {
                el.value = val;
                el.dispatchEvent(new Event('input'));
            }
        }
    });

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

    document.getElementById('toggle-free-rotation').addEventListener('change', (e) => {
        state.freeRotation = e.target.checked;
        updateAxisLockButton();
        if (!state.freeRotation) {
            animateWrapperReset();
        }
        gtag('event', 'toggle_free_rotation', { state: e.target.checked ? 'on' : 'off' });
    });

    // Initialize button state
    updateAxisLockButton();

    document.getElementById('btn-test-victory').addEventListener('click', () => {
        overlayManager.close();
        setTimeout(() => {
            animateVictory();
        }, 1000);
        gtag('event', 'test_victory');
    });

    document.getElementById('btn-create-custom-puzzle').addEventListener('click', () => {
        const input = document.getElementById('custom-puzzle-input');
        const val = input.value.trim();
        let newSize = 3;
        let newDims = { x: 3, y: 3, z: 3 };

        try {
            if (val.includes('x')) {
                const dims = val.split('x').map(n => parseInt(n.trim()));
                if (dims.length !== 3 || dims.some(isNaN)) throw new Error("Invalid format");

                // Sort descending like the select handler
                const sortedDims = [...dims].sort((a, b) => b - a);
                newDims = { x: sortedDims[1], y: sortedDims[0], z: sortedDims[2] };
                newSize = sortedDims[0];
            } else {
                const size = parseInt(val);
                if (isNaN(size)) throw new Error("Invalid number");
                newSize = size;
                newDims = { x: newSize, y: newSize, z: newSize };
            }

            // Close debug modal
            overlayManager.close();

            const currentDist = state.camera.position.length();
            const minD = state.controls.minDistance;
            const maxD = state.controls.maxDistance;
            let zoomRatio = null;
            if (maxD > minD) {
                zoomRatio = (currentDist - minD) / (maxD - minD);
            }

            playCubeAnimation(false, () => {
                state.cubeSize = newSize;
                state.cubeDimensions = newDims;

                // Update mirror height based on new size
                const newHeight = getMirrorHeight(newSize);
                state.backMirrorHeightOffset = newHeight;

                // Update UI controls
                const slider = document.getElementById('mirror-height-slider');
                const heightInput = document.getElementById('mirror-height-value');
                if (slider) slider.value = newHeight;
                if (heightInput) heightInput.value = newHeight.toFixed(1);

                // Update Active Puzzle
                state.activePuzzle = new StandardCube({
                    dimensions: newDims
                });

                hardReset(true);
                adjustCameraForCubeSize(zoomRatio);
                playCubeAnimation(true);
            });
            gtag('event', 'custom_puzzle_create', { puzzle_def: val });

        } catch (e) {
            alert("Invalid format! Use N or NxNxN (e.g. 5 or 2x3x4)");
        }
    });

    document.getElementById('zoom-slider').addEventListener('input', (e) => {
        const distance = parseFloat(e.target.value);
        const direction = state.camera.position.clone().normalize();
        state.camera.position.copy(direction.multiplyScalar(distance));
        updateZoomDisplay();
    });

    document.getElementById('zoom-value-input').addEventListener('change', (e) => {
        let value = parseFloat(e.target.value);
        const currentDistance = state.camera.position.length();
        if (isNaN(value)) value = currentDistance;
        value = Math.max(state.controls.minDistance, Math.min(state.controls.maxDistance, value));
        const direction = state.camera.position.clone().normalize();
        state.camera.position.copy(direction.multiplyScalar(value));
        document.getElementById('zoom-slider').value = value;
        updateZoomDisplay();
    });

    document.getElementById('mirror-height-slider').addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        updateBackMirrorHeight(value);
        document.getElementById('mirror-height-value').value = value.toFixed(1);
    });

    document.getElementById('mirror-height-value').addEventListener('change', (e) => {
        let value = parseFloat(e.target.value);
        if (isNaN(value)) value = 0;
        value = Math.max(-10, Math.min(10, value)); // Clamp to slider range
        updateBackMirrorHeight(value);
        document.getElementById('mirror-height-slider').value = value;
        e.target.value = value.toFixed(1);
    });

    document.getElementById('btn-submit-score').addEventListener('click', async () => {
        const nameInput = document.getElementById('player-name');
        const name = nameInput.value.trim();
        if (!name) {
            alert("Please enter a name!");
            return;
        }
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


