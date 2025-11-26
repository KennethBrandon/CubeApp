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

        // Disable camera rotation while dragging a slice
        if (state.controls) state.controls.enableRotate = false;
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
            if (state.dragAxis !== 'free') {
                attachSliceToPivot();
            }
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

        if (state.isBackgroundDrag && state.freeRotation) {
            // Rotate the wrapper
            // Axis is perpendicular to drag direction in screen space
            // We need to convert this to a world axis

            // 1. Get drag vector in screen space
            const dragVecScreen = new THREE.Vector2(deltaX, deltaY).normalize();

            // 2. Rotation axis is perpendicular to drag vector
            // Screen Y is inverted relative to 3D Y, so we use (y, x) instead of (-y, x)
            const rotAxisScreen = new THREE.Vector2(dragVecScreen.y, dragVecScreen.x);

            // 3. Convert screen axis to world axis (camera space -> world space)
            // We want to rotate around an axis that lies in the plane perpendicular to the camera view
            const rotAxisWorld = new THREE.Vector3(rotAxisScreen.x, rotAxisScreen.y, 0);
            rotAxisWorld.applyQuaternion(state.camera.quaternion);
            rotAxisWorld.normalize();

            // 4. Apply rotation to wrapper
            // We use a sensitivity factor
            const angle = Math.sqrt(deltaX * deltaX + deltaY * deltaY) * sensitivity;

            // Rotate wrapper around world axis
            // We need to rotate the wrapper in world space
            state.cubeWrapper.rotateOnWorldAxis(rotAxisWorld, angle);

            // Reset drag start point for continuous rotation
            state.dragStartPoint.set(pos.x, pos.y);
            state.currentDragAngle = 0; // Reset since we applied it
        } else {
            // Normal slice rotation or constrained background rotation
            if (state.pivot.children.length > 9 && !state.isBackgroundDrag) {
                console.warn("WARNING: Pivot has too many children for a slice move!", state.pivot.children.length);
            }
            state.pivot.rotation.set(0, 0, 0);
            state.pivot.rotateOnAxis(state.dragRotationAxis, state.currentDragAngle);
        }
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
        // If we were doing free rotation background drag, we don't snap
        if (state.freeRotation && state.isBackgroundDrag) {
            // Do nothing, rotation is already applied to wrapper
            state.cubeWrapper.updateMatrixWorld(true);
        } else {
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
        if (state.freeRotation) {
            // Set dummy values to allow dragging
            state.dragAxis = 'free';
            state.dragInputAxis = 'free';
            state.dragSliceValue = Infinity;
            state.dragAngleScale = 1;
            state.dragRotationAxis = new THREE.Vector3(1, 0, 0); // Dummy
            return;
        }

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
        console.log("Drag Axis Determined:", dragData);
        state.dragAxis = dragData.dragAxis;
        state.dragRotationAxis = dragData.dragRotationAxis;
        state.dragInputAxis = dragData.dragInputAxis;
        state.dragAngleScale = dragData.dragAngleScale;
        state.dragSliceValue = dragData.dragSliceValue;
    } else {
        console.log("No Drag Axis Determined");
    }
}

function isFaceRectangular(axis) {
    return state.activePuzzle.isFaceRectangular(axis);
}
