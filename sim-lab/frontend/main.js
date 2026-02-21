/**
 * main.js — MuTwin Application Bootstrap v2.0
 * 
 * Architecture:
 * 1. Initialize WASM engine
 * 2. Register models (including drone)
 * 3. Wire up modules (physics → renderer → UI → controllers)
 * 4. Run 60fps loop: controller → step → containment → render → UI
 * 
 * This file is the ONLY place where modules are wired together.
 * No circular dependencies allowed.
 */

// Core
import { PhysicsEngine } from './src/core/PhysicsEngine.js';
import { ModelManager } from './src/core/ModelManager.js';
import { ControllerManager } from './src/core/ControllerManager.js';
import { ContainmentSystem } from './src/core/ContainmentSystem.js';
import { WindSystem } from './src/core/WindSystem.js';

// Render
import { Renderer } from './src/render/Renderer.js';
import { CameraController } from './src/render/CameraController.js';

// UI
import { ControlPanel } from './src/ui/ControlPanel.js';
import { ModelSelector } from './src/ui/ModelSelector.js';
import { ParameterPanel } from './src/ui/ParameterPanel.js';
import { AnalyticsPanel } from './src/ui/AnalyticsPanel.js';
import { DroneHUD } from './src/ui/DroneHUD.js';

// Controllers
import { ManualController } from './src/controllers/ManualController.js';
import { RLController } from './src/controllers/RLController.js';
import { AntigravityController } from './src/controllers/AntigravityController.js';
import { JoystickHandler } from './src/controllers/JoystickHandler.js';
import { DroneController } from './src/controllers/DroneController.js';

// ─── Application State ─────────────────────────────────
let isPaused = false;
let frameCount = 0;
let lastFpsTime = performance.now();
let fps = 0;
const PHYSICS_STEPS_PER_FRAME = 2;
let isDroneModel = false;  // Track if current model is the drone

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
const manualController = new ManualController(controlPanel);
const rlController = new RLController(physics);
const antiController = new AntigravityController(physics);

// Drone-specific modules
const joystick = new JoystickHandler();
const droneController = new DroneController(physics, joystick);
const wind = new WindSystem(physics);
const droneHUD = new DroneHUD(document.getElementById('drone-hud-container'));

// Analytics
const analytics = new AnalyticsPanel(document.getElementById('analytics-container'));
let lastAnalyticsUpdate = 0;
let lastHUDUpdate = 0;

// Default: drone controller active
controllerManager.setController(droneController);

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
modelManager.register('drone', '../models/drone.xml', 'Drone (6-DOF)');
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

// ─── Feature Toggles ────────────────────────────────────
document.getElementById('rl-toggle').addEventListener('change', (e) => {
    if (e.target.checked) {
        document.getElementById('antigravity-toggle').checked = false;
        if (isDroneModel) {
            // RL feeds velocity commands into DroneController
            droneController.setExternalCommand({ vx: 0, vy: 0, vz: 0, yaw: 0 });
            controllerManager.setController(droneController);
        } else {
            controllerManager.setController(rlController);
        }
    } else {
        droneController.clearExternalCommand();
        controllerManager.setController(isDroneModel ? droneController : manualController);
    }
});

document.getElementById('antigravity-toggle').addEventListener('change', (e) => {
    if (e.target.checked) {
        document.getElementById('rl-toggle').checked = false;
        controllerManager.setController(antiController);
    } else {
        controllerManager.setController(isDroneModel ? droneController : manualController);
    }
});

document.getElementById('analytics-btn').addEventListener('click', (e) => {
    const isVisible = analytics.toggle();
    e.target.textContent = isVisible ? 'Hide Analytics' : 'Show Analytics';
});

// Drone toggles
document.getElementById('follow-toggle').addEventListener('change', (e) => {
    camera.toggleFollow();
});
// Start with follow enabled (checkbox is checked by default)
camera.toggleFollow();

document.getElementById('wind-toggle').addEventListener('change', (e) => {
    const active = wind.toggle();
    if (active) wind.randomizeDirection();
});

// ─── Model Switch Handler ────────────────────────────────
async function switchModel(key) {
    isPaused = true;
    overlay.textContent = 'Loading model...';
    overlay.style.display = 'flex';

    try {
        await modelManager.loadModel(key);
        isDroneModel = (key === 'drone');
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
        isDroneModel = false; // Custom XML is not the drone
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

    // Set appropriate controller
    if (isDroneModel) {
        controllerManager.setController(droneController);
    } else {
        controllerManager.setController(manualController);
    }

    // Reset toggles
    document.getElementById('rl-toggle').checked = false;
    document.getElementById('antigravity-toggle').checked = false;
    droneController.clearExternalCommand();

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
        if (fpsEl) fpsEl.textContent = fps;
    }

    // Camera always updates (even when paused, for orbiting)
    camera.update();

    if (!isPaused && physics.model) {
        // Clear external forces before controller writes
        physics.clearExternalForces();

        // Controller → control vector (DroneController writes xfrc_applied)
        const state = physics.getState();
        controllerManager.update(state);
        const control = controllerManager.getControlVector();

        // Wind (additive, after controller)
        if (isDroneModel && wind.enabled) {
            wind.update(state.time);
        }

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

    // Render (always, even when paused)
    const renderState = physics.getState();
    if (renderState) {
        renderer.update(renderState.geoms);
        if (timeEl) timeEl.textContent = renderState.metrics.time.toFixed(2) + 's';

        // Camera follow drone body
        if (isDroneModel && physics.data) {
            camera.setFollowTarget([
                physics.data.qpos[0],
                physics.data.qpos[1],
                physics.data.qpos[2]
            ]);
        }

        // Update Analytics at 10Hz
        if (now - lastAnalyticsUpdate > 100) {
            analytics.update(renderState.metrics);
            lastAnalyticsUpdate = now;
        }

        // Update Drone HUD at 10Hz
        if (isDroneModel && now - lastHUDUpdate > 100) {
            droneHUD.update(droneController.telemetry, joystick.hasGamepad);
            lastHUDUpdate = now;
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
        modelSelector.populate(modelManager.getModelList(), 'drone');

        // Load default model: DRONE
        await switchModel('drone');

        // Start loop
        loop();

    } catch (e) {
        overlay.textContent = `Fatal: ${e.message}`;
        console.error('Boot failed:', e);
    }
}

boot();
