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

/** A40 梯度下降深化。 */
const gradientDescent = defineViz({
  slug: 'gradient-descent',
  title: '梯度下降深化',
  params: {
    lr: { type: 'range', min: 0.02, max: 1.2, default: 0.12, step: 0.02, label: '学习率 η' },
    steps: { type: 'range', min: 3, max: 60, default: 22, label: '迭代步数' },
    start: { type: 'range', min: -3, max: 3, default: -2.6, step: 0.1, label: '起点' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const lr = num(params, 'lr', 0.12);
    const steps = Math.round(num(params, 'steps', 22));
    const start = num(params, 'start', -2.6);
    // 目标 f(x) = x⁴ - 3x² + x + 2（多局部极小）
    const fn = (x: number): number => x ** 4 - 3 * x * x + x + 2;
    const grad = (x: number): number => 4 * x ** 3 - 6 * x + 1;

    const v = view(f, { xMin: -3.2, xMax: 3.2, yMin: -3, yMax: 8, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });
    curve(f, v, fn, { color: C.dim, lw: 1.8, dash: [5, 4] });

    let x = start;
    const trail: Array<[number, number]> = [[x, fn(x)]];
    for (let i = 0; i < steps; i++) {
      x = x - lr * grad(x);
      if (Math.abs(x) > 6) break;
      trail.push([x, fn(x)]);
    }
    trail.forEach(([px, py], i) => {
      dot(f, v.sx(px), v.sy(py), 4, PALETTE[i % PALETTE.length]);
      if (i > 0) {
        const [prevX, prevY] = trail[i - 1];
        seg(f, v.sx(prevX), v.sy(prevY), v.sx(px), v.sy(py), `${PALETTE[(i - 1) % PALETTE.length]}88`, 1.4);
      }
    });
    dot(f, v.sx(x), v.sy(fn(x)), 6, C.warm);

    footnotes(f, [
      `学习率 η = ${lr}，从 x = ${start.toFixed(1)} 出发迭代 ${steps} 步 ⇒ x = ${x.toFixed(5)}，f = ${fn(x).toFixed(5)}`,
      '更新公式 x ← x - η∇f(x)：沿负梯度方向走一小步',
      lr > 0.5 ? '学习率偏大：轨迹明显"之"字形震荡，甚至可能发散' : lr < 0.05 ? '学习率偏小：收敛很慢，需要更多步数' : '学习率合适：稳定下降并停在局部极小值',
    ]);
    heading(f, '梯度下降：沿负梯度下山');
  },
});

/** A41 优化算法入门。 */
const optimization = defineViz({
  slug: 'optimization',
  title: '优化算法入门',
  params: {
    algorithm: { type: 'select', options: ['梯度下降', '动量法', 'Adam'], default: '动量法', label: '算法' },
    steps: { type: 'range', min: 5, max: 60, default: 25, label: '迭代步数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const algo = str(params, 'algorithm', '动量法');
    const steps = Math.round(num(params, 'steps', 25));
    // 二维二次目标（病态椭圆）：f = 0.1x² + 2y²
    const fn = (p: [number, number]): number => 0.1 * p[0] * p[0] + 2 * p[1] * p[1];
    const grad = (p: [number, number]): [number, number] => [0.2 * p[0], 4 * p[1]];

    const v = view(f, { xMin: -5.2, xMax: 5.2, yMin: -2.4, yMax: 2.4, inset: 40 });
    // 等值线
    for (let c = 0.5; c <= 6; c += 0.6) {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 100; i++) {
        const t = (i / 100) * Math.PI * 2;
        pts.push([v.sx(Math.sqrt(c / 0.1) * Math.cos(t)), v.sy(Math.sqrt(c / 2) * Math.sin(t))]);
      }
      poly(f, pts, { stroke: 'rgba(58,74,99,0.85)', lw: 1 });
    }
    grid(f, v, { divisions: 5, ticks: false });

    let p: [number, number] = [-4.6, 1.9];
    let vel: [number, number] = [0, 0];
    let m: [number, number] = [0, 0];
    let vv: [number, number] = [0, 0];
    const lr = algo === 'Adam' ? 0.35 : 0.5;
    const trail: Array<[number, number]> = [[p[0], p[1]]];
    for (let i = 0; i < steps; i++) {
      const g = grad(p);
      if (algo === '动量法') {
        vel = [0.85 * vel[0] + g[0], 0.85 * vel[1] + g[1]];
        p = [p[0] - lr * vel[0], p[1] - lr * vel[1]];
      } else if (algo === 'Adam') {
        m = [0.9 * m[0] + 0.1 * g[0], 0.9 * m[1] + 0.1 * g[1]];
        vv = [0.999 * vv[0] + 0.001 * g[0] * g[0], 0.999 * vv[1] + 0.001 * g[1] * g[1]];
        const mh: [number, number] = [m[0] / (1 - Math.pow(0.9, i + 1)), m[1] / (1 - Math.pow(0.9, i + 1))];
        const vh: [number, number] = [vv[0] / (1 - Math.pow(0.999, i + 1)), vv[1] / (1 - Math.pow(0.999, i + 1))];
        p = [p[0] - (lr * mh[0]) / (Math.sqrt(vh[0]) + 1e-8), p[1] - (lr * mh[1]) / (Math.sqrt(vh[1]) + 1e-8)];
      } else {
        p = [p[0] - lr * g[0], p[1] - lr * g[1]];
      }
      trail.push([p[0], p[1]]);
    }
    trail.forEach(([px, py], i) => {
      dot(f, v.sx(px), v.sy(py), 3.4, PALETTE[i % PALETTE.length]);
      if (i > 0) seg(f, v.sx(trail[i - 1][0]), v.sy(trail[i - 1][1]), v.sx(px), v.sy(py), `${PALETTE[(i - 1) % PALETTE.length]}aa`, 1.4);
    });
    dot(f, v.sx(0), v.sy(0), 5, C.warm);

    footnotes(f, [
      `${algo} 在病态二次函数 f = 0.1x² + 2y²（条件数 20）上的轨迹，最终 f = ${fn(p).toExponential(2)}`,
      '等值线是细长的椭圆 —— 梯度方向几乎与"下山方向"垂直，导致普通梯度下降来回震荡',
      algo === '梯度下降' ? '普通梯度下降在窄方向上反复横跳，收敛最慢' : algo === '动量法' ? '动量法累积历史梯度，沿长轴加速，明显减少震荡' : 'Adam 自适应缩放每个坐标的学习率，在病态问题上表现最好',
    ]);
    heading(f, `优化算法：${algo}`);
  },
});

/** A42 牛顿法深化。 */
const newtonMethod = defineViz({
  slug: 'newton-method',
  title: '牛顿法深化',
  params: {
    x0: { type: 'range', min: -2.5, max: 2.5, default: 1.8, step: 0.1, label: '初始猜测 x₀' },
    steps: { type: 'range', min: 1, max: 8, default: 3, label: '迭代步数' },
    func: { type: 'select', options: ['x³ - 2x - 5', 'cos x - x', 'x² - 2'], default: 'x³ - 2x - 5', label: '方程 f(x)=0' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    let x = num(params, 'x0', 1.8);
    const steps = Math.round(num(params, 'steps', 3));
    const func = str(params, 'func', 'x³ - 2x - 5');
    const fn = func === 'cos x - x' ? (t: number): number => Math.cos(t) - t
      : func === 'x² - 2' ? (t: number): number => t * t - 2
        : (t: number): number => t ** 3 - 2 * t - 5;
    const dfn = (t: number): number => (fn(t + 1e-6) - fn(t - 1e-6)) / 2e-6;

    const v = view(f, { xMin: -3, xMax: 3, yMin: -10, yMax: 10, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });
    curve(f, v, fn, { color: C.dim, lw: 1.8, dash: [5, 4] });
    seg(f, v.sx(-3), v.sy(0), v.sx(3), v.sy(0), C.dim, 1.2);

    for (let i = 0; i < steps; i++) {
      const y = fn(x);
      const slope = dfn(x);
      if (Math.abs(slope) < 1e-12) break;
      const nextX = x - y / slope;
      // 切线
      seg(f, v.sx(x), v.sy(y), v.sx(nextX), v.sy(0), PALETTE[i % PALETTE.length], 1.6);
      dot(f, v.sx(x), v.sy(y), 4.5, PALETTE[i % PALETTE.length]);
      dot(f, v.sx(nextX), v.sy(0), 3.5, PALETTE[i % PALETTE.length]);
      x = nextX;
      if (Math.abs(x) > 20) break;
    }
    dot(f, v.sx(x), v.sy(0), 6, C.warm);

    footnotes(f, [
      `方程 ${func} = 0，从 x₀ = ${num(params, 'x0', 1.8).toFixed(1)} 迭代 ${steps} 步得 x = ${x.toFixed(10)}，f(x) = ${fn(x).toExponential(2)}`,
      '牛顿法用切线代替曲线：x_{n+1} = x_n - f(x_n)/f\'(x_n)，在单根附近是平方收敛（有效位数每步翻倍）',
      '平方收敛的代价：需要导数、对初值敏感、在 f\' ≈ 0 处失效 —— 这是"牛顿法快但娇气"的含义',
    ]);
    heading(f, '牛顿法：切线法求根');
  },
});

/** A43 二分法深化。 */
const bisectionMethod = defineViz({
  slug: 'bisection-method',
  title: '二分法深化',
  params: {
    a: { type: 'range', min: -3, max: 0, default: -1.2, step: 0.1, label: '左端 a' },
    b: { type: 'range', min: 0.5, max: 4, default: 2.6, step: 0.1, label: '右端 b' },
    iterations: { type: 'range', min: 1, max: 20, default: 6, label: '迭代次数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    let a = num(params, 'a', -1.2);
    let b = num(params, 'b', 2.6);
    const iters = Math.round(num(params, 'iterations', 6));
    const fn = (x: number): number => x ** 3 - 2 * x - 5;

    const v = view(f, { xMin: -3, xMax: 4, yMin: -12, yMax: 12, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });
    curve(f, v, fn, { color: C.dim, lw: 1.8, dash: [5, 4] });
    seg(f, v.sx(-3), v.sy(0), v.sx(4), v.sy(0), C.dim, 1.2);

    const history: Array<[number, number, number]> = [];
    for (let i = 0; i < iters; i++) {
      const mid = (a + b) / 2;
      history.push([a, b, mid]);
      dot(f, v.sx(mid), v.sy(0), 4.5, PALETTE[i % PALETTE.length]);
      if (fn(a) * fn(mid) <= 0) b = mid;
      else a = mid;
    }
    const root = (a + b) / 2;
    // 最后区间高亮
    seg(f, v.sx(a), v.sy(0), v.sx(b), v.sy(0), C.warm, 4);
    dot(f, v.sx(root), v.sy(0), 6, C.warm);

    history.forEach(([ha, hb, mid], i) => {
      text(f, `第 ${i + 1} 步：[${ha.toFixed(4)}, ${hb.toFixed(4)}]，中点 ${mid.toFixed(4)}`, 30, h - 100 + i * 15, {
        color: PALETTE[i % PALETTE.length],
        font: '10px Consolas, monospace',
      });
    });

    footnotes(f, [
      `${iters} 次二分后根 ≈ ${root.toFixed(8)}（区间长度 ${(b - a).toExponential(2)}）`,
      '二分法只依赖"符号变化"，因此必定收敛且误差每步减半（线性收敛，1 bit/步）',
      `要达到 1e-8 精度约需 ${Math.ceil(Math.log2((num(params, 'b', 2.6) - num(params, 'a', -1.2)) / 1e-8))} 次迭代 —— 慢但绝对可靠`,
    ]);
    heading(f, '二分法：可靠但稳健');
  },
});

/** A44 割线法。 */
const secantMethod = defineViz({
  slug: 'secant-method',
  title: '割线法',
  params: {
    x0: { type: 'range', min: 1, max: 3, default: 2.6, step: 0.1, label: 'x₀' },
    x1: { type: 'range', min: 0.5, max: 2.5, default: 1.4, step: 0.1, label: 'x₁' },
    steps: { type: 'range', min: 1, max: 8, default: 4, label: '迭代步数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    let x0 = num(params, 'x0', 2.6);
    let x1 = num(params, 'x1', 1.4);
    const steps = Math.round(num(params, 'steps', 4));
    const fn = (x: number): number => x ** 3 - 2 * x - 5;
    const v = view(f, { xMin: -1, xMax: 4, yMin: -10, yMax: 16, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    curve(f, v, fn, { color: C.dim, lw: 1.8, dash: [5, 4] });
    seg(f, v.sx(-1), v.sy(0), v.sx(4), v.sy(0), C.dim, 1.2);

    for (let i = 0; i < steps; i++) {
      const f0 = fn(x0);
      const f1 = fn(x1);
      if (Math.abs(f1 - f0) < 1e-14) break;
      const x2 = x1 - (f1 * (x1 - x0)) / (f1 - f0);
      seg(f, v.sx(x0), v.sy(f0), v.sx(x1), v.sy(f1), PALETTE[i % PALETTE.length], 1.6);
      dot(f, v.sx(x1), v.sy(f1), 4.5, PALETTE[i % PALETTE.length]);
      dot(f, v.sx(x2), v.sy(0), 3.5, PALETTE[i % PALETTE.length]);
      x0 = x1;
      x1 = x2;
    }
    dot(f, v.sx(x1), v.sy(0), 6, C.warm);

    footnotes(f, [
      `${steps} 步割线法得 x = ${x1.toFixed(10)}，f(x) = ${fn(x1).toExponential(2)}`,
      '割线法用"两点连线"代替导数：x_{n+1} = x_n - f(x_n)(x_n - x_{n-1})/(f(x_n) - f(x_{n-1}))',
      '不需要导数（比牛顿法实用），收敛阶约 1.618（黄金比）—— 介于二分与牛顿之间',
    ]);
    heading(f, '割线法：用两点连线代替切线');
  },
});

/** A45 不动点迭代。 */
const fixedPointIteration = defineViz({
  slug: 'fixed-point-iteration',
  title: '不动点迭代',
  params: {
    rule: { type: 'select', options: ['cos x', '(x+2/x)/2', '1 + 1/x', '2 - 0.5x'], default: 'cos x', label: '迭代函数 g(x)' },
    x0: { type: 'range', min: 0.1, max: 2.5, default: 1.2, step: 0.05, label: '初值 x₀' },
    steps: { type: 'range', min: 2, max: 40, default: 14, label: '迭代步数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const rule = str(params, 'rule', 'cos x');
    const x0 = num(params, 'x0', 1.2);
    const steps = Math.round(num(params, 'steps', 14));
    const g = rule === '(x+2/x)/2' ? (x: number): number => (x + 2 / x) / 2
      : rule === '1 + 1/x' ? (x: number): number => 1 + 1 / x
        : rule === '2 - 0.5x' ? (x: number): number => 2 - 0.5 * x
          : (x: number): number => Math.cos(x);

    const v = view(f, { xMin: 0, xMax: 2.5, yMin: 0, yMax: 2.5, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });
    curve(f, v, g, { color: C.accent, lw: 2.2 });
    poly(f, [[v.sx(0), v.sy(0)], [v.sx(2.5), v.sy(2.5)]], { stroke: C.dim, lw: 1.4, dash: [5, 4] });

    // 蛛网图
    let x = x0;
    const trail: Array<[number, number]> = [];
    for (let i = 0; i < steps; i++) {
      const y = g(x);
      trail.push([x, x], [x, y], [y, y]);
      x = y;
      if (!Number.isFinite(x) || x > 2.5 || x < 0) break;
    }
    poly(f, trail.map(([px, py]) => [v.sx(px), v.sy(py)] as [number, number]), { stroke: `${C.warm}cc`, lw: 1.6 });
    dot(f, v.sx(x), v.sy(x), 5.5, C.green);

    // 收敛性判断：|g'| < 1
    const gprime = Math.abs((g(x + 1e-4) - g(x - 1e-4)) / 2e-4);
    footnotes(f, [
      `迭代 g(x) = ${rule}，从 ${x0.toFixed(2)} 出发 ${steps} 步后 x = ${x.toFixed(8)}`,
  `不动点处 |g'| = ${gprime.toFixed(4)}：${gprime < 1 ? '小于 1 ⇒ 压缩映射，迭代收敛' : '大于 1 ⇒ 迭代发散或振荡'}`,
      '不动点定理：若 |g\'| < 1 在区间上成立，则迭代必收敛到唯一不动点（巴拿赫压缩映射原理）',
    ]);
    heading(f, '不动点迭代与蛛网图');
  },
});

/** A46 最小二乘。 */
const leastSquares = defineViz({
  slug: 'least-squares',
  title: '最小二乘',
  params: {
    degree: { type: 'range', min: 1, max: 6, default: 2, label: '拟合阶数' },
    noise: { type: 'range', min: 0, max: 2, default: 0.7, step: 0.1, label: '噪声强度' },
    count: { type: 'range', min: 6, max: 30, default: 14, label: '数据点数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const degree = Math.round(num(params, 'degree', 2));
    const noise = num(params, 'noise', 0.7);
    const count = Math.round(num(params, 'count', 14));
    const rand = rng(31415);
    const base = (x: number): number => Math.sin(x * 0.9) * 1.6;
    const data: Array<[number, number]> = [];
    for (let i = 0; i < count; i++) {
      const x = -3 + (6 * i) / (count - 1);
      data.push([x, base(x) + gaussians(rand, 1)[0] * noise * 0.5]);
    }

    // 正规方程 (AᵀA)c = Aᵀy（多项式基）
    const m = degree + 1;
    const A: number[][] = data.map(([x]) => Array.from({ length: m }, (_, k) => Math.pow(x, k)));
    const ata: number[][] = Array.from({ length: m }, () => new Array<number>(m).fill(0));
    const aty: number[] = new Array<number>(m).fill(0);
    for (let i = 0; i < A.length; i++) {
      for (let j = 0; j < m; j++) {
        aty[j] += A[i][j] * data[i][1];
        for (let k = 0; k < m; k++) ata[j][k] += A[i][j] * A[i][k];
      }
    }
    // 高斯消元
    const aug = ata.map((row, i) => [...row, aty[i]]);
    for (let i = 0; i < m; i++) {
      let pivot = i;
      for (let r = i + 1; r < m; r++) if (Math.abs(aug[r][i]) > Math.abs(aug[pivot][i])) pivot = r;
      [aug[i], aug[pivot]] = [aug[pivot], aug[i]];
      if (Math.abs(aug[i][i]) < 1e-12) continue;
      for (let r = 0; r < m; r++) {
        if (r === i) continue;
        const factor = aug[r][i] / aug[i][i];
        for (let c = i; c <= m; c++) aug[r][c] -= factor * aug[i][c];
      }
    }
    const coeff = aug.map((row, i) => (Math.abs(row[i]) < 1e-12 ? 0 : row[m] / row[i]));
    const fit = (x: number): number => coeff.reduce((a, c, k) => a + c * Math.pow(x, k), 0);

    const v = view(f, { xMin: -3.4, xMax: 3.4, yMin: -3, yMax: 3, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });
    curve(f, v, base, { color: `${C.dim}88`, lw: 1.4, dash: [5, 4] });
    curve(f, v, fit, { color: C.accent, lw: 2.4 });
    data.forEach(([x, y]) => {
      dot(f, v.sx(x), v.sy(y), 4, C.warm);
      seg(f, v.sx(x), v.sy(y), v.sx(x), v.sy(fit(x)), `${C.hot}55`, 1.2);
    });
    const rss = data.reduce((a, [x, y]) => a + (y - fit(x)) ** 2, 0);

    footnotes(f, [
      `${degree} 次多项式最小二乘拟合，残差平方和 RSS = ${rss.toFixed(4)}`,
      '最小二乘解 c = (AᵀA)⁻¹Aᵀy：使所有数据点的垂直偏差平方和最小（红色竖线）',
      degree >= 5 ? '阶数过高时曲线开始"穿过噪声"（过拟合），虽然 RSS 更小但预测能力变差' : '阶数越高拟合越贴合，但要注意过拟合：拟合误差小 ≠ 泛化好',
    ]);
    heading(f, '最小二乘：让残差平方和最小');
  },
});

/** A47 回归分析深化。 */
const regression = defineViz({
  slug: 'regression',
  title: '回归分析深化',
  params: {
    slope: { type: 'range', min: -2, max: 2, default: 1.3, step: 0.1, label: '真实斜率' },
    noise: { type: 'range', min: 0.1, max: 2, default: 0.8, step: 0.1, label: '噪声 σ' },
    count: { type: 'range', min: 8, max: 60, default: 30, step: 2, label: '样本数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const slope = num(params, 'slope', 1.3);
    const noise = num(params, 'noise', 0.8);
    const count = Math.round(num(params, 'count', 30));
    const rand = rng(777);
    const data: Array<[number, number]> = [];
    for (let i = 0; i < count; i++) {
      const x = rand() * 6 - 3;
      data.push([x, slope * x + 0.6 + gaussians(rand, 1)[0] * noise]);
    }
    const n = data.length;
    const sx = data.reduce((a, [x]) => a + x, 0);
    const sy = data.reduce((a, [, y]) => a + y, 0);
    const sxy = data.reduce((a, [x, y]) => a + x * y, 0);
    const sxx = data.reduce((a, [x]) => a + x * x, 0);
    const k = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    const b = (sy - k * sx) / n;
    // 残差与 R²
    const meanY = sy / n;
    const sst = data.reduce((a, [, y]) => a + (y - meanY) ** 2, 0);
    const sse = data.reduce((a, [x, y]) => a + (y - (k * x + b)) ** 2, 0);
    const r2 = 1 - sse / sst;
    // 标准误（斜率）
    const se = Math.sqrt(sse / (n - 2) / (sxx - (sx * sx) / n));

    const v = view(f, { xMin: -4, xMax: 4, yMin: -6, yMax: 6, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    data.forEach(([x, y]) => {
      dot(f, v.sx(x), v.sy(y), 3.6, C.dim);
      seg(f, v.sx(x), v.sy(y), v.sx(x), v.sy(k * x + b), `${C.hot}44`, 1);
    });
    poly(f, [[v.sx(-4), v.sy(-4 * k + b)], [v.sx(4), v.sy(4 * k + b)]], { stroke: C.accent, lw: 2.6 });
    // 置信带（±2SE）
    for (const sign of [1, -1]) {
      poly(f, [
        [v.sx(-4), v.sy(-4 * (k + sign * 2 * se) + b)],
        [v.sx(4), v.sy(4 * (k + sign * 2 * se) + b)],
      ], { stroke: `${C.green}aa`, lw: 1.4, dash: [5, 4] });
    }

    footnotes(f, [
      `拟合 y = ${k.toFixed(4)}x + ${b.toFixed(4)}（真实斜率 ${slope}），R² = ${r2.toFixed(4)}`,
      `斜率标准误 = ${se.toFixed(4)}，95% 置信区间 ≈ [${(k - 1.96 * se).toFixed(3)}, ${(k + 1.96 * se).toFixed(3)}]`,
      'R² 表示"模型解释了因变量多少比例的变化"；绿色虚线是斜率的 95% 置信带',
    ]);
    heading(f, '线性回归与置信带');
  },
});

/** A48 数值分析入门。 */
const numericalAnalysis = defineViz({
  slug: 'numerical-analysis',
  title: '数值分析入门',
  params: {
    h: { type: 'range', min: 1e-8, max: 0.5, default: 1e-3, label: '步长 h' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const hStep = num(params, 'h', 1e-3);
    const fn = (x: number): number => Math.sin(x);
    const exact = (x: number): number => Math.cos(x);

    // 前向差分的误差随 h 变化（截断误差 ~ h，舍入误差 ~ ε/h，总误差有最优 h）
    const errors: Array<[number, number]> = [];
    const xs = 1.0;
    for (let e = -16; e <= 0; e += 0.25) {
      const hh = Math.pow(10, e);
      const approx = (fn(xs + hh) - fn(xs)) / hh;
      const err = Math.abs(approx - exact(xs));
      errors.push([e, Math.max(err, 1e-20)]);
    }

    const v = view(f, { xMin: -16, xMax: 0, yMin: -17, yMax: 1, inset: 44 });
    grid(f, v, { divisions: 5, ticks: true });
    poly(f, errors.map(([e, err]) => [v.sx(e), v.sy(Math.log10(err))] as [number, number]), { stroke: C.accent, lw: 2.4 });
    // 参考线：截断误差 ~ h（斜率 1），舍入误差 ~ ε/h（斜率 -1）
    const refA: Array<[number, number]> = [];
    const refB: Array<[number, number]> = [];
    for (let e = -16; e <= 0; e += 0.5) {
      refA.push([v.sx(e), v.sy(e - 0.5)]);
      refB.push([v.sx(e), v.sy(-e - 16.5)]);
    }
    poly(f, refA, { stroke: `${C.warm}77`, lw: 1.2, dash: [5, 4] });
    poly(f, refB, { stroke: `${C.cool}77`, lw: 1.2, dash: [5, 4] });

    const curErr = Math.abs((fn(xs + hStep) - fn(xs)) / hStep - exact(xs));
    dot(f, v.sx(Math.log10(hStep)), v.sy(Math.log10(curErr)), 5.5, C.hot);
    text(f, '舍入误差主导', v.sx(-15.5), v.sy(-13), { color: C.cool, font: '11px sans-serif' });
    text(f, '截断误差主导', v.sx(-2.5), v.sy(-0.6), { color: C.warm, font: '11px sans-serif' });

    footnotes(f, [
      `当前 h = ${hStep}：前向差分误差 = ${curErr.toExponential(3)}（横轴 log₁₀h，纵轴 log₁₀误差）`,
      '误差曲线呈 V 形：h 太大截断误差大（橙线斜率 +1），h 太小舍入误差大（蓝线斜率 -1）',
      `最优步长约 h* ≈ √ε ≈ 1.5e-8，此时误差最小 —— 数值计算不能盲目"取更小的 h"`,
    ]);
    heading(f, '数值微分：截断误差与舍入误差的权衡');
  },
});

/** A49 拉普拉斯方程。 */
const laplaceA49 = defineViz({
  slug: 'laplace-a49',
  title: '拉普拉斯方程',
  params: {
    top: { type: 'range', min: 0, max: 1, default: 1, step: 0.1, label: '上边界电位' },
    left: { type: 'range', min: 0, max: 1, default: 0, step: 0.1, label: '左边界电位' },
    iterations: { type: 'range', min: 10, max: 400, default: 160, step: 10, label: '松弛迭代次数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const topV = num(params, 'top', 1);
    const leftV = num(params, 'left', 0);
    const iters = Math.round(num(params, 'iterations', 160));

    // 用 Jacobi 迭代求解正方形区域内的拉普拉斯方程
    const N = 48;
    let grid2: number[][] = Array.from({ length: N }, () => new Array<number>(N).fill(0));
    // 边界条件
    for (let i = 0; i < N; i++) {
      grid2[0][i] = topV;
      grid2[i][0] = leftV;
      grid2[N - 1][i] = 0;
      grid2[i][N - 1] = 0;
    }
    for (let k = 0; k < iters; k++) {
      const next = grid2.map((row) => [...row]);
      for (let i = 1; i < N - 1; i++) {
        for (let j = 1; j < N - 1; j++) {
          next[i][j] = (grid2[i - 1][j] + grid2[i + 1][j] + grid2[i][j - 1] + grid2[i][j + 1]) / 4;
        }
      }
      grid2 = next;
    }

    const size = Math.min(w - 130, h - 165);
    const ox = 50;
    const oy = 56;
    const cell = size / N;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const val = grid2[i][j];
        f.ctx.save();
        f.ctx.fillStyle = `hsl(${220 - val * 200}, 70%, ${20 + val * 45}%)`;
        f.ctx.fillRect(ox + j * cell, oy + i * cell, cell + 0.7, cell + 0.7);
        f.ctx.restore();
      }
    }
    // 等位线
    f.ctx.save();
    for (let level = 0.1; level < 1; level += 0.1) {
      for (let i = 1; i < N - 1; i++) {
        for (let j = 1; j < N - 1; j++) {
          if ((grid2[i][j] - level) * (grid2[i][j - 1] - level) < 0) {
            dot(f, ox + j * cell, oy + i * cell, 0.7, 'rgba(255,255,255,0.45)');
          }
        }
      }
    }
    f.ctx.restore();
    text(f, `上边界 V = ${topV}`, ox + size / 2, oy - 10, { align: 'center', color: C.warm, font: '11px sans-serif' });
    text(f, `左边界 V = ${leftV}`, ox - 6, oy + size / 2, { align: 'right', color: C.cool, font: '11px sans-serif' });

    footnotes(f, [
      `${N}×${N} 网格、Jacobi 松弛 ${iters} 次得到的稳态电位分布（白线为等位线）`,
      '拉普拉斯方程 ∇²V = 0：每点的值等于四邻域平均，因此解是"最光滑"的调和函数',
      '边界电位一确定，内部处处唯一确定；且内部没有极值（最大值必在边界上）—— 最大值原理',
    ]);
    heading(f, '拉普拉斯方程：边界决定一切');
  },
});

/** A50 拉普拉斯算子。 */
const laplacian = defineViz({
  slug: 'laplacian',
  title: '拉普拉斯算子',
  params: {
    mode: { type: 'select', options: ['峰值（负）', '鞍点（零）', '平坦（零）'], default: '峰值（负）', label: '测试函数' },
    scale: { type: 'range', min: 0.3, max: 2, default: 0.9, step: 0.1, label: '尺度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = str(params, 'mode', '峰值（负）');
    const scale = num(params, 'scale', 0.9);
    const fn = mode.startsWith('峰值')
      ? (x: number, y: number): number => Math.exp(-(x * x + y * y) / (2 * scale * scale))
      : mode.startsWith('鞍点')
        ? (x: number, y: number): number => (x * x - y * y) * 0.4
        : (x: number, y: number): number => 0.3 * x;
    // 数值拉普拉斯
    const lap = (x: number, y: number): number => {
      const eps = 1e-3;
      return (
        (fn(x + eps, y) + fn(x - eps, y) + fn(x, y + eps) + fn(x, y - eps) - 4 * fn(x, y)) / (eps * eps)
      );
    };

    const v = view(f, { xMin: -3, xMax: 3, yMin: -2.4, yMax: 2.4, inset: 42 });
    // 曲面着色
    const steps = 60;
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < steps; j++) {
        const x = -3 + (i / steps) * 6;
        const y = -2.4 + (j / steps) * 4.8;
        const z = fn(x, y);
        f.ctx.save();
        f.ctx.fillStyle = `hsla(${230 - Math.max(-1, Math.min(1, z)) * 140}, 60%, ${24 + Math.max(0, z) * 40}%, 0.9)`;
        f.ctx.fillRect(v.sx(x), v.sy(y), (6 / steps) * (v.sx(1) - v.sx(0)) + 1, (4.8 / steps) * (v.sy(0) - v.sy(1)) + 1);
        f.ctx.restore();
      }
    }
    grid(f, v, { divisions: 5, ticks: true });

    // 采样点的拉普拉斯值
    const samples: Array<[number, number]> = [[0, 0], [1.2, 0], [-0.8, 0.6], [0.6, -0.8]];
    samples.forEach(([x, y]) => {
      const l = lap(x, y);
      dot(f, v.sx(x), v.sy(y), 4.5, l < -0.05 ? C.hot : l > 0.05 ? C.cool : C.green);
    });

    footnotes(f, [
      `${mode}：拉普拉斯算子 ∇²f = f_xx + f_yy 在采样点的取值（红负、绿零、蓝正）`,
      '∇² 度量"该点与邻域平均值的差"：正比于局部曲率、与方向无关（旋转不变）',
      mode.startsWith('峰值') ? '峰值处 ∇² < 0（比周围"凸"），这正是热传导方程 ∂u/∂t = α∇²u 让峰值衰减的原因' : mode.startsWith('鞍点') ? '鞍点处 ∇² = 0：一个方向凸、一个方向凹，恰好抵消' : '线性函数的 ∇² = 0：这就是"调和函数"（满足 ∇²f = 0）的最简单例子',
    ]);
    heading(f, '拉普拉斯算子的几何意义');
  },
});

/** A51 条件数深化。 */
const conditionNumberA51 = defineViz({
  slug: 'condition-number-a51',
  title: '条件数深化',
  params: {
    eps: { type: 'range', min: 0.01, max: 1.5, default: 0.25, step: 0.01, label: '矩阵扰动 ε' },
    trials: { type: 'range', min: 20, max: 400, default: 200, step: 20, label: '随机扰动次数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const eps = num(params, 'eps', 0.25);
    const trials = Math.round(num(params, 'trials', 200));
    const rand = rng(1234);
    // 良态矩阵 A 与病态矩阵 B
    const solve = (a11: number, a12: number, a21: number, a22: number, b1: number, b2: number): [number, number] | null => {
      const det = a11 * a22 - a12 * a21;
      if (Math.abs(det) < 1e-12) return null;
      return [(b1 * a22 - b2 * a12) / det, (a11 * b2 - a21 * b1) / det];
    };
    const wellA = [3, 1, 1, 2];
    const illA = [1, 1, 1, 1.02];
    // 条件数（用奇异值比近似）
    const condOf = (a11: number, a12: number, a21: number, a22: number): number => {
      const tr = a11 * a11 + a12 * a12 + a21 * a21 + a22 * a22;
      const det = a11 * a22 - a12 * a21;
      const disc = Math.max(0, tr * tr - 4 * det * det);
      const s1 = Math.sqrt((tr + Math.sqrt(disc)) / 2);
      const s2 = Math.sqrt((tr - Math.sqrt(disc)) / 2);
      return s2 < 1e-12 ? Infinity : s1 / s2;
    };

    const collect = (A: number[]): number[] => {
      const exactSol = solve(A[0], A[1], A[2], A[3], 1, 1);
      if (!exactSol) return [];
      const errs: number[] = [];
      for (let i = 0; i < trials; i++) {
        const b1 = 1 + (rand() - 0.5) * 2 * eps;
        const b2 = 1 + (rand() - 0.5) * 2 * eps;
        const s = solve(A[0], A[1], A[2], A[3], b1, b2);
        if (!s) continue;
        errs.push(Math.hypot(s[0] - exactSol[0], s[1] - exactSol[1]) / Math.max(1e-12, Math.hypot(exactSol[0], exactSol[1])));
      }
      return errs;
    };
    const wellErrs = collect(wellA);
    const illErrs = collect(illA);
    const maxOf = (arr: number[]): number => (arr.length ? Math.max(...arr) : 0);

    const v = view(f, { xMin: 0, xMax: 1, yMin: 0, yMax: 1.05, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });
    const drawCdf = (errs: number[], color: string, label: string): void => {
      if (errs.length === 0) return;
      const sorted = [...errs].sort((a, b) => a - b);
      const pts: Array<[number, number]> = [[v.sx(0), v.sy(0)]];
      sorted.forEach((e, i) => {
        pts.push([v.sx(Math.min(1, e / 0.5)), v.sy((i + 1) / sorted.length)]);
      });
      poly(f, pts, { stroke: color, lw: 2.4 });
      text(f, label, v.sx(0.02), v.sy(0.9) + (label.includes('病态') ? 18 : 0), { color, font: '12px sans-serif' });
    };
    drawCdf(wellErrs, C.green, `良态矩阵（条件数 ${condOf(wellA[0], wellA[1], wellA[2], wellA[3]).toFixed(2)}）`);
    drawCdf(illErrs, C.hot, `病态矩阵（条件数 ${condOf(illA[0], illA[1], illA[2], illA[3]).toFixed(2)}）`);

    footnotes(f, [
      `右端项扰动 ε = ${eps}（纵轴为累积概率，横轴为相对误差 / 0.5）`,
      `良态矩阵最大相对误差 ${maxOf(wellErrs).toFixed(4)}，病态矩阵 ${maxOf(illErrs).toFixed(4)} —— 相差约 ${(maxOf(illErrs) / Math.max(1e-9, maxOf(wellErrs))).toFixed(0)} 倍`,
      '误差放大倍数 ≤ 条件数：解的相对误差 ≲ 条件数 × 数据的相对误差。这就是为什么病态问题用再好的算法也不准',
    ]);
    heading(f, '条件数：误差如何被放大');
  },
});

registerViz(
  gradientDescent,
  optimization,
  newtonMethod,
  bisectionMethod,
  secantMethod,
  fixedPointIteration,
  leastSquares,
  regression,
  numericalAnalysis,
  laplaceA49,
  laplacian,
  conditionNumberA51,
);
