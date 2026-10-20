import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, circle, curve, dot, footnotes, grid, heading, poly, seg, text, view, rng, vec } from '../canvas';

/** 菲涅耳双面镜。 */
const fresnelMirror = defineViz({
  slug: 'fresnel-mirror', title: '菲涅耳双面镜', animated: true,
  params: { angle: { type: 'range', min: 0.5, max: 6, default: 2, step: 0.5, label: '镜间夹角 (′级)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const ang = num(params, 'angle', 2);
    clear(f);
    // 缝
    const sx = 80, sy = h * 0.26;
    dot(f, sx, sy, 7, C.warm);
    text(f, '单色缝 S', sx - 14, sy - 16, { color: C.warm, font: '11px sans-serif' });
    // 两面镜（小夹角）
    const m1x = sx + 130, m1y = sy + 150;
    const bend = ang * 7;
    seg(f, m1x, m1y, m1x + 170, m1y - 6, C.cool, 5);
    seg(f, m1x + 4, m1y + bend, m1x + 174, m1y + bend - 6, C.green, 5);
    text(f, '镜 1', m1x + 178, m1y - 4, { color: C.cool, font: '11px sans-serif' });
    text(f, '镜 2', m1x + 178, m1y + bend - 6, { color: C.green, font: '11px sans-serif' });
    // 两个虚源
    const s2a = [m1x + 90, m1y + (m1y - sy) * 0.9];
    const s2b = [m1x + 94, m1y + bend + (m1y + bend - sy) * 0.9];
    dot(f, s2a[0], sy + 40, 6, `${C.cool}bb`);
    dot(f, s2b[0], sy + 40 + bend * 1.6, 6, `${C.green}bb`);
    text(f, "S₁' 与 S₂'：同一缝的两个像——天然相干", sx + 140, sy + 96, { color: C.cyan, font: '12px sans-serif' });
    // 反射光线
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 2);
    seg(f, sx, sy, m1x + 60, m1y, `rgba(236,201,75,${0.5 + pulse * 0.5})`, 2);
    seg(f, sx, sy, m1x + 64, m1y + bend, `rgba(236,201,75,${0.5 + pulse * 0.5})`, 2);
    // 屏与条纹
    const scx = w - 100;
    seg(f, scx, 90, scx, h - 96, C.dim, 4);
    text(f, '屏', scx + 8, 96, { color: C.dim, font: '11px sans-serif' });
    for (let i = 0; i < 18; i++) {
      const y = 104 + i * 15;
      const phase = Math.cos(i * 1.6 - f.t * 0.6);
      const a = 0.28 + Math.max(0, phase) * 0.65;
      poly(f, [[scx - 16, y], [scx - 2, y], [scx - 2, y + 13], [scx - 16, y + 13]],
        { stroke: 'transparent', fill: `rgba(66,153,225,${a})` });
    }
    text(f, `夹角 ${ang}′：夹角越小，两虚源越近、条纹越疏`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    footnotes(f, [
      '菲涅耳 1816 年用它给波动说补上决定性干涉证据——泊松亮斑的反对者无话可说',
      '分波前技术的三剑客：菲涅耳双面镜、双棱镜与劳埃德镜',
      '夹角必须小到角分级——条纹间距 Δy = λD/2αD 与夹角成反比',
    ]);
    heading(f, '菲涅耳双面镜：一束光劈成两束');
  },
});
registerViz(fresnelMirror);

/** 旋光与偏振面旋转。 */
const opticalRotation = defineViz({
  slug: 'optical-rotation', title: '旋光与偏振面旋转', animated: true,
  params: { conc: { type: 'range', min: 0, max: 30, default: 12, step: 1, label: '糖液浓度 (g/100mL)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const c = num(params, 'conc', 12);
    clear(f);
    // 起偏器 → 糖管 → 检偏器
    const y = h * 0.5, x0 = 90;
    circle(f, x0, y, 34, { stroke: C.cool, lw: 3 });
    text(f, '起偏器', x0 - 24, y + 56, { color: C.cool, font: '11px sans-serif' });
    // 管
    const tx = x0 + 70, tw = w * 0.42;
    poly(f, [[tx, y - 44], [tx + tw, y - 44], [tx + tw, y + 44], [tx, y + 44]],
      { stroke: C.green, lw: 2.4, fill: `rgba(72,187,120,${0.08 + c / 160})` });
    text(f, '糖液管（手性分子）', tx + tw / 2 - 60, y - 54, { color: C.green, font: '11px sans-serif' });
    // 偏振面旋转动画
    const rot = c * 0.9; // 旋转角
    const a0 = 0;
    const a1 = ((rot + Math.sin(f.t) * 2) * Math.PI) / 180;
    const px = tx + 30;
    seg(f, px, y - Math.sin(a0) * 34, px, y + Math.sin(a0) * 34, `rgba(66,153,225,0.9)`, 3);
    const px2 = tx + tw - 30;
    seg(f, px2 - Math.cos(a1) * 30, y - Math.sin(a1) * 30, px2 + Math.cos(a1) * 30, y + Math.sin(a1) * 30,
      `rgba(236,201,75,0.95)`, 3);
    // 旋转弧
    const arc: [number, number][] = [];
    for (let i = 0; i <= 24; i++) {
      const t = (i / 24) * a1;
      arc.push([tx + tw / 2 + Math.cos(t) * 64, y + Math.sin(t) * 64]);
    }
    if (Math.abs(a1) > 0.02) poly(f, arc, { stroke: C.warm, lw: 2.6 });
    // 检偏器与出射
    const ax = tx + tw + 70;
    circle(f, ax, y, 34, { stroke: C.warm, lw: 3 });
    text(f, '检偏器', ax - 24, y + 56, { color: C.warm, font: '11px sans-serif' });
    const intensity = Math.pow(Math.cos(a1), 2);
    const glow = 0.25 + intensity * 0.75;
    dot(f, ax + 66, y, 14, `rgba(255,250,200,${glow})`);
    text(f, '出射光', ax + 46, y - 26, { color: '#fffbeb', font: '11px sans-serif' });
    text(f, `旋光角 ψ = [α]·c·l = ${rot.toFixed(1)}°（浓度越高拧得越狠）`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, `透射强度 I = I₀cos²ψ = ${(intensity * 100).toFixed(0)}%——糖量计就这么读数`, 30, h - 96, { color: C.warm, font: '13px sans-serif' });
    footnotes(f, [
      '手性分子对左旋与右旋圆偏振折射率不同——线偏振因此被旋转',
      '磁致法拉第旋转正比于磁场，是磁光隔离器的核心',
      '糖量计是偏振光的第一个工业岗位——制糖业与临床尿糖检测',
    ]);
    heading(f, '旋光：偏振面被糖拧过一个角');
  },
});
registerViz(opticalRotation);

/** 莫尔条纹与微位移。 */
const moireFringe = defineViz({
  slug: 'moire-fringe', title: '莫尔条纹与微位移', animated: true,
  params: { pitch: { type: 'range', min: 0.5, max: 8, default: 3, step: 0.5, label: '两栅栅距差 (μm)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const diff = num(params, 'pitch', 3);
    clear(f);
    const cx = w * 0.42, cy = h * 0.46;
    // 第一片光栅（固定）
    const g1x = cx - 130, gw = 200, gh = 210;
    poly(f, [[g1x, cy - gh / 2], [g1x + gw, cy - gh / 2], [g1x + gw, cy + gh / 2], [g1x, cy + gh / 2]],
      { stroke: `${C.grid}aa`, lw: 1.4, fill: 'rgba(45,55,72,0.5)' });
    for (let x = g1x; x < g1x + gw; x += 8) seg(f, x, cy - gh / 2, x, cy + gh / 2, `rgba(226,232,240,0.7)`, 1.4);
    // 第二片光栅（平移）
    const shift = Math.sin(f.t * 0.8) * 40 + diff * 6;
    const g2x = cx + 60;
    poly(f, [[g2x, cy - gh / 2], [g2x + gw, cy - gh / 2], [g2x + gw, cy + gh / 2], [g2x, cy + gh / 2]],
      { stroke: `${C.grid}aa`, lw: 1.4, fill: 'rgba(45,55,72,0.4)' });
    for (let x = g2x + (shift % 8); x < g2x + gw; x += 8 + diff * 0.4) seg(f, x, cy - gh / 2, x, cy + gh / 2, `rgba(226,232,240,0.7)`, 1.4);
    // 叠加区的粗莫尔条纹
    const ovx = g2x, ovw = g1x + gw - g2x;
    if (ovw > 0) {
      const period = 60 + diff * 14;
      for (let x = ovx - (shift % period); x < ovx + ovw; x += period) {
        poly(f, [[x, cy - gh / 2], [x + period * 0.5, cy - gh / 2], [x + period * 0.5, cy + gh / 2], [x, cy + gh / 2]],
          { stroke: 'transparent', fill: `rgba(66,153,225,${0.32 + 0.2 * Math.sin(f.t * 2 + x * 0.05)})` });
      }
    }
    text(f, '叠加区：比栅距粗上千倍的莫尔条纹', ovx - 40, cy - gh / 2 - 14, { color: C.cool, font: '12px sans-serif' });
    text(f, '光栅 1（固定）', g1x + 30, cy + gh / 2 + 26, { color: C.dim, font: '11px sans-serif' });
    text(f, '光栅 2（随被测件移动）', g2x + 30, cy + gh / 2 + 26, { color: C.warm, font: '11px sans-serif' });
    text(f, `栅距差 ${diff} μm → 条纹周期 Λ = d₁d₂/|d₁−d₂|（放大 ${(100 / Math.max(1, diff)).toFixed(0)} 倍量级）`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 位移读数
    text(f, `当前相对位移：${(shift * 0.5).toFixed(1)} μm → 条纹移动 ${Math.abs(Math.sin(f.t * 0.8) * 4).toFixed(1)} 条`, 30, h - 96, { color: C.green, font: '13px sans-serif' });
    footnotes(f, [
      '把纳米级移动变成毫米级条纹扫过——位移测量又准又便宜',
      '光栅尺与编码器的核心原理：机床、光刻机的定位全靠它读数',
      '还可以测微小形变、检验透镜畸变——两片栅一叠就是全场应变片',
    ]);
    heading(f, '莫尔条纹：微位移的放大镜');
  },
});
registerViz(moireFringe);

/** 相位衬度显微。 */
const phaseContrast = defineViz({
  slug: 'phase-contrast', title: '相位衬度显微', animated: true,
  params: { phi: { type: 'range', min: 0, max: 180, default: 90, step: 5, label: '样品相位差 (°)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const phi = num(params, 'phi', 90);
    clear(f);
    // 左：明场（几乎看不见）
    const bx = w * 0.25, by = h * 0.46;
    circle(f, bx, by, 108, { stroke: C.dim, lw: 3, fill: 'rgba(226,232,240,0.10)' });
    text(f, '明场：透明细胞一片虚无', bx - 78, by - 126, { color: C.dim, font: '13px sans-serif' });
    // 细胞轮廓（弱对比）
    const contrastBF = 0.14 + Math.abs(phi) / 180 * 0.12;
    const cell: [number, number][] = [];
    for (let i = 0; i <= 48; i++) {
      const t = (i / 48) * Math.PI * 2;
      const r = 54 + Math.sin(t * 3) * 12;
      cell.push([bx + Math.cos(t) * r, by + Math.sin(t) * r * 0.86]);
    }
    poly(f, cell, { stroke: `rgba(226,232,240,${contrastBF})`, lw: 2.6 });
    dot(f, bx - 14, by - 8, 14, `rgba(226,232,240,${contrastBF + 0.1})`);
    // 右：相位衬度（清晰）
    const cx2 = w * 0.74;
    circle(f, cx2, by, 108, { stroke: C.cool, lw: 3, fill: 'rgba(26,32,44,0.85)' });
    text(f, '相位衬度：无需染色即见结构', cx2 - 94, by - 126, { color: C.cool, font: '13px sans-serif' });
    const bright = Math.pow(Math.sin((phi * Math.PI) / 180), 2);
    const cell2: [number, number][] = [];
    for (let i = 0; i <= 48; i++) {
      const t = (i / 48) * Math.PI * 2;
      const r = 54 + Math.sin(t * 3) * 12;
      cell2.push([cx2 + Math.cos(t) * r, by + Math.sin(t) * r * 0.86]);
    }
    poly(f, cell2, { stroke: `rgba(236,201,75,${0.5 + bright * 0.5})`, lw: 3.4, fill: `rgba(236,201,75,${0.1 + bright * 0.18})` });
    const puls = 0.6 + 0.4 * Math.sin(f.t * 2);
    circle(f, cx2 - 14, by - 8, 14, { stroke: `rgba(245,101,101,${puls})`, lw: 2.6, fill: `rgba(245,101,101,${0.25 * puls})` });
    text(f, '细胞核', cx2 + 4, by - 6, { color: '#fff', font: '11px sans-serif' });
    // 相位板示意
    const py = h - 122;
    text(f, '相位板：把中心衍射光移相 π/2 后与直通光干涉 → 相位差变强度差', 30, py, { color: C.cyan, font: '13px sans-serif' });
    text(f, `当前相位差 ${phi}° → 衬度 ≈ I₀(1 + 2φ) 的转换效率 ${(bright * 100).toFixed(0)}%`, 30, h - 96, { color: C.warm, font: '13px sans-serif' });
    footnotes(f, [
      '泽尼克 1934 年发明相位衬度，1953 年因此获诺贝尔物理学奖',
      '相位物体只改相位不改强度——人眼与探测器都只对强度敏感',
      '活细胞观察与半导体晶圆检测——生理学与光刻机都欠它一笔',
    ]);
    heading(f, '相位衬度：让透明现形');
  },
});
registerViz(phaseContrast);

/** 光电效应实验。 */
const photoelectricLaw = defineViz({
  slug: 'photoelectric-law', title: '光电效应实验', animated: true,
  params: { freq: { type: 'range', min: 1, max: 6, default: 3.5, step: 0.1, label: '光频率 (×10¹⁴ Hz)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const nu = num(params, 'freq', 3.5);
    clear(f);
    const v = view(f, { xMin: 0, xMax: 8, yMin: -3, yMax: 1, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 8, ticks: true });
    // U_c = (h/e)ν − W/e：直线
    const slope = 4.14e-15 / 1.6e-19 / 1e14; // ≈ 0.041 V per 1e14 Hz → 缩放到画布
    const intercept = -2.2; // 逸出功 eV 示意
    const line: [number, number][] = [];
    for (let x = 0; x <= 8; x += 0.2) line.push([v.sx(x), v.sy(Math.min(1, slope * x * 24 + intercept))]);
    poly(f, line, { stroke: C.accent, lw: 3.4 });
    // 截距点
    dot(f, v.sx(0), v.sy(intercept), 6, C.dim);
    text(f, '−W/e（逸出功）', v.sx(0.2), v.sy(intercept) + 20, { color: C.dim, font: '11px sans-serif' });
    // 红限频率
    const nu0 = -intercept / (slope * 24);
    dot(f, v.sx(nu0), v.sy(0), 7, C.hot);
    text(f, `ν₀ 红限`, v.sx(nu0) - 14, v.sy(0) - 14, { color: C.hot, font: '11px sans-serif' });
    // 当前频率点
    const uc = slope * nu * 24 + intercept;
    const dotColor = uc > 0 ? C.green : `${C.dim}88`;
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
    dot(f, v.sx(nu), v.sy(Math.max(-3, uc)), 8, uc > 0 ? `rgba(72,187,120,${pulse})` : `${C.dim}aa`);
    text(f, uc > 0 ? `ν=${nu}×10¹⁴：U_c=${uc.toFixed(2)} V，电子飞得出来` : `ν=${nu}×10¹⁴ < ν₀：无论光多强都出不来`,
      56, 44, { color: uc > 0 ? C.cyan : C.hot, font: '13px sans-serif' });
    // 光电子（左侧示意）
    const kx = 96, ky = h * 0.62;
    if (uc > 0) {
      for (let i = 0; i < 7; i++) {
        const a = f.t * 3 + i;
        const r = 18 + ((a * 20) % 52);
        dot(f, kx + Math.cos(a + i) * r, ky + Math.sin(a + i) * r * 0.7, 3.6, `rgba(72,187,120,${1 - (r - 18) / 56})`);
      }
    }
    text(f, 'e⁻', kx - 8, ky + 4, { color: uc > 0 ? C.green : C.dim, font: '14px sans-serif' });
    text(f, 'U_c = (h/e)ν − W/e：斜率量出 h——与光强无关', 30, h - 96, { color: C.warm, font: '13px sans-serif' });
    text(f, '频率 ν →（×10¹⁴ Hz）', w - 160, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '截止电压 U_c (V)', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    footnotes(f, [
      '再亮的低频光也抬不动电子——能量量子化的判决实验',
      '饱和电流正比于光强：强光只增加光子数目，不增加单个能量',
      '密立根十年验证爱因斯坦方程并测出 h——1923 年诺贝尔奖',
    ]);
    heading(f, '光电效应：光量子的判决');
  },
});
registerViz(photoelectricLaw);

/** 夫兰克-赫兹实验。 */
const franckHertz = defineViz({
  slug: 'franck-hertz', title: '夫兰克-赫兹实验', animated: true,
  params: { gas: { type: 'select', options: ['汞蒸气', '氖气'], default: '汞蒸气', label: '靶气体' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mercury = String((params as Record<string, unknown>)['gas'] ?? '').includes('汞');
    const step = mercury ? 4.9 : 18.6;
    clear(f);
    const v = view(f, { xMin: 0, xMax: 60, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    // 周期性跌落的 I-V 曲线
    const pts: [number, number][] = [];
    const maxV = 60;
    for (let i = 0; i <= 500; i++) {
      const V = (i / 500) * maxV;
      const n = Math.floor(V / step);
      const frac = V - n * step;
      let I = (V / maxV) * (0.55 + 0.4 * (1 - n / (maxV / step) * 0.7));
      if (frac < step * 0.72) I *= Math.pow(Math.sin((frac / step) * Math.PI * 0.72 + 0.1), 1.4);
      I = Math.max(0.02, Math.min(1, I));
      pts.push([v.sx(V), v.sy(I)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 3 });
    // 跌落标记
    const drops = Math.floor(maxV / step);
    for (let n = 1; n <= drops; n++) {
      const Vn = n * step;
      seg(f, v.sx(Vn), v.sy(0), v.sx(Vn), v.sy(1.05), `${C.hot}66`, 1.4, );
      text(f, `${Vn.toFixed(1)} V`, v.sx(Vn) - 16, v.sy(1.06), { color: C.hot, font: '10px sans-serif' });
    }
    // 电子损失示意
    const kx = w * 0.84, ky = h * 0.34;
    const cycle = (f.t * 2) % step;
    dot(f, kx - 50 + cycle * 1.6, ky + Math.sin(f.t * 8) * 6, 5, C.cool);
    if (cycle > step * 0.8) {
      circle(f, kx + 46, ky, 16, { stroke: C.warm, lw: 2.4 });
      text(f, 'Hg', kx + 40, ky + 4, { color: C.warm, font: '11px sans-serif' });
      const flash = 0.5 + 0.5 * Math.sin(f.t * 12);
      circle(f, kx + 46, ky, 24, { stroke: `rgba(146,84,222,${flash})`, lw: 2 });
      text(f, '发射 253.7 nm 紫外', kx - 24, ky - 34, { color: '#9254de', font: '10px sans-serif' });
    }
    text(f, mercury ? '汞：每攒够 4.9 eV 必被吃掉——电流准时跌落' : '氖：18.6 eV 台阶更宽，红光放电由此点亮',
      56, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, `加速电压 →（台阶 ${step} V = 能级间距的电学读数）`, w - 300, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '收集电流 I →', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    footnotes(f, [
      '比玻尔模型还早一年——弗兰克与赫兹用碰撞直接证明能级分立（1914）',
      '每次非弹性碰撞电子清零重来，于是电流随电压周期性回落',
      '实验课上示波器里那串跌落，就是量子的签名（1925 年诺贝尔奖）',
    ]);
    heading(f, '夫兰克-赫兹：能级的电学铁证');
  },
});
registerViz(franckHertz);

/** 斯特恩-格拉赫实验。 */
const sternGerlach = defineViz({
  slug: 'stern-gerlach', title: '斯特恩-格拉赫实验', animated: true,
  params: { spin: { type: 'select', options: ['自旋 1/2（银原子）', '经典预言（连续）'], default: '自旋 1/2（银原子）', label: '模型' } },
  draw: (f) => {
    const { w, h, params } = f;
    const quantum = String((params as Record<string, unknown>)['spin'] ?? '').includes('1/2');
    clear(f);
    // 炉、狭缝、磁铁、屏
    const y = h * 0.46;
    const ox = 60, slitX = 150, magX = w * 0.44, magLen = 170, scx = w - 120;
    // 炉
    poly(f, [[ox, y - 34], [ox + 44, y - 34], [ox + 44, y + 34], [ox, y + 34]],
      { stroke: C.warm, lw: 2.4, fill: 'rgba(237,137,54,0.35)' });
    text(f, '原子炉', ox - 4, y + 54, { color: C.warm, font: '11px sans-serif' });
    // 狭缝
    seg(f, slitX, y - 40, slitX, y - 8, C.dim, 4);
    seg(f, slitX, y + 8, slitX, y + 40, C.dim, 4);
    text(f, '准直缝', slitX - 22, y + 60, { color: C.dim, font: '11px sans-serif' });
    // 不均匀磁铁（尖极）
    poly(f, [[magX, y - 64], [magX + magLen, y - 64], [magX + magLen, y - 22], [magX, y - 22]],
      { stroke: C.cool, lw: 2.6, fill: 'rgba(66,153,225,0.3)' });
    poly(f, [[magX, y + 22], [magX + magLen, y + 22], [magX + magLen, y + 64], [magX, y + 64]],
      { stroke: C.cool, lw: 2.6, fill: 'rgba(66,153,225,0.3)' });
    text(f, '不均匀磁场 ∂B/∂z（尖-平极靴）', magX + 8, y - 74, { color: C.cool, font: '11px sans-serif' });
    // 束流
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
    if (quantum) {
      for (const s of [-1, 1]) {
        const pts: [number, number][] = [];
        for (let i = 0; i <= 60; i++) {
          const t = i / 60;
          const x = slitX + t * (scx - slitX);
          const split = Math.max(0, (x - magX) / magLen) * 0 + Math.max(0, (x - (magX + magLen)) / (scx - magX - magLen)) * 0;
          const bendT = x < magX ? 0 : Math.min(1, (x - magX) / magLen);
          const yOff = bendT * s * 6 + Math.max(0, (x - magX - magLen) / (scx - magX - magLen)) * s * 66;
          pts.push([x, y + yOff]);
          void split;
        }
        poly(f, pts, { stroke: `rgba(236,201,75,${0.55 + pulse * 0.45})`, lw: 2.6 });
      }
      text(f, '离散两撮：μ_z = ±μ_B——空间量子化', magX, y + 96, { color: C.green, font: '12px sans-serif' });
      dot(f, scx, y - 78, 9, C.hot);
      dot(f, scx, y + 78, 9, C.hot);
      text(f, '↑', scx + 14, y - 74, { color: C.hot, font: '13px sans-serif' });
      text(f, '↓', scx + 14, y + 82, { color: C.hot, font: '13px sans-serif' });
    } else {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const x = slitX + t * (scx - slitX);
        pts.push([x, y]);
      }
      poly(f, pts, { stroke: `rgba(236,201,75,${0.55 + pulse * 0.45})`, lw: 2.6 });
      // 经典预期的连续涂抹
      for (let k = -60; k <= 60; k += 4) {
        const a = 1 - Math.abs(k) / 70;
        dot(f, scx, y + k, 4, `rgba(146,84,222,${a * 0.8})`);
      }
      text(f, '经典预期：连续涂抹一条带——实验看到的却不是它', magX, y + 96, { color: '#9254de', font: '12px sans-serif' });
    }
    // 入射粒子
    for (let i = 0; i < 5; i++) {
      const t = ((f.t * 2 + i * 0.2) % 1);
      const x = slitX + t * (scx - slitX);
      if (x < magX) dot(f, x, y, 3, `rgba(66,153,225,${0.8 - i * 0.1})`);
    }
    text(f, '原子束穿过梯度磁场——磁矩取向决定受力方向', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, 'F_z = μ_z·∂B/∂z：银原子屏上两簇斑，后来被读作自旋二分之一', 30, h - 96, { color: C.warm, font: '13px sans-serif' });
    footnotes(f, [
      '1922 年的分裂最初被解释为轨道角动量量子化，后来成为自旋的决定性证据',
      '磁场梯度必须陡且原子束要准直——热扰动会抹平分裂',
      '今天它变身原子干涉仪——用于检验引力相位与等效原理',
    ]);
    heading(f, '斯特恩-格拉赫：空间量子化');
  },
});
registerViz(sternGerlach);

/** 康普顿散射实验。 */
const comptonScattering = defineViz({
  slug: 'compton-scattering', title: '康普顿散射实验', animated: true,
  params: { theta: { type: 'range', min: 0, max: 180, default: 90, step: 5, label: '散射角 (°)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const th = num(params, 'theta', 90);
    clear(f);
    const cx = w * 0.4, cy = h * 0.52;
    // 靶电子
    circle(f, cx, cy, 16, { fill: 'rgba(66,153,225,0.85)', stroke: C.cool, lw: 2.4 });
    text(f, '静止电子', cx - 30, cy + 40, { color: C.cool, font: '11px sans-serif' });
    // 入射光子
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
    seg(f, 40, cy, cx - 22, cy, `rgba(245,101,101,${0.55 + pulse * 0.45})`, 3.4);
    text(f, 'γ（λ）', 44, cy - 16, { color: C.hot, font: '12px sans-serif' });
    // 散射光子（角度 th）
    const rad = (th * Math.PI) / 180;
    const len = 190;
    const sx = cx + Math.cos(rad) * len, sy = cy - Math.sin(rad) * len;
    seg(f, cx, cy, sx, sy, `rgba(236,201,75,${0.55 + pulse * 0.45})`, 3.4);
    dot(f, sx, sy, 6, C.warm);
    // 反冲电子（能量守恒方向）
    const er = 160;
    const ea = rad * 0.5 - 0.5;
    const ex = cx + Math.cos(-ea + Math.PI) * 0 - Math.cos(ea - 0.6) * 0;
    const edx = cx - Math.cos(rad / 2 + 0.35) * er;
    const edy = cy + Math.sin(rad / 2 + 0.35) * er;
    seg(f, cx, cy, edx, edy, `rgba(72,187,120,${0.55 + pulse * 0.45})`, 3);
    dot(f, edx, edy, 6, C.green);
    text(f, '反冲 e⁻', edx - 74, edy + 20, { color: C.green, font: '11px sans-serif' });
    void ex;
    // 角度弧
    const arc: [number, number][] = [];
    for (let i = 0; i <= 30; i++) {
      const t = (i / 30) * rad;
      arc.push([cx + Math.cos(t) * 54, cy - Math.sin(t) * 54]);
    }
    poly(f, arc, { stroke: C.dim, lw: 1.6 });
    text(f, `θ=${th}°`, cx + 58, cy - 54, { color: C.dim, font: '12px sans-serif' });
    // 波长移读数
    const lamC = 0.0243;
    const dl = lamC * (1 - Math.cos(rad));
    text(f, `Δλ = λ_c(1−cosθ) = ${dl.toFixed(4)} nm（λ_c = h/m_e c = 0.0243 Å）`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, th > 5 ? '光子把一部分能量交给电子——自己变"红"、波长变长' : '正前向：不损失能量，波长不变',
      30, h - 96, { color: th > 5 ? C.warm : C.dim, font: '13px sans-serif' });
    footnotes(f, [
      '康普顿 1923 年的实验让光子动量成为共识——1927 年诺贝尔奖',
      '波长增量只与散射角有关，与材料和原波长都无关——守恒的账本',
      '经典电磁波解释不了：散射光怎么会变频率？只有粒子性能',
    ]);
    heading(f, '康普顿散射：光子有动量');
  },
});
registerViz(comptonScattering);

/** 电子衍射实验。 */
const electronDiffraction = defineViz({
  slug: 'electron-diffraction', title: '电子衍射实验', animated: true,
  params: { V: { type: 'range', min: 5, max: 100, default: 50, step: 5, label: '加速电压 (kV)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const V = num(params, 'V', 50);
    clear(f);
    // 德布罗意波长
    const lam = 1.226 / Math.sqrt(V); // nm
    // 左：电子枪与晶格
    const gunX = 60, cy = h * 0.46;
    poly(f, [[gunX, cy - 22], [gunX + 46, cy - 22], [gunX + 46, cy + 22], [gunX, cy + 22]],
      { stroke: C.dim, lw: 2.4, fill: 'rgba(100,116,139,0.5)' });
    text(f, 'e⁻ 枪', gunX + 4, cy + 42, { color: C.dim, font: '11px sans-serif' });
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 4);
    seg(f, gunX + 50, cy, w * 0.42, cy, `rgba(66,153,225,${0.55 + pulse * 0.45})`, 3);
    // 晶格（靶）
    const tx = w * 0.44;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
      dot(f, tx + c * 20, cy - 40 + r * 20, 5, `rgba(236,201,75,${0.6 + 0.3 * Math.sin(f.t * 2 + r + c)})`);
    }
    text(f, '多晶薄膜', tx - 6, cy + 74, { color: C.warm, font: '11px sans-serif' });
    // 荧屏与衍射环
    const scx = w - 150;
    seg(f, scx, cy - 130, scx, cy + 130, C.dim, 5);
    text(f, '荧屏', scx + 10, cy - 136, { color: C.dim, font: '11px sans-serif' });
    const rings = [40, 68, 96, 124];
    rings.forEach((r, i) => {
      const rr = r * Math.sqrt(50 / V) * 1.05;
      const a = 0.75 - i * 0.14 + 0.2 * Math.sin(f.t * 3 - i);
      const pts: [number, number][] = [];
      for (let k = 0; k <= 60; k++) {
        const t = (k / 60) * Math.PI * 2;
        pts.push([scx - 110 + Math.cos(t) * rr, cy + Math.sin(t) * rr]);
      }
      poly(f, pts, { stroke: `rgba(72,187,120,${a})`, lw: 3 });
    });
    dot(f, scx - 110, cy, 6, '#fffbeb');
    text(f, '透射斑 + 衍射环——布拉格条件 2d sinθ = nλ', scx - 240, cy + 156, { color: C.green, font: '11px sans-serif' });
    text(f, `V = ${V} kV → λ = 1.226/√V = ${lam.toFixed(3)} Å（比可见光小五万倍）`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '电压越高波长越短 → 环收缩：1927 年两组人各自撞见了波', 30, h - 96, { color: C.warm, font: '13px sans-serif' });
    footnotes(f, [
      '戴维孙与革末用镍单晶、G.P. 汤姆孙用多晶薄膜——同时证实电子波动性',
      '环的半径给晶面间距：电子衍射与 X 射线衍射共撑结构分析',
      '透射电镜的分辨本领正源于此——物质波波长比光短五个量级',
    ]);
    heading(f, '电子衍射：物质波的花样');
  },
});
registerViz(electronDiffraction);

/** 密立根油滴实验。 */
const millikanOilDrop = defineViz({
  slug: 'millikan-oil-drop', title: '密立根油滴实验', animated: true,
  params: { V: { type: 'range', min: 0, max: 5000, default: 3200, step: 100, label: '极板电压 (V)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const V = num(params, 'V', 3200);
    clear(f);
    // 极板
    const px = w * 0.4, pw = 300, topY = h * 0.3, botY = h * 0.74;
    poly(f, [[px, topY], [px + pw, topY], [px + pw, topY + 14], [px, topY + 14]],
      { stroke: C.hot, lw: 3, fill: 'rgba(245,101,101,0.35)' });
    poly(f, [[px, botY], [px + pw, botY], [px + pw, botY + 14], [px, botY + 14]],
      { stroke: C.cool, lw: 3, fill: 'rgba(66,153,225,0.35)' });
    text(f, `上板 +${V} V`, px + pw + 12, topY + 12, { color: C.hot, font: '11px sans-serif' });
    text(f, '下板 −', px + pw + 12, botY + 12, { color: C.cool, font: '11px sans-serif' });
    // 电场箭头
    for (let i = 0; i < 5; i++) {
      const x = px + 34 + i * 56;
      vec(f, x, topY + 30, x, botY - 6, `rgba(236,201,75,${0.35 + 0.2 * Math.sin(f.t * 2)})`, 2);
    }
    // 油滴（受力平衡抖动）
    const bal = V > 2400;
    const drift = bal ? Math.sin(f.t * 2) * 8 : Math.sin(f.t * 1.2) * 4;
    const dy = h * 0.52 + (bal ? drift : 60 - ((f.t * 26) % 120));
    circle(f, px + pw / 2, dy, 13, { fill: 'rgba(236,201,75,0.9)', stroke: C.yellow, lw: 2 });
    text(f, '油滴', px + pw / 2 + 18, dy + 4, { color: C.yellow, font: '11px sans-serif' });
    // 受力箭头
    if (bal) {
      vec(f, px + pw / 2 - 44, dy - 8, px + pw / 2 - 44, dy - 58, C.green, 3);
      vec(f, px + pw / 2 + 44, dy + 8, px + pw / 2 + 44, dy + 58, C.hot, 3);
      text(f, 'qE', px + pw / 2 - 62, dy - 66, { color: C.green, font: '12px sans-serif' });
      text(f, 'mg', px + pw / 2 + 50, dy + 74, { color: C.hot, font: '12px sans-serif' });
      text(f, '悬停！qE = mg', px + pw / 2 - 44, dy - 84, { color: C.green, font: '13px sans-serif' });
    } else {
      vec(f, px + pw / 2 + 44, dy + 8, px + pw / 2 + 44, dy + 60, C.hot, 3);
      text(f, '下落中：qE < mg', px + pw / 2 - 52, dy + 84, { color: C.warm, font: '12px sans-serif' });
    }
    // 视场
    circle(f, px + pw / 2, h * 0.52, 130, { stroke: `${C.dim}77`, lw: 1.6, dash: [6, 5] });
    text(f, '显微视场', px + pw / 2 - 32, h * 0.52 + 148, { color: C.dim, font: '11px sans-serif' });
    text(f, '平衡时 q = mgd/V——数出每滴的电荷，全是同一小份的整数倍', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, 'q = ne → e = 1.602×10⁻¹⁹ C：电荷有最小面额', 30, h - 96, { color: C.warm, font: '13px sans-serif' });
    footnotes(f, [
      '上千滴油滴的电荷值全部落在 e 的整数倍上——电荷量子化被直接看见',
      '斯托克斯公式要加空气黏滞修正——当年最大的争议与最重的计算',
      '密立根 1909-1913 的油滴 + 光电效应双料验证——1923 年诺贝尔奖',
    ]);
    heading(f, '密立根油滴：数出 e');
  },
});
registerViz(millikanOilDrop);

/** 阴极射线荷质比。 */
const jjThomsonEm = defineViz({
  slug: 'jj-thomson-em', title: '阴极射线荷质比 (e/m)', animated: true,
  params: { mode: { type: 'select', options: ['电场偏转', '磁场平衡', '两者打平'], default: '两者打平', label: '模式' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = String((params as Record<string, unknown>)['mode'] ?? '');
    clear(f);
    const y = h * 0.5, x0 = 70, tubeEnd = w - 140;
    // 管与荧屏
    poly(f, [[x0, y - 54], [tubeEnd, y - 54], [tubeEnd, y + 54], [x0, y + 54]],
      { stroke: `${C.dim}aa`, lw: 2, fill: 'rgba(45,55,72,0.4)' });
    seg(f, tubeEnd, y - 60, tubeEnd, y + 60, C.dim, 5);
    text(f, '荧屏', tubeEnd + 8, y - 66, { color: C.dim, font: '11px sans-serif' });
    // 阴极
    seg(f, x0 + 6, y - 30, x0 + 6, y + 30, C.cool, 5);
    text(f, '阴极', x0, y + 52, { color: C.cool, font: '11px sans-serif' });
    // 偏转板
    const dx = w * 0.42;
    poly(f, [[dx, y - 46], [dx + 150, y - 46], [dx + 150, y - 36], [dx, y - 36]],
      { stroke: C.hot, lw: 3, fill: 'rgba(245,101,101,0.4)' });
    poly(f, [[dx, y + 36], [dx + 150, y + 36], [dx + 150, y + 46], [dx, y + 46]],
      { stroke: C.cool, lw: 3, fill: 'rgba(66,153,225,0.4)' });
    text(f, 'E 板', dx + 156, y - 38, { color: C.hot, font: '11px sans-serif' });
    // 磁场区（垂直纸面）
    const bx = dx + 30;
    for (let i = 0; i < 4; i++) {
      const x = bx + i * 34;
      for (let k = 0; k < 3; k++) {
        const yy = y - 26 + k * 26;
        const on = mode.includes('平衡') || mode.includes('打平');
        const cxo = x + Math.sin(f.t * 6 + i + k) * 2;
        // ⊗ 或 ⊙
        circle(f, cxo, yy, 5, { stroke: on ? '#9254de' : `${C.dim}66`, lw: 1.6 });
        if (on) seg(f, cxo - 3.4, yy - 3.4, cxo + 3.4, yy + 3.4, '#9254de', 1.6);
      }
    }
    text(f, 'B（垂直纸面）', bx + 10, y + 74, { color: '#9254de', font: '11px sans-serif' });
    // 射线轨迹
    const deflect = mode.includes('电场') ? 34 : mode.includes('平衡') ? 6 : 0;
    const straight = mode.includes('打平');
    const pts: [number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const x = x0 + t * (tubeEnd - x0);
      let off = 0;
      if (x > dx) {
        const t2 = Math.min(1, (x - dx) / 150);
        off = -deflect * t2 * t2;
        if (straight && x > dx + 150) off = -6 * Math.min(1, (x - dx - 150) / 60);
      }
      pts.push([x, y + off]);
    }
    poly(f, pts, { stroke: `rgba(72,187,120,${0.55 + 0.45 * Math.sin(f.t * 4)})`, lw: 3.4 });
    dot(f, tubeEnd - 3, y + pts[pts.length - 1][1] - y, 7, C.green);
    text(f, '射线打点', tubeEnd - 100, y + pts[pts.length - 1][1] - y - 14, { color: C.green, font: '11px sans-serif' });
    text(f, straight ? '二力平衡 → v = E/B，代回即得 e/m——速度被同时消掉'
      : mode.includes('电场') ? '电偏转给出 qE 力：轨迹抛物线式弯折' : '磁场单独作用：q v × B 让束流画圆弧',
      30, 44, { color: straight ? C.green : C.cyan, font: '13px sans-serif' });
    text(f, 'q/m = E/(B²r)：测出的值远大于氢离子——电子作为首个基本粒子登场', 30, h - 96, { color: C.warm, font: '13px sans-serif' });
    footnotes(f, [
      'J.J. 汤姆孙 1897 年的阴极射线偏转实验——1906 年诺贝尔奖',
      '同位素在屏上落点不同：这台装置顺手衍生了质谱仪',
      '从同位素发现到今天的蛋白组学——质谱术都靠它称量原子',
    ]);
    heading(f, '荷质比：称出电子');
  },
});
registerViz(jjThomsonEm);

/** 赫兹电磁波实验。 */
const hertzElectromagneticWave = defineViz({
  slug: 'hertz-electromagnetic-wave', title: '赫兹电磁波实验', animated: true,
  params: { dist: { type: 'range', min: 20, max: 400, default: 160, step: 10, label: '收发距离 (cm)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const dist = num(params, 'dist', 160);
    clear(f);
    const y = h * 0.5;
    const tx = 90, rx = Math.min(w - 120, tx + dist * 1.1);
    // 发射偶极子（带火花隙）
    seg(f, tx, y - 70, tx, y - 16, C.warm, 4);
    seg(f, tx, y + 16, tx, y + 70, C.warm, 4);
    const spark = Math.sin(f.t * 9) > 0.7;
    if (spark) {
      poly(f, [[tx, y - 16], [tx - 7, y - 6], [tx + 7, y + 4], [tx, y + 16]], { stroke: '#fffbeb', lw: 3 });
      poly(f, [[tx, y - 16], [tx - 7, y - 6], [tx + 7, y + 4], [tx, y + 16]], { stroke: 'rgba(140,210,255,0.6)', lw: 8 });
    }
    text(f, '发射偶极子（感应圈激发）', tx - 74, y + 96, { color: C.warm, font: '11px sans-serif' });
    // 接收偶极子
    seg(f, rx, y - 60, rx, y - 12, C.cool, 4);
    seg(f, rx, y + 12, rx, y + 60, C.cool, 4);
    const lit = Math.sin(f.t * 9 - dist / 40) > 0.7;
    if (lit) {
      poly(f, [[rx, y - 12], [rx - 6, y - 3], [rx + 6, y + 4], [rx, y + 12]], { stroke: '#fffbeb', lw: 3 });
      poly(f, [[rx, y - 12], [rx - 6, y - 3], [rx + 6, y + 4], [rx, y + 12]], { stroke: 'rgba(140,210,255,0.6)', lw: 8 });
      text(f, '接收间隙同时跳火！', rx - 66, y - 76, { color: '#fffbeb', font: '12px sans-serif' });
    }
    text(f, '接收偶极子（可滑动）', rx - 60, y + 86, { color: C.cool, font: '11px sans-serif' });
    // 传播的电磁波（横波）
    const pts: [number, number][] = [];
    for (let i = 0; i <= 200; i++) {
      const t = i / 200;
      const x = tx + t * (rx - tx);
      const amp = 34 * Math.sin(t * 26 - f.t * 8) * (0.4 + 0.6 * (1 - t * 0.4));
      pts.push([x, y - 118 + amp * 0.4]);
    }
    poly(f, pts, { stroke: `rgba(146,84,222,${0.6 + 0.3 * Math.sin(f.t * 4)})`, lw: 2.4 });
    text(f, 'E 与 B 互相垂直、同时垂直于传播方向——横波', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 驻波图样（改变距离）
    text(f, `距离 ${dist} cm：改变距离时火花强弱呈周期变化 → 量出波长`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '赫兹 1887-1888 用火花验证麦克斯韦方程的预言——光就是电磁波',
      '发射与接收回路调到同一谐振频率，能量跨越空间点亮第二个间隙',
      '二十年后马可尼把火花变成通信——无线电、雷达都从这簇火花起步',
    ]);
    heading(f, '赫兹实验：抓住电磁波');
  },
});
registerViz(hertzElectromagneticWave);

/** 多普勒效应。 */
const dopplerEffect = defineViz({
  slug: 'doppler-effect', title: '多普勒效应', animated: true,
  params: { vs: { type: 'range', min: -100, max: 100, default: 40, step: 5, label: '波源速度 (m/s)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const vs = num(params, 'vs', 40);
    clear(f);
    const cx = w * 0.44, cy = h * 0.44;
    // 波源运动
    const move = Math.sin(f.t * 0.4) * 60 * (vs / 100);
    const srcX = cx + move;
    // 波前圆环（源移动导致压缩/拉伸）
    const speed = 100;
    const R0 = 150;
    for (let k = 0; k < 7; k++) {
      const phase = ((f.t * speed + k * 40) % (R0 * 1.6)) / 1.6;
      const srcShift = (phase / speed) * vs * 1.2;
      const r = phase;
      if (r < 6) continue;
      const alpha = 0.6 * (1 - r / R0);
      if (alpha <= 0.02) continue;
      circle(f, srcX - srcShift, cy, r, { stroke: `rgba(66,153,225,${alpha})`, lw: 2.4 });
    }
    circle(f, srcX, cy, 12, { fill: C.warm });
    text(f, '波源', srcX - 16, cy - 24, { color: C.warm, font: '11px sans-serif' });
    // 观察者
    const ox = w * 0.84;
    circle(f, ox, cy, 14, { fill: C.green });
    text(f, '观察者', ox - 24, cy + 38, { color: C.green, font: '11px sans-serif' });
    text(f, vs > 5 ? '前方波面被压密 → 频率升高（音调变尖）' : vs < -5 ? '后方波面被拉疏 → 频率降低（音调变沉）' : '静止：频率不变',
      30, 44, { color: vs > 5 ? C.cyan : vs < -5 ? C.hot : C.dim, font: '13px sans-serif' });
    // 频率对比条
    const by = h - 130;
    const f0 = 440;
    const fShift = vs >= 0 ? f0 * (speed / Math.max(1, speed - vs)) : f0 * (speed / (speed - vs));
    text(f, `静止频率 ${f0} Hz → 观测频率 ${fShift.toFixed(0)} Hz（Δf = ${(fShift - f0).toFixed(0)} Hz）`,
      60, by, { color: C.warm, font: '14px sans-serif' });
    // 波形条（压缩/拉伸）
    for (let i = 0; i < 70; i++) {
      const t = i / 70;
      const local = vs >= 0 ? Math.sin(t * Math.PI * (8 + vs / 14)) : Math.sin(t * Math.PI * (8 + vs / 40));
      const a = 0.3 + 0.6 * Math.abs(local);
      poly(f, [[60 + t * (w - 140), by + 24], [60 + t * (w - 140) + 7, by + 24],
        [60 + t * (w - 140) + 7, by + 52], [60 + t * (w - 140), by + 52]],
        { stroke: 'transparent', fill: `rgba(72,187,120,${a})` });
    }
    text(f, `v_s = ${vs} m/s：${vs > 0 ? '朝向观察者' : vs < 0 ? '远离观察者' : '相对静止'}——光波同理，星系红移即此效应`,
      60, by + 76, { color: C.cyan, font: '12px sans-serif' });
    footnotes(f, [
      '多普勒 1842 年的理论从声学进入光学——天体运动与宇宙膨胀的测量基石',
      '超音速时波面叠成激波锥——马赫锥就是这个图样的极限',
      '医学彩超、雷达测速、卫星导航的时频校正全靠这条规则',
    ]);
    heading(f, '多普勒效应：运动改写频率');
  },
});
registerViz(dopplerEffect);

/** 原子钟。 */
const atomicClock = defineViz({
  slug: 'atomic-clock', title: '原子钟', animated: true,
  params: { sys: { type: 'select', options: ['铯束钟', '冷原子喷泉', '光晶格钟'], default: '铯束钟', label: '方案' } },
  draw: (f) => {
    const { w, h, params } = f;
    const sys = String((params as Record<string, unknown>)['sys'] ?? '');
    const digits = sys.includes('铯束') ? 10 : sys.includes('喷泉') ? 15 : 18;
    clear(f);
    // 能级与微波驱动
    const bx = 70, by = h * 0.34;
    seg(f, bx, by + 70, bx + 220, by + 70, C.cool, 4);
    seg(f, bx, by, bx + 220, by, C.warm, 4);
    text(f, '|F=3⟩ 高能级', bx + 226, by + 5, { color: C.warm, font: '11px sans-serif' });
    text(f, '|F=4⟩ 低能级', bx + 226, by + 75, { color: C.cool, font: '11px sans-serif' });
    // 跃迁光子
    const hit = Math.sin(f.t * 4) > 0.2;
    const tx = bx + 96;
    if (hit) {
      seg(f, tx, by + 64, tx, by + 6, C.green, 3.4);
      poly(f, [[tx, by + 6], [tx - 7, by + 18], [tx + 7, by + 16]], { stroke: C.green, lw: 2.4, fill: C.green });
      text(f, 'ν = 9 192 631 770 Hz', tx - 74, by - 16, { color: C.green, font: '12px sans-serif' });
    } else {
      text(f, '微波照射中…', tx - 44, by - 16, { color: C.dim, font: '12px sans-serif' });
    }
    // 原子飞行
    for (let i = 0; i < 6; i++) {
      const t = ((f.t * 0.6 + i * 0.17) % 1);
      const x = bx + 6 + t * 480;
      const yl = by + 34 + Math.sin(i * 2 + f.t * 4) * 16;
      if (x < bx + 480) dot(f, x, yl, 5, `rgba(66,153,225,${0.7 - t * 0.4})`);
    }
    text(f, '铯原子束：只有频率对准才发生完全跃迁', bx + 6, by + 118, { color: C.dim, font: '11px sans-serif' });
    // 锁相回路
    const lx = w * 0.66, ly = h * 0.3;
    poly(f, [[lx, ly], [lx + 170, ly], [lx + 170, ly + 74], [lx, ly + 74]],
      { stroke: C.accent, lw: 2.4, fill: 'rgba(102,126,234,0.14)' });
    text(f, '锁相回路', lx + 44, ly + 30, { color: C.accent, font: '13px sans-serif' });
    text(f, '石英钟被原子跃迁驯服', lx + 12, ly + 56, { color: C.dim, font: '11px sans-serif' });
    seg(f, lx + 170, ly + 37, lx + 206, ly + 37, C.accent, 2.4);
    // 计时显示（秒定义）
    const dy = h - 118;
    poly(f, [[90, dy - 40], [w - 90, dy - 40], [w - 90, dy + 34], [90, dy + 34]],
      { stroke: C.green, lw: 2.6, fill: 'rgba(26,32,44,0.8)' });
    const secs = (f.t * 0.6) % 60;
    const disp = `${String(Math.floor(secs)).padStart(2, '0')}.${Math.floor((secs % 1) * Math.pow(10, digits - 8))}`.slice(0, digits);
    text(f, `${sys}输出：12:00:${disp}`, 118, dy + 4, { color: '#7fffd4', font: '26px monospace' });
    text(f, `1 s ≡ 9 192 631 770 次铯-133 超精细跃迁（${digits} 位稳定度量级示意）`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, sys.includes('光晶格') ? '光钟稳定度 ~10⁻¹⁸：宇宙年龄尺度只差几秒——引力红移都要算进去' : '冷原子喷泉减速原子、延长相互作用时间——束钟的升级版',
      30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '1967 年秒被重新定义：从地球自转改为数原子的颤动',
      '拉比磁共振、光抽运与冷原子先后铺路——四人分获诺贝尔奖',
      '导航卫星、相对论检验与基本常数测量全换上了量子标尺',
    ]);
    heading(f, '原子钟：时间的量子化');
  },
});
registerViz(atomicClock);

/** J/ψ 粒子发现实验。 */
const jpsiDiscovery = defineViz({
  slug: 'jpsi-discovery', title: 'J/ψ 粒子发现实验', animated: true,
  params: { width: { type: 'range', min: 0.05, max: 4, default: 0.4, step: 0.05, label: '共振宽度 (MeV，示意)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const wd = num(params, 'width', 0.4);
    clear(f);
    const v = view(f, { xMin: 2.8, xMax: 3.4, yMin: 0, yMax: 1.3, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    // 本底 + 共振峰
    const rand = rng(1974);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 400; i++) {
      const m = 2.8 + (i / 400) * 0.6;
      const bg = 0.34 - (m - 2.8) * 0.2;
      const peak = (wd * 0.9) / (Math.pow((m - 3.097) / (wd * 0.28), 2) + 1);
      pts.push([v.sx(m), v.sy(Math.min(1.25, bg + peak))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 3 });
    // 数据点
    for (let i = 0; i < 44; i++) {
      const m = 2.82 + rand() * 0.56;
      const bg = 0.34 - (m - 2.8) * 0.2;
      const peak = (wd * 0.9) / (Math.pow((m - 3.097) / (wd * 0.28), 2) + 1);
      const y = bg + peak + (rand() - 0.5) * 0.06;
      dot(f, v.sx(m), v.sy(y), 3.2, C.warm);
    }
    // 3.1 标注
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
    seg(f, v.sx(3.097), v.sy(0), v.sx(3.097), v.sy(1.28), `rgba(245,101,101,${pulse})`, 2);
    text(f, '3.097 GeV：J/ψ', v.sx(3.097) - 40, v.sy(1.26), { color: C.hot, font: '13px sans-serif' });
    // 双道徽标
    const bx = w * 0.7, by = 90;
    for (const [i, name] of ['e⁺e⁻ 双轻子道', 'μ⁺μ⁻ 双轻子道'].entries()) {
      const on = Math.sin(f.t * 2 + i * 2) > 0;
      poly(f, [[bx, by + i * 44], [bx + 176, by + i * 44], [bx + 176, by + i * 44 + 32], [bx, by + i * 44 + 32]],
        { stroke: on ? C.green : `${C.grid}aa`, lw: 2, fill: on ? 'rgba(72,187,120,0.2)' : 'rgba(45,55,72,0.5)' });
      text(f, `${on ? '✓ ' : ''}${name}`, bx + 10, by + i * 44 + 22, { color: on ? C.green : C.dim, font: '12px sans-serif' });
    }
    text(f, '宽度异常小 → 寿命异常长 → OZI 禁戒压住了衰变', 56, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '不变质量 →（GeV/c²）', w - 180, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '事例数 →', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    text(f, `当前展示宽度 ${wd} MeV（示意缩放）：窄共振是粲夸克的证书`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '1974 年 11 月 SLAC 与 BNL 同时宣布——物理学的十一月革命',
      '粲夸克的确认让三代夸克模型站稳脚跟（丁肇中与里希特 1976 年诺奖）',
      '双道独立符合排除随机巧合——两个实验室互为最强背书',
    ]);
    heading(f, 'J/ψ：窄峰里的新夸克');
  },
});
registerViz(jpsiDiscovery);

/** 希格斯粒子发现实验。 */
const higgsDiscovery = defineViz({
  slug: 'higgs-discovery', title: '希格斯粒子发现实验', animated: true,
  params: { channel: { type: 'select', options: ['双光子 γγ', '四轻子 4ℓ', '双 W'], default: '双光子 γγ', label: '衰变道' } },
  draw: (f) => {
    const { w, h, params } = f;
    const ch = String((params as Record<string, unknown>)['channel'] ?? '');
    clear(f);
    const v = view(f, { xMin: 100, xMax: 160, yMin: 0, yMax: 1.3, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    const peakX = 125;
    const bg = (m: number) => 0.42 * Math.exp(-(m - 100) / 26);
    const amp = ch.includes('双光子') ? 0.62 : ch.includes('四轻子') ? 0.5 : 0.4;
    const sig = (m: number) => amp / (Math.pow((m - peakX) / 2.2, 2) + 1);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 400; i++) {
      const m = 100 + (i / 400) * 60;
      pts.push([v.sx(m), v.sy(Math.min(1.25, bg(m) + sig(m)))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 3 });
    // 本底虚线
    const bpts: [number, number][] = [];
    for (let i = 0; i <= 200; i++) {
      const m = 100 + (i / 200) * 60;
      bpts.push([v.sx(m), v.sy(bg(m))]);
    }
    poly(f, bpts, { stroke: `${C.dim}aa`, lw: 2, dash: [6, 5] });
    // 数据点
    const rand = rng(20120704);
    for (let i = 0; i < 50; i++) {
      const m = 102 + rand() * 56;
      dot(f, v.sx(m), v.sy(bg(m) + sig(m) + (rand() - 0.5) * 0.05), 3.2, C.warm);
    }
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
    seg(f, v.sx(peakX), v.sy(0), v.sx(peakX), v.sy(1.28), `rgba(245,101,101,${pulse})`, 2.4);
    text(f, '125 GeV', v.sx(peakX) - 26, v.sy(1.26), { color: C.hot, font: '13px sans-serif' });
    // 五西格玛徽标
    const bx = w * 0.66, by = 96;
    const sig5 = Math.sin(f.t * 1.4) > 0;
    poly(f, [[bx, by], [bx + 210, by], [bx + 210, by + 56], [bx, by + 56]],
      { stroke: sig5 ? C.green : C.cool, lw: 2.6, fill: sig5 ? 'rgba(72,187,120,0.2)' : 'rgba(66,153,225,0.14)' });
    text(f, sig5 ? '✓ > 5σ  discovery' : '累计中：4σ…', bx + 24, by + 34, { color: sig5 ? C.green : C.cool, font: '16px sans-serif' });
    text(f, 'ATLAS 与 CMS 各自独立超过五西格玛', bx - 6, by + 84, { color: C.dim, font: '11px sans-serif' });
    text(f, `${ch}：鼓包不大，但标准模型的最后一块拼图正是它`, 56, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '双轻子不变质量 →（GeV/c²）', w - 220, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '事例数 →', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    text(f, '13 TeV 对撞、万亿事例统计——质量意味着希格斯场的真空期望值 246 GeV', 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '2012-07-04 两条通道同时鼓包——恩格勒与希格斯 2013 年诺贝尔奖',
      '四轻子道背景干净如标尺，双光子道统计强——互证才敢说发现',
      '质量起源被确认，但真空稳定性与自然性问题开启了新物理追问',
    ]);
    heading(f, '希格斯：标准模型收官');
  },
});
registerViz(higgsDiscovery);

/** 迈斯纳效应实验。 */
const superconductivityDiscovery = defineViz({
  slug: 'superconductivity-discovery', title: '迈斯纳效应实验', animated: true,
  params: { T: { type: 'range', min: 1, max: 12, default: 4.2, step: 0.2, label: '温度 (K)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const T = num(params, 'T', 4.2);
    const sc = T < 9.3; // 示意 Tc=9.3 K（铌）
    clear(f);
    // 左：磁悬浮
    const cx = w * 0.3, cy = h * 0.5;
    // 磁铁底座
    poly(f, [[cx - 110, cy + 70], [cx + 110, cy + 70], [cx + 110, cy + 110], [cx - 110, cy + 110]],
      { stroke: C.dim, lw: 2.4, fill: 'rgba(100,116,139,0.5)' });
    text(f, '永磁体', cx - 30, cy + 134, { color: C.dim, font: '11px sans-serif' });
    // 场线（超导时被排出）
    for (let i = 0; i < 5; i++) {
      const x = cx - 80 + i * 40;
      if (sc) {
        const bendPts: [number, number][] = [];
        for (let k = 0; k <= 20; k++) {
          const t = k / 20;
          const y = cy + 60 - t * 160;
          const spread = Math.sin(t * Math.PI) * 46 * Math.sign(1);
          bendPts.push([x + spread * (x < cx ? -0.4 : 0.4) * (1 + Math.sin(t * Math.PI)), y]);
        }
        poly(f, bendPts, { stroke: `rgba(146,84,222,${0.5 + 0.2 * Math.sin(f.t * 2)})`, lw: 2 });
      } else {
        seg(f, x, cy + 60, x, cy - 100, `rgba(146,84,222,0.55)`, 2);
      }
    }
    // 超导块（悬浮）
    const hover = sc ? Math.sin(f.t * 2) * 5 : 40;
    const byY = cy + 6 - hover;
    poly(f, [[cx - 66, byY - 30], [cx + 66, byY - 30], [cx + 66, byY + 14], [cx - 66, byY + 14]],
      { stroke: sc ? C.cool : C.dim, lw: 3, fill: sc ? 'rgba(66,153,225,0.45)' : 'rgba(100,116,139,0.4)' });
    text(f, sc ? '悬浮！磁通被排出' : '普通金属：磁通穿过，沉底', cx - 76, byY - 44, { color: sc ? C.cool : C.dim, font: '12px sans-serif' });
    // 右：电阻-温度曲线
    const v = view(f, { xMin: 0, xMax: 14, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 7, ticks: true });
    const rpts: [number, number][] = [];
    for (let t = 0; t <= 14; t += 0.2) {
      rpts.push([v.sx(t), v.sy(t < 9.3 ? 0 : Math.min(1, 0.35 + (t - 9.3) * 0.06))]);
    }
    poly(f, rpts, { stroke: C.green, lw: 3.4 });
    seg(f, v.sx(9.3), v.sy(0), v.sx(9.3), v.sy(1.05), `${C.hot}77`, 1.4, );
    text(f, 'T_c', v.sx(9.3) - 8, v.sy(1.06), { color: C.hot, font: '11px sans-serif' });
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
    dot(f, v.sx(T), v.sy(T < 9.3 ? 0 : Math.min(1, 0.35 + (T - 9.3) * 0.06)), 8, `rgba(72,187,120,${pulse})`);
    text(f, `T = ${T.toFixed(1)} K：${sc ? '超导态（R = 0，完全抗磁）' : '正常态（有电阻）'}`, 56, 44, { color: sc ? C.cyan : C.warm, font: '13px sans-serif' });
    text(f, '温度 →（K，示意 Tc = 9.3 K 的铌）', w - 240, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '电阻 R', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    text(f, '磁通深度 B = B₀·e^(−x/λ)：伦敦穿透深度是超导的第二张面孔', 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '1911 年昂内斯发现汞电阻归零——液氦与零电阻换来 1913 年诺贝尔奖',
      '1933 年迈斯纳效应区分了理想导体与真超导体——完全抗磁才是判据',
      '临界温度、临界场、临界电流围出超导穹顶——越过一角就变回普通金属',
    ]);
    heading(f, '迈斯纳效应：超导不只是零电阻');
  },
});
registerViz(superconductivityDiscovery);

/** 玻色-爱因斯坦凝聚实现。 */
const bec1995 = defineViz({
  slug: 'bec-1995', title: '玻色-爱因斯坦凝聚实现（1995）', animated: true,
  params: { T: { type: 'range', min: 0.5, max: 5, default: 2, step: 0.1, label: '温度 (相对 T_c)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const Tr = num(params, 'T', 2);
    const condensed = Tr < 1;
    clear(f);
    const v = view(f, { xMin: -3, xMax: 3, yMin: 0, yMax: 1.15, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    // 速度分布：高温 Maxwell 分布 → 低温出现凝聚尖峰
    const pts: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const x = -3 + (i / 300) * 6;
      const thermal = Math.exp(-Math.pow(x, 2) / (0.5 + Tr * 0.7)) / Math.sqrt(0.5 + Tr * 0.7);
      const frac = condensed ? Math.min(0.85, (1 - Tr) * 1.4) : 0;
      const cond = frac * Math.exp(-Math.pow(x, 2) / 0.045);
      pts.push([v.sx(x), v.sy(Math.min(1.1, thermal * 0.72 + cond))]);
    }
    poly(f, pts, { stroke: condensed ? C.green : C.accent, lw: 3.4 });
    if (condensed) {
      const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
      dot(f, v.sx(0), v.sy(Math.min(1.1, 0.72 / Math.sqrt(0.5 + Tr * 0.7) + Math.min(0.85, (1 - Tr) * 1.4))), 9, `rgba(72,187,120,${pulse})`);
      text(f, '凝聚尖峰：宏观数目粒子占据同一量子态', v.sx(0) + 14, v.sy(1.06), { color: C.green, font: '13px sans-serif' });
    }
    // T_c 标记
    seg(f, v.sx(1), v.sy(0), v.sx(1), v.sy(1.1), `${C.hot}77`, 1.4, );
    text(f, 'T = T_c 临界', v.sx(1) + 8, v.sy(1.1), { color: C.hot, font: '11px sans-serif' });
    text(f, condensed ? `T = ${Tr.toFixed(1)} T_c < T_c：进入 BEC 相` : `T = ${Tr.toFixed(1)} T_c > T_c：仍是热原子气体（Maxwell 分布）`,
      56, 44, { color: condensed ? C.cyan : C.warm, font: '13px sans-serif' });
    text(f, '速度 v →', w - 110, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '分布 →', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    text(f, 'nλ³ ≥ 2.612：德布罗意波长重叠到原子间距——凝聚判据', 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '激光冷却 + 蒸发冷却：把铷原子压到 170 纳开——比外太空还冷千倍',
      '科内尔与威曼（JILA）、凯特纳（MIT）1995 年双双成功——2001 年诺贝尔奖',
      '凝聚体是量子模拟平台：超流涡旋量子化、费米配对都在其中被观测',
    ]);
    heading(f, 'BEC：物质的第五态');
  },
});
registerViz(bec1995);
