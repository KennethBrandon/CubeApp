import * as THREE from 'three';
import { StandardCube } from './StandardCube.js';
import { CUBE_SIZE, SPACING, STICKER_BORDER_RADIUS, stickerVertexShader, stickerFragmentShader } from '../shared/constants.js';
import { state } from '../shared/state.js';

export class Molecube extends StandardCube {
    constructor(config) {
        super(config);
        // Molecube is always 3x3x3
        this.config.dimensions = { x: 3, y: 3, z: 3 };
    }

    createGeometry() {
        // Clear existing geometry
        this.cubieList.forEach(c => {
            if (c.parent) c.parent.remove(c);
        });
        this.cubieList.length = 0;

        state.activeDimensions = { ...this.config.dimensions };

        // Sphere Geometry for Molecube
        // Sphere Geometry for Molecube
        // Radius 0.500 (User Preference)
        const sphereGeo = new THREE.SphereGeometry(0.500, 32, 32);

        // Colors
        // 9 Colors:
        // 1. White (Center)
        // 2. Yellow (Center)
        // 3. Red (Center)
        // 4. Orange (Center)
        // 5. Blue (Center)
        // 6. Green (Center)
        // 7. Purple (New)
        // 8. Pink (New)
        // 9. Black (New)

        // Standard Rubik's Colors
        const COLORS = {
            U: 0xFFFFFF, // White
            D: 0xFFD500, // Yellow
            R: 0xB90000, // Red
            L: 0xFF5800, // Orange
            F: 0x009E60, // Green
            B: 0x0051BA, // Blue
            P: 0xFF69B4, // Pink
            K: 0x111111, // Black
            M: 0x800080  // Purple (Magenta)
        };

        // We need to assign specific colors to specific pieces to make it solvable (Sudoku style).
        // This is complex. For now, let's try a distribution that ensures we have the right counts.
        // Centers: 6 (W, Y, R, O, G, B) - Fixed
        // Corners: 8
        // Edges: 12

        // User Specs:
        // 1-6 (Standard Centers): Each has 1 corner + 1 edge same color.
        // 7 (Purple?): 2 corners.
        // 8 (Pink?): 3 edges.
        // 9 (Black?): 3 edges.

        // Wait, user said:
        // "The 7th color has 2 corners with that color"
        // "The 8th and 9th color have three edges with that color"
        // "Let's use the normal rubik's colors for the centers, we can add two pink corners, 3 black edges, and 3 white edges."

        // Re-reading user request carefully:
        // "Let's use the normal rubik's colors for the centers" -> W, Y, R, O, G, B (6 colors)
        // "we can add two pink corners" -> Pink is 7th color? Or is it one of the "normal" ones?
        // "3 black edges" -> Black is 8th?
        // "3 white edges" -> White is already a center color.

        // Let's map the counts:
        // Centers (6 total): W, Y, R, O, G, B (1 each)
        // Corners (8 total):
        //   - User says: "Each center is a different color, and each has 1 corner... with the same color." -> 6 corners (W, Y, R, O, G, B)
        //   - "The 7th color has 2 corners" -> Let's say Pink.
        //   - Total Corners = 6 + 2 = 8. Perfect.
        // Edges (12 total):
        //   - "Each center... has 1 edge with the same color." -> 6 edges (W, Y, R, O, G, B)
        //   - "The 8th and 9th color have three edges with that color."
        //   - User said: "3 black edges, and 3 white edges."
        //   - Wait, "3 white edges" means White has 1 (from center rule) + 3 (from this rule) = 4 edges?
        //   - Or does "3 white edges" REPLACE the "1 edge" rule for white?
        //   - "The 8th and 9th color have three edges".
        //   - If White is one of the "normal" centers, it has 1 edge.
        //   - If we add "3 white edges", that's 4 total.
        //   - If we add "3 black edges", that's 3 total (Black is not a center).
        //   - Total Edges so far: 6 (standard) + 3 (Black) + 3 (White extra?) = 12.
        //   - This implies White has 4 edges total.
        //   - But the user said "The 8th and 9th color have three edges".
        //   - Maybe the 9th color is NOT White, but something else?
        //   - "There are nine colors."
        //   - Centers: 6 colors.
        //   - Pink (Corners): 7th color.
        //   - Black (Edges): 8th color.
        //   - White (Edges): Is White the 9th color? But White is already a center.
        //   - Maybe the 9th color is Purple, and user misspoke about "3 white edges"?
        //   - OR, maybe White is treated as a separate color class?
        //   - "There are nine colors." -> This implies 9 DISTINCT colors.
        //   - If White is reused, we only have 8 colors (6 standard + Pink + Black).
        //   - So we need a 9th color.
        //   - Let's assume the "3 white edges" was a typo for "3 [Other Color] edges".
        //   - I will use **Purple** for the 3 edges.
        //   - I'll add a comment about this decision.

        const PIECE_COLORS = [
            COLORS.U, // 0: White
            COLORS.D, // 1: Yellow
            COLORS.R, // 2: Red
            COLORS.L, // 3: Orange
            COLORS.F, // 4: Green
            COLORS.B, // 5: Blue
            COLORS.P, // 6: Pink
            COLORS.K, // 7: Black
            COLORS.M  // 8: Purple
        ];

        // Distribution:
        // 0-5 (W,Y,R,O,G,B): 1 Center, 1 Corner, 1 Edge.
        // 6 (Pink): 2 Corners.
        // 7 (Black): 3 Edges.
        // 8 (Purple): 3 Edges.

        // We need to assign these to the 26 cubies.
        // Cubies are generated in a loop: x, y, z from -1 to 1.
        // We need to map (x,y,z) to a specific piece type (Center, Corner, Edge) and assign a color.

        // Let's pre-calculate the assignment to ensure a solvable state.
        // A "Solvable" state for Molecube means every face has 9 unique colors.
        // This is a Latin Square / Sudoku problem on a cube surface.
        // Generating a valid solved state procedurally is hard.
        // I will use a fixed, known-good layout if I can find one, or just a random valid distribution.
        // Since I don't have a solver, I'll try to place them logically.

        // Let's just assign them based on the counts and let the user scramble.
        // The "Solved" state might not be perfect Sudoku if I just place them randomly.
        // But for a "Mod", maybe just having the pieces is enough?
        // The user asked to "add a new puzzle...".
        // I should try to make it start in a solved state.

        // Let's try a simple pattern:
        // Faces: U, D, R, L, F, B.
        // Centers are fixed.
        // U: White, D: Yellow, R: Red, L: Orange, F: Green, B: Blue.

        // We need to place 8 Corners and 12 Edges such that:
        // U Face (9 pieces): Center(W) + 4 Edges + 4 Corners -> Unique colors.
        // ... same for all faces.

        // This is actually quite constrained.
        // I'll define a mapping of position -> color index.

        // Pieces:
        // Centers (6):
        // (0,1,0) U -> White (0)
        // (0,-1,0) D -> Yellow (1)
        // (1,0,0) R -> Red (2)
        // (-1,0,0) L -> Orange (3)
        // (0,0,1) F -> Green (4)
        // (0,0,-1) B -> Blue (5)

        // Corners (8):
        // Positions: (±1, ±1, ±1)
        // We have: W, Y, R, O, G, B, Pink, Pink. (Indices 0-6, 6)

        // Edges (12):
        // Positions: (±1, ±1, 0), (±1, 0, ±1), (0, ±1, ±1)
        // We have: W, Y, R, O, G, B, Black, Black, Black, Purple, Purple, Purple. (Indices 0-5, 7,7,7, 8,8,8)

        // Let's try to construct it.
        // U Face needs: W(C), 4 Edges, 4 Corners.
        // Colors needed on U: 0,1,2,3,4,5,6,7,8.
        // Center is 0 (W).
        // So Edges+Corners must provide 1,2,3,4,5,6,7,8.

        // This is a logic puzzle itself!
        // Given the time constraints, I will implement the rendering and piece counts correctly.
        // I will attempt a "best guess" layout.

        const pieceMap = {}; // "x,y,z" -> ColorHex

        // Helper to set color
        const setC = (x, y, z, color) => {
            pieceMap[`${x},${y},${z}`] = color;
        };

        // Centers
        setC(0, 1, 0, COLORS.U);
        setC(0, -1, 0, COLORS.D);
        setC(1, 0, 0, COLORS.R);
        setC(-1, 0, 0, COLORS.L);
        setC(0, 0, 1, COLORS.F);
        setC(0, 0, -1, COLORS.B);

        // Corners (8) - Need: W, Y, R, O, G, B, P, P
        // U Corners (4):
        // D Corners (4):

        // Edges (12) - Need: W, Y, R, O, G, B, K, K, K, M, M, M
        // U Edges (4):
        // D Edges (4):
        // E Slice Edges (4):

        // Let's just assign them arbitrarily for now to satisfy the counts.
        // A true solved state requires a solver.
        // I'll use a randomized shuffle of the required pieces for corners and edges.

        const corners = [COLORS.U, COLORS.D, COLORS.R, COLORS.L, COLORS.F, COLORS.B, COLORS.P, COLORS.P];
        const edges = [COLORS.U, COLORS.D, COLORS.R, COLORS.L, COLORS.F, COLORS.B, COLORS.K, COLORS.K, COLORS.K, COLORS.M, COLORS.M, COLORS.M];

        // Shuffle (deterministic for consistency?)
        // Let's just pop them in order.
        let cIdx = 0;
        let eIdx = 0;

        const dimX = 3;
        const dimY = 3;
        const dimZ = 3;
        const offsetX = 1;
        const offsetY = 1;
        const offsetZ = 1;

        this.stickers = [];
        this.layoutIdx = 0;

        for (let x = -offsetX; x <= offsetX; x++) {
            for (let y = -offsetY; y <= offsetY; y++) {
                for (let z = -offsetZ; z <= offsetZ; z++) {
                    // Skip internal core
                    if (x === 0 && y === 0 && z === 0) continue;

                    const group = new THREE.Group();
                    // Use local spacing of 0.020 for Molecube default
                    const molecubeSpacing = this.getSpacing();
                    group.position.set(
                        x * (CUBE_SIZE + molecubeSpacing),
                        y * (CUBE_SIZE + molecubeSpacing),
                        z * (CUBE_SIZE + molecubeSpacing)
                    );

                    // Fixed Layout from Solver
                    // Order: X=-1 (9), X=0 (8), X=1 (9)
                    // Looping: x then y then z
                    // But my loop is x, y, z.
                    // Let's verify loop order in code:
                    // for x... for y... for z...
                    // Yes.

                    const LAYOUT = [
                        // X = -1 (Left Slice)
                        COLORS.P, // 1. LDB Pink
                        COLORS.F, // 2. LD Green
                        COLORS.U, // 3. LDF White
                        COLORS.M, // 4. LB Purple
                        COLORS.L, // 5. L Orange
                        COLORS.K, // 6. LF Black
                        COLORS.D, // 7. LUB Yellow
                        COLORS.B, // 8. LU Blue
                        COLORS.R, // 9. LUF Red

                        // X = 0 (Middle Slice)
                        COLORS.R, // 10. DB Red
                        COLORS.D, // 11. D Yellow
                        COLORS.M, // 12. DF Purple
                        COLORS.B, // 13. B Blue
                        COLORS.F, // 14. F Green
                        COLORS.K, // 15. UB Black
                        COLORS.U, // 16. U White
                        COLORS.L, // 17. UF Orange

                        // X = 1 (Right Slice)
                        COLORS.L, // 18. RDB Orange
                        COLORS.K, // 19. RD Black
                        COLORS.B, // 20. RDF Blue
                        COLORS.U, // 21. RB White
                        COLORS.R, // 22. R Red
                        COLORS.D, // 23. RF Yellow
                        COLORS.F, // 24. RUB Green
                        COLORS.M, // 25. RU Purple
                        COLORS.P  // 26. RUF Pink
                    ];

                    // Determine type and color
                    let color = 0x888888; // Default grey

                    // Use the fixed layout
                    // We need a global index for the 26 pieces
                    // We can't easily use a simple counter because we skip (0,0,0)
                    // But since the loop is deterministic, we can just push to array?
                    // No, we are inside the loop.
                    // Let's use a static counter or calculate index.
                    // Or just define the array outside the loop.

                    // Actually, I'll just use the `layoutIdx` variable.
                    if (this.layoutIdx === undefined) this.layoutIdx = 0;
                    color = LAYOUT[this.layoutIdx++];

                    // Sphere Mesh
                    // Use Sparkle Map
                    if (!this.sparkleMap) {
                        this.sparkleMap = createSparkleMap();
                    }

                    const mat = new THREE.MeshStandardMaterial({
                        color: color,
                        roughness: 0.4,
                        metalness: 0.1,
                        normalMap: this.sparkleMap,
                        normalScale: new THREE.Vector2(0.2, 0.2) // Subtle sparkle
                    });
                    const sphere = new THREE.Mesh(sphereGeo, mat);
                    group.add(sphere);

                    // Connecting Cylinder
                    // Vector to center in local space
                    const S = CUBE_SIZE + 0.020; // Use local spacing
                    const localCenter = new THREE.Vector3(-x * S, -y * S, -z * S);
                    const dist = localCenter.length();

                    if (dist > 0.1) { // Skip if at center (shouldn't happen due to loop check)
                        const cylGeo = new THREE.CylinderGeometry(0.300, 0.300, dist, 16);
                        const cylMat = new THREE.MeshStandardMaterial({
                            color: 0x111111,
                            roughness: 0.8,
                            metalness: 0.1
                        });
                        const cylinder = new THREE.Mesh(cylGeo, cylMat);

                        // Align cylinder (default Y axis) to localCenter
                        const axis = new THREE.Vector3(0, 1, 0);
                        const target = localCenter.clone().normalize();
                        const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, target);
                        cylinder.setRotationFromQuaternion(quaternion);

                        // Position at midpoint
                        const mid = localCenter.clone().multiplyScalar(0.5);
                        cylinder.position.copy(mid);

                        group.add(cylinder);
                    }

                    group.userData = { isCubie: true, gridPos: { x, y, z }, isMolecubePiece: true, color: color };
                    this.parent.add(group);
                    this.cubieList.push(group);
                }
            }
        }

        // Add Central Black Sphere (Core)
        const coreGeo = new THREE.SphereGeometry(0.53, 32, 32); // Slightly larger than pieces (0.50 + 0.03)
        // If pieces are radius 0.5 and spacing is 0.04 (CUBE_SIZE 1 + SPACING 0.04), center distance is 1.04.
        // Gap between centers is 1.04.
        // Piece radius 0.5.
        // Gap between surfaces = 1.04 - 0.5 - 0.5 = 0.04.
        // Central sphere at (0,0,0) needs to be visible through gaps?
        // Or is it just the "core" mechanism?
        // User said: "add a black ball in the middle".
        // If I put it at (0,0,0), it will be inside the center pieces?
        // Wait, the center pieces are at (±1.04, 0, 0) etc.
        // The (0,0,0) position is EMPTY in my loop: `if (x === 0 && y === 0 && z === 0) continue;`
        // So yes, I can put a ball there.
        // Radius?
        // Distance to center pieces is 1.04.
        // Center piece radius is 0.5.
        // So center piece surface starts at 1.04 - 0.5 = 0.54.
        // So the central ball can be up to radius 0.54 without clipping (much).
        // Let's make it 0.52.

        const coreMat = new THREE.MeshStandardMaterial({
            color: 0x000000,
            roughness: 0.5,
            metalness: 0.1
        });
        const coreSphere = new THREE.Mesh(coreGeo, coreMat);
        coreSphere.userData = { isCore: true };
        this.parent.add(coreSphere);
        // We don't add it to cubieList because it doesn't move/rotate with faces (it's the core).
        // But wait, if we rotate the WHOLE puzzle, it should rotate?
        // `this.parent` is `state.cubeWrapper`.
        // Yes, it will rotate with the whole cube.
        // It won't rotate with faces.
        // We should track it to remove it later?
        // `createGeometry` clears `this.cubieList`.
        // But `coreSphere` is not in `cubieList`.
        // I should add it to a separate list or just `cubieList` but mark it?
        // If I add it to `cubieList`, `performMove` might try to rotate it if I'm not careful.
        // `performMove` selects based on position.
        // (0,0,0) is usually not selected by face slices (which are at ±1).
        // But M/E/S slices might select it.
        // If I rotate M slice, the core SHOULD rotate?
        // In a real mechanism, centers rotate around the core. The core (spider) stays fixed relative to the centers?
        // Actually, in a real cube, the core rotates with the M slice? No.
        // The centers rotate around the core.
        // So the core should stay static relative to the wrapper.
        // So adding it to `this.parent` is correct.
        // BUT I need to clean it up when `createGeometry` runs again.
        // `this.cubieList` clearing logic:
        // `this.cubieList.forEach(c => { if (c.parent) c.parent.remove(c); });`
        // So I should add it to `cubieList` but maybe flag it to NOT be selected by moves?
        // Or just keep a reference `this.coreSphere` and remove it manually.

        if (this.coreSphere) {
            this.parent.remove(this.coreSphere);
        }
        this.coreSphere = coreSphere;
    }

    isSolved() {
        // Check if every face has 9 unique colors.
        // We need to raycast or check positions.
        // Since we track `cubieList`, we can check current positions.

        const faces = [
            { axis: 'x', val: 1 },
            { axis: 'x', val: -1 },
            { axis: 'y', val: 1 },
            { axis: 'y', val: -1 },
            { axis: 'z', val: 1 },
            { axis: 'z', val: -1 }
        ];

        const S = CUBE_SIZE + SPACING;

        for (const face of faces) {
            // Find all cubies on this face
            const faceCubies = this.cubieList.filter(c => {
                // Ignore the core if it ended up in the list (it shouldn't have)
                if (c === this.coreSphere) return false;

                // Get world position (or local to wrapper)
                // We assume `c.position` is updated after moves (it is).
                // But wait, `c.position` is local to `cubeWrapper`.
                // Rotations are applied to `cubeWrapper`? No, rotations are applied to GROUPS (cubies) or SLICES.
                // In `StandardCube`, we rotate the group.
                // So `c.position` changes?
                // No, `StandardCube` rotates the `group` object.
                // Wait, `performMove` rotates the `group` around the world axis.
                // So `c.position` DOES change.

                // We need to check if the cubie is roughly at the face plane.
                const pos = c.position[face.axis];
                return Math.abs(pos - face.val * S) < 0.1;
            });

            if (faceCubies.length !== 9) return false; // Should not happen

            // Check uniqueness of colors
            const colors = new Set();
            faceCubies.forEach(c => {
                colors.add(c.userData.color);
            });

            if (colors.size !== 9) return false;
        }

        return true;
    }

    dispose() {
        if (this.coreSphere) {
            if (this.coreSphere.parent) {
                this.coreSphere.parent.remove(this.coreSphere);
            }
            if (this.coreSphere.geometry) this.coreSphere.geometry.dispose();
            // Material disposal is optional but good practice if unique
            // if (this.coreSphere.material) this.coreSphere.material.dispose();
            this.coreSphere = null;
        }
        super.dispose();
    }

    updateMolecubeParams(params) {
        const { ballSize, cylinderSize, spacing } = params;

        // Update Sphere Geometry (Balls)
        // We can share one geometry for all balls to be efficient, or update each if they were unique.
        // They are all spheres of the same radius.
        const newSphereGeo = new THREE.SphereGeometry(ballSize, 32, 32);

        // Update Cylinder Geometry (Connections)
        // Cylinders have different lengths based on distance, but same radius.
        // We need to regenerate them or update their scale/geometry.
        // Since length depends on position, and position depends on spacing, we might need to rebuild them.
        // Or we can update the radius of the geometry if we access it.
        // But Three.js geometries are immutable-ish.
        // Actually, we can just create new geometries.

        // Update Spacing (Positions)
        const S = CUBE_SIZE + spacing;

        this.cubieList.forEach(group => {
            if (group.userData.gridPos) {
                const { x, y, z } = group.userData.gridPos;

                // Update Group Position
                group.position.set(x * S, y * S, z * S);

                // Update Children
                group.children.forEach(child => {
                    // Identify parts
                    // Sphere is the one with sphere geometry (or we can check userData if we set it, or material)
                    // Cylinder is the one with cylinder geometry.

                    if (child.geometry && child.geometry.type === 'SphereGeometry') {
                        child.geometry = newSphereGeo;
                    } else if (child.geometry && child.geometry.type === 'CylinderGeometry') {
                        // Update Cylinder
                        // We need to recalculate length and position because spacing changed.
                        // Local center relative to group is (-x*S, -y*S, -z*S)
                        const localCenter = new THREE.Vector3(-x * S, -y * S, -z * S);
                        const dist = localCenter.length();

                        // Re-create geometry with new radius and length
                        // Note: CylinderGeometry(radiusTop, radiusBottom, height, ...)
                        const newCylGeo = new THREE.CylinderGeometry(cylinderSize, cylinderSize, dist, 16);
                        child.geometry = newCylGeo;

                        // Re-align and re-position
                        // Align cylinder (default Y axis) to localCenter
                        const axis = new THREE.Vector3(0, 1, 0);
                        const target = localCenter.clone().normalize();
                        const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, target);
                        child.setRotationFromQuaternion(quaternion);

                        // Position at midpoint
                        const mid = localCenter.clone().multiplyScalar(0.5);
                        child.position.copy(mid);
                    }
                });
            }
        });

        // Update Core Sphere
        // Core sphere is at (0,0,0) and doesn't move with spacing.
        // But its size might need to change?
        // User didn't explicitly ask for core size slider, but "size of the balls" might imply it.
        // I'll link it to ballSize for now, maybe slightly larger/smaller?
        // In createGeometry: ball radius 0.42, core radius 0.45.
        // Let's keep the ratio or just set it to ballSize + 0.03?
        // Or just use ballSize?
        // Let's use ballSize + 0.03 to keep it slightly larger as per original design (0.45 vs 0.42).
        if (this.coreSphere) {
            this.coreSphere.geometry = new THREE.SphereGeometry(ballSize + 0.03, 32, 32);
        }
    }

    getSpacing() {
        return 0.020;
    }
}

function createSparkleMap(maxDim = 3) {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Calculate noise scale based on cube size
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

    // Draw scaled noise onto main canvas with smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(noiseCanvas, 0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);

    // Enable mipmaps
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;

    if (state.renderer) {
        tex.anisotropy = state.renderer.capabilities.getMaxAnisotropy();
    }

    return tex;
}
