/**
 * PhysicsEngine.js — MuJoCo WASM Wrapper
 * 
 * ALL WASM memory access is isolated here. No other module
 * should touch mujoco.FS, model, or data directly.
 * 
 * Design:
 * - Pre-allocates typed arrays for zero-alloc render loop
 * - Provides getState() that returns a reusable state object
 * - step() applies control, advances physics, updates state cache
 */
import loadMujoco from '../../lib/mujoco_wasm.js';

export class PhysicsEngine {
    constructor() {
        /** @type {object|null} MuJoCo WASM module */
        this.mujoco = null;
        /** @type {object|null} MjModel instance */
        this.model = null;
        /** @type {object|null} MjData instance */
        this.data = null;
        /** @type {boolean} */
        this.ready = false;

        // Pre-allocated state cache — NEVER allocate inside render loop
        this._stateCache = {
            time: 0,
            ngeom: 0,
            nbody: 0,
            nu: 0,
            nq: 0,
            nv: 0,
            geoms: [],          // Will be filled on model load
            bodyPositions: [],   // [x, y, z] per body
            metrics: { time: 0, z: 0, velocity: 0, reward: 0, altitude: 0, speed: 0 }
        };

        // Pre-allocated control array
        this._controlVector = new Float32Array(0);
    }

    /**
     * Initialize the WASM module. Must be called before anything else.
     */
    async init() {
        this.mujoco = await loadMujoco({
            locateFile: (path) => `lib/${path}`
        });
        this.ready = true;
    }

    /**
     * Load a model from XML string into the WASM virtual FS.
     * Disposes previous model/data cleanly.
     * @param {string} xml - MuJoCo XML content
     * @param {string} filename - Virtual filename for error messages
     */
    loadModelFromXML(xml, filename = 'model.xml') {
        if (!this.mujoco) throw new Error('WASM not initialized');

        // Clean dispose of previous model
        this.dispose();

        // Write XML to WASM virtual filesystem
        try { this.mujoco.FS.unlink(filename); } catch (_) { /* ok */ }
        this.mujoco.FS.writeFile(filename, xml);

        // Parse model
        this.model = this.mujoco.MjModel.mj_loadXML(filename);
        if (!this.model) throw new Error(`Failed to parse model: ${filename}`);

        // Create simulation data
        this.data = new this.mujoco.MjData(this.model);
        this.mujoco.mj_forward(this.model, this.data);

        // Pre-allocate arrays based on model dimensions
        this._controlVector = new Float32Array(this.model.nu);
        this._rebuildStateCache();
    }

    /**
     * Rebuild the state cache arrays when a new model is loaded.
     * This is the ONLY place we allocate for the render path.
     */
    _rebuildStateCache() {
        const m = this.model;
        const s = this._stateCache;

        s.ngeom = m.ngeom;
        s.nbody = m.nbody;
        s.nu = m.nu;
        s.nq = m.nq;
        s.nv = m.nv;

        // Build geom metadata (static per model, read once)
        s.geoms = [];
        for (let i = 0; i < m.ngeom; i++) {
            s.geoms.push({
                index: i,
                type: m.geom_type[i],
                size: Array.from(m.geom_size.slice(i * 3, i * 3 + 3)),
                rgba: Array.from(m.geom_rgba.slice(i * 4, i * 4 + 4)),
                // Runtime state — updated each frame
                pos: [0, 0, 0],
                mat: [1, 0, 0, 0, 1, 0, 0, 0, 1]
            });
        }
    }

    /**
     * Apply control vector and advance physics by one timestep.
     * @param {Float32Array} control - Control values per actuator
     */
    step(control) {
        if (!this.model || !this.data) return;

        // Apply control
        const nu = this.model.nu;
        for (let i = 0; i < nu; i++) {
            if (control && i < control.length) {
                // Clamp to actuator range if limited
                const limited = this.model.actuator_ctrllimited &&
                    this.model.actuator_ctrllimited[i] !== 0;
                if (limited && this.model.actuator_ctrlrange) {
                    const lo = this.model.actuator_ctrlrange[i * 2];
                    const hi = this.model.actuator_ctrlrange[i * 2 + 1];
                    this.data.ctrl[i] = Math.max(lo, Math.min(hi, control[i]));
                } else {
                    this.data.ctrl[i] = control[i];
                }
            }
        }

        this.mujoco.mj_step(this.model, this.data);
    }

    /**
     * Get current simulation state. Reuses pre-allocated cache.
     * ZERO ALLOCATIONS in this path.
     * @returns {object} State cache reference (do not store, it mutates)
     */
    getState() {
        if (!this.data || !this.model) return null;

        const d = this.data;
        const s = this._stateCache;

        s.time = d.time;

        // Update geom poses (position + rotation matrix)
        for (let i = 0; i < s.ngeom; i++) {
            const g = s.geoms[i];
            const p = i * 3;
            const r = i * 9;
            g.pos[0] = d.geom_xpos[p];
            g.pos[1] = d.geom_xpos[p + 1];
            g.pos[2] = d.geom_xpos[p + 2];
            g.mat[0] = d.geom_xmat[r];
            g.mat[1] = d.geom_xmat[r + 1];
            g.mat[2] = d.geom_xmat[r + 2];
            g.mat[3] = d.geom_xmat[r + 3];
            g.mat[4] = d.geom_xmat[r + 4];
            g.mat[5] = d.geom_xmat[r + 5];
            g.mat[6] = d.geom_xmat[r + 6];
            g.mat[7] = d.geom_xmat[r + 7];
            g.mat[8] = d.geom_xmat[r + 8];
        }

        // Metrics from first non-world body
        if (s.nbody > 1) {
            s.metrics.z = d.xpos[3 + 2]; // body 1 z-pos
            const v0 = d.qvel[0] || 0;
            const v1 = d.qvel[1] || 0;
            const v2 = d.qvel[2] || 0;
            s.metrics.velocity = Math.sqrt(v0 * v0 + v1 * v1 + v2 * v2);
        }
        s.metrics.time = d.time;
        s.metrics.reward = s.metrics.z * 10;

        return s;
    }

    /**
     * Get actuator metadata for UI generation.
     * @returns {{ count: number, ranges: Array<[number, number]>, names: string[] }}
     */
    getActuatorInfo() {
        if (!this.model) return { count: 0, ranges: [], names: [] };

        const nu = this.model.nu;
        const ranges = [];
        const names = [];

        for (let i = 0; i < nu; i++) {
            const limited = this.model.actuator_ctrllimited &&
                this.model.actuator_ctrllimited[i] !== 0;
            if (limited && this.model.actuator_ctrlrange) {
                ranges.push([
                    this.model.actuator_ctrlrange[i * 2],
                    this.model.actuator_ctrlrange[i * 2 + 1]
                ]);
            } else {
                ranges.push([-1, 1]); // Default range
            }
            names.push(`actuator_${i}`);
        }

        return { count: nu, ranges, names };
    }

    /**
     * Get body positions for containment checks.
     * @returns {Float64Array|null} xpos array [x0,y0,z0, x1,y1,z1, ...]
     */
    getBodyPositions() {
        return this.data ? this.data.xpos : null;
    }

    /**
     * Get body velocities for explosion detection.
     * @returns {Float64Array|null} qvel array
     */
    getVelocities() {
        return this.data ? this.data.qvel : null;
    }

    /** @returns {number} Number of bodies */
    get nbody() { return this.model ? this.model.nbody : 0; }

    /** @returns {number} Number of actuators */
    get nu() { return this.model ? this.model.nu : 0; }

    /** @returns {number} Simulation time */
    get time() { return this.data ? this.data.time : 0; }

    /**
     * Reset simulation to initial state.
     */
    reset() {
        if (!this.mujoco || !this.model || !this.data) return;
        this.mujoco.mj_resetData(this.model, this.data);
        this.mujoco.mj_forward(this.model, this.data);
    }

    /**
     * Set gravity vector z-component.
     */
    setGravity(z) {
        if (this.model) this.model.opt.gravity[2] = z;
    }

    /**
     * Set simulation timestep.
     */
    setTimestep(dt) {
        if (this.model) this.model.opt.timestep = dt;
    }

    /**
     * Get current timestep.
     */
    getTimestep() {
        return this.model ? this.model.opt.timestep : 0.005;
    }

    /**
     * Apply external force and torque to a body via xfrc_applied.
     * @param {number} bodyIdx - Body index (0 = world)
     * @param {number} fx - Force X
     * @param {number} fy - Force Y
     * @param {number} fz - Force Z
     * @param {number} tx - Torque X
     * @param {number} ty - Torque Y
     * @param {number} tz - Torque Z
     */
    applyBodyForce(bodyIdx, fx, fy, fz, tx, ty, tz) {
        if (!this.data) return;
        const off = bodyIdx * 6;
        this.data.xfrc_applied[off] = fx;
        this.data.xfrc_applied[off + 1] = fy;
        this.data.xfrc_applied[off + 2] = fz;
        this.data.xfrc_applied[off + 3] = tx;
        this.data.xfrc_applied[off + 4] = ty;
        this.data.xfrc_applied[off + 5] = tz;
    }

    /**
     * Clear all external forces.
     */
    clearExternalForces() {
        if (!this.data) return;
        for (let i = 0; i < this.data.xfrc_applied.length; i++) {
            this.data.xfrc_applied[i] = 0;
        }
    }

    /**
     * Clean disposal. Safe to call multiple times.
     */
    dispose() {
        if (this.data) { this.data.delete(); this.data = null; }
        if (this.model) { this.model.delete(); this.model = null; }
        this._stateCache.geoms = [];
        this._controlVector = new Float32Array(0);
    }
}
