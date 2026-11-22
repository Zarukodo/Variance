/**
 * 模組一：雙珠箱子與幾何塌縮（單次二項分佈／白努利試驗）
 * - 嚴格對應尺寸：0 號珠 π×π×(1-π)、1 號珠 (1-π)×(1-π)×π
 * - 採方案 A 同步翻轉拼合：兩塊積木翻轉 90° 後共享 XZ 底面 π×(1-π)，
 *   厚度 π + (1-π) = 1.00 沿 Y 軸垂直疊合，切換正上方 2D 正交鏡頭時呈現純粹 π(1-π) 面積卡片。
 * - 支援拖歪槓桿支點 a 的破壞實驗（即時呈現 I(a) = σ² + (μ - a)² 體積膨脹）。
 */

import * as THREE from 'three';
import { gsap } from 'gsap';
import { BaseModule } from './BaseModule.js';
import {
  createGlassBlock,
  updateGlassBlock,
  setBlockHighlight,
  createCaliperBracket
} from '../engine/GeometryFactory.js';
import { LabelManager } from '../engine/LabelManager.js';
import { LeverRig } from '../engine/LeverRig.js';
import { COLORS, EPSILON, RENDER_ORDER } from '../core/constants.js';
import { computeBernoulliMetrics } from '../core/mathEngine.js';

export class Mod1Bernoulli extends BaseModule {
  /**
   * @param {{ stage: import('../engine/Stage3D.js').Stage3D, store: import('../core/store.js').store, controlsHost: HTMLElement, formulaLens: import('../ui/FormulaLens.js').FormulaLens }} context
   */
  constructor(context) {
    super(context);
    this.formulaLens = context.formulaLens;
    this.labels = new LabelManager();
    this._abortController = new AbortController();
    this.isCollapsed = false;
    this._isAnimating = false;
    this._prismsVisible = true;
    this._animState = { progress: 0 }; // 0 = 站立拆解態，1 = 方案 A 塌縮態
  }

  init() {
    super.init();

    // 1. 聚焦 {0, 1} 雙珠舞台尺度（略下移 target 讓下方槓桿與力臂標籤完全離底）
    this.stage.setCameraHome([1.95, 1.48, 2.85], [0.5, 0.08, 0]);

    // 2. 建立兩個標準 3D 玻璃積木
    this.block0 = createGlassBlock({
      color: COLORS.bead0Hex,
      opacity: 0.46,
      renderOrder: RENDER_ORDER.PURE_VARIANCE,
      token: 'bead0'
    });
    this.block1 = createGlassBlock({
      color: COLORS.bead1Hex,
      opacity: 0.46,
      renderOrder: RENDER_ORDER.PURE_VARIANCE,
      token: 'bead1'
    });
    this.root.add(this.block0, this.block1);

    // 共享截面亮框預告（翻轉前高亮兩塊積木相同的 π×(1-π) 側面）
    const faceGeo = new THREE.PlaneGeometry(1, 1);
    const faceMat0 = new THREE.MeshBasicMaterial({
      color: COLORS.positiveHex,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const faceMat1 = faceMat0.clone();
    this.sharedFace0 = new THREE.Mesh(faceGeo, faceMat0);
    this.sharedFace0.renderOrder = RENDER_ORDER.LASER_CUT;
    this.sharedFace1 = new THREE.Mesh(faceGeo.clone(), faceMat1);
    this.sharedFace1.rotation.y = Math.PI / 2;
    this.sharedFace1.renderOrder = RENDER_ORDER.LASER_CUT;
    this.block0.add(this.sharedFace0);
    this.block1.add(this.sharedFace1);

    // 3. 建立物理槓桿（置於地板下方 y = -0.34，避免旋轉時穿切上方積木）
    this.lever = new LeverRig({ yOffset: -0.34, minX: -0.4, maxX: 1.4 });
    this.root.add(this.lever.group);

    // 4. 厚度 1.00 側邊發光卡尺（塌縮完成時顯現）
    this.caliperGroup = createCaliperBracket({
      length: 1,
      color: COLORS.positiveHex,
      tickSize: 0.06
    });
    this.caliperGroup.visible = false;
    this.root.add(this.caliperGroup);

    this.caliperLabel = this.labels.addLabel(this.caliperGroup, {
      text: '厚度 = 1.00',
      position: [0.16, 0, 0],
      className: 'scene-label is-caliper',
      persistent: true
    });
    this.caliperLabel.visible = false;

    // 5. 數線座標標籤與重心基準標籤
    this.labelBead0 = this.labels.addLabel(this.root, {
      text: '0 號珠 (x=0)',
      position: [0, -0.02, 0.62],
      className: 'scene-label is-axis',
      persistent: true
    });
    this.labelBead1 = this.labels.addLabel(this.root, {
      text: '1 號珠 (x=1)',
      position: [1, -0.02, 0.62],
      className: 'scene-label is-axis',
      persistent: true
    });
    this.muLabel = this.labels.addLabel(this.root, {
      text: 'μ = 0.30',
      position: [0.3, -0.52, 0],
      className: 'scene-label is-mu',
      persistent: true
    });
    this.armLabelLeft = this.labels.addLabel(this.root, {
      text: '',
      position: [-0.15, -0.52, 0.25],
      className: 'scene-label is-axis',
      persistent: true
    });
    this.armLabelRight = this.labels.addLabel(this.root, {
      text: '',
      position: [1.15, -0.52, 0.25],
      className: 'scene-label is-axis',
      persistent: true
    });

    // 6. 渲染模組控制介面與旁白卡
    this._renderControlsUI();
    this._bindControlsEvents();

    // 7. 套用初始狀態
    this.update(this.store.getState());
  }

  _renderControlsUI() {
    this.controlsHost.innerHTML = `
      <section class="glass-card mod-control-card">
        <div class="card-header is-compact">
          <div>
            <h2 class="card-title">雙珠箱子與面積塌縮</h2>
          </div>
          <span class="tag-chip" data-role="mod1-state-chip">站立拆解態</span>
        </div>

        <div class="preset-pills" data-mod1-section="presets">
          <button type="button" class="chip-btn" data-pi-preset="0.2">扭蛋抽卡（π = 0.20）</button>
          <button type="button" class="chip-btn" data-pi-preset="0.5">公平硬幣（π = 0.50）</button>
        </div>

        <div class="control-block" data-mod1-section="pi">
          <div class="slider-row">
            <span class="field-label">成功機率 π（1 號珠權重）</span>
            <strong class="mono-value" data-role="mod1-pi-val">0.30</strong>
          </div>
          <input type="range" min="0" max="1" step="0.01" value="0.30" class="range-slider" data-role="mod1-pi-slider" />
          <p class="field-subhint">註：僅因本關座標固定在 0 與 1，0 號珠「離重心距離」才剛好也等於 π；一般題目請把「機率高度」與「距離」分開看。</p>
        </div>

        <div class="action-row" data-mod1-section="collapse">
          <button type="button" class="primary-btn" data-role="btn-toggle-collapse">
            執行幾何塌縮拼合（90° 翻轉）
          </button>
        </div>

        <div class="divider-line" data-mod1-section="pivot-divider"></div>

        <div class="control-block" data-mod1-section="pivot">
          <div class="slider-row">
            <span class="field-label">支點破壞實驗：手動拖偏支點 a</span>
            <strong class="mono-value accent-mu" data-role="mod1-pivot-val">鎖定重心 μ</strong>
          </div>
          <input type="range" min="-0.2" max="1.2" step="0.01" value="0.30" class="range-slider is-amber" data-role="mod1-pivot-slider" />
          <div class="pivot-footer">
            <span class="mini-stat" data-role="mod1-inertia-readout">I(a) = 0.2100（最小值）</span>
            <button type="button" class="ghost-btn" data-role="btn-reset-pivot">回正重心支點</button>
          </div>
        </div>
      </section>

      <section class="glass-card narration-card" data-mod1-section="narration">
        <p class="eyebrow">💡 白話直覺</p>
        <p class="narration-text" data-role="mod1-narration"></p>
      </section>
    `;
  }

  _bindControlsEvents() {
    const { signal } = this._abortController;

    this.controlsHost.addEventListener('click', (event) => {
      const presetBtn = event.target.closest('[data-pi-preset]');
      if (presetBtn) {
        const pi = Number(presetBtn.dataset.piPreset);
        this.store.setState({ bernoulliPi: pi, pivotOverride: null });
        return;
      }

      if (event.target.closest('[data-role="btn-toggle-collapse"]')) {
        this._toggleCollapse();
        return;
      }

      if (event.target.closest('[data-role="btn-reset-pivot"]')) {
        this.store.resetPivot();
      }
    }, { signal });

    const piSlider = this.controlsHost.querySelector('[data-role="mod1-pi-slider"]');
    piSlider.addEventListener('input', (e) => {
      this.store.setBernoulliPi(Number(e.target.value));
    }, { signal });

    const pivotSlider = this.controlsHost.querySelector('[data-role="mod1-pivot-slider"]');
    pivotSlider.addEventListener('input', (e) => {
      const a = Number(e.target.value);
      // 若處於塌縮態，拖動支點會自動展開回 3D 站立態以觀察體積膨脹
      if (this.isCollapsed) {
        this._setCollapsedImmediate(false);
      }
      this.store.setState({ pivotOverride: a });
    }, { signal });
  }

  _toggleCollapse() {
    if (this._isAnimating) return;
    const nextCollapsed = !this.isCollapsed;

    // 幾何塌縮定理僅在支點對準重心 μ = π 時成立，若支點偏離先自動回正
    if (nextCollapsed && this.store.getState().pivotOverride !== null) {
      this.store.resetPivot();
    }

    this.isCollapsed = nextCollapsed;
    this._isAnimating = true;
    this._updateControlsReadout(this.store.getState());
    gsap.killTweensOf(this._animState);

    gsap.to(this._animState, {
      progress: nextCollapsed ? 1 : 0,
      duration: 1.05,
      ease: 'power2.inOut',
      onUpdate: () => {
        this._applyGeometry(this.store.getState());
      },
      onComplete: () => {
        this._isAnimating = false;
        this._applyGeometry(this.store.getState());
        this._updateControlsReadout(this.store.getState());
      }
    });
  }

  _setCollapsedImmediate(collapsed) {
    gsap.killTweensOf(this._animState);
    this._isAnimating = false;
    this.isCollapsed = collapsed;
    this._animState.progress = collapsed ? 1 : 0;
  }

  /**
   * 供教學引導流程直接設定塌縮狀態（支援補間動畫）
   * @param {boolean} collapsed
   * @param {boolean} [immediate=false]
   */
  setCollapsed(collapsed, immediate = false) {
    if (immediate) {
      this._setCollapsedImmediate(collapsed);
      this._applyGeometry(this.store.getState());
      this._updateControlsReadout(this.store.getState());
      return;
    }
    if (this.isCollapsed === collapsed && !this._isAnimating) return;
    if (collapsed && this.store.getState().pivotOverride !== null) {
      this.store.resetPivot();
    }
    this.isCollapsed = collapsed;
    this._isAnimating = true;
    this._updateControlsReadout(this.store.getState());
    gsap.killTweensOf(this._animState);
    gsap.to(this._animState, {
      progress: collapsed ? 1 : 0,
      duration: 1.0,
      ease: 'power2.inOut',
      onUpdate: () => this._applyGeometry(this.store.getState()),
      onComplete: () => {
        this._isAnimating = false;
        this._applyGeometry(this.store.getState());
        this._updateControlsReadout(this.store.getState());
      }
    });
  }

  /**
   * 供引導第 1 步隱藏變異數大柱，只聚焦翹翹板與力臂（不提前暴雷）
   * @param {boolean} visible
   */
  setPrismsVisible(visible) {
    this._prismsVisible = Boolean(visible);
    this._applyGeometry(this.store.getState());
  }

  /**
   * 供教學引導控制右側子區塊顯示範圍（單一焦點減法）
   * @param {string[] | null} allowedSections - null 代表全部顯示（自由實驗模式）
   */
  setGuidedScope(allowedSections) {
    const showAll = !Array.isArray(allowedSections);
    const modCard = this.controlsHost.querySelector('.mod-control-card');
    if (modCard) {
      const hasControlChild =
        showAll || allowedSections.some((s) => ['presets', 'pi', 'collapse', 'pivot'].includes(s));
      modCard.style.display = hasControlChild ? '' : 'none';
    }
    for (const el of this.controlsHost.querySelectorAll('[data-mod1-section]')) {
      const name = el.dataset.mod1Section;
      if (name === 'pivot-divider') {
        const showDivider = showAll || (allowedSections.includes('collapse') && allowedSections.includes('pivot'));
        el.style.display = showDivider ? '' : 'none';
      } else {
        el.style.display = showAll || allowedSections.includes(name) ? '' : 'none';
      }
    }
  }

  update(state) {
    this._applyGeometry(state);
    this._updateControlsReadout(state);
    this._updateFormulaLens(state);
    this.onHover(state.hoveredToken);
  }

  _applyGeometry(state) {
    const { pi, q, mu, variance } = computeBernoulliMetrics(state.bernoulliPi);
    const pivot = state.pivotOverride ?? mu;
    const t = this._animState.progress;

    // 1. 更新積木尺寸（站立時使用離支點 a 的距離，展示支點破壞膨脹）
    const d0 = Math.abs(0 - pivot);
    const d1 = Math.abs(1 - pivot);

    updateGlassBlock(this.block0, { width: d0, height: q, depth: d0 });
    updateGlassBlock(this.block1, { width: d1, height: pi, depth: d1 });
    if (!this._prismsVisible) {
      this.block0.visible = false;
      this.block1.visible = false;
    }

    // 2. 方案 A 動畫插值：
    //    t=0: 站立拆解態 (block0 在 x=0, y=q/2; block1 在 x=1, y=pi/2)
    //    t=1: 同步翻轉 90° 並上下疊合於 x=0.5, z=0：
    //         block0 繞 X 轉 90° -> 底面 π×(1-π)、高度 π (y ∈ [0, π])
    //         block1 繞 Z 轉 90° -> 底面 π×(1-π)、高度 1-π (y ∈ [π, 1.00])
    const liftArc = Math.sin(t * Math.PI) * 0.24;

    this.block0.position.set(
      THREE.MathUtils.lerp(0, 0.5, t),
      THREE.MathUtils.lerp(q * 0.5, pi * 0.5, t) + liftArc * 0.35,
      0
    );
    this.block0.rotation.set(THREE.MathUtils.lerp(0, Math.PI * 0.5, t), 0, 0);

    this.block1.position.set(
      THREE.MathUtils.lerp(1, 0.5, t),
      THREE.MathUtils.lerp(pi * 0.5, pi + q * 0.5, t) + liftArc * 1.15,
      0
    );
    this.block1.rotation.set(0, 0, THREE.MathUtils.lerp(0, Math.PI * 0.5, t));

    // 3. 厚度 1.00 卡尺僅在塌縮完成且體積 > EPSILON 時顯示
    const showCaliper = t > 0.96 && variance >= EPSILON;
    this.caliperGroup.visible = showCaliper;
    this.caliperLabel.visible = showCaliper;
    if (showCaliper) {
      this.caliperGroup.position.set(0.5 + pi * 0.5 + 0.14, 0.5, 0);
    }

    // 4. 更新下方物理槓桿與重心標籤
    this.lever.update({
      beads: [
        { x: 0, p: q, color: COLORS.bead0Hex, token: 'bead0' },
        { x: 1, p: pi, color: COLORS.bead1Hex, token: 'bead1' }
      ],
      mu,
      pivot
    });

    this.labels.updateLabel(this.muLabel, {
      text: `重心 μ = ${mu.toFixed(2)}`,
      position: [mu, -0.52, 0]
    });

    const isBalanced = state.pivotOverride === null || Math.abs(mu - pivot) <= EPSILON;
    const showArms = isBalanced && t < 0.25 && variance >= EPSILON;
    this.armLabelLeft.visible = showArms;
    this.armLabelRight.visible = showArms;
    if (showArms) {
      const m = (q * pi).toFixed(2);
      this.labels.updateLabel(this.armLabelLeft, {
        text: `左重 ${q.toFixed(2)} × 臂 ${pi.toFixed(2)} = ${m}`,
        position: [-0.22, -0.28, 0.42]
      });
      this.labels.updateLabel(this.armLabelRight, {
        text: `右重 ${pi.toFixed(2)} × 臂 ${q.toFixed(2)} = ${m}`,
        position: [1.16, -0.28, 0.42]
      });
    }

    // 共享截面亮框預告（翻轉動畫前段與進行中閃爍，顯示兩塊相同的 π×(1-π) 面）
    const flashOpacity = t > 0.01 && t < 0.72 && variance >= EPSILON ? Math.sin((t / 0.72) * Math.PI) * 0.65 : 0;
    this.sharedFace0.visible = flashOpacity > 0.02 && this.block0.visible;
    this.sharedFace1.visible = flashOpacity > 0.02 && this.block1.visible;
    if (this.sharedFace0.visible) {
      this.sharedFace0.scale.set(d0, q, 1);
      this.sharedFace0.position.set(0, 0, d0 * 0.5 + 0.002);
      this.sharedFace0.material.opacity = flashOpacity;
    }
    if (this.sharedFace1.visible) {
      this.sharedFace1.scale.set(d1, pi, 1);
      this.sharedFace1.position.set(-d1 * 0.5 - 0.002, 0, 0);
      this.sharedFace1.material.opacity = flashOpacity;
    }
  }

  _updateControlsReadout(state) {
    const { pi, mu, variance } = computeBernoulliMetrics(state.bernoulliPi);
    const pivot = state.pivotOverride ?? mu;
    const isOffCenter = state.pivotOverride !== null && Math.abs(mu - pivot) > EPSILON;
    const inertia = variance + (mu - pivot) ** 2;

    this.controlsHost.querySelector('[data-role="mod1-pi-val"]').textContent = pi.toFixed(2);
    this.controlsHost.querySelector('[data-role="mod1-pi-slider"]').value = String(pi);

    const pivotSlider = this.controlsHost.querySelector('[data-role="mod1-pivot-slider"]');
    pivotSlider.value = String(pivot);

    this.controlsHost.querySelector('[data-role="mod1-pivot-val"]').textContent = isOffCenter
      ? `a = ${pivot.toFixed(2)}（偏離！）`
      : `鎖定重心 μ = ${mu.toFixed(2)}`;

    this.controlsHost.querySelector('[data-role="mod1-inertia-readout"]').textContent = isOffCenter
      ? `I(a) = ${inertia.toFixed(4)}（膨脹 +${((mu - pivot) ** 2).toFixed(4)}）`
      : `I(μ) = ${variance.toFixed(4)}（全宇宙最小值）`;

    const chip = this.controlsHost.querySelector('[data-role="mod1-state-chip"]');
    chip.textContent = this.isCollapsed ? '方案 A 塌縮態（厚 1.00）' : '3D 站立拆解態';

    const btn = this.controlsHost.querySelector('[data-role="btn-toggle-collapse"]');
    btn.textContent = this.isCollapsed ? '展開雙珠 3D 原貌' : '執行幾何塌縮拼合（90° 翻轉）';

    for (const presetBtn of this.controlsHost.querySelectorAll('[data-pi-preset]')) {
      presetBtn.classList.toggle('is-active', Math.abs(Number(presetBtn.dataset.piPreset) - pi) < 1e-4);
    }

    const narrationEl = this.controlsHost.querySelector('[data-role="mod1-narration"]');
    if (isOffCenter) {
      narrationEl.textContent =
        `支點被拖歪至 a = ${pivot.toFixed(2)}，淨力矩 τ = ${(mu - pivot).toFixed(2)} 使槓桿傾斜！` +
        `上方方柱被迫改以「離歪支點距離」為底邊，總體積膨脹為 ${inertia.toFixed(4)}。`;
    } else if (this.isCollapsed) {
      narrationEl.textContent =
        `兩塊積木同步翻轉 90° 後，共享底面積 π(1−π) = ${variance.toFixed(4)}，垂直高度縫合為 π + (1−π) = 1.00。` +
        `此時點選舞台右上角「從正上方平看 (2D 面積)」，厚度 1.00 會隱入視線方向，讓 3D 體積與 2D 面積重疊！`;
    } else if (pi < EPSILON || pi > 1 - EPSILON) {
      narrationEl.textContent =
        `極端邊界（π = ${pi.toFixed(2)}）：其中一類珠子機率為 0、另一類恰好站在重心上，毫無懸念，總體積歸零（已安全隱藏零尺寸積木）。`;
    } else {
      narrationEl.textContent =
        `0 號珠（珊瑚粉）站姿為 π×π×(1−π)，1 號珠（霓虹青）為 (1−π)×(1−π)×π。` +
        `它們並非沒有「高度權重」，只是翻轉拼合後剛好組成厚度 1.00 的扁平長方體。`;
    }
  }

  _updateFormulaLens(state) {
    if (!this.formulaLens) return;
    const { pi, q, mu, bead0, bead1, variance } = computeBernoulliMetrics(state.bernoulliPi);
    const pivot = state.pivotOverride ?? mu;
    const isOffCenter = state.pivotOverride !== null && Math.abs(mu - pivot) > EPSILON;
    const mode = state.formulaMode;

    const d0 = Math.abs(0 - pivot);
    const d1 = Math.abs(1 - pivot);
    const v0 = d0 * d0 * q;
    const v1 = d1 * d1 * pi;
    const total = v0 + v1;

    let parts;
    if (mode === 'symbolic') {
      parts = [
        { type: 'op', text: isOffCenter ? 'I(a) = ' : 'σ² = ' },
        {
          type: 'token',
          token: 'bead0',
          colorRole: 'bead0',
          tex: isOffCenter ? '(0-a)^2(1-\\pi)' : '(0-\\pi)^2(1-\\pi)',
          fallback: '(0-π)²(1-π)'
        },
        { type: 'op', text: ' + ' },
        {
          type: 'token',
          token: 'bead1',
          colorRole: 'bead1',
          tex: isOffCenter ? '(1-a)^2\\pi' : '(1-\\pi)^2\\pi',
          fallback: '(1-π)²π'
        },
        { type: 'op', text: ' = ' },
        {
          type: 'token',
          token: 'collapsed',
          colorRole: 'positive',
          tex: isOffCenter ? '\\sigma^2 + (\\pi-a)^2' : '\\pi(1-\\pi)',
          fallback: 'π(1-π)'
        }
      ];
    } else if (mode === 'numeric') {
      const aStr = pivot.toFixed(2);
      parts = [
        { type: 'op', text: isOffCenter ? 'I(a) = ' : 'σ² = ' },
        {
          type: 'token',
          token: 'bead0',
          colorRole: 'bead0',
          tex: `(0-${aStr})^2(${q.toFixed(2)})`,
          fallback: `(0-${aStr})²(${q.toFixed(2)})`
        },
        { type: 'op', text: ' + ' },
        {
          type: 'token',
          token: 'bead1',
          colorRole: 'bead1',
          tex: `(1-${aStr})^2(${pi.toFixed(2)})`,
          fallback: `(1-${aStr})²(${pi.toFixed(2)})`
        },
        { type: 'op', text: ' = ' },
        {
          type: 'token',
          token: 'collapsed',
          colorRole: 'positive',
          tex: total.toFixed(4),
          fallback: total.toFixed(4)
        }
      ];
    } else {
      // geometric 尺寸版
      parts = [
        {
          type: 'token',
          token: 'bead0',
          colorRole: 'bead0',
          tex: `[${d0.toFixed(2)}\\times ${d0.toFixed(2)}\\times ${q.toFixed(2)}]`,
          fallback: `[${d0.toFixed(2)}×${d0.toFixed(2)}×${q.toFixed(2)}]`
        },
        { type: 'op', text: ' + ' },
        {
          type: 'token',
          token: 'bead1',
          colorRole: 'bead1',
          tex: `[${d1.toFixed(2)}\\times ${d1.toFixed(2)}\\times ${pi.toFixed(2)}]`,
          fallback: `[${d1.toFixed(2)}×${d1.toFixed(2)}×${pi.toFixed(2)}]`
        },
        { type: 'op', text: ' = ' },
        {
          type: 'token',
          token: 'collapsed',
          colorRole: 'positive',
          tex: isOffCenter
            ? `\\text{V}=${total.toFixed(4)}`
            : `[1.00\\times ${pi.toFixed(2)}\\times ${q.toFixed(2)}]`,
          fallback: isOffCenter ? `V=${total.toFixed(4)}` : `[1.00×${pi.toFixed(2)}×${q.toFixed(2)}]`
        }
      ];
    }

    const key = `${mode}|${pi.toFixed(2)}|${pivot.toFixed(2)}|${isOffCenter ? 1 : 0}`;
    this.formulaLens.update({ mode, parts, key }, state.hoveredToken);
  }

  onHover(token) {
    const hl0 = token === 'bead0' || token === 'collapsed';
    const hl1 = token === 'bead1' || token === 'collapsed';
    setBlockHighlight(this.block0, hl0);
    setBlockHighlight(this.block1, hl1);

    const { pi, q, mu } = computeBernoulliMetrics(this.store.getState().bernoulliPi);
    const pivot = this.store.getState().pivotOverride ?? mu;
    const d0 = Math.abs(0 - pivot);
    const d1 = Math.abs(1 - pivot);

    if (token === 'bead0' && this.block0.visible) {
      this.labelBead0.visible = false;
      this.labelBead1.visible = true;
      this.labels.showBlockEdgeLabels(this.block0, {
        xText: `寬 |0-a|=${d0.toFixed(2)}`,
        yText: `高 1-π=${q.toFixed(2)}`,
        zText: `深 |0-a|=${d0.toFixed(2)}`
      });
    } else if (token === 'bead1' && this.block1.visible) {
      this.labelBead0.visible = true;
      this.labelBead1.visible = false;
      this.labels.showBlockEdgeLabels(this.block1, {
        xText: `寬 |1-a|=${d1.toFixed(2)}`,
        yText: `高 π=${pi.toFixed(2)}`,
        zText: `深 |1-a|=${d1.toFixed(2)}`
      });
    } else {
      this.labelBead0.visible = true;
      this.labelBead1.visible = true;
      this.labels.clearHoverLabels();
    }
  }

  dispose() {
    this._abortController.abort();
    gsap.killTweensOf(this._animState);
    this.labels.clearAll();
    super.dispose();
  }
}
