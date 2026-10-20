import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, PALETTE, dot, footnotes, grid, heading, poly, rng, seg, text, view } from '../canvas';

/** 二维测试函数（凸）。 */
const convex2 = (x: number, y: number): number => x * x + 3 * y * y + 0.4 * x * y + x - 2 * y;

/** P46 凸优化入门。 */
const optimizationP46 = defineViz({
  slug: 'optimization-p46',
  title: '凸优化入门',
  params: {
    kind: { type: 'select', options: ['凸函数', '非凸函数'], default: '凸函数', label: '目标函数' },
    steps: { type: 'range', min: 1, max: 40, default: 18, label: '梯度下降步数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'kind', '凸函数');
    const steps = Math.round(num(params, 'steps', 18));
    const fn = kind.startsWith('凸') ? convex2 : (x: number, y: number): number => Math.sin(x * 1.4) * Math.cos(y * 1.2) * 2 + x * x * 0.3 + y * y * 0.3;
    const grad = (x: number, y: number): [number, number] => {
      const e = 1e-4;
      return [(fn(x + e, y) - fn(x - e, y)) / (2 * e), (fn(x, y + e) - fn(x, y - e)) / (2 * e)];
    };
    const v = view(f, { xMin: -3, xMax: 3, yMin: -3, yMax: 3, inset: 42 });
    // 等高线
    const steps2 = 90;
    for (let i = 0; i < steps2; i++) {
      for (let j = 0; j < steps2; j++) {
        const x = -3 + (6 * i) / steps2;
        const y = -3 + (6 * j) / steps2;
        const val = fn(x, y);
        const hue = kind.startsWith('凸') ? Math.max(-1, Math.min(1, val / 12)) : ((val + 3) % 2) / 2;
        f.ctx.save();
        f.ctx.fillStyle = `hsla(${230 - hue * 150}, 62%, ${22 + Math.abs(hue) * 26}%, 0.92)`;
        f.ctx.fillRect(v.sx(x), v.sy(y), (6 / steps2) * (v.sx(1) - v.sx(0)) + 1, (6 / steps2) * (v.sy(0) - v.sy(1)) + 1);
        f.ctx.restore();
      }
    }
    grid(f, v, { divisions: 5, ticks: false });

    const rand = rng(1234);
    let x = -2.4 + rand() * 0.4;
    let y = 2.2 + rand() * 0.4;
    const trail: Array<[number, number]> = [[x, y]];
    const lr = kind.startsWith('凸') ? 0.12 : 0.16;
    for (let i = 0; i < steps; i++) {
      const g2 = grad(x, y);
      x -= lr * g2[0];
      y -= lr * g2[1];
      x = Math.max(-3, Math.min(3, x));
      y = Math.max(-3, Math.min(3, y));
      trail.push([x, y]);
    }
    trail.forEach(([px, py], i) => {
      dot(f, v.sx(px), v.sy(py), 3.4, PALETTE[i % PALETTE.length]);
      if (i > 0) seg(f, v.sx(trail[i - 1][0]), v.sy(trail[i - 1][1]), v.sx(px), v.sy(py), `${PALETTE[(i - 1) % PALETTE.length]}aa`, 1.4);
    });

    footnotes(f, [
      `${kind}上从 (${trail[0][0].toFixed(2)}, ${trail[0][1].toFixed(2)}) 出发的梯度下降轨迹（${steps} 步）`,
      kind.startsWith('凸') ? '凸函数：任意局部最优即全局最优，梯度下降保证收敛到唯一极小点' : '非凸函数：存在多个局部极小，梯度下降的收敛结果依赖初始点（陷入局部最优）',
      '凸优化的价值：可判定、可高效求解（内点法多项式时间）、且大量实际问题可建模成凸问题',
    ]);
    heading(f, `凸优化：${kind}`);
  },
});

/** P47 KKT 条件深化。 */
const lagrangeMultiplierP47 = defineViz({
  slug: 'lagrange-multiplier-p47',
  title: 'KKT条件深化',
  params: {
    r: { type: 'range', min: 0.5, max: 2.5, default: 1.4, step: 0.1, label: '可行域半径' },
    cx: { type: 'range', min: -2, max: 0, default: -1.2, step: 0.1, label: '约束圆心 x' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const r = num(params, 'r', 1.4);
    const cx0 = num(params, 'cx', -1.2);
    // max x + 2y s.t. (x-cx0)² + y² ≤ r²
    const gradF: [number, number] = [1, 2];
    const norm = Math.hypot(gradF[0], gradF[1]);
    const best: [number, number] = [cx0 + (r * gradF[0]) / norm, (r * gradF[1]) / norm];
    const v = view(f, { xMin: -3.6, xMax: 2.4, yMin: -2.6, yMax: 2.6, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });
    // 可行域
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * Math.PI * 2;
      pts.push([v.sx(cx0 + r * Math.cos(t)), v.sy(r * Math.sin(t))]);
    }
    poly(f, pts, { fill: 'rgba(102,126,234,0.18)', stroke: C.accent, lw: 2.4, close: true });
    // 目标等值线
    for (let c = -4; c <= 4; c += 0.8) {
      const ld: Array<[number, number]> = [];
      for (let t = -2.6; t <= 2.6; t += 0.1) {
        ld.push([v.sx((c - 2 * t)), v.sy(t)]);
      }
      poly(f, ld, { stroke: 'rgba(160,174,192,0.3)', lw: 1 });
    }
    dot(f, v.sx(best[0]), v.sy(best[1]), 6, C.warm);
    seg(f, v.sx(best[0]), v.sy(best[1]), v.sx(best[0] + 0.8), v.sy(best[1] + 1.6), C.hot, 2.2);
    seg(f, v.sx(cx0), v.sy(0), v.sx(best[0]), v.sy(best[1]), `${C.cool}cc`, 1.8);

    const lambda = norm / r;
    footnotes(f, [
      `最大化 f = x + 2y 于圆盘 (x−${cx0})² + y² ≤ ${r}²：最优解 (${best[0].toFixed(3)}, ${best[1].toFixed(3)})`,
      `KKT 条件：∇f = λ∇g 且 λ ≥ 0、约束取等号（活跃约束），λ = ${lambda.toFixed(4)}`,
      'KKT 是不等式约束下最优性的必要条件；对凸问题它也是充分条件 —— 这是凸优化的理论基石',
    ]);
    heading(f, 'KKT 条件：约束优化的最优性');
  },
});

/** P48 内点法。 */
const interiorPoint = defineViz({
  slug: 'interior-point',
  title: '内点法',
  params: {
    mu: { type: 'range', min: 0.01, max: 1, default: 0.2, step: 0.01, label: '障碍参数 μ' },
    steps: { type: 'range', min: 1, max: 20, default: 8, label: '迭代步数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const mu0 = num(params, 'mu', 0.2);
    const steps = Math.round(num(params, 'steps', 8));
    // 问题：min x + y s.t. x ≥ 0, y ≥ 0, x + 2y ≤ 3（三角形可行域）
    const v = view(f, { xMin: -0.4, xMax: 3.6, yMin: -0.4, yMax: 2.2, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });
    poly(f, [[v.sx(0), v.sy(0)], [v.sx(3), v.sy(0)], [v.sx(0), v.sy(1.5)]], { fill: 'rgba(102,126,234,0.18)', stroke: C.accent, lw: 2.4, close: true });

    // 障碍法轨迹（沿中心路径走向顶点）
    const trail: Array<[number, number]> = [];
    let mu = mu0;
    for (let k = 0; k < steps; k++) {
      // 中心路径近似：x ≈ (3 - 2y)/(1 + ...) 用采样找 min x+y - μΣlog(约束)
      let bx = 0.4;
      let by = 0.3;
      const obj = (x: number, y: number): number => x + y - mu * (Math.log(Math.max(1e-9, x)) + Math.log(Math.max(1e-9, y)) + Math.log(Math.max(1e-9, 3 - x - 2 * y)));
      for (let it = 0; it < 300; it++) {
        const e = 1e-3;
        const gx = (obj(bx + e, by) - obj(bx - e, by)) / (2 * e);
        const gy = (obj(bx, by + e) - obj(bx, by - e)) / (2 * e);
        bx -= 0.02 * gx;
        by -= 0.02 * gy;
        bx = Math.max(1e-6, bx);
        by = Math.max(1e-6, by);
      }
      trail.push([bx, by]);
      mu *= 0.35;
    }
    // 中心路径
    poly(f, trail.map(([x, y]) => [v.sx(x), v.sy(y)] as [number, number]), { stroke: C.warm, lw: 2, dash: [6, 4] });
    trail.forEach(([x, y], i) => dot(f, v.sx(x), v.sy(y), 4, PALETTE[i % PALETTE.length]));
    dot(f, v.sx(3), v.sy(0), 6, C.hot);

    footnotes(f, [
      `内点法沿"中心路径"逼近最优解 (3, 0)：障碍参数从 ${mu0} 逐步缩小（${steps} 步）`,
      '对数障碍 −μΣlog(约束) 让迭代始终留在可行域内部（"内点"由此得名）',
      '与单纯形法沿边界走不同，内点法穿越内部、适合大规模问题；是线性/半定规划的主流算法',
    ]);
    heading(f, '内点法：沿中心路径逼近');
  },
});

/** P49 共轭梯度法。 */
const conjugateGradient = defineViz({
  slug: 'conjugate-gradient',
  title: '共轭梯度法',
  params: {
    cond: { type: 'range', min: 1, max: 30, default: 12, label: '条件数' },
    steps: { type: 'range', min: 1, max: 12, default: 6, label: '迭代步数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const cond = num(params, 'cond', 12);
    const steps = Math.round(num(params, 'steps', 6));
    // 二次型 f = ½(x²/κ + y²)
    const fn = (x: number, y: number): number => 0.5 * ((x * x) / cond + y * y);
    const grad = (x: number, y: number): [number, number] => [x / cond, y];
    const v = view(f, { xMin: -2.4, xMax: 2.4, yMin: -2.4, yMax: 2.4, inset: 42 });
    const steps2 = 70;
    for (let i = 0; i < steps2; i++) {
      for (let j = 0; j < steps2; j++) {
        const x = -2.4 + (4.8 * i) / steps2;
        const y = -2.4 + (4.8 * j) / steps2;
        const val = fn(x, y);
        f.ctx.save();
        f.ctx.fillStyle = `hsla(230, 60%, ${20 + Math.min(1, val) * 24}%, 0.9)`;
        f.ctx.fillRect(v.sx(x), v.sy(y), (4.8 / steps2) * (v.sx(1) - v.sx(0)) + 1, (4.8 / steps2) * (v.sy(0) - v.sy(1)) + 1);
        f.ctx.restore();
      }
    }
    grid(f, v, { divisions: 5, ticks: false });

    // 梯度下降 vs 共轭梯度
    const runGD = (): Array<[number, number]> => {
      let x = -2;
      let y = 1.9;
      const tr: Array<[number, number]> = [[x, y]];
      for (let i = 0; i < steps * 2; i++) {
        const g2 = grad(x, y);
        x -= 0.4 * g2[0];
        y -= 0.4 * g2[1];
        tr.push([x, y]);
      }
      return tr;
    };
    const runCG = (): Array<[number, number]> => {
      let x = -2;
      let y = 1.9;
      let gx = x / cond;
      let gy = y;
      let px = -gx;
      let py = -gy;
      const tr: Array<[number, number]> = [[x, y]];
      for (let i = 0; i < steps; i++) {
        const denom = (px * px) / cond + py * py;
        if (Math.abs(denom) < 1e-12) break;
        const alpha = -(-gx * px - gy * py) / denom;
        x += alpha * px;
        y += alpha * py;
        const ngx = x / cond;
        const ngy = y;
        const beta = ((ngx * ngx) / cond + ngy * ngy) / Math.max(1e-12, (gx * gx) / cond + gy * gy);
        px = -ngx + beta * px;
        py = -ngy + beta * py;
        gx = ngx;
        gy = ngy;
        tr.push([x, y]);
      }
      return tr;
    };
    runGD().forEach(([x, y], i, arr) => {
      dot(f, v.sx(x), v.sy(y), 2.6, `${C.hot}cc`);
      if (i > 0) seg(f, v.sx(arr[i - 1][0]), v.sy(arr[i - 1][1]), v.sx(x), v.sy(y), `${C.hot}88`, 1.2);
    });
    runCG().forEach(([x, y], i, arr) => {
      dot(f, v.sx(x), v.sy(y), 4, C.green);
      if (i > 0) seg(f, v.sx(arr[i - 1][0]), v.sy(arr[i - 1][1]), v.sx(x), v.sy(y), `${C.green}cc`, 2);
    });

    footnotes(f, [
      `条件数 ${cond} 的二次函数：梯度下降（红）之字形前进，共轭梯度（绿）沿共轭方向直达`,
      '共轭梯度在 n 维二次问题上至多 n 步收敛（无误差时为精确解），且只需矩阵-向量乘法',
      'CG 是求解大型稀疏线性系统（有限元、PDE 离散化）与大规模优化的主力算法',
    ]);
    heading(f, '共轭梯度 vs 梯度下降');
  },
});

/** P50 拟牛顿法。 */
const bfgs = defineViz({
  slug: 'bfgs',
  title: '拟牛顿法',
  params: {
    steps: { type: 'range', min: 1, max: 20, default: 8, label: '迭代步数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const steps = Math.round(num(params, 'steps', 8));
    const fn = (x: number, y: number): number => (x * x - 1) ** 2 + (y * y - 1) ** 2 + 0.4 * x * y;
    const grad = (x: number, y: number): [number, number] => [4 * x * (x * x - 1) + 0.4 * y, 4 * y * (y * y - 1) + 0.4 * x];
    const v = view(f, { xMin: -2.2, xMax: 2.2, yMin: -2.2, yMax: 2.2, inset: 42 });
    const steps2 = 70;
    for (let i = 0; i < steps2; i++) {
      for (let j = 0; j < steps2; j++) {
        const x = -2.2 + (4.4 * i) / steps2;
        const y = -2.2 + (4.4 * j) / steps2;
        const val = fn(x, y);
        f.ctx.save();
        f.ctx.fillStyle = `hsla(${230 - Math.min(1, val / 6) * 140}, 62%, ${20 + Math.min(1, val / 6) * 26}%, 0.92)`;
        f.ctx.fillRect(v.sx(x), v.sy(y), (4.4 / steps2) * (v.sx(1) - v.sx(0)) + 1, (4.4 / steps2) * (v.sy(0) - v.sy(1)) + 1);
        f.ctx.restore();
      }
    }
    grid(f, v, { divisions: 5, ticks: false });

    // BFGS（逆 Hessian 近似）
    let x = -1.8;
    let y = 1.7;
    let H: [[number, number], [number, number]] = [[1, 0], [0, 1]];
    const trail: Array<[number, number]> = [[x, y]];
    for (let i = 0; i < steps; i++) {
      const g = grad(x, y);
      const d: [number, number] = [-(H[0][0] * g[0] + H[0][1] * g[1]), -(H[1][0] * g[0] + H[1][1] * g[1])];
      // 线搜索（简单回溯）
      let alpha = 1;
      const f0 = fn(x, y);
      while (alpha > 1e-4 && fn(x + alpha * d[0], y + alpha * d[1]) > f0 - 1e-4 * alpha * (g[0] * d[0] + g[1] * d[1])) alpha *= 0.5;
      const nx = x + alpha * d[0];
      const ny = y + alpha * d[1];
      const ng = grad(nx, ny);
      const s: [number, number] = [nx - x, ny - y];
      const yv: [number, number] = [ng[0] - g[0], ng[1] - g[1]];
      const sy = s[0] * yv[0] + s[1] * yv[1];
      if (Math.abs(sy) > 1e-10) {
        const rho = 1 / sy;
        const I: [[number, number], [number, number]] = [[1 - rho * s[0] * yv[0], -rho * s[0] * yv[1]], [-rho * s[1] * yv[0], 1 - rho * s[1] * yv[1]]];
        const ys = [yv[0] * s[0] + yv[1] * s[1], 0];
        void ys;
        // H ← (I - ρ s yᵀ) H (I - ρ y sᵀ) + ρ s sᵀ
        const H1: [[number, number], [number, number]] = [[0, 0], [0, 0]];
        for (let r = 0; r < 2; r++) {
          for (let c = 0; c < 2; c++) {
            H1[r][c] = I[r][0] * (H[0][0] * I[c][0] + H[0][1] * I[c][1]) + I[r][1] * (H[1][0] * I[c][0] + H[1][1] * I[c][1]) + rho * s[r] * s[c];
          }
        }
        H = H1;
      }
      x = nx;
      y = ny;
      trail.push([x, y]);
    }
    trail.forEach(([px, py], i) => {
      dot(f, v.sx(px), v.sy(py), 4, PALETTE[i % PALETTE.length]);
      if (i > 0) seg(f, v.sx(trail[i - 1][0]), v.sy(trail[i - 1][1]), v.sx(px), v.sy(py), `${PALETTE[(i - 1) % PALETTE.length]}cc`, 1.8);
    });
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([mx, my]) => dot(f, v.sx(mx), v.sy(my), 5, C.warm));

    footnotes(f, [
      `BFGS 从 (${trail[0][0].toFixed(1)}, ${trail[0][1].toFixed(1)}) 出发，${steps} 步走到 (${x.toFixed(4)}, ${y.toFixed(4)})（橙点为 4 个局部极小）`,
      '拟牛顿法用梯度差分"估计" Hessian 的逆（不显式求导或求逆），因此每步只需 O(n²) 而不是 O(n³)',
      'BFGS 与 L-BFGS 是机器学习训练、结构优化中最常用的二阶方法（内存友好、超线性收敛）',
    ]);
    heading(f, '拟牛顿法（BFGS）');
  },
});

/** P51 模拟退火深化。 */
const simulatedAnnealingP51 = defineViz({
  slug: 'simulated-annealing-p51',
  title: '模拟退火深化',
  params: {
    t0: { type: 'range', min: 1, max: 10, default: 5, step: 0.5, label: '初始温度' },
    cooling: { type: 'range', min: 0.85, max: 0.995, default: 0.96, step: 0.005, label: '降温率' },
    steps: { type: 'range', min: 50, max: 800, default: 300, step: 50, label: '迭代步数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const t0 = num(params, 't0', 5);
    const cooling = num(params, 'cooling', 0.96);
    const steps = Math.round(num(params, 'steps', 300));
    const rand = rng(9876);
    // 多峰目标（Rastrigin 一维简化）
    const fn = (x: number): number => 10 + x * x - 10 * Math.cos(2 * Math.PI * x) * 1.2;
    let x = -2.4;
    let temp = t0;
    const best: number[] = [];
    let bestX = x;
    let bestVal = fn(x);
    const trail: Array<[number, number]> = [[x, fn(x)]];
    for (let i = 0; i < steps; i++) {
      const cand = Math.max(-2.9, Math.min(2.9, x + (rand() - 0.5) * 1.2));
      const delta = fn(cand) - fn(x);
      if (delta <= 0 || rand() < Math.exp(-delta / Math.max(1e-9, temp))) {
        x = cand;
        trail.push([x, fn(x)]);
        if (fn(x) < bestVal) {
          bestVal = fn(x);
          bestX = x;
        }
      }
      temp *= cooling;
      best.push(bestVal);
    }
    const v = view(f, { xMin: -3, xMax: 3, yMin: 0, yMax: Math.max(...trail.map(([, y]) => y)) * 1.15, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });
    poly(f, Array.from({ length: 200 }, (_, i) => {
      const xx = -3 + (6 * i) / 200;
      return [v.sx(xx), v.sy(fn(xx))] as [number, number];
    }), { stroke: `${C.dim}aa`, lw: 1.6 });
    trail.forEach(([px, py], i) => dot(f, v.sx(px), v.sy(py), 2.6, `${PALETTE[i % PALETTE.length]}cc`));
    dot(f, v.sx(bestX), v.sy(bestVal), 6, C.warm);

    footnotes(f, [
      `T₀ = ${t0}、降温率 ${cooling}：${steps} 步后最优解 x = ${bestX.toFixed(5)}，f = ${bestVal.toFixed(5)}`,
      `温度降到 ${(t0 * Math.pow(cooling, steps)).toExponential(2)}（末温越低接受劣解的概率越小）`,
      '退火的收敛保证来自马尔可夫链：温度按 T_k ∝ 1/log k 下降时以概率 1 收敛到全局最优（实际用几何降温）',
    ]);
    heading(f, '模拟退火：多峰目标的全局搜索');
  },
});

/** P52 粒子群深化。 */
const particleSwarmP52 = defineViz({
  slug: 'particle-swarm-p52',
  title: '粒子群深化',
  params: {
    particles: { type: 'range', min: 5, max: 60, default: 24, label: '粒子数' },
    iterations: { type: 'range', min: 5, max: 80, default: 35, label: '迭代次数' },
    topo: { type: 'select', options: ['全局最优（星形）', '局部最优（环形）'], default: '全局最优（星形）', label: '拓扑' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const count = Math.round(num(params, 'particles', 24));
    const iters = Math.round(num(params, 'iterations', 35));
    const topo = str(params, 'topo', '全局最优（星形）');
    const rand = rng(4321);
    // Rastrigin 二维
    const fit = (p: [number, number]): number => 20 + p[0] * p[0] + p[1] * p[1] - 10 * (Math.cos(2 * Math.PI * p[0]) + Math.cos(2 * Math.PI * p[1]));
    const pos: Array<[number, number]> = Array.from({ length: count }, () => [(rand() - 0.5) * 5, (rand() - 0.5) * 5] as [number, number]);
    const vel: Array<[number, number]> = Array.from({ length: count }, () => [(rand() - 0.5) * 0.3, (rand() - 0.5) * 0.3] as [number, number]);
    const pBest = pos.map((p) => [p[0], p[1]] as [number, number]);
    const pBestVal = pos.map((p) => fit(p));
    for (let it = 0; it < iters; it++) {
      let gBest: [number, number] = pBest[0];
      let gBestVal = pBestVal[0];
      pBestVal.forEach((val, i) => {
        if (val < gBestVal) {
          gBestVal = val;
          gBest = pBest[i];
        }
      });
      for (let i = 0; i < count; i++) {
        // 环形拓扑只用邻居中的最优
        let attractor = gBest;
        if (topo.startsWith('局部')) {
          const left = (i - 1 + count) % count;
          const right = (i + 1) % count;
          const cands = [i, left, right];
          let bestIdx = i;
          cands.forEach((ci) => {
            if (pBestVal[ci] < pBestVal[bestIdx]) bestIdx = ci;
          });
          attractor = pBest[bestIdx];
        }
        for (let d = 0; d < 2; d++) {
          vel[i][d] = 0.65 * vel[i][d] + 1.4 * rand() * (pBest[i][d] - pos[i][d]) + 1.4 * rand() * (attractor[d] - pos[i][d]);
          pos[i][d] += vel[i][d];
          pos[i][d] = Math.max(-2.8, Math.min(2.8, pos[i][d]));
        }
        const val = fit(pos[i]);
        if (val < pBestVal[i]) {
          pBestVal[i] = val;
          pBest[i] = [pos[i][0], pos[i][1]];
        }
      }
    }
    const v = view(f, { xMin: -3, xMax: 3, yMin: -3, yMax: 3, inset: 42 });
    const steps2 = 60;
    for (let i = 0; i < steps2; i++) {
      for (let j = 0; j < steps2; j++) {
        const x = -3 + (6 * i) / steps2;
        const y = -3 + (6 * j) / steps2;
        const val = fit([x, y]);
        f.ctx.save();
        f.ctx.fillStyle = `hsla(${230 - Math.min(1, val / 40) * 160}, 60%, ${20 + Math.min(1, val / 40) * 26}%, 0.9)`;
        f.ctx.fillRect(v.sx(x), v.sy(y), (6 / steps2) * (v.sx(1) - v.sx(0)) + 1, (6 / steps2) * (v.sy(0) - v.sy(1)) + 1);
        f.ctx.restore();
      }
    }
    pos.forEach((p) => dot(f, v.sx(p[0]), v.sy(p[1]), 3.6, C.warm));
    let finalBest: [number, number] = pBest[0];
    let finalVal = pBestVal[0];
    pBestVal.forEach((val, i) => {
      if (val < finalVal) {
        finalVal = val;
        finalBest = pBest[i];
      }
    });
    dot(f, v.sx(finalBest[0]), v.sy(finalBest[1]), 6, C.green);

    footnotes(f, [
      `${topo}拓扑、${count} 个粒子迭代 ${iters} 次：最优适应度 ${finalVal.toFixed(5)}（位置 ${finalBest[0].toFixed(3)}, ${finalBest[1].toFixed(3)}）`,
      topo.startsWith('全局') ? '星形拓扑信息传播快，收敛迅速但容易过早聚集到局部最优' : '环形拓扑信息传播慢，但多样性保持更好，更能找到全局最优',
      'PSO 由 Kennedy 与 Eberhart 于 1995 年提出，模拟鸟群觅食；参数少、易实现，广泛用于工程优化',
    ]);
    heading(f, '粒子群：拓扑对搜索的影响');
  },
});

/** P53 遗传算法深化。 */
const geneticAlgorithmP53 = defineViz({
  slug: 'genetic-algorithm-p53',
  title: '遗传算法深化',
  params: {
    population: { type: 'range', min: 8, max: 80, default: 30, step: 2, label: '种群规模' },
    mutation: { type: 'range', min: 0.01, max: 0.4, default: 0.08, step: 0.01, label: '变异率' },
    generations: { type: 'range', min: 5, max: 120, default: 50, step: 5, label: '代数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const popSize = Math.round(num(params, 'population', 30));
    const mutationRate = num(params, 'mutation', 0.08);
    const generations = Math.round(num(params, 'generations', 50));
    const rand = rng(1122);
    // 函数优化：最大化 sin(x)·x 的类问题（多峰）
    const fitness = (x: number): number => Math.sin(3 * x) * 2 + Math.cos(7 * x) + 2.5;
    let pop = Array.from({ length: popSize }, () => rand() * 6 - 3);
    const bestHist: number[] = [];
    const meanHist: number[] = [];
    for (let g = 0; g < generations; g++) {
      const fit = pop.map((x) => fitness(x));
      const maxFit = Math.max(...fit);
      bestHist.push(maxFit);
      meanHist.push(fit.reduce((a, b) => a + b, 0) / popSize);
      // 轮盘赌选择
      const total = fit.reduce((a, b) => a + Math.max(0, b), 0) || 1;
      const select = (): number => {
        let r = rand() * total;
        for (let i = 0; i < popSize; i++) {
          r -= Math.max(0, fit[i]);
          if (r <= 0) return pop[i];
        }
        return pop[popSize - 1];
      };
      const next: number[] = [];
      while (next.length < popSize) {
        const p1 = select();
        const p2 = select();
        // 算术交叉
        const alpha = rand();
        let child = alpha * p1 + (1 - alpha) * p2;
        if (rand() < mutationRate) child += (rand() - 0.5) * 1.2;
        next.push(Math.max(-3, Math.min(3, child)));
      }
      pop = next;
    }

    const v = view(f, { xMin: -3, xMax: 3, yMin: -1, yMax: 6, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });
    poly(f, Array.from({ length: 300 }, (_, i) => {
      const x = -3 + (6 * i) / 300;
      return [v.sx(x), v.sy(fitness(x))] as [number, number];
    }), { stroke: `${C.dim}aa`, lw: 1.6 });
    pop.forEach((x) => {
      dot(f, v.sx(x), v.sy(fitness(x)), 3.6, `${C.accent}cc`);
      dot(f, v.sx(x), v.sy(-0.6), 2.6, `${C.accent}55`);
    });
    const bestIdx = pop.reduce((bi, x, i, arr) => (fitness(x) > fitness(arr[bi]) ? i : bi), 0);
    dot(f, v.sx(pop[bestIdx]), v.sy(fitness(pop[bestIdx])), 6, C.warm);
    // 收敛曲线
    const gv = view(f, { xMin: 0, xMax: generations, yMin: 0, yMax: 6, inset: 42, insetRight: w * 0.5 });
    poly(f, bestHist.map((b, i) => [gv.sx(i), gv.sy(b)] as [number, number]), { stroke: C.green, lw: 2 });
    poly(f, meanHist.map((b, i) => [gv.sx(i), gv.sy(b)] as [number, number]), { stroke: `${C.cool}cc`, lw: 1.6 });

    footnotes(f, [
      `${popSize} 个个体、变异率 ${mutationRate}、${generations} 代：最优适应度 ${bestHist[bestHist.length - 1].toFixed(4)}（首代 ${bestHist[0].toFixed(4)}）`,
      '绿线为历代最优、蓝线为种群均值 —— 均值上升说明整个种群在进化，而不只是个别个体',
      '变异率过高会破坏已积累的好基因（趋于随机搜索），过低则容易早熟收敛（失去多样性）',
    ]);
    heading(f, '遗传算法：种群进化');
  },
});

registerViz(
  optimizationP46,
  lagrangeMultiplierP47,
  interiorPoint,
  conjugateGradient,
  bfgs,
  simulatedAnnealingP51,
  particleSwarmP52,
  geneticAlgorithmP53,
);
