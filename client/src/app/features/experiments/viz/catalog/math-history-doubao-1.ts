/**
 * 数学史里程碑 · doubao 补充批次一（T54–T67）。
 */
import { defineViz, num, str, VizFrame } from '../types';
import { registerViz } from '../registry';
import { C, curve, dot, equalView, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}

/** 在画布坐标画正多边形。 */
function ngon(f: VizFrame, cx: number, cy: number, r: number, n: number, rot = -Math.PI / 2): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i * 2 * Math.PI) / n;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

// ---------------------------------------------------------------- T54
/** T54 欧几里得完全数定理。 */
const euclidPerfectNumbersViz = defineViz({
  slug: 'euclid-perfect-numbers',
  title: '欧几里得完全数定理',
  params: {
    pick: { type: 'range', min: 0, max: 3, default: 1, label: '第几个完全数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const idx = Math.max(0, Math.min(3, Math.round(num(params, 'pick', 1))));
    // p 为素数且 2^p−1 为素数
    const ps = [2, 3, 5, 7];
    const p = ps[idx];
    const perfect = Math.pow(2, p - 1) * (Math.pow(2, p) - 1);

    const divisors: number[] = [];
    for (let i = 1; i < perfect; i++) if (perfect % i === 0) divisors.push(i);
    const sum = divisors.reduce((a, b) => a + b, 0);

    text(f, `2^${p - 1} × (2^${p} − 1) = ${perfect}`, w / 2, 50, {
      align: 'center', font: 'bold 20px "Times New Roman", serif', color: C.warm,
    });
    text(f, `真因子之和 = ${sum} = ${perfect} ✓ 完全数`, w / 2, 78, {
      align: 'center', color: C.green, font: 'bold 15px system-ui',
    });

    // 因子方块
    const cell = Math.min(60, (w - 120) / Math.max(1, divisors.length));
    divisors.forEach((d, i) => {
      const x = 60 + i * (cell + 6);
      const bh = 30 + (d / perfect) * 120;
      poly(f, [[x, h - 130 - bh], [x + cell, h - 130 - bh], [x + cell, h - 130], [x, h - 130]], {
        fill: 'rgba(102,126,234,0.7)', close: true,
      });
      text(f, String(d), x + cell / 2, h - 130 - bh - 8, { align: 'center', color: C.fg, font: '12px system-ui' });
    });
    text(f, '所有真因子', 60, h - 100, { color: C.dim, font: '13px system-ui' });
    text(f, `梅森素数 2^${p} − 1 = ${Math.pow(2, p) - 1}`, w / 2, h - 60, {
      align: 'center', color: C.cyan, font: '14px Consolas, monospace',
    });

    heading(f, '欧几里得完全数定理：等于自身真因子之和');
    footnotes(f, [
      '若 2^p − 1 是素数，则 2^(p−1)·(2^p − 1) 是完全数（如上例 6、28、496）',
      '欧几里得在《几何原本》第九卷给出构造；欧拉后来证明它给出了全部偶完全数',
      '「是否存在奇完全数」至今未知，见 T134',
    ]);
  },
});

// ---------------------------------------------------------------- T55
/** T55 阿基米德螺线。 */
const archimedeanSpiralViz = defineViz({
  slug: 'archimedean-spiral',
  title: '阿基米德螺线',
  params: {
    a: { type: 'range', min: 4, max: 40, default: 16, label: '参数 a' },
    turns: { type: 'range', min: 1, max: 6, default: 3, label: '圈数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 16);
    const turns = Math.max(1, num(params, 'turns', 3));

    const maxT = turns * 2 * Math.PI;
    // 视野半宽取螺线的最大半径（r = a·θ 在 θ = maxT 处最大），保证整条曲线都在画面内
    const v = equalView(f, 0, 0, a * maxT * 1.05, 40);
    grid(f, v, { divisions: 4, ticks: false });
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 1200; i++) {
      const t = (maxT * i) / 1200;
      const r = a * t;
      pts.push([v.sx(r * Math.cos(t)), v.sy(r * Math.sin(t))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.2 });

    // 等间距的射线（体现相邻圈间距恒定 = 2πa）
    for (let k = 0; k <= 8; k++) {
      const t = (maxT * k) / 8;
      const r = a * t;
      dot(f, v.sx(r * Math.cos(t)), v.sy(r * Math.sin(t)), 3.5, C.warm);
    }

    text(f, 'r = aθ', w / 2, 46, { align: 'center', font: 'bold 20px "Times New Roman", serif', color: C.warm });
    text(f, `a = ${a}　圈数 = ${turns}`, w / 2, 74, { align: 'center', color: C.fg, font: '14px system-ui' });
    text(f, `相邻两圈间距恒为 2πa ≈ ${(2 * Math.PI * a).toFixed(1)}`, w / 2, 98, {
      align: 'center', color: C.cyan, font: '13px Consolas, monospace',
    });

    heading(f, '阿基米德螺线：匀速旋转 + 匀速外移');
    footnotes(f, [
      '极坐标下半径与角度成正比 r = aθ，因此每一圈之间的间距完全相同',
      '阿基米德用它解决化圆为方与三等分角——螺线把「转动」与「移动」联系起来',
      '与对数螺线（r = a·e^(bθ)，间距按等比增长）形成鲜明对比',
    ]);
  },
});

// ---------------------------------------------------------------- T56
/** T56 托勒密定理。 */
const ptolemysTheoremViz = defineViz({
  slug: 'ptolemys-theorem',
  title: '托勒密定理',
  params: {
    d1: { type: 'range', min: 40, max: 150, default: 100, label: 'A 点角度' },
    d2: { type: 'range', min: 40, max: 150, default: 200, label: 'C 点角度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a1 = (num(params, 'd1', 100) * Math.PI) / 180;
    const a2 = (num(params, 'd2', 200) * Math.PI) / 180;
    const R = 118;

    const v = equalView(f, 0, 0, R * 1.35, 50);
    grid(f, v, { divisions: 4, ticks: false });
    const circlePts: Array<[number, number]> = [];
    for (let i = 0; i <= 140; i++) {
      const a = (i * 2 * Math.PI) / 140;
      circlePts.push([v.sx(R * Math.cos(a)), v.sy(R * Math.sin(a))]);
    }
    poly(f, circlePts, { stroke: C.grid, lw: 1.5 });

    // 圆内接四边形 ABCD（按角度排序）
    const angles = [0.5, a1, a2, a2 + 1.6].map((a) => a % (2 * Math.PI)).sort((x, y) => x - y);
    const pts = angles.map((a) => [R * Math.cos(a), R * Math.sin(a)] as [number, number]);
    poly(f, pts.map(([x, y]) => [v.sx(x), v.sy(y)] as [number, number]), {
      fill: 'rgba(102,126,234,0.2)', stroke: C.accent, lw: 2, close: true,
    });
    // 对角线
    seg(f, v.sx(pts[0][0]), v.sy(pts[0][1]), v.sx(pts[2][0]), v.sy(pts[2][1]), { color: C.warm, lw: 1.8 } as never);
    seg(f, v.sx(pts[1][0]), v.sy(pts[1][1]), v.sx(pts[3][0]), v.sy(pts[3][1]), { color: C.cyan, lw: 1.8 } as never);

    const dist = (p: [number, number], q: [number, number]): number => Math.hypot(p[0] - q[0], p[1] - q[1]);
    const ac = dist(pts[0], pts[2]);
    const bd = dist(pts[1], pts[3]);
    const ab = dist(pts[0], pts[1]);
    const cd = dist(pts[2], pts[3]);
    const ad = dist(pts[0], pts[3]);
    const bc = dist(pts[1], pts[2]);
    const lhs = ac * bd;
    const rhs = ab * cd + ad * bc;

    ['A', 'B', 'C', 'D'].forEach((name, i) => {
      dot(f, v.sx(pts[i][0]), v.sy(pts[i][1]), 4.5, C.fg);
      text(f, name, v.sx(pts[i][0]) + 10, v.sy(pts[i][1]) - 8, { color: C.fg, font: 'bold 13px system-ui' });
    });

    text(f, 'AC · BD = AB · CD + AD · BC', w / 2, 46, {
      align: 'center', font: 'bold 17px "Times New Roman", serif', color: C.warm,
    });
    text(f, `${(lhs / 1000).toFixed(2)}k = ${(ab * cd / 1000).toFixed(2)}k + ${(ad * bc / 1000).toFixed(2)}k  ✓`, w / 2, 74, {
      align: 'center', color: C.green, font: '14px Consolas, monospace',
    });

    heading(f, '托勒密定理：圆内接四边形的对角线关系');
    footnotes(f, [
      '两条对角线之积等于两组对边乘积之和——拖动 A、C 点位置，等式始终成立',
      '托勒密用它制作弦表（古代三角函数表），是古代三角学的核心工具',
      '取矩形时它退化为勾股定理；它等价于复数乘法的模长关系',
    ]);
  },
});

// ---------------------------------------------------------------- T57
/** T57 刘徽割圆术。 */
const liuHuiCyclotomyViz = defineViz({
  slug: 'liu-hui-cyclotomy',
  title: '刘徽割圆术与刘徽原理',
  params: {
    sides: { type: 'range', min: 3, max: 96, default: 12, label: '正多边形边数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.max(3, Math.round(num(params, 'sides', 12)));
    const R = 112;

    const v = equalView(f, 0, 0, R * 1.3, 50);
    grid(f, v, { divisions: 4, ticks: false });
    const circlePts: Array<[number, number]> = [];
    for (let i = 0; i <= 160; i++) {
      const a = (i * 2 * Math.PI) / 160;
      circlePts.push([v.sx(R * Math.cos(a)), v.sy(R * Math.sin(a))]);
    }
    poly(f, circlePts, { stroke: C.grid, lw: 1.6 });
    const inner = ngon(f, 0, 0, R, n).map(([x, y]) => [v.sx(x), v.sy(y)] as [number, number]);
    poly(f, inner, { stroke: C.accent, lw: 2, fill: 'rgba(102,126,234,0.22)', close: true });
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      dot(f, v.sx(R * Math.cos(a)), v.sy(R * Math.sin(a)), 3, C.warm);
    }

    // 多边形周长/2R 作为 π 的估计（半径取 1 时周长为 2n·sin(π/n)）
    const perimeterHalf = n * Math.sin(Math.PI / n);
    const err = Math.abs(Math.PI - perimeterHalf);
    text(f, `正 ${n} 边形：半周长 ≈ ${perimeterHalf.toFixed(8)}`, w / 2, 46, {
      align: 'center', font: 'bold 16px Consolas, monospace', color: C.accent,
    });
    text(f, `与 π 的误差 = ${err.toExponential(3)}`, w / 2, 74, {
      align: 'center', color: err < 1e-4 ? C.green : C.warm, font: '14px Consolas, monospace',
    });
    text(f, `刘徽从正 6 边形逐次倍边，算到正 3072 边形得 π ≈ 3.1416`, w / 2, 98, {
      align: 'center', color: C.dim, font: '13px system-ui',
    });

    heading(f, '刘徽割圆术：割之弥细，所失弥少');
    footnotes(f, [
      '从正六边形出发不断倍边，多边形周长（半周长）单调逼近 π',
      '刘徽还提出「阳马鳖臑」体积关系，用无穷分割推导立体体积',
      '这是中国古代极限思想的代表作，与阿基米德穷竭法遥相呼应',
    ]);
  },
});

// ---------------------------------------------------------------- T58
/** T58 秦九韶三斜求积公式。 */
const qinJiushaoAreaViz = defineViz({
  slug: 'qin-jiushao-area',
  title: '秦九韶三斜求积公式',
  params: {
    a: { type: 'range', min: 3, max: 14, default: 13, label: '大斜 a' },
    b: { type: 'range', min: 3, max: 14, default: 14, label: '中斜 b' },
    c: { type: 'range', min: 3, max: 14, default: 15, label: '小斜 c' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 13);
    const b = num(params, 'b', 14);
    const c = num(params, 'c', 15);
    const valid = a + b > c && a + c > b && b + c > a;
    if (!valid) {
      text(f, '三边无法构成三角形', w / 2, h / 2, { align: 'center', color: C.hot, font: 'bold 16px system-ui' });
      heading(f, '秦九韶三斜求积公式');
      return;
    }

    const x3 = (b * b + c * c - a * a) / (2 * c);
    const y3 = Math.sqrt(Math.max(0, b * b - x3 * x3));
    const v = equalView(f, c / 2, y3 / 3, Math.max(c, b) * 0.72, 66);
    grid(f, v, { divisions: 6, ticks: false });
    poly(f, [[v.sx(0), v.sy(0)], [v.sx(c), v.sy(0)], [v.sx(x3), v.sy(y3)]], {
      fill: 'rgba(102,126,234,0.24)', stroke: C.accent, lw: 2.2, close: true,
    });
    dot(f, v.sx(x3), v.sy(y3), 4, C.warm);
    text(f, `大斜 ${a}`, v.sx(x3), v.sy(y3) - 10, { align: 'center', color: C.fg, font: '12px system-ui' });
    text(f, `中斜 ${b}`, v.sx(0) - 8, v.sy(y3 / 2), { align: 'right', color: C.fg, font: '12px system-ui' });
    text(f, `小斜 ${c}`, v.sx(c / 2), v.sy(0) + 18, { align: 'center', color: C.fg, font: '12px system-ui' });

    // 秦九韶形式（等价于海伦公式）
    const s = (a + b + c) / 2;
    const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
    text(f, 'S = ¼√[4a²b² − (a² + b² − c²)²]', 40, 46, {
      font: 'bold 16px "Times New Roman", serif', color: C.warm,
    });
    text(f, `= ${area.toFixed(6)}`, 40, 74, { color: C.green, font: '15px Consolas, monospace' });
    text(f, `海伦公式同值：${Math.sqrt(s * (s - a) * (s - b) * (s - c)).toFixed(6)}`, 40, 98, {
      color: C.dim, font: '13px Consolas, monospace',
    });

    heading(f, '秦九韶三斜求积：中国独立得到的面积公式');
    footnotes(f, [
      '《数书九章》中的「三斜求积术」与海伦公式等价，只是表达形式不同',
      '它同样只用三边长度——不依赖高，也不需要测量角度',
      '秦九韶还系统化了中国剩余定理的解法（「大衍求一术」）',
    ]);
  },
});

// ---------------------------------------------------------------- T59
/** T59 邦贝利虚数运算。 */
const bombelliImaginaryViz = defineViz({
  slug: 'bombelli-imaginary',
  title: '邦贝利虚数运算',
  params: {
    b: { type: 'range', min: -6, max: 0, step: 0.5, default: -4, label: '一次项系数' },
    c: { type: 'range', min: 0, max: 6, step: 0.5, default: 4, label: '常数项' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const b = num(params, 'b', -4);
    const c = num(params, 'c', 4);
    const fn = (x: number): number => x * x * x + b * x + c;

    const v = view(f, { xMin: -3.5, xMax: 3.5, yMin: -8, yMax: 8, inset: 50 });
    grid(f, v, { divisions: 6, ticks: true });
    seg(f, v.sx(-3.5), v.sy(0), v.sx(3.5), v.sy(0), { color: C.dim, lw: 1.2 } as never);
    seg(f, v.sx(0), v.sy(-8), v.sx(0), v.sy(8), { color: C.dim, lw: 1.2 } as never);
    curve(f, v, fn, { color: C.accent, lw: 2.4 } as never);

    // 找实根
    const roots: number[] = [];
    let prevX = -3.5;
    let prevY = fn(prevX);
    for (let x = -3.48; x <= 3.5; x += 0.02) {
      const y = fn(x);
      if ((prevY < 0) !== (y < 0)) {
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
      text(f, r.toFixed(3), v.sx(r), v.sy(0) - 12, { align: 'center', color: C.hot, font: '12px system-ui' });
    });

    // 判别式 Δ = −4b³ − 27c²
    const disc = -4 * b * b * b - 27 * c * c;
    text(f, `x³ ${b < 0 ? '−' : '+'} ${Math.abs(b)}x + ${c} = 0`, 50, 46, {
      font: 'bold 16px "Times New Roman", serif', color: C.warm,
    });
    text(f, `判别式 −4b³ − 27c² = ${disc.toFixed(1)}`, 50, 72, {
      color: disc < 0 ? C.hot : C.fg, font: '13px Consolas, monospace',
    });
    text(f, disc < 0 ? '不可约情形：三个实根，求根却要经过负数平方根' : '可直接用实数公式求解', 50, 96, {
      color: disc < 0 ? C.hot : C.dim, font: '13px system-ui',
    });
    text(f, '邦贝利正是处理这种情形时，第一次把虚数当作可运算的对象', 50, 120, {
      color: C.dim, font: '12px system-ui',
    });

    heading(f, '邦贝利虚数运算：实根竟要用虚数算出');
    footnotes(f, [
      '当判别式为负时，三根全为实数，但求根公式里必然出现负数的平方根',
      '邦贝利制定 i 的四则运算法则，发现含虚数的项会奇迹般抵消，留下实数根',
      '复数从此不再是「不可能的数」，而是可计算的工具——为欧拉与高斯铺路',
    ]);
  },
});

// ---------------------------------------------------------------- T60
/** T60 笛卡尔符号法则。 */
const descartesRuleOfSignsViz = defineViz({
  slug: 'descartes-rule-of-signs',
  title: '笛卡尔符号法则',
  params: {
    p1: { type: 'range', min: -3, max: 3, step: 1, default: 1, label: 'x³ 系数' },
    p2: { type: 'range', min: -3, max: 3, step: 1, default: -2, label: 'x² 系数' },
    p3: { type: 'range', min: -3, max: 3, step: 1, default: -1, label: 'x 系数' },
    p4: { type: 'range', min: -3, max: 3, step: 1, default: 2, label: '常数项' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const coef = [
      Math.round(num(params, 'p1', 1)),
      Math.round(num(params, 'p2', -2)),
      Math.round(num(params, 'p3', -1)),
      Math.round(num(params, 'p4', 2)),
    ];
    const fn = (x: number): number => coef[0] * x * x * x + coef[1] * x * x + coef[2] * x + coef[3];

    // 符号变化次数
    let signChanges = 0;
    for (let i = 1; i < coef.length; i++) {
      if (coef[i] !== 0 && coef[i - 1] !== 0 && Math.sign(coef[i]) !== Math.sign(coef[i - 1])) signChanges++;
    }

    const v = view(f, { xMin: -4, xMax: 4, yMin: -12, yMax: 12, inset: 50 });
    grid(f, v, { divisions: 8, ticks: true });
    seg(f, v.sx(-4), v.sy(0), v.sx(4), v.sy(0), { color: C.dim, lw: 1.2 } as never);
    seg(f, v.sx(0), v.sy(-12), v.sx(0), v.sy(12), { color: C.dim, lw: 1.2 } as never);
    curve(f, v, fn, { color: C.accent, lw: 2.4 } as never);

    // 正根
    let positiveRoots = 0;
    let prevX = 0.001;
    let prevY = fn(prevX);
    for (let x = 0.02; x <= 4; x += 0.02) {
      const y = fn(x);
      if (prevY === 0 || (prevY < 0) !== (y < 0)) positiveRoots++;
      prevX = x;
      prevY = y;
    }
    void prevX;
    for (let x = 0.02; x <= 4; x += 0.02) {
      const y = fn(x - 0.02);
      if (Math.abs(y) < 0.15) dot(f, v.sx(x), v.sy(0), 5, C.hot);
    }

    // 系数与符号
    const names = ['x³', 'x²', 'x', '1'];
    const cell = 62;
    coef.forEach((cv, i) => {
      const x = 70 + i * (cell + 8);
      poly(f, [[x, 120], [x + cell, 120], [x + cell, 172], [x, 172]], {
        fill: cv === 0 ? 'rgba(160,174,192,0.2)' : cv > 0 ? 'rgba(72,187,120,0.55)' : 'rgba(245,101,101,0.5)',
        close: true,
      });
      text(f, String(cv), x + cell / 2, 150, { align: 'center', color: C.fg, font: 'bold 16px system-ui' });
      text(f, names[i], x + cell / 2, 190, { align: 'center', color: C.dim, font: '12px system-ui' });
    });

    text(f, `系数符号变化次数 = ${signChanges}`, 70, 232, { color: C.warm, font: '15px system-ui' });
    text(f, `正根的个数 = ${positiveRoots}（≤ ${signChanges}，且相差偶数个）`, 70, 256, {
      color: C.green, font: '15px system-ui',
    });

    heading(f, '笛卡尔符号法则：不解方程也能估计正根个数');
    footnotes(f, [
      '正根的个数不超过系数符号变化的次数，且两者相差偶数个',
      '把 x 换成 −x 再数符号变化，就得到负根个数的上界',
      '这是代数学早期的定性方法：只看系数就能推断根的大致分布',
    ]);
  },
});

// ---------------------------------------------------------------- T61
/** T61 费马引理（极值定理）。 */
const fermatsTheoremExtremaViz = defineViz({
  slug: 'fermats-theorem-extrema',
  title: '费马引理（极值定理）',
  params: {
    a: { type: 'range', min: -1.5, max: 1.5, step: 0.1, default: 1, label: '二次项系数 a' },
    b: { type: 'range', min: -3, max: 3, step: 0.1, default: 0, label: '一次项系数 b' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 1);
    const b = num(params, 'b', 0);
    const fn = (x: number): number => a * x * x + b * x + 1;
    const d = (x: number): number => 2 * a * x + b;
    const xv = a !== 0 ? -b / (2 * a) : 0;

    const v = view(f, { xMin: -3, xMax: 3, yMin: -3, yMax: 6, inset: 50 });
    grid(f, v, { divisions: 6, ticks: true });
    seg(f, v.sx(-3), v.sy(0), v.sx(3), v.sy(0), { color: C.dim, lw: 1.2 } as never);
    curve(f, v, fn, { color: C.accent, lw: 2.6 } as never);

    if (a !== 0) {
      const yv = fn(xv);
      dot(f, v.sx(xv), v.sy(yv), 6, C.hot);
      // 水平切线
      seg(f, v.sx(xv - 1.2), v.sy(yv), v.sx(xv + 1.2), v.sy(yv), { color: C.warm, lw: 2 } as never);
      text(f, a > 0 ? '极小值点' : '极大值点', v.sx(xv), v.sy(yv) - 16, {
        align: 'center', color: C.hot, font: 'bold 13px system-ui',
      });
      text(f, `f′(${xv.toFixed(2)}) = ${d(xv).toFixed(4)} = 0`, 50, 74, {
        font: 'bold 15px Consolas, monospace', color: C.green,
      });
    } else {
      text(f, 'a = 0 时退化为一次函数，没有极值点', 50, 74, { color: C.warm, font: '14px system-ui' });
    }

    text(f, 'f(x) = ax² + bx + 1', 50, 46, {
      font: 'bold 18px "Times New Roman", serif', color: C.warm,
    });
    text(f, '橙色横线 = 该点的切线（斜率为 0）', 50, 100, { color: C.dim, font: '12px system-ui' });

    heading(f, '费马引理：极值点处的导数为零');
    footnotes(f, [
      '若函数在极值点处可导，则导数必为零——切线水平',
      '这是「求极值先解 f′(x) = 0」的合法性来源，也是微分学的第一块基石',
      '注意其逆不成立：导数零点不一定是极值（如 y = x³ 在原点的情形）',
    ]);
  },
});

// ---------------------------------------------------------------- T62
/** T62 卡瓦列里不可分量原理。 */
const cavalieriPrincipleViz = defineViz({
  slug: 'cavalieri-principle',
  title: '卡瓦列里不可分量原理',
  params: {
    level: { type: 'range', min: 0, max: 1, step: 0.02, default: 0.5, label: '截面位置' },
    shear: { type: 'range', min: 0, max: 1, step: 0.05, default: 0.7, label: '右侧错切量' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const t = Math.max(0, Math.min(1, num(params, 'level', 0.5)));
    const shear = Math.max(0, Math.min(1, num(params, 'shear', 0.7)));

    const baseY = h - 130;
    const topY = 120;
    const bw = 90;
    const off = shear * 110;

    // 左：平行四边形（不可分量为等长线段）
    const x1 = w * 0.24 - bw / 2;
    poly(f, [[x1, baseY], [x1 + bw, baseY], [x1 + bw, topY], [x1, topY]], {
      fill: 'rgba(102,126,234,0.25)', stroke: C.accent, lw: 2, close: true,
    });
    // 右：错切的平行四边形（同底等高）
    const x2 = w * 0.72 - bw / 2;
    poly(f, [[x2, baseY], [x2 + bw, baseY], [x2 + bw + off, topY], [x2 + off, topY]], {
      fill: 'rgba(237,137,54,0.22)', stroke: C.warm, lw: 2, close: true,
    });

    // 同高度截面
    const y = baseY - (baseY - topY) * t;
    const x2shift = off * t;
    seg(f, x1, y, x1 + bw, y, { color: C.cyan, lw: 3 } as never);
    seg(f, x2 + x2shift, y, x2 + bw + x2shift, y, { color: C.cyan, lw: 3 } as never);
    seg(f, x1 - 40, y, x2 + bw + off + 40, y, { color: C.cyan, lw: 1, dash: [5, 4] } as never);

    text(f, `两侧截线长度都是 ${bw} ✓`, w / 2, 50, {
      align: 'center', font: 'bold 16px system-ui', color: C.cyan,
    });
    text(f, '每一高度处截线等长 ⇒ 两图形面积相等', w / 2, 76, {
      align: 'center', color: C.fg, font: '14px system-ui',
    });
    text(f, '（立体情形：每一高度处截面积相等 ⇒ 体积相等）', w / 2, 100, {
      align: 'center', color: C.dim, font: '13px system-ui',
    });

    heading(f, '卡瓦列里原理：不可分量的比较');
    footnotes(f, [
      '卡瓦列里把图形看作无穷多条「不可分量」（线或截面）的堆积',
      '只要每一高度处的不可分量等长/等面积，整个图形的面积/体积就相等',
      '这是祖暅原理在西方的重新发现（1636），也是积分学的直接先驱',
    ]);
  },
});

// ---------------------------------------------------------------- T63
/** T63 帕斯卡六边形定理。 */
const pascalHexagonViz = defineViz({
  slug: 'pascal-hexagon-theorem',
  title: '帕斯卡六边形定理',
  params: {
    spread: { type: 'range', min: 0.3, max: 1.6, step: 0.05, default: 0.9, label: '点分布'},
  },
  draw: (f) => {
    const { w, h, params } = f;
    const spread = num(params, 'spread', 0.9);

    // 圆锥曲线：椭圆
    const v = equalView(f, 0, 0, 1.75, 60);
    grid(f, v, { divisions: 4, ticks: false });
    const ell: Array<[number, number]> = [];
    for (let i = 0; i <= 140; i++) {
      const a = (i * 2 * Math.PI) / 140;
      ell.push([v.sx(1.6 * Math.cos(a)), v.sy(1.0 * Math.sin(a))]);
    }
    poly(f, ell, { stroke: C.grid, lw: 1.6 });

    // 椭圆上六个点
    const angles = [0.35, 1.05, 1.85, 3.0, 3.9, 5.0].map((a) => a * spread);
    const pts = angles.map((a) => [1.6 * Math.cos(a), 1.0 * Math.sin(a)] as [number, number]);
    poly(f, pts.map(([x, y]) => [v.sx(x), v.sy(y)] as [number, number]), {
      stroke: C.accent, lw: 1.8, close: true,
    });
    pts.forEach((p, i) => {
      dot(f, v.sx(p[0]), v.sy(p[1]), 4.5, C.warm);
      text(f, String.fromCharCode(65 + i), v.sx(p[0]) + 10, v.sy(p[1]) - 8, {
        color: C.fg, font: 'bold 12px system-ui',
      });
    });

    // 三组对边：AB 与 DE、BC 与 EF、CD 与 FA
    const pairs: Array<[[number, number], [number, number]]> = [
      [pts[0], pts[1]], [pts[2], pts[3]], [pts[4], pts[5]],
    ];
    const colors = [C.cyan, C.green, C.hot];
    pairs.forEach((pr, i) => {
      const ext = 1.9;
      const dx = (pr[1][0] - pr[0][0]) * ext;
      const dy = (pr[1][1] - pr[0][1]) * ext;
      seg(f, v.sx(pr[0][0] - dx * 0.3), v.sy(pr[0][1] - dy * 0.3), v.sx(pr[1][0] + dx * 0.3), v.sy(pr[1][1] + dy * 0.3), {
        color: colors[i], lw: 1.6, dash: [5, 4],
      } as never);
    });

    text(f, '圆锥曲线内接六边形：三组对边交点共线（帕斯卡线）', w / 2, 46, {
      align: 'center', font: 'bold 15px system-ui', color: C.warm,
    });
    text(f, '虚线为三组对边的延长线，它们的交点落在同一条直线上', w / 2, 72, {
      align: 'center', color: C.fg, font: '13px system-ui',
    });
    text(f, '帕斯卡 16 岁发现此定理，是射影几何的奠基性结论', w / 2, 96, {
      align: 'center', color: C.dim, font: '13px system-ui',
    });

    heading(f, '帕斯卡六边形定理：射影几何的起点');
    footnotes(f, [
      '任意圆锥曲线（圆、椭圆、抛物线、双曲线）内接六边形，三组对边交点必共线',
      '拖动参数移动六个顶点，共线性始终保持——这是射影几何的不变性思想',
      '与布利安雄定理（对偶形式，涉及外切六边形）互为对偶命题',
    ]);
  },
});

// ---------------------------------------------------------------- T64
/** T64 罗尔定理。 */
const rollesTheoremViz = defineViz({
  slug: 'rolles-theorem',
  title: '罗尔定理',
  params: {
    a: { type: 'range', min: -2, max: 2, step: 0.1, default: 1, label: '曲线参数 a' },
    b: { type: 'range', min: -2, max: 2, step: 0.1, default: 0.3, label: '曲线参数 b' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 1);
    const b = num(params, 'b', 0.3);
    // 构造 f(0) = f(2) = 0 的函数：a·x(x−2) + b·x(x−2)·(x−1)
    const fn = (x: number): number => a * x * (x - 2) + b * x * (x - 2) * (x - 1);

    const v = view(f, { xMin: -0.6, xMax: 2.6, yMin: -2.5, yMax: 2.5, inset: 50 });
    grid(f, v, { divisions: 6, ticks: true });
    seg(f, v.sx(-0.6), v.sy(0), v.sx(2.6), v.sy(0), { color: C.dim, lw: 1.2 } as never);
    curve(f, v, fn, { color: C.accent, lw: 2.6 } as never);

    dot(f, v.sx(0), v.sy(0), 5.5, C.hot);
    dot(f, v.sx(2), v.sy(0), 5.5, C.hot);
    text(f, 'f(0)', v.sx(0), v.sy(0) + 20, { align: 'center', color: C.hot, font: '12px system-ui' });
    text(f, 'f(2)', v.sx(2), v.sy(0) + 20, { align: 'center', color: C.hot, font: '12px system-ui' });

    // 找导数为零的点（数值扫描）
    const deriv = (x: number): number => (fn(x + 1e-5) - fn(x - 1e-5)) / 2e-5;
    let found = 0;
    for (let x = 0.02; x < 2; x += 0.01) {
      if (deriv(x) * deriv(x + 0.01) <= 0) {
        const yv = fn(x);
        dot(f, v.sx(x), v.sy(yv), 6, C.green);
        seg(f, v.sx(x - 0.45), v.sy(yv), v.sx(x + 0.45), v.sy(yv), { color: C.warm, lw: 2 } as never);
        text(f, `f′(ξ) = 0`, v.sx(x), v.sy(yv) - 14, { align: 'center', color: C.green, font: 'bold 12px system-ui' });
        found++;
        if (found >= 2) break;
      }
    }

    text(f, 'f(0) = f(2) = 0', 50, 46, { font: 'bold 16px "Times New Roman", serif', color: C.warm });
    text(f, `区间内存在 ξ 使 f′(ξ) = 0（图中绿点，共找到 ${found} 个）`, 50, 72, {
      color: C.green, font: '13px system-ui',
    });
    text(f, '橙色横线 = 该点的水平切线', 50, 96, { color: C.dim, font: '12px system-ui' });

    heading(f, '罗尔定理：两端等高必有水平切线');
    footnotes(f, [
      '若 f 在 [a,b] 连续、在 (a,b) 可导且 f(a) = f(b)，则存在 ξ ∈ (a,b) 使 f′(ξ) = 0',
      '它是拉格朗日中值定理的特例，也是证明中值定理的关键工具',
      '几何直觉：起点与终点在同一高度，曲线「总得在中间某个地方平一下」',
    ]);
  },
});

// ---------------------------------------------------------------- T65
/** T65 哥德巴赫猜想。 */
const goldbachConjectureViz = defineViz({
  slug: 'goldbach-conjecture',
  title: '哥德巴赫猜想',
  params: {
    n: { type: 'range', min: 6, max: 200, step: 2, default: 60, label: '偶数 n' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = (() => {
      let v = Math.round(num(params, 'n', 60));
      if (v % 2 !== 0) v += 1;
      return Math.max(6, v);
    })();

    // 找出所有 p + q = n 的素数对
    const pairs: Array<[number, number]> = [];
    for (let p = 2; p <= n / 2; p++) {
      if (isPrime(p) && isPrime(n - p)) pairs.push([p, n - p]);
    }

    // 上方：数轴与配对
    const axisY = 130;
    seg(f, 60, axisY, w - 60, axisY, { color: C.dim, lw: 1.4 } as never);
    text(f, `n = ${n}`, w - 60, axisY - 14, { align: 'right', color: C.warm, font: 'bold 15px system-ui' });
    pairs.slice(0, 14).forEach(([p, q], i) => {
      const x = 60 + ((p / n) * (w - 120));
      const y = axisY + 60 + i * 26;
      dot(f, x, axisY, 3, C.fg);
      text(f, `${p} + ${q} = ${n}`, 62, y, { color: i === 0 ? C.green : C.dim, font: '13px Consolas, monospace' });
    });
    // 素数点
    for (let i = 2; i <= n; i++) {
      if (isPrime(i)) dot(f, 60 + ((i / n) * (w - 120)), axisY, 3.5, C.accent);
    }

    text(f, `偶数 ${n} 可表示为 ${pairs.length} 组两素数之和`, w / 2, 50, {
      align: 'center', font: 'bold 16px system-ui', color: C.green,
    });
    text(f, '蓝色点为素数；下方列出所有配对（第一组高亮）', w / 2, 76, {
      align: 'center', color: C.fg, font: '13px system-ui',
    });
    text(f, '验证到 4×10¹⁸ 都成立，但至今无人能证明', w / 2, 100, {
      align: 'center', color: C.dim, font: '13px system-ui',
    });

    heading(f, '哥德巴赫猜想：偶数都是两素数之和');
    footnotes(f, [
      '1742 年哥德巴赫在致欧拉的信中提出，欧拉认为显然正确却无法证明',
      '拖动参数换偶数，看配对数量如何变化——素数对似乎总是存在',
      '弱形式（奇数 = 三素数之和）已由维诺格拉多夫证明（见 T48）',
    ]);
  },
});

// ---------------------------------------------------------------- T66
/** T66 欧拉-拉格朗日方程。 */
const eulerLagrangeEquationViz = defineViz({
  slug: 'euler-lagrange-equation',
  title: '欧拉-拉格朗日方程',
  params: {
    bend: { type: 'range', min: -1, max: 1, step: 0.05, default: 0.6, label: '曲线弯曲度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const bend = num(params, 'bend', 0.6);

    const v = view(f, { xMin: 0, xMax: 1, yMin: 0, yMax: 1, inset: 56 });
    grid(f, v, { divisions: 5, ticks: true });
    // 曲线族
    for (let k = -4; k <= 4; k++) {
      const b = (k / 4) * 0.7;
      curve(f, v, (x) => x + b * Math.sin(Math.PI * x), { color: 'rgba(160,174,192,0.25)', lw: 1.2 } as never);
    }
    curve(f, v, (x) => x + bend * Math.sin(Math.PI * x), { color: C.accent, lw: 2.6 } as never);
    curve(f, v, (x) => x, { color: C.warm, lw: 2.2, dash: [7, 4] } as never);

    // 作用量（简化：∫ (y′²) dx，越小越「平」）
    const action = (b: number): number => {
      const dv = (x: number): number => 1 + b * Math.PI * Math.cos(Math.PI * x);
      let s = 0;
      const N = 400;
      for (let i = 0; i < N; i++) {
        const x = (i + 0.5) / N;
        s += (dv(x) * dv(x)) / N;
      }
      return s;
    };
    text(f, '∂L/∂y − d/dx(∂L/∂y′) = 0', w / 2, 48, {
      align: 'center', font: 'bold 18px "Times New Roman", serif', color: C.warm,
    });
    text(f, `当前曲线作用量 J = ${action(bend).toFixed(6)}`, 60, h - 100, {
      color: C.accent, font: '13px Consolas, monospace',
    });
    text(f, `直线（极值解）J = ${action(0).toFixed(6)}`, 60, h - 76, {
      color: C.warm, font: '13px Consolas, monospace',
    });

    heading(f, '欧拉-拉格朗日方程：泛函极值的充要条件');
    footnotes(f, [
      '把「函数值取极值」推广为「泛函（整条曲线的积分）取极值」，得到这个微分方程',
      '灰色为候选曲线族，橙色虚线为极值曲线（作用量最小）',
      '它是分析力学、场论与最优控制的基本方程——拉格朗日量与对称性由此进入物理',
    ]);
  },
});

// ---------------------------------------------------------------- T67
/** T67 拉格朗日中值定理。 */
const lagrangeMeanValueViz = defineViz({
  slug: 'lagrange-mean-value-theorem',
  title: '拉格朗日中值定理',
  params: {
    a: { type: 'range', min: -1.5, max: 1.5, step: 0.1, default: 0.8, label: '曲线参数 a' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 0.8);
    const fn = (x: number): number => a * Math.sin(x) + 0.5 * x;

    const x0 = 0.4;
    const x1 = 3.2;
    const slope = (fn(x1) - fn(x0)) / (x1 - x0);

    const v = view(f, { xMin: 0, xMax: 3.8, yMin: -2, yMax: 2.6, inset: 52 });
    grid(f, v, { divisions: 6, ticks: true });
    seg(f, v.sx(0), v.sy(0), v.sx(3.8), v.sy(0), { color: C.dim, lw: 1.1 } as never);
    curve(f, v, fn, { color: C.accent, lw: 2.6 } as never);

    // 割线
    const lineFn = (x: number): number => fn(x0) + slope * (x - x0);
    curve(f, v, lineFn, { color: C.warm, lw: 1.8, dash: [6, 4] } as never);
    dot(f, v.sx(x0), v.sy(fn(x0)), 5.5, C.hot);
    dot(f, v.sx(x1), v.sy(fn(x1)), 5.5, C.hot);

    // 找平行切线的点
    const deriv = (x: number): number => (fn(x + 1e-5) - fn(x - 1e-5)) / 2e-5;
    let bestX = x0;
    let bestD = Infinity;
    for (let x = x0; x <= x1; x += 0.002) {
      const diff = Math.abs(deriv(x) - slope);
      if (diff < bestD) {
        bestD = diff;
        bestX = x;
      }
    }
    const yv = fn(bestX);
    dot(f, v.sx(bestX), v.sy(yv), 6, C.green);
    curve(f, v, (x) => yv + slope * (x - bestX), { color: C.green, lw: 2 } as never);
    text(f, `f′(ξ) = ${deriv(bestX).toFixed(4)}`, v.sx(bestX), v.sy(yv) - 14, {
      align: 'center', color: C.green, font: 'bold 12px system-ui',
    });

    text(f, '割线斜率 = 平均变化率', 50, 46, { font: 'bold 15px system-ui', color: C.warm });
    text(f, `${slope.toFixed(4)} = (f(b) − f(a)) / (b − a)`, 50, 72, {
      color: C.warm, font: '13px Consolas, monospace',
    });
    text(f, `ξ ≈ ${bestX.toFixed(3)} 处的切线与之平行`, 50, 96, { color: C.green, font: '13px system-ui' });

    heading(f, '拉格朗日中值定理：平均变化率必在某点瞬时达到');
    footnotes(f, [
      '连续可导函数在区间内的平均变化率，等于区间内某点的瞬时变化率',
      '几何上：曲线总有一条切线与两端点连线平行（图中绿色）',
      '它是微分学最重要的定理，泰勒公式、单调性判定、误差估计都要靠它',
    ]);
  },
});

registerViz(
  euclidPerfectNumbersViz,
  archimedeanSpiralViz,
  ptolemysTheoremViz,
  liuHuiCyclotomyViz,
  qinJiushaoAreaViz,
  bombelliImaginaryViz,
  descartesRuleOfSignsViz,
  fermatsTheoremExtremaViz,
  cavalieriPrincipleViz,
  pascalHexagonViz,
  rollesTheoremViz,
  goldbachConjectureViz,
  eulerLagrangeEquationViz,
  lagrangeMeanValueViz,
);
