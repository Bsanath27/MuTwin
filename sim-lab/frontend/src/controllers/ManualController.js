/**
 * ManualController.js — Human-in-the-Loop Control
 * 
 * Implements the controller interface:
 *   { init(nu, ranges), update(state), getControl(): Float32Array, dispose() }
 * 
 * Reads values from a ControlPanel instance.
 * Pre-allocates output array — zero allocs per frame.
 */
export class ManualController {
    /**
     * @param {import('../ui/ControlPanel.js').ControlPanel} controlPanel
     */
    constructor(controlPanel) {
        this.panel = controlPanel;
        this._control = new Float32Array(0);
        this._nu = 0;
    }

    /**
     * Initialize with model dimensions.
     * @param {number} nu - Number of actuators
     * @param {Array<[number, number]>} ranges
     */
    init(nu, ranges) {
        this._nu = nu;
        this._control = new Float32Array(nu);
    }

    /**
     * Called each frame. Read slider values into pre-allocated array.
     * @param {object} state - Physics state (unused in manual mode)
     */
    update(state) {
        const src = this.panel.getValues();
        for (let i = 0; i < this._nu; i++) {
            this._control[i] = src[i] || 0;
        }
    }

    /**
     * Return the control vector. ZERO ALLOCATIONS.
     * @returns {Float32Array}
     */
    getControl() {
        return this._control;
    }

    /**
     * Clean up.
     */
    dispose() {
        this._control = new Float32Array(0);
        this._nu = 0;
    }
}
