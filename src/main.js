/**
 * 應用啟動器 V3.0：支援教學引導模式（單一聚光燈減法）與自由實驗模式（先玩實驗，抽屜收合）
 */

import { MODULE_LIST } from './core/constants.js';
import { DATASET_PRESETS } from './core/presets.js';
import { store } from './core/store.js';
import { Stage3D } from './engine/Stage3D.js';
import { FormulaLens } from './ui/FormulaLens.js';
import { ControlPanel } from './ui/ControlPanel.js';
import { Dashboard } from './ui/Dashboard.js';
import { GuidedTour } from './ui/GuidedTour.js';
import { Mod1Bernoulli } from './modules/Mod1Bernoulli.js';
import { Mod2VarianceSD } from './modules/Mod2VarianceSD.js';
import { Mod3OriginCut } from './modules/Mod3OriginCut.js';
import { Mod4GravityWeb } from './modules/Mod4GravityWeb.js';
import { Mod5BinomialN } from './modules/Mod5BinomialN.js';
import { Mod6QuizChallenge } from './modules/Mod6QuizChallenge.js';

function getPresetCopy(id) {
  const found = DATASET_PRESETS.find((p) => p.id === id);
  return found ? found.beads.map((b) => ({ ...b })) : [{ id: 'b0', x: 2, p: 0.2, rawWeight: 20 }];
}

function getCleanModulePatch(moduleId) {
  switch (moduleId) {
    case 'mod1':
      return { bernoulliPi: 0.3, pivotOverride: null, cameraMode: 'perspective' };
    case 'mod2':
      return { beads: getPresetCopy('small_int'), pivotOverride: null };
    case 'mod3':
      return { beads: getPresetCopy('small_int'), pivotOverride: null, timelineStep: 0 };
    case 'mod4':
      return { beads: getPresetCopy('class_polar'), pivotOverride: null };
    case 'mod5':
      return { mod5Focus: 'comb', binomialN: 4, binomialX: 2, bernoulliPi: 0.7, showAtLeastOne: false };
    default:
      return {};
  }
}

function createModuleInstance(moduleId, context) {
  switch (moduleId) {
    case 'mod1':
      return new Mod1Bernoulli(context);
    case 'mod2':
      return new Mod2VarianceSD(context);
    case 'mod3':
      return new Mod3OriginCut(context);
    case 'mod4':
      return new Mod4GravityWeb(context);
    case 'mod5':
      return new Mod5BinomialN(context);
    case 'mod6':
      return new Mod6QuizChallenge(context);
    default:
      return null;
  }
}

function bootstrap() {
  const stagePane = document.getElementById('stage-pane');
  const upperHost = document.getElementById('mod5-upper-stage');
  const stageContainer = document.getElementById('stage-canvas-host');
  const stageHudBottom = document.getElementById('stage-hud-bottom');
  const stageBottomHint = document.getElementById('stage-bottom-hint');
  const tourHost = document.getElementById('guided-tour-host');
  const btnTourToggle = document.getElementById('btn-tour-toggle');
  const guidedSideHost = document.getElementById('guided-side-host');
  const formulaLensHost = document.getElementById('formula-lens-host');
  const sharedPanelHost = document.getElementById('shared-panel-host');
  const controlsHost = document.getElementById('module-controls-host');
  const dashboardHost = document.getElementById('dashboard-host');
  const navContainer = document.getElementById('module-nav');
  const btnCameraMode = document.getElementById('btn-camera-mode');
  const btnResetCamera = document.getElementById('btn-reset-camera');
  const stageBadge = document.getElementById('stage-phase-badge');

  const stage = new Stage3D(stageContainer, {
    onCameraModeSync: (syncedMode) => store.setCameraMode(syncedMode),
    onHoverToken: (token) => store.setHoveredToken(token)
  });

  const formulaLens = new FormulaLens(formulaLensHost, store);
  const dashboard = new Dashboard(dashboardHost, store);

  let activeModuleId = null;
  let activeInstance = null;
  let sharedControlPanel = null;
  let currentPolicy = null;

  navContainer.innerHTML = MODULE_LIST.map(
    (mod) => `
      <button
        type="button"
        class="nav-tab"
        data-module-id="${mod.id}"
      >
        <span class="nav-tab-short">${mod.shortLabel}</span>
        <span class="nav-tab-title">${mod.title}</span>
      </button>
    `
  ).join('');

  navContainer.addEventListener('click', (event) => {
    const button = event.target.closest('[data-module-id]');
    if (!button) return;
    const targetMod = button.dataset.moduleId;
    const st = store.getState();

    // 若未開啟跨站同步題目，切換站點時套用乾淨可預期的起點，避免極端殘留狀態嚇到新手
    if (!st.lockDataset && st.activeModule !== targetMod) {
      store.setState({
        ...getCleanModulePatch(targetMod),
        activeModule: targetMod,
        hoveredToken: null
      });
    } else {
      store.setActiveModule(targetMod);
    }
  });

  btnCameraMode.addEventListener('click', () => {
    const { cameraMode } = store.getState();
    store.setCameraMode(cameraMode === 'perspective' ? 'orthographic' : 'perspective');
  });

  btnResetCamera.addEventListener('click', () => {
    stage.resetCamera();
  });

  function syncSharedPanel(state, policy) {
    const moduleId = state.activeModule;
    const allowControlPanel = policy ? policy.showControlPanel !== false : true;
    const needsSharedEditor =
      allowControlPanel &&
      (moduleId === 'mod2' ||
        moduleId === 'mod4' ||
        (moduleId === 'mod3' && state.mod3SubMode === 'general'));
    const allowNegative = moduleId !== 'mod3';

    if (needsSharedEditor) {
      if (sharedControlPanel && sharedControlPanel.allowNegative !== allowNegative) {
        sharedControlPanel.dispose();
        sharedControlPanel = null;
      }
      if (!sharedControlPanel) {
        sharedPanelHost.style.display = 'block';
        sharedControlPanel = new ControlPanel(sharedPanelHost, store, { allowNegative });
      }
    } else if (sharedControlPanel) {
      sharedControlPanel.dispose();
      sharedControlPanel = null;
      sharedPanelHost.style.display = 'none';
    }
  }

  function applyPolicyToUI(state, policy) {
    currentPolicy = policy;
    const isGuided = state.uiMode === 'guided' && Boolean(policy);
    const isQuiz = state.activeModule === 'mod6';

    // 導覽列與底部提示條在引導模式減法收合，讓視線單純且不壓到 3D 標籤
    navContainer.style.display = isGuided ? 'none' : 'flex';
    if (stageHudBottom) {
      stageHudBottom.style.display = isGuided ? 'none' : 'block';
    }
    if (stageBottomHint) {
      stageBottomHint.textContent =
        state.activeModule === 'mod4'
          ? '直接左右拖曳發光球體可改變座標 ｜ 空白處轉動視角 ｜ 滾輪放大縮小'
          : '按住左鍵轉動視角 ｜ 滾輪放大縮小 ｜ 點右上角「復原畫面角度」隨時歸位';
    }

    syncSharedPanel(state, policy);

    if (isQuiz) {
      formulaLensHost.style.display = 'none';
      dashboardHost.style.display = 'none';
      guidedSideHost.innerHTML = '';
      return;
    }

    if (isGuided) {
      const showFormula = policy.showFormula !== false;
      const showDashboard = policy.showDashboard === true;
      formulaLensHost.style.display = showFormula ? 'block' : 'none';
      if (showFormula) formulaLens.setOpen(true);
      dashboardHost.style.display = showDashboard ? 'block' : 'none';

      // 第 4 步猜猜看尚未作答時提示正在鎖定算式防劇透
      if (!showFormula && state.activeModule === 'mod1' && policy.mod1Scope?.length === 0) {
        guidedSideHost.innerHTML = `
          <section class="glass-card quiz-lock-card">
            <h2 class="card-title">🙈 算式已暫時遮住（防劇透）</h2>
            <p class="notice-text">請先憑直覺在左下角引導卡選一個答案，選完後右側就會立刻揭曉積木面積與算式！</p>
          </section>
        `;
      } else {
        guidedSideHost.innerHTML = '';
      }

      if (activeInstance?.setGuidedScope) {
        if (state.activeModule === 'mod1') {
          activeInstance.setGuidedScope(policy.mod1Scope ?? null);
        } else if (state.activeModule === 'mod2') {
          activeInstance.setGuidedScope(policy.mod2Scope ?? null);
        }
      }
    } else {
      guidedSideHost.innerHTML = '';
      formulaLensHost.style.display = 'block';
      dashboardHost.style.display = 'block';
      if (activeInstance?.setGuidedScope) {
        activeInstance.setGuidedScope(null);
      }
    }
  }

  function mountModule(moduleId) {
    if (activeInstance) {
      activeInstance.dispose();
      activeInstance = null;
    }
    activeModuleId = moduleId;

    activeInstance = createModuleInstance(moduleId, {
      stage,
      store,
      controlsHost,
      formulaLens,
      upperHost,
      stagePane
    });

    if (activeInstance) {
      activeInstance.init();
    }

    // 自由實驗模式下，每次切入站點預設收合公式抽屜，把右側第一眼空間留給核心實驗按鈕
    const st = store.getState();
    if (st.uiMode !== 'guided') {
      formulaLens.setOpen(false);
    }
    applyPolicyToUI(st, currentPolicy);
  }

  const guidedTour = new GuidedTour({
    host: tourHost,
    toggleButton: btnTourToggle,
    store,
    getActiveModule: () => activeInstance,
    onApplyPanelPolicy: (policy) => {
      currentPolicy = policy;
      applyPolicyToUI(store.getState(), policy);
    },
    onExitToSandbox: () => {
      currentPolicy = null;
      const cur = store.getState();
      if (cur.activeModule === 'mod1') {
        activeInstance?.setPrismsVisible?.(true);
      }
      // 離開引導時清掉殘留偏離支點，並讓第 6 站回到第 1 站或保留當前站
      store.setState({ pivotOverride: null, cameraMode: 'perspective' });
      formulaLens.setOpen(false);
      applyPolicyToUI(store.getState(), null);
    }
  });

  function syncUI(state, prevState = null) {
    for (const btn of navContainer.querySelectorAll('.nav-tab')) {
      btn.classList.toggle('is-active', btn.dataset.moduleId === state.activeModule);
    }

    if (activeModuleId !== state.activeModule) {
      mountModule(state.activeModule);
    } else if (activeInstance) {
      if (prevState && prevState.mod3SubMode !== state.mod3SubMode) {
        syncSharedPanel(state, currentPolicy);
      }
      const onlyHoverChanged =
        prevState &&
        prevState.hoveredToken !== state.hoveredToken &&
        prevState.bernoulliPi === state.bernoulliPi &&
        prevState.pivotOverride === state.pivotOverride &&
        prevState.formulaMode === state.formulaMode &&
        prevState.mod3SubMode === state.mod3SubMode &&
        prevState.timelineStep === state.timelineStep &&
        prevState.binomialN === state.binomialN &&
        prevState.binomialX === state.binomialX &&
        prevState.showAtLeastOne === state.showAtLeastOne &&
        prevState.mod5Focus === state.mod5Focus &&
        prevState.beads === state.beads;

      if (onlyHoverChanged) {
        activeInstance.onHover(state.hoveredToken);
        for (const el of formulaLensHost.querySelectorAll('[data-token]')) {
          el.classList.toggle('is-hovered', Boolean(state.hoveredToken && el.dataset.token === state.hoveredToken));
        }
      } else {
        activeInstance.update(state);
      }
    }

    if (sharedControlPanel) {
      sharedControlPanel.update(state);
    }

    if (!prevState || prevState.cameraMode !== state.cameraMode) {
      stage.setCameraMode(state.cameraMode);
    }

    const isOrtho = state.cameraMode === 'orthographic';
    btnCameraMode.textContent = isOrtho ? '切回立體斜視 (3D)' : '從正上方平看 (2D 面積)';
    btnCameraMode.classList.toggle('is-active', isOrtho);
    btnCameraMode.style.display = state.activeModule === 'mod1' ? 'inline-flex' : 'none';

    const modMeta = MODULE_LIST.find((m) => m.id === state.activeModule);
    if (stageBadge && modMeta) {
      stageBadge.textContent = `第 ${modMeta.shortLabel} 站：${modMeta.title}`;
    }

    dashboard.update(state);
    guidedTour.syncState(state);
  }

  store.subscribe(syncUI);
  syncUI(store.getState());
  guidedTour.start();
}

document.addEventListener('DOMContentLoaded', bootstrap);
