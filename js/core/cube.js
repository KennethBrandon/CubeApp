import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { state } from '../shared/state.js';
import { CUBE_SIZE, SPACING, COLORS, CORE_COLOR, STICKER_BORDER_RADIUS, stickerVertexShader, stickerFragmentShader } from '../shared/constants.js';

export function createCube() {
    state.allCubies.forEach(c => {
        if (c.parent) c.parent.remove(c);
    });
    state.allCubies = [];
    state.activeDimensions = { ...state.cubeDimensions };

    let baseGeo = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE, 4, 4, 4);
    baseGeo = mergeVertices(baseGeo);
    baseGeo.computeVertexNormals();

    const coreMat = new THREE.MeshStandardMaterial({
        color: CORE_COLOR,
        roughness: 0.6,
        metalness: 0.1,
        transparent: true,
        opacity: 1.0
    });

    const dimX = state.cubeDimensions.x;
    const dimY = state.cubeDimensions.y;
    const dimZ = state.cubeDimensions.z;

    const offsetX = (dimX - 1) / 2;
    const offsetY = (dimY - 1) / 2;
    const offsetZ = (dimZ - 1) / 2;

    for (let x = -offsetX; x <= offsetX; x++) {
        for (let y = -offsetY; y <= offsetY; y++) {
            for (let z = -offsetZ; z <= offsetZ; z++) {

                const group = new THREE.Group();
                group.position.set(
                    x * (CUBE_SIZE + SPACING),
                    y * (CUBE_SIZE + SPACING),
                    z * (CUBE_SIZE + SPACING)
                );

                const core = new THREE.Mesh(baseGeo, coreMat);
                core.scale.set(0.98, 0.98, 0.98);
                group.add(core);

                const stickerGeo = new THREE.PlaneGeometry(0.88, 0.88);
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
                        sticker.userData = { isSticker: true, originalColor: f.color };
                        group.add(sticker);
                    }
                });

                group.userData = { isCubie: true };
                state.scene.add(group);
                state.allCubies.push(group);
            }
        }
    }
}

export function getCubiesInSlice(axis, value) {
    return state.allCubies.filter(cubie => Math.abs(cubie.position[axis] - value) < 0.01);
}
