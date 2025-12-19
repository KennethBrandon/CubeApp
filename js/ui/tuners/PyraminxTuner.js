import { state } from '../../shared/state.js';
import { makeDraggable } from './TunerBase.js';

export function showPyraminxTuner() {
    if (!document.getElementById('pyraminx-tuner-ui')) {
        createPyraminxTuner();
    }
    document.getElementById('pyraminx-tuner-ui').classList.remove('hidden');
    syncValues();
}

function createPyraminxTuner() {
    const html = `
    <div id="pyraminx-tuner-ui"
        class="hidden absolute top-20 left-4 z-50 bg-black/80 backdrop-blur-md border border-gray-700 p-4 rounded-lg text-white text-sm shadow-xl w-72 h-[80vh] overflow-y-auto">
        <div id="pyraminx-tuner-header"
            class="flex justify-between items-center mb-3 cursor-move border-b border-gray-700 pb-2 bg-black/80 sticky top-0 z-10">
            <h3 class="font-bold text-green-400">Pyraminx Tuner</h3>
            <button id="close-pyraminx-tuner" class="text-gray-400 hover:text-white">&times;</button>
        </div>

        <div class="space-y-4">
            ${createSlider('Radius', 'radius', 0.5, 3.0, 0.05)}
            ${createSlider('Surface Dist', 'surfaceDist', 0.5, 2.0, 0.01)}
            ${createSlider('Cut Tip Dist (+)', 'cutDistTip', 0.5, 3.0, 0.01)}
            ${createSlider('Cut Middle Dist (-)', 'cutDistMiddle', -1.0, 1.0, 0.01)}
            ${createSlider('Sticker Scale', 'stickerScale', 0.1, 1.0, 0.01)}
            ${createSlider('Sticker Offset', 'stickerOffset', 0.001, 0.1, 0.001)}
            ${createSlider('Sticker Radius', 'stickerRadius', 0.0, 0.2, 0.01)}
            
            <div class="flex items-center mt-2">
                <input type="checkbox" id="chk-pyraminx-debug-planes" class="mr-2 w-4 h-4 text-green-500 bg-gray-700 border-gray-600 rounded focus:ring-green-500">
                <label for="chk-pyraminx-debug-planes" class="text-gray-300 text-xs">Show Debug Planes</label>
            </div>
            <div class="flex items-center mt-2">
                <input type="checkbox" id="chk-pyraminx-debug-colors" class="mr-2 w-4 h-4 text-green-500 bg-gray-700 border-gray-600 rounded focus:ring-green-500">
                <label for="chk-pyraminx-debug-colors" class="text-gray-300 text-xs">Show Debug Colors</label>
            </div>
        </div>

        <div class="mt-4 pt-4 border-t border-white/10 space-y-4">
            ${createSlider('Sticker Roughness', 'stickerRoughness', 0.0, 1.0, 0.01)}
            ${createSlider('Sticker Metalness', 'stickerMetalness', 0.0, 1.0, 0.01)}
            ${createSlider('Sticker Normal Scale', 'stickerNormalScale', 0.0, 1.0, 0.01)}
            ${createCheckbox('Use Sparkle', 'stickerUseSparkle')}
            ${createSlider('Cubie Gap', 'cubieGap', 0.0, 1.0, 0.01)}
            ${createSlider('Scramble Length', 'scrambleLength', 1, 50, 1)}
        </div>

        <div class="mt-6 text-center pb-4">
            <button id="btn-reset-pyraminx-defaults"
                class="bg-gray-700 hover:bg-gray-600 text-white text-xs py-1 px-3 rounded transition">
                Reset to Defaults
            </button>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    makeDraggable(document.getElementById('pyraminx-tuner-ui'), 'pyraminx-tuner-header');
    attachPyraminxListeners();
}

function createSlider(label, id, min, max, step) {
    return `
    <div>
        <label class="block mb-1 text-gray-300 text-xs">${label}: <span id="pyraminx-${id}-val" class="text-white font-mono float-right">-</span></label>
        <input type="range" id="pyraminx-${id}" min="${min}" max="${max}" step="${step}"
            class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-green-500">
    </div>`;
}

function createCheckbox(label, id) {
    return `
    <div class="flex items-center justify-between">
        <label class="text-gray-300 text-xs">${label}</label>
        <input type="checkbox" id="pyraminx-${id}" class="w-4 h-4 text-green-500 bg-gray-600 rounded cursor-pointer">
    </div>`;
}

function syncValues() {
    if (!state.activePuzzle || state.activePuzzle.constructor.name !== 'Pyraminx') return;
    const p = state.activePuzzle;

    const params = [
        'radius', 'surfaceDist', 'cutDistTip', 'cutDistMiddle', 'stickerScale', 'stickerOffset',
        'stickerRadius', 'cubieGap', 'stickerRoughness', 'stickerMetalness', 'stickerNormalScale',
        'scrambleLength'
    ];

    params.forEach(prop => {
        const el = document.getElementById(`pyraminx-${prop}`);
        const valEl = document.getElementById(`pyraminx-${prop}-val`);
        if (el && valEl) {
            el.value = p[prop];
            valEl.textContent = typeof p[prop] === 'number' ? p[prop].toFixed(3) : p[prop];
        }
    });

    const debugPlanesCheckbox = document.getElementById('chk-pyraminx-debug-planes');
    if (debugPlanesCheckbox) {
        debugPlanesCheckbox.checked = p.showDebugPlanes || false;
    }
    const debugColorsCheckbox = document.getElementById('chk-pyraminx-debug-colors');
    if (debugColorsCheckbox) {
        debugColorsCheckbox.checked = p.showDebugColors || false;
    }
    const sparkleCheck = document.getElementById('pyraminx-stickerUseSparkle');
    if (sparkleCheck) sparkleCheck.checked = p.stickerUseSparkle;
}

function attachPyraminxListeners() {
    document.getElementById('close-pyraminx-tuner').addEventListener('click', () => {
        document.getElementById('pyraminx-tuner-ui').classList.add('hidden');
        const toggle = document.getElementById('toggle-pyraminx-tuner');
        if (toggle) toggle.checked = false;
    });

    const updatePuzzle = (e) => {
        if (!state.activePuzzle || state.activePuzzle.constructor.name !== 'Pyraminx') return;
        const puzzle = state.activePuzzle;

        if (e.target.type === 'range') {
            const prop = e.target.id.replace('pyraminx-', '');
            const val = parseFloat(e.target.value);
            puzzle[prop] = val;
            document.getElementById(`${e.target.id}-val`).textContent = val.toFixed(3);
        } else if (e.target.type === 'checkbox' && e.target.id === 'chk-pyraminx-debug-planes') {
            puzzle.showDebugPlanes = e.target.checked;
        } else if (e.target.type === 'checkbox' && e.target.id === 'chk-pyraminx-debug-colors') {
            puzzle.showDebugColors = e.target.checked;
        }

        if (puzzle.rebuildGeometry) {
            puzzle.rebuildGeometry();
        }
    };

    const inputs = document.querySelectorAll('#pyraminx-tuner-ui input[type="range"]');
    inputs.forEach(input => {
        input.addEventListener('input', updatePuzzle);
    });

    document.getElementById('chk-pyraminx-debug-planes').addEventListener('change', updatePuzzle);
    document.getElementById('chk-pyraminx-debug-colors').addEventListener('change', updatePuzzle);

    const checkboxes = document.querySelectorAll('#pyraminx-tuner-ui input[type="checkbox"]');
    checkboxes.forEach(chk => {
        // Skip debug checkboxes since they have their own listeners
        if (chk.id === 'chk-pyraminx-debug-planes' || chk.id === 'chk-pyraminx-debug-colors') return;

        chk.addEventListener('change', (e) => {
            if (!state.activePuzzle || state.activePuzzle.constructor.name !== 'Pyraminx') return;
            const prop = e.target.id.replace('pyraminx-', '');
            state.activePuzzle[prop] = e.target.checked;
            if (state.activePuzzle.rebuildGeometry) {
                state.activePuzzle.rebuildGeometry();
            }
        });
    });

    document.getElementById('btn-reset-pyraminx-defaults').addEventListener('click', () => {
        const defaults = {
            radius: 1.5,
            surfaceDist: 1.2,
            cutDistTip: 2.2,
            cutDistMiddle: 0.0,
            stickerScale: 0.88,
            stickerOffset: 0.005,
            stickerRadius: 0.05,
            cubieGap: 0.02,
            stickerRoughness: 0.3,
            stickerMetalness: 0.1,
            stickerNormalScale: 0.75,
            stickerUseSparkle: true,
            scrambleLength: 25,
            showDebugPlanes: false,
            showDebugColors: false
        };

        if (state.activePuzzle && state.activePuzzle.constructor.name === 'Pyraminx') {
            Object.assign(state.activePuzzle, defaults);
            state.activePuzzle.rebuildGeometry();
            syncValues(); // Sync all values, including the checkbox
        }
    });
}
