/**
 * ExperimentManager.js — Experiment Config Save/Load (STUB)
 * 
 * Future features:
 * - Save current model + controller + parameters as a named experiment
 * - Load experiments from localStorage or server
 * - Domain randomization (mass, friction, gravity ranges)
 * - WebSocket bridge to Python backend
 * - Metrics dashboard integration
 * 
 * PLACEHOLDER — interfaces defined for future implementation.
 */
export class ExperimentManager {
    constructor() {
        this._experiments = new Map();
    }

    /**
     * Future: Save current configuration.
     * @param {string} name
     * @param {object} config - { modelKey, controllerType, gravity, timestep, ... }
     */
    save(name, config) {
        console.warn('ExperimentManager.save() is a stub');
        this._experiments.set(name, { ...config, timestamp: Date.now() });
    }

    /**
     * Future: Load a saved configuration.
     * @param {string} name
     * @returns {object|null}
     */
    load(name) {
        console.warn('ExperimentManager.load() is a stub');
        return this._experiments.get(name) || null;
    }

    /**
     * Future: List all saved experiments.
     * @returns {string[]}
     */
    list() {
        return Array.from(this._experiments.keys());
    }

    /**
     * Future: Domain randomization configuration.
     * @param {object} ranges - { mass: [lo, hi], friction: [lo, hi], gravity: [lo, hi] }
     */
    setRandomizationRanges(ranges) {
        console.warn('ExperimentManager.setRandomizationRanges() is a stub');
    }

    /**
     * Future: Connect to Python backend via WebSocket.
     * @param {string} url - WebSocket URL
     */
    async connectBackend(url) {
        console.warn('ExperimentManager.connectBackend() is a stub');
    }
}
