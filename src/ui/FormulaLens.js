/**
 * 公式與積木雙向對照卡（V3.0 可折疊減壓版）
 * - 切換：代號公式 / 數字算式 / 積木長寬高
 * - 自由實驗模式下支援折疊；引導模式中需要講解公式時自動展開
 */

import katex from 'katex';

function renderFormulaToken(el, tex, fallbackText) {
  try {
    katex.render(tex, el, { displayMode: false, throwOnError: false });
  } catch {
    el.textContent = fallbackText;
  }
}

export class FormulaLens {
  constructor(container, store) {
    this.container = container;
    this.store = store;
    this._lastSpecKey = '';
    this._renderShell();
    this._bindEvents();
  }

  _renderShell() {
    this.container.innerHTML = `
      <details class="glass-card formula-drawer" data-role="formula-drawer" open>
        <summary class="drawer-summary">
          <div class="drawer-summary-left">
            <span class="drawer-title">📐 公式與積木對照</span>
            <span class="drawer-sub">滑鼠移到算式可同步亮起 3D 積木</span>
          </div>
          <span class="drawer-arrow">收合 ▴</span>
        </summary>

        <div class="drawer-body">
          <div class="lens-tabs" role="tablist" aria-label="公式檢視模式">
            <button type="button" class="lens-tab" data-formula-mode="symbolic">代號公式</button>
            <button type="button" class="lens-tab" data-formula-mode="numeric">數字算式</button>
            <button type="button" class="lens-tab" data-formula-mode="geometric">積木長寬高</button>
          </div>

          <div class="formula-stage" data-role="formula-stage"></div>
        </div>
      </details>
    `;
  }

  _bindEvents() {
    const drawer = this.container.querySelector('[data-role="formula-drawer"]');
    drawer.addEventListener('toggle', () => {
      const arrow = drawer.querySelector('.drawer-arrow');
      if (arrow) arrow.textContent = drawer.open ? '收合 ▴' : '展開 ▾';
    });

    this.container.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-formula-mode]');
      if (!btn) return;
      this.store.setState({ formulaMode: btn.dataset.formulaMode });
    });

    this.container.addEventListener('pointerover', (event) => {
      const tokenEl = event.target.closest('[data-token]');
      if (!tokenEl) return;
      this.store.setHoveredToken(tokenEl.dataset.token);
    });

    this.container.addEventListener('pointerout', (event) => {
      const tokenEl = event.target.closest('[data-token]');
      if (!tokenEl) return;
      const related = event.relatedTarget?.closest?.('[data-token]');
      if (!related) {
        this.store.setHoveredToken(null);
      }
    });
  }

  setOpen(open) {
    const drawer = this.container.querySelector('[data-role="formula-drawer"]');
    if (drawer) drawer.open = Boolean(open);
  }

  update(spec, hoveredToken) {
    for (const btn of this.container.querySelectorAll('.lens-tab')) {
      btn.classList.toggle('is-active', btn.dataset.formulaMode === spec.mode);
    }

    const stageEl = this.container.querySelector('[data-role="formula-stage"]');
    if (this._lastSpecKey !== spec.key) {
      this._lastSpecKey = spec.key;
      stageEl.innerHTML = '';

      for (const part of spec.parts) {
        if (part.type === 'op') {
          const opSpan = document.createElement('span');
          opSpan.className = 'formula-op';
          opSpan.textContent = part.text;
          stageEl.appendChild(opSpan);
        } else {
          const tokenSpan = document.createElement('span');
          tokenSpan.className = `formula-token ${part.colorRole ? `role-${part.colorRole}` : ''}`;
          tokenSpan.dataset.token = part.token;
          renderFormulaToken(tokenSpan, part.tex, part.fallback || part.tex);
          stageEl.appendChild(tokenSpan);
        }
      }
    }

    for (const el of stageEl.querySelectorAll('[data-token]')) {
      el.classList.toggle('is-hovered', Boolean(hoveredToken && el.dataset.token === hoveredToken));
    }
  }
}
