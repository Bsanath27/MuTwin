import * as THREE from './vendor/three.0.160.0.module.js';

export class AntigravityRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.meshes = new Map();

        this.init();
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e); // Dark theme
        this.scene.fog = new THREE.Fog(0x1a1a2e, 10, 50);

        // Camera
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, -6, 3);
        this.camera.up.set(0, 0, 1);
        this.camera.lookAt(0, 0, 1);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 2);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 2);
        dirLight.position.set(5, -5, 10);
        dirLight.castShadow = true;
        this.scene.add(dirLight);

        // Floor
        const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
        gridHelper.rotation.x = Math.PI / 2;
        this.scene.add(gridHelper);

        window.addEventListener('resize', () => this.onResize());
    }

    initSceneFromPhysics(metadata) {
        // Clear existing meshes
        this.meshes.forEach(mesh => {
            this.scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        });
        this.meshes.clear();

        // MuJoCo Geom Types: 2: Sphere, 3: Capsule, 5: Cylinder, 6: Box
        metadata.forEach(geom => {
            let geometry;
            const s = geom.size;

            switch (geom.type) {
                case 2: // Sphere
                    geometry = new THREE.SphereGeometry(s[0]);
                    break;
                case 3: // Capsule
                case 5: // Cylinder
                    // MuJoCo cylinder/capsule size is [radius, half_height]
                    // Three.js Cylinder is [radiusTop, radiusBottom, height]
                    geometry = new THREE.CylinderGeometry(s[0], s[0], s[1] * 2);
                    break;
                case 6: // Box
                    // MuJoCo box size is half-lengths [x, y, z]
                    geometry = new THREE.BoxGeometry(s[0] * 2, s[1] * 2, s[2] * 2);
                    break;
                default:
                    // Fallback for others
                    geometry = new THREE.SphereGeometry(Math.max(0.01, s[0]));
            }

            const material = new THREE.MeshStandardMaterial({
                color: new THREE.Color(...geom.rgba.slice(0, 3)),
                transparent: geom.rgba[3] < 1.0,
                opacity: geom.rgba[3],
                roughness: 0.4,
                metalness: 0.6
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            this.scene.add(mesh);
            this.meshes.set(geom.index, mesh);
        });
    }

    render(state) {
        if (!state) return;

        state.geoms.forEach(geomState => {
            const mesh = this.meshes.get(geomState.index);
            if (mesh) {
                mesh.position.set(...geomState.pos);

                // Map MuJoCo 3x3 rotation matrix to Three.js Object3D matrix
                const m = geomState.mat;
                mesh.matrix.set(
                    m[0], m[1], m[2], geomState.pos[0],
                    m[3], m[4], m[5], geomState.pos[1],
                    m[6], m[7], m[8], geomState.pos[2],
                    0, 0, 0, 1
                );
                mesh.matrixAutoUpdate = false;
            }
        });

        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
