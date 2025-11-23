import { state } from '../shared/state.js';
import { startScramble, handleResetClick, hardReset } from '../game/scramble.js';
import { toggleMirrors, updateBackMirrorHeight, getMirrorHeight } from '../core/environment.js';
import { playSolveAnimation, animateVictory } from '../animations/victory.js';
import { showWinModal, togglePanel, openDetailModal, updateHistoryUI } from './ui.js';
import { submitScore, fetchLeaderboard } from '../leaderboard/firebase.js';
import { playCubeAnimation } from '../animations/transitions.js';
import { adjustCameraForCubeSize } from '../core/controls.js';
import { onWindowResize, updateZoomDisplay } from '../core/scene.js';
import { onKeyDown } from '../game/moves.js';

export function setupUIEventListeners() {
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', onKeyDown);

    document.getElementById('btn-scramble').addEventListener('click', startScramble);
    document.getElementById('btn-reset').addEventListener('click', handleResetClick);

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

    // Leaderboard Listeners
    document.getElementById('btn-leaderboard').addEventListener('click', () => {
        if (!state.selectedLeaderboardPuzzle) {
            const currentPuzzle = state.cubeDimensions.x === state.cubeDimensions.y && state.cubeDimensions.y === state.cubeDimensions.z
                ? state.cubeSize
                : `${state.cubeDimensions.x}x${state.cubeDimensions.y}x${state.cubeDimensions.z}`;
            state.selectedLeaderboardPuzzle = currentPuzzle;
        }

        fetchLeaderboard(state.selectedLeaderboardPuzzle);
        updateActivePuzzleTab(state.selectedLeaderboardPuzzle);
        document.getElementById('leaderboard-modal').classList.remove('hidden');
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
        });
    });

    document.getElementById('btn-close-detail').addEventListener('click', () => {
        document.getElementById('detail-modal').classList.add('hidden');
    });

    document.getElementById('puzzle-select').addEventListener('change', (e) => {
        const val = e.target.value;
        let newSize = 3;
        let newDims = { x: 3, y: 3, z: 3 };

        if (val === "2x2x3") {
            newSize = 3;
            newDims = { x: 2, y: 2, z: 3 };
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

            hardReset(true);
            adjustCameraForCubeSize(zoomRatio);
            playCubeAnimation(true);
        });
    });

    document.getElementById('btn-toggle-mirrors').addEventListener('click', () => {
        toggleMirrors(!state.showMirrors);
    });

    document.getElementById('btn-close-debug').addEventListener('click', () => {
        document.getElementById('debug-modal').classList.add('hidden');
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

    document.getElementById('toggle-zoom-bar').addEventListener('change', updateFloatingControlsVisibility);
    document.getElementById('toggle-mirror-slider').addEventListener('change', updateFloatingControlsVisibility);

    document.getElementById('btn-test-victory').addEventListener('click', () => {
        document.getElementById('debug-modal').classList.add('hidden');
        setTimeout(() => {
            animateVictory();
        }, 1000);
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

function updateActivePuzzleTab(puzzleSize) {
    const puzzleStr = String(puzzleSize);
    document.querySelectorAll('.puzzle-tab').forEach(tab => {
        if (tab.dataset.puzzle === puzzleStr) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}
