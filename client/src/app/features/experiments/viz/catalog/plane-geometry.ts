import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import {
  C,
  PALETTE,
  circle,
  dot,
  equalView,
  footnotes,
  heading,
  poly,
  polyView,
  rng,
  seg,
  text,
} from '../canvas';

/** I25 勾股定理。 */
const pythagorean = defineViz({
  slug: 'pythagorean',
  title: '勾股定理',
  params: {
    a: { type: 'range', min: 2, max: 8, default: 3, label: '直角边 a' },
    b: { type: 'range', min: 2, max: 8, default: 4, label: '直角边 b' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 3);
    const b = num(params, 'b', 4);
    const c = Math.hypot(a, b);
    const half = Math.max(a + b, c) * 0.5 + 1.6;
    const v = equalView(f, 0, 0.6, half);

    // 直角三角形：直角在原点
    const A: [number, number] = [0, 0];
    const B: [number, number] = [a, 0];
    const D: [number, number] = [0, b];
    polyView(f, v, [A, B, D], { fill: 'rgba(102,126,234,0.28)', stroke: C.accent, lw: 2, close: true });

    // 三个正方形
    polyView(f, v, [A, B, [a, -a], [0, -a]], { fill: 'rgba(66,153,225,0.22)', stroke: C.cool, lw: 1.8, close: true });
    polyView(f, v, [A, D, [-b, b], [-b, 0]], { fill: 'rgba(72,187,120,0.22)', stroke: C.green, lw: 1.8, close: true });
    const nx = (D[1] - B[1]) / c;
    const ny = (B[0] - D[0]) / c;
    polyView(f, v, [B, D, [D[0] + nx * c, D[1] + ny * c], [B[0] + nx * c, B[1] + ny * c]], {
      fill: 'rgba(245,101,101,0.2)',
      stroke: C.hot,
      lw: 1.8,
      close: true,
    });

    text(f, `a² = ${a * a}`, v.sx(a / 2), v.sy(-a / 2), { align: 'center', color: C.cool, font: '13px sans-serif' });
    text(f, `b² = ${b * b}`, v.sx(-b / 2), v.sy(b / 2), { align: 'center', color: C.green, font: '13px sans-serif' });
    text(f, `c² = ${(c * c).toFixed(2)}`, v.sx((B[0] + D[0]) / 2 + nx * c * 0.55), v.sy((B[1] + D[1]) / 2 + ny * c * 0.55), { align: 'center', color: C.hot, font: '13px sans-serif' });
    text(f, `a=${a}`, v.sx(a / 2), v.sy(0) - 8, { align: 'center', color: C.fg, font: '12px sans-serif' });
    text(f, `b=${b}`, v.sx(0) - 10, v.sy(b / 2), { align: 'right', color: C.fg, font: '12px sans-serif' });

    footnotes(f, [
      `${a}² + ${b}² = ${a * a} + ${b * b} = ${a * a + b * b} = c²，c = √${a * a + b * b} = ${c.toFixed(5)}`,
      '两个小正方形的面积之和正好等于斜边上的大正方形面积',
      '勾股定理有 400 多种证明，这是最直观的"面积拼接"证法',
    ]);
    heading(f, '勾股定理：面积拼接');
  },
});

/** I26 三角形中心。 */
const triangleCenters = defineViz({
  slug: 'triangle-centers',
  title: '三角形中心',
  params: {
    apex: { type: 'range', min: -2, max: 5, default: 3.5, step: 0.5, label: '顶点 C 高度' },
    skew: { type: 'range', min: -4, max: 4, default: 1, step: 0.5, label: '顶点 C 水平偏移' },
    show: { type: 'select', options: ['全部', '外心与内切圆', '重心与中线'], default: '全部', label: '显示' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const apex = num(params, 'apex', 3.5);
    const skew = num(params, 'skew', 1);
    const show = str(params, 'show', '全部');
    const A: [number, number] = [-4, -2];
    const B: [number, number] = [4, -1.5];
    const Cc: [number, number] = [skew, apex];
    const v = equalView(f, 0, (apex - 3) / 2, 8);

    // 外心与内切圆
    const d = 2 * (A[0] * (B[1] - Cc[1]) + B[0] * (Cc[1] - A[1]) + Cc[0] * (A[1] - B[1]));
    const ux = ((A[0] ** 2 + A[1] ** 2) * (B[1] - Cc[1]) + (B[0] ** 2 + B[1] ** 2) * (Cc[1] - A[1]) + (Cc[0] ** 2 + Cc[1] ** 2) * (A[1] - B[1])) / d;
    const uy = ((A[0] ** 2 + A[1] ** 2) * (Cc[0] - B[0]) + (B[0] ** 2 + B[1] ** 2) * (A[0] - Cc[0]) + (Cc[0] ** 2 + Cc[1] ** 2) * (B[0] - A[0])) / d;
    const centroid: [number, number] = [(A[0] + B[0] + Cc[0]) / 3, (A[1] + B[1] + Cc[1]) / 3];
    const ortho: [number, number] = [A[0] + B[0] + Cc[0] - 2 * ux, A[1] + B[1] + Cc[1] - 2 * uy];
    const sideA = Math.hypot(B[0] - Cc[0], B[1] - Cc[1]);
    const sideB = Math.hypot(A[0] - Cc[0], A[1] - Cc[1]);
    const sideC = Math.hypot(A[0] - B[0], A[1] - B[1]);
    const perim = sideA + sideB + sideC;
    const incenter: [number, number] = [
      (sideA * A[0] + sideB * B[0] + sideC * Cc[0]) / perim,
      (sideA * A[1] + sideB * B[1] + sideC * Cc[1]) / perim,
    ];
    const area = Math.abs((B[0] - A[0]) * (Cc[1] - A[1]) - (Cc[0] - A[0]) * (B[1] - A[1])) / 2;
    const inRadius = area / (perim / 2);

    polyView(f, v, [A, B, Cc], { fill: 'rgba(102,126,234,0.12)', stroke: C.accent, lw: 2, close: true });
    const unit = v.sx(1) - v.sx(0);

    if (show === '全部' || show === '外心与内切圆') {
      circle(f, v.sx(ux), v.sy(uy), Math.hypot(A[0] - ux, A[1] - uy) * unit, { stroke: 'rgba(66,153,225,0.45)', lw: 1.4 });
      circle(f, v.sx(incenter[0]), v.sy(incenter[1]), inRadius * unit, { stroke: 'rgba(72,187,120,0.6)', lw: 1.4 });
      dot(f, v.sx(ux), v.sy(uy), 5, C.cool);
      text(f, '外心', v.sx(ux) + 7, v.sy(uy) - 6, { color: C.cool, font: '12px sans-serif' });
      dot(f, v.sx(incenter[0]), v.sy(incenter[1]), 5, C.green);
      text(f, '内心', v.sx(incenter[0]) + 7, v.sy(incenter[1]) + 12, { color: C.green, font: '12px sans-serif' });
    }
    if (show === '全部' || show === '重心与中线') {
      for (const [p, q] of [[A, [(B[0] + Cc[0]) / 2, (B[1] + Cc[1]) / 2]], [B, [(A[0] + Cc[0]) / 2, (A[1] + Cc[1]) / 2]], [Cc, [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]]] as Array<[[number, number], [number, number]]>) {
        seg(f, v.sx(p[0]), v.sy(p[1]), v.sx(q[0]), v.sy(q[1]), 'rgba(237,137,54,0.6)', 1.2);
      }
      dot(f, v.sx(centroid[0]), v.sy(centroid[1]), 5.5, C.warm);
      text(f, '重心', v.sx(centroid[0]) + 7, v.sy(centroid[1]) + 14, { color: C.warm, font: '12px sans-serif' });
    }
    dot(f, v.sx(ortho[0]), v.sy(ortho[1]), 5, C.hot);
    text(f, '垂心', v.sx(ortho[0]) + 7, v.sy(ortho[1]) - 6, { color: C.hot, font: '12px sans-serif' });

    footnotes(f, [
      '外心（三边垂直平分线交点，外接圆圆心）、内心（角平分线交点，内切圆圆心）',
      '重心（三条中线交点）把每条中线分成 2:1；垂心是三条高的交点',
      `面积 = ${area.toFixed(3)}，内切圆半径 r = 面积/半周长 = ${inRadius.toFixed(4)}`,
    ]);
    heading(f, '三角形的四个心');
  },
});

/** I27 凸包。 */
const convexHull = defineViz({
  slug: 'convex-hull',
  title: '凸包',
  params: {
    points: { type: 'range', min: 6, max: 60, default: 24, label: '点数量' },
    seed: { type: 'range', min: 1, max: 20, default: 7, label: '随机种子' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'points', 24));
    const seed = Math.round(num(params, 'seed', 7));
    const rand = rng(seed);
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < n; i++) {
      pts.push([rand() * 2 - 1, rand() * 2 - 1]);
    }
    // Graham 扫描
    const sorted = [...pts].sort((p, q) => (p[0] === q[0] ? p[1] - q[1] : p[0] - q[0]));
    const cross = (o: [number, number], a: [number, number], b: [number, number]): number =>
      (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower: Array<[number, number]> = [];
    for (const p of sorted) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper: Array<[number, number]> = [];
    for (const p of [...sorted].reverse()) {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];

    const v = equalView(f, 0, 0, 1.16);
    polyView(f, v, hull, { fill: 'rgba(102,126,234,0.13)', stroke: C.accent, lw: 2.2, close: true });
    pts.forEach((p) => dot(f, v.sx(p[0]), v.sy(p[1]), 3.2, C.dim));
    hull.forEach((p) => dot(f, v.sx(p[0]), v.sy(p[1]), 4.6, C.warm));

    // 面积（Shoelace）
    let area = 0;
    for (let i = 0; i < hull.length; i++) {
      const p = hull[i];
      const q = hull[(i + 1) % hull.length];
      area += p[0] * q[1] - q[0] * p[1];
    }
    area = Math.abs(area) / 2;

    footnotes(f, [
      `${n} 个点中有 ${hull.length} 个落在凸包边界上（橙色）`,
      `Graham 扫描：按极角排序后单调栈，把"右转"的点弹出，复杂度 O(n log n)`,
      `凸包面积 = ${area.toFixed(4)}（单位正方形内的归一化坐标）`,
    ]);
    heading(f, '凸包：包住所有点的最小凸多边形');
  },
});

/** I28 旋转卡尺。 */
const rotatingCalipers = defineViz({
  slug: 'rotating-calipers',
  title: '旋转卡尺',
  params: {
    width: { type: 'range', min: 3, max: 10, default: 6, label: '多边形宽度' },
    height: { type: 'range', min: 2, max: 8, default: 4, label: '多边形高度' },
    angle: { type: 'range', min: 0, max: 180, default: 35, label: '卡尺角度(°)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const mw = num(params, 'width', 6);
    const mh = num(params, 'height', 4);
    const deg = num(params, 'angle', 35);
    const rad = (deg * Math.PI) / 180;
    const v = equalView(f, 0, 0, Math.max(mw, mh) * 0.8);

    // 旋转后的矩形
    const corners: Array<[number, number]> = [[-mw / 2, -mh / 2], [mw / 2, -mh / 2], [mw / 2, mh / 2], [-mw / 2, mh / 2]];
    const rot = corners.map(([x, y]) => [x * Math.cos(rad) - y * Math.sin(rad), x * Math.sin(rad) + y * Math.cos(rad)] as [number, number]);
    polyView(f, v, rot, { fill: 'rgba(102,126,234,0.18)', stroke: C.accent, lw: 2, close: true });
    rot.forEach((p) => dot(f, v.sx(p[0]), v.sy(p[1]), 3.5, C.warm));

    // 卡尺：两对平行支撑线
    const dir: [number, number] = [Math.cos(rad), Math.sin(rad)];
    const norm: [number, number] = [-dir[1], dir[0]];
    const projNorm = rot.map((p) => p[0] * norm[0] + p[1] * norm[1]);
    const projDir = rot.map((p) => p[0] * dir[0] + p[1] * dir[1]);
    const minN = Math.min(...projNorm);
    const maxN = Math.max(...projNorm);
    const minD = Math.min(...projDir);
    const maxD = Math.max(...projDir);

    const lineAt = (offset: number, along: boolean, color: string): void => {
      const base: [number, number] = along
        ? [dir[0] * offset - norm[0] * 20, dir[1] * offset - norm[1] * 20]
        : [norm[0] * offset - dir[0] * 20, norm[1] * offset - dir[1] * 20];
      const end: [number, number] = along
        ? [dir[0] * offset + norm[0] * 20, dir[1] * offset + norm[1] * 20]
        : [norm[0] * offset + dir[0] * 20, norm[1] * offset + dir[1] * 20];
      // 截断到视图范围
      const clamp = (p: [number, number]): [number, number] => [
        Math.max(v.xMin, Math.min(v.xMax, p[0])),
        Math.max(v.yMin, Math.min(v.yMax, p[1])),
      ];
      const a = clamp(base);
      const b2 = clamp(end);
      seg(f, v.sx(a[0]), v.sy(a[1]), v.sx(b2[0]), v.sy(b2[1]), color, 1.6);
    };
    lineAt(minN, false, C.hot);
    lineAt(maxN, false, C.hot);
    lineAt(minD, true, C.green);
    lineAt(maxD, true, C.green);

    const width = maxN - minN;
    const diam = maxD - minD;
    footnotes(f, [
      `卡尺方向 ${deg}°：法向宽度 = ${width.toFixed(4)}，同向跨度 = ${diam.toFixed(4)}`,
      '旋转卡尺绕凸多边形转动，用对踵点对同时求出最小宽度、最大直径等量',
      '全部方向的最小宽度就是多边形的"宽度"；任意方向的最大跨度给出直径',
    ]);
    heading(f, '旋转卡尺：用平行线夹住多边形');
  },
});

/** I29 耳切法。 */
const earClipping = defineViz({
  slug: 'ear-clipping',
  title: '耳切法',
  params: {
    sides: { type: 'range', min: 4, max: 9, default: 6, label: '多边形边数' },
    irregular: { type: 'range', min: 0, max: 60, default: 25, label: '不规则度(%)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const sides = Math.round(num(params, 'sides', 6));
    const irregular = num(params, 'irregular', 25) / 100;
    const rand = rng(sides * 13 + 5);
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const r = 1 - irregular * rand();
      pts.push([r * Math.cos(a), r * Math.sin(a)]);
    }

    // 耳切：不断切掉"耳朵"三角形
    const indices = pts.map((_, i) => i);
    const triangles: Array<[number, number, number]> = [];
    const isConvex = (a: number, b: number, c: number): boolean => {
      const p = pts[a];
      const q = pts[b];
      const r = pts[c];
      return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]) > 0;
    };
    let guard = 0;
    while (indices.length > 3 && guard++ < 60) {
      let clipped = false;
      for (let i = 0; i < indices.length; i++) {
        const a = indices[(i - 1 + indices.length) % indices.length];
        const b = indices[i];
        const c = indices[(i + 1) % indices.length];
        if (isConvex(a, b, c)) {
          triangles.push([a, b, c]);
          indices.splice(i, 1);
          clipped = true;
          break;
        }
      }
      if (!clipped) break;
    }
    if (indices.length === 3) triangles.push([indices[0], indices[1], indices[2]]);

    const v = equalView(f, 0, 0, 1.3);
    triangles.forEach((tri, i) => {
      polyView(f, v, [pts[tri[0]], pts[tri[1]], pts[tri[2]]], {
        fill: `${PALETTE[i % PALETTE.length]}55`,
        stroke: PALETTE[i % PALETTE.length],
        lw: 1.2,
        close: true,
      });
    });
    polyView(f, v, pts, { stroke: C.fg, lw: 2, close: true });

    footnotes(f, [
      `${sides} 边形被剖分成 ${triangles.length} 个三角形（任意 n 边形都能剖成 n-2 个三角形）`,
      '耳切法：每次找一个"耳朵"（凸顶点且三角形内不含其他顶点）切掉，直到只剩三角形',
      '三角剖分是图形渲染、有限元分析、点定位的通用前置步骤',
    ]);
    heading(f, '耳切法：多边形三角剖分');
  },
});

/** I30 定宽曲线（鲁洛三角形）。 */
const reuleaux = defineViz({
  slug: 'reuleaux',
  title: '圆内接四边形',
  params: {
    sides: { type: 'range', min: 3, max: 11, default: 3, label: '边数（奇数）' },
    angle: { type: 'range', min: 0, max: 180, default: 0, label: '卡尺角度(°)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    let sides = Math.round(num(params, 'sides', 3));
    if (sides % 2 === 0) sides += 1;
    sides = Math.max(3, Math.min(11, sides));
    const deg = num(params, 'angle', 0);
    const rad = (deg * Math.PI) / 180;
    const R = 1;

    // 顶点
    const verts: Array<[number, number]> = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
      verts.push([R * Math.cos(a), R * Math.sin(a)]);
    }
    const v = equalView(f, 0, 0, 1.35);
    // 圆弧：以顶点 p_i 为圆心、以到 p_{i+1} 的距离为半径，从 p_{i+1} 扫到 p_{i+2}
    for (let i = 0; i < sides; i++) {
      const p = verts[i];
      const mid = verts[(i + 1) % sides];
      const next = verts[(i + 2) % sides];
      const radius = Math.hypot(mid[0] - p[0], mid[1] - p[1]);
      const a1 = Math.atan2(mid[1] - p[1], mid[0] - p[0]);
      const a2 = Math.atan2(next[1] - p[1], next[0] - p[0]);
      let delta = a2 - a1;
      while (delta < 0) delta += Math.PI * 2;
      const arcPts: Array<[number, number]> = [];
      for (let k = 0; k <= 48; k++) {
        const a = a1 + (delta * k) / 48;
        arcPts.push([v.sx(p[0] + radius * Math.cos(a)), v.sy(p[1] + radius * Math.sin(a))]);
      }
      poly(f, arcPts, { stroke: C.accent, lw: 2.4 });
    }
    dot(f, v.sx(0), v.sy(0), 3, C.dim);

    // 两条平行支撑线（宽度与方向无关）
    const d: [number, number] = [Math.cos(rad), Math.sin(rad)];
    const nrm: [number, number] = [-d[1], d[0]];
    const proj: Array<number> = [];
    for (let i = 0; i < 3600; i++) {
      const a = (i / 3600) * Math.PI * 2;
      const px = R * Math.cos(a);
      const py = R * Math.sin(a);
      proj.push(px * nrm[0] + py * nrm[1]);
    }
    const minP = Math.min(...proj);
    const maxP = Math.max(...proj);
    const drawLine = (offset: number): void => {
      const a: [number, number] = [nrm[0] * offset - d[0] * 1.6, nrm[1] * offset - d[1] * 1.6];
      const b: [number, number] = [nrm[0] * offset + d[0] * 1.6, nrm[1] * offset + d[1] * 1.6];
      seg(f, v.sx(a[0]), v.sy(a[1]), v.sx(b[0]), v.sy(b[1]), C.hot, 1.6);
    };
    drawLine(minP);
    drawLine(maxP);

    footnotes(f, [
      `${sides} 边形生成的定宽曲线：${sides === 3 ? '鲁洛三角形（Reuleaux）' : `${sides} 边定宽曲线`}`,
      `卡尺角度 ${deg}°：宽度 = ${(maxP - minP).toFixed(4)}，与方向无关（定宽性质）`,
      '定宽曲线可以直接"滚动"而不会上下颠簸；鲁洛三角形还是钻方孔的工具（转子发动机也用类似形状）',
    ]);
    heading(f, '定宽曲线：宽度处处相等');
  },
});

/** I31 圆堆积。 */
const circlePacking = defineViz({
  slug: 'circle-packing',
  title: '圆堆积',
  params: {
    layers: { type: 'range', min: 1, max: 8, default: 4, label: '层数' },
    mode: { type: 'select', options: ['六角堆积', '方形堆积'], default: '六角堆积', label: '排列方式' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const layers = Math.round(num(params, 'layers', 4));
    const mode = str(params, 'mode', '六角堆积');
    const r = 0.55 / (2 * layers + 1);
    const v = equalView(f, 0, 0, 0.64);
    let count = 0;

    if (mode === '方形堆积') {
      for (let i = -layers; i <= layers; i++) {
        for (let j = -layers; j <= layers; j++) {
          const cx = i * 2 * r;
          const cy = j * 2 * r;
          if (Math.hypot(cx, cy) > 0.55) continue;
          circle(f, v.sx(cx), v.sy(cy), r * (v.sx(1) - v.sx(0)), { fill: 'rgba(102,126,234,0.35)', stroke: C.accent, lw: 1 });
          count++;
        }
      }
    } else {
      for (let j = -layers; j <= layers; j++) {
        for (let i = -layers; i <= layers; i++) {
          const cx = i * 2 * r + (j % 2 === 0 ? 0 : r);
          const cy = j * Math.sqrt(3) * r;
          if (Math.hypot(cx, cy) > 0.55) continue;
          circle(f, v.sx(cx), v.sy(cy), r * (v.sx(1) - v.sx(0)), { fill: 'rgba(72,187,120,0.35)', stroke: C.green, lw: 1 });
          count++;
        }
      }
    }

    footnotes(f, [
      `${mode}共 ${count} 个圆；六角堆积的密度是 π/(2√3) ≈ 90.69%（开普勒猜想的最优值）`,
      '方形堆积的密度只有 π/4 ≈ 78.54% —— 同样的空间能装下更多圆',
      '开普勒猜想（三维球的堆积密度）直到 1998 年才由 Thomas Hales 借助计算机证明',
    ]);
    heading(f, '圆堆积与最密排列');
  },
});

/** I32 斯坦纳链。 */
const steinerChain = defineViz({
  slug: 'steiner-chain',
  title: '斯坦纳链',
  params: {
    n: { type: 'range', min: 3, max: 12, default: 6, label: '链条圆的数量' },
    inner: { type: 'range', min: 0.2, max: 0.6, default: 0.35, step: 0.05, label: '内圆半径比' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'n', 6));
    const innerR = num(params, 'inner', 0.35);
    const outerR = 1;
    const midR = (outerR + innerR) / 2;
    const chainR = (outerR - innerR) / 2;
    const v = equalView(f, 0, 0, 1.22);
    const unit = v.sx(1) - v.sx(0);

    circle(f, v.sx(0), v.sy(0), outerR * unit, { stroke: C.accent, lw: 2 });
    circle(f, v.sx(0), v.sy(0), innerR * unit, { stroke: C.warm, lw: 2 });

    // 链条圆心位于半径 midR 的圆上，均匀分布（示意：真实斯坦纳链有严格存在条件）
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const cx = midR * Math.cos(a);
      const cy = midR * Math.sin(a);
      circle(f, v.sx(cx), v.sy(cy), chainR * unit, { fill: 'rgba(72,187,120,0.25)', stroke: C.green, lw: 1.6 });
      dot(f, v.sx(cx), v.sy(cy), 2.5, C.green);
    }
    circle(f, v.sx(0), v.sy(0), midR * unit, { stroke: 'rgba(226,232,240,0.25)', lw: 1, dash: [4, 4] });

    footnotes(f, [
      `${n} 个圆依次相切，同时内切于外圆、外切于内圆 —— 构成斯坦纳链`,
      `链条圆半径 = (R - r)/2 = ${chainR.toFixed(3)}，圆心轨迹半径 = (R + r)/2 = ${midR.toFixed(3)}`,
      '当链条首尾也相切（闭合）时，中间任取一个相切圆都能生成同长度的链 —— 这是反演变换的经典应用',
    ]);
    heading(f, '斯坦纳链');
  },
});

/** I33 笛卡尔缺陷（球面三角形）。 */
const descartesDefect = defineViz({
  slug: 'descartes-defect',
  title: '笛卡尔缺陷',
  params: {
    a: { type: 'range', min: 40, max: 140, default: 80, label: '球面角 A(°)' },
    b: { type: 'range', min: 40, max: 140, default: 70, label: '球面角 B(°)' },
    c: { type: 'range', min: 40, max: 140, default: 90, label: '球面角 C(°)' },
  },
  draw: (f) => {
    const { ctx, w, h, params } = f;
    const A = num(params, 'a', 80);
    const B = num(params, 'b', 70);
    const Cc = num(params, 'c', 90);
    const sum = A + B + Cc;
    const defect = sum - 180;
    const v = equalView(f, 0, 0.05, 1.25);
    const unit = v.sx(1) - v.sx(0);

    // 球体示意（圆 + 纬线增强立体感）
    circle(f, v.sx(0), v.sy(0), 1 * unit, { fill: 'rgba(45,55,72,0.9)', stroke: C.dim, lw: 1.5 });
    for (let i = -3; i <= 3; i++) {
      const y = i / 4;
      const rx = Math.sqrt(Math.max(0, 1 - y * y));
      ctx.save();
      ctx.strokeStyle = 'rgba(113,128,150,0.35)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(v.sx(0), v.sy(y), rx * unit, rx * unit * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 球面三角形（把内角映射成球面上的弧）
    const rad = (x: number): number => (x * Math.PI) / 180;
    const angleSum = rad(A) + rad(B) + rad(Cc);
    const verts: Array<[number, number]> = [];
    let acc = 0;
    for (const ang of [rad(A), rad(B), rad(Cc)]) {
      acc += (ang / angleSum) * Math.PI * 2;
      verts.push([Math.cos(acc) * 0.72, Math.sin(acc) * 0.72]);
    }
    ctx.save();
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const p = verts[i];
      const q = verts[(i + 1) % 3];
      const mx = (p[0] + q[0]) / 2 * 1.16;
      const my = (p[1] + q[1]) / 2 * 1.16;
      if (i === 0) ctx.moveTo(v.sx(p[0]), v.sy(p[1]));
      ctx.quadraticCurveTo(v.sx(mx), v.sy(my), v.sx(q[0]), v.sy(q[1]));
    }
    ctx.stroke();
    ctx.restore();
    verts.forEach((p) => dot(f, v.sx(p[0]), v.sy(p[1]), 4, C.warm));

    footnotes(f, [
      `球面三角形内角 A=${A}°, B=${B}°, C=${Cc}°，内角和 = ${sum}°`,
      `球面盈余（笛卡尔缺陷）= ${sum}° - 180° = ${defect.toFixed(1)}°`,
      '球面三角形的内角和总是大于 180°，缺陷角正比于所围的球面面积：面积 = 缺陷 × R²',
    ]);
    heading(f, '笛卡尔缺陷：球面上的三角形');
  },
});

/** I34 德恩不变量。 */
const dehnInvariant = defineViz({
  slug: 'dehn-invariant',
  title: '德恩不变量',
  params: {
    side: { type: 'range', min: 2, max: 8, default: 4, label: '正方形边长' },
    shape: { type: 'select', options: ['等边三角形', '正方形', '正五边形'], default: '等边三角形', label: '对比图形' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const side = num(params, 'side', 4);
    const shape = str(params, 'shape', '等边三角形');

    const polyArea = (n: number, s: number): number => (n * s * s) / (4 * Math.tan(Math.PI / n));
    const n = shape === '等边三角形' ? 3 : shape === '正五边形' ? 5 : 4;
    const targetArea = side * side;
    // 与正方形等面积的正 n 边形边长
    const s2 = Math.sqrt((4 * targetArea * Math.tan(Math.PI / n)) / n);
    const v = equalView(f, 0, 0, side * 0.78);

    polyView(f, v, [[-side / 2, -side / 2], [side / 2, -side / 2], [side / 2, side / 2], [-side / 2, side / 2]], {
      fill: 'rgba(102,126,234,0.2)',
      stroke: C.accent,
      lw: 2,
      close: true,
    });
    text(f, `正方形 面积 ${targetArea}`, v.sx(0), v.sy(-side / 2) - 12, { align: 'center', color: C.accent, font: '12px sans-serif' });

    const pts: Array<[number, number]> = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      pts.push([side / 2 + 1.2 + (s2 / 2) * Math.cos(a), (s2 / 2) * Math.sin(a)]);
    }
    polyView(f, v, pts, { fill: 'rgba(245,101,101,0.2)', stroke: C.hot, lw: 2, close: true });
    text(f, `${shape} 面积 ${polyArea(n, s2).toFixed(3)}`, v.sx(side / 2 + 1.2), v.sy(-s2 / 2) - 12, { align: 'center', color: C.hot, font: '12px sans-serif' });

    const dehn = n === 3 ? '非零（含 √3 的有理线性组合）' : n === 5 ? '非零（含 √5 类项）' : '零（同为矩形可拼）';
    footnotes(f, [
      `两个图形面积相等（都是 ${targetArea}），但德恩不变量：${dehn}`,
      '德恩不变量是"边长与 π 的有理线性组合"模去特定关系的量，等面积剪拼必须保持它不变',
      '希尔伯特第三问题（1900）：等体积的多面体是否总能剪拼？答案是否 —— 德恩不变量给出反例',
    ]);
    heading(f, '德恩不变量：为什么等面积也未必能剪拼');
  },
});

registerViz(
  pythagorean,
  triangleCenters,
  convexHull,
  rotatingCalipers,
  earClipping,
  reuleaux,
  circlePacking,
  steinerChain,
  descartesDefect,
  dehnInvariant,
);
