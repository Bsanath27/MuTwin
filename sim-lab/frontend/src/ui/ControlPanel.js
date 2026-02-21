/**
 * ControlPanel.js — Dynamic Actuator UI
 * 
 * Auto-generates range sliders from model actuator metadata.
 * Batches DOM updates — never writes DOM per frame.
 * 
 * Design:
 * - buildSliders() called on model load, tears down previous DOM
 * - getValue(i) reads slider value (called by ManualController)
 * - No reference to WASM or PhysicsEngine
 */
export class ControlPanel {
    /**
     * @param {HTMLElement} container - DOM element to render sliders into
     */
    constructor(container) {
        this.container = container;
        this._sliders = [];
        this._values = new Float32Array(0);
    }

    /**
     * Rebuild slider UI from actuator info.
     * @param {{ count: number, ranges: Array<[number, number]>, names: string[] }} actuatorInfo
     */
    buildSliders(actuatorInfo) {
        // Clear previous
        this.container.innerHTML = '';
        this._sliders = [];
        this._values = new Float32Array(actuatorInfo.count);

        if (actuatorInfo.count === 0) {
            const msg = document.createElement('p');
            msg.className = 'no-actuators';
            msg.textContent = 'No actuators in this model';
            this.container.appendChild(msg);
            return;
        }

        const title = document.createElement('h3');
        title.textContent = 'Actuator Controls';
        this.container.appendChild(title);

        for (let i = 0; i < actuatorInfo.count; i++) {
            const [lo, hi] = actuatorInfo.ranges[i];
            const name = actuatorInfo.names[i];

            const group = document.createElement('div');
            group.className = 'ctrl-group';

            const label = document.createElement('label');
            label.textContent = name;

            const valSpan = document.createElement('span');
            valSpan.className = 'ctrl-value';
            valSpan.textContent = '0.00';

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = lo;
            slider.max = hi;
            slider.step = (hi - lo) / 200;
            slider.value = 0;
            slider.dataset.index = i;

            // Update value display and cache on input
            slider.addEventListener('input', () => {
                const v = parseFloat(slider.value);
                this._values[i] = v;
                valSpan.textContent = v.toFixed(2);
            });

            group.appendChild(label);
            group.appendChild(valSpan);
            group.appendChild(slider);
            this.container.appendChild(group);

            this._sliders.push(slider);
        }
    }

    /**
     * Get the current value for actuator i.
     * @param {number} i
     * @returns {number}
     */
    getValue(i) {
        return this._values[i] || 0;
    }

    /**
     * Get all current values as a Float32Array reference.
     * @returns {Float32Array}
     */
    getValues() {
        return this._values;
    }

    /**
     * Reset all sliders to zero.
     */
    reset() {
        for (let i = 0; i < this._sliders.length; i++) {
            this._sliders[i].value = 0;
            this._values[i] = 0;
        }
    }
}
