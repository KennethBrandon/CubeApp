import * as THREE from 'three';
import { state } from '../shared/state.js';
import { ANIMATION_SPEED, SNAP_SPEED, CUBE_SIZE, SPACING } from '../shared/constants.js';
import { addToHistory } from '../ui/ui.js';
import { checkSolved, startTimer } from './timer.js';
import { getCubiesInSlice } from '../core/cube.js';
import { soundManager } from '../core/sound.js';

export function queueMove(axis, direction, duration = ANIMATION_SPEED, sliceVal = null) {
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

    // Delegate move logic to the active puzzle
    const moveData = state.activePuzzle.performMove(axisStr, direction, duration, sliceVal);

    const { axisVector, cubies, angle, axis } = moveData;
    // sliceVal might be updated by the puzzle (e.g. named moves)
    const finalSliceVal = moveData.sliceVal;

    // Add to history if it's a named move (R, L, U, D, F, B)
    if (['R', 'L', 'U', 'D', 'F', 'B'].includes(axis)) {
        let notation = axis;
        if (direction === -1) notation += "'";
        else if (direction === 2) notation += "2";
        addToHistory(notation, false);

        // Start timer if not scrambling/auto-solving and not already running
        if (!state.isScrambling && !state.isAutoSolving) {
            if (!state.timerRunning && state.isGameActive && state.hasBeenScrambled) {
                startTimer();
            }
        }
    }

    state.pivot.rotation.set(0, 0, 0);
    state.pivot.position.set(0, 0, 0);
    state.scene.add(state.pivot);
    cubies.forEach(c => state.pivot.attach(c));

    const targetAngle = angle;
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
            finishMove(direction, axisVector, finalSliceVal);
            processQueue();
        }
    }
    loop();
}

export function finishMove(turns, axisVectorOrAxis, sliceVal) {
    state.pivot.updateMatrixWorld();
    const cubies = state.pivot.children.slice();
    state.scene.attach(state.pivot); // Detach pivot, reattach to scene (actually we want to detach children)

    cubies.forEach(c => {
        state.scene.attach(c);
        const S = CUBE_SIZE + SPACING;
        c.position.set(
            Math.round(c.position.x / S * 2) / 2 * S,
            Math.round(c.position.y / S * 2) / 2 * S,
            Math.round(c.position.z / S * 2) / 2 * S
        );
        c.quaternion.normalize();

        // Snap rotation to nearest 90 degrees
        const euler = new THREE.Euler().setFromQuaternion(c.quaternion);
        c.rotation.set(
            snap(euler.x),
            snap(euler.y),
            snap(euler.z)
        );
    });

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
        const turns = Math.round(state.currentDragAngle / (Math.PI / 2));
        if (Math.abs(turns) % 2 !== 0) {
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

    function loop() {
        const now = Date.now();
        let progress = (now - startTime) / SNAP_SPEED;
        if (progress > 1) progress = 1;
        const ease = 1 - Math.pow(1 - progress, 3);
        const current = startAngle + (targetAngle - startAngle) * ease;

        state.pivot.setRotationFromAxisAngle(rotAxis, current);

        if (progress < 1) {
            requestAnimationFrame(loop);
        } else {
            finishMove(turns, axis, sliceVal);
            if (turns !== 0) {
                logMove(axis, sliceVal, turns);
            }
        }
    }
    loop();
}

export function attachSliceToPivot() {
    state.pivot.rotation.set(0, 0, 0);
    state.pivot.position.set(0, 0, 0);
    state.scene.add(state.pivot);
    let cubies;
    if (state.isBackgroundDrag && state.dragSliceValue === Infinity) {
        cubies = state.allCubies;
    } else {
        const epsilon = 0.5;
        cubies = state.allCubies.filter(c => Math.abs(c.position[state.dragAxis] - state.dragSliceValue) < epsilon);
    }
    cubies.forEach(c => state.pivot.attach(c));
}

export function logMove(axis, sliceVal, turns) {
    if (state.isScrambling || state.isAutoSolving) return;

    // Convert internal move to notation
    // axis: 'x', 'y', 'z'
    // sliceVal: position of slice
    // turns: number of 90 deg turns (1, -1, 2)

    const S = CUBE_SIZE + SPACING;
    const epsilon = 0.1;

    // Use activeDimensions to get the correct dimension for this axis
    const dims = state.activeDimensions || state.cubeDimensions;
    const axisDim = dims[axis];
    const maxIndex = (axisDim - 1) / 2;

    let char = '';
    let notationTurns = turns;

    // Determine layer index
    // sliceVal ranges from -maxIndex*S to +maxIndex*S
    let index = sliceVal / S;

    if (state.isBackgroundDrag) {
        // Whole cube rotations
        if (axis === 'x') char = 'x';
        else if (axis === 'y') char = 'y';
        else if (axis === 'z') char = 'z';
    } else {
        // Face moves
        if (axis === 'x') {
            if (Math.abs(index - maxIndex) < epsilon) {
                char = 'R';
                notationTurns *= -1; // R is -X rotation
            } else if (Math.abs(index + maxIndex) < epsilon) {
                char = 'L';
            } else {
                // Inner slice
                if (axisDim % 2 !== 0 && Math.abs(index) < epsilon) {
                    char = 'M'; // True middle
                } else {
                    // Numbered slice
                    if (index > 0) {
                        // Closer to R
                        let depth = Math.round(maxIndex - index + 1);
                        char = depth + 'R';
                        notationTurns *= -1; // Follows R direction
                    } else {
                        // Closer to L
                        let depth = Math.round(maxIndex - Math.abs(index) + 1);
                        char = depth + 'L';
                    }
                }
            }
        } else if (axis === 'y') {
            if (Math.abs(index - maxIndex) < epsilon) {
                char = 'U';
                notationTurns *= -1; // U is -Y rotation
            } else if (Math.abs(index + maxIndex) < epsilon) {
                char = 'D';
            } else {
                if (axisDim % 2 !== 0 && Math.abs(index) < epsilon) {
                    char = 'E';
                } else {
                    if (index > 0) {
                        // Closer to U
                        let depth = Math.round(maxIndex - index + 1);
                        char = depth + 'U';
                        notationTurns *= -1; // Follows U
                    } else {
                        // Closer to D
                        let depth = Math.round(maxIndex - Math.abs(index) + 1);
                        char = depth + 'D';
                    }
                }
            }
        } else if (axis === 'z') {
            if (Math.abs(index - maxIndex) < epsilon) {
                char = 'F';
                notationTurns *= -1; // F is -Z rotation
            } else if (Math.abs(index + maxIndex) < epsilon) {
                char = 'B';
            } else {
                if (axisDim % 2 !== 0 && Math.abs(index) < epsilon) {
                    char = 'S';
                    notationTurns *= -1;
                } else {
                    if (index > 0) {
                        // Closer to F
                        let depth = Math.round(maxIndex - index + 1);
                        char = depth + 'F';
                        notationTurns *= -1; // Follows F
                    } else {
                        // Closer to B
                        let depth = Math.round(maxIndex - Math.abs(index) + 1);
                        char = depth + 'B';
                    }
                }
            }
        }
    }

    let suffix = '';
    if (Math.abs(notationTurns) === 2) suffix = '2';
    else if (notationTurns < 0) suffix = "'";

    addToHistory(char + suffix, false);
}

export function onKeyDown(event) {
    // Check if any modal is open
    const modals = ['solved-modal', 'leaderboard-modal', 'detail-modal', 'debug-modal'];
    const isModalOpen = modals.some(id => {
        const el = document.getElementById(id);
        return el && !el.classList.contains('hidden');
    });

    if (isModalOpen) return;

    if (state.isAnimating || state.isScrambling || state.isAutoSolving) return;

    const key = event.key.toUpperCase();
    const shift = event.shiftKey;
    const direction = shift ? -1 : 1;

    if (['R', 'L', 'U', 'D', 'F', 'B'].includes(key)) {
        let axis = '';
        if (['R', 'L'].includes(key)) axis = 'x';
        else if (['U', 'D'].includes(key)) axis = 'y';
        else if (['F', 'B'].includes(key)) axis = 'z';

        let finalDir = direction;
        if (isFaceRectangular(axis)) {
            finalDir = 2;
        }
        queueMove(key, finalDir);
    } else if (event.key === 'ArrowRight') {
        queueMove('y', -1, ANIMATION_SPEED, Infinity); // Rotate cube Y
    } else if (event.key === 'ArrowLeft') {
        queueMove('y', 1, ANIMATION_SPEED, Infinity);
    } else if (event.key === 'ArrowUp') {
        queueMove('x', -1, ANIMATION_SPEED, Infinity);
    } else if (event.key === 'ArrowDown') {
        queueMove('x', 1, ANIMATION_SPEED, Infinity);
    }
}

function isFaceRectangular(axis) {
    if (!state.activeDimensions) return false;
    const dims = state.activeDimensions;
    if (axis === 'x') return dims.y !== dims.z;
    if (axis === 'y') return dims.x !== dims.z;
    if (axis === 'z') return dims.x !== dims.y;
    return false;
}
