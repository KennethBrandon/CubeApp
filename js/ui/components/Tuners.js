import { state } from '../../shared/state.js';

export function showCubeTuner() {
    if (!document.getElementById('cube-tuner-ui')) {
        createCubeTuner();
    }
    document.getElementById('cube-tuner-ui').classList.remove('hidden');
}

export function showMolecubeTuner() {
    if (!document.getElementById('molecube-tuner-ui')) {
        createMolecubeTuner();
    }
    document.getElementById('molecube-tuner-ui').classList.remove('hidden');
}

export function showAcornsTuner() {
    if (!document.getElementById('acorns-tuner-ui')) {
        createAcornsTuner();
    }
    document.getElementById('acorns-tuner-ui').classList.remove('hidden');
}

export function showMirrorTuner() {
    if (!document.getElementById('mirror-debug-ui')) {
        createMirrorTuner();
    }
    document.getElementById('mirror-debug-ui').classList.remove('hidden');
}

function makeDraggable(elmnt, handleId) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = document.getElementById(handleId);
    const dragTarget = header || elmnt;

    dragTarget.onmousedown = dragMouseDown;
    dragTarget.ontouchstart = dragTouchStart;

    function dragMouseDown(e) {
        e = e || window.event;
        if (['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'LABEL'].includes(e.target.tagName)) return;
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function dragTouchStart(e) {
        if (['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'LABEL'].includes(e.target.tagName)) return;
        if (e.cancelable) e.preventDefault();
        const touch = e.touches[0];
        pos3 = touch.clientX;
        pos4 = touch.clientY;
        document.ontouchend = closeDragElement;
        document.ontouchmove = elementTouchDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
        elmnt.style.right = 'auto';
        elmnt.style.bottom = 'auto';
    }

    function elementTouchDrag(e) {
        if (e.cancelable) e.preventDefault();
        const touch = e.touches[0];
        pos1 = pos3 - touch.clientX;
        pos2 = pos4 - touch.clientY;
        pos3 = touch.clientX;
        pos4 = touch.clientY;
        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
        elmnt.style.right = 'auto';
        elmnt.style.bottom = 'auto';
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        document.ontouchend = null;
        document.ontouchmove = null;
    }
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
