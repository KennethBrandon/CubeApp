import * as THREE from 'three';
import { StandardCube } from './StandardCube.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { Brush, Evaluator, INTERSECTION } from 'three-bvh-csg';
import { CUBE_SIZE, SPACING } from '../shared/constants.js';
import { state } from '../shared/state.js';

export class AcornsMod extends StandardCube {
    constructor(config) {
        super(config);
        this.config.dimensions = { x: 2, y: 2, z: 2 };
        this.isLoaded = false;
        this.spacing = 0.005; // Default spacing
    }

    createGeometry() {
        // Clear existing
        this.cubieList.forEach(c => {
            if (c.parent) c.parent.remove(c);
        });
        this.cubieList.length = 0;

        state.activeDimensions = { ...this.config.dimensions };

        // Create placeholder cubies first (invisible or simple boxes)
        // This ensures the puzzle logic works immediately while we load
        this.createPlaceholders();

        // Check if we already have the geometry cached
        if (this.originalGeometry) {
            // Synchronous rebuild - prevents flash
            this.processSTL(this.originalGeometry, null, null, { x: 0, y: 3.3, z: 0 });
        } else {
            // Load the STL (Async)
            const loader = new STLLoader();
            loader.load('assets/3d/Acorns Logo.stl', (geometry) => {
                this.processSTL(geometry, null, null, { x: 0, y: 3.3, z: 0 });
            }, undefined, (error) => {
                console.error('Error loading Acorns STL:', error);
            });
        }
    }

    createPlaceholders() {
        const dim = 2;
        const offset = 0.5;
        const S = CUBE_SIZE + this.getSpacing();

        for (let x = -offset; x <= offset; x++) {
            for (let y = -offset; y <= offset; y++) {
                for (let z = -offset; z <= offset; z++) {
                    const group = new THREE.Group();
                    group.position.set(x * S, y * S, z * S);

                    // Invisible hit box for interaction
                    const hitGeo = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
                    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                    const hitBox = new THREE.Mesh(hitGeo, hitMat);
                    group.add(hitBox);

                    // Temporary visual box (wireframe or semi-transparent) - REMOVED to prevent flash
                    // const visGeo = new THREE.BoxGeometry(CUBE_SIZE * 0.9, CUBE_SIZE * 0.9, CUBE_SIZE * 0.9);
                    // const visMat = new THREE.MeshStandardMaterial({
                    //     color: 0x74C947,
                    //     wireframe: true,
                    //     transparent: true,
                    //     opacity: 0.3
                    // });
                    // const visBox = new THREE.Mesh(visGeo, visMat);
                    // visBox.userData = { isPlaceholder: true };
                    // group.add(visBox);

                    group.userData = { isCubie: true, gridPos: { x, y, z } };
                    this.parent.add(group);
                    this.cubieList.push(group);
                }
            }
        }
    }

    processSTL(geometry, scaleOverride = null, spacingOverride = null, offsetOverride = null) {
        // Store original geometry for re-processing
        if (!this.originalGeometry) {
            this.originalGeometry = geometry.clone();
        } else if (geometry !== this.originalGeometry) {
            // If we are called with a new geometry (shouldn't happen often), update it
            this.originalGeometry = geometry.clone();
        } else {
            // If called with same geometry (e.g. from updateAcornsParams), use a clone to avoid mutating original
            geometry = this.originalGeometry.clone();
        }

        // 1. Center and Scale the Geometry
        geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);

        // Fix Orientation: Rotate -90 degrees on X axis (simulating 'x'' move)
        // Previous +90 made it upside down, so we try -90.
        geometry.rotateX(-Math.PI / 2);

        // Apply Offset (User Preference)
        if (offsetOverride) {
            geometry.translate(offsetOverride.x, offsetOverride.y, offsetOverride.z);
        }

        const size = new THREE.Vector3();
        geometry.boundingBox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);

        // Scale to fit 2x2 area (approx 2 * CUBE_SIZE)
        // Use override if provided, otherwise default 2.6 (User Preference)
        const targetScale = scaleOverride !== null ? scaleOverride : 2.6;
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

        // Remove incompatible attributes (color)
        geometry.deleteAttribute('color');

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
            color: 0x74C947,
            roughness: roughness,
            metalness: metalness,
            normalMap: this.sparkleMap,
            normalScale: new THREE.Vector2(normalScale, normalScale) // Subtle sparkle
        });

        const sourceBrush = new Brush(geometry, material);
        sourceBrush.updateMatrixWorld();

        // 2. Slice into 8 pieces
        // Use override if provided, otherwise default
        // currentSpacing is the GAP (e.g. 0.005)
        const newGap = spacingOverride !== null ? spacingOverride : this.getSpacing();
        const S_new = CUBE_SIZE + newGap;

        // Old Gap (for ratio calculation)
        const oldGap = this.currentSpacing !== undefined ? this.currentSpacing : this.getSpacing();
        const S_old = CUBE_SIZE + oldGap;

        // Handle Spacing Update on Groups
        // If this is an update (isLoaded is true), we must scale the current positions
        // instead of resetting them, to preserve the scrambled state.
        if (this.isLoaded) {
            // Check if gap actually changed
            if (Math.abs(newGap - oldGap) > 0.0001) {
                const ratio = S_new / S_old;
                // console.log('Adjusting spacing ratio:', ratio, 'OldGap:', oldGap, 'NewGap:', newGap);
                this.cubieList.forEach(group => {
                    group.position.multiplyScalar(ratio);
                    group.updateMatrix();
                    group.updateMatrixWorld(true);
                });
            }
        }

        // Update currentSpacing to the NEW GAP
        this.currentSpacing = newGap;

        // Box size needs to be large enough to cover the whole octant
        const boxSize = targetSize * 1.5;
        const evaluator = new Evaluator();

        // IMPORTANT: Explicitly tell evaluator to use position, normal AND UV
        evaluator.attributes = ['position', 'normal', 'uv'];

        this.cubieList.forEach(group => {
            const { x, y, z } = group.userData.gridPos; // ±0.5

            // Remove existing mesh if any (except placeholder)
            // We need to be careful not to remove the placeholder if we are just updating?
            // Actually, if we are updating, we want to replace the mesh.
            // Let's remove all children that are NOT placeholders.
            for (let i = group.children.length - 1; i >= 0; i--) {
                const child = group.children[i];
                if (!child.userData.isPlaceholder && !child.userData.isHitBox) {
                    if (child.geometry) child.geometry.dispose();
                    group.remove(child);
                }
            }

            // Initial Position Set (Only if not loaded)
            if (!this.isLoaded) {
                group.position.set(x * S_new, y * S_new, z * S_new);
                group.updateMatrix();
                group.updateMatrixWorld(true);
            }

            // Define the cutting box for this octant
            let boxGeo = new THREE.BoxGeometry(boxSize, boxSize, boxSize);

            // Convert to non-indexed to match STL (which is non-indexed)
            // This avoids issues where one is indexed and the other isn't
            boxGeo = boxGeo.toNonIndexed();

            // Remove Color from box to match STL, but KEEP UVs
            boxGeo.deleteAttribute('color');

            const boxBrush = new Brush(boxGeo);

            // Position the box to overlap ONLY the desired octant
            const dirX = x > 0 ? 1 : -1;
            const dirY = y > 0 ? 1 : -1;
            const dirZ = z > 0 ? 1 : -1;

            boxBrush.position.set(
                dirX * boxSize / 2,
                dirY * boxSize / 2,
                dirZ * boxSize / 2
            );
            boxBrush.updateMatrixWorld();

            // Perform Intersection
            try {
                const result = evaluator.evaluate(sourceBrush, boxBrush, INTERSECTION);

                // Apply material (evaluate might return a mesh with default material or mixed materials)
                result.material = material;

                // Position correction
                // The result mesh is in world space (relative to source origin).
                // The group is at (x*S, y*S, z*S) in the SOLVED state.
                // The mesh geometry is "baked" to be correct when the group is at that position.
                // So we offset the mesh by -SolvedPos.
                // FIX: We offset by -x * CUBE_SIZE (base spacing) so that the gap (S - CUBE_SIZE) is visible.
                result.position.set(-x * CUBE_SIZE, -y * CUBE_SIZE, -z * CUBE_SIZE);

                // Remove placeholder if it exists
                const placeholder = group.children.find(c => c.userData.isPlaceholder);
                if (placeholder) {
                    placeholder.visible = false; // Hide instead of remove, or remove?
                    // If we remove it, we can't bring it back easily if CSG fails.
                    // But we want to remove it so it doesn't z-fight.
                    group.remove(placeholder);
                }

                // Post-processing for shadows
                result.castShadow = true;
                result.receiveShadow = true;

                group.add(result);
            } catch (e) {
                console.error("CSG Error for piece", x, y, z, e);
            }
        });

        this.isLoaded = true;

        // Force a render to ensure updates are visible immediately
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
        // Check if normal attribute exists
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

            // Dominant axis mapping
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

    updateAcornsParams(params) {
        try {
            const { scale, spacing, offset, roughness, metalness, normalScale } = params;

            const geomChanged = (scale !== undefined && scale !== this.currentScale) ||
                (spacing !== undefined && spacing !== this.currentSpacing) ||
                (offset && (offset.x !== this.currentOffset?.x || offset.y !== this.currentOffset?.y || offset.z !== this.currentOffset?.z));

            // Update current values with validation
            if (scale !== undefined && !isNaN(scale)) this.currentScale = scale;
            // NOTE: We do NOT update this.currentSpacing here, because processSTL needs the OLD value to calculate ratio.
            // processSTL will update it.
            // if (spacing !== undefined && !isNaN(spacing)) this.currentSpacing = spacing; 

            if (offset) this.currentOffset = { ...offset };

            if (roughness !== undefined && !isNaN(roughness)) this.currentRoughness = roughness;
            if (metalness !== undefined && !isNaN(metalness)) this.currentMetalness = metalness;
            if (normalScale !== undefined && !isNaN(normalScale)) this.currentNormalScale = normalScale;

            if (geomChanged) {
                if (this.originalGeometry) {
                    this.processSTL(this.originalGeometry, this.currentScale, spacing, this.currentOffset);
                } else {
                    console.warn('originalGeometry is missing!');
                }
            } else {
                this.updateMaterialOnly();
            }
        } catch (e) {
            console.error('Error in updateAcornsParams:', e);
        }
    }

    updateMaterialOnly() {
        try {
            const roughness = this.currentRoughness !== undefined ? this.currentRoughness : 0.6;
            const metalness = this.currentMetalness !== undefined ? this.currentMetalness : 0.46;
            const normalScale = this.currentNormalScale !== undefined ? this.currentNormalScale : 0.5;

            if (isNaN(roughness) || isNaN(metalness) || isNaN(normalScale)) {
                console.error('Invalid material parameters:', { roughness, metalness, normalScale });
                return;
            }

            let updatedCount = 0;
            this.cubieList.forEach(group => {
                group.children.forEach(child => {
                    // Check if it's a mesh and NOT a placeholder/hitbox
                    // The CSG result is a Mesh.
                    // We need to be sure we are targeting the right object.
                    if (child.isMesh && !child.userData.isPlaceholder && !child.userData.isHitBox) {
                        if (child.material) {
                            child.material.roughness = roughness;
                            child.material.metalness = metalness;
                            if (this.sparkleMap) {
                                child.material.normalMap = this.sparkleMap;
                                child.material.normalScale.set(normalScale, normalScale);
                            }
                            child.material.needsUpdate = true;
                            updatedCount++;
                        }
                    }
                });
            });
        } catch (e) {
            console.error('Error in updateMaterialOnly:', e);
        }
    }

    // Helper to convert grid position to corner name
    posToCorner(pos) {
        const x = pos.x > 0 ? 'R' : 'L';
        const y = pos.y > 0 ? 'U' : 'D';
        const z = pos.z > 0 ? 'F' : 'B';
        return `${y}${z}${x} `;
    }

    // Override isSolved to account for symmetries in the Acorns logo
    // The puzzle has multiple equivalent solved states:
    // - Bottom layer (y=-0.5) has 180° rotational symmetry (B2 moves)
    // - Top layer (y=+0.5) has 180° rotational symmetry (U2 moves)
    // - DFR and DBL corners can be swapped
    // Additionally, must be rotation-invariant (account for X/Y/Z cube rotations)
    isSolved() {
        const S = CUBE_SIZE + this.getSpacing();
        const epsilon = 0.2; // Increased from 0.1 for better tolerance
        const identity = new THREE.Quaternion();

        // console.log("╔════════════════════════════════════════════════════════");
        // console.log("║ AcornsMod isSolved() Check");
        // console.log("╚════════════════════════════════════════════════════════");

        // Log current state with corner names
        // Log current state with corner names
        // console.log("\n📍 Current Piece Positions:");
        // this.cubieList.forEach(group => {
        //     const { x, y, z } = group.userData.gridPos;
        //     const pos = group.position;
        //     const origCorner = this.posToCorner({ x, y, z });
        //     const currentCorner = this.posToCorner(pos);
        //     console.log(`  ${origCorner} → ${currentCorner} `);
        // });

        // Generate all 24 possible cube orientations (rotations in 3D)
        const cubeRotations = this.getAllCubeRotations();
        const equivalentStates = this.getEquivalentSolvedStates();

        // console.log(`\n🔄 Checking ${cubeRotations.length} orientations × ${equivalentStates.length} symmetries = ${cubeRotations.length * equivalentStates.length} total combinations`);

        // Track closest match for debugging
        let closestMatch = { rotIdx: -1, stateIdx: -1, failedCubies: 8, reason: '' };

        // For each cube orientation, check if it matches any equivalent solved state
        for (let rotIdx = 0; rotIdx < cubeRotations.length; rotIdx++) {
            const cubeRot = cubeRotations[rotIdx];

            // Check if current state matches any equivalent solved state under this rotation
            for (let stateIdx = 0; stateIdx < equivalentStates.length; stateIdx++) {
                const state = equivalentStates[stateIdx];
                let allMatch = true;
                let failedCubies = 0;
                let failReason = "";

                for (const group of this.cubieList) {
                    // Get current position and rotation
                    const currentPos = group.position.clone();
                    const currentQuat = group.quaternion.clone();

                    // Apply inverse cube rotation to get "normalized" position/rotation
                    const inverseRot = cubeRot.clone().invert();
                    currentPos.applyQuaternion(inverseRot);
                    const normalizedQuat = currentQuat.clone().premultiply(inverseRot);

                    // Find which original position this cubie is at
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
                        failReason = `Position mismatch(dist = ${minDist.toFixed(3)})`;
                        break;
                    }

                    // Check if rotation matches (be more lenient)
                    const expected = state[matchedKey];
                    const expectedQuat = expected.quat || identity;
                    const angleDiff = normalizedQuat.angleTo(expectedQuat);
                    if (angleDiff > epsilon) {
                        allMatch = false;
                        failedCubies++;
                        failReason = `Rotation mismatch(angle = ${angleDiff.toFixed(3)})`;
                        break;
                    }
                }

                // Track closest match
                if (failedCubies < closestMatch.failedCubies) {
                    closestMatch = { rotIdx, stateIdx, failedCubies, reason: failReason };
                }

                if (allMatch) {
                    // console.log(`\n✅ SOLVED! Matched orientation ${rotIdx}, symmetry ${stateIdx} `);
                    // console.log("════════════════════════════════════════════════════════\n");
                    return true;
                }
            }
        }

        // console.log(`\n❌ NOT SOLVED - Closest match: rot ${closestMatch.rotIdx}, state ${closestMatch.stateIdx}, failed ${closestMatch.failedCubies} cubies(${closestMatch.reason})`);
        // console.log("💡 If you believe this state IS solved, the symmetry might not be in our list.");
        // console.log("════════════════════════════════════════════════════════\n");
        return false;
    }

    // Generate all 24 possible cube orientations
    getAllCubeRotations() {
        const rotations = [];
        const identity = new THREE.Quaternion();

        // Generate rotations around each axis (0°, 90°, 180°, 270°)
        const angles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];

        // Face rotations (6 faces × 4 orientations = 24 total, but some overlap)
        // We'll generate systematically: for each of 6 faces pointing up, 4 rotations around Y
        const xAxis = new THREE.Vector3(1, 0, 0);
        const yAxis = new THREE.Vector3(0, 1, 0);
        const zAxis = new THREE.Vector3(0, 0, 1);

        // Start with +Y up (identity and Y rotations)
        for (const angle of angles) {
            rotations.push(new THREE.Quaternion().setFromAxisAngle(yAxis, angle));
        }

        // +Z up (rotate 90° around X, then  Y rotations)
        for (const angle of angles) {
            const q = new THREE.Quaternion().setFromAxisAngle(xAxis, -Math.PI / 2);
            q.multiply(new THREE.Quaternion().setFromAxisAngle(yAxis, angle));
            rotations.push(q);
        }

        // -Z up (rotate -90° around X, then Y rotations)
        for (const angle of angles) {
            const q = new THREE.Quaternion().setFromAxisAngle(xAxis, Math.PI / 2);
            q.multiply(new THREE.Quaternion().setFromAxisAngle(yAxis, angle));
            rotations.push(q);
        }

        // +X up (rotate -90° around Z, then Y rotations)
        for (const angle of angles) {
            const q = new THREE.Quaternion().setFromAxisAngle(zAxis, Math.PI / 2);
            q.multiply(new THREE.Quaternion().setFromAxisAngle(yAxis, angle));
            rotations.push(q);
        }

        // -X up (rotate 90° around Z, then Y rotations)
        for (const angle of angles) {
            const q = new THREE.Quaternion().setFromAxisAngle(zAxis, -Math.PI / 2);
            q.multiply(new THREE.Quaternion().setFromAxisAngle(yAxis, angle));
            rotations.push(q);
        }

        // -Y up (rotate 180° around X, then Y rotations)
        for (const angle of angles) {
            const q = new THREE.Quaternion().setFromAxisAngle(xAxis, Math.PI);
            q.multiply(new THREE.Quaternion().setFromAxisAngle(yAxis, angle));
            rotations.push(q);
        }

        return rotations;
    }

    // Generate all equivalent solved states accounting for symmetries
    getEquivalentSolvedStates() {
        const states = [];
        const identity = new THREE.Quaternion();
        const rot180Y = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

        // Helper function to apply corner swaps
        // Returns { pos, requiresRotation } where requiresRotation indicates if a 180° Y rotation is needed
        const applySwaps = (pos, swap1, swap2) => {
            let result = { ...pos };
            let requiresRotation = false;

            // swap1: DFR (0.5, -0.5, 0.5) ↔ DBL (-0.5, -0.5, -0.5)
            // These corners are diagonally opposite, so they need 180° rotation when swapped
            if (swap1) {
                if (pos.x === 0.5 && pos.y === -0.5 && pos.z === 0.5) {
                    result = { x: -0.5, y: -0.5, z: -0.5 };
                    requiresRotation = true;
                } else if (pos.x === -0.5 && pos.y === -0.5 && pos.z === -0.5) {
                    result = { x: 0.5, y: -0.5, z: 0.5 };
                    requiresRotation = true;
                }
            }

            // swap2: DFL (-0.5, -0.5, 0.5) ↔ DBR (0.5, -0.5, -0.5)
            // These corners are also diagonally opposite, so they need 180° rotation when swapped
            if (swap2) {
                if (result.x === -0.5 && result.y === -0.5 && result.z === 0.5) {
                    result = { x: 0.5, y: -0.5, z: -0.5 };
                    requiresRotation = true;
                } else if (result.x === 0.5 && result.y === -0.5 && result.z === -0.5) {
                    result = { x: -0.5, y: -0.5, z: 0.5 };
                    requiresRotation = true;
                }
            }

            return { pos: result, requiresRotation };
        };

        // Helper function to apply X-axis mirror (left-right flip)
        const applyXMirror = (pos) => {
            return { x: -pos.x, y: pos.y, z: pos.z };
        };

        // Base solved state (identity)
        const baseFn = (swap1, swap2, xMirror) => {
            const state = {};
            for (const group of this.cubieList) {
                const { x, y, z } = group.userData.gridPos;
                const swapResult = applySwaps({ x, y, z }, swap1, swap2);
                let pos = swapResult.pos;
                if (xMirror) pos = applyXMirror(pos);
                const quat = swapResult.requiresRotation ? rot180Y : identity;
                const key = `${x},${y},${z} `;
                state[key] = { pos, quat };
            }
            return state;
        };

        // U2 symmetry: Top layer (y=+0.5) rotated 180° around Y axis
        const u2Fn = (swap1, swap2, xMirror) => {
            const state = {};
            for (const group of this.cubieList) {
                const { x, y, z } = group.userData.gridPos;
                const swapResult = applySwaps({ x, y, z }, swap1, swap2);
                let pos = swapResult.pos;
                if (xMirror) pos = applyXMirror(pos);
                let quat = swapResult.requiresRotation ? rot180Y : identity;

                // If top layer, apply U2 transformation
                if (pos.y === 0.5) {
                    pos = { x: -pos.x, y: pos.y, z: -pos.z };
                    quat = rot180Y; // U2 rotation overrides swap rotation
                }

                const key = `${x},${y},${z} `;
                state[key] = { pos, quat };
            }
            return state;
        };

        // B2 symmetry: Bottom layer (y=-0.5) rotated 180° around Y axis
        const b2Fn = (swap1, swap2, xMirror) => {
            const state = {};
            for (const group of this.cubieList) {
                const { x, y, z } = group.userData.gridPos;
                const swapResult = applySwaps({ x, y, z }, swap1, swap2);
                let pos = swapResult.pos;
                if (xMirror) pos = applyXMirror(pos);
                let quat = swapResult.requiresRotation ? rot180Y : identity;

                // If bottom layer, apply B2 transformation (180° rotation around Y)
                if (pos.y === -0.5) {
                    pos = { x: -pos.x, y: pos.y, z: -pos.z };
                    quat = rot180Y; // B2 rotation overrides swap rotation
                }

                const key = `${x},${y},${z} `;
                state[key] = { pos, quat };
            }
            return state;
        };

        // U2+B2 symmetry: Both layers rotated 180°
        const u2b2Fn = (swap1, swap2, xMirror) => {
            const state = {};
            for (const group of this.cubieList) {
                const { x, y, z } = group.userData.gridPos;
                const swapResult = applySwaps({ x, y, z }, swap1, swap2);
                let pos = swapResult.pos;
                if (xMirror) pos = applyXMirror(pos);

                // All pieces rotated 180° around Y
                pos = { x: -pos.x, y: pos.y, z: -pos.z };

                const key = `${x},${y},${z} `;
                state[key] = { pos, quat: rot180Y }; // U2+B2 rotation overrides swap rotation
            }
            return state;
        };

        // Generate all 32 combinations: 4 layer states × 2^2 corner swaps × 2 mirror states
        for (const xMirror of [false, true]) {
            for (const swap1 of [false, true]) {
                for (const swap2 of [false, true]) {
                    states.push(baseFn(swap1, swap2, xMirror));      // Identity
                    states.push(u2Fn(swap1, swap2, xMirror));        // U2
                    states.push(b2Fn(swap1, swap2, xMirror));        // B2
                    states.push(u2b2Fn(swap1, swap2, xMirror));      // U2+B2
                }
            }
        }

        return states;
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

    // Calculate noise scale based on cube size
    const noiseScale = Math.max(1, maxDim / 4);
    const noiseSize = Math.floor(size / noiseScale);

    // Create a temporary canvas for the noise
    const noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = noiseSize;
    noiseCanvas.height = noiseSize;
    const noiseCtx = noiseCanvas.getContext('2d');

    // Fill with neutral normal (128, 128, 255)
    noiseCtx.fillStyle = 'rgb(128, 128, 255)';
    noiseCtx.fillRect(0, 0, noiseSize, noiseSize);

    // Add noise
    const imgData = noiseCtx.getImageData(0, 0, noiseSize, noiseSize);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
        // Perturb normals slightly
        const strength = 60;
        const noiseX = (Math.random() - 0.5) * strength;
        const noiseY = (Math.random() - 0.5) * strength;

        data[i] = Math.min(255, Math.max(0, 128 + noiseX));
        data[i + 1] = Math.min(255, Math.max(0, 128 + noiseY));
        data[i + 2] = 255; // Keep Z pointing up mostly
    }

    noiseCtx.putImageData(imgData, 0, 0);

    // Draw scaled noise onto main canvas with smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(noiseCanvas, 0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);

    // Enable mipmaps
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;

    if (state.renderer) {
        tex.anisotropy = state.renderer.capabilities.getMaxAnisotropy();
    }

    return tex;
}
