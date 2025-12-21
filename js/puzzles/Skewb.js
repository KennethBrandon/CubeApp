import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { Puzzle } from './Puzzle.js';
import { state } from '../shared/state.js';
import { queueMove } from '../game/moves.js';

export class Skewb extends Puzzle {
    constructor(config) {
        super(config);
        this.scrambleLength = 12; // WCA standard is typically around 11? Random state. 12 is fine.
        this.parent = config.parent || state.cubeWrapper;
        this.cubieList = config.cubieList || state.allCubies;

        // Visual Parameters
        this.radius = 1.5; // Overall size
        this.cubieGap = 0.01;
        this.stickerScale = 0.9;
        this.stickerOffset = 0.002;
        this.stickerRadius = 0.02;
        this.cornerStickerInset = 0.08;
        this.centerStickerInset = 0.08;
        this.cornerStickerRadius = 0.25;
        this.centerStickerRadius = 0.25;

        this.stickerOffset = 0.005; // Increased to prevent z-fighting
        this.filletRadius = 0.055;
        this.filletSteps = 3;

        this.stickerRoughness = 0.39;
        this.stickerMetalness = 0.1;
        this.stickerUseSparkle = true;
        this.stickerNormalScale = 0.7;
        this.sparkleMap = null;

        // Face Colors (Standard Scheme)
        // 0: Green, 1: Orange, 2: Blue, 3: Red, 4: White, 5: Yellow
        // Order matters for face mapping.
        // Let's use standard cube mapping for consistency if possible, or define explicitly.
        // StandardCube: R, L, U, D, F, B.
        // Here we generate by position, so let's use:
        // x+ (Right) = Orange? No, standard is Blue?
        // Let's stick to WCA: U=White, F=Green, R=Red, L=Orange, B=Blue, D=Yellow.
        this.faceColors = [
            0xFF0000, // Right (Red)
            0xF88A0D, // Left (Orange)
            0xFFFFFF, // Up (White)
            0xFFFF00, // Down (Yellow)
            0x00FF00, // Front (Green)
            0x0000FF  // Back (Blue)
        ];

        // 4 Rotation Axes (Diagonals)
        // WCA Standard:
        // R: Down-Right-Back (Red-Blue-Yellow) -> (+x, -y, -z) -> (1, -1, -1)
        // L: Down-Left-Front (Green-Yellow-Orange) -> (-x, -y, +z) -> (-1, -1, 1)
        // U: Up-Left-Back (White-Blue-Orange) -> (-x, +y, -z) -> (-1, 1, -1)
        // B: Down-Left-Back (Blue-Orange-Yellow) -> (-x, -y, -z) -> (-1, -1, -1)

        this.axes = [
            new THREE.Vector3(1, -1, -1).normalize(),  // 0: R
            new THREE.Vector3(-1, -1, 1).normalize(),  // 1: L
            new THREE.Vector3(-1, 1, -1).normalize(),  // 2: U
            new THREE.Vector3(-1, -1, -1).normalize()  // 3: B
        ];

        // Only 4 axes needed to cover all moves (since moving C is same as moving Opp(C) inverse).

        this.cutDist = 0.0; // Deep cut through center

        this.stickerRoughness = 0.2;
        this.stickerMetalness = 0.1;
        this.stickerUseSparkle = false;

        this.showDebugPlanes = false;
        this.showDebugArrows = false;
        this.debugArrows = [];

        // Create geometry immediately
        this.rebuildGeometry();
    }

    getSnapAngle() {
        return 2 * Math.PI / 3;
    }

    rebuildGeometry() {
        this.createGeometry();
    }

    createGeometry() {
        // Clear
        this.cubieList.forEach(c => { if (c.parent) c.parent.remove(c); });
        this.cubieList.length = 0;

        const R = this.radius;
        const keys = [
            [1, 0, 0], [-1, 0, 0], // x faces
            [0, 1, 0], [0, -1, 0], // y faces
            [0, 0, 1], [0, 0, -1]  // z faces
        ];
        const faceNormals = keys.map(k => new THREE.Vector3(...k));

        // Intersection Helper (same as Pyraminx/Megaminx)
        const intersection = (constraints) => {
            const points = [];
            const n = constraints.length;
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    for (let k = j + 1; k < n; k++) {
                        const c1 = constraints[i], c2 = constraints[j], c3 = constraints[k];
                        const n1 = c1.normal, n2 = c2.normal, n3 = c3.normal;
                        const det = n1.dot(n2.clone().cross(n3));
                        if (Math.abs(det) < 1e-6) continue;

                        // Plane: n.x = k
                        // Intersection:
                        const v = new THREE.Vector3()
                            .addScaledVector(n2.clone().cross(n3), c1.constant)
                            .addScaledVector(n3.clone().cross(n1), c2.constant)
                            .addScaledVector(n1.clone().cross(n2), c3.constant)
                            .divideScalar(det);

                        // Check validity
                        let valid = true;
                        for (let m = 0; m < n; m++) {
                            if (m === i || m === j || m === k) continue;
                            if (constraints[m].normal.dot(v) > constraints[m].constant + 1e-4) {
                                valid = false;
                                break;
                            }
                        }
                        if (valid) points.push(v);
                    }
                }
            }
            return points;
        };

        // Helper to Add Fillet/Bevel Constraints
        const tryAddRounding = (constraints, n1, k1, n2, k2) => {
            if (this.filletRadius <= 0.001) return;

            // Check angle between normals
            const dot = n1.dot(n2);
            if (dot < -0.9) return; // Ignore opposite planes

            const r = this.filletRadius;
            const steps = this.filletSteps;

            for (let i = 1; i <= steps; i++) {
                const t = i / (steps + 1);

                // Interpolate normal (unnormalized first)
                const nRaw = n1.clone().multiplyScalar(1 - t).add(n2.clone().multiplyScalar(t));
                const len = nRaw.length();
                if (len < 0.001) continue;

                const nFinal = nRaw.clone().normalize();

                // Calculate constant k
                // k_t = [ ( (1-t)k1 + t*k2 - r ) / len ] + r
                const kInterp = (1 - t) * k1 + t * k2;
                const kFinal = ((kInterp - r) / len) + r;

                constraints.push({ normal: nFinal, constant: kFinal, type: 'fillet' });
            }
        };

        const generateMesh = (points) => {
            const uniquePoints = [];
            points.forEach(p => {
                if (!uniquePoints.some(up => up.distanceTo(p) < 0.001)) uniquePoints.push(p);
            });
            if (uniquePoints.length < 4) return null;
            try {
                return new ConvexGeometry(uniquePoints);
            } catch (e) { return null; }
        };

        const finalizePiece = (geometry, type, basePos) => {
            const material = new THREE.MeshStandardMaterial({
                color: 0x222222,
                roughness: 0.5,
                metalness: 0.1
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const group = new THREE.Group();
            group.add(mesh);

            // Compute center
            geometry.computeBoundingBox();
            const center = new THREE.Vector3();
            geometry.boundingBox.getCenter(center);

            geometry.center(); // Geometry now at 0,0,0
            group.position.copy(center);

            // Stickers
            faceNormals.forEach((n, idx) => {
                // Check if mesh has a face with this normal
                // The geometry is centered at 'center'. Surface is at R.
                // We use a looser epsilon to catch rounded faces too.
                if (Math.abs(center.dot(n) - R) < 0.8) {
                    this.createSticker(mesh, group, idx, n, R, type);
                }
            });

            // Gap (Visual Shift)
            if (this.cubieGap > 0) {
                group.position.add(center.clone().normalize().multiplyScalar(this.cubieGap));
            }

            group.userData = { type, isCubie: true, initialCenter: group.position.clone() };
            this.parent.add(group);
            this.cubieList.push(group);
        };

        // Use class axes for consistency
        const cutNormals = this.axes;

        // Define Sign Signatures
        // Corners: 8
        const cornerSigns = [];
        for (let x = -1; x <= 1; x += 2) {
            for (let y = -1; y <= 1; y += 2) {
                for (let z = -1; z <= 1; z += 2) {
                    const pos = new THREE.Vector3(x, y, z);
                    const baseConstraints = [];

                    // Surface constraints
                    faceNormals.forEach(n => {
                        baseConstraints.push({ normal: n, constant: this.radius });
                    });

                    // Cut constraints
                    cutNormals.forEach(n => {
                        const s = Math.sign(pos.dot(n));
                        baseConstraints.push({ normal: n.clone().multiplyScalar(-s), constant: 0 });
                    });

                    // Fillets
                    const constraints = [...baseConstraints];
                    for (let i = 0; i < baseConstraints.length; i++) {
                        for (let j = i + 1; j < baseConstraints.length; j++) {
                            tryAddRounding(constraints,
                                baseConstraints[i].normal, baseConstraints[i].constant,
                                baseConstraints[j].normal, baseConstraints[j].constant
                            );
                        }
                    }

                    const geo = generateMesh(intersection(constraints));
                    if (geo) finalizePiece(geo, 'corner', pos);
                }
            }
        }

        // Centers: 6
        faceNormals.forEach((fn, idx) => {
            const pos = fn.clone().multiplyScalar(this.radius);
            const baseConstraints = [];

            // Surface
            faceNormals.forEach(n => {
                baseConstraints.push({ normal: n, constant: this.radius });
            });

            // Cut Constraints
            cutNormals.forEach(n => {
                const s = Math.sign(pos.dot(n));
                baseConstraints.push({ normal: n.clone().multiplyScalar(-s), constant: 0 });
            });

            // Fillets
            const constraints = [...baseConstraints];
            for (let i = 0; i < baseConstraints.length; i++) {
                for (let j = i + 1; j < baseConstraints.length; j++) {
                    tryAddRounding(constraints,
                        baseConstraints[i].normal, baseConstraints[i].constant,
                        baseConstraints[j].normal, baseConstraints[j].constant
                    );
                }
            }

            const geo = generateMesh(intersection(constraints));
            if (geo) finalizePiece(geo, 'center', pos);
        });
    }

    createSticker(mesh, group, faceIdx, normal, R, type) {
        const faceColor = this.faceColors[faceIdx];
        if (faceColor === undefined) return;

        const geo = mesh.geometry;
        const pos = geo.attributes.position;
        const points = [];

        const center = group.position;
        // TIGHT TOLERANCE: Ignore fillet fall-off points to get a clean face polygon
        const tolerance = 0.002;

        for (let i = 0; i < pos.count; i++) {
            const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
            const worldV = v.clone().add(center);
            if (Math.abs(worldV.dot(normal) - R) < tolerance) {
                points.push(v);
            }
        }

        if (points.length < 3) return;

        // 1. Project to 2D
        const zAxis = normal.clone();
        const xAxis = new THREE.Vector3(0, 1, 0).cross(zAxis).normalize();
        if (xAxis.lengthSq() < 0.01) xAxis.copy(new THREE.Vector3(1, 0, 0).cross(zAxis).normalize());
        const yAxis = zAxis.clone().cross(xAxis);

        let pts2d = points.map(p => {
            return new THREE.Vector2(p.dot(xAxis), p.dot(yAxis));
        });

        // 2. Compute Convex Hull (Monotone Chain)
        // Sort by X then Y
        pts2d.sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);

        const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

        const lower = [];
        for (let p of pts2d) {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
                lower.pop();
            }
            lower.push(p);
        }

        const upper = [];
        for (let i = pts2d.length - 1; i >= 0; i--) {
            const p = pts2d[i];
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
                upper.pop();
            }
            upper.push(p);
        }

        upper.pop();
        lower.pop();
        let hull = lower.concat(upper);

        // 3. Simplify Hull (Merge close points)
        // This removes tiny jitters that might cause inset artifacts
        const uniquePts = [];
        const simplifyDist = 0.01;

        if (hull.length > 0) uniquePts.push(hull[0]);
        for (let i = 1; i < hull.length; i++) {
            if (hull[i].distanceTo(uniquePts[uniquePts.length - 1]) > simplifyDist) {
                uniquePts.push(hull[i]);
            }
        }
        // Check closure against start (though hull shouldn't have duplicate start/end typically)
        if (uniquePts.length > 2 && uniquePts[uniquePts.length - 1].distanceTo(uniquePts[0]) < simplifyDist) {
            uniquePts.pop();
        }

        if (uniquePts.length < 3) return;

        // Ensure CCW Winding
        let signedArea = 0;
        for (let i = 0; i < uniquePts.length; i++) {
            const p1 = uniquePts[i];
            const p2 = uniquePts[(i + 1) % uniquePts.length];
            signedArea += (p1.x * p2.y - p2.x * p1.y);
        }
        if (signedArea < 0) {
            uniquePts.reverse();
        }

        // --- INSET LOGIC ---
        // 1. Calculate Safe Inset Limit
        // Find distance from Centroid to closest edge.
        const centroid = new THREE.Vector2();
        uniquePts.forEach(p => centroid.add(p));
        centroid.divideScalar(uniquePts.length);

        let maxInset = Infinity;
        for (let i = 0; i < uniquePts.length; i++) {
            const p1 = uniquePts[i];
            const p2 = uniquePts[(i + 1) % uniquePts.length];
            const edge = p2.clone().sub(p1);
            const len = edge.length();
            if (len < 1e-6) continue;

            // Distance from centroid to line segment
            // For convex polygon with centroid inside, dist is projection onto normal.
            // Normal pointing Inward (CCW): (-dy, dx)
            const normal2D = new THREE.Vector2(-edge.y, edge.x).normalize();
            const dist = normal2D.dot(centroid.clone().sub(p1));

            if (dist > 0 && dist < maxInset) {
                maxInset = dist;
            }
        }
        // Safety buffer
        maxInset = Math.max(0, maxInset - 0.01);

        let insetAmount = (type === 'corner') ? this.cornerStickerInset : this.centerStickerInset;
        // Clamp inset to prevent inversion
        insetAmount = Math.min(insetAmount, maxInset);

        const intersectLines = (p1, v1, p2, v2) => {
            const det = v1.x * v2.y - v1.y * v2.x;
            if (Math.abs(det) < 1e-9) return null;
            const t = ((p2.x - p1.x) * v2.y - (p2.y - p1.y) * v2.x) / det;
            return new THREE.Vector2(p1.x + v1.x * t, p1.y + v1.y * t);
        };

        const stickerRadius = (type === 'corner') ? this.cornerStickerRadius : this.centerStickerRadius;

        const insetPts = [];
        const n = uniquePts.length;

        const lines = [];
        for (let i = 0; i < n; i++) {
            const p1 = uniquePts[i];
            const p2 = uniquePts[(i + 1) % n];
            const edge = p2.clone().sub(p1);
            // Normal (Left turn -> Inward for CCW)
            const normal2D = new THREE.Vector2(-edge.y, edge.x).normalize();

            const p1_shifted = p1.clone().add(normal2D.clone().multiplyScalar(insetAmount));
            lines.push({ p: p1_shifted, dir: edge.normalize() });
        }

        for (let i = 0; i < n; i++) {
            const l1 = lines[i];
            const l2 = lines[(i + 1) % n];
            const p = intersectLines(l1.p, l1.dir, l2.p, l2.dir);
            if (p) insetPts.push(p);
            else insetPts.push(l1.p);
        }

        const sPts = insetPts;
        const len = sPts.length;
        const shape = new THREE.Shape();

        // Create Rounded Shape
        if (stickerRadius > 0.001) {
            const r = stickerRadius;
            const getP = (i) => sPts[(i + len) % len];

            for (let i = 0; i < len; i++) {
                const pPrev = getP(i - 1);
                const pCurr = getP(i);
                const pNext = getP(i + 1);

                const v1 = pCurr.clone().sub(pPrev).normalize();
                const v2 = pNext.clone().sub(pCurr).normalize();

                const distPrev = pCurr.distanceTo(pPrev);
                const distNext = pCurr.distanceTo(pNext);
                const maxD = Math.min(distPrev, distNext) * 0.45;
                const d = Math.min(r, maxD);

                const t1 = pCurr.clone().sub(v1.multiplyScalar(d));
                const t2 = pCurr.clone().add(v2.multiplyScalar(d));

                if (i === 0) shape.moveTo(t1.x, t1.y);
                else shape.lineTo(t1.x, t1.y);

                shape.quadraticCurveTo(pCurr.x, pCurr.y, t2.x, t2.y);
            }
            shape.closePath();
        } else {
            shape.moveTo(sPts[0].x, sPts[0].y);
            for (let i = 1; i < len; i++) shape.lineTo(sPts[i].x, sPts[i].y);
            shape.closePath();
        }

        const stickerGeo = new THREE.ShapeGeometry(shape);
        const stickerMat = new THREE.MeshStandardMaterial({
            color: faceColor,
            roughness: this.stickerRoughness,
            metalness: this.stickerMetalness,
            side: THREE.DoubleSide
        });

        if (this.stickerUseSparkle) {
            if (!this.sparkleMap) {
                this.sparkleMap = createSparkleMap();
            }
            stickerMat.normalMap = this.sparkleMap;
            stickerMat.normalScale = new THREE.Vector2(this.stickerNormalScale, this.stickerNormalScale);
        }

        const sticker = new THREE.Mesh(stickerGeo, stickerMat);
        sticker.userData = { isSticker: true };
        sticker.receiveShadow = true;

        // Rotate back
        const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
        sticker.rotation.setFromRotationMatrix(matrix);

        // Position
        const dist = R - center.dot(normal);
        // Ensure robust offset against z-fighting
        sticker.position.copy(normal.clone().multiplyScalar(dist + Math.max(0.01, this.stickerOffset)));
        group.add(sticker);
    }

    getSliceCubies(axisStr, sliceVal) {
        console.log(`[Skewb.getSliceCubies] axisStr: ${axisStr}, sliceVal: ${sliceVal}`);
        const axisIdx = parseInt(axisStr);
        if (isNaN(axisIdx)) return [];

        const normal = this.axes[axisIdx];
        if (!normal) return [];

        // Determine side based on sliceVal
        // If sliceVal is effectively 0 (e.g. keyboard command without slice info), default to positive?
        // Or handle "Deep" cuts. Skewb cuts are at 0.
        // Interactions usually send the coordinate of the click.
        // If clicking on positive side, sliceVal > 0.
        const sign = (sliceVal !== null && sliceVal < 0) ? -1 : 1;
        console.log(`[Skewb] Sign: ${sign}, Normal: ${normal.x.toFixed(2)},${normal.y.toFixed(2)},${normal.z.toFixed(2)}`);

        const cubies = this.cubieList.filter(c => {
            const dot = c.position.dot(normal);
            return sign > 0 ? dot > 0.01 : dot < -0.01;
        });
        console.log(`[Skewb] Selected ${cubies.length} cubies`);
        return cubies;
    }

    // --- Interaction Methods ---

    handleKeyDown(event) {
        const key = event.key;
        const lowerKey = key.toLowerCase();
        const shift = event.shiftKey;
        const dir = shift ? -1 : 1;

        // Map keys to axes
        // T -> uR (UBR)
        // Y -> uL (UFL)
        // R, L, U, B, F -> Standard corners

        const layout = {
            't': 'uR',
            'y': 'uL',
            'r': 'R',
            'l': 'L',
            'u': 'U',
            'b': 'B',
            'f': 'F',
            'd': 'D'
        };

        if (layout.hasOwnProperty(lowerKey)) {
            const axisStr = layout[lowerKey];
            queueMove(axisStr, dir);
            return true;
        }

        return false;
    }

    getMoveInfo(axisStr, dir, sliceVal) {
        // console.log(`[Skewb.getMoveInfo] axisStr: ${axisStr}, dir: ${dir}, sliceVal: ${sliceVal}`);

        const notationMap = {
            'R': 0,
            'L': 1,
            'U': 2,
            'B': 3,
            'F': 3, // F is opposite B
            'uR': 1, // uR (UBR) is opposite L
            'uL': 0, // uL (UFL) is opposite R
            'D': 2   // D (FDR) is opposite U
        };

        // Define which side of the axis (positive or negative) corresponds to the notation
        // 1 = Positive Side (along axis)
        // -1 = Negative Side (opposite axis)
        const sideMap = {
            'R': 1,
            'L': 1,
            'U': 1,
            'B': 1,
            'F': -1,
            'uR': -1,
            'uL': -1,
            'D': -1
        };

        let axisIdx = parseInt(axisStr);
        let moveDir = dir;
        let targetSide = 1; // Default to positive side

        if (isNaN(axisIdx)) {
            if (notationMap.hasOwnProperty(axisStr)) {
                axisIdx = notationMap[axisStr];

                // Determine target side
                targetSide = sideMap[axisStr] || 1;

                // Logic for Inversion:
                // If we are moving a "Negative Side" (Opposite) corner, we usually need to invert the rotation 
                // to match the visual "Clockwise" expectation for that corner.
                // Standard Logic: 
                // Axis Defined 0..3.
                // R (Axis 0, Pos): CW -> Angle * 1
                // L (Axis 1, Pos): CW -> Angle * 1
                // U (Axis 2, Pos): CW -> Angle * 1
                // B (Axis 3, Pos): CW -> Angle * 1

                // F (Axis 3, Neg): CW (Visual) -> CCW around Axis 3 -> Angle * -1
                // uR (Axis 1, Neg): CW (Visual) -> CCW around Axis 1 -> Angle * -1
                // uL (Axis 0, Neg): CW (Visual) -> CCW around Axis 0 -> Angle * -1

                if (targetSide === -1) {
                    moveDir *= -1;
                }

            } else {
                console.warn(`[Skewb] Unknown axisStr: ${axisStr}`);
                return null;
            }
        } else {
            // Numeric axis passed (e.g. from drag)
            // Determine side from sliceVal if present
            if (sliceVal !== null && sliceVal < -0.01) {
                targetSide = -1;
            }
        }

        const normal = this.axes[axisIdx];
        if (!normal) return null;

        // Select Cubies
        const cubies = this.cubieList.filter(c => {
            const dot = c.position.dot(normal);
            return targetSide > 0 ? dot > 0.01 : dot < -0.01;
        });

        // WCA Direction Compliance:
        // WCA defines moves as Clockwise around the corner.
        // Our Axes are defined pointing towards specific corners (R, L, U, B).
        // If we select the Positive side (R, L, U, B), a positive rotation around the axis is CCW (Right Hand Rule).
        // Wait, THREE.js rotation is CCW around axis for positive angle.
        // So angle > 0 -> CCW.
        // WCA "R" means Clockwise R.
        // Facing R corner, Clockwise = Negative Rotation around axis pointing at you.
        // So for "Normal" corners (R, L, U, B), "CW" -> Angle < 0.

        // Let's test standard first. 
        // If I pass dir=1 (CW), I usually want negative angle in THREE.js.
        // `moves.js` often multiplies by (Math.PI/2) * dir.
        // If dir=1 -> Angle = 90. 90 in Three.js is CCW.
        // So visually that looks inverted.
        // Let's invert ALL angles to match "Standard" CW = Negative Angle.

        const angle = moveDir * -1 * (2 * Math.PI / 3);

        return {
            axisVector: normal,
            cubies: cubies,
            angle: angle
        };
    }

    getNotation(axis, sliceVal, turns) {
        const axisIdx = parseInt(axis);
        if (isNaN(axisIdx)) return null;

        // turns: -1 (CW?), 1 (CCW?)
        // In logMove/finishMove, turns is derived from angle.
        // angle < 0 -> turns < 0? 
        // If we inverted logic in getMoveInfo (dir 1 -> angle -1),
        // Then an executed move of dir 1 results in turns = -1 (approx).
        // Let's see what finishMove passes.
        // It passes turns based on drag angle.
        // If drag was CW (visual), angle is negative (standard 3D).
        // turns is negative.

        // So turns = -1 -> CW Visual.
        // turns = 1 -> CCW Visual.

        const isNegativeSide = (sliceVal < -0.01);

        let prefix = '';

        /* 
           Mapping:
           Axis 0: Pos -> R, Neg -> uL
           Axis 1: Pos -> L, Neg -> uR
           Axis 2: Pos -> U, Neg -> D (unused usually, maybe just D?)
           Axis 3: Pos -> B, Neg -> F
        */

        if (axisIdx === 0) prefix = isNegativeSide ? 'uL' : 'R';
        else if (axisIdx === 1) prefix = isNegativeSide ? 'uR' : 'L';
        else if (axisIdx === 2) prefix = isNegativeSide ? 'D' : 'U'; // D is unofficial but logical
        else if (axisIdx === 3) prefix = isNegativeSide ? 'F' : 'B';

        // Inversion Logic for Notation
        // If we are on Negative Side (uL, uR, F, D), the "Axis" points AWAY from the corner.
        // A "CW" move around the corner (Visual CW) is CCW around the Axis (since axis points away?).
        // Wait.
        // Axis points to R. uL is opposite R.
        // Vector R points AWAY from uL.
        // Facing uL, the R-axis points into the screen (away from you).
        // Positive Rotation around R-axis (CCW relative to R-axis) -> CCW from your view (facing uL).
        // So Positive Angle -> CCW Visual.
        // Negative Angle -> CW Visual.

        // So for "Negative Side" corners (uL):
        // Turns = -1 (Neg Angle) -> CW Visual.
        // Turns = 1 (Pos Angle) -> CCW Visual.

        // For "Positive Side" corners (R):
        // Facing R, Axis points AT you.
        // Positive Rotation (CCW relative to Axis) -> CCW Visual.
        // Negative Rotation -> CW Visual.

        // It seems consistent?
        // If Turns < 0 -> CW.
        // If Turns > 0 -> CCW (Prime).

        let notationTurns = turns;

        // Adjust for internal consistency if needed. 
        // In previous logic I inverted F?
        // Let's stick to: "CW Visual = Notation Base". "CCW Visual = Notation Prime".
        // If turns < 0, that's CW. -> Base.
        // If turns > 0, that's CCW. -> Prime.

        // However, let's double check my Drag Logic.
        // Drag produces an angle. 
        // If I drag R CW, angle goes negative. turns = -1.
        // Notation should be 'R'.

        // If I drag F (Neg Side).
        // If I drag F CW.
        // Axis points Away.
        // Visual CW = Rotation around Axis?
        // Facing F, Axis points Away. Use Right Hand Thumb points away. Fingers curl CW.
        // So Positive Rotation (CCW relative to axis?) No. Positive is CCW.
        // If Thumb points Away (Positive Z?? No, Axis direction).
        // If Axis points Away, Positive Rotation is CW (Visual).
        // So Backside: Positive Angle = CW Visual.
        // Frontside: Negative Angle = CW Visual.

        // Correct Logic:
        // Positive Side (R, L, U, B): CW Visual = Negative Angle (turns < 0).
        // Negative Side (uL, uR, F, D): CW Visual = Positive Angle (turns > 0).

        // So if Negative Side, we need to invert turns to match "Standard" notation direction.
        if (isNegativeSide) {
            notationTurns *= -1;
        }

        // Now:
        // notationTurns < 0 -> CW -> Base
        // notationTurns > 0 -> CCW -> Prime

        // Wait. 'R' usually means CW. 
        // If `turns` is -1 (CW on R), then I want "R".
        // If `turns` is 1 (CCW on R), then I want "R'".

        let suffix = '';
        if (Math.abs(notationTurns) === -1 || notationTurns < 0) {
            // CW. No suffix? 
            // Wait, usually turns is 1 for base?
            // Standard Moves:
            // R -> 1 turn?
            // queueMove('R', 1) -> 
            // getMoveInfo calls angle = dir * -1 * val.
            // dir=1 -> angle = -90.
            // pivot rotates -90.
            // finishMove sees -90. turns = -1.
            // logMove sees turns = -1.
            // notation should be 'R'. 

            // So turns < 0 => "R" (Base).
            // turns > 0 => "R'" (Prime).

            suffix = '';
        } else {
            suffix = "'";
        }

        // Handle double moves?? Skewb doesn't really have 2 moves, it's 120 degrees?
        // My code used Math.PI * 2 / 3.
        // turns will be fractional? 
        // finishMove normalizes turns by 90 degrees usually?
        // Skewb move is ~120 degrees.
        // snapPivot: `targetTurns` based on `piHalf` (90).
        // Skewb: 120 deg.
        // My Generic Snap uses 90 deg.
        // Skewb needs to override `getSnapAngle`? Yes.

        // I should probably also implement `getSnapAngle` to return 120 degrees (2pi/3).
        // Otherwise snap logic will try to snap to 90.

        // But back to notation:
        // If turns is negative -> Base.
        // If turns is positive -> Prime.

        return prefix + suffix;
    }


    getDragAxis(faceNormal, screenMoveVec, intersectedCubie, camera, intersectedPoint) {
        // console.log(`[Skewb.getDragAxis] Checking drag...`);
        if (!intersectedCubie) return null;

        // 1. Identify the clicked Face Index from faceNormal
        // Transform faceNormal to local space
        const localFaceNormal = faceNormal.clone().transformDirection(state.cubeWrapper.matrixWorld.clone().invert()).normalize();

        // Find best matching face normal (0..5)
        const faceDefinitions = [
            new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
            new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)
        ];





        let bestFaceIdx = -1;
        let maxDot = 0;
        faceDefinitions.forEach((n, i) => {
            const dot = n.dot(localFaceNormal);
            if (dot > maxDot) {
                maxDot = dot;
                bestFaceIdx = i;
            }
        });

        // 2. Evaluate Axes and Filter by Drag Alignment
        const matches = [];
        const threshold = 0.5; // Score threshold for alignment

        this.axes.forEach((axis, i) => {
            // Calculate Logical Tangent (Axis x Normal)
            const tangent = new THREE.Vector3().crossVectors(axis, localFaceNormal);
            if (tangent.lengthSq() < 0.001) return; // Parallel
            tangent.normalize();

            // Project to Screen
            const p1 = intersectedCubie.position.clone().applyMatrix4(state.cubeWrapper.matrixWorld).add(new THREE.Vector3().setFromMatrixPosition(state.cubeWrapper.matrixWorld));
            const p2 = p1.clone().add(tangent.clone().transformDirection(state.cubeWrapper.matrixWorld));

            const v1 = p1.clone().project(camera);
            const v2 = p2.clone().project(camera);

            const screenTangent = new THREE.Vector2(v2.x - v1.x, -(v2.y - v1.y)).normalize(); // Invert Y for screen coords

            const score = Math.abs(screenTangent.dot(screenMoveVec));

            if (score > threshold) {
                // Determine dominant axis
                const inputAxis = Math.abs(screenTangent.x) > Math.abs(screenTangent.y) ? 'x' : 'y';
                const angleScale = Math.sign(screenTangent[inputAxis]) || 1;

                matches.push({
                    axisIdx: i,
                    axisVec: axis,
                    score: score,
                    tangent: tangent,
                    angleScale: angleScale,
                    inputAxis: inputAxis
                });
            }
        });

        let bestMatch = null;

        if (matches.length > 0) {
            // Sort by score descending
            matches.sort((a, b) => b.score - a.score);

            const bestScore = matches[0].score;
            // Keep candidates within 10% of best score
            const candidates = matches.filter(m => m.score > bestScore * 0.9);

            if (candidates.length === 1) {
                bestMatch = {
                    axis: candidates[0].axisIdx.toString(),
                    rotationAxis: candidates[0].axisVec,
                    angleScale: candidates[0].angleScale,
                    inputAxis: candidates[0].inputAxis
                };
            } else {
                // Disambiguate using Closest Corner
                if (intersectedPoint) {
                    const localPoint = intersectedPoint.clone().applyMatrix4(state.cubeWrapper.matrixWorld.clone().invert());
                    let bestDistSq = Infinity;
                    let winner = null;

                    candidates.forEach(cand => {
                        // Check which end of the axis is closer (approximate corner direction)
                        const cornerA = cand.axisVec.clone().normalize();
                        const cornerB = cand.axisVec.clone().negate().normalize();

                        const dirToPoint = localPoint.clone().normalize();

                        const distA = dirToPoint.distanceToSquared(cornerA);
                        const distB = dirToPoint.distanceToSquared(cornerB);

                        const minDist = Math.min(distA, distB);
                        if (minDist < bestDistSq) {
                            bestDistSq = minDist;
                            winner = cand;
                        }
                    });

                    if (winner) {
                        bestMatch = {
                            axis: winner.axisIdx.toString(),
                            rotationAxis: winner.axisVec,
                            angleScale: winner.angleScale,
                            inputAxis: winner.inputAxis
                        };
                    }
                } else {
                    // Fallback
                    bestMatch = {
                        axis: candidates[0].axisIdx.toString(),
                        rotationAxis: candidates[0].axisVec,
                        angleScale: candidates[0].angleScale,
                        inputAxis: candidates[0].inputAxis
                    };
                }
            }
        }

        // Debug Arrows
        if (this.showDebugArrows) {
            const arrowCandidates = matches.map(m => m.axisIdx);
            this.updateDebugArrows(intersectedCubie, arrowCandidates, camera, localFaceNormal);
        }

        if (bestMatch) {
            console.log(`[Skewb.getDragAxis] Best Axis: ${bestMatch.axis}`);

            // Determine slice value
            // Skewb cuts are deep (through center).
            // Logic: Determine which side of the cut projection the piece is on.
            // But Skewb pieces move together in a half-space.
            // If we selected a valid axis, the piece is definitely on one side of the cut.
            // Which side?
            // The cut plane passes through origin (constant=0).
            // So side = sign(pos . normal).
            const axisNormal = bestMatch.rotationAxis;
            // BestMatch.axis is index 0..3.
            // Check dot product of piece center with axis normal.

            // We need the piece's current position (approx centroid).
            const piecePos = intersectedCubie.position.clone(); // Local to parent (which is 0,0,0 usually? or wrapper?)
            // Cubies are children of puzzle (this.parent?), wait.
            // In Skewb constructor: this.parent = config.parent || state.cubeWrapper;
            // Cubies are added to this.parent.
            // So cubie.position is in World Space (if wrapper is at 0,0,0 and unrotated) or Wrapper Space.
            // getDragAxis is called with Wrapper Space normals typically?
            // axisNormal is from this.axes (local/wrapper space).

            const dot = piecePos.dot(axisNormal);
            // If dot > 0, side is +1. If dot < 0, side is -1.
            // Skewb sliceVal threshold is 0.
            // But we need a value that SELECTS that side.
            // getSliceCubies logic:
            // return sign > 0 ? dot > 0.01 : dot < -0.01;
            // So if dot > 0, we want sliceVal > 0. Say 0.5.
            // If dot < 0, we want sliceVal < 0. Say -0.5.

            const sliceVal = (dot > 0) ? 0.5 : -0.5;

            return {
                dragAxis: bestMatch.axis,
                dragRotationAxis: bestMatch.rotationAxis,
                dragAngleScale: bestMatch.angleScale,
                dragSliceValue: sliceVal,
                dragInputAxis: bestMatch.inputAxis
            };
        }
        return null;
    }

    updateDebugArrows(intersectedCubie, candidates, camera, faceNormal) {
        if (this.debugArrows) {
            this.debugArrows.forEach(a => {
                if (a.parent) a.parent.remove(a);
            });
        }
        this.debugArrows = [];

        if (!intersectedCubie) return;

        // Origin for arrows (try to put on surface)
        let originLocal = intersectedCubie.position.clone();

        // Find the sticker that matches the faceNormal (approx) to place arrow on surface
        let bestSticker = null;
        let maxStickerDot = 0.8; // Threshold

        intersectedCubie.children.forEach(child => {
            if (child.userData.isSticker) {
                // Sticker normal is approximately its Z axis in local space.
                // Or rather, the sticker's Z-axis (transformed by quaternion) matches the piece's outward normal.
                const stickerNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(child.quaternion);
                const dot = stickerNormal.dot(faceNormal);
                if (dot > maxStickerDot) {
                    maxStickerDot = dot;
                    bestSticker = child;
                }
            }
        });

        if (bestSticker) {
            // Sticker position is relative to intersectedCubie
            originLocal.add(bestSticker.position);
            // Move slightly out to avoid z-fighting with sticker
            originLocal.add(faceNormal.clone().multiplyScalar(0.05));
        } else {
            // Fallback: piece center + radius * normal
            originLocal.add(faceNormal.clone().multiplyScalar(this.radius * 0.5));
        }

        candidates.forEach(axisIdx => {
            const axis = this.axes[axisIdx];
            const tangent = new THREE.Vector3().crossVectors(axis, faceNormal).normalize();

            const len = 0.75;
            const color = 0xff0000;
            const headLen = 0.2;
            const headWidth = 0.1;

            const arrow = new THREE.ArrowHelper(tangent, originLocal, len, color, headLen, headWidth);
            this.parent.add(arrow);
            this.debugArrows.push(arrow);

            const arrow2 = new THREE.ArrowHelper(tangent.clone().negate(), originLocal, len, color, headLen, headWidth);

            this.parent.add(arrow2);
            this.debugArrows.push(arrow2);
        });
    }

    getNotation(axisStr, sliceVal, turns) {
        // Converts internal axis/turns to WCA notation
        // axisStr might be "0", "1", "2", "3" from Drag, or "R", "L", etc from Keyboard
        // turns: 1 (CW), -1 (CCW)

        // Normalize turns (modulo 3)
        let t = Math.round(turns) % 3;
        if (t === 2) t = -1;
        if (t === -2) t = 1;
        if (t === 0) return null; // No move or 360

        // 1. Handle String Inputs directly (Keyboard)
        const notationMap = {
            'R': { axis: 0, val: 1 },
            'L': { axis: 1, val: 1 },
            'U': { axis: 2, val: 1 },
            'B': { axis: 3, val: 1 },
            'uR': { axis: 1, val: -1 }, // uR is opposite L (Axis 1)
            'uL': { axis: 0, val: -1 }, // uL is opposite R (Axis 0)
            'D': { axis: 2, val: -1 },  // D is opposite U (Axis 2)
            'F': { axis: 3, val: -1 }   // F is opposite B (Axis 3)
        };

        if (notationMap.hasOwnProperty(axisStr)) {
            // Already a notation string (from keyboard)
            // Just need to append turns suffix
            let suffix = '';
            if (Math.abs(turns) === 2) suffix = '2';
            else if (turns === -1) suffix = "'"; // Standard logic: turns < 0 is CW (base), turns > 0 is CCW (')?
            // Wait, previous logic: 
            // Negative Side: CW Visual = Positive Angle (turns > 0).
            // Positive Side: CW Visual = Negative Angle (turns < 0).

            // However, getMoveInfo normalizes this.
            // If I queueMove('uR', 1), it sends dir=1.
            // getMoveInfo sees 'uR', sets targetSide=-1.
            // Inverts angle? 
            // If targetSide=-1, moveDir *= -1. So dir becomes -1.
            // Angle = -1 * -1 * 120 = 120 (Positive).
            // finishMove sees positive angle -> turns > 0.

            // So for uR (Negative Side):
            // Keyboard 'uR' (CW) -> turns > 0.
            // If turns > 0, we want "uR".
            // If turns < 0, we want "uR'".

            // For R (Positive Side):
            // Keyboard 'R' (CW) -> dir=1 -> Angle = -120 (Neg).
            // finishMove sees negative angle -> turns < 0.
            // If turns < 0, we want "R".
            // If turns > 0, we want "R'".

            // So:
            // if (isNegativeSide) { turns > 0 -> Base } else { turns < 0 -> Base }

            const info = notationMap[axisStr];
            const isNeg = info.val < 0;

            let isPrime = false;
            // Use normalized t
            if (isNeg) {
                // Negative Side: t > 0 is Base. t < 0 is Prime.
                if (t < 0) isPrime = true;
            } else {
                // Positive Side: t < 0 is Base. t > 0 is Prime.
                if (t > 0) isPrime = true;
            }

            if (isPrime) suffix = "'";
            return axisStr + suffix;
        }

        // 2. Handle Numeric Inputs (Drag)
        let axisIdx = parseInt(axisStr);
        if (isNaN(axisIdx)) return null;

        // Valid Axis Indices: 0, 1, 2, 3
        // Determine Slice Side from sliceVal
        // sliceVal > 0 -> Positive Side (R, L, U, B)
        // sliceVal < 0 -> Negative Side (uL, uR, D, F)

        let char = '?';
        let isNegativeSide = (sliceVal < -0.01);

        /*
           Mapping:
           Axis 0: Pos -> R, Neg -> uL
           Axis 1: Pos -> L, Neg -> uR
           Axis 2: Pos -> U, Neg -> D
           Axis 3: Pos -> B, Neg -> F
        */

        if (axisIdx === 0) char = isNegativeSide ? 'uL' : 'R';
        else if (axisIdx === 1) char = isNegativeSide ? 'uR' : 'L';
        else if (axisIdx === 2) char = isNegativeSide ? 'D' : 'U';
        else if (axisIdx === 3) char = isNegativeSide ? 'F' : 'B';

        // Suffix Logic
        let isPrime = false;
        // Use normalized t
        if (isNegativeSide) {
            // Negative Side: t > 0 is Base.
            if (t < 0) isPrime = true;
        } else {
            // Positive Side: t < 0 is Base.
            if (t > 0) isPrime = true;
        }

        let suffix = '';
        if (isPrime) suffix = "'";
        return char + suffix;
    }


    getCycleLength() {
        return 3;
    }

    getScramble() {
        const moves = [];
        const axes = ['0', '1', '2', '3'];
        for (let i = 0; i < this.scrambleLength; i++) {
            const axis = axes[Math.floor(Math.random() * axes.length)];
            const dir = Math.random() < 0.5 ? 1 : -1;
            moves.push({ axis, dir });
        }
        return moves;
    }

    snapCubies(cubies) {
        // Define valid Tetrahedral rotations (12 in total)
        // Same symmetry group as Pyraminx
        if (!this._validQuats) {
            this._validQuats = [];

            // 1. Identity
            this._validQuats.push(new THREE.Quaternion());

            // 2. Face Rotations (X, Y, Z) - 90, 180, 270 degrees
            // Total: 3 axes * 3 angles = 9 rotations
            const axesFace = [
                new THREE.Vector3(1, 0, 0),
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(0, 0, 1)
            ];
            axesFace.forEach(axis => {
                this._validQuats.push(new THREE.Quaternion().setFromAxisAngle(axis, Math.PI / 2));
                this._validQuats.push(new THREE.Quaternion().setFromAxisAngle(axis, Math.PI));
                this._validQuats.push(new THREE.Quaternion().setFromAxisAngle(axis, 3 * Math.PI / 2));
            });

            // 3. Corner Rotations (Diagonals) - 120, 240 degrees
            // Total: 4 axes * 2 angles = 8 rotations
            // Use this.axes which are the 4 main diagonals
            this.axes.forEach(axis => {
                this._validQuats.push(new THREE.Quaternion().setFromAxisAngle(axis, 2 * Math.PI / 3));
                this._validQuats.push(new THREE.Quaternion().setFromAxisAngle(axis, 4 * Math.PI / 3));
            });

            // 4. Edge Rotations (Face Diagonals/Midpoints) - 180 degrees
            // Total: 6 axes * 1 angle = 6 rotations
            // Axes: (±1, ±1, 0), (±1, 0, ±1), (0, ±1, ±1) normalized
            const v = 1 / Math.sqrt(2);
            const axesEdge = [
                new THREE.Vector3(v, v, 0),
                new THREE.Vector3(v, -v, 0),
                new THREE.Vector3(v, 0, v),
                new THREE.Vector3(v, 0, -v),
                new THREE.Vector3(0, v, v),
                new THREE.Vector3(0, v, -v)
            ];
            axesEdge.forEach(axis => {
                this._validQuats.push(new THREE.Quaternion().setFromAxisAngle(axis, Math.PI));
            });

            // Total: 1 + 9 + 8 + 6 = 24 rotations (Full Octahedral Symmetry)
        }

        cubies.forEach(c => {
            c.quaternion.normalize();
            let bestQ = null;
            let maxDot = -1;

            this._validQuats.forEach(q => {
                const dot = Math.abs(c.quaternion.dot(q));
                if (dot > maxDot) {
                    maxDot = dot;
                    bestQ = q;
                }
            });

            if (bestQ) {
                c.quaternion.copy(bestQ);
            }
        });
    }

    isFaceRectangular(axis) {
        return false; // Skewb faces are not rectangular grid-like for rotation snapping logic
    }

    getSnapAngle() {
        return (Math.PI * 2) / 3; // 120 degrees
    }

    isSolved() {
        // Check all 6 directions for uniform colors
        // This is rotation-invariant - it checks sticker orientations relative to cube, not world.
        // Similar to StandardCube implementation.

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
                        // Calculate the sticker's normal in local cube space (relative to cubeWrapper)
                        const normal = new THREE.Vector3(0, 0, 1);
                        normal.applyQuaternion(child.quaternion);
                        normal.applyQuaternion(group.quaternion);

                        // Check if this sticker is facing the current direction
                        const dotProduct = normal.dot(faceDir);
                        if (dotProduct > 0.9) {
                            const stickerColor = child.material.color.getHex();
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

            // Each face must have at least one sticker (Skewb has 5 per face: 1 center + 4 corners)
            if (stickerCount === 0) {
                isAllSolved = false;
            }

            if (!isAllSolved) break;
        }

        return isAllSolved;
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
