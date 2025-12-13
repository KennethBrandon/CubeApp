import { state } from '../../shared/state.js';
import { makeDraggable } from './TunerBase.js';

export function showCubeTuner() {
    if (!document.getElementById('cube-tuner-ui')) {
        createCubeTuner();
    }
    document.getElementById('cube-tuner-ui').classList.remove('hidden');
}

function createCubeTuner() {
    const html = `
    <div id="cube-tuner-ui"
        class="hidden absolute top-20 left-4 z-50 bg-black/70 backdrop-blur-md border border-gray-700 p-4 rounded-lg text-white text-sm shadow-xl w-64">
        <div id="cube-tuner-header"
            class="flex justify-between items-center mb-3 cursor-move border-b border-gray-700 pb-2">
            <h3 class="font-bold text-blue-400">Cube Tuner</h3>
            <button id="close-cube-tuner" class="text-gray-400 hover:text-white">&times;</button>
        </div>

        <div class="mb-3">
            <label class="block mb-1 text-gray-300">Cubie Radius: <span id="cubie-radius-val"
                    class="text-white font-mono">0.074</span></label>
            <input type="range" id="cubie-radius-slider" min="0" max="1.0" step="0.001" value="0.074"
                class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500">
        </div>

        <div class="mb-3">
            <label class="block mb-1 text-gray-300">Cubie Gap: <span id="cubie-gap-val"
                    class="text-white font-mono">0.004</span></label>
            <input type="range" id="cubie-gap-slider" min="0" max="0.2" step="0.001" value="0.004"
                class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500">
        </div>

        <div class="mb-3">
            <label class="block mb-1 text-gray-300">Sticker Size: <span id="sticker-size-val"
                    class="text-white font-mono">0.800</span></label>
            <input type="range" id="sticker-size-slider" min="0.5" max="1.0" step="0.005" value="0.800"
                class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500">
        </div>

        <div class="mb-3">
            <label class="block mb-1 text-gray-300">Sticker Radius: <span id="sticker-radius-val"
                    class="text-white font-mono">0.200</span></label>
            <input type="range" id="sticker-radius-slider" min="0" max="0.5" step="0.005" value="0.200"
                class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500">
        </div>

        <div class="mt-4 text-center">
            <button id="btn-reset-tuner-defaults"
                class="bg-gray-700 hover:bg-gray-600 text-white text-xs py-1 px-3 rounded transition">
                Reset to Defaults
            </button>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    makeDraggable(document.getElementById('cube-tuner-ui'), 'cube-tuner-header');
    attachCubeTunerListeners();
}

function attachCubeTunerListeners() {
    document.getElementById('close-cube-tuner').addEventListener('click', () => {
        document.getElementById('cube-tuner-ui').classList.add('hidden');
        const toggle = document.getElementById('toggle-cube-tuner');
        if (toggle) toggle.checked = false;
    });

    const updateCubeTuner = () => {
        if (!state.activePuzzle) return;
        const cubieRadius = parseFloat(document.getElementById('cubie-radius-slider').value);
        const cubieGap = parseFloat(document.getElementById('cubie-gap-slider').value);
        const stickerSize = parseFloat(document.getElementById('sticker-size-slider').value);
        const stickerRadius = parseFloat(document.getElementById('sticker-radius-slider').value);

        document.getElementById('cubie-radius-val').textContent = cubieRadius.toFixed(3);
        document.getElementById('cubie-gap-val').textContent = cubieGap.toFixed(3);
        document.getElementById('sticker-size-val').textContent = stickerSize.toFixed(3);
        document.getElementById('sticker-radius-val').textContent = stickerRadius.toFixed(3);

        if (state.activePuzzle.updateRadius) state.activePuzzle.updateRadius(cubieRadius);
        if (state.activePuzzle.updateSpacing) state.activePuzzle.updateSpacing(cubieGap);
        if (state.activePuzzle.updateStickers) state.activePuzzle.updateStickers(stickerSize, stickerRadius);
    };

    ['cubie-radius-slider', 'cubie-gap-slider', 'sticker-size-slider', 'sticker-radius-slider'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateCubeTuner);
    });

    document.getElementById('btn-reset-tuner-defaults').addEventListener('click', () => {
        const defaults = {
            'cubie-radius-slider': 0.074,
            'cubie-gap-slider': 0.004,
            'sticker-size-slider': 0.800,
            'sticker-radius-slider': 0.200
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
