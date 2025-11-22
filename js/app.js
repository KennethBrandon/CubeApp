import { initScene, animate } from './core/scene.js';
import { createCube } from './core/cube.js';
import { initControls, adjustCameraForCubeSize } from './core/controls.js';
import { createEnvironment, createMirrors } from './core/environment.js';
import { setupEventListeners as setupInteractionListeners } from './game/interactions.js';
import { setupUIEventListeners } from './ui/events.js';
import { initAuth } from './leaderboard/firebase.js';
import { togglePanel, openDetailModal } from './ui/ui.js';
import { state } from './shared/state.js';

// Expose functions to window for UI interactions (HTML onclick attributes)
window.togglePanel = togglePanel;
window.openDetailModal = openDetailModal;

function init() {
    // Initialize Scene & Renderer
    if (!initScene()) return;

    // Initialize Controls
    initControls(state.renderer);

    // Create Initial Game Objects
    createCube();
    adjustCameraForCubeSize();
    createEnvironment();
    createMirrors();

    // Setup Event Listeners
    setupInteractionListeners(state.renderer.domElement);
    setupUIEventListeners();

    // Initialize Firebase Auth
    initAuth();

    // Start Animation Loop
    animate();
}

// Start the application
init();
