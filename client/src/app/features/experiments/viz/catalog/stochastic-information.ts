import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, PALETTE, bars, curve, dot, footnotes, gaussians, grid, heading, poly, rng, seg, text, view } from '../canvas';

/** P28 随机过程入门。 */
const randomWalkP28 = defineViz({
  slug: 'random-walk-p28',
  title: '随机过程入门',
  params: {
    steps: { type: 'range', min: 100, max: 2000, default: 500, step: 50, label: '步数' },
    paths: { type: 'range', min: 1, max: 10, default: 5, label: '样本路径' },
    prob: { type: 'range', min: 0.3, max: 0.7, default: 0.5, step: 0.02, label: '每步+1 的概率' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const steps = Math.round(num(params, 'steps', 500));
    const paths = Math.round(num(params, 'paths', 5));
    const p = num(params, 'prob', 0.5);
    const rand = rng(1234);
    const v = view(f, { xMin: 0, xMax: steps, yMin: -Math.sqrt(steps) * 3, yMax: Math.sqrt(steps) * 3, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    // 期望带 ±σ√n
    for (const sign of [1, -1]) {
      const env: Array<[number, number]> = [];
      for (let i = 0; i <= 60; i++) {
        const n = (i / 60) * steps;
        const mean = n * (2 * p - 1);
        env.push([v.sx(n), v.sy(mean + sign * Math.sqrt(n * 4 * p * (1 - p)))]);
      }
      poly(f, env, { stroke: `${C.warm}77`, lw: 1.2, dash: [5, 4] });
    }
    for (let k = 0; k < paths; k++) {
      let x = 0;
      const pts: Array<[number, number]> = [[v.sx(0), v.sy(0)]];
      for (let i = 1; i <= steps; i++) {
        x += rand() < p ? 1 : -1;
        pts.push([v.sx(i), v.sy(x)]);
      }
      poly(f, pts, { stroke: `${PALETTE[k % PALETTE.length]}cc`, lw: 1.4 });
    }
    footnotes(f, [
      `${paths} 条独立路径，每步以概率 ${p} 上升 1、否则下降 1`,
      `橙色虚线是 ±σ√n 包络（均值 ${(2 * p - 1).toFixed(2)}n），绝大多数路径落在其中`,
      '随机过程 = 一族随机变量 {X_t}；随机游走是最基本的离散时间随机过程',
    ]);
    heading(f, '随机过程：样本路径与包络');
  },
});

/** P29 泊松过程深化。 */
const poissonProcessP29 = defineViz({
  slug: 'poisson-process-p29',
  title: '泊松过程深化',
  params: {
    lambda: { type: 'range', min: 0.5, max: 6, default: 2.5, step: 0.5, label: '到达率 λ' },
    horizon: { type: 'range', min: 5, max: 30, default: 15, label: '时间跨度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const lambda = num(params, 'lambda', 2.5);
    const horizon = Math.round(num(params, 'horizon', 15));
    const rand = rng(999);
    const days: number[] = [];
    let t = 0;
    while (t < horizon) {
      t += -Math.log(1 - rand()) / lambda;
      if (t < horizon) days.push(t);
    }
    const v = view(f, { xMin: 0, xMax: horizon, yMin: 0, yMax: Math.max(3, days.length * 0.6), inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    days.forEach((time, i) => {
      seg(f, v.sx(time), v.sy(0), v.sx(time), v.sy(i + 1), C.accent, 1.6);
      dot(f, v.sx(time), v.sy(i + 1), 3.4, C.warm);
    });
    const steps: Array<[number, number]> = [[v.sx(0), v.sy(0)]];
    days.forEach((time, i) => {
      steps.push([v.sx(time), v.sy(i)], [v.sx(time), v.sy(i + 1)]);
    });
    steps.push([v.sx(horizon), v.sy(days.length)]);
    poly(f, steps, { stroke: C.green, lw: 2.2 });
    const intervals = days.slice(1).map((x, i) => x - days[i]);
    const meanGap = intervals.length ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
    footnotes(f, [
      `λ = ${lambda}：${horizon} 个时间单位内到达 ${days.length} 次（理论 ${(lambda * horizon).toFixed(1)} 次）`,
      `绿线是计数过程 N(t)；相邻间隔服从指数分布，平均 ${meanGap.toFixed(3)}（理论 1/λ = ${(1 / lambda).toFixed(3)}）`,
      '泊松过程的三大性质：独立增量、平稳增量、稀有事件；无记忆性来自指数分布',
    ]);
    heading(f, '泊松过程：到达与计数');
  },
});

/** P30 布朗运动深化。 */
const brownianMotionP30 = defineViz({
  slug: 'brownian-motion-p30',
  title: '布朗运动深化',
  params: {
    paths: { type: 'range', min: 2, max: 400, default: 200, step: 10, label: '路径数' },
    steps: { type: 'range', min: 50, max: 400, default: 200, step: 25, label: '时间步数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const paths = Math.round(num(params, 'paths', 200));
    const steps = Math.round(num(params, 'steps', 200));
    const rand = rng(54321);
    const finals: number[] = [];
    const quadVariation = (): number => {
      let x = 0;
      let qv = 0;
      for (let i = 0; i < steps; i++) {
        const d = gaussians(rand, 1)[0] * Math.sqrt(1 / steps);
        x += d;
        qv += d * d;
      }
      return qv;
    };
    for (let i = 0; i < Math.min(paths, 300); i++) finals.push(quadVariation());
    const meanQV = finals.reduce((a, b) => a + b, 0) / Math.max(1, finals.length);
    const varianceQV = finals.reduce((a, b) => a + (b - meanQV) ** 2, 0) / Math.max(1, finals.length);

    // 二次变差的分布
    const bins = 26;
    const maxQV = Math.max(...finals);
    const minQV = Math.min(...finals);
    const counts = new Array<number>(bins).fill(0);
    finals.forEach((q) => {
      const idx = Math.min(bins - 1, Math.floor(((q - minQV) / (maxQV - minQV || 1)) * bins));
      counts[idx]++;
    });
    const top = 56;
    const plotH = h - 175;
    bars(f, counts, { x: 40, y: top, w: w - 80, h: plotH, colors: [C.accent] });
    seg(f, 40 + ((1 - minQV) / (maxQV - minQV || 1)) * (w - 80), top, 40 + ((1 - minQV) / (maxQV - minQV || 1)) * (w - 80), top + plotH, C.green, 2);

    footnotes(f, [
      `${finals.length} 条布朗路径的"二次变差"分布：均值 ${meanQV.toFixed(4)}，方差 ${varianceQV.toExponential(2)}`,
      '绿线是理论值 1（总时间）：布朗运动的二次变差收敛到 t 本身，与路径无关',
      '二次变差非零正是布朗运动"处处不可微"的量化表述（普通可微函数的二次变差为 0）',
    ]);
    heading(f, '布朗运动的二次变差');
  },
});

/** P31 SIR 传染病模型。 */
const epidemicSir = defineViz({
  slug: 'epidemic-sir',
  title: 'SIR传染病模型',
  params: {
    beta: { type: 'range', min: 0.1, max: 1.2, default: 0.6, step: 0.05, label: '传染率 β' },
    gamma: { type: 'range', min: 0.05, max: 0.8, default: 0.25, step: 0.05, label: '康复率 γ' },
    days: { type: 'range', min: 30, max: 200, default: 100, step: 10, label: '模拟天数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const beta = num(params, 'beta', 0.6);
    const gamma = num(params, 'gamma', 0.25);
    const days = Math.round(num(params, 'days', 100));
    const N = 1000;
    let S = N - 1;
    let I = 1;
    let R = 0;
    const sCurve: Array<[number, number]> = [];
    const iCurve: Array<[number, number]> = [];
    const rCurve: Array<[number, number]> = [];
    const dt = 0.1;
    let peakI = 0;
    let peakDay = 0;
    for (let d = 0; d <= days; d += dt) {
      sCurve.push([d, S]);
      iCurve.push([d, I]);
      rCurve.push([d, R]);
      if (I > peakI) {
        peakI = I;
        peakDay = d;
      }
      const dS = (-beta * S * I) / N;
      const dI = (beta * S * I) / N - gamma * I;
      const dR = gamma * I;
      S += dS * dt;
      I += dI * dt;
      R += dR * dt;
    }
    const v = view(f, { xMin: 0, xMax: days, yMin: 0, yMax: N * 1.05, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    const drawCurve = (arr: Array<[number, number]>, color: string): void =>
      poly(f, arr.map(([d, val]) => [v.sx(d), v.sy(val)] as [number, number]), { stroke: color, lw: 2.4 });
    drawCurve(sCurve, C.cool);
    drawCurve(iCurve, C.hot);
    drawCurve(rCurve, C.green);
    dot(f, v.sx(peakDay), v.sy(peakI), 5, C.warm);
    const R0 = beta / gamma;

    footnotes(f, [
      `β = ${beta}、γ = ${gamma} ⇒ 基本传染数 R₀ = β/γ = ${R0.toFixed(2)}（蓝：易感 S，红：感染 I，绿：康复 R）`,
      R0 > 1 ? `R₀ > 1：疫情扩散，峰值 ${peakI.toFixed(0)} 人（第 ${peakDay.toFixed(1)} 天）` : 'R₀ < 1：疫情自然消退',
      '群体免疫阈值 = 1 - 1/R₀ = ' + (R0 > 1 ? `${((1 - 1 / R0) * 100).toFixed(1)}%` : '—') + '；SIR 是最经典的传染病动力学模型',
    ]);
    heading(f, 'SIR 传染病模型');
  },
});

/** P32 反应扩散系统。 */
const reactionDiffusion = defineViz({
  slug: 'reaction-diffusion',
  title: '反应扩散系统',
  params: {
    feed: { type: 'range', min: 0.01, max: 0.06, default: 0.037, step: 0.001, label: '供给率 f' },
    kill: { type: 'range', min: 0.04, max: 0.07, default: 0.06, step: 0.001, label: '移除率 k' },
    steps: { type: 'range', min: 200, max: 2000, default: 900, step: 100, label: '迭代步数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const feed = num(params, 'feed', 0.037);
    const kill = num(params, 'kill', 0.06);
    const steps = Math.round(num(params, 'steps', 900));
    // Gray-Scott 模型（低分辨率以保证性能）
    const N = 90;
    const cell = Math.min((w - 90) / N, (h - 160) / N);
    let A = Array.from({ length: N }, () => new Array<number>(N).fill(1));
    let B = Array.from({ length: N }, () => new Array<number>(N).fill(0));
    for (let i = N * 0.4; i < N * 0.6; i++) {
      for (let j = N * 0.4; j < N * 0.6; j++) B[Math.floor(i)][Math.floor(j)] = 1;
    }
    const dA = 1;
    const dB = 0.5;
    const dt = 1;
    for (let s = 0; s < steps; s++) {
      const nA = A.map((r) => [...r]);
      const nB = B.map((r) => [...r]);
      for (let i = 1; i < N - 1; i++) {
        for (let j = 1; j < N - 1; j++) {
          const lapA = A[i - 1][j] + A[i + 1][j] + A[i][j - 1] + A[i][j + 1] - 4 * A[i][j];
          const lapB = B[i - 1][j] + B[i + 1][j] + B[i][j - 1] + B[i][j + 1] - 4 * B[i][j];
          const reaction = A[i][j] * B[i][j] * B[i][j];
          nA[i][j] = A[i][j] + (dA * lapA - reaction + feed * (1 - A[i][j])) * dt;
          nB[i][j] = B[i][j] + (dB * lapB + reaction - (kill + feed) * B[i][j]) * dt;
        }
      }
      A = nA;
      B = nB;
    }
    const ox = (w - N * cell) / 2;
    const oy = 56;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const bv = Math.max(0, Math.min(1, B[i][j]));
        f.ctx.save();
        f.ctx.fillStyle = `hsl(${220 - bv * 200}, 70%, ${18 + bv * 42}%)`;
        f.ctx.fillRect(ox + j * cell, oy + i * cell, cell + 0.5, cell + 0.5);
        f.ctx.restore();
      }
    }

    footnotes(f, [
      `Gray-Scott 模型，f = ${feed}、k = ${kill}，迭代 ${steps} 步`,
      '反应扩散：两种化学物质一边扩散一边反应，自发形成斑点、条纹、迷宫等图案（图灵斑图）',
      '图灵 1952 年提出：均匀状态被扩散"打破"而产生图案 —— 这是形态发生学的数学解释',
    ]);
    heading(f, '反应扩散：图灵斑图');
  },
});

/** P33 高斯过程。 */
const gaussianProcess = defineViz({
  slug: 'gaussian-process',
  title: '高斯过程',
  params: {
    lengthScale: { type: 'range', min: 0.1, max: 1.5, default: 0.5, step: 0.05, label: '长度尺度 ℓ' },
    noise: { type: 'range', min: 0.01, max: 0.4, default: 0.08, step: 0.01, label: '观测噪声 σₙ' },
    samples: { type: 'range', min: 3, max: 15, default: 8, label: '训练点数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const lengthScale = num(params, 'lengthScale', 0.5);
    const noiseLevel = num(params, 'noise', 0.08);
    const count = Math.round(num(params, 'samples', 8));
    const rand = rng(4242);
    const fn = (x: number): number => Math.sin(x * 1.4) * 1.4;
    const trainX: number[] = [];
    const trainY: number[] = [];
    for (let i = 0; i < count; i++) {
      const x = -3 + (6 * i) / Math.max(1, count - 1);
      trainX.push(x);
      trainY.push(fn(x) + gaussians(rand, 1)[0] * noiseLevel);
    }
    // RBF 核
    const k = (a: number, b: number): number => Math.exp(-((a - b) ** 2) / (2 * lengthScale * lengthScale));
    const testX: number[] = [];
    for (let i = 0; i <= 60; i++) testX.push(-3.4 + (6.8 * i) / 60);
    const K = trainX.map((a) => trainX.map((b) => k(a, b) + (a === b ? noiseLevel * noiseLevel : 0)));
    // 高斯消元求逆（小矩阵）
    const n = trainX.length;
    const aug = K.map((row, i) => [...row, trainY[i]]);
    for (let i = 0; i < n; i++) {
      let piv = i;
      for (let r = i + 1; r < n; r++) if (Math.abs(aug[r][i]) > Math.abs(aug[piv][i])) piv = r;
      [aug[i], aug[piv]] = [aug[piv], aug[i]];
      const d = aug[i][i] || 1e-9;
      for (let c = i; c <= n; c++) aug[i][c] /= d;
      for (let r = 0; r < n; r++) {
        if (r === i) continue;
        const f2 = aug[r][i];
        for (let c = i; c <= n; c++) aug[r][c] -= f2 * aug[i][c];
      }
    }
    const alpha = aug.map((row) => row[n]);
    const mean: number[] = [];
    const variance: number[] = [];
    testX.forEach((x) => {
      const ks = trainX.map((t) => k(x, t));
      const m = ks.reduce((a, kv, i) => a + kv * alpha[i], 0);
      const reduction = ks.reduce((a, kv, i) => a + kv * ks[i], 0);
      mean.push(m);
      variance.push(Math.max(1e-6, 1 - reduction));
    });
    const v = view(f, { xMin: -3.4, xMax: 3.4, yMin: -3, yMax: 3, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    curve(f, v, fn, { color: `${C.dim}88`, lw: 1.4, dash: [5, 4] });
    const upper: Array<[number, number]> = [];
    const lower: Array<[number, number]> = [];
    testX.forEach((x, i) => {
      upper.push([v.sx(x), v.sy(mean[i] + 2 * Math.sqrt(variance[i]))]);
      lower.push([v.sx(x), v.sy(mean[i] - 2 * Math.sqrt(variance[i]))]);
    });
    poly(f, [...upper, ...[...lower].reverse()], { fill: 'rgba(102,126,234,0.25)', close: true });
    poly(f, testX.map((x, i) => [v.sx(x), v.sy(mean[i])] as [number, number]), { stroke: C.accent, lw: 2.4 });
    trainX.forEach((x, i) => dot(f, v.sx(x), v.sy(trainY[i]), 4.5, C.warm));

    footnotes(f, [
      `RBF 核（ℓ = ${lengthScale}）的高斯过程：蓝色为后验均值，浅蓝带为 ±2σ`,
      '在训练点附近不确定性小（带子收窄），远离数据处又变宽（回到先验）',
      '高斯过程是"函数上的分布"：天然给出不确定性估计，广泛用于贝叶斯优化与主动学习',
    ]);
    heading(f, '高斯过程回归');
  },
});

/** P34 集中不等式深化。 */
const concentrationP34 = defineViz({
  slug: 'concentration-p34',
  title: '集中不等式深化',
  params: {
    n: { type: 'range', min: 10, max: 500, default: 100, step: 10, label: '样本量 n' },
    trials: { type: 'range', min: 500, max: 4000, default: 1500, step: 100, label: '模拟次数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'n', 100));
    const trials = Math.round(num(params, 'trials', 1500));
    const rand = rng(1618);
    const dev: number[] = [];
    for (let t = 0; t < trials; t++) {
      let sum = 0;
      for (let i = 0; i < n; i++) if (rand() < 0.5) sum++;
      dev.push(Math.abs(sum / n - 0.5));
    }
    const v = view(f, { xMin: 0, xMax: 0.5, yMin: 0, yMax: 1.05, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });
    const tail = (t: number): number => dev.filter((d) => d >= t).length / trials;
    poly(f, Array.from({ length: 120 }, (_, i) => {
      const t = (i / 120) * 0.5;
      return [v.sx(t), v.sy(Math.max(tail(t), 0.5 / trials))] as [number, number];
    }), { stroke: C.accent, lw: 2.6 });
    const hoef = Array.from({ length: 120 }, (_, i) => {
      const t = (i / 120) * 0.5;
      return [v.sx(t), v.sy(Math.min(1, 2 * Math.exp(-2 * n * t * t)))] as [number, number];
    });
    poly(f, hoef, { stroke: C.warm, lw: 2, dash: [6, 4] });
    const bern = Array.from({ length: 120 }, (_, i) => {
      const t = (i / 120) * 0.5 + 1e-4;
      return [v.sx(t), v.sy(Math.min(1, 2 * Math.exp(-2 * n * t * t / 1)))] as [number, number];
    });
    poly(f, bern, { stroke: `${C.green}88`, lw: 1.4, dash: [4, 3] });
    footnotes(f, [
      `n = ${n}：蓝线为实测尾概率 P(|X̄-μ| ≥ t)，橙线为 Hoeffding 界 2e^(-2nt²)`,
      `偏离超过 0.1 的实际概率 ${tail(0.1).toExponential(2)}，Hoeffding 界 ${(2 * Math.exp(-2 * n * 0.01)).toExponential(2)}`,
      '集中不等式给出"估计误差的指数衰减"，是机器学习泛化界（VC 维、Rademacher 复杂度）的核心工具',
    ]);
    heading(f, '集中不等式：指数衰减的尾概率');
  },
});

/** P35 KL 散度深化。 */
const klDivergenceP35 = defineViz({
  slug: 'kl-divergence-p35',
  title: 'KL散度深化',
  params: {
    pMean: { type: 'range', min: -2, max: 2, default: 0, step: 0.1, label: 'P 均值' },
    qMean: { type: 'range', min: -2, max: 2, default: 1.2, step: 0.1, label: 'Q 均值' },
    qSigma: { type: 'range', min: 0.4, max: 2.5, default: 1, step: 0.1, label: 'Q 标准差' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const pm = num(params, 'pMean', 0);
    const qm = num(params, 'qMean', 1.2);
    const qs = num(params, 'qSigma', 1);
    const pdf = (x: number, mu: number, s: number): number => Math.exp(-((x - mu) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));
    let kl = 0;
    let klRev = 0;
    const steps = 4000;
    for (let i = 0; i < steps; i++) {
      const x = -9 + (18 * (i + 0.5)) / steps;
      const p0 = pdf(x, pm, 1);
      const q0 = pdf(x, qm, qs);
      if (p0 > 1e-14 && q0 > 1e-14) {
        kl += p0 * Math.log(p0 / q0) * (18 / steps);
        klRev += q0 * Math.log(q0 / p0) * (18 / steps);
      }
    }
    const v = view(f, { xMin: -6, xMax: 6, yMin: -0.02, yMax: 0.6, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });
    curve(f, v, (x) => pdf(x, pm, 1), { color: C.accent, lw: 2.4 });
    curve(f, v, (x) => pdf(x, qm, qs), { color: C.warm, lw: 2.4 });

    // 条形对比：三种散度
    const items: Array<[string, number, string]> = [
      ['KL(P‖Q)', kl, C.hot],
      ['KL(Q‖P)', klRev, C.cool],
      ['对称化 Jensen-Shannon', (kl + klRev) / 2, C.green],
    ];
    const maxV = Math.max(...items.map(([, val]) => val), 1e-6);
    items.forEach(([label, val, color], i) => {
      const y = h - 96 + i * 26;
      text(f, label, 40, y, { color, font: '12px sans-serif' });
      const barW = (val / maxV) * (w * 0.4);
      f.ctx.save();
      f.ctx.fillStyle = color;
      f.ctx.fillRect(w * 0.42, y - 12, Math.max(1, barW), 15);
      f.ctx.restore();
      text(f, val.toFixed(5), w * 0.42 + barW + 8, y, { color: C.fg, font: '11px Consolas, monospace' });
    });

    footnotes(f, [
      `KL(P‖Q) = ${kl.toFixed(5)}，KL(Q‖P) = ${klRev.toFixed(5)} —— 两者不等，说明 KL 不是距离`,
      'Jensen-Shannon 散度 = 两者平均，对称且满足三角不等式（是真正的度量）',
      'KL 散度用于变分推断（ELBO）、变分自编码器、知识蒸馏、强化学习的策略约束',
    ]);
    heading(f, 'KL 散度与它的对称化');
  },
});

/** P36 熵编码深化。 */
const entropyCodingP36 = defineViz({
  slug: 'entropy-coding-p36',
  title: '熵编码深化',
  params: {
    p: { type: 'range', min: 0.02, max: 0.98, default: 0.7, step: 0.01, label: 'P(符号 A)' },
    blocks: { type: 'range', min: 50, max: 1500, default: 400, step: 50, label: '符号数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const p = num(params, 'p', 0.7);
    const blocks = Math.round(num(params, 'blocks', 400));
    const rand = rng(2468);
    const seq: string[] = [];
    for (let i = 0; i < blocks; i++) seq.push(rand() < p ? 'A' : 'B');
    const countA = seq.filter((s) => s === 'A').length;
    const countB = blocks - countA;
    const H = -(p > 0 ? p * Math.log2(p) : 0) - (1 - p > 0 ? (1 - p) * Math.log2(1 - p) : 0);
    // 固定长度编码：1 bit/符号
    const fixedBits = blocks;
    // 算术编码的理想长度 ≈ nH
    const idealBits = blocks * H;

    const top = 56;
    const plotH = h - 200;
    const slot = (w - 100) / blocks;
    seq.forEach((s, i) => {
      const x = 50 + i * slot;
      f.ctx.save();
      f.ctx.fillStyle = s === 'A' ? C.accent : C.warm;
      f.ctx.fillRect(x, top, Math.max(1, slot - 0.5), plotH * 0.5);
      f.ctx.restore();
    });
    text(f, `序列（A 占 ${((countA / blocks) * 100).toFixed(1)}%）`, 50, top - 8, { color: C.dim, font: '11px sans-serif' });

    // 编码长度对比
    const items: Array<[string, number, string]> = [
      ['固定长度编码（1 bit/符号）', fixedBits, C.cool],
      ['熵下界 nH（算术编码可达）', idealBits, C.green],
      ['哈夫曼编码（2 符号）', countA * 1 + countB * 1, C.warm],
    ];
    const maxBits = Math.max(...items.map(([, v0]) => v0));
    items.forEach(([label, bits, color], i) => {
      const y = h - 110 + i * 30;
      text(f, label, 50, y, { color, font: '12px sans-serif' });
      const barW = (bits / maxBits) * (w * 0.42);
      f.ctx.save();
      f.ctx.fillStyle = color;
      f.ctx.fillRect(w * 0.46, y - 13, Math.max(1, barW), 16);
      f.ctx.restore();
      text(f, `${bits.toFixed(0)} bit`, w * 0.46 + barW + 8, y, { color: C.fg, font: '11px Consolas, monospace' });
    });

    footnotes(f, [
      `熵 H = ${H.toFixed(4)} bit/符号 ⇒ ${blocks} 个符号的理论下界 = ${idealBits.toFixed(1)} bit`,
      '算术编码/区间编码可逼近熵下界（哈夫曼整数码长有 1 bit 内的损失）',
      '香农第一定理：无损压缩的平均码长不可能低于熵 —— 这是压缩比的理论极限',
    ]);
    heading(f, '熵编码与压缩极限');
  },
});

/** P37 汉明码与纠错。 */
const hamming = defineViz({
  slug: 'hamming',
  title: '汉明码与纠错',
  params: {
    dataBits: { type: 'range', min: 4, max: 11, default: 4, label: '数据位（4→(7,4)码）' },
    errorPos: { type: 'range', min: 0, max: 7, default: 3, label: '注入错误位置（0=无）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const dataBits = Math.round(num(params, 'dataBits', 4));
    const errorPos = Math.round(num(params, 'errorPos', 3));
    // (7,4) 或 (15,11) 汉明码
    const n = dataBits === 4 ? 7 : 15;
    const parityBits = n - dataBits;
    const rand = rng(777);
    const data: number[] = Array.from({ length: dataBits }, () => (rand() < 0.5 ? 0 : 1));
    // 放置数据位（跳过 2 的幂位置）
    const code: number[] = new Array(n + 1).fill(0);
    let di = 0;
    for (let i = 1; i <= n; i++) {
      if ((i & (i - 1)) !== 0) code[i] = data[di++];
    }
    // 计算校验位
    for (let pb = 0; pb < parityBits; pb++) {
      const pos = 1 << pb;
      let parity = 0;
      for (let i = 1; i <= n; i++) {
        if ((i & pos) !== 0 && i !== pos) parity ^= code[i];
      }
      code[pos] = parity;
    }
    // 注入错误
    const corrupted = [...code];
    if (errorPos > 0 && errorPos <= n) corrupted[errorPos] ^= 1;
    // 计算伴随式
    let syndrome = 0;
    for (let pb = 0; pb < parityBits; pb++) {
      const pos = 1 << pb;
      let parity = 0;
      for (let i = 1; i <= n; i++) {
        if ((i & pos) !== 0) parity ^= corrupted[i];
      }
      if (parity !== 0) syndrome += pos;
    }
    const corrected = [...corrupted];
    if (syndrome > 0 && syndrome <= n) corrected[syndrome] ^= 1;
    const ok = corrected.slice(1).join('') === code.slice(1).join('');

    // 绘制位串
    const cellW = Math.min(46, (w - 120) / n);
    const rows: Array<[string, number[], string]> = [
      ['编码后的码字', code.slice(1), C.accent],
      ['传输收到（含错误）', corrupted.slice(1), C.hot],
      ['纠错后', corrected.slice(1), C.green],
    ];
    rows.forEach(([label, arr, color], ri) => {
      const y = 80 + ri * 74;
      text(f, label, 40, y - 10, { color, font: '12px sans-serif' });
      arr.forEach((bit, i) => {
        const pos = i + 1;
        const isParity = (pos & (pos - 1)) === 0;
        const x = 40 + i * (cellW + 4);
        f.ctx.save();
        f.ctx.fillStyle = bit === 1 ? `${color}dd` : `${color}33`;
        f.ctx.fillRect(x, y, cellW, 40);
        f.ctx.restore();
        text(f, String(bit), x + cellW / 2, y + 26, { align: 'center', color: '#fff', font: '13px Consolas, monospace' });
        text(f, isParity ? `p${pos}` : `#${pos}`, x + cellW / 2, y + 54, { align: 'center', color: isParity ? C.warm : C.dim, font: '9px sans-serif' });
      });
    });
    text(f, `伴随式 = ${syndrome}${syndrome > 0 ? `（指向第 ${syndrome} 位出错）` : '（无错误）'} ⇒ ${ok ? '纠错成功 ✓' : '纠错失败'}`, 40, 80 + 3 * 74 + 20, {
      color: ok ? C.green : C.hot,
      font: '13px "Segoe UI", system-ui, sans-serif',
    });

    footnotes(f, [
      `(${n},${dataBits}) 汉明码：${dataBits} 位数据 + ${parityBits} 位校验，可纠正 1 位错误`,
      `伴随式直接给出错误位置（二进制 = 出错位的编号），因此纠错只需一次异或`,
      '汉明距离 d = 3 时能纠 1 位错、检 2 位错；现代纠错码（LDPC、Polar）在其基础上大幅提升效率',
    ]);
    heading(f, `(${n},${dataBits}) 汉明码：一位纠错`);
  },
});

/** P38 信息论深化。 */
const entropyCodingP38 = defineViz({
  slug: 'entropy-coding-p38',
  title: '信息论深化',
  params: {
    symbols: { type: 'range', min: 2, max: 8, default: 4, label: '符号数' },
    skew: { type: 'range', min: 0, max: 1, default: 0.6, step: 0.05, label: '分布偏斜度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const symbols = Math.round(num(params, 'symbols', 4));
    const skew = num(params, 'skew', 0.6);
    // 生成偏斜分布
    const raw = Array.from({ length: symbols }, (_, i) => Math.pow(skew + 0.01, i));
    const total = raw.reduce((a, b) => a + b, 0);
    const probs = raw.map((x) => x / total);
    const H = -probs.reduce((a, p) => a + (p > 0 ? p * Math.log2(p) : 0), 0);
    const Hmax = Math.log2(symbols);

    // 哈夫曼编码
    const nodes: Array<{ p: number; codes: string[] }> = probs.map((p, i) => ({ p, codes: [String.fromCharCode(65 + i)] }));
    const arr = [...nodes];
    while (arr.length > 1) {
      arr.sort((a, b) => a.p - b.p);
      const a = arr.shift() as typeof nodes[0];
      const b = arr.shift() as typeof nodes[0];
      arr.push({ p: a.p + b.p, codes: [...a.codes.map((c) => '0' + c), ...b.codes.map((c) => '1' + c)] });
    }
    const assignment = new Map<string, string>();
    if (arr.length === 1) {
      arr[0].codes.forEach((item) => {
        const sym = item.slice(-1);
        assignment.set(sym, item.slice(0, -1) || '0');
      });
    }
    const lengths = probs.map((_, i) => (assignment.get(String.fromCharCode(65 + i)) ?? '').length);
    const avgLen = probs.reduce((a, p, i) => a + p * lengths[i], 0);

    const top = 60;
    const plotH = h - 200;
    const slot = (w - 100) / symbols;
    probs.forEach((p, i) => {
      const x = 50 + i * slot;
      const bh = p * plotH;
      f.ctx.save();
      f.ctx.fillStyle = PALETTE[i % PALETTE.length];
      f.ctx.fillRect(x + slot * 0.2, top + plotH - bh, slot * 0.6, bh);
      f.ctx.restore();
      text(f, `${(p * 100).toFixed(1)}%`, x + slot / 2, top + plotH - bh - 8, { align: 'center', color: C.fg, font: '12px sans-serif' });
      text(f, String.fromCharCode(65 + i), x + slot / 2, top + plotH + 20, { align: 'center', color: C.dim, font: '12px sans-serif' });
      text(f, `码长 ${lengths[i]}`, x + slot / 2, top + plotH + 40, { align: 'center', color: C.cool, font: '11px sans-serif' });
      text(f, assignment.get(String.fromCharCode(65 + i)) ?? '', x + slot / 2, top + plotH - bh - 28, { align: 'center', color: C.warm, font: '12px Consolas, monospace' });
    });
    seg(f, 50, top + plotH, 50 + symbols * slot, top + plotH, C.dim, 1);

    footnotes(f, [
      `熵 H = ${H.toFixed(4)} bit ≤ Hmax = log₂${symbols} = ${Hmax.toFixed(4)} bit；哈夫曼平均码长 ${avgLen.toFixed(4)} bit`,
      `冗余 = 平均码长 - 熵 = ${(avgLen - H).toFixed(4)} bit（哈夫曼不超过 1 bit，算术编码可趋近 0）`,
      '信息论的核心：概率分布决定信息量，熵给出压缩下界，互信息给出信道容量',
    ]);
    heading(f, '信息论：熵、码长与冗余');
  },
});

/** P39 互信息深化。 */
const mutualInformationP39 = defineViz({
  slug: 'mutual-information-p39',
  title: '互信息深化',
  params: {
    correlation: { type: 'range', min: 0, max: 0.95, default: 0.5, step: 0.05, label: '相关性 ρ' },
    bins: { type: 'range', min: 4, max: 24, default: 12, label: '分箱数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const rho = num(params, 'correlation', 0.5);
    const bins = Math.round(num(params, 'bins', 12));
    const rand = rng(8899);
    const N = 4000;
    const joint = Array.from({ length: bins }, () => new Array<number>(bins).fill(0));
    for (let i = 0; i < N; i++) {
      const x = gaussians(rand, 1)[0];
      const y = rho * x + Math.sqrt(1 - rho * rho) * gaussians(rand, 1)[0];
      const bx = Math.min(bins - 1, Math.max(0, Math.floor(((x + 3) / 6) * bins)));
      const by = Math.min(bins - 1, Math.max(0, Math.floor(((y + 3) / 6) * bins)));
      joint[bx][by]++;
    }
    const px = joint.map((row) => row.reduce((a, b) => a + b, 0) / N);
    const py = joint[0].map((_, j) => joint.reduce((a, row) => a + row[j], 0) / N);
    let mi = 0;
    for (let i = 0; i < bins; i++) {
      for (let j = 0; j < bins; j++) {
        const pj = joint[i][j] / N;
        if (pj > 0 && px[i] > 0 && py[j] > 0) mi += pj * Math.log2(pj / (px[i] * py[j]));
      }
    }
    const theory = -0.5 * Math.log2(1 - rho * rho);
    // 热图
    const cell = Math.min((w - 120) / bins, (h - 190) / bins);
    const ox = (w - bins * cell) / 2;
    const oy = 60;
    const maxJoint = Math.max(...joint.flat());
    for (let i = 0; i < bins; i++) {
      for (let j = 0; j < bins; j++) {
        const val = joint[i][j] / maxJoint;
        f.ctx.save();
        f.ctx.fillStyle = `hsla(230, 65%, ${16 + val * 50}%, 0.95)`;
        f.ctx.fillRect(ox + j * cell, oy + i * cell, cell - 1, cell - 1);
        f.ctx.restore();
      }
    }
    text(f, `联合分布 P(X,Y)（估计 I = ${mi.toFixed(4)} bit，理论 ${theory.toFixed(4)} bit）`, ox, oy - 10, { color: C.dim, font: '12px sans-serif' });

    footnotes(f, [
      `相关系数 ρ = ${rho}：互信息估计 ${mi.toFixed(4)} bit，理论值 -½log₂(1-ρ²) = ${theory.toFixed(4)} bit`,
      '互信息 I(X;Y) = H(X) + H(Y) − H(X,Y)：知道 X 后 Y 的不确定性减少了多少',
      '互信息对非线性依赖敏感（相关系数只测线性），是特征选择的常用准则',
    ]);
    heading(f, '互信息：联合分布的信息量');
  },
});

/** P40 相对熵深化。 */
const klDivergenceP40 = defineViz({
  slug: 'kl-divergence-p40',
  title: '相对熵深化',
  params: {
    bins: { type: 'range', min: 4, max: 16, default: 8, label: '分布桶数' },
    shift: { type: 'range', min: 0, max: 3, default: 1, label: '分布偏移' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const bins = Math.round(num(params, 'bins', 8));
    const shift = Math.round(num(params, 'shift', 1));
    const p = Array.from({ length: bins }, (_, i) => Math.exp(-((i - bins / 3) ** 2) / 4));
    const q = Array.from({ length: bins }, (_, i) => Math.exp(-((i - bins / 3 - shift) ** 2) / 4));
    const sumP = p.reduce((a, b) => a + b, 0);
    const sumQ = q.reduce((a, b) => a + b, 0);
    const P = p.map((x) => x / sumP);
    const Q = q.map((x) => x / sumQ);
    const klPQ = P.reduce((a, pi, i) => a + (pi > 0 && Q[i] > 0 ? pi * Math.log2(pi / Q[i]) : 0), 0);
    const klQP = P.reduce((a, pi, i) => a + (pi > 0 && Q[i] > 0 ? Q[i] * Math.log2(Q[i] / pi) : 0), 0);

    const top = 60;
    const plotH = h - 210;
    const slot = (w - 100) / bins;
    P.forEach((pi, i) => {
      const x = 50 + i * slot;
      f.ctx.save();
      f.ctx.fillStyle = C.accent;
      f.ctx.fillRect(x + slot * 0.1, top + plotH - pi * plotH * 1.6, slot * 0.4, pi * plotH * 1.6);
      f.ctx.fillStyle = C.warm;
      f.ctx.fillRect(x + slot * 0.5, top + plotH - Q[i] * plotH * 1.6, slot * 0.4, Q[i] * plotH * 1.6);
      f.ctx.restore();
      if (slot > 24) text(f, String(i), x + slot / 2, top + plotH + 18, { align: 'center', color: C.dim, font: '10px sans-serif' });
    });
    seg(f, 50, top + plotH, 50 + bins * slot, top + plotH, C.dim, 1);
    text(f, 'P（蓝）与 Q（橙）', 50, top - 10, { color: C.dim, font: '12px sans-serif' });

    footnotes(f, [
      `KL(P‖Q) = ${klPQ.toFixed(4)} bit，KL(Q‖P) = ${klQP.toFixed(4)} bit（偏移 ${shift} 个桶）`,
      'KL(P‖Q) 可以理解为"用 Q 的编码方案去编码 P 的数据，平均多花的比特数"',
      '交叉熵 H(P,Q) = H(P) + KL(P‖Q)：这就是机器学习分类损失函数的理论来源',
    ]);
    heading(f, '相对熵与交叉熵');
  },
});

/** P41 香农编码。 */
const shannonCoding = defineViz({
  slug: 'shannon-coding',
  title: '香农编码',
  params: {
    symbols: { type: 'range', min: 3, max: 7, default: 5, label: '符号数' },
    decay: { type: 'range', min: 0.3, max: 0.9, default: 0.5, step: 0.05, label: '概率衰减比' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const symbols = Math.round(num(params, 'symbols', 5));
    const decay = num(params, 'decay', 0.5);
    const raw = Array.from({ length: symbols }, (_, i) => Math.pow(decay, i));
    const total = raw.reduce((a, b) => a + b, 0);
    const probs = raw.map((x) => x / total);
    // 香农编码：码长 = ⌈-log2(p)⌉
    const lengths = probs.map((p) => Math.ceil(-Math.log2(p)));
    let cumulative = 0;
    const codes: string[] = [];
    probs.forEach((p, i) => {
      const len = lengths[i];
      // 用累积概率的二进制展开（截取 len 位）
      const frac = cumulative;
      let bin = '';
      let x = frac;
      for (let k = 0; k < len; k++) {
        x *= 2;
        bin += x >= 1 ? '1' : '0';
        if (x >= 1) x -= 1;
      }
      codes.push(bin);
      cumulative += p;
    });
    const H = -probs.reduce((a, p) => a + p * Math.log2(p), 0);
    const avgLen = probs.reduce((a, p, i) => a + p * lengths[i], 0);

    const top = 60;
    const plotH = h - 220;
    const slot = (w - 100) / symbols;
    probs.forEach((p, i) => {
      const x = 50 + i * slot;
      const bh = p * plotH * 1.2;
      f.ctx.save();
      f.ctx.fillStyle = PALETTE[i % PALETTE.length];
      f.ctx.fillRect(x + slot * 0.15, top + plotH - bh, slot * 0.7, bh);
      f.ctx.restore();
      text(f, `p=${p.toFixed(3)}`, x + slot / 2, top + plotH - bh - 8, { align: 'center', color: C.fg, font: '11px Consolas, monospace' });
      text(f, `⌈-log₂p⌉=${lengths[i]}`, x + slot / 2, top + plotH - bh - 26, { align: 'center', color: C.cool, font: '11px sans-serif' });
      text(f, codes[i], x + slot / 2, top + plotH + 20, { align: 'center', color: C.warm, font: '12px Consolas, monospace' });
      text(f, String.fromCharCode(65 + i), x + slot / 2, top + plotH + 42, { align: 'center', color: C.dim, font: '11px sans-serif' });
    });
    seg(f, 50, top + plotH, 50 + symbols * slot, top + plotH, C.dim, 1);

    footnotes(f, [
      `熵 H = ${H.toFixed(4)} bit；香农编码平均码长 L = ${avgLen.toFixed(4)} bit（满足 H ≤ L < H+1）`,
      '香农编码：码长取 ⌈-log₂p⌉，用累积概率的二进制展开作为码字 —— 是第一个系统化构造的熵编码',
      '香农第一定理：任何唯一可译码的平均码长都不小于熵；香农编码给出了达到下界的方法（虽然非最优）',
    ]);
    heading(f, '香农编码：逼近熵下界');
  },
});

/** P42 卷积码。 */
const convolutional = defineViz({
  slug: 'convolutional',
  title: '卷积码',
  params: {
    constraint: { type: 'range', min: 2, max: 4, default: 3, label: '约束长度 K' },
    bits: { type: 'range', min: 4, max: 14, default: 8, label: '输入比特数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const K = Math.round(num(params, 'constraint', 3));
    const nbits = Math.round(num(params, 'bits', 8));
    const rand = rng(3141);
    const input: number[] = Array.from({ length: nbits }, () => (rand() < 0.5 ? 0 : 1));
    // 生成多项式（K=3 时 g1 = 111, g2 = 101）
    const g1: number[] = K === 3 ? [1, 1, 1] : K === 2 ? [1, 1] : [1, 1, 0, 1];
    const g2: number[] = K === 3 ? [1, 0, 1] : K === 2 ? [1, 0] : [1, 0, 1, 1];
    const reg: number[] = new Array(K).fill(0);
    const out1: number[] = [];
    const out2: number[] = [];
    input.forEach((bit) => {
      reg.unshift(bit);
      reg.pop();
      let s1 = 0;
      let s2 = 0;
      g1.forEach((g, i) => (s1 ^= g & reg[i]));
      g2.forEach((g, i) => (s2 ^= g & reg[i]));
      out1.push(s1);
      out2.push(s2);
    });
    const encoded: number[] = [];
    input.forEach((_, i) => encoded.push(out1[i], out2[i]));

    // 状态转移（K=2 简化显示）
    const states = Math.pow(2, Math.min(K - 1, 2));
    const cx = w * 0.25;
    const cy = h / 2;
    for (let s = 0; s < states; s++) {
      const y = 70 + (s / Math.max(1, states - 1)) * (h - 200);
      dot(f, cx, y, 12, C.accent);
      text(f, `S${s}`, cx, y + 4, { align: 'center', color: '#fff', font: '10px sans-serif' });
      for (let bit = 0; bit < 2; bit++) {
        const next = ((s << 1) | bit) & (states - 1);
        const ny = 70 + (next / Math.max(1, states - 1)) * (h - 200);
        const x1 = cx + 60 + bit * 90;
        seg(f, cx + 14, y, x1, ny, bit === 0 ? 'rgba(72,187,120,0.6)' : 'rgba(245,101,101,0.6)', 1.6);
        text(f, `${bit === 0 ? '0' : '1'}`, x1, ny - 6, { align: 'center', color: bit === 0 ? C.green : C.hot, font: '10px sans-serif' });
      }
    }

    // 输入输出序列
    const cell = Math.min(24, (w * 0.5) / nbits);
    input.forEach((bit, i) => {
      const x = w * 0.58 + i * (cell + 3);
      f.ctx.save();
      f.ctx.fillStyle = bit === 1 ? C.accent : C.panel;
      f.ctx.fillRect(x, 70, cell, 26);
      f.ctx.restore();
      text(f, String(bit), x + cell / 2, 88, { align: 'center', color: '#fff', font: '11px Consolas, monospace' });
    });
    text(f, '输入', w * 0.58, 60, { color: C.dim, font: '10px sans-serif' });
    encoded.forEach((bit, i) => {
      const x = w * 0.58 + Math.floor(i / 2) * (cell + 3) + (i % 2) * (cell / 2);
      f.ctx.save();
      f.ctx.fillStyle = bit === 1 ? C.warm : C.panel;
      f.ctx.fillRect(x, 120, cell / 2 - 1, 26);
      f.ctx.restore();
    });
    text(f, `输出（每输入 1 位输出 2 位，码率 1/2，约束长度 K=${K}）`, w * 0.58, 110, { color: C.warm, font: '10px sans-serif' });

    footnotes(f, [
      `约束长度 K = ${K}：编码输出依赖最近 ${K} 个输入比特，因此有"记忆"`,
      '左图是状态转移图（绿色为输入 0、红色为输入 1）；接收端用维特比算法找最可能的路径',
      '卷积码广泛用于卫星通信、WiFi、4G/5G 控制信道；维特比译码是"最大似然序列估计"的经典实现',
    ]);
    heading(f, '卷积码与状态机');
  },
});

/** P43 LDPC 码。 */
const ldpc = defineViz({
  slug: 'ldpc',
  title: 'LDPC码',
  params: {
    rows: { type: 'range', min: 3, max: 8, default: 5, label: '校验方程数' },
    cols: { type: 'range', min: 6, max: 16, default: 10, label: '码字长度' },
    density: { type: 'range', min: 0.1, max: 0.5, default: 0.25, step: 0.05, label: '稀疏度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const rows = Math.round(num(params, 'rows', 5));
    const cols = Math.round(num(params, 'cols', 10));
    const density = num(params, 'density', 0.25);
    const rand = rng(2024);
    const H: number[][] = Array.from({ length: rows }, (_, i) =>
      Array.from({ length: cols }, (_, j): number => ((i * 7 + j * 13 + Math.floor(rand() * 3)) % 4 === 0 ? 1 : 0)),
    );
    // 确保每行每列至少有一个 1
    H.forEach((row, i) => {
      if (row.reduce((a, b) => a + b, 0) === 0) row[i % cols] = 1;
    });
    for (let c = 0; c < cols; c++) {
      if (H.every((row) => row[c] === 0)) H[c % rows][c] = 1;
    }

    // Tanner 图布局：变量节点在上、校验节点在下
    const vx = (i: number): number => 60 + ((i + 0.5) / cols) * (w - 120);
    const vy = 90;
    const cy2 = h - 110;
    const cxOf = (i: number): number => 60 + ((i + 0.5) / rows) * (w - 120);
    for (let j = 0; j < cols; j++) for (let i = 0; i < rows; i++) {
      if (H[i][j] === 1) seg(f, vx(j), vy, cxOf(i), cy2, 'rgba(102,126,234,0.55)', 1.4);
    }
    for (let j = 0; j < cols; j++) {
      dot(f, vx(j), vy, 11, C.accent);
      text(f, `v${j}`, vx(j), vy + 24, { align: 'center', color: C.dim, font: '9px sans-serif' });
    }
    for (let i = 0; i < rows; i++) {
      dot(f, cxOf(i), cy2, 11, C.warm);
      text(f, `c${i}`, cxOf(i), cy2 + 24, { align: 'center', color: C.dim, font: '9px sans-serif' });
    }
    text(f, 'Tanner 图：变量节点（上）与校验节点（下）', w / 2, 56, { align: 'center', color: C.dim, font: '12px sans-serif' });

    const totalOnes = H.flat().reduce((a, b) => a + b, 0);
    footnotes(f, [
      `${rows}×${cols} 稀疏校验矩阵 H（${totalOnes} 个 1，密度 ${((totalOnes / (rows * cols)) * 100).toFixed(1)}%）：H·cᵀ = 0`,
      'LDPC（低密度奇偶校验码）：矩阵极稀疏，因此译码复杂度与码长成正比（而不是平方）',
      '用置信传播（BP）在 Tanner 图上迭代传递消息，能逼近香农极限（0.0045 dB 以内）；5G 数据信道采用 LDPC',
    ]);
    heading(f, 'LDPC 码与 Tanner 图');
  },
});

/** P44 信道容量。 */
const channelCapacity = defineViz({
  slug: 'channel-capacity',
  title: '信道容量',
  params: {
    bandwidth: { type: 'range', min: 1, max: 20, default: 10, label: '带宽 B（MHz）' },
    snrDb: { type: 'range', min: 0, max: 40, default: 20, label: '信噪比 SNR（dB）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const bandwidth = num(params, 'bandwidth', 10);
    const snrDb = num(params, 'snrDb', 20);
    const snr = Math.pow(10, snrDb / 10);
    const capacity = bandwidth * Math.log2(1 + snr);
    const v = view(f, { xMin: 0, xMax: 40, yMin: 0, yMax: 140, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });
    // C = B log2(1+SNR) 随 SNR 变化
    for (const b of [5, 10, bandwidth]) {
      const pts: Array<[number, number]> = [];
      for (let db = 0; db <= 40; db += 1) {
        const s = Math.pow(10, db / 10);
        pts.push([v.sx(db), v.sy(b * Math.log2(1 + s))]);
      }
      poly(f, pts, { stroke: b === bandwidth ? C.accent : `${C.dim}77`, lw: b === bandwidth ? 2.6 : 1.4, dash: b === bandwidth ? [] : [5, 4] });
    }
    dot(f, v.sx(snrDb), v.sy(capacity), 6, C.warm);
    seg(f, v.sx(snrDb), v.sy(0), v.sx(snrDb), v.sy(capacity), `${C.warm}88`, 1.4);
    seg(f, v.sx(0), v.sy(capacity), v.sx(snrDb), v.sy(capacity), `${C.warm}88`, 1.4);

    footnotes(f, [
      `香农-哈特利定理：C = B·log₂(1 + SNR) = ${bandwidth} × log₂(1 + ${snr.toFixed(1)}) = ${capacity.toFixed(2)} Mbps`,
      '灰色虚线是带宽为 5、10 MHz 的曲线 —— 带宽与信噪比都能提高容量，但 SNR 需要指数级增长',
      '这是通信系统的物理上限：超过它任何编码都无法可靠传输；LDPC/Turbo/Polar 码已逼近该极限',
    ]);
    heading(f, '信道容量：香农-哈特利定理');
  },
});

/** P45 率失真理论。 */
const rateDistortion = defineViz({
  slug: 'rate-distortion',
  title: '率失真理论',
  params: {
    sigma: { type: 'range', min: 0.5, max: 4, default: 2, step: 0.1, label: '信源标准差 σ' },
    maxD: { type: 'range', min: 1, max: 8, default: 4, step: 0.5, label: '最大允许失真 D' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const sigma = num(params, 'sigma', 2);
    const maxD = num(params, 'maxD', 4);
    // 高斯信源的率失真函数 R(D) = ½log₂(σ²/D)，D ≤ σ²
    const variance = sigma * sigma;
    const v = view(f, { xMin: 0, xMax: maxD, yMin: 0, yMax: Math.max(1, 0.5 * Math.log2(Math.max(1e-6, variance / 0.05))), inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });
    const pts: Array<[number, number]> = [];
    for (let d = 0.02; d <= maxD; d += maxD / 200) {
      if (d > variance) break;
      pts.push([v.sx(d), v.sy(0.5 * Math.log2(variance / d))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.6 });
    // D = σ² 处 R = 0
    if (variance <= maxD) {
      dot(f, v.sx(variance), v.sy(0), 5.5, C.green);
      text(f, `D = σ² = ${variance.toFixed(2)} 时 R = 0（全部丢弃）`, v.sx(variance) + 8, v.sy(0) - 10, { color: C.green, font: '11px sans-serif' });
    }
    // 示例点
    const sampleD = Math.min(maxD, variance / 4);
    const sampleR = 0.5 * Math.log2(Math.max(1e-6, variance / sampleD));
    dot(f, v.sx(sampleD), v.sy(sampleR), 5, C.warm);

    footnotes(f, [
      `高斯信源 σ = ${sigma}：R(D) = ½log₂(σ²/D)，例如 D = ${sampleD.toFixed(2)} 时需要 R = ${sampleR.toFixed(3)} bit/样本`,
      '率失真函数给出"允许平均失真 D 时，最少需要多少比特"—— 这是有损压缩的理论极限',
      'D = 0 需要无限码率（无损）；D ≥ σ² 时可以一个比特都不传（信息全丢）',
    ]);
    heading(f, '率失真函数：有损压缩的极限');
  },
});

registerViz(
  randomWalkP28,
  poissonProcessP29,
  brownianMotionP30,
  epidemicSir,
  reactionDiffusion,
  gaussianProcess,
  concentrationP34,
  klDivergenceP35,
  entropyCodingP36,
  hamming,
  entropyCodingP38,
  mutualInformationP39,
  klDivergenceP40,
  shannonCoding,
  convolutional,
  ldpc,
  channelCapacity,
  rateDistortion,
);
