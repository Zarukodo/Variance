/**
 * 新手互動教學引導教練 V3.0（GuidedTour.js）
 * - 單排極簡 7 章節膠囊（零換行、零捲軸）
 * - 支援每步驟專屬面板焦點減法（panelPolicy）與唯一聚光燈高亮（無雙胞胎按鈕）
 */

import { TOUR_CHAPTERS, TOUR_STEPS } from '../core/tourCurriculum.js';

export class GuidedTour {
  constructor({ host, toggleButton, store, getActiveModule, onApplyPanelPolicy, onExitToSandbox }) {
    this.host = host;
    this.toggleButton = toggleButton;
    this.store = store;
    this.getActiveModule = getActiveModule;
    this.onApplyPanelPolicy = onApplyPanelPolicy;
    this.onExitToSandbox = onExitToSandbox;
    this._isOpen = true;
    this._stepIndex = 0;
    this._quizAnswered = null;
    this._spotlightEl = null;
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
          <button type="button" class="tour-close-btn" data-role="tour-close" title="關閉引導並切換為自由實驗模式">
            ✕ 自由實驗
          </button>
        </div>

        <div class="tour-body">
          <div class="tour-meta-row">
            <span class="tour-step-counter" data-role="tour-counter">第 1 / 15 步</span>
            <div class="tour-progress-track">
              <div class="tour-progress-fill" data-role="tour-progress"></div>
            </div>
          </div>

          <h3 class="tour-title" data-role="tour-title"></h3>
          <p class="tour-mental" data-role="tour-mental"></p>
          <p class="tour-text" data-role="tour-text"></p>

          <div class="tour-quiz-box" data-role="tour-quiz-box" style="display:none;"></div>
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

        const quizBtn = event.target.closest('[data-tour-quiz-opt]');
        if (quizBtn) {
          this._handleQuizPick(quizBtn.dataset.tourQuizOpt);
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

  _handleQuizPick(optionId) {
    const step = TOUR_STEPS[this._stepIndex];
    if (!step?.quiz) return;
    this._quizAnswered = optionId;
    if (typeof step.quiz.onPick === 'function') {
      step.quiz.onPick(optionId, {
        store: this.store,
        applyPanelPolicy: (policy) => {
          if (this.onApplyPanelPolicy) this.onApplyPanelPolicy(policy);
        }
      });
    }
    this._renderQuiz(step);
  }

  _clearSpotlight() {
    if (this._spotlightEl) {
      this._spotlightEl.classList.remove('tour-spotlight');
      this._spotlightEl = null;
    }
  }

  _applySpotlight(selector) {
    this._clearSpotlight();
    if (!selector || !this._isOpen) return;
    setTimeout(() => {
      if (!this._isOpen) return;
      const el = document.querySelector(selector);
      if (el) {
        el.classList.add('tour-spotlight');
        this._spotlightEl = el;
      }
    }, 80);
  }

  setOpen(open) {
    this._isOpen = Boolean(open);
    this.host.style.display = this._isOpen ? 'block' : 'none';
    this.store.setState({ uiMode: this._isOpen ? 'guided' : 'sandbox' });
    if (this.toggleButton) {
      this.toggleButton.classList.toggle('is-active', this._isOpen);
      this.toggleButton.textContent = this._isOpen ? '🎓 教學引導中' : '🎓 開啟教學引導';
    }
    if (this._isOpen) {
      this.goToStep(this._stepIndex);
    } else {
      this._clearSpotlight();
      if (this.onApplyPanelPolicy) this.onApplyPanelPolicy(null);
      if (this.onExitToSandbox) this.onExitToSandbox();
    }
  }

  start() {
    this.setOpen(true);
  }

  getCurrentPolicy() {
    if (!this._isOpen) return null;
    return TOUR_STEPS[this._stepIndex]?.panelPolicy || null;
  }

  goToStep(index) {
    const clamped = Math.min(TOUR_STEPS.length - 1, Math.max(0, index));
    this._stepIndex = clamped;
    this._quizAnswered = null;
    const step = TOUR_STEPS[clamped];

    if (typeof step.enter === 'function') {
      step.enter({ store: this.store, getActiveModule: this.getActiveModule });
    }
    if (this.onApplyPanelPolicy) {
      this.onApplyPanelPolicy(step.panelPolicy || null);
    }
    this._renderStepUI(step, this.store.getState());
    this._applySpotlight(step.spotlightSelector || null);
  }

  syncState(state) {
    if (!this._isOpen) return;
    const step = TOUR_STEPS[this._stepIndex];
    this._updateActionButton(step, state);
  }

  _renderQuiz(step) {
    const box = this.host.querySelector('[data-role="tour-quiz-box"]');
    if (!step.quiz) {
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }

    box.style.display = 'block';
    const picked = step.quiz.options.find((o) => o.id === this._quizAnswered);
    const feedback = picked
      ? `<p class="tour-quiz-feedback ${picked.correct ? 'is-ok' : 'is-hint'}">${
          picked.correct ? step.quiz.feedbackCorrect : step.quiz.feedbackWrong
        }</p>`
      : '';

    box.innerHTML = `
      <div class="tour-quiz-q">${step.quiz.question}</div>
      <div class="tour-quiz-opts">
        ${step.quiz.options
          .map(
            (opt) => `
              <button
                type="button"
                class="chip-btn ${this._quizAnswered === opt.id ? 'is-active' : ''}"
                data-tour-quiz-opt="${opt.id}"
              >${opt.label}</button>
            `
          )
          .join('')}
      </div>
      ${feedback}
    `;
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

    this._renderQuiz(step);
    this._updateActionButton(step, state);
  }

  _updateActionButton(step, state) {
    const demoBtn = this.host.querySelector('[data-role="tour-demo"]');
    if (!step.action) {
      demoBtn.style.display = 'none';
      return;
    }

    demoBtn.style.display = 'inline-flex';
    const active = step.action.isActive ? step.action.isActive(state) : false;
    demoBtn.textContent = active && step.action.altLabel ? step.action.altLabel : step.action.label;
    demoBtn.classList.toggle('is-active', active);
  }

  dispose() {
    this._clearSpotlight();
    this._abortController.abort();
    this.host.innerHTML = '';
  }
}
