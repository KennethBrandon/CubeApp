import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { state } from '../shared/state.js';
import { setShadowIntensity, setShadowsEnabled } from './scene.js';

export function createEnvironment() {
    // Remove old environment objects if any
    const objectsToRemove = [];
    state.scene.traverse(obj => {
        if (obj.userData.isDesk || obj.userData.isWall) {
            objectsToRemove.push(obj);
        }
    });

    objectsToRemove.forEach(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
        }
        state.scene.remove(obj);
    });

    // 1. Create Wood Texture for Desk
    const woodTexture = createWoodTexture();

    // Scale desk size based on cube size
    const baseDeskSize = 40;
    const deskSize = baseDeskSize * (state.cubeSize / 3);
    const deskGeometry = new THREE.PlaneGeometry(deskSize, deskSize);
    const deskMaterial = new THREE.MeshStandardMaterial({
        map: woodTexture,
        color: 0x5D4037, // Fallback / Tint
        roughness: 0.9,
        metalness: 0.1
    });

    // Lower desk for larger cubes, raise for smaller cubes
    // Scale proportionally around 3x3 baseline, plus extra offset for spacing
    const baseYPosition = -2.05;
    const proportionalOffset = (state.cubeSize / 3 - 1) * 2.0;
    const spacingOffset = state.cubeSize * 0.3; // ~quarter of cube height for spacing
    const desk = new THREE.Mesh(deskGeometry, deskMaterial);
    desk.rotation.x = -Math.PI / 2;
    desk.position.y = baseYPosition - proportionalOffset - spacingOffset;
    desk.receiveShadow = true;
    desk.userData.isDesk = true;
    state.scene.add(desk);

    // 2. Create Back Wall
    // Scale wall size based on cube size
    const baseWallWidth = 40;
    const baseWallHeight = 20;
    const wallWidth = baseWallWidth * (state.cubeSize / 3);
    const wallHeight = baseWallHeight * (state.cubeSize / 3);
    const wallGeometry = new THREE.PlaneGeometry(wallWidth, wallHeight);
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0x2c3e50, // Dark slate
        roughness: 0.8,
        metalness: 0.2
    });

    // Scale wall distance based on cube size
    // Base distance of 3 for 3x3, scale proportionally
    const baseDistance = 3;
    const wallDistance = baseDistance * (state.cubeSize / 3);

    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    // Position wall based on cube size - further for larger cubes
    wall.position.set(-wallDistance, 0, -wallDistance);
    wall.lookAt(0, 0, 0);
    wall.translateZ(-0.5); // Move 'back' relative to lookAt vector to sit behind mirror

    // Scale up slightly to ensure no edges visible
    wall.scale.set(1.5, 1.5, 1);

    wall.receiveShadow = true;
    wall.userData.isWall = true;
    state.scene.add(wall);

    // Apply default environment settings (pattern enabled by default with specific colors)
    updateEnvironment({
        shadowsEnabled: true,
        shadowIntensity: 0.35,
        lightAzimuth: -15,
        lightElevation: 55,
        shadowSoftness: 9.0,
        patternEnabled: true,
        patternScale: 1.0,
        patternOpacity: 0.30,
        patternColors: ['#69A6E2', '#22458C', '#5E3295'],
        forceUpdate: true
    });
}

function createWoodTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base
    ctx.fillStyle = '#8D6E63';
    ctx.fillRect(0, 0, 512, 512);

    // Grain
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.3;

    for (let i = 0; i < 150; i++) {
        const x = Math.random() * 512;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        // Wobbly lines
        ctx.bezierCurveTo(
            x + Math.random() * 40 - 20, 150,
            x + Math.random() * 40 - 20, 350,
            x + Math.random() * 40 - 20, 512
        );
        ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4); // Tile it
    return tex;
}

export function createMirrors() {
    // Remove previous mirrors if any
    const objectsToRemove = [];
    state.scene.traverse(obj => {
        if (obj.userData.isMirror) {
            objectsToRemove.push(obj);
        }
    });

    objectsToRemove.forEach(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
        // Special handling for Reflector objects
        if (obj.getRenderTarget) {
            const renderTarget = obj.getRenderTarget();
            if (renderTarget) renderTarget.dispose();
        }
        state.scene.remove(obj);
    });

    // Scale mirror size based on cube size to maintain proportional appearance
    // Base size of 7 for 3x3, scale proportionally
    const baseMirrorSize = 7;
    const mirrorSize = baseMirrorSize * (state.cubeSize / 3);
    const frameThickness = 0.2;
    const frameColor = 0x888888;

    const mirrorGeometry = new THREE.CircleGeometry(mirrorSize / 2, 64);
    const frameGeometry = new THREE.TorusGeometry((mirrorSize / 2) + (frameThickness / 2), frameThickness / 2, 16, 100);
    const frameMaterial = new THREE.MeshStandardMaterial({
        color: frameColor,
        metalness: 0.95,
        roughness: 0.1
    });

    const mirrorBackRight = new Reflector(mirrorGeometry, {
        clipBias: 0.003,
        textureWidth: window.innerWidth * window.devicePixelRatio,
        textureHeight: window.innerHeight * window.devicePixelRatio,
        color: 0x888888
    });
    // Scale back mirror distance based on cube size
    const baseDistance = 3;
    const mirrorDistance = baseDistance * (state.cubeSize / 3);

    mirrorBackRight.position.set(-mirrorDistance, state.backMirrorHeightOffset, -mirrorDistance);
    mirrorBackRight.lookAt(0, state.backMirrorHeightOffset, 0);
    mirrorBackRight.userData.isMirror = true;
    mirrorBackRight.visible = state.showMirrors;
    state.scene.add(mirrorBackRight);

    const frameBackRight = new THREE.Mesh(frameGeometry, frameMaterial);
    frameBackRight.position.copy(mirrorBackRight.position);
    frameBackRight.lookAt(0, state.backMirrorHeightOffset, 0);
    frameBackRight.userData.isMirror = true;
    frameBackRight.visible = state.showMirrors;
    state.scene.add(frameBackRight);

    const mirrorBottom = new Reflector(mirrorGeometry, {
        clipBias: 0.003,
        textureWidth: window.innerWidth * window.devicePixelRatio,
        textureHeight: window.innerHeight * window.devicePixelRatio,
        color: 0x888888
    });
    // Lower mirror for larger cubes, raise for smaller cubes
    // Scale proportionally around 3x3 baseline, plus extra offset for spacing
    const baseYPosition = -2;
    const proportionalOffset = (state.cubeSize / 3 - 1) * 2.0;
    const spacingOffset = state.cubeSize * 0.3; // ~quarter of cube height for spacing
    mirrorBottom.position.set(0, baseYPosition - proportionalOffset - spacingOffset, 0);
    mirrorBottom.lookAt(0, 0, 0);
    mirrorBottom.userData.isMirror = true;
    mirrorBottom.visible = state.showMirrors;
    state.scene.add(mirrorBottom);

    const frameBottom = new THREE.Mesh(frameGeometry, frameMaterial);
    frameBottom.position.copy(mirrorBottom.position);
    frameBottom.rotation.copy(mirrorBottom.rotation);
    frameBottom.userData.isMirror = true;
    frameBottom.visible = state.showMirrors;
    state.scene.add(frameBottom);

    // Update button state to match
    updateMirrorButtonState();
}

export function toggleMirrors(visible) {
    state.showMirrors = visible;
    state.scene.traverse(obj => {
        if (obj.userData.isMirror) {
            obj.visible = visible;
        }
    });
    updateMirrorButtonState();
}

function updateMirrorButtonState() {
    const btn = document.getElementById('btn-toggle-mirrors');
    if (btn) {
        if (state.showMirrors) {
            btn.classList.remove('bg-gray-600', 'hover:bg-gray-500');
            btn.classList.add('bg-blue-700', 'hover:bg-blue-600');
        } else {
            btn.classList.remove('bg-blue-700', 'hover:bg-blue-600');
            btn.classList.add('bg-gray-600', 'hover:bg-gray-500');
        }
    }
}



export function updateEnvironment(params) {
    state.scene.traverse(obj => {
        if (obj.userData.isWall) {
            if (params.wallColor !== undefined) obj.material.color.setHex(params.wallColor);
            if (params.wallRoughness !== undefined) obj.material.roughness = params.wallRoughness;
            if (params.wallMetalness !== undefined) obj.material.metalness = params.wallMetalness;

            // Handle Global Parameters that might be passed in updateEnvironment wrapper
            // But usually updateEnvironment is called with params specific to the tuner.
            import('./scene.js').then(sceneModule => {
                const lightingParams = {};
                if (params.shadowIntensity !== undefined) lightingParams.shadowIntensity = params.shadowIntensity;
                if (params.shadowsEnabled !== undefined) lightingParams.shadowsEnabled = params.shadowsEnabled;

                // New params
                if (params.lightAzimuth !== undefined) lightingParams.lightAzimuth = params.lightAzimuth;
                if (params.lightElevation !== undefined) lightingParams.lightElevation = params.lightElevation;
                if (params.shadowSoftness !== undefined) lightingParams.shadowSoftness = params.shadowSoftness;

                sceneModule.updateLighting(lightingParams);
            });

            if (params.patternEnabled !== undefined || params.patternScale !== undefined || params.patternOpacity !== undefined || params.patternColors !== undefined) {
                // If toggling on, or if already on and updating params
                const enabled = params.patternEnabled !== undefined ? params.patternEnabled : (obj.userData.patternEnabled || false);
                obj.userData.patternEnabled = enabled;

                if (enabled) {
                    const scale = params.patternScale || obj.userData.patternScale || 1.0;
                    const opacity = params.patternOpacity !== undefined ? params.patternOpacity : (obj.userData.patternOpacity || 0.1);
                    const colors = params.patternColors || obj.userData.patternColors || ['#334455', '#2a3b4c', '#1f2d3a'];

                    // Store current values
                    obj.userData.patternScale = scale;
                    obj.userData.patternOpacity = opacity;
                    obj.userData.patternColors = colors;

                    // Create/Update Texture
                    if (!obj.userData.patternTexture || params.forceUpdate) {
                        const tex = createGeometricPatternTexture(scale, opacity, colors);
                        obj.material.map = tex;
                        obj.userData.patternTexture = tex;
                    }
                    // If we just enabled it, key it in
                    if (!obj.material.map) {
                        const tex = createGeometricPatternTexture(scale, opacity, colors);
                        obj.material.map = tex;
                        obj.userData.patternTexture = tex;
                    }
                    obj.material.needsUpdate = true;
                } else {
                    // Disable pattern
                    if (obj.material.map) {
                        obj.material.map = null;
                        obj.material.needsUpdate = true;
                    }
                }
            }
        }
        if (obj.userData.isDesk) {
            if (params.deskColor !== undefined) obj.material.color.setHex(params.deskColor);
            if (params.deskRoughness !== undefined) obj.material.roughness = params.deskRoughness;
            if (params.deskMetalness !== undefined) obj.material.metalness = params.deskMetalness;
        }
    });
}

function createGeometricPatternTexture(scale = 1.0, opacity = 0.1, colors = ['#334455', '#2a3b4c', '#1f2d3a']) {
    const canvas = document.createElement('canvas');
    const size = 1024;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Fill background
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, size, size);

    // Draw Triangles
    const numTriangles = 50 * scale;

    // We want a tiling pattern ideally, but random disjoint triangles are easier for "geometric wall".
    // For a nice specialized look let's do a Delaunay-like or just random polygons.
    // Let's stick to the user's requested "Geometric Shapes" - likely abstract.

    ctx.globalAlpha = opacity;

    for (let i = 0; i < numTriangles; i++) {
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        ctx.beginPath();
        const x = Math.random() * size;
        const y = Math.random() * size;
        const s = (Math.random() * 100 + 50) * scale;

        ctx.moveTo(x, y);
        ctx.lineTo(x + s, y + (Math.random() - 0.5) * s);
        ctx.lineTo(x + (Math.random() - 0.5) * s, y + s);
        ctx.closePath();
        ctx.fill();
    }

    // Polygons
    for (let i = 0; i < numTriangles / 2; i++) {
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        ctx.beginPath();
        const x = Math.random() * size;
        const y = Math.random() * size;
        const s = (Math.random() * 150 + 50) * scale;
        const sides = Math.floor(Math.random() * 3) + 3; // 3 to 5 sides

        for (let j = 0; j < sides; j++) {
            const angle = (j / sides) * Math.PI * 2;
            const px = x + Math.cos(angle) * s;
            const py = y + Math.sin(angle) * s;
            if (j === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    // tex.needsUpdate = true; // automatic on creation
    return tex;
}

export function getMirrorHeight(size) {
    // Default base is 1.7 for size 3
    // Scale slightly for larger cubes
    return 1.7 + (size - 3) * 0.5;
}
