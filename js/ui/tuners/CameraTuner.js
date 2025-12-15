import { state } from '../../shared/state.js';
import { adjustCameraForCubeSize } from '../../core/controls.js';
import { makeDraggable } from './TunerBase.js';

export function showCameraTuner() {
    if (!document.getElementById('camera-tuner-ui')) {
        createCameraTuner();
    }
    document.getElementById('camera-tuner-ui').classList.remove('hidden');
}

function createCameraTuner() {
    const html = `
    <div id="camera-tuner-ui"
        class="hidden absolute top-20 left-4 z-50 bg-black/70 backdrop-blur-md border border-gray-700 p-4 rounded-lg text-white text-sm shadow-xl w-72">
        <div id="camera-tuner-header"
            class="flex justify-between items-center mb-3 cursor-move border-b border-gray-700 pb-2">
            <h3 class="font-bold text-orange-400">Camera Tuner</h3>
            <button id="close-camera-tuner" class="text-gray-400 hover:text-white">&times;</button>
        </div>

        <div class="space-y-4">
            <div class="space-y-2">
                <div class="flex justify-between items-center">
                    <label class="text-xs font-medium text-gray-300">Azimuth (°)</label>
                    <input type="number" id="camera-azimuth-input" 
                        class="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right focus:outline-none focus:border-blue-500"
                        value="${state.cameraSettings?.azimuth ?? 45}">
                </div>
                <input type="range" id="camera-azimuth-slider" min="0" max="360" step="1" 
                    value="${state.cameraSettings?.azimuth ?? 45}"
                    class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-orange-500">
            </div>

            <div class="space-y-2">
                <div class="flex justify-between items-center">
                    <label class="text-xs font-medium text-gray-300">Elevation (°)</label>
                    <input type="number" id="camera-elevation-input" 
                        class="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right focus:outline-none focus:border-blue-500"
                        value="${state.cameraSettings?.elevation ?? 55}">
                </div>
                <input type="range" id="camera-elevation-slider" min="0" max="90" step="1" 
                    value="${state.cameraSettings?.elevation ?? 55}"
                    class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-orange-500">
            </div>

            <div class="space-y-2">
                <div class="flex justify-between items-center">
                    <label class="text-xs font-medium text-gray-300">Zoom Factor</label>
                    <input type="number" id="camera-zoom-input" step="0.05"
                        class="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right focus:outline-none focus:border-blue-500"
                        value="${state.cameraSettings?.zoom ?? 0.14}">
                </div>
                <input type="range" id="camera-zoom-slider" min="0" max="1" step="0.01" 
                    value="${state.cameraSettings?.zoom ?? 0.14}"
                    class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-orange-500">
            </div>


        <div class="space-y-2">
            <div class="flex justify-between items-center">
                <label class="text-xs font-medium text-gray-300">Puzzle Rotation (°)</label>
                <input type="number" id="camera-puzzle-rotation-input" 
                    class="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right focus:outline-none focus:border-blue-500"
                    value="${state.cameraSettings?.puzzleRotation ?? -13}">
            </div>
            <input type="range" id="camera-puzzle-rotation-slider" min="-180" max="180" step="1" 
                value="${state.cameraSettings?.puzzleRotation ?? -13}"
                class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-orange-500">
        </div>

            <div class="pt-2 text-xs text-gray-400 font-mono break-all p-2 bg-gray-900 rounded">
                Current: <span id="camera-debug-output">waiting...</span>
            </div>
            
             <div class="mt-4 text-center">
                <button id="btn-reset-camera-defaults"
                    class="bg-gray-700 hover:bg-gray-600 text-white text-xs py-1 px-3 rounded transition">
                    Reset to Defaults
                </button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    makeDraggable(document.getElementById('camera-tuner-ui'), 'camera-tuner-header');
    attachCameraTunerListeners();
}

function attachCameraTunerListeners() {
    document.getElementById('close-camera-tuner').addEventListener('click', () => {
        document.getElementById('camera-tuner-ui').classList.add('hidden');
        const toggle = document.getElementById('toggle-camera-tuner');
        if (toggle) toggle.checked = false;

        // Remove listener when closed to save performance? 
        // Or better, only listen if hidden class is removed.
        // For simplicity, we just keep it attached or re-attach? 
        // We are adding elements dynamically and then leaving them. 
        // We should just ensure we don't leak.
    });

    const updateCamera = () => {
        // adjustCameraForCubeSize uses state.cameraSettings, so we update state first
        adjustCameraForCubeSize(state.cameraSettings.zoom);

        // Apply Puzzle Rotation
        if (state.cubeWrapper) {
            state.cubeWrapper.rotation.y = (state.cameraSettings.puzzleRotation || 0) * (Math.PI / 180);
        }

        updateDebugOutput();
    };

    // --- ZOOM SYNC LOGIC ---
    // Listen for controls 'change' (from manual user zoom)
    if (state.controls) {
        state.controls.addEventListener('change', () => {
            // Only update if Tuner is visible to avoid unnecessary work
            const ui = document.getElementById('camera-tuner-ui');
            if (ui && !ui.classList.contains('hidden')) {
                // Calculate Zoom Factor from current distance
                const dist = state.camera.position.length();
                const minD = state.controls.minDistance; // Closest (max zoom) value
                const maxD = state.controls.maxDistance; // Farthest (min zoom) value

                // Our Formula: finalDistance = maxZoomDistance + zoomFactor * (minZoomDistance - maxZoomDistance);
                // maxZoomDistance is minD (confusing naming in controls.js but minDistance prop in OrbitControls is 'closest')
                // minZoomDistance is maxD (farthest)
                // So: dist = minD + zoomFactor * (maxD - minD)
                // zoomFactor = (dist - minD) / (maxD - minD)

                if (maxD > minD) {
                    let factor = (dist - minD) / (maxD - minD);
                    // Clamp
                    factor = Math.max(0, Math.min(1, factor));

                    // Update State
                    state.cameraSettings.zoom = factor;

                    // Update Input/Slider seamlessly (avoid cycle if dragging slider?)
                    // If user is dragging the slider, activeElement is that slider. 
                    // We should NOT update the slider if user is dragging it, 
                    // but in this case 'change' comes from OrbitControls which happens when user drags mouse/trackpad (NOT slider).
                    // So if activeElement is NOT the slider, we update it.

                    const slider = document.getElementById('camera-zoom-slider');
                    const input = document.getElementById('camera-zoom-input');

                    if (slider && document.activeElement !== slider) {
                        slider.value = factor;
                    }
                    if (input && document.activeElement !== input) {
                        input.value = factor.toFixed(2); // Slightly different UI than raw value
                    }

                    updateDebugOutput();
                }
            }
        });
    }

    const bindInput = (sliderId, inputId, paramKey) => {
        const slider = document.getElementById(sliderId);
        const input = document.getElementById(inputId);

        if (!slider || !input) return;

        slider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            input.value = val;
            state.cameraSettings[paramKey] = val;
            updateCamera();
        });

        input.addEventListener('change', (e) => {
            let val = parseFloat(e.target.value);
            const min = parseFloat(slider.min);
            const max = parseFloat(slider.max);

            if (val < min) val = min;
            if (val > max) val = max;

            input.value = val;
            slider.value = val;
            state.cameraSettings[paramKey] = val;
            updateCamera();
        });

        // Input event for text box for real-time (optional, can be jarring if typing)
        // Let's stick to 'change' for text box to avoid jumping cursor issues, 
        // implies user hits Enter or loses focus.
        // Or we can do 'input' but need careful handling. 'change' is safer for now.
    };

    bindInput('camera-azimuth-slider', 'camera-azimuth-input', 'azimuth');
    bindInput('camera-elevation-slider', 'camera-elevation-input', 'elevation');
    bindInput('camera-zoom-slider', 'camera-zoom-input', 'zoom');
    bindInput('camera-puzzle-rotation-slider', 'camera-puzzle-rotation-input', 'puzzleRotation');

    document.getElementById('btn-reset-camera-defaults').addEventListener('click', () => {
        // Original Defaults
        const defaults = {
            'camera-azimuth-slider': 26.6,
            'camera-elevation-slider': 24.1,
            'camera-zoom-slider': 0.14,
            'camera-puzzle-rotation-slider': -13
        };

        // Update State
        state.cameraSettings.azimuth = defaults['camera-azimuth-slider'];
        state.cameraSettings.elevation = defaults['camera-elevation-slider'];
        state.cameraSettings.zoom = defaults['camera-zoom-slider'];
        state.cameraSettings.puzzleRotation = defaults['camera-puzzle-rotation-slider'];

        // Update UI
        for (const [id, val] of Object.entries(defaults)) {
            const slider = document.getElementById(id);
            const input = document.getElementById(id.replace('slider', 'input'));
            if (slider) slider.value = val;
            if (input) input.value = val;
        }

        updateCamera();
    });

    updateDebugOutput();
}

function updateDebugOutput() {
    const output = document.getElementById('camera-debug-output');
    if (output && state.cameraSettings) {
        const { azimuth, elevation, zoom, puzzleRotation } = state.cameraSettings;
        output.textContent = `Az: ${azimuth.toFixed(1)}°, El: ${elevation.toFixed(1)}°, Z: ${zoom.toFixed(2)}, Rot: ${puzzleRotation ?? 0}°`;
    }
}
