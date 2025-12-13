import { state } from '../../shared/state.js';
import { makeDraggable } from './TunerBase.js';

export function showEnvironmentTuner() {
    if (!document.getElementById('environment-tuner-ui')) {
        createEnvironmentTuner();
    }
    document.getElementById('environment-tuner-ui').classList.remove('hidden');
}

function createEnvironmentTuner() {
    const html = `
    <div id="environment-tuner-ui"
        class="hidden absolute top-20 right-4 z-50 bg-black/70 backdrop-blur-md border border-gray-700 p-4 rounded-lg text-white text-sm shadow-xl w-72 h-[80vh] overflow-y-auto">
        <div id="environment-tuner-header"
            class="flex justify-between items-center mb-3 cursor-move border-b border-gray-700 pb-2 bg-black/50 sticky top-0 z-10 p-2 -mx-2 -mt-2 rounded-t-lg">
            <h3 class="font-bold text-teal-400">Environment Tuner</h3>
            <button id="close-environment-tuner" class="text-gray-400 hover:text-white">&times;</button>
        </div>

        <!-- Global Lighting -->
        <h4 class="font-bold text-gray-400 mb-2 mt-2 uppercase text-xs">Lighting</h4>
        <div class="mb-3">
            <label class="flex items-center gap-2 cursor-pointer mb-2">
                <input type="checkbox" id="env-shadows-enabled" checked
                    class="w-4 h-4 rounded bg-gray-600 border-gray-500 text-teal-600">
                <span class="text-xs font-bold text-gray-300">Enable Shadows</span>
            </label>
        </div>
        <div class="mb-3">
            <label class="block mb-1 text-gray-300">Shadow Intensity: <span id="env-shadow-intensity-val" class="text-white font-mono">0.35</span></label>
            <input type="range" id="env-shadow-intensity" min="0" max="1" step="0.05" value="0.35"
                class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-teal-500">
        </div>
        <div class="mb-3 flex gap-2">
            <div class="w-1/2">
               <label class="block mb-1 text-gray-300">Azimuth: <span id="env-light-azimuth-val" class="text-white font-mono">-15°</span></label>
               <input type="range" id="env-light-azimuth" min="-180" max="180" step="5" value="-15"
                   class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-teal-500">
            </div>
            <div class="w-1/2">
                <label class="block mb-1 text-gray-300">Elevation: <span id="env-light-elevation-val" class="text-white font-mono">55°</span></label>
                <input type="range" id="env-light-elevation" min="0" max="90" step="5" value="55"
                    class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-teal-500">
            </div>
        </div>
        <div class="mb-3">
             <label class="block mb-1 text-gray-300">Shadow Softness: <span id="env-shadow-softness-val" class="text-white font-mono">9.0</span></label>
             <input type="range" id="env-shadow-softness" min="0" max="50" step="1" value="9.0"
                 class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-teal-500">
        </div>

        <hr class="border-gray-700 my-4">

        <!-- Desk Controls -->
        <h4 class="font-bold text-gray-400 mb-2 mt-2 uppercase text-xs">Desk Settings</h4>
        <div class="mb-3">
            <label class="block mb-1 text-gray-300">Color (Hex): <span id="env-desk-color-val" class="text-white font-mono">5D4037</span></label>
            <input type="color" id="env-desk-color-picker" value="#5D4037" class="w-full h-8 cursor-pointer rounded">
        </div>
        <div class="mb-3">
            <label class="block mb-1 text-gray-300">Roughness: <span id="env-desk-roughness-val" class="text-white font-mono">0.90</span></label>
            <input type="range" id="env-desk-roughness" min="0" max="1" step="0.05" value="0.9"
                class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-teal-500">
        </div>
        <div class="mb-3">
            <label class="block mb-1 text-gray-300">Metalness: <span id="env-desk-metalness-val" class="text-white font-mono">0.10</span></label>
            <input type="range" id="env-desk-metalness" min="0" max="1" step="0.05" value="0.1"
                class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-teal-500">
        </div>

        <hr class="border-gray-700 my-4">

        <!-- Wall Controls -->
        <h4 class="font-bold text-gray-400 mb-2 mt-2 uppercase text-xs">Wall Settings</h4>
        <div class="mb-3">
            <label class="block mb-1 text-gray-300">Color (Hex): <span id="env-wall-color-val" class="text-white font-mono">2C3E50</span></label>
            <input type="color" id="env-wall-color-picker" value="#2C3E50" class="w-full h-8 cursor-pointer rounded">
        </div>
        <div class="mb-3">
            <label class="block mb-1 text-gray-300">Roughness: <span id="env-wall-roughness-val" class="text-white font-mono">0.80</span></label>
            <input type="range" id="env-wall-roughness" min="0" max="1" step="0.05" value="0.8"
                class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-teal-500">
        </div>
        <div class="mb-3">
            <label class="block mb-1 text-gray-300">Metalness: <span id="env-wall-metalness-val" class="text-white font-mono">0.20</span></label>
            <input type="range" id="env-wall-metalness" min="0" max="1" step="0.05" value="0.2"
                class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-teal-500">
        </div>

        <hr class="border-gray-700 my-4">

        <!-- Geometric Pattern Controls -->
        <div class="flex items-center justify-between mb-3">
            <h4 class="font-bold text-gray-400 uppercase text-xs">Geometric Pattern</h4>
            <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="env-pattern-toggle" checked class="sr-only peer">
                <div class="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
            </label>
        </div>

        <div id="env-pattern-controls" class="transition-opacity duration-300">
             <div class="mb-3">
                <button id="env-pattern-refresh" class="w-full bg-teal-700 hover:bg-teal-600 text-white text-xs py-1 px-2 rounded mb-2">Regenerate Pattern</button>
            </div>

            <div class="mb-3">
                <label class="block mb-1 text-gray-300">Scale: <span id="env-pattern-scale-val" class="text-white font-mono">1.0</span></label>
                <input type="range" id="env-pattern-scale" min="0.5" max="3.0" step="0.1" value="1.0"
                    class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-teal-500">
            </div>
            
             <div class="mb-3">
                <label class="block mb-1 text-gray-300">Opacity: <span id="env-pattern-opacity-val" class="text-white font-mono">0.30</span></label>
                <input type="range" id="env-pattern-opacity" min="0.0" max="1.0" step="0.05" value="0.30"
                    class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-teal-500">
            </div>
            
            <div class="mb-3 grid grid-cols-3 gap-2">
                <div>
                     <label class="block text-xs text-gray-400 mb-1">Color 1: <span id="env-pattern-color1-val" class="text-white font-mono text-[10px]"></span></label>
                     <input type="color" id="env-pattern-color1" value="#69A6E2" class="w-full h-6 rounded cursor-pointer">
                </div>
                 <div>
                     <label class="block text-xs text-gray-400 mb-1">Color 2: <span id="env-pattern-color2-val" class="text-white font-mono text-[10px]"></span></label>
                     <input type="color" id="env-pattern-color2" value="#22458C" class="w-full h-6 rounded cursor-pointer">
                </div>
                 <div>
                     <label class="block text-xs text-gray-400 mb-1">Color 3: <span id="env-pattern-color3-val" class="text-white font-mono text-[10px]"></span></label>
                     <input type="color" id="env-pattern-color3" value="#5E3295" class="w-full h-6 rounded cursor-pointer">
                </div>
            </div>
        </div>

        <div class="mt-8 text-center pb-4">
            <button id="btn-reset-env-defaults"
                class="bg-gray-700 hover:bg-gray-600 text-white text-xs py-1 px-3 rounded transition">
                Reset to Defaults
            </button>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    makeDraggable(document.getElementById('environment-tuner-ui'), 'environment-tuner-header');
    attachEnvironmentTunerListeners();
}

function attachEnvironmentTunerListeners() {
    document.getElementById('close-environment-tuner').addEventListener('click', () => {
        document.getElementById('environment-tuner-ui').classList.add('hidden');
        const toggle = document.getElementById('toggle-env-tuner'); // In debug menu
        if (toggle) toggle.checked = false;
    });

    const updateEnv = (forceUpdate = false) => {
        // Collect all params
        const shadowsEnabled = document.getElementById('env-shadows-enabled').checked;
        const shadowIntensity = parseFloat(document.getElementById('env-shadow-intensity').value);
        const lightAzimuth = parseFloat(document.getElementById('env-light-azimuth').value);
        const lightElevation = parseFloat(document.getElementById('env-light-elevation').value);
        const shadowSoftness = parseFloat(document.getElementById('env-shadow-softness').value);

        const deskColor = parseInt(document.getElementById('env-desk-color-picker').value.replace('#', '0x'), 16);
        const deskRoughness = parseFloat(document.getElementById('env-desk-roughness').value);
        const deskMetalness = parseFloat(document.getElementById('env-desk-metalness').value);

        const wallColor = parseInt(document.getElementById('env-wall-color-picker').value.replace('#', '0x'), 16);
        const wallRoughness = parseFloat(document.getElementById('env-wall-roughness').value);
        const wallMetalness = parseFloat(document.getElementById('env-wall-metalness').value);

        const patternEnabled = document.getElementById('env-pattern-toggle').checked;
        const patternScale = parseFloat(document.getElementById('env-pattern-scale').value);
        const patternOpacity = parseFloat(document.getElementById('env-pattern-opacity').value);

        const c1 = document.getElementById('env-pattern-color1').value;
        const c2 = document.getElementById('env-pattern-color2').value;
        const c3 = document.getElementById('env-pattern-color3').value;
        const patternColors = [c1, c2, c3];

        // Update Labels
        document.getElementById('env-shadow-intensity-val').textContent = shadowIntensity.toFixed(2);
        document.getElementById('env-light-azimuth-val').textContent = lightAzimuth.toFixed(0) + '°';
        document.getElementById('env-light-elevation-val').textContent = lightElevation.toFixed(0) + '°';
        document.getElementById('env-shadow-softness-val').textContent = shadowSoftness.toFixed(1);

        document.getElementById('env-desk-color-val').textContent = document.getElementById('env-desk-color-picker').value.toUpperCase();
        document.getElementById('env-desk-roughness-val').textContent = deskRoughness.toFixed(2);
        document.getElementById('env-desk-metalness-val').textContent = deskMetalness.toFixed(2);

        document.getElementById('env-wall-color-val').textContent = document.getElementById('env-wall-color-picker').value.toUpperCase();
        document.getElementById('env-wall-roughness-val').textContent = wallRoughness.toFixed(2);
        document.getElementById('env-wall-metalness-val').textContent = wallMetalness.toFixed(2);

        document.getElementById('env-pattern-scale-val').textContent = patternScale.toFixed(1);
        document.getElementById('env-pattern-opacity-val').textContent = patternOpacity.toFixed(2);

        document.getElementById('env-pattern-color1-val').textContent = c1.toUpperCase();
        document.getElementById('env-pattern-color2-val').textContent = c2.toUpperCase();
        document.getElementById('env-pattern-color3-val').textContent = c3.toUpperCase();

        // Toggle UI state for pattern controls
        const controls = document.getElementById('env-pattern-controls');
        if (patternEnabled) {
            controls.classList.remove('opacity-50', 'pointer-events-none');
        } else {
            controls.classList.add('opacity-50', 'pointer-events-none');
        }

        // Call Environment Update
        import('../../core/environment.js').then(module => {
            module.updateEnvironment({
                shadowsEnabled,
                shadowIntensity,
                deskColor, deskRoughness, deskMetalness,
                wallColor, wallRoughness, wallMetalness,
                patternEnabled, patternScale, patternOpacity, patternColors,
                shadowIntensity,
                lightAzimuth, lightElevation, shadowSoftness,
                deskColor, deskRoughness, deskMetalness,
                wallColor, wallRoughness, wallMetalness,
                patternEnabled, patternScale, patternOpacity, patternColors,
                forceUpdate
            });
        });
    };

    // Attach Listeners
    if (document.getElementById('env-shadows-enabled')) {
        document.getElementById('env-shadows-enabled').addEventListener('change', () => updateEnv(false));
    }
    ['env-shadow-intensity', 'env-light-azimuth', 'env-light-elevation', 'env-shadow-softness',
        'env-desk-roughness', 'env-desk-metalness',
        'env-wall-roughness', 'env-wall-metalness',
        'env-pattern-scale', 'env-pattern-opacity'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => updateEnv(id === 'env-pattern-scale' || id === 'env-pattern-opacity'));
        });
    ['env-desk-color-picker', 'env-wall-color-picker', 'env-pattern-color1', 'env-pattern-color2', 'env-pattern-color3'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => updateEnv(id.includes('pattern')));
    });

    ['env-desk-color-picker', 'env-wall-color-picker', 'env-pattern-color1', 'env-pattern-color2', 'env-pattern-color3'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => updateEnv(false));
        if (id.includes('pattern')) {
            document.getElementById(id).addEventListener('change', () => updateEnv(true)); // Regenerate on release
        }
    });

    document.getElementById('env-pattern-toggle').addEventListener('change', () => updateEnv(false));

    document.getElementById('env-pattern-refresh').addEventListener('click', () => updateEnv(true));

    document.getElementById('btn-reset-env-defaults').addEventListener('click', () => {
        // Reset Valid Defaults
        document.getElementById('env-shadows-enabled').checked = true;
        document.getElementById('env-shadow-intensity').value = 0.35;
        document.getElementById('env-light-azimuth').value = -15;
        document.getElementById('env-light-elevation').value = 55;
        document.getElementById('env-shadow-softness').value = 9.0;

        document.getElementById('env-desk-color-picker').value = '#5D4037';
        document.getElementById('env-desk-roughness').value = 0.9;
        document.getElementById('env-desk-metalness').value = 0.1;

        document.getElementById('env-wall-color-picker').value = '#2C3E50';
        document.getElementById('env-wall-roughness').value = 0.8;
        document.getElementById('env-wall-metalness').value = 0.2;

        document.getElementById('env-pattern-toggle').checked = true; // User seems to want this active by default if they set colors? defaulting to true or false? "Set these as default". In the image it is ON.
        document.getElementById('env-pattern-scale').value = 1.0;
        document.getElementById('env-pattern-opacity').value = 0.30;

        document.getElementById('env-pattern-color1').value = '#69A6E2';
        document.getElementById('env-pattern-color2').value = '#22458C';
        document.getElementById('env-pattern-color3').value = '#5E3295';

        // Update UI Text
        document.getElementById('env-shadow-intensity').dispatchEvent(new Event('input')); // Trigger updateEnv
        // We can just call updateEnv(true) which pulls all values
        updateEnv(true);
    });

    // Initialize environment with default settings (including pattern since toggle is checked by default)
    updateEnv(true);
}
