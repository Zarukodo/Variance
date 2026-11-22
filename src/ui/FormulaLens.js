/**
 * 三態公式透鏡（FormulaLens）與雙向高亮發射器
 * - 切換：符號版 (symbolic) / 實數代入版 (numeric) / 幾何尺寸版 (geometric)
 * - 懸停任一公式項 [data-token] 即觸發 store.setHoveredToken(token)
 * - 同步監聽 store.hoveredToken，使 3D 端懸停時對應公式項同步亮起霓虹框
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
  /**
   * @param {HTMLElement} container
   * @param {import('../core/store.js').store} store
   */
  constructor(container, store) {
    this.container = container;
    this.store = store;
    this._lastSpecKey = '';
    this._renderShell();
    this._bindEvents();
  }

  _renderShell() {
    this.container.innerHTML = `
      <section class="glass-card formula-card">
        <div class="card-header">
          <div>
            <p class="eyebrow">THREE-STATE FORMULA LENS</p>
            <h2 class="card-title">三態公式透鏡（雙向聯動）</h2>
          </div>
        </div>

        <div class="lens-tabs" role="tablist" aria-label="公式檢視模式">
          <button type="button" class="lens-tab" data-formula-mode="symbolic">符號版</button>
          <button type="button" class="lens-tab" data-formula-mode="numeric">實數代入</button>
          <button type="button" class="lens-tab" data-formula-mode="geometric">幾何尺寸</button>
        </div>

        <div class="formula-stage" data-role="formula-stage"></div>
        <p class="formula-hint">將滑鼠移至公式項或左側 3D 積木，可雙向高亮並顯示稜邊尺寸。</p>
      </section>
    `;
  }

  _bindEvents() {
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

  /**
   * 依目前模式渲染對應之公式片段陣列
   * @param {{ mode: string, parts: Array<{ type: 'op' | 'token', text?: string, tex?: string, fallback?: string, token?: string, colorRole?: string }>, key: string }} spec
   * @param {string | null} hoveredToken
   */
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
