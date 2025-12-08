import * as THREE from 'three';
import { StandardCube } from './StandardCube.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { Brush, Evaluator, INTERSECTION } from 'three-bvh-csg';
import { MeshBVH } from 'three-mesh-bvh';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CUBE_SIZE, SPACING } from '../shared/constants.js';
import { state } from '../shared/state.js';
import { playCubeAnimation } from '../animations/transitions.js';

export class TheChildMod extends StandardCube {
    constructor(config) {
        super(config);
        this.config.dimensions = { x: 2, y: 3, z: 2 };
        this.isLoaded = false;
        this.spacing = 0.005; // Default spacing
        this.cubieGeometryCache = new Map(); // Cache for processed cubie geometries
        this.showTouchTargets = false; // Show touch target outlines
        this.touchTargetScale = 1.8; // Scale factor for touch targets
    }

    async createGeometry() {
        // Prevent moves from executing while geometry is loading
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

        // Clear the cubie list to prepare for new geometry
        this.cubieList.length = 0;

        state.activeDimensions = { ...this.config.dimensions };

        // Create placeholder cubies first (invisible or simple boxes)
        this.createPlaceholders();

        // Try loading pre-computed cubies first
        const precomputedCubies = await this.loadPrecomputedCubies();

        if (precomputedCubies) {
            console.log('[TheChildMod] Using pre-computed cubies!');
            this.applyPrecomputedCubies(precomputedCubies);
        } else {
            console.log('[TheChildMod] No pre-computed cubies found, falling back to CSG computation');

            // Check if we already have the geometry cached
            if (this.originalGeometry) {
                // Synchronous rebuild - prevents flash
                this.processSTL(this.originalGeometry, null, null, { x: 2.71, y: 1.53, z: -2.38 });
            } else {
                // Load the STL and Colors (Async)
                const loader = new STLLoader();
                const fileLoader = new THREE.FileLoader();

                try {
                    const [geometry, colorData] = await Promise.all([
                        new Promise((resolve, reject) => loader.load('assets/3d/baby_yoda_detailed.stl', resolve, undefined, reject)),
                        new Promise((resolve) => {
                            fileLoader.load('assets/3d/baby_yoda_detailed_colors.json',
                                (data) => resolve(JSON.parse(data)),
                                undefined,
                                () => resolve(null) // Resolve null if file doesn't exist
                            );
                        })
                    ]);

                    this.colorData = colorData; // Store for re-processing
                    this.processSTL(geometry, null, null, { x: 2.71, y: 1.53, z: -2.38 });
                } catch (error) {
                    console.error('Error loading Baby Yoda assets:', error);
                }
            }
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
            let frame = 0;
            const maxFrames = 10;
            const animate = () => {
                if (frame < maxFrames) {
                    fadeOutOld();
                    fadeInNew();
                    frame++;
                    requestAnimationFrame(animate);
                } else {
                    // Clean up old cubies after fade out
                    oldCubies.forEach(c => {
                        c.children.forEach(child => {
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

                    // Reset opacity to 1 and disable transparency for performance
                    this.cubieList.forEach(group => {
                        group.children.forEach(child => {
                            if (child.material && !child.userData.isHitBox && !child.userData.isPlaceholder) {
                                child.material.opacity = 1;
                                child.material.transparent = false;
                            }
                        });
                    });
                }
            };

            requestAnimationFrame(animate);
        }

        // Geometry is now fully loaded, allow moves to execute
        state.isAnimating = false;
    }

    createPlaceholders() {
        // Dimensions are 2x3x2. 
        // We need to center them.
        // x goes from -0.5 to 0.5 (2 items)
        // y goes from -1 to 1 (3 items)
        // z goes from -0.5 to 0.5 (2 items)

        const S = CUBE_SIZE + this.getSpacing();

        // X range: 2 items. Indices 0, 1. Center is 0.5.
        // Offsets: -0.5, 0.5.

        // Y range: 3 items. Indices 0, 1, 2. Center is 1.
        // Offsets: -1, 0, 1.

        // Z range: 2 items. Indices 0, 1. Center is 0.5.
        // Offsets: -0.5, 0.5.

        const xRange = [-0.5, 0.5];
        const yRange = [-1, 0, 1];
        const zRange = [-0.5, 0.5];

        for (let x of xRange) {
            for (let y of yRange) {
                for (let z of zRange) {
                    const group = new THREE.Group();
                    group.position.set(x * S, y * S, z * S);

                    // Invisible hit box for interaction
                    const hitGeo = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
                    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                    const hitBox = new THREE.Mesh(hitGeo, hitMat);
                    hitBox.userData.isHitBox = true;
                    group.add(hitBox);

                    // Touch target outline (wireframe)
                    const outlineGeo = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
                    const outlineMat = new THREE.MeshBasicMaterial({
                        color: 0x00ff00,
                        wireframe: true,
                        visible: this.showTouchTargets,
                        depthTest: false  // Render on top
                    });
                    const outline = new THREE.Mesh(outlineGeo, outlineMat);
                    outline.userData.isTouchTargetOutline = true;
                    outline.renderOrder = 999; // Render after everything else
                    outline.scale.set(1.01, 1.01, 1.01); // Slightly larger to be visible outside geometry
                    group.add(outline);

                    group.userData = { isCubie: true, gridPos: { x, y, z }, hitBox, outline };
                    this.parent.add(group);
                    this.cubieList.push(group);
                }
            }
        }
    }

    async loadPrecomputedCubies() {
        try {
            const basePath = 'assets/3d/cubies/baby_yoda_detailed/';

            // Try to load config first to check if precomputed files exist
            const configResponse = await fetch(basePath + 'config.json');
            if (!configResponse.ok) {
                return null; // Config doesn't exist, no precomputed files
            }

            const config = await configResponse.json();
            console.log('[TheChildMod] Found pre-computed cubie config:', config);

            const isBinary = config.format === 'binary_v1';
            const extension = isBinary ? '.bin' : '.json';

            // Load all 12 cubie files
            const xRange = [-0.5, 0.5];
            const yRange = [-1, 0, 1];
            const zRange = [-0.5, 0.5];
            const cubies = new Map();

            const loadPromises = [];
            for (let x of xRange) {
                for (let y of yRange) {
                    for (let z of zRange) {
                        const filename = `cubie_${x}_${y}_${z}${extension}`;
                        const promise = fetch(basePath + filename)
                            .then(response => {
                                if (!response.ok) throw new Error(`Failed to load ${filename}`);
                                return isBinary ? response.arrayBuffer() : response.json();
                            })
                            .then(data => {
                                const key = `${x},${y},${z}`;
                                if (isBinary) {
                                    // Parse binary data
                                    cubies.set(key, this.parseBinaryCubie(data));
                                } else {
                                    cubies.set(key, data);
                                }
                            });
                        loadPromises.push(promise);
                    }
                }
            }

            await Promise.all(loadPromises);
            console.log(`[TheChildMod] Loaded ${cubies.size} pre-computed cubies (${isBinary ? 'binary' : 'JSON'} format)`);

            return { cubies, config };
        } catch (error) {
            console.log('[TheChildMod] Could not load pre-computed cubies:', error.message);
            return null;
        }
    }

    parseBinaryCubie(arrayBuffer) {
        const view = new DataView(arrayBuffer);
        let offset = 0;

        // Read header
        const vertexCount = view.getUint32(offset, true);
        offset += 4;

        const flags = view.getUint16(offset, true);
        offset += 2;

        const hasUV = (flags & 1) !== 0;
        const hasColor = (flags & 2) !== 0;

        // Read position data
        const position = new Float32Array(vertexCount * 3);
        for (let i = 0; i < vertexCount * 3; i++) {
            position[i] = view.getFloat32(offset, true);
            offset += 4;
        }

        // Read normal data
        const normal = new Float32Array(vertexCount * 3);
        for (let i = 0; i < vertexCount * 3; i++) {
            normal[i] = view.getFloat32(offset, true);
            offset += 4;
        }

        // Read UV data if present
        let uv = null;
        if (hasUV) {
            uv = new Float32Array(vertexCount * 2);
            for (let i = 0; i < vertexCount * 2; i++) {
                uv[i] = view.getFloat32(offset, true);
                offset += 4;
            }
        }

        // Read color data if present
        let color = null;
        if (hasColor) {
            color = new Float32Array(vertexCount * 3);
            for (let i = 0; i < vertexCount * 3; i++) {
                color[i] = view.getFloat32(offset, true);
                offset += 4;
            }
        }

        return {
            attributes: {
                position: Array.from(position),
                normal: Array.from(normal),
                uv: uv ? Array.from(uv) : null,
                color: color ? Array.from(color) : null
            },
            metadata: {
                vertexCount: vertexCount
            }
        };
    }

    applyPrecomputedCubies(precomputedData) {
        const { cubies, config } = precomputedData;
        const S = CUBE_SIZE + this.getSpacing();

        // Use Sparkle Map
        if (!this.sparkleMap) {
            this.sparkleMap = createSparkleMap();
        }

        const roughness = this.currentRoughness !== undefined ? this.currentRoughness : 0.6;
        const metalness = this.currentMetalness !== undefined ? this.currentMetalness : 0.46;
        const normalScale = this.currentNormalScale !== undefined ? this.currentNormalScale : 0.5;

        const material = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            vertexColors: true,
            roughness: roughness,
            metalness: metalness,
            normalMap: this.sparkleMap,
            normalScale: new THREE.Vector2(normalScale, normalScale)
        });

        // y rotation quaternion (+90 degrees, not y')
        const yRotation = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            Math.PI / 2
        );

        this.cubieList.forEach(group => {
            const { x, y, z } = group.userData.gridPos;

            // Apply y' rotation to grid position (rotate position around Y axis)
            // y' means -90 degrees around Y: (x, y, z) -> (z, y, -x)
            const rotatedX = z;
            const rotatedY = y;
            const rotatedZ = -x;

            const key = `${x},${y},${z}`;
            const cubieData = cubies.get(key);

            if (!cubieData) {
                console.warn(`[TheChildMod] Missing precomputed data for cubie ${key}`);
                return;
            }

            // Create geometry from pre-computed data
            const geometry = new THREE.BufferGeometry();

            geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cubieData.attributes.position), 3));
            geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(cubieData.attributes.normal), 3));

            if (cubieData.attributes.uv) {
                geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(cubieData.attributes.uv), 2));
            }

            if (cubieData.attributes.color) {
                geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cubieData.attributes.color), 3));
            }

            // Create mesh
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(-x * CUBE_SIZE, -y * CUBE_SIZE, -z * CUBE_SIZE);

            // Set group position using rotated coordinates and apply rotation
            group.position.set(rotatedX * S, rotatedY * S, rotatedZ * S);
            group.quaternion.copy(yRotation);
            group.updateMatrix();
            group.updateMatrixWorld(true);

            // Remove existing meshes (but keep hitbox and outline)
            for (let i = group.children.length - 1; i >= 0; i--) {
                const child = group.children[i];
                if (!child.userData.isPlaceholder && !child.userData.isHitBox && !child.userData.isTouchTargetOutline) {
                    if (child.geometry) child.geometry.dispose();
                    group.remove(child);
                }
            }

            group.add(mesh);
        });

        this.isLoaded = true;

        if (state.renderer && state.scene && state.camera) {
            state.renderer.render(state.scene, state.camera);
        }
    }

    processSTL(geometry, scaleOverride = null, spacingOverride = null, offsetOverride = null) {
        // Store original geometry for re-processing
        if (!this.originalGeometry) {
            this.originalGeometry = geometry.clone();
        } else if (geometry !== this.originalGeometry) {
            this.originalGeometry = geometry.clone();
        } else {
            geometry = this.originalGeometry.clone();
        }

        // 1. Center and Scale the Geometry
        geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);

        // Fix Orientation: Rotate -90 degrees on X axis if needed (standard for many STLs)
        geometry.rotateX(-Math.PI / 2);

        // Rotate if needed (around Y-axis)
        const rotationY = this.currentRotation !== undefined ? this.currentRotation : -45;
        if (rotationY !== 0) {
            geometry.rotateY(rotationY * Math.PI / 180); // Convert degrees to radians
        }

        // Apply Offset (User Preference)
        if (offsetOverride) {
            geometry.translate(offsetOverride.x, offsetOverride.y, offsetOverride.z);
        }

        const size = new THREE.Vector3();
        geometry.boundingBox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);

        // Scale to fit 3x2x2 area
        // Max dimension is 3 * CUBE_SIZE (approx)
        const targetScale = scaleOverride !== null ? scaleOverride : 3.35; // Slightly larger for 3x2x2
        const targetSize = targetScale * CUBE_SIZE;
        const scale = targetSize / maxDim;
        geometry.scale(scale, scale, scale);

        // Update bounding box after scale
        geometry.computeBoundingBox();

        // Ensure attributes match BoxGeometry (position, normal)
        if (!geometry.attributes.normal) {
            geometry.computeVertexNormals();
        }

        // Generate UVs for Normal Map
        this.applyBoxUV(geometry);

        // Apply Colors if loaded
        if (this.colorData) {
            const count = geometry.attributes.position.count;
            const colorDataArray = new Float32Array(this.colorData);
            console.log(`[TheChildMod] Loaded color data. Vertices: ${count}, Color entries: ${colorDataArray.length / 3}`);
            // Ensure color data matches vertex count (simple check)
            if (count === colorDataArray.length / 3) {
                geometry.setAttribute('color', new THREE.BufferAttribute(colorDataArray, 3));
                console.log('[TheChildMod] Color attribute applied successfully.');
            } else {
                console.warn('[TheChildMod] Vertex count mismatch! Colors not applied.');
                // Remove incompatible attributes (color) if no data
                geometry.deleteAttribute('color');
            }
        } else {
            // Remove incompatible attributes (color) if no data
            geometry.deleteAttribute('color');
        }

        // Convert to Brush for CSG
        // Use Sparkle Map
        if (!this.sparkleMap) {
            this.sparkleMap = createSparkleMap();
        }

        // Use current params or defaults
        const roughness = this.currentRoughness !== undefined ? this.currentRoughness : 0.6;
        const metalness = this.currentMetalness !== undefined ? this.currentMetalness : 0.46;
        const normalScale = this.currentNormalScale !== undefined ? this.currentNormalScale : 0.5;

        const material = new THREE.MeshStandardMaterial({
            color: this.colorData ? 0xFFFFFF : 0x74C947, // White if vertex colors, else Yoda Green
            vertexColors: !!this.colorData && geometry.attributes.color !== undefined,
            roughness: roughness,
            metalness: metalness,
            normalMap: this.sparkleMap,
            normalScale: new THREE.Vector2(normalScale, normalScale)
        });

        const sourceBrush = new Brush(geometry, material);
        sourceBrush.updateMatrixWorld();

        // 2. Slice into pieces
        const newGap = spacingOverride !== null ? spacingOverride : this.getSpacing();
        const S_new = CUBE_SIZE + newGap;

        // Old Gap (for ratio calculation)
        const oldGap = this.currentSpacing !== undefined ? this.currentSpacing : this.getSpacing();
        const S_old = CUBE_SIZE + oldGap;

        // Handle Spacing Update on Groups
        if (this.isLoaded) {
            if (Math.abs(newGap - oldGap) > 0.0001) {
                const ratio = S_new / S_old;
                this.cubieList.forEach(group => {
                    group.position.multiplyScalar(ratio);
                    group.updateMatrix();
                    group.updateMatrixWorld(true);
                });
            }
        }

        this.currentSpacing = newGap;

        this.currentSpacing = newGap;

        const boxSize = CUBE_SIZE * (this.currentBoxScale || 1.0);

        // Generate cache key based on parameters that affect geometry
        const cacheKey = JSON.stringify({
            scale: scaleOverride,
            spacing: spacingOverride,
            offset: offsetOverride,
            outerScale: this.currentOuterScale || 2.95,
            filletRadius: this.currentFilletRadius !== undefined ? this.currentFilletRadius : 0.14,
            rotation: rotationY
        });

        // Check if we have cached geometries for these parameters
        const useCachedGeometries = this.cubieGeometryCache.has(cacheKey);

        let evaluator, sourceBVH;

        if (!useCachedGeometries) {
            // First time with these parameters - perform CSG operations
            evaluator = new Evaluator();
            evaluator.attributes = ['position', 'normal', 'uv', 'color'];

            // Create BVH for the source geometry to enable fast closest-point queries
            sourceBVH = new MeshBVH(geometry);

            // Initialize cache entry for this configuration
            this.cubieGeometryCache.set(cacheKey, new Map());
        }

        this.cubieList.forEach(group => {
            const { x, y, z } = group.userData.gridPos;

            // Remove existing mesh if any (except placeholder, hitbox, and outline)
            for (let i = group.children.length - 1; i >= 0; i--) {
                const child = group.children[i];
                if (!child.userData.isPlaceholder && !child.userData.isHitBox && !child.userData.isTouchTargetOutline) {
                    if (child.geometry) child.geometry.dispose();
                    group.remove(child);
                }
            }

            // Initial Position Set (Only if not loaded)
            if (!this.isLoaded) {
                // Apply y' rotation to grid position (rotate position around Y axis)
                // y' means -90 degrees around Y: (x, y, z) -> (z, y, -x)
                const rotatedX = z;
                const rotatedY = y;
                const rotatedZ = -x;

                // y rotation quaternion (+90 degrees)
                const yRotation = new THREE.Quaternion().setFromAxisAngle(
                    new THREE.Vector3(0, 1, 0),
                    Math.PI / 2
                );

                group.position.set(rotatedX * S_new, rotatedY * S_new, rotatedZ * S_new);
                group.quaternion.copy(yRotation);
                group.updateMatrix();
                group.updateMatrixWorld(true);
            }

            // Create a unique key for this cubie position
            const cubieKey = `${x},${y},${z}`;

            // Get the cache for this configuration (either existing or newly created)
            const cacheForThisConfig = this.cubieGeometryCache.get(cacheKey);
            let resultGeometry = null;

            if (useCachedGeometries && cacheForThisConfig.has(cubieKey)) {
                // Use cached geometry - just clone it
                resultGeometry = cacheForThisConfig.get(cubieKey).clone();
                console.log(`[TheChildMod] Using cached geometry for cubie ${cubieKey}`);
            } else {
                // Need to perform CSG operation
                console.log(`[TheChildMod] Computing geometry for cubie ${cubieKey}`);

                // Define the cutting box for this piece
                // Selective Scaling: Only extend outer faces
                const scale = this.currentOuterScale || 2.95;
                const halfSize = CUBE_SIZE / 2;

                // Determine bounds relative to piece center
                // Default: [-halfSize, halfSize]
                let xMin = -halfSize;
                let xMax = halfSize;
                let yMin = -halfSize;
                let yMax = halfSize;
                let zMin = -halfSize;
                let zMax = halfSize;

                // Check boundaries (2x3x2)
                // xRange = [-0.5, 0.5]
                if (x <= -0.5) xMin *= scale;
                if (x >= 0.5) xMax *= scale;

                // yRange = [-1, 0, 1]
                if (y <= -1) yMin *= scale;
                if (y >= 1) yMax *= scale;

                // zRange = [-0.5, 0.5]
                if (z <= -0.5) zMin *= scale;
                if (z >= 0.5) zMax *= scale;

                const width = xMax - xMin;
                const height = yMax - yMin;
                const depth = zMax - zMin;

                const xCenter = (xMin + xMax) / 2;
                const yCenter = (yMin + yMax) / 2;
                const zCenter = (zMin + zMax) / 2;

                let boxGeo;
                const radius = this.currentFilletRadius !== undefined ? this.currentFilletRadius : 0.14;

                if (radius > 0) {
                    // RoundedBoxGeometry( width, height, depth, segments, radius )
                    boxGeo = new RoundedBoxGeometry(width, height, depth, 4, radius);
                } else {
                    boxGeo = new THREE.BoxGeometry(width, height, depth);
                }

                boxGeo.translate(xCenter, yCenter, zCenter);

                boxGeo = boxGeo.toNonIndexed();
                // boxGeo.deleteAttribute('color'); // Don't delete, let it interpolate or default? 
                // Actually, boxGeo needs color attribute to match sourceBrush for CSG if source has it.
                // If source has color, box must have color attribute too (even if unused/white) to avoid errors in some CSG implementations,
                // or at least to produce correct results. 
                // three-bvh-csg usually handles missing attributes by filling with 0, but let's be safe.
                const sourceColorAttr = geometry.attributes.color;

                if (sourceColorAttr) {
                    const boxCount = boxGeo.attributes.position.count;
                    const boxColors = new Float32Array(boxCount * 3).fill(1); // White interior
                    boxGeo.setAttribute('color', new THREE.BufferAttribute(boxColors, 3));
                }

                const boxBrush = new Brush(boxGeo);

                boxBrush.position.set(
                    x * CUBE_SIZE,
                    y * CUBE_SIZE,
                    z * CUBE_SIZE
                );
                boxBrush.updateMatrixWorld();

                try {
                    const result = evaluator.evaluate(sourceBrush, boxBrush, INTERSECTION);

                    // --- Color Transfer Logic ---
                    if (result.geometry) {
                        const resGeom = result.geometry;
                        const posAttr = resGeom.attributes.position;

                        // Ensure color attribute exists
                        if (!resGeom.attributes.color) {
                            resGeom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(posAttr.count * 3), 3));
                        }

                        if (sourceColorAttr) {
                            const tempVec = new THREE.Vector3();
                            const targetColor = new THREE.Color();

                            // Iterate over all vertices of the cut piece
                            let hitCount = 0;
                            let missCount = 0;

                            for (let i = 0; i < posAttr.count; i++) {
                                tempVec.fromBufferAttribute(posAttr, i);

                                // Find the closest point on the original source geometry
                                const hit = sourceBVH.closestPointToPoint(tempVec);

                                if (hit) {
                                    hitCount++;
                                    // Get the indices of the vertices of the closest face
                                    const faceIndex = hit.faceIndex;
                                    const i1 = geometry.index ? geometry.index.getX(faceIndex * 3) : faceIndex * 3;
                                    const i2 = geometry.index ? geometry.index.getX(faceIndex * 3 + 1) : faceIndex * 3 + 1;
                                    const i3 = geometry.index ? geometry.index.getX(faceIndex * 3 + 2) : faceIndex * 3 + 2;

                                    // Get colors of the face vertices
                                    const c1 = new THREE.Color().fromBufferAttribute(sourceColorAttr, i1);
                                    const c2 = new THREE.Color().fromBufferAttribute(sourceColorAttr, i2);
                                    const c3 = new THREE.Color().fromBufferAttribute(sourceColorAttr, i3);

                                    // Calculate barycentric coordinates to interpolate color
                                    const p1 = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, i1);
                                    const p2 = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, i2);
                                    const p3 = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, i3);

                                    const bary = THREE.Triangle.getBarycoord(hit.point, p1, p2, p3, new THREE.Vector3());

                                    // Interpolate color using barycentric coordinates
                                    targetColor.setRGB(
                                        c1.r * bary.x + c2.r * bary.y + c3.r * bary.z,
                                        c1.g * bary.x + c2.g * bary.y + c3.g * bary.z,
                                        c1.b * bary.x + c2.b * bary.y + c3.b * bary.z
                                    );

                                    // Apply to the result vertex
                                    resGeom.attributes.color.setXYZ(i, targetColor.r, targetColor.g, targetColor.b);
                                } else {
                                    missCount++;
                                }
                            }
                            console.log(`[TheChildMod] Color transfer: ${hitCount} hits, ${missCount} misses.`);
                            resGeom.attributes.color.needsUpdate = true;
                        }

                        // Store the geometry in cache for future use
                        resultGeometry = resGeom.clone();
                        cacheForThisConfig.set(cubieKey, resultGeometry.clone());
                    }
                } catch (e) {
                    console.error("CSG Error for piece", x, y, z, e);
                }
            }

            // Create mesh from geometry (either cached or freshly computed)
            if (resultGeometry) {
                const mesh = new THREE.Mesh(resultGeometry, material);

                // Position correction
                mesh.position.set(-x * CUBE_SIZE, -y * CUBE_SIZE, -z * CUBE_SIZE);

                // Remove placeholder if it exists
                const placeholder = group.children.find(c => c.userData.isPlaceholder);
                if (placeholder) {
                    group.remove(placeholder);
                }

                group.add(mesh);
            }
        });

        this.isLoaded = true;

        if (state.renderer && state.scene && state.camera) {
            state.renderer.render(state.scene, state.camera);
        }
    }

    applyBoxUV(geometry) {
        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox;
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const min = bbox.min;

        const positionAttribute = geometry.attributes.position;
        if (!geometry.attributes.normal) geometry.computeVertexNormals();

        const uvAttribute = new THREE.BufferAttribute(new Float32Array(positionAttribute.count * 2), 2);

        for (let i = 0; i < positionAttribute.count; i++) {
            const x = positionAttribute.getX(i);
            const y = positionAttribute.getY(i);
            const z = positionAttribute.getZ(i);

            const nx = Math.abs(geometry.attributes.normal.getX(i));
            const ny = Math.abs(geometry.attributes.normal.getY(i));
            const nz = Math.abs(geometry.attributes.normal.getZ(i));

            let u = 0, v = 0;

            if (nx >= ny && nx >= nz) {
                u = (z - min.z) / size.z;
                v = (y - min.y) / size.y;
            } else if (ny >= nx && ny >= nz) {
                u = (x - min.x) / size.x;
                v = (z - min.z) / size.z;
            } else {
                u = (x - min.x) / size.x;
                v = (y - min.y) / size.y;
            }

            uvAttribute.setXY(i, u, v);
        }

        geometry.setAttribute('uv', uvAttribute);
    }

    updateTheChildParams(params) {
        try {
            const { spacing, showTouchTargets, touchTargetScale, roughness, metalness, normalScale } = params;

            // Handle spacing changes (requires geometry rebuild)
            const spacingChanged = spacing !== undefined && spacing !== this.currentSpacing;

            // Update material properties
            if (roughness !== undefined && !isNaN(roughness)) this.currentRoughness = roughness;
            if (metalness !== undefined && !isNaN(metalness)) this.currentMetalness = metalness;
            if (normalScale !== undefined && !isNaN(normalScale)) this.currentNormalScale = normalScale;

            // Handle touch target visibility
            if (showTouchTargets !== undefined && showTouchTargets !== this.showTouchTargets) {
                this.showTouchTargets = showTouchTargets;
                this.updateTouchTargetVisibility();
            }

            // Handle touch target scale
            if (touchTargetScale !== undefined && !isNaN(touchTargetScale) && touchTargetScale !== this.touchTargetScale) {
                this.touchTargetScale = touchTargetScale;
                this.updateTouchTargetScale();
            }

            if (spacingChanged) {
                if (this.originalGeometry) {
                    this.processSTL(this.originalGeometry, this.currentScale, spacing, this.currentOffset);
                }
            } else {
                this.updateMaterialOnly();
            }
        } catch (e) {
            console.error('Error in updateTheChildParams:', e);
        }
    }

    updateMaterialOnly() {
        try {
            const roughness = this.currentRoughness !== undefined ? this.currentRoughness : 0.6;
            const metalness = this.currentMetalness !== undefined ? this.currentMetalness : 0.46;
            const normalScale = this.currentNormalScale !== undefined ? this.currentNormalScale : 0.5;

            this.cubieList.forEach(group => {
                group.children.forEach(child => {
                    if (child.isMesh && !child.userData.isPlaceholder && !child.userData.isHitBox) {
                        if (child.material) {
                            child.material.roughness = roughness;
                            child.material.metalness = metalness;
                            if (this.sparkleMap) {
                                child.material.normalMap = this.sparkleMap;
                                child.material.normalScale.set(normalScale, normalScale);
                            }
                            child.material.needsUpdate = true;
                        }
                    }
                });
            });
        } catch (e) {
            console.error('Error in updateMaterialOnly:', e);
        }
    }

    updateTouchTargetVisibility() {
        this.cubieList.forEach(group => {
            if (group.userData.outline) {
                group.userData.outline.material.visible = this.showTouchTargets;
            }
        });

        // Trigger a render update
        if (state.renderer && state.scene && state.camera) {
            state.renderer.render(state.scene, state.camera);
        }
    }

    updateTouchTargetScale() {
        this.cubieList.forEach(group => {
            if (group.userData.hitBox && group.userData.outline) {
                const scale = this.touchTargetScale;

                // Update hitbox scale
                group.userData.hitBox.scale.set(scale, scale, scale);

                // Update outline scale (keep it slightly larger than hitbox for visibility)
                const outlineScale = scale * 1.01;
                group.userData.outline.scale.set(outlineScale, outlineScale, outlineScale);
            }
        });

        // Trigger a render update
        if (state.renderer && state.scene && state.camera) {
            state.renderer.render(state.scene, state.camera);
        }
    }

    isSolved() {
        const S = CUBE_SIZE + this.getSpacing();
        const epsilon = 0.2;
        const identity = new THREE.Quaternion();

        const cubeRotations = this.getAllCubeRotations();
        const equivalentStates = [this.getBaseSolvedState()];
        let closestMatch = { rotIdx: -1, failedCubies: 8 };

        for (let rotIdx = 0; rotIdx < cubeRotations.length; rotIdx++) {
            const cubeRot = cubeRotations[rotIdx];
            const state = equivalentStates[0];

            let allMatch = true;
            let failedCubies = 0;

            for (const group of this.cubieList) {
                const currentPos = group.position.clone();
                const currentQuat = group.quaternion.clone();

                const inverseRot = cubeRot.clone().invert();
                currentPos.applyQuaternion(inverseRot);
                const normalizedQuat = currentQuat.clone().premultiply(inverseRot);

                let matchedKey = null;
                let minDist = Infinity;

                for (const [key, expected] of Object.entries(state)) {
                    const targetPos = new THREE.Vector3(
                        expected.pos.x * S,
                        expected.pos.y * S,
                        expected.pos.z * S
                    );
                    const dist = currentPos.distanceTo(targetPos);
                    if (dist < minDist && dist < epsilon) {
                        minDist = dist;
                        matchedKey = key;
                    }
                }

                if (!matchedKey) {
                    allMatch = false;
                    failedCubies++;
                    break;
                }

                const expected = state[matchedKey];
                const expectedQuat = expected.quat || identity;
                const angleDiff = normalizedQuat.angleTo(expectedQuat);
                if (angleDiff > epsilon) {
                    allMatch = false;
                    failedCubies++;
                    break;
                }
            }

            if (failedCubies < closestMatch.failedCubies) {
                closestMatch = { rotIdx, failedCubies };
            }

            if (allMatch) {
                return true;
            }
        }

        return false;
    }

    getBaseSolvedState() {
        const state = {};
        // y rotation quaternion (+90 degrees)
        const yRotation = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            Math.PI / 2
        );

        for (const group of this.cubieList) {
            const { x, y, z } = group.userData.gridPos;

            // Apply y' rotation to position: (x, y, z) -> (z, y, -x)
            const rotatedX = z;
            const rotatedY = y;
            const rotatedZ = -x;

            const key = `${x},${y},${z} `;
            state[key] = { pos: { x: rotatedX, y: rotatedY, z: rotatedZ }, quat: yRotation.clone() };
        }
        return state;
    }

    getAllCubeRotations() {
        const rotations = [];
        const angles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
        const xAxis = new THREE.Vector3(1, 0, 0);
        const yAxis = new THREE.Vector3(0, 1, 0);
        const zAxis = new THREE.Vector3(0, 0, 1);

        for (const angle of angles) rotations.push(new THREE.Quaternion().setFromAxisAngle(yAxis, angle));
        for (const angle of angles) {
            const q = new THREE.Quaternion().setFromAxisAngle(xAxis, -Math.PI / 2);
            q.multiply(new THREE.Quaternion().setFromAxisAngle(yAxis, angle));
            rotations.push(q);
        }
        for (const angle of angles) {
            const q = new THREE.Quaternion().setFromAxisAngle(xAxis, Math.PI / 2);
            q.multiply(new THREE.Quaternion().setFromAxisAngle(yAxis, angle));
            rotations.push(q);
        }
        for (const angle of angles) {
            const q = new THREE.Quaternion().setFromAxisAngle(zAxis, Math.PI / 2);
            q.multiply(new THREE.Quaternion().setFromAxisAngle(yAxis, angle));
            rotations.push(q);
        }
        for (const angle of angles) {
            const q = new THREE.Quaternion().setFromAxisAngle(zAxis, -Math.PI / 2);
            q.multiply(new THREE.Quaternion().setFromAxisAngle(yAxis, angle));
            rotations.push(q);
        }
        for (const angle of angles) {
            const q = new THREE.Quaternion().setFromAxisAngle(xAxis, Math.PI);
            q.multiply(new THREE.Quaternion().setFromAxisAngle(yAxis, angle));
            rotations.push(q);
        }
        return rotations;
    }

    getSpacing() {
        return this.spacing !== undefined ? this.spacing : 0.005;
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
