import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import {
  C,
  PALETTE,
  bars,
  dot,
  footnotes,
  gaussians,
  grid,
  heading,
  poly,
  rng,
  seg,
  text,
  view,
} from '../canvas';

/** 标准正态密度。 */
function normalPdf(x: number, mu = 0, sigma = 1): number {
  return Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI));
}

/** 标准正态累积分布（误差函数近似）。 */
function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly_ = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const cdf = 1 - normalPdf(x) * poly_;
  return x >= 0 ? cdf : 1 - cdf;
}

/** I35 概率基础。 */
const probability = defineViz({
  slug: 'probability',
  title: '概率基础',
  params: {
    kind: { type: 'select', options: ['抛硬币', '掷骰子', '两骰子和'], default: '抛硬币', label: '试验' },
    trials: { type: 'range', min: 50, max: 3000, default: 600, step: 50, label: '试验次数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'kind', '抛硬币');
    const trials = Math.round(num(params, 'trials', 600));
    const rand = rng(31337);

    let labels: string[] = [];
    let counts: number[] = [];
    let theo: number[] = [];
    if (kind === '抛硬币') {
      counts = [0, 0];
      labels = ['正面', '反面'];
      theo = [0.5, 0.5];
      for (let i = 0; i < trials; i++) counts[rand() < 0.5 ? 0 : 1]++;
    } else if (kind === '掷骰子') {
      counts = new Array(6).fill(0);
      labels = ['1', '2', '3', '4', '5', '6'];
      theo = new Array(6).fill(1 / 6);
      for (let i = 0; i < trials; i++) counts[Math.floor(rand() * 6)]++;
    } else {
      counts = new Array(11).fill(0);
      labels = Array.from({ length: 11 }, (_, i) => String(i + 2));
      theo = Array.from({ length: 11 }, (_, i) => {
        const s = i + 2;
        return ((6 - Math.abs(s - 7)) / 36);
      });
      for (let i = 0; i < trials; i++) counts[Math.floor(rand() * 6) + Math.floor(rand() * 6)]++;
    }

    const maxP = Math.max(...theo) * 1.3;
    const plotH = h - 150;
    const plotW = w - 80;
    const baseY = 60 + plotH;
    const slot = plotW / counts.length;
    counts.forEach((c, i) => {
      const freq = c / trials;
      const x = 40 + i * slot;
      f.ctx.save();
      f.ctx.fillStyle = C.accent;
      f.ctx.fillRect(x + slot * 0.1, baseY - (freq / maxP) * plotH, slot * 0.36, (freq / maxP) * plotH);
      f.ctx.fillStyle = C.warm;
      f.ctx.fillRect(x + slot * 0.52, baseY - (theo[i] / maxP) * plotH, slot * 0.36, (theo[i] / maxP) * plotH);
      f.ctx.restore();
      text(f, labels[i], x + slot / 2, baseY + 18, { align: 'center', color: C.fg, font: '12px sans-serif' });
      if (slot > 40) text(f, `${(freq * 100).toFixed(1)}%`, x + slot * 0.28, baseY - (freq / maxP) * plotH - 6, { align: 'center', color: C.accent, font: '10px sans-serif' });
    });
    seg(f, 40, baseY, 40 + plotW, baseY, C.dim, 1);

    footnotes(f, [
      `${trials} 次试验：蓝色是实测频率，橙色是理论概率`,
      '当试验次数增大，频率会稳定到概率 —— 这就是概率的频率解释',
      `古典概型要求每个基本结果等可能，概率 = 有利结果数 / 总结果数`,
    ]);
    heading(f, `概率基础：${kind}`);
  },
});

/** I36 蒙特卡洛方法。 */
const monteCarlo = defineViz({
  slug: 'monte-carlo',
  title: '蒙特卡洛方法',
  params: {
    points: { type: 'range', min: 100, max: 6000, default: 2000, step: 100, label: '随机点数' },
    dim: { type: 'select', options: ['圆内（估 π）', '抛物线下方'], default: '圆内（估 π）', label: '目标区域' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'points', 2000));
    const kind = str(params, 'dim', '圆内（估 π）');
    const rand = rng(2024);
    const v = view(f, { xMin: -0.05, xMax: 1.05, yMin: -0.05, yMax: 1.05, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });

    let inside = 0;
    for (let i = 0; i < n; i++) {
      const x = rand();
      const y = rand();
      const isIn = kind === '圆内（估 π）' ? x * x + y * y <= 1 : y <= x * x;
      if (isIn) inside++;
      dot(f, v.sx(x), v.sy(y), 1.6, isIn ? C.green : C.hot);
    }
    if (kind === '圆内（估 π）') {
      const circlePts: Array<[number, number]> = [];
      for (let i = 0; i <= 180; i++) {
        const a = (i / 180) * Math.PI * 0.5;
        circlePts.push([v.sx(Math.cos(a)), v.sy(Math.sin(a))]);
      }
      poly(f, circlePts, { stroke: C.fg, lw: 1.8 });
    } else {
      const curvePts: Array<[number, number]> = [];
      for (let i = 0; i <= 120; i++) {
        const x = i / 120;
        curvePts.push([v.sx(x), v.sy(x * x)]);
      }
      poly(f, curvePts, { stroke: C.fg, lw: 1.8 });
    }

    const ratio = inside / n;
    footnotes(f, [
      `${n} 个随机点中有 ${inside} 个落在区域内，占比 ${ratio.toFixed(4)}`,
      kind === '圆内（估 π）'
        ? `π ≈ 4 × ${ratio.toFixed(4)} = ${(ratio * 4).toFixed(4)}（真值 ${Math.PI.toFixed(4)}）`
        : `面积 ≈ ${ratio.toFixed(4)}（真值 ∫₀¹x²dx = 1/3 = ${(1 / 3).toFixed(4)}）`,
      '蒙特卡洛用随机采样估计确定量，维数越高相对传统数值方法越有优势',
    ]);
    heading(f, '蒙特卡洛方法：随机采样估面积');
  },
});

/** I37 贝叶斯定理。 */
const bayes = defineViz({
  slug: 'bayes',
  title: '贝叶斯定理',
  params: {
    prior: { type: 'range', min: 0.01, max: 0.5, default: 0.05, step: 0.01, label: '先验患病率' },
    sensitivity: { type: 'range', min: 0.5, max: 1, default: 0.95, step: 0.01, label: '灵敏度 P(+|病)' },
    specificity: { type: 'range', min: 0.5, max: 1, default: 0.9, step: 0.01, label: '特异度 P(-|健康)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const prior = num(params, 'prior', 0.05);
    const sens = num(params, 'sensitivity', 0.95);
    const spec = num(params, 'specificity', 0.9);
    const falsePos = 1 - spec;
    const tp = prior * sens;
    const fp = (1 - prior) * falsePos;
    const posterior = tp / (tp + fp);

    // 1000 人的格子图
    const total = 1000;
    const cell = Math.min((w - 120) / 50, (h - 190) / 20, 14);
    const cols = 50;
    const sick = Math.round(prior * total);
    const rows = Math.ceil(total / cols);
    for (let i = 0; i < total; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = 40 + c * cell;
      const y = 56 + r * cell;
      const hasDisease = i < sick;
      // 用确定性伪随机决定该个体的检测结果
      const rand = (i * 2654435761) % 1000 / 1000;
      const testPositive = hasDisease ? rand < sens : rand < falsePos;
      f.ctx.save();
      f.ctx.fillStyle = testPositive ? (hasDisease ? C.hot : C.warm) : hasDisease ? C.accent2 : C.panel;
      f.ctx.fillRect(x, y, cell - 1.5, cell - 1.5);
      f.ctx.restore();
    }
    text(f, `1000 人中约 ${sick} 人真患病`, 40, 44, { color: C.dim, font: '12px sans-serif' });

    const legend: Array<[string, string]> = [
      [`真阳性 ≈ ${Math.round(tp * total)} 人`, C.hot],
      [`假阳性 ≈ ${Math.round(fp * total)} 人`, C.warm],
      ['真阴性', C.panel],
      ['假阴性', C.accent2],
    ];
    legend.forEach(([label, color], i) => {
      const y = 56 + i * 24;
      f.ctx.save();
      f.ctx.fillStyle = color === C.panel ? C.panel : color;
      f.ctx.fillRect(w - 280, y, 14, 14);
      f.ctx.restore();
      text(f, label, w - 260, y + 12, { color: C.fg, font: '12px sans-serif' });
    });
    text(f, `阳性后验概率 P(病|+) = ${(posterior * 100).toFixed(2)}%`, w - 280, 56 + 4 * 24 + 16, {
      color: C.green,
      font: 'bold 14px "Segoe UI", system-ui, sans-serif',
    });

    footnotes(f, [
      `先验 ${(prior * 100).toFixed(0)}%、灵敏度 ${(sens * 100).toFixed(0)}%、特异度 ${(spec * 100).toFixed(0)}%`,
      `贝叶斯公式：P(病|+) = ${(sens * 100).toFixed(0)}%×${(prior * 100).toFixed(0)}% / [${(sens * 100).toFixed(0)}%×${(prior * 100).toFixed(0)}% + ${(falsePos * 100).toFixed(0)}%×${((1 - prior) * 100).toFixed(0)}%]`,
      '即使检测"很准"，低发病率下阳性结果仍多半是假阳性 —— 基础率谬误',
    ]);
    heading(f, '贝叶斯定理：从先验到后验');
  },
});

/** I38 假设检验。 */
const hypothesisTesting = defineViz({
  slug: 'hypothesis-testing',
  title: '假设检验',
  params: {
    alpha: { type: 'select', options: ['0.1', '0.05', '0.01'], default: '0.05', label: '显著性水平 α' },
    effect: { type: 'range', min: -3, max: 3, default: 1.6, step: 0.1, label: '样本均值偏移（z 值）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const alpha = Number(str(params, 'alpha', '0.05'));
    const z = num(params, 'effect', 1.6);
    // 临界值（双侧）
    const zCrit = alpha === 0.1 ? 1.645 : alpha === 0.01 ? 2.576 : 1.96;
    const v = view(f, { xMin: -4, xMax: 4, yMin: 0, yMax: 0.45, inset: 40 });
    grid(f, v, { divisions: 4, ticks: true });

    // 拒绝域阴影
    const shade = (from: number, to: number, color: string): void => {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 80; i++) {
        const x = from + ((to - from) * i) / 80;
        pts.push([v.sx(x), v.sy(normalPdf(x))]);
      }
      pts.push([v.sx(to), v.sy(0)], [v.sx(from), v.sy(0)]);
      poly(f, pts, { fill: color, close: true });
    };
    shade(-4, -zCrit, 'rgba(245,101,101,0.35)');
    shade(zCrit, 4, 'rgba(245,101,101,0.35)');
    poly(f, sampledNormal(v), { stroke: C.accent, lw: 2.4 });

    seg(f, v.sx(z), v.sy(0), v.sx(z), v.sy(normalPdf(z)), C.green, 2);
    dot(f, v.sx(z), v.sy(0), 5, C.green);
    text(f, `观察值 z = ${z.toFixed(2)}`, v.sx(z) + 6, v.sy(0) + 18, { color: C.green, font: '12px sans-serif' });
    seg(f, v.sx(zCrit), 60, v.sx(zCrit), v.sy(0), C.hot, 1.2);
    text(f, `临界 ${zCrit}`, v.sx(zCrit), 52, { align: 'center', color: C.hot, font: '11px sans-serif' });

    const pValue = 2 * (1 - normalCdf(Math.abs(z)));
    const reject = Math.abs(z) > zCrit;
    footnotes(f, [
      `显著性水平 α = ${alpha}，双侧临界值 z = ±${zCrit}（红色为拒绝域）`,
      `p 值 = ${pValue.toExponential(2)}，${reject ? 'p < α：拒绝原假设（差异显著）' : 'p ≥ α：不能拒绝原假设'}`,
      'p 值不是"原假设为真的概率"，而是在原假设下观察到当前或更极端结果的概率',
    ]);
    heading(f, '假设检验：拒绝域与 p 值');
  },
});

/** I39 置信区间。 */
const confidenceInterval = defineViz({
  slug: 'confidence-interval',
  title: '置信区间',
  params: {
    level: { type: 'select', options: ['80', '90', '95', '99'], default: '95', label: '置信水平(%)' },
    sampleSize: { type: 'range', min: 5, max: 100, default: 25, label: '样本量 n' },
    rounds: { type: 'range', min: 5, max: 40, default: 20, label: '抽样次数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const level = Number(str(params, 'level', '95'));
    const n = Math.round(num(params, 'sampleSize', 25));
    const rounds = Math.round(num(params, 'rounds', 20));
    const z = level === 80 ? 1.282 : level === 90 ? 1.645 : level === 99 ? 2.576 : 1.96;
    const trueMean = 50;
    const sigma = 10;
    const rand = rng(606);
    const se = sigma / Math.sqrt(n);

    const v = view(f, { xMin: 42, xMax: 58, yMin: 0, yMax: rounds, inset: 40 });
    seg(f, v.sx(trueMean), v.sy(0), v.sx(trueMean), v.sy(rounds), C.green, 2);
    text(f, `真值 μ = ${trueMean}`, v.sx(trueMean) + 6, 52, { color: C.green, font: '12px sans-serif' });

    let covered = 0;
    const rowH = (h - 130) / rounds;
    for (let i = 0; i < rounds; i++) {
      const samples = gaussians(rand, n).map((x) => x * sigma + trueMean);
      const mean = samples.reduce((a, b) => a + b, 0) / n;
      const lo = mean - z * se;
      const hi = mean + z * se;
      const ok = lo <= trueMean && trueMean <= hi;
      if (ok) covered++;
      const y = 62 + i * rowH + rowH / 2;
      seg(f, v.sx(lo), y, v.sx(hi), y, ok ? C.accent : C.hot, 2.4);
      dot(f, v.sx(mean), y, 2.6, ok ? C.fg : C.hot);
    }

    footnotes(f, [
      `${rounds} 次抽样中 ${covered} 个区间覆盖了真值，实际覆盖率 ${((covered / rounds) * 100).toFixed(1)}%（理论 ${level}%）`,
      `区间 = 样本均值 ± ${z} × σ/√n = 均值 ± ${(z * se).toFixed(3)}`,
      '置信水平的含义是"重复抽样时区间覆盖真值的长期频率"，而不是"真值落在该区间的概率"',
    ]);
    heading(f, '置信区间：重复抽样的覆盖率');
  },
});

/** 标准正态曲线采样点。 */
function sampledNormal(v: ReturnType<typeof view>): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 200; i++) {
    const x = v.xMin + ((v.xMax - v.xMin) * i) / 200;
    pts.push([v.sx(x), v.sy(normalPdf(x))]);
  }
  return pts;
}

/** I40 大数定律。 */
const lawLargeNumbers = defineViz({
  slug: 'law-large-numbers',
  title: '大数定律',
  params: {
    walks: { type: 'range', min: 1, max: 8, default: 5, label: '试验次数（轨迹）' },
    maxN: { type: 'range', min: 50, max: 2000, default: 500, step: 50, label: '最大样本量' },
    faces: { type: 'range', min: 2, max: 20, default: 6, label: '骰子面数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const walks = Math.round(num(params, 'walks', 5));
    const maxN = Math.round(num(params, 'maxN', 500));
    const faces = Math.round(num(params, 'faces', 6));
    const expect = (faces + 1) / 2;
    const rand = rng(9090);

    const v = view(f, { xMin: 1, xMax: maxN, yMin: expect - 2.2, yMax: expect + 2.2, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    seg(f, v.sx(1), v.sy(expect), v.sx(maxN), v.sy(expect), C.green, 1.8);
    text(f, `期望 E = ${expect}`, v.sx(maxN) - 8, v.sy(expect) - 8, { color: C.green, align: 'right', font: '12px sans-serif' });

    for (let k = 0; k < walks; k++) {
      let sum = 0;
      const pts: Array<[number, number]> = [];
      for (let i = 1; i <= maxN; i++) {
        sum += Math.floor(rand() * faces) + 1;
        if (i % Math.max(1, Math.floor(maxN / 160)) === 0 || i === maxN) {
          pts.push([v.sx(i), v.sy(sum / i)]);
        }
      }
      poly(f, pts, { stroke: PALETTE[k % PALETTE.length], lw: 1.8 });
    }

    footnotes(f, [
      `${walks} 条独立试验的样本均值曲线（${faces} 面骰子）`,
      '样本量很小时均值波动剧烈；随着 n 增大，均值几乎必然收敛到理论期望',
      '大数定律是"用频率估计概率"的理论依据（弱大数定律保证依概率收敛）',
    ]);
    heading(f, '大数定律：样本均值收敛到期望');
  },
});

/** I41 泊松过程。 */
const poissonProcess = defineViz({
  slug: 'poisson-process',
  title: '泊松过程',
  params: {
    lambda: { type: 'range', min: 0.5, max: 6, default: 2, step: 0.5, label: '到达率 λ' },
    horizon: { type: 'range', min: 5, max: 30, default: 15, label: '时间跨度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const lambda = num(params, 'lambda', 2);
    const horizon = Math.round(num(params, 'horizon', 15));
    const rand = rng(1919);
    const arrivals: number[] = [];
    let t = 0;
    while (t < horizon) {
      t += -Math.log(1 - rand()) / lambda;
      if (t < horizon) arrivals.push(t);
    }

    const v = view(f, { xMin: 0, xMax: horizon, yMin: 0, yMax: Math.max(3, arrivals.length * 0.6), inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    arrivals.forEach((time) => {
      seg(f, v.sx(time), v.sy(0), v.sx(time), v.sy(v.yMax * 0.55), C.accent, 2.4);
      dot(f, v.sx(time), v.sy(v.yMax * 0.55), 3, C.warm);
    });

    // 计数阶梯
    const steps: Array<[number, number]> = [[v.sx(0), v.sy(0)]];
    arrivals.forEach((time, i) => {
      steps.push([v.sx(time), v.sy(i)]);
      steps.push([v.sx(time), v.sy(i + 1)]);
    });
    steps.push([v.sx(horizon), v.sy(arrivals.length)]);
    poly(f, steps, { stroke: C.green, lw: 2 });

    const intervals = arrivals.slice(1).map((time, i) => time - arrivals[i]);
    const meanInterval = intervals.length ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
    footnotes(f, [
      `λ = ${lambda} 时，${horizon} 个时间单位内共发生 ${arrivals.length} 次到达（理论期望 ${(lambda * horizon).toFixed(1)} 次）`,
      `绿线是计数过程 N(t)；相邻到达的时间间隔服从指数分布，平均间隔 ${meanInterval.toFixed(3)}（理论 1/λ = ${(1 / lambda).toFixed(3)}）`,
      '泊松过程的到达次数在任意长度 t 的区间内服从泊松分布，均值 λt —— 排队论、放射性衰变都靠它',
    ]);
    heading(f, '泊松过程：随机到达与计数');
  },
});

/** I42 布朗运动。 */
const brownianMotion = defineViz({
  slug: 'brownian-motion',
  title: '布朗运动',
  params: {
    paths: { type: 'range', min: 1, max: 10, default: 6, label: '路径数' },
    steps: { type: 'range', min: 50, max: 800, default: 300, step: 50, label: '步数' },
    volatility: { type: 'range', min: 0.2, max: 3, default: 1, step: 0.2, label: '波动率 σ' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const paths = Math.round(num(params, 'paths', 6));
    const steps = Math.round(num(params, 'steps', 300));
    const sigma = num(params, 'volatility', 1);
    const rand = rng(123456);
    const dt = 1 / steps;
    const drift = Math.sqrt(dt) * sigma;

    const v = view(f, { xMin: 0, xMax: 1, yMin: -3.2, yMax: 3.2, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    // ±1σ、±2σ 包络
    [1, 2].forEach((k) => {
      const upper: Array<[number, number]> = [];
      const lower: Array<[number, number]> = [];
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const band = k * sigma * Math.sqrt(t);
        upper.push([v.sx(t), v.sy(band)]);
        lower.push([v.sx(t), v.sy(-band)]);
      }
      poly(f, upper, { stroke: `rgba(160,174,192,${k === 1 ? 0.55 : 0.3})`, lw: 1.2, dash: [5, 4] });
      poly(f, lower, { stroke: `rgba(160,174,192,${k === 1 ? 0.55 : 0.3})`, lw: 1.2, dash: [5, 4] });
    });

    for (let k = 0; k < paths; k++) {
      let x = 0;
      const pts: Array<[number, number]> = [[v.sx(0), v.sy(0)]];
      for (let i = 1; i <= steps; i++) {
        x += gaussians(rand, 2)[0] * drift;
        pts.push([v.sx(i / steps), v.sy(x)]);
      }
      poly(f, pts, { stroke: `${PALETTE[k % PALETTE.length]}cc`, lw: 1.6 });
    }

    footnotes(f, [
      `${paths} 条标准布朗运动轨迹（每步增量 ~ N(0, σ²dt)）`,
      '灰色虚线是 ±σ√t、±2σ√t 包络：位移的标准差随时间的平方根增长',
      '布朗运动处处连续但处处不可微，是随机分析（伊藤积分）的基础对象',
    ]);
    heading(f, '布朗运动：随机游走的连续极限');
  },
});

/** I43 随机游走。 */
const randomWalk = defineViz({
  slug: 'random-walk',
  title: '随机游走',
  params: {
    dim: { type: 'select', options: ['一维', '二维'], default: '二维', label: '维度' },
    steps: { type: 'range', min: 50, max: 2000, default: 600, step: 50, label: '步数' },
    walks: { type: 'range', min: 1, max: 6, default: 3, label: '路径数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const dim = str(params, 'dim', '二维');
    const steps = Math.round(num(params, 'steps', 600));
    const walks = Math.round(num(params, 'walks', 3));
    const rand = rng(2468);

    if (dim === '一维') {
      const v = view(f, { xMin: 0, xMax: steps, yMin: -Math.sqrt(steps) * 3, yMax: Math.sqrt(steps) * 3, inset: 40 });
      grid(f, v, { divisions: 5, ticks: true });
      for (let k = 0; k < walks; k++) {
        let x = 0;
        const pts: Array<[number, number]> = [];
        for (let i = 0; i <= steps; i++) {
          if (i > 0) x += rand() < 0.5 ? 1 : -1;
          pts.push([v.sx(i), v.sy(x)]);
        }
        poly(f, pts, { stroke: PALETTE[k % PALETTE.length], lw: 1.6 });
      }
      footnotes(f, [
        `一维随机游走 ${steps} 步：位移 ~ √n 量级（±3√n 已覆盖绝大多数情况）`,
        '一维与二维随机游走都是常返的：迟早会回到出发点；三维及以上不再常返',
      ]);
    } else {
      const span = Math.sqrt(steps) * 2;
      const v = view(f, { xMin: -span, xMax: span, yMin: -span, yMax: span, inset: 40 });
      grid(f, v, { divisions: 6, ticks: true });
      dot(f, v.sx(0), v.sy(0), 5, C.green);
      for (let k = 0; k < walks; k++) {
        let x = 0;
        let y = 0;
        const pts: Array<[number, number]> = [[v.sx(0), v.sy(0)]];
        for (let i = 0; i < steps; i++) {
          const dir = Math.floor(rand() * 4);
          if (dir === 0) x++;
          else if (dir === 1) x--;
          else if (dir === 2) y++;
          else y--;
          pts.push([v.sx(x), v.sy(y)]);
        }
        poly(f, pts, { stroke: `${PALETTE[k % PALETTE.length]}cc`, lw: 1.4 });
        dot(f, v.sx(x), v.sy(y), 4, PALETTE[k % PALETTE.length]);
      }
      footnotes(f, [
        `二维方格随机游走 ${steps} 步（终点为同色圆点）`,
        `典型位移 ~ √n = ${Math.sqrt(steps).toFixed(1)} 量级，而非线性增长`,
        '二维随机游走常返：必定以概率 1 无限次回到原点（波利亚定理）',
      ]);
    }
    heading(f, '随机游走');
  },
});

/** I44 优惠券收集。 */
const couponCollector = defineViz({
  slug: 'coupon-collector',
  title: '优惠券收集',
  params: {
    kinds: { type: 'range', min: 2, max: 30, default: 12, label: '种类数 n' },
    trials: { type: 'range', min: 100, max: 3000, default: 1000, step: 100, label: '模拟次数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'kinds', 12));
    const trials = Math.round(num(params, 'trials', 1000));
    const rand = rng(555);

    const results: number[] = [];
    for (let i = 0; i < trials; i++) {
      const seen = new Set<number>();
      let draws = 0;
      while (seen.size < n) {
        seen.add(Math.floor(rand() * n));
        draws++;
      }
      results.push(draws);
    }
    const mean = results.reduce((a, b) => a + b, 0) / trials;
    let harmonic = 0;
    for (let i = 1; i <= n; i++) harmonic += 1 / i;
    const theory = n * harmonic;

    const min = Math.min(...results);
    const max = Math.max(...results);
    const bins = 18;
    const counts = new Array<number>(bins).fill(0);
    for (const v0 of results) {
      const idx = Math.min(bins - 1, Math.floor(((v0 - min) / (max - min || 1)) * bins));
      counts[idx]++;
    }
    const plotH = h - 170;
    const plotW = w - 120;
    const baseY = 60 + plotH;
    bars(f, counts, { x: 60, y: 60, w: plotW, h: plotH, colors: [C.accent], normalize: false });
    const toX = (v0: number): number => 60 + ((v0 - min) / (max - min || 1)) * plotW;
    seg(f, toX(theory), 60, toX(theory), baseY, C.green, 2);
    seg(f, toX(mean), 60, toX(mean), baseY, C.warm, 2);
    text(f, `理论 n·Hₙ = ${theory.toFixed(1)}`, toX(theory), 52, { align: 'center', color: C.green, font: '12px sans-serif' });
    text(f, `模拟均值 = ${mean.toFixed(1)}`, toX(mean), baseY + 32, { align: 'center', color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      `集齐 ${n} 种优惠券平均需要 ${theory.toFixed(2)} 次（= n × (1 + 1/2 + … + 1/n)），${trials} 次模拟得 ${mean.toFixed(2)}`,
      `最少 ${min} 次、最多 ${max} 次；期望是 n 的 ln n 倍量级`,
      '关键洞察：最后一种优惠券的收集期望是 n 次 —— 越接近集齐越难，这就是"长尾"',
    ]);
    heading(f, '优惠券收集：集齐需要多久');
  },
});

registerViz(
  probability,
  monteCarlo,
  bayes,
  hypothesisTesting,
  confidenceInterval,
  lawLargeNumbers,
  poissonProcess,
  brownianMotion,
  randomWalk,
  couponCollector,
);
