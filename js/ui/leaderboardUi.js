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
        // Parse it to find category
        const p = state.selectedLeaderboardPuzzle;
        if (String(p).startsWith('mirror')) initialCategory = 'mirror';
        else if (String(p).includes('x') && p.length > 5) initialCategory = 'cuboids'; // Rough guess
        else if (parseInt(p) > 7) initialCategory = 'big';
        else initialCategory = 'standard';

        initialPuzzle = p;
    } else {
        // Default to active puzzle
        // Logic to map active puzzle to category
        // ... (Simplified for now, default to standard/3x3 if unsure)
    }

    // Render ALL categories initially
    ['standard', 'big', 'cuboids', 'mirror', 'custom'].forEach(cat => {
        renderCategoryContent(cat);
    });

    showLeaderboardCategory(initialCategory, false);


    // Select the specific puzzle chip
    // We need to wait for chips to render
    setTimeout(() => {
        selectLeaderboardPuzzle(initialPuzzle);
    }, 0);
}

function showLeaderboardCategory(category, autoSelect = true) {
    // Scroll to category
    const carousel = document.getElementById('leaderboard-carousel');
    const target = document.getElementById(`lb-cat-${category}`);

    if (carousel && target) {
        // Calculate position based on index to be safe?
        // Or just scrollIntoView? scrollIntoView might be jerky if not careful.
        // Let's use scrollLeft based on index.
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

    // We render all on init now, but maybe re-render if needed?
    // For now, assume static list or already rendered.
    // But wait, 'custom' needs dynamic rendering.
    // Let's just re-render the requested one to be safe/up-to-date.
    renderCategoryContent(category);


    // Render Puzzle Chips for this category
    renderPuzzleChips(category, autoSelect);
}

function renderPuzzleChips(category, autoSelect = false) {
    const container = document.getElementById('leaderboard-puzzle-list');
    if (!container) return;

    container.innerHTML = '';

    let puzzles = [];

    if (category === 'custom') {
        // Dynamically find custom puzzles from available types
        const standard = new Set(puzzleCategories.standard.map(x => `${x}x${x}x${x}`));
        // Also map single numbers just in case
        puzzleCategories.standard.forEach(x => standard.add(String(x)));

        const big = new Set(puzzleCategories.big.map(x => `${x}x${x}x${x}`));
        const cuboids = new Set(puzzleCategories.cuboids);
        const mirror = new Set(puzzleCategories.mirror);

        // Filter available types
        const available = state.availablePuzzleTypes || new Set();
        available.forEach(type => {
            // Check if it's in any known category
            // Note: type might be "3x3" or "3" or "3x3x3"
            // We need robust checking.

            let isKnown = false;
            if (standard.has(type)) isKnown = true;
            if (big.has(type)) isKnown = true;
            if (cuboids.has(type)) isKnown = true;
            if (mirror.has(type)) isKnown = true;

            // Also check for standard/big number formats
            if (!isKnown) {
                // If it looks like "NxNxN" and N is in standard/big
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

        puzzles.sort(); // Alphabetical sort for custom

    } else {
        puzzles = puzzleCategories[category] || [];
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
            }

            btn.appendChild(img);
            btn.appendChild(text);
            btn.dataset.value = value;

            btn.addEventListener('click', () => {
                selectLeaderboardPuzzle(value);
            });

            container.appendChild(btn);
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
