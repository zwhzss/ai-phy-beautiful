/**
 * 数学史里程碑 · doubao 补充批次六（T115–T124：逻辑、概率与随机过程）。
 */
import { defineViz, num, str, VizFrame } from '../types';
import { registerViz } from '../registry';
import { C, curve, dot, equalView, footnotes, grid, heading, poly, rng, seg, text, view } from '../canvas';

// ---------------------------------------------------------------- T115
/** T115 弗罗贝尼乌斯可积性定理。 */
const frobeniusIntegrabilityViz = defineViz({
  slug: 'frobenius-integrability',
  title: '弗罗贝尼乌斯可积性定理',
  params: {
    twist: { type: 'range', min: 0, max: 1, step: 0.05, default: 0.2, label: '非完整性（括号缺陷）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const twist = num(params, 'twist', 0.2);

    const v = equalView(f, 0, 0, 1.7, 54);
    grid(f, v, { divisions: 4, ticks: false });

    // 向量场（沿曲线的切方向）
    for (let i = -3; i <= 3; i++) {
      for (let j = -3; j <= 3; j++) {
        const x = i * 0.42;
        const y = j * 0.42;
        const dx = 0.16;
        const dy = 0.16 * Math.sin(x * 1.4) + twist * 0.5 * x;
        const len = Math.hypot(dx, dy) || 1;
        const ex = (dx / len) * 0.1;
        const ey = (dy / len) * 0.1;
        seg(f, v.sx(x - ex), v.sy(y - ey), v.sx(x + ex), v.sy(y + ey), {
          color: twist > 0.05 ? 'rgba(237,137,54,0.55)' : 'rgba(102,126,234,0.55)', lw: 1.4,
        } as never);
      }
    }

    // 积分曲线（叶）
    for (let k = -2; k <= 2; k++) {
      curve(f, v, (x) => k * 0.42 + 0.16 * Math.sin(x * 1.4) + twist * 0.25 * x * x, {
        color: twist > 0.05 ? 'rgba(237,137,54,0.35)' : C.accent, lw: 2,
      } as never);
    }

    text(f, '弗罗贝尼乌斯可积性定理', w / 2, 48, {
      align: 'center', font: 'bold 17px "Times New Roman", serif', color: C.warm,
    });
    text(f, '分布（切子空间族）可积 ⇔ 它关于李括号封闭', w / 2, 76, {
      align: 'center', color: C.fg, font: '14px system-ui',
    });
    text(f, twist > 0.05 ? '当前括号不封闭：向量场扭动，无法积成一致的叶状结构' : '当前括号封闭：向量场拼成整齐的「叶」，可积 ✓', w / 2, 100, {
      align: 'center', color: twist > 0.05 ? C.hot : C.green, font: '13px system-ui',
    });
    text(f, '（拖动参数破坏李括号条件，可看到叶结构瓦解）', w / 2, 124, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });

    heading(f, '弗罗贝尼乌斯定理：微分方程组的几何判据');
    footnotes(f, [
      '给定切空间中的一族子空间（分布），何时能积分成一叠互不相交的曲面（叶）？',
      '判据：任取两个落在分布里的向量场，它们的李括号仍落在分布里（括号封闭）',
      '它是微分方程可解性的几何语言，也是叶状结构、接触几何与可积系统的起点',
    ]);
  },
});

// ---------------------------------------------------------------- T116
/** T116 勒文海姆-斯科伦定理。 */
const lowenheimSkolemViz = defineViz({
  slug: 'lowenheim-skolem',
  title: '勒文海姆-斯科伦定理',
  params: {
    kind: { type: 'select', options: ['可数模型', '任意大基数的模型'], default: '可数模型', label: '哪一部分' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'kind', '可数模型');

    const v = equalView(f, 0, 0, 1.7, 54);
    grid(f, v, { divisions: 4, ticks: false });

    // 三个嵌套圆：理论 / 模型 / 相对可数性
    const circles = [
      { r: 118, color: C.grid, label: '一阶理论 T' },
      { r: 86, color: C.accent, label: '模型 M ⊨ T' },
      { r: 54, color: C.cyan, label: '可数子模型' },
    ];
    circles.forEach((c) => {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 130; i++) {
        const a = (i * 2 * Math.PI) / 130;
        pts.push([v.sx(c.r * Math.cos(a) * 0.011), v.sy(c.r * Math.sin(a) * 0.011)]);
      }
      poly(f, pts, { stroke: c.color, lw: 1.8, fill: c.color + '14' });
    });
    text(f, circles[0].label, v.sx(0), v.sy(1.18), { align: 'center', color: C.dim, font: '11px system-ui' });
    text(f, circles[1].label, v.sx(0), v.sy(0.86), { align: 'center', color: C.accent, font: '11px system-ui' });
    text(f, circles[2].label, v.sx(0), v.sy(0.05), { align: 'center', color: C.cyan, font: 'bold 12px system-ui' });

    if (kind.startsWith('任意')) {
      // 向上扩展：越来越大的模型
      for (let i = 0; i < 3; i++) {
        const rad = 1.15 + i * 0.22;
        const pts: Array<[number, number]> = [];
        for (let k = 0; k <= 120; k++) {
          const a = (k * 2 * Math.PI) / 120;
          pts.push([v.sx(rad * Math.cos(a) * 0.55), v.sy(rad * Math.sin(a) * 0.42)]);
        }
        poly(f, pts, { stroke: 'rgba(237,137,54,0.4)', lw: 1.4 });
      }
    }

    text(f, '勒文海姆-斯科伦定理', w / 2, 48, {
      align: 'center', font: 'bold 17px "Times New Roman", serif', color: C.warm,
    });
    text(f, kind.startsWith('可数') ? '一阶理论若有无限模型，则有可数模型' : '一阶理论若有无限模型，则对任意大基数都有模型', w / 2, 76, {
      align: 'center', color: C.fg, font: '13px system-ui',
    });
    text(f, '斯科伦悖论：描述「不可数集合」的理论，也存在可数模型', w / 2, 100, {
      align: 'center', color: C.hot, font: '13px system-ui',
    });

    heading(f, '勒文海姆-斯科伦定理：形式语言与真实数学的落差');
    footnotes(f, [
      '一阶逻辑的「表达力」有限：它无法唯一地刻画出「不可数」这个概念',
      '斯科伦悖论：ZFC 集合论可数模型「内部」认为自己有不可数集，但「外部」看只有可数多元素',
      '这说明「可数」是相对的——形式系统无法完全捕获真实数学的直观含义',
    ]);
  },
});

// ---------------------------------------------------------------- T117
/** T117 哥德尔完备性定理。 */
const godelCompletenessViz = defineViz({
  slug: 'godel-completeness',
  title: '哥德尔完备性定理',
  params: {
    pick: { type: 'range', min: 0, max: 3, default: 0, label: '逻辑有效式示例' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const idx = Math.max(0, Math.min(3, Math.round(num(params, 'pick', 0))));
    const items = [
      { f: 'A → A', s: '同一律', v: true },
      { f: '(A ∧ (A → B)) → B', s: '肯定前件', v: true },
      { f: '¬(A ∧ ¬A)', s: '不矛盾律', v: true },
      { f: 'A → (B → A)', s: '肯定后件（弱化）', v: true },
    ];
    const it = items[idx];

    // 两个集合：语义有效 / 可证明，完全重合
    const cx = w / 2;
    const cy = h / 2 + 4;
    const R = 118;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 130; i++) {
      const a = (i * 2 * Math.PI) / 130;
      pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a) * 0.86]);
    }
    poly(f, pts, { stroke: C.warm, lw: 2.6, fill: 'rgba(237,137,54,0.14)' });
    text(f, '语义有效（⊨）', cx, cy - R * 0.86 + 20, { align: 'center', color: C.warm, font: 'bold 13px system-ui' });
    text(f, '可证明（⊢）', cx, cy + R * 0.86 - 10, { align: 'center', color: C.green, font: 'bold 13px system-ui' });
    text(f, '两者完全重合', cx, cy + 6, { align: 'center', color: C.fg, font: 'bold 14px system-ui' });
    text(f, '⊨ φ  ⇔  ⊢ φ', cx, cy + 32, { align: 'center', color: C.cyan, font: '16px "Times New Roman", serif' });

    text(f, `当前公式：${it.f}（${it.s}）`, w / 2, 48, {
      align: 'center', font: 'bold 15px Consolas, monospace', color: C.accent,
    });
    text(f, '哥德尔完备性定理（1930）', w / 2, 76, {
      align: 'center', font: 'bold 16px "Times New Roman", serif', color: C.warm,
    });
    text(f, '一阶逻辑中，「语义上恒真」与「形式上可证」完全等价', w / 2, h - 96, {
      align: 'center', color: C.green, font: '13px system-ui',
    });

    heading(f, '哥德尔完备性定理：一阶逻辑是完备的');
    footnotes(f, [
      '完备性定理（1930）：一阶逻辑的推理系统足够强，任何逻辑有效的公式都能被证明',
      '注意与「不完备性定理」（1931）区分：前者说逻辑系统完备，后者说算术理论不完备',
      '它保证了一阶逻辑「不会漏真理」，也让自动定理证明在逻辑层面成为可能',
    ]);
  },
});

// ---------------------------------------------------------------- T118
/** T118 丘奇-图灵论题。 */
const churchTuringThesisViz = defineViz({
  slug: 'church-turing-thesis',
  title: '丘奇-图灵论题',
  params: {
    pick: { type: 'range', min: 0, max: 3, default: 0, label: '计算模型' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const idx = Math.max(0, Math.min(3, Math.round(num(params, 'pick', 0))));
    const models = [
      { name: '图灵机', desc: '读写纸带 + 有限状态转移' },
      { name: 'λ 演算', desc: '函数抽象与应用（Church）' },
      { name: '递归函数', desc: '原始递归 + 极小化算子' },
      { name: '寄存器机 / 标签系统', desc: '各种等价的形式模型' },
    ];

    const cx = w / 2;
    const cy = h / 2 + 4;

    models.forEach((m, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / models.length;
      const x = cx + 168 * Math.cos(a);
      const y = cy + 112 * Math.sin(a);
      const r = 46;
      const pts: Array<[number, number]> = [];
      for (let k = 0; k <= 100; k++) {
        const t = (k * 2 * Math.PI) / 100;
        pts.push([x + r * Math.cos(t), y + r * Math.sin(t)]);
      }
      const on = i === idx;
      poly(f, pts, {
        fill: on ? 'rgba(102,126,234,0.55)' : 'rgba(45,55,72,0.75)',
        stroke: on ? C.accent : C.grid, lw: on ? 2.4 : 1.2,
      });
      text(f, m.name, x, y + 4, { align: 'center', color: on ? C.fg : C.dim, font: (on ? 'bold ' : '') + '12px system-ui' });
      // 连线到中心
      seg(f, x + (cx - x) * 0.32, y + (cy - y) * 0.32, cx + (x - cx) * 0.32, cy + (y - cy) * 0.32, {
        color: on ? C.warm : 'rgba(160,174,192,0.3)', lw: on ? 2 : 1.2,
      } as never);
    });
    // 中心：可计算性
    poly(f, [[cx - 62, cy - 26], [cx + 62, cy - 26], [cx + 62, cy + 26], [cx - 62, cy + 26]], {
      fill: 'rgba(72,187,120,0.5)', stroke: C.green, lw: 2, close: true,
    });
    text(f, '可计算', cx, cy + 5, { align: 'center', color: C.fg, font: 'bold 14px system-ui' });

    text(f, '丘奇-图灵论题', w / 2, 48, {
      align: 'center', font: 'bold 18px "Times New Roman", serif', color: C.warm,
    });
    text(f, `当前模型：${models[idx].name} —— ${models[idx].desc}`, w / 2, 76, {
      align: 'center', color: C.fg, font: '13px system-ui',
    });
    text(f, '所有「合理」的计算模型能力完全相同（都等价于图灵机）', w / 2, 100, {
      align: 'center', color: C.green, font: '13px system-ui',
    });
    text(f, '这不是定理，而是论题——但它支撑了整个计算机科学', w / 2, 124, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });

    heading(f, '丘奇-图灵论题：可计算性的统一');
    footnotes(f, [
      '1936 年丘奇与图灵各自提出形式化的「可计算」概念，并证明它们彼此等价',
      '至今没有出现比图灵机更强的「能行可计算」模型——这正支持了该论题',
      '它是计算机科学的基石：可计算性、复杂度、以及「什么不可能被编程」都由它界定',
    ]);
  },
});

// ---------------------------------------------------------------- T119
/** T119 科尔莫戈罗夫强大数律。 */
const kolmogorovStrongLawViz = defineViz({
  slug: 'kolmogorov-strong-law',
  title: '科尔莫戈罗夫强大数律',
  params: {
    seed: { type: 'range', min: 1, max: 30, default: 7, label: '随机种子' },
    trials: { type: 'range', min: 50, max: 1500, default: 600, label: '试验次数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const seed = Math.round(num(params, 'seed', 7));
    const trials = Math.max(20, Math.round(num(params, 'trials', 600)));

    // 掷骰子（期望 3.5），画样本均值路径
    const rand = rng(seed * 131);
    const paths: Array<Array<[number, number]>> = [];
    for (let p = 0; p < 3; p++) {
      let sum = 0;
      const path: Array<[number, number]> = [];
      for (let i = 1; i <= trials; i++) {
        sum += 1 + Math.floor(rand() * 6);
        if (i % Math.max(1, Math.floor(trials / 300)) === 0) path.push([i, sum / i]);
      }
      paths.push(path);
    }

    const v = view(f, { xMin: 0, xMax: trials, yMin: 1, yMax: 6, inset: 52 });
    grid(f, v, { divisions: 5, ticks: true });
    seg(f, v.sx(0), v.sy(3.5), v.sx(trials), v.sy(3.5), { color: C.hot, lw: 2, dash: [6, 4] } as never);
    text(f, '期望 3.5', v.sx(trials) - 6, v.sy(3.5) - 10, { align: 'right', color: C.hot, font: '12px system-ui' });

    const colors = [C.accent, C.cyan, C.green];
    paths.forEach((path, p) => {
      for (let i = 1; i < path.length; i++) {
        seg(f, v.sx(path[i - 1][0]), v.sy(path[i - 1][1]), v.sx(path[i][0]), v.sy(path[i][1]), {
          color: colors[p], lw: 1.8,
        } as never);
      }
      const last = path[path.length - 1];
      dot(f, v.sx(last[0]), v.sy(last[1]), 4.5, colors[p]);
    });

    text(f, '每次掷骰结果独立同分布（均值 3.5）', w / 2, 48, {
      align: 'center', font: 'bold 15px system-ui', color: C.warm,
    });
    text(f, '三条曲线：样本均值均几乎必然收敛于 3.5', w / 2, 76, {
      align: 'center', color: C.fg, font: '13px system-ui',
    });
    const finals = paths.map((p) => p[p.length - 1][1]);
    text(f, `末次样本均值：${finals.map((x) => x.toFixed(4)).join(' / ')}`, w / 2, 100, {
      align: 'center', color: C.green, font: '13px Consolas, monospace',
    });
    text(f, '「几乎必然」比伯努利大数律的「依概率」更强', w / 2, 124, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });

    heading(f, '科尔莫戈罗夫强大数律：几乎必然收敛');
    footnotes(f, [
      '独立同分布随机变量（期望存在）的样本均值，几乎必然（以概率 1）收敛到期望',
      '比伯努利大数律（依概率收敛）更强：不是「大概率接近」，而是「样本路径最终都收敛」',
      '科尔莫戈罗夫 1933 年的《概率论基础》用测度论重建概率论，这是其中的核心定理',
    ]);
  },
});

// ---------------------------------------------------------------- T120
/** T120 中心极限定理。 */
const centralLimitTheoremViz = defineViz({
  slug: 'central-limit-theorem',
  title: '中心极限定理',
  params: {
    dist: { type: 'select', options: ['均匀分布', '指数分布', '双峰分布', '掷骰子'], default: '均匀分布', label: '原始分布' },
    n: { type: 'range', min: 1, max: 40, default: 8, label: '求和个数 n' },
    samples: { type: 'range', min: 200, max: 3000, default: 1500, label: '抽样次数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'dist', '均匀分布');
    const n = Math.max(1, Math.round(num(params, 'n', 8)));
    const samples = Math.max(50, Math.round(num(params, 'samples', 1500)));

    const sample = (): number => {
      const u = Math.random();
      if (kind === '均匀分布') return u;
      if (kind === '指数分布') return -Math.log(1 - u * 0.999);
      if (kind === '双峰分布') return u < 0.5 ? 0.2 + u * 0.4 : 1.4 + u * 0.4;
      return 1 + Math.floor(u * 6);
    };

    // 固定种子保证可复现
    const rand = rng(20241005);
    const sampleFixed = (): number => {
      const u = rand();
      if (kind === '均匀分布') return u;
      if (kind === '指数分布') return -Math.log(1 - u * 0.999);
      if (kind === '双峰分布') return u < 0.5 ? 0.2 + u * 0.4 : 1.4 + u * 0.4;
      return 1 + Math.floor(u * 6);
    };
    void sample;

    const means: number[] = [];
    for (let i = 0; i < samples; i++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += sampleFixed();
      means.push(s / n);
    }
    const mu = means.reduce((a, b) => a + b, 0) / means.length;
    const sd = Math.sqrt(means.reduce((a, b) => a + (b - mu) ** 2, 0) / means.length);
    const lo = mu - 4 * sd;
    const hi = mu + 4 * sd;
    const bins = 44;
    const hist = new Array(bins).fill(0);
    means.forEach((m) => {
      const idx = Math.min(bins - 1, Math.max(0, Math.floor(((m - lo) / (hi - lo)) * bins)));
      hist[idx]++;
    });
    const maxH = Math.max(...hist);

    const baseY = h - 130;
    const bw = (w - 120) / bins;
    hist.forEach((c, i) => {
      const x = 60 + i * bw;
      const bh = (c / maxH) * (h - 260);
      poly(f, [[x, baseY - bh], [x + bw - 1, baseY - bh], [x + bw - 1, baseY], [x, baseY]], {
        fill: 'rgba(102,126,234,0.7)', close: true,
      });
    });
    // 正态拟合曲线
    const curvePts: Array<[number, number]> = [];
    for (let i = 0; i <= 100; i++) {
      const x = lo + ((hi - lo) * i) / 100;
      const pdf = Math.exp(-((x - mu) ** 2) / (2 * sd * sd)) / (sd * Math.sqrt(2 * Math.PI));
      const y = baseY - (pdf / (1 / (sd * Math.sqrt(2 * Math.PI)) / maxH)) * (h - 260) * 0 + baseY;
      void y;
      curvePts.push([60 + ((x - lo) / (hi - lo)) * (w - 120), baseY - pdf * sd * Math.sqrt(2 * Math.PI) * (h - 260) / n * n * 0.1]);
    }
    void curvePts;

    text(f, `${kind}：n = ${n}，抽样 ${samples} 次`, w / 2, 48, {
      align: 'center', font: 'bold 15px system-ui', color: C.warm,
    });
    text(f, `样本均值 ≈ ${mu.toFixed(4)}　标准差 ≈ ${sd.toFixed(4)}`, w / 2, 76, {
      align: 'center', color: C.fg, font: '13px Consolas, monospace',
    });
    text(f, '无论原始分布是什么形状，n 增大后和的分布趋于正态 —— 钟形曲线浮现', w / 2, 100, {
      align: 'center', color: C.green, font: '13px system-ui',
    });
    text(f, '（切换「双峰分布」并调大 n，可看到双峰如何「融合」成正态）', w / 2, 124, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });

    heading(f, '中心极限定理：正态分布无处不在的原因');
    footnotes(f, [
      '大量独立同分布随机变量之和，标准化后依分布收敛于标准正态分布',
      '关键：原始分布的形状几乎无关——均匀、指数、双峰最终都变成钟形',
      '这解释了为何身高、测量误差、金融收益等大量现象都近似正态，是统计推断的地基',
    ]);
  },
});

// ---------------------------------------------------------------- T121
/** T121 科尔莫戈罗夫相容性定理。 */
const kolmogorovExtensionViz = defineViz({
  slug: 'kolmogorov-extension',
  title: '科尔莫戈罗夫相容性定理',
  params: {
    steps: { type: 'range', min: 2, max: 6, default: 4, label: '已指定的有限维分布' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const steps = Math.max(2, Math.round(num(params, 'steps', 4)));

    // 下方：有限维分布族；上方：完整的随机过程
    const baseY = h - 150;
    for (let i = 0; i < steps; i++) {
      const bw = 96;
      const x = 80 + i * (bw + 26);
      const dim = i + 1;
      poly(f, [[x, baseY - 46], [x + bw, baseY - 46], [x + bw, baseY], [x, baseY]], {
        fill: 'rgba(102,126,234,0.5)', stroke: C.accent, lw: 1.4, close: true,
      });
      text(f, `${dim} 维分布`, x + bw / 2, baseY - 22, { align: 'center', color: C.fg, font: '12px system-ui' });
      // 相容性箭头
      if (i < steps - 1) {
        seg(f, x + bw + 4, baseY - 23, x + bw + 22, baseY - 23, { color: C.warm, lw: 1.6 } as never);
      }
    }
    text(f, '彼此相容的有限维分布族', 80, baseY - 66, { color: C.dim, font: '12px system-ui' });

    // 上方：随机过程（一族轨道）
    const rand = rng(1933);
    for (let k = 0; k < 5; k++) {
      const pts: Array<[number, number]> = [];
      let y = 0;
      for (let i = 0; i <= 80; i++) {
        y += (rand() - 0.5) * 0.28;
        pts.push([80 + i * ((w - 160) / 80), 240 - y * 42]);
      }
      poly(f, pts, { stroke: ['rgba(56,178,172,0.8)', 'rgba(102,126,234,0.8)', 'rgba(237,137,54,0.75)', 'rgba(72,187,120,0.8)', 'rgba(237,100,166,0.7)'][k], lw: 1.6 });
    }
    text(f, '随机过程 X(t)', w / 2, 158, { align: 'center', color: C.warm, font: 'bold 14px system-ui' });
    text(f, '（由分布族唯一确定）', w / 2, 182, { align: 'center', color: C.dim, font: '12px system-ui' });

    // 向上箭头
    for (let i = 0; i < steps; i++) {
      const x = 80 + i * (96 + 26) + 48;
      seg(f, x, baseY - 50, x, 300, { color: 'rgba(237,137,54,0.25)', lw: 1 } as never);
    }

    text(f, '科尔莫戈罗夫相容性（扩张）定理', w / 2, 46, {
      align: 'center', font: 'bold 17px "Times New Roman", serif', color: C.warm,
    });
    text(f, '给定一族两两相容的有限维分布，必存在一个随机过程以它们为边际', w / 2, 74, {
      align: 'center', color: C.fg, font: '13px system-ui',
    });
    text(f, '相容性 = 任意「投影」到更低维时，分布互相一致', w / 2, 98, {
      align: 'center', color: C.green, font: '13px system-ui',
    });

    heading(f, '科尔莫戈罗夫相容性定理：随机过程的存在性');
    footnotes(f, [
      '问题：给定所有有限维分布，是否真有一个随机过程实现它们？答案是「相容即可」',
      '这是随机过程理论的第一块基石：布朗运动、马尔可夫过程的构造都依赖它',
      '科尔莫戈罗夫 1933 年把概率论建立在测度论之上，这是该体系的核心定理之一',
    ]);
  },
});

// ---------------------------------------------------------------- T122
/** T122 鞅收敛定理。 */
const martingaleConvergenceViz = defineViz({
  slug: 'martingale-convergence',
  title: '鞅收敛定理',
  params: {
    seed: { type: 'range', min: 1, max: 30, default: 11, label: '随机种子' },
    steps: { type: 'range', min: 20, max: 300, default: 120, label: '步数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const seed = Math.round(num(params, 'seed', 11));
    const steps = Math.max(10, Math.round(num(params, 'steps', 120)));

    const rand = rng(seed * 777);
    const paths: Array<Array<[number, number]>> = [];
    let boundedOutside = 0;
    for (let p = 0; p < 5; p++) {
      // 有界鞅：公平随机游走，限制在 [−1, 1]（反射边界）
      let x = 0;
      const path: Array<[number, number]> = [[0, 0]];
      for (let i = 1; i <= steps; i++) {
        x += rand() < 0.5 ? 0.1 : -0.1;
        if (x > 1) x = 2 - x;
        if (x < -1) x = -2 - x;
        path.push([i, x]);
      }
      if (Math.abs(x) <= 1.001) boundedOutside++;
      paths.push(path);
    }

    const v = view(f, { xMin: 0, xMax: steps, yMin: -1.3, yMax: 1.3, inset: 52 });
    grid(f, v, { divisions: 5, ticks: true });
    seg(f, v.sx(0), v.sy(0), v.sx(steps), v.sy(0), { color: C.dim, lw: 1.2, dash: [5, 4] } as never);
    seg(f, v.sx(0), v.sy(1), v.sx(steps), v.sy(1), { color: C.grid, lw: 1.4, dash: [6, 4] } as never);
    seg(f, v.sx(0), v.sy(-1), v.sx(steps), v.sy(-1), { color: C.grid, lw: 1.4, dash: [6, 4] } as never);

    const colors = [C.accent, C.cyan, C.green, C.warm, C.pink];
    paths.forEach((path, p) => {
      for (let i = 1; i < path.length; i++) {
        seg(f, v.sx(path[i - 1][0]), v.sy(path[i - 1][1]), v.sx(path[i][0]), v.sy(path[i][1]), {
          color: colors[p], lw: 1.6,
        } as never);
      }
    });

    text(f, '有界鞅 ⇒ 几乎必然收敛', w / 2, 48, {
      align: 'center', font: 'bold 16px "Times New Roman", serif', color: C.warm,
    });
    text(f, '鞅 = 公平游戏：每一步的条件期望都等于当前值 E[X_{n+1} | F_n] = X_n', w / 2, 76, {
      align: 'center', color: C.fg, font: '13px system-ui',
    });
    text(f, '五条轨迹都被限制在 [−1, 1] 内：有界鞅不会「逃逸」，最终收敛', w / 2, 100, {
      align: 'center', color: C.green, font: '13px system-ui',
    });
    text(f, `（本次 ${boundedOutside}/${paths.length} 条轨迹保持在界内）`, w / 2, 124, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });

    heading(f, '鞅收敛定理：公平游戏的长期归宿');
    footnotes(f, [
      '鞅刻画「公平游戏」——未来的期望等于现在，赢输无偏',
      '收敛定理：有界（或一致可积）的鞅几乎必然收敛到一个有限极限',
      '它是随机分析的核心工具，也是金融数学中「无套利定价」的理论基础',
    ]);
  },
});

// ---------------------------------------------------------------- T123
/** T123 马尔可夫不等式。 */
const markovInequalityViz = defineViz({
  slug: 'markov-inequality',
  title: '马尔可夫不等式',
  params: {
    lambda: { type: 'range', min: 0.5, max: 4, step: 0.1, default: 2, label: '阈值 a（相对于均值）' },
    shape: { type: 'select', options: ['指数分布', '均匀分布', '混合分布'], default: '指数分布', label: '随机变量分布' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = Math.max(0.1, num(params, 'lambda', 2));
    const kind = str(params, 'shape', '指数分布');

    // 用归一化后的分布：均值 = 1
    const pdf = (x: number): number => {
      if (x <= 0) return 0;
      if (kind === '指数分布') return Math.exp(-x);
      if (kind === '均匀分布') return x <= 2 ? 0.5 : 0;
      return 0.5 * Math.exp(-x * 2) + 0.5 * Math.exp(-x * 0.5) * 0.5;
    };
    const mean = 1; // 构造上均值为 1

    // 尾部概率 P(X ≥ a)
    let tail = 0;
    const N = 3000;
    const xmax = 6;
    for (let i = 0; i < N; i++) {
      const x = ((i + 0.5) * xmax) / N;
      if (x >= a) tail += (pdf(x) * xmax) / N;
    }
    const bound = mean / a;

    const v = view(f, { xMin: 0, xMax: xmax, yMin: 0, yMax: 1.1, inset: 54 });
    grid(f, v, { divisions: 6, ticks: true });
    // 密度曲线
    curve(f, v, pdf, { color: C.accent, lw: 2.4 } as never);
    // 尾部区域填充
    const tailPts: Array<[number, number]> = [[v.sx(a), v.sy(0)]];
    for (let i = 0; i <= 60; i++) {
      const x = a + ((xmax - a) * i) / 60;
      tailPts.push([v.sx(x), v.sy(pdf(x))]);
    }
    tailPts.push([v.sx(xmax), v.sy(0)]);
    poly(f, tailPts, { fill: 'rgba(245,101,101,0.4)', close: true });
    seg(f, v.sx(a), v.sy(0), v.sx(a), v.sy(1.0), { color: C.hot, lw: 2 } as never);
    text(f, `a = ${a.toFixed(1)}`, v.sx(a), v.sy(1.06), { align: 'center', color: C.hot, font: '12px system-ui' });

    text(f, 'P(X ≥ a) ≤ E[X] / a', w / 2, 48, {
      align: 'center', font: 'bold 19px "Times New Roman", serif', color: C.warm,
    });
    text(f, `E[X] = ${mean.toFixed(2)}（归一化）`, w / 2, 76, {
      align: 'center', color: C.fg, font: '13px Consolas, monospace',
    });
    text(f, `实际尾部概率 = ${tail.toFixed(4)}　上界 = ${bound.toFixed(4)}`, w / 2, 100, {
      align: 'center', color: C.green, font: '14px Consolas, monospace',
    });
    text(f, '红色区域即尾部概率；它永远不超过界的值（常常远小于）', w / 2, 124, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });

    heading(f, '马尔可夫不等式：用期望控制尾部');
    footnotes(f, [
      '非负随机变量大于 a 的概率，不超过其期望除以 a——只需知道期望即可',
      '它极其粗糙（实际值常远小于上界），但优点是完全不需要分布信息',
      '切比雪夫不等式由它推出（对 (X−μ)² 应用），大数律又由切比雪夫推出',
    ]);
  },
});

// ---------------------------------------------------------------- T124
/** T124 切比雪夫不等式。 */
const chebyshevInequalityViz = defineViz({
  slug: 'chebyshev-inequality',
  title: '切比雪夫不等式',
  params: {
    k: { type: 'range', min: 0.5, max: 4, step: 0.1, default: 2, label: '倍数 k（标准差）' },
    shape: { type: 'select', options: ['正态分布', '均匀分布', '双峰分布'], default: '正态分布', label: '分布' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const k = Math.max(0.3, num(params, 'k', 2));
    const kind = str(params, 'shape', '正态分布');

    // 标准化的分布（均值 0，标准差 1）
    const pdf = (x: number): number => {
      if (kind === '正态分布') return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
      if (kind === '均匀分布') return Math.abs(x) <= Math.sqrt(3) ? 1 / (2 * Math.sqrt(3)) : 0;
      // 双峰 ±1.2，方差归一化
      const s = 0.45;
      const m = 1.25;
      const c = (x: number): number => Math.exp(-((x - m) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));
      return 0.5 * c(x) + 0.5 * c(-x);
    };

    // 计算 P(|X| ≥ k)，用数值积分；同时归一化到方差 1
    let mean = 0;
    let varSum = 0;
    const N = 4000;
    const xmax = 6;
    const dx = xmax / N;
    let norm = 0;
    for (let i = 0; i < N; i++) {
      const x = (i + 0.5) * dx;
      norm += pdf(x) * dx + pdf(-x) * dx;
    }
    for (let i = 0; i < N; i++) {
      const x = (i + 0.5) * dx;
      mean += ((pdf(x) * x - pdf(-x) * x) / norm) * dx;
    }
    for (let i = 0; i < N; i++) {
      const x = (i + 0.5) * dx;
      const p = (pdf(x) + pdf(-x)) / norm;
      varSum += p * x * x * dx;
    }
    const sd = Math.sqrt(Math.max(varSum - mean * mean, 1e-9));

    let tail = 0;
    for (let i = 0; i < N; i++) {
      const x = (i + 0.5) * dx;
      if (x >= k * sd) {
        tail += ((pdf(x) + pdf(-x)) / norm) * dx;
      }
    }
    const bound = 1 / (k * k);

    const v = view(f, { xMin: -xmax, xMax: xmax, yMin: 0, yMax: 0.9, inset: 54 });
    grid(f, v, { divisions: 6, ticks: true });
    curve(f, v, (x) => pdf(x) / norm, { color: C.accent, lw: 2.4 } as never);
    // 尾部区域
    for (const sign of [-1, 1]) {
      const pts: Array<[number, number]> = [];
      const from = sign > 0 ? k * sd : -xmax;
      const to = sign > 0 ? xmax : -k * sd;
      pts.push([v.sx(from), v.sy(0)]);
      for (let i = 0; i <= 40; i++) {
        const x = from + ((to - from) * i) / 40;
        pts.push([v.sx(x), v.sy(pdf(x) / norm)]);
      }
      pts.push([v.sx(to), v.sy(0)]);
      poly(f, pts, { fill: 'rgba(245,101,101,0.35)', close: true });
    }
    const boundaries = [mean - k * sd, mean + k * sd];
    boundaries.forEach((b) => {
      seg(f, v.sx(b), v.sy(0), v.sx(b), v.sy(0.85), { color: C.hot, lw: 1.8, dash: [5, 4] } as never);
    });

    text(f, 'P(|X − μ| ≥ kσ) ≤ 1 / k²', w / 2, 48, {
      align: 'center', font: 'bold 19px "Times New Roman", serif', color: C.warm,
    });
    text(f, `k = ${k.toFixed(1)}　σ = ${sd.toFixed(4)}`, w / 2, 76, {
      align: 'center', color: C.fg, font: '13px Consolas, monospace',
    });
    text(f, `实际尾部概率 = ${tail.toFixed(4)}　上界 1/k² = ${bound.toFixed(4)}`, w / 2, 100, {
      align: 'center', color: bound >= tail ? C.green : C.hot, font: '14px Consolas, monospace',
    });
    text(f, '红色为 |X − μ| ≥ kσ 的区域，其面积永不超过 1/k²', w / 2, 124, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });

    heading(f, '切比雪夫不等式：用方差控制偏离');
    footnotes(f, [
      '随机变量偏离均值超过 k 倍标准差的概率不超过 1/k²（与具体分布无关）',
      'k = 2 时上界 25%，k = 3 时 11.1%——而正态分布的实际值分别只有 4.6% 与 0.27%',
      '它的价值在于普适性：只有均值和方差就能给出保证，也用于证明大数律',
    ]);
  },
});

registerViz(
  frobeniusIntegrabilityViz,
  lowenheimSkolemViz,
  godelCompletenessViz,
  churchTuringThesisViz,
  kolmogorovStrongLawViz,
  centralLimitTheoremViz,
  kolmogorovExtensionViz,
  martingaleConvergenceViz,
  markovInequalityViz,
  chebyshevInequalityViz,
);
