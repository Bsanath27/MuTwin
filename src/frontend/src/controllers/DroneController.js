/**
 * DroneController.js — PD Stabilization Controller for 6-DOF Drone
 *
 * Pipeline per frame:
 *   1. Read velocity command from JoystickHandler (or RL)
 *   2. Read drone state: position, quaternion, linear/angular velocity
 *   3. Compute PD force for velocity tracking + gravity compensation
 *   4. Compute PD torque for attitude stabilization (roll/pitch → 0)
 *   5. Apply yaw torque from command
 *   6. Write forces/torques via physics.applyBodyForce()
 *
 * Implements controller interface:
 *   { init(nu, ranges), update(state), getControl(), dispose() }
 *
 * NOTE: This controller does NOT use data.ctrl.
 * It writes directly to xfrc_applied on the drone body.
 */
export class DroneController {
    /**
     * @param {import('../core/PhysicsEngine.js').PhysicsEngine} physics
     * @param {import('./JoystickHandler.js').JoystickHandler} joystick
     */
    constructor(physics, joystick) {
        this.physics = physics;
        this.joystick = joystick;

        // PD gains — velocity tracking
        this.kp_vel = 8.0;
        this.kd_vel = 4.0;

        // PD gains — attitude stabilization (roll/pitch)
        this.kp_att = 12.0;
        this.kd_att = 3.0;

        // Yaw rate gain
        this.kp_yaw = 2.0;

        // Drone mass for gravity compensation
        this.mass = 1.2;
        this.gravity = 9.81;

        // Drone body index in MuJoCo (0 = world, 1 = drone)
        this.bodyIdx = 1;

        // Pre-allocated output — not used for data.ctrl, but satisfies interface
        this._control = new Float32Array(0);

        // Pre-allocated force/torque cache
        this._force = { fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0 };

        // External command override (for RL mode)
        this._externalCmd = null;

        // Enabled flag
        this.isEnabled = true;

        // Telemetry (read by HUD)
        this.telemetry = {
            altitude: 0,
            speed: 0,
            thrustPct: 0,
            mode: 'Manual'
        };
    }

    init(nu, ranges) {
        this._control = new Float32Array(nu);
    }

    /**
     * Set an external velocity command (used by RL controller).
     * @param {{ vx: number, vy: number, vz: number, yaw: number }} cmd
     */
    setExternalCommand(cmd) {
        this._externalCmd = cmd;
    }

    clearExternalCommand() {
        this._externalCmd = null;
    }

    /**
     * Main update. Called each frame by ControllerManager.
     * @param {object} state - From PhysicsEngine.getState()
     */
    update(state) {
        if (!this.isEnabled || !this.physics.data) return;

        // 1. Get velocity command
        const cmd = this._externalCmd || this.joystick.poll();

        // 2. Read drone state
        const d = this.physics.data;
        const pos = [d.qpos[0], d.qpos[1], d.qpos[2]];
        const quat = [d.qpos[3], d.qpos[4], d.qpos[5], d.qpos[6]]; // w, x, y, z
        const linVel = [d.qvel[0], d.qvel[1], d.qvel[2]];
        const angVel = [d.qvel[3], d.qvel[4], d.qvel[5]];

        // 3. Velocity tracking — PD in world frame
        const velErrX = cmd.vx - linVel[0];
        const velErrY = cmd.vy - linVel[1];
        const velErrZ = cmd.vz - linVel[2];

        let fx = this.kp_vel * velErrX - this.kd_vel * linVel[0];
        let fy = this.kp_vel * velErrY - this.kd_vel * linVel[1];
        let fz = this.kp_vel * velErrZ - this.kd_vel * linVel[2];

        // 4. Gravity compensation
        fz += this.mass * this.gravity;

        // 5. Attitude stabilization — extract roll/pitch from quaternion
        const roll = this._quatToRoll(quat);
        const pitch = this._quatToPitch(quat);

        // Torque to zero roll and pitch
        const tx = -this.kp_att * roll - this.kd_att * angVel[0];
        const ty = -this.kp_att * pitch - this.kd_att * angVel[1];

        // 6. Yaw control
        const tz = this.kp_yaw * cmd.yaw - this.kd_att * angVel[2];

        // 7. Clamp forces to prevent explosion
        const maxForce = 50;
        const maxTorque = 10;
        this._force.fx = this._clamp(fx, -maxForce, maxForce);
        this._force.fy = this._clamp(fy, -maxForce, maxForce);
        this._force.fz = this._clamp(fz, 0, maxForce); // No downward thrust
        this._force.tx = this._clamp(tx, -maxTorque, maxTorque);
        this._force.ty = this._clamp(ty, -maxTorque, maxTorque);
        this._force.tz = this._clamp(tz, -maxTorque, maxTorque);

        // 8. Apply to physics
        this.physics.applyBodyForce(
            this.bodyIdx,
            this._force.fx, this._force.fy, this._force.fz,
            this._force.tx, this._force.ty, this._force.tz
        );

        // 9. Update telemetry
        this.telemetry.altitude = pos[2];
        this.telemetry.speed = Math.sqrt(linVel[0] ** 2 + linVel[1] ** 2 + linVel[2] ** 2);
        const totalForce = Math.sqrt(fx * fx + fy * fy + fz * fz);
        this.telemetry.thrustPct = Math.min(100, (totalForce / maxForce) * 100);
        this.telemetry.mode = this._externalCmd ? 'RL' : 'Manual';
    }

    /**
     * Extract roll angle from quaternion (w, x, y, z).
     */
    _quatToRoll(q) {
        const sinr = 2 * (q[0] * q[1] + q[2] * q[3]);
        const cosr = 1 - 2 * (q[1] * q[1] + q[2] * q[2]);
        return Math.atan2(sinr, cosr);
    }

    /**
     * Extract pitch angle from quaternion (w, x, y, z).
     */
    _quatToPitch(q) {
        const sinp = 2 * (q[0] * q[2] - q[3] * q[1]);
        return Math.abs(sinp) >= 1
            ? Math.sign(sinp) * (Math.PI / 2)
            : Math.asin(sinp);
    }

    _clamp(v, lo, hi) {
        return v < lo ? lo : v > hi ? hi : v;
    }

    getControl() {
        return this._control; // Not used for drone; forces applied via xfrc
    }

    dispose() {
        this._control = new Float32Array(0);
        this._externalCmd = null;
    }
}
