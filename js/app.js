import * as THREE from 'three';
import { initScene, animate } from './core/scene.js';
import { createCube } from './core/cube.js';
import { initControls, adjustCameraForCubeSize } from './core/controls.js';
import { createEnvironment, createMirrors } from './core/environment.js';
import { setupEventListeners as setupInteractionListeners } from './game/interactions.js';
import { setupUIEventListeners } from './ui/events.js';
import { initAuth } from './leaderboard/firebase.js';
import { togglePanel, openDetailModal, enableDebugButton } from './ui/ui.js';
import { overlayManager } from './ui/overlayManager.js';
import { state } from './shared/state.js';

import { StandardCube } from './puzzles/StandardCube.js';
import { initNetworkMonitoring } from './utils/network.js';

import { thumbnailGenerator } from './utils/ThumbnailGenerator.js';


import { Analytics } from './services/analytics.js';
import { ErrorReporting } from './services/errorReporting.js';

// Expose functions to window for UI interactions (HTML onclick attributes)
window.togglePanel = togglePanel;
window.openDetailModal = openDetailModal;
window.overlayManager = overlayManager;
window.generateThumbnails = () => thumbnailGenerator.generateAll();


function init() {
    // Initialize Core Services
    Analytics.init();
    ErrorReporting.init();

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
        enableDebugButton();
    }

    // Hide controls on mobile app (Capacitor)
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
        const controlsPanel = document.getElementById('controls-panel-container');
        if (controlsPanel) {
            controlsPanel.style.display = 'none';
        }
    }

    // Initialize Network Monitoring
    initNetworkMonitoring();

    // Initialize Firebase Auth
    initAuth();

    // Start Animation Loop
    animate();
}



// Start the application
// Start the application
init();
