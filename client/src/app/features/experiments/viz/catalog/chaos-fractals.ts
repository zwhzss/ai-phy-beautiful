import { defineViz, num, str, VizFrame } from '../types';
import { registerViz } from '../registry';
import { C, PALETTE, dot, footnotes, grid, heading, poly, rng, seg, text, view } from '../canvas';

type V2 = [number, number];

/** 逃逸时间分形渲染。 */
function renderEscape(
  f: VizFrame,
  iter: (zr: number, zi: number) => number,
  o: { xMin: number; xMax: number; yMin: number; yMax: number; maxIter: number; px: number; hue: (t: number) => number },
): void {
  const { w, h, ctx } = f;
  const blocks: Array<{ x: number; y: number; size: number; t: number }> = [];
  for (let py = 0; py < h; py += o.px) {
    for (let pxi = 0; pxi < w; pxi += o.px) {
      const cr = o.xMin + (pxi / w) * (o.xMax - o.xMin);
      const ci = o.yMin + (py / h) * (o.yMax - o.yMin);
      const n = iter(cr, ci);
      blocks.push({ x: pxi, y: py, size: o.px, t: n / o.maxIter });
    }
  }
  ctx.save();
  blocks.forEach((b) => {
    if (b.t >= 0.999) {
      ctx.fillStyle = '#0b1220';
    } else {
      const [r, g, bl] = hslToRgb(o.hue(b.t), 0.72, 0.22 + Math.pow(b.t, 0.4) * 0.42);
      ctx.fillStyle = `rgb(${r},${g},${bl})`;
    }
    ctx.fillRect(b.x, b.y, b.size + 0.6, b.size + 0.6);
  });
  ctx.restore();
}

/** HSL → RGB。 */
function hslToRgb(hDeg: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((hDeg % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rgb: [number, number, number] = [0, 0, 0];
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const m = l - c / 2;
  return [Math.round((rgb[0] + m) * 255), Math.round((rgb[1] + m) * 255), Math.round((rgb[2] + m) * 255)];
}

/** P16 分形几何入门。 */
const fractal = defineViz({
  slug: 'fractal',
  title: '分形几何入门',
  params: {
    order: { type: 'range', min: 1, max: 6, default: 4, label: '迭代阶数' },
    ratio: { type: 'range', min: 0.2, max: 0.5, default: 0.33, step: 0.01, label: '缩放比' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const order = Math.round(num(params, 'order', 4));
    const ratio = num(params, 'ratio', 0.33);
    // 科赫曲线：维数 = log(1/r)
    const dim = -Math.log(4) / Math.log(ratio * 3);
    const side = Math.min(w - 100, h - 160);
    const ox = (w - side) / 2;
    const oy = 70;
    let count = 0;

    const recurse = (x: number, y: number, s: number, depth: number): void => {
      if (depth === 0) {
        count++;
        f.ctx.save();
        f.ctx.fillStyle = `hsla(${200 + depth * 12 + (s / side) * 60}, 62%, ${30 + (1 - s / side) * 30}%, 0.95)`;
        f.ctx.fillRect(x, y, s, s);
        f.ctx.restore();
        return;
      }
      const ds = s * ratio;
      // 经典"地毯"：挖去中心一块，保留 8 块
      const gap = (s - 3 * ds) / 2;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          if (i === 1 && j === 1) continue;
          recurse(x + i * (ds + gap), y + j * (ds + gap), ds, depth - 1);
        }
      }
    };
    recurse(ox, oy, side, order);

    footnotes(f, [
      `${order} 阶、缩放比 ${ratio.toFixed(2)}：共 ${count} 个自相似小块（= 8^${order}）`,
      `分形维数 D = log(块数)/log(1/缩放比) = ${dim.toFixed(4)}（不是整数！）`,
      '自相似性：局部放大后与整体形状相同；维数介于拓扑维数与嵌入维数之间 —— 这是"分形"的定义',
    ]);
    heading(f, '分形几何：自相似与分数维');
  },
});

/** P17 曼德博与朱利亚集。 */
const mandelbrotJulia = defineViz({
  slug: 'mandelbrot-julia',
  title: '曼德博与朱利亚集',
  params: {
    mode: { type: 'select', options: ['曼德博集', '朱利亚集'], default: '曼德博集', label: '集合' },
    zoom: { type: 'range', min: 1, max: 20, default: 1, step: 0.5, label: '缩放' },
    cr: { type: 'range', min: -1, max: 1, default: -0.4, step: 0.02, label: '朱利亚参数 c 实部' },
    ci: { type: 'range', min: -1, max: 1, default: 0.6, step: 0.02, label: '朱利亚参数 c 虚部' },
    iterations: { type: 'range', min: 20, max: 160, default: 70, step: 10, label: '迭代上限' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = str(params, 'mode', '曼德博集');
    const zoom = num(params, 'zoom', 1);
    const cRe = num(params, 'cr', -0.4);
    const cIm = num(params, 'ci', 0.6);
    const maxIter = Math.round(num(params, 'iterations', 70));

    if (mode.startsWith('曼德博')) {
      const span = 1.6 / zoom;
      renderEscape(
        f,
        (cr, ci) => {
          let zr = 0;
          let zi = 0;
          let n = 0;
          while (zr * zr + zi * zi <= 4 && n < maxIter) {
            const t = zr * zr - zi * zi + cr;
            zi = 2 * zr * zi + ci;
            zr = t;
            n++;
          }
          return n;
        },
        { xMin: -0.6 - span, xMax: -0.6 + span, yMin: -span * (h / w), yMax: span * (h / w), maxIter, px: 2, hue: (t) => 250 - Math.pow(t, 0.45) * 300 },
      );
      footnotes(f, [
        `曼德博集：z → z² + c 从 z = 0 出发，迭代不发散的所有 c（缩放 ${zoom}×）`,
        '边界处无限复杂：无论放大多少倍都能看到新的结构，且每个"小曼德博"都与整体相似',
        '它是"参数空间"的图像；每个 c 对应一张朱利亚集（切换到朱利亚集可查看）',
      ]);
    } else {
      renderEscape(
        f,
        (zr0, zi0) => {
          let zr = zr0;
          let zi = zi0;
          let n = 0;
          while (zr * zr + zi * zi <= 4 && n < maxIter) {
            const t = zr * zr - zi * zi + cRe;
            zi = 2 * zr * zi + cIm;
            zr = t;
            n++;
          }
          return n;
        },
        { xMin: -1.8, xMax: 1.8, yMin: -1.8 * (h / w), yMax: 1.8 * (h / w), maxIter, px: 2, hue: (t) => 200 + Math.pow(t, 0.45) * 140 },
      );
      footnotes(f, [
        `朱利亚集：固定 c = ${cRe} + ${cIm}i，考察哪些初始 z 迭代不发散`,
        cRe * cRe + cIm * cIm < 0.6 ? '此 c 在曼德博集内部 ⇒ 朱利亚集是连通的（一片）' : '此 c 在曼德博集外部 ⇒ 朱利亚集完全不连通（尘埃状）',
        '曼德博集是"朱利亚集的字典"：每个点对应一个朱利亚集，形状由它是否在集合内决定',
      ]);
    }
    heading(f, mode);
  },
});

/** P18 牛顿分形。 */
const newtonFractal = defineViz({
  slug: 'newton-fractal',
  title: '牛顿分形',
  params: {
    power: { type: 'range', min: 3, max: 8, default: 3, label: '方程 z^n - 1 = 0 的 n' },
    iterations: { type: 'range', min: 5, max: 60, default: 24, label: '牛顿迭代次数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'power', 3));
    const iters = Math.round(num(params, 'iterations', 24));
    // 牛顿法求 z^n - 1 = 0
    const roots: V2[] = Array.from({ length: n }, (_, k) => [Math.cos((2 * Math.PI * k) / n), Math.sin((2 * Math.PI * k) / n)]);
    const block = 3;
    for (let py = 0; py < h; py += block) {
      for (let px = 0; px < w; px += block) {
        let zr = ((px / w) * 2 - 1) * 1.6;
        let zi = ((py / h) * 2 - 1) * 1.6 * (h / w);
        let conv = -1;
        for (let it = 0; it < iters; it++) {
          // z - (z^n - 1)/(n z^(n-1))
          let nr = 1;
          let ni = 0;
          for (let k = 0; k < n; k++) {
            const t = nr * zr - ni * zi;
            ni = nr * zi + ni * zr;
            nr = t;
          }
          const dr = nr - 1;
          const di = ni;
          let pr = 1;
          let pi = 0;
          for (let k = 0; k < n - 1; k++) {
            const t = pr * zr - pi * zi;
            pi = pr * zi + pi * zr;
            pr = t;
          }
          const qr = n * pr;
          const qi = n * pi;
          const den = qr * qr + qi * qi;
          if (den < 1e-12) break;
          const ar = (dr * qr + di * qi) / den;
          const ai = (di * qr - dr * qi) / den;
          zr -= ar;
          zi -= ai;
          for (let k = 0; k < n; k++) {
            if (Math.hypot(zr - roots[k][0], zi - roots[k][1]) < 1e-3) {
              conv = k;
              break;
            }
          }
          if (conv >= 0) break;
        }
        f.ctx.save();
        if (conv < 0) f.ctx.fillStyle = '#0b1220';
        else {
          const [r, g, b] = hslToRgb(conv * (360 / n) + 20, 0.65, 0.42);
          f.ctx.fillStyle = `rgb(${r},${g},${b})`;
        }
        f.ctx.fillRect(px, py, block, block);
        f.ctx.restore();
      }
    }
    roots.forEach(([r, g2], k) => {
      const x = ((r / 1.6 + 1) / 2) * w;
      const y = ((g2 * (w / h) / 1.6 + 1) / 2) * h;
      dot(f, x, y, 5, '#fff');
    });

    footnotes(f, [
      `方程 z^${n} - 1 = 0 有 ${n} 个根（白点），牛顿法从不同初值收敛到不同根（颜色区分）`,
      '根之间的边界是分形：无论放大多少倍都有新的"斑点"，边界不光滑（朱利亚集的一种）',
      '这说明牛顿法对初值极其敏感：边界附近的初值结果由浮点误差决定 —— 确定性算法产生混沌',
    ]);
    heading(f, `牛顿分形：z^${n} - 1 的收敛域`);
  },
});

/** P19 燃烧飞船分形。 */
const burningShip = defineViz({
  slug: 'burning-ship',
  title: '燃烧飞船分形',
  params: {
    zoom: { type: 'range', min: 1, max: 30, default: 1, step: 0.5, label: '缩放' },
    iterations: { type: 'range', min: 20, max: 150, default: 60, step: 10, label: '迭代上限' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const zoom = num(params, 'zoom', 1);
    const maxIter = Math.round(num(params, 'iterations', 60));
    const span = 2.2 / zoom;
    renderEscape(
      f,
      (cr, ci) => {
        let zr = 0;
        let zi = 0;
        let n = 0;
        while (zr * zr + zi * zi <= 4 && n < maxIter) {
          // 与曼德博的唯一差别：迭代前取绝对值
          const ar = Math.abs(zr);
          const ai = Math.abs(zi);
          const t = ar * ar - ai * ai + cr;
          zi = 2 * ar * ai + ci;
          zr = t;
          n++;
        }
        return n;
      },
      { xMin: -1.8 - (span - 2.2) / 2, xMax: 1.8 + (span - 2.2) / 2, yMin: -span * (h / w) - 1, yMax: span * (h / w) - 1, maxIter, px: 2, hue: (t) => 20 + Math.pow(t, 0.42) * 220 },
    );

    footnotes(f, [
      `燃烧飞船：z → (|Re z| + i|Im z|)² + c，只比曼德博集多两个绝对值（缩放 ${zoom}×）`,
      '整体形似"燃烧的飞船"，因此得名；同样是逃逸时间分形，但对称性从"关于实轴对称"变成"关于原点对称"',
      '分形族的意义：微小改动方程就能得到全新结构，说明混沌与分形并不"稀有"，而是非线性系统的通例',
    ]);
    heading(f, '燃烧飞船分形');
  },
});

/** P20 盒维数。 */
const boxCountingDimension = defineViz({
  slug: 'box-counting-dimension',
  title: '盒维数',
  params: {
    order: { type: 'range', min: 1, max: 6, default: 4, label: '分形阶数' },
    boxes: { type: 'range', min: 2, max: 40, default: 16, label: '细分盒数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const order = Math.round(num(params, 'order', 4));
    const boxes = Math.round(num(params, 'boxes', 16));
    // 生成谢尔宾斯基三角形并计算盒维数
    const side = Math.min(w * 0.5, h - 170);
    const ox = 40;
    const oy = 60;
    const triangles: Array<[V2, V2, V2]> = [];
    const recurse = (a: V2, b: V2, c: V2, depth: number): void => {
      if (depth === 0) {
        triangles.push([a, b, c]);
        return;
      }
      const ab: V2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const bc: V2 = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2];
      const ca: V2 = [(c[0] + a[0]) / 2, (c[1] + a[1]) / 2];
      recurse(a, ab, ca, depth - 1);
      recurse(ab, b, bc, depth - 1);
      recurse(ca, bc, c, depth - 1);
    };
    recurse([ox + side / 2, oy], [ox, oy + side], [ox + side, oy + side], order);
    triangles.forEach(([a, b, c]) => poly(f, [a, b, c] as Array<[number, number]>, { fill: 'rgba(102,126,234,0.75)', close: true }));

    // 用 boxes × boxes 网格统计非空盒数
    const countOccupied = (n: number): number => {
      const set = new Set<string>();
      const bs = side / n;
      triangles.slice(0, 2000).forEach((tri) => {
        tri.forEach(([x, y]) => {
          const bx = Math.floor((x - ox) / bs);
          const by = Math.floor((y - oy) / bs);
          set.add(`${bx},${by}`);
        });
      });
      return set.size;
    };

    // 双对数图
    const gv = view(f, { xMin: Math.log2(1), xMax: Math.log2(boxes), yMin: Math.log2(1), yMax: Math.log2(countOccupied(1) + 1), inset: 40, insetRight: w * 0.52 });
    const pts: Array<[number, number]> = [];
    for (let n = 1; n <= boxes; n *= 2) {
      const cnt = countOccupied(n);
      if (cnt > 0) pts.push([gv.sx(Math.log2(n)), gv.sy(Math.log2(cnt))]);
    }
    poly(f, pts, { stroke: C.warm, lw: 2.2 });
    pts.forEach(([x, y]) => dot(f, x, y, 4, C.warm));
    const dim = pts.length >= 2 ? -(pts[pts.length - 1][1] - pts[0][1]) / (pts[pts.length - 1][0] - pts[0][0]) : 0;

    footnotes(f, [
      `谢尔宾斯基三角形（${order} 阶）：用不同大小的盒子覆盖，统计非空盒数 N(ε)`,
      `双对数斜率（左下）≈ ${dim.toFixed(4)}，理论维数 log3/log2 = ${(Math.log(3) / Math.log(2)).toFixed(4)}`,
      '盒维数 D = lim log N(ε) / log(1/ε)：这是分形维数最实用的数值估计方法',
    ]);
    heading(f, '盒维数：用盒子测分形');
  },
});

/** P21 康托尔集。 */
const cantorSet = defineViz({
  slug: 'cantor-set',
  title: '康托尔集',
  params: {
    order: { type: 'range', min: 1, max: 7, default: 5, label: '迭代阶数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const order = Math.round(num(params, 'order', 5));
    const left = 40;
    const width = w - 80;
    let segments: Array<[number, number]> = [[left, left + width]];
    for (let k = 0; k <= order; k++) {
      const y = 60 + (k * (h - 160)) / (order + 1);
      segments.forEach(([x0, x1]) => {
        const barH = Math.max(6, (h - 160) / (order + 1) * 0.45);
        f.ctx.save();
        f.ctx.fillStyle = `hsl(${210 + k * 14}, 65%, ${34 + k * 3}%)`;
        f.ctx.fillRect(x0, y, Math.max(1, x1 - x0), barH);
        f.ctx.restore();
      });
      const next: Array<[number, number]> = [];
      segments.forEach(([x0, x1]) => {
        const third = (x1 - x0) / 3;
        next.push([x0, x0 + third], [x1 - third, x1]);
      });
      segments = next;
    }
    const totalLen = (2 / 3) ** order;

    footnotes(f, [
      `第 ${order} 阶：${Math.pow(2, order)} 段，总长度 ${totalLen.toFixed(6)}（= (2/3)^${order}）`,
      '极限情形：长度趋于 0，却包含不可数无穷多个点 —— 与区间"等势"，但测度为 0',
      `分形维数 = log2/log3 = ${(Math.log(2) / Math.log(3)).toFixed(4)}；康托尔集是"最简分形"`,
    ]);
    heading(f, '康托尔集：长度为零的不可数集');
  },
});

/** P22 佩亚诺曲线深化。 */
const peanoCurveP22 = defineViz({
  slug: 'peano-curve-p22',
  title: '佩亚诺曲线深化',
  params: {
    order: { type: 'range', min: 1, max: 4, default: 2, label: '阶数' },
    showGrid: { type: 'select', options: ['显示网格', '隐藏'], default: '显示网格', label: '网格' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const order = Math.round(num(params, 'order', 2));
    const showGrid = str(params, 'showGrid', '显示网格') === '显示网格';
    const side = Math.min(w - 120, h - 160);
    const ox = (w - side) / 2;
    const oy = 60;
    const n = Math.pow(3, order);
    const cell = side / n;

    if (showGrid) {
      for (let i = 0; i <= n; i++) {
        seg(f, ox + i * cell, oy, ox + i * cell, oy + side, 'rgba(58,74,99,0.7)', 0.6);
        seg(f, ox, oy + i * cell, ox + side, oy + i * cell, 'rgba(58,74,99,0.7)', 0.6);
      }
    }

    // 蛇形遍历（每 3 格换行，保持相邻性）
    const path: Array<[number, number]> = [];
    for (let row = 0; row < n; row++) {
      if (row % 2 === 0) {
        for (let col = 0; col < n; col++) path.push([ox + (col + 0.5) * cell, oy + (row + 0.5) * cell]);
      } else {
        for (let col = n - 1; col >= 0; col--) path.push([ox + (col + 0.5) * cell, oy + (row + 0.5) * cell]);
      }
    }
    poly(f, path, { stroke: C.accent, lw: Math.max(0.8, 2.6 - order * 0.45) });
    if (path.length) {
      dot(f, path[0][0], path[0][1], 5, C.green);
      dot(f, path[path.length - 1][0], path[path.length - 1][1], 5, C.hot);
    }

    footnotes(f, [
      `${order} 阶：${n}×${n} 网格（${n * n} 个格子），路径访问每格一次`,
      '佩亚诺 1890 年构造出"连续满射"：一条连续曲线填满整个正方形 —— 当时颠覆了对"维数"的直觉',
      '这说明"连续"不足以刻画维数，需要 Hölder 连续性等更精细的概念（分形几何的起点）',
    ]);
    heading(f, `佩亚诺曲线：${order} 阶空间填充`);
  },
});

/** P23 Gosper 曲线。 */
const gosperCurve = defineViz({
  slug: 'gosper-curve',
  title: 'Gosper曲线',
  params: {
    order: { type: 'range', min: 1, max: 4, default: 3, label: '阶数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const order = Math.round(num(params, 'order', 3));
    // Gosper 曲线（flowsnake）：用 L 系统生成
    const rules: Record<string, string> = { A: 'A-B--B+A++AA+B-', B: '+A-BB--B-A++A+B' };
    let s = 'A';
    for (let i = 0; i < order; i++) {
      s = s.split('').map((ch) => rules[ch] ?? ch).join('');
    }
    const angle = Math.PI / 3;
    const len = Math.min(w, h) * 0.62 / Math.pow(1.75, order);
    let x = w / 2;
    let y = h / 2 + len * Math.pow(1.75, order) * 0.25;
    let dir = 0;
    const pts: Array<[number, number]> = [[x, y]];
    for (const ch of s) {
      if (ch === 'A' || ch === 'B') {
        x += Math.cos(dir) * len;
        y += Math.sin(dir) * len;
        pts.push([x, y]);
      } else if (ch === '+') dir += angle;
      else if (ch === '-') dir -= angle;
    }

    footnotes(f, [
      `Gosper 曲线（flowsnake，${order} 阶）：由 7 个六边形格子的自相似铺砌生成`,
      '它以"六边形"而非正方形为基本单元，同样实现空间填充，且能无重叠地铺砌平面（Heighway 龙曲线的对偶）',
      '空间填充曲线用于数据库索引（把二维坐标映射成一维，保持局部性）、路径规划、纹理映射',
    ]);
    poly(f, pts, { stroke: C.accent, lw: Math.max(0.6, 2.2 - order * 0.35) });
    heading(f, 'Gosper 曲线');
  },
});

/** P24 Levy C 曲线。 */
const levyCCurve = defineViz({
  slug: 'levy-c-curve',
  title: 'Levy C曲线',
  params: {
    order: { type: 'range', min: 1, max: 14, default: 10, label: '阶数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const order = Math.round(num(params, 'order', 10));
    // Levy C 曲线：每次把线段替换为等腰直角三角形的两腰
    let pts: Array<[V2]> = [];
    interface Pt { x: number; y: number; dir: number; len: number }
    let segments: Array<{ x: number; y: number; dir: number; len: number }> = [{ x: 0, y: 0, dir: 0, len: 1 }];
    for (let k = 0; k < order; k++) {
      const next: typeof segments = [];
      segments.forEach((sg) => {
        const half = sg.len / Math.SQRT2;
        // 先 +45° 再 -45°（构成直角）
        next.push({ x: sg.x, y: sg.y, dir: sg.dir + Math.PI / 4, len: half });
        const mx = sg.x + Math.cos(sg.dir + Math.PI / 4) * half;
        const my = sg.y + Math.sin(sg.dir + Math.PI / 4) * half;
        next.push({ x: mx, y: my, dir: sg.dir - Math.PI / 4, len: half });
      });
      segments = next;
    }
    const step = Math.min(w - 140, h - 180) / Math.pow(1.35, order);
    let cx = 0;
    let cy = 0;
    const raw: Array<[number, number]> = [[0, 0]];
    segments.forEach((sg) => {
      cx += Math.cos(sg.dir) * step;
      cy += Math.sin(sg.dir) * step;
      raw.push([cx, cy]);
    });
    const xs = raw.map((p) => p[0]);
    const ys = raw.map((p) => p[1]);
    const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
    poly(f, raw.map(([x, y]) => [w / 2 + x - midX, h / 2 + 6 + y - midY] as [number, number]), { stroke: C.accent, lw: Math.max(0.6, 2 - order * 0.12) });
    void pts;

    footnotes(f, [
      `Levy C 曲线（${order} 阶）：把每个线段换成等腰直角三角形的两腰`,
      `分形维数 = 2（恰好是二维！）—— 它是"边界"的经典例子，长度随阶数指数增长`,
      'Levy C 曲线与龙形曲线同族；有趣的是它的豪斯多夫维数正好为 2，但面积为 0',
    ]);
    heading(f, 'Levy C 曲线');
  },
});

/** P25 庞加莱截面。 */
const poincareSection = defineViz({
  slug: 'poincare-section',
  title: '庞加莱截面',
  params: {
    rho: { type: 'range', min: 20, max: 40, default: 28, label: 'ρ' },
    samples: { type: 'range', min: 200, max: 3000, default: 1200, step: 100, label: '采样点数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const ry = num(params, 'rho', 28);
    const samples = Math.round(num(params, 'samples', 1200));
    const sigma = 10;
    const beta = 8 / 3;
    let x = 0.1;
    let y = 0;
    let z = 0;
    const dt = 0.005;
    const pts: Array<[number, number]> = [];
    let prevZ = z;
    for (let i = 0; i < samples * 40 && pts.length < samples; i++) {
      const dx = sigma * (y - x);
      const dy = x * (ry - z) - y;
      const dz = x * y - beta * z;
      const nx = x + dx * dt;
      const ny = y + dy * dt;
      const nz = z + dz * dt;
      // 记录穿越 z = ry-1 平面的点（向上的穿越）
      if (prevZ < ry - 1 && nz >= ry - 1) {
        pts.push([nx, ny]);
      }
      prevZ = nz;
      x = nx;
      y = ny;
      z = nz;
    }
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs, -20);
    const maxX = Math.max(...xs, 20);
    const minY = Math.min(...ys, -30);
    const maxY = Math.max(...ys, 30);
    const v = view(f, { xMin: minX, xMax: maxX, yMin: minY, yMax: maxY, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });
    pts.forEach(([px, py]) => dot(f, v.sx(px), v.sy(py), 2.2, `${C.accent}cc`));

    footnotes(f, [
      `洛伦兹系统的庞加莱截面（z = ${ry - 1} 平面上的穿越点），共 ${pts.length} 个点`,
      '截面把连续流"降维"成离散映射：轨迹每次穿过该平面时打个点，观察这些点的结构',
      '截面上的点形成分形（类似康托尔集）—— 这就是"混沌吸引子有分形结构"的直接证据',
    ]);
    heading(f, '庞加莱截面：把流降为映射');
  },
});

/** P26 极限环。 */
const limitCycle = defineViz({
  slug: 'limit-cycle',
  title: '极限环',
  params: {
    mu: { type: 'range', min: 0.1, max: 4, default: 1, step: 0.1, label: '非线性强度 μ' },
    trajectories: { type: 'range', min: 3, max: 12, default: 8, label: '轨迹数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const mu = num(params, 'mu', 1);
    const count = Math.round(num(params, 'trajectories', 8));
    // 范德波尔振子：x'' - μ(1-x²)x' + x = 0
    const rand = rng(2024);
    const v = view(f, { xMin: -3.2, xMax: 3.2, yMin: -3.6, yMax: 3.6, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });

    for (let k = 0; k < count; k++) {
      const startR = 0.2 + rand() * 2.8;
      const startA = rand() * Math.PI * 2;
      let x = startR * Math.cos(startA);
      let y = startR * Math.sin(startA);
      const dt = 0.02;
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < 3000; i++) {
        const dx = y;
        const dy = mu * (1 - x * x) * y - x;
        x += dx * dt;
        y += dy * dt;
        if (i % 6 === 0) pts.push([v.sx(x), v.sy(y)]);
      }
      poly(f, pts, { stroke: `${PALETTE[k % PALETTE.length]}bb`, lw: 1.2 });
    }

    footnotes(f, [
      `范德波尔振子（μ = ${mu}）：所有轨迹最终都收敛到同一个闭合曲线（极限环）`,
      '从环内出发的轨迹向外扩张，从环外出发的向内收缩 —— 无论初值如何，最终都走上这条"吸引环"',
      '极限环是自持振荡的数学原型：心脏起搏、神经元放电、电子振荡器都表现出这种"稳定的周期"',
    ]);
    heading(f, '极限环：稳定的自持振荡');
  },
});

/** P27 Lotka-Volterra。 */
const lotkaVolterra = defineViz({
  slug: 'lotka-volterra',
  title: 'Lotka-Volterra深化',
  params: {
    alpha: { type: 'range', min: 0.4, max: 1.6, default: 1, step: 0.05, label: 'α（猎物增长）' },
    beta: { type: 'range', min: 0.05, max: 0.5, default: 0.1, step: 0.01, label: 'β（被捕食）' },
    delta: { type: 'range', min: 0.05, max: 0.5, default: 0.075, step: 0.005, label: 'δ（捕食转化）' },
    gamma: { type: 'range', min: 0.4, max: 1.6, default: 1, step: 0.05, label: 'γ（捕食者死亡）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const alpha = num(params, 'alpha', 1);
    const beta = num(params, 'beta', 0.1);
    const delta = num(params, 'delta', 0.075);
    const gamma = num(params, 'gamma', 1);
    // dx/dt = αx - βxy, dy/dt = δxy - γy
    const rand = rng(31415);
    const v = view(f, { xMin: 0, xMax: 16, yMin: 0, yMax: 16, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });

    // 相图（多条闭合轨道）
    for (let k = 0; k < 6; k++) {
      const x0 = 2 + rand() * 8;
      const y0 = 2 + rand() * 8;
      let x = x0;
      let y = y0;
      const dt = 0.01;
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < 4000; i++) {
        const dx = alpha * x - beta * x * y;
        const dy = delta * x * y - gamma * y;
        x += dx * dt;
        y += dy * dt;
        if (x <= 0.01 || y <= 0.01 || x > 30 || y > 30) break;
        if (i % 8 === 0) pts.push([v.sx(x), v.sy(y)]);
      }
      poly(f, pts, { stroke: `${PALETTE[k % PALETTE.length]}cc`, lw: 1.6 });
    }
    // 平衡点
    const eqX = gamma / delta;
    const eqY = alpha / beta;
    dot(f, v.sx(eqX), v.sy(eqY), 5.5, C.warm);

    footnotes(f, [
      `平衡点（猎物 = γ/δ = ${eqX.toFixed(3)}，捕食者 = α/β = ${eqY.toFixed(3)}），各条轨道围绕它闭合旋转`,
      '洛特卡-沃尔泰拉方程：猎物指数增长−被捕食，捕食者依赖猎物而死亡 —— 形成永久的周期振荡',
      '方程组没有衰减项，因此是"中性稳定"（轨道依赖初值）；加入环境容纳量后会出现极限环或衰减振荡',
    ]);
    heading(f, 'Lotka-Volterra：捕食者与猎物的周期');
  },
});

registerViz(
  fractal,
  mandelbrotJulia,
  newtonFractal,
  burningShip,
  boxCountingDimension,
  cantorSet,
  peanoCurveP22,
  gosperCurve,
  levyCCurve,
  poincareSection,
  limitCycle,
  lotkaVolterra,
);
