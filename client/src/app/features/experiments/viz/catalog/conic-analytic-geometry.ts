import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import {
  C,
  PALETTE,
  circle,
  dot,
  equalView,
  footnotes,
  grid,
  heading,
  poly,
  seg,
  text,
  unitScale,
} from '../canvas';

/** M11 极坐标深化。 */
const polarM11 = defineViz({
  slug: 'polar-m11',
  title: '极坐标深化',
  params: {
    family: { type: 'select', options: ['玫瑰线 r=cos(kθ)', '双纽线 r²=cos(2θ)', '四叶草 r=cos(2θ)', '螺线 r=θ'], default: '玫瑰线 r=cos(kθ)', label: '曲线族' },
    k: { type: 'range', min: 1, max: 8, default: 5, step: 1, label: '参数 k' },
    showRadius: { type: 'select', options: ['显示', '隐藏'], default: '显示', label: '径向网格' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const family = str(params, 'family', '玫瑰线 r=cos(kθ)');
    const k = num(params, 'k', 5);
    const showRadius = str(params, 'showRadius', '显示') === '显示';
    const v = equalView(f, 0, 0, 1.3);
    const unit = unitScale(v);

    if (showRadius) {
      for (let i = 1; i <= 3; i++) {
        circle(f, v.sx(0), v.sy(0), (i / 3) * unit, { stroke: 'rgba(58,74,99,0.7)', lw: 1 });
      }
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2;
        seg(f, v.sx(0), v.sy(0), v.sx(Math.cos(ang) * 1.05), v.sy(Math.sin(ang) * 1.05), 'rgba(58,74,99,0.7)', 1);
      }
    }

    const fn = (theta: number): number => {
      if (family.startsWith('双纽线')) return Math.sqrt(Math.max(0, Math.cos(2 * theta)));
      if (family.startsWith('四叶草')) return Math.cos(2 * theta);
      if (family.startsWith('螺线')) return theta / (Math.PI * 2);
      return Math.cos(k * theta);
    };
    const turns = family.startsWith('螺线') ? Math.PI * 6 : Math.PI * 2 * (k % 2 === 0 ? 2 : 1) * 2;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 2400; i++) {
      const theta = (i / 2400) * turns;
      const r = fn(theta);
      pts.push([v.sx(r * Math.cos(theta)), v.sy(r * Math.sin(theta))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2 });

  const petals = family.startsWith('玫瑰线') ? (k % 2 === 1 ? `${k} 片` : `${k * 2} 片`) : family.startsWith('四叶草') ? '4 片' : '—';
    footnotes(f, [
  `${family}${petals !== '—' ? `，花瓣数：${petals}` : '—'}`,
      '极坐标下 r(θ) 直接给出"每个方向上的距离"，很多曲线的方程比直角坐标简洁得多',
      '极坐标与直角坐标互化：x = r cos θ，y = r sin θ，r² = x² + y²',
    ]);
    heading(f, `极坐标曲线：${family}`);
  },
});

/** M12 心形线。 */
const cardioid = defineViz({
  slug: 'cardioid',
  title: '笛卡尔叶形线',
  params: {
    a: { type: 'range', min: 0.5, max: 2, default: 1, step: 0.1, label: '尺度 a' },
    theta: { type: 'range', min: 0, max: 360, default: 60, label: '动点角度(°)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 1);
    const deg = num(params, 'theta', 60);
    const theta = (deg * Math.PI) / 180;
    const v = equalView(f, 0, 0, 2.6);
    grid(f, v, { divisions: 5, ticks: true });

    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 900; i++) {
      const t = (i / 900) * Math.PI * 2;
      const r = a * (1 - Math.cos(t));
      pts.push([v.sx(r * Math.cos(t)), v.sy(r * Math.sin(t))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.4, close: true });

    const r = a * (1 - Math.cos(theta));
    const px = r * Math.cos(theta);
    const py = r * Math.sin(theta);
    seg(f, v.sx(0), v.sy(0), v.sx(px), v.sy(py), C.warm, 2);
    dot(f, v.sx(px), v.sy(py), 5, C.warm);
    dot(f, v.sx(0), v.sy(0), 4, C.green);
    text(f, `r = ${r.toFixed(3)}`, v.sx(px) + 8, v.sy(py) - 8, { color: C.warm, font: '12px sans-serif' });

    const area = 1.5 * Math.PI * a * a;
    const arcLen = 8 * a;
    footnotes(f, [
      `心形线 r = ${a}(1 - cos θ)：面积 = 3πa²/2 = ${area.toFixed(4)}，全长 = 8a = ${arcLen.toFixed(4)}`,
      '极坐标下用"扇形微元"积分 ½∫r²dθ 求面积，比直角坐标简单得多',
      '心形线的长度是 8a（与其他圆锥曲线不同，它是"有理数"倍）—— 这是它的一个著名特性',
    ]);
    heading(f, '心形线（Cardioid）');
  },
});

/** M13 圆锥曲线反射。 */
const conicReflectionM13 = defineViz({
  slug: 'conic-reflection-m13',
  title: '圆锥曲线反射',
  params: {
    rays: { type: 'range', min: 3, max: 24, default: 12, label: '光线数量' },
    spread: { type: 'range', min: 0.05, max: 1, default: 0.4, step: 0.05, label: '发散范围' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const rays = Math.round(num(params, 'rays', 12));
    const spread = num(params, 'spread', 0.4);
    const a = 5;
    const b = 3;
    const c = Math.sqrt(a * a - b * b);
    const v = equalView(f, 0, 0, 6.4);
    const unit = unitScale(v);

    // 椭圆
    const oval: Array<[number, number]> = [];
    for (let i = 0; i <= 240; i++) {
      const t = (i / 240) * Math.PI * 2;
      oval.push([v.sx(a * Math.cos(t)), v.sy(b * Math.sin(t))]);
    }
    poly(f, oval, { stroke: C.accent, lw: 2.4, close: true });
    dot(f, v.sx(-c), v.sy(0), 6, C.green);
    dot(f, v.sx(c), v.sy(0), 6, C.hot);
    text(f, 'F₁', v.sx(-c) - 16, v.sy(0) - 8, { color: C.green, font: '12px sans-serif' });
    text(f, 'F₂', v.sx(c) + 8, v.sy(0) - 8, { color: C.hot, font: '12px sans-serif' });

    for (let i = 0; i < rays; i++) {
      const t = (i / rays) * Math.PI - Math.PI / 2;
      const ang = t * spread + Math.PI;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      // 从 F1 出发，求与椭圆的交点（参数方程数值求交）
      let hit: [number, number] = [0, 0];
      let bestT = Infinity;
      for (let s = 0; s < 400; s++) {
        const u = (s / 400) * (2 * a);
        const x = -c + dx * u;
        const y = dy * u;
        const val = (x * x) / (a * a) + (y * y) / (b * b) - 1;
        if (val >= 0) {
          bestT = u;
          hit = [x, y];
          break;
        }
      }
      if (!Number.isFinite(bestT)) continue;
      seg(f, v.sx(-c), v.sy(0), v.sx(hit[0]), v.sy(hit[1]), `${C.green}cc`, 1.2);
      seg(f, v.sx(hit[0]), v.sy(hit[1]), v.sx(c), v.sy(0), `${C.hot}cc`, 1.2);
    }

    footnotes(f, [
      `从 F₁ 发出的 ${rays} 条光线，全部经椭圆反射后到达 F₂`,
      '这是"焦点"名称的由来 —— 光（或声音、热量）会聚之处',
      '抛物线的对应性质：焦点发出的光反射后成为平行光；双曲线：反向延长线过另一焦点',
    ]);
    heading(f, '椭圆反射：从 F₁ 到 F₂');
  },
});

/** M14 焦点准线深化。 */
const focusDirectrixM14 = defineViz({
  slug: 'focus-directrix-m14',
  title: '焦点准线深化',
  params: {
    e: { type: 'range', min: 0.2, max: 2.4, default: 0.8, step: 0.1, label: '离心率 e' },
    samples: { type: 'range', min: 6, max: 40, default: 18, label: '轨迹采样数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const e = num(params, 'e', 0.8);
    const samples = Math.round(num(params, 'samples', 18));
    const p = 4;
    const v = equalView(f, -2, 0, 9, 38, 6);
    grid(f, v, { divisions: 6, ticks: true });

    const pts: Array<[number, number]> = [];
    for (let i = -1500; i <= 1500; i++) {
      const t = (i / 1500) * Math.PI;
      const r = p / (1 + e * Math.cos(t));
      if (!Number.isFinite(r) || r <= 0 || r > 40) continue;
      pts.push([v.sx(r * Math.cos(t)), v.sy(r * Math.sin(t))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.2 });

    const directrix = p / e;
    seg(f, v.sx(directrix), v.sy(-8), v.sx(directrix), v.sy(8), C.hot, 1.8);
    dot(f, v.sx(0), v.sy(0), 5, C.green);
    // 采样点：展示 |PF| = e · dist(P, 准线)
    for (let i = 0; i < samples; i++) {
      const t = (i / samples) * Math.PI * 2 - Math.PI;
      const r = p / (1 + e * Math.cos(t));
      if (!Number.isFinite(r) || r <= 0 || r > 20) continue;
      const px = r * Math.cos(t);
      const py = r * Math.sin(t);
      dot(f, v.sx(px), v.sy(py), 3.4, C.warm);
      const distP = Math.hypot(px, py);
      const distD = Math.abs(directrix - px);
      if (Math.abs(distP / distD - e) < 0.02) {
        seg(f, v.sx(px), v.sy(py), v.sx(0), v.sy(0), `${C.green}66`, 1);
        seg(f, v.sx(px), v.sy(py), v.sx(directrix), v.sy(py), `${C.cool}66`, 1);
      }
    }

    footnotes(f, [
      `e = ${e}：每个橙点到焦点距离与到准线距离之比恒等于 ${e}`,
      `准线位置 x = p/e = ${directrix.toFixed(3)}，焦点在原点`,
      '用这个比例定义圆锥曲线，三种曲线（椭圆/抛物线/双曲线）就是 e 的三个取值区间',
    ]);
    heading(f, '焦点准线定义：距离之比');
  },
});

/** M15 丹德林球深化。 */
const dandelinM15 = defineViz({
  slug: 'dandelin-m15',
  title: '丹德林球深化',
  params: {
    cut: { type: 'range', min: 0.1, max: 0.6, default: 0.26, step: 0.02, label: '截面倾角' },
    apex: { type: 'range', min: 15, max: 50, default: 26, label: '半顶角(°) ' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const cut = num(params, 'cut', 0.26);
    const apexDeg = num(params, 'apex', 26);
    const tan = Math.tan((apexDeg * Math.PI) / 180);
    const v = equalView(f, 0.6, 0, 5.4, 36, 3.8);

    // 圆锥母线
    seg(f, v.sx(0), v.sy(-2), v.sx(6 * tan), v.sy(6), C.dim, 1.6);
    seg(f, v.sx(0), v.sy(-2), v.sx(-6 * tan), v.sy(6), C.dim, 1.6);
    // 底面椭圆
    const basePts: Array<[number, number]> = [];
    for (let i = 0; i <= 100; i++) {
      const t = (i / 100) * Math.PI * 2;
      basePts.push([v.sx(-2 * tan * Math.cos(t)), v.sy(-2 + 0.42 * Math.sin(t))]);
    }
    poly(f, basePts, { stroke: C.dim, lw: 1.4 });

    // 截面与截线
    const sectionY = (x: number): number => 1.4 + cut * x;
    const secLine: Array<[number, number]> = [];
    for (let x = -6; x <= 6; x += 0.1) {
      const y = sectionY(x);
      if (y > 6 || y < -2) continue;
      if (Math.abs(x) > Math.abs(y) * tan + 0.01) continue;
      secLine.push([v.sx(x), v.sy(y)]);
    }
    poly(f, secLine, { stroke: C.hot, lw: 2.6 });

    // 两个丹德林球（切点即焦点）
    const tangentPoint = (side: number): [number, number] => {
      // 球心在轴线上的位置（近似：使球与圆锥面相切）
      const yc = 1.2 + side * 0.9;
      const sphR = Math.abs(yc) * Math.sin((apexDeg * Math.PI) / 180);
      return [side * sphR * 0.86, yc + sphR * 0.35];
    };
    for (const side of [-1, 1]) {
      const [fx, fy] = tangentPoint(side);
      dot(f, v.sx(fx), v.sy(fy), 5, side < 0 ? C.green : C.cool);
      text(f, side < 0 ? 'F₁' : 'F₂', v.sx(fx) + 8, v.sy(fy) - 6, { color: side < 0 ? C.green : C.cool, font: '12px sans-serif' });
      const sphereR = Math.abs(sectionY(fx) - fy) * 0.9 + 0.5;
      const spherePts: Array<[number, number]> = [];
      for (let i = 0; i <= 90; i++) {
        const t = (i / 90) * Math.PI * 2;
        spherePts.push([v.sx(fx + sphereR * 0.55 * Math.cos(t)), v.sy(fy + sphereR * 0.9 * Math.sin(t))]);
      }
      poly(f, spherePts, { stroke: `${side < 0 ? C.green : C.cool}99`, lw: 1.4, dash: [5, 4] });
    }

    footnotes(f, [
      '截面倾角小于母线倾角时得到椭圆；丹德林球与圆锥、截面同时相切',
      '两球的切点 F₁、F₂ 就是截线（椭圆）的两个焦点',
      '证明思路：|PF₁|、|PF₂| 都等于 P 到两球切圆的母线长之差，因此 |PF₁|+|PF₂| 为常数',
    ]);
    heading(f, '丹德林球：焦点性质的几何证明');
  },
});

/** M16 共焦二次曲面深化。 */
const confocalQuadricsM16 = defineViz({
  slug: 'confocal-quadrics-m16',
  title: '共焦二次曲面深化',
  params: {
    c: { type: 'range', min: 1, max: 3, default: 1.8, step: 0.1, label: '焦距 c' },
    family: { type: 'range', min: 1, max: 6, default: 4, label: '族曲线数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const c = num(params, 'c', 1.8);
    const family = Math.round(num(params, 'family', 4));
    const v = equalView(f, 0, 0, 6, 38, 4.4);
    grid(f, v, { divisions: 6, ticks: true });
    dot(f, v.sx(-c), v.sy(0), 5, C.warm);
    dot(f, v.sx(c), v.sy(0), 5, C.warm);

    // 共焦椭圆族
    for (let i = 0; i < family; i++) {
      const a2 = c * c + 1.2 + i * 1.6;
      const b2 = a2 - c * c;
      const pts: Array<[number, number]> = [];
      for (let j = 0; j <= 200; j++) {
        const t = (j / 200) * Math.PI * 2;
        pts.push([v.sx(Math.sqrt(a2) * Math.cos(t)), v.sy(Math.sqrt(b2) * Math.sin(t))]);
      }
      poly(f, pts, { stroke: `${PALETTE[i % PALETTE.length]}cc`, lw: 1.8, close: true });
    }
    // 共焦双曲线族（与椭圆正交）
    for (let i = 0; i < family; i++) {
      const A2 = c * c - 0.35 - i * 0.25;
      if (A2 <= 0.05) continue;
      const B2 = c * c - A2;
      const branch = (sign: number): Array<[number, number]> => {
        const out: Array<[number, number]> = [];
        for (let x = Math.sqrt(A2) + 0.01; x <= 7; x += 0.06) {
          const y = Math.sqrt(B2) * Math.sqrt((x * x) / A2 - 1);
          if (y > 6) break;
          out.push([v.sx(sign * x), v.sy(y)]);
        }
        return out;
      };
      const up = branch(1);
      poly(f, up, { stroke: 'rgba(72,187,120,0.75)', lw: 1.6 });
      poly(f, up.map(([x, y]) => [x, v.sy(0) - (y - v.sy(0))] as [number, number]), { stroke: 'rgba(72,187,120,0.75)', lw: 1.6 });
      poly(f, up.map(([x, y]) => [v.sx(0) - (x - v.sx(0)), y] as [number, number]), { stroke: 'rgba(72,187,120,0.75)', lw: 1.6 });
      poly(f, up.map(([x, y]) => [v.sx(0) - (x - v.sx(0)), v.sy(0) - (y - v.sy(0))] as [number, number]), { stroke: 'rgba(72,187,120,0.75)', lw: 1.6 });
    }

    footnotes(f, [
      `焦点固定在 (±${c}, 0)，${family} 条椭圆与一组共焦双曲线（绿色）`,
      '任何一条椭圆与任何一条双曲线都以直角相交 —— "正交轨迹族"',
      '共焦二次曲面在三维中同样成立，是分离变量法求解偏微分方程的基础坐标系（椭球坐标）',
    ]);
    heading(f, '共焦族：正交轨迹');
  },
});

/** 计算庞加莱圆盘中连接两点的测地线圆弧。 */
function poincareGeodesic(p1: [number, number], p2: [number, number]): { cx: number; cy: number; r: number } | null {
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  const det = 2 * (x1 * y2 - x2 * y1);
  if (Math.abs(det) < 1e-9) return null; // 与圆心共线 → 直径
  const b1 = x1 * x1 + y1 * y1 + 1;
  const b2 = x2 * x2 + y2 * y2 + 1;
  const cx = (b1 * y2 - b2 * y1) / det;
  const cy = (x2 * b1 - x1 * b2) / det;
  const r2 = cx * cx + cy * cy - 1;
  if (r2 <= 0) return null;
  return { cx, cy, r: Math.sqrt(r2) };
}

/** M17 双曲几何入门。 */
const hyperbolicTriangle = defineViz({
  slug: 'hyperbolic-triangle',
  title: '双曲几何入门',
  params: {
    size: { type: 'range', min: 0.2, max: 0.85, default: 0.55, step: 0.05, label: '三角形大小' },
    shape: { type: 'range', min: 0, max: 100, default: 40, label: '形状偏斜' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const size = num(params, 'size', 0.55);
    const skew = num(params, 'shape', 40) / 100;
    const v = equalView(f, 0, 0, 1.22);
    const unit = unitScale(v);

    circle(f, v.sx(0), v.sy(0), unit, { stroke: C.fg, lw: 2 });
    circle(f, v.sx(0), v.sy(0), unit * 0.55, { stroke: 'rgba(58,74,99,0.8)', lw: 1 });
    circle(f, v.sx(0), v.sy(0), unit * 0.28, { stroke: 'rgba(58,74,99,0.8)', lw: 1 });

    const angA = -Math.PI / 2 + (skew - 0.5) * 0.9;
    const verts: Array<[number, number]> = [
      [size * Math.cos(angA), size * Math.sin(angA)],
      [size * Math.cos(angA + 2.1), size * Math.sin(angA + 2.1)],
      [size * Math.cos(angA - 2.1), size * Math.sin(angA - 2.1)],
    ];

    for (let i = 0; i < 3; i++) {
      const p1 = verts[i];
      const p2 = verts[(i + 1) % 3];
      const geo = poincareGeodesic(p1, p2);
      if (!geo) {
        seg(f, v.sx(p1[0]), v.sy(p1[1]), v.sx(p2[0]), v.sy(p2[1]), C.accent, 2.2);
      } else {
        const a1 = Math.atan2(p1[1] - geo.cy, p1[0] - geo.cx);
        const a2 = Math.atan2(p2[1] - geo.cy, p2[0] - geo.cx);
        let delta = a2 - a1;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        const pts: Array<[number, number]> = [];
        for (let k = 0; k <= 60; k++) {
          const a = a1 + (delta * k) / 60;
          pts.push([v.sx(geo.cx + geo.r * Math.cos(a)), v.sy(geo.cy + geo.r * Math.sin(a))]);
        }
        poly(f, pts, { stroke: C.accent, lw: 2.2 });
      }
    }
    verts.forEach((p) => dot(f, v.sx(p[0]), v.sy(p[1]), 4.5, C.warm));

    // 双曲度量下的距离与内角（庞加莱圆盘：d = arccosh(1 + 2|PQ|²/((1-|P|²)(1-|Q|²)))）
    const hyperDist = (p: [number, number], q: [number, number]): number => {
      const dp = 1 - (p[0] * p[0] + p[1] * p[1]);
      const dq = 1 - (q[0] * q[0] + q[1] * q[1]);
      const eu = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
      return Math.acosh(1 + (2 * eu) / Math.max(1e-6, dp * dq));
    };
    const sideA = hyperDist(verts[1], verts[2]);
    const sideB = hyperDist(verts[0], verts[2]);
    const sideC = hyperDist(verts[0], verts[1]);
    const angleAt = (opposite: number, s1: number, s2: number): number => {
      const num0 = Math.cosh(s1) * Math.cosh(s2) - Math.cosh(opposite);
      const den = Math.sinh(s1) * Math.sinh(s2);
      if (Math.abs(den) < 1e-9) return 0;
      return Math.acos(Math.max(-1, Math.min(1, num0 / den)));
    };
    const angles = [
      angleAt(sideA, sideB, sideC),
      angleAt(sideB, sideA, sideC),
      angleAt(sideC, sideA, sideB),
    ];
    const sumDeg = (angles.reduce((a, b) => a + b, 0) * 180) / Math.PI;

    footnotes(f, [
      `双曲三角形（庞加莱圆盘模型）：三边是与边界圆正交的圆弧`,
      `内角和 ≈ ${sumDeg.toFixed(1)}°（始终小于 180°），面积 = π - 内角和 = ${((180 - sumDeg) * Math.PI / 180).toFixed(4)}`,
      '这正是双曲几何与欧氏几何的根本差异：高斯-博内定理给出"内角和不足"等于面积',
    ]);
    heading(f, '双曲几何：内角和小于 180°');
  },
});

/** M18 庞加莱圆盘。 */
const poincareDisk = defineViz({
  slug: 'poincare-disk',
  title: '庞加莱圆盘',
  params: {
    lines: { type: 'range', min: 3, max: 16, default: 8, label: '测地线数量' },
    spread: { type: 'range', min: 0.1, max: 0.9, default: 0.55, step: 0.05, label: '分布范围' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const count = Math.round(num(params, 'lines', 8));
    const spread = num(params, 'spread', 0.55);
    const v = equalView(f, 0, 0, 1.2);
    const unit = unitScale(v);

    circle(f, v.sx(0), v.sy(0), unit, { fill: 'rgba(26,32,44,0.6)', stroke: C.fg, lw: 2 });
    // 距离圆心的"平行线"在欧氏距离下越来越密（体现双曲度量）
    for (let i = 0; i < count; i++) {
      for (const sign of [1, -1]) {
        const offset = ((i + 1) / (count + 1)) * spread * sign;
        // 与边界圆正交、过点 (0, offset) 的圆弧
        const cy0 = 1 / Math.max(0.001, Math.abs(offset)) * Math.sign(offset);
        const r0 = Math.sqrt(cy0 * cy0 - 1);
        if (!Number.isFinite(r0)) continue;
        const a1 = Math.atan2(-cy0, r0);
        const a2 = Math.atan2(-cy0, -r0);
        const pts: Array<[number, number]> = [];
        for (let k = 0; k <= 80; k++) {
          const a = a1 + ((a2 - a1) * k) / 80;
          const x = r0 * Math.cos(a);
          const y = cy0 + r0 * Math.sin(a);
          if (Math.abs(Math.hypot(x, y)) > 1.002) continue;
          pts.push([v.sx(x), v.sy(y)]);
        }
        poly(f, pts, { stroke: PALETTE[i % PALETTE.length], lw: 1.8 });
      }
    }
    // 直径方向
    for (let a = 0; a < 2; a++) {
      seg(f, v.sx(0), v.sy(0), v.sx(Math.cos((a * Math.PI) / 2) * 0.99), v.sy(Math.sin((a * Math.PI) / 2) * 0.99), 'rgba(160,174,192,0.5)', 1.4);
    }

    footnotes(f, [
      `圆盘内的"直线"（测地线）是与边界圆正交的圆弧，共 ${count * 2} 条（含直径）`,
      '圆盘边界代表"无穷远"：越靠近边界的点，在双曲度量下距离越远',
      '庞加莱圆盘保角（角度不变形），因此是展示双曲几何最常用的模型 —— 埃舍尔的《圆的极限》就用了它',
    ]);
    heading(f, '庞加莱圆盘：双曲几何的模型');
  },
});

registerViz(
  polarM11,
  cardioid,
  conicReflectionM13,
  focusDirectrixM14,
  dandelinM15,
  confocalQuadricsM16,
  hyperbolicTriangle,
  poincareDisk,
);
