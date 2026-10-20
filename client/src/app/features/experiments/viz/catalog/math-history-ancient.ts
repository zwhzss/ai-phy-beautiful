/**
 * 数学史里程碑 · 第一批（T01–T14：古代与中世纪）。
 * 每条定理一个独立渲染器，配合讲解文稿演示其核心思想。
 */
import { defineViz, num, str, VizFrame } from '../types';
import { registerViz } from '../registry';
import { C, cells, circle, curve, dot, equalView, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** 在画布坐标画一个正多边形（顶点在圆周上）。 */
function regularPoly(f: VizFrame, cx: number, cy: number, r: number, sides: number, rot = -Math.PI / 2): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i * 2 * Math.PI) / sides;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/** 画一个带标注的直角三角形（直角在左下）。 */
function rightTriangle(
  f: VizFrame,
  x: number,
  y: number,
  aLen: number,
  bLen: number,
  labels: [string, string, string],
  scale = 1,
): void {
  const a = aLen * scale;
  const b = bLen * scale;
  const A: [number, number] = [x, y];
  const B: [number, number] = [x + a, y];
  const Cc: [number, number] = [x, y - b];
  poly(f, [A, B, Cc], { fill: 'rgba(102,126,234,0.22)', stroke: C.accent, lw: 2, close: true });
  // 直角标记
  poly(f, [[x + 14, y], [x + 14, y - 14], [x, y - 14]], { stroke: C.dim, lw: 1.2 });
  text(f, labels[0], x + a / 2, y + 16, { align: 'center', color: C.fg, font: '13px system-ui' });
  text(f, labels[1], x - 12, y - b / 2, { align: 'right', color: C.fg, font: '13px system-ui' });
  text(f, labels[2], x + a / 2 + 18, y - b / 2 - 12, { align: 'left', color: C.warm, font: 'bold 13px system-ui' });
}

// ---------------------------------------------------------------- T01
/** T01 勾股数表（普林顿322号泥版）。 */
const plimpton322Viz = defineViz({
  slug: 'plimpton-322',
  title: '勾股数表与普林顿322',
  params: {
    pick: { type: 'range', min: 0, max: 4, default: 1, label: '第几组' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const triples: Array<[number, number, number]> = [
      [3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29],
    ];
    const idx = Math.max(0, Math.min(triples.length - 1, Math.round(num(params, 'pick', 1))));
    const [a, b, c] = triples[idx];

    text(f, `a² + b² = c²`, w / 2, 46, { align: 'center', font: 'bold 22px "Times New Roman", serif', color: C.warm });
    text(f, `${a}² + ${b}² = ${a * a} + ${b * b} = ${a * a + b * b} = ${c}²`, w / 2, 74, {
      align: 'center', color: C.fg, font: '15px system-ui',
    });

    const scale = Math.min((h - 250) / Math.max(a, b), (w * 0.42) / Math.max(a, b));
    rightTriangle(f, 120, h - 120, b, a, [`${b}`, `${a}`, `${c}`], scale);

    // 三边平方的方块（数格子表示面积）
    const size = 12;
    const bx = 420;
    const drawSquare = (n: number, ox: number, oy: number, color: string, label: string) => {
      const side = Math.min(3, Math.ceil(Math.sqrt(n)));
      for (let r = 0; r < n; r++) {
        const col = r % side;
        const row = Math.floor(r / side);
        poly(f, [
          [ox + col * size, oy + row * size],
          [ox + col * size + size - 1, oy + row * size],
          [ox + col * size + size - 1, oy + row * size + size - 1],
          [ox + col * size, oy + row * size + size - 1],
        ], { fill: color, close: true });
      }
      text(f, label, ox, oy - 8, { color: C.dim, font: '12px system-ui' });
    };
    drawSquare(a * a, bx, 120, 'rgba(102,126,234,0.75)', `a² = ${a * a}（${a * a} 格）`);
    drawSquare(b * b, bx + 130, 120, 'rgba(56,178,172,0.7)', `b² = ${b * b}（${b * b} 格）`);
    drawSquare(c * c, bx + 20, 300, 'rgba(237,137,54,0.7)', `c² = ${c * c}（${c * c} 格）`);

    heading(f, '普林顿322：古巴比伦人已经会算，却还没有普遍证明');
    footnotes(f, [
      `第 ${idx + 1} 组勾股数：${a}-${b}-${c}`,
      '泥版上记录了 15 组勾股数（含 3-4-5、5-12-13 等），说明他们掌握了规律',
      '但「为什么所有直角三角形都满足」——这一步要等到毕达哥拉斯学派的证明',
    ]);
  },
});

// ---------------------------------------------------------------- T02
/** T02 勾股定理（毕达哥拉斯定理）。 */
const pythagoreanTheoremViz = defineViz({
  slug: 'pythagorean-theorem-history',
  title: '勾股定理',
  params: {
    a: { type: 'range', min: 3, max: 12, default: 3, label: '直角边 a' },
    b: { type: 'range', min: 4, max: 14, default: 4, label: '直角边 b' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = Math.max(1, num(params, 'a', 3));
    const b = Math.max(1, num(params, 'b', 4));
    const c = Math.sqrt(a * a + b * b);

    const span = Math.max(a, b) * 2.2;
    const scale = Math.min((w - 120) / span, (h - 200) / span);
    const ox = w * 0.34;
    const oy = h - 130;
    const A: [number, number] = [ox, oy];
    const B: [number, number] = [ox + a * scale, oy];
    const Cc: [number, number] = [ox, oy - b * scale];
    poly(f, [A, B, Cc], { fill: 'rgba(102,126,234,0.25)', stroke: C.accent, lw: 2.2, close: true });
    poly(f, [[ox + 12, oy], [ox + 12, oy - 12], [ox, oy - 12]], { stroke: C.dim, lw: 1.2 });

    // 三边外侧正方形
    const square = (p1: [number, number], p2: [number, number], inward: number, color: string, label: string) => {
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const nx = -dy * inward;
      const ny = dx * inward;
      poly(f, [p1, p2, [p2[0] + nx, p2[1] + ny], [p1[0] + nx, p1[1] + ny]], { fill: color, close: true });
      const mx = (p1[0] + p2[0]) / 2 + nx / 2;
      const my = (p1[1] + p2[1]) / 2 + ny / 2;
      text(f, label, mx, my + 5, { align: 'center', font: 'bold 15px system-ui', color: C.fg });
    };
    square(A, B, 1, 'rgba(102,126,234,0.42)', `a²=${(a * a).toFixed(0)}`);
    square(A, Cc, -1, 'rgba(56,178,172,0.42)', `b²=${(b * b).toFixed(0)}`);
    square(B, Cc, 1, 'rgba(237,137,54,0.42)', `c²=${(a * a + b * b).toFixed(0)}`);

    text(f, `a² + b² = ${(a * a).toFixed(0)} + ${(b * b).toFixed(0)} = ${(a * a + b * b).toFixed(0)}  =  c²`, w / 2, 46, {
      align: 'center', font: 'bold 20px "Times New Roman", serif', color: C.warm,
    });
    text(f, `c = √(${a}² + ${b}²) = ${c.toFixed(4)}`, w / 2, 76, { align: 'center', color: C.fg, font: '15px system-ui' });

    heading(f, '勾股定理：两个小正方形面积之和 = 大正方形面积');
    footnotes(f, [
      '毕达哥拉斯学派首次给出普遍证明，因此得名（中国称「勾股」，商高已有 3-4-5 的特例）',
      '他们随即发现：正方形对角线与其边不可通约（√2 不是分数）——第一次数学危机',
    ]);
  },
});

// ---------------------------------------------------------------- T03
/** T03 辗转相除法。 */
const euclideanAlgorithmViz = defineViz({
  slug: 'euclidean-algorithm',
  title: '辗转相除法',
  params: {
    a: { type: 'number', min: 10, max: 200, default: 1071, label: '整数 a' },
    b: { type: 'number', min: 5, max: 200, default: 462, label: '整数 b' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    let a = Math.max(1, Math.round(num(params, 'a', 1071)));
    let b = Math.max(1, Math.round(num(params, 'b', 462)));
    if (a < b) [a, b] = [b, a];

    const scale = Math.min((w - 200) / a, (h - 230) / b);
    let ox = 60;
    let oy = 100;
    let curA = a;
    let curB = b;
    const steps: string[] = [];
    const colors = [C.accent, C.cool, C.cyan, C.green, C.warm, C.yellow, C.pink];

    let guard = 0;
    while (curB > 0 && guard < 8) {
      const q = Math.floor(curA / curB);
      const r = curA % curB;
      // 大矩形 + 用 q 个正方形填充
      poly(f, [[oy * 0 + ox, 0 + 100], [ox + curA * scale, 100], [ox + curA * scale, 100 + curB * scale], [ox, 100 + curB * scale]], {
        stroke: colors[guard % colors.length], lw: 1.6,
      });
      for (let i = 0; i < q; i++) {
        poly(f, [
          [ox + i * curB * scale, 100],
          [ox + (i + 1) * curB * scale, 100],
          [ox + (i + 1) * curB * scale, 100 + curB * scale],
          [ox + i * curB * scale, 100 + curB * scale],
        ], { fill: colors[guard % colors.length] + '55', close: true });
      }
      text(f, `${curA} = ${q} × ${curB} + ${r}`, ox + curA * scale + 12, 100 + curB * scale / 2, {
        color: C.fg, font: '13px Consolas, monospace', align: 'left',
      });
      steps.push(`${curA} = ${q}×${curB} + ${r}`);
      ox += q * curB * scale;
      curA = curB;
      curB = r;
      guard++;
    }

    heading(f, '辗转相除法：用正方形去填满矩形，剩下的宽度就是最大公约数');
    footnotes(f, [
      ...steps.slice(0, 4),
      steps.length ? `最后一个非零余数 = 最大公约数 gcd(${a}, ${b}) = ${curA}` : '',
      '欧几里得在《几何原本》第七卷给出——数论与算法史共同的源头',
    ].filter(Boolean));
  },
});

// ---------------------------------------------------------------- T04
/** T04 埃拉托斯特尼筛法。 */
const sieveOfEratosthenesViz = defineViz({
  slug: 'sieve-of-eratosthenes',
  title: '埃拉托斯特尼筛法',
  params: {
    n: { type: 'range', min: 30, max: 200, default: 100, label: '筛选上限' },
    p: { type: 'range', min: 2, max: 13, default: 2, label: '当前素数 p' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.max(10, Math.round(num(params, 'n', 100)));
    const p = Math.max(2, Math.round(num(params, 'p', 2)));

    const nums: number[] = [];
    for (let i = 1; i <= n; i++) nums.push(i);

    const isPrime = (x: number): boolean => {
      if (x < 2) return false;
      for (let i = 2; i * i <= x; i++) if (x % i === 0) return false;
      return true;
    };
    const primeCount = nums.filter(isPrime).length;
    const crossCount = nums.filter((x) => x > 1 && x % p === 0 && x !== p).length;

    cells(f, nums, {
      cols: Math.min(20, n),
      cell: Math.max(18, Math.min(34, Math.floor((w - 80) / Math.min(20, n)))),
      x: 40,
      y: 90,
      colorFor: (v: string | number) => {
        const x = Number(v);
        if (x === 1) return 'rgba(160,174,192,0.25)';
        if (x === p) return 'rgba(237,137,54,0.85)';
        if (x > 1 && x % p === 0) return 'rgba(245,101,101,0.35)';
        if (isPrime(x)) return 'rgba(72,187,120,0.75)';
        return 'rgba(45,55,72,0.9)';
      },
      textColor: C.fg,
    } as never);

    const legend = (cx: number, color: string, label: string) => {
      poly(f, [[cx, h - 62], [cx + 14, h - 62], [cx + 14, h - 48], [cx, h - 48]], { fill: color, close: true });
      text(f, label, cx + 20, h - 50, { color: C.dim, font: '12px system-ui' });
    };
    legend(40, 'rgba(237,137,54,0.85)', `当前素数 p = ${p}`);
    legend(200, 'rgba(245,101,101,0.35)', `p 的倍数（划去 ${crossCount} 个）`);
    legend(390, 'rgba(72,187,120,0.75)', `素数（共 ${primeCount} 个）`);

    heading(f, `筛法：留下 p = ${p}，划掉它的所有倍数，剩下的就是素数`);
    footnotes(f, [
      `在 1…${n} 中，素数共 ${primeCount} 个`,
      '从最小的素数 2 开始，逐个划去其倍数（自身保留）',
      '筛到 √n 就结束——剩下的全是素数：这是最早的「系统求素数」算法',
    ]);
  },
});

// ---------------------------------------------------------------- T05
/** T05 斐波那契数列与兔子问题。 */
const fibonacciRabbitViz = defineViz({
  slug: 'fibonacci-rabbit-problem',
  title: '斐波那契数列与兔子问题',
  params: {
    n: { type: 'range', min: 4, max: 18, default: 10, label: '项数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.max(2, Math.round(num(params, 'n', 10)));
    const seq: number[] = [1, 1];
    while (seq.length < n) seq.push(seq[seq.length - 1] + seq[seq.length - 2]);

    const maxV = seq[seq.length - 1];
    const baseY = h - 110;
    const barW = Math.min(46, (w - 100) / n - 6);
    seq.forEach((v, i) => {
      const x = 50 + i * (barW + 6);
      const barH = (v / maxV) * (h - 240);
      poly(f, [[x, baseY - barH], [x + barW, baseY - barH], [x + barW, baseY], [x, baseY]], {
        fill: i % 2 ? 'rgba(102,126,234,0.8)' : 'rgba(118,75,162,0.8)', close: true,
      });
      text(f, String(v), x + barW / 2, baseY - barH - 6, { align: 'center', color: C.fg, font: '11px system-ui' });
      text(f, `F${i + 1}`, x + barW / 2, baseY + 16, { align: 'center', color: C.dim, font: '11px system-ui' });
    });

    // 相邻比值趋近黄金比
    const ratios: string[] = [];
    for (let i = 2; i < seq.length; i++) ratios.push((seq[i] / seq[i - 1]).toFixed(4));
    const golden = 1.6180339887;
    const ratioLine = baseY - (golden / (1 / (golden - 1))) * 0;
    seg(f, 40, baseY - (golden / 2.2) * (h - 240), w - 40, baseY - (golden / 2.2) * (h - 240), {
      color: C.warm, lw: 1.4, dash: [6, 4],
    } as never);
    text(f, `黄金比 φ ≈ ${golden}`, w - 46, baseY - (golden / 2.2) * (h - 240) - 8, {
      align: 'right', color: C.warm, font: '12px system-ui',
    });
    void ratioLine;

    heading(f, '兔子问题：每项等于前两项之和，比值逐渐逼近黄金比');
    footnotes(f, [
      `数列：${seq.join(', ')}`,
      ratios.length ? `相邻比值：${ratios.slice(-4).join('、')} → φ` : '',
      '斐波那契在《计算之书》中用「一对兔子一年能繁殖多少对」引出该数列',
      '这个简单递推同时出现在花瓣数、松果鳞片与向日葵种子的排列中',
    ].filter(Boolean));
  },
});

// ---------------------------------------------------------------- T06
/** T06 希波克拉底月牙面积定理。 */
const luneOfHippocratesViz = defineViz({
  slug: 'lune-of-hippocrates',
  title: '希波克拉底月牙面积定理',
  params: {
    ratio: { type: 'range', min: 0.5, max: 2, step: 0.05, default: 1, label: '两直角边之比' },
    showLune: { type: 'select', options: ['高亮月牙', '高亮三角形'], default: '高亮月牙', label: '高亮' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const r = Math.max(0.4, num(params, 'ratio', 1));
    const b = 100 * r;
    const a = 100;
    const hyp = Math.hypot(a, b);
    const mode = str(params, 'showLune', '高亮月牙');

    const v = equalView(f, 0, 0, Math.max(a, b) * 0.95, 60);
    grid(f, v, { divisions: 6, ticks: false });

    // 直角三角形（直角在原点）
    const A: [number, number] = [0, 0];
    const B: [number, number] = [a, 0];
    const Cc: [number, number] = [0, b];
    poly(f, [A, B, Cc], {
      fill: mode === '高亮三角形' ? 'rgba(237,137,54,0.55)' : 'rgba(102,126,234,0.2)',
      stroke: C.accent, lw: 2, close: true,
    });

    // 三边半圆
    circle(f, a / 2, 0, a / 2, { stroke: C.cool, lw: 1.6 });
    circle(f, 0, -b / 2, b / 2, { stroke: C.green, lw: 1.6 });
    circle(f, a / 2, b / 2, hyp / 2, { stroke: C.warm, lw: 1.8 });

    text(f, `a² + b² = c²`, w - 40, 46, { align: 'right', font: 'bold 18px "Times New Roman", serif', color: C.warm });
    const triArea = (a * b) / 2;
    text(f, `三角形面积 = ${triArea.toFixed(0)}`, w - 40, 74, { align: 'right', color: C.fg, font: '13px system-ui' });
    text(f, `两个月牙面积之和 = ${triArea.toFixed(0)}`, w - 40, 96, { align: 'right', color: C.green, font: '13px system-ui' });

    heading(f, '希波克拉底月牙：两个月牙的面积正好等于三角形面积');
    footnotes(f, [
      '以两直角边为直径的半圆面积之和 = 以斜边为直径的半圆面积（因 a² + b² = c²）',
      '两边同减公共弓形，得到：两个月牙面积之和 = 直角三角形面积',
      '这是最早的「化月牙为方」，第一次展示了论证数学的力量',
    ]);
  },
});

// ---------------------------------------------------------------- T07
/** T07 海伦公式。 */
const heronsFormulaViz = defineViz({
  slug: 'herons-formula',
  title: '海伦公式',
  params: {
    a: { type: 'range', min: 3, max: 15, default: 13, label: '边 a' },
    b: { type: 'range', min: 3, max: 15, default: 14, label: '边 b' },
    c: { type: 'range', min: 3, max: 15, default: 15, label: '边 c' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 13);
    const b = num(params, 'b', 14);
    const c = num(params, 'c', 15);
    const valid = a + b > c && a + c > b && b + c > a;

    if (!valid) {
      text(f, '三边无法构成三角形（需满足两小边之和大于第三边）', w / 2, h / 2, {
        align: 'center', color: C.hot, font: 'bold 16px system-ui',
      });
      heading(f, '海伦公式');
      return;
    }

    // 用坐标法确定第三个顶点
    const x1 = 0;
    const y1 = 0;
    const x2 = c;
    const y2 = 0;
    const x3 = (b * b + c * c - a * a) / (2 * c);
    const y3 = Math.sqrt(Math.max(0, b * b - x3 * x3));

    const v = equalView(f, c / 2, y3 / 3, Math.max(c, b) * 0.72, 70);
    grid(f, v, { divisions: 6, ticks: false });
    poly(f, [[x1, y1], [x2, y2], [x3, y3]], { fill: 'rgba(102,126,234,0.25)', stroke: C.accent, lw: 2.2, close: true });
    [[x1, y1], [x2, y2], [x3, y3]].forEach(([px, py]) => dot(f, px, py, 3.5, C.warm));
    text(f, `a=${a}`, x3, y3 - 10, { align: 'center', color: C.fg, font: '12px system-ui' });
    text(f, `b=${b}`, (x1 + x3) / 2 - 14, (y1 + y3) / 2, { align: 'right', color: C.fg, font: '12px system-ui' });
    text(f, `c=${c}`, c / 2, 14, { align: 'center', color: C.fg, font: '12px system-ui' });

    const s = (a + b + c) / 2;
    const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
    text(f, `S = √(s(s−a)(s−b)(s−c))`, 40, 46, { font: 'bold 18px "Times New Roman", serif', color: C.warm });
    text(f, `s = ${s.toFixed(1)}`, 40, 72, { color: C.fg, font: '14px Consolas, monospace' });
    text(f, `S = √(${s.toFixed(1)}×${(s - a).toFixed(1)}×${(s - b).toFixed(1)}×${(s - c).toFixed(1)}) = ${area.toFixed(4)}`, 40, 94, {
      color: C.green, font: '14px Consolas, monospace',
    });
    text(f, `（底×高÷2 = ${((c * y3) / 2).toFixed(4)}，两者一致）`, 40, 116, { color: C.dim, font: '13px system-ui' });

    heading(f, '海伦公式：只要知道三边，就能算出面积');
    footnotes(f, [
      '面积被写成了三边完全对称的形式——与「哪条边当底」无关',
      '海伦（约公元 75 年）的《度量论》给出该公式，是古代代数与几何结合的典范',
    ]);
  },
});

// ---------------------------------------------------------------- T08
/** T08 祖暅原理。 */
const zuGengPrincipleViz = defineViz({
  slug: 'zu-geng-principle',
  title: '祖暅原理',
  params: {
    level: { type: 'range', min: 0, max: 1, step: 0.02, default: 0.55, label: '截面高度' },
    skew: { type: 'range', min: 0, max: 1, step: 0.05, default: 0.6, label: '右侧倾斜量' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const t = Math.max(0, Math.min(1, num(params, 'level', 0.55)));
    const skew = Math.max(0, Math.min(1, num(params, 'skew', 0.6)));

    const groundY = h - 130;
    const topY = 120;
    const bodyH = groundY - topY;
    const radius = 62;

    // 左侧：直圆柱
    const cx1 = w * 0.28;
    // 右侧：等底等高但倾斜的柱体
    const cx2 = w * 0.72;
    const shift = skew * 60;

    // 侧影
    poly(f, [[cx1 - radius, groundY], [cx1 + radius, groundY], [cx1 + radius, topY], [cx1 - radius, topY]], {
      fill: 'rgba(102,126,234,0.28)', stroke: C.accent, lw: 2, close: true,
    });
    poly(f, [[cx2 - radius, groundY], [cx2 + radius, groundY], [cx2 + radius + shift, topY], [cx2 - radius + shift, topY]], {
      fill: 'rgba(237,137,54,0.26)', stroke: C.warm, lw: 2, close: true,
    });

    // 同一高度的截面：椭圆示意（等宽）
    const yL = groundY - bodyH * t;
    const yR = groundY - bodyH * t;
    const xShiftL = 0;
    const xShiftR = shift * t;
    circle(f, cx1 + xShiftL, yL, radius, { stroke: C.cyan, lw: 2, fill: 'rgba(56,178,172,0.3)' });
    circle(f, cx2 + xShiftR, yR, radius, { stroke: C.cyan, lw: 2, fill: 'rgba(56,178,172,0.3)' });
    seg(f, cx1 - radius - 30, yL, cx2 + radius + shift + 30, yL, { color: C.cyan, lw: 1, dash: [5, 4] } as never);

    const sameHeight = Math.abs(yL - yR) < 1;
    text(f, `截面积 πr² = ${(Math.PI * radius * radius).toFixed(0)}`, w / 2, 46, {
      align: 'center', font: 'bold 18px system-ui', color: C.cyan,
    });
    text(f, `两侧截面：宽度同为 ${(radius * 2).toFixed(0)}，面积相等 ✓`, w / 2, 72, {
      align: 'center', color: C.fg, font: '14px system-ui',
    });
    void sameHeight;

    heading(f, '祖暅原理：幂势既同，则积不容异');
    footnotes(f, [
      '两个立体在每一高度处的截面积都相等 ⇒ 它们的体积相等',
      '祖暅（祖冲之之子，约 6 世纪）用它推导球体积，比卡瓦列里原理早一千余年',
      '这正是积分「以直代曲、累计截面」思想的几何雏形',
    ]);
  },
});

// ---------------------------------------------------------------- T09
/** T09 阿尔·花拉子米的代数算法（配方法）。 */
const alKhwarizmiViz = defineViz({
  slug: 'al-khwarizmi-algebra',
  title: '阿尔·花拉子米的代数算法',
  params: {
    b: { type: 'range', min: 2, max: 12, step: 1, default: 8, label: '一次项系数 b' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const b = Math.round(num(params, 'b', 8));
    const half = b / 2;

    // x² + b·x 的几何拼图：边长 x 的正方形 + 两个 x × b/2 的矩形
    const unit = Math.min((h - 270) / (4 + half), (w - 220) / (4 + half));
    const x = 4; // 正方形边长用 4 个单位表示（示意 x）
    const xPx = x * unit;
    const hPx = half * unit;

    const ox = 90;
    const oy = h - 140;

    // 中央正方形 x²
    poly(f, [[ox, oy - xPx], [ox + xPx, oy - xPx], [ox + xPx, oy], [ox, oy]], {
      fill: 'rgba(102,126,234,0.5)', stroke: C.accent, lw: 1.6, close: true,
    });
    text(f, 'x²', ox + xPx / 2, oy - xPx / 2 + 5, { align: 'center', color: C.fg, font: 'bold 15px system-ui' });

    // 右侧矩形 x × b/2
    poly(f, [[ox + xPx, oy - xPx], [ox + xPx + hPx, oy - xPx], [ox + xPx + hPx, oy], [ox + xPx, oy]], {
      fill: 'rgba(56,178,172,0.45)', stroke: C.cyan, lw: 1.6, close: true,
    });
    text(f, `x·b/2`, ox + xPx + hPx / 2, oy - xPx / 2 + 5, { align: 'center', color: C.fg, font: '12px system-ui' });

    // 下方矩形 x × b/2
    poly(f, [[ox, oy - xPx - hPx], [ox + xPx, oy - xPx - hPx], [ox + xPx, oy - xPx], [ox, oy - xPx]], {
      fill: 'rgba(56,178,172,0.45)', stroke: C.cyan, lw: 1.6, close: true,
    });
    text(f, `x·b/2`, ox + xPx / 2, oy - xPx - hPx / 2 + 5, { align: 'center', color: C.fg, font: '12px system-ui' });

    // 补角 (b/2)²
    poly(f, [[ox + xPx, oy - xPx - hPx], [ox + xPx + hPx, oy - xPx - hPx], [ox + xPx + hPx, oy - xPx], [ox + xPx, oy - xPx]], {
      fill: 'rgba(237,137,54,0.55)', stroke: C.warm, lw: 1.8, close: true,
    });
    text(f, '(b/2)²', ox + xPx + hPx / 2, oy - xPx - hPx / 2 + 5, { align: 'center', color: C.fg, font: '12px system-ui' });

    // 补全后的大正方形边长 x + b/2
    seg(f, ox, oy - xPx - hPx, ox + xPx + hPx, oy - xPx - hPx, { color: C.warm, lw: 1.4, dash: [5, 4] } as never);
    text(f, `边长 = x + b/2`, ox + (xPx + hPx) / 2, oy - xPx - hPx - 14, { align: 'center', color: C.warm, font: '13px system-ui' });

    text(f, `x² + ${b}x = (x + ${half})² − ${(half * half).toFixed(0)}`, 60, 56, {
      font: 'bold 20px "Times New Roman", serif', color: C.warm,
    });
    text(f, `把 b 的一半补在两边，缺的角正好是 (b/2)² = ${(half * half).toFixed(0)}`, 60, 84, {
      color: C.fg, font: '14px system-ui',
    });

    heading(f, '花拉子米：用拼图理解「配方」');
    footnotes(f, [
      '代数（algebra）一词源自他的著作《还原与对消》（al-jabr）',
      '他系统给出一次与二次方程的解法，并把未知量称为「东西」（shay）',
      '几何拼图是理解配方法最直观的方式：补上缺角，就成了完整的正方形',
    ]);
  },
});

// ---------------------------------------------------------------- T10
/** T10 贾宪三角（二项式系数表）。 */
const jiaXianTriangleViz = defineViz({
  slug: 'jia-xian-triangle',
  title: '贾宪三角',
  params: {
    rows: { type: 'range', min: 4, max: 12, default: 8, label: '行数' },
    highlight: { type: 'select', options: ['按奇偶着色', '全部同色'], default: '按奇偶着色', label: '着色' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const rows = Math.max(2, Math.round(num(params, 'rows', 8)));
    const mode = str(params, 'highlight', '按奇偶着色');

    const tri: number[][] = [];
    for (let i = 0; i < rows; i++) {
      tri.push([]);
      for (let j = 0; j <= i; j++) {
        tri[i][j] = j === 0 || j === i ? 1 : tri[i - 1][j - 1] + tri[i - 1][j];
      }
    }

    const cellW = Math.min(52, (w - 80) / rows);
    const cellH = Math.min(34, (h - 230) / rows);
    const topY = 96;

    tri.forEach((row, i) => {
      const y = topY + i * cellH;
      const startX = w / 2 - (row.length * cellW) / 2;
      row.forEach((v, j) => {
        const x = startX + j * cellW;
        const odd = v % 2 === 1;
        poly(f, [[x + 2, y], [x + cellW - 2, y], [x + cellW - 2, y + cellH - 4], [x + 2, y + cellH - 4]], {
          fill: mode === '按奇偶着色'
            ? (odd ? 'rgba(102,126,234,0.72)' : 'rgba(237,137,54,0.32)')
            : 'rgba(102,126,234,0.45)',
          close: true,
        });
        text(f, String(v), x + cellW / 2, y + cellH / 2 + 1, {
          align: 'center', color: C.fg, font: 'bold 12px system-ui',
        });
      });
    });

    const last = tri[rows - 1];
    heading(f, '贾宪三角：每行相邻两数相加得到下一行');
    footnotes(f, [
      `第 ${rows} 行：${last.slice(0, 5).join(', ')}${last.length > 5 ? ' …' : ''}（共 ${last.length} 个数）`,
      '第 n 行第 k 个数就是组合数 C(n−1, k−1)，即 (a+b)^(n−1) 的展开系数',
      '第 n 行数字之和 = 2^(n−1)：这正是二项式定理的计数含义',
      '贾宪（约 11 世纪）与杨辉的记录早于帕斯卡数百年',
    ]);
  },
});

// ---------------------------------------------------------------- T11
/** T11 对数的发明。 */
const inventionOfLogarithmViz = defineViz({
  slug: 'invention-of-logarithm',
  title: '对数的发明',
  params: {
    base: { type: 'select', options: ['2', 'e', '10'], default: '10', label: '底数' },
    m: { type: 'range', min: 2, max: 100, default: 8, label: '因数 m' },
    n: { type: 'range', min: 2, max: 100, default: 32, label: '因数 n' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const baseStr = str(params, 'base', '10');
    const base = baseStr === 'e' ? Math.E : Number(baseStr);
    const m = Math.max(1, Math.round(num(params, 'm', 8)));
    const n = Math.max(1, Math.round(num(params, 'n', 32)));
    const lg = (x: number): number => Math.log(x) / Math.log(base);

    const yMax = Math.max(lg(m * n) * 1.2, 2);
    const v = view(f, { xMin: 0, xMax: Math.max(m * n, 10), yMin: 0, yMax, inset: 56 });
    grid(f, v, { divisions: 5, ticks: true });

    curve(f, v, (x) => lg(x), { color: C.accent, lw: 2.4 } as never);
    curve(f, v, (x) => Math.pow(base, x), { color: C.cyan, lw: 1.6, dash: [5, 4] } as never);

    dot(f, m, lg(m), 4, C.warm);
    dot(f, n, lg(n), 4, C.warm);
    dot(f, m * n, lg(m * n), 5, C.green);
    seg(f, 0, lg(m), m, lg(m), { color: C.warm, lw: 1, dash: [3, 3] } as never);
    seg(f, 0, lg(n), n, lg(n), { color: C.warm, lw: 1, dash: [3, 3] } as never);

    text(f, `y = log${baseStr === 'e' ? 'ₑ' : baseStr}(x)`, w - 50, 52, {
      align: 'right', font: 'bold 15px "Times New Roman", serif', color: C.accent,
    });
    text(f, `log(m·n) = log m + log n`, 50, 52, { font: 'bold 17px "Times New Roman", serif', color: C.warm });
    text(f, `log(${m}×${n}) = log ${m} + log ${n}`, 50, 78, { color: C.fg, font: '14px Consolas, monospace' });
    text(f, `${lg(m * n).toFixed(4)} = ${lg(m).toFixed(4)} + ${lg(n).toFixed(4)}`, 50, 100, {
      color: C.green, font: '14px Consolas, monospace',
    });

    heading(f, '对数：把乘法变成加法');
    footnotes(f, [
      '实线为对数曲线，虚线为指数曲线——两者关于 y = x 对称（互为反函数）',
      '纳皮尔（1614）发明对数后，天文学家的计算量骤降',
      '拉普拉斯：这项发明「以缩短计算时间的方式，延长了天文学家的生命」',
    ]);
  },
});

// ---------------------------------------------------------------- T12
/** T12 笛卡尔解析几何。 */
const descartesAnalyticGeometryViz = defineViz({
  slug: 'descartes-analytic-geometry',
  title: '笛卡尔解析几何与符号法则',
  params: {
    a: { type: 'range', min: -3, max: 3, step: 0.1, default: 1, label: '二次项 a' },
    b: { type: 'range', min: -4, max: 4, step: 0.1, default: 0, label: '一次项 b' },
    c: { type: 'range', min: -6, max: 6, step: 0.1, default: -3, label: '常数项 c' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 1);
    const b = num(params, 'b', 0);
    const c = num(params, 'c', -3);
    const fn = (x: number): number => a * x * x + b * x + c;

    const v = view(f, { xMin: -4, xMax: 4, yMin: -8, yMax: 8, inset: 46 });
    grid(f, v, { divisions: 8, ticks: true });
    // 坐标轴
    seg(f, v.sx(-4), v.sy(0), v.sx(4), v.sy(0), { color: C.dim, lw: 1.2 } as never);
    seg(f, v.sx(0), v.sy(-8), v.sx(0), v.sy(8), { color: C.dim, lw: 1.2 } as never);
    curve(f, v, fn, { color: C.accent, lw: 2.6 } as never);

    // 根（判别式）
    const D = b * b - 4 * a * c;
    const roots: number[] = [];
    if (D > 0 && a !== 0) {
      roots.push((-b + Math.sqrt(D)) / (2 * a), (-b - Math.sqrt(D)) / (2 * a));
    } else if (Math.abs(D) < 1e-9 && a !== 0) {
      roots.push(-b / (2 * a));
    }
    roots.forEach((r) => dot(f, r, 0, 5, C.hot));

    const sign = (x: number) => (x < 0 ? '−' : '+');
    const eq = `y = ${a === 1 ? '' : a === -1 ? '−' : a.toFixed(1)}x² ${sign(b)} ${Math.abs(b).toFixed(1)}x ${sign(c)} ${Math.abs(c).toFixed(1)}`;
    text(f, eq, 50, 50, { font: 'bold 16px "Times New Roman", serif', color: C.warm });
    text(f, `判别式 Δ = b² − 4ac = ${D.toFixed(2)}`, 50, 76, { color: C.fg, font: '13px Consolas, monospace' });
    text(f, `实根个数：${roots.length}`, 50, 98, { color: C.hot, font: '13px system-ui' });

    heading(f, '解析几何：曲线 = 方程，方程 = 曲线');
    footnotes(f, [
      '笛卡尔在《几何学》（1637）中建立坐标系，几何问题化为代数方程',
      '图中曲线上的每个点 (x, y) 都满足右侧方程——「形」与「数」的互相翻译',
      '红点为方程的实根，即曲线与 x 轴的交点（对应符号法则的根的个数估计）',
    ]);
  },
});

// ---------------------------------------------------------------- T13
/** T13 欧拉柯尼斯堡七桥问题。 */
const konigsbergBridgesViz = defineViz({
  slug: 'konigsberg-bridges',
  title: '欧拉柯尼斯堡七桥问题',
  params: {
    showDegrees: { type: 'select', options: ['显示度数', '隐藏度数'], default: '显示度数', label: '度数标注' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const show = str(params, 'showDegrees', '显示度数') === '显示度数';

    // 四块陆地
    const nodes: Array<{ x: number; y: number; name: string; deg: number }> = [
      { x: 0.3, y: 0.28, name: '北岸', deg: 3 },
      { x: 0.72, y: 0.28, name: '南岸', deg: 3 },
      { x: 0.3, y: 0.72, name: '岛 A', deg: 5 },
      { x: 0.72, y: 0.72, name: '岛 B', deg: 3 },
    ];
    const pos = nodes.map((n) => [60 + n.x * (w - 160), 110 + n.y * (h - 260)] as [number, number]);

    // 七座桥（边）
    const edges: Array<[number, number]> = [
      [0, 2], [0, 2], [1, 3], [1, 3], [2, 3], [0, 3], [1, 2],
    ];
    edges.forEach(([i, j], k) => {
      const [x1, y1] = pos[i];
      const [x2, y2] = pos[j];
      const off = (k % 2 === 0 ? 1 : -1) * (6 + k * 2);
      const mx = (x1 + x2) / 2 + off;
      const my = (y1 + y2) / 2 - off;
      seg(f, x1, y1, mx, my, { color: C.dim, lw: 2.2 } as never);
      seg(f, mx, my, x2, y2, { color: C.dim, lw: 2.2 } as never);
    });

    nodes.forEach((n, i) => {
      const [x, y] = pos[i];
      const odd = n.deg % 2 === 1;
      circle(f, x, y, 26, { fill: odd ? 'rgba(245,101,101,0.35)' : 'rgba(72,187,120,0.35)', stroke: odd ? C.hot : C.green, lw: 2 });
      text(f, n.name, x, y + 5, { align: 'center', color: C.fg, font: 'bold 12px system-ui' });
      if (show) {
        text(f, `度数 ${n.deg}`, x, y + 42, { align: 'center', color: odd ? C.hot : C.green, font: '11px system-ui' });
      }
    });

    heading(f, '七桥问题：能否走遍七座桥且每座只走一次？');
    footnotes(f, [
      '四个顶点度数分别为 3、3、5、3 —— 全是奇数（红圈）',
      '欧拉给出判据：一次走遍所有边（欧拉路径）要求奇数度顶点个数为 0 或 2',
      '这里是 4 个 ⇒ 不可能做到。结论与桥的长短、角度完全无关',
      '由此诞生了图论与拓扑学：只看「连接关系」，不看长度与形状',
    ]);
  },
});

// ---------------------------------------------------------------- T14
/** T14 欧拉多面体公式。 */
const eulerPolyhedronViz = defineViz({
  slug: 'euler-polyhedron-formula',
  title: '欧拉多面体公式',
  params: {
    shape: { type: 'select', options: ['正四面体', '正方体', '正八面体'], default: '正方体', label: '多面体' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const shape = str(params, 'shape', '正方体');
    const data: Record<string, { V: number; E: number; F: number; sides: number[] }> = {
      正四面体: { V: 4, E: 6, F: 4, sides: [3, 3, 3] },
      正方体: { V: 8, E: 12, F: 6, sides: [4, 4, 4] },
      正八面体: { V: 6, E: 12, F: 8, sides: [3, 3, 3, 3] },
    };
    const d = data[shape];

    // 多面体示意（俯视投影 + 连线）
    const cx = w / 2;
    const cy = h / 2 + 10;
    const rTop = Math.min(w, h) * 0.16;
    const rBot = Math.min(w, h) * 0.1;

    if (shape === '正方体') {
      const s = Math.min(w, h) * 0.24;
      const ox = cx - s / 2;
      const oy = cy - s / 2;
      const dz = s * 0.32;
      poly(f, [[ox, oy], [ox + s, oy], [ox + s, oy + s], [ox, oy + s]], { stroke: C.accent, lw: 2 });
      poly(f, [[ox + dz, oy - dz], [ox + s + dz, oy - dz], [ox + s + dz, oy + s - dz], [ox + dz, oy + s - dz]], { stroke: C.cyan, lw: 2 });
      [[ox, oy], [ox + s, oy], [ox + s, oy + s], [ox, oy + s]].forEach(([x, y]) =>
        seg(f, x, y, x + dz, y - dz, { color: C.dim, lw: 1.4 } as never));
      for (let i = 0; i < 4; i++) dot(f, i === 0 || i === 3 ? ox : ox + s, i < 2 ? oy : oy + s, 3.5, C.warm);
    } else {
      const n = shape === '正四面体' ? 3 : 4;
      const top = regularPoly(f, cx, cy - rTop * 1.2, rTop, n);
      const bot = regularPoly(f, cx, cy + rBot * 2.4, rBot, n, (shape === '正四面体' ? -Math.PI / 2 : 0) + Math.PI / n);
      poly(f, top, { stroke: C.accent, lw: 2, close: true });
      poly(f, bot, { stroke: C.cyan, lw: 2, close: true });
      const m = Math.min(top.length, bot.length);
      for (let i = 0; i < m; i++) {
        seg(f, top[i][0], top[i][1], bot[i][0], bot[i][1], { color: C.dim, lw: 1.4 } as never);
        dot(f, top[i][0], top[i][1], 3.5, C.warm);
        dot(f, bot[i][0], bot[i][1], 3.5, C.warm);
      }
      text(f, '（示意投影）', cx, h - 100, { align: 'center', color: C.dim, font: '12px system-ui' });
    }

    text(f, `V − E + F = ${d.V} − ${d.E} + ${d.F} = ${d.V - d.E + d.F}`, w / 2, 52, {
      align: 'center', font: 'bold 22px "Times New Roman", serif', color: C.warm,
    });
    text(f, `顶点 V = ${d.V}　棱 E = ${d.E}　面 F = ${d.F}`, w / 2, 82, {
      align: 'center', color: C.fg, font: '14px system-ui',
    });
    const sumSides = d.sides.reduce((a, b) => a + b, 0);
    text(f, `校验：2E = ${2 * d.E} = Σ 各面边数`, w / 2, 104, { align: 'center', color: C.dim, font: '12px system-ui' });
    void sumSides;

    heading(f, '欧拉多面体公式：V − E + F = 2');
    footnotes(f, [
      '无论怎样拉伸变形（只要还是凸多面体、没打洞），这个值恒为 2',
      '它是拓扑不变量的最早发现之一：关心的是「连接方式」而非长度与角度',
      '推广到有 g 个洞的曲面：V − E + F = 2 − 2g（欧拉示性数）',
    ]);
  },
});

registerViz(
  plimpton322Viz,
  pythagoreanTheoremViz,
  euclideanAlgorithmViz,
  sieveOfEratosthenesViz,
  fibonacciRabbitViz,
  luneOfHippocratesViz,
  heronsFormulaViz,
  zuGengPrincipleViz,
  alKhwarizmiViz,
  jiaXianTriangleViz,
  inventionOfLogarithmViz,
  descartesAnalyticGeometryViz,
  konigsbergBridgesViz,
  eulerPolyhedronViz,
);
