import { state } from '../../shared/state.js';
import { makeDraggable } from './TunerBase.js';

export function showMirrorTuner() {
    if (!document.getElementById('mirror-debug-ui')) {
        createMirrorTuner();
    }
    document.getElementById('mirror-debug-ui').classList.remove('hidden');
}

function createMirrorTuner() {
    const html = `
    <div id="mirror-debug-ui"
        class="hidden absolute top-20 left-4 z-50 bg-black/70 backdrop-blur-md border border-gray-700 p-4 rounded-lg text-white text-sm shadow-xl w-64">
        <div id="mirror-debug-header"
            class="flex justify-between items-center mb-3 cursor-move border-b border-gray-700 pb-2">
            <h3 class="font-bold text-yellow-400">Mirror Blocks Tuner</h3>
            <button id="close-sticker-tuner" class="text-gray-400 hover:text-white">&times;</button>
        </div>
        <div class="mb-3">
            <label class="block mb-1 text-gray-300">Margin: <span id="margin-val"
                    class="text-white font-mono">0.040</span></label>
            <input type="range" id="sticker-margin" min="0" max="0.2" step="0.005" value="0.040"
                class="w-48 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-yellow-500">
        </div>
        <div>
            <label class="block mb-1 text-gray-300">Radius: <span id="radius-val"
                    class="text-white font-mono">0.080</span></label>
            <input type="range" id="sticker-radius" min="0" max="0.5" step="0.01" value="0.080"
                class="w-48 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-yellow-500">
        </div>

        <div class="mt-4 pt-3 border-t border-gray-700">
            <h3 class="font-bold mb-3 text-green-400">Material Properties</h3>

            <div class="mb-3">
                <label class="flex items-center gap-2 cursor-pointer mb-2">
                    <input type="checkbox" id="toggle-sparkle-texture" checked
                        class="w-4 h-4 rounded bg-gray-600 border-gray-500 text-blue-600">
                    <span class="text-xs font-bold text-gray-300">Enable Sparkle Texture</span>
                </label>
            </div>

            <div class="mb-3">
                <label class="block mb-1 text-gray-300">Metalness: <span id="metalness-val"
                        class="text-white font-mono">0.60</span></label>
                <input type="range" id="material-metalness" min="0" max="1" step="0.05" value="0.6"
                    class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-green-500">
            </div>

            <div class="mb-3">
                <label class="block mb-1 text-gray-300">Roughness: <span id="roughness-val"
                        class="text-white font-mono">0.40</span></label>
                <input type="range" id="material-roughness" min="0" max="1" step="0.05" value="0.4"
                    class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-green-500">
            </div>

            <div class="mb-3">
                <label class="block mb-1 text-gray-300">Normal Intensity: <span id="normal-intensity-val"
                        class="text-white font-mono">0.50</span></label>
                <input type="range" id="normal-intensity" min="0" max="1" step="0.05" value="0.5"
                    class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-green-500">
            </div>
        </div>

        <div class="mt-4 pt-3 border-t border-gray-700">
            <h3 class="font-bold mb-3 text-blue-400">Dimensions (x S)</h3>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block mb-1 text-xs text-gray-300">Left (X-)</label>
                    <input type="range" id="dim-left" min="0.5" max="2.5" step="0.1" value="1.4"
                        class="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500">
                    <span id="val-left" class="text-xs font-mono text-white block text-right">1.4</span>
                </div>
                <div>
                    <label class="block mb-1 text-xs text-gray-300">Right (X+)</label>
                    <input type="range" id="dim-right" min="0.5" max="2.5" step="0.1" value="1.6"
                        class="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500">
                    <span id="val-right" class="text-xs font-mono text-white block text-right">1.6</span>
                </div>
                <div>
                    <label class="block mb-1 text-xs text-gray-300">Bottom (Y-)</label>
                    <input type="range" id="dim-bottom" min="0.5" max="2.5" step="0.1" value="2.2"
                        class="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500">
                    <span id="val-bottom" class="text-xs font-mono text-white block text-right">2.2</span>
                </div>
                <div>
                    <label class="block mb-1 text-xs text-gray-300">Top (Y+)</label>
                    <input type="range" id="dim-top" min="0.5" max="2.5" step="0.1" value="0.8"
                        class="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500">
                    <span id="val-top" class="text-xs font-mono text-white block text-right">0.8</span>
                </div>
                <div>
                    <label class="block mb-1 text-xs text-gray-300">Back (Z-)</label>
                    <input type="range" id="dim-back" min="0.5" max="2.5" step="0.1" value="1.1"
                        class="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500">
                    <span id="val-back" class="text-xs font-mono text-white block text-right">1.1</span>
                </div>
                <div>
                    <label class="block mb-1 text-xs text-gray-300">Front (Z+)</label>
                    <input type="range" id="dim-front" min="0.5" max="2.5" step="0.1" value="1.9"
                        class="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500">
                    <span id="val-front" class="text-xs font-mono text-white block text-right">1.9</span>
                </div>
            </div>
            <div class="mt-4 text-center">
                <button id="btn-reset-mirror-defaults"
                    class="bg-gray-700 hover:bg-gray-600 text-white text-xs py-1 px-3 rounded transition">
                    Reset to Defaults
                </button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    makeDraggable(document.getElementById('mirror-debug-ui'), 'mirror-debug-header');
    attachMirrorTunerListeners();
}

function attachMirrorTunerListeners() {
    // Mirror Cube Debug UI Listeners
    const updateMirrorStickers = () => {
        // Need to check if it's MirrorCube. We can't import MirrorCube class easily to check instanceof 
        // without circular dependency issues potentially, or just rely on state.activePuzzle properties.
        // But we can import MirrorCube if we want.
        // For now, let's just check if the method exists.
        if (state.activePuzzle && state.activePuzzle.updateStickers) {
            const margin = parseFloat(document.getElementById('sticker-margin').value);
            const radius = parseFloat(document.getElementById('sticker-radius').value);
            document.getElementById('margin-val').textContent = margin.toFixed(3);
            document.getElementById('radius-val').textContent = radius.toFixed(3);
            state.activePuzzle.updateStickers(margin, radius);
        }
    };

    const marginSlider = document.getElementById('sticker-margin');
    const radiusSlider = document.getElementById('sticker-radius');
    if (marginSlider) marginSlider.addEventListener('input', updateMirrorStickers);
    if (radiusSlider) radiusSlider.addEventListener('input', updateMirrorStickers);

    document.getElementById('close-sticker-tuner').addEventListener('click', () => {
        document.getElementById('mirror-debug-ui').classList.add('hidden');
        const toggle = document.getElementById('toggle-sticker-tuner');
        if (toggle) toggle.checked = false;
    });

    const updateMirrorDimensions = () => {
        if (state.activePuzzle && state.activePuzzle.updateDimensions) {
            const left = parseFloat(document.getElementById('dim-left').value);
            const right = parseFloat(document.getElementById('dim-right').value);
            const bottom = parseFloat(document.getElementById('dim-bottom').value);
            const top = parseFloat(document.getElementById('dim-top').value);
            const back = parseFloat(document.getElementById('dim-back').value);
            const front = parseFloat(document.getElementById('dim-front').value);

            document.getElementById('val-left').textContent = left.toFixed(1);
            document.getElementById('val-right').textContent = right.toFixed(1);
            document.getElementById('val-bottom').textContent = bottom.toFixed(1);
            document.getElementById('val-top').textContent = top.toFixed(1);
            document.getElementById('val-back').textContent = back.toFixed(1);
            document.getElementById('val-front').textContent = front.toFixed(1);

            state.activePuzzle.updateDimensions({ left, right, bottom, top, back, front });
        }
    };

    ['dim-left', 'dim-right', 'dim-bottom', 'dim-top', 'dim-back', 'dim-front'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateMirrorDimensions);
    });

    document.getElementById('btn-reset-mirror-defaults').addEventListener('click', () => {
        const defaults = {
            'dim-left': 1.4,
            'dim-right': 1.6,
            'dim-bottom': 2.2,
            'dim-top': 0.8,
            'dim-back': 1.1,
            'dim-front': 1.9
        };
        for (const [id, val] of Object.entries(defaults)) {
            const el = document.getElementById(id);
            if (el) {
                el.value = val;
                el.dispatchEvent(new Event('input'));
            }
        }
    });

    const updateMirrorMaterials = () => {
        if (state.activePuzzle && state.activePuzzle.stickers) {
            const metalness = parseFloat(document.getElementById('material-metalness').value);
            const roughness = parseFloat(document.getElementById('material-roughness').value);
            const normalIntensity = parseFloat(document.getElementById('normal-intensity').value);
            const sparkleEnabled = document.getElementById('toggle-sparkle-texture').checked;

            document.getElementById('metalness-val').textContent = metalness.toFixed(2);
            document.getElementById('roughness-val').textContent = roughness.toFixed(2);
            document.getElementById('normal-intensity-val').textContent = normalIntensity.toFixed(2);

            state.activePuzzle.stickers.forEach(sticker => {
                if (sticker.material) {
                    sticker.material.metalness = metalness;
                    sticker.material.roughness = roughness;
                    sticker.material.normalMap = sparkleEnabled ? state.activePuzzle.sparkleMap : null;
                    sticker.material.normalScale.set(normalIntensity, normalIntensity);
                    sticker.material.needsUpdate = true;
                }
            });
        }
    };

    const metalnessSlider = document.getElementById('material-metalness');
    const roughnessSlider = document.getElementById('material-roughness');
    const normalIntensitySlider = document.getElementById('normal-intensity');
    const sparkleToggle = document.getElementById('toggle-sparkle-texture');

    if (metalnessSlider) metalnessSlider.addEventListener('input', updateMirrorMaterials);
    if (roughnessSlider) roughnessSlider.addEventListener('input', updateMirrorMaterials);
    if (normalIntensitySlider) normalIntensitySlider.addEventListener('input', updateMirrorMaterials);
    if (sparkleToggle) sparkleToggle.addEventListener('change', updateMirrorMaterials);
}
