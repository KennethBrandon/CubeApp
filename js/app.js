import * as THREE from 'three';
import { initScene, animate } from './core/scene.js';
import { createCube } from './core/cube.js';
import { initControls, adjustCameraForCubeSize } from './core/controls.js';
import { createEnvironment, createMirrors } from './core/environment.js';
import { setupEventListeners as setupInteractionListeners } from './game/interactions.js';
import { setupUIEventListeners } from './ui/events.js';
import { initAuth } from './leaderboard/firebase.js';
import { togglePanel, openDetailModal } from './ui/ui.js';
import { state } from './shared/state.js';

import { StandardCube } from './puzzles/StandardCube.js';

import { thumbnailGenerator } from './utils/ThumbnailGenerator.js';


// Expose functions to window for UI interactions (HTML onclick attributes)
window.togglePanel = togglePanel;
window.openDetailModal = openDetailModal;
window.generateThumbnails = () => thumbnailGenerator.generateAll();


function init() {
    // Initialize Scene & Renderer
    if (!initScene()) return;

    // Initialize Cube Wrapper
    state.cubeWrapper = new THREE.Group();
    state.scene.add(state.cubeWrapper);

    // Initialize Controls
    initControls(state.renderer);

    // Initialize Active Puzzle
    state.activePuzzle = new StandardCube({
        dimensions: { x: 3, y: 3, z: 3 } // Default to 3x3
    });

    // Create Initial Game Objects
    createCube();
    adjustCameraForCubeSize();
    createEnvironment();
    createMirrors();

    // Setup Event Listeners
    setupInteractionListeners(state.renderer.domElement);
    setupUIEventListeners();

    // Check for debug mode
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('d') === 'true') {
        const debugBtn = document.createElement('button');
        debugBtn.innerText = 'd';
        debugBtn.className = 'fixed bottom-4 left-32 z-50 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shadow-lg hover:bg-red-500 transition transform hover:scale-110';
        debugBtn.onclick = () => {
            import('./ui/overlayManager.js').then(module => {
                module.overlayManager.open('debug-modal');
            });
        };
        document.body.appendChild(debugBtn);
    }

    // Initialize Firebase Auth
    initAuth();

    // Start Animation Loop
    animate();
}

// Start the application
init();
