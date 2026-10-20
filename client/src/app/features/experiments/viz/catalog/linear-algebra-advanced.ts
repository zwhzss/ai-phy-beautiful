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
type V3 = [number, number, number];
type M3 = [V3, V3, V3];

/** 3D → 2D 等距投影。 */
function project3(p: V3, ay: number, ax: number, scale: number, cx: number, cy: number): [number, number] {
  const cy1 = Math.cos(ay);
  const sy1 = Math.sin(ay);
  const cx1 = Math.cos(ax);
  const sx1 = Math.sin(ax);
  const x1 = p[0] * cy1 + p[2] * sy1;
  const z1 = -p[0] * sy1 + p[2] * cy1;
  const y1 = p[1] * cx1 - z1 * sx1;
  return [cx + x1 * scale, cy - y1 * scale];
}

/** 3×3 矩阵 × 向量。 */
function mul3(m: M3, v: V3): V3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

/** A16 矩阵分解深化。 */
const matrixDecomposition = defineViz({
  slug: 'matrix-decomposition',
  title: '矩阵分解深化',
  params: {
    kind: { type: 'select', options: ['LU', 'QR', 'Cholesky', 'SVD'], default: 'SVD', label: '分解方式' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'kind', 'SVD');
    const desc: Record<string, { formula: string; use: string }> = {
      LU: { formula: 'A = LU（L 单位下三角，U 上三角）', use: '解线性方程组、求行列式；消元过程的记录' },
      QR: { formula: 'A = QR（Q 正交，R 上三角）', use: '最小二乘、特征值 QR 算法；数值稳定' },
      Cholesky: { formula: 'A = LLᵀ（A 对称正定）', use: '正定系统求解，速度约为 LU 的两倍' },
      SVD: { formula: 'A = UΣVᵀ（U、V 正交，Σ 对角非负）', use: '伪逆、降维、压缩、推荐系统；对任意矩阵都成立' },
    };
    const info = desc[kind];

    // 用一个 2×3 矩阵演示分解后的形状
    const rows = kind === 'SVD' ? 2 : 3;
    const cols = 3;
    const cell = 32;
    const oy = h / 2 - 40;
    const drawBlock = (ox: number, r: number, c: number, color: string, label: string, diag = false): void => {
      for (let i = 0; i < r; i++) {
        for (let j = 0; j < c; j++) {
          f.ctx.save();
          f.ctx.fillStyle = diag && i !== j ? 'rgba(58,74,99,0.4)' : `${color}55`;
          f.ctx.fillRect(ox + j * (cell + 3), oy + i * (cell + 3), cell, cell);
          f.ctx.restore();
        }
      }
      text(f, label, ox, oy - 10, { color, font: 'bold 12px "Segoe UI", system-ui, sans-serif' });
    };

    const width = (c: number): number => c * (cell + 3);
    drawBlock(50, rows, cols, C.accent, 'A');
    text(f, '=', 50 + width(cols) + 6, oy + cell, { color: C.fg, font: '16px sans-serif' });
    let x = 50 + width(cols) + 34;
    if (kind === 'LU') {
      drawBlock(x, 3, 3, C.green, 'L（单位下三角）');
      text(f, '×', x + width(3) + 6, oy + cell, { color: C.fg, font: '16px sans-serif' });
      drawBlock(x + width(3) + 30, 3, 3, C.warm, 'U（上三角）');
    } else if (kind === 'QR') {
      drawBlock(x, 3, 3, C.green, 'Q（正交）');
      text(f, '×', x + width(3) + 6, oy + cell, { color: C.fg, font: '16px sans-serif' });
      drawBlock(x + width(3) + 30, 3, 3, C.warm, 'R（上三角）');
    } else if (kind === 'Cholesky') {
      drawBlock(x, 3, 3, C.green, 'L（下三角）');
      text(f, '×', x + width(3) + 6, oy + cell, { color: C.fg, font: '16px sans-serif' });
      drawBlock(x + width(3) + 30, 3, 3, C.warm, 'Lᵀ（上三角）');
    } else {
      drawBlock(x, 2, 2, C.green, 'U（正交）');
      text(f, '×', x + width(2) + 6, oy + cell, { color: C.fg, font: '16px sans-serif' });
      x += width(2) + 30;
      drawBlock(x, 2, 3, C.warm, 'Σ（对角）', true);
      text(f, '×', x + width(3) + 6, oy + cell, { color: C.fg, font: '16px sans-serif' });
      drawBlock(x + width(3) + 30, 3, 3, C.cool, 'Vᵀ（正交）');
    }

    footnotes(f, [info.formula, info.use, '矩阵分解 = 用"结构简单的因子"表示矩阵，把难题化成一组易解的步骤']);
    heading(f, `矩阵分解：${kind}`);
  },
});

/** A17 SVD 奇异值分解。 */
const svd = defineViz({
  slug: 'svd',
  title: 'SVD奇异值分解',
  params: {
    a: { type: 'range', min: -2, max: 2, default: 1.4, step: 0.1, label: 'a (1,1)' },
    b: { type: 'range', min: -2, max: 2, default: 0.9, step: 0.1, label: 'b (1,2)' },
    c: { type: 'range', min: -2, max: 2, default: 0.2, step: 0.1, label: 'c (2,1)' },
    d: { type: 'range', min: -2, max: 2, default: 1.1, step: 0.1, label: 'd (2,2)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 1.4);
    const b = num(params, 'b', 0.9);
    const c = num(params, 'c', 0.2);
    const d = num(params, 'd', 1.1);
    // 2×2 SVD 的奇异值：AᵀA 特征值的平方根
    const ata11 = a * a + c * c;
    const ata12 = a * b + c * d;
    const ata22 = b * b + d * d;
    const tr = ata11 + ata22;
    const dt = ata11 * ata22 - ata12 * ata12;
    const disc = Math.max(0, tr * tr - 4 * dt);
    const l1 = (tr + Math.sqrt(disc)) / 2;
    const l2 = (tr - Math.sqrt(disc)) / 2;
    const s1 = Math.sqrt(Math.max(0, l1));
    const s2 = Math.sqrt(Math.max(0, l2));

    const v = equalView(f, 0, 0, 2.6);
    grid(f, v, { divisions: 4, ticks: true });
    // 单位圆 → 椭圆
    const circlePts: V2[] = [];
    const ellipsePts: V2[] = [];
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * Math.PI * 2;
      const p: V2 = [Math.cos(t), Math.sin(t)];
      circlePts.push([v.sx(p[0]), v.sy(p[1])]);
      ellipsePts.push([v.sx(a * p[0] + b * p[1]), v.sy(c * p[0] + d * p[1])]);
    }
    poly(f, circlePts, { stroke: `${C.dim}aa`, lw: 1.6, dash: [5, 4] });
    poly(f, ellipsePts, { stroke: C.accent, lw: 2.4 });

    // 奇异向量方向
    const eigVec = (l: number): V2 => {
      const x0 = ata11 - l;
      const y0 = ata12;
      const vv: V2 = Math.abs(y0) > 1e-9 ? [-y0, x0] : [0, 1];
      const len = Math.hypot(vv[0], vv[1]) || 1;
      return [vv[0] / len, vv[1] / len];
    };
    const v1 = eigVec(l1);
    const v2 = eigVec(l2);
    [v1, v2].forEach((dir, i) => {
      const scaled: V2 = [(a * dir[0] + b * dir[1]) * (i === 0 ? 1 : 1), c * dir[0] + d * dir[1]];
      vec(f, v.sx(0), v.sy(0), v.sx(scaled[0] * 0.9), v.sy(scaled[1] * 0.9), i === 0 ? C.warm : C.green, 2.4);
      seg(f, v.sx(-dir[0] * 2.4), v.sy(-dir[1] * 2.4), v.sx(dir[0] * 2.4), v.sy(dir[1] * 2.4), `${i === 0 ? C.warm : C.green}55`, 1.2, );
    });

    footnotes(f, [
      `A = [[${a}, ${b}], [${c}, ${d}]]：奇异值 σ₁ = ${s1.toFixed(4)}，σ₂ = ${s2.toFixed(4)}`,
      'SVD 的几何意义：单位圆 → 椭圆，两个半轴长就是奇异值，方向由左右奇异向量给出',
      '条件数 = σ₁/σ₂ = ' + (s2 > 1e-9 ? (s1 / s2).toFixed(3) : '∞') + '；最大的奇异值决定谱范数，最小的决定可逆性',
    ]);
    heading(f, 'SVD：单位圆到椭圆');
  },
});

/** A18 主成分分析。 */
const pca = defineViz({
  slug: 'pca',
  title: '主成分分析',
  params: {
    angle: { type: 'range', min: 0, max: 180, default: 35, label: '数据主方向(°)' },
    spread: { type: 'range', min: 1, max: 4, default: 2.6, step: 0.2, label: '主方向散布' },
    count: { type: 'range', min: 20, max: 120, default: 60, step: 5, label: '样本数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const deg = num(params, 'angle', 35);
    const spread = num(params, 'spread', 2.6);
    const count = Math.round(num(params, 'count', 60));
    const theta = (deg * Math.PI) / 180;
    const rand = rng(3141);
    const data: V2[] = [];
    for (let i = 0; i < count; i++) {
      const u = (rand() - 0.5) * 2 * spread;
      const vv = (rand() - 0.5) * 0.7;
      data.push([u * Math.cos(theta) - vv * Math.sin(theta), u * Math.sin(theta) + vv * Math.cos(theta)]);
    }
    // 协方差矩阵与特征向量
    const mx = data.reduce((s, p) => s + p[0], 0) / count;
    const my = data.reduce((s, p) => s + p[1], 0) / count;
    const cxx = data.reduce((s, p) => s + (p[0] - mx) ** 2, 0) / count;
    const cyy = data.reduce((s, p) => s + (p[1] - my) ** 2, 0) / count;
    const cxy = data.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / count;
    const tr = cxx + cyy;
    const dt = cxx * cyy - cxy * cxy;
    const l1 = (tr + Math.sqrt(Math.max(0, tr * tr - 4 * dt))) / 2;
    const l2 = (tr - Math.sqrt(Math.max(0, tr * tr - 4 * dt))) / 2;
    const eigVec = (l: number): V2 => {
      const x0 = cxx - l;
      const vv: V2 = Math.abs(cxy) > 1e-9 ? [-cxy, x0] : [0, 1];
      const len = Math.hypot(vv[0], vv[1]) || 1;
      return [vv[0] / len, vv[1] / len];
    };
    const e1 = eigVec(l1);
    const e2 = eigVec(l2);

    const v = equalView(f, 0, 0, 3.4);
    grid(f, v, { divisions: 5, ticks: true });
    data.forEach((p) => dot(f, v.sx(p[0]), v.sy(p[1]), 3, `${C.accent}cc`));
    // 主成分轴（长度 ∝ √λ）
    const s1 = Math.sqrt(l1);
    const s2 = Math.sqrt(l2);
    vec(f, v.sx(mx), v.sy(my), v.sx(mx + e1[0] * s1 * 1.6), v.sy(my + e1[1] * s1 * 1.6), C.warm, 2.8);
    vec(f, v.sx(mx), v.sy(my), v.sx(mx + e2[0] * s2 * 1.6), v.sy(my + e2[1] * s2 * 1.6), C.green, 2.2);

    const ratio = l1 / (l1 + l2);
    footnotes(f, [
      `第一主成分方向 (${e1[0].toFixed(3)}, ${e1[1].toFixed(3)})，解释方差占比 ${(ratio * 100).toFixed(2)}%`,
      `特征值 λ₁ = ${l1.toFixed(4)}、λ₂ = ${l2.toFixed(4)}（= 各主成分方向上的方差）`,
      'PCA 就是"对中心化数据求协方差矩阵的特征向量"：第一主成分是数据方差最大的方向',
    ]);
    heading(f, '主成分分析');
  },
});

/** A19 拉格朗日乘子。 */
const lagrangeMultiplier = defineViz({
  slug: 'lagrange-multiplier',
  title: '拉格朗日乘子',
  params: {
    constraint: { type: 'range', min: 0.5, max: 2.5, default: 1.4, step: 0.1, label: '约束半径' },
    angle: { type: 'range', min: 0, max: 360, default: 45, label: '最优点角度(°)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const r = num(params, 'constraint', 1.4);
    const deg = num(params, 'angle', 45);
    // 目标 f(x,y) = x + 2y，约束 x² + y² = r²
    const fn: (p: V2) => number = (p) => p[0] + 2 * p[1];
    const theta = (deg * Math.PI) / 180;
    const opt: V2 = [r * Math.cos(theta), r * Math.sin(theta)];
    // 最优解：梯度平行 → (1, 2) ∝ (x, y) → 方向 (1,2)/√5
    const gdir = Math.sqrt(5);
    const best: V2 = [(r * 1) / gdir, (r * 2) / gdir];

    const v = equalView(f, 0, 0, 2.4);
    grid(f, v, { divisions: 4, ticks: true });

    // 等值线
    for (let c = -4; c <= 4; c += 0.7) {
      const pts: V2[] = [];
      for (let i = 0; i <= 200; i++) {
        const t = (i / 200) * Math.PI * 2;
        const dist = (c - 0) / 1;
        const ss = Math.sqrt(0.4 + dist * dist);
        pts.push([v.sx(ss * Math.cos(t) * 0.9), v.sy(ss * Math.sin(t) * 0.9)]);
      }
      poly(f, pts, { stroke: 'rgba(58,74,99,0.8)', lw: 1 });
    }
    // 约束圆
    const circlePts: V2[] = [];
    for (let i = 0; i <= 160; i++) {
      const t = (i / 160) * Math.PI * 2;
      circlePts.push([v.sx(r * Math.cos(t)), v.sy(r * Math.sin(t))]);
    }
    poly(f, circlePts, { stroke: C.accent, lw: 2.6 });

    // 切点处的两个梯度（平行）
    const gradF: V2 = [1, 2];
    const gradG: V2 = [best[0], best[1]];
    const normF = Math.hypot(gradF[0], gradF[1]);
    const normG = Math.hypot(gradG[0], gradG[1]);
    vec(f, v.sx(best[0]), v.sy(best[1]), v.sx(best[0] + (gradF[0] / normF) * 0.9), v.sy(best[1] + (gradF[1] / normF) * 0.9), C.hot, 2.6);
    vec(f, v.sx(best[0]), v.sy(best[1]), v.sx(best[0] + (gradG[0] / normG) * 0.9), v.sy(best[1] + (gradG[1] / normG) * 0.9), C.green, 2.2);
    dot(f, v.sx(best[0]), v.sy(best[1]), 5.5, C.warm);
    dot(f, v.sx(opt[0]), v.sy(opt[1]), 4, C.dim);
    const lambda = normF / normG;

    footnotes(f, [
      `最大化 f = x + 2y 于约束 x² + y² = ${r}²：最优解 (${best[0].toFixed(4)}, ${best[1].toFixed(4)})，f = ${fn(best).toFixed(4)}`,
      `拉格朗日乘子 λ = |∇f|/|∇g| = ${lambda.toFixed(4)}：最优处 ∇f = λ∇g（两个梯度平行，红绿箭头）`,
      '几何直觉：沿约束曲线移动时，只有当 ∇f 与约束方向垂直（即与 ∇g 平行）才不能再改进',
    ]);
    heading(f, '拉格朗日乘子：梯度平行');
  },
});

/** A20 二次型。 */
const quadraticForm = defineViz({
  slug: 'quadratic-form',
  title: '二次型',
  params: {
    a: { type: 'range', min: -2, max: 2, default: 1.4, step: 0.1, label: 'a' },
    b: { type: 'range', min: -2, max: 2, default: 0.9, step: 0.1, label: 'b（交叉项）' },
    d: { type: 'range', min: -2, max: 2, default: 1.1, step: 0.1, label: 'd' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 1.4);
    const b = num(params, 'b', 0.9);
    const d = num(params, 'd', 1.1);
    const q = (p: V2): number => a * p[0] * p[0] + 2 * b * p[0] * p[1] + d * p[1] * p[1];
    const det = a * d - b * b;
    const classification = det > 1e-6 && a > 0 ? '正定（椭圆抛物面，有唯一最小值）' : det > 1e-6 && a < 0 ? '负定（有唯一最大值）' : det < -1e-6 ? '不定（鞍面，无最值）' : '半定（退化）';

    // 等高线（用低分辨率块着色 + 轮廓）
    const v = equalView(f, 0, 0, 2.6);
    const steps = 70;
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < steps; j++) {
        const x = -2.6 + (i / steps) * 5.2;
        const y = -2.6 + (j / steps) * 5.2;
        const val = q([x, y]);
        if (val > 6 || val < -6) continue;
        const t = (val + 6) / 12;
        f.ctx.save();
        f.ctx.fillStyle = `hsla(${230 - val * 22}, 60%, ${28 + t * 22}%, 0.75)`;
        f.ctx.fillRect(v.sx(x), v.sy(y), (5.2 / steps) * (v.sx(1) - v.sx(0)) + 1, (5.2 / steps) * (v.sx(1) - v.sx(0)) + 1);
        f.ctx.restore();
      }
    }
    grid(f, v, { divisions: 5, ticks: true });

    // 特征向量方向（主轴）
    const tr = a + d;
    const disc = Math.max(0, tr * tr - 4 * det);
    const l1 = (tr + Math.sqrt(disc)) / 2;
    const l2 = (tr - Math.sqrt(disc)) / 2;
    const dir = (l: number): V2 => {
      const x0 = a - l;
      const vv: V2 = Math.abs(b) > 1e-9 ? [-b, x0] : [l >= 0 ? 1 : -1, 0];
      const len = Math.hypot(vv[0], vv[1]) || 1;
      return [vv[0] / len, vv[1] / len];
    };
    [dir(l1), dir(l2)].forEach((dv, i) => {
      const scale = 1 / Math.sqrt(Math.abs(i === 0 ? l1 : l2) || 1);
      seg(f, v.sx(-dv[0] * scale), v.sy(-dv[1] * scale), v.sx(dv[0] * scale), v.sy(dv[1] * scale), i === 0 ? C.warm : C.green, 2.2);
    });

    footnotes(f, [
      `q(x,y) = ${a}x² + 2·${b}xy + ${d}y²，矩阵 [[${a}, ${b}], [${b}, ${d}]]，det = ${det.toFixed(3)}`,
      `特征值 λ₁ = ${l1.toFixed(3)}、λ₂ = ${l2.toFixed(3)} ⇒ ${classification}`,
      '二次型的正负定性等价于矩阵特征值的符号；等值线是椭圆/双曲线，主轴方向即特征向量',
    ]);
    heading(f, '二次型与正定性');
  },
});

/** A21 行列式几何意义。 */
const determinantGeometry = defineViz({
  slug: 'determinant-geometry',
  title: '行列式几何意义',
  params: {
    a: { type: 'range', min: -2, max: 2, default: 1.2, step: 0.1, label: 'a (1,1)' },
    b: { type: 'range', min: -2, max: 2, default: 0.5, step: 0.1, label: 'b (1,2)' },
    c: { type: 'range', min: -2, max: 2, default: 0.4, step: 0.1, label: 'c (2,1)' },
    d: { type: 'range', min: -2, max: 2, default: 1.3, step: 0.1, label: 'd (2,2)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 1.2);
    const b = num(params, 'b', 0.5);
    const c = num(params, 'c', 0.4);
    const d = num(params, 'd', 1.3);
    const det = a * d - b * c;
    const v = equalView(f, 0, 0, 3.2);
    grid(f, v, { divisions: 4, ticks: true });

    const u: V2 = [a, c];
    const vv: V2 = [b, d];
    poly(f, [[v.sx(0), v.sy(0)], [v.sx(u[0]), v.sy(u[1])], [v.sx(u[0] + vv[0]), v.sy(u[1] + vv[1])], [v.sx(vv[0]), v.sy(vv[1])]], {
      fill: det >= 0 ? 'rgba(102,126,234,0.3)' : 'rgba(245,101,101,0.3)',
      stroke: det >= 0 ? C.accent : C.hot,
      lw: 2.2,
      close: true,
    });
    vec(f, v.sx(0), v.sy(0), v.sx(u[0]), v.sy(u[1]), C.green, 2.4);
    vec(f, v.sx(0), v.sy(0), v.sx(vv[0]), v.sy(vv[1]), C.cool, 2.4);
    dot(f, v.sx(u[0]), v.sy(u[1]), 3.5, C.green);
    dot(f, v.sx(vv[0]), v.sy(vv[1]), 3.5, C.cool);

    // 单位正方形对照
    poly(f, [[v.sx(0), v.sy(0)], [v.sx(1), v.sy(0)], [v.sx(1), v.sy(1)], [v.sx(0), v.sy(1)]], {
      stroke: `${C.dim}88`, lw: 1.4, dash: [4, 3], close: true,
    });

    footnotes(f, [
      `det A = ${a}×${d} - ${b}×${c} = ${det.toFixed(4)}：单位正方形被映射成面积 |det| = ${Math.abs(det).toFixed(4)} 的平行四边形`,
      det < 0 ? 'det < 0 表示变换改变了定向（翻转，如镜像）' : 'det > 0 表示定向保持不变',
      '行列式的三重含义：面积/体积缩放倍数、线性方程组有唯一解的判据、有向体积',
    ]);
    heading(f, '行列式的几何意义：面积缩放');
  },
});

/** A22 Cramer 法则。 */
const cramersRule = defineViz({
  slug: 'cramers-rule',
  title: 'Cramer法则深化',
  params: {
    a1: { type: 'range', min: -3, max: 3, default: 2, step: 0.5, label: 'a₁₁' },
    b1: { type: 'range', min: -3, max: 3, default: 1, step: 0.5, label: 'a₁₂' },
    c1: { type: 'range', min: -6, max: 6, default: 5, step: 0.5, label: 'b₁' },
    a2: { type: 'range', min: -3, max: 3, default: -1, step: 0.5, label: 'a₂₁' },
    b2: { type: 'range', min: -3, max: 3, default: 2, step: 0.5, label: 'a₂₂' },
    c2: { type: 'range', min: -6, max: 6, default: 4, step: 0.5, label: 'b₂' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a1 = num(params, 'a1', 2);
    const b1 = num(params, 'b1', 1);
    const c1 = num(params, 'c1', 5);
    const a2 = num(params, 'a2', -1);
    const b2 = num(params, 'b2', 2);
    const c2 = num(params, 'c2', 4);
    const det = a1 * b2 - a2 * b1;
    const detX = c1 * b2 - c2 * b1;
    const detY = a1 * c2 - a2 * c1;
    const x = det === 0 ? NaN : detX / det;
    const y = det === 0 ? NaN : detY / det;

    const v = view(f, { xMin: -6, xMax: 6, yMin: -6, yMax: 6, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });
    // 两条直线：a1x + b1y = c1
    const line = (av: number, bv: number, cv: number, color: string): void => {
      const pts: V2[] = [];
      if (Math.abs(bv) > 1e-9) {
        for (let i = 0; i <= 200; i++) {
          const xx = -6 + (i / 200) * 12;
          pts.push([v.sx(xx), v.sy((cv - av * xx) / bv)]);
        }
      } else {
        for (let i = 0; i <= 200; i++) {
          const yy = -6 + (i / 200) * 12;
          pts.push([v.sx(cv / (av || 1e-9)), v.sy(yy)]);
        }
      }
      poly(f, pts, { stroke: color, lw: 2.2 });
    };
    line(a1, b1, c1, C.accent);
    line(a2, b2, c2, C.warm);
    if (Number.isFinite(x) && Number.isFinite(y)) dot(f, v.sx(x), v.sy(y), 6, C.green);

    footnotes(f, [
      `方程组：${a1}x + ${b1}y = ${c1}；${a2}x + ${b2}y = ${c2}`,
      Number.isFinite(x)
        ? `Cramer 法则：x = det(A₁)/det(A) = ${detX.toFixed(2)}/${det.toFixed(2)} = ${x.toFixed(4)}，y = ${y.toFixed(4)}`
        : 'det(A) = 0：两直线平行或重合，方程组无解或有无穷多解（Cramer 法则失效）',
      'Cramer 法则用行列式给出解的显式公式；它漂亮但计算量大（O(n·n!)），实际求解用高斯消元',
    ]);
    heading(f, 'Cramer 法则：行列式求解');
  },
});

/** A23 3D 旋转。 */
const rotation3d = defineViz({
  slug: 'rotation3d',
  title: '3D旋转',
  params: {
    angleX: { type: 'range', min: -180, max: 180, default: 30, label: '绕 X 轴(°)' },
    angleY: { type: 'range', min: -180, max: 180, default: 40, label: '绕 Y 轴(°)' },
    angleZ: { type: 'range', min: -180, max: 180, default: 0, label: '绕 Z 轴(°)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const ax = (num(params, 'angleX', 30) * Math.PI) / 180;
    const ay = (num(params, 'angleY', 40) * Math.PI) / 180;
    const az = (num(params, 'angleZ', 0) * Math.PI) / 180;

    const rotate = (p: V3): V3 => {
      // Rx
      let y = p[1] * Math.cos(ax) - p[2] * Math.sin(ax);
      let z = p[1] * Math.sin(ax) + p[2] * Math.cos(ax);
      let x = p[0];
      // Ry
      const x2 = x * Math.cos(ay) + z * Math.sin(ay);
      const z2 = -x * Math.sin(ay) + z * Math.cos(ay);
      x = x2;
      z = z2;
      // Rz
      const x3 = x * Math.cos(az) - y * Math.sin(az);
      const y3 = x * Math.sin(az) + y * Math.cos(az);
      return [x3, y3, z];
    };

    const cx = w / 2;
    const cy = h / 2 + 10;
    const scale = Math.min(w, h) * 0.22;
    const project = (p: V3): [number, number] => project3(p, ay * 0 + 0.5, ax * 0 + 0.35, scale, cx, cy);

    // 立方体
    const cubeVerts: V3[] = [];
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) cubeVerts.push([x, y, z]);
    const rotated = cubeVerts.map(rotate);
    const edges: Array<[number, number]> = [];
    for (let i = 0; i < 8; i++) {
      for (let j = i + 1; j < 8; j++) {
        const diff = cubeVerts[i].filter((v0, k) => Math.abs(v0 - cubeVerts[j][k]) > 1e-9).length;
        if (diff === 1) edges.push([i, j]);
      }
    }
    const projected = rotated.map(project);
    edges.forEach(([i, j]) => seg(f, projected[i][0], projected[i][1], projected[j][0], projected[j][1], 'rgba(102,126,234,0.75)', 1.8));
    rotated.forEach((p, i) => {
      const [px, py] = projected[i];
      dot(f, px, py, 3.4, p[2] > 0 ? C.warm : C.cool);
    });

    // 坐标轴
    const axes: Array<[V3, string, string]> = [[[2, 0, 0], 'x', C.hot], [[0, 2, 0], 'y', C.green], [[0, 0, 2], 'z', C.cool]];
    axes.forEach(([a, label, color]) => {
      const ra = rotate(a as V3);
      const o = project([0, 0, 0]);
      const e = project(ra);
      vec(f, o[0], o[1], e[0], e[1], color as string, 2);
      text(f, label as string, e[0] + 6, e[1] - 4, { color: color as string, font: 'bold 12px sans-serif' });
    });

    // 旋转矩阵
    const R = [rotate([1, 0, 0]), rotate([0, 1, 0]), rotate([0, 0, 1])];
    const rows = [0, 1, 2].map((r) => `[${R.map((col) => col[r].toFixed(3)).join(', ')}]`).join('\n');
    rows.split('\n').forEach((row, i) => text(f, row, 30, h - 76 + i * 18, { color: C.dim, font: '11px Consolas, monospace' }));

    footnotes(f, [
      '三个欧拉角依次绕 X、Y、Z 轴旋转，合成后的旋转矩阵如左下（正交矩阵，det = 1）',
      '旋转矩阵的列向量是三个基向量旋转后的位置 —— 它们是标准正交基',
      '欧拉角在万向节锁（gimbal lock）处退化为两自由度，四元数可以避免这个问题',
    ]);
    heading(f, '3D 旋转与旋转矩阵');
  },
});

/** A24 四元数旋转。 */
const quaternionRotation = defineViz({
  slug: 'quaternion-rotation',
  title: '四元数旋转',
  params: {
    axis: { type: 'select', options: ['X 轴', 'Y 轴', 'Z 轴', '斜轴 (1,1,0)'], default: 'Z 轴', label: '旋转轴' },
    angle: { type: 'range', min: 0, max: 360, default: 90, label: '旋转角(°)' },
    t: { type: 'range', min: 0, max: 1, default: 1, step: 0.05, label: '插值参数 t（slerp）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const axisName = str(params, 'axis', 'Z 轴');
    const angle = num(params, 'angle', 90);
    const t = num(params, 't', 1);
    const axisMap: Record<string, V3> = {
      'X 轴': [1, 0, 0], 'Y 轴': [0, 1, 0], 'Z 轴': [0, 0, 1], '斜轴 (1,1,0)': [Math.SQRT1_2, Math.SQRT1_2, 0],
    };
    const axis = axisMap[axisName];

    // 四元数 q = [cos(θ/2), sin(θ/2)·axis]
    const half = ((angle * t) * Math.PI) / 360;
    const qw = Math.cos(half);
    const qv: V3 = [axis[0] * Math.sin(half), axis[1] * Math.sin(half), axis[2] * Math.sin(half)];

    // 用四元数旋转向量 v：v' = v + 2q_v × (q_v × v + q_w v)
    const rotateByQuat = (v0: V3): V3 => {
      const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const t1: V3 = [qv[0] + qw * v0[0], qv[1] + qw * v0[1], qv[2] + qw * v0[2]];
      const c1 = cross(qv, t1);
      return [v0[0] + 2 * c1[0], v0[1] + 2 * c1[1], v0[2] + 2 * c1[2]];
    };

    const cx = w / 2;
    const cy = h / 2 + 10;
    const scale = Math.min(w, h) * 0.24;
    const proj = (p: V3): [number, number] => project3(p, 0.6, 0.35, scale, cx, cy);

    // 被旋转的物体（一个小坐标系 + 立方体线框）
    const shapeVerts: V3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0], [0, -1, 0], [0, 0, -1]];
    const labels = ['x', 'y', 'z', '-x', '-y', '-z'];
    shapeVerts.forEach((vv, i) => {
      const r = rotateByQuat(vv);
      const o = proj([0, 0, 0]);
      const e = proj(r);
      const color = i < 3 ? PALETTE[i] : `${PALETTE[i - 3]}77`;
      seg(f, o[0], o[1], e[0], e[1], color, i < 3 ? 2.4 : 1.4);
      text(f, labels[i], e[0] + 6, e[1] - 4, { color, font: '11px sans-serif' });
    });
    // 旋转轴
    const o0 = proj([0, 0, 0]);
    const axisEnd = proj([axis[0] * 1.9, axis[1] * 1.9, axis[2] * 1.9]);
    vec(f, o0[0], o0[1], axisEnd[0], axisEnd[1], C.warm, 1.6);

    footnotes(f, [
      `四元数 q = (${qw.toFixed(4)}, ${qv.map((x) => x.toFixed(4)).join(', ')})，绕 ${axisName} 旋转 ${(angle * t).toFixed(1)}°`,
      'slerp 插值公式 q(t) = (q₁ sin((1-t)Ω) + q₂ sin(tΩ))/sinΩ —— 拖动 t 观察平滑旋转',
      '四元数用 4 个数表示旋转（无冗余的 3 参数表示会奇异，9 参数矩阵太冗余），且乘法复合高效',
    ]);
    heading(f, '四元数旋转与 slerp 插值');
  },
});

/** A25 李代数 so(3)。 */
const lieAlgebraSo3 = defineViz({
  slug: 'lie-algebra-so3',
  title: '李代数so(3)',
  params: {
    wx: { type: 'range', min: -2, max: 2, default: 0.6, step: 0.1, label: 'ω_x' },
    wy: { type: 'range', min: -2, max: 2, default: 1, step: 0.1, label: 'ω_y' },
    wz: { type: 'range', min: -2, max: 2, default: 0.4, step: 0.1, label: 'ω_z' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const wx = num(params, 'wx', 0.6);
    const wy = num(params, 'wy', 1);
    const wz = num(params, 'wz', 0.4);
    // so(3) 元素是反对称矩阵
    const omega: M3 = [[0, -wz, wy], [wz, 0, -wx], [-wy, wx, 0]];
    // 矩阵指数 ≈ I + Ω + Ω²/2 + Ω³/6（小角度近似更好）
    const matmul = (m: M3, n: M3): M3 => {
      const out: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) out[i][j] += m[i][k] * n[k][j];
      return out as M3;
    };
    const scaleM = (m: M3, s: number): M3 => m.map((row) => row.map((x) => x * s)) as M3;
    const addM = (m: M3, n: M3): M3 => m.map((row, i) => row.map((x, j) => x + n[i][j])) as M3;
    const I: M3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const O2 = matmul(omega, omega);
    const O3 = matmul(O2, omega);
    const R = addM(addM(addM(I, omega), scaleM(O2, 0.5)), scaleM(O3, 1 / 6));

    const cx = w / 2;
    const cy = h / 2 + 10;
    const scale = Math.min(w, h) * 0.24;
    const proj = (p: V3): [number, number] => project3(p, 0.5, 0.3, scale, cx, cy);
    const o = proj([0, 0, 0]);
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((e, i) => {
      const rotated = mul3(R, e as V3);
      const tip = proj(rotated);
      vec(f, o[0], o[1], tip[0], tip[1], PALETTE[i], 2.4);
      text(f, ['x', 'y', 'z'][i], tip[0] + 6, tip[1] - 4, { color: PALETTE[i], font: 'bold 12px sans-serif' });
    });
    // 角速度向量
    const wVec: V3 = [wx, wy, wz];
    const wtip = proj([wVec[0] * 1.5, wVec[1] * 1.5, wVec[2] * 1.5]);
    vec(f, o[0], o[1], wtip[0], wtip[1], C.warm, 2.6);
    text(f, 'ω（角速度）', wtip[0] + 6, wtip[1] - 6, { color: C.warm, font: '11px sans-serif' });

    const omegaRows = omega.map((row) => `[${row.map((x) => x.toFixed(2).padStart(6)).join(' ')}]`).join('\n');
    omegaRows.split('\n').forEach((row, i) => text(f, row, 30, h - 88 + i * 17, { color: C.dim, font: '11px Consolas, monospace' }));

    footnotes(f, [
      `ω = (${wx}, ${wy}, ${wz}) 对应的反对称矩阵 Ω ∈ so(3)（左下），R = exp(Ω) 是旋转矩阵`,
      'so(3) 是"无穷小旋转"的空间：反对称矩阵；指数映射把它送到旋转群 SO(3)',
      '李代数与李群的关系：切空间（线性）→ 流形（弯曲），这是机器人学、SLAM 的核心工具',
    ]);
    heading(f, '李代数 so(3) 与指数映射');
  },
});

/** A26 SO(3) 拓扑。 */
const so3Topology = defineViz({
  slug: 'so3-topology',
  title: 'SO(3)拓扑',
  params: {
    angle: { type: 'range', min: 0, max: 720, default: 360, label: '旋转角(°)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const angleDeg = num(params, 'angle', 360);
    const angle = (angleDeg * Math.PI) / 180;

    // 用"球 + 对径点识别"表示 SO(3)：半径 π 的实心球
    const cx = w * 0.62;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.3;
    f.ctx.save();
    f.ctx.beginPath();
    f.ctx.arc(cx, cy, R, 0, Math.PI * 2);
    f.ctx.fillStyle = 'rgba(102,126,234,0.12)';
    f.ctx.fill();
    f.ctx.strokeStyle = C.accent;
    f.ctx.lineWidth = 1.8;
    f.ctx.stroke();
    f.ctx.restore();
    // 对径点
    dot(f, cx + R * 0.55, cy - R * 0.35, 4, C.hot);
    dot(f, cx - R * 0.55, cy + R * 0.35, 4, C.hot);
    seg(f, cx + R * 0.55, cy - R * 0.35, cx - R * 0.55, cy + R * 0.35, `${C.hot}88`, 1.2, );
    text(f, '对径点视为同一点', cx, cy + R + 24, { align: 'center', color: C.hot, font: '11px sans-serif' });

    // 旋转角对应球内半径
    const r = Math.min(1, angleDeg / 180) * R * 0.98;
    const phi = angle;
    const px = cx + r * Math.cos(phi) * 0.6;
    const py = cy - r * Math.sin(phi) * 0.6;
    seg(f, cx, cy, px, py, C.warm, 2.4);
    dot(f, px, py, 5.5, C.warm);
    text(f, `${angleDeg}°`, cx - 34, cy - 14, { color: C.warm, font: '12px sans-serif' });

    // 左：旋转角与"旋转矩阵到单位矩阵的距离"
    const trace = 1 + 2 * Math.cos(angle);
    const dist = Math.sqrt(Math.max(0, 3 - trace) / 2);
    const vMini = view(f, { xMin: 0, xMax: 720, yMin: 0, yMax: 1.4, inset: 34 });
    const curvePts: Array<[number, number]> = [];
    for (let i = 0; i <= 200; i++) {
      const deg = (i / 200) * 720;
      const rad = (deg * Math.PI) / 180;
      const tr2 = 1 + 2 * Math.cos(rad);
      curvePts.push([vMini.sx(deg), vMini.sy(Math.sqrt(Math.max(0, 3 - tr2) / 2))]);
    }
    poly(f, curvePts, { stroke: C.accent, lw: 2.2 });
    dot(f, vMini.sx(angleDeg), vMini.sy(dist), 5, C.warm);

    footnotes(f, [
      `转角 ${angleDeg}° 时，与单位矩阵的"距离" = √((3 - tr R)/2) = ${dist.toFixed(4)}`,
      'SO(3) 可以看作"半径 π 的实心球，且把对径点（球面上的相对两点）粘合起来"',
      '这个粘合让 SO(3) 不再单连通：转 360° 后物体恢复原状，但"旋转的路径"绕了一圈没闭合，要转 720° 才闭合（"皮带戏法"/Dirac 的盘子把戏）',
    ]);
    heading(f, 'SO(3) 的拓扑：双覆盖与 720°');
  },
});

/** A27 谱定理。 */
const spectralTheorem = defineViz({
  slug: 'spectral-theorem',
  title: '谱定理',
  params: {
    a: { type: 'range', min: 0.5, max: 4, default: 2.4, step: 0.1, label: 'a (1,1)' },
    b: { type: 'range', min: -2, max: 2, default: 1.2, step: 0.1, label: 'b（对称）' },
    d: { type: 'range', min: 0.5, max: 4, default: 2.8, step: 0.1, label: 'd (2,2)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 2.4);
    const b = num(params, 'b', 1.2);
    const d = num(params, 'd', 2.8);
    const tr = a + d;
    const dt = a * d - b * b;
    const l1 = (tr + Math.sqrt(Math.max(0, tr * tr - 4 * dt))) / 2;
    const l2 = (tr - Math.sqrt(Math.max(0, tr * tr - 4 * dt))) / 2;
    const dir = (l: number): V2 => {
      const x0 = a - l;
      const vv: V2 = Math.abs(b) > 1e-9 ? [-b, x0] : [0, 1];
      const len = Math.hypot(vv[0], vv[1]) || 1;
      return [vv[0] / len, vv[1] / len];
    };
    const e1 = dir(l1);
    const e2 = dir(l2);

    const v = equalView(f, 0, 0, 3.4);
    grid(f, v, { divisions: 5, ticks: true });
    // 特征方向
    vec(f, v.sx(0), v.sy(0), v.sx(e1[0] * 2.2), v.sy(e1[1] * 2.2), C.warm, 2.8);
    vec(f, v.sx(0), v.sy(0), v.sx(e2[0] * 2.2), v.sy(e2[1] * 2.2), C.green, 2.8);
    // 单位圆的像（椭圆，主轴沿特征方向）
    const ellipsePts: V2[] = [];
    for (let i = 0; i <= 200; i++) {
      const t = (i / 200) * Math.PI * 2;
      const p: V2 = [Math.cos(t), Math.sin(t)];
      const s: V2 = [a * p[0] + b * p[1], b * p[0] + d * p[1]];
      ellipsePts.push([v.sx(s[0]), v.sy(s[1])]);
    }
    poly(f, ellipsePts, { stroke: C.accent, lw: 2.2 });
    // 正交性验证
    const orth = e1[0] * e2[0] + e1[1] * e2[1];

    footnotes(f, [
      `对称矩阵 A = [[${a}, ${b}], [${b}, ${d}]]：特征值 λ₁ = ${l1.toFixed(4)}、λ₂ = ${l2.toFixed(4)}`,
      `特征向量内积 e₁·e₂ = ${orth.toExponential(2)} ≈ 0 —— 谱定理保证：实对称矩阵的特征向量可以选成正交基`,
      '谱定理的意义：A = QΛQᵀ，任何对称矩阵都可"正交对角化"；这也是 PCA、二次型分类、量子力学的数学基础',
    ]);
    heading(f, '谱定理：对称矩阵的正交特征基');
  },
});

registerViz(
  matrixDecomposition,
  svd,
  pca,
  lagrangeMultiplier,
  quadraticForm,
  determinantGeometry,
  cramersRule,
  rotation3d,
  quaternionRotation,
  lieAlgebraSo3,
  so3Topology,
  spectralTheorem,
);
