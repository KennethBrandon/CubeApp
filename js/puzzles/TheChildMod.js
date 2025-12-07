import * as THREE from 'three';
import { StandardCube } from './StandardCube.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { Brush, Evaluator, INTERSECTION } from 'three-bvh-csg';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CUBE_SIZE, SPACING } from '../shared/constants.js';
import { state } from '../shared/state.js';

export class TheChildMod extends StandardCube {
    constructor(config) {
        super(config);
        this.config.dimensions = { x: 2, y: 3, z: 2 };
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
        this.createPlaceholders();

        // Check if we already have the geometry cached
        if (this.originalGeometry) {
            // Synchronous rebuild - prevents flash
            this.processSTL(this.originalGeometry, null, null, { x: 2.66, y: 0, z: 3.04 });
        } else {
            // Load the STL (Async)
            const loader = new STLLoader();
            loader.load('assets/3d/baby_yoda.stl', (geometry) => {
                this.processSTL(geometry, null, null, { x: 2.66, y: 0, z: 3.04 });
            }, undefined, (error) => {
                console.error('Error loading Baby Yoda STL:', error);
            });
        }
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
                    group.add(hitBox);

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
            color: 0x74C947, // Yoda Green
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
        const evaluator = new Evaluator();
        evaluator.attributes = ['position', 'normal', 'uv'];

        this.cubieList.forEach(group => {
            const { x, y, z } = group.userData.gridPos;

            // Remove existing mesh if any (except placeholder)
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
            boxGeo.deleteAttribute('color');

            const boxBrush = new Brush(boxGeo);

            boxBrush.position.set(
                x * CUBE_SIZE,
                y * CUBE_SIZE,
                z * CUBE_SIZE
            );
            boxBrush.updateMatrixWorld();

            try {
                const result = evaluator.evaluate(sourceBrush, boxBrush, INTERSECTION);
                result.material = material;

                // Position correction
                result.position.set(-x * CUBE_SIZE, -y * CUBE_SIZE, -z * CUBE_SIZE);

                // Remove placeholder if it exists
                const placeholder = group.children.find(c => c.userData.isPlaceholder);
                if (placeholder) {
                    group.remove(placeholder);
                }

                group.add(result);
            } catch (e) {
                console.error("CSG Error for piece", x, y, z, e);
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
            const { scale, spacing, offset, roughness, metalness, normalScale, outerScale, filletRadius } = params;

            const geomChanged = (scale !== undefined && scale !== this.currentScale) ||
                (spacing !== undefined && spacing !== this.currentSpacing) ||
                (offset && (offset.x !== this.currentOffset?.x || offset.y !== this.currentOffset?.y || offset.z !== this.currentOffset?.z)) ||
                (outerScale !== undefined && outerScale !== this.currentOuterScale) ||
                (filletRadius !== undefined && filletRadius !== this.currentFilletRadius);

            if (scale !== undefined && !isNaN(scale)) this.currentScale = scale;
            if (offset) this.currentOffset = { ...offset };
            if (roughness !== undefined && !isNaN(roughness)) this.currentRoughness = roughness;
            if (metalness !== undefined && !isNaN(metalness)) this.currentMetalness = metalness;
            if (normalScale !== undefined && !isNaN(normalScale)) this.currentNormalScale = normalScale;
            if (outerScale !== undefined && !isNaN(outerScale)) this.currentOuterScale = outerScale;
            if (filletRadius !== undefined && !isNaN(filletRadius)) this.currentFilletRadius = filletRadius;

            if (geomChanged) {
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
        const identity = new THREE.Quaternion();
        for (const group of this.cubieList) {
            const { x, y, z } = group.userData.gridPos;
            const key = `${x},${y},${z} `;
            state[key] = { pos: { x, y, z }, quat: identity };
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
