import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, circle, curve, dot, footnotes, grid, heading, poly, seg, text, view, rng, vec } from '../canvas';

/** 气垫导轨实验。 */
const airTrack = defineViz({
  slug: 'air-track', title: '气垫导轨实验', animated: true,
  params: { m2: { type: 'range', min: 0.2, max: 3, default: 1, step: 0.1, label: '滑块 2 质量 (相对)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const m2 = num(params, 'm2', 1);
    clear(f);
    const y = h * 0.46;
    // 导轨与气孔
    seg(f, 50, y + 34, w - 50, y + 34, C.dim, 5);
    for (let x = 70; x < w - 60; x += 26) {
      dot(f, x, y + 42, 2.4, `rgba(66,153,225,${0.5 + 0.4 * Math.sin(f.t * 4 + x * 0.05)})`);
    }
    text(f, '气膜：滑块浮在 ~0.1 mm 空气上，摩擦近乎为零', 50, y + 74, { color: C.cool, font: '11px sans-serif' });
    // 两个滑块（周期碰撞）
    const m1 = 1;
    const prog = (f.t * 0.55) % 2;
    const v1 = 1.6 * (m1 - m2) / (m1 + m2) + 1.6 * (2 * m2) / (m1 + m2) - 1.6;
    const x1a = 90 + Math.min(prog, 1) * (w - 340);
    const x2a = w - 190 + (prog > 1 ? (prog - 1) * (w - 340) * (2 * m1) / (m1 + m2) * 0.6 : 0);
    poly(f, [[x1a, y - 4], [x1a + 64, y - 4], [x1a + 64, y + 30], [x1a, y + 30]],
      { stroke: C.warm, lw: 2.4, fill: 'rgba(237,137,54,0.55)' });
    poly(f, [[x2a, y - 4], [x2a + 64 * Math.min(1.6, Math.sqrt(m2)), y - 4], [x2a + 64 * Math.min(1.6, Math.sqrt(m2)), y + 30], [x2a, y + 30]],
      { stroke: C.cool, lw: 2.4, fill: 'rgba(66,153,225,0.55)' });
    text(f, 'm₁', x1a + 22, y + 20, { color: '#fff', font: '13px sans-serif' });
    text(f, `m₂=${m2.toFixed(1)}`, x2a + 8, y + 20, { color: '#fff', font: '12px sans-serif' });
    // 光电门
    for (const gx of [w * 0.36, w * 0.66]) {
      seg(f, gx, y - 44, gx, y + 30, `${C.green}aa`, 2);
      text(f, '光电门', gx - 20, y - 52, { color: C.green, font: '10px sans-serif' });
    }
    // 动量条
    const by = h - 128;
    text(f, '碰撞前后动量（守恒 → 两条总长不变）:', 60, by, { color: C.cyan, font: '12px sans-serif' });
    const pv = Math.sin(f.t * 2) > 0 ? 1 : -1;
    const p1 = pv * 1.4, p2 = 0;
    poly(f, [[60, by + 16], [60 + Math.abs(p1) * 110, by + 44], [60, by + 44]], { stroke: 'transparent', fill: 'rgba(237,137,54,0.6)' });
    poly(f, [[60 + Math.abs(p1) * 110, by + 16], [60 + Math.abs(p1 + p2) * 110 + 70, by + 16], [60 + Math.abs(p1 + p2) * 110 + 70, by + 44], [60 + Math.abs(p1) * 110, by + 44]],
      { stroke: 'transparent', fill: 'rgba(66,153,225,0.6)' });
    text(f, `m₁v₁ + m₂v₂ = m₁v₁′ + m₂v₂′（v₂=0 起始）`, 60, by + 68, { color: C.warm, font: '13px sans-serif' });
    void v1;
    void p2;
    void x2a;
    footnotes(f, [
      '导轨必须调水平、气压要稳——残余倾斜会把动量慢慢送进重力',
      '弹性碰撞动能也守恒，非弹性碰撞只守恒动量——两者对照才是完整实验',
      '气垫把牛顿定律从理想拉回课堂：可重复测量的守恒验证',
    ]);
    heading(f, '气垫导轨：把摩擦吹走');
  },
});
registerViz(airTrack);

/** 傅科摆。 */
const foucaultPendulum = defineViz({
  slug: 'foucault-pendulum', title: '傅科摆', animated: true,
  params: { lat: { type: 'range', min: 0, max: 90, default: 45, step: 1, label: '纬度 (°)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const lat = num(params, 'lat', 45);
    clear(f);
    const cx = w * 0.4, cy = h * 0.54, R = Math.min(w * 0.3, h * 0.34);
    // 地面刻度盘
    circle(f, cx, cy, R, { stroke: `${C.grid}cc`, lw: 2 });
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      seg(f, cx + Math.cos(a) * (R - 8), cy + Math.sin(a) * (R - 8), cx + Math.cos(a) * R, cy + Math.sin(a) * R, C.dim, 1.4);
    }
    // 摆面进动：角速度 ∝ sin(纬度)
    const omega = Math.sin((lat * Math.PI) / 180) * 0.5;
    const plane = f.t * omega;
    const swing = Math.sin(f.t * 3) * R * 0.86;
    const px = cx + Math.cos(plane) * swing;
    const py = cy + Math.sin(plane) * swing;
    seg(f, cx, cy, px, py, `rgba(102,126,234,${0.75})`, 3);
    dot(f, px, py, 9, C.warm);
    text(f, '摆锤', px + 12, py + 4, { color: C.warm, font: '11px sans-serif' });
    // 振动平面（随进动转动的直线）
    seg(f, cx - Math.cos(plane) * R, cy - Math.sin(plane) * R, cx + Math.cos(plane) * R, cy + Math.sin(plane) * R,
      `rgba(56,178,172,${0.55})`, 2, );
    text(f, '振动平面保持惯性方向——脚下地球在转', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 进动速率表
    text(f, `Ω = 15°/h × sin(${lat}°) = ${(15 * Math.sin((lat * Math.PI) / 180)).toFixed(1)} °/小时`,
      30, h - 96, { color: C.warm, font: '14px sans-serif' });
    text(f, lat === 0 ? '赤道：不转（Ω=0）' : lat >= 89 ? '极点：最快，24 小时一整圈' : '每小时摆面扫过的角度由纬度决定',
      30, h - 120, { color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      '1851 年巴黎先贤祠：傅科用 67 米长摆让公众亲眼看见地球自转',
      '摆长只决定周期，进动速率只看纬度——两者互不相干是实验的漂亮之处',
      '电磁驱动或周期补能维持振幅——惯性系的桌面教具至今不旧',
    ]);
    heading(f, '傅科摆：看见地球在转');
  },
});
registerViz(foucaultPendulum);

/** 可逆摆测重力加速度。 */
const katerPendulum = defineViz({
  slug: 'kater-pendulum', title: '可逆摆测 g', animated: true,
  params: { flip: { type: 'select', options: ['正挂（刀口 A）', '反挂（刀口 B）'], default: '正挂（刀口 A）', label: '悬挂方式' } },
  draw: (f) => {
    const { w, h, params } = f;
    const reverse = String((params as Record<string, unknown>)['flip'] ?? '').includes('反挂');
    clear(f);
    const cx = w * 0.4, top = 90;
    // 支点（刀口）
    const knifeX = reverse ? cx + 110 : cx - 110;
    poly(f, [[knifeX - 16, top - 22], [knifeX + 16, top - 22], [knifeX, top]], { stroke: C.dim, lw: 2, fill: 'rgba(100,116,139,0.7)' });
    text(f, reverse ? '刀口 B' : '刀口 A', knifeX - 18, top - 32, { color: C.dim, font: '11px sans-serif' });
    // 摆杆（带配重）
    const ang = Math.sin(f.t * 2.2) * 0.24;
    const L = 300;
    const bx = knifeX + Math.sin(ang) * L, by = top + Math.cos(ang) * L;
    const cmX = knifeX + Math.sin(ang) * L * (reverse ? 0.42 : 0.58);
    const cmY = top + Math.cos(ang) * L * (reverse ? 0.42 : 0.58);
    seg(f, knifeX, top, bx, by, C.cool, 5);
    // 两个配重
    dot(f, knifeX + Math.sin(ang) * L * 0.3, top + Math.cos(ang) * L * 0.3, 14, C.warm);
    dot(f, knifeX + Math.sin(ang) * L * 0.82, top + Math.cos(ang) * L * 0.82, 10, C.warm);
    // 质心
    dot(f, cmX, cmY, 6, C.hot);
    text(f, '质心 G', cmX + 10, cmY + 4, { color: C.hot, font: '11px sans-serif' });
    // 另一个刀口（互易点）
    const altX = knifeX === cx - 110 ? cx + 110 : cx - 110;
    poly(f, [[altX - 12, top + L - 24], [altX + 12, top + L - 24], [altX, top + L - 10]], { stroke: `${C.dim}aa`, lw: 1.6, fill: 'rgba(100,116,139,0.4)' });
    text(f, reverse ? '刀口 A（互易点）' : '刀口 B（互易点）', altX - 34, top + L + 12, { color: `${C.dim}cc`, font: '10px sans-serif' });
    text(f, reverse ? '反挂绕 B 摆动' : '正挂绕 A 摆动', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '两次周期相等时：T = 2π√(L_eq/g)，两刀口间距即 L_eq', 30, h - 120, { color: C.warm, font: '14px sans-serif' });
    text(f, 'g = 4π²L_eq / T² —— 无需知道质量分布即可解出 g', 30, h - 96, { color: C.green, font: '13px sans-serif' });
    footnotes(f, [
      '摆动中心互易定理：A、B 两刀口互换而周期不变——可逆摆的名字由来',
      '刀口锋利减摩、摆幅控制在几度内——小角近似是精度的前提',
      '19-20 世纪的重力测量主力：今天桌面精密 g 用于检验等效原理',
    ]);
    heading(f, '可逆摆测 g：两次周期定乾坤');
  },
});
registerViz(katerPendulum);

/** 弹道摆。 */
const ballisticPendulum = defineViz({
  slug: 'ballistic-pendulum', title: '弹道摆', animated: true,
  params: { v: { type: 'range', min: 100, max: 600, default: 300, step: 20, label: '子弹初速 (m/s)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const v0 = num(params, 'v', 300);
    clear(f);
    const px = w * 0.62, py = 74;
    // 支点与摆线
    seg(f, px, py - 16, px, py + 10, C.dim, 5);
    const prog = (f.t * 0.5) % 2.4;
    const maxTheta = Math.min(1.1, (v0 / 600) * 1.15);
    const theta = prog < 0.6 ? 0 : Math.sin(Math.min(Math.PI, (prog - 0.6) * 2)) * maxTheta;
    const L = h - 160;
    const bx = px + Math.sin(theta) * L, by = py + Math.cos(theta) * L;
    seg(f, px, py, bx, by, C.cool, 3);
    // 木块
    const blockAng = theta;
    const cxx = bx, cyy = by;
    poly(f, [[cxx - 34 * Math.cos(blockAng), cyy - 34 * Math.sin(blockAng)],
      [cxx + 34 * Math.cos(blockAng), cyy - 34 * Math.sin(blockAng)],
      [cxx + 34 * Math.cos(blockAng), cyy + 34 * Math.sin(blockAng)],
      [cxx - 34 * Math.cos(blockAng), cyy + 34 * Math.sin(blockAng)]],
      { stroke: C.warm, lw: 2.4, fill: 'rgba(237,137,54,0.45)' });
    text(f, 'M（木块）', cxx - 26, cyy + 4, { color: '#fff', font: '12px sans-serif' });
    // 子弹飞行（碰撞前）
    if (prog < 0.6) {
      const bx2 = 60 + prog * (px - 60) / 0.6;
      poly(f, [[bx2, cyy - 34], [bx2 + 24, cyy - 34], [bx2 + 24, cyy - 27], [bx2, cyy - 27]],
        { stroke: C.hot, lw: 2, fill: C.hot });
      text(f, 'm（子弹）', bx2 - 6, cyy - 44, { color: C.hot, font: '11px sans-serif' });
    }
    text(f, '碰撞瞬间：动量守恒、动能不守恒（完全非弹性）', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 摆角标注
    seg(f, px, py + L, px + Math.sin(maxTheta) * L, py + Math.cos(maxTheta) * L, `${C.dim}66`, 1.4, );
    text(f, `θ_max ← 由 v₀=${v0} m/s 决定`, 40, h - 120, { color: C.warm, font: '13px sans-serif' });
    text(f, 'v = (M+m)/m × √(2gL(1−cosθ))：两步联立解出初速', 40, h - 96, { color: C.green, font: '13px sans-serif' });
    footnotes(f, [
      '把毫秒级碰撞拉长成秒级摆动——弹道摆是测量放大的经典案例',
      '动量在碰撞中守恒，机械能在摆动中守恒——两个定律各管一段',
      '罗宾斯 1742 年造出弹道摆，火炮弹速从此有了科学测法',
    ]);
    heading(f, '弹道摆：一次摆动称出子弹速度');
  },
});
registerViz(ballisticPendulum);

/** 杨氏模量测量。 */
const youngModulus = defineViz({
  slug: 'young-modulus', title: '杨氏模量测量', animated: true,
  params: { load: { type: 'range', min: 0, max: 100, default: 60, step: 5, label: '载荷 (kg)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const load = num(params, 'load', 60);
    clear(f);
    // 应力应变曲线
    const v = view(f, { xMin: 0, xMax: 1.2, yMin: 0, yMax: 1.3, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    const pts: [number, number][] = [];
    for (let i = 0; i <= 200; i++) {
      const e = (i / 200) * 1.2;
      let s: number;
      if (e < 0.6) s = e * 1.05;                       // 弹性直线
      else if (e < 0.78) s = 0.63 + (e - 0.6) * 0.5;   // 屈服
      else if (e < 1.0) s = 0.72 + (e - 0.78) * 1.4;   // 强化
      else s = Math.max(0.75, 1.0 - (e - 1.0) * 1.6);  // 颈缩断裂
      pts.push([v.sx(e), v.sy(s)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 3 });
    // 比例极限
    seg(f, v.sx(0), v.sy(0), v.sx(0.6), v.sy(0.63), `${C.green}88`, 1.6, );
    dot(f, v.sx(0.6), v.sy(0.63), 5, C.green);
    text(f, '比例极限', v.sx(0.6) + 8, v.sy(0.63) - 8, { color: C.green, font: '11px sans-serif' });
    // 当前载荷点
    const eNow = Math.min(1.18, (load / 100) * 1.1);
    const sNow = eNow < 0.6 ? eNow * 1.05 : Math.min(1.05, 0.63 + (eNow - 0.6) * 0.8);
    dot(f, v.sx(eNow), v.sy(sNow), 7, C.hot);
    // 拉伸示意（右侧小图）
    const tx = w - 148, ty = h * 0.34;
    seg(f, tx, ty, tx, ty + 96, C.cool, 4);
    seg(f, tx, ty + 96, tx, ty + 96 + (load / 100) * 44, C.warm, 4);
    text(f, '钢丝+伸长计', tx - 40, ty - 12, { color: C.dim, font: '10px sans-serif' });
    text(f, `载荷 ${load} kg → 应变 ${(eNow * 100).toFixed(1)}%（比例极限内可恢复）`, 56, 44, { color: C.cyan, font: '12px sans-serif' });
    text(f, '应力 σ = E·ε：斜率就是杨氏模量——只看材质，与粗细无关', 56, h - 66, { color: C.warm, font: '13px sans-serif' });
    text(f, '应变 →', w - 120, h - 86, { color: C.dim, font: '11px sans-serif' });
    footnotes(f, [
      '微小伸长要用光杠杆或伸长计放大——杨氏模量实验的精髓是测量放大术',
      '超过比例极限就回不去了：颈缩与断裂是曲线末端的悬崖',
      '托马斯·杨 1807 年提出模量——材料力学从经验走进定量',
    ]);
    heading(f, '杨氏模量：材料的倔强程度');
  },
});
registerViz(youngModulus);

/** 转椅与角动量守恒。 */
const angularMomentumChair = defineViz({
  slug: 'angular-momentum-chair', title: '转椅与角动量守恒', animated: true,
  params: { arms: { type: 'range', min: 0, max: 1, default: 1, step: 0.05, label: '手臂展开度 (1=全开)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const arms = num(params, 'arms', 1);
    clear(f);
    // 转椅俯视
    const cx = w * 0.36, cy = h * 0.54, R = Math.min(w * 0.26, h * 0.32);
    circle(f, cx, cy, R, { stroke: `${C.grid}cc`, lw: 2 });
    circle(f, cx, cy, 26, { fill: 'rgba(100,116,139,0.7)', stroke: C.dim, lw: 2 });
    text(f, '转轴', cx - 16, cy + 4, { color: '#fff', font: '11px sans-serif' });
    // I 随手臂变化 → ω = L/I
    const I = 1 + arms * 2.4;
    const omega = (3 * 1.4) / I;
    const a = f.t * omega * 1.4;
    for (const s of [-1, 1]) {
      const ex = cx + Math.cos(a + (s > 0 ? 0 : Math.PI)) * R * (0.35 + arms * 0.6);
      const ey = cy + Math.sin(a + (s > 0 ? 0 : Math.PI)) * R * (0.35 + arms * 0.6);
      seg(f, cx, cy, ex, ey, C.warm, 5);
      dot(f, ex, ey, 12, C.warm);
    }
    // 速度箭头
    const tang = omega * R * 0.9;
    const tx = cx + Math.cos(a) * R, ty = cy + Math.sin(a) * R;
    vec(f, tx, ty, tx - Math.sin(a) * tang * 18, ty + Math.cos(a) * tang * 18, C.green, 3);
    text(f, arms > 0.6 ? '手臂展开：转动惯量大 → 转得慢' : '手臂收拢：转动惯量小 → 转得飞快',
      30, 44, { color: arms > 0.6 ? C.warm : C.green, font: '13px sans-serif' });
    // 守恒仪表
    const bx = w * 0.68, by = h * 0.3;
    const vals: [string, number, string][] = [
      ['L（角动量）', 1.0, C.green],
      ['I（转动惯量）', arms * 0.7 + 0.3, C.cool],
      ['ω（角速度）', 1.3 - arms * 0.7, C.warm],
    ];
    vals.forEach(([name, val, color], i) => {
      const y = by + i * 62;
      text(f, name, bx, y, { color, font: '12px sans-serif' });
      poly(f, [[bx, y + 12], [bx + val * 150, y + 12], [bx + val * 150, y + 34], [bx, y + 34]],
        { stroke: 'transparent', fill: `${color}cc` });
      text(f, `${(val * 100).toFixed(0)}%`, bx + val * 150 + 8, y + 28, { color, font: '11px sans-serif' });
    });
    text(f, 'L = Iω = 常量：I 减半 ω 加倍，绿色条永远满格', bx, by - 18, { color: C.dim, font: '11px sans-serif' });
    text(f, `当前 ω ≈ ${omega.toFixed(2)} × 基准（I = ${(I).toFixed(2)} I_0）`, 30, h - 96, { color: C.cyan, font: '13px sans-serif' });
    footnotes(f, [
      '合外力矩为零时角动量守恒——收臂加速是身体能感觉到的物理',
      '同一原理撑起脉冲星变快、星系收缩变快与跳水三周半',
      '课堂上最常翻车的是脚碰地——外力矩一进来守恒就破功',
    ]);
    heading(f, '转椅：角动量的体重秤');
  },
});
registerViz(angularMomentumChair);

/** 复摆与振动中心。 */
const compoundPendulum = defineViz({
  slug: 'compound-pendulum', title: '复摆与振动中心', animated: true,
  params: { pivot: { type: 'range', min: 0.1, max: 0.9, default: 0.3, step: 0.05, label: '支点位置 (杆长比例)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const piv = num(params, 'pivot', 0.3);
    clear(f);
    const cx = w * 0.42, top = 76, L = h - 200;
    const I_cm = L * L / 12; // 均匀杆绕质心
    const cmFrac = 0.5;
    const hDist = Math.abs(piv - cmFrac) * L;
    const T = 2 * Math.PI * Math.sqrt((I_cm + hDist * hDist) / (hDist + 1e-6) / 9.8) * 8;
    const ang = Math.sin((f.t * Math.PI * 2) / Math.max(1.4, T)) * 0.3;
    // 支点
    const pivY = top + piv * L;
    poly(f, [[cx - 14, pivY - 14], [cx + 14, pivY - 14], [cx, pivY]], { stroke: C.dim, lw: 2, fill: 'rgba(100,116,139,0.8)' });
    // 杆（绕支点摆）
    const bx = cx + Math.sin(ang) * L, by = top + Math.cos(ang) * L;
    const tx = cx - Math.sin(ang) * L, ty = top - Math.cos(ang) * L;
    seg(f, tx, ty, bx, by, C.cool, 6);
    // 质心与配重
    const cmX = cx + Math.sin(ang) * (0.5 - piv) * L, cmY = top + Math.cos(ang) * (0.5 - piv) * L + (piv - 0.5) * 0;
    const cmX2 = cx + Math.sin(ang) * ((0.5 - piv) * L) + (piv - 0.5) * 0;
    dot(f, cmX2, top + piv * L + Math.cos(ang) * (0.5 - piv) * L, 7, C.hot);
    text(f, '质心 G', cmX2 + 10, top + piv * L + Math.cos(ang) * (0.5 - piv) * L + 4, { color: C.hot, font: '11px sans-serif' });
    void cmX; void cmY;
    // 互易点（另一振动中心）
    const other = hDist > 1e-3 ? (I_cm / hDist) : L;
    const otherY = pivY + (other > 0 ? Math.sign(0.5 - piv) * 0 : 0);
    dot(f, cx, pivY - Math.sign(0.5 - piv + 1e-6) * other, 5, C.green);
    text(f, '振动中心（互易点）', cx + 12, pivY - Math.sign(0.5 - piv + 1e-6) * other + 4, { color: C.green, font: '10px sans-serif' });
    void otherY;
    text(f, '支点 ↔ 振动中心可互换而周期不变——可逆摆的理论根基', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, `T = 2π√(I/mgh)：支点越靠近质心，摆得越慢（h→0 时 T→∞）`, 30, h - 120, { color: C.warm, font: '13px sans-serif' });
    text(f, `当前支点在 ${(piv * 100).toFixed(0)}% 处，h = ${hDist.toFixed(0)}（画布单位）`, 30, h - 96, { color: C.green, font: '12px sans-serif' });
    footnotes(f, [
      '现实里的摆都有笨重身体，节奏却仍听从一条等效摆长的指挥',
      '惠更斯《摆钟论》（1673）把单摆等时性推广到任意刚体',
      '摆钟设计与地震仪检波器——复摆模型至今仍在工程里服役',
    ]);
    heading(f, '复摆：等效摆长的指挥');
  },
});
registerViz(compoundPendulum);

/** 法拉第圆盘发电机。 */
const faradayDisk = defineViz({
  slug: 'faraday-disk', title: '法拉第圆盘发电机', animated: true,
  params: { omega: { type: 'range', min: 0.5, max: 8, default: 3, step: 0.5, label: '转速 ω (rad/s)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const om = num(params, 'omega', 3);
    clear(f);
    const cx = w * 0.38, cy = h * 0.5, R = Math.min(w * 0.24, h * 0.34);
    // 磁场（背景箭头）
    for (let i = 0; i < 6; i++) {
      const x = cx - R - 30 + i * ((R * 2 + 60) / 5);
      vec(f, x, cy + R + 40, x, cy - R - 40, `rgba(146,84,222,${0.35 + 0.15 * Math.sin(f.t * 2)})`, 2);
    }
    text(f, 'B（垂直穿过盘面）', cx - R - 34, cy - R - 52, { color: '#9254de', font: '11px sans-serif' });
    // 铜盘（旋转辐条示意）
    circle(f, cx, cy, R, { stroke: C.warm, lw: 3, fill: 'rgba(237,137,54,0.25)' });
    const spin = f.t * om;
    for (let k = 0; k < 6; k++) {
      const a = spin + (k / 6) * Math.PI * 2;
      seg(f, cx, cy, cx + Math.cos(a) * R, cy + Math.sin(a) * R, `rgba(237,137,54,0.85)`, 3);
      dot(f, cx + Math.cos(a) * R * 0.7, cy + Math.sin(a) * R * 0.7, 5, C.cool);
    }
    dot(f, cx, cy, 7, C.dim);
    text(f, '转轴', cx - 14, cy + 26, { color: C.dim, font: '11px sans-serif' });
    // 电刷与外电路
    const b1x = cx + R, b2x = cx - R;
    dot(f, b1x, cy, 6, C.green);
    dot(f, b2x, cy, 6, C.green);
    text(f, '边缘电刷', b1x + 8, cy - 8, { color: C.green, font: '10px sans-serif' });
    text(f, '轴心电刷', b2x - 66, cy - 8, { color: C.green, font: '10px sans-serif' });
    const circuit: [number, number][] = [[b1x, cy], [b1x + 60, cy], [b1x + 60, cy + 74], [b2x - 60, cy + 74], [b2x - 60, cy], [b2x, cy]];
    poly(f, circuit, { stroke: C.green, lw: 2.4 });
    // 电流脉动
    const glow = 0.5 + 0.5 * Math.sin(f.t * om * 3);
    dot(f, (b1x + b2x) / 2, cy + 74, 7, `rgba(72,187,120,${glow})`);
    text(f, '电流 I（恒定直流——圆盘发电机的性格）', (b1x + b2x) / 2 - 100, cy + 98, { color: C.green, font: '11px sans-serif' });
    text(f, `ε = ½BωR² = ½·B·${om}·R²：转速越高电压越大`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    footnotes(f, [
      '法拉第 1831 年的圆盘与感应线圈同日诞生——电磁感应的双子星',
      '同一半径上电势相同但电流各异——理解它需要一点微元思维',
      '恒定直流不好变压是它的短板，但连续旋转发电的原型意义不减',
    ]);
    heading(f, '法拉第圆盘：最早的发电机');
  },
});
registerViz(faradayDisk);

/** 楞次定律与跳环实验。 */
const lenzLaw = defineViz({
  slug: 'lenz-law', title: '楞次定律与跳环实验', animated: true,
  params: { ac: { type: 'select', options: ['交流通电', '断电瞬间'], default: '交流通电', label: '激励' } },
  draw: (f) => {
    const { w, h, params } = f;
    const acMode = String((params as Record<string, unknown>)['ac'] ?? '').includes('交流');
    clear(f);
    const cx = w * 0.4, base = h * 0.76;
    // 铁芯与线圈
    poly(f, [[cx - 34, base], [cx + 34, base], [cx + 34, h - 40], [cx - 34, h - 40]],
      { stroke: C.dim, lw: 2.4, fill: 'rgba(100,116,139,0.4)' });
    for (let i = 0; i < 7; i++) {
      const y = base - 120 + i * 18;
      seg(f, cx - 40, y, cx + 40, y, C.warm, 4);
    }
    text(f, '初级线圈（接交流）', cx + 52, base - 60, { color: C.warm, font: '11px sans-serif' });
    // 铝环（跳起）
    let lift = 0;
    if (acMode) lift = 60 + Math.sin(f.t * 6) * 18;
    else {
      const p = (f.t * 0.7) % 3;
      lift = p < 1.6 ? p * 70 : Math.max(0, 112 - (p - 1.6) * 90);
    }
    const ringY = base - 150 - lift;
    poly(f, [[cx - 52, ringY], [cx + 52, ringY], [cx + 52, ringY + 22], [cx - 52, ringY + 22]],
      { stroke: 'transparent', fill: 'rgba(26,32,44,0.9)' });
    const ring: [number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const t = (i / 60) * Math.PI * 2;
      ring.push([cx + Math.cos(t) * 52, ringY + 11 + Math.sin(t) * 12]);
    }
    poly(f, ring, { stroke: C.cool, lw: 4 });
    text(f, '铝环', cx + 60, ringY + 14, { color: C.cool, font: '11px sans-serif' });
    // 感应电流方向（反向箭头）
    const cur = Math.sin(f.t * 6) > 0;
    const ay = ringY - 24;
    const dir = acMode ? (cur ? 1 : -1) : (lift > 6 ? -1 : 1);
    vec(f, cx - 40 * dir, ay, cx + 40 * dir, ay, `rgba(245,101,101,${0.6 + 0.4 * Math.abs(Math.sin(f.t * 6))})`, 3);
    text(f, '感应电流：方向永远阻碍磁通变化', cx - 90, ay - 14, { color: C.hot, font: '11px sans-serif' });
    text(f, '磁通↑ → 感应磁场反向顶回去；磁通↓ → 感应磁场补上来', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, 'ε = −dΦ/dt：那个负号就是楞次——能量守恒的电磁学版本', 30, h - 96, { color: C.warm, font: '13px sans-serif' });
    footnotes(f, [
      '跳环实验最直观：电流想涨，环被顶起；电流想落，环被托住',
      '若感应电流顺变化而行，就成了永动机——楞次定律堵死了这条路',
      '电磁炉、磁悬浮刹车、电磁阻尼全用这条规则干活',
    ]);
    heading(f, '楞次定律：永远唱反调');
  },
});
registerViz(lenzLaw);

/** 涡流与电磁阻尼。 */
const eddyCurrent = defineViz({
  slug: 'eddy-current', title: '涡流与电磁阻尼', animated: true,
  params: { cond: { type: 'select', options: ['铜管（强阻尼）', '铝管', '塑料管（无阻尼）'], default: '铜管（强阻尼）', label: '管材' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mat = String((params as Record<string, unknown>)['cond'] ?? '');
    const damping = mat.includes('铜') ? 1 : mat.includes('铝') ? 0.6 : 0;
    clear(f);
    const tx = w * 0.46, tw = 90, topY = 60, botY = h - 70;
    // 管
    poly(f, [[tx - tw, topY], [tx + tw, topY], [tx + tw, botY], [tx - tw, botY]],
      { stroke: C.dim, lw: 2.6, fill: 'rgba(100,116,139,0.14)' });
    text(f, mat.includes('铜') ? '铜管' : mat.includes('铝') ? '铝管' : '塑料管', tx - 20, topY - 12, { color: C.dim, font: '12px sans-serif' });
    // 磁铁下落（阻尼越大越慢）
    const cycle = 4.5 - damping * 3;
    const prog = ((f.t % cycle) / cycle);
    const yFall = topY + 30 + prog * (botY - topY - 70) * (damping > 0 ? 1 : 1);
    const yShown = damping > 0 ? topY + 30 + Math.pow(prog, 1 / (0.4 + damping)) * (botY - topY - 70) : yFall;
    const fy = Math.min(botY - 40, yShown);
    poly(f, [[tx - 34, fy], [tx + 34, fy], [tx + 34, fy + 54], [tx - 34, fy + 54]],
      { stroke: C.hot, lw: 3, fill: 'rgba(245,101,101,0.6)' });
    text(f, 'N-S 磁铁', tx - 30, fy + 32, { color: '#fff', font: '12px sans-serif' });
    // 涡流环（管壁内旋转）
    if (damping > 0) {
      for (let k = 0; k < 3; k++) {
        const yy = fy + 16 + k * 12;
        const ph = f.t * 6 + k;
        for (const s of [-1, 1]) {
          const rr = 22 + Math.sin(ph) * 8;
          const cyy = yy + Math.cos(ph + k) * 6;
          const pts: [number, number][] = [];
          for (let i = 0; i <= 24; i++) {
            const t = (i / 24) * Math.PI * 2;
            pts.push([tx + s * (tw - 26) + Math.cos(t) * rr * 0.5, cyy + Math.sin(t) * 9]);
          }
          poly(f, pts, { stroke: `rgba(66,153,225,${0.4 + 0.4 * Math.sin(ph)})`, lw: 2 });
        }
      }
      text(f, '涡流：环形感应电流把动能变成管壁的热', tx + tw + 14, fy + 26, { color: C.cool, font: '11px sans-serif' });
    } else {
      text(f, '不导电 → 无涡流 → 自由落体', tx + tw + 14, fy + 26, { color: C.green, font: '11px sans-serif' });
    }
    // 下落计时
    text(f, damping > 0 ? `阻尼力 ∝ −v：速度最终稳定在收尾速度（像在糖浆里游泳）` : '塑料管：没有任何电磁阻尼，g 直接接管',
      30, 44, { color: damping > 0 ? C.cyan : C.green, font: '13px sans-serif' });
    text(f, `导电率系数 ${damping.toFixed(1)} —— 阻尼只与运动有关，与磁铁极性无关`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '傅科 1855 年演示涡流——看不见的电流在整块导体里打转',
      '磁悬浮列车的电磁制动、精密天平的阻尼器都靠它——非接触、无磨损',
      '阻尼力与速度成正比：这是热损耗转化为机械拖拽的直接证据',
    ]);
    heading(f, '涡流：在铜管里刹车');
  },
});
registerViz(eddyCurrent);

/** 感应圈与高压火花。 */
const inductionCoil = defineViz({
  slug: 'induction-coil', title: '感应圈与高压火花', animated: true,
  params: { turns: { type: 'range', min: 100, max: 5000, default: 2000, step: 100, label: '次级匝数' } },
  draw: (f) => {
    const { w, h, params } = f;
    const N = num(params, 'turns', 2000);
    clear(f);
    const cx = w * 0.4, cy = h * 0.52;
    // 铁芯
    seg(f, cx - 150, cy, cx + 150, cy, C.dim, 16);
    text(f, '铁芯', cx - 210, cy + 5, { color: C.dim, font: '11px sans-serif' });
    // 初级（粗少匝）
    for (let i = 0; i < 8; i++) {
      const x = cx - 110 + i * 26;
      const on = Math.sin(f.t * 5 + i * 0.5) > 0;
      seg(f, x, cy - 34, x, cy + 34, on ? C.warm : `${C.warm}77`, 5);
    }
    text(f, '初级：粗线少匝 + 断续器', cx - 116, cy - 48, { color: C.warm, font: '11px sans-serif' });
    // 次级（细多匝）
    for (let i = 0; i < 22; i++) {
      const x = cx - 120 + i * 11;
      seg(f, x, cy - 56, x, cy - 38, C.cool, 2.4);
      seg(f, x, cy + 38, x, cy + 56, C.cool, 2.4);
    }
    text(f, `次级：${N} 匝细线`, cx - 116, cy + 76, { color: C.cool, font: '11px sans-serif' });
    // 断续器火花
    const gapX = cx - 170, gapY = cy;
    const spark = Math.sin(f.t * 10) > 0.75;
    if (spark) {
      const pts: [number, number][] = [[gapX - 22, gapY], [gapX - 12, gapY - 9], [gapX - 4, gapY + 7], [gapX + 4, gapY - 7], [gapX + 12, gapY + 9], [gapX + 22, gapY]];
      poly(f, pts, { stroke: '#fffbeb', lw: 3 });
      poly(f, pts, { stroke: 'rgba(140,210,255,0.6)', lw: 8 });
      text(f, '断点火花', gapX - 26, gapY - 22, { color: '#fffbeb', font: '11px sans-serif' });
    }
    // 输出火花隙
    const outX = w - 130;
    const fire = Math.sin(f.t * 10) > 0.75;
    dot(f, outX - 40, cy, 8, C.hot);
    dot(f, outX + 40, cy, 8, C.hot);
    if (fire) {
      const bolt: [number, number][] = [[outX - 40, cy]];
      for (let i = 1; i < 6; i++) bolt.push([outX - 40 + i * 16, cy + (i % 2 === 0 ? -1 : 1) * 12]);
      bolt.push([outX + 40, cy]);
      poly(f, bolt, { stroke: '#fffbeb', lw: 3.4 });
      poly(f, bolt, { stroke: 'rgba(140,210,255,0.55)', lw: 9 });
      text(f, '数万伏火花', outX - 36, cy - 30, { color: '#fffbeb', font: '12px sans-serif' });
    }
    text(f, 'ε = −L·dI/dt：断电越快、匝数越多，电压越高', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, `电压增益 ∝ 次级/初级匝数比 ≈ ${N}/800 —— 绝缘与耐压决定上限`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '机械断续器周期性充放——把低压直流变成脉冲高压的蒸汽朋克装置',
      '赫兹验证电磁波的信号源就是它；X 射线管与汽车点火也出自同门',
      '自感的负号在课本上是个符号，在这里是看得见的电火花',
    ]);
    heading(f, '感应圈：断电一刻的咆哮');
  },
});
registerViz(inductionCoil);

/** 共振特斯拉线圈。 */
const teslaCoil = defineViz({
  slug: 'tesla-coil', title: '共振特斯拉线圈', animated: true,
  params: { detune: { type: 'range', min: 0, max: 50, default: 0, step: 1, label: '失谐 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const detune = num(params, 'detune', 0);
    clear(f);
    const eff = 1 - detune / 60;
    const cx = w * 0.3, cy = h * 0.58;
    // 初级 LC
    const r1 = 66;
    const lp: [number, number][] = [];
    for (let i = 0; i <= 80; i++) {
      const t = (i / 80) * Math.PI * 2;
      lp.push([cx + Math.cos(t) * r1, cy + Math.sin(t) * r1 * 0.42]);
    }
    poly(f, lp, { stroke: C.warm, lw: 3.4 });
    text(f, '初级 LC 回路', cx - 56, cy + r1 * 0.42 + 26, { color: C.warm, font: '11px sans-serif' });
    // 火花隙
    const gapPh = Math.sin(f.t * 12) > 0.8;
    if (gapPh) {
      seg(f, cx - r1 - 26, cy, cx - r1 - 8, cy - 8, '#fffbeb', 3);
      seg(f, cx - r1 - 8, cy - 8, cx - r1 + 8, cy + 8, '#fffbeb', 3);
      seg(f, cx - r1 + 8, cy + 8, cx - r1 + 26, cy, '#fffbeb', 3);
    }
    // 次级线圈塔
    const tx = cx + 150;
    for (let i = 0; i < 16; i++) {
      const y = cy + 74 - i * 11;
      const glow = 0.4 + 0.6 * eff * Math.abs(Math.sin(f.t * 8 - i * 0.4));
      seg(f, tx - 34, y, tx + 34, y, `rgba(66,153,225,${glow})`, 3);
    }
    poly(f, [[tx - 40, cy + 84], [tx + 40, cy + 84], [tx + 34, cy - 110], [tx - 34, cy - 110]],
      { stroke: `${C.cool}aa`, lw: 2 });
    // 顶部放电
    const topY = cy - 118;
    if (eff > 0.6) {
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k - 2) * 0.5 + Math.sin(f.t * 9 + k) * 0.2;
        const len = 40 + eff * 46 * Math.abs(Math.sin(f.t * 7 + k));
        const pts: [number, number][] = [[tx, topY]];
        for (let i = 1; i <= 4; i++) pts.push([tx + Math.cos(a) * (len * i) / 4 + (i % 2 ? 6 : -6), topY + Math.sin(a) * (len * i) / 4]);
        poly(f, pts, { stroke: `rgba(140,210,255,${eff})`, lw: 2.6 });
      }
    }
    text(f, '次级高频高压 → 顶部放电（空气被击穿）', tx - 90, topY - 24, { color: '#7fd4ff', font: '11px sans-serif' });
    // 隔空点氖管
    const nx = w - 110, ny = cy - 60;
    const lit = eff > 0.75 && Math.sin(f.t * 6) > 0;
    circle(f, nx, ny, 26, { stroke: lit ? '#fffbeb' : C.dim, lw: 3, fill: lit ? 'rgba(255,250,200,0.4)' : 'rgba(45,55,72,0.6)' });
    text(f, lit ? '氖管亮了！' : '氖管（未谐振）', nx - 34, ny + 48, { color: lit ? '#fffbeb' : C.dim, font: '11px sans-serif' });
    text(f, `f₁ = f₂ 时能量跳跃传输：当前失谐 ${detune}% → 输出效率 ${(eff * 100).toFixed(0)}%`,
      30, 44, { color: eff > 0.75 ? C.cyan : C.warm, font: '13px sans-serif' });
    text(f, '谐振升压是无线充电的祖先——特斯拉的1891', 30, h - 96, { color: C.green, font: '12px sans-serif' });
    footnotes(f, [
      '两个 LC 回路调到同一频率——电压不必变压比，靠共振就能爬上去',
      '趋肤效应让高频电流只走表面——导线变粗不如变空心',
      '失谐几百赫兹输出就塌掉：谐振对频率的敏感度是它的性格',
    ]);
    heading(f, '特斯拉线圈：隔空点亮');
  },
});
registerViz(teslaCoil);

/** 佩兰布朗运动实验。 */
const perrinExperiment = defineViz({
  slug: 'perrin-experiment', title: '佩兰布朗运动实验', animated: true,
  params: { temp: { type: 'range', min: 10, max: 60, default: 25, step: 1, label: '温度 (℃)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const T = num(params, 'temp', 25);
    clear(f);
    // 显微镜视野与随机轨迹
    const cx = w * 0.36, cy = h * 0.5, R = Math.min(w * 0.26, h * 0.34);
    circle(f, cx, cy, R, { stroke: C.dim, lw: 3, fill: 'rgba(26,32,44,0.7)' });
    text(f, '显微镜视野（花粉颗粒悬浮液）', cx - 100, cy - R - 14, { color: C.dim, font: '11px sans-serif' });
    const rand = rng(1908);
    const steps = 90;
    const scale = 0.6 + (T - 10) / 40;
    const pts: [number, number][] = [];
    let x = cx, y = cy;
    const seedPts: [number, number][] = [];
    for (let i = 0; i < steps; i++) {
      seedPts.push([x, y]);
      x += (rand() - 0.5) * 34 * scale;
      y += (rand() - 0.5) * 34 * scale;
      const dx = x - cx, dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (d > R - 10) { x = cx + (dx / d) * (R - 10); y = cy + (dy / d) * (R - 10); }
    }
    // 已走过的路径（动画推进）
    const shown = Math.floor(((f.t * 14) % (steps + 10)));
    const path: [number, number][] = [];
    for (let i = 0; i <= Math.min(shown, steps - 1); i++) path.push(seedPts[i]);
    if (path.length > 1) poly(f, path, { stroke: `rgba(66,153,225,0.85)`, lw: 2 });
    if (shown < steps) dot(f, seedPts[Math.min(shown, steps - 1)][0], seedPts[Math.min(shown, steps - 1)][1], 7, C.warm);
    // 均方位移图表（右）
    const v = view(f, { xMin: 0, xMax: 1, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 5, ticks: true });
    const k = 1.38e-23 * (T + 273) / (6 * Math.PI * 8.9e-4 * 1e-6) * 1e6;
    const msd: [number, number][] = [];
    for (let i = 0; i <= 100; i++) msd.push([v.sx(i / 100), v.sy(Math.min(1, (i / 100) * k))]);
    poly(f, msd, { stroke: C.green, lw: 3 });
    text(f, '⟨x²⟩ = 2Dt（线性——温度越高斜率越大）', w - 340, 44, { color: C.green, font: '12px sans-serif' });
    text(f, 't →', w - 90, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, `T=${T}℃：kT = 6πηDr 联立即可解出 N_A——佩兰 1908 年的账本`, 30, h - 96, { color: C.cyan, font: '13px sans-serif' });
    footnotes(f, [
      '每秒上亿次分子碰撞的净剩余——花粉颗粒替分子做了证词',
      '爱因斯坦 1905 年给出扩散公式，佩兰用十年实验把它变成数字',
      '终结分子实在性的最后一场大战——1926 年诺贝尔物理学奖',
    ]);
    heading(f, '佩兰实验：数出阿伏伽德罗常数');
  },
});
registerViz(perrinExperiment);

/** 能量均分验证。 */
const energyEquipartition = defineViz({
  slug: 'energy-equipartition', title: '能量均分验证', animated: true,
  params: { kind: { type: 'select', options: ['单原子', '双原子', '多原子'], default: '双原子', label: '气体类型' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = String((params as Record<string, unknown>)['kind'] ?? '');
    const dofMax = kind.includes('单') ? 3 : kind.includes('双') ? 5 : 6;
    clear(f);
    const v = view(f, { xMin: 0, xMax: 4, yMin: 0, yMax: 7, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 7, ticks: true });
    // C_V/R 台阶：低温冻结转动/振动
    const stages: [number, number, number][] = kind.includes('单')
      ? [[0, 1.5, 3], [4, 1.5, 0]]
      : kind.includes('双')
        ? [[0, 1.5, 2], [0.5, 2.5, 2], [2.4, 3.5, 2], [4, 5, 0]]
        : [[0, 3, 2], [1, 4.5, 2], [4, 6, 0]];
    for (let i = 0; i < stages.length; i++) {
      const [x0, cv, x1] = stages[i];
      const nx = i + 1 < stages.length ? stages[i + 1][0] : x1;
      const pulse = 0.7 + 0.3 * Math.sin(f.t * 2 + i);
      poly(f, [[v.sx(x0), v.sy(cv)], [v.sx(nx), v.sy(cv)]],
        { stroke: `rgba(66,153,225,${pulse})`, lw: 4 });
      if (i + 1 < stages.length) {
        poly(f, [[v.sx(nx), v.sy(cv)], [v.sx(nx), v.sy(stages[i + 1][1])]],
          { stroke: `${C.dim}aa`, lw: 2, dash: [5, 4] });
      }
      text(f, `C_V/R = ${cv}`, v.sx(nx) - 66, v.sy(cv) - 10, { color: C.cool, font: '11px sans-serif' });
    }
    // 激活标记
    const marks: [number, string][] = kind.includes('单') ? [] : kind.includes('双')
      ? [[0.6, '转动激活'], [2.5, '振动激活']]
      : [[1.1, '振动模式激活']];
    for (const [x, name] of marks) {
      seg(f, v.sx(x), v.sy(0), v.sx(x), v.sy(7), `${C.warm}77`, 1.4, );
      text(f, name, v.sx(x) + 6, v.sy(6.4), { color: C.warm, font: '11px sans-serif' });
    }
    text(f, `低温端台阶 → 高温端 ${dofMax / 2}R：每自由度分得 ½kT`, 56, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '温度 →（对数示意）', w - 150, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, 'C_V/R', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    footnotes(f, [
      '经典预言：每个自由度都该分到能量——高温符合、低温掉队',
      '振动自由度被冻结正是量子化的指纹：能级间隔太大分不动',
      '均分定理的失效催生量子统计——经典图像的边界就画在这里',
    ]);
    heading(f, '能量均分：自由度的台阶');
  },
});
registerViz(energyEquipartition);

/** 气体温度计与绝对温标。 */
const gasThermometry = defineViz({
  slug: 'gas-thermometry', title: '气体温度计与绝对温标', animated: true,
  params: { gas: { type: 'select', options: ['氢气', '氦气', '氮气'], default: '氢气', label: '工作气体' } },
  draw: (f) => {
    const { w, h, params } = f;
    const gas = String((params as Record<string, unknown>)['gas'] ?? '氢气');
    clear(f);
    const v = view(f, { xMin: -300, xMax: 100, yMin: 0, yMax: 320, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    // 等容线：P = P₀(1 + t/273.15)
    const line: [number, number][] = [];
    for (let t = -273.15; t <= 100; t += 5) {
      const p = 300 * ((t + 273.15) / 273.15);
      if (p >= 0 && p <= 320) line.push([v.sx(t), v.sy(p)]);
    }
    poly(f, line, { stroke: C.accent, lw: 3.4 });
    // 外推段（虚线）
    const extra: [number, number][] = [];
    for (let t = -300; t <= -273.15; t += 4) {
      const p = 300 * ((t + 273.15) / 273.15);
      if (p >= 0) extra.push([v.sx(t), v.sy(p)]);
    }
    poly(f, extra, { stroke: C.hot, lw: 2.4, dash: [6, 5] });
    // 交点：绝对零度
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 2);
    dot(f, v.sx(-273.15), v.sy(0), 9, `rgba(245,101,101,${pulse})`);
    text(f, '外推截距：T = −273.15 ℃', v.sx(-273.15) + 12, v.sy(0) - 16, { color: C.hot, font: '13px sans-serif' });
    // 参考点
    dot(f, v.sx(0), v.sy(300), 7, C.green);
    text(f, '冰点 0 ℃（定标点）', v.sx(0) + 10, v.sy(300) - 10, { color: C.green, font: '11px sans-serif' });
    text(f, `${gas}等容线：无论换哪种气体，截距都汇聚到同一点`, 56, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '温度 t (℃) →', w - 130, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, 'P（任意单位）', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    text(f, 'P/T = 常量 → 开尔文温标：热力学第二定律摆脱了具体物质', 30, h - 96, { color: C.warm, font: '13px sans-serif' });
    footnotes(f, [
      '盖-吕萨克 1802 年的等容实验——把线反向延长就撞见绝对零度',
      '气体越稀薄越接近理想：容器热膨胀与死体积是主要系统误差',
      '开尔文 1848 年提出绝对温标——今天已是七个基本单位之一',
    ]);
    heading(f, '气体温度计：外推绝对零度');
  },
});
registerViz(gasThermometry);

/** 三相点与相平衡。 */
const threePhasePoint = defineViz({
  slug: 'three-phase-point', title: '三相点与相平衡', animated: true,
  params: { p: { type: 'range', min: 0.1, max: 5, default: 1, step: 0.1, label: '压强 (atm)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const P = num(params, 'p', 1);
    clear(f);
    const v = view(f, { xMin: -50, xMax: 400, yMin: 0, yMax: 6, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    // 三相图曲线（示意）
    // 固-气升华线
    const sub: [number, number][] = [];
    for (let t = -50; t <= 0; t += 3) sub.push([v.sx(t), v.sy(0.6 * Math.exp(t / 30))]);
    poly(f, sub, { stroke: C.cool, lw: 3 });
    // 固-液熔化线（近垂直略正斜率）
    const melt: [number, number][] = [];
    for (let t = 0; t <= 20; t += 2) melt.push([v.sx(0 + t * 0.06), v.sy(0.6 + t * 0.27)]);
    poly(f, melt, { stroke: C.green, lw: 3 });
    // 液-气汽化线
    const vap: [number, number][] = [];
    for (let t = 0; t <= 374; t += 6) {
      const p = 0.6 * Math.exp(t / 45) * 0.6;
      if (p <= 6) vap.push([v.sx(t), v.sy(p)]);
    }
    poly(f, vap, { stroke: C.warm, lw: 3 });
    // 三相点
    const tpx = v.sx(0.01), tpy = v.sy(0.006);
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
    dot(f, tpx, tpy, 10, `rgba(245,101,101,${pulse})`);
    text(f, '三相点 273.16 K', tpx + 14, tpy - 12, { color: C.hot, font: '13px sans-serif' });
    // 临界点
    dot(f, v.sx(374), v.sy(218 * 0.027), 7, '#9254de');
    text(f, '临界点 647 K', v.sx(374) - 96, v.sy(0.6) - 10, { color: '#9254de', font: '11px sans-serif' });
    // 相区标签
    text(f, '固相', v.sx(-30), v.sy(3.4), { color: C.cool, font: '15px sans-serif' });
    text(f, '液相', v.sx(60), v.sy(4.4), { color: C.green, font: '15px sans-serif' });
    text(f, '气相', v.sx(300), v.sy(1.2), { color: C.warm, font: '15px sans-serif' });
    text(f, `当前压强 ${P.toFixed(1)} atm：沿等压线走，相变温度由曲线交点给出`, 56, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '温度 (℃) →', w - 130, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, 'P (atm，示意非线性)', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    footnotes(f, [
      '三相共存只认一个温压组合——由相图交点唯一确定，不随外界摆布',
      '水三相点曾是 1968 版国际温标的定义基准——全世界的温度计向它对表',
      '冰面或汽面稍有偏移就消失——它是极灵敏的温度指示器',
    ]);
    heading(f, '三相点：温标的钉子');
  },
});
registerViz(threePhasePoint);

/** 黑体辐射测量。 */
const blackbodyLab = defineViz({
  slug: 'blackbody-lab', title: '黑体辐射测量', animated: true,
  params: { T: { type: 'range', min: 1000, max: 8000, default: 5800, step: 200, label: '腔体温度 (K)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const T = num(params, 'T', 5800);
    clear(f);
    const v = view(f, { xMin: 0, xMax: 8, yMin: 0, yMax: 1.2, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 8, ticks: true });
    // 当前温度谱
    const peak = 2898 / T; // μm → 画布单位换算
    const scale = 5800 / T;
    const pts: [number, number][] = [];
    for (let i = 1; i <= 400; i++) {
      const x = (i / 400) * 8;
      const y = Math.pow(x * scale, 3) / (Math.exp(Math.min(50, (x * scale * 4900) / T)) - 1) * 0.55;
      pts.push([v.sx(x), v.sy(Math.min(1.15, y))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 3.4 });
    // 瑞利-金斯（经典，紫外灾难）
    const rj: [number, number][] = [];
    for (let i = 1; i <= 400; i++) {
      const x = (i / 400) * 8;
      rj.push([v.sx(x), v.sy(Math.min(1.15, x * scale * 1.1))]);
    }
    poly(f, rj, { stroke: `${C.hot}aa`, lw: 2, dash: [6, 5] });
    // 维恩（低频段吻合）
    // 峰值标记
    const pkX = Math.min(7.6, peak * 4);
    seg(f, v.sx(pkX), v.sy(0), v.sx(pkX), v.sy(1.15), `${C.warm}77`, 1.4, );
    text(f, `λ_max = 2898/T = ${peak.toFixed(2)} μm`, v.sx(pkX) + 8, v.sy(1.08), { color: C.warm, font: '12px sans-serif' });
    text(f, `T = ${T} K：实验点与普朗克曲线分毫不差`, 56, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '红色虚线 = 瑞利-金斯（经典）：低频吻合、高频冲向无穷——紫外灾难', 56, h - 66, { color: C.hot, font: '12px sans-serif' });
    text(f, '波长 λ →（μm）', w - 140, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, 'u(ν,T)', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    footnotes(f, [
      '维恩公式在高频正确、瑞利-金斯在低频正确——两边都补不上中间的坎',
      '普朗克假设能量一份一份发射：一次内插换来量子的破土（1900）',
      '空腔上的小孔是最完美的黑体——测它就是测自然本身的脾气',
    ]);
    heading(f, '黑体辐射：紫外灾难与量子破土');
  },
});
registerViz(blackbodyLab);

/** 劳埃德镜实验。 */
const lloydMirror = defineViz({
  slug: 'lloyd-mirror', title: '劳埃德镜实验', animated: true,
  params: { gap: { type: 'range', min: 0.2, max: 4, default: 1, step: 0.1, label: '缝-镜距离 (mm)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const gap = num(params, 'gap', 1);
    clear(f);
    // 镜面（斜放，掠入射）
    const mx = 70, my = h * 0.62;
    const mLen = w - 220;
    seg(f, mx, my, mx + mLen, my - 46, C.cool, 5);
    text(f, '平面镜', mx + mLen - 48, my - 66, { color: C.cool, font: '11px sans-serif' });
    // 真实缝
    const sx = mx + 40, sy = my - 24 - gap * 16;
    dot(f, sx, sy, 7, C.warm);
    text(f, '单色缝 S', sx - 12, sy - 16, { color: C.warm, font: '11px sans-serif' });
    // 虚源 S'（镜对称）
    const mirrorMidX = mx + mLen / 2, mirrorMidY = my - 23;
    const s2x = sx, s2y = my - 46 - (my - sy - (my - my)) * 0 - (sy - (my - ((sx - mx) / mLen) * 46)) * 1;
    // 简化：虚源在镜面另一侧对称位置
    const lineY = (x: number) => my - ((x - mx) / mLen) * 46;
    const sy2 = 2 * lineY(sx) - sy;
    void s2y; void s2x; void mirrorMidX; void mirrorMidY;
    dot(f, sx, sy2, 7, `${C.cool}cc`);
    text(f, "虚源 S'（镜中像）", sx - 12, sy2 + 24, { color: C.cool, font: '11px sans-serif' });
    // 干涉区光线
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 2);
    seg(f, sx, sy, sx + 240, sy - 6, `rgba(236,201,75,${0.5 + pulse * 0.5})`, 2);
    seg(f, sx, sy, sx + 240, lineY(sx + 240), `rgba(66,153,225,${0.5 + pulse * 0.5})`, 2);
    seg(f, sx + 240, lineY(sx + 240), sx + 420, sy - 60, `rgba(66,153,225,${0.5 + pulse * 0.5})`, 2);
    // 屏与条纹
    const scx = w - 86;
    seg(f, scx, 70, scx, h - 90, C.dim, 4);
    text(f, '屏', scx + 8, 76, { color: C.dim, font: '11px sans-serif' });
    for (let i = 0; i < 16; i++) {
      const y = 84 + i * 14;
      const phase = Math.cos(i * 1.5 + gap * 2);
      const nearZero = i === 0 || (i < 3 && phase > 0.5);
      const a = nearZero ? 0.12 : 0.35 + Math.max(0, phase) * 0.6;
      poly(f, [[scx - 14, y], [scx - 2, y], [scx - 2, y + 12], [scx - 14, y + 12]],
        { stroke: 'transparent', fill: `rgba(236,201,75,${a})` });
    }
    text(f, '接触端永远是暗纹——半波损失藏不住了', scx - 220, h - 74, { color: C.green, font: '12px sans-serif' });
    text(f, `缝-镜距 ${gap} mm：改变条纹间距——光程差 = 2h·sinθ`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    footnotes(f, [
      '镜面反射提供了与直接光相干的第二束——与杨氏双缝等价的分波前方案',
      '反射相位突变 π：原点处两束光相消，第零级从暗纹开始',
      '劳埃德 1834 年的实验把半波损失从推论变成可反复演示的现象',
    ]);
    heading(f, '劳埃德镜：半波损失的证词');
  },
});
registerViz(lloydMirror);
