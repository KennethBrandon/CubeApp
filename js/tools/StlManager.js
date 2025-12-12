import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Brush, Evaluator, INTERSECTION } from 'three-bvh-csg';
import { MeshBVH } from 'three-mesh-bvh';
import { CUBE_SIZE } from '../shared/constants.js';

class StlManager {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.mesh = null;
        this.originalGeometry = null; // Store base geometry to re-apply transforms
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.isPainting = false;
        this.currentTool = 'brush'; // 'brush' or 'replace'

        // State
        this.config = {
            id: null,
            name: '',
            dimensions: { x: 2, y: 2, z: 2 },
            transform: {
                rotation: { x: -90, y: 0, z: 0 }, // Euler values in degrees
                scale: 3.35,
                offset: { x: 0, y: 0, z: 0 }
            },
            cut: {
                filletRadius: 0.14
            },
            material: {
                roughness: 0.6,
                metalness: 0.0,
                normalScale: 0.5,
                useSparkle: true
            },
            stlData: null, // Base64 string of STL
            colorData: null // Array of vertex colors
        };

        this.generatedCubies = []; // Store generated results

        this.brushColor = new THREE.Color('#74C947');
        this.brushSize = 0.5;

        this.init();
        this.setupEvents();
        this.loadPuzzleList();
        this.loadRegistry();
    }

    init() {
        // Scene setup
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
        this.controls.mouseButtons = {
            LEFT: null, // Custom for painting
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.ROTATE
        };

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 10, 7);
        this.scene.add(dirLight);
        this.scene.add(new THREE.DirectionalLight(0xffffff, 0.4).translateZ(-5));

        // Grid
        this.scene.add(new THREE.GridHelper(20, 20, 0x444444, 0x222222));

        // Box Outline (Visual guide for puzzle bounds)
        this.updateBoundsGuide();

        this.animate();
        window.addEventListener('resize', () => {
            this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        });
    }

    updateBoundsGuide() {
        if (this.boundsGuide) {
            this.scene.remove(this.boundsGuide);
            this.boundsGuide = null;
        }
        if (this.gridGuide) {
            this.scene.remove(this.gridGuide); // Clean up old group
            this.gridGuide = null;
        }

        // Logic mirrors StlPuzzleMod.js cut generation
        const UNIT = CUBE_SIZE;
        const dim = this.config.dimensions;
        const fillet = this.config.cut.filletRadius || 0;

        this.gridGuide = new THREE.Group();

        // Reusing geometry if possible would be good, but bounds might be adaptive in future?
        // For now, uniform size is fine for visual guide.
        // Actually, let's use the exact UNIT size.
        let boxGeo;
        if (fillet > 0) {
            boxGeo = new RoundedBoxGeometry(UNIT, UNIT, UNIT, 4, fillet);
        } else {
            boxGeo = new THREE.BoxGeometry(UNIT, UNIT, UNIT);
        }

        const edgesGeo = new THREE.EdgesGeometry(boxGeo);
        const material = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3 });

        // Helper to get range centered
        const getRange = (size) => {
            const range = [];
            const offset = (size - 1) / 2;
            for (let i = 0; i < size; i++) {
                range.push(i - offset);
            }
            return range;
        };

        const xRange = getRange(dim.x);
        const yRange = getRange(dim.y);
        const zRange = getRange(dim.z);

        for (let x of xRange) {
            for (let y of yRange) {
                for (let z of zRange) {
                    const lines = new THREE.LineSegments(edgesGeo, material);
                    lines.position.set(x * UNIT, y * UNIT, z * UNIT);
                    this.gridGuide.add(lines);
                }
            }
        }

        this.scene.add(this.gridGuide);

        // Add outer bounds box specifically for the "whole" puzzle? 
        // Maybe unnecessary if the grid is dense. 
        // Let's keep it simple: just the cut grid.
    }

    setupEvents() {
        // File Input
        document.getElementById('file-input').addEventListener('change', (e) => this.handleFileSelect(e));

        // Puzzle Name
        document.getElementById('puzzle-name').addEventListener('input', (e) => {
            this.config.name = e.target.value;
            this.checkSaveEnabled();
        });

        // Save / Export Buttons
        document.getElementById('btn-save').addEventListener('click', () => this.saveDraft());
        document.getElementById('btn-export').addEventListener('click', () => this.exportAssets());

        // New Puzzle Button
        document.getElementById('btn-new-puzzle').addEventListener('click', () => this.resetWorkspace());

        // Dimensions
        ['x', 'y', 'z'].forEach(axis => {
            document.getElementById(`dim-${axis}`).addEventListener('change', (e) => {
                this.config.dimensions[axis] = parseInt(e.target.value);
                this.updateBoundsGuide();
            });
        });

        // Transform Controls
        const bindSlider = (id, getObj, key, displayId) => {
            const slider = document.getElementById(id);
            const input = document.getElementById(displayId);

            // Slider -> Input & Config
            slider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                getObj()[key] = val;
                input.value = val;
                input.dispatchEvent(new Event('change')); // Trigger any input logic if needed
                this.updateMeshTransform();
            });

            // Input -> Slider & Config
            input.addEventListener('change', (e) => {
                let val = parseFloat(e.target.value);
                if (isNaN(val)) val = parseFloat(slider.getAttribute('value')); // Sanity check

                // Clamp? Maybe let users go beyond slider bounds if they want?
                // Let's at least respect min/max of slider IF meaningful, but for infinite rotation allow it?
                // Actually slider max limits visual slider, but config can go beyond.
                // Let's just update slider visual if within range.

                if (val < parseFloat(slider.min)) val = parseFloat(slider.min);
                if (val > parseFloat(slider.max)) {
                    // If it's rotation, maybe wrap? No, just let it be.
                    // For slider display, clamp it.
                    slider.value = slider.max;
                } else {
                    slider.value = val;
                }

                // But store actual value? 
                // Let's strict clamp to slider range to avoid confusion for now, user can increase range if needed request.
                // Or better, update slider to val but if out of bounds, slider sticks to end.
                // But we want WYSIWYG. Let's clamp to max of slider for UI consistency.
                if (val > parseFloat(slider.max)) val = parseFloat(slider.max);

                input.value = val;
                getObj()[key] = val;
                slider.value = val;
                this.updateMeshTransform();
            });
        };

        bindSlider('inp-rotX', () => this.config.transform.rotation, 'x', 'val-rotX');
        bindSlider('inp-rotY', () => this.config.transform.rotation, 'y', 'val-rotY');
        bindSlider('inp-rotZ', () => this.config.transform.rotation, 'z', 'val-rotZ');
        bindSlider('inp-scale', () => this.config.transform, 'scale', 'val-scale');
        bindSlider('inp-offX', () => this.config.transform.offset, 'x', 'val-offX');
        bindSlider('inp-offY', () => this.config.transform.offset, 'y', 'val-offY');
        bindSlider('inp-offZ', () => this.config.transform.offset, 'z', 'val-offZ');

        // Cut Settings
        bindSlider('inp-fillet', () => this.config.cut, 'filletRadius', 'val-fillet');
        const updateFillet = () => this.updateBoundsGuide();
        document.getElementById('inp-fillet').addEventListener('input', updateFillet);
        document.getElementById('val-fillet').addEventListener('change', updateFillet);

        // Material Settings
        bindSlider('inp-roughness', () => this.config.material, 'roughness', 'val-roughness');
        bindSlider('inp-metalness', () => this.config.material, 'metalness', 'val-metalness');
        bindSlider('inp-normalScale', () => this.config.material, 'normalScale', 'val-normalScale');

        ['inp-roughness', 'val-roughness', 'inp-metalness', 'val-metalness', 'inp-normalScale', 'val-normalScale'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.updateMeshMaterial());
            document.getElementById(id).addEventListener('change', () => this.updateMeshMaterial());
        });

        const chkSparkle = document.getElementById('chk-sparkle');
        chkSparkle.addEventListener('change', (e) => {
            this.config.material.useSparkle = e.target.checked;
            this.updateMeshMaterial();
        });

        // Paint Controls
        const colorPicker = document.getElementById('color-picker');
        const colorHex = document.getElementById('color-hex');

        colorPicker.addEventListener('input', (e) => {
            this.brushColor.set(e.target.value);
            colorHex.value = e.target.value.toUpperCase();
        });

        // Bind Brush Slider manually as it's not in 'config.transform' object structure
        const brushSlider = document.getElementById('inp-brush');
        const brushInput = document.getElementById('val-brush');

        brushSlider.addEventListener('input', (e) => {
            this.brushSize = parseFloat(e.target.value);
            brushInput.value = this.brushSize;
        });

        brushInput.addEventListener('change', (e) => {
            let val = parseFloat(e.target.value);
            if (val < 0.1) val = 0.1;
            if (val > 10) val = 10;
            this.brushSize = val;
            brushInput.value = val;
            brushSlider.value = val;
        });

        document.getElementById('tool-fill').addEventListener('click', () => this.fillAll());

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

        // Palette Controls
        document.getElementById('btn-add-palette').addEventListener('click', () => this.addToPalette(this.brushColor.getHexString()));
        document.getElementById('btn-clear-palette').addEventListener('click', () => {
            if (confirm('Clear saved palette?')) {
                localStorage.removeItem('stl_palette');
                this.renderPalette();
            }
        });

        this.renderPalette();

        // Generation Controls
        const btnGen = document.getElementById('btn-generate');
        const btnExportBin = document.getElementById('btn-export-binary');
        if (btnGen) btnGen.addEventListener('click', () => this.generateCubies());
        if (btnExportBin) btnExportBin.addEventListener('click', () => this.exportGeneratedAssets());

        // Import Controls
        document.getElementById('btn-import-config').addEventListener('click', () => document.getElementById('file-input-config').click());
        document.getElementById('file-input-config').addEventListener('change', (e) => this.handleConfigFileSelect(e));

        document.getElementById('btn-import-colors').addEventListener('click', () => document.getElementById('file-input-colors').click());
        document.getElementById('file-input-colors').addEventListener('change', (e) => this.handleColorFileSelect(e));

        // Mouse Events
        this.container.addEventListener('mousedown', (e) => {
            if (e.button === 0 && this.mesh) {
                if (this.currentTool === 'brush') {
                    this.isPainting = true;
                    this.paint(e);
                } else if (this.currentTool === 'replace') {
                    this.replaceColorAtMouse(e);
                }
            }
        });
        window.addEventListener('mouseup', () => this.isPainting = false);
        this.container.addEventListener('mousemove', (e) => {
            if (this.isPainting && this.currentTool === 'brush') this.paint(e);
        });
    }

    addToPalette(hex) {
        const palette = JSON.parse(localStorage.getItem('stl_palette') || '[]');
        const color = hex.startsWith('#') ? hex : '#' + hex;
        // Normalize
        const normalized = color.toUpperCase();

        // Avoid duplicates
        if (!palette.includes(normalized)) {
            palette.push(normalized);
            localStorage.setItem('stl_palette', JSON.stringify(palette));
            this.renderPalette();
        }
    }

    extractColorsFromData(colorData) {
        if (!colorData) return;
        const uniqueColors = new Set();
        const len = colorData.length;

        // Sample every vertex? Or all? All is safer for small meshes, checking millions might be slow.
        // But palette extraction runs once on load. It should be fine.

        for (let i = 0; i < len; i += 3) {
            const r = colorData[i];
            const g = colorData[i + 1];
            const b = colorData[i + 2];

            // Convert to hex
            // We can use THREE.Color to be safe
            const c = new THREE.Color(r, g, b);
            uniqueColors.add(c.getHexString().toUpperCase());
        }



        // Add to palette (limit to avoid storage overflow if something goes wrong?)
        // Let's cap it reasonably or just trust the user.
        if (uniqueColors.size > 50) {
            if (!confirm(`Found ${uniqueColors.size} unique colors. Add all to palette?`)) return;
        }

        const palette = JSON.parse(localStorage.getItem('stl_palette') || '[]');
        let modified = false;

        uniqueColors.forEach(hex => {
            const fullHex = '#' + hex;
            if (!palette.includes(fullHex)) {
                palette.push(fullHex);
                modified = true;
            }
        });

        if (modified) {
            localStorage.setItem('stl_palette', JSON.stringify(palette));
            this.renderPalette();
        }
    }

    renderPalette() {
        const container = document.getElementById('palette-container');
        const palette = JSON.parse(localStorage.getItem('stl_palette') || '[]');
        container.innerHTML = '';

        palette.forEach(color => {
            const div = document.createElement('div');
            div.className = 'w-5 h-5 rounded cursor-pointer border border-gray-600 hover:scale-110 transition';
            div.style.backgroundColor = color;
            div.title = color;
            div.onclick = () => this.setBrushColor(color);
            container.appendChild(div);
        });
    }

    setBrushColor(colorStr) {
        this.brushColor.set(colorStr);
        document.getElementById('color-picker').value = '#' + this.brushColor.getHexString();
        document.getElementById('color-hex').value = '#' + this.brushColor.getHexString().toUpperCase();
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Reset config (except dimensions might stay?)
        // Let's reset full config for new file, but keep dimensions? 
        // Better to act like a fresh load.

        // Read as ArrayBuffer for geometry
        const reader = new FileReader();
        const lowerName = file.name.toLowerCase();

        reader.onload = async (e) => {
            const buffer = e.target.result;
            let geometry;

            if (lowerName.endsWith('.3mf')) {
                const loader = new ThreeMFLoader();
                const group = loader.parse(buffer);

                // 3MF returns a Group with meshes. We need to extracting a single geometry.
                // If it's a single mesh, easy. If multiple, we should merge or prompt?
                // For simplicity, let's fast-merge all meshes in the group.

                const geometries = [];
                group.traverse(child => {
                    if (child.isMesh) {
                        child.geometry.computeVertexNormals(); // Ensure normals
                        // Apply local matrix to geometry if needed, but usually loader applies it to mesh
                        // We need to bake the child's world matrix (relative to group root) into the geometry
                        // But traverse visits children.
                        // Let's assume flat structure or apply transforms.

                        child.updateMatrixWorld(); // Update local against parent (group is at 0,0,0)

                        const g = child.geometry.clone();
                        g.applyMatrix4(child.matrix); // Bake local transform (since group is root)
                        geometries.push(g);
                    }
                });

                if (geometries.length === 0) {
                    alert('No meshes found in 3MF file.');
                    return;
                } else if (geometries.length === 1) {
                    geometry = geometries[0];
                } else {
                    // Merge
                    // Use standard BufferGeometryUtils if available, but we don't have it imported.
                    // Let's manually merge simplified or just take the first one?
                    // Merging is better.
                    // Wait, we don't have BufferGeometryUtils imported.
                    // Let's import it dynamically or just take the biggest one?
                    // Or implementing a simple merge.


                    // Naive merge requires matching attributes.
                    // Let's warn user and take first for now, or assume compatible?
                    // Let's try to import BufferGeometryUtils if possible.
                    // Check import map: three/addons/utils/BufferGeometryUtils.js exists usually.

                    try {
                        const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');
                        geometry = mergeGeometries(geometries);
                    } catch (err) {
                        console.warn('BufferGeometryUtils not found, taking first mesh.', err);
                        geometry = geometries[0];
                    }
                }

            } else {
                // STL
                geometry = new STLLoader().parse(buffer);
            }

            if (geometry) this.loadGeometry(geometry);

            // ALSO Read as Base64 for saving
            const reader64 = new FileReader();
            reader64.onload = (e64) => {
                this.config.stlData = e64.target.result; // Data URL (works for any file type actually)
                // Note: STLLoader.parse expects binary STL or ASCII. loadGeometry handles it.
                // 3MF support in parsing from "stlData" string property later?
                // this.config.stlData is just the raw file as Base64.
                // loadPuzzle decodes it to ArrayBuffer and parses it.
                // valid for 3MF too if we update loadPuzzle.

                this.config.fileType = lowerName.endsWith('.3mf') ? '3mf' : 'stl'; // Store type
                this.checkSaveEnabled();
            };
            reader64.readAsDataURL(file);
        };
        reader.readAsArrayBuffer(file);

        // Auto-set name if empty
        const nameInput = document.getElementById('puzzle-name');
        if (!nameInput.value) {
            nameInput.value = file.name.replace(/\.(stl|3mf)$/i, '').replace(/_/g, ' ');
            this.config.name = nameInput.value;
        }

        // Enable config panel ALWAYS
        const panel = document.getElementById('config-panel');
        if (panel) panel.classList.remove('opacity-50', 'pointer-events-none');
    }

    handleConfigFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Ensure panel is unlocked if loading config first (for whatever reason)
        const panel = document.getElementById('config-panel');
        if (panel) panel.classList.remove('opacity-50', 'pointer-events-none');

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const config = JSON.parse(e.target.result);

                // Update Config State
                if (config.dimensions) this.config.dimensions = { ...config.dimensions };
                if (config.transform) {
                    // Deep merge transform to avoid losing structure if partial
                    if (config.transform.rotation) this.config.transform.rotation = { ...config.transform.rotation };
                    if (config.transform.offset) this.config.transform.offset = { ...config.transform.offset };
                    if (typeof config.transform.scale === 'number') this.config.transform.scale = config.transform.scale;
                }
                if (config.cut) this.config.cut = { ...config.cut };
                if (config.material) this.config.material = { ...config.material };

                // Update UI Inputs
                const setVal = (id, val) => {
                    const el = document.getElementById(id);
                    if (el) el.value = val;
                };

                setVal('dim-x', this.config.dimensions.x);
                setVal('dim-y', this.config.dimensions.y);
                setVal('dim-z', this.config.dimensions.z);

                setVal('inp-rotX', this.config.transform.rotation.x);
                setVal('val-rotX', this.config.transform.rotation.x);
                setVal('inp-rotY', this.config.transform.rotation.y);
                setVal('val-rotY', this.config.transform.rotation.y);
                setVal('inp-rotZ', this.config.transform.rotation.z);
                setVal('val-rotZ', this.config.transform.rotation.z);

                setVal('inp-scale', this.config.transform.scale);
                setVal('val-scale', this.config.transform.scale);

                setVal('inp-offX', this.config.transform.offset.x);
                setVal('val-offX', this.config.transform.offset.x);
                setVal('inp-offY', this.config.transform.offset.y);
                setVal('val-offY', this.config.transform.offset.y);
                setVal('inp-offZ', this.config.transform.offset.z);
                setVal('val-offZ', this.config.transform.offset.z);

                setVal('inp-fillet', this.config.cut.filletRadius || 0.14);
                setVal('val-fillet', this.config.cut.filletRadius || 0.14);

                setVal('inp-roughness', this.config.material.roughness !== undefined ? this.config.material.roughness : 0.6);
                setVal('val-roughness', this.config.material.roughness !== undefined ? this.config.material.roughness : 0.6);
                setVal('inp-metalness', this.config.material.metalness !== undefined ? this.config.material.metalness : 0.0);
                setVal('val-metalness', this.config.material.metalness !== undefined ? this.config.material.metalness : 0.0);
                setVal('inp-normalScale', this.config.material.normalScale !== undefined ? this.config.material.normalScale : 0.5);
                setVal('val-normalScale', this.config.material.normalScale !== undefined ? this.config.material.normalScale : 0.5);

                document.getElementById('chk-sparkle').checked = this.config.material.useSparkle !== undefined ? this.config.material.useSparkle : true;

                // Apply Updates
                this.updateBoundsGuide();
                this.updateMeshTransform();
                this.updateMeshMaterial();

                alert('Configuration Imported!');
            } catch (err) {
                console.error(err);
                alert('Invalid Config JSON.');
            }
            // Clear input
            event.target.value = '';
        };
        reader.readAsText(file);
    }

    handleColorFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!this.mesh) {
            alert('Please load a model first.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const colorData = JSON.parse(e.target.result);
                const colors = this.mesh.geometry.attributes.color;

                if (!Array.isArray(colorData)) throw new Error('Color data must be an array.');

                if (colorData.length === colors.count * 3) {
                    colors.set(new Float32Array(colorData));
                    colors.needsUpdate = true;
                    // Also update internal state so it saves
                    this.config.colorData = colorData;
                    this.extractColorsFromData(colorData);
                    alert('Colors Imported!');
                } else {
                    alert(`Vertex count mismatch!\nModel: ${colors.count}\nFile: ${colorData.length / 3}\n\nMake sure this color file belongs to this exact model geometry.`);
                }
            } catch (err) {
                console.error(err);
                alert('Invalid Color JSON.');
            }
            // Clear input
            event.target.value = '';
        };
        reader.readAsText(file);
    }

    loadGeometry(geometry) {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
        }

        // Apply default colors (Green)
        const count = geometry.attributes.position.count;
        const colors = new Float32Array(count * 3);
        const color = new THREE.Color('#74C947');
        for (let i = 0; i < count; i++) {
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        this.originalGeometry = geometry.clone(); // Clone to keep untransformed version if needed? 
        // Actually, for "visual" transform adjustment, we usually modify the mesh.scale/position/rotation
        // BUT for the puzzle logic later, we might need to bake it.
        // For StlPainter, we baked it.
        // Let's use the Mesh properties for visual feedback, and apply them physically only if needed,
        // OR just apply them to geometry every frame/change (might be slow).
        // Best approach: Use Mesh properties for transform sliders. 
        // EXCEPT: The "Pre-rotation" is usually fixing coordinate system (X vs Y up).
        // Let's center the geometry first.

        geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);

        // Generate UVs for normal map (box projection)
        this.applyBoxUV(geometry);
        // Correct standard STL orientation (often Z-up vs Y-up) is handled by pre-rotation slider

        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: this.config.material.roughness,
            metalness: this.config.material.metalness
        });

        if (this.config.material.useSparkle) {
            if (!this.sparkleMap) this.sparkleMap = createSparkleMap();
            material.normalMap = this.sparkleMap;
            material.normalScale.set(this.config.material.normalScale, this.config.material.normalScale);
        }

        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);

        this.updateMeshTransform();
    }

    updateMeshTransform() {
        if (!this.mesh) return;

        // We want to apply: Rotation -> Scale -> Offset

        // Reset matrix
        this.mesh.position.set(0, 0, 0);
        this.mesh.rotation.set(0, 0, 0);
        this.mesh.scale.set(1, 1, 1);

        // 1. Rotation 
        // Apply Euler rotation (order XYZ is default, which is usually fine, or we can specify)
        const rad = Math.PI / 180;
        this.mesh.rotation.set(
            this.config.transform.rotation.x * rad,
            this.config.transform.rotation.y * rad,
            this.config.transform.rotation.z * rad
        );

        // 2. Scale
        const s = this.config.transform.scale;
        this.mesh.scale.set(s, s, s);

        // 3. Offset
        const o = this.config.transform.offset;
        this.mesh.position.set(o.x, o.y, o.z);
    }

    updateMeshMaterial() {
        if (!this.mesh || !this.mesh.material) return;

        const mat = this.mesh.material;
        const cfg = this.config.material;

        mat.roughness = cfg.roughness;
        mat.metalness = cfg.metalness;

        if (cfg.useSparkle) {
            if (!this.sparkleMap) this.sparkleMap = createSparkleMap();
            mat.normalMap = this.sparkleMap;
            mat.normalScale.set(cfg.normalScale, cfg.normalScale);
        } else {
            mat.normalMap = null;
        }

        mat.needsUpdate = true;
    }

    paint(event) {
        if (!this.mesh) return;

        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.mesh);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            const geom = this.mesh.geometry;
            const pos = geom.attributes.position;
            const colors = geom.attributes.color;
            const radiusSq = this.brushSize * this.brushSize;

            // To Local Space
            // Note: Since we are using Mesh transforms (position/scale/rotation), 
            // the Raycaster gives world point. We need local point in geometry space ONCE transforms are accounted.
            // But wait, if we are modifying buffer geometry attributes, we need to be careful if we "baked" transforms.
            // Since we rely on mesh.scale/rotation, worldToLocal will handle it.

            const localPoint = this.mesh.worldToLocal(point.clone());

            let modified = false;
            const r = this.brushColor.r;
            const g = this.brushColor.g;
            const b = this.brushColor.b;

            // Naive loop
            for (let i = 0; i < pos.count; i++) {
                const dx = pos.getX(i) - localPoint.x;
                const dy = pos.getY(i) - localPoint.y;
                const dz = pos.getZ(i) - localPoint.z;

                // Adjust distance check for scale?
                // Visual brush size should be consistent.
                // If mesh is scaled by 3, local coords are small.
                // We should scale radius down by mesh scale, OR scale distances up?
                // Simplest: brushSize is in World Units. localPoint is local.
                // Distance in local space needs to be compared to (brushSize / scale).
                // Assuming uniform scale for simplicity (which it is).
                const s = this.config.transform.scale;
                const scaledRadiusSq = radiusSq / (s * s);

                if (dx * dx + dy * dy + dz * dz < scaledRadiusSq) {
                    colors.setXYZ(i, r, g, b);
                    modified = true;
                }
            }

            if (modified) colors.needsUpdate = true;
        }
    }

    fillAll() {
        if (!this.mesh) return;
        const colors = this.mesh.geometry.attributes.color;
        const r = this.brushColor.r, g = this.brushColor.g, b = this.brushColor.b;
        for (let i = 0; i < colors.count; i++) {
            colors.setXYZ(i, r, g, b);
        }
        colors.needsUpdate = true;
    }

    replaceColorAtMouse(event) {
        if (!this.mesh) return;

        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.mesh);

        if (intersects.length > 0) {
            const hit = intersects[0];
            const localPoint = this.mesh.worldToLocal(hit.point.clone());
            const positions = this.mesh.geometry.attributes.position;
            const colors = this.mesh.geometry.attributes.color;

            let closestIdx = -1;
            let minDistSq = Infinity;

            // Use face indices if available for optimization
            if (hit.face) {
                const indices = [hit.face.a, hit.face.b, hit.face.c];
                for (let idx of indices) {
                    const dx = positions.getX(idx) - localPoint.x;
                    const dy = positions.getY(idx) - localPoint.y;
                    const dz = positions.getZ(idx) - localPoint.z;
                    // Note: 's' scale from config isn't applied here because we are in local space
                    // But we used worldToLocal which accounts for mesh scale. 
                    const dSq = dx * dx + dy * dy + dz * dz;
                    if (dSq < minDistSq) {
                        minDistSq = dSq;
                        closestIdx = idx;
                    }
                }
            } else {
                // Fallback to full search? Should not happen with Mesh raycaster
                console.warn("No face hit?");
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
        if (!this.mesh) return;
        const colors = this.mesh.geometry.attributes.color;
        const count = colors.count;
        const tolerance = 0.01;

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
            this.captureState(); // Update config.colorData
        }
    }

    checkSaveEnabled() {
        const hasData = this.config.name && this.config.stlData;
        document.getElementById('btn-save').disabled = !hasData;
        document.getElementById('btn-export').disabled = !hasData;
    }

    saveDraft() {
        if (!this.config.stlData) return;
        this.captureState();

        // ID generation
        if (!this.config.id) {
            this.config.id = 'draft_' + Date.now();
        }

        try {
            const drafts = JSON.parse(localStorage.getItem('stl_drafts') || '[]');
            const existingIdx = drafts.findIndex(p => p.id === this.config.id);
            if (existingIdx !== -1) drafts.splice(existingIdx, 1);

            drafts.push(this.config);
            localStorage.setItem('stl_drafts', JSON.stringify(drafts));

            alert('Draft Saved to LocalStorage!');
            this.loadPuzzleList();
        } catch (e) {
            console.error(e);
            alert('Failed to save draft. Storage might be full (STL might be too big).');
        }
    }

    async exportAssets() {
        if (!this.config.stlData) return;
        this.captureState();

        const safeName = this.config.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

        // 1. Export Config JSON
        // We strip big data fields for the config release
        const releaseConfig = { ...this.config };
        delete releaseConfig.stlData;
        delete releaseConfig.colorData; // Colors are in separate file
        delete releaseConfig.id;

        // Add references
        releaseConfig.stlPath = `${safeName}.stl`;
        releaseConfig.colorPath = `${safeName}_colors.json`;

        this.downloadFile(JSON.stringify(releaseConfig, null, 2), 'config.json', 'application/json');

        // 2. Export Colors JSON
        if (this.config.colorData) {
            this.downloadFile(JSON.stringify(this.config.colorData), `${safeName}_colors.json`, 'application/json');
        }

        // 3. Export STL (Convert Base64 back to Blob)
        const stlBlob = new Blob([this.dataURLtoBeArrayBuffer(this.config.stlData)], { type: 'application/octet-stream' });
        this.downloadBlob(stlBlob, `${safeName}.stl`);

        alert(`Assets Exported!\n\n1. Create folder: assets/puzzles/${safeName}/\n2. Move these 3 files there.\n3. Add entry to registry.json.`);
    }

    captureState() {
        if (this.mesh) {
            this.config.colorData = Array.from(this.mesh.geometry.attributes.color.array);
        }
    }

    downloadFile(content, filename, type) {
        const blob = new Blob([content], { type: type });
        this.downloadBlob(blob, filename);
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    loadPuzzleList() {
        const list = document.getElementById('puzzle-list');
        list.innerHTML = '';

        const drafts = JSON.parse(localStorage.getItem('stl_drafts') || '[]');

        if (drafts.length === 0) {
            list.innerHTML = '<p class="text-xs text-gray-500 italic text-center py-4">No drafts yet.</p>';
            return;
        }

        drafts.forEach(p => {
            const div = document.createElement('div');
            div.className = "flex justify-between items-center bg-gray-800 p-2 rounded hover:bg-gray-700 cursor-pointer group";
            div.innerHTML = `
                <span class="text-sm font-bold truncate flex-1">${p.name}</span>
                <button class="text-red-500 opacity-0 group-hover:opacity-100 px-2 hover:text-red-400" title="Delete">×</button>
            `;

            div.onclick = (e) => {
                if (e.target.tagName !== 'BUTTON') this.loadPuzzle(p);
            };

            div.querySelector('button').onclick = (e) => {
                e.stopPropagation();
                if (confirm(`Delete "${p.name}"?`)) {
                    this.deletePuzzle(p.id);
                }
            };
            list.appendChild(div);
        });
    }

    deletePuzzle(id) {
        let drafts = JSON.parse(localStorage.getItem('stl_drafts') || '[]');
        drafts = drafts.filter(p => p.id !== id);
        localStorage.setItem('stl_drafts', JSON.stringify(drafts));
        this.loadPuzzleList();
    }

    async loadRegistry() {
        const list = document.getElementById('registry-list');
        try {
            const res = await fetch('assets/puzzles/registry.json');
            const registry = await res.json();

            list.innerHTML = '';
            registry.forEach(p => {
                const div = document.createElement('div');
                div.className = "flex justify-between items-center bg-gray-800 p-2 rounded hover:bg-gray-700 cursor-pointer text-sm font-bold text-gray-300 hover:text-white transition";
                div.textContent = p.name;
                div.onclick = () => this.loadExistingPuzzle(p.id);
                list.appendChild(div);
            });
        } catch (err) {
            console.error(err);
            list.innerHTML = '<p class="text-xs text-red-500 text-center py-4">Failed to load registry.</p>';
        }
    }

    async loadExistingPuzzle(id) {
        if (!confirm('Load existing puzzle? Unsaved changes will be lost.')) return;

        const overlay = document.getElementById('loading-overlay');
        overlay.classList.remove('hidden');

        try {
            const baseUrl = `assets/puzzles/${id}/`;

            // 1. Fetch Config
            // Fallback config if file missing (unlikely for registered puzzles but safe)
            let config = {
                name: id,
                dimensions: { x: 2, y: 2, z: 2 },
                transform: { rotation: { x: 0, y: 0, z: 0 }, scale: 1, offset: { x: 0, y: 0, z: 0 } },
                cut: { filletRadius: 0.14 }
            };

            try {
                const cRes = await fetch(baseUrl + 'config.json');
                if (cRes.ok) config = await cRes.json();
            } catch (e) { console.warn('Config not found, using defaults'); }

            // 2. Load STL
            const stlPath = config.stlPath ? (baseUrl + config.stlPath) : (baseUrl + `${id}.stl`);
            const sRes = await fetch(stlPath);
            if (!sRes.ok) throw new Error('STL file not found');
            const stlBuffer = await sRes.arrayBuffer();

            // Parse STL
            const geometry = new STLLoader().parse(stlBuffer);
            this.loadGeometry(geometry);

            // 3. Load Colors
            const colorPath = config.colorPath ? (baseUrl + config.colorPath) : (baseUrl + `${id}_colors.json`);
            try {
                const coRes = await fetch(colorPath);
                if (coRes.ok) {
                    const colorData = await coRes.json();

                    // Apply colors
                    const colors = this.mesh.geometry.attributes.color;
                    if (colors && colors.count * 3 === colorData.length) {
                        colors.set(new Float32Array(colorData));
                        colors.needsUpdate = true;
                        this.config.colorData = colorData;
                        this.extractColorsFromData(colorData);
                    } else {
                        console.warn('Color data mismatch');
                    }
                }
            } catch (e) { console.warn('Colors not found'); }

            // 4. Update State & UI
            this.config.id = null; // Clear ID so it saves as new draft if saved
            this.config.name = config.name || id;
            if (config.dimensions) this.config.dimensions = config.dimensions;
            if (config.transform) this.config.transform = config.transform;
            if (config.cut) this.config.cut = config.cut;
            if (config.material) {
                // Handle both 'useSparkle' and 'useSparkles' for compatibility
                this.config.material = { ...config.material };
                if (config.material.useSparkles !== undefined && config.material.useSparkle === undefined) {
                    this.config.material.useSparkle = config.material.useSparkles;
                }
            }

            // Store STL Data as Base64 for saving
            // We need to convert buffer to base64 string
            const blob = new Blob([stlBuffer]);
            const reader = new FileReader();
            reader.onload = (e) => {
                this.config.stlData = e.target.result;
                this.checkSaveEnabled();
            };
            reader.readAsDataURL(blob);

            // Update UI fields
            document.getElementById('puzzle-name').value = this.config.name;

            // Helper to update inputs
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) { el.value = val; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); }
            };

            setVal('dim-x', this.config.dimensions.x);
            setVal('dim-y', this.config.dimensions.y);
            setVal('dim-z', this.config.dimensions.z);

            const t = this.config.transform;
            // The sliders need to be updated
            setVal('val-rotX', t.rotation.x); setVal('inp-rotX', t.rotation.x);
            setVal('val-rotY', t.rotation.y); setVal('inp-rotY', t.rotation.y);
            setVal('val-rotZ', t.rotation.z); setVal('inp-rotZ', t.rotation.z);
            setVal('val-scale', t.scale); setVal('inp-scale', t.scale);
            setVal('val-offX', t.offset.x); setVal('inp-offX', t.offset.x);
            setVal('val-offY', t.offset.y); setVal('inp-offY', t.offset.y);
            setVal('val-offZ', t.offset.z); setVal('inp-offZ', t.offset.z);

            setVal('val-fillet', this.config.cut.filletRadius || 0.14);
            setVal('inp-fillet', this.config.cut.filletRadius || 0.14);

            // Material settings
            const mat = this.config.material || { roughness: 0.6, metalness: 0.0, normalScale: 0.5, useSparkle: true };
            setVal('val-roughness', mat.roughness !== undefined ? mat.roughness : 0.6);
            setVal('inp-roughness', mat.roughness !== undefined ? mat.roughness : 0.6);
            setVal('val-metalness', mat.metalness !== undefined ? mat.metalness : 0.0);
            setVal('inp-metalness', mat.metalness !== undefined ? mat.metalness : 0.0);
            setVal('val-normalScale', mat.normalScale !== undefined ? mat.normalScale : 0.5);
            setVal('inp-normalScale', mat.normalScale !== undefined ? mat.normalScale : 0.5);
            document.getElementById('chk-sparkle').checked = mat.useSparkle !== undefined ? mat.useSparkle : true;

            this.updateBoundsGuide();
            this.updateMeshTransform();
            this.updateMeshMaterial();

            // Enable panel
            document.getElementById('config-panel').classList.remove('opacity-50', 'pointer-events-none');

        } catch (err) {
            console.error(err);
            alert('Error loading puzzle: ' + err.message);
        } finally {
            overlay.classList.add('hidden');
        }
    }



    loadPuzzle(savedConfig) {
        this.config = { ...savedConfig };

        // Populate UI
        document.getElementById('puzzle-name').value = this.config.name;
        document.getElementById('dim-x').value = this.config.dimensions.x;
        document.getElementById('dim-y').value = this.config.dimensions.y;
        document.getElementById('dim-z').value = this.config.dimensions.z;

        // Migration for old rotation format
        if (typeof this.config.transform.rotation === 'number') {
            this.config.transform.rotation = { x: -90, y: this.config.transform.rotation, z: 0 };
        }

        // Apply defaults if missing (e.g. if loaded incomplete config)
        if (!this.config.transform.rotation.x && this.config.transform.rotation.x !== 0) this.config.transform.rotation = { x: -90, y: 0, z: 0 };

        document.getElementById('inp-rotX').value = this.config.transform.rotation.x;
        document.getElementById('val-rotX').value = this.config.transform.rotation.x;
        document.getElementById('inp-rotY').value = this.config.transform.rotation.y;
        document.getElementById('val-rotY').value = this.config.transform.rotation.y;
        document.getElementById('inp-rotZ').value = this.config.transform.rotation.z;
        document.getElementById('val-rotZ').value = this.config.transform.rotation.z;

        document.getElementById('inp-scale').value = this.config.transform.scale;
        document.getElementById('val-scale').value = this.config.transform.scale;
        document.getElementById('inp-offX').value = this.config.transform.offset.x;
        document.getElementById('val-offX').value = this.config.transform.offset.x;
        document.getElementById('inp-offY').value = this.config.transform.offset.y;
        document.getElementById('val-offY').value = this.config.transform.offset.y;
        document.getElementById('inp-offZ').value = this.config.transform.offset.z;
        document.getElementById('val-offZ').value = this.config.transform.offset.z;
        document.getElementById('inp-fillet').value = this.config.cut.filletRadius || 0.14;

        // Material UI
        const mat = this.config.material || { roughness: 0.6, metalness: 0, normalScale: 0.5, useSparkle: true };
        this.config.material = mat; // Ensure config has it if missing in draft

        document.getElementById('inp-roughness').value = mat.roughness !== undefined ? mat.roughness : 0.6;
        document.getElementById('val-roughness').value = mat.roughness !== undefined ? mat.roughness : 0.6;
        document.getElementById('inp-metalness').value = mat.metalness !== undefined ? mat.metalness : 0.0;
        document.getElementById('val-metalness').value = mat.metalness !== undefined ? mat.metalness : 0.0;
        document.getElementById('inp-normalScale').value = mat.normalScale !== undefined ? mat.normalScale : 0.5;
        document.getElementById('val-normalScale').value = mat.normalScale !== undefined ? mat.normalScale : 0.5;
        document.getElementById('chk-sparkle').checked = mat.useSparkle !== undefined ? mat.useSparkle : true;

        // Load Geometry
        // Handle STL vs 3MF based on saved type or try catch?
        // We stored config.fileType in new logic, but compatibility?
        const buffer = this.dataURLtoBeArrayBuffer(this.config.stlData);
        let geometry;

        if (this.config.fileType === '3mf') {
            const loader = new ThreeMFLoader();
            const group = loader.parse(buffer);
            // ... same merge logic ... 
            // Duplicate logic? better refactor 'parseGeometry' method.
            this.parseGeometryFromBuffer(buffer, '3mf').then(g => this.loadGeometry(g));
        } else {
            // Default to STL
            geometry = new STLLoader().parse(buffer);
            this.loadGeometry(geometry);
        }

        // Apply saved colors
        if (this.config.colorData && this.mesh) {
            const colors = this.mesh.geometry.attributes.color;
            // Validate length
            if (this.config.colorData.length === colors.count * 3) {
                colors.set(new Float32Array(this.config.colorData));
                colors.needsUpdate = true;
                this.extractColorsFromData(this.config.colorData);
            } else {
                console.warn('Saved color data count mismatch, using defaults.');
            }
        }

        this.checkSaveEnabled();
        document.getElementById('config-panel').classList.remove('opacity-50', 'pointer-events-none');
    }

    deletePuzzle(id) {
        const drafts = JSON.parse(localStorage.getItem('stl_drafts') || '[]');
        const newDrafts = drafts.filter(p => p.id !== id);
        localStorage.setItem('stl_drafts', JSON.stringify(newDrafts));
        this.loadPuzzleList();
    }

    resetWorkspace() {
        this.config.id = null;
        this.config.name = '';
        this.config.stlData = null;
        document.getElementById('puzzle-name').value = '';
        document.getElementById('file-input').value = '';
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh = null;
        }
        document.getElementById('config-panel').classList.add('opacity-50', 'pointer-events-none');
        this.checkSaveEnabled();
    }

    dataURLtoBeArrayBuffer(dataurl) {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime }).arrayBuffer();
    }

    // --- Generation Logic ---

    async generateCubies() {
        if (!this.mesh) {
            alert('Please load a model first.');
            return;
        }

        const btnGen = document.getElementById('btn-generate');
        const btnExport = document.getElementById('btn-export-binary');
        const progressDiv = document.getElementById('gen-progress');
        const countSpan = document.getElementById('gen-count');
        const totalSpan = document.getElementById('gen-total');

        btnGen.disabled = true;
        btnExport.disabled = true;
        progressDiv.classList.remove('hidden');

        try {
            this.generatedCubies = [];

            // 1. Prepare Geometry (Apply current transforms PHYSICALLY to a clone)
            // We need the geometry to match the visual mesh exactly in world space relative to the cut grid.
            // Our Cut Grid is based on CUBE_SIZE * Grid Coord.
            // The Mesh is currently transformed by Mesh Position/Rotation/Scale.

            // To CSG properly:
            // - Create clone of geometry.
            // - Apply scaling/rotation/translation to the GEOMETRY itself.
            // - (Alternatively, put it in a Brush with matrix, but baking is safer for color transfer logic if we do manual raycasting, though CSG handles brush matrix fine).

            // Let's bake it to simplicity.
            const geometry = this.mesh.geometry.clone();

            // Apply Mesh Transforms to Geometry
            this.mesh.updateMatrixWorld();



            geometry.applyMatrix4(this.mesh.matrixWorld);

            // Re-compute normals/bounds
            geometry.computeVertexNormals();
            geometry.computeBoundingBox();


            // Generate UVs if missing (needed for CSG sometimes)
            this.applyBoxUV(geometry);

            // Create Source Brush
            // Ensure connection of color attribute if present on mesh geometry
            const sourceMaterial = new THREE.MeshStandardMaterial({ vertexColors: geometry.attributes.color !== undefined });
            const sourceBrush = new Brush(geometry, sourceMaterial);
            sourceBrush.updateMatrixWorld();

            // BVH for Color Transfer (Insides)
            const sourceBVH = new MeshBVH(geometry);

            const evaluator = new Evaluator();
            evaluator.attributes = ['position', 'normal', 'uv'];
            if (geometry.attributes.color) evaluator.attributes.push('color');

            // Grid Ranges
            // Logic mirrors StlPuzzleMod.js
            const dim = this.config.dimensions;
            const getRange = (size) => {
                const range = [];
                const offset = (size - 1) / 2;
                for (let i = 0; i < size; i++) {
                    range.push(i - offset);
                }
                return range;
            };
            const xRange = getRange(dim.x);
            const yRange = getRange(dim.y);
            const zRange = getRange(dim.z);

            const total = xRange.length * yRange.length * zRange.length;
            totalSpan.textContent = total;

            let processed = 0;
            const fillet = this.config.cut.filletRadius || 0;
            const outerScale = 10.0; // Large bounds for edge pieces

            for (let x of xRange) {
                for (let y of yRange) {
                    for (let z of zRange) {
                        processed++;
                        countSpan.textContent = processed;

                        // Yield to UI
                        await new Promise(r => setTimeout(r, 10));

                        // Define Box
                        const halfSize = CUBE_SIZE / 2;
                        let xMin = -halfSize, xMax = halfSize;
                        let yMin = -halfSize, yMax = halfSize;
                        let zMin = -halfSize, zMax = halfSize;

                        // Expand outer boundaries
                        if (x <= xRange[0]) xMin *= outerScale;
                        if (x >= xRange[xRange.length - 1]) xMax *= outerScale;
                        if (y <= yRange[0]) yMin *= outerScale;
                        if (y >= yRange[yRange.length - 1]) yMax *= outerScale;
                        if (z <= zRange[0]) zMin *= outerScale;
                        if (z >= zRange[zRange.length - 1]) zMax *= outerScale;

                        const w = xMax - xMin;
                        const h = yMax - yMin;
                        const d = zMax - zMin;
                        const xc = (xMin + xMax) / 2;
                        const yc = (yMin + yMax) / 2;
                        const zc = (zMin + zMax) / 2;

                        let boxGeo;
                        if (fillet > 0) boxGeo = new RoundedBoxGeometry(w, h, d, 4, fillet);
                        else boxGeo = new THREE.BoxGeometry(w, h, d);

                        boxGeo.translate(xc, yc, zc);
                        boxGeo = boxGeo.toNonIndexed();

                        // Attributes match
                        const posCount = boxGeo.attributes.position.count;
                        if (geometry.attributes.color) {
                            const boxColors = new Float32Array(posCount * 3).fill(1); // Internal white
                            boxGeo.setAttribute('color', new THREE.BufferAttribute(boxColors, 3));
                        }
                        if (geometry.attributes.uv && !boxGeo.attributes.uv) {
                            boxGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(posCount * 2), 2));
                        }

                        const boxBrush = new Brush(boxGeo);
                        boxBrush.position.set(x * CUBE_SIZE, y * CUBE_SIZE, z * CUBE_SIZE);
                        boxBrush.updateMatrixWorld();

                        const result = evaluator.evaluate(sourceBrush, boxBrush, INTERSECTION);

                        if (result.geometry && result.geometry.attributes.position.count > 0) {
                            const resGeom = result.geometry;

                            // Color Interpolation for Insides
                            // Fixes white faces by mapping to nearest source point
                            if (geometry.attributes.color && resGeom.attributes.color) {
                                this.fixInternalColors(resGeom, geometry, sourceBVH);
                            }

                            // Center geom to local space (0,0,0) relative to cubie center
                            // Result is in World Space (aligned with boxBrush at x*S, y*S...)
                            // We want it local to that position?
                            // Yes, StlPuzzleMod logic positions the group at GridPos, so mesh should be local.
                            resGeom.translate(-x * CUBE_SIZE, -y * CUBE_SIZE, -z * CUBE_SIZE);

                            this.generatedCubies.push({
                                x, y, z,
                                geometry: resGeom
                            });
                        }
                    }
                }
            }

            btnExport.disabled = false;
            alert(`Generated ${this.generatedCubies.length} cubies!`);

        } catch (e) {
            console.error(e);
            alert('Error generating cubies: ' + e.message);
        } finally {
            btnGen.disabled = false;
        }
    }

    fixInternalColors(targetGeo, sourceGeo, bvh) {
        const posAttr = targetGeo.attributes.position;
        const colorAttr = targetGeo.attributes.color;
        const tempVec = new THREE.Vector3();
        const targetColor = new THREE.Color();

        for (let i = 0; i < posAttr.count; i++) {
            tempVec.fromBufferAttribute(posAttr, i);

            const hit = bvh.closestPointToPoint(tempVec);
            if (hit) {
                // Determine if we should override.
                // If it's pure white (from box), we definitely override.
                // If it's already colored (from source surface), we probably keep it?
                // But simplified: Just override everything with nearest surface color. 
                // This ensures continuity and wraps texture around cuts.

                // Interpolate
                const faceIndex = hit.faceIndex;
                const i1 = sourceGeo.index ? sourceGeo.index.getX(faceIndex * 3) : faceIndex * 3;
                const i2 = sourceGeo.index ? sourceGeo.index.getX(faceIndex * 3 + 1) : faceIndex * 3 + 1;
                const i3 = sourceGeo.index ? sourceGeo.index.getX(faceIndex * 3 + 2) : faceIndex * 3 + 2;

                const c1 = new THREE.Color().fromBufferAttribute(sourceGeo.attributes.color, i1);
                const c2 = new THREE.Color().fromBufferAttribute(sourceGeo.attributes.color, i2);
                const c3 = new THREE.Color().fromBufferAttribute(sourceGeo.attributes.color, i3);

                const p1 = new THREE.Vector3().fromBufferAttribute(sourceGeo.attributes.position, i1);
                const p2 = new THREE.Vector3().fromBufferAttribute(sourceGeo.attributes.position, i2);
                const p3 = new THREE.Vector3().fromBufferAttribute(sourceGeo.attributes.position, i3);

                const bary = THREE.Triangle.getBarycoord(hit.point, p1, p2, p3, new THREE.Vector3());

                targetColor.setRGB(
                    c1.r * bary.x + c2.r * bary.y + c3.r * bary.z,
                    c1.g * bary.x + c2.g * bary.y + c3.g * bary.z,
                    c1.b * bary.x + c2.b * bary.y + c3.b * bary.z
                );

                colorAttr.setXYZ(i, targetColor.r, targetColor.g, targetColor.b);
            }
        }
        colorAttr.needsUpdate = true;
    }

    applyBoxUV(geometry) {
        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox;
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const min = bbox.min;
        const pos = geometry.attributes.position;
        const uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);

        const norm = geometry.attributes.normal;

        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z = pos.getZ(i);
            const nx = Math.abs(norm.getX(i));
            const ny = Math.abs(norm.getY(i));
            const nz = Math.abs(norm.getZ(i));
            let u = 0, v = 0;
            if (nx >= ny && nx >= nz) { u = (z - min.z) / size.z; v = (y - min.y) / size.y; }
            else if (ny >= nx && ny >= nz) { u = (x - min.x) / size.x; v = (z - min.z) / size.z; }
            else { u = (x - min.x) / size.x; v = (y - min.y) / size.y; }
            uv.setXY(i, u, v);
        }
        geometry.setAttribute('uv', uv);
    }

    async exportGeneratedAssets() {
        if (this.generatedCubies.length === 0) return;

        const safeName = this.config.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

        let fileCount = 0;

        // 1. Export Config (Binary Mode)
        const exportConfig = {
            ...this.config,
            format: 'binary_v1',
            timestamp: new Date().toISOString()
        };
        // Clean up raw data
        delete exportConfig.stlData;
        delete exportConfig.colorData;

        this.downloadFile(JSON.stringify(exportConfig, null, 2), 'config.json', 'application/json');
        fileCount++;

        // 2. Export Helper for User


        // 3. Export Binaries
        for (const cubie of this.generatedCubies) {
            const buffer = this.geometryToBinary(cubie.geometry);
            const fname = `cubie_${cubie.x}_${cubie.y}_${cubie.z}.bin`;
            this.downloadFile(buffer, fname, 'application/octet-stream');
            fileCount++;
            await new Promise(r => setTimeout(r, 100)); // Delay to prevent browser throttling downloads
        }

        alert(`Exported ${fileCount} files!\n\nPlease move them to: assets/puzzles/${safeName}/cubies/`);
    }

    async parseGeometryFromBuffer(buffer, type) {
        if (type === '3mf') {
            const loader = new ThreeMFLoader();
            const group = loader.parse(buffer);
            const geometries = [];
            group.traverse(child => {
                if (child.isMesh) {
                    child.geometry.computeVertexNormals();
                    child.updateMatrixWorld();
                    const g = child.geometry.clone();
                    g.applyMatrix4(child.matrix);
                    geometries.push(g);
                }
            });

            if (geometries.length === 0) throw new Error("No mesh in 3MF");

            if (geometries.length === 1) return geometries[0];

            try {
                const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');
                return mergeGeometries(geometries);
            } catch (err) {
                console.warn("Merge failed", err);
                return geometries[0];
            }
        }

        return new STLLoader().parse(buffer);
    }

    geometryToBinary(geometry) {
        const posCount = geometry.attributes.position.count;
        const hasUV = !!geometry.attributes.uv;
        const hasColor = !!geometry.attributes.color;

        let totalSize = 6; // header
        totalSize += posCount * 3 * 4; // pos
        totalSize += posCount * 3 * 4; // norm
        if (hasUV) totalSize += posCount * 2 * 4;
        if (hasColor) totalSize += posCount * 3 * 4;

        const buffer = new ArrayBuffer(totalSize);
        const view = new DataView(buffer);
        let offset = 0;

        view.setUint32(offset, posCount, true); offset += 4;
        const flags = (hasUV ? 1 : 0) | (hasColor ? 2 : 0);
        view.setUint16(offset, flags, true); offset += 2;

        const writeAttr = (attr, components) => {
            const arr = attr.array;
            for (let i = 0; i < arr.length; i++) {
                view.setFloat32(offset, arr[i], true);
                offset += 4;
            }
        };

        writeAttr(geometry.attributes.position, 3);
        writeAttr(geometry.attributes.normal, 3);
        if (hasUV) writeAttr(geometry.attributes.uv, 2);
        if (hasColor) writeAttr(geometry.attributes.color, 3);

        return buffer;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        if (this.controls) this.controls.update();
        if (this.renderer) this.renderer.render(this.scene, this.camera);
    }
}

new StlManager();

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
        const strength = 60;
        const noiseX = (Math.random() - 0.5) * strength;
        const noiseY = (Math.random() - 0.5) * strength;

        data[i] = Math.min(255, Math.max(0, 128 + noiseX));
        data[i + 1] = Math.min(255, Math.max(0, 128 + noiseY));
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

    return tex;
}
