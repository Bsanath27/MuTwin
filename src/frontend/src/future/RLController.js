/**
 * RLController.js — Reinforcement Learning Controller (STUB)
 * 
 * Future: Will load a TF.js model and run inference each frame.
 * Implements the same controller interface as ManualController.
 * 
 * PLACEHOLDER — do not use in production until implemented.
 */
export class RLController {
    constructor() {
        this._control = new Float32Array(0);
        this._nu = 0;
        this._model = null; // Future: TensorFlow.js model
    }

    init(nu, ranges) {
        this._nu = nu;
        this._control = new Float32Array(nu);
    }

    /**
     * Future: Run model.predict(observation) and fill _control.
     */
    update(state) {
        // STUB: No-op until TF.js model is loaded
        // const obs = this._buildObservation(state);
        // const prediction = this._model.predict(obs);
        // this._control.set(prediction);
    }

    getControl() {
        return this._control;
    }

    /**
     * Future: Load a TF.js model from a URL.
     * @param {string} modelUrl
     */
    async loadModel(modelUrl) {
        // STUB: await tf.loadLayersModel(modelUrl);
        console.warn('RLController.loadModel() is a stub');
    }

    dispose() {
        this._control = new Float32Array(0);
        this._model = null;
    }
}
