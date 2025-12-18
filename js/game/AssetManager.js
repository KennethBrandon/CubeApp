
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { puzzleCache } from '../utils/puzzleCache.js'; // Fallback / Web behavior

const REMOTE_BASE_URL = 'https://cube.redkb.com/';

class AssetManager {
    constructor() {
        this.registry = null;
        this.initPromise = null;
    }

    async init() {
        if (this.initPromise) return this.initPromise;
        this.initPromise = (async () => {
            // Load registry
            const res = await fetch('assets/puzzles/registry.json');
            this.registry = await res.json();
        })();
        return this.initPromise;
    }

    getPuzzleEntry(puzzleId) {
        if (!this.registry) return null;
        return this.registry.find(p => p.id === puzzleId || (!p.id && p.name.toLowerCase().replace(/ /g, '_') === puzzleId));
    }

    /**
     * Check if a puzzle needs downloading.
     * @param {string} puzzleId 
     * @returns {Promise<boolean>}
     */
    async isRemoteAndMissing(puzzleId) {
        await this.init();
        const entry = this.getPuzzleEntry(puzzleId);
        if (!entry || !entry.isRemote) return false;

        if (Capacitor.isNativePlatform()) {
            // Check if directory exists in Filesystem
            try {
                // We check if the folder exists. 
                // A better check would be a "complete" marker file.
                // For now, check folder.
                const stat = await Filesystem.stat({
                    path: `puzzles/${puzzleId}`,
                    directory: Directory.Data
                });
                return false; // It exists, so not missing
            } catch (e) {
                return true; // Missing
            }
        } else {
            // On Web, check if it's cached in CacheStorage
            const isCached = await puzzleCache.checkIfCached(puzzleId);
            return !isCached;
        }
    }

    /**
     * Get the fetchable URL for a resource.
     * @param {string} localPath - relative path e.g. "assets/puzzles/grinch/grinch.stl"
     * @returns {Promise<string>} - The URL to use for fetch/loader
     */
    async getUrl(localPath) {
        await this.init();

        // Extract puzzleId from path: assets/puzzles/{id}/...
        const match = localPath.match(/assets\/puzzles\/([^\/]+)\//);
        if (!match) return localPath; // Not a puzzle asset?

        const puzzleId = match[1];
        const entry = this.getPuzzleEntry(puzzleId);

        if (entry && entry.isRemote) {
            if (Capacitor.isNativePlatform()) {
                // Check if file is in Filesystem
                try {
                    // Map "assets/puzzles/grinch/foo.stl" -> "puzzles/grinch/foo.stl"
                    const fsPath = localPath.replace('assets/', '');
                    const uri = await Filesystem.getUri({
                        path: fsPath,
                        directory: Directory.Data
                    });
                    return Capacitor.convertFileSrc(uri.uri);
                } catch (e) {
                    // Not downloaded on Native -> Return Remote URL
                    // This allows "Play from Cloud" if we want, but usually UI prevents this via isRemoteAndMissing
                    // But StlPuzzleMod will use this URL.
                    return new URL(localPath, REMOTE_BASE_URL).href;
                }
            } else {
                // On Web, if it is marked remote, we assume it's NOT in the local build.
                // So we must fetch it from the remote CDN/Server.
                return new URL(localPath, REMOTE_BASE_URL).href;
            }
        }

        return localPath;
    }

    /**
     * Replacement for puzzleCache.fetch
     * Intercepts requests for puzzle assets.
     */
    async fetch(request) {
        const url = request.url;
        // Check if this is a puzzle asset
        if (url.includes('assets/puzzles/')) {
            // We need to resolve the URL to filesystem if applicable
            // But request.url is absolute.
            // We need relative path "assets/puzzles/..."
            const relative = url.split(window.location.host + '/').pop().split('?')[0]; // simple hack
            // Better: use URL object
            const u = new URL(url);
            const path = u.pathname.substring(1); // remove leading /

            const resolved = await this.getUrl(path);

            // If getUrl returned a filesystem URL or http URL, fetch it.
            return fetch(resolved);
        }

        // Fallback to default fetch
        return fetch(request);
    }

    /**
     * Download puzzle assets to filesystem.
     * @param {string} puzzleId 
     * @param {function} onProgress (0-1)
     */
    async downloadPuzzle(puzzleId, onProgress) {
        await this.init();

        // 1. Get List of files (Reuse logic from puzzleCache but adapted)
        // We initially need config.json. 
        // We'll fetch it from REMOTE directly first to parse dependencies.

        const puzzlePath = `assets/puzzles/${puzzleId}`;
        const configUrl = new URL(`${puzzlePath}/config.json`, REMOTE_BASE_URL).href;

        console.log(`[AssetManager] Fetching config from ${configUrl}`);

        const configRes = await fetch(configUrl);
        if (!configRes.ok) throw new Error("Failed to fetch remote config");
        const config = await configRes.json();

        // Build File List
        const files = [`${puzzlePath}/config.json`];

        // Main Model
        if (config.stlPath) {
            files.push(`${puzzlePath}/${config.stlPath}`);
        }

        // Precomputed Cubies
        // If explicitly set OR if stlPath is missing (implies binary or default file, we try both or assume binary)
        const useBinaries = config.format === 'binary_v1' || !config.stlPath;

        if (useBinaries && config.dimensions) {
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
                        files.push(`${puzzlePath}/cubies/cubie_${x}_${y}_${z}.bin`);
                    }
                }
            }
        }

        // Colors
        if (config.colorPath) {
            files.push(`${puzzlePath}/${config.colorPath}`);
        }

        // Thumbnail
        // files.push(`${puzzlePath}/thumbnail.png`); // Usually bundled? But good to have.

        // 2. Download files
        let completed = 0;
        const total = files.length;

        // Create directory
        if (Capacitor.isNativePlatform()) {
            try {
                await Filesystem.mkdir({
                    path: `puzzles/${puzzleId}`,
                    directory: Directory.Data,
                    recursive: true
                });
                // Also cubies subdir if needed
                if (config.format === 'binary_v1' || !config.stlPath) {
                    await Filesystem.mkdir({
                        path: `puzzles/${puzzleId}/cubies`,
                        directory: Directory.Data,
                        recursive: true
                    });
                }
            } catch (e) {
                // Ignore if exists
            }
        } else {
            // Web: Use puzzleCache
            // puzzleCache already handles config fetching, so we can just delegate.
            // But puzzleCache expects to fetch from local assets or remote?
            // puzzleCache usually fetches from current origin.
            // We need it to fetch from REMOTE_BASE_URL if it's remote.
            // Wait, puzzleCache.downloadPuzzle uses fetch(url). 
            // If we rely on AssetManager.getUrl (which returns remote URL for web), 
            // puzzleCache will fetch from remote.
            // Let's modify puzzleCache to handle explicit remote URLs?
            // OR, just let AssetManager handle the download loop for Web too, but put in CacheStorage?

            // Simplest: Call puzzleCache.downloadPuzzle. 
            // IMPORTANT: puzzleCache logic assumes paths relative to `assets/puzzles/...`.
            // If we want it to fetch from remote, we might need to trick it or update it.

            // Actually, the new AssetManager.fetch() intercepts requests!
            // So if puzzleCache fetches `assets/puzzles/grinch/config.json`, 
            // AssetManager.fetch (via ServiceWorker? No, assuming runtime interception)
            // Wait, puzzleCache uses `fetch()`. 
            // AssetManager.fetch is a method, not a global override (unless we swizzled it, which we didn't).

            // Strategies:
            // 1. Update puzzleCache.downloadPuzzle to take a baseUrl.
            // 2. Just implement Web caching here in AssetManager using Cache API directly.

            console.log("[AssetManager] Web download: delegating to puzzleCache logic here.");
        }

        const batchSize = 3;
        const cache = !Capacitor.isNativePlatform() ? await puzzleCache.open() : null;

        for (let i = 0; i < total; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            await Promise.all(batch.map(async (filePath) => {
                const remoteUrl = new URL(filePath, REMOTE_BASE_URL).href;
                const fsPath = filePath.replace('assets/', ''); // Remove assets/ prefix for local storage

                if (Capacitor.isNativePlatform()) {
                    // Download to Filesystem
                    try {
                        const fRes = await fetch(remoteUrl);
                        const blob = await fRes.blob();
                        const base64 = await this.blobToBase64(blob);

                        await Filesystem.writeFile({
                            path: fsPath,
                            directory: Directory.Data,
                            data: base64,
                            recursive: true
                        });

                    } catch (e) {
                        console.error(`Failed to download ${remoteUrl}`, e);
                        throw e;
                    }
                } else {
                    // Web: Cache it
                    try {
                        // Fetch from REMOTE (ignoring local 404s)
                        // We use the same constructed remoteUrl
                        const req = new Request(remoteUrl);
                        const res = await fetch(req);
                        if (res.ok) {
                            // We need to store it in cache as the LOCAL URL so subsequent fetches find it?
                            // Or does the app strictly use getUrl()?
                            // App uses getUrl(). getUrl() on web returns REMOTE URL.
                            // So we should cache with REMOTE URL as key.

                            // wait, getUrl() on Web returns:
                            // return new URL(localPath, REMOTE_BASE_URL).href;
                            // So yes, cache under the remote URL.
                            await cache.put(req, res);
                        }
                    } catch (e) {
                        console.error("Web cache failed", e);
                    }
                }
            }));

            completed += batch.length;
            if (onProgress) onProgress(completed / total);
        }
    }

    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = () => {
                resolve(reader.result.split(',')[1]); // remove data:application/octet-stream;base64,
            };
            reader.readAsDataURL(blob);
        });
    }
}

export const assetManager = new AssetManager();
