import * as THREE from 'three';
import { StandardCube } from '../puzzles/StandardCube.js';
import { MirrorCube } from '../puzzles/MirrorCube.js';


let scene, camera, renderer, previewGroup;
let activePreviewPuzzle = null;
let animationId = null;
let isInitialized = false;

export function initPreview(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Cleanup if already initialized
    if (isInitialized) disposePreview();

    // Scene
    scene = new THREE.Scene();
    scene.background = null; // Transparent background

    // Camera
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    camera.position.set(4, 4, 6);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
    backLight.position.set(-5, -5, -5);
    scene.add(backLight);

    // Preview Group (Rotatable)
    previewGroup = new THREE.Group();
    scene.add(previewGroup);

    isInitialized = true;
    animate();

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
        if (!container || !renderer || !camera) return;
        const width = container.clientWidth;
        const height = container.clientHeight;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    });
    resizeObserver.observe(container);
}

export function updatePreview(dimensions, isMirror) {
    if (!isInitialized || !previewGroup) return;

    // Clear previous puzzle
    while (previewGroup.children.length > 0) {
        const child = previewGroup.children[0];
        previewGroup.remove(child);
        // Dispose geometries/materials if needed? 
        // Three.js cleanup is manual, but for small previews it might be okay.
        // Ideally we should traverse and dispose.
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
            else child.material.dispose();
        }
    }

    const cubieList = []; // Local list for this preview instance

    let PuzzleClass = isMirror ? MirrorCube : StandardCube;

    // Create new puzzle instance
    activePreviewPuzzle = new PuzzleClass({
        dimensions: dimensions,
        parent: previewGroup,
        cubieList: cubieList
    });

    // Generate Geometry
    activePreviewPuzzle.createGeometry();

    // If Mirror Cube, apply defaults
    if (isMirror && activePreviewPuzzle instanceof MirrorCube) {
        // We can use the same defaults as the main game or just standard
        // For preview, standard defaults are fine.
        // If we wanted to reflect the tuner settings, we'd need to read them.
        // But the tuner is usually hidden when creating a new puzzle.

        // We do need to handle the "shift" logic if we want it to look right?
        // MirrorCube constructor handles bounds generation.
        // But updateDimensions might be needed if we want specific offsets?
        // The constructor calls generateBounds which uses default logic.
        // That should be sufficient for a preview.

        // Update stickers to ensure they look good
        activePreviewPuzzle.updateStickers(0.04, 0.08);
    }

    // Auto-zoom / Adjust Camera
    const maxDim = Math.max(dimensions.x, dimensions.y, dimensions.z);
    // Zoom in closer: Reduced multiplier and offset
    const dist = maxDim * 1.2 + 1;
    camera.position.set(dist, dist * 0.8, dist);
    camera.lookAt(0, 0, 0);
}

function animate() {
    if (!isInitialized) return;
    animationId = requestAnimationFrame(animate);

    if (previewGroup) {
        previewGroup.rotation.y += 0.005; // Slow rotation
    }

    renderer.render(scene, camera);
}

export function disposePreview() {
    isInitialized = false;
    if (animationId) cancelAnimationFrame(animationId);

    if (renderer) {
        renderer.dispose();
        const dom = renderer.domElement;
        if (dom && dom.parentNode) dom.parentNode.removeChild(dom);
    }

    scene = null;
    camera = null;
    renderer = null;
    previewGroup = null;
    activePreviewPuzzle = null;
}
