import { state } from '../../shared/state.js';
import { makeDraggable } from './TunerBase.js';

export function showSkewbTuner() {
    if (!document.getElementById('skewb-tuner-ui')) {
        createSkewbTuner();
    }
    document.getElementById('skewb-tuner-ui').classList.remove('hidden');
    syncValues();
}

function createSkewbTuner() {
    const html = `
    <div id="skewb-tuner-ui"
        class="hidden absolute top-20 left-4 z-50 bg-black/80 backdrop-blur-md border border-gray-700 p-4 rounded-lg text-white text-sm shadow-xl w-72 h-[80vh] overflow-y-auto">
        <div id="skewb-tuner-header"
            class="flex justify-between items-center mb-3 cursor-move border-b border-gray-700 pb-2 bg-black/80 sticky top-0 z-10">
            <h3 class="font-bold text-orange-400">Skewb Tuner</h3>
            <button id="close-skewb-tuner" class="text-gray-400 hover:text-white">&times;</button>
        </div>

        <div class="space-y-4">
            ${createSlider('Radius', 'radius', 1.0, 3.0, 0.05)}
            ${createSlider('Cubie Gap', 'cubieGap', 0.0, 0.1, 0.001)}
            ${createSlider('Corner Inset', 'cornerStickerInset', 0.0, 0.2, 0.001)}
            ${createSlider('Center Inset', 'centerStickerInset', 0.0, 0.2, 0.001)}
            ${createSlider('Corner Radius', 'cornerStickerRadius', 0.0, 1.0, 0.01)}
            ${createSlider('Center Radius', 'centerStickerRadius', 0.0, 1.0, 0.01)}
            ${createSlider('Sticker Offset', 'stickerOffset', 0.001, 0.1, 0.001)}
            ${createSlider('Fillet Radius', 'filletRadius', 0.0, 0.25, 0.005)}
            ${createSlider('Fillet Steps', 'filletSteps', 1, 10, 1)}
            ${createSlider('Drag Scale', 'dragInputScale', 0.1, 5.0, 0.1)}
            
            <div class="flex items-center mt-2">
                <input type="checkbox" id="chk-skewb-debug-planes" class="mr-2 w-4 h-4 text-orange-500 bg-gray-700 border-gray-600 rounded focus:ring-orange-500">
                <label for="chk-skewb-debug-planes" class="text-gray-300 text-xs">Show Debug Planes</label>
            </div>
            <div class="flex items-center mt-2">
                <input type="checkbox" id="chk-skewb-debug-arrows" class="mr-2 w-4 h-4 text-orange-500 bg-gray-700 border-gray-600 rounded focus:ring-orange-500">
                <label for="chk-skewb-debug-arrows" class="text-gray-300 text-xs">Show Debug Arrows</label>
            </div>
        </div>

        <div class="mt-4 pt-4 border-t border-white/10 space-y-4">
            ${createSlider('Sticker Roughness', 'stickerRoughness', 0.0, 1.0, 0.01)}
            ${createSlider('Sticker Metalness', 'stickerMetalness', 0.0, 1.0, 0.01)}
            ${createSlider('Sparkle Scale', 'stickerNormalScale', 0.0, 1.0, 0.01)}
            ${createCheckbox('Use Sparkle', 'stickerUseSparkle')}
            ${createSlider('Scramble Length', 'scrambleLength', 1, 20, 1)}
        </div>

        <div class="mt-6 text-center pb-4">
            <button id="btn-reset-skewb-defaults"
                class="bg-gray-700 hover:bg-gray-600 text-white text-xs py-1 px-3 rounded transition">
                Reset to Defaults
            </button>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    makeDraggable(document.getElementById('skewb-tuner-ui'), 'skewb-tuner-header');
    attachSkewbListeners();
}

function createSlider(label, id, min, max, step) {
    return `
    <div>
        <label class="block mb-1 text-gray-300 text-xs">${label}: <span id="skewb-${id}-val" class="text-white font-mono float-right">-</span></label>
        <input type="range" id="skewb-${id}" min="${min}" max="${max}" step="${step}"
            class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-orange-500">
    </div>`;
}

function createCheckbox(label, id) {
    return `
    <div class="flex items-center justify-between">
        <label class="text-gray-300 text-xs">${label}</label>
        <input type="checkbox" id="skewb-${id}" class="w-4 h-4 text-orange-500 bg-gray-600 rounded cursor-pointer">
    </div>`;
}

function syncValues() {
    if (!state.activePuzzle || state.activePuzzle.constructor.name !== 'Skewb') return;
    const p = state.activePuzzle;

    const params = [
        'radius', 'cubieGap', 'cornerStickerInset', 'centerStickerInset', 'cornerStickerRadius', 'centerStickerRadius',
        'stickerOffset', 'filletRadius', 'filletSteps', 'stickerRoughness', 'stickerMetalness', 'stickerUseSparkle', 'stickerNormalScale',
        'scrambleLength', 'dragInputScale'
    ];

    // ...

    const defaults = {
        radius: 1.5,
        cubieGap: 0.01,
        cornerStickerInset: 0.08,
        centerStickerInset: 0.08,
        cornerStickerRadius: 0.25,
        centerStickerRadius: 0.25,
        stickerOffset: 0.005,
        filletRadius: 0.055,
        filletSteps: 3,
        stickerRoughness: 0.39,
        stickerMetalness: 0.1,
        stickerUseSparkle: true,
        stickerNormalScale: 0.7,
        scrambleLength: 12,
        showDebugPlanes: false,
        dragInputScale: 1.7
    };

    params.forEach(prop => {
        const el = document.getElementById(`skewb-${prop}`);
        const valEl = document.getElementById(`skewb-${prop}-val`);
        if (el && valEl) {
            el.value = p[prop];
            valEl.textContent = typeof p[prop] === 'number' ? p[prop].toFixed(3) : p[prop];
        }
    });

    const debugPlanesCheckbox = document.getElementById('chk-skewb-debug-planes');
    if (debugPlanesCheckbox) {
        debugPlanesCheckbox.checked = p.showDebugPlanes || false;
    }
    const debugArrowsCheckbox = document.getElementById('chk-skewb-debug-arrows');
    if (debugArrowsCheckbox) {
        debugArrowsCheckbox.checked = p.showDebugArrows || false;
    }
    const sparkleCheck = document.getElementById('skewb-stickerUseSparkle');
    if (sparkleCheck) sparkleCheck.checked = p.stickerUseSparkle;
}

function attachSkewbListeners() {
    document.getElementById('close-skewb-tuner').addEventListener('click', () => {
        document.getElementById('skewb-tuner-ui').classList.add('hidden');
        const toggle = document.getElementById('toggle-skewb-tuner');
        if (toggle) toggle.checked = false;
    });

    const updatePuzzle = (e) => {
        if (!state.activePuzzle || state.activePuzzle.constructor.name !== 'Skewb') return;
        const puzzle = state.activePuzzle;

        if (e.target.type === 'range') {
            const prop = e.target.id.replace('skewb-', '');
            const val = parseFloat(e.target.value);
            puzzle[prop] = val;
            document.getElementById(`${e.target.id}-val`).textContent = val.toFixed(3);
        } else if (e.target.type === 'checkbox' && e.target.id === 'chk-skewb-debug-planes') {
            puzzle.showDebugPlanes = e.target.checked;
        } else if (e.target.type === 'checkbox' && e.target.id === 'chk-skewb-debug-arrows') {
            puzzle.showDebugArrows = e.target.checked;
        }

        if (puzzle.rebuildGeometry) {
            puzzle.rebuildGeometry();
        }
    };

    const inputs = document.querySelectorAll('#skewb-tuner-ui input[type="range"]');
    inputs.forEach(input => {
        input.addEventListener('input', updatePuzzle);
    });

    document.getElementById('chk-skewb-debug-planes').addEventListener('change', updatePuzzle);
    document.getElementById('chk-skewb-debug-arrows').addEventListener('change', updatePuzzle);

    const checkboxes = document.querySelectorAll('#skewb-tuner-ui input[type="checkbox"]');
    checkboxes.forEach(chk => {
        if (chk.id === 'chk-skewb-debug-planes' || chk.id === 'chk-skewb-debug-arrows') return;

        chk.addEventListener('change', (e) => {
            if (!state.activePuzzle || state.activePuzzle.constructor.name !== 'Skewb') return;
            const prop = e.target.id.replace('skewb-', '');
            state.activePuzzle[prop] = e.target.checked;
            if (state.activePuzzle.rebuildGeometry) {
                state.activePuzzle.rebuildGeometry();
            }
        });
    });

    document.getElementById('btn-reset-skewb-defaults').addEventListener('click', () => {
        const defaults = {
            radius: 1.5,
            cubieGap: 0.01,
            cornerStickerInset: 0.08,
            centerStickerInset: 0.08,
            cornerStickerRadius: 0.25,
            centerStickerRadius: 0.25,
            stickerOffset: 0.005,
            filletRadius: 0.055,
            filletSteps: 3,
            stickerRoughness: 0.2,
            stickerMetalness: 0.1,
            stickerUseSparkle: true,
            scrambleLength: 12,
            showDebugPlanes: false,
            showDebugArrows: false,
            dragInputScale: 1.7
        };

        if (state.activePuzzle && state.activePuzzle.constructor.name === 'Skewb') {
            Object.assign(state.activePuzzle, defaults);
            state.activePuzzle.rebuildGeometry();
            syncValues();
        }
    });
}
