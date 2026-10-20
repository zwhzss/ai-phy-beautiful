/**
 * 数学史里程碑 · doubao 补充批次二（T68–T80：19 世纪）。
 */
import { defineViz, num, str, VizFrame } from '../types';
import { registerViz } from '../registry';
import { C, curve, dot, equalView, footnotes, grid, heading, matrixView, poly, seg, text, view } from '../canvas';

/** 阶乘。 */
function fact(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/** 数值导数。 */
function d1(fn: (x: number) => number, x: number): number {
  return (fn(x + 1e-5) - fn(x - 1e-5)) / 2e-5;
}

// ---------------------------------------------------------------- T68
/** T68 泊松分布。 */
const poissonDistributionViz = defineViz({
  slug: 'poisson-distribution',
  title: '泊松分布',
  params: {
    lambda: { type: 'range', min: 0.5, max: 15, step: 0.5, default: 4, label: '参数 λ' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const lam = Math.max(0.1, num(params, 'lambda', 4));
    const kmax = Math.max(6, Math.ceil(lam + 4 * Math.sqrt(lam)));

    const probs: number[] = [];
    for (let k = 0; k <= kmax; k++) probs.push((Math.exp(-lam) * Math.pow(lam, k)) / fact(k));
    const maxP = Math.max(...probs);

    const baseY = h - 130;
    const bw = Math.min(56, (w - 120) / (kmax + 1) - 6);
    probs.forEach((p, k) => {
      const x = 60 + k * (bw + 6);
      const bh = (p / maxP) * (h - 260);
      poly(f, [[x, baseY - bh], [x + bw, baseY - bh], [x + bw, baseY], [x, baseY]], {
        fill: k === Math.round(lam) ? 'rgba(237,137,54,0.85)' : 'rgba(102,126,234,0.7)', close: true,
      });
      if (bw > 26) {
        text(f, String(k), x + bw / 2, baseY + 16, { align: 'center', color: C.dim, font: '11px system-ui' });
        if (p > maxP * 0.12) {
          text(f, p.toFixed(3), x + bw / 2, baseY - bh - 8, { align: 'center', color: C.fg, font: '10px system-ui' });
        }
      }
    });

    text(f, `P(X = k) = e^(−λ)·λ^k / k!`, w / 2, 48, {
      align: 'center', font: 'bold 17px "Times New Roman", serif', color: C.warm,
    });
    text(f, `λ = ${lam}　均值 = 方差 = λ = ${lam}`, w / 2, 76, {
      align: 'center', color: C.fg, font: '14px system-ui',
    });
    text(f, `众数出现在 k = ${Math.floor(lam)}（橙色柱）`, w / 2, 100, {
      align: 'center', color: C.warm, font: '13px system-ui',
    });

    heading(f, '泊松分布：稀有事件计数的分布');
    footnotes(f, [
      '参数 λ 同时是均值与方差，λ 越大分布越对称、越接近正态',
      '它是二项分布中「n 大、p 小、np = λ」的极限，因此适合描述稀有事件',
      '应用：放射性衰变计数、电话交换台呼叫数、网站访问量、排队论',
    ]);
  },
});

// ---------------------------------------------------------------- T69
/** T69 阿贝尔定理（幂级数）。 */
const abelsTheoremViz = defineViz({
  slug: 'abels-theorem',
  title: '阿贝尔定理（幂级数）',
  params: {
    R: { type: 'range', min: 0.5, max: 3, step: 0.1, default: 1, label: '收敛半径 R' },
    terms: { type: 'range', min: 2, max: 30, default: 12, label: '部分和项数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const R = num(params, 'R', 1);
    const terms = Math.max(1, Math.round(num(params, 'terms', 12)));
    const target = (x: number): number => 1 / (1 + x);
    const partial = (x: number): number => {
      let s = 0;
      for (let n = 0; n < terms; n++) s += Math.pow(-x, n);
      return s;
    };
    void target;

    const v = view(f, { xMin: -3.5, xMax: 3.5, yMin: -3, yMax: 3, inset: 52 });
    grid(f, v, { divisions: 6, ticks: true });
    seg(f, v.sx(-3.5), v.sy(0), v.sx(3.5), v.sy(0), { color: C.dim, lw: 1.2 } as never);
    // 收敛区间与端点
    seg(f, v.sx(-R), v.sy(-3), v.sx(-R), v.sy(3), { color: C.hot, lw: 1.6, dash: [5, 4] } as never);
    seg(f, v.sx(R), v.sy(-3), v.sx(R), v.sy(3), { color: C.hot, lw: 1.6, dash: [5, 4] } as never);
    text(f, '−R', v.sx(-R), 62, { align: 'center', color: C.hot, font: 'bold 13px system-ui' });
    text(f, 'R', v.sx(R), 62, { align: 'center', color: C.hot, font: 'bold 13px system-ui' });
    text(f, '收敛区间', v.sx(0), 62, { align: 'center', color: C.dim, font: '12px system-ui' });

    curve(f, v, (x) => (Math.abs(x) < R ? 1 / (1 + x) : NaN), { color: C.accent, lw: 2.4 } as never);
    curve(f, v, partial, { color: C.warm, lw: 1.8, dash: [6, 4] } as never);

    text(f, 'Σ (−1)ⁿ xⁿ 与和函数 1/(1+x)', 50, 46, {
      font: 'bold 15px "Times New Roman", serif', color: C.warm,
    });
    text(f, `收敛半径 R = ${R.toFixed(1)}`, 50, 72, { color: C.hot, font: '14px Consolas, monospace' });
    text(f, '区间内一致收敛；端点需单独判定（阿贝尔定理给出连续性）', 50, 96, {
      color: C.dim, font: '12px system-ui',
    });

    heading(f, '阿贝尔定理：幂级数在收敛半径内的行为');
    footnotes(f, [
      '幂级数存在收敛半径 R：|x| < R 绝对收敛，|x| > R 发散，端点需逐个判定',
      '阿贝尔定理进一步断言：若级数在某端点收敛，则和函数在该点连续',
      '同年（1826）阿贝尔还证明了一般五次方程无根式解——两项贡献都影响深远',
    ]);
  },
});

// ---------------------------------------------------------------- T70
/** T70 施图姆-刘维尔理论。 */
const sturmLiouvilleViz = defineViz({
  slug: 'sturm-liouville-theory',
  title: '施图姆-刘维尔理论',
  params: {
    n: { type: 'range', min: 1, max: 4, default: 1, label: '本征函数序号 n' },
    count: { type: 'range', min: 1, max: 4, default: 3, label: '显示前几个' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const nSel = Math.max(1, Math.round(num(params, 'n', 1)));
    const count = Math.max(1, Math.round(num(params, 'count', 3)));

    const v = view(f, { xMin: 0, xMax: 1, yMin: -1.3, yMax: 1.3, inset: 54 });
    grid(f, v, { divisions: 5, ticks: true });
    seg(f, v.sx(0), v.sy(0), v.sx(1), v.sy(0), { color: C.dim, lw: 1.1 } as never);

    // 弦振动本征函数 y_n = sin(nπx)，满足边值条件 y(0)=y(1)=0
    for (let k = 1; k <= count; k++) {
      const on = k === nSel;
      curve(f, v, (x) => Math.sin(k * Math.PI * x), {
        color: on ? C.warm : 'rgba(102,126,234,0.45)',
        lw: on ? 2.8 : 1.5,
      } as never);
    }
    dot(f, v.sx(0), v.sy(0), 4.5, C.green);
    dot(f, v.sx(1), v.sy(0), 4.5, C.green);

    // 正交性：∫ sin(mπx)sin(nπx) dx = 0 (m≠n)
    const inner = (m: number, k: number): number => {
      let s = 0;
      const N = 600;
      for (let i = 0; i < N; i++) {
        const x = (i + 0.5) / N;
        s += (Math.sin(m * Math.PI * x) * Math.sin(k * Math.PI * x)) / N;
      }
      return s;
    };
    text(f, '−(p y′)′ + q y = λ y', 50, 46, { font: 'bold 17px "Times New Roman", serif', color: C.warm });
    text(f, `本征值 λₙ = n²π²，本征函数 yₙ = sin(nπx)`, 50, 72, { color: C.fg, font: '13px system-ui' });
    text(f, `正交性检验：∫ y₁·y${nSel} = ${inner(1, nSel).toFixed(4)}`, 50, 96, {
      color: nSel === 1 ? C.green : C.cyan, font: '13px Consolas, monospace',
    });
    text(f, nSel === 1 ? '（自身内积 = 1，归一化）' : '（不同本征函数内积 = 0，正交）', 50, 120, {
      color: C.dim, font: '12px system-ui',
    });

    heading(f, '施图姆-刘维尔理论：微分算子的本征值问题');
    footnotes(f, [
      '边界条件迫使本征值只能取离散值（λₙ = n²π²），本征函数族彼此正交',
      '这一框架统一了弦振动、热传导、勒让德多项式与贝塞尔函数等大量问题',
      '量子力学的「能级」正是哈密顿算子的本征值——它把物理的量子化归结为数学的本征值',
    ]);
  },
});

// ---------------------------------------------------------------- T71
/** T71 凯莱-哈密顿定理。 */
const cayleyHamiltonViz = defineViz({
  slug: 'cayley-hamilton',
  title: '凯莱-哈密顿定理',
  params: {
    a: { type: 'range', min: -3, max: 3, step: 0.5, default: 2, label: 'a₁₁' },
    b: { type: 'range', min: -3, max: 3, step: 0.5, default: 1, label: 'a₁₂' },
    c: { type: 'range', min: -3, max: 3, step: 0.5, default: 1, label: 'a₂₁' },
    d: { type: 'range', min: -3, max: 3, step: 0.5, default: 2, label: 'a₂₂' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 2);
    const b = num(params, 'b', 1);
    const c = num(params, 'c', 1);
    const d = num(params, 'd', 2);

    // 特征多项式 λ² − tr·λ + det
    const tr = a + d;
    const det = a * d - b * c;

    // 验证 A² − tr·A + det·I = 0
    const a2 = a * a + b * c;
    const b2 = a * b + b * d;
    const c2 = c * a + d * c;
    const d2 = c * b + d * d;
    const r00 = a2 - tr * a + det;
    const r01 = b2 - tr * b;
    const r10 = c2 - tr * c;
    const r11 = d2 - tr * d + det;

    matrixView(f, [[a, b], [c, d]], { x: 70, y: 130, size: 58, gap: 24, showValues: true, hue: 230 });
    text(f, 'A', 70 + 58 + 12, 130 + 58 + 14, { color: C.fg, font: 'bold 16px system-ui' });

    matrixView(f, [[r00, r01], [r10, r11]], { x: w - 260, y: 130, size: 58, gap: 24, showValues: true, hue: 0 });
    text(f, 'A² − tr(A)·A + det(A)·I', w - 260, 130 + 58 + 34, {
      color: C.hot, font: 'bold 14px system-ui',
    });
    text(f, '= 零矩阵 ✓', w - 260, 130 + 58 + 58, { color: C.green, font: 'bold 15px system-ui' });

    text(f, `λ² − ${tr.toFixed(1)}λ + ${det.toFixed(1)} = 0`, w / 2, 60, {
      align: 'center', font: 'bold 18px "Times New Roman", serif', color: C.warm,
    });
    text(f, '矩阵满足自己的特征多项式', w / 2, 88, { align: 'center', color: C.fg, font: '14px system-ui' });
    text(f, `迹 tr = ${tr.toFixed(1)}　行列式 det = ${det.toFixed(1)}　特征值 λ = ${(((tr + Math.sqrt(Math.max(0, tr * tr - 4 * det))) / 2)).toFixed(2)}, ${(((tr - Math.sqrt(Math.max(0, tr * tr - 4 * det))) / 2)).toFixed(2)}`, w / 2, 112, {
      align: 'center', color: C.dim, font: '12px Consolas, monospace',
    });

    heading(f, '凯莱-哈密顿定理：矩阵满足自身特征多项式');
    footnotes(f, [
      '把矩阵 A 代入它的特征多项式 p(λ) = det(λI − A)，结果恰为零矩阵',
      '由此可把 A 的高次幂降阶表示，是矩阵计算与线性系统分析的基本手段',
      '拖动四个元素，右侧结果矩阵始终保持全零——这就是「特征多项式」的威力',
    ]);
  },
});

// ---------------------------------------------------------------- T72
/** T72 西罗定理。 */
const sylowTheoremsViz = defineViz({
  slug: 'sylow-theorems',
  title: '西罗定理',
  params: {
    order: { type: 'select', options: ['12', '15', '21', '24', '30'], default: '12', label: '群的阶 |G|' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const order = Number(str(params, 'order', '12'));

    // 分解 |G| = p^k · m
    let n = order;
    let p = 2;
    for (let i = 2; i <= n; i++) {
      if (n % i === 0) {
        p = i;
        break;
      }
    }
    let k = 0;
    while (n % p === 0) {
      n /= p;
      k++;
    }
    const m = n;
    const pk = Math.pow(p, k);

    // 西罗 p-子群的个数 n_p 满足：n_p ≡ 1 (mod p) 且 n_p | m
    const candidates: number[] = [];
    for (let t = 1; t <= m; t++) {
      if (m % t === 0 && t % p === 1) candidates.push(t);
    }

    text(f, `|G| = ${order} = ${p}^${k} × ${m}`, w / 2, 52, {
      align: 'center', font: 'bold 20px "Times New Roman", serif', color: C.warm,
    });
    text(f, `西罗 ${p}-子群的阶 = ${pk}`, w / 2, 82, { align: 'center', color: C.accent, font: '15px system-ui' });
    text(f, `其个数 n_${p} 必须满足：n ≡ 1 (mod ${p}) 且 n 整除 ${m}`, w / 2, 108, {
      align: 'center', color: C.fg, font: '14px system-ui',
    });
    text(f, `可行取值：${candidates.join('、') || '（无）'}`, w / 2, 136, {
      align: 'center', color: C.green, font: 'bold 15px Consolas, monospace',
    });

    // 子群示意方块
    const shown = Math.min(candidates.length ? candidates[0] : 1, 6);
    const perRow = 3;
    const cell = 58;
    for (let i = 0; i < shown; i++) {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const x = w / 2 - (perRow * (cell + 18)) / 2 + col * (cell + 18);
      const y = 200 + row * (cell + 30);
      poly(f, [[x, y], [x + cell, y], [x + cell, y + cell], [x, y + cell]], {
        fill: 'rgba(102,126,234,0.5)', stroke: C.accent, lw: 1.6, close: true,
      });
      text(f, `P${i + 1}`, x + cell / 2, y + cell / 2 + 5, { align: 'center', color: C.fg, font: 'bold 14px system-ui' });
    }
    text(f, `（示意：至少存在一个 ${pk} 阶子群，共有 n ≡ 1 (mod ${p}) 个）`, w / 2, 200 + Math.ceil(shown / perRow) * (cell + 30) + 6, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });

    heading(f, '西罗定理：有限群结构的计数约束');
    footnotes(f, [
      '三条西罗定理分别给出：p 子群存在、共轭关系、以及个数的同余与整除条件',
      '个数条件极强：常能直接推出子群正规，从而证明群非单群或可解',
      '它是有限群论的基石，也是「用计数证明结构」的经典范例',
    ]);
  },
});

// ---------------------------------------------------------------- T73
/** T73 黎曼ζ函数与黎曼猜想。 */
const riemannZetaViz = defineViz({
  slug: 'riemann-zeta-hypothesis',
  title: '黎曼ζ函数与黎曼猜想',
  params: {
    sigma: { type: 'range', min: 0.2, max: 2.5, step: 0.05, default: 0.5, label: '实部 σ' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const sigma = num(params, 'sigma', 0.5);

    const v = equalView(f, 0, 0, 1.6, 56);
    grid(f, v, { divisions: 4, ticks: false });
    seg(f, v.sx(-1.5), v.sy(0), v.sx(1.5), v.sy(0), { color: C.dim, lw: 1.2 } as never);
    seg(f, v.sx(0), v.sy(-1.5), v.sx(0), v.sy(1.5), { color: C.dim, lw: 1.2 } as never);
    // 临界线 σ = 1/2
    const cs = 0.5;
    seg(f, v.sx(cs), v.sy(-1.5), v.sx(cs), v.sy(1.5), { color: C.hot, lw: 2.2, dash: [6, 4] } as never);
    text(f, '临界线 σ = 1/2', v.sx(cs) + 8, v.sy(1.32), { color: C.hot, font: 'bold 12px system-ui' });
    // 已知零点（虚部 ±14.13、±21.02…归一化显示）
    const zeros = [14.13, 21.02, 25.01, 30.42, 32.94, 37.59];
    zeros.forEach((t) => {
      const y = (t / 40) * 1.3;
      dot(f, v.sx(cs), v.sy(y), 4, C.green);
      dot(f, v.sx(cs), v.sy(-y), 4, C.green);
    });

    // 当前 σ 的位置
    seg(f, v.sx(sigma), v.sy(-1.5), v.sx(sigma), v.sy(1.5), { color: C.accent, lw: 2 } as never);
    text(f, `σ = ${sigma.toFixed(2)}`, v.sx(sigma), v.sy(-1.36), {
      align: 'center', color: C.accent, font: '12px system-ui',
    });

    // 数值部分和（仅供参考显示，σ > 1 时收敛）
    const partial = (s: number, T: number): number => {
      let re = 0;
      let im = 0;
      for (let n = 1; n <= 200; n++) {
        const r = Math.pow(n, -s);
        re += r * Math.cos(T * Math.log(n));
        im -= r * Math.sin(T * Math.log(n));
      }
      return Math.hypot(re, im);
    };
    text(f, 'ζ(s) = Σ 1/nˢ', w / 2, 48, {
      align: 'center', font: 'bold 20px "Times New Roman", serif', color: C.warm,
    });
    text(f, '黎曼猜想：所有非平凡零点的实部都等于 1/2', w / 2, 76, {
      align: 'center', color: C.hot, font: 'bold 14px system-ui',
    });
    text(f, `点 σ=${sigma.toFixed(2)} 处的 |ζ|（s = σ + 14.13i 附近）≈ ${partial(sigma, 14.13).toFixed(4)}`, w / 2, 100, {
      align: 'center', color: C.fg, font: '12px Consolas, monospace',
    });
    text(f, '绿点：已被验证的零点（均落在临界线上）；已检查前 10¹³ 个零点', w / 2, h - 96, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });

    heading(f, '黎曼ζ函数：素数分布的核心');
    footnotes(f, [
      'ζ(s) = Σ 1/nˢ 在 σ > 1 收敛，经解析延拓成为复平面上的亚纯函数',
      '它在负偶数处的「平凡零点」之外，其余零点全在 0 < σ < 1 的临界带内',
      '黎曼猜想：这些非平凡零点全部位于 σ = 1/2 上——千禧年七大难题之一，至今未决',
    ]);
  },
});

// ---------------------------------------------------------------- T74
/** T74 若尔当-赫尔德定理。 */
const jordanHolderViz = defineViz({
  slug: 'jordan-holder-theorem',
  title: '若尔当-赫尔德定理',
  params: {
    n: { type: 'select', options: ['S₄（24 阶）', 'S₃（6 阶）', 'Z₁₂（12 阶）'], default: 'S₄（24 阶）', label: '群' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'n', 'S₄（24 阶）');

    // 合成列（从群到平凡群的链）
    const chains: Record<string, Array<{ name: string; order: number; simple: string }>> = {
      'S₄（24 阶）': [
        { name: 'S₄', order: 24, simple: '' },
        { name: 'A₄', order: 12, simple: '' },
        { name: 'V₄', order: 4, simple: '商 Z₃' },
        { name: 'Z₂', order: 2, simple: '商 Z₂' },
        { name: '1', order: 1, simple: '商 Z₂' },
      ],
      'S₃（6 阶）': [
        { name: 'S₃', order: 6, simple: '' },
        { name: 'A₃ ≅ Z₃', order: 3, simple: '商 Z₂' },
        { name: '1', order: 1, simple: '商 Z₃' },
      ],
      'Z₁₂（12 阶）': [
        { name: 'Z₁₂', order: 12, simple: '' },
        { name: 'Z₆', order: 6, simple: '商 Z₂' },
        { name: 'Z₃', order: 3, simple: '商 Z₂' },
        { name: '1', order: 1, simple: '商 Z₃' },
      ],
    };
    const chain = chains[kind] ?? chains['S₄（24 阶）'];

    const topY = 130;
    const gap = Math.min(64, (h - 300) / Math.max(1, chain.length - 1));
    chain.forEach((c, i) => {
      const y = topY + i * gap;
      const bw = 190;
      const x = w / 2 - bw / 2;
      poly(f, [[x, y], [x + bw, y], [x + bw, y + 44], [x, y + 44]], {
        fill: i === 0 ? 'rgba(102,126,234,0.65)' : i === chain.length - 1 ? 'rgba(160,174,192,0.35)' : 'rgba(56,178,172,0.5)',
        stroke: C.accent, lw: 1.4, close: true,
      });
      text(f, c.name, x + bw / 2, y + 28, { align: 'center', color: C.fg, font: 'bold 14px system-ui' });
      text(f, `阶 ${c.order}`, x + bw + 14, y + 28, { color: C.dim, font: '12px system-ui' });
      if (c.simple) {
        text(f, `${c.simple}（单群）`, x - 14, y + 28, { align: 'right', color: C.warm, font: '12px system-ui' });
      }
      if (i < chain.length - 1) {
        seg(f, w / 2, y + 44, w / 2, y + gap, { color: C.dim, lw: 1.4 } as never);
      }
    });

    text(f, '群的合成列：每一步的商都是单群', w / 2, 52, {
      align: 'center', font: 'bold 16px system-ui', color: C.warm,
    });
    text(f, '若尔当-赫尔德定理：合成因子的多重集合与合成列长度唯一', w / 2, 80, {
      align: 'center', color: C.fg, font: '13px system-ui',
    });

    heading(f, '若尔当-赫尔德定理：把群分解为单群');
    footnotes(f, [
      '合成列是一串逐步「剥离」正规子群的链，每一步的商都是单群（不可再分）',
      '定理保证：无论怎样选取合成列，得到的单群清单（合成因子）都相同',
      '这与「整数唯一分解为素数」完全平行——单群正是群论意义下的「素数」',
    ]);
  },
});

// ---------------------------------------------------------------- T75
/** T75 格林公式、高斯散度定理与斯托克斯公式。 */
const greenGaussStokesViz = defineViz({
  slug: 'green-gauss-stokes',
  title: '格林公式、高斯散度定理与斯托克斯公式',
  params: {
    pick: { type: 'select', options: ['格林公式（平面）', '高斯散度定理（体积）', '斯托克斯公式（曲面）'], default: '格林公式（平面）', label: '选择公式' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'pick', '格林公式（平面）');

    const v = equalView(f, 0, 0, 1.75, 60);
    grid(f, v, { divisions: 4, ticks: false });

    if (kind.startsWith('格林')) {
      // 平面区域 + 边界曲线
      const region: Array<[number, number]> = [];
      for (let i = 0; i <= 120; i++) {
        const t = (i * 2 * Math.PI) / 120;
        region.push([v.sx(1.15 * Math.cos(t) + 0.2 * Math.cos(3 * t)), v.sy(0.95 * Math.sin(t) + 0.2 * Math.sin(2 * t))]);
      }
      poly(f, region, { fill: 'rgba(102,126,234,0.28)', stroke: C.accent, lw: 2.4, close: true });
      // 方向箭头
      for (const t of [0.5, 2, 3.6, 5.2]) {
        const x = 1.15 * Math.cos(t) + 0.2 * Math.cos(3 * t);
        const y = 0.95 * Math.sin(t) + 0.2 * Math.sin(2 * t);
        dot(f, v.sx(x), v.sy(y), 4.5, C.warm);
      }
      text(f, '∮_∂D (P dx + Q dy) = ∬_D (∂Q/∂x − ∂P/∂y) dA', w / 2, 48, {
        align: 'center', font: 'bold 15px "Times New Roman", serif', color: C.warm,
      });
      text(f, '橙色点表示边界正方向（区域始终在左侧）', w / 2, 74, {
        align: 'center', color: C.fg, font: '13px system-ui',
      });
    } else if (kind.startsWith('高斯')) {
      // 立体 + 表面
      const cx = v.sx(0);
      const cy = v.sy(0);
      const R = 100;
      poly(f, [[cx - R, cy - R * 0.8], [cx + R, cy - R * 0.8], [cx + R, cy + R * 0.8], [cx - R, cy + R * 0.8]], {
        fill: 'rgba(56,178,172,0.25)', stroke: C.cyan, lw: 2.2,
      });
      for (let i = -2; i <= 2; i++) {
        const y = cy + i * (R * 0.3);
        poly(f, [[cx - R, y], [cx + R, y]], { stroke: 'rgba(160,174,192,0.22)', lw: 1 });
      }
      // 法向箭头
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        seg(f, cx + dx * R, cy + dy * R * 0.8, cx + dx * (R + 26), cy + dy * (R * 0.8 + 22), {
          color: C.warm, lw: 1.8,
        } as never);
      }
      text(f, '∬_∂V F·n dS = ∭_V ∇·F dV', w / 2, 48, {
        align: 'center', font: 'bold 16px "Times New Roman", serif', color: C.warm,
      });
      text(f, '橙色箭头为外法向 n；散度的体积分等于通量的面积分', w / 2, 74, {
        align: 'center', color: C.fg, font: '13px system-ui',
      });
    } else {
      // 曲面 + 边界曲线
      const surf: Array<[number, number]> = [];
      for (let i = 0; i <= 40; i++) {
        const u = -1.3 + (2.6 * i) / 40;
        for (let j = 0; j <= 16; j++) {
          const t = (j * 2 * Math.PI) / 16;
          void t;
        }
        surf.push([v.sx(u), v.sy(0.55 * Math.sin(u * 1.3))]);
      }
      poly(f, surf, { stroke: 'rgba(102,126,234,0.5)', lw: 1.4 });
      const boundary: Array<[number, number]> = [];
      for (let i = 0; i <= 120; i++) {
        const t = (i * 2 * Math.PI) / 120;
        boundary.push([v.sx(1.25 * Math.cos(t)), v.sy(0.5 * Math.sin(t))]);
      }
      poly(f, boundary, { stroke: C.warm, lw: 2.6, close: true });
      for (const t of [0.4, 2.4, 4.4]) {
        dot(f, v.sx(1.25 * Math.cos(t)), v.sy(0.5 * Math.sin(t)), 4.5, C.hot);
      }
      text(f, '∮_∂S F·dr = ∬_S (∇×F)·n dS', w / 2, 48, {
        align: 'center', font: 'bold 16px "Times New Roman", serif', color: C.warm,
      });
      text(f, '橙色为边界曲线 ∂S，其上的环量等于曲面上的旋度通量', w / 2, 74, {
        align: 'center', color: C.fg, font: '13px system-ui',
      });
    }

    heading(f, '向量分析三大积分公式');
    footnotes(f, [
      '三者是同一件事在不同维度下的表述：把「边界上的积分」化为「内部（或通量）的积分」',
      '切换下拉框可分别查看平面（格林）、体积（高斯）、曲面（斯托克斯）的情形',
      '它们是电磁学（麦克斯韦方程组）与流体力学的基本工具',
    ]);
  },
});

// ---------------------------------------------------------------- T76
/** T76 希尔伯特零点定理。 */
const hilbertNullstellensatzViz = defineViz({
  slug: 'hilbert-nullstellensatz',
  title: '希尔伯特零点定理',
  params: {
    degree: { type: 'range', min: 2, max: 4, default: 3, label: '曲线次数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const deg = Math.max(2, Math.round(num(params, 'degree', 3)));

    const v = equalView(f, 0, 0, 1.7, 60);
    grid(f, v, { divisions: 4, ticks: false });

    // 代数簇：y = x^deg 的曲线与 y = x 的交点（零点集）
    const curves = [1, 2, deg];
    curves.forEach((d, i) => {
      curve(f, v, (x) => Math.pow(x, d) * (x >= -1.25 && x <= 1.25 ? 1 : NaN), {
        color: [C.cyan, C.green, C.accent][i], lw: d === deg ? 2.6 : 1.4,
      } as never);
    });
    // 交点
    [[0, 0], [1, 1]].forEach(([x, y]) => dot(f, v.sx(x), v.sy(y), 5.5, C.hot));

    text(f, 'V(I) ⟷ I(V)', w / 2, 48, {
      align: 'center', font: 'bold 20px "Times New Roman", serif', color: C.warm,
    });
    text(f, '理想（多项式集合）⟷ 代数簇（公共零点集合）', w / 2, 76, {
      align: 'center', color: C.fg, font: '14px system-ui',
    });
    text(f, '零点定理：V(I) 为空 ⟺ 1 ∈ I（在代数闭域上）', w / 2, 100, {
      align: 'center', color: C.green, font: '13px system-ui',
    });

    // 左侧：多项式列表
    const polys = ['f₁ = y − x', 'f₂ = y − x²', `f₃ = y − x^${deg}`];
    polys.forEach((s, i) => {
      const y = h - 170 + i * 30;
      poly(f, [[56, y - 18], [56 + 170, y - 18], [56 + 170, y + 8], [56, y + 8]], {
        fill: i === 2 ? 'rgba(102,126,234,0.5)' : 'rgba(45,55,72,0.8)', close: true,
      });
      text(f, s, 66, y, { color: C.fg, font: '13px Consolas, monospace' });
    });
    text(f, '生成理想 I', 56, h - 190, { color: C.dim, font: '12px system-ui' });
    text(f, '红点 = 代数簇 V(I)（三条曲线的公共交点）', w - 60, h - 150, {
      align: 'right', color: C.hot, font: '12px system-ui',
    });

    heading(f, '希尔伯特零点定理：理想与代数簇的对应');
    footnotes(f, [
      '代数簇 V(I) 是理想 I 中所有多项式的公共零点集合，反过来 I(V) 是它的消失理想',
      '零点定理指出：在代数闭域上，这个对应「几乎」是双射（严格说 I(V(I)) = √I）',
      '它把「解方程组」的几何问题与「研究理想」的代数问题完全打通，是代数几何的起点',
    ]);
  },
});

// ---------------------------------------------------------------- T77
/** T77 皮亚诺公理。 */
const peanoAxiomsViz = defineViz({
  slug: 'peano-axioms',
  title: '皮亚诺公理',
  params: {
    upto: { type: 'range', min: 4, max: 12, default: 7, label: '展示到几' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const upto = Math.max(2, Math.round(num(params, 'upto', 7)));

    const axioms = [
      '1° 0 是自然数',
      '2° 每个自然数 n 有后继 S(n)',
      '3° 0 不是任何数的后继',
      '4° S 是单射：S(m) = S(n) ⇒ m = n',
      '5° 归纳公理：含 0 且对后继封闭的集合 = 全体自然数',
    ];
    axioms.forEach((s, i) => {
      text(f, s, 56, 110 + i * 34, { color: i === 4 ? C.warm : C.fg, font: (i === 4 ? 'bold ' : '') + '13px system-ui' });
    });
    void w;

    // 后继链
    const y = h - 130;
    const gap = Math.min(80, (w - 160) / upto);
    for (let i = 0; i < upto; i++) {
      const x = 70 + i * gap;
      poly(f, [[x, y], [x + 46, y], [x + 46, y + 46], [x, y + 46]], {
        fill: i === 0 ? 'rgba(102,126,234,0.6)' : 'rgba(56,178,172,0.45)',
        stroke: C.accent, lw: 1.4, close: true,
      });
      text(f, String(i), x + 23, y + 30, { align: 'center', color: C.fg, font: 'bold 16px system-ui' });
      if (i < upto - 1) {
        seg(f, x + 46, y + 23, x + gap, y + 23, { color: C.warm, lw: 1.8 } as never);
        text(f, 'S', x + 46 + (gap - 46) / 2, y + 14, { align: 'center', color: C.warm, font: '11px system-ui' });
      }
    }
    text(f, '0 → 1 → 2 → 3 → …（后继映射 S）', 70, y - 12, { color: C.dim, font: '12px system-ui' });
    text(f, '蓝色 = 起点 0；箭头 = 后继运算', 70, y + 70, { color: C.dim, font: '12px system-ui' });

    heading(f, '皮亚诺公理：自然数的公理化');
    footnotes(f, [
      '五条公理（或等价的表达）完整刻画了自然数的结构，其他性质都可由它们推出',
      '归纳公理（5°）是数学归纳法的合法性来源，也是「自然数只有这些」的关键',
      '这是现代公理化方法的早期范例，希尔伯特后来把同样思路用到几何（见 T80）',
    ]);
  },
});

// ---------------------------------------------------------------- T78
/** T78 希尔伯特基定理。 */
const hilbertBasisViz = defineViz({
  slug: 'hilbert-basis-theorem',
  title: '希尔伯特基定理',
  params: {
    chain: { type: 'range', min: 2, max: 6, default: 4, label: '理想链长度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const len = Math.max(2, Math.round(num(params, 'chain', 4)));

    // 升链终止：I₁ ⊆ I₂ ⊆ I₃ ⊆ … 必在有限步稳定
    const topY = 130;
    const gap = Math.min(70, (h - 280) / len);
    for (let i = 0; i < len; i++) {
      const y = topY + i * gap;
      const bw = 150 + i * 28;
      const x = w / 2 - bw / 2;
      poly(f, [[x, y], [x + bw, y], [x + bw, y + 46], [x, y + 46]], {
        fill: `rgba(102,126,234,${0.3 + i * 0.12})`,
        stroke: C.accent, lw: 1.4, close: true,
      });
      text(f, `I${i + 1}`, x + bw / 2, y + 30, { align: 'center', color: C.fg, font: 'bold 14px system-ui' });
      if (i > 0) text(f, '⊆', x - 22, y + 30, { align: 'center', color: C.dim, font: '16px system-ui' });
    }
    const lastY = topY + (len - 1) * gap;
    text(f, '链必然终止：存在 N 使 I_N = I_{N+1} = …', w / 2, lastY + 76, {
      align: 'center', font: 'bold 15px system-ui', color: C.green,
    });

    text(f, '希尔伯特基定理', w / 2, 52, {
      align: 'center', font: 'bold 18px "Times New Roman", serif', color: C.warm,
    });
    text(f, '若 R 是诺特环，则多项式环 R[x] 也是诺特环', w / 2, 80, {
      align: 'center', color: C.fg, font: '14px system-ui',
    });
    text(f, '等价说法：任何理想都有限生成（理想升链必稳定）', w / 2, 104, {
      align: 'center', color: C.dim, font: '13px system-ui',
    });

    heading(f, '希尔伯特基定理：诺特环上的多项式环仍是诺特环');
    footnotes(f, [
      '「诺特环」= 理想升链必稳定的环，等价于每个理想都有限生成',
      '定理保证：即使在无穷大的多项式环里，任何理想也只需有限个生成元',
      '希尔伯特 1890 年的证明是「纯存在性」的、非构造的，当年曾遭到激烈质疑',
    ]);
  },
});

// ---------------------------------------------------------------- T79
/** T79 庞加莱同调理论基础。 */
const poincareHomologyViz = defineViz({
  slug: 'poincare-homology',
  title: '庞加莱同调理论基础',
  params: {
    pick: { type: 'select', options: ['球面 S²', '环面 T²', '双环面（亏格 2）'], default: '环面 T²', label: '曲面' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'pick', '环面 T²');

    const v = equalView(f, 0, 0, 1.6, 56);
    grid(f, v, { divisions: 4, ticks: false });

    // 用「多圆环」示意：洞的数量 = 第一贝蒂数
    const holes = kind.startsWith('球面') ? 0 : kind.startsWith('环面') ? 1 : 2;
    const R = 78;

    if (holes === 0) {
      const c: Array<[number, number]> = [];
      for (let i = 0; i <= 120; i++) {
        const a = (i * 2 * Math.PI) / 120;
        c.push([v.sx(R * Math.cos(a)), v.sy(R * Math.sin(a) * 0.9)]);
      }
      poly(f, c, { fill: 'rgba(102,126,234,0.28)', stroke: C.accent, lw: 2.2 });
      text(f, '球面：没有洞', w / 2, h - 108, { align: 'center', color: C.accent, font: '13px system-ui' });
    } else {
      for (let k = 0; k < holes; k++) {
        const cx = v.sx((k - (holes - 1) / 2) * 1.1);
        const cy = v.sy(0);
        const rx = 82;
        const ry = 52;
        const tube = 26;
        const torus: Array<[number, number]> = [];
        for (let i = 0; i <= 160; i++) {
          const a = (i * 2 * Math.PI) / 160;
          torus.push([
            cx + (rx + tube * Math.cos(6 * a)) * Math.cos(a),
            cy + (ry + tube * Math.cos(6 * a) * 0.68) * Math.sin(a),
          ]);
        }
        poly(f, torus, { stroke: C.accent, lw: 1.8, fill: 'rgba(102,126,234,0.2)', close: true });
        const hole: Array<[number, number]> = [];
        for (let i = 0; i <= 100; i++) {
          const a = (i * 2 * Math.PI) / 100;
          hole.push([cx + rx * 0.42 * Math.cos(a), cy + ry * 0.42 * Math.sin(a)]);
        }
        poly(f, hole, { stroke: C.hot, lw: 1.8 });
      }
      text(f, `${kind}：有 ${holes} 个「洞」`, w / 2, h - 108, {
        align: 'center', color: C.hot, font: '13px system-ui',
      });
    }

    // 贝蒂数
    const betti = holes === 0 ? [1, 0, 1] : holes === 1 ? [1, 2, 1] : [1, 4, 1];
    const names = ['b₀（连通块）', 'b₁（洞数）', 'b₂（空腔）'];
    text(f, '贝蒂数与欧拉示性数', w / 2, 48, {
      align: 'center', font: 'bold 16px system-ui', color: C.warm,
    });
    text(f, `${names[0]} = ${betti[0]}　${names[1]} = ${betti[1]}　${names[2]} = ${betti[2]}`, w / 2, 76, {
      align: 'center', color: C.fg, font: '14px Consolas, monospace',
    });
    text(f, `欧拉示性数 χ = b₀ − b₁ + b₂ = ${betti[0] - betti[1] + betti[2]}`, w / 2, 100, {
      align: 'center', color: C.green, font: '14px Consolas, monospace',
    });

    heading(f, '庞加莱同调理论：用代数刻画「洞」');
    footnotes(f, [
      '把空间剖分成复形（单形拼接），再按「边界」构造链复形，同调群刻画洞的个数与类型',
      'b₀ 数连通块，b₁ 数「环形洞」，b₂ 数「空腔」——交换曲面即可看到变化',
      '庞加莱由此创立代数拓扑，欧拉示性数也获得了统一的同调解释',
    ]);
  },
});

// ---------------------------------------------------------------- T80
/** T80 希尔伯特《几何基础》。 */
const hilbertGrundlagenViz = defineViz({
  slug: 'hilbert-grundlagen',
  title: '希尔伯特《几何基础》',
  params: {
    pick: { type: 'range', min: 0, max: 4, default: 0, label: '第几组公理' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const groups = [
      { name: 'Ⅰ 关联公理', n: 8, desc: '点、线、面的结合关系（两点定一直线等）' },
      { name: 'Ⅱ 顺序公理', n: 4, desc: '「介于」关系，保证直线上的次序与分割' },
      { name: 'Ⅲ 合同公理', n: 6, desc: '线段与角的合同（等长、等角）关系' },
      { name: 'Ⅳ 平行公理', n: 1, desc: '欧几里得第五公设的现代表述' },
      { name: 'Ⅴ 连续公理', n: 2, desc: '阿基米德公理与完备性公理' },
    ];
    const idx = Math.max(0, Math.min(groups.length - 1, Math.round(num(params, 'pick', 0))));

    groups.forEach((g, i) => {
      const y = 120 + i * 52;
      const on = i === idx;
      poly(f, [[56, y], [w - 56, y], [w - 56, y + 42], [56, y + 42]], {
        fill: on ? 'rgba(102,126,234,0.35)' : 'rgba(45,55,72,0.7)',
        stroke: on ? C.accent : C.grid, lw: on ? 2 : 1.2, close: true,
      });
      text(f, g.name, 70, y + 27, { color: on ? C.fg : C.dim, font: (on ? 'bold ' : '') + '14px system-ui' });
      text(f, `${g.n} 条`, w - 200, y + 27, { color: on ? C.warm : C.dim, font: '13px system-ui' });
      text(f, g.desc, w - 70, y + 27, { align: 'right', color: on ? C.fg : C.dim, font: '12px system-ui' });
    });

    const total = groups.reduce((a, b) => a + b.n, 0);
    text(f, `共 ${groups.length} 组、${total} 条公理重建欧氏几何`, w / 2, h - 82, {
      align: 'center', font: 'bold 15px system-ui', color: C.green,
    });
    text(f, '并讨论独立性、相容性与完备性 —— 现代公理化数学的范式', w / 2, h - 56, {
      align: 'center', color: C.dim, font: '13px system-ui',
    });

    heading(f, '希尔伯特《几何基础》：几何的公理化重建');
    footnotes(f, [
      '希尔伯特抛弃欧几里得「定义」中的直观成分，只用公理约束点、线、面的关系',
      '他首次系统讨论公理系统的相容性、独立性与完备性——「不定义的对象」也能做数学',
      '五组公理中随意选取一组切换查看，可看到各组的条数与作用',
    ]);
  },
});

registerViz(
  poissonDistributionViz,
  abelsTheoremViz,
  sturmLiouvilleViz,
  cayleyHamiltonViz,
  sylowTheoremsViz,
  riemannZetaViz,
  jordanHolderViz,
  greenGaussStokesViz,
  hilbertNullstellensatzViz,
  peanoAxiomsViz,
  hilbertBasisViz,
  poincareHomologyViz,
  hilbertGrundlagenViz,
);
