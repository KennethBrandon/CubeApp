import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class StlPainter {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.mesh = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.isPainting = false;
        this.currentTool = 'brush'; // 'brush' or 'replace'

        // State
        this.brushColor = new THREE.Color('#74C947');
        this.brushSize = 0.5;
        this.colorData = null; // Float32Array for colors

        this.init();
        this.setupEvents();
        this.populateModelList();
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x111111);

        // Camera
        this.camera = new THREE.PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
        this.camera.position.set(0, 5, 10);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.mouseButtons = {
            LEFT: null, // We use left click for painting
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.ROTATE
        };

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 10, 7);
        this.scene.add(dirLight);

        const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
        dirLight2.position.set(-5, -5, -5);
        this.scene.add(dirLight2);

        // Grid
        const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
        this.scene.add(gridHelper);

        // Animation Loop
        this.animate();

        // Resize Handler
        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupEvents() {
        // File Input
        document.getElementById('file-input').addEventListener('change', (e) => this.handleFileSelect(e));
        document.getElementById('json-input').addEventListener('change', (e) => this.handleJsonSelect(e));

        // Model Selector
        document.getElementById('model-select').addEventListener('change', (e) => this.handleModelSelect(e));

        // Color Picker
        const colorPicker = document.getElementById('color-picker');
        const colorHex = document.getElementById('color-hex');

        colorPicker.addEventListener('input', (e) => {
            this.brushColor.set(e.target.value);
            colorHex.value = e.target.value.toUpperCase();
            this.updatePaletteSelection(e.target.value);
        });

        colorHex.addEventListener('change', (e) => {
            let val = e.target.value;
            if (!val.startsWith('#')) val = '#' + val;
            if (/^#[0-9A-F]{6}$/i.test(val)) {
                this.brushColor.set(val);
                colorPicker.value = val;
                this.updatePaletteSelection(val);
            }
        });

        // Palette
        document.getElementById('palette-container').addEventListener('click', (e) => {
            if (e.target.dataset.color) {
                const color = e.target.dataset.color;
                this.brushColor.set(color);
                colorPicker.value = color;
                colorHex.value = color;
                this.updatePaletteSelection(color);
            }
        });

        document.getElementById('btn-add-color').addEventListener('click', () => {
            const color = '#' + this.brushColor.getHexString().toUpperCase();
            this.addToPalette(color);
        });

        // Brush Size
        const brushSizeInput = document.getElementById('brush-size');
        const brushSizeVal = document.getElementById('brush-size-val');
        brushSizeInput.addEventListener('input', (e) => {
            this.brushSize = parseFloat(e.target.value);
            brushSizeVal.textContent = this.brushSize.toFixed(1);
            this.updateBrushCursor();
        });

        // Fill All
        document.getElementById('btn-fill-all').addEventListener('click', () => {
            if (this.mesh) {
                const count = this.mesh.geometry.attributes.color.count;
                const r = this.brushColor.r;
                const g = this.brushColor.g;
                const b = this.brushColor.b;

                for (let i = 0; i < count; i++) {
                    this.mesh.geometry.attributes.color.setXYZ(i, r, g, b);
                }
                this.mesh.geometry.attributes.color.needsUpdate = true;
            }
        });

        // Tool Switching
        const btnBrush = document.getElementById('tool-brush');
        const btnReplace = document.getElementById('tool-replace');
        const toolDesc = document.getElementById('tool-desc');

        const setTool = (tool) => {
            this.currentTool = tool;
            if (tool === 'brush') {
                btnBrush.classList.add('bg-blue-600', 'border-blue-500', 'shadow-lg');
                btnBrush.classList.remove('bg-gray-700', 'border-gray-600');
                btnReplace.classList.remove('bg-blue-600', 'border-blue-500', 'shadow-lg');
                btnReplace.classList.add('bg-gray-700', 'border-gray-600');
                toolDesc.textContent = "Click and drag to paint.";
            } else {
                btnReplace.classList.add('bg-blue-600', 'border-blue-500', 'shadow-lg');
                btnReplace.classList.remove('bg-gray-700', 'border-gray-600');
                btnBrush.classList.remove('bg-blue-600', 'border-blue-500', 'shadow-lg');
                btnBrush.classList.add('bg-gray-700', 'border-gray-600');
                toolDesc.textContent = "Click a color on the model to replace ALL instances of it with the current color.";
            }
        };

        btnBrush.addEventListener('click', () => setTool('brush'));
        btnReplace.addEventListener('click', () => setTool('replace'));

        // Export
        document.getElementById('btn-export').addEventListener('click', () => this.exportColors());

        // Mouse Events for Painting
        this.container.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left Click
                if (this.currentTool === 'brush') {
                    this.isPainting = true;
                    this.paint(e);
                } else if (this.currentTool === 'replace') {
                    this.replaceColorAtMouse(e);
                }
            }
        });

        window.addEventListener('mouseup', () => {
            this.isPainting = false;
        });

        this.container.addEventListener('mousemove', (e) => {
            if (this.isPainting) {
                this.paint(e);
            }
            this.updateBrushCursor(e);
        });
    }

    addToPalette(color) {
        const container = document.getElementById('palette-container');
        // Check if exists
        const existing = Array.from(container.children).find(c => c.dataset.color === color);
        if (existing) return;

        const div = document.createElement('div');
        div.className = 'w-8 h-8 rounded cursor-pointer border-2 border-transparent hover:border-white transition';
        div.style.backgroundColor = color;
        div.dataset.color = color;

        // Insert before the button (which is outside this container in HTML, but just append to container)
        container.appendChild(div);
    }

    updatePaletteSelection(color) {
        const container = document.getElementById('palette-container');
        Array.from(container.children).forEach(child => {
            if (child.dataset.color) {
                if (child.dataset.color.toLowerCase() === color.toLowerCase()) {
                    child.classList.remove('border-transparent');
                    child.classList.add('border-white');
                } else {
                    child.classList.add('border-transparent');
                    child.classList.remove('border-white');
                }
            }
        });
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const contents = e.target.result;
            const geometry = new STLLoader().parse(contents);
            this.loadGeometry(geometry);
        };
        reader.readAsArrayBuffer(file);
    }

    async handleModelSelect(event) {
        const filename = event.target.value;
        if (!filename) return;

        const stlPath = `assets/3d/${filename}`;
        const baseName = filename.replace('.stl', '');
        const colorPath = `assets/3d/${baseName}_colors.json`;

        try {
            // Load STL file
            const stlResponse = await fetch(stlPath);
            if (!stlResponse.ok) throw new Error(`Failed to load ${filename}`);

            const stlBuffer = await stlResponse.arrayBuffer();
            const geometry = new STLLoader().parse(stlBuffer);

            // Try to load matching color file
            try {
                const colorResponse = await fetch(colorPath);
                if (colorResponse.ok) {
                    const colorJson = await colorResponse.json();
                    this.colorData = new Float32Array(colorJson);
                    console.log(`Auto-loaded color map: ${baseName}_colors.json`);
                } else {
                    this.colorData = null;
                    console.log('No matching color map found');
                }
            } catch (e) {
                this.colorData = null;
                console.log('No matching color map found');
            }

            this.loadGeometry(geometry);
        } catch (error) {
            console.error('Error loading model:', error);
            alert(`Failed to load ${filename}`);
        }
    }

    handleJsonSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.colorData = new Float32Array(data);
                if (this.mesh) {
                    this.applyColorData();
                }
            } catch (err) {
                console.error("Error parsing JSON:", err);
                alert("Invalid JSON file");
            }
        };
        reader.readAsText(file);
    }

    applyColorData() {
        if (!this.mesh || !this.colorData) return;

        const geometry = this.mesh.geometry;
        const count = geometry.attributes.position.count;

        if (this.colorData.length === count * 3) {
            geometry.setAttribute('color', new THREE.BufferAttribute(this.colorData, 3));
            geometry.attributes.color.needsUpdate = true;

            // Ensure material uses vertex colors
            if (this.mesh.material) {
                this.mesh.material.vertexColors = true;
                this.mesh.material.color.setHex(0xFFFFFF); // Reset base color to white
                this.mesh.material.needsUpdate = true;
            }

            // Extract unique colors and add to palette
            this.extractColorsFromData();
        } else {
            console.warn("Color data length mismatch. Expected:", count * 3, "Got:", this.colorData.length);
            alert("Color data does not match the current model vertex count.");
        }
    }

    extractColorsFromData() {
        if (!this.colorData) return;

        const uniqueColors = new Set();
        const tolerance = 0.01; // Tolerance for considering colors the same

        // Extract all unique colors
        for (let i = 0; i < this.colorData.length; i += 3) {
            const r = this.colorData[i];
            const g = this.colorData[i + 1];
            const b = this.colorData[i + 2];

            // Convert to hex for easier comparison and storage
            const color = new THREE.Color(r, g, b);
            const hexString = '#' + color.getHexString().toUpperCase();

            uniqueColors.add(hexString);
        }

        // Add unique colors to palette
        console.log(`Found ${uniqueColors.size} unique colors in the color map`);
        uniqueColors.forEach(hexColor => {
            this.addToPalette(hexColor);
        });
    }

    loadGeometry(geometry) {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }

        // Center and Rotate (match TheChildMod logic)
        geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);
        geometry.rotateX(-Math.PI / 2);

        // Ensure vertex colors exist
        const count = geometry.attributes.position.count;

        // If we have pre-loaded color data, use it
        if (this.colorData && this.colorData.length === count * 3) {
            geometry.setAttribute('color', new THREE.BufferAttribute(this.colorData, 3));
            // Extract and add colors to palette
            this.extractColorsFromData();
        } else {
            // Initialize with default green
            const colors = new Float32Array(count * 3);
            const defaultColor = new THREE.Color('#74C947');
            for (let i = 0; i < count; i++) {
                colors[i * 3] = defaultColor.r;
                colors[i * 3 + 1] = defaultColor.g;
                colors[i * 3 + 2] = defaultColor.b;
            }
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        }

        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            color: (this.colorData && this.colorData.length === count * 3) ? 0xFFFFFF : 0xFFFFFF, // Always white base if using vertex colors
            roughness: 0.6,
            metalness: 0.4
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);

        // Enable export button
        document.getElementById('btn-export').disabled = false;
    }

    paint(event) {
        if (!this.mesh) return;

        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.mesh);

        if (intersects.length > 0) {
            const hit = intersects[0];
            this.applyPaint(hit.point);
        }
    }

    applyPaint(point) {
        const geometry = this.mesh.geometry;
        const positions = geometry.attributes.position;
        const colors = geometry.attributes.color;
        const brushRadiusSq = this.brushSize * this.brushSize;

        const localPoint = this.mesh.worldToLocal(point.clone());

        // Simple brute force for now - optimize with BVH if needed later
        // Check distance to all vertices
        // Actually, checking all vertices every frame is too slow for high poly STLs.
        // We should use the face index from intersection if possible, but we want a "brush" area.
        // For better performance, we can just iterate over a subset or use a spatial index.
        // But for a simple tool, let's try a slightly optimized approach:
        // Only check vertices if we have a BVH?
        // Or just rely on the fact that STLs usually aren't THAT massive for this use case.
        // Let's implement a simple distance check first.

        // Optimization: Only update if close enough. 
        // Since we don't have a spatial index easily available without three-mesh-bvh (which we have in import map but haven't set up yet),
        // let's try to just color the intersected face and its neighbors?
        // No, user wants a "brush size".

        // Let's use the three-mesh-bvh for efficient spatial queries if we can.
        // But for now, let's just do a simple loop. If it lags, we'll optimize.

        const r = this.brushColor.r;
        const g = this.brushColor.g;
        const b = this.brushColor.b;

        let modified = false;

        for (let i = 0; i < positions.count; i++) {
            const dx = positions.getX(i) - localPoint.x;
            const dy = positions.getY(i) - localPoint.y;
            const dz = positions.getZ(i) - localPoint.z;

            if (dx * dx + dy * dy + dz * dz < brushRadiusSq) {
                colors.setXYZ(i, r, g, b);
                modified = true;
            }
        }

        if (modified) {
            colors.needsUpdate = true;
        }
    }

    replaceColorAtMouse(event) {
        if (!this.mesh) return;

        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.mesh);

        if (intersects.length > 0) {
            // Get the color at the intersection point
            // Since we are using vertex colors, we need to find the closest vertex or interpolate.
            // For simplicity, let's just find the closest vertex to the intersection point.

            const hit = intersects[0];
            const localPoint = this.mesh.worldToLocal(hit.point.clone());
            const positions = this.mesh.geometry.attributes.position;
            const colors = this.mesh.geometry.attributes.color;

            let closestIdx = -1;
            let minDistSq = Infinity;

            // Optimization: We could search only the face vertices, but STLs are triangle soup.
            // The hit.face object gives us a, b, c indices.
            if (hit.face) {
                // Check the 3 vertices of the face
                const indices = [hit.face.a, hit.face.b, hit.face.c];
                for (let idx of indices) {
                    const dx = positions.getX(idx) - localPoint.x;
                    const dy = positions.getY(idx) - localPoint.y;
                    const dz = positions.getZ(idx) - localPoint.z;
                    const dSq = dx * dx + dy * dy + dz * dz;
                    if (dSq < minDistSq) {
                        minDistSq = dSq;
                        closestIdx = idx;
                    }
                }
            }

            if (closestIdx !== -1) {
                const targetR = colors.getX(closestIdx);
                const targetG = colors.getY(closestIdx);
                const targetB = colors.getZ(closestIdx);

                this.replaceColor(targetR, targetG, targetB);
            }
        }
    }

    replaceColor(r, g, b) {
        const colors = this.mesh.geometry.attributes.color;
        const count = colors.count;
        const tolerance = 0.01; // Small tolerance for float comparison

        const newR = this.brushColor.r;
        const newG = this.brushColor.g;
        const newB = this.brushColor.b;

        let modified = false;

        for (let i = 0; i < count; i++) {
            const cr = colors.getX(i);
            const cg = colors.getY(i);
            const cb = colors.getZ(i);

            if (Math.abs(cr - r) < tolerance &&
                Math.abs(cg - g) < tolerance &&
                Math.abs(cb - b) < tolerance) {

                colors.setXYZ(i, newR, newG, newB);
                modified = true;
            }
        }

        if (modified) {
            colors.needsUpdate = true;
            // alert("Color replaced!");
        }
    }

    updateBrushCursor(event) {
        // Optional: Add a visual cursor ring
    }

    exportColors() {
        if (!this.mesh) return;

        const colors = this.mesh.geometry.attributes.color.array;
        // We can just save the float array directly, or convert to a more compact format.
        // A simple JSON array of RGB values is fine, or even a binary file.
        // JSON is easier to debug.

        // To save space, we could maybe just save unique colors and an index map?
        // Or just the raw array.
        // The array is [r,g,b, r,g,b, ...]
        // Let's save it as a simple array.

        const data = Array.from(colors);
        const json = JSON.stringify(data);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'baby_yoda_colors.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    onWindowResize() {
        if (!this.camera || !this.renderer) return;
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        if (this.controls) this.controls.update();
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    async populateModelList() {
        const select = document.getElementById('model-select');

        try {
            // Fetch the directory listing
            const response = await fetch('assets/3d/');
            const text = await response.text();

            // Parse HTML to extract .stl files
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const links = doc.querySelectorAll('a');

            const stlFiles = [];
            links.forEach(link => {
                const href = link.getAttribute('href');
                if (href && href.endsWith('.stl')) {
                    stlFiles.push(href);
                }
            });

            // Clear existing options except the first one
            while (select.options.length > 1) {
                select.remove(1);
            }

            // Add STL files to dropdown
            stlFiles.forEach(filename => {
                const option = document.createElement('option');
                option.value = filename;
                // Create a nice display name from filename
                const displayName = filename.replace('.stl', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                option.textContent = displayName;
                select.appendChild(option);
            });

            console.log(`Loaded ${stlFiles.length} STL files`);
        } catch (error) {
            console.error('Failed to load model list:', error);
            // Fallback: keep hardcoded options if directory listing fails
        }
    }
}

new StlPainter();
