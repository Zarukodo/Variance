/**
 * 模組三：原點暴力建模與美工刀切割（捷徑版／平行軸定理）
 * - 雙子模式：
 *   1. general（通用多珠四步驟）：
 *      Step 0: 原點暴力建柱 Σx²P(x)
 *      Step 1: 十字雷射切線與爆炸拆解（嚴格依 2*mu*d 正負號決定翠綠/紫羅蘭幽靈負體積）
 *      Step 2: 正負側翼飛向空中對撞並粒子化蒸發（Σ 2μ d_i P(x_i) = 0）
 *      Step 3: 金色 μ² 底座沿垂直機率刻度尺疊滿 1.00，由紅雷射美工刀切離，餘下純變異數 σ²
 *   2. bernoulli（單次二項極簡三步驟）：
 *      Step 0: 0 號珠歸零，1 號珠建 1×1×π 立柱
 *      Step 1: 真正旋轉 90° 放倒成厚度 1、正面 1×π 薄板
 *      Step 2: 切下厚度 1、正面 π×π 正方形 μ²，餘下 π(1-π)
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
import { COLORS, EPSILON, RENDER_ORDER } from '../core/constants.js';
import { computeAllMetrics, computeBernoulliMetrics } from '../core/mathEngine.js';

const GENERAL_STEP_TITLES = [
  '步驟 1/4：原點暴力建柱 Σx²P(x)',
  '步驟 2/4：十字切線與爆炸拆解',
  '步驟 3/4：正負側翼對撞蒸發',
  '步驟 4/4：底座疊合 1.00 與雷射切割'
];

const BERNOULLI_STEP_TITLES = [
  '步驟 1/3：0 號珠歸零，僅存 1×1×π',
  '步驟 2/3：旋轉 90° 放倒成 1×π 薄板',
  '步驟 3/3：切下 π×π 正方形 μ²，餘下 π(1−π)'
];

export class Mod3OriginCut extends BaseModule {
  constructor(context) {
    super(context);
    this.formulaLens = context.formulaLens;
    this.labels = new LabelManager();
    this._abortController = new AbortController();
    this._generalItems = [];
    this._autoTimer = null;
    this._isAutoPlaying = false;
    this._particleBurst = null;
  }

  init() {
    super.init();
    this.generalGroup = new THREE.Group();
    this.bernoulliGroup = new THREE.Group();
    this.root.add(this.generalGroup, this.bernoulliGroup);

    this._setupGeneralHelpers();
    this._setupBernoulliHelpers();
    this._renderControlsUI();
    this._bindEvents();

    const st = this.store.getState();
    const maxStep = st.mod3SubMode === 'bernoulli' ? 2 : 3;
    if (st.timelineStep > maxStep) {
      this.store.setState({ timelineStep: 0 });
    } else {
      this.update(st);
    }
  }

  _setupGeneralHelpers() {
    // 垂直機率刻度尺（位於右側底座堆疊區旁，總高度 1.00 * sY）
    this.probRulerGroup = new THREE.Group();
    this.probRulerGroup.visible = false;
    this.probCaliper = createCaliperBracket({
      length: 1,
      color: COLORS.muHex,
      tickSize: 0.1
    });
    this.probRulerGroup.add(this.probCaliper);

    this.probRulerLabel = this.labels.addLabel(this.probRulerGroup, {
      text: 'ΣP(x) = 1.00',
      position: [0.35, 0, 0],
      className: 'scene-label is-mu',
      persistent: true
    });
    this.generalGroup.add(this.probRulerGroup);

    // 紅色雷射美工刀切面
    const knifeGeo = new THREE.PlaneGeometry(3.2, 3.2);
    knifeGeo.rotateX(-Math.PI / 2);
    const knifeMat = new THREE.MeshBasicMaterial({
      color: COLORS.bead0Hex,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.laserKnife = new THREE.Mesh(knifeGeo, knifeMat);
    this.laserKnife.renderOrder = RENDER_ORDER.LASER_CUT;
    this.laserKnife.visible = false;
    this.generalGroup.add(this.laserKnife);

    // 側翼空中對撞蒸發粒子群
    const count = 48;
    const positions = new Float32Array(count * 3);
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.12,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    this._particleBurst = new THREE.Points(pGeo, pMat);
    this._particleBurst.renderOrder = RENDER_ORDER.LASER_CUT;
    this._particleBurst.visible = false;
    this.generalGroup.add(this._particleBurst);

    this.collisionLabel = this.labels.addLabel(this.generalGroup, {
      text: 'Σ 2μ dᵢ P(xᵢ) = 0（正負互殺蒸發）',
      position: [0, 2.75, 0],
      className: 'scene-label is-caliper',
      persistent: true
    });
    this.collisionLabel.visible = false;

    this.remainLabel = this.labels.addLabel(this.generalGroup, {
      text: '檯面剩餘純變異數 σ²',
      position: [0, 1.4, 0],
      className: 'scene-label is-caliper',
      persistent: true
    });
    this.remainLabel.visible = false;
  }

  _setupBernoulliHelpers() {
    this.b1OriginBlock = createGlassBlock({
      color: COLORS.bead1Hex,
      opacity: 0.46,
      renderOrder: RENDER_ORDER.CORE_COLUMN,
      token: 'b1_origin'
    });
    this.bCoreBlock = createGlassBlock({
      color: COLORS.muHex,
      opacity: 0.65,
      renderOrder: RENDER_ORDER.CORE_COLUMN,
      token: 'b_core'
    });
    this.bPureBlock = createGlassBlock({
      color: COLORS.positiveHex,
      opacity: 0.54,
      renderOrder: RENDER_ORDER.PURE_VARIANCE,
      token: 'b_pure'
    });

    // 水平紅雷射美工刀（Step 2 沿 y = π 水平切離底部的 μ² = π²）
    const knifeGeo = new THREE.PlaneGeometry(1.4, 1.4);
    knifeGeo.rotateX(-Math.PI / 2);
    const knifeMat = new THREE.MeshBasicMaterial({
      color: COLORS.bead0Hex,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.bLaserKnife = new THREE.Mesh(knifeGeo, knifeMat);
    this.bLaserKnife.renderOrder = RENDER_ORDER.LASER_CUT;
    this.bLaserKnife.visible = false;

    this.b0ZeroLabel = this.labels.addLabel(this.bernoulliGroup, {
      text: '0 號珠：0² = 0（歸零）',
      position: [-0.85, 0.1, 0],
      className: 'scene-label is-axis',
      persistent: true
    });
    this.bCoreLabel = this.labels.addLabel(this.bernoulliGroup, {
      text: '削去 μ² = π²',
      position: [0, 0.2, 0],
      className: 'scene-label is-mu',
      persistent: true
    });
    this.bPureLabel = this.labels.addLabel(this.bernoulliGroup, {
      text: '餘下 π(1−π)',
      position: [0, 0.85, 0],
      className: 'scene-label is-caliper',
      persistent: true
    });

    this.bernoulliGroup.add(
      this.b1OriginBlock,
      this.bCoreBlock,
      this.bPureBlock,
      this.bLaserKnife
    );
  }

  _renderControlsUI() {
    this.controlsHost.innerHTML = `
      <section class="glass-card mod-control-card">
        <div class="card-header">
          <div>
            <p class="eyebrow">MODULE 3 · PARALLEL AXIS &amp; CUT</p>
            <h2 class="card-title">原點暴力建模與美工刀切割</h2>
          </div>
          <span class="tag-chip" data-role="mod3-step-badge">步驟 1/4</span>
        </div>

        <div class="lens-tabs" role="tablist" aria-label="模組三子模式">
          <button type="button" class="lens-tab" data-submode="general">通用多珠四步驟</button>
          <button type="button" class="lens-tab" data-submode="bernoulli">單次二項極簡三步驟</button>
        </div>

        <div class="control-block" data-role="mod3-pi-box" style="display:none;">
          <div class="slider-row">
            <span class="field-label">單次二項成功機率 π</span>
            <strong class="mono-value" data-role="mod3-pi-val">0.30</strong>
          </div>
          <input type="range" min="0" max="1" step="0.01" value="0.30" class="range-slider" data-role="mod3-pi-slider" />
        </div>

        <div class="timeline-controls">
          <button type="button" class="ghost-btn" data-role="btn-prev-step">◀ 上一步</button>
          <button type="button" class="primary-btn is-compact" data-role="btn-autoplay">▶ 自動播放</button>
          <button type="button" class="ghost-btn" data-role="btn-next-step">下一步 ▶</button>
          <button type="button" class="ghost-btn" data-role="btn-replay">↺ 重播</button>
        </div>

        <div class="step-dots" data-role="step-dots"></div>
      </section>

      <section class="glass-card narration-card">
        <p class="eyebrow">STEP NARRATION</p>
        <p class="narration-text" data-role="mod3-narration"></p>
      </section>
    `;
  }

  _bindEvents() {
    const { signal } = this._abortController;

    this.controlsHost.addEventListener(
      'click',
      (event) => {
        const subBtn = event.target.closest('[data-submode]');
        if (subBtn) {
          this._stopAutoPlay();
          this.store.setState({
            mod3SubMode: subBtn.dataset.submode,
            timelineStep: 0,
            hoveredToken: null
          });
          return;
        }

        const dotBtn = event.target.closest('[data-step-dot]');
        if (dotBtn) {
          this._stopAutoPlay();
          this.store.setState({ timelineStep: Number(dotBtn.dataset.stepDot) });
          return;
        }

        if (event.target.closest('[data-role="btn-prev-step"]')) {
          this._stopAutoPlay();
          const cur = this.store.getState().timelineStep;
          this.store.setState({ timelineStep: Math.max(0, cur - 1) });
          return;
        }

        if (event.target.closest('[data-role="btn-next-step"]')) {
          this._stopAutoPlay();
          const st = this.store.getState();
          const maxStep = st.mod3SubMode === 'bernoulli' ? 2 : 3;
          this.store.setState({ timelineStep: Math.min(maxStep, st.timelineStep + 1) });
          return;
        }

        if (event.target.closest('[data-role="btn-replay"]')) {
          this._stopAutoPlay();
          this.store.setState({ timelineStep: 0 });
          this._startAutoPlay();
          return;
        }

        if (event.target.closest('[data-role="btn-autoplay"]')) {
          if (this._isAutoPlaying) {
            this._stopAutoPlay();
          } else {
            this._startAutoPlay();
          }
        }
      },
      { signal }
    );

    const piSlider = this.controlsHost.querySelector('[data-role="mod3-pi-slider"]');
    piSlider.addEventListener(
      'input',
      (e) => {
        this.store.setBernoulliPi(Number(e.target.value));
      },
      { signal }
    );
  }

  _startAutoPlay() {
    this._stopAutoPlay();
    this._isAutoPlaying = true;
    this._updateAutoPlayButton();

    const advance = () => {
      if (!this._isAutoPlaying || this._disposed) return;
      const st = this.store.getState();
      const maxStep = st.mod3SubMode === 'bernoulli' ? 2 : 3;
      if (st.timelineStep >= maxStep) {
        this._stopAutoPlay();
        return;
      }
      this.store.setState({ timelineStep: st.timelineStep + 1 });
      this._autoTimer = setTimeout(advance, 1750);
    };

    this._autoTimer = setTimeout(advance, 1300);
  }

  _stopAutoPlay() {
    if (this._autoTimer !== null) {
      clearTimeout(this._autoTimer);
      this._autoTimer = null;
    }
    this._isAutoPlaying = false;
    this._updateAutoPlayButton();
  }

  _updateAutoPlayButton() {
    const btn = this.controlsHost?.querySelector('[data-role="btn-autoplay"]');
    if (!btn) return;
    btn.textContent = this._isAutoPlaying ? '❚❚ 暫停' : '▶ 自動播放';
  }

  _syncGeneralPool(count) {
    while (this._generalItems.length < count) {
      const group = new THREE.Group();
      const originFull = createGlassBlock({
        color: COLORS.bead1Hex,
        opacity: 0.42,
        renderOrder: RENDER_ORDER.CORE_COLUMN
      });
      const coreBlock = createGlassBlock({
        color: COLORS.muHex,
        opacity: 0.62,
        renderOrder: RENDER_ORDER.CORE_COLUMN
      });
      const wingA = createGlassBlock({
        color: COLORS.positiveHex,
        opacity: 0.48,
        renderOrder: RENDER_ORDER.WINGS
      });
      const wingB = createGlassBlock({
        color: COLORS.positiveHex,
        opacity: 0.48,
        renderOrder: RENDER_ORDER.WINGS
      });
      const wingAGhost = createGlassBlock({
        color: COLORS.negativeHex,
        opacity: 0.34,
        renderOrder: RENDER_ORDER.WINGS,
        dashed: true
      });
      const wingBGhost = createGlassBlock({
        color: COLORS.negativeHex,
        opacity: 0.34,
        renderOrder: RENDER_ORDER.WINGS,
        dashed: true
      });
      const pureBlock = createGlassBlock({
        color: COLORS.positiveHex,
        opacity: 0.56,
        renderOrder: RENDER_ORDER.PURE_VARIANCE
      });

      const slotLabel = this.labels.addLabel(group, {
        text: '',
        position: [0, -0.05, 1.2],
        className: 'scene-label is-axis',
        persistent: true
      });

      group.add(
        originFull,
        coreBlock,
        wingA,
        wingB,
        wingAGhost,
        wingBGhost,
        pureBlock
      );
      this.generalGroup.add(group);
      this._generalItems.push({
        group,
        originFull,
        coreBlock,
        wingA,
        wingB,
        wingAGhost,
        wingBGhost,
        pureBlock,
        slotLabel
      });
    }

    while (this._generalItems.length > count) {
      const item = this._generalItems.pop();
      this.generalGroup.remove(item.group);
      this.disposeObject3D(item.group);
    }
  }

  _killActiveAnimations() {
    gsap.killTweensOf(this.laserKnife.position);
    gsap.killTweensOf(this.laserKnife.material);
    gsap.killTweensOf(this.bLaserKnife.position);
    gsap.killTweensOf(this.b1OriginBlock.position);
    gsap.killTweensOf(this.b1OriginBlock.rotation);
    gsap.killTweensOf(this.bCoreBlock.position);
    gsap.killTweensOf(this.bPureBlock.position);
    if (this._particleBurst) {
      gsap.killTweensOf(this._particleBurst.material);
    }
    for (const item of this._generalItems) {
      [
        item.originFull,
        item.coreBlock,
        item.wingA,
        item.wingB,
        item.wingAGhost,
        item.wingBGhost,
        item.pureBlock
      ].forEach((b) => {
        gsap.killTweensOf(b.position);
        gsap.killTweensOf(b.scale);
      });
    }
  }

  update(state) {
    const isBernoulli = state.mod3SubMode === 'bernoulli';
    this.generalGroup.visible = !isBernoulli;
    this.bernoulliGroup.visible = isBernoulli;

    const piBox = this.controlsHost.querySelector('[data-role="mod3-pi-box"]');
    piBox.style.display = isBernoulli ? 'block' : 'none';

    for (const btn of this.controlsHost.querySelectorAll('[data-submode]')) {
      btn.classList.toggle('is-active', btn.dataset.submode === state.mod3SubMode);
    }

    if (isBernoulli) {
      this.stage.setCameraHome([2.1, 1.65, 2.95], [0.1, 0.45, 0]);
      this._renderBernoulliSteps(state);
    } else {
      this.stage.setCameraHome([5.8, 4.8, 9.4], [0.2, 1.05, 0]);
      this._renderGeneralSteps(state);
    }

    this._renderStepDots(state);
    this._updateFormulaLens(state);
    this.onHover(state.hoveredToken);
  }

  _renderGeneralSteps(state) {
    const metrics = computeAllMetrics(state.beads, null);
    const { perBead, mu, mu2, variance, ex2, wingNetSum } = metrics;
    const step = Math.min(3, Math.max(0, state.timelineStep));

    this._syncGeneralPool(perBead.length);
    this._killActiveAnimations();

    const maxAbsX = Math.max(1, ...perBead.map((b) => Math.abs(b.x)), Math.abs(mu));
    const sX = Math.min(0.42, 2.2 / maxAbsX);
    const sY = 1.8;
    const slotGap = 3.1;
    const totalSpan = (perBead.length - 1) * slotGap;
    const startX = -totalSpan * 0.5 - 0.7;

    const stackCenterX = startX + perBead.length * slotGap + 0.35;
    let accumProbY = 0;

    this.probRulerGroup.visible = step === 3;
    this.laserKnife.visible = step === 3;
    this.collisionLabel.visible = step === 2;
    this.remainLabel.visible = step === 3;
    this._particleBurst.visible = false;

    const hasAnyWing = perBead.some((b) => Math.abs(b.wingVolume) >= EPSILON);

    for (let i = 0; i < perBead.length; i += 1) {
      const b = perBead[i];
      const item = this._generalItems[i];
      const slotX = startX + i * slotGap;
      item.group.position.set(0, 0, 0);

      const h = b.p * sY;
      const xSide = Math.abs(b.x) * sX;
      const muSide = Math.abs(mu) * sX;
      const dSide = Math.abs(b.d) * sX;

      const tokenOrigin = `origin:${b.id}`;
      const tokenCore = 'core';
      const tokenPure = `pure:${b.id}`;

      item.originFull.userData.token = tokenOrigin;
      if (item.originFull.userData.fillMesh) item.originFull.userData.fillMesh.userData.token = tokenOrigin;
      item.coreBlock.userData.token = tokenCore;
      if (item.coreBlock.userData.fillMesh) item.coreBlock.userData.fillMesh.userData.token = tokenCore;
      item.pureBlock.userData.token = tokenPure;
      if (item.pureBlock.userData.fillMesh) item.pureBlock.userData.fillMesh.userData.token = tokenPure;

      // 嚴格依 2*mu*d_i 實際正負號判定正／負側翼（嚴禁寫死 d_i > 0）
      const isPosWing = b.isPositiveWing;

      updateGlassBlock(item.originFull, { width: xSide, height: h, depth: xSide });
      updateGlassBlock(item.coreBlock, { width: muSide, height: h, depth: muSide });
      updateGlassBlock(item.pureBlock, { width: dSide, height: h, depth: dSide });

      updateGlassBlock(item.wingA, { width: dSide, height: h, depth: muSide });
      updateGlassBlock(item.wingB, { width: muSide, height: h, depth: dSide });
      updateGlassBlock(item.wingAGhost, { width: dSide, height: h, depth: muSide });
      updateGlassBlock(item.wingBGhost, { width: muSide, height: h, depth: dSide });

      this.labels.updateLabel(item.slotLabel, {
        text: `x=${b.x} (P=${b.p.toFixed(2)})`,
        position: [slotX, -0.05, Math.max(1.1, xSide * 0.6 + 0.35)],
        visible: true
      });

      // Step 0: 原點暴力建模大柱
      item.originFull.visible = step === 0 && xSide >= EPSILON && h >= EPSILON;
      item.originFull.position.set(slotX, h * 0.5, 0);

      // Step 1..3: 中央底座與角落純偏差塊
      const showDecomposed = step >= 1;
      item.coreBlock.visible = showDecomposed && muSide >= EPSILON && h >= EPSILON;
      item.pureBlock.visible = showDecomposed && dSide >= EPSILON && h >= EPSILON;

      const explodeGap = step >= 1 ? 0.28 : 0;
      const wingShiftX = (muSide + dSide) * 0.5 + explodeGap;
      const wingShiftZ = (muSide + dSide) * 0.5 + explodeGap;

      // 角落純偏差塊 d_i^2 始終保持翠綠正實心
      item.pureBlock.position.set(slotX + wingShiftX, h * 0.5, wingShiftZ);

      const showWings = step === 1 || step === 2;
      item.wingA.visible = showWings && isPosWing && dSide >= EPSILON && muSide >= EPSILON && h >= EPSILON;
      item.wingB.visible = showWings && isPosWing && dSide >= EPSILON && muSide >= EPSILON && h >= EPSILON;
      item.wingAGhost.visible = showWings && !isPosWing && dSide >= EPSILON && muSide >= EPSILON && h >= EPSILON;
      item.wingBGhost.visible = showWings && !isPosWing && dSide >= EPSILON && muSide >= EPSILON && h >= EPSILON;

      const ghostLift = isPosWing ? 0 : 0.72;
      item.wingA.position.set(slotX + wingShiftX, h * 0.5, 0);
      item.wingB.position.set(slotX, h * 0.5, wingShiftZ);
      item.wingAGhost.position.set(slotX + wingShiftX, h * 0.5 + ghostLift, 0);
      item.wingBGhost.position.set(slotX, h * 0.5 + ghostLift, wingShiftZ);

      item.wingA.scale.set(1, 1, 1);
      item.wingB.scale.set(1, 1, 1);
      item.wingAGhost.scale.set(1, 1, 1);
      item.wingBGhost.scale.set(1, 1, 1);

      if (step === 2 && hasAnyWing) {
        const targetFly = { x: 0, y: 2.35, z: 0 };
        const activeWings = isPosWing
          ? [item.wingA, item.wingB]
          : [item.wingAGhost, item.wingBGhost];
        for (const w of activeWings) {
          if (!w.visible) continue;
          gsap.to(w.position, {
            x: targetFly.x,
            y: targetFly.y,
            z: targetFly.z,
            duration: 0.75,
            ease: 'power2.in'
          });
          gsap.to(w.scale, {
            x: 0.01,
            y: 0.01,
            z: 0.01,
            delay: 0.62,
            duration: 0.35,
            onComplete: () => {
              w.visible = false;
            }
          });
        }
        this._triggerParticleBurst(targetFly);
      }

      if (step < 3) {
        item.coreBlock.position.set(slotX, h * 0.5, 0);
      } else {
        const stackY = accumProbY + h * 0.5;
        accumProbY += h;
        item.coreBlock.position.set(slotX, h * 0.5, 0);
        gsap.to(item.coreBlock.position, {
          x: stackCenterX,
          y: stackY,
          z: 0,
          duration: 0.55,
          delay: i * 0.1,
          ease: 'power2.out'
        });
        gsap.to(item.coreBlock.position, {
          x: stackCenterX + 2.6,
          duration: 0.55,
          delay: 0.98,
          ease: 'power2.in',
          onComplete: () => {
            item.coreBlock.visible = false;
          }
        });
      }
    }

    if (step === 3) {
      this.probRulerGroup.position.set(stackCenterX - Math.max(0.25, muSideRef(mu, sX)) * 0.5 - 0.32, sY * 0.5, 0);
      this.probCaliper.scale.set(1, sY, 1);
      this.labels.updateLabel(this.probRulerLabel, {
        text: 'ΣP(x) = 1.00',
        position: [-0.28, sY * 0.5 + 0.18, 0],
        visible: true
      });

      this.laserKnife.position.set(stackCenterX, 0.02, -1.6);
      this.laserKnife.material.opacity = 0.42;
      gsap.to(this.laserKnife.position, {
        z: 1.6,
        duration: 0.55,
        delay: 0.72,
        ease: 'power1.inOut'
      });

      this.labels.updateLabel(this.remainLabel, {
        text: `剩餘純變異數 σ² = ${variance.toFixed(4)}`,
        position: [0, 1.35, 0.6],
        visible: true
      });
    }

    const badge = this.controlsHost.querySelector('[data-role="mod3-step-badge"]');
    badge.textContent = GENERAL_STEP_TITLES[step];

    const narration = this.controlsHost.querySelector('[data-role="mod3-narration"]');
    if (step === 0) {
      narration.textContent =
        `在原點 0 暴力建立所有大柱 Σx²P(x) = ${ex2.toFixed(4)}。每塊正方形邊長為 xᵢ，高度為各自機率 P(xᵢ)。`;
    } else if (step === 1) {
      narration.textContent =
        `依 xᵢ = μ + dᵢ 十字切開：中央金色底座 μ² = ${mu2.toFixed(4)}、兩條側翼 2μdᵢ，與角落翠綠純偏差 dᵢ²。` +
        `當 2μdᵢ < 0 時，負側翼會上浮為紫羅蘭虛線「幽靈負體積」，而角落 dᵢ² 依排容幾何仍保持翠綠實心正塊！`;
    } else if (step === 2) {
      narration.textContent =
        `依重心平衡鐵律 ΣdᵢP(xᵢ) = 0，正負側翼飛往空中對撞並粒子化蒸發歸零（淨和 ${wingNetSum.toFixed(4)}）！`;
    } else {
      narration.textContent =
        `所有金色 μ² 底座沿垂直機率刻度尺疊滿高度 1.00（總體積 μ² = ${mu2.toFixed(4)}），隨即被紅色雷射美工刀水平切離；` +
        `檯面僅留純變異數積木群 σ² = ${variance.toFixed(4)}，與模組二完全吻合！`;
    }
  }

  _triggerParticleBurst(center) {
    if (!this._particleBurst) return;
    const attr = this._particleBurst.geometry.getAttribute('position');
    for (let i = 0; i < attr.count; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.25 + Math.random() * 0.75;
      attr.setXYZ(
        i,
        center.x + r * Math.sin(phi) * Math.cos(theta),
        center.y + r * Math.cos(phi),
        center.z + r * Math.sin(phi) * Math.sin(theta)
      );
    }
    attr.needsUpdate = true;
    this._particleBurst.visible = true;
    this._particleBurst.material.opacity = 0;
    gsap.to(this._particleBurst.material, {
      opacity: 0.95,
      delay: 0.65,
      duration: 0.18,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        if (this._particleBurst) this._particleBurst.visible = false;
      }
    });
  }

  _renderBernoulliSteps(state) {
    const { pi, q, mu2, variance } = computeBernoulliMetrics(state.bernoulliPi);
    const step = Math.min(2, Math.max(0, state.timelineStep));
    this._killActiveAnimations();

    this.controlsHost.querySelector('[data-role="mod3-pi-val"]').textContent = pi.toFixed(2);
    this.controlsHost.querySelector('[data-role="mod3-pi-slider"]').value = String(pi);

    this.b0ZeroLabel.visible = true;

    if (step === 0) {
      // 1×1×π 立柱（底 1×1，高 π）
      updateGlassBlock(this.b1OriginBlock, { width: 1, height: pi, depth: 1 });
      this.b1OriginBlock.position.set(0.35, pi * 0.5, 0);
      this.b1OriginBlock.rotation.set(0, 0, 0);

      this.bCoreBlock.visible = false;
      this.bPureBlock.visible = false;
      this.bLaserKnife.visible = false;
      this.bCoreLabel.visible = false;
      this.bPureLabel.visible = false;
    } else if (step === 1) {
      // 由站姿 (1×π×1) 真正旋轉 90° 放倒成「厚度 1、正面 π×1（高 1 寬 π）」薄板
      updateGlassBlock(this.b1OriginBlock, { width: 1, height: pi, depth: 1 });
      this.b1OriginBlock.position.set(0.35, pi * 0.5, 0);
      this.b1OriginBlock.rotation.set(0, 0, 0);

      gsap.to(this.b1OriginBlock.rotation, {
        z: Math.PI * 0.5,
        duration: 0.6,
        ease: 'power2.inOut'
      });
      gsap.to(this.b1OriginBlock.position, {
        y: 0.5,
        duration: 0.6,
        ease: 'power2.inOut'
      });

      this.bCoreBlock.visible = false;
      this.bPureBlock.visible = false;
      this.bLaserKnife.visible = false;
      this.bCoreLabel.visible = false;
      this.bPureLabel.visible = false;
    } else {
      // Step 2: 沿 y = π 水平切開，下方為 π×π×1 (μ²)，上方為 π×(1-π)×1
      this.b1OriginBlock.visible = false;

      updateGlassBlock(this.bCoreBlock, { width: pi, height: pi, depth: 1 });
      updateGlassBlock(this.bPureBlock, { width: pi, height: q, depth: 1 });

      this.bCoreBlock.position.set(0.35, pi * 0.5, 0);
      this.bPureBlock.position.set(0.35, pi + q * 0.5, 0);

      this.bLaserKnife.visible = pi >= EPSILON && q >= EPSILON;
      this.bLaserKnife.position.set(0.35, pi, -0.75);
      gsap.to(this.bLaserKnife.position, {
        z: 0.75,
        duration: 0.52,
        ease: 'power1.inOut'
      });

      gsap.to(this.bCoreBlock.position, {
        x: -0.65,
        delay: 0.45,
        duration: 0.55,
        ease: 'power2.out'
      });

      this.bCoreLabel.visible = pi >= EPSILON;
      this.labels.updateLabel(this.bCoreLabel, {
        text: `切離 μ² = ${mu2.toFixed(4)}`,
        position: [-0.65, pi + 0.16, 0]
      });

      this.bPureLabel.visible = variance >= EPSILON;
      this.labels.updateLabel(this.bPureLabel, {
        text: `餘下 π(1−π) = ${variance.toFixed(4)}`,
        position: [0.35, 1.15, 0]
      });
    }

    const badge = this.controlsHost.querySelector('[data-role="mod3-step-badge"]');
    badge.textContent = BERNOULLI_STEP_TITLES[step];

    const narration = this.controlsHost.querySelector('[data-role="mod3-narration"]');
    if (step === 0) {
      narration.textContent =
        `0 號珠站在原點 0，底面積 0² = 0 直接歸零；只剩 1 號珠建立 1×1×π 立柱（總體積 π = ${pi.toFixed(2)}）。`;
    } else if (step === 1) {
      narration.textContent =
        `將 1×1×π 長方體旋轉 90° 放倒，成為「厚度為 1、正面為 1×π」的扁平薄板。`;
    } else {
      narration.textContent =
        `從薄板切下厚度 1、正面 π×π 的正方形底座（μ² = ${mu2.toFixed(4)}）移走，剩下的長方形正面即為 π × (1−π) = ${variance.toFixed(4)}！`;
    }
  }

  _renderStepDots(state) {
    const total = state.mod3SubMode === 'bernoulli' ? 3 : 4;
    const step = Math.min(total - 1, Math.max(0, state.timelineStep));
    const dotsEl = this.controlsHost.querySelector('[data-role="step-dots"]');
    dotsEl.innerHTML = Array.from({ length: total }, (_, idx) => {
      return `<button type="button" class="step-dot ${idx === step ? 'is-active' : ''}" data-step-dot="${idx}">第 ${idx + 1} 步</button>`;
    }).join('');
  }

  _updateFormulaLens(state) {
    if (!this.formulaLens) return;
    const mode = state.formulaMode;

    if (state.mod3SubMode === 'bernoulli') {
      const { pi, q, mu2, variance } = computeBernoulliMetrics(state.bernoulliPi);
      let parts;
      if (mode === 'symbolic') {
        parts = [
          { type: 'op', text: 'σ² = ' },
          { type: 'token', token: 'b1_origin', colorRole: 'bead1', tex: '1^2\\pi', fallback: '1²π' },
          { type: 'op', text: ' − ' },
          { type: 'token', token: 'b_core', colorRole: 'mu', tex: '\\mu^2', fallback: 'μ²' },
          { type: 'op', text: ' = ' },
          { type: 'token', token: 'b_pure', colorRole: 'positive', tex: '\\pi(1-\\pi)', fallback: 'π(1-π)' }
        ];
      } else if (mode === 'numeric') {
        parts = [
          { type: 'op', text: 'σ² = ' },
          { type: 'token', token: 'b1_origin', colorRole: 'bead1', tex: pi.toFixed(4), fallback: pi.toFixed(4) },
          { type: 'op', text: ' − ' },
          { type: 'token', token: 'b_core', colorRole: 'mu', tex: mu2.toFixed(4), fallback: mu2.toFixed(4) },
          { type: 'op', text: ' = ' },
          { type: 'token', token: 'b_pure', colorRole: 'positive', tex: variance.toFixed(4), fallback: variance.toFixed(4) }
        ];
      } else {
        parts = [
          { type: 'token', token: 'b1_origin', colorRole: 'bead1', tex: `[1.00\\times ${pi.toFixed(2)}\\times 1.00]`, fallback: `[1×${pi.toFixed(2)}×1]` },
          { type: 'op', text: ' − ' },
          { type: 'token', token: 'b_core', colorRole: 'mu', tex: `[${pi.toFixed(2)}\\times ${pi.toFixed(2)}\\times 1.00]`, fallback: `[${pi.toFixed(2)}²×1]` },
          { type: 'op', text: ' = ' },
          { type: 'token', token: 'b_pure', colorRole: 'positive', tex: `[${pi.toFixed(2)}\\times ${q.toFixed(2)}\\times 1.00]`, fallback: `[${pi.toFixed(2)}×${q.toFixed(2)}×1]` }
        ];
      }
      this.formulaLens.update({ mode, parts, key: `m3b|${mode}|${pi.toFixed(2)}` }, state.hoveredToken);
      return;
    }

    const { ex2, mu2, variance, wingNetSum, perBead } = computeAllMetrics(state.beads, null);
    let parts;
    if (mode === 'symbolic') {
      parts = [
        { type: 'op', text: 'σ² = ' },
        { type: 'token', token: 'origin', colorRole: 'bead1', tex: '\\sum x^2 P(x)', fallback: 'Σx²P(x)' },
        { type: 'op', text: ' − ' },
        { type: 'token', token: 'core', colorRole: 'mu', tex: '\\mu^2', fallback: 'μ²' },
        { type: 'op', text: ' = ' },
        { type: 'token', token: 'pure', colorRole: 'positive', tex: '\\sum d_i^2 P(x)', fallback: 'Σdᵢ²P(x)' }
      ];
    } else if (mode === 'numeric') {
      parts = [
        { type: 'op', text: 'σ² = ' },
        { type: 'token', token: 'origin', colorRole: 'bead1', tex: ex2.toFixed(2), fallback: ex2.toFixed(2) },
        { type: 'op', text: ' − ' },
        { type: 'token', token: 'core', colorRole: 'mu', tex: mu2.toFixed(2), fallback: mu2.toFixed(2) },
        { type: 'op', text: ' = ' },
        { type: 'token', token: 'pure', colorRole: 'positive', tex: variance.toFixed(4), fallback: variance.toFixed(4) }
      ];
    } else {
      parts = [
        { type: 'token', token: 'origin', colorRole: 'bead1', tex: `\\text{原點大柱 } ${ex2.toFixed(2)}`, fallback: `原點柱 ${ex2.toFixed(2)}` },
        { type: 'op', text: ' − ' },
        { type: 'token', token: 'core', colorRole: 'mu', tex: `\\text{底座 } ${mu2.toFixed(2)}`, fallback: `底座 ${mu2.toFixed(2)}` },
        { type: 'op', text: ` (側翼=${wingNetSum.toFixed(2)}) = ` },
        { type: 'token', token: 'pure', colorRole: 'positive', tex: `\\sigma^2=${variance.toFixed(4)}`, fallback: `σ²=${variance.toFixed(4)}` }
      ];
    }
    const key = `m3g|${mode}|${perBead.map((b) => `${b.x}:${b.p.toFixed(3)}`).join(',')}`;
    this.formulaLens.update({ mode, parts, key }, state.hoveredToken);
  }

  onHover(token) {
    if (this.store.getState().mod3SubMode === 'bernoulli') {
      setBlockHighlight(this.b1OriginBlock, token === 'b1_origin');
      setBlockHighlight(this.bCoreBlock, token === 'b_core');
      setBlockHighlight(this.bPureBlock, token === 'b_pure');
      return;
    }

    for (const item of this._generalItems) {
      setBlockHighlight(item.originFull, token === 'origin' || token === item.originFull.userData.token);
      setBlockHighlight(item.coreBlock, token === 'core');
      setBlockHighlight(item.pureBlock, token === 'pure' || token === item.pureBlock.userData.token);
    }
  }

  dispose() {
    this._stopAutoPlay();
    this._abortController.abort();
    this._killActiveAnimations();
    this.labels.clearAll();
    this._generalItems = [];
    super.dispose();
  }
}

function muSideRef(mu, sX) {
  return Math.abs(mu) * sX;
}
