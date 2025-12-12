import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { state } from '../shared/state.js';
import { updateCameraFromKeys } from './controls.js';

// FPS tracking variables
let lastTime = performance.now();
let frameCount = 0;
let fps = 60;

export function initScene() {
    const container = document.getElementById('canvas-container');
    if (!container) {
        return false;
    }

    // Safety check for cubeDimensions (in case of caching issues)
    if (!state.cubeDimensions) {
        state.cubeDimensions = { x: state.cubeSize, y: state.cubeSize, z: state.cubeSize };
    }

    state.scene = new THREE.Scene();
    state.scene.background = new THREE.Color(0x050505);

    state.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    state.camera.position.set(6, 6, 12);

    state.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    state.renderer.setSize(window.innerWidth, window.innerHeight);
    state.renderer.setPixelRatio(window.devicePixelRatio);
    state.renderer.shadowMap.enabled = true; // Enable shadows
    container.appendChild(state.renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    state.scene.add(ambientLight);
    lights.ambient = ambientLight;

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    // Adjust shadow camera frustum to cover the desk area
    const d = 15;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    state.scene.add(dirLight);
    lights.dir = dirLight;

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    fillLight.position.set(-10, 0, 10);
    state.scene.add(fillLight);
    lights.fill = fillLight;

    const backLight = new THREE.DirectionalLight(0xffffff, 1.0);
    backLight.position.set(-10, 10, -10);
    state.scene.add(backLight);
    lights.back = backLight;

    state.scene.add(state.pivot);

    return true;
}

const lights = {
    ambient: null,
    dir: null,
    fill: null,
    back: null
};

export function setShadowIntensity(intensity) {
    if (!lights.ambient) return;
    // Intensity 0.0 -> Dark shadows -> Low Ambient (e.g. 0.2)
    // Intensity 1.0 -> Light shadows -> High Ambient (e.g. 0.8)
    // Default Ambient was 0.6.

    // Let's say range 0.1 to 0.9
    // Invert logic: User sees "Shadow Intensity".
    // High Shadow Intensity = Darker Shadows = Lower Ambient.
    // Low Shadow Intensity = Lighter Shadows = Higher Ambient.

    const minAmbient = 0.2;
    const maxAmbient = 0.8;

    // intensity is 0..1 (Slider)
    // if intensity is 1 (Strong Shadows), ambient should be minAmbient.
    // if intensity is 0 (Weak Shadows), ambient should be maxAmbient.

    const newAmbient = maxAmbient - (intensity * (maxAmbient - minAmbient));
    lights.ambient.intensity = newAmbient;

    // Optionally boost directional light slightly when ambient is low to simulate high contrast?
    // Not strictly necessary but can look nice.
}

export function setShadowsEnabled(enabled) {
    if (lights.dir) {
        lights.dir.castShadow = enabled;
    }
}

export function onWindowResize() {
    state.camera.aspect = window.innerWidth / window.innerHeight;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(window.innerWidth, window.innerHeight);
}

export function animate() {
    requestAnimationFrame(animate);

    // Calculate FPS
    const currentTime = performance.now();
    frameCount++;
    if (currentTime >= lastTime + 1000) {
        fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        frameCount = 0;
        lastTime = currentTime;
        const fpsValue = document.getElementById('fps-value');
        if (fpsValue) fpsValue.textContent = fps;
    }

    // ... inside animate

    // ... inside animate
    if (state.controls) {
        updateCameraFromKeys(); // Check keys
        state.controls.update();
    }

    if (state.renderer && state.scene && state.camera) {
        state.renderer.render(state.scene, state.camera);
    }
}

// Update zoom display UI elements
export function updateZoomDisplay() {
    const distance = state.camera.position.length();
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomValueInput = document.getElementById('zoom-value-input');
    if (zoomSlider) zoomSlider.value = distance.toFixed(1);
    if (zoomValueInput) zoomValueInput.value = distance.toFixed(1);
}
