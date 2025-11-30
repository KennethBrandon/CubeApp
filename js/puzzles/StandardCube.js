import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Puzzle } from './Puzzle.js';
import min2phase from '../lib/min2phase.js';
import { state } from '../shared/state.js';
import { CUBE_SIZE, SPACING, COLORS, CORE_COLOR, STICKER_BORDER_RADIUS, stickerVertexShader, stickerFragmentShader } from '../shared/constants.js';

export class StandardCube extends Puzzle {
    constructor(config) {
        super(config);
        // config.dimensions = { x, y, z }
        // config.parent = THREE.Group (optional, defaults to state.cubeWrapper)
        // config.cubieList = Array (optional, defaults to state.allCubies)

        this.parent = config.parent || state.cubeWrapper;
        this.cubieList = config.cubieList || state.allCubies;
    }

    createGeometry() {
        // Clear existing geometry from the specific parent and list
        // Note: If we are using the global list, we might be clearing everything.
        // But for a new instance with its own list, it clears just that list.

        // If we are using the global list, we need to be careful not to break existing logic
        // that expects state.allCubies to be the source of truth.
        // The existing logic was: state.allCubies.forEach...

        this.cubieList.forEach(c => {
            if (c.parent) c.parent.remove(c);
        });

        // If we are using the global list, we empty it. 
        // If we are using a local list passed in config, we empty that.
        // However, we can't reassign the reference of the passed array if it's a prop.
        // So we should splice it or just assume the caller handles the list lifecycle?
        // Actually, for the global list, we do `state.allCubies = []`.
        // We can't do `this.cubieList = []` if we want to affect the external reference.
        // So let's use splice.
        this.cubieList.length = 0;

        state.activeDimensions = { ...this.config.dimensions };

        // Use RoundedBoxGeometry for a "machined" look with filleted edges
        // Radius 0.02 gives a tight, premium feel
        const baseGeo = new RoundedBoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE, 4, 0.02);

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
        // Check all 6 directions for uniform colors
        // This is rotation-invariant - it checks sticker orientations, not world positions
        const directions = [
            new THREE.Vector3(1, 0, 0),   // Right
            new THREE.Vector3(-1, 0, 0),  // Left
            new THREE.Vector3(0, 1, 0),   // Top
            new THREE.Vector3(0, -1, 0),  // Bottom
            new THREE.Vector3(0, 0, 1),   // Front
            new THREE.Vector3(0, 0, -1)   // Back
        ];

        let isAllSolved = true;

        for (const faceDir of directions) {
            let faceColorHex = null;
            let stickerCount = 0;

            // Check all cubies for stickers facing this direction
            for (const group of this.cubieList) {
                for (const child of group.children) {
                    if (child.userData.isSticker) {
                        // Calculate the sticker's world-space normal
                        const normal = new THREE.Vector3(0, 0, 1);
                        normal.applyQuaternion(child.quaternion);
                        normal.applyQuaternion(group.quaternion);

                        // Check if this sticker is facing the current direction
                        const dotProduct = normal.dot(faceDir);
                        if (dotProduct > 0.9) {
                            const stickerColor = child.material.uniforms.color.value.getHex();
                            stickerCount++;

                            if (faceColorHex === null) {
                                faceColorHex = stickerColor;
                            } else if (faceColorHex !== stickerColor) {
                                // Found a sticker facing this direction with a different color
                                isAllSolved = false;
                                break;
                            }
                        }
                    }
                }
                if (!isAllSolved) break;
            }

            // Each face must have at least one sticker
            if (stickerCount === 0) {
                isAllSolved = false;
            }

            if (!isAllSolved) break;
        }

        return isAllSolved;
    }

    getCubiesInSlice(axis, value) {
        return this.cubieList.filter(cubie => Math.abs(cubie.position[axis] - value) < 0.01);
    }

    performMove(moveId, direction, duration = 300, sliceVal = null) {
        // This method replaces the logic in moves.js performMove
        // It handles both named moves (R, L, etc) and generic axis moves (x, y, z)

        state.isAnimating = true;
        let axisVector = new THREE.Vector3();
        let cubies = [];
        let axisStr = moveId;

        // Determine axis vector and cubies
        if (axisStr === 'x') axisVector.set(1, 0, 0);
        else if (axisStr === 'y') axisVector.set(0, 1, 0);
        else if (axisStr === 'z') axisVector.set(0, 0, 1);

        // Handle named moves (R, L, U, D, F, B)
        const S = CUBE_SIZE + SPACING;

        if (['R', 'L', 'U', 'D', 'F', 'B'].includes(axisStr)) {
            let maxIndex;

            if (['R', 'L'].includes(axisStr)) {
                maxIndex = (state.activeDimensions.x - 1) / 2;
                axisVector.set(1, 0, 0);
            } else if (['U', 'D'].includes(axisStr)) {
                maxIndex = (state.activeDimensions.y - 1) / 2;
                axisVector.set(0, 1, 0);
            } else if (['F', 'B'].includes(axisStr)) {
                maxIndex = (state.activeDimensions.z - 1) / 2;
                axisVector.set(0, 0, 1);
            }

            let sliceIndex = 0;
            if (['R', 'U', 'F'].includes(axisStr)) sliceIndex = maxIndex;
            else sliceIndex = -maxIndex;

            sliceVal = sliceIndex * S;

            // Add to history
            // We need to call addToHistory from UI. 
            // Ideally Puzzle shouldn't know about UI. 
            // But for now, let's return the notation and let the caller handle it?
            // Or just import addToHistory.
        }

        // Generic slice selection
        if (sliceVal !== null) {
            let searchAxis = 'x';
            if (axisStr === 'x' || axisStr === 'R' || axisStr === 'L') searchAxis = 'x';
            else if (axisStr === 'y' || axisStr === 'U' || axisStr === 'D') searchAxis = 'y';
            else searchAxis = 'z';

            cubies = this.getCubiesInSlice(searchAxis, sliceVal);

            if (sliceVal > 0) {
                axisVector.negate();
            }
        } else {
            // Whole cube rotation
            cubies = this.cubieList;
        }

        // Return the data needed to animate
        return {
            axisVector,
            cubies,
            angle: direction * (Math.PI / 2),
            axis: axisStr, // Original axis string for logging
            sliceVal
        };
    }

    getNotation(axis, sliceVal, turns) {
        const S = CUBE_SIZE + SPACING;
        const epsilon = 0.1;

        const dims = state.activeDimensions;
        const axisDim = dims[axis];
        const maxIndex = (axisDim - 1) / 2;

        let char = '';
        let notationTurns = turns;
        let index = sliceVal / S;

        if (state.isBackgroundDrag && !state.isScrambling && !state.isAutoSolving) {
            if (axis === 'x') char = 'x';
            else if (axis === 'y') char = 'y';
            else if (axis === 'z') char = 'z';
        } else {
            if (axis === 'x') {
                if (Math.abs(index - maxIndex) < epsilon) { char = 'R'; notationTurns *= -1; }
                else if (Math.abs(index + maxIndex) < epsilon) { char = 'L'; }
                else {
                    if (axisDim % 2 !== 0 && Math.abs(index) < epsilon) char = 'M';
                    else {
                        if (index > 0) { char = Math.round(maxIndex - index + 1) + 'R'; notationTurns *= -1; }
                        else { char = Math.round(maxIndex - Math.abs(index) + 1) + 'L'; }
                    }
                }
            } else if (axis === 'y') {
                if (Math.abs(index - maxIndex) < epsilon) { char = 'U'; notationTurns *= -1; }
                else if (Math.abs(index + maxIndex) < epsilon) { char = 'D'; }
                else {
                    if (axisDim % 2 !== 0 && Math.abs(index) < epsilon) char = 'E';
                    else {
                        if (index > 0) { char = Math.round(maxIndex - index + 1) + 'U'; notationTurns *= -1; }
                        else { char = Math.round(maxIndex - Math.abs(index) + 1) + 'D'; }
                    }
                }
            } else if (axis === 'z') {
                if (Math.abs(index - maxIndex) < epsilon) { char = 'F'; notationTurns *= -1; }
                else if (Math.abs(index + maxIndex) < epsilon) { char = 'B'; }
                else {
                    if (axisDim % 2 !== 0 && Math.abs(index) < epsilon) {
                        char = 'S';
                        notationTurns *= -1;
                    } else {
                        if (index > 0) { char = Math.round(maxIndex - index + 1) + 'F'; notationTurns *= -1; }
                        else { char = Math.round(maxIndex - Math.abs(index) + 1) + 'B'; }
                    }
                }
            }
        }

        let suffix = '';
        if (Math.abs(notationTurns) === 2) suffix = '2';
        else if (notationTurns < 0) suffix = "'";

        return char + suffix;
    }

    async getScramble(numMoves = 25) {
        const dims = this.config.dimensions;
        const isCubic = dims.x === dims.y && dims.y === dims.z;
        // Only use WCA scrambles for 3x3 (min2phase is a 3x3 solver)
        // 2x2 and others will fall back to the internal random move generator
        const isWCA = isCubic && dims.x === 3;

        if (isWCA) {
            try {
                min2phase.initFull(); // Ensure min2phase is initialized
                const randomState = min2phase.randomCube();
                const solution = min2phase.solve(randomState);
                const scrambleString = this.invertScrambleString(solution);

                console.log("Generated WCA Scramble (min2phase):", scrambleString);
                return this.parseScrambleString(scrambleString);
            } catch (e) {
                console.warn("min2phase scramble generation failed, falling back to random moves", e);
            }
        }

        // Fallback to existing random move logic
        let scrambleMoves = [];
        const axes = ['x', 'y', 'z'];
        const S = CUBE_SIZE + SPACING;

        let lastAxis = '';
        let lastLayer = -999;

        // Determine scramble length based on cube size if not provided
        if (numMoves === 25) {
            const size = this.config.dimensions.x; // Assuming cubic for simple size check
            if (size === 2) numMoves = 15;
            else if (size === 3) numMoves = 25;
            else if (size === 4) numMoves = 40;
            else if (size >= 5) numMoves = 60;
        }

        for (let i = 0; i < numMoves; i++) {
            let axis, layerNum, sliceVal;

            // Avoid undoing previous move (same axis, same layer)
            do {
                // Weight axis selection by number of layers to ensure uniform distribution
                const totalLayers = state.activeDimensions.x + state.activeDimensions.y + state.activeDimensions.z;
                const rand = Math.random() * totalLayers;

                if (rand < state.activeDimensions.x) {
                    axis = 'x';
                    const dim = state.activeDimensions.x;
                    const rawIndex = Math.floor(Math.random() * dim);
                    sliceVal = (rawIndex - (dim - 1) / 2) * S;
                    layerNum = rawIndex;
                } else if (rand < state.activeDimensions.x + state.activeDimensions.y) {
                    axis = 'y';
                    const dim = state.activeDimensions.y;
                    const rawIndex = Math.floor(Math.random() * dim);
                    sliceVal = (rawIndex - (dim - 1) / 2) * S;
                    layerNum = rawIndex;
                } else {
                    axis = 'z';
                    const dim = state.activeDimensions.z;
                    const rawIndex = Math.floor(Math.random() * dim);
                    sliceVal = (rawIndex - (dim - 1) / 2) * S;
                    layerNum = rawIndex;
                }

            } while (axis === lastAxis && layerNum === lastLayer);

            lastAxis = axis;
            lastLayer = layerNum;

            const dirs = [1, -1, 2];
            let dir = dirs[Math.floor(Math.random() * dirs.length)];

            // Enforce 180 degree turns for rectangular faces
            if (this.isFaceRectangular(axis)) {
                dir = 2;
            }

            scrambleMoves.push({ axis, dir, sliceVal });
        }
        return scrambleMoves;
    }

    parseScrambleString(scrambleString) {
        const moves = [];
        const parts = scrambleString.trim().split(/\s+/);
        const S = CUBE_SIZE + SPACING;
        const maxIndex = (state.activeDimensions.x - 1) / 2; // Assuming cubic for WCA

        parts.forEach(part => {
            // Parse notation: [prefix][char][suffix]
            // e.g. R, R', R2, 2R, 2R'
            let match = part.match(/^(\d*)([a-zA-Z])(.*)$/);
            if (!match) return;

            let prefix = match[1];
            let char = match[2];
            let suffix = match[3];

            let dir = 1;
            if (suffix.includes("'")) dir = -1; // Standard is -1 for '
            if (suffix.includes("2")) dir = 2;

            let axis = '';
            if (['R', 'L'].includes(char.toUpperCase())) axis = 'x';
            else if (['U', 'D'].includes(char.toUpperCase())) axis = 'y';
            else if (['F', 'B'].includes(char.toUpperCase())) axis = 'z';

            // Map face to slice index
            // R = maxIndex, L = -maxIndex
            // U = maxIndex, D = -maxIndex
            // F = maxIndex, B = -maxIndex

            let sliceIndex = 0;
            if (['R', 'U', 'F'].includes(char)) {
                sliceIndex = maxIndex;
            } else {
                sliceIndex = -maxIndex;
            }

            let internalDir = 0;

            // Base direction for "Normal" (CW) turn of the face
            // In my engine:
            // R (slice > 0) -> dir=-1 is CW
            // L (slice < 0) -> dir=1 is CW
            // U (slice > 0) -> dir=-1 is CW
            // D (slice < 0) -> dir=1 is CW
            // F (slice > 0) -> dir=-1 is CW
            // B (slice < 0) -> dir=1 is CW

            if (['R', 'U', 'F'].includes(char)) {
                internalDir = -1;
            } else {
                internalDir = 1;
            }

            // Apply modifier
            if (dir === -1) internalDir *= -1; // ' reverses direction
            if (dir === 2) internalDir = 2; // 2 is 2 (my engine handles 2 as 180)

            // Wait, if dir is 2, sign doesn't matter for 180, but usually we use 2.
            // My engine might expect 2 or -2?
            // performMove: angle = direction * (Math.PI / 2).
            // 2 * 90 = 180.

            const sliceVal = sliceIndex * S;
            moves.push({ axis, dir: internalDir, sliceVal });
        });
        return moves;
    }

    invertScrambleString(scramble) {
        const moves = scramble.trim().split(/\s+/);
        const invertedMoves = moves.reverse().map(move => {
            if (move.endsWith("2")) return move;
            if (move.endsWith("'")) return move.slice(0, -1);
            return move + "'";
        });
        return invertedMoves.join(" ");
    }

    isFaceRectangular(axis) {
        const dims = state.activeDimensions;
        if (axis === 'x') return dims.y !== dims.z;
        if (axis === 'y') return dims.x !== dims.z;
        if (axis === 'z') return dims.x !== dims.y;
        return false;
    }

    getDragAxis(faceNormal, screenMoveVec, intersectedCubie, camera) {
        // This logic is moved from interactions.js determineDragAxis
        // It determines which axis we are dragging along based on mouse movement and face normal

        // Transform face normal to local space of the wrapper
        const localFaceNormal = faceNormal.clone().transformDirection(state.cubeWrapper.matrixWorld.clone().invert()).round();

        const axes = [
            { vec: new THREE.Vector3(1, 0, 0), name: 'x' },
            { vec: new THREE.Vector3(0, 1, 0), name: 'y' },
            { vec: new THREE.Vector3(0, 0, 1), name: 'z' }
        ];

        const validAxes = axes.filter(a => Math.abs(a.vec.dot(localFaceNormal)) < 0.1);
        let bestMatch = null;
        let bestDot = -1;

        validAxes.forEach(axis => {
            const startPoint = intersectedCubie.position.clone();
            // Apply wrapper transformation to get world start/end points for projection
            startPoint.applyMatrix4(state.cubeWrapper.matrixWorld);

            const axisVecWorld = axis.vec.clone().transformDirection(state.cubeWrapper.matrixWorld);
            const endPoint = startPoint.clone().add(axisVecWorld);

            startPoint.project(camera);
            endPoint.project(camera);
            const screenAxisVec = new THREE.Vector2(
                endPoint.x - startPoint.x,
                -(endPoint.y - startPoint.y)
            ).normalize();
            const dot = Math.abs(screenAxisVec.dot(screenMoveVec));
            if (dot > bestDot) {
                bestDot = dot;
                bestMatch = { moveAxis: axis, screenVec: screenAxisVec };
            }
        });

        if (bestMatch) {
            const moveAxisVec = bestMatch.moveAxis.vec;
            const rotAxisRaw = new THREE.Vector3().crossVectors(moveAxisVec, localFaceNormal).normalize();
            let maxComp = 0;
            let finalRotAxis = new THREE.Vector3();
            let finalAxisName = 'x';

            if (Math.abs(rotAxisRaw.x) > maxComp) { maxComp = Math.abs(rotAxisRaw.x); finalRotAxis.set(Math.sign(rotAxisRaw.x), 0, 0); finalAxisName = 'x'; }
            if (Math.abs(rotAxisRaw.y) > maxComp) { maxComp = Math.abs(rotAxisRaw.y); finalRotAxis.set(0, Math.sign(rotAxisRaw.y), 0); finalAxisName = 'y'; }
            if (Math.abs(rotAxisRaw.z) > maxComp) { maxComp = Math.abs(rotAxisRaw.z); finalRotAxis.set(0, 0, Math.sign(rotAxisRaw.z)); finalAxisName = 'z'; }

            let dragInputAxis = 'x';
            if (Math.abs(bestMatch.screenVec.x) > Math.abs(bestMatch.screenVec.y)) {
                dragInputAxis = 'x';
            } else {
                dragInputAxis = 'y';
            }

            const inputVec = (dragInputAxis === 'x') ? new THREE.Vector2(1, 0) : new THREE.Vector2(0, 1);
            const directionCheck = bestMatch.screenVec.dot(inputVec);
            const axisAlignment = finalRotAxis.dot(rotAxisRaw);
            const dragAngleScale = -1 * (directionCheck > 0 ? 1 : -1) * Math.sign(axisAlignment);

            const S = CUBE_SIZE + SPACING;
            const p = intersectedCubie.position[finalAxisName];

            // Snap to nearest layer
            const dragSliceValue = Math.round(p / S * 2) / 2 * S;

            return {
                dragAxis: finalAxisName,
                dragRotationAxis: finalRotAxis,
                dragInputAxis,
                dragAngleScale,
                dragSliceValue
            };
        }
        return null;
    }
    snapCubies(cubies) {
        const S = CUBE_SIZE + SPACING;
        cubies.forEach(c => {
            c.position.set(
                Math.round(c.position.x / S * 2) / 2 * S,
                Math.round(c.position.y / S * 2) / 2 * S,
                Math.round(c.position.z / S * 2) / 2 * S
            );
            c.quaternion.normalize();

            // Snap rotation to nearest 90 degrees
            const euler = new THREE.Euler().setFromQuaternion(c.quaternion);
            const snap = (val) => {
                const piHalf = Math.PI / 2;
                return Math.round(val / piHalf) * piHalf;
            };
            c.rotation.set(
                snap(euler.x),
                snap(euler.y),
                snap(euler.z)
            );
        });
    }

    updateRadius(radius) {
        // Create a single geometry instance to share
        const newGeo = new RoundedBoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE, 4, radius);

        this.cubieList.forEach(group => {
            // Find the core mesh (the first child usually, but let's be safe)
            const core = group.children.find(c => !c.userData.isSticker);
            if (core) {
                // Dispose old geometry if it's not shared (or let GC handle it if we are careful)
                // In this case, we are replacing it.
                // Note: If we previously shared geometry, we should be careful not to dispose it multiple times.
                // But here we are assigning a new one.
                core.geometry = newGeo;
            }
        });
    }
}
