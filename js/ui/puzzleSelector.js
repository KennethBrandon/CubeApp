import { state } from '../shared/state.js';
import { StandardCube } from '../puzzles/StandardCube.js';
import { MirrorCube } from '../puzzles/MirrorCube.js';
import { Molecube } from '../puzzles/Molecube.js';
import { VoidCube } from '../puzzles/VoidCube.js';
import { hardReset } from '../game/scramble.js';
import { getMirrorHeight, toggleMirrors } from '../core/environment.js';
import { adjustCameraForCubeSize } from '../core/controls.js';
import { playCubeAnimation } from '../animations/transitions.js';
import { updateActivePuzzleTab } from './ui.js';
import { initPreview, updatePreview, disposePreview } from './puzzlePreview.js';
import { overlayManager } from './overlayManager.js';

export const puzzleCategories = {
    'standard': [2, 3, 4, 5, 6, 7],
    'big': [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
    'cuboids': ['2x2x3', '3x3x2', '3x3x4', '3x3x5', '2x2x4', '2x2x1', '3x3x1'],
    'mirror': ['mirror-2x2x2', 'mirror-3x3x3', 'mirror-4x4x4', 'mirror-5x5x5', 'mirror-6x6x6', 'mirror-7x7x7'],
    'mods': ['molecube', 'voidcube']
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

            const categories = ['standard', 'big', 'cuboids', 'mirror', 'mods', 'custom'];
            if (index >= 0 && index < categories.length) {
                updateSidebarActive(categories[index]);
            }
        }, { passive: true });
    }

    // Initialize from URL
    initializePuzzleFromUrl();

    // Handle Back/Forward Navigation
    window.addEventListener('popstate', (event) => {
        // If this state is for an overlay, ignore it here.
        // The OverlayManager handles closing the overlay.
        if (event.state && event.state.overlayId) {
            return;
        }

        if (event.state && (event.state.puzzle || event.state.isCustom)) {
            // Restore puzzle from history
            // We pass skipHistory=true to avoid pushing a new state
            changePuzzle(event.state.puzzle, event.state.isCustom, event.state.customDims, event.state.isMirrorCustom, false, true);
        } else {
            // If no state (e.g. initial load or root), revert to default 3x3
            // But only if we are not already there? 
            // Actually, if we popped to a state without 'puzzle', it might be the initial page load state if we didn't replace it.
            // Let's assume default is 3x3x3
            changePuzzle('3x3x3', false, null, false, false, true);
        }
    });
}

function initializePuzzleFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const puzzleParam = params.get('puzzle');

    if (puzzleParam) {
        // Parse param to determine type
        // Format could be: '3x3x3', 'mirror-3x3x3', 'custom-2x3x4', 'custom-mirror-2x3x4'

        // Check for Custom
        if (puzzleParam.startsWith('custom-')) {
            const isMirror = puzzleParam.includes('mirror');
            const dimStr = puzzleParam.replace('custom-', '').replace('mirror-', '');
            const dims = dimStr.split('x').map(Number);
            if (dims.length === 3) {
                // Enforce Y as largest to match setupCustomPuzzleListeners
                const sorted = dims.sort((a, b) => b - a);
                const correctDims = { x: sorted[1], y: sorted[0], z: sorted[2] };

                // Set initial history state
                history.replaceState({
                    puzzle: null,
                    isCustom: true,
                    customDims: correctDims,
                    isMirrorCustom: isMirror
                }, '', window.location.href);

                changePuzzle(null, true, correctDims, isMirror, true, true); // skipAnimation=true, skipHistory=true
                return;
            }
        }

        // Standard / Big / Mirror / Cuboid
        // We can just pass the param to changePuzzle if it matches our value format
        // Our value formats are: '3x3x3', 'mirror-3x3x3', '2x2x3'
        // changePuzzle handles parsing these strings.

        // Set initial history state
        history.replaceState({
            puzzle: puzzleParam,
            isCustom: false,
            customDims: null,
            isMirrorCustom: false
        }, '', window.location.href);

        changePuzzle(puzzleParam, false, null, false, true, true); // skipAnimation=true, skipHistory=true
    } else {
        // No param, ensure current state is replaced with default so we can go back to it
        const currentVal = '3x3x3'; // Default
        history.replaceState({
            puzzle: currentVal,
            isCustom: false,
            customDims: null,
            isMirrorCustom: false
        }, '', `?puzzle=${currentVal}`);
    }
}

function validateDims(dims) {
    return !isNaN(dims.x) && !isNaN(dims.y) && !isNaN(dims.z) && dims.x > 0 && dims.y > 0 && dims.z > 0;
}

let currentActiveCategory = null;
let pendingPuzzleChange = null; // Store puzzle change to apply after modal closes

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

    // Use OverlayManager
    overlayManager.open('puzzle-selector-modal', () => {
        // Cleanup callback on close
        selectionCallback = null;
        disposePreview();
        currentActiveCategory = null;

        // Apply pending puzzle change if any
        if (pendingPuzzleChange) {
            const { val, isCustom, customDims, isMirrorCustom } = pendingPuzzleChange;
            // Delay to ensure popstate from modal close doesn't overwrite this change
            setTimeout(() => {
                changePuzzle(val, isCustom, customDims, isMirrorCustom);
            }, 50);
            pendingPuzzleChange = null;
        }
    });

    // Select default category or current puzzle's category
    showCategory(state.lastLibraryCategory || 'standard');
}

function closePuzzleSelector() {
    overlayManager.close();
}

function showCategory(category) {
    // Scroll to category
    const carousel = document.getElementById('puzzle-carousel');
    const target = document.getElementById(`cat-${category}`);

    if (carousel && target) {
        const categories = ['standard', 'big', 'cuboids', 'mirror', 'mods', 'custom'];
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

    // Render Mods
    const modsContainer = document.getElementById('cat-mods-list');
    if (modsContainer) {
        modsContainer.innerHTML = '';
        categories.mods.forEach(val => {
            let label = val;
            if (val === 'molecube') label = 'Molecube';
            if (val === 'voidcube') label = 'Void Cube';
            const btn = createPuzzleButton(label, val);
            modsContainer.appendChild(btn);
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
            // Defer change until after modal closes to avoid history conflict
            pendingPuzzleChange = { val: value, isCustom: false, customDims: null, isMirrorCustom: false };
        }
        closePuzzleSelector();
    });

    return btn;
}

function createPuzzleIcon(value) {
    const container = document.createElement('div');
    container.className = "w-16 h-16 flex items-center justify-center bg-gray-800 rounded-lg overflow-hidden border border-gray-600";

    // Construct filename using helper
    // Note: getPuzzleIconPath is exported but not imported here? 
    // Wait, getPuzzleIconPath is defined in THIS file at line 242 (in previous view it was exported).
    // Let me check if getPuzzleIconPath is available.
    // In the current view of puzzleSelector.js, getPuzzleIconPath is NOT defined/exported in the file content I just read?
    // Let me check the file content again.

    // Ah, I see `createPuzzleIcon` at line 224.
    // I DO NOT see `getPuzzleIconPath` in the file content I just read (lines 1-431).
    // Wait, looking at the previous `view_file` output for `puzzleSelector.js` (Step 31), `getPuzzleIconPath` WAS there at line 242.
    // In the NEW `view_file` output (Step 147), `getPuzzleIconPath` is MISSING?
    // Let me check the end of the file.
    // Step 147 shows lines 1-431. The file ends at line 431.
    // The `createPuzzleIcon` function is at line 224.
    // `changePuzzle` is at 248.
    // It seems `getPuzzleIconPath` is GONE from the file entirely?

    // If `getPuzzleIconPath` is missing, I need to restore it or implement the logic inline.
    // The original code in `createPuzzleIcon` (lines 235) uses:
    // `img.src = 'assets/icons/puzzle-${value}.png';`

    // It seems the file was reverted to a state BEFORE `getPuzzleIconPath` was even extracted?
    // Or maybe I am misremembering.

    // Let's look at `leaderboardUi.js` imports.
    // Line 1: `import { puzzleCategories } from './puzzleSelector.js';`
    // It does NOT import `getPuzzleIconPath`.

    // Okay, so I need to implement the logic to determine if it's custom.
    // Or re-introduce `getPuzzleIconPath`.

    // Let's re-introduce `getPuzzleIconPath` and use it.

    // Wait, if I change `createPuzzleIcon`, I can just check if the value implies custom.
    // But `getPuzzleIconPath` was useful for `leaderboardUi.js` too.

    // Let's check `leaderboardUi.js` again.
    // It constructs the image src manually: `img.src = 'assets/icons/puzzle-${value}.png';` (Line 276).

    // So `getPuzzleIconPath` is indeed missing from both.

    // I will re-implement `getPuzzleIconPath` in `puzzleSelector.js` and export it.
    // And update `createPuzzleIcon` to use it.

    const img = document.createElement('img');
    img.className = "w-full h-full object-contain";
    img.alt = value;

    // Logic to determine path
    let iconPath = `assets/icons/puzzle-${value}.png`;

    // Check if custom (simple check for now based on previous logic)
    // If value is not in standard/big/cuboids/mirror lists...
    // But `puzzleCategories` is available.

    // Let's just use the helper function I'll add.
    iconPath = getPuzzleIconPath(value);

    if (iconPath.includes('puzzle-custom.png')) {
        container.textContent = "🧩";
        container.className += " text-4xl";
        return container;
    }

    img.src = iconPath;

    // Fallback
    img.onerror = () => {
        img.style.display = 'none';
        container.textContent = "🧩";
        container.className += " text-2xl";
    };

    container.appendChild(img);
    return container;
}

export function getPuzzleIconPath(value) {
    const valStr = String(value);

    // Check Mirror
    if (puzzleCategories.mirror.includes(valStr)) return `assets/icons/puzzle-${valStr}.png`;

    // Check Cuboids
    if (puzzleCategories.cuboids.includes(valStr)) return `assets/icons/puzzle-${valStr}.png`;

    // Check Mods
    if (puzzleCategories.mods.includes(valStr)) return `assets/icons/puzzle-${valStr}.png`;

    // Check Standard/Big
    let size = null;
    if (valStr.match(/^\d+$/)) size = parseInt(valStr);
    else if (valStr.includes('x')) {
        const parts = valStr.split('x');
        if (parts.length === 3 && parts[0] === parts[1] && parts[1] === parts[2]) size = parseInt(parts[0]);
    }

    if (size !== null) {
        if (puzzleCategories.standard.includes(size) || puzzleCategories.big.includes(size)) {
            return `assets/icons/puzzle-${size}.png`;
        }
    }

    return `assets/icons/puzzle-custom.png`;
}

export function changePuzzle(val, isCustom = false, customDims = null, isMirrorCustom = false, skipAnimation = false, skipHistory = false) {
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
        } else if (val === 'molecube') {
            newSize = 3;
            newDims = { x: 3, y: 3, z: 3 };
            PuzzleClass = Molecube;
        } else if (val === 'voidcube') {
            newSize = 3;
            newDims = { x: 3, y: 3, z: 3 };
            PuzzleClass = VoidCube;
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

    // Validation
    if (!validateDims(newDims)) {
        console.warn("Invalid puzzle dimensions:", newDims);
        // Fallback to 3x3x3 if invalid
        newSize = 3;
        newDims = { x: 3, y: 3, z: 3 };
        val = '3x3x3';
        isCustom = false;
        PuzzleClass = StandardCube;
    }

    // Check if same puzzle (use constructor to check exact class, not instanceof which matches subclasses)
    if (!isCustom && state.activePuzzle.constructor === PuzzleClass && newDims.x === state.cubeDimensions.x && newDims.y === state.cubeDimensions.y && newDims.z === state.cubeDimensions.z) return;

    // Update Button Text
    updatePuzzleButtonText(newDims, PuzzleClass === MirrorCube, val);
    updatePageTitle(newDims, PuzzleClass === MirrorCube, val);

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

        if (state.activePuzzle) {
            state.activePuzzle.dispose();
        }

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

    // Always reset leaderboard selection when changing puzzle
    state.selectedLeaderboardPuzzle = null;

    if (skipAnimation) {
        performUpdate();
    } else {
        playCubeAnimation(false, () => {
            performUpdate();
            playCubeAnimation(true);
        });
    }

    // Update History
    if (!skipHistory) {
        let urlVal = val;
        if (isCustom) {
            // Serialize custom puzzle
            // Format: custom-WxHxD or custom-mirror-WxHxD
            // Sort dimensions descending for URL: Largest x Middle x Smallest
            const sortedDims = [newDims.x, newDims.y, newDims.z].sort((a, b) => b - a);
            const dimStr = `${sortedDims[0]}x${sortedDims[1]}x${sortedDims[2]}`;
            urlVal = `custom-${isMirrorCustom ? 'mirror-' : ''}${dimStr}`;
        } else {
            // Normalize standard/mirror URL values
            // If val is just a number (e.g. 5), convert to 5x5x5
            if (String(val).match(/^\d+$/)) {
                urlVal = `${val}x${val}x${val}`;
            }
        }

        const newUrl = `?puzzle=${urlVal}`;
        history.pushState({
            puzzle: val, // Keep original val for internal logic if possible, or reconstruct
            // Actually, for custom, 'val' is null. We need to store enough to restore it.
            // So let's store the args.
            isCustom,
            customDims: newDims,
            isMirrorCustom
        }, '', newUrl);
    }

    if (typeof gtag === 'function') {
        gtag('event', 'puzzle_change', { puzzle_type: val, custom: isCustom });
    }
}

function updatePuzzleButtonText(dims, isMirror, puzzleType) {
    const btn = document.getElementById('btn-puzzle-select');
    if (!btn) return;

    let text = "";
    if (puzzleType === 'molecube') {
        text = "Molecube";
    } else if (puzzleType === 'voidcube') {
        text = "Void Cube";
    } else if (dims.x === dims.y && dims.y === dims.z) {
        text = `${dims.x}x${dims.x}x${dims.x}`;
    } else {
        // Sort for display? Or keep internal logic?
        // Usually we say 2x2x3
        text = `${dims.y}x${dims.x}x${dims.z}`; // Y is largest in our logic usually
    }

    if (puzzleType !== 'molecube' && puzzleType !== 'voidcube') {
        if (isMirror) text += " Mirror";
        else text += " Cube";
    }

    btn.innerHTML = `<span class="mr-2">🧩</span> ${text} <span class="ml-2 text-xs opacity-50">▼</span>`;
}

function updatePageTitle(dims, isMirror, puzzleType) {
    let text = "";
    if (puzzleType === 'molecube') {
        text = "Molecube";
    } else if (puzzleType === 'voidcube') {
        text = "Void Cube";
    } else if (dims.x === dims.y && dims.y === dims.z) {
        text = `${dims.x}x${dims.x}x${dims.x}`;
    } else {
        text = `${dims.y}x${dims.x}x${dims.z}`;
    }

    if (puzzleType !== 'molecube' && puzzleType !== 'voidcube') {
        if (isMirror) text += " Mirror Cube";
        else text += " Cube";
    }

    document.title = `${text} - Rubik's Cube App`;
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

        // Defer change
        pendingPuzzleChange = { val: null, isCustom: true, customDims: newDims, isMirrorCustom: isMirror };
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
