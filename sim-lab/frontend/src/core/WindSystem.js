/**
 * WindSystem.js — Periodic Wind Disturbance
 *
 * Applies sinusoidal external force to a body when enabled.
 * Configurable amplitude, frequency, and direction.
 * ZERO allocations per frame.
 */
export class WindSystem {
    /**
     * @param {import('./PhysicsEngine.js').PhysicsEngine} physics
     */
    constructor(physics) {
        this.physics = physics;
        this.enabled = false;

        // Wind parameters
        this.amplitude = 3.0;    // Newtons peak
        this.frequency = 0.5;    // Hz
        this.bodyIdx = 1;        // Target body (drone)

        // Wind direction (normalized, XY plane)
        this._dirX = 1.0;
        this._dirY = 0.3;

        // Normalize direction
        const mag = Math.sqrt(this._dirX * this._dirX + this._dirY * this._dirY);
        this._dirX /= mag;
        this._dirY /= mag;

        // Phase offset for variety
        this._phase = Math.random() * Math.PI * 2;
    }

    /**
     * Apply wind force. Call once per frame before physics step.
     * @param {number} time - Simulation time
     */
    update(time) {
        if (!this.enabled || !this.physics.data) return;

        const windMag = this.amplitude * Math.sin(
            2 * Math.PI * this.frequency * time + this._phase
        );

        // Add a perpendicular gust component for realism
        const gustMag = this.amplitude * 0.3 * Math.sin(
            2 * Math.PI * this.frequency * 2.7 * time + this._phase + 1.5
        );

        const fx = windMag * this._dirX + gustMag * (-this._dirY);
        const fy = windMag * this._dirY + gustMag * this._dirX;

        // Apply as additive force (doesn't clear existing xfrc)
        const d = this.physics.data;
        const off = this.bodyIdx * 6;
        d.xfrc_applied[off] += fx;
        d.xfrc_applied[off + 1] += fy;
        // No vertical wind component
    }

    /**
     * Toggle wind on/off.
     * @returns {boolean} New enabled state
     */
    toggle() {
        this.enabled = !this.enabled;
        if (this.enabled) {
            this._phase = Math.random() * Math.PI * 2;
        }
        return this.enabled;
    }

    /**
     * Randomize wind direction.
     */
    randomizeDirection() {
        const angle = Math.random() * Math.PI * 2;
        this._dirX = Math.cos(angle);
        this._dirY = Math.sin(angle);
    }
}
