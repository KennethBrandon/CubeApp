import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { StandardCube } from './StandardCube.js';
import { state } from '../shared/state.js';
import { CUBE_SIZE, SPACING, STICKER_BORDER_RADIUS, stickerVertexShader, stickerFragmentShader } from '../shared/constants.js';

export class MirrorCube extends StandardCube {
    constructor(config) {
        super(config);
        // Mirror Cube is always 3x3x3
        this.config.dimensions = { x: 3, y: 3, z: 3 };

        // Define the external boundaries of the cube relative to the center (0,0,0)
        // The internal cuts are fixed at +/- 0.5 * (CUBE_SIZE + SPACING)
        // We want asymmetric extensions.
        // Let's define the total size we want.
        // Standard cube extends from -1.5*S to 1.5*S (approx).
        // Dimensions based on user feedback (Left 1.4, Right 1.6, Bottom 2.2, Top 0.8, Back 1.1, Front 1.9)

        const S = CUBE_SIZE + SPACING;
        const cut = 0.5 * S; // Internal cut positions must remain symmetric for mechanism

        this.bounds = {
            // Left (-x) to Right (+x)
            x: [-1.4 * S, -cut, cut, 1.6 * S],
            // Bottom (-y) to Top (+y)
            y: [-2.2 * S, -cut, cut, 0.8 * S],
            // Back (-z) to Front (+z)
            z: [-1.1 * S, -cut, cut, 1.9 * S]
        };

        this.layerPositions = {
            x: [0, 0, 0], // Not used for geometry generation anymore, but kept for reference
            y: [0, 0, 0],
            z: [0, 0, 0]
        };
    }

    createGeometry() {
        // Clear existing geometry if any (handled by caller usually, but good to be safe)
        // In this architecture, createGeometry is called on a fresh instance or after clear.
        state.allCubies.forEach(c => {
            if (c.parent) c.parent.remove(c);
        });
        state.allCubies = [];
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

        // Custom shader for rectangular stickers with uniform border radius
        const rectStickerFragmentShader = `
            uniform vec3 color;
            uniform float borderRadius;
            uniform float opacity;
            uniform vec2 uSize;
            varying vec2 vUv;

            void main() {
                // Convert UV to centered world coordinates
                vec2 pos = (vUv - 0.5) * uSize;
                vec2 halfSize = uSize * 0.5;
                
                // Calculate distance field for rounded box
                // d is distance from the inner "box" (size minus radius)
                vec2 d = abs(pos) - (halfSize - borderRadius);
                float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - borderRadius;
                
                // Antialiasing
                float alpha = 1.0 - smoothstep(0.0, 0.015, dist);
                
                if (alpha < 0.1) discard;
                gl_FragColor = vec4(color, alpha * opacity);
            }
        `;

        // Loop through 3x3x3 grid
        this.stickers = [];
        for (let ix = -1; ix <= 1; ix++) {
            for (let iy = -1; iy <= 1; iy++) {
                for (let iz = -1; iz <= 1; iz++) {

                    const group = new THREE.Group();
                    group.position.set(ix * S, iy * S, iz * S);

                    const x1 = this.bounds.x[ix + 1];
                    const x2 = this.bounds.x[ix + 2];
                    const y1 = this.bounds.y[iy + 1];
                    const y2 = this.bounds.y[iy + 2];
                    const z1 = this.bounds.z[iz + 1];
                    const z2 = this.bounds.z[iz + 2];

                    const width = x2 - x1 - SPACING;
                    const height = y2 - y1 - SPACING;
                    const depth = z2 - z1 - SPACING;

                    const centerX = (x1 + x2) / 2;
                    const centerY = (y1 + y2) / 2;
                    const centerZ = (z1 + z2) / 2;

                    const offsetX = centerX - (ix * S);
                    const offsetY = centerY - (iy * S);
                    const offsetZ = centerZ - (iz * S);

                    const coreGeo = new THREE.BoxGeometry(width, height, depth);
                    const core = new THREE.Mesh(coreGeo, coreMat);
                    core.position.set(offsetX, offsetY, offsetZ);
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
                        if (f.axis === 'x') isOuter = (f.dir === 1 && ix === 1) || (f.dir === -1 && ix === -1);
                        if (f.axis === 'y') isOuter = (f.dir === 1 && iy === 1) || (f.dir === -1 && iy === -1);
                        if (f.axis === 'z') isOuter = (f.dir === 1 && iz === 1) || (f.dir === -1 && iz === -1);

                        if (isOuter) {
                            // Calculate sticker dimensions with fixed margin
                            const sW = f.w - 2 * STICKER_MARGIN;
                            const sH = f.h - 2 * STICKER_MARGIN;

                            const geo = new THREE.PlaneGeometry(sW, sH);
                            const stickerMat = new THREE.ShaderMaterial({
                                uniforms: {
                                    color: { value: new THREE.Color(goldColor) },
                                    borderRadius: { value: BORDER_RADIUS },
                                    opacity: { value: 1.0 },
                                    uSize: { value: new THREE.Vector2(sW, sH) }
                                },
                                vertexShader: stickerVertexShader,
                                fragmentShader: rectStickerFragmentShader,
                                transparent: true,
                                side: THREE.DoubleSide
                            });

                            const sticker = new THREE.Mesh(geo, stickerMat);
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

                    group.userData = { isCubie: true };
                    state.cubeWrapper.add(group);
                    state.allCubies.push(group);
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
            // initialGeoW is the size of the PlaneGeometry created
            sticker.scale.set(
                newW / sticker.userData.initialGeoW,
                newH / sticker.userData.initialGeoH,
                1
            );

            // Update uniforms
            if (sticker.material.uniforms) {
                sticker.material.uniforms.borderRadius.value = radius;
                sticker.material.uniforms.uSize.value.set(newW, newH);
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

        const S = CUBE_SIZE + SPACING;
        const cut = 0.5 * S;

        // Default multipliers if not provided
        // Current defaults:
        // x: [-1.1, 1.9] -> left: 1.1, right: 1.9
        // y: [-1.9, 1.1] -> bottom: 1.9, top: 1.1
        // z: [-1.1, 1.9] -> back: 1.1, front: 1.9

        const left = offsets.left !== undefined ? offsets.left : 1.4;
        const right = offsets.right !== undefined ? offsets.right : 1.6;
        const bottom = offsets.bottom !== undefined ? offsets.bottom : 2.2;
        const top = offsets.top !== undefined ? offsets.top : 0.8;
        const back = offsets.back !== undefined ? offsets.back : 1.1;
        const front = offsets.front !== undefined ? offsets.front : 1.9;

        this.bounds = {
            x: [-left * S, -cut, cut, right * S],
            y: [-bottom * S, -cut, cut, top * S],
            z: [-back * S, -cut, cut, front * S]
        };

        // Regenerate geometry
        this.createGeometry();
    }

    isSolved() {
        // Check orientation of all cubies
        const epsilon = 0.1;
        for (const cubie of state.allCubies) {
            const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cubie.quaternion);
            const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(cubie.quaternion);

            if (Math.abs(up.y - 1) > epsilon || Math.abs(fwd.z - 1) > epsilon) {
                return false;
            }
        }
        return true;
    }
}
