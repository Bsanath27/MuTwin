/**
 * AnalyticsPanel.js — Chart.js Live Metrics
 * 
 * Design:
 * - Lazily loads Chart.js from vendor directory
 * - Maintains fixed-window scrolling charts (Max 50 points)
 * - Throttles updates to preserve performance (e.g., 10Hz)
 */
export class AnalyticsPanel {
    constructor(container) {
        this.container = container;
        this.charts = {};
        this.maxPoints = 50;
        this.isLoaded = false;
        this._isVisible = false;

        // Create containers immediately so this.overlay exists
        this._createContainers();
    }

    /**
     * Lazily load Chart.js and initialize canvases.
     */
    async init() {
        if (this.isLoaded) return;

        // Load Chart.js if not present
        if (typeof window.Chart === 'undefined') {
            try {
                await this._loadScript('vendor/chart.4.4.3.umd.min.js');
                console.info("Analytics: Chart.js loaded.");
            } catch (e) {
                console.error("Analytics: Failed to load Chart.js", e);
                return;
            }
        }

        this._initCharts();
        this.isLoaded = true;
    }

    _createContainers() {
        this.container.innerHTML = `
            <div id="analytics-overlay" class="analytics-hidden">
                <div class="chart-wrapper"><canvas id="reward-chart"></canvas></div>
                <div class="chart-wrapper"><canvas id="position-chart"></canvas></div>
                <div class="chart-wrapper"><canvas id="velocity-chart"></canvas></div>
            </div>
        `;
        this.overlay = document.getElementById('analytics-overlay');
    }

    _initCharts() {
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            elements: { point: { radius: 0 } },
            scales: {
                x: { display: false },
                y: { grid: { color: '#333' }, ticks: { color: '#aaa', font: { size: 10 } } }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: { color: '#fff', boxWidth: 10, font: { size: 11 } }
                }
            }
        };

        const Chart = window.Chart;

        this.charts.reward = new Chart(document.getElementById('reward-chart'), {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Reward', data: [], borderColor: '#4cc9f0', borderWidth: 2 }] },
            options: commonOptions
        });

        this.charts.position = new Chart(document.getElementById('position-chart'), {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Height (Z)', data: [], borderColor: '#f72585', borderWidth: 2 }] },
            options: commonOptions
        });

        this.charts.velocity = new Chart(document.getElementById('velocity-chart'), {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Speed', data: [], borderColor: '#7209b7', borderWidth: 2 }] },
            options: commonOptions
        });
    }

    /**
     * Update charts with new metrics.
     * @param {object} metrics - { time, reward, z, velocity }
     */
    update(metrics) {
        if (!this.isLoaded || !this._isVisible) return;

        const label = metrics.time.toFixed(1);
        this._addData(this.charts.reward, label, metrics.reward);
        this._addData(this.charts.position, label, metrics.z);
        this._addData(this.charts.velocity, label, metrics.velocity);
    }

    _addData(chart, label, data) {
        chart.data.labels.push(label);
        chart.data.datasets[0].data.push(data);

        if (chart.data.labels.length > this.maxPoints) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }
        chart.update('none'); // Update without animation for speed
    }

    toggle() {
        this._isVisible = !this._isVisible;
        if (this._isVisible) {
            this.overlay.classList.remove('analytics-hidden');
            if (!this.isLoaded) this.init();
        } else {
            this.overlay.classList.add('analytics-hidden');
        }
        return this._isVisible;
    }

    reset() {
        if (!this.isLoaded) return;
        Object.values(this.charts).forEach(chart => {
            chart.data.labels = [];
            chart.data.datasets[0].data = [];
            chart.update();
        });
    }

    _loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
}
