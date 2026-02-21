/**
 * ControllerManager.js — Controller Dispatch
 * 
 * Hot-swappable controller system. All controllers implement:
 *   { init(nu, ranges), update(state), getControl(): Float32Array, dispose() }
 * 
 * Design:
 * - Single active controller at a time
 * - Pre-allocated fallback zero-vector for safety
 * - Controllers are completely decoupled from WASM
 */
export class ControllerManager {
    constructor() {
        /** @type {object|null} Active controller instance */
        this._active = null;
        /** @type {Float32Array} Fallback zero control */
        this._zeroControl = new Float32Array(0);
        /** @type {number} Current actuator count */
        this._nu = 0;
    }

    /**
     * Initialize with model dimensions. Call after model load.
     * @param {number} nu - Number of actuators
     * @param {Array<[number, number]>} ranges - Control ranges per actuator
     */
    init(nu, ranges) {
        this._nu = nu;
        this._zeroControl = new Float32Array(nu);
        if (this._active && this._active.init) {
            this._active.init(nu, ranges);
        }
    }

    /**
     * Set the active controller. Disposes previous if needed.
     * @param {object} controller - Must implement controller interface
     */
    setController(controller) {
        if (this._active && this._active.dispose) {
            this._active.dispose();
        }
        this._active = controller;
        if (this._active && this._active.init && this._nu > 0) {
            // Re-init with current model dimensions
            this._active.init(this._nu, []);
        }
    }

    /**
     * Called each frame. Passes state to active controller.
     * @param {object} state - From PhysicsEngine.getState()
     */
    update(state) {
        if (this._active && this._active.update) {
            this._active.update(state);
        }
    }

    /**
     * Get the current control vector from the active controller.
     * Returns zero-vector if no controller is active.
     * @returns {Float32Array}
     */
    getControlVector() {
        if (this._active && this._active.getControl) {
            return this._active.getControl();
        }
        return this._zeroControl;
    }

    /**
     * Dispose the active controller.
     */
    dispose() {
        if (this._active && this._active.dispose) {
            this._active.dispose();
        }
        this._active = null;
    }
}
