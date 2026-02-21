export class Policy {
    constructor() {
        this.model = null;
        this.randomFallback = true;
        this.nuHint = 1;
        this.tf = null;
    }

    async load(url) {
        try {
            await ensureTfLoaded();
            this.tf = window.tf;
            if (!this.tf) throw new Error('window.tf unavailable');

            const t0 = performance.now();
            this.model = await this.tf.loadLayersModel(url);
            this.randomFallback = false;
            console.info(`Policy loaded from ${url} in ${Math.round(performance.now() - t0)}ms`);
        } catch (err) {
            this.randomFallback = true;
            console.warn('TF.js policy unavailable, using random fallback:', err.message);
        }
    }

    predict(observation) {
        if (!observation || observation.length === 0) {
            return new Float32Array([0]);
        }
        if (!this.randomFallback && this.model && this.tf) {
            return this.tf.tidy(() => {
                const x = this.tf.tensor2d(observation, [1, observation.length], 'float32');
                const y = this.model.predict(x);
                const out = y.dataSync();
                const action = new Float32Array(out.length);
                for (let i = 0; i < out.length; i++) action[i] = out[i];
                return action;
            });
        }

        const actionSize = this.nuHint;
        const actions = new Float32Array(actionSize);
        for (let i = 0; i < actionSize; i++) actions[i] = (Math.random() * 2) - 1;
        return actions;
    }
}

let tfLoadPromise = null;
async function ensureTfLoaded() {
    if (window.tf) return;
    if (!tfLoadPromise) {
        tfLoadPromise = loadScript('./vendor/tf.4.22.0.min.js');
    }
    await tfLoadPromise;
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-src="${src}"]`);
        if (existing) {
            if (existing.dataset.loaded === 'true') {
                resolve();
                return;
            }
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.dataset.src = src;
        script.addEventListener('load', () => {
            script.dataset.loaded = 'true';
            resolve();
        }, { once: true });
        script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
        document.head.appendChild(script);
    });
}
