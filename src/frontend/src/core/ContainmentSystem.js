/**
 * ContainmentSystem.js — Simulation Safety Net
 * 
 * Three independent strategies, each toggleable:
 * 
 * 1. BOUNDARY BOX: If any body exceeds configurable box, request reset
 * 2. SOFT RESET:   If any body exceeds radius R from origin, request reset
 * 3. NaN GUARD:    If NaN or extreme velocity detected, force reset
 * 
 * Design:
 * - Pure logic; does NOT call physics.reset() itself
 * - Returns action enum so the main loop decides what to do
 * - Zero allocations in check() path
 */
export class ContainmentSystem {
    constructor() {
        // Strategy toggles
        this.boundaryEnabled = true;
        this.softResetEnabled = true;
        this.nanGuardEnabled = true;

        // Boundary box half-extents [x, y, z]
        this.boundaryExtents = [10, 10, 10];

        // Soft reset radius from origin
        this.softResetRadius = 15;

        // Velocity explosion threshold (m/s)
        this.velocityThreshold = 100;
    }

    /**
     * Check all containment strategies against current state.
     * 
     * @param {import('./PhysicsEngine.js').PhysicsEngine} physics
     * @returns {{ action: 'none'|'reset', reason: string }}
     */
    check(physics) {
        // Strategy 3: NaN/explosion guard (highest priority)
        if (this.nanGuardEnabled) {
            const result = this._checkNaN(physics);
            if (result) return result;
        }

        // Strategy 2: Soft reset boundary
        if (this.softResetEnabled) {
            const result = this._checkSoftReset(physics);
            if (result) return result;
        }

        // Strategy 1: Boundary box
        if (this.boundaryEnabled) {
            const result = this._checkBoundary(physics);
            if (result) return result;
        }

        return { action: 'none', reason: '' };
    }

    /**
     * Check for NaN values or extreme velocities in simulation state.
     */
    _checkNaN(physics) {
        const vel = physics.getVelocities();
        if (!vel) return null;

        for (let i = 0; i < vel.length; i++) {
            if (isNaN(vel[i]) || !isFinite(vel[i])) {
                return { action: 'reset', reason: 'NaN detected in velocities' };
            }
            if (Math.abs(vel[i]) > this.velocityThreshold) {
                return { action: 'reset', reason: `Velocity explosion: |v[${i}]| = ${Math.abs(vel[i]).toFixed(1)}` };
            }
        }

        const pos = physics.getBodyPositions();
        if (!pos) return null;
        for (let i = 0; i < pos.length; i++) {
            if (isNaN(pos[i]) || !isFinite(pos[i])) {
                return { action: 'reset', reason: 'NaN detected in positions' };
            }
        }

        return null;
    }

    /**
     * Check if any body has exceeded the soft reset radius.
     */
    _checkSoftReset(physics) {
        const pos = physics.getBodyPositions();
        if (!pos) return null;

        const nbody = physics.nbody;
        const R2 = this.softResetRadius * this.softResetRadius;

        for (let i = 1; i < nbody; i++) { // skip world body 0
            const x = pos[i * 3];
            const y = pos[i * 3 + 1];
            const z = pos[i * 3 + 2];
            const d2 = x * x + y * y + z * z;
            if (d2 > R2) {
                return { action: 'reset', reason: `Body ${i} exceeded radius ${this.softResetRadius}` };
            }
        }
        return null;
    }

    /**
     * Check if any body has exceeded the containment boundary box.
     */
    _checkBoundary(physics) {
        const pos = physics.getBodyPositions();
        if (!pos) return null;

        const nbody = physics.nbody;
        const [bx, by, bz] = this.boundaryExtents;

        for (let i = 1; i < nbody; i++) {
            const x = Math.abs(pos[i * 3]);
            const y = Math.abs(pos[i * 3 + 1]);
            const z = Math.abs(pos[i * 3 + 2]);
            if (x > bx || y > by || z > bz) {
                return { action: 'reset', reason: `Body ${i} exceeded boundary box` };
            }
        }
        return null;
    }

    /**
     * Update boundary extents.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    setBounds(x, y, z) {
        this.boundaryExtents = [x, y, z];
    }
}
