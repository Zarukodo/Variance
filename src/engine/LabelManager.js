/**
 * 3D 空間標註管理器（封裝 CSS2DObject）
 * 統一管理稜邊尺寸卡尺浮動標籤與常駐空間標註的生命週期與高亮
 */

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export class LabelManager {
  constructor() {
    this._persistentLabels = new Set();
    this._hoverLabels = new Set();
  }

  /**
   * 在指定 3D 父物件上新增 CSS2D 標籤
   * @param {THREE.Object3D} parent
   * @param {{ text?: string, html?: string, position?: [number, number, number], className?: string, persistent?: boolean }} opts
   */
  addLabel(parent, opts = {}) {
    const {
      text = '',
      html = null,
      position = [0, 0, 0],
      className = 'scene-label',
      persistent = true
    } = opts;

    const el = document.createElement('div');
    el.className = className;
    if (html !== null) {
      el.innerHTML = html;
    } else {
      el.textContent = text;
    }

    const labelObj = new CSS2DObject(el);
    labelObj.position.set(position[0], position[1], position[2]);
    parent.add(labelObj);

    if (persistent) {
      this._persistentLabels.add(labelObj);
    } else {
      this._hoverLabels.add(labelObj);
    }

    return labelObj;
  }

  /**
   * 更新現有標籤內容與顯示位置
   */
  updateLabel(labelObj, { text, html, position, visible }) {
    if (!labelObj) return;
    if (html !== undefined) {
      labelObj.element.innerHTML = html;
    } else if (text !== undefined) {
      labelObj.element.textContent = text;
    }
    if (position) {
      labelObj.position.set(position[0], position[1], position[2]);
    }
    if (visible !== undefined) {
      labelObj.visible = visible;
    }
  }

  /**
   * 懸停積木時，在積木三條稜邊即時浮現長、寬、高數值標註
   * @param {THREE.Group} blockGroup
   * @param {{ xText: string, yText: string, zText: string }} edgeTexts
   */
  showBlockEdgeLabels(blockGroup, edgeTexts) {
    this.clearHoverLabels();
    if (!blockGroup || !blockGroup.visible) return;
    const dims = blockGroup.userData.dims;
    if (!dims) return;

    const hx = dims.width * 0.5;
    const hy = dims.height * 0.5;
    const hz = dims.depth * 0.5;

    // 貼齊積木的局部三稜邊（若積木已翻轉 90 度，局部座標軸會隨積木自動正確對位）
    this.addLabel(blockGroup, {
      text: edgeTexts.xText,
      position: [0, -hy - 0.04, hz + 0.04],
      className: 'scene-label is-edge',
      persistent: false
    });
    this.addLabel(blockGroup, {
      text: edgeTexts.yText,
      position: [hx + 0.05, 0, hz + 0.04],
      className: 'scene-label is-edge',
      persistent: false
    });
    this.addLabel(blockGroup, {
      text: edgeTexts.zText,
      position: [-hx - 0.05, -hy - 0.04, 0],
      className: 'scene-label is-edge',
      persistent: false
    });
  }

  clearHoverLabels() {
    for (const labelObj of this._hoverLabels) {
      this._removeLabelObject(labelObj);
    }
    this._hoverLabels.clear();
  }

  clearAll() {
    this.clearHoverLabels();
    for (const labelObj of this._persistentLabels) {
      this._removeLabelObject(labelObj);
    }
    this._persistentLabels.clear();
  }

  _removeLabelObject(labelObj) {
    if (labelObj.parent) {
      labelObj.parent.remove(labelObj);
    }
    if (labelObj.element && labelObj.element.parentNode) {
      labelObj.element.parentNode.removeChild(labelObj.element);
    }
  }
}
