/**
 * 模組五：二項分佈路徑組合與 n 次獨立疊加倍率
 * - 採上下聯動雙視區：
 *   * 上區（DOM/SVG 高精度路徑互動區）：
 *     - n ∈ [1, 10]、x ∈ [0, n]、π ∈ [0, 1] 即時調整 + 罰球 70% 連投 4 球劇本
 *     - 「撕掉順序標籤」互動：展開 x! 條重複排列 -> 撕除編號折疊為 1 條，解釋為何除以 x! 而非 x
 *     - 「至少一個 P(X ≥ 1)」宇宙挖洞法 + 非負整數離散分佈專屬警語
 *   * 下區（3D 積木堆疊舞台）：
 *     - 並排複製 n 塊單次塌縮長方體，呈現變異數線性放大 ×n (nπ(1-π))
 *     - 並排對照線性增長的變異數長條 vs 開根號緩慢增長的紫羅蘭標準差尺規 (×√n)
 */

import * as THREE from 'three';
import { BaseModule } from './BaseModule.js';
import {
  createGlassBlock,
  updateGlassBlock,
  setBlockHighlight
} from '../engine/GeometryFactory.js';
import { LabelManager } from '../engine/LabelManager.js';
import { COLORS, EPSILON, RENDER_ORDER } from '../core/constants.js';
import { computeBinomialMetrics } from '../core/mathEngine.js';

function factorial(k) {
  let res = 1;
  for (let i = 2; i <= k; i += 1) res *= i;
  return res;
}

function getPermutationsPreview(x, maxRows = 6) {
  if (x <= 1) return [Array.from({ length: x }, (_, i) => i + 1)];
  const results = [];
  const used = new Array(x).fill(false);
  const current = [];

  function backtrack() {
    if (results.length >= maxRows) return;
    if (current.length === x) {
      results.push([...current]);
      return;
    }
    for (let i = 1; i <= x; i += 1) {
      if (used[i - 1]) continue;
      used[i - 1] = true;
      current.push(i);
      backtrack();
      current.pop();
      used[i - 1] = false;
    }
  }

  backtrack();
  return results;
}

export class Mod5BinomialN extends BaseModule {
  constructor(context) {
    super(context);
    this.formulaLens = context.formulaLens;
    this.upperHost = context.upperHost;
    this.stagePane = context.stagePane;
    this.labels = new LabelManager();
    this._abortController = new AbortController();
    this._slabBlocks = [];
    this._labelsTorn = false;
  }

  init() {
    super.init();
    this.webglWrap = this.stagePane?.querySelector('.stage-webgl-wrap') || null;
    this.stage.setCameraHome([0, 3.6, 7.6], [0, 0.35, 0.3]);

    // 1. n 塊單次塌縮長方體容器
    this.slabsGroup = new THREE.Group();
    this.root.add(this.slabsGroup);

    // 2. 下方並排對照光條：翠綠線性 σ² (∝ n) vs 紫羅蘭開根號 σ (∝ √n)
    const barGeo = new THREE.BoxGeometry(1, 0.08, 0.14);
    this.varBar = new THREE.Mesh(
      barGeo,
      new THREE.MeshStandardMaterial({
        color: COLORS.positiveHex,
        emissive: COLORS.positiveHex,
        emissiveIntensity: 0.4
      })
    );
    this.varBar.renderOrder = RENDER_ORDER.PURE_VARIANCE;
    this.varBar.userData.token = 'var_n';

    this.sdBar = new THREE.Mesh(
      barGeo.clone(),
      new THREE.MeshStandardMaterial({
        color: COLORS.negativeHex,
        emissive: COLORS.negativeHex,
        emissiveIntensity: 0.5
      })
    );
    this.sdBar.renderOrder = RENDER_ORDER.LASER_CUT;
    this.sdBar.userData.token = 'sd_n';

    this.root.add(this.varBar, this.sdBar);

    this.varBarLabel = this.labels.addLabel(this.root, {
      text: 'σ² = nπ(1−π)',
      position: [0, 0.15, 1.3],
      className: 'scene-label is-caliper',
      persistent: true
    });
    this.sdBarLabel = this.labels.addLabel(this.root, {
      text: 'σ = √(nπ(1−π))',
      position: [0, 0.15, 1.75],
      className: 'scene-label is-ruler',
      persistent: true
    });

    this._renderUpperStageScaffold();
    this._renderControlsUI();
    this._bindEvents();

    this.update(this.store.getState());
  }

  _renderUpperStageScaffold() {
    if (!this.upperHost) return;
    this.upperHost.innerHTML = `
      <div class="mod5-upper-grid">
        <div class="mod5-comb-pane">
          <div class="mod5-pane-head">
            <span class="eyebrow">路徑組合（除 x!）</span>
            <button type="button" class="chip-btn is-tear-btn" data-role="btn-tear-labels">
              撕掉順序標籤（合併 x! 重複排列）
            </button>
          </div>
          <div class="perm-stack" data-role="perm-stack"></div>
          <p class="perm-caption" data-role="perm-caption"></p>
        </div>

        <div class="mod5-dist-pane">
          <div class="mod5-pane-head">
            <span class="eyebrow">二項機率分佈與「至少一個」</span>
            <span class="mono-value" data-role="dist-headline"></span>
          </div>
          <svg class="binom-svg" viewBox="0 0 360 135" preserveAspectRatio="xMidYMid meet" data-role="binom-svg"></svg>
          <div class="discrete-warning" data-role="discrete-warning" style="display:none;">
            ⚠ 警語：<code>1 − P(0)</code> 捷徑僅適用於非負整數離散分佈（X ∈ {0, 1, 2, …}），連續或含負值分佈不可使用！
          </div>
        </div>
      </div>
    `;
  }

  _renderControlsUI() {
    this.controlsHost.innerHTML = `
      <section class="glass-card mod-control-card">
        <div class="card-header is-compact">
          <div>
            <h2 class="card-title">二項路徑與 n 次倍率</h2>
          </div>
          <span class="tag-chip" data-role="mod5-comb-chip">C(4,2) = 6</span>
        </div>

        <div class="lens-tabs" role="tablist" aria-label="模組五焦點切換">
          <button type="button" class="lens-tab" data-mod5-focus="comb">① 路徑為何除 x!</button>
          <button type="button" class="lens-tab" data-mod5-focus="scaling">② 體積 ×n vs 尺規 ×√n</button>
        </div>

        <div class="preset-pills" data-mod5-only="comb">
          <button type="button" class="chip-btn" data-role="btn-freethrow-preset">
            罰球 70%（n=4, x=2）
          </button>
          <button type="button" class="chip-btn" data-role="btn-perm3-preset">
            排列對比（n=5, x=3 → 3!=6）
          </button>
        </div>

        <div class="preset-pills" data-mod5-only="scaling">
          <button type="button" class="chip-btn" data-mod5-square="1">對照 n=1（π=0.5）</button>
          <button type="button" class="chip-btn" data-mod5-square="4">對照 n=4（×4 vs ×2）</button>
          <button type="button" class="chip-btn" data-mod5-square="9">對照 n=9（×9 vs ×3）</button>
        </div>

        <div class="control-block">
          <div class="slider-row">
            <span class="field-label">獨立重複次數 n（1 ~ 10）</span>
            <strong class="mono-value" data-role="mod5-n-val">4</strong>
          </div>
          <input type="range" min="1" max="10" step="1" value="4" class="range-slider" data-role="mod5-n-slider" />
        </div>

        <div class="control-block" data-mod5-only="comb">
          <div class="slider-row">
            <span class="field-label">目標成功次數 x（0 ~ n）</span>
            <strong class="mono-value" data-role="mod5-x-val">2</strong>
          </div>
          <input type="range" min="0" max="4" step="1" value="2" class="range-slider" data-role="mod5-x-slider" />
        </div>

        <div class="control-block">
          <div class="slider-row">
            <span class="field-label">單次成功機率 π</span>
            <strong class="mono-value" data-role="mod5-pi-val">0.30</strong>
          </div>
          <input type="range" min="0" max="1" step="0.01" value="0.30" class="range-slider" data-role="mod5-pi-slider" />
        </div>

        <label class="lock-toggle at-least-one-toggle" data-mod5-only="comb">
          <input type="checkbox" data-role="toggle-at-least-one" />
          <span>至少一個捷徑：P(X ≥ 1) = 1 − P(0)</span>
        </label>
      </section>

      <section class="glass-card narration-card">
        <p class="eyebrow">💡 白話直覺</p>
        <p class="narration-text" data-role="mod5-narration"></p>
        <div class="caution-banner" data-mod5-only="scaling">
          ⚠ 防錯提醒：這裡「變異數 ×n、標準差 ×√n」討論的是<strong>總成功次數 X</strong>（投 9 球總進球數波動比投 1 球大）；若是算<strong>平均命中率 X/n</strong>，除以 n 後標準誤反而縮小為 1/√n！
        </div>
      </section>
    `;
  }

  _bindEvents() {
    const { signal } = this._abortController;

    if (this.upperHost) {
      this.upperHost.addEventListener(
        'click',
        (event) => {
          if (event.target.closest('[data-role="btn-tear-labels"]')) {
            this._labelsTorn = !this._labelsTorn;
            this.update(this.store.getState());
          }
        },
        { signal }
      );
    }

    this.controlsHost.addEventListener(
      'click',
      (event) => {
        const focusBtn = event.target.closest('[data-mod5-focus]');
        if (focusBtn) {
          this.store.setState({ mod5Focus: focusBtn.dataset.mod5Focus });
          return;
        }
        if (event.target.closest('[data-role="btn-freethrow-preset"]')) {
          this.store.setState({
            binomialN: 4,
            binomialX: 2,
            bernoulliPi: 0.7
          });
          return;
        }
        if (event.target.closest('[data-role="btn-perm3-preset"]')) {
          this.store.setState({
            binomialN: 5,
            binomialX: 3,
            bernoulliPi: 0.5
          });
          return;
        }
        const sqBtn = event.target.closest('[data-mod5-square]');
        if (sqBtn) {
          const n = Number(sqBtn.dataset.mod5Square);
          this.store.setState({
            binomialN: n,
            binomialX: Math.floor(n / 2),
            bernoulliPi: 0.5
          });
        }
      },
      { signal }
    );

    this.controlsHost.addEventListener(
      'input',
      (event) => {
        if (event.target.matches('[data-role="mod5-n-slider"]')) {
          const n = Number(event.target.value);
          const curX = this.store.getState().binomialX;
          this.store.setState({
            binomialN: n,
            binomialX: Math.min(n, curX)
          });
          return;
        }
        if (event.target.matches('[data-role="mod5-x-slider"]')) {
          this.store.setState({ binomialX: Number(event.target.value) });
          return;
        }
        if (event.target.matches('[data-role="mod5-pi-slider"]')) {
          this.store.setBernoulliPi(Number(event.target.value));
        }
      },
      { signal }
    );

    this.controlsHost.addEventListener(
      'change',
      (event) => {
        if (event.target.matches('[data-role="toggle-at-least-one"]')) {
          this.store.setState({ showAtLeastOne: event.target.checked });
        }
      },
      { signal }
    );
  }

  _syncSlabPool(n) {
    while (this._slabBlocks.length < n) {
      const slab = createGlassBlock({
        color: COLORS.positiveHex,
        opacity: 0.46,
        renderOrder: RENDER_ORDER.PURE_VARIANCE,
        token: 'var_n'
      });
      this.slabsGroup.add(slab);
      this._slabBlocks.push(slab);
    }

    while (this._slabBlocks.length > n) {
      const removed = this._slabBlocks.pop();
      this.slabsGroup.remove(removed);
      this.disposeObject3D(removed);
    }
  }

  setLabelsTorn(torn) {
    this._labelsTorn = Boolean(torn);
    this.update(this.store.getState());
  }

  update(state) {
    const focus = state.mod5Focus === 'scaling' ? 'scaling' : 'comb';
    const isComb = focus === 'comb';

    // 單一焦點視區切換：選「路徑為何除 x!」時只留上方圖表區；選「×n vs ×√n」時釋放全高 3D 舞台
    if (this.stagePane && this.upperHost) {
      this.stagePane.classList.toggle('is-mod5-comb-only', isComb);
      this.upperHost.style.display = isComb ? 'flex' : 'none';
      if (this.webglWrap) {
        this.webglWrap.style.display = isComb ? 'none' : '';
      }
    }

    for (const btn of this.controlsHost.querySelectorAll('[data-mod5-focus]')) {
      btn.classList.toggle('is-active', btn.dataset.mod5Focus === focus);
    }
    for (const el of this.controlsHost.querySelectorAll('[data-mod5-only]')) {
      el.style.display = el.dataset.mod5Only === focus ? '' : 'none';
    }

    const metrics = computeBinomialMetrics(state.binomialN, state.binomialX, state.bernoulliPi);
    this._syncSlabPool(metrics.n);
    this._update3DStage(metrics);
    this._updateUpperStage(state, metrics);
    this._updateControlsReadout(state, metrics);
    this._updateFormulaLens(state, metrics);
    this.onHover(state.hoveredToken);
  }

  _update3DStage(metrics) {
    const { n, pi, q, variance, sd } = metrics;
    const singleVol = pi * q;
    const gap = 0.24;
    const cellW = Math.max(0.35, pi);
    const stepX = cellW + gap;
    const totalW = (n - 1) * stepX;

    // 並排複製 n 塊單次塌縮長方體（每塊體積 π(1-π)，總體積 nπ(1-π)）
    for (let i = 0; i < n; i += 1) {
      const slab = this._slabBlocks[i];
      updateGlassBlock(slab, {
        width: pi,
        height: 1.0,
        depth: q
      });
      slab.position.set(-totalW * 0.5 + i * stepX, 0.5, 0);
    }

    // 並排對照：線性放大的變異數長度 (∝ n) vs 開根號緩慢增長的紫色標準差尺規 (∝ √n)
    const barScale = 1.8;
    const varLen = variance * barScale;
    const sdLen = sd * barScale;

    if (varLen >= EPSILON) {
      this.varBar.visible = true;
      this.varBar.scale.set(varLen, 1, 1);
      this.varBar.position.set(0, 0.05, 1.05);
    } else {
      this.varBar.visible = false;
    }

    if (sdLen >= EPSILON) {
      this.sdBar.visible = true;
      this.sdBar.scale.set(sdLen, 1, 1);
      this.sdBar.position.set(0, 0.05, 2.05);
    } else {
      this.sdBar.visible = false;
    }

    this.labels.updateLabel(this.varBarLabel, {
      text: `σ² = ${variance.toFixed(3)}（線性 ×${n}）`,
      position: [0, 0.28, 1.05],
      visible: true
    });

    this.labels.updateLabel(this.sdBarLabel, {
      text: `σ = ${sd.toFixed(3)}（×√${n} = ×${Math.sqrt(n).toFixed(2)}）`,
      position: [0, 0.08, 2.08],
      visible: true
    });
  }

  _updateUpperStage(state, metrics) {
    if (!this.upperHost) return;
    const { n, x, pi, ways, probX, probZero, probAtLeastOne } = metrics;

    const tearBtn = this.upperHost.querySelector('[data-role="btn-tear-labels"]');
    tearBtn.classList.toggle('is-active', this._labelsTorn);
    tearBtn.textContent = this._labelsTorn
      ? '貼回順序標籤（展開 x! 排列）'
      : '撕掉順序標籤（合併 x! 重複排列）';

    // 1. 路徑排列折疊視覺化
    const permStack = this.upperHost.querySelector('[data-role="perm-stack"]');
    const permCaption = this.upperHost.querySelector('[data-role="perm-caption"]');
    const xFact = factorial(x);
    const orderedCount = ways * xFact;

    const compactClass = n >= 8 ? ' is-sm' : '';

    if (x === 0) {
      permStack.innerHTML = `
        <div class="perm-row is-merged">
          ${Array.from({ length: n }, () => `<span class="slot-box is-fail${compactClass}">✗</span>`).join('')}
          <span class="perm-note">0 個成功格 → 僅 1 條全敗路徑</span>
        </div>
      `;
      permCaption.textContent = `C(${n}, 0) = 1 條路徑，無須除以順序排列。`;
    } else if (this._labelsTorn) {
      permStack.innerHTML = `
        <div class="perm-row is-merged">
          ${Array.from({ length: n }, (_, idx) =>
            idx < x
              ? `<span class="slot-box is-success${compactClass}">✓</span>`
              : `<span class="slot-box is-fail${compactClass}">✗</span>`
          ).join('')}
          <span class="perm-note">已合併為 1 條無序路徑</span>
        </div>
      `;
      permCaption.textContent =
        `撕掉編號後，原本 ${xFact} 條相同位置的重複排列折疊成 1 條：` +
        `有序挑法 ${orderedCount} ÷ ${x}! (${xFact}) = C(${n}, ${x}) = ${ways} 條！`;
    } else {
      const previews = getPermutationsPreview(x, 6);
      permStack.innerHTML = previews
        .map(
          (perm) => `
            <div class="perm-row">
              ${Array.from({ length: n }, (_, idx) =>
                idx < x
                  ? `<span class="slot-box is-success${compactClass}">✓<sub>${perm[idx]}</sub></span>`
                  : `<span class="slot-box is-fail${compactClass}">✗</span>`
              ).join('')}
            </div>
          `
        )
        .join('') +
        (xFact > previews.length
          ? `<div class="perm-overflow">…（此組合共有 ${x}! = ${xFact} 種編號排列）</div>`
          : '');
      permCaption.textContent =
        `帶順序編號共 ${orderedCount} 條（每組 ${x} 個成功格內部有 ${x}! = ${xFact} 種排列，非僅 ${x} 種）。`;
    }

    // 2. 右側 SVG 二項分佈長條圖 + 至少一個宇宙挖洞
    const headline = this.upperHost.querySelector('[data-role="dist-headline"]');
    headline.textContent = state.showAtLeastOne
      ? `P(X≥1) = 1 − ${probZero.toFixed(4)} = ${probAtLeastOne.toFixed(4)}`
      : `P(X=${x}) = ${probX.toFixed(4)}`;

    const warnBox = this.upperHost.querySelector('[data-role="discrete-warning"]');
    warnBox.style.display = state.showAtLeastOne ? 'block' : 'none';

    const svg = this.upperHost.querySelector('[data-role="binom-svg"]');
    const probs = Array.from({ length: n + 1 }, (_, k) => computeBinomialMetrics(n, k, pi).probX);
    const maxP = Math.max(0.2, ...probs);
    const chartW = 340;
    const chartH = 95;
    const startX = 12;
    const barGap = 4;
    const barW = Math.max(12, (chartW - barGap * n) / (n + 1));

    svg.innerHTML = probs
      .map((pk, k) => {
        const bh = Math.max(2, (pk / maxP) * chartH);
        const bx = startX + k * (barW + barGap);
        const by = 112 - bh;

        let fill = 'rgba(148, 163, 184, 0.35)';
        let stroke = 'rgba(148, 163, 184, 0.6)';
        let dash = '';

        if (state.showAtLeastOne) {
          if (k === 0) {
            fill = 'rgba(244, 63, 94, 0.14)';
            stroke = '#f43f5e';
            dash = 'stroke-dasharray="4 3"';
          } else {
            fill = 'rgba(16, 185, 129, 0.72)';
            stroke = '#10b981';
          }
        } else if (k === x) {
          fill = 'rgba(6, 182, 212, 0.78)';
          stroke = '#06b6d4';
        }

        return `
          <g>
            <rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="3"
              fill="${fill}" stroke="${stroke}" stroke-width="1.5" ${dash} />
            <text x="${(bx + barW * 0.5).toFixed(1)}" y="128" text-anchor="middle" fill="#94a3b8" font-size="10">${k}</text>
          </g>
        `;
      })
      .join('');
  }

  _updateControlsReadout(state, metrics) {
    const { n, x, pi, ways, probX, probZero, probAtLeastOne, mu, variance, sd } = metrics;

    this.controlsHost.querySelector('[data-role="mod5-comb-chip"]').textContent = `C(${n},${x}) = ${ways}`;
    this.controlsHost.querySelector('[data-role="mod5-n-val"]').textContent = String(n);
    this.controlsHost.querySelector('[data-role="mod5-n-slider"]').value = String(n);

    const xSlider = this.controlsHost.querySelector('[data-role="mod5-x-slider"]');
    xSlider.max = String(n);
    xSlider.value = String(x);
    this.controlsHost.querySelector('[data-role="mod5-x-val"]').textContent = String(x);

    this.controlsHost.querySelector('[data-role="mod5-pi-val"]').textContent = pi.toFixed(2);
    this.controlsHost.querySelector('[data-role="mod5-pi-slider"]').value = String(pi);

    this.controlsHost.querySelector('[data-role="toggle-at-least-one"]').checked = Boolean(
      state.showAtLeastOne
    );

    const narration = this.controlsHost.querySelector('[data-role="mod5-narration"]');
    if (state.showAtLeastOne) {
      narration.textContent =
        `宇宙總機率 1 扣除唯一全敗世界 P(0) = ${probZero.toFixed(4)}，即得 P(X≥1) = ${probAtLeastOne.toFixed(4)}；` +
        `注意此捷徑僅適用於非負整數離散分佈。下方 3D 舞台並排 ${n} 塊積木顯示 μ = ${mu.toFixed(2)}、σ² = ${variance.toFixed(4)}、σ = ${sd.toFixed(4)}。`;
    } else {
      narration.textContent =
        `n = ${n} 次獨立重複試驗中成功 ${x} 次：共有 C(${n},${x}) = ${ways} 條路徑（每條機率 ${metrics.singlePathProb.toFixed(4)}），` +
        `合計 P(X=${x}) = ${probX.toFixed(4)}。下方 3D 舞台並排 ${n} 塊單次塌縮長方體，變異數線性放大 ×${n}，但開根號後的標準差僅放大 √${n} = ${Math.sqrt(n).toFixed(2)} 倍！`;
    }
  }

  _updateFormulaLens(state, metrics) {
    if (!this.formulaLens) return;
    const { n, x, pi, q, ways, singlePathProb, probX, mu, variance, sd } = metrics;
    const mode = state.formulaMode;
    let parts = [];

    if (mode === 'symbolic') {
      parts = [
        { type: 'op', text: 'P(x) = ' },
        { type: 'token', token: 'comb', colorRole: 'bead1', tex: '\\binom{n}{x}', fallback: 'C(n,x)' },
        { type: 'token', token: 'single_path', colorRole: 'mu', tex: '\\pi^x(1-\\pi)^{n-x}', fallback: 'πˣ(1-π)ⁿ⁻ˣ' },
        { type: 'op', text: ' ｜ ' },
        { type: 'token', token: 'var_n', colorRole: 'positive', tex: '\\sigma^2 = n\\pi(1-\\pi)', fallback: 'σ²=nπ(1-π)' },
        { type: 'op', text: ', ' },
        { type: 'token', token: 'sd_n', colorRole: 'negative', tex: '\\sigma = \\sqrt{n\\pi(1-\\pi)}', fallback: 'σ=√(nπ(1-π))' }
      ];
    } else if (mode === 'numeric') {
      parts = [
        { type: 'op', text: `P(${x}) = ` },
        { type: 'token', token: 'comb', colorRole: 'bead1', tex: String(ways), fallback: String(ways) },
        { type: 'op', text: ' × ' },
        { type: 'token', token: 'single_path', colorRole: 'mu', tex: singlePathProb.toFixed(4), fallback: singlePathProb.toFixed(4) },
        { type: 'op', text: ` = ${probX.toFixed(4)} ｜ ` },
        { type: 'token', token: 'var_n', colorRole: 'positive', tex: `\\sigma^2=${variance.toFixed(4)}`, fallback: `σ²=${variance.toFixed(4)}` },
        { type: 'op', text: ', ' },
        { type: 'token', token: 'sd_n', colorRole: 'negative', tex: `\\sigma=${sd.toFixed(4)}`, fallback: `σ=${sd.toFixed(4)}` }
      ];
    } else {
      parts = [
        { type: 'token', token: 'comb', colorRole: 'bead1', tex: `\\text{路徑 } ${ways}\\text{ 條}`, fallback: `路徑 ${ways}條` },
        { type: 'op', text: ' ｜ ' },
        {
          type: 'token',
          token: 'var_n',
          colorRole: 'positive',
          tex: `${n}\\times[${pi.toFixed(2)}\\times ${q.toFixed(2)}\\times 1.00]=${variance.toFixed(3)}`,
          fallback: `${n}×${(pi * q).toFixed(3)}`
        },
        { type: 'op', text: ' → ' },
        {
          type: 'token',
          token: 'sd_n',
          colorRole: 'negative',
          tex: `\\text{尺規 } \\sigma=${sd.toFixed(3)}\\;(\\mu=${mu.toFixed(2)})`,
          fallback: `尺規 σ=${sd.toFixed(3)}`
        }
      ];
    }

    const key = `m5|${mode}|${n}|${x}|${pi.toFixed(2)}|${state.showAtLeastOne ? 1 : 0}`;
    this.formulaLens.update({ mode, parts, key }, state.hoveredToken);
  }

  onHover(token) {
    const hlVar = token === 'var_n';
    for (const slab of this._slabBlocks) {
      setBlockHighlight(slab, hlVar);
    }
    this.varBar.material.emissiveIntensity = hlVar ? 0.95 : 0.4;
    this.sdBar.material.emissiveIntensity = token === 'sd_n' ? 0.95 : 0.5;
  }

  dispose() {
    this._abortController.abort();
    if (this.webglWrap) {
      this.webglWrap.style.display = '';
    }
    if (this.stagePane && this.upperHost) {
      this.stagePane.classList.remove('is-split-mod5', 'is-mod5-comb-only');
      this.upperHost.style.display = 'none';
      this.upperHost.innerHTML = '';
    }
    this.labels.clearAll();
    this._slabBlocks = [];
    super.dispose();
  }
}
