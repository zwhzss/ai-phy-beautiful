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
  seg,
  text,
  view,
} from '../canvas';

/** M46 数列深化。 */
const sequencesM46 = defineViz({
  slug: 'sequences-m46',
  title: '数列深化',
  params: {
    rule: { type: 'select', options: ['aₙ₊₁ = aₙ/2 + 1', 'aₙ₊₁ = √(aₙ·2)', 'aₙ₊₁ = aₙ·1.05', 'aₙ = n/(n+1)'], default: 'aₙ₊₁ = aₙ/2 + 1', label: '递推规则' },
    a1: { type: 'range', min: 0.5, max: 8, default: 6, step: 0.5, label: '首项 a₁' },
    terms: { type: 'range', min: 5, max: 30, default: 14, label: '项数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const rule = str(params, 'rule', 'aₙ₊₁ = aₙ/2 + 1');
    const a1 = num(params, 'a1', 6);
    const count = Math.round(num(params, 'terms', 14));
    const next = (x: number, n: number): number => {
      if (rule.startsWith('aₙ₊₁ = √')) return Math.sqrt(Math.max(0, x * 2));
      if (rule.startsWith('aₙ₊₁ = aₙ·1.05')) return x * 1.05;
      if (rule.startsWith('aₙ = n/')) return (n + 1) / (n + 2);
      return x / 2 + 1;
    };
    const seq: number[] = [a1];
    for (let i = 1; i < count; i++) seq.push(next(seq[i - 1], i));

    const v = view(f, { xMin: 0, xMax: count - 1, yMin: Math.min(0, ...seq) - 0.5, yMax: Math.max(...seq) * 1.1 + 0.5, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    poly(f, seq.map((y, i) => [v.sx(i), v.sy(y)] as [number, number]), { stroke: C.accent, lw: 2 });
    seq.forEach((y, i) => dot(f, v.sx(i), v.sy(y), 3.6, C.warm));
    // 蛛网图（aₙ₊₁ 与 aₙ 的关系）
    const limit = rule.startsWith('aₙ = n/') ? 1 : 2;
    seg(f, v.sx(0), v.sy(limit), v.sx(count - 1), v.sy(limit), C.green, 1.4);

    const converges = Math.abs(seq[seq.length - 1] - seq[seq.length - 2]) < 1e-3;
    footnotes(f, [
      `递推 ${rule}，首项 ${a1}：a_${count} = ${seq[seq.length - 1].toFixed(6)}`,
      converges ? `数列收敛，极限 ≈ ${seq[seq.length - 1].toFixed(6)}（绿色虚线）` : '数列仍在变化（可能发散或收敛较慢）',
      '递推数列的收敛性由"压缩映射"保证：若 |f\'| < 1，迭代必收敛到不动点',
    ]);
    heading(f, '递推数列与收敛');
  },
});

/** M47 级数收敛深化。 */
const seriesConvergenceM47 = defineViz({
  slug: 'series-convergence-m47',
  title: '级数收敛深化',
  params: {
    test: { type: 'select', options: ['比值判别法', '根值判别法', '比较判别法'], default: '比值判别法', label: '判别法' },
    param: { type: 'range', min: 0.2, max: 2.5, default: 0.75, step: 0.05, label: '级数参数' },
    n: { type: 'range', min: 5, max: 60, default: 25, label: '项数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const test = str(params, 'test', '比值判别法');
    const prm = num(params, 'param', 0.75);
    const n = Math.round(num(params, 'n', 25));
    const terms: number[] = [];
    for (let k = 1; k <= n; k++) {
      if (test === '根值判别法') terms.push(Math.pow(prm, k) / k);
      else if (test === '比较判别法') terms.push(1 / Math.pow(k, prm));
      else terms.push(Math.pow(prm, k));
    }
    let sum = 0;
    const partial = terms.map((t) => (sum += t));
    const ratios = terms.slice(1).map((t, i) => Math.abs(t / (terms[i] || 1)));
    const roots = terms.map((t, i) => Math.pow(Math.abs(t), 1 / (i + 1)));

    const plotH = h - 190;
    const maxSum = Math.max(...partial, 1);
    const slot = (w - 80) / n;
    terms.forEach((t, i) => {
      const x = 40 + i * slot;
      const bh = (Math.min(t, maxSum) / maxSum) * plotH;
      f.ctx.save();
      f.ctx.fillStyle = `${PALETTE[i % PALETTE.length]}99`;
      f.ctx.fillRect(x + 1, 56 + plotH - bh, Math.max(1, slot - 2), bh);
      f.ctx.restore();
    });
    const v2 = view(f, { xMin: 0, xMax: n - 1, yMin: 0, yMax: Math.max(...partial) * 1.08, inset: 40 });
    poly(f, partial.map((p, i) => [v2.sx(i), v2.sy(p)] as [number, number]), { stroke: C.warm, lw: 2.2 });

    const testValue = test === '比值判别法' ? ratios[ratios.length - 1] : test === '根值判别法' ? roots[roots.length - 1] : prm;
    const converge = testValue < 1;
    footnotes(f, [
      `${test}：判据值 → ${testValue.toFixed(4)}，${converge ? '小于 1 ⇒ 级数收敛' : '大于等于 1 ⇒ 级数发散'}`,
      `部分和 S_${n} = ${partial[n - 1].toFixed(5)}（橙色曲线为部分和的走势）`,
      '比值/根值判别法都基于"与几何级数比较"：极限小于 1 时级数比几何级数收敛得更快',
    ]);
    heading(f, `级数收敛判别：${test}`);
  },
});

/** M48 幂级数深化。 */
const powerSeriesM48 = defineViz({
  slug: 'power-series-m48',
  title: '幂级数深化',
  params: {
    op: { type: 'select', options: ['原级数', '逐项求导', '逐项积分'], default: '逐项求导', label: '操作' },
    terms: { type: 'range', min: 2, max: 14, default: 8, label: '项数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const op = str(params, 'op', '逐项求导');
    const termsN = Math.round(num(params, 'terms', 8));
    const v = view(f, { xMin: -1.2, xMax: 1.2, yMin: -4, yMax: 6, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });

    const original = (x: number): number => {
      let s = 0;
      for (let k = 0; k < termsN; k++) s += Math.pow(x, k);
      return s;
    };
    const derivative = (x: number): number => {
      let s = 0;
      for (let k = 1; k < termsN; k++) s += k * Math.pow(x, k - 1);
      return s;
    };
    const integral = (x: number): number => {
      let s = 0;
      for (let k = 0; k < termsN; k++) s += Math.pow(x, k + 1) / (k + 1);
      return s;
    };
    curve(f, v, (x) => original(x), { color: C.dim, lw: 1.6, dash: [5, 4] });
    if (op === '逐项求导') {
      curve(f, v, derivative, { color: C.warm, lw: 2.4 });
      curve(f, v, (x) => 1 / Math.pow(1 - x, 2), { color: `${C.green}88`, lw: 1.4 });
    } else if (op === '逐项积分') {
      curve(f, v, integral, { color: C.cool, lw: 2.4 });
      curve(f, v, (x) => -Math.log(1 - x), { color: `${C.green}88`, lw: 1.4 });
    } else {
      curve(f, v, original, { color: C.accent, lw: 2.4 });
      curve(f, v, (x) => 1 / (1 - x), { color: `${C.green}88`, lw: 1.4 });
    }

    footnotes(f, [
      op === '逐项求导' ? 'Σ nx^(n-1) = 1/(1-x)²（绿色）—— 逐项求导保持收敛半径不变' : op === '逐项积分' ? 'Σ x^(n+1)/(n+1) = -ln(1-x)（绿色）' : 'Σ x^n = 1/(1-x)（绿色），收敛半径 R = 1',
      '幂级数在收敛区间内可以逐项求导和逐项积分，收敛半径不变（端点另议）',
      '这个性质让幂级数成为"无穷次可导的表示"，也是解微分方程（幂级数解法）的工具',
    ]);
    heading(f, `幂级数：${op}`);
  },
});

/** M49 泰勒级数深化。 */
const taylorM49 = defineViz({
  slug: 'taylor-m49',
  title: '泰勒级数深化',
  params: {
    func: { type: 'select', options: ['sin x', 'e^x', 'ln(1+x)', '1/(1-x)'], default: 'sin x', label: '函数' },
    terms: { type: 'range', min: 1, max: 14, default: 6, label: '项数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const func = str(params, 'func', 'sin x');
    const termsN = Math.round(num(params, 'terms', 6));
    const v = view(f, { xMin: -6, xMax: 6, yMin: -3.5, yMax: 3.5, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });

    const fn = func === 'e^x' ? (x: number): number => Math.exp(x)
      : func === 'ln(1+x)' ? (x: number): number => Math.log(1 + x)
        : func === '1/(1-x)' ? (x: number): number => 1 / (1 - x)
          : (x: number): number => Math.sin(x);
    const factorial = (k: number): number => (k <= 1 ? 1 : k * factorial(k - 1));
    const coeff = (k: number): number => {
      if (func === 'sin x') return k % 2 === 1 ? Math.pow(-1, (k - 1) / 2) / factorial(k) : 0;
      if (func === 'e^x') return 1 / factorial(k);
      if (func === 'ln(1+x)') return k === 0 ? 0 : Math.pow(-1, k - 1) / k;
      return 1;
    };
    // 逐项累加，展示逼近过程
    for (let m = Math.max(1, termsN - 3); m <= termsN; m++) {
      const partial = (x: number): number => {
        let s = 0;
        for (let k = 0; k < m; k++) s += coeff(k) * Math.pow(x, k);
        return s;
      };
      curve(f, v, partial, { color: m === termsN ? C.accent : `${PALETTE[m % PALETTE.length]}99`, lw: m === termsN ? 2.6 : 1.4 });
    }
    curve(f, v, fn, { color: C.dim, lw: 1.6, dash: [5, 4] });
    dot(f, v.sx(0), v.sy(fn(0)), 5, C.warm);

    // 收敛半径
    const radius = func === 'ln(1+x)' || func === '1/(1-x)' ? 1 : Infinity;
    if (Number.isFinite(radius)) {
      seg(f, v.sx(-radius), v.sy(v.yMin), v.sx(-radius), v.sy(v.yMax), C.hot, 1.6, );
      seg(f, v.sx(radius), v.sy(v.yMin), v.sx(radius), v.sy(v.yMax), C.hot, 1.6);
    }

    footnotes(f, [
      `${func} 的麦克劳林级数（蓝线为取前 ${termsN} 项的逼近，灰虚线为原函数）`,
      Number.isFinite(radius) ? `收敛半径 R = ${radius}（红色竖线之外级数发散）` : '整函数：收敛半径无穷大，在整个实轴上收敛',
      '泰勒级数的收敛半径由"离展开点最近的奇点"决定 —— 复分析给出了统一的解释',
    ]);
    heading(f, `泰勒级数：${func}`);
  },
});

/** M50 拉普拉斯变换。 */
const laplace = defineViz({
  slug: 'laplace',
  title: '拉普拉斯变换',
  params: {
    func: { type: 'select', options: ['e^(-at)', 'sin(ωt)', 't', '1'], default: 'e^(-at)', label: '原函数 f(t)' },
    a: { type: 'range', min: 0.2, max: 3, default: 1, step: 0.1, label: '参数 a / ω' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const func = str(params, 'func', 'e^(-at)');
    const a = num(params, 'a', 1);

    // 时域（左）与 s 域（右）
    const vT = view(f, { xMin: 0, xMax: 5, yMin: -1.4, yMax: 2.2, inset: 34, insetRight: 16 });
    const vS = view(f, { xMin: -0.5, xMax: 5, yMin: -1.4, yMax: 2.2, inset: 34 });

    const fn = func === 'sin(ωt)' ? (t: number): number => Math.sin(a * t)
      : func === 't' ? (t: number): number => t
        : func === '1' ? (_t: number): number => 1
          : (t: number): number => Math.exp(-a * t);
    // F(s) = ∫₀^∞ f(t)e^{-st}dt
    const F = (s: number): number => {
      let sum = 0;
      const steps = 600;
      const dt = 20 / steps;
      for (let i = 0; i < steps; i++) {
        const t = (i + 0.5) * dt;
        sum += fn(t) * Math.exp(-s * t) * dt;
      }
      return sum;
    };

    const half = w / 2;
    text(f, '时域 f(t)', 34, 30, { color: C.dim, font: '12px sans-serif' });
    text(f, 's 域 F(s) = ∫f(t)e^(-st)dt', half + 34, 30, { color: C.dim, font: '12px sans-serif' });
    seg(f, half - 8, 46, half - 8, h - 46, 'rgba(160,174,192,0.3)', 1);

    // 时域曲线
    const tPts: Array<[number, number]> = [];
    for (let i = 0; i <= 200; i++) {
      const t = (i / 200) * 5;
      tPts.push([vT.sx(t) * 0.48, vT.sy(fn(t))]);
    }
    poly(f, tPts, { stroke: C.accent, lw: 2.2 });
    // s 域曲线
    const sPts: Array<[number, number]> = [];
    for (let i = 0; i <= 200; i++) {
      const s = (i / 200) * 5;
      const val = F(s);
      if (!Number.isFinite(val)) continue;
      sPts.push([half + (vS.sx(s) - vS.sx(-0.5)) * 0.46, vS.sy(Math.max(-1.4, Math.min(2.2, val)))]);
    }
    poly(f, sPts, { stroke: C.warm, lw: 2.2 });

    const formula = func === 'e^(-at)' ? `F(s) = 1/(s + ${a})` : func === 'sin(ωt)' ? `F(s) = ${a}/(s² + ${(a * a).toFixed(2)})` : func === 't' ? 'F(s) = 1/s²' : 'F(s) = 1/s';
    footnotes(f, [
      `${formula}（解析解）`,
      '拉普拉斯变换把微分方程变成代数方程：∫f(t)e^(-st)dt 是"用指数衰减核做投影"',
      '极点位置决定系统行为：s 平面左半平面极点 ⇒ 稳定；虚轴上极点 ⇒ 持续振荡',
    ]);
    heading(f, '拉普拉斯变换：从时域到 s 域');
  },
});

/** M51 勒让德多项式。 */
const legendrePolynomials = defineViz({
  slug: 'legendre-polynomials',
  title: '勒让德多项式',
  params: {
    order: { type: 'range', min: 0, max: 8, default: 4, label: '阶数 n' },
    showAll: { type: 'select', options: ['显示到 n 阶', '仅 n 阶'], default: '仅 n 阶', label: '显示' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const order = Math.round(num(params, 'order', 4));
    const showAll = str(params, 'showAll', '仅 n 阶') === '显示到 n 阶';
    const v = view(f, { xMin: -1.05, xMax: 1.05, yMin: -1.1, yMax: 1.1, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });

    const legendre = (n: number): ((x: number) => number) => {
      if (n === 0) return () => 1;
      if (n === 1) return (x) => x;
      let p0: (x: number) => number = () => 1;
      let p1: (x: number) => number = (x) => x;
      for (let k = 2; k <= n; k++) {
        const a = p0;
        const b = p1;
        p0 = b;
        p1 = (x) => ((2 * k - 1) * x * b(x) - (k - 1) * a(x)) / k;
      }
      return p1;
    };

    if (showAll) {
      for (let n = 0; n <= order; n++) {
        curve(f, v, legendre(n), { color: PALETTE[n % PALETTE.length], lw: 1.6 });
      }
    } else {
      curve(f, v, legendre(order), { color: C.accent, lw: 2.6 });
    }

    // 正交性验证：∫₋₁¹ PₘPₙdx
    const inner = (m: number, n2: number): number => {
      const fm = legendre(m);
      const fn2 = legendre(n2);
      let sum = 0;
      const steps = 400;
      for (let i = 0; i < steps; i++) {
        const x = -1 + ((i + 0.5) * 2) / steps;
        sum += fm(x) * fn2(x) * (2 / steps);
      }
      return sum;
    };
    footnotes(f, [
      `P_${order}(x) 由递推式 (n+1)P_{n+1} = (2n+1)xP_n - nP_{n-1} 生成`,
      `正交性：∫₋₁¹ P_${order}·P_${order - 1} dx = ${inner(order, order - 1).toExponential(2)} ≈ 0`,
      `归一化：∫₋₁¹ P_${order}² dx = 2/(2·${order}+1) = ${(2 / (2 * order + 1)).toFixed(4)}`,
      '勒让德多项式是球坐标下拉普拉斯方程解的角度部分，用于静电势、引力场、球谐展开',
    ]);
    heading(f, '勒让德多项式与正交性');
  },
});

/** M52 贝塞尔函数。 */
const besselFunctions = defineViz({
  slug: 'bessel-functions',
  title: '贝塞尔函数',
  params: {
    order: { type: 'range', min: 0, max: 6, default: 1, label: '阶数 n' },
    xMax: { type: 'range', min: 5, max: 30, default: 16, label: 'x 范围' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const order = Math.round(num(params, 'order', 1));
    const xMax = Math.round(num(params, 'xMax', 16));
    const v = view(f, { xMin: 0, xMax: xMax, yMin: -0.75, yMax: 1.05, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });

    // J_n(x) = Σ (-1)^k /(k!(k+n)!) (x/2)^(2k+n)
    const besselJ = (n: number): ((x: number) => number) => (x: number): number => {
      let sum = 0;
      const half = x / 2;
      for (let k = 0; k < 24; k++) {
        let factK = 1;
        let factNK = 1;
        for (let i = 2; i <= k; i++) factK *= i;
        for (let i = 2; i <= k + n; i++) factNK *= i;
        const term = (Math.pow(-1, k) * Math.pow(half, 2 * k + n)) / (factK * factNK);
        sum += term;
        if (Math.abs(term) < 1e-14) break;
      }
      return sum;
    };

    curve(f, v, besselJ(order), { color: C.accent, lw: 2.6 });
    curve(f, v, besselJ(0), { color: `${C.dim}88`, lw: 1.4, dash: [5, 4] });
    for (let n = 1; n <= 6; n++) {
      if (n === order) continue;
      curve(f, v, besselJ(n), { color: `${PALETTE[n % PALETTE.length]}55`, lw: 1.2 });
    }

    footnotes(f, [
      `J_${order}(x)：满足贝塞尔方程 x²y'' + xy' + (x² - ${order}²)y = 0`,
      '振荡衰减（幅度 ~ √(2/(πx))），有无穷多个零点 —— 圆膜振动的各阶模态',
      '贝塞尔函数描述圆柱/球对称问题：鼓面振动、光纤模式、热传导、电磁波导',
    ]);
    heading(f, '贝塞尔函数');
  },
});

/** M53 伽马函数。 */
const gammaFunction = defineViz({
  slug: 'gamma-function',
  title: '伽马函数',
  params: {
    x: { type: 'range', min: 0.1, max: 6, default: 2.5, step: 0.05, label: '自变量 x' },
    terms: { type: 'range', min: 20, max: 4000, default: 400, step: 20, label: '积分精度（段数）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const x0 = num(params, 'x', 2.5);
    const termsN = Math.round(num(params, 'terms', 400));
    const v = view(f, { xMin: 0, xMax: 6, yMin: -12, yMax: 30, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });

    // Γ(x) = ∫₀^∞ t^(x-1)e^(-t)dt（数值积分）+ 递推 Γ(x+1) = xΓ(x)
    const gammaInt = (x: number): number => {
      if (x <= 0) return NaN;
      let sum = 0;
      const tMax = Math.max(30, x * 8);
      const dt = tMax / termsN;
      for (let i = 0; i < termsN; i++) {
        const t = (i + 0.5) * dt;
        sum += Math.pow(t, x - 1) * Math.exp(-t) * dt;
      }
      return sum;
    };
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 240; i++) {
      const x = 0.06 + (i / 240) * 5.9;
      const val = gammaInt(x);
      if (!Number.isFinite(val) || val > 30) continue;
      pts.push([v.sx(x), v.sy(val)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.4 });

    const gx = gammaInt(x0);
    dot(f, v.sx(x0), v.sy(Math.min(30, gx)), 5.5, C.warm);
    const nearestInt = Math.round(x0);
    const factorial = (k: number): number => (k <= 1 ? 1 : k * factorial(k - 1));
    footnotes(f, [
      `Γ(${x0.toFixed(2)}) = ${gx.toFixed(5)}（数值积分），Γ 把阶乘推广到实数与复数`,
      `递推关系 Γ(x+1) = xΓ(x)，因此 Γ(n+1) = n!：例如 ${nearestInt}! = ${factorial(nearestInt)}，Γ(${nearestInt + 1}) = ${gammaInt(nearestInt + 1).toFixed(3)}`,
      '伽马函数在 0, -1, -2, … 处有极点（图像趋于无穷），这是"阶乘无法自然定义的负整数点"',
    ]);
    heading(f, '伽马函数：阶乘的推广');
  },
});

registerViz(
  sequencesM46,
  seriesConvergenceM47,
  powerSeriesM48,
  taylorM49,
  laplace,
  legendrePolynomials,
  besselFunctions,
  gammaFunction,
);
