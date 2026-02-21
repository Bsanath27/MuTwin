/**
 * ScriptController.js — Sandboxed User Script Controller (STUB)
 * 
 * Future: Execute user-provided JS in a sandboxed environment
 * (e.g., Web Worker or iframe), receive control vector output.
 * 
 * PLACEHOLDER — do not use in production until implemented.
 */
export class ScriptController {
    constructor() {
        this._control = new Float32Array(0);
        this._nu = 0;
        this._worker = null; // Future: Web Worker for sandboxing
    }

    init(nu, ranges) {
        this._nu = nu;
        this._control = new Float32Array(nu);
    }

    update(state) {
        // STUB: Send state to worker, receive control
    }

    getControl() {
        return this._control;
    }

    /**
     * Future: Load and compile user script.
     * @param {string} scriptSource - User's JS code
     */
    async loadScript(scriptSource) {
        console.warn('ScriptController.loadScript() is a stub');
    }

    dispose() {
        if (this._worker) this._worker.terminate();
        this._control = new Float32Array(0);
    }
}
