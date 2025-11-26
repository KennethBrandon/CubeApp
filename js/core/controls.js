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
    // Max zoom: cube takes up 95% of smallest dimension
    const maxZoomCoverage = 0.95;
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

    // Maintain the camera angle
    const direction = new THREE.Vector3(6, 6, 12).normalize();

    let finalDistance = requiredDistance;
    if (relativeZoom !== null && relativeZoom !== undefined) {
        // Interpolate between min and max based on ratio
        // ratio 0 = minDistance (max zoom, closest)
        // ratio 1 = maxDistance (min zoom, farthest)
        finalDistance = maxZoomDistance + relativeZoom * (minZoomDistance - maxZoomDistance);
    }

    state.camera.position.copy(direction.multiplyScalar(finalDistance));
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
