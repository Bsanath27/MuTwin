/**
 * AntigravityController.js — Vertical Stabilization Logic
 * 
 * Implements the controller interface:
 *   { init(nu, ranges), update(state), getControl(): Float32Array, dispose() }
 * 
 * Logic:
 * - Applies a constant upward force to compensate for gravity.
 * - For single-actuator models (like pendulums), it maps the stabilization
 *   force to the primary actuator.
 * - For multi-actuator models, it scales the control vector based on
 *   the height (Z) of the root body to maintain levitation.
 */
export class AntigravityController {
    constructor(physics) {
        this.physics = physics;
        this._control = new Float32Array(0);
        this._nu = 0;
        this.targetZ = 1.0;
        this.kp = 10.0; // Proportional gain for height stabilization
        this.isEnabled = true;
    }

    /**
     * @param {number} nu 
     * @param {Array<[number, number]>} ranges 
     */
    init(nu, ranges) {
        this._nu = nu;
        this._control = new Float32Array(nu);
    }

    /**
     * @param {object} state - State with metrics (z, velocity)
     */
    update(state) {
        if (!this.isEnabled || !state) {
            this._control.fill(0);
            return;
        }

        const metrics = state.metrics;
        if (!metrics) return;

        // Stabilization logic: Simple PD control on height
        const z = metrics.z;
        const velZ = this.physics.getVelocities() ? this.physics.getVelocities()[2] : 0;

        // Calculate stabilization force
        const error = this.targetZ - z;
        const force = (error * this.kp) - (velZ * 2.0);

        // Distribute force across actuators
        // This is a heuristic: for many models, we just want to apply 
        // stabilization to the primary lifting joints or global bias.
        for (let i = 0; i < this._nu; i++) {
            this._control[i] = force;
        }
    }

    getControl() {
        return this._control;
    }

    dispose() {
        this._control = new Float32Array(0);
    }
}
