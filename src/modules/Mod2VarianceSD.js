/**
 * 模組二：多珠積木群與開根號降維尺規
 * - 支援自訂珠子編輯器與實戰劇本（透過 ControlPanel 共享數據）
 * - 下方掛載物理槓桿 LeverRig，支援手動拖歪支點 a 觀察槓桿傾斜與方柱總體積膨脹
 * - 「定厚重鑄模具」三階段降維動畫：
 *   1. 3D 偏差方柱壓縮為厚度 1.00 扁平色片（體積守恆）
 *   2. 色片匯入中央模具框，無縫拼鑄成厚度 1.00、正面 σ×σ 正方形薄板
 *   3. 從底邊剝離紫羅蘭 1D 標準差尺規，貼合數線 μ ± σ 區間
 */

import * as THREE from 'three';
import { gsap } from 'gsap';
import { BaseModule } from './BaseModule.js';
import {
  createGlassBlock,
  updateGlassBlock,
  setBlockHighlight
} from '../engine/GeometryFactory.js';
import { LabelManager } from '../engine/LabelManager.js';
import { LeverRig } from '../engine/LeverRig.js';
import { BEAD_PALETTE } from '../core/presets.js';
import { COLORS, EPSILON, RENDER_ORDER } from '../core/constants.js';
import { computeAllMetrics } from '../core/mathEngine.js';

export class Mod2VarianceSD extends BaseModule {
  /**
   * @param {{ stage: import('../engine/Stage3D.js').Stage3D, store: import('../core/store.js').store, controlsHost: HTMLElement, formulaLens: import('../ui/FormulaLens.js').FormulaLens }} context
   */
  constructor(context) {
    super(context);
    this.formulaLens = context.formulaLens;
    this.labels = new LabelManager();
    this._abortController = new AbortController();
    this._blocks = [];
    this._axisLabels = [];
    this._isRecast = false;
    this._isAnimating = false;
    this._animState = { stage: 0 }; // 0=原貌, 1=壓扁為定厚片, 2=拼鑄σ×σ模具, 3=剝離μ±σ尺規
  }

  init() {
    super.init();
    this.stage.setCameraHome([5.4, 4.6, 9.0], [0, 0.75, 0]);

    // 1. 積木容器
    this.blocksGroup = new THREE.Group();
    this.root.add(this.blocksGroup);

    // 2. 中央「定厚 1.00 重鑄模具」外框與底板
    this.moldGroup = new THREE.Group();
    this.moldGroup.visible = false;
    this.moldFrame = createGlassBlock({
      width: 1,
      height: 1,
      depth: 1,
      color: COLORS.muHex,
      opacity: 0.08,
      renderOrder: RENDER_ORDER.CORE_COLUMN,
      token: 'sigma',
      dashed: true
    });
    this.moldGroup.add(this.moldFrame);
    this.root.add(this.moldGroup);

    this.moldLabel = this.labels.addLabel(this.moldGroup, {
      text: '定厚 1.00 模具',
      position: [0, 1.2, 0],
      className: 'scene-label is-caliper',
      persistent: true
    });
    this.moldLabel.visible = false;

    // 3. 紫羅蘭一維標準差尺規（左右對稱兩支光棒：μ - σ 與 μ + σ）
    this.rulerGroup = new THREE.Group();
    this.rulerGroup.visible = false;
    const barGeo = new THREE.BoxGeometry(1, 0.06, 0.06);
    const barMatL = new THREE.MeshStandardMaterial({
      color: COLORS.negativeHex,
      emissive: COLORS.negativeHex,
      emissiveIntensity: 0.55,
      roughness: 0.2
    });
    const barMatR = barMatL.clone();
    this.rulerLeft = new THREE.Mesh(barGeo, barMatL);
    this.rulerRight = new THREE.Mesh(barGeo.clone(), barMatR);
    this.rulerLeft.renderOrder = RENDER_ORDER.LASER_CUT;
    this.rulerRight.renderOrder = RENDER_ORDER.LASER_CUT;
    this.rulerLeft.userData.token = 'sigma';
    this.rulerRight.userData.token = 'sigma';
    this.rulerGroup.add(this.rulerLeft, this.rulerRight);
    this.root.add(this.rulerGroup);

    this.labelSigmaLeft = this.labels.addLabel(this.rulerGroup, {
      text: 'μ - σ',
      position: [-0.5, 0.14, 0],
      className: 'scene-label is-ruler',
      persistent: true
    });
    this.labelSigmaRight = this.labels.addLabel(this.rulerGroup, {
      text: 'μ + σ',
      position: [0.5, 0.14, 0],
      className: 'scene-label is-ruler',
      persistent: true
    });
    this.labelSigmaLeft.visible = false;
    this.labelSigmaRight.visible = false;

    // 4. 下方物理槓桿
    this.lever = new LeverRig({ yOffset: -0.38, minX: -3.2, maxX: 3.2 });
    this.root.add(this.lever.group);

    this.muLabel = this.labels.addLabel(this.root, {
      text: 'μ',
      position: [0, -0.62, 0],
      className: 'scene-label is-mu',
      persistent: true
    });

    // 5. 渲染模組控制卡與旁白
    this._renderControlsUI();
    this._bindEvents();

    this.update(this.store.getState());
  }

  _renderControlsUI() {
    this.controlsHost.innerHTML = `
      <section class="glass-card mod-control-card">
        <div class="card-header is-compact">
          <div>
            <h2 class="card-title">多珠偏差方柱與降維尺規</h2>
          </div>
          <span class="tag-chip" data-role="mod2-state-chip">3D 偏差方柱</span>
        </div>

        <div class="action-row" data-mod2-section="recast">
          <button type="button" class="primary-btn" data-role="btn-recast-sd">
            定厚重鑄降維動畫（√σ² → μ ± σ）
          </button>
        </div>

        <div class="divider-line" data-mod2-section="pivot-divider"></div>

        <div class="control-block" data-mod2-section="pivot">
          <div class="slider-row">
            <span class="field-label">支點破壞實驗：拖離重心支點 a</span>
            <strong class="mono-value accent-mu" data-role="mod2-pivot-val">鎖定重心 μ</strong>
          </div>
          <input type="range" min="0" max="10" step="0.1" value="4.2" class="range-slider is-amber" data-role="mod2-pivot-slider" />
          <div class="pivot-footer">
            <span class="mini-stat" data-role="mod2-inertia-readout">I(μ) = 1.9600（最小值）</span>
            <div class="pivot-btn-group">
              <button type="button" class="ghost-btn" data-role="btn-mod2-push-origin" title="為第 3 站原點一刀切搭橋">試推到原點 a=0</button>
              <button type="button" class="ghost-btn" data-role="btn-mod2-reset-pivot">回正重心</button>
            </div>
          </div>
        </div>
      </section>

      <section class="glass-card narration-card" data-mod2-section="narration">
        <p class="eyebrow">💡 白話直覺</p>
        <p class="narration-text" data-role="mod2-narration"></p>
        <div class="caution-banner" data-role="mod2-ruler-caution" style="display:none;">
          ⚠ 防錯提醒：<strong>μ ± σ 只是衡量「典型波動寬度」的尺規</strong>，不代表所有資料都落在裡面（極端值會超出），不代表一定有負數資料，也不保證佔 68%（68% 僅適用常態分佈）。
        </div>
      </section>
    `;
  }

  _bindEvents() {
    const { signal } = this._abortController;

    this.controlsHost.addEventListener(
      'click',
      (event) => {
        if (event.target.closest('[data-role="btn-recast-sd"]')) {
          this._toggleRecastAnimation();
          return;
        }
        if (event.target.closest('[data-role="btn-mod2-push-origin"]')) {
          if (this._isRecast) this._resetRecastImmediate();
          this.store.setState({ pivotOverride: 0 });
          return;
        }
        if (event.target.closest('[data-role="btn-mod2-reset-pivot"]')) {
          this.store.resetPivot();
        }
      },
      { signal }
    );

    const pivotSlider = this.controlsHost.querySelector('[data-role="mod2-pivot-slider"]');
    pivotSlider.addEventListener(
      'input',
      (e) => {
        if (this._isRecast) {
          this._resetRecastImmediate();
        }
        this.store.setState({ pivotOverride: Number(e.target.value) });
      },
      { signal }
    );
  }

  _toggleRecastAnimation() {
    if (this._isAnimating) return;
    const metrics = computeAllMetrics(this.store.getState().beads, null);
    if (metrics.sd < EPSILON) return;

    const nextRecast = !this._isRecast;
    if (nextRecast && this.store.getState().pivotOverride !== null) {
      this.store.resetPivot();
    }

    this._isRecast = nextRecast;
    this._isAnimating = true;
    this._updateReadout(this.store.getState());
    gsap.killTweensOf(this._animState);

    gsap.to(this._animState, {
      stage: nextRecast ? 3 : 0,
      duration: nextRecast ? 1.5 : 0.85,
      ease: 'power2.inOut',
      onUpdate: () => {
        this._applyGeometry(this.store.getState());
      },
      onComplete: () => {
        this._isAnimating = false;
        this._applyGeometry(this.store.getState());
        this._updateReadout(this.store.getState());
      }
    });
  }

  _resetRecastImmediate() {
    gsap.killTweensOf(this._animState);
    this._isAnimating = false;
    this._isRecast = false;
    this._animState.stage = 0;
  }

  /**
   * 供教學引導流程控制定厚重鑄降維狀態
   * @param {boolean} recast
   * @param {boolean} [immediate=false]
   */
  setRecast(recast, immediate = false) {
    if (!recast && immediate) {
      this._resetRecastImmediate();
      this._applyGeometry(this.store.getState());
      this._updateReadout(this.store.getState());
      return;
    }
    if (this._isRecast === recast && !this._isAnimating) return;
    const metrics = computeAllMetrics(this.store.getState().beads, null);
    if (recast && metrics.sd < EPSILON) return;
    if (recast && this.store.getState().pivotOverride !== null) {
      this.store.resetPivot();
    }
    this._isRecast = recast;
    this._isAnimating = true;
    this._updateReadout(this.store.getState());
    gsap.killTweensOf(this._animState);
    gsap.to(this._animState, {
      stage: recast ? 3 : 0,
      duration: recast ? 1.5 : 0.85,
      ease: 'power2.inOut',
      onUpdate: () => this._applyGeometry(this.store.getState()),
      onComplete: () => {
        this._isAnimating = false;
        this._applyGeometry(this.store.getState());
        this._updateReadout(this.store.getState());
      }
    });
  }

  /**
   * 供教學引導控制右側子區塊顯示範圍
   * @param {string[] | null} allowedSections
   */
  setGuidedScope(allowedSections) {
    const showAll = !Array.isArray(allowedSections);
    const modCard = this.controlsHost.querySelector('.mod-control-card');
    if (modCard) {
      const hasControlChild =
        showAll || allowedSections.some((s) => ['recast', 'pivot'].includes(s));
      modCard.style.display = hasControlChild ? '' : 'none';
    }
    for (const el of this.controlsHost.querySelectorAll('[data-mod2-section]')) {
      const name = el.dataset.mod2Section;
      if (name === 'pivot-divider') {
        const showDivider = showAll || (allowedSections.includes('recast') && allowedSections.includes('pivot'));
        el.style.display = showDivider ? '' : 'none';
      } else {
        el.style.display = showAll || allowedSections.includes(name) ? '' : 'none';
      }
    }
  }

  _computeVisualScale(beads) {
    let minX = Infinity;
    let maxX = -Infinity;
    for (const b of beads) {
      if (b.x < minX) minX = b.x;
      if (b.x > maxX) maxX = b.x;
    }
    const span = maxX - minX;
    const centerX = (minX + maxX) * 0.5;
    const scaleX = span > 0 ? Math.min(1.0, 4.2 / span) : 1.0;
    const scaleY = 1.6; // 機率高度與模具定厚 1.00 共用比例，確保 σ_world = sd * scaleX
    return { minX, maxX, span, centerX, scaleX, scaleY };
  }

  _syncBlockPool(beads) {
    while (this._blocks.length < beads.length) {
      const idx = this._blocks.length;
      const color = BEAD_PALETTE[idx % BEAD_PALETTE.length];
      const block = createGlassBlock({
        width: 1,
        height: 1,
        depth: 1,
        color,
        opacity: 0.45,
        renderOrder: RENDER_ORDER.PURE_VARIANCE,
        token: `bead:${beads[idx]?.id ?? idx}`
      });
      this.blocksGroup.add(block);
      this._blocks.push(block);
    }

    while (this._blocks.length > beads.length) {
      const removed = this._blocks.pop();
      this.blocksGroup.remove(removed);
      this.disposeObject3D(removed);
    }

    while (this._axisLabels.length < beads.length) {
      const lbl = this.labels.addLabel(this.root, {
        text: '',
        position: [0, 0, 0],
        className: 'scene-label is-axis',
        persistent: true
      });
      this._axisLabels.push(lbl);
    }

    while (this._axisLabels.length > beads.length) {
      const lbl = this._axisLabels.pop();
      if (lbl.parent) lbl.parent.remove(lbl);
      if (lbl.element?.parentNode) lbl.element.parentNode.removeChild(lbl.element);
    }
  }

  update(state) {
    const metrics = computeAllMetrics(state.beads, state.pivotOverride);
    if (metrics.sd < EPSILON && this._isRecast) {
      this._resetRecastImmediate();
    }
    this._syncBlockPool(metrics.beads);
    this._applyGeometry(state, metrics);
    this._updateReadout(state, metrics);
    this._updateFormulaLens(state, metrics);
    this.onHover(state.hoveredToken);
  }

  _applyGeometry(state, cachedMetrics = null) {
    const metrics = cachedMetrics || computeAllMetrics(state.beads, state.pivotOverride);
    const { beads, mu, pivot, sd } = metrics;
    const { minX, maxX, centerX, scaleX, scaleY } = this._computeVisualScale(beads);

    const toWorldX = (x) => (x - centerX) * scaleX;
    const worldMu = toWorldX(mu);
    const worldPivot = toWorldX(pivot);
    const stageVal = this._animState.stage;

    const tFlatten = THREE.MathUtils.clamp(stageVal, 0, 1);
    const tMold = THREE.MathUtils.clamp(stageVal - 1, 0, 1);
    const tRuler = THREE.MathUtils.clamp(stageVal - 2, 0, 1);

    const sigmaWorld = Math.max(EPSILON, sd * scaleX);
    const thicknessWorld = 1.0 * scaleY;

    // 預先計算各色片在模具內垂直堆疊的 Y 起點（達成體積嚴格守恆）
    let accumY = 0;
    const stripLayouts = beads.map((b) => {
      const d = b.x - mu;
      const stripH = sd > EPSILON ? ((d * d * b.p) * (scaleX * scaleX)) / sigmaWorld : 0;
      const centerY = accumY + stripH * 0.5;
      accumY += stripH;
      return { stripH, centerY };
    });

    for (let i = 0; i < beads.length; i += 1) {
      const b = beads[i];
      const block = this._blocks[i];
      const color = BEAD_PALETTE[i % BEAD_PALETTE.length];
      block.userData.token = `bead:${b.id}`;
      if (block.userData.fillMesh) block.userData.fillMesh.userData.token = `bead:${b.id}`;
      if (block.userData.edges) block.userData.edges.userData.token = `bead:${b.id}`;

      const worldX = toWorldX(b.x);
      const baseSide = Math.abs(b.x - pivot) * scaleX;
      const baseHeight = b.p * scaleY;

      const { stripH, centerY: moldCenterY } = stripLayouts[i];

      // Stage 0 -> 1: 變形為定厚 thicknessWorld、寬 sigmaWorld 的扁平色片
      const curW = THREE.MathUtils.lerp(baseSide, sigmaWorld, tFlatten);
      const curH = THREE.MathUtils.lerp(baseHeight, stripH, tFlatten);
      const curD = THREE.MathUtils.lerp(baseSide, thicknessWorld, tFlatten);

      updateGlassBlock(block, {
        width: curW,
        height: curH,
        depth: curD,
        color
      });

      // Stage 1 -> 2: 從各自座標飛入中央模具框堆疊
      const posX = THREE.MathUtils.lerp(worldX, worldMu, tMold);
      const standY = curH * 0.5;
      const posY = THREE.MathUtils.lerp(standY, moldCenterY, tMold);
      block.position.set(posX, posY, 0);

      // 座標軸珠子標籤（僅在未進入模具堆疊時顯示）
      const axisLbl = this._axisLabels[i];
      this.labels.updateLabel(axisLbl, {
        text: `x=${b.x}`,
        position: [worldX, -0.02, Math.max(0.45, baseSide * 0.5 + 0.25)],
        visible: tMold < 0.5
      });
    }

    // 中央模具外框（Stage 2 出現）
    const showMold = tMold > 0.05 && sd >= EPSILON;
    this.moldGroup.visible = showMold;
    this.moldLabel.visible = showMold;
    if (showMold) {
      updateGlassBlock(this.moldFrame, {
        width: sigmaWorld,
        height: sigmaWorld,
        depth: thicknessWorld,
        opacity: 0.08 * tMold
      });
      this.moldFrame.position.set(worldMu, sigmaWorld * 0.5, 0);
      this.labels.updateLabel(this.moldLabel, {
        text: `定厚 1.00 模具 · 邊長 σ = ${sd.toFixed(2)}`,
        position: [worldMu, sigmaWorld + 0.25, 0],
        visible: true
      });
    }

    // 紫羅蘭一維標準差尺規（Stage 3 從底邊剝離並對齊數線 μ ± σ）
    const showRuler = tRuler > 0.02 && sd >= EPSILON;
    this.rulerGroup.visible = showRuler;
    this.labelSigmaLeft.visible = tRuler > 0.65 && sd >= EPSILON;
    this.labelSigmaRight.visible = tRuler > 0.65 && sd >= EPSILON;

    if (showRuler) {
      const zOut = THREE.MathUtils.lerp(thicknessWorld * 0.5 + 0.04, thicknessWorld * 0.5 + 0.22, tRuler);
      const yPos = 0.035;

      this.rulerLeft.scale.set(sigmaWorld, 1, 1);
      this.rulerRight.scale.set(sigmaWorld, 1, 1);

      const leftTargetX = worldMu - sigmaWorld * 0.5;
      const rightTargetX = worldMu + sigmaWorld * 0.5;
      this.rulerLeft.position.set(THREE.MathUtils.lerp(worldMu, leftTargetX, tRuler), yPos, zOut);
      this.rulerRight.position.set(THREE.MathUtils.lerp(worldMu, rightTargetX, tRuler), yPos, zOut);

      this.labels.updateLabel(this.labelSigmaLeft, {
        text: `μ−σ = ${(mu - sd).toFixed(2)}`,
        position: [worldMu - sigmaWorld, 0.2, zOut]
      });
      this.labels.updateLabel(this.labelSigmaRight, {
        text: `μ+σ = ${(mu + sd).toFixed(2)}`,
        position: [worldMu + sigmaWorld, 0.2, zOut]
      });
    }

    // 更新物理槓桿
    const leverMin = Math.min(-2.8, toWorldX(minX) - 0.6, worldPivot - 0.5);
    const leverMax = Math.max(2.8, toWorldX(maxX) + 0.6, worldPivot + 0.5);
    this.lever.update({
      beads: beads.map((b, i) => ({
        x: toWorldX(b.x),
        p: b.p,
        color: BEAD_PALETTE[i % BEAD_PALETTE.length],
        token: `bead:${b.id}`
      })),
      mu: worldMu,
      pivot: worldPivot,
      minX: leverMin,
      maxX: leverMax
    });

    this.labels.updateLabel(this.muLabel, {
      text: `重心 μ = ${mu.toFixed(2)}`,
      position: [worldMu, -0.64, 0]
    });
  }

  _updateReadout(state, cachedMetrics = null) {
    const metrics = cachedMetrics || computeAllMetrics(state.beads, state.pivotOverride);
    const { beads, mu, pivot, variance, sd, inertiaAtPivot, torque } = metrics;

    let minX = beads[0].x;
    let maxX = beads[0].x;
    for (const b of beads) {
      if (b.x < minX) minX = b.x;
      if (b.x > maxX) maxX = b.x;
    }
    const pad = Math.max(1, (maxX - minX) * 0.25);

    const pivotSlider = this.controlsHost.querySelector('[data-role="mod2-pivot-slider"]');
    pivotSlider.min = String(Number((minX - pad).toFixed(2)));
    pivotSlider.max = String(Number((maxX + pad).toFixed(2)));
    pivotSlider.step = String(pad > 5 ? 0.5 : 0.05);
    pivotSlider.value = String(pivot);

    const isOffCenter = state.pivotOverride !== null && Math.abs(mu - pivot) > EPSILON;
    this.controlsHost.querySelector('[data-role="mod2-pivot-val"]').textContent = isOffCenter
      ? `a = ${pivot.toFixed(2)}（偏離！）`
      : `鎖定重心 μ = ${mu.toFixed(2)}`;

    this.controlsHost.querySelector('[data-role="mod2-inertia-readout"]').textContent = isOffCenter
      ? `I(a) = ${inertiaAtPivot.toFixed(4)}（膨脹 +${((mu - pivot) ** 2).toFixed(4)}）`
      : `I(μ) = ${variance.toFixed(4)}（最小值）`;

    const chip = this.controlsHost.querySelector('[data-role="mod2-state-chip"]');
    chip.textContent = this._isRecast ? '降維尺規展開 μ ± σ' : '3D 偏差方柱';

    const recastBtn = this.controlsHost.querySelector('[data-role="btn-recast-sd"]');
    recastBtn.disabled = sd < EPSILON;
    recastBtn.textContent =
      sd < EPSILON
        ? '目前變異數為 0（無須降維）'
        : this._isRecast
          ? '重設回 3D 偏差方柱'
          : '定厚重鑄降維動畫（√σ² → μ ± σ）';

    const cautionEl = this.controlsHost.querySelector('[data-role="mod2-ruler-caution"]');
    if (cautionEl) {
      cautionEl.style.display = this._isRecast && sd >= EPSILON ? 'block' : 'none';
    }

    const narrationEl = this.controlsHost.querySelector('[data-role="mod2-narration"]');
    if (sd < EPSILON) {
      narrationEl.textContent =
        `所有珠子都集中於 x = ${mu.toFixed(2)}，完全沒有離散對立面！偏差方柱體積與標準差尺規皆為 0。`;
    } else if (isOffCenter) {
      narrationEl.textContent =
        `支點偏離重心至 a = ${pivot.toFixed(2)}，淨力矩 τ = ${torque.toFixed(2)} 使槓桿傾斜！` +
        `根據平行軸定理 I(a) = σ² + (μ−a)²，上方方柱總體積已膨脹為 ${inertiaAtPivot.toFixed(4)}。`;
    } else if (this._isRecast) {
      narrationEl.textContent =
        `所有 3D 方柱已重鑄為「厚度 1.00、邊長 σ = ${sd.toFixed(2)}」的正方形薄板，並從底邊剝離出紫羅蘭一維尺規掛載至 μ ± σ = [${(mu - sd).toFixed(2)}, ${(mu + sd).toFixed(2)}]。`;
    } else {
      narrationEl.textContent =
        `跨出單次二項後，珠子高度 P(x) 無法合併為統一厚度 1.00，第三維度的機率權重清晰現形；` +
        `點擊上方按鈕可觀看「定厚重鑄開根號降維」動畫，或拖歪支點觀察總體積膨脹。`;
    }
  }

  _updateFormulaLens(state, metrics) {
    if (!this.formulaLens) return;
    const { perBead, mu, pivot, variance, sd, inertiaAtPivot } = metrics;
    const isOffCenter = state.pivotOverride !== null && Math.abs(mu - pivot) > EPSILON;
    const mode = state.formulaMode;

    let parts = [];
    if (mode === 'symbolic') {
      parts = [
        { type: 'op', text: isOffCenter ? 'I(a) = ' : 'σ² = ' },
        ...perBead.flatMap((b, i) => [
          ...(i > 0 ? [{ type: 'op', text: ' + ' }] : []),
          {
            type: 'token',
            token: `bead:${b.id}`,
            tex: isOffCenter ? `(x_${i + 1}-a)^2 P(x_${i + 1})` : `(x_${i + 1}-\\mu)^2 P(x_${i + 1})`,
            fallback: `(x${i + 1}-μ)²P(x${i + 1})`
          }
        ]),
        { type: 'op', text: ' ,  ' },
        {
          type: 'token',
          token: 'sigma',
          colorRole: 'negative',
          tex: '\\sigma = \\sqrt{\\sigma^2}',
          fallback: 'σ = √σ²'
        }
      ];
    } else if (mode === 'numeric') {
      const aStr = pivot.toFixed(2);
      parts = [
        { type: 'op', text: isOffCenter ? 'I(a) = ' : 'σ² = ' },
        ...perBead.flatMap((b, i) => [
          ...(i > 0 ? [{ type: 'op', text: ' + ' }] : []),
          {
            type: 'token',
            token: `bead:${b.id}`,
            tex: `(${b.x}-${aStr})^2(${b.p.toFixed(2)})`,
            fallback: `(${b.x}-${aStr})²(${b.p.toFixed(2)})`
          }
        ]),
        { type: 'op', text: ' = ' },
        {
          type: 'token',
          token: 'sigma',
          colorRole: 'negative',
          tex: isOffCenter ? inertiaAtPivot.toFixed(2) : `${variance.toFixed(2)} \\;(\\sigma=${sd.toFixed(2)})`,
          fallback: `${variance.toFixed(2)}`
        }
      ];
    } else {
      parts = [
        ...perBead.flatMap((b, i) => {
          const dist = Math.abs(b.x - pivot).toFixed(2);
          return [
            ...(i > 0 ? [{ type: 'op', text: ' + ' }] : []),
            {
              type: 'token',
              token: `bead:${b.id}`,
              tex: `[${dist}\\times ${dist}\\times ${b.p.toFixed(2)}]`,
              fallback: `[${dist}×${dist}×${b.p.toFixed(2)}]`
            }
          ];
        }),
        { type: 'op', text: ' → ' },
        {
          type: 'token',
          token: 'sigma',
          colorRole: 'negative',
          tex: `[1.00\\times ${sd.toFixed(2)}\\times ${sd.toFixed(2)}]`,
          fallback: `[1.00×${sd.toFixed(2)}×${sd.toFixed(2)}]`
        }
      ];
    }

    const key = `m2|${mode}|${pivot.toFixed(2)}|${perBead.map((b) => `${b.id}:${b.x}:${b.p.toFixed(3)}`).join(',')}`;
    this.formulaLens.update({ mode, parts, key }, state.hoveredToken);
  }

  onHover(token) {
    const metrics = computeAllMetrics(this.store.getState().beads, this.store.getState().pivotOverride);
    let hoveredBlock = null;
    let hoveredBead = null;

    for (let i = 0; i < this._blocks.length; i += 1) {
      const block = this._blocks[i];
      const b = metrics.beads[i];
      const isHit = Boolean(token && (token === `bead:${b.id}` || token === 'sigma'));
      setBlockHighlight(block, isHit);
      if (token === `bead:${b.id}`) {
        hoveredBlock = block;
        hoveredBead = b;
      }
    }

    const rulerGlow = token === 'sigma' ? 0.95 : 0.55;
    this.rulerLeft.material.emissiveIntensity = rulerGlow;
    this.rulerRight.material.emissiveIntensity = rulerGlow;

    if (hoveredBlock && hoveredBlock.visible && hoveredBead && !this._isRecast) {
      const dist = Math.abs(hoveredBead.x - metrics.pivot);
      this.labels.showBlockEdgeLabels(hoveredBlock, {
        xText: `寬 |x-a|=${dist.toFixed(2)}`,
        yText: `高 P=${hoveredBead.p.toFixed(2)}`,
        zText: `深 |x-a|=${dist.toFixed(2)}`
      });
    } else {
      this.labels.clearHoverLabels();
    }
  }

  dispose() {
    this._abortController.abort();
    gsap.killTweensOf(this._animState);
    this.labels.clearAll();
    this._blocks = [];
    this._axisLabels = [];
    super.dispose();
  }
}
