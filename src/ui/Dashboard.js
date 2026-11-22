/**
 * 折疊式數學對答案驗算表（V2.0 減壓版）
 * - 預設收合（showVerificationTable = false），不強迫新手一開始就面對 9 位小數
 * - 點開即可即時比對定義版、捷徑版、引力網版三種變異數演算法（誤差 < 1e-9）
 */

import katex from 'katex';
import {
  computeAllMetrics,
  computeBernoulliMetrics,
  computeBinomialMetrics
} from '../core/mathEngine.js';
import { MATH_TOLERANCE } from '../core/constants.js';

function renderMath(el, tex, fallbackText) {
  if (!el) return;
  try {
    katex.render(tex, el, { displayMode: false, throwOnError: false });
  } catch {
    el.textContent = fallbackText;
  }
}

function fmt(num, digits = 6) {
  if (!Number.isFinite(num)) return 'NaN';
  return num.toFixed(digits);
}

function fmtSci(num) {
  if (!Number.isFinite(num)) return 'NaN';
  if (num === 0) return '0.00e+0';
  return num.toExponential(2);
}

export class Dashboard {
  /**
   * @param {HTMLElement} container
   * @param {import('../core/store.js').store} store
   */
  constructor(container, store) {
    this.container = container;
    this.store = store;
    this._renderScaffold();
    this._bindEvents();
    this.update(this.store.getState());
  }

  _renderScaffold() {
    this.container.innerHTML = `
      <details class="glass-card verify-drawer" data-role="verify-drawer">
        <summary class="verify-summary">
          <div class="verify-summary-left">
            <span class="verify-title">🔬 數學對答案驗算表</span>
            <span class="verify-quick" data-role="verify-quick-summary">μ = 0.30 · σ² = 0.21</span>
          </div>
          <span class="status-badge" data-role="consistency-badge">三軌一致 PASS</span>
        </summary>

        <div class="verify-body">
          <div class="metrics-summary">
            <div class="metric-pill">
              <span class="metric-label">機率總和 <span data-math="sumP"></span></span>
              <strong class="mono-value" data-role="sum-p">1.000000</strong>
            </div>
            <div class="metric-pill">
              <span class="metric-label">重心 <span data-math="mu"></span></span>
              <strong class="mono-value accent-mu" data-role="mu-val">0.000000</strong>
            </div>
            <div class="metric-pill">
              <span class="metric-label">尺規 <span data-math="sigma"></span></span>
              <strong class="mono-value accent-sd" data-role="sd-val">0.000000</strong>
            </div>
          </div>

          <div class="tracks-list">
            <div class="track-row">
              <div class="track-name">
                <span class="track-tag">定義版</span>
                <span class="track-tex" data-math="def"></span>
              </div>
              <code class="track-value" data-role="var-def">0.000000000</code>
            </div>
            <div class="track-row">
              <div class="track-name">
                <span class="track-tag">捷徑版</span>
                <span class="track-tex" data-math="short"></span>
              </div>
              <code class="track-value" data-role="var-short">0.000000000</code>
            </div>
            <div class="track-row">
              <div class="track-name">
                <span class="track-tag">引力網版</span>
                <span class="track-tex" data-math="web"></span>
              </div>
              <code class="track-value" data-role="var-web">0.000000000</code>
            </div>
          </div>

          <div class="diff-footer">
            <span>三種算法最大誤差（門檻 &lt; 10<sup>-9</sup>）</span>
            <code class="mono-value" data-role="max-diff">0.00e+0</code>
          </div>

          <p class="notice-text verify-note" data-role="active-summary"></p>
        </div>
      </details>
    `;

    renderMath(this.container.querySelector('[data-math="sumP"]'), '\\sum P(x)', 'ΣP(x)');
    renderMath(this.container.querySelector('[data-math="mu"]'), '\\mu', 'μ');
    renderMath(this.container.querySelector('[data-math="sigma"]'), '\\sigma', 'σ');
    renderMath(this.container.querySelector('[data-math="def"]'), '\\sum (x-\\mu)^2 P(x)', 'Σ(x-μ)²P(x)');
    renderMath(this.container.querySelector('[data-math="short"]'), '\\sum x^2 P(x) - \\mu^2', 'Σx²P(x)-μ²');
    renderMath(
      this.container.querySelector('[data-math="web"]'),
      '\\tfrac{1}{2}\\sum_i\\sum_j P_i P_j (x_i-x_j)^2',
      '½ΣΣP_iP_j(x_i-x_j)²'
    );
  }

  _bindEvents() {
    const drawer = this.container.querySelector('[data-role="verify-drawer"]');
    drawer.addEventListener('toggle', () => {
      this.store.setState({ showVerificationTable: drawer.open });
    });
  }

  update(state) {
    const drawer = this.container.querySelector('[data-role="verify-drawer"]');
    if (drawer.open !== Boolean(state.showVerificationTable)) {
      drawer.open = Boolean(state.showVerificationTable);
    }

    const isBernoulliView =
      state.activeModule === 'mod1' ||
      (state.activeModule === 'mod3' && state.mod3SubMode === 'bernoulli');

    let activeBeads;
    if (isBernoulliView) {
      activeBeads = computeBernoulliMetrics(state.bernoulliPi).beads;
    } else if (state.activeModule === 'mod5') {
      const n = Math.max(1, Math.floor(state.binomialN || 1));
      activeBeads = Array.from({ length: n + 1 }, (_, k) => ({
        id: `bin${k}`,
        x: k,
        p: computeBinomialMetrics(n, k, state.bernoulliPi).probX
      }));
    } else {
      activeBeads = state.beads;
    }

    const metrics = computeAllMetrics(activeBeads, state.pivotOverride);

    this.container.querySelector('[data-role="verify-quick-summary"]').textContent =
      `μ = ${metrics.mu.toFixed(2)} · σ² = ${metrics.variance.toFixed(4)} · σ = ${metrics.sd.toFixed(3)}`;

    this.container.querySelector('[data-role="sum-p"]').textContent = fmt(metrics.sumP, 6);
    this.container.querySelector('[data-role="mu-val"]').textContent = fmt(metrics.mu, 6);
    this.container.querySelector('[data-role="sd-val"]').textContent = fmt(metrics.sd, 6);

    this.container.querySelector('[data-role="var-def"]').textContent = fmt(metrics.varDef, 9);
    this.container.querySelector('[data-role="var-short"]').textContent = fmt(metrics.varShort, 9);
    this.container.querySelector('[data-role="var-web"]').textContent = fmt(metrics.varWeb, 9);
    this.container.querySelector('[data-role="max-diff"]').textContent = fmtSci(metrics.maxDiff);

    const badge = this.container.querySelector('[data-role="consistency-badge"]');
    const pass = metrics.maxDiff < MATH_TOLERANCE;
    badge.textContent = pass ? '三軌一致 PASS' : '誤差超標';
    badge.classList.toggle('is-pass', pass);
    badge.classList.toggle('is-fail', !pass);

    const summaryEl = this.container.querySelector('[data-role="active-summary"]');
    if (isBernoulliView) {
      const b = computeBernoulliMetrics(state.bernoulliPi);
      summaryEl.textContent = `目前驗算單次二項 {0, 1}，π = ${b.pi.toFixed(2)}，理論變異數 π(1−π) = ${fmt(b.variance, 6)}。`;
    } else if (state.activeModule === 'mod5') {
      const bin = computeBinomialMetrics(state.binomialN, state.binomialX, state.bernoulliPi);
      summaryEl.textContent = `目前驗算完整二項分佈 B(n=${bin.n}, π=${bin.pi.toFixed(2)})，理論期望值 nπ = ${bin.mu.toFixed(2)}、理論變異數 = ${bin.variance.toFixed(6)}。`;
    } else {
      const coords = metrics.beads.map((b) => `(${b.x}, ${(b.p * 100).toFixed(1)}%)`).join('、');
      summaryEl.textContent = `目前驗算多珠資料：${coords}。`;
    }
  }
}
