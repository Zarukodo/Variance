/**
 * 共用控制面板元件（實戰劇本下拉選單、自訂珠子編輯器、跨模組數據鎖定）
 * 供模組 2、3、4 共用，修改權重後自動正規化確保 ΣP(x) = 1
 */

import { DATASET_PRESETS, BEAD_PALETTE } from '../core/presets.js';

export class ControlPanel {
  /**
   * @param {HTMLElement} container
   * @param {import('../core/store.js').store} store
   * @param {{ allowNegative?: boolean }} [opts]
   */
  constructor(container, store, opts = {}) {
    this.container = container;
    this.store = store;
    this.allowNegative = opts.allowNegative ?? true;
    this._abortController = new AbortController();
    this._activePresetId = 'small_int';
    this._renderScaffold();
    this._bindEvents();
    this.update(this.store.getState());
  }

  _renderScaffold() {
    this.container.innerHTML = `
      <section class="glass-card dataset-panel">
        <div class="card-header">
          <div>
            <p class="eyebrow">SHARED DATASET &amp; PRESETS</p>
            <h2 class="card-title">劇本預設與自訂珠子編輯器</h2>
          </div>
          <label class="lock-toggle" title="開啟時，模組 2 / 3 / 4 切換將共享同一組珠子數據">
            <input type="checkbox" data-role="lock-dataset-toggle" checked />
            <span>跨模組鎖定</span>
          </label>
        </div>

        <div class="preset-bar">
          <label class="field-label" for="shared-preset-select">實戰數值劇本</label>
          <select id="shared-preset-select" class="select-input" data-role="shared-preset-select">
            <option value="custom">-- 自訂珠子資料 --</option>
            ${DATASET_PRESETS.map((p) => `<option value="${p.id}">${p.label}</option>`).join('')}
          </select>
          <p class="preset-insight" data-role="preset-insight"></p>
        </div>

        <div class="bead-editor-header">
          <span class="field-label">珠子清單（自動正規化 ΣP = 1）</span>
          <button type="button" class="ghost-btn" data-role="btn-add-bead">＋ 新增珠子</button>
        </div>

        <div class="bead-list" data-role="bead-list"></div>
      </section>
    `;
  }

  _bindEvents() {
    const { signal } = this._abortController;

    this.container.addEventListener(
      'change',
      (event) => {
        if (event.target.matches('[data-role="lock-dataset-toggle"]')) {
          this.store.setState({ lockDataset: event.target.checked });
          return;
        }

        if (event.target.matches('[data-role="shared-preset-select"]')) {
          const preset = DATASET_PRESETS.find((p) => p.id === event.target.value);
          if (!preset) return;
          this._activePresetId = preset.id;
          this.store.setState({
            beads: preset.beads.map((b) => ({ ...b })),
            pivotOverride: null
          });
        }
      },
      { signal }
    );

    this.container.addEventListener(
      'click',
      (event) => {
        if (event.target.closest('[data-role="btn-add-bead"]')) {
          const current = this.store.getState().beads;
          if (current.length >= 8) return;
          const maxX = current.reduce((m, b) => Math.max(m, b.x), 0);
          const nextId = `b${Date.now().toString(36)}`;
          const nextBeads = [
            ...current,
            { id: nextId, x: Number((maxX + 1).toFixed(2)), p: 0.2 }
          ];
          this._activePresetId = 'custom';
          this.store.setState({ beads: nextBeads, pivotOverride: null });
          return;
        }

        const removeBtn = event.target.closest('[data-remove-bead]');
        if (removeBtn) {
          const id = removeBtn.dataset.removeBead;
          const current = this.store.getState().beads;
          if (current.length <= 1) return;
          this._activePresetId = 'custom';
          this.store.setState({
            beads: current.filter((b) => b.id !== id),
            pivotOverride: null
          });
        }
      },
      { signal }
    );

    this.container.addEventListener(
      'input',
      (event) => {
        const xInput = event.target.closest('[data-bead-x]');
        const wInput = event.target.closest('[data-bead-w]');
        if (!xInput && !wInput) return;

        const current = this.store.getState().beads;
        const targetId = xInput ? xInput.dataset.beadX : wInput.dataset.beadW;
        const val = Number(event.target.value);
        if (!Number.isFinite(val)) return;

        const nextBeads = current.map((b) => {
          if (b.id !== targetId) return b;
          if (xInput) {
            const safeX = this.allowNegative ? val : Math.max(0, val);
            return { ...b, x: safeX };
          }
          return { ...b, p: Math.max(0.01, val) };
        });

        this._activePresetId = 'custom';
        this.store.setBeads(nextBeads);
      },
      { signal }
    );
  }

  _matchPresetId(beads) {
    for (const preset of DATASET_PRESETS) {
      if (preset.beads.length !== beads.length) continue;
      const same = preset.beads.every(
        (pb, idx) =>
          Math.abs(pb.x - beads[idx].x) < 1e-6 &&
          Math.abs(pb.p - beads[idx].p) < 1e-6
      );
      if (same) return preset.id;
    }
    return 'custom';
  }

  update(state) {
    const lockToggle = this.container.querySelector('[data-role="lock-dataset-toggle"]');
    lockToggle.checked = Boolean(state.lockDataset);

    const matchedPreset = this._matchPresetId(state.beads);
    this._activePresetId = matchedPreset;

    const selectEl = this.container.querySelector('[data-role="shared-preset-select"]');
    selectEl.value = matchedPreset;

    const insightEl = this.container.querySelector('[data-role="preset-insight"]');
    const presetObj = DATASET_PRESETS.find((p) => p.id === matchedPreset);
    insightEl.textContent = presetObj
      ? presetObj.insight
      : '自訂數據模式：拖動任一珠子座標或權重，系統即時正規化 ΣP(x)=1 並重算三軌變異數。';

    const listEl = this.container.querySelector('[data-role="bead-list"]');
    const focused = document.activeElement;
    const focusedAttr = focused?.dataset?.beadX
      ? `x:${focused.dataset.beadX}`
      : focused?.dataset?.beadW
        ? `w:${focused.dataset.beadW}`
        : null;

    // 若使用者正在連續輸入或拖曳滑桿，保留現有 DOM 只更新百分比文字，避免焦點跳脫
    const existingRows = listEl.querySelectorAll('[data-bead-row]');
    if (focusedAttr && existingRows.length === state.beads.length) {
      state.beads.forEach((b) => {
        const pctEl = listEl.querySelector(`[data-bead-pct="${b.id}"]`);
        if (pctEl) pctEl.textContent = `P=${(b.p * 100).toFixed(1)}%`;
      });
      return;
    }

    listEl.innerHTML = state.beads
      .map((b, index) => {
        const color = BEAD_PALETTE[index % BEAD_PALETTE.length];
        const canRemove = state.beads.length > 1;
        return `
          <div class="bead-row" data-bead-row="${b.id}">
            <span class="bead-swatch" style="background:${color}"></span>
            <label class="bead-field">
              <span>座標 x</span>
              <input
                type="number"
                step="0.5"
                ${this.allowNegative ? '' : 'min="0"'}
                value="${b.x}"
                class="num-input"
                data-bead-x="${b.id}"
              />
            </label>
            <label class="bead-field is-weight">
              <span>權重 <strong data-bead-pct="${b.id}">P=${(b.p * 100).toFixed(1)}%</strong></span>
              <input
                type="range"
                min="0.02"
                max="1"
                step="0.01"
                value="${Math.max(0.02, b.p).toFixed(2)}"
                class="range-slider"
                data-bead-w="${b.id}"
              />
            </label>
            <button
              type="button"
              class="icon-btn"
              data-remove-bead="${b.id}"
              ${canRemove ? '' : 'disabled title="至少保留一顆珠子"'}
            >✕</button>
          </div>
        `;
      })
      .join('');
  }

  dispose() {
    this._abortController.abort();
    this.container.innerHTML = '';
  }
}
