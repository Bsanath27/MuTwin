import mujoco
import mujoco.viewer
import time
import math
import os

# 1. Load the custom Hopper model
model_path = os.path.join(os.path.dirname(__file__), '../../models/custom/hopper.xml')
print(f"Loading custom robot from: {model_path}")

try:
    model = mujoco.MjModel.from_xml_path(model_path)
    data = mujoco.MjData(model)
except Exception as e:
    print(f"Error loading model: {e}")
    exit(1)

# 2. Launch the interactive viewer and run control loop
print("Launching interactive viewer. The robot will start hopping automatically!")
print("Close the viewer window to exit the script.")

with mujoco.viewer.launch_passive(model, data) as viewer:
    
    # Run the control loop while the viewer is open
    while viewer.is_running():
        step_start = time.time()
        sim_time = data.time
        
        # --- CONTROL LOGIC ---
        # The hopper has 3 motors: thigh_motor, leg_motor, foot_motor
        # Data.ctrl controls the motors in the order they are defined in XML
        
        # Create a simple "kicking" motion using sine waves
        # Phase shifting the sine waves makes the joints move in sequence
        kick_freq = 2.0  # Hz
        
        # Thigh swings back and forth
        data.ctrl[0] = math.sin(2 * math.pi * kick_freq * sim_time) * 100.0
        
        # Leg acts like a spring, opposing the thigh
        data.ctrl[1] = math.sin(2 * math.pi * kick_freq * sim_time + math.pi/2) * 100.0
        
        # Foot stabilizes
        data.ctrl[2] = math.sin(2 * math.pi * kick_freq * sim_time + math.pi) * 50.0
        # ---------------------
        
        # Step the physics engine forward once
        mujoco.mj_step(model, data)
        
        # Sync the viewer with the new physics state
        viewer.sync()
        
        # Sleep to keep the simulation running at roughly real-time (wall clock)
        time_until_next_step = model.opt.timestep - (time.time() - step_start)
        if time_until_next_step > 0:
            time.sleep(time_until_next_step)

print("Simulation finished.")
