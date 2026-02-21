/**
 * Renderer.js — Three.js Scene Management
 * 
 * Geom-aware renderer. Reads MuJoCo geom types and creates
 * matching Three.js geometries with correct sizes and colors.
 * 
 * Design:
 * - initScene() creates meshes from geom metadata (called on model load)
 * - update() applies geom positions/rotations (called each frame)
 * - dispose() cleans up all GPU resources
 * - No allocations in the update() path
 */
import * as THREE from '../../vendor/three.0.160.0.module.js';

// MuJoCo geom type constants
const GEOM_PLANE = 0;
const GEOM_HFIELD = 1;
const GEOM_SPHERE = 2;
const GEOM_CAPSULE = 3;
const GEOM_ELLIPSOID = 4;
const GEOM_CYLINDER = 5;
const GEOM_BOX = 6;

export class Renderer {
    /**
     * @param {HTMLCanvasElement} canvas
     */
    constructor(canvas) {
        this.canvas = canvas;

        // Three.js core objects
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            50,
            canvas.clientWidth / canvas.clientHeight,
            0.05, 200
        );
        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: false
        });

        // Mesh storage: geom index → Three.js Mesh
        this.meshes = new Map();

        this._setupDefaults();
    }

    _setupDefaults() {
        // Dark scene
        this.scene.background = new THREE.Color(0x0d1117);
        this.scene.fog = new THREE.FogExp2(0x0d1117, 0.02);

        // Renderer settings
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;

        // Lighting
        const ambient = new THREE.AmbientLight(0x404060, 1.5);
        this.scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xffeedd, 2.5);
        sun.position.set(5, -8, 12);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 50;
        sun.shadow.camera.left = -15;
        sun.shadow.camera.right = 15;
        sun.shadow.camera.top = 15;
        sun.shadow.camera.bottom = -15;
        this.scene.add(sun);

        const fill = new THREE.DirectionalLight(0x8899cc, 0.8);
        fill.position.set(-3, 4, 5);
        this.scene.add(fill);

        // Default camera
        this.camera.position.set(3, -5, 4);
        this.camera.up.set(0, 0, 1);
        this.camera.lookAt(0, 0, 0.5);

        // Grid floor
        const grid = new THREE.GridHelper(30, 30, 0x333355, 0x1a1a33);
        grid.rotation.x = Math.PI / 2;
        this.scene.add(grid);
        this._grid = grid;

        window.addEventListener('resize', () => this.onResize());
    }

    /**
     * Build Three.js meshes from geom metadata.
     * Call this after every model load.
     * @param {Array<{ index, type, size, rgba }>} geomMeta
     */
    initScene(geomMeta) {
        // Dispose old meshes
        this.disposeMeshes();

        for (const g of geomMeta) {
            const geometry = this._createGeometry(g.type, g.size);
            if (!geometry) continue; // Skip unsupported types (plane, hfield)

            const material = new THREE.MeshStandardMaterial({
                color: new THREE.Color(g.rgba[0], g.rgba[1], g.rgba[2]),
                transparent: g.rgba[3] < 1.0,
                opacity: g.rgba[3],
                roughness: 0.35,
                metalness: 0.15,
                envMapIntensity: 0.5
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.matrixAutoUpdate = false; // We set matrix manually

            this.scene.add(mesh);
            this.meshes.set(g.index, mesh);
        }
    }

    /**
     * Create Three.js geometry from MuJoCo geom type and size.
     * @param {number} type - MuJoCo geom type enum
     * @param {number[]} size - [s0, s1, s2] MuJoCo size params
     * @returns {THREE.BufferGeometry|null}
     */
    _createGeometry(type, size) {
        switch (type) {
            case GEOM_SPHERE:
                return new THREE.SphereGeometry(size[0], 24, 16);

            case GEOM_BOX:
                return new THREE.BoxGeometry(size[0] * 2, size[1] * 2, size[2] * 2);

            case GEOM_CAPSULE:
                // Three.js CapsuleGeometry: radius, length (between hemispheres)
                return new THREE.CapsuleGeometry(size[0], size[1] * 2, 8, 16);

            case GEOM_CYLINDER:
                return new THREE.CylinderGeometry(size[0], size[0], size[1] * 2, 16);

            case GEOM_ELLIPSOID:
                // Approximate with a scaled sphere
                const ellipGeo = new THREE.SphereGeometry(1, 24, 16);
                ellipGeo.scale(size[0], size[1], size[2]);
                return ellipGeo;

            case GEOM_PLANE:
                // Render as large flat plane
                const planeGeo = new THREE.PlaneGeometry(40, 40);
                return planeGeo;

            case GEOM_HFIELD:
            default:
                return null;
        }
    }

    /**
     * Update mesh transforms from simulation state.
     * ZERO ALLOCATIONS — only writes to existing matrix.
     * @param {Array<{ index, pos, mat }>} geomStates
     */
    update(geomStates) {
        for (const g of geomStates) {
            const mesh = this.meshes.get(g.index);
            if (!mesh) continue;

            const m = g.mat;
            const p = g.pos;

            // MuJoCo row-major 3x3 → Three.js column-major 4x4
            mesh.matrix.set(
                m[0], m[3], m[6], p[0],
                m[1], m[4], m[7], p[1],
                m[2], m[5], m[8], p[2],
                0, 0, 0, 1
            );
        }

        this.renderer.render(this.scene, this.camera);
    }

    /** Dispose all geom meshes (but keep lights, grid). */
    disposeMeshes() {
        this.meshes.forEach(mesh => {
            this.scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        });
        this.meshes.clear();
    }

    /** Handle window resize. */
    onResize() {
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h, false);
    }

    /** Full cleanup. */
    dispose() {
        this.disposeMeshes();
        this.renderer.dispose();
    }
}
