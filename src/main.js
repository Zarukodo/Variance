/**
 * 應用啟動器：初始化 Stage3D、Store、FormulaLens、ControlPanel、Dashboard 與模組切換路由
 */

import { MODULE_LIST } from './core/constants.js';
import { store } from './core/store.js';
import { Stage3D } from './engine/Stage3D.js';
import { FormulaLens } from './ui/FormulaLens.js';
import { ControlPanel } from './ui/ControlPanel.js';
import { Dashboard } from './ui/Dashboard.js';
import { Mod1Bernoulli } from './modules/Mod1Bernoulli.js';
import { Mod2VarianceSD } from './modules/Mod2VarianceSD.js';
import { Mod3OriginCut } from './modules/Mod3OriginCut.js';
import { Mod4GravityWeb } from './modules/Mod4GravityWeb.js';
import { Mod5BinomialN } from './modules/Mod5BinomialN.js';

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
    default:
      return null;
  }
}

function bootstrap() {
  const stagePane = document.getElementById('stage-pane');
  const upperHost = document.getElementById('mod5-upper-stage');
  const stageContainer = document.getElementById('stage-canvas-host');
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

  // 若關閉 lockDataset，個別暫存模組 2/3/4 的珠子快照
  const unlockedSnapshots = new Map();

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
    const prevState = store.getState();

    if (!prevState.lockDataset && prevState.activeModule !== targetMod) {
      unlockedSnapshots.set(prevState.activeModule, prevState.beads);
      const saved = unlockedSnapshots.get(targetMod);
      if (saved) {
        store.setState({ beads: saved, pivotOverride: null });
      }
    }
    store.setActiveModule(targetMod);
  });

  btnCameraMode.addEventListener('click', () => {
    const { cameraMode } = store.getState();
    store.setCameraMode(cameraMode === 'perspective' ? 'orthographic' : 'perspective');
  });

  btnResetCamera.addEventListener('click', () => {
    stage.resetCamera();
  });

  function syncSharedPanel(state) {
    const moduleId = state.activeModule;
    const needsSharedEditor =
      moduleId === 'mod2' ||
      moduleId === 'mod4' ||
      (moduleId === 'mod3' && state.mod3SubMode === 'general');
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

  function mountModule(moduleId) {
    if (activeInstance) {
      activeInstance.dispose();
      activeInstance = null;
    }
    activeModuleId = moduleId;
    syncSharedPanel(store.getState());

    activeInstance = createModuleInstance(moduleId, {
      stage,
      store,
      controlsHost,
      formulaLens,
      upperHost,
      stagePane
    });

    if (activeInstance) {
      formulaLensHost.style.display = 'block';
      activeInstance.init();
    }
  }

  function syncUI(state, prevState = null) {
    for (const btn of navContainer.querySelectorAll('.nav-tab')) {
      btn.classList.toggle('is-active', btn.dataset.moduleId === state.activeModule);
    }

    if (activeModuleId !== state.activeModule) {
      mountModule(state.activeModule);
    } else if (activeInstance) {
      if (prevState && prevState.mod3SubMode !== state.mod3SubMode) {
        syncSharedPanel(state);
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
    btnCameraMode.textContent = isOrtho ? '切回 3D 透視' : '2D 俯視（正交）';
    btnCameraMode.classList.toggle('is-active', isOrtho);
    btnCameraMode.style.display = state.activeModule === 'mod1' ? 'inline-flex' : 'none';

    const modMeta = MODULE_LIST.find((m) => m.id === state.activeModule);
    if (stageBadge && modMeta) {
      stageBadge.textContent = `${modMeta.shortLabel}：${modMeta.title}`;
    }

    dashboard.update(state);
  }

  store.subscribe(syncUI);
  syncUI(store.getState());
}

document.addEventListener('DOMContentLoaded', bootstrap);
