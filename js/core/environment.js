import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { state } from '../shared/state.js';

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

export function updateBackMirrorHeight(offset) {
    state.backMirrorHeightOffset = offset;
    state.scene.traverse(obj => {
        if (obj.userData.isMirror && obj.position.x < 0 && obj.position.z < 0) { // Identify back mirror by position
            // We need to be careful not to move the bottom mirror which is at 0, y, 0
            // Back mirror is at -dist, y, -dist
            if (Math.abs(obj.position.x) > 0.1 && Math.abs(obj.position.z) > 0.1) {
                obj.position.y = offset;
                obj.lookAt(0, offset, 0);
            }
        }
    });
}

export function getMirrorHeight(size) {
    // 2x2 -> 1.0
    // 3x3 -> 1.7
    // 17x17 -> 5.0

    if (size <= 3) {
        // Interpolate between 2 (1.0) and 3 (1.7)
        const t = (size - 2) / (3 - 2);
        return 1.0 + t * (1.7 - 1.0);
    } else {
        // Interpolate between 3 (1.7) and 17 (5.0)
        const t = (size - 3) / (17 - 3);
        return 1.7 + t * (5.0 - 1.7);
    }
}
