/**
 * 實戰數值劇本庫（presets.js）
 * 支援獨立 rawWeight 份數設定，確保選用或編輯時不會發生滑桿互拉飄移
 */

export const BEAD_PALETTE = Object.freeze([
  '#06b6d4', // 霓虹青
  '#f43f5e', // 珊瑚粉
  '#38bdf8', // 天空藍
  '#fb923c', // 琥珀橘
  '#e879f9', // 紫丁香
  '#2dd4bf'  // 碧綠色
]);

export const DATASET_PRESETS = Object.freeze([
  {
    id: 'small_int',
    label: '整數小樣本 {2, 4, 6}（好心算驗算）',
    insight: '期望值 μ = 4.2；原點大柱 19.6 減去重心柱 4.2² = 17.64，乾淨餘下 σ² = 1.96（σ = 1.4）。',
    beads: [
      { id: 'b0', x: 2, p: 0.2, rawWeight: 20 },
      { id: 'b1', x: 4, p: 0.5, rawWeight: 50 },
      { id: 'b2', x: 6, p: 0.3, rawWeight: 30 }
    ]
  },
  {
    id: 'stock_a',
    label: '股票 A 穩定型 {4, 5, 6}（μ = 5）',
    insight: '與股票 B 同樣平均報酬 μ = 5，但報酬緊貼重心，偏差方柱極小（σ² = 0.50、σ ≈ 0.71）。',
    beads: [
      { id: 'b0', x: 4, p: 0.25, rawWeight: 25 },
      { id: 'b1', x: 5, p: 0.5, rawWeight: 50 },
      { id: 'b2', x: 6, p: 0.25, rawWeight: 25 }
    ]
  },
  {
    id: 'stock_b',
    label: '股票 B 暴走型 {0, 10}（μ = 5）',
    insight: '打破「只看平均數」盲點：同樣 μ = 5，兩端遠離重心使方柱體積暴增 50 倍（σ² = 25、σ = 5）。',
    beads: [
      { id: 'b0', x: 0, p: 0.5, rawWeight: 50 },
      { id: 'b1', x: 10, p: 0.5, rawWeight: 50 }
    ]
  },
  {
    id: 'class_same',
    label: '全班考同分 {80}（無對立面）',
    insight: '全員皆為 80 分，沒有對立面就沒有偏差：所有方柱與標準差尺規歸零（σ² = 0、σ = 0）。',
    beads: [{ id: 'b0', x: 80, p: 1.0, rawWeight: 100 }]
  },
  {
    id: 'class_polar',
    label: '全班兩極化 {60, 100}（μ = 80）',
    insight: '平均同樣是 80 分，但一半 60 分、一半 100 分，瞬間繃出巨大張力（σ² = 400、σ = 20）。',
    beads: [
      { id: 'b0', x: 60, p: 0.5, rawWeight: 50 },
      { id: 'b1', x: 100, p: 0.5, rawWeight: 50 }
    ]
  },
  {
    id: 'quiz_a_sample',
    label: '經典練習題 {0, 3, 9}（50 / 25 / 25）',
    insight: '整數比例 50 : 25 : 25 精準呈現重心 μ = 3.00，恰好讓 x=3 那塊方柱歸零！',
    beads: [
      { id: 'b0', x: 0, p: 0.5, rawWeight: 50 },
      { id: 'b1', x: 3, p: 0.25, rawWeight: 25 },
      { id: 'b2', x: 9, p: 0.25, rawWeight: 25 }
    ]
  }
]);
