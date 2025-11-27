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

    showLeaderboardCategory(initialCategory);

    // Select the specific puzzle chip
    // We need to wait for chips to render
    setTimeout(() => {
        selectLeaderboardPuzzle(initialPuzzle);
    }, 0);
}

function showLeaderboardCategory(category) {
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

    const puzzles = puzzleCategories[category];
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
