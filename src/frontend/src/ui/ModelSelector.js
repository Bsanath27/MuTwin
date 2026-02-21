/**
 * ModelSelector.js — Model Dropdown + Drag-and-Drop
 * 
 * Design:
 * - Populates dropdown from ModelManager registry
 * - Drag-and-drop accepts .xml files
 * - Emits selection events via callback
 */
export class ModelSelector {
    /**
     * @param {HTMLSelectElement} selectEl - Dropdown element
     * @param {HTMLElement} dropZoneEl - Drop zone overlay
     * @param {Function} onSelect - Callback(key) for dropdown selection
     * @param {Function} onDrop - Callback(xml, filename) for dropped files
     */
    constructor(selectEl, dropZoneEl, onSelect, onDrop) {
        this.selectEl = selectEl;
        this.dropZone = dropZoneEl;
        this._onSelect = onSelect;
        this._onDrop = onDrop;

        this._bindDropdown();
        this._bindDragDrop();
    }

    /**
     * Populate dropdown from a model list.
     * @param {Array<{ key: string, label: string }>} models
     * @param {string} [activeKey] - Currently loaded model
     */
    populate(models, activeKey) {
        this.selectEl.innerHTML = '';
        for (const m of models) {
            const opt = document.createElement('option');
            opt.value = m.key;
            opt.textContent = m.label;
            if (m.key === activeKey) opt.selected = true;
            this.selectEl.appendChild(opt);
        }
    }

    _bindDropdown() {
        this.selectEl.addEventListener('change', () => {
            this._onSelect(this.selectEl.value);
        });
    }

    _bindDragDrop() {
        // Show drop zone when dragging over window
        window.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('active');
        });

        window.addEventListener('dragleave', (e) => {
            if (e.relatedTarget === null) {
                this.dropZone.classList.remove('active');
            }
        });

        window.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('active');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                if (file.name.endsWith('.xml')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        this._onDrop(event.target.result, file.name);
                    };
                    reader.readAsText(file);
                }
            }
        });
    }
}
