import * as THREE from 'three';
import { StandardCube } from './StandardCube.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { Brush, Evaluator, INTERSECTION } from 'three-bvh-csg';
import { MeshBVH } from 'three-mesh-bvh';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CUBE_SIZE, SPACING } from '../shared/constants.js';
import { state } from '../shared/state.js';
import { puzzleCache } from '../utils/puzzleCache.js';

export class StlPuzzleMod extends StandardCube {
    constructor(config) {
        super(config);
        this.puzzleId = config.puzzleId; // "folder_name"
        this.isLoaded = false;
        this.cubieGeometryCache = new Map();

        this.config.dimensions = { x: 3, y: 3, z: 3 };
    }
    // Attempt to load pre-computed config first
    async loadPrecomputedCubies() {
        try {
            const basePath = `assets/puzzles/${this.puzzleId}/cubies/`;

            const configResponse = await puzzleCache.fetch(new Request(basePath + 'config.json'));

            if (!configResponse.ok) return null; // No pre-computed data found

            const config = await configResponse.json();
            const isBinary = config.format === 'binary_v1';
            const cubies = [];

            // Dimensions check
            if (config.dimensions.x !== this.config.dimensions.x ||
                config.dimensions.y !== this.config.dimensions.y ||
                config.dimensions.z !== this.config.dimensions.z) {
                console.warn("[StlPuzzleMod] Pre-computed dimensions mismatch!");
                return null;
            }

            // Load binaries
            // We know the range from dimensions
            const getRange = (size) => {
                const range = [];
                const offset = (size - 1) / 2;
                for (let i = 0; i < size; i++) {
                    range.push(i - offset);
                }
                return range;
            };
            const xRange = getRange(config.dimensions.x);
            const yRange = getRange(config.dimensions.y);
            const zRange = getRange(config.dimensions.z);

            const promises = [];

            for (let x of xRange) {
                for (let y of yRange) {
                    for (let z of zRange) {
                        const filename = `cubie_${x}_${y}_${z}.bin`;
                        promises.push(
                            puzzleCache.fetch(new Request(basePath + filename))
                                .then(res => {
                                    if (!res.ok) return null;
                                    return res.arrayBuffer();
                                })
                                .then(buffer => {
                                    if (buffer) cubies.push({ x, y, z, buffer });
                                })
                        );
                    }
                }
            }

            await Promise.all(promises);

            return { cubies, config };

        } catch (error) {
            console.warn('[StlPuzzleMod] Could not load pre-computed cubies:', error);
            return null;
        }
    }

    applyPrecomputedCubies(data) {
        // Material Params
        const matConfig = (data.config && data.config.material) || this.puzzleConfig.material || {};

        const roughness = matConfig.roughness !== undefined ? matConfig.roughness : 0.6;
        const metalness = matConfig.metalness !== undefined ? matConfig.metalness : 0.0;
        const normalScale = matConfig.normalScale !== undefined ? matConfig.normalScale : 0.5;
        const useSparkle = matConfig.useSparkle !== undefined ? matConfig.useSparkle : true;

        if (useSparkle && !this.sparkleMap) {
            this.sparkleMap = createSparkleMap();
        }

        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: roughness,
            metalness: metalness
        });

        if (useSparkle) {
            material.normalMap = this.sparkleMap;
            material.normalScale = new THREE.Vector2(normalScale, normalScale);
        }

        // Map cubies to grid
        // Our cubieList corresponds to grid positions.
        // We need to match {x,y,z} from loaded data to the `this.cubieList` logic.

        // This puzzle standard uses:
        // cubieList is flat array, indexed by... well, we iterate createPlaceholders logic.

        // Let's index cubieList by position for easy lookup
        const cubieMap = new Map();
        this.cubieList.forEach(c => {
            // c.initialGridPosition keys?
            // c.userData.gridPos used in StandardCube?
            // Let's check StandardCube... assumming userData.gridPos {x,y,z} exists.
            if (c.userData.gridPos) {
                const k = `${c.userData.gridPos.x}_${c.userData.gridPos.y}_${c.userData.gridPos.z}`;
                cubieMap.set(k, c);
            }
        });

        data.cubies.forEach(cData => {
            const key = `${cData.x}_${cData.y}_${cData.z}`;
            const group = cubieMap.get(key);

            if (group) {
                const geometry = this.parseBinaryGeometry(cData.buffer);

                // Mesh
                const mesh = new THREE.Mesh(geometry, material.clone());

                // Debug Scale
                geometry.computeBoundingBox();


                // The geometry from StlManager is centered (local to cubie).
                // The group is positioned at World Grid Pos.
                // So (0,0,0) is correct.

                group.add(mesh);
            }
        });
    }

    parseBinaryGeometry(buffer) {
        const view = new DataView(buffer);
        let offset = 0;

        const posCount = view.getUint32(offset, true); offset += 4;
        const flags = view.getUint16(offset, true); offset += 2;
        const hasUV = (flags & 1) !== 0;
        const hasColor = (flags & 2) !== 0;

        const geometry = new THREE.BufferGeometry();

        const readAttr = (components) => {
            const count = posCount * components;
            const arr = new Float32Array(count);
            for (let i = 0; i < count; i++) {
                arr[i] = view.getFloat32(offset, true);
                offset += 4;
            }
            return new THREE.BufferAttribute(arr, components);
        };

        geometry.setAttribute('position', readAttr(3));
        geometry.setAttribute('normal', readAttr(3));
        if (hasUV) geometry.setAttribute('uv', readAttr(2));
        if (hasColor) geometry.setAttribute('color', readAttr(3));

        return geometry;
    }

    async loadConfig() {
        const res = await puzzleCache.fetch(new Request(`assets/puzzles/${this.puzzleId}/config.json`));
        if (!res.ok) throw new Error(`Config file not found: assets/puzzles/${this.puzzleId}/config.json`);

        this.puzzleConfig = await res.json();

        // Apply config dims
        this.config.dimensions = this.puzzleConfig.dimensions;
        state.activeDimensions = { ...this.config.dimensions };

        // Enable colors if path exists
        this.colorPath = this.puzzleConfig.colorPath ? `assets/puzzles/${this.puzzleId}/${this.puzzleConfig.colorPath}` : null;
    }

    async createGeometry() {
        state.isAnimating = true;

        // Store old cubies
        const oldCubies = [...this.cubieList];

        // Only use fade transition if we have old cubies (not first load/puzzle switch)
        const useFadeTransition = oldCubies.length > 0 && this.isLoaded;

        if (useFadeTransition) {
            // Set old cubies to fade out slightly (keeps them visible during load)
            oldCubies.forEach(group => {
                group.children.forEach(child => {
                    if (child.material && !child.userData.isHitBox) {
                        child.material.transparent = true;
                        child.material.opacity = 1.0;
                    }
                });
            });
        } else {
            // Immediately clear old cubies for first load or puzzle switching
            oldCubies.forEach(c => {
                c.children.forEach(child => {
                    if (child.parent) child.parent.remove(child);
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
                if (c.parent) c.parent.remove(c);
            });
        }

        // Clear list but keep objects if fading
        this.cubieList.length = 0;

        try {
            await this.loadConfig();
            this.createPlaceholders();

            // Try Pre-Computed Load First
            const preComputed = await this.loadPrecomputedCubies();
            if (preComputed) {
                this.applyPrecomputedCubies(preComputed);
                // Don't set isAnimating = false yet if we are transitioning
            } else {


                const loader = new STLLoader();
                let stlUrl = `assets/puzzles/${this.puzzleId}/${this.puzzleConfig.stlPath}`;

                // Try caching for STL (Blob URL)
                try {
                    const cache = await puzzleCache.open();
                    const cached = await cache.match(stlUrl);
                    if (cached) {
                        const blob = await cached.blob();
                        stlUrl = URL.createObjectURL(blob);
                    }
                } catch (e) {
                    console.warn("Error accessing cache for STL, using network url", e);
                }

                const stlPromise = loader.loadAsync(stlUrl)
                    .then(g => {
                        return g;
                    });

                let colorPromise = Promise.resolve(null);
                if (this.colorPath) {
                    colorPromise = new Promise(async (resolve) => {
                        // Use puzzleCache.fetch manually or just fetch (FileLoader uses XHR/fetch)
                        // Since FileLoader doesn't support custom fetch easily without mod, 
                        // let's fetch text manually and parse.
                        try {
                            const res = await puzzleCache.fetch(new Request(this.colorPath));
                            if (!res.ok) throw new Error("Color file fetch failed");
                            const data = await res.text(); // FileLoader loads text by default usually for JSON
                            try {
                                const parsed = JSON.parse(data);
                                resolve(parsed);
                            } catch (e) {
                                console.error("Color parse error", e);
                                resolve(null);
                            }
                        } catch (err) {
                            console.warn("Failed to load color data", err);
                            resolve(null);
                        }
                    });
                }

                const [geometry, colorData] = await Promise.all([stlPromise, colorPromise]);

                this.colorData = colorData;
                this.processSTL(geometry);
            }

            // Only animate transition if fade is enabled and we have old cubies
            if (useFadeTransition && oldCubies.length > 0) {
                // Animate transition: fade out old, fade in new
                const fadeOutOld = () => {
                    oldCubies.forEach(group => {
                        group.children.forEach(child => {
                            if (child.material && !child.userData.isHitBox) {
                                child.material.opacity = Math.max(0, child.material.opacity - 0.1);
                            }
                        });
                    });
                };

                const fadeInNew = () => {
                    this.cubieList.forEach(group => {
                        group.children.forEach(child => {
                            if (child.material && !child.userData.isHitBox && !child.userData.isPlaceholder) {
                                child.material.opacity = Math.min(1, child.material.opacity + 0.1);
                            }
                        });
                    });
                };

                // Set new cubies to start invisible
                this.cubieList.forEach(group => {
                    group.children.forEach(child => {
                        if (child.material && !child.userData.isHitBox && !child.userData.isPlaceholder) {
                            child.material.transparent = true;
                            child.material.opacity = 0;

                        }
                    });
                });

                // Animate the transition
                const duration = 100; // ms
                const startTime = performance.now();

                const animate = (time) => {
                    const elapsed = time - startTime;
                    let progress = elapsed / duration;
                    if (progress > 1) progress = 1;

                    // Update opacities based on progress
                    oldCubies.forEach(group => {
                        group.children.forEach(child => {
                            if (child.material && !child.userData.isHitBox) {
                                child.material.opacity = 1 - progress;
                            }
                        });
                    });

                    this.cubieList.forEach(group => {
                        group.children.forEach(child => {
                            if (child.material && !child.userData.isHitBox && !child.userData.isPlaceholder) {
                                child.material.opacity = progress;
                            }
                        });
                    });

                    if (progress < 1) {
                        requestAnimationFrame(animate);
                    } else {
                        // Clean up old cubies after fade out
                        oldCubies.forEach(c => {
                            c.children.forEach(child => {
                                if (child.parent) child.parent.remove(child);
                                if (child.geometry) child.geometry.dispose();
                                if (child.material) {
                                    if (Array.isArray(child.material)) {
                                        child.material.forEach(m => m.dispose());
                                    } else {
                                        child.material.dispose();
                                    }
                                }
                            });
                            if (c.parent) c.parent.remove(c);
                        });

                        // Finalize new cubies opacity
                        this.cubieList.forEach(group => {
                            group.children.forEach(child => {
                                if (child.material && !child.userData.isHitBox) {
                                    child.material.opacity = 1;
                                    child.material.transparent = false; // Optional: disable transparency for performance
                                }
                            });
                        });

                        state.isAnimating = false;
                    }
                };
                requestAnimationFrame(animate);
            } else {
                state.isAnimating = false;
            }

        } catch (e) {
            console.error(`[StlPuzzleMod] Failed to load puzzle ${this.puzzleId}:`, e);
            alert(`Failed to load custom puzzle: ${e.message}`);
            state.isAnimating = false;
        }

        this.isLoaded = true;
    }

    createPlaceholders() {
        const S = CUBE_SIZE + this.getSpacing();
        const dim = this.config.dimensions;

        // Generate grid
        const xRange = this.getRange(dim.x);
        const yRange = this.getRange(dim.y);
        const zRange = this.getRange(dim.z);

        for (let x of xRange) {
            for (let y of yRange) {
                for (let z of zRange) {
                    const group = new THREE.Group();
                    group.position.set(x * S, y * S, z * S);

                    // Hitbox
                    const hitGeo = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
                    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                    const hitBox = new THREE.Mesh(hitGeo, hitMat);
                    hitBox.userData.isHitBox = true;
                    group.add(hitBox);

                    group.userData = { isCubie: true, gridPos: { x, y, z } };
                    this.parent.add(group);
                    this.cubieList.push(group);
                }
            }
        }
    }

    getRange(size) {
        const range = [];
        const offset = (size - 1) / 2;
        for (let i = 0; i < size; i++) {
            range.push(i - offset);
        }
        return range;
    }

    processSTL(geometry) {
        // Center Geometry
        geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);

        // Apply Transforms from Config
        const transform = this.puzzleConfig.transform;
        const rad = Math.PI / 180;

        // Rotation
        // Handle legacy single-number rotation (Y-axis only, with implicit -90 X)
        if (typeof transform.rotation === 'number') {
            geometry.rotateX(-90 * rad);
            geometry.rotateY(transform.rotation * rad);
        } else {
            // New 3-axis rotation
            // We apply in XYZ order to match standard Euler
            const r = transform.rotation || { x: -90, y: 0, z: 0 };
            geometry.rotateX(r.x * rad);
            geometry.rotateY(r.y * rad);
            geometry.rotateZ(r.z * rad);
        }

        // Scale
        // In Manager: UNIT=3. In Game: CUBE_SIZE=1.
        // We want visual matching -> Game Scale = Manager Scale / 3.
        const s = (transform.scale !== undefined ? transform.scale : 1) / 3;
        geometry.scale(s, s, s);

        // Offset (After scale to match Manager 'Position' logic)
        if (transform.offset) {
            const o = transform.offset;
            // Scale offset by 1/3 to match world unit difference
            geometry.translate(o.x / 3, o.y / 3, o.z / 3);
        }

        // Colors
        if (this.colorData) {
            const count = geometry.attributes.position.count;
            if (count === this.colorData.length / 3) {
                geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.colorData), 3));
            }
        }

        geometry.computeVertexNormals();

        // Compute UVs for Normal Map (Box Projection)
        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox;
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const min = bbox.min;

        const posAttr = geometry.attributes.position;
        const normAttr = geometry.attributes.normal;
        const uvAttr = new THREE.BufferAttribute(new Float32Array(posAttr.count * 2), 2);

        for (let i = 0; i < posAttr.count; i++) {
            const x = posAttr.getX(i);
            const y = posAttr.getY(i);
            const z = posAttr.getZ(i);

            const nx = Math.abs(normAttr.getX(i));
            const ny = Math.abs(normAttr.getY(i));
            const nz = Math.abs(normAttr.getZ(i));

            let u = 0, v = 0;
            if (nx >= ny && nx >= nz) { u = (z - min.z) / size.z; v = (y - min.y) / size.y; }
            else if (ny >= nx && ny >= nz) { u = (x - min.x) / size.x; v = (z - min.z) / size.z; }
            else { u = (x - min.x) / size.x; v = (y - min.y) / size.y; }

            uvAttr.setXY(i, u, v);
        }
        geometry.setAttribute('uv', uvAttr);

        // Update bounds after all transforms to verify scale
        geometry.computeBoundingBox();

        // CSG Setup
        const evaluator = new Evaluator();
        evaluator.attributes = Object.keys(geometry.attributes);
        const sourceBVH = new MeshBVH(geometry);

        // Material Params
        const matConfig = this.puzzleConfig.material || {};
        const roughness = matConfig.roughness !== undefined ? matConfig.roughness : 0.6;
        const metalness = matConfig.metalness !== undefined ? matConfig.metalness : 0.0;
        const normalScale = matConfig.normalScale !== undefined ? matConfig.normalScale : 0.5;
        const useSparkle = matConfig.useSparkle !== undefined ? matConfig.useSparkle : true;

        if (useSparkle && !this.sparkleMap) {
            this.sparkleMap = createSparkleMap();
        }

        const material = new THREE.MeshStandardMaterial({
            color: this.colorData ? 0xFFFFFF : 0x74C947,
            vertexColors: !!this.colorData,
            roughness: roughness,
            metalness: metalness
        });

        if (useSparkle) {
            material.normalMap = this.sparkleMap;
            material.normalScale = new THREE.Vector2(normalScale, normalScale);
        }

        const sourceBrush = new Brush(geometry, material);
        sourceBrush.updateMatrixWorld();

        // Cut Pieces
        const fillet = (this.puzzleConfig.cut && this.puzzleConfig.cut.filletRadius) || 0.14;

        let createdCount = 0;

        let isFirst = true;

        this.cubieList.forEach(group => {
            const { x, y, z } = group.userData.gridPos;

            // Bounding Box Logic (Adaptive for outer pieces)
            const halfSize = CUBE_SIZE / 2;
            let bounds = { xMin: -halfSize, xMax: halfSize, yMin: -halfSize, yMax: halfSize, zMin: -halfSize, zMax: halfSize };
            const outerScale = 10.0; // Increased to ensure no cropping of large external geometry

            // X
            if (x <= this.getRange(this.config.dimensions.x)[0]) bounds.xMin *= outerScale;
            if (x >= this.getRange(this.config.dimensions.x).slice(-1)[0]) bounds.xMax *= outerScale;
            // Y
            if (y <= this.getRange(this.config.dimensions.y)[0]) bounds.yMin *= outerScale;
            if (y >= this.getRange(this.config.dimensions.y).slice(-1)[0]) bounds.yMax *= outerScale;
            // Z
            if (z <= this.getRange(this.config.dimensions.z)[0]) bounds.zMin *= outerScale;
            if (z >= this.getRange(this.config.dimensions.z).slice(-1)[0]) bounds.zMax *= outerScale;

            const w = bounds.xMax - bounds.xMin;
            const h = bounds.yMax - bounds.yMin;
            const d = bounds.zMax - bounds.zMin;

            const xc = (bounds.xMin + bounds.xMax) / 2;
            const yc = (bounds.yMin + bounds.yMax) / 2;
            const zc = (bounds.zMin + bounds.zMax) / 2;

            let boxGeo;
            if (fillet > 0) boxGeo = new RoundedBoxGeometry(w, h, d, 4, fillet);
            else boxGeo = new THREE.BoxGeometry(w, h, d);

            boxGeo.translate(xc, yc, zc);

            // CSG requires attributes to match exactly between source and brush.

            // 0. Ensure boxGeo is non-indexed if geometry is (usually STL is non-indexed)
            if (!geometry.index && boxGeo.index) {
                boxGeo = boxGeo.toNonIndexed();
            }

            // 1. Remove attributes from boxGeo that are not in geometry
            for (const key in boxGeo.attributes) {
                if (!geometry.attributes[key]) {
                    boxGeo.deleteAttribute(key);
                }
            }

            // 2. Add attributes to boxGeo that are in geometry but missing in boxGeo
            for (const key in geometry.attributes) {
                if (!boxGeo.attributes[key]) {
                    const srcAttr = geometry.attributes[key];
                    const count = boxGeo.attributes.position.count;
                    const itemSize = srcAttr.itemSize;
                    const arr = new Float32Array(count * itemSize);

                    if (key === 'color') arr.fill(1); // Default white for color
                    else arr.fill(0); // Default 0 for others

                    boxGeo.setAttribute(key, new THREE.BufferAttribute(arr, itemSize));
                }
            }

            const boxBrush = new Brush(boxGeo);
            boxBrush.position.set(x * CUBE_SIZE, y * CUBE_SIZE, z * CUBE_SIZE);
            boxBrush.updateMatrixWorld();

            const result = evaluator.evaluate(sourceBrush, boxBrush, INTERSECTION);

            if (result.geometry && result.geometry.attributes.position.count > 0) {
                createdCount++;
                // Color interpolation
                const resGeom = result.geometry;

                // Center geometry in local space (undo boxBrush position)
                // The group itself will handle the grid position (including spacing)
                resGeom.translate(-x * CUBE_SIZE, -y * CUBE_SIZE, -z * CUBE_SIZE);

                if (geometry.attributes.color) {
                    // Apply Barycentric interpolation
                    // ... (We skip full barycentric here for brevity/performance in MVP unless simple copy works)
                    // Actually, StlPainter logic is complex. 
                    // For MVP, three-bvh-csg might preserve colors reasonably well if attributes align?
                    // No, typically needs re-projection.
                    // Let's rely on basic CSG attribute transfer first. If it looks bad, we add the BVH projection.
                    // Update: three-bvh-csg interpolates attributes automatically if they exist on both brushes!
                    // I added 'color' to boxBrush, so it should interpolate white (box) vs color (model).
                    // The intersection keeps the 'source' color usually on the surface.
                }

                const mesh = new THREE.Mesh(resGeom, material);
                group.add(mesh);
            }
        });

        if (createdCount === 0) {
            console.warn("[StlPuzzleMod] WARNING: No pieces were created! Check geometry transform/scale vs cut grid.");
        }
    }

    isSolved() {
        // For STL Puzzles (Shape Mods), we treat them as "Super Cubes" where every piece 
        // has a unique correct position and orientation.
        // Since the whole puzzle can be rotated in 24 possible valid orientations,
        // we check if the current state matches ANY of these 24 "Solved" states.

        const S = CUBE_SIZE + this.getSpacing();
        const epsilon = 0.1; // Tolerance for position (floating point drift)
        const angleEpsilon = 0.1; // Tolerance for rotation (radians)

        // Generate the 24 valid rotations (if not already cached)
        if (!StlPuzzleMod.validRotations) {
            StlPuzzleMod.validRotations = this.generateValidRotations();
        }

        // Check each of the 24 global orientations
        for (const globalQuat of StlPuzzleMod.validRotations) {
            let matches = true;

            for (const group of this.cubieList) {
                const { x, y, z } = group.userData.gridPos;

                // 1. Calculate Expected Position in this Global Orientation
                // Original Pos (unrotated)
                const originalPos = new THREE.Vector3(x * S, y * S, z * S);
                // Expected Pos = OriginalPos applied by GlobalQuat
                const expectedPos = originalPos.clone().applyQuaternion(globalQuat);

                // Check Position Distance
                if (group.position.distanceTo(expectedPos) > epsilon) {
                    matches = false;
                    break;
                }

                // 2. Check Orientation
                // For a Super Cube, the piece orientation must match the Global Orientation exactly.
                // angleTo calculates the shortest angle between two quaternions.
                if (group.quaternion.angleTo(globalQuat) > angleEpsilon) {
                    matches = false;
                    break;
                }
            }

            if (matches) {
                // Found a matching valid orientation! The puzzle is solved.

                return true;
            }
        }

        return false;
    }

    generateValidRotations() {
        const rotations = [];
        const axes = [
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, 0, 1)
        ];

        // Basic 90 degree increments
        const angles = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

        // Brute force generation of 24 orientations
        // We can generate them by combining rotations around X, Y, Z.
        // A minimal set of generators is X and Y. 
        // But iterating all combinations needs deduping.

        const seen = new Set();
        const queue = [new THREE.Quaternion()]; // Start identity

        // BFS to find all 24 unique rotations
        let head = 0;
        while (head < queue.length) {
            const current = queue[head++];

            // Check if seen (using simplified string key for approx equality)
            const key = this.quatKey(current);
            if (seen.has(key)) continue;
            seen.add(key);
            rotations.push(current);

            if (rotations.length >= 24) break;

            // Apply 90 deg rotations on X and Y as generators
            const rotX = new THREE.Quaternion().setFromAxisAngle(axes[0], Math.PI / 2);
            const rotY = new THREE.Quaternion().setFromAxisAngle(axes[1], Math.PI / 2);
            const rotZ = new THREE.Quaternion().setFromAxisAngle(axes[2], Math.PI / 2); // redundancy but helpful

            const nextX = current.clone().multiply(rotX).normalize();
            queue.push(nextX);

            const nextY = current.clone().multiply(rotY).normalize();
            queue.push(nextY);

            const nextZ = current.clone().multiply(rotZ).normalize();
            queue.push(nextZ);
        }

        return rotations;
    }

    quatKey(q) {
        // Round for deduping
        const p = 100;
        const x = Math.round(q.x * p);
        const y = Math.round(q.y * p);
        const z = Math.round(q.z * p);
        const w = Math.round(q.w * p);
        // Quaternion double cover: q == -q. Canonize by forcing w (or first non-zero) positive
        if (w < 0 || (w === 0 && z < 0) || (w === 0 && z === 0 && y < 0) || (w === 0 && z === 0 && y === 0 && x < 0)) {
            return `${-x},${-y},${-z},${-w}`;
        }
        return `${x},${y},${z},${w}`;
    }
}

function createSparkleMap(maxDim = 3) {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const noiseScale = Math.max(1, maxDim / 4);
    const noiseSize = Math.floor(size / noiseScale);

    const noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = noiseSize;
    noiseCanvas.height = noiseSize;
    const noiseCtx = noiseCanvas.getContext('2d');

    noiseCtx.fillStyle = 'rgb(128, 128, 255)';
    noiseCtx.fillRect(0, 0, noiseSize, noiseSize);

    const imgData = noiseCtx.getImageData(0, 0, noiseSize, noiseSize);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
        const strength = 60;
        const noiseX = (Math.random() - 0.5) * strength;
        const noiseY = (Math.random() - 0.5) * strength;

        data[i] = Math.min(255, Math.max(0, 128 + noiseX));
        data[i + 1] = Math.min(255, Math.max(0, 128 + noiseY));
        data[i + 2] = 255;
    }

    noiseCtx.putImageData(imgData, 0, 0);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(noiseCanvas, 0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;

    if (state.renderer) {
        tex.anisotropy = state.renderer.capabilities.getMaxAnisotropy();
    }

    return tex;
}
