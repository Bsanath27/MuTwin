import gymnasium as gym
import time

# Gymnasium is a standard API for Reinforcement Learning envs.
# We will use the 'Humanoid-v4' environment which uses MuJoCo under the hood.

print("Creating Gymnasium environment 'Humanoid-v5'...")
# render_mode="human" will pop up a window. Use "rgb_array" for headless training.
env = gym.make("Humanoid-v5", render_mode="human")

# 1. Reset
# Resets the environment to an initial state and returns the first observation.
observation, info = env.reset(seed=42)

print("\nStarting RL Loop...")
print("The 'Action Space' determines what controls we can send:")
print(env.action_space)

for _ in range(300):
    # 2. Sample Action
    # In a real training loop, your 'Agent' (Neural Net) would predict this.
    # Here we just take a random action.
    action = env.action_space.sample()

    # 3. Step
    # Apply action and get new state, reward, key booleans.
    observation, reward, terminated, truncated, info = env.step(action)

    if terminated or truncated:
        observation, info = env.reset()

env.close()
print("\nDone! This loop (Observation -> Action -> Reward) is the foundation of RL.")
