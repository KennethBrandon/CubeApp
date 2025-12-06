import { state } from '../shared/state.js';
import { changePuzzle } from '../ui/puzzleSelector.js';
import { puzzleCategories } from '../ui/puzzleSelector.js';

export class ThumbnailGenerator {
    constructor() {
        this.queue = [];
        this.isGenerating = false;
        this.generatedImages = []; // Initialize storage for generated images
    }

    async generateAll() {
        if (this.isGenerating) return;
        this.isGenerating = true;
        this.generatedImages = []; // Reset storage

        // Create Preview Container
        let previewContainer = document.getElementById('thumbnail-preview');
        if (!previewContainer) {
            previewContainer = document.createElement('div');
            previewContainer.id = 'thumbnail-preview';
            previewContainer.style.position = 'fixed';
            previewContainer.style.top = '0';
            previewContainer.style.left = '0';
            previewContainer.style.width = '100%';
            previewContainer.style.height = '100%';
            previewContainer.style.backgroundColor = 'rgba(0,0,0,0.9)';
            previewContainer.style.zIndex = '9999';
            previewContainer.style.overflowY = 'auto';
            previewContainer.style.padding = '20px';
            previewContainer.style.display = 'flex';
            previewContainer.style.flexDirection = 'column';
            previewContainer.style.alignItems = 'center';

            // Header with controls
            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.gap = '20px';
            header.style.marginBottom = '20px';
            header.style.position = 'sticky';
            header.style.top = '0';
            header.style.zIndex = '10001';
            header.style.backgroundColor = 'rgba(0,0,0,0.8)';
            header.style.padding = '10px';
            header.style.borderRadius = '10px';

            const closeBtn = document.createElement('button');
            closeBtn.textContent = "Close X";
            closeBtn.style.padding = '10px 20px';
            closeBtn.style.background = 'red';
            closeBtn.style.color = 'white';
            closeBtn.style.border = 'none';
            closeBtn.style.borderRadius = '5px';
            closeBtn.style.cursor = 'pointer';
            closeBtn.onclick = () => {
                previewContainer.remove();
            };

            const downloadAllBtn = document.createElement('button');
            downloadAllBtn.textContent = "Download All";
            downloadAllBtn.style.padding = '10px 20px';
            downloadAllBtn.style.background = '#22c55e';
            downloadAllBtn.style.color = 'white';
            downloadAllBtn.style.border = 'none';
            downloadAllBtn.style.borderRadius = '5px';
            downloadAllBtn.style.cursor = 'pointer';
            downloadAllBtn.onclick = () => this.downloadAll();

            header.appendChild(downloadAllBtn);
            header.appendChild(closeBtn);
            previewContainer.appendChild(header);

            // Grid for images
            const grid = document.createElement('div');
            grid.id = 'thumbnail-grid';
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
            grid.style.gap = '20px';
            grid.style.width = '100%';
            previewContainer.appendChild(grid);

            document.body.appendChild(previewContainer);
        } else {
            document.getElementById('thumbnail-grid').innerHTML = '';
        }

        // Build queue
        this.queue = [];

        // Standard
        puzzleCategories.standard.forEach(size => this.queue.push({ type: 'standard', value: size, label: `${size}x${size}x${size}` }));

        // Big
        puzzleCategories.big.forEach(size => this.queue.push({ type: 'big', value: size, label: `${size}x${size}x${size}` }));

        // Cuboids
        puzzleCategories.cuboids.forEach(val => this.queue.push({ type: 'cuboids', value: val, label: `${val} Cube` }));

        // Mirror
        puzzleCategories.mirror.forEach(val => this.queue.push({ type: 'mirror', value: val, label: val }));

        // Mods
        puzzleCategories.mods.forEach(val => this.queue.push({ type: 'mods', value: val, label: val }));

        console.log(`Starting generation of ${this.queue.length} thumbnails...`);

        // Hide UI for clean screenshots
        // Hide UI for clean screenshots
        const uiIds = ['puzzle-selector-modal', 'leaderboard-modal', 'debug-modal'];
        uiIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        // Process queue
        await this.processQueue();

        this.isGenerating = false;
        console.log("Thumbnail generation complete!");
        alert("Generation complete! Click 'Download All' to save images.");
    }

    async generateAllNoBackground() {
        this.transparent = true;
        await this.generateAll();
        this.transparent = false;
    }

    async processQueue() {
        if (this.queue.length === 0) return;

        const item = this.queue.shift();
        console.log(`Generating thumbnail for: ${item.value}`);

        // We'll use the existing changePuzzle but we need to ensure we wait enough time for it to settle.
        changePuzzle(item.value, false, null, false, true);

        // Wait for render (shorter wait now)
        await new Promise(resolve => setTimeout(resolve, 500));

        // Handle Transparency
        const originalBackground = state.scene.background;
        const hiddenObjects = [];

        if (this.transparent) {
            state.scene.background = null;
            state.renderer.setClearColor(0x000000, 0); // Clear with 0 alpha

            // Hide Environment
            state.scene.traverse(obj => {
                if (obj.userData.isDesk || obj.userData.isWall || obj.userData.isMirror) {
                    if (obj.visible) {
                        obj.visible = false;
                        hiddenObjects.push(obj);
                    }
                }
            });

            state.renderer.render(state.scene, state.camera); // Re-render with transparent bg
        }

        // Capture
        this.capture(item.value);

        // Restore Background and Objects
        if (this.transparent) {
            state.scene.background = originalBackground;
            state.renderer.setClearColor(0x000000, 1);

            hiddenObjects.forEach(obj => {
                obj.visible = true;
            });

            state.renderer.render(state.scene, state.camera);
        }

        // Next
        await this.processQueue();
    }

    capture(filename) {
        const canvas = state.renderer.domElement;
        const dataURL = canvas.toDataURL('image/png');

        // Store for bulk download
        this.generatedImages.push({ filename: `puzzle-${filename}.png`, dataURL });

        // Add to Preview
        const grid = document.getElementById('thumbnail-grid');
        if (grid) {
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.flexDirection = 'column';
            wrapper.style.alignItems = 'center';
            wrapper.style.gap = '5px';
            wrapper.style.backgroundColor = '#222';
            wrapper.style.padding = '10px';
            wrapper.style.borderRadius = '8px';

            const img = document.createElement('img');
            img.src = dataURL;
            img.style.width = '150px';
            img.style.height = '150px';
            img.style.objectFit = 'contain';
            img.style.borderRadius = '4px';
            img.style.border = '1px solid #444';

            // Allow right click
            img.title = `Right click > Save Image As... > puzzle-${filename}.png`;

            const nameLabel = document.createElement('div');
            nameLabel.textContent = `puzzle-${filename}.png`;
            nameLabel.style.color = '#aaa';
            nameLabel.style.fontFamily = 'monospace';
            nameLabel.style.fontSize = '12px';
            nameLabel.style.marginTop = '5px';
            nameLabel.style.userSelect = 'all'; // Easy copy

            wrapper.appendChild(img);
            wrapper.appendChild(nameLabel);
            grid.appendChild(wrapper);
        }
    }

    async downloadAll() {
        if (!this.generatedImages || this.generatedImages.length === 0) {
            alert("No images generated yet!");
            return;
        }

        alert("Starting downloads... You may need to allow multiple file downloads in your browser.");

        for (const img of this.generatedImages) {
            const link = document.createElement('a');
            link.download = img.filename;
            link.href = img.dataURL;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Small delay to prevent browser blocking
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
}

export const thumbnailGenerator = new ThumbnailGenerator();
window.generateThumbnails = () => thumbnailGenerator.generateAll();
window.generateThumbnailsNoBackground = () => thumbnailGenerator.generateAllNoBackground();
