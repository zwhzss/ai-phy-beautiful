import { VizFrame } from './types';

/** 三维向量。 */
export type V3 = [number, number, number];

/** 3D → 2D 投影（先绕 y、再绕 x 旋转），返回屏幕坐标与深度。 */
export function proj3(p: V3, ay: number, ax: number, scale: number, cx: number, cy: number): [number, number, number] {
  const x1 = p[0] * Math.cos(ay) + p[2] * Math.sin(ay);
  const z1 = -p[0] * Math.sin(ay) + p[2] * Math.cos(ay);
  const y1 = p[1] * Math.cos(ax) - z1 * Math.sin(ax);
  const z2 = p[1] * Math.sin(ax) + z1 * Math.cos(ax);
  return [cx + x1 * scale, cy - y1 * scale, z2];
}

/** HSL → RGB（0-255）。 */
export function hslToRgb(hDeg: number, s: number, l: number): [number, number, number] {
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

export interface SurfOpts {
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
  uSteps: number;
  vSteps: number;
  scale: number;
  ay?: number;
  ax?: number;
  /** 每个面片的色相（默认固定蓝紫）。 */
  hue?: (u: number, v: number) => number;
  faceAlpha?: number;
  /** 是否描边（默认 true）。 */
  wire?: boolean;
}

/**
 * 用画家算法渲染参数曲面：采样网格 → 投影 → 按深度排序 → 从远到近填充四边形。
 * 颜色由"法向与光照方向"决定明暗，因此有立体感。
 */
export function renderSurface(
  f: VizFrame,
  fn: (u: number, v: number) => V3,
  o: SurfOpts,
  cx: number,
  cy: number,
): void {
  const ay = o.ay ?? 0.6;
  const ax = o.ax ?? 0.45;
  const uN = o.uSteps;
  const vN = o.vSteps;
  const grid3: V3[][] = [];
  const grid2: Array<Array<[number, number, number]>> = [];
  for (let i = 0; i <= uN; i++) {
    const u = o.uMin + ((o.uMax - o.uMin) * i) / uN;
    const row3: V3[] = [];
    const row2: Array<[number, number, number]> = [];
    for (let j = 0; j <= vN; j++) {
      const v = o.vMin + ((o.vMax - o.vMin) * j) / vN;
      const p = fn(u, v);
      row3.push(p);
      row2.push(proj3(p, ay, ax, o.scale, cx, cy));
    }
    grid3.push(row3);
    grid2.push(row2);
  }
  interface Face {
    pts: Array<[number, number]>;
    depth: number;
    hue: number;
    shade: number;
  }
  const faces: Face[] = [];
  for (let i = 0; i < uN; i++) {
    for (let j = 0; j < vN; j++) {
      const a3 = grid3[i][j];
      const b3 = grid3[i + 1][j];
      const d3 = grid3[i][j + 1];
      const a = grid2[i][j];
      const b = grid2[i + 1][j];
      const c = grid2[i + 1][j + 1];
      const d = grid2[i][j + 1];
      // 面片法向（用于光照）
      const e1: V3 = [b3[0] - a3[0], b3[1] - a3[1], b3[2] - a3[2]];
      const e2: V3 = [d3[0] - a3[0], d3[1] - a3[1], d3[2] - a3[2]];
      const nx = e1[1] * e2[2] - e1[2] * e2[1];
      const ny = e1[2] * e2[0] - e1[0] * e2[2];
      const nz = e1[0] * e2[1] - e1[1] * e2[0];
      const nlen = Math.hypot(nx, ny, nz) || 1;
      const lightY = 0.5 + 0.5 * (ny / nlen);
      faces.push({
        pts: [
          [a[0], a[1]],
          [b[0], b[1]],
          [c[0], c[1]],
          [d[0], d[1]],
        ],
        depth: (a[2] + b[2] + c[2] + d[2]) / 4,
        hue: o.hue ? o.hue(o.uMin + ((o.uMax - o.uMin) * (i + 0.5)) / uN, o.vMin + ((o.vMax - o.vMin) * (j + 0.5)) / vN) : 225,
        shade: 0.35 + lightY * 0.55,
      });
    }
  }
  faces.sort((p, q) => p.depth - q.depth);
  faces.forEach((face) => {
    const [r, g, b] = hslToRgb(face.hue, 0.6, face.shade * 0.6);
    f.ctx.save();
    f.ctx.beginPath();
    face.pts.forEach(([x, y], i) => (i === 0 ? f.ctx.moveTo(x, y) : f.ctx.lineTo(x, y)));
    f.ctx.closePath();
    f.ctx.fillStyle = `rgba(${r},${g},${b},${o.faceAlpha ?? 0.95})`;
    f.ctx.fill();
    if (o.wire !== false) {
      f.ctx.strokeStyle = 'rgba(15,20,30,0.35)';
      f.ctx.lineWidth = 0.4;
      f.ctx.stroke();
    }
    f.ctx.restore();
  });
}

/** 绘制 3D 坐标轴。 */
export function drawAxes3(f: VizFrame, ay: number, ax: number, scale: number, cx: number, cy: number, len = 1.4): void {
  const names = ['x', 'y', 'z'];
  const colors = ['#f56565', '#48bb78', '#4299e1'];
  const o = proj3([0, 0, 0], ay, ax, scale, cx, cy);
  const axes: V3[] = [[len, 0, 0], [0, len, 0], [0, 0, len]];
  axes.forEach((p, i) => {
    const e = proj3(p, ay, ax, scale, cx, cy);
    f.ctx.save();
    f.ctx.strokeStyle = `${colors[i]}99`;
    f.ctx.lineWidth = 1.2;
    f.ctx.beginPath();
    f.ctx.moveTo(o[0], o[1]);
    f.ctx.lineTo(e[0], e[1]);
    f.ctx.stroke();
    f.ctx.fillStyle = colors[i];
    f.ctx.font = '10px sans-serif';
    f.ctx.fillText(names[i], e[0] + 4, e[1] - 3);
    f.ctx.restore();
  });
}
