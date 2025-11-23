import { state } from '../shared/state.js';
import { CUBE_SIZE, SPACING, SCRAMBLE_MOVES, SCRAMBLE_SPEED } from '../shared/constants.js';
import { queueMove } from './moves.js';
import { stopTimer, startInspection } from './timer.js';
import { createCube } from '../core/cube.js';
import { adjustCameraForCubeSize } from '../core/controls.js';
import { createEnvironment, createMirrors } from '../core/environment.js';
import { updateHistoryUI } from '../ui/ui.js';

export function startScramble() {
    if (state.isAnimating) return;
    hardReset(true); // Keep camera on scramble
    state.isScrambling = true;
    state.scrambleSequence = [];
    state.hasBeenScrambled = true;

    let scrambleMoves = [];
    const axes = ['x', 'y', 'z'];
    const S = CUBE_SIZE + SPACING;

    let lastAxis = '';
    let lastLayer = -999;

    // Determine scramble length based on cube size
    let numMoves = SCRAMBLE_MOVES; // Default 25
    if (state.cubeSize === 2) numMoves = 15;
    else if (state.cubeSize === 3) numMoves = 25;
    else if (state.cubeSize === 4) numMoves = 40;
    else if (state.cubeSize >= 5) numMoves = 60;

    for (let i = 0; i < numMoves; i++) {
        let axis, layerNum, sliceVal;

        // Avoid undoing previous move (same axis, same layer)
        // Also avoid 3 moves on same axis/layer (redundant)
        // Simple logic: just ensure different axis or different layer than last move

        do {
            axis = axes[Math.floor(Math.random() * axes.length)];
            const dim = state.cubeDimensions[axis];
            const maxLayer = Math.floor((dim - 1) / 2);
            // Random layer between -maxLayer and maxLayer
            // But we need integer steps
            // range: -maxLayer to maxLayer
            const range = maxLayer * 2 + 1;
            // Actually, layers are indices.
            // If dim=3, indices: -1, 0, 1.
            // If dim=2, indices: -0.5, 0.5? No, our loop uses offsets.
            // In createCube:
            // dim=3 -> offsetX=1. x loops -1, 0, 1.
            // dim=2 -> offsetX=0.5. x loops -0.5, 0.5.

            // So we need to pick a valid coordinate.
            // Let's pick a random index from 0 to dim-1.
            const rawIndex = Math.floor(Math.random() * dim);
            // Convert to coordinate
            // coord = rawIndex - (dim-1)/2
            sliceVal = (rawIndex - (dim - 1) / 2) * S;
            layerNum = rawIndex;

        } while (axis === lastAxis && layerNum === lastLayer);

        lastAxis = axis;
        lastLayer = layerNum;

        const dirs = [1, -1, 2];
        let dir = dirs[Math.floor(Math.random() * dirs.length)];

        // Enforce 180 degree turns for rectangular faces
        if (isFaceRectangular(axis)) {
            dir = 2;
        }

        scrambleMoves.push({ axis, dir, sliceVal });

        // Log scramble move for display (simplified notation)
        // We'll let queueMove handle execution, but we want to store the sequence
        // We need standard notation for the end screen
        // Let's reconstruct notation here or just store the move object and format later?
        // Existing code stored strings in scrambleSequence.
        // We can use a helper to get notation string.

        const notation = getScrambleNotation(axis, sliceVal, dir);
        state.scrambleSequence.push(notation);
    }

    scrambleMoves.forEach(m => {
        queueMove(m.axis, m.dir, SCRAMBLE_SPEED, m.sliceVal);
    });

    // After scramble, enable game
    const checkInterval = setInterval(() => {
        if (state.moveQueue.length === 0 && !state.isAnimating) {
            state.isScrambling = false;
            startInspection();
            clearInterval(checkInterval);
        }
    }, 100);
}

function getScrambleNotation(axis, sliceVal, dir) {
    const S = CUBE_SIZE + SPACING;
    const maxIndex = (state.cubeSize - 1) / 2;
    const epsilon = 0.1;
    let index = Math.round(sliceVal / S);

    let char = '?';
    let turns = dir;

    if (axis === 'x') {
        if (Math.abs(index - maxIndex) < epsilon) {
            char = 'R';
            turns *= -1;
        } else if (Math.abs(index + maxIndex) < epsilon) {
            char = 'L';
        } else {
            if (state.cubeSize % 2 !== 0 && Math.abs(index) < epsilon) {
                char = 'M';
            } else {
                if (index > 0) {
                    let depth = Math.round(maxIndex - index + 1);
                    char = depth + 'R';
                    turns *= -1;
                } else {
                    let depth = Math.round(maxIndex - Math.abs(index) + 1);
                    char = depth + 'L';
                }
            }
        }
    } else if (axis === 'y') {
        if (Math.abs(index - maxIndex) < epsilon) {
            char = 'U';
            turns *= -1;
        } else if (Math.abs(index + maxIndex) < epsilon) {
            char = 'D';
        } else {
            if (state.cubeSize % 2 !== 0 && Math.abs(index) < epsilon) {
                char = 'E';
            } else {
                if (index > 0) {
                    let depth = Math.round(maxIndex - index + 1);
                    char = depth + 'U';
                    turns *= -1;
                } else {
                    let depth = Math.round(maxIndex - Math.abs(index) + 1);
                    char = depth + 'D';
                }
            }
        }
    } else if (axis === 'z') {
        if (Math.abs(index - maxIndex) < epsilon) {
            char = 'F';
            turns *= -1;
        } else if (Math.abs(index + maxIndex) < epsilon) {
            char = 'B';
        } else {
            if (state.cubeSize % 2 !== 0 && Math.abs(index) < epsilon) {
                char = 'S';
                turns *= -1;
            } else {
                if (index > 0) {
                    let depth = Math.round(maxIndex - index + 1);
                    char = depth + 'F';
                    turns *= -1;
                } else {
                    let depth = Math.round(maxIndex - Math.abs(index) + 1);
                    char = depth + 'B';
                }
            }
        }
    }

    let suffix = '';
    if (Math.abs(turns) === 2) suffix = '2';
    else if (turns < 0) suffix = "'";

    return char + suffix;
}

export function handleResetClick() {
    if (state.isAutoSolving || state.isScrambling || (state.moveHistory.length === 0 && state.scrambleSequence.length === 0)) {
        hardReset(true); // Keep camera on manual reset
    } else {
        startReverseSolve();
    }
}

export function startReverseSolve() {
    stopTimer();
    state.isAutoSolving = true;

    const movesToUndo = [...state.moveHistory].reverse().concat([...state.scrambleSequence].reverse());
    state.moveQueue = [];

    const N = movesToUndo.length;
    if (N === 0) {
        state.isAutoSolving = false;
        hardReset(true);
        return;
    }

    // Calculate timing
    const SCRAMBLE_SPEED = 50;
    const MAX_TOTAL_TIME = 5000; // 5 seconds max
    const idealTotalTime = N * SCRAMBLE_SPEED;

    let useEasing = false;
    let totalTime = idealTotalTime;

    if (idealTotalTime > MAX_TOTAL_TIME) {
        totalTime = MAX_TOTAL_TIME;
        useEasing = true;
    }

    const K = 3;
    let weights = [];
    let sumWeights = 0;

    if (useEasing) {
        for (let i = 0; i < N; i++) {
            const x = i / (N - 1 || 1);
            const w = 1 + K * Math.pow(2 * x - 1, 2);
            weights.push(w);
            sumWeights += w;
        }
    }

    movesToUndo.forEach((notation, index) => {
        // Parse notation: [prefix][char][suffix]
        let match = notation.match(/^(\d*)([a-zA-Z])(.*)$/);
        if (!match) return;

        let prefix = match[1];
        let char = match[2];
        let suffix = match[3];

        let dir = 1;
        if (suffix === "'") dir = 1; // Undo ' is normal
        else if (suffix === "2") dir = 2;
        else dir = -1; // Undo normal is '

        let axis = '';
        let sliceVal = null;
        const S = CUBE_SIZE + SPACING;
        const maxIndex = (state.cubeSize - 1) / 2;

        let duration = SCRAMBLE_SPEED;
        if (useEasing) {
            duration = totalTime * (weights[index] / sumWeights);
        }

        if (['M', 'E', 'S'].includes(char)) {
            if (char === 'M') { axis = 'x'; sliceVal = 0; }
            else if (char === 'E') { axis = 'y'; sliceVal = 0; }
            else if (char === 'S') { axis = 'z'; sliceVal = 0; }
            queueMove(axis, dir, duration, sliceVal);
            return;
        }

        if (['R', 'L'].includes(char.toUpperCase())) axis = 'x';
        else if (['U', 'D'].includes(char.toUpperCase())) axis = 'y';
        else if (['F', 'B'].includes(char.toUpperCase())) axis = 'z';

        let layerNum = prefix ? parseInt(prefix) : 1;
        let sliceIndex = 0;

        if (['R', 'U', 'F'].includes(char)) {
            sliceIndex = maxIndex - (layerNum - 1);
        } else {
            sliceIndex = -maxIndex + (layerNum - 1);
        }

        sliceVal = sliceIndex * S;
        queueMove(axis, dir, duration, sliceVal);
    });

    const checkInterval = setInterval(() => {
        if (state.moveQueue.length === 0 && !state.isAnimating) {
            state.isAutoSolving = false;
            hardReset(true);
            clearInterval(checkInterval);
        }
    }, 100);
}

export function hardReset(keepCamera = false) {
    stopTimer();
    state.isInspection = false;

    const timerLabel = document.getElementById('timer-label');
    if (timerLabel) {
        timerLabel.textContent = "Time";
        timerLabel.className = "text-gray-500 text-[10px] uppercase tracking-wider leading-none mb-1";
    }

    const timerDisplay = document.getElementById('timer');
    if (timerDisplay) {
        timerDisplay.textContent = "00:00.00";
        timerDisplay.className = "text-2xl sm:text-3xl font-mono text-green-400 leading-none";
    }

    state.timerRunning = false;
    state.isGameActive = false;
    state.isAutoSolving = false;
    state.moveHistory = [];
    state.scrambleSequence = [];
    state.hasBeenScrambled = false;
    updateHistoryUI();

    state.pivot.rotation.set(0, 0, 0);
    state.pivot.position.set(0, 0, 0);

    createCube();

    if (!keepCamera) {
        adjustCameraForCubeSize();
    }

    createEnvironment();
    createMirrors();

    state.moveQueue = [];
    state.isAnimating = false;
    state.isScrambling = false;
}

function isFaceRectangular(axis) {
    if (!state.cubeDimensions) return false;
    const dims = state.cubeDimensions;
    if (axis === 'x') return dims.y !== dims.z;
    if (axis === 'y') return dims.x !== dims.z;
    if (axis === 'z') return dims.x !== dims.y;
    return false;
}
