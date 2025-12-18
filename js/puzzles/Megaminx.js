import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { Puzzle } from './Puzzle.js';
import { SPACING, COLORS } from '../shared/constants.js';
import { state } from '../shared/state.js';
import { queueMove } from '../game/moves.js';

export class Megaminx extends Puzzle {
    constructor(config) {
        super(config);
        this.scrambleLength = 45; // Default
        this.phi = (1 + Math.sqrt(5)) / 2;
        this.parent = config.parent || state.cubeWrapper;
        this.cubieList = config.cubieList || state.allCubies;

        // Define 12 Colors
        this.faceColors = [
            0xFF0000, // 0: Red
            0x800080, // 1: Purple
            0xF2637B, // 2: Pink (Opp Purple)
            0xF88A0D, // 3: Orange (Opp Red)
            0xFFFFFF, // 4: White
            0x32CD32, // 5: Lime (Opp Green)
            0x008500, // 6: Green
            0x808080, // 7: Gray (Opp White)
            0x0000FF, // 8: Blue
            0xFFFF00, // 9: Yellow
            0xFFF6A8, // 10: Cream (Opp Yellow)
            0x42D0FF  // 11: Light Blue (Opp Blue)
        ];

        this.faceNormals = [];

        // Tunable Geometry Parameters
        this.radius = 1.25;
        this.surfaceDist = 2.0;
        this.cutDist = 1.3;
        this.stickerScale = 0.86;
        this.stickerOffset = 0.005;
        this.yRotation = 165;
        this.stickerRadius = 0.08;
        this.cubieGap = 0.020;
        this.filletRadius = 0.015;

        this.cubieGap = 0.020;
        this.filletRadius = 0.015;
        this.stickerRoughness = 0.30;
        this.stickerMetalness = 0.18;
        this.stickerNormalScale = 0.75;
        this.stickerUseSparkle = true;
        this.sparkleMap = null;
    }


    rebuildGeometry() {
        this.createGeometry();
    }

    // RE-WRITING createGeometry to be cleaner and handle stickers inline
    createGeometry() {
        this.cubieList.forEach(c => { if (c.parent) c.parent.remove(c); });
        this.cubieList.length = 0;
        this.faceNormals = [];

        const phi = this.phi;
        // Generate 12 Face Normals (Dodecahedron Face Centers = Icosahedron Vertices)
        // (0, ±1, ±phi), (±1, ±phi, 0), (±phi, 0, ±1)
        const tryAddNormal = (x, y, z) => {
            const v = new THREE.Vector3(x, y, z).normalize();
            // Check uniqueness (handle float precision)
            let unique = true;
            for (const n of this.faceNormals) {
                if (n.distanceTo(v) < 0.001) { unique = false; break; }
            }
            if (unique) this.faceNormals.push(v);
        };

        tryAddNormal(0, 1, phi); tryAddNormal(0, 1, -phi);
        tryAddNormal(0, -1, phi); tryAddNormal(0, -1, -phi);
        tryAddNormal(1, phi, 0); tryAddNormal(1, -phi, 0);
        tryAddNormal(-1, phi, 0); tryAddNormal(-1, -phi, 0);
        tryAddNormal(phi, 0, 1); tryAddNormal(phi, 0, -1);
        tryAddNormal(-phi, 0, 1); tryAddNormal(-phi, 0, -1);

        // Vertices (20) - Generate them here to rotate them together with normals
        const vertices = [];
        const addV = (x, y, z) => vertices.push(new THREE.Vector3(x, y, z).normalize());
        for (let x of [-1, 1]) for (let y of [-1, 1]) for (let z of [-1, 1]) addV(x, y, z);
        for (let i of [-1, 1]) for (let j of [-1, 1]) {
            addV(0, i * phi, j / phi);
            addV(i / phi, 0, j * phi);
            addV(i * phi, j / phi, 0);
        }

        // Align Orientation: White (Index 4) to +Y, Green (Index 8) to +Z
        {
            const up = new THREE.Vector3(0, 1, 0);
            const front = new THREE.Vector3(0, 0, 1);

            const n4 = this.faceNormals[4].clone();
            const q1 = new THREE.Quaternion().setFromUnitVectors(n4, up);

            // Apply q1 to n8 to see where it lands
            const n8 = this.faceNormals[8].clone().applyQuaternion(q1);

            // Project n8 to XZ plane
            n8.y = 0; n8.normalize();

            // Rotate n8 to front
            const q2 = new THREE.Quaternion().setFromUnitVectors(n8, front);

            const qFinal = q2.multiply(q1);

            // Apply Manual Y Rotation
            const qY = new THREE.Quaternion().setFromAxisAngle(up, this.yRotation * Math.PI / 180);
            qFinal.premultiply(qY);

            // Apply to all
            this.faceNormals.forEach(n => n.applyQuaternion(qFinal));
            vertices.forEach(v => v.applyQuaternion(qFinal));
        }

        // Use instance params
        const radius = this.radius;
        const surfaceDist = this.surfaceDist;
        const cutDist = this.cutDist;

        const intersection = (constraints) => {
            const points = [];
            const planes = constraints.map(c => {
                // Plane equation: normal . x = constant => normal . x - constant = 0
                // THREE.Plane(normal, constant) equation is normal . x + constant = 0
                // So we want THREE.Plane(normal, -constant)
                return new THREE.Plane(c.normal, -c.constant);
            });

            // Intersect all triplets
            for (let i = 0; i < planes.length; i++) {
                for (let j = i + 1; j < planes.length; j++) {
                    for (let k = j + 1; k < planes.length; k++) {
                        const p1 = planes[i], p2 = planes[j], p3 = planes[k];

                        const n1 = p1.normal, n2 = p2.normal, n3 = p3.normal;
                        const det = n1.dot(n2.clone().cross(n3));

                        if (Math.abs(det) > 1e-6) {
                            const d1 = p1.constant, d2 = p2.constant, d3 = p3.constant;

                            // Formula for intersection of 3 planes:
                            // P = (d1(n2 x n3) + d2(n3 x n1) + d3(n1 x n2)) / det
                            // Note: standard formula uses Plane: n.x = d. 
                            // My THREE.Planes have constant D such that n.x + D = 0. So n.x = -D.
                            // So the "d" in the formula corresponds to -Plane.constant.
                            // Let's use the D values directly from the planes and negate them for the formula?
                            // Formula: P = -(D1(n2xn3) + ...) / det ?
                            // Let's assume standard formula P . n_i = -D_i.
                            // My plane: n.x + D = 0 => n.x = -D.
                            // So "d" in formula = -D.
                            const v = new THREE.Vector3()
                                .addScaledVector(n2.clone().cross(n3), -d1)
                                .addScaledVector(n3.clone().cross(n1), -d2)
                                .addScaledVector(n1.clone().cross(n2), -d3)
                                .divideScalar(det);

                            // Verify point satisfies all OTHER constraints
                            let valid = true;
                            for (let m = 0; m < constraints.length; m++) {
                                // Constraint: normal . x <= constant
                                const val = constraints[m].normal.dot(v);
                                const limit = constraints[m].constant;
                                if (val > limit + 1e-4) {
                                    valid = false;
                                    break;
                                }
                            }
                            if (valid) points.push(v);
                        }
                    }
                }
            }
            return points;
        };

        const generatePiece = (type, constraints) => {
            const points = intersection(constraints);
            if (points.length < 4) {
                // console.warn(`[Megaminx] Failed to generate ${type}: only ${points.length} points.`);
                return null;
            }

            // Remove duplicates/close points
            const uniquePoints = [];
            points.forEach(p => {
                if (!uniquePoints.some(up => up.distanceTo(p) < 0.001)) uniquePoints.push(p);
            });

            if (uniquePoints.length < 4) {
                // console.warn(`[Megaminx] Failed to generate ${type}: only ${uniquePoints.length} unique points.`);
                return null;
            }

            try {
                const geometry = new ConvexGeometry(uniquePoints); // Requires ConvexGeometry included
                const material = new THREE.MeshStandardMaterial({
                    color: 0x222222, // Dark plastic
                    roughness: 0.6,
                    metalness: 0.1
                });
                return new THREE.Mesh(geometry, material);
            } catch (e) {
                console.error("[Megaminx] ConvexGeometry error:", e);
                return null;
            }
        };

        // Material Logic for Stickers
        const applyStickers = (mesh, group, faceIndices) => {
            faceIndices.forEach(idx => {
                const surfaceN = this.faceNormals[idx];
                const stickerPoints = [];
                const positions = mesh.geometry.attributes.position.array;


                // Collect points on this surface plane
                for (let i = 0; i < positions.length; i += 3) {
                    const v = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
                    if (Math.abs(v.dot(surfaceN) - surfaceDist) < 0.01) {
                        // Check uniqueness
                        let unique = true;
                        for (const p of stickerPoints) {
                            if (p.distanceTo(v) < 0.001) { unique = false; break; }
                        }
                        if (unique) stickerPoints.push(v);
                    }
                }

                if (stickerPoints.length >= 3) {
                    // Sort points to form a perimeter
                    // 1. Center
                    const center = new THREE.Vector3();
                    stickerPoints.forEach(p => center.add(p));
                    center.divideScalar(stickerPoints.length);

                    // 2. Basis
                    const axisZ = surfaceN.clone();
                    const axisX = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), axisZ).normalize();
                    if (axisX.lengthSq() < 0.01) axisX.crossVectors(new THREE.Vector3(1, 0, 0), axisZ).normalize();
                    const axisY = new THREE.Vector3().crossVectors(axisZ, axisX);

                    // 3. Sort by Angle
                    stickerPoints.sort((a, b) => {
                        const vecA = a.clone().sub(center);
                        const vecB = b.clone().sub(center);
                        const angleA = Math.atan2(vecA.dot(axisY), vecA.dot(axisX));
                        const angleB = Math.atan2(vecB.dot(axisY), vecB.dot(axisX));
                        return angleA - angleB;
                    });

                    const lenBefore = stickerPoints.length;

                    // 4. Remove Collinear Points
                    // Real corners on Megaminx have exterior angle 72 deg (dot ~0.3) or 60 deg etc.
                    // Vertices with dot > 0.8 are definitely not structural corners (angle < 36 deg).
                    if (stickerPoints.length > 3) {
                        const simplified = [];
                        const n = stickerPoints.length;
                        for (let i = 0; i < n; i++) {
                            const prev = stickerPoints[(i - 1 + n) % n];
                            const curr = stickerPoints[i];
                            const next = stickerPoints[(i + 1) % n];

                            // Check segment length too - ignore micro segments
                            if (curr.distanceTo(next) < 0.02) continue;

                            const v1 = curr.clone().sub(prev).normalize();
                            const v2 = next.clone().sub(curr).normalize();

                            // Filter: Keep only significant corners
                            // Dot < 0.9 (approx 25 degrees or sharper turn)
                            if (v1.dot(v2) < 0.9) {
                                simplified.push(curr);
                            }
                        }
                        if (simplified.length >= 3) {
                            stickerPoints.length = 0;
                            stickerPoints.push(...simplified);
                        }
                    }
                    if (stickerPoints.length !== 5 && lenBefore > 5) {
                        console.log(`[Megaminx] Weird Sticker: ${lenBefore} -> ${stickerPoints.length}. Points:`, stickerPoints);
                    }

                    // 5. Create Shape with Rounded Corners
                    const shape = new THREE.Shape();
                    const to2D = (p) => {
                        const vec = p.clone().sub(center);
                        return new THREE.Vector2(vec.dot(axisX), vec.dot(axisY));
                    };

                    const pts2D = stickerPoints.map(p => to2D(p));
                    const len = pts2D.length;
                    const r = this.stickerRadius;

                    if (r > 0.001) {
                        // Standard rounded polygon algorithm
                        // Move to start of first curve
                        // For each corner i:
                        //   Vector to Prev, Vector to Next. 
                        //   Inset by radius? Or just cut corner?
                        //   User likely wants "Rounded Polygon" where vertices are the tips, but rounded inwards.
                        //   So we move along the edge away from vertex by 'r' (or distance adjusted by angle).
                        //   Actually, simpler: define straight segments between (P_i + offset) and (P_next - offset).
                        //   Then quadratic curve.

                        for (let i = 0; i < len; i++) {
                            const curr = pts2D[i];
                            const prev = pts2D[(i - 1 + len) % len];
                            const next = pts2D[(i + 1) % len];

                            const vPrev = prev.clone().sub(curr).normalize();
                            const vNext = next.clone().sub(curr).normalize();

                            // Calculate distance to start/end of curve based on radius and angle
                            // alpha = angle between vectors
                            // dist = r / tan(alpha / 2)
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
                        const p0 = pts2D[0];
                        shape.moveTo(p0.x, p0.y);
                        for (let i = 1; i < pts2D.length; i++) {
                            const p = pts2D[i];
                            shape.lineTo(p.x, p.y);
                        }
                        shape.closePath();
                    }

                    const sGeo = new THREE.ShapeGeometry(shape);
                    const sMat = new THREE.MeshStandardMaterial({
                        color: this.faceColors[idx],
                        side: THREE.DoubleSide,
                        roughness: this.stickerRoughness,
                        metalness: this.stickerMetalness
                    });

                    if (this.stickerUseSparkle) {
                        if (!this.sparkleMap) {
                            this.sparkleMap = createSparkleMap();
                        }
                        sMat.normalMap = this.sparkleMap;
                        sMat.normalScale = new THREE.Vector2(this.stickerNormalScale, this.stickerNormalScale);
                    }

                    const sticker = new THREE.Mesh(sGeo, sMat);
                    sticker.receiveShadow = true;

                    // Place it back in 3D
                    // ShapeGeometry is on XY plane.
                    // We need to rotate it to match surfaceN, and translate to center.
                    sticker.lookAt(surfaceN); // Z = surfaceN
                    // lookAt aligns Positive Z.
                    // Wait, default lookAt behavior (Object3D) aligns +Z to target.
                    // If sticker is in XY plane, normal is +Z.
                    // So sticker.lookAt(surfaceN) should align the plane normal to surfaceN.

                    // But we also need to align the X/Y axes to our basis?
                    // Let's manually construct matrix.
                    const matrix = new THREE.Matrix4().makeBasis(axisX, axisY, axisZ);
                    sticker.setRotationFromMatrix(matrix);

                    sticker.position.copy(center).add(surfaceN.clone().multiplyScalar(this.stickerOffset)); // Slight offset

                    // Scale
                    sticker.scale.setScalar(this.stickerScale);

                    sticker.userData = { isSticker: true, faceIndex: idx };

                    group.add(sticker);
                }
            });
        };

        const getCentroid = (mesh) => {
            const positions = mesh.geometry.attributes.position.array;
            const center = new THREE.Vector3();
            for (let i = 0; i < positions.length; i += 3) {
                center.x += positions[i];
                center.y += positions[i + 1];
                center.z += positions[i + 2];
            }
            center.divideScalar(positions.length / 3);
            return center;
        };

        const tryAddRounding = (constraints, n1, k1, n2, k2, steps = 3) => {
            if (this.filletRadius <= 0.001) return;

            // Check angle
            const dot = n1.dot(n2);
            if (dot < -0.9) return; // Ignore opposites

            const r = this.filletRadius;

            for (let i = 1; i <= steps; i++) {
                const t = i / (steps + 1);

                // Interpolate normal (unnormalized first)
                // n_raw = (1-t)n1 + t*n2
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

        const finalizePiece = (mesh, type, faces, extraData = {}, stickerMesh = null) => {
            if (!mesh) return;

            // Enable Shadows
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const group = new THREE.Group();
            group.add(mesh);

            // Use specific stickerMesh for sticker generation if provided (proxy), else use the visual mesh
            applyStickers(stickerMesh || mesh, group, faces);

            const center = getCentroid(mesh);
            group.userData = { type, isCubie: true, faces, initialCenter: center, ...extraData };

            // Apply Gap
            if (this.cubieGap > 0.001) {
                group.position.copy(center).normalize().multiplyScalar(this.cubieGap);
            }

            this.parent.add(group);
            this.cubieList.push(group);
        };

        // GENERATE PIECES

        // We define planes:
        // P_i_surf: n_i . x = surfaceDist
        // P_i_cut:  n_i . x = cutDist

        // CENTERS (12)
        // Defined by:
        // Inside P_i_surf
        // Inside P_i_cut (Wait, center is below surface, but above cut? No center is central.)
        // Actually: Center piece is the "Cap" of the face?
        // No, Center piece rotates. It is bound by P_i_surf (top), and P_neighbors_cut (sides).
        // And bottom? Deep inside.
        // Let's define a "Core" sphere or plane.

        // Let's use:
        // Surface: n_i . x <= R
        // Sides: n_j . x <= d (for j in neighbors)
        // Bottom: n_i . x >= 0 (or some lower bound) => -n_i . x <= 0

        // Neighbors of face i:
        const getNeighbors = (i) => {
            const n = this.faceNormals[i];
            const neighbors = [];
            this.faceNormals.forEach((nb, idx) => {
                if (idx !== i && n.distanceTo(nb) < 1.1) neighbors.push(idx);
            });
            if (i === 0) console.log(`[Megaminx] Center 0 Neighbors: ${neighbors.length} (${neighbors})`);
            return neighbors;
        };

        for (let i = 0; i < this.faceNormals.length; i++) {
            const constraints = [];
            // Surface
            constraints.push({ normal: this.faceNormals[i], constant: surfaceDist, type: 'surface' });

            const neighbors = [];
            this.faceNormals.forEach((n, idx) => {
                if (i !== idx && n.distanceTo(this.faceNormals[i]) < 1.3) neighbors.push(idx);
            });

            // Cuts + Bevels
            neighbors.forEach(idx => {
                const nCut = this.faceNormals[idx];
                const kCut = cutDist;
                constraints.push({ normal: nCut, constant: kCut, type: 'cut' });

                // Add Bevel between Surface (i) and Cut (idx)
                tryAddRounding(constraints, this.faceNormals[i], surfaceDist, nCut, kCut);

                // Bevel between adjacent cuts? (Internal corners)
                // Maybe too complex for now. Focus on visible surface edges.
            });

            // Core limit
            constraints.push({ normal: this.faceNormals[i].clone().negate(), constant: -radius * 0.2, type: 'core' });

            const mesh = generatePiece('center', constraints);
            if (mesh) {
                finalizePiece(mesh, 'center', [i], { faceIndex: i });
            } else {
                console.warn("Failed to create CENTER " + i);
            }
        }

        // CORNERS (20)
        // Shared by 3 Faces (i, j, k)
        // Top: Surface i, Surface j, Surface k
        // Sides: Cut i, Cut j, Cut k ???
        // No.
        // A Corner Piece is "Outside" the cut planes of its faces?
        // Wait, Center was "Inside" the cut planes of neighbors.
        // So Center is "Small".
        // Corner is "Big" (between cuts).
        // Corner is defined by:
        // Surfaces i, j, k.
        // OPPOSITE of Cut planes i, j, k?
        // n_i . x >= cutDist => -n_i . x <= -cutDist.

        // Let's find corners (vertices 3 faces)
        // Vertices of Dodecahedron (Icosahedron faces?)
        // Vertices of Dodecahedron are points where 3 faces meet.
        // There are 20.
        // For each Vertex V:
        //    Find 3 closest faces -> i, j, k.
        //    Constraints:
        //       Surface i, Surface j, Surface k.
        //       Base/Core constraint (sphere? or distance?) -> n_i . x >= 0 ...
        //       Boundaries from Neighbors of i,j,k?
        //       Actually, the Cut Planes of i, j, k divide the space.
        //       Center i is < Cut i.
        //       Corner (shared by i) must be > Cut i ?
        //       If Corner is > Cut i, and > Cut j, and > Cut k ... it is the "corner" chunk.

        // Vertices are already generated and rotated at the top
        vertices.forEach(v => {
            const faces = this.getClosestFaces(v, 3);
            const baseConstraints = [];
            const cutInners = [];

            // Surfaces
            faces.forEach(idx => baseConstraints.push({ normal: this.faceNormals[idx], constant: surfaceDist, type: 'surface' }));

            // Cuts (Must be OUTSIDE cut planes of these faces) => Inside Inverted Cut Plane
            faces.forEach(idx => {
                const nInv = this.faceNormals[idx].clone().negate();
                const kInv = -cutDist;
                baseConstraints.push({ normal: nInv, constant: kInv, type: 'cut_inner' });
                cutInners.push({ n: nInv, k: kInv, idx: idx });
            });
            baseConstraints.push({ normal: v.clone().negate(), constant: -0.4 * radius, type: 'core' });


            // Fillets
            const filletConstraints = [...baseConstraints];

            // 1. Surface Ridges
            for (let a = 0; a < faces.length; a++) {
                for (let b = a + 1; b < faces.length; b++) {
                    tryAddRounding(filletConstraints,
                        this.faceNormals[faces[a]], surfaceDist,
                        this.faceNormals[faces[b]], surfaceDist
                    );
                }
            }
            // 2. Surface vs Side Walls (Cut Inner)
            for (let i = 0; i < faces.length; i++) {
                for (let j = 0; j < cutInners.length; j++) {
                    if (faces[i] === cutInners[j].idx) continue;
                    tryAddRounding(filletConstraints,
                        this.faceNormals[faces[i]], surfaceDist,
                        cutInners[j].n, cutInners[j].k
                    );
                }
            }
            // 3. Side Wall vs Side Wall
            for (let a = 0; a < cutInners.length; a++) {
                for (let b = a + 1; b < cutInners.length; b++) {
                    tryAddRounding(filletConstraints,
                        cutInners[a].n, cutInners[a].k,
                        cutInners[b].n, cutInners[b].k
                    );
                }
            }

            const mesh = generatePiece('corner', filletConstraints);
            let proxyMesh = null;
            if (this.filletRadius > 0.001) {
                proxyMesh = generatePiece('corner_proxy', baseConstraints);
            }

            if (mesh) {
                finalizePiece(mesh, 'corner', faces, {}, proxyMesh);
            } else {
                console.warn(`Failed to generate CORNER at ${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`);
                // Debug Placeholder
                const geo = new THREE.SphereGeometry(0.2);
                const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.copy(v).multiplyScalar(radius);

                const group = new THREE.Group();
                group.add(mesh);
                group.userData = { type: 'debug', isCubie: false };
                this.parent.add(group);
            }
        });

        // EDGES (30)
        // Shared by 2 Faces (i, j).
        // Surface i, Surface j.
        // Outside Cut i, Outside Cut j.
        // Inside Cut k (neighbors).
        // Actually, Edge is bounded by Corners on 2 sides, and Centers on 2 sides.
        // Bounded by Cut i (inner), Cut j (inner).
        // Bounded by Cuts of Neighbors?
        // Yes. Center was < Cut. Corner was > Cut.
        // Edge is > Cut(i,j) but < Cut(others).

        const edges = [];
        for (let i = 0; i < vertices.length; i++) {
            for (let j = i + 1; j < vertices.length; j++) {
                const d = vertices[i].distanceTo(vertices[j]);
                if (d > 0.6 && d < 0.8) {
                    edges.push(vertices[i].clone().add(vertices[j]).multiplyScalar(0.5).normalize());
                }
            }
        }

        edges.forEach(v => {
            const faces = this.getClosestFaces(v, 2);
            const baseConstraints = [];
            const cutInners = [];

            // Surfaces
            faces.forEach(idx => baseConstraints.push({ normal: this.faceNormals[idx], constant: surfaceDist, type: 'surface' }));

            // Cuts (Must be OUTSIDE cut planes of these faces) => Inside Inverted Cut Plane
            // Cut Plane is: n . x = cutDist
            // Outside means n . x > cutDist
            // Inverted: -n . x < -cutDist
            faces.forEach(idx => {
                const nInv = this.faceNormals[idx].clone().negate();
                const kInv = -cutDist;
                baseConstraints.push({ normal: nInv, constant: kInv, type: 'cut_inner' });
                cutInners.push({ n: nInv, k: kInv, idx: idx });
            });

            // Bounded by Corners?
            // Corners are at "ends" of edge.
            // Cut planes of "Neighboring Faces" (that are not i or j).
            // Find neighbors of i and j.
            // The edge touches faces i, j.
            // The ends of the edge touch faces k, l (corners).
            // So we need to be INSIDE Cut k, Cut l?
            // Yes. Center was < Cut. Corner was > Cut.
            // Edge is > Cut(i,j) but < Cut(others).

            // Let's add constraints: n_m . x <= cutDist for all m != i,j
            this.faceNormals.forEach((n, idx) => {
                if (!faces.includes(idx)) {
                    baseConstraints.push({ normal: n, constant: cutDist, type: 'cut_bound' });
                }
            });

            // Core cap
            baseConstraints.push({ normal: v.clone().negate(), constant: -0.4 * radius, type: 'core' });

            const filletConstraints = [...baseConstraints];

            // Apply bevels between Surfaces (Ridges)
            tryAddRounding(filletConstraints,
                this.faceNormals[faces[0]], surfaceDist,
                this.faceNormals[faces[1]], surfaceDist
            );

            // Bevels between Surface and Cut_inner
            tryAddRounding(filletConstraints, this.faceNormals[faces[0]], surfaceDist, cutInners[1].n, cutInners[1].k);
            tryAddRounding(filletConstraints, this.faceNormals[faces[1]], surfaceDist, cutInners[0].n, cutInners[0].k);

            // Bevels between Cut Inners (Vertical Edge inside gap)
            tryAddRounding(filletConstraints, cutInners[0].n, cutInners[0].k, cutInners[1].n, cutInners[1].k);

            const mesh = generatePiece('edge', filletConstraints);
            let proxyMesh = null;
            if (this.filletRadius > 0.001) {
                proxyMesh = generatePiece('edge_proxy', baseConstraints);
            }

            if (mesh) {
                finalizePiece(mesh, 'edge', faces, {}, proxyMesh);
            }
        });
    }
    // Placeholder to force a view of the top of the file - I need to see lines 100-200 before applying fix.

    getClosestFaces(vector, count) {
        // Returns indices of 'count' closest face normals to 'vector'
        const scored = this.faceNormals.map((n, i) => ({ index: i, dist: n.distanceTo(vector) }));
        scored.sort((a, b) => a.dist - b.dist);
        return scored.slice(0, count).map(s => s.index);
    }

    getRotationAxes() {
        // Return Map of axis IDs to Vectors
        // We can use 0..11 as IDs
        const axes = {};
        this.faceNormals.forEach((n, i) => {
            axes[i] = n;
        });
        return axes;
    }

    getMoveInfo(moveId, direction) {
        // moveId is index 0..11
        // direction: 1 or -1
        console.log(`[Megaminx] getMoveInfo called for axis ${moveId}, dir ${direction}`);

        const axisIdx = parseInt(moveId);
        const axisVector = this.faceNormals[axisIdx];
        if (!axisVector) {
            console.warn(`[Megaminx] Invalid axis vector for index ${axisIdx}`);
            return null;
        }

        // Find Pieces involved
        // Logic: Project piece position onto axis. If > threshold, it's in the layer.
        // Dodecahedron layer thickness logic.
        // Center dist ~ 1.65 (with scale 1.5 * 1.1)
        // Cosine of angle between adjacent faces (dihedral angle 116.5 deg) -> center to adjacent center angle 63.4 deg.
        // We want to capture the "cap".
        // Threshold: dot product > cos(angle_of_cut).
        // Standard Megaminx cut is deep enough to include adjacent edges/corners.
        // Let's debug with a generous threshold.
        // Dot product of (FaceCenter, AdjacentCenter) ~ cos(63.4) ~ 0.447.
        // Dot product of (FaceCenter, Opposite) = -1.
        // We want everything "above" the cut.
        // A value around 0.5 should work?
        // Let's select pieces where dot(pos.normalize, axis) > 0.8?
        // Wait, adjacent edge is roughly 30 deg away?
        // 0.447 is distance to adjacent face center.
        // The cut must be "above" the adjacent centers? No, it includes them.

        const cubies = this.cubieList.filter(c => {
            const initial = c.userData.initialCenter;
            if (!initial) return false;

            // Calculate current center in World Space (relative to puzzle center)
            const currentPos = initial.clone().applyQuaternion(c.quaternion).add(c.position);

            const dot = currentPos.normalize().dot(axisVector);
            return dot > 0.55; // Threshold ~33 deg (Corner is ~37 deg, Edge ~31 deg? No. Corner is closest.)
        });

        return {
            axisVector,
            cubies,
            angle: direction * (Math.PI * 2 / 5), // 72 degrees
            axis: moveId
        };
    }
    getScramble() {
        console.log("Megaminx.getScramble called");
        // Generate random sequence of face turns
        const numMoves = this.scrambleLength;
        const moves = [];
        let lastFace = -1;

        for (let i = 0; i < numMoves; i++) {
            let face;
            // Prevent same face twice in a row
            do {
                face = Math.floor(Math.random() * 12);
            } while (face === lastFace);

            lastFace = face;

            // Direction: 1 or -1
            const dir = Math.random() > 0.5 ? 1 : -1;

            moves.push({
                axis: String(face),
                dir: dir,
                sliceVal: null
            });
        }
        return moves;
    }

    getNotation(axis, sliceVal, turns) {
        const faceIdx = parseInt(axis);
        if (isNaN(faceIdx)) return axis;

        const colors = [
            "Red", "Purple", "Pink", "Orange", "White", "Lime",
            "Green", "Gray", "Blue", "Yellow", "Cream", "LtBlue"
        ];

        const name = colors[faceIdx] || ("Face" + faceIdx);
        const suffix = turns === -1 ? "'" : (Math.abs(turns) === 2 ? "2" : "");

        return name + suffix;
    }

    isSolved() {
        console.log("Checking isSolved...");
        let totalStickersFound = 0;

        for (const faceDir of this.faceNormals) {
            let faceColorHex = null;
            let count = 0;

            for (const group of this.cubieList) {
                // Determine group rotation
                // Check direct children for stickers first (StandardCube style)
                let stickers = group.children.filter(c => c.userData.isSticker);

                // If no stickers found on group, check if they are on a child mesh (STL style?)
                if (stickers.length === 0 && group.children.length > 0) {
                    // Assuming first child is the mesh if it exists
                    const mesh = group.children[0];
                    if (mesh) {
                        stickers = mesh.children.filter(c => c.userData.isSticker);
                    }
                }

                for (const child of stickers) {
                    const v = new THREE.Vector3(0, 0, 1);
                    v.applyQuaternion(child.quaternion);
                    // If sticker is on mesh, apply mesh rotation? 
                    // Need to know parentage. 
                    // child.parent.quaternion should handle it if we use world direction logic properly?
                    // But we are in "Puzzle Space".

                    // Let's assume stickers are direct children of group for now or handle the parent explicity.
                    if (child.parent !== group) {
                        v.applyQuaternion(child.parent.quaternion);
                    }
                    v.applyQuaternion(group.quaternion);

                    if (v.dot(faceDir) > 0.9) {
                        const color = child.material.color.getHex();
                        if (faceColorHex === null) faceColorHex = color;
                        else if (faceColorHex !== color) {
                            console.log("Fail: Color mismatch on face", faceDir);
                            return false;
                        }
                        count++;
                    }
                }
            }
            totalStickersFound += count;
            if (count === 0) {
                console.log("Fail: No stickers found for face", faceDir);
                return false;
            }
        }
        console.log("Pass: All faces solved. Total stickers checked:", totalStickersFound);
        return true;
    }

    // ... helpers ...


    isFaceRectangular(axis) { return false; }
    getSnapAngle() { return Math.PI * 2 / 5; }

    getSliceCubies(axisId, val) {
        // axisId is face index (0-11) or 'x','y','z'
        // val is meaningless for face rotation, but Infinity for whole cube

        if (val === Infinity || ['x', 'y', 'z'].includes(axisId)) {
            return this.cubieList;
        }

        const axisIdx = parseInt(axisId);
        const axisVector = this.faceNormals[axisIdx];
        if (!axisVector) return [];

        return this.cubieList.filter(c => {
            const initial = c.userData.initialCenter;
            if (!initial) return false;

            // Calculate current center in World Space (relative to puzzle center)
            const currentPos = initial.clone().applyQuaternion(c.quaternion).add(c.position);

            const dot = currentPos.normalize().dot(axisVector);
            return dot > 0.55;
        });
    }

    getLockedRotationAxis(axis) {
        const target = new THREE.Vector3();
        if (axis === 'x') target.set(1, 0, 0);
        else if (axis === 'y') target.set(0, 1, 0);
        else if (axis === 'z') target.set(0, 0, 1);

        // Find closest face normal
        let bestN = null;
        let maxAbsDot = -1;
        let bestSign = 1;

        for (const n of this.faceNormals) {
            const dot = n.dot(target);
            if (Math.abs(dot) > maxAbsDot) {
                maxAbsDot = Math.abs(dot);
                bestN = n;
                bestSign = Math.sign(dot) || 1;
            }
        }

        if (bestN) {
            return bestN.clone().multiplyScalar(bestSign);
        }
        return target; // Fallback
    }

    getDragAxis(faceNormal, screenMoveVec, intersectedCubie, camera) {
        if (!intersectedCubie) return null;

        // 1. Transform faceNormal to local space
        const localFaceNormal = faceNormal.clone().transformDirection(state.cubeWrapper.matrixWorld.clone().invert()).normalize();

        // 2. Identify the Face Index
        let bestFaceIdx = -1;
        let maxDot = 0;
        this.faceNormals.forEach((n, i) => {
            const dot = n.dot(localFaceNormal);
            if (dot > maxDot) {
                maxDot = dot;
                bestFaceIdx = i;
            }
        });

        if (maxDot < 0.8) return null; // Not clicking a top face?

        // 3. Candidates: Neighbors ONLY (Cannot rotate the face you are clicking)
        const candidates = [];
        this.faceNormals.forEach((n, i) => {
            if (i !== bestFaceIdx) {
                const dist = n.distanceTo(this.faceNormals[bestFaceIdx]);
                // Neighbor distance logic (angle ~63 deg, distance ~1.05)
                if (dist < 1.3) candidates.push(i);
            }
        });

        // 4. Test candidates
        let bestMatch = null;
        let bestScore = 0;

        candidates.forEach(axisIdx => {
            const axisVec = this.faceNormals[axisIdx];

            // Check if piece is in this layer
            const localPos = intersectedCubie.position.clone();
            // Sync threshold with getSliceCubies (0.5)
            // Center to Adjacent Center dot is ~0.45. We want to EXCLUDE centers from adjacent layers.
            // Edge/Corner dot is higher.
            const inLayer = localPos.normalize().dot(axisVec) >= 0.5;
            if (!inLayer) return; // Not in layer

            // Calculate Tangent in World Space
            const axisVecWorld = axisVec.clone().transformDirection(state.cubeWrapper.matrixWorld);
            const piecePosWorld = intersectedCubie.position.clone().applyMatrix4(state.cubeWrapper.matrixWorld);
            const wrapperPosWorld = new THREE.Vector3().setFromMatrixPosition(state.cubeWrapper.matrixWorld);

            // Tangent direction of rotation (Right hand rule)
            // v = w x r 
            const tangent = new THREE.Vector3().crossVectors(axisVecWorld, piecePosWorld.sub(wrapperPosWorld)).normalize();

            // Project to screen
            const p1 = piecePosWorld.clone().add(wrapperPosWorld); // Restore world pos
            const p2 = p1.clone().add(tangent);

            // Need accurate projection
            // We can just project vector difference
            // Actually, simply:
            const v1 = p1.clone().project(camera);
            const v2 = p2.clone().project(camera);

            const screenTangent = new THREE.Vector2(v2.x - v1.x, v2.y - v1.y).normalize();
            // Y is inverted in screen space usually? 
            // In interactions.js: screenMoveVec is (dx, dy).
            // THREE.js project: (-1 to 1). Y is up.
            // Screen coords: Y is down.
            // If dragging UP on screen, dy is negative.
            // If moving UP in 3D, projected Y increases. 
            // So we need to flip Y match?
            // StandardCube uses: -(endPoint.y - startPoint.y)
            screenTangent.y = -screenTangent.y; // Match screen coord system

            const score = Math.abs(screenTangent.dot(screenMoveVec));
            if (score > bestScore) {
                bestScore = score;
                // Direction logic:
                // If dragging with tangent (CCW), angle adds.
                // StandardCube: angle = direction * (Math.PI/2).
                // If I drag Right, and tangent is Right.
                // If tangent is CCW rotation.
                // We want performMove to rotate.
                // Usually -1 is CW, 1 is CCW.
                // If drag matches tangent (CCW), we want dir = 1.
                // BUT, my tangent calculation (axis x r) is tangential velocity for CCW rotation?
                // Yes. w x r with w positive is CCW?
                // Right hand rule: Thumb along axis. Fingers curl CCW.
                // So if drag matches tangent, rotation is CCW (positive angle).
                // StandardCube seems to flip things.
                // Let's try 1 if matches (CCW).

                bestMatch = { axis: String(axisIdx) };
            }
        });

        if (bestMatch && bestScore > 0.5) {
            // Re-evaluate tangent to decide if we want dx (x) or dy (y).
            const axisIdx = parseInt(bestMatch.axis);
            const axisVec = this.faceNormals[axisIdx];

            // World Axis for Pivot Rotation
            // Correction: snapPivot attaches pieces to 'pivot', which is added to 'cubeWrapper'.
            // if cubeWrapper is rotated, pivot inherits rotation.
            // So we want the Local Axis (axisVec) for the rotation to be correct relative to the puzzle.
            const axisVecWorld = axisVec.clone().transformDirection(state.cubeWrapper.matrixWorld).normalize();

            // Calculate Screen Tangent to determine X vs Y input dominance
            const piecePosWorld = intersectedCubie.position.clone().applyMatrix4(state.cubeWrapper.matrixWorld);
            const wrapperPosWorld = new THREE.Vector3().setFromMatrixPosition(state.cubeWrapper.matrixWorld);
            const tangent = new THREE.Vector3().crossVectors(axisVecWorld, piecePosWorld.sub(wrapperPosWorld)).normalize();

            const p1 = piecePosWorld.clone().add(wrapperPosWorld);
            const p2 = p1.clone().add(tangent);
            const v1 = p1.clone().project(camera);
            const v2 = p2.clone().project(camera);
            // Y is inverted in screen space
            const screenTangent = new THREE.Vector2(v2.x - v1.x, -(v2.y - v1.y)).normalize();

            const inputAxis = Math.abs(screenTangent.x) > Math.abs(screenTangent.y) ? 'x' : 'y';
            const angleScale = Math.sign(screenTangent[inputAxis]) || 1;

            return {
                dragAxis: bestMatch.axis,
                dragAngleScale: angleScale,
                dragSliceValue: null,
                dragRotationAxis: axisVec, // Use local axis for pivot rotation
                dragInputAxis: inputAxis
            };
        }
        return null;
    }

    snapCubies() {
        // TODO: Implement visual snapping to nearest 72 degrees?
        // Actually, if I performMove with animation, the engine handles interpolation.
        // When animation ends, I should update internal state (quaternions).
        // StandardCube snapCubies resets positions/rotations to grid to fix drift.
        // For Megaminx, calculating "grid" position is hard.
        // We can assume valid moves only.
    }

    handleKeyDown(event) {
        const key = event.key;
        const shift = event.shiftKey;

        // Map keys '1'-'9', '0', '-', '=' to indices 0-11
        // '0' is 10th key (index 9)
        // '-' is 11th key (index 10)
        // '=' is 12th key (index 11)

        // We can check code for position
        // Map keys to axes 0-11
        // R (0), U (4), F (8) ... 
        // Let's use standard megaminx notation keys if possible.
        // For now, retaining my debug numeric keys.
        // 0-9, -, = ?
        const map = {
            '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5,
            '7': 6, '8': 7, '9': 8, '0': 9, '-': 10, '=': 11
        };
        const index = map[event.key];
        if (index !== undefined) {
            console.log(`[Megaminx] Key pressed for axis ${index}`);
            const direction = shift ? -1 : 1;
            // Use queueMove to trigger animation loop
            queueMove(String(index), direction);
            return true;
        }
        return false;
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
