import { state } from '../../shared/state.js';
import { makeDraggable } from './TunerBase.js';

export function showMegaminxTuner() {
    if (!document.getElementById('megaminx-tuner-ui')) {
        createMegaminxTuner();
    }
    document.getElementById('megaminx-tuner-ui').classList.remove('hidden');
    syncValues();
}

function createMegaminxTuner() {
    const html = `
    <div id="megaminx-tuner-ui"
        class="hidden absolute top-20 left-4 z-50 bg-black/80 backdrop-blur-md border border-gray-700 p-4 rounded-lg text-white text-sm shadow-xl w-72 h-[80vh] overflow-y-auto">
        <div id="megaminx-tuner-header"
            class="flex justify-between items-center mb-3 cursor-move border-b border-gray-700 pb-2 bg-black/80 sticky top-0 z-10">
            <h3 class="font-bold text-pink-400">Megaminx Tuner</h3>
            <button id="close-megaminx-tuner" class="text-gray-400 hover:text-white">&times;</button>
        </div>

        <div class="space-y-4">
            ${createSlider('Radius', 'radius', 0.5, 3.0, 0.05)}
            ${createSlider('Surface Dist', 'surfaceDist', 0.5, 2.0, 0.01)}
            ${createSlider('Cut Dist', 'cutDist', 0.1, 1.5, 0.01)}
            ${createSlider('Sticker Scale', 'stickerScale', 0.1, 1.0, 0.01)}
            ${createSlider('Sticker Offset', 'stickerOffset', 0.001, 0.1, 0.001)}
            ${createSlider('Sticker Radius', 'stickerRadius', 0.0, 0.2, 0.01)}
            ${createSlider('Fillet Radius', 'filletRadius', 0.0, 0.25, 0.005)}
            ${createSlider('Y Rotation', 'yRotation', -180, 180, 5)}
            ${createSlider('Cubie Gap', 'cubieGap', 0.0, 1.0, 0.01)}
        </div>

        <div class="mt-6 text-center pb-4">
            <button id="btn-reset-megaminx-defaults"
                class="bg-gray-700 hover:bg-gray-600 text-white text-xs py-1 px-3 rounded transition">
                Reset to Defaults
            </button>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    makeDraggable(document.getElementById('megaminx-tuner-ui'), 'megaminx-tuner-header');
    attachMegaminxListeners();
}

function createSlider(label, id, min, max, step) {
    return `
    <div>
        <label class="block mb-1 text-gray-300 text-xs">${label}: <span id="megaminx-${id}-val" class="text-white font-mono float-right">-</span></label>
        <input type="range" id="megaminx-${id}" min="${min}" max="${max}" step="${step}"
            class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-pink-500">
    </div>`;
}

function syncValues() {
    if (!state.activePuzzle || state.activePuzzle.constructor.name !== 'Megaminx') return;
    const p = state.activePuzzle;

    const params = [
        'radius', 'surfaceDist', 'cutDist', 'stickerScale', 'stickerOffset',
        'stickerRadius', 'filletRadius', 'yRotation', 'cubieGap'
    ];

    params.forEach(prop => {
        const el = document.getElementById(`megaminx-${prop}`);
        const valEl = document.getElementById(`megaminx-${prop}-val`);
        if (el && valEl) {
            el.value = p[prop];
            valEl.textContent = typeof p[prop] === 'number' ? p[prop].toFixed(3) : p[prop];
        }
    });
}

function attachMegaminxListeners() {
    document.getElementById('close-megaminx-tuner').addEventListener('click', () => {
        document.getElementById('megaminx-tuner-ui').classList.add('hidden');
        const toggle = document.getElementById('toggle-megaminx-tuner');
        if (toggle) toggle.checked = false;
    });

    const updatePuzzle = (e) => {
        if (!state.activePuzzle || state.activePuzzle.constructor.name !== 'Megaminx') return;

        const prop = e.target.id.replace('megaminx-', '');
        const val = parseFloat(e.target.value);

        state.activePuzzle[prop] = val;
        document.getElementById(`${e.target.id}-val`).textContent = val.toFixed(3);

        if (state.activePuzzle.rebuildGeometry) {
            state.activePuzzle.rebuildGeometry();
        }
    };

    const inputs = document.querySelectorAll('#megaminx-tuner-ui input[type="range"]');
    inputs.forEach(input => {
        input.addEventListener('input', updatePuzzle);
    });

    document.getElementById('btn-reset-megaminx-defaults').addEventListener('click', () => {
        // Hardcoded defaults based on current Megaminx.js
        const defaults = {
            radius: 1.25,
            surfaceDist: 1.29,
            cutDist: 0.87,
            stickerScale: 0.86,
            stickerOffset: 0.005,
            stickerRadius: 0.08,
            filletRadius: 0.015,
            yRotation: 165,
            cubieGap: 0.02
        };

        if (state.activePuzzle && state.activePuzzle.constructor.name === 'Megaminx') {
            Object.assign(state.activePuzzle, defaults);
            state.activePuzzle.rebuildGeometry();
            syncValues();
        }
    });
}
