import * as THREE from 'three';
import { StandardCube } from './StandardCube.js';
import { CUBE_SIZE, SPACING, COLORS, CORE_COLOR, STICKER_BORDER_RADIUS, stickerVertexShader, stickerFragmentShader } from '../shared/constants.js';
import { state } from '../shared/state.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export class VoidCube extends StandardCube {
    constructor(config) {
        super(config);
        // Void cube is always 3x3x3
        this.config.dimensions = { x: 3, y: 3, z: 3 };
    }

    createGeometry() {
        // Clear existing geometry
        this.cubieList.forEach(c => {
            if (c.parent) c.parent.remove(c);
        });
        this.cubieList.length = 0;

        state.activeDimensions = { ...this.config.dimensions };

        // Use RoundedBoxGeometry for a "machined" look with filleted edges
        const baseGeo = new RoundedBoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE, 4, 0.074);

        const coreMat = new THREE.MeshStandardMaterial({
            color: CORE_COLOR,
            roughness: 0.6,
            metalness: 0.1,
            transparent: true,
            opacity: 1.0
        });

        const dimX = state.activeDimensions.x;
        const dimY = state.activeDimensions.y;
        const dimZ = state.activeDimensions.z;

        const offsetX = (dimX - 1) / 2;
        const offsetY = (dimY - 1) / 2;
        const offsetZ = (dimZ - 1) / 2;

        this.stickers = [];

        for (let x = -offsetX; x <= offsetX; x++) {
            for (let y = -offsetY; y <= offsetY; y++) {
                for (let z = -offsetZ; z <= offsetZ; z++) {
                    // Skip center pieces (core pieces with exactly one sticker)
                    // A center piece has exactly one coordinate at max position
                    const isCenter = (Math.abs(x) < 0.1 && Math.abs(y) < 0.1) ||
                        (Math.abs(x) < 0.1 && Math.abs(z) < 0.1) ||
                        (Math.abs(y) < 0.1 && Math.abs(z) < 0.1);

                    if (isCenter) continue; // Skip center pieces for void cube

                    const group = new THREE.Group();
                    const S = CUBE_SIZE + this.getSpacing();
                    group.position.set(
                        x * S,
                        y * S,
                        z * S
                    );

                    const core = new THREE.Mesh(baseGeo, coreMat);
                    core.scale.set(0.98, 0.98, 0.98);
                    group.add(core);

                    // Sticker Size 0.800 (User Preference)
                    const stickerGeo = new THREE.PlaneGeometry(0.800, 0.800);
                    const stickerOffset = CUBE_SIZE / 2 + 0.001;

                    const faces = [
                        { axis: 'x', val: offsetX, rot: [0, Math.PI / 2, 0], pos: [stickerOffset, 0, 0], color: COLORS[0] },
                        { axis: 'x', val: -offsetX, rot: [0, -Math.PI / 2, 0], pos: [-stickerOffset, 0, 0], color: COLORS[1] },
                        { axis: 'y', val: offsetY, rot: [-Math.PI / 2, 0, 0], pos: [0, stickerOffset, 0], color: COLORS[2] },
                        { axis: 'y', val: -offsetY, rot: [Math.PI / 2, 0, 0], pos: [0, -stickerOffset, 0], color: COLORS[3] },
                        { axis: 'z', val: offsetZ, rot: [0, 0, 0], pos: [0, 0, stickerOffset], color: COLORS[4] },
                        { axis: 'z', val: -offsetZ, rot: [0, Math.PI, 0], pos: [0, 0, -stickerOffset], color: COLORS[5] },
                    ];

                    faces.forEach(f => {
                        if ((f.axis === 'x' && Math.abs(x - f.val) < 0.1) ||
                            (f.axis === 'y' && Math.abs(y - f.val) < 0.1) ||
                            (f.axis === 'z' && Math.abs(z - f.val) < 0.1)) {

                            const stickerMat = new THREE.ShaderMaterial({
                                uniforms: {
                                    color: { value: new THREE.Color(f.color) },
                                    borderRadius: { value: STICKER_BORDER_RADIUS },
                                    opacity: { value: 1.0 }
                                },
                                vertexShader: stickerVertexShader,
                                fragmentShader: stickerFragmentShader,
                                transparent: true,
                                side: THREE.DoubleSide
                            });

                            const sticker = new THREE.Mesh(stickerGeo, stickerMat);
                            sticker.position.set(...f.pos);
                            sticker.rotation.set(...f.rot);
                            sticker.userData = { isSticker: true, originalColor: f.color, initialScale: 1.0 };
                            group.add(sticker);
                            this.stickers.push(sticker);
                        }
                    });

                    group.userData = { isCubie: true, gridPos: { x, y, z } };
                    this.parent.add(group);
                    this.cubieList.push(group);
                }
            }
        }
    }

    getSpacing() {
        return SPACING;
    }
}
