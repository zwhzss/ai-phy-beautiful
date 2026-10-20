import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import {
  C,
  PALETTE,
  circle,
  dot,
  footnotes,
  heading,
  poly,
  polyView,
  seg,
  text,
  view,
} from '../canvas';

/** 组合数 C(n, k)。 */
function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

/** 阶乘（小规模）。 */
function fact(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/** B34 集合与逻辑。 */
const setTheory = defineViz({
  slug: 'set-theory',
  title: '集合与逻辑',
  params: {
    a: { type: 'range', min: 1, max: 12, default: 8, label: '|A|' },
    b: { type: 'range', min: 1, max: 12, default: 6, label: '|B|' },
    both: { type: 'range', min: 0, max: 8, default: 3, label: '|A∩B|' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = Math.round(num(params, 'a', 8));
    const b = Math.round(num(params, 'b', 6));
    const both = Math.min(Math.round(num(params, 'both', 3)), a, b);
    const cx = w / 2;
    const cy = h / 2 - 10;
    const r = Math.min(w, h) * 0.24;
    const off = r * 0.62;

    circle(f, cx - off, cy, r, { fill: 'rgba(102,126,234,0.28)', stroke: C.accent, lw: 2 });
    circle(f, cx + off, cy, r, { fill: 'rgba(245,101,101,0.28)', stroke: C.hot, lw: 2 });
    text(f, `A  (${a})`, cx - off - r * 0.45, cy - r - 12, { color: C.accent, align: 'center' });
    text(f, `B  (${b})`, cx + off + r * 0.45, cy - r - 12, { color: C.hot, align: 'center' });
    text(f, `${both}`, cx, cy + 6, { align: 'center', color: C.fg, font: 'bold 18px sans-serif' });
    text(f, `${a - both}`, cx - off - r * 0.35, cy + 6, { align: 'center', color: C.fg });
    text(f, `${b - both}`, cx + off + r * 0.35, cy + 6, { align: 'center', color: C.fg });

    const union = a + b - both;
    footnotes(f, [
      `|A∪B| = |A| + |B| - |A∩B| = ${a} + ${b} - ${both} = ${union}（容斥原理）`,
      `|A∩B| = ${both}    |A\\B| = ${a - both}    |B\\A| = ${b - both}`,
      `子集个数 2^|A| = ${Math.pow(2, a)}（含空集与自身）`,
    ]);
    heading(f, '韦恩图：集合的运算');
  },
});

/** B35 数论入门。 */
const numberTheory = defineViz({
  slug: 'number-theory',
  title: '数论入门',
  params: {
    n: { type: 'range', min: 4, max: 12, default: 9, label: '范围 n' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'n', 9));
    const cell = Math.min((w - 120) / n, (h - 130) / n, 34);
    const ox = (w - n * cell) / 2 + 10;
    const oy = 50;
    for (let row = 1; row <= n; row++) {
      text(f, String(row), ox - 18, oy + (row - 1) * cell + cell * 0.65, { color: C.dim, align: 'right', font: '12px sans-serif' });
      for (let col = 1; col <= n; col++) {
        const divides = col % row === 0;
        const sameRemainder = row % 3 === col % 3;
        f.ctx.save();
        f.ctx.fillStyle = divides ? C.accent : sameRemainder ? 'rgba(237,137,54,0.25)' : C.panel;
        f.ctx.fillRect(ox + (col - 1) * cell, oy + (row - 1) * cell, cell - 2, cell - 2);
        f.ctx.restore();
        text(f, String(col), ox + (col - 1) * cell + cell / 2, oy + (row - 1) * cell + cell * 0.65, {
          align: 'center',
          color: divides ? '#fff' : C.dim,
          font: `11px sans-serif`,
        });
      }
    }
    text(f, '列号 = 列标题', ox, oy - 12, { color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      '蓝色：行整除列（a | b）；橙色底：两数模 3 同余（a ≡ b mod 3）',
      '整除与同余是数论的两块基石：前者定义因子，后者定义"同余类"',
    ]);
    heading(f, '整除关系与同余网格');
  },
});

/** B36 埃氏筛。 */
const sieveEratosthenes = defineViz({
  slug: 'sieve-eratosthenes',
  title: '埃氏筛',
  params: {
    n: { type: 'range', min: 30, max: 300, default: 120, label: '筛到 n' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.max(4, Math.round(num(params, 'n', 120)));
    // 筛法：记录每个数是被哪个素数筛掉的
    const removedBy = new Array<number>(n + 1).fill(0);
    const primes: number[] = [];
    for (let p = 2; p <= n; p++) {
      if (removedBy[p] !== 0) continue;
      primes.push(p);
      for (let m = p * p; m <= n; m += p) {
        if (removedBy[m] === 0) removedBy[m] = p;
      }
    }
    const cols = Math.max(6, Math.floor((w - 40) / 30));
    const cell = Math.min(30, (w - 40) / cols - 3);
    const oy = 48;
    let drawn = 0;
    for (let v = 2; v <= n; v++) {
      const idx = drawn++;
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      const x = 20 + c * (cell + 3);
      const y = oy + r * (cell + 3);
      if (y + cell > h - 66) break;
      const isP = removedBy[v] === 0;
      f.ctx.save();
      f.ctx.fillStyle = isP ? C.accent : C.panel;
      f.ctx.fillRect(x, y, cell, cell);
      f.ctx.restore();
      text(f, String(v), x + cell / 2, y + cell * 0.68, {
        align: 'center',
        color: isP ? '#fff' : C.dim,
        font: `${Math.max(9, cell * 0.38)}px sans-serif`,
      });
      if (removedBy[v] !== 0 && cell > 20) {
        text(f, String(removedBy[v]), x + cell - 3, y + 10, { align: 'right', color: C.warm, font: '9px sans-serif' });
      }
    }
    const ratio = primes.length / Math.max(1, n - 1);
    footnotes(f, [
      `${n} 以内共 ${primes.length} 个素数（占比 ${(ratio * 100).toFixed(1)}%），最小角标是筛掉它的最小质因数`,
      '只需用不超过 √n 的素数去筛，时间复杂度 O(n log log n)',
    ]);
    heading(f, '埃拉托斯特尼筛法');
  },
});

/** B37 毕达哥拉斯树（分形树）。 */
const pythagorasTree = defineViz({
  slug: 'pythagoras-tree',
  title: '斐波那契树',
  params: {
    depth: { type: 'range', min: 1, max: 12, default: 9, label: '递归深度' },
    angle: { type: 'range', min: 15, max: 75, default: 45, label: '张角(°)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const depth = Math.round(num(params, 'depth', 9));
    const angle = (num(params, 'angle', 45) * Math.PI) / 180;
    const base = Math.min(w * 0.16, h * 0.2);
    const ox = w / 2 - base / 2;
    const oy = h - 46;

    const drawSquare = (x1: number, y1: number, x2: number, y2: number, d: number): void => {
      if (d <= 0) return;
      const dx = x2 - x1;
      const dy = y2 - y1;
      // 底边逆时针旋转 90° 得到正方形的另外两个顶点
      const x3 = x2 + dy;
      const y3 = y2 - dx;
      const x4 = x1 + dy;
      const y4 = y1 - dx;
      poly(f, [[x1, y1], [x2, y2], [x3, y3], [x4, y4]], {
        fill: `hsla(${118 + d * 12}, 60%, ${26 + d * 3}%, 0.85)`,
        stroke: 'rgba(26,32,44,0.85)',
        lw: 0.8,
        close: true,
      });
      // 在上边构造直角三角形的顶点，递归生成两个子正方形
      const len = Math.hypot(dx, dy);
      const theta = Math.atan2(dy, dx) - angle;
      const x5 = x4 + Math.cos(theta) * len * Math.cos(angle);
      const y5 = y4 + Math.sin(theta) * len * Math.cos(angle);
      drawSquare(x4, y4, x5, y5, d - 1);
      drawSquare(x5, y5, x3, y3, d - 1);
    };

    drawSquare(ox, oy, ox + base, oy, depth);
    footnotes(f, [
      `递归 ${depth} 层：每个正方形上长出两个更小的正方形（边长按勾股定理缩小）`,
      '毕达哥拉斯树的面积有限，却用无限多的小正方形填满 —— 分形的自相似之美',
    ]);
    heading(f, '毕达哥拉斯树：勾股定理的递归');
  },
});

/** B38 汉诺塔。 */
const towerOfHanoi = defineViz({
  slug: 'tower-of-hanoi',
  title: '汉诺塔',
  params: {
    discs: { type: 'range', min: 1, max: 10, default: 5, label: '盘子数' },
    progress: { type: 'range', min: 0, max: 100, default: 0, label: '进度(%)' },
  },
  draw: (f) => {
    const { ctx, w, h, params } = f;
    const discs = Math.round(num(params, 'discs', 5));
    const progress = num(params, 'progress', 0) / 100;

    // 生成完整移动序列并取当前帧
    const moves: Array<[number, number]> = [];
    const hanoi = (n: number, from: number, to: number, via: number): void => {
      if (n === 0) return;
      hanoi(n - 1, from, via, to);
      moves.push([from, to]);
      hanoi(n - 1, via, to, from);
    };
    hanoi(discs, 0, 2, 1);
    const idx = Math.floor(progress * moves.length);
    const pegs: number[][] = [Array.from({ length: discs }, (_, i) => discs - i), [], []];
    for (let m = 0; m < idx && m < moves.length; m++) {
      const [from, to] = moves[m];
      const disk = pegs[from].pop();
      if (disk !== undefined) pegs[to].push(disk);
    }

    const baseY = h - 60;
    const pegW = w / 3;
    const maxDisk = pegW * 0.86;
    const diskH = Math.min(20, (h - 140) / Math.max(1, discs));
    for (let p = 0; p < 3; p++) {
      const cx = pegW * (p + 0.5);
      ctx.save();
      ctx.fillStyle = C.panel;
      ctx.fillRect(cx - 5, 60, 10, baseY - 60);
      ctx.fillRect(cx - pegW * 0.42, baseY, pegW * 0.84, 10);
      ctx.restore();
      text(f, ['A 起点', 'B 中转', 'C 目标'][p], cx, baseY + 32, { align: 'center', color: C.dim });
      pegs[p].forEach((disk, level) => {
        const dw = (disk / discs) * maxDisk;
        const y = baseY - (level + 1) * diskH - 2;
        poly(f, [[cx - dw / 2, y], [cx + dw / 2, y], [cx + dw / 2, y + diskH - 2], [cx - dw / 2, y + diskH - 2]], {
          fill: PALETTE[(disk - 1) % PALETTE.length],
          stroke: 'rgba(26,32,44,0.6)',
          lw: 1,
          close: true,
        });
        if (diskH > 13) text(f, String(disk), cx, y + diskH * 0.7, { align: 'center', color: '#fff', font: '11px sans-serif' });
      });
    }
    footnotes(f, [
      `最少移动次数 = 2^${discs} - 1 = ${Math.pow(2, discs) - 1}，当前第 ${idx} 步`,
      '递归思想：先把 n-1 个盘子移到中转柱，再移动最大的盘子，最后把 n-1 个移到目标柱',
    ]);
    heading(f, '汉诺塔：递归与指数增长');
  },
});

/** B39 约瑟夫问题。 */
const josephusProblem = defineViz({
  slug: 'josephus-problem',
  title: '约瑟夫问题',
  params: {
    n: { type: 'range', min: 3, max: 40, default: 12, label: '人数 n' },
    k: { type: 'range', min: 2, max: 10, default: 3, label: '报数 k' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'n', 12));
    const k = Math.round(num(params, 'k', 3));
    const alive = Array.from({ length: n }, (_, i) => i);
    const order: number[] = [];
    let pos = 0;
    while (alive.length > 0) {
      pos = (pos + k - 1) % alive.length;
      order.push(alive.splice(pos, 1)[0]);
    }
    const survivor = order[order.length - 1];

    const cx = w / 2;
    const cy = h / 2 - 10;
    const r = Math.min(w, h) * 0.32;
    const outAt = new Map<number, number>();
    order.forEach((person, i) => outAt.set(person, i));

    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const isSurvivor = i === survivor;
      const step = outAt.get(i) ?? 0;
      dot(f, x, y, isSurvivor ? 15 : 11, isSurvivor ? C.green : `${PALETTE[step % PALETTE.length]}cc`);
      text(f, String(step + 1), x, y + 4, { align: 'center', color: '#fff', font: `${isSurvivor ? 13 : 10}px sans-serif` });
    }
    dot(f, cx, cy, 4, C.dim);
    footnotes(f, [
      `${n} 人围成圈报数，数到 ${k} 出列 —— 圈内数字是出列顺序`,
      `最后幸存者是第 ${survivor + 1} 号（绿点）；J(n,k) 有递推解 J(n,k) = (J(n-1,k)+k) mod n`,
    ]);
    heading(f, '约瑟夫问题：循环消除');
  },
});

/** B40 看说序列。 */
const lookAndSay = defineViz({
  slug: 'look-and-say',
  title: '看说序列',
  params: {
    terms: { type: 'range', min: 2, max: 9, default: 6, label: '项数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const terms = Math.round(num(params, 'terms', 6));
    let cur = '1';
    const rows: string[] = [cur];
    for (let i = 1; i < terms; i++) {
      let next = '';
      let j = 0;
      while (j < cur.length) {
        let count = 1;
        while (j + count < cur.length && cur[j + count] === cur[j]) count++;
        next += String(count) + cur[j];
        j += count;
      }
      cur = next;
      rows.push(cur);
    }
    let y = 52;
    rows.forEach((row, i) => {
      const shown = row.length > 60 ? `${row.slice(0, 57)}…` : row;
      text(f, `${i + 1}:`, 24, y, { color: C.dim, font: '13px Consolas, monospace' });
      text(f, shown, 60, y, { color: i === rows.length - 1 ? C.accent : C.fg, font: '13px Consolas, monospace' });
      y += 26;
      if (y > h - 60) return;
    });
    const ratio = rows.length > 1 ? rows[rows.length - 1].length / Math.max(1, rows[rows.length - 2].length) : 1;
    footnotes(f, [
      `读法：前一串中"有 count 个 digit"就写成 count digit`,
      `相邻项长度比趋于常数 λ ≈ 1.303577（康威常数），当前比 ${ratio.toFixed(3)}`,
    ]);
    heading(f, '看说序列（Look-and-say）');
  },
});

/** B41 格雷码。 */
const grayCode = defineViz({
  slug: 'gray-code',
  title: '格雷码',
  params: {
    bits: { type: 'range', min: 2, max: 5, default: 4, label: '位数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const bits = Math.round(num(params, 'bits', 4));
    const total = Math.pow(2, bits);
    const code = (i: number): number => i ^ (i >> 1);
    const cell = Math.min(34, (w - 120) / (bits + 2), (h - 130) / Math.min(total, 16));
    const shown = Math.min(total, 16);
    const ox = 70;
    const oy = 50;
    for (let i = 0; i < shown; i++) {
      const g = code(i).toString(2).padStart(bits, '0');
      const b = i.toString(2).padStart(bits, '0');
      text(f, String(i), ox - 30, oy + i * (cell + 4) + cell * 0.68, { color: C.dim, align: 'right', font: '12px Consolas, monospace' });
      text(f, b, ox, oy + i * (cell + 4) + cell * 0.68, { color: C.dim, font: '12px Consolas, monospace' });
      for (let j = 0; j < bits; j++) {
        const on = g[j] === '1';
        f.ctx.save();
        f.ctx.fillStyle = on ? C.accent : C.panel;
        f.ctx.fillRect(ox + 70 + j * (cell + 2), oy + i * (cell + 4), cell, cell);
        f.ctx.restore();
        text(f, g[j], ox + 70 + j * (cell + 2) + cell / 2, oy + i * (cell + 4) + cell * 0.68, { align: 'center', color: on ? '#fff' : C.dim, font: '12px Consolas, monospace' });
      }
    }
    text(f, '序号  二进制', ox - 30, oy - 14, { color: C.dim, font: '12px sans-serif' });
    text(f, '格雷码', ox + 70, oy - 14, { color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      `格雷码 G(i) = i ⊕ (i>>1)：相邻两个编码只有 1 位不同`,
      `${bits} 位格雷码共 ${total} 个编码，首尾也只有 1 位不同 —— 因此是一个闭环`,
    ]);
    heading(f, '格雷码：相邻只差一位的编码');
  },
});

/** B42 排列与组合。 */
const permutationCombination = defineViz({
  slug: 'permutation-combination',
  title: '排列与组合',
  params: {
    n: { type: 'range', min: 2, max: 10, default: 6, label: '元素个数 n' },
    k: { type: 'range', min: 0, max: 10, default: 3, label: '取出的个数 k' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'n', 6));
    const k = Math.min(Math.round(num(params, 'k', 3)), n);
    const perm = fact(n) / fact(n - k);
    const comb = choose(n, k);

    const size = Math.min(34, (w - 80) / n);
    for (let i = 0; i < n; i++) {
      const x = 40 + i * (size + 6);
      dot(f, x + size / 2, 80, size / 2, i < k ? C.accent : C.panel);
      text(f, String.fromCharCode(65 + i), x + size / 2, 86, { align: 'center', color: i < k ? '#fff' : C.dim, font: `${Math.max(11, size * 0.4)}px sans-serif` });
    }
    text(f, `选出的 ${k} 个元素`, 40, 40, { color: C.dim });

    const lines = [
      `排列数 P(n,k) = n!/(n-k)! = P(${n},${k}) = ${perm}`,
      `组合数 C(n,k) = P(n,k)/k! = C(${n},${k}) = ${comb}`,
      `组合不考虑顺序；排列 = 组合 × k! = ${comb} × ${fact(k)} = ${comb * fact(k)}`,
      `C(n,k) = C(n,n-k) 对称性：C(${n},${k}) = C(${n},${n - k}) = ${choose(n, n - k)}`,
      `所有子集个数 Σ C(n,k) = 2^n = ${Math.pow(2, n)}`,
    ];
    lines.forEach((s, i) => text(f, s, 40, h - 130 + i * 24, { color: i === 1 ? C.warm : C.fg, font: '14px Consolas, monospace' }));
    heading(f, '排列与组合：顺序是否重要');
  },
});

/** B43 组合证明。 */
const combinatorialProof = defineViz({
  slug: 'combinatorial-proof',
  title: '组合证明',
  params: {
    n: { type: 'range', min: 2, max: 10, default: 6, label: 'n（网格规模）' },
    k: { type: 'range', min: 0, max: 10, default: 4, label: 'k（水平步数）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'n', 6));
    const k = Math.min(Math.round(num(params, 'k', 4)), n);
    const v = view(f, { xMin: -0.5, xMax: n + 0.5, yMin: -0.5, yMax: n + 0.5, inset: Math.min(60, h * 0.16) });
    for (let i = 0; i <= n; i++) {
      seg(f, v.sx(i), v.sy(0), v.sx(i), v.sy(n), C.grid, 1);
      seg(f, v.sx(0), v.sy(i), v.sx(n), v.sy(i), C.grid, 1);
    }
    // 一条由 k 个水平步、n-k 个垂直步组成的路径
    let x = 0;
    let y = 0;
    const path: Array<[number, number]> = [[0, 0]];
    for (let i = 0; i < n; i++) {
      if (i < k) x++;
      else y++;
      path.push([x, y]);
    }
    poly(f, path.map(([a, b]) => [v.sx(a), v.sy(b)] as [number, number]), { stroke: C.green, lw: 3 });
    for (const [a, b] of path) dot(f, v.sx(a), v.sy(b), 4, C.green);

    // 交换水平步与垂直步 → 双射到 C(n, n-k)
    const mirror: Array<[number, number]> = [[0, 0]];
    let mx = 0;
    let my = 0;
    for (let i = 0; i < n; i++) {
      if (i < n - k) mx++;
      else my++;
      mirror.push([mx, my]);
    }
    poly(f, mirror.map(([a, b]) => [v.sx(a), v.sy(b)] as [number, number]), { stroke: C.warm, lw: 2, dash: [6, 4] });

    footnotes(f, [
      `从 (0,0) 到 (n,n) 走 ${n} 步、其中 ${k} 步水平：路径数 = C(${n},${k}) = ${choose(n, k)}`,
      `把"水平/垂直"互换得到双射，所以 C(${n},${k}) = C(${n},${n - k}) = ${choose(n, n - k)}（橙虚线是镜像路径）`,
    ]);
    heading(f, '组合证明：用双射代替代数运算');
  },
});

/** B44 整数分拆。 */
const integerPartition = defineViz({
  slug: 'integer-partition',
  title: '整数分拆',
  params: {
    n: { type: 'range', min: 2, max: 20, default: 10, label: '整数 n' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'n', 10));
    // p(n) 动态规划
    const p = new Array<number>(n + 1).fill(0);
    p[0] = 1;
    for (let part = 1; part <= n; part++) {
      for (let v = part; v <= n; v++) p[v] += p[v - part];
    }
    // Ferrers 图：n 的一个分拆
    const partition: number[] = [];
    let rest = n;
    for (let part = Math.ceil(n / 2); part >= 1 && rest > 0; part--) {
      if (part <= rest) {
        partition.push(part);
        rest -= part;
      }
    }
    const size = Math.min(26, (w - 120) / Math.max(...partition), (h - 170) / partition.length);
    const ox = 40;
    const oy = 70;
    partition.forEach((len, row) => {
      for (let i = 0; i < len; i++) {
        poly(f, [[ox + i * (size + 3), oy + row * (size + 3)], [ox + i * (size + 3) + size, oy + row * (size + 3)], [ox + i * (size + 3) + size, oy + (row + 1) * (size + 3) - 3], [ox + i * (size + 3), oy + (row + 1) * (size + 3) - 3]], {
          fill: PALETTE[row % PALETTE.length],
          close: true,
        });
      }
    });
    text(f, `${n} = ${partition.join(' + ')}`, ox, oy - 18, { color: C.fg, font: '15px Consolas, monospace' });

    const vals: string[] = [];
    for (let i = 0; i <= n; i++) vals.push(`${i}:${p[i]}`);
    text(f, `p(k) = ${vals.join('  ')}`, 40, h - 74, { color: C.dim, font: '13px Consolas, monospace' });
    footnotes(f, [
      `p(${n}) = ${p[n]}：把 ${n} 写成正整数之和的方法数（不计顺序）`,
      '欧拉发现分拆数与五边形数、生成函数 ∏1/(1-x^k) 有深刻联系',
    ]);
    heading(f, '整数分拆与 Ferrers 图');
  },
});

/** B45 硬币问题（Frobenius 数）。 */
const frobeniusCoin = defineViz({
  slug: 'frobenius-coin',
  title: '硬币问题',
  params: {
    a: { type: 'range', min: 2, max: 12, default: 4, label: '面额 a' },
    b: { type: 'range', min: 2, max: 12, default: 7, label: '面额 b' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    let a = Math.round(num(params, 'a', 4));
    let b = Math.round(num(params, 'b', 7));
    if (a > b) [a, b] = [b, a];
    const limit = Math.min(a * b + Math.max(a, b) * 2 + 4, 240);
    const reachable: boolean[] = new Array(limit + 1).fill(false);
    reachable[0] = true;
    for (let v = 1; v <= limit; v++) {
      reachable[v] = (v >= a && reachable[v - a]) || (v >= b && reachable[v - b]);
    }
    let frobenius = -1;
    for (let v = limit; v >= 1; v--) {
      if (!reachable[v]) {
        frobenius = v;
        break;
      }
    }
    const coprime = gcd(a, b) === 1;
    const cols = Math.min(24, Math.floor((w - 60) / 26));
    const cell = Math.min(26, (w - 60) / cols - 3);
    let drawn = 0;
    for (let v = 0; v <= limit; v++) {
      if (drawn * (cell + 3) + 60 > h - 90) break;
      const r = Math.floor(drawn / cols);
      const c = drawn % cols;
      drawn++;
      const x = 30 + c * (cell + 3);
      const y = 56 + r * (cell + 3);
      const ok = reachable[v];
      f.ctx.save();
      f.ctx.fillStyle = !ok ? 'rgba(245,101,101,0.55)' : v === frobenius ? C.warm : C.accent;
      f.ctx.fillRect(x, y, cell, cell);
      f.ctx.restore();
      if (cell > 17) text(f, String(v), x + cell / 2, y + cell * 0.7, { align: 'center', color: '#fff', font: `${Math.max(9, cell * 0.38)}px sans-serif` });
    }
    footnotes(f, [
      gcd(a, b) === 1
        ? `面额 ${a} 与 ${b}：最大不可表示的数（Frobenius 数）= ab - a - b = ${a * b - a - b}`
        : `面额 ${a} 与 ${b} 不互质（gcd = ${gcd(a, b)}），存在无限多个不可表示的数`,
      '红色是拼不出来的金额；互质时超过 Frobenius 数后所有金额都能拼出',
    ]);
    heading(f, '硬币问题：最大不可表示金额');
  },
});

/** 最大公约数。 */
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** B46 佩尔方程。 */
const pellsEquation = defineViz({
  slug: 'pells-equation',
  title: '佩尔方程',
  params: {
    N: { type: 'range', min: 2, max: 20, default: 2, label: '系数 N' },
    maxY: { type: 'range', min: 5, max: 120, default: 60, label: '搜索范围 y' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const N = Math.round(num(params, 'N', 2));
    const maxY = Math.round(num(params, 'maxY', 60));
    const solutions: Array<[number, number]> = [];
    for (let y = 1; y <= maxY && solutions.length < 12; y++) {
      const x2 = N * y * y + 1;
      const x = Math.round(Math.sqrt(x2));
      if (x * x === x2) solutions.push([x, y]);
    }
    const v = view(f, { xMin: 0, xMax: Math.max(6, (solutions[solutions.length - 1]?.[0] ?? 10) * 1.15), yMin: 0, yMax: Math.max(6, maxY * 0.9), inset: 34 });
    // 双曲线 x² - N y² = 1（x ≥ 1）
    const pts: Array<[number, number]> = [];
    for (let y = 0; y <= maxY; y += 0.25) {
      const x = Math.sqrt(N * y * y + 1);
      if (x > v.xMax) break;
      pts.push([v.sx(x), v.sy(y)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2 });
    for (const [x, y] of solutions) dot(f, v.sx(x), v.sy(y), 4.5, C.warm);
    const list = solutions.slice(0, 5).map(([x, y]) => `(${x},${y})`).join('  ');
    footnotes(f, [
      `x² - ${N}y² = 1 在 y ≤ ${maxY} 内的解：${list || '（无）'}`,
      N === Math.round(Math.sqrt(N)) ** 2
        ? '注意：N 为完全平方数时方程只有平凡解 (1,0)'
        : '最小解可由 √N 的连分数逼近得到，之后全部解由 (x₁ + y₁√N)^k 生成',
    ]);
    heading(f, '佩尔方程：整数格点上的双曲线');
  },
});

/** B47 费马小定理。 */
const fermatLittle = defineViz({
  slug: 'fermat-little',
  title: '费马小定理',
  params: {
    p: { type: 'range', min: 3, max: 31, default: 7, label: '素数 p' },
    a: { type: 'range', min: 2, max: 20, default: 3, label: '底数 a' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const p = Math.round(num(params, 'p', 7));
    const a = Math.round(num(params, 'a', 3));
    const rows: number[] = [];
    let cur = 1;
    for (let i = 1; i <= p; i++) {
      cur = (cur * a) % p;
      rows.push(cur);
    }
    const cell = Math.min(34, (w - 100) / rows.length, (h - 220) / 2);
    text(f, `${a}^k mod ${p}：`, 30, 70, { color: C.dim });
    rows.forEach((val, i) => {
      const x = 30 + i * (cell + 3);
      const isOne = val === 1;
      f.ctx.save();
      f.ctx.fillStyle = isOne ? C.green : C.panel;
      f.ctx.fillRect(x, 82, cell, cell);
      f.ctx.restore();
      text(f, String(val), x + cell / 2, 82 + cell * 0.7, { align: 'center', color: isOne ? '#fff' : C.fg, font: `${Math.max(10, cell * 0.36)}px sans-serif` });
      if (cell > 22) text(f, String(i + 1), x + cell / 2, 82 + cell + 14, { align: 'center', color: C.dim, font: '10px sans-serif' });
    });
    const isPrimeP = isPrime(p);
    footnotes(f, [
      `费马小定理：p 为素数且 p ∤ a 时，a^(p-1) ≡ 1 (mod p)。这里 ${a}^${p - 1} mod ${p} = ${rows[p - 2]}`,
  `当前 p = ${p} ${isPrimeP ? '是素数' : '不是素数'}：${isPrimeP ? '所有余数构成完整的乘法循环群' : '结论一般不成立（这正是费马素性检验的原理）'}`,
      '把 a 的幂排成一行，模素数会遍历 1..p-1 后回到 1',
    ]);
    heading(f, '费马小定理：模幂的循环');
  },
});

/** 素性判断。 */
function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}

registerViz(
  setTheory,
  numberTheory,
  sieveEratosthenes,
  pythagorasTree,
  towerOfHanoi,
  josephusProblem,
  lookAndSay,
  grayCode,
  permutationCombination,
  combinatorialProof,
  integerPartition,
  frobeniusCoin,
  pellsEquation,
  fermatLittle,
);
