/**
 * 共用題目與珠子編輯器（V3.0 折疊減壓版）
 * - 預設收合為精簡 1 行「目前題目：... ｜ 更換題目或自訂珠子 ▾」，絕不把模組核心實驗擠出螢幕外
 * - 內部採用獨立份數／權重輸入框 + 即時換算百分比，輸入 50 / 25 / 25 絕不飄移
 */

import { DATASET_PRESETS, BEAD_PALETTE } from '../core/presets.js';

export class ControlPanel {
  constructor(container, store, opts = {}) {
    this.container = container;
    this.store = store;
    this.allowNegative = opts.allowNegative ?? true;
    this._abortController = new AbortController();
    this._renderScaffold();
    this._bindEvents();
    this.update(this.store.getState());
  }

  _renderScaffold() {
    this.container.innerHTML = `
      <details class="glass-card dataset-drawer" data-role="dataset-drawer">
        <summary class="drawer-summary">
          <div class="drawer-summary-left">
            <span class="drawer-title">📝 更換題目或自訂珠子</span>
            <span class="drawer-sub" data-role="banner-name">目前題目：整數小樣本 {2, 4, 6}</span>
          </div>
          <span class="drawer-arrow">展開 ▾</span>
        </summary>

        <div class="drawer-body">
          <div class="active-dataset-banner">
            <label class="lock-toggle" title="開啟時，第 2、3、4 站會共用同一組珠子題目">
              <input type="checkbox" data-role="lock-dataset-toggle" />
              <span>跨站同步題目</span>
            </label>
            <button type="button" class="ghost-btn is-xs" data-role="btn-reset-default">重置回 {2,4,6}</button>
          </div>

          <div class="preset-bar">
            <select id="shared-preset-select" class="select-input" data-role="shared-preset-select" aria-label="選擇範例題目">
              <option value="custom">-- 自訂珠子資料 --</option>
              ${DATASET_PRESETS.map((p) => `<option value="${p.id}">${p.label}</option>`).join('')}
            </select>
            <p class="preset-insight" data-role="preset-insight"></p>
          </div>

          <div class="bead-editor-header">
            <span class="field-label">各珠位置與份數（自動換算 %）</span>
            <button type="button" class="ghost-btn" data-role="btn-add-bead">＋ 新增珠子</button>
          </div>

          <div class="bead-list" data-role="bead-list"></div>
        </div>
      </details>
    `;
  }

  _bindEvents() {
    const { signal } = this._abortController;

    const drawer = this.container.querySelector('[data-role="dataset-drawer"]');
    drawer.addEventListener(
      'toggle',
      () => {
        const arrow = drawer.querySelector('.drawer-arrow');
        if (arrow) arrow.textContent = drawer.open ? '收合 ▴' : '展開 ▾';
      },
      { signal }
    );

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
        if (event.target.closest('[data-role="btn-reset-default"]')) {
          const def = DATASET_PRESETS[0];
          this.store.setState({
            beads: def.beads.map((b) => ({ ...b })),
            pivotOverride: null
          });
          return;
        }

        if (event.target.closest('[data-role="btn-add-bead"]')) {
          const current = this.store.getState().beads;
          if (current.length >= 8) return;
          const maxX = current.reduce((m, b) => Math.max(m, b.x), 0);
          const nextId = `b${Date.now().toString(36)}`;
          const nextBeads = [
            ...current,
            { id: nextId, x: Number((maxX + 1).toFixed(2)), rawWeight: 20 }
          ];
          this.store.setState({ beads: nextBeads, pivotOverride: null });
          return;
        }

        const removeBtn = event.target.closest('[data-remove-bead]');
        if (removeBtn) {
          const id = removeBtn.dataset.removeBead;
          const current = this.store.getState().beads;
          if (current.length <= 1) return;
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
        const rawStr = event.target.value;
        if (rawStr === '' || rawStr === '-') return;
        const val = Number(rawStr);
        if (!Number.isFinite(val)) return;

        const nextBeads = current.map((b) => {
          if (b.id !== targetId) return b;
          if (xInput) {
            const safeX = this.allowNegative ? val : Math.max(0, val);
            return { ...b, x: safeX };
          }
          return { ...b, rawWeight: Math.max(0, val) };
        });

        this.store.setBeads(nextBeads);
      },
      { signal }
    );
  }

  _matchPreset(beads) {
    for (const preset of DATASET_PRESETS) {
      if (preset.beads.length !== beads.length) continue;
      const same = preset.beads.every(
        (pb, idx) =>
          Math.abs(pb.x - beads[idx].x) < 1e-6 &&
          Math.abs(pb.p - beads[idx].p) < 1e-6
      );
      if (same) return preset;
    }
    return null;
  }

  update(state) {
    const lockToggle = this.container.querySelector('[data-role="lock-dataset-toggle"]');
    lockToggle.checked = Boolean(state.lockDataset);

    const presetObj = this._matchPreset(state.beads);
    const matchedId = presetObj ? presetObj.id : 'custom';

    const selectEl = this.container.querySelector('[data-role="shared-preset-select"]');
    selectEl.value = matchedId;

    const bannerName = this.container.querySelector('[data-role="banner-name"]');
    const shortName = presetObj
      ? presetObj.label.split('（')[0]
      : `自訂 {${state.beads.map((b) => b.x).join(', ')}}`;
    bannerName.textContent = `目前：${shortName}${state.lockDataset ? '（跨站同步中）' : ''}`;

    const insightEl = this.container.querySelector('[data-role="preset-insight"]');
    insightEl.textContent = presetObj
      ? presetObj.insight
      : '左邊填位置、右邊填份數（例如 50、25、25），右側直接顯示換算百分比。';

    const listEl = this.container.querySelector('[data-role="bead-list"]');
    const focused = document.activeElement;
    const focusedAttr = focused?.dataset?.beadX
      ? `x:${focused.dataset.beadX}`
      : focused?.dataset?.beadW
        ? `w:${focused.dataset.beadW}`
        : null;

    const existingRows = listEl.querySelectorAll('[data-bead-row]');
    if (focusedAttr && existingRows.length === state.beads.length) {
      state.beads.forEach((b) => {
        const pctEl = listEl.querySelector(`[data-bead-pct="${b.id}"]`);
        if (pctEl) pctEl.textContent = `佔比 ${(b.p * 100).toFixed(1)}%`;
      });
      return;
    }

    listEl.innerHTML = state.beads
      .map((b, index) => {
        const color = BEAD_PALETTE[index % BEAD_PALETTE.length];
        const canRemove = state.beads.length > 1;
        const rawW = b.rawWeight !== undefined ? b.rawWeight : Number((b.p * 100).toFixed(1));
        return `
          <div class="bead-row is-v2" data-bead-row="${b.id}">
            <span class="bead-swatch" style="background:${color}"></span>
            <label class="bead-field">
              <span>位置 x</span>
              <input
                type="number"
                step="0.5"
                ${this.allowNegative ? '' : 'min="0"'}
                value="${b.x}"
                class="num-input"
                data-bead-x="${b.id}"
              />
            </label>
            <label class="bead-field">
              <span>份數／權重</span>
              <input
                type="number"
                min="0"
                step="any"
                value="${rawW}"
                class="num-input"
                data-bead-w="${b.id}"
              />
            </label>
            <span class="bead-pct-pill" data-bead-pct="${b.id}">佔比 ${(b.p * 100).toFixed(1)}%</span>
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
