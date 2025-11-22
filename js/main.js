import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { state } from './state.js';
import { CUBE_SIZE, SPACING, ANIMATION_SPEED, SCRAMBLE_MOVES, SCRAMBLE_SPEED, SNAP_SPEED, COLORS, CORE_COLOR, STICKER_BORDER_RADIUS, stickerVertexShader, stickerFragmentShader } from './constants.js';
import { initAuth, submitScore, fetchLeaderboard } from './firebase.js';
import { togglePanel, updateHistoryUI, addToHistory, showWinModal, renderLeaderboardUI, openDetailModal, escapeHtml } from './ui.js';
import { createEnvironment, createMirrors, toggleMirrors } from './environment.js';

// Expose functions to window for UI interactions
window.togglePanel = togglePanel;
window.openDetailModal = openDetailModal;

// FPS tracking variables
let lastTime = performance.now();
let frameCount = 0;
let fps = 60;

// Update zoom display UI elements
function updateZoomDisplay() {
    const distance = state.camera.position.length();
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomValueInput = document.getElementById('zoom-value-input');
    if (zoomSlider) zoomSlider.value = distance.toFixed(1);
    if (zoomValueInput) zoomValueInput.value = distance.toFixed(1);
}

init();
animate();

function init() {
    const container = document.getElementById('canvas-container');
    if (!container) {
        return;
    }
    state.scene = new THREE.Scene();
    state.scene.background = new THREE.Color(0x050505);

    // Safety check for cubeDimensions (in case of caching issues)
    if (!state.cubeDimensions) {
        state.cubeDimensions = { x: state.cubeSize, y: state.cubeSize, z: state.cubeSize };
    }

    state.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    state.camera.position.set(6, 6, 12);

    state.renderer = new THREE.WebGLRenderer({ antialias: true });
    state.renderer.setSize(window.innerWidth, window.innerHeight);
    state.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(state.renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    state.scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(10, 20, 10);
    state.scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    fillLight.position.set(-10, 0, 10);
    state.scene.add(fillLight);
    const backLight = new THREE.DirectionalLight(0xffffff, 1.0);
    backLight.position.set(-10, 10, -10);
    state.scene.add(backLight);

    state.controls = new OrbitControls(state.camera, state.renderer.domElement);
    state.controls.enableDamping = true;
    state.controls.enablePan = false;
    state.controls.enabled = true;
    state.controls.enableRotate = false;
    state.controls.enableZoom = true;
    // minDistance and maxDistance will be set dynamically in adjustCameraForCubeSize

    state.scene.add(state.pivot);
    createCube();
    adjustCameraForCubeSize();
    createEnvironment(); // Add Environment
    createMirrors();

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', onKeyDown);

    const canvas = state.renderer.domElement;
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onMouseUp);

    document.getElementById('btn-scramble').addEventListener('click', startScramble);
    document.getElementById('btn-reset').addEventListener('click', handleResetClick);
    document.getElementById('btn-close-modal').addEventListener('click', () => {
        const modal = document.getElementById('solved-modal');
        modal.classList.add('opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 500);
        // Only close modal, do not hard reset unless play again is clicked
    });

    document.getElementById('btn-play-again').addEventListener('click', () => {
        const modal = document.getElementById('solved-modal');
        modal.classList.add('opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            hardReset(true); // Keep camera when playing again
        }, 500);
    });

    // Leaderboard Listeners
    document.getElementById('btn-leaderboard').addEventListener('click', () => {
        // Set selected puzzle to current cube if not already set
        if (!state.selectedLeaderboardPuzzle) {
            const currentPuzzle = state.cubeDimensions.x === state.cubeDimensions.y && state.cubeDimensions.y === state.cubeDimensions.z
                ? state.cubeSize
                : `${state.cubeDimensions.x}x${state.cubeDimensions.y}x${state.cubeDimensions.z}`;
            state.selectedLeaderboardPuzzle = currentPuzzle;
        }

        // Fetch leaderboard for selected puzzle
        fetchLeaderboard(state.selectedLeaderboardPuzzle);

        // Update active tab
        updateActivePuzzleTab(state.selectedLeaderboardPuzzle);

        document.getElementById('leaderboard-modal').classList.remove('hidden');
    });

    document.getElementById('btn-close-leaderboard').addEventListener('click', () => {
        document.getElementById('leaderboard-modal').classList.add('hidden');
    });

    // Puzzle Tab Switching
    document.querySelectorAll('.puzzle-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const puzzleSize = e.target.dataset.puzzle;
            const parsedPuzzle = puzzleSize.includes('x') ? puzzleSize : parseInt(puzzleSize);

            state.selectedLeaderboardPuzzle = parsedPuzzle;
            fetchLeaderboard(parsedPuzzle);
            updateActivePuzzleTab(parsedPuzzle);
        });
    });

    // Helper function to update active tab
    function updateActivePuzzleTab(puzzleSize) {
        const puzzleStr = String(puzzleSize);
        document.querySelectorAll('.puzzle-tab').forEach(tab => {
            if (tab.dataset.puzzle === puzzleStr) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    }

    document.getElementById('btn-close-detail').addEventListener('click', () => {
        document.getElementById('detail-modal').classList.add('hidden');
    });

    document.getElementById('puzzle-select').addEventListener('change', (e) => {
        const val = e.target.value;
        let newSize = 3;
        let newDims = { x: 3, y: 3, z: 3 };

        if (val === "2x2x3") {
            newSize = 3; // Max dimension for scaling
            newDims = { x: 2, y: 3, z: 2 }; // Standard 2x2x3 orientation usually 2x2 base, 3 height? Or 2x2x3 block. Let's do 2x3x2?
            // User asked for 2x2x3. Usually means 2x2x3 cuboid.
            // Let's make it 2x2x3. x=2, y=2, z=3? Or x=2, y=3, z=2?
            // Let's do x=2, y=2, z=3 (tall).
            newDims = { x: 2, y: 2, z: 3 };
        } else {
            newSize = parseInt(val);
            newDims = { x: newSize, y: newSize, z: newSize };
        }

        if (newDims.x === state.cubeDimensions.x && newDims.y === state.cubeDimensions.y && newDims.z === state.cubeDimensions.z) return;

        // Calculate current zoom ratio
        const currentDist = state.camera.position.length();
        const minD = state.controls.minDistance;
        const maxD = state.controls.maxDistance;
        let zoomRatio = null;
        if (maxD > minD) {
            zoomRatio = (currentDist - minD) / (maxD - minD);
        }

        playCubeAnimation(false, () => {
            // Change cube size and recreate
            state.cubeSize = newSize;
            state.cubeDimensions = newDims;
            hardReset(true); // Keep camera object, but we will adjust position manually

            // Adjust camera with relative zoom
            adjustCameraForCubeSize(zoomRatio);

            // Animate in the new cube (reverse)
            playCubeAnimation(true);
        });
    });

    document.getElementById('btn-toggle-mirrors').addEventListener('click', () => {
        toggleMirrors(!state.showMirrors);
    });

    document.getElementById('btn-close-debug').addEventListener('click', () => {
        document.getElementById('debug-modal').classList.add('hidden');
    });

    document.getElementById('toggle-fps').addEventListener('change', (e) => {
        const fpsCounter = document.getElementById('fps-counter');
        if (e.target.checked) {
            fpsCounter.classList.remove('hidden');
        } else {
            fpsCounter.classList.add('hidden');
        }
    });

    document.getElementById('toggle-zoom-bar').addEventListener('change', (e) => {
        const zoomBar = document.getElementById('zoom-bar');
        if (e.target.checked) {
            zoomBar.classList.remove('hidden');
            updateZoomDisplay();
        } else {
            zoomBar.classList.add('hidden');
        }
    });

    document.getElementById('btn-test-victory').addEventListener('click', () => {
        document.getElementById('debug-modal').classList.add('hidden');
        setTimeout(() => {
            playSolveAnimation(() => {
                showWinModal();
            });
        }, 1000);
    });

    document.getElementById('zoom-slider').addEventListener('input', (e) => {
        const distance = parseFloat(e.target.value);
        const direction = state.camera.position.clone().normalize();
        state.camera.position.copy(direction.multiplyScalar(distance));
        updateZoomDisplay();
    });

    document.getElementById('zoom-value-input').addEventListener('change', (e) => {
        let value = parseFloat(e.target.value);
        const currentDistance = state.camera.position.length();
        if (isNaN(value)) value = currentDistance;
        // Clamp between dynamic min and max
        value = Math.max(state.controls.minDistance, Math.min(state.controls.maxDistance, value));
        const direction = state.camera.position.clone().normalize();
        state.camera.position.copy(direction.multiplyScalar(value));
        document.getElementById('zoom-slider').value = value;
        updateZoomDisplay();
    });

    document.getElementById('btn-submit-score').addEventListener('click', () => {
        const nameInput = document.getElementById('player-name');
        const name = nameInput.value.trim();
        if (!name) {
            alert("Please enter a name!");
            return;
        }
        const timeStr = document.getElementById('final-time').textContent;
        const scramble = state.scrambleSequence.join(" ");
        const solution = state.moveHistory.join(" ");

        submitScore(name, state.finalTimeMs, timeStr, scramble, solution);
    });

    // Init Auth
    initAuth();
}

function createCube() {
    state.allCubies.forEach(c => {
        if (c.parent) c.parent.remove(c);
    });
    state.allCubies = [];

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

function adjustCameraForCubeSize(relativeZoom = null) {
    const S = CUBE_SIZE + SPACING;
    const cubePhysicalSize = state.cubeSize * S;

    // Get viewport dimensions
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspectRatio = width / height;
    const smallestDimension = Math.min(width, height);

    // Camera FOV in degrees (must match the camera setup)
    const fov = 45;
    const fovRadians = (fov * Math.PI) / 180;

    // We want the cube to take up ~2/3 of the smaller viewport dimension
    const targetCoverage = 2 / 3;

    // The cube is tilted in isometric view, so we see it at an angle
    // Approximate the apparent size as sqrt(2) times the physical size
    const apparentCubeSize = cubePhysicalSize * Math.sqrt(2);

    let requiredDistance;
    if (width <= height) {
        // Width is smaller, constrain by width
        // visibleWidth at distance d: w = 2 * d * tan(fov/2) * aspectRatio
        // We want: apparentCubeSize = w * targetCoverage
        requiredDistance = apparentCubeSize / (2 * Math.tan(fovRadians / 2) * aspectRatio * targetCoverage);
    } else {
        // Height is smaller, constrain by height
        // visibleHeight at distance d: h = 2 * d * tan(fov/2)
        // We want: apparentCubeSize = h * targetCoverage
        requiredDistance = apparentCubeSize / (2 * Math.tan(fovRadians / 2) * targetCoverage);
    }

    // Calculate dynamic zoom limits
    // Max zoom: cube takes up 95% of smallest dimension
    const maxZoomCoverage = 0.95;
    let maxZoomDistance;
    if (width <= height) {
        maxZoomDistance = apparentCubeSize / (2 * Math.tan(fovRadians / 2) * aspectRatio * maxZoomCoverage);
    } else {
        maxZoomDistance = apparentCubeSize / (2 * Math.tan(fovRadians / 2) * maxZoomCoverage);
    }

    // Min zoom: cube takes up 20% of smallest dimension
    const minZoomCoverage = 0.20;
    let minZoomDistance;
    if (width <= height) {
        minZoomDistance = apparentCubeSize / (2 * Math.tan(fovRadians / 2) * aspectRatio * minZoomCoverage);
    } else {
        minZoomDistance = apparentCubeSize / (2 * Math.tan(fovRadians / 2) * minZoomCoverage);
    }

    // Update OrbitControls limits
    state.controls.minDistance = maxZoomDistance; // minDistance is max zoom (closer)
    state.controls.maxDistance = minZoomDistance; // maxDistance is min zoom (farther)

    // Update zoom slider limits
    const zoomSlider = document.getElementById('zoom-slider');
    if (zoomSlider) {
        zoomSlider.min = maxZoomDistance.toFixed(1);
        zoomSlider.max = minZoomDistance.toFixed(1);
    }

    // Maintain the camera angle
    const direction = new THREE.Vector3(6, 6, 12).normalize();

    let finalDistance = requiredDistance;
    if (relativeZoom !== null && relativeZoom !== undefined) {
        // Interpolate between min and max based on ratio
        // ratio 0 = minDistance (max zoom, closest)
        // ratio 1 = maxDistance (min zoom, farthest)
        // Wait, slider logic: min val = maxZoomDist (closest), max val = minZoomDist (farthest).
        // So ratio 0 should be closest?
        // My ratio calc: (current - minD) / (maxD - minD).
        // minD is maxZoomDist (closest).
        // So if current == minD, ratio is 0.
        // So ratio 0 = closest.
        finalDistance = maxZoomDistance + relativeZoom * (minZoomDistance - maxZoomDistance);
    }

    state.camera.position.copy(direction.multiplyScalar(finalDistance));
    state.controls.update();

    // Update the zoom display if it's visible
    const zoomBar = document.getElementById('zoom-bar');
    if (zoomBar && !zoomBar.classList.contains('hidden')) {
        updateZoomDisplay();
    }
}

// --- Reset Logic ---

function handleResetClick() {
    if (state.isAutoSolving || state.isScrambling || (state.moveHistory.length === 0 && state.scrambleSequence.length === 0)) {
        hardReset(true); // Keep camera on manual reset
    } else {
        startReverseSolve();
    }
}

function startReverseSolve() {
    stopTimer();
    state.isAutoSolving = true;

    const movesToUndo = [...state.moveHistory].reverse().concat([...state.scrambleSequence].reverse());
    state.moveQueue = [];

    const N = movesToUndo.length;
    if (N === 0) {
        state.isAutoSolving = false;
        hardReset(true);
        return;
    }

    // Calculate timing
    const SCRAMBLE_SPEED = 50; // Ensure we match this
    const MAX_TOTAL_TIME = 5000; // 5 seconds max
    const idealTotalTime = N * SCRAMBLE_SPEED;

    let useEasing = false;
    let totalTime = idealTotalTime;

    if (idealTotalTime > MAX_TOTAL_TIME) {
        totalTime = MAX_TOTAL_TIME;
        useEasing = true;
    }

    // Calculate weights for easing if needed
    // Parabolic profile: slower at ends, faster in middle
    // Weight w_i = 1 + K * (2*x - 1)^2 where x is normalized index 0..1
    // Higher weight = longer duration
    const K = 3; // Ends are 1+3=4 times slower than middle
    let weights = [];
    let sumWeights = 0;

    if (useEasing) {
        for (let i = 0; i < N; i++) {
            const x = i / (N - 1 || 1);
            const w = 1 + K * Math.pow(2 * x - 1, 2);
            weights.push(w);
            sumWeights += w;
        }
    }

    movesToUndo.forEach((notation, index) => {
        // Parse notation: [prefix][char][suffix]
        let match = notation.match(/^(\d*)([a-zA-Z])(.*)$/);
        if (!match) return;

        let prefix = match[1];
        let char = match[2];
        let suffix = match[3];

        let dir = 1;
        if (suffix === "'") dir = 1;
        else if (suffix === "2") dir = 2;
        else dir = -1;

        let axis = '';
        let sliceVal = null;
        const S = CUBE_SIZE + SPACING;
        const maxIndex = (state.cubeSize - 1) / 2;

        // Calculate duration for this move
        let duration = SCRAMBLE_SPEED;
        if (useEasing) {
            duration = totalTime * (weights[index] / sumWeights);
        }

        if (['M', 'E', 'S'].includes(char)) {
            if (char === 'M') { axis = 'x'; sliceVal = 0; }
            else if (char === 'E') { axis = 'y'; sliceVal = 0; }
            else if (char === 'S') { axis = 'z'; sliceVal = 0; }
            queueMove(char, dir, duration);
            return;
        }

        // Map char to axis
        if (['R', 'L'].includes(char.toUpperCase())) axis = 'x';
        else if (['U', 'D'].includes(char.toUpperCase())) axis = 'y';
        else if (['F', 'B'].includes(char.toUpperCase())) axis = 'z';

        let layerNum = prefix ? parseInt(prefix) : 1;
        let sliceIndex = 0;

        // Calculate index based on char and layerNum
        // R/U/F are positive side (index > 0)
        // L/D/B are negative side (index < 0)

        // R: index = maxIndex - (layerNum - 1)
        // L: index = -maxIndex + (layerNum - 1)

        if (['R', 'U', 'F'].includes(char)) {
            sliceIndex = maxIndex - (layerNum - 1);
        } else {
            sliceIndex = -maxIndex + (layerNum - 1);
        }

        sliceVal = sliceIndex * S;

        // Adjust direction for queueMove
        // performMove logic:
        // If sliceVal > 0 (R), axisVector is negative.
        // If sliceVal < 0 (L), axisVector is positive.
        // If we pass axis='x', sliceVal=..., dir=...
        // performMove sets axisVector based on sliceVal.
        // But we need to match the rotation direction of the original move.
        // Original: R (sliceVal > 0). axisVector (-1,0,0). dir=1. Rotation: -1 * 1 = -1 (clockwise looking at R).
        // Undo: R' (sliceVal > 0). axisVector (-1,0,0). dir=-1. Rotation: -1 * -1 = 1.

        // However, performMove has special logic for R/L strings.
        // If we pass 'x' and sliceVal, we hit the generic block.
        // Generic block: if sliceVal > 0, axisVector.negate().
        // So if we pass 'x', sliceVal(R), dir=1. axisVector=(-1,0,0).
        // This matches 'R' logic.

        // What about 'L'?
        // Original: L (sliceVal < 0). axisVector (1,0,0). dir=1.
        // Generic: sliceVal < 0. axisVector (1,0,0). dir=1.
        // Matches.

        // What about notationTurns in logMove?
        // R: notationTurns *= -1.
        // If we have R, dir=1. notationTurns = -1.
        // If we have L, dir=1. notationTurns = 1.

        // So if we are undoing 'R', we want dir=-1.
        // If we are undoing 'L', we want dir=-1.
        // Wait, R' is undo of R.

        // Let's look at logMove again.
        // if index > 0 (R), notationTurns *= -1.
        // So if we did a move with dir=1 on R, it logged "R" (if turns=-1) or "R'" (if turns=1)?
        // No.
        // R move: axis='x', dir=1.
        // logMove: index > 0. notationTurns = 1 * -1 = -1.
        // suffix = (notationTurns < 0 ? "'" : ""). -> "R'"?
        // Wait. Standard R is clockwise.
        // In Three.js, R is usually negative rotation around X?
        // If axisVector is (-1,0,0), and angle is positive. Rotation is negative X.
        // R is clockwise looking at Right face. Right face points to +X.
        // Clockwise around +X is negative angle? No, right hand rule. Thumb +X, fingers curl counter-clockwise.
        // So clockwise is negative angle.
        // So R should be negative rotation around X.
        // performMove: R -> axisVector (-1,0,0). dir=1 -> angle positive.
        // Rotation around (-1,0,0) by positive angle = Rotation around (1,0,0) by negative angle.
        // So R is correct.

        // logMove:
        // R (dir=1). notationTurns = -1. suffix = "'".
        // So R (dir=1) logs as R'.
        // That seems wrong. R should log as R.
        // Maybe my logMove logic was inverted?
        // Let's check existing logMove (lines 756+ in original).
        // if (index > 0) { char = "R"; notationTurns *= -1; }
        // if (notationTurns < 0) suffix = "'";
        // So R (1) -> -1 -> R'.
        // Unless performMove sends -1 for R?
        // onKeyDown sends 1 for 'R'.
        // So 'R' key -> queueMove('R', 1).
        // performMove('R', 1).
        // logMove gets called? No, performMove calls addToHistory directly for named moves.
        // Line 1115: addToHistory(axisStr + (direction === -1 ? "'" : ...))
        // So 'R' (1) -> "R".
        // 'R' (-1) -> "R'".

        // But for generic moves (scramble, or my new logMove), we use logMove.
        // My new logMove:
        // if index > 0 (R). notationTurns *= -1.
        // If dir=1 (physical R). notationTurns = -1. suffix="'". -> R'.
        // This contradicts the direct logging.
        // I should fix logMove to match.
        // If R (physical) is dir=1. We want "R".
        // So notationTurns should be positive.
        // So if index > 0, notationTurns *= 1?
        // But R is negative rotation around X.
        // If dir=1 means "Physical R", then we are good.
        // But if dir=1 means "Positive rotation around axis", then:
        // R is negative rotation. So dir=-1?
        // performMove: R -> axisVector (-1,0,0). dir=1.
        // This is rotation around -X by +Angle.
        // Which is -X rotation.
        // So R is dir=1.

        // So logMove needs to map dir=1 to "R".
        // So notationTurns should be positive.
        // So for R (index > 0), notationTurns *= 1.
        // But wait, L (index < 0). axisVector (1,0,0). dir=1.
        // Rotation around +X by +Angle. +X rotation.
        // L is clockwise looking at Left face. Left face points to -X.
        // Clockwise around -X is positive rotation around X?
        // Thumb -X. Fingers curl...
        // Looking at -X. Clockwise.
        // This is same as looking at +X and Counter-Clockwise.
        // Which is positive rotation around X.
        // So L is positive rotation.
        // So L (dir=1) is correct.

        // So R (dir=1) -> "R".
        // L (dir=1) -> "L".

        // So in logMove:
        // if index > 0 (R). notationTurns *= 1.
        // if index < 0 (L). notationTurns *= 1.
        // Wait, why did I put -1?
        // Maybe I was confused.
        // Let's fix logMove in a separate step or assume I fixed it?
        // I just wrote logMove in the previous step.
        // I wrote: if (index > 0) { ... notationTurns *= -1; }
        // This will log R' for R.
        // I need to fix logMove.

        // But for now, let's finish startReverseSolve.
        // It receives "R".
        // It wants to undo.
        // Undo of R is R'.
        // R' means dir=-1.
        // So if suffix is empty, dir=-1.
        // If suffix is "'", dir=1.

        // So:
        if (suffix === "'") dir = 1;
        else if (suffix === "2") dir = 2;
        else dir = -1;

        // Queue it.
        // Queue it.
        queueMove(axis, dir, duration, sliceVal);
    });

    const checkInterval = setInterval(() => {
        if (state.moveQueue.length === 0 && !state.isAnimating) {
            state.isAutoSolving = false;
            hardReset(true); // Keep camera after auto-solve
            clearInterval(checkInterval);
        }
    }, 100);
}

function hardReset(keepCamera = false) {
    stopTimer();
    clearInterval(state.inspectionInterval);
    state.isInspection = false;

    const timerLabel = document.getElementById('timer-label');
    if (timerLabel) {
        timerLabel.textContent = "Time";
        timerLabel.className = "text-gray-500 text-[10px] uppercase tracking-wider leading-none mb-1";
    }

    const timerDisplay = document.getElementById('timer');
    if (timerDisplay) {
        timerDisplay.textContent = "00:00.00";
        timerDisplay.className = "text-2xl sm:text-3xl font-mono text-green-400 leading-none";
    }

    state.timerRunning = false;
    state.isGameActive = false;
    state.isAutoSolving = false;
    state.moveHistory = [];
    state.scrambleSequence = [];
    updateHistoryUI();

    state.pivot.rotation.set(0, 0, 0);
    state.pivot.position.set(0, 0, 0);

    createCube();

    if (!keepCamera) {
        adjustCameraForCubeSize();
    }

    // Recreate environment and mirrors to adjust for cube size
    createEnvironment();
    createMirrors();

    state.moveQueue = [];
    state.isAnimating = false;
    state.isScrambling = false;
}

// --- Game Logic ---

function onMouseDown(event) {
    if (state.isAnimating || state.isScrambling || state.isAutoSolving) return;

    const intersects = getIntersects(event, state.renderer.domElement);
    const pos = getPointerPos(event);

    if (intersects.length > 0) {
        state.isDragging = true;
        state.isBackgroundDrag = false;
        state.intersectedCubie = intersects[0].object.parent;
        state.intersectedFaceNormal = intersects[0].face.normal.clone();
        state.intersectedFaceNormal.transformDirection(intersects[0].object.matrixWorld).round();
        state.dragStartPoint.set(pos.x, pos.y);
        state.dragAxis = null;
        state.dragInputAxis = null;
        state.currentDragAngle = 0;
    } else {
        state.isDragging = true;
        state.isBackgroundDrag = true;
        state.intersectedCubie = null;
        state.dragStartPoint.set(pos.x, pos.y);
        state.dragAxis = null;
        state.dragInputAxis = null;
        state.currentDragAngle = 0;

        const S = CUBE_SIZE + SPACING;
        const referencePointWorld = new THREE.Vector3(S * 1.5, 0, S * 1.5);
        const tempCamera = state.camera.clone();
        tempCamera.rotation.setFromRotationMatrix(state.controls.object.matrix);
        const projectedPoint = referencePointWorld.clone().project(tempCamera);
        const boundaryX = (projectedPoint.x * 0.5 + 0.5) * window.innerWidth;
        state.isRightZone = (pos.x > boundaryX);
    }
}

function onTouchStart(event) {
    event.preventDefault();
    onMouseDown(event);
}

function onMouseMove(event) {
    if (!state.isDragging) return;

    const pos = getPointerPos(event);
    const deltaX = pos.x - state.dragStartPoint.x;
    const deltaY = pos.y - state.dragStartPoint.y;

    if (!state.dragAxis) {
        if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return;
        determineDragAxis(deltaX, deltaY);
        if (state.dragAxis) {
            attachSliceToPivot();
            if (!state.timerRunning && !state.isScrambling && state.isGameActive && !state.isBackgroundDrag && !state.isAutoSolving) {
                startTimer();
            }
        }
    }

    if (state.dragAxis) {
        const sensitivity = 0.01;
        let delta = 0;
        if (state.dragInputAxis === 'x') delta = deltaX;
        else if (state.dragInputAxis === 'y') delta = deltaY;
        else delta = (Math.abs(deltaX) > Math.abs(deltaY)) ? deltaX : deltaY;

        state.currentDragAngle = delta * sensitivity * state.dragAngleScale;
        state.pivot.setRotationFromAxisAngle(state.dragRotationAxis, state.currentDragAngle);
    }
}

function onTouchMove(event) {
    event.preventDefault();
    onMouseMove(event);
}

function getPointerPos(event) {
    if (event.changedTouches && event.changedTouches.length > 0) {
        return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
    } else if (event.touches && event.touches.length > 0) {
        return { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
    return { x: event.clientX, y: event.clientY };
}

function getIntersects(event, element) {
    const rect = element.getBoundingClientRect();
    const pos = getPointerPos(event);
    state.mouse.x = ((pos.x - rect.left) / rect.width) * 2 - 1;
    state.mouse.y = -((pos.y - rect.top) / rect.height) * 2 + 1;
    state.raycaster.setFromCamera(state.mouse, state.camera);
    const cores = [];
    state.allCubies.forEach(g => {
        g.children.forEach(c => {
            if (!c.userData.isSticker) cores.push(c);
        });
    });
    return state.raycaster.intersectObjects(cores, false);
}

function determineDragAxis(dx, dy) {
    const moveX = Math.abs(dx) > Math.abs(dy);

    if (state.isBackgroundDrag) {
        if (moveX) {
            state.dragRotationAxis = new THREE.Vector3(0, 1, 0);
            state.dragAngleScale = 1;
            state.dragAxis = 'y';
            state.dragInputAxis = 'x';
        } else {
            if (state.isRightZone) {
                state.dragRotationAxis = new THREE.Vector3(0, 0, 1);
                state.dragAngleScale = -1;
                state.dragAxis = 'z';
                state.dragInputAxis = 'y';
            } else {
                state.dragRotationAxis = new THREE.Vector3(1, 0, 0);
                state.dragAngleScale = 1;
                state.dragAxis = 'x';
                state.dragInputAxis = 'y';
            }
        }
        state.dragSliceValue = Infinity;
        return;
    }

    const axes = [
        { vec: new THREE.Vector3(1, 0, 0), name: 'x' },
        { vec: new THREE.Vector3(0, 1, 0), name: 'y' },
        { vec: new THREE.Vector3(0, 0, 1), name: 'z' }
    ];
    const validAxes = axes.filter(a => Math.abs(a.vec.dot(state.intersectedFaceNormal)) < 0.1);
    let bestMatch = null;
    let bestDot = -1;
    const screenMoveVec = new THREE.Vector2(dx, dy).normalize();

    validAxes.forEach(axis => {
        const startPoint = state.intersectedCubie.position.clone();
        const endPoint = startPoint.clone().add(axis.vec);
        startPoint.project(state.camera);
        endPoint.project(state.camera);
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
        const rotAxisRaw = new THREE.Vector3().crossVectors(moveAxisVec, state.intersectedFaceNormal).normalize();
        let maxComp = 0;
        let finalRotAxis = new THREE.Vector3();
        let finalAxisName = 'x';

        if (Math.abs(rotAxisRaw.x) > maxComp) { maxComp = Math.abs(rotAxisRaw.x); finalRotAxis.set(Math.sign(rotAxisRaw.x), 0, 0); finalAxisName = 'x'; }
        if (Math.abs(rotAxisRaw.y) > maxComp) { maxComp = Math.abs(rotAxisRaw.y); finalRotAxis.set(0, Math.sign(rotAxisRaw.y), 0); finalAxisName = 'y'; }
        if (Math.abs(rotAxisRaw.z) > maxComp) { maxComp = Math.abs(rotAxisRaw.z); finalRotAxis.set(0, 0, Math.sign(rotAxisRaw.z)); finalAxisName = 'z'; }

        state.dragRotationAxis = finalRotAxis;
        state.dragAxis = finalAxisName;

        if (Math.abs(bestMatch.screenVec.x) > Math.abs(bestMatch.screenVec.y)) {
            state.dragInputAxis = 'x';
        } else {
            state.dragInputAxis = 'y';
        }

        const inputVec = (state.dragInputAxis === 'x') ? new THREE.Vector2(1, 0) : new THREE.Vector2(0, 1);
        const directionCheck = bestMatch.screenVec.dot(inputVec);
        const axisAlignment = finalRotAxis.dot(rotAxisRaw);
        state.dragAngleScale = -1 * (directionCheck > 0 ? 1 : -1) * Math.sign(axisAlignment);

        const S = CUBE_SIZE + SPACING;
        const p = state.intersectedCubie.position[state.dragAxis];

        // Snap to nearest layer
        let layer;
        const dim = state.cubeDimensions[state.dragAxis];
        if (dim % 2 === 0) {
            layer = Math.round(p / S - 0.5) + 0.5;
        } else {
            layer = Math.round(p / S);
        }
        state.dragSliceValue = layer * S;
    }
}

function attachSliceToPivot() {
    state.pivot.rotation.set(0, 0, 0);
    state.pivot.position.set(0, 0, 0);
    state.scene.add(state.pivot);
    let cubies;
    if (state.isBackgroundDrag && state.dragSliceValue === Infinity) {
        cubies = state.allCubies;
    } else {
        const epsilon = 0.5;
        cubies = state.allCubies.filter(c => Math.abs(c.position[state.dragAxis] - state.dragSliceValue) < epsilon);
    }
    cubies.forEach(c => state.pivot.attach(c));
}

function onMouseUp() {
    if (!state.isDragging) {
        state.controls.enabled = true;
        return;
    }
    state.isDragging = false;
    state.controls.enabled = true;

    if (state.dragAxis) {
        const piHalf = Math.PI / 2;
        const rawTurns = state.currentDragAngle / piHalf;
        let targetTurns = Math.round(rawTurns);

        // Check if face is rectangular AND not background drag
        if (!state.isBackgroundDrag && isFaceRectangular(state.dragAxis)) {
            // Force even turns (180 degrees)
            targetTurns = Math.round(rawTurns / 2) * 2;
        } else {
            if (Math.abs(rawTurns - Math.trunc(rawTurns)) < 0.2) targetTurns = Math.trunc(rawTurns);
        }

        const targetAngle = targetTurns * piHalf;
        snapPivot(targetAngle, targetTurns, state.dragAxis, state.dragSliceValue);
    }

    state.intersectedCubie = null;
    state.dragAxis = null;
    state.dragInputAxis = null;
}

function isFaceRectangular(axis) {
    if (!state.cubeDimensions) return false;
    const dims = state.cubeDimensions;
    if (axis === 'x') return dims.y !== dims.z;
    if (axis === 'y') return dims.x !== dims.z;
    if (axis === 'z') return dims.x !== dims.y;
    return false;
}

function snapPivot(targetAngle, turns, axis, sliceVal) {
    state.isAnimating = true;
    const startAngle = state.currentDragAngle;
    const startTime = Date.now();

    function loop() {
        const now = Date.now();
        let progress = (now - startTime) / SNAP_SPEED;
        if (progress > 1) progress = 1;
        const ease = 1 - Math.pow(1 - progress, 3);
        const current = startAngle + (targetAngle - startAngle) * ease;
        state.pivot.setRotationFromAxisAngle(state.dragRotationAxis, current);
        if (progress < 1) {
            requestAnimationFrame(loop);
        } else {
            finishMove(turns, axis, sliceVal);
        }
    }
    loop();
}

function finishMove(turns, axis, sliceVal) {
    // If whole cube rotation (sliceVal === Infinity) and 90 degree turn (odd turns), swap dimensions
    if (sliceVal === Infinity && Math.abs(turns) % 2 === 1) {
        const dims = state.cubeDimensions;
        if (axis === 'x') {
            // Swap Y and Z
            const temp = dims.y;
            dims.y = dims.z;
            dims.z = temp;
        } else if (axis === 'y') {
            // Swap X and Z
            const temp = dims.x;
            dims.x = dims.z;
            dims.z = temp;
        } else if (axis === 'z') {
            // Swap X and Y
            const temp = dims.x;
            dims.x = dims.y;
            dims.y = temp;
        }
    }

    state.pivot.updateMatrixWorld();
    const children = [...state.pivot.children];
    children.forEach(c => {
        state.scene.attach(c);
        const S = CUBE_SIZE + SPACING;
        // Helper to snap to nearest valid position
        const snap = (val, axis) => {
            const dim = state.cubeDimensions[axis];
            if (dim % 2 === 0) {
                // Even size: snap to ... -1.5, -0.5, 0.5, 1.5 ...
                const index = Math.round(val / S - 0.5) + 0.5;
                return index * S;
            } else {
                // Odd size: snap to integers
                const index = Math.round(val / S);
                return index * S;
            }
        };

        c.position.x = snap(c.position.x, 'x');
        c.position.y = snap(c.position.y, 'y');
        c.position.z = snap(c.position.z, 'z');
        const e = new THREE.Euler().setFromQuaternion(c.quaternion);
        c.rotation.set(
            Math.round(e.x / (Math.PI / 2)) * (Math.PI / 2),
            Math.round(e.y / (Math.PI / 2)) * (Math.PI / 2),
            Math.round(e.z / (Math.PI / 2)) * (Math.PI / 2)
        );
        c.updateMatrixWorld();
    });
    state.pivot.rotation.set(0, 0, 0);
    state.isAnimating = false;
    if (turns !== 0) {
        logMove(axis, sliceVal, turns);
        checkSolved();
    }
}

function logMove(axis, sliceVal, turns) {
    // Don't log moves during scramble or auto-solve (reset animation)
    if (state.isScrambling || state.isAutoSolving) return;

    if (sliceVal === Infinity) {
        let char = axis;
        let count = Math.abs(turns);
        let notationTurns = turns * -1;
        if (axis === 'z') {
            notationTurns = turns;
        }
        let suffix = (count === 2) ? "2" : (notationTurns < 0 ? "'" : "");
        if (count % 4 !== 0) {
            addToHistory(char + suffix, false);
        }
        return;
    }

    let count = Math.abs(turns);
    let suffix = (count === 2) ? "2" : "";
    let notationTurns = turns;

    const S = CUBE_SIZE + SPACING;
    // Normalize sliceVal to index (0-centered, 1 unit apart)
    // e.g. for 3x3: -1, 0, 1
    // for 4x4: -1.5, -0.5, 0.5, 1.5
    const index = Math.round(sliceVal / S * 2) / 2;
    const dim = state.cubeDimensions[axis];
    const maxIndex = (dim - 1) / 2;

    // Determine layer number from outside (1-based)
    // Positive index is Right/Up/Front side
    // Negative index is Left/Down/Back side

    let char = "";
    let layerNum = 0;

    // Map axis to faces
    // x: R (pos), L (neg)
    // y: U (pos), D (neg)
    // z: F (pos), B (neg)

    if (axis === 'x') {
        if (index > 0) {
            char = "R";
            notationTurns *= 1;
            layerNum = Math.round(maxIndex - index + 1);
        } else if (index < 0) {
            char = "L";
            notationTurns *= 1;
            layerNum = Math.round(maxIndex + index + 1); // e.g. -1.5 -> max 1.5 -> 1.5 + (-1.5) + 1 = 1
        } else {
            char = "M";
            notationTurns *= 1;
            layerNum = 1;
        }
    } else if (axis === 'y') {
        if (index > 0) {
            char = "U";
            notationTurns *= 1;
            layerNum = Math.round(maxIndex - index + 1);
        } else if (index < 0) {
            char = "D";
            notationTurns *= 1;
            layerNum = Math.round(maxIndex + index + 1);
        } else {
            char = "E";
            notationTurns *= 1;
            layerNum = 1;
        }
    } else if (axis === 'z') {
        if (index > 0) {
            char = "F";
            notationTurns *= 1;
            layerNum = Math.round(maxIndex - index + 1);
        } else if (index < 0) {
            char = "B";
            notationTurns *= 1;
            layerNum = Math.round(maxIndex + index + 1);
        } else {
            char = "S";
            notationTurns *= -1;
            layerNum = 1;
        }
    }

    // Format:
    // Layer 1: R, L, U, D, F, B
    // Layer 2: 2R, 2L... (or just lowercase r? let's use nR notation for > 2 layers deep, or maybe just always nR if n > 1)
    // Standard WCA for big cubes:
    // 3x3: R
    // 4x4: R (outer), Rw (wide), 2R (inner?) - actually WCA uses Rw for wide. 
    // SiGN notation uses 2R for 2nd layer.
    // Let's use:
    // Layer 1: R
    // Layer 2: 2R
    // Layer 3: 3R
    // etc.

    let prefix = "";
    if (layerNum > 1) {
        prefix = layerNum.toString();
    }

    // Special case for middle layers on odd cubes if we want to keep M/E/S?
    // M is usually middle of 3x3. On 5x5 M is the very center.
    // Let's stick to the nX notation for consistency on big cubes, except maybe for 3x3 where M is standard.
    if (state.cubeSize === 3 && char === 'M') prefix = "";
    if (state.cubeSize === 3 && char === 'E') prefix = "";
    if (state.cubeSize === 3 && char === 'S') prefix = "";

    if (count !== 2) suffix = (notationTurns < 0 ? "'" : "");
    if (count % 4 === 0) return;

    addToHistory(prefix + char + suffix, false);
}

function startScramble() {
    if (state.isAnimating) return;
    hardReset(true); // Keep camera on scramble
    state.isScrambling = true;
    state.scrambleSequence = [];

    // Generate random moves
    // For each move, pick an axis (x,y,z), a layer index, and a direction

    let scrambleMoves = [];
    const axes = ['x', 'y', 'z'];
    const S = CUBE_SIZE + SPACING;

    // Helper to get valid slice indices
    const getSliceIndices = (axis) => {
        const indices = [];
        const dim = state.cubeDimensions[axis];
        const offset = (dim - 1) / 2;
        if (dim % 2 === 0) {
            // -1.5, -0.5, 0.5, 1.5
            for (let i = -offset; i <= offset; i += 1) {
                indices.push(i);
            }
        } else {
            // -1, 0, 1
            for (let i = -offset; i <= offset; i++) {
                indices.push(i);
            }
        }
        return indices;
    };

    let prevMove = null;

    // Dynamic scramble length: 25 for 3x3, more for larger cubes
    // 3x3: 25
    // 4x4: 60
    // 5x5: 75
    // 10x10: 150
    const targetMoves = Math.max(25, state.cubeSize * 15);

    while (scrambleMoves.length < targetMoves) {
        const axis = axes[Math.floor(Math.random() * axes.length)];
        const sliceIndices = getSliceIndices(axis);
        const sliceIndex = sliceIndices[Math.floor(Math.random() * sliceIndices.length)];

        // Avoid immediate undo: same axis and same slice
        if (prevMove && prevMove.axis === axis && prevMove.slice === sliceIndex) continue;

        scrambleMoves.push({ axis, slice: sliceIndex });
        prevMove = { axis, slice: sliceIndex };
    }

    scrambleMoves.forEach(m => {
        const r = Math.random();
        let dir = 1;

        if (isFaceRectangular(m.axis)) {
            dir = 2; // Only double moves for rectangular faces
        } else {
            if (r < 0.33) dir = 1;
            else if (r < 0.66) dir = -1;
            else dir = 2;
        }

        // Convert to notation for display
        // We need to temporarily mock logMove's logic or just rely on logMove to NOT log and we build the string here?
        // Actually logMove is suppressed during scramble. We need to build the string for state.scrambleSequence.

        // Re-use logic from logMove (simplified)
        let char = "";
        let notationTurns = dir;
        if (m.axis === 'x') {
            if (m.slice > 0) { char = "R"; notationTurns *= 1; }
            else if (m.slice < 0) { char = "L"; notationTurns *= 1; }
            else { char = "M"; notationTurns *= 1; }
        } else if (m.axis === 'y') {
            if (m.slice > 0) { char = "U"; notationTurns *= 1; }
            else if (m.slice < 0) { char = "D"; notationTurns *= 1; }
            else { char = "E"; notationTurns *= 1; }
        } else if (m.axis === 'z') {
            if (m.slice > 0) { char = "F"; notationTurns *= 1; }
            else if (m.slice < 0) { char = "B"; notationTurns *= 1; }
            else { char = "S"; notationTurns *= -1; }
        }

        // Add layer number prefix
        const dim = state.cubeDimensions[m.axis];
        const maxIndex = (dim - 1) / 2;
        let layerNum = 0;
        if (m.slice > 0) layerNum = Math.round(maxIndex - m.slice + 1);
        else if (m.slice < 0) layerNum = Math.round(maxIndex + m.slice + 1);
        else layerNum = 1; // Middle

        let prefix = "";
        if (layerNum > 1) prefix = layerNum.toString();
        // Cleanup middle
        if (state.cubeSize === 3 && ['M', 'E', 'S'].includes(char)) prefix = "";

        let suffix = (Math.abs(dir) === 2) ? "2" : (notationTurns < 0 ? "'" : "");

        state.scrambleSequence.push(prefix + char + suffix);

        // Queue with sliceVal
        queueMove(m.axis, dir, SCRAMBLE_SPEED, m.slice * S);
    });

    const check = setInterval(() => {
        if (state.moveQueue.length === 0 && !state.isAnimating) {
            state.isScrambling = false;
            startInspection();
            clearInterval(check);
        }
    }, 100);
}

function startInspection() {
    state.isGameActive = true;
    state.isInspection = true;
    state.inspectionTimeLeft = 15;

    const timerLabel = document.getElementById('timer-label');
    const timerDisplay = document.getElementById('timer');

    if (timerLabel) {
        timerLabel.textContent = "INSPECTION";
        timerLabel.className = "text-orange-400 text-[10px] uppercase tracking-wider leading-none mb-1 font-bold";
    }

    if (timerDisplay) {
        timerDisplay.className = "text-2xl sm:text-3xl font-mono text-orange-500 leading-none";
    }

    state.inspectionInterval = setInterval(() => {
        state.inspectionTimeLeft--;
        if (state.inspectionTimeLeft > 0) {
            if (timerDisplay) timerDisplay.textContent = state.inspectionTimeLeft;
        } else {
            startTimer();
        }
    }, 1000);
}

function startTimer() {
    if (state.timerRunning) return;
    if (state.isInspection) {
        clearInterval(state.inspectionInterval);
        state.isInspection = false;
    }
    state.timerRunning = true;
    state.startTime = Date.now();
    const timerLabel = document.getElementById('timer-label');
    const timerDisplay = document.getElementById('timer');
    timerLabel.textContent = "SOLVING";
    timerLabel.className = "text-yellow-400 text-[10px] uppercase tracking-wider leading-none mb-1 font-bold";
    timerDisplay.className = "text-2xl sm:text-3xl font-mono text-yellow-400 leading-none";
    state.timerInterval = setInterval(() => {
        const elapsed = Date.now() - state.startTime;
        state.finalTimeMs = elapsed; // Store for leaderboard
        const min = Math.floor(elapsed / 60000);
        const sec = Math.floor((elapsed % 60000) / 1000);
        const ms = Math.floor((elapsed % 1000) / 10);
        if (timerDisplay) {
            timerDisplay.textContent =
                `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
        }
    }, 50);
}

function stopTimer() {
    state.timerRunning = false;
    clearInterval(state.timerInterval);
    clearInterval(state.inspectionInterval);
}

function checkSolved() {
    if (!state.isGameActive || state.isScrambling || state.moveHistory.length === 0 || state.isInspection || state.isAutoSolving) return;

    const directions = [
        { dir: new THREE.Vector3(1, 0, 0), axis: 'x', val: (state.cubeDimensions.x - 1) / 2 },
        { dir: new THREE.Vector3(-1, 0, 0), axis: 'x', val: -(state.cubeDimensions.x - 1) / 2 },
        { dir: new THREE.Vector3(0, 1, 0), axis: 'y', val: (state.cubeDimensions.y - 1) / 2 },
        { dir: new THREE.Vector3(0, -1, 0), axis: 'y', val: -(state.cubeDimensions.y - 1) / 2 },
        { dir: new THREE.Vector3(0, 0, 1), axis: 'z', val: (state.cubeDimensions.z - 1) / 2 },
        { dir: new THREE.Vector3(0, 0, -1), axis: 'z', val: -(state.cubeDimensions.z - 1) / 2 }
    ];

    const epsilon = 0.5;
    let isAllSolved = true;

    for (const face of directions) {
        const faceCubies = state.allCubies.filter(c => Math.abs(c.position[face.axis] - (face.val * (CUBE_SIZE + SPACING))) < epsilon);
        let faceColorHex = null;
        for (const group of faceCubies) {
            let stickerColor = null;
            for (const child of group.children) {
                if (child.userData.isSticker) {
                    const normal = new THREE.Vector3(0, 0, 1);
                    normal.applyQuaternion(child.quaternion);
                    normal.applyQuaternion(group.quaternion);
                    if (normal.dot(face.dir) > 0.9) {
                        stickerColor = child.material.uniforms.color.value.getHex();
                        break;
                    }
                }
            }
            if (stickerColor === null) continue;
            if (faceColorHex === null) faceColorHex = stickerColor;
            else if (faceColorHex !== stickerColor) {
                isAllSolved = false;
                break;
            }
        }
        if (!isAllSolved) break;
    }

    if (isAllSolved) {
        stopTimer();
        state.isGameActive = false;
        animateVictory();
    }
}

function animateVictory() {
    playSolveAnimation(() => {
        showWinModal();
    });
}

function playSolveAnimation(onComplete = null) {
    state.isAnimating = true;
    state.pivot.rotation.set(0, 0, 0);
    state.pivot.position.set(0, 0, 0);
    state.scene.add(state.pivot);
    state.allCubies.forEach(c => state.pivot.attach(c));

    const duration = 2000;
    const rotations = 10 * Math.PI; // 5 full rotations
    const jumpHeight = 2.0;
    const startTime = Date.now();

    triggerConfetti();

    function loop() {
        const now = Date.now();
        let progress = (now - startTime) / duration;
        if (progress > 1) progress = 1;

        // Ease-in-out for spin
        // standard cubic ease in out
        const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        state.pivot.rotation.y = rotations * ease;

        // Bounce: Up and down
        // sin(progress * PI) goes 0 -> 1 -> 0
        state.pivot.position.y = jumpHeight * Math.sin(progress * Math.PI);

        if (progress < 1) {
            requestAnimationFrame(loop);
        } else {
            // Reset
            state.pivot.rotation.set(0, 0, 0);
            state.pivot.position.set(0, 0, 0);
            state.pivot.updateMatrixWorld();

            // Detach
            const children = [...state.pivot.children];
            children.forEach(c => {
                state.scene.attach(c);
            });

            setTimeout(() => {
                state.isAnimating = false;
                if (onComplete) onComplete();
            }, 1000);
        }
    }
    loop();
}

function triggerConfetti() {
    const particleCount = 200;
    const geometry = new THREE.PlaneGeometry(0.1, 0.1);
    const material = new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        transparent: true
    });
    const mesh = new THREE.InstancedMesh(geometry, material, particleCount);

    const dummy = new THREE.Object3D();
    const velocities = [];
    const colors = [];

    for (let i = 0; i < particleCount; i++) {
        dummy.position.set(0, 0, 0);
        dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        // Random velocity outward + up
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const speed = 2 + Math.random() * 3;

        velocities.push({
            x: (Math.random() - 0.5) * speed * 2,
            y: (Math.random() * 2 + 1) * speed * 0.5,
            z: (Math.random() - 0.5) * speed * 2,
            rx: Math.random() * 0.2,
            ry: Math.random() * 0.2,
            rz: Math.random() * 0.2
        });

        // Random color from COLORS
        const colorHex = COLORS[Math.floor(Math.random() * COLORS.length)];
        const color = new THREE.Color(colorHex);
        mesh.setColorAt(i, color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    state.scene.add(mesh);

    const startTime = Date.now();
    const duration = 3000;

    function animateConfetti() {
        const now = Date.now();
        const progress = (now - startTime) / duration;

        if (progress >= 1) {
            state.scene.remove(mesh);
            return;
        }

        for (let i = 0; i < particleCount; i++) {
            mesh.getMatrixAt(i, dummy.matrix);
            dummy.position.setFromMatrixPosition(dummy.matrix);

            const v = velocities[i];
            dummy.position.x += v.x * 0.016;
            dummy.position.y += v.y * 0.016;
            dummy.position.z += v.z * 0.016;

            // Gravity
            v.y -= 0.15;

            dummy.rotation.x += v.rx;
            dummy.rotation.y += v.ry;
            dummy.rotation.z += v.rz;

            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }

        mesh.instanceMatrix.needsUpdate = true;

        // Fade out
        if (progress > 0.7) {
            material.opacity = 1 - (progress - 0.7) / 0.3;
        }

        requestAnimationFrame(animateConfetti);
    }
    animateConfetti();
}

function playCubeAnimation(reverse = false, onComplete = null) {
    state.isAnimating = true;
    state.pivot.rotation.set(0, 0, 0);
    state.pivot.position.set(0, 0, 0);
    state.scene.add(state.pivot);
    state.allCubies.forEach(c => state.pivot.attach(c));
    const spinDuration = 800; // Quick animation
    const spinRotations = 2 * Math.PI * 2; // 2 full rotations
    const jumpHeight = 2.5; // Height of jump
    const startTime = Date.now();

    function loop() {
        const now = Date.now();
        let progress = (now - startTime) / spinDuration;
        if (progress > 1) progress = 1;

        // If reverse, flip the progress
        const effectiveProgress = reverse ? (1 - progress) : progress;

        // Spin with ease
        const spinEase = effectiveProgress < 0.5 ? 2 * effectiveProgress * effectiveProgress : 1 - Math.pow(-2 * effectiveProgress + 2, 2) / 2;
        state.pivot.rotation.y = -spinRotations * spinEase;

        // Jump up with ease-out (decelerate as it reaches peak)
        // Use 1 - (1-x)^2 for smooth deceleration to peak
        const jumpEase = 1 - Math.pow(1 - effectiveProgress, 2);
        state.pivot.position.y = jumpHeight * jumpEase;

        // Opacity Animation
        let currentOpacity = 1.0;
        if (!reverse) {
            // Fading OUT (0 -> 1 progress)
            // Start fading at 50%, fully transparent at 100%
            if (progress > 0.5) {
                currentOpacity = 1.0 - (progress - 0.5) * 2.0;
            }
        } else {
            // Fading IN (1 -> 0 progress, but time moves forward)
            // Start fully transparent, fully opaque at 50% of animation (which is effectiveProgress 0.5)
            // effectiveProgress goes 1 -> 0.
            // We want opacity 0 -> 1 as effectiveProgress goes 1 -> 0.
            // Wait, reverse means we start at peak (effective 1) and go to ground (effective 0).
            // So we want to start transparent (at peak) and become opaque.
            // So as effectiveProgress goes 1 -> 0, opacity goes 0 -> 1.
            // Let's fade in during the first half of the descent (effective 1 -> 0.5)
            if (effectiveProgress > 0.5) {
                currentOpacity = (1.0 - effectiveProgress) * 2.0;
            } else {
                currentOpacity = 1.0;
            }
        }

        // Apply opacity
        state.allCubies.forEach(group => {
            group.children.forEach(mesh => {
                if (mesh.material) {
                    if (mesh.userData.isSticker) {
                        mesh.material.uniforms.opacity.value = currentOpacity;
                    } else {
                        mesh.material.opacity = currentOpacity;
                    }
                }
            });
        });

        if (progress < 1) {
            requestAnimationFrame(loop);
        } else {
            // Reset pivot
            state.allCubies.forEach(c => state.scene.attach(c));
            state.pivot.rotation.set(0, 0, 0);
            state.pivot.position.set(0, 0, 0);

            // Ensure full opacity at end
            state.allCubies.forEach(group => {
                group.children.forEach(mesh => {
                    if (mesh.material) {
                        if (mesh.userData.isSticker) {
                            mesh.material.uniforms.opacity.value = 1.0;
                        } else {
                            mesh.material.opacity = 1.0;
                        }
                    }
                });
            });

            state.isAnimating = false;
            if (onComplete) onComplete();
        }
    }
    loop();
}

function getCubiesInSlice(axis, value) {
    const epsilon = 0.5;
    return state.allCubies.filter(c => Math.abs(c.position[axis] - value) < epsilon);
}

function queueMove(axis, direction, speed = ANIMATION_SPEED, sliceVal = null) {
    state.moveQueue.push({ axis, direction, speed, sliceVal });
    processQueue();
}

function processQueue() {
    if (state.isAnimating || state.moveQueue.length === 0) return;
    const move = state.moveQueue.shift();
    performMove(move.axis, move.direction, move.speed, move.sliceVal);
}

function performMove(axisStr, direction, duration, sliceVal = null) {
    state.isAnimating = true;

    // Timer start logic for regular play (not auto-solve)
    if (!state.timerRunning && !state.isScrambling && state.isGameActive && state.moveQueue.length < 5 && !['x', 'y', 'z'].includes(axisStr) && !state.isAutoSolving) {
        startTimer();
    }

    let axisVector = new THREE.Vector3();
    let cubies = [];
    let targetAxis = '';
    const S = CUBE_SIZE + SPACING;
    const outerOffsetX = (state.cubeDimensions.x - 1) / 2 * S;
    const outerOffsetY = (state.cubeDimensions.y - 1) / 2 * S;
    const outerOffsetZ = (state.cubeDimensions.z - 1) / 2 * S;
    // For legacy named moves, we assume uniform cube or just use X/Y/Z max
    // But named moves like R/L/U/D usually refer to the specific face.
    // So R is +X face. L is -X face.
    // U is +Y face. D is -Y face.
    // F is +Z face. B is -Z face.

    const innerOffsetX = outerOffsetX - S;
    const innerOffsetY = outerOffsetY - S;
    const innerOffsetZ = outerOffsetZ - S;

    const angleMultiplier = Math.abs(direction);

    // Handle explicit sliceVal (from scramble or internal logic)
    if (sliceVal !== null) {
        targetAxis = axisStr; // axisStr is 'x', 'y', or 'z' in this case
        if (axisStr === 'x') axisVector.set(-1, 0, 0);
        else if (axisStr === 'y') axisVector.set(0, -1, 0);
        else if (axisStr === 'z') axisVector.set(0, 0, -1);

        const epsilon = 0.5;
        cubies = state.allCubies.filter(c => Math.abs(c.position[targetAxis] - sliceVal) < epsilon);

        // Adjust direction for "positive" layers vs "negative" layers if needed to match standard rotation?
        // Standard: R is -1 on x (if x points left?). 
        // In this app:
        // R is x = +offset? No, let's check.
        // In createCube: x goes -offset to +offset.
        // In performMove (old): R -> sliceVal = outerOffset (positive). axisVector = (-1, 0, 0).
        // So positive X layer rotates around (-1, 0, 0).
        // L -> sliceVal = -outerOffset (negative). axisVector = (1, 0, 0).

        // So if sliceVal > 0, axisVector is negative axis.
        // If sliceVal < 0, axisVector is positive axis.
        // If sliceVal == 0 (M/E/S), it depends.
        // M (x=0) -> (1, 0, 0) -> positive.

        if (sliceVal > 0.1) axisVector.negate();
        else if (sliceVal < -0.1) { /* keep positive */ }
        else {
            // Middle layers
            if (axisStr === 'x') axisVector.set(1, 0, 0); // M follows L
            if (axisStr === 'y') axisVector.set(0, 1, 0); // E follows D? Old code: E -> (0, 1, 0).
            if (axisStr === 'z') axisVector.set(0, 0, -1); // S follows F? Old code: S -> (0, 0, -1).
        }

    } else if (['x', 'y', 'z'].includes(axisStr)) {
        // Whole cube rotation
        cubies = state.allCubies;
        targetAxis = axisStr;
        if (axisStr === 'x') axisVector.set(-1, 0, 0);
        if (axisStr === 'y') axisVector.set(0, -1, 0);
        if (axisStr === 'z') axisVector.set(0, 0, -1);
        sliceVal = Infinity;
    } else {
        // Legacy string handling (R, L, U, D...) - mainly for keyboard/buttons
        // We map these to specific slices
        if (axisStr === 'R') { targetAxis = 'x'; sliceVal = outerOffsetX; axisVector.set(-1, 0, 0); }
        else if (axisStr === 'L') { targetAxis = 'x'; sliceVal = -outerOffsetX; axisVector.set(1, 0, 0); }
        else if (axisStr === 'U') { targetAxis = 'y'; sliceVal = outerOffsetY; axisVector.set(0, -1, 0); }
        else if (axisStr === 'D') { targetAxis = 'y'; sliceVal = -outerOffsetY; axisVector.set(0, 1, 0); }
        else if (axisStr === 'F') { targetAxis = 'z'; sliceVal = outerOffsetZ; axisVector.set(0, 0, -1); }
        else if (axisStr === 'B') { targetAxis = 'z'; sliceVal = -outerOffsetZ; axisVector.set(0, 0, 1); }

        // Inner slices (lowercase) - primarily for 4x4/5x5
        else if (axisStr === 'r') { targetAxis = 'x'; sliceVal = innerOffsetX; axisVector.set(-1, 0, 0); }
        else if (axisStr === 'l') { targetAxis = 'x'; sliceVal = -innerOffsetX; axisVector.set(1, 0, 0); }
        else if (axisStr === 'u') { targetAxis = 'y'; sliceVal = innerOffsetY; axisVector.set(0, -1, 0); }
        else if (axisStr === 'd') { targetAxis = 'y'; sliceVal = -innerOffsetY; axisVector.set(0, 1, 0); }
        else if (axisStr === 'f') { targetAxis = 'z'; sliceVal = innerOffsetZ; axisVector.set(0, 0, -1); }
        else if (axisStr === 'b') { targetAxis = 'z'; sliceVal = -innerOffsetZ; axisVector.set(0, 0, 1); }

        else if (axisStr === 'M') { targetAxis = 'x'; sliceVal = 0; axisVector.set(1, 0, 0); }
        else if (axisStr === 'E') { targetAxis = 'y'; sliceVal = 0; axisVector.set(0, 1, 0); }
        else if (axisStr === 'S') { targetAxis = 'z'; sliceVal = 0; axisVector.set(0, 0, -1); }

        const epsilon = 0.5;
        cubies = state.allCubies.filter(c => Math.abs(c.position[targetAxis] - sliceVal) < epsilon);
    }

    // Enforce rectangular restrictions for slice moves (not whole cube)
    if (sliceVal !== Infinity && isFaceRectangular(targetAxis)) {
        if (Math.abs(direction) === 1) {
            direction = direction * 2;
        }
    }

    if (direction < 0) axisVector.negate();

    if (!state.isScrambling && !['x', 'y', 'z'].includes(axisStr) && !state.isAutoSolving) {
        // If we have a sliceVal, we should log it properly
        // If it came from a key press (axisStr is 'R', etc), we can just log axisStr
        // But if we want consistent notation, we might want to use logMove with sliceVal
        if (sliceVal !== null && sliceVal !== Infinity && ['x', 'y', 'z'].includes(axisStr)) {
            logMove(axisStr, sliceVal, direction);
        } else {
            // Legacy logging for named moves
            // Actually, let's just use the axisStr if it's a named move
            if (['R', 'L', 'U', 'D', 'F', 'B', 'r', 'l', 'u', 'd', 'f', 'b', 'M', 'E', 'S'].includes(axisStr)) {
                let suffix = (Math.abs(direction) === 2) ? "2" : (direction < 0 ? "'" : "");
                // Fix direction for notation if needed (some are inverted)
                // But wait, logMove handles the inversion logic based on axis.
                // Here we just have the string.
                addToHistory(axisStr + suffix, false);
            }
        }
    }

    state.pivot.rotation.set(0, 0, 0);
    state.pivot.position.set(0, 0, 0);
    state.scene.add(state.pivot);
    cubies.forEach(c => state.pivot.attach(c));

    const startTime = Date.now();
    const baseAngle = Math.PI / 2;
    const totalAngle = baseAngle * angleMultiplier;

    function loop() {
        const now = Date.now();
        let progress = (now - startTime) / duration;
        if (progress > 1) progress = 1;
        const ease = 1 - Math.pow(1 - progress, 3);
        state.pivot.setRotationFromAxisAngle(axisVector, totalAngle * ease);

        if (progress < 1) requestAnimationFrame(loop);
        else {
            state.pivot.updateMatrixWorld();
            const children = [...state.pivot.children];
            children.forEach(c => {
                state.scene.attach(c);
                const S = CUBE_SIZE + SPACING;

                // Helper to snap to nearest valid position
                const snap = (val, axis) => {
                    const dim = state.cubeDimensions[axis];
                    if (dim % 2 === 0) {
                        // Even size: snap to ... -1.5, -0.5, 0.5, 1.5 ...
                        const index = Math.round(val / S - 0.5) + 0.5;
                        return index * S;
                    } else {
                        // Odd size: snap to integers
                        const index = Math.round(val / S);
                        return index * S;
                    }
                };

                c.position.x = snap(c.position.x, 'x');
                c.position.y = snap(c.position.y, 'y');
                c.position.z = snap(c.position.z, 'z');

                const e = new THREE.Euler().setFromQuaternion(c.quaternion);
                c.rotation.set(
                    Math.round(e.x / (Math.PI / 2)) * (Math.PI / 2),
                    Math.round(e.y / (Math.PI / 2)) * (Math.PI / 2),
                    Math.round(e.z / (Math.PI / 2)) * (Math.PI / 2)
                );
                c.updateMatrixWorld();
            });
            state.pivot.rotation.set(0, 0, 0);
            state.isAnimating = false;
            checkSolved();
            processQueue();
        }
    }
    loop();
}

function onKeyDown(event) {
    // Ignore keyboard controls if user is typing in an input or textarea
    const target = event.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
    }

    if (state.isScrambling || state.isDragging || state.isAutoSolving) return;
    const key = event.key;
    const upper = key.toUpperCase();
    const isShift = event.shiftKey;

    if (['R', 'L', 'U', 'D', 'F', 'B'].includes(upper)) {
        queueMove(upper, isShift ? -1 : 1);
    }
    else if (['X', 'Y', 'Z'].includes(upper)) {
        queueMove(upper.toLowerCase(), isShift ? -1 : 1);
    }
    else if (key === 'ArrowRight') queueMove('y', 1);
    else if (key === 'ArrowLeft') queueMove('y', -1);
    else if (key === 'ArrowUp') queueMove('x', 1);
    else if (key === 'ArrowDown') queueMove('x', -1);
}

function onWindowResize() {
    state.camera.aspect = window.innerWidth / window.innerHeight;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(window.innerWidth, window.innerHeight);
    adjustCameraForCubeSize();
}

function animate() {
    requestAnimationFrame(animate);

    // FPS Calculation
    frameCount++;
    const now = performance.now();
    const delta = now - lastTime;

    if (delta >= 1000) { // Update FPS every second
        fps = Math.round(frameCount * 1000 / delta);
        document.getElementById('fps-value').textContent = fps;
        frameCount = 0;
        lastTime = now;
    }

    state.controls.update();
    state.renderer.render(state.scene, state.camera);
}
