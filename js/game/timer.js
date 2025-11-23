import * as THREE from 'three';
import { state } from '../shared/state.js';
import { CUBE_SIZE, SPACING } from '../shared/constants.js';
import { animateVictory } from '../animations/victory.js';

export function startInspection() {
    state.isGameActive = true;
    state.isInspection = true;
    state.inspectionTimeLeft = 15;

    const timerLabel = document.getElementById('timer-label');
    const timerDisplay = document.getElementById('timer');

    if (timerLabel) {
        timerLabel.textContent = "INSPECTION";
        timerLabel.className = "text-orange-400 text-[10px] uppercase tracking-wider leading-none mb-1 font-bold";
    }

    if (timerDisplay) {
        timerDisplay.className = "text-2xl sm:text-3xl font-mono text-orange-500 leading-none";
    }

    state.inspectionInterval = setInterval(() => {
        state.inspectionTimeLeft--;
        if (state.inspectionTimeLeft > 0) {
            if (timerDisplay) timerDisplay.textContent = state.inspectionTimeLeft;
        } else {
            startTimer();
        }
    }, 1000);
}

export function startTimer() {
    if (state.timerRunning) return;
    if (state.isInspection) {
        clearInterval(state.inspectionInterval);
        state.isInspection = false;
    }
    state.timerRunning = true;
    state.startTime = Date.now();
    const timerLabel = document.getElementById('timer-label');
    const timerDisplay = document.getElementById('timer');
    if (timerLabel) {
        timerLabel.textContent = "SOLVING";
        timerLabel.className = "text-yellow-400 text-[10px] uppercase tracking-wider leading-none mb-1 font-bold";
    }
    if (timerDisplay) {
        timerDisplay.className = "text-2xl sm:text-3xl font-mono text-yellow-400 leading-none";
    }
    state.timerInterval = setInterval(() => {
        const elapsed = Date.now() - state.startTime;
        state.finalTimeMs = elapsed; // Store for leaderboard
        const min = Math.floor(elapsed / 60000);
        const sec = Math.floor((elapsed % 60000) / 1000);
        const ms = Math.floor((elapsed % 1000) / 10);
        if (timerDisplay) {
            timerDisplay.textContent =
                `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
        }
    }, 50);
}

export function stopTimer() {
    state.timerRunning = false;
    clearInterval(state.timerInterval);
    clearInterval(state.inspectionInterval);
}

export function checkSolved() {
    if (!state.isGameActive || state.isScrambling || state.moveHistory.length === 0 || state.isInspection || state.isAutoSolving || !state.hasBeenScrambled) return;

    const directions = [
        { dir: new THREE.Vector3(1, 0, 0), axis: 'x', val: (state.cubeDimensions.x - 1) / 2 },
        { dir: new THREE.Vector3(-1, 0, 0), axis: 'x', val: -(state.cubeDimensions.x - 1) / 2 },
        { dir: new THREE.Vector3(0, 1, 0), axis: 'y', val: (state.cubeDimensions.y - 1) / 2 },
        { dir: new THREE.Vector3(0, -1, 0), axis: 'y', val: -(state.cubeDimensions.y - 1) / 2 },
        { dir: new THREE.Vector3(0, 0, 1), axis: 'z', val: (state.cubeDimensions.z - 1) / 2 },
        { dir: new THREE.Vector3(0, 0, -1), axis: 'z', val: -(state.cubeDimensions.z - 1) / 2 }
    ];

    const epsilon = 0.5;
    let isAllSolved = true;

    for (const face of directions) {
        const faceCubies = state.allCubies.filter(c => Math.abs(c.position[face.axis] - (face.val * (CUBE_SIZE + SPACING))) < epsilon);
        let faceColorHex = null;
        for (const group of faceCubies) {
            let stickerColor = null;
            for (const child of group.children) {
                if (child.userData.isSticker) {
                    const normal = new THREE.Vector3(0, 0, 1);
                    normal.applyQuaternion(child.quaternion);
                    normal.applyQuaternion(group.quaternion);
                    if (normal.dot(face.dir) > 0.9) {
                        stickerColor = child.material.uniforms.color.value.getHex();
                        break;
                    }
                }
            }
            if (stickerColor === null) continue;
            if (faceColorHex === null) faceColorHex = stickerColor;
            else if (faceColorHex !== stickerColor) {
                isAllSolved = false;
                break;
            }
        }
        if (!isAllSolved) break;
    }

    if (isAllSolved) {
        stopTimer();
        state.isGameActive = false;
        animateVictory();
    }
}
