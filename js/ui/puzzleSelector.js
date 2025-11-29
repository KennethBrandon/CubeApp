import { state } from '../shared/state.js';
import { StandardCube } from '../puzzles/StandardCube.js';
import { MirrorCube } from '../puzzles/MirrorCube.js';
import { hardReset } from '../game/scramble.js';
import { getMirrorHeight, toggleMirrors } from '../core/environment.js';
import { adjustCameraForCubeSize } from '../core/controls.js';
import { playCubeAnimation } from '../animations/transitions.js';
import { updateActivePuzzleTab } from './ui.js';
import { initPreview, updatePreview, disposePreview } from './puzzlePreview.js';

export const puzzleCategories = {
    'standard': [2, 3, 4, 5, 6, 7],
    'big': [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
    'cuboids': ['2x2x3', '3x3x2', '3x3x4', '3x3x5', '2x2x4', '2x2x1', '3x3x1'],
    'mirror': ['mirror-2x2x2', 'mirror-3x3x3', 'mirror-4x4x4', 'mirror-5x5x5', 'mirror-6x6x6', 'mirror-7x7x7']
};

export function setupPuzzleSelector() {
    const btn = document.getElementById('btn-puzzle-select');
    if (btn) {
        btn.addEventListener('click', openPuzzleSelector);
    }

    const closeBtn = document.getElementById('btn-close-puzzle-selector');
    if (closeBtn) {
        closeBtn.addEventListener('click', closePuzzleSelector);
    }

    // Category switching
    document.querySelectorAll('.puzzle-category-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            showCategory(e.target.dataset.category);
        });
    });

    // Initial render of options
    renderPuzzleOptions();

    // Custom Puzzle Form Listeners
    setupCustomPuzzleListeners();

    // Carousel Scroll Listener
    const carousel = document.getElementById('puzzle-carousel');
    if (carousel) {
        carousel.addEventListener('scroll', () => {
            const scrollLeft = carousel.scrollLeft;
            const width = carousel.offsetWidth;
            const index = Math.round(scrollLeft / width);

            const categories = ['standard', 'big', 'cuboids', 'mirror', 'custom'];
            if (index >= 0 && index < categories.length) {
                updateSidebarActive(categories[index]);
            }
        }, { passive: true });
    }
}

let currentActiveCategory = null;

function updateSidebarActive(category) {
    if (currentActiveCategory === category) return;
    currentActiveCategory = category;
    state.lastLibraryCategory = category;

    document.querySelectorAll('.puzzle-category-btn').forEach(btn => {
        if (btn.dataset.category === category) {
            btn.classList.add('bg-blue-600', 'text-white');
            btn.classList.remove('text-gray-400', 'hover:bg-gray-800');
        } else {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('text-gray-400', 'hover:bg-gray-800');
        }
    });

    if (category === 'custom') {
        // Initialize preview
        // Debounce slightly to ensure snap is settling
        setTimeout(() => {
            initPreview('custom-puzzle-preview');
            // Trigger initial update based on current slider values
            const d1 = parseInt(document.getElementById('custom-modal-d1').value);
            const d2 = parseInt(document.getElementById('custom-modal-d2').value);
            const d3 = parseInt(document.getElementById('custom-modal-d3').value);
            const isMirror = document.getElementById('custom-modal-mirror').checked;

            const dims = [d1, d2, d3].sort((a, b) => b - a);
            const newDims = { x: dims[1], y: dims[0], z: dims[2] };

            updatePreview(newDims, isMirror);
        }, 50);
    } else {
        // Optional: Dispose if leaving custom tab to save resources
        // disposePreview(); 
    }
}


let selectionCallback = null;

export function openPuzzleSelector(callback = null) {
    if (typeof callback === 'function') {
        selectionCallback = callback;
    } else {
        selectionCallback = null;
    }
    const modal = document.getElementById('puzzle-selector-modal');
    modal.classList.remove('hidden');
    // Select default category or current puzzle's category
    showCategory(state.lastLibraryCategory || 'standard');
}

function closePuzzleSelector() {
    const modal = document.getElementById('puzzle-selector-modal');
    modal.classList.add('hidden');
    selectionCallback = null;
    disposePreview();
    currentActiveCategory = null;
}

function showCategory(category) {
    // Scroll to category
    const carousel = document.getElementById('puzzle-carousel');
    const target = document.getElementById(`cat-${category}`);

    if (carousel && target) {
        const categories = ['standard', 'big', 'cuboids', 'mirror', 'custom'];
        const index = categories.indexOf(category);
        if (index !== -1) {
            carousel.scrollTo({
                left: index * carousel.offsetWidth,
                behavior: 'smooth'
            });
        }
    }

    updateSidebarActive(category);
}


function renderPuzzleOptions() {
    // This could be dynamic, but for now the HTML structure will hold the buttons
    // and we just attach listeners to them.
    // Or we can generate them here. Generating is cleaner.

    const categories = puzzleCategories;

    // Render Standard
    const standardContainer = document.getElementById('cat-standard-list');
    if (standardContainer) {
        standardContainer.innerHTML = '';
        categories.standard.forEach(size => {
            const btn = createPuzzleButton(`${size}x${size}x${size}`, size);
            standardContainer.appendChild(btn);
        });
    }

    // Render Big
    const bigContainer = document.getElementById('cat-big-list');
    if (bigContainer) {
        bigContainer.innerHTML = '';
        categories.big.forEach(size => {
            const btn = createPuzzleButton(`${size}x${size}x${size}`, size);
            bigContainer.appendChild(btn);
        });
    }

    // Render Cuboids
    const cuboidContainer = document.getElementById('cat-cuboids-list');
    if (cuboidContainer) {
        cuboidContainer.innerHTML = '';
        categories.cuboids.forEach(val => {
            const btn = createPuzzleButton(`${val} Cube`, val);
            cuboidContainer.appendChild(btn);
        });
    }

    // Render Mirror
    const mirrorContainer = document.getElementById('cat-mirror-list');
    if (mirrorContainer) {
        mirrorContainer.innerHTML = '';
        categories.mirror.forEach(val => {
            let label = '';
            if (val === 'mirror-3x3x3') label = '3x3 Mirror Cube';
            else if (val === 'mirror-2x2x2') label = '2x2 Mirror Cube';
            else {
                const size = val.replace('mirror-', '').split('x')[0];
                label = `${size}x${size} Mirror Cube`;
            }
            const btn = createPuzzleButton(label, val);
            mirrorContainer.appendChild(btn);
        });
    }
}

function createPuzzleButton(label, value) {
    const btn = document.createElement('button');
    btn.className = "bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-xl transition transform hover:scale-105 shadow-lg flex flex-col items-center justify-center gap-2";

    // Dynamic Icon
    const icon = createPuzzleIcon(value);

    const text = document.createElement('span');
    text.textContent = label;

    btn.appendChild(icon);
    btn.appendChild(text);

    btn.addEventListener('click', () => {
        if (selectionCallback) {
            selectionCallback(value);
        } else {
            changePuzzle(value);
        }
        closePuzzleSelector();
    });

    return btn;
}

function createPuzzleIcon(value) {
    const container = document.createElement('div');
    container.className = "w-16 h-16 flex items-center justify-center bg-gray-800 rounded-lg overflow-hidden border border-gray-600";

    const img = document.createElement('img');
    img.className = "w-full h-full object-contain";
    img.alt = value;

    // Construct filename
    // Format: puzzle-{value}.png
    // e.g. puzzle-3.png, puzzle-mirror-3x3x3.png
    img.src = `assets/icons/puzzle-${value}.png`;

    // Fallback for missing images
    img.onerror = () => {
        img.style.display = 'none';
        container.textContent = "🧩";
        container.className += " text-2xl";
    };

    container.appendChild(img);
    return container;
}

export function changePuzzle(val, isCustom = false, customDims = null, isMirrorCustom = false, skipAnimation = false) {
    let newSize = 3;
    let newDims = { x: 3, y: 3, z: 3 };
    let PuzzleClass = StandardCube;

    if (isCustom && customDims) {
        newDims = customDims;
        newSize = Math.max(newDims.x, newDims.y, newDims.z);
        PuzzleClass = isMirrorCustom ? MirrorCube : StandardCube;
    } else {
        if (val === 'mirror' || val === 'mirror-3x3x3') {
            newSize = 3;
            newDims = { x: 3, y: 3, z: 3 };
            PuzzleClass = MirrorCube;
        } else if (val === 'mirror-2x2x2') {
            newSize = 2;
            newDims = { x: 2, y: 2, z: 2 };
            PuzzleClass = MirrorCube;
        } else if (String(val).startsWith('mirror-')) {
            const dimsStr = val.replace('mirror-', '');
            const dims = dimsStr.split('x').map(Number);
            dims.sort((a, b) => b - a);
            newDims = { x: dims[1], y: dims[0], z: dims[2] };
            newSize = dims[0];
            PuzzleClass = MirrorCube;
        } else if (String(val).includes('x')) {
            const dims = String(val).split('x').map(Number);
            dims.sort((a, b) => b - a);
            newDims = { x: dims[1], y: dims[0], z: dims[2] };
            newSize = dims[0];
        } else {
            newSize = parseInt(val);
            newDims = { x: newSize, y: newSize, z: newSize };
        }
    }

    // Check if same puzzle
    if (!isCustom && PuzzleClass === StandardCube && newDims.x === state.cubeDimensions.x && newDims.y === state.cubeDimensions.y && newDims.z === state.cubeDimensions.z && !(state.activePuzzle instanceof MirrorCube)) return;

    // Update Button Text
    updatePuzzleButtonText(newDims, PuzzleClass === MirrorCube);

    const currentDist = state.camera.position.length();
    const minD = state.controls.minDistance;
    const maxD = state.controls.maxDistance;
    let zoomRatio = null;
    if (maxD > minD) {
        zoomRatio = (currentDist - minD) / (maxD - minD);
    }

    const performUpdate = () => {
        state.cubeSize = newSize;
        state.cubeDimensions = newDims;

        const newHeight = getMirrorHeight(newSize);
        state.backMirrorHeightOffset = newHeight;

        // Update UI controls
        const slider = document.getElementById('mirror-height-slider');
        const input = document.getElementById('mirror-height-value');
        if (slider) slider.value = newHeight;
        if (input) input.value = newHeight.toFixed(1);

        state.activePuzzle = new PuzzleClass({
            dimensions: newDims
        });

        hardReset(true);

        // Mirror Debug
        const debugRow = document.getElementById('mirror-debug-row');
        if (debugRow) debugRow.classList.remove('hidden');

        if (state.activePuzzle instanceof MirrorCube) {
            // Apply defaults
            const margin = parseFloat(document.getElementById('sticker-margin')?.value || 0.04);
            const radius = parseFloat(document.getElementById('sticker-radius')?.value || 0.08);
            state.activePuzzle.updateStickers(margin, radius);
        }

        adjustCameraForCubeSize(zoomRatio);

        // Update Leaderboard Selection
        state.selectedLeaderboardPuzzle = null; // Reset so it auto-detects next time
    };

    if (skipAnimation) {
        performUpdate();
    } else {
        playCubeAnimation(false, () => {
            performUpdate();
            playCubeAnimation(true);
        });
    }

    gtag('event', 'puzzle_change', { puzzle_type: val, custom: isCustom });
}

function updatePuzzleButtonText(dims, isMirror) {
    const btn = document.getElementById('btn-puzzle-select');
    if (!btn) return;

    let text = "";
    if (dims.x === dims.y && dims.y === dims.z) {
        text = `${dims.x}x${dims.x}x${dims.x}`;
    } else {
        // Sort for display? Or keep internal logic?
        // Usually we say 2x2x3
        text = `${dims.y}x${dims.x}x${dims.z}`; // Y is largest in our logic usually
    }

    if (isMirror) text += " Mirror";
    else text += " Cube";

    btn.innerHTML = `<span class="mr-2">🧩</span> ${text} <span class="ml-2 text-xs opacity-50">▼</span>`;
}

function setupCustomPuzzleListeners() {
    const btnCreate = document.getElementById('btn-create-custom-puzzle-modal');
    if (!btnCreate) return;

    btnCreate.addEventListener('click', () => {
        const d1 = parseInt(document.getElementById('custom-modal-d1').value);
        const d2 = parseInt(document.getElementById('custom-modal-d2').value);
        const d3 = parseInt(document.getElementById('custom-modal-d3').value);
        const isMirror = document.getElementById('custom-modal-mirror').checked;

        const dims = [d1, d2, d3].sort((a, b) => b - a);
        const newDims = { x: dims[1], y: dims[0], z: dims[2] };

        changePuzzle(null, true, newDims, isMirror);
        closePuzzleSelector();
    });

    // Sliders update values
    ['d1', 'd2', 'd3'].forEach(d => {
        const slider = document.getElementById(`custom-modal-${d}`);
        const display = document.getElementById(`custom-modal-val-${d}`);
        if (slider && display) {
            // Prevent carousel swipe when dragging slider
            slider.style.touchAction = 'pan-y'; // Allow vertical scroll but capture horizontal

            slider.addEventListener('input', (e) => {
                display.textContent = e.target.value;

                // Update Preview
                const d1 = parseInt(document.getElementById('custom-modal-d1').value);
                const d2 = parseInt(document.getElementById('custom-modal-d2').value);
                const d3 = parseInt(document.getElementById('custom-modal-d3').value);
                const isMirror = document.getElementById('custom-modal-mirror').checked;

                const dims = [d1, d2, d3].sort((a, b) => b - a);
                const newDims = { x: dims[1], y: dims[0], z: dims[2] };

                updatePreview(newDims, isMirror);
            });

            // Stop propagation of touch events to prevent carousel from catching them
            const stopPropagation = (e) => {
                e.stopPropagation();
            };
            slider.addEventListener('touchstart', stopPropagation, { passive: true });
            slider.addEventListener('touchmove', stopPropagation, { passive: true });
            slider.addEventListener('touchend', stopPropagation, { passive: true });
        }
    });

    // Mirror Checkbox Listener
    const mirrorCheck = document.getElementById('custom-modal-mirror');
    if (mirrorCheck) {
        mirrorCheck.addEventListener('change', () => {
            const d1 = parseInt(document.getElementById('custom-modal-d1').value);
            const d2 = parseInt(document.getElementById('custom-modal-d2').value);
            const d3 = parseInt(document.getElementById('custom-modal-d3').value);
            const isMirror = mirrorCheck.checked;

            const dims = [d1, d2, d3].sort((a, b) => b - a);
            const newDims = { x: dims[1], y: dims[0], z: dims[2] };

            updatePreview(newDims, isMirror);
        });
    }
}
