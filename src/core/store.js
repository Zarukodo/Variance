/**
 * 單一真相來源（State + Pub/Sub 事件匯流排）
 */

import { normalizeBeads } from './mathEngine.js';

export const initialState = {
  activeModule: 'mod1',       // 'mod1' | 'mod2' | 'mod3' | 'mod4' | 'mod5'
  cameraMode: 'perspective',  // 'perspective' | 'orthographic'
  formulaMode: 'symbolic',    // 'symbolic' | 'numeric' | 'geometric'
  lockDataset: true,          // 開啟時，模組 2/3/4 切換共享同一組珠子數據

  // 通用多珠資料集（每次修改自動正規化，確保機率總和為 1）
  beads: [
    { id: 'b0', x: 2, p: 0.2 },
    { id: 'b1', x: 4, p: 0.5 },
    { id: 'b2', x: 6, p: 0.3 }
  ],
  pivotOverride: null,        // null = 鎖定在重心 μ；數值 = 手動拖歪的支點 a

  // 二項分佈專用參數
  bernoulliPi: 0.3,
  binomialN: 4,
  binomialX: 2,
  showAtLeastOne: false,

  // 互動與動畫狀態
  mod3SubMode: 'general',     // 'general' | 'bernoulli'
  timelineStep: 0,
  hoveredToken: null
};

class Store {
  constructor(seedState) {
    this._state = {
      ...seedState,
      beads: normalizeBeads(seedState.beads)
    };
    this._listeners = new Set();
  }

  getState() {
    return this._state;
  }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  setState(partial) {
    const prevState = this._state;
    const nextPatch = typeof partial === 'function' ? partial(prevState) : partial;
    if (!nextPatch || typeof nextPatch !== 'object') return;

    const nextState = {
      ...prevState,
      ...nextPatch
    };

    if (Object.prototype.hasOwnProperty.call(nextPatch, 'beads')) {
      nextState.beads = normalizeBeads(nextPatch.beads);
    }

    this._state = nextState;
    for (const listener of this._listeners) {
      listener(this._state, prevState);
    }
  }

  setActiveModule(moduleId) {
    const nextPatch = { activeModule: moduleId, hoveredToken: null };
    if (moduleId !== 'mod1' && this._state.cameraMode === 'orthographic') {
      nextPatch.cameraMode = 'perspective';
    }
    this.setState(nextPatch);
  }

  setCameraMode(mode) {
    if (mode !== 'perspective' && mode !== 'orthographic') return;
    this.setState({ cameraMode: mode });
  }

  setBeads(beads) {
    this.setState({ beads: normalizeBeads(beads) });
  }

  setBernoulliPi(pi) {
    const clamped = Math.min(1, Math.max(0, Number(pi)));
    this.setState({ bernoulliPi: Number.isFinite(clamped) ? clamped : 0.3 });
  }

  setHoveredToken(token) {
    if (this._state.hoveredToken === token) return;
    this.setState({ hoveredToken: token });
  }

  resetPivot() {
    this.setState({ pivotOverride: null });
  }
}

export const store = new Store(initialState);
