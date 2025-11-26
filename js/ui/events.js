import { state } from '../shared/state.js';
import { startScramble, handleResetClick, hardReset } from '../game/scramble.js';
import { toggleMirrors, updateBackMirrorHeight, getMirrorHeight } from '../core/environment.js';
import { playSolveAnimation, animateVictory } from '../animations/victory.js';
import { showWinModal, togglePanel, openDetailModal, updateHistoryUI, updateActivePuzzleTab } from './ui.js';
import { submitScore, fetchLeaderboard } from '../leaderboard/firebase.js';
import { playCubeAnimation } from '../animations/transitions.js';
import { adjustCameraForCubeSize } from '../core/controls.js';
import { onWindowResize, updateZoomDisplay } from '../core/scene.js';
import { onKeyDown, onKeyUp } from '../game/moves.js';
import { soundManager } from '../core/sound.js';
import { StandardCube } from '../puzzles/StandardCube.js';

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
            return;
        }

        // Hide custom panel if switching to a different puzzle
        document.getElementById('custom-puzzle-panel').classList.add('hidden');

        previousPuzzleSelection = val; // Store valid selection

        let newSize = 3;
        let newDims = { x: 3, y: 3, z: 3 };

        if (val.includes('x')) {
            const dims = val.split('x').map(Number);
            dims.sort((a, b) => b - a); // Sort descending
            // Assign largest to Y (height), then X, then Z
            newDims = { x: dims[1], y: dims[0], z: dims[2] };
            newSize = dims[0]; // Max dimension determines camera zoom roughly
        } else {
            newSize = parseInt(val);
            newDims = { x: newSize, y: newSize, z: newSize };
        }

        if (newDims.x === state.cubeDimensions.x && newDims.y === state.cubeDimensions.y && newDims.z === state.cubeDimensions.z) return;

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
            state.activePuzzle = new StandardCube({
                dimensions: newDims
            });

            hardReset(true);
            adjustCameraForCubeSize(zoomRatio);
            playCubeAnimation(true);
        });
        gtag('event', 'puzzle_change', { puzzle_type: val });
    });

    // Custom Puzzle Panel Logic - Live Preview
    const updateCustomDimension = (id, valId) => {
        const el = document.getElementById(id);
        const valEl = document.getElementById(valId);
        el.addEventListener('input', (e) => {
            valEl.textContent = e.target.value;
            // Live preview: update puzzle immediately without animation
            updateCustomPuzzlePreview();
        });
    };
    updateCustomDimension('custom-dim1', 'val-dim1');
    updateCustomDimension('custom-dim2', 'val-dim2');
    updateCustomDimension('custom-dim3', 'val-dim3');

    function updateCustomPuzzlePreview() {
        const dim1 = parseInt(document.getElementById('custom-dim1').value);
        const dim2 = parseInt(document.getElementById('custom-dim2').value);
        const dim3 = parseInt(document.getElementById('custom-dim3').value);

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

        state.activePuzzle = new StandardCube({
            dimensions: newDims
        });

        hardReset(false); // No scramble
        adjustCameraForCubeSize(zoomRatio);
    }

    document.getElementById('btn-cancel-custom').addEventListener('click', () => {
        document.getElementById('custom-puzzle-panel').classList.add('hidden');
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

        document.getElementById('custom-puzzle-panel').classList.add('hidden');

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

        for (let i = 0; i < select.options.length; i++) {
            const optVal = select.options[i].value;
            if (optVal === 'custom') continue;

            // Direct match
            if (optVal === puzzleCode || (simpleCode && optVal === simpleCode)) {
                select.selectedIndex = i;
                optionExists = true;
                break;
            }

            // Permutation match
            const optSorted = getSortedDimsStr(optVal);
            if (optSorted === targetSorted) {
                select.selectedIndex = i;
                optionExists = true;
                break;
            }
        }

        if (!optionExists) {
            const newOption = document.createElement('option');
            newOption.value = puzzleCode;
            newOption.textContent = `${puzzleCode} Cube`;

            const customOption = select.querySelector('option[value="custom"]');
            select.insertBefore(newOption, customOption);
            select.value = puzzleCode;
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

            state.activePuzzle = new StandardCube({
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
    });

    // Debug Menu Cheat Code
    const secretCode = 'debug';
    let inputSequence = '';

    window.addEventListener('keydown', (e) => {
        // Ignore if typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        inputSequence += e.key.toLowerCase();
        if (inputSequence.length > secretCode.length) {
            inputSequence = inputSequence.slice(-secretCode.length);
        }
        if (inputSequence === secretCode) {
            document.getElementById('debug-modal').classList.remove('hidden');
            gtag('event', 'open_debug_cheat');
            inputSequence = '';
        }
    });

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


