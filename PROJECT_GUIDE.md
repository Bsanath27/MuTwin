# MuTwin: Drone Simulation Playground Documentation

MuTwin is a high-performance, browser-based robotics simulation platform utilizing MuJoCo via WebAssembly. It features a modular architecture, 6-DOF drone simulation, PD stabilization, and real-time analytics.

---

## 1. Folder Structure Overview

```text
/antigravity-lab/
├── custom_scripts/         # Backend utility scripts
│   └── serve.py           # HTTP server for the WASM platform
├── scripts/                # Launch and setup scripts
│   ├── setup.sh           # Environment setup
│   ├── run_frontend.sh    # Launches the browser platform
│   └── run_backend.sh     # Placeholder for RL training
├── sim-lab/                # Main platform root
│   ├── frontend/          # Application source code
│   │   ├── src/           # Modular JS components (Core, Render, Controllers, UI)
│   │   ├── index.html     # Application entry point
│   │   ├── main.js        # Bootstrap and Loop management
│   │   └── *.css          # Visual styling (drone.css, style.css)
│   └── models/            # MJCF Simulation models (XML)
│       └── drone.xml      # 6-DOF Drone model
├── wasm/                   # MuJoCo WASM Core
│   └── antigravity/       # Compiled MuJoCo libraries and vendors
└── venv/                  # Python virtual environment (ignored by Git)
```

---

## 2. Key Directories & File Responsibilities

### `/sim-lab/frontend/src/` (The Core Logic)
*   **`core/PhysicsEngine.js`**: Isolated MuJoCo WASM wrapper. Manages memory, stepping, and state caching.
*   **`core/ControllerManager.js`**: Handles hot-swapping between Manual, RL, and Drone controllers.
*   **`render/Renderer.js`**: Three.js scene manager. Maps MuJoCo geoms to 3D meshes with zero-allocation updates.
*   **`controllers/DroneController.js`**: The 6-DOF stabilization brain. Runs PD loops for velocity tracking and attitude control.
*   **`controllers/JoystickHandler.js`**: Input layer for Gamepad and Keyboard.

### `/sim-lab/models/` (The Physical World)
*   **`drone.xml`**: Defines the drone's mass, inertia, and visual geometry. Uses a `freejoint` for unconstrained 6-DOF motion.
*   **`cartpole.xml` / `ant.xml`**: Classic robotics benchmarks included for verification.

### `/wasm/antigravity/lib/`
*   **`mujoco_wasm.js` / `.wasm`**: The compiled MuJoCo engine. This is the heart of the physics simulation.

---

## 3. How to Run the Platform

### Step 1: Start the Development Server
The platform requires an HTTP server to correctly handle WASM MIME types and cross-origin isolation for pthreads.

```bash
cd antigravity-lab
python3 custom_scripts/serve.py
```
*The server runs by default on `http://localhost:8000`.*

### Step 2: Access the Frontend
Open your browser and navigate to:
**[http://localhost:8000/sim-lab/frontend/index.html](http://localhost:8000/sim-lab/frontend/index.html)**

---

## 4. Control Interface (Drone Mode)

| Input Device | Control | Mapping |
| :--- | :--- | :--- |
| **Keyboard** | Lateral | `W`, `A`, `S`, `D` |
| | Yaw | `Q`, `E` |
| | Altitude | `Space` (Up) / `Shift` (Down) |
| **Gamepad** | Lateral | Left Stick |
| | Yaw | Right Stick (X) |
| | Altitude | Triggers (RT=Up, LT=Down) |

---

## 5. Development Workflow

### Adding a New Model
1. Place your MJCF `.xml` file in `/sim-lab/models/`.
2. Open `/sim-lab/frontend/main.js`.
3. Locate the `Model Registration` section.
4. Add: `modelManager.register('my_model', '../models/my_model.xml', 'Display Name');`.

### Tuning Stabilization
The PD gains for the drone are located in `/src/controllers/DroneController.js`:
- `kp_vel`: Responsibility for velocity tracking.
- `kp_att`: Strength of the "keep-upright" stabilization.

---

## 6. Performance Guarantees
- **Target**: 60 FPS (stable).
- **Zero Allocations**: No `new` objects or arrays are created inside the `loop()` function to prevent Garbage Collection stutters.
- **Typed Arrays**: All data transfer between WASM and JavaScript uses pre-allocated `Float32Array` views.
