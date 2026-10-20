import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import {
  C,
  PALETTE,
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

const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));
const relu = (z: number): number => Math.max(0, z);

/** A62 反向传播深化。 */
const backpropagationA62 = defineViz({
  slug: 'backpropagation-a62',
  title: '反向传播深化',
  params: {
    lr: { type: 'range', min: 0.05, max: 2, default: 0.8, step: 0.05, label: '学习率' },
    epochs: { type: 'range', min: 1, max: 200, default: 60, label: '训练轮数' },
    hidden: { type: 'range', min: 2, max: 6, default: 4, label: '隐藏层宽度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const lr = num(params, 'lr', 0.8);
    const epochs = Math.round(num(params, 'epochs', 60));
    const hidden = Math.round(num(params, 'hidden', 4));
    const rand = rng(2024);
    // 学习 XOR（经典非线性问题）
    const data: Array<[number, number, number]> = [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]];
    const w1 = Array.from({ length: hidden }, () => [rand() - 0.5, rand() - 0.5]);
    const b1 = Array.from({ length: hidden }, () => rand() - 0.5);
    const w2 = Array.from({ length: hidden }, () => rand() - 0.5);
    let b2 = rand() - 0.5;
    const losses: number[] = [];

    for (let e = 0; e < epochs; e++) {
      let loss = 0;
      for (const [x1, x2, y] of data) {
        const hPre = w1.map((wv, i) => wv[0] * x1 + wv[1] * x2 + b1[i]);
        const h = hPre.map(sigmoid);
        const out = sigmoid(h.reduce((a, hv, i) => a + hv * w2[i], 0) + b2);
        loss += 0.5 * (out - y) ** 2;
        // 反向传播
        const dOut = (out - y) * out * (1 - out);
        for (let i = 0; i < hidden; i++) {
          const dH = dOut * w2[i] * h[i] * (1 - h[i]);
          w1[i][0] -= lr * dH * x1;
          w1[i][1] -= lr * dH * x2;
          b1[i] -= lr * dH;
          w2[i] -= lr * dOut * h[i];
        }
        b2 -= lr * dOut;
      }
      losses.push(loss);
    }
    const predict = (x1: number, x2: number): number => {
      const h = w1.map((wv, i) => sigmoid(wv[0] * x1 + wv[1] * x2 + b1[i]));
      return sigmoid(h.reduce((a, hv, i) => a + hv * w2[i], 0) + b2);
    };

    const v = view(f, { xMin: 0, xMax: epochs, yMin: 0, yMax: Math.max(...losses) * 1.1 + 1e-6, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });
    poly(f, losses.map((l, i) => [v.sx(i), v.sy(l)] as [number, number]), { stroke: C.accent, lw: 2.2 });
    dot(f, v.sx(epochs - 1), v.sy(losses[losses.length - 1]), 5, C.warm);

    const results = data.map(([x1, x2]) => predict(x1, x2));
    footnotes(f, [
      `XOR 问题训练 ${epochs} 轮后总损失 = ${losses[losses.length - 1].toFixed(6)}（初始 ${losses[0].toFixed(4)}）`,
      `预测：(0,0)→${results[0].toFixed(3)}、(0,1)→${results[1].toFixed(3)}、(1,0)→${results[2].toFixed(3)}、(1,1)→${results[3].toFixed(3)}`,
      'XOR 线性不可分，单层感知机无解；加上隐藏层 + 反向传播就能学会 —— 这是深度学习的起点',
    ]);
    heading(f, '反向传播：训练 XOR');
  },
});

/** A63 神经网络前向深化。 */
const neuralNetworkForwardA63 = defineViz({
  slug: 'neural-network-forward-a63',
  title: '神经网络前向深化',
  params: {
    layers: { type: 'select', options: ['2 层', '3 层'], default: '3 层', label: '结构' },
    activation: { type: 'select', options: ['Sigmoid', 'Tanh', 'ReLU', 'LeakyReLU'], default: 'ReLU', label: '激活' },
    depth: { type: 'range', min: 2, max: 5, default: 4, label: '每层宽度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const layerCount = str(params, 'layers', '3 层') === '3 层' ? 3 : 2;
    const actName = str(params, 'activation', 'ReLU');
    const width = Math.round(num(params, 'depth', 4));
    const act = actName === 'Tanh' ? Math.tanh : actName === 'ReLU' ? relu : actName === 'LeakyReLU' ? (z: number): number => (z >= 0 ? z : 0.1 * z) : sigmoid;

    const rand = rng(555);
    const layerSizes = [2, ...Array.from({ length: layerCount - 1 }, () => width), 1];
    const weights: number[][][] = [];
    const biases: number[][] = [];
    for (let l = 0; l + 1 < layerSizes.length; l++) {
      weights.push(Array.from({ length: layerSizes[l + 1] }, () => Array.from({ length: layerSizes[l] }, () => rand() - 0.5)));
      biases.push(Array.from({ length: layerSizes[l + 1] }, () => (rand() - 0.5) * 0.3));
    }
    const input = [0.7, -0.4];
    let activations = input;
    const allActivations: number[][] = [input];
    for (let l = 0; l < weights.length; l++) {
      const next = weights[l].map((row, i) => act(row.reduce((a, wv, j) => a + wv * activations[j], 0) + biases[l][i]));
      activations = next;
      allActivations.push(next);
    }

    // 绘制网络
    const colX = layerSizes.map((_, i) => 70 + (i / (layerSizes.length - 1)) * (w - 160));
    const yOf = (idx: number, cnt: number): number => 60 + ((idx + 0.5) / cnt) * (h - 175);
    for (let l = 0; l + 1 < layerSizes.length; l++) {
      for (let i = 0; i < layerSizes[l]; i++) {
        for (let j = 0; j < layerSizes[l + 1]; j++) {
          const mag = Math.min(1, Math.abs(weights[l][j][i]) * 2);
          seg(f, colX[l], yOf(i, layerSizes[l]), colX[l + 1], yOf(j, layerSizes[l + 1]), weights[l][j][i] >= 0 ? `rgba(72,187,120,${0.12 + mag * 0.5})` : `rgba(245,101,101,${0.12 + mag * 0.5})`, 1 + mag * 1.6);
        }
      }
    }
    allActivations.forEach((layer, l) => {
      layer.forEach((val, i) => {
        const x = colX[l];
        const y = yOf(i, layer.length);
        const norm = Math.max(-1, Math.min(1, val));
        dot(f, x, y, 15, norm > 0 ? C.accent : C.panel);
        text(f, val.toFixed(2), x + 19, y + 4, { color: C.dim, font: '10px Consolas, monospace' });
      });
    });

    footnotes(f, [
      `${layerSizes.join(' → ')} 结构，激活函数 ${actName}，输入 (0.70, -0.40) → 输出 ${activations[0].toFixed(4)}`,
      '每层的净输入 = 上一层的加权和 + 偏置，再过激活函数；绿色权重为正、红色为负',
      '激活函数提供非线性：Sigmoid 会饱和（梯度消失），ReLU 缓解了这个问题（但会有"死亡神经元"）',
    ]);
    heading(f, '神经网络前向传播');
  },
});

/** A64 感知机深化。 */
const perceptronA64 = defineViz({
  slug: 'perceptron-a64',
  title: '感知机深化',
  params: {
    problem: { type: 'select', options: ['线性可分（AND）', '线性不可分（XOR）', '含噪声数据'], default: '线性不可分（XOR）', label: '任务' },
    epochs: { type: 'range', min: 1, max: 80, default: 30, label: '训练轮数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const problem = str(params, 'problem', '线性不可分（XOR）');
    const epochs = Math.round(num(params, 'epochs', 30));
    const rand = rng(99);
    let data: Array<[number, number, number]>;
    if (problem.startsWith('线性可分')) {
      data = [[-1, -1, 0], [-1, 1, 0], [1, -1, 0], [1, 1, 1]];
    } else if (problem.startsWith('含噪声')) {
      data = Array.from({ length: 40 }, () => {
        const x1 = rand() * 2 - 1;
        const x2 = rand() * 2 - 1;
        const label = x1 + x2 > 0 ? 1 : 0;
        return [x1, x2, rand() < 0.15 ? 1 - label : label] as [number, number, number];
      });
    } else {
      data = [[-1, -1, 0], [-1, 1, 1], [1, -1, 1], [1, 1, 0]];
    }
    let wts = [rand() - 0.5, rand() - 0.5];
    let bias = rand() - 0.5;
    const errorHistory: number[] = [];
    for (let e = 0; e < epochs; e++) {
      let errors = 0;
      for (const [x1, x2, y] of data) {
        const pred = wts[0] * x1 + wts[1] * x2 + bias > 0 ? 1 : 0;
        if (pred !== y) {
          wts = [wts[0] + (y - pred) * x1, wts[1] + (y - pred) * x2];
          bias += y - pred;
          errors++;
        }
      }
      errorHistory.push(errors);
    }

    const v = view(f, { xMin: -1.4, xMax: 1.4, yMin: -1.4, yMax: 1.4, inset: 40 });
    grid(f, v, { divisions: 4, ticks: true });
    data.forEach(([x1, x2, y]) => dot(f, v.sx(x1), v.sy(x2), 5, y === 1 ? C.accent : C.hot));
    if (Math.abs(wts[1]) > 1e-6) {
      poly(f, [
        [v.sx(-1.4), v.sy((-bias - wts[0] * -1.4) / wts[1])],
        [v.sx(1.4), v.sy((-bias - wts[0] * 1.4) / wts[1])],
      ], { stroke: C.green, lw: 2.4 });
    }
    // 误差曲线
    const gv = view(f, { xMin: 0, xMax: epochs, yMin: 0, yMax: Math.max(1, ...errorHistory) * 1.2, inset: 40, insetRight: w * 0.55 });
    poly(f, errorHistory.map((e, i) => [gv.sx(i), gv.sy(e)] as [number, number]), { stroke: `${C.warm}cc`, lw: 1.6 });

    footnotes(f, [
      `${problem}：训练 ${epochs} 轮后误分类数 ${errorHistory[errorHistory.length - 1]}（初始 ${errorHistory[0]}）`,
      problem.startsWith('线性不可分') ? 'XOR 数据线性不可分：感知机无法收敛到 0 误差，误差曲线反复震荡' : '线性可分数据上感知机收敛定理保证有限步内误差降到 0',
      '感知机只有一个线性边界；要解决 XOR 必须引入隐藏层（多层感知机）或核方法',
    ]);
    heading(f, '感知机：线性边界的极限');
  },
});

/** A65 Softmax 深化。 */
const softmaxA65 = defineViz({
  slug: 'softmax-a65',
  title: 'Softmax深化',
  params: {
    temperature: { type: 'range', min: 0.1, max: 3, default: 1, step: 0.05, label: '温度 T' },
    classes: { type: 'range', min: 3, max: 8, default: 5, label: '类别数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const temp = num(params, 'temperature', 1);
    const classes = Math.round(num(params, 'classes', 5));
    const logits = Array.from({ length: classes }, (_, i) => (classes - i) * 1.2);
    const maxL = Math.max(...logits);
    const exps = logits.map((l) => Math.exp((l - maxL) / temp));
    const sum = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map((e) => e / sum);

    const top = 56;
    const plotH = h - 190;
    const slot = (w - 100) / classes;
    logits.forEach((l, i) => {
      const x = 50 + i * slot;
      const bh = probs[i] * plotH;
      f.ctx.save();
      f.ctx.fillStyle = probs[i] > 0.5 ? C.green : C.accent;
      f.ctx.fillRect(x + slot * 0.15, top + plotH - bh, slot * 0.7, bh);
      f.ctx.restore();
      text(f, `${(probs[i] * 100).toFixed(1)}%`, x + slot / 2, top + plotH - bh - 8, { align: 'center', color: C.fg, font: '12px sans-serif' });
      text(f, `z=${l.toFixed(1)}`, x + slot / 2, top + plotH + 20, { align: 'center', color: C.dim, font: '11px sans-serif' });
    });
    seg(f, 50, top + plotH, 50 + classes * slot, top + plotH, C.dim, 1);

    // 交叉熵损失
    const ce = -Math.log(Math.max(1e-12, probs[0]));
    const entropy = -probs.reduce((a, p) => a + (p > 0 ? p * Math.log(p) : 0), 0);
    footnotes(f, [
      `T = ${temp}：概率分布（和为 ${probs.reduce((a, b) => a + b, 0).toFixed(4)}）`,
      `交叉熵损失（正确类为第 1 类）= -ln(${probs[0].toFixed(4)}) = ${ce.toFixed(4)}；分布熵 = ${entropy.toFixed(4)}（最大 ${Math.log(classes).toFixed(4)}）`,
      'T 越小分布越尖锐（趋于 one-hot / argmax），T 越大越平坦；蒸馏用高温 softmax 传递"软标签"',
    ]);
    heading(f, 'Softmax：温度对分布的影响');
  },
});

/** A66 逻辑回归深化。 */
const logisticRegressionA66 = defineViz({
  slug: 'logistic-regression-a66',
  title: '逻辑回归深化',
  params: {
    separation: { type: 'range', min: 0.2, max: 2.4, default: 0.9, step: 0.1, label: '类别重叠度' },
    regularization: { type: 'range', min: 0, max: 1, default: 0.1, step: 0.05, label: 'L2 正则 λ' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const separation = num(params, 'separation', 0.9);
    const lambda = num(params, 'regularization', 0.1);
    const rand = rng(4242);
    const pts: Array<[number, number, number]> = [];
    for (let i = 0; i < 80; i++) {
      const label = i % 2;
      const x1 = (label === 1 ? separation : -separation) + gaussians(rand, 1)[0] * 1.2;
      const x2 = (rand() - 0.5) * 3;
      pts.push([x1, x2, label]);
    }

    let w1 = 0;
    let w2 = 0;
    let b = 0;
    const lr = 0.15;
    for (let it = 0; it < 600; it++) {
      let g1 = 0;
      let g2 = 0;
      let gb = 0;
      for (const [x1, x2, y] of pts) {
        const p = sigmoid(w1 * x1 + w2 * x2 + b);
        g1 += (p - y) * x1;
        g2 += (p - y) * x2;
        gb += p - y;
      }
      w1 -= (lr * (g1 / pts.length + lambda * w1));
      w2 -= (lr * (g2 / pts.length + lambda * w2));
      b -= (lr * gb) / pts.length;
    }

    const v = view(f, { xMin: -4, xMax: 4, yMin: -2.4, yMax: 2.4, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    // 决策区域着色
    const steps = 40;
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < steps; j++) {
        const x1 = -4 + (i / steps) * 8;
        const x2 = -2.4 + (j / steps) * 4.8;
        const p = sigmoid(w1 * x1 + w2 * x2 + b);
        f.ctx.save();
        f.ctx.fillStyle = p > 0.5 ? `rgba(102,126,234,${(p - 0.5) * 0.5})` : `rgba(245,101,101,${(0.5 - p) * 0.5})`;
        f.ctx.fillRect(v.sx(x1), v.sy(x2), (8 / steps) * (v.sx(1) - v.sx(0)) + 1, (4.8 / steps) * (v.sy(0) - v.sy(1)) + 1);
        f.ctx.restore();
      }
    }
    pts.forEach(([x1, x2, y]) => dot(f, v.sx(x1), v.sy(x2), 4, y === 1 ? C.accent : C.hot));
    // 决策边界
    if (Math.abs(w2) > 1e-6) {
      poly(f, [
        [v.sx(-4), v.sy((-b - w1 * -4) / w2)],
        [v.sx(4), v.sy((-b - w1 * 4) / w2)],
      ], { stroke: C.green, lw: 2.4 });
    }

    const acc = pts.filter(([x1, x2, y]) => (sigmoid(w1 * x1 + w2 * x2 + b) > 0.5 ? 1 : 0) === y).length / pts.length;
    footnotes(f, [
      `权重 (${w1.toFixed(3)}, ${w2.toFixed(3)})，偏置 ${b.toFixed(3)}，训练准确率 ${(acc * 100).toFixed(1)}%`,
      `决策边界：${w1.toFixed(3)}x₁ + ${w2.toFixed(3)}x₂ + ${b.toFixed(3)} = 0（绿色直线）`,
      lambda > 0.5 ? 'L2 正则较强：权重被压小，边界更"保守"但泛化更好' : lambda < 0.05 ? '几乎没有正则：边界会更贴合训练数据（有过拟合风险）' : '适度的 L2 正则：在拟合与泛化间取得平衡',
    ]);
    heading(f, '逻辑回归：概率输出与决策边界');
  },
});

/** A67 决策树深化。 */
const decisionTreeA67 = defineViz({
  slug: 'decision-tree-a67',
  title: '决策树深化',
  params: {
    depth: { type: 'range', min: 1, max: 6, default: 3, label: '最大深度' },
    criterion: { type: 'select', options: ['基尼不纯度', '信息增益'], default: '基尼不纯度', label: '划分准则' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const maxDepth = Math.round(num(params, 'depth', 3));
    const criterion = str(params, 'criterion', '基尼不纯度');
    const rand = rng(777);
    const data: Array<[number, number, number]> = [];
    for (let i = 0; i < 120; i++) {
      const x1 = rand();
      const x2 = rand();
      const label = (x1 > 0.45 && x2 > 0.35) || (x1 < 0.3 && x2 > 0.7) ? 1 : 0;
      data.push([x1, x2, label]);
    }
    const impurity = (subset: Array<[number, number, number]>): number => {
      if (subset.length === 0) return 0;
      const p = subset.filter((d) => d[2] === 1).length / subset.length;
      return criterion === '基尼不纯度' ? 2 * p * (1 - p) : -(p > 0 ? p * Math.log2(p) : 0) - (1 - p > 0 ? (1 - p) * Math.log2(1 - p) : 0);
    };
    interface Leaf { box: [number, number, number, number]; label: number; depth: number; imp: number }
    const leaves: Leaf[] = [];
    const build = (subset: Array<[number, number, number]>, box: [number, number, number, number], depth: number): void => {
      const pos = subset.filter((d) => d[2] === 1).length;
      if (depth >= maxDepth || subset.length < 6 || pos === 0 || pos === subset.length) {
        leaves.push({ box, label: pos * 2 >= subset.length ? 1 : 0, depth, imp: impurity(subset) });
        return;
      }
      let best = { gain: 0, axis: 0, at: 0.5 };
      for (const axis of [0, 1]) {
        for (let t = 0.08; t < 1; t += 0.04) {
          const left = subset.filter((d) => d[axis] < t);
          const right = subset.filter((d) => d[axis] >= t);
          const gain = impurity(subset) - (left.length * impurity(left) + right.length * impurity(right)) / subset.length;
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
      // 纯度越高颜色越饱和
      const sat = 0.12 + (1 - leaf.imp) * 0.35;
      poly(f, [[v.sx(x0), v.sy(y0)], [v.sx(x1), v.sy(y0)], [v.sx(x1), v.sy(y1)], [v.sx(x0), v.sy(y1)]], {
        fill: leaf.label === 1 ? `rgba(102,126,234,${sat})` : `rgba(245,101,101,${sat})`,
        stroke: 'rgba(160,174,192,0.35)',
        lw: 1,
        close: true,
      });
    });
    data.forEach(([x1, x2, label]) => dot(f, v.sx(x1), v.sy(x2), 3, label === 1 ? C.accent : C.hot));

    const accuracy = data.filter(([x1, x2, label]) => {
      const leaf = leaves.find((l) => x1 >= l.box[0] && x1 < l.box[2] && x2 >= l.box[1] && x2 < l.box[3]);
      return leaf ? leaf.label === label : false;
    }).length / data.length;

    footnotes(f, [
      `深度 ${maxDepth}、准则「${criterion}」：切出 ${leaves.length} 个叶节点，训练准确率 ${(accuracy * 100).toFixed(1)}%`,
      `矩形颜色的深浅表示叶子纯度 —— 颜色越饱和说明该区域样本越"纯"`,
      '深度越大越贴合训练数据（可能过拟合）；基尼与信息增益都衡量"划分后不纯度下降多少"',
    ]);
    heading(f, '决策树：递归切分与纯度');
  },
});

/** A68 KNN 深化。 */
const knnA68 = defineViz({
  slug: 'knn-a68',
  title: 'KNN深化',
  params: {
    k: { type: 'range', min: 1, max: 25, default: 5, label: '邻居数 k' },
    points: { type: 'range', min: 20, max: 160, default: 80, step: 10, label: '样本数' },
    metric: { type: 'select', options: ['欧氏距离', '曼哈顿距离'], default: '欧氏距离', label: '距离度量' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const k = Math.round(num(params, 'k', 5));
    const count = Math.round(num(params, 'points', 80));
    const metric = str(params, 'metric', '欧氏距离');
    const rand = rng(31415);
    const data: Array<[number, number, number]> = [];
    for (let i = 0; i < count; i++) {
      const x = rand();
      const y = rand();
      data.push([x, y, x + y > 1 ? 1 : 0]);
    }
    const dist = (a: [number, number], b: [number, number]): number =>
      metric === '欧氏距离' ? Math.hypot(a[0] - b[0], a[1] - b[1]) : Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

    // 决策区域（低分辨率网格）
    const steps = 44;
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < steps; j++) {
        const px = i / steps;
        const py = j / steps;
        const sorted = [...data].sort((a, b) => dist([px, py], [a[0], a[1]]) - dist([px, py], [b[0], b[1]]));
        const votes = sorted.slice(0, k).reduce((s, d) => s + d[2], 0);
        const p = votes / k;
        f.ctx.save();
        f.ctx.fillStyle = p > 0.5 ? `rgba(102,126,234,${(p - 0.5) * 0.55})` : `rgba(245,101,101,${(0.5 - p) * 0.55})`;
        f.ctx.fillRect(44 + (i / steps) * (w - 88), 56 + (j / steps) * (h - 165), (w - 88) / steps + 1, (h - 165) / steps + 1);
        f.ctx.restore();
      }
    }
    data.forEach(([x, y, label]) => dot(f, 44 + x * (w - 88), 56 + y * (h - 165), 3.2, label === 1 ? C.accent : C.hot));

    footnotes(f, [
      `k = ${k}、${count} 个样本、${metric}：背景色是该点的预测类别（深浅表示投票比例）`,
      k === 1 ? 'k = 1：决策边界极其破碎（对噪声敏感，过拟合）' : k > 15 ? 'k 很大：边界过于平滑，可能欠拟合' : 'k 适中：边界平滑但保留了局部结构',
      'KNN 是"懒惰学习"：没有训练过程，预测时遍历数据（用 KD 树/Voronoi 可加速）',
    ]);
    heading(f, 'KNN：决策边界与 k 的关系');
  },
});

/** A69 K 均值深化。 */
const kmeansA69 = defineViz({
  slug: 'kmeans-a69',
  title: 'K均值深化',
  params: {
    k: { type: 'range', min: 2, max: 8, default: 4, label: '簇数 K' },
    steps: { type: 'range', min: 1, max: 12, default: 8, label: '迭代步数' },
    init: { type: 'select', options: ['随机初始化', 'k-means++'], default: 'k-means++', label: '初始化' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const k = Math.round(num(params, 'k', 4));
    const steps = Math.round(num(params, 'steps', 8));
    const initMode = str(params, 'init', 'k-means++');
    const rand = rng(2718);
    const trueCenters: Array<[number, number]> = Array.from({ length: k }, () => [rand() * 2 - 1, rand() * 2 - 1]);
    const points: Array<[number, number]> = [];
    trueCenters.forEach(([cx, cy]) => {
      for (let i = 0; i < 18; i++) points.push([cx + gaussians(rand, 1)[0] * 0.16, cy + gaussians(rand, 1)[0] * 0.16]);
    });

    let centroids: Array<[number, number]>;
    if (initMode === 'k-means++') {
      centroids = [[points[0][0], points[0][1]]];
      while (centroids.length < k) {
        const dists = points.map((p) => Math.min(...centroids.map((c) => (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2)));
        const total = dists.reduce((a, b) => a + b, 0);
        let r = rand() * total;
        let chosen = 0;
        for (let i = 0; i < dists.length; i++) {
          r -= dists[i];
          if (r <= 0) {
            chosen = i;
            break;
          }
        }
        centroids.push([points[chosen][0], points[chosen][1]]);
      }
    } else {
      centroids = points.slice(0, k).map((p) => [p[0], p[1]] as [number, number]);
    }

    let assign = new Array<number>(points.length).fill(0);
    const inertiaHistory: number[] = [];
    for (let it = 0; it < steps; it++) {
      assign = points.map((p) => {
        let best = 0;
        let bd = Infinity;
        centroids.forEach((c, ci) => {
          const dd = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2;
          if (dd < bd) {
            bd = dd;
            best = ci;
          }
        });
        return best;
      });
      const inertia = points.reduce((a, p, i) => a + ((p[0] - centroids[assign[i]][0]) ** 2 + (p[1] - centroids[assign[i]][1]) ** 2), 0);
      inertiaHistory.push(inertia);
      centroids = centroids.map((c, ci) => {
        const members = points.filter((_, i) => assign[i] === ci);
        if (members.length === 0) return c;
        return [members.reduce((a, p) => a + p[0], 0) / members.length, members.reduce((a, p) => a + p[1], 0) / members.length] as [number, number];
      });
    }

    const v = view(f, { xMin: -2.2, xMax: 2.2, yMin: -2.2, yMax: 2.2, inset: 40 });
    grid(f, v, { divisions: 5, ticks: false });
    points.forEach((p, i) => dot(f, v.sx(p[0]), v.sy(p[1]), 3.2, `${PALETTE[assign[i] % PALETTE.length]}cc`));
    centroids.forEach(([cx, cy], ci) => {
      dot(f, v.sx(cx), v.sy(cy), 7.5, PALETTE[ci % PALETTE.length]);
      text(f, `μ${ci + 1}`, v.sx(cx) + 10, v.sy(cy) - 6, { color: PALETTE[ci % PALETTE.length], font: '11px sans-serif' });
    });

    footnotes(f, [
      `${initMode}、K = ${k}：簇内平方和 ${inertiaHistory[inertiaHistory.length - 1].toFixed(4)}（初始 ${inertiaHistory[0].toFixed(4)}）`,
      `目标函数单调下降：${inertiaHistory.map((x) => x.toFixed(2)).join(' → ')}`,
      initMode === 'k-means++' ? 'k-means++ 让初始质心彼此远离，显著降低陷入劣质局部最优的概率' : '随机初始化可能让多个质心落在同一簇，导致结果较差（局部最优）',
    ]);
    heading(f, 'K-means：迭代与局部最优');
  },
});

/** A70 朴素贝叶斯。 */
const naiveBayes = defineViz({
  slug: 'naive-bayes',
  title: '贝叶斯网络',
  params: {
    spamRate: { type: 'range', min: 0.1, max: 0.9, default: 0.4, step: 0.05, label: '垃圾邮件先验' },
    wordSpam: { type: 'range', min: 0.3, max: 1, default: 0.8, step: 0.05, label: 'P(词|垃圾)' },
    wordHam: { type: 'range', min: 0.01, max: 0.5, default: 0.15, step: 0.01, label: 'P(词|正常)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const prior = num(params, 'spamRate', 0.4);
    const pWordSpam = num(params, 'wordSpam', 0.8);
    const pWordHam = num(params, 'wordHam', 0.15);
    // 朴素贝叶斯：P(垃圾|词) ∝ P(词|垃圾)P(垃圾)
    const pSpamWord = pWordSpam * prior;
    const pHamWord = pWordHam * (1 - prior);
    const posterior = pSpamWord / (pSpamWord + pHamWord);

    // 左侧：概率柱对比
    const top = 56;
    const plotH = h - 190;
    const groups: Array<[string, number, number, string]> = [
      ['先验 P(垃圾)', prior, 1, C.dim],
      ['P(词|垃圾)', pWordSpam, 1, C.hot],
      ['P(词|正常)', pWordHam, 1, C.cool],
      ['后验 P(垃圾|词)', posterior, 1, C.green],
    ];
    const slot = (w - 120) / groups.length;
    groups.forEach(([label, value, , color], i) => {
      const x = 60 + i * slot;
      const bh = value * plotH;
      f.ctx.save();
      f.ctx.fillStyle = color;
      f.ctx.fillRect(x + slot * 0.2, top + plotH - bh, slot * 0.6, bh);
      f.ctx.restore();
      text(f, `${(value * 100).toFixed(1)}%`, x + slot / 2, top + plotH - bh - 8, { align: 'center', color: C.fg, font: '12px sans-serif' });
      text(f, label, x + slot / 2, top + plotH + 20, { align: 'center', color: C.dim, font: '10px sans-serif' });
    });
    seg(f, 60, top + plotH, 60 + groups.length * slot, top + plotH, C.dim, 1);

    footnotes(f, [
      `P(垃圾|词) = P(词|垃圾)P(垃圾) / [P(词|垃圾)P(垃圾) + P(词|正常)P(正常)] = ${(posterior * 100).toFixed(2)}%`,
      `"朴素"的假设是各特征条件独立，因此多个词的概率可以连乘：P(w₁,w₂|垃圾) ≈ P(w₁|垃圾)P(w₂|垃圾)`,
      '朴素贝叶斯训练极快、小样本表现好，是垃圾邮件过滤的经典方法（尽管独立性假设常被违反）',
    ]);
    heading(f, '朴素贝叶斯分类');
  },
});

/** A71 高斯混合深化。 */
const gaussianMixtureA71 = defineViz({
  slug: 'gaussian-mixture-a71',
  title: '高斯混合深化',
  params: {
    components: { type: 'range', min: 2, max: 5, default: 3, label: '成分数' },
    iterations: { type: 'range', min: 1, max: 40, default: 15, label: 'EM 迭代次数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const k = Math.round(num(params, 'components', 3));
    const iters = Math.round(num(params, 'iterations', 15));
    const rand = rng(13579);
    const trueCenters: Array<[number, number]> = Array.from({ length: k }, () => [rand() * 3 - 1.5, rand() * 3 - 1.5]);
    const points: Array<[number, number]> = [];
    trueCenters.forEach(([cx, cy]) => {
      for (let i = 0; i < 30; i++) points.push([cx + gaussians(rand, 1)[0] * 0.35, cy + gaussians(rand, 1)[0] * 0.35]);
    });

    // EM 算法
    let means: Array<[number, number]> = points.slice(0, k).map((p) => [p[0], p[1]] as [number, number]);
    let sigmas = new Array<number>(k).fill(0.6);
    let weights = new Array<number>(k).fill(1 / k);
    const gauss2 = (p: [number, number], m: [number, number], s: number): number =>
      Math.exp(-((p[0] - m[0]) ** 2 + (p[1] - m[1]) ** 2) / (2 * s * s)) / (2 * Math.PI * s * s);

    for (let it = 0; it < iters; it++) {
      // E 步：责任度
      const resp = points.map((p) => {
        const vals = means.map((m, ci) => weights[ci] * gauss2(p, m, sigmas[ci]));
        const total = vals.reduce((a, b) => a + b, 0) || 1e-12;
        return vals.map((v0) => v0 / total);
      });
      // M 步：更新参数
      means = means.map((m, ci) => {
        const numer = points.reduce((a, p, i) => [a[0] + resp[i][ci] * p[0], a[1] + resp[i][ci] * p[1]], [0, 0]);
        const denom = points.reduce((a, _, i) => a + resp[i][ci], 0) || 1e-12;
        return [numer[0] / denom, numer[1] / denom] as [number, number];
      });
      sigmas = sigmas.map((_, ci) => {
        const denom = points.reduce((a, _, i) => a + resp[i][ci], 0) || 1e-12;
        const varsum = points.reduce((a, p, i) => a + resp[i][ci] * ((p[0] - means[ci][0]) ** 2 + (p[1] - means[ci][1]) ** 2), 0);
        return Math.sqrt(Math.max(1e-4, varsum / (2 * denom)));
      });
      weights = weights.map((_, ci) => points.reduce((a, _, i) => a + resp[i][ci], 0) / points.length);
    }

    const v = view(f, { xMin: -4, xMax: 4, yMin: -4, yMax: 4, inset: 40 });
    grid(f, v, { divisions: 5, ticks: false });
    // 责任度着色
    points.forEach((p) => {
      const vals = means.map((m, ci) => weights[ci] * gauss2(p, m, sigmas[ci]));
      const total = vals.reduce((a, b) => a + b, 0) || 1e-12;
      let bestC = 0;
      let bestV = -1;
      vals.forEach((val, ci) => {
        if (val / total > bestV) {
          bestV = val / total;
          bestC = ci;
        }
      });
      dot(f, v.sx(p[0]), v.sy(p[1]), 3.4, `${PALETTE[bestC % PALETTE.length]}${Math.round(80 + bestV * 120).toString(16)}`);
    });
    // 椭圆表示各成分
    means.forEach(([mx, my], ci) => {
      const s = sigmas[ci];
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 80; i++) {
        const t = (i / 80) * Math.PI * 2;
        pts.push([v.sx(mx + 2 * s * Math.cos(t)), v.sy(my + 2 * s * Math.sin(t))]);
      }
      poly(f, pts, { stroke: `${PALETTE[ci % PALETTE.length]}cc`, lw: 2 });
      dot(f, v.sx(mx), v.sy(my), 5, PALETTE[ci % PALETTE.length]);
    });

    footnotes(f, [
      `EM 迭代 ${iters} 次拟合 ${k} 个高斯成分：权重 [${weights.map((x) => x.toFixed(3)).join(', ')}]`,
      '椭圆是各成分的 2σ 等概率轮廓；点的颜色深浅表示"责任度"（属于该成分的概率）',
      'EM 交替优化：E 步算责任度（软分配），M 步更新参数 —— 每步都单调提升似然，收敛到局部最优',
    ]);
    heading(f, '高斯混合：EM 软聚类');
  },
});

registerViz(
  backpropagationA62,
  neuralNetworkForwardA63,
  perceptronA64,
  softmaxA65,
  logisticRegressionA66,
  decisionTreeA67,
  knnA68,
  kmeansA69,
  naiveBayes,
  gaussianMixtureA71,
);
