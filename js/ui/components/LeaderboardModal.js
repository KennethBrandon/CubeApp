import { setupLeaderboardUI, openLeaderboardModal as logicOpen } from '../leaderboardUi.js';
import { overlayManager } from '../overlayManager.js';

export function showLeaderboard() {
    if (!document.getElementById('leaderboard-modal')) {
        createLeaderboardModal();
        setupLeaderboardUI();
    }
    logicOpen();
}

function createLeaderboardModal() {
    const html = `
    <div id="leaderboard-modal"
        class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
        <div
            class="bg-gray-900 w-full max-w-5xl h-[90vh] md:h-[80vh] rounded-2xl border border-gray-700 shadow-2xl flex flex-col md:flex-row overflow-hidden relative">

            <!-- Sidebar (Categories) -->
            <div class="w-full md:w-64 bg-gray-800/50 border-b md:border-b-0 md:border-r border-gray-700 flex flex-row md:flex-col shrink-0 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto hide-scrollbar">
                <div class="p-4 border-r md:border-r-0 md:border-b border-gray-700 bg-gray-800/80 backdrop-blur sticky left-0 z-10 hidden md:block">
                    <h2
                        class="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                        Leaderboards
                    </h2>
                </div>
                
                <!-- Mobile Title (Compact) -->
                 <div class="md:hidden flex items-center px-4 border-r border-gray-700 bg-gray-800/80 backdrop-blur whitespace-nowrap sticky left-0 z-10">
                    <span class="font-bold text-blue-400">🏆</span>
                </div>

                <div class="flex flex-row md:flex-col p-2 gap-2 md:space-y-1 md:gap-0 min-w-max md:min-w-0">
                    <button data-category="standard"
                        class="leaderboard-category-btn group flex-1 md:w-full text-left px-3 py-2 md:px-4 md:py-3 rounded-xl text-gray-400 hover:bg-gray-800 hover:text-white transition flex items-center gap-2 md:gap-3 border border-transparent hover:border-gray-700 shrink-0">
                        <div class="flex flex-col">
                            <span class="font-bold text-sm">WCA Puzzles</span>
                            <span class="text-[10px] opacity-60 hidden md:block">Official Events</span>
                        </div>
                    </button>
                    <button data-category="big"
                        class="leaderboard-category-btn group flex-1 md:w-full text-left px-3 py-2 md:px-4 md:py-3 rounded-xl text-gray-400 hover:bg-gray-800 hover:text-white transition flex items-center gap-2 md:gap-3 border border-transparent hover:border-gray-700 shrink-0">
                        <div class="flex flex-col">
                            <span class="font-bold text-sm">Big Cubes</span>
                            <span class="text-[10px] opacity-60 hidden md:block">8x8 - 20x20</span>
                        </div>
                    </button>
                    <button data-category="cuboids"
                        class="leaderboard-category-btn group flex-1 md:w-full text-left px-3 py-2 md:px-4 md:py-3 rounded-xl text-gray-400 hover:bg-gray-800 hover:text-white transition flex items-center gap-2 md:gap-3 border border-transparent hover:border-gray-700 shrink-0">
                        <div class="flex flex-col">
                            <span class="font-bold text-sm">Cuboids</span>
                            <span class="text-[10px] opacity-60 hidden md:block">3x3x5, etc</span>
                        </div>
                    </button>
                    <button data-category="mirror"
                        class="leaderboard-category-btn group flex-1 md:w-full text-left px-3 py-2 md:px-4 md:py-3 rounded-xl text-gray-400 hover:bg-gray-800 hover:text-white transition flex items-center gap-2 md:gap-3 border border-transparent hover:border-gray-700 shrink-0">
                        <div class="flex flex-col">
                            <span class="font-bold text-sm">Mirror</span>
                            <span class="text-[10px] opacity-60 hidden md:block">Shape Shifters</span>
                        </div>
                    </button>
                    <button data-category="mods"
                        class="leaderboard-category-btn group flex-1 md:w-full text-left px-3 py-2 md:px-4 md:py-3 rounded-xl text-gray-400 hover:bg-gray-800 hover:text-white transition flex items-center gap-2 md:gap-3 border border-transparent hover:border-gray-700 shrink-0">
                        <div class="flex flex-col">
                            <span class="font-bold text-sm">Mods</span>
                            <span class="text-[10px] opacity-60 hidden md:block">Special Puzzles</span>
                        </div>
                    </button>
                    <button data-category="custom"
                        class="leaderboard-category-btn group flex-1 md:w-full text-left px-3 py-2 md:px-4 md:py-3 rounded-xl text-gray-400 hover:bg-gray-800 hover:text-white transition flex items-center gap-2 md:gap-3 border border-transparent hover:border-gray-700 shrink-0">
                        <div class="flex flex-col">
                            <span class="font-bold text-sm">Custom</span>
                            <span class="text-[10px] opacity-60 hidden md:block">Everything Else</span>
                        </div>
                    </button>
                </div>
            </div>

            <!-- Content Area -->
            <div class="flex-1 flex flex-col bg-gray-900 relative overflow-hidden">
                <!-- Offline Warning -->
                <div id="leaderboard-offline-warning" class="hidden bg-red-900/80 text-red-200 px-4 py-2 text-center font-bold border-b border-red-700">
                    You are currently offline. Leaderboard may be outdated.
                </div>

                <!-- Puzzle Chips Header -->
                <div id="leaderboard-puzzle-list"
                    class="p-4 border-b border-gray-800 flex flex-nowrap overflow-x-auto gap-2 shrink-0 scrollbar-hide">
                    <!-- Chips injected by JS -->
                </div>

                <!-- Table Container -->
                <div id="leaderboard-carousel"
                    class="flex-1 flex overflow-x-auto snap-x snap-mandatory scrollbar-hide h-full w-full">
                    <!-- Standard -->
                    <div id="lb-cat-standard"
                        class="carousel-slide min-w-full w-full h-full overflow-y-auto snap-center">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-gray-800/50 sticky top-0 backdrop-blur-sm">
                                <tr>
                                    <th class="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-16">Rank
                                    </th>
                                    <th class="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                                    <th class="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                                        Time</th>
                                </tr>
                            </thead>
                            <tbody id="leaderboard-body-standard" class="divide-y divide-gray-800"></tbody>
                        </table>
                    </div>

                    <!-- Big -->
                    <div id="lb-cat-big" class="carousel-slide min-w-full w-full h-full overflow-y-auto snap-center">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-gray-800/50 sticky top-0 backdrop-blur-sm">
                                <tr>
                                    <th class="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-16">Rank
                                    </th>
                                    <th class="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                                    <th class="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                                        Time</th>
                                </tr>
                            </thead>
                            <tbody id="leaderboard-body-big" class="divide-y divide-gray-800"></tbody>
                        </table>
                    </div>

                    <!-- Cuboids -->
                    <div id="lb-cat-cuboids"
                        class="carousel-slide min-w-full w-full h-full overflow-y-auto snap-center">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-gray-800/50 sticky top-0 backdrop-blur-sm">
                                <tr>
                                    <th class="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-16">Rank
                                    </th>
                                    <th class="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                                    <th class="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                                        Time</th>
                                </tr>
                            </thead>
                            <tbody id="leaderboard-body-cuboids" class="divide-y divide-gray-800"></tbody>
                        </table>
                    </div>

                    <!-- Mirror -->
                    <div id="lb-cat-mirror" class="carousel-slide min-w-full w-full h-full overflow-y-auto snap-center">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-gray-800/50 sticky top-0 backdrop-blur-sm">
                                <tr>
                                    <th class="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-16">Rank
                                    </th>
                                    <th class="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                                    <th class="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                                        Time</th>
                                </tr>
                            </thead>
                            <tbody id="leaderboard-body-mirror" class="divide-y divide-gray-800"></tbody>
                        </table>
                    </div>

                    <!-- Mods -->
                    <div id="lb-cat-mods" class="carousel-slide min-w-full w-full h-full overflow-y-auto snap-center">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-gray-800/50 sticky top-0 backdrop-blur-sm">
                                <tr>
                                    <th class="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-16">Rank
                                    </th>
                                    <th class="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                                    <th class="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                                        Time</th>
                                </tr>
                            </thead>
                            <tbody id="leaderboard-body-mods" class="divide-y divide-gray-800"></tbody>
                        </table>
                    </div>

                    <!-- Custom -->
                    <div id="lb-cat-custom" class="carousel-slide min-w-full w-full h-full overflow-y-auto snap-center">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-gray-800/50 sticky top-0 backdrop-blur-sm">
                                <tr>
                                    <th class="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-16">Rank
                                    </th>
                                    <th class="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                                    <th class="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                                        Time</th>
                                </tr>
                            </thead>
                            <tbody id="leaderboard-body-custom" class="divide-y divide-gray-800"></tbody>
                        </table>
                    </div>
                </div>

                <!-- Mobile Close Button -->
                <div class="md:hidden p-4 border-t border-gray-700 bg-gray-800/50 shrink-0">
                    <button onclick="document.getElementById('btn-close-leaderboard').click()"
                        class="w-full text-center px-4 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold transition">Close</button>
                </div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    // We also need to attach the close button listener here because setupLeaderboardUI doesn't do it (it says "handled by onclick in HTML or events.js")
    // But events.js will fail if element doesn't exist.
    // So we should attach it here.
    const closeBtn = document.getElementById('btn-close-leaderboard');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            overlayManager.close();
        });
    }
}
