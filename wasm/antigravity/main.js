import { AntigravityPhysics } from './physics.js';
import { AntigravityRenderer } from './renderer.js';
import { Policy } from './policy.js';
import { initUI, updateDashboard, resetCharts } from './ui.js';

class AntigravityApp {
    constructor() {
        this.canvas = document.getElementById('sim-canvas');
        this.overlay = document.getElementById('loading-overlay');
        this.physics = new AntigravityPhysics({
            onStage: (message) => this.setLoadingStage(message)
        });
        this.renderer = null;
        this.policy = new Policy();

        this.isPaused = false;
        this.useRL = false;
        this.manualCtrl = 0;
        this.policyReady = false;
        this.policyLoadPromise = null;

        this.physicsStepsPerFrame = 2;
        this.animationFrameId = null;

        // Metrics
        this.episodeCount = 1;
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fps = 0;
        this.lastChartUpdate = 0;

        this.loop = this.loop.bind(this);

        window.addEventListener('error', (event) => {
            console.error('Window error:', event.error || event.message);
        });
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
        });
    }

    async init() {
        try {
            const timings = {};
            const t0 = performance.now();
            this.setLoadingStage('Booting app...');

            await this.physics.init();
            this.policy.nuHint = Math.max(1, this.physics.getActuatorCount());
            timings.physicsInitMs = performance.now() - t0;

            this.setLoadingStage('Initializing renderer...');
            const tRender0 = performance.now();
            this.renderer = new AntigravityRenderer(this.canvas);
            this.renderer.initSceneFromPhysics(this.physics.getSceneMetadata());
            timings.rendererInitMs = performance.now() - tRender0;

            this.setLoadingStage('Binding UI...');
            const tUi0 = performance.now();
            initUI(this);
            timings.uiInitMs = performance.now() - tUi0;
            timings.totalBootMs = performance.now() - t0;

            console.table({ ...this.physics.startupTimings, ...timings });
            this.overlay.style.display = 'none';
            this.start();

        } catch (e) {
            this.overlay.textContent = "Error: " + e.message;
            console.error(e);
        }
    }

    async loadModel(url) {
        this.isPaused = true;
        this.setLoadingStage("Loading model...");

        try {
            await this.physics.loadModel(url);
            this.policy.nuHint = Math.max(1, this.physics.getActuatorCount());

            this.renderer.initSceneFromPhysics(this.physics.getSceneMetadata());
            this.resetMetrics();

            this.overlay.style.display = 'none';
            this.isPaused = false;

        } catch (e) {
            this.overlay.textContent = "Error loading model: " + e.message;
            console.error(e);
        }
    }

    async loadModelFromXML(xml, name = "uploaded.xml") {
        this.isPaused = true;
        this.setLoadingStage(`Loading ${name}...`);

        try {
            await this.physics.loadModelFromXML(xml, name);
            this.policy.nuHint = Math.max(1, this.physics.getActuatorCount());

            this.renderer.initSceneFromPhysics(this.physics.getSceneMetadata());
            this.resetMetrics();

            this.overlay.style.display = 'none';
            this.isPaused = false;
        } catch (e) {
            this.overlay.textContent = "Error loading dropped model: " + e.message;
            console.error(e);
        }
    }

    start() {
        if (!this.animationFrameId) {
            this.lastTime = performance.now();
            this.loop();
        }
    }

    stop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    loop() {
        this.animationFrameId = requestAnimationFrame(this.loop);

        const now = performance.now();
        this.frameCount++;
        if (now - this.lastTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastTime = now;
        }

        if (!this.isPaused && this.physics.mujoco) {
            if (this.useRL) {
                const obs = this.physics.getObservation();
                const action = this.policy.predict(obs);
                this.physics.queueAction(action);
            } else {
                const nu = this.physics.getActuatorCount();
                const action = new Float32Array(Math.max(1, nu));
                for (let i = 0; i < action.length; i++) action[i] = this.manualCtrl;
                this.physics.queueAction(action);
            }

            for (let i = 0; i < this.physicsStepsPerFrame; i++) {
                this.physics.step();
            }
        }

        const state = this.physics.getState();
        this.renderer.render(state);

        if (now - this.lastChartUpdate > 100 && state) {
            updateDashboard(state.metrics, this.fps, this.episodeCount);
            this.lastChartUpdate = now;
        }
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        return this.isPaused;
    }

    toggleRL(active) {
        this.useRL = active;
        if (active) this.ensurePolicyLoaded();
        console.log("RL Control:", active ? "ENABLED" : "DISABLED");
    }

    async ensurePolicyLoaded() {
        if (this.policyReady) return;
        if (!this.policyLoadPromise) {
            this.policyLoadPromise = this.policy.load('./policy/model.json').then(() => {
                this.policyReady = true;
            });
        }
        try {
            await this.policyLoadPromise;
        } catch (_) {
            // Keep fallback mode in policy.js.
        }
    }

    reset() {
        this.physics.reset();
        this.episodeCount++;
        resetCharts();
    }

    resetMetrics() {
        this.episodeCount = 1;
        resetCharts();
    }

    toggleGravity(active) {
        this.physics.toggleGravity(active);
    }

    setGravity(val) {
        this.physics.setGravity(val);
    }

    setManualCtrl(value) {
        this.manualCtrl = value;
    }

    setLoadingStage(message) {
        this.overlay.textContent = message;
        this.overlay.style.display = 'flex';
    }
}

const app = new AntigravityApp();
app.init();
