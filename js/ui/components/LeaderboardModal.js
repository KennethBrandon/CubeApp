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
        class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-2 sm:p-6 opacity-0 transition-opacity duration-300">
        <div
            class="bg-gray-900 w-full max-w-5xl h-[90vh] rounded-2xl border border-gray-700 shadow-2xl flex flex-col md:flex-row overflow-hidden relative">

            <!-- Close Button (Absolute Top Right) -->
            <button id="btn-close-leaderboard"
                class="absolute top-4 right-4 z-20 text-gray-400 hover:text-white bg-gray-800/50 hover:bg-red-600/80 rounded-full p-2 transition">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12">
                    </path>
                </svg>
            </button>

            <!-- Sidebar (Categories) -->
            <div
                class="w-full md:w-64 bg-gray-800/50 border-b md:border-b-0 md:border-r border-gray-700 flex flex-row md:flex-col shrink-0 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto hide-scrollbar">
                <div
                    class="p-4 border-r md:border-r-0 md:border-b border-gray-700 bg-gray-800/80 backdrop-blur sticky left-0 z-10 hidden md:block">
                    <h2
                        class="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                        Leaderboards
                    </h2>
                </div>

                <!-- Mobile Title (Compact) -->
                <div
                    class="md:hidden flex items-center px-4 border-r border-gray-700 bg-gray-800/80 backdrop-blur whitespace-nowrap sticky left-0 z-10">
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

            <!-- Main Content -->
            <div class="flex-1 flex flex-col min-w-0 min-h-0 bg-gray-900/50">
                <!-- Header -->
                <div class="p-4 border-b border-gray-700 bg-gray-900/80 backdrop-blur z-10">
                    <div class="flex items-center justify-between mb-4">
                        <h3 id="leaderboard-title" class="text-white font-bold text-lg">Top Solvers</h3>
                        <!-- Offline Warning -->
                        <div id="leaderboard-offline-warning"
                            class="hidden text-xs bg-red-900/50 text-red-300 border border-red-800 px-2 py-1 rounded flex items-center gap-2">
                            <span>📡 Offline Mode</span>
                        </div>
                    </div>

                    <!-- Puzzle Chips List -->
                    <div class="relative">
                        <div id="leaderboard-puzzle-list"
                            class="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                            <!-- Chips injected via JS -->
                        </div>
                        <!-- Fade gradients for scroll indication -->
                        <div
                            class="absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-gray-900 to-transparent pointer-events-none">
                        </div>
                        <div
                            class="absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-gray-900 to-transparent pointer-events-none">
                        </div>
                    </div>
                </div>

                <!-- Carousel / Content Area -->
                <div id="leaderboard-carousel"
                    class="flex-1 min-h-0 overflow-x-hidden relative flex snap-x snap-mandatory scroll-smooth">

                    <!-- Standard Table -->
                    <div id="lb-cat-standard"
                        class="w-full h-full flex-shrink-0 snap-center overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-gray-700">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-gray-800/50 text-xs uppercase text-gray-500 sticky top-0 backdrop-blur-md">
                                <tr>
                                    <th class="p-3 w-16">Rank</th>
                                    <th class="p-3">Player</th>
                                    <th class="p-3 text-right">Time</th>
                                </tr>
                            </thead>
                            <tbody id="leaderboard-body-standard" class="text-sm"></tbody>
                        </table>
                    </div>

                    <!-- Big Table -->
                    <div id="lb-cat-big"
                        class="w-full h-full flex-shrink-0 snap-center overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-gray-700">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-gray-800/50 text-xs uppercase text-gray-500 sticky top-0 backdrop-blur-md">
                                <tr>
                                    <th class="p-3 w-16">Rank</th>
                                    <th class="p-3">Player</th>
                                    <th class="p-3 text-right">Time</th>
                                </tr>
                            </thead>
                            <tbody id="leaderboard-body-big" class="text-sm"></tbody>
                        </table>
                    </div>

                    <!-- Cuboids Table -->
                    <div id="lb-cat-cuboids"
                        class="w-full h-full flex-shrink-0 snap-center overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-gray-700">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-gray-800/50 text-xs uppercase text-gray-500 sticky top-0 backdrop-blur-md">
                                <tr>
                                    <th class="p-3 w-16">Rank</th>
                                    <th class="p-3">Player</th>
                                    <th class="p-3 text-right">Time</th>
                                </tr>
                            </thead>
                            <tbody id="leaderboard-body-cuboids" class="text-sm"></tbody>
                        </table>
                    </div>

                    <!-- Mirror Table -->
                    <div id="lb-cat-mirror"
                        class="w-full h-full flex-shrink-0 snap-center overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-gray-700">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-gray-800/50 text-xs uppercase text-gray-500 sticky top-0 backdrop-blur-md">
                                <tr>
                                    <th class="p-3 w-16">Rank</th>
                                    <th class="p-3">Player</th>
                                    <th class="p-3 text-right">Time</th>
                                </tr>
                            </thead>
                            <tbody id="leaderboard-body-mirror" class="text-sm"></tbody>
                        </table>
                    </div>

                    <!-- Mods Table -->
                    <div id="lb-cat-mods"
                        class="w-full h-full flex-shrink-0 snap-center overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-gray-700">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-gray-800/50 text-xs uppercase text-gray-500 sticky top-0 backdrop-blur-md">
                                <tr>
                                    <th class="p-3 w-16">Rank</th>
                                    <th class="p-3">Player</th>
                                    <th class="p-3 text-right">Time</th>
                                </tr>
                            </thead>
                            <tbody id="leaderboard-body-mods" class="text-sm"></tbody>
                        </table>
                    </div>

                    <!-- Custom Table -->
                    <div id="lb-cat-custom"
                        class="w-full h-full flex-shrink-0 snap-center overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-gray-700">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-gray-800/50 text-xs uppercase text-gray-500 sticky top-0 backdrop-blur-md">
                                <tr>
                                    <th class="p-3 w-16">Rank</th>
                                    <th class="p-3">Player</th>
                                    <th class="p-3 text-right">Time</th>
                                </tr>
                            </thead>
                            <tbody id="leaderboard-body-custom" class="text-sm"></tbody>
                        </table>
                    </div>

                    <!-- Loading Overlay (Absolute) -->
                    <div id="leaderboard-loading"
                        class="absolute inset-0 bg-gray-900/80 flex flex-col items-center justify-center z-20">
                        <div
                            class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4">
                        </div>
                        <p class="text-blue-400 font-bold animate-pulse">Loading Scores...</p>
                    </div>

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
