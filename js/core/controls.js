import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { state } from '../shared/state.js';
import { CUBE_SIZE, SPACING } from '../shared/constants.js';
import { updateZoomDisplay } from './scene.js';

export function initControls(renderer) {
    state.controls = new OrbitControls(state.camera, renderer.domElement);
    state.controls.enableDamping = true;
    state.controls.enablePan = false;
    state.controls.enabled = true;
    state.controls.enableRotate = false;
    state.controls.enableZoom = true;
    // minDistance and maxDistance will be set dynamically in adjustCameraForCubeSize
}

export function adjustCameraForCubeSize(relativeZoom = null) {
    const S = CUBE_SIZE + SPACING;
    const cubePhysicalSize = state.cubeSize * S;

    // Get viewport dimensions
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspectRatio = width / height;
    const smallestDimension = Math.min(width, height);

    // Camera FOV in degrees (must match the camera setup)
    const fov = 45;
    const fovRadians = (fov * Math.PI) / 180;

    // We want the cube to take up ~2/3 of the smaller viewport dimension
    const targetCoverage = 2 / 3;

    // The cube is tilted in isometric view, so we see it at an angle
    // Approximate the apparent size as sqrt(2) times the physical size
    const apparentCubeSize = cubePhysicalSize * Math.sqrt(2);

    // We want to ensure the cube fits comfortably in BOTH width and height.
    // Logic: "Whatever is smaller: 2/3 of the width OR 55/100 of the height"
    // This means we calculate the distance required for both constraints and take the MAXIMUM distance (limiting factor).

    // Constraint 1: Cube occupies 85% (0.85) of the visible width
    // visibleWidth = apparentCubeSize / 0.85
    // d = visibleWidth / (2 * tan(fov/2) * aspectRatio)
    const distForWidth = apparentCubeSize / (2 * Math.tan(fovRadians / 2) * aspectRatio * 0.85);

    // Constraint 2: Cube occupies 55% (0.55) of the visible height
    // visibleHeight = apparentCubeSize / 0.55
    // d = visibleHeight / (2 * Math.tan(fovRadians / 2))
    const distForHeight = apparentCubeSize / (2 * Math.tan(fovRadians / 2) * 0.55);

    // Required distance is the one that satisfies BOTH (the larger distance pushes camera further back)
    const requiredDistance = Math.max(distForWidth, distForHeight);

    // Calculate dynamic zoom limits
    // Max zoom: cube takes up 300% of smallest dimension (allows zooming in very tight)
    const maxZoomCoverage = 1.5; // Increased from 0.95 to allow tighter zoom
    let maxZoomDistance;
    if (width <= height) {
        maxZoomDistance = apparentCubeSize / (2 * Math.tan(fovRadians / 2) * aspectRatio * maxZoomCoverage);
    } else {
        maxZoomDistance = apparentCubeSize / (2 * Math.tan(fovRadians / 2) * maxZoomCoverage);
    }

    // Min zoom: cube takes up 20% of smallest dimension
    const minZoomCoverage = 0.20;
    let minZoomDistance;
    if (width <= height) {
        minZoomDistance = apparentCubeSize / (2 * Math.tan(fovRadians / 2) * aspectRatio * minZoomCoverage);
    } else {
        minZoomDistance = apparentCubeSize / (2 * Math.tan(fovRadians / 2) * minZoomCoverage);
    }

    // Update OrbitControls limits
    state.controls.minDistance = maxZoomDistance; // minDistance is max zoom (closer)
    state.controls.maxDistance = minZoomDistance; // maxDistance is min zoom (farther)

    // Update zoom slider limits
    const zoomSlider = document.getElementById('zoom-slider');
    if (zoomSlider) {
        zoomSlider.min = maxZoomDistance.toFixed(1);
        zoomSlider.max = minZoomDistance.toFixed(1);
    }

    // Updated Calculation using State Settings
    const azimuthRad = (state.cameraSettings?.azimuth ?? 45) * (Math.PI / 180);
    const elevationRad = (state.cameraSettings?.elevation ?? 55) * (Math.PI / 180);

    // Spherical to Cartesian (Y-up)
    // r = 1 (normalized direction)
    // y = sin(elevation)
    // h = cos(elevation)
    // x = h * sin(azimuth)
    // z = h * cos(azimuth)

    const y = Math.sin(elevationRad);
    const h = Math.cos(elevationRad);
    const x = h * Math.sin(azimuthRad);
    const z = h * Math.cos(azimuthRad);

    const direction = new THREE.Vector3(x, y, z).normalize();

    // Use passed relativeZoom if available
    let zoomFactor = relativeZoom;
    let finalDistance;

    // If explicit zoom is NOT provided, use our calculated 'optimal' requiredDistance
    if (zoomFactor === null || zoomFactor === undefined) {
        finalDistance = requiredDistance;

        // Update state.cameraSettings.zoom to match this new distance
        // Logic: finalDistance = maxZoomDistance + zoomFactor * (minZoomDistance - maxZoomDistance);
        // Therefore: zoomFactor = (finalDistance - maxZoomDistance) / (minZoomDistance - maxZoomDistance);
        if (minZoomDistance !== maxZoomDistance) {
            zoomFactor = (finalDistance - maxZoomDistance) / (minZoomDistance - maxZoomDistance);
            zoomFactor = Math.max(0, Math.min(1, zoomFactor));
        } else {
            zoomFactor = 0.5;
        }

        if (!state.cameraSettings) state.cameraSettings = {};
        state.cameraSettings.zoom = zoomFactor;

        // Sync slider if present
        const zoomSlider = document.getElementById('camera-zoom-slider');
        const zoomInput = document.getElementById('camera-zoom-input');
        if (zoomSlider) zoomSlider.value = zoomFactor;
        if (zoomInput) zoomInput.value = zoomFactor.toFixed(2);

    } else {
        // Use the provided zoom factor (e.g. from slider/tuner)
        finalDistance = maxZoomDistance + zoomFactor * (minZoomDistance - maxZoomDistance);
    }

    state.camera.position.copy(direction.multiplyScalar(finalDistance));
    state.controls.alignCameraUpInZ = false; // Ensure Y-up
    state.camera.lookAt(state.controls.target);
    state.controls.update();

    // Update the zoom display if it's visible
    const zoomBar = document.getElementById('zoom-bar');
    if (zoomBar && !zoomBar.classList.contains('hidden')) {
        updateZoomDisplay();
    }
}

export function updateCameraFromKeys() {
    if (!state.activeKeys || state.activeKeys.size === 0) return;

    const rotateSpeed = 0.015; // Radians per frame (smooth)
    let moved = false;
    let dTheta = 0;
    let dPhi = 0;

    if (state.activeKeys.has('ArrowRight')) {
        dTheta += rotateSpeed; // Inverted: Right arrow moves camera right (orbits left)
        moved = true;
    }
    if (state.activeKeys.has('ArrowLeft')) {
        dTheta -= rotateSpeed; // Inverted: Left arrow moves camera left (orbits right)
        moved = true;
    }
    if (state.activeKeys.has('ArrowUp')) {
        dPhi -= rotateSpeed;
        moved = true;
    }
    if (state.activeKeys.has('ArrowDown')) {
        dPhi += rotateSpeed;
        moved = true;
    }

    if (moved) {
        const offset = new THREE.Vector3();
        offset.copy(state.camera.position).sub(state.controls.target);

        const spherical = new THREE.Spherical();
        spherical.setFromVector3(offset);

        spherical.theta += dTheta;
        spherical.phi += dPhi;

        spherical.makeSafe();
        offset.setFromSpherical(spherical);

        state.camera.position.copy(state.controls.target).add(offset);
        state.camera.lookAt(state.controls.target);
        state.controls.update();
    }
}
