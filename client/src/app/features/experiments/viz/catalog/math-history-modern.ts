/**
 * 数学史里程碑 · 第三批（T28–T40：分析严密化与抽象化的开端）。
 */
import { defineViz, num, str, VizFrame } from '../types';
import { registerViz } from '../registry';
import { C, cells, curve, dot, equalView, footnotes, grid, heading, poly, rng, scatter, seg, text, view } from '../canvas';

/** 阶乘（小规模）。 */
function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// ---------------------------------------------------------------- T28
/** T28 泰勒公式。 */
const taylorFormulaViz = defineViz({
  slug: 'taylor-formula-history',
  title: '泰勒公式',
  params: {
    order: { type: 'range', min: 1, max: 12, default: 4, label: '多项式阶数' },
    kind: { type: 'select', options: ['cos x', 'sin x', 'e^x', 'ln(1+x)'], default: 'cos x', label: '展开函数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const order = Math.max(1, Math.round(num(params, 'order', 4)));
    const kind = str(params, 'kind', 'cos x');

    const target = (x: number): number =>
      kind === 'cos x' ? Math.cos(x) : kind === 'sin x' ? Math.sin(x) : kind === 'e^x' ? Math.exp(x) : Math.log(1 + x);

    // 泰勒多项式（在 0 处展开）
    const taylor = (x: number): number => {
      let s = 0;
      if (kind === 'cos x') {
        for (let k = 0; k <= order; k++) {
          const n = 2 * k;
          if (n > order + 1) break;
          s += (Math.pow(-1, k) * Math.pow(x, n)) / factorial(n);
        }
      } else if (kind === 'sin x') {
        for (let k = 0; k <= order; k++) {
          const n = 2 * k + 1;
          if (n > order + 1) break;
          s += (Math.pow(-1, k) * Math.pow(x, n)) / factorial(n);
        }
      } else if (kind === 'e^x') {
        for (let n = 0; n <= order; n++) s += Math.pow(x, n) / factorial(n);
      } else {
        for (let n = 1; n <= order; n++) s += (Math.pow(-1, n + 1) * Math.pow(x, n)) / n;
      }
      return s;
    };

    const xMax = kind === 'ln(1+x)' ? 1.9 : 6;
    const yMin = kind === 'e^x' ? -2 : -3;
    const yMax = kind === 'e^x' ? 60 : 3;
    const v = view(f, { xMin: kind === 'ln(1+x)' ? -0.6 : -xMax, xMax, yMin, yMax, inset: 50 });
    grid(f, v, { divisions: 6, ticks: true });
    seg(f, v.sx(v.xMin), v.sy(0), v.sx(v.xMax), v.sy(0), { color: C.dim, lw: 1.2 } as never);
    curve(f, v, target, { color: C.accent, lw: 2.6 } as never);
    curve(f, v, taylor, { color: C.warm, lw: 2, dash: [7, 4] } as never);

    const err = Math.abs(target(1) - taylor(1));
    text(f, `${kind} 的 ${order} 阶泰勒多项式`, 50, 48, {
      font: 'bold 16px "Times New Roman", serif', color: C.warm,
    });
    text(f, `x = 1 处：真值 ${target(1).toFixed(6)}　逼近 ${taylor(1).toFixed(6)}`, 50, 74, {
      color: C.fg, font: '13px Consolas, monospace',
    });
    text(f, `误差 = ${err.toExponential(2)}`, 50, 98, {
      color: err < 0.01 ? C.green : C.hot, font: '13px Consolas, monospace',
    });

    heading(f, '泰勒公式：用多项式逼近函数');
    footnotes(f, [
      '实线为原函数，虚线为在 x = 0 处展开的泰勒多项式',
      '阶数越高，吻合区间越宽——多项式在展开点附近「模仿」了函数的所有阶导数',
      '这是数值计算、误差估计与理论分析的共同基石',
    ]);
  },
});

// ---------------------------------------------------------------- T29
/** T29 斯特林公式。 */
const stirlingApproximationViz = defineViz({
  slug: 'stirlings-approximation',
  title: '斯特林公式',
  params: {
    n: { type: 'range', min: 1, max: 12, default: 8, label: '参数 n' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const nMax = Math.max(2, Math.round(num(params, 'n', 8)));

    const ns: number[] = [];
    for (let i = 1; i <= nMax; i++) ns.push(i);

    const stirling = (n: number): number => Math.sqrt(2 * Math.PI * n) * Math.pow(n / Math.E, n);
    const ratios = ns.map((n) => factorial(n) / stirling(n));

    // 比值趋近 1
    const v = view(f, { xMin: 0, xMax: nMax + 1, yMin: 0.8, yMax: 1.3, inset: 52 });
    grid(f, v, { divisions: 5, ticks: true });
    seg(f, v.sx(0), v.sy(1), v.sx(nMax + 1), v.sy(1), { color: C.warm, lw: 1.6, dash: [6, 4] } as never);
    for (let i = 1; i < ns.length; i++) {
      seg(f, v.sx(ns[i - 1]), v.sy(ratios[i - 1]), v.sx(ns[i]), v.sy(ratios[i]), { color: C.accent, lw: 2 } as never);
    }
    scatter(f, v, ns.map((n, i) => [n, ratios[i]] as [number, number]), { r: 4, color: C.green });

    const n0 = ns[ns.length - 1];
    text(f, `n! / [√(2πn)·(n/e)ⁿ]`, 50, 48, { font: 'bold 16px "Times New Roman", serif', color: C.accent });
    text(f, `n = ${n0}：n! = ${factorial(n0).toExponential(4)}`, 50, 74, {
      color: C.fg, font: '13px Consolas, monospace',
    });
    text(f, `斯特林近似 = ${stirling(n0).toExponential(4)}`, 50, 98, { color: C.fg, font: '13px Consolas, monospace' });
    text(f, `比值 = ${(factorial(n0) / stirling(n0)).toFixed(5)} → 1`, 50, 122, {
      color: C.green, font: 'bold 14px Consolas, monospace',
    });

    heading(f, '斯特林公式：把阶乘与连续函数连接起来');
    footnotes(f, [
      'n! ≈ √(2πn)·(n/e)ⁿ，相对误差随 n 增大而趋于 0（图中比值曲线逼近 1）',
      '它同时给出了 n! 的数量级：ln(n!) ≈ n ln n − n',
      '这是概率论（大偏差）、统计物理（熵）与算法分析中的标准工具',
    ]);
  },
});

// ---------------------------------------------------------------- T30
/** T30 欧拉与巴塞尔问题。 */
const baselProblemViz = defineViz({
  slug: 'basel-problem',
  title: '欧拉与巴塞尔问题',
  params: {
    terms: { type: 'range', min: 5, max: 500, default: 60, label: '累加项数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const terms = Math.max(2, Math.round(num(params, 'terms', 60)));
    const PI2_6 = (Math.PI * Math.PI) / 6;

    let s = 0;
    const partial: number[] = [];
    for (let i = 1; i <= terms; i++) {
      s += 1 / (i * i);
      partial.push(s);
    }

    const v = view(f, { xMin: 0, xMax: terms, yMin: 1, yMax: 1.8, inset: 52 });
    grid(f, v, { divisions: 4, ticks: true });
    seg(f, v.sx(0), v.sy(PI2_6), v.sx(terms), v.sy(PI2_6), { color: C.warm, lw: 1.8, dash: [6, 4] } as never);
    text(f, `π²/6 = ${PI2_6.toFixed(6)}`, v.sx(terms) - 6, v.sy(PI2_6) - 10, {
      align: 'right', color: C.warm, font: '12px system-ui',
    });
    for (let i = 1; i < partial.length; i++) {
      seg(f, v.sx(i), v.sy(partial[i - 1]), v.sx(i + 1), v.sy(partial[i]), { color: C.accent, lw: 1.8 } as never);
    }

    text(f, `Σ 1/n² （前 ${terms} 项）= ${s.toFixed(6)}`, 50, 48, {
      font: 'bold 16px "Times New Roman", serif', color: C.accent,
    });
    text(f, `与 π²/6 的偏差 = ${Math.abs(s - PI2_6).toExponential(3)}`, 50, 74, {
      color: C.green, font: '13px Consolas, monospace',
    });
    text(f, '奇数项的贡献、偶数项的贡献分别为 π²/8 与 π²/24', 50, 98, { color: C.dim, font: '13px system-ui' });

    heading(f, '巴塞尔问题：整数平方的倒数和 = π²/6');
    footnotes(f, [
      '欧拉（1734）用正弦函数的无穷乘积展开求出这个和，把整数与 π 联系了起来',
      '图中蓝色为部分和曲线，橙色虚线为极限值 π²/6 ≈ 1.644934',
      '这个结果让欧拉一举成名，也开启了用分析工具研究数论的道路',
    ]);
  },
});

// ---------------------------------------------------------------- T31
/** T31 欧拉变分法。 */
const eulerVariationsViz = defineViz({
  slug: 'euler-calculus-of-variations',
  title: '欧拉变分法',
  params: {
    bend: { type: 'range', min: -1, max: 1, step: 0.05, default: 0.5, label: '曲线弯曲度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const bend = num(params, 'bend', 0.5);

    const v = view(f, { xMin: 0, xMax: 1, yMin: 0, yMax: 1, inset: 56 });
    grid(f, v, { divisions: 5, ticks: true });

    // 一族候选曲线 y = x + bend·sin(πx)
    for (let k = -4; k <= 4; k++) {
      const b = (k / 4) * 0.6;
      curve(f, v, (x) => x + b * Math.sin(Math.PI * x), { color: 'rgba(160,174,192,0.28)', lw: 1.2 } as never);
    }
    // 当前曲线
    curve(f, v, (x) => x + bend * Math.sin(Math.PI * x), { color: C.accent, lw: 2.6 } as never);
    // 极值（直线：最短路径 / 最短时间）
    curve(f, v, (x) => x, { color: C.warm, lw: 2.2, dash: [7, 4] } as never);

    // 泛函值（弧长）
    const arcLen = (b: number): number => {
      let len = 0;
      const N = 400;
      for (let i = 1; i <= N; i++) {
        const x0 = (i - 1) / N;
        const x1 = i / N;
        const y0 = x0 + b * Math.sin(Math.PI * x0);
        const y1 = x1 + b * Math.sin(Math.PI * x1);
        len += Math.hypot(x1 - x0, y1 - y0);
      }
      return len;
    };

    dot(f, v.sx(0), v.sy(0), 5, C.green);
    dot(f, v.sx(1), v.sy(1), 5, C.green);

    text(f, `泛函 J[y] = ∫ √(1 + y′²) dx　（弧长）`, 50, 48, {
      font: 'bold 16px "Times New Roman", serif', color: C.warm,
    });
    text(f, `当前曲线：J = ${arcLen(bend).toFixed(6)}`, 50, 74, { color: C.accent, font: '13px Consolas, monospace' });
    text(f, `直线（极值曲线）：J = ${arcLen(0).toFixed(6)}`, 50, 98, { color: C.warm, font: '13px Consolas, monospace' });
    text(f, bend !== 0 ? '弯曲的曲线弧长总是大于直线 ⇒ 直线是最小值' : '当前即极值曲线（欧拉-拉格朗日方程的解）', 50, 122, {
      color: bend !== 0 ? C.dim : C.green, font: '13px system-ui',
    });

    heading(f, '变分法：求「函数」的极值，而不是「数」的极值');
    footnotes(f, [
      '灰色曲线是一族候选路径；蓝色为当前路径；橙色虚线为极值路径',
      '欧拉-拉格朗日方程给出 J 取极值的必要条件，从此变分法独立成科',
      '同一框架可解最速降线、等周问题、测地线与最优控制等大量问题',
    ]);
  },
});

// ---------------------------------------------------------------- T32
/** T32 代数基本定理。 */
const fundamentalTheoremAlgebraViz = defineViz({
  slug: 'fundamental-theorem-of-algebra',
  title: '代数基本定理',
  params: {
    degree: { type: 'range', min: 1, max: 8, default: 5, label: '多项式次数 n' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.max(1, Math.round(num(params, 'degree', 5)));

    // z^n − 1 的 n 个根（单位根），演示「n 次多项式恰有 n 个复根」
    const v = equalView(f, 0, 0, 1.6, 60);
    grid(f, v, { divisions: 4, ticks: false });
    const circlePts: Array<[number, number]> = [];
    for (let i = 0; i <= 140; i++) {
      const a = (i * 2 * Math.PI) / 140;
      circlePts.push([v.sx(Math.cos(a)), v.sy(Math.sin(a))]);
    }
    poly(f, circlePts, { stroke: C.grid, lw: 1.5 });
    seg(f, v.sx(-1.55), v.sy(0), v.sx(1.55), v.sy(0), { color: C.dim, lw: 1.1 } as never);
    seg(f, v.sx(0), v.sy(-1.55), v.sx(0), v.sy(1.55), { color: C.dim, lw: 1.1 } as never);

    for (let k = 0; k < n; k++) {
      const a = (2 * Math.PI * k) / n;
      const x = Math.cos(a);
      const y = Math.sin(a);
      seg(f, v.sx(0), v.sy(0), v.sx(x), v.sy(y), { color: 'rgba(102,126,234,0.4)', lw: 1 } as never);
      dot(f, v.sx(x), v.sy(y), 5, C.warm);
    }

    text(f, `方程 z^${n} = 1 恰有 ${n} 个复根`, w / 2, 46, {
      align: 'center', font: 'bold 17px "Times New Roman", serif', color: C.warm,
    });
    text(f, `任何 ${n} 次复系数多项式都恰有 ${n} 个复根（计重数）`, w / 2, 74, {
      align: 'center', color: C.fg, font: '14px system-ui',
    });
    text(f, '橙色点 = 单位根，均匀分布在单位圆上', w / 2, 98, {
      align: 'center', color: C.dim, font: '13px system-ui',
    });

    heading(f, '代数基本定理：复数域是「代数闭」的');
    footnotes(f, [
      '任何次数 > 0 的复系数多项式至少有一个复根 ⇒ 恰有 n 个根（计重数）',
      '高斯给出了严格证明（1799 年博士论文），因而复数域不需要再扩张',
      '对比：实数域上 x² + 1 无解——这就是「代数闭」的意义',
    ]);
  },
});

// ---------------------------------------------------------------- T33
/** T33 帕斯卡与费马的概率论通信。 */
const pascalFermatProbabilityViz = defineViz({
  slug: 'pascal-fermat-probability',
  title: '帕斯卡与费马的概率论通信',
  params: {
    rounds: { type: 'range', min: 1, max: 5, default: 2, label: 'A 还需赢的局数' },
    roundsB: { type: 'range', min: 1, max: 5, default: 3, label: 'B 还需赢的局数' },
    p: { type: 'range', min: 0.1, max: 0.9, step: 0.05, default: 0.5, label: 'A 每局胜率' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = Math.max(1, Math.round(num(params, 'rounds', 2)));
    const b = Math.max(1, Math.round(num(params, 'roundsB', 3)));
    const p = Math.min(0.95, Math.max(0.05, num(params, 'p', 0.5)));

    // 枚举所有可能的后续序列，算 A 最终获胜的概率
    let winA = 0;
    let total = 1;
    const totalRounds = a + b - 1;
    for (let i = 0; i < totalRounds; i++) total *= 2;
    for (let mask = 0; mask < total; mask++) {
      let winsA = 0;
      let winsB = 0;
      let prob = 1;
      for (let i = 0; i < totalRounds && winsA < a && winsB < b; i++) {
        const bit = (mask >> i) & 1;
        if (bit === 0) {
          winsA++;
          prob *= p;
        } else {
          winsB++;
          prob *= 1 - p;
        }
      }
      if (winsA >= a) winA += prob;
    }

    // 帕斯卡三角的小型展示（组合数）
    const rows: number[][] = [];
    for (let i = 0; i < 6; i++) {
      rows.push([]);
      for (let j = 0; j <= i; j++) rows[i][j] = j === 0 || j === i ? 1 : rows[i - 1][j - 1] + rows[i - 1][j];
    }
    const cellW = 46;
    const topY = 150;
    rows.forEach((row, i) => {
      row.forEach((v, j) => {
        const x = 60 + j * cellW;
        const y = topY + i * 34;
        poly(f, [[x, y], [x + cellW - 6, y], [x + cellW - 6, y + 26], [x, y + 26]], {
          fill: 'rgba(102,126,234,0.4)', close: true,
        });
        text(f, String(v), x + (cellW - 6) / 2, y + 18, { align: 'center', color: C.fg, font: '12px system-ui' });
      });
    });

    text(f, `A 还需 ${a} 局，B 还需 ${b} 局（每局 A 胜率 ${p.toFixed(2)}）`, w / 2, 46, {
      align: 'center', font: 'bold 16px system-ui', color: C.fg,
    });
    text(f, `A 最终获胜概率 = ${(winA * 100).toFixed(2)}%`, w / 2, 76, {
      align: 'center', font: 'bold 18px Consolas, monospace', color: C.green,
    });
    text(f, `按此比例分配赌金：A ${(winA * 100).toFixed(1)} 份、B ${((1 - winA) * 100).toFixed(1)} 份`, w / 2, 102, {
      align: 'center', color: C.dim, font: '13px system-ui',
    });

    heading(f, '赌金分配问题：概率论的起点');
    footnotes(f, [
      '1654 年帕斯卡与费马为此往复通信，用不同方法得出同一答案',
      '核心是「列举所有可能的未来」，按胜局组合计算期望——左侧的组合数表就是工具',
      '这场讨论让概率从赌博技巧升格为一门独立学科',
    ]);
  },
});

// ---------------------------------------------------------------- T34
/** T34 三次方程与四次方程的代数解。 */
const cubicQuarticViz = defineViz({
  slug: 'cubic-quartic-formulas',
  title: '三次方程与四次方程的代数解',
  params: {
    a: { type: 'range', min: -3, max: 3, step: 0.1, default: 0, label: '二次项 a' },
    b: { type: 'range', min: -6, max: 6, step: 0.1, default: -4, label: '一次项 b' },
    c: { type: 'range', min: -6, max: 6, step: 0.1, default: 2, label: '常数项 c' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 0);
    const b = num(params, 'b', -4);
    const c = num(params, 'c', 2);
    const fn = (x: number): number => x * x * x + a * x * x + b * x + c;

    const v = view(f, { xMin: -4, xMax: 4, yMin: -12, yMax: 12, inset: 50 });
    grid(f, v, { divisions: 8, ticks: true });
    seg(f, v.sx(-4), v.sy(0), v.sx(4), v.sy(0), { color: C.dim, lw: 1.2 } as never);
    seg(f, v.sx(0), v.sy(-12), v.sx(0), v.sy(12), { color: C.dim, lw: 1.2 } as never);
    curve(f, v, fn, { color: C.accent, lw: 2.4 } as never);

    // 数值扫描实根
    const roots: number[] = [];
    let prevX = -4;
    let prevY = fn(prevX);
    for (let x = -3.98; x <= 4; x += 0.02) {
      const y = fn(x);
      if (prevY === 0 || (prevY < 0) !== (y < 0)) {
        // 二分求根
        let lo = prevX;
        let hi = x;
        for (let i = 0; i < 40; i++) {
          const mid = (lo + hi) / 2;
          if ((fn(lo) < 0) !== (fn(mid) < 0)) hi = mid;
          else lo = mid;
        }
        roots.push((lo + hi) / 2);
      }
      prevX = x;
      prevY = y;
    }
    roots.forEach((r) => {
      dot(f, v.sx(r), v.sy(0), 5.5, C.hot);
      text(f, r.toFixed(3), v.sx(r), v.sy(0) - 14, { align: 'center', color: C.hot, font: '12px system-ui' });
    });

    text(f, `y = x³ ${a >= 0 ? '+' : '−'} ${Math.abs(a).toFixed(1)}x² ${b >= 0 ? '+' : '−'} ${Math.abs(b).toFixed(1)}x ${c >= 0 ? '+' : '−'} ${Math.abs(c).toFixed(1)}`, 50, 46, {
      font: 'bold 15px "Times New Roman", serif', color: C.warm,
    });
    text(f, `实根个数 = ${roots.length}（三次方程至少有一个实根，其余可为复根）`, 50, 72, {
      color: C.fg, font: '13px system-ui',
    });
    text(f, '当判别式 < 0 时，求根公式中会出现负数的平方根 ⇒ 虚数被迫登场', 50, 96, {
      color: C.dim, font: '12px system-ui',
    });

    heading(f, '三次、四次方程：代数第一次突破二次的天花板');
    footnotes(f, [
      '费罗、塔尔塔利亚与卡尔达诺接力解出三次方程，费拉里攻下四次方程（16 世纪）',
      '求解中出现的「负数平方根」起初被称为「不可约情形」，最终催生了复数',
      '这也让人追问：五次方程还有根式解吗？——三百年后由伽罗瓦回答',
    ]);
  },
});

// ---------------------------------------------------------------- T35
/** T35 婆罗摩笈多恒等式与佩尔方程。 */
const brahmaguptaPellViz = defineViz({
  slug: 'brahmagupta-pell',
  title: '婆罗摩笈多恒等式与佩尔方程',
  params: {
    D: { type: 'select', options: ['2', '3', '5', '7', '13', '61'], default: '2', label: '非平方数 D' },
    xMax: { type: 'range', min: 10, max: 400, default: 60, label: 'x 扫描范围' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const D = Number(str(params, 'D', '2'));
    const xMax = Math.max(5, Math.round(num(params, 'xMax', 60)));

    // 收集解
    const sols: Array<[number, number]> = [];
    for (let x = 1; x <= xMax; x++) {
      const v2 = x * x - 1;
      if (v2 % D === 0) {
        const y2 = v2 / D;
        const y = Math.round(Math.sqrt(y2));
        if (y * y === y2) sols.push([x, y]);
      }
    }

    const yMaxAxis = Math.max(2, ...sols.map(([, y]) => y)) * 1.15;
    const v = view(f, { xMin: 0, xMax: xMax, yMin: 0, yMax: Math.max(yMaxAxis, 3), inset: 52 });
    grid(f, v, { divisions: 6, ticks: true });
    // 双曲线 x² − D y² = 1 ⇒ y = √((x²−1)/D)
    curve(f, v, (x) => Math.sqrt(Math.max(0, (x * x - 1) / D)), { color: C.accent2, lw: 1.8, dash: [6, 4] } as never);
    scatter(f, v, sols, { r: 5, color: C.warm });
    sols.slice(0, 4).forEach(([x, y]) => {
      text(f, `(${x}, ${y})`, v.sx(x) + 8, v.sy(y) - 8, { color: C.warm, font: '12px system-ui' });
    });

    text(f, `x² − ${D}y² = 1`, 50, 46, { font: 'bold 18px "Times New Roman", serif', color: C.warm });
    text(f, `在 x ≤ ${xMax} 内找到 ${sols.length} 组整数解`, 50, 72, {
      color: sols.length ? C.green : C.hot, font: '13px system-ui',
    });

    heading(f, '佩尔方程：双曲线上的整数点');
    footnotes(f, [
      '婆罗摩笈多（约 628 年）给出了 x² − Dy² = 1 的解法，并提出复合恒等式',
      `解总是成对出现，且可由最小解 (x₁, y₁) 递推得到更大的解（如 D = ${D}）`,
      'D = 61 的最小解是 (1766319049, 226153980)——这个惊人的数字让欧洲数学家叹服',
    ]);
  },
});

// ---------------------------------------------------------------- T36
/** T36 丢番图的方程理论。 */
const diophantusViz = defineViz({
  slug: 'diophantus-arithmetica',
  title: '丢番图的方程理论',
  params: {
    a: { type: 'range', min: 2, max: 9, default: 3, label: '系数 a' },
    b: { type: 'range', min: 2, max: 9, default: 5, label: '系数 b' },
    c: { type: 'range', min: 20, max: 200, default: 100, label: '常数 c' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = Math.max(1, Math.round(num(params, 'a', 3)));
    const b = Math.max(1, Math.round(num(params, 'b', 5)));
    const c = Math.max(1, Math.round(num(params, 'c', 100)));

    const sols: Array<[number, number]> = [];
    for (let x = 0; x <= c / a; x++) {
      const rest = c - a * x;
      if (rest % b === 0 && rest >= 0) sols.push([x, rest / b]);
    }
    const gcd = (m: number, n: number): number => (n === 0 ? m : gcd(n, m % n));
    const g = gcd(a, b);

    const xMaxAxis = Math.ceil(c / a);
    const yMaxAxis = Math.ceil(c / b);
    const v = view(f, { xMin: 0, xMax: xMaxAxis + 1, yMin: 0, yMax: yMaxAxis + 1, inset: 52 });
    grid(f, v, { divisions: 6, ticks: true });
    curve(f, v, (x) => (c - a * x) / b, { color: C.accent2, lw: 1.6, dash: [5, 4] } as never);
    scatter(f, v, sols, { r: 5, color: C.warm });
    sols.slice(0, 5).forEach(([x, y]) => {
      text(f, `(${x}, ${y})`, v.sx(x) + 8, v.sy(y) - 8, { color: C.warm, font: '11px system-ui' });
    });

    text(f, `${a}x + ${b}y = ${c}　（求非负整数解）`, 50, 46, {
      font: 'bold 16px "Times New Roman", serif', color: C.warm,
    });
    text(f, `gcd(${a}, ${b}) = ${g} ⇒ ${c % g === 0 ? '有解' : '无解（c 不被 gcd 整除）'}`, 50, 72, {
      color: c % g === 0 ? C.green : C.hot, font: '13px Consolas, monospace',
    });
    text(f, `解的个数 = ${sols.length}`, 50, 96, { color: C.fg, font: '13px system-ui' });
    text(f, '丢番图《算术》：只关心整数/有理数解，开创了不定方程研究', 50, 120, {
      color: C.dim, font: '12px system-ui',
    });

    heading(f, '丢番图的方程理论：整数解的学问');
    footnotes(f, [
      '方程写在连续曲线上，但只有落在整数格点的位置才是「解」——这就是数论与代数的分野',
      '有解条件是 gcd(a, b) 整除 c（图中直接给出判断）',
      '丢番图的《算术》影响了后世所有数论研究；费马正是读它时写下那条著名批注',
    ]);
  },
});

// ---------------------------------------------------------------- T37
/** T37 傅里叶级数。 */
const fourierSeriesViz = defineViz({
  slug: 'fourier-series-history',
  title: '傅里叶级数',
  params: {
    terms: { type: 'range', min: 1, max: 40, default: 5, label: '谐波项数' },
    wave: { type: 'select', options: ['方波', '锯齿波', '三角波'], default: '方波', label: '目标波形' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const terms = Math.max(1, Math.round(num(params, 'terms', 5)));
    const wave = str(params, 'wave', '方波');

    const approx = (x: number): number => {
      let s = 0;
      if (wave === '方波') {
        for (let k = 0; k < terms; k++) {
          const n = 2 * k + 1;
          s += (4 / Math.PI) * Math.sin(n * x) / n;
        }
      } else if (wave === '锯齿波') {
        for (let n = 1; n <= terms; n++) s += (2 / Math.PI) * (Math.pow(-1, n + 1) / n) * Math.sin(n * x);
      } else {
        for (let k = 0; k < terms; k++) {
          const n = 2 * k + 1;
          s += (8 / (Math.PI * Math.PI)) * (Math.pow(-1, k) / (n * n)) * Math.sin(n * x);
        }
      }
      return s;
    };
    const target = (x: number): number => {
      const t = ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      if (wave === '方波') return t < Math.PI ? 1 : -1;
      if (wave === '锯齿波') return (t / Math.PI) - 1;
      return t < Math.PI ? (2 * t) / Math.PI - 1 : 3 - (2 * t) / Math.PI;
    };

    const v = view(f, { xMin: 0, xMax: 2 * Math.PI, yMin: -1.8, yMax: 1.8, inset: 52 });
    grid(f, v, { divisions: 6, ticks: true });
    seg(f, v.sx(0), v.sy(0), v.sx(2 * Math.PI), v.sy(0), { color: C.dim, lw: 1.1 } as never);
    curve(f, v, target, { color: 'rgba(160,174,192,0.55)', lw: 1.6, dash: [5, 4] } as never);
    curve(f, v, approx, { color: C.accent, lw: 2.4 } as never);

    text(f, `${wave}的傅里叶级数（前 ${terms} 个谐波）`, 50, 46, {
      font: 'bold 16px "Times New Roman", serif', color: C.accent,
    });
    text(f, '灰色虚线为原波形，蓝色为有限项叠加的结果', 50, 72, { color: C.fg, font: '13px system-ui' });
    text(f, `项数越多，逼近越好；不连续点附近始终有约 9% 的过冲（吉布斯现象）`, 50, 96, {
      color: C.dim, font: '12px system-ui',
    });

    heading(f, '傅里叶级数：任何波形都能拆成正弦波的叠加');
    footnotes(f, [
      '傅里叶研究热传导时提出这一断言，起初因「不够严格」遭到质疑',
      '方波只含奇次谐波（1、3、5…），且系数按 1/n 衰减——项数越多越接近矩形',
      '它重塑了分析学，并成为信号处理、图像压缩（JPEG）与通信的数学基础',
    ]);
  },
});

// ---------------------------------------------------------------- T38
/** T38 柯西积分定理。 */
const cauchyIntegralViz = defineViz({
  slug: 'cauchy-integral-theorem',
  title: '柯西积分定理',
  params: {
    radius: { type: 'range', min: 0.3, max: 1.6, step: 0.05, default: 1, label: '围道半径' },
    shape: { type: 'select', options: ['圆', '方形', '三角形'], default: '圆', label: '围道形状' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const r = num(params, 'radius', 1);
    const shape = str(params, 'shape', '圆');

    const v = equalView(f, 0, 0, 1.9, 70);
    grid(f, v, { divisions: 6, ticks: false });
    seg(f, v.sx(-1.85), v.sy(0), v.sx(1.85), v.sy(0), { color: C.dim, lw: 1.1 } as never);
    seg(f, v.sx(0), v.sy(-1.85), v.sx(0), v.sy(1.85), { color: C.dim, lw: 1.1 } as never);

    // 围道（闭合路径）
    const pts: Array<[number, number]> = [];
    if (shape === '圆') {
      for (let i = 0; i <= 140; i++) {
        const a = (i * 2 * Math.PI) / 140;
        pts.push([r * Math.cos(a), r * Math.sin(a)]);
      }
    } else if (shape === '方形') {
      pts.push([-r, -r], [r, -r], [r, r], [-r, r], [-r, -r]);
    } else {
      for (let i = 0; i <= 3; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
        pts.push([r * Math.cos(a), r * Math.sin(a)]);
      }
      pts.push(pts[0]);
    }
    poly(f, pts.map(([x, y]) => [v.sx(x), v.sy(y)] as [number, number]), {
      stroke: C.warm, lw: 2.6, fill: 'rgba(237,137,54,0.12)', close: true,
    });

    // 解析点（无奇点）
    const dots: Array<[number, number]> = [[0, 0], [0.4, 0.35], [-0.5, 0.3], [0.25, -0.55]];
    dots.forEach(([x, y]) => dot(f, v.sx(x), v.sy(y), 4, C.cyan));

    text(f, `∮ f(z) dz = 0　（f 在围道内解析）`, w / 2, 46, {
      align: 'center', font: 'bold 18px "Times New Roman", serif', color: C.warm,
    });
    text(f, '橙色为闭合围道，青色为围道内的解析点（无奇点）', w / 2, 74, {
      align: 'center', color: C.fg, font: '13px system-ui',
    });
    text(f, `当前围道：${shape}，半径 ${r.toFixed(2)}`, w / 2, 98, {
      align: 'center', color: C.dim, font: '13px system-ui',
    });

    heading(f, '柯西积分定理：解析函数沿闭合路径积分为零');
    footnotes(f, [
      '只要函数在围道及其内部处处可导（解析），沿任意闭合路径的积分恒为 0',
      '由此推出柯西积分公式：f(a) = (1/2πi)∮ f(z)/(z−a) dz——内部值由边界值决定',
      '如果围道内含有奇点（如 1/z 在原点），结果就不再是 0，这正是留数定理的由来',
    ]);
  },
});

// ---------------------------------------------------------------- T39
/** T39 非欧几何的诞生。 */
const nonEuclideanGeometryViz = defineViz({
  slug: 'non-euclidean-geometry',
  title: '非欧几何的诞生',
  params: {
    model: { type: 'select', options: ['双曲（罗巴切夫斯基）', '椭圆（黎曼）', '欧氏（对照）'], default: '双曲（罗巴切夫斯基）', label: '几何模型' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const model = str(params, 'model', '双曲（罗巴切夫斯基）');

    const v = view(f, { xMin: -1.6, xMax: 1.6, yMin: -1.1, yMax: 1.4, inset: 56 });
    grid(f, v, { divisions: 4, ticks: false });

    // 直线 L
    const y0 = 0.2;
    seg(f, v.sx(-1.6), v.sy(y0), v.sx(1.6), v.sy(y0), { color: C.dim, lw: 2 } as never);
    text(f, 'L', v.sx(1.5), v.sy(y0) - 8, { color: C.dim, font: 'bold 13px system-ui' });

    // 外一点 P
    const px = -0.2;
    const py = 0.95;
    dot(f, v.sx(px), v.sy(py), 5.5, C.hot);
    text(f, 'P', v.sx(px) + 10, v.sy(py) - 6, { color: C.hot, font: 'bold 13px system-ui' });

    // 过 P 的「平行线」随模型变化
    if (model === '欧氏（对照）') {
      seg(f, v.sx(-1.6), v.sy(py), v.sx(1.6), v.sy(py), { color: C.accent, lw: 2.2 } as never);
      text(f, '恰有一条平行线（欧几里得第五公设）', w / 2, 46, {
        align: 'center', color: C.accent, font: 'bold 15px system-ui',
      });
    } else if (model === '双曲（罗巴切夫斯基）') {
      // 三条过 P 的「直线」（在双曲模型中表现为不同方向）
      for (const slope of [-0.55, -0.25, 0.25]) {
        seg(f, v.sx(-1.6), v.sy(py + slope * (-1.6 - px) * 0.001 + 0), v.sx(1.6), v.sy(py), { color: 'rgba(102,126,234,0.5)', lw: 1.4 } as never);
      }
      // 两条真正不相交的"平行线"（渐近方向）
      const drawCurve = (bend: number, color: string, lw: number) => {
        const pts: Array<[number, number]> = [];
        for (let i = 0; i <= 100; i++) {
          const x = -1.55 + (3.1 * i) / 100;
          const y = py + bend * (x - px) * (x - px) - 0.25 * bend;
          pts.push([v.sx(x), v.sy(y)]);
        }
        poly(f, pts, { stroke: color, lw });
      };
      drawCurve(0.42, C.accent, 2.2);
      drawCurve(-0.42, C.green, 2.2);
      text(f, '过 P 至少有两条不相交的「平行线」', w / 2, 46, {
        align: 'center', color: C.accent, font: 'bold 15px system-ui',
      });
    } else {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 100; i++) {
        const x = -1.55 + (3.1 * i) / 100;
        const y = py - 0.55 * (x - px) * (x - px);
        pts.push([v.sx(x), v.sy(y)]);
      }
      poly(f, pts, { stroke: C.accent, lw: 2.2 });
      text(f, '任何两条「直线」都会相交（不存在平行线）', w / 2, 46, {
        align: 'center', color: C.accent, font: 'bold 15px system-ui',
      });
    }

    heading(f, '非欧几何：平行公设不是「天经地义」的');
    footnotes(f, [
      '欧几里得第五公设（过直线外一点恰有一条平行线）无法由其余公理推出',
      '改换它就能得到自洽的新几何：双曲几何（无数条）、椭圆几何（零条）',
      '罗巴切夫斯基、鲍耶、高斯几乎同时发现这一点，打破了欧氏几何两千年的垄断',
    ]);
  },
});

// ---------------------------------------------------------------- T40
/** T40 康托尔连续统不可数性。 */
const cantorUncountabilityViz = defineViz({
  slug: 'cantor-uncountability',
  title: '康托尔连续统不可数性',
  params: {
    rows: { type: 'range', min: 3, max: 9, default: 6, label: '列出的实数个数' },
    flip: { type: 'select', options: ['显示对角线', '隐藏对角线'], default: '显示对角线', label: '对角线' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const rows = Math.max(2, Math.round(num(params, 'rows', 6)));
    const showDiag = str(params, 'flip', '显示对角线') === '显示对角线';

    // 虚构的实数列表（每行一个 0/1 小数展开）
    const rand = rng(424242);
    const table: number[][] = [];
    const cols = 10;
    for (let i = 0; i < rows; i++) {
      const row: number[] = [];
      for (let j = 0; j < cols; j++) row.push(rand() < 0.5 ? 0 : 1);
      table.push(row);
    }
    // 对角线取反得到新数
    const diag: number[] = table.map((row, i) => (row[i] === 0 ? 1 : 0));

    const cellW = Math.min(38, (w - 260) / cols);
    const cellH = Math.max(18, Math.min(30, (h - 330) / (rows + 2)));
    const ox = 90;
    const oy = 108;
    text(f, '0.', ox - 24, oy + 20, { align: 'right', color: C.dim, font: '13px Consolas, monospace' });
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const x = ox + j * cellW;
        const y = oy + i * cellH;
        const onDiag = i === j;
        poly(f, [[x, y], [x + cellW - 3, y], [x + cellW - 3, y + cellH - 4], [x, y + cellH - 4]], {
          fill: onDiag && showDiag ? 'rgba(237,137,54,0.55)' : 'rgba(45,55,72,0.85)',
          close: true,
        });
        text(f, String(table[i][j]), x + (cellW - 3) / 2, y + 18, { align: 'center', color: C.fg, font: '13px Consolas, monospace' });
      }
      text(f, `r${i + 1}`, ox - 24, oy + i * cellH + 20, { align: 'right', color: C.dim, font: '12px system-ui' });
    }

    // 构造的新数
    const ny = oy + rows * cellH + 30;
    text(f, '构造：', ox - 60, ny + 20, { color: C.warm, font: 'bold 14px system-ui' });
    for (let j = 0; j < cols; j++) {
      const x = ox + j * cellW;
      const bit = j < rows ? diag[j] : (table[0][j] + 1) % 2;
      poly(f, [[x, ny], [x + cellW - 3, ny], [x + cellW - 3, ny + cellH - 4], [x, ny + cellH - 4]], {
        fill: 'rgba(72,187,120,0.6)', close: true,
      });
      text(f, String(bit), x + (cellW - 3) / 2, ny + 18, { align: 'center', color: C.fg, font: '13px Consolas, monospace' });
    }
    text(f, '新数 r*', ox - 24, ny + 20, { align: 'right', color: C.green, font: 'bold 12px system-ui' });

    text(f, 'r* 的第 k 位 ≠ r_k 的第 k 位 ⇒ r* 不在列表中', ox, ny + cellH + 26, {
      color: C.green, font: 'bold 14px system-ui',
    });
    text(f, `无论列出多少行，总能造出一个遗漏的实数 ⇒ 实数集不可数`, ox, ny + cellH + 50, {
      color: C.warm, font: '13px system-ui',
    });

    heading(f, '对角线法：实数比自然数「多得多」');
    footnotes(f, [
      '假设实数能全部列成一行一行，康托尔用对角线取反造出一个「不在列表中」的新数',
      '这说明不存在实数到自然数的一一对应——无穷也分大小（可数 vs 不可数）',
      '超限数理论由此诞生，也引发了数学史上最激烈的争论',
    ]);
  },
});

registerViz(
  taylorFormulaViz,
  stirlingApproximationViz,
  baselProblemViz,
  eulerVariationsViz,
  fundamentalTheoremAlgebraViz,
  pascalFermatProbabilityViz,
  cubicQuarticViz,
  brahmaguptaPellViz,
  diophantusViz,
  fourierSeriesViz,
  cauchyIntegralViz,
  nonEuclideanGeometryViz,
  cantorUncountabilityViz,
);
