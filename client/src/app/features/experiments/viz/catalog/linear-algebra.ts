import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import {
  C,
  PALETTE,
  dot,
  equalView,
  footnotes,
  grid,
  heading,
  poly,
  rng,
  seg,
  text,
  vec,
  view,
} from '../canvas';

type V2 = [number, number];
type M2 = [[number, number], [number, number]];

const apply2 = (m: M2, v: V2): V2 => [m[0][0] * v[0] + m[0][1] * v[1], m[1][0] * v[0] + m[1][1] * v[1]];
const det2 = (m: M2): number => m[0][0] * m[1][1] - m[0][1] * m[1][0];
const trace2 = (m: M2): number => m[0][0] + m[1][1];

/** 2×2 实矩阵的特征值（可能为复数）。 */
function eigen2(m: M2): { real: boolean; l1: number; l2: number; im: number; v1: V2 | null } {
  const tr = trace2(m);
  const dt = det2(m);
  const disc = tr * tr - 4 * dt;
  if (disc < 0) {
    return { real: false, l1: tr / 2, l2: tr / 2, im: Math.sqrt(-disc) / 2, v1: null };
  }
  const l1 = (tr + Math.sqrt(disc)) / 2;
  const l2 = (tr - Math.sqrt(disc)) / 2;
  const pick = (l: number): V2 | null => {
    const a = m[0][0] - l;
    const b = m[0][1];
    const c = m[1][0];
    const d = m[1][1] - l;
    const v: V2 = Math.abs(b) > Math.abs(c) ? [-b, a] : [d, -c];
    const len = Math.hypot(v[0], v[1]);
    return len < 1e-9 ? null : [v[0] / len, v[1] / len];
  };
  return { real: true, l1, l2, im: 0, v1: pick(l1) };
}

/** M34 矩阵变换。 */
const matrixTransform = defineViz({
  slug: 'matrix-transform',
  title: '矩阵变换',
  params: {
    a: { type: 'range', min: -2, max: 2, default: 1, step: 0.1, label: 'a (1,1)' },
    b: { type: 'range', min: -2, max: 2, default: 0.6, step: 0.1, label: 'b (1,2)' },
    c: { type: 'range', min: -2, max: 2, default: 0.4, step: 0.1, label: 'c (2,1)' },
    d: { type: 'range', min: -2, max: 2, default: 1.4, step: 0.1, label: 'd (2,2)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const m: M2 = [
      [num(params, 'a', 1), num(params, 'b', 0.6)],
      [num(params, 'c', 0.4), num(params, 'd', 1.4)],
    ];
    const v = equalView(f, 0, 0, 2.4);
    grid(f, v, { divisions: 4, ticks: true });

    // 原网格
    const GRID = 4;
    for (let i = -GRID; i <= GRID; i++) {
      const line: V2[] = [];
      for (let j = -GRID; j <= GRID; j++) line.push([i, j]);
      poly(f, line.map(([x, y]) => [v.sx(x), v.sy(y)] as V2), { stroke: 'rgba(58,74,99,0.5)', lw: 0.8 });
      const line2: V2[] = [];
      for (let k = -GRID; k <= GRID; k++) line2.push([k, i]);
      poly(f, line2.map(([x, y]) => [v.sx(x), v.sy(y)] as V2), { stroke: 'rgba(58,74,99,0.5)', lw: 0.8 });
    }
    // 变换后的基向量
    const e1 = apply2(m, [1, 0]);
    const e2 = apply2(m, [0, 1]);
    vec(f, v.sx(0), v.sy(0), v.sx(e1[0]), v.sy(e1[1]), C.warm, 2.4);
    vec(f, v.sx(0), v.sy(0), v.sx(e2[0]), v.sy(e2[1]), C.green, 2.4);
    // 变换后的单位正方形
    poly(f, [[0, 0], e1, [e1[0] + e2[0], e1[1] + e2[1]], e2].map(([x, y]) => [v.sx(x), v.sy(y)] as V2), {
      fill: 'rgba(102,126,234,0.25)',
      stroke: C.accent,
      lw: 2,
      close: true,
    });

    footnotes(f, [
      `矩阵 [[${m[0][0]}, ${m[0][1]}], [${m[1][0]}, ${m[1][1]}]] 把单位正方形变成面积 ${Math.abs(det2(m)).toFixed(3)} 的平行四边形`,
      `行列式 det = ${det2(m).toFixed(3)}（= 面积缩放倍数；为 0 表示降维、不可逆）`,
      '矩阵的列向量就是基向量 e₁、e₂ 的去向 —— 这就是矩阵的几何意义',
    ]);
    heading(f, '矩阵变换：基向量与面积');
  },
});

/** M35 线性代数入门。 */
const linearAlgebra = defineViz({
  slug: 'linear-algebra',
  title: '线性代数入门',
  params: {
    alpha: { type: 'range', min: -3, max: 3, default: 1.5, step: 0.1, label: '系数 α' },
    beta: { type: 'range', min: -3, max: 3, default: 1, step: 0.1, label: '系数 β' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'alpha', 1.5);
    const b = num(params, 'beta', 1);
    const u: V2 = [2, 0.6];
    const wv: V2 = [-0.4, 1.6];
    const comb: V2 = [a * u[0] + b * wv[0], a * u[1] + b * wv[1]];
    const v = equalView(f, 0, 0, 4.2);
    grid(f, v, { divisions: 5, ticks: true });

    // 张成空间
    for (let s = -3; s <= 3; s += 0.4) {
      for (let t = -3; t <= 3; t += 0.4) {
        const p: V2 = [s * u[0] + t * wv[0], s * u[1] + t * wv[1]];
        if (Math.hypot(p[0], p[1]) > 4) continue;
        dot(f, v.sx(p[0]), v.sy(p[1]), 1.2, 'rgba(102,126,234,0.4)');
      }
    }
    vec(f, v.sx(0), v.sy(0), v.sx(u[0]), v.sy(u[1]), C.green, 2.6);
    vec(f, v.sx(0), v.sy(0), v.sx(wv[0]), v.sy(wv[1]), C.cool, 2.6);
    vec(f, v.sx(0), v.sy(0), v.sx(comb[0]), v.sy(comb[1]), C.hot, 3);
    text(f, `αu = ${a.toFixed(1)}·u`, v.sx(a * u[0]) + 6, v.sy(a * u[1]) - 6, { color: C.green, font: '12px sans-serif' });
    text(f, `αu + βv`, v.sx(comb[0]) + 6, v.sy(comb[1]) - 8, { color: C.hot, font: '12px sans-serif' });

    // 平行四边形法则
    seg(f, v.sx(a * u[0]), v.sy(a * u[1]), v.sx(comb[0]), v.sy(comb[1]), 'rgba(245,101,101,0.4)', 1.4, );
    seg(f, v.sx(b * wv[0]), v.sy(b * wv[1]), v.sx(comb[0]), v.sy(comb[1]), 'rgba(245,101,101,0.4)', 1.4);

    const cross = u[0] * wv[1] - u[1] * wv[0];
    footnotes(f, [
      `αu + βv = ${a.toFixed(1)}·(${u[0]}, ${u[1]}) + ${b.toFixed(1)}·(${wv[0]}, ${wv[1]}) = (${comb[0].toFixed(2)}, ${comb[1].toFixed(2)})`,
      `u × v = ${cross.toFixed(3)} ≠ 0：两向量线性无关，张成整个二维平面`,
      '线性组合 = 缩放后相加；张成空间 = 所有可能的线性组合构成的集合',
    ]);
    heading(f, '线性组合与张成空间');
  },
});

/** M36 特征值可视化。 */
const eigenVisualization = defineViz({
  slug: 'eigen-visualization',
  title: '特征值可视化',
  params: {
    a: { type: 'range', min: -2, max: 3, default: 2, step: 0.1, label: 'a (1,1)' },
    b: { type: 'range', min: -2, max: 2, default: 1, step: 0.1, label: 'b (1,2)' },
    c: { type: 'range', min: -2, max: 2, default: 1, step: 0.1, label: 'c (2,1)' },
    d: { type: 'range', min: -2, max: 3, default: 2, step: 0.1, label: 'd (2,2)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const m: M2 = [
      [num(params, 'a', 2), num(params, 'b', 1)],
      [num(params, 'c', 1), num(params, 'd', 2)],
    ];
    const eig = eigen2(m);
    const v = equalView(f, 0, 0, 4);
    grid(f, v, { divisions: 4, ticks: true });

    // 一批向量的像（观察哪些方向"不转向"）
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2;
      const p: V2 = [Math.cos(ang) * 1.2, Math.sin(ang) * 1.2];
      const q = apply2(m, p);
      if (Math.hypot(q[0], q[1]) > 3.8) continue;
      seg(f, v.sx(0), v.sy(0), v.sx(p[0]), v.sy(p[1]), 'rgba(160,174,192,0.35)', 1);
      seg(f, v.sx(0), v.sy(0), v.sx(q[0]), v.sy(q[1]), 'rgba(102,126,234,0.5)', 1.2);
    }
    if (eig.real && eig.v1) {
      const v1 = eig.v1;
      seg(f, v.sx(-v1[0] * 3.6), v.sy(-v1[1] * 3.6), v.sx(v1[0] * 3.6), v.sy(v1[1] * 3.6), C.hot, 2.4);
      const v1b = apply2(m, v1);
      vec(f, v.sx(0), v.sy(0), v.sx(v1b[0]), v.sy(v1b[1]), C.warm, 2.6);
    }

    footnotes(f, [
      `矩阵 [[${m[0][0]}, ${m[0][1]}], [${m[1][0]}, ${m[1][1]}]]`,
      eig.real
        ? `特征值 λ₁ = ${eig.l1.toFixed(3)}，λ₂ = ${eig.l2.toFixed(3)}（红色直线为特征方向，向量变换后仍在同一直线上）`
        : `复特征值 ${eig.l1.toFixed(2)} ± ${eig.im.toFixed(2)}i：没有实特征方向，变换包含旋转`,
      '特征向量：矩阵作用下方向不变的向量；特征值即该方向上的伸缩倍数',
    ]);
    heading(f, '特征值可视化：方向不变的方向');
  },
});

/** M37 格拉姆-施密特。 */
const gramSchmidt = defineViz({
  slug: 'gram-schmidt',
  title: '格拉姆-施密特',
  params: {
    a1: { type: 'range', min: -3, max: 3, default: 2.4, step: 0.1, label: 'v₁ x' },
    a2: { type: 'range', min: -3, max: 3, default: 0.6, step: 0.1, label: 'v₁ y' },
    b1: { type: 'range', min: -3, max: 3, default: 1.4, step: 0.1, label: 'v₂ x' },
    b2: { type: 'range', min: -3, max: 3, default: 2.2, step: 0.1, label: 'v₂ y' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const v1: V2 = [num(params, 'a1', 2.4), num(params, 'a2', 0.6)];
    const v2: V2 = [num(params, 'b1', 1.4), num(params, 'b2', 2.2)];
    const len1 = Math.hypot(v1[0], v1[1]) || 1;
    const u1: V2 = [v1[0] / len1, v1[1] / len1];
    const proj = v2[0] * u1[0] + v2[1] * u1[1];
    const e2: V2 = [v2[0] - proj * u1[0], v2[1] - proj * u1[1]];
    const len2 = Math.hypot(e2[0], e2[1]) || 1;
    const u2: V2 = [e2[0] / len2, e2[1] / len2];
    const v = equalView(f, 0, 0, 3.6);
    grid(f, v, { divisions: 4, ticks: true });

    vec(f, v.sx(0), v.sy(0), v.sx(v1[0]), v.sy(v1[1]), C.green, 2.2);
    vec(f, v.sx(0), v.sy(0), v.sx(v2[0]), v.sy(v2[1]), C.cool, 2.2);
    seg(f, v.sx(proj * u1[0]), v.sy(proj * u1[1]), v.sx(v2[0]), v.sy(v2[1]), C.warm, 1.8);
    vec(f, v.sx(0), v.sy(0), v.sx(u2[0] * 1.6), v.sy(u2[1] * 1.6), C.hot, 2.6);
    seg(f, v.sx(0), v.sy(0), v.sx(u1[0] * 3), v.sy(u1[1] * 3), `${C.green}66`, 1.4);

    const angle = Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1])));
    footnotes(f, [
      `v₂ 在 u₁ 上的投影长 = ${proj.toFixed(4)}，减掉投影得到与 u₁ 垂直的分量（橙色）`,
      `归一化后 u₁、u₂ 正交：内积 = ${(u1[0] * u2[0] + u1[1] * u2[1]).toExponential(2)}，夹角 ${((angle * 180) / Math.PI).toFixed(2)}°`,
      '格拉姆-施密特把任意线性无关组变成正交单位组，是 QR 分解与最小二乘的基础',
    ]);
    heading(f, '格拉姆-施密特：构造正交基');
  },
});

/** M38 LU 分解。 */
const luDecomposition = defineViz({
  slug: 'lu-decomposition',
  title: 'LU分解',
  params: {
    a: { type: 'range', min: 1, max: 4, default: 2, label: 'a₁₁' },
    b: { type: 'range', min: -3, max: 3, default: 1, label: 'a₁₂' },
    c: { type: 'range', min: -3, max: 3, default: 3, label: 'a₂₁' },
    d: { type: 'range', min: 1, max: 4, default: 4, label: 'a₂₂' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a11 = num(params, 'a', 2);
    const a12 = num(params, 'b', 1);
    const a21 = num(params, 'c', 3);
    const a22 = num(params, 'd', 4);
    const l21 = a21 / a11;
    const u11 = a11;
    const u12 = a12;
    const u22 = a22 - l21 * u12;

    const cell = 34;
    const drawMat = (ox: number, oy: number, values: Array<[number, number, number]>, label: string, color: string): void => {
      values.forEach(([row, col, val]) => {
        f.ctx.save();
        f.ctx.fillStyle = val === 0 ? C.panel : `${color}44`;
        f.ctx.fillRect(ox + col * (cell + 3), oy + row * (cell + 3), cell, cell);
        f.ctx.restore();
        text(f, val.toFixed(2).replace(/\.00$/, ''), ox + col * (cell + 3) + cell / 2, oy + row * (cell + 3) + cell * 0.66, {
          align: 'center',
          color: C.fg,
          font: '12px Consolas, monospace',
        });
      });
      text(f, label, ox, oy - 10, { color, font: 'bold 13px "Segoe UI", system-ui, sans-serif' });
    };

    const oy = h / 2 - cell;
    drawMat(60, oy, [[0, 0, a11], [0, 1, a12], [1, 0, a21], [1, 1, a22]], 'A', C.accent);
    text(f, '=', 60 + 2 * (cell + 3) + 8, oy + cell, { color: C.fg, font: '18px sans-serif' });
    const lx = 60 + 2 * (cell + 3) + 40;
    drawMat(lx, oy, [[0, 0, 1], [0, 1, 0], [1, 0, l21], [1, 1, 1]], 'L', C.green);
    text(f, '×', lx + 2 * (cell + 3) + 8, oy + cell, { color: C.fg, font: '16px sans-serif' });
    const ux = lx + 2 * (cell + 3) + 36;
    drawMat(ux, oy, [[0, 0, u11], [0, 1, u12], [1, 0, 0], [1, 1, u22]], 'U', C.warm);

    footnotes(f, [
      `A = LU：L 是单位下三角（对角线为 1），U 是上三角`,
      `依次消元：L 记录消元乘数 l₂₁ = a₂₁/a₁₁ = ${l21.toFixed(3)}，U 是消元结果`,
      'LU 分解把求解 Ax = b 变成两步三角回代，多次求解不同右端项时非常高效（比每次求逆快得多）',
    ]);
    heading(f, 'LU 分解：高斯消元的矩阵形式');
  },
});

/** M39 QR 分解。 */
const qrDecomposition = defineViz({
  slug: 'qr-decomposition',
  title: 'QR分解',
  params: {
    a1: { type: 'range', min: -3, max: 3, default: 2.2, step: 0.1, label: '列 1 x' },
    a2: { type: 'range', min: -3, max: 3, default: 1.2, step: 0.1, label: '列 1 y' },
    b1: { type: 'range', min: -3, max: 3, default: 0.8, step: 0.1, label: '列 2 x' },
    b2: { type: 'range', min: -3, max: 3, default: 2.4, step: 0.1, label: '列 2 y' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const c1: V2 = [num(params, 'a1', 2.2), num(params, 'a2', 1.2)];
    const c2: V2 = [num(params, 'b1', 0.8), num(params, 'b2', 2.4)];
    const r11 = Math.hypot(c1[0], c1[1]);
    const q1: V2 = [c1[0] / r11, c1[1] / r11];
    const r12 = c2[0] * q1[0] + c2[1] * q1[1];
    const e2: V2 = [c2[0] - r12 * q1[0], c2[1] - r12 * q1[1]];
    const r22 = Math.hypot(e2[0], e2[1]);
    const q2: V2 = [e2[0] / r22, e2[1] / r22];

    const v = equalView(f, 0, 0, 3.4);
    grid(f, v, { divisions: 4, ticks: true });
    vec(f, v.sx(0), v.sy(0), v.sx(c1[0]), v.sy(c1[1]), C.green, 2.2);
    vec(f, v.sx(0), v.sy(0), v.sx(c2[0]), v.sy(c2[1]), C.cool, 2.2);
    vec(f, v.sx(0), v.sy(0), v.sx(q1[0] * 2), v.sy(q1[1] * 2), `${C.warm}cc`, 2, 7);
    vec(f, v.sx(0), v.sy(0), v.sx(q2[0] * 2), v.sy(q2[1] * 2), `${C.hot}cc`, 2, 7);
    // 直角标记
    seg(f, v.sx(q1[0]), v.sy(q1[1]), v.sx(q1[0] + q2[0]), v.sy(q1[1] + q2[1]), 'rgba(160,174,192,0.5)', 1.2);
    seg(f, v.sx(q2[0]), v.sy(q2[1]), v.sx(q1[0] + q2[0]), v.sy(q1[1] + q2[1]), 'rgba(160,174,192,0.5)', 1.2);

    footnotes(f, [
      `A = QR：Q 的列是正交单位向量 q₁、q₂（橙色/红色），R 是上三角 [[${r11.toFixed(2)}, ${r12.toFixed(2)}], [0, ${r22.toFixed(2)}]]`,
      `q₁·q₂ = ${(q1[0] * q2[0] + q1[1] * q2[1]).toExponential(2)} —— 正交性由格拉姆-施密特保证`,
      'QR 分解用于求解最小二乘、计算特征值（QR 算法），数值稳定性优于 LU',
    ]);
    heading(f, 'QR 分解：正交化列向量');
  },
});

/** M40 Cholesky 分解。 */
const cholesky = defineViz({
  slug: 'cholesky',
  title: 'chollesky分解',
  params: {
    a: { type: 'range', min: 1, max: 5, default: 4, step: 0.5, label: 'a₁₁' },
    b: { type: 'range', min: -2, max: 2, default: 2, step: 0.5, label: 'a₁₂' },
    d: { type: 'range', min: 1, max: 5, default: 3, step: 0.5, label: 'a₂₂' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a11 = num(params, 'a', 4);
    const a12 = num(params, 'b', 2);
    const a22 = num(params, 'd', 3);
    const det = a11 * a22 - a12 * a12;
    const positive = det > 0 && a11 > 0;
    const l11 = Math.sqrt(Math.max(a11, 0));
    const l21 = positive ? a12 / l11 : 0;
    const l22 = positive ? Math.sqrt(Math.max(a22 - l21 * l21, 0)) : 0;

    const cell = 36;
    const oy = h / 2 - cell;
    const drawMat = (ox: number, vals: Array<[number, number, number]>, label: string, color: string): void => {
      vals.forEach(([row, col, val]) => {
        f.ctx.save();
        f.ctx.fillStyle = Math.abs(val) < 1e-9 ? C.panel : `${color}44`;
        f.ctx.fillRect(ox + col * (cell + 3), oy + row * (cell + 3), cell, cell);
        f.ctx.restore();
        text(f, val.toFixed(2), ox + col * (cell + 3) + cell / 2, oy + row * (cell + 3) + cell * 0.66, {
          align: 'center', color: C.fg, font: '12px Consolas, monospace',
        });
      });
      text(f, label, ox, oy - 10, { color, font: 'bold 13px "Segoe UI", system-ui, sans-serif' });
    };
    drawMat(70, [[0, 0, a11], [0, 1, a12], [1, 0, a12], [1, 1, a22]], 'A（对称）', C.accent);
    text(f, '=', 70 + 2 * (cell + 3) + 8, oy + cell, { color: C.fg, font: '18px sans-serif' });
    const lx = 70 + 2 * (cell + 3) + 40;
    drawMat(lx, [[0, 0, l11], [0, 1, 0], [1, 0, l21], [1, 1, l22]], 'L', C.green);
    text(f, '× Lᵀ', lx + 2 * (cell + 3) + 8, oy + cell, { color: C.green, font: '15px sans-serif' });

    footnotes(f, [
      positive
        ? `A 对称正定（a₁₁ > 0，det = ${det.toFixed(2)} > 0），可做 Cholesky 分解 A = LLᵀ`
        : `当前矩阵非正定（det = ${det.toFixed(2)}），Cholesky 分解不存在`,
      `L 的对角元 l₁₁ = √a₁₁ = ${l11.toFixed(3)}，l₂₂ = √(a₂₂ - l₂₁²) = ${l22.toFixed(3)}`,
      'Cholesky 比 LU 快一倍且只需存储下三角，是求解正定系统（如最小二乘正规方程）的首选',
    ]);
    heading(f, 'Cholesky 分解：对称正定矩阵');
  },
});

/** M41 幂迭代法。 */
const powerIteration = defineViz({
  slug: 'power-iteration',
  title: '幂迭代法',
  params: {
    a: { type: 'range', min: 1, max: 4, default: 3, step: 0.25, label: 'a₁₁' },
    b: { type: 'range', min: 0, max: 2, default: 1, step: 0.25, label: 'a₁₂' },
    d: { type: 'range', min: 0.5, max: 3, default: 1, step: 0.25, label: 'a₂₂' },
    steps: { type: 'range', min: 1, max: 12, default: 6, label: '迭代次数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const m: M2 = [
      [num(params, 'a', 3), num(params, 'b', 1)],
      [num(params, 'b', 1), num(params, 'd', 1)],
    ];
    const steps = Math.round(num(params, 'steps', 6));
    let vec0: V2 = [1, 0.3];
    const trail: V2[] = [[vec0[0], vec0[1]]];
    const ratios: number[] = [];
    for (let i = 0; i < steps; i++) {
      const next = apply2(m, vec0);
      const len = Math.hypot(next[0], next[1]);
      ratios.push(len / (Math.hypot(vec0[0], vec0[1]) || 1));
      vec0 = [next[0] / len, next[1] / len];
      trail.push([vec0[0], vec0[1]]);
    }
    const eig = eigen2(m);
    const v = equalView(f, 0, 0, 1.4);
    grid(f, v, { divisions: 4, ticks: true });
    for (let i = 0; i + 1 < trail.length; i++) {
      const p = trail[i];
      const q = trail[i + 1];
      seg(f, v.sx(p[0]), v.sy(p[1]), v.sx(q[0]), v.sy(q[1]), `${PALETTE[i % PALETTE.length]}aa`, 1.6);
      dot(f, v.sx(q[0]), v.sy(q[1]), 3, PALETTE[i % PALETTE.length]);
    }
    if (eig.real && eig.v1) {
      seg(f, v.sx(-eig.v1[0] * 1.3), v.sy(-eig.v1[1] * 1.3), v.sx(eig.v1[0] * 1.3), v.sy(eig.v1[1] * 1.3), C.hot, 1.8, );
    }

    footnotes(f, [
      `反复用矩阵乘单位向量并归一化：第 ${steps} 次得到方向 (${vec0[0].toFixed(4)}, ${vec0[1].toFixed(4)})`,
      `该方向收敛到主特征向量（红线的方向），特征值 λ₁ = ${eig.real ? eig.l1.toFixed(4) : '—'}`,
      '收敛速度取决于 |λ₂/λ₁|：比值越小收敛越快。这算法也是 PageRank 的求解方法',
    ]);
    heading(f, '幂迭代法：求主特征向量');
  },
});

/** M42 伪逆。 */
const pseudoinverse = defineViz({
  slug: 'pseudoinverse',
  title: '伪逆',
  params: {
    slope: { type: 'range', min: -2, max: 2, default: 1.2, step: 0.1, label: '直线斜率' },
    noise: { type: 'range', min: 0, max: 2, default: 0.8, step: 0.1, label: '噪声强度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const slope = num(params, 'slope', 1.2);
    const noise = num(params, 'noise', 0.8);
    const rand = rng(1234);
    const points: V2[] = [];
    for (let i = 0; i < 12; i++) {
      const x = -3 + (6 * i) / 11;
      points.push([x, slope * x + 0.4 + (rand() - 0.5) * noise * 2.4]);
    }
    // 最小二乘：拟合 y = kx + b
    const n = points.length;
    const sumX = points.reduce((a, p) => a + p[0], 0);
    const sumY = points.reduce((a, p) => a + p[1], 0);
    const sumXY = points.reduce((a, p) => a + p[0] * p[1], 0);
    const sumXX = points.reduce((a, p) => a + p[0] * p[0], 0);
    const k = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const b = (sumY - k * sumX) / n;

    const v = view(f, { xMin: -4, xMax: 4, yMin: -5, yMax: 5, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    points.forEach((p) => {
      dot(f, v.sx(p[0]), v.sy(p[1]), 4, C.dim);
      seg(f, v.sx(p[0]), v.sy(p[1]), v.sx(p[0]), v.sy(k * p[0] + b), 'rgba(245,101,101,0.35)', 1.2);
    });
    poly(f, [[v.sx(-4), v.sy(-4 * k + b)], [v.sx(4), v.sy(4 * k + b)]], { stroke: C.green, lw: 2.4 });

    const residual = Math.sqrt(points.reduce((a, p) => a + (p[1] - (k * p[0] + b)) ** 2, 0) / n);
    footnotes(f, [
      `最小二乘拟合：y = ${k.toFixed(4)}x + ${b.toFixed(4)}（绿色直线）`,
      `残差 RMS = ${residual.toFixed(4)}；红色竖线是每个点到直线的偏差`,
      '伪逆 x = (AᵀA)⁻¹Aᵀb 给出 Ax ≈ b 的最小二乘解 —— 当方程数多于未知数（超定）时唯一',
    ]);
    heading(f, '伪逆与最小二乘拟合');
  },
});

/** M43 条件数。 */
const conditionNumber = defineViz({
  slug: 'condition-number',
  title: '条件数',
  params: {
    e: { type: 'range', min: 0.02, max: 0.6, default: 0.1, step: 0.02, label: '扰动 ε' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const eps = num(params, 'e', 0.1);
    // 病态矩阵：两条几乎平行的直线
    const a1 = 1;
    const b1 = 1;
    const a2 = 1;
    const b2 = 1 + eps;
    const cond = (a1 * b2 - a2 * b1) === 0 ? Infinity : Math.sqrt((a1 * a1 + b1 * b1 + a2 * a2 + b2 * b2) * 2) / Math.abs(a1 * b2 - a2 * b1);
    const v = view(f, { xMin: -2, xMax: 8, yMin: -2, yMax: 8, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });

    // 两直线：x + y = 4 与 x + (1+ε)y = 4.2
    poly(f, [[v.sx(-2), v.sy(6)], [v.sx(8), v.sy(-4)]], { stroke: C.accent, lw: 2 });
    const c2 = 4.2;
    const pts: V2[] = [];
    for (let x = -2; x <= 8; x += 0.1) pts.push([v.sx(x), v.sy((c2 - x) / b2)]);
    poly(f, pts, { stroke: C.warm, lw: 2 });
    const solY = (c2 - 4) / eps;
    const solX = 4 - solY;
    if (Math.abs(solY) < 40) dot(f, v.sx(solX), v.sy(solY), 6, C.hot);

    footnotes(f, [
      `两直线几乎平行（斜率差 ε = ${eps}）：交点 (${solX.toFixed(3)}, ${solY.toFixed(3)})`,
      `条件数 ≈ ${Number.isFinite(cond) ? cond.toFixed(2) : '∞'}：输入右端项微扰 0.01 会让解移动约 ${(Number.isFinite(cond) ? cond * 0.01 : Infinity).toFixed(2)}`,
      '条件数衡量"解的敏感度"：条件数大 = 病态问题，浮点误差会被放大 —— 数值计算必须先看条件数',
    ]);
    heading(f, '条件数：问题的敏感度');
  },
});

/** M44 盖尔圆定理。 */
const gershgorin = defineViz({
  slug: 'gershgorin',
  title: '盖尔圆定理',
  params: {
    a: { type: 'range', min: 1, max: 6, default: 4, step: 0.5, label: 'a₁₁' },
    b: { type: 'range', min: -2, max: 2, default: 1.5, step: 0.25, label: 'a₁₂' },
    c: { type: 'range', min: -2, max: 2, default: -1, step: 0.25, label: 'a₂₁' },
    d: { type: 'range', min: -1, max: 4, default: 1, step: 0.5, label: 'a₂₂' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const m: M2 = [
      [num(params, 'a', 4), num(params, 'b', 1.5)],
      [num(params, 'c', -1), num(params, 'd', 1)],
    ];
    const eig = eigen2(m);
    const v = view(f, { xMin: -3, xMax: 8, yMin: -5, yMax: 5, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });

    // 盖尔圆盘：圆心 aᵢᵢ，半径 = 该行非对角元绝对值之和
    const disks: Array<[number, number]> = [
      [m[0][0], Math.abs(m[0][1])],
      [m[1][1], Math.abs(m[1][0])],
    ];
    disks.forEach(([cx, r], i) => {
      const pts: V2[] = [];
      for (let k = 0; k <= 120; k++) {
        const t = (k / 120) * Math.PI * 2;
        pts.push([v.sx(cx + r * Math.cos(t)), v.sy(r * Math.sin(t))]);
      }
      poly(f, pts, { stroke: i === 0 ? C.accent : C.green, lw: 1.8, dash: [6, 4] });
      dot(f, v.sx(cx), v.sy(0), 4, i === 0 ? C.accent : C.green);
    });

    if (eig.real) {
      dot(f, v.sx(eig.l1), v.sy(0), 6, C.hot);
      dot(f, v.sx(eig.l2), v.sy(0), 6, C.hot);
      text(f, `λ = ${eig.l1.toFixed(3)}`, v.sx(eig.l1), v.sy(0) - 12, { align: 'center', color: C.hot, font: '12px sans-serif' });
      text(f, `λ = ${eig.l2.toFixed(3)}`, v.sx(eig.l2), v.sy(0) + 22, { align: 'center', color: C.hot, font: '12px sans-serif' });
    }

    footnotes(f, [
      `两个盖尔圆盘：圆心 a₁₁ = ${m[0][0]}（半径 ${disks[0][1]}）、圆心 a₂₂ = ${m[1][1]}（半径 ${disks[1][1]}）`,
      '盖尔圆定理：矩阵的所有特征值都落在这些圆盘的并集内（红点即实际特征值）',
      '若 k 个圆盘连成一片且与其余分离，则这片区域恰好包含 k 个特征值 —— 免计算的特征值定位',
    ]);
    heading(f, '盖尔圆定理：特征值的"包围圈"');
  },
});

/** M45 若尔当标准型。 */
const jordanForm = defineViz({
  slug: 'jordan-form',
  title: '若尔当标准型',
  params: {
    lambda: { type: 'range', min: 0.5, max: 3, default: 2, step: 0.25, label: '特征值 λ' },
    eps: { type: 'range', min: 0, max: 1.5, default: 0.6, step: 0.1, label: '非对角扰动 ε' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const lambda = num(params, 'lambda', 2);
    const eps = num(params, 'eps', 0.6);
    const m: M2 = [[lambda, eps], [0, lambda]];
    const v = equalView(f, 0, 0, 3.4);
    grid(f, v, { divisions: 4, ticks: true });

    // 向量迭代展示"特征方向的缺失"
    let vec0: V2 = [0.4, 1];
    const trail: V2[] = [[vec0[0], vec0[1]]];
    for (let i = 0; i < 5; i++) {
      vec0 = apply2(m, vec0);
      const scale = Math.max(1, Math.hypot(vec0[0], vec0[1]));
      trail.push([vec0[0] / scale, vec0[1] / scale]);
    }
    trail.forEach((p, i) => {
      dot(f, v.sx(p[0] * 1.6), v.sy(p[1] * 1.6), 3.4, PALETTE[i % PALETTE.length]);
    });
    seg(f, v.sx(0), v.sy(0), v.sx(1), v.sy(0), C.hot, 2, );
    dot(f, v.sx(1), v.sy(0), 5, C.hot);

    const isJordan = Math.abs(eps) > 1e-6;
    footnotes(f, [
      `矩阵 [[${lambda}, ${eps}], [0, ${lambda}]]：${isJordan ? '只有一个线性无关的特征向量（几何重数 1 < 代数重数 2）' : '可对角化（λ 重复且线性无关特征向量有 2 个）'}`,
      isJordan ? `若尔当标准型 J = [[λ, 1], [0, λ]]，无法对角化，但仍是"最简"形式` : '当 ε = 0 时矩阵已是若尔当形（对角）',
      '若尔当标准型是"不能对角化时最接近对角"的形式：对角线上是特征值，上对角线上是 1',
    ]);
    heading(f, '若尔当标准型');
  },
});

registerViz(
  matrixTransform,
  linearAlgebra,
  eigenVisualization,
  gramSchmidt,
  luDecomposition,
  qrDecomposition,
  cholesky,
  powerIteration,
  pseudoinverse,
  conditionNumber,
  gershgorin,
  jordanForm,
);
