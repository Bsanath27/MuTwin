#!/bin/bash
set -e

# Create virtual environment
if command -v python3.11 &> /dev/null; then
    python3.11 -m venv ../env
else
    echo "Python 3.11 not found, using python3"
    python3 -m venv ../env
fi

source ../env/bin/activate

# Install dependencies
pip install --upgrade pip
pip install mujoco gymnasium stable-baselines3

# Version checks
python3 -c "import mujoco; print(f'MuJoCo version: {mujoco.__version__}')"
python3 -c "import gymnasium; print(f'Gymnasium version: {gymnasium.__version__}')"
python3 -c "import stable_baselines3; print(f'Stable Baselines3 version: {stable_baselines3.__version__}')"

echo "Setup complete. Virtual environment ready in env/"
