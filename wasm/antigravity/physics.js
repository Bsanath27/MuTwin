import loadMujoco from './lib/mujoco_wasm.js';

export class AntigravityPhysics {
    constructor(options = {}) {
        this.mujoco = null;
        this.model = null;
        this.data = null;
        this.gravityOverride = { active: false, value: 0 };
        this.pendingAction = null;
        this.onStage = options.onStage || (() => { });
        this.startupTimings = {};
    }

    async init() {
        try {
            const t0 = performance.now();
            this.onStage('Downloading and compiling MuJoCo WASM...');

            // Add a timeout so we don't hang forever if WASM fails silently
            const initPromise = loadMujoco({
                locateFile: (path) => `lib/${path}`
            });
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('MuJoCo WASM init timed out after 30s')), 30000)
            );
            this.mujoco = await Promise.race([initPromise, timeoutPromise]);

            this.startupTimings.wasmInitMs = performance.now() - t0;
            await this.loadModel('assets/antigravity.xml', { startup: true });
            this.startupTimings.totalPhysicsInitMs = performance.now() - t0;
            console.table(this.startupTimings);
        } catch (e) {
            console.error("Physics initialization failed:", e);
            throw e;
        }
    }

    async loadModel(url, options = {}) {
        if (!this.mujoco) throw new Error("MuJoCo not initialized");
        const t0 = performance.now();
        const stagePrefix = options.startup ? 'Startup' : 'Model Load';

        this.onStage(`${stagePrefix}: fetching XML...`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to load model: ${url}`);
        const xml = await response.text();

        await this.loadModelFromXML(xml, url, options);
    }

    async loadModelFromXML(xml, name = "uploaded.xml", options = {}) {
        if (!this.mujoco) throw new Error("MuJoCo not initialized");
        const t0 = performance.now();
        const stagePrefix = options.startup ? 'Startup' : 'Model Load';

        if (this.model) {
            this.model.delete();
            this.model = null;
        }
        if (this.data) {
            this.data.delete();
            this.data = null;
        }

        try {
            this.mujoco.FS.unlink('temp.xml');
        } catch (e) { }

        this.onStage(`${stagePrefix}: parsing model...`);
        const tParse0 = performance.now();
        this.mujoco.FS.writeFile('temp.xml', xml);

        this.model = this.mujoco.MjModel.mj_loadXML('temp.xml');
        if (!this.model) {
            throw new Error('Could not load MuJoCo model.');
        }
        const parseMs = performance.now() - tParse0;

        this.onStage(`${stagePrefix}: creating simulation data...`);
        const tData0 = performance.now();
        this.data = new this.mujoco.MjData(this.model);
        this.mujoco.mj_forward(this.model, this.data);
        const dataMs = performance.now() - tData0;

        if (this.gravityOverride.active) {
            this.setGravity(this.gravityOverride.value);
        }

        const totalMs = performance.now() - t0;
        console.info(`Model timing [${name}]`, {
            parseMs: Number(parseMs.toFixed(1)),
            dataMs: Number(dataMs.toFixed(1)),
            totalMs: Number(totalMs.toFixed(1))
        });

        if (options.startup) {
            this.startupTimings.modelParseMs = parseMs;
            this.startupTimings.modelDataMs = dataMs;
        }
    }

    step() {
        if (!this.mujoco || !this.model || !this.data) return;

        if (this.gravityOverride.active) {
            this.model.opt.gravity[2] = this.gravityOverride.value;
        } else {
            this.model.opt.gravity[2] = -9.81;
        }

        if (this.pendingAction) {
            this.applyAction(this.pendingAction);
            this.pendingAction = null;
        }

        this.mujoco.mj_step(this.model, this.data);
    }

    // RL Integration Methods
    getObservation() {
        if (!this.data || !this.model) return new Float32Array(0);

        // Concatenate qpos and qvel
        const nq = this.model.nq;
        const nv = this.model.nv;

        const obs = new Float32Array(nq + nv);
        obs.set(this.data.qpos, 0);
        obs.set(this.data.qvel, nq);

        return obs;
    }

    applyAction(action) {
        if (!this.data || !this.model) return;

        const nu = this.model.nu;
        if (nu === 0) return;

        for (let i = 0; i < Math.min(nu, action.length); i++) {
            const u = action[i];
            const hasRange = this.model.actuator_ctrllimited && this.model.actuator_ctrllimited[i] !== 0;
            if (hasRange && this.model.actuator_ctrlrange) {
                const lo = this.model.actuator_ctrlrange[i * 2];
                const hi = this.model.actuator_ctrlrange[i * 2 + 1];
                this.data.ctrl[i] = Math.max(lo, Math.min(hi, u));
            } else {
                this.data.ctrl[i] = u;
            }
        }
    }

    queueAction(action) {
        this.pendingAction = action;
    }

    getActuatorCount() {
        return this.model ? this.model.nu : 0;
    }
    // End RL Integration

    setTimeStep(dt) {
        if (this.model) {
            this.model.opt.timestep = dt;
        }
    }

    setGravity(value) {
        this.gravityOverride.value = value;
        this.gravityOverride.active = true;
    }

    toggleGravity(active) {
        this.gravityOverride.active = active;
        if (!active && this.model) {
            this.model.opt.gravity[2] = -9.81;
        }
    }

    // --- LIVE PHYSICS CONTROLS ---
    setTorqueLimit(val) {
        if (!this.model) return;
        for (let i = 0; i < this.model.nu; i++) {
            this.model.actuator_ctrlrange[i * 2] = -val;
            this.model.actuator_ctrlrange[i * 2 + 1] = val;
        }
    }

    setPendulumMass(val) {
        if (!this.model) return;
        if (this.model.nbody > 3) this.model.body_mass[3] = val;
    }

    setJointDamping(val) {
        if (!this.model) return;
        if (this.model.nv > 1) this.model.dof_damping[1] = val;
    }
    // -----------------------------

    reset() {
        if (!this.mujoco || !this.model || !this.data) return;
        this.mujoco.mj_resetData(this.model, this.data);
        this.mujoco.mj_forward(this.model, this.data);
    }

    getSceneMetadata() {
        if (!this.model) return [];
        const ngeom = this.model.ngeom;
        const geoms = [];
        for (let i = 0; i < ngeom; i++) {
            const type = this.model.geom_type[i];
            const size = this.model.geom_size.slice(i * 3, i * 3 + 3);
            const rgba = this.model.geom_rgba.slice(i * 4, i * 4 + 4);
            geoms.push({
                index: i,
                type: type,
                size: Array.from(size),
                rgba: Array.from(rgba)
            });
        }
        return geoms;
    }

    getState() {
        if (!this.data || !this.model) return null;

        const ngeom = this.model.ngeom;
        const nbody = this.model.nbody;
        const geoms = [];

        // Track first body for metrics (usually root or target)
        let firstBodyZ = 0;
        let firstBodyVel = 0;
        if (nbody > 1) {
            firstBodyZ = this.data.xpos[3 * 1 + 2];
            const vel = this.data.qvel.slice(0, 3);
            firstBodyVel = Math.sqrt(vel[0] * vel[0] + vel[1] * vel[1] + vel[2] * vel[2]);
        }

        for (let i = 0; i < ngeom; i++) {
            const pos = this.data.geom_xpos.slice(i * 3, i * 3 + 3);
            const mat = this.data.geom_xmat.slice(i * 9, i * 9 + 9);

            // Convert 3x3 rotation matrix to quaternion for Three.js
            // Or use the matrix directly. We'll send pos and mat.
            geoms.push({
                index: i,
                pos: Array.from(pos),
                mat: Array.from(mat)
            });
        }

        return {
            time: this.data.time,
            geoms: geoms,
            metrics: {
                time: this.data.time,
                z: firstBodyZ,
                velocity: firstBodyVel,
                reward: firstBodyZ * 10
            }
        };
    }
}
