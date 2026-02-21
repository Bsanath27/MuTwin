# MuTwin: Drone Simulation Playground Documentation (v2.1)

MuTwin is a high-performance, browser-based robotics simulation platform utilizing MuJoCo via WebAssembly. It features a modular architecture, 6-DOF drone simulation, PD stabilization, and real-time analytics.

---

## 1. Folder Structure Overview

```text
/antigravity-lab/
├── assets/                 # CONSOLIDATED: Static simulation assets
│   └── models/             # All MJCF files (drone.xml, ant.xml, etc.)
├── src/                    # Application Source Code
│   └── frontend/           # Web Interface (HTML, JS, CSS, client-side logic)
├── wasm/                   # MuJoCo WASM Core Libraries
├── custom_scripts/         # Backend utility scripts
│   └── serve.py           # HTTP server for the WASM platform
├── scripts/                # Launch and setup scripts
│   ├── setup.sh           # Environment setup
│   └── run_frontend.sh    # Launches the browser platform
├── PROJECT_GUIDE.md        # This document
└── .gitignore              # Git exclusion rules
```

---

## 2. Key Directories & File Responsibilities

### `/src/frontend/src/` (The Core Logic)
*   **`core/PhysicsEngine.js`**: Isolated MuJoCo WASM wrapper. Manages memory, stepping, and state caching.
*   **`core/ControllerManager.js`**: Handles hot-swapping between Manual, RL, and Drone controllers.
*   **`render/Renderer.js`**: Three.js scene manager. Maps MuJoCo geoms to 3D meshes with zero-allocation updates.
*   **`controllers/DroneController.js`**: The 6-DOF stabilization brain. Runs PD loops for velocity tracking and attitude control.
*   **`controllers/JoystickHandler.js`**: Input layer for Gamepad and Keyboard.

### `/assets/models/` (The Physical World)
*   **`drone.xml`**: Defines the drone's mass, inertia, and visual geometry. Uses a `freejoint` for unconstrained 6-DOF motion.
*   **`cartpole.xml` / `ant.xml`**: Classic robotics benchmarks.

### `/wasm/antigravity/lib/`
*   **`mujoco_wasm.js` / `.wasm`**: The compiled MuJoCo engine core.

---

## 3. How to Run the Platform

### Step 1: Start the Development Server
The platform requires an HTTP server to correctly handle WASM MIME types and cross-origin isolation.

```bash
cd antigravity-lab
python3 custom_scripts/serve.py
```
*The server runs by default on `http://localhost:8000`.*

### Step 2: Access the Frontend
Open your browser and navigate to:
**[http://localhost:8000/src/frontend/index.html](http://localhost:8000/src/frontend/index.html)**

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
1. Place your MJCF `.xml` file in `/assets/models/`.
2. Open `/src/frontend/main.js`.
3. Locate the `Model Registration` section.
4. Add: `modelManager.register('my_model', '../../assets/models/my_model.xml', 'Display Name');`.

### Tuning Stabilization
The PD gains for the drone are located in `/src/frontend/src/controllers/DroneController.js`:
- `kp_vel`: Responsibility for velocity tracking.
- `kp_att`: Strength of the "keep-upright" stabilization.
