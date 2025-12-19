import * as THREE from 'three';
import { state } from '../shared/state.js';
import { StandardCube } from '../puzzles/StandardCube.js';
import { MirrorCube } from '../puzzles/MirrorCube.js';
import { Molecube } from '../puzzles/Molecube.js';
import { VoidCube } from '../puzzles/VoidCube.js';
import { AcornsMod } from '../puzzles/AcornsMod.js';
import { Megaminx } from '../puzzles/Megaminx.js';
import { Pyraminx } from '../puzzles/Pyraminx.js';

import { StlPuzzleMod } from '../puzzles/StlPuzzleMod.js';
import { hardReset } from '../game/scramble.js';
import { getMirrorHeight, toggleMirrors } from '../core/environment.js';
import { adjustCameraForCubeSize } from '../core/controls.js';
import { playCubeAnimation } from '../animations/transitions.js';
import { updateActivePuzzleTab } from './ui.js';
import { initPreview, updatePreview, disposePreview } from './puzzlePreview.js';
import { overlayManager } from './overlayManager.js';
import { ensurePuzzleSelectorModal } from './components/PuzzleSelectorModal.js';
import { puzzleCache } from '../utils/puzzleCache.js';
import { assetManager } from '../game/AssetManager.js';
import { showLoading, hideLoading } from './ui.js';

import { puzzleCategories } from '../shared/puzzleData.js';
export { puzzleCategories }; // Re-export for compatibility if needed, though direct import is better.


export function setupPuzzleSelector() {
    const btn = document.getElementById('btn-puzzle-select');
    if (btn) {
        btn.addEventListener('click', openPuzzleSelector);
    }

    const closeBtn = document.getElementById('btn-close-puzzle-selector');
    if (closeBtn) {
        closeBtn.addEventListener('click', closePuzzleSelector);
    }

    // Category switching and Carousel listeners are now attached lazily in openPuzzleSelector
    // when the modal is created.

    // Start fetching registry immediately (for correct titles on load)
    fetchRegistry();

    // Initial render of options is also deferred.
    // renderPuzzleOptions();

    // Custom Puzzle Form Listeners are also deferred.
    // setupCustomPuzzleListeners();

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
            changePuzzle('pyraminx', false, null, false, false, true);
        }
    });
}

function initializePuzzleFromUrl() {
    const params = new URLSearchParams(window.location.search);
    let puzzleParam = params.get('puzzle');

    if (!puzzleParam) {
        try {
            puzzleParam = localStorage.getItem('last_puzzle_selection');
        } catch (e) {
            console.warn("Could not read from localStorage:", e);
        }
    }

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
        const currentVal = 'pyraminx'; // Force Default for Testing
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
            const d1Elem = document.getElementById('custom-modal-d1');
            const d2Elem = document.getElementById('custom-modal-d2');
            const d3Elem = document.getElementById('custom-modal-d3');
            const mirrorElem = document.getElementById('custom-modal-mirror');

            if (d1Elem && d2Elem && d3Elem && mirrorElem) {
                const d1 = parseInt(d1Elem.value);
                const d2 = parseInt(d2Elem.value);
                const d3 = parseInt(d3Elem.value);
                const isMirror = mirrorElem.checked;

                const dims = [d1, d2, d3].sort((a, b) => b - a);
                const newDims = { x: dims[1], y: dims[0], z: dims[2] };

                updatePreview(newDims, isMirror);
            }
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

    // Ensure modal exists
    const created = ensurePuzzleSelectorModal();
    if (created) {
        // If we just created it, we need to attach listeners and render options
        setupCustomPuzzleListeners();
        renderPuzzleOptions();

        // Also attach category switching listeners which were in setupPuzzleSelector
        document.querySelectorAll('.puzzle-category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                showCategory(e.target.dataset.category);
            });
        });

        // And scroll listener
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

    // Render Standard / WCA
    const standardContainer = document.getElementById('cat-standard-list');
    if (standardContainer) {
        standardContainer.innerHTML = '';
        categories.standard.forEach(val => {
            let label;
            if (typeof val === 'number') {
                label = `${val}x${val}x${val}`;
            } else if (val === 'megaminx') {
                label = 'Megaminx';
            } else {
                label = val;
            }
            const btn = createPuzzleButton(label, val);
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
            if (val === 'megaminx') label = 'Megaminx';

            const btn = createPuzzleButton(label, val);
            modsContainer.appendChild(btn);
        });

        // Fetch Generic STL Puzzles from Registry
        if (window.puzzleRegistry) {
            // Already fetched, just render
            renderRegistryButtons(modsContainer);
        } else {
            // Should have been started, but if not (or failed), try again or wait?
            // Actually, fetchRegistry handles the window.puzzleRegistry population.
            // We can just re-call it or wait.
            // For simplicity, let's assume it's running. If it's done, 'window.puzzleRegistry' is set.
            // If it's not done, we might need a callback. 
            // Let's just call fetchRegistry again which will handle deduping if we implement it, 
            // or just accept the race for the menu (unlikely to be opened instantly).
            // Better: check if we have data.

            // Actually, let's just use the same promise if possible, or simpler:
            // Just try to render from whatever we have. If empty, maybe add a retry or listener?
            // Since we call fetchRegistry on setup, it should be fast.
            // Let's make fetchRegistry return a promise we can use here if we want to be robust.

            fetchRegistry().then(() => {
                renderRegistryButtons(modsContainer);
            });
        }
    }
}

function renderRegistryButtons(container) {
    if (!window.puzzleRegistry) return;
    Object.keys(window.puzzleRegistry).forEach(id => {
        const name = window.puzzleRegistry[id];
        const val = `stl:${id}`;
        // Dedup check just in case
        // (Not strictly necessary if we clear container, which we do)
        const btn = createPuzzleButton(name, val);
        container.appendChild(btn);
    });
}

function fetchRegistry() {
    if (window.registryPromise) return window.registryPromise;

    window.registryPromise = fetch('assets/puzzles/registry.json?t=' + Date.now())
        .then(res => {
            if (res.ok) return res.json();
            return [];
        })
        .then(registry => {
            if (registry && registry.length > 0) {
                // Cache registry for name lookups
                window.puzzleRegistry = {};
                registry.forEach(p => {
                    window.puzzleRegistry[p.id] = p.name;
                });

                // If current puzzle is STL, update title now that we have names
                // This handles the "Direct Load" case where title was generic initially
                const currentVal = state.activePuzzle instanceof StlPuzzleMod ? `stl:${state.activePuzzle.puzzleId}` : null;
                if (currentVal) {
                    updatePuzzleButtonText(state.cubeDimensions, false, currentVal);
                    updatePageTitle(state.cubeDimensions, false, currentVal);
                }
            }
        })
        .catch(err => console.log('No custom registry found or empty.'));

    return window.registryPromise;
}

function createPuzzleButton(label, value) {
    const btn = document.createElement('button');
    // Removed bg-gray-700, shadow-lg. Added group for hover effects.
    btn.className = "group text-gray-400 hover:text-white font-medium py-2 px-2 rounded-xl transition transform hover:scale-105 flex flex-col items-center justify-center gap-2";

    // Dynamic Icon
    const icon = createPuzzleIcon(value);

    const text = document.createElement('span');
    text.textContent = label;
    text.className = "text-xs tracking-wide opacity-80 group-hover:opacity-100 transition-opacity text-center";

    btn.appendChild(icon);
    btn.appendChild(text);

    btn.addEventListener('click', () => {
        // If it's an STL puzzle, check cache first
        const isDownloadable = typeof value === 'string' && value.startsWith('stl:');

        if (isDownloadable) {
            const puzzleId = value.split(':')[1];
            assetManager.isRemoteAndMissing(puzzleId).then(missing => {
                if (!missing) {
                    selectPuzzle(value);
                } else {
                    // Show download prompt or just download
                    // For now, simpler UX: Trigger download with loading
                    downloadAndSelect(puzzleId, value);
                }
            });
        } else {
            selectPuzzle(value);
        }
    });

    // Add download indicator if STL
    const isDownloadable = typeof value === 'string' && value.startsWith('stl:');
    if (isDownloadable) {
        const puzzleId = value.split(':')[1];
        assetManager.isRemoteAndMissing(puzzleId).then(missing => {
            if (missing) {
                // Determine size (Not implemented in assetManager yet, defaulting to unknown)
                // assetManager.getDownloadSize(puzzleId).then(...) 
                const size = null;

                const indicator = document.createElement('div');
                indicator.className = "absolute top-2 right-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-md";

                let sizeText = "↓";
                if (size) {
                    const mb = (size / (1024 * 1024)).toFixed(1);
                    sizeText += ` ${mb}MB`;
                }
                indicator.textContent = sizeText;
                btn.appendChild(indicator);
                btn.classList.add('relative');
            }
        });
    }

    return btn;
}

function selectPuzzle(value) {
    if (selectionCallback) {
        selectionCallback(value);
    } else {
        pendingPuzzleChange = { val: value, isCustom: false, customDims: null, isMirrorCustom: false };
    }
    closePuzzleSelector();
}

async function downloadAndSelect(puzzleId, value) {
    const btn = document.activeElement; // The clicked button
    let originalHtml = "";
    if (btn) {
        originalHtml = btn.innerHTML;
        btn.innerHTML = `<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
        btn.disabled = true;
    }

    try {
        await assetManager.downloadPuzzle(puzzleId, (progress) => {
            // Optional: Update progress UI
        });

        // Restore button state
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
            // Remove download indicator if present
            const indicator = btn.querySelector('.absolute.top-2.right-2');
            if (indicator) indicator.remove();
        }

        selectPuzzle(value);
    } catch (e) {
        console.error("Download error:", e);
        alert("Download failed. Please check your connection.");
        if (btn) {
            btn.innerHTML = originalHtml || "Error";
            btn.disabled = false;
        }
    }
}

function createPuzzleIcon(value) {
    const container = document.createElement('div');
    // Removed bg-gray-800, border. Added transparent relative container.
    container.className = "w-16 h-16 flex items-center justify-center rounded-lg overflow-hidden relative transition opacity-90 group-hover:opacity-100";

    const img = document.createElement('img');
    img.className = "w-full h-full object-contain";
    img.alt = value;

    // Logic to determine path
    let iconPath = getPuzzleIconPath(value);

    // If it's a generic custom icon, we can make it look a bit better or just use the icon
    if (iconPath.includes('puzzle-custom.png')) {
        // Maybe check if we have a specific image for this STL puzzle?
        // e.g. assets/puzzles/[id]/icon.png ?
        // For now, default custom icon
    }

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

    // Check Mods (and special WCA puzzles like Megaminx/Pyraminx)
    if (puzzleCategories.mods.includes(valStr) || valStr === 'megaminx' || valStr === 'pyraminx') return `assets/icons/puzzle-${valStr}.png`;

    // Check STL Custom
    if (valStr.startsWith('stl:')) {
        const id = valStr.split(':')[1];
        return `assets/icons/puzzle-stl_${id}.png`;
    }

    // Check if it fits a known custom puzzle ID (from registry)
    const knownCustom = (state.customPuzzles && state.customPuzzles.find(p => p.id === valStr)) ||
        (window.puzzleRegistry && window.puzzleRegistry[valStr] ? { id: valStr } : null);

    if (knownCustom) {
        return `assets/icons/puzzle-stl_${valStr}.png`;
    }

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
        } else if (val === 'acorns') {
            newSize = 2;
            newDims = { x: 2, y: 2, z: 2 };
            PuzzleClass = AcornsMod;
        } else if (val === 'megaminx') {
            newSize = 3; // Approx size for camera
            newDims = { x: 3, y: 3, z: 3 };
            PuzzleClass = Megaminx;
        } else if (val === 'pyraminx') {
            newSize = 3;
            newDims = { x: 3, y: 3, z: 3 };
            PuzzleClass = Pyraminx;
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
        } else if (String(val).startsWith('stl:')) {
            const puzzleId = val.split(':')[1];
            newSize = 3;
            newDims = { x: 3, y: 3, z: 3 };
            PuzzleClass = StlPuzzleMod;
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
    if (!isCustom && state.activePuzzle.constructor === PuzzleClass && newDims.x === state.cubeDimensions.x && newDims.y === state.cubeDimensions.y && newDims.z === state.cubeDimensions.z) {
        // Special check for StlPuzzleMod: Must also match puzzleId
        if (PuzzleClass === StlPuzzleMod) {
            const newPuzzleId = String(val).split(':')[1];
            if (state.activePuzzle.puzzleId === newPuzzleId) return;
        } else {
            return;
        }
    }

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

    const performUpdate = async () => {
        state.cubeSize = newSize;
        state.cubeDimensions = newDims;

        // Show loading screen
        showLoading(`Loading ${updatePuzzleButtonText(newDims, PuzzleClass === MirrorCube, val, true)}...`);

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

        // Reset cubeWrapper rotation to ensure new puzzle starts aligned
        if (state.cubeWrapper) {
            // Special orientation for Pyraminx (WCA standard: yellow down, green front)
            if (PuzzleClass === Pyraminx) {
                // Rotate to position yellow face parallel to table (down) and green face forward-left, blue right
                // These values calculated to make yellow face perfectly horizontal
                const euler = new THREE.Euler(0.66, -0.26, 0.96, 'XYZ');
                state.cubeWrapper.rotation.copy(euler);
                // Store home rotation for use by animateWrapperReset
                state.cubeWrapper.userData.homeRotation = euler.clone();
            } else {
                state.cubeWrapper.quaternion.set(0, 0, 0, 1);
                // Clear home rotation for standard puzzles (use identity)
                state.cubeWrapper.userData.homeRotation = null;
            }
            state.cubeWrapper.updateMatrixWorld(true);
        }

        const puzzleConfig = {
            dimensions: newDims
        };

        if (PuzzleClass === StlPuzzleMod) {
            puzzleConfig.puzzleId = String(val).split(':')[1];
        }

        state.activePuzzle = new PuzzleClass(puzzleConfig);

        await hardReset(true);

        hideLoading();

        // Mirror Debug
        const debugRow = document.getElementById('mirror-debug-row');
        if (debugRow) debugRow.classList.remove('hidden');

        if (state.activePuzzle instanceof MirrorCube) {
            // Apply defaults
            const margin = parseFloat(document.getElementById('sticker-margin')?.value || 0.04);
            const radius = parseFloat(document.getElementById('sticker-radius')?.value || 0.08);
            state.activePuzzle.updateStickers(margin, radius);
        }

        // Set Pyraminx-specific camera position (WCA orientation: yellow down, green front, blue right)
        if (PuzzleClass === Pyraminx) {
            state.cameraSettings.azimuth = 30;    // Rotates camera right to show blue (right) side
            state.cameraSettings.elevation = 20;  // Lower angle to emphasize yellow bottom
            state.cameraSettings.puzzleRotation = 0; // No additional puzzle rotation needed
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
        playCubeAnimation(false, async () => {
            await performUpdate();
            playCubeAnimation(true);
        });
    }

    // Calculate URL/Storage Value
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

    // Persist selection
    try {
        localStorage.setItem('last_puzzle_selection', urlVal);
    } catch (e) {
        console.warn("Could not save to localStorage:", e);
    }

    // Update History
    if (!skipHistory) {
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
    } else if (puzzleType === 'acorns') {
        text = "Acorns Mod";
    } else if (puzzleType === 'megaminx') {
        text = "Megaminx";
    } else if (puzzleType === 'pyraminx') {
        text = "Pyraminx";
    } else if (String(puzzleType).startsWith('stl:')) {
        text = getPuzzleName(puzzleType);
    } else if (dims.x === dims.y && dims.y === dims.z) {
        text = `${dims.x}x${dims.x}x${dims.x}`;
    } else {
        // Sort for display? Or keep internal logic?
        // Usually we say 2x2x3
        text = `${dims.y}x${dims.x}x${dims.z}`; // Y is largest in our logic usually
    }

    if (puzzleType !== 'molecube' && puzzleType !== 'voidcube' && puzzleType !== 'acorns' && puzzleType !== 'megaminx' && puzzleType !== 'pyraminx' && !String(puzzleType).startsWith('stl:')) {
        if (isMirror) text += " Mirror";
        else text += " Cube";
    }

    // Check for new structure (span for text)
    const textSpan = btn.querySelector('span');
    if (textSpan) {
        textSpan.textContent = text;
    } else {
        // Fallback for old structure or if span missing
        btn.innerHTML = `<span class="mr-2">🧩</span> ${text} <span class="ml-2 text-xs opacity-50">▼</span>`;
    }
    return text; // Return text for other uses
}

function updatePageTitle(dims, isMirror, puzzleType) {
    let text = "";
    if (puzzleType === 'molecube') {
        text = "Molecube";
    } else if (puzzleType === 'voidcube') {
        text = "Void Cube";
    } else if (puzzleType === 'acorns') {
        text = "Acorns Mod";
    } else if (String(puzzleType).startsWith('stl:')) {
        text = getPuzzleName(puzzleType);
    } else if (puzzleType === 'megaminx') {
        text = "Megaminx";
    } else if (puzzleType === 'pyraminx') {
        text = "Pyraminx";
    } else if (dims.x === dims.y && dims.y === dims.z) {
        text = `${dims.x}x${dims.x}x${dims.x}`;
    } else {
        text = `${dims.y}x${dims.x}x${dims.z}`;
    }

    if (puzzleType !== 'molecube' && puzzleType !== 'voidcube' && puzzleType !== 'acorns' && puzzleType !== 'megaminx' && puzzleType !== 'pyraminx' && !String(puzzleType).startsWith('stl:')) {
        if (isMirror) text += " Mirror Cube";
        else text += " Cube";
    }

    document.title = `${text} - 3D Cube Puzzle`;
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

function getPuzzleName(val) {
    if (String(val).startsWith('stl:')) {
        const id = String(val).split(':')[1];
        if (window.puzzleRegistry && window.puzzleRegistry[id]) {
            return window.puzzleRegistry[id];
        }
        return "Custom Puzzle";
    }
    return val;
}

