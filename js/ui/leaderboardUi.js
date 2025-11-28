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

    showLeaderboardCategory(initialCategory, false);

    // Select the specific puzzle chip
    // We need to wait for chips to render
    setTimeout(() => {
        selectLeaderboardPuzzle(initialPuzzle);
    }, 0);
}

function showLeaderboardCategory(category, autoSelect = true) {
    // Update Sidebar
    document.querySelectorAll('.leaderboard-category-btn').forEach(btn => {
        if (btn.dataset.category === category) {
            btn.classList.add('bg-blue-600', 'text-white');
            btn.classList.remove('text-gray-400', 'hover:bg-gray-800');
        } else {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('text-gray-400', 'hover:bg-gray-800');
        }
    });

    // Render Puzzle Chips for this category
    const container = document.getElementById('leaderboard-puzzle-list');
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
            btn.className = "px-3 py-2 rounded-xl bg-gray-800 text-gray-400 font-bold text-sm hover:bg-gray-700 transition border border-gray-700 flex items-center gap-2";

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
        let target = puzzles[0];
        if (category === 'standard') {
            // Prefer 3 (3x3) if available
            if (puzzles.includes(3)) target = 3;
        }
        selectLeaderboardPuzzle(target);
    }
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
