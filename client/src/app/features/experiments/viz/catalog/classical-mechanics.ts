import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, clear, curve, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** P01 抛体运动：轨迹、射程与最佳抛射角。 */
const projectileMotion = defineViz({
  slug: 'projectile-motion',
  title: '抛体运动',
  animated: true,
  params: {
    v0: { type: 'range', min: 5, max: 50, default: 30, step: 1, label: '初速度 v₀ (m/s)' },
    angle: { type: 'range', min: 10, max: 80, default: 45, step: 1, label: '抛射角 θ (°)' },
    world: { type: 'select', options: ['地球 g=9.8', '月球 g=1.6', '火星 g=3.7'], default: '地球 g=9.8', label: '重力环境' },
  },
  draw: (f) => {
    const { params } = f;
    const v0 = num(params, 'v0', 30);
    const angle = num(params, 'angle', 45);
    const world = str(params, 'world', '地球 g=9.8');
    const g = world.startsWith('月球') ? 1.6 : world.startsWith('火星') ? 3.7 : 9.8;
    const rad = (angle * Math.PI) / 180;
    const range = (v0 * v0 * Math.sin(2 * rad)) / g;
    const hmax = (v0 * v0 * Math.sin(rad) ** 2) / (2 * g);
    const T = (2 * v0 * Math.sin(rad)) / g;

    const v = view(f, { xMin: 0, xMax: Math.max(range * 1.08, 1), yMin: 0, yMax: Math.max(hmax * 1.2, 1), inset: 46 });
    grid(f, v, { divisions: 5, ticks: true });
    // 完整轨迹
    curve(f, v, (x) => x * Math.tan(rad) - (g * x * x) / (2 * v0 * v0 * Math.cos(rad) ** 2), { color: `${C.accent}66`, lw: 1.8, samples: 300 });
    // 其他角度对比（30° / 60° 同速等射程）
    for (const a of [30, 60]) {
      const r = (a * Math.PI) / 180;
      curve(f, v, (x) => (x <= (v0 * v0 * Math.sin(2 * r)) / g ? x * Math.tan(r) - (g * x * x) / (2 * v0 * v0 * Math.cos(r) ** 2) : NaN), {
        color: `${C.dim}55`, lw: 1, dash: [4, 4], samples: 200,
      });
    }
    // 当前时刻小球（动画循环）
    const phase = (f.t % (T + 1.2)) / T;
    const tt = Math.min(phase, 1);
    const bx = v0 * Math.cos(rad) * tt * T;
    const by = v0 * Math.sin(rad) * tt * T - 0.5 * g * (tt * T) ** 2;
    if (phase <= 1) dot(f, v.sx(bx), v.sy(Math.max(by, 0)), 7, C.warm);
    // 落点与最大高度标注
    seg(f, v.sx(range), v.sy(0), v.sx(range), v.sy(hmax * 0.1), `${C.green}99`, 1.2);
    text(f, `射程 ${range.toFixed(1)} m`, v.sx(range) - 8, v.sy(0) - 12, { align: 'right', color: C.green, font: '12px sans-serif' });
    text(f, `最大高度 ${hmax.toFixed(1)} m`, 10, 44, { color: C.cyan, font: '12px sans-serif' });
    text(f, `飞行时间 ${T.toFixed(2)} s`, 10, 62, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      `v₀ = ${v0} m/s，θ = ${angle}°，${world}：射程 R = v₀²sin2θ/g = ${range.toFixed(2)} m`,
      `45° 时射程最大；30° 与 60° 射程相同（橙色虚线对比）—— 这是"等射程角"关系 sin2θ = sin(180°−2θ)`,
      '水平方向匀速、竖直方向匀变速：运动的独立性是把二维问题拆成两个一维问题的关键',
    ]);
    heading(f, '抛体运动：轨迹与射程');
  },
});
registerViz(projectileMotion);

/** P02 单摆：周期、摆长与等时性。 */
const simplePendulum = defineViz({
  slug: 'simple-pendulum',
  title: '单摆',
  animated: true,
  params: {
    L: { type: 'range', min: 0.3, max: 3, default: 1, step: 0.1, label: '摆长 L (m)' },
    theta0: { type: 'range', min: 5, max: 80, default: 30, step: 1, label: '初始摆角 θ₀ (°)' },
    world: { type: 'select', options: ['地球 g=9.8', '月球 g=1.6', '木星 g=24.8'], default: '地球 g=9.8', label: '重力环境' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const L = num(params, 'L', 1);
    const theta0 = (num(params, 'theta0', 30) * Math.PI) / 180;
    const world = str(params, 'world', '地球 g=9.8');
    const g = world.startsWith('月球') ? 1.6 : world.startsWith('木星') ? 24.8 : 9.8;
    const T = 2 * Math.PI * Math.sqrt(L / g);

    clear(f);
    const px = w / 2;
    const py = 56;
    const Lpx = Math.min(h - 130, 60 + L * 85);
    const phase = (f.t % T) / T;
    const th = theta0 * Math.cos(2 * Math.PI * phase);

    // 摆动圆弧
    const arc: [number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const a = -theta0 + (2 * theta0 * i) / 40;
      arc.push([px + Lpx * Math.sin(a), py + Lpx * Math.cos(a)]);
    }
    poly(f, arc, { stroke: `${C.dim}66`, lw: 1, dash: [4, 4] } as any);
    // 悬点与摆线
    seg(f, px - 26, py, px + 26, py, C.dim, 3);
    const bx = px + Lpx * Math.sin(th);
    const by = py + Lpx * Math.cos(th);
    seg(f, px, py, bx, by, C.fg, 2);
    dot(f, px, py, 4, C.dim);
    dot(f, bx, by, 11, C.warm);
    // 平衡位置参考线
    seg(f, px, py, px, py + Lpx + 14, `${C.grid}aa`, 1);
    // 当前角度
    text(f, `θ = ${((th * 180) / Math.PI).toFixed(1)}°`, px + 14, py + 30, { color: C.cyan, font: '13px sans-serif' });
    // 摆长标尺
    seg(f, px - Lpx * 0 - 40, py, px - 40, py + Lpx, C.cool, 2);
    text(f, `L=${L}m`, px - 96, py + Lpx / 2, { color: C.cool, font: '12px sans-serif' });

    footnotes(f, [
      `周期 T = 2π√(L/g) = ${T.toFixed(3)} s（${world}）；摆长增 4 倍、周期加倍`,
      `小角近似（θ₀ < ~15°）下单摆等时：周期与振幅无关 —— 摆钟据此计时（当前 θ₀ = ${((theta0 * 180) / Math.PI).toFixed(0)}°）`,
      '回复力 F = −(mgL)θ：重力切向分量与位移反向，构成简谐振动的条件（回复力 ∝ −位移）',
    ]);
    heading(f, '单摆：周期与等时性');
  },
});
registerViz(simplePendulum);

/** P03 弹簧振子与相图。 */
const springOscillator = defineViz({
  slug: 'spring-oscillator',
  title: '弹簧振子与相图',
  animated: true,
  params: {
    k: { type: 'range', min: 2, max: 40, default: 16, step: 1, label: '劲度系数 k (N/m)' },
    m: { type: 'range', min: 0.5, max: 5, default: 1, step: 0.1, label: '质量 m (kg)' },
    gamma: { type: 'range', min: 0, max: 2, default: 0, step: 0.1, label: '阻尼 γ (1/s)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const k = num(params, 'k', 16);
    const m = num(params, 'm', 1);
    const gamma = num(params, 'gamma', 0);
    const omega0 = Math.sqrt(k / m);
    const under = gamma < 2 * omega0;
    const omega = under ? Math.sqrt(omega0 * omega0 - (gamma / 2) ** 2) : 0;
    const x = (t: number): number => (under ? Math.exp((-gamma / 2) * t) * Math.cos(omega * t) : Math.exp((-gamma / 2) * t) * Math.cosh(Math.sqrt((gamma / 2) ** 2 - omega0 * omega0) * t));

    // 上半：弹簧-质量示意
    clear(f);
    const cy = h * 0.26;
    const wallX = 56;
    const blockW = 54;
    const tt = f.t;
    const xv = x(tt);
    const restX = w * 0.52;
    const blockX = restX + xv * (w * 0.14);
    seg(f, wallX, cy - 40, wallX, cy + 40, C.dim, 3);
    const spring: [number, number][] = [];
    const coils = 8;
    const span = blockX - wallX;
    for (let i = 0; i <= coils * 2; i++) {
      const sx = wallX + (span * i) / (coils * 2);
      spring.push([sx, i === 0 || i === coils * 2 ? cy : cy + (i % 2 === 0 ? -14 : 14)]);
    }
    poly(f, spring, { stroke: C.cool, lw: 2 });
    // 平衡位置
    seg(f, restX, cy - 46, restX, cy + 46, `${C.grid}cc`, 1);
    text(f, '平衡位置', restX - 6, cy + 60, { align: 'center', color: C.dim, font: '11px sans-serif' });
    // 质量块
    poly(f, [[blockX, cy - 22], [blockX + blockW, cy - 22], [blockX + blockW, cy + 22], [blockX, cy + 22]], { stroke: C.warm, lw: 2, fill: `${C.warm}33` } as any);
    text(f, `${m}kg`, blockX + blockW / 2, cy + 5, { align: 'center', color: C.fg, font: '12px sans-serif' });
    text(f, `x = ${xv.toFixed(3)} m`, blockX + blockW / 2, cy - 32, { align: 'center', color: C.cyan, font: '12px sans-serif' });

    // 下半：x(t) 曲线（自定义屏幕映射）
    const x0 = 46, x1 = w - 16, y0 = h - 30, y1 = h * 0.48;
    const sx = (t: number) => x0 + (t / 10) * (x1 - x0);
    const sy = (val: number) => y1 + ((1.6 - val) / 3.2) * (y0 - y1);
    // 网格
    for (let i = 0; i <= 4; i++) {
      const gy = y1 + (i / 4) * (y0 - y1);
      seg(f, x0, gy, x1, gy, `${C.grid}88`, 1);
    }
    seg(f, x0, sy(0), x1, sy(0), C.grid, 1.4);
    // 曲线
    const pts: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const t = (i / 300) * 10;
      pts.push([sx(t), sy(x(t))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.2 });
    // 当前时刻
    const ct = tt % 10;
    dot(f, sx(ct), sy(x(ct)), 6, C.warm);
    seg(f, sx(ct), y1, sx(ct), y0, `${C.warm}55`, 1);
    text(f, 'x(t)', x1 - 4, y1 + 14, { align: 'right', color: C.accent, font: '12px sans-serif' });

    const period = under ? ((2 * Math.PI) / omega).toFixed(3) : '—';
    footnotes(f, [
      `ω₀ = √(k/m) = ${omega0.toFixed(3)} rad/s，周期 T = ${period}${under ? ' s' : '（过阻尼不振荡）'}，当前阻尼 γ = ${gamma}`,
      'x(t) = e^(−γt/2)·cos(ωt)：能量在动能与势能间交换，阻尼使振幅按指数衰减（相轨迹收缩为螺线）',
      'k 决定"劲度"、m 决定"惯性"：k/m 比值才是频率的来源 —— 弹簧更硬或质量更小都振得更快',
    ]);
    heading(f, '弹簧振子：示意与位移曲线');
  },
});
registerViz(springOscillator);

/** P04 动量守恒与弹性碰撞。 */
const elasticCollision = defineViz({
  slug: 'elastic-collision',
  title: '动量守恒与弹性碰撞',
  animated: true,
  params: {
    m1: { type: 'range', min: 0.5, max: 5, default: 1, step: 0.1, label: '球 1 质量 (kg)' },
    m2: { type: 'range', min: 0.5, max: 5, default: 2, step: 0.1, label: '球 2 质量 (kg)' },
    v1: { type: 'range', min: -4, max: 6, default: 4, step: 0.5, label: '球 1 初速 (m/s)' },
    v2: { type: 'range', min: -4, max: 4, default: 0, step: 0.5, label: '球 2 初速 (m/s)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const m1 = num(params, 'm1', 1);
    const m2 = num(params, 'm2', 2);
    const u1 = num(params, 'v1', 4);
    const u2 = num(params, 'v2', 0);
    // 一维弹性碰撞解
    const v1 = ((m1 - m2) * u1 + 2 * m2 * u2) / (m1 + m2);
    const v2 = ((m2 - m1) * u2 + 2 * m1 * u1) / (m1 + m2);
    const pBefore = m1 * u1 + m2 * u2;
    const pAfter = m1 * v1 + m2 * v2;
    const eBefore = 0.5 * m1 * u1 * u1 + 0.5 * m2 * u2 * u2;
    const eAfter = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;

    clear(f);
    const trackY = h * 0.42;
    const left = 40, right = w - 40;
    const r1 = 14 + 8 * Math.cbrt(m1);
    const r2 = 14 + 8 * Math.cbrt(m2);
    const x1_0 = left + r1, x2_0 = w * 0.55;
    // 碰撞时刻（速度不同才碰撞）
    const tc = Math.abs(u1 - u2) > 1e-6 ? (x2_0 - x1_0) / (u1 - u2) : -1;
    const tEnd = 3.2;
    const phase = (f.t % (tEnd + 0.8)) / tEnd;
    const now = Math.min(phase, 1) * tEnd;

    const pos = (x0: number, u: number, after: boolean, uu: number): number => {
      if (!after) return x0 + u * Math.max(0, Math.min(now, tc > 0 ? tc : tEnd)) * 42;
      if (tc < 0) return x0 + u * now * 42;
      return (x0 + u * tc * 42) + uu * (now - tc) * 42;
    };
    const cx1 = pos(x1_0, u1, now > tc && tc > 0, v1);
    const cx2 = pos(x2_0, u2, now > tc && tc > 0, v2);

    // 轨道
    seg(f, left, trackY + 34, right, trackY + 34, C.dim, 2);
    // 球
    dot(f, Math.max(cx1, left + r1), trackY, r1, C.accent);
    dot(f, Math.min(Math.max(cx2, left + r2), right - r2), trackY, r2, C.warm);
    text(f, `m₁=${m1}`, Math.max(cx1, left + r1), trackY + 4, { align: 'center', color: '#fff', font: '11px sans-serif' });
    text(f, `m₂=${m2}`, Math.min(Math.max(cx2, left + r2), right - r2), trackY + 4, { align: 'center', color: '#fff', font: '11px sans-serif' });
    // 碰撞标记
    if (tc > 0 && tc < tEnd) {
      const cxHit = x1_0 + u1 * tc * 42;
      seg(f, cxHit, trackY - 46, cxHit, trackY + 34, `${C.hot}77`, 1);
      text(f, `t=${tc.toFixed(2)}s 碰撞`, cxHit + 6, trackY - 52, { color: C.hot, font: '11px sans-serif' });
    }
    // 碰撞后速度读数区
    const rowY = h * 0.66;
    text(f, `碰撞前：v₁=${u1}  v₂=${u2}   p=${pBefore.toFixed(2)}   E=${eBefore.toFixed(2)}`, 24, rowY, { color: C.cyan, font: '13px sans-serif' });
    text(f, `碰撞后：v₁'=${v1.toFixed(2)}  v₂'=${v2.toFixed(2)}   p=${pAfter.toFixed(2)}   E=${eAfter.toFixed(2)}`, 24, rowY + 24, { color: C.green, font: '13px sans-serif' });

    footnotes(f, [
      `一维弹性碰撞：v₁' = ((m₁−m₂)v₁ + 2m₂v₂)/(m₁+m₂)，动量守恒 ${Math.abs(pBefore - pAfter) < 1e-9 ? '✓' : '✗'}，动能守恒 ${Math.abs(eBefore - eAfter) < 1e-6 ? '✓' : '✗'}`,
      '等质量交换速度；质量悬殊时，轻球近乎原速反弹（台球"母球撞定球"的物理）',
      '弹性碰撞同时守恒动量与动能；若碰撞变形耗能（非弹性），动能不守恒但动量始终守恒',
    ]);
    heading(f, '弹性碰撞：动量与动能守恒');
  },
});
registerViz(elasticCollision);
