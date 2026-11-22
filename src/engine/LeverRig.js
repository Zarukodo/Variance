/**
 * 物理槓桿元件（數線槓桿重心模型）
 * - 即時依 τ(a) = μ - a 計算槓桿傾角（向右重則右端下沉）
 * - 支援自由拖歪支點 a 的破壞實驗視覺化，並顯示重心 μ 基準位置
 */

import * as THREE from 'three';
import { COLORS, EPSILON, RENDER_ORDER } from '../core/constants.js';

export class LeverRig {
  /**
   * @param {{ yOffset?: number, minX?: number, maxX?: number }} [opts]
   */
  constructor(opts = {}) {
    this.yOffset = opts.yOffset ?? -0.34;
    this.minX = opts.minX ?? -0.45;
    this.maxX = opts.maxX ?? 1.45;

    this.group = new THREE.Group();
    this.group.position.y = this.yOffset;

    this.beamPivot = new THREE.Group();
    this.group.add(this.beamPivot);

    // 1. 槓桿橫樑（單位寬度 1，於 update 時依動態跨距縮放）
    const beamLen = Math.max(0.5, this.maxX - this.minX);
    const beamGeo = new THREE.BoxGeometry(1, 0.045, 0.14);
    const beamMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.55,
      roughness: 0.35
    });
    this.beamMesh = new THREE.Mesh(beamGeo, beamMat);
    this.beamMesh.scale.x = beamLen;
    this.beamMesh.renderOrder = RENDER_ORDER.LEVER;
    this.beamPivot.add(this.beamMesh);

    // 2. 支點三角稜柱（琥珀金：鎖定重心時亮金；偏離重心時轉為警戒粉）
    const fulcrumGeo = new THREE.ConeGeometry(0.11, 0.22, 4);
    fulcrumGeo.rotateY(Math.PI / 4);
    const fulcrumMat = new THREE.MeshStandardMaterial({
      color: COLORS.muHex,
      emissive: COLORS.muHex,
      emissiveIntensity: 0.28,
      metalness: 0.45,
      roughness: 0.3
    });
    this.fulcrumMesh = new THREE.Mesh(fulcrumGeo, fulcrumMat);
    this.fulcrumMesh.position.set(0, -0.135, 0);
    this.fulcrumMesh.renderOrder = RENDER_ORDER.LEVER;
    this.fulcrumMesh.userData.token = 'mu';
    this.group.add(this.fulcrumMesh);

    // 3. 期望值重心基準指示針（當支點被拖歪時，仍能看出真正的 μ 在何處）
    const muPinGeo = new THREE.ConeGeometry(0.05, 0.12, 16);
    muPinGeo.rotateX(Math.PI);
    const muPinMat = new THREE.MeshStandardMaterial({
      color: COLORS.muHex,
      emissive: COLORS.muHex,
      emissiveIntensity: 0.35
    });
    this.muPin = new THREE.Mesh(muPinGeo, muPinMat);
    this.muPin.position.set(0, 0.14, 0);
    this.muPin.renderOrder = RENDER_ORDER.LEVER;
    this.muPin.userData.token = 'mu';
    this.group.add(this.muPin);

    // 4. 珠子容器（掛於橫樑上隨槓桿一起傾斜）
    this.beadsGroup = new THREE.Group();
    this.beamPivot.add(this.beadsGroup);
    this._beadMeshes = [];
  }

  /**
   * 同步珠子座標、權重、重心 μ 與目前支點 a（支援動態調整橫樑左右跨距）
   * @param {{ beads: Array<{x: number, p: number, color?: number|string, token?: string}>, mu: number, pivot: number, minX?: number, maxX?: number }} params
   */
  update({ beads, mu, pivot, minX, maxX }) {
    if (Number.isFinite(minX)) this.minX = minX;
    if (Number.isFinite(maxX)) this.maxX = maxX;
    const beamLen = Math.max(0.5, this.maxX - this.minX);
    this.beamMesh.scale.x = beamLen;

    const center = (this.minX + this.maxX) * 0.5;
    const clampedPivot = Math.min(this.maxX - 0.05, Math.max(this.minX + 0.05, pivot));

    // 將轉軸放在實際支點位置，橫樑相對於轉軸平移保持座標對齊
    this.beamPivot.position.set(clampedPivot, 0, 0);
    this.beamMesh.position.set(center - clampedPivot, 0, 0);

    this.fulcrumMesh.position.set(clampedPivot, -0.135, 0);
    const isOffCenter = Math.abs(mu - pivot) > EPSILON;
    const fulcrumColor = isOffCenter ? COLORS.bead0Hex : COLORS.muHex;
    this.fulcrumMesh.material.color.setHex(fulcrumColor);
    this.fulcrumMesh.material.emissive.setHex(fulcrumColor);

    this.muPin.position.set(mu, 0.15, 0);

    // 力矩 τ(a) = μ - a；右側較重 (τ > 0) 時右端下沉，故繞 Z 軸旋轉負角
    const torque = mu - pivot;
    const maxAngle = 0.28;
    const angle = THREE.MathUtils.clamp(-torque * 0.42, -maxAngle, maxAngle);
    this.beamPivot.rotation.z = angle;

    this._syncBeads(beads, clampedPivot);
  }

  _syncBeads(beads, pivotX) {
    while (this._beadMeshes.length < beads.length) {
      const geo = new THREE.SphereGeometry(1, 24, 24);
      const mat = new THREE.MeshStandardMaterial({
        color: COLORS.bead1Hex,
        emissive: COLORS.bead1Hex,
        emissiveIntensity: 0.25,
        roughness: 0.2,
        metalness: 0.35
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = RENDER_ORDER.LEVER;
      this.beadsGroup.add(mesh);
      this._beadMeshes.push(mesh);
    }

    for (let i = 0; i < this._beadMeshes.length; i += 1) {
      const mesh = this._beadMeshes[i];
      const bead = beads[i];
      if (!bead || bead.p < EPSILON) {
        mesh.visible = false;
        continue;
      }

      mesh.visible = true;
      const radius = 0.045 + 0.075 * Math.sqrt(bead.p);
      mesh.scale.set(radius, radius, radius);
      mesh.position.set(bead.x - pivotX, 0.022 + radius, 0);

      const c = new THREE.Color(bead.color ?? COLORS.bead1Hex);
      mesh.material.color.copy(c);
      mesh.material.emissive.copy(c);
      mesh.userData.token = bead.token ?? null;
    }
  }
}
