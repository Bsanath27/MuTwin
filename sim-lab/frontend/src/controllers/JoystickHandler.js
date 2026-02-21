/**
 * JoystickHandler.js — Gamepad & Keyboard Input
 *
 * Reads gamepad or keyboard and outputs a velocity command struct.
 * Pre-allocated command object — ZERO allocations per frame.
 *
 * Gamepad mapping:
 *   Left stick X/Y  → vx, vy (lateral)
 *   Right stick X    → yaw
 *   Right trigger    → lift up
 *   Left trigger     → lift down
 *
 * Keyboard fallback:
 *   W/S → vy, A/D → vx, Q/E → yaw, Space → up, Shift → down
 */
export class JoystickHandler {
    constructor() {
        // Pre-allocated command — mutated in place
        this._cmd = { vx: 0, vy: 0, vz: 0, yaw: 0 };

        // Keyboard state
        this._keys = {};
        this._gamepadIndex = -1;

        // Tuning
        this.deadzone = 0.12;
        this.maxSpeed = 3.0;    // m/s lateral
        this.maxLift = 4.0;     // m/s vertical
        this.maxYawRate = 2.0;  // rad/s

        this._bindKeyboard();
    }

    _bindKeyboard() {
        window.addEventListener('keydown', (e) => {
            this._keys[e.code] = true;
        });
        window.addEventListener('keyup', (e) => {
            this._keys[e.code] = false;
        });

        // Detect gamepad connection
        window.addEventListener('gamepadconnected', (e) => {
            this._gamepadIndex = e.gamepad.index;
            console.info(`Gamepad connected: ${e.gamepad.id}`);
        });
        window.addEventListener('gamepaddisconnected', () => {
            this._gamepadIndex = -1;
            console.info('Gamepad disconnected');
        });
    }

    /**
     * Apply deadzone to an axis value.
     * @param {number} v - Raw axis value [-1, 1]
     * @returns {number} Filtered value
     */
    _applyDeadzone(v) {
        if (Math.abs(v) < this.deadzone) return 0;
        // Rescale so output starts from 0 after deadzone
        const sign = v > 0 ? 1 : -1;
        return sign * (Math.abs(v) - this.deadzone) / (1 - this.deadzone);
    }

    /**
     * Poll inputs and update command struct.
     * Call once per frame. ZERO ALLOCATIONS.
     * @returns {{ vx: number, vy: number, vz: number, yaw: number }}
     */
    poll() {
        const cmd = this._cmd;
        cmd.vx = 0;
        cmd.vy = 0;
        cmd.vz = 0;
        cmd.yaw = 0;

        // Try gamepad first
        if (this._gamepadIndex >= 0) {
            const gamepads = navigator.getGamepads();
            const gp = gamepads[this._gamepadIndex];
            if (gp) {
                // Left stick: lateral movement
                cmd.vx = this._applyDeadzone(gp.axes[0]) * this.maxSpeed;
                cmd.vy = -this._applyDeadzone(gp.axes[1]) * this.maxSpeed; // Invert Y

                // Right stick X: yaw
                cmd.yaw = this._applyDeadzone(gp.axes[2]) * this.maxYawRate;

                // Triggers: lift (RT = up, LT = down)
                // axes[5] = RT (-1 to 1), axes[4] = LT (-1 to 1)
                // Some gamepads use buttons instead
                const rt = gp.buttons[7] ? gp.buttons[7].value : 0;
                const lt = gp.buttons[6] ? gp.buttons[6].value : 0;
                cmd.vz = (rt - lt) * this.maxLift;

                return cmd;
            }
        }

        // Keyboard fallback
        const k = this._keys;
        if (k['KeyW'] || k['ArrowUp']) cmd.vy = this.maxSpeed;
        if (k['KeyS'] || k['ArrowDown']) cmd.vy = -this.maxSpeed;
        if (k['KeyA'] || k['ArrowLeft']) cmd.vx = -this.maxSpeed;
        if (k['KeyD'] || k['ArrowRight']) cmd.vx = this.maxSpeed;
        if (k['KeyQ']) cmd.yaw = -this.maxYawRate;
        if (k['KeyE']) cmd.yaw = this.maxYawRate;
        if (k['Space']) cmd.vz = this.maxLift;
        if (k['ShiftLeft'] || k['ShiftRight']) cmd.vz = -this.maxLift;

        return cmd;
    }

    /**
     * Check if a gamepad is connected.
     * @returns {boolean}
     */
    get hasGamepad() {
        return this._gamepadIndex >= 0;
    }

    dispose() {
        this._keys = {};
        this._gamepadIndex = -1;
    }
}
