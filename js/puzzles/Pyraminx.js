import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { Puzzle } from './Puzzle.js';
import { SPACING, COLORS } from '../shared/constants.js';
import { state } from '../shared/state.js';
import { queueMove } from '../game/moves.js';

export class Pyraminx extends Puzzle {
    constructor(config) {
        super(config);
        this.scrambleLength = 25; // Standard Pyraminx scramble length is shorter
        this.parent = config.parent || state.cubeWrapper;

        // Use provided cubieList or global (legacy support)
        // If config.cubieList is provided, use it (for cloning/solver)
        // Otherwise use state.allCubies
        this.cubieList = config.cubieList || state.allCubies;

        // Define 4 Face Colors
        this.faceColors = [
            0x00FF00, // 0: Green (Front)
            0xFF0000, // 1: Red (Right)
            0x0000FF, // 2: Blue (Left)
            0xFFFF00  // 3: Yellow (Bottom)
        ];

        this.faceNormals = [];

        // Geometry Parameters
        this.radius = 1.5;
        this.surfaceDist = 1.2; // Distance from center to face

        // Cut Depths (Distance from center to cut plane)
        // Tetrahedron center to vertex distance R.
        // Center to face distance r = R/3.
        // Height h = R + r = 4R/3.

        // Let's rely on visual tuning.
        // We need 2 cuts per axis for the layers (Tip, Middle, Base).
        // Actually, physically, the cut separates the top chunk.
        // Tip Cut: Very close to vertex (far from center in normal direction? No, normal is face).
        // Wait, cuts are parallel to faces.
        // A layer rotates around a vertex.
        // So the cut plane is parallel to the OPPOSITE face?
        // Yes. To rotate the "Top" vertex, we slice parallel to the "Bottom" face.

        // So for Face 0 (Green), the rotation axis is the normal of Face 0?
        // No, Face 0 usually rotates *around* the normal of Face 0.
        // On a Pyraminx, you rotate a Corner. The axis goes through the Corner and the Center of the opposite Face.
        // Actually, the axis is the Face Normal of the OPPOSITE face.
        // Example: Sitting on Yellow (Bottom). Green is Front.
        // Rotation U (Top Tip) is around the vertical axis.
        // That axis is the normal of the Bottom Face (Yellow)?
        // Yes, roughly.
        // Let's define axes by Face Normals.
        // There are 4 axes.

        this.cutDistTip = 2.0;   // Separates Tip from Middle
        this.cutDistMiddle = 0.4; // Separates Middle from Base

        this.stickerScale = 0.87;
        this.stickerOffset = 0.001;
        this.stickerRadius = 0.05;
        this.cubieGap = 0.01;
        this.filletRadius = 0.02;
        this.stickerRoughness = 0.30;
        this.stickerMetalness = 0.18;
        this.stickerNormalScale = 0.75;
        this.stickerUseSparkle = true;
        this.sparkleMap = null;

        this.showDebugPlanes = false; // Disabled by default
        this.showDebugColors = false; // User requested default off
        this.debugPlanes = [];
    }

    rebuildGeometry() {
        this.createGeometry();
    }

    createGeometry() {
        // Clear existing
        this.cubieList.forEach(c => { if (c.parent) c.parent.remove(c); });
        this.cubieList.length = 0;
        this.faceNormals = [];

        // 1. Define Tetrahedron Normals (4 Faces)
        // Standard orientation: Yellow Bottom, Green Front, Red Right, Blue Left
        const c = 1 / Math.sqrt(3);
        const normals = [
            new THREE.Vector3(c, c, c),
            new THREE.Vector3(c, -c, -c),
            new THREE.Vector3(-c, c, -c),
            new THREE.Vector3(-c, -c, c)
        ];

        this.faceNormals = normals;

        // Intersection Helper
        const intersection = (constraints) => {
            const points = [];
            const planes = constraints.map(c => new THREE.Plane(c.normal, -c.constant));

            for (let i = 0; i < planes.length; i++) {
                for (let j = i + 1; j < planes.length; j++) {
                    for (let k = j + 1; k < planes.length; k++) {
                        const n1 = planes[i].normal, n2 = planes[j].normal, n3 = planes[k].normal;
                        const det = n1.dot(n2.clone().cross(n3));
                        if (Math.abs(det) > 1e-6) {
                            const v = new THREE.Vector3()
                                .addScaledVector(n2.clone().cross(n3), -planes[i].constant)
                                .addScaledVector(n3.clone().cross(n1), -planes[j].constant)
                                .addScaledVector(n1.clone().cross(n2), -planes[k].constant)
                                .divideScalar(det);

                            let valid = true;
                            for (let m = 0; m < constraints.length; m++) {
                                if (constraints[m].normal.dot(v) > constraints[m].constant + 1e-4) {
                                    valid = false; break;
                                }
                            }
                            if (valid) points.push(v);
                        }
                    }
                }
            }
            return points;
        };

        const generateMesh = (points, materialProps) => {
            const uniquePoints = [];
            points.forEach(p => {
                if (!uniquePoints.some(up => up.distanceTo(p) < 0.001)) uniquePoints.push(p);
            });

            if (uniquePoints.length < 4) return null;

            try {
                const geometry = new ConvexGeometry(uniquePoints);
                const color = this.showDebugColors ? Math.random() * 0xffffff : 0x222222;
                const material = new THREE.MeshStandardMaterial({
                    color: color,
                    roughness: 0.6,
                    metalness: 0.1,
                    ...materialProps
                });
                return new THREE.Mesh(geometry, material);
            } catch (e) {
                return null;
            }
        };

        const finalizePiece = (mesh, type, faces, cutFaceIdx) => {
            if (!mesh) return;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            const group = new THREE.Group();
            group.add(mesh);

            // Calculate centroid
            const center = new THREE.Vector3();
            const pos = mesh.geometry.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                center.add(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
            }
            center.divideScalar(pos.count);

            // Stickers
            faces.forEach(idx => {
                this.createSticker(mesh, group, idx);
            });

            // Center geometry
            mesh.geometry.center();

            // Shift stickers
            group.children.forEach(child => {
                if (child !== mesh) {
                    child.position.sub(center);
                }
            });

            group.userData = { type, isCubie: true, initialCenter: center.clone() };
            group.position.copy(center);

            // GAP IMPLEMENTATION
            if (this.cubieGap > 0) {
                const gapShift = new THREE.Vector3();

                // OUTER FACE SHIFT (radial from the visible faces)
                if (faces.length > 0) {
                    const faceNormal = this.faceNormals[faces[0]];
                    const h = center.dot(faceNormal);
                    if (Math.abs(h) > 0.01) {
                        const k = this.cubieGap / h;
                        gapShift.add(center.clone().multiplyScalar(k));
                    }
                }

                // INTERNAL CUT SHIFT (away from neighboring pieces)
                // Tips (N_i <= -cutDist): shift in -normal direction (away from center/axial piece)
                // Centers (N_i >= -cutDist): shift in +normal direction (away from tip)
                if (cutFaceIdx !== undefined && cutFaceIdx !== null) {
                    const cutNormal = this.faceNormals[cutFaceIdx];
                    if (type === 'tip') {
                        // Tips shift in -normal direction
                        gapShift.add(cutNormal.clone().multiplyScalar(-this.cubieGap));
                    } else if (type === 'center') {
                        // Axial Centers shift in +normal direction
                        gapShift.add(cutNormal.clone().multiplyScalar(this.cubieGap));
                    }
                }

                group.position.add(gapShift);
            }

            this.parent.add(group);
            this.cubieList.push(group);
        };

        // --- Generate Pieces ---
        const S = this.surfaceDist;

        // 1. TIPS (4)
        for (let i = 0; i < 4; i++) {
            const constraints = [];
            this.faceNormals.forEach((n, idx) => {
                // Surface: N <= S
                if (idx !== i) constraints.push({ normal: n, constant: S });
            });
            // Tip Cut: N_i <= -Tip
            constraints.push({ normal: this.faceNormals[i], constant: -this.cutDistTip });

            const mesh = generateMesh(intersection(constraints));
            if (mesh) finalizePiece(mesh, 'tip', [0, 1, 2, 3].filter(x => x !== i), i);
        }

        // 2. AXIAL CENTERS (4)
        for (let i = 0; i < 4; i++) {
            const constraints = [];

            // Bottom (Tip boundary): N_i >= -Tip => -N_i <= Tip
            constraints.push({ normal: this.faceNormals[i].clone().negate(), constant: this.cutDistTip });

            // Top (Middle boundary): N_i <= -Mid
            constraints.push({ normal: this.faceNormals[i], constant: -this.cutDistMiddle });

            // Neighbors (Base boundary): 
            // The axial center is the core piece under the tip.
            // It is bounded by the Surface planes of the adjacent neighbors j, k, l.
            for (let j = 0; j < 4; j++) {
                if (i === j) continue;
                // Surface: N_j <= S
                constraints.push({ normal: this.faceNormals[j], constant: S });
            }

            // "Axial Center" (Inner Tip) must not spill into Edges.
            // Edges are "Deep" in j (N_j <= -Mid).
            // So Axial Center must be "Base" relative to j (N_j >= -Mid => -N_j <= Mid).
            for (let j = 0; j < 4; j++) {
                if (i === j) continue;
                constraints.push({ normal: this.faceNormals[j].clone().negate(), constant: this.cutDistMiddle });
            }

            const mesh = generateMesh(intersection(constraints));
            // FIXED: Axial Centers are under tip i, so they have stickers on faces j, k, l (not i)
            if (mesh) finalizePiece(mesh, 'center', [0, 1, 2, 3].filter(x => x !== i), i);
        }

        // 3. EDGES (6)
        for (let i = 0; i < 4; i++) {
            for (let j = i + 1; j < 4; j++) {
                const k_l = [0, 1, 2, 3].filter(x => x !== i && x !== j);
                const constraints = [];

                // Deep i & j: N <= -Mid
                constraints.push({ normal: this.faceNormals[i], constant: -this.cutDistMiddle });
                constraints.push({ normal: this.faceNormals[j], constant: -this.cutDistMiddle });

                // Not Deep k & l ("Basement of k & l"): N >= -Mid => -N <= Mid
                constraints.push({ normal: this.faceNormals[k_l[0]].clone().negate(), constant: this.cutDistMiddle });
                constraints.push({ normal: this.faceNormals[k_l[1]].clone().negate(), constant: this.cutDistMiddle });

                // Surfaces
                constraints.push({ normal: this.faceNormals[k_l[0]], constant: S });
                constraints.push({ normal: this.faceNormals[k_l[1]], constant: S });

                const mesh = generateMesh(intersection(constraints));
                if (mesh) finalizePiece(mesh, 'edge', k_l, null);
            }
        }

        if (this.showDebugPlanes) {
            this.addDebugPlanes();
        }
    }

    handleKeyDown(event) {
        if (this.isAnimating) return;

        const num = parseInt(event.key);
        if (!isNaN(num) && num >= 1 && num <= 8) {
            const faceIdx = (num - 1) % 4;
            const isDeep = num > 4;

            // Use logic similar to Megaminx: Pass index as string axis
            const axisStr = faceIdx.toString();
            // Deep moves use 'Middle' cut, Tip moves use 'Tip' cut.
            // Note: My normals point OUT.
            // Tip is at negative infinity? No.
            // Center of Tetrahedron is 0,0,0.
            // Tip is at Distance R. Face is at distance r.
            // Logic: dot(p, n) < -cutDist.
            // So larger cutDist means "deeper" cut (closer to center, or past it).
            // cutTip = 2.2. cutMiddle = 0.0.
            // To select TIP, we use limit -2.2.
            // To select TIP+MID, we use limit 0.0.
            // Add a small bias (-0.05) to ensure we don't accidentally select Base pieces 
            // that are near 0.0 due to floating point jitter or centroid averaging.
            // Base pieces have dot > 0. Deep pieces have dot < 0.
            // A threshold of -0.05 safely separates them.
            const sliceVal = isDeep ? -this.cutDistMiddle - 0.05 : -this.cutDistTip;

            // Direction: 1. (Can add Shift for inverse later if needed)
            queueMove(axisStr, 1, state.animationSpeed, sliceVal);
        }
    }

    // This getMoveInfo is called by the queueMove system to get the actual cubies and axis for a move.
    getMoveInfo(axisStr, dir, sliceVal) {
        // Handle mouse interaction (object based) - Wait, internal engine sends strings usually?
        // If axisStr is object (cubie), it's the old signature?
        // Puzzle.js doesn't define signature, but moves.js calls it with (axisStr, dir, sliceVal).
        // Interactions calls it with (cubie, axis, dir) ?? No, interactions calls getDragAxis.

        // Wait, where is `getMoveInfo(cubie, axis, dir)` called from?
        // It might be called by `Puzzle.js` base `performMove` if not overridden?
        // `moves.js`: `state.activePuzzle.getMoveInfo(axisStr, direction, sliceVal)`

        const faceIdx = parseInt(axisStr);
        if (!isNaN(faceIdx) && faceIdx >= 0 && faceIdx < 4) {
            const normal = this.faceNormals[faceIdx];

            // Use provided sliceVal or default to Deep (0.0)
            const threshold = (typeof sliceVal === 'number') ? sliceVal : -this.cutDistMiddle;

            // Find pieces "above" the cut (further out in negative normal direction)
            // My cuts are: n.p + cutDist = 0  => n.p = -cutDist.
            // Tip piece center has n.p ~ -3.
            // Edge/Center piece center has n.p ~ -1.
            // Base piece has n.p > 0.
            // So we want n.p <= threshold.

            const cubies = this.cubieList.filter(c => {
                // Must use current position, not initialCenter, because pieces move!
                const dot = c.position.dot(normal);
                const isSelected = dot <= threshold + 0.01;
                // Debug log for checking margins
                if (faceIdx === 1) console.log(`[Move Debug] Axis: ${axisStr}, Threshold: ${threshold}, Dot: ${dot.toFixed(3)}, Selected: ${isSelected}`);
                return isSelected;
            });

            return {
                axisVector: normal,
                cubies: cubies,
                angle: dir * (Math.PI * 2 / 3) // 120 degrees
            };
        }
        return null; // Fallback
    }

    getNotation(axisStr, sliceVal, turns) {
        const faceIdx = parseInt(axisStr);
        if (isNaN(faceIdx)) return axisStr;

        // Map indices to letters. 
        // 0=Green(Top) -> U
        // 1=Red -> R
        // 2=Blue -> L
        // 3=Yellow -> B
        const letters = ['U', 'R', 'L', 'B'];
        let letter = letters[faceIdx] || '?';

        // Check if Tip (sliceVal approx -cutDistTip)
        if (Math.abs(sliceVal - (-this.cutDistTip)) < 0.1) {
            letter = letter.toLowerCase();
        }

        let suffix = '';
        if (turns === -1) suffix = "'";
        return letter + suffix;
    }

    snapCubies(cubies) {
        // For non-cubic puzzles, exact grid snapping is complex.
        // We rely on the animation engine ending at exact rotation.
        // We could implement drift correction here if needed later.
    }

    isSolved() {
        // Placeholder: Check if all faces have uniform color?
        // For now, return false or implement basic check.
        // Basic check: Iterate faces, check normals vs color?
        // Or check if every piece is in solved position/rotation.
        // Return false to allow playing without "Solved!" popup spam.
        return false;
    }

    getScramble() {
        // Generate random moves
        const moves = [];
        const axes = ['0', '1', '2', '3']; // Face indices
        const dirs = [1, -1];

        // WCA Scramble length is usually 11 for Pyraminx (plus tips).
        // Let's do 20 random moves for now.
        for (let i = 0; i < 20; i++) {
            const axis = axes[Math.floor(Math.random() * axes.length)];
            const dir = dirs[Math.floor(Math.random() * dirs.length)];
            const isDeep = Math.random() < 0.5; // Random depth? WCA is usually tips + top level.

            // WCA notation: U, R, L, B (Big) and u, r, l, b (Tips).
            // Let's mix them.

            // Notation Logic:
            // 0=U/u, 1=R/r, 2=L/l, 3=B/b

            moves.push({
                axis: axis,
                direction: dir,
                sliceVal: isDeep ? -this.cutDistMiddle : -this.cutDistTip
            });
        }
        return moves;
    }

    getDragAxis(faceNormal, screenMoveVec) {
        // Placeholder to prevent crash on drag
        return { axis: 'x', rotationAxis: new THREE.Vector3(1, 0, 0), angleScale: 1 };
    }

    addDebugPlanes() {
        // Clear existing
        if (this.debugPlanes) {
            this.debugPlanes.forEach(p => {
                if (p.parent) p.parent.remove(p);
                if (p.geometry) p.geometry.dispose();
                if (p.material) p.material.dispose();
            });
        }
        this.debugPlanes = [];

        const addPlane = (normal, constant, color, name) => {
            // Plane defined by N.p = constant.
            // My cuts are N.p = -cutDist.
            // So constant passed here matches the 'constant' in intersection constraints?
            // In intersection: plane eq is N.p + (-constant) = 0 => N.p = constant.
            // In constraints I used: { normal: n, constant: -this.cutDistTip }
            // So N.p = -cutDistTip.

            // Visual Plane:
            // Position = Normal * Constant.
            const center = normal.clone().multiplyScalar(constant);

            const size = 3.0;
            const geom = new THREE.PlaneGeometry(size, size);
            const mat = new THREE.MeshBasicMaterial({
                color: color,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.2,
                depthWrite: false,
            });
            const mesh = new THREE.Mesh(geom, mat);

            // Orient: Default plane normal is (0,0,1).
            // We want it to be 'normal'.
            mesh.lookAt(normal);
            // lookAt aligns -Z to target? No, lookAt rotates objects +Z axis to point at target.
            // PlaneGeometry faces +Z.
            // So if we lookAt(normal), +Z points to normal. Correct.
            // But lookAt is relative to parent?
            // object.lookAt(vector) makes the object's positive Z axis point at the vector. 
            // But we want the plane normal (locally +Z) to align with global 'normal'.
            // However, lookAt usage: mesh.lookAt(target). Target is a point.
            // We want orientation. 
            // mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), normal);
            mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

            mesh.position.copy(center);
            mesh.userData = { isDebugPlane: true, name };

            this.parent.add(mesh);
            this.debugPlanes.push(mesh);
        };

        this.faceNormals.forEach((n, i) => {
            addPlane(n, -this.cutDistTip, 0xff0000, `Tip Cut ${i} `);
            addPlane(n, -this.cutDistMiddle, 0x00ff00, `Middle Cut ${i} `);
        });
    }

    createSticker(mesh, group, faceIdx) {
        // Project points to 2D on face plane, shrink, extrude/offset.
        // Implementation similar to Megaminx but simplified for triangles.
        const normal = this.faceNormals[faceIdx];
        const points = [];
        const pos = mesh.geometry.attributes.position;
        // Collect points close to surface
        for (let i = 0; i < pos.count; i++) {
            const p = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
            // Adjust for gap: faces are generated at S - gap
            const targetDist = this.surfaceDist;
            if (Math.abs(p.dot(normal) - targetDist) < 0.05) {
                points.push(p);
            }
        }

        if (points.length < 3) return;

        // Convex Hull on Plane
        // 1. Basis
        const zAxis = normal.clone();
        const xAxis = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), zAxis).normalize();
        if (xAxis.length() < 0.1) xAxis.crossVectors(new THREE.Vector3(0, 0, 1), zAxis).normalize();
        const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis);

        // 2. Project
        const pts2d = points.map(p => new THREE.Vector2(p.dot(xAxis), p.dot(yAxis)));

        // 3. Convex Hull 2D (Graham scan or Monotone Chain, or just sort since it's small)
        // Center
        const center = new THREE.Vector2();
        pts2d.forEach(p => center.add(p));
        center.divideScalar(pts2d.length);

        // Sort by angle
        pts2d.sort((a, b) => {
            return Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x);
        });

        // Filter dups and collinears
        const unique = [pts2d[0]];
        for (let i = 1; i < pts2d.length; i++) {
            if (pts2d[i].distanceTo(unique[unique.length - 1]) > 0.01) unique.push(pts2d[i]);
        }
        // Loop closure check
        if (unique.length > 2 && unique[0].distanceTo(unique[unique.length - 1]) < 0.01) unique.pop();

        if (unique.length < 3) return;

        // Shrink (inset) and center at origin
        // Subtract center, scale, then the shape is centered at (0,0)
        const scaledPoints = unique.map(p => p.clone().sub(center).multiplyScalar(this.stickerScale));

        // Create Shape with Rounded Corners
        const shape = new THREE.Shape();
        const len = scaledPoints.length;
        const r = this.stickerRadius;

        if (r > 0.001) {
            // Rounded polygon algorithm (same as Megaminx)
            // For each corner, calculate curve start/end points based on radius
            for (let i = 0; i < len; i++) {
                const curr = scaledPoints[i];
                const prev = scaledPoints[(i - 1 + len) % len];
                const next = scaledPoints[(i + 1) % len];

                const vPrev = prev.clone().sub(curr).normalize();
                const vNext = next.clone().sub(curr).normalize();

                // Calculate distance to start/end of curve based on radius and angle
                const angle = vPrev.angleTo(vNext);
                const dist = r / Math.tan(angle / 2);

                // Clamp distance to avoid overlapping (max is half edge length)
                const edgeLenPrev = curr.distanceTo(prev);
                const edgeLenNext = curr.distanceTo(next);
                const finalDist = Math.min(dist, edgeLenPrev * 0.45, edgeLenNext * 0.45);

                const pStart = curr.clone().add(vPrev.multiplyScalar(finalDist));
                const pEnd = curr.clone().add(vNext.multiplyScalar(finalDist));

                if (i === 0) {
                    shape.moveTo(pStart.x, pStart.y);
                } else {
                    shape.lineTo(pStart.x, pStart.y);
                }
                shape.quadraticCurveTo(curr.x, curr.y, pEnd.x, pEnd.y);
            }
            shape.closePath();
        } else {
            // No rounding - simple polygon
            const start = scaledPoints[0];
            shape.moveTo(start.x, start.y);
            for (let i = 1; i < len; i++) {
                const p = scaledPoints[i];
                shape.lineTo(p.x, p.y);
            }
            shape.closePath();
        }

        const geo = new THREE.ShapeGeometry(shape);
        const mat = new THREE.MeshStandardMaterial({
            color: this.faceColors[faceIdx],
            roughness: this.stickerRoughness,
            metalness: this.stickerMetalness,
            side: THREE.DoubleSide
        });

        if (this.stickerUseSparkle) {
            if (!this.sparkleMap) {
                this.sparkleMap = createSparkleMap();
            }
            mat.normalMap = this.sparkleMap;
            mat.normalScale = new THREE.Vector2(this.stickerNormalScale, this.stickerNormalScale);
        }

        const sticker = new THREE.Mesh(geo, mat);

        // Orient
        const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
        sticker.rotation.setFromRotationMatrix(matrix);

        // Position: Re-project center to 3D and add offset
        const center3d = new THREE.Vector3()
            .addScaledVector(xAxis, center.x)
            .addScaledVector(yAxis, center.y)
            .addScaledVector(zAxis, this.surfaceDist + this.stickerOffset);

        sticker.position.copy(center3d);
        sticker.userData = { isSticker: true, faceIndex: faceIdx };

        group.add(sticker);
    }



    getRotationAxes() {
        const axes = {};
        this.faceNormals.forEach((n, i) => axes[i] = n);
        return axes;
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
        data[i] = 128 + (Math.random() - 0.5) * 64;
        data[i + 1] = 128 + (Math.random() - 0.5) * 64;
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

