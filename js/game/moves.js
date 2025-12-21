import * as THREE from 'three';
import { state } from '../shared/state.js';
import { ANIMATION_SPEED, SNAP_SPEED, CUBE_SIZE, SPACING } from '../shared/constants.js';
import { addToHistory } from '../ui/ui.js';
import { checkSolved, startTimer } from './timer.js';
import { getCubiesInSlice } from '../core/cube.js';
import { soundManager } from '../core/sound.js';

export function queueMove(axis, direction, duration = state.animationSpeed, sliceVal = null) {
    state.moveQueue.push({ axis, direction, duration, sliceVal });
    processQueue();
}

export function processQueue() {
    if (state.isAnimating || state.moveQueue.length === 0) return;
    const move = state.moveQueue.shift();
    performMove(move.axis, move.direction, move.duration, move.sliceVal);
}

export function performMove(axisStr, direction, duration, sliceVal = null) {
    state.isAnimating = true;
    let axisVector = new THREE.Vector3();
    let cubies = [];
    let customAngle = null;

    // Check if active puzzle has custom move logic (ALL puzzles should now)
    if (state.activePuzzle && typeof state.activePuzzle.getMoveInfo === 'function') {
        const info = state.activePuzzle.getMoveInfo(axisStr, direction, sliceVal);
        if (info) {
            axisVector = info.axisVector;
            cubies = info.cubies;
            customAngle = info.angle;
        } else {
            // Fallback for X/Y/Z on some puzzles or invalid moves
            // If info is null, we assume the move is invalid or not handled
            console.log(`[Moves] Move rejected by puzzle: ${axisStr}`);
            state.isAnimating = false;
            return;
        }
    } else {
        console.warn(`[Moves] No active puzzle or getMoveInfo not implemented.`);
        state.isAnimating = false;
        return;
    }

    state.pivot.rotation.set(0, 0, 0);
    state.pivot.position.set(0, 0, 0);
    state.cubeWrapper.add(state.pivot);
    cubies.forEach(c => state.pivot.attach(c));

    const targetAngle = customAngle !== null ? customAngle : direction * (Math.PI / 2);
    const startTime = Date.now();

    function loop() {
        const now = Date.now();
        let progress = (now - startTime) / duration;
        if (progress > 1) progress = 1;

        const ease = 1 - Math.pow(1 - progress, 3); // Cubic out
        state.pivot.setRotationFromAxisAngle(axisVector, targetAngle * ease);

        if (progress < 1) {
            requestAnimationFrame(loop);
        } else {
            finishMove(direction, axisVector, sliceVal);
            logMove(axisStr, sliceVal, direction, false, null); // Log the move (not a drag)
            processQueue();
        }
    }
    loop();
}

export function finishMove(turns, axisVectorOrAxis, sliceVal) {
    state.pivot.updateMatrixWorld();
    const cubies = state.pivot.children.slice();
    state.cubeWrapper.attach(state.pivot); // Detach pivot, reattach to wrapper

    cubies.forEach(c => {
        state.cubeWrapper.attach(c);
    });

    if (state.activePuzzle && typeof state.activePuzzle.snapCubies === 'function') {
        state.activePuzzle.snapCubies(cubies);
    } else {
        // Fallback for safety
        cubies.forEach(c => {
            const S = CUBE_SIZE + (state.activePuzzle ? state.activePuzzle.getSpacing() : SPACING);
            c.position.set(
                Math.round(c.position.x / S * 2) / 2 * S,
                Math.round(c.position.y / S * 2) / 2 * S,
                Math.round(c.position.z / S * 2) / 2 * S
            );
            c.quaternion.normalize();
            const euler = new THREE.Euler().setFromQuaternion(c.quaternion);
            const snap = (val) => Math.round(val / (Math.PI / 2)) * (Math.PI / 2);
            c.rotation.set(snap(euler.x), snap(euler.y), snap(euler.z));
        });
    }

    state.pivot.rotation.set(0, 0, 0);
    state.isAnimating = false;

    if (sliceVal !== Infinity) {
        soundManager.playMoveSound();
    }

    // Log move if it was a manual drag (turns is number of turns)
    // If it came from performMove, it's already logged or part of a sequence
    // But snapPivot calls this too.

    // Check if we need to check solution
    checkSolved();

    function snap(val) {
        const piHalf = Math.PI / 2;
        return Math.round(val / piHalf) * piHalf;
    }

    // Update active dimensions if whole cube rotation
    if (sliceVal === Infinity) {
        const piHalf = state.activePuzzle && typeof state.activePuzzle.getSnapAngle === 'function' ? state.activePuzzle.getSnapAngle() : Math.PI / 2;
        const turns = Math.round(state.currentDragAngle / piHalf);
        if (Math.abs(turns) % 2 !== 0 && piHalf === Math.PI / 2) {
            const dims = state.activeDimensions || state.cubeDimensions;
            if (!dims) return; // Should not happen

            let temp;
            if (axisVectorOrAxis === 'x' || (typeof axisVectorOrAxis === 'object' && axisVectorOrAxis !== null && axisVectorOrAxis.x !== 0)) {
                temp = dims.y; dims.y = dims.z; dims.z = temp;
            } else if (axisVectorOrAxis === 'y' || (typeof axisVectorOrAxis === 'object' && axisVectorOrAxis !== null && axisVectorOrAxis.y !== 0)) {
                temp = dims.x; dims.x = dims.z; dims.z = temp;
            } else if (axisVectorOrAxis === 'z' || (typeof axisVectorOrAxis === 'object' && axisVectorOrAxis !== null && axisVectorOrAxis.z !== 0)) {
                temp = dims.x; dims.x = dims.y; dims.y = temp;
            }
        }
    }
}

export function snapPivot(targetAngle, turns, axis, sliceVal) {
    state.isAnimating = true;
    const startAngle = state.currentDragAngle;
    const startTime = Date.now();

    // Determine rotation axis
    let rotAxis = state.dragRotationAxis;

    // Calculate duration based on distance
    const distance = Math.abs(targetAngle - startAngle);
    const maxDistance = Math.PI / 4; // 45 degrees
    // Interpolate: 0 distance = 0ms, 45 deg = state.snapSpeed
    // Ensure a minimum duration of 1 frame (approx 16ms) if distance > 0 to avoid division by zero or instant snaps that might look glitchy
    let duration = (distance / maxDistance) * state.snapSpeed;
    if (duration < 16 && distance > 0.001) duration = 16;

    function loop() {
        const now = Date.now();
        let progress = duration > 0 ? (now - startTime) / duration : 1;
        if (progress > 1) progress = 1;

        const ease = 1 - Math.pow(1 - progress, 3); // Cubic out
        const current = startAngle + (targetAngle - startAngle) * ease;
        state.pivot.setRotationFromAxisAngle(rotAxis, current);

        if (progress < 1) {
            requestAnimationFrame(loop);
        } else {
            // Normalize turns before finishing
            let normalizedInputTurns = normalizeTurns(turns, sliceVal);

            finishMove(normalizedInputTurns, axis, sliceVal);

            if (normalizedInputTurns !== 0) {
                logMove(axis, sliceVal, normalizedInputTurns, true, state.dragRotationAxis);
            }
        }
    }
    loop();
}

function normalizeTurns(turns, sliceVal) {
    const cycle = (state.activePuzzle && typeof state.activePuzzle.getCycleLength === 'function')
        ? state.activePuzzle.getCycleLength()
        : 4;

    let t = Math.round(turns) % cycle;

    if (cycle === 4) {
        if (t === 3) return -1;
        if (t === -3) return 1;
    } else if (cycle === 3) {
        if (t === 2) return -1;
        if (t === -2) return 1;
    } else if (cycle === 5) {
        if (t === 3) return -2;
        if (t === 4) return -1;
        if (t === -3) return 2;
        if (t === -4) return 1;
    }

    if (t === 0) return 0;
    return t;
}

export function attachSliceToPivot() {
    state.pivot.rotation.set(0, 0, 0);
    state.pivot.position.set(0, 0, 0);
    state.cubeWrapper.add(state.pivot);
    state.cubeWrapper.add(state.pivot);
    let cubies;
    if (state.dragSliceValue === Infinity) {
        console.log("Attaching ALL cubies (Whole Cube Rotation)");
        cubies = state.allCubies;
    } else if (state.activePuzzle && typeof state.activePuzzle.getSliceCubies === 'function') {
        cubies = state.activePuzzle.getSliceCubies(state.dragAxis, state.dragSliceValue);
        console.log(`[Moves] Delegated slice selection to activePuzzle. Count: ${cubies.length}`);
    } else {
        const epsilon = 0.5;
        cubies = state.allCubies.filter(c => Math.abs(c.position[state.dragAxis] - state.dragSliceValue) < epsilon);
        console.log(`Attaching Slice Cubies. Axis: ${state.dragAxis}, Val: ${state.dragSliceValue}, Count: ${cubies.length}`);
    }
    cubies.forEach(c => state.pivot.attach(c));
}

export function logMove(axis, sliceVal, turns, isDrag = false, dragRotationAxis = null) {
    if (state.isScrambling || state.isAutoSolving) return;

    // Check if active puzzle has custom notation logic (should be true for all)
    if (state.activePuzzle && typeof state.activePuzzle.getNotation === 'function') {
        const notation = state.activePuzzle.getNotation(axis, sliceVal, turns, isDrag, dragRotationAxis);
        if (notation) {
            addToHistory(notation, false);
            return;
        }
    }

    console.warn("[Moves] No notation returned by activePuzzle.getNotation");
}

// Removed local heldKeys, using state.activeKeys

const keyAliases = {
    '1': '!', '!': '1',
    '2': '@', '@': '2',
    '3': '#', '#': '3',
    '4': '$', '$': '4',
    '5': '%', '%': '5',
    '6': '^', '^': '6',
    '7': '&', '&': '7',
    '8': '*', '*': '8',
    '9': '(', '(': '9',
    '0': ')', ')': '0'
};

export function onKeyUp(event) {
    const k = event.key;
    if (!k) return;
    state.activeKeys.delete(k);
    state.activeKeys.delete(k.toLowerCase());
    state.activeKeys.delete(k.toUpperCase());
    if (keyAliases[k]) state.activeKeys.delete(keyAliases[k]);
}

export function onKeyDown(event) {
    // Check if any modal is open
    const modals = ['solved-modal', 'leaderboard-modal', 'detail-modal', 'debug-modal', 'custom-puzzle-panel'];
    const isModalOpen = modals.some(id => {
        const el = document.getElementById(id);
        return el && !el.classList.contains('hidden');
    });

    if (isModalOpen) return;

    // Don't block camera keys if animating/scrambling, but block moves
    const isCameraKey = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(event.key);

    const key = event.key;
    state.activeKeys.add(key);
    state.activeKeys.add(key.toLowerCase());
    state.activeKeys.add(key.toUpperCase());

    if (!isCameraKey && (state.isAnimating || state.isScrambling || state.isAutoSolving || state.isDragging)) return;

    // Delegate to active puzzle if it has custom handling (e.g. Megaminx)
    if (state.activePuzzle && typeof state.activePuzzle.handleKeyDown === 'function') {
        const handled = state.activePuzzle.handleKeyDown(event);
        if (handled) return;
    }

    // Default handling for arrow keys ONLY if not handled by puzzle? 
    // Wait, arrow keys usually rotate the camera (handled above by isCameraKey return if not animating)
    // Actually, arrow keys are sometimes mapped to rotates.
    // But StandardCube now handles ALL keys including R, L, U etc.

    // So if handleKeyDown returns false, we just ignore it?
    // Unless there are global keys like 'Space' for scramble/solve which should be handled elsewhere?
    // Scramble logic is usually in UI buttons.
    // 'Space' might be handled in Timer or something.
    // End of onKeyDown
}
// isFaceRectangular moved to Puzzle.js

