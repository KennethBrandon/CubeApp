import { state } from '../shared/state.js';

export function togglePanel(contentId, headerElement) {
    const content = document.getElementById(contentId);
    content.classList.toggle('collapsed');
    headerElement.classList.toggle('collapsed');
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
    const tbody = document.getElementById('leaderboard-body');
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
