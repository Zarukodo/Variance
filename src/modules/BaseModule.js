/**
 * 教學模組抽象基底類別
 * 強制規範 init / update / onHover / dispose 生命週期，並統一清理 GPU 與 GSAP 資源
 */

import * as THREE from 'three';
import { gsap } from 'gsap';

export class BaseModule {
  /**
   * @param {{ stage: import('../engine/Stage3D.js').Stage3D, store: import('../core/store.js').store, controlsHost: HTMLElement }} context
   */
  constructor(context) {
    this.stage = context.stage;
    this.store = context.store;
    this.controlsHost = context.controlsHost;
    this.root = new THREE.Group();
    this._disposed = false;
  }

  init() {
    this.stage.getModuleRoot().add(this.root);
  }

  /** @param {object} _state */
  update(_state) {}

  /** @param {string | null} _token */
  onHover(_token) {}

  /**
   * 遞迴釋放 Three.js Geometry / Material、CSS2DObject DOM 節點與 GSAP 補間動畫
   * @param {THREE.Object3D} node
   */
  disposeObject3D(node) {
    if (!node) return;
    gsap.killTweensOf(node);
    if (node.position) gsap.killTweensOf(node.position);
    if (node.rotation) gsap.killTweensOf(node.rotation);
    if (node.scale) gsap.killTweensOf(node.scale);

    while (node.children.length > 0) {
      const child = node.children[0];
      this.disposeObject3D(child);
      node.remove(child);
    }

    if (node.isCSS2DObject && node.element && node.element.parentNode) {
      node.element.parentNode.removeChild(node.element);
    }

    if (node.geometry && typeof node.geometry.dispose === 'function') {
      node.geometry.dispose();
    }

    if (node.material) {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const mat of materials) {
        if (mat && typeof mat.dispose === 'function') {
          mat.dispose();
        }
      }
    }
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.disposeObject3D(this.root);
    if (this.root.parent) {
      this.root.parent.remove(this.root);
    }
    if (this.controlsHost) {
      this.controlsHost.innerHTML = '';
    }
  }
}
