import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import {
  C,
  PALETTE,
  bars,
  curve,
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
const pdf = (x: number, mu = 0, s = 1): number => Math.exp(-((x - mu) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));

/** M69 中心极限定理。 */
const clt = defineViz({
  slug: 'clt',
  title: '中心极限定理',
  params: {
    dist: { type: 'select', options: ['均匀分布', '指数分布', '双峰分布'], default: '均匀分布', label: '总体分布' },
    sampleSize: { type: 'range', min: 1, max: 50, default: 10, label: '样本量 n' },
    rounds: { type: 'range', min: 200, max: 4000, default: 1500, step: 100, label: '重复次数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const dist = str(params, 'dist', '均匀分布');
    const n = Math.round(num(params, 'sampleSize', 10));
    const rounds = Math.round(num(params, 'rounds', 1500));
    const rand = rng(20240101);

    const draw = (): number => {
      if (dist === '指数分布') return -Math.log(1 - rand());
      if (dist === '双峰分布') return rand() < 0.5 ? gaussians(rand, 1)[0] * 0.5 - 1.6 : gaussians(rand, 1)[0] * 0.5 + 1.6;
      return rand() * 2 - 1;
    };
    const mu = dist === '均匀分布' ? 0 : dist === '指数分布' ? 1 : 0;
    const variance = dist === '均匀分布' ? 1 / 3 : dist === '指数分布' ? 1 : 1.5;

    const means: number[] = [];
    for (let r = 0; r < rounds; r++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += draw();
      means.push(sum / n);
    }
    // 标准化后的分布
    const sd = Math.sqrt(variance / n);
    const z = means.map((m) => (m - mu) / sd);
    const bins = 40;
    const counts = new Array<number>(bins).fill(0);
    for (const v0 of z) {
      const idx = Math.floor((v0 + 4) / 8 * bins);
      if (idx >= 0 && idx < bins) counts[idx]++;
    }

    const top = 56;
    const plotH = h - 170;
    bars(f, counts, { x: 40, y: top, w: w - 80, h: plotH, colors: [C.accent], normalize: false });
    const v = view(f, { xMin: -4, xMax: 4, yMin: 0, yMax: 0.55, inset: 40 });
    const normPts: Array<[number, number]> = [];
    for (let i = 0; i <= 200; i++) {
      const x = -4 + (i / 200) * 8;
      normPts.push([v.sx(x), top + plotH - (pdf(x) / 0.55) * plotH]);
    }
    poly(f, normPts, { stroke: C.warm, lw: 2.4 });
    seg(f, 40 + (w - 80) / 2, top, 40 + (w - 80) / 2, top + plotH, C.green, 1.4);

    footnotes(f, [
      `${dist}、样本量 n = ${n}、重复 ${rounds} 次得到的样本均值分布（标准化后）`,
      '橙色为标准正态密度曲线 —— 无论总体是什么分布，样本均值都趋向正态',
      '中心极限定理：独立同分布、方差有限时，√n(X̄ - μ)/σ 依分布收敛到 N(0,1)',
    ]);
    heading(f, '中心极限定理');
  },
});

/** M70 蒙特卡洛深化。 */
const monteCarloM70 = defineViz({
  slug: 'monte-carlo-m70',
  title: '蒙特卡洛深化',
  params: {
    samples: { type: 'range', min: 50, max: 8000, default: 1000, step: 50, label: '样本数' },
    dim: { type: 'select', options: ['1 维（估 π）', '2 维（积分）'], default: '1 维（估 π）', label: '维度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const samples = Math.round(num(params, 'samples', 1000));
    const dim = str(params, 'dim', '1 维（估 π）');
    const rand = rng(48271);

    // 收敛曲线：累积估计值随样本数变化
    const estimates: number[] = [];
    let inside = 0;
    for (let i = 1; i <= samples; i++) {
      if (dim.startsWith('1 维')) {
        const x = rand() * 2 - 1;
        const y = rand() * 2 - 1;
        if (x * x + y * y <= 1) inside++;
        estimates.push((inside / i) * 4);
      } else {
        const x = rand();
        if (rand() < x * x) inside++;
        estimates.push(inside / i);
      }
    }
    const truth = dim.startsWith('1 维') ? Math.PI : 1 / 3;

    // 对数坐标下的收敛
    const v = view(f, { xMin: 0, xMax: Math.log10(samples), yMin: truth - 0.6, yMax: truth + 0.6, inset: 40 });
    grid(f, v, { divisions: 5, ticks: false });
    seg(f, v.sx(0), v.sy(truth), v.sx(Math.log10(samples)), v.sy(truth), C.green, 1.6);
    const pts: Array<[number, number]> = [];
    for (let i = 1; i <= samples; i *= 2) {
      const e = estimates[Math.min(estimates.length - 1, i - 1)];
      pts.push([v.sx(Math.log10(i)), v.sy(e)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2 });
    // 误差包络 ~ 1/√n
    for (const sign of [1, -1]) {
      const env: Array<[number, number]> = [];
      for (let i = 1; i <= samples; i += Math.max(1, Math.floor(samples / 120))) {
        env.push([v.sx(Math.log10(i)), v.sy(truth + (sign * 1.2) / Math.sqrt(i))]);
      }
      poly(f, env, { stroke: `${C.warm}77`, lw: 1.2, dash: [4, 3] });
    }
    text(f, `真值 ${truth.toFixed(5)}`, v.sx(Math.log10(samples)) - 6, v.sy(truth) - 8, { color: C.green, align: 'right', font: '12px sans-serif' });
    text(f, '±1.2/√n 包络', 44, 66, { color: C.warm, font: '11px sans-serif' });

    footnotes(f, [
      `样本数 ${samples}：估计值 ${estimates[estimates.length - 1].toFixed(5)}，真值 ${truth.toFixed(5)}，误差 ${Math.abs(estimates[estimates.length - 1] - truth).toExponential(2)}`,
      '蒙特卡洛误差按 O(1/√n) 收敛（橙色虚线包络）—— 想精度提高 10 倍，样本要增加 100 倍',
      '收敛速度与维数无关，这正是蒙特卡洛在高维积分中胜过网格法的原因',
    ]);
    heading(f, '蒙特卡洛收敛性（横轴为对数样本量）');
  },
});

/** M71 贝叶斯深化。 */
const bayesM71 = defineViz({
  slug: 'bayes-m71',
  title: '贝叶斯深化',
  params: {
    priorMean: { type: 'range', min: 0, max: 1, default: 0.5, step: 0.05, label: '先验均值' },
    priorStrength: { type: 'range', min: 1, max: 30, default: 6, label: '先验强度' },
    dataHeads: { type: 'range', min: 0, max: 30, default: 12, label: '正面次数' },
    dataTotal: { type: 'range', min: 1, max: 30, default: 20, label: '总次数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const priorMean = num(params, 'priorMean', 0.5);
    const strength = num(params, 'priorStrength', 6);
    const heads = Math.round(num(params, 'dataHeads', 12));
    const total = Math.max(1, Math.round(num(params, 'dataTotal', 20)));

    // Beta 共轭先验：α = priorMean * strength，β = (1-priorMean) * strength
    const a0 = priorMean * strength;
    const b0 = (1 - priorMean) * strength;
    const a1 = a0 + heads;
    const b1 = b0 + total - heads;
    const betaPdf = (x: number, a: number, b: number): number => {
      if (x <= 0 || x >= 1) return 0;
      const logB = logGamma(a) + logGamma(b) - logGamma(a + b);
      return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - logB);
    };

    const v = view(f, { xMin: 0, xMax: 1, yMin: 0, yMax: 8, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    curve(f, v, (x) => betaPdf(x, a0, b0), { color: C.dim, lw: 1.8, dash: [5, 4] });
    curve(f, v, (x) => betaPdf(x, a1, b1), { color: C.accent, lw: 2.6 });
    const postMean = a1 / (a1 + b1);
    dot(f, v.sx(postMean), v.sy(betaPdf(postMean, a1, b1)), 5, C.warm);

    footnotes(f, [
      `先验 Beta(${a0.toFixed(1)}, ${b0.toFixed(1)})（灰虚线）→ 观测 ${heads}/${total} → 后验 Beta(${a1.toFixed(1)}, ${b1.toFixed(1)})`,
      `先验均值 ${priorMean.toFixed(2)} → 后验均值 ${postMean.toFixed(4)}（数据越多，先验影响越弱）`,
      'Beta-二项共轭：后验与先验同族，只需更新两个参数 —— 这就是贝叶斯更新的简洁之处',
    ]);
    heading(f, '贝叶斯更新：先验 → 后验');
  },
});

/** 对数伽马（Lanczos 近似，Numerical Recipes 形式）。 */
function logGamma(x: number): number {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += g[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** M72 隐马尔可夫模型。 */
const hiddenMarkov = defineViz({
  slug: 'hidden-markov',
  title: '隐马尔可夫模型',
  params: {
    stayProb: { type: 'range', min: 0.5, max: 0.95, default: 0.75, step: 0.05, label: '保持状态概率' },
    steps: { type: 'range', min: 10, max: 60, default: 30, label: '观测步数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const stay = num(params, 'stayProb', 0.75);
    const steps = Math.round(num(params, 'steps', 30));
    const rand = rng(6666);
    const states: number[] = [0];
    const obs: number[] = [];
    for (let i = 0; i < steps; i++) {
      if (i > 0) states.push(rand() < stay ? states[i - 1] : 1 - states[i - 1]);
      // 观测：状态 0 偏正面，状态 1 偏反面
      obs.push(rand() < (states[i] === 0 ? 0.8 : 0.25) ? 1 : 0);
    }
    // 维特比解码（简化：0/1 两状态）
    const viterbi: number[] = [];
    let score0 = Math.log(0.5) + Math.log(obs[0] ? 0.8 : 0.2);
    let score1 = Math.log(0.5) + Math.log(obs[0] ? 0.25 : 0.75);
    viterbi.push(score0 >= score1 ? 0 : 1);
    for (let i = 1; i < steps; i++) {
      const e0 = Math.log(obs[i] ? 0.8 : 0.2);
      const e1 = Math.log(obs[i] ? 0.25 : 0.75);
      const n0 = Math.max(score0 + Math.log(stay), score1 + Math.log(1 - stay)) + e0;
      const n1 = Math.max(score1 + Math.log(stay), score0 + Math.log(1 - stay)) + e1;
      score0 = n0;
      score1 = n1;
      viterbi.push(n0 >= n1 ? 0 : 1);
    }
    const correct = states.filter((s, i) => s === viterbi[i]).length;

    const slot = (w - 80) / steps;
    const rows = [
      { label: '真实状态', values: states, color: C.green },
      { label: '维特比解码', values: viterbi, color: C.accent },
      { label: '观测序列', values: obs, color: C.warm },
    ];
    rows.forEach((row, ri) => {
      const y = 70 + ri * 62;
      text(f, row.label, 30, y - 8, { color: row.color, font: '12px sans-serif' });
      row.values.forEach((val, i) => {
        f.ctx.save();
        f.ctx.fillStyle = val === 1 ? `${row.color}cc` : `${row.color}44`;
        f.ctx.fillRect(40 + i * slot, y, Math.max(2, slot - 1.5), 34);
        f.ctx.restore();
      });
    });

    footnotes(f, [
      `状态保持概率 ${stay}：真实状态 ${states.filter((s) => s === 0).length} 步为状态 0`,
      `维特比解码正确率 ${((correct / steps) * 100).toFixed(1)}% —— 从观测反推最可能的隐藏状态序列`,
      'HMM 三要素：转移概率、发射概率、初始分布；三大问题（评估/解码/学习）分别用前向算法、维特比、Baum-Welch',
    ]);
    heading(f, '隐马尔可夫模型：从观测推断状态');
  },
});

/** M73 高斯混合模型。 */
const gaussianMixture = defineViz({
  slug: 'gaussian-mixture',
  title: '高斯混合模型',
  params: {
    components: { type: 'range', min: 2, max: 4, default: 3, label: '成分个数' },
    separation: { type: 'range', min: 1, max: 5, default: 2.8, step: 0.2, label: '分离度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const k = Math.round(num(params, 'components', 3));
    const sep = num(params, 'separation', 2.8);
    const centers = Array.from({ length: k }, (_, i) => (i - (k - 1) / 2) * sep);
    const v = view(f, { xMin: centers[0] - 4, xMax: centers[k - 1] + 4, yMin: 0, yMax: 0.5, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });

    // 各成分
    centers.forEach((c, i) => {
      curve(f, v, (x) => pdf(x, c, 1) / k, { color: PALETTE[i % PALETTE.length], lw: 1.8, dash: [5, 4] });
    });
    // 混合密度
    curve(f, v, (x) => centers.reduce((a, c) => a + pdf(x, c, 1) / k, 0), { color: C.accent, lw: 2.6 });

    // 样本直方图
    const rand = rng(246);
    const samples: number[] = [];
    for (let i = 0; i < 2000; i++) {
      const c = centers[Math.floor(rand() * k)];
      samples.push(c + gaussians(rand, 1)[0]);
    }
    const bins = 40;
    const counts = new Array<number>(bins).fill(0);
    const min = v.xMin;
    const max = v.xMax;
    for (const s of samples) {
      const idx = Math.floor(((s - min) / (max - min)) * bins);
      if (idx >= 0 && idx < bins) counts[idx]++;
    }
    const slot = (w - 80) / bins;
    const maxCount = Math.max(...counts);
    counts.forEach((c, i) => {
      f.ctx.save();
      f.ctx.fillStyle = 'rgba(160,174,192,0.35)';
      f.ctx.fillRect(40 + i * slot, h - 58 - (c / maxCount) * 52, slot - 1, (c / maxCount) * 52);
      f.ctx.restore();
    });

    footnotes(f, [
      `${k} 个高斯成分（虚线）叠加成混合密度（蓝线），灰色为 ${samples.length} 个样本的直方图`,
      'EM 算法交替执行 E 步（计算每个点的责任度）与 M 步（用加权样本更新参数）',
      '高斯混合是"软聚类"：每个点以概率属于多个簇，比 K-means 更灵活',
    ]);
    heading(f, '高斯混合模型');
  },
});

/** M74 最大似然估计。 */
const maxLikelihood = defineViz({
  slug: 'max-likelihood',
  title: '最大似然估计',
  params: {
    trueP: { type: 'range', min: 0.1, max: 0.9, default: 0.65, step: 0.05, label: '真实概率 p' },
    trials: { type: 'range', min: 5, max: 200, default: 40, step: 5, label: '试验次数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const trueP = num(params, 'trueP', 0.65);
    const trials = Math.round(num(params, 'trials', 40));
    const rand = rng(8917);
    let heads = 0;
    for (let i = 0; i < trials; i++) if (rand() < trueP) heads++;
    const mle = heads / trials;

    // 对数似然 L(p) = heads·ln p + (tails)·ln(1-p)
    const logLik = (p: number): number => {
      if (p <= 0 || p >= 1) return -Infinity;
      return heads * Math.log(p) + (trials - heads) * Math.log(1 - p);
    };
    const maxLL = logLik(mle);
    const v = view(f, { xMin: 0.01, xMax: 0.99, yMin: maxLL - trials * 3, yMax: maxLL + 1, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    curve(f, v, (p) => Math.max(maxLL - trials * 3, logLik(p)), { color: C.accent, lw: 2.4 });
    seg(f, v.sx(mle), v.sy(v.yMin), v.sx(mle), v.sy(maxLL), C.warm, 1.8);
    seg(f, v.sx(trueP), v.sy(v.yMin), v.sx(trueP), v.sy(maxLL), C.green, 1.4);
    dot(f, v.sx(mle), v.sy(maxLL), 5.5, C.warm);
    text(f, `MLE p̂ = ${mle.toFixed(4)}`, v.sx(mle) + 8, v.sy(maxLL) + 16, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      `${trials} 次试验出现 ${heads} 次正面：似然函数在 p̂ = ${mle.toFixed(4)} 处取最大（绿线是真值 ${trueP}）`,
      '最大似然：选择使"观测数据出现概率最大"的参数；对数似然把连乘变成求和，便于求导',
      'MLE 具有一致性与渐近有效性，但小样本有偏（如方差的 MLE 低估）；加上先验即变成最大后验（MAP）',
    ]);
    heading(f, '最大似然估计');
  },
});

/** M75 泊松过程深化。 */
const poissonProcessM75 = defineViz({
  slug: 'poisson-process-m75',
  title: '泊松过程深化',
  params: {
    lambda: { type: 'range', min: 0.5, max: 8, default: 3, step: 0.5, label: '到达率 λ' },
    window: { type: 'range', min: 1, max: 8, default: 3, label: '计数窗口长度' },
    bins: { type: 'range', min: 5, max: 25, default: 14, label: '计数分箱' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const lambda = num(params, 'lambda', 3);
    const winLen = num(params, 'window', 3);
    const bins = Math.round(num(params, 'bins', 14));
    const rand = rng(1010);

    // 在窗口内计数：N ~ Poisson(λ·窗口长度)
    const mu = lambda * winLen;
    const counts: number[] = [];
    for (let i = 0; i < 3000; i++) {
      // 泊松抽样（Knuth）
      let L = Math.exp(-mu);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= rand();
      } while (p > L && k < 200);
      counts.push(k - 1);
    }
    const maxCount = Math.max(...counts, bins);
    const hist = new Array<number>(maxCount + 1).fill(0);
    counts.forEach((c) => hist[c]++);

    const top = 56;
    const plotH = h - 170;
    const slot = (w - 80) / hist.length;
    const maxH = Math.max(...hist);
    hist.forEach((c, i) => {
      const px = 40 + i * slot;
      const bh = (c / maxH) * plotH;
      f.ctx.save();
      f.ctx.fillStyle = C.accent;
      f.ctx.fillRect(px + 1, top + plotH - bh, Math.max(1, slot - 2), bh);
      f.ctx.restore();
      text(f, String(i), px + slot / 2, top + plotH + 18, { align: 'center', color: C.dim, font: '11px sans-serif' });
    });
    // 理论泊松分布
    const theoPts: Array<[number, number]> = [];
    for (let k = 0; k <= maxCount; k++) {
      const p = Math.exp(-mu) * Math.pow(mu, k) / (() => {
        let f2 = 1;
        for (let i = 2; i <= k; i++) f2 *= i;
        return f2;
      })();
      theoPts.push([40 + k * slot + slot / 2, top + plotH - (p * counts.length / maxH) * plotH]);
    }
    poly(f, theoPts, { stroke: C.warm, lw: 2, dash: [5, 4] });

    footnotes(f, [
      `窗口长度 ${winLen}、λ = ${lambda}：均值 μ = λt = ${mu.toFixed(2)}，实测均值 ${(counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(3)}`,
      '橙色虚线是理论泊松分布 P(N=k) = e^(-μ)μᵏ/k!，与直方图高度吻合',
      '泊松分布是"稀有事件的计数分布"：当二项分布的 n 很大、p 很小时，它就是极限',
    ]);
    heading(f, '泊松过程：计数分布');
  },
});

/** M76 布朗运动深化。 */
const brownianMotionM76 = defineViz({
  slug: 'brownian-motion-m76',
  title: '布朗运动深化',
  params: {
    paths: { type: 'range', min: 20, max: 300, default: 120, step: 10, label: '轨迹数' },
    steps: { type: 'range', min: 50, max: 400, default: 200, step: 25, label: '时间步数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const paths = Math.round(num(params, 'paths', 120));
    const steps = Math.round(num(params, 'steps', 200));
    const rand = rng(54321);
    const dt = 1 / steps;

    // 终点分布
    const endpoints: number[] = [];
    const envelopes: Array<Array<[number, number]>> = [[], []];
    for (let p = 0; p < paths; p++) {
      let x = 0;
      for (let i = 0; i < steps; i++) x += gaussians(rand, 1)[0] * Math.sqrt(dt);
      endpoints.push(x);
    }
    // 理论包络 ±√t
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      envelopes[0].push([t, Math.sqrt(t)]);
      envelopes[1].push([t, -Math.sqrt(t)]);
    }

    const halfW = Math.ceil(w / 2) - 30;
    // 左：若干轨迹
    const vL = view(f, { xMin: 0, xMax: 1, yMin: -2.4, yMax: 2.4, inset: 30, insetRight: w / 2 });
    grid(f, vL, { divisions: 4, ticks: true });
    envelopes.forEach((env) => poly(f, env.map(([t, y]) => [vL.sx(t), vL.sy(y)] as [number, number]), { stroke: `${C.warm}aa`, lw: 1.4, dash: [5, 4] }));
    const samplePaths = Math.min(8, paths);
    for (let p = 0; p < samplePaths; p++) {
      let x = 0;
      const pts: Array<[number, number]> = [[vL.sx(0), vL.sy(0)]];
      for (let i = 1; i <= steps; i++) {
        x += gaussians(rand, 1)[0] * Math.sqrt(dt);
        pts.push([vL.sx(i / steps), vL.sy(x)]);
      }
      poly(f, pts, { stroke: `${PALETTE[p % PALETTE.length]}99`, lw: 1.2 });
    }

    // 右：终点分布 vs N(0,1)
    const vR = view(f, { xMin: -3, xMax: 3, yMin: 0, yMax: 0.6, inset: 30, insetRight: 20 });
    const bins = 24;
    const hist = new Array<number>(bins).fill(0);
    endpoints.forEach((e) => {
      const idx = Math.floor(((e + 3) / 6) * bins);
      if (idx >= 0 && idx < bins) hist[idx]++;
    });
    const maxH = Math.max(...hist);
    const slotS = (w / 2 - 120) / bins;
    hist.forEach((c, i) => {
      const px = w / 2 + 40 + i * slotS;
      f.ctx.save();
      f.ctx.fillStyle = 'rgba(102,126,234,0.7)';
      f.ctx.fillRect(px, 56 + (h - 170) - (c / maxH) * (h - 170), Math.max(1, slotS - 1), (c / maxH) * (h - 170));
      f.ctx.restore();
    });
    const pdfPts: Array<[number, number]> = [];
    for (let i = 0; i <= 100; i++) {
      const x = -3 + (i / 100) * 6;
      pdfPts.push([vR.sx(x), 56 + (h - 170) - (pdf(x) / 0.6) * (h - 170)]);
    }
    poly(f, pdfPts, { stroke: C.warm, lw: 2.2 });
    text(f, '终点分布 vs N(0,1)', w / 2 + 44, 46, { color: C.warm, font: '12px sans-serif' });

    const mean = endpoints.reduce((a, b) => a + b, 0) / paths;
    const variance = endpoints.reduce((a, b) => a + (b - mean) ** 2, 0) / paths;
    footnotes(f, [
      `左：${samplePaths} 条样本轨迹与 ±√t 包络；右：${paths} 个终点的分布`,
      `终点均值 ${mean.toFixed(4)}（理论 0），方差 ${variance.toFixed(4)}（理论 t = 1）`,
      '布朗运动的尺度性质：B(t) ~ N(0, t)，增量独立且平稳，路径处处连续处处不可导',
    ]);
    heading(f, '布朗运动：轨迹与终点分布');
  },
});

/** M77 随机游走深化。 */
const randomWalkM77 = defineViz({
  slug: 'random-walk-m77',
  title: '随机游走深化',
  params: {
    steps: { type: 'range', min: 100, max: 3000, default: 1000, step: 100, label: '步数' },
    trials: { type: 'range', min: 50, max: 1000, default: 400, step: 50, label: '试验次数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const steps = Math.round(num(params, 'steps', 1000));
    const trials = Math.round(num(params, 'trials', 400));
    const rand = rng(1357);

    // 一维随机游走的位移分布（应接近 N(0, n)）
    const finals: number[] = [];
    const maxAbs: number[] = [];
    for (let t = 0; t < trials; t++) {
      let x = 0;
      let peak = 0;
      for (let i = 0; i < steps; i++) {
        x += rand() < 0.5 ? 1 : -1;
        peak = Math.max(peak, Math.abs(x));
      }
      finals.push(x);
      maxAbs.push(peak);
    }
    const sd = Math.sqrt(steps);
    const bins = 30;
    const range = sd * 3.4;
    const hist = new Array<number>(bins).fill(0);
    finals.forEach((x) => {
      const idx = Math.floor(((x + range) / (2 * range)) * bins);
      if (idx >= 0 && idx < bins) hist[idx]++;
    });
    const maxH = Math.max(...hist);
    const plotH = h - 175;
    const slot = (w - 90) / bins;
    hist.forEach((c, i) => {
      const px = 45 + i * slot;
      f.ctx.save();
      f.ctx.fillStyle = C.accent;
      f.ctx.fillRect(px, 56 + plotH - (c / maxH) * plotH, Math.max(1, slot - 1.5), (c / maxH) * plotH);
      f.ctx.restore();
    });
    // 理论正态
    const v = view(f, { xMin: -3.6, xMax: 3.6, yMin: 0, yMax: 0.45, inset: 40 });
    const theo: Array<[number, number]> = [];
    for (let i = 0; i <= 120; i++) {
      const x = -3.6 + (i / 120) * 7.2;
      theo.push([v.sx(x), 56 + plotH - (pdf(x) / 0.45) * plotH]);
    }
    poly(f, theo, { stroke: C.warm, lw: 2.4 });

    const meanFinal = finals.reduce((a, b) => a + b, 0) / trials;
    const varFinal = finals.reduce((a, b) => a + (b - meanFinal) ** 2, 0) / trials;
    const meanMax = maxAbs.reduce((a, b) => a + b, 0) / trials;
    footnotes(f, [
      `${trials} 条 ${steps} 步一维随机游走的终点分布：方差 ${varFinal.toFixed(1)}（理论 ${steps}）`,
      `终点位移 ~ √n 量级（橙色为标准正态），最大偏离的平均值 ${meanMax.toFixed(1)} ≈ 0.8√n = ${(0.8 * sd).toFixed(1)}`,
      '随机游走的"√n 律"：扩散距离与时间的平方根成正比 —— 热传导、粒子扩散都遵循此规律',
    ]);
    heading(f, '随机游走：终点分布');
  },
});

/** M78 赌徒破产深化。 */
const gamblersRuinM78 = defineViz({
  slug: 'gamblers-ruin-m78',
  title: '赌徒破产深化',
  params: {
    capital: { type: 'range', min: 1, max: 20, default: 10, label: '赌本 i' },
    targetCap: { type: 'range', min: 5, max: 40, default: 30, label: '目标 N' },
    p: { type: 'range', min: 0.3, max: 0.7, default: 0.49, step: 0.01, label: '胜率 p' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const i = Math.round(num(params, 'capital', 10));
    const N = Math.max(i + 1, Math.round(num(params, 'targetCap', 30)));
    const p = num(params, 'p', 0.49);
    const q = 1 - p;

    // 破产概率曲线（随赌本 i 变化）
    const ruin = (start: number): number => {
      if (Math.abs(p - q) < 1e-9) return 1 - start / N;
      const r = q / p;
      return (Math.pow(r, start) - Math.pow(r, N)) / (1 - Math.pow(r, N));
    };
    const v = view(f, { xMin: 0, xMax: N, yMin: 0, yMax: 1, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    const pts: Array<[number, number]> = [];
    for (let start = 0; start <= N; start++) pts.push([v.sx(start), v.sy(ruin(start))]);
    poly(f, pts, { stroke: C.hot, lw: 2.6 });
    dot(f, v.sx(i), v.sy(ruin(i)), 5.5, C.warm);
    text(f, `${i} 元起步：破产概率 ${(ruin(i) * 100).toFixed(2)}%`, v.sx(i) + 8, v.sy(ruin(i)) + 20, { color: C.warm, font: '12px sans-serif' });

    // 对比不同胜率
    for (const alt of [0.45, 0.5, 0.55]) {
      const r2 = (1 - alt) / alt;
      const pts2: Array<[number, number]> = [];
      for (let start = 0; start <= N; start++) {
        const val = Math.abs(alt - 0.5) < 1e-9 ? 1 - start / N : (Math.pow(r2, start) - Math.pow(r2, N)) / (1 - Math.pow(r2, N));
        pts2.push([v.sx(start), v.sy(val)]);
      }
      poly(f, pts2, { stroke: `${C.dim}66`, lw: 1.2, dash: [4, 3] });
    }

    footnotes(f, [
      `赌本 ${i}、目标 ${N}、胜率 p = ${p}：破产概率 = ${(ruin(i) * 100).toFixed(3)}%`,
      `灰色虚线分别是 p = 0.45、0.5、0.55 的破产概率曲线 —— 胜率只差 5% 结果天差地别`,
      '赌本有限、对手资金无限时，即使公平博弈（p = 0.5）最终也必然破产：这是"赌徒破产定律"',
    ]);
    heading(f, '赌徒破产：赌本与胜率的影响');
  },
});

/** M79 优惠券收集深化。 */
const couponCollectorM79 = defineViz({
  slug: 'coupon-collector-m79',
  title: '优惠券收集深化',
  params: {
    kinds: { type: 'range', min: 5, max: 60, default: 25, label: '种类数 n' },
    trials: { type: 'range', min: 200, max: 2000, default: 600, step: 100, label: '模拟次数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'kinds', 25));
    const trials = Math.round(num(params, 'trials', 600));
    const rand = rng(9753);
    const results: number[] = [];
    for (let t = 0; t < trials; t++) {
      const seen = new Set<number>();
      let draws = 0;
      while (seen.size < n) {
        seen.add(Math.floor(rand() * n));
        draws++;
      }
      results.push(draws);
    }
    const mean = results.reduce((a, b) => a + b, 0) / trials;
    let H = 0;
    for (let k = 1; k <= n; k++) H += 1 / k;
    const theory = n * H;

    // 理论曲线：收集到 k 种的期望步数
    const v = view(f, { xMin: 0, xMax: n, yMin: 0, yMax: theory * 1.25, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    const pts: Array<[number, number]> = [];
    let cumulative = 0;
    for (let k = 0; k <= n; k++) {
      if (k > 0) cumulative += n / (n - k + 1);
      pts.push([v.sx(k), v.sy(k === 0 ? 0 : cumulative)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.4 });
    seg(f, v.sx(0), v.sy(theory), v.sx(n), v.sy(theory), C.green, 1.4);
    dot(f, v.sx(n), v.sy(theory), 5.5, C.warm);
    text(f, `n·Hₙ = ${theory.toFixed(1)}`, v.sx(n) - 8, v.sy(theory) - 8, { color: C.green, align: 'right', font: '12px sans-serif' });

    footnotes(f, [
      `n = ${n}：理论期望 ${theory.toFixed(2)} = n(1 + 1/2 + … + 1/n)，${trials} 次模拟得 ${mean.toFixed(2)}`,
      `最后一张券的期望抽取次数是 ${n} 次 —— 所有难度都集中在收尾阶段（曲线末段斜率变陡）`,
      '优惠券收集与"生日悖论"同源：都是"等概率采样直到覆盖"的期望时间问题',
    ]);
    heading(f, '优惠券收集：期望步数曲线');
  },
});

/** M80 伯努利试验。 */
const bernoulli = defineViz({
  slug: 'bernoulli',
  title: '伯努利试验',
  params: {
    p: { type: 'range', min: 0.05, max: 0.95, default: 0.35, step: 0.05, label: '成功概率 p' },
    n: { type: 'range', min: 5, max: 60, default: 20, label: '试验次数 n' },
    mode: { type: 'select', options: ['成功次数分布', '首次成功位置'], default: '成功次数分布', label: '查看' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const p = num(params, 'p', 0.35);
    const n = Math.round(num(params, 'n', 20));
    const mode = str(params, 'mode', '成功次数分布');
    const Cnk = (nn: number, kk: number): number => {
      let r = 1;
      for (let i = 1; i <= kk; i++) r = (r * (nn - kk + i)) / i;
      return r;
    };

    const top = 56;
    const plotH = h - 175;
    const slot = (w - 90) / (n + 1);
    for (let k = 0; k <= n; k++) {
      if (mode === '成功次数分布') {
        const prob = Cnk(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
        const bh = prob * plotH * 1.4;
        const px = 45 + k * slot;
        f.ctx.save();
        f.ctx.fillStyle = C.accent;
        f.ctx.fillRect(px + 1, top + plotH - bh, Math.max(1, slot - 2), bh);
        f.ctx.restore();
        if (k % 2 === 0 && slot > 14) text(f, String(k), px + slot / 2, top + plotH + 18, { align: 'center', color: C.dim, font: '10px sans-serif' });
      } else {
        const prob = Math.pow(1 - p, k - 1) * p;
        const bh = Math.min(plotH, prob * plotH * 2);
        const px = 45 + (k - 1) * slot;
        f.ctx.save();
        f.ctx.fillStyle = C.warm;
        f.ctx.fillRect(px + 1, top + plotH - bh, Math.max(1, slot - 2), bh);
        f.ctx.restore();
        if (k <= 6 || k % 5 === 0) text(f, String(k), px + slot / 2, top + plotH + 18, { align: 'center', color: C.dim, font: '10px sans-serif' });
      }
    }
    const mean = mode === '成功次数分布' ? n * p : 1 / p;
    const variance = mode === '成功次数分布' ? n * p * (1 - p) : (1 - p) / (p * p);
    seg(f, 45, top + plotH, 45 + (n + 1) * slot, top + plotH, C.dim, 1);

    footnotes(f, [
      mode === '成功次数分布'
        ? `二项分布 B(${n}, ${p})：均值 np = ${mean.toFixed(3)}，方差 np(1-p) = ${variance.toFixed(3)}`
        : `几何分布 Geom(${p})：首次成功所需次数的均值 1/p = ${mean.toFixed(3)}，方差 ${variance.toFixed(3)}`,
      mode === '成功次数分布' ? '成功次数 = n 次独立伯努利试验中成功的总数（n 大时逼近正态）' : '几何分布具有"无记忆性"：已经失败 k 次后，还需等待的分布与最开始相同',
      '伯努利试验是一切离散概率分布的原子：0/1 结果、独立、概率恒定',
    ]);
    heading(f, `伯努利试验：${mode}`);
  },
});

/** M81 本福德定律深化。 */
const benfordsLawM81 = defineViz({
  slug: 'benfords-law-m81',
  title: '本福德定律深化',
  params: {
    digits: { type: 'range', min: 1, max: 5, default: 2, label: '首位数字位数' },
    count: { type: 'range', min: 100, max: 3000, default: 1200, step: 100, label: '样本数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const digitsN = Math.round(num(params, 'digits', 2));
    const count = Math.round(num(params, 'count', 1200));
    const rand = rng(2718);
    // 对数均匀分布（真正的本福德分布）
    const keys: string[] = [];
    const leading = new Map<string, number>();
    for (let i = 0; i < count; i++) {
      const value = Math.pow(10, rand() * 5 - 1);
      const s = value.toFixed(8).replace(/^0+\.?/, '').replace('.', '');
      const key = s.slice(0, Math.min(digitsN, s.length));
      keys.push(key);
      leading.set(key, (leading.get(key) ?? 0) + 1);
    }

    const top = 56;
    const plotH = h - 180;
    const sortedKeys = [...leading.keys()].sort();
    const shown = sortedKeys.slice(0, digitsN === 1 ? 9 : 18);
    const slot = (w - 90) / shown.length;
    const maxCount = Math.max(...shown.map((k) => leading.get(k) ?? 0));
    shown.forEach((k, i) => {
      const c = leading.get(k) ?? 0;
      const bh = (c / maxCount) * plotH;
      const px = 45 + i * slot;
      const theory = Math.log10(1 + Number(k) / Math.pow(10, k.length - 1));
      const theoryH = (theory / (maxCount / count)) * plotH;
      f.ctx.save();
      f.ctx.fillStyle = C.accent;
      f.ctx.fillRect(px + 1, top + plotH - bh, Math.max(1, slot * 0.55), bh);
      f.ctx.fillStyle = C.warm;
      f.ctx.fillRect(px + slot * 0.6, top + plotH - theoryH, Math.max(1, slot * 0.35), theoryH);
      f.ctx.restore();
      if (slot > 18) text(f, k, px + slot / 2, top + plotH + 18, { align: 'center', color: C.dim, font: '10px sans-serif' });
    });
    seg(f, 45, top + plotH, 45 + shown.length * slot, top + plotH, C.dim, 1);

    footnotes(f, [
      `${count} 个对数均匀随机数的前 ${digitsN} 位数字分布（蓝）与理论值（橙）`,
      digitsN === 1
        ? '首位为 1 的概率约 30.1%，为 9 的概率仅 4.6% —— 相差 6 倍以上'
        : '两位首位数字同样服从 log10(1+1/d) 的推广形式',
      '本福德定律用于检测数据造假（会计舞弊、伪造实验数据的第一道筛子）',
    ]);
    heading(f, '本福德定律：多位首位数字');
  },
});

/** M82 布丰投针。 */
const buffonNeedle = defineViz({
  slug: 'buffon-needle',
  title: '布丰投针',
  params: {
    needles: { type: 'range', min: 50, max: 3000, default: 600, step: 50, label: '投针次数' },
    ratio: { type: 'range', min: 0.2, max: 1, default: 0.6, step: 0.05, label: '针长/间距' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const needleCount = Math.round(num(params, 'needles', 600));
    const ratio = num(params, 'ratio', 0.6);
    const rand = rng(31416);
    const lineGap = 1;
    const needleLen = ratio * lineGap;
    let crossings = 0;

    const ox = 60;
    const oy = 60;
    const iw = w - 120;
    const ih = h - 170;
    const scale = ih / 4;

    // 平行线
    for (let i = 0; i <= 4; i++) {
      seg(f, ox, oy + i * scale, ox + iw, oy + i * scale, 'rgba(160,174,192,0.5)', 1.4);
    }
    // 投针
    for (let i = 0; i < needleCount; i++) {
      const cy = oy + rand() * 4 * scale;
      const cx = ox + rand() * iw;
      const theta = rand() * Math.PI;
      const halfLen = (needleLen / 2) * scale;
      const x1 = cx - halfLen * Math.cos(theta);
      const y1 = cy - halfLen * Math.sin(theta);
      const x2 = cx + halfLen * Math.cos(theta);
      const y2 = cy + halfLen * Math.sin(theta);
      // 判断是否跨越某条横线
      const lineBelow = Math.floor((y1 - oy) / scale);
      const lineAbove = Math.floor((y2 - oy) / scale);
      const crosses = lineBelow !== lineAbove;
      if (crosses) crossings++;
      if (i < 220) {
        seg(f, x1, y1, x2, y2, crosses ? `${C.hot}cc` : 'rgba(102,126,234,0.6)', crosses ? 1.8 : 1);
      }
    }
    // 边界取样限制在可见区域
    const piEst = crossings === 0 ? Infinity : (2 * needleLen * needleCount) / (lineGap * crossings);
    footnotes(f, [
      `投针 ${needleCount} 次，跨越平行线 ${crossings} 次（红色）`,
      `概率 = 2L/(πd) = ${(crossings / needleCount).toFixed(4)} ⇒ π ≈ 2Ln/(d·k) = ${Number.isFinite(piEst) ? piEst.toFixed(4) : '—'}（真值 ${Math.PI.toFixed(4)}）`,
      '布丰投针是"用几何概率估计 π"的经典实验，也是蒙特卡洛方法的鼻祖（1777 年）',
    ]);
    heading(f, '布丰投针：用随机投针估计 π');
  },
});

/** M83 高尔顿板。 */
const galtonBoard = defineViz({
  slug: 'galton-board',
  title: '高尔顿板',
  params: {
    rows: { type: 'range', min: 4, max: 20, default: 12, label: '钉子层数' },
    balls: { type: 'range', min: 50, max: 3000, default: 800, step: 50, label: '小球数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const rows = Math.round(num(params, 'rows', 12));
    const balls = Math.round(num(params, 'balls', 800));
    const rand = rng(1000);
    const bins = new Array<number>(rows + 1).fill(0);
    for (let i = 0; i < balls; i++) {
      let right = 0;
      for (let r = 0; r < rows; r++) if (rand() < 0.5) right++;
      bins[right]++;
    }
    const maxH = Math.max(...bins);

    // 上半部分：钉子（示意）
    const pegTop = 56;
    const pegH = (h - 210) * 0.55;
    const pegSpacing = Math.min((w - 80) / (rows + 1), pegH / rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c <= r; c++) {
        const x = w / 2 + (c - r / 2) * pegSpacing;
        const y = pegTop + r * pegSpacing;
        dot(f, x, y, 2.4, 'rgba(160,174,192,0.7)');
      }
    }
    // 下半部分：分布柱
    const binTop = pegTop + pegH + 20;
    const binH = h - binTop - 60;
    const slot = (w - 100) / (rows + 1);
    bins.forEach((count, i) => {
      const px = 50 + i * slot;
      const bh = (count / maxH) * binH;
      f.ctx.save();
      f.ctx.fillStyle = i === Math.floor(rows / 2) ? C.warm : C.accent;
      f.ctx.fillRect(px + 1, binTop + binH - bh, slot - 2, bh);
      f.ctx.restore();
    });
    // 理论二项分布
    const Cnk = (nn: number, kk: number): number => {
      let r0 = 1;
      for (let i = 1; i <= kk; i++) r0 = (r0 * (nn - kk + i)) / i;
      return r0;
    };
    const theoPts: Array<[number, number]> = [];
    for (let k = 0; k <= rows; k++) {
      const p = (Cnk(rows, k) * Math.pow(0.5, rows) * balls / maxH) * binH;
      theoPts.push([50 + k * slot + slot / 2, binTop + binH - p]);
    }
    poly(f, theoPts, { stroke: C.warm, lw: 2, dash: [5, 4] });

    const mean = bins.reduce((a, c, i) => a + c * i, 0) / balls;
    const variance = bins.reduce((a, c, i) => a + c * (i - mean) ** 2, 0) / balls;
    footnotes(f, [
      `${rows} 层钉子、${balls} 个小球：落点均值 ${mean.toFixed(3)}（理论 ${(rows / 2).toFixed(1)}），方差 ${variance.toFixed(3)}（理论 ${(rows / 4).toFixed(2)}）`,
      '橙色虚线是理论二项分布 B(n, 1/2) —— 与模拟结果吻合',
      '高尔顿板是中心极限定理的物理演示：每个小球受多次独立随机碰撞，最终位置近似正态',
    ]);
    heading(f, '高尔顿板：二项分布到正态分布');
  },
});

/** M84 集中不等式。 */
const concentration = defineViz({
  slug: 'concentration',
  title: '集中不等式',
  params: {
    n: { type: 'range', min: 5, max: 200, default: 40, step: 5, label: '样本量 n' },
    trials: { type: 'range', min: 200, max: 3000, default: 1000, step: 100, label: '模拟次数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'n', 40));
    const trials = Math.round(num(params, 'trials', 1000));
    const rand = rng(1618);
    // 经验偏离：|X̄ - 1/2| 的分布（伯努利样本）
    const deviations: number[] = [];
    for (let t = 0; t < trials; t++) {
      let sum = 0;
      for (let i = 0; i < n; i++) if (rand() < 0.5) sum++;
      deviations.push(Math.abs(sum / n - 0.5));
    }

    const v = view(f, { xMin: 0, xMax: 0.5, yMin: 0, yMax: 1.05, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });
    // 经验生存函数 P(|X̄-μ| ≥ t)
    const tail = (t: number): number => deviations.filter((d) => d >= t).length / trials;
    const empPts: Array<[number, number]> = [];
    for (let i = 0; i <= 100; i++) {
      const t = (i / 100) * 0.5;
      empPts.push([v.sx(t), v.sy(Math.max(tail(t), 1 / trials))]);
    }
    poly(f, empPts, { stroke: C.accent, lw: 2.4 });
    // Hoeffding 界：2exp(-2n t²)
    const hoef: Array<[number, number]> = [];
    for (let i = 0; i <= 100; i++) {
      const t = (i / 100) * 0.5;
      const bound = Math.min(1, 2 * Math.exp(-2 * n * t * t));
      hoef.push([v.sx(t), v.sy(Math.max(bound, 1e-4))]);
    }
    poly(f, hoef, { stroke: C.warm, lw: 2, dash: [6, 4] });
    // 切比雪夫界：1/(4n t²)
    const cheb: Array<[number, number]> = [];
    for (let i = 1; i <= 100; i++) {
      const t = (i / 100) * 0.5;
      const bound = Math.min(1, 0.25 / (n * t * t));
      cheb.push([v.sx(t), v.sy(Math.max(bound, 1e-4))]);
    }
    poly(f, cheb, { stroke: C.cool, lw: 1.6, dash: [4, 3] });

    footnotes(f, [
      `蓝线：${trials} 次模拟的实测尾概率 P(|X̄ - μ| ≥ t)；橙线：Hoeffding 界 2e^(-2nt²)；蓝绿虚线：切比雪夫界`,
      `n = ${n} 时，偏离超过 0.1 的实际概率 ${tail(0.1).toFixed(4)}，Hoeffding 界给出 ${(2 * Math.exp(-2 * n * 0.01)).toFixed(4)}`,
      '集中不等式给出"偏离大概率是多少"的严格上界，是机器学习泛化误差界与随机算法分析的基础',
    ]);
    heading(f, '集中不等式：偏离的指数衰减');
  },
});

/** M85 KL 散度。 */
const klDivergence = defineViz({
  slug: 'kl-divergence',
  title: 'KL散度',
  params: {
    pMean: { type: 'range', min: -2, max: 2, default: 0, step: 0.1, label: 'P 的均值' },
    qMean: { type: 'range', min: -2, max: 2, default: 1, step: 0.1, label: 'Q 的均值' },
    qSigma: { type: 'range', min: 0.5, max: 2.5, default: 1, step: 0.1, label: 'Q 的标准差' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const pm = num(params, 'pMean', 0);
    const qm = num(params, 'qMean', 1);
    const qs = num(params, 'qSigma', 1);
    // KL(P||Q) = ∫ p log(p/q)（数值积分）
    let kl = 0;
    const steps = 4000;
    const lo = -8;
    const hi = 8;
    const dx = (hi - lo) / steps;
    for (let i = 0; i < steps; i++) {
      const x = lo + (i + 0.5) * dx;
      const p = pdf(x, pm, 1);
      const q = pdf(x, qm, qs);
      if (p > 1e-12 && q > 1e-12) kl += p * Math.log(p / q) * dx;
    }

    const v = view(f, { xMin: -6, xMax: 6, yMin: -0.02, yMax: 0.6, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });
    curve(f, v, (x) => pdf(x, pm, 1), { color: C.accent, lw: 2.4 });
    curve(f, v, (x) => pdf(x, qm, qs), { color: C.warm, lw: 2.4 });
    // 差异区域
    for (let i = 0; i < 200; i++) {
      const x1 = -6 + (i / 200) * 12;
      const x2 = -6 + ((i + 1) / 200) * 12;
      const p1 = pdf(x1, pm, 1);
      const q1 = pdf(x1, qm, qs);
      if (p1 > q1) {
        poly(f, [[v.sx(x1), v.sy(q1)], [v.sx(x2), v.sy(q1)], [v.sx(x2), v.sy(p1)], [v.sx(x1), v.sy(p1)]], { fill: 'rgba(102,126,234,0.3)', close: true });
      }
    }
    text(f, 'P（蓝）', v.sx(pm) - 30, v.sy(pdf(pm, pm, 1)) - 10, { color: C.accent, font: '12px sans-serif' });
    text(f, 'Q（橙）', v.sx(qm) + 10, v.sy(pdf(qm, qm, qs)) - 10, { color: C.warm, font: '12px sans-serif' });

    // 反向 KL
    let klRev = 0;
    for (let i = 0; i < steps; i++) {
      const x = lo + (i + 0.5) * dx;
      const p = pdf(x, pm, 1);
      const q = pdf(x, qm, qs);
      if (p > 1e-12 && q > 1e-12) klRev += q * Math.log(q / p) * dx;
    }
    footnotes(f, [
      `KL(P‖Q) = ${kl.toFixed(5)}；KL(Q‖P) = ${klRev.toFixed(5)}（两者一般不等 —— KL 不是距离）`,
      kl < 1e-9 ? '当 P = Q 时 KL 散度为 0（这是最小值，由吉布斯不等式保证）' : '蓝色填充区域直观表示两个分布的差异程度',
      'KL 散度衡量"用 Q 编码来自 P 的数据要多付出多少比特"，是变分推断与最大似然的核心',
    ]);
    heading(f, 'KL 散度：分布之间的差异');
  },
});

registerViz(
  clt,
  monteCarloM70,
  bayesM71,
  hiddenMarkov,
  gaussianMixture,
  maxLikelihood,
  poissonProcessM75,
  brownianMotionM76,
  randomWalkM77,
  gamblersRuinM78,
  couponCollectorM79,
  bernoulli,
  benfordsLawM81,
  buffonNeedle,
  galtonBoard,
  concentration,
  klDivergence,
);
