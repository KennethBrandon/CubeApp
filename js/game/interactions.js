import * as THREE from 'three';
import { state } from '../shared/state.js';
import { CUBE_SIZE, SPACING } from '../shared/constants.js';
import { startTimer } from './timer.js';
import { attachSliceToPivot, snapPivot } from './moves.js';

export function setupEventListeners(canvas) {
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onMouseUp);
}

export function onMouseDown(event) {
    if (state.isAnimating || state.isScrambling || state.isAutoSolving) return;

    const intersects = getIntersects(event, state.renderer.domElement);
    const pos = getPointerPos(event);

    if (intersects.length > 0) {
        state.isDragging = true;
        state.isBackgroundDrag = false;
        state.intersectedCubie = intersects[0].object.parent;
        state.intersectedFaceNormal = intersects[0].face.normal.clone();
        state.intersectedFaceNormal.transformDirection(intersects[0].object.matrixWorld).round();
        state.dragStartPoint.set(pos.x, pos.y);
        state.dragAxis = null;
        state.dragInputAxis = null;
        state.currentDragAngle = 0;
    } else {
        state.isDragging = true;
        state.isBackgroundDrag = true;
        state.intersectedCubie = null;
        state.dragStartPoint.set(pos.x, pos.y);
        state.dragAxis = null;
        state.dragInputAxis = null;
        state.currentDragAngle = 0;

        const S = CUBE_SIZE + SPACING;
        const referencePointWorld = new THREE.Vector3(S * 1.5, 0, S * 1.5);
        const tempCamera = state.camera.clone();
        tempCamera.rotation.setFromRotationMatrix(state.controls.object.matrix);
        const projectedPoint = referencePointWorld.clone().project(tempCamera);
        const boundaryX = (projectedPoint.x * 0.5 + 0.5) * window.innerWidth;
        state.isRightZone = (pos.x > boundaryX);
    }
}

export function onTouchStart(event) {
    event.preventDefault();
    onMouseDown(event);
}

export function onMouseMove(event) {
    if (!state.isDragging) return;

    const pos = getPointerPos(event);
    const deltaX = pos.x - state.dragStartPoint.x;
    const deltaY = pos.y - state.dragStartPoint.y;

    if (!state.dragAxis) {
        if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return;
        determineDragAxis(deltaX, deltaY);
        if (state.dragAxis) {
            attachSliceToPivot();
            if (!state.isScrambling && !state.isAutoSolving && !state.isBackgroundDrag) {
                // Only start timer if game is active AND puzzle has been scrambled
                if (!state.timerRunning && state.isGameActive && state.hasBeenScrambled) {
                    startTimer();
                }
            }
        }
    }

    if (state.dragAxis) {
        const sensitivity = 0.01;
        let delta = 0;
        if (state.dragInputAxis === 'x') delta = deltaX;
        else if (state.dragInputAxis === 'y') delta = deltaY;
        else delta = (Math.abs(deltaX) > Math.abs(deltaY)) ? deltaX : deltaY;

        state.currentDragAngle = delta * sensitivity * state.dragAngleScale;
        state.pivot.setRotationFromAxisAngle(state.dragRotationAxis, state.currentDragAngle);
    }
}

export function onTouchMove(event) {
    event.preventDefault();
    onMouseMove(event);
}

export function onMouseUp() {
    if (!state.isDragging) {
        if (state.controls) state.controls.enabled = true;
        return;
    }
    state.isDragging = false;
    if (state.controls) state.controls.enabled = true;

    if (state.dragAxis) {
        const piHalf = Math.PI / 2;
        const rawTurns = state.currentDragAngle / piHalf;
        let targetTurns = Math.round(rawTurns);

        // Check if face is rectangular AND not background drag
        if (!state.isBackgroundDrag && isFaceRectangular(state.dragAxis)) {
            // Force even turns (180 degrees)
            targetTurns = Math.round(rawTurns / 2) * 2;
        } else {
            if (Math.abs(rawTurns - Math.trunc(rawTurns)) < 0.2) targetTurns = Math.trunc(rawTurns);
        }

        const targetAngle = targetTurns * piHalf;
        snapPivot(targetAngle, targetTurns, state.dragAxis, state.dragSliceValue);
    }

    state.intersectedCubie = null;
    state.dragAxis = null;
    state.dragInputAxis = null;
}

function getPointerPos(event) {
    if (event.changedTouches && event.changedTouches.length > 0) {
        return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
    } else if (event.touches && event.touches.length > 0) {
        return { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
    return { x: event.clientX, y: event.clientY };
}

function getIntersects(event, element) {
    const rect = element.getBoundingClientRect();
    const pos = getPointerPos(event);
    state.mouse.x = ((pos.x - rect.left) / rect.width) * 2 - 1;
    state.mouse.y = -((pos.y - rect.top) / rect.height) * 2 + 1;
    state.raycaster.setFromCamera(state.mouse, state.camera);
    const cores = [];
    state.allCubies.forEach(g => {
        g.children.forEach(c => {
            if (!c.userData.isSticker) cores.push(c);
        });
    });
    return state.raycaster.intersectObjects(cores, false);
}

function determineDragAxis(dx, dy) {
    const moveX = Math.abs(dx) > Math.abs(dy);

    if (state.isBackgroundDrag) {
        if (moveX) {
            state.dragRotationAxis = new THREE.Vector3(0, 1, 0);
            state.dragAngleScale = 1;
            state.dragAxis = 'y';
            state.dragInputAxis = 'x';
        } else {
            if (state.isRightZone) {
                state.dragRotationAxis = new THREE.Vector3(0, 0, 1);
                state.dragAngleScale = -1;
                state.dragAxis = 'z';
                state.dragInputAxis = 'y';
            } else {
                state.dragRotationAxis = new THREE.Vector3(1, 0, 0);
                state.dragAngleScale = 1;
                state.dragAxis = 'x';
                state.dragInputAxis = 'y';
            }
        }
        state.dragSliceValue = Infinity;
        return;
    }

    const axes = [
        { vec: new THREE.Vector3(1, 0, 0), name: 'x' },
        { vec: new THREE.Vector3(0, 1, 0), name: 'y' },
        { vec: new THREE.Vector3(0, 0, 1), name: 'z' }
    ];
    const validAxes = axes.filter(a => Math.abs(a.vec.dot(state.intersectedFaceNormal)) < 0.1);
    let bestMatch = null;
    let bestDot = -1;
    const screenMoveVec = new THREE.Vector2(dx, dy).normalize();

    validAxes.forEach(axis => {
        const startPoint = state.intersectedCubie.position.clone();
        const endPoint = startPoint.clone().add(axis.vec);
        startPoint.project(state.camera);
        endPoint.project(state.camera);
        const screenAxisVec = new THREE.Vector2(
            endPoint.x - startPoint.x,
            -(endPoint.y - startPoint.y)
        ).normalize();
        const dot = Math.abs(screenAxisVec.dot(screenMoveVec));
        if (dot > bestDot) {
            bestDot = dot;
            bestMatch = { moveAxis: axis, screenVec: screenAxisVec };
        }
    });

    if (bestMatch) {
        const moveAxisVec = bestMatch.moveAxis.vec;
        const rotAxisRaw = new THREE.Vector3().crossVectors(moveAxisVec, state.intersectedFaceNormal).normalize();
        let maxComp = 0;
        let finalRotAxis = new THREE.Vector3();
        let finalAxisName = 'x';

        if (Math.abs(rotAxisRaw.x) > maxComp) { maxComp = Math.abs(rotAxisRaw.x); finalRotAxis.set(Math.sign(rotAxisRaw.x), 0, 0); finalAxisName = 'x'; }
        if (Math.abs(rotAxisRaw.y) > maxComp) { maxComp = Math.abs(rotAxisRaw.y); finalRotAxis.set(0, Math.sign(rotAxisRaw.y), 0); finalAxisName = 'y'; }
        if (Math.abs(rotAxisRaw.z) > maxComp) { maxComp = Math.abs(rotAxisRaw.z); finalRotAxis.set(0, 0, Math.sign(rotAxisRaw.z)); finalAxisName = 'z'; }

        state.dragRotationAxis = finalRotAxis;
        state.dragAxis = finalAxisName;

        if (Math.abs(bestMatch.screenVec.x) > Math.abs(bestMatch.screenVec.y)) {
            state.dragInputAxis = 'x';
        } else {
            state.dragInputAxis = 'y';
        }

        const inputVec = (state.dragInputAxis === 'x') ? new THREE.Vector2(1, 0) : new THREE.Vector2(0, 1);
        const directionCheck = bestMatch.screenVec.dot(inputVec);
        const axisAlignment = finalRotAxis.dot(rotAxisRaw);
        state.dragAngleScale = -1 * (directionCheck > 0 ? 1 : -1) * Math.sign(axisAlignment);

        const S = CUBE_SIZE + SPACING;
        const p = state.intersectedCubie.position[state.dragAxis];

        // Snap to nearest layer
        // Snap to nearest layer (0.5 steps) to handle both even and odd dimensions correctly
        // even after whole cube rotations.
        state.dragSliceValue = Math.round(p / S * 2) / 2 * S;
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
