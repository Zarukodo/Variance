/**
 * 共用 3D 積木工廠
 * - 填色 Mesh（depthWrite: false）與 EdgesGeometry 實色線框分離組裝，根治透明穿模
 * - 強制依語意套用 7 層 renderOrder
 * - 統一執行 EPSILON (1e-4) 零尺寸防呆：任一維度 < EPSILON 直接設為 visible = false
 */

import * as THREE from 'three';
import { EPSILON, RENDER_ORDER } from '../core/constants.js';

const UNIT_BOX_GEO = new THREE.BoxGeometry(1, 1, 1);
const UNIT_EDGES_GEO = new THREE.EdgesGeometry(UNIT_BOX_GEO);

/**
 * 建立玻璃積木 Group（內含 visualRoot，可安全縮放與高亮）
 * @param {{
 *   width?: number,
 *   height?: number,
 *   depth?: number,
 *   color: number | string,
 *   opacity?: number,
 *   renderOrder?: number,
 *   edgeRenderOrder?: number,
 *   token?: string | null,
 *   dashed?: boolean
 * }} opts
 */
export function createGlassBlock(opts) {
  const {
    width = 1,
    height = 1,
    depth = 1,
    color,
    opacity = 0.45,
    renderOrder = RENDER_ORDER.PURE_VARIANCE,
    edgeRenderOrder = RENDER_ORDER.EDGES,
    token = null,
    dashed = false
  } = opts;

  const group = new THREE.Group();
  group.userData.token = token;

  const visualRoot = new THREE.Group();
  group.add(visualRoot);

  const baseColor = new THREE.Color(color);

  const fillMat = new THREE.MeshStandardMaterial({
    color: baseColor,
    emissive: baseColor,
    emissiveIntensity: 0.14,
    transparent: true,
    opacity,
    roughness: 0.25,
    metalness: 0.08,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const fillMesh = new THREE.Mesh(UNIT_BOX_GEO.clone(), fillMat);
  fillMesh.renderOrder = renderOrder;
  fillMesh.userData.token = token;
  visualRoot.add(fillMesh);

  let edgeMat;
  if (dashed) {
    edgeMat = new THREE.LineDashedMaterial({
      color: baseColor,
      dashSize: 0.08,
      gapSize: 0.05,
      transparent: true,
      opacity: 0.9,
      depthWrite: true
    });
  } else {
    edgeMat = new THREE.LineBasicMaterial({
      color: baseColor,
      transparent: true,
      opacity: 0.95,
      depthWrite: true
    });
  }

  const edges = new THREE.LineSegments(UNIT_EDGES_GEO.clone(), edgeMat);
  if (dashed) {
    edges.computeLineDistances();
  }
  edges.renderOrder = edgeRenderOrder;
  edges.userData.token = token;
  visualRoot.add(edges);

  group.userData.visualRoot = visualRoot;
  group.userData.fillMesh = fillMesh;
  group.userData.edges = edges;
  group.userData.baseOpacity = opacity;
  group.userData.dims = { width, height, depth };

  updateGlassBlock(group, { width, height, depth });
  return group;
}

/**
 * 更新積木尺寸與顏色，若任一維度 < EPSILON 則自動隱藏，絕不傳入 0 進縮放矩陣
 * @param {THREE.Group} group
 * @param {{ width: number, height: number, depth: number, color?: number | string, opacity?: number }} params
 */
export function updateGlassBlock(group, params) {
  const { width, height, depth, color, opacity } = params;
  const visualRoot = group.userData.visualRoot;
  const fillMesh = group.userData.fillMesh;
  const edges = group.userData.edges;

  group.userData.dims = { width, height, depth };

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(depth) ||
    width < EPSILON ||
    height < EPSILON ||
    depth < EPSILON
  ) {
    group.visible = false;
    return;
  }

  group.visible = true;
  visualRoot.scale.set(width, height, depth);

  if (color !== undefined) {
    const c = new THREE.Color(color);
    fillMesh.material.color.copy(c);
    fillMesh.material.emissive.copy(c);
    edges.material.color.copy(c);
  }
  if (opacity !== undefined) {
    group.userData.baseOpacity = opacity;
    fillMesh.material.opacity = opacity;
  }
}

/**
 * 切換積木懸停高亮狀態（1.03x 微幅放大 + 提高自發光亮度）
 * @param {THREE.Group} group
 * @param {boolean} isHighlighted
 */
export function setBlockHighlight(group, isHighlighted) {
  if (!group || !group.userData.fillMesh) return;
  const fillMat = group.userData.fillMesh.material;
  const baseOpacity = group.userData.baseOpacity ?? 0.45;

  if (isHighlighted) {
    group.scale.set(1.03, 1.03, 1.03);
    fillMat.emissiveIntensity = 0.52;
    fillMat.opacity = Math.min(0.78, baseOpacity + 0.22);
  } else {
    group.scale.set(1, 1, 1);
    fillMat.emissiveIntensity = 0.14;
    fillMat.opacity = baseOpacity;
  }
}

/**
 * 建立垂直或水平發光卡尺線段組（用於標示塌縮厚度 1.00 等尺寸）
 * @param {{ length: number, color: number | string, tickSize?: number }} opts
 */
export function createCaliperBracket({ length = 1, color = 0x10b981, tickSize = 0.08 }) {
  const group = new THREE.Group();
  const half = length * 0.5;

  const points = [
    new THREE.Vector3(0, -half, 0),
    new THREE.Vector3(0, half, 0),
    new THREE.Vector3(-tickSize, -half, 0),
    new THREE.Vector3(tickSize, -half, 0),
    new THREE.Vector3(-tickSize, half, 0),
    new THREE.Vector3(tickSize, half, 0)
  ];

  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.95
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.renderOrder = RENDER_ORDER.LASER_CUT;
  group.add(lines);

  return group;
}
