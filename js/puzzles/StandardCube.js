import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Puzzle } from './Puzzle.js';
import min2phase from '../lib/min2phase.js';
import { state } from '../shared/state.js';
import { CUBE_SIZE, SPACING, COLORS, CORE_COLOR, STICKER_BORDER_RADIUS, stickerVertexShader, stickerFragmentShader } from '../shared/constants.js';
import { queueMove } from '../game/moves.js';

export class StandardCube extends Puzzle {
    constructor(config) {
        super(config);
        // config.dimensions = { x, y, z }
        // config.parent = THREE.Group (optional, defaults to state.cubeWrapper)
        // config.cubieList = Array (optional, defaults to state.allCubies)

        this.parent = config.parent || state.cubeWrapper;
        this.cubieList = config.cubieList || state.allCubies;
        this.isCubic = true;

        // Rotation tuning for whole-cube moves (x, y, z)
        // Managed by RotationTuner.js
        this.rotationTuning = {
            x: { negate: false, scale: 1 },
            y: { negate: false, scale: 1 },
            z: { negate: false, scale: 1 }
        };
    }

    createGeometry() {
        // Clear existing geometry from the specific parent and list
        this.cubieList.forEach(c => {
            if (c.parent) c.parent.remove(c);
        });

        this.cubieList.length = 0;
        state.activeDimensions = { ...this.config.dimensions };

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
                    const group = new THREE.Group();
                    const S = CUBE_SIZE + this.getSpacing();
                    group.position.set(x * S, y * S, z * S);

                    const core = new THREE.Mesh(baseGeo, coreMat);
                    core.scale.set(0.98, 0.98, 0.98);
                    core.castShadow = true;
                    core.receiveShadow = true;
                    group.add(core);

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
                            sticker.castShadow = true;
                            sticker.receiveShadow = true;
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

    getRotationAxes() {
        return {
            x: new THREE.Vector3(1, 0, 0),
            y: new THREE.Vector3(0, 1, 0),
            z: new THREE.Vector3(0, 0, 1)
        };
    }

    isSolved() {
        const directions = [
            new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
            new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)
        ];

        let isAllSolved = true;
        for (const faceDir of directions) {
            let faceColorHex = null;
            let stickerCount = 0;
            for (const group of this.cubieList) {
                for (const child of group.children) {
                    if (child.userData.isSticker) {
                        const normal = new THREE.Vector3(0, 0, 1);
                        normal.applyQuaternion(child.quaternion);
                        normal.applyQuaternion(group.quaternion);
                        const dotProduct = normal.dot(faceDir);
                        if (dotProduct > 0.9) {
                            const stickerColor = child.material.uniforms.color.value.getHex();
                            stickerCount++;
                            if (faceColorHex === null) faceColorHex = stickerColor;
                            else if (faceColorHex !== stickerColor) { isAllSolved = false; break; }
                        }
                    }
                }
                if (!isAllSolved) break;
            }
            if (stickerCount === 0) isAllSolved = false;
            if (!isAllSolved) break;
        }
        return isAllSolved;
    }

    getCubiesInSlice(axis, value) {
        return this.cubieList.filter(cubie => Math.abs(cubie.position[axis] - value) < 0.01);
    }

    getSliceCubies(axis, value) {
        return this.getCubiesInSlice(axis, value);
    }

    getCycleLength() {
        return 4;
    }

    handleKeyDown(event) {
        const key = event.key;
        if (!key) return false;

        const upperKey = key.toUpperCase();
        const shift = event.shiftKey;
        const direction = shift ? -1 : 1;

        let layer = 1;
        if (state.activeKeys) {
            if (state.activeKeys.has('0') || state.activeKeys.has(')')) layer = 10;
            else if (state.activeKeys.has('9') || state.activeKeys.has('(')) layer = 9;
            else if (state.activeKeys.has('8') || state.activeKeys.has('*')) layer = 8;
            else if (state.activeKeys.has('7') || state.activeKeys.has('&')) layer = 7;
            else if (state.activeKeys.has('6') || state.activeKeys.has('^')) layer = 6;
            else if (state.activeKeys.has('5') || state.activeKeys.has('%')) layer = 5;
            else if (state.activeKeys.has('4') || state.activeKeys.has('$')) layer = 4;
            else if (state.activeKeys.has('3') || state.activeKeys.has('#')) layer = 3;
            else if (state.activeKeys.has('2') || state.activeKeys.has('@')) layer = 2;
        }

        if (['R', 'L', 'U', 'D', 'F', 'B', 'M', 'E', 'S', 'X', 'Y', 'Z'].includes(upperKey)) {
            let axis = '';
            if (['R', 'L', 'M', 'X'].includes(upperKey)) axis = 'x';
            else if (['U', 'D', 'E', 'Y'].includes(upperKey)) axis = 'y';
            else if (['F', 'B', 'S', 'Z'].includes(upperKey)) axis = 'z';

            const dims = state.activeDimensions || state.cubeDimensions || this.config.dimensions;
            const axisDim = dims[axis];

            if (['M', 'E', 'S'].includes(upperKey) && axisDim % 2 === 0) return true;
            if (layer > axisDim) return true;

            let finalDir = direction;
            if (this.isFaceRectangular(axis)) finalDir = 2;

            const S = CUBE_SIZE + this.getSpacing();
            const maxIndex = (axisDim - 1) / 2;
            let sliceVal = 0;

            if (['X', 'Y', 'Z'].includes(upperKey)) {
                sliceVal = Infinity;
            } else if (['M', 'E', 'S'].includes(upperKey)) {
                sliceVal = 0;
            } else if (layer > 1) {
                if (['R', 'U', 'F'].includes(upperKey)) sliceVal = (maxIndex - (layer - 1)) * S;
                else sliceVal = (-maxIndex + (layer - 1)) * S;
            } else {
                if (['R', 'U', 'F'].includes(upperKey)) sliceVal = maxIndex * S;
                else sliceVal = -maxIndex * S;
            }

            queueMove(axis, finalDir, state.animationSpeed, sliceVal);
            return true;
        }
        return false;
    }

    getMoveInfo(axisStr, direction, sliceVal) {
        // Handle Whole Cube Rotations (x, y, z)
        if (sliceVal === Infinity || isNaN(parseInt(axisStr)) || ['x', 'y', 'z', 'X', 'Y', 'Z'].includes(axisStr)) {
            const rotAxis = this.getLockedRotationAxis(axisStr);
            return {
                axisVector: rotAxis || new THREE.Vector3(0, 1, 0),
                cubies: this.cubieList,
                angle: direction * (Math.PI / 2)
            };
        }

        let axisVector = new THREE.Vector3();
        let cubies = [];

        const S = CUBE_SIZE + this.getSpacing();
        const dims = state.activeDimensions || this.config.dimensions;

        if (['R', 'L', 'U', 'D', 'F', 'B', 'M', 'E', 'S', 'X', 'Y', 'Z'].includes(axisStr)) {
            if (['R', 'L', 'M', 'X'].includes(axisStr)) {
                axisVector.set(1, 0, 0);
            } else if (['U', 'D', 'E', 'Y'].includes(axisStr)) {
                axisVector.set(0, 1, 0);
            } else if (['F', 'B', 'S', 'Z'].includes(axisStr)) {
                axisVector.set(0, 0, 1);
            }

            if (sliceVal === null) {
                const maxIndexX = (dims.x - 1) / 2;
                const maxIndexY = (dims.y - 1) / 2;
                const maxIndexZ = (dims.z - 1) / 2;
                if (axisStr === 'R') sliceVal = maxIndexX * S;
                else if (axisStr === 'L') sliceVal = -maxIndexX * S;
                else if (axisStr === 'U') sliceVal = maxIndexY * S;
                else if (axisStr === 'D') sliceVal = -maxIndexY * S;
                else if (axisStr === 'F') sliceVal = maxIndexZ * S;
                else if (axisStr === 'B') sliceVal = -maxIndexZ * S;
                else if (['M', 'E', 'S'].includes(axisStr)) sliceVal = 0;
                else if (['X', 'Y', 'Z'].includes(axisStr)) sliceVal = Infinity;
            }
        }

        let shouldNegate = false;
        if (axisVector.x !== 0) { if (sliceVal > 0.1) shouldNegate = true; }
        else if (axisVector.y !== 0) { if (sliceVal > 0.1) shouldNegate = true; }
        else if (axisVector.z !== 0) { if (sliceVal > -0.1) shouldNegate = true; }

        if (['R', 'U', 'F', 'S'].includes(axisStr)) shouldNegate = true;
        if (shouldNegate) axisVector.negate();

        if (sliceVal !== Infinity) {
            let searchAxis = axisVector.x !== 0 ? 'x' : (axisVector.y !== 0 ? 'y' : 'z');
            cubies = this.getCubiesInSlice(searchAxis, sliceVal);
        } else {
            cubies = this.cubieList;
        }

        return { axisVector, cubies, angle: direction * (Math.PI / 2), axis: axisStr, sliceVal };
    }

    getNotation(axis, sliceVal, turns, isDrag, dragRotationAxis) {
        const S = CUBE_SIZE + this.getSpacing();
        const epsilon = 0.1;
        const dims = state.activeDimensions || state.cubeDimensions;
        const axisDim = dims[axis] || dims['x'];
        const maxIndex = (axisDim - 1) / 2;

        let logTurns = turns;

        // 1. Handle global axis inversion for drags (previously in moves.js)
        // Only if it's a drag and we have a negative drag axis, flip the notation interpretation.
        if (isDrag && dragRotationAxis) {
            if (axis === 'x' && dragRotationAxis.x < -0.5) logTurns *= -1;
            if (axis === 'y' && dragRotationAxis.y < -0.5) logTurns *= -1;
            if (axis === 'z' && dragRotationAxis.z < -0.5) logTurns *= -1;
        }

        // 2. Handle slice-based inversion (R, U, F/S follow L, D, B directions in 3D but have inverted notation)
        if (sliceVal !== Infinity) {
            if (axis === 'x' && sliceVal > 0.1) logTurns *= -1; // R only
            else if (axis === 'y' && sliceVal > 0.1) logTurns *= -1; // U only
            else if (axis === 'z' && sliceVal > -0.1) logTurns *= -1; // F and S
        }

        let char = '';
        if (sliceVal === Infinity) {
            if (axis === 'x') char = 'x';
            else if (axis === 'y') char = 'y';
            else if (axis === 'z') char = 'z';
        } else if (axis === 'x') {
            const index = Math.round(sliceVal / S * 10) / 10;
            if (Math.abs(index - maxIndex) < epsilon) char = 'R';
            else if (Math.abs(index + maxIndex) < epsilon) char = 'L';
            else if (Math.abs(index) < epsilon) char = 'M';
            else char = (index > 0 ? Math.round(maxIndex - index + 1) + 'R' : Math.round(maxIndex - Math.abs(index) + 1) + 'L');
        } else if (axis === 'y') {
            const index = Math.round(sliceVal / S * 10) / 10;
            if (Math.abs(index - maxIndex) < epsilon) char = 'U';
            else if (Math.abs(index + maxIndex) < epsilon) char = 'D';
            else if (Math.abs(index) < epsilon) char = 'E';
            else char = (index > 0 ? Math.round(maxIndex - index + 1) + 'U' : Math.round(maxIndex - Math.abs(index) + 1) + 'D');
        } else if (axis === 'z') {
            const index = Math.round(sliceVal / S * 10) / 10;
            if (Math.abs(index - maxIndex) < epsilon) char = 'F';
            else if (Math.abs(index + maxIndex) < epsilon) char = 'B';
            else if (Math.abs(index) < epsilon) char = 'S';
            else char = (index > 0 ? Math.round(maxIndex - index + 1) + 'F' : Math.round(maxIndex - Math.abs(index) + 1) + 'B');
        } else {
            if (['R', 'L', 'U', 'D', 'F', 'B'].includes(axis)) char = axis;
        }

        if (!char) return null;
        let t = logTurns % 4;
        if (t === 3) t = -1;
        if (t === -3) t = 1;

        let suffix = Math.abs(t) === 2 ? '2' : (t < 0 ? "'" : "");
        if (t === 0) return null;
        return char + suffix;
    }

    async getScramble(numMoves = 25) {
        const dims = this.config.dimensions;
        const isWCA = dims.x === 3 && dims.y === 3 && dims.z === 3;
        if (isWCA) {
            try {
                min2phase.initFull();
                const randomState = min2phase.randomCube();
                const solution = min2phase.solve(randomState);
                const scrambleString = this.invertScrambleString(solution);
                return this.parseScrambleString(scrambleString);
            } catch (e) { console.warn("min2phase failed", e); }
        }

        let scrambleMoves = [];
        const S = CUBE_SIZE + this.getSpacing();
        let lastAxis = '', lastLayer = -999;
        for (let i = 0; i < numMoves; i++) {
            let axis, layerNum, sliceVal;
            do {
                const totalLayers = state.activeDimensions.x + state.activeDimensions.y + state.activeDimensions.z;
                const rand = Math.random() * totalLayers;
                if (rand < state.activeDimensions.x) {
                    axis = 'x'; const dim = state.activeDimensions.x;
                    const rawIndex = Math.floor(Math.random() * dim);
                    sliceVal = (rawIndex - (dim - 1) / 2) * S; layerNum = rawIndex;
                } else if (rand < state.activeDimensions.x + state.activeDimensions.y) {
                    axis = 'y'; const dim = state.activeDimensions.y;
                    const rawIndex = Math.floor(Math.random() * dim);
                    sliceVal = (rawIndex - (dim - 1) / 2) * S; layerNum = rawIndex;
                } else {
                    axis = 'z'; const dim = state.activeDimensions.z;
                    const rawIndex = Math.floor(Math.random() * dim);
                    sliceVal = (rawIndex - (dim - 1) / 2) * S; layerNum = rawIndex;
                }
            } while (axis === lastAxis && layerNum === lastLayer);
            lastAxis = axis; lastLayer = layerNum;
            const dirs = [1, -1, 2];
            let dir = dirs[Math.floor(Math.random() * dirs.length)];
            if (this.isFaceRectangular(axis)) dir = 2;
            scrambleMoves.push({ axis, dir, sliceVal });
        }
        return scrambleMoves;
    }

    parseScrambleString(scrambleString) {
        const moves = [];
        const parts = scrambleString.trim().split(/\s+/);
        const S = CUBE_SIZE + this.getSpacing();
        const maxIndex = (state.activeDimensions.x - 1) / 2;
        parts.forEach(part => {
            let match = part.match(/^(\d*)([a-zA-Z])(.*)$/);
            if (!match) return;
            let char = match[2], suffix = match[3];
            let dir = suffix.includes("'") ? -1 : (suffix.includes("2") ? 2 : 1);
            let axis = (['R', 'L'].includes(char.toUpperCase()) ? 'x' : (['U', 'D'].includes(char.toUpperCase()) ? 'y' : 'z'));
            let sliceIndex = (['R', 'U', 'F'].includes(char) ? maxIndex : -maxIndex);
            moves.push({ axis, dir, sliceVal: sliceIndex * S });
        });
        return moves;
    }

    invertScrambleString(scramble) {
        return scramble.trim().split(/\s+/).reverse().map(move => {
            if (move.endsWith("2")) return move;
            if (move.endsWith("'")) return move.slice(0, -1);
            return move + "'";
        }).join(" ");
    }

    getLockedRotationAxis(axis) {
        let lowerAxis = axis.toLowerCase();
        let res;
        if (lowerAxis === 'x') res = new THREE.Vector3(1, 0, 0);
        else if (lowerAxis === 'y') res = new THREE.Vector3(0, 1, 0);
        else if (lowerAxis === 'z') res = new THREE.Vector3(0, 0, 1);
        else return null;

        const config = this.rotationTuning[lowerAxis] || { negate: false };
        if (config.negate) res.negate();
        return res;
    }

    getDragAngleScale(axis) {
        let lowerAxis = axis.toLowerCase();
        const config = this.rotationTuning[lowerAxis] || { scale: 1 };
        return config.scale;
    }

    isFaceRectangular(axis) {
        const dims = state.activeDimensions;
        if (axis === 'x') return dims.y !== dims.z;
        if (axis === 'y') return dims.x !== dims.z;
        if (axis === 'z') return dims.x !== dims.y;
        return false;
    }

    getDragAxis(faceNormal, screenMoveVec, intersectedCubie, camera) {
        const localFaceNormal = faceNormal.clone().transformDirection(state.cubeWrapper.matrixWorld.clone().invert()).round();
        const axes = [{ vec: new THREE.Vector3(1, 0, 0), name: 'x' }, { vec: new THREE.Vector3(0, 1, 0), name: 'y' }, { vec: new THREE.Vector3(0, 0, 1), name: 'z' }];
        const validAxes = axes.filter(a => Math.abs(a.vec.dot(localFaceNormal)) < 0.1);
        let bestMatch = null, bestDot = -1;
        validAxes.forEach(axis => {
            const startPoint = intersectedCubie.position.clone().applyMatrix4(state.cubeWrapper.matrixWorld);
            const axisVecWorld = axis.vec.clone().transformDirection(state.cubeWrapper.matrixWorld);
            const endPoint = startPoint.clone().add(axisVecWorld);
            const tempStart = startPoint.clone().project(camera), tempEnd = endPoint.clone().project(camera);
            const screenAxisVec = new THREE.Vector2(tempEnd.x - tempStart.x, -(tempEnd.y - tempStart.y)).normalize();
            const dot = Math.abs(screenAxisVec.dot(screenMoveVec));
            if (dot > bestDot) { bestDot = dot; bestMatch = { moveAxis: axis, screenVec: screenAxisVec }; }
        });

        if (bestMatch) {
            const moveAxisVec = bestMatch.moveAxis.vec;
            const rotAxisRaw = new THREE.Vector3().crossVectors(moveAxisVec, localFaceNormal).normalize();
            let finalRotAxis = new THREE.Vector3(), finalAxisName = 'x', maxComp = 0;
            if (Math.abs(rotAxisRaw.x) > maxComp) { maxComp = Math.abs(rotAxisRaw.x); finalRotAxis.set(Math.sign(rotAxisRaw.x), 0, 0); finalAxisName = 'x'; }
            if (Math.abs(rotAxisRaw.y) > maxComp) { maxComp = Math.abs(rotAxisRaw.y); finalRotAxis.set(0, Math.sign(rotAxisRaw.y), 0); finalAxisName = 'y'; }
            if (Math.abs(rotAxisRaw.z) > maxComp) { maxComp = Math.abs(rotAxisRaw.z); finalRotAxis.set(0, 0, Math.sign(rotAxisRaw.z)); finalAxisName = 'z'; }

            const dragInputAxis = Math.abs(bestMatch.screenVec.x) > Math.abs(bestMatch.screenVec.y) ? 'x' : 'y';
            const dragAngleScale = -1 * (bestMatch.screenVec.dot(dragInputAxis === 'x' ? new THREE.Vector2(1, 0) : new THREE.Vector2(0, 1)) > 0 ? 1 : -1) * Math.sign(finalRotAxis.dot(rotAxisRaw));
            const S = CUBE_SIZE + this.getSpacing();
            const p = intersectedCubie.position[finalAxisName];
            const dragSliceValue = state.activeDimensions[finalAxisName] === 1 ? Infinity : Math.round(p / S * 2) / 2 * S;

            return { dragAxis: finalAxisName, dragRotationAxis: finalRotAxis, dragInputAxis, dragAngleScale, dragSliceValue };
        }
        return null;
    }

    snapCubies(cubies) {
        const S = CUBE_SIZE + this.getSpacing();
        cubies.forEach(c => {
            c.position.set(Math.round(c.position.x / S * 2) / 2 * S, Math.round(c.position.y / S * 2) / 2 * S, Math.round(c.position.z / S * 2) / 2 * S);
            c.quaternion.normalize();
            const euler = new THREE.Euler().setFromQuaternion(c.quaternion);
            const snap = (val) => Math.round(val / (Math.PI / 2)) * (Math.PI / 2);
            c.rotation.set(snap(euler.x), snap(euler.y), snap(euler.z));
        });
    }

    updateRadius(radius) {
        const newGeo = new RoundedBoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE, 4, radius);
        this.cubieList.forEach(group => {
            const core = group.children.find(c => !c.userData.isSticker);
            if (core) core.geometry = newGeo;
        });
    }

    updateSpacing(spacing) {
        const S = CUBE_SIZE + spacing;
        this.cubieList.forEach(group => {
            if (group.userData.gridPos) {
                const { x, y, z } = group.userData.gridPos;
                group.position.set(x * S, y * S, z * S);
            }
        });
    }

    updateStickers(size, radius) {
        if (!this.stickers) return;
        this.stickers.forEach(sticker => {
            const scale = size / 0.800;
            sticker.scale.set(scale, scale, 1);
            if (sticker.material.uniforms && sticker.material.uniforms.borderRadius) {
                sticker.material.uniforms.borderRadius.value = radius;
            }
        });
    }

    dispose() {
        super.dispose();
        this.stickers = [];
    }
}
