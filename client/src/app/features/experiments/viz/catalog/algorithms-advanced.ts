import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import {
  C,
  PALETTE,
  curve,
  dot,
  gaussians,
  grid,
  heading,
  footnotes,
  poly,
  rng,
  seg,
  text,
  view,
} from '../canvas';

/** 一维测试函数（用于优化类算法）。 */
const OBJ = (x: number): number => Math.sin(3 * x) * 0.6 + Math.cos(5 * x) * 0.3 - x * 0.15 + 1.4;

/** M54 遗传算法。 */
const geneticAlgorithm = defineViz({
  slug: 'genetic-algorithm',
  title: '遗传算法',
  params: {
    population: { type: 'range', min: 6, max: 40, default: 18, label: '种群规模' },
    generations: { type: 'range', min: 1, max: 40, default: 14, label: '迭代代数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const popSize = Math.round(num(params, 'population', 18));
    const generations = Math.round(num(params, 'generations', 14));
    const rand = rng(999);
    let pop = Array.from({ length: popSize }, () => (rand() - 0.5) * 2.6);
    const bestHistory: number[] = [];
    const meanHistory: number[] = [];
    for (let g = 0; g < generations; g++) {
      const scores = pop.map((x) => OBJ(x));
      const order = scores.map((s, i) => [i, s] as [number, number]).sort((a, b) => b[1] - a[1]);
      bestHistory.push(scores[order[0][0]]);
      meanHistory.push(scores.reduce((a, b) => a + b, 0) / popSize);
      // 选择（锦标赛）+ 交叉 + 变异
      const parents = order.slice(0, Math.max(2, Math.floor(popSize / 3))).map(([i]) => pop[i]);
      const next: number[] = [...parents];
      while (next.length < popSize) {
        const a = parents[Math.floor(rand() * parents.length)];
        const b = parents[Math.floor(rand() * parents.length)];
        const child = rand() < 0.5 ? (a + b) / 2 : a - b;
        next.push(Math.max(-1.4, Math.min(1.4, child + (rand() - 0.5) * 0.35)));
      }
      pop = next;
    }

    const v = view(f, { xMin: -1.5, xMax: 1.5, yMin: 0, yMax: 2.6, inset: 36 });
    grid(f, v, { divisions: 5, ticks: true });
    curve(f, v, OBJ, { color: C.dim, lw: 1.6, dash: [5, 4] });
    pop.forEach((x) => {
      dot(f, v.sx(x), v.sy(OBJ(x)), 3.6, `${C.accent}cc`);
      dot(f, v.sx(x), v.sy(0.06), 3, `${C.accent}55`);
    });
    const best = pop.reduce((a, b) => (OBJ(a) > OBJ(b) ? a : b), pop[0]);
    dot(f, v.sx(best), v.sy(OBJ(best)), 6, C.warm);

    footnotes(f, [
      `${generations} 代后最优个体 x = ${best.toFixed(4)}，适应度 = ${OBJ(best).toFixed(4)}`,
      `首代最优 ${bestHistory[0].toFixed(4)} → 末代最优 ${bestHistory[bestHistory.length - 1].toFixed(4)}`,
      '遗传算法：种群多样性 + 选择压力 + 变异扰动，适合梯度不可用或目标函数多峰的优化',
    ]);
    heading(f, '遗传算法：选择、交叉与变异');
  },
});

/** M55 粒子群优化。 */
const particleSwarm = defineViz({
  slug: 'particle-swarm',
  title: '粒子群优化',
  params: {
    particles: { type: 'range', min: 6, max: 50, default: 20, label: '粒子数' },
    iterations: { type: 'range', min: 5, max: 60, default: 30, label: '迭代次数' },
    inertia: { type: 'range', min: 0.1, max: 0.95, default: 0.6, step: 0.05, label: '惯性权重' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const count = Math.round(num(params, 'particles', 20));
    const iters = Math.round(num(params, 'iterations', 30));
    const inertia = num(params, 'inertia', 0.6);
    const rand = rng(2020);
    // 目标：最小化到 (0.5, 0.3) 的距离（二维）
    const fit = (p: [number, number]): number => Math.hypot(p[0] - 0.5, p[1] - 0.3) + 0.3 * Math.sin(4 * p[0]) * Math.cos(4 * p[1]);
    const target: [number, number] = [0.5, 0.3];

    const pos: Array<[number, number]> = Array.from({ length: count }, () => [(rand() - 0.5) * 2.4, (rand() - 0.5) * 2.4] as [number, number]);
    const vel: Array<[number, number]> = Array.from({ length: count }, () => [(rand() - 0.5) * 0.4, (rand() - 0.5) * 0.4] as [number, number]);
    let pBest = pos.map((p) => [p[0], p[1]] as [number, number]);
    let pBestVal = pos.map((p) => fit(p));
    let gBest: [number, number] = [pBest[0][0], pBest[0][1]];
    let gBestVal = pBestVal[0];
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < count; i++) {
        for (let d = 0; d < 2; d++) {
          const r1 = rand();
          const r2 = rand();
          vel[i][d] = inertia * vel[i][d] + 1.5 * r1 * (pBest[i][d] - pos[i][d]) + 1.5 * r2 * (gBest[d] - pos[i][d]);
          pos[i][d] += vel[i][d];
        }
        const val = fit(pos[i]);
        if (val < pBestVal[i]) {
          pBestVal[i] = val;
          pBest[i] = [pos[i][0], pos[i][1]];
          if (val < gBestVal) {
            gBestVal = val;
            gBest = [pos[i][0], pos[i][1]];
          }
        }
      }
    }

    const v = view(f, { xMin: -1.6, xMax: 1.6, yMin: -1.6, yMax: 1.6, inset: 38 });
    grid(f, v, { divisions: 5, ticks: true });
    dot(f, v.sx(target[0]), v.sy(target[1]), 7, C.green);
    dot(f, v.sx(gBest[0]), v.sy(gBest[1]), 5.5, C.warm);
    pos.forEach((p) => dot(f, v.sx(p[0]), v.sy(p[1]), 3.4, `${C.accent}cc`));

    footnotes(f, [
      `目标点 (0.5, 0.3)（绿），${count} 个粒子迭代 ${iters} 次后聚集到全局最优 (${gBest[0].toFixed(4)}, ${gBest[1].toFixed(4)})`,
      `最优适应度 = ${gBestVal.toFixed(4)}，惯性权重 w = ${inertia}`,
      '速度更新 = 惯性 + 个体认知（去自己最好处）+ 社会认知（去群体最好处），由 Kennedy 与 Eberhart 提出',
    ]);
    heading(f, '粒子群优化：群体智能');
  },
});

/** M56 模拟退火。 */
const simulatedAnnealing = defineViz({
  slug: 'simulated-annealing',
  title: '模拟退火',
  params: {
    t0: { type: 'range', min: 0.5, max: 6, default: 3, step: 0.5, label: '初始温度 T₀' },
    cooling: { type: 'range', min: 0.7, max: 0.99, default: 0.9, step: 0.01, label: '降温系数' },
    steps: { type: 'range', min: 10, max: 120, default: 60, label: '迭代步数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const t0 = num(params, 't0', 3);
    const cooling = num(params, 'cooling', 0.9);
    const steps = Math.round(num(params, 'steps', 60));
    const rand = rng(31415);
    let x = -1.2;
    let temp = t0;
    const trail: Array<[number, number]> = [[x, OBJ(x)]];
    let accepted = 0;
    let uphill = 0;
    for (let i = 0; i < steps; i++) {
      const candidate = Math.max(-1.4, Math.min(1.4, x + (rand() - 0.5) * 0.7));
      const delta = OBJ(candidate) - OBJ(x);
      if (delta > 0 || rand() < Math.exp(delta / Math.max(1e-6, temp))) {
        if (delta <= 0) uphill++;
        x = candidate;
        accepted++;
        trail.push([x, OBJ(x)]);
      }
      temp *= cooling;
    }

    const v = view(f, { xMin: -1.5, xMax: 1.5, yMin: 0, yMax: 2.6, inset: 36 });
    grid(f, v, { divisions: 5, ticks: true });
    curve(f, v, OBJ, { color: C.dim, lw: 1.6, dash: [5, 4] });
    trail.forEach(([px, py], i) => {
      dot(f, v.sx(px), v.sy(py), 3, `${PALETTE[Math.min(PALETTE.length - 1, i % PALETTE.length)]}cc`);
      if (i > 0) seg(f, v.sx(trail[i - 1][0]), v.sy(trail[i - 1][1]), v.sx(px), v.sy(py), 'rgba(160,174,192,0.25)', 1);
    });
    dot(f, v.sx(x), v.sy(OBJ(x)), 6, C.warm);

    footnotes(f, [
      `温度从 ${t0} 降到 ${(t0 * Math.pow(cooling, steps)).toExponential(2)}，最终 x = ${x.toFixed(4)}，适应度 ${OBJ(x).toFixed(4)}`,
      `共接受 ${accepted}/${steps} 步，其中"变差"的移动 ${uphill} 次（正是这些跳跃帮助跳出局部最优）`,
      '接受概率 exp(Δ/T)：温度高时几乎接受一切（探索），温度低时只接受改进（收敛）',
    ]);
    heading(f, '模拟退火：以概率接受劣解');
  },
});

/** M57 卡尔曼滤波。 */
const kalmanFilter = defineViz({
  slug: 'kalman-filter',
  title: '卡尔曼滤波',
  params: {
    processNoise: { type: 'range', min: 0.01, max: 0.6, default: 0.06, step: 0.01, label: '过程噪声 Q' },
    measureNoise: { type: 'range', min: 0.1, max: 2, default: 0.9, step: 0.1, label: '观测噪声 R' },
    steps: { type: 'range', min: 20, max: 120, default: 60, label: '步数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const q = num(params, 'processNoise', 0.06);
    const r = num(params, 'measureNoise', 0.9);
    const steps = Math.round(num(params, 'steps', 60));
    const rand = rng(7777);

    // 真实状态：匀速 + 过程噪声
    const truth: number[] = [0];
    for (let i = 1; i < steps; i++) truth.push(truth[i - 1] + 0.5 + gaussians(rand, 1)[0] * q);
    const measurements = truth.map((t) => t + gaussians(rand, 1)[0] * r);

    // 一维卡尔曼滤波
    let xEst = measurements[0];
    let p = 1;
    const est: number[] = [xEst];
    for (let i = 1; i < steps; i++) {
      // 预测
      xEst = xEst + 0.5;
      p += q * q;
      // 更新
      const k = p / (p + r * r);
      xEst = xEst + k * (measurements[i] - xEst);
      p = (1 - k) * p;
      est.push(xEst);
    }

    const v = view(f, { xMin: 0, xMax: steps - 1, yMin: -3, yMax: Math.max(...truth) + 3, inset: 36 });
    grid(f, v, { divisions: 5, ticks: true });
    poly(f, measurements.map((m, i) => [v.sx(i), v.sy(m)] as [number, number]), { stroke: 'rgba(160,174,192,0.5)', lw: 1 });
    measurements.forEach((m, i) => dot(f, v.sx(i), v.sy(m), 2, 'rgba(160,174,192,0.6)'));
    poly(f, truth.map((t, i) => [v.sx(i), v.sy(t)] as [number, number]), { stroke: C.dim, lw: 2, dash: [5, 4] });
    poly(f, est.map((t, i) => [v.sx(i), v.sy(t)] as [number, number]), { stroke: C.green, lw: 2.6 });

    const rmse = (arr: number[]): number => Math.sqrt(arr.reduce((a, v0, i) => a + (v0 - truth[i]) ** 2, 0) / arr.length);
    footnotes(f, [
      `灰色散点是带噪观测（RMSE = ${rmse(measurements).toFixed(4)}），绿线是卡尔曼滤波估计（RMSE = ${rmse(est).toFixed(4)}）`,
      `滤波把误差降低了 ${((1 - rmse(est) / rmse(measurements)) * 100).toFixed(1)}%：用"预测 + 按可信度加权修正"`,
      '卡尔曼增益 K = P/(P+R) 自动平衡"相信模型"与"相信观测"，是导航、跟踪、传感器融合的核心算法',
    ]);
    heading(f, '卡尔曼滤波：递归状态估计');
  },
});

/** M58 反向传播。 */
const backpropagation = defineViz({
  slug: 'backpropagation',
  title: '反向传播',
  params: {
    hidden: { type: 'range', min: 2, max: 6, default: 4, label: '隐藏层神经元' },
    lr: { type: 'range', min: 0.05, max: 1.5, default: 0.5, step: 0.05, label: '学习率' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const hidden = Math.round(num(params, 'hidden', 4));
    const lr = num(params, 'lr', 0.5);
    const rand = rng(606);

    // 简化：演示一条样本的反向传播梯度（数值）
    const x = 0.8;
    const target = 1;
    const w1 = Array.from({ length: hidden }, () => rand() - 0.5);
    const w2 = Array.from({ length: hidden }, () => rand() - 0.5);
    const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));
    const forward = (): { h: number[]; out: number } => {
      const hh = w1.map((wv) => sigmoid(wv * x));
      const out = sigmoid(hh.reduce((a, hv, i) => a + hv * w2[i], 0));
      return { h: hh, out };
    };
    const before = forward();
    // 反向传播一轮
    const dOut = (before.out - target) * before.out * (1 - before.out);
    const gradW2 = before.h.map((hv) => dOut * hv);
    const gradW1 = w1.map((_, i) => dOut * w2[i] * before.h[i] * (1 - before.h[i]) * x);
    const w1New = w1.map((wv, i) => wv - lr * gradW1[i]);
    const w2New = w2.map((wv, i) => wv - lr * gradW2[i]);
    const saved1 = [...w1];
    const saved2 = [...w2];
    for (let i = 0; i < hidden; i++) {
      w1[i] = w1New[i];
      w2[i] = w2New[i];
    }
    const after = forward();
    w1.splice(0, hidden, ...saved1);
    w2.splice(0, hidden, ...saved2);

    // 画网络
    const layers: number[] = [1, hidden, 1];
    const colX = [w * 0.2, w * 0.5, w * 0.8];
    const nodesPos: Array<Array<[number, number]>> = layers.map((cnt, li) => {
      return Array.from({ length: cnt }, (_, i) => [colX[li], h / 2 - (cnt - 1) * 30 + i * 60] as [number, number]);
    });
    for (let li = 0; li + 1 < layers.length; li++) {
      nodesPos[li].forEach(([x1, y1], i) => {
        nodesPos[li + 1].forEach(([x2, y2], j) => {
          const grad = li === 0 ? gradW1[j] : gradW2[j];
          const mag = Math.min(1, Math.abs(grad) * 3);
          seg(f, x1, y1, x2, y2, grad >= 0 ? `rgba(72,187,120,${0.15 + mag * 0.6})` : `rgba(245,101,101,${0.15 + mag * 0.6})`, 1 + mag * 2.5);
        });
      });
    }
    nodesPos.forEach((layer) => layer.forEach(([x1, y1]) => dot(f, x1, y1, 16, C.panel)));
    text(f, 'x', colX[0], h / 2 + 5, { align: 'center', color: C.fg, font: '12px sans-serif' });
    text(f, 'h₁…h' + hidden, colX[1], 46, { align: 'center', color: C.dim, font: '11px sans-serif' });
    text(f, 'ŷ', colX[2], h / 2 + 5, { align: 'center', color: C.fg, font: '12px sans-serif' });

    footnotes(f, [
      `一次前向 + 反向：输出 ŷ = ${before.out.toFixed(5)} → 更新后 ${after.out.toFixed(5)}，目标 ${target}`,
      `损失 ${(0.5 * (before.out - target) ** 2).toFixed(6)} → ${(0.5 * (after.out - target) ** 2).toFixed(6)}（学习率 ${lr}）`,
      '绿线为正梯度、红线为负梯度，线宽表示梯度大小 —— 反向传播就是链式法则的逐层应用',
    ]);
    heading(f, '反向传播：梯度的链式传递');
  },
});

/** M59 神经网络前向。 */
const neuralNetworkForward = defineViz({
  slug: 'neural-network-forward',
  title: '神经网络前向',
  params: {
    hidden: { type: 'range', min: 2, max: 6, default: 4, label: '隐藏层神经元' },
    activation: { type: 'select', options: ['Sigmoid', 'Tanh', 'ReLU'], default: 'ReLU', label: '激活函数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const hidden = Math.round(num(params, 'hidden', 4));
    const activation = str(params, 'activation', 'ReLU');
    const sigma = activation === 'Tanh' ? (x: number): number => Math.tanh(x)
      : activation === 'ReLU' ? (x: number): number => Math.max(0, x)
        : (x: number): number => 1 / (1 + Math.exp(-x));
    const rand = rng(2468);
    const x = [0.6, -0.4];
    const w1 = Array.from({ length: hidden }, () => [rand() - 0.5, rand() - 0.5]);
    const b1 = Array.from({ length: hidden }, () => (rand() - 0.5) * 0.4);
    const w2 = Array.from({ length: hidden }, () => rand() - 0.5);
    const hPre = w1.map((wv, i) => wv[0] * x[0] + wv[1] * x[1] + b1[i]);
    const hAct = hPre.map(sigma);
    const out = hAct.reduce((a, hv, i) => a + hv * w2[i], 0);

    const cols = [w * 0.16, w * 0.5, w * 0.84];
    const yIn = [h / 2 - 26, h / 2 + 26];
    const yHid = Array.from({ length: hidden }, (_, i) => h / 2 - ((hidden - 1) * 34) / 2 + i * 34);
    x.forEach((_, i) => yIn.forEach((y) => dot(f, cols[0], y, 15, C.accent)));
    hPre.forEach((pre, i) => {
      const active = Math.max(0, Math.min(1, hAct[i]));
      const col = activation === 'ReLU' ? (hAct[i] > 0 ? C.green : C.panel) : `hsl(${230 - active * 120}, 60%, ${30 + active * 30}%)`;
      dot(f, cols[1], yHid[i], 15, col);
      text(f, pre.toFixed(2), cols[1] + 20, yHid[i] + 4, { color: C.dim, font: '10px sans-serif' });
    });
    dot(f, cols[2], h / 2, 15, C.warm);
    x.forEach((xv, i) => {
      text(f, `x${i + 1}=${xv}`, cols[0] - 24, yIn[i] + 4, { align: 'right', color: C.dim, font: '11px sans-serif' });
      yHid.forEach((yh, j) => seg(f, cols[0], yIn[i], cols[1], yh, 'rgba(160,174,192,0.25)', 1));
    });
    yHid.forEach((yh, j) => seg(f, cols[1], yh, cols[2], h / 2, `rgba(160,174,192,0.3)`, 1 + Math.min(2, Math.abs(w2[j]) * 2)));
    text(f, `ŷ = ${out.toFixed(4)}`, cols[2] + 22, h / 2 + 4, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      `前向传播：输入 → 加权求和 → 激活 → 加权求和 → 输出（${activation} 激活）`,
  `隐藏层净输入 [${hPre.map((p) => p.toFixed(2)).join(', ')}]，激活后 [${hAct.map((p) => p.toFixed(2)).join(', ')}]`,
      '激活函数引入非线性：没有它，多层网络等价于单个线性变换',
    ]);
    heading(f, '神经网络前向传播');
  },
});

/** M60 感知机。 */
const perceptron = defineViz({
  slug: 'perceptron',
  title: '感知机',
  params: {
    samples: { type: 'range', min: 10, max: 60, default: 30, label: '样本数' },
    steps: { type: 'range', min: 1, max: 40, default: 20, label: '训练轮数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const sampleCount = Math.round(num(params, 'samples', 30));
    const steps = Math.round(num(params, 'steps', 20));
    const rand = rng(1212);
    const data: Array<[number, number, number]> = [];
    for (let i = 0; i < sampleCount; i++) {
      const px = rand() * 2 - 1;
      const py = rand() * 2 - 1;
      data.push([px, py, px + py > 0 ? 1 : -1]);
    }
    let wts = [0, 0];
    let bias = 0;
    let errors = 0;
    for (let s = 0; s < steps; s++) {
      errors = 0;
      for (const [px, py, label] of data) {
        const pred = wts[0] * px + wts[1] * py + bias > 0 ? 1 : -1;
        if (pred !== label) {
          wts = [wts[0] + label * px, wts[1] + label * py];
          bias += label;
          errors++;
        }
      }
    }

    const v = view(f, { xMin: -1.2, xMax: 1.2, yMin: -1.2, yMax: 1.2, inset: 38 });
    grid(f, v, { divisions: 4, ticks: true });
    data.forEach(([px, py, label]) => dot(f, v.sx(px), v.sy(py), 4, label > 0 ? C.accent : C.hot));
    if (Math.abs(wts[1]) > 1e-6) {
      poly(f, [[v.sx(-1.2), v.sy((-bias - wts[0] * -1.2) / wts[1])], [v.sx(1.2), v.sy((-bias - wts[0] * 1.2) / wts[1])]], { stroke: C.green, lw: 2.4 });
    }

    footnotes(f, [
      `感知机学到的决策边界：${wts[0].toFixed(3)}x + ${wts[1].toFixed(3)}y ${bias >= 0 ? '+' : '-'} ${Math.abs(bias).toFixed(3)} = 0`,
      `训练结束时的误分类数：${errors}（线性可分数据上感知机收敛定理保证有限步内收敛）`,
      '感知机是最简单的线性分类器；XOR 问题不可分，需要多层网络（这也曾是 AI 的寒冬原因）',
    ]);
    heading(f, '感知机：线性分类器');
  },
});

/** M61 Softmax。 */
const softmax = defineViz({
  slug: 'softmax',
  title: 'Softmax',
  params: {
    temperature: { type: 'range', min: 0.2, max: 4, default: 1, step: 0.1, label: '温度 T' },
    spread: { type: 'range', min: 0.2, max: 3, default: 1.2, step: 0.1, label: 'logits 差距' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const temp = num(params, 'temperature', 1);
    const spread = num(params, 'spread', 1.2);
    const logits = [2, 1, 0.2, -0.6, -1.4].map((v0) => v0 * spread);
    const maxL = Math.max(...logits);
    const exps = logits.map((l) => Math.exp((l - maxL) / temp));
    const sum = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map((e) => e / sum);

    const slot = (w - 100) / logits.length;
    const baseY = h - 100;
    const plotH = h - 190;
    logits.forEach((l, i) => {
      const x = 50 + i * slot;
      const bh = probs[i] * plotH;
      f.ctx.save();
      f.ctx.fillStyle = probs[i] > 0.5 ? C.green : C.accent;
      f.ctx.fillRect(x + slot * 0.15, baseY - bh, slot * 0.7, bh);
      f.ctx.restore();
      text(f, `${(probs[i] * 100).toFixed(1)}%`, x + slot / 2, baseY - bh - 8, { align: 'center', color: C.fg, font: '12px sans-serif' });
      text(f, `logit ${l.toFixed(2)}`, x + slot / 2, baseY + 20, { align: 'center', color: C.dim, font: '10px sans-serif' });
    });
    seg(f, 50, baseY, 50 + logits.length * slot, baseY, C.dim, 1);

    const entropy = -probs.reduce((a, p) => a + (p > 0 ? p * Math.log(p) : 0), 0);
    footnotes(f, [
      `softmax(logits / T)，T = ${temp}：输出是概率分布，和为 ${probs.reduce((a, b) => a + b, 0).toFixed(6)}`,
      `分布熵 = ${entropy.toFixed(4)}（最大 ${Math.log(logits.length).toFixed(4)}）；T 越大分布越平坦，T → 0 时退化为 argmax`,
      'softmax 把任意实数向量变成概率分布，是分类网络输出层与注意力机制的标准组件',
    ]);
    heading(f, 'Softmax：从 logits 到概率');
  },
});

/** M62 逻辑回归。 */
const logisticRegression = defineViz({
  slug: 'logistic-regression',
  title: '逻辑回归',
  params: {
    separation: { type: 'range', min: 0.3, max: 3, default: 1.6, step: 0.1, label: '类别可分度' },
    samples: { type: 'range', min: 10, max: 80, default: 40, label: '样本数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const separation = num(params, 'separation', 1.6);
    const sampleCount = Math.round(num(params, 'samples', 40));
    const rand = rng(4321);
    const data: Array<[number, number]> = [];
    for (let i = 0; i < sampleCount; i++) {
      const label = i % 2;
      const px = 0.5 + (label === 1 ? separation * 0.3 : -separation * 0.3) + gaussians(rand, 1)[0] * 0.16;
      data.push([px, label]);
    }
    // 逻辑回归：梯度下降拟合 sigmoid(β₀ + β₁x)
    let b0 = 0;
    let b1 = 0;
    const lr = 0.6;
    for (let it = 0; it < 400; it++) {
      let g0 = 0;
      let g1 = 0;
      for (const [px, label] of data) {
        const p = 1 / (1 + Math.exp(-(b0 + b1 * px)));
        g0 += p - label;
        g1 += (p - label) * px;
      }
      b0 -= (lr * g0) / sampleCount;
      b1 -= (lr * g1) / sampleCount;
    }

    const v = view(f, { xMin: -0.2, xMax: 1.2, yMin: -0.2, yMax: 1.2, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    data.forEach(([px, label]) => dot(f, v.sx(px), v.sy(label + (rand() - 0.5) * 0.06), 3.4, label === 1 ? C.accent : C.hot));
    curve(f, v, (xx) => 1 / (1 + Math.exp(-(b0 + b1 * xx))), { color: C.green, lw: 2.6 });
    const boundary = -b0 / (Math.abs(b1) < 1e-9 ? 1e-9 : b1);
    seg(f, v.sx(boundary), v.sy(0), v.sx(boundary), v.sy(1), `${C.warm}cc`, 1.8);

    const accuracy = data.filter(([px, label]) => (1 / (1 + Math.exp(-(b0 + b1 * px))) > 0.5 ? 1 : 0) === label).length / sampleCount;
    footnotes(f, [
      `拟合 sigmoid(x) = 1/(1+e^(-(${b0.toFixed(3)} + ${b1.toFixed(3)}x)))，决策边界 x = ${boundary.toFixed(4)}`,
      `训练集准确率 = ${(accuracy * 100).toFixed(1)}%（绿色为概率曲线，随 x 单调上升）`,
      '逻辑回归输出概率而非硬分类；用交叉熵损失（等价于最大似然），是广义线性模型的原型',
    ]);
    heading(f, '逻辑回归：sigmoid 概率模型');
  },
});

/** M63 决策树。 */
const decisionTree = defineViz({
  slug: 'decision-tree',
  title: '决策树',
  params: {
    depth: { type: 'range', min: 1, max: 4, default: 3, label: '最大深度' },
    samples: { type: 'range', min: 20, max: 120, default: 60, step: 4, label: '样本数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const maxDepth = Math.round(num(params, 'depth', 3));
    const sampleCount = Math.round(num(params, 'samples', 60));
    const rand = rng(1122);
    const data: Array<[number, number, number]> = [];
    for (let i = 0; i < sampleCount; i++) {
      const x1 = rand();
      const x2 = rand();
      const label = x1 > 0.5 ? (x2 > 0.4 ? 1 : 0) : x2 > 0.6 ? 1 : 0;
      data.push([x1, x2, label]);
    }
    // 用轴对齐切分构造决策树（贪心：枚举切分点最小化基尼不纯）
    interface Node { box: [number, number, number, number]; label: number; depth: number }
    const leaves: Node[] = [];
    const gini = (subset: Array<[number, number, number]>): number => {
      if (subset.length === 0) return 0;
      const p = subset.filter((d) => d[2] === 1).length / subset.length;
      return 2 * p * (1 - p);
    };
    const build = (subset: Array<[number, number, number]>, box: [number, number, number, number], depth: number): void => {
      const pos = subset.filter((d) => d[2] === 1).length;
      if (depth >= maxDepth || subset.length < 5 || pos === 0 || pos === subset.length) {
        leaves.push({ box, label: pos >= subset.length - pos ? 1 : 0, depth });
        return;
      }
      let best = { gain: 0, axis: 0, at: 0.5 };
      for (const axis of [0, 1]) {
        for (let t = 0.1; t < 1; t += 0.1) {
          const left = subset.filter((d) => d[axis] < t);
          const right = subset.filter((d) => d[axis] >= t);
          const gain = gini(subset) - (left.length * gini(left) + right.length * gini(right)) / subset.length;
          if (gain > best.gain) best = { gain, axis, at: t };
        }
      }
      const [x0, y0, x1, y1] = box;
      if (best.axis === 0) {
        build(subset.filter((d) => d[0] < best.at), [x0, y0, best.at, y1], depth + 1);
        build(subset.filter((d) => d[0] >= best.at), [best.at, y0, x1, y1], depth + 1);
      } else {
        build(subset.filter((d) => d[1] < best.at), [x0, y0, x1, best.at], depth + 1);
        build(subset.filter((d) => d[1] >= best.at), [x0, best.at, x1, y1], depth + 1);
      }
    };
    build(data, [0, 0, 1, 1], 0);

    const v = view(f, { xMin: 0, xMax: 1, yMin: 0, yMax: 1, inset: 44, insetRight: 44 });
    leaves.forEach((leaf) => {
      const [x0, y0, x1, y1] = leaf.box;
      poly(f, [[v.sx(x0), v.sy(y0)], [v.sx(x1), v.sy(y0)], [v.sx(x1), v.sy(y1)], [v.sx(x0), v.sy(y1)]], {
        fill: leaf.label === 1 ? 'rgba(102,126,234,0.22)' : 'rgba(245,101,101,0.16)',
        stroke: 'rgba(160,174,192,0.4)',
        lw: 1.2,
        close: true,
      });
    });
    data.forEach(([x1, x2, label]) => dot(f, v.sx(x1), v.sy(x2), 3.2, label === 1 ? C.accent : C.hot));

    footnotes(f, [
      `深度限制 ${maxDepth}：特征空间被切成 ${leaves.length} 个矩形区域，每个区域给出多数类`,
      '每次按"基尼不纯度下降最大"的方向做轴对齐切分，训练快且可解释',
      '决策树的缺点是不稳定、易过拟合；随机森林 / 梯度提升树通过集成解决',
    ]);
    heading(f, '决策树：递归切分特征空间');
  },
});

/** M64 K 近邻。 */
const knn = defineViz({
  slug: 'knn',
  title: 'K近邻',
  params: {
    k: { type: 'range', min: 1, max: 15, default: 5, label: '邻居数 k' },
    queryX: { type: 'range', min: 0, max: 1, default: 0.55, step: 0.01, label: '查询点 x' },
    queryY: { type: 'range', min: 0, max: 1, default: 0.62, step: 0.01, label: '查询点 y' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const k = Math.round(num(params, 'k', 5));
    const qx = num(params, 'queryX', 0.55);
    const qy = num(params, 'queryY', 0.62);
    const rand = rng(8642);
    const data: Array<[number, number, number]> = [];
    for (let i = 0; i < 50; i++) {
      const px = rand();
      const py = rand();
      data.push([px, py, px + py > 1 ? 1 : 0]);
    }
    const sorted = [...data].sort((a, b) => Math.hypot(a[0] - qx, a[1] - qy) - Math.hypot(b[0] - qx, b[1] - qy));
    const neighbors = sorted.slice(0, k);
    const votes = neighbors.reduce((a, n) => a + n[2], 0);
    const predicted = votes * 2 > k ? 1 : 0;

    const v = view(f, { xMin: -0.05, xMax: 1.05, yMin: -0.05, yMax: 1.05, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    data.forEach(([px, py, label]) => dot(f, v.sx(px), v.sy(py), 3.4, label === 1 ? C.accent : C.hot));
    neighbors.forEach(([px, py], i) => seg(f, v.sx(qx), v.sy(qy), v.sx(px), v.sy(py), `${C.green}${i < 3 ? 'cc' : '66'}`, 1.6));
    dot(f, v.sx(qx), v.sy(qy), 6, C.green);
    const radius = Math.hypot(sorted[k - 1][0] - qx, sorted[k - 1][1] - qy);
    const circlePts: Array<[number, number]> = [];
    for (let i = 0; i <= 100; i++) {
      const t = (i / 100) * Math.PI * 2;
      circlePts.push([v.sx(qx + radius * Math.cos(t)), v.sy(qy + radius * Math.sin(t))]);
    }
    poly(f, circlePts, { stroke: `${C.green}88`, lw: 1.4, dash: [5, 4] });

    footnotes(f, [
      `${k} 个最近邻居中 ${votes} 个属于类别 1，${k - votes} 个属于类别 0 ⇒ 预测类别 ${predicted}`,
      `k = 1 时邻居边界最"尖锐"（过拟合）；k 过大则过于平滑（欠拟合）`,
      'KNN 是最简单的"懒惰学习"：不做显式训练，预测时遍历样本 —— 用 KD 树可加速到 O(log n)',
    ]);
    heading(f, 'K 近邻分类');
  },
});

/** M65 K 均值聚类。 */
const kmeans = defineViz({
  slug: 'kmeans',
  title: 'K均值聚类',
  params: {
    clusters: { type: 'range', min: 2, max: 7, default: 4, label: '簇数 K' },
    iterations: { type: 'range', min: 1, max: 25, default: 10, label: '迭代次数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const k = Math.round(num(params, 'clusters', 4));
    const iters = Math.round(num(params, 'iterations', 10));
    const rand = rng(3141);
    const trueCenters: Array<[number, number]> = Array.from({ length: k }, () => [rand() * 2 - 1, rand() * 2 - 1]);
    const points: Array<[number, number]> = [];
    trueCenters.forEach(([cx, cy]) => {
      for (let i = 0; i < 16; i++) {
        points.push([cx + gaussians(rand, 1)[0] * 0.22, cy + gaussians(rand, 1)[0] * 0.22]);
      }
    });

    let centroids: Array<[number, number]> = points.slice(0, k).map((p) => [p[0], p[1]] as [number, number]);
    let assign = new Array<number>(points.length).fill(0);
    for (let it = 0; it < iters; it++) {
      assign = points.map((p) => {
        let best = 0;
        let bestD = Infinity;
        centroids.forEach((c, ci) => {
          const dd = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2;
          if (dd < bestD) {
            bestD = dd;
            best = ci;
          }
        });
        return best;
      });
      const next = centroids.map((c, ci) => {
        const members = points.filter((_, i) => assign[i] === ci);
        if (members.length === 0) return c;
        return [members.reduce((a, p) => a + p[0], 0) / members.length, members.reduce((a, p) => a + p[1], 0) / members.length] as [number, number];
      });
      centroids = next;
    }

    const v = view(f, { xMin: -1.4, xMax: 1.4, yMin: -1.4, yMax: 1.4, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    points.forEach((p, i) => dot(f, v.sx(p[0]), v.sy(p[1]), 3.2, `${PALETTE[assign[i] % PALETTE.length]}cc`));
    centroids.forEach(([cx, cy], ci) => {
      dot(f, v.sx(cx), v.sy(cy), 7, PALETTE[ci % PALETTE.length]);
      text(f, `μ${ci + 1}`, v.sx(cx) + 9, v.sy(cy) - 6, { color: PALETTE[ci % PALETTE.length], font: '11px sans-serif' });
    });

    const inertia = points.reduce((a, p, i) => a + ((p[0] - centroids[assign[i]][0]) ** 2 + (p[1] - centroids[assign[i]][1]) ** 2), 0);
    footnotes(f, [
      `K = ${k}，迭代 ${iters} 次后簇内平方和 = ${inertia.toFixed(4)}（越小越紧凑）`,
      '交替执行"分配点到最近质心"与"更新质心为簇均值"，每步都单调降低目标函数',
      'K-means 收敛到局部最优，对初始质心敏感（常用 k-means++ 初始化）；簇形状假定为球形',
    ]);
    heading(f, 'K 均值聚类');
  },
});

/** M66 最短路径深化。 */
const dijkstraM66 = defineViz({
  slug: 'dijkstra-m66',
  title: '最短路径深化',
  params: {
    mode: { type: 'select', options: ['单源最短路', '全对最短路'], default: '单源最短路', label: '模式' },
    source: { type: 'range', min: 0, max: 7, default: 0, label: '源点' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = str(params, 'mode', '单源最短路');
    const source = Math.round(num(params, 'source', 0));
    const nodes: Array<[number, number]> = [[0.08, 0.5], [0.3, 0.18], [0.3, 0.82], [0.55, 0.34], [0.55, 0.7], [0.8, 0.5], [0.94, 0.24]];
    const edges: Array<[number, number, number]> = [
      [0, 1, 3], [0, 2, 5], [1, 3, 4], [2, 3, 2], [2, 4, 3], [3, 4, 1], [3, 5, 6], [4, 5, 2], [5, 6, 3], [1, 6, 12],
    ];
    const px = (p: [number, number]): [number, number] => [60 + p[0] * (w - 140), 54 + p[1] * (h - 120)];

    const runDijkstra = (src: number): { dist: number[]; prev: number[] } => {
      const dist = nodes.map(() => Infinity);
      const prev = nodes.map(() => -1);
      const done = new Set<number>();
      dist[src] = 0;
      while (done.size < nodes.length) {
        let u = -1;
        let best = Infinity;
        for (let i = 0; i < nodes.length; i++) {
          if (!done.has(i) && dist[i] < best) {
            best = dist[i];
            u = i;
          }
        }
        if (u < 0) break;
        done.add(u);
        for (const [a, b, wgt] of edges) {
          const nb = a === u ? b : b === u ? a : -1;
          if (nb < 0) continue;
          if (dist[u] + wgt < dist[nb]) {
            dist[nb] = dist[u] + wgt;
            prev[nb] = u;
          }
        }
      }
      return { dist, prev };
    };

    const highlighted: Array<[number, number]> = [];
    const labels = new Map<number, string>();
    if (mode === '单源最短路') {
      const { dist, prev } = runDijkstra(source);
      nodes.forEach((_, i) => {
        labels.set(i, dist[i] === Infinity ? '∞' : String(dist[i]));
        if (prev[i] >= 0) highlighted.push([prev[i], i]);
      });
    } else {
      // 全对：把所有源点的最短路径树边合并展示（用颜色区分源）
      for (let s = 0; s < nodes.length; s++) {
        const { prev } = runDijkstra(s);
        prev.forEach((p, i) => {
          if (p >= 0) highlighted.push([p, i]);
        });
      }
      nodes.forEach((_, i) => labels.set(i, String(i)));
    }

    edges.forEach(([a, b, wgt]) => {
      const [x1, y1] = px(nodes[a]);
      const [x2, y2] = px(nodes[b]);
      const on = highlighted.some(([p, q]) => (p === a && q === b) || (p === b && q === a));
      seg(f, x1, y1, x2, y2, on ? C.green : 'rgba(160,174,192,0.3)', on ? 2.6 : 1.2);
      text(f, String(wgt), (x1 + x2) / 2, (y1 + y2) / 2 - 6, { align: 'center', color: on ? C.green : C.dim, font: '11px sans-serif' });
    });
    nodes.forEach((p, i) => {
      const [x, y] = px(p);
      dot(f, x, y, 14, i === source && mode === '单源最短路' ? C.warm : C.accent);
      text(f, labels.get(i) ?? String(i), x, y + 5, { align: 'center', color: '#fff', font: 'bold 11px sans-serif' });
    });

    footnotes(f, [
      mode === '单源最短路'
        ? `从节点 ${source} 出发的最短距离标注在节点内，绿色为最短路径树`
        : '全对最短路径：所有点对的最短路径树叠加（每条边被多个源复用）',
      'Dijkstra 用优先队列实现是 O((V+E)log V)；含负权边需 Bellman-Ford（O(VE)）',
      '全对最短路可跑 V 次 Dijkstra，或用 Floyd-Warshall 动态规划 O(V³)（允许负权但不能有负环）',
    ]);
    heading(f, `最短路径：${mode}`);
  },
});

/** M67 网络流深化。 */
const networkFlowM67 = defineViz({
  slug: 'network-flow-m67',
  title: '网络流深化',
  params: {
    bottleneck: { type: 'range', min: 1, max: 8, default: 3, label: '瓶颈容量' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const cap = Math.round(num(params, 'bottleneck', 3));
    const nodes: Array<[number, number]> = [[0.06, 0.5], [0.32, 0.2], [0.32, 0.52], [0.32, 0.82], [0.66, 0.5], [0.94, 0.5]];
    const arcs: Array<[number, number, number]> = [
      [0, 1, 4], [0, 2, 5], [0, 3, 4],
      [1, 4, 4], [2, 4, cap], [3, 4, 4],
      [1, 2, 2], [2, 3, 2], [4, 5, 9],
    ];
    // 用 Edmonds-Karp 求最大流
    const n = nodes.length;
    const capMatrix: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    arcs.forEach(([u, v0, c]) => {
      capMatrix[u][v0] += c;
    });
    const residual = capMatrix.map((row) => [...row]);
    let maxFlow = 0;
    const flowOn: Array<[number, number, number]> = [];
    const s = 0;
    const t = n - 1;
    while (true) {
      const parent = new Array<number>(n).fill(-1);
      const queue = [s];
      parent[s] = s;
      while (queue.length && parent[t] < 0) {
        const u = queue.shift() as number;
        for (let v0 = 0; v0 < n; v0++) {
          if (parent[v0] < 0 && residual[u][v0] > 1e-9) {
            parent[v0] = u;
            queue.push(v0);
          }
        }
      }
      if (parent[t] < 0) break;
      let bottleneck = Infinity;
      for (let v0 = t; v0 !== s; v0 = parent[v0]) bottleneck = Math.min(bottleneck, residual[parent[v0]][v0]);
      for (let v0 = t; v0 !== s; v0 = parent[v0]) {
        residual[parent[v0]][v0] -= bottleneck;
        residual[v0][parent[v0]] += bottleneck;
      }
      maxFlow += bottleneck;
    }
    arcs.forEach(([u, v0, c]) => {
      const used = capMatrix[u][v0] - residual[u][v0];
      flowOn.push([u, v0, Math.max(0, Math.min(c, used))]);
    });

    const px = (p: [number, number]): [number, number] => [60 + p[0] * (w - 140), 54 + p[1] * (h - 120)];
    arcs.forEach(([u, v0, c], i) => {
      const [x1, y1] = px(nodes[u]);
      const [x2, y2] = px(nodes[v0]);
      const flowVal = flowOn[i]?.[2] ?? 0;
      const t0 = c === 0 ? 0 : flowVal / c;
      seg(f, x1, y1, x2, y2, `hsl(${230 - t0 * 130}, 70%, 55%)`, 1 + t0 * 4);
      text(f, `${flowVal.toFixed(0)}/${c}`, (x1 + x2) / 2, (y1 + y2) / 2 - 7, { align: 'center', color: C.fg, font: '11px sans-serif' });
    });
    nodes.forEach((p, i) => {
      const [x, y] = px(p);
      dot(f, x, y, 15, i === s ? C.green : i === t ? C.hot : C.accent);
      text(f, i === s ? 'S' : i === t ? 'T' : String(i), x, y + 5, { align: 'center', color: '#fff', font: 'bold 12px sans-serif' });
    });

    footnotes(f, [
      `Edmonds-Karp（BFS 找增广路）求出的最大流 = ${maxFlow}`,
      `中间那条容量为 ${cap} 的边是瓶颈：把它断开就把 S、T 分到两侧（最小割 = 最大流）`,
      '最大流最小割定理：网络最大流量等于最小割容量，对偶关系让两类问题互相求解',
    ]);
    heading(f, '网络流：最大流与最小割');
  },
});

/** M68 二分查找深化（二分答案）。 */
const binarySearchM68 = defineViz({
  slug: 'binary-search-m68',
  title: '二分查找深化',
  params: {
    target: { type: 'range', min: 1, max: 40, default: 22, label: '目标总量' },
    capacity: { type: 'range', min: 1, max: 12, default: 6, label: '单堆上限' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const target = Math.round(num(params, 'target', 22));
    const capacity = Math.round(num(params, 'capacity', 6));
    // 问题：把 target 个物品分到最少的堆中，每堆不超过 capacity（二分答案）
    const cost = (k: number): number => Math.ceil(target / k);
    let lo = 1;
    let hi = target;
    const steps: Array<[number, number, number, boolean]> = [];
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const ok = cost(mid) <= capacity;
      steps.push([lo, hi, mid, ok]);
      if (ok) hi = mid;
      else lo = mid + 1;
    }

    const v = view(f, { xMin: 0, xMax: target + 2, yMin: 0, yMax: capacity + 1.4, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    // 每个 k 对应的堆数曲线
    const pts: Array<[number, number]> = [];
    for (let k = 1; k <= target; k++) pts.push([v.sx(k), v.sy(cost(k))]);
    poly(f, pts, { stroke: C.accent, lw: 2 });
    seg(f, v.sx(0), v.sy(capacity), v.sx(target + 2), v.sy(capacity), C.green, 1.6);
    dot(f, v.sx(lo), v.sy(cost(lo)), 6, C.warm);
    text(f, `最小每堆容量 = ${lo}`, v.sx(lo) + 8, v.sy(cost(lo)) - 8, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      `把 ${target} 个物品分成不超过 ${capacity} 堆 ⇒ 每堆至少 ${lo} 个（二分 ${steps.length} 次得到）`,
      `判定函数单调：每堆容量 k 越大所需堆数越少（曲线递减），因此可以用二分搜索答案`,
      '"二分答案"适用于"可行性随参数单调"的最优化问题：在答案空间上二分而非在数组上二分',
    ]);
    heading(f, '二分查找深化：二分答案');
  },
});

registerViz(
  geneticAlgorithm,
  particleSwarm,
  simulatedAnnealing,
  kalmanFilter,
  backpropagation,
  neuralNetworkForward,
  perceptron,
  softmax,
  logisticRegression,
  decisionTree,
  knn,
  kmeans,
  dijkstraM66,
  networkFlowM67,
  binarySearchM68,
);
