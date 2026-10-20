import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import {
  C,
  PALETTE,
  circle,
  dot,
  footnotes,
  footnote,
  grid,
  heading,
  poly,
  polyView,
  seg,
  text,
  view,
} from '../canvas';

/** 正 n 边形的顶点（屏幕坐标）。 */
function regularPolygon(cx: number, cy: number, r: number, sides: number, rotation = -Math.PI / 2): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i / sides) * Math.PI * 2;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/** 组合数 C(n, k)。 */
function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

/** B16 几何图形。 */
const geometryShapes = defineViz({
  slug: 'geometry-shapes',
  title: '几何图形',
  params: {
    sides: { type: 'range', min: 3, max: 12, default: 6, label: '边数' },
    radius: { type: 'range', min: 3, max: 12, default: 8, label: '半径' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const sides = Math.round(num(params, 'sides', 6));
    const r = num(params, 'radius', 8);
    const side = 2 * r * Math.sin(Math.PI / sides);
    const cx = w * 0.36;
    const cy = h / 2;
    const px = Math.min(w, h) * 0.3;
    poly(f, regularPolygon(cx, cy, px, sides), { fill: 'rgba(102,126,234,0.25)', stroke: C.accent, lw: 2, close: true });
    for (const [x, y] of regularPolygon(cx, cy, px, sides)) dot(f, x, y, 3, C.warm);
    text(f, `正 ${sides} 边形`, cx, cy + px + 28, { align: 'center', color: C.fg });

    const lines = [
      `边长 a = 2R·sin(π/n) = ${side.toFixed(3)}`,
      `周长 = ${(side * sides).toFixed(3)}`,
      `面积 = ${((sides / 2) * r * r * Math.sin((2 * Math.PI) / sides)).toFixed(3)}`,
      `内角和 = (n-2)·180° = ${(sides - 2) * 180}°`,
      `每个内角 = ${(((sides - 2) * 180) / sides).toFixed(2)}°`,
    ];
    lines.forEach((s, i) => text(f, s, w * 0.62, 70 + i * 26, { color: i === 0 ? C.warm : C.fg, font: '15px Consolas, monospace' }));
    heading(f, '正多边形的边、角与面积');
  },
});

/** B17 对称与变换。 */
const symmetry = defineViz({
  slug: 'symmetry',
  title: '对称与变换',
  params: {
    transform: { type: 'select', options: ['平移', '旋转', '反射'], default: '旋转', label: '变换' },
    amount: { type: 'range', min: 0, max: 360, default: 90, label: '角度/距离' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'transform', '旋转');
    const amount = num(params, 'amount', 90);
    const cx = w / 2;
    const cy = h / 2;
    const shape: Array<[number, number]> = [[-60, -40], [40, -40], [40, 30], [0, 40], [-60, 30]];

    seg(f, 0, cy, w, cy, C.grid, 1);
    seg(f, cx, 0, cx, h, C.grid, 1);

    // 原图
    poly(f, shape.map(([x, y]) => [cx + x, cy + y] as [number, number]), { fill: 'rgba(102,126,234,0.35)', stroke: C.accent, lw: 2, close: true });
    text(f, '原图', cx - 10, cy - 60, { color: C.accent });

    const rad = (amount * Math.PI) / 180;
    const moved = shape.map(([x, y]) => {
      if (kind === '平移') {
        return [cx + x + amount * 1.2, cy + y] as [number, number];
      }
      if (kind === '旋转') {
        // 绕原点（图形左下角附近）旋转
        const ox = -60;
        const oy = 40;
        const dx = x - ox;
        const dy = y - oy;
        return [cx + ox + dx * Math.cos(rad) - dy * Math.sin(rad), cy + oy + dx * Math.sin(rad) + dy * Math.cos(rad)] as [number, number];
      }
      return [cx - x, cy + y] as [number, number];
    });
    poly(f, moved, { fill: 'rgba(245,101,101,0.3)', stroke: C.hot, lw: 2, close: true });
    text(f, '像', moved[0][0] + 10, moved[0][1] - 10, { color: C.hot });

    const desc =
      kind === '平移' ? `平移 ${amount.toFixed(0)} 像素：形状与方向完全不变`
        : kind === '旋转' ? `旋转 ${amount.toFixed(0)}°：绕固定点转动，形状不变`
          : `沿 y 轴反射：左右翻转，手性改变`;
    footnotes(f, [desc, '对称变换保持距离与角度 —— 这正是"全等"的含义']);
    heading(f, `对称变换：${kind}`);
  },
});

/** B18 七巧板。 */
const tangram = defineViz({
  slug: 'tangram',
  title: '七巧板',
  params: {
    size: { type: 'range', min: 160, max: 320, default: 240, label: '边长' },
    highlight: { type: 'range', min: 0, max: 7, default: 0, label: '高亮块' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const s = num(params, 'size', 240);
    const hl = Math.round(num(params, 'highlight', 0));
    const ox = (w - s) / 2;
    const oy = (h - s) / 2 - 10;
    const p = (x: number, y: number): [number, number] => [ox + x, oy + y];
    const pieces: Array<Array<[number, number]>> = [
      [p(0, 0), p(s / 2, s / 2), p(0, s)],                       // 大三角 1
      [p(0, 0), p(s / 2, s / 2), p(s, 0)],                       // 大三角 2
      [p(s / 2, s / 2), p(s, 0), p(s, s / 2)],                   // 中三角
      [p(s / 2, s / 2), p(s, s / 2), p(s / 2, s)],               // 小三角 1
      [p(s / 2, s / 2), p(s / 2, s), p(3 * s / 4, 3 * s / 4)],   // 小三角 2
      [p(s / 4, 3 * s / 4), p(s / 2, s), p(3 * s / 4, 3 * s / 4), p(s / 2, s / 2)], // 正方形
      [p(3 * s / 4, 3 * s / 4), p(s / 2, s), p(s, s)]            // 平行四边形
    ];
    pieces.forEach((pts, i) => {
      poly(f, pts, {
        fill: i === hl ? C.warm : `${PALETTE[i % PALETTE.length]}55`,
        stroke: i === hl ? C.yellow : PALETTE[i % PALETTE.length],
        lw: i === hl ? 3 : 1.5,
        close: true,
      });
    });
    text(f, `大正方形边长 ${s}px，面积 ${s * s}px²`, 20, h - 54, { color: C.fg });
    text(f, '七个板块：2 个大三角 + 1 个中三角 + 2 个小三角 + 1 个正方形 + 1 个平行四边形', 20, h - 32, { color: C.dim });
    text(f, '面积分割：每块面积都是整体面积的 1/4、1/8 或 1/16', 20, h - 12, { color: C.dim });
    heading(f, '七巧板：几何拼图与面积分割');
  },
});

/** B19 Spirograph 齿轮画。 */
const spirograph = defineViz({
  slug: 'spirograph',
  title: 'Spirograph 齿轮画',
  params: {
    R: { type: 'range', min: 40, max: 180, default: 120, label: '定圆半径 R' },
    r: { type: 'range', min: 10, max: 100, default: 45, label: '动圆半径 r' },
    d: { type: 'range', min: 5, max: 120, default: 70, label: '笔距圆心 d' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const R = num(params, 'R', 120);
    const r = num(params, 'r', 45);
    const d = num(params, 'd', 70);
    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) / (2 * (R + 8));
    const k = R / r;
    const turns = Math.abs(r) < 0.01 ? 1 : (Math.abs(k - Math.round(k)) < 1e-6 ? Math.round(k) : 1) ;
    const total = Math.abs(r) < 0.01 ? 0 : 2 * Math.PI * (turns || 1) * 3;

    poly(f, spiroPath(cx, cy, R, r, d, scale, Math.max(total, Math.PI * 6)), { stroke: C.accent, lw: 1.6 });
    circle(f, cx, cy, R * scale, { stroke: C.dim, lw: 1, dash: [4, 4] });
    dot(f, cx, cy, 3, C.warm);
    footnotes(f, [
      `内旋轮线：R=${R}, r=${r}, d=${d}`,
      '当 R/r 为有理数时曲线闭合，其形状由内摆线族决定',
    ]);
    heading(f, 'Spirograph：圆内滚动的笔尖轨迹');
  },
});

/** 内旋轮线采样点。 */
function spiroPath(cx: number, cy: number, R: number, r: number, d: number, scale: number, total: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const steps = 1400;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * total;
    const k = (R - r) / r;
    const x = (R - r) * Math.cos(t) + d * Math.cos(k * t);
    const y = (R - r) * Math.sin(t) - d * Math.sin(k * t);
    pts.push([cx + x * scale, cy + y * scale]);
  }
  return pts;
}

/** B20 帕斯卡三角。 */
const pascalTriangle = defineViz({
  slug: 'pascal-triangle',
  title: '帕斯卡三角',
  params: {
    rows: { type: 'range', min: 3, max: 14, default: 9, label: '行数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const rows = Math.round(num(params, 'rows', 9));
    const cell = Math.min((w - 60) / (rows * 2 + 1), (h - 90) / rows, 44);
    const top = 52;
    let maxV = 1;
    for (let n = 0; n < rows; n++) for (let k = 0; k <= n; k++) maxV = Math.max(maxV, comb(n, k));

    for (let n = 0; n < rows; n++) {
      const y = top + n * cell;
      for (let k = 0; k <= n; k++) {
        const x = w / 2 + (k - n / 2) * cell;
        const v = comb(n, k);
        const t = v / maxV;
        const { ctx } = f;
        ctx.save();
        ctx.fillStyle = v % 2 === 0 ? C.panel : `hsl(${230 - t * 60}, 60%, ${30 + t * 30}%)`;
        ctx.fillRect(x - cell * 0.42, y, cell * 0.84, cell * 0.78);
        ctx.restore();
        if (cell > 22) {
          text(f, String(v), x, y + cell * 0.5, { align: 'center', color: C.fg, font: `${Math.max(9, cell * 0.3)}px "Segoe UI", system-ui, sans-serif` });
        }
      }
    }
    footnotes(f, [
      `第 n 行第 k 个 = C(n,k) = C(n-1,k-1) + C(n-1,k)`,
      `第 ${rows - 1} 行之和 = 2^${rows - 1} = ${Math.pow(2, rows - 1)}`,
    ]);
    heading(f, '帕斯卡三角：二项式系数表');
  },
});

/** B21 斐波那契与自然。 */
const fibonacciNature = defineViz({
  slug: 'fibonacci-nature',
  title: '斐波那契与自然',
  params: {
    seeds: { type: 'range', min: 50, max: 900, default: 400, label: '种子数' },
    angle: { type: 'range', min: 100, max: 170, default: 137.5, step: 0.1, label: '发散角(°)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'seeds', 400));
    const angle = (num(params, 'angle', 137.5) * Math.PI) / 180;
    const cx = w * 0.36;
    const cy = h / 2;
    const scale = Math.min(w * 0.6, h) / (2 * Math.sqrt(n));
    for (let i = 0; i < n; i++) {
      const r = scale * Math.sqrt(i);
      const a = i * angle;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      dot(f, x, y, 1.6 + (i / n) * 2.4, `hsl(${(i * 1.2) % 60 + 25}, 75%, ${45 + (i / n) * 20}%)`);
    }
    const fib: number[] = [1, 1];
    for (let i = 2; i < 10; i++) fib.push(fib[i - 1] + fib[i - 2]);
    const lines = [
      `发散角 ${num(params, 'angle', 137.5).toFixed(1)}°（黄金角 ≈ 137.5077°）`,
      `斐波那契：${fib.slice(0, 8).join(', ')} …`,
      '顺时针与逆时针螺旋数往往是相邻的斐波那契数（如 8 和 13、34 和 55）',
      '黄金角让种子互不遮挡，最大化受光与空间利用',
    ];
    lines.forEach((s, i) => text(f, s, w * 0.62, 70 + i * 40, { color: i === 0 ? C.warm : C.dim }));
    heading(f, '向日葵种子排列与黄金角');
  },
});

/** B22 贝尔数。 */
const bellNumbers = defineViz({
  slug: 'bell-numbers',
  title: '贝尔数',
  params: {
    n: { type: 'range', min: 3, max: 10, default: 8, label: '元素个数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'n', 8));
    // Bell 三角
    const rows: number[][] = [[1]];
    for (let i = 1; i < n; i++) {
      const prev = rows[i - 1];
      const row = [prev[prev.length - 1]];
      for (let j = 0; j < prev.length; j++) row.push(row[j] + prev[j]);
      rows.push(row);
    }
    const bells = rows.map((r) => r[0]);
    const cell = Math.min((w - 60) / (n * 2), (h - 130) / n, 40);
    rows.forEach((row, i) => {
      row.forEach((v, j) => {
        const x = 30 + j * cell * 1.1;
        const y = 50 + i * cell * 1.1;
        const { ctx } = f;
        ctx.save();
        ctx.fillStyle = j === 0 ? C.accent : C.panel;
        ctx.fillRect(x, y, cell, cell);
        ctx.restore();
        if (cell > 20) text(f, String(v), x + cell / 2, y + cell * 0.65, { align: 'center', font: `${Math.max(10, cell * 0.32)}px sans-serif` });
      });
    });
    text(f, `B(n) = Σ C(n-1,k)·B(k)`, w * 0.6, 70, { color: C.dim });
    text(f, `集合 {1..${n}} 的划分方式数`, w * 0.6, 96, { color: C.dim });
    bells.forEach((b, i) => {
      text(f, `B(${i}) = ${b}`, w * 0.6, 130 + i * 22, { color: i === bells.length - 1 ? C.warm : C.fg, font: '14px Consolas, monospace' });
    });
    heading(f, '贝尔三角与集合划分数');
  },
});

/** B23 三角形数。 */
const triangularNumbers = defineViz({
  slug: 'triangular-numbers',
  title: '三角形数',
  params: {
    n: { type: 'range', min: 1, max: 12, default: 6, label: '行数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'n', 6));
    const cell = Math.min((w - 80) / n, (h - 130) / n, 40);
    const ox = (w - n * cell) / 2;
    const oy = 56;
    for (let row = 0; row < n; row++) {
      for (let c = 0; c <= row; c++) {
        dot(f, ox + c * cell + cell / 2, oy + row * cell + cell / 2, cell * 0.36, PALETTE[row % PALETTE.length]);
      }
    }
    const T = (n * (n + 1)) / 2;
    footnotes(f, [
      `第 ${n} 个三角形数 T(${n}) = 1+2+…+${n} = ${T}`,
      `公式 T(n) = n(n+1)/2，也等于 C(n+1, 2)`,
      `T(n) + T(n-1) = n²（图示的两个三角形拼成正方形）`,
    ]);
    heading(f, '三角形数：点阵的规律');
  },
});

/** B24 幻方。 */
const magicSquare = defineViz({
  slug: 'magic-square',
  title: '幻方',
  params: {
    n: { type: 'range', min: 3, max: 9, default: 5, label: '阶数（奇数）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    let n = Math.round(num(params, 'n', 5));
    if (n % 2 === 0) n += 1;
    n = Math.max(3, Math.min(9, n));
    const magic = phinStep(n);
    const cell = Math.min((w - 80) / n, (h - 120) / n, 54);
    const ox = (w - n * cell) / 2;
    const oy = 52;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const v = magic[r][c];
        const t = v / (n * n);
        const { ctx } = f;
        ctx.save();
        ctx.fillStyle = `hsl(${230 - t * 90}, 55%, ${26 + t * 26}%)`;
        ctx.fillRect(ox + c * cell, oy + r * cell, cell - 2, cell - 2);
        ctx.restore();
        text(f, String(v), ox + c * cell + cell / 2, oy + r * cell + cell / 2 + 6, {
          align: 'center',
          font: `${Math.max(11, cell * 0.35)}px "Segoe UI", system-ui, sans-serif`,
          color: C.fg,
        });
      }
    }
    const sum = (n * (n * n + 1)) / 2;
    footnotes(f, [
      `${n} 阶幻方：每行、每列、两条对角线之和都等于 ${sum}`,
      '构造法（Siamese 法）：从顶行中间开始，每次向右上方填数，越界则回绕',
    ]);
    heading(f, '幻方：等和的数字方阵');
  },
});

/** 奇数阶幻方（Siamese 法）。 */
function phinStep(n: number): number[][] {
  const m: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  let r = 0;
  let c = Math.floor(n / 2);
  for (let v = 1; v <= n * n; v++) {
    m[r][c] = v;
    const nr = (r - 1 + n) % n;
    const nc = (c + 1) % n;
    if (m[nr][nc] !== 0) {
      r = (r + 1) % n;
    } else {
      r = nr;
      c = nc;
    }
  }
  return m;
}

/** B25 黄金分割。 */
const goldenRatio = defineViz({
  slug: 'golden-ratio',
  title: '黄金分割',
  params: {
    depth: { type: 'range', min: 3, max: 12, default: 8, label: '分割层数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const depth = Math.round(num(params, 'depth', 8));
    const phi = (1 + Math.sqrt(5)) / 2;
    let size = Math.min(w, h) * 0.72;
    let x = (w - size) / 2;
    let y = (h - size) / 2 - 10;
    const dirs = ['right', 'down', 'left', 'up'];
    for (let i = 0; i < depth; i++) {
      const dir = dirs[i % 4];
      const longSide = size;
      const shortSide = size / phi;
      let rw = longSide;
      let rh = shortSide;
      if (dir === 'down' || dir === 'up') {
        rw = shortSide;
        rh = longSide;
      }
      poly(f, [[x, y], [x + rw, y], [x + rw, y + rh], [x, y + rh]], {
        fill: `${PALETTE[i % PALETTE.length]}22`,
        stroke: PALETTE[i % PALETTE.length],
        lw: 1.5,
        close: true,
      });
      // 圆弧
      const { ctx } = f;
      ctx.save();
      ctx.strokeStyle = C.warm;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      if (dir === 'right') {
        ctx.arc(x, y + rh, rh, -Math.PI / 2, 0);
      } else if (dir === 'down') {
        ctx.arc(x + rw, y, rw, 0, Math.PI / 2);
      } else if (dir === 'left') {
        ctx.arc(x + rw, y + rh, rh, Math.PI / 2, Math.PI);
      } else {
        ctx.arc(x, y + rh, rw, Math.PI, 1.5 * Math.PI);
      }
      ctx.stroke();
      ctx.restore();

      if (dir === 'right') {
        x += rw;
        size = rh;
      } else if (dir === 'down') {
        y += rh;
        size = rw;
      } else if (dir === 'left') {
        size = rh;
        x -= size;
      } else {
        size = rw;
        y -= size;
      }
      size = Math.max(size, 1);
    }
    footnotes(f, [
      `φ = (1+√5)/2 ≈ ${phi.toFixed(6)}`,
      `φ² = φ + 1 ≈ ${(phi * phi).toFixed(6)}，1/φ = φ - 1 ≈ ${(1 / phi).toFixed(6)}`,
      '黄金矩形去掉一个正方形后，剩下的小矩形与原矩形相似',
    ]);
    heading(f, '黄金矩形与黄金螺线');
  },
});

/** B26 卡特兰数。 */
const catalanNumbers = defineViz({
  slug: 'catalan-numbers',
  title: '卡特兰数',
  params: {
    n: { type: 'range', min: 1, max: 8, default: 4, label: 'n（格路径阶数）' },
    step: { type: 'range', min: 1, max: 14, default: 6, label: '示意路径步数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'n', 4));
    const step = Math.round(num(params, 'step', 6));
    const v = view(f, { xMin: -0.4, xMax: n + 0.4, yMin: -0.4, yMax: n + 0.4, inset: 44 });
    grid(f, v, { divisions: n + 1, ticks: true });

    // 禁止越过的对角线
    polyView(f, v, [[0, 0], [n, n]], { stroke: C.hot, lw: 1.5, dash: [6, 4] });

    // 示意路径（R 向右，U 向上），保持 x >= y
    let x = 0;
    let y = 0;
    const path: Array<[number, number]> = [[0, 0]];
    for (let i = 0; i < Math.min(step, 2 * n); i++) {
      if (x < n && (x > y || y >= n)) {
        x += 1;
      } else if (y < n) {
        y += 1;
      } else {
        break;
      }
      path.push([x, y]);
    }
    poly(f, path.map(([a, b]) => [v.sx(a), v.sy(b)] as [number, number]), { stroke: C.green, lw: 2.5 });
    for (const [a, b] of path) dot(f, v.sx(a), v.sy(b), 3.5, C.green);

    const cat = comb(2 * n, n) / (n + 1);
    footnotes(f, [
      `C(${n}) = C(2n,n)/(n+1) = ${cat}`,
      '从 (0,0) 到 (n,n)、始终不越过对角线的格路径条数',
      '同一数列还数括号匹配、出栈顺序、二叉树形态',
    ]);
    heading(f, '卡特兰数：不越界的格路径');
  },
});

/** B27 毕达哥拉斯三元组。 */
const pythagoreanTriples = defineViz({
  slug: 'pythagorean-triples',
  title: '勾股数三元组',
  params: {
    limit: { type: 'range', min: 10, max: 120, default: 60, label: '搜索上限' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const limit = Math.round(num(params, 'limit', 60));
    const triples: Array<[number, number, number]> = [];
    for (let a = 3; a <= limit && triples.length < 40; a++) {
      for (let b = a + 1; a * a + b * b <= limit * limit; b++) {
        const c2 = a * a + b * b;
        const c = Math.round(Math.sqrt(c2));
        if (c * c === c2) triples.push([a, b, c]);
      }
    }
    const shown = triples.slice(0, 12);
    shown.forEach(([a, b, c], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      text(f, `${a}² + ${b}² = ${c}²`, 24 + col * (w / 3), 60 + row * 22, { color: C.fg, font: '14px Consolas, monospace' });
    });

    // 画 3-4-5
    const first = triples[0] ?? [3, 4, 5];
    const scale = Math.min(h * 0.4, w * 0.3) / first[2];
    const ox = w * 0.55;
    const oy = h * 0.6;
    poly(f, [[ox, oy], [ox + first[0] * scale, oy], [ox, oy - first[1] * scale]], {
      fill: 'rgba(102,126,234,0.25)', stroke: C.accent, lw: 2, close: true,
    });
    text(f, `${first[0]}`, ox + first[0] * scale / 2, oy + 18, { align: 'center', color: C.cool });
    text(f, `${first[1]}`, ox - 12, oy - first[1] * scale / 2, { align: 'right', color: C.green });
    text(f, `${first[2]}`, ox + first[0] * scale * 0.55, oy - first[1] * scale * 0.55, { color: C.warm });
    footnotes(f, [
      `${limit} 以内共找到 ${triples.length} 组勾股数`,
      '本原三元组参数化：a = m²-n², b = 2mn, c = m²+n²（m>n，互质且奇偶不同）',
    ]);
    heading(f, '勾股数三元组');
  },
});

/** B28 平方和。 */
const sumOfSquares = defineViz({
  slug: 'sum-of-squares',
  title: '平方和',
  params: {
    n: { type: 'range', min: 1, max: 12, default: 6, label: '项数 n' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'n', 6));
    const sum = (n * (n + 1) * (2 * n + 1)) / 6;
    const scale = Math.min((w - 80) / (n * (n + 1)), (h - 150) / n, 22);
    let y = h - 90;
    for (let k = n; k >= 1; k--) {
      for (let c = 0; c < k; c++) {
        const x = 40 + c * k * scale;
        poly(f, [[x, y - k * scale], [x + k * scale, y - k * scale], [x + k * scale, y], [x, y]], {
          fill: `${PALETTE[(k - 1) % PALETTE.length]}44`,
          stroke: PALETTE[(k - 1) % PALETTE.length],
          lw: 1,
          close: true,
        });
        text(f, `${k}`, x + k * scale - 8, y - 6, { align: 'right', color: C.dim, font: '11px sans-serif' });
      }
      y -= k * scale + 2;
    }
    footnotes(f, [
      `1² + 2² + … + ${n}² = ${sum}`,
      `公式 Σk² = n(n+1)(2n+1)/6`,
      '把每个 k² 画成 k×k 的正方形，全部拼起来就是图中的锯齿形',
    ]);
    heading(f, '平方和：正方形拼块');
  },
});

/** B29 欧拉恒等式。 */
const eulerIdentity = defineViz({
  slug: 'euler-identity',
  title: '欧拉恒等式',
  params: {
    theta: { type: 'range', min: 0, max: 360, default: 180, label: '角度 θ(°)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const deg = num(params, 'theta', 180);
    const rad = (deg * Math.PI) / 180;
    const v = view(f, { xMin: -1.4, xMax: 1.4, yMin: -1.4, yMax: 1.4, inset: 40 });
    grid(f, v, { divisions: 4, ticks: true });

    // 单位圆的实部/虚部投影
    poly(f, sampledUnitCircle(v), { stroke: C.dim, lw: 1.2, dash: [4, 4] });
    const px = Math.cos(rad);
    const py = Math.sin(rad);
    seg(f, v.sx(0), v.sy(0), v.sx(px), v.sy(py), C.accent, 2.5);
    seg(f, v.sx(px), v.sy(py), v.sx(px), v.sy(0), C.cool, 1.4);
    seg(f, v.sx(px), v.sy(py), v.sx(0), v.sy(py), C.green, 1.4);
    dot(f, v.sx(px), v.sy(py), 5, C.warm);
    text(f, `e^iθ = cos θ + i sin θ`, 16, 44, { color: C.fg, font: '15px Consolas, monospace' });
    text(f, `θ = ${deg.toFixed(0)}°  →  ${Math.cos(rad).toFixed(3)} + ${Math.sin(rad).toFixed(3)}i`, 16, 66, { color: C.dim, font: '14px Consolas, monospace' });
    footnotes(f, [
      `cos θ = ${Math.cos(rad).toFixed(4)}（蓝色投影），sin θ = ${Math.sin(rad).toFixed(4)}（绿色投影）`,
      '当 θ = 180° 时得到 -1：e^iπ + 1 = 0，五大常数汇聚于一点',
    ]);
    heading(f, '欧拉公式在复平面上的单位圆');
  },
});

/** 单位圆的屏幕采样点。 */
function sampledUnitCircle(v: ReturnType<typeof view>): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    pts.push([v.sx(Math.cos(a)), v.sy(Math.sin(a))]);
  }
  return pts;
}

/** B30 卡瓦列里原理。 */
const cavalieri = defineViz({
  slug: 'cavalieri',
  title: '卡瓦列里原理',
  params: {
    skew: { type: 'range', min: 0, max: 120, default: 60, label: '错切量' },
    rows: { type: 'range', min: 4, max: 24, default: 12, label: '切层数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const skew = num(params, 'skew', 60);
    const rows = Math.round(num(params, 'rows', 12));
    const cx = w / 2;
    const cy = h / 2 - 6;
    const halfW = Math.min(w * 0.22, 140);
    const totalH = Math.min(h * 0.5, 200);
    const layerH = totalH / rows;
    for (let i = 0; i < rows; i++) {
      const t = (i / (rows - 1 || 1)) - 0.5;
      const y = cy - totalH / 2 + i * layerH;
      // 左：矩形
      const lx = cx - halfW * 1.9;
      f.ctx.save();
      f.ctx.fillStyle = i % 2 === 0 ? C.accent : C.accent2;
      f.ctx.fillRect(lx - halfW, y, halfW * 2, layerH - 1);
      // 右：错切后的平行四边形
      f.ctx.fillStyle = i % 2 === 0 ? C.green : C.cyan;
      f.ctx.fillRect(cx + halfW * 0.4 + t * skew, y, halfW * 2, layerH - 1);
      f.ctx.restore();
    }
    seg(f, cx - halfW * 1.9 - halfW - 20, cy - totalH / 2 - 14, cx - halfW * 1.9 + halfW + 20, cy - totalH / 2 - 14, C.fg, 2);
    seg(f, cx + halfW * 0.4 - halfW * 0.6, cy - totalH / 2 - 14, cx + halfW * 0.4 + halfW * 2.6, cy - totalH / 2 - 14, C.fg, 2);
    footnotes(f, [
      '两叠薄片每一层长度都相同 —— 因此两图形面积相等',
      '祖暅原理（卡瓦列里原理）：等高处截线等长，则体积（面积）相等',
    ]);
    heading(f, '卡瓦列里原理：错切不改变面积');
  },
});

registerViz(
  geometryShapes,
  symmetry,
  tangram,
  spirograph,
  pascalTriangle,
  fibonacciNature,
  bellNumbers,
  triangularNumbers,
  magicSquare,
  goldenRatio,
  catalanNumbers,
  pythagoreanTriples,
  sumOfSquares,
  eulerIdentity,
  cavalieri,
);
