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

/** 组合数 C(n, k)。 */
function binom(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

/** 数值求根：扫描符号变化后二分细化。 */
function findRoots(fn: (x: number) => number, from: number, to: number, steps = 400): number[] {
  const roots: number[] = [];
  let prevX = from;
  let prevY = fn(from);
  for (let i = 1; i <= steps; i++) {
    const x = from + ((to - from) * i) / steps;
    const y = fn(x);
    if (Number.isFinite(prevY) && Number.isFinite(y) && prevY === 0) {
      roots.push(round3(prevX));
    } else if (Number.isFinite(prevY) && Number.isFinite(y) && prevY * y < 0) {
      let lo = prevX;
      let hi = x;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        if (fn(lo) * fn(mid) <= 0) hi = mid;
        else lo = mid;
      }
      roots.push(round3((lo + hi) / 2));
    }
    prevX = x;
    prevY = y;
  }
  return roots.filter((r, i, arr) => arr.findIndex((v) => Math.abs(v - r) < 1e-3) === i);
}

/** 保留三位小数。 */
function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

/** I01 数列入门。 */
const sequences = defineViz({
  slug: 'sequences',
  title: '数列入门',
  params: {
    kind: { type: 'select', options: ['等差数列', '等比数列'], default: '等差数列', label: '类型' },
    a1: { type: 'range', min: 1, max: 10, default: 2, label: '首项 a₁' },
    d: { type: 'range', min: 1, max: 5, default: 3, label: '公差/公比' },
    terms: { type: 'range', min: 4, max: 16, default: 10, label: '项数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'kind', '等差数列');
    const a1 = num(params, 'a1', 2);
    const d = num(params, 'd', 3);
    const n = Math.round(num(params, 'terms', 10));
    const isArith = kind === '等差数列';
    const seq: number[] = [];
    for (let i = 0; i < n; i++) seq.push(isArith ? a1 + i * d : a1 * Math.pow(d, i));

    const v = view(f, { xMin: 0, xMax: n - 1, yMin: 0, yMax: Math.max(...seq) * 1.1, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    poly(f, seq.map((y, i) => [v.sx(i), v.sy(y)] as [number, number]), { stroke: C.accent, lw: 2 });
    seq.forEach((y, i) => dot(f, v.sx(i), v.sy(y), 4.5, C.warm));

    const nth = isArith ? a1 + (n - 1) * d : a1 * Math.pow(d, n - 1);
    const sum = isArith ? (n * (a1 + nth)) / 2 : (a1 * (Math.pow(d, n) - 1)) / (d - 1);
    footnotes(f, [
      isArith ? `通项 aₙ = a₁ + (n-1)d = ${a1} + (n-1)×${d}` : `通项 aₙ = a₁·q^(n-1) = ${a1}×${d}^(n-1)`,
      `前 ${n} 项和 = ${round3(sum)}，第 ${n} 项 = ${round3(nth)}`,
      isArith ? '等差数列在图上是一条直线（相邻差恒定）' : '等比数列在图上呈指数上升（相邻比恒定）',
    ]);
    heading(f, `${kind}的通项与前 n 项和`);
  },
});

/** I02 一次函数。 */
const linearFunction = defineViz({
  slug: 'linear-function',
  title: '一次函数',
  params: {
    k: { type: 'range', min: -4, max: 4, default: 2, step: 0.5, label: '斜率 k' },
    b: { type: 'range', min: -6, max: 6, default: -2, step: 0.5, label: '截距 b' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const k = num(params, 'k', 2);
    const b = num(params, 'b', -2);
    const v = view(f, { xMin: -6, xMax: 6, yMin: -6, yMax: 6, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });
    curve(f, v, (x) => k * x + b, { color: C.accent, lw: 2.5 });

    // 斜率三角形
    const x0 = 1;
    const y0 = k * x0 + b;
    polyView(f, v, [[x0, y0], [x0 + 1, y0], [x0 + 1, y0 + k]], {
      fill: 'rgba(245,101,101,0.18)',
      stroke: C.hot,
      lw: 1.5,
      close: true,
    });
    text(f, `Δx=1`, v.sx(x0 + 0.5), v.sy(y0) + 16, { align: 'center', color: C.hot, font: '12px sans-serif' });
    text(f, `Δy=${k}`, v.sx(x0 + 1) + 8, v.sy(y0 + k / 2), { color: C.hot, font: '12px sans-serif' });
    dot(f, v.sx(0), v.sy(b), 5, C.green);

    const zero = -b / k;
    footnotes(f, [
      `y = ${k}x ${b >= 0 ? '+ ' + b : '- ' + Math.abs(b)}：斜率 k = ${k} 决定倾斜，截距 b = ${b} 决定与 y 轴交点`,
      `与 x 轴交于 x = ${round3(zero)}，斜率 k = Δy/Δx = ${k}`,
      k > 0 ? 'k > 0：函数单调递增' : k < 0 ? 'k < 0：函数单调递减' : 'k = 0：常函数',
    ]);
    heading(f, '一次函数：直线与斜率');
  },
});

/** I03 二次函数。 */
const quadraticFunction = defineViz({
  slug: 'quadratic-function',
  title: '二次函数',
  params: {
    a: { type: 'range', min: -3, max: 3, default: 1, step: 0.25, label: 'a' },
    b: { type: 'range', min: -6, max: 6, default: -2, step: 0.5, label: 'b' },
    c: { type: 'range', min: -8, max: 8, default: -3, label: 'c' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    let a = num(params, 'a', 1);
    if (Math.abs(a) < 0.2) a = 0.25;
    const b = num(params, 'b', -2);
    const c = num(params, 'c', -3);
    const vx = -b / (2 * a);
    const vy = a * vx * vx + b * vx + c;
    const v = view(f, { xMin: vx - 6, xMax: vx + 6, yMin: Math.min(vy - 3, -3), yMax: Math.max(vy + 8, 8), inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });
    curve(f, v, (x) => a * x * x + b * x + c, { color: C.accent, lw: 2.5 });

    dot(f, v.sx(vx), v.sy(vy), 6, C.warm);
    seg(f, v.sx(vx), v.sy(v.yMin), v.sx(vx), v.sy(v.yMax), C.warm, 1.2);
    text(f, `顶点 (${round3(vx)}, ${round3(vy)})`, v.sx(vx) + 8, v.sy(vy) - 10, { color: C.warm });

    const disc = b * b - 4 * a * c;
    const roots = disc >= 0
      ? [round3((-b - Math.sqrt(disc)) / (2 * a)), round3((-b + Math.sqrt(disc)) / (2 * a))]
      : [];
    roots.forEach((r) => {
      dot(f, v.sx(r), v.sy(0), 6, C.green);
      text(f, `x=${r}`, v.sx(r), v.sy(0) + 22, { align: 'center', color: C.green, font: '12px sans-serif' });
    });

    footnotes(f, [
      `y = ${a}x² ${b >= 0 ? '+ ' + b : '- ' + Math.abs(b)}x ${c >= 0 ? '+ ' + c : '- ' + Math.abs(c)}，判别式 Δ = b²-4ac = ${round3(disc)}`,
      roots.length === 2 ? `两个实根：${roots[0]}、${roots[1]}（Δ > 0）` : roots.length === 1 ? '一个重根（Δ = 0）' : '无实根（Δ < 0）',
      a > 0 ? 'a > 0：开口向上，顶点是最小值' : 'a < 0：开口向下，顶点是最大值',
    ]);
    heading(f, '二次函数：抛物线与顶点');
  },
});

/** I04 多项式求根。 */
const polynomialRoots = defineViz({
  slug: 'polynomial-roots',
  title: '多项式求根',
  params: {
    a: { type: 'range', min: -6, max: 6, default: 0, step: 0.5, label: 'x² 系数 a' },
    b: { type: 'range', min: -8, max: 8, default: -3, step: 0.5, label: 'x 系数 b' },
    c: { type: 'range', min: -10, max: 10, default: 2, label: '常数 c' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 0);
    const b = num(params, 'b', -3);
    const c = num(params, 'c', 2);
    const fn = (x: number): number => x * x * x + a * x * x + b * x + c;
    const v = view(f, { xMin: -5, xMax: 5, yMin: -12, yMax: 12, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });
    curve(f, v, fn, { color: C.accent, lw: 2.5 });

    const roots = findRoots(fn, -5, 5);
    roots.forEach((r) => {
      dot(f, v.sx(r), v.sy(0), 6, C.warm);
      text(f, formatRoot(r), v.sx(r), v.sy(0) + 22, { align: 'center', color: C.warm, font: '12px sans-serif' });
    });

    footnotes(f, [
      `P(x) = x³ ${a !== 0 ? `${a > 0 ? '+ ' + a : '- ' + Math.abs(a)}x² ` : ''}${b >= 0 ? '+ ' + b : '- ' + Math.abs(b)}x ${c >= 0 ? '+ ' + c : '- ' + Math.abs(c)}`,
      `在 [-5, 5] 内找到 ${roots.length} 个实根：${roots.map(formatRoot).join('、') || '无'}`,
      '曲线穿过 x 轴的位置就是实根；奇数次多项式至少有一个实根（代数基本定理）',
    ]);
    heading(f, '多项式求根：曲线与 x 轴的交点');
  },
});

/** 根的文字表示（尝试识别整数根）。 */
function formatRoot(r: number): string {
  const near = Math.round(r);
  if (Math.abs(r - near) < 1e-3) return String(near);
  return r.toFixed(3);
}

/** I05 韦达公式。 */
const vietaFormulas = defineViz({
  slug: 'vieta-formulas',
  title: '韦达公式深化',
  params: {
    r1: { type: 'range', min: -6, max: 6, default: 2, step: 0.5, label: '根 x₁' },
    r2: { type: 'range', min: -6, max: 6, default: -3, step: 0.5, label: '根 x₂' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const r1 = num(params, 'r1', 2);
    const r2 = num(params, 'r2', -3);
    const s = r1 + r2;
    const p = r1 * r2;
    const fn = (x: number): number => x * x - s * x + p;
    const v = view(f, { xMin: Math.min(r1, r2) - 3, xMax: Math.max(r1, r2) + 3, yMin: -8, yMax: 12, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    curve(f, v, fn, { color: C.accent, lw: 2.5 });
    dot(f, v.sx(r1), v.sy(0), 6, C.warm);
    dot(f, v.sx(r2), v.sy(0), 6, C.green);
    text(f, `x₁ = ${r1}`, v.sx(r1), v.sy(0) + 22, { align: 'center', color: C.warm, font: '12px sans-serif' });
    text(f, `x₂ = ${r2}`, v.sx(r2), v.sy(0) + 22, { align: 'center', color: C.green, font: '12px sans-serif' });

    const mid = (r1 + r2) / 2;
    dot(f, v.sx(mid), v.sy(fn(mid)), 4, C.dim);
    seg(f, v.sx(mid), v.sy(0), v.sx(mid), v.sy(fn(mid)), C.dim, 1.2);

    const pretty = (x: number): string => (x >= 0 ? `+ ${x}` : `- ${Math.abs(x)}`);
    footnotes(f, [
      `方程 x² ${pretty(-s)}x ${pretty(p)} = 0 的两根为 ${r1} 与 ${r2}`,
      `韦达定理：x₁ + x₂ = -b/a = ${round3(s)}（红绿两点中点 ${round3(mid)}），x₁·x₂ = c/a = ${round3(p)}`,
      '知道两根就能唯一确定二次多项式（首项系数固定时）',
    ]);
    heading(f, '韦达公式：根与系数的关系');
  },
});

/** I06 部分分式。 */
const partialFractions = defineViz({
  slug: 'partial-fractions',
  title: '部分分式',
  params: {
    a: { type: 'range', min: -4, max: 4, default: -3, step: 0.5, label: '极点 a' },
    b: { type: 'range', min: -4, max: 4, default: 1, step: 0.5, label: '极点 b' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    let a = num(params, 'a', -3);
    let b = num(params, 'b', 1);
    if (Math.abs(a - b) < 0.6) b = a + 1.5;
    const A = 1 / (a - b);
    const B = 1 / (b - a);
    const v = view(f, { xMin: -6, xMax: 6, yMin: -6, yMax: 6, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });
    curve(f, v, (x) => 1 / ((x - a) * (x - b)), { color: C.accent, lw: 2.5 });
    curve(f, v, (x) => A / (x - a), { color: C.warm, lw: 1.4, dash: [5, 4] });
    curve(f, v, (x) => B / (x - b), { color: C.green, lw: 1.4, dash: [5, 4] });
    seg(f, v.sx(a), v.sy(v.yMin), v.sx(a), v.sy(v.yMax), C.hot, 1.2);
    seg(f, v.sx(b), v.sy(v.yMin), v.sx(b), v.sy(v.yMax), C.hot, 1.2);
    text(f, `x=${a}`, v.sx(a) + 4, 56, { color: C.hot, font: '12px sans-serif' });
    text(f, `x=${b}`, v.sx(b) + 4, 56, { color: C.hot, font: '12px sans-serif' });

    footnotes(f, [
      `1/((x-${a})(x-${b})) = ${round3(A)}/(x-${a}) + ${round3(B)}/(x-${b})`,
      '实线是原式，橙色与绿色虚线是拆分后的两项 —— 它们之和等于原式',
      '拆分方法：两边同乘分母后代入极点求系数（遮盖法）',
    ]);
    heading(f, '部分分式分解');
  },
});

/** I07 有理渐近线。 */
const rationalAsymptotes = defineViz({
  slug: 'rational-asymptotes',
  title: '有理渐近线',
  params: {
    a: { type: 'range', min: -6, max: 6, default: 2, step: 0.5, label: '分子一次项 a' },
    b: { type: 'range', min: -6, max: 6, default: 1, step: 0.5, label: '分子常数 b' },
    c: { type: 'range', min: -4, max: 4, default: 1, step: 0.5, label: '分母一次项 c' },
    d: { type: 'range', min: -6, max: 6, default: -2, step: 0.5, label: '分母常数 d' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 2);
    const b = num(params, 'b', 1);
    const c = num(params, 'c', 1);
    const d = num(params, 'd', -2);
    const v = view(f, { xMin: -10, xMax: 10, yMin: -8, yMax: 8, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });

    const fn = (x: number): number => (a * x + b) / (c * x + d);
    curve(f, v, fn, { color: C.accent, lw: 2.5 });

    const vertical = Math.abs(c) < 1e-6 ? null : -d / c;
    const horizontal = Math.abs(c) < 1e-6 ? null : a / c;
    if (vertical !== null && vertical > v.xMin && vertical < v.xMax) {
      seg(f, v.sx(vertical), v.sy(v.yMin), v.sx(vertical), v.sy(v.yMax), C.hot, 1.4);
      text(f, `垂直渐近线 x = ${round3(vertical)}`, v.sx(vertical) + 6, 60, { color: C.hot, font: '12px sans-serif' });
    }
    if (horizontal !== null && horizontal > v.yMin && horizontal < v.yMax) {
      seg(f, v.sx(v.xMin), v.sy(horizontal), v.sx(v.xMax), v.sy(horizontal), C.green, 1.4);
      text(f, `水平渐近线 y = ${round3(horizontal)}`, v.sx(v.xMax) - 8, v.sy(horizontal) - 8, { color: C.green, align: 'right', font: '12px sans-serif' });
    }

    footnotes(f, [
      `f(x) = (${a}x ${b >= 0 ? '+ ' + b : '- ' + Math.abs(b)}) / (${c}x ${d >= 0 ? '+ ' + d : '- ' + Math.abs(d)})`,
      '垂直渐近线来自分母零点；水平渐近线是 x → ±∞ 时的极限（分子分母同次，等于系数比）',
      '长除法可得 f(x) = a/c + 余项，余项在无穷远处趋于 0',
    ]);
    heading(f, '有理函数的渐近线');
  },
});

/** I08 分段函数。 */
const piecewiseFunction = defineViz({
  slug: 'piecewise-function',
  title: '分段函数',
  params: {
    kind: { type: 'select', options: ['绝对值 |x|', '符号函数 sgn(x)', '取整 ⌊x⌋', '阶梯函数'], default: '绝对值 |x|', label: '函数' },
    shift: { type: 'range', min: -4, max: 4, default: 0, label: '平移' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'kind', '绝对值 |x|');
    const s = num(params, 'shift', 0);
    const v = view(f, { xMin: -8, xMax: 8, yMin: -5, yMax: 6, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });

    const fn = (x: number): number => {
      const t = x - s;
      if (kind === '符号函数 sgn(x)') return Math.sign(t);
      if (kind === '取整 ⌊x⌋') return Math.floor(t);
      if (kind === '阶梯函数') return Math.floor(t / 2) * 1.5;
      return Math.abs(t);
    };
    curve(f, v, fn, { color: C.accent, lw: 2.5, samples: 800 });

    footnotes(f, [
      `f(x) = ${kind}${s !== 0 ? `，自变量平移到 x - ${s}` : ''}`,
      '分段函数由多个表达式在不同区间拼成，图像上常出现跳跃或折点',
      kind === '绝对值 |x|' ? '|x| 在 x = 0 处不可导（尖点）' : kind === '符号函数 sgn(x)' ? 'sgn(x) 在 x = 0 处有跳跃间断' : '取整函数在每个整数处跳跃，右连续',
    ]);
    heading(f, `分段函数：${kind}`);
  },
});

/** I09 函数变换。 */
const functionTransform = defineViz({
  slug: 'function-transform',
  title: '函数变换',
  params: {
    shape: { type: 'select', options: ['平方 x²', '正弦 sin x'], default: '平方 x²', label: '母函数' },
    a: { type: 'range', min: -2, max: 2, default: 1, step: 0.25, label: '纵向缩放 a' },
    k: { type: 'range', min: 0.5, max: 3, default: 1, step: 0.25, label: '横向缩放 k' },
    dx: { type: 'range', min: -4, max: 4, default: 0, label: '左右平移' },
    dy: { type: 'range', min: -4, max: 4, default: 0, label: '上下平移' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const shape = str(params, 'shape', '平方 x²');
    const a = num(params, 'a', 1);
    const k = num(params, 'k', 1);
    const dx = num(params, 'dx', 0);
    const dy = num(params, 'dy', 0);
    const v = view(f, { xMin: -8, xMax: 8, yMin: -6, yMax: 8, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });

    const base = shape === '正弦 sin x' ? (x: number): number => Math.sin(x) : (x: number): number => x * x;
    curve(f, v, base, { color: C.dim, lw: 1.4, dash: [5, 4] });
    curve(f, v, (x) => a * base(k * (x - dx)) + dy, { color: C.accent, lw: 2.5 });

    footnotes(f, [
      `g(x) = ${a} · f(${k}(x ${dx >= 0 ? '- ' + dx : '+ ' + Math.abs(dx)})) ${dy >= 0 ? '+ ' + dy : '- ' + Math.abs(dy)}（灰色虚线是母函数 f）`,
      'a 纵向拉伸/翻转，k 横向压缩，dx 左右平移，dy 上下平移 —— 变换可任意组合',
      '口诀：加在括号内左右反向平移，乘在函数外纵向伸缩',
    ]);
    heading(f, '函数变换：平移、伸缩与反射');
  },
});

/** I10 复合函数。 */
const compositeFunction = defineViz({
  slug: 'composite-function',
  title: '复合函数',
  params: {
    inner: { type: 'select', options: ['x²', 'sin x', 'x - 2'], default: 'x²', label: '内层 g(x)' },
    outer: { type: 'select', options: ['sin', '平方', '取绝对值'], default: 'sin', label: '外层 f(u)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const inner = str(params, 'inner', 'x²');
    const outer = str(params, 'outer', 'sin');
    const g = (x: number): number => (inner === 'sin x' ? Math.sin(x) : inner === 'x - 2' ? x - 2 : x * x);
    const fo = (u: number): number => (outer === '平方' ? u * u : outer === '取绝对值' ? Math.abs(u) : Math.sin(u));
    const v = view(f, { xMin: -6, xMax: 6, yMin: -6, yMax: 6, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });
    curve(f, v, g, { color: C.dim, lw: 1.4, dash: [5, 4] });
    curve(f, v, (x) => fo(g(x)), { color: C.accent, lw: 2.5 });

    footnotes(f, [
      `g(x) = ${inner}（灰虚线），f(u) = ${outer}，复合函数 h(x) = f(g(x))（蓝线）`,
      '复合顺序不能交换：f(g(x)) 与 g(f(x)) 一般是不同的函数',
      '定义域要同时满足内层可算、外层可算 —— 这是"复合"的关键约束',
    ]);
    heading(f, '复合函数：函数套函数');
  },
});

/** I11 反函数。 */
const inverseFunction = defineViz({
  slug: 'inverse-function',
  title: '反函数',
  params: {
    kind: { type: 'select', options: ['立方 x³', '指数 e^x', '线性 2x+1'], default: '立方 x³', label: '函数 f' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'kind', '立方 x³');
    const v = view(f, { xMin: -6, xMax: 6, yMin: -6, yMax: 6, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });
    poly(f, [[v.sx(v.xMin), v.sy(v.yMin)], [v.sx(v.xMax), v.sy(v.yMax)]], { stroke: C.dim, lw: 1.2, dash: [6, 4] });

    let fn: (x: number) => number;
    let inv: (x: number) => number;
    let label: string;
    if (kind === '指数 e^x') {
      fn = (x) => Math.exp(x);
      inv = (x) => Math.log(x);
      label = 'f(x) = eˣ，f⁻¹(x) = ln x';
    } else if (kind === '线性 2x+1') {
      fn = (x) => 2 * x + 1;
      inv = (x) => (x - 1) / 2;
      label = 'f(x) = 2x + 1，f⁻¹(x) = (x-1)/2';
    } else {
      fn = (x) => x * x * x;
      inv = (x) => Math.cbrt(x);
      label = 'f(x) = x³，f⁻¹(x) = ∛x';
    }
    curve(f, v, fn, { color: C.accent, lw: 2.5 });
    curve(f, v, inv, { color: C.warm, lw: 2.5 });

    const px = 1.6;
    const py = fn(px);
    dot(f, v.sx(px), v.sy(py), 5, C.green);
    dot(f, v.sx(py), v.sy(px), 5, C.hot);
    poly(f, [[v.sx(px), v.sy(py)], [v.sx(py), v.sy(py)], [v.sx(py), v.sy(px)]], { stroke: C.green, lw: 1, dash: [4, 3] });

    footnotes(f, [
      label,
      '反函数图像与原函数关于 y = x 对称（灰色虚线）；点 (x, y) 与 (y, x) 互相交换',
      '只有当 f 是一一映射时反函数才存在（水平线检验）',
    ]);
    heading(f, '反函数：关于 y = x 的镜像');
  },
});

/** I12 不等式。 */
const inequalities = defineViz({
  slug: 'inequalities',
  title: '不等式',
  params: {
    a: { type: 'range', min: -3, max: 3, default: 1, step: 0.5, label: '二次系数 a' },
    b: { type: 'range', min: -8, max: 8, default: -2, step: 0.5, label: '一次系数 b' },
    c: { type: 'range', min: -10, max: 10, default: -3, label: '常数 c' },
    mode: { type: 'select', options: ['> 0', '< 0'], default: '> 0', label: '求解' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    let a = num(params, 'a', 1);
    if (Math.abs(a) < 0.3) a = 0.5;
    const b = num(params, 'b', -2);
    const c = num(params, 'c', -3);
    const mode = str(params, 'mode', '> 0');
    const fn = (x: number): number => a * x * x + b * x + c;
    const v = view(f, { xMin: -8, xMax: 8, yMin: -12, yMax: 12, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });

    // 先高亮满足不等式的 x 区间
    const disc = b * b - 4 * a * c;
    const roots = disc >= 0 ? [(-b - Math.sqrt(disc)) / (2 * a), (-b + Math.sqrt(disc)) / (2 * a)].sort((p, q) => p - q) : [];
    const positiveOutside = a > 0;
    for (let px = 0; px < w; px += 2) {
      const x = v.ix(px);
      const y = fn(x);
      const ok = mode === '> 0' ? y > 0 : y < 0;
      if (!ok) continue;
      f.ctx.save();
      f.ctx.fillStyle = 'rgba(72,187,120,0.14)';
      f.ctx.fillRect(px, v.sy(v.yMax), 2, v.sy(v.yMin) - v.sy(v.yMax));
      f.ctx.restore();
    }
    curve(f, v, fn, { color: C.accent, lw: 2.5 });
    roots.forEach((r) => {
      dot(f, v.sx(r), v.sy(0), 5, C.warm);
      text(f, round3(r).toString(), v.sx(r), v.sy(0) + 22, { align: 'center', color: C.warm, font: '12px sans-serif' });
    });

    const solution = disc < 0
      ? (mode === '> 0' ? (a > 0 ? '全体实数 R' : '空集 ∅') : (a > 0 ? '空集 ∅' : '全体实数 R'))
      : mode === '> 0'
        ? (positiveOutside ? `x < ${round3(roots[0])} 或 x > ${round3(roots[1])}` : `${round3(roots[0])} < x < ${round3(roots[1])}`)
        : (positiveOutside ? `${round3(roots[0])} < x < ${round3(roots[1])}` : `x < ${round3(roots[0])} 或 x > ${round3(roots[1])}`);
    footnotes(f, [
      `解 ${a}x² ${b >= 0 ? '+ ' + b : '- ' + Math.abs(b)}x ${c >= 0 ? '+ ' + c : '- ' + Math.abs(c)} ${mode}`,
      `判别式 Δ = ${round3(disc)}，解集：${solution}（绿色区域）`,
      '二次不等式的解集由开口方向与根的位置共同决定，画图观察最直观',
    ]);
    heading(f, '二次不等式的解集');
  },
});

/** I13 连分数。 */
const continuedFraction = defineViz({
  slug: 'continued-fraction',
  title: '连分数',
  params: {
    n: { type: 'range', min: 2, max: 40, default: 10, label: '根号内的数 N' },
    depth: { type: 'range', min: 1, max: 8, default: 5, label: '展开层数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.max(2, Math.round(num(params, 'n', 10)));
    const depth = Math.round(num(params, 'depth', 5));
    const target = Math.sqrt(n);

    // 连分数展开：√N = a0 + 1/(a1 + 1/(a2 + ...))
    const terms: number[] = [];
    let m = 0;
    let d = 1;
    let a0 = Math.floor(target);
    let a = a0;
    for (let i = 0; i < depth; i++) {
      terms.push(a);
      m = d * a - m;
      d = (n - m * m) / d;
      if (d === 0) break;
      a = Math.floor((a0 + m) / d);
    }
    // 由连分数反向求收敛分数
    let nume = 1;
    let deno = 1;
    for (let i = terms.length - 1; i >= 1; i--) {
      const t = nume;
      nume = terms[i] * nume + deno;
      deno = t;
    }
    const p = terms[0] * nume + deno;
    const q = nume;

    const v = view(f, { xMin: target - 1.2, xMax: target + 1.2, yMin: 0, yMax: 1, inset: 40 });
    const convergents: Array<{ p: number; q: number; value: number }> = [];
    let pk = 1;
    let pk1 = terms[0];
    let qk = 0;
    let qk1 = 1;
    convergents.push({ p: pk1, q: qk1, value: pk1 / qk1 });
    for (let i = 1; i < terms.length; i++) {
      const np = terms[i] * pk1 + pk;
      const nq = terms[i] * qk1 + qk;
      pk = pk1;
      qk = qk1;
      pk1 = np;
      qk1 = nq;
      convergents.push({ p: np, q: nq, value: np / nq });
    }

    // 数轴：交替逼近 √N 的收敛分数
    const baseY = f.h - 118;
    seg(f, v.sx(v.xMin), baseY, v.sx(v.xMax), baseY, C.dim, 1.5);
    seg(f, v.sx(target), baseY - 34, v.sx(target), baseY + 34, C.green, 2);
    text(f, `√${n} ≈ ${target.toFixed(5)}`, v.sx(target), baseY - 42, { align: 'center', color: C.green, font: '13px sans-serif' });
    convergents.forEach((c, i) => {
      const x = v.sx(Math.min(v.xMax, Math.max(v.xMin, c.value)));
      const above = i % 2 === 0;
      const y = above ? baseY - 16 : baseY + 22;
      dot(f, x, baseY, 4, PALETTE[i % PALETTE.length]);
      seg(f, x, baseY, x, y, `${PALETTE[i % PALETTE.length]}88`, 1);
      if (i < 6) text(f, `${c.p}/${c.q}`, x, above ? y - 6 : y + 14, { align: 'center', color: PALETTE[i % PALETTE.length], font: '11px sans-serif' });
    });

    // 误差曲线（对数直觉：用条形表示误差量级）
    const errTop = 56;
    const errH = 90;
    const errSlot = (w - 80) / Math.max(1, convergents.length);
    convergents.forEach((c, i) => {
      const err = Math.abs(c.value - target);
      const mag = Math.max(0, 8 + Math.log10(Math.max(err, 1e-12)));
      const bh = (mag / 9) * errH;
      const x = 40 + i * errSlot;
      f.ctx.save();
      f.ctx.fillStyle = PALETTE[i % PALETTE.length];
      f.ctx.fillRect(x + errSlot * 0.2, errTop + errH - bh, errSlot * 0.6, bh);
      f.ctx.restore();
      if (errSlot > 30) {
        text(f, err === 0 ? '0' : err.toExponential(0).replace('e-', 'e-'), x + errSlot / 2, errTop + errH + 14, { align: 'center', color: C.dim, font: '9px sans-serif' });
      }
    });
    text(f, '收敛分数与 √' + n + ' 的误差（越短越精确）', 44, errTop - 10, { color: C.dim, font: '12px sans-serif' });

    footnotes(f, [
      `√${n} = [${terms.join('; ')}…] 的连分数展开，收敛分数交替在真实值上下摆动并迅速逼近`,
      `第 ${depth} 层的 ${p}/${q} = ${(p / q).toFixed(6)}，误差 ${Math.abs(p / q - target).toExponential(2)}`,
      '连分数给出最佳有理逼近：在分母不超过 q 的所有分数中它最接近 √N',
    ]);
    heading(f, '连分数与最佳有理逼近');
  },
});

/** I14 二项式定理。 */
const binomialTheorem = defineViz({
  slug: 'binomial-theorem',
  title: '二项式定理',
  params: {
    n: { type: 'range', min: 1, max: 12, default: 6, label: '指数 n' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'n', 6));
    const coeffs: number[] = [];
    for (let k = 0; k <= n; k++) coeffs.push(binom(n, k));
    const maxC = Math.max(...coeffs);

    const barH = Math.min(160, h * 0.32);
    const top = h - 100 - barH;
    const slot = (w - 80) / coeffs.length;
    coeffs.forEach((c, k) => {
      const x = 40 + k * slot;
      const bh = (c / maxC) * barH;
      f.ctx.save();
      f.ctx.fillStyle = PALETTE[k % PALETTE.length];
      f.ctx.fillRect(x + slot * 0.15, top + barH - bh, slot * 0.7, bh);
      f.ctx.restore();
      text(f, String(c), x + slot / 2, top + barH - bh - 8, { align: 'center', color: C.fg, font: '13px sans-serif' });
      text(f, `k=${k}`, x + slot / 2, top + barH + 18, { align: 'center', color: C.dim, font: '11px sans-serif' });
    });

    const expansion = coeffs
      .map((c, k) => {
        const ap = n - k === 0 ? '' : n - k === 1 ? 'a' : `a^${n - k}`;
        const bp = k === 0 ? '' : k === 1 ? 'b' : `b^${k}`;
        const term = [ap, bp].filter(Boolean).join('');
        return c === 1 && term ? term : `${c}${term}`;
      })
      .join(' + ');
    text(f, `(a+b)^${n} = ${expansion.length > 64 ? expansion.slice(0, 61) + '…' : expansion}`, 40, 62, { color: C.fg, font: '14px Consolas, monospace' });
    footnotes(f, [
      `系数 C(${n},k) 恰好是帕斯卡三角第 ${n} 行，和为 2^${n} = ${Math.pow(2, n)}`,
      '每项来自"从 n 个括号里选 k 个取 b"，组合数就是选择方案数',
    ]);
    heading(f, '二项式定理：展开系数');
  },
});

/** I15 生成函数。 */
const generatingFunctions = defineViz({
  slug: 'generating-functions',
  title: '生成函数',
  params: {
    r: { type: 'range', min: 0.2, max: 0.9, default: 0.6, step: 0.05, label: '比值 r' },
    terms: { type: 'range', min: 4, max: 20, default: 12, label: '项数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const r = num(params, 'r', 0.6);
    const n = Math.round(num(params, 'terms', 12));
    const coeffs: number[] = [];
    let partial = 0;
    for (let k = 0; k <= n; k++) {
      const c = Math.pow(r, k);
      coeffs.push(c);
      partial += c;
    }
    const maxC = Math.max(...coeffs, 1e-9);

    const barH = Math.min(150, h * 0.3);
    const top = h - 110 - barH;
    const slot = (w - 80) / coeffs.length;
    coeffs.forEach((c, k) => {
      const x = 40 + k * slot;
      const bh = (c / maxC) * barH;
      f.ctx.save();
      f.ctx.fillStyle = C.accent;
      f.ctx.fillRect(x + slot * 0.15, top + barH - bh, slot * 0.7, bh);
      f.ctx.restore();
      text(f, `x^${k}`, x + slot / 2, top + barH + 18, { align: 'center', color: C.dim, font: '10px sans-serif' });
    });
    seg(f, 40, top - 6, w - 40, top - 6, C.green, 1.4);
    text(f, `1/(1-${r}) = ${round3(1 / (1 - r))}（级数和）`, 44, top - 14, { color: C.green, font: '13px sans-serif' });

    footnotes(f, [
      `1/(1-rx) = 1 + rx + r²x² + r³x³ + …（|r| < 1 时收敛）`,
      `前 ${n + 1} 项部分和 = ${round3(partial)}，与真值 ${round3(1 / (1 - r))} 的差 = ${round3(Math.abs(partial - 1 / (1 - r)))}`,
      '把数列"编码"成幂级数后，递推关系常化为代数运算 —— 这是生成函数法的威力',
    ]);
    heading(f, '生成函数：把数列写成幂级数');
  },
});

registerViz(
  sequences,
  linearFunction,
  quadraticFunction,
  polynomialRoots,
  vietaFormulas,
  partialFractions,
  rationalAsymptotes,
  piecewiseFunction,
  functionTransform,
  compositeFunction,
  inverseFunction,
  inequalities,
  continuedFraction,
  binomialTheorem,
  generatingFunctions,
);
