/**
 * 即時驗算儀表板（Phase 0 核心驗證面板）
 * - 即時比對定義版、捷徑版、引力網版三種變異數演算法（誤差門檻 < 1e-9）
 * - 支援 Phase 0 跨劇本測試切換與 KaTeX 數學公式渲染（含 HTML 降級保護）
 */

import katex from 'katex';
import {
  computeAllMetrics,
  computeBernoulliMetrics,
  computeBinomialMetrics
} from '../core/mathEngine.js';
import { MATH_TOLERANCE } from '../core/constants.js';

const PHASE0_PRESETS = [
  {
    id: 'small_int',
    label: '整數小樣本 {2, 4, 6}',
    beads: [
      { id: 'b0', x: 2, p: 0.2 },
      { id: 'b1', x: 4, p: 0.5 },
      { id: 'b2', x: 6, p: 0.3 }
    ]
  },
  {
    id: 'stocks_volatile',
    label: '暴走對比 {0, 10}',
    beads: [
      { id: 'b0', x: 0, p: 0.5 },
      { id: 'b1', x: 10, p: 0.5 }
    ]
  },
  {
    id: 'same_score',
    label: '全員同分 {80}（無對立）',
    beads: [{ id: 'b0', x: 80, p: 1.0 }]
  },
  {
    id: 'skewed_4',
    label: '非對稱四珠 {1, 2, 5, 9}',
    beads: [
      { id: 'b0', x: 1, p: 0.15 },
      { id: 'b1', x: 2, p: 0.35 },
      { id: 'b2', x: 5, p: 0.35 },
      { id: 'b3', x: 9, p: 0.15 }
    ]
  }
];

function renderMath(el, tex, fallbackText) {
  if (!el) return;
  try {
    katex.render(tex, el, { displayMode: false, throwOnError: false });
  } catch {
    el.textContent = fallbackText;
  }
}

function fmt(num, digits = 9) {
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
      <section class="glass-card dashboard-card">
        <div class="card-header">
          <div>
            <p class="eyebrow">PHASE 0 VERIFICATION ENGINE</p>
            <h2 class="card-title">三軌變異數即時驗算儀表板</h2>
          </div>
          <span class="status-badge" data-role="consistency-badge">檢核中</span>
        </div>

        <div class="preset-bar">
          <label class="field-label" for="phase0-preset-select">快速切換驗證數據集</label>
          <select id="phase0-preset-select" class="select-input" data-role="preset-select">
            ${PHASE0_PRESETS.map(
              (preset) => `<option value="${preset.id}">${preset.label}</option>`
            ).join('')}
          </select>
        </div>

        <div class="pi-control" data-role="pi-control">
          <div class="slider-row">
            <span class="field-label">單次二項成功機率 <span data-math="pi"></span></span>
            <strong class="mono-value" data-role="pi-value">0.30</strong>
          </div>
          <input type="range" min="0" max="1" step="0.01" value="0.30" class="range-slider" data-role="pi-slider" />
        </div>

        <div class="metrics-summary">
          <div class="metric-pill">
            <span class="metric-label">權重總和 <span data-math="sumP"></span></span>
            <strong class="mono-value" data-role="sum-p">1.000000</strong>
          </div>
          <div class="metric-pill">
            <span class="metric-label">期望值重心 <span data-math="mu"></span></span>
            <strong class="mono-value accent-mu" data-role="mu-val">0.000000</strong>
          </div>
          <div class="metric-pill">
            <span class="metric-label">標準差尺規 <span data-math="sigma"></span></span>
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
          <span>最大三軌誤差（門檻 &lt; 10<sup>-9</sup>）</span>
          <code class="mono-value" data-role="max-diff">0.00e+0</code>
        </div>
      </section>

      <section class="glass-card notice-card">
        <p class="eyebrow">ACTIVE MODULE &amp; DATASET</p>
        <p class="notice-text" data-role="active-summary"></p>
      </section>
    `;

    renderMath(this.container.querySelector('[data-math="pi"]'), '\\pi', 'π');
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
    const presetSelect = this.container.querySelector('[data-role="preset-select"]');
    const piSlider = this.container.querySelector('[data-role="pi-slider"]');

    presetSelect.addEventListener('change', (e) => {
      const selected = PHASE0_PRESETS.find((item) => item.id === e.target.value);
      if (!selected) return;
      this.store.setState({
        beads: selected.beads,
        pivotOverride: null
      });
    });

    piSlider.addEventListener('input', (e) => {
      this.store.setBernoulliPi(Number(e.target.value));
    });
  }

  update(state) {
    const isBernoulliView =
      state.activeModule === 'mod1' ||
      (state.activeModule === 'mod3' && state.mod3SubMode === 'bernoulli');
    const piControl = this.container.querySelector('[data-role="pi-control"]');
    const presetBar = this.container.querySelector('.preset-bar');

    piControl.style.display = 'none';
    presetBar.style.display = 'none';

    const piSlider = this.container.querySelector('[data-role="pi-slider"]');
    const piValue = this.container.querySelector('[data-role="pi-value"]');
    piSlider.value = String(state.bernoulliPi);
    piValue.textContent = state.bernoulliPi.toFixed(2);

    // 依目前模組決定受檢驗的分佈：單次二項 {0,1}、二項分佈 {0..n} 或共享多珠 store.beads
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
      const label = state.activeModule === 'mod1' ? '模組 1（單次二項雙珠）' : '模組 3（單次二項極簡切法）';
      summaryEl.textContent =
        `目前檢視${label}：x ∈ {0, 1}，π = ${b.pi.toFixed(2)}，理論變異數 π(1−π) = ${fmt(b.variance, 6)}。`;
    } else if (state.activeModule === 'mod5') {
      const bin = computeBinomialMetrics(state.binomialN, state.binomialX, state.bernoulliPi);
      summaryEl.textContent =
        `目前檢視模組 5（二項分佈 B(n=${bin.n}, π=${bin.pi.toFixed(2)})）：` +
        `儀表板直接對完整分佈 {0…${bin.n}} 進行三軌變異數驗算，理論期望值 nπ = ${bin.mu.toFixed(2)}、理論變異數 nπ(1−π) = ${bin.variance.toFixed(6)}。`;
    } else {
      const coords = metrics.beads.map((b) => `(${b.x}, ${b.p.toFixed(2)})`).join('、');
      summaryEl.textContent = `目前共享多珠資料集（lockDataset=${state.lockDataset ? 'ON' : 'OFF'}）：${coords}。`;
    }
  }
}
