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
    hasBeenScrambled: false,
    pivot: new THREE.Object3D(),
    cubeSize: 3,
    cubeDimensions: { x: 3, y: 3, z: 3 },
    activeDimensions: { x: 3, y: 3, z: 3 },
    showMirrors: false,
    backMirrorHeightOffset: 1.7,
    animationSpeed: 140,
    snapSpeed: 80,
    freeRotation: true,

    // Camera Settings
    // Camera Settings
    cameraSettings: {
        azimuth: 26.6,   // Degrees (matches approx atan(6/12))
        elevation: 24.1, // Degrees (matches approx asin(6/14.7))
        zoom: 0.14,      // Zoom factor (relative default)
        puzzleRotation: -13 // Degrees (Y-axis rotation)
    },

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
    activeKeys: new Set(),
    dragTouchId: null,

    // Timer State
    startTime: 0,
    finalTimeMs: 0,
    timerInterval: null,
    moveHistory: [],
    timerRunning: false,
    isInspection: false,
    inspectionInterval: null,
    inspectionTimeLeft: 15,
    lastPauseTime: 0,
    wasTimerRunning: false,
    wasInspectionRunning: false,

    // Firebase User
    currentUser: null,
    leaderboardUnsubscribe: null,
    availablePuzzleTypes: new Set(),

    // Leaderboard Selection
    selectedLeaderboardPuzzle: null,
    lastLibraryCategory: null,

    // Active Puzzle Implementation
    activePuzzle: null,
    cubeWrapper: null,
    debugSequenceCount: 0,
    isSimulatedOffline: false,
    isNetworkOnline: true
};
