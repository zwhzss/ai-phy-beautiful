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
  rng,
  seg,
  text,
  view,
} from '../canvas';

/** 生成一组确定性散点（归一化到 [0,1]²）。 */
function scatterPoints(n: number, seed: number): Array<[number, number]> {
  const rand = rng(seed);
  return Array.from({ length: n }, () => [rand(), rand()] as [number, number]);
}

/** I62 KD 树。 */
const kdTree = defineViz({
  slug: 'kd-tree',
  title: 'KD树',
  params: {
    points: { type: 'range', min: 4, max: 40, default: 16, label: '点数量' },
    depth: { type: 'range', min: 1, max: 5, default: 3, label: '展示深度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'points', 16));
    const maxDepth = Math.round(num(params, 'depth', 3));
    const pts = scatterPoints(n, 5150);
    const v = equalView(f, 0.5, 0.5, 0.56, 40, 0.56);

    // 递归分割：偶数层切 x，奇数层切 y
    const lines: Array<{ kind: 'v' | 'h'; at: number; from: number; to: number; depth: number }> = [];
    const build = (subset: Array<[number, number]>, depth: number, bounds: [number, number, number, number]): void => {
      if (subset.length <= 1 || depth >= maxDepth) return;
      const axis = depth % 2 === 0 ? 0 : 1;
      const sorted = [...subset].sort((a, b) => a[axis] - b[axis]);
      const mid = sorted[Math.floor(sorted.length / 2)];
      const [x0, y0, x1, y1] = bounds;
      if (axis === 0) {
        lines.push({ kind: 'v', at: mid[0], from: y0, to: y1, depth });
        build(subset.filter((p) => p[0] < mid[0]), depth + 1, [x0, y0, mid[0], y1]);
        build(subset.filter((p) => p[0] >= mid[0]), depth + 1, [mid[0], y0, x1, y1]);
      } else {
        lines.push({ kind: 'h', at: mid[1], from: x0, to: x1, depth });
        build(subset.filter((p) => p[1] < mid[1]), depth + 1, [x0, y0, x1, mid[1]]);
        build(subset.filter((p) => p[1] >= mid[1]), depth + 1, [x0, mid[1], x1, y1]);
      }
    };
    build(pts, 0, [0, 0, 1, 1]);

    lines.forEach((l) => {
      const color = `${PALETTE[l.depth % PALETTE.length]}aa`;
      if (l.kind === 'v') seg(f, v.sx(l.at), v.sy(l.from), v.sx(l.at), v.sy(l.to), color, 1.6);
      else seg(f, v.sx(l.from), v.sy(l.at), v.sx(l.to), v.sy(l.at), color, 1.6);
    });
    pts.forEach((p) => dot(f, v.sx(p[0]), v.sy(p[1]), 3.4, C.fg));

    footnotes(f, [
      `${n} 个点被 ${lines.length} 条分割线切成若干矩形区域（颜色代表深度）`,
      'KD 树每层沿一个维度取中位数切分，因此是平衡的；查询时只需访问少数子树',
      'k 维最近邻查询平均 O(log n)，是点云处理、光线追踪加速结构的原型',
    ]);
    heading(f, 'KD 树：递归轴对齐分割');
  },
});

/** I63 Voronoi 图。 */
const voronoi = defineViz({
  slug: 'voronoi',
  title: 'Voronoi 图',
  params: {
    sites: { type: 'range', min: 3, max: 20, default: 10, label: '站点数' },
    resolution: { type: 'range', min: 3, max: 12, default: 6, label: '像素块大小' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const siteCount = Math.round(num(params, 'sites', 10));
    const res = Math.round(num(params, 'resolution', 6));
    const sites = scatterPoints(siteCount, 31415);
    const ox = 40;
    const oy = 50;
    const iw = w - 80;
    const ih = h - 130;

    // 逐块计算最近站点
    for (let px = 0; px < iw; px += res) {
      for (let py = 0; py < ih; py += res) {
        const x = px / iw;
        const y = py / ih;
        let best = 0;
        let bestD = Infinity;
        sites.forEach((s, i) => {
          const dd = (s[0] - x) ** 2 + (s[1] - y) ** 2;
          if (dd < bestD) {
            bestD = dd;
            best = i;
          }
        });
        f.ctx.save();
        f.ctx.fillStyle = `${PALETTE[best % PALETTE.length]}55`;
        f.ctx.fillRect(ox + px, oy + py, res - 0.5, res - 0.5);
        f.ctx.restore();
      }
    }
    sites.forEach((s, i) => {
      const x = ox + s[0] * iw;
      const y = oy + s[1] * ih;
      dot(f, x, y, 5, PALETTE[i % PALETTE.length]);
      text(f, String(i), x + 7, y - 5, { color: C.fg, font: '11px sans-serif' });
    });

    footnotes(f, [
      `${siteCount} 个站点把平面划分成各自的"最近邻区域"（Voronoi 胞腔）`,
      '胞腔内部到本站点的距离比到任何其他站点都近；胞腔边界是两站点连线的中垂线',
      'Voronoi 图与 Delaunay 三角剖分互为对偶，广泛用于设施选址、无线覆盖、纹理生成',
    ]);
    heading(f, 'Voronoi 图：最近邻区域划分');
  },
});

/** I64 Delaunay 三角剖分。 */
const delaunayTriangulation = defineViz({
  slug: 'delaunay-triangulation',
  title: 'Delaunay三角剖分',
  params: {
    points: { type: 'range', min: 5, max: 30, default: 14, label: '点数量' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const count = Math.round(num(params, 'points', 14));
    const pts = scatterPoints(count, 2718);
    const v = equalView(f, 0.5, 0.5, 0.56, 40, 0.56);

    // Bowyer-Watson 增量算法
    const px = pts.map(([x, y]) => [v.sx(x), v.sy(y)] as [number, number]);
    interface Tri { a: number; b: number; c: number }
    const circum = (a: number, b: number, c: number): [number, number, number] => {
      const ax = px[a][0];
      const ay = px[a][1];
      const bx = px[b][0];
      const by = px[b][1];
      const cx = px[c][0];
      const cy = px[c][1];
      const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
      const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
      const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
      return [ux, uy, Math.hypot(ax - ux, ay - uy)];
    };
    const inCircum = (t: Tri, p: [number, number]): boolean => {
      const [ux, uy, r] = circum(t.a, t.b, t.c);
      if (!Number.isFinite(r)) return false;
      return Math.hypot(p[0] - ux, p[1] - uy) < r - 0.01;
    };

    const superIdx = [count, count + 1, count + 2];
    const big = 4000;
    px.push([-big, -big], [big, -big], [0, big]);
    let tris: Tri[] = [{ a: superIdx[0], b: superIdx[1], c: superIdx[2] }];
    for (let i = 0; i < count; i++) {
      const bad = tris.filter((t) => inCircum(t, px[i]));
      const edges: Array<[number, number]> = [];
      for (const t of bad) {
        edges.push([t.a, t.b], [t.b, t.c], [t.c, t.a]);
      }
      const boundary = edges.filter(([a, b]) =>
        edges.filter(([c, d]) => (c === b && d === a)).length === 0);
      tris = tris.filter((t) => !bad.includes(t));
      for (const [a, b] of boundary) tris.push({ a, b, c: i });
    }
    tris = tris.filter((t) => t.a < count && t.b < count && t.c < count);

    tris.forEach((t) => {
      poly(f, [px[t.a], px[t.b], px[t.c]], { fill: 'rgba(102,126,234,0.12)', stroke: C.accent, lw: 1.2, close: true });
    });
    pts.forEach((p) => dot(f, v.sx(p[0]), v.sy(p[1]), 3.6, C.warm));

    footnotes(f, [
      `${count} 个点剖分成 ${tris.length} 个三角形（Bowyer-Watson 增量构造）`,
      '核心性质（空圆）：每个三角形的外接圆内不含其他点 —— 这保证了三角形尽量"匀称"',
      'Delaunay 三角剖分让最小角最大化，是有限元网格、地形建模、Voronoi 对偶的标准工具',
    ]);
    heading(f, 'Delaunay 三角剖分');
  },
});

/** I65 点在多边形内。 */
const pointInPolygon = defineViz({
  slug: 'point-in-polygon',
  title: '点在多边形内',
  params: {
    x: { type: 'range', min: 0.05, max: 0.95, default: 0.44, step: 0.01, label: '测试点 x' },
    y: { type: 'range', min: 0.05, max: 0.95, default: 0.55, step: 0.01, label: '测试点 y' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const px0 = num(params, 'x', 0.44);
    const py0 = num(params, 'y', 0.55);
    const shape: Array<[number, number]> = [
      [0.18, 0.2], [0.55, 0.1], [0.85, 0.3], [0.75, 0.7], [0.42, 0.88], [0.15, 0.6],
    ];
    const v = equalView(f, 0.5, 0.5, 0.56, 40, 0.56);
    poly(f, shape.map(([x, y]) => [v.sx(x), v.sy(y)] as [number, number]), {
      fill: 'rgba(102,126,234,0.16)',
      stroke: C.accent,
      lw: 2,
      close: true,
    });

    // 射线法：向右发射水平射线，数交点
    let crossings = 0;
    const intersections: Array<[number, number]> = [];
    for (let i = 0; i < shape.length; i++) {
      const [x1, y1] = shape[i];
      const [x2, y2] = shape[(i + 1) % shape.length];
      if ((y1 > py0) !== (y2 > py0)) {
        const t = (py0 - y1) / (y2 - y1);
        const xi = x1 + t * (x2 - x1);
        if (xi > px0) {
          crossings++;
          intersections.push([xi, py0]);
        }
      }
    }
    seg(f, v.sx(px0), v.sy(py0), v.sx(1.02), v.sy(py0), C.green, 1.6);
    dot(f, v.sx(px0), v.sy(py0), 5.5, crossings % 2 === 1 ? C.green : C.hot);
    intersections.forEach(([ix, iy]) => dot(f, v.sx(ix), v.sy(iy), 4, C.warm));

    footnotes(f, [
      `射线与多边形边界相交 ${crossings} 次 → 点在多边形${crossings % 2 === 1 ? '内部' : '外部'}`,
      '射线法（奇偶规则）：交点数为奇数则在内部；橙色点是交点位置',
      '另一种判定是绕数（winding number），能区分自相交多边形的"洞"与重叠区域',
    ]);
    heading(f, '点在多边形内：射线法');
  },
});

/** I66 线段裁剪。 */
const lineClipping = defineViz({
  slug: 'line-clipping',
  title: '线段裁剪',
  params: {
    x1: { type: 'range', min: -3, max: 3, default: -2.4, step: 0.1, label: '起点 x₁' },
    y1: { type: 'range', min: -2, max: 2, default: 1.6, step: 0.1, label: '起点 y₁' },
    x2: { type: 'range', min: -3, max: 3, default: 2.8, step: 0.1, label: '终点 x₂' },
    y2: { type: 'range', min: -2, max: 2, default: -1.4, step: 0.1, label: '终点 y₂' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    let x1 = num(params, 'x1', -2.4);
    let y1 = num(params, 'y1', 1.6);
    let x2 = num(params, 'x2', 2.8);
    let y2 = num(params, 'y2', -1.4);
    const xmin = -1.5;
    const xmax = 1.5;
    const ymin = -1;
    const ymax = 1;
    const v = equalView(f, 0, 0, 3.4, 40, 2.4);

    // Cohen-Sutherland
    const code = (x: number, y: number): number => {
      let c = 0;
      if (x < xmin) c |= 1;
      else if (x > xmax) c |= 2;
      if (y < ymin) c |= 4;
      else if (y > ymax) c |= 8;
      return c;
    };
    const orig: [number, number, number, number] = [x1, y1, x2, y2];
    let c1 = code(x1, y1);
    let c2 = code(x2, y2);
    let accepted = false;
    let iterations = 0;
    while (iterations++ < 20) {
      if ((c1 | c2) === 0) {
        accepted = true;
        break;
      }
      if ((c1 & c2) !== 0) break;
      const cOut = c1 !== 0 ? c1 : c2;
      let x = 0;
      let y = 0;
      if (cOut & 8) {
        x = x1 + ((x2 - x1) * (ymax - y1)) / (y2 - y1);
        y = ymax;
      } else if (cOut & 4) {
        x = x1 + ((x2 - x1) * (ymin - y1)) / (y2 - y1);
        y = ymin;
      } else if (cOut & 2) {
        y = y1 + ((y2 - y1) * (xmax - x1)) / (x2 - x1);
        x = xmax;
      } else {
        y = y1 + ((y2 - y1) * (xmin - x1)) / (x2 - x1);
        x = xmin;
      }
      if (cOut === c1) {
        x1 = x;
        y1 = y;
        c1 = code(x1, y1);
      } else {
        x2 = x;
        y2 = y;
        c2 = code(x2, y2);
      }
    }

    poly(f, [
      [v.sx(xmin), v.sy(ymin)], [v.sx(xmax), v.sy(ymin)],
      [v.sx(xmax), v.sy(ymax)], [v.sx(xmin), v.sy(ymax)],
    ], { fill: 'rgba(102,126,234,0.1)', stroke: C.accent, lw: 1.8, close: true });
    seg(f, v.sx(orig[0]), v.sy(orig[1]), v.sx(orig[2]), v.sy(orig[3]), 'rgba(245,101,101,0.55)', 1.6);
    if (accepted) {
      seg(f, v.sx(x1), v.sy(y1), v.sx(x2), v.sy(y2), C.green, 3);
      dot(f, v.sx(x1), v.sy(y1), 4.5, C.green);
      dot(f, v.sx(x2), v.sy(y2), 4.5, C.green);
    }

    footnotes(f, [
      accepted
        ? `保留窗口内的部分：( ${x1.toFixed(2)}, ${y1.toFixed(2)} ) → ( ${x2.toFixed(2)}, ${y2.toFixed(2)} )，迭代 ${iterations} 次`
        : '线段完全位于窗口之外，被整体裁掉',
      'Cohen-Sutherland 用 4 位区域码判断线段与窗口的相对位置，逐步裁掉窗口外的端点',
      '线段裁剪是图形学裁剪流水线的第一关，后续还有视锥裁剪、背面剔除',
    ]);
    heading(f, '线段裁剪：Cohen-Sutherland');
  },
});

/** I67 L 系统。 */
const lSystem = defineViz({
  slug: 'l-system',
  title: 'L系统',
  params: {
    iterations: { type: 'range', min: 1, max: 6, default: 4, label: '迭代次数' },
    angle: { type: 'range', min: 10, max: 45, default: 25, label: '分支角度(°)' },
  },
  draw: (f) => {
    const { ctx, w, h, params } = f;
    const iterations = Math.round(num(params, 'iterations', 4));
    const angle = (num(params, 'angle', 25) * Math.PI) / 180;
    // 规则：F → F[+F]F[-F]F（经典植物模型）
    let s = 'F';
    for (let i = 0; i < iterations; i++) {
      s = s.replace(/F/g, 'F[+F]F[-F]F');
    }
    const len = Math.min(w, h) * 0.42 / Math.pow(1.9, iterations - 1);
    const startX = w / 2;
    const startY = h - 46;

    ctx.save();
    ctx.strokeStyle = C.green;
    ctx.lineWidth = Math.max(0.6, 2.4 - iterations * 0.3);
    ctx.beginPath();
    let x = startX;
    let y = startY;
    let dir = -Math.PI / 2;
    const stack: Array<[number, number, number]> = [];
    ctx.moveTo(x, y);
    for (const ch of s) {
      if (ch === 'F') {
        const nx = x + Math.cos(dir) * len;
        const ny = y + Math.sin(dir) * len;
        ctx.moveTo(x, y);
        ctx.lineTo(nx, ny);
        x = nx;
        y = ny;
      } else if (ch === '+') {
        dir += angle;
      } else if (ch === '-') {
        dir -= angle;
      } else if (ch === '[') {
        stack.push([x, y, dir]);
      } else if (ch === ']') {
        const st = stack.pop();
        if (st) {
          [x, y, dir] = st;
        }
      }
    }
    ctx.stroke();
    ctx.restore();

    footnotes(f, [
      `第 ${iterations} 代字符串长度 ${s.length}（从 1 个 F 指数增长到 ${s.length}）`,
      '规则 F → F[+F]F[-F]F：F 前进、+/- 转向、[] 保存/恢复状态（栈）',
      'L 系统由生物学家 Lindenmayer 提出，用字符串重写刻画植物生长，是程序化生成的基础',
    ]);
    heading(f, 'L 系统：字符串重写出植物');
  },
});

/** I68 四叉树。 */
const quadtree = defineViz({
  slug: 'quadtree',
  title: '四叉树',
  params: {
    points: { type: 'range', min: 5, max: 60, default: 30, label: '点数量' },
    capacity: { type: 'range', min: 1, max: 6, default: 2, label: '叶容量' },
    depth: { type: 'range', min: 1, max: 6, default: 4, label: '最大深度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const count = Math.round(num(params, 'points', 30));
    const capacity = Math.round(num(params, 'capacity', 2));
    const maxDepth = Math.round(num(params, 'depth', 4));
    const pts = scatterPoints(count, 8888);
    const v = equalView(f, 0.5, 0.5, 0.56, 40, 0.56);
    let leaves = 0;
    let maxUsed = 0;

    const subdivide = (subset: Array<[number, number]>, depth: number, bounds: [number, number, number, number]): void => {
      const [x0, y0, x1, y1] = bounds;
      if (depth >= maxDepth || subset.length <= capacity) {
        leaves++;
        maxUsed = Math.max(maxUsed, subset.length);
        if (depth > 0 && subset.length > 0) {
          seg(f, v.sx(x0), v.sy(y0), v.sx(x1), v.sy(y0), 'rgba(160,174,192,0.3)', 1);
          seg(f, v.sx(x1), v.sy(y0), v.sx(x1), v.sy(y1), 'rgba(160,174,192,0.3)', 1);
          seg(f, v.sx(x1), v.sy(y1), v.sx(x0), v.sy(y1), 'rgba(160,174,192,0.3)', 1);
          seg(f, v.sx(x0), v.sy(y1), v.sx(x0), v.sy(y0), 'rgba(160,174,192,0.3)', 1);
        }
        const midX = (x0 + x1) / 2;
        const midY = (y0 + y1) / 2;
        if (subset.length > 0 && depth > 0) {
          dot(f, v.sx(midX), v.sy(midY), 1.6, 'rgba(160,174,192,0.4)');
        }
        return;
      }
      const midX = (x0 + x1) / 2;
      const midY = (y0 + y1) / 2;
      seg(f, v.sx(midX), v.sy(y0), v.sx(midX), v.sy(y1), 'rgba(160,174,192,0.5)', 1.2);
      seg(f, v.sx(x0), v.sy(midY), v.sx(x1), v.sy(midY), 'rgba(160,174,192,0.5)', 1.2);
      const quads: Array<[[number, number, number, number], (p: [number, number]) => boolean]> = [
        [[x0, y0, midX, midY], (p) => p[0] < midX && p[1] < midY],
        [[midX, y0, x1, midY], (p) => p[0] >= midX && p[1] < midY],
        [[x0, midY, midX, y1], (p) => p[0] < midX && p[1] >= midY],
        [[midX, midY, x1, y1], (p) => p[0] >= midX && p[1] >= midY],
      ];
      for (const [box, test] of quads) {
        subdivide(subset.filter(test), depth + 1, box);
      }
    };
    subdivide(pts, 0, [0, 0, 1, 1]);
    pts.forEach((p) => dot(f, v.sx(p[0]), v.sy(p[1]), 3, C.warm));

    footnotes(f, [
      `${count} 个点被组织成 ${leaves} 个叶子节点（容量 ${capacity}，最大深度 ${maxDepth}）`,
      '四叉树每个节点把正方形切成 4 份，点太多就继续细分 —— 空间查询从 O(n) 降到 O(log n)',
      '碰撞检测、图像压缩、地图切片、粒子模拟都依赖四叉树（或三维的八叉树）',
    ]);
    heading(f, '四叉树：递归象限划分');
  },
});

/** I69 希尔伯特曲线。 */
const hilbertCurve = defineViz({
  slug: 'hilbert-curve',
  title: '希尔伯特曲线',
  params: {
    order: { type: 'range', min: 1, max: 6, default: 4, label: '阶数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const order = Math.round(num(params, 'order', 4));
    const size = Math.pow(2, order);
    const path: Array<[number, number]> = [];

    const walk = (level: number, x: number, y: number, dx: number, dy: number): void => {
      if (level <= 0) {
        path.push([x + dx / 2, y + dy / 2]);
        return;
      }
      walk(level - 1, x, y, dy / 2, dx / 2);
      walk(level - 1, x + dx / 2, y + dy / 2, dx / 2, dy / 2);
      walk(level - 1, x + dx / 2 + dy / 2, y + dy / 2 + dx / 2, dx / 2, dy / 2);
      walk(level - 1, x + dx / 2 + dy, y + dy / 2 + dx, -dy / 2, -dx / 2);
    };
    walk(order, 0, 0, 1, 1);

    const scale = Math.min(w - 100, h - 150) / size;
    const ox = (w - size * scale) / 2;
    const oy = 60;
    const screen = path.map(([x, y]) => [ox + x * scale, oy + y * scale] as [number, number]);
    poly(f, screen, { stroke: C.accent, lw: 1.6 });
    if (screen.length > 0) {
      dot(f, screen[0][0], screen[0][1], 4, C.green);
      dot(f, screen[screen.length - 1][0], screen[screen.length - 1][1], 4, C.hot);
    }

    footnotes(f, [
      `${order} 阶希尔伯特曲线经过 ${size}×${size} 网格的每个小格恰好一次（共 ${size * size} 个点）`,
      '相邻格子在路径上也相邻 —— 因此曲线"尽量连续"，没有大的跳跃',
      '希尔伯特曲线是空间填充曲线：极限下以面积为 1 的线段铺满整个正方形，用于数据库空间索引',
    ]);
    heading(f, '希尔伯特曲线：空间填充');
  },
});

/** I70 科赫雪花。 */
const kochSnowflake = defineViz({
  slug: 'koch-snowflake',
  title: '科赫雪花',
  params: {
    order: { type: 'range', min: 0, max: 5, default: 3, label: '迭代阶数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const order = Math.round(num(params, 'order', 3));
    const R = Math.min(w, h) * 0.36;
    const cx = w / 2;
    const cy = h / 2 - 4;

    const koch = (a: [number, number], b: [number, number], depth: number): Array<[number, number]> => {
      if (depth === 0) return [a, b];
      const dx = (b[0] - a[0]) / 3;
      const dy = (b[1] - a[1]) / 3;
      const p1: [number, number] = [a[0] + dx, a[1] + dy];
      const p3: [number, number] = [a[0] + 2 * dx, a[1] + 2 * dy];
      // 向外凸起的顶点（三角尖）
      const angle = Math.atan2(dy, dx) - Math.PI / 3;
      const len = Math.hypot(dx, dy);
      const p2: [number, number] = [p1[0] + Math.cos(angle) * len, p1[1] + Math.sin(angle) * len];
      return [...koch(a, p1, depth - 1), ...koch(p1, p2, depth - 1), ...koch(p2, p3, depth - 1), ...koch(p3, b, depth - 1)];
    };

    const verts: Array<[number, number]> = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
      verts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    }
    const outline: Array<[number, number]> = [];
    for (let i = 0; i < 3; i++) {
      const seg1 = koch(verts[i], verts[(i + 1) % 3], order);
      outline.push(...seg1.slice(0, -1));
    }
    poly(f, outline, { fill: 'rgba(66,153,225,0.16)', stroke: C.cool, lw: 1.4, close: true });

    const perimeterFactor = Math.pow(4 / 3, order);
    const areaFactor = 1 + (3 / 5) * (1 - Math.pow(4 / 9, order));
    footnotes(f, [
      `${order} 阶：每段被替换成 4 段，边长 ×4/3 → 周长放大到 ${perimeterFactor.toFixed(3)} 倍`,
      `面积收敛到 ${areaFactor.toFixed(4)} 倍外接三角形面积；周长趋于无穷而面积有限`,
      `分形维数 = log4/log3 ≈ 1.2619（不是整数）`,
    ]);
    heading(f, '科赫雪花：周长无穷，面积有限');
  },
});

/** I71 谢尔宾斯基三角形。 */
const sierpinskiTriangle = defineViz({
  slug: 'sierpinski-triangle',
  title: '谢尔宾斯基三角形',
  params: {
    order: { type: 'range', min: 0, max: 7, default: 5, label: '迭代阶数' },
    mode: { type: 'select', options: ['递归挖空', '混沌游戏'], default: '递归挖空', label: '生成方式' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const order = Math.round(num(params, 'order', 5));
    const mode = str(params, 'mode', '递归挖空');
    const R = Math.min(w, h) * 0.4;
    const cx = w / 2;
    const cy = h / 2 + R * 0.42;
    const top: [number, number] = [cx, cy - R];
    const left: [number, number] = [cx - R * 0.866, cy + R * 0.5];
    const right: [number, number] = [cx + R * 0.866, cy + R * 0.5];

    if (mode === '递归挖空') {
      let triangles = 0;
      const recurse = (a: [number, number], b: [number, number], c: [number, number], depth: number): void => {
        if (depth === 0) {
          triangles++;
          poly(f, [a, b, c], { fill: 'rgba(102,126,234,0.75)', close: true });
          return;
        }
        const ab: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const bc: [number, number] = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2];
        const ca: [number, number] = [(c[0] + a[0]) / 2, (c[1] + a[1]) / 2];
        recurse(a, ab, ca, depth - 1);
        recurse(ab, b, bc, depth - 1);
        recurse(ca, bc, c, depth - 1);
      };
      recurse(top, left, right, order);
      footnotes(f, [
        `第 ${order} 阶由 ${triangles} 个小三角形组成（= 3^${order}）`,
        `每轮把中间三角形挖掉，剩余面积 ×3/4 → 极限面积为 0，面积测度为 0`,
        `分形维数 = log3/log2 ≈ 1.585`,
      ]);
    } else {
      // 混沌游戏：从任意点开始，每次向随机一个顶点走一半
      const rand = rng(20240607);
      const vertices = [top, left, right];
      let p: [number, number] = [cx, cy];
      const points: Array<[number, number]> = [];
      for (let i = 0; i < 12000; i++) {
        const v = vertices[Math.floor(rand() * 3)];
        p = [(p[0] + v[0]) / 2, (p[1] + v[1]) / 2];
        if (i > 30) points.push(p);
      }
      points.forEach(([x, y]) => dot(f, x, y, 0.9, `${C.accent}cc`));
      footnotes(f, [
        `混沌游戏撒了 ${points.length} 个点，却自动拼出谢尔宾斯基三角形`,
        '规则：每次向随机选中的一个顶点走一半距离 —— 完全随机的过程却产生确定的分形',
        '这说明"随机"与"结构"并不矛盾：吸引子在迭代映射下自发形成',
      ]);
    }
    heading(f, '谢尔宾斯基三角形');
  },
});

/** I72 谢尔宾斯基地毯。 */
const sierpinskiCarpet = defineViz({
  slug: 'sierpinski-carpet',
  title: '谢尔宾斯基地毯',
  params: {
    order: { type: 'range', min: 0, max: 5, default: 3, label: '迭代阶数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const order = Math.round(num(params, 'order', 3));
    const side = Math.min(w - 100, h - 150);
    const ox = (w - side) / 2;
    const oy = 60;
    let squares = 0;

    const recurse = (x: number, y: number, size: number, depth: number): void => {
      if (depth === 0) {
        squares++;
        f.ctx.save();
        f.ctx.fillStyle = 'rgba(102,126,234,0.8)';
        f.ctx.fillRect(x, y, size, size);
        f.ctx.restore();
        return;
      }
      const third = size / 3;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          if (i === 1 && j === 1) continue; // 挖掉中心
          recurse(x + i * third, y + j * third, third, depth - 1);
        }
      }
    };
    recurse(ox, oy, side, order);

    const areaFactor = Math.pow(8 / 9, order);
    footnotes(f, [
      `第 ${order} 阶由 ${squares} 个小方块组成（= 8^${order}），剩余面积比为 ${areaFactor.toFixed(4)}`,
      `每轮挖掉中心 1/9，保留下来的面积 ×8/9 → 极限面积趋于 0`,
      `分形维数 = log8/log3 ≈ 1.8928，介于线与面之间`,
    ]);
    heading(f, '谢尔宾斯基地毯');
  },
});

/** I73 龙形曲线。 */
const dragonCurve = defineViz({
  slug: 'dragon-curve',
  title: '龙形曲线',
  params: {
    order: { type: 'range', min: 1, max: 16, default: 12, label: '折叠次数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const order = Math.round(num(params, 'order', 12));
    // 折纸序列：每轮在末尾翻转并追加
    let turns = 'R';
    for (let i = 1; i < order && turns.length < 20000; i++) {
      const flipped = turns
        .split('')
        .reverse()
        .map((ch) => (ch === 'R' ? 'L' : 'R'))
        .join('');
      turns = `${turns}R${flipped}`;
    }

    const step = Math.min(w - 120, h - 150) / Math.pow(1.4, Math.min(order, 14));
    let x = w / 2 - (step * Math.sqrt(turns.length)) / 2;
    let y = h / 2 + (step * Math.sqrt(turns.length)) / 2;
    let dir = 0;
    const pts: Array<[number, number]> = [[x, y]];
    for (const ch of turns) {
      dir += ch === 'R' ? Math.PI / 2 : -Math.PI / 2;
      x += Math.cos(dir) * step;
      y += Math.sin(dir) * step;
      pts.push([x, y]);
    }
    // 居中修正
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const dx = w / 2 - (Math.min(...xs) + Math.max(...xs)) / 2;
    const dy = h / 2 - 4 - (Math.min(...ys) + Math.max(...ys)) / 2;
    poly(f, pts.map(([a, b]) => [a + dx, b + dy] as [number, number]), { stroke: C.accent, lw: 1 });

    footnotes(f, [
      `折叠 ${order} 次得到 ${turns.length + 1} 条线段（序列长度随折叠指数增长）`,
      '把纸带反复对折再展开成直角，折痕序列就是龙形曲线的转向指令',
      '龙形曲线不自我相交，并用有限面积铺满平面；相邻两代的形状总是相似',
    ]);
    heading(f, '龙形曲线：折纸生成的分形');
  },
});

/** I74 巴恩斯利蕨。 */
const barnsleyFern = defineViz({
  slug: 'barnsley-fern',
  title: '巴恩斯利蕨',
  params: {
    points: { type: 'range', min: 1000, max: 40000, default: 20000, step: 1000, label: '迭代点数' },
    colorMode: { type: 'select', options: ['绿色渐变', '单色'], default: '绿色渐变', label: '着色' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'points', 20000));
    const colorMode = str(params, 'colorMode', '绿色渐变');
    const rand = rng(19750104);
    // IFS 的 4 个仿射变换（含概率）
    const transforms: Array<[number, number, number, number, number, number, number]> = [
      [0.85, 0.04, -0.04, 0.85, 0, 1.6, 0.85],
      [0.2, -0.26, 0.23, 0.22, 0, 1.6, 0.07],
      [-0.15, 0.28, 0.26, 0.24, 0, 0.44, 0.07],
      [0, 0, 0, 0.16, 0, 0, 0.01],
    ];
    let x = 0;
    let y = 0;
    const scale = Math.min((w - 120) / 5.2, (h - 150) / 10.5);
    const cx = w / 2;
    const baseY = 56 + (h - 150);

    for (let i = 0; i < n; i++) {
      const r = rand();
      let acc = 0;
      let chosen = transforms[0];
      for (const t of transforms) {
        acc += t[6];
        if (r <= acc) {
          chosen = t;
          break;
        }
      }
      const nx = chosen[0] * x + chosen[1] * y + chosen[4];
      const ny = chosen[2] * x + chosen[3] * y + chosen[5];
      x = nx;
      y = ny;
      if (i < 20) continue;
      const sx = cx + x * scale;
      const sy = baseY - y * scale;
      f.ctx.save();
      f.ctx.fillStyle = colorMode === '单色' ? `${C.green}cc` : `${PALETTE[Math.floor(rand() * 3)]}bb`;
      f.ctx.fillRect(sx, sy, 1.2, 1.2);
      f.ctx.restore();
    }

    footnotes(f, [
      `${n} 个点由 4 个仿射变换迭代生成（Iterated Function System）`,
      '每个变换以固定概率被选中：茎干、小叶片、大叶片 —— 随机迭代却收敛到确定的蕨叶形状',
      'IFS 用极少的参数编码复杂的自然形态，是分形图像压缩的理论基础',
    ]);
    heading(f, '巴恩斯利蕨：IFS 迭代函数系统');
  },
});

/** I75 佩亚诺曲线。 */
const peanoCurve = defineViz({
  slug: 'peano-curve',
  title: '佩亚诺曲线',
  params: {
    order: { type: 'range', min: 1, max: 4, default: 2, label: '阶数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const order = Math.round(num(params, 'order', 2));
    // Moore 曲线（佩亚诺曲线族的一种）：3×3 递归
    const build = (level: number): Array<[number, number]> => {
      if (level === 0) {
        return [[0, 0], [1, 0]];
      }
      const sub = build(level - 1);
      const size = Math.pow(3, level - 1);
      const out: Array<[number, number]> = [];
      const push = (x: number, y: number, pts: Array<[number, number]>, flip: boolean): void => {
        const seq = flip ? [...pts].reverse() : pts;
        if (out.length > 0) {
          out.push([x + seq[0][0], y + seq[0][1]]);
        }
        for (const [a, b] of seq) out.push([x + a, y + b]);
      };
      // 沿 8 个格子的蛇形顺序连接（简化 Moore 路径）
      const order3 = [
        [0, 0], [1, 0], [2, 0], [2, 1], [1, 1], [0, 1], [0, 2], [1, 2], [2, 2],
      ];
      let idx = 0;
      for (const [gx, gy] of order3) {
        push(gx * size, gy * size, sub, idx % 2 === 1);
        idx++;
      }
      return out;
    };
    const raw = build(order);
    const maxV = Math.pow(3, order);
    const side = Math.min(w - 120, h - 150);
    const scale = side / maxV;
    const ox = (w - side) / 2;
    const oy = 60;
    const pts = raw.map(([a, b]) => [ox + a * scale + scale / 2, oy + b * scale + scale / 2] as [number, number]);
    poly(f, pts, { stroke: C.accent, lw: Math.max(0.8, 2.4 - order * 0.4) });

    footnotes(f, [
      `${order} 阶：${maxV}×${maxV} 网格，路径访问每个格子一次（共 ${raw.length} 个路点）`,
      '佩亚诺曲线是第一个被发现的连续满射：用一条连续曲线填满整个正方形',
      '与希尔伯特曲线一样属于空间填充曲线，二者常被对比：佩亚诺=3 进制分割，希尔伯特=2 进制分割',
    ]);
    heading(f, '佩亚诺曲线：连续满射');
  },
});

registerViz(
  kdTree,
  voronoi,
  delaunayTriangulation,
  pointInPolygon,
  lineClipping,
  lSystem,
  quadtree,
  hilbertCurve,
  kochSnowflake,
  sierpinskiTriangle,
  sierpinskiCarpet,
  dragonCurve,
  barnsleyFern,
  peanoCurve,
);
