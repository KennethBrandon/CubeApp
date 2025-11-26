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

    // Determine axis vector and cubies
    if (axisStr === 'x') axisVector.set(1, 0, 0);
    else if (axisStr === 'y') axisVector.set(0, 1, 0);
    else if (axisStr === 'z') axisVector.set(0, 0, 1);

    // Handle named moves (R, L, U, D, F, B)
    const S = CUBE_SIZE + SPACING;
    const dims = state.activeDimensions || state.cubeDimensions;

    // Determine maxIndex based on axis
    let maxIndex = 0;
    if (axisStr === 'x' || ['R', 'L', 'M'].includes(axisStr)) maxIndex = (dims.x - 1) / 2;
    else if (axisStr === 'y' || ['U', 'D', 'E'].includes(axisStr)) maxIndex = (dims.y - 1) / 2;
    else if (axisStr === 'z' || ['F', 'B', 'S'].includes(axisStr)) maxIndex = (dims.z - 1) / 2;
    else maxIndex = (state.cubeSize - 1) / 2; // Fallback

    if (['R', 'L', 'U', 'D', 'F', 'B', 'M', 'E', 'S'].includes(axisStr)) {
        if (sliceVal === null) {
            let sliceIndex = 0;
            if (['R', 'U', 'F'].includes(axisStr)) sliceIndex = maxIndex;
            else if (['L', 'D', 'B'].includes(axisStr)) sliceIndex = -maxIndex;
            else sliceIndex = 0; // M, E, S

            sliceVal = sliceIndex * S;
        }

        if (axisStr === 'R' || axisStr === 'L' || axisStr === 'M') axisVector.set(1, 0, 0);
        else if (axisStr === 'U' || axisStr === 'D' || axisStr === 'E') axisVector.set(0, 1, 0);
        else if (axisStr === 'F' || axisStr === 'B' || axisStr === 'S') axisVector.set(0, 0, 1);

        // Add to history
        let notation = axisStr;

        // Check for layer prefix
        if (sliceVal !== null && !['M', 'E', 'S'].includes(axisStr)) {
            let layer = 1;
            // Reverse the logic from onKeyDown
            if (['R', 'U', 'F'].includes(axisStr)) {
                // sliceVal = (maxIndex - (layer - 1)) * S
                // sliceVal/S = maxIndex - layer + 1
                // layer = maxIndex + 1 - sliceVal/S
                layer = Math.round(maxIndex + 1 - sliceVal / S);
            } else {
                // sliceVal = (-maxIndex + (layer - 1)) * S
                // sliceVal/S = -maxIndex + layer - 1
                // layer = sliceVal/S + maxIndex + 1
                layer = Math.round(sliceVal / S + maxIndex + 1);
            }

            if (layer > 1) {
                notation = layer + notation;
            }
        }

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

    // Generic slice selection
    if (sliceVal !== null) {
        cubies = getCubiesInSlice(axisStr === 'x' || axisStr === 'R' || axisStr === 'L' || axisStr === 'M' ? 'x' :
            (axisStr === 'y' || axisStr === 'U' || axisStr === 'D' || axisStr === 'E' ? 'y' : 'z'), sliceVal);

        // Adjust rotation axis based on Face Polarity
        // R, U, F are "Positive Faces" but their rotation is defined as Clockwise, 
        // which corresponds to NEGATIVE rotation around their respective positive axes (Right Hand Rule).
        // L, D, B are "Negative Faces" and their Clockwise rotation corresponds to POSITIVE rotation around their axes (or rather, around the main axis).
        // S follows F (Positive Face logic), so it needs negation.

        if (['R', 'U', 'F', 'S'].includes(axisStr)) {
            axisVector.negate();
        } else if (['L', 'D', 'B', 'M', 'E'].includes(axisStr)) {
            // Do nothing, standard axis direction is correct for L, D, B, M, E
        } else {
            // Fallback for generic 'x', 'y', 'z' moves (e.g. from arrow keys or other sources)
            // If sliceVal > 0, we assume it behaves like R/U/F
            if (sliceVal > 0) {
                axisVector.negate();
            }
        }
    } else {
        // Whole cube rotation (M, E, S or similar)
        cubies = state.allCubies;
    }

    state.pivot.rotation.set(0, 0, 0);
    state.pivot.position.set(0, 0, 0);
    state.scene.add(state.pivot);
    cubies.forEach(c => state.pivot.attach(c));

    const targetAngle = direction * (Math.PI / 2);
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

const heldKeys = new Set();

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
    heldKeys.delete(k);
    heldKeys.delete(k.toLowerCase());
    heldKeys.delete(k.toUpperCase());
    if (keyAliases[k]) heldKeys.delete(keyAliases[k]);
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

    const key = event.key;
    heldKeys.add(key);
    heldKeys.add(key.toLowerCase());
    heldKeys.add(key.toUpperCase());

    const upperKey = key.toUpperCase();
    const shift = event.shiftKey;
    const direction = shift ? -1 : 1;

    if (['R', 'L', 'U', 'D', 'F', 'B', 'M', 'E', 'S'].includes(upperKey)) {
        let axis = '';
        if (['R', 'L', 'M'].includes(upperKey)) axis = 'x';
        else if (['U', 'D', 'E'].includes(upperKey)) axis = 'y';
        else if (['F', 'B', 'S'].includes(upperKey)) axis = 'z';

        let finalDir = direction;
        if (isFaceRectangular(axis)) {
            finalDir = 2;
        }

        // Determine layer from held keys
        let layer = 1;
        if (heldKeys.has('0') || heldKeys.has(')')) layer = 10;
        else if (heldKeys.has('9') || heldKeys.has('(')) layer = 9;
        else if (heldKeys.has('8') || heldKeys.has('*')) layer = 8;
        else if (heldKeys.has('7') || heldKeys.has('&')) layer = 7;
        else if (heldKeys.has('6') || heldKeys.has('^')) layer = 6;
        else if (heldKeys.has('5') || heldKeys.has('%')) layer = 5;
        else if (heldKeys.has('4') || heldKeys.has('$')) layer = 4;
        else if (heldKeys.has('3') || heldKeys.has('#')) layer = 3;
        else if (heldKeys.has('2') || heldKeys.has('@')) layer = 2;

        let sliceVal = null;
        if (layer > 1 && !['M', 'E', 'S'].includes(upperKey)) {
            const S = CUBE_SIZE + SPACING;
            const dims = state.activeDimensions || state.cubeDimensions;
            const axisDim = dims[axis];
            const maxIndex = (axisDim - 1) / 2;

            // Calculate slice index based on face polarity
            // Positive Faces (R, U, F): Layer 1 is at maxIndex. Layer n is maxIndex - (n-1)
            // Negative Faces (L, D, B): Layer 1 is at -maxIndex. Layer n is -maxIndex + (n-1)
            if (['R', 'U', 'F'].includes(upperKey)) {
                sliceVal = (maxIndex - (layer - 1)) * S;
            } else {
                sliceVal = (-maxIndex + (layer - 1)) * S;
            }
        }

        queueMove(upperKey, finalDir, state.animationSpeed, sliceVal);
    } else if (event.key === 'ArrowRight') {
        queueMove('y', -1, state.animationSpeed, Infinity); // Rotate cube Y (Right)
    } else if (event.key === 'ArrowLeft') {
        queueMove('y', 1, state.animationSpeed, Infinity); // Rotate cube Y' (Left)
    } else if (event.key === 'ArrowUp') {
        queueMove('x', 1, state.animationSpeed, Infinity); // Rotate cube x' (Up Arrow)
    } else if (event.key === 'ArrowDown') {
        queueMove('x', -1, state.animationSpeed, Infinity); // Rotate cube x (Down Arrow)
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
