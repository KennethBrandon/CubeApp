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

export function setupUIEventListeners() {
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    document.getElementById('btn-scramble').addEventListener('click', () => {
        gtag('event', 'scramble_click');
        startScramble();
    });
    document.getElementById('btn-reset').addEventListener('click', () => {
        gtag('event', 'reset_click');
        handleResetClick();
    });

    document.getElementById('btn-close-modal').addEventListener('click', () => {
        const modal = document.getElementById('solved-modal');
        modal.classList.add('opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 500);
    });

    document.getElementById('btn-play-again').addEventListener('click', () => {
        const modal = document.getElementById('solved-modal');
        modal.classList.add('opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
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
    document.getElementById('btn-leaderboard').addEventListener('click', () => {
        if (!state.selectedLeaderboardPuzzle) {
            let currentPuzzle;
            if (state.cubeDimensions.x === state.cubeDimensions.y && state.cubeDimensions.y === state.cubeDimensions.z) {
                currentPuzzle = state.cubeSize;
            } else {
                const dims = [state.cubeDimensions.x, state.cubeDimensions.y, state.cubeDimensions.z].sort((a, b) => b - a);
                currentPuzzle = `${dims[0]}x${dims[1]}x${dims[2]}`;
            }
            state.selectedLeaderboardPuzzle = currentPuzzle;
        }

        fetchLeaderboard(state.selectedLeaderboardPuzzle);
        updateActivePuzzleTab(state.selectedLeaderboardPuzzle);
        document.getElementById('leaderboard-modal').classList.remove('hidden');
        gtag('event', 'open_leaderboard', { puzzle: state.selectedLeaderboardPuzzle });
    });

    document.getElementById('btn-close-leaderboard').addEventListener('click', () => {
        document.getElementById('leaderboard-modal').classList.add('hidden');
    });

    // Puzzle Tab Switching
    document.querySelectorAll('.puzzle-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const puzzleSize = e.target.dataset.puzzle;
            const parsedPuzzle = puzzleSize.includes('x') ? puzzleSize : parseInt(puzzleSize);

            state.selectedLeaderboardPuzzle = parsedPuzzle;
            fetchLeaderboard(parsedPuzzle);
            updateActivePuzzleTab(parsedPuzzle);
            gtag('event', 'leaderboard_tab_click', { puzzle: parsedPuzzle });
        });
    });

    document.getElementById('btn-close-detail').addEventListener('click', () => {
        document.getElementById('detail-modal').classList.add('hidden');
    });

    let previousPuzzleSelection = '3'; // Default to 3x3

    document.getElementById('puzzle-select').addEventListener('change', (e) => {
        e.target.blur(); // Remove focus so keyboard controls work immediately
        const val = e.target.value;

        if (val === 'custom') {
            document.getElementById('custom-puzzle-panel').classList.remove('hidden');
            const backdrop = document.getElementById('custom-puzzle-backdrop');
            if (backdrop) backdrop.classList.remove('hidden');
            return;
        }

        // Hide custom panel if switching to a different puzzle
        document.getElementById('custom-puzzle-panel').classList.add('hidden');
        const backdrop = document.getElementById('custom-puzzle-backdrop');
        if (backdrop) backdrop.classList.add('hidden');

        previousPuzzleSelection = val; // Store valid selection

        let newSize = 3;
        let newDims = { x: 3, y: 3, z: 3 };
        let PuzzleClass = StandardCube;

        if (val === 'mirror') {
            newSize = 3;
            newDims = { x: 3, y: 3, z: 3 };
            PuzzleClass = MirrorCube;
        } else if (val.startsWith('mirror-')) {
            const dimsStr = val.replace('mirror-', '');
            const dims = dimsStr.split('x').map(Number);
            dims.sort((a, b) => b - a);
            newDims = { x: dims[1], y: dims[0], z: dims[2] };
            newSize = dims[0];
            PuzzleClass = MirrorCube;
        } else if (val.includes('x')) {
            const dims = val.split('x').map(Number);
            dims.sort((a, b) => b - a); // Sort descending
            // Assign largest to Y (height), then X, then Z
            newDims = { x: dims[1], y: dims[0], z: dims[2] };
            newSize = dims[0]; // Max dimension determines camera zoom roughly
        } else {
            newSize = parseInt(val);
            newDims = { x: newSize, y: newSize, z: newSize };
        }

        if (PuzzleClass === StandardCube && newDims.x === state.cubeDimensions.x && newDims.y === state.cubeDimensions.y && newDims.z === state.cubeDimensions.z && !(state.activePuzzle instanceof MirrorCube)) return;
        // If switching from Mirror to Standard 3x3, we need to proceed even if dims are same

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
            const input = document.getElementById('mirror-height-value');
            if (slider) slider.value = newHeight;
            if (input) input.value = newHeight.toFixed(1);

            // Update Active Puzzle
            state.activePuzzle = new PuzzleClass({
                dimensions: newDims
            });

            hardReset(true);

            // Mirror Cube Debug Button Visibility
            const debugRow = document.getElementById('mirror-debug-row');
            // Always show the debug row
            if (debugRow) debugRow.classList.remove('hidden');

            if (state.activePuzzle instanceof MirrorCube) {
                // Apply defaults
                const margin = parseFloat(document.getElementById('sticker-margin').value);
                const radius = parseFloat(document.getElementById('sticker-radius').value);
                state.activePuzzle.updateStickers(margin, radius);

                // Apply dimension defaults (read from sliders which have the defaults set in HTML)
                const left = parseFloat(document.getElementById('dim-left').value);
                const right = parseFloat(document.getElementById('dim-right').value);
                const bottom = parseFloat(document.getElementById('dim-bottom').value);
                const top = parseFloat(document.getElementById('dim-top').value);
                const back = parseFloat(document.getElementById('dim-back').value);
                const front = parseFloat(document.getElementById('dim-front').value);
                state.activePuzzle.updateDimensions({ left, right, bottom, top, back, front });
            }
            // Removed else block that hid the UI

            adjustCameraForCubeSize(zoomRatio);
            playCubeAnimation(true);
        });
        gtag('event', 'puzzle_change', { puzzle_type: val });
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

        function closeDragElement() {
            // Stop moving when mouse button is released:
            document.onmouseup = null;
            document.onmousemove = null;
        }
    };

    const tunerUI = document.getElementById('mirror-debug-ui');
    if (tunerUI) {
        makeDraggable(tunerUI, 'mirror-debug-header');
    }

    const customPuzzlePanel = document.getElementById('custom-puzzle-panel');
    if (customPuzzlePanel) {
        makeDraggable(customPuzzlePanel, 'custom-puzzle-header');
    }

    const fpsCounter = document.getElementById('fps-counter');
    if (fpsCounter) {
        makeDraggable(fpsCounter, 'fps-counter');
    }

    updateCustomDimension('custom-dim1', 'val-dim1');
    updateCustomDimension('custom-dim2', 'val-dim2');
    updateCustomDimension('custom-dim3', 'val-dim3');

    // Add listeners for custom dimension sliders
    ['custom-dim1', 'custom-dim2', 'custom-dim3'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                const valId = id.replace('custom-', 'val-');
                updateCustomDimension(id, valId);
                updateCustomPuzzlePreview();
            });
        }
    });

    // Update preview when checkbox changes
    document.getElementById('custom-mirror-check').addEventListener('change', updateCustomPuzzlePreview);

    function updateCustomPuzzlePreview() {
        const dim1 = parseInt(document.getElementById('custom-dim1').value);
        const dim2 = parseInt(document.getElementById('custom-dim2').value);
        const dim3 = parseInt(document.getElementById('custom-dim3').value);
        const isMirror = document.getElementById('custom-mirror-check').checked;

        // Sort dimensions descending
        const dims = [dim1, dim2, dim3].sort((a, b) => b - a);
        const newDims = { x: dims[1], y: dims[0], z: dims[2] };
        const newSize = dims[0];

        // Preserve zoom ratio
        const currentDist = state.camera.position.length();
        const minD = state.controls.minDistance;
        const maxD = state.controls.maxDistance;
        let zoomRatio = null;
        if (maxD > minD) {
            zoomRatio = (currentDist - minD) / (maxD - minD);
        }

        // Update state and puzzle WITHOUT animation
        state.cubeSize = newSize;
        state.cubeDimensions = newDims;

        const newHeight = getMirrorHeight(newSize);
        state.backMirrorHeightOffset = newHeight;

        const slider = document.getElementById('mirror-height-slider');
        const input = document.getElementById('mirror-height-value');
        if (slider) slider.value = newHeight;
        if (input) input.value = newHeight.toFixed(1);

        state.activePuzzle = isMirror ? new MirrorCube({ dimensions: newDims }) : new StandardCube({
            dimensions: newDims
        });

        hardReset(false); // No scramble
        adjustCameraForCubeSize(zoomRatio);
    }

    document.getElementById('btn-cancel-custom').addEventListener('click', () => {
        document.getElementById('custom-puzzle-panel').classList.add('hidden');
        const backdrop = document.getElementById('custom-puzzle-backdrop');
        if (backdrop) backdrop.classList.add('hidden');
        document.getElementById('puzzle-select').value = previousPuzzleSelection;

        // Revert to the previous puzzle selection
        const val = previousPuzzleSelection;
        let newSize = 3;
        let newDims = { x: 3, y: 3, z: 3 };

        if (val.includes('x')) {
            const dims = val.split('x').map(Number);
            dims.sort((a, b) => b - a);
            newDims = { x: dims[1], y: dims[0], z: dims[2] };
            newSize = dims[0];
        } else {
            newSize = parseInt(val);
            newDims = { x: newSize, y: newSize, z: newSize };
        }

        const currentDist = state.camera.position.length();
        const minD = state.controls.minDistance;
        const maxD = state.controls.maxDistance;
        let zoomRatio = null;
        if (maxD > minD) {
            zoomRatio = (currentDist - minD) / (maxD - minD);
        }

        state.cubeSize = newSize;
        state.cubeDimensions = newDims;
        const newHeight = getMirrorHeight(newSize);
        state.backMirrorHeightOffset = newHeight;

        const slider = document.getElementById('mirror-height-slider');
        const input = document.getElementById('mirror-height-value');
        if (slider) slider.value = newHeight;
        if (input) input.value = newHeight.toFixed(1);

        state.activePuzzle = new StandardCube({
            dimensions: newDims
        });

        hardReset(false);
        adjustCameraForCubeSize(zoomRatio);
    });

    document.getElementById('btn-submit-custom').addEventListener('click', () => {
        const dim1 = parseInt(document.getElementById('custom-dim1').value);
        const dim2 = parseInt(document.getElementById('custom-dim2').value);
        const dim3 = parseInt(document.getElementById('custom-dim3').value);
        const isMirror = document.getElementById('custom-mirror-check').checked;

        document.getElementById('custom-puzzle-panel').classList.add('hidden');
        const backdrop = document.getElementById('custom-puzzle-backdrop');
        if (backdrop) backdrop.classList.add('hidden');

        // Sort dimensions for consistency
        const dims = [dim1, dim2, dim3].sort((a, b) => b - a);
        const puzzleCode = `${dims[0]}x${dims[1]}x${dims[2]}`;
        const newDims = { x: dims[1], y: dims[0], z: dims[2] };
        const newSize = dims[0];

        // Update dropdown
        const select = document.getElementById('puzzle-select');
        let optionExists = false;

        const isCube = dims[0] === dims[1] && dims[1] === dims[2];
        const simpleCode = isCube ? dims[0].toString() : null;

        // Helper to get sorted dims string from value
        const getSortedDimsStr = (val) => {
            if (!val || val === 'custom') return null;
            if (val.includes('x')) {
                return val.split('x').map(Number).sort((a, b) => b - a).join('x');
            }
            const n = parseInt(val);
            return !isNaN(n) ? `${n}x${n}x${n}` : null;
        };

        const targetSorted = dims.join('x'); // dims is already sorted descending

        // Determine target value for the option
        let targetValue = puzzleCode;
        if (isMirror) {
            if (puzzleCode === '3x3x3') targetValue = 'mirror';
            else targetValue = `mirror-${puzzleCode}`;
        }

        for (let i = 0; i < select.options.length; i++) {
            const optVal = select.options[i].value;
            if (optVal === 'custom') continue;

            // Check for exact match with targetValue
            if (optVal === targetValue) {
                select.selectedIndex = i;
                optionExists = true;
                break;
            }

            // For Standard Cubes: Check for simple code match (e.g. '3' for '3x3x3')
            if (!isMirror && simpleCode && optVal === simpleCode) {
                select.selectedIndex = i;
                optionExists = true;
                break;
            }

            // For Standard Cubes: Check for permutation match (e.g. '2x3x4' vs '4x3x2')
            if (!isMirror && optVal.includes('x') && !optVal.startsWith('mirror-')) {
                const optSorted = getSortedDimsStr(optVal);
                if (optSorted === targetSorted) {
                    select.selectedIndex = i;
                    optionExists = true;
                    break;
                }
            }

            // For Mirror Cubes: Check for permutation match with prefix
            if (isMirror && optVal.startsWith('mirror-')) {
                const optDimsStr = optVal.replace('mirror-', '');
                const optSorted = getSortedDimsStr(optDimsStr);
                if (optSorted === targetSorted) {
                    select.selectedIndex = i;
                    optionExists = true;
                    break;
                }
            }
        }

        if (!optionExists) {
            const newOption = document.createElement('option');
            newOption.value = targetValue;
            newOption.textContent = `${puzzleCode} ${isMirror ? 'Mirror ' : ''}Cube`;

            const customOption = select.querySelector('option[value="custom"]');
            select.insertBefore(newOption, customOption);
            select.value = targetValue;
        }

        previousPuzzleSelection = puzzleCode;

        const currentDist = state.camera.position.length();
        const minD = state.controls.minDistance;
        const maxD = state.controls.maxDistance;
        let zoomRatio = null;
        if (maxD > minD) {
            zoomRatio = (currentDist - minD) / (maxD - minD);
        }

        // Play spin animation on submit
        playCubeAnimation(false, () => {
            state.cubeSize = newSize;
            state.cubeDimensions = newDims;

            const newHeight = getMirrorHeight(newSize);
            state.backMirrorHeightOffset = newHeight;

            const slider = document.getElementById('mirror-height-slider');
            const input = document.getElementById('mirror-height-value');
            if (slider) slider.value = newHeight;
            if (input) input.value = newHeight.toFixed(1);

            state.activePuzzle = isMirror ? new MirrorCube({ dimensions: newDims }) : new StandardCube({
                dimensions: newDims
            });

            hardReset(true);
            adjustCameraForCubeSize(zoomRatio);
            playCubeAnimation(true, null, false);
        }, false);
        gtag('event', 'custom_puzzle_create', { puzzle_def: puzzleCode });
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
            document.getElementById('debug-modal').classList.remove('hidden');
            gtag('event', 'open_debug_sequence');
            state.debugSequenceCount = 0;
            lastDebugButton = null;
        }
    }

    document.getElementById('btn-close-debug').addEventListener('click', () => {
        document.getElementById('debug-modal').classList.add('hidden');
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
        const container = document.getElementById('floating-controls');

        if (zoomVisible || mirrorVisible) {
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
    };

    document.getElementById('toggle-zoom-bar').addEventListener('change', (e) => {
        updateFloatingControlsVisibility();
        gtag('event', 'toggle_controls_ui', { control: 'zoom', state: e.target.checked ? 'on' : 'off' });
    });
    document.getElementById('toggle-mirror-slider').addEventListener('change', (e) => {
        updateFloatingControlsVisibility();
        gtag('event', 'toggle_controls_ui', { control: 'mirror', state: e.target.checked ? 'on' : 'off' });
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
        document.getElementById('debug-modal').classList.add('hidden');
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
            document.getElementById('debug-modal').classList.add('hidden');

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

    document.getElementById('btn-submit-score').addEventListener('click', () => {
        const nameInput = document.getElementById('player-name');
        const name = nameInput.value.trim();
        if (!name) {
            alert("Please enter a name!");
            return;
        }
        const timeStr = document.getElementById('final-time').textContent;
        const scramble = state.scrambleSequence.join(" ");
        const solution = state.moveHistory.join(" ");

        submitScore(name, state.finalTimeMs, timeStr, scramble, solution);
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


