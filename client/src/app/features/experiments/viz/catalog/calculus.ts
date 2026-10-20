import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import {
  C,
  PALETTE,
  curve,
  dot,
  footnotes,
  grid,
  heading,
  poly,
  polyView,
  seg,
  text,
  view,
} from '../canvas';

/** 常见函数库（供多个实验共用）。 */
const FUNCS: Record<string, { fn: (x: number) => number; label: string }> = {
  'x²': { fn: (x) => x * x, label: 'f(x) = x²' },
  'sin x': { fn: (x) => Math.sin(x), label: 'f(x) = sin x' },
  'x³/3': { fn: (x) => (x * x * x) / 3, label: 'f(x) = x³/3' },
  'e^x': { fn: (x) => Math.exp(x), label: 'f(x) = eˣ' },
};

/** 数值导数。 */
function deriv(fn: (x: number) => number, x: number, h = 1e-4): number {
  return (fn(x + h) - fn(x - h)) / (2 * h);
}

/** M19 微积分可视化。 */
const calculus = defineViz({
  slug: 'calculus',
  title: '微积分可视化',
  params: {
    which: { type: 'select', options: ['曲线与切线', '曲线下面积'], default: '曲线与切线', label: '主题' },
    x0: { type: 'range', min: -2.5, max: 2.5, default: 0.8, step: 0.1, label: '切点 x₀' },
    h: { type: 'range', min: 0.1, max: 1.5, default: 0.6, step: 0.05, label: '割线间距 h' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const which = str(params, 'which', '曲线与切线');
    const x0 = num(params, 'x0', 0.8);
    const hh = num(params, 'h', 0.6);
    const fn = (x: number): number => x * x;
    const v = view(f, { xMin: -3, xMax: 3, yMin: -1, yMax: 9, inset: 38 });
    grid(f, v, { divisions: 5, ticks: true });
    curve(f, v, fn, { color: C.accent, lw: 2.4 });

    if (which === '曲线与切线') {
      const y0 = fn(x0);
      const slope = deriv(fn, x0);
      curve(f, v, (x) => y0 + slope * (x - x0), { color: C.warm, lw: 1.8 });
      const secSlope = (fn(x0 + hh) - fn(x0)) / hh;
      curve(f, v, (x) => y0 + secSlope * (x - x0), { color: C.green, lw: 1.4, dash: [6, 4] });
      dot(f, v.sx(x0), v.sy(y0), 5, C.warm);
      dot(f, v.sx(x0 + hh), v.sy(fn(x0 + hh)), 4, C.green);
      footnotes(f, [
        `切点 (${x0.toFixed(2)}, ${y0.toFixed(2)})，切线斜率 f'(${x0.toFixed(2)}) = ${slope.toFixed(3)}`,
        `割线斜率 = [f(x₀+h) - f(x₀)]/h = ${secSlope.toFixed(3)}（h = ${hh.toFixed(2)}）`,
        '让 h → 0，割线就"贴"上曲线成为切线 —— 这就是导数的定义',
      ]);
    } else {
      const x2 = x0;
      const steps = 24;
      for (let i = 0; i < steps; i++) {
        const xa = 0 + (i / steps) * x2;
        const xb = 0 + ((i + 1) / steps) * x2;
        const ym = fn((xa + xb) / 2);
        poly(f, [
          [v.sx(xa), v.sy(0)], [v.sx(xb), v.sy(0)], [v.sx(xb), v.sy(ym)], [v.sx(xa), v.sy(ym)],
        ], { fill: 'rgba(102,126,234,0.35)', stroke: 'rgba(102,126,234,0.5)', lw: 0.6, close: true });
      }
      const approx = (Math.pow(x2, 3)) / 3;
      footnotes(f, [
        `把 [0, ${x2.toFixed(2)}] 上的面积切成 ${steps} 个小矩形求和 ⇒ ≈ ${approx.toFixed(4)}`,
        `精确值 ∫₀^x x²dx = x³/3 = ${approx.toFixed(4)}（与微元法一致）`,
        '面积 = 无数个无限窄矩形之和，积分与微分互为逆运算（微积分基本定理）',
      ]);
    }
    heading(f, which);
  },
});

/** M20 ε-δ 语言。 */
const epsilonDelta = defineViz({
  slug: 'epsilon-delta',
  title: 'ε-δ语言',
  params: {
    epsilon: { type: 'range', min: 0.1, max: 1.6, default: 0.6, step: 0.05, label: 'ε' },
    x0: { type: 'range', min: 0.5, max: 2.5, default: 1.5, step: 0.1, label: '趋近点 x₀' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const eps = num(params, 'epsilon', 0.6);
    const x0 = num(params, 'x0', 1.5);
    const fn = (x: number): number => x * x;
    const limit = fn(x0);
    // δ：使 |x - x0| < δ 时 |f(x) - L| < ε 的最大 δ
    const delta = Math.min(Math.sqrt(limit + eps) - x0, x0 - Math.sqrt(Math.max(0, limit - eps)));
    const v = view(f, { xMin: 0, xMax: 3, yMin: 0, yMax: 9, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });

    // ε 带与 δ 带
    polyView(f, v, [[0, limit - eps], [3, limit - eps], [3, limit + eps], [0, limit + eps]], { fill: 'rgba(72,187,120,0.16)', close: true });
    seg(f, v.sx(0), v.sy(limit), v.sx(3), v.sy(limit), C.green, 1.4);
    polyView(f, v, [[x0 - delta, 0], [x0 + delta, 0], [x0 + delta, 9], [x0 - delta, 9]], { fill: 'rgba(245,101,101,0.14)', close: true });
    curve(f, v, fn, { color: C.accent, lw: 2.4 });
    dot(f, v.sx(x0), v.sy(limit), 5.5, C.warm);

    footnotes(f, [
      `ε = ${eps}：只要 |x - ${x0.toFixed(1)}| < δ = ${delta.toFixed(4)}，就有 |f(x) - ${limit.toFixed(2)}| < ε`,
      '绿色横带是 ε 邻域（输出允许的误差），红色竖带是找到的 δ 邻域（输入需要多接近）',
      '极限的严格定义：对任意 ε > 0，存在 δ > 0 …… —— ε 是"挑战"，δ 是"应对"',
    ]);
    heading(f, 'ε-δ 语言：极限的严格定义');
  },
});

/** M21 中值定理。 */
const meanValueTheorem = defineViz({
  slug: 'mean-value-theorem',
  title: '中值定理',
  params: {
    a: { type: 'range', min: -2, max: 1, default: -1.6, step: 0.1, label: '区间左端 a' },
    b: { type: 'range', min: 0.5, max: 3, default: 2.2, step: 0.1, label: '区间右端 b' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', -1.6);
    const b = Math.max(a + 0.6, num(params, 'b', 2.2));
    const fn = (x: number): number => x * x * x - 3 * x + 2;
    const v = view(f, { xMin: -3, xMax: 3, yMin: -4, yMax: 8, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    curve(f, v, fn, { color: C.accent, lw: 2.4 });

    const slope = (fn(b) - fn(a)) / (b - a);
    seg(f, v.sx(a), v.sy(fn(a)), v.sx(b), v.sy(fn(b)), C.cool, 2);
    dot(f, v.sx(a), v.sy(fn(a)), 5, C.cool);
    dot(f, v.sx(b), v.sy(fn(b)), 5, C.cool);

    // 找 f'(c) = slope
    let c = a;
    for (let x = a; x <= b; x += 0.005) {
      if (Math.abs(deriv(fn, x) - slope) < 0.02) {
        c = x;
        break;
      }
    }
    const yc = fn(c);
    curve(f, v, (x) => yc + slope * (x - c), { color: C.warm, lw: 2 });
    dot(f, v.sx(c), v.sy(yc), 5.5, C.warm);

    footnotes(f, [
      `区间 [${a.toFixed(1)}, ${b.toFixed(1)}] 上的平均变化率 = ${slope.toFixed(4)}`,
      `存在 c ≈ ${c.toFixed(3)} 使 f'(c) = ${deriv(fn, c).toFixed(4)} = 平均变化率`,
      '拉格朗日中值定理：连续且可导的函数，必有一点的瞬时变化率等于整体平均变化率',
    ]);
    heading(f, '中值定理：切线平行于割线');
  },
});

/** M22 黎曼和。 */
const riemannSum = defineViz({
  slug: 'riemann-sum',
  title: '黎曼和',
  params: {
    n: { type: 'range', min: 2, max: 60, default: 10, label: '分割数 n' },
    sample: { type: 'select', options: ['左端点', '中点', '右端点'], default: '中点', label: '取样方式' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'n', 10));
    const sample = str(params, 'sample', '中点');
    const fn = (x: number): number => Math.sin(x) + 1.2;
    const a = 0;
    const b = Math.PI * 2;
    const v = view(f, { xMin: -0.2, xMax: b + 0.2, yMin: -0.4, yMax: 2.6, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });

    let sum = 0;
    const dx = (b - a) / n;
    for (let i = 0; i < n; i++) {
      const xa = a + i * dx;
      const xs = sample === '左端点' ? xa : sample === '右端点' ? xa + dx : xa + dx / 2;
      const height = fn(xs);
      sum += height * dx;
      polyView(f, v, [[xa, 0], [xa + dx, 0], [xa + dx, height], [xa, height]], {
        fill: 'rgba(102,126,234,0.35)',
        stroke: 'rgba(102,126,234,0.6)',
        lw: 0.8,
        close: true,
      });
    }
    curve(f, v, fn, { color: C.warm, lw: 2.2 });

    const trueValue = 2 * Math.PI * 1.2; // ∫₀^{2π}(sin x + 1.2)dx = 2π·1.2
    footnotes(f, [
      `n = ${n}（${sample}）：黎曼和 = ${sum.toFixed(5)}`,
      `精确值 ∫₀^{2π}(sin x + 1.2)dx = ${trueValue.toFixed(5)}，误差 ${Math.abs(sum - trueValue).toExponential(2)}`,
      `n → ∞ 时误差 → 0（对可积函数），这就是定积分的定义`,
    ]);
    heading(f, '黎曼和：用矩形逼近面积');
  },
});

/** M23 反常积分。 */
const improperIntegral = defineViz({
  slug: 'improper-integral',
  title: '反常积分',
  params: {
    p: { type: 'range', min: 0.4, max: 3, default: 1.5, step: 0.1, label: '幂次 p' },
    upper: { type: 'range', min: 2, max: 60, default: 30, label: '积分上限' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const p = num(params, 'p', 1.5);
    const upper = num(params, 'upper', 30);
    const fn = (x: number): number => Math.pow(x, -p);
    const v = view(f, { xMin: 0, xMax: upper, yMin: -0.05, yMax: 2.2, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    curve(f, v, fn, { color: C.accent, lw: 2.2 });

    // 阴影：从 1 到 upper 的面积
    const shade: Array<[number, number]> = [];
    for (let i = 0; i <= 300; i++) {
      const x = 1 + (i / 300) * (upper - 1);
      shade.push([v.sx(x), v.sy(fn(x))]);
    }
    shade.push([v.sx(upper), v.sy(0)], [v.sx(1), v.sy(0)]);
    poly(f, shade, { fill: 'rgba(102,126,234,0.25)', close: true });

    const partial = p === 1 ? Math.log(upper) : (1 - Math.pow(upper, 1 - p)) / (p - 1);
    const limit = p > 1 ? 1 / (p - 1) : Infinity;
    footnotes(f, [
      `∫₁^${upper} x^(-${p}) dx = ${partial.toFixed(5)}`,
      p > 1 ? `p = ${p} > 1：积分收敛，极限值 = 1/(p-1) = ${limit.toFixed(5)}` : p === 1 ? 'p = 1：积分发散（对数增长到无穷）' : `p = ${p} < 1：积分发散（虽然函数趋于 0，但衰减太慢）`,
      'p-积分是最基本的收敛性判据：函数值趋于 0 并不保证积分收敛',
    ]);
    heading(f, '反常积分：无穷区间上的收敛性');
  },
});

/** M24 弧长与曲率。 */
const arcLengthCurvature = defineViz({
  slug: 'arc-length-curvature',
  title: '弧长与曲率',
  params: {
    x0: { type: 'range', min: -2, max: 2, default: 0.8, step: 0.1, label: '考察点 x₀' },
    kind: { type: 'select', options: ['抛物线', '正弦'], default: '抛物线', label: '曲线' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const x0 = num(params, 'x0', 0.8);
    const kind = str(params, 'kind', '抛物线');
    const fn = (x: number): number => (kind === '正弦' ? Math.sin(x) * 1.6 : x * x * 0.6);
    const v = view(f, { xMin: -3.2, xMax: 3.2, yMin: -2, yMax: 6, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    curve(f, v, fn, { color: C.accent, lw: 2.4 });

    const y0 = fn(x0);
    const d1 = deriv(fn, x0);
    const d2 = (deriv(fn, x0 + 1e-3) - deriv(fn, x0 - 1e-3)) / 2e-3;
    const curvature = Math.abs(d2) / Math.pow(1 + d1 * d1, 1.5);
    const radius = curvature > 1e-9 ? 1 / curvature : Infinity;

    // 曲率圆（法线方向）
    const nx = -d1 / Math.sqrt(1 + d1 * d1);
    const ny = 1 / Math.sqrt(1 + d1 * d1);
    const sign = d2 >= 0 ? 1 : -1;
    const cx = x0 + sign * nx * radius;
    const cy = y0 + sign * ny * radius;

    // 弧长积分
    let arc = 0;
    const from = -3;
    const steps = 600;
    const dx = (x0 - from) / steps;
    for (let i = 0; i < steps; i++) {
      const xa = from + i * dx;
      arc += Math.sqrt(1 + deriv(fn, xa) ** 2) * dx;
    }

    if (Number.isFinite(radius) && radius < 40) {
      const circlePts: Array<[number, number]> = [];
      for (let i = 0; i <= 120; i++) {
        const t = (i / 120) * Math.PI * 2;
        circlePts.push([v.sx(cx + radius * Math.cos(t)), v.sy(cy + radius * Math.sin(t))]);
      }
      poly(f, circlePts, { stroke: C.warm, lw: 1.6, dash: [5, 4] });
      seg(f, v.sx(x0), v.sy(y0), v.sx(cx), v.sy(cy), C.cool, 1.4);
    }
    dot(f, v.sx(x0), v.sy(y0), 5, C.warm);

    footnotes(f, [
      `在 x₀ = ${x0.toFixed(1)} 处：斜率 f' = ${d1.toFixed(3)}，曲率 κ = ${curvature.toFixed(4)}`,
      `曲率半径 = 1/κ = ${Number.isFinite(radius) ? radius.toFixed(4) : '∞'}（橙色虚线圆为密切圆）`,
      `从 x = -3 到 x₀ 的弧长 ≈ ${arc.toFixed(4)}（用 √(1+ f'²)dx 积分）`,
    ]);
    heading(f, '弧长与曲率');
  },
});

/** M25 级数收敛性。 */
const seriesConvergence = defineViz({
  slug: 'series-convergence',
  title: '级数收敛性',
  params: {
    series: { type: 'select', options: ['p 级数 Σ1/n^p', '几何级数 Σr^n', '交错调和级数'], default: 'p 级数 Σ1/n^p', label: '级数' },
    param: { type: 'range', min: 0.2, max: 2, default: 1, step: 0.1, label: '参数' },
    n: { type: 'range', min: 10, max: 300, default: 120, step: 10, label: '项数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'series', 'p 级数 Σ1/n^p');
    const prm = num(params, 'param', 1);
    const n = Math.round(num(params, 'n', 120));
    const v = view(f, { xMin: 0, xMax: n, yMin: -0.5, yMax: 6, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });

    const term = (k: number): number => {
      if (kind.startsWith('几何级数')) return Math.pow(prm * 0.6, k);
      if (kind.startsWith('交错')) return (k % 2 === 1 ? 1 : -1) / k;
      return Math.pow(k, -prm);
    };
    let sum = 0;
    const pts: Array<[number, number]> = [];
    const start = kind.startsWith('几何级数') ? 0 : 1;
    for (let k = start; k <= n; k++) {
      sum += term(k);
      pts.push([v.sx(k), v.sy(sum)]);
    }
    // 理论极限
    let limit: number | null = null;
    if (kind.startsWith('几何级数')) limit = 1 / (1 - prm * 0.6);
    else if (kind.startsWith('交错')) limit = Math.log(2);
    else if (prm > 1) limit = null;
    if (limit !== null && Number.isFinite(limit) && limit < 6) {
      seg(f, v.sx(0), v.sy(limit), v.sx(n), v.sy(limit), C.green, 1.6);
      text(f, `极限 ≈ ${limit.toFixed(4)}`, v.sx(n) - 8, v.sy(limit) - 8, { color: C.green, align: 'right', font: '12px sans-serif' });
    }
    poly(f, pts, { stroke: C.accent, lw: 2 });

    footnotes(f, [
      `部分和 S_${n} = ${sum.toFixed(5)}`,
      pSeriesNote(kind, prm, sum, limit),
      '级数收敛 = 部分和序列有极限；判别法（比较、比值、根值、积分）用于判断是否收敛',
    ]);
    heading(f, `级数收敛性：${kind}`);
  },
});

/** 级数说明文字。 */
function pSeriesNote(kind: string, prm: number, sum: number, limit: number | null): string {
  if (kind.startsWith('p 级数')) {
    return prm > 1 ? `p = ${prm} > 1：收敛（理论值 ζ(${prm.toFixed(1)}) 附近 ${sum.toFixed(4)}）` : `p = ${prm} ≤ 1：发散（部分和随 n 无界增长）`;
  }
  if (kind.startsWith('几何级数')) {
    return prm * 0.6 < 1 ? `|r| = ${(prm * 0.6).toFixed(2)} < 1：收敛到 1/(1-r)` : `|r| ≥ 1：发散`;
  }
  return limit !== null ? '交错调和级数收敛（莱布尼茨判别法），但条件收敛' : '';
}

/** M26 幂级数。 */
const powerSeries = defineViz({
  slug: 'power-series',
  title: '幂级数',
  params: {
    center: { type: 'range', min: -2, max: 2, default: 0, step: 0.5, label: '展开中心 a' },
    radius: { type: 'range', min: 0.5, max: 4, default: 2, step: 0.5, label: '收敛半径 R' },
    terms: { type: 'range', min: 1, max: 20, default: 8, label: '项数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const center = num(params, 'center', 0);
    const radius = num(params, 'radius', 2);
    const termsN = Math.round(num(params, 'terms', 8));
    const fn = (x: number): number => 1 / (1 - (x - center) * 0.5);
    const v = view(f, { xMin: center - 6, xMax: center + 6, yMin: -4, yMax: 8, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });

    // 收敛区间
    polyView(f, v, [[center - radius, -4], [center + radius, -4], [center + radius, 8], [center - radius, 8]], {
      fill: 'rgba(72,187,120,0.1)',
      close: true,
    });
    seg(f, v.sx(center - radius), v.sy(-4), v.sx(center - radius), v.sy(8), C.green, 1.4);
    seg(f, v.sx(center + radius), v.sy(-4), v.sx(center + radius), v.sy(8), C.green, 1.4);
    curve(f, v, fn, { color: C.dim, lw: 1.6, dash: [5, 4] });
    curve(f, v, (x) => {
      let sum = 0;
      for (let k = 0; k < termsN; k++) sum += Math.pow((x - center) * 0.5, k);
      return sum;
    }, { color: C.accent, lw: 2.4 });

    footnotes(f, [
      `幂级数 Σ cₖ(x-a)ᵏ 在 |x - a| < R 内收敛（绿色区间），R = ${radius}`,
      `蓝色是取前 ${termsN} 项的部分和，灰色虚线是真实函数（此处为 1/(1-x/2)）`,
      '收敛半径由系数决定：R = 1/limsup|cₖ|^(1/k)（柯西-阿达马公式）',
    ]);
    heading(f, '幂级数与收敛半径');
  },
});

/** M27 泰勒展开。 */
const taylor = defineViz({
  slug: 'taylor',
  title: '泰勒展开',
  params: {
    func: { type: 'select', options: ['sin x', 'e^x', 'cos x', 'ln(1+x)'], default: 'sin x', label: '函数' },
    order: { type: 'range', min: 1, max: 12, default: 5, label: '阶数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const func = str(params, 'func', 'sin x');
    const order = Math.round(num(params, 'order', 5));
    const v = view(f, { xMin: -6, xMax: 6, yMin: -3.4, yMax: 3.4, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });

    const fn = func === 'e^x' ? (x: number): number => Math.exp(x)
      : func === 'cos x' ? (x: number): number => Math.cos(x)
        : func === 'ln(1+x)' ? (x: number): number => Math.log(1 + x)
          : (x: number): number => Math.sin(x);

    // 在 x = 0 处的泰勒系数（解析给出，避免数值差分的精度损失）
    const factorial = (k: number): number => (k <= 1 ? 1 : k * factorial(k - 1));
    const coeffAt = (k: number): number => {
      if (func === 'sin x') return k % 2 === 1 ? Math.pow(-1, (k - 1) / 2) / factorial(k) : 0;
      if (func === 'cos x') return k % 2 === 0 ? Math.pow(-1, k / 2) / factorial(k) : 0;
      if (func === 'e^x') return 1 / factorial(k);
      return k === 0 ? 0 : Math.pow(-1, k - 1) / k;
    };
    const polyTaylor = (x: number): number => {
      let sum = 0;
      for (let k = 0; k <= order; k++) sum += coeffAt(k) * Math.pow(x, k);
      return sum;
    };

    curve(f, v, fn, { color: C.dim, lw: 1.6, dash: [5, 4] });
    curve(f, v, polyTaylor, { color: C.accent, lw: 2.6 });
    dot(f, v.sx(0), v.sy(fn(0)), 5, C.warm);

    footnotes(f, [
      `${func} 在 x = 0 处的 ${order} 阶泰勒多项式（蓝线）对比原函数（灰虚线）`,
      '阶数越高，逼近区间越宽；在展开点附近误差为 o(x^n)',
      '泰勒展开把"难算的函数"换成多项式，是数值计算、物理近似、极限计算的通用工具',
    ]);
    heading(f, '泰勒展开：用多项式逼近函数');
  },
});

/** 组合数。 */
function binomial(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/** M28 数值积分。 */
const numericalIntegration = defineViz({
  slug: 'numerical-integration',
  title: '数值积分',
  params: {
    method: { type: 'select', options: ['梯形法', '辛普森法', '中点法'], default: '梯形法', label: '方法' },
    n: { type: 'range', min: 2, max: 40, default: 8, label: '子区间数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const method = str(params, 'method', '梯形法');
    const n = Math.round(num(params, 'n', 8));
    const fn = (x: number): number => Math.sin(x * 1.4) + 1.6;
    const a = 0;
    const b = 4;
    const v = view(f, { xMin: -0.2, xMax: b + 0.2, yMin: -0.2, yMax: 3.2, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    const dx = (b - a) / n;
    let approx = 0;
    for (let i = 0; i < n; i++) {
      const xa = a + i * dx;
      const xb = xa + dx;
      const ya = fn(xa);
      const yb = fn(xb);
      if (method === '中点法') {
        const ym = fn((xa + xb) / 2);
        approx += ym * dx;
        polyView(f, v, [[xa, 0], [xb, 0], [xb, ym], [xa, ym]], { fill: 'rgba(102,126,234,0.35)', stroke: 'rgba(102,126,234,0.55)', lw: 0.8, close: true });
      } else if (method === '辛普森法') {
        const ym = fn((xa + xb) / 2);
        approx += ((ya + 4 * ym + yb) / 6) * dx;
        const pts: Array<[number, number]> = [];
        for (let k = 0; k <= 20; k++) {
          const x = xa + (dx * k) / 20;
          pts.push([v.sx(x), v.sy(fn(x))]);
        }
        pts.push([v.sx(xb), v.sy(0)], [v.sx(xa), v.sy(0)]);
        poly(f, pts, { fill: 'rgba(102,126,234,0.35)', close: true });
      } else {
        approx += ((ya + yb) / 2) * dx;
        polyView(f, v, [[xa, 0], [xb, 0], [xb, yb], [xa, ya]], { fill: 'rgba(102,126,234,0.35)', stroke: 'rgba(102,126,234,0.55)', lw: 0.8, close: true });
      }
    }
    curve(f, v, fn, { color: C.warm, lw: 2.2 });
    const exact = (1 - Math.cos(4 * 1.4)) / 1.4 + 1.6 * 4;
    footnotes(f, [
      `${method}（n = ${n}）得到 ≈ ${approx.toFixed(6)}`,
      `精确值 = ${exact.toFixed(6)}，误差 ${Math.abs(approx - exact).toExponential(2)}`,
      method === '辛普森法' ? '辛普森法用抛物线拟合每段，误差 O(h⁴)，远优于梯形法 O(h²)' : '梯形法用直线段连接端点；加密分割可提高精度但收敛较慢',
    ]);
    heading(f, `数值积分：${method}`);
  },
});

/** M29 插值方法。 */
const interpolation = defineViz({
  slug: 'interpolation',
  title: '插值方法',
  params: {
    points: { type: 'range', min: 3, max: 10, default: 6, label: '节点数' },
    method: { type: 'select', options: ['拉格朗日', '线性'], default: '拉格朗日', label: '方法' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const count = Math.round(num(params, 'points', 6));
    const method = str(params, 'method', '拉格朗日');
    const nodes: Array<[number, number]> = [];
    for (let i = 0; i < count; i++) {
      const x = -3 + (6 * i) / (count - 1);
      nodes.push([x, Math.sin(x * 0.9) * 1.8 + Math.cos(x * 2.1) * 0.4]);
    }
    const v = view(f, { xMin: -3.4, xMax: 3.4, yMin: -3, yMax: 3, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });

    // 真实函数（示意）
    curve(f, v, (x) => Math.sin(x * 0.9) * 1.8 + Math.cos(x * 2.1) * 0.4, { color: C.dim, lw: 1.4, dash: [5, 4] });

    if (method === '线性') {
      for (let i = 0; i + 1 < count; i++) {
        seg(f, v.sx(nodes[i][0]), v.sy(nodes[i][1]), v.sx(nodes[i + 1][0]), v.sy(nodes[i + 1][1]), C.accent, 2);
      }
    } else {
      const lagrange = (x: number): number => {
        let sum = 0;
        for (let i = 0; i < count; i++) {
          let term = nodes[i][1];
          for (let j = 0; j < count; j++) {
            if (i !== j) term *= (x - nodes[j][0]) / (nodes[i][0] - nodes[j][0]);
          }
          sum += term;
        }
        return sum;
      };
      curve(f, v, lagrange, { color: C.accent, lw: 2.2 });
    }
    nodes.forEach(([x, y]) => dot(f, v.sx(x), v.sy(y), 4.5, C.warm));

    footnotes(f, [
      `${count} 个节点上的${method}插值（橙色为节点）`,
      method === '拉格朗日' ? '拉格朗日插值：n 个点唯一确定一个 n-1 次多项式，处处经过节点' : '线性插值：相邻节点用直线相连，简单但不可导',
      '节点增多时拉格朗日插值可能出现剧烈振荡（龙格现象），实际常用样条或切比雪夫节点',
    ]);
    heading(f, `插值方法：${method}`);
  },
});

/** M30 B 样条。 */
const bSpline = defineViz({
  slug: 'b-spline',
  title: 'B样条',
  params: {
    degree: { type: 'range', min: 1, max: 4, default: 3, label: '次数 p' },
    t: { type: 'range', min: 0, max: 1, default: 0.45, step: 0.01, label: '参数 t' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const degree = Math.round(num(params, 'degree', 3));
    const t = num(params, 't', 0.45);
    const ctrl: Array<[number, number]> = [[-3, -1.4], [-1.6, 2], [0.4, -1.8], [2, 1.6], [3.2, -0.6]];
    const v = view(f, { xMin: -3.8, xMax: 3.8, yMin: -2.6, yMax: 2.8, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });

    // 均匀节点向量
    const ctrlCount = ctrl.length;
    const knots: number[] = [];
    for (let i = 0; i < ctrlCount + degree + 1; i++) {
      knots.push(i <= degree ? 0 : i >= ctrlCount ? 1 : (i - degree) / (ctrlCount - degree));
    }
    // Cox-de Boor 递归基函数
    const basis = (i: number, p: number, u: number): number => {
      if (p === 0) return knots[i] <= u && u < knots[i + 1] ? 1 : 0;
      let sum = 0;
      const d1 = knots[i + p] - knots[i];
      const d2 = knots[i + p + 1] - knots[i + 1];
      if (d1 > 0) sum += ((u - knots[i]) / d1) * basis(i, p - 1, u);
      if (d2 > 0) sum += ((knots[i + p + 1] - u) / d2) * basis(i + 1, p - 1, u);
      return sum;
    };
    const curvePoint = (u: number): [number, number] => {
      let x = 0;
      let y = 0;
      for (let i = 0; i < ctrlCount; i++) {
        const b = basis(i, degree, u);
        x += b * ctrl[i][0];
        y += b * ctrl[i][1];
      }
      return [x, y];
    };

    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 300; i++) {
      const u = Math.min(0.9999, i / 300);
      const [x, y] = curvePoint(u);
      pts.push([v.sx(x), v.sy(y)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.6 });
    poly(f, ctrl.map(([x, y]) => [v.sx(x), v.sy(y)] as [number, number]), { stroke: 'rgba(160,174,192,0.6)', lw: 1.2, dash: [6, 4] });
    ctrl.forEach(([x, y]) => dot(f, v.sx(x), v.sy(y), 4, C.warm));
    const [tx, ty] = curvePoint(Math.min(0.9999, Math.max(0.0001, t)));
    dot(f, v.sx(tx), v.sy(ty), 5.5, C.green);

    footnotes(f, [
      `${ctrl.length} 个控制点的 ${degree} 次 B 样条（蓝）与折线控制多边形（灰虚线）`,
      `参数 t = ${t.toFixed(2)} 处对应曲线上的绿点；曲线被控制在凸包内且局部性良好`,
      'B 样条是 CAD/CAM 的标准曲线表示：局部修改控制点只影响局部形状（贝塞尔曲线则整体受影响）',
    ]);
    heading(f, 'B 样条：分段多项式曲线');
  },
});

/** M31 Catmull-Rom 样条。 */
const catmullRom = defineViz({
  slug: 'catmull-rom',
  title: 'Catmull-Rom样条',
  params: {
    tension: { type: 'range', min: 0.1, max: 1.5, default: 0.5, step: 0.1, label: '张力' },
    points: { type: 'range', min: 4, max: 9, default: 6, label: '控制点数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const tension = num(params, 'tension', 0.5);
    const count = Math.round(num(params, 'points', 6));
    const ctrl: Array<[number, number]> = [];
    for (let i = 0; i < count; i++) {
      const x = -3.2 + (6.4 * i) / (count - 1);
      ctrl.push([x, Math.sin(i * 1.7) * 1.9]);
    }
    const v = view(f, { xMin: -3.8, xMax: 3.8, yMin: -2.8, yMax: 2.8, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });

    const pts: Array<[number, number]> = [];
    for (let i = 0; i + 3 < ctrl.length; i++) {
      const [p0, p1, p2, p3] = [ctrl[i], ctrl[i + 1], ctrl[i + 2], ctrl[i + 3]];
      for (let k = 0; k <= 40; k++) {
        const t = k / 40;
        const t2 = t * t;
        const t3 = t2 * t;
        const m1x = tension * (p2[0] - p0[0]);
        const m1y = tension * (p2[1] - p0[1]);
        const m2x = tension * (p3[0] - p1[0]);
        const m2y = tension * (p3[1] - p1[1]);
        const x = (2 * t3 - 3 * t2 + 1) * p1[0] + (t3 - 2 * t2 + t) * m1x + (-2 * t3 + 3 * t2) * p2[0] + (t3 - t2) * m2x;
        const y = (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1y + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2y;
        pts.push([v.sx(x), v.sy(y)]);
      }
    }
    poly(f, pts, { stroke: C.accent, lw: 2.4 });
    poly(f, ctrl.map(([x, y]) => [v.sx(x), v.sy(y)] as [number, number]), { stroke: 'rgba(160,174,192,0.5)', lw: 1.2, dash: [6, 4] });
    ctrl.forEach(([x, y]) => dot(f, v.sx(x), v.sy(y), 4.5, C.warm));

    footnotes(f, [
      `张力 ${tension} 的 Catmull-Rom 样条（经过所有控制点）`,
      '与 B 样条不同，Catmull-Rom 是插值样条：曲线严格通过每个控制点',
      '切线由相邻点自动确定（P₂ - P₀），因此只需要点坐标即可，被广泛用于相机路径与动画补间',
    ]);
    heading(f, 'Catmull-Rom 样条');
  },
});

/** M32 离散余弦变换。 */
const discreteCosineTransform = defineViz({
  slug: 'discrete-cosine-transform',
  title: '离散余弦变换',
  params: {
    keep: { type: 'range', min: 1, max: 16, default: 5, label: '保留系数数' },
    signal: { type: 'select', options: ['方波', '锯齿', '随机'], default: '方波', label: '输入信号' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const keep = Math.round(num(params, 'keep', 5));
    const signal = str(params, 'signal', '方波');
    const N = 32;
    const x: number[] = [];
    for (let i = 0; i < N; i++) {
      if (signal === '锯齿') x.push((i / N) * 2 - 1);
      else if (signal === '随机') x.push(Math.sin(i * 12.9898) * 0.8 + Math.sin(i * 78.233) * 0.3);
      else x.push(i < N / 2 ? 0.8 : -0.8);
    }
    // DCT-II
    const coeff: number[] = [];
    for (let k = 0; k < N; k++) {
      let sum = 0;
      for (let n = 0; n < N; n++) sum += x[n] * Math.cos((Math.PI * k * (2 * n + 1)) / (2 * N));
      coeff.push((k === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N)) * sum);
    }
    // 只用前 keep 个系数重建
    const recon: number[] = [];
    for (let n = 0; n < N; n++) {
      let sum = 0;
      for (let k = 0; k < keep; k++) {
        sum += (k === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N)) * coeff[k] * Math.cos((Math.PI * k * (2 * n + 1)) / (2 * N));
      }
      recon.push(sum);
    }
    const energy = coeff.slice(0, keep).reduce((a, b) => a + b * b, 0) / coeff.reduce((a, b) => a + b * b, 0);

    const top = 62;
    const plotH = (h - 190) / 2;
    const colW = (w - 80) / N;
    x.forEach((value, i) => {
      const px = 40 + i * colW;
      const bh = Math.abs(value) * plotH * 0.9;
      f.ctx.save();
      f.ctx.fillStyle = C.dim;
      f.ctx.fillRect(px, top + (value >= 0 ? plotH - bh : plotH), colW - 1, bh);
      f.ctx.restore();
    });
    text(f, '原始信号', 40, top - 6, { color: C.dim, font: '12px sans-serif' });
    recon.forEach((value, i) => {
      const px = 40 + i * colW;
      const bh = Math.abs(value) * plotH * 0.9;
      f.ctx.save();
      f.ctx.fillStyle = C.accent;
      f.ctx.fillRect(px, top + plotH + 40 + (value >= 0 ? plotH - bh : plotH), colW - 1, bh);
      f.ctx.restore();
    });
    text(f, `用前 ${keep} 个 DCT 系数重建`, 40, top + plotH + 34, { color: C.accent, font: '12px sans-serif' });

    const maxCoeff = Math.max(...coeff.map(Math.abs));
    coeff.slice(0, 16).forEach((c, i) => {
      const px = 40 + i * ((w - 80) / 16);
      const bh = (Math.abs(c) / maxCoeff) * 44;
      f.ctx.save();
      f.ctx.fillStyle = i < keep ? C.green : 'rgba(160,174,192,0.5)';
      f.ctx.fillRect(px, h - 62 - bh, (w - 80) / 16 - 3, bh);
      f.ctx.restore();
    });
    text(f, 'DCT 系数（绿 = 保留）', 40, h - 74, { color: C.green, font: '12px sans-serif' });

    footnotes(f, [
      `保留 ${keep} 个系数即可捕获 ${(energy * 100).toFixed(2)}% 的能量`,
      'DCT 把信号分解成不同频率的余弦波 —— 低频集中在前面几个系数里',
      'JPEG 正是这样压缩的：丢弃高频小系数只保留少量系数，肉眼几乎看不出差别',
    ]);
    heading(f, '离散余弦变换：压缩的数学基础');
  },
});

/** M33 切比雪夫多项式。 */
const chebyshevPolynomials = defineViz({
  slug: 'chebyshev-polynomials',
  title: '切比雪夫多项式',
  params: {
    order: { type: 'range', min: 1, max: 10, default: 5, label: '阶数 n' },
    showAll: { type: 'select', options: ['仅 n 阶', '显示前几阶'], default: '仅 n 阶', label: '显示' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const order = Math.round(num(params, 'order', 5));
    const showAll = str(params, 'showAll', '仅 n 阶') === '显示前几阶';
    const v = view(f, { xMin: -1.1, xMax: 1.1, yMin: -1.2, yMax: 1.2, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });

    const cheb = (n: number): ((x: number) => number) => {
      if (n === 0) return () => 1;
      if (n === 1) return (x) => x;
      let prev = (x: number): number => 1;
      let cur = (x: number): number => x;
      for (let k = 2; k <= n; k++) {
        const p = prev;
        const c = cur;
        prev = c;
        cur = (x) => 2 * x * c(x) - p(x);
      }
      return cur;
    };

    if (showAll) {
      for (let n = 1; n <= order; n++) {
        curve(f, v, cheb(n), { color: PALETTE[(n - 1) % PALETTE.length], lw: 1.6 });
      }
    } else {
      curve(f, v, cheb(order), { color: C.accent, lw: 2.6 });
    }
    // 极值点（切比雪夫节点）
    for (let k = 0; k <= order; k++) {
      const x = Math.cos((Math.PI * k) / order);
      const y = Math.cos((Math.PI * k * order) / order);
      if (!showAll) dot(f, v.sx(x), v.sy(y), 4, C.warm);
    }

    footnotes(f, [
      `T_n(x) = cos(n·arccos x)，递推式 T_{n+1} = 2xT_n - T_{n-1}`,
      `${order} 阶多项式在 [-1,1] 内有 ${order + 1} 个极值点（橙色），且 |T_n(x)| ≤ 1`,
      '切比雪夫多项式是"最小最大"最优逼近的基石：在所有首项系数为 1 的 n 次多项式中，它的最大绝对值最小',
    ]);
    heading(f, '切比雪夫多项式：最优逼近');
  },
});

registerViz(
  calculus,
  epsilonDelta,
  meanValueTheorem,
  riemannSum,
  improperIntegral,
  arcLengthCurvature,
  seriesConvergence,
  powerSeries,
  taylor,
  numericalIntegration,
  interpolation,
  bSpline,
  catmullRom,
  discreteCosineTransform,
  chebyshevPolynomials,
);
