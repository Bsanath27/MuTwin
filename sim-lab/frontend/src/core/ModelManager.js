/**
 * ModelManager.js — Model Registry & Lifecycle
 * 
 * Manages the catalog of available models and orchestrates
 * loading/disposal through PhysicsEngine.
 * 
 * Design:
 * - Decoupled from WASM: uses PhysicsEngine as sole interface
 * - Event-driven: emits status via callbacks
 * - Supports both URL-based and raw XML loading
 */
export class ModelManager {
    /**
     * @param {import('./PhysicsEngine.js').PhysicsEngine} physics
     */
    constructor(physics) {
        this.physics = physics;
        this.currentModelKey = null;

        // Model registry: key → { path, label }
        this.registry = new Map();

        // Event callbacks
        this._onLoading = null;
        this._onLoaded = null;
        this._onError = null;
    }

    /**
     * Register a model in the catalog.
     * @param {string} key - Unique identifier
     * @param {string} path - Relative URL to XML file
     * @param {string} label - Human-readable name
     */
    register(key, path, label) {
        this.registry.set(key, { path, label });
    }

    /**
     * Get all registered models as an array.
     * @returns {Array<{ key: string, path: string, label: string }>}
     */
    getModelList() {
        return Array.from(this.registry.entries()).map(([key, val]) => ({
            key,
            ...val
        }));
    }

    /**
     * Load a model by registry key.
     * @param {string} key
     */
    async loadModel(key) {
        const entry = this.registry.get(key);
        if (!entry) throw new Error(`Unknown model: ${key}`);

        this._emit('loading', { key, label: entry.label });

        try {
            const response = await fetch(entry.path);
            if (!response.ok) throw new Error(`HTTP ${response.status} for ${entry.path}`);
            const xml = await response.text();

            this.physics.loadModelFromXML(xml, `${key}.xml`);
            this.currentModelKey = key;

            this._emit('loaded', { key, label: entry.label });
        } catch (e) {
            this._emit('error', { key, error: e.message });
            throw e;
        }
    }

    /**
     * Load a model from raw XML string (e.g., drag-and-drop).
     * @param {string} xml
     * @param {string} name
     */
    async loadModelFromXML(xml, name = 'custom.xml') {
        this._emit('loading', { key: 'custom', label: name });

        try {
            this.physics.loadModelFromXML(xml, name);
            this.currentModelKey = 'custom';
            this._emit('loaded', { key: 'custom', label: name });
        } catch (e) {
            this._emit('error', { key: 'custom', error: e.message });
            throw e;
        }
    }

    /**
     * Register event callbacks.
     * @param {'loading'|'loaded'|'error'} event
     * @param {Function} callback
     */
    on(event, callback) {
        if (event === 'loading') this._onLoading = callback;
        else if (event === 'loaded') this._onLoaded = callback;
        else if (event === 'error') this._onError = callback;
    }

    _emit(event, data) {
        if (event === 'loading' && this._onLoading) this._onLoading(data);
        else if (event === 'loaded' && this._onLoaded) this._onLoaded(data);
        else if (event === 'error' && this._onError) this._onError(data);
    }
}
