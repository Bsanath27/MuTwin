# Antigravity Lab

## Purpose
A scalable platform for MuJoCo-based antigravity simulation and Reinforcement Learning research. Separation of high-performance WASM frontend and Python backend for training.

## Setup
```bash
cd scripts
chmod +x setup.sh
./setup.sh
```

## Architecture
```
[ Frontend (WASM/JS) ] <--(WebSocket)--> [ Backend (Python/RL) ]
       |                                       |
    [ MuJoCo Engine ]                     [ Training Loop ]
       |                                       |
 [ Rendering (Three.js) ]               [ Agent Snapshots ]
```
