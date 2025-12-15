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

    let requiredDistance;
    if (width <= height) {
        // Width is smaller, constrain by width
        // visibleWidth at distance d: w = 2 * d * tan(fov/2) * aspectRatio
        // We want: apparentCubeSize = w * targetCoverage
        requiredDistance = apparentCubeSize / (2 * Math.tan(fovRadians / 2) * aspectRatio * targetCoverage);
    } else {
        // Height is smaller, constrain by height
        // visibleHeight at distance d: h = 2 * d * tan(fov/2)
        // We want: apparentCubeSize = h * targetCoverage
        requiredDistance = apparentCubeSize / (2 * Math.tan(fovRadians / 2) * targetCoverage);
    }

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

    // Use passed relativeZoom if available, otherwise use state default
    let zoomFactor = relativeZoom;
    if (zoomFactor === null || zoomFactor === undefined) {
        zoomFactor = state.cameraSettings?.zoom ?? 0.5; // Default middle if not set
    }

    // Update the slider to match state if we are being called externally (e.g. initial load)
    const existingZoomSlider = document.getElementById('zoom-slider');
    if (existingZoomSlider && document.activeElement !== existingZoomSlider) {
        // Map 0..1 back to distance ? No, the slider is distance based.
        // We need to be careful not to fight the UI.
        // Actually, the app uses 'zoom-slider' for distance.
        // Our tuner uses a separate 'zoom factor' 0..1.
        // Let's keep them somewhat separate or sync them?
        // For now, let's respect the Tuner's zoomFactor for determining distance.
    }


    let finalDistance = requiredDistance;
    // Interpolate between min and max based on ratio
    // ratio 0 = minDistance (max zoom, closest)
    // ratio 1 = maxDistance (min zoom, farthest)

    // NOTE: In the Tuner, 0 should probably be far and 1 near? Or standard slider logic.
    // original logic: ratio = (current - min) / (max - min)
    // 0 = min (closest), 1 = max (farthest) ?
    // Wait, earlier code:
    // minDistance = maxZoomDistance (Small number, close)
    // maxDistance = minZoomDistance (Large number, far)
    // So controls.minDistance < controls.maxDistance.

    // Let's treat Tuner Zoom as 0 (Far) to 1 (Close) ? Or 0 (Close) to 1 (Far)?
    // The previous logic used 'relativeZoom' which seemed to come from linear interpolation.
    // Let's stick to: 0 = Closest (minDistance), 1 = Farthest (maxDistance)
    // Wait, standard zoom usually means "Magnification", so higher = closer.
    // But 'distance' slider usually means "Distance", so higher = farther.
    // Let's assume Tuner "Zoom Factor" 0 -> Max Distance (Far), 1 -> Min Distance (Close).

    // In original code: 
    // `finalDistance = maxZoomDistance + relativeZoom * (minZoomDistance - maxZoomDistance)`
    // If relativeZoom = 0: maxZoomDistance (Close)
    // If relativeZoom = 1: minZoomDistance (Far)

    // This implies relativeZoom is "Distance Factor" (0=Close, 1=Far).
    // Let's use that.

    finalDistance = maxZoomDistance + zoomFactor * (minZoomDistance - maxZoomDistance);

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
