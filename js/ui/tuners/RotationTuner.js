import { state } from '../../shared/state.js';
import { makeDraggable } from './TunerBase.js';

export function showRotationTuner() {
    if (!document.getElementById('rotation-tuner-ui')) {
        createRotationTuner();
    }
    document.getElementById('rotation-tuner-ui').classList.remove('hidden');
    syncRotationValues();
}

function createRotationTuner() {
    const html = `
    <div id="rotation-tuner-ui"
        class="hidden absolute top-20 right-4 z-50 bg-black/80 backdrop-blur-md border border-gray-700 p-4 rounded-lg text-white text-sm shadow-xl w-72 max-h-[80vh] overflow-y-auto">
        <div id="rotation-tuner-header"
            class="flex justify-between items-center mb-3 cursor-move border-b border-gray-700 pb-2 bg-black/80 sticky top-0 z-10">
            <h3 class="font-bold text-cyan-400">Rotation Tuner</h3>
            <button id="close-rotation-tuner" class="text-gray-400 hover:text-white">&times;</button>
        </div>

        <div class="space-y-6">
            ${['x', 'y', 'z'].map(axis => `
                <div class="p-2 border border-gray-700 rounded bg-gray-900/50">
                    <div class="font-bold text-orange-400 mb-2 border-b border-gray-800 pb-1">Axis ${axis.toUpperCase()}</div>
                    <div class="flex items-center justify-between mb-2">
                        <label class="text-xs text-gray-300">Negate Axis</label>
                        <input type="checkbox" id="rot-negate-${axis}" class="w-4 h-4 accent-cyan-500">
                    </div>
                    <div>
                        <label class="block mb-1 text-gray-300 text-xs">Drag Scale: <span id="rot-scale-${axis}-val" class="text-white font-mono float-right">1.0</span></label>
                        <input type="range" id="rot-scale-${axis}" min="-2.0" max="2.0" step="0.1"
                            class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500">
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="mt-4 p-2 bg-black/40 border border-gray-700 rounded text-[10px] font-mono whitespace-pre text-yellow-200" id="rot-debug-info">
Debug Info:
No active move
        </div>

        <div class="mt-4 flex gap-2">
            <button id="btn-copy-rot-config"
                class="flex-1 bg-cyan-700 hover:bg-cyan-600 text-white text-[10px] py-1 px-2 rounded transition">
                Copy Config
            </button>
            <button id="btn-reset-rot-tuner"
                class="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-[10px] py-1 px-2 rounded transition">
                Reset
            </button>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    makeDraggable(document.getElementById('rotation-tuner-ui'), 'rotation-tuner-header');
    attachRotationListeners();

    // Start debug update loop
    updateDebugLoop();
}

function syncRotationValues() {
    if (!state.activePuzzle || !state.activePuzzle.rotationTuning) return;
    const tuning = state.activePuzzle.rotationTuning;

    ['x', 'y', 'z'].forEach(axis => {
        const config = tuning[axis];
        if (!config) return;

        const negateCheck = document.getElementById(`rot-negate-${axis}`);
        if (negateCheck) negateCheck.checked = config.negate;

        const scaleSlider = document.getElementById(`rot-scale-${axis}`);
        const scaleVal = document.getElementById(`rot-scale-${axis}-val`);
        if (scaleSlider && scaleVal) {
            scaleSlider.value = config.scale;
            scaleVal.textContent = config.scale.toFixed(1);
        }
    });
}

function attachRotationListeners() {
    document.getElementById('close-rotation-tuner').addEventListener('click', () => {
        document.getElementById('rotation-tuner-ui').classList.add('hidden');
    });

    ['x', 'y', 'z'].forEach(axis => {
        const negateCheck = document.getElementById(`rot-negate-${axis}`);
        negateCheck.addEventListener('change', (e) => {
            if (state.activePuzzle && state.activePuzzle.rotationTuning) {
                state.activePuzzle.rotationTuning[axis].negate = e.target.checked;
            }
        });

        const scaleSlider = document.getElementById(`rot-scale-${axis}`);
        scaleSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (state.activePuzzle && state.activePuzzle.rotationTuning) {
                state.activePuzzle.rotationTuning[axis].scale = val;
                document.getElementById(`rot-scale-${axis}-val`).textContent = val.toFixed(1);
            }
        });
    });

    document.getElementById('btn-copy-rot-config').addEventListener('click', () => {
        if (!state.activePuzzle || !state.activePuzzle.rotationTuning) return;
        const json = JSON.stringify(state.activePuzzle.rotationTuning, null, 4);
        const code = `rotationTuning: ${json}`;
        navigator.clipboard.writeText(code).then(() => {
            const btn = document.getElementById('btn-copy-rot-config');
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = originalText, 1500);
        });
    });

    document.getElementById('btn-reset-rot-tuner').addEventListener('click', () => {
        if (!state.activePuzzle) return;
        state.activePuzzle.rotationTuning = {
            x: { negate: false, scale: 1 },
            y: { negate: false, scale: 1 },
            z: { negate: false, scale: 1 }
        };
        syncRotationValues();
    });
}

function updateDebugLoop() {
    if (!document.getElementById('rotation-tuner-ui')) return;

    const debugEl = document.getElementById('rot-debug-info');
    if (debugEl && !document.getElementById('rotation-tuner-ui').classList.contains('hidden')) {
        let info = "Debug Info:\n";
        if (state.isDragging && state.dragAxis && state.dragAxis !== 'free') {
            info += `Axis Lock: ${state.dragAxis}\n`;
            info += `Input Axis: ${state.dragInputAxis}\n`;
            info += `Drag Angle: ${state.currentDragAngle.toFixed(3)}\n`;
            info += `Scale: ${state.dragAngleScale.toFixed(2)}\n`;

            // Try to predict notation 
            if (state.activePuzzle && state.activePuzzle.getNotation) {
                const piHalf = state.activePuzzle.getSnapAngle ? state.activePuzzle.getSnapAngle() : Math.PI / 2;
                const rawTurns = state.currentDragAngle / piHalf;
                const targetTurns = Math.round(rawTurns);
                const notation = state.activePuzzle.getNotation(state.dragAxis, Infinity, targetTurns, true, state.dragRotationAxis);
                info += `Predicted Nat: ${notation || 'None'}`;
            }
        } else {
            info += "No active move";
        }
        debugEl.textContent = info;
    }

    requestAnimationFrame(updateDebugLoop);
}
