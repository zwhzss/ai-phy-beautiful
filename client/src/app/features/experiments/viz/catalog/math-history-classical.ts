/**
 * 数学史里程碑 · 第二批（T15–T27：从古典证明到分析学的黎明）。
 */
import { defineViz, num, str, VizFrame } from '../types';
import { registerViz } from '../registry';
import { C, curve, dot, equalView, footnotes, grid, heading, matrixView, poly, rng, scatter, seg, text, view } from '../canvas';

function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}

// ---------------------------------------------------------------- T15
/** T15 素数无穷性定理（欧几里得反证法）。 */
const infinitudeOfPrimesViz = defineViz({
  slug: 'infinitude-of-primes',
  title: '素数无穷性定理',
  params: {
    k: { type: 'range', min: 2, max: 8, default: 5, label: '假设只取前 k 个素数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const k = Math.max(1, Math.round(num(params, 'k', 5)));
    const primes: number[] = [];
    for (let i = 2; primes.length < k; i++) if (isPrime(i)) primes.push(i);

    let prod = 1;
    primes.forEach((p) => (prod *= p));
    const next = prod + 1;

    // 序列展示
    const cellW = Math.min(90, (w - 100) / k);
    primes.forEach((p, i) => {
      const x = 50 + i * (cellW + 10);
      poly(f, [[x, 120], [x + cellW, 120], [x + cellW, 176], [x, 176]], { fill: 'rgba(72,187,120,0.6)', close: true });
      text(f, String(p), x + cellW / 2, 154, { align: 'center', color: C.fg, font: 'bold 20px system-ui' });
    });
    text(f, '假设：素数只有这 ' + k + ' 个', w / 2, 96, { align: 'center', color: C.dim, font: '13px system-ui' });

    text(f, `N = ${primes.join(' × ')} + 1 = ${prod} + 1 = ${next}`, w / 2, 232, {
      align: 'center', font: 'bold 18px Consolas, monospace', color: C.warm,
    });

    // N 的余数分析
    text(f, 'N 除以其中任何一个素数都余 1：', w / 2, 274, { align: 'center', color: C.fg, font: '14px system-ui' });
    primes.slice(0, 4).forEach((p, i) => {
      text(f, `${next} ÷ ${p} 余 1`, 80 + i * 170, 306, { color: C.cyan, font: '13px Consolas, monospace' });
    });
    text(f, `⇒ N 必含一个新的素因子（或 N 本身是素数）⇒ 矛盾！`, w / 2, 348, {
      align: 'center', color: C.hot, font: 'bold 15px system-ui',
    });
    text(f, `例：2×3×5×7×11 + 1 = 2311，2311 是素数`, w / 2, 382, {
      align: 'center', color: C.dim, font: '13px system-ui',
    });

    heading(f, '素数无穷性：把有限个素数全乘起来再加一');
    footnotes(f, [
      '欧几里得《几何原本》第九卷的证明，被誉「最美证明之一」',
      '它只用了「每个大于 1 的整数都有素因子」这一条基本事实',
      `当前 k = ${k}：连乘得 ${prod}，加 1 得 ${next}`,
    ]);
  },
});

// ---------------------------------------------------------------- T16
/** T16 阿基米德求圆面积与球体积（穷竭法）。 */
const archimedesCircleSphereViz = defineViz({
  slug: 'archimedes-circle-sphere',
  title: '阿基米德求圆面积与球体积',
  params: {
    sides: { type: 'range', min: 3, max: 48, default: 8, label: '内接正多边形边数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.max(3, Math.round(num(params, 'sides', 8)));
    const r = 100;

    const v = equalView(f, 0, 0, 135, 60);
    grid(f, v, { divisions: 4, ticks: false });
    // 圆（阿基米德用内接多边形逼近）
    const circlePts: Array<[number, number]> = [];
    for (let i = 0; i <= 120; i++) {
      const a = (i * 2 * Math.PI) / 120;
      circlePts.push([v.sx(r * Math.cos(a)), v.sy(r * Math.sin(a))]);
    }
    poly(f, circlePts, { stroke: C.accent, lw: 2.2 });

    // 内接正 n 边形
    const inner: Array<[number, number]> = [];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      inner.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    poly(f, inner.map(([x, y]) => [v.sx(x), v.sy(y)] as [number, number]), {
      fill: 'rgba(56,178,172,0.28)', stroke: C.cyan, lw: 1.8, close: true,
    });

    const polyArea = (0.5 * n * r * r * Math.sin((2 * Math.PI) / n));
    const circleArea = Math.PI * r * r;

    text(f, `内接正 ${n} 边形面积 = ${polyArea.toFixed(0)}`, 50, 50, {
      font: 'bold 15px system-ui', color: C.cyan,
    });
    text(f, `圆面积 πr² = ${circleArea.toFixed(0)}`, 50, 76, { color: C.accent, font: '15px system-ui' });
    text(f, `逼近比 = ${((polyArea / circleArea) * 100).toFixed(2)}%`, 50, 102, { color: C.warm, font: '15px Consolas, monospace' });

    // 球与外切圆柱（体积比 2:3）
    const cx = w * 0.76;
    const cy = h * 0.48;
    const rr = Math.min(h * 0.24, 78);
    poly(f, [[cx - rr, cy - rr], [cx + rr, cy - rr], [cx + rr, cy + rr], [cx - rr, cy + rr]], {
      stroke: C.dim, lw: 1.6,
    });
    poly(f, [[cx - rr, cy - rr], [cx + rr, cy - rr], [cx + rr * 0.72, cy - rr * 1.34], [cx - rr * 0.72, cy - rr * 1.34]], {
      stroke: C.dim, lw: 1.6, close: true,
    });
    poly(f, [[cx - rr, cy + rr], [cx + rr, cy + rr], [cx + rr * 0.72, cy + rr * 1.34], [cx - rr * 0.72, cy + rr * 1.34]], {
      stroke: C.dim, lw: 1.6, close: true,
    });
    const ball: Array<[number, number]> = [];
    for (let i = 0; i <= 100; i++) {
      const a = (i * 2 * Math.PI) / 100;
      ball.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    }
    poly(f, ball, { fill: 'rgba(237,137,54,0.35)', stroke: C.warm, lw: 2 });

    text(f, 'V球 : V圆柱 = 2 : 3', cx, cy + rr * 1.62, { align: 'center', color: C.warm, font: 'bold 14px system-ui' });

    heading(f, '穷竭法：用有限逼近无限');
    footnotes(f, [
      '固定圆内接正 n 边形，让 n 不断增大，面积单调逼近圆面积',
      '阿基米德由此求得 π 介于 223/71 与 22/7 之间，并用同类方法得出 V球 = 4/3·πr³',
      '他还证明了球与其外切圆柱的体积比为 2:3，并把这张图刻在自己墓碑上',
    ]);
  },
});

// ---------------------------------------------------------------- T17
/** T17 梅涅劳斯定理。 */
const menelausTheoremViz = defineViz({
  slug: 'menelaus-theorem',
  title: '梅涅劳斯定理',
  params: {
    t: { type: 'range', min: 0.15, max: 0.85, step: 0.01, default: 0.35, label: '截线位置' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const t = Math.max(0.05, Math.min(0.95, num(params, 't', 0.35)));

    const v = equalView(f, 0.5, 0.45, 1.15, 60);
    grid(f, v, { divisions: 6, ticks: false });

    const A: [number, number] = [0, 1.6];
    const B: [number, number] = [-1.2, 0];
    const Cc: [number, number] = [1.5, 0];
    poly(f, [[v.sx(A[0]), v.sy(A[1])], [v.sx(B[0]), v.sy(B[1])], [v.sx(Cc[0]), v.sy(Cc[1])]], {
      fill: 'rgba(102,126,234,0.18)', stroke: C.accent, lw: 2, close: true,
    });

    // 截线：与 AB 交于 F、BC 交于 D、CA 延长线交于 E
    const lerp = (p: [number, number], q: [number, number], s: number): [number, number] =>
      [p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s];
    const D = lerp(B, Cc, 0.58);
    const F = lerp(B, A, t);
    // E 由截线 DF 与 CA 延长线求交（数值近似）
    const dx = D[0] - F[0];
    const dy = D[1] - F[1];
    let E: [number, number] = [0, 0];
    for (let s = 0; s < 40; s += 0.01) {
      const P: [number, number] = [D[0] + dx * s, D[1] + dy * s];
      const onCA = Math.abs((P[0] - Cc[0]) * (A[1] - Cc[1]) - (P[1] - Cc[1]) * (A[0] - Cc[0]));
      if (onCA < 0.02 && P[0] < Cc[0]) {
        E = P;
        break;
      }
    }

    seg(f, v.sx(F[0]), v.sy(F[1]), v.sx(D[0]), v.sy(D[1]), { color: C.warm, lw: 2 } as never);
    seg(f, v.sx(D[0]), v.sy(D[1]), v.sx(E[0]), v.sy(E[1]), { color: C.warm, lw: 1.2, dash: [5, 4] } as never);

    const mark = (P: [number, number], name: string, color: string) => {
      dot(f, v.sx(P[0]), v.sy(P[1]), 4.5, color);
      text(f, name, v.sx(P[0]) + 10, v.sy(P[1]) - 8, { color, font: 'bold 13px system-ui' });
    };
    mark(A, 'A', C.fg);
    mark(B, 'B', C.fg);
    mark(Cc, 'C', C.fg);
    mark(D, 'D', C.cyan);
    mark(E, 'E', C.cyan);
    mark(F, 'F', C.cyan);

    // 比值
    const ratio = (p: [number, number], q: [number, number]): number => Math.hypot(q[0] - p[0], q[1] - p[1]);
    const af = ratio(A, F) / ratio(F, B);
    const bd = ratio(B, D) / ratio(D, Cc);
    const ce = ratio(Cc, E) / ratio(E, A);
    const prod = (af * bd * ce);

    text(f, '(AF/FB) × (BD/DC) × (CE/EA) = 1', w / 2, 46, {
      align: 'center', font: 'bold 17px "Times New Roman", serif', color: C.warm,
    });
    text(f, `${af.toFixed(3)} × ${bd.toFixed(3)} × ${ce.toFixed(3)} = ${prod.toFixed(3)}`, w / 2, 74, {
      align: 'center', color: Math.abs(prod - 1) < 0.02 ? C.green : C.dim, font: '14px Consolas, monospace',
    });

    heading(f, '梅涅劳斯定理：一条直线截三角形的三段比之积恒为 1');
    footnotes(f, [
      '截线与三边（或其延长线）相交，三个有向比值相乘恰好为 1',
      '它是「共线」这一几何事实的代数表达——射影几何的先声',
      '拖动参数可看到：无论截线如何移动，乘积始终保持在 1 附近',
    ]);
  },
});

// ---------------------------------------------------------------- T18
/** T18 中国剩余定理。 */
const chineseRemainderViz = defineViz({
  slug: 'chinese-remainder-theorem',
  title: '中国剩余定理',
  params: {
    r3: { type: 'range', min: 0, max: 2, default: 2, label: '除以 3 的余数' },
    r5: { type: 'range', min: 0, max: 4, default: 3, label: '除以 5 的余数' },
    r7: { type: 'range', min: 0, max: 6, default: 2, label: '除以 7 的余数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const r3 = Math.round(num(params, 'r3', 2)) % 3;
    const r5 = Math.round(num(params, 'r5', 3)) % 5;
    const r7 = Math.round(num(params, 'r7', 2)) % 7;
    const M = 105; // 3×5×7

    const solutions: number[] = [];
    for (let x = 1; x <= M; x++) {
      if (x % 3 === r3 && x % 5 === r5 && x % 7 === r7) solutions.push(x);
    }
    const x0 = solutions.length ? solutions[0] : 0;

    // 数轴
    const axisY = h * 0.42;
    seg(f, 50, axisY, w - 50, axisY, { color: C.dim, lw: 1.4 } as never);
    for (let i = 0; i <= 10; i++) {
      const x = 50 + (i * (w - 100)) / 10;
      seg(f, x, axisY - 5, x, axisY + 5, { color: C.dim, lw: 1 } as never);
      text(f, String(i * 11), x, axisY + 22, { align: 'center', color: C.dim, font: '11px system-ui' });
    }
    // 解的位置
    solutions.forEach((s) => {
      const x = 50 + (s / M) * (w - 100);
      dot(f, x, axisY, 7, C.warm);
      text(f, String(s), x, axisY - 16, { align: 'center', color: C.warm, font: 'bold 13px system-ui' });
    });
    if (solutions.length > 1) {
      const span = 50 + (M / M) * (w - 100) - (50 + (solutions[0] / M) * (w - 100));
      seg(f, 50 + (solutions[0] / M) * (w - 100), axisY + 40, 50 + (M / M) * (w - 100), axisY + 40, {
        color: C.cyan, lw: 1.6,
      } as never);
      text(f, `周期 = 3×5×7 = ${M}`, (50 + (solutions[0] / M) * (w - 100) + w - 50) / 2, axisY + 62, {
        align: 'center', color: C.cyan, font: '13px system-ui',
      });
      void span;
    }

    // 同余式
    matrixView(f, [
      [1, 0, 0, r3],
      [0, 1, 0, r5],
      [0, 0, 1, r7],
    ], { x: 50, y: h - 190, size: 34, gap: 6, showValues: true, hue: 230 });

    text(f, `x ≡ ${r3} (mod 3)`, w - 300, h - 160, { color: C.fg, font: '14px Consolas, monospace' });
    text(f, `x ≡ ${r5} (mod 5)`, w - 300, h - 136, { color: C.fg, font: '14px Consolas, monospace' });
    text(f, `x ≡ ${r7} (mod 7)`, w - 300, h - 112, { color: C.fg, font: '14px Consolas, monospace' });
    text(f, solutions.length ? `最小正整数解 x = ${x0}` : '（1…105 内无解——不会发生）', w - 300, h - 82, {
      color: C.warm, font: 'bold 15px Consolas, monospace',
    });

    heading(f, '中国剩余定理：「物不知数」的解与唯一性');
    footnotes(f, [
      `三三数之剩 ${r3}、五五数之剩 ${r5}、七七数之剩 ${r7} ⇒ x = ${x0} + ${M}k`,
      '秦九韶在《数书九章》中提出「大衍求一术」系统求解，西方称中国剩余定理',
      '关键条件：3、5、7 两两互素 ⇒ 模 105 内解唯一，这就是「存在且唯一」',
    ]);
  },
});

// ---------------------------------------------------------------- T19
/** T19 阿耶波多的线性丢番图方程解法。 */
const aryabhataDiophantineViz = defineViz({
  slug: 'aryabhata-linear-diophantine',
  title: '阿耶波多的线性丢番图方程解法',
  params: {
    a: { type: 'range', min: 2, max: 12, default: 7, label: '系数 a' },
    b: { type: 'range', min: 2, max: 12, default: 11, label: '系数 b' },
    c: { type: 'range', min: 2, max: 60, default: 40, label: '常数 c' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = Math.max(1, Math.round(num(params, 'a', 7)));
    const b = Math.max(1, Math.round(num(params, 'b', 11)));
    const c = Math.max(1, Math.round(num(params, 'c', 40)));

    const xMax = Math.max(10, Math.ceil(c / a) + 2);
    const pts: Array<[number, number]> = [];
    for (let x = 0; x <= xMax; x++) {
      const y = (c - a * x) / b;
      if (y >= 0) pts.push([x, y]);
    }
    const yMax = Math.max(2, Math.ceil(c / b) + 1);

    const v = view(f, { xMin: -0.5, xMax: xMax + 0.5, yMin: -0.5, yMax: yMax + 0.5, inset: 56 });
    grid(f, v, { divisions: 8, ticks: true });
    seg(f, v.sx(-0.5), v.sy(0), v.sx(xMax + 0.5), v.sy(0), { color: C.dim, lw: 1.2 } as never);
    seg(f, v.sx(0), v.sy(-0.5), v.sx(0), v.sy(yMax + 0.5), { color: C.dim, lw: 1.2 } as never);
    curve(f, v, (x) => (c - a * x) / b, { color: C.accent2, lw: 1.6, dash: [5, 4] } as never);

    // 整数点
    const ints: Array<[number, number]> = [];
    for (let x = 0; x <= xMax; x++) {
      const y = (c - a * x) / b;
      if (y >= 0 && Math.abs(y - Math.round(y)) < 1e-9) ints.push([x, Math.round(y)]);
    }
    scatter(f, v, ints, { r: 5.5, color: C.warm });
    ints.slice(0, 4).forEach(([x, y]) => {
      text(f, `(${x}, ${y})`, v.sx(x) + 10, v.sy(y) - 10, { color: C.warm, font: '12px system-ui' });
    });

    const gcd = (m: number, n: number): number => (n === 0 ? m : gcd(n, m % n));
    const g = gcd(a, b);
    text(f, `${a}x + ${b}y = ${c}`, 50, 48, { font: 'bold 18px "Times New Roman", serif', color: C.warm });
    text(f, `gcd(${a}, ${b}) = ${g}`, 50, 74, { color: C.fg, font: '14px Consolas, monospace' });
    text(f, `整数解个数：${ints.length}${g > 1 && c % g !== 0 ? '（无解：c 不能被 gcd 整除）' : ''}`, 50, 96, {
      color: ints.length ? C.green : C.hot, font: '14px system-ui',
    });

    heading(f, '线性丢番图方程：直线上的整数点');
    footnotes(f, [
      'ax + by = c 的整数解是直线上「x、y 同时为整数」的点',
      '有解的条件是 gcd(a, b) 整除 c；有解时解构成等差数列（图中等间距的点）',
      '阿耶波多（约 500 年）给出了系统的求解算法，比欧洲早约千年',
    ]);
  },
});

// ---------------------------------------------------------------- T20
/** T20 韦达定理。 */
const vieteTheoremViz = defineViz({
  slug: 'viete-theorem',
  title: '韦达定理与符号代数',
  params: {
    p: { type: 'range', min: -6, max: 6, step: 0.5, default: -1, label: '两根之和 = −b/a' },
    q: { type: 'range', min: -8, max: 8, step: 0.5, default: -6, label: '两根之积 = c/a' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const sum = num(params, 'p', -1);
    const prod = num(params, 'q', -6);
    const D = sum * sum - 4 * prod;

    const v = view(f, { xMin: Math.min(-6, sum - 4), xMax: Math.max(6, sum + 4), yMin: -14, yMax: 14, inset: 50 });
    grid(f, v, { divisions: 8, ticks: true });
    seg(f, v.sx(v.xMin), v.sy(0), v.sx(v.xMax), v.sy(0), { color: C.dim, lw: 1.2 } as never);
    seg(f, v.sx(0), v.sy(v.yMin), v.sx(0), v.sy(v.yMax), { color: C.dim, lw: 1.2 } as never);
    // x² − sum·x + prod
    curve(f, v, (x) => x * x - sum * x + prod, { color: C.accent, lw: 2.4 } as never);

    if (D >= 0) {
      const r1 = (sum + Math.sqrt(D)) / 2;
      const r2 = (sum - Math.sqrt(D)) / 2;
      [r1, r2].forEach((r) => {
        dot(f, v.sx(r), v.sy(0), 6, C.hot);
        seg(f, v.sx(r), v.sy(0), v.sx(r), v.sy(r * r - sum * r + prod), { color: C.hot, lw: 1, dash: [4, 4] } as never);
      });
      text(f, `x₁ = ${r1.toFixed(2)}　x₂ = ${r2.toFixed(2)}`, 50, 48, { color: C.hot, font: 'bold 15px system-ui' });
    } else {
      text(f, '判别式 < 0：没有实根（两根为共轭复数）', 50, 48, { color: C.hot, font: '15px system-ui' });
    }

    text(f, `x² − (${sum})x + (${prod}) = 0`, 50, 74, { font: '16px "Times New Roman", serif', color: C.fg });
    text(f, `x₁ + x₂ = ${sum}　　x₁ · x₂ = ${prod}`, 50, 100, { color: C.green, font: 'bold 15px Consolas, monospace' });
    text(f, '（拖动参数，两根自动满足这两个关系）', 50, 124, { color: C.dim, font: '12px system-ui' });

    heading(f, '韦达定理：根与系数的关系');
    footnotes(f, [
      '两根之和 = −b/a，两根之积 = c/a —— 不解方程也能得到根的信息',
      '韦达率先用字母表示已知量与未知量（符号代数），方程理论从此可以「一般地」讨论',
      '对 n 次多项式：根之和 = −aₙ₋₁/aₙ，根的乘积 = (−1)ⁿa₀/aₙ',
    ]);
  },
});

// ---------------------------------------------------------------- T21
/** T21 牛顿-莱布尼茨公式。 */
const newtonLeibnizViz = defineViz({
  slug: 'newton-leibniz-formula',
  title: '牛顿-莱布尼茨公式',
  params: {
    x0: { type: 'range', min: 0.2, max: 3.6, step: 0.05, default: 2, label: '积分上限 x₀' },
    a: { type: 'range', min: 0.2, max: 1.5, step: 0.05, default: 0.6, label: '曲线参数 a' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const x0 = num(params, 'x0', 2);
    const a = num(params, 'a', 0.6);
    const fn = (x: number): number => a * x * x;

    const v = view(f, { xMin: 0, xMax: 4, yMin: 0, yMax: 9, inset: 46 });
    grid(f, v, { divisions: 6, ticks: true });

    // 面积填充（0 → x0）
    const steps = 120;
    const polyPts: Array<[number, number]> = [[v.sx(0), v.sy(0)]];
    for (let i = 0; i <= steps; i++) {
      const x = (x0 * i) / steps;
      polyPts.push([v.sx(x), v.sy(fn(x))]);
    }
    polyPts.push([v.sx(x0), v.sy(0)]);
    poly(f, polyPts, { fill: 'rgba(102,126,234,0.35)', close: true });
    curve(f, v, fn, { color: C.accent, lw: 2.4 } as never);
    seg(f, v.sx(x0), v.sy(0), v.sx(x0), v.sy(fn(x0)), { color: C.warm, lw: 1.6, dash: [5, 4] } as never);
    dot(f, v.sx(x0), v.sy(fn(x0)), 4.5, C.warm);

    // 面积函数 F(x) = a x³/3
    const F = (x: number): number => (a * x * x * x) / 3;
    const v2 = view(f, { xMin: 0, xMax: 4, yMin: 0, yMax: 9, inset: 46, insetBottom: 6 });
    curve(f, v2, (x) => F(x), { color: C.green, lw: 2, dash: [6, 4] } as never);

    text(f, `Φ(x₀) = ∫₀^${x0.toFixed(1)} ${a}x² dx = ${F(x0).toFixed(4)}`, 50, 48, {
      font: 'bold 16px "Times New Roman", serif', color: C.green,
    });
    text(f, `Φ′(x) = f(x) = ${a}x²　（面积函数的导数就是曲线本身）`, 50, 76, {
      color: C.warm, font: '14px system-ui',
    });
    text(f, `f(${x0.toFixed(1)}) = ${fn(x0).toFixed(4)}　Φ 的斜率`, 50, 100, {
      color: C.fg, font: '13px Consolas, monospace',
    });

    heading(f, '微积分基本定理：求导与求积互为逆运算');
    footnotes(f, [
      '蓝色阴影 = 定积分（曲线下的面积）；绿色虚线 = 面积函数 Φ(x)',
      'Φ(x) 在 x₀ 处的斜率恰好等于 f(x₀)——「面积增长的速率就是曲线的高度」',
      '牛顿-莱布尼茨公式：∫ₐᵇ f = F(b) − F(a)，把「求面积」变成「找原函数」',
    ]);
  },
});

// ---------------------------------------------------------------- T22
/** T22 牛顿二项式定理（任意实数指数）。 */
const newtonBinomialViz = defineViz({
  slug: 'newton-binomial-theorem',
  title: '牛顿二项式定理',
  params: {
    alpha: { type: 'range', min: -2, max: 3, step: 0.1, default: 0.5, label: '指数 α' },
    terms: { type: 'range', min: 1, max: 12, default: 4, label: '展开项数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const alpha = num(params, 'alpha', 0.5);
    const terms = Math.max(1, Math.round(num(params, 'terms', 4)));

    // 二项级数系数 C(α, k)
    const coef = (k: number): number => {
      let c = 1;
      for (let i = 0; i < k; i++) c *= (alpha - i) / (i + 1);
      return c;
    };
    const partial = (x: number): number => {
      let s = 0;
      for (let k = 0; k < terms; k++) s += coef(k) * Math.pow(x, k);
      return s;
    };
    const target = (x: number): number => Math.pow(1 + x, alpha);

    const v = view(f, { xMin: -0.85, xMax: 3, yMin: -2, yMax: 4, inset: 52 });
    grid(f, v, { divisions: 6, ticks: true });
    curve(f, v, (x) => target(x), { color: C.accent, lw: 2.6 } as never);
    curve(f, v, (x) => partial(x), { color: C.warm, lw: 1.8, dash: [6, 4] } as never);

    const err = Math.abs(target(1) - partial(1));
    text(f, `(1 + x)^α ，α = ${alpha.toFixed(1)}`, 50, 48, {
      font: 'bold 17px "Times New Roman", serif', color: C.accent,
    });
    text(f, `取前 ${terms} 项 —— 实线为目标函数，虚线为级数部分和`, 50, 74, { color: C.warm, font: '13px system-ui' });
    text(f, `x = 1 处误差 = ${err.toFixed(5)}`, 50, 98, {
      color: err < 0.05 ? C.green : C.hot, font: '13px Consolas, monospace',
    });

    // 系数
    const cw = Math.min(64, (w - 100) / terms);
    for (let k = 0; k < terms; k++) {
      const x = 50 + k * (cw + 6);
      poly(f, [[x, h - 150], [x + cw, h - 150], [x + cw, h - 108], [x, h - 108]], { fill: 'rgba(118,75,162,0.65)', close: true });
      text(f, `C(α,${k})`, x + cw / 2, h - 136, { align: 'center', color: C.dim, font: '11px system-ui' });
      text(f, coef(k).toFixed(3), x + cw / 2, h - 118, { align: 'center', color: C.fg, font: 'bold 12px system-ui' });
    }

    heading(f, '牛顿二项式定理：把 (1+x)^α 展开成幂级数');
    footnotes(f, [
      '当 α 是正整数时展开有限项；α 为任意实数时得到无穷级数',
      '系数 C(α, k) = α(α−1)…(α−k+1)/k!，把组合数推广到实数指数',
      '这一工具让 (1+x)^α 可以像多项式一样逐项计算，是幂级数与微积分的通用脚手架',
    ]);
  },
});

// ---------------------------------------------------------------- T23
/** T23 棣莫弗公式。 */
const deMoivreFormulaViz = defineViz({
  slug: 'de-moivre-formula',
  title: '棣莫弗公式',
  params: {
    n: { type: 'range', min: 2, max: 12, default: 5, label: '幂次 n' },
    phi: { type: 'range', min: 0, max: 360, default: 40, label: '角度 φ（度）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.max(1, Math.round(num(params, 'n', 5)));
    const phiDeg = num(params, 'phi', 40);
    const phi = (phiDeg * Math.PI) / 180;

    const v = equalView(f, 0, 0, 1.45, 60);
    grid(f, v, { divisions: 4, ticks: false });
    // 单位圆与坐标轴
    const circlePts: Array<[number, number]> = [];
    for (let i = 0; i <= 120; i++) {
      const a = (i * 2 * Math.PI) / 120;
      circlePts.push([v.sx(Math.cos(a)), v.sy(Math.sin(a))]);
    }
    poly(f, circlePts, { stroke: C.grid, lw: 1.4 });
    seg(f, v.sx(-1.4), v.sy(0), v.sx(1.4), v.sy(0), { color: C.dim, lw: 1 } as never);
    seg(f, v.sx(0), v.sy(-1.4), v.sx(0), v.sy(1.4), { color: C.dim, lw: 1 } as never);

    // z = cos φ + i sin φ
    seg(f, v.sx(0), v.sy(0), v.sx(Math.cos(phi)), v.sy(Math.sin(phi)), { color: C.accent, lw: 2.4 } as never);
    dot(f, v.sx(Math.cos(phi)), v.sy(Math.sin(phi)), 5, C.accent);
    text(f, 'z', v.sx(Math.cos(phi)) + 10, v.sy(Math.sin(phi)) - 8, { color: C.accent, font: 'bold 14px system-ui' });

    // z^n = cos nφ + i sin nφ
    const tn = n * phi;
    seg(f, v.sx(0), v.sy(0), v.sx(Math.cos(tn)), v.sy(Math.sin(tn)), { color: C.warm, lw: 2.4 } as never);
    dot(f, v.sx(Math.cos(tn)), v.sy(Math.sin(tn)), 6, C.warm);
    text(f, 'zⁿ', v.sx(Math.cos(tn)) + 10, v.sy(Math.sin(tn)) - 10, { color: C.warm, font: 'bold 14px system-ui' });

    // n 次单位根（正 n 边形）
    const roots: Array<[number, number]> = [];
    for (let k = 0; k < n; k++) {
      const a = (2 * Math.PI * k) / n;
      roots.push([Math.cos(a), Math.sin(a)]);
    }
    poly(f, roots.map(([x, y]) => [v.sx(x), v.sy(y)] as [number, number]), { stroke: C.cyan, lw: 1.2, close: true });
    roots.forEach(([x, y]) => dot(f, v.sx(x), v.sy(y), 3.5, C.cyan));

    text(f, `(cos φ + i sin φ)ⁿ = cos nφ + i sin nφ`, w / 2, 46, {
      align: 'center', font: 'bold 17px "Times New Roman", serif', color: C.warm,
    });
    text(f, `φ = ${phiDeg}°，n = ${n} ⇒ nφ = ${(phiDeg * n) % 360}°`, w / 2, 74, {
      align: 'center', color: C.fg, font: '14px Consolas, monospace',
    });
    text(f, `青色正 ${n} 边形 = 方程 z^${n} = 1 的 ${n} 个根`, w / 2, 98, {
      align: 'center', color: C.cyan, font: '13px system-ui',
    });

    heading(f, '棣莫弗公式：复数乘方 = 角度乘法');
    footnotes(f, [
      '模长相乘、幅角相加：复数乘法是「旋转 + 伸缩」，所以乘方就是反复旋转',
      `z 的角度 φ 乘 n 倍后落在 zⁿ 处（当前 ${(phiDeg * n) % 360}°）`,
      `令 φ = 360°/n，就得到 z^n = 1 的 n 个根，它们在复平面上构成正 ${n} 边形`,
    ]);
  },
});

// ---------------------------------------------------------------- T24
/** T24 欧拉公式 e^{iπ} + 1 = 0。 */
const eulerIdentityViz = defineViz({
  slug: 'euler-identity-history',
  title: '欧拉公式 e^{iπ} + 1 = 0',
  params: {
    theta: { type: 'range', min: 0, max: 360, default: 180, label: '角度 θ（度）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const deg = num(params, 'theta', 180);
    const th = (deg * Math.PI) / 180;

    const v = equalView(f, 0, 0, 1.5, 60);
    grid(f, v, { divisions: 4, ticks: false });
    const circlePts: Array<[number, number]> = [];
    for (let i = 0; i <= 160; i++) {
      const a = (i * 2 * Math.PI) / 160;
      circlePts.push([v.sx(Math.cos(a)), v.sy(Math.sin(a))]);
    }
    poly(f, circlePts, { stroke: C.grid, lw: 1.6 });
    seg(f, v.sx(-1.5), v.sy(0), v.sx(1.5), v.sy(0), { color: C.dim, lw: 1.2 } as never);
    seg(f, v.sx(0), v.sy(-1.5), v.sx(0), v.sy(1.5), { color: C.dim, lw: 1.2 } as never);

    // 弧线（走过的角度）
    const arcPts: Array<[number, number]> = [];
    for (let i = 0; i <= 120; i++) {
      const a = (th * i) / 120;
      arcPts.push([v.sx(Math.cos(a) * 0.42), v.sy(Math.sin(a) * 0.42)]);
    }
    poly(f, arcPts, { stroke: C.cyan, lw: 2.2 });
    // 终边
    seg(f, v.sx(0), v.sy(0), v.sx(Math.cos(th)), v.sy(Math.sin(th)), { color: C.warm, lw: 2.6 } as never);
    dot(f, v.sx(Math.cos(th)), v.sy(Math.sin(th)), 6, C.warm);
    text(f, `e^(iθ)`, v.sx(Math.cos(th)) + 12, v.sy(Math.sin(th)) - 10, { color: C.warm, font: 'bold 14px system-ui' });

    const cosT = Math.cos(th);
    const sinT = Math.sin(th);
    const near = Math.abs(deg - 180) < 3;
    text(f, `e^(iθ) = cos θ + i sin θ`, w / 2, 46, {
      align: 'center', font: 'bold 18px "Times New Roman", serif', color: C.accent,
    });
    text(f, `θ = ${deg}° ⇒ ${cosT.toFixed(4)} + ${sinT.toFixed(4)}i`, w / 2, 74, {
      align: 'center', color: C.fg, font: '14px Consolas, monospace',
    });
    text(f, near ? 'θ = π ⇒ e^(iπ) = −1 ⇒ e^(iπ) + 1 = 0 ✓' : '拖动滑块转到 180°，看它如何变成 −1', w / 2, 100, {
      align: 'center', color: near ? C.green : C.dim, font: 'bold 15px system-ui',
    });

    heading(f, '欧拉公式：五个最重要的常数被一个等号串起');
    footnotes(f, [
      'e^(iθ) = cos θ + i sin θ 把指数函数与三角函数统一在复平面上',
      'θ = π 时终边落在 −1：e^(iπ) + 1 = 0 同时包含 e、i、π、1、0',
      '它也是傅里叶分析、交流电理论与量子力学的通用语言',
    ]);
  },
});

// ---------------------------------------------------------------- T25
/** T25 克莱姆法则。 */
const cramersRuleViz = defineViz({
  slug: 'cramers-rule-history',
  title: '克莱姆法则',
  params: {
    a1: { type: 'range', min: -4, max: 4, step: 0.5, default: 2, label: 'a₁' },
    b1: { type: 'range', min: -4, max: 4, step: 0.5, default: 1, label: 'b₁' },
    a2: { type: 'range', min: -4, max: 4, step: 0.5, default: -1, label: 'a₂' },
    b2: { type: 'range', min: -4, max: 4, step: 0.5, default: 2, label: 'b₂' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a1 = num(params, 'a1', 2);
    const b1 = num(params, 'b1', 1);
    const a2 = num(params, 'a2', -1);
    const b2 = num(params, 'b2', 2);
    const c1 = 3;
    const c2 = 4;

    const v = view(f, { xMin: -4, xMax: 4, yMin: -4, yMax: 4, inset: 50 });
    grid(f, v, { divisions: 8, ticks: true });
    seg(f, v.sx(-4), v.sy(0), v.sx(4), v.sy(0), { color: C.dim, lw: 1.2 } as never);
    seg(f, v.sx(0), v.sy(-4), v.sx(0), v.sy(4), { color: C.dim, lw: 1.2 } as never);

    const D = a1 * b2 - a2 * b1;
    const Dx = c1 * b2 - c2 * b1;
    const Dy = a1 * c2 - a2 * c1;

    if (Math.abs(b1) > 1e-6) curve(f, v, (x) => (c1 - a1 * x) / b1, { color: C.accent, lw: 2.2 } as never);
    else seg(f, v.sx(c1 / a1), v.sy(-4), v.sx(c1 / a1), v.sy(4), { color: C.accent, lw: 2.2 } as never);
    if (Math.abs(b2) > 1e-6) curve(f, v, (x) => (c2 - a2 * x) / b2, { color: C.cyan, lw: 2.2 } as never);
    else seg(f, v.sx(c2 / a2), v.sy(-4), v.sx(c2 / a2), v.sy(4), { color: C.cyan, lw: 2.2 } as never);

    if (Math.abs(D) > 1e-6) {
      const x = Dx / D;
      const y = Dy / D;
      dot(f, v.sx(x), v.sy(y), 6, C.warm);
      text(f, `交点是唯一解 (${x.toFixed(2)}, ${y.toFixed(2)})`, v.sx(x) + 12, v.sy(y) - 10, {
        color: C.warm, font: 'bold 13px system-ui',
      });
    } else {
      text(f, 'D = 0：两直线平行或重合（无唯一解）', w / 2, h - 130, {
        align: 'center', color: C.hot, font: 'bold 14px system-ui',
      });
    }

    text(f, `a₁x + b₁y = c₁　　a₂x + b₂y = c₂`, 50, 46, { font: '15px "Times New Roman", serif', color: C.fg });
    text(f, `D = ${D.toFixed(2)}　Dx = ${Dx.toFixed(2)}　Dy = ${Dy.toFixed(2)}`, 50, 72, {
      color: C.fg, font: '13px Consolas, monospace',
    });
    text(f, `x = Dx/D = ${Math.abs(D) > 1e-6 ? (Dx / D).toFixed(2) : '—'}　　y = Dy/D = ${Math.abs(D) > 1e-6 ? (Dy / D).toFixed(2) : '—'}`, 50, 96, {
      color: C.green, font: '13px Consolas, monospace',
    });

    heading(f, '克莱姆法则：解 = 行列式之比');
    footnotes(f, [
      '系数行列式 D ≠ 0 时，线性方程组的解可以直接写成行列式的商',
      '几何意义：两条直线的交点；D 就是两个系数向量张成的平行四边形面积',
      'D = 0 表示两向量共线（平行），此时方程组无唯一解——这正是「可逆」的判据',
    ]);
  },
});

// ---------------------------------------------------------------- T26
/** T26 伯努利与调和级数发散性。 */
const harmonicSeriesViz = defineViz({
  slug: 'harmonic-series-divergence',
  title: '伯努利与调和级数发散性',
  params: {
    terms: { type: 'range', min: 10, max: 400, default: 120, label: '项数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const terms = Math.max(5, Math.round(num(params, 'terms', 120)));

    const partial: number[] = [];
    let s = 0;
    for (let i = 1; i <= terms; i++) {
      s += 1 / i;
      partial.push(s);
    }
    const sN = partial[partial.length - 1];
    const lnN = Math.log(terms);
    const v = view(f, { xMin: 0, xMax: terms, yMin: 0, yMax: Math.max(sN, lnN) * 1.15, inset: 52 });
    grid(f, v, { divisions: 6, ticks: true });
    // 部分和曲线
    const pts: Array<[number, number]> = partial.map((val, i) => [i + 1, val]);
    for (let i = 1; i < pts.length; i++) {
      seg(f, v.sx(pts[i - 1][0]), v.sy(pts[i - 1][1]), v.sx(pts[i][0]), v.sy(pts[i][1]), { color: C.accent, lw: 2 } as never);
    }
    // ln n 参照
    curve(f, v, (x) => Math.log(Math.max(x, 1)) + 0.5772, { color: C.cyan, lw: 1.6, dash: [6, 4] } as never);

    text(f, `S(${terms}) = ${sN.toFixed(4)}`, 50, 48, {
      font: 'bold 16px Consolas, monospace', color: C.accent,
    });
    text(f, `ln n + γ ≈ ${(lnN + 0.5772).toFixed(4)}　（γ 为欧拉常数）`, 50, 74, { color: C.cyan, font: '13px Consolas, monospace' });
    text(f, `第 n 项 1/n = ${(1 / terms).toFixed(5)} → 0`, 50, 98, { color: C.fg, font: '13px Consolas, monospace' });
    text(f, '项目趋于 0，总和却无界 —— 这就是「发散」的陷阱', 50, 122, { color: C.warm, font: '13px system-ui' });

    heading(f, '调和级数：通项趋于零，级数却发散');
    footnotes(f, [
      '雅各布·伯努利的经典证明：把项分组，每组之和都大于 1/2 ⇒ 部分和可任意大',
      '图中蓝色为部分和 S(n)，青色虚线为 ln n + γ（两者之差趋于欧拉常数 0.5772…）',
      '「项趋于 0」只是收敛的必要条件，并不充分——分析学早期的关键教训',
    ]);
  },
});

// ---------------------------------------------------------------- T27
/** T27 伯努利大数律。 */
const bernoulliLawViz = defineViz({
  slug: 'bernoulli-law-of-large-numbers',
  title: '伯努利大数律',
  params: {
    p: { type: 'range', min: 0.1, max: 0.9, step: 0.05, default: 0.5, label: '真实概率 p' },
    n: { type: 'range', min: 20, max: 3000, default: 800, label: '试验次数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const p = Math.min(0.95, Math.max(0.05, num(params, 'p', 0.5)));
    const n = Math.max(10, Math.round(num(params, 'n', 800)));

    // 用固定种子模拟（保证画面稳定、可复现）
    const rand = rng(20241001);
    const freqs: Array<[number, number]> = [];
    let heads = 0;
    for (let i = 1; i <= n; i++) {
      if (rand() < p) heads++;
      if (i % Math.max(1, Math.floor(n / 400)) === 0 || i === n) freqs.push([i, heads / i]);
    }

    const v = view(f, { xMin: 0, xMax: n, yMin: 0, yMax: 1, inset: 50 });
    grid(f, v, { divisions: 5, ticks: true });
    // p 参考线
    seg(f, v.sx(0), v.sy(p), v.sx(n), v.sy(p), { color: C.warm, lw: 1.8, dash: [6, 4] } as never);
    text(f, `真实概率 p = ${p.toFixed(2)}`, v.sx(n) - 6, v.sy(p) - 10, { align: 'right', color: C.warm, font: '12px system-ui' });
    // 频率曲线
    for (let i = 1; i < freqs.length; i++) {
      seg(f, v.sx(freqs[i - 1][0]), v.sy(freqs[i - 1][1]), v.sx(freqs[i][0]), v.sy(freqs[i][1]), {
        color: C.accent, lw: 1.8,
      } as never);
    }
    scatter(f, v, freqs.slice(-1), { r: 5, color: C.green });

    const finalFreq = freqs[freqs.length - 1][1];
    text(f, `最终频率 = ${(finalFreq * 100).toFixed(2)}%`, 50, 48, {
      font: 'bold 16px system-ui', color: C.green,
    });
    text(f, `与 p 的偏差 = ${Math.abs(finalFreq - p).toFixed(4)}`, 50, 74, {
      color: C.fg, font: '13px Consolas, monospace',
    });
    text(f, `试验次数 n = ${n}（拖动滑块看频率如何稳定下来）`, 50, 98, { color: C.dim, font: '13px system-ui' });

    heading(f, '伯努利大数律：频率稳定地趋向概率');
    footnotes(f, [
      '试验次数越多，事件发生的频率越接近它的真实概率 p',
      '《猜度术》（1713）中的这一定理，让概率论从组合技巧走向极限定理',
      '注意：频率是「依概率收敛」——不是保证每次都相等，而是偏离的概率越来越小',
    ]);
  },
});

registerViz(
  infinitudeOfPrimesViz,
  archimedesCircleSphereViz,
  menelausTheoremViz,
  chineseRemainderViz,
  aryabhataDiophantineViz,
  vieteTheoremViz,
  newtonLeibnizViz,
  newtonBinomialViz,
  deMoivreFormulaViz,
  eulerIdentityViz,
  cramersRuleViz,
  harmonicSeriesViz,
  bernoulliLawViz,
);
