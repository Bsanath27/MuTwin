/**
 * main.js — Sim-Lab Application Bootstrap
 * 
 * Architecture:
 * 1. Initialize WASM engine
 * 2. Register models
 * 3. Wire up modules (physics → renderer → UI → controllers)
 * 4. Run 60fps animation loop: controller → step → containment → render → UI
 * 
 * This file is the ONLY place where modules are wired together.
 * No circular dependencies allowed.
 */

// Core
import { PhysicsEngine } from './src/core/PhysicsEngine.js';
import { ModelManager } from './src/core/ModelManager.js';
import { ControllerManager } from './src/core/ControllerManager.js';
import { ContainmentSystem } from './src/core/ContainmentSystem.js';

// Render
import { Renderer } from './src/render/Renderer.js';
import { CameraController } from './src/render/CameraController.js';

// UI
import { ControlPanel } from './src/ui/ControlPanel.js';
import { ModelSelector } from './src/ui/ModelSelector.js';
import { ParameterPanel } from './src/ui/ParameterPanel.js';

// Controllers
import { ManualController } from './src/controllers/ManualController.js';
import { RLController } from './src/controllers/RLController.js';
import { AntigravityController } from './src/controllers/AntigravityController.js';

// Feature Panels
import { AnalyticsPanel } from './src/ui/AnalyticsPanel.js';

// ─── Application State ─────────────────────────────────
let isPaused = false;
let frameCount = 0;
let lastFpsTime = performance.now();
let fps = 0;
const PHYSICS_STEPS_PER_FRAME = 2;

// ─── Module Instances ───────────────────────────────────
const physics = new PhysicsEngine();
const modelManager = new ModelManager(physics);
const controllerManager = new ControllerManager();
const containment = new ContainmentSystem();

// DOM refs
const canvas = document.getElementById('sim-canvas');
const overlay = document.getElementById('loading-overlay');
const fpsEl = document.getElementById('fps-counter');
const timeEl = document.getElementById('sim-time');

// Renderer & Camera
const renderer = new Renderer(canvas);
const camera = new CameraController(renderer.camera, canvas);

// UI Panels
const controlPanel = new ControlPanel(document.getElementById('actuator-panel'));
// Default controller: manual sliders
const manualController = new ManualController(controlPanel);
const rlController = new RLController(physics);
const antiController = new AntigravityController(physics);

// Analytics
const analytics = new AnalyticsPanel(document.getElementById('analytics-container'));
let lastAnalyticsUpdate = 0;

controllerManager.setController(manualController);

const paramPanel = new ParameterPanel(document.getElementById('param-panel'), {
    onGravity: (v) => physics.setGravity(v),
    onTimestep: (v) => physics.setTimestep(v),
    onPause: (v) => { isPaused = v; },
    onReset: () => {
        physics.reset();
        controlPanel.reset();
        analytics.reset();
    },
    onContainment: (strategy, enabled) => {
        if (strategy === 'boundary') containment.boundaryEnabled = enabled;
        else if (strategy === 'softReset') containment.softResetEnabled = enabled;
        else if (strategy === 'nanGuard') containment.nanGuardEnabled = enabled;
    }
});

// ─── Model Registration ─────────────────────────────────
modelManager.register('cartpole', '../models/cartpole.xml', 'Cartpole');
modelManager.register('ant', '../models/ant.xml', 'Ant');
modelManager.register('floating_box', '../models/floating_box.xml', 'Floating Box');

// Model selector UI
const modelSelector = new ModelSelector(
    document.getElementById('model-select'),
    document.getElementById('drop-zone'),
    (key) => switchModel(key),
    (xml, name) => switchModelFromXML(xml, name)
);

// Feature Toggles
document.getElementById('rl-toggle').addEventListener('change', (e) => {
    if (e.target.checked) {
        document.getElementById('antigravity-toggle').checked = false;
        controllerManager.setController(rlController);
    } else {
        controllerManager.setController(manualController);
    }
});

document.getElementById('antigravity-toggle').addEventListener('change', (e) => {
    if (e.target.checked) {
        document.getElementById('rl-toggle').checked = false;
        controllerManager.setController(antiController);
    } else {
        controllerManager.setController(manualController);
    }
});

document.getElementById('analytics-btn').addEventListener('click', (e) => {
    const isVisible = analytics.toggle();
    e.target.textContent = isVisible ? 'Hide Analytics' : 'Show Analytics';
});

// ─── Model Switch Handler ────────────────────────────────
async function switchModel(key) {
    isPaused = true;
    overlay.textContent = 'Loading model...';
    overlay.style.display = 'flex';

    try {
        await modelManager.loadModel(key);
        onModelLoaded();
    } catch (e) {
        overlay.textContent = `Error: ${e.message}`;
        console.error(e);
    }
}

async function switchModelFromXML(xml, name) {
    isPaused = true;
    overlay.textContent = `Loading ${name}...`;
    overlay.style.display = 'flex';

    try {
        await modelManager.loadModelFromXML(xml, name);
        onModelLoaded();
    } catch (e) {
        overlay.textContent = `Error: ${e.message}`;
        console.error(e);
    }
}

function onModelLoaded() {
    // Rebuild renderer
    const state = physics.getState();
    renderer.initScene(state.geoms);

    // Rebuild actuator UI + controller
    const info = physics.getActuatorInfo();
    controlPanel.buildSliders(info);
    controllerManager.init(info.count, info.ranges);

    overlay.style.display = 'none';
    isPaused = false;
}

// ─── Animation Loop ──────────────────────────────────────
function loop() {
    requestAnimationFrame(loop);

    // FPS counter
    frameCount++;
    const now = performance.now();
    if (now - lastFpsTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastFpsTime = now;
        // Batch DOM writes: only update counters once per second
        if (fpsEl) fpsEl.textContent = fps;
    }

    // Camera always updates (even when paused, for orbiting)
    camera.update();

    if (!isPaused && physics.model) {
        // Controller → control vector
        const state = physics.getState();
        controllerManager.update(state);
        const control = controllerManager.getControlVector();

        // Physics stepping
        for (let i = 0; i < PHYSICS_STEPS_PER_FRAME; i++) {
            physics.step(control);
        }

        // Containment check (after stepping)
        const check = containment.check(physics);
        if (check.action === 'reset') {
            console.warn('Containment reset:', check.reason);
            physics.reset();
            controlPanel.reset();
        }
    }

    // Render (always, even when paused to show camera changes)
    const renderState = physics.getState();
    if (renderState) {
        renderer.update(renderState.geoms);
        if (timeEl) timeEl.textContent = renderState.metrics.time.toFixed(2) + 's';

        // Update Analytics at 10Hz
        if (now - lastAnalyticsUpdate > 100) {
            analytics.update(renderState.metrics);
            lastAnalyticsUpdate = now;
        }
    }
}

// ─── Boot Sequence ───────────────────────────────────────
async function boot() {
    try {
        overlay.textContent = 'Initializing MuJoCo WASM...';

        const t0 = performance.now();
        await physics.init();
        console.info(`WASM init: ${(performance.now() - t0).toFixed(0)}ms`);

        // Populate model selector
        modelSelector.populate(modelManager.getModelList(), 'cartpole');

        // Load default model
        await switchModel('cartpole');

        // Start loop
        loop();

    } catch (e) {
        overlay.textContent = `Fatal: ${e.message}`;
        console.error('Boot failed:', e);
    }
}

boot();
