/**
 * 模組四：對立引力網（變異數的無重心雙向拉扯詮釋）
 * - 公式：σ² = ½ Σ_i Σ_j P(x_i) P(x_j) (x_i - x_j)²
 * - 隱藏期望值重心 μ，強調「沒有對立面就沒有偏差」
 * - 支援在數線地板上直接拖曳珠子座標（動態更新 store.beads）
 * - 雙向微光脈衝動畫：任兩顆珠子兩端各射出半透明脈衝於中點融合成實心光束，直觀詮釋 ½ 係數
 */

import * as THREE from 'three';
import { BaseModule } from './BaseModule.js';
import { LabelManager } from '../engine/LabelManager.js';
import { BEAD_PALETTE } from '../core/presets.js';
import { COLORS, EPSILON, RENDER_ORDER } from '../core/constants.js';
import { computeAllMetrics } from '../core/mathEngine.js';

export class Mod4GravityWeb extends BaseModule {
  constructor(context) {
    super(context);
    this.formulaLens = context.formulaLens;
    this.labels = new LabelManager();
    this._abortController = new AbortController();
    this._beadNodes = [];
    this._pairLinks = [];
    this._pulsePhase = 0;
    this._rafId = null;
    this._lastTime = performance.now();

    // 拖曳珠子狀態
    this._raycaster = new THREE.Raycaster();
    this._pointerNdc = new THREE.Vector2();
    this._floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._dragState = null;
    this._scaleInfo = { centerX: 0, scaleX: 1 };
  }

  init() {
    super.init();
    this.stage.setCameraHome([0, 4.4, 8.0], [0, 0.5, 0]);

    this.beadsGroup = new THREE.Group();
    this.linksGroup = new THREE.Group();
    this.root.add(this.linksGroup, this.beadsGroup);

    this.midpointNote = this.labels.addLabel(this.root, {
      text: '中點融合 = 配對去重 (× ½)，非重心 μ',
      position: [0, 1.5, 0],
      className: 'scene-label is-caliper',
      persistent: true
    });
    this.midpointNote.visible = false;

    // 數線軌道發光底座
    const railGeo = new THREE.BoxGeometry(8.5, 0.03, 0.12);
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.5,
      roughness: 0.4
    });
    this.railMesh = new THREE.Mesh(railGeo, railMat);
    this.railMesh.position.set(0, 0.015, 0);
    this.railMesh.renderOrder = RENDER_ORDER.LEVER;
    this.root.add(this.railMesh);

    this._renderControlsUI();
    this._bindDragEvents();

    this.update(this.store.getState());
    this._tickPulses();
  }

  _renderControlsUI() {
    this.controlsHost.innerHTML = `
      <section class="glass-card mod-control-card">
        <div class="card-header is-compact">
          <div>
            <h2 class="card-title">對立引力網（隱藏重心 μ）</h2>
          </div>
          <span class="tag-chip" data-role="mod4-tension-chip">張力活躍</span>
        </div>

        <div class="pair-summary" data-role="mod4-pair-list"></div>
      </section>

      <section class="glass-card narration-card">
        <p class="eyebrow">💡 白話直覺</p>
        <p class="narration-text" data-role="mod4-narration"></p>
      </section>
    `;
  }

  _bindDragEvents() {
    const dom = this.stage.renderer.domElement;
    const { signal } = this._abortController;

    const toNdc = (clientX, clientY) => {
      const rect = dom.getBoundingClientRect();
      this._pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this._pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    dom.addEventListener(
      'pointerdown',
      (event) => {
        if (event.button !== 0) return;
        toNdc(event.clientX, event.clientY);
        this._raycaster.setFromCamera(this._pointerNdc, this.stage.activeCamera);
        const hits = this._raycaster.intersectObjects(this.beadsGroup.children, false);
        if (hits.length === 0) return;

        const hitMesh = hits[0].object;
        const beadId = hitMesh.userData.beadId;
        if (!beadId) return;

        // 鎖定當前視覺比例，防止拖曳中視窗座標跳動
        this._dragState = {
          beadId,
          centerX: this._scaleInfo.centerX,
          scaleX: this._scaleInfo.scaleX
        };
        this.stage.controls.enabled = false;
        dom.style.cursor = 'ew-resize';
      },
      { signal }
    );

    window.addEventListener(
      'pointermove',
      (event) => {
        if (!this._dragState) return;
        toNdc(event.clientX, event.clientY);
        this._raycaster.setFromCamera(this._pointerNdc, this.stage.activeCamera);
        const intersectPt = new THREE.Vector3();
        if (!this._raycaster.ray.intersectPlane(this._floorPlane, intersectPt)) return;

        const clampedWorldX = THREE.MathUtils.clamp(intersectPt.x, -4.0, 4.0);
        const rawMathX = this._dragState.centerX + clampedWorldX / this._dragState.scaleX;
        const snapStep = this._dragState.scaleX < 0.3 ? 1 : 0.5;
        const snappedX = Math.round(rawMathX / snapStep) * snapStep;

        const currentBeads = this.store.getState().beads;
        const nextBeads = currentBeads.map((b) =>
          b.id === this._dragState.beadId ? { ...b, x: snappedX } : b
        );
        this.store.setBeads(nextBeads);
      },
      { signal }
    );

    window.addEventListener(
      'pointerup',
      () => {
        if (!this._dragState) return;
        this._dragState = null;
        this.stage.controls.enabled = true;
        dom.style.cursor = 'grab';
      },
      { signal }
    );

    this.controlsHost.addEventListener(
      'pointerover',
      (event) => {
        const chip = event.target.closest('[data-token]');
        if (chip) this.store.setHoveredToken(chip.dataset.token);
      },
      { signal }
    );
    this.controlsHost.addEventListener(
      'pointerout',
      (event) => {
        const chip = event.target.closest('[data-token]');
        if (chip && !event.relatedTarget?.closest?.('[data-token]')) {
          this.store.setHoveredToken(null);
        }
      },
      { signal }
    );
  }

  _computeScale(beads) {
    let minX = beads[0].x;
    let maxX = beads[0].x;
    for (const b of beads) {
      if (b.x < minX) minX = b.x;
      if (b.x > maxX) maxX = b.x;
    }
    const span = maxX - minX;
    const centerX = (minX + maxX) * 0.5;
    const scaleX = span > 0 ? Math.min(1.0, 5.4 / span) : 1.0;
    return { minX, maxX, span, centerX, scaleX };
  }

  _syncBeadNodes(count) {
    while (this._beadNodes.length < count) {
      const geo = new THREE.SphereGeometry(1, 28, 28);
      const mat = new THREE.MeshStandardMaterial({
        color: COLORS.bead1Hex,
        emissive: COLORS.bead1Hex,
        emissiveIntensity: 0.35,
        roughness: 0.2,
        metalness: 0.3
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = RENDER_ORDER.PURE_VARIANCE;
      const lbl = this.labels.addLabel(mesh, {
        text: '',
        position: [0, 1.4, 0],
        className: 'scene-label is-axis',
        persistent: true
      });
      this.beadsGroup.add(mesh);
      this._beadNodes.push({ mesh, lbl });
    }

    while (this._beadNodes.length > count) {
      const node = this._beadNodes.pop();
      this.beadsGroup.remove(node.mesh);
      this.disposeObject3D(node.mesh);
    }
  }

  _syncPairLinks(pairCount) {
    while (this._pairLinks.length < pairCount) {
      const group = new THREE.Group();
      const lineGeo = new THREE.BufferGeometry();
      const lineMat = new THREE.LineBasicMaterial({
        color: COLORS.positiveHex,
        transparent: true,
        opacity: 0.85
      });
      const arcLine = new THREE.Line(lineGeo, lineMat);
      arcLine.renderOrder = RENDER_ORDER.WINGS;

      const tubeMat = new THREE.MeshStandardMaterial({
        color: COLORS.positiveHex,
        emissive: COLORS.positiveHex,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.72,
        roughness: 0.25
      });
      const tubeMesh = new THREE.Mesh(new THREE.BufferGeometry(), tubeMat);
      tubeMesh.renderOrder = RENDER_ORDER.WINGS;

      // 雙向脈衝球（A→中點 與 B→中點）+ 中點融合閃耀核
      const pulseGeo = new THREE.SphereGeometry(0.065, 16, 16);
      const pulseMatA = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.78
      });
      const pulseMatB = new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.78
      });
      const midMat = new THREE.MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.95
      });

      const pulseA = new THREE.Mesh(pulseGeo, pulseMatA);
      const pulseB = new THREE.Mesh(pulseGeo.clone(), pulseMatB);
      const midNode = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 16), midMat);
      pulseA.renderOrder = RENDER_ORDER.LASER_CUT;
      pulseB.renderOrder = RENDER_ORDER.LASER_CUT;
      midNode.renderOrder = RENDER_ORDER.LASER_CUT;

      group.add(arcLine, tubeMesh, pulseA, pulseB, midNode);
      this.linksGroup.add(group);
      this._pairLinks.push({
        group,
        arcLine,
        tubeMesh,
        pulseA,
        pulseB,
        midNode,
        curve: null,
        tension: 0
      });
    }

    while (this._pairLinks.length > pairCount) {
      const item = this._pairLinks.pop();
      this.linksGroup.remove(item.group);
      this.disposeObject3D(item.group);
    }
  }

  update(state) {
    const metrics = computeAllMetrics(state.beads, null);
    const { beads, variance, mu } = metrics;

    // 未拖曳時才更新座標縮放，拖曳過程中保留鎖定比例避免數線漂移
    if (!this._dragState) {
      this._scaleInfo = this._computeScale(beads);
    }
    const { centerX, scaleX } = this._scaleInfo;
    const toWorldX = (x) => (x - centerX) * scaleX;

    // 1. 同步珠子球體
    this._syncBeadNodes(beads.length);
    for (let i = 0; i < beads.length; i += 1) {
      const b = beads[i];
      const { mesh, lbl } = this._beadNodes[i];
      const color = BEAD_PALETTE[i % BEAD_PALETTE.length];
      const radius = 0.14 + 0.24 * Math.sqrt(b.p);
      const wx = toWorldX(b.x);

      mesh.scale.set(radius, radius, radius);
      mesh.position.set(wx, radius + 0.03, 0);
      mesh.material.color.set(color);
      mesh.material.emissive.set(color);
      mesh.userData.beadId = b.id;
      mesh.userData.token = `bead:${b.id}`;

      this.labels.updateLabel(lbl, {
        text: `↔ x=${b.x} (${(b.p * 100).toFixed(0)}%)`,
        position: [0, -1.65, 1.3],
        visible: true
      });
    }

    // 2. 同步兩兩對立引力光束
    const pairs = [];
    for (let i = 0; i < beads.length; i += 1) {
      for (let j = i + 1; j < beads.length; j += 1) {
        const dx = beads[i].x - beads[j].x;
        const tension = beads[i].p * beads[j].p * dx * dx;
        pairs.push({ i, j, dx: Math.abs(dx), tension });
      }
    }

    this._syncPairLinks(pairs.length);
    const maxTension = Math.max(EPSILON, ...pairs.map((p) => p.tension));

    for (let k = 0; k < pairs.length; k += 1) {
      const p = pairs[k];
      const link = this._pairLinks[k];
      const token = `pair:${p.i}:${p.j}`;
      link.group.userData.token = token;
      link.tubeMesh.userData.token = token;
      link.tension = p.tension;

      const x1 = toWorldX(beads[p.i].x);
      const x2 = toWorldX(beads[p.j].x);
      const y1 = 0.14 + 0.24 * Math.sqrt(beads[p.i].p) + 0.03;
      const y2 = 0.14 + 0.24 * Math.sqrt(beads[p.j].p) + 0.03;

      if (Math.abs(x1 - x2) < EPSILON || p.tension < 1e-8) {
        link.group.visible = false;
        link.curve = null;
        continue;
      }

      link.group.visible = true;
      const midX = (x1 + x2) * 0.5;
      const spanWorld = Math.abs(x1 - x2);
      const apexY = Math.max(y1, y2) + 0.45 + spanWorld * 0.38;
      const zArc = ((p.j - p.i) % 2 === 0 ? -1 : 1) * 0.15 * (p.j - p.i - 1);

      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(x1, y1, 0),
        new THREE.Vector3(midX, apexY, zArc),
        new THREE.Vector3(x2, y2, 0)
      );
      link.curve = curve;

      const pts = curve.getPoints(32);
      link.arcLine.geometry.dispose();
      link.arcLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);

      const intensityRatio = Math.min(1, p.tension / maxTension);
      const tubeRadius = 0.015 + 0.048 * Math.sqrt(intensityRatio);
      link.tubeMesh.geometry.dispose();
      link.tubeMesh.geometry = new THREE.TubeGeometry(curve, 28, tubeRadius, 8, false);
      link.tubeMesh.material.opacity = 0.28 + 0.55 * intensityRatio;
      link.tubeMesh.material.emissiveIntensity = 0.25 + 0.65 * intensityRatio;
    }

    this._updateReadout(beads, pairs, variance, mu);
    this._updateFormulaLens(state, beads, pairs, variance);
    this.onHover(state.hoveredToken);

    const activeLinks = this._pairLinks.filter((l) => l.group.visible && l.curve);
    if (activeLinks.length > 0) {
      const topCurve = activeLinks[activeLinks.length - 1].curve;
      const apex = topCurve.getPoint(0.5);
      this.midpointNote.visible = true;
      this.labels.updateLabel(this.midpointNote, {
        text: `脈衝中點融合 = 去重 (× ½)｜非重心 μ=${mu.toFixed(1)}`,
        position: [apex.x, apex.y + 0.28, apex.z]
      });
    } else {
      this.midpointNote.visible = false;
    }
  }

  _tickPulses() {
    if (this._disposed) return;
    this._rafId = requestAnimationFrame(() => this._tickPulses());

    const now = performance.now();
    const dt = Math.min(0.05, (now - this._lastTime) / 1000);
    this._lastTime = now;
    this._pulsePhase = (this._pulsePhase + dt * 0.72) % 1;

    for (const link of this._pairLinks) {
      if (!link.group.visible || !link.curve) continue;
      // t 從 0 跑向 0.5（兩端射向中點融合）
      const tHalf = this._pulsePhase * 0.5;
      const posA = link.curve.getPoint(tHalf);
      const posB = link.curve.getPoint(1 - tHalf);
      const posMid = link.curve.getPoint(0.5);

      link.pulseA.position.copy(posA);
      link.pulseB.position.copy(posB);
      link.midNode.position.copy(posMid);

      // 兩道脈衝在中點交會時，中點光球爆亮強調 1/2 融合
      const meetGlow = Math.max(0, 1 - Math.abs(this._pulsePhase - 0.92) * 5);
      const s = 0.7 + meetGlow * 0.95;
      link.midNode.scale.set(s, s, s);
      link.midNode.material.opacity = 0.4 + meetGlow * 0.6;
    }
  }

  _updateReadout(beads, pairs, variance, mu) {
    const chip = this.controlsHost.querySelector('[data-role="mod4-tension-chip"]');
    const isZero = variance < EPSILON;
    chip.textContent = isZero ? '無對立面（張力歸零）' : `活躍引力線 ${pairs.filter((p) => p.tension >= 1e-8).length} 條`;

    const pairListEl = this.controlsHost.querySelector('[data-role="mod4-pair-list"]');
    if (pairs.length === 0 || isZero) {
      pairListEl.innerHTML = `<div class="empty-web-banner">全員同點無對立：任兩珠距離 (xᵢ − xⱼ) = 0，整張引力網張力完全歸零！</div>`;
    } else {
      pairListEl.innerHTML = pairs
        .map((p) => {
          const b1 = beads[p.i];
          const b2 = beads[p.j];
          const geomMid = ((b1.x + b2.x) * 0.5).toFixed(1);
          return `
            <div class="pair-chip" data-token="pair:${p.i}:${p.j}">
              <span>(${b1.x} ↔ ${b2.x}，連線中點 ${geomMid})</span>
              <code>P₁P₂Δx² = ${p.tension.toFixed(4)}</code>
            </div>
          `;
        })
        .join('') +
        `<div class="caution-banner">⚠ 防錯提醒：脈衝撞在連線「幾何中點」只代表配對不重複計算（乘以 ½），<strong>並不是加權重心 μ</strong>！（目前實際重心為 μ = ${mu.toFixed(2)}，權重不同時會偏向較重那端）</div>`;
    }

    const narrationEl = this.controlsHost.querySelector('[data-role="mod4-narration"]');
    if (isZero) {
      narrationEl.textContent =
        `沒有對立面就沒有偏差！當所有珠子聚在同一座標時，每條連線張力 (xᵢ − xⱼ)² 皆為 0，引力網瞬間熄滅。` +
        `試著在 3D 地板上左右拖曳任一顆珠子，立刻就能重新繃出張力光束！`;
    } else {
      narrationEl.textContent =
        `本視角完全隱藏平均數 μ：每個對立組合 (i, j) 皆由兩端各射出一道脈衝於連線中點融合，詮釋公式前方的「乘 ½（只算一次）」。` +
        `總張力加總即為變異數 σ² = ${variance.toFixed(4)}（可直接拖曳 3D 球體移動座標）。`;
    }
  }

  _updateFormulaLens(state, beads, pairs, variance) {
    if (!this.formulaLens) return;
    const mode = state.formulaMode;
    let parts = [];

    if (mode === 'symbolic') {
      parts = [
        { type: 'op', text: 'σ² = ' },
        {
          type: 'token',
          token: 'all_pairs',
          colorRole: 'positive',
          tex: '\\frac{1}{2}\\sum_i \\sum_j P(x_i)P(x_j)(x_i - x_j)^2',
          fallback: '½ ΣΣ P(xᵢ)P(xⱼ)(xᵢ-xⱼ)²'
        }
      ];
    } else if (mode === 'numeric') {
      if (pairs.length === 0) {
        parts = [
          { type: 'op', text: 'σ² = ' },
          { type: 'token', token: 'all_pairs', colorRole: 'positive', tex: '0', fallback: '0' }
        ];
      } else {
        parts = [
          { type: 'op', text: 'σ² = ' },
          ...pairs.flatMap((p, idx) => [
            ...(idx > 0 ? [{ type: 'op', text: ' + ' }] : []),
            {
              type: 'token',
              token: `pair:${p.i}:${p.j}`,
              tex: `(${beads[p.i].p.toFixed(2)})(${beads[p.j].p.toFixed(2)})(${beads[p.i].x}-${beads[p.j].x})^2`,
              fallback: `${p.tension.toFixed(3)}`
            }
          ]),
          { type: 'op', text: ' = ' },
          {
            type: 'token',
            token: 'all_pairs',
            colorRole: 'positive',
            tex: variance.toFixed(4),
            fallback: variance.toFixed(4)
          }
        ];
      }
    } else {
      parts = [
        { type: 'op', text: '雙向脈衝融合（乘 ½）→ ' },
        ...pairs.slice(0, 4).flatMap((p, idx) => [
          ...(idx > 0 ? [{ type: 'op', text: ' + ' }] : []),
          {
            type: 'token',
            token: `pair:${p.i}:${p.j}`,
            tex: `\\text{張力}_{${p.i + 1},${p.j + 1}}=${p.tension.toFixed(3)}`,
            fallback: `張力=${p.tension.toFixed(3)}`
          }
        ]),
        { type: 'op', text: ' = ' },
        {
          type: 'token',
          token: 'all_pairs',
          colorRole: 'positive',
          tex: `\\sigma^2=${variance.toFixed(4)}`,
          fallback: `σ²=${variance.toFixed(4)}`
        }
      ];
    }

    const key = `m4|${mode}|${beads.map((b) => `${b.x}:${b.p.toFixed(3)}`).join(',')}`;
    this.formulaLens.update({ mode, parts, key }, state.hoveredToken);
  }

  onHover(token) {
    for (let i = 0; i < this._beadNodes.length; i += 1) {
      const node = this._beadNodes[i];
      const hitBead = token && node.mesh.userData.token === token;
      node.mesh.material.emissiveIntensity = hitBead ? 0.85 : 0.35;
    }

    for (const link of this._pairLinks) {
      const hitPair = token && (link.group.userData.token === token || token === 'all_pairs');
      link.tubeMesh.material.color.setHex(hitPair ? 0x38bdf8 : COLORS.positiveHex);
      link.tubeMesh.material.emissive.setHex(hitPair ? 0x38bdf8 : COLORS.positiveHex);
      if (hitPair) {
        link.tubeMesh.material.emissiveIntensity = 0.95;
      }
    }
  }

  dispose() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._abortController.abort();
    this.stage.controls.enabled = true;
    this.labels.clearAll();
    this._beadNodes = [];
    this._pairLinks = [];
    super.dispose();
  }
}
