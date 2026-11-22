/**
 * 純數學運算引擎（零 DOM / 3D 依賴，獨立可測試）
 * 嚴格實作 formula_logic.txt 定義之八項統計公式與幾何指標
 */

import { MATH_TOLERANCE } from './constants.js';

/**
 * 將機率權重正規化，確保 ΣP(x_i) = 1 且各權重為有限非負實數。
 * @param {Array<{id?: string, x: number, p: number}>} rawBeads
 * @returns {Array<{id: string, x: number, p: number}>}
 */
export function normalizeBeads(rawBeads) {
  if (!Array.isArray(rawBeads) || rawBeads.length === 0) {
    return [{ id: 'b0', x: 0, p: 1 }];
  }

  const sanitized = rawBeads.map((bead, index) => {
    const x = Number.isFinite(Number(bead?.x)) ? Number(bead.x) : 0;
    const rawP = Number(bead?.p);
    const p = Number.isFinite(rawP) && rawP > 0 ? rawP : 0;
    return {
      id: bead?.id ? String(bead.id) : `b${index}`,
      x,
      p
    };
  });

  const sumP = sanitized.reduce((acc, item) => acc + item.p, 0);
  if (sumP <= 0) {
    const uniform = 1 / sanitized.length;
    return sanitized.map((item) => ({ ...item, p: uniform }));
  }

  return sanitized.map((item) => ({
    ...item,
    p: item.p / sumP
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

  // varDef 由平方項加總得出，數學上必 >= 0；僅防極微小負浮點誤差傳入 sqrt
  const variance = Math.max(0, varDef);
  const sd = Math.sqrt(variance);

  const pivot = Number.isFinite(Number(pivotOverride)) && pivotOverride !== null
    ? Number(pivotOverride)
    : mu;

  // 支點破壞實驗：任意支點 a 之淨力矩 τ(a) = μ - a，總轉動慣量 I(a) = σ² + (μ - a)²
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
      // 嚴禁以 d > 0 決定顏色，統一依據 2*mu*d 實際正負號
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
 * 嚴格對應：0號珠 π×π×(1-π)，1號珠 (1-π)×(1-π)×π，塌縮為 1 × π(1-π)
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
      { id: 'b0', x: 0, p: q },
      { id: 'b1', x: 1, p: pi }
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
 * 7. 安全遞推組合數 C(n, x)，避免階乘溢位
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
