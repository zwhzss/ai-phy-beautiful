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

/** M01 复数可视化。 */
const complex = defineViz({
  slug: 'complex',
  title: '复数可视化',
  params: {
    a: { type: 'range', min: -2, max: 2, default: 1, step: 0.1, label: '实部 a' },
    b: { type: 'range', min: -2, max: 2, default: 0.8, step: 0.1, label: '虚部 b' },
    op: { type: 'select', options: ['乘 i（转 90°）', '平方', '取共轭'], default: '乘 i（转 90°）', label: '运算' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 1);
    const b = num(params, 'b', 0.8);
    const op = str(params, 'op', '乘 i（转 90°）');
    const v = equalView(f, 0, 0, 2.6);

    const apply = (x: number, y: number): [number, number] => {
      if (op === '平方') return [x * x - y * y, 2 * x * y];
      if (op === '取共轭') return [x, -y];
      return [-y, x];
    };
    const [ra, rb] = apply(a, b);
    const unit = v.sx(1) - v.sx(0);

    circle(f, v.sx(0), v.sy(0), 1 * unit, { stroke: 'rgba(160,174,192,0.4)', lw: 1, dash: [4, 4] });
    grid(f, v, { divisions: 4, ticks: true });
    poly(f, [[v.sx(0), v.sy(0)], [v.sx(a), v.sy(b)]], { stroke: C.accent, lw: 2.4 });
    dot(f, v.sx(a), v.sy(b), 5, C.accent);
    poly(f, [[v.sx(0), v.sy(0)], [v.sx(ra), v.sy(rb)]], { stroke: C.warm, lw: 2.4 });
    dot(f, v.sx(ra), v.sy(rb), 5, C.warm);
    text(f, `z = ${a.toFixed(1)} ${b >= 0 ? '+' : '-'} ${Math.abs(b).toFixed(1)}i`, v.sx(a) + 8, v.sy(b) - 8, { color: C.accent });
    text(f, `z' = ${ra.toFixed(2)} ${rb >= 0 ? '+' : '-'} ${Math.abs(rb).toFixed(2)}i`, v.sx(ra) + 8, v.sy(rb) + 16, { color: C.warm });

    const mod = Math.hypot(a, b);
    const arg = Math.atan2(b, a);
    footnotes(f, [
      `|z| = √(a²+b²) = ${mod.toFixed(4)}，arg z = ${((arg * 180) / Math.PI).toFixed(2)}°`,
      op === '乘 i（转 90°）' ? '乘以 i 相当于在复平面上逆时针旋转 90°（模不变）' : op === '平方' ? '平方使模平方、辐角加倍 —— 这是曼德博集合迭代的基础' : '取共轭关于实轴对称（模不变、辐角取负）',
      '复数的乘法 = 模相乘 + 辐角相加，这就是"旋转缩放"的代数表达',
    ]);
    heading(f, '复数可视化：复平面上的运算');
  },
});

/** M02 圆锥曲线深化（离心率的影响）。 */
const conicSectionsM02 = defineViz({
  slug: 'conic-sections-m02',
  title: '圆锥曲线深化',
  params: {
    e: { type: 'range', min: 0.1, max: 2, default: 0.6, step: 0.1, label: '离心率 e' },
    p: { type: 'range', min: 1, max: 5, default: 3, step: 0.5, label: '半通径 p' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const e = num(params, 'e', 0.6);
    const p = num(params, 'p', 3);
    const v = equalView(f, 0, 0, 9, 40, 6);
    grid(f, v, { divisions: 6, ticks: true });

    const drawBranch = (sign: number, color: string): void => {
      const pts: Array<[number, number]> = [];
      for (let i = -2000; i <= 2000; i++) {
        const theta = (i / 2000) * Math.PI;
        const r = p / (1 + e * Math.cos(theta));
        if (!Number.isFinite(r) || r <= 0) continue;
        const x = sign * r * Math.cos(theta);
        const y = r * Math.sin(theta);
        if (Math.abs(x) > 40 || Math.abs(y) > 40) continue;
        pts.push([v.sx(x), v.sy(y)]);
      }
      poly(f, pts, { stroke: color, lw: 2.6 });
    };
    drawBranch(1, C.accent);
    if (e > 1.01) drawBranch(-1, C.warm);

    const focusX = e < 1 ? (p * e) / (1 - e * e) : e > 1 ? (p * e) / (e * e - 1) : p / 2;
    dot(f, v.sx(e > 1 ? -focusX : focusX), v.sy(0), 5, C.green);
    const semiMajor = e < 1 ? p / (1 - e * e) : e > 1 ? p / (e * e - 1) : null;
    footnotes(f, [
      `极坐标统一方程 r = p/(1 + e·cos θ)，e = ${e}：${e < 0.999 ? '椭圆' : e > 1.001 ? '双曲线' : '抛物线'}`,
      semiMajor ? `实半轴 a = p/|1-e²| = ${semiMajor.toFixed(4)}，焦距 c = ae = ${(semiMajor * e).toFixed(4)}` : '抛物线没有"半轴"，只有焦准距 p',
      '离心率 e 统一刻画了三种圆锥曲线：e < 1 椭圆、e = 1 抛物线、e > 1 双曲线',
    ]);
    heading(f, '圆锥曲线的离心率统一刻画');
  },
});

/** M03 焦点准线。 */
const focusDirectrix = defineViz({
  slug: 'focus-directrix',
  title: '焦点准线',
  params: {
    e: { type: 'range', min: 0.3, max: 1.6, default: 0.7, step: 0.1, label: '离心率 e' },
    theta: { type: 'range', min: 0, max: 360, default: 55, label: '动点角度(°)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const e = num(params, 'e', 0.7);
    const deg = num(params, 'theta', 55);
    const theta = (deg * Math.PI) / 180;
    const p = 4;
    const v = equalView(f, -1, 0, 9, 40, 6);
    grid(f, v, { divisions: 6, ticks: true });

    const r = p / (1 + e * Math.cos(theta));
    const px = r * Math.cos(theta);
    const py = r * Math.sin(theta);
    const directrixX = p / e;

    // 曲线
    const pts: Array<[number, number]> = [];
    for (let i = -1200; i <= 1200; i++) {
      const t = (i / 1200) * Math.PI;
      const rr = p / (1 + e * Math.cos(t));
      if (!Number.isFinite(rr) || rr <= 0 || rr > 60) continue;
      pts.push([v.sx(rr * Math.cos(t)), v.sy(rr * Math.sin(t))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.4 });
    seg(f, v.sx(directrixX), v.sy(-8), v.sx(directrixX), v.sy(8), C.hot, 1.8);
    text(f, '准线', v.sx(directrixX) + 4, v.sy(7), { color: C.hot, font: '12px sans-serif' });
    dot(f, v.sx(0), v.sy(0), 5, C.green);
    text(f, '焦点 F', v.sx(0) + 6, v.sy(0) - 8, { color: C.green, font: '12px sans-serif' });
    dot(f, v.sx(px), v.sy(py), 5.5, C.warm);
    seg(f, v.sx(0), v.sy(0), v.sx(px), v.sy(py), C.warm, 1.6);
    seg(f, v.sx(px), v.sy(py), v.sx(directrixX), v.sy(py), C.cool, 1.6);

    footnotes(f, [
      `动点 P 满足 |PF| / dist(P, 准线) = ${(Math.hypot(px, py) / Math.abs(directrixX - px)).toFixed(4)} = e`,
      `|PF| = ${Math.hypot(px, py).toFixed(4)}，到准线距离 = ${Math.abs(directrixX - px).toFixed(4)}`,
      '这就是圆锥曲线的统一定义：到焦点距离与到准线距离之比恒为 e —— 三种曲线只是 e 的取值不同',
    ]);
    heading(f, '焦点准线：距离之比定义圆锥曲线');
  },
});

/** M04 圆锥反射。 */
const conicReflection = defineViz({
  slug: 'conic-reflection',
  title: '圆锥反射',
  params: {
    kind: { type: 'select', options: ['椭圆', '抛物线'], default: '椭圆', label: '曲线' },
    incidence: { type: 'range', min: -80, max: 80, default: 25, label: '入射角(°)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'kind', '椭圆');
    const deg = num(params, 'incidence', 25);
    const rad = (deg * Math.PI) / 180;

    if (kind === '椭圆') {
      const a = 5;
      const b = 3;
      const c = Math.sqrt(a * a - b * b);
      const v = equalView(f, 0, 0, 6.4);
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 200; i++) {
        const t = (i / 200) * Math.PI * 2;
        pts.push([v.sx(a * Math.cos(t)), v.sy(b * Math.sin(t))]);
      }
      poly(f, pts, { stroke: C.accent, lw: 2.4, close: true });
      dot(f, v.sx(-c), v.sy(0), 5, C.green);
      dot(f, v.sx(c), v.sy(0), 5, C.hot);
      text(f, 'F₁', v.sx(-c) - 14, v.sy(0) - 8, { color: C.green, font: '12px sans-serif' });
      text(f, 'F₂', v.sx(c) + 6, v.sy(0) - 8, { color: C.hot, font: '12px sans-serif' });
      // 反射点
      const t = Math.PI / 2 + rad;
      const px = a * Math.cos(t);
      const py = b * Math.sin(t);
      dot(f, v.sx(px), v.sy(py), 5, C.warm);
      seg(f, v.sx(-c), v.sy(0), v.sx(px), v.sy(py), C.green, 1.8);
      seg(f, v.sx(px), v.sy(py), v.sx(c), v.sy(0), C.hot, 1.8);
      footnotes(f, [
        `椭圆的光学性质：从一个焦点发出的光线经椭圆反射后必经过另一个焦点`,
        `|PF₁| + |PF₂| = ${(Math.hypot(px + c, py) + Math.hypot(px - c, py)).toFixed(4)} = 2a = ${2 * a}（恒定）`,
        '椭圆反射镜因此能把一个焦点发出的所有光汇聚到另一个焦点 —— 激光谐振腔、碎石机都利用它',
      ]);
    } else {
      const p = 2;
      const v = equalView(f, 4, 2, 6.5);
      const curvePts: Array<[number, number]> = [];
      for (let i = 0; i <= 160; i++) {
        const y = -4 + (i / 160) * 8;
        const x = (y * y) / (4 * p);
        curvePts.push([v.sx(x), v.sy(y)]);
      }
      poly(f, curvePts, { stroke: C.accent, lw: 2.4 });
      const py0 = 1.4;
      const px0 = (py0 * py0) / (4 * p);
      dot(f, v.sx(p), v.sy(0), 5, C.green);
      text(f, '焦点 F', v.sx(p) + 6, v.sy(0) - 8, { color: C.green, font: '12px sans-serif' });
      // 平行于轴入射 → 反射到焦点
      for (const y of [-3, -1.6, 1.6, 3]) {
        const x0 = (y * y) / (4 * p);
        seg(f, v.sx(x0 + 6), v.sy(y), v.sx(x0), v.sy(y), C.cool, 1.4);
        seg(f, v.sx(x0), v.sy(y), v.sx(p), v.sy(0), C.warm, 1.6);
      }
      dot(f, v.sx(px0), v.sy(py0), 4, C.fg);
      footnotes(f, [
        '抛物线的光学性质：平行于对称轴入射的光线，反射后全部通过焦点',
        '这就是卫星天线、车灯、太阳能灶做成抛物面（旋转抛物线）的原因',
        '反之，焦点处发出的光经抛物面反射后成为平行光束（探照灯）',
      ]);
    }
    heading(f, `${kind}的光学反射性质`);
  },
});

/** M05 丹德林球。 */
const dandelin = defineViz({
  slug: 'dandelin',
  title: '丹德林球',
  params: {
    angle: { type: 'range', min: 5, max: 60, default: 24, label: '圆锥半顶角(°)' },
    offset: { type: 'range', min: 0.5, max: 3, default: 1.4, step: 0.1, label: '截面高度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const halfAngle = (num(params, 'angle', 24) * Math.PI) / 180;
    const offset = num(params, 'offset', 1.4);
    const v = equalView(f, 0.4, 0, 5.2, 36, 3.6);
    const tan = Math.tan(halfAngle);
    const yTop = 5;
    const yBottom = -2;

    // 圆锥轮廓（双曲线画法：两条母线）
    const lines: Array<[number, number, number, number]> = [
      [0, yBottom, yTop * tan, yTop],
      [0, yBottom, -yTop * tan, yTop],
    ];
    lines.forEach(([x1, y1, x2, y2]) => seg(f, v.sx(x1), v.sy(y1), v.sx(x2), v.sy(y2), C.dim, 1.6));
    // 底面椭圆
    const base: Array<[number, number]> = [];
    for (let i = 0; i <= 100; i++) {
      const t = (i / 100) * Math.PI * 2;
      base.push([v.sx(-yBottom * tan * Math.cos(t)), v.sy(yBottom + 0.5 * Math.sin(t))]);
    }
    poly(f, base, { stroke: C.dim, lw: 1.4 });

    // 截面（斜平面）
    const slope = 0.34;
    const sectionX = (y: number): number => (y - offset) / slope;
    const secPts: Array<[number, number]> = [];
    for (let i = 0; i <= 120; i++) {
      const y = yBottom + (i / 120) * (yTop - yBottom);
      const limit = y * tan;
      const x0 = sectionX(y);
      if (Math.abs(x0) <= limit) secPts.push([v.sx(x0), v.sy(y)]);
    }
    poly(f, secPts, { stroke: C.hot, lw: 2.4 });

    // 两个内切丹德林球（用椭圆近似表示与圆锥相切的球）
    for (const yc of [offset + 1.1, offset - 1.1]) {
      const rr = Math.abs(yc) * tan * 0.98;
      const circlePts: Array<[number, number]> = [];
      for (let i = 0; i <= 100; i++) {
        const t = (i / 100) * Math.PI * 2;
        circlePts.push([v.sx(rr * Math.cos(t)), v.sy(yc + rr * Math.sin(t))]);
      }
      poly(f, circlePts, { stroke: C.cool, lw: 1.6, dash: [5, 4] });
    }

    footnotes(f, [
      `半顶角 ${num(params, 'angle', 24).toFixed(0)}°，截面斜率 0.34（小于母线斜率 ${tan.toFixed(3)}）→ 截线是椭圆`,
      '丹德林球：与圆锥和截面同时相切的球，切点正是椭圆的两个焦点',
      '这个构造给出了圆锥曲线焦点性质的纯几何证明：|PF₁| + |PF₂| = 两切圆之间的母线长度 = 常数',
    ]);
    heading(f, '丹德林球：几何证明圆锥曲线性质');
  },
});

/** M06 共焦二次曲面。 */
const confocalQuadrics = defineViz({
  slug: 'confocal-quadrics',
  title: '共焦二次曲面',
  params: {
    c: { type: 'range', min: 0.5, max: 3, default: 1.6, step: 0.1, label: '焦距参数 c' },
    lambda: { type: 'range', min: -2, max: 4, default: 1, step: 0.1, label: '族参数 λ' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const c = num(params, 'c', 1.6);
    const lambda = num(params, 'lambda', 1);
    const v = equalView(f, 0, 0, 5.4, 38, 3.8);
    grid(f, v, { divisions: 5, ticks: true });
    dot(f, v.sx(-c), v.sy(0), 5, C.warm);
    dot(f, v.sx(c), v.sy(0), 5, C.warm);
    text(f, '共同焦点', v.sx(0), v.sy(0) + 22, { align: 'center', color: C.warm, font: '12px sans-serif' });

    // 一族共焦椭圆：x²/(c²+λ) + y²/(c²+λ-…)，用 a²=c²+λ 表达
    const a2 = c * c + lambda + 2;
    const b2 = a2 - c * c;
    if (a2 > 0 && b2 > 0) {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 200; i++) {
        const t = (i / 200) * Math.PI * 2;
        pts.push([v.sx(Math.sqrt(a2) * Math.cos(t)), v.sy(Math.sqrt(b2) * Math.sin(t))]);
      }
      poly(f, pts, { stroke: C.accent, lw: 2.4, close: true });
    }
    // 一族共焦双曲线：x²/(c²+μ) - y²/… 
    const mu = lambda - 1.5;
    const A2 = c * c + Math.max(mu, 0.01);
    const B2 = Math.max(c * c - A2, 0.01);
    const hpts: Array<[number, number]> = [];
    for (let x = -6; x <= 6; x += 0.05) {
      if (Math.abs(x) < Math.sqrt(A2)) continue;
      const y = Math.sqrt(B2) * Math.sqrt((x * x) / A2 - 1);
      hpts.push([v.sx(x), v.sy(y)]);
    }
    poly(f, hpts, { stroke: C.green, lw: 2, close: false });
    const hpts2 = hpts.map(([x, y]) => [x, v.sy(0) - (y - v.sy(0))] as [number, number]);
    poly(f, hpts2, { stroke: C.green, lw: 2 });

    footnotes(f, [
      `共焦族：所有椭圆与双曲线共享同一对焦点 (±${c}, 0)`,
      '同一族参数 λ 的椭圆与双曲线在交点处正交（切线互相垂直）',
      '共焦坐标是求解拉普拉斯方程、椭球体静电问题的天然坐标系',
    ]);
    heading(f, '共焦二次曲面：正交轨迹族');
  },
});

/** M07 参数方程深化。 */
const parametricM07 = defineViz({
  slug: 'parametric-m07',
  title: '参数方程深化',
  params: {
    kind: { type: 'select', options: ['摆线', '外摆线', '内摆线', '渐开线'], default: '外摆线', label: '曲线族' },
    ratio: { type: 'range', min: 1, max: 6, default: 3, step: 0.5, label: '半径比' },
    t: { type: 'range', min: 0.5, max: 6.5, default: 6.28, step: 0.01, label: '参数范围' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'kind', '外摆线');
    const ratio = num(params, 'ratio', 3);
    const tMax = num(params, 't', 6.28);
    const v = equalView(f, 0, 0, 3.2, 38, 2.6);
    grid(f, v, { divisions: 5, ticks: true });

    const pt = (t: number): [number, number] => {
      if (kind === '外摆线') {
        const R = 1;
        const r = R / ratio;
        return [(R + r) * Math.cos(t) - r * Math.cos(((R + r) / r) * t), (R + r) * Math.sin(t) - r * Math.sin(((R + r) / r) * t)];
      }
      if (kind === '内摆线') {
        const R = 1;
        const r = R / ratio;
        return [(R - r) * Math.cos(t) + r * Math.cos(((R - r) / r) * t), (R - r) * Math.sin(t) - r * Math.sin(((R - r) / r) * t)];
      }
      if (kind === '渐开线') {
        return [Math.cos(t) + t * Math.sin(t), Math.sin(t) - t * Math.cos(t)];
      }
      return [t - Math.sin(t), 1 - Math.cos(t)];
    };

    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 2400; i++) {
      const t = (i / 2400) * tMax;
      const [x, y] = pt(t);
      pts.push([v.sx(x), v.sy(y)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2 });
    const [hx, hy] = pt(tMax);
    dot(f, v.sx(hx), v.sy(hy), 5, C.warm);
    circle(f, v.sx(0), v.sy(0), 1 * unitScale(v), { stroke: 'rgba(160,174,192,0.35)', lw: 1, dash: [4, 4] });

    footnotes(f, [
      `${kind}（半径比 ${ratio}）的参数方程轨迹`,
      '旋轮线族由"圆在圆上滚动"产生：比值决定了花瓣数量与曲线是否闭合',
      '渐开线是"绕线松开时笔尖的轨迹" —— 齿轮齿廓常用渐开线，保证传动比恒定',
    ]);
    heading(f, `参数方程：${kind}`);
  },
});

/** M08 正弦叠加。 */
const sineSuperposition = defineViz({
  slug: 'sine-superposition',
  title: '正弦叠加',
  params: {
    f1: { type: 'range', min: 1, max: 12, default: 6, label: '频率 1' },
    f2: { type: 'range', min: 1, max: 12, default: 7, label: '频率 2' },
    amp2: { type: 'range', min: 0.2, max: 1.5, default: 1, step: 0.1, label: '振幅比' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const f1 = num(params, 'f1', 6);
    const f2 = num(params, 'f2', 7);
    const amp2 = num(params, 'amp2', 1);
    const v = view(f, { xMin: 0, xMax: 1, yMin: -2.6, yMax: 2.6, inset: 36 });

    const wave = (fn: (x: number) => number, color: string, lw: number, dash: number[] = []): void => {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 600; i++) {
        const x = i / 600;
        pts.push([v.sx(x), v.sy(fn(x))]);
      }
      poly(f, pts, { stroke: color, lw, dash });
    };
    seg(f, v.sx(0), v.sy(0), v.sx(1), v.sy(0), C.grid, 1);
    wave((x) => Math.sin(2 * Math.PI * f1 * x), `${C.accent}88`, 1.2, [4, 3]);
    wave((x) => amp2 * Math.sin(2 * Math.PI * f2 * x), `${C.green}88`, 1.2, [4, 3]);
    wave((x) => Math.sin(2 * Math.PI * f1 * x) + amp2 * Math.sin(2 * Math.PI * f2 * x), C.warm, 2.4);

    const beatFreq = Math.abs(f1 - f2);
    footnotes(f, [
      `实线 = 两个正弦波之和（虚线是各自的分量）`,
      `差频 |f₁ - f₂| = ${beatFreq.toFixed(2)}，因此包络的拍频为 ${beatFreq.toFixed(2)} 周期（每单位时间）`,
      '叠加原理：线性系统的输入之和对应输出之和 —— 这正是傅里叶分析成立的前提',
    ]);
    heading(f, '正弦叠加：波的合成与拍频');
  },
});

/** M09 抛物面光学。 */
const parabolaOptics = defineViz({
  slug: 'parabola-optics',
  title: '抛物面光学',
  params: {
    p: { type: 'range', min: 0.5, max: 3, default: 1.4, step: 0.1, label: '焦距 p' },
    aperture: { type: 'range', min: 1, max: 5, default: 3.4, step: 0.2, label: '口径(半宽)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const p = num(params, 'p', 1.4);
    const aperture = num(params, 'aperture', 3.4);
    const v = equalView(f, 1.6, 0, 4.6, 38, 3.4);

    const curvePts: Array<[number, number]> = [];
    for (let i = 0; i <= 200; i++) {
      const y = -aperture + (i / 200) * 2 * aperture;
      curvePts.push([v.sx((y * y) / (4 * p)), v.sy(y)]);
    }
    poly(f, curvePts, { stroke: C.accent, lw: 2.6 });
    dot(f, v.sx(p), v.sy(0), 6, C.warm);
    text(f, `焦点 F(p=${p})`, v.sx(p) + 8, v.sy(0) - 8, { color: C.warm, font: '12px sans-serif' });

    const rays = [-aperture, -aperture * 0.62, -aperture * 0.3, aperture * 0.3, aperture * 0.62, aperture];
    rays.forEach((y) => {
      const x0 = (y * y) / (4 * p);
      seg(f, v.sx(x0 + 2.2), v.sy(y), v.sx(x0), v.sy(y), C.cool, 1.4);
      seg(f, v.sx(x0), v.sy(y), v.sx(p), v.sy(0), C.warm, 1.4);
    });

    footnotes(f, [
      `口径 ±${aperture}，焦距 p = ${p}：平行光全部汇聚到焦点 (${p}, 0)`,
      `抛物面方程 y² = 4px 的几何含义：动点到焦点与到准线 x = -p 的距离相等`,
      '抛物面天线的增益与口径成正比、与波长平方成反比 —— 所以射电望远镜做得越大越好',
    ]);
    heading(f, '抛物面光学：平行光聚焦');
  },
});

/** M10 对数螺线。 */
const logarithmSpiral = defineViz({
  slug: 'logarithm-spiral',
  title: '对数螺线',
  params: {
    b: { type: 'range', min: 0.05, max: 0.5, default: 0.17, step: 0.01, label: '增长参数 b' },
    turns: { type: 'range', min: 1, max: 6, default: 3, label: '圈数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const b = num(params, 'b', 0.17);
    const turns = num(params, 'turns', 3);
    const v = equalView(f, 0, 0, 3.2, 38, 2.8);

    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 1600; i++) {
      const theta = (i / 1600) * Math.PI * 2 * turns;
      const r = 0.02 * Math.exp(b * theta);
      if (r > 3.4) break;
      pts.push([v.sx(r * Math.cos(theta)), v.sy(r * Math.sin(theta))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.4 });
    dot(f, v.sx(0), v.sy(0), 4, C.dim);

    // 等角性质：切线与径向的夹角恒定
    if (pts.length > 400) {
      const p0 = pts[380];
      const p1 = pts[400];
      const ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
      seg(f, p0[0], p0[1], p0[0] + Math.cos(ang) * 70, p0[1] + Math.sin(ang) * 70, C.warm, 2);
      const radialAng = Math.atan2(p0[1] - v.sy(0), p0[0] - v.sx(0));
      seg(f, p0[0], p0[1], p0[0] + Math.cos(radialAng) * 70, p0[1] + Math.sin(radialAng) * 70, C.green, 1.6);
    }

    const angleToRadial = Math.atan(1 / b);
    footnotes(f, [
      `r = e^(bθ)，b = ${b}：每转一圈半径放大 e^(2πb) = ${Math.exp(2 * Math.PI * b).toFixed(3)} 倍`,
      `切线与径向的夹角恒为 arctan(1/b) = ${((angleToRadial * 180) / Math.PI).toFixed(2)}°（等角螺线）`,
      '鹦鹉螺、台风、星系旋臂都接近对数螺线：无论放大多少倍形状都不变（自相似）',
    ]);
    heading(f, '对数螺线：等角与自相似');
  },
});

registerViz(
  complex,
  conicSectionsM02,
  focusDirectrix,
  conicReflection,
  dandelin,
  confocalQuadrics,
  parametricM07,
  sineSuperposition,
  parabolaOptics,
  logarithmSpiral,
);
