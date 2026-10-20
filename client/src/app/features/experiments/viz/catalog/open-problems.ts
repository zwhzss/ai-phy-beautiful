import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text, view, grid, curve, circle, vec, rng } from '../canvas';

/** P399 量子引力与时空量子化：普朗克尺度的对数标度阶梯。 */
const quantumGravity = defineViz({
  slug: 'quantum-gravity',
  title: '量子引力与时空量子化',
  params: { zoom: { type: 'range', min: 0, max: 100, default: 50, step: 5, label: '向普朗克尺度推进 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const zoom = num(params, 'zoom', 50);
    clear(f);
    // 对数尺度阶梯：从 1 m 到普朗克长度 1.6e-35 m
    const x0 = 70, x1 = w - 40, y0 = h - 96, y1 = 54;
    const Lmin = -35, Lmax = 0; // log10(米)
    const cursor = Lmax - (zoom / 100) * (Lmax - Lmin);
    const sx = (lg: number) => x0 + ((lg - Lmin) / (Lmax - Lmin)) * (x1 - x0);
    seg(f, x0, y0, x1, y0, C.grid, 1.4);
    const marks: Array<[number, string]> = [
      [0, '人 (2 m)'], [-2, '尘埃'], [-6, '原子核'], [-15, '原子'], [-19, '质子'],
      [-27, '中微子波长'], [-35, '普朗克长度'],
    ];
    for (const [lg, label] of marks) {
      const x = sx(lg);
      seg(f, x, y0, x, y0 + 6, C.dim, 1.4);
      text(f, label, x, y0 + 20, { align: 'center', color: C.dim, font: '11px sans-serif' });
      text(f, `10^${lg} m`, x, y0 + 34, { align: 'center', color: C.dim, font: '10px sans-serif' });
    }
    // 游标：已知物理（蓝） vs 量子引力未知区（红）
    const cx = sx(cursor);
    seg(f, cx, y1, cx, y0, `${C.hot}cc`, 2);
    dot(f, cx, y1 + 8, 5, C.hot);
    // 两条"有效理论"横条
    poly(f, [[sx(Lmin), y1 + 40], [sx(-19), y1 + 40], [sx(-19), y1 + 60], [sx(Lmin), y1 + 60]],
      { fill: 'rgba(245,101,101,0.25)', stroke: C.hot, lw: 1.5 });
    text(f, '量子引力区（未知）：圈量子 / 弦 / 全息', sx(Lmin) + 8, y1 + 55, { color: C.hot, font: '12px sans-serif' });
    poly(f, [[sx(-19), y1 + 68], [sx(Lmax), y1 + 68], [sx(Lmax), y1 + 88], [sx(-19), y1 + 88]],
      { fill: 'rgba(66,153,225,0.2)', stroke: C.cool, lw: 1.5 });
    text(f, '广义相对论 + 量子场论各自有效', sx(-19) + 8, y1 + 83, { color: C.cool, font: '12px sans-serif' });
    // 普朗克尺度处画离散格点示意
    const rand = rng(7);
    const gx0 = w * 0.62, gy0 = h * 0.42, cell = 10;
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 6; j++) {
        const on = rand() > 0.35;
        poly(f, [[gx0 + i * cell, gy0 + j * cell], [gx0 + (i + 1) * cell - 1.5, gy0 + j * cell],
          [gx0 + (i + 1) * cell - 1.5, gy0 + (j + 1) * cell - 1.5], [gx0 + i * cell, gy0 + (j + 1) * cell - 1.5]],
          { fill: on ? 'rgba(102,126,234,0.7)' : 'rgba(58,74,99,0.5)', stroke: C.grid, lw: 0.8 });
      }
    }
    text(f, '自旋网络 / 离散体积元', gx0, gy0 - 10, { color: C.accent, font: '12px sans-serif' });
    footnotes(f, [
      '普朗克长度 ℓ_P = √(ℏG/c³) ≈ 1.6×10⁻³⁵ m，普朗克时间 ≈ 5.4×10⁻⁴⁴ s',
      '双标准差：量子涨落 ~10⁴² K 空时不再光滑 —— 微扰展开在此必然发散（不可重整化）',
      '圈量子：面积/体积量子化；弦：额外维度紧致化；全息：边界编码体内自由度',
    ]);
    heading(f, '走向普朗克尺度：时空是连续的吗？');
  },
});
registerViz(quantumGravity);

/** P400 暗物质粒子候选：三路围猎示意。 */
const darkMatterParticles = defineViz({
  slug: 'dark-matter-particles',
  title: '暗物质粒子候选',
  params: { path: { type: 'select', options: ['直接探测', '对撞机', '间接探测'], default: '直接探测', label: '探测路线' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = String(params['path'] ?? '直接探测');
    clear(f);
    const cx = w / 2, cy = h * 0.44;
    // 晕轮背景
    const rand = rng(21);
    for (let i = 0; i < 140; i++) {
      const a = rand() * Math.PI * 2, r = 40 + rand() * 170;
      dot(f, cx + Math.cos(a) * r * 1.5, cy + Math.sin(a) * r * 0.7, 1.4, 'rgba(160,174,192,0.5)');
    }
    text(f, '银河暗物质晕（~85% 物质）', cx, cy - 130, { align: 'center', color: C.dim, font: '13px sans-serif' });
    if (mode === '直接探测') {
      // 地下探测器截面
      poly(f, [[cx - 90, cy - 50], [cx + 90, cy - 50], [cx + 90, cy + 50], [cx - 90, cy + 50]],
        { fill: 'rgba(45,55,72,0.9)', stroke: C.cyan, lw: 2 });
      text(f, '低温量热器 / 液氙', cx, cy + 4, { align: 'center', color: C.cyan, font: '13px sans-serif' });
      vec(f, cx - 200, cy - 30, cx - 96, cy - 10, C.accent, 2.4);
      text(f, 'WIMP 弹跳核反冲', cx - 196, cy - 40, { color: C.accent, font: '12px sans-serif' });
      dot(f, cx + 40, cy - 8, 7, C.hot);
      text(f, '≈2 keV 反冲', cx + 52, cy - 4, { color: C.hot, font: '12px sans-serif' });
      footnotes(f, [
        'XENONnT / PandaX-4T / CDEX：地下实验室屏蔽宇宙线，期待核反冲信号',
        '速度 ~220 km/s 的银河晕粒子穿过地壳 —— 每吨年事件率不足 1 次',
        '无信号即排除：画出截面-质量图上一条条被否掉的参数曲线',
      ]);
    } else if (mode === '对撞机') {
      // LHC 对撞
      circle(f, cx, cy, 70, { stroke: C.grid, lw: 2, fill: 'rgba(45,55,72,0.7)' });
      text(f, 'LHC: pp → X + X̄', cx, cy + 4, { align: 'center', color: C.fg, font: '14px sans-serif' });
      vec(f, cx - 190, cy, cx - 74, cy, C.cool, 3);
      vec(f, cx + 190, cy, cx + 74, cy, C.cool, 3);
      const rand2 = rng(5);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        vec(f, cx, cy, cx + Math.cos(a) * 130, cy + Math.sin(a) * 90, C.warm, 2);
      }
      text(f, '丢失横能量 → 不可见粒子对', cx, cy + 108, { align: 'center', color: C.warm, font: '13px sans-serif' });
      footnotes(f, [
        '对撞产生暗物质对：探测器里只剩"缺失的能量动量"这一负面证据',
        'LHC 联合超出标准模型的可见衰变产物（喷注 + E_T^miss）搜索',
        '限制超对称 WIMP 与带电稳定粒子的质量下界',
      ]);
    } else {
      // 间接探测：湮灭伽马
      circle(f, cx, cy, 55, { stroke: C.pink, lw: 2, dash: [6, 5] });
      text(f, 'DM + DM̄ → γγ / e⁺e⁻', cx, cy + 4, { align: 'center', color: C.pink, font: '13px sans-serif' });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        vec(f, cx + Math.cos(a) * 60, cy + Math.sin(a) * 60, cx + Math.cos(a) * 150, cy + Math.sin(a) * 105, C.yellow, 2);
      }
      text(f, 'Fermi-LAT / DAMPE 看多余伽马射线', cx, cy + 150, { align: 'center', color: C.yellow, font: '13px sans-serif' });
      footnotes(f, [
        '银河中心、矮星系的伽马线超出可能是湮灭信号，也可能是脉冲星叠加',
        '丰度巧合：热遗迹计算的 Ω_DM ≈ 观测值（WIMP 契机的原点）',
        '轴子：微波腔中的暗光子转化；惰性中微子：X 射线 3.5 keV 线争议',
      ]);
    }
    heading(f, '三路围猎：直接探测、对撞机、间接探测');
  },
});
registerViz(darkMatterParticles);

/** P401 宇宙学常数与真空灾难：120 个数量级的对数对比。 */
const cosmologicalConstant = defineViz({
  slug: 'cosmological-constant',
  title: '宇宙学常数与真空灾难',
  draw: (f) => {
    const { w, h } = f;
    clear(f);
    const x0 = 90, x1 = w - 40, y0 = h - 110, y1 = 70;
    const Lmin = -9, Lmax = 120; // log10(ρ·m_Pl⁴ 归一)
    const sx = (lg: number) => x0 + ((lg - Lmin) / (Lmax - Lmin)) * (x1 - x0);
    seg(f, x0, y0, x1, y0, C.grid, 1.4);
    for (let lg = 0; lg <= 120; lg += 20) {
      const x = sx(lg);
      seg(f, x, y0, x, y0 + 6, C.dim, 1.4);
      text(f, `10^${lg}`, x, y0 + 20, { align: 'center', color: C.dim, font: '11px sans-serif' });
    }
    // QFT 预言（红）与观测（蓝）
    const xQFT = sx(120), xObs = sx(-3);
    poly(f, [[xQFT - 12, y1], [xQFT + 12, y1], [xQFT + 12, y0], [xQFT - 12, y0]], { fill: 'rgba(245,101,101,0.35)' });
    poly(f, [[xObs - 12, y1], [xObs + 12, y1], [xObs + 12, y0], [xObs - 12, y0]], { fill: 'rgba(66,153,225,0.4)' });
    text(f, 'QFT 真空零点能', xQFT, y1 - 14, { align: 'center', color: C.hot, font: '13px sans-serif' });
    text(f, '观测 Λ', xObs, y1 - 14, { align: 'center', color: C.cool, font: '13px sans-serif' });
    // 差距箭头
    seg(f, xObs + 16, y1 + 40, xQFT - 16, y1 + 40, C.yellow, 2.4);
    poly(f, [[xQFT - 16, y1 + 40], [xQFT - 28, y1 + 34], [xQFT - 28, y1 + 46]], { fill: C.yellow });
    poly(f, [[xObs + 16, y1 + 40], [xObs + 28, y1 + 34], [xObs + 28, y1 + 46]], { fill: C.yellow });
    text(f, '差 120 个数量级：理论物理最大的尴尬', (xObs + xQFT) / 2, y1 + 30, { align: 'center', color: C.yellow, font: '14px sans-serif' });
    // 精细调节示意：势能小球
    const bx = w * 0.5, by = h - 170;
    poly(f, [[bx - 160, by - 40], [bx - 120, by + 30], [bx - 80, by + 34], [bx, by - 10], [bx + 80, by + 34], [bx + 120, by + 30], [bx + 160, by - 40]],
      { stroke: C.accent, lw: 2.4 });
    circle(f, bx + 78, by + 26, 7, { fill: C.hot });
    text(f, '稍一拨动 → 宇宙要么暴涨要么大撕裂', bx, by - 56, { align: 'center', color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      'ρ_vac ~ (100 GeV)⁴ vs 观测 ρ_Λ ~ (2.2×10⁻³ eV)⁴ —— 相差 10¹²⁰',
      '宇宙常数问题 + 地平线问题 + 平坦性问题：需要精细调节到 10⁻⁵⁴ 量级',
      '解释候选：人择多重宇宙（弦景观）、真空相变历史、幻能动力学',
    ]);
    heading(f, '真空灾难：10¹²⁰ 的两个答案');
  },
});
registerViz(cosmologicalConstant);

/** P402 自然性与层级问题：希格斯质量的二次发散修正。 */
const hierarchyProblem = defineViz({
  slug: 'hierarchy-problem',
  title: '自然性与层级问题',
  params: { cutoff: { type: 'range', min: 2, max: 19, default: 19, step: 0.5, label: '截断能标 log₁₀(Λ/GeV)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const L = num(params, 'cutoff', 19);
    clear(f);
    // 修正 Δm² ~ Λ²/16π² 曲线（对数纵轴）
    const v = view(f, { xMin: 2, xMax: 19, yMin: -4, yMax: 18, inset: 46, insetBottom: 46 });
    grid(f, v);
    curve(f, v, (x) => 2 * x - 3.5, { color: C.hot, lw: 2.6 }); // log10(Λ²/16π²)
    curve(f, v, () => Math.log10(125.25 * 125.25), { color: C.cool, lw: 2, dash: [6, 5] });
    // 游标
    const dc = 2 * L - 3.5;
    dot(f, v.sx(L), v.sy(dc), 6, C.hot);
    text(f, `Δm ~ 10^${dc.toFixed(1)} GeV`, v.sx(L) + 10, v.sy(dc) - 8, { color: C.hot, font: '13px sans-serif' });
    text(f, 'm_H = 125 GeV', v.xMax - 2, v.sy(Math.log10(125.25 * 125.25)) - 8, { align: 'right', color: C.cool, font: '12px sans-serif' });
    text(f, '对数 Λ (GeV)', (v.sx(2) + v.sx(19)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, '圈修正 log₁₀Δm²', v.sx(2) + 6, v.sy(16), { color: C.hot, font: '12px sans-serif' });
    // 自然性判据
    text(f, '若 Λ = M_Pl：抵消需精调到 10⁻³⁴ —— 不"自然"', 46, h - 108, { color: C.yellow, font: '13px sans-serif' });
    footnotes(f, [
      '顶夸克/希格斯圈贡献 δm_H² = -(λ_t²/8π²)Λ² + … 与 Λ² 成正比（二次发散）',
      '自然性判据：新物理贡献应与 m_H² 同量级，否则需要抵消到不可思议的精度',
      '解法候选：超对称（费米-玻色圈相消）、复合希格斯、额外维度 —— LHC 均未发现',
    ]);
    heading(f, '层级问题：Λ² 发散为什么没把希格斯推到普朗克尺度');
  },
});
registerViz(hierarchyProblem);

/** P403 时间之箭与过去假说：可逆方程 vs 熵增。 */
const timesArrow = defineViz({
  slug: 'times-arrow',
  title: '时间之箭与过去假说',
  params: { t: { type: 'range', min: 0, max: 100, default: 50, step: 1, label: '时间进程 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const prog = num(params, 't', 50) / 100;
    clear(f);
    // 左：相空间粒子盒（可逆）
    const bx = 60, by = 90, bw = w * 0.42, bh = h * 0.42;
    poly(f, [[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]], { stroke: C.grid, lw: 1.6, fill: 'rgba(45,55,72,0.4)' });
    const rand = rng(11);
    const N = 60;
    const pts = [];
    for (let i = 0; i < N; i++) pts.push([rand(), rand(), rand() - 0.5, rand() - 0.5]);
    const tau = prog * 6;
    for (const [px, py, vx, vy] of pts) {
      const nx = (px + vx * tau * 0.3 + 10) % 1;
      const ny = (py + vy * tau * 0.3 + 10) % 1;
      dot(f, bx + nx * bw, by + ny * bh, 3.4, C.cool);
    }
    text(f, '微观：牛顿方程 t → −t 对称（两边都能跑）', bx, by - 14, { color: C.cool, font: '13px sans-serif' });
    // 右：熵曲线
    const cx0 = w * 0.56, cx1 = w - 46, cy0 = by + bh, cy1 = by + 40;
    const sx = (x: number) => cx0 + x * (cx1 - cx0);
    const sy = (s: number) => cy0 - s * (cy0 - cy1);
    seg(f, cx0, cy0, cx1, cy0, C.grid, 1.4);
    seg(f, cx0, cy0, cx0, cy1 - 10, C.grid, 1.4);
    const S = (x: number) => Math.min(1, 0.06 + 0.94 * (1 - Math.exp(-3.2 * x)));
    const pts2: [number, number][] = [];
    for (let i = 0; i <= 100; i++) { const x = i / 100; pts2.push([sx(x), sy(S(x))]); }
    poly(f, pts2, { stroke: C.warm, lw: 2.6 });
    dot(f, sx(prog), sy(S(prog)), 6, C.hot);
    seg(f, sx(prog), cy0, sx(prog), sy(S(prog)), `${C.hot}77`, 1.4);
    text(f, 'S(宇宙)', cx0 + 6, cy1 - 6, { color: C.warm, font: '12px sans-serif' });
    text(f, 't=0 低熵初态（Past Hypothesis）', cx0, cy0 + 20, { color: C.yellow, font: '12px sans-serif' });
    text(f, 't', cx1 - 4, cy0 + 20, { align: 'right', color: C.dim, font: '12px sans-serif' });
    // 宏观箭头
    text(f, '→ 粗粒化后：熵增给时间一个方向', cx0, cy1 - 30, { color: C.warm, font: '13px sans-serif' });
    footnotes(f, [
      '玻尔兹曼：S = k ln W；涨落会回来吗？等待时间远超宇宙年龄（庞加莱回归）',
      '引力熵特殊：均匀气体熵最大，但引力下均匀态才是低熵（黑洞最高熵）',
      '争论：过去假说是解释还是公设？熵增是否需要外部视角（多宇宙）',
    ]);
    heading(f, '时间为什么只往一边走');
  },
});
registerViz(timesArrow);

/** P404 高温超导机理：铜基相图与赝能隙。 */
const highTcMechanism = defineViz({
  slug: 'high-tc-mechanism',
  title: '高温超导机理',
  params: { doping: { type: 'range', min: 0, max: 0.3, default: 0.16, step: 0.01, label: '空穴掺杂 p' } },
  draw: (f) => {
    const { w, h, params } = f;
    const p = num(params, 'doping', 0.16);
    clear(f);
    const v = view(f, { xMin: 0, xMax: 0.3, yMin: 0, yMax: 400, inset: 46, insetBottom: 44 });
    grid(f, v);
    // 反铁磁区
    poly(f, [[v.sx(0), v.sy(0)], [v.sx(0.05), v.sy(0)], [v.sx(0.05), v.sy(320)], [v.sx(0), v.sy(320)]],
      { fill: 'rgba(102,126,234,0.28)', stroke: C.accent, lw: 1.4 });
    text(f, '反铁磁', v.sx(0.005), v.sy(340), { color: C.accent, font: '12px sans-serif' });
    // 超导拱形 dome：Tc(p) = Tc_max·(1-((p-0.16)/0.12)²)
    const Tc = (x: number) => 92 * (1 - Math.pow((x - 0.16) / 0.115, 2));
    const pts: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const x = (i / 120) * 0.3;
      const t = Tc(x);
      if (t > 0) pts.push([v.sx(x), v.sy(t)]);
    }
    poly(f, pts, { stroke: C.cool, lw: 2.8, fill: 'rgba(66,153,225,0.22)', close: true });
    // 赭能隙弧
    const pts2: [number, number][] = [];
    for (let i = 0; i <= 80; i++) {
      const x = 0.03 + (i / 80) * 0.2;
      pts2.push([v.sx(x), v.sy(180 + 700 * Math.pow(x - 0.19, 2))]);
    }
    poly(f, pts2, { stroke: C.warm, lw: 2, dash: [7, 5] });
    text(f, '赝能隙 T*', v.sx(0.2), v.sy(250), { color: C.warm, font: '12px sans-serif' });
    // 当前掺杂
    dot(f, v.sx(p), v.sy(Math.max(0, Tc(p))), 6, C.hot);
    text(f, `Tc = ${Math.max(0, Tc(p)).toFixed(0)} K`, v.sx(p) + 10, v.sy(Math.max(0, Tc(p))) - 8, { color: C.hot, font: '13px sans-serif' });
    text(f, '空穴掺杂 p', (v.sx(0) + v.sx(0.3)) / 2, h - 48, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'T (K)', v.sx(0.005) + 4, v.sy(390), { color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      '铜氧化物 Tc > 77 K（液氮温区），但机理三十年未闭合 —— 与常规 BCS 声子机制不同',
      '三种竞争解释：赝能隙序 vs 超导前驱 / 条纹相与电荷密度波 / 序参量 d 波对称性',
      '母体是反铁磁 Mott 绝缘体 —— 强关联电子是核心难点（RMP 与 Hubbard 模型）',
    ]);
    heading(f, '铜基超导相图：dome、赝能隙与争论');
  },
});
registerViz(highTcMechanism);

/** P405 色禁闭与质子质量之谜：质量构成饼图 + 线性势。 */
const confinementMass = defineViz({
  slug: 'confinement-mass',
  title: '色禁闭与质子质量之谜',
  draw: (f) => {
    const { w, h } = f;
    clear(f);
    // 左：质量构成（夸克 1% vs 胶子/动能 99%）
    const cx = w * 0.26, cy = h * 0.44, R = 95;
    // 扇形绘制
    const arc = (a0: number, a1: number, color: string) => {
      const { ctx } = f;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a0, a1);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    };
    const start = -Math.PI / 2;
    arc(start, start + Math.PI * 2 * 0.99, 'rgba(66,153,225,0.75)');
    arc(start + Math.PI * 2 * 0.99, start + Math.PI * 2, C.hot);
    text(f, '胶子场能 + 夸克动能 99%', cx, cy + 4, { align: 'center', color: C.fg, font: '13px sans-serif' });
    text(f, '≈ 860 MeV', cx, cy + 24, { align: 'center', color: C.cool, font: '15px sans-serif' });
    text(f, '希格斯给的夸克组分 ~1%', cx, cy + R + 30, { align: 'center', color: C.hot, font: '12px sans-serif' });
    text(f, '质子 938 MeV 的来源', cx, 64, { align: 'center', color: C.fg, font: '14px sans-serif' });
    // 右：线性势 V(r) = σr
    const x0 = w * 0.54, x1 = w - 46, y0 = h - 110, y1 = 74;
    const sx = (r: number) => x0 + (r / 1.2) * (x1 - x0);
    const sy = (E: number) => y0 - (E / 2.4) * (y0 - y1);
    seg(f, x0, y0, x1, y0, C.grid, 1.4);
    seg(f, x0, y0, x0, y1 - 8, C.grid, 1.4);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 100; i++) { const r = (i / 100) * 1.2; pts.push([sx(r), sy(1.2 * r)]); }
    poly(f, pts, { stroke: C.warm, lw: 2.8 });
    text(f, 'V(r) = σr（σ ≈ 0.18 GeV²）', x0 + 8, y1 + 14, { color: C.warm, font: '13px sans-serif' });
    text(f, 'r (fm)', x1 - 4, y0 + 20, { align: 'right', color: C.dim, font: '12px sans-serif' });
    text(f, '能量 (GeV)', x0 + 4, y1 - 6, { color: C.dim, font: '12px sans-serif' });
    // 夸克对产生
    dot(f, sx(0.5), sy(0.6), 7, C.cool);
    dot(f, sx(0.9), sy(1.08), 7, C.cool);
    seg(f, sx(0.5), sy(0.6), sx(0.9), sy(1.08), C.yellow, 2);
    text(f, '拉远 → 能量足以创生新夸克对 → 永远拉不出单夸克', x0, y0 + 40, { color: C.yellow, font: '12px sans-serif' });
    footnotes(f, [
      '格点 QCD：质子质量中 u/d 夸克裸质量仅 ~1%，其余来自胶子与夸克动能（E=mc² 的纯场能）',
      '渐近自由：短程（高能）耦合变弱 —— 微扰 QCD 可算；长程禁闭只能靠格点',
      '手征对称性自发破缺给出夸克组分质量 ~300 MeV，与希格斯机制分工',
    ]);
    heading(f, '色禁闭：为什么拽不出夸克');
  },
});
registerViz(confinementMass);

/** P406 中微子绝对质量与顺序：正序/逆序能级对比。 */
const neutrinoMassOrdering = defineViz({
  slug: 'neutrino-mass-ordering',
  title: '中微子绝对质量与顺序',
  params: { ordering: { type: 'select', options: ['正序 (NO)', '逆序 (IO)'], default: '正序 (NO)', label: '质量顺序' } },
  draw: (f) => {
    const { w, h, params } = f;
    const io = String(params['ordering'] ?? '').startsWith('逆');
    clear(f);
    const cx = w / 2, y0 = h - 120, scale = 1.15; // px per eV²
    const dm21 = 7.5e-5, dm31 = 2.5e-3;
    const levels: Array<[number, string]> = io
      ? [[0, 'm₁ (重)'], [dm21, 'm₂'], [Math.abs(dm31), 'm₃ (轻)']]
      : [[0, 'm₁ (轻)'], [dm21, 'm₂'], [dm21 + dm31, 'm₃ (重)']];
    const maxY = Math.max(...levels.map((l) => l[0]));
    const sy = (e: number) => y0 - (e / maxY) * 240;
    const xs = [w * 0.3, w * 0.5, w * 0.7];
    levels.forEach(([e, label], i) => {
      const y = sy(e);
      seg(f, xs[i] - 70, y, xs[i] + 70, y, i === 2 ? C.hot : C.cool, 3);
      text(f, label, xs[i], y - 10, { align: 'center', color: C.fg, font: '13px sans-serif' });
      text(f, `Δm² = ${(e * 1e5).toFixed(1)}×10⁻⁵ eV²`, xs[i], y + 18, { align: 'center', color: C.dim, font: '11px sans-serif' });
    });
    // 太阳/大气振荡标注
    seg(f, xs[0], sy(0) + 34, xs[1], sy(dm21) + 34, C.cyan, 2);
    text(f, '太阳 ν（²¹⁴Bi/反应堆）', (xs[0] + xs[1]) / 2, sy(0) + 52, { align: 'center', color: C.cyan, font: '12px sans-serif' });
    seg(f, xs[1], sy(dm21) - 30, xs[2], sy(levels[2][0]) - 30, C.yellow, 2);
    text(f, '大气 ν（JUNO 未定顺序）', (xs[1] + xs[2]) / 2, sy(maxY) - 44, { align: 'center', color: C.yellow, font: '12px sans-serif' });
    text(f, io ? '逆序：m₃ 最轻' : '正序：m₁ 最轻', cx, 64, { align: 'center', color: io ? C.warm : C.cool, font: '15px sans-serif' });
    text(f, '振荡只测 Δm² —— 整体高度（绝对质量）未知', cx, 92, { align: 'center', color: C.dim, font: '13px sans-serif' });
    footnotes(f, [
      'KATRIN：β 衰变谱端点给出 m_β < 0.45 eV（2024）；宇宙学 Σm_ν < 0.072 eV',
      'NOvA/T2K/JUNO/冰立方：联合拟合仍偏好正序，但显著性不足 3σ',
      '无中微子双β衰变（下一步 76Ge/136Xe）寻找马约拉纳本质：m_ββ 是否为零',
    ]);
    heading(f, '质量顺序：正序还是逆序？');
  },
});
registerViz(neutrinoMassOrdering);

/** P407 希格斯真空亚稳态：势能曲线与假真空。 */
const higgsVacuumStability = defineViz({
  slug: 'higgs-vacuum-stability',
  title: '希格斯真空亚稳态',
  params: { mt: { type: 'range', min: 170, max: 176, default: 172.7, step: 0.1, label: '顶夸克质量 m_t (GeV)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mt = num(params, 'mt', 172.7);
    clear(f);
    // 有效势（示意）：m_t 越大越倾向亚稳
    const stability = (mt - 171.5) / 2.5; // 0..1+ 越大越亚稳
    const v = view(f, { xMin: -1.4, xMax: 1.4, yMin: -1.1, yMax: 1.6, inset: 44, insetBottom: 44 });
    grid(f, v);
    const V = (x: number) => {
      const quartic = 1.15 * x * x * x * x - 0.62 * x * x;
      const barrier = stability * 0.5 * Math.exp(-Math.pow((x - 0.62) / 0.3, 2));
      const trueV = -0.85 + 0.9 * Math.pow((x - 1.05) / 0.4, 2) * (x > 0.7 ? 1 : 0);
      return quartic + barrier + (stability > 0.35 && x > 0.75 ? -0.5 * stability * Math.sinh((x - 0.75) * 3) * 0.1 : 0);
    };
    const pts: [number, number][] = [];
    for (let i = 0; i <= 240; i++) {
      const x = -1.4 + (i / 240) * 2.8;
      pts.push([v.sx(x), v.sy(V(x))]);
    }
    poly(f, pts, { stroke: stability > 0.5 ? C.warm : C.cool, lw: 2.8 });
    // 我们的真空
    dot(f, v.sx(0), v.sy(0), 7, C.cool);
    text(f, '我们的真空（亚稳）', v.sx(0) + 10, v.sy(0) - 10, { color: C.cool, font: '13px sans-serif' });
    if (stability > 0.4) {
      dot(f, v.sx(1.25), v.sy(-0.5), 7, C.hot);
      text(f, '真真空？', v.sx(1.25) + 10, v.sy(-0.5), { color: C.hot, font: '13px sans-serif' });
      text(f, '势垒 → 量子隧穿 → 气泡膨胀', v.sx(-1.3), v.sy(1.4), { color: C.yellow, font: '13px sans-serif' });
    }
    text(f, 'φ (场强，归一)', (v.sx(-1.4) + v.sx(1.4)) / 2, h - 48, { align: 'center', color: C.dim, font: '12px sans-serif' });
    const verdict = stability < 0.35 ? '稳定：标准模型参数下真空长存' : stability < 0.7 ? '亚稳：隧穿时间 ≫ 宇宙年龄' : '不稳定：衰变应已发生（与观测矛盾）';
    text(f, `m_t = ${mt.toFixed(1)} GeV ⇒ ${verdict}`, 46, h - 116, { color: stability > 0.7 ? C.hot : stability > 0.35 ? C.warm : C.green, font: '14px sans-serif' });
    footnotes(f, [
      'λ(φ) 在高能跑动变负：顶夸克 Yukawa 耦合把希格斯自耦合拉下去（单圈 RG）',
      '当前世界平均：真空处于亚稳边界附近，m_t 与 α_s 的误差决定判决',
      '若衰变：真真空气泡以光速扩张，穿过之处物理常数改写 —— 但概率可忽略（寿命 ≫ 10¹⁰⁰ 年）',
    ]);
    heading(f, '希格斯势：我们住在假真空里吗？');
  },
});
registerViz(higgsVacuumStability);

/** P408 磁单极子之谜：狄拉克量子化条件与实验空手。 */
const magneticMonopole = defineViz({
  slug: 'magnetic-monopole',
  title: '磁单极子之谜',
  params: { monopoles: { type: 'range', min: 0, max: 12, default: 6, step: 1, label: '磁荷线数' } },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'monopoles', 6));
    clear(f);
    const cx = w * 0.3, cy = h * 0.45, R = 34;
    // 单极子：辐射状磁力线
    circle(f, cx, cy, R, { fill: 'rgba(102,126,234,0.85)', stroke: C.accent, lw: 2 });
    text(f, 'g', cx, cy + 6, { align: 'center', color: C.fg, font: '18px serif' });
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x2 = cx + Math.cos(a) * (R + 90), y2 = cy + Math.sin(a) * (R + 90);
      vec(f, cx + Math.cos(a) * (R + 4), cy + Math.sin(a) * (R + 4), x2, y2, C.cyan, 2);
    }
    text(f, '磁荷 g：∮B·dA = μ₀g（有源）', cx, cy + R + 116, { align: 'center', color: C.cyan, font: '13px sans-serif' });
    // 偶极子：闭合回路
    const dx = w * 0.7;
    circle(f, dx, cy, R, { fill: 'rgba(72,187,120,0.8)', stroke: C.green, lw: 2 });
    text(f, 'm', dx, cy + 6, { align: 'center', color: C.bg, font: '18px serif' });
    for (let i = 0; i < 4; i++) {
      const off = (i - 1.5) * 34;
      const pts: [number, number][] = [];
      for (let k = 0; k <= 40; k++) {
        const t = k / 40;
        pts.push([dx + Math.sin(t * Math.PI) * (60 + Math.abs(off) * 0.3) + off * t, cy - R + t * 2 * R * 0.02 + (t - 0.5) * 170 * Math.sign(off || 1) * 0.001]);
      }
      // 简化画环形力线
      const rr = 70 + i * 26;
      const { ctx } = f;
      ctx.save();
      ctx.strokeStyle = 'rgba(72,187,120,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(dx, cy, rr * 0.7, rr, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    text(f, '磁偶极子：∮B·dA = 0（无源）', dx, cy + R + 116, { align: 'center', color: C.green, font: '13px sans-serif' });
    footnotes(f, [
      '狄拉克：eg = n·ℏ/2 ⇒ 磁荷必须量子化（单个磁荷即可解释电荷量子化）',
      'GUT 预言单极子质量 ~10¹⁶ GeV，宇宙学遗迹丰度过高 —— 暴胀稀释了它们',
      'MoEDAL/LHC 直接搜寻、月岩分析、宇宙线成分：均未确认；φ 场宇宙弦内可藏类单极子',
    ]);
    heading(f, '磁单极子：优雅的对称与空手的实验');
  },
});
registerViz(magneticMonopole);

/** P409 轴子与强 CP 问题：微波腔探测示意。 */
const axionStrongcp = defineViz({
  slug: 'axion-strongcp',
  title: '轴子与强 CP 问题',
  params: { mass: { type: 'range', min: 1, max: 100, default: 40, step: 1, label: '轴子质量 μeV（对数示意）' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mA = num(params, 'mass', 40);
    clear(f);
    // 左：强 CP 问题 θ̄
    const x0 = 60, y0 = 92;
    text(f, 'QCD 拉氏量含 θ (F·F̃) 项', x0, y0, { color: C.fg, font: '14px sans-serif' });
    text(f, '实验：中子电偶极矩 ⇒ |θ̄| < 10⁻¹⁰', x0, y0 + 26, { color: C.cyan, font: '13px sans-serif' });
    text(f, '理论却允许 θ ~ O(1) —— 为何如此小？', x0, y0 + 50, { color: C.hot, font: '13px sans-serif' });
    // 精度条对比
    const bx = x0, by = y0 + 80, bw = w * 0.4;
    poly(f, [[bx, by], [bx + bw, by], [bx + bw, by + 26], [bx, by + 26]], { fill: 'rgba(58,74,99,0.7)', stroke: C.grid, lw: 1 });
    poly(f, [[bx, by], [bx + 3, by], [bx + 3, by + 26], [bx, by + 26]], { fill: C.green });
    text(f, '实验上限 10⁻¹⁰ ←——— 允许范围 ~1 ———→', bx + 8, by + 44, { color: C.dim, font: '12px sans-serif' });
    // 右：Peccei-Quinn + 轴子动力学弛豫
    const px = w * 0.55, py = h * 0.36;
    const v = view(f, { xMin: -3.2, xMax: 3.2, yMin: 0, yMax: 4, inset: 40 });
    const V = (a: number) => (1 - Math.cos(a)) * 0.8 + 0.18 * Math.min(...[1.2, 2.4].map(() => 0)) * 0; // 简化
    const pts: [number, number][] = [];
    for (let i = 0; i <= 200; i++) {
      const a = -3.2 + (i / 200) * 6.4;
      pts.push([v.sx(a), v.sy((1 - Math.cos(a)) * 0.8 + 0.16 * (1 - Math.cos(a)) * Math.exp(-1))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.6 });
    dot(f, v.sx(0), v.sy(0), 6, C.hot);
    text(f, 'θ 被动力学拉到 0：新轻粒子（轴子）', 46, h - 136, { color: C.accent, font: '13px sans-serif' });
    // 微波腔示意
    const mx = w * 0.72, my = h * 0.6;
    poly(f, [[mx - 90, my - 50], [mx + 90, my - 50], [mx + 90, my + 50], [mx - 90, my + 50]],
      { stroke: C.cyan, lw: 2.2, fill: 'rgba(45,55,72,0.8)' });
    for (let i = 0; i < 5; i++) {
      seg(f, mx - 70 + i * 34, my - 40, mx - 70 + i * 34, my + 40, `${C.cyan}66`, 1.4);
    }
    const reson = Math.abs(Math.sin(f.t * 2)) * 0.6 + 0.4;
    text(f, `腔共振 ${mA} μeV`, mx, my - 64, { align: 'center', color: C.yellow, font: '13px sans-serif' });
    text(f, 'a → γ（强 B 场转化）', mx, my + 6, { align: 'center', color: C.fg, font: '13px sans-serif' });
    text(f, `信号强度 ∝ ${reson.toFixed(2)}（扫频中）`, mx, my + 74, { align: 'center', color: C.green, font: '12px sans-serif' });
    footnotes(f, [
      'Peccei-Quinn (1977)：把 θ 变成动力学场，真空自动选 θ=0 —— 预言新粒子"轴子"',
      'ADMX 扫描中微波腔；轴子也是暗物质候选（冷、无碰撞、丰度可算）',
      '质量窗口 ~1–100 μeV（QCD 起源）；HAYSTAC/ORGAN/CAPP 多腔并进',
    ]);
    heading(f, '轴子：用一个粒子修补两个漏洞');
  },
});
registerViz(axionStrongcp);

/** P410 费米悖论与大过滤器：德雷克方程与过滤器阶梯。 */
const fermiParadox = defineViz({
  slug: 'fermi-paradox',
  title: '费米悖论与大过滤器',
  params: { filt: { type: 'range', min: 1, max: 9, default: 7, step: 1, label: '大过滤器所在阶段' } },
  draw: (f) => {
    const { w, h, params } = f;
    const stage = Math.round(num(params, 'filt', 7));
    clear(f);
    // 德雷克方程因子条
    const factors: Array<[string, string, number]> = [['N*', '恒星数', 0.9], ['f_p', '行星比例', 0.8], ['n_e', '宜居行星', 0.5], ['f_l', '生命出现', 0.4], ['f_i', '智慧', 0.3], ['f_c', '文明发出信号', 0.2], ['L', '文明寿命', 0.15]];
    const fx = 56, fy = 76, fw = (w - 112) / factors.length;
    factors.forEach(([sym, name, v], i) => {
      const x = fx + i * fw;
      const barH = 60 * (v as number);
      poly(f, [[x + 6, fy + 70 - barH], [x + fw - 10, fy + 70 - barH], [x + fw - 10, fy + 70], [x + 6, fy + 70]],
        { fill: `rgba(66,153,225,${0.35 + 0.5 * (v as number)})`, stroke: C.cool, lw: 1.2 });
      text(f, String(sym), x + fw / 2, fy + 88, { align: 'center', color: C.fg, font: '13px serif' });
      text(f, name, x + fw / 2, fy + 104, { align: 'center', color: C.dim, font: '11px sans-serif' });
    });
    text(f, 'N = N*·f_p·n_e·f_l·f_i·f_c·L —— 每个因子都可能压垮 N', 56, fy - 10, { color: C.cool, font: '13px sans-serif' });
    // 大过滤器阶梯
    const sx0 = 56, sy0 = h - 148, sw = (w - 112) / 9;
    const names = ['RNA', '原核', '真核', '多细胞', '智慧', '技术', '自我毁灭', '星际殖民', '∞'];
    for (let i = 0; i < 9; i++) {
      const x = sx0 + i * sw;
      const passed = i + 1 <= stage;
      const hot = i + 1 === stage;
      poly(f, [[x + 4, sy0], [x + sw - 6, sy0], [x + sw - 6, sy0 + 46], [x + 4, sy0 + 46]],
        { fill: hot ? 'rgba(245,101,101,0.5)' : passed ? 'rgba(72,187,120,0.35)' : 'rgba(58,74,99,0.6)',
          stroke: hot ? C.hot : passed ? C.green : C.grid, lw: hot ? 2.4 : 1.4 });
      text(f, names[i], x + (sw - 2) / 2, sy0 + 28, { align: 'center', color: C.fg, font: '11px sans-serif' });
    }
    text(f, '大过滤器若在左侧：生命罕见，我们孤独而珍贵', sx0, sy0 - 14, { color: C.green, font: '13px sans-serif' });
    text(f, '在右侧（技术文明难持续）：我们已过线，前方危险', sx0, sy0 + 66, { color: C.hot, font: '13px sans-serif' });
    footnotes(f, [
      '费米：他们都（1950）—— 宇宙 138 亿年、千亿星系，地外文明痕迹应随处可见',
      '稀有地球：复杂生命需恰好的地质/天文条件；大过滤器：某一步概率极低',
      'Kardashev I–III 级、射电静默假说、黑暗森林（假说非定论）、模拟论证',
    ]);
    heading(f, '德雷克方程与大过滤器：我们在哪一格');
  },
});
registerViz(fermiParadox);

/** P411 意识的难问题：神经相关物与主观体验的鸿沟。 */
const consciousnessHardProblem = defineViz({
  slug: 'consciousness-hard-problem',
  title: '意识的难问题',
  params: { iit: { type: 'range', min: 0, max: 100, default: 55, step: 5, label: '整合信息 Φ (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const phi = num(params, 'iit', 55) / 100;
    clear(f);
    // 左：可测量的神经活动
    const x0 = 56, y0 = 86, bw = w * 0.4;
    text(f, '可测量（简单问题）', x0, y0, { color: C.cool, font: '14px sans-serif' });
    const rand = rng(31);
    for (let n = 0; n < 5; n++) {
      const yBase = y0 + 34 + n * 34;
      seg(f, x0, yBase, x0 + bw, yBase, `${C.grid}88`, 1);
      const pts: [number, number][] = [];
      for (let i = 0; i <= 80; i++) {
        const x = x0 + (i / 80) * bw;
        const spike = rand() > 0.86 ? (rand() - 0.5) * 44 : (rand() - 0.5) * 6;
        pts.push([x, yBase - spike]);
      }
      poly(f, pts, { stroke: C.cool, lw: 1.6 });
      text(f, `神经元 ${n + 1}`, x0 + bw + 8, yBase + 4, { color: C.dim, font: '11px sans-serif' });
    }
    // 右：Φ 整合网络
    const cx = w * 0.74, cy = h * 0.42, R = 96;
    const nodes: [number, number][] = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      nodes.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.8]);
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if ((i * 7 + j * 3) % 5 < phi * 4) seg(f, nodes[i][0], nodes[i][1], nodes[j][0], nodes[j][1], `rgba(236,201,75,${0.15 + phi * 0.3})`, 1);
      }
    }
    nodes.forEach(([x, y], i) => dot(f, x, y, 7, i % 3 === 0 ? C.pink : C.accent));
    text(f, `Φ = ${phi.toFixed(2)}：信息整体 > 部分之和`, cx, cy + R * 0.8 + 34, { align: 'center', color: C.yellow, font: '13px sans-serif' });
    // 中间鸿沟
    const gx = w * 0.52;
    for (let i = 0; i < 6; i++) {
      seg(f, gx - 6, 96 + i * 44, gx + 6, 130 + i * 44, `${C.hot}aa`, 2);
    }
    text(f, '解释鸿沟', gx, h * 0.5, { align: 'center', color: C.hot, font: '14px sans-serif' });
    text(f, '主观体验（难问题）如何从物理过程中涌现？', 56, h - 122, { color: C.pink, font: '14px sans-serif' });
    footnotes(f, [
      'Chalmers (1995)：功能与行为可解释（简单问题），"为何有体验"仍无物理机制说明',
      '立场光谱：物理主义 / 泛心论 / 二元论 / 幻觉主义（Dennett、Frankish）',
      'IIT（Tononi）：Φ 定量意识；GNW 全局工作空间；均为未决的科学纲领',
    ]);
    heading(f, '神经活动可测，主观体验从何而来');
  },
});
registerViz(consciousnessHardProblem);

/** P412 生命起源的物理约束：耗散结构与自复制。 */
const originOfLifePhysics = defineViz({
  slug: 'origin-of-life-physics',
  title: '生命起源的物理约束',
  params: { flux: { type: 'range', min: 0, max: 100, default: 60, step: 5, label: '能量流驱动 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const drive = num(params, 'flux', 60) / 100;
    clear(f);
    // 左：热力学第二定律 vs 局部有序（耗散结构）
    const x0 = 60, y0 = 96, cw = w * 0.36, ch = h * 0.5;
    poly(f, [[x0, y0], [x0 + cw, y0], [x0 + cw, y0 + ch], [x0, y0 + ch]], { stroke: C.grid, lw: 1.6, fill: 'rgba(45,55,72,0.5)' });
    // 贝纳德对流胞
    const rand = rng(13);
    const cellsN = 4;
    for (let i = 0; i < cellsN; i++) {
      for (let j = 0; j < 3; j++) {
        const bx = x0 + 16 + i * (cw - 32) / cellsN;
        const by = y0 + 20 + j * (ch - 40) / 3;
        const bw2 = (cw - 32) / cellsN - 8, bh2 = (ch - 40) / 3 - 8;
        const hot = drive > 0.3;
        poly(f, [[bx, by], [bx + bw2, by], [bx + bw2, by + bh2], [bx, by + bh2]],
          { fill: hot ? `rgba(237,137,54,${0.25 + drive * 0.45 * (0.6 + 0.4 * Math.sin(f.t * 2 + i + j))})` : 'rgba(58,74,99,0.6)',
            stroke: hot ? C.warm : C.grid, lw: 1.4 });
        if (hot) {
          // 对流箭头
          const dir = (i + j) % 2 === 0 ? -1 : 1;
          seg(f, bx + bw2 / 2, by + bh2 / 2 - 14, bx + bw2 / 2, by + bh2 / 2 + 14, C.yellow, 1.6);
          vec(f, bx + bw2 / 2, by + bh2 / 2 + 14 * dir, bx + bw2 / 2, by + bh2 / 2 + 22 * dir, C.yellow, 1.6, 6);
        }
      }
    }
    text(f, '过驱能量流 → 自组织对流胞', x0, y0 - 12, { color: C.warm, font: '13px sans-serif' });
    text(f, 'Prandtl 数：温差越过阈值才起胞', x0, y0 + ch + 22, { color: C.dim, font: '12px sans-serif' });
    // 右：自催化闭环
    const cx = w * 0.74, cy = h * 0.42, R = 92;
    const labels = ['A + B → C', 'C + D → A', 'A → B + 热', 'B + 光 → D'];
    for (let i = 0; i < 4; i++) {
      const a0 = (i / 4) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / 4) * Math.PI * 2 - Math.PI / 2;
      const x1 = cx + Math.cos(a0) * R, y1 = cy + Math.sin(a0) * R;
      const x2 = cx + Math.cos(a1) * R, y2 = cy + Math.sin(a1) * R;
      vec(f, x1, y1, x2, y2, C.green, 2.4);
      const am = (a0 + a1) / 2;
      text(f, labels[i], cx + Math.cos(am) * (R + 44), cy + Math.sin(am) * (R + 40), { align: 'center', color: C.fg, font: '11px sans-serif' });
    }
    text(f, '自催化集', cx, cy + 4, { align: 'center', color: C.green, font: '15px sans-serif' });
    text(f, '→ 自复制 → 遗传', cx, cy + 26, { align: 'center', color: C.fg, font: '13px sans-serif' });
    footnotes(f, [
      '薛定谔《生命以负熵为食》：生命靠耗散环境熵流维持远离平衡的有序',
      'Prigogine 耗散结构：非平衡 + 非线性 + 涨落 → 分岔出新有序态',
      '约束：能量来源（光/化能）、手性均一、聚合物误差阈（Eigen ~10³ 碱基）',
    ]);
    heading(f, '生命是不是非平衡热力学的必然');
  },
});
registerViz(originOfLifePhysics);

/** P413 量子-经典边界：退相干尺度与 C60 干涉。 */
const quantumClassicalBoundary = defineViz({
  slug: 'quantum-classical-boundary',
  title: '量子-经典边界',
  params: { mass: { type: 'range', min: 0, max: 100, default: 45, step: 5, label: '对象尺度（电子→C60→尘埃）' } },
  draw: (f) => {
    const { w, h, params } = f;
    const s = num(params, 'mass', 45) / 100;
    clear(f);
    // 左：双缝干涉条纹随尺度消失
    const x0 = 60, y0 = 92, bw = w * 0.34, bh = h * 0.48;
    poly(f, [[x0, y0], [x0 + bw, y0], [x0 + bw, y0 + bh], [x0, y0 + bh]], { fill: '#0d1117', stroke: C.grid, lw: 1.4 });
    const coherence = Math.max(0, 1 - s * 1.25); // 干涉可见度
    for (let px = 0; px < bw - 4; px++) {
      const u = (px - bw / 2) / 14;
      const I = Math.cos(u) ** 2 * Math.exp(-u * u / 90);
      const visible = I * coherence + (1 - coherence) * Math.exp(-u * u / 30);
      const alpha = Math.min(1, visible);
      const { ctx } = f;
      ctx.fillStyle = `rgba(56,178,172,${alpha})`;
      ctx.fillRect(x0 + 2 + px, y0 + 2, 1, bh - 4);
    }
    text(f, '双缝条纹', x0 + bw / 2, y0 - 12, { align: 'center', color: C.cyan, font: '13px sans-serif' });
    // 缝
    poly(f, [[x0 - 26, y0 + bh * 0.3], [x0 - 6, y0 + bh * 0.3], [x0 - 6, y0 + bh * 0.3 + 26], [x0 - 26, y0 + bh * 0.3 + 26]], { fill: C.panel, stroke: C.grid });
    poly(f, [[x0 - 26, y0 + bh * 0.62], [x0 - 6, y0 + bh * 0.62], [x0 - 6, y0 + bh * 0.62 + 26], [x0 - 26, y0 + bh * 0.62 + 26]], { fill: C.panel, stroke: C.grid });
    // 右：退相干时间 vs 粒子数（对数）
    const gx0 = w * 0.5, gx1 = w - 50, gy0 = y0 + bh, gy1 = y0 + 20;
    seg(f, gx0, gy0, gx1, gy0, C.grid, 1.4);
    seg(f, gx0, gy0, gx0, gy1 - 10, C.grid, 1.4);
    const tx = (n: number) => gx0 + (Math.log10(Math.max(1, n)) / 9) * (gx1 - gx0);
    const ty = (t: number) => gy0 - ((Math.log10(Math.max(1e-40, t)) + 40) / 48) * (gy0 - gy1);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 100; i++) {
      const N = Math.pow(10, (i / 100) * 9); // 1 → 1e9
      pts.push([tx(N), ty(1e-8 / Math.pow(N, 2.2))]);
    }
    poly(f, pts, { stroke: C.hot, lw: 2.6 });
    // 当前对象
    const N = Math.pow(10, 1 + s * 8);
    const tau = 1e-8 / Math.pow(N, 2.2);
    dot(f, tx(N), ty(tau), 6, C.yellow);
    const label = s < 0.2 ? '电子：τ~ms，干涉清晰' : s < 0.6 ? 'C60（1999 实现）：τ~ps' : '尘埃/病毒：τ~10⁻³⁰ s，瞬时退相干';
    text(f, label, tx(N) - 8, ty(tau) - 12, { align: 'right', color: C.yellow, font: '12px sans-serif' });
    text(f, '环境粒子数 N →', (gx0 + gx1) / 2, gy0 + 24, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'τ_deco (s)', gx0 + 4, gy1 - 4, { color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      '退相干：环境纠缠使约化密度矩阵非对角消失 —— τ ~ ℏ/(kT·截面·N)，无需"坍缩"假设',
      'Zurek：einselection（动力学回避）选出经典指针态；Schlosshauer 综述给出 N⁻² 标度',
      '自发坍缩（GRW/CSL）：修改薛定谔方程 —— 实验以干涉实验持续收紧参数',
    ]);
    heading(f, '叠加能撑多大多久：退相干画出的边界');
  },
});
registerViz(quantumClassicalBoundary);

/** P414 超对称的实验处境：LHC 排除图。 */
const supersymmetryStatus = defineViz({
  slug: 'supersymmetry-status',
  title: '超对称的实验处境',
  params: { year: { type: 'range', min: 2010, max: 2025, default: 2025, step: 1, label: 'LHC 数据年份' } },
  draw: (f) => {
    const { w, h, params } = f;
    const year = Math.round(num(params, 'year', 2025));
    const frac = (year - 2010) / 15;
    clear(f);
    // m1/2 - m0 平面排除图（示意）
    const v = view(f, { xMin: 0, xMax: 2500, yMin: 0, yMax: 2500, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 排除区随数据增长
    const excl = 400 + frac * 1800;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const x = (i / 60) * 2500;
      pts.push([v.sx(x), v.sy(excl * (1 - 0.18 * Math.pow(x / 2500, 1.6)))]);
    }
    pts.push([v.sx(2500), v.sy(0)], [v.sx(0), v.sy(0)]);
    poly(f, pts, { fill: 'rgba(245,101,101,0.25)', stroke: C.hot, lw: 2, close: true });
    text(f, 'LHC 已排除', v.sx(300), v.sy(excl * 0.5), { color: C.hot, font: '14px sans-serif' });
    text(f, '自然 SUSY 预言区（m̃ < 1–2 TeV）', v.sx(200), v.sy(excl * 0.75), { color: C.yellow, font: '12px sans-serif' });
    // 剩余窗口
    text(f, '剩余参数空间：压缩/分层谱、R 宇称破缺、隐藏谷', v.sx(1300), v.sy(400), { color: C.green, font: '12px sans-serif' });
    text(f, 'm₀ (GeV)', (v.sx(0) + v.sx(2500)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'm_{1/2} (GeV)', v.sx(0) + 4, v.sy(2400), { color: C.dim, font: '12px sans-serif' });
    // 右上：为什么仍抱希望
    text(f, `截至 ${year} 年：`, 46, 64, { color: C.fg, font: '15px sans-serif' });
    text(f, `轻子味：μ→eγ BR < 3×10⁻¹³`, 46, 88, { color: C.cool, font: '12px sans-serif' });
    text(f, `暗物质：WIMP 窗口大幅收窄`, 46, 108, { color: C.cool, font: '12px sans-serif' });
    text(f, `SUSY 仍未发现 ⇒ 自然性论证受质疑`, 46, 128, { color: C.hot, font: '12px sans-serif' });
    footnotes(f, [
      '超对称：每个玻色子有费米子伴子 —— 精确相消希格斯二次发散（拯救自然性）',
      'LHC Run1–Run3：gluino > 2.3 TeV、squark > 1.8 TeV（ATLAS/CMS 组合）',
      '未发现不等于排除：质量可藏在 5–10 TeV，但需重新引入精细调节（动机流失）',
    ]);
    heading(f, 'LHC 扫过参数空间：超对称还在躲猫猫吗');
  },
});
registerViz(supersymmetryStatus);

/** P415 暴胀的可检验性：原初引力波 B 模与多重宇宙争议。 */
const inflationTestability = defineViz({
  slug: 'inflation-testability',
  title: '暴胀的可检验性',
  params: { r: { type: 'range', min: 0, max: 0.2, default: 0.03, step: 0.005, label: '张标比 r' } },
  draw: (f) => {
    const { w, h, params } = f;
    const r = num(params, 'r', 0.03);
    clear(f);
    // 左：CMB B 模功率谱示意
    const v = view(f, { xMin: 2, xMax: 300, yMin: 0, yMax: 10, inset: 46, insetBottom: 44 });
    grid(f, v);
    const Cl = (l: number) => r * 0.16 * Math.exp(-Math.pow((l - 80) / 60, 2)) + 0.02 * Math.exp(-Math.pow((l - 400) / 300, 2));
    const pts: [number, number][] = [];
    for (let i = 0; i <= 200; i++) {
      const l = 2 + (i / 200) * 298;
      pts.push([v.sx(l), v.sy(Cl(l) * 10)]);
    }
    poly(f, pts, { stroke: C.pink, lw: 2.6 });
    // 实验灵敏度线
    seg(f, v.sx(2), v.sy(0.5), v.sx(300), v.sy(0.5), C.cyan, 1.6);
    text(f, 'BICEP/Keck 灵敏度 r < 0.036', v.sx(140), v.sy(0.5) - 8, { align: 'center', color: C.cyan, font: '12px sans-serif' });
    dot(f, v.sx(80), v.sy(r * 1.6), 6, C.yellow);
    text(f, `r = ${r.toFixed(3)}`, v.sx(80) + 10, v.sy(r * 1.6) - 6, { color: C.yellow, font: '13px sans-serif' });
    text(f, '多极矩 ℓ', (v.sx(2) + v.sx(300)) / 2, h - 48, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'D_ℓ^BB (μK²)', v.sx(2) + 4, v.sy(9.4), { color: C.dim, font: '12px sans-serif' });
    // 右上：暴胀解释三问题
    text(f, '暴胀解决：', w * 0.55, 76, { color: C.green, font: '14px sans-serif' });
    ['视界问题（均匀性）', '平坦性（Ω→1）', '结构起源（量子涨落→星系）'].forEach((s2, i) => {
      text(f, '✓ ' + s2, w * 0.55, 102 + i * 24, { color: C.fg, font: '13px sans-serif' });
    });
    text(f, '可检验的三路：', w * 0.55, 190, { color: C.cool, font: '14px sans-serif' });
    ['① 原初引力波（B 模，r）', '② 非高斯性 f_NL（原初谱形）', '③ 预存视界：宇宙弦/多重印记'].forEach((s2, i) => {
      text(f, s2, w * 0.55, 216 + i * 24, { color: C.fg, font: '13px sans-serif' });
    });
    if (r < 0.01) {
      text(f, 'r 太小 ⇒ 暴胀模型大量被删（自然性危机）', w * 0.55, 300, { color: C.hot, font: '13px sans-serif' });
    }
    footnotes(f, [
      '原初引力波把 B 模印在 CMB 偏振上；r 直接读出暴胀能标（r=0.01 ⇒ 10¹⁶ GeV）',
      'BICEP2 (2014) 的"发现"被 Planck 星际尘埃抹去 —— 教训：前景去除决定成败',
      '多重宇宙不可检验争议（Popper 之争）：Boltzmann brains 与测量问题纠缠',
    ]);
    heading(f, '暴胀能被证伪吗：B 模、非高斯与预存视界');
  },
});
registerViz(inflationTestability);
