import { state } from '../../shared/state.js';
import { overlayManager } from '../overlayManager.js';
import { animateVictory } from '../../animations/victory.js';
import { animateWrapperReset, playCubeAnimation } from '../../animations/transitions.js';
import { updateZoomDisplay } from '../../core/scene.js';
import { StandardCube } from '../../puzzles/StandardCube.js';
import { hardReset } from '../../game/scramble.js';
import { adjustCameraForCubeSize } from '../../core/controls.js';
import { getMirrorHeight } from '../../core/environment.js';

export function showDebugMenu() {
    if (!document.getElementById('debug-modal')) {
        createDebugMenu();
    }
    overlayManager.open('debug-modal');
}

function createDebugMenu() {
    const html = `
    <div id="debug-modal"
        class="hidden absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div class="bg-gray-800 p-6 rounded-2xl border border-gray-700 text-center shadow-2xl max-w-md w-full">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold text-white">Debug Menu</h2>
                <button id="btn-close-debug" class="text-gray-400 hover:text-white">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12">
                        </path>
                    </svg>
                </button>
            </div>

            <div class="text-left space-y-3">
                <div class="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                    <span class="text-gray-300">Show FPS</span>
                    <label class="relative inline-block w-12 h-6">
                        <input type="checkbox" id="toggle-fps" class="sr-only peer">
                        <div
                            class="w-12 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600">
                        </div>
                    </label>
                </div>

                <!-- Cube Tuner Toggle -->
                <div class="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                    <span class="text-gray-300">Show Cube Tuner</span>
                    <label class="relative inline-block w-12 h-6">
                        <input type="checkbox" id="toggle-cube-tuner" class="sr-only peer">
                        <div
                            class="w-12 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600">
                        </div>
                    </label>
                </div>

                <!-- Mirror Cube Sticker Tuner Toggle -->
                <div id="mirror-debug-row" class="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                    <span class="text-gray-300">Mirror Blocks Tuner</span>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="toggle-sticker-tuner" class="sr-only peer">
                        <div
                            class="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600">
                        </div>
                    </label>
                </div>

                <!-- Molecube Tuner Toggle -->
                <div class="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                    <span class="text-gray-300">Show Molecube Tuner</span>
                    <label class="relative inline-block w-12 h-6">
                        <input type="checkbox" id="toggle-molecube-tuner" class="sr-only peer">
                        <div
                            class="w-12 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600">
                        </div>
                    </label>
                </div>

                <!-- Acorns Tuner Toggle -->
                <div class="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                    <span class="text-gray-300">Show Acorns Tuner</span>
                    <label class="relative inline-block w-12 h-6">
                        <input type="checkbox" id="toggle-acorns-tuner" class="sr-only peer">
                        <div
                            class="w-12 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600">
                        </div>
                    </label>
                </div>

                <div class="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                    <span class="text-gray-300">Animation Speed (ms)</span>
                    <div class="flex items-center gap-2">
                        <input type="range" id="speed-slider" min="50" max="1000" step="10" value="140"
                            class="w-24 h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500">
                        <span id="speed-value" class="text-xs font-mono text-blue-400 w-8 text-right">140</span>
                    </div>
                </div>

                <div class="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                    <span class="text-gray-300">Return Speed (ms)</span>
                    <div class="flex items-center gap-2">
                        <input type="range" id="snap-speed-slider" min="10" max="500" step="10" value="30"
                            class="w-24 h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500">
                        <span id="snap-speed-value" class="text-xs font-mono text-blue-400 w-8 text-right">30</span>
                    </div>
                </div>

                <div class="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                    <span class="text-gray-300">Test Victory</span>
                    <button id="btn-test-victory"
                        class="bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-1 px-3 rounded transition">
                        Play
                    </button>
                </div>

                <div class="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                    <span class="text-gray-300">Simulate Offline</span>
                    <label class="relative inline-block w-12 h-6">
                        <input type="checkbox" id="toggle-simulate-offline" class="sr-only peer">
                        <div
                            class="w-12 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600">
                        </div>
                    </label>
                </div>

                <div class="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                    <span class="text-gray-300">Custom Puzzle</span>
                    <div class="flex gap-2">
                        <input type="text" id="custom-puzzle-input" placeholder="NxNxN"
                            class="w-20 bg-gray-700 text-white px-2 py-1 rounded border border-gray-600 text-xs focus:outline-none focus:border-blue-500">
                        <button id="btn-create-custom-puzzle"
                            class="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-1 px-3 rounded transition">
                            Create
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    attachDebugListeners();
}

function attachDebugListeners() {
    document.getElementById('btn-close-debug').addEventListener('click', () => {
        overlayManager.close();
    });

    document.getElementById('toggle-fps').addEventListener('change', (e) => {
        const fpsCounter = document.getElementById('fps-counter');
        if (e.target.checked) {
            fpsCounter.classList.remove('hidden');
        } else {
            fpsCounter.classList.add('hidden');
        }
    });





    document.getElementById('toggle-cube-tuner').addEventListener('change', (e) => {
        const ui = document.getElementById('cube-tuner-ui');
        // If tuner UI doesn't exist yet, we might need to load it. 
        // For now, assume Tuners.js will handle its own creation when we call a function, 
        // OR we just toggle the hidden class if it exists.
        // Since we are splitting files, we might need to import showCubeTuner from Tuners.js
        // But for this step, let's assume the Tuners HTML is also going to be dynamic.
        // I'll dispatch a custom event or call a global function? 
        // Better: import { toggleTuner } from './Tuners.js'

        // For now, I'll just toggle the class if it exists, but I'll need to coordinate with Tuners.js
        if (ui) {
            if (e.target.checked) ui.classList.remove('hidden');
            else ui.classList.add('hidden');
        } else if (e.target.checked) {
            // If it doesn't exist and we want to show it, we need to load it.
            import('./Tuners.js').then(module => module.showCubeTuner());
        }
        gtag('event', 'toggle_cube_tuner', { state: e.target.checked ? 'on' : 'off' });
    });

    document.getElementById('toggle-acorns-tuner').addEventListener('change', (e) => {
        const ui = document.getElementById('acorns-tuner-ui');
        if (ui) {
            if (e.target.checked) ui.classList.remove('hidden');
            else ui.classList.add('hidden');
        } else if (e.target.checked) {
            import('./Tuners.js').then(module => module.showAcornsTuner());
        }
        gtag('event', 'toggle_acorns_tuner', { state: e.target.checked ? 'on' : 'off' });
    });

    document.getElementById('toggle-molecube-tuner').addEventListener('change', (e) => {
        const ui = document.getElementById('molecube-tuner-ui');
        if (ui) {
            if (e.target.checked) ui.classList.remove('hidden');
            else ui.classList.add('hidden');
        } else if (e.target.checked) {
            import('./Tuners.js').then(module => module.showMolecubeTuner());
        }
        gtag('event', 'toggle_molecube_tuner', { state: e.target.checked ? 'on' : 'off' });
    });

    document.getElementById('toggle-sticker-tuner').addEventListener('change', (e) => {
        const ui = document.getElementById('mirror-debug-ui');
        if (ui) {
            if (e.target.checked) ui.classList.remove('hidden');
            else ui.classList.add('hidden');
        } else if (e.target.checked) {
            import('./Tuners.js').then(module => module.showMirrorTuner());
        }
    });

    document.getElementById('speed-slider').addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        state.animationSpeed = val;
        document.getElementById('speed-value').textContent = val;
    });

    document.getElementById('snap-speed-slider').addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        state.snapSpeed = val;
        document.getElementById('snap-speed-value').textContent = val;
    });

    document.getElementById('btn-test-victory').addEventListener('click', () => {
        overlayManager.close();
        setTimeout(() => {
            animateVictory();
        }, 1000);
        gtag('event', 'test_victory');
    });

    document.getElementById('toggle-simulate-offline').addEventListener('change', (e) => {
        state.isSimulatedOffline = e.target.checked;
        // Dispatch custom event to notify UI components
        window.dispatchEvent(new Event('network-status-change'));
        gtag('event', 'toggle_simulate_offline', { state: e.target.checked ? 'on' : 'off' });
    });

    document.getElementById('btn-create-custom-puzzle').addEventListener('click', () => {
        const input = document.getElementById('custom-puzzle-input');
        const val = input.value.trim();
        let newSize = 3;
        let newDims = { x: 3, y: 3, z: 3 };

        try {
            if (val.includes('x')) {
                const dims = val.split('x').map(n => parseInt(n.trim()));
                if (dims.length !== 3 || dims.some(isNaN)) throw new Error("Invalid format");
                const sortedDims = [...dims].sort((a, b) => b - a);
                newDims = { x: sortedDims[1], y: sortedDims[0], z: sortedDims[2] };
                newSize = sortedDims[0];
            } else {
                const size = parseInt(val);
                if (isNaN(size)) throw new Error("Invalid number");
                newSize = size;
                newDims = { x: newSize, y: newSize, z: newSize };
            }

            overlayManager.close();

            const currentDist = state.camera.position.length();
            const minD = state.controls.minDistance;
            const maxD = state.controls.maxDistance;
            let zoomRatio = null;
            if (maxD > minD) {
                zoomRatio = (currentDist - minD) / (maxD - minD);
            }

            playCubeAnimation(false, () => {
                state.cubeSize = newSize;
                state.cubeDimensions = newDims;
                const newHeight = getMirrorHeight(newSize);
                state.backMirrorHeightOffset = newHeight;



                state.activePuzzle = new StandardCube({
                    dimensions: newDims
                });

                hardReset(true);
                adjustCameraForCubeSize(zoomRatio);
                playCubeAnimation(true);
            });
            gtag('event', 'custom_puzzle_create', { puzzle_def: val });

        } catch (e) {
            alert("Invalid format! Use N or NxNxN (e.g. 5 or 2x3x4)");
        }
    });
}


