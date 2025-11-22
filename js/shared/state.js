import * as THREE from 'three';

export const state = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    allCubies: [],
    isAnimating: false,
    moveQueue: [],
    isSolved: true,
    isScrambling: false,
    isAutoSolving: false,
    scrambleSequence: [],
    pivot: new THREE.Object3D(),
    cubeSize: 3,
    cubeDimensions: { x: 3, y: 3, z: 3 },
    activeDimensions: { x: 3, y: 3, z: 3 },
    showMirrors: true,

    // Interaction State
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
    isDragging: false,
    dragStartPoint: new THREE.Vector2(),
    intersectedCubie: null,
    intersectedFaceNormal: null,
    dragAxis: null,
    dragSliceValue: 0,
    dragRotationAxis: null,
    currentDragAngle: 0,
    dragAngleScale: 1,
    isGameActive: false,
    isBackgroundDrag: false,
    dragInputAxis: null,
    isRightZone: false,

    // Timer State
    startTime: 0,
    finalTimeMs: 0,
    timerInterval: null,
    moveHistory: [],
    timerRunning: false,
    isInspection: false,
    inspectionInterval: null,
    inspectionTimeLeft: 15,

    // Firebase User
    currentUser: null,
    leaderboardUnsubscribe: null,

    // Leaderboard Selection
    selectedLeaderboardPuzzle: null
};
