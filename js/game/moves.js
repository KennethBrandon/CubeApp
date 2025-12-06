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
    if (axisStr === 'x' || axisStr === 'X') axisVector.set(1, 0, 0);
    else if (axisStr === 'y' || axisStr === 'Y') axisVector.set(0, 1, 0);
    else if (axisStr === 'z' || axisStr === 'Z') axisVector.set(0, 0, 1);

    // Handle named moves (R, L, U, D, F, B)
    const S = CUBE_SIZE + (state.activePuzzle ? state.activePuzzle.getSpacing() : SPACING);
    const dims = state.activeDimensions || state.cubeDimensions;

    // Determine maxIndex based on axis
    let maxIndex = 0;
    if (['x', 'X', 'R', 'L', 'M'].includes(axisStr)) maxIndex = (dims.x - 1) / 2;
    else if (['y', 'Y', 'U', 'D', 'E'].includes(axisStr)) maxIndex = (dims.y - 1) / 2;
    else if (['z', 'Z', 'F', 'B', 'S'].includes(axisStr)) maxIndex = (dims.z - 1) / 2;
    else maxIndex = (state.cubeSize - 1) / 2; // Fallback

    if (['R', 'L', 'U', 'D', 'F', 'B', 'M', 'E', 'S', 'X', 'Y', 'Z'].includes(axisStr)) {
        if (sliceVal === null) {
            let sliceIndex = 0;
            if (['R', 'U', 'F'].includes(axisStr)) sliceIndex = maxIndex;
            else if (['L', 'D', 'B'].includes(axisStr)) sliceIndex = -maxIndex;
            else sliceIndex = 0; // M, E, S

            sliceVal = sliceIndex * S;
        }

        if (['R', 'L', 'M'].includes(axisStr)) axisVector.set(1, 0, 0);
        else if (['U', 'D', 'E'].includes(axisStr)) axisVector.set(0, 1, 0);
        else if (['F', 'B', 'S'].includes(axisStr)) axisVector.set(0, 0, 1);

        // Add to history
        let notation = axisStr;
        let notationDir = direction;

        if (['X', 'Y', 'Z'].includes(axisStr)) {
            notation = axisStr.toLowerCase();
            // No inversion needed if we negate the axis vector below
        }

        // Check for layer prefix
        if (sliceVal !== null && !['M', 'E', 'S', 'X', 'Y', 'Z'].includes(axisStr)) {
            let layer = 1;
            // Reverse the logic from onKeyDown
            if (['R', 'U', 'F'].includes(axisStr)) {
                layer = Math.round(maxIndex + 1 - sliceVal / S);
            } else {
                layer = Math.round(sliceVal / S + maxIndex + 1);
            }

            if (layer > 1) {
                notation = layer + notation;
            }
        }

        if (notationDir === -1) notation += "'";
        else if (notationDir === 2 || notationDir === -2) notation += "2";
        addToHistory(notation, false);

        // Start timer if not scrambling/auto-solving and not already running
        // AND not a whole cube rotation (X, Y, Z)
        if (!state.isScrambling && !state.isAutoSolving && !['X', 'Y', 'Z'].includes(axisStr)) {
            if (!state.timerRunning && state.isGameActive && state.hasBeenScrambled) {
                startTimer();
            }
        }
    }

    // Generic slice selection
    if (sliceVal !== null && sliceVal !== Infinity) {
        cubies = getCubiesInSlice(axisStr === 'x' || axisStr === 'R' || axisStr === 'L' || axisStr === 'M' ? 'x' :
            (axisStr === 'y' || axisStr === 'U' || axisStr === 'D' || axisStr === 'E' ? 'y' : 'z'), sliceVal);

        // Adjust rotation axis based on Face Polarity
        // R, U, F are "Positive Faces" but their rotation is defined as Clockwise, 
        // which corresponds to NEGATIVE rotation around their respective positive axes (Right Hand Rule).
        // L, D, B are "Negative Faces" and their Clockwise rotation corresponds to POSITIVE rotation around their axes (or rather, around the main axis).
        // S follows F (Positive Face logic), so it needs negation.

        if (['R', 'U', 'F', 'S', 'X', 'Y', 'Z'].includes(axisStr)) {
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

        // Adjust direction for whole cube rotations (x, y, z)
        // x follows R (negate)
        // y follows U (negate)
        // z follows F (negate)
        if (sliceVal === Infinity || ['x', 'y', 'z', 'X', 'Y', 'Z'].includes(axisStr)) {
            axisVector.negate();
        }
    }

    state.pivot.rotation.set(0, 0, 0);
    state.pivot.position.set(0, 0, 0);
    state.cubeWrapper.add(state.pivot);
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
        const ease = 1 - Math.pow(1 - progress, 3);
        const current = startAngle + (targetAngle - startAngle) * ease;

        state.pivot.setRotationFromAxisAngle(rotAxis, current);

        if (progress < 1) {
            requestAnimationFrame(loop);
        } else {
            finishMove(turns, axis, sliceVal);
            if (turns !== 0) {
                let normalizedTurns = turns;
                // Normalize turns to positive axis direction if drag axis is negative
                if (state.dragRotationAxis) {
                    if (axis === 'x' && state.dragRotationAxis.x < -0.5) normalizedTurns *= -1;
                    if (axis === 'y' && state.dragRotationAxis.y < -0.5) normalizedTurns *= -1;
                    if (axis === 'z' && state.dragRotationAxis.z < -0.5) normalizedTurns *= -1;
                }
                logMove(axis, sliceVal, normalizedTurns);
            }
        }
    }
    loop();
}

export function attachSliceToPivot() {
    state.pivot.rotation.set(0, 0, 0);
    state.pivot.position.set(0, 0, 0);
    state.cubeWrapper.add(state.pivot);
    let cubies;
    if (state.dragSliceValue === Infinity) {
        console.log("Attaching ALL cubies (Whole Cube Rotation)");
        cubies = state.allCubies;
    } else {
        const epsilon = 0.5;
        cubies = state.allCubies.filter(c => Math.abs(c.position[state.dragAxis] - state.dragSliceValue) < epsilon);
        console.log(`Attaching Slice Cubies. Axis: ${state.dragAxis}, Val: ${state.dragSliceValue}, Count: ${cubies.length}`);
    }
    cubies.forEach(c => state.pivot.attach(c));
}

export function logMove(axis, sliceVal, turns) {
    if (state.isScrambling || state.isAutoSolving) return;

    // Convert internal move to notation
    // axis: 'x', 'y', 'z'
    // sliceVal: position of slice
    // turns: number of 90 deg turns (1, -1, 2)

    const S = CUBE_SIZE + (state.activePuzzle ? state.activePuzzle.getSpacing() : SPACING);
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

    if (state.isBackgroundDrag || sliceVal === Infinity) {
        // Whole cube rotations
        if (axis === 'x') char = 'x';
        else if (axis === 'y') char = 'y';
        else if (axis === 'z') char = 'z';

        // Invert notation for whole cube rotations to match user expectation
        // User wants visual direction to be opposite of notation
        notationTurns *= -1;
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

    const upperKey = key.toUpperCase();
    const shift = event.shiftKey;
    const direction = shift ? -1 : 1;

    if (['R', 'L', 'U', 'D', 'F', 'B', 'M', 'E', 'S', 'X', 'Y', 'Z'].includes(upperKey)) {
        let axis = '';
        if (['R', 'L', 'M', 'X'].includes(upperKey)) axis = 'x';
        else if (['U', 'D', 'E', 'Y'].includes(upperKey)) axis = 'y';
        else if (['F', 'B', 'S', 'Z'].includes(upperKey)) axis = 'z';

        let finalDir = direction;
        if (isFaceRectangular(axis)) {
            finalDir = 2;
        }

        // Determine layer from held keys
        let layer = 1;
        if (state.activeKeys.has('0') || state.activeKeys.has(')')) layer = 10;
        else if (state.activeKeys.has('9') || state.activeKeys.has('(')) layer = 9;
        else if (state.activeKeys.has('8') || state.activeKeys.has('*')) layer = 8;
        else if (state.activeKeys.has('7') || state.activeKeys.has('&')) layer = 7;
        else if (state.activeKeys.has('6') || state.activeKeys.has('^')) layer = 6;
        else if (state.activeKeys.has('5') || state.activeKeys.has('%')) layer = 5;
        else if (state.activeKeys.has('4') || state.activeKeys.has('$')) layer = 4;
        else if (state.activeKeys.has('3') || state.activeKeys.has('#')) layer = 3;
        else if (state.activeKeys.has('2') || state.activeKeys.has('@')) layer = 2;

        // Validate M, E, S moves on even puzzles
        const dims = state.activeDimensions || state.cubeDimensions;
        const axisDim = dims[axis];
        if (['M', 'E', 'S'].includes(upperKey)) {
            if (axisDim % 2 === 0) return; // Cannot do middle slice on even puzzles
        }

        // Validate layer bounds
        if (layer > axisDim) return; // Cannot rotate a layer that doesn't exist

        let sliceVal = null;
        if (['X', 'Y', 'Z'].includes(upperKey)) {
            sliceVal = Infinity;
        } else if (layer > 1 && !['M', 'E', 'S'].includes(upperKey)) {
            const S = CUBE_SIZE + (state.activePuzzle ? state.activePuzzle.getSpacing() : SPACING);
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
