
const CACHE_NAME = 'puzzle-assets-v1';

export const puzzleCache = {
    async open() {
        return await caches.open(CACHE_NAME);
    },

    /**
     * Checks if the main assets for a puzzle are in the cache.
     * Note: This checks for the existence of the STL or Config file.
     * It does not guarantee integrity.
     */
    async checkIfCached(puzzleId) {
        const cache = await this.open();

        // Check for config first as it's small and always required
        const configReq = new Request(`assets/puzzles/${puzzleId}/config.json`);
        const configRes = await cache.match(configReq);
        if (!configRes) return false;

        // We assume if config is there, likely the rest is there or in progress.
        // But to be sure, we could check the cached config to find the STL path.
        // For performance in list view, checking config existence is usually enough
        // if we trust our download process completes or nothing.
        return true;
    },

    /**
     * Downloads all assets for a puzzle.
     * 1. Fetches config.json to find other assets.
     * 2. Fetches STL/Bin files.
     * 3. Fetches Colors if any.
     * 4. Stores everything in cache.
     */
    async downloadPuzzle(puzzleId, onProgress) {
        const cache = await this.open();
        let basePath = `assets/puzzles/${puzzleId}/`;

        try {
            // 1. Fetch Config
            const configUrl = basePath + 'config.json';
            const configRes = await fetch(configUrl);
            if (!configRes.ok) throw new Error(`Failed to fetch config: ${configRes.statusText}`);

            const configClone = configRes.clone(); // Clone for cache
            await cache.put(configUrl, configClone);

            const config = await configRes.json();

            const filesToCache = [configUrl];

            // Add STL or Cubies
            // (Standard STL)
            if (config.stlPath) {
                filesToCache.push(basePath + config.stlPath);
            }
            // (Pre-computed Cubies - potentially many files)
            // If the puzzle uses pre-computed cubies, we might need a manifest.
            // But usually current StlPuzzleMod logic just iterates dimensions.
            // For now, let's support standard STL + Color. 
            // If we need to support binary caching, we'd need to replicate the filename logic.
            // (Implementing logic to match StlPuzzleMod.loadPrecomputedCubies range logic would be best)
            if (config.format === 'binary_v1') {
                const getRange = (size) => {
                    const range = [];
                    const offset = (size - 1) / 2;
                    for (let i = 0; i < size; i++) range.push(i - offset);
                    return range;
                };
                const xRange = getRange(config.dimensions.x);
                const yRange = getRange(config.dimensions.y);
                const zRange = getRange(config.dimensions.z);

                for (let x of xRange) {
                    for (let y of yRange) {
                        for (let z of zRange) {
                            filesToCache.push(basePath + `cubies/cubie_${x}_${y}_${z}.bin`);
                        }
                    }
                }
            }

            if (config.colorPath) {
                // colorPath is relative to puzzle folder usually? 
                // StlPuzzleMod: `assets/puzzles/${this.puzzleId}/${this.puzzleConfig.colorPath}`
                filesToCache.push(basePath + config.colorPath);
            }

            // Thumbnail
            filesToCache.push(basePath + 'thumbnail.png');

            // Download All
            let completed = 0;
            const total = filesToCache.length;

            // Parallel download with progress
            // We use a limit to avoid network thrashing if too many files
            const batchSize = 5;
            for (let i = 0; i < total; i += batchSize) {
                const batch = filesToCache.slice(i, i + batchSize);
                await Promise.all(batch.map(async (url) => {
                    try {
                        // Check if already cached to save data?
                        // const match = await cache.match(url);
                        // if (match) return;

                        await cache.add(url);
                    } catch (e) {
                        console.warn(`Failed to cache ${url}`, e);
                        // Don't fail entire download for one texture/bin if we can help it?
                        // But for now, let it throw so UI knows.
                        throw e;
                    }
                }));

                completed += batch.length;
                if (onProgress) onProgress(Math.min(1.0, completed / total));
            }

        } catch (e) {
            console.error("Download failed:", e);
            throw e;
        }
    },

    /**
     * Attempts to estimate download size via HEAD request to STL file.
     * Returns bytes or null.
     */
    async getDownloadSize(puzzleId) {
        // We only check the STL size as it's the bulk.
        // We need config first to know STL path.

        try {
            // Try to fetch config HEAD first? Or just fetch config (it's small)
            const configRes = await fetch(`assets/puzzles/${puzzleId}/config.json`);
            if (!configRes.ok) return null;
            const config = await configRes.json();

            if (config.stlPath) {
                const stlUrl = `assets/puzzles/${puzzleId}/${config.stlPath}`;
                if (headRes.ok) {
                    const len = headRes.headers.get('Content-Length');
                    if (len) return parseInt(len);
                }
            } else if (config.format === 'binary_v1') {
                // For binary format, we have many small files.
                // Doing HEAD on all of them is slow.
                // We can try to do one or two and estimate? 
                // Or just show "Unknown Size" or calculate exactly if not too many?
                // A 3x3x3 has 27 pieces. A 10x10x10 has 1000.
                // Let's just try to get the size of ONE cubie and multiply by count?
                // No, sizes vary wildly.

                // Better approach: Just show "Download" without size, or "? MB".
                // But for now, let's try to sum them if count < 50, else estimate.

                const dims = config.dimensions;
                const totalCubies = dims.x * dims.y * dims.z;

                // Just check one to see if files exist/accessible
                const basePath = `assets/puzzles/${puzzleId}/cubies/`;
                const sampleRes = await fetch(basePath + 'cubie_0_0_0.bin', { method: 'HEAD' });

                if (sampleRes.ok) {
                    // Rough estimate: avg size * count? 
                    // Let's just return a flag or null to indicate "Size Unknown" but verify existence.
                    // Or... if we want to be fancy, we can't easily get total size without a manifest.
                    // RETURN NULL implies no size shown.
                    // For the UI, maybe we just want to know it's downloadable.

                    // Hack: If we assume ~50KB per cubie?
                    // Let's return null effectively. The Button shows "Download" without size if null.
                    console.warn("[puzzleCache] binary_v1 format detected. Size estimation skipped for speed.");
                    return null;
                }
            }
            return null;
        } catch (e) {
            console.error("[puzzleCache] getDownloadSize failed:", e);
            return null;
        }
    },

    /**
     * Helper to get a resource from cache or network
     */
    async fetch(request) {
        const cache = await this.open();
        const cached = await cache.match(request);
        if (cached) return cached;
        return fetch(request);
    }
};
