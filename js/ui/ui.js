import { state } from '../shared/state.js';
import { puzzleCategories } from '../shared/puzzleData.js';
import { overlayManager } from './overlayManager.js';
import { makeDraggable } from './tuners/TunerBase.js';
import { formatScramble } from '../utils/formatting.js';

export function toggleDrawer(isOpen) {
    const drawer = document.getElementById('side-drawer');
    const backdrop = document.getElementById('side-drawer-backdrop');

    if (isOpen) {
        backdrop.classList.remove('hidden');
        // Force reflow
        void backdrop.offsetWidth;
        backdrop.classList.remove('opacity-0');

        drawer.classList.remove('translate-x-full');
    } else {
        backdrop.classList.add('opacity-0');
        drawer.classList.add('translate-x-full');

        setTimeout(() => {
            backdrop.classList.add('hidden');
        }, 300);
    }
}

export function initHistoryWindow() {
    const windowEl = document.getElementById('history-window');
    const headerEl = document.getElementById('history-window-header');

    if (windowEl && headerEl) {
        makeDraggable(windowEl, 'history-window-header');
    }
}

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
    document.getElementById('final-time').textContent = document.getElementById('timer').textContent;
    // Scramble Text
    const pType = state.activePuzzle ? state.activePuzzle.constructor.name : '';
    document.getElementById('scramble-text').textContent = formatScramble(state.scrambleSequence, pType);

    const list = document.getElementById('final-solution');
    if (list) {
        list.innerHTML = `<p class="font-bold mb-2">Your Solution (${state.moveHistory.length} moves):</p>` + state.moveHistory.join(", ");
    }

    // Determine readable puzzle name and ID for querying
    let puzzleName = "Unknown Puzzle";
    let puzzleTypeId = null; // To check rank

    if (state.activePuzzle) {
        const type = state.activePuzzle.constructor.name;

        // Helper to format dims
        const getDimsName = () => {
            if (state.cubeDimensions) {
                const dims = [state.cubeDimensions.x, state.cubeDimensions.y, state.cubeDimensions.z].sort((a, b) => b - a);
                return `${dims[0]}x${dims[1]}x${dims[2]}`;
            }
            return null;
        };

        // Standard Cube logic must also check if it's actually cubic dimensions
        // because StandardCube class is used for generic cuboids too.
        if (type === 'StandardCube') {
            const dims = state.cubeDimensions;
            if (dims && (dims.x !== dims.y || dims.y !== dims.z || dims.x !== dims.z)) {
                // It is a cuboid
                const name = getDimsName();
                puzzleName = name;
                puzzleTypeId = name;
            } else {
                // It is a standard N x N x N
                puzzleName = `${state.cubeSize}x${state.cubeSize}x${state.cubeSize}`;
                puzzleTypeId = puzzleName;
            }
        } else if (type === 'MirrorCube') {
            // Mirror Cube can also be non-cubic in theory if we allowed it, 
            // but usually it's N x N x N. 
            // However, our puzzle selector supports 'mirror-2x2x3'.
            // Let's check dimensions just in case.
            const dims = state.cubeDimensions;
            if (dims && (dims.x !== dims.y || dims.y !== dims.z || dims.x !== dims.z)) {
                const name = getDimsName();
                puzzleName = `${name} Mirror`;
                puzzleTypeId = `mirror-${name}`;
            } else {
                puzzleName = `${state.cubeSize}x${state.cubeSize}x${state.cubeSize} Mirror`;
                puzzleTypeId = `mirror-${state.cubeSize}x${state.cubeSize}x${state.cubeSize}`;
            }
        } else if (type === 'Molecube') {
            puzzleName = "Molecube";
            puzzleTypeId = 'molecube';
        } else if (type === 'VoidCube') {
            puzzleName = "Void Cube";
            puzzleTypeId = 'voidcube';
        } else if (type === 'AcornsMod') {
            puzzleName = "Acorns Mod";
            puzzleTypeId = 'acorns';
        } else if (type === 'Megaminx') {
            puzzleName = "Megaminx";
            puzzleTypeId = 'megaminx';
        } else if (type === 'Pyraminx') {
            puzzleName = "Pyraminx";
            puzzleTypeId = 'pyraminx';
        } else if (type === 'Skewb') {
            puzzleName = "Skewb";
            puzzleTypeId = 'skewb';
        } else if (type === 'StlPuzzleMod' || state.activePuzzle.puzzleId) {
            // STL Custom Puzzle
            const id = state.activePuzzle.puzzleId;
            puzzleTypeId = id;
            // Try to find name in registry or global cache
            if (window.puzzleRegistry && window.puzzleRegistry[id]) {
                puzzleName = window.puzzleRegistry[id];
            } else {
                puzzleName = "Custom Puzzles";
            }
        } else {
            // Fallback for generic cuboids or other types
            const name = getDimsName();
            if (name) {
                puzzleName = name;
                puzzleTypeId = name;
            }
        }
    }

    const typeEl = document.getElementById('victory-puzzle-type');
    if (typeEl) typeEl.textContent = puzzleName;

    // Check Rank
    const rankEl = document.getElementById('victory-rank-display');
    if (rankEl) {
        rankEl.textContent = "Checking Rank...";
        console.log("showWinModal: Requesting rank check...");
        import('../leaderboard/firebase.js').then(module => {
            module.getPotentialRank(puzzleTypeId, state.finalTimeMs).then(rank => {
                console.log(`showWinModal: Received rank: ${rank}`);
                if (rank) {
                    rankEl.textContent = `You are Rank #${rank}!`;
                } else {
                    // If fetch fails or no internet, do not misleadingly say Rank #1
                    rankEl.textContent = "";
                }
                // Add fun animation
                rankEl.classList.remove('animate-pulse');
                void rankEl.offsetWidth; // trigger reflow
                rankEl.classList.add('animate-pulse');
            });
        });
    }

    overlayManager.open('solved-modal');

    state.isGameActive = false;
}

export function renderLeaderboardUI(leaderboardData, puzzleSize = 3) {
    console.log(`[LB Render] Rendering UI for puzzle: ${puzzleSize} (${leaderboardData.length} entries)`);
    // Determine category to find correct tbody
    let category = 'custom'; // Default to custom if not found in lists
    const p = String(puzzleSize);

    // Check strict lists first
    // Normalize p to match list format if needed
    // Standard/Big are numbers in list, but p might be "3" or "3x3x3"

    let isFound = false;

    // Check Standard
    if (!isFound) {
        // Check special standard puzzles first (like megaminx, pyraminx)
        if (p === 'megaminx' || p === 'pyraminx' || p === 'skewb') {
            category = 'standard';
            isFound = true;
        }
        // Check exact match or "NxNxN" match
        else if (puzzleCategories.standard.includes(parseInt(p)) && (p.length === 1 || p.match(/^\d+$/))) {
            category = 'standard';
            isFound = true;
        } else if (p.includes('x')) {
            const parts = p.split('x');
            if (parts.length === 3 && parts[0] === parts[1] && parts[1] === parts[2]) {
                const n = parseInt(parts[0]);
                if (puzzleCategories.standard.includes(n)) {
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

    // Check Mods
    if (!isFound) {
        if (puzzleCategories.mods.includes(p) || (state.customPuzzles && state.customPuzzles.some(entry => entry.id === p))) {
            category = 'mods';
            isFound = true;
        }
    }

    // If still not found, it stays 'custom'
    // console.log(`[LB Render] Determined category for ${puzzleSize}: ${category}`);

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
        let puzzleLabel = typeof puzzleSize === 'string'
            ? puzzleSize
            : `${puzzleSize}x${puzzleSize}`;

        // Map built-in puzzle IDs to display names
        const modNames = {
            'molecube': 'Molecube',
            'voidcube': 'Void Cube',
            'acorns': 'Acorns Mod',
            'megaminx': 'Megaminx',
            'pyraminx': 'Pyraminx'
        };

        if (modNames[puzzleSize]) {
            puzzleLabel = modNames[puzzleSize];
        }
        // Check if it's a custom puzzle and get the display name
        else if (state.customPuzzles) {
            const customEntry = state.customPuzzles.find(p => p.id === puzzleSize);
            if (customEntry) {
                puzzleLabel = customEntry.name;
            }
        }

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
            tr.className = 'leaderboard-row border-b border-gray-800 last:border-0 transition hover:bg-white/5';

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

    document.getElementById('detail-scramble').textContent = formatScramble(entry.scramble, entry.puzzleType);
    document.getElementById('detail-solution').textContent = entry.solution;

    const d = new Date(entry.date);
    document.getElementById('detail-date').textContent = d.toLocaleDateString() + ' ' + d.toLocaleTimeString();

    overlayManager.open('detail-modal');
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

export function enableDebugButton() {
    if (document.getElementById('btn-debug-floating')) return;

    const debugBtn = document.createElement('button');
    debugBtn.id = 'btn-debug-floating';
    debugBtn.innerText = 'd';
    debugBtn.className = 'fixed bottom-[1px] left-[1px] z-50 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shadow-lg hover:bg-red-500 transition transform hover:scale-110';
    debugBtn.onclick = () => {
        import('./components/DebugMenu.js').then(module => {
            module.showDebugMenu();
        });
    };
    document.body.appendChild(debugBtn);
}

export function showLoading(message = "Loading...") {
    const overlay = document.getElementById('global-loading');
    const text = document.getElementById('global-loading-text');
    if (overlay && text) {
        text.textContent = message;
        overlay.classList.remove('hidden');
        // Force reflow
        void overlay.offsetWidth;
        overlay.classList.remove('opacity-0');
    }
}

export function hideLoading() {
    const overlay = document.getElementById('global-loading');
    if (overlay) {
        overlay.classList.add('opacity-0');
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 300);
    }
}

export function openFeedbackModal() {
    overlayManager.open('feedback-modal');

    // Reset View
    const successDiv = document.getElementById('feedback-success');
    const footerDiv = document.getElementById('feedback-footer');
    const inputs = ['feedback-category', 'feedback-email', 'feedback-message'];

    if (successDiv) successDiv.classList.add('hidden');
    if (footerDiv) footerDiv.classList.remove('hidden');

    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.parentElement.classList.remove('hidden');
            if (id === 'feedback-message') el.value = "";
        }
    });

    // Keep email if previously typed
    const savedEmail = localStorage.getItem('cubeVault_user_email');
    if (savedEmail) document.getElementById('feedback-email').value = savedEmail;

    document.getElementById('feedback-spinner').classList.add('hidden');
    document.getElementById('btn-submit-feedback').disabled = false;
    document.getElementById('btn-submit-feedback').querySelector('span').textContent = "Send";
}

export async function handleFeedbackSubmit() {
    const category = document.getElementById('feedback-category').value;
    const email = document.getElementById('feedback-email').value.trim();
    const message = document.getElementById('feedback-message').value.trim();

    if (!message) {
        alert("Please enter a message!");
        return;
    }

    // UI Loading State
    const btn = document.getElementById('btn-submit-feedback');
    const spinner = document.getElementById('feedback-spinner');
    const label = btn.querySelector('span');

    btn.disabled = true;
    label.textContent = "Sending...";
    spinner.classList.remove('hidden');

    try {
        const { submitFeedback } = await import('../leaderboard/feedback.js');
        const success = await submitFeedback(message, email, category);

        if (success) {
            // Success UI
            document.getElementById('feedback-footer').classList.add('hidden');
            document.getElementById('feedback-success').classList.remove('hidden');

            // Hide inputs
            ['feedback-category', 'feedback-email', 'feedback-message'].forEach(id => {
                document.getElementById(id).parentElement.classList.add('hidden');
            });

            if (email) localStorage.setItem('cubeVault_user_email', email);
        } else {
            alert("Failed to send feedback. Please try again.");
        }
    } catch (e) {
        console.error(e);
        alert("Error sending feedback.");
    } finally {
        btn.disabled = false;
        label.textContent = "Send";
        spinner.classList.add('hidden');
    }
}
