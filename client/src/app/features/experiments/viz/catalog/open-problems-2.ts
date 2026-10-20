import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text, view, grid, curve, circle, vec, rng } from '../canvas';

/** P416 中子星状态方程：质量-半径关系与物态。 */
const neutronStarEos = defineViz({
  slug: 'neutron-star-eos',
  title: '中子星状态方程',
  params: { stiff: { type: 'range', min: 0, max: 100, default: 60, step: 5, label: '物态硬度' } },
  draw: (f) => {
    const { w, h, params } = f;
    const k = num(params, 'stiff', 60) / 100;
    clear(f);
    // 质量-半径图
    const v = view(f, { xMin: 8, xMax: 18, yMin: 0, yMax: 2.6, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 观测约束窗口（PSR J0030/J0740, NICER）
    poly(f, [[v.sx(11.5), v.sy(1.2)], [v.sx(13.8), v.sy(1.2)], [v.sx(13.8), v.sy(2.25)], [v.sx(11.5), v.sy(2.25)]],
      { fill: 'rgba(72,187,120,0.18)', stroke: C.green, lw: 1.4, dash: [6, 4] });
    text(f, 'NICER 观测窗', v.sx(11.6), v.sy(2.3), { color: C.green, font: '12px sans-serif' });
    // 三类物态曲线：软/中/硬
    const curves = [
      { c: C.cool, k: 0.3, name: '软（含夸克物质）' },
      { c: C.yellow, k: 0.6, name: '中（纯核物质）' },
      { c: C.hot, k: 0.9, name: '硬（刚性核力）' },
    ];
    for (const cu of curves) {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 100; i++) {
        const M = 0.2 + (i / 100) * 2.3;
        const R = 15.5 - 2.6 * cu.k - 0.5 * Math.pow(M / 2.2, 2.4);
        if (M < 0.55) continue;
        pts.push([v.sx(R), v.sy(M)]);
      }
      poly(f, pts, { stroke: cu.c, lw: 2.2 });
      const last = pts[pts.length - 1];
      if (last) text(f, cu.name, last[0] - 6, last[1] - 8, { align: 'right', color: cu.c, font: '11px sans-serif' });
    }
    // 当前选中
    const Mcur = 0.55 + k * 1.9, Rcur = 15.5 - 2.6 * k - 0.5 * Math.pow(Mcur / 2.2, 2.4);
    dot(f, v.sx(Rcur), v.sy(Mcur), 6, C.pink);
    text(f, `M = ${Mcur.toFixed(2)} M_⊙`, v.sx(Rcur) + 10, v.sy(Mcur) - 6, { color: C.pink, font: '13px sans-serif' });
    // 2 M_⊙ 线
    seg(f, v.sx(8), v.sy(2.0), v.sx(18), v.sy(2.0), C.hot, 1.4);
    text(f, '2.0 M_⊙（PSR J0740）⇒ 物态必须够硬', v.sx(8) + 6, v.sy(2.0) - 8, { color: C.hot, font: '12px sans-serif' });
    text(f, '半径 R (km)', (v.sx(8) + v.sx(18)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'M / M_⊙', v.sx(8) + 4, v.sy(2.5), { color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      'TOV 方程 + 物态 P(ρ)：中子星是唯一能用天文观测"摸内部"的致密实验室',
      '潮汐形变 Λ（GW170817）→ 半径约束；LIGO/Virgo 与 NICER 联合收紧 1.4 M_⊙ ≈ 12 km',
      '核心可能是超子/凝聚/Kaion 或夸克物质 —— 相变潜热决定冷却曲线（快速冷却信号）',
    ]);
    heading(f, '两倍太阳质量压进十二公里');
  },
});
registerViz(neutronStarEos);

/** P417 湍流间歇性：结构函数与间歇修正。 */
const turbulenceIntermittency = defineViz({
  slug: 'turbulence-intermittency',
  title: '湍流间歇性',
  params: { re: { type: 'range', min: 0, max: 100, default: 50, step: 5, label: '雷诺数（对数示意）' } },
  draw: (f) => {
    const { w, h, params } = f;
    const re = num(params, 're', 50) / 100;
    clear(f);
    // 左：涡旋级串（K41）
    const cx = w * 0.27, cy = h * 0.44;
    const sizes = [110, 72, 46, 28, 16, 9];
    sizes.forEach((r, i) => {
      const { ctx } = f;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((i * 0.7 + f.t * (0.3 + i * 0.2)) % (Math.PI * 2));
      ctx.strokeStyle = i < 3 ? `rgba(66,153,225,${0.85 - i * 0.15})` : `rgba(237,137,54,${0.8 - i * 0.1})`;
      ctx.lineWidth = Math.max(1.4, 4 - i * 0.5);
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.62, i * 0.9, 0, Math.PI * 1.65);
      ctx.stroke();
      ctx.restore();
    });
    text(f, '能量级串：大涡 → 小涡 → 热', cx, cy + 140, { align: 'center', color: C.cool, font: '13px sans-serif' });
    text(f, 'ε 常数通量', cx, cy + 160, { align: 'center', color: C.dim, font: '12px sans-serif' });
    // 右：结构函数标度律 S_p(r) ~ r^{ζ_p}
    const v = view(f, { xMin: -2, xMax: 2, yMin: 0, yMax: 6, inset: 46, insetBottom: 46 });
    grid(f, v);
    // K41 线性：ζ_p = p/3
    const k41: [number, number][] = [];
    for (let i = 0; i <= 40; i++) { const x = -2 + (i / 40) * 4; k41.push([v.sx(x), v.sy((4 / 3) * (x + 2) / 1)]); }
    // 精确一点
    const k41p: [number, number][] = [];
    const expP: [number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const x = -2 + (i / 60) * 4;
      k41p.push([v.sx(x), v.sy((4 / 3) * x + 4)]);
      // 间歇修正（She-Leveque 类似）：ζ_p = p/9 + 1 - (2/3)^{p-1} 简化
      const zeta = (p: number) => p / 9 + 1 - Math.pow(2 / 3, p - 1) + 0.0;
      expP.push([v.sx(x), v.sy((1 / 3) * x * (1.15 - re * 0.18) + 4 - re * 0.12 * x * x * 0.08)]);
    }
    poly(f, k41p, { stroke: C.cool, lw: 2.2, dash: [7, 5] });
    poly(f, expP, { stroke: C.hot, lw: 2.8 });
    text(f, 'K41 自相似：ζ_p = p/3（直线）', v.sx(-1.9), v.sy(5.6), { color: C.cool, font: '12px sans-serif' });
    text(f, `实测弯曲：间歇修正 ~${(re).toFixed(2)}`, v.sx(-1.9), v.sy(5.0), { color: C.hot, font: '12px sans-serif' });
    text(f, 'log r', (v.sx(-2) + v.sx(2)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'log S_p', v.sx(-2) + 4, v.sy(5.8), { color: C.dim, font: '12px sans-serif' });
    text(f, '高阶矩越来越陡 ⇒ 偶发的极端梯度（间歇热点）', 46, h - 116, { color: C.yellow, font: '13px sans-serif' });
    footnotes(f, [
      'Kolmogorov 1941：S_2(r) ~ (εr)^{2/3}，能谱 E(k) ~ k^{-5/3}',
      '间歇性：耗散集中在稀疏涡丝上，PDF 出现幂律尾 —— 奇异测度 multifractal',
      '应用：飞机抖振载荷、燃烧混合、大气扩散 —— 极端事件由尾部决定',
    ]);
    heading(f, 'K41 的自相似被什么打破');
  },
});
registerViz(turbulenceIntermittency);

/** P418 质子自旋危机：自旋分解饼图。 */
const protonSpinCrisis = defineViz({
  slug: 'proton-spin-crisis',
  title: '质子自旋危机',
  params: { era: { type: 'select', options: ['1987 前', 'EMC 1988', '格点 2020s'], default: 'EMC 1988', label: '数据年代' } },
  draw: (f) => {
    const { w, h, params } = f;
    const era = String(params['era'] ?? 'EMC 1988');
    clear(f);
    // 分解数据
    const data = era === '1987 前'
      ? [['价夸克 Δu+Δd+Δs', 1.0], ['胶子', 0], ['轨道', 0]]
      : era === 'EMC 1988'
        ? [['价夸克 ΔΣ', 0.30], ['胶子 ΔG', 0.20], ['轨道 L', 0.50]]
        : [['价夸克 ΔΣ ≈ 0.42', 0.42], ['胶子 ΔG ≈ 0.12', 0.12], ['轨道 L ≈ 0.46', 0.46]];
    const colors = [C.cool, C.warm, C.pink];
    const cx = w * 0.3, cy = h * 0.45, R = 110;
    let a0 = -Math.PI / 2;
    data.forEach(([, frac], i) => {
      const a1 = a0 + Math.PI * 2 * (frac as number);
      const { ctx } = f;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a0, a1);
      ctx.closePath();
      ctx.fillStyle = colors[i];
      ctx.fill();
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      a0 = a1;
    });
    // 图例
    data.forEach((row, i) => {
      const y = cy - 40 + i * 30;
      poly(f, [[cx + R + 30, y - 9], [cx + R + 48, y - 9], [cx + R + 48, y + 9], [cx + R + 30, y + 9]], { fill: colors[i] });
      text(f, String(row[0]), cx + R + 56, y + 5, { color: C.fg, font: '13px sans-serif' });
    });
    text(f, `年代：${era}`, cx, 70, { align: 'center', color: C.yellow, font: '15px sans-serif' });
    // 右：EMC 实验示意
    const bx = w * 0.72, by = h * 0.34;
    text(f, 'μN 深非弹性散射', bx, by - 46, { color: C.fg, font: '14px sans-serif' });
    vec(f, bx - 130, by - 10, bx - 20, by - 10, C.warm, 2.6);
    text(f, 'μ⁻', bx - 126, by - 24, { color: C.warm, font: '13px serif' });
    circle(f, bx + 30, by - 10, 34, { fill: 'rgba(66,153,225,0.7)', stroke: C.cool, lw: 2 });
    text(f, 'p', bx + 30, by - 5, { align: 'center', color: C.bg, font: '16px serif' });
    vec(f, bx + 30, by - 10, bx + 130, by - 60, C.hot, 2.6);
    vec(f, bx + 30, by - 10, bx + 120, by + 40, C.cyan, 2.6);
    text(f, 'EMC 用极化束发现：ΔΣ ≈ 0.3 —— 自旋不是夸克独扛', bx - 130, by + 96, { color: C.hot, font: '13px sans-serif' });
    text(f, 'Overspin 问题：轨道角动量藏了近一半', bx - 130, by + 120, { color: C.pink, font: '13px sans-serif' });
    footnotes(f, [
      '质子自旋 1/2：J = ½ΔΣ + ΔG/2 + L —— 1988 EMC 结果推翻"价夸克全包"图像',
      'RHIC 自旋计划、未来 EIC（2030s）：分夸克味、分横动量拆账',
      '格点 QCD 直接计算轨道项：近年收敛到 L ≈ 0.4，与全局分析一致',
    ]);
    heading(f, '1988：夸克只扛了三成自旋');
  },
});
registerViz(protonSpinCrisis);

/** P419 第五种力与等效原理：扭秤与 Yukawa 势。 */
const fifthForce = defineViz({
  slug: 'fifth-force',
  title: '第五种力与等效原理',
  params: { lambda: { type: 'range', min: -6, max: 0, default: -3, step: 0.5, label: '力程 log₁₀(λ/m)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const lg = num(params, 'lambda', -3);
    const lam = Math.pow(10, lg);
    clear(f);
    // 左：牛顿引力 vs Yukawa 修正
    const v = view(f, { xMin: -1, xMax: 1, yMin: -3, yMax: 1, inset: 46, insetBottom: 46 });
    grid(f, v);
    curve(f, v, (x) => (x <= 0.08 ? NaN : Math.log10(1 / (x * x)) - 0.6), { color: C.cool, lw: 2.4 });
    curve(f, v, (x) => (x <= 0.08 ? NaN : Math.log10(1 / (x * x) + Math.exp(-x / lam) / (x * lam * 120)) - 0.6), { color: C.hot, lw: 2.6 });
    text(f, '牛顿 1/r²', v.sx(-0.9), v.sy(0.4), { color: C.cool, font: '13px sans-serif' });
    text(f, '含 Yukawa：(1/r²)[1+αe^{−r/λ}]', v.sx(-0.9), v.sy(-0.1), { color: C.hot, font: '13px sans-serif' });
    text(f, 'log r (m)', (v.sx(-1) + v.sx(1)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'log F', v.sx(-1) + 4, v.sy(0.9), { color: C.dim, font: '12px sans-serif' });
    // 右：等效原理扭秤（Eötvös）
    const cx = w * 0.76, cy = h * 0.42;
    seg(f, cx, cy - 110, cx, cy - 40, C.dim, 2);
    seg(f, cx - 110, cy - 40, cx + 110, cy - 40, C.dim, 2.4);
    // 吊丝
    seg(f, cx, cy - 40, cx, cy - 10, C.yellow, 1.4);
    // 横杆
    const tilt = 0.04 * Math.sin(f.t * 1.5) * 0.3;
    const bx1 = cx - 100 * Math.cos(tilt), by1 = cy - 10 + 100 * Math.sin(tilt) * Math.sign(1);
    poly(f, [[cx - 100, cy - 10 + Math.sin(tilt) * 100 * 0.05], [cx + 100, cy - 10 - Math.sin(tilt) * 100 * 0.05]],
      { stroke: C.fg, lw: 2.6 });
    circle(f, cx - 96, cy - 8 + Math.sin(tilt) * 10, 16, { fill: 'rgba(66,153,225,0.85)', stroke: C.cool });
    circle(f, cx + 96, cy - 12 - Math.sin(tilt) * 10, 16, { fill: 'rgba(237,137,54,0.85)', stroke: C.warm });
    text(f, 'Pt', cx - 96, cy - 4, { align: 'center', color: C.bg, font: '13px serif' });
    text(f, 'Al', cx + 96, cy - 8, { align: 'center', color: C.bg, font: '13px serif' });
    text(f, '弱等效原理：不同材料同速下落', cx, cy + 60, { align: 'center', color: C.fg, font: '13px sans-serif' });
    text(f, 'CURRENT: Δa/a < 10⁻¹⁵（MICROSCOPE 2022）', cx, cy + 84, { align: 'center', color: C.green, font: '12px sans-serif' });
    // 大统一预期残余
    text(f, '弦论标度预期 α ~ 10⁻³⁰·(1+…)：仍在深挖', cx, cy + 108, { align: 'center', color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      '第五种力 = 汤川型新相互作用：耦合 α、力程 λ 两个参数刻画',
      '实验室：亚毫米扭秤（YTPM/STEF）；天体：白矮星冷却、月球激光测距',
      '等效原理破缺是许多新物理的共同低能信号（弦景观多重真空：不同宇宙不同常数）',
    ]);
    heading(f, '等效原理检验到 10⁻¹⁵：偏离在哪');
  },
});
registerViz(fifthForce);

/** P420 时间晶体：离散时间平移对称破缺。 */
const timeCrystal = defineViz({
  slug: 'time-crystal',
  title: '时间晶体',
  params: { drive: { type: 'range', min: 0, max: 100, default: 60, step: 5, label: '驱动失谐 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const detune = num(params, 'drive', 60) / 100;
    clear(f);
    // 上：普通晶体（空间周期）
    const y1 = 108;
    text(f, '空间晶体：平移对称自发破缺（原子周期排列）', 56, y1 - 26, { color: C.cool, font: '14px sans-serif' });
    for (let i = 0; i < 24; i++) {
      const x = 56 + i * ((w - 120) / 24);
      circle(f, x, y1, 9, { fill: `rgba(66,153,225,${0.5 + 0.4 * Math.sin(i * 1.7)})`, stroke: C.cool, lw: 1.4 });
    }
    // 中：受驱周期系统（时间对称）
    const y2 = h * 0.44;
    text(f, '受驱系统：驱动周期 T —— 时间对称未破缺（响应同频）', 56, y2 - 60, { color: C.green, font: '14px sans-serif' });
    const ptsNormal: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const x = 56 + (i / 300) * (w - 112);
      const t = (i / 300) * 12;
      ptsNormal.push([x, y2 - Math.sin(t * Math.PI * 2) * 34]);
    }
    poly(f, ptsNormal, { stroke: C.green, lw: 2.2 });
    // 下：时间晶体（次谐波响应 2T）
    const y3 = h * 0.72;
    text(f, '时间晶体：响应周期 2T —— 离散时间平移自发破缺', 56, y3 - 60, { color: C.hot, font: '14px sans-serif' });
    const ptsTC: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const x = 56 + (i / 300) * (w - 112);
      const t = (i / 300) * 12;
      // 次谐波：flip-flop 每周期翻转
      const s = Math.sin(t * Math.PI) * (1 - 0.1 * detune * Math.sin(t * 0.3));
      ptsTC.push([x, y3 - s * 36]);
    }
    poly(f, ptsTC, { stroke: C.hot, lw: 2.6 });
    // 驱动脉冲刻度
    for (let k = 0; k < 12; k++) {
      const x = 56 + (k / 12) * (w - 112);
      seg(f, x, y3 + 46, x, y3 + 56, C.yellow, 1.6);
    }
    text(f, '↑ 驱动周期 T：自旋每两步翻一次（nT 脉冲）', 56, y3 + 78, { color: C.yellow, font: '12px sans-serif' });
    footnotes(f, [
      'Wilczek (2012) 预言：空间晶体类比的时间有序 —— 基态在时间上自发周期',
      '争议：原案违反热力学第三定律；Li et al. (2017) 用 Floquet 自旋体系实现"存活"版本',
      '边界：无耗散 + 多体局域（或驱动稳定）才不被加热抹平；读出为次谐波响应',
    ]);
    heading(f, '打破时间平移对称的物态');
  },
});
registerViz(timeCrystal);

/** P421 常温超导的追寻：能隙与复现门槛。 */
const roomTemperatureSuperconductor = defineViz({
  slug: 'room-temperature-superconductor',
  title: '常温超导的追寻',
  params: { pressure: { type: 'select', options: ['常压', '高压 (GPa)'], default: '常压', label: '压力条件' } },
  draw: (f) => {
    const { w, h, params } = f;
    const highP = String(params['pressure'] ?? '').startsWith('高压');
    clear(f);
    // Tc 时间线散点
    const v = view(f, { xMin: 1911, xMax: 2028, yMin: 0, yMax: 320, inset: 46, insetBottom: 46 });
    grid(f, v);
    const points = highP
      ? [[1911, 4.2, 'Hg'], [1986, 35, 'BaLaCuO'], [1987, 93, 'YBCO'], [1993, 133, 'HgBaCaCuO'], [2015, 203, 'H₃S 高压'], [2019, 250, 'LaH₁₀'], [2020, 288, 'C-S-H (含争议)'], [2023, 338, 'N掺杂氢化物(争议)']]
      : [[1911, 4.2, 'Hg'], [1986, 35, 'BaLaCuO'], [1987, 93, 'YBCO'], [1993, 133, 'Hg 系'], [2019, 260, 'LK99(宣称)'], [2023, 300, 'LK99 复现失败']];
    for (const [x, y, label] of points) {
      const disputed = String(label).includes('争议') || String(label).includes('LK99');
      dot(f, v.sx(x as number), v.sy(y as number), 6, disputed ? C.hot : C.cool);
      text(f, String(label), v.sx(x as number) + 8, v.sy(y as number) - 8, { color: disputed ? C.hot : C.dim, font: '11px sans-serif' });
    }
    // 室温线
    seg(f, v.sx(1911), v.sy(293), v.sx(2028), v.sy(293), C.green, 1.6);
    text(f, '室温 293 K', v.sx(1912), v.sy(293) - 8, { color: C.green, font: '12px sans-serif' });
    if (highP) {
      poly(f, [[v.sx(1900), v.sy(40)], [v.sx(2028), v.sy(40)], [v.sx(2028), v.sy(300)], [v.sx(1900), v.sy(300)]],
        { fill: 'rgba(245,101,101,0.08)', stroke: C.hot, lw: 1.2, dash: [5, 5] });
      text(f, '高压区：Tc↑ 但需要金刚石对顶砧（~200 GPa）', v.sx(1940), v.sy(260), { color: C.hot, font: '13px sans-serif' });
    }
    text(f, '年份', (v.sx(1911) + v.sx(2028)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'Tc (K)', v.sx(1912), v.sy(310), { color: C.dim, font: '12px sans-serif' });
    // 底部：卡在哪
    text(f, highP ? '高压氢化物：近室温已实现，实用化卡在压力' : 'LK99 教训：单晶不纯、电阻不归零、复现门槛（零电阻 + 迈斯纳）', 46, h - 116, { color: C.yellow, font: '14px sans-serif' });
    footnotes(f, [
      'BCS：电声耦合配对，McMillan 公式封顶 Tc ~ 30–40 K（常规材料）',
      '铜基/铁基：强关联 d 波配对；氢化物：高声子频率 + 高压抑制解离',
      '判据必须齐：零电阻（≥4 点）、完全抗磁（迈斯纳）、临界场/流 —— 磁悬浮 alone 不够',
    ]);
    heading(f, 'LK99 之后：室温超导卡在哪');
  },
});
registerViz(roomTemperatureSuperconductor);

/** P422 机器学习能否发现新物理：符号回归与可证伪性。 */
const mlDiscovery = defineViz({
  slug: 'ml-discovery',
  title: '机器学习能否发现新物理',
  params: { noise: { type: 'range', min: 0, max: 50, default: 15, step: 5, label: '数据噪声 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const noise = num(params, 'noise', 15) / 100;
    clear(f);
    // 左：带噪声数据 + 两种拟合
    const v = view(f, { xMin: 0, xMax: 6.3, yMin: -2.4, yMax: 2.4, inset: 46, insetBottom: 46 });
    grid(f, v);
    const rand = rng(77);
    const pts: [number, number][] = [];
    for (let i = 0; i < 40; i++) {
      const x = (i / 39) * 6.3;
      pts.push([x, Math.sin(x) + (rand() - 0.5) * 2 * noise * 2]);
    }
    for (const [px, py] of pts) dot(f, v.sx(px), v.sy(py), 3.4, C.accent);
    // 物理真值
    curve(f, v, (x) => Math.sin(x), { color: C.green, lw: 2.4 });
    // 高自由度黑盒拟合
    curve(f, v, (x) => Math.sin(x) + noise * 3 * Math.sin(x * 7.3) * Math.cos(x * 13.7), { color: C.hot, lw: 2, dash: [6, 4] });
    text(f, '绿：物理真值 sin(x)', v.sx(0.2), v.sy(2.1), { color: C.green, font: '12px sans-serif' });
    text(f, '红：高自由度过拟合（训练误差更低）', v.sx(0.2), v.sy(1.75), { color: C.hot, font: '12px sans-serif' });
    text(f, 'x', (v.sx(0) + v.sx(6.3)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    // 右：决策管线
    const bx = w * 0.76;
    const steps = [['数据（实验/模拟）', C.cool], ['符号回归 / 代理模型', C.accent], ['候选公式', C.yellow], ['外推预测', C.warm], ['新实验判生死 ✓✗', C.green]];
    steps.forEach(([label, color], i) => {
      const y = 76 + i * 56;
      poly(f, [[bx - 120, y], [bx + 120, y], [bx + 120, y + 34], [bx - 120, y + 34]],
        { fill: 'rgba(45,55,72,0.85)', stroke: color as string, lw: 2 });
      text(f, String(label), bx, y + 22, { align: 'center', color: color as string, font: '13px sans-serif' });
      if (i < steps.length - 1) vec(f, bx, y + 34, bx, y + 54, C.dim, 1.8, 7);
    });
    text(f, '可证伪是最后一关', bx, 76 + 5 * 56 + 4, { align: 'center', color: C.pink, font: '13px sans-serif' });
    footnotes(f, [
      '符号回归（AI Feynman、PySR）：从数据搜公式，先验里塞物理（守恒、对称性）',
      '代理模型加速蒙特卡洛/格点：QMC、LHC 本底估计 —— 省算力不越权',
      '争议点：黑盒"发现"无法被理解则不算解释；外推失败 = 记账不是发现',
    ]);
    heading(f, 'AI 找到的规律算发现吗');
  },
});
registerViz(mlDiscovery);

/** P423 以太的兴衰：从介质到被判死刑。 */
const etherDecline = defineViz({
  slug: 'ether-decline',
  title: '以太的兴衰',
  params: { year: { type: 'range', min: 1650, max: 1905, default: 1887, step: 10, label: '年代' } },
  draw: (f) => {
    const { w, h, params } = f;
    const year = Math.round(num(params, 'year', 1887));
    clear(f);
    // 时间轴
    const x0 = 70, x1 = w - 50, ty = h - 130;
    seg(f, x0, ty, x1, ty, C.grid, 1.6);
    const events = [
      [1650, '笛卡尔：以太漩涡传力', C.cool],
      [1678, '惠更斯：光是纵波，需介质', C.accent],
      [1801, '杨/菲涅尔：横波 + 弹性固体以太', C.green],
      [1864, '麦克斯韦：电磁波 = 场的振动', C.warm],
      [1887, '迈克尔逊-莫雷：零结果', C.hot],
      [1905, '狭义相对论：以太多余', C.pink],
    ] as Array<[number, string, string]>;
    const sx = (yr: number) => x0 + ((yr - 1650) / 255) * (x1 - x0);
    for (const [yr, label, color] of events) {
      const active = year >= yr;
      dot(f, sx(yr), ty, active ? 6 : 4, active ? color : C.grid);
      const above = events.indexOf(events.find((e) => e[0] === yr)!) % 2 === 0;
      const ly = above ? ty - 34 : ty + 26;
      seg(f, sx(yr), ty, sx(yr), above ? ty - 16 : ty + 14, active ? color : `${C.grid}aa`, 1.4);
      text(f, label, sx(yr), ly, { align: 'center', color: active ? color : C.dim, font: '11px sans-serif' });
      text(f, String(yr), sx(yr), above ? ly - 14 : ly + 14, { align: 'center', color: C.dim, font: '10px sans-serif' });
    }
    // 上部：以太机械模型图
    const cx = w * 0.5, cy = h * 0.3;
    if (year < 1905) {
      // 弹性网格示意
      for (let i = 0; i <= 8; i++) {
        const gx = cx - 140 + i * 35;
        const pts: [number, number][] = [];
        for (let k = 0; k <= 30; k++) {
          const yy = cy - 70 + (k / 30) * 140;
          const wobble = Math.exp(-Math.pow((k - 15) / 8, 2)) * 26 * Math.sin(i * 0.8 + f.t * 2);
          pts.push([gx + wobble, yy]);
        }
        poly(f, pts, { stroke: `${C.accent}aa`, lw: 1.4 });
      }
      for (let j = 0; j <= 4; j++) {
        const yy = cy - 70 + j * 35;
        seg(f, cx - 140, yy, cx + 140, yy, `${C.grid}88`, 1);
      }
      text(f, '"无所不在的弹性固体"托着光波', cx, cy - 96, { align: 'center', color: C.accent, font: '13px sans-serif' });
      if (year >= 1887) {
        text(f, '但拖曳系数、横向刚度互相矛盾 —— 越修越怪', cx, cy + 106, { align: 'center', color: C.hot, font: '13px sans-serif' });
      }
    } else {
      text(f, '相对论时空：场自己振动，不需要舞台', cx, cy, { align: 'center', color: C.pink, font: '16px sans-serif' });
      text(f, '"以太的假设被证明是多余的"', cx, cy + 30, { align: 'center', color: C.dim, font: '13px sans-serif' });
    }
    footnotes(f, [
      '以太不是笑话：它承载了波动说的全部成功，直到力学解释自洽性崩塌',
      '迈克尔逊-莫雷 (1887)：地球相对以太风速度零结果 —— 洛伦兹收缩来救，相对论来终结论',
      '量子场论的真空有结构（涨落、极化）—— "以太"以场的形式部分回归',
    ]);
    heading(f, '一个概念的两百年：从必需到多余');
  },
});
registerViz(etherDecline);

/** P424 波粒之争：三百年拉锯时间线。 */
const waveParticleDebate = defineViz({
  slug: 'wave-particle-debate',
  title: '波粒之争',
  params: { camp: { type: 'select', options: ['微粒说', '波动说', '二象性'], default: '二象性', label: '当前主场' } },
  draw: (f) => {
    const { w, h, params } = f;
    const camp = String(params['camp'] ?? '二象性');
    clear(f);
    // 上下两条阵营时间线
    const x0 = 70, x1 = w - 50;
    const yWave = h * 0.34, yPart = h * 0.62;
    seg(f, x0, yWave, x1, yWave, C.cool, 2);
    seg(f, x0, yPart, x1, yPart, C.warm, 2);
    text(f, '波动说', x0, yWave - 60, { color: C.cool, font: '16px sans-serif' });
    text(f, '微粒说', x0, yPart + 76, { color: C.warm, font: '16px sans-serif' });
    const sx = (yr: number) => x0 + ((yr - 1650) / 300) * (x1 - x0);
    const waveE = [[1678, '惠更斯原理'], [1801, '杨双缝'], [1819, '菲涅尔衍射'], [1864, '麦氏电磁波'], [1905, 'E=hf 光量子'], [1924, '德布罗意'], [1961, '电子双缝']];
    const partE = [[1666, '牛顿棱镜'], [1704, '《光学》'], [1905, '光电效应'], [1923, '康普顿散射'], [1927, '戴维森-革末']];
    for (const [yr, label] of waveE) {
      const active = camp !== '微粒说';
      dot(f, sx(yr as number), yWave, 5.5, active ? C.cool : C.grid);
      text(f, String(label), sx(yr as number), yWave - 16, { align: 'center', color: active ? C.fg : C.dim, font: '11px sans-serif' });
      text(f, String(yr), sx(yr as number), yWave - 32, { align: 'center', color: C.dim, font: '10px sans-serif' });
    }
    for (const [yr, label] of partE) {
      const active = camp !== '波动说';
      dot(f, sx(yr as number), yPart, 5.5, active ? C.warm : C.grid);
      text(f, String(label), sx(yr as number), yPart + 20, { align: 'center', color: active ? C.fg : C.dim, font: '11px sans-serif' });
      text(f, String(yr), sx(yr as number), yPart + 36, { align: 'center', color: C.dim, font: '10px sans-serif' });
    }
    // 中间会师
    if (camp === '二象性') {
      const mx = sx(1927);
      circle(f, mx, (yWave + yPart) / 2, 44, { stroke: C.pink, lw: 2.4, fill: 'rgba(237,100,166,0.15)' });
      text(f, '互补原理', mx, (yWave + yPart) / 2 - 2, { align: 'center', color: C.pink, font: '14px sans-serif' });
      text(f, '玻尔 1928', mx, (yWave + yPart) / 2 + 18, { align: 'center', color: C.dim, font: '11px sans-serif' });
      seg(f, sx(1905), yWave + 10, mx - 40, (yWave + yPart) / 2 - 20, `${C.cool}aa`, 1.6);
      seg(f, sx(1923), yPart - 10, mx + 30, (yWave + yPart) / 2 + 20, `${C.warm}aa`, 1.6);
    }
    // 底部：双缝"每次一个"
    text(f, '今日共识：单个量子走所有路径（路径积分），探测决定呈现', 70, h - 74, { color: C.pink, font: '14px sans-serif' });
    footnotes(f, [
      '牛顿 vs 惠更斯：棱镜成功让微粒说统治百年；泊松亮斑 (1819) 是转折点',
      '爱因斯坦 1905：光量子解释光电效应 —— 波动说与粒子说各得一半',
      '单电子双缝（Tonomura 1989）：条纹逐颗积累 —— 二象性不是"两者都是"而是"超越两者"',
    ]);
    heading(f, '光的身份：三百年拉锯');
  },
});
registerViz(waveParticleDebate);

/** P425 量子诠释之争：贝尔检验后的立场分布。 */
const quantumInterpretationHistory = defineViz({
  slug: 'quantum-interpretation-history',
  title: '量子诠释之争',
  params: { exp: { type: 'select', options: ['EPR 1935', '贝尔 1964', '阿斯佩 1982', '无漏洞 2015'], default: '无漏洞 2015', label: '里程碑' } },
  draw: (f) => {
    const { w, h, params } = f;
    const stage = String(params['exp'] ?? '无漏洞 2015');
    clear(f);
    // 左：EPR 纠缠对示意
    const cx = w * 0.26, cy = h * 0.4;
    circle(f, cx - 110, cy, 26, { fill: 'rgba(66,153,225,0.8)', stroke: C.cool, lw: 2 });
    circle(f, cx + 110, cy, 26, { fill: 'rgba(237,137,54,0.8)', stroke: C.warm, lw: 2 });
    text(f, 'A', cx - 110, cy + 6, { align: 'center', color: C.bg, font: '16px serif' });
    text(f, 'B', cx + 110, cy + 6, { align: 'center', color: C.bg, font: '16px serif' });
    // 纠缠连线（脉动）
    const ph = Math.sin(f.t * 3) * 0.5 + 0.5;
    seg(f, cx - 84, cy, cx + 84, cy, `rgba(237,100,166,${0.35 + ph * 0.5})`, 2.4);
    text(f, '|↑↓⟩−|↓↑⟩ 纠缠源', cx, cy - 44, { align: 'center', color: C.pink, font: '13px sans-serif' });
    text(f, '贝尔不等式：S ≤ 2', cx, cy + 66, { align: 'center', color: C.fg, font: '14px sans-serif' });
    const S = stage === 'EPR 1935' ? 2 : stage === '贝尔 1964' ? 2 : 2 * Math.SQRT2;
    text(f, `量子力学预言 S = 2√2 ≈ 2.83（超上限 41%）`, cx, cy + 92, { align: 'center', color: C.yellow, font: '13px sans-serif' });
    // 右：诠释立场谱
    const bx = w * 0.6;
    text(f, '测量问题的答卷', bx, 76, { color: C.fg, font: '15px sans-serif' });
    const views = [
      ['哥本哈根：测量坍缩，别问"之间"', C.cool],
      ['隐变量（Bell 非定域版）', C.green],
      ['多世界：无坍缩，分支叠加', C.pink],
      ['退相干历史：环境选支', C.accent],
      ['QBism：波函数是主观信念', C.warm],
    ] as Array<[string, string]>;
    views.forEach(([label, color], i) => {
      const y = 112 + i * 46;
      const support = stage === '无漏洞 2015' && i < 2 ? 0.7 - i * 0.25 : 0.5;
      poly(f, [[bx, y], [bx + 300 * support, y], [bx + 300 * support, y + 30], [bx, y + 30]],
        { fill: `${color}33`, stroke: color, lw: 1.6 });
      text(f, label, bx + 8, y + 20, { color: C.fg, font: '12px sans-serif' });
    });
    text(f, '阿斯佩/楚泽林格/潘建伟 2022 诺奖：贝尔测试闭环', bx, 112 + 5 * 46 + 6, { color: C.green, font: '13px sans-serif' });
    footnotes(f, [
      'EPR (1935)：定域实在 vs 量子完备性；Bell (1964) 把争论变成可测不等式',
      '无漏洞实验 (2015)：探测效率 + 空间类分离同时满足，局域隐变量出局',
      '仍未决：概率从哪来？塌缩是否物理？诠释暂不改实验预言，但影响量子基础与量子引力',
    ]);
    heading(f, '测量问题至今没有共识');
  },
});
registerViz(quantumInterpretationHistory);

/** P426 宇宙从静到动：静态宇宙与退行发现。 */
const staticToExpandingUniverse = defineViz({
  slug: 'static-to-expanding-universe',
  title: '宇宙从静到动',
  params: { H0: { type: 'range', min: 0, max: 100, default: 67, step: 1, label: '哈勃常数 (km/s/Mpc, /1.5)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const H0 = num(params, 'H0', 67) / 1.5;
    clear(f);
    // 左：哈勃图 v = H0 d
    const v = view(f, { xMin: 0, xMax: 200, yMin: 0, yMax: 14000, inset: 46, insetBottom: 46 });
    grid(f, v);
    const rand = rng(19);
    for (let i = 0; i < 26; i++) {
      const d = 8 + rand() * 185;
      const vv = H0 * d * (0.85 + rand() * 0.3);
      dot(f, v.sx(d), v.sy(vv), 3.6, C.cool);
    }
    curve(f, v, (d) => H0 * d, { color: C.hot, lw: 2.6 });
    text(f, `v = H₀·d（H₀ ≈ ${(H0 * 1.5).toFixed(0)} km/s/Mpc）`, v.sx(60), v.sy(H0 * 60) - 14, { color: C.hot, font: '13px sans-serif' });
    text(f, '距离 (Mpc)', (v.sx(0) + v.sx(200)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, '退行速度 (km/s)', v.sx(2), v.sy(13300), { color: C.dim, font: '12px sans-serif' });
    text(f, '1929：24 个星系 —— 线性关系', v.sx(10), v.sy(12500), { color: C.cool, font: '13px sans-serif' });
    // 右：爱因斯坦静态模型 vs 膨胀
    const cx = w * 0.76, cy = h * 0.4;
    // 静态球
    circle(f, cx, cy, 66, { stroke: C.green, lw: 2.4, fill: 'rgba(72,187,120,0.12)' });
    text(f, '爱因斯坦静态宇宙', cx, cy - 84, { align: 'center', color: C.green, font: '13px sans-serif' });
    text(f, 'Λ 抵消引力 (1917)', cx, cy - 66, { align: 'center', color: C.dim, font: '11px sans-serif' });
    // 膨胀球（脉动）
    const R = 66 + Math.sin(f.t * 1.2) * 6;
    circle(f, cx, cy + 150, R, { stroke: C.hot, lw: 2.4, fill: 'rgba(245,101,101,0.12)' });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      vec(f, cx + Math.cos(a) * (R * 0.5), cy + 150 + Math.sin(a) * R * 0.5,
        cx + Math.cos(a) * (R + 26), cy + 150 + Math.sin(a) * (R + 26), C.yellow, 1.8, 7);
    }
    text(f, '弗里德曼膨胀 (1922) / 哈勃证实', cx, cy + 150 + R + 40, { align: 'center', color: C.hot, font: '13px sans-serif' });
    footnotes(f, [
      '爱因斯坦加 Λ 只为静态：1931 年承认"一生最大错误"（轶事出自伽莫夫）',
      '哈勃并非一人：斯里弗 (1917) 已测星系谱线红移；勒维特造就距离尺',
      '今日：H₀ 之争（SH0ES 73 vs CMB 67）—— 哈勃张力 5σ，新物理候选窗口',
    ]);
    heading(f, '从静态到退行：宇宙学的转身');
  },
});
registerViz(staticToExpandingUniverse);

/** P427 从云室到对撞机：探测工具百年升级。 */
const cloudChamberToCollider = defineViz({
  slug: 'cloud-chamber-to-collider',
  title: '从云室到对撞机',
  params: { era: { type: 'select', options: ['云室 1911', '泡室 1952', '对撞机 2012'], default: '对撞机 2012', label: '探测时代' } },
  draw: (f) => {
    const { w, h, params } = f;
    const era = String(params['era'] ?? '对撞机 2012');
    clear(f);
    const cx = w * 0.5, cy = h * 0.42;
    if (era.startsWith('云室')) {
      // 过饱和蒸气径迹
      poly(f, [[cx - 190, cy - 110], [cx + 190, cy - 110], [cx + 190, cy + 110], [cx - 190, cy + 110]],
        { fill: 'rgba(45,55,72,0.7)', stroke: C.grid, lw: 2 });
      const rand = rng(3);
      for (let i = 0; i < 5; i++) {
        const a = rand() * Math.PI * 2;
        const pts: [number, number][] = [];
        for (let k = 0; k <= 24; k++) {
          const t = k / 24;
          pts.push([cx - 140 + Math.cos(a + t * 0.5) * t * 240, cy + Math.sin(a + t * 0.5) * t * 170]);
        }
        poly(f, pts, { stroke: 'rgba(226,232,240,0.75)', lw: 1.4 });
      }
      text(f, '过饱和酒精蒸气：离子成核 → 雾珠径迹', cx, cy + 136, { align: 'center', color: C.fg, font: '13px sans-serif' });
      text(f, '正电子发现 (1932)、Λ/V 粒子 (1947) 都靠它', cx, cy + 158, { align: 'center', color: C.dim, font: '12px sans-serif' });
      text(f, '速度：曝光拍摄，事件率 ~ 每分钟几个', cx, cy - 136, { align: 'center', color: C.warm, font: '13px sans-serif' });
    } else if (era.startsWith('泡室')) {
      circle(f, cx, cy, 130, { stroke: C.cool, lw: 2.6, fill: 'rgba(66,153,225,0.1)' });
      text(f, '液氢泡室', cx, cy - 140, { align: 'center', color: C.cool, font: '14px sans-serif' });
      // 曲线径迹（磁场）
      const rand = rng(9);
      for (let i = 0; i < 7; i++) {
        const a0 = rand() * Math.PI * 2;
        const curv = (rand() - 0.5) * 0.06;
        const pts: [number, number][] = [];
        for (let k = 0; k <= 40; k++) {
          const t = k / 40;
          const r = t * 118;
          const ang = a0 + curv * t * 60;
          pts.push([cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]);
        }
        poly(f, pts, { stroke: `rgba(226,232,240,${0.4 + rand() * 0.5})`, lw: 1.5 });
      }
      text(f, '磁场中曲率 ⇒ 动量；气泡串联成电影', cx, cy + 156, { align: 'center', color: C.fg, font: '13px sans-serif' });
      text(f, '气泡室 + 磁铁：1960s 夸克候选粒子大爆发', cx, cy + 178, { align: 'center', color: C.dim, font: '12px sans-serif' });
      text(f, '速度：每秒 ~100 张照片，人工扫描', cx, cy - 160, { align: 'center', color: C.warm, font: '13px sans-serif' });
    } else {
      // 对撞机环
      circle(f, cx, cy, 140, { stroke: C.accent, lw: 3.4, fill: 'rgba(102,126,234,0.08)' });
      circle(f, cx, cy, 100, { stroke: `${C.grid}aa`, lw: 1.4, dash: [6, 6] });
      text(f, 'LHC 周长 26.7 km，14 TeV', cx, cy - 168, { align: 'center', color: C.accent, font: '14px sans-serif' });
      // 对撞点
      const det = [0, 90, 180, 270];
      for (const d of det) {
        const a = (d * Math.PI) / 180;
        const px = cx + Math.cos(a) * 140, py = cy + Math.sin(a) * 140;
        circle(f, px, py, 16, { stroke: C.yellow, lw: 2, fill: 'rgba(236,201,75,0.25)' });
      }
      // 喷注
      const boom = (Math.sin(f.t * 4) + 1) / 2;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        vec(f, cx, cy, cx + Math.cos(a) * (46 + boom * 34), cy + Math.sin(a) * (46 + boom * 34), i % 2 ? C.cool : C.hot, 2, 7);
      }
      text(f, '2012：10⁸ 事例/秒筛选 → 希格斯 (5σ)', cx, cy + 176, { align: 'center', color: C.green, font: '13px sans-serif' });
      text(f, '速度：每秒百万级触发 + GPU 农场在线重建', cx, cy + 198, { align: 'center', color: C.dim, font: '12px sans-serif' });
    }
    footnotes(f, [
      '灵敏度进化：径迹可见 → 电子学读出 → 全径迹量能器 + 触发系统',
      '亮度 L = N_bunch × f × n₁n₂/(4πσ²)：单位时间单位截面事例数',
      '未来：100 TeV FCC / 电子对撞机 CEPC —— 能标即发现力',
    ]);
    heading(f, '看见径迹到撞出新粒子：百年升级路');
  },
});
registerViz(cloudChamberToCollider);

/** P428 精密测量与基本常数：测量精度进化。 */
const precisionMeasurementHistory = defineViz({
  slug: 'precision-measurement-history',
  title: '精密测量与基本常数',
  params: { which: { type: 'select', options: ['引力常数 G', '精细结构常数 α', '电子质量比'], default: '精细结构常数 α', label: '常数' } },
  draw: (f) => {
    const { w, h, params } = f;
    const which = String(params['which'] ?? '精细结构常数 α');
    clear(f);
    // 精度随年代提升（对数）
    const v = view(f, { xMin: 1700, xMax: 2030, yMin: -12, yMax: -1, inset: 46, insetBottom: 46 });
    grid(f, v);
    const sets: Record<string, Array<[number, number, string]>> = {
      '引力常数 G': [[1798, -3, '卡文迪许 1e-3'], [1930, -5, '扭秤改进'], [1982, -5.5, '脉冲星测 G'], [2014, -5, 'BIPM 弹簧秤'], [2022, -5.3, '当前 5e-6（最差基本常数）']],
      '精细结构常数 α': [[1916, -5, '干涉法'], [1969, -8, '量子电动力学'], [1987, -9, '电子 g-2'], [2006, -10.5, 'Rb 跃迁'], [2020, -11, '铯干涉 1.3e-11']],
      '电子质量比': [[1910, -5, '油滴'], [1970, -8, '回旋共振'], [2006, -10, '离子阱 Penning'], [2020, -11, '量子比特称量']],
    };
    const pts = sets[which] ?? sets['精细结构常数 α'];
    const prev = pts.map(([x, y]) => [v.sx(x), v.sy(y)] as [number, number]);
    poly(f, prev, { stroke: C.accent, lw: 2.4 });
    for (const [x, y, label] of pts) {
      dot(f, v.sx(x), v.sy(y), 5.5, C.hot);
      text(f, label, v.sx(x) + 8, v.sy(y) + 4, { color: C.fg, font: '11px sans-serif' });
    }
    text(f, `${which}：测量相对精度 log₁₀(δ/x)`, v.sx(1704), v.sy(-1.4), { color: C.cool, font: '13px sans-serif' });
    text(f, '年份', (v.sx(1700) + v.sx(2030)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'log₁₀ 相对不确定度', v.sx(1702), v.sy(-11.6), { color: C.dim, font: '12px sans-serif' });
    // 右下：约瑟夫森与量子化
    const bx = w * 0.66, by = h - 150;
    text(f, '量子化基准：', bx, by, { color: C.green, font: '14px sans-serif' });
    text(f, 'V = n·f·(h/2e)（约瑟夫森）', bx, by + 24, { color: C.fg, font: '13px serif' });
    text(f, 'R_K = h/e² = 25812.807 Ω（冯·克利青）', bx, by + 46, { color: C.fg, font: '13px serif' });
    text(f, '1990 起：电压电阻由常数定义 —— 测量变成数频率', bx, by + 70, { color: C.yellow, font: '12px sans-serif' });
    footnotes(f, [
      '卡文迪许扭秤 (1798) 称出地球密度 ⇒ G 至今仍是基本常数里最不准的（~5×10⁻⁶）',
      'α 从电子反常磁矩 g-2 理论拟合得到 10⁻¹² 级 —— 与原子干预计数互相检验',
      '2019 SI 重定义：kg/A/K/mol 由 h、e、k_B、N_A 固定 —— 常数反过来定义单位',
    ]);
    heading(f, '常数的历史就是测准的历史');
  },
});
registerViz(precisionMeasurementHistory);

/** P429 科学范式与科学革命：库恩循环。 */
const paradigmShiftKuhn = defineViz({
  slug: 'paradigm-shift-kuhn',
  title: '科学范式与科学革命',
  params: { phase: { type: 'range', min: 0, max: 100, default: 50, step: 5, label: '革命进程 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const prog = num(params, 'phase', 50) / 100;
    clear(f);
    // 环形流程
    const cx = w * 0.5, cy = h * 0.44, R = 150;
    const stages = [
      ['常规科学', '解谜活动', C.cool],
      ['异例累积', '反常解不掉', C.warm],
      ['危机', '规则动摇', C.hot],
      ['革命', '新范式取胜', C.pink],
      ['新常规科学', '重定义问题', C.green],
    ] as Array<[string, string, string]>;
    stages.forEach(([name, sub, color], i) => {
      const a = (i / stages.length) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.78;
      const activeIdx = Math.floor(prog * stages.length);
      const isActive = i === Math.min(activeIdx, stages.length - 1);
      circle(f, x, y, isActive ? 56 : 48, { fill: isActive ? `${color}55` : 'rgba(45,55,72,0.9)', stroke: color, lw: isActive ? 3 : 1.8 });
      text(f, name, x, y - 2, { align: 'center', color: C.fg, font: isActive ? 'bold 14px sans-serif' : '13px sans-serif' });
      text(f, sub, x, y + 18, { align: 'center', color: C.dim, font: '11px sans-serif' });
      // 箭头
      const a2 = ((i + 1) / stages.length) * Math.PI * 2 - Math.PI / 2;
      const x2 = cx + Math.cos(a2) * R, y2 = cy + Math.sin(a2) * R * 0.78;
      const mx = (x + x2) / 2, my = (y + y2) / 2;
      const ang = Math.atan2(y2 - y, x2 - x);
      poly(f, [[mx + Math.cos(ang) * 10, my + Math.sin(ang) * 10],
        [mx + Math.cos(ang + 2.6) * 12, my + Math.sin(ang + 2.6) * 12],
        [mx + Math.cos(ang - 2.6) * 12, my + Math.sin(ang - 2.6) * 12]], { fill: C.dim });
    });
    text(f, '库恩《科学革命的结构》(1962)', cx, cy + 4, { align: 'center', color: C.yellow, font: '15px sans-serif' });
    text(f, '"不可通约性"：牛顿的"质量" ≠ 马赫的"质量"', cx, cy + 28, { align: 'center', color: C.dim, font: '12px sans-serif' });
    // 示例
    const ex = [['托勒密 → 哥白尼', 0.25], ['牛顿 → 相对论', 0.55], ['经典 → 量子', 0.8]] as Array<[string, number]>;
    ex.forEach(([label, t], i) => {
      text(f, (prog > t ? '✓ ' : '· ') + label, 56, h - 148 + i * 26, { color: prog > t ? C.green : C.dim, font: '13px sans-serif' });
    });
    footnotes(f, [
      '常规科学 = 范式内的"解谜"（puzzle-solving），异例先被容忍再压垮范式',
      '进步之争：Laudan《进步及其问题》回应——科学是否真的更接近真理',
      '影响：科学社会学强纲领 (Bloor)、费耶阿本德"怎么都行"—— 过度解读被科学哲学界批评',
    ]);
    heading(f, '范式更替凭什么算进步');
  },
});
registerViz(paradigmShiftKuhn);

/** P430 可证伪性与科学划界：波普尔的尺子。 */
const falsifiability = defineViz({
  slug: 'falsifiability',
  title: '可证伪性与科学划界',
  params: { claim: { type: 'select', options: ['所有天鹅是白的', '明天可能下雨', '存在不可见不可测实体', '电子质量 9.109e-31 kg'], default: '所有天鹅是白的', label: '待检命题' } },
  draw: (f) => {
    const { w, h, params } = f;
    const claim = String(params['claim'] ?? '所有天鹅是白的');
    clear(f);
    // 左：命题与反例搜索空间
    const x0 = 56, y0 = 90;
    text(f, `命题：「${claim}」`, x0, y0, { color: C.fg, font: '15px sans-serif' });
    // 搜索空间格
    const cols = 12, rows = 5;
    const rand = rng(41);
    const falsified = claim.startsWith('所有天鹅')
      ? 27
      : claim.startsWith('明天')
        ? -1
        : claim.startsWith('电子')
          ? 31
          : -1;
    for (let i = 0; i < cols * rows; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      const x = x0 + c * 40, y = y0 + 30 + r * 40;
      const isCounter = i === falsified;
      poly(f, [[x, y], [x + 34, y], [x + 34, y + 34], [x, y + 34]],
        { fill: isCounter ? 'rgba(245,101,101,0.75)' : `rgba(58,74,99,${0.4 + rand() * 0.4})`,
          stroke: isCounter ? C.hot : C.grid, lw: isCounter ? 2.4 : 1 });
      if (isCounter) text(f, '黑!', x + 17, y + 23, { align: 'center', color: C.fg, font: '13px sans-serif' });
    }
    text(f, '检验 = 在逻辑空间里找反例', x0, y0 + 30 + rows * 40 + 24, { color: C.dim, font: '13px sans-serif' });
    if (falsified >= 0) {
      text(f, '⇒ 命题被证伪（且已确证时更"冒险"）', x0, y0 + 30 + rows * 40 + 48, { color: C.hot, font: '14px sans-serif' });
    } else if (claim.startsWith('明天')) {
      text(f, '⇒ 可检验但不精确：明天要么下雨要么不下 —— 需概率化', x0, y0 + 30 + rows * 40 + 48, { color: C.warm, font: '14px sans-serif' });
    } else if (claim.startsWith('存在')) {
      text(f, '⇒ 原则上不可检：划界之外（形而上学而非伪科学）', x0, y0 + 30 + rows * 40 + 48, { color: C.pink, font: '14px sans-serif' });
    } else {
      text(f, '⇒ 高精度命题：任何 1e-9 偏差即证伪 —— 极度可证伪', x0, y0 + 30 + rows * 40 + 48, { color: C.green, font: '14px sans-serif' });
    }
    // 右：迪昂-蒯因：假设束
    const bx = w * 0.66, by = h * 0.36;
    text(f, '迪昂-蒯因论题：检验的是整束假设', bx, by - 50, { color: C.yellow, font: '14px sans-serif' });
    const bundle = ['核心理论', '辅助假设', '仪器模型', '背景场', '初始条件'];
    bundle.forEach((s, i) => {
      const y = by - 10 + i * 40;
      poly(f, [[bx, y], [bx + 230, y], [bx + 230, y + 30], [bx, y + 30]],
        { fill: i === 3 ? 'rgba(245,101,101,0.3)' : 'rgba(66,153,225,0.22)', stroke: i === 3 ? C.hot : C.cool, lw: 1.6 });
      text(f, s, bx + 115, y + 20, { align: 'center', color: C.fg, font: '13px sans-serif' });
    });
    vec(f, bx + 115, by - 26, bx + 115, by - 6, C.yellow, 2.4, 8);
    text(f, '反常时可以怪任何一环 —— 保护带', bx, by + 5 * 40 + 8, { align: 'left', color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      '波普尔：爱因斯坦敢于给出可被推翻的预言（光线弯曲 1919）才是划界标准',
      '划界难题：占星术"可证伪"吗？拉卡托斯（研究纲领）与费耶阿本德（认识论无政府主义）接招',
      '科学实践：可证伪性是必要不充分 —— 同行评审、可重复、贝叶斯更新共同把关',
    ]);
    heading(f, '能被什么打倒，才算科学');
  },
});
registerViz(falsifiability);

/** P431 诺贝尔的错失与迟来：时间线。 */
const nobelMisjudgments = defineViz({
  slug: 'nobel-misjudgments',
  title: '诺贝尔的错失与迟来',
  params: { sort: { type: 'select', options: ['按年份', '按遗憾度'], default: '按年份', label: '排序' } },
  draw: (f) => {
    const { w, h, params } = f;
    const bySort = String(params['sort'] ?? '') === '按年份';
    clear(f);
    const items = [
      ['泡利不相容 1925 → 诺奖 1945（迟 20 年）', 1945, 6],
      ['Zwicky：暗物质/中子星，终身未获奖', 0, 9],
      ['勒维特：周光关系 → 只在括号里', 0, 8],
      ['迈特纳：裂变机制，O. Hahn 独得 1944', 1944, 9],
      ['Jocelyn Bell：脉冲星，导师独得 1974', 1974, 8],
      ['Hubble：膨胀宇宙，诺奖天文学未成', 0, 7],
      ['Ehrenfest：统计与玻色统计传播', 0, 5],
      ['吴健雄：宇称实验 1957 理论即奖，实验未进', 0, 6],
      ['Sudarshan/Glauber：相干态，Glauber 2005', 2005, 6],
      ['Katalin Karikó：mRNA，2023 生理学奖', 2023, 4],
    ] as Array<[string, number, number]>;
    const sorted = bySort ? [...items].sort((a, b) => a[1] - b[1]) : [...items].sort((a, b) => b[2] - a[2]);
    sorted.forEach(([label, year, regret], i) => {
      const y = 66 + i * 38;
      const col = year === 0 ? C.hot : regret >= 8 ? C.warm : year > 2000 ? C.green : C.cool;
      poly(f, [[56, y], [w - 56, y], [w - 56, y + 30], [56, y + 30]], { fill: `${col}1e`, stroke: `${col}88`, lw: 1.2 });
      // 遗憾度
      const rw = (regret / 9) * 70;
      poly(f, [[64, y + 7], [64 + rw, y + 7], [64 + rw, y + 23], [64, y + 23]], { fill: `${col}aa` });
      text(f, `${regret}/9`, 64 + rw + 8, y + 20, { color: col, font: '11px sans-serif' });
      text(f, label, 150, y + 20, { color: C.fg, font: '13px sans-serif' });
    });
    footnotes(f, [
      '诺奖规则：最多 3 人、只授已定型工作 —— 结构性地制造"迟来"与"错过"',
      '1926 年才允许追授已故者？不 —— 规则相反：已故者不授，故迈特纳/Levi-Montalcini 等成憾',
      '偏见层面：1903–1963 仅居里夫人一位女性；团队贡献者常被主持人挤掉',
    ]);
    heading(f, '诺奖也有人情与盲区');
  },
});
registerViz(nobelMisjudgments);

/** P432 被低估的女性物理学家：贡献与名字。 */
const womenInPhysics = defineViz({
  slug: 'women-in-physics',
  title: '被低估的女性物理学家',
  params: { pick: { type: 'select', options: ['勒维特', '迈特纳', '吴健雄', 'Goeppert Mayer'], default: '勒维特', label: '人物' } },
  draw: (f) => {
    const { w, h, params } = f;
    const pick = String(params['pick'] ?? '勒维特');
    clear(f);
    const data: Record<string, { years: string; contrib: string; Nobel: string; lines: string[] }> = {
      '勒维特': {
        years: '1868–1921',
        contrib: '周光关系（1908–1912）',
        Nobel: '未获奖（1921 哈佛授予 Hubble，天文学奖未成）',
        lines: ['哈佛"计算员"：变星底片测量', '周期越长越亮 ⇒ 标准烛光', '没有她，哈勃量不出银河外距离', '勒维特定律是宇宙距离阶梯第一级'],
      },
      '迈特纳': {
        years: '1878–1968',
        contrib: '核裂变的物理解释 (1939)',
        Nobel: '1944 化学奖只给了 O. Hahn',
        lines: ['与 Hahn 合作 30 年，逃亡后继续书信合作', '用 Einstein E=mc² 解释铀裂变', '费米称"她应得诺奖"', 'Nn 分 1093 以她命名'],
      },
      '吴健雄': {
        years: '1912–1997',
        contrib: '宇称不守恒实验验证 (1957)',
        Nobel: '未获奖（理论者 1957 当年即奖）',
        lines: ['极化 ⁶⁰Co 低温 β 衰变', '6 周实验证实杨-李理论', '"实验中的居里夫人"', '也验证了 Wu 实验室的箭矢方向'],
      },
      'Goeppert Mayer': {
        years: '1906–1972',
        contrib: '核壳层模型 (1949)',
        Nobel: '1963 物理学奖（第三位女性得主）',
        lines: ['提出幻数的壳层解释', '自旋-轨道耦合常数', '长期无工资职位（"教授夫人"）', '原著曾被拒，靠 Feynman 背书发表'],
      },
    };
    const d = data[pick] ?? data['勒维特'];
    // 左：头像框 + 信息
    circle(f, w * 0.2, h * 0.4, 74, { fill: 'rgba(102,126,234,0.2)', stroke: C.accent, lw: 2.6 });
    text(f, pick[0], w * 0.2, h * 0.4 + 14, { align: 'center', color: C.accent, font: '40px serif' });
    text(f, pick, w * 0.2, h * 0.4 + 116, { align: 'center', color: C.fg, font: '17px sans-serif' });
    text(f, d.years, w * 0.2, h * 0.4 + 140, { align: 'center', color: C.dim, font: '13px sans-serif' });
    // 右：贡献与不公
    const bx = w * 0.4;
    text(f, `贡献：${d.contrib}`, bx, 96, { color: C.green, font: '15px sans-serif' });
    text(f, `诺奖：${d.Nobel}`, bx, 126, { color: C.hot, font: '14px sans-serif' });
    d.lines.forEach((line, i) => {
      text(f, '· ' + line, bx, 172 + i * 32, { color: C.fg, font: '14px sans-serif' });
    });
    // 底部统计
    text(f, '1901–2023：物理学奖 225 人次，女性 5 人（2.2%）', 56, h - 128, { color: C.yellow, font: '14px sans-serif' });
    footnotes(f, [
      '系统性因素：早期女性无学位/教职/署名权 —— 贡献常记在导师、丈夫、男性同事名下',
      '追赶中：Donna Strickland (2018，诺奖前 5 年无教职)、Andrea Ghez (2020)、Anne L\'Huillier (2023)',
      'names not in brackets：重新署名是科学史的纠错，也是资源分配的纠错',
    ]);
    heading(f, '名字不该只在括号里出现');
  },
});
registerViz(womenInPhysics);
