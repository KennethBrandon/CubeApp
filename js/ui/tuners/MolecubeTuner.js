import { state } from '../../shared/state.js';
import { makeDraggable } from './TunerBase.js';

export function showMolecubeTuner() {
    if (!document.getElementById('molecube-tuner-ui')) {
        createMolecubeTuner();
    }
    document.getElementById('molecube-tuner-ui').classList.remove('hidden');
}

function createMolecubeTuner() {
    const html = `
    <div id="molecube-tuner-ui"
        class="hidden absolute top-20 left-4 z-50 bg-black/70 backdrop-blur-md border border-gray-700 p-4 rounded-lg text-white text-sm shadow-xl w-64">
        <div id="molecube-tuner-header"
            class="flex justify-between items-center mb-3 cursor-move border-b border-gray-700 pb-2">
            <h3 class="font-bold text-purple-400">Molecube Tuner</h3>
            <button id="close-molecube-tuner" class="text-gray-400 hover:text-white">&times;</button>
        </div>

        <div class="mb-3">
            <label class="block mb-1 text-gray-300">Ball Size: <span id="molecube-ball-size-val"
                    class="text-white font-mono">0.500</span></label>
            <input type="range" id="molecube-ball-size-slider" min="0.1" max="0.6" step="0.005" value="0.500"
                class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500">
        </div>

        <div class="mb-3">
            <label class="block mb-1 text-gray-300">Cylinder Size: <span id="molecube-cylinder-size-val"
                    class="text-white font-mono">0.300</span></label>
            <input type="range" id="molecube-cylinder-size-slider" min="0.01" max="0.3" step="0.005" value="0.300"
                class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500">
        </div>

        <div class="mb-3">
            <label class="block mb-1 text-gray-300">Spacing (Spread): <span id="molecube-spacing-val"
                    class="text-white font-mono">0.020</span></label>
            <input type="range" id="molecube-spacing-slider" min="0" max="0.5" step="0.005" value="0.020"
                class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500">
        </div>

        <div class="mt-4 text-center">
            <button id="btn-reset-molecube-defaults"
                class="bg-gray-700 hover:bg-gray-600 text-white text-xs py-1 px-3 rounded transition">
                Reset to Defaults
            </button>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    makeDraggable(document.getElementById('molecube-tuner-ui'), 'molecube-tuner-header');
    attachMolecubeTunerListeners();
}

function attachMolecubeTunerListeners() {
    document.getElementById('close-molecube-tuner').addEventListener('click', () => {
        document.getElementById('molecube-tuner-ui').classList.add('hidden');
        const toggle = document.getElementById('toggle-molecube-tuner');
        if (toggle) toggle.checked = false;
    });

    const updateMolecubeTuner = () => {
        if (!state.activePuzzle) return;
        const ballSize = parseFloat(document.getElementById('molecube-ball-size-slider').value);
        const cylinderSize = parseFloat(document.getElementById('molecube-cylinder-size-slider').value);
        const spacing = parseFloat(document.getElementById('molecube-spacing-slider').value);

        document.getElementById('molecube-ball-size-val').textContent = ballSize.toFixed(3);
        document.getElementById('molecube-cylinder-size-val').textContent = cylinderSize.toFixed(3);
        document.getElementById('molecube-spacing-val').textContent = spacing.toFixed(3);

        if (state.activePuzzle.updateMolecubeParams) {
            state.activePuzzle.updateMolecubeParams({ ballSize, cylinderSize, spacing });
        }
    };

    ['molecube-ball-size-slider', 'molecube-cylinder-size-slider', 'molecube-spacing-slider'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateMolecubeTuner);
    });

    document.getElementById('btn-reset-molecube-defaults').addEventListener('click', () => {
        const defaults = {
            'molecube-ball-size-slider': 0.500,
            'molecube-cylinder-size-slider': 0.300,
            'molecube-spacing-slider': 0.020
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
