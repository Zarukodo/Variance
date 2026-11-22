/**
 * 新手互動教學引導課程表 V3.0（15 步聚光燈減法故事流）
 * 依據《人類專注力與認知負荷測試筆記》全面重構：
 * - 每一步只露出當下相關的最少 3D 元素與右側控制項，徹底避免劇透與多區搶焦點
 * - 消除與畫面按鈕重複的雙胞胎按鈕，統一以唯一發光焦點引導視線
 */

import { DATASET_PRESETS } from './presets.js';

function getPresetBeads(id) {
  const found = DATASET_PRESETS.find((p) => p.id === id);
  return found ? found.beads.map((b) => ({ ...b })) : [{ id: 'b0', x: 2, p: 0.2, rawWeight: 20 }];
}

export const TOUR_CHAPTERS = Object.freeze([
  { id: 'lever', label: '1.重心', startStep: 0 },
  { id: 'collapse', label: '2.塌縮', startStep: 3 },
  { id: 'sd', label: '3.尺規', startStep: 5 },
  { id: 'cut', label: '4.一刀切', startStep: 8 },
  { id: 'web', label: '5.引力網', startStep: 11 },
  { id: 'binom', label: '6.組合√n', startStep: 12 },
  { id: 'quiz', label: '7.盲測', startStep: 14 }
]);

export const TOUR_STEPS = [
  {
    id: 'v3-step-1-lever',
    chapter: '1.重心',
    title: '為什麼 70% 在 0 號位，重心 μ 卻是 0.30？',
    mentalImage: '只看翹翹板：左邊 0 號位比較重（70%），支點必須往重端靠，停在 0.30！',
    body: '先忘掉公式（我們也先把上方方柱藏起來）。把數線想成翹翹板：重的那端「力臂短」、輕的那端「力臂長」，看下方乘積：左 0.70×0.30 = 右 0.30×0.70 = 0.21，剛好平衡！試著拖右側滑桿看看支點怎麼跟著跑。',
    panelPolicy: { showFormula: false, showControlPanel: false, showDashboard: false, mod1Scope: ['pi'] },
    enter({ store, getActiveModule }) {
      store.setState({
        activeModule: 'mod1',
        bernoulliPi: 0.3,
        pivotOverride: null,
        cameraMode: 'perspective',
        formulaMode: 'symbolic',
        hoveredToken: null
      });
      setTimeout(() => {
        const mod = getActiveModule();
        mod?.setCollapsed?.(false, true);
        mod?.setPrismsVisible?.(false);
      }, 20);
    }
  },
  {
    id: 'v3-step-2-tilt',
    chapter: '1.重心',
    title: '把支點推歪會怎樣？（為什麼平均數 μ 不可取代）',
    mentalImage: '支點硬推到 0.70 時，翹翹板歪了，上方出現的「離散方柱」也膨脹了！',
    body: '現在讓方柱現身並把支點推歪到 a = 0.70：不僅翹翹板歪斜，上方測量離散程度的方柱總體積 I(a) 也從 0.2100 膨脹成 0.3700。試試右側滑桿回推到 0.30，你會發現只有 μ 能讓總體積縮到最小！',
    panelPolicy: { showFormula: true, showControlPanel: false, showDashboard: false, mod1Scope: ['pivot'] },
    enter({ store, getActiveModule }) {
      store.setState({
        activeModule: 'mod1',
        bernoulliPi: 0.3,
        pivotOverride: 0.7,
        cameraMode: 'perspective',
        formulaMode: 'symbolic',
        hoveredToken: null
      });
      setTimeout(() => {
        const mod = getActiveModule();
        mod?.setPrismsVisible?.(true);
        mod?.setCollapsed?.(false, true);
      }, 20);
    }
  },
  {
    id: 'v3-step-3-volume',
    chapter: '1.重心',
    title: '變異數 σ² 就是 3D「張力方柱」的總體積',
    mentalImage: '在地板畫「距離 × 距離」正方形抹掉正負號，再把「發生機率」當高度拉高。',
    body: '只算正負距離會互殺成 0，所以先在地板畫出「距離²」正方形，再乘上各自出現機率 P(x) 向上長出 3D 積木（看亮起的三邊尺寸）。兩塊方柱的體積加起來，就是變異數 σ² = 0.21！',
    panelPolicy: { showFormula: true, showControlPanel: false, showDashboard: false, mod1Scope: ['narration'] },
    enter({ store, getActiveModule }) {
      store.setState({
        activeModule: 'mod1',
        bernoulliPi: 0.3,
        pivotOverride: null,
        cameraMode: 'perspective',
        formulaMode: 'numeric',
        hoveredToken: 'bead0'
      });
      setTimeout(() => {
        const mod = getActiveModule();
        mod?.setPrismsVisible?.(true);
        mod?.setCollapsed?.(false, true);
      }, 20);
    }
  },
  {
    id: 'v3-step-4-myth-quiz',
    chapter: '2.塌縮',
    title: '先猜猜看：扭蛋 20% 中獎 vs 公平硬幣 50%，誰比較難猜（變異數大）？',
    mentalImage: '先別看數字！想像 0.20 × 0.80 的細長條，與 0.50 × 0.50 的正方形誰比較大？',
    body: '很多新手以為「20% 很偏很極端，變異數比較大吧？」我們已先把右側公式鎖住不劇透，請先點下方一個猜測再看結果！',
    panelPolicy: { showFormula: false, showControlPanel: false, showDashboard: false, mod1Scope: [] },
    enter({ store, getActiveModule }) {
      store.setState({
        activeModule: 'mod1',
        bernoulliPi: 0.2,
        pivotOverride: null,
        cameraMode: 'perspective',
        formulaMode: 'geometric',
        hoveredToken: null
      });
      setTimeout(() => {
        const mod = getActiveModule();
        mod?.setPrismsVisible?.(true);
        mod?.setCollapsed?.(false, true);
      }, 20);
    },
    quiz: {
      question: '猜猜看：哪一個的不確定性（變異數 σ²）比較大？',
      options: [
        { id: 'gacha', label: '扭蛋 20%（比較偏）', correct: false },
        { id: 'coin', label: '公平硬幣 50%（最難猜）', correct: true }
      ],
      feedbackCorrect: '✓ 答對了！50/50 最難猜，正方形 0.50×0.50 = 0.25 最大；20% 大多穩落在 0 那邊，面積只有 0.16！',
      feedbackWrong: '其實剛好相反！看積木與右側尺寸：20% 時大多穩落在 0（0.20×0.80 = 0.16）；50/50 最難猜、面積 0.25 最大！',
      onPick(optionId, { store, applyPanelPolicy }) {
        store.setState({ bernoulliPi: optionId === 'coin' ? 0.5 : 0.2, pivotOverride: null });
        applyPanelPolicy({ showFormula: true, showControlPanel: false, showDashboard: false, mod1Scope: ['presets', 'narration'] });
      }
    }
  },
  {
    id: 'v3-step-5-collapse',
    chapter: '2.塌縮',
    title: '兩塊不同形狀積木，怎麼翻轉 90° 就縫合成「厚度 1.00」？',
    mentalImage: '看閃爍的綠色側面：兩塊其實各自都有一面剛好是 0.30 × 0.70！',
    body: '看右側「積木長寬高」：0 號珠 [0.30×0.30×0.70] 與 1 號珠 [0.70×0.70×0.30] 都有一面 0.30×0.70！翻轉疊合後總厚恰好 1.00。現在請點擊舞台右上角發光的「從正上方平看 (2D 面積)」，看厚度 1 如何隱身在視線裡！',
    spotlightSelector: '#btn-camera-mode',
    panelPolicy: { showFormula: true, showControlPanel: false, showDashboard: false, mod1Scope: ['collapse', 'narration'] },
    enter({ store, getActiveModule }) {
      store.setState({
        activeModule: 'mod1',
        bernoulliPi: 0.3,
        pivotOverride: null,
        cameraMode: 'perspective',
        formulaMode: 'geometric',
        hoveredToken: 'collapsed'
      });
      setTimeout(() => {
        const mod = getActiveModule();
        mod?.setPrismsVisible?.(true);
        mod?.setCollapsed?.(false, true);
        setTimeout(() => mod?.setCollapsed?.(true, false), 60);
      }, 20);
    }
  },
  {
    id: 'v3-step-6-stocks',
    chapter: '3.尺規',
    title: '只看平均數會害你買錯股票：股票 A {4,5,6} vs 股票 B {0,10}',
    mentalImage: '兩支股票平均都賺 5 元，但股票 B 兩端拉遠 5 倍，平方後體積暴增 50 倍！',
    body: '離開只有 0 與 1 的世界來到多珠系統：股票 A 緊貼重心（σ² = 0.50）。點擊下方對比鈕切換成股票 B {0, 10}，同樣平均 μ = 5，方柱卻暴衝到 σ² = 25.00——這就是風險的空間形狀！',
    panelPolicy: { showFormula: true, showControlPanel: false, showDashboard: false, mod2Scope: ['narration'] },
    enter({ store, getActiveModule }) {
      store.setState({
        activeModule: 'mod2',
        cameraMode: 'perspective',
        formulaMode: 'numeric',
        pivotOverride: null,
        hoveredToken: null,
        beads: getPresetBeads('stock_a')
      });
      setTimeout(() => getActiveModule()?.setRecast?.(false, true), 20);
    },
    action: {
      label: '切換成暴走股票 B {0, 10} 對比！',
      altLabel: '切回穩健股票 A {4, 5, 6}',
      isActive: (state) => state.beads.length === 2 && state.beads[0].x === 0,
      run({ store }) {
        const isB = store.getState().beads.length === 2 && store.getState().beads[0].x === 0;
        store.setState({
          beads: getPresetBeads(isB ? 'stock_a' : 'stock_b'),
          pivotOverride: null
        });
      }
    }
  },
  {
    id: 'v3-step-7-recast-sd',
    chapter: '3.尺規',
    title: '標準差 σ：把不同高度的方柱，重鑄壓回一把「1D 尺規」',
    mentalImage: '三根方柱融進「厚度 1.00」的正方形模具，開根號就是取邊長 σ = 1.40！',
    body: '看舞台正在自動重鑄：把 {2, 4, 6} 的三塊方柱融進厚度 1.00 的正方形模具，面積 1.96 開根號得到邊長 σ = 1.40 掛在 μ ± σ！記住：μ ± σ 只是「典型波動寬度」尺規，不保證包住所有資料或佔 68%。',
    panelPolicy: { showFormula: true, showControlPanel: false, showDashboard: false, mod2Scope: ['recast', 'narration'] },
    enter({ store, getActiveModule }) {
      store.setState({
        activeModule: 'mod2',
        cameraMode: 'perspective',
        formulaMode: 'geometric',
        pivotOverride: null,
        hoveredToken: 'sigma',
        beads: getPresetBeads('small_int')
      });
      setTimeout(() => {
        const mod = getActiveModule();
        mod?.setRecast?.(false, true);
        setTimeout(() => mod?.setRecast?.(true, false), 40);
      }, 20);
    }
  },
  {
    id: 'v3-step-8-bridge-origin',
    chapter: '3.尺規',
    title: '關鍵伏筆：把支點一路推到原點 a = 0，多出來的體積就是 μ²！',
    mentalImage: '支點偏離重心多少，總體積就多膨脹 (μ − a)²。推到 a = 0 剛好就是膨脹 μ²！',
    body: '看右側的支點破壞實驗：支點推到原點 a = 0 時，槓桿歪斜、總體積膨脹為 I(0) = σ² + μ²（1.96 + 4.2² = 19.60）。記住這條線索，下一站「原點一刀切」就是把這多出來的 μ² 切掉！',
    spotlightSelector: '[data-role="btn-mod2-push-origin"]',
    panelPolicy: { showFormula: true, showControlPanel: false, showDashboard: false, mod2Scope: ['pivot', 'narration'] },
    enter({ store, getActiveModule }) {
      store.setState({
        activeModule: 'mod2',
        cameraMode: 'perspective',
        formulaMode: 'numeric',
        pivotOverride: 0,
        hoveredToken: null,
        beads: getPresetBeads('small_int')
      });
      setTimeout(() => getActiveModule()?.setRecast?.(false, true), 20);
    }
  },
  {
    id: 'v3-step-9-origin-build',
    chapter: '4.一刀切',
    title: '捷徑版（第 1 步）：先從原點 0 暴力蓋出大柱 Σx²P(x)',
    mentalImage: '懶得先求重心距離，直接用座標 2、4、6 蓋出三根總體積 19.60 的大柱子。',
    body: '這就是剛才在模組 2 把支點放到 a = 0 所產生的總體積 19.60！現在我們要把這些大柱子切開，親眼看看多出來的 17.64 到底藏在哪裡。',
    panelPolicy: { showFormula: true, showControlPanel: false, showDashboard: false },
    enter({ store }) {
      store.setState({
        activeModule: 'mod3',
        mod3SubMode: 'general',
        timelineStep: 0,
        formulaMode: 'numeric',
        hoveredToken: null,
        beads: getPresetBeads('small_int')
      });
    }
  },
  {
    id: 'v3-step-10-origin-explode',
    chapter: '4.一刀切',
    title: '捷徑版（第 2 步）：十字切開，認識「幽靈負側翼」與排容',
    mentalImage: '每個大柱拆出金色底座 μ²、兩條側翼 2μdᵢ，與角落翠綠純偏差 dᵢ²。',
    body: '當珠子小於重心（如 x=2 與 x=4），dᵢ 是負的，兩條紫羅蘭負側翼上浮；因為從 μ² 扣掉兩條負側翼會把角落重複扣兩次，所以角落 dᵢ² 必須加回一塊翠綠實心正塊！',
    panelPolicy: { showFormula: true, showControlPanel: false, showDashboard: false },
    enter({ store }) {
      store.setState({
        activeModule: 'mod3',
        mod3SubMode: 'general',
        timelineStep: 1,
        formulaMode: 'numeric',
        hoveredToken: null,
        beads: getPresetBeads('small_int')
      });
    }
  },
  {
    id: 'v3-step-11-origin-cut',
    chapter: '4.一刀切',
    title: '捷徑版（第 3→4 步）：正負側翼互殺蒸發，紅雷射切離 μ² 底座！',
    mentalImage: '側翼空中對撞歸零，金色 μ² 疊滿高度 1.00 後被紅雷射一刀切離，只剩 σ² = 1.96！',
    body: '看舞台自動播放第 3→4 步：正負側翼對撞蒸發成 0；所有金色 μ² 底座沿右側機率刻度尺疊滿 1.00 後被紅雷射水平切走，檯面只剩純變異數 1.96！',
    panelPolicy: { showFormula: true, showControlPanel: false, showDashboard: false },
    enter({ store }) {
      store.setState({
        activeModule: 'mod3',
        mod3SubMode: 'general',
        timelineStep: 2,
        formulaMode: 'numeric',
        hoveredToken: null,
        beads: getPresetBeads('small_int')
      });
      setTimeout(() => {
        if (store.getState().activeModule === 'mod3') {
          store.setState({ timelineStep: 3 });
        }
      }, 1550);
    },
    action: {
      label: '↺ 重看第 3 步對撞 → 第 4 步切割',
      run({ store }) {
        store.setState({ timelineStep: 2 });
        setTimeout(() => {
          if (store.getState().activeModule === 'mod3') {
            store.setState({ timelineStep: 3 });
          }
        }, 1550);
      }
    }
  },
  {
    id: 'v3-step-12-gravity-web',
    chapter: '5.引力網',
    title: '隱藏平均數：沒有「對立面」，就沒有偏差（破解 ½ 謎團）',
    mentalImage: '全班考 80 分時一片死寂；拉開成 {60, 100} 後，兩端脈衝在幾何中點融合。',
    body: '變異數其實不靠 μ 也能算！點下方把全班拉開成 {60, 100}（或直接拖曳球體）：雙重加總算了兩次配對，乘 ½ 讓脈衝在「幾何中點」融合——注意中點融合只代表去重 (×½)，不等於加權重心 μ！',
    panelPolicy: { showFormula: true, showControlPanel: false, showDashboard: false },
    enter({ store }) {
      store.setState({
        activeModule: 'mod4',
        formulaMode: 'symbolic',
        hoveredToken: null,
        beads: getPresetBeads('class_same')
      });
    },
    action: {
      label: '把全班拉開成兩極 {60, 100}',
      altLabel: '合攏成全員同分 {80}',
      isActive: (state) => state.beads.length === 2 && state.beads[0].x === 60,
      run({ store }) {
        const isPolar = store.getState().beads.length === 2 && store.getState().beads[0].x === 60;
        store.setState({
          beads: getPresetBeads(isPolar ? 'class_same' : 'class_polar')
        });
      }
    }
  },
  {
    id: 'v3-step-13-comb-tear',
    chapter: '6.組合√n',
    title: '撕掉順序標籤：為何 C(n, x) 要除以 x!，而不是除以 x？',
    mentalImage: '選出 3 個成功格時，內部有「①②③、①③②…」共 3! = 6 種重複編號，不只是 3 種！',
    body: '我們已切換到「① 路徑為何除 x!」單一焦點（暫時收起 3D 讓眼睛休息）：在 n=5 投進 x=3 球時，同一組 3 格有 3! = 6 種排列。點擊上方發光的「撕掉順序標籤」，看 6 條如何折疊為 1 條！',
    spotlightSelector: '[data-role="btn-tear-labels"]',
    panelPolicy: { showFormula: false, showControlPanel: false, showDashboard: false },
    enter({ store, getActiveModule }) {
      store.setState({
        activeModule: 'mod5',
        mod5Focus: 'comb',
        binomialN: 5,
        binomialX: 3,
        bernoulliPi: 0.5,
        showAtLeastOne: false,
        hoveredToken: 'comb'
      });
      setTimeout(() => getActiveModule()?.setLabelsTorn?.(false), 30);
    }
  },
  {
    id: 'v3-step-14-sqrt-n',
    chapter: '6.組合√n',
    title: '平方數實驗：看 n = 4 vs 9 次時，總次數 X 的變異數 ×n vs 標準差 ×√n',
    mentalImage: '投 9 球就在舞台並排 9 塊方塊（總體積變 9 倍），但正方形開根號邊長只變 √9 = 3 倍！',
    body: '現在切換到全螢幕 3D 舞台專心看倍率（π = 0.50）：n = 4 時 4 塊積木讓「總成功次數 X」變異數 σ² = 1.00（×4），尺規 σ = 1.00（×2）；點下方切換 n = 9，體積暴增 9 倍，但尺規只放大 √9 = 3 倍（注意平均命中率 X/n 反而會縮小為 1/√n）！',
    panelPolicy: { showFormula: false, showControlPanel: false, showDashboard: false },
    enter({ store }) {
      store.setState({
        activeModule: 'mod5',
        mod5Focus: 'scaling',
        binomialN: 4,
        binomialX: 2,
        bernoulliPi: 0.5,
        showAtLeastOne: false,
        hoveredToken: 'sd_n'
      });
    },
    action: {
      label: '切換成 n = 9 比較（×9 vs ×3）',
      altLabel: '切回 n = 4 比較（×4 vs ×2）',
      isActive: (state) => state.binomialN === 9,
      run({ store }) {
        const is9 = store.getState().binomialN === 9;
        store.setState({
          binomialN: is9 ? 4 : 9,
          binomialX: is9 ? 2 : 4,
          bernoulliPi: 0.5
        });
      }
    }
  },
  {
    id: 'v3-step-15-graduation',
    chapter: '7.盲測',
    title: '🎯 畢業挑戰：先自己手算預測，再用 3D 舞台開獎驗算！',
    mentalImage: '遮住答案算算看：只要算得出 μ、σ²、σ 與路徑數，就代表大腦真的建好模型了！',
    body: '最後一關我們把算式先遮起來！試試看用剛才建立的空間畫面，在右側手算填入「題型 A（{0, 3, 9}）」與「題型 B（n=5, π=0.2）」的預測值，按下「揭曉答案並在 3D 舞台驗證」看自己是不是一發命中！',
    panelPolicy: { showFormula: false, showControlPanel: false, showDashboard: false },
    enter({ store }) {
      store.setState({
        activeModule: 'mod6',
        hoveredToken: null
      });
    }
  }
];
