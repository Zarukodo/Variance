/**
 * 全站統一色彩語意、渲染層級與數值容差常數（V2.0 新手友善命名）
 */

export const COLORS = Object.freeze({
  bg: '#0f172a',
  bgHex: 0x0f172a,
  surface: '#1e293b',
  mu: '#f59e0b',          // 期望值支點 μ／中央核心柱 μ²（琥珀金）
  muHex: 0xf59e0b,
  bead1: '#06b6d4',       // 1 號珠（成功 π）與其方柱（霓虹青）
  bead1Hex: 0x06b6d4,
  bead0: '#f43f5e',       // 0 號珠（失敗 1-π）與其方柱（珊瑚粉）
  bead0Hex: 0xf43f5e,
  positive: '#10b981',    // 正側翼 +2μd_i／最終純變異數 σ²（翠綠色）
  positiveHex: 0x10b981,
  negative: '#a855f7',    // 負側翼 -2μd_i／標準差降維尺規 σ（紫羅蘭）
  negativeHex: 0xa855f7,
  gridMajor: 0x1e3a5f,
  gridMinor: 0x17253d,
  axisLine: 0x38bdf8
});

export const RENDER_ORDER = Object.freeze({
  GRID: 0,
  LEVER: 1,
  CORE_COLUMN: 2,
  WINGS: 3,
  PURE_VARIANCE: 4,
  EDGES: 5,
  LASER_CUT: 6
});

/** 幾何工廠零尺寸防呆門檻 */
export const EPSILON = 1e-4;

/** 三軌變異數驗算誤差容許門檻 */
export const MATH_TOLERANCE = 1e-9;

export const MODULE_LIST = Object.freeze([
  { id: 'mod1', shortLabel: '1', title: '平衡與雙珠' },
  { id: 'mod2', shortLabel: '2', title: '風險與尺規' },
  { id: 'mod3', shortLabel: '3', title: '原點一刀切' },
  { id: 'mod4', shortLabel: '4', title: '對立引力網' },
  { id: 'mod5', shortLabel: '5', title: '組合與 √n' },
  { id: 'mod6', shortLabel: '6', title: '盲測挑戰' }
]);
