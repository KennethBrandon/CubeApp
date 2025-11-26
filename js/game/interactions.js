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

    const screenMoveVec = new THREE.Vector2(dx, dy).normalize();
    const dragData = state.activePuzzle.getDragAxis(
        state.intersectedFaceNormal,
        screenMoveVec,
        state.intersectedCubie,
        state.camera
    );

    if (dragData) {
        state.dragAxis = dragData.dragAxis;
        state.dragRotationAxis = dragData.dragRotationAxis;
        state.dragInputAxis = dragData.dragInputAxis;
        state.dragAngleScale = dragData.dragAngleScale;
        state.dragSliceValue = dragData.dragSliceValue;
    }
}

function isFaceRectangular(axis) {
    return state.activePuzzle.isFaceRectangular(axis);
}
