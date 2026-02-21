/**
 * ParameterPanel.js — Physics & Containment Controls
 * 
 * Provides toggles and sliders for:
 * - Gravity override
 * - Timestep
 * - Containment strategy toggles
 * - Simulation pause/reset
 */
export class ParameterPanel {
    /**
     * @param {HTMLElement} container
     * @param {object} callbacks - { onGravity, onTimestep, onPause, onReset, onContainment }
     */
    constructor(container, callbacks) {
        this.container = container;
        this.cb = callbacks;
        this._isPaused = false;
        this._build();
    }

    _build() {
        this.container.innerHTML = '';

        // --- Gravity ---
        this._addSection('Physics');
        this._gravitySlider = this._addSlider('Gravity Z', -20, 20, -9.81, 0.1, (v) => {
            this.cb.onGravity(v);
        });

        this._timestepSlider = this._addSlider('Timestep', 0.001, 0.02, 0.005, 0.001, (v) => {
            this.cb.onTimestep(v);
        });

        // --- Containment ---
        this._addSection('Containment');
        this._addToggle('Boundary Box', true, (v) => this.cb.onContainment('boundary', v));
        this._addToggle('Soft Reset', true, (v) => this.cb.onContainment('softReset', v));
        this._addToggle('NaN Guard', true, (v) => this.cb.onContainment('nanGuard', v));

        // --- Sim Control ---
        this._addSection('Simulation');
        const btnRow = document.createElement('div');
        btnRow.className = 'btn-row';

        const pauseBtn = document.createElement('button');
        pauseBtn.id = 'pause-btn';
        pauseBtn.textContent = 'Pause';
        pauseBtn.addEventListener('click', () => {
            this._isPaused = !this._isPaused;
            pauseBtn.textContent = this._isPaused ? 'Resume' : 'Pause';
            this.cb.onPause(this._isPaused);
        });

        const resetBtn = document.createElement('button');
        resetBtn.id = 'reset-btn';
        resetBtn.textContent = 'Reset';
        resetBtn.addEventListener('click', () => this.cb.onReset());

        btnRow.appendChild(pauseBtn);
        btnRow.appendChild(resetBtn);
        this.container.appendChild(btnRow);
    }

    _addSection(title) {
        const h = document.createElement('h3');
        h.textContent = title;
        this.container.appendChild(h);
    }

    _addSlider(label, min, max, value, step, onChange) {
        const group = document.createElement('div');
        group.className = 'ctrl-group';

        const lbl = document.createElement('label');
        lbl.textContent = label;

        const valSpan = document.createElement('span');
        valSpan.className = 'ctrl-value';
        valSpan.textContent = value.toFixed(3);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = min;
        slider.max = max;
        slider.step = step;
        slider.value = value;

        slider.addEventListener('input', () => {
            const v = parseFloat(slider.value);
            valSpan.textContent = v.toFixed(3);
            onChange(v);
        });

        group.appendChild(lbl);
        group.appendChild(valSpan);
        group.appendChild(slider);
        this.container.appendChild(group);

        return slider;
    }

    _addToggle(label, defaultVal, onChange) {
        const group = document.createElement('div');
        group.className = 'ctrl-group toggle-group';

        const switchLabel = document.createElement('label');
        switchLabel.className = 'switch';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = defaultVal;
        checkbox.addEventListener('change', () => onChange(checkbox.checked));

        const slider = document.createElement('span');
        slider.className = 'slider-toggle round';

        switchLabel.appendChild(checkbox);
        switchLabel.appendChild(slider);

        const text = document.createElement('span');
        text.textContent = label;

        group.appendChild(switchLabel);
        group.appendChild(text);
        this.container.appendChild(group);
    }
}
