import { VizFrame } from './types';

/**
 * Canvas 2D 通用绘图工具集。
 *
 * 376 个实验的可视化都建立在这一层之上：坐标视图、网格、函数曲线、多边
 * 形、向量、柱状图、直方图、矩阵色块、确定性随机数。这样单个实验的渲染
 * 代码通常只需 10~30 行，风格与配色全局统一。
 */

/** 全局配色（深色主题，与实验详情页一致）。 */
export const C = {
  bg: '#1a202c',
  panel: '#2d3748',
  grid: '#3a4a63',
  fg: '#e2e8f0',
  dim: '#a0aec0',
  accent: '#667eea',
  accent2: '#764ba2',
  hot: '#f56565',
  warm: '#ed8936',
  yellow: '#ecc94b',
  green: '#48bb78',
  cool: '#4299e1',
  cyan: '#38b2ac',
  pink: '#ed64a6',
};

/** 循环取色用的调色板。 */
export const PALETTE = [
  C.accent, C.hot, C.green, C.warm, C.cool, C.cyan, C.pink, C.yellow, C.accent2,
];

/** 用背景色铺满画布。 */
export function clear(f: VizFrame): void {
  const { ctx, w, h } = f;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, w, h);
}

export interface TextOpts {
  color?: string;
  font?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  maxWidth?: number;
}

/** 绘制文本。字号默认 14px，颜色默认前景色。 */
export function text(
  f: VizFrame,
  s: string,
  x: number,
  y: number,
  o: TextOpts = {},
): void {
  const { ctx } = f;
  ctx.save();
  ctx.fillStyle = o.color ?? C.fg;
  ctx.font = o.font ?? '14px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'alphabetic';
  if (o.maxWidth !== undefined) {
    ctx.fillText(s, x, y, o.maxWidth);
  } else {
    ctx.fillText(s, x, y);
  }
  ctx.restore();
}

/** 左上角小标题（实验名 / 图形说明），带半透明底衬避免与网格重叠。 */
export function heading(f: VizFrame, s: string, color = C.fg): void {
  const { ctx } = f;
  ctx.save();
  ctx.fillStyle = 'rgba(26, 32, 44, 0.82)';
  ctx.fillRect(0, 0, f.w, 30);
  ctx.restore();
  text(f, s, 12, 20, { color, font: 'bold 15px "Segoe UI", system-ui, sans-serif' });
}

/** 左下角多行说明文字（带底衬，保证在图形上仍可读）。 */
export function footnotes(f: VizFrame, rows: string[], color = C.dim): void {
  const { ctx, h, w } = f;
  const lineH = 18;
  const start = h - 10 - (rows.length - 1) * lineH;
  const top = start - 14;
  ctx.save();
  ctx.fillStyle = 'rgba(26, 32, 44, 0.82)';
  ctx.fillRect(0, top, w, h - top);
  ctx.restore();
  rows.forEach((row, i) => text(f, row, 12, start + i * lineH, { color }));
}

/** 右下角标注（带底衬）。 */
export function footnote(f: VizFrame, s: string, color = C.dim): void {
  const { ctx, h, w } = f;
  ctx.save();
  ctx.fillStyle = 'rgba(26, 32, 44, 0.75)';
  ctx.fillRect(Math.max(0, w - 320), h - 30, Math.min(320, w), 30);
  ctx.restore();
  text(f, s, w - 12, h - 12, { color, align: 'right' });
}

/** 数学坐标 -> 屏幕坐标的视图。 */
export interface View {
  sx(x: number): number;
  sy(y: number): number;
  /** 屏幕 -> 数学（反变换）。 */
  ix(px: number): number;
  iy(py: number): number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface ViewOpts {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  /** 绘图区上/左留白（像素），默认 30。 */
  inset?: number;
  /** 右侧额外留白，用于放 y 轴刻度文字。 */
  insetRight?: number;
  /** 底部额外留白，用于放 x 轴刻度与说明文字。 */
  insetBottom?: number;
}

/** 在画布中央创建数学坐标视图。 */
export function view(f: VizFrame, o: ViewOpts): View {
  const inset = o.inset ?? 30;
  const insetRight = o.insetRight ?? inset + 10;
  const insetBottom = o.insetBottom ?? inset + 24;
  const left = inset;
  const right = f.w - insetRight;
  const top = inset;
  const bottom = f.h - insetBottom;
  const sxSpan = o.xMax - o.xMin || 1;
  const sySpan = o.yMax - o.yMin || 1;
  return {
    xMin: o.xMin,
    xMax: o.xMax,
    yMin: o.yMin,
    yMax: o.yMax,
    sx: (x) => left + ((x - o.xMin) / sxSpan) * (right - left),
    sy: (y) => bottom - ((y - o.yMin) / sySpan) * (bottom - top),
    ix: (px) => o.xMin + ((px - left) / (right - left || 1)) * sxSpan,
    iy: (py) => o.yMin + ((bottom - py) / (bottom - top || 1)) * sySpan,
  };
}

/**
 * 等比视图：以 (cx, cy) 为中心，x 方向半宽至少 halfW、y 方向半高至少 minHalfH。
 *
 * 画布通常宽而扁，因此会取"能同时容纳两者"的等比范围 —— 保证图形不会被裁切，
 * 同时 x/y 单位长度完全相等（圆画出来还是圆、角度不变形）。
 */
export function equalView(f: VizFrame, cx: number, cy: number, halfW: number, inset = 40, minHalfH = halfW): View {
  const innerW = Math.max(1, f.w - inset * 2 - 10);
  const innerH = Math.max(1, f.h - inset * 2 - 24);
  const effectiveW = Math.max(halfW, (minHalfH * innerW) / innerH);
  const halfH = (effectiveW * innerH) / innerW;
  return view(f, { xMin: cx - effectiveW, xMax: cx + effectiveW, yMin: cy - halfH, yMax: cy + halfH, inset });
}

/** 数学单位长度对应的屏幕像素数（用于在等比视图里画圆）。 */
export function unitScale(v: View): number {
  return v.sx(1) - v.sx(0);
}

/** 取"好看"的刻度步长（1/2/5 × 10^n）。 */export function niceStep(span: number, target: number): number {
  const raw = span / Math.max(1, target);
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const norm = raw / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

export interface GridOpts {
  /** 每个方向的网格线数量（近似），默认 8。 */
  divisions?: number;
  /** 网格颜色。 */
  gridColor?: string;
  /** 坐标轴颜色。 */
  axisColor?: string;
  /** 是否显示刻度数值。 */
  ticks?: boolean;
}

/** 画网格与坐标轴。 */
export function grid(f: VizFrame, v: View, o: GridOpts = {}): void {
  const { ctx } = f;
  const div = o.divisions ?? 8;
  const gx = niceStep(v.xMax - v.xMin, div);
  const gy = niceStep(v.yMax - v.yMin, div);

  ctx.save();
  ctx.strokeStyle = o.gridColor ?? C.grid;
  ctx.lineWidth = 0.5;
  for (let x = Math.ceil(v.xMin / gx) * gx; x <= v.xMax; x += gx) {
    ctx.beginPath();
    ctx.moveTo(v.sx(x), v.sy(v.yMin));
    ctx.lineTo(v.sx(x), v.sy(v.yMax));
    ctx.stroke();
  }
  for (let y = Math.ceil(v.yMin / gy) * gy; y <= v.yMax; y += gy) {
    ctx.beginPath();
    ctx.moveTo(v.sx(v.xMin), v.sy(y));
    ctx.lineTo(v.sx(v.xMax), v.sy(y));
    ctx.stroke();
  }

  // 坐标轴（数学原点在视图内时才画）
  ctx.strokeStyle = o.axisColor ?? C.dim;
  ctx.lineWidth = 1.2;
  if (v.yMin < 0 && v.yMax > 0) {
    ctx.beginPath();
    ctx.moveTo(v.sx(v.xMin), v.sy(0));
    ctx.lineTo(v.sx(v.xMax), v.sy(0));
    ctx.stroke();
  }
  if (v.xMin < 0 && v.xMax > 0) {
    ctx.beginPath();
    ctx.moveTo(v.sx(0), v.sy(v.yMin));
    ctx.lineTo(v.sx(0), v.sy(v.yMax));
    ctx.stroke();
  }

  if (o.ticks !== false) {
    ctx.fillStyle = C.dim;
    ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const axisY = v.yMin < 0 && v.yMax > 0 ? v.sy(0) : v.sy(v.yMin);
    for (let x = Math.ceil(v.xMin / gx) * gx; x <= v.xMax; x += gx) {
      if (Math.abs(x) < gx / 2) continue;
      ctx.fillText(fmt(x), v.sx(x), Math.min(axisY + 4, f.h - 14));
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const axisX = v.xMin < 0 && v.xMax > 0 ? v.sx(0) : v.sx(v.xMin);
    for (let y = Math.ceil(v.yMin / gy) * gy; y <= v.yMax; y += gy) {
      if (Math.abs(y) < gy / 2) continue;
      ctx.fillText(fmt(y), Math.max(axisX - 4, 26), v.sy(y));
    }
  }
  ctx.restore();
}

/** 数字紧凑格式化（用于刻度）。 */
export function fmt(x: number): string {
  if (Math.abs(x) >= 10000 || (Math.abs(x) < 0.01 && x !== 0)) return x.toExponential(0);
  const r = Math.round(x * 1000) / 1000;
  return String(r);
}

/**
 * 线段（屏幕坐标）。
 *
 * `dash` 给虚线段样式（如 [6, 4]）：AI 图形的 line 图元支持 dash，
 * 但它是位置参数而不是选项对象 —— 调用方传对象会被静默忽略（颜色/线宽掉默认值）。
 */
export function seg(
  f: VizFrame,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = C.accent,
  lw = 2,
  dash?: number[],
): void {
  const { ctx } = f;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  if (dash && dash.length) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

export interface CurveOpts {
  color?: string;
  lw?: number;
  /** 采样点数，默认 400。 */
  samples?: number;
  /** 虚线样式。 */
  dash?: number[];
}

/** 在数学坐标视图里绘制 y = fn(x) 曲线；不连续处自动断线。 */
export function curve(
  f: VizFrame,
  v: View,
  fn: (x: number) => number,
  o: CurveOpts = {},
): void {
  const { ctx } = f;
  const samples = o.samples ?? 400;
  ctx.save();
  ctx.strokeStyle = o.color ?? C.accent;
  ctx.lineWidth = o.lw ?? 2;
  ctx.setLineDash(o.dash ?? []);
  ctx.beginPath();
  let started = false;
  let lastY = 0;
  for (let i = 0; i <= samples; i++) {
    const x = v.xMin + ((v.xMax - v.xMin) * i) / samples;
    const y = fn(x);
    if (!Number.isFinite(y)) {
      started = false;
      continue;
    }
    // 数值跳变（渐近线）时断开
    const py = v.sy(y);
    if (started && Math.abs(y - lastY) > (v.yMax - v.yMin)) {
      started = false;
    }
    if (!started) {
      ctx.moveTo(v.sx(x), py);
      started = true;
    } else {
      ctx.lineTo(v.sx(x), py);
    }
    lastY = y;
  }
  ctx.stroke();
  ctx.restore();
}

export interface PolyOpts {
  fill?: string;
  stroke?: string;
  lw?: number;
  close?: boolean;
  dash?: number[];
}

/** 绘制折线 / 多边形。点可为数学坐标，也可给出已变换的屏幕坐标。 */
export function poly(
  f: VizFrame,
  pts: Array<[number, number]>,
  o: PolyOpts = {},
): void {
  if (pts.length < 2) return;
  const { ctx } = f;
  ctx.save();
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  if (o.close) ctx.closePath();
  if (o.dash) ctx.setLineDash(o.dash);
  if (o.fill) {
    ctx.fillStyle = o.fill;
    ctx.fill();
  }
  if (o.stroke) {
    ctx.strokeStyle = o.stroke;
    ctx.lineWidth = o.lw ?? 2;
    ctx.stroke();
  }
  ctx.restore();
}

/** 数学坐标下的多边形。 */
export function polyView(
  f: VizFrame,
  v: View,
  pts: Array<[number, number]>,
  o: PolyOpts = {},
): void {
  poly(f, pts.map(([x, y]) => [v.sx(x), v.sy(y)] as [number, number]), o);
}

/** 圆（屏幕坐标）。 */
export function circle(
  f: VizFrame,
  cx: number,
  cy: number,
  r: number,
  o: PolyOpts = {},
): void {
  const { ctx } = f;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0.1, r), 0, Math.PI * 2);
  if (o.dash) ctx.setLineDash(o.dash);
  if (o.fill) {
    ctx.fillStyle = o.fill;
    ctx.fill();
  }
  if (o.stroke) {
    ctx.strokeStyle = o.stroke;
    ctx.lineWidth = o.lw ?? 2;
    ctx.stroke();
  }
  ctx.restore();
}

/** 实心点（屏幕坐标）。 */
export function dot(f: VizFrame, x: number, y: number, r = 3, color = C.fg): void {
  circle(f, x, y, r, { fill: color });
}

/** 带箭头的向量（屏幕坐标）。 */
export function vec(
  f: VizFrame,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = C.accent,
  lw = 2,
  headSize = 8,
): void {
  const { ctx } = f;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 0.5) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const hx = Math.min(headSize, len * 0.4);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - hx * Math.cos(angle - 0.4), y2 - hx * Math.sin(angle - 0.4));
  ctx.lineTo(x2 - hx * Math.cos(angle + 0.4), y2 - hx * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export interface BarsOpts {
  /** 柱区域（屏幕坐标），默认占满画布并留白。 */
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  colors?: string[];
  /** 是否画基线。 */
  baseline?: boolean;
  /** 是否归一化到最大值。 */
  normalize?: boolean;
}

/** 柱状图（数值数组，屏幕坐标区域）。 */
export function bars(f: VizFrame, values: number[], o: BarsOpts = {}): void {
  const x0 = o.x ?? 30;
  const y0 = o.y ?? 30;
  const bw = o.w ?? f.w - 60;
  const bh = o.h ?? f.h - 70;
  if (values.length === 0) return;
  const max = o.normalize === false
    ? Math.max(...values, 1)
    : Math.max(...values.map((v) => Math.abs(v)), 1);
  const slot = bw / values.length;
  const colors = o.colors ?? PALETTE;
  values.forEach((v, i) => {
    const height = Math.max(1, (Math.abs(v) / max) * bh);
    const cx = x0 + i * slot;
    const barW = Math.max(1, slot - Math.min(6, slot * 0.2));
    const { ctx } = f;
    ctx.save();
    ctx.fillStyle = colors[i % colors.length];
    const top = topOfBar(v, y0, bh, height);
    ctx.fillRect(cx + (slot - barW) / 2, top, barW, height);
    ctx.restore();
  });
  if (o.baseline !== false) {
    seg(f, x0, y0 + bh, x0 + bw, y0 + bh, C.dim, 1);
  }
}

/** 柱的顶部 y 坐标（负数向下生长）。 */
function topOfBar(v: number, y0: number, bh: number, height: number): number {
  if (v >= 0) return y0 + bh - height;
  return y0 + bh;
}

/** 直方图：把样本分箱后画柱。 */
export function hist(
  f: VizFrame,
  values: number[],
  bins = 12,
  o: BarsOpts = {},
): void {
  if (values.length === 0) return;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const counts = new Array<number>(bins).fill(0);
  for (const v of values) {
    const idx = Math.min(bins - 1, Math.floor(((v - min) / span) * bins));
    counts[idx]++;
  }
  bars(f, counts, { normalize: false, ...o });
}

/** 二维矩阵色块图（用于矩阵、卷积核、图像类实验）。 */
export function matrixView(
  f: VizFrame,
  m: number[][],
  o: { x?: number; y?: number; size?: number; gap?: number; hue?: number; showValues?: boolean } = {},
): void {
  const rows = m.length;
  const cols = rows > 0 ? m[0].length : 0;
  if (!rows || !cols) return;
  const size = o.size ?? Math.min((f.w - 60) / cols, (f.h - 80) / rows, 46);
  const gap = o.gap ?? 2;
  const totalW = cols * size + (cols - 1) * gap;
  const totalH = rows * size + (rows - 1) * gap;
  const ox = o.x ?? (f.w - totalW) / 2;
  const oy = o.y ?? (f.h - totalH) / 2;
  const maxAbs = Math.max(...m.flat().map((v) => Math.abs(v)), 1);
  const hue = o.hue ?? 230;
  const { ctx } = f;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = m[r][c];
      const k = Math.abs(v) / maxAbs;
      ctx.save();
      ctx.fillStyle = v === 0 ? C.panel : `hsl(${hue}, 65%, ${28 + k * 40}%)`;
      ctx.fillRect(ox + c * (size + gap), oy + r * (size + gap), size, size);
      ctx.restore();
      if (o.showValues !== false && size >= 26) {
        text(f, fmt(v), ox + c * (size + gap) + size / 2, oy + r * (size + gap) + size / 2 + 5, {
          color: C.fg,
          align: 'center',
          font: '12px "Segoe UI", system-ui, sans-serif',
        });
      }
    }
  }
}

/** 确定性伪随机数生成器（mulberry32），保证同一 seed 每次绘制结果一致。 */
export function rng(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 生成 n 个标准正态随机数（Box-Muller）。 */
export function gaussians(rand: () => number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i += 2) {
    const u = Math.max(1e-9, rand());
    const v = rand();
    const r = Math.sqrt(-2 * Math.log(u));
    out.push(r * Math.cos(2 * Math.PI * v));
    if (out.length < n) out.push(r * Math.sin(2 * Math.PI * v));
  }
  return out.slice(0, n);
}

/** 顺序生成数列（用于把递推式画成小方块/柱）。 */
export function sequence(n: number, fn: (i: number, prev: number[]) => number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(fn(i, out));
  return out;
}

/** 绘制带编号的小方格网格（数字类实验常用）。 */
export function cells(
  f: VizFrame,
  values: Array<string | number>,
  o: { cols?: number; cell?: number; x?: number; y?: number; colorFor?: (v: string | number, i: number) => string | null; textColor?: string } = {},
): void {
  const cols = o.cols ?? Math.max(1, Math.floor((f.w - 40) / 34));
  const cell = o.cell ?? 30;
  const gap = 4;
  const totalW = cols * cell + (cols - 1) * gap;
  const ox = o.x ?? (f.w - totalW) / 2;
  const oy = o.y ?? 36;
  values.forEach((v, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = ox + c * (cell + gap);
    const y = oy + r * (cell + gap);
    if (y + cell > f.h - 20) return;
    const fill = o.colorFor ? o.colorFor(v, i) : null;
    const { ctx } = f;
    ctx.save();
    ctx.fillStyle = fill ?? C.panel;
    ctx.fillRect(x, y, cell, cell);
    ctx.restore();
    text(f, String(v), x + cell / 2, y + cell / 2 + 4, {
      color: o.textColor ?? C.fg,
      align: 'center',
      font: `12px "Segoe UI", system-ui, sans-serif`,
    });
  });
}

/** 绘制平面直角坐标系中的点集（数学坐标）。 */
export function scatter(
  f: VizFrame,
  v: View,
  pts: Array<[number, number]>,
  o: { r?: number; color?: string } = {},
): void {
  const color = o.color ?? C.accent;
  for (const [x, y] of pts) dot(f, v.sx(x), v.sy(y), o.r ?? 3, color);
}
