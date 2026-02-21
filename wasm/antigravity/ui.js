export function initUI(app) {
    const gravityToggle = document.getElementById('gravity-toggle');
    const gravitySlider = document.getElementById('gravity-slider');
    const gravityValue = document.getElementById('gravity-value');
    const rlToggle = document.getElementById('rl-toggle');
    const resetBtn = document.getElementById('reset-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const analyticsBtn = document.getElementById('analytics-btn');
    const modelSelect = document.getElementById('model-select');
    const ctrlSlider = document.getElementById('ctrl-slider');
    const ctrlValue = document.getElementById('ctrl-value');

    // Model Selector
    modelSelect.addEventListener('change', (e) => {
        app.loadModel(e.target.value);
    });

    // Gravity Toggle
    gravityToggle.addEventListener('change', (e) => {
        const active = e.target.checked;
        app.toggleGravity(active);
        gravitySlider.disabled = !active;
        if (active) {
            app.setGravity(parseFloat(gravitySlider.value));
        }
    });

    // Gravity Slider
    gravitySlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        gravityValue.textContent = val.toFixed(2) + " m/s²";
        if (gravityToggle.checked) {
            app.setGravity(val);
        }
    });

    // --- NEW PHYSICS SLIDERS ---
    const torqueSlider = document.getElementById('torque-slider');
    const torqueValue = document.getElementById('torque-value');
    if (torqueSlider) {
        torqueSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            torqueValue.textContent = val.toFixed(1) + " N⋅m";
            if (app.physics) app.physics.setTorqueLimit(val);
        });
    }

    const massSlider = document.getElementById('mass-slider');
    const massValue = document.getElementById('mass-value');
    if (massSlider) {
        massSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            massValue.textContent = val.toFixed(1) + " kg";
            if (app.physics) app.physics.setPendulumMass(val);
        });
    }

    const dampingSlider = document.getElementById('damping-slider');
    const dampingValue = document.getElementById('damping-value');
    if (dampingSlider) {
        dampingSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            dampingValue.textContent = val.toFixed(3);
            if (app.physics) app.physics.setJointDamping(val);
        });
    }
    if (ctrlSlider) {
        ctrlSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            ctrlValue.textContent = val.toFixed(2);
            app.setManualCtrl(val);
        });
        app.setManualCtrl(parseFloat(ctrlSlider.value));
    }
    // ---------------------------

    // RL Toggle
    rlToggle.addEventListener('change', (e) => {
        app.toggleRL(e.target.checked);
    });

    // Reset
    resetBtn.addEventListener('click', () => {
        app.reset();
    });

    // Pause
    pauseBtn.addEventListener('click', () => {
        const isPaused = app.togglePause();
        pauseBtn.textContent = isPaused ? "Resume" : "Pause";
    });

    if (analyticsBtn) {
        analyticsBtn.addEventListener('click', async () => {
            const body = document.body;
            const hidden = body.classList.contains('charts-hidden');
            if (hidden) {
                body.classList.remove('charts-hidden');
                analyticsBtn.textContent = 'Hide Analytics';
                await ensureChartsLoaded();
                window.dispatchEvent(new Event('resize'));
            } else {
                body.classList.add('charts-hidden');
                analyticsBtn.textContent = 'Show Analytics';
                window.dispatchEvent(new Event('resize'));
            }
        });
    }

    // --- DRAG AND DROP ---
    const dropZone = document.getElementById('drop-zone');

    window.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('active');
    });

    window.addEventListener('dragleave', (e) => {
        // Only hide if we actually leave the window
        if (e.relatedTarget === null) {
            dropZone.classList.remove('active');
        }
    });

    window.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('active');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.name.endsWith('.xml')) {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const xml = event.target.result;
                    app.loadModelFromXML(xml, file.name);
                };
                reader.readAsText(file);
            } else {
                alert("Please drop a MuJoCo XML file.");
            }
        }
    });
}

let charts = {};
const MAX_POINTS = 50;

let chartLoadStarted = false;
let chartLoadPromise = null;
async function ensureChartsLoaded() {
    if (typeof Chart !== 'undefined') {
        initCharts();
        return;
    }
    if (chartLoadStarted) {
        if (chartLoadPromise) await chartLoadPromise;
        return;
    }
    chartLoadStarted = true;
    chartLoadPromise = loadScript('./vendor/chart.4.4.3.umd.min.js');
    try {
        await chartLoadPromise;
        initCharts();
    } catch (e) {
        console.warn('Chart.js unavailable, continuing without charts:', e.message);
    }
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-src="${src}"]`);
        if (existing) {
            if (existing.dataset.loaded === 'true') {
                resolve();
                return;
            }
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.dataset.src = src;
        script.addEventListener('load', () => {
            script.dataset.loaded = 'true';
            resolve();
        }, { once: true });
        script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
        document.head.appendChild(script);
    });
}

function initCharts() {
    try {
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            elements: { point: { radius: 0 } },
            scales: {
                x: { display: false },
                y: { grid: { color: '#333' }, ticks: { color: '#aaa' } }
            },
            plugins: { legend: { display: true, labels: { color: '#fff' } } }
        };

        const ctxReward = document.getElementById('reward-chart');
        if (ctxReward) {
            charts.reward = new Chart(ctxReward, {
                type: 'line',
                data: { labels: [], datasets: [{ label: 'Reward', data: [], borderColor: '#4cc9f0', borderWidth: 2 }] },
                options: commonOptions
            });
        }

        const ctxPos = document.getElementById('position-chart');
        if (ctxPos) {
            charts.position = new Chart(ctxPos, {
                type: 'line',
                data: { labels: [], datasets: [{ label: 'Height (Z)', data: [], borderColor: '#f72585', borderWidth: 2 }] },
                options: commonOptions
            });
        }

        const ctxVel = document.getElementById('velocity-chart');
        if (ctxVel) {
            charts.velocity = new Chart(ctxVel, {
                type: 'line',
                data: { labels: [], datasets: [{ label: 'Speed', data: [], borderColor: '#7209b7', borderWidth: 2 }] },
                options: commonOptions
            });
        }
    } catch (e) {
        console.error("Chart init failed", e);
    }
}

export function updateDashboard(metrics, fps, episode) {
    if (!document.getElementById('fps-counter')) return;

    document.getElementById('fps-counter').textContent = fps.toFixed(0);
    document.getElementById('episode-counter').textContent = episode;
    document.getElementById('sim-time').textContent = metrics.time.toFixed(2) + 's';

    const label = metrics.time.toFixed(1);

    if (charts.reward && charts.reward.data) addData(charts.reward, label, metrics.reward);
    if (charts.position && charts.position.data) addData(charts.position, label, metrics.z);
    if (charts.velocity && charts.velocity.data) addData(charts.velocity, label, metrics.velocity);
}

function addData(chart, label, data) {
    if (!chart || !chart.data) return;

    chart.data.labels.push(label);
    if (chart.data.datasets) {
        chart.data.datasets.forEach((dataset) => {
            dataset.data.push(data);
        });

        if (chart.data.labels.length > MAX_POINTS) {
            chart.data.labels.shift();
            chart.data.datasets.forEach((dataset) => {
                dataset.data.shift();
            });
        }
    }
    chart.update();
}
export function resetCharts() {
    Object.values(charts).forEach(chart => {
        if (chart && chart.data) {
            chart.data.labels = [];
            chart.data.datasets.forEach(dataset => {
                dataset.data = [];
            });
            chart.update();
        }
    });
}
