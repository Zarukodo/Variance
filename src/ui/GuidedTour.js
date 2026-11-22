/**
 * 新手互動教學引導教練（GuidedTour.js）
 * - 以 12 步故事流串聯 5 大模組，主動同步 3D 場景、鏡頭、動畫與對比實驗
 * - 支援章節快跳、上一步／下一步、一鍵示範對比、與自由探索模式切換
 */

import { TOUR_CHAPTERS, TOUR_STEPS } from '../core/tourCurriculum.js';

export class GuidedTour {
  /**
   * @param {{
   *   host: HTMLElement,
   *   toggleButton: HTMLElement,
   *   store: import('../core/store.js').store,
   *   getActiveModule: () => any
   * }} opts
   */
  constructor({ host, toggleButton, store, getActiveModule }) {
    this.host = host;
    this.toggleButton = toggleButton;
    this.store = store;
    this.getActiveModule = getActiveModule;
    this._isOpen = true;
    this._stepIndex = 0;
    this._abortController = new AbortController();

    this._renderScaffold();
    this._bindEvents();
  }

  _renderScaffold() {
    this.host.innerHTML = `
      <aside class="tour-dock" aria-label="新手空間直覺教學引導">
        <div class="tour-top-row">
          <div class="tour-chapters" data-role="tour-chapters">
            ${TOUR_CHAPTERS.map(
              (ch) =>
                `<button type="button" class="tour-ch-pill" data-tour-start="${ch.startStep}">${ch.label}</button>`
            ).join('')}
          </div>
          <button type="button" class="tour-close-btn" data-role="tour-close" title="關閉引導並自由操作">
            ✕ 自由探索
          </button>
        </div>

        <div class="tour-body">
          <div class="tour-meta-row">
            <span class="tour-step-counter" data-role="tour-counter">第 1 / 12 步</span>
            <div class="tour-progress-track">
              <div class="tour-progress-fill" data-role="tour-progress"></div>
            </div>
          </div>

          <h3 class="tour-title" data-role="tour-title"></h3>
          <p class="tour-mental" data-role="tour-mental"></p>
          <p class="tour-text" data-role="tour-text"></p>
        </div>

        <div class="tour-footer">
          <button type="button" class="ghost-btn" data-role="tour-prev">◀ 上一步</button>
          <div class="tour-footer-center">
            <button type="button" class="tour-demo-btn" data-role="tour-demo" style="display:none;"></button>
          </div>
          <button type="button" class="primary-btn is-compact" data-role="tour-next">下一步 ▶</button>
        </div>
      </aside>
    `;
  }

  _bindEvents() {
    const { signal } = this._abortController;

    if (this.toggleButton) {
      this.toggleButton.addEventListener(
        'click',
        () => {
          this.setOpen(!this._isOpen);
        },
        { signal }
      );
    }

    this.host.addEventListener(
      'click',
      (event) => {
        if (event.target.closest('[data-role="tour-close"]')) {
          this.setOpen(false);
          return;
        }

        const chBtn = event.target.closest('[data-tour-start]');
        if (chBtn) {
          this.goToStep(Number(chBtn.dataset.tourStart));
          return;
        }

        if (event.target.closest('[data-role="tour-prev"]')) {
          this.goToStep(Math.max(0, this._stepIndex - 1));
          return;
        }

        if (event.target.closest('[data-role="tour-next"]')) {
          if (this._stepIndex >= TOUR_STEPS.length - 1) {
            this.setOpen(false);
          } else {
            this.goToStep(this._stepIndex + 1);
          }
          return;
        }

        if (event.target.closest('[data-role="tour-demo"]')) {
          const step = TOUR_STEPS[this._stepIndex];
          if (step?.action?.run) {
            step.action.run({ store: this.store, getActiveModule: this.getActiveModule });
            this.syncState(this.store.getState());
          }
        }
      },
      { signal }
    );
  }

  setOpen(open) {
    this._isOpen = Boolean(open);
    this.host.style.display = this._isOpen ? 'block' : 'none';
    if (this.toggleButton) {
      this.toggleButton.classList.toggle('is-active', this._isOpen);
      this.toggleButton.textContent = this._isOpen ? '🎓 引導中（點此收合）' : '🎓 新手教學引導';
    }
    if (this._isOpen) {
      this.goToStep(this._stepIndex);
    }
  }

  start() {
    this.setOpen(true);
  }

  goToStep(index) {
    const clamped = Math.min(TOUR_STEPS.length - 1, Math.max(0, index));
    this._stepIndex = clamped;
    const step = TOUR_STEPS[clamped];

    if (typeof step.enter === 'function') {
      step.enter({ store: this.store, getActiveModule: this.getActiveModule });
    }
    this._renderStepUI(step, this.store.getState());
  }

  syncState(state) {
    if (!this._isOpen) return;
    const step = TOUR_STEPS[this._stepIndex];
    this._updateActionButton(step, state);
  }

  _renderStepUI(step, state) {
    const total = TOUR_STEPS.length;
    const pct = ((this._stepIndex + 1) / total) * 100;

    this.host.querySelector('[data-role="tour-counter"]').textContent = `第 ${this._stepIndex + 1} / ${total} 步`;
    this.host.querySelector('[data-role="tour-progress"]').style.width = `${pct}%`;
    this.host.querySelector('[data-role="tour-title"]').textContent = step.title;
    this.host.querySelector('[data-role="tour-mental"]').textContent = `🧠 腦中畫面：${step.mentalImage}`;
    this.host.querySelector('[data-role="tour-text"]').textContent = step.body;

    for (const pill of this.host.querySelectorAll('.tour-ch-pill')) {
      pill.classList.toggle('is-active', pill.textContent === step.chapter);
    }

    const prevBtn = this.host.querySelector('[data-role="tour-prev"]');
    const nextBtn = this.host.querySelector('[data-role="tour-next"]');
    prevBtn.disabled = this._stepIndex === 0;
    nextBtn.textContent = this._stepIndex === total - 1 ? '完成並自由探索 ✓' : '下一步 ▶';

    this._updateActionButton(step, state);
  }

  _updateActionButton(step, state) {
    const demoBtn = this.host.querySelector('[data-role="tour-demo"]');
    if (!step.action) {
      demoBtn.style.display = 'none';
      return;
    }

    demoBtn.style.display = 'inline-flex';
    const active = step.action.isActive
      ? step.action.isActive(
          step.id === 'step-11-comb-tear' ? { getActiveModule: this.getActiveModule } : state
        )
      : false;
    demoBtn.textContent = active && step.action.altLabel ? step.action.altLabel : step.action.label;
    demoBtn.classList.toggle('is-active', active);
  }

  dispose() {
    this._abortController.abort();
    this.host.innerHTML = '';
  }
}
