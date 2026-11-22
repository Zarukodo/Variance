/**
 * 第 6 站：🎯 盲測挑戰關（先手算預測，再開 3D 對答案）
 * 源自初學者實測筆記第 9 站最有效的自學法：
 * - 挑戰 A（多珠系統）：預測 μ、σ²、σ 與支點偏移 I(a)
 * - 挑戰 B（二項試驗）：預測路徑數 C(n,x)、P(X=x)、P(X≥1)、σ²、σ
 * - 揭曉前遮蔽答案與 3D 方柱；揭曉後逐項批改並當場長出 3D 模型驗證
 */

import * as THREE from 'three';
import { BaseModule } from './BaseModule.js';
import { createGlassBlock, updateGlassBlock } from '../engine/GeometryFactory.js';
import { LabelManager } from '../engine/LabelManager.js';
import { LeverRig } from '../engine/LeverRig.js';
import { BEAD_PALETTE } from '../core/presets.js';
import { COLORS, EPSILON, RENDER_ORDER } from '../core/constants.js';
import { computeAllMetrics, computeBinomialMetrics } from '../core/mathEngine.js';

const QUIZ_A_BANK = [
  {
    title: '筆記經典題：{0, 3, 9}（份數 50 : 25 : 25）',
    beads: [
      { id: 'q0', x: 0, p: 0.5, rawWeight: 50 },
      { id: 'q1', x: 3, p: 0.25, rawWeight: 25 },
      { id: 'q2', x: 9, p: 0.25, rawWeight: 25 }
    ],
    testPivot: 5
  },
  {
    title: '小樣本對稱練習：{1, 3, 5}（份數 25 : 50 : 25）',
    beads: [
      { id: 'q0', x: 1, p: 0.25, rawWeight: 25 },
      { id: 'q1', x: 3, p: 0.5, rawWeight: 50 },
      { id: 'q2', x: 5, p: 0.25, rawWeight: 25 }
    ],
    testPivot: 4
  },
  {
    title: '雙極風險挑戰：{0, 8}（份數 50 : 50）',
    beads: [
      { id: 'q0', x: 0, p: 0.5, rawWeight: 50 },
      { id: 'q1', x: 8, p: 0.5, rawWeight: 50 }
    ],
    testPivot: 6
  }
];

const QUIZ_B_BANK = [
  { title: '筆記經典題：n = 5 次、π = 0.20、x = 2 次成功', n: 5, x: 2, pi: 0.2 },
  { title: '罰球挑戰：n = 4 次、π = 0.70、x = 2 次成功', n: 4, x: 2, pi: 0.7 },
  { title: '硬幣挑戰：n = 4 次、π = 0.50、x = 2 次成功', n: 4, x: 2, pi: 0.5 }
];

export class Mod6QuizChallenge extends BaseModule {
  constructor(context) {
    super(context);
    this.labels = new LabelManager();
    this._abortController = new AbortController();
    this._mode = 'A'; // 'A' = 多珠盲測 | 'B' = 二項盲測
    this._bankIndexA = 0;
    this._bankIndexB = 0;
    this._revealed = false;
    this._blocks = [];
    this._axisLabels = [];
  }

  init() {
    super.init();
    this.stage.setCameraHome([5.4, 4.4, 8.6], [0, 0.7, 0]);

    this.blocksGroup = new THREE.Group();
    this.root.add(this.blocksGroup);

    this.lever = new LeverRig({ yOffset: -0.36, minX: -3.0, maxX: 3.0 });
    this.root.add(this.lever.group);

    this.muLabel = this.labels.addLabel(this.root, {
      text: 'μ = ?',
      position: [0, -0.62, 0],
      className: 'scene-label is-mu',
      persistent: true
    });

    // 二項挑戰專屬長條
    const barGeo = new THREE.BoxGeometry(1, 0.08, 0.14);
    this.varBar = new THREE.Mesh(
      barGeo,
      new THREE.MeshStandardMaterial({ color: COLORS.positiveHex, emissive: COLORS.positiveHex, emissiveIntensity: 0.4 })
    );
    this.sdBar = new THREE.Mesh(
      barGeo.clone(),
      new THREE.MeshStandardMaterial({ color: COLORS.negativeHex, emissive: COLORS.negativeHex, emissiveIntensity: 0.5 })
    );
    this.varBar.visible = false;
    this.sdBar.visible = false;
    this.root.add(this.varBar, this.sdBar);

    this._renderUI();
    this._bindEvents();
    this._syncSceneAndPrompt();
  }

  _getCurrentQuizA() {
    return QUIZ_A_BANK[this._bankIndexA % QUIZ_A_BANK.length];
  }

  _getCurrentQuizB() {
    return QUIZ_B_BANK[this._bankIndexB % QUIZ_B_BANK.length];
  }

  _renderUI() {
    this.controlsHost.innerHTML = `
      <section class="glass-card mod-control-card quiz-card">
        <div class="card-header is-compact">
          <div>
            <h2 class="card-title">🎯 畢業盲測：先手算，再對答案</h2>
          </div>
          <span class="tag-chip" data-role="quiz-status-chip">作答中（答案已遮蔽）</span>
        </div>

        <div class="lens-tabs" role="tablist" aria-label="盲測題型切換">
          <button type="button" class="lens-tab is-active" data-quiz-mode="A">題型 A：多珠系統</button>
          <button type="button" class="lens-tab" data-quiz-mode="B">題型 B：二項試驗</button>
        </div>

        <div class="quiz-prompt-box">
          <div class="quiz-prompt-head">
            <strong data-role="quiz-title"></strong>
            <button type="button" class="ghost-btn is-xs" data-role="btn-next-quiz">🎲 換一題</button>
          </div>
          <p class="quiz-desc" data-role="quiz-desc"></p>
        </div>

        <form class="quiz-form" data-role="quiz-form"></form>

        <div class="action-row quiz-actions">
          <button type="button" class="primary-btn" data-role="btn-reveal-quiz">
            ✨ 揭曉答案並在 3D 舞台驗證
          </button>
          <button type="button" class="ghost-btn" data-role="btn-reset-quiz" style="display:none;">
            ↺ 遮住重測一次
          </button>
        </div>

        <div class="quiz-result-box" data-role="quiz-result" style="display:none;"></div>
      </section>
    `;
  }

  _bindEvents() {
    const { signal } = this._abortController;

    this.controlsHost.addEventListener(
      'click',
      (event) => {
        const tab = event.target.closest('[data-quiz-mode]');
        if (tab) {
          this._mode = tab.dataset.quizMode;
          this._revealed = false;
          this._syncSceneAndPrompt();
          return;
        }

        if (event.target.closest('[data-role="btn-next-quiz"]')) {
          if (this._mode === 'A') {
            this._bankIndexA = (this._bankIndexA + 1) % QUIZ_A_BANK.length;
          } else {
            this._bankIndexB = (this._bankIndexB + 1) % QUIZ_B_BANK.length;
          }
          this._revealed = false;
          this._syncSceneAndPrompt();
          return;
        }

        if (event.target.closest('[data-role="btn-reveal-quiz"]')) {
          this._revealed = true;
          this._gradeAndReveal();
          return;
        }

        if (event.target.closest('[data-role="btn-reset-quiz"]')) {
          this._revealed = false;
          this._syncSceneAndPrompt();
        }
      },
      { signal }
    );
  }

  _syncSceneAndPrompt() {
    for (const btn of this.controlsHost.querySelectorAll('[data-quiz-mode]')) {
      btn.classList.toggle('is-active', btn.dataset.quizMode === this._mode);
    }

    const chip = this.controlsHost.querySelector('[data-role="quiz-status-chip"]');
    chip.textContent = this._revealed ? '已揭曉並 3D 驗證' : '作答中（答案已遮蔽）';

    const revealBtn = this.controlsHost.querySelector('[data-role="btn-reveal-quiz"]');
    const resetBtn = this.controlsHost.querySelector('[data-role="btn-reset-quiz"]');
    const resultBox = this.controlsHost.querySelector('[data-role="quiz-result"]');
    revealBtn.style.display = this._revealed ? 'none' : 'block';
    resetBtn.style.display = this._revealed ? 'block' : 'none';
    if (!this._revealed) {
      resultBox.style.display = 'none';
      resultBox.innerHTML = '';
    }

    const titleEl = this.controlsHost.querySelector('[data-role="quiz-title"]');
    const descEl = this.controlsHost.querySelector('[data-role="quiz-desc"]');
    const formEl = this.controlsHost.querySelector('[data-role="quiz-form"]');

    if (this._mode === 'A') {
      const q = this._getCurrentQuizA();
      titleEl.textContent = q.title;
      const summary = q.beads.map((b) => `x=${b.x} (${(b.p * 100).toFixed(0)}%)`).join('、');
      descEl.textContent = `珠子設定：${summary}。請先自己手算再填入預測值（誤差 ±0.02 內皆算對）：`;
      formEl.innerHTML = `
        <label class="quiz-field">
          <span>1. 重心（期望值 μ）</span>
          <input type="number" step="any" placeholder="輸入預測數字" data-ans="mu" />
        </label>
        <label class="quiz-field">
          <span>2. 變異數 σ²（方柱總體積）</span>
          <input type="number" step="any" placeholder="輸入預測數字" data-ans="var" />
        </label>
        <label class="quiz-field">
          <span>3. 標準差 σ（一維尺規長度）</span>
          <input type="number" step="any" placeholder="輸入預測數字" data-ans="sd" />
        </label>
        <label class="quiz-field">
          <span>4. 支點推到 a = ${q.testPivot} 時總體積 I(${q.testPivot})</span>
          <input type="number" step="any" placeholder="輸入預測數字" data-ans="inertia" />
        </label>
      `;
    } else {
      const q = this._getCurrentQuizB();
      titleEl.textContent = q.title;
      descEl.textContent = `獨立重複 n = ${q.n} 次、每次成功機率 π = ${q.pi.toFixed(2)}、目標成功 x = ${q.x} 次：`;
      formEl.innerHTML = `
        <label class="quiz-field">
          <span>1. 無序路徑數 C(${q.n}, ${q.x})</span>
          <input type="number" step="1" placeholder="輸入整數" data-ans="ways" />
        </label>
        <label class="quiz-field">
          <span>2. 剛好成功 ${q.x} 次機率 P(X = ${q.x})</span>
          <input type="number" step="any" placeholder="輸入小數 (0~1)" data-ans="probX" />
        </label>
        <label class="quiz-field">
          <span>3. 至少成功 1 次機率 P(X ≥ 1)</span>
          <input type="number" step="any" placeholder="輸入小數 (0~1)" data-ans="probOne" />
        </label>
        <label class="quiz-field">
          <span>4. n 次總變異數 σ² = nπ(1−π)</span>
          <input type="number" step="any" placeholder="輸入預測數字" data-ans="varN" />
        </label>
        <label class="quiz-field">
          <span>5. n 次標準差 σ = √(nπ(1−π))</span>
          <input type="number" step="any" placeholder="輸入預測數字" data-ans="sdN" />
        </label>
      `;
    }

    this._render3DPreview();
  }

  _syncBlockPool(count) {
    while (this._blocks.length < count) {
      const idx = this._blocks.length;
      const block = createGlassBlock({
        color: BEAD_PALETTE[idx % BEAD_PALETTE.length],
        opacity: 0.46,
        renderOrder: RENDER_ORDER.PURE_VARIANCE
      });
      this.blocksGroup.add(block);
      this._blocks.push(block);
    }
    while (this._blocks.length > count) {
      const removed = this._blocks.pop();
      this.blocksGroup.remove(removed);
      this.disposeObject3D(removed);
    }

    while (this._axisLabels.length < count) {
      const lbl = this.labels.addLabel(this.root, {
        text: '',
        position: [0, 0, 0],
        className: 'scene-label is-axis',
        persistent: true
      });
      this._axisLabels.push(lbl);
    }
    while (this._axisLabels.length > count) {
      const lbl = this._axisLabels.pop();
      if (lbl.parent) lbl.parent.remove(lbl);
      if (lbl.element?.parentNode) lbl.element.parentNode.removeChild(lbl.element);
    }
  }

  _render3DPreview() {
    if (this._mode === 'A') {
      const q = this._getCurrentQuizA();
      const metrics = computeAllMetrics(q.beads, null);
      const { beads, mu } = metrics;

      let minX = beads[0].x;
      let maxX = beads[0].x;
      for (const b of beads) {
        if (b.x < minX) minX = b.x;
        if (b.x > maxX) maxX = b.x;
      }
      const span = maxX - minX;
      const centerX = (minX + maxX) * 0.5;
      const scaleX = span > 0 ? Math.min(1.0, 4.4 / span) : 1.0;
      const scaleY = 1.6;
      const toWorldX = (x) => (x - centerX) * scaleX;

      this._syncBlockPool(beads.length);
      this.lever.group.visible = true;
      this.varBar.visible = false;
      this.sdBar.visible = false;

      for (let i = 0; i < beads.length; i += 1) {
        const b = beads[i];
        const block = this._blocks[i];
        const color = BEAD_PALETTE[i % BEAD_PALETTE.length];
        const side = Math.abs(b.x - mu) * scaleX;
        const h = b.p * scaleY;

        if (this._revealed) {
          updateGlassBlock(block, { width: side, height: h, depth: side, color });
          block.position.set(toWorldX(b.x), h * 0.5, 0);
        } else {
          block.visible = false;
        }

        this.labels.updateLabel(this._axisLabels[i], {
          text: `x=${b.x} (${(b.p * 100).toFixed(0)}%)`,
          position: [toWorldX(b.x), -0.02, 0.75],
          visible: true
        });
      }

      this.lever.update({
        beads: beads.map((b, i) => ({
          x: toWorldX(b.x),
          p: b.p,
          color: BEAD_PALETTE[i % BEAD_PALETTE.length]
        })),
        mu: toWorldX(mu),
        pivot: toWorldX(mu),
        minX: toWorldX(minX) - 0.8,
        maxX: toWorldX(maxX) + 0.8
      });

      this.labels.updateLabel(this.muLabel, {
        text: this._revealed ? `重心 μ = ${mu.toFixed(2)}` : '重心 μ = ?（請先預測）',
        position: [toWorldX(mu), -0.64, 0],
        visible: true
      });
    } else {
      const q = this._getCurrentQuizB();
      const bin = computeBinomialMetrics(q.n, q.x, q.pi);

      this.lever.group.visible = false;
      this.muLabel.visible = false;
      this._syncBlockPool(q.n);

      const gap = 0.24;
      const cellW = Math.max(0.35, q.pi);
      const stepX = cellW + gap;
      const totalW = (q.n - 1) * stepX;

      for (let i = 0; i < q.n; i += 1) {
        const block = this._blocks[i];
        if (this._revealed) {
          updateGlassBlock(block, {
            width: q.pi,
            height: 1.0,
            depth: 1 - q.pi,
            color: COLORS.positiveHex
          });
          block.position.set(-totalW * 0.5 + i * stepX, 0.5, 0);
        } else {
          block.visible = false;
        }

        this.labels.updateLabel(this._axisLabels[i], {
          text: `第 ${i + 1} 次`,
          position: [-totalW * 0.5 + i * stepX, 0.02, 0.72],
          visible: true
        });
      }

      if (this._revealed) {
        this.varBar.visible = bin.variance >= EPSILON;
        this.varBar.scale.set(bin.variance * 1.8, 1, 1);
        this.varBar.position.set(0, 0.05, 1.15);

        this.sdBar.visible = bin.sd >= EPSILON;
        this.sdBar.scale.set(bin.sd * 1.8, 1, 1);
        this.sdBar.position.set(0, 0.05, 1.85);
      } else {
        this.varBar.visible = false;
        this.sdBar.visible = false;
      }
    }
  }

  _gradeAndReveal() {
    const form = this.controlsHost.querySelector('[data-role="quiz-form"]');
    const check = (key, exact, hint) => {
      const input = form.querySelector(`[data-ans="${key}"]`);
      const raw = input?.value?.trim() ?? '';
      if (raw === '') {
        return { status: 'empty', text: `未作答 → 正確答案：${exact.toFixed(4)}（${hint}）` };
      }
      const val = Number(raw);
      const ok = Number.isFinite(val) && Math.abs(val - exact) <= 0.025;
      return {
        status: ok ? 'pass' : 'miss',
        text: ok
          ? `✓ 答對！（你的預測 ${val}，精準值 ${exact.toFixed(4)}）`
          : `✗ 你的預測 ${val} → 正確答案：${exact.toFixed(4)}（${hint}）`
      };
    };

    let rows;
    if (this._mode === 'A') {
      const q = this._getCurrentQuizA();
      const m = computeAllMetrics(q.beads, q.testPivot);
      rows = [
        { label: '1. 重心 μ', ...check('mu', m.mu, q.beads.map((b) => `${b.x}×${b.p}`).join(' + ')) },
        { label: '2. 變異數 σ²', ...check('var', m.variance, `定義版 Σ(x−μ)²P(x)`) },
        { label: '3. 標準差 σ', ...check('sd', m.sd, `√${m.variance.toFixed(4)}`) },
        { label: `4. 偏離支點 I(${q.testPivot})`, ...check('inertia', m.inertiaAtPivot, `σ² + (μ−${q.testPivot})² = ${m.variance.toFixed(2)} + ${((m.mu - q.testPivot) ** 2).toFixed(2)}`) }
      ];
    } else {
      const q = this._getCurrentQuizB();
      const b = computeBinomialMetrics(q.n, q.x, q.pi);
      rows = [
        { label: `1. 路徑數 C(${q.n},${q.x})`, ...check('ways', b.ways, `除以 ${q.x}!`) },
        { label: `2. P(X = ${q.x})`, ...check('probX', b.probX, `${b.ways} × ${b.singlePathProb.toFixed(5)}`) },
        { label: '3. P(X ≥ 1)', ...check('probOne', b.probAtLeastOne, `1 − (1−${q.pi.toFixed(2)})^${q.n} = 1 − ${b.probZero.toFixed(4)}`) },
        { label: '4. 總變異數 σ²', ...check('varN', b.variance, `${q.n} × ${q.pi} × ${(1 - q.pi).toFixed(2)}`) },
        { label: '5. 標準差 σ', ...check('sdN', b.sd, `√${b.variance.toFixed(4)}`) }
      ];
    }

    const resultBox = this.controlsHost.querySelector('[data-role="quiz-result"]');
    resultBox.style.display = 'flex';
    resultBox.innerHTML = rows
      .map(
        (r) => `
          <div class="quiz-grade-row is-${r.status}">
            <strong>${r.label}</strong>
            <span>${r.text}</span>
          </div>
        `
      )
      .join('');

    this.controlsHost.querySelector('[data-role="quiz-status-chip"]').textContent = '已揭曉並 3D 驗證';
    this.controlsHost.querySelector('[data-role="btn-reveal-quiz"]').style.display = 'none';
    this.controlsHost.querySelector('[data-role="btn-reset-quiz"]').style.display = 'block';

    this._render3DPreview();
  }

  update(_state) {
    // 挑戰關卡以獨立題庫狀態運作，不主動覆寫作答畫面
  }

  dispose() {
    this._abortController.abort();
    this.labels.clearAll();
    this._blocks = [];
    this._axisLabels = [];
    super.dispose();
  }
}
