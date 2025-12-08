import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { state } from '../shared/state.js';
import { CUBE_SIZE, SPACING, COLORS, CORE_COLOR, STICKER_BORDER_RADIUS, stickerVertexShader, stickerFragmentShader } from '../shared/constants.js';

export async function createCube() {
    if (!state.activePuzzle) {
        console.error("activePuzzle not set!");
        return;
    }
    await state.activePuzzle.createGeometry();
}

export function getCubiesInSlice(axis, value) {
    return state.allCubies.filter(cubie => Math.abs(cubie.position[axis] - value) < 0.01);
}
