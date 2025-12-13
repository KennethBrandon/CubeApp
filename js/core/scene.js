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
    state.renderer.shadowMap.enabled = true;
    state.renderer.shadowMap.type = THREE.VSMShadowMap; // Better softness
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
    dirLight.shadow.bias = -0.0001; // Reduce acne
    dirLight.shadow.radius = 1; // Default softness
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

export function updateLighting(params) {
    // 1. Shadow Intensity (Coupled Dir + Ambient)
    if (params.shadowIntensity !== undefined && lights.ambient && lights.dir) {
        const t = params.shadowIntensity; // 0 (Faint) to 1 (Strong)

        // Target Total Brightness ~ 2.0
        // T=0: Dir 0.5, Amb 1.5 -> Contrast 1.33 (Faint shadow)
        // T=1: Dir 1.8, Amb 0.2 -> Contrast 10.0 (Dark shadow)
        // Default T=0.1: Dir 0.63, Amb 1.37

        const minDir = 0.5;
        const maxDir = 1.8;
        const dirIntensity = minDir + (t * (maxDir - minDir));
        const ambIntensity = 2.0 - dirIntensity;

        lights.dir.intensity = dirIntensity;
        lights.ambient.intensity = ambIntensity;
    }

    // 2. Shadows Enabled (Existing Logic)
    if (params.shadowsEnabled !== undefined && lights.dir) {
        lights.dir.castShadow = params.shadowsEnabled;
    }

    // 3. Light Direction (Azimuth/Elevation)
    if ((params.lightAzimuth !== undefined || params.lightElevation !== undefined) && lights.dir) {
        // Defaults if one is missing, based on initial pos (10, 20, 10)
        // R ~= 24.5
        const r = 24.5;
        // Azimuth ~ 45 deg, Elevation ~ 55 deg.
        // But we just use whatever is passed or current logic if we tracked it.
        // For simplicity, we expect the tuner to pass both or we use stored defaults in Tuner.
        // Let's assume params has them if we differ from default.

        const azimuth = params.lightAzimuth !== undefined ? params.lightAzimuth * (Math.PI / 180) : Math.PI / 4;
        const elevation = params.lightElevation !== undefined ? params.lightElevation * (Math.PI / 180) : Math.PI / 3;

        // Spherical to Cartesian (Y up)
        // y = r * sin(elevation)
        // h = r * cos(elevation) (horizontal projection radius)
        // x = h * sin(azimuth)
        // z = h * cos(azimuth)

        const y = r * Math.sin(elevation);
        const h = r * Math.cos(elevation);
        const x = h * Math.sin(azimuth);
        const z = h * Math.cos(azimuth);

        lights.dir.position.set(x, y, z);
    }

    // 4. Shadow Softness (Radius)
    if (params.shadowSoftness !== undefined && lights.dir) {
        lights.dir.shadow.radius = params.shadowSoftness;
        // ensure blurSamples is high enough if needed, default 8 is usually fine.
        lights.dir.shadow.blurSamples = 8;
    }
}

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
