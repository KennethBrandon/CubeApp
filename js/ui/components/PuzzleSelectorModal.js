import { overlayManager } from '../overlayManager.js';

export function ensurePuzzleSelectorModal() {
    if (document.getElementById('puzzle-selector-modal')) {
        return false; // Already exists
    }

    const html = `
    <!-- Puzzle Selector Backdrop -->
    <div id="puzzle-selector-modal"
        class="hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 opacity-0 group">
        
        <!-- Responsive Drawer Panel -->
        <!-- Mobile: Bottom Sheet (translate-y) | Desktop: Left Sidebar (translate-x) -->
        <div id="puzzle-selector-panel"
            class="absolute bg-gray-900 shadow-2xl transition-transform duration-300 ease-out flex flex-col overflow-hidden
            
            bottom-0 left-0 right-0 h-[90vh] rounded-t-2xl 
            transform translate-y-0
            [.opacity-0_&]:translate-y-full

            md:top-0 md:bottom-0 md:left-0 md:w-[600px] md:h-auto md:rounded-none md:border-r md:border-gray-700
            md:transform md:translate-x-0
            md:[.opacity-0_&]:-translate-x-full
            md:[.opacity-0_&]:translate-y-0">

            <!-- Header -->
            <div class="p-4 border-b border-gray-700 flex items-center justify-between shrink-0 bg-gray-800/50">
                <h2 class="text-xl font-bold text-white">Select Puzzle</h2>
                <button id="btn-close-puzzle-selector" class="p-2 text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-full transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>

            <!-- Categories (Chips) -->
            <div class="px-4 py-3 border-b border-gray-700 overflow-x-auto shrink-0 flex gap-2 scrollbar-hide">
                <button class="puzzle-category-btn active px-4 py-2 rounded-full bg-blue-600 text-white font-bold text-sm whitespace-nowrap transition" data-category="standard">Standard</button>
                <button class="puzzle-category-btn px-4 py-2 rounded-full bg-gray-800 text-gray-400 hover:text-white font-bold text-sm whitespace-nowrap transition hover:bg-gray-700" data-category="big">Big Cubes</button>
                <button class="puzzle-category-btn px-4 py-2 rounded-full bg-gray-800 text-gray-400 hover:text-white font-bold text-sm whitespace-nowrap transition hover:bg-gray-700" data-category="cuboids">Cuboids</button>
                <button class="puzzle-category-btn px-4 py-2 rounded-full bg-gray-800 text-gray-400 hover:text-white font-bold text-sm whitespace-nowrap transition hover:bg-gray-700" data-category="mirror">Mirror</button>
                <button class="puzzle-category-btn px-4 py-2 rounded-full bg-gray-800 text-gray-400 hover:text-white font-bold text-sm whitespace-nowrap transition hover:bg-gray-700" data-category="mods">Mods</button>
                <button class="puzzle-category-btn px-4 py-2 rounded-full bg-gray-800 text-gray-400 hover:text-white font-bold text-sm whitespace-nowrap transition hover:bg-gray-700" data-category="custom">Custom</button>
            </div>

            <!-- Content Area (Carousel) -->
            <div id="puzzle-selector-content-area" class="flex-1 overflow-hidden relative">
                <div id="puzzle-carousel" class="flex h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide">
                    
                    <!-- Standard -->
                    <div id="cat-standard" class="carousel-slide min-w-full w-full h-full p-4 overflow-y-auto snap-center">
                        <div id="cat-standard-list" class="grid grid-cols-3 gap-3"></div>
                    </div>
                    
                    <!-- Big -->
                    <div id="cat-big" class="carousel-slide min-w-full w-full h-full p-4 overflow-y-auto snap-center">
                        <div id="cat-big-list" class="grid grid-cols-3 gap-3"></div>
                    </div>
                    
                    <!-- Cuboids -->
                    <div id="cat-cuboids" class="carousel-slide min-w-full w-full h-full p-4 overflow-y-auto snap-center">
                        <div id="cat-cuboids-list" class="grid grid-cols-3 gap-3"></div>
                    </div>
                    
                    <!-- Mirror -->
                    <div id="cat-mirror" class="carousel-slide min-w-full w-full h-full p-4 overflow-y-auto snap-center">
                        <div id="cat-mirror-list" class="grid grid-cols-3 gap-3"></div>
                    </div>
                    
                    <!-- Mods -->
                    <div id="cat-mods" class="carousel-slide min-w-full w-full h-full p-4 overflow-y-auto snap-center">
                        <div id="cat-mods-list" class="grid grid-cols-2 gap-3"></div>
                    </div>

                    <!-- Custom -->
                    <div id="cat-custom" class="carousel-slide min-w-full w-full h-full p-4 overflow-y-auto snap-center flex flex-col items-center">
                         <div class="bg-gray-800 p-5 rounded-2xl border border-gray-700 w-full shadow-lg">
                            <h3 class="text-lg font-bold text-white mb-3 text-center">Custom Puzzle</h3>
                            
                            <div id="custom-puzzle-preview" class="w-full h-48 bg-black/50 rounded-xl border border-gray-600 mb-4 overflow-hidden relative"></div>

                            <div class="space-y-4 mb-6">
                                <div>
                                    <div class="flex justify-between items-center mb-1">
                                        <label class="text-xs text-gray-400 font-bold">Height</label>
                                        <span id="custom-modal-val-d1" class="text-purple-400 font-mono font-bold">3</span>
                                    </div>
                                    <input type="range" id="custom-modal-d1" min="1" max="20" value="3" class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500">
                                </div>
                                <div>
                                    <div class="flex justify-between items-center mb-1">
                                        <label class="text-xs text-gray-400 font-bold">Width</label>
                                        <span id="custom-modal-val-d2" class="text-purple-400 font-mono font-bold">3</span>
                                    </div>
                                    <input type="range" id="custom-modal-d2" min="1" max="20" value="3" class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500">
                                </div>
                                <div>
                                    <div class="flex justify-between items-center mb-1">
                                        <label class="text-xs text-gray-400 font-bold">Depth</label>
                                        <span id="custom-modal-val-d3" class="text-purple-400 font-mono font-bold">3</span>
                                    </div>
                                    <input type="range" id="custom-modal-d3" min="1" max="20" value="3" class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500">
                                </div>

                                <div class="pt-2 border-t border-gray-700">
                                    <label class="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" id="custom-modal-mirror" class="w-5 h-5 rounded bg-gray-600 border-gray-500 text-blue-600 focus:ring-blue-500">
                                        <span class="font-bold text-gray-300 text-sm">Mirror Blocks Mode</span>
                                    </label>
                                </div>
                            </div>

                            <button id="btn-create-custom-puzzle-modal" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition shadow-lg">
                                Create Puzzle
                            </button>
                        </div>
                    </div>

                </div>
            </div>
            
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    // Attach listeners
    const closeBtn = document.getElementById('btn-close-puzzle-selector');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            overlayManager.close();
        });
    }

    // Close when clicking backdrop (but not panel)
    const modal = document.getElementById('puzzle-selector-modal');
    const panel = document.getElementById('puzzle-selector-panel');
    if (modal && panel) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                overlayManager.close();
            }
        });
    }

    // Category Buttons Logic (Chip Switching)
    const catBtns = modal.querySelectorAll('.puzzle-category-btn');
    const carousel = document.getElementById('puzzle-carousel');

    catBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // UI Update
            catBtns.forEach(b => {
                b.classList.remove('active', 'bg-blue-600', 'text-white');
                b.classList.add('bg-gray-800', 'text-gray-400');
            });
            btn.classList.remove('bg-gray-800', 'text-gray-400');
            btn.classList.add('active', 'bg-blue-600', 'text-white');

            // Scroll Carousel
            const cat = btn.dataset.category;
            const target = document.getElementById(`cat-${cat}`);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', inline: 'start' });
            }
        });
    });

    return true; // Created
}
