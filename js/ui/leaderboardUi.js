import { puzzleCategories } from './puzzleSelector.js';
import { fetchLeaderboard } from '../leaderboard/firebase.js';
import { state } from '../shared/state.js';

export function setupLeaderboardUI() {
    // Category switching
    document.querySelectorAll('.leaderboard-category-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            showLeaderboardCategory(e.target.dataset.category);
        });
    });

    // Close button logic is handled by onclick in HTML or events.js

    // Carousel Scroll Listener
    const carousel = document.getElementById('leaderboard-carousel');
    if (carousel) {
        let lastCategory = null;
        carousel.addEventListener('scroll', () => {
            const scrollLeft = carousel.scrollLeft;
            const width = carousel.offsetWidth;
            const index = Math.round(scrollLeft / width);

            const categories = ['standard', 'big', 'cuboids', 'mirror', 'custom'];
            if (index >= 0 && index < categories.length) {
                const newCategory = categories[index];
                if (newCategory !== lastCategory) {
                    lastCategory = newCategory;
                    updateSidebarActive(newCategory);
                    renderPuzzleChips(newCategory, true);
                }
            }
        }, { passive: true });
    }
}


function updateSidebarActive(category) {
    document.querySelectorAll('.leaderboard-category-btn').forEach(btn => {
        if (btn.dataset.category === category) {
            btn.classList.add('bg-blue-600', 'text-white');
            btn.classList.remove('text-gray-400', 'hover:bg-gray-800');
        } else {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('text-gray-400', 'hover:bg-gray-800');
        }
    });
}


export function openLeaderboardModal() {
    const modal = document.getElementById('leaderboard-modal');
    modal.classList.remove('hidden');

    // Determine initial category and puzzle
    let initialCategory = 'standard';
    let initialPuzzle = state.cubeSize || 3;

    // Try to detect category from active puzzle
    if (state.selectedLeaderboardPuzzle) {
        // If we have a stored selection, use it
        const p = String(state.selectedLeaderboardPuzzle);
        if (p.startsWith('mirror')) initialCategory = 'mirror';
        else if (p.includes('x') && p.length > 5) initialCategory = 'cuboids'; // Rough guess
        else if (parseInt(p) > 7) initialCategory = 'big';
        else initialCategory = 'standard';

        initialPuzzle = p;
    } else {
        // Default to active puzzle
        const active = state.activePuzzle;
        const dims = state.cubeDimensions;

        if (active && active.constructor.name === 'MirrorCube') {
            // It's a Mirror Cube
            initialCategory = 'mirror';
            // Construct ID
            // Canonical format: Largest x Middle x Smallest
            const d = [dims.x, dims.y, dims.z].sort((a, b) => b - a);
            initialPuzzle = `mirror-${d[0]}x${d[1]}x${d[2]}`;

            // Check if this specific mirror puzzle is in the standard mirror list
            // If not, it might be a custom mirror
            const mirrorList = puzzleCategories.mirror || [];
            if (!mirrorList.includes(initialPuzzle)) {
                initialCategory = 'custom';
                // Keep the ID, but category is custom
            }

        } else if (dims.x !== dims.y || dims.y !== dims.z) {
            // Cuboid
            initialCategory = 'cuboids';
            // Construct ID: "NxMxZ"
            // Canonical format: Largest x Middle x Smallest
            const d = [dims.x, dims.y, dims.z].sort((a, b) => b - a);
            initialPuzzle = `${d[0]}x${d[1]}x${d[2]}`;

            // Check if in cuboids list
            const cuboidsList = puzzleCategories.cuboids || [];
            if (!cuboidsList.includes(initialPuzzle)) {
                initialCategory = 'custom';
            }

        } else {
            // Standard or Big
            const size = dims.x;
            initialPuzzle = size;
            if (size <= 7) initialCategory = 'standard';
            else initialCategory = 'big';
        }
    }

    // Render ALL categories initially
    ['standard', 'big', 'cuboids', 'mirror', 'custom'].forEach(cat => {
        renderCategoryContent(cat);
    });

    // Set the selected puzzle immediately so renderPuzzleChips can see it
    state.selectedLeaderboardPuzzle = initialPuzzle;

    showLeaderboardCategory(initialCategory, false, false);

    // Fetch data for the selected puzzle
    fetchLeaderboard(initialPuzzle);
}

function showLeaderboardCategory(category, autoSelect = true, smooth = true) {
    // Scroll to category
    const carousel = document.getElementById('leaderboard-carousel');
    const target = document.getElementById(`lb-cat-${category}`);

    if (carousel && target) {
        const categories = ['standard', 'big', 'cuboids', 'mirror', 'custom'];
        const index = categories.indexOf(category);
        if (index !== -1) {
            carousel.scrollTo({
                left: index * carousel.offsetWidth,
                behavior: smooth ? 'smooth' : 'auto'
            });
        }
    }

    updateSidebarActive(category);
    renderCategoryContent(category);
    renderPuzzleChips(category, autoSelect, smooth);
}

function renderPuzzleChips(category, autoSelect = false, smooth = true) {
    const container = document.getElementById('leaderboard-puzzle-list');
    if (!container) return;

    container.innerHTML = '';

    let puzzles = [];

    if (category === 'custom') {
        // Dynamically find custom puzzles from available types
        const standard = new Set(puzzleCategories.standard.map(x => `${x}x${x}x${x}`));
        puzzleCategories.standard.forEach(x => standard.add(String(x)));

        const big = new Set(puzzleCategories.big.map(x => `${x}x${x}x${x}`));
        const cuboids = new Set(puzzleCategories.cuboids);
        const mirror = new Set(puzzleCategories.mirror);

        // Filter available types
        const available = state.availablePuzzleTypes || new Set();
        available.forEach(type => {
            let isKnown = false;
            if (standard.has(type)) isKnown = true;
            if (big.has(type)) isKnown = true;
            if (cuboids.has(type)) isKnown = true;
            if (mirror.has(type)) isKnown = true;

            if (!isKnown) {
                const parts = type.split('x');
                if (parts.length === 3 && parts[0] === parts[1] && parts[1] === parts[2]) {
                    const n = parseInt(parts[0]);
                    if (puzzleCategories.standard.includes(n) || puzzleCategories.big.includes(n)) {
                        isKnown = true;
                    }
                }
            }

            if (!isKnown) {
                puzzles.push(type);
            }
        });

        // Ensure current selection is in the list if it belongs to custom
        const current = String(state.selectedLeaderboardPuzzle);
        console.log(`[LB] renderPuzzleChips custom: current=${current}, puzzles=${JSON.stringify(puzzles)}`);

        if (current && !puzzles.includes(current)) {
            // Verify it's not a known standard/mirror type
            let isKnown = false;
            if (standard.has(current)) isKnown = true;
            if (big.has(current)) isKnown = true;
            if (cuboids.has(current)) isKnown = true;
            if (mirror.has(current)) isKnown = true;

            if (!isKnown) {
                console.log(`[LB] Adding current ${current} to custom list`);
                puzzles.push(current);
            } else {
                console.log(`[LB] Current ${current} is known, skipping add`);
            }
        }

        puzzles.sort(); // Alphabetical sort for custom

    } else {
        puzzles = puzzleCategories[category] || [];

        // Ensure current selection is in the list (e.g. for Mirror if we add dynamic mirrors later)
        const current = String(state.selectedLeaderboardPuzzle);
        if (category === 'mirror' && current.startsWith('mirror-') && !puzzles.includes(current)) {
            // If we have a custom mirror that isn't in the standard list, 
            // but we are in the mirror category (if we decided to put it there).
            // Currently custom mirrors go to 'custom' category in my previous logic if not in list.
            // But if we changed that, we'd handle it here.
            // For now, safe to leave as is or add if we want to support dynamic mirrors in Mirror tab.
        }
    }

    if (puzzles) {
        puzzles.forEach(val => {
            const btn = document.createElement('button');
            btn.className = "px-3 py-2 rounded-xl bg-gray-800 text-gray-400 font-bold text-sm hover:bg-gray-700 transition border border-gray-700 flex items-center gap-2 shrink-0";

            let label = val;
            let value = val;

            if (category === 'standard' || category === 'big') {
                label = `${val}x${val}x${val}`;
                value = val; // Keep as number for consistency with firebase.js logic? Or normalize to string?
                // firebase.js expects number for standard cubes usually, or string "NxNxN"
            } else if (category === 'mirror') {
                if (val === 'mirror-3x3x3') label = '3x3 Mirror';
                else if (val === 'mirror-2x2x2') label = '2x2 Mirror';
                else label = val.replace('mirror-', '') + ' Mirror';
            } else if (category === 'custom') {
                // Format custom label nicely if possible
                if (val.startsWith('mirror-')) {
                    label = val.replace('mirror-', '') + ' Mirror';
                } else {
                    label = val;
                }
            } else {
                label = val;
            }

            // Image
            const img = document.createElement('img');
            img.src = `assets/icons/puzzle-${value}.png`;
            img.className = "w-8 h-8 object-contain rounded";
            img.onerror = () => { img.style.display = 'none'; }; // Hide if missing

            const text = document.createElement('span');
            text.textContent = label;

            // Highlight if matches current selection
            if (String(value) === String(state.selectedLeaderboardPuzzle)) {
                btn.className = "px-3 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 transition border border-blue-500 shadow-lg flex items-center gap-2 shrink-0";
                // Scroll into view immediately if it's the selected one
                // Use setTimeout to ensure it's in DOM? No, we append it below.
                // But we can scroll after appending.
            }

            btn.appendChild(img);
            btn.appendChild(text);
            btn.dataset.value = value;

            btn.addEventListener('click', () => {
                selectLeaderboardPuzzle(value);
            });

            container.appendChild(btn);

            // Scroll if selected
            if (String(value) === String(state.selectedLeaderboardPuzzle)) {
                // Use requestAnimationFrame or setTimeout to ensure layout is ready
                setTimeout(() => {
                    btn.scrollIntoView({
                        behavior: smooth ? 'smooth' : 'auto',
                        block: 'nearest',
                        inline: 'center'
                    });
                }, 0);
            }
        });
    }

    // Auto-select logic
    if (autoSelect && puzzles && puzzles.length > 0) {
        // Check if current selection is already in the list
        const current = String(state.selectedLeaderboardPuzzle);
        const exists = puzzles.some(p => String(p) === current);

        if (!exists) {
            let target = puzzles[0];
            if (category === 'standard') {
                // Prefer 3 (3x3) if available
                if (puzzles.includes(3)) target = 3;
            }
            selectLeaderboardPuzzle(target);
        }
    }
}


function renderCategoryContent(category) {
    // This function prepares the list of puzzles for the chips.
    // But wait, the chips are in the header, not in the carousel slides.
    // The carousel slides contain the TABLES.
    // Ah, looking at HTML:
    // The carousel slides contain <tbody id="leaderboard-body-CATEGORY">
    // The chips are in #leaderboard-puzzle-list (fixed header).

    // So showLeaderboardCategory updates the CHIPS in the header.
    // And scrolls the carousel to show the TABLE for that category.
    // The table content is loaded via fetchLeaderboard when a chip is clicked.

    // So we don't need to render content into the slides here, 
    // except maybe ensuring the table exists? The HTML has the tables.

    // However, the logic below calculates 'puzzles' array.
    // We need that to render the CHIPS.
    // So the existing logic is fine for rendering chips.

    // But wait, I replaced the top part of showLeaderboardCategory.
    // The rest of the function (lines 66-160) calculates 'puzzles' and renders chips.
    // That part is preserved.

    // I added a call to renderCategoryContent inside showLeaderboardCategory, 
    // but I haven't defined it yet? 
    // Ah, I see what I did. I wrapped the logic in showLeaderboardCategory.
    // But wait, the original code had the logic INLINE.
    // I should probably just leave it inline or extract it properly.

    // Let's just remove the call to renderCategoryContent I added in the previous chunk
    // and let the existing inline logic run.
    // BUT, I need to make sure 'puzzles' is calculated correctly.

    // Actually, looking at my previous chunk:
    // I replaced lines 50-60.
    // Then I replaced lines 62-64.
    // The logic for 'puzzles' starts at line 66.

    // So the flow is:
    // 1. Scroll carousel.
    // 2. Update sidebar.
    // 3. Calculate 'puzzles' (lines 66-112).
    // 4. Render chips (lines 114-160).

    // So I don't need renderCategoryContent function if I didn't break the flow.
    // BUT, in the scroll listener, I call updateSidebarActive.
    // I ALSO need to update the chips when scrolling finishes.
    // So I SHOULD extract the chip rendering logic.

    return; // Placeholder if I don't extract.
}


function selectLeaderboardPuzzle(puzzleValue) {
    // Update Chips UI
    const container = document.getElementById('leaderboard-puzzle-list');
    Array.from(container.children).forEach(btn => {
        // Loose comparison for "3" vs 3
        if (String(btn.dataset.value) === String(puzzleValue)) {
            btn.classList.remove('bg-gray-800', 'text-gray-400', 'border-gray-700');
            btn.classList.add('bg-blue-600', 'text-white', 'border-blue-500', 'shadow-lg');
            btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } else {
            btn.classList.add('bg-gray-800', 'text-gray-400', 'border-gray-700');
            btn.classList.remove('bg-blue-600', 'text-white', 'border-blue-500', 'shadow-lg');
        }
    });

    state.selectedLeaderboardPuzzle = puzzleValue;
    fetchLeaderboard(puzzleValue);
}
