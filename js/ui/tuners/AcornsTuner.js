import { state } from '../../shared/state.js';
import { makeDraggable } from './TunerBase.js';

export function showAcornsTuner() {
    if (!document.getElementById('acorns-tuner-ui')) {
        createAcornsTuner();
    }
    document.getElementById('acorns-tuner-ui').classList.remove('hidden');
}

function createAcornsTuner() {
    const html = `
    <div id="acorns-tuner-ui"
        class="hidden absolute top-20 left-4 z-50 bg-black/70 backdrop-blur-md border border-gray-700 p-4 rounded-lg text-white text-sm shadow-xl w-64">
        <div id="acorns-tuner-header"
            class="flex justify-between items-center mb-3 cursor-move border-b border-gray-700 pb-2">
            <h3 class="font-bold text-green-400">Acorns Tuner</h3>
            <button id="close-acorns-tuner" class="text-gray-400 hover:text-white">&times;</button>
        </div>

        <div class="mb-3">
            <label class="block mb-1 text-gray-300">Scale (Zoom): <span id="acorns-scale-val"
                    class="text-white font-mono">2.600</span></label>
            <input type="range" id="acorns-scale-slider" min="1.0" max="3.0" step="0.05" value="2.600"
                class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-green-500">
        </div>

        <div class="mb-3">
            <label class="block mb-1 text-gray-300">Gap (Spacing): <span id="acorns-gap-val"
                    class="text-white font-mono">0.005</span></label>
            <input type="range" id="acorns-gap-slider" min="-0.5" max="0.5" step="0.001" value="0.005"
                class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-green-500">
        </div>

        <div class="mb-3">
            <label class="block mb-1 text-gray-300">Offset X: <span id="acorns-offset-x-val"
                    class="text-white font-mono">0.000</span></label>
            <input type="range" id="acorns-offset-x-slider" min="-15.0" max="15.0" step="0.01" value="0.000"
                class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500">
        </div>

        <div class="mb-3">
            <label class="block mb-1 text-gray-300">Offset Y: <span id="acorns-offset-y-val"
                    class="text-white font-mono">3.300</span></label>
            <input type="range" id="acorns-offset-y-slider" min="-15.0" max="15.0" step="0.01" value="3.300"
                class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500">
        </div>

        <div class="mb-3">
            <label class="block mb-1 text-gray-300">Offset Z: <span id="acorns-offset-z-val"
                    class="text-white font-mono">0.000</span></label>
            <input type="range" id="acorns-offset-z-slider" min="-15.0" max="15.0" step="0.01" value="0.000"
                class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500">
        </div>

        <div class="mb-3">
            <label class="block mb-1 text-gray-300">Roughness: <span id="acorns-roughness-val"
                    class="text-white font-mono">0.60</span></label>
            <input type="range" id="acorns-roughness-slider" min="0.0" max="1.0" step="0.01" value="0.60"
                class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-yellow-500">
        </div>
        
        <div class="mb-3">
            <label class="block mb-1 text-gray-300">Metalness: <span id="acorns-metalness-val"
                    class="text-white font-mono">0.46</span></label>
            <input type="range" id="acorns-metalness-slider" min="0.0" max="1.0" step="0.01" value="0.46"
                class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-gray-400">
        </div>

        <div class="mb-3">
            <label class="block mb-1 text-gray-300">Speckle Scale: <span id="acorns-normal-scale-val"
                    class="text-white font-mono">0.50</span></label>
            <input type="range" id="acorns-normal-scale-slider" min="0.0" max="1.0" step="0.01" value="0.50"
                class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500">
        </div>

        <div class="mt-4 text-center">
            <button id="btn-reset-acorns-defaults"
                class="bg-gray-700 hover:bg-gray-600 text-white text-xs py-1 px-3 rounded transition">
                Reset to Defaults
            </button>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    makeDraggable(document.getElementById('acorns-tuner-ui'), 'acorns-tuner-header');
    attachAcornsTunerListeners();
}

function attachAcornsTunerListeners() {
    document.getElementById('close-acorns-tuner').addEventListener('click', () => {
        document.getElementById('acorns-tuner-ui').classList.add('hidden');
        const toggle = document.getElementById('toggle-acorns-tuner');
        if (toggle) toggle.checked = false;
    });

    const updateAcornsTuner = () => {
        if (!state.activePuzzle) return;
        const scale = parseFloat(document.getElementById('acorns-scale-slider').value);
        const spacing = parseFloat(document.getElementById('acorns-gap-slider').value);
        const offsetX = parseFloat(document.getElementById('acorns-offset-x-slider').value);
        const offsetY = parseFloat(document.getElementById('acorns-offset-y-slider').value);
        const offsetZ = parseFloat(document.getElementById('acorns-offset-z-slider').value);
        const roughness = parseFloat(document.getElementById('acorns-roughness-slider').value);
        const metalness = parseFloat(document.getElementById('acorns-metalness-slider').value);
        const normalScale = parseFloat(document.getElementById('acorns-normal-scale-slider').value);

        document.getElementById('acorns-scale-val').textContent = scale.toFixed(3);
        document.getElementById('acorns-gap-val').textContent = spacing.toFixed(3);
        document.getElementById('acorns-offset-x-val').textContent = offsetX.toFixed(3);
        document.getElementById('acorns-offset-y-val').textContent = offsetY.toFixed(3);
        document.getElementById('acorns-offset-z-val').textContent = offsetZ.toFixed(3);
        document.getElementById('acorns-roughness-val').textContent = roughness.toFixed(2);
        document.getElementById('acorns-metalness-val').textContent = metalness.toFixed(2);
        document.getElementById('acorns-normal-scale-val').textContent = normalScale.toFixed(2);

        if (state.activePuzzle.updateAcornsParams) {
            state.activePuzzle.updateAcornsParams({
                scale,
                spacing,
                offset: { x: offsetX, y: offsetY, z: offsetZ },
                roughness,
                metalness,
                normalScale
            });
        }
    };

    ['acorns-scale-slider', 'acorns-gap-slider', 'acorns-offset-x-slider', 'acorns-offset-y-slider', 'acorns-offset-z-slider',
        'acorns-roughness-slider', 'acorns-metalness-slider', 'acorns-normal-scale-slider'].forEach(id => {
            document.getElementById(id).addEventListener('input', updateAcornsTuner);
        });

    document.getElementById('btn-reset-acorns-defaults').addEventListener('click', () => {
        const defaults = {
            'acorns-scale-slider': 2.600,
            'acorns-gap-slider': 0.005,
            'acorns-offset-x-slider': 0.000,
            'acorns-offset-y-slider': 3.300,
            'acorns-offset-z-slider': 0.000,
            'acorns-roughness-slider': 0.60,
            'acorns-metalness-slider': 0.46,
            'acorns-normal-scale-slider': 0.50
        };
        for (const [id, val] of Object.entries(defaults)) {
            const el = document.getElementById(id);
            if (el) {
                el.value = val;
                el.dispatchEvent(new Event('input'));
            }
        }
    });
}
