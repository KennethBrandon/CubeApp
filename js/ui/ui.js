import { state } from '../shared/state.js';
import { puzzleCategories } from './puzzleSelector.js';

export function togglePanel(contentId, headerElement) {
    const content = document.getElementById(contentId);
    content.classList.toggle('collapsed');
    headerElement.classList.toggle('collapsed');
    gtag('event', 'toggle_panel', { panel: contentId, state: content.classList.contains('collapsed') ? 'closed' : 'open' });
}

export function updateHistoryUI() {
    const container = document.getElementById('history-log');
    const emptyMsg = document.getElementById('empty-msg');
    const moves = container.querySelectorAll('.move-card');
    moves.forEach(el => el.remove());
    if (emptyMsg) {
        emptyMsg.style.display = (state.moveHistory.length === 0) ? 'block' : 'none';
    }
}

export function addToHistory(notation, isReverse) {
    if (state.isScrambling || !notation) return;
    let text = notation;
    if (isReverse && !notation.includes("'")) text += "'";
    state.moveHistory.push(text);
    const container = document.getElementById('history-log');
    const emptyMsg = document.getElementById('empty-msg');
    if (emptyMsg) emptyMsg.style.display = 'none';
    const span = document.createElement('div');
    span.className = "move-card text-white";
    span.textContent = text;
    container.appendChild(span);
    container.scrollTop = container.scrollHeight;
}

export function showWinModal() {
    const modal = document.getElementById('solved-modal');
    document.getElementById('final-time').textContent = document.getElementById('timer').textContent;
    document.getElementById('scramble-text').textContent = state.scrambleSequence.join("  ");
    const list = document.getElementById('final-solution');
    if (list) {
        list.innerHTML = `<p class="font-bold mb-2">Your Solution (${state.moveHistory.length} moves):</p>` + state.moveHistory.join(", ");
    }

    // Ensure modal starts with opacity-0 for fade-in
    modal.classList.add('opacity-0');
    modal.classList.remove('hidden');

    // Force reflow to ensure the browser registers the opacity-0 state
    void modal.offsetWidth;

    // Remove opacity-0 to trigger the fade-in transition
    modal.classList.remove('opacity-0');

    state.isGameActive = false;
}

export function renderLeaderboardUI(leaderboardData, puzzleSize = 3) {
    // Determine category to find correct tbody
    let category = 'custom'; // Default to custom if not found in lists
    const p = String(puzzleSize);

    // Check strict lists first
    // Normalize p to match list format if needed
    // Standard/Big are numbers in list, but p might be "3" or "3x3x3"

    let isFound = false;

    // Check Standard
    if (!isFound) {
        // Check exact match or "NxNxN" match
        const std = puzzleCategories.standard; // [2,3,4,5,6,7]
        if (std.includes(parseInt(p)) && (p.length === 1 || p.match(/^\d+$/))) {
            category = 'standard';
            isFound = true;
        } else if (p.includes('x')) {
            const parts = p.split('x');
            if (parts.length === 3 && parts[0] === parts[1] && parts[1] === parts[2]) {
                const n = parseInt(parts[0]);
                if (std.includes(n)) {
                    category = 'standard';
                    isFound = true;
                }
            }
        }
    }

    // Check Big
    if (!isFound) {
        const big = puzzleCategories.big;
        if (big.includes(parseInt(p)) && (p.length <= 2 || p.match(/^\d+$/))) {
            category = 'big';
            isFound = true;
        } else if (p.includes('x')) {
            const parts = p.split('x');
            if (parts.length === 3 && parts[0] === parts[1] && parts[1] === parts[2]) {
                const n = parseInt(parts[0]);
                if (big.includes(n)) {
                    category = 'big';
                    isFound = true;
                }
            }
        }
    }

    // Check Cuboids
    if (!isFound) {
        if (puzzleCategories.cuboids.includes(p)) {
            category = 'cuboids';
            isFound = true;
        }
    }

    // Check Mirror
    if (!isFound) {
        if (puzzleCategories.mirror.includes(p)) {
            category = 'mirror';
            isFound = true;
        }
    }

    // If still not found, it stays 'custom'

    // Find the specific tbody for this category
    let tbody = document.getElementById(`leaderboard-body-${category}`);

    // If not found (e.g. custom category logic might be needed), try custom
    if (!tbody) {
        tbody = document.getElementById('leaderboard-body-custom');
    }

    const loading = document.getElementById('leaderboard-loading');
    const title = document.getElementById('leaderboard-title');

    // Update title to show current puzzle
    if (title) {
        const puzzleLabel = typeof puzzleSize === 'string'
            ? puzzleSize
            : `${puzzleSize}x${puzzleSize}`;
        title.textContent = `Top Solvers - ${puzzleLabel}`;
    }

    if (loading) loading.style.display = 'none';
    if (tbody) {
        tbody.innerHTML = '';

        if (leaderboardData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center p-4 text-gray-500">No scores yet. Be the first!</td></tr>';
            return;
        }

        leaderboardData.forEach((entry, index) => {
            const tr = document.createElement('tr');
            tr.className = 'leaderboard-row border-b border-gray-800 last:border-0 transition';

            let rankColor = 'text-gray-400';
            if (index === 0) rankColor = 'text-yellow-400 font-bold';
            if (index === 1) rankColor = 'text-gray-300 font-bold';
            if (index === 2) rankColor = 'text-amber-600 font-bold';

            tr.innerHTML = `
                <td class="p-3 ${rankColor}">${index + 1}</td>
                <td class="p-3 font-medium text-white truncate max-w-[120px]">${escapeHtml(entry.name)}</td>
                <td class="p-3 text-right font-mono text-green-400">${entry.timeString}</td>
            `;

            tr.onclick = () => openDetailModal(entry);
            tbody.appendChild(tr);
        });
    }
}

export function openDetailModal(entry) {
    document.getElementById('detail-name').textContent = entry.name;

    // Format puzzle type
    // User requested literal database value
    const pType = entry.puzzleType || "Unknown";
    document.getElementById('detail-puzzle-type').textContent = pType;

    document.getElementById('detail-scramble').textContent = entry.scramble;
    document.getElementById('detail-solution').textContent = entry.solution;

    const d = new Date(entry.date);
    document.getElementById('detail-date').textContent = d.toLocaleDateString() + ' ' + d.toLocaleTimeString();

    document.getElementById('detail-modal').classList.remove('hidden');
}

export function escapeHtml(text) {
    if (!text) return text;
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export function updateActivePuzzleTab(activeType) {
    const btn = document.getElementById('btn-leaderboard-filter');
    if (btn) {
        let text = activeType;
        // Format nicely if possible
        if (typeof activeType === 'number') {
            text = `${activeType}x${activeType}x${activeType}`;
        } else if (String(activeType).startsWith('mirror-')) {
            text = activeType.replace('mirror-', '') + ' Mirror';
        }
        btn.textContent = `Filter: ${text}`;
    }
}

// renderLeaderboardTabs removed as tabs are no longer used
