import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { StandardCube } from './StandardCube.js';
import { state } from '../shared/state.js';
import { CUBE_SIZE, SPACING, STICKER_BORDER_RADIUS, stickerVertexShader, stickerFragmentShader } from '../shared/constants.js';

export class MirrorCube extends StandardCube {
    constructor(config) {
        super(config);
        // Mirror Cube dimensions are passed in config
        // this.config.dimensions = { x, y, z };

        // Define the external boundaries of the cube relative to the center (0,0,0)
        // The internal cuts are fixed at +/- 0.5 * (CUBE_SIZE + SPACING)
        // We want asymmetric extensions.

        const S = CUBE_SIZE + SPACING;

        // Generate bounds dynamically based on dimensions
        this.bounds = this.generateBounds(this.config.dimensions);

        this.layerPositions = {
            x: [0, 0, 0], // Not used for geometry generation anymore, but kept for reference
            y: [0, 0, 0],
            z: [0, 0, 0]
        };
    }

    generateBounds(dims) {
        const S = CUBE_SIZE + SPACING;
        const bounds = { x: [], y: [], z: [] };

        // Helper to generate cuts for a dimension N
        const generateAxisCuts = (n, defaultMin, defaultMax) => {
            const cuts = [];
            // Start with outer boundary
            cuts.push(-defaultMin * S);

            // Internal cuts
            // Standard cube cuts are at (i - (N-1)/2 - 0.5) * S
            // Wait, standard cube centers are at (i - (N-1)/2) * S
            // So cuts are at (i - (N-1)/2 - 0.5) * S ? No.
            // For N=3: centers at -1, 0, 1. Cuts at -0.5, 0.5.
            // Formula: (i - (N)/2) * S
            // i goes from 1 to N-1

            for (let i = 1; i < n; i++) {
                const cutPos = (i - n / 2) * S;
                cuts.push(cutPos);
            }

            // End with outer boundary
            cuts.push(defaultMax * S);
            return cuts;
        };

        // Default multipliers for 3x3 (Left 1.4, Right 1.6, etc.)
        // We need to scale these or just apply them to the outer layers?
        // For generic N, we just want the outer boundaries to be asymmetric relative to the "center" of the mechanism.
        // The mechanism center is always 0,0,0.
        // The "standard" size would be from -N/2 * S to N/2 * S.

        // Let's define "asymmetry" as an offset to the standard size.
        // Standard min: -N/2 * S
        // Standard max: N/2 * S

        // We'll apply the 3x3 offsets to the outermost layers only?
        // Or just define the total size?

        // Let's stick to the 3x3 defaults for 3x3, and generalize for others.
        // For 3x3: -1.4 to 1.6. Total 3.0. Standard 3.0? No, standard is 3*S.
        // 1.4 + 1.6 = 3.0. So total width is standard. Just shifted.
        // Shift = (1.6 - 1.5) = 0.1?
        // Wait, 1.4 and 1.6 are multipliers of S?
        // If S=1, then -1.4 to 1.6 is width 3.0.
        // Standard 3x3 is -1.5 to 1.5. Width 3.0.
        // So it's just shifted by 0.1 * S.

        // Let's calculate the shift for each axis based on the 3x3 defaults.
        // X: -1.4, 1.6. Shift = +0.1
        // Y: -2.2, 0.8. Shift = -0.7
        // Z: -1.1, 1.9. Shift = +0.4

        const dx = dims.x;
        const dy = dims.y;
        const dz = dims.z;

        // If a dimension is 1, we must center it (shift = 0) to avoid the "orbiting" effect.
        // Otherwise, use the standard mirror cube offsets.
        const shiftX = dx === 1 ? 0 : 0.1;
        const shiftY = dy === 1 ? 0 : -0.7;
        const shiftZ = dz === 1 ? 0 : 0.4;

        bounds.x = generateAxisCuts(dx, dx / 2 - shiftX, dx / 2 + shiftX);
        bounds.y = generateAxisCuts(dy, dy / 2 - shiftY, dy / 2 + shiftY);
        bounds.z = generateAxisCuts(dz, dz / 2 - shiftZ, dz / 2 + shiftZ);

        return bounds;
    }

    createGeometry() {
        // Clear existing geometry if any
        this.cubieList.forEach(c => {
            if (c.parent) c.parent.remove(c);
        });
        this.cubieList.length = 0;
        state.activeDimensions = { ...this.config.dimensions };

        const goldColor = 0xFFD700; // Gold

        // Material for the core (black plastic)
        const coreMat = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.6,
            metalness: 0.1
        });

        const S = CUBE_SIZE + SPACING;
        const STICKER_MARGIN = 0.040; // User preferred margin
        const BORDER_RADIUS = 0.080; // User preferred radius

        // Generate sparkle normal map once
        if (!this.sparkleMap) {
            const dx = this.config.dimensions.x;
            const dy = this.config.dimensions.y;
            const dz = this.config.dimensions.z;
            const maxDim = Math.max(dx, dy, dz);
            this.sparkleMap = createSparkleMap(maxDim);
        }

        // Loop through grid based on dimensions
        this.stickers = [];

        const dx = this.config.dimensions.x;
        const dy = this.config.dimensions.y;
        const dz = this.config.dimensions.z;

        const offX = (dx - 1) / 2;
        const offY = (dy - 1) / 2;
        const offZ = (dz - 1) / 2;

        for (let ix = 0; ix < dx; ix++) {
            for (let iy = 0; iy < dy; iy++) {
                for (let iz = 0; iz < dz; iz++) {

                    // Map 0..N-1 to logical coordinates (e.g. -1, 0, 1)
                    // But here we just need indices for bounds array
                    // bounds array has N+1 elements (0 to N)

                    // Logical coordinates for positioning group (approximate, for rotation pivots)
                    const logX = ix - offX;
                    const logY = iy - offY;
                    const logZ = iz - offZ;

                    const group = new THREE.Group();
                    // Pivot position is standard grid position
                    group.position.set(logX * S, logY * S, logZ * S);

                    const x1 = this.bounds.x[ix];
                    const x2 = this.bounds.x[ix + 1];
                    const y1 = this.bounds.y[iy];
                    const y2 = this.bounds.y[iy + 1];
                    const z1 = this.bounds.z[iz];
                    const z2 = this.bounds.z[iz + 1];

                    const width = x2 - x1 - SPACING;
                    const height = y2 - y1 - SPACING;
                    const depth = z2 - z1 - SPACING;

                    const centerX = (x1 + x2) / 2;
                    const centerY = (y1 + y2) / 2;
                    const centerZ = (z1 + z2) / 2;

                    const offsetX = centerX - (logX * S);
                    const offsetY = centerY - (logY * S);
                    const offsetZ = centerZ - (logZ * S);

                    const coreGeo = new THREE.BoxGeometry(width, height, depth);
                    const core = new THREE.Mesh(coreGeo, coreMat);
                    core.position.set(offsetX, offsetY, offsetZ);
                    core.castShadow = true;
                    core.receiveShadow = true;
                    group.add(core);

                    const sx = width / 2 + 0.001;
                    const sy = height / 2 + 0.001;
                    const sz = depth / 2 + 0.001;

                    const faces = [
                        { axis: 'x', dir: 1, w: depth, h: height, rot: [0, Math.PI / 2, 0], pos: [sx, 0, 0] },
                        { axis: 'x', dir: -1, w: depth, h: height, rot: [0, -Math.PI / 2, 0], pos: [-sx, 0, 0] },
                        { axis: 'y', dir: 1, w: width, h: depth, rot: [-Math.PI / 2, 0, 0], pos: [0, sy, 0] },
                        { axis: 'y', dir: -1, w: width, h: depth, rot: [Math.PI / 2, 0, 0], pos: [0, -sy, 0] },
                        { axis: 'z', dir: 1, w: width, h: height, rot: [0, 0, 0], pos: [0, 0, sz] },
                        { axis: 'z', dir: -1, w: width, h: height, rot: [0, Math.PI, 0], pos: [0, 0, -sz] },
                    ];

                    faces.forEach(f => {
                        let isOuter = false;
                        if (f.axis === 'x') isOuter = (f.dir === 1 && ix === dx - 1) || (f.dir === -1 && ix === 0);
                        if (f.axis === 'y') isOuter = (f.dir === 1 && iy === dy - 1) || (f.dir === -1 && iy === 0);
                        if (f.axis === 'z') isOuter = (f.dir === 1 && iz === dz - 1) || (f.dir === -1 && iz === 0);

                        if (isOuter) {
                            // Calculate sticker dimensions with fixed margin
                            const sW = f.w - 2 * STICKER_MARGIN;
                            const sH = f.h - 2 * STICKER_MARGIN;

                            const geo = new THREE.PlaneGeometry(sW, sH);

                            // Create a custom MeshStandardMaterial
                            // This ensures all PBR features (lights, normal maps, etc.) work correctly.
                            // We use onBeforeCompile to inject the custom rounded corner alpha logic.

                            const stickerMat = new THREE.MeshStandardMaterial({
                                color: goldColor,
                                roughness: 0.4,
                                metalness: 0.6,
                                normalMap: this.sparkleMap,
                                normalScale: new THREE.Vector2(0.5, 0.5),
                                transparent: true,
                                side: THREE.DoubleSide
                            });

                            // We need to store the uniform references to update them later
                            stickerMat.userData.uSize = { value: new THREE.Vector2(sW, sH) };
                            stickerMat.userData.borderRadius = { value: BORDER_RADIUS };

                            stickerMat.onBeforeCompile = (shader) => {
                                shader.uniforms.uSize = stickerMat.userData.uSize;
                                shader.uniforms.borderRadius = stickerMat.userData.borderRadius;

                                // Inject custom varying for UV
                                shader.vertexShader = `
                                    varying vec2 vCustomUv;
                                ` + shader.vertexShader;

                                shader.vertexShader = shader.vertexShader.replace(
                                    '#include <uv_vertex>',
                                    `
                                    #include <uv_vertex>
                                    vCustomUv = uv;
                                    `
                                );

                                shader.fragmentShader = `
                                    uniform vec2 uSize;
                                    uniform float borderRadius;
                                    varying vec2 vCustomUv;
                                ` + shader.fragmentShader;

                                shader.fragmentShader = shader.fragmentShader.replace(
                                    '#include <dithering_fragment>',
                                    `
                                    #include <dithering_fragment>
                                    
                                    // Custom Rounded Rect Alpha
                                    vec2 pos = (vCustomUv - 0.5) * uSize;
                                    vec2 halfSize = uSize * 0.5;
                                    vec2 d = abs(pos) - (halfSize - borderRadius);
                                    float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - borderRadius;
                                    float alpha = 1.0 - smoothstep(0.0, 0.015, dist);
                                    
                                    gl_FragColor.a *= alpha;
                                    if (gl_FragColor.a < 0.01) discard;
                                    `
                                );
                            };

                            const sticker = new THREE.Mesh(geo, stickerMat);
                            sticker.castShadow = true;
                            sticker.receiveShadow = true;
                            // Apply offset to sticker position
                            sticker.position.set(
                                f.pos[0] + offsetX,
                                f.pos[1] + offsetY,
                                f.pos[2] + offsetZ
                            );
                            sticker.rotation.set(...f.rot);
                            sticker.userData = {
                                isSticker: true,
                                fullWidth: f.w,
                                fullHeight: f.h,
                                initialGeoW: sW,
                                initialGeoH: sH
                            };
                            group.add(sticker);
                            this.stickers.push(sticker);
                        }
                    });

                    group.userData = {
                        isCubie: true,
                        initialPosition: group.position.clone(),
                        initialSize: new THREE.Vector3(width, height, depth)
                    };
                    this.parent.add(group);
                    this.cubieList.push(group);
                }
            }
        }
    }

    updateStickers(margin, radius) {
        if (!this.stickers) return;
        this.stickers.forEach(sticker => {
            const fullW = sticker.userData.fullWidth;
            const fullH = sticker.userData.fullHeight;

            const newW = fullW - 2 * margin;
            const newH = fullH - 2 * margin;

            // Scale mesh to match new dimensions
            sticker.scale.set(
                newW / sticker.userData.initialGeoW,
                newH / sticker.userData.initialGeoH,
                1
            );

            // Update uniforms via userData references
            if (sticker.material.userData.uSize) {
                sticker.material.userData.borderRadius.value = radius;
                sticker.material.userData.uSize.value.set(newW, newH);
            }
        });
    }

    // Removed getCubiesInSlice override - StandardCube logic works because pivots are standard
    // Removed snapCubies override - StandardCube logic works because pivots are standard

    updateDimensions(offsets) {
        // offsets: { left, right, bottom, top, back, front }
        // All values are multipliers of S (or absolute offsets? Let's use multipliers of S for consistency with bounds)
        // Actually, the UI will probably pass absolute values or multipliers.
        // Let's assume the UI passes the raw values from the sliders, which we'll interpret as multipliers of S.

        // For generic dimensions, we need to be careful.
        // The sliders are currently hardcoded for 3x3 (Left/Right etc).
        // If we are in a non-3x3 mode, we might want to disable these or adapt them.
        // For now, let's assume this is mostly used for 3x3 or we apply the same "outer" shift logic.

        const dx = this.config.dimensions.x;
        const dy = this.config.dimensions.y;
        const dz = this.config.dimensions.z;

        // Re-use generateBounds logic but with overrides
        // We need to reconstruct the "shift" from the slider values?
        // Sliders give absolute multipliers for 3x3.
        // Left 1.4 -> Shift X = 1.5 - 1.4 = 0.1? No.
        // Standard 3x3 is -1.5 to 1.5.
        // Left slider 1.4 means x_min is -1.4 * S.
        // So shift is (-1.4 - (-1.5)) = 0.1.

        // Let's just use the slider values to set the outer boundaries directly for the current dimensions.
        // But wait, for 4x4, "Left" being 1.4 * S is too small! 4x4 is approx -2.0 to 2.0.
        // So the sliders should probably represent the *offset* or *shift* rather than absolute size?
        // OR, we just say the sliders only work for 3x3 for now.

        // If dimensions are NOT 3x3x3, we should probably ignore the specific slider values unless we map them intelligently.
        // Let's fallback to default generation if not 3x3x3 for now to avoid breaking things, 
        // OR map the sliders to the "shift" value.

        if (dx !== 3 || dy !== 3 || dz !== 3) {
            // Fallback to default generation for non-3x3 to keep it simple for now
            this.bounds = this.generateBounds(this.config.dimensions);
        } else {
            const left = offsets.left !== undefined ? offsets.left : 1.4;
            const right = offsets.right !== undefined ? offsets.right : 1.6;
            const bottom = offsets.bottom !== undefined ? offsets.bottom : 2.2;
            const top = offsets.top !== undefined ? offsets.top : 0.8;
            const back = offsets.back !== undefined ? offsets.back : 1.1;
            const front = offsets.front !== undefined ? offsets.front : 1.9;

            const S = CUBE_SIZE + SPACING;
            const cut = 0.5 * S;

            // Hardcoded for 3x3 structure
            this.bounds = {
                x: [-left * S, -cut, cut, right * S],
                y: [-bottom * S, -cut, cut, top * S],
                z: [-back * S, -cut, cut, front * S]
            };
        }

        // Regenerate geometry
        this.createGeometry();
    }

    isSolved() {
        // Check if the puzzle is solved by verifying shape.
        // We check if each piece is in its initial position and if its current dimensions 
        // (in world space, relative to the puzzle's global rotation) match its initial dimensions.
        // This allows symmetric pieces to be rotated (e.g. 90 or 180 degrees) as long as they fit.

        const cubies = this.cubieList;
        if (!cubies || cubies.length === 0) return false;

        const epsilon = 0.1;

        // Use the first cubie to determine the global rotation of the puzzle.
        // NOTE: This assumes the first cubie (usually a corner) is asymmetric enough 
        // or that we can trust its orientation. 
        // If the first cubie is perfectly symmetric (cube), this might be ambiguous.
        // However, in a generated Mirror Cube, pieces are rarely perfect cubes unless 1x1x1.
        const refCubie = cubies[0];
        const refQ = refCubie.quaternion.clone();
        const invRefQ = refQ.clone().invert();

        for (let i = 0; i < cubies.length; i++) {
            const cubie = cubies[i];
            if (!cubie.userData.initialPosition || !cubie.userData.initialSize) {
                console.warn("MirrorCube: Missing initial data for cubie", i);
                return false;
            }

            // 1. Check Relative Position
            // currentPos = initialPos.applyQuaternion(globalRotation)
            // So: currentPos.applyQuaternion(inverseGlobalRotation) should == initialPos
            const currentPos = cubie.position.clone();
            const unrotatedPos = currentPos.applyQuaternion(invRefQ);

            if (unrotatedPos.distanceTo(cubie.userData.initialPosition) > epsilon) {
                console.log(`MirrorCube: Position mismatch for cubie ${i}. Dist: ${unrotatedPos.distanceTo(cubie.userData.initialPosition)}`);
                console.log(`  Current (Unrotated): ${JSON.stringify(unrotatedPos)}`);
                console.log(`  Initial: ${JSON.stringify(cubie.userData.initialPosition)}`);
                return false;
            }

            // 2. Check Dimensions (Shape Fit)
            // We want to know if the piece's current orientation results in the same 
            // bounding box dimensions as its initial orientation.

            // Calculate relative rotation of this piece vs the reference (global) rotation
            const relQ = cubie.quaternion.clone().multiply(invRefQ);

            // Apply this relative rotation to the initial size vector
            // We take absolute values because dimensions are magnitude.
            // e.g. if size is (1, 2, 3) and rotated 90 deg around Z, it becomes (-2, 1, 3). Abs -> (2, 1, 3).
            const currentDims = cubie.userData.initialSize.clone().applyQuaternion(relQ);
            currentDims.x = Math.abs(currentDims.x);
            currentDims.y = Math.abs(currentDims.y);
            currentDims.z = Math.abs(currentDims.z);

            // Compare with initial size
            if (currentDims.distanceTo(cubie.userData.initialSize) > epsilon) {
                console.log(`MirrorCube: Dimension mismatch for cubie ${i}`);
                console.log(`  Current Dims: ${JSON.stringify(currentDims)}`);
                console.log(`  Initial Dims: ${JSON.stringify(cubie.userData.initialSize)}`);
                return false;
            }
        }

        return true;
    }
}

function createSparkleMap(maxDim = 3) {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Calculate noise scale based on cube size
    // Larger cubes = larger grains to prevent aliasing when zoomed out
    // For 3x3: scale 1. For 17x17: scale ~4
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

    // Draw scaled noise onto main canvas with smoothing to reduce harsh pixel edges
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(noiseCanvas, 0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);

    // Enable mipmaps to prevent aliasing at distance
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;

    if (state.renderer) {
        tex.anisotropy = state.renderer.capabilities.getMaxAnisotropy();
    }

    return tex;
}
