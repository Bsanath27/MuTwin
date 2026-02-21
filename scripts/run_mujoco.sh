#!/bin/bash
source ../env/bin/activate
if [ -z "$1" ]; then
    MODEL="../models/humanoid.xml"
else
    MODEL="$1"
fi
python3 -m mujoco.viewer --mjcf="$MODEL"
