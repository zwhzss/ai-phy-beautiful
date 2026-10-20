import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import {
  C,
  PALETTE,
  bars,
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

/** 数值导数。 */
const d1 = (fn: (x: number) => number, x: number, h = 1e-4): number => (fn(x + h) - fn(x - h)) / (2 * h);

/** A01 微积分深化：基本定理。 */
const calculusA01 = defineViz({
  slug: 'calculus-a01',
  title: '微积分深化',
  params: {
    x0: { type: 'range', min: -2, max: 2, default: 1.2, step: 0.1, label: '上限 x₀' },
    func: { type: 'select', options: ['sin x + 1.4', 'x²', 'e^x/2'], default: 'sin x + 1.4', label: '被积函数 f' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const x0 = num(params, 'x0', 1.2);
    const func = str(params, 'func', 'sin x + 1.4');
    const fn = func === 'x²' ? (x: number): number => x * x
      : func === 'e^x/2' ? (x: number): number => Math.exp(x) / 2
        : (x: number): number => Math.sin(x) + 1.4;
    const v = view(f, { xMin: -3, xMax: 3, yMin: -0.4, yMax: 4, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });

    // 变上限积分 Φ(x) = ∫₀^x f
    const phi = (x: number): number => {
      let sum = 0;
      const steps = 300;
      const dt = x / steps;
      for (let i = 0; i < steps; i++) sum += fn((i + 0.5) * dt) * dt;
      return sum;
    };
    // 阴影：0 → x0
    const shade: Array<[number, number]> = [];
    for (let i = 0; i <= 120; i++) {
      const x = (i / 120) * x0;
      shade.push([v.sx(x), v.sy(fn(x))]);
    }
    shade.push([v.sx(x0), v.sy(0)], [v.sx(0), v.sy(0)]);
    poly(f, shade, { fill: 'rgba(102,126,234,0.28)', close: true });
    curve(f, v, fn, { color: C.accent, lw: 2.4 });
    curve(f, v, phi, { color: C.warm, lw: 2, dash: [6, 4] });
    seg(f, v.sx(x0), v.sy(0), v.sx(x0), v.sy(fn(x0)), `${C.hot}cc`, 1.6);
    dot(f, v.sx(x0), v.sy(phi(x0)), 5, C.warm);

    footnotes(f, [
      `Φ(${x0.toFixed(1)}) = ∫₀^${x0.toFixed(1)} f dx = ${phi(x0).toFixed(4)}（阴影面积，橙色点的高度）`,
      `微积分基本定理：Φ'(x) = f(x)，即 Φ'(${x0.toFixed(1)}) = ${d1(phi, x0).toFixed(4)} ≈ f(${x0.toFixed(1)}) = ${fn(x0).toFixed(4)}`,
      '求导与积分互为逆运算：面积函数的瞬时变化率正是被积函数本身',
    ]);
    heading(f, '微积分基本定理');
  },
});

/** A02 ε-δ 严格化。 */
const epsilonDeltaA02 = defineViz({
  slug: 'epsilon-delta-a02',
  title: 'ε-δ严格化',
  params: {
    x0: { type: 'range', min: 0.5, max: 3, default: 1.5, step: 0.1, label: '极限点 x₀' },
    epsMax: { type: 'range', min: 0.4, max: 2.5, default: 1.6, step: 0.1, label: 'ε 上限' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const x0 = num(params, 'x0', 1.5);
    const epsMax = num(params, 'epsMax', 1.6);
    const fn = (x: number): number => x * x;
    const L = fn(x0);

    // δ(ε) 映射曲线：对 f(x)=x² 在 x₀ 处，δ = min(√(L+ε) - x₀, x₀ - √(L-ε))
    const deltaOf = (eps: number): number => Math.min(Math.sqrt(L + eps) - x0, x0 - Math.sqrt(Math.max(0, L - eps)));
    const v = view(f, { xMin: 0, xMax: epsMax, yMin: 0, yMax: epsMax * 0.5, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });
    curve(f, v, deltaOf, { color: C.accent, lw: 2.6 });

    const sample = epsMax * 0.7;
    dot(f, v.sx(sample), v.sy(deltaOf(sample)), 5.5, C.warm);
    seg(f, v.sx(sample), v.sy(0), v.sx(sample), v.sy(deltaOf(sample)), `${C.hot}88`, 1.4);
    seg(f, v.sx(0), v.sy(deltaOf(sample)), v.sx(sample), v.sy(deltaOf(sample)), `${C.hot}88`, 1.4);
    text(f, `ε = ${sample.toFixed(2)}`, v.sx(sample), 54, { align: 'center', color: C.hot, font: '11px sans-serif' });
    text(f, `δ = ${deltaOf(sample).toFixed(4)}`, 30, v.sy(deltaOf(sample)) - 6, { color: C.hot, font: '11px sans-serif' });

    footnotes(f, [
      `对 f(x) = x² 在 x₀ = ${x0.toFixed(1)} 处（极限 L = ${L.toFixed(3)}），δ 随 ε 变化`,
      `ε 越小 δ 越小，且当 ε → 0 时 δ → 0 —— 这正是"连续性"的严格含义`,
      '证明格式：任取 ε > 0，取 δ = δ(ε)，则 |x - x₀| < δ ⇒ |f(x) - L| < ε',
    ]);
    heading(f, 'ε-δ 关系：δ 是 ε 的函数');
  },
});

/** A03 中值定理深化。 */
const meanValueTheoremA03 = defineViz({
  slug: 'mean-value-theorem-a03',
  title: '中值定理深化',
  params: {
    a: { type: 'range', min: -2.5, max: 0, default: -2, step: 0.1, label: '区间左端 a' },
    b: { type: 'range', min: 0.5, max: 3, default: 2.2, step: 0.1, label: '区间右端 b' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', -2);
    const b = Math.max(a + 0.8, num(params, 'b', 2.2));
    const fn = (x: number): number => Math.sin(x) + x * 0.3;
    const v = view(f, { xMin: -3.2, xMax: 3.2, yMin: -2, yMax: 2.4, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });
    curve(f, v, fn, { color: C.accent, lw: 2.4 });

    // 罗尔定理：找到 f'(c)=0 的点
    const critical: number[] = [];
    for (let x = a; x <= b; x += 0.01) {
      if (Math.abs(d1(fn, x)) < 0.02) critical.push(x);
    }
    // 拉格朗日：f'(c) = 割线斜率
    const slope = (fn(b) - fn(a)) / (b - a);
    const lagrangeC: number[] = [];
    for (let x = a; x <= b; x += 0.01) {
      if (Math.abs(d1(fn, x) - slope) < 0.02) lagrangeC.push(x);
    }
    seg(f, v.sx(a), v.sy(fn(a)), v.sx(b), v.sy(fn(b)), C.cool, 2);
    critical.forEach((c) => {
      dot(f, v.sx(c), v.sy(fn(c)), 4.5, C.hot);
      curve(f, v, (x) => fn(c) + 0 * x, { color: `${C.hot}55`, lw: 3 });
    });
    lagrangeC.forEach((c) => {
      dot(f, v.sx(c), v.sy(fn(c)), 5, C.green);
      seg(f, v.sx(c - 0.6), v.sy(fn(c) - slope * 0.6), v.sx(c + 0.6), v.sy(fn(c) + slope * 0.6), `${C.green}cc`, 1.8);
    });

    footnotes(f, [
      `区间 [${a.toFixed(1)}, ${b.toFixed(1)}]：割线斜率 = ${slope.toFixed(4)}（蓝线）`,
      `找到 ${lagrangeC.length} 个点使 f'(c) = 割线斜率（绿点与绿切线）；另有 ${critical.length} 个驻点（红点）`,
      '罗尔定理（f(a)=f(b) ⇒ 存在 f\'(c)=0）是拉格朗日的特例；柯西定理进一步推广到两个函数',
    ]);
    heading(f, '中值定理族：罗尔 → 拉格朗日 → 柯西');
  },
});

/** A04 黎曼和深化：收敛速率。 */
const riemannSumA04 = defineViz({
  slug: 'riemann-sum-a04',
  title: '黎曼和深化',
  params: {
    method: { type: 'select', options: ['左端点', '中点', '右端点', '梯形'], default: '中点', label: '取样方式' },
    maxN: { type: 'range', min: 8, max: 200, default: 60, step: 2, label: '最大分割数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const method = str(params, 'method', '中点');
    const maxN = Math.round(num(params, 'maxN', 60));
    const fn = (x: number): number => Math.exp(x * 0.6);
    const a = 0;
    const b = 3;
    const exact = (Math.exp(b * 0.6) - 1) / 0.6;

    const errors: number[] = [];
    const ns: number[] = [];
    for (let n = 2; n <= maxN; n += Math.max(1, Math.floor(maxN / 60))) {
      const dx = (b - a) / n;
      let sum = 0;
      for (let i = 0; i < n; i++) {
        const xa = a + i * dx;
        if (method === '中点') sum += fn(xa + dx / 2) * dx;
        else if (method === '右端点') sum += fn(xa + dx) * dx;
        else if (method === '梯形') sum += ((fn(xa) + fn(xa + dx)) / 2) * dx;
        else sum += fn(xa) * dx;
      }
      errors.push(Math.abs(sum - exact));
      ns.push(n);
    }

    // 双对数坐标
    const v = view(f, {
      xMin: Math.log10(2),
      xMax: Math.log10(maxN),
      yMin: Math.log10(Math.min(...errors.filter((e) => e > 0)) * 0.6),
      yMax: Math.log10(Math.max(...errors) * 1.6),
      inset: 44,
    });
    grid(f, v, { divisions: 5, ticks: false });
    poly(f, errors.map((e, i) => [v.sx(Math.log10(ns[i])), v.sy(Math.log10(Math.max(e, 1e-12)))] as [number, number]), { stroke: C.accent, lw: 2.4 });

    const order = method === '中点' || method === '梯形' ? 2 : 1;
    // 参考斜率线
    const refPts: Array<[number, number]> = [];
    const anchor = errors[Math.floor(errors.length / 3)];
    const anchorN = ns[Math.floor(errors.length / 3)];
    for (const n of [2, maxN]) {
      refPts.push([v.sx(Math.log10(n)), v.sy(Math.log10(anchor * Math.pow(anchorN / n, order)))]);
    }
    poly(f, refPts, { stroke: `${C.warm}aa`, lw: 1.6, dash: [6, 4] });
    text(f, `参考斜率 -${order}`, v.sx(Math.log10(maxN)) - 8, v.sy(Math.log10(anchor * Math.pow(anchorN / maxN, order))) + 16, {
      color: C.warm, align: 'right', font: '11px sans-serif',
    });

    footnotes(f, [
      `${method}法的误差随 n 的变化（双对数坐标），橙虚线是斜率 -${order} 的参考线`,
      `中点法与梯形法误差 O(1/n²)，左右端点法 O(1/n) —— 斜率差一倍，一眼可辨`,
      '误差阶数（阶数越高收敛越快）决定了"多少分点能换到多少精度"，是数值积分的核心指标',
    ]);
    heading(f, '黎曼和：误差的收敛速率');
  },
});

/** A05 反常积分深化。 */
const improperIntegralA05 = defineViz({
  slug: 'improper-integral-a05',
  title: '反常积分深化',
  params: {
    p: { type: 'range', min: 0.3, max: 2.5, default: 0.8, step: 0.1, label: '幂次 p' },
    lower: { type: 'range', min: 0.001, max: 0.5, default: 0.02, step: 0.001, label: '下界 ε' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const p = num(params, 'p', 0.8);
    const lower = num(params, 'lower', 0.02);
    const fn = (x: number): number => Math.pow(x, -p);
    const v = view(f, { xMin: 0, xMax: 1, yMin: 0, yMax: 12, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 300; i++) {
      const x = lower + (i / 300) * (1 - lower);
      const y = fn(x);
      if (y > 12) continue;
      pts.push([v.sx(x), v.sy(y)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.4 });
    // 阴影：ε → 1
    const shade: Array<[number, number]> = [...pts, [v.sx(1), v.sy(0)], [v.sx(lower), v.sy(0)]];
    poly(f, shade, { fill: 'rgba(102,126,234,0.22)', close: true });

    const value = p === 1 ? -Math.log(lower) : (1 - Math.pow(lower, 1 - p)) / (1 - p);
    const limit = p < 1 ? 1 / (1 - p) : Infinity;
    footnotes(f, [
      `∫_${lower}¹ x^(-${p}) dx = ${value.toFixed(5)}（瑕点在 x = 0）`,
      p < 1 ? `p = ${p} < 1：瑕积分收敛，极限值 = 1/(1-p) = ${limit.toFixed(5)}` : p === 1 ? 'p = 1：发散（对数发散）' : `p = ${p} > 1：发散（函数在 0 附近增长太快）`,
      '注意与"无穷区间"的反常积分判据相反：这里 p < 1 收敛，那里 p > 1 收敛',
    ]);
    heading(f, '反常积分：瑕点的收敛性');
  },
});

/** A06 弧长与曲率深化。 */
const arcLengthCurvatureA06 = defineViz({
  slug: 'arc-length-curvature-a06',
  title: '弧长与曲率深化',
  params: {
    kind: { type: 'select', options: ['椭圆', '抛物线', '正弦波'], default: '椭圆', label: '曲线' },
    range: { type: 'range', min: 1, max: 4, default: 2.6, step: 0.2, label: '范围' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'kind', '椭圆');
    const rngV = num(params, 'range', 2.6);
    const fn = kind === '抛物线' ? (x: number): number => x * x * 0.4
      : kind === '正弦波' ? (x: number): number => Math.sin(x * 1.6) * 1.2
        : (x: number): number => 1.6 * Math.sqrt(Math.max(0, 1 - (x / 2.6) ** 2));
    const v = view(f, { xMin: -6, xMax: 6, yMin: -3, yMax: 3.4, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });

    // 曲线（椭圆需上下两支）
    const upper: Array<[number, number]> = [];
    for (let i = 0; i <= 200; i++) {
      const x = -rngV + (i / 200) * 2 * rngV;
      upper.push([v.sx(x), v.sy(fn(x))]);
    }
    poly(f, upper, { stroke: C.accent, lw: 2.4 });
    if (kind === '椭圆') poly(f, upper.map(([x, y]) => [x, v.sy(0) - (y - v.sy(0))] as [number, number]), { stroke: C.accent, lw: 2.4 });

    // 曲率与曲率圆（渐屈线）
    const curvatureAt = (x: number): number => {
      const y1 = d1(fn, x);
      const y2 = (d1(fn, x + 1e-3) - d1(fn, x - 1e-3)) / 2e-3;
      return Math.abs(y2) / Math.pow(1 + y1 * y1, 1.5);
    };
    const evolute: Array<[number, number]> = [];
    for (let i = 0; i <= 120; i++) {
      const x = -rngV * 0.95 + (i / 120) * 2 * rngV * 0.95;
      const y = fn(x);
      const y1 = d1(fn, x);
      const y2 = (d1(fn, x + 1e-3) - d1(fn, x - 1e-3)) / 2e-3;
      const k = curvatureAt(x);
      if (k < 1e-4) continue;
      const r = 1 / k;
      const nx2 = -y1 / Math.sqrt(1 + y1 * y1);
      const ny2 = 1 / Math.sqrt(1 + y1 * y1);
      const sign = y2 >= 0 ? 1 : -1;
      evolute.push([v.sx(x + sign * nx2 * r), v.sy(y + sign * ny2 * r)]);
    }
    poly(f, evolute, { stroke: `${C.warm}cc`, lw: 1.8, dash: [5, 4] });

    // 选一点画密切圆
    const sampleX = 0.6;
    const sampleY = fn(sampleX);
    const kSample = curvatureAt(sampleX);
    if (kSample > 1e-3) {
      const rSample = 1 / kSample;
      const y1 = d1(fn, sampleX);
      const y2 = (d1(fn, sampleX + 1e-3) - d1(fn, sampleX - 1e-3)) / 2e-3;
      const nx2 = -y1 / Math.sqrt(1 + y1 * y1);
      const ny2 = 1 / Math.sqrt(1 + y1 * y1);
      const sign = y2 >= 0 ? 1 : -1;
      const cx = sampleX + sign * nx2 * rSample;
      const cy = sampleY + sign * ny2 * rSample;
      const circlePts: Array<[number, number]> = [];
      for (let i = 0; i <= 100; i++) {
        const t = (i / 100) * Math.PI * 2;
        circlePts.push([v.sx(cx + rSample * Math.cos(t)), v.sy(cy + rSample * Math.sin(t))]);
      }
      poly(f, circlePts, { stroke: `${C.green}cc`, lw: 1.6 });
      dot(f, v.sx(sampleX), v.sy(sampleY), 5, C.green);
    }

    footnotes(f, [
      `橙色虚线是渐屈线（各点曲率中心的轨迹），绿色圆是某点的密切圆（曲率半径 ${(1 / curvatureAt(sampleX)).toFixed(4)}）`,
      `在 x = ${sampleX} 处：曲率 κ = ${curvatureAt(sampleX).toFixed(5)}，曲率半径 = 1/κ`,
      '渐屈线是原曲线的"曲率中心包络"，两线在顶点处正交；椭圆顶点的曲率最小（最平坦）',
    ]);
    heading(f, '曲率与渐屈线');
  },
});

/** A07 级数收敛深化。 */
const seriesConvergenceA07 = defineViz({
  slug: 'series-convergence-a07',
  title: '级数收敛深化',
  params: {
    n: { type: 'range', min: 10, max: 400, default: 150, step: 10, label: '项数上限' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const maxN = Math.round(num(params, 'n', 150));
    // 三组典型级数
    const series: Array<{ label: string; color: string; term: (k: number) => number; limit: number }> = [
      { label: 'Σ1/k²（收敛）', color: C.green, term: (k) => 1 / (k * k), limit: Math.PI ** 2 / 6 },
      { label: 'Σ1/k（发散）', color: C.warm, term: (k) => 1 / k, limit: Infinity },
      { label: 'Σ(-1)^(k+1)/k（条件收敛）', color: C.cool, term: (k) => (k % 2 === 1 ? 1 : -1) / k, limit: Math.log(2) },
      { label: 'Σ1/k!（快速收敛）', color: C.accent, term: (k) => {
        let fact = 1;
        for (let i = 2; i <= k; i++) fact *= i;
        return 1 / fact;
      }, limit: Math.E - 1 },
    ];

    // 部分和的对数收敛图：用 log|S - L| 的走势，发散的画 S 本身
    const v = view(f, { xMin: 0, xMax: maxN, yMin: 0, yMax: 4.5, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    series.forEach((s) => {
      let sum = 0;
      const pts: Array<[number, number]> = [];
      for (let k = 1; k <= maxN; k++) {
        sum += s.term(k);
        const value = Number.isFinite(s.limit) ? sum : Math.log(1 + sum);
        pts.push([v.sx(k), v.sy(Math.min(4.5, value))]);
      }
      poly(f, pts, { stroke: s.color, lw: 2 });
    });
    series.forEach((s, i) => {
      text(f, s.label, 44, 70 + i * 20, { color: s.color, font: '12px sans-serif' });
    });

    footnotes(f, [
      `四类级数在 ${maxN} 项处的表现：Σ1/k² → π²/6 ≈ 1.6449，Σ1/k 缓慢发散（对数增长）`,
      'Σ(-1)^(k+1)/k 交替趋近 ln2 ≈ 0.6931；Σ1/k! 收敛极快（几项就精确到小数点后多位）',
      '收敛速度差别巨大：比值判别法能捉住 1/k! 这类"快收敛"，但对 1/k² 与 1/k 只能靠积分判别法区分',
    ]);
    heading(f, '级数收敛：四类典型级数的部分和');
  },
});

/** A08 幂级数深化。 */
const powerSeriesA08 = defineViz({
  slug: 'power-series-a08',
  title: '幂级数深化',
  params: {
    func: { type: 'select', options: ['1/(1-z)', 'e^z', 'ln(1+z)'], default: '1/(1-z)', label: '复函数' },
    terms: { type: 'range', min: 2, max: 30, default: 12, label: '部分和项数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const func = str(params, 'func', '1/(1-z)');
    const termsN = Math.round(num(params, 'terms', 12));

    // 复平面上的收敛圆
    const v = view(f, { xMin: -2, xMax: 2, yMin: -2, yMax: 2, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });
    const unit = v.sx(1) - v.sx(0);
    if (func !== 'e^z') {
      const circlePts: Array<[number, number]> = [];
      for (let i = 0; i <= 120; i++) {
        const t = (i / 120) * Math.PI * 2;
        circlePts.push([v.sx(Math.cos(t)), v.sy(Math.sin(t))]);
      }
      poly(f, circlePts, { stroke: C.hot, lw: 2, dash: [6, 4] });
    }

    // 用色相表示部分和的模，展示收敛/发散
    const steps = 60;
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < steps; j++) {
        const re = -2 + (i / steps) * 4;
        const im = -2 + (j / steps) * 4;
        const z = { re, im };
        let sum = { re: 0, im: 0 };
        let pow = { re: 1, im: 0 };
        for (let k = 0; k < termsN; k++) {
          const coef = func === '1/(1-z)' ? 1 : func === 'e^z' ? 1 / (() => {
            let fact = 1;
            for (let m = 2; m <= k; m++) fact *= m;
            return fact;
          })() : (k === 0 ? 0 : (k % 2 === 1 ? 1 : -1) / k);
          sum = { re: sum.re + coef * pow.re, im: sum.im + coef * pow.im };
          pow = { re: pow.re * z.re - pow.im * z.im, im: pow.re * z.im + pow.im * z.re };
        }
        const mag = Math.hypot(sum.re, sum.im);
        if (mag > 6) continue;
        f.ctx.save();
        f.ctx.fillStyle = `hsla(${230 - Math.min(1, mag / 3) * 150}, 60%, ${24 + Math.min(1, mag / 3) * 30}%, 0.85)`;
        f.ctx.fillRect(v.sx(re), v.sy(im), (4 / steps) * unit + 1, (4 / steps) * unit + 1);
        f.ctx.restore();
      }
    }
    // 重新描一遍网格与坐标轴
    grid(f, v, { divisions: 5, ticks: true });

    footnotes(f, [
      `${func} 的幂级数取前 ${termsN} 项，在复平面上着色（亮 = 模大）`,
      func === 'e^z' ? '指数函数是整函数：收敛半径 R = ∞，整个复平面都收敛' : '红色虚线是收敛圆 |z| = 1（由最近的奇点决定：1/(1-z) 在 z=1 有极点，ln(1+z) 在 z=-1 有支点）',
      '收敛半径 = 展开点到最近奇点的距离 —— 解析函数的奇点决定了级数的"势力范围"',
    ]);
    heading(f, '幂级数的收敛圆');
  },
});

/** A09 泰勒级数深化。 */
const taylorA09 = defineViz({
  slug: 'taylor-a09',
  title: '泰勒级数深化',
  params: {
    func: { type: 'select', options: ['sin x', 'ln(1+x)', 'e^x'], default: 'sin x', label: '函数' },
    order: { type: 'range', min: 1, max: 10, default: 4, label: '阶数 n' },
    point: { type: 'range', min: -2, max: 2, default: 0.6, step: 0.1, label: '考察点 x' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const func = str(params, 'func', 'sin x');
    const order = Math.round(num(params, 'order', 4));
    const x = num(params, 'point', 0.6);
    const fn = func === 'ln(1+x)' ? (t: number): number => Math.log(1 + t)
      : func === 'e^x' ? (t: number): number => Math.exp(t)
        : (t: number): number => Math.sin(t);
    const factorial = (k: number): number => (k <= 1 ? 1 : k * factorial(k - 1));
    const coeff = (k: number): number => {
      if (func === 'sin x') return k % 2 === 1 ? Math.pow(-1, (k - 1) / 2) / factorial(k) : 0;
      if (func === 'e^x') return 1 / factorial(k);
      return k === 0 ? 0 : Math.pow(-1, k - 1) / k;
    };
    const polyTaylor = (t: number): number => {
      let s = 0;
      for (let k = 0; k < order; k++) s += coeff(k) * Math.pow(t, k);
      return s;
    };
    const nextTerm = coeff(order) * Math.pow(x, order);
    const remainder = fn(x) - polyTaylor(x);

    const v = view(f, { xMin: -3, xMax: 3, yMin: -2.4, yMax: 2.4, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });
    curve(f, v, fn, { color: C.dim, lw: 1.8, dash: [5, 4] });
    curve(f, v, polyTaylor, { color: C.accent, lw: 2.6 });
    dot(f, v.sx(x), v.sy(fn(x)), 5.5, C.green);
    dot(f, v.sx(x), v.sy(polyTaylor(x)), 5, C.warm);
    seg(f, v.sx(x), v.sy(fn(x)), v.sx(x), v.sy(polyTaylor(x)), `${C.hot}cc`, 2);
    text(f, `余项 ${Math.abs(remainder).toExponential(2)}`, v.sx(x) + 8, (v.sy(fn(x)) + v.sy(polyTaylor(x))) / 2, { color: C.hot, font: '11px sans-serif' });

    footnotes(f, [
      `${func} 的 ${order} 阶泰勒多项式在 x = ${x} 处：多项式值 ${polyTaylor(x).toFixed(6)}，真值 ${fn(x).toFixed(6)}`,
      `拉格朗日余项 R_n = f^(n+1)(ξ)/(n+1)! · x^(n+1) 的下一项估计 = ${nextTerm.toExponential(3)}`,
      '误差界：|R_n| ≤ M·|x|^(n+1)/(n+1)!（M 是区间上 |f^(n+1)| 的上界）—— 这就是泰勒展开可控的原因',
    ]);
    heading(f, '泰勒余项：误差可控的逼近');
  },
});

/** A10 数值积分深化。 */
const numericalIntegrationA10 = defineViz({
  slug: 'numerical-integration-a10',
  title: '数值积分深化',
  params: {
    n: { type: 'range', min: 2, max: 32, default: 8, label: '子区间数 n' },
    method: { type: 'select', options: ['辛普森', '梯形', '中点'], default: '辛普森', label: '方法' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.max(2, Math.round(num(params, 'n', 8)));
    const method = str(params, 'method', '辛普森');
    const fn = (x: number): number => Math.sin(x) + Math.cos(2 * x) * 0.6 + 1.4;
    const a = 0;
    const b = 5;

    const integrate = (sub: number): number => {
      const dx = (b - a) / sub;
      let sum = 0;
      for (let i = 0; i < sub; i++) {
        const xa = a + i * dx;
        const xb = xa + dx;
        if (method === '辛普森' && sub % 2 === 0) {
          sum += ((fn(xa) + 4 * fn((xa + xb) / 2) + fn(xb)) / 6) * dx;
        } else if (method === '中点') {
          sum += fn((xa + xb) / 2) * dx;
        } else {
          sum += ((fn(xa) + fn(xb)) / 2) * dx;
        }
      }
      return sum;
    };
    const exact = (() => {
      let acc = 0;
      const steps = 20000;
      for (let i = 0; i < steps; i++) acc += fn(((i + 0.5) * b) / steps) * (b / steps);
      return acc;
    })();

    // Romberg 式误差表
    const rows = 6;
    const table: number[][] = [];
    for (let r = 0; r < rows; r++) {
      const sub = n * Math.pow(2, r);
      table.push([Math.abs(integrate(sub) - exact)]);
    }
    // Richardson 外推
    for (let r = 1; r < rows; r++) {
      const order = method === '辛普森' ? 4 : 2;
      const factor = Math.pow(2, order);
      table[r].push(Math.abs((factor * table[r][0] - table[r - 1][0]) / (factor - 1)));
    }

    const cell = Math.min(120, (w - 140) / (rows + 1));
    const oy = 70;
    table.forEach((row, r) => {
      row.forEach((val, c) => {
        const x = 90 + c * (cell + 4);
        const mag = Math.log10(Math.max(val, 1e-16));
        const t = Math.max(0, Math.min(1, (mag + 16) / 16));
        f.ctx.save();
        f.ctx.fillStyle = `hsl(${230 - t * 150}, 60%, ${26 + t * 28}%)`;
        f.ctx.fillRect(x, oy + r * 42, cell, 34);
        f.ctx.restore();
        text(f, val.toExponential(2), x + cell / 2, oy + r * 42 + 22, { align: 'center', color: C.fg, font: '11px Consolas, monospace' });
      });
      text(f, `n=${n * Math.pow(2, r)}`, 80, oy + r * 42 + 22, { align: 'right', color: C.dim, font: '11px sans-serif' });
    });
    text(f, '原始误差', 90 + 0.5 * cell, oy - 12, { align: 'center', color: C.dim, font: '11px sans-serif' });
    text(f, '外推后', 90 + 1.5 * cell + cell * 0.5, oy - 12, { align: 'center', color: C.warm, font: '11px sans-serif' });

    footnotes(f, [
      `${method}法：误差随二分加密迅速下降（颜色越亮误差越小）`,
      `Richardson 外推把 O(h^${method === '辛普森' ? 4 : 2}) 的误差再消掉一阶，Romberg 积分就是这样逐层加速的`,
      '外推的思想：用不同步长的结果线性组合，消去误差主项 —— 数值微分、ODE 求解器也用它',
    ]);
    heading(f, '数值积分：误差表与外推');
  },
});

/** A11 插值深化。 */
const interpolationA11 = defineViz({
  slug: 'interpolation-a11',
  title: '插值深化',
  params: {
    nodes: { type: 'range', min: 5, max: 20, default: 12, label: '节点数' },
    type: { type: 'select', options: ['等距节点', '切比雪夫节点'], default: '等距节点', label: '节点分布' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const count = Math.round(num(params, 'nodes', 12));
    const nodeType = str(params, 'type', '等距节点');
    const fn = (x: number): number => 1 / (1 + 25 * x * x); // 龙格函数
    const nodes: number[] = [];
    for (let i = 0; i < count; i++) {
      if (nodeType === '切比雪夫节点') {
        nodes.push(Math.cos((Math.PI * (i + 0.5)) / count));
      } else {
        nodes.push(-1 + (2 * i) / (count - 1));
      }
    }
    const lagrange = (x: number): number => {
      let sum = 0;
      for (let i = 0; i < count; i++) {
        let term = fn(nodes[i]);
        for (let j = 0; j < count; j++) {
          if (i !== j) term *= (x - nodes[j]) / (nodes[i] - nodes[j]);
        }
        sum += term;
      }
      return sum;
    };

    const v = view(f, { xMin: -1.1, xMax: 1.1, yMin: -0.6, yMax: 1.4, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    curve(f, v, fn, { color: C.dim, lw: 1.8, dash: [5, 4] });
    curve(f, v, lagrange, { color: C.accent, lw: 2.2, samples: 900 });
    nodes.forEach((x) => dot(f, v.sx(x), v.sy(fn(x)), 4, C.warm));

    // 最大误差
    let maxErr = 0;
    for (let i = 0; i <= 500; i++) {
      const x = -1 + (i / 500) * 2;
      maxErr = Math.max(maxErr, Math.abs(lagrange(x) - fn(x)));
    }
    footnotes(f, [
      `龙格函数 1/(1+25x²) 用 ${count} 个${nodeType}插值，最大误差 ${maxErr.toFixed(4)}`,
      nodeType === '等距节点' ? '等距节点在两端剧烈振荡（龙格现象）—— 增加节点反而可能更糟' : '切比雪夫节点向两端聚集，误差被均匀化，几乎消除振荡',
      '切比雪夫节点是 [-1,1] 上"最小化插值误差上限"的最优节点分布',
    ]);
    heading(f, '插值：龙格现象与节点选择');
  },
});

/** A12 B 样条深化。 */
const bSplineA12 = defineViz({
  slug: 'b-spline-a12',
  title: 'B样条深化',
  params: {
    degree: { type: 'range', min: 0, max: 4, default: 2, label: '次数 p' },
    knots: { type: 'range', min: 4, max: 12, default: 8, label: '节点数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const degree = Math.round(num(params, 'degree', 2));
    const knotCount = Math.round(num(params, 'knots', 8));
    const v = view(f, { xMin: -0.2, xMax: 1.2, yMin: -0.15, yMax: 1.25, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });

    const uniform = (i: number): number => {
      const total = knotCount + degree + 1;
      return i <= degree ? 0 : i >= knotCount ? 1 : (i - degree) / (knotCount - degree);
    };
    const basis = (i: number, p: number, u: number): number => {
      if (p === 0) return uniform(i) <= u && u < uniform(i + 1) ? 1 : 0;
      let sum = 0;
      const left = uniform(i + p) - uniform(i);
      const right = uniform(i + p + 1) - uniform(i + 1);
      if (left > 0) sum += ((u - uniform(i)) / left) * basis(i, p - 1, u);
      if (right > 0) sum += ((uniform(i + p + 1) - u) / right) * basis(i + 1, p - 1, u);
      return sum;
    };

    for (let i = 0; i < knotCount; i++) {
      const pts: Array<[number, number]> = [];
      for (let k = 0; k <= 300; k++) {
        const u = 0.0001 + (k / 300) * 0.9998;
        pts.push([v.sx(u), v.sy(basis(i, degree, u))]);
      }
      poly(f, pts, { stroke: PALETTE[i % PALETTE.length], lw: 1.8 });
    }
    // 单位分解
    const partition: Array<[number, number]> = [];
    for (let k = 0; k <= 200; k++) {
      const u = 0.0001 + (k / 200) * 0.9998;
      let sum = 0;
      for (let i = 0; i < knotCount; i++) sum += basis(i, degree, u);
      partition.push([v.sx(u), v.sy(sum)]);
    }
    poly(f, partition, { stroke: C.fg, lw: 2.4, dash: [6, 4] });

    footnotes(f, [
      `次数 p = ${degree}、控制点 ${knotCount} 个：${knotCount} 条基函数各在局部区间非零`,
      '白色虚线是基函数之和 —— 恒等于 1（单位分解性质），这保证曲线不会"飘走"',
      '次数越高曲线越光滑（C^(p-1) 连续）；每条基函数只在 p+1 个节点区间内非零（局部支撑）',
    ]);
    heading(f, 'B 样条基函数');
  },
});

/** A13 Catmull-Rom 深化。 */
const catmullRomA13 = defineViz({
  slug: 'catmull-rom-a13',
  title: 'Catmull-Rom深化',
  params: {
    segments: { type: 'range', min: 3, max: 8, default: 5, label: '控制点数' },
    alpha: { type: 'range', min: 0, max: 1, default: 0.5, step: 0.1, label: 'α（0=均匀，0.5=向心）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const count = Math.round(num(params, 'segments', 5));
    const alpha = num(params, 'alpha', 0.5);
    const ctrl: Array<[number, number]> = [];
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      ctrl.push([-3 + 6 * t, Math.sin(t * Math.PI * 1.6) * 1.8]);
    }
    const v = view(f, { xMin: -3.6, xMax: 3.6, yMin: -2.6, yMax: 2.6, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });

    // 均匀 Catmull-Rom
    const uniformPts: Array<[number, number]> = [];
    for (let i = 0; i + 3 < ctrl.length; i++) {
      const [p0, p1, p2, p3] = [ctrl[i], ctrl[i + 1], ctrl[i + 2], ctrl[i + 3]];
      for (let k = 0; k <= 40; k++) {
        const t = k / 40;
        const t2 = t * t;
        const t3 = t2 * t;
        const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        uniformPts.push([v.sx(x), v.sy(y)]);
      }
    }
    poly(f, uniformPts, { stroke: C.accent, lw: 2.4 });

    // 张力可调版本：用分段线性插值近似展示 α 的影响（向心 vs 均匀）
    const tension = 0.5 - alpha * 0.35;
    const tensionPts: Array<[number, number]> = [];
    for (let i = 0; i + 3 < ctrl.length; i++) {
      const [p0, p1, p2, p3] = [ctrl[i], ctrl[i + 1], ctrl[i + 2], ctrl[i + 3]];
      const m1: [number, number] = [tension * 2 * (p2[0] - p0[0]), tension * 2 * (p2[1] - p0[1])];
      const m2: [number, number] = [tension * 2 * (p3[0] - p1[0]), tension * 2 * (p3[1] - p1[1])];
      for (let k = 0; k <= 40; k++) {
        const t = k / 40;
        const t2 = t * t;
        const t3 = t2 * t;
        const x = (2 * t3 - 3 * t2 + 1) * p1[0] + (t3 - 2 * t2 + t) * m1[0] + (-2 * t3 + 3 * t2) * p2[0] + (t3 - t2) * m2[0];
        const y = (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1[1] + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2[1];
        tensionPts.push([v.sx(x), v.sy(y)]);
      }
    }
    poly(f, tensionPts, { stroke: `${C.warm}cc`, lw: 1.8, dash: [6, 4] });
    ctrl.forEach(([x, y]) => dot(f, v.sx(x), v.sy(y), 4.5, C.green));

    footnotes(f, [
      `蓝色：均匀 Catmull-Rom（α = 0.5）；橙色虚线：张力参数 α = ${alpha} 的 Hermite 变体`,
      'α = 0（均匀）、α = 0.5（向心）、α = 1（弦长）：向心参数化能避免"尖点"与自交',
      'Catmull-Rom 经过所有控制点（插值样条），切线由邻点决定，常用于相机路径、动画补间',
    ]);
    heading(f, 'Catmull-Rom：参数化的影响');
  },
});

/** A14 离散余弦变换深化。 */
const discreteCosineTransformA14 = defineViz({
  slug: 'discrete-cosine-transform-a14',
  title: '离散余弦变换深化',
  params: {
    u: { type: 'range', min: 0, max: 7, default: 2, label: '水平频率 u' },
    v: { type: 'range', min: 0, max: 7, default: 1, label: '垂直频率 v' },
    keepLow: { type: 'range', min: 1, max: 20, default: 8, label: '保留系数数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const u = Math.round(num(params, 'u', 2));
    const vIdx = Math.round(num(params, 'v', 1));
    const keep = Math.round(num(params, 'keepLow', 8));
    const N = 8;

    // 8×8 DCT 基图像
    const cellSize = 26;
    const baseFunc = (m: number, n: number): number =>
      Math.cos(((2 * m + 1) * u * Math.PI) / (2 * N)) * Math.cos(((2 * n + 1) * vIdx * Math.PI) / (2 * N));

    const ox = 40;
    const oy = 56;
    let maxAbs = 0;
    for (let m = 0; m < N; m++) for (let n = 0; n < N; n++) maxAbs = Math.max(maxAbs, Math.abs(baseFunc(m, n)));
    for (let m = 0; m < N; m++) {
      for (let n = 0; n < N; n++) {
        const val = baseFunc(m, n) / (maxAbs || 1);
        const gray = Math.round(128 + val * 110);
        f.ctx.save();
        f.ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
        f.ctx.fillRect(ox + n * cellSize, oy + m * cellSize, cellSize - 1, cellSize - 1);
        f.ctx.restore();
      }
    }
    text(f, `基图像 DCT(${u},${vIdx})`, ox, oy - 10, { color: C.dim, font: '12px sans-serif' });

    // 右侧：zigzag 扫描顺序（保留低频）
    const zx = ox + N * cellSize + 60;
    const zoy = oy;
    const zorder: Array<[number, number]> = [];
    for (let s = 0; s < 2 * N - 1; s++) {
      for (let i = 0; i <= s; i++) {
        const j = s - i;
        if (i < N && j < N) zorder.push(s % 2 === 0 ? [j, i] : [i, j]);
      }
    }
    const zCell = Math.min(cellSize, (w - zx - 60) / N);
    zorder.forEach(([row, col], idx) => {
      const px = zx + col * zCell;
      const py = zoy + row * zCell;
      const on = idx < keep;
      f.ctx.save();
      f.ctx.fillStyle = on ? (idx < 3 ? C.warm : C.accent) : 'rgba(58,74,99,0.6)';
      f.ctx.fillRect(px, py, zCell - 1, zCell - 1);
      f.ctx.restore();
      if (zCell > 16) text(f, String(idx), px + zCell / 2, py + zCell * 0.68, { align: 'center', color: on ? '#fff' : C.dim, font: '9px sans-serif' });
    });
    text(f, `Zigzag 扫描取前 ${keep} 个（低频）`, zx, zoy - 10, { color: C.dim, font: '12px sans-serif' });

    footnotes(f, [
      `左：DCT 基图像（u, v 是水平/垂直频率）；右：Zigzag 扫描顺序，前 ${keep} 个系数被保留`,
      'DCT 把 8×8 像素块变成 64 个频率系数，低频集中在 Zigzag 序列前面',
      'JPEG 对每个 8×8 块做 DCT、量化（丢弃高频小系数）、再熵编码 —— 这就是有损压缩的来源',
    ]);
    heading(f, '二维 DCT 与 JPEG 压缩');
  },
});

/** A15 切比雪夫多项式深化。 */
const chebyshevPolynomialsA15 = defineViz({
  slug: 'chebyshev-polynomials-a15',
  title: '切比雪夫多项式深化',
  params: {
    order: { type: 'range', min: 3, max: 14, default: 8, label: '阶数 n' },
    showError: { type: 'select', options: ['误差曲线', '极值点'], default: '误差曲线', label: '显示' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const order = Math.round(num(params, 'order', 8));
    const mode = str(params, 'showError', '误差曲线');
    const v = view(f, { xMin: -1.05, xMax: 1.05, yMin: mode === '误差曲线' ? -1.2 : -1.1, yMax: mode === '误差曲线' ? 1.2 : 1.1, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });

    const cheb = (n: number): ((x: number) => number) => {
      if (n === 0) return () => 1;
      if (n === 1) return (x) => x;
      let p0: (x: number) => number = () => 1;
      let p1: (x: number) => number = (x) => x;
      for (let k = 2; k <= n; k++) {
        const a = p0;
        const b = p1;
        p0 = b;
        p1 = (x) => 2 * x * b(x) - a(x);
      }
      return p1;
    };
    const Tn = cheb(order);
    const mono = (x: number): number => Math.pow(x, order); // 首项系数为 1 的单项式 x^n

    if (mode === '误差曲线') {
      // T_n(x)/2^(n-1) 是首项系数为 1 的多项式中最大模最小的
      const scale = Math.pow(2, order - 1);
      curve(f, v, (x) => Tn(x) / scale, { color: C.accent, lw: 2.4 });
      curve(f, v, mono, { color: `${C.dim}99`, lw: 1.4, dash: [5, 4] });
      // 最小最大界
      for (const sign of [1, -1]) {
        seg(f, v.sx(-1), v.sy(sign / scale), v.sx(1), v.sy(sign / scale), `${C.warm}88`, 1.2);
      }
      footnotes(f, [
        `蓝线：T_${order}(x)/2^${order - 1}（首项系数为 1）；灰虚线：x^${order}`,
        `切比雪夫版本的振幅恒为 ±1/2^${order - 1} = ±${(1 / scale).toExponential(3)}，而 x^${order} 在端点达到 1`,
        '切比雪夫交替定理：在所有首项系数为 1 的 n 次多项式中，它使最大绝对偏差最小（极小极大最优）',
      ]);
    } else {
      curve(f, v, Tn, { color: C.accent, lw: 2.4 });
      // 极值点（切比雪夫节点）
      for (let k = 0; k <= order; k++) {
        const x = Math.cos((Math.PI * k) / order);
        dot(f, v.sx(x), v.sy(Math.cos(Math.PI * k)), 4.5, C.warm);
      }
      // 零点
      for (let k = 0; k < order; k++) {
        const x = Math.cos((Math.PI * (k + 0.5)) / order);
        dot(f, v.sx(x), v.sy(0), 3.6, C.green);
      }
      footnotes(f, [
        `T_${order}(x) 在 [-1,1] 上恰好 ${order + 1} 个极值点（橙，交替 ±1）与 ${order} 个零点（绿）`,
        `零点 x_k = cos((2k+1)π/(2n))，极值点 x_k = cos(kπ/n) —— 都向端点聚集`,
        '切比雪夫节点是多项式插值与数值积分（Clenshaw-Curtis）的理想节点分布',
      ]);
    }
    heading(f, `切比雪夫多项式：${mode}`);
  },
});

registerViz(
  calculusA01,
  epsilonDeltaA02,
  meanValueTheoremA03,
  riemannSumA04,
  improperIntegralA05,
  arcLengthCurvatureA06,
  seriesConvergenceA07,
  powerSeriesA08,
  taylorA09,
  numericalIntegrationA10,
  interpolationA11,
  bSplineA12,
  catmullRomA13,
  discreteCosineTransformA14,
  chebyshevPolynomialsA15,
);
