/**
 * DroneHUD.js — Lightweight Drone Telemetry Overlay
 *
 * Displays altitude, speed, thrust%, and control mode.
 * Cached DOM refs. Updates at 10Hz. ZERO per-frame allocations.
 */
export class DroneHUD {
    /**
     * @param {HTMLElement} container - Parent element for HUD
     */
    constructor(container) {
        this.container = container;
        this._els = {};
        this._visible = true;
        this._createDOM();
    }

    _createDOM() {
        const hud = document.createElement('div');
        hud.id = 'drone-hud';
        hud.innerHTML = `
            <div class="hud-row">
                <span class="hud-label">ALT</span>
                <span class="hud-value" id="hud-alt">0.0 m</span>
            </div>
            <div class="hud-row">
                <span class="hud-label">SPD</span>
                <span class="hud-value" id="hud-spd">0.0 m/s</span>
            </div>
            <div class="hud-row">
                <span class="hud-label">THR</span>
                <div class="hud-bar-track">
                    <div class="hud-bar-fill" id="hud-thr-bar"></div>
                </div>
                <span class="hud-value hud-small" id="hud-thr">0%</span>
            </div>
            <div class="hud-row">
                <span class="hud-label">MODE</span>
                <span class="hud-value hud-mode" id="hud-mode">Manual</span>
            </div>
            <div class="hud-row hud-input-hint" id="hud-input-hint">
                <span>WASD · QE · Space/Shift</span>
            </div>
        `;
        this.container.appendChild(hud);

        // Cache refs
        this._els.alt = document.getElementById('hud-alt');
        this._els.spd = document.getElementById('hud-spd');
        this._els.thr = document.getElementById('hud-thr');
        this._els.thrBar = document.getElementById('hud-thr-bar');
        this._els.mode = document.getElementById('hud-mode');
        this._els.hint = document.getElementById('hud-input-hint');
        this._hud = hud;
    }

    /**
     * Update HUD values. Call at 10Hz.
     * @param {{ altitude: number, speed: number, thrustPct: number, mode: string }} telemetry
     * @param {boolean} hasGamepad
     */
    update(telemetry, hasGamepad) {
        if (!this._visible) return;

        this._els.alt.textContent = telemetry.altitude.toFixed(1) + ' m';
        this._els.spd.textContent = telemetry.speed.toFixed(1) + ' m/s';
        this._els.thr.textContent = Math.round(telemetry.thrustPct) + '%';
        this._els.thrBar.style.width = Math.min(100, telemetry.thrustPct) + '%';

        // Color thrust bar based on intensity
        const pct = telemetry.thrustPct;
        if (pct > 80) {
            this._els.thrBar.style.background = '#f85149';
        } else if (pct > 50) {
            this._els.thrBar.style.background = '#d29922';
        } else {
            this._els.thrBar.style.background = '#3fb950';
        }

        this._els.mode.textContent = telemetry.mode;
        this._els.mode.className = 'hud-value hud-mode ' +
            (telemetry.mode === 'RL' ? 'hud-mode-rl' : 'hud-mode-manual');

        this._els.hint.style.display = hasGamepad ? 'none' : 'flex';
    }

    toggle() {
        this._visible = !this._visible;
        this._hud.style.display = this._visible ? 'flex' : 'none';
        return this._visible;
    }
}
