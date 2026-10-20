import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text, view, grid, curve, circle, vec, rng } from '../canvas';

/** P467 简谐振动的相位圆表示。 */
const shmPhaseCircle = defineViz({
  slug: 'shm-phase-circle',
  title: '简谐振动的相位圆表示',
  params: { phase: { type: 'range', min: 0, max: 6.28, default: 1.2, step: 0.05, label: '初相 φ (rad)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const phi = num(params, 'phase', 1.2);
    clear(f);
    // 左：旋转矢量圆
    const cx = w * 0.26, cy = h * 0.44, R = 110;
    circle(f, cx, cy, R, { stroke: C.grid, lw: 1.6, dash: [6, 5] });
    seg(f, cx - R - 24, cy, cx + R + 24, cy, C.dim, 1.4);
    seg(f, cx, cy - R - 24, cx, cy + R + 24, C.dim, 1.4);
    const th = f.t * 2 + phi;
    const px = cx + Math.cos(th) * R, py = cy - Math.sin(th) * R;
    vec(f, cx, cy, px, py, C.accent, 3);
    dot(f, px, py, 7, C.hot);
    // 投影到 x 轴
    seg(f, cx, cy, px, cy, `${C.yellow}aa`, 1.6);
    seg(f, px, py, px, cy, `${C.yellow}77`, 1.4);
    text(f, 'x = A cos(ωt+φ)', cx - 66, cy + R + 46, { color: C.yellow, font: '14px serif' });
    text(f, `相位 ωt+φ = ${(th % (2 * Math.PI)).toFixed(2)} rad`, cx - 66, cy + R + 70, { color: C.dim, font: '12px sans-serif' });
    text(f, 'A', (cx + px) / 2, cy - 8, { align: 'center', color: C.accent, font: '13px serif' });
    // 右：x、v、a 三条曲线相位差
    const gx0 = w * 0.5, gx1 = w - 50, gy0 = h * 0.62, gy1 = h * 0.2;
    const T = 2 * Math.PI;
    const sx = (t: number) => gx0 + (t / T) * (gx1 - gx0);
    const sy = (y: number) => gy0 - ((y + 1.6) / 3.2) * (gy0 - gy1);
    seg(f, gx0, sy(0), gx1, sy(0), C.grid, 1.2);
    const curves: Array<[string, (t: number) => number]> = [
      ['x(t)', (t) => Math.cos(t + phi)],
      ['v(t)/ω', (t) => -Math.sin(t + phi)],
      ['a(t)/ω²', (t) => -Math.cos(t + phi)],
    ];
    const colors = [C.yellow, C.green, C.hot];
    curves.forEach(([, fn], i) => {
      const pts: Array<[number, number]> = [];
      for (let k = 0; k <= 200; k++) {
        const t = (k / 200) * T;
        pts.push([sx(t), sy(fn(t))]);
      }
      poly(f, pts, { stroke: colors[i], lw: 2.2 });
      text(f, curves[i][0], gx0 + 6, gy1 + 20 + i * 22, { color: colors[i], font: '13px serif' });
    });
    // 当前时刻
    const tNow = (f.t * 2) % T;
    seg(f, sx(tNow), gy1, sx(tNow), gy0, `${C.cool}99`, 1.4);
    dot(f, sx(tNow), sy(Math.cos(tNow + phi)), 5, C.yellow);
    footnotes(f, [
      '旋转矢量在 x 轴投影 = 简谐振动：圆周匀速 ⇔ 直线简谐（投影运动学）',
      'v 超前 x 相位 π/2，a 超前 x 相位 π —— 求相位差画一个圆最快',
      '同频振动合成：先画矢量再相加，相位差 Δφ 决定合振幅 A²=A₁²+A₂²+2A₁A₂cosΔφ',
    ]);
    heading(f, '一个旋转矢量看清三个相位');
  },
});
registerViz(shmPhaseCircle);

/** P468 振动合成与李萨如图形。 */
const lissajousFigures = defineViz({
  slug: 'lissajous-figures',
  title: '振动合成与李萨如图形',
  params: { ratio: { type: 'select', options: ['1:1', '1:2', '2:3', '3:4'], default: '1:2', label: '频率比 ωx:ωy' }, phase: { type: 'range', min: 0, max: 3.14, default: 1.57, step: 0.05, label: '相位差 Δφ' } },
  draw: (f) => {
    const { w, h, params } = f;
    const ratioStr = str(params, 'ratio', '1:2');
    const dphi = num(params, 'phase', 1.57);
    const [rx, ry] = ratioStr.split(':').map(Number);
    clear(f);
    const cx = w * 0.5, cy = h * 0.46;
    const Ax = w * 0.3, Ay = h * 0.34;
    // 参考矩形
    poly(f, [[cx - Ax, cy - Ay], [cx + Ax, cy - Ay], [cx + Ax, cy + Ay], [cx - Ax, cy + Ay]],
      { stroke: `${C.grid}aa`, lw: 1.2, dash: [6, 5] });
    // 李萨如曲线
    const pts: Array<[number, number]> = [];
    const T = (2 * Math.PI * Math.max(rx, ry)) / 1;
    for (let k = 0; k <= 600; k++) {
      const t = (k / 600) * T;
      pts.push([cx + Math.cos(t * rx) * Ax, cy - Math.sin(t * ry + dphi) * Ay]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.6 });
    // 轴上的投影点
    dot(f, cx + Math.cos(f.t * 2 * rx) * Ax, cy - Ay - 22, 6, C.yellow);
    dot(f, cx + Ax + 24, cy - Math.sin(f.t * 2 * ry + dphi) * Ay, 6, C.green);
    seg(f, cx + Math.cos(f.t * 2 * rx) * Ax, cy - Ay - 16, cx + Math.cos(f.t * 2 * rx) * Ax, cy - Ay, `${C.yellow}aa`, 1.4);
    seg(f, cx + Ax, cy - Math.sin(f.t * 2 * ry + dphi) * Ay, cx + Ax + 18, cy - Math.sin(f.t * 2 * ry + dphi) * Ay, `${C.green}aa`, 1.4);
    text(f, `ωx : ωy = ${ratioStr}，Δφ = ${dphi.toFixed(2)} rad`, 60, h - 128, { color: C.fg, font: '15px serif' });
    const degenerate = rx === ry;
    text(f, degenerate
      ? (Math.abs(dphi - Math.PI / 2) < 0.1 ? '1:1 且 Δφ=π/2 ⇒ 圆' : '1:1 ⇒ 直线（椭圆退化）')
      : '频率比有理数 ⇒ 闭合曲线；无理数 ⇒ 永不重合填满矩形',
      60, h - 100, { color: C.yellow, font: '14px sans-serif' });
    footnotes(f, [
      '李萨如图形测频：已知一轴频率，数切点数比即得未知频率（示波器经典用法）',
      '切线接触数 n_x/n_y = ω_y/ω_x —— 频率比=图形的拓扑指纹',
      '相位差改变只"扭"曲线不改频率比：图形族由 Δφ 参数化',
    ]);
    heading(f, '频率比与相位差决定图形身份');
  },
});
registerViz(lissajousFigures);

/** P469 受迫振动与共振峰。 */
const forcedResonancePeak = defineViz({
  slug: 'forced-resonance-peak',
  title: '受迫振动与共振峰',
  params: { zeta: { type: 'range', min: 0.02, max: 0.6, default: 0.1, step: 0.02, label: '阻尼比 ζ' }, drive: { type: 'range', min: 0.2, max: 3, default: 1, step: 0.05, label: '驱动频率 ω/ω₀' } },
  draw: (f) => {
    const { w, h, params } = f;
    const zeta = num(params, 'zeta', 0.1);
    const r = num(params, 'drive', 1);
    clear(f);
    // 幅频曲线 A(ω)
    const v = view(f, { xMin: 0, xMax: 3, yMin: 0, yMax: 5.5, inset: 46, insetBottom: 46 });
    grid(f, v);
    const amp = (x: number) => 1 / Math.sqrt(Math.pow(1 - x * x, 2) + Math.pow(2 * zeta * x, 2));
    const pts: Array<[number, number]> = [];
    for (let i = 1; i <= 300; i++) {
      const x = (i / 300) * 3;
      pts.push([v.sx(x), v.sy(Math.min(5.5, amp(x)))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.8 });
    // 共振点
    const xr = Math.sqrt(Math.max(0, 1 - 2 * zeta * zeta));
    const ar = amp(xr);
    dot(f, v.sx(xr), v.sy(Math.min(5.5, ar)), 7, C.hot);
    text(f, `ω_共振 ≈ ${xr.toFixed(2)}ω₀，A_max = ${(1 / (2 * zeta)).toFixed(1)}`, v.sx(xr) + 12, v.sy(Math.min(5.4, ar)) - 8, { color: C.hot, font: '13px sans-serif' });
    // 当前驱动
    const cur = Math.min(5.5, amp(r));
    seg(f, v.sx(r), v.sy(0), v.sx(r), v.sy(cur), `${C.yellow}aa`, 1.8);
    dot(f, v.sx(r), v.sy(cur), 6, C.yellow);
    text(f, `当前 A = ${cur.toFixed(2)} (静力伸长为 1)`, v.sx(r) + 10, v.sy(cur) - 12, { color: C.yellow, font: '13px sans-serif' });
    // 半功率带宽
    if (ar > 0.8) {
      const half = ar / Math.SQRT2;
      const w1 = zeta < 0.7 ? Math.sqrt(1 - 2 * zeta * zeta + Math.sqrt(4 * zeta * zeta * zeta * zeta - 4 * zeta * zeta + 2)) : 1;
      void w1;
      seg(f, v.sx(0.4), v.sy(half), v.sx(Math.min(2.6, xr + 4 * zeta + 0.4)), v.sy(half), `${C.green}cc`, 1.6);
      text(f, '半功率带宽 Δω ≈ 2ζω₀ ⇒ Q = 1/2ζ', v.sx(0.45), v.sy(half) - 8, { color: C.green, font: '13px sans-serif' });
    }
    text(f, 'ω/ω₀', (v.sx(0) + v.sx(3)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, '振幅放大倍数', v.sx(0.1), v.sy(5.3), { color: C.dim, font: '12px sans-serif' });
    text(f, '相位：ω<ω₀ 同相，ω=ω₀ 差 π/2，ω>ω₀ 反相', 60, h - 116, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '稳态解 x = A cos(ωt−δ)：暂态 e^(−ζω₀t) 很快死掉，留下强迫的单一频率',
      '共振峰位置随阻尼左移：ζ→0 时发散（小阻尼危险区——桥梁与士兵齐步走）',
      'Q 大=峰尖=选频好：钟表、收音机中频、原子跃迁都靠高 Q',
    ]);
    heading(f, '振幅冲顶与相位翻转');
  },
});
registerViz(forcedResonancePeak);

/** P470 阻尼振动的能量衰减。 */
const dampedQFactor = defineViz({
  slug: 'damped-q-factor',
  title: '阻尼振动的能量衰减',
  params: { zeta: { type: 'range', min: 0.01, max: 0.5, default: 0.06, step: 0.01, label: '阻尼比 ζ' } },
  draw: (f) => {
    const { w, h, params } = f;
    const zeta = num(params, 'zeta', 0.06);
    clear(f);
    const v = view(f, { xMin: 0, xMax: 14, yMin: -1.1, yMax: 1.1, inset: 46, insetBottom: 46 });
    grid(f, v);
    const beta = zeta * 1;
    // 振荡
    const x = (t: number) => Math.exp(-beta * t) * Math.cos(t * 3);
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 400; i++) {
      const t = (i / 400) * 14;
      pts.push([v.sx(t), v.sy(x(t))]);
    }
    poly(f, pts, { stroke: C.cool, lw: 2.2 });
    // 包络 ±e^(−βt)
    for (const sgn of [1, -1]) {
      const env: Array<[number, number]> = [];
      for (let i = 0; i <= 200; i++) {
        const t = (i / 200) * 14;
        env.push([v.sx(t), v.sy(sgn * Math.exp(-beta * t))]);
      }
      poly(f, env, { stroke: C.warm, lw: 1.8, dash: [7, 5] });
    }
    // 能量包络 e^(−2βt)
    const ePts: Array<[number, number]> = [];
    for (let i = 0; i <= 200; i++) {
      const t = (i / 200) * 14;
      ePts.push([v.sx(t), v.sy(Math.exp(-2 * beta * t))]);
    }
    poly(f, ePts, { stroke: C.hot, lw: 2.4 });
    // 振幅减半标注
    const tHalf = Math.LN2 / beta;
    if (tHalf < 14) {
      seg(f, v.sx(tHalf), v.sy(0), v.sx(tHalf), v.sy(0.5), `${C.yellow}aa`, 1.6);
      dot(f, v.sx(tHalf), v.sy(0.5), 5, C.yellow);
      text(f, `包络减半 t = ${tHalf.toFixed(1)}`, v.sx(tHalf) + 8, v.sy(0.58), { color: C.yellow, font: '13px sans-serif' });
    }
    const Q = 1 / (2 * zeta);
    text(f, `x(t) = e^(−ζω₀t)·cos(ω_d t)　Q = 1/(2ζ) = ${Q.toFixed(1)}`, 52, h - 128, { color: C.fg, font: '15px serif' });
    text(f, `每周期能量损失 ΔE/E ≈ 2π/Q = ${(2 * Math.PI / Q).toFixed(3)}（小阻尼）`, 52, h - 100, { color: C.hot, font: '14px sans-serif' });
    text(f, '蓝=位移　橙虚=振幅包络 e^(−βt)　红=能量包络 e^(−2βt)', 52, h - 72, { color: C.dim, font: '13px sans-serif' });
    footnotes(f, [
      '欠阻尼 ζ<1 才有振荡：ω_d = ω₀√(1−ζ²)（阻尼使频率略降）',
      'Q 的三种读法：2π×(储存能量/每周期损耗)、1/2ζ、f₀/Δf —— 全部等价',
      '对数减缩 δ = ln(x_n/x_{n+1}) = 2πζ/√(1−ζ²)：敲钟听音估阻尼的实验法',
    ]);
    heading(f, '振幅 e^(−βt)，能量 e^(−2βt)');
  },
});
registerViz(dampedQFactor);

/** P471 转动惯量与平行轴定理。 */
const inertiaParallelAxis = defineViz({
  slug: 'inertia-parallel-axis',
  title: '转动惯量与平行轴定理',
  params: { shape: { type: 'select', options: ['圆环', '圆盘', '细杆', '空心球'], default: '圆盘', label: '形体' }, d: { type: 'range', min: 0, max: 3, default: 1.4, step: 0.05, label: '轴距 d/R' } },
  draw: (f) => {
    const { w, h, params } = f;
    const shape = str(params, 'shape', '圆盘');
    const d = num(params, 'd', 1.4);
    clear(f);
    const base: Record<string, [string, number, number]> = {
      '圆环': ['MR²', 1, 1],
      '圆盘': ['½MR²', 0.5, 1],
      '细杆': ['⅓ML² (端轴)', 0.333, 1.3],
      '空心球': ['⅔MR² (薄壳)', 0.667, 1],
    };
    const [formula, k, sizeScale] = base[shape] ?? base['圆盘'];
    // 图形
    const cx = w * 0.3, cy = h * 0.44, R = 96 * sizeScale;
    if (shape === '圆环') {
      circle(f, cx, cy, R, { stroke: C.accent, lw: 14, fill: 'rgba(102,126,234,0.15)' });
    } else if (shape === '圆盘') {
      circle(f, cx, cy, R, { fill: 'rgba(102,126,234,0.45)', stroke: C.accent, lw: 2.4 });
    } else if (shape === '细杆') {
      poly(f, [[cx - R, cy - 10], [cx + R, cy - 10], [cx + R, cy + 10], [cx - R, cy + 10]], { fill: 'rgba(102,126,234,0.6)', stroke: C.accent, lw: 2 });
    } else {
      circle(f, cx, cy, R, { stroke: C.accent, lw: 8, fill: 'rgba(102,126,234,0.25)' });
      circle(f, cx, cy, R - 14, { stroke: `${C.accent}66`, lw: 2 });
    }
    // 质心轴（穿过质心）
    seg(f, cx, cy - R - 30, cx, cy + R + 30, C.green, 2.4);
    dot(f, cx, cy, 6, C.green);
    text(f, 'C（质心轴）', cx + 10, cy - R - 34, { color: C.green, font: '13px serif' });
    // 平移后的轴
    const ax = cx + d * 90;
    seg(f, ax, cy - R - 44, ax, cy + R + 44, C.hot, 2.6, );
    text(f, '轴′', ax + 8, cy - R - 46, { color: C.hot, font: '13px serif' });
    // 距离标注
    seg(f, cx, cy + R + 20, ax, cy + R + 20, C.yellow, 2);
    text(f, `d = ${d.toFixed(2)}R`, (cx + ax) / 2 - 20, cy + R + 40, { color: C.yellow, font: '14px serif' });
    // 公式
    const kTotal = k + d * d * (shape === '细杆' ? 0.6 : 1);
    text(f, `I_质心 = ${formula}　（MR² 单位：${k.toFixed(2)}）`, w * 0.58, h * 0.3, { color: C.green, font: '15px serif' });
    text(f, `I = I_c + Md² = ${k.toFixed(2)} + ${d.toFixed(2)}² = ${kTotal.toFixed(2)} MR²`, w * 0.58, h * 0.3 + 34, { color: C.hot, font: '15px serif' });
    text(f, '平行轴必须过质心起步，否则 M d² 项不算数', w * 0.58, h * 0.3 + 68, { color: C.yellow, font: '14px sans-serif' });
    text(f, '转动动能 T = ½Iω²：换轴即换惯量，转起来"沉不沉"看轴在哪', w * 0.58, h * 0.3 + 102, { color: C.dim, font: '13px sans-serif' });
    footnotes(f, [
      '定义 I = Σmᵢrᵢ²（离散）或 ∫r²dm（连续）：质量离轴越远惯量越大',
      '垂直轴定理（薄板）：I_z = I_x + I_y —— 与平行轴定理配对使用',
      '考试套路：先查质心轴公式，再平移；组合体拆件算后相加',
    ]);
    heading(f, '先算质心轴，再平移');
  },
});
registerViz(inertiaParallelAxis);

/** P472 角动量守恒的综合应用。 */
const angularMomentumScenarios = defineViz({
  slug: 'angular-momentum-scenarios',
  title: '角动量守恒的综合应用',
  params: { scene: { type: 'select', options: ['花样滑冰', '卫星变轨', '碰撞斜轴'], default: '花样滑冰', label: '场景' } },
  draw: (f) => {
    const { w, h, params } = f;
    const scene = str(params, 'scene', '花样滑冰');
    clear(f);
    const cx = w * 0.3, cy = h * 0.46;
    if (scene === '花样滑冰') {
      const t = f.t;
      const spread = 60 - 40 * (Math.sin(t * 0.8) * 0.5 + 0.5);
      const omega = (60 * 60) / Math.max(18, spread * spread) * 0.02;
      const ang = t * omega * 60;
      // 旋转的手臂与腿
      for (const sgn of [1, -1]) {
        const a = ang;
        const ex = cx + Math.cos(a) * 90 * sgn, ey = cy - Math.sin(a) * 90 * sgn * 0.45;
        vec(f, cx, cy, ex, ey, C.cool, 3);
        dot(f, ex, ey, 6, C.cool);
        const lx = cx + Math.cos(a + 1.8) * (40 + spread) * sgn, ly = cy - Math.sin(a + 1.8) * (40 + spread) * sgn * 0.45;
        vec(f, cx, cy, lx, ly, C.warm, 3);
      }
      circle(f, cx, cy, 16, { fill: C.pink, stroke: C.pink, lw: 2 });
      text(f, `臂展收放 ⇒ ω ∝ 1/I`, cx - 90, cy + 130, { color: C.fg, font: '15px sans-serif' });
      text(f, 'L = Iω 守恒（竖直轴无力矩）', cx - 90, cy + 158, { color: C.yellow, font: '14px sans-serif' });
    } else if (scene === '卫星变轨') {
      circle(f, cx, cy, 40, { fill: 'rgba(66,153,225,0.7)', stroke: C.cool, lw: 2 });
      const { ctx } = f;
      ctx.save();
      ctx.strokeStyle = C.grid;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.arc(cx, cy, 110, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = C.warm;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 160, 110, 0, -0.6, Math.PI * 1.2);
      ctx.stroke();
      ctx.restore();
      const a1 = f.t * 0.9;
      const px = cx + Math.cos(a1) * 110, py = cy + Math.sin(a1) * 110;
      dot(f, px, py, 7, C.hot);
      // 近地点加速矢量
      const nx = cx + 110, ny = cy;
      dot(f, nx, ny, 8, C.yellow);
      vec(f, nx, ny, nx, ny - 46, C.yellow, 3);
      text(f, 'Δv↑ ⇒ r_a 变大', nx + 12, ny - 40, { color: C.yellow, font: '13px serif' });
      text(f, 'h = r×v 守恒：近地点加速抬远地点', cx - 150, cy + 176, { color: C.fg, font: '14px sans-serif' });
      text(f, '（v 变大而 r 变小乘积不变）', cx - 150, cy + 202, { color: C.dim, font: '13px sans-serif' });
    } else {
      // 碰撞斜轴
      const y0 = h * 0.3;
      const a = f.t % 4;
      const proj = a < 2;
      const bx = 60 + Math.min(a, 2) * (w * 0.3);
      if (proj) {
        dot(f, bx, y0, 9, C.cool);
        vec(f, bx, y0, bx + 70, y0 + 40, C.cool, 2.4);
      } else {
        dot(f, w * 0.7, y0 + 60, 9, C.warm);
        dot(f, w * 0.7 + 60, y0 + 130, 7, C.cool);
        vec(f, w * 0.7, y0 + 60, w * 0.7 + 60, y0 + 130, C.warm, 2);
      }
      seg(f, 50, y0, w - 50, y0, `${C.grid}aa`, 1.4);
      text(f, '擦边碰撞：平动动量守恒但角动量绕质心重分配', 56, h - 156, { color: C.fg, font: '15px sans-serif' });
      text(f, '冲量不过质心 ⇒ 产生转动：Iω = r × J', 56, h - 128, { color: C.yellow, font: '14px sans-serif' });
      text(f, '台球的"跟杆/拉杆"就是控制碰撞点位置', 56, h - 100, { color: C.cool, font: '13px sans-serif' });
    }
    footnotes(f, [
      '守恒判据：外力矩为零（对同一固定轴/点）——先问"对哪个轴"再用',
      '角动量是矢量：方向用右手螺旋定则，进动问题必须矢量操作',
      '刘维尔定理是角动量在相空间的推广：守恒律撑起整个统计力学',
    ]);
    heading(f, '守恒律选对轴的一场狩猎');
  },
});
registerViz(angularMomentumScenarios);

/** P473 碰撞与恢复系数。 */
const collisionRestitution = defineViz({
  slug: 'collision-restitution',
  title: '碰撞与恢复系数',
  params: { e: { type: 'range', min: 0, max: 1, default: 0.6, step: 0.05, label: '恢复系数 e' } },
  draw: (f) => {
    const { w, h, params } = f;
    const e = num(params, 'e', 0.6);
    clear(f);
    // 上：两球碰撞动画
    const gy = h * 0.3;
    seg(f, 40, gy + 46, w - 40, gy + 46, C.grid, 2);
    const cyc = (f.t * 0.5) % 1;
    const x1 = 80 + cyc * (w * 0.42);
    const x2 = w * 0.62 + (1 - cyc) * Math.min(cyc * 2, 1) * (w * 0.2) * 0;
    circle(f, x1, gy, 22, { fill: 'rgba(66,153,225,0.85)', stroke: C.cool, lw: 2 });
    circle(f, x2, gy, 22, { fill: 'rgba(237,137,54,0.85)', stroke: C.warm, lw: 2 });
    text(f, 'm₁', x1, gy + 5, { align: 'center', color: C.bg, font: '14px serif' });
    text(f, 'm₂', x2, gy + 5, { align: 'center', color: C.bg, font: '14px serif' });
    if (cyc < 0.5) {
      vec(f, x1 - 50, gy, x1 - 28, gy, C.cool, 2.6);
      text(f, 'v₁', x1 - 54, gy - 12, { color: C.cool, font: '13px serif' });
    }
    // 下：参数空间图（末速度 vs e）
    const v = view(f, { xMin: 0, xMax: 1, yMin: -1, yMax: 1.4, inset: 50, insetBottom: 52 });
    grid(f, v);
    // 例：m1=m2, v1=v, v2=0 → v1'= (1-e)/2·v, v2'=(1+e)/2·v
    const v1p = (ee: number) => (1 - ee) / 2;
    const v2p = (ee: number) => (1 + ee) / 2;
    const p1: Array<[number, number]> = [], p2: Array<[number, number]> = [];
    for (let i = 0; i <= 60; i++) {
      const ee = i / 60;
      p1.push([v.sx(ee), v.sy(v1p(ee))]);
      p2.push([v.sx(ee), v.sy(v2p(ee))]);
    }
    poly(f, p1, { stroke: C.cool, lw: 2.6 });
    poly(f, p2, { stroke: C.warm, lw: 2.6 });
    dot(f, v.sx(e), v.sy(v1p(e)), 6, C.cool);
    dot(f, v.sx(e), v.sy(v2p(e)), 6, C.warm);
    text(f, "v₁′（被撞者反弹/减速）", v.sx(0.05), v.sy(v1p(0.05)) - 12, { color: C.cool, font: '12px serif' });
    text(f, 'v₂′（获速者）', v.sx(0.45), v.sy(v2p(0.45)) - 12, { color: C.warm, font: '12px serif' });
    const kind = e >= 0.99 ? '完全弹性：动能也守恒' : e <= 0.01 ? '完全非弹性：撞后共速，动能损失最大' : '部分弹性：介于两者之间';
    text(f, `e = ${e.toFixed(2)} ⇒ ${kind}`, 56, h - 122, { color: C.yellow, font: '15px sans-serif' });
    text(f, '质量相等、v₂=0 时：v₁′=(1−e)v/2，v₂′=(1+e)v/2', 56, h - 94, { color: C.fg, font: '14px serif' });
    text(f, '动量恒守恒，动能亏损 ΔE = ½μ(1−e²)v_rel²（μ 折合质量）', 56, h - 66, { color: C.hot, font: '14px sans-serif' });
    footnotes(f, [
      'e 定义为分离接近速度之比：e=1 弹性、e=0 共速 —— 与材料相关（钢球 e≈0.6）',
      '恢复系数测量：下落反弹高度比 = e²（斯利实验）',
      '完全非弹性碰撞动能去哪了：形变、热、声 —— 守恒的是总能量不是机械能',
    ]);
    heading(f, '动量总守恒，动能不一定');
  },
});
registerViz(collisionRestitution);

/** P474 变轨与宇宙速度。 */
const orbitalTransferSpeeds = defineViz({
  slug: 'orbital-transfer-speeds',
  title: '变轨与宇宙速度',
  params: { burn: { type: 'range', min: 0, max: 100, default: 40, step: 5, label: '转移进程 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const prog = num(params, 'burn', 40) / 100;
    clear(f);
    const cx = w * 0.36, cy = h * 0.46;
    // 地球
    circle(f, cx, cy, 34, { fill: 'rgba(66,153,225,0.85)', stroke: C.cool, lw: 2 });
    text(f, '地球', cx, cy + 5, { align: 'center', color: C.bg, font: '13px serif' });
    // 圆轨道
    circle(f, cx, cy, 90, { stroke: `${C.grid}cc`, lw: 1.8, dash: [7, 6] });
    // 转移椭圆（霍曼）
    const { ctx } = f;
    ctx.save();
    ctx.strokeStyle = C.warm;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 40, 90, 160, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // 外圆目标轨道
    circle(f, cx, cy, 220, { stroke: C.green, lw: 1.8, dash: [7, 6] });
    text(f, '低圆轨道 v₁ = 7.9 km/s', cx - 60, cy - 104, { color: C.dim, font: '12px sans-serif' });
    text(f, '目标高轨', cx + 170, cy - 226, { color: C.green, font: '13px sans-serif' });
    // 转移器位置
    const tA = Math.PI + prog * Math.PI;
    const ex = cx + Math.cos(tA) * 90;
    const ey = cy + 40 + Math.sin(tA) * -160;
    dot(f, ex, ey, 8, C.hot);
    // 两次点火点
    dot(f, cx, cy + 90, 7, C.yellow);
    text(f, '①加速入转移轨道', cx + 12, cy + 112, { color: C.yellow, font: '13px sans-serif' });
    dot(f, cx, cy - 220, 7, C.yellow);
    text(f, '②再加速圆化', cx + 12, cy - 230, { color: C.yellow, font: '13px sans-serif' });
    // 右侧速度表
    const bx = w * 0.72;
    const speeds = [
      ['第一宇宙速度（环绕）', 7.9, C.cool],
      ['第二宇宙速度（逃逸）', 11.2, C.warm],
      ['第三宇宙速度（出系）', 16.7, C.pink],
    ] as Array<[string, number, string]>;
    speeds.forEach(([name, v, color], i) => {
      const y = h * 0.24 + i * 66;
      text(f, name, bx, y, { color, font: '14px sans-serif' });
      text(f, `${v} km/s`, bx, y + 24, { color: C.fg, font: '16px serif' });
      poly(f, [[bx + 130, y + 6], [bx + 130 + v * 9, y + 6], [bx + 130 + v * 9, y + 26], [bx + 130, y + 26]], { fill: `${color}88` });
    });
    text(f, '霍曼转移：两次脉冲最省 Δv', bx, h * 0.24 + 3 * 66 + 10, { color: C.yellow, font: '14px sans-serif' });
    text(f, 'v² = GM(2/r − 1/a)　活力公式', bx, h * 0.24 + 3 * 66 + 40, { color: C.fg, font: '14px serif' });
    footnotes(f, [
      '圆轨道速度 v = √(GM/r)：轨道越高跑得越慢（与直觉相反的"高轨慢"）',
      '逃逸速度 = √2 × 环绕速度：能量刚好为零的抛物线轨道',
      '霍曼转移耗时 = 转移椭圆周期一半；同步轨道 36000 km 用它最经济',
    ]);
    heading(f, '能量账本决定燃料下限');
  },
});
registerViz(orbitalTransferSpeeds);

/** P475 达朗贝尔原理与惯性力。 */
const dalembertInertialForce = defineViz({
  slug: 'dalembert-inertial-force',
  title: '达朗贝尔原理与惯性力',
  params: { accel: { type: 'range', min: -3, max: 3, default: 1.5, step: 0.1, label: '车厢加速度 a (m/s²)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'accel', 1.5);
    clear(f);
    // 车厢与斜面
    const boxX = w * 0.28, boxY = h * 0.4, boxW = 300, boxH = 180;
    const shift = a * 14;
    poly(f, [[boxX - shift, boxY], [boxX + boxW - shift, boxY], [boxX + boxW - shift, boxY + boxH], [boxX - shift, boxY + boxH]],
      { stroke: C.cool, lw: 2.4, fill: 'rgba(66,153,225,0.08)' });
    text(f, '车厢 a →', boxX + boxW - shift + 12, boxY - 10, { color: C.cool, font: '14px sans-serif' });
    // 斜面（固定在车厢底）
    const incline = 30 * Math.PI / 180;
    const sx0 = boxX + 30 - shift, sy0 = boxY + boxH - 20;
    const sx1 = sx0 + 240, sy1 = sy0;
    const sx2 = sx1, sy2 = sy0 - 240 * Math.tan(incline);
    poly(f, [[sx0, sy0], [sx1, sy1], [sx2, sy2]], { fill: 'rgba(58,74,99,0.9)', stroke: C.grid, lw: 2 });
    // 物块在斜面中点
    const mx = (sx0 + sx2) / 2, my = (sy0 + sy2) / 2;
    const bx = mx + 18, by = my - 18;
    poly(f, [[bx - 20, by - 20], [bx + 20, by - 20], [bx + 20, by + 20], [bx - 20, by + 20]], { fill: 'rgba(237,137,54,0.8)', stroke: C.warm, lw: 2 });
    text(f, 'm', bx, by + 5, { align: 'center', color: C.bg, font: '15px serif' });
    // 受力：重力、支持、摩擦 + 惯性力
    vec(f, bx, by, bx, by + 84, C.cool, 2.4);
    text(f, 'mg', bx + 6, by + 96, { color: C.cool, font: '13px serif' });
    const nx = -Math.sin(incline), ny = -Math.cos(incline);
    vec(f, bx, by, bx + nx * 74, by + ny * 74, C.green, 2.4);
    text(f, 'N', bx + nx * 80 - 8, by + ny * 80, { color: C.green, font: '13px serif' });
    // 惯性力（反向）
    vec(f, bx, by, bx - a * 20, by, C.hot, 3);
    text(f, `f_惯 = −ma = ${(-a).toFixed(1)}m`, bx - a * 20 - 90, by - 12, { color: C.hot, font: '13px serif' });
    // 静止视角结论
    text(f, '车厢参考系：把 −ma 加进受力图，问题变静力学', 56, h - 146, { color: C.fg, font: '15px sans-serif' });
    const thetaDeg = (incline * 180 / Math.PI).toFixed(0);
    const aCritical = 9.8 * Math.tan(incline);
    text(f, `a > g·tan${thetaDeg}° = ${aCritical.toFixed(2)} m/s² 时物块相对斜面滑动`, 56, h - 118, { color: C.yellow, font: '14px sans-serif' });
    text(f, '动静法列平衡方程：ΣF − ma = 0（牛顿第二定律的移项）', 56, h - 90, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '惯性力是参考系的账，不是真实相互作用 —— 但它在非惯性系里真实地推物体',
      '平动惯性力 −ma 作用在质心；转动参考系还要科氏力 −2mω×v 与离心力',
      '工程惯例：达朗贝尔原理让动力学进入静力学方程组（有限元的理论前身）',
    ]);
    heading(f, '非惯性系里的虚拟惯性力');
  },
});
registerViz(dalembertInertialForce);

/** P476 虚功原理。 */
const virtualWorkPrinciple = defineViz({
  slug: 'virtual-work-principle',
  title: '虚功原理',
  params: { push: { type: 'range', min: -20, max: 20, default: 6, step: 1, label: '虚位移 δx (mm)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const dx = num(params, 'push', 6);
    clear(f);
    // 楔块+杆的机构
    const bx = w * 0.4, by = h * 0.62;
    // 地面
    seg(f, 60, by + 90, w - 60, by + 90, C.grid, 2);
    // 滑块 A（水平）
    const ax = bx + dx * 2.4;
    poly(f, [[ax - 40, by + 46], [ax + 40, by + 46], [ax + 40, by + 86], [ax - 40, by + 86]], { fill: 'rgba(66,153,225,0.75)', stroke: C.cool, lw: 2 });
    text(f, 'A', ax, by + 72, { align: 'center', color: C.bg, font: '16px serif' });
    // 滑块 B（竖直靠墙）
    const bxx = w * 0.72, byy = by - 10 - dx * 2.4;
    poly(f, [[bxx - 34, byy - 30], [bxx + 34, byy - 30], [bxx + 34, byy + 10], [bxx - 34, byy + 10]], { fill: 'rgba(237,137,54,0.75)', stroke: C.warm, lw: 2 });
    text(f, 'B', bxx, byy - 8, { align: 'center', color: C.bg, font: '16px serif' });
    // 墙
    seg(f, bxx + 46, byy - 120, bxx + 46, by + 90, C.grid, 3);
    // 连杆
    seg(f, ax + 40, by + 66, bxx - 34, byy - 10, C.accent, 4);
    text(f, '刚性连杆（长度固定 = 约束）', (ax + bxx) / 2 - 60, by + 20, { color: C.accent, font: '13px sans-serif' });
    // 虚功账本
    const P = 40;
    const ratio = 2.4;
    const wA = -P * dx, wB = -(9.8 * 6) * dx * ratio * 0.16;
    text(f, '虚功账本（允许的虚位移下）：', 56, 90, { color: C.fg, font: '15px sans-serif' });
    text(f, `δW_A = F_A·δx = ${wA.toFixed(1)}`, 56, 124, { color: C.cool, font: '14px serif' });
    text(f, `δW_B = (−G)·δy = ${wB.toFixed(1)}`, 56, 152, { color: C.warm, font: '14px serif' });
    text(f, `平衡时 δW = δW_A + δW_B = 0 ⇒ 消去 δx 得 F_A = ${(-wB / (dx || 1)).toFixed(1)}`, 56, 184, { color: C.yellow, font: '15px serif' });
    text(f, '理想约束（光滑、刚性）不做功 ⇒ 未知约束力全部消失', 56, h - 130, { color: C.green, font: '15px sans-serif' });
    text(f, '虚位移是"瞬时可能的"微小位移，与时间无关、不破坏约束', 56, h - 102, { color: C.dim, font: '14px sans-serif' });
    footnotes(f, [
      '虚功原理：理想约束下平衡 ⇔ ΣFᵢ·δrᵢ = 0 —— 分析力学的第一块基石',
      '与拉格朗日方程同源：δW=0 加上 d/dt(∂T/∂q̇)−∂T/∂q=∂Q 就是动力学',
      '优势：不列约束力方程；机构、桁架、摩擦平衡题尤其高效',
    ]);
    heading(f, '一切虚功之和为零');
  },
});
registerViz(virtualWorkPrinciple);

/** P477 拉格朗日方程解双摆。 */
const doublePendulumLagrange = defineViz({
  slug: 'double-pendulum-lagrange',
  title: '拉格朗日方程解双摆',
  params: { amp: { type: 'range', min: 5, max: 90, default: 35, step: 5, label: '释放角 (°)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const amp = num(params, 'amp', 35) * Math.PI / 180;
    clear(f);
    const px = w * 0.36, py = h * 0.28, L1 = 130, L2 = 110;
    // 用近似解析摆（演示用，真实双摆需数值积分）
    const t = f.t;
    const th1 = amp * Math.cos(t * 1.7);
    const th2 = amp * Math.cos(t * 2.6 + 1.1);
    const x1 = px + Math.sin(th1) * L1, y1 = py + Math.cos(th1) * L1;
    const x2 = x1 + Math.sin(th2) * L2, y2 = y1 + Math.cos(th2) * L2;
    // 支点与杆
    dot(f, px, py, 6, C.dim);
    seg(f, px, py, x1, y1, C.accent, 3);
    seg(f, x1, y1, x2, y2, C.accent, 3);
    circle(f, x1, y1, 13, { fill: C.cool, stroke: C.cool, lw: 2 });
    circle(f, x2, y2, 13, { fill: C.warm, stroke: C.warm, lw: 2 });
    // 角度标注
    seg(f, px, py + 40, px, py + 8, `${C.dim}aa`, 1.4);
    text(f, `θ₁=${(th1 * 180 / Math.PI).toFixed(0)}°`, px + 12, py + 44, { color: C.cool, font: '12px serif' });
    seg(f, x1, y1 + 36, x1, y1 + 14, `${C.dim}aa`, 1.4);
    text(f, `θ₂=${(th2 * 180 / Math.PI).toFixed(0)}°`, x1 + 12, y1 + 40, { color: C.warm, font: '12px serif' });
    // 拉格朗日量板书
    const bx = w * 0.62;
    text(f, 'L = T − V（广义坐标 θ₁, θ₂）', bx, 96, { color: C.fg, font: '16px serif' });
    const lines = [
      'T = ½(m₁+m₂)L₁²θ̇₁² + ½m₂L₂²θ̇₂² + m₂L₁L₂θ̇₁θ̇₂cos(θ₁−θ₂)',
      'V = −(m₁+m₂)gL₁cosθ₁ − m₂gL₂cosθ₂',
      'd/dt(∂L/∂θ̇ᵢ) − ∂L/∂θᵢ = 0　(i = 1, 2)',
    ];
    lines.forEach((s, i) => text(f, s, bx, 134 + i * 44, { color: i === 2 ? C.yellow : C.cool, font: '13px serif' }));
    text(f, '两个二阶耦合 ODE —— 约束力 N₁ N₂ 全程没出现', bx, 290, { color: C.green, font: '14px sans-serif' });
    text(f, '混沌提示：双摆对初值指数敏感（Lyapunov 指数 > 0）', bx, 322, { color: C.hot, font: '14px sans-serif' });
    text(f, '广义坐标数量 = 自由度数 = 2（每根杆一个角）', 56, h - 124, { color: C.fg, font: '15px sans-serif' });
    text(f, '拉格朗日方法把矢量力学变成标量函数求导 —— 机械/机器人动力学的默认语言', 56, h - 96, { color: C.dim, font: '14px sans-serif' });
    footnotes(f, [
      '选广义坐标（角度）后完整约束自动消失，比牛顿法省去全部 N、f',
      '循环坐标（不出现的 q）⇒ 对应动量守恒：对称性与守恒律一一对应（诺特定理）',
      '数值上用欧拉-拉格朗日 + 积分器（蛙跳/龙格库塔）画相图与庞加莱截面',
    ]);
    heading(f, '约束力全部消失的两页方程');
  },
});
registerViz(doublePendulumLagrange);

/** P478 哈密顿方程与相空间。 */
const hamiltonPhaseSpace = defineViz({
  slug: 'hamilton-phase-space',
  title: '哈密顿方程与相空间',
  params: { system: { type: 'select', options: ['单摆（大摆角）', '谐振子', '非线性摆'], default: '单摆（大摆角）', label: '系统' } },
  draw: (f) => {
    const { w, h, params } = f;
    const system = str(params, 'system', '单摆（大摆角）');
    clear(f);
    const v = view(f, { xMin: -3.4, xMax: 3.4, yMin: -3.2, yMax: 3.2, inset: 46, insetBottom: 46 });
    grid(f, v);
    text(f, '横轴 θ　纵轴 p = ∂L/∂θ̇', (v.sx(-3.4) + v.sx(3.4)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    if (system === '谐振子') {
      // 同心椭圆
      for (const r of [0.7, 1.4, 2.1, 2.8]) {
        const pts: Array<[number, number]> = [];
        for (let i = 0; i <= 80; i++) {
          const a = (i / 80) * Math.PI * 2;
          pts.push([v.sx(Math.cos(a) * r), v.sy(Math.sin(a) * r)]);
        }
        poly(f, pts, { stroke: C.cool, lw: 2 });
      }
      // 运动点
      const a = f.t * 1.6;
      dot(f, v.sx(Math.cos(a) * 2.1), v.sy(Math.sin(a) * 2.1), 7, C.hot);
      text(f, 'H = p²/2m + ½mω²x² = E ⇒ 等能线=椭圆', v.sx(-3.2), v.sy(3), { color: C.fg, font: '13px serif' });
      text(f, '相面积 A = ∮p dx = 2πE/ω 不随演化改变', v.sx(-3.2), v.sy(2.5), { color: C.green, font: '13px serif' });
    } else {
      // 摆的相图：鞍点+旋转区
      const E = system === '非线性摆' ? 1.9 : 1.4;
      // 分界线 E=2mgl
      const sep: Array<[number, number]> = [];
      for (let i = 0; i <= 200; i++) {
        const th = -Math.PI + (i / 200) * Math.PI * 2;
        const p = Math.sqrt(Math.max(0, 2 * (2 - (1 - Math.cos(th)) * 2)) * 2);
        sep.push([v.sx(th), v.sy(Math.min(3.1, p))]);
      }
      poly(f, sep, { stroke: C.hot, lw: 2.2 });
      poly(f, sep.map(([x, y]) => [x, v.sy(-v.iy(y))]) as Array<[number, number]>, { stroke: C.hot, lw: 2.2 });
      // 振荡轨道
      for (const k of [0.6, 1.1]) {
        const pts: Array<[number, number]> = [];
        for (let i = 0; i <= 160; i++) {
          const th = -Math.PI + (i / 160) * Math.PI * 2;
          const p = Math.sqrt(Math.max(0, 4 * (1 - Math.cos(th)) * k * 0.5 + k * k * 0.3));
          pts.push([v.sx(th * 0.6), v.sy(Math.min(3, p * 0.5))]);
        }
        poly(f, pts, { stroke: C.cool, lw: 1.8 });
      }
      // 旋转轨道（高能）
      const rot: Array<[number, number]> = [];
      for (let i = 0; i <= 120; i++) {
        const th = (i / 120) * Math.PI * 2;
        rot.push([v.sx(th - Math.PI), v.sy(2.3 + 0.3 * Math.cos(th))]);
      }
      poly(f, rot, { stroke: C.green, lw: 1.8 });
      dot(f, v.sx(0), v.sy(0), 6, C.yellow);
      text(f, '鞍点（不稳定平衡）', v.sx(0) + 10, v.sy(0) - 8, { color: C.yellow, font: '13px serif' });
      text(f, '闭合圈=摆动；水平波浪线=整周转（E>2mgl）', v.sx(-3.2), v.sy(2.8), { color: C.fg, font: '13px serif' });
      text(f, '橙线=分界线 separatrix：摆动与旋转的生死边界', v.sx(-3.2), v.sy(2.3), { color: C.hot, font: '13px serif' });
    }
    footnotes(f, [
      '正则方程 θ̇ = ∂H/∂p，ṗ = −∂H/∂θ：一阶方程对称形式，q 与 p 完全平权',
      '相体积守恒（刘维尔定理）⇒ 统计系综演化的不变骨架',
      '正则变换、生成函数、作用量-角度变量：Hamilton-Jacobi 理论的入口',
    ]);
    heading(f, '守恒量是相空间里的几何');
  },
});
registerViz(hamiltonPhaseSpace);

/** P479 耦合振子的能量拍。 */
const coupledBeatsEnergy = defineViz({
  slug: 'coupled-beats-energy',
  title: '耦合振子的能量拍',
  params: { kappa: { type: 'range', min: 0.05, max: 1, default: 0.4, step: 0.05, label: '耦合强度 κ' } },
  draw: (f) => {
    const { w, h, params } = f;
    const k = num(params, 'kappa', 0.4);
    clear(f);
    const t = f.t;
    // 两个振子的位置
    const w1 = 1.6, w2 = 1.6 * (1 + k * 0.06);
    const e1 = Math.pow(Math.cos((w1 + w2) / 2 * t), 2);
    const e2 = 1 - e1;
    const x1 = 60 + Math.cos(w1 * t) * 46;
    const x2 = w * 0.5 + 60 + Math.cos(w2 * t) * 46;
    const y0 = h * 0.28;
    // 弹簧-质量示意
    for (const [x, amp2, name, col] of [[x1, e1, 'm₁', C.cool], [x2, e2, 'm₂', C.warm]] as Array<[number, number, string, string]>) {
      seg(f, x - 120, y0, x - 40, y0, C.grid, 3);
      // 弹簧折线
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 8; i++) {
        pts.push([x - 120 + (i / 8) * (x - 40 - (x - 120)), y0 + (i % 2 ? -12 : 12)]);
      }
      poly(f, pts, { stroke: col, lw: 2 });
      poly(f, [[x - 30, y0 - 24], [x + 30, y0 - 24], [x + 30, y0 + 24], [x - 30, y0 + 24]], { fill: `${col}cc`, stroke: col, lw: 2 });
      text(f, name, x, y0 + 5, { align: 'center', color: C.bg, font: '15px serif' });
      text(f, `E ∝ ${(amp2 * 100).toFixed(0)}%`, x, y0 + 52, { align: 'center', color: col, font: '14px serif' });
    }
    text(f, '耦合弹簧', (x1 + x2) / 2 - 30, y0 - 44, { color: C.green, font: '14px serif' });
    seg(f, x1 + 34, y0, x2 - 34, y0, C.green, 3);
    // 下：能量随时间交换曲线
    const v = view(f, { xMin: 0, xMax: 20, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 46 });
    grid(f, v);
    const beat = Math.pow(Math.cos(k * t * 1.2), 2);
    const c1: Array<[number, number]> = [], c2: Array<[number, number]> = [];
    for (let i = 0; i <= 300; i++) {
      const tt = (i / 300) * 20;
      c1.push([v.sx(tt), v.sy(Math.pow(Math.cos(k * tt * 1.2), 2))]);
      c2.push([v.sx(tt), v.sy(Math.pow(Math.sin(k * tt * 1.2), 2))]);
    }
    poly(f, c1, { stroke: C.cool, lw: 2.4 });
    poly(f, c2, { stroke: C.warm, lw: 2.4 });
    dot(f, v.sx(20 * ((t * 0.08) % 1)), v.sy(beat), 6, C.hot);
    text(f, '能量 100% 全部搬给对方的周期 T_拍 = π/(κ·…)', v.sx(0.5), v.sy(1.05), { color: C.fg, font: '13px serif' });
    text(f, `κ 越大交换越快：T_拍 ∝ 1/κ（当前 κ=${k.toFixed(2)}）`, v.sx(0.5), v.sy(0.95), { color: C.yellow, font: '13px serif' });
    footnotes(f, [
      '本征模式：对称（ω_低）与反对称（ω_高）—— 初态是两者的叠加',
      '拍频 = 两本征频之差：能量在两振子间往返搬运（Rabi/NEEVOS 的经典原型）',
      '弱耦合近似下能量完全转移需要简并+精确共振（绝热跟随的条件）',
    ]);
    heading(f, '拍频就是耦合强度的读数');
  },
});
registerViz(coupledBeatsEnergy);

/** P480 陀螺进动与章动。 */
const gyroscopicNutation = defineViz({
  slug: 'gyroscopic-nutation',
  title: '陀螺进动与章动',
  params: { spin: { type: 'range', min: 5, max: 60, default: 25, step: 5, label: '自转 ω_s (rad/s)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const ws = num(params, 'spin', 25);
    clear(f);
    const cx = w * 0.4, cy = h * 0.52;
    // 支点与竖直轴
    seg(f, cx, cy, cx, cy - 190, `${C.dim}aa`, 1.6);
    dot(f, cx, cy, 6, C.dim);
    // 进动角速度（与自转反比）
    const Omega = 900 / (ws * 3.6);
    const prec = f.t * Omega * 0.5;
    const tilt = 0.5 + 0.06 * Math.sin(f.t * 5); // 章动抖动
    // 陀螺轴
    const tipX = cx + Math.sin(prec) * Math.sin(tilt) * 170;
    const tipY = cy - Math.cos(tilt) * 180;
    const tipX2 = cx + Math.sin(prec + 0.4) * Math.sin(tilt) * 170;
    seg(f, cx, cy, tipX, tipY, C.accent, 4);
    // 陀螺转子盘
    const { ctx } = f;
    ctx.save();
    ctx.translate(tipX, tipY);
    ctx.rotate(prec + Math.PI / 2);
    ctx.strokeStyle = C.warm;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 58, 18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // 进动轨迹（虚线圆）
    const { ctx: c2 } = f;
    c2.save();
    c2.strokeStyle = `${C.green}aa`;
    c2.lineWidth = 1.8;
    c2.setLineDash([8, 7]);
    c2.beginPath();
    c2.ellipse(cx, cy - Math.cos(tilt) * 180, Math.sin(tilt) * 170, Math.sin(tilt) * 46, 0, 0, Math.PI * 2);
    c2.stroke();
    c2.restore();
    // 章动小波纹
    for (let i = 0; i < 5; i++) {
      const a = prec + i * 0.4;
      dot(f, cx + Math.sin(a) * Math.sin(tilt + Math.sin(f.t * 5 + i) * 0.04) * 170,
        cy - Math.cos(tilt + Math.sin(f.t * 5 + i) * 0.04) * 180, 3, C.pink);
    }
    // 力矩与角动量矢量
    vec(f, tipX, tipY, tipX + Math.cos(prec) * 60, tipY + Math.sin(prec) * 24, C.hot, 3);
    text(f, 'L', tipX + Math.cos(prec) * 64, tipY + Math.sin(prec) * 24 + 4, { color: C.hot, font: '16px serif' });
    vec(f, cx, cy, tipX, tipY, `${C.cool}99`, 2);
    vec(f, tipX, tipY, tipX, tipY + 70, C.warm, 3);
    text(f, 'Mg（重力矩）', tipX + 8, tipY + 84, { color: C.warm, font: '13px serif' });
    // 公式
    text(f, `Ω_进动 = M / (L·sinθ) ∝ 1/ω_s　（当前 ω_s = ${ws}）`, 56, h - 146, { color: C.fg, font: '15px serif' });
    text(f, 'M = dL/dt：力矩垂直于 L → L 只转向不倾倒', 56, h - 118, { color: C.yellow, font: '14px sans-serif' });
    text(f, '粉点=章动：进动叠加的小幅上下抖动（快速自转时微弱）', 56, h - 90, { color: C.pink, font: '14px sans-serif' });
    footnotes(f, [
      '陀螺仪不倒的秘密：自转角动量巨大，重力矩只能缓慢改方向',
      '章动由能量耗散+初始条件引起：ω_s 减小时章动放大（花样滑冰收臂）',
      '应用：导航陀螺、船舶减摇鳍、手机 IMU 的角速度计都是这套动力学',
    ]);
    heading(f, '重力矩不使陀螺跌倒反而让它画圈');
  },
});
registerViz(gyroscopicNutation);