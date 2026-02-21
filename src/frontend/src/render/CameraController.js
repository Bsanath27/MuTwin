/**
 * CameraController.js — Interactive 3D Camera
 * 
 * Custom orbit/pan/zoom implementation. No external dependencies.
 * 
 * Controls:
 * - Left drag:   Orbit
 * - Right drag:  Pan
 * - Scroll:      Zoom
 * - Double click: Reset camera
 * 
 * Design:
 * - Operates on spherical coordinates for smooth orbiting
 * - Damping for cinematic feel
 * - focusOnBody() lerps camera target to a body position
 * - Does NOT interfere with physics — purely visual
 */
import * as THREE from '../../vendor/three.0.160.0.module.js';

export class CameraController {
    /**
     * @param {THREE.PerspectiveCamera} camera
     * @param {HTMLCanvasElement} canvas
     */
    constructor(camera, canvas) {
        this.camera = camera;
        this.canvas = canvas;

        // Spherical coordinates (relative to target)
        this.target = new THREE.Vector3(0, 0, 0.5);
        this.spherical = new THREE.Spherical(8, Math.PI / 3, Math.PI * 0.75);

        // Damping
        this.damping = 0.08;
        this.enabled = true;

        // Velocity for smooth motion
        this._sphericalDelta = new THREE.Spherical();
        this._panOffset = new THREE.Vector3();
        this._zoomDelta = 0;

        // Input state
        this._isDragging = false;
        this._button = -1;
        this._lastX = 0;
        this._lastY = 0;

        // Constraints
        this.minDistance = 1;
        this.maxDistance = 50;
        this.minPolarAngle = 0.05;
        this.maxPolarAngle = Math.PI - 0.05;

        // Sensitivity
        this.orbitSpeed = 0.005;
        this.panSpeed = 0.01;
        this.zoomSpeed = 0.1;

        // Focus lerp
        this._focusTarget = null;
        this._focusProgress = 1;

        // Default position for reset
        this._defaultSpherical = this.spherical.clone();
        this._defaultTarget = this.target.clone();

        // Follow mode
        this._followEnabled = false;
        this._followPos = new THREE.Vector3();
        this._followLerp = 0.06;

        this._bindEvents();
        this._applySpherical();
    }

    _bindEvents() {
        const c = this.canvas;

        c.addEventListener('mousedown', (e) => {
            if (!this.enabled) return;
            this._isDragging = true;
            this._button = e.button;
            this._lastX = e.clientX;
            this._lastY = e.clientY;
            e.preventDefault();
        });

        c.addEventListener('mousemove', (e) => {
            if (!this._isDragging || !this.enabled) return;
            const dx = e.clientX - this._lastX;
            const dy = e.clientY - this._lastY;
            this._lastX = e.clientX;
            this._lastY = e.clientY;

            if (this._button === 0) {
                // Orbit
                this._sphericalDelta.theta -= dx * this.orbitSpeed;
                this._sphericalDelta.phi -= dy * this.orbitSpeed;
            } else if (this._button === 2) {
                // Pan
                const panX = -dx * this.panSpeed * this.spherical.radius * 0.05;
                const panY = dy * this.panSpeed * this.spherical.radius * 0.05;

                // Pan relative to camera orientation
                const right = new THREE.Vector3();
                const up = new THREE.Vector3();
                right.setFromMatrixColumn(this.camera.matrix, 0);
                up.setFromMatrixColumn(this.camera.matrix, 1);

                this._panOffset.addScaledVector(right, panX);
                this._panOffset.addScaledVector(up, panY);
            }
        });

        c.addEventListener('mouseup', () => { this._isDragging = false; });
        c.addEventListener('mouseleave', () => { this._isDragging = false; });

        c.addEventListener('wheel', (e) => {
            if (!this.enabled) return;
            e.preventDefault();
            this._zoomDelta += e.deltaY * this.zoomSpeed * 0.01;
        }, { passive: false });

        c.addEventListener('dblclick', () => {
            if (!this.enabled) return;
            this.reset();
        });

        c.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    /**
     * Update camera position. Call once per frame.
     * Applies damping for smooth motion.
     */
    update() {
        if (!this.enabled) return;

        // Apply deltas with damping
        this.spherical.theta += this._sphericalDelta.theta * this.damping;
        this.spherical.phi += this._sphericalDelta.phi * this.damping;
        this.spherical.radius += this._zoomDelta * this.damping;

        // Apply pan
        this.target.addScaledVector(this._panOffset, this.damping);

        // Decay deltas
        this._sphericalDelta.theta *= (1 - this.damping);
        this._sphericalDelta.phi *= (1 - this.damping);
        this._zoomDelta *= (1 - this.damping);
        this._panOffset.multiplyScalar(1 - this.damping);

        // Clamp
        this.spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.spherical.phi));
        this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));

        // Focus lerp
        if (this._focusTarget && this._focusProgress < 1) {
            this._focusProgress = Math.min(1, this._focusProgress + 0.02);
            this.target.lerp(this._focusTarget, 0.05);
        }

        this._applySpherical();
    }

    /**
     * Convert spherical coordinates to camera world position.
     */
    _applySpherical() {
        const offset = new THREE.Vector3();
        offset.setFromSpherical(this.spherical);

        this.camera.position.copy(this.target).add(offset);
        this.camera.lookAt(this.target);
    }

    /**
     * Smoothly focus camera on a body position.
     * @param {number[]} pos - [x, y, z] world position
     */
    focusOnBody(pos) {
        this._focusTarget = new THREE.Vector3(pos[0], pos[1], pos[2]);
        this._focusProgress = 0;
    }

    /**
     * Reset to default camera position.
     */
    reset() {
        this.spherical.copy(this._defaultSpherical);
        this.target.copy(this._defaultTarget);
        this._sphericalDelta.set(0, 0, 0);
        this._panOffset.set(0, 0, 0);
        this._zoomDelta = 0;
        this._focusTarget = null;
        this._focusProgress = 1;
    }

    /**
     * Smoothly move camera target to follow a world position.
     * Call each frame with the drone's current position.
     * @param {number[]} pos - [x, y, z]
     */
    setFollowTarget(pos) {
        if (!this._followEnabled) return;
        this._followPos.set(pos[0], pos[1], pos[2]);
        this.target.lerp(this._followPos, this._followLerp);
    }

    /**
     * Toggle follow mode.
     * @returns {boolean} New follow state
     */
    toggleFollow() {
        this._followEnabled = !this._followEnabled;
        return this._followEnabled;
    }
}
