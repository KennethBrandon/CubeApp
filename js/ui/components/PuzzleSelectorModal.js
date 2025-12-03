import { overlayManager } from '../overlayManager.js';

export function ensurePuzzleSelectorModal() {
    if (document.getElementById('puzzle-selector-modal')) {
        return false; // Already exists
    }

    const html = `
    <div id="puzzle-selector-modal"
        class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
        <div
            class="bg-gray-900 w-full max-w-5xl h-[90vh] md:h-[80vh] rounded-2xl border border-gray-700 shadow-2xl flex flex-col md:flex-row overflow-hidden">

            <!-- Sidebar -->
            <div
                class="w-full md:w-64 bg-gray-800/50 border-b md:border-b-0 md:border-r border-gray-700 flex flex-row md:flex-col flex-wrap md:flex-nowrap p-4 gap-2 md:overflow-y-auto shrink-0">
                <h2 class="text-xl font-bold text-white mb-4 px-2 hidden md:block">Select Puzzle</h2>

                <!-- Mobile Title -->
                <div class="md:hidden flex items-center mr-4">
                    <span class="font-bold text-white whitespace-nowrap">Puzzles</span>
                </div>

                <button
                    class="puzzle-category-btn text-left px-4 py-2 md:py-3 rounded-xl transition font-bold text-gray-400 hover:bg-gray-800 whitespace-nowrap"
                    data-category="standard">Standard</button>
                <button
                    class="puzzle-category-btn text-left px-4 py-2 md:py-3 rounded-xl transition font-bold text-gray-400 hover:bg-gray-800 whitespace-nowrap"
                    data-category="big">Big</button>
                <button
                    class="puzzle-category-btn text-left px-4 py-2 md:py-3 rounded-xl transition font-bold text-gray-400 hover:bg-gray-800 whitespace-nowrap"
                    data-category="cuboids">Cuboids</button>
                <button
                    class="puzzle-category-btn text-left px-4 py-2 md:py-3 rounded-xl transition font-bold text-gray-400 hover:bg-gray-800 whitespace-nowrap"
                    data-category="mirror">Mirror</button>
                <button
                    class="puzzle-category-btn text-left px-4 py-2 md:py-3 rounded-xl transition font-bold text-gray-400 hover:bg-gray-800 whitespace-nowrap"
                    data-category="mods">Mods</button>
                <button
                    class="puzzle-category-btn text-left px-4 py-2 md:py-3 rounded-xl transition font-bold text-gray-400 hover:bg-gray-800 whitespace-nowrap"
                    data-category="custom">Custom</button>

                <div class="flex-1 hidden md:block"></div>
                <button id="btn-close-puzzle-selector"
                    class="hidden md:block text-center px-4 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold transition">Close</button>
            </div>

            <!-- Content Area -->
            <div id="puzzle-selector-content-area" class="flex-1 overflow-hidden bg-gray-900 relative flex flex-col">
                <div id="puzzle-carousel"
                    class="flex-1 flex overflow-x-auto snap-x snap-mandatory scrollbar-hide h-full w-full">

                    <!-- Standard -->
                    <div id="cat-standard"
                        class="carousel-slide min-w-full w-full h-full p-6 overflow-y-auto snap-center grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 content-start">
                        <div id="cat-standard-list" class="contents"></div>
                    </div>

                    <!-- Big -->
                    <div id="cat-big"
                        class="carousel-slide min-w-full w-full h-full p-6 overflow-y-auto snap-center grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 content-start">
                        <div id="cat-big-list" class="contents"></div>
                    </div>

                    <!-- Cuboids -->
                    <div id="cat-cuboids"
                        class="carousel-slide min-w-full w-full h-full p-6 overflow-y-auto snap-center grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 content-start">
                        <div id="cat-cuboids-list" class="contents"></div>
                    </div>

                    <!-- Mirror -->
                    <div id="cat-mirror"
                        class="carousel-slide min-w-full w-full h-full p-6 overflow-y-auto snap-center grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 content-start">
                        <div id="cat-mirror-list" class="contents"></div>
                    </div>

                    <!-- Mods -->
                    <div id="cat-mods"
                        class="carousel-slide min-w-full w-full h-full p-6 overflow-y-auto snap-center grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 content-start">
                        <div id="cat-mods-list" class="contents"></div>
                    </div>

                    <!-- Custom -->
                    <div id="cat-custom"
                        class="carousel-slide min-w-full w-full h-full p-4 overflow-y-auto snap-center flex flex-col items-center justify-center">
                        <div class="bg-gray-800 p-5 rounded-2xl border border-gray-700 max-w-md w-full shadow-2xl">
                            <h3 class="text-xl font-bold text-white mb-3 text-center">Create Custom Puzzle</h3>

                            <div class="space-y-3 mb-4">
                                <div id="custom-puzzle-preview"
                                    class="w-full h-64 bg-black/50 rounded-xl border border-gray-600 mb-2 overflow-hidden relative">
                                    <!-- Preview Canvas will be injected here -->
                                </div>

                                <!-- Sliders -->
                                <div>
                                    <div class="flex justify-between items-center mb-1">
                                        <label class="text-xs text-gray-400 uppercase font-bold">Height</label>
                                        <span id="custom-modal-val-d1"
                                            class="text-purple-400 font-mono font-bold">3</span>
                                    </div>
                                    <input type="range" id="custom-modal-d1" min="1" max="20" value="3"
                                        class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500">
                                </div>
                                <div>
                                    <div class="flex justify-between items-center mb-1">
                                        <label class="text-xs text-gray-400 uppercase font-bold">Width</label>
                                        <span id="custom-modal-val-d2"
                                            class="text-purple-400 font-mono font-bold">3</span>
                                    </div>
                                    <input type="range" id="custom-modal-d2" min="1" max="20" value="3"
                                        class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500">
                                </div>
                                <div>
                                    <div class="flex justify-between items-center mb-1">
                                        <label class="text-xs text-gray-400 uppercase font-bold">Depth</label>
                                        <span id="custom-modal-val-d3"
                                            class="text-purple-400 font-mono font-bold">3</span>
                                    </div>
                                    <input type="range" id="custom-modal-d3" min="1" max="20" value="3"
                                        class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500">
                                </div>

                                <div class="pt-2 border-t border-gray-700">
                                    <label class="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" id="custom-modal-mirror"
                                            class="w-5 h-5 rounded bg-gray-600 border-gray-500 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800">
                                        <span class="font-bold text-gray-300 text-sm">Mirror Blocks Mode</span>
                                    </label>
                                </div>
                            </div>

                            <button id="btn-create-custom-puzzle-modal"
                                class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition shadow-lg text-lg">
                                Create Puzzle
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Mobile Close Button -->
            <div class="md:hidden p-4 border-t border-gray-700 bg-gray-800/50 shrink-0">
                <button onclick="document.getElementById('btn-close-puzzle-selector').click()"
                    class="w-full text-center px-4 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold transition">Close</button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    // Attach close listener immediately as it's part of the modal structure
    const closeBtn = document.getElementById('btn-close-puzzle-selector');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            overlayManager.close();
        });
    }

    return true; // Created
}
