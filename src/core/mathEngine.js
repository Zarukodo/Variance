/**
 * 純數學運算引擎（零 DOM / 3D 依賴，獨立可測試）
 * 嚴格實作 formula_logic.txt 定義之八項統計公式與幾何指標
 */

import { MATH_TOLERANCE } from './constants.js';

/**
 * 將機率權重正規化，確保 ΣP(x_i) = 1，同時保留使用者輸入的 rawWeight 避免滑桿／輸入框互拉飄移。
 * @param {Array<{id?: string, x: number, p?: number, rawWeight?: number}>} rawBeads
 * @returns {Array<{id: string, x: number, p: number, rawWeight: number}>}
 */
export function normalizeBeads(rawBeads) {
  if (!Array.isArray(rawBeads) || rawBeads.length === 0) {
    return [{ id: 'b0', x: 0, p: 1, rawWeight: 100 }];
  }

  const hasExplicitRaw = rawBeads.some((b) => b?.rawWeight !== undefined);
  const rawValues = rawBeads.map((b) => {
    const val = Number(b?.rawWeight !== undefined ? b.rawWeight : b?.p);
    return Number.isFinite(val) && val > 0 ? val : 0;
  });
  const initialSum = rawValues.reduce((acc, v) => acc + v, 0);
  const scaleToPercent = !hasExplicitRaw && initialSum > 0 && initialSum <= 1.0001 ? 100 : 1;

  const sanitized = rawBeads.map((bead, index) => {
    const x = Number.isFinite(Number(bead?.x)) ? Number(bead.x) : 0;
    const rawWeight = Number((rawValues[index] * scaleToPercent).toFixed(4));
    return {
      id: bead?.id ? String(bead.id) : `b${index}`,
      x,
      rawWeight
    };
  });

  const sumW = sanitized.reduce((acc, item) => acc + item.rawWeight, 0);
  if (sumW <= 0) {
    const uniform = 1 / sanitized.length;
    return sanitized.map((item) => ({ ...item, p: uniform }));
  }

  return sanitized.map((item) => ({
    ...item,
    p: item.rawWeight / sumW
  }));
}

/**
 * 1. 期望值（數線槓桿重心）：μ = Σ x · P(x)
 * @param {Array<{x: number, p: number}>} beads
 */
export function computeMean(beads) {
  return beads.reduce((acc, b) => acc + b.x * b.p, 0);
}

/**
 * 2. 變異數（定義版）：σ² = Σ (x - μ)² · P(x)
 * @param {Array<{x: number, p: number}>} beads
 * @param {number} [mu]
 */
export function computeVarianceDef(beads, mu = computeMean(beads)) {
  return beads.reduce((acc, b) => {
    const d = b.x - mu;
    return acc + d * d * b.p;
  }, 0);
}

/**
 * 4. 變異數（捷徑版／平行軸定理）：σ² = Σ x² · P(x) - μ²
 * @param {Array<{x: number, p: number}>} beads
 * @param {number} [mu]
 */
export function computeVarianceShortcut(beads, mu = computeMean(beads)) {
  const ex2 = beads.reduce((acc, b) => acc + b.x * b.x * b.p, 0);
  return ex2 - mu * mu;
}

/**
 * 5. 變異數（對立引力網版）：σ² = ½ Σ_i Σ_j P(x_i) P(x_j) (x_i - x_j)²
 * @param {Array<{x: number, p: number}>} beads
 */
export function computeVarianceWeb(beads) {
  let sum = 0;
  for (let i = 0; i < beads.length; i += 1) {
    for (let j = 0; j < beads.length; j += 1) {
      const diff = beads[i].x - beads[j].x;
      sum += beads[i].p * beads[j].p * diff * diff;
    }
  }
  return 0.5 * sum;
}

/**
 * 完整計算多珠資料集的所有核心指標（含三軌變異數比對與支點破壞實驗參數）
 * @param {Array<{id?: string, x: number, p: number}>} rawBeads
 * @param {number|null} [pivotOverride=null]
 */
export function computeAllMetrics(rawBeads, pivotOverride = null) {
  const beads = normalizeBeads(rawBeads);
  const sumP = beads.reduce((acc, b) => acc + b.p, 0);
  const mu = computeMean(beads);
  const ex2 = beads.reduce((acc, b) => acc + b.x * b.x * b.p, 0);

  const varDef = computeVarianceDef(beads, mu);
  const varShort = ex2 - mu * mu;
  const varWeb = computeVarianceWeb(beads);

  const diffDefShort = Math.abs(varDef - varShort);
  const diffDefWeb = Math.abs(varDef - varWeb);
  const diffShortWeb = Math.abs(varShort - varWeb);
  const maxDiff = Math.max(diffDefShort, diffDefWeb, diffShortWeb);

  const variance = Math.max(0, varDef);
  const sd = Math.sqrt(variance);

  const pivot = Number.isFinite(Number(pivotOverride)) && pivotOverride !== null
    ? Number(pivotOverride)
    : mu;

  const torque = mu - pivot;
  const inertiaAtPivot = variance + (mu - pivot) ** 2;

  const perBead = beads.map((b) => {
    const d = b.x - mu;
    const d2 = d * d;
    const wingBase = 2 * mu * d;
    return {
      ...b,
      d,
      d2,
      defVolume: d2 * b.p,
      originVolume: b.x * b.x * b.p,
      coreVolume: mu * mu * b.p,
      wingBase,
      wingVolume: wingBase * b.p,
      isPositiveWing: wingBase >= 0
    };
  });

  const wingNetSum = perBead.reduce((acc, b) => acc + b.wingVolume, 0);

  return {
    beads,
    sumP,
    mu,
    ex2,
    mu2: mu * mu,
    varDef,
    varShort,
    varWeb,
    maxDiff,
    isConsistent: maxDiff < MATH_TOLERANCE,
    variance,
    sd,
    pivot,
    torque,
    inertiaAtPivot,
    wingNetSum,
    perBead
  };
}

/**
 * 3. 單次二項分佈（白努利試驗）幾何與統計量
 * @param {number} rawPi
 */
export function computeBernoulliMetrics(rawPi) {
  const pi = Math.min(1, Math.max(0, Number.isFinite(Number(rawPi)) ? Number(rawPi) : 0.5));
  const q = 1 - pi;
  const variance = pi * q;
  const sd = Math.sqrt(Math.max(0, variance));

  return {
    pi,
    q,
    mu: pi,
    mu2: pi * pi,
    variance,
    sd,
    beads: [
      { id: 'b0', x: 0, p: q, rawWeight: Number((q * 100).toFixed(2)) },
      { id: 'b1', x: 1, p: pi, rawWeight: Number((pi * 100).toFixed(2)) }
    ],
    bead0: {
      x: 0,
      height: q,
      dist: pi,
      baseArea: pi * pi,
      volume: pi * pi * q
    },
    bead1: {
      x: 1,
      height: pi,
      dist: q,
      baseArea: q * q,
      volume: q * q * pi
    }
  };
}

/**
 * 7. 安全遞推組合數 C(n, x)
 * @param {number} n
 * @param {number} x
 */
export function comb(n, x) {
  const nn = Math.floor(n);
  const xx = Math.floor(x);
  if (!Number.isFinite(nn) || !Number.isFinite(xx) || nn < 0 || xx < 0 || xx > nn) {
    return 0;
  }
  const k = Math.min(xx, nn - xx);
  let result = 1;
  for (let i = 1; i <= k; i += 1) {
    result = (result * (nn - k + i)) / i;
  }
  return Math.round(result);
}

/**
 * 7 & 8. 二項分佈機率與獨立重複 n 次放大指標
 * @param {number} rawN
 * @param {number} rawX
 * @param {number} rawPi
 */
export function computeBinomialMetrics(rawN, rawX, rawPi) {
  const n = Math.max(1, Math.floor(Number(rawN) || 1));
  const x = Math.min(n, Math.max(0, Math.floor(Number(rawX) || 0)));
  const pi = Math.min(1, Math.max(0, Number.isFinite(Number(rawPi)) ? Number(rawPi) : 0.5));
  const q = 1 - pi;

  const ways = comb(n, x);
  const singlePathProb = Math.pow(pi, x) * Math.pow(q, n - x);
  const probX = ways * singlePathProb;
  const probZero = Math.pow(q, n);
  const probAtLeastOne = 1 - probZero;

  const mu = n * pi;
  const variance = n * pi * q;
  const sd = Math.sqrt(Math.max(0, variance));

  return {
    n,
    x,
    pi,
    q,
    ways,
    singlePathProb,
    probX,
    probZero,
    probAtLeastOne,
    mu,
    variance,
    sd
  };
}
