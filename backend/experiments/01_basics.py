import mujoco
import time
import os

# 1. Load the Model
# The XML file defines the physics, geometry, and joints (the "static" part).
model_path = "../../models/humanoid.xml"
if not os.path.exists(model_path):
    # Fallback if running from a different directory
    model_path = "antigravity-lab/models/humanoid.xml"

print(f"Loading model from: {model_path}")
model = mujoco.MjModel.from_xml_path(model_path)

# 2. Create the Data
# MjData holds the *state* of the simulation (positions, velocities, forces).
# This is separate from MjModel so you can have multiple states for one model (parallel training).
data = mujoco.MjData(model)

print(f"Model loaded with {model.nq} generalized coordinates (qpos) and {model.nv} degrees of freedom (qvel).")

# 3. Simulate (Headless)
print("\nStarting simulation loop (1000 steps)...")
start_time = time.time()

for i in range(1000):
    # Apply a control signal (optional).
    # For a humanoid, this would be joint torques.
    # data.ctrl[:] = 0.0 # Zero control
    
    # Step the physics forward by model.opt.timestep (default 0.002s)
    mujoco.mj_step(model, data)
    
    if i % 100 == 0:
        # qpos[2] is typically the Z-position (height) of the root for a free joint
        height = data.qpos[2]
        print(f"Step {i}: Root Height = {height:.4f} m")

end_time = time.time()
print(f"\nSimulation finished in {end_time - start_time:.4f} seconds.")
print(f"Final height: {data.qpos[2]:.4f} m")
print("\nKey Takeaway: 'mujoco.mj_step(model, data)' is the heartbeat of your simulation.")
