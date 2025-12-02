import { state } from '../shared/state.js';
import { CUBE_SIZE, SPACING, SCRAMBLE_MOVES, SCRAMBLE_SPEED } from '../shared/constants.js';
import { queueMove } from './moves.js';
import { stopTimer, startInspection } from './timer.js';
import { createCube } from '../core/cube.js';
import { adjustCameraForCubeSize } from '../core/controls.js';
import { createEnvironment, createMirrors } from '../core/environment.js';
import { updateHistoryUI } from '../ui/ui.js';
import { soundManager } from '../core/sound.js';

export async function startScramble() {
    if (state.isAnimating) return;
    hardReset(true); // Keep camera on scramble
    state.isScrambling = true;
    state.scrambleSequence = [];
    state.hasBeenScrambled = true;

    // Delegate scramble generation to active puzzle
    // Now async to support cubing.js
    let scrambleMoves = [];
    try {
        scrambleMoves = await state.activePuzzle.getScramble();
    } catch (e) {
        console.error("Scramble generation failed:", e);
        state.isScrambling = false;
        return;
    }

    scrambleMoves.forEach(m => {
        // Log scramble move for display
        const notation = state.activePuzzle.getNotation(m.axis, m.sliceVal, m.dir);
        state.scrambleSequence.push(notation);

        queueMove(m.axis, m.dir, SCRAMBLE_SPEED, m.sliceVal);
    });

    console.log("Scramble:", state.scrambleSequence.join(" "));

    // After scramble, enable game
    const checkInterval = setInterval(() => {
        if (state.moveQueue.length === 0 && !state.isAnimating) {
            state.isScrambling = false;
            state.isSolved = false; // Explicitly mark as not solved
            startInspection();
            clearInterval(checkInterval);
        }
    }, 100);
}



export function handleResetClick() {
    // Prevent reset during victory animation (or single moves), but allow interrupting auto-solve/scramble
    if (state.isAnimating && !state.isAutoSolving && !state.isScrambling) {
        return;
    }

    if (state.isAutoSolving || state.isScrambling || (state.moveHistory.length === 0 && state.scrambleSequence.length === 0)) {
        soundManager.playResetSound();
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
