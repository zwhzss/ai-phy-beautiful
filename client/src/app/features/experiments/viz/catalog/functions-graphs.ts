import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import {
  C,
  PALETTE,
  circle,
  curve,
  dot,
  equalView,
  footnotes,
  grid,
  heading,
  poly,
  polyView,
  seg,
  text,
  unitScale,
  view,
} from '../canvas';

/** 三角形数据（含外心、重心、垂心、九点圆心）。 */
interface Triangle {
  a: [number, number];
  b: [number, number];
  c: [number, number];
  circum: [number, number];
  centroid: [number, number];
  ortho: [number, number];
  nineCenter: [number, number];
  nineRadius: number;
  circumRadius: number;
}

/** 计算三角形的各个中心。 */
function analyzeTriangle(a: [number, number], b: [number, number], c: [number, number]): Triangle {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  const ux = ((a[0] ** 2 + a[1] ** 2) * (b[1] - c[1]) + (b[0] ** 2 + b[1] ** 2) * (c[1] - a[1]) + (c[0] ** 2 + c[1] ** 2) * (a[1] - b[1])) / d;
  const uy = ((a[0] ** 2 + a[1] ** 2) * (c[0] - b[0]) + (b[0] ** 2 + b[1] ** 2) * (a[0] - c[0]) + (c[0] ** 2 + c[1] ** 2) * (b[0] - a[0])) / d;
  const circum: [number, number] = [ux, uy];
  const centroid: [number, number] = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
  // 垂心 = 三个顶点之和 - 2 * 外心
  const ortho: [number, number] = [a[0] + b[0] + c[0] - 2 * ux, a[1] + b[1] + c[1] - 2 * uy];
  const nineCenter: [number, number] = [(ux + ortho[0]) / 2, (uy + ortho[1]) / 2];
  const circumRadius = Math.hypot(a[0] - ux, a[1] - uy);
  return { a, b, c, circum, centroid, ortho, nineCenter, nineRadius: circumRadius / 2, circumRadius };
}

/** I16 三角函数。 */
const trigonometry = defineViz({
  slug: 'trigonometry',
  title: '三角函数',
  params: {
    angle: { type: 'range', min: 0, max: 360, default: 40, label: '角度 θ' },
    freq: { type: 'range', min: 0.5, max: 3, default: 1, step: 0.5, label: '波形频率' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const deg = num(params, 'angle', 40);
    const freq = num(params, 'freq', 1);
    const rad = (deg * Math.PI) / 180;
    const cx = w * 0.28;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.22;

    circle(f, cx, cy, r, { stroke: C.dim, lw: 1.4 });
    seg(f, cx - r * 1.2, cy, cx + r * 1.35, cy, C.grid, 1);
    seg(f, cx, cy - r * 1.2, cx, cy + r * 1.2, C.grid, 1);
    const px = cx + r * Math.cos(rad);
    const py = cy - r * Math.sin(rad);
    seg(f, cx, cy, px, py, C.accent, 2.5);
    seg(f, px, cy, px, py, C.green, 1.6);
    seg(f, cx, py, px, py, C.cool, 1.6);
    dot(f, px, py, 5, C.warm);
    text(f, `cos θ = ${Math.cos(rad).toFixed(3)}`, cx + r * 0.1, cy + 18, { color: C.cool, font: '12px sans-serif' });
    text(f, `sin θ = ${Math.sin(rad).toFixed(3)}`, px + 8, (cy + py) / 2, { color: C.green, font: '12px sans-serif' });
    text(f, `θ = ${deg}°`, cx + r * 0.45, cy - r * 0.45, { color: C.fg, font: '12px sans-serif' });

    // 右侧波形
    const gx0 = w * 0.5;
    const gw = w * 0.46;
    const gy = cy;
    const amp = r * 0.9;
    seg(f, gx0, gy, gx0 + gw, gy, C.grid, 1);
    const wave = (fn: (t: number) => number, color: string): void => {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 300; i++) {
        const t = (i / 300) * Math.PI * 4 * freq;
        pts.push([gx0 + ((i / 300) * gw), gy - amp * fn(t)]);
      }
      poly(f, pts, { stroke: color, lw: 2 });
    };
    wave((t) => Math.sin(t), C.green);
    wave((t) => Math.cos(t), C.cool);
    const markerX = gx0 + (rad / (4 * Math.PI * freq)) * gw;
    seg(f, markerX, gy - amp, markerX, gy + amp, `${C.warm}99`, 1.4);
    dot(f, markerX, gy - amp * Math.sin(rad), 4, C.green);

    footnotes(f, [
      `单位圆上角度 ${deg}° 对应点 (cos, sin) = (${Math.cos(rad).toFixed(3)}, ${Math.sin(rad).toFixed(3)})`,
      '把圆上点的纵坐标随角度展开，就得到右侧的正弦曲线（绿：sin，蓝：cos）',
      'tan θ = sin/cos，在 cos = 0（90°、270°）处无定义',
    ]);
    heading(f, '三角函数：单位圆与波形');
  },
});

/** I17 圆的几何。 */
const circleGeometry = defineViz({
  slug: 'circle-geometry',
  title: '圆的几何',
  params: {
    radius: { type: 'range', min: 2, max: 10, default: 5, label: '半径 r' },
    angle: { type: 'range', min: 10, max: 350, default: 120, label: '圆心角(°)' },
  },
  draw: (f) => {
    const { ctx, w, h, params } = f;
    const r = num(params, 'radius', 5);
    const deg = num(params, 'angle', 120);
    const rad = (deg * Math.PI) / 180;
    const cx = w * 0.34;
    const cy = h / 2;
    const scale = Math.min(w * 0.28, h * 0.34) / r;
    const R = r * scale;

    circle(f, cx, cy, R, { stroke: C.dim, lw: 1.4 });
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, 0, -rad, true);
    ctx.closePath();
    ctx.fillStyle = 'rgba(102,126,234,0.3)';
    ctx.fill();
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();
    seg(f, cx, cy, cx + R, cy, C.warm, 2);
    seg(f, cx, cy, cx + R * Math.cos(rad), cy - R * Math.sin(rad), C.warm, 2);
    text(f, `r = ${r}`, cx + R * 0.5, cy - 8, { align: 'center', color: C.warm, font: '12px sans-serif' });
    text(f, `${deg}°`, cx + R * 0.42 * Math.cos(rad / 2), cy - R * 0.42 * Math.sin(rad / 2), { color: C.fg, font: '13px sans-serif' });

    const arc = r * rad;
    const sector = 0.5 * r * r * rad;
    const chord = 2 * r * Math.sin(rad / 2);
    const lines = [
      `周长 = 2πr = ${(2 * Math.PI * r).toFixed(4)}`,
      `面积 = πr² = ${(Math.PI * r * r).toFixed(4)}`,
      `弧长 = r·θ = ${r} × ${(rad).toFixed(3)} = ${arc.toFixed(4)}`,
      `弧长也等于 (θ/360°)·2πr = ${(arc).toFixed(4)}`,
      `扇形面积 = ½r²θ = ${sector.toFixed(4)}`,
      `弦长 = 2r·sin(θ/2) = ${chord.toFixed(4)}`,
    ];
    lines.forEach((s, i) => text(f, s, w * 0.58, 70 + i * 28, { color: i >= 2 && i <= 4 ? C.accent : C.fg, font: '14px Consolas, monospace' }));
    heading(f, '圆的几何：弧长与扇形面积');
  },
});

/** I18 相似三角形。 */
const similarTriangles = defineViz({
  slug: 'similar-triangles',
  title: '相似三角形',
  params: {
    k: { type: 'range', min: 0.3, max: 2.5, default: 1.6, step: 0.1, label: '相似比 k' },
    euler: { type: 'range', min: 20, max: 80, default: 45, label: '顶角(°)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const k = num(params, 'k', 1.6);
    const deg = num(params, 'euler', 45);
    const rad = (deg * Math.PI) / 180;
    const base = Math.min(w, h) * 0.26 / Math.max(1, k);
    const apexY = base * Math.tan(rad);

    const drawTri = (ox: number, oy: number, scale: number, color: string, label: string): void => {
      const pts: Array<[number, number]> = [
        [ox, oy],
        [ox + base * scale, oy],
        [ox + (base * scale) / 2, oy - apexY * scale],
      ];
      poly(f, pts, { fill: `${color}33`, stroke: color, lw: 2, close: true });
      text(f, label, ox + (base * scale) / 2, oy + 22, { align: 'center', color, font: '13px sans-serif' });
    };
    const baseY = h - 90;
    drawTri(w * 0.08, baseY, 1, C.accent, '原三角形');
    drawTri(w * 0.5, baseY, k, C.warm, `相似三角形（k = ${k}）`);

    footnotes(f, [
      `对应边之比 = ${k}，面积之比 = k² = ${(k * k).toFixed(3)}`,
      '相似判定：AA（两角相等）、SAS（两边成比例且夹角相等）、SSS（三边成比例）',
      '相似三角形对应角相等、对应边成比例 —— 这是测量高度与距离的基础',
    ]);
    heading(f, '相似三角形：形状相同，大小不同');
  },
});

/** I19 圆锥曲线。 */
const conicSections = defineViz({
  slug: 'conic-sections',
  title: '圆锥曲线',
  params: {
    kind: { type: 'select', options: ['椭圆', '抛物线', '双曲线'], default: '椭圆', label: '类型' },
    size: { type: 'range', min: 1, max: 6, default: 3, step: 0.5, label: '尺度参数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'kind', '椭圆');
    const size = num(params, 'size', 3);
    const p = size; // 焦准距
    const e = kind === '椭圆' ? 0.6 : kind === '抛物线' ? 1 : 1.6;
    const v = equalView(f, 0, 0, 10);
    grid(f, v, { divisions: 6, ticks: true });

    // 极坐标形式 r = p/(1 + e cos θ)
    const branch = (sign: number, color: string): void => {
      const pts: Array<[number, number]> = [];
      for (let i = -1800; i <= 1800; i++) {
        const theta = (i / 1800) * Math.PI;
        const r = p / (1 + e * Math.cos(theta));
        if (!Number.isFinite(r) || r <= 0) continue;
        const x = sign * r * Math.cos(theta);
        const y = r * Math.sin(theta);
        if (Math.abs(x) > 20 || Math.abs(y) > 20) continue;
        pts.push([v.sx(x), v.sy(y)]);
      }
      poly(f, pts, { stroke: color, lw: 2.5 });
    };
    branch(1, C.accent);
    if (kind === '双曲线') branch(-1, C.warm);

    // 焦点与准线
    const focusX = kind === '抛物线' ? p / 2 : kind === '椭圆' ? (p * e) / (1 - e * e) : (p * e) / (e * e - 1);
    dot(f, v.sx(kind === '双曲线' ? -focusX : focusX), v.sy(0), 5, C.green);
    text(f, '焦点', v.sx(kind === '双曲线' ? -focusX : focusX) + 6, v.sy(0) - 10, { color: C.green, font: '12px sans-serif' });
    const directrix = p / e;
    seg(f, v.sx(directrix), v.sy(v.yMin), v.sx(directrix), v.sy(v.yMax), C.hot, 1.2);
    text(f, '准线', v.sx(directrix) + 6, 60, { color: C.hot, font: '12px sans-serif' });

    const a = kind === '抛物线' ? '—' : (p / Math.abs(1 - e * e)).toFixed(3);
    footnotes(f, [
      `${kind}：离心率 e = ${e}，极坐标方程 r = p/(1 + e·cos θ)，p = ${p}`,
      e < 1 ? `e < 1：椭圆（a = ${a}，到两焦点距离之和为常数）` : e === 1 ? 'e = 1：抛物线（到焦点与准线距离相等）' : `e > 1：双曲线（两支，a = ${a}）`,
      '圆锥曲线统一定义：到焦点距离与到准线距离之比恒为 e',
    ]);
    heading(f, `圆锥曲线：${kind}`);
  },
});

/** I20 九点圆。 */
const ninePointCircle = defineViz({
  slug: 'nine-point-circle',
  title: '九点圆',
  params: {
    apex: { type: 'range', min: -3, max: 5, default: 3, step: 0.5, label: '顶点 C 高度' },
    spread: { type: 'range', min: 2, max: 6, default: 4, step: 0.5, label: '底边半宽' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const apex = num(params, 'apex', 3);
    const spread = num(params, 'spread', 4);
    const t = analyzeTriangle([-spread, -1.5], [spread, -2], [0.5, apex]);
    const v = equalView(f, 0, (apex - 3) / 2, spread + 3);

    polyView(f, v, [t.a, t.b, t.c], { fill: 'rgba(102,126,234,0.12)', stroke: C.accent, lw: 2, close: true });

    // 三边中点
    const midAB: [number, number] = [(t.a[0] + t.b[0]) / 2, (t.a[1] + t.b[1]) / 2];
    const midBC: [number, number] = [(t.b[0] + t.c[0]) / 2, (t.b[1] + t.c[1]) / 2];
    const midCA: [number, number] = [(t.c[0] + t.a[0]) / 2, (t.c[1] + t.a[1]) / 2];
    // 高的垂足
    const foot = (from: [number, number], p1: [number, number], p2: [number, number]): [number, number] => {
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const t0 = ((from[0] - p1[0]) * dx + (from[1] - p1[1]) * dy) / (dx * dx + dy * dy);
      return [p1[0] + t0 * dx, p1[1] + t0 * dy];
    };
    const fA = foot(t.a, t.b, t.c);
    const fB = foot(t.b, t.a, t.c);
    const fC = foot(t.c, t.a, t.b);
    // 顶点到垂心的中点
    const vA: [number, number] = [(t.a[0] + t.ortho[0]) / 2, (t.a[1] + t.ortho[1]) / 2];
    const vB: [number, number] = [(t.b[0] + t.ortho[0]) / 2, (t.b[1] + t.ortho[1]) / 2];
    const vC: [number, number] = [(t.c[0] + t.ortho[0]) / 2, (t.c[1] + t.ortho[1]) / 2];

    for (const p of [midAB, midBC, midCA]) dot(f, v.sx(p[0]), v.sy(p[1]), 4, C.green);
    for (const p of [fA, fB, fC]) dot(f, v.sx(p[0]), v.sy(p[1]), 4, C.cool);
    for (const p of [vA, vB, vC]) dot(f, v.sx(p[0]), v.sy(p[1]), 4, C.warm);
    circle(f, v.sx(t.nineCenter[0]), v.sy(t.nineCenter[1]), t.nineRadius * unitScale(v), { stroke: C.hot, lw: 2 });
    dot(f, v.sx(t.ortho[0]), v.sy(t.ortho[1]), 4.5, C.hot);

    footnotes(f, [
      '九点：三边中点（绿）、三条高的垂足（蓝）、顶点到垂心的中点（橙）',
      '这九个点共圆 —— 圆心是外心与垂心的中点，半径是外接圆半径的一半（红圈）',
      '九点圆还与外接圆、内切圆、三个旁切圆都相切',
    ]);
    heading(f, '九点圆定理');
  },
});

/** I21 欧拉线。 */
const eulerLine = defineViz({
  slug: 'euler-line',
  title: '欧拉线',
  params: {
    apex: { type: 'range', min: -3, max: 5, default: 3.5, step: 0.5, label: '顶点 C 高度' },
    skew: { type: 'range', min: -4, max: 4, default: 1, step: 0.5, label: '顶点 C 水平偏移' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const apex = num(params, 'apex', 3.5);
    const skew = num(params, 'skew', 1);
    const t = analyzeTriangle([-4, -2], [4, -1.5], [skew, apex]);
    const v = equalView(f, 0, (apex - 3) / 2, 7);

    polyView(f, v, [t.a, t.b, t.c], { fill: 'rgba(102,126,234,0.12)', stroke: C.accent, lw: 2, close: true });
    poly(f, [
      [v.sx(t.circum[0]), v.sy(t.circum[1])],
      [v.sx(t.centroid[0]), v.sy(t.centroid[1])],
      [v.sx(t.ortho[0]), v.sy(t.ortho[1])],
    ], { stroke: C.hot, lw: 1.6, dash: [6, 4] });

    dot(f, v.sx(t.centroid[0]), v.sy(t.centroid[1]), 6, C.warm);
    text(f, '重心 G', v.sx(t.centroid[0]) + 8, v.sy(t.centroid[1]) + 4, { color: C.warm, font: '12px sans-serif' });
    dot(f, v.sx(t.circum[0]), v.sy(t.circum[1]), 6, C.cool);
    text(f, '外心 O', v.sx(t.circum[0]) + 8, v.sy(t.circum[1]) + 4, { color: C.cool, font: '12px sans-serif' });
    dot(f, v.sx(t.ortho[0]), v.sy(t.ortho[1]), 6, C.green);
    text(f, '垂心 H', v.sx(t.ortho[0]) + 8, v.sy(t.ortho[1]) + 4, { color: C.green, font: '12px sans-serif' });
    circle(f, v.sx(t.circum[0]), v.sy(t.circum[1]), t.circumRadius * unitScale(v), { stroke: 'rgba(66,153,225,0.35)', lw: 1.2 });

    const gx = (t.circum[0] + t.ortho[0]) / 2;
    const gy = (t.circum[1] + t.ortho[1]) / 2;
    dot(f, v.sx(gx), v.sy(gy), 4, `${C.hot}cc`);

    footnotes(f, [
      '外心 O、重心 G、垂心 H 永远共线（红色虚线即欧拉线）',
      '而且 G 把 OH 分成 1:2 —— 即 OG : GH = 1 : 2，H 到 G 的距离是 G 到 O 的两倍',
      '第 4 个点（半透明红点）是九点圆心，它正好是 OH 的中点',
    ]);
    heading(f, '欧拉线：三点共线');
  },
});

/** B35 反演几何。 */
const inversiveGeometry = defineViz({
  slug: 'inversive-geometry',
  title: '反演几何',
  params: {
    radius: { type: 'range', min: 2, max: 6, default: 3, step: 0.5, label: '反演半径 R' },
    distance: { type: 'range', min: 0.5, max: 6, default: 4, step: 0.25, label: '圆到圆心距离 d' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const R = num(params, 'radius', 3);
    const d = num(params, 'distance', 4);
    const srcR = 1.2;
    const v = equalView(f, 0, 0, 8);
    grid(f, v, { divisions: 6, ticks: true });
    circle(f, v.sx(0), v.sy(0), R * unitScale(v), { stroke: C.fg, lw: 1.8 });
    text(f, `反演圆 R = ${R}`, v.sx(0), v.sy(-R) + 18, { align: 'center', color: C.fg, font: '12px sans-serif' });

    // 原圆：圆心 (d, 0)，半径 srcR（不过反演圆心）
    circle(f, v.sx(d), v.sy(0), srcR * unitScale(v), { stroke: C.accent, lw: 2 });
    // 其像：圆心 (d R²/(d²-r²), 0)，半径 rR²/|d²-r²|
    const denom = d * d - srcR * srcR;
    const imgCenter = (d * R * R) / denom;
    const imgR = Math.abs((srcR * R * R) / denom);
    circle(f, v.sx(imgCenter), v.sy(0), imgR * unitScale(v), { stroke: C.warm, lw: 2, dash: [6, 4] });
    dot(f, v.sx(0), v.sy(0), 4, C.dim);

    const inside = denom > 0;
    footnotes(f, [
      `不经过反演圆心的圆（实线，半径 ${srcR}）反演后仍是圆（虚线，半径 ${imgR.toFixed(3)}）`,
      inside ? '原圆在反演圆外时，像落在内部；反之亦然 —— 反演把内与外互换' : '原圆穿过反演圆内部，像变为反演圆外的一个大圆',
      '反演保持角度不变（共形映射），但不保持距离；经过圆心的直线反演后仍是直线',
    ]);
    heading(f, '反演几何：圆映射为圆');
  },
});

/** I22 极坐标图形。 */
const polar = defineViz({
  slug: 'polar',
  title: '极坐标图形',
  params: {
    kind: { type: 'select', options: ['玫瑰线', '心形线', '等角螺线'], default: '玫瑰线', label: '曲线类型' },
    k: { type: 'range', min: 1, max: 8, default: 5, step: 1, label: '参数 k' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'kind', '玫瑰线');
    const k = num(params, 'k', 5);
    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) * 0.3;

    const fn = (theta: number): number => {
      if (kind === '心形线') return 1 + Math.cos(theta);
      if (kind === '等角螺线') return 0.12 * Math.exp(0.22 * theta);
      return Math.cos(k * theta);
    };
    const turns = kind === '等角螺线' ? Math.PI * 8 : Math.PI * 2 * (k % 2 === 0 ? 2 : 1) * 2;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 2400; i++) {
      const theta = (i / 2400) * turns;
      const r = fn(theta);
      pts.push([cx + r * scale * Math.cos(theta), cy + r * scale * Math.sin(theta)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2 });
    circle(f, cx, cy, scale * 0.02, { fill: C.dim });
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      seg(f, cx, cy, cx + Math.cos(ang) * scale * 1.1, cy + Math.sin(ang) * scale * 1.1, 'rgba(58,74,99,0.8)', 0.8);
    }

    const desc = kind === '玫瑰线'
      ? `r = cos(${k}θ)：${k % 2 === 1 ? `${k} 片花瓣（k 为奇数）` : `${k * 2} 片花瓣（k 为偶数）`}`
      : kind === '心形线' ? 'r = 1 + cos θ：心形线（cardioid）' : 'r = e^(0.22θ)：等角螺线，与径向的夹角恒定';
    footnotes(f, [desc, '极坐标用"距离 + 角度"定位，很多曲线在极坐标下方程极简，在直角坐标下却很复杂']);
    heading(f, `极坐标曲线：${kind}`);
  },
});

/** I23 参数方程。 */
const parametric = defineViz({
  slug: 'parametric',
  title: '参数方程',
  params: {
    kind: { type: 'select', options: ['摆线', '星形线', '内摆线'], default: '摆线', label: '曲线' },
    t: { type: 'range', min: 0.5, max: 6.5, default: 6.28, step: 0.01, label: '参数范围' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'kind', '摆线');
    const tMax = num(params, 't', 6.28);
    const isCycloid = kind === '摆线';
    const xSpan = isCycloid ? tMax + 1 : 5;
    const scale = Math.min((w - 100) / xSpan, (h - 170) / 5);
    const cx = isCycloid ? 50 : w / 2;
    const cy = isCycloid ? h - 96 : h / 2 - 10;

    const pt = (t: number): [number, number] => {
      if (kind === '星形线') {
        return [Math.pow(Math.cos(t), 3) * 2, Math.pow(Math.sin(t), 3) * 2];
      }
      if (kind === '内摆线') {
        return [(0.6 * Math.cos(t) + 0.4 * Math.cos(1.5 * t)) * 2, (0.6 * Math.sin(t) - 0.4 * Math.sin(1.5 * t)) * 2];
      }
      // 摆线：半径 1 的圆沿 x 轴滚动
      return [t - Math.sin(t), 1 - Math.cos(t)];
    };
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 900; i++) {
      const t = (i / 900) * tMax;
      const [x, y] = pt(t);
      pts.push([cx + x * scale, cy - y * scale]);
    }
    if (isCycloid) seg(f, 0, cy, w, cy, C.grid, 1.2);
    poly(f, pts, { stroke: C.accent, lw: 2.2 });
    const head = pts[pts.length - 1];
    dot(f, head[0], head[1], 5, C.warm);

    const desc = kind === '摆线'
      ? 'x = t - sin t, y = 1 - cos t（圆滚动时圆周上一点的轨迹）'
      : kind === '星形线' ? 'x = cos³t, y = sin³t（内摆线的一种）' : 'x = Rcos t - rcos(k t), y = Rsin t - rsin(k t)';
    footnotes(f, [
      desc,
      '参数方程用一个"参数 t"同时描述 x 与 y，比 y = f(x) 更通用（可表示闭合曲线与自交点）',
      kind === '摆线' ? '摆线的长度是 8r，一拱面积是 3πr²（都是与 π 无关的有趣结果）' : '参数 t 走过的范围决定画出曲线的哪一段',
    ]);
    heading(f, `参数方程：${kind}`);
  },
});

/** I24 利萨如图形。 */
const lissajous = defineViz({
  slug: 'lissajous',
  title: '利萨如图形',
  params: {
    a: { type: 'range', min: 1, max: 7, default: 3, label: 'x 频率 a' },
    b: { type: 'range', min: 1, max: 7, default: 4, label: 'y 频率 b' },
    phase: { type: 'range', min: 0, max: 180, default: 90, step: 5, label: '相位差 δ(°)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 3);
    const b = num(params, 'b', 4);
    const delta = (num(params, 'phase', 90) * Math.PI) / 180;
    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) * 0.36;

    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 4000; i++) {
      const t = (i / 4000) * Math.PI * 2 * Math.max(a, b);
      pts.push([cx + scale * Math.sin(a * t), cy - scale * Math.sin(b * t + delta)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 1.8 });
    const tt = 0.8;
    const marker: [number, number] = [cx + scale * Math.sin(a * tt), cy - scale * Math.sin(b * tt + delta)];
    dot(f, marker[0], marker[1], 5, C.warm);
    seg(f, cx - scale * 1.1, cy, cx + scale * 1.1, cy, C.grid, 1);
    seg(f, cx, cy - scale * 1.1, cx, cy + scale * 1.1, C.grid, 1);

    const simple = Number.isInteger(a / b) || Number.isInteger(b / a);
    footnotes(f, [
      `x = sin(${a}t)，y = sin(${b}t + ${num(params, 'phase', 90)}°)，频率比 ${a}:${b}`,
      simple ? `频率比为整数比，曲线闭合；在 x 方向有 ${a} 个波峰、y 方向有 ${b} 个` : '频率比为无理数时曲线永不闭合（稠密地填满矩形区域）',
      '示波器上用利萨如图形比较两个信号的频率比与相位差，正是这个原理',
    ]);
    heading(f, '利萨如图形');
  },
});

registerViz(
  trigonometry,
  circleGeometry,
  similarTriangles,
  conicSections,
  ninePointCircle,
  eulerLine,
  inversiveGeometry,
  polar,
  parametric,
  lissajous,
);
