/**
 * RLController.js — TF.js Inference Controller
 * 
 * Design:
 * - Lazily loads TF.js from vendor directory
 * - Loads LayersModel from model.json
 * - Performs inference on observation vector [qpos, qvel]
 * - Provides random fallback if model is missing or fails
 */
export class RLController {
    constructor(physics) {
        this.physics = physics;
        this.model = null;
        this.tf = null;
        this.randomFallback = true;
        this._nu = 1;
        this._control = new Float32Array(1);
        this.isLoaded = false;
        this.isLoading = false;
    }

    /**
     * @param {number} nu 
     */
    async init(nu) {
        this._nu = nu;
        this._control = new Float32Array(nu);

        if (!this.isLoaded && !this.isLoading) {
            await this.loadModel('policy/model.json');
        }
    }

    async loadModel(url) {
        this.isLoading = true;
        try {
            // Load TF.js lazily
            if (typeof window.tf === 'undefined') {
                console.info("RL: Loading TF.js from vendor...");
                await this._loadScript('vendor/tf.4.22.0.min.js');
            }
            this.tf = window.tf;

            console.info(`RL: Loading model from ${url}...`);
            this.model = await this.tf.loadLayersModel(url);
            this.randomFallback = false;
            this.isLoaded = true;
            console.info(`RL: Model loaded successfully.`);
        } catch (err) {
            this.randomFallback = true;
            console.warn('RL: Model failed to load, using random fallback:', err.message);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * @param {object} state 
     */
    update(state) {
        if (this.randomFallback || !this.model || !this.tf) {
            // Random jitter fallback
            for (let i = 0; i < this._nu; i++) {
                this._control[i] = (Math.random() * 2 - 1) * 0.5;
            }
            return;
        }

        // Get observation from physics engine
        const obs = this.physics.getObservation();
        if (!obs || obs.length === 0) return;

        // Inference
        this.tf.tidy(() => {
            const input = this.tf.tensor2d(obs, [1, obs.length]);
            const output = this.model.predict(input);
            const data = output.dataSync();

            // Map output to control vector
            for (let i = 0; i < Math.min(this._nu, data.length); i++) {
                this._control[i] = data[i];
            }
        });
    }

    getControl() {
        return this._control;
    }

    dispose() {
        if (this.model) {
            this.model.dispose();
            this.model = null;
        }
        this._control = new Float32Array(0);
        this.isLoaded = false;
    }

    _loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
}
