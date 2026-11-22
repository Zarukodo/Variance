/**
 * 新手教學引導課程表（12 步建立完整空間直覺）
 * 目標：帶零基礎學習者從「槓桿重心」一路建立到「二項路徑與 √n 尺度」，
 * 每一步皆同步驅動 3D 舞台、動畫與對比實驗，讓大腦先看見形狀再看懂公式。
 */

import { DATASET_PRESETS } from './presets.js';

function getPresetBeads(id) {
  const found = DATASET_PRESETS.find((p) => p.id === id);
  return found ? found.beads.map((b) => ({ ...b })) : [{ id: 'b0', x: 2, p: 0.2 }];
}

export const TOUR_CHAPTERS = Object.freeze([
  { id: 'lever', label: '1. 重心與張力', startStep: 0 },
  { id: 'collapse', label: '2. 雙珠塌縮', startStep: 3 },
  { id: 'sd', label: '3. 股票與尺規', startStep: 4 },
  { id: 'cut', label: '4. 原點一刀切', startStep: 7 },
  { id: 'web', label: '5. 對立引力網', startStep: 9 },
  { id: 'binom', label: '6. 路徑與 √n', startStep: 10 }
]);

export const TOUR_STEPS = [
  {
    id: 'step-1-lever',
    chapter: '1. 重心與張力',
    title: '先把「平均數 μ」想成一根翹翹板的支點',
    mentalImage: '左邊 0 號位站了 70% 的珠子，右邊 1 號位只有 30% 的珠子。',
    body: '先忘掉課本公式！把數線當成翹翹板，發生機率就是重量。為了不讓較重的左邊壓垮板子，黃金支點 μ 必須往左移動，精準停在 0.30 才能維持水平平衡。',
    enter({ store, getActiveModule }) {
      store.setState({
        activeModule: 'mod1',
        bernoulliPi: 0.3,
        pivotOverride: null,
        cameraMode: 'perspective',
        hoveredToken: null
      });
      setTimeout(() => getActiveModule()?.setCollapsed?.(false, true), 30);
    }
  },
  {
    id: 'step-2-tilt',
    chapter: '1. 重心與張力',
    title: '為什麼不能隨便選一個中心點？（支點破壞實驗）',
    mentalImage: '刻意把黃金支點往右推到 0.70，翹翹板歪了、上方方柱也膨脹了。',
    body: '我們硬把支點推歪到 a = 0.70，翹翹板立刻傾斜，上方用來衡量「離散張力」的方柱總體積也從 0.2100 膨脹成 0.3700！平均數 μ 的真正意義，是全宇宙唯一讓「總偏離體積最小」的平衡點。',
    enter({ store, getActiveModule }) {
      store.setState({
        activeModule: 'mod1',
        bernoulliPi: 0.3,
        pivotOverride: 0.7,
        cameraMode: 'perspective',
        hoveredToken: null
      });
      setTimeout(() => getActiveModule()?.setCollapsed?.(false, true), 30);
    }
  },
  {
    id: 'step-3-volume',
    chapter: '1. 重心與張力',
    title: '變異數 σ² 就是「張力方柱」的總體積',
    mentalImage: '先在地板用「距離 × 距離」畫正方形，再乘上自身機率高度向上長高。',
    body: '直接算有正有負的距離會互殺成 0，所以我們在地板畫「距離²」的正方形抹除正負號，再把每顆珠子的出現機率當成高度拉出 3D 積木（看亮起的稜邊標籤）。所有方柱體積加總，就是變異數 σ²！',
    enter({ store, getActiveModule }) {
      store.setState({
        activeModule: 'mod1',
        bernoulliPi: 0.3,
        pivotOverride: null,
        cameraMode: 'perspective',
        hoveredToken: 'bead0'
      });
      setTimeout(() => getActiveModule()?.setCollapsed?.(false, true), 30);
    }
  },
  {
    id: 'step-4-collapse',
    chapter: '2. 雙珠塌縮',
    title: '為什麼單次成功/失敗，課本只寫成扁平的 π(1−π)？',
    mentalImage: '兩塊 3D 積木各翻轉 90°，竟然剛好縫合成一塊「厚度 = 1.00」的卡片！',
    body: '並非單次二項沒有機率高度，而是 0 與 1 跨距剛好為 1，翻轉拼合後垂直厚度 π + (1−π) 恰好縫合成 1.00！試試點右側按鈕切換「2D 俯視」，厚度 1 隱身在視線裡，體積數值就跟 2D 面積重疊了。',
    enter({ store, getActiveModule }) {
      store.setState({
        activeModule: 'mod1',
        bernoulliPi: 0.3,
        pivotOverride: null,
        cameraMode: 'perspective',
        hoveredToken: 'collapsed'
      });
      setTimeout(() => getActiveModule()?.setCollapsed?.(false, true), 20);
      setTimeout(() => getActiveModule()?.setCollapsed?.(true, false), 140);
    },
    action: {
      label: '切換 2D 俯視（正交錯覺）',
      altLabel: '切回 3D 透視看厚度 1.00',
      isActive: (state) => state.cameraMode === 'orthographic',
      run({ store }) {
        const next = store.getState().cameraMode === 'orthographic' ? 'perspective' : 'orthographic';
        store.setCameraMode(next);
      }
    }
  },
  {
    id: 'step-5-stock-a',
    chapter: '3. 股票與尺規',
    title: '只看平均數的陷阱：先看穩健的「股票 A」',
    mentalImage: '報酬集中在 4、5、6 元，方柱緊貼重心、個頭小小一團。',
    body: '離開只有 0 與 1 的世界，我們來到多珠系統。股票 A 平均報酬 μ = 5 元，大家距離重心都很近，方柱總體積只有 0.50，這代表風險極低。記住這個小方柱畫面，下一步我們要看反差！',
    enter({ store, getActiveModule }) {
      store.setState({
        activeModule: 'mod2',
        cameraMode: 'perspective',
        pivotOverride: null,
        hoveredToken: null,
        beads: getPresetBeads('stock_a')
      });
      setTimeout(() => getActiveModule()?.setRecast?.(false, true), 40);
    }
  },
  {
    id: 'step-6-stock-b',
    chapter: '3. 股票與尺規',
    title: '同樣平均 μ = 5，暴走「股票 B」體積暴增 50 倍！',
    mentalImage: '翹翹板支點一樣在 5，但珠子拉開到 0 與 10，地板正方形瞬間炸大。',
    body: '股票 B 一半賠光 (0)、一半大賺 (10)，平均一樣是 5 元！但因為距離拉大 5 倍、平方後底面積暴增 25 倍，總變異數飆升至 25.00。這就是為什麼「平均相同，風險卻天差地遠」。',
    enter({ store, getActiveModule }) {
      store.setState({
        activeModule: 'mod2',
        cameraMode: 'perspective',
        pivotOverride: null,
        hoveredToken: null,
        beads: getPresetBeads('stock_b')
      });
      setTimeout(() => getActiveModule()?.setRecast?.(false, true), 40);
    },
    action: {
      label: '切回股票 A {4,5,6} 對比',
      altLabel: '切回暴走股票 B {0,10}',
      isActive: (state) => state.beads.length === 3,
      run({ store }) {
        const isA = store.getState().beads.length === 3;
        store.setState({
          beads: getPresetBeads(isA ? 'stock_b' : 'stock_a'),
          pivotOverride: null
        });
      }
    }
  },
  {
    id: 'step-7-recast-sd',
    chapter: '3. 股票與尺規',
    title: '標準差 σ：把變異數體積「開根號」壓回一把尺',
    mentalImage: '把散落方柱融化重鑄成「厚度 1 的正方形」，再撕下底邊當成紫羅蘭尺規。',
    body: '變異數是平方後的面積／體積，單位跟原分數不同。看舞台中央動畫：我們把所有方柱壓成厚度 1 的正方形薄板，開根號就是取它的「邊長 σ = 1.40」，變成掛在重心左右 μ ± σ 的一維尺規！',
    enter({ store, getActiveModule }) {
      store.setState({
        activeModule: 'mod2',
        cameraMode: 'perspective',
        pivotOverride: null,
        hoveredToken: 'sigma',
        beads: getPresetBeads('small_int')
      });
      setTimeout(() => getActiveModule()?.setRecast?.(false, true), 20);
      setTimeout(() => getActiveModule()?.setRecast?.(true, false), 140);
    }
  },
  {
    id: 'step-8-origin-build',
    chapter: '4. 原點一刀切',
    title: '捷徑版 Σx²P(x) − μ²：先從 0 號原點暴力蓋大柱',
    mentalImage: '懶得先算重心距離？那就直接用座標 2、4、6 蓋出三根超大柱子。',
    body: '實戰計算時若先求 μ 再減很麻煩，於是改從原點 0 出發直接蓋出 Σx²P(x) = 19.60！不過這些大柱比我們要的變異數大很多，到底多蓋了什麼？按「下一步」用十字雷射切開它！',
    enter({ store }) {
      store.setState({
        activeModule: 'mod3',
        mod3SubMode: 'general',
        timelineStep: 0,
        hoveredToken: null,
        beads: getPresetBeads('small_int')
      });
    }
  },
  {
    id: 'step-9-origin-cut',
    chapter: '4. 原點一刀切',
    title: '十字拆解：側翼對撞蒸發，紅雷射一刀削去底座 μ²',
    mentalImage: '每個大柱切出黃金底座 μ²、兩條正負側翼，與角落翠綠純偏差 d²。',
    body: '看舞台上 x=2（小於重心）的紫羅蘭幽靈負側翼，與 x=6 的翠綠正側翼：點右側「推進到對撞並切割」你會看見正負側翼空中互殺歸零，金色 μ² 疊滿高度 1.00 後被一刀削走，只剩純變異數 1.96！',
    enter({ store }) {
      store.setState({
        activeModule: 'mod3',
        mod3SubMode: 'general',
        timelineStep: 1,
        hoveredToken: null,
        beads: getPresetBeads('small_int')
      });
    },
    action: {
      label: '▶ 推進步驟：對撞蒸發 → 雷射切割',
      altLabel: '↺ 回到第 2 步爆炸視圖',
      isActive: (state) => state.timelineStep >= 3,
      run({ store }) {
        const step = store.getState().timelineStep;
        if (step >= 3) {
          store.setState({ timelineStep: 1 });
        } else {
          store.setState({ timelineStep: 2 });
          setTimeout(() => {
            if (store.getState().activeModule === 'mod3') {
              store.setState({ timelineStep: 3 });
            }
          }, 1500);
        }
      }
    }
  },
  {
    id: 'step-10-gravity-web',
    chapter: '5. 對立引力網',
    title: '隱藏平均數：沒有「對立面」，就沒有偏差！',
    mentalImage: '全班考同分 80 分時一片死寂；一旦拉開差距，兩兩之間立刻繃出張力光束。',
    body: '其實變異數根本不依賴「平均數」這個人造座標！全班都考 80 分時無人對立，引力網全滅；點擊右側按鈕把一半同學拉開成 {60, 100}（或直接在 3D 地板左右拖曳球體），你會看見兩端脈衝在中點融合（公式 ½ 的由來）！',
    enter({ store }) {
      store.setState({
        activeModule: 'mod4',
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
    id: 'step-11-comb-tear',
    chapter: '6. 路徑與 √n',
    title: '為什麼組合數 C(n, x) 要除以 x!，而不是除以 x？',
    mentalImage: '罰球 4 球進 2 球：原本貼著「①、②」編號的 2! 條排列，撕掉標籤後其實一模一樣！',
    body: '看上方路徑區：選出 2 個成功格後，因為我們不在乎「誰先投進」，原本 ✓1✓2 與 ✓2✓1 這 x! = 2! 種內部編號其實是同一條路徑！試著點右側「幫我撕掉順序標籤」，親眼看它們折疊成 1 條。',
    enter({ store, getActiveModule }) {
      store.setState({
        activeModule: 'mod5',
        binomialN: 4,
        binomialX: 2,
        bernoulliPi: 0.7,
        showAtLeastOne: false,
        hoveredToken: 'comb'
      });
      setTimeout(() => getActiveModule()?.setLabelsTorn?.(false), 30);
    },
    action: {
      label: '幫我撕掉順序標籤試試！',
      altLabel: '貼回 ①② 順序標籤對照',
      isActive: ({ getActiveModule }) => Boolean(getActiveModule()?._labelsTorn),
      run({ getActiveModule }) {
        const mod = getActiveModule();
        if (mod && typeof mod.setLabelsTorn === 'function') {
          mod.setLabelsTorn(!mod._labelsTorn);
        }
      }
    }
  },
  {
    id: 'step-12-sqrt-n',
    chapter: '6. 路徑與 √n',
    title: '獨立重複 n 次：變異數放大 n 倍，標準差只放大 √n 倍',
    mentalImage: '每多投一球，就像在舞台上多並排 1 塊單次塌縮長方體。',
    body: '看向下方 3D 舞台：投 6 球時，6 塊獨立的單次塌縮長方體並排站立，總體積（變異數 σ²）線性放大 6 倍；但開根號回到紫羅蘭 1D 尺規時，邊長只放大 √6 ≈ 2.45 倍！恭喜你，已掌握統計學最重要的空間直覺！',
    enter({ store }) {
      store.setState({
        activeModule: 'mod5',
        binomialN: 6,
        binomialX: 3,
        bernoulliPi: 0.5,
        showAtLeastOne: false,
        hoveredToken: 'sd_n'
      });
    }
  }
];
