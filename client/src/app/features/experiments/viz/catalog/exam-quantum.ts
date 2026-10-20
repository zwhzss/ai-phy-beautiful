import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text, view, grid, curve, circle, vec, rng } from '../canvas';

/** P506 有限深方势阱。 */
const finiteSquareWell = defineViz({
  slug: 'finite-square-well',
  title: '有限深方势阱',
  params: { V0: { type: 'range', min: 2, max: 20, default: 8, step: 1, label: '势阱深度 V₀ (归一)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const V0 = num(params, 'V0', 8);
    clear(f);
    const v = view(f, { xMin: -2.5, xMax: 2.5, yMin: -0.6, yMax: 1.3, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 势阱形状
    const well: Array<[number, number]> = [];
    well.push([v.sx(-2.5), v.sy(V0 / 8)]);
    well.push([v.sx(-1), v.sy(V0 / 8)]);
    well.push([v.sx(-1), v.sy(0)]);
    well.push([v.sx(1), v.sy(0)]);
    well.push([v.sx(1), v.sy(V0 / 8)]);
    well.push([v.sx(2.5), v.sy(V0 / 8)]);
    poly(f, well, { stroke: C.cool, lw: 2.4 });
    text(f, `V₀ = ${V0}`, v.sx(2.4), v.sy(V0 / 8) - 8, { align: 'right', color: C.cool, font: '14px serif' });
    // 束缚态数目：V0 越深越多（示意 1-5）
    const nStates = Math.max(1, Math.min(5, Math.ceil(V0 / 4)));
    const colors = [C.yellow, C.green, C.pink, C.warm, C.hot];
    for (let n = 1; n <= nStates; n++) {
      const E = (n / (nStates + 1.2)) * V0 / 8;
      const y = v.sy(E);
      // 阶段内余弦、外指数衰减
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 240; i++) {
        const x = -2.5 + (i / 240) * 5;
        let psi: number;
        if (Math.abs(x) < 1) {
          const k = n * Math.PI / 2 * (0.9 + n * 0.05);
          psi = Math.cos(k * x) * 0.3;
        } else {
          const kappa = (n * 0.9);
          psi = Math.cos(n * Math.PI / 2) * 0.3 * Math.exp(-kappa * (Math.abs(x) - 1));
        }
        pts.push([v.sx(x), y + psi * (v.sy(0) - v.sy(0.28))]);
      }
      poly(f, pts, { stroke: colors[n - 1], lw: 2.2 });
      seg(f, v.sx(-2.5), y, v.sx(2.5), y, `${colors[n - 1]}55`, 1.2);
      text(f, `E${n}`, v.sx(-2.45), y - 6, { color: colors[n - 1], font: '13px serif' });
      if (n === nStates) {
        text(f, '穿透进壁里：波函数在禁区指数衰减而非突变为零', v.sx(-0.6), y - 30, { color: C.fg, font: '13px serif' });
      }
    }
    text(f, `当前允许 ${nStates} 个束缚态 —— V₀ 越深阱能"装"的态越多`, v.sx(-2.4), v.sy(1.24), { color: C.yellow, font: '15px serif' });
    text(f, 'x', (v.sx(-2.5) + v.sx(2.5)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'E / V₀', v.sx(-2.45), v.sy(1.3), { color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      '边界条件变化：无穷深⇒ψ(±a)=0；有限深⇒ψ 与 ψ′ 连续（穿透+导数匹配）',
      '超越方程 ka tan(ka) = κa 与 ka cot(ka) = −κa 的交点=能级（奇偶分家）',
      '束缚态必然有限个：太浅的阱只够绑基态 —— 量子阱激光器的能带设计基础',
    ]);
    heading(f, '超越方程的交点就是能级数');
  },
});
registerViz(finiteSquareWell);

/** P507 δ 势的束缚与散射。 */
const deltaPotential = defineViz({
  slug: 'delta-potential',
  title: 'δ 势的束缚与散射',
  params: { g: { type: 'range', min: -10, max: 10, default: -6, step: 0.5, label: '强度 g（负=吸引）' } },
  draw: (f) => {
    const { w, h, params } = f;
    const g = num(params, 'g', -6);
    clear(f);
    const v = view(f, { xMin: -3, xMax: 3, yMin: -1.4, yMax: 1.6, inset: 46, insetBottom: 46 });
    grid(f, v);
    // δ 势（向下的尖峰，负 g）
    const depth = -g * 0.14;
    const spike: Array<[number, number]> = [[v.sx(-3), v.sy(0)], [v.sx(-0.03), v.sy(0)], [v.sx(0), v.sy(Math.min(-1.3, depth))], [v.sx(0.03), v.sy(0)], [v.sx(3), v.sy(0)]];
    poly(f, spike, { stroke: C.hot, lw: 2.6 });
    text(f, `V(x) = g·δ(x)，g = ${g}`, v.sx(0.3), v.sy(Math.min(-1.1, depth) - 0.14), { color: C.hot, font: '14px serif' });
    if (g < 0) {
      // 束缚态：E = −mg²/2ℏ²
      const Eb = -g * g * 0.028;
      seg(f, v.sx(-3), v.sy(-Eb), v.sx(3), v.sy(-Eb), C.yellow, 1.8);
      text(f, `E₀ = −mg²/(2ℏ²) = ${(-Eb).toFixed(2)}（唯一束缚态）`, v.sx(-2.9), v.sy(-Eb) - 8, { color: C.yellow, font: '14px serif' });
      // 束缚波函数 e^(−κ|x|)
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 240; i++) {
        const x = -3 + (i / 240) * 6;
        pts.push([v.sx(x), v.sy(0.55 * Math.exp(-Math.abs(x) * 1.4) - 0.1)]);
      }
      poly(f, pts, { stroke: C.green, lw: 2.4 });
      text(f, 'ψ ~ e^(−κ|x|)：尖点处导数跳变 Δψ′ = (2mg/ℏ²)ψ(0)', v.sx(-2.9), v.sy(1.0), { color: C.green, font: '13px serif' });
      text(f, 'δ 势再窄也能绑一个态 —— "任意浅的吸引都有束缚态"', v.sx(-2.9), v.sy(0.84), { color: C.fg, font: '13px serif' });
    } else {
      // 排斥势：散射
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 240; i++) {
        const x = -3 + (i / 240) * 6;
        const amp = x < 0 ? 0.5 : 0.5 * Math.cos(2.6 * x + 1.2);
        pts.push([v.sx(x), v.sy(amp + 0.3)]);
      }
      poly(f, pts, { stroke: C.cool, lw: 2.4 });
      text(f, '排斥 δ 势：入射波被散射（透射率 T = 1/(1+(mg/ℏ²k)²)）', v.sx(-2.9), v.sy(1.2), { color: C.cool, font: '13px serif' });
      text(f, '共振透射：特定能量下 T=1（Ramauer 效应的最简模型）', v.sx(-2.9), v.sy(1.04), { color: C.yellow, font: '13px serif' });
    }
    text(f, 'x', (v.sx(-3) + v.sx(3)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'V / ψ（归一）', v.sx(-2.9), v.sy(1.55), { color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      'δ 势是"理想化尖峰"：宽度→0、高度→∞、面积固定 —— 一维散射的解析试验场',
      '波函数导数跃变条件是该模型的核心规则（由薛定谔方程在奇异点积分而来）',
      '扩展：双 δ 势→化学键模型（H₂⁺ 的最粗简化）、δ 周期→Dirac comb（近自由电子）',
    ]);
    heading(f, '无穷窄的坑绑住一个态');
  },
});
registerViz(deltaPotential);

/** P508 方势垒透射系数。 */
const rectangularBarrier = defineViz({
  slug: 'rectangular-barrier',
  title: '方势垒透射系数',
  params: { E: { type: 'range', min: 0.2, max: 3, default: 0.7, step: 0.05, label: '粒子能量 E/V₀' }, width: { type: 'range', min: 0.5, max: 3, default: 1.5, step: 0.1, label: '势垒宽度 a (归一)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const E = num(params, 'E', 0.7), a = num(params, 'width', 1.5);
    clear(f);
    const v = view(f, { xMin: -4, xMax: 4, yMin: -0.5, yMax: 1.8, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 势垒
    const bpts: Array<[number, number]> = [[v.sx(-4), v.sy(0)], [v.sx(-a), v.sy(0)], [v.sx(-a), v.sy(1)], [v.sx(a), v.sy(1)], [v.sx(a), v.sy(0)], [v.sx(4), v.sy(0)]];
    poly(f, bpts, { stroke: C.hot, lw: 2.4, fill: 'rgba(245,101,101,0.14)' });
    // 能量线
    seg(f, v.sx(-4), v.sy(E), v.sx(4), v.sy(E), C.yellow, 1.8);
    text(f, `E = ${E.toFixed(2)} V₀`, v.sx(3.9), v.sy(E) - 8, { align: 'right', color: C.yellow, font: '14px serif' });
    // 波函数
    const inside = E < 1;
    const kappa = inside ? Math.sqrt(1 - E) * 2.2 : 0;
    const kOut = Math.sqrt(Math.max(0.05, E)) * 3.4;
    const T = inside
      ? Math.pow(1 / (1 + Math.pow(Math.sinh(kappa * a), 2) / (4 * E * (1 - E) + 0.001)), 1)
      : 1 / (1 + Math.pow(Math.sin(kOut * a), 2) / (4 * E * (E - 1) + 0.001));
    const Tc = Math.max(0.002, Math.min(1, T));
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 400; i++) {
      const x = -4 + (i / 400) * 8;
      let psi: number;
      const ampL = 1;
      const ampT = Math.sqrt(Tc);
      if (x < -a) {
        psi = ampL * (Math.sin(kOut * x + f.t * 3) + 0.6 * Math.sin(-kOut * x + 1.4 + f.t * 3)) * 0.34;
      } else if (x < a) {
        if (inside) psi = ampL * Math.sinh(kappa * (x + a)) / Math.sinh(kappa * 2 * a || 1) * Math.exp(-kappa * x * 0) * 0.34 * Math.exp(-kappa * (x + a) * 0.4);
        else psi = ampL * Math.sin(kOut * x + f.t * 3) * 0.3;
        if (inside) psi = 0.34 * Math.sinh(kappa * (a - Math.abs(x)) + 0.3) / Math.sinh(kappa * a + 0.3) * 0.9;
      } else {
        psi = ampT * Math.sin(kOut * x + f.t * 3 + 0.7) * 0.34;
      }
      pts.push([v.sx(x), v.sy(0.62 + psi)]);
    }
    poly(f, pts, { stroke: C.cool, lw: 2.4 });
    text(f, inside ? '势垒内：波函数指数爬升再衰减（穿隧）' : 'E > V₀：全透射但有反射震荡（共振透射点 T=1）',
      v.sx(-3.9), v.sy(1.72), { color: inside ? C.green : C.cool, font: '14px serif' });
    text(f, `透射率 T ≈ ${(Tc * 100).toFixed(1)}%　（E<V₀ 时 T ~ e^(−2κa)，宽度每加一点掉一大截）`,
      v.sx(-3.9), v.sy(1.6), { color: C.yellow, font: '14px serif' });
    text(f, 'x', (v.sx(-4) + v.sx(4)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'V / ψ', v.sx(-3.9), v.sy(1.82), { color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      '三个区域解方程+四处匹配（ψ、ψ′ 连续）⇒ 透射/反射系数（量子力学标准习题）',
      'STM 扫描隧道显微镜：隧穿电流 ∝ e^(−2κd) —— 原子级分辨全靠指数的敏感',
      'α 衰变盖革-努塔尔定律：半衰期对隧穿概率的指数依赖跨越 30 个数量级',
    ]);
    heading(f, '隧穿不是奇迹是数学');
  },
});
registerViz(rectangularBarrier);

/** P509 谐振子的相干态。 */
const coherentStateOscillator = defineViz({
  slug: 'coherent-state-oscillator',
  title: '谐振子的相干态',
  params: { alpha: { type: 'range', min: 0.5, max: 4, default: 2.2, step: 0.1, label: '|α|（振幅）' } },
  draw: (f) => {
    const { w, h, params } = f;
    const amp = num(params, 'alpha', 2.2);
    clear(f);
    const v = view(f, { xMin: -4, xMax: 4, yMin: -0.3, yMax: 1.6, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 经典轨道与波包中心
    const cx = Math.cos(f.t) * amp * 0.9;
    // 经典轨迹虚线
    const cl: Array<[number, number]> = [];
    for (let i = 0; i <= 120; i++) {
      const x = -4 + (i / 120) * 8;
      cl.push([v.sx(x), v.sy(0.9 + Math.cos(x / 0.9) * 0.0001 + 0)]);
    }
    // 简谐势
    const pot: Array<[number, number]> = [];
    for (let i = 0; i <= 200; i++) {
      const x = -4 + (i / 200) * 8;
      pot.push([v.sx(x), v.sy(x * x * 0.045)]);
    }
    poly(f, pot, { stroke: C.cool, lw: 2.2 });
    text(f, 'V = ½mω²x²', v.sx(3.9), v.sy(1.5), { align: 'right', color: C.cool, font: '14px serif' });
    // 高斯波包（不展宽！）
    const sigma = 0.55;
    const wave: Array<[number, number]> = [];
    for (let i = 0; i <= 240; i++) {
      const x = -4 + (i / 240) * 8;
      const psi = Math.exp(-Math.pow(x - cx, 2) / (2 * sigma * sigma)) * (0.7 + 0.3 * Math.cos(f.t * 2 + x * 3));
      wave.push([v.sx(x), v.sy(0.45 + psi * 0.5)]);
    }
    poly(f, wave, { stroke: C.pink, lw: 2.6 });
    // 能级
    seg(f, v.sx(-4), v.sy(0.45 + 0.02), v.sx(4), v.sy(0.45 + 0.02), `${C.yellow}66`, 1.4);
    // 运动点
    dot(f, v.sx(cx), v.sy(0.45 + 0.62), 7, C.hot);
    vec(f, v.sx(cx), v.sy(0.45), v.sx(cx), v.sy(0.45 + 0.58), `${C.hot}aa`, 1.6);
    text(f, `⟨x⟩(t) = ${amp.toFixed(1)}·cos(ωt)：中心严格走经典轨道`, v.sx(-3.9), v.sy(1.36), { color: C.hot, font: '15px serif' });
    text(f, 'σ_x 恒定不展宽（≠自由粒子高斯包！）—— 相干态的招牌', v.sx(-3.9), v.sy(1.22), { color: C.pink, font: '14px serif' });
    text(f, 'a|α⟩ = α|α⟩：湮灭算符本征态，光场的"准经典"态', v.sx(-3.9), v.sy(1.1), { color: C.fg, font: '14px serif' });
    text(f, '激光输出就是大 |α| 相干态：粒子数涨落 √n̄ 相对小', v.sx(-3.9), v.sy(0.14), { color: C.green, font: '14px serif' });
    text(f, 'x', (v.sx(-4) + v.sx(4)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      '相干态是能量本征态的非定域叠加：相位确定、粒子数不确定（泊松分布）',
      '|α|² = 平均光子数；位相-粒子数共轭对=不确定性关系的另一副面孔',
      '压缩态、猫态（Schmidt 态）：从相干态出发的量子光学家族',
    ]);
    heading(f, '最像经典的量子态');
  },
});
registerViz(coherentStateOscillator);

/** P510 角动量升降算符。 */
const ladderOperatorsAngular = defineViz({
  slug: 'ladder-operators-angular',
  title: '角动量升降算符',
  params: { j: { type: 'select', options: ['j = 1/2', 'j = 1', 'j = 3/2', 'j = 2'], default: 'j = 1', label: '总角动量 j' } },
  draw: (f) => {
    const { w, h, params } = f;
    const jStr = str(params, 'j', 'j = 1');
    const j = Number(jStr.split('=')[1].trim());
    clear(f);
    // 阶梯图：每个 m 一个能级
    const nLevels = Math.round(2 * j) + 1;
    const cx = w * 0.4;
    const top = h * 0.72, spacing = Math.min(66, (h * 0.55) / Math.max(1, nLevels - 1));
    for (let i = 0; i < nLevels; i++) {
      const m = -j + i;
      const y = top - i * spacing;
      const isTop = i === nLevels - 1;
      const isBottom = i === 0;
      seg(f, cx - 110, y, cx + 110, y, isTop ? C.hot : isBottom ? C.cool : C.accent, 3);
      text(f, `m = ${m === Math.round(m) ? m : m.toFixed(1)}`, cx - 160, y + 5, { color: C.fg, font: '15px serif' });
      text(f, `|j=${j}, m=${m === Math.round(m) ? m : m.toFixed(1)}⟩`, cx + 124, y + 5, { color: C.dim, font: '13px serif' });
      // 升算符箭头
      if (i < nLevels - 1) {
        vec(f, cx + 60, y, cx + 60, y - spacing + 6, C.green, 2.4, 7);
        const d = Math.sqrt(j * (j + 1) - m * (m + 1));
        text(f, `J+ : ×${d.toFixed(2)}`, cx + 72, y - spacing / 2, { color: C.green, font: '12px serif' });
      }
      if (i > 0) {
        vec(f, cx - 60, y, cx - 60, y + spacing - 6, C.warm, 2.4, 7);
        const d = Math.sqrt(j * (j + 1) - m * (m - 1));
        text(f, `J− : ×${d.toFixed(2)}`, cx - 216, y - spacing / 2, { color: C.warm, font: '12px serif' });
      }
    }
    // 边界
    const yTop = top - (nLevels - 1) * spacing;
    text(f, 'J+|top⟩ = 0（升到顶升不动）', cx + 130, yTop - 16, { color: C.hot, font: '13px serif' });
    text(f, 'J−|bottom⟩ = 0', cx + 130, top + 24, { color: C.cool, font: '13px serif' });
    // 右侧公式
    const bx = w * 0.72;
    const rows = [
      ['J± = Jx ± iJy', C.fg],
      ['[Jz, J±] = ±ℏJ±', C.green],
      ['J²|jm⟩ = ℏ²j(j+1)|jm⟩', C.yellow],
      ['J±|jm⟩ = ℏ√(j(j+1)∓m(m±1)) |j,m±1⟩', C.cool],
      ['m ∈ {−j, …, +j}（间隔 1）', C.pink],
    ] as Array<[string, string]>;
    rows.forEach(([s, color], i) => text(f, s, bx, 120 + i * 48, { color, font: '15px serif' }));
    text(f, `当前 j=${j}：共 ${nLevels} 个态，最高权态法一次搭出全表`, bx, 120 + 5 * 48 + 10, { color: C.fg, font: '14px sans-serif' });
    footnotes(f, [
      '对易代数 [Jx, Jy] = iℏJz 决定一切：Casimir J² 与一个分量可同时测',
      '升降算符把"求本征值"变成"数台阶"：群表示论的最简单入口',
      'SU(2) 与 SO(3) 双覆盖 → 半整数 j（电子自旋）的存在性由代数担保',
    ]);
    heading(f, '最高权态一搭，整张表就出来了');
  },
});
registerViz(ladderOperatorsAngular);

/** P511 泡利矩阵与自旋 1/2。 */
const pauliMatricesSpin = defineViz({
  slug: 'pauli-matrices-spin',
  title: '泡利矩阵与自旋 1/2',
  params: { axis: { type: 'select', options: ['σx 测量', 'σy 测量', 'σz 测量'], default: 'σz 测量', label: '测量方向' } },
  draw: (f) => {
    const { w, h, params } = f;
    const axis = str(params, 'axis', 'σz 测量').replace(' 测量', '');
    clear(f);
    // 左：三个泡利矩阵
    const bx = 60, by = 96, cell = 52;
    const mats: Record<string, number[][]> = {
      σx: [[0, 1], [1, 0]],
      σy: [[0, -1], [1, 0]].map((r, i) => r.map((val, c) => (i === 0 && c === 1 ? 0 : val))),
      σz: [[1, 0], [0, -1]],
    };
    mats['σy'] = [[0, -1], [1, 0]];
    const imaginary = { σx: false, σy: true, σz: false } as Record<string, boolean>;
    let yOff = 0;
    for (const key of ['σx', 'σy', 'σz']) {
      text(f, key + ' =', bx, by + yOff + 34, { color: key === axis ? C.yellow : C.fg, font: '18px serif' });
      const m = mats[key];
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          const x = bx + 56 + c * cell, y = by + yOff + r * cell;
          poly(f, [[x, y], [x + cell - 6, y], [x + cell - 6, y + cell - 6], [x, y + cell - 6]],
            { fill: `rgba(102,126,234,${key === axis ? 0.4 : 0.15})`, stroke: key === axis ? C.yellow : C.grid, lw: 1.6 });
          const val = m[r][c];
          const label = val === 0 ? '0' : val === 1 ? '1' : '−1';
          const iLabel = imaginary[key] && val !== 0 ? (val === 1 ? 'i' : '−i') : label;
          text(f, iLabel, x + (cell - 6) / 2, y + cell / 2, { align: 'center', color: C.fg, font: '16px serif' });
        }
      }
      // 括号
      text(f, ']', bx + 56 + 2 * cell + 4, by + yOff + 60, { color: C.dim, font: '26px serif' });
      yOff += 130;
    }
    // 右：Bloch 球测量
    const cx = w * 0.74, cy = h * 0.42, R = 110;
    circle(f, cx, cy, R, { stroke: C.cool, lw: 2 });
    const { ctx } = f;
    ctx.save();
    ctx.strokeStyle = `${C.grid}aa`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, R, R * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // 三轴
    vec(f, cx, cy + R, cx, cy - R - 24, C.yellow, 2.4);
    text(f, 'z (σz)', cx + 8, cy - R - 26, { color: C.yellow, font: '13px serif' });
    vec(f, cx, cy, cx + R + 20, cy, axis === 'σx' ? C.hot : C.dim, axis === 'σx' ? 3 : 1.8);
    text(f, 'x (σx)', cx + R + 26, cy + 4, { color: axis === 'σx' ? C.hot : C.dim, font: '13px serif' });
    vec(f, cx, cy, cx - R * 0.5, cy + R * 0.55, axis === 'σy' ? C.green : C.dim, axis === 'σy' ? 3 : 1.8);
    // 自旋态演化
    const th = f.t * 1.5;
    const sx = Math.sin(th) * Math.cos(0.7), sy = Math.sin(th) * Math.sin(0.7), sz = Math.cos(th);
    vec(f, cx, cy, cx + sx * R, cy - sz * R + sy * R * 0.3, C.pink, 3.4);
    text(f, '|ψ⟩', cx + sx * R + 10, cy - sz * R + sy * R * 0.3, { color: C.pink, font: '15px serif' });
    text(f, '本征值 ±ℏ（测量必得 ±1）：σ² = 1̂', cx - R, cy + R + 46, { color: C.fg, font: '14px serif' });
    text(f, '测量 σz：|↑⟩→+1、|↓⟩→−1，各 50% 概率坍缩', cx - R, cy + R + 74, { color: C.yellow, font: '14px serif' });
    text(f, '[σx, σy] = 2iσz ⇒ 分量不可同测 —— 不确定关系的矩阵版本', cx - R, cy + R + 102, { color: C.hot, font: '14px sans-serif' });
    footnotes(f, [
      '泡利矩阵=自旋 1/2 的三方向可观测量（除以 2 是 S 的版本）',
      'σ_i² = 1̂、tr σ = 0、det σ = −1 —— 三个性质记住全部代数',
      '电子自旋 g≈2、Stern-Gerlach 分束、MRI 拉比共振：都是这三个 2×2',
    ]);
    heading(f, '三个 2×2 装下自旋全部把戏');
  },
});
registerViz(pauliMatricesSpin);

/** P512 海森堡绘景。 */
const heisenbergPicture = defineViz({
  slug: 'heisenberg-picture',
  title: '海森堡绘景',
  params: { picture: { type: 'select', options: ['薛定谔绘景', '海森堡绘景'], default: '海森堡绘景', label: '绘景' } },
  draw: (f) => {
    const { w, h, params } = f;
    const hb = str(params, 'picture', '海森堡绘景') === '海森堡绘景';
    clear(f);
    const v = view(f, { xMin: 0, xMax: 6.3, yMin: -1.6, yMax: 1.6, inset: 46, insetBottom: 46 });
    grid(f, v);
    const t0 = (f.t * 0.6) % 6.3;
    if (!hb) {
      // 薛定谔：态演化，算符不动
      const psi: Array<[number, number]> = [];
      for (let i = 0; i <= 200; i++) {
        const x = (i / 200) * 6.3;
        psi.push([v.sx(x), v.sy(0.9 * Math.exp(-Math.pow((x - t0) - 3, 2) / 1.2))]);
      }
      poly(f, psi, { stroke: C.pink, lw: 3 });
      seg(f, v.sx(1), v.sy(-1.2), v.sx(2.2), v.sy(-1.2), C.cool, 3);
      text(f, 'x̂（算符不动）', v.sx(1), v.sy(-1.32), { color: C.cool, font: '14px serif' });
      text(f, 'iℏ ∂|ψ⟩/∂t = Ĥ|ψ⟩ —— 态随时间跑', v.sx(0.3), v.sy(1.5), { color: C.fg, font: '15px serif' });
      text(f, '（动量、位置的期望值仍随态变）', v.sx(0.3), v.sy(1.3), { color: C.dim, font: '13px serif' });
    } else {
      // 海森堡：算符演化，态不动
      const ax: Array<[number, number]> = [], ap: Array<[number, number]> = [];
      for (let i = 0; i <= 200; i++) {
        const x = (i / 200) * 6.3;
        ax.push([v.sx(x), v.sy(Math.cos(x) * 1.0)]);
        ap.push([v.sx(x), v.sy(-Math.sin(x) * 1.0)]);
      }
      poly(f, ax, { stroke: C.yellow, lw: 2.8 });
      poly(f, ap, { stroke: C.cool, lw: 2.4, dash: [7, 5] });
      text(f, '黄实：x̂(t) = x̂(0)cosωt + (p̂/mω)sinωt', v.sx(0.3), v.sy(1.5), { color: C.yellow, font: '14px serif' });
      text(f, '蓝虚：p̂(t) = −mωx̂(0)sinωt + p̂(0)cosωt', v.sx(0.3), v.sy(1.3), { color: C.cool, font: '14px serif' });
      const dotX = Math.cos(t0), dotP = -Math.sin(t0);
      dot(f, v.sx(t0), v.sy(dotX), 7, C.hot);
      dot(f, v.sx(t0), v.sy(dotP), 7, C.green);
      text(f, `当前 t=${t0.toFixed(1)}：x̂=${dotX.toFixed(2)}，p̂=${dotP.toFixed(2)}`, v.sx(0.3), v.sy(-1.4), { color: C.fg, font: '14px serif' });
      text(f, 'dÂ/dt = (i/ℏ)[Ĥ, Â] + ∂Â/∂t —— 算符的运动方程', v.sx(0.3), v.sy(-1.55), { color: C.yellow, font: '15px serif' });
    }
    text(f, 't', (v.sx(0) + v.sx(6.3)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    // 底部对照
    text(f, hb ? '海森堡：态静态、算符跑 —— 与经典力学 dp/dt = −∂H/∂x 完全同形' : '薛定谔：态跑、算符静态 —— 波函数动力学的标准教材画面',
      56, h - 116, { color: C.pink, font: '15px sans-serif' });
    text(f, '两种绘景幺等价：⟨ψ_S|Â_S|ψ_S⟩ = ⟨ψ_H|Â_H|ψ_H⟩ —— 观测结果相同', 56, h - 86, { color: C.green, font: '14px sans-serif' });
    text(f, '对应原理：量子泊松括号 (i/ℏ)[·,·] → 经典泊松括号 {·,·}', 56, h - 56, { color: C.yellow, font: '14px sans-serif' });
    footnotes(f, [
      '绘景=把演化放在态上还是算符上：数学等价、物理洞察不同',
      '相互作用绘景（第三种）介于两者：微扰论的天然工作语言',
      '路径积分与相干态表象天然海森堡化 —— 费曼画的是算符的戏',
    ]);
    heading(f, '态不动算符动');
  },
});
registerViz(heisenbergPicture);

/** P513 二次量子化与产生湮灭算符。 */
const secondQuantization = defineViz({
  slug: 'second-quantization',
  title: '二次量子化与产生湮灭算符',
  params: { n: { type: 'range', min: 0, max: 5, default: 2, step: 1, label: '粒子数 n' } },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'n', 2));
    clear(f);
    // 左：Fock 空间阶梯
    const cx = w * 0.26;
    const levels = 6;
    for (let k = 0; k < levels; k++) {
      const y = h * 0.68 - k * 74;
      const active = k === n;
      seg(f, cx - 100, y, cx + 100, y, active ? C.hot : C.grid, active ? 4 : 2);
      text(f, `|${k}⟩`, cx - 156, y + 6, { color: active ? C.hot : C.dim, font: '17px serif' });
      if (k > 0) {
        vec(f, cx - 50, y, cx - 50, y + 68, C.green, 2.4, 7);
        text(f, 'a†', cx - 74, y + 40, { color: C.green, font: '15px serif' });
        text(f, `×√${k}`, cx - 44, y + 40, { color: C.cool, font: '12px serif' });
      }
      if (k < levels - 1) {
        vec(f, cx + 50, y, cx + 50, y - 68, C.warm, 2.4, 7);
        text(f, 'a', cx + 60, y - 36, { color: C.warm, font: '15px serif' });
        text(f, `×√${k + 1}`, cx + 76, y - 36, { color: C.cool, font: '12px serif' });
      }
      // n 态粒子示意
      if (active) {
        for (let p = 0; p < k; p++) {
          dot(f, cx - 60 + p * 30, y - 20, 7, C.yellow);
        }
      }
    }
    text(f, 'Fock 空间：粒子数可变的态矢阶梯', cx - 160, 76, { color: C.fg, font: '15px sans-serif' });
    text(f, 'a|n⟩ = √n |n−1⟩　a†|n⟩ = √(n+1) |n+1⟩', cx - 160, 106, { color: C.yellow, font: '15px serif' });
    // 右：代数规则
    const bx = w * 0.54;
    const rows = [
      ['[a, a†] = 1̂', C.green],
      ['[N, a] = −a　[N, a†] = +a†', C.cool],
      ['N = a†a（数算符）', C.yellow],
      ['H = ℏω(a†a + ½)', C.hot],
      ['x ∝ (a + a†)，p ∝ (a − a†)', C.pink],
    ] as Array<[string, string]>;
    rows.forEach(([s, color], i) => text(f, s, bx, 140 + i * 46, { color, font: '16px serif' }));
    text(f, '对易子一出，谐振子能谱 nℏω+½ℏω 自动掉出来', bx, 140 + 5 * 46 + 8, { color: C.fg, font: '15px sans-serif' });
    text(f, '多体：H = Σ ε_i a†_i a_i + (1/2)Σ V_ij a†a†aa', bx, 140 + 5 * 46 + 44, { color: C.cool, font: '15px serif' });
    text(f, '费米子换成反对易 [a, a†]₊ = 1 ⇒ 自动满足泡利不相容', bx, 140 + 5 * 46 + 80, { color: C.warm, font: '14px sans-serif' });
    footnotes(f, [
      '二次量子化不是"量子化两次"：把粒子数写进态空间，场算符才是基本对象',
      '产生/湮灭算符的语言让全同粒子多体问题从排列组合变成代数运算',
      '超流、超导 BCS、格点规范理论、QFT 粒子概念：全部用这套记账',
    ]);
    heading(f, '粒子数不再是常数');
  },
});
registerViz(secondQuantization);

/** P514 简并微扰与能级交叉。 */
const degeneratePerturbation = defineViz({
  slug: 'degenerate-perturbation',
  title: '简并微扰与能级分裂',
  params: { F: { type: 'range', min: 0, max: 10, default: 5, step: 0.5, label: '电场强度 F' } },
  draw: (f) => {
    const { w, h, params } = f;
    const F = num(params, 'F', 5);
    clear(f);
    const v = view(f, { xMin: 0, xMax: 3, yMin: -1.6, yMax: 1.6, inset: 46, insetBottom: 46 });
    grid(f, v);
    // n=2 简并：2s/2p 在 F=0 重合，线性 Stark 分裂 ±3eFa₀
    const split = (x: number) => (x * 1.0);
    const pts1: Array<[number, number]> = [], pts2: Array<[number, number]> = [];
    for (let i = 0; i <= 120; i++) {
      const x = (i / 120) * 3;
      pts1.push([v.sx(x), v.sy(0.7 + split(x) * 0.4)]);
      pts2.push([v.sx(x), v.sy(0.7 - split(x) * 0.4)]);
    }
    poly(f, pts1, { stroke: C.cool, lw: 2.8 });
    poly(f, pts2, { stroke: C.warm, lw: 2.8 });
    // 三重态 n=1 不分裂（无简并）
    const n1: Array<[number, number]> = [];
    for (let i = 0; i <= 60; i++) {
      n1.push([v.sx((i / 60) * 3), v.sy(-0.9)]);
    }
    poly(f, n1, { stroke: C.green, lw: 2.4, dash: [7, 5] });
    // 当前场强
    const d = split(Math.min(3, F));
    dot(f, v.sx(Math.min(3, F)), v.sy(0.7 + d * 0.4), 7, C.hot);
    dot(f, v.sx(Math.min(3, F)), v.sy(0.7 - d * 0.4), 7, C.hot);
    text(f, `F = ${F}：2s-2p 分裂 ±3eFa₀ = ±${(d * 0.4).toFixed(2)}`, v.sx(0.1), v.sy(1.5), { color: C.hot, font: '15px serif' });
    text(f, 'F=0 处二重简并 —— 一加场，混合态 |2s±2p⟩ 成为新本征态', v.sx(0.1), v.sy(1.34), { color: C.fg, font: '14px serif' });
    text(f, 'n=1（绿虚）无简并：一阶不移，只有二阶修正（二次 Stark）', v.sx(0.1), v.sy(-1.2), { color: C.green, font: '14px serif' });
    text(f, '电场 F（归一）', (v.sx(0) + v.sx(3)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'E', v.sx(0.1), v.sy(1.56), { color: C.dim, font: '12px sans-serif' });
    // 底部：久期方程
    text(f, '步骤：①在简并子空间取矩阵 ⟨m|V|n⟩ ②解久期方程 det(V−E¹δ)=0 ③选对基再算高阶', 56, h - 116, { color: C.yellow, font: '15px serif' });
    text(f, '为什么必须先对角化：一级能量就是该子空间的本征值，选错基全错', 56, h - 86, { color: C.hot, font: '14px sans-serif' });
    footnotes(f, [
      '简并时微扰"分不清该往哪偏"：正确做法=先在简并空间对角化 V',
      '氢 Stark 效应 1913：线性分裂验证了玻尔模型的简并结构',
      '晶体场分裂、Zeeman 拆分、Jahn-Teller 效应：同款数学不同舞台',
    ]);
    heading(f, '简并子空间先对角化再算');
  },
});
registerViz(degeneratePerturbation);

/** P515 WKB 近似。 */
const wkbApproximation = defineViz({
  slug: 'wkb-approximation',
  title: 'WKB 近似',
  params: { barrier: { type: 'range', min: 0.5, max: 3, default: 1.6, step: 0.1, label: '势垒厚度' } },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'barrier', 1.6);
    clear(f);
    const v = view(f, { xMin: -3, xMax: 3, yMin: -0.4, yMax: 1.7, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 缓变势
    const V = (x: number) => 1.1 * Math.exp(-Math.pow(x / a, 2));
    const pot: Array<[number, number]> = [];
    for (let i = 0; i <= 240; i++) {
      const x = -3 + (i / 240) * 6;
      pot.push([v.sx(x), v.sy(V(x))]);
    }
    poly(f, pot, { stroke: C.cool, lw: 2.4 });
    // E 线
    const E = 0.6;
    seg(f, v.sx(-3), v.sy(E), v.sx(3), v.sy(E), C.yellow, 1.8);
    text(f, 'E', v.sx(2.9), v.sy(E) - 8, { align: 'right', color: C.yellow, font: '14px serif' });
    // WKB 波函数（局部波长）
    const pts: Array<[number, number]> = [];
    let phase = 0;
    for (let i = 0; i <= 480; i++) {
      const x = -3 + (i / 480) * 6;
      const local = E - V(x);
      let psi: number;
      if (local > 0.02) {
        const k = Math.sqrt(local) * 8;
        phase += (k * 6 / 480);
        psi = Math.sin(phase) * 0.42 / Math.sqrt(Math.max(0.2, k));
      } else {
        const kappa = Math.sqrt(Math.max(0.01, -local)) * 8;
        psi = 0.42 * Math.exp(-kappa * Math.abs(x - 0.9) * 0.9) * Math.sign(1);
        psi = 0.42 * Math.exp(-kappa * 1.4) * Math.cos(phase);
        psi = Math.max(-0.5, Math.min(0.5, psi));
      }
      pts.push([v.sx(x), v.sy(0.86 + psi)]);
    }
    poly(f, pts, { stroke: C.pink, lw: 2.2 });
    // 转折点
    const xT = a * Math.sqrt(Math.log(1.1 / E));
    for (const sgn of [-1, 1]) {
      const xt = sgn * xT;
      if (Math.abs(xt) < 3) {
        seg(f, v.sx(xt), v.sy(0), v.sx(xt), v.sy(1.5), `${C.hot}88`, 1.6);
        text(f, '转折点', v.sx(xt) + 6, v.sy(1.45), { color: C.hot, font: '12px serif' });
      }
    }
    text(f, 'ψ(x) ≈ (2m(E−V))^(−1/4) · exp(±i∫p dx /ℏ)', v.sx(-2.9), v.sy(1.64), { color: C.fg, font: '14px serif' });
    text(f, '局部波长随"动能"伸缩：快处密、慢处疏', v.sx(-2.9), v.sy(1.52), { color: C.pink, font: '13px serif' });
    // 右下：量子化条件
    text(f, '束缚态：∮p dx = nh　⇒　∫ p dx = (n−¼)h（转折点修正）', 56, h - 116, { color: C.yellow, font: '15px serif' });
    text(f, '隧穿率：T ≈ exp(−2∫|p|dx/ℏ)（覆盖整个禁区的作用量）', 56, h - 86, { color: C.green, font: '15px serif' });
    text(f, '适用条件：de Broglie 波长随空间缓变（|dp/dx| ≪ p²）', 56, h - 56, { color: C.dim, font: '14px sans-serif' });
    footnotes(f, [
      '半经典展开：ℏ 是小参数，逐级修正 —— 精确解之外的第三条路',
      '转折点处 WKB 失效：用抛物线柱函数连接（连接公式给 ¼ 相移）',
      '应用：α 衰变、场发射、分子振动能级、瞬子与隧穿宇宙学',
    ]);
    heading(f, '作用量量子化的半经典路线');
  },
});
registerViz(wkbApproximation);

/** P516 费米黄金规则。 */
const fermiGoldenRule = defineViz({
  slug: 'fermi-golden-rule',
  title: '费米黄金规则',
  params: { width: { type: 'range', min: 0.2, max: 5, default: 2, step: 0.2, label: '相互作用时长 τ' } },
  draw: (f) => {
    const { w, h, params } = f;
    const tau = num(params, 'width', 2);
    clear(f);
    // 左：初末态与跃迁
    const cx = w * 0.26;
    seg(f, cx - 120, h * 0.3, cx + 120, h * 0.3, C.cool, 3);
    seg(f, cx - 120, h * 0.62, cx + 120, h * 0.62, C.warm, 3);
    text(f, '|i⟩ 能量 E_i', cx - 116, h * 0.3 - 14, { color: C.cool, font: '14px serif' });
    text(f, '|f⟩ 能量 E_f', cx - 116, h * 0.62 + 26, { color: C.warm, font: '14px serif' });
    const jumping = (Math.sin(f.t * 2.5) + 1) / 2;
    const py = h * 0.3 + jumping * (h * 0.32);
    dot(f, cx + 40, py, 9, C.hot);
    text(f, 'ħω = E_i − E_f', cx + 60, py + 5, { color: C.hot, font: '14px serif' });
    text(f, '光子/声子/…提供能量量子', cx - 116, h * 0.47, { color: C.dim, font: '13px serif' });
    // 右上：矩阵元平方谱
    const v = view(f, { xMin: -4, xMax: 4, yMin: 0, yMax: 1.2, inset: w * 0.5, insetRight: 46, insetBottom: 46 });
    grid(f, v);
    // |M|² 常数（费米golden rule 的平坦谱假设）
    const m2: Array<[number, number]> = [];
    for (let i = 0; i <= 100; i++) {
      const x = -4 + (i / 100) * 8;
      m2.push([v.sx(x), v.sy(0.55)]);
    }
    poly(f, m2, { stroke: C.green, lw: 2.4, dash: [7, 5] });
    text(f, '|⟨f|V|i⟩|² ≈ 常数', v.sx(-3.8), v.sy(0.62), { color: C.green, font: '14px serif' });
    // 末态密度
    const dos: Array<[number, number]> = [];
    for (let i = 0; i <= 100; i++) {
      const x = -4 + (i / 100) * 8;
      dos.push([v.sx(x), v.sy(x > -4 ? Math.min(1.1, 0.15 + 0.16 * (x + 4)) : 0)]);
    }
    poly(f, dos, { stroke: C.cool, lw: 2.4 });
    text(f, 'ρ(E_f) 末态密度（随能量涨）', v.sx(-2), v.sy(1.1), { color: C.cool, font: '14px serif' });
    // 谱线（洛伦兹型，宽度~1/τ）
    const peak: Array<[number, number]> = [];
    const gW = 0.9 / tau;
    for (let i = 0; i <= 200; i++) {
      const x = -4 + (i / 200) * 8;
      const lor = gW / (Math.pow(x - 0.6, 2) + gW * gW) * gW * 1.6;
      peak.push([v.sx(x), v.sy(Math.min(1.15, lor))]);
    }
    poly(f, peak, { stroke: C.hot, lw: 2.6 });
    text(f, `能量守恒峰：宽 ∝ 1/τ（τ=${tau} ⇒ 时长越长谱越锐）`, v.sx(-3.8), v.sy(0.08), { color: C.hot, font: '13px serif' });
    // 底部公式
    text(f, 'Γ = (2π/ℏ)·|M_if|²·ρ(E_f)　—— 跃迁率', 56, h - 116, { color: C.yellow, font: '18px serif' });
    text(f, '一阶含时微扰 + 长时极限 + 能量守恒 δ 函数 ⇒ 单位时间跃迁概率', 56, h - 86, { color: C.fg, font: '14px sans-serif' });
    text(f, '应用：自发辐射寿命、半导体载流子复合、核 β 衰变、光谱线宽', 56, h - 56, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '名字里的"黄金"是 Dirac 的自嘲：它只是好用不是精确解',
      '态密度 ρ 是关键：末态越多跳得越快（光子态密度∝ω³ 给出黑体谱形）',
      '含时微扰的两阶段：暂态振荡 → 线性增长 → 耗尽（Rabi 振荡修正黄金规则）',
    ]);
    heading(f, '矩阵元² × 末态密度');
  },
});
registerViz(fermiGoldenRule);

/** P517 分波法与相移。 */
const phaseShiftScattering = defineViz({
  slug: 'phase-shift-scattering',
  title: '分波法与相移',
  params: { lmax: { type: 'range', min: 0, max: 4, default: 2, step: 1, label: '最大分波 l' } },
  draw: (f) => {
    const { w, h, params } = f;
    const lmax = Math.round(num(params, 'lmax', 2));
    clear(f);
    // 左：散射示意（中心势+径向波）
    const cx = w * 0.3, cy = h * 0.46;
    circle(f, cx, cy, 34, { fill: 'rgba(102,126,234,0.7)', stroke: C.accent, lw: 2.4 });
    text(f, 'V(r)', cx, cy + 5, { align: 'center', color: C.fg, font: '13px serif' });
    // 平面波入射
    for (let i = 0; i < 5; i++) {
      const y = cy - 90 + i * 45;
      seg(f, 40, y, cx - 160, y, `${C.cool}aa`, 1.6);
    }
    text(f, '入射平面波 e^(ikz)', 40, cy - 108, { color: C.cool, font: '13px serif' });
    // 各分波的散射波纹（径向）
    const colors = [C.yellow, C.green, C.warm, C.pink, C.cyan];
    for (let l = 0; l <= lmax; l++) {
      const { ctx } = f;
      ctx.save();
      ctx.strokeStyle = colors[l % colors.length];
      ctx.lineWidth = 2;
      const R = 70 + l * 34;
      const start = -1.2 + Math.sin(f.t * 1.5 + l) * 0.15 + l * 0.1;
      ctx.beginPath();
      ctx.arc(cx, cy, R, start, start + 2.6);
      ctx.stroke();
      ctx.restore();
      const am = Math.exp(-l * 0.5);
      const lx = cx + Math.cos(start + 2.6) * R, ly = cy + Math.sin(start + 2.6) * R;
      text(f, `l=${l}  δ=${(am * 1.4).toFixed(2)}rad`, lx + 6, ly + 4, { color: colors[l % colors.length], font: '12px serif' });
      void am;
    }
    text(f, '每一圈=一个分波的散射相位延迟 δ_l', cx - 160, cy + 196, { color: C.fg, font: '14px sans-serif' });
    // 右：截面 vs 能量（共振峰）
    const v = view(f, { xMin: 0, xMax: 5, yMin: 0, yMax: 1.1, inset: w * 0.55, insetRight: 46, insetBottom: 46 });
    grid(f, v);
    const sig = (x: number) => {
      let s = 0.12 + 0.08 * x;
      for (const res of [1.6, 3.4]) {
        const g = 0.14;
        s += 0.75 * g * g / (Math.pow(x - res, 2) + g * g);
      }
      return Math.min(1.08, s * 0.5);
    };
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 300; i++) {
      const x = (i / 300) * 5;
      pts.push([v.sx(x), v.sy(sig(x))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.8 });
    text(f, 'σ(k)：共振峰=相移过 π 的分波', v.sx(0.2), v.sy(1.05), { color: C.fg, font: '14px serif' });
    text(f, 'Breit-Wigner 峰：核反应/粒子共振的标准形状', v.sx(0.2), v.sy(0.95), { color: C.yellow, font: '13px serif' });
    text(f, 'k', (v.sx(0) + v.sx(5)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'σ (归一)', v.sx(0.2), v.sy(1.1), { color: C.dim, font: '12px serif' });
    // 底部
    text(f, `σ = (4π/k²) Σ_l (2l+1) sin²δ_l　（当前 l ≤ ${lmax}）`, 56, h - 116, { color: C.yellow, font: '16px serif' });
    text(f, '低能散射只看 s 波（l=0）：核力、超冷原子实验的极简图像', 56, h - 86, { color: C.fg, font: '14px sans-serif' });
    footnotes(f, [
      '分波法=把平面波按角动量展开：每个 l 独立散射，只差一个相移 δ_l',
      '共振散射：δ_l 穿过 π/2 ⇒ 该分波贡献最大（复合核能级的信号）',
      '相移确定 ⇒ 截面、角分布、极化全部导出 —— 散射问题的完备解',
    ]);
    heading(f, '相移一确定，截面全到手');
  },
});
registerViz(phaseShiftScattering);

/** P518 平均场与哈特里-福克。 */
const hartreeFockMeanField = defineViz({
  slug: 'hartree-fock-mean-field',
  title: '平均场与哈特里-福克',
  params: { iteration: { type: 'range', min: 0, max: 100, default: 50, step: 5, label: '自洽迭代 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const prog = num(params, 'iteration', 50) / 100;
    clear(f);
    // 左：自洽循环图
    const cx = w * 0.26, cy = h * 0.44, R = 120;
    const nodes = [
      ['试探 φ⁽⁰⁾', C.cool],
      ['解单体方程', C.accent],
      ['得新 φ⁽ⁿ⁺¹⁾', C.green],
      ['算密度 ρ', C.warm],
    ] as Array<[string, string]>;
    nodes.forEach(([name, color], i) => {
      const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.8;
      circle(f, x, y, 52, { fill: 'rgba(45,55,72,0.92)', stroke: color, lw: 2.4 });
      text(f, name, x, y + 4, { align: 'center', color, font: '13px sans-serif' });
      const a2 = ((i + 1) / 4) * Math.PI * 2 - Math.PI / 2;
      const x2 = cx + Math.cos(a2) * R, y2 = cy + Math.sin(a2) * R * 0.8;
      const ang = Math.atan2(y2 - y, x2 - x);
      const mx = (x + x2) / 2, my = (y + y2) / 2;
      poly(f, [[mx + Math.cos(ang) * 10, my + Math.sin(ang) * 10],
        [mx + Math.cos(ang + 2.6) * 12, my + Math.sin(ang + 2.6) * 12],
        [mx + Math.cos(ang - 2.6) * 12, my + Math.sin(ang - 2.6) * 12]], { fill: C.dim });
    });
    const lit = prog;
    text(f, `自洽收敛度 ${(lit * 100).toFixed(0)}%`, cx, cy - 8, { align: 'center', color: C.yellow, font: '15px sans-serif' });
    text(f, '收敛判据：ΔE < ε 且 Δρ < δ', cx, cy + 20, { align: 'center', color: C.dim, font: '12px sans-serif' });
    // 右：单体方程与交换项
    const bx = w * 0.55;
    text(f, '平均场思想：', bx, 96, { color: C.fg, font: '17px sans-serif' });
    text(f, '每个粒子在"其余粒子的平均密度"里单体运动', bx, 130, { color: C.cool, font: '15px sans-serif' });
    text(f, 'Ĥ_F φᵢ = εᵢ φᵢ（哈特里-福克方程）', bx, 184, { color: C.yellow, font: '16px serif' });
    text(f, '库仑项：∫ρ(r\')/|r−r\'| dr\'（Hartree，直接项）', bx, 228, { color: C.green, font: '15px serif' });
    text(f, '交换项：−∫ρ(r,r\')P/r　（Fock，全同粒子专属）', bx, 264, { color: C.hot, font: '15px serif' });
    text(f, '交换项=泡利排斥的平均场化身（费米洞）', bx, 300, { color: C.dim, font: '14px sans-serif' });
    // 能量随迭代
    const gy = h - 120;
    const gx0 = bx, gx1 = w - 60;
    seg(f, gx0, gy, gx1, gy, C.grid, 1.4);
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      pts.push([gx0 + t * (gx1 - gx0), gy - 70 * (1 - Math.exp(-t * 4.5))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.6 });
    dot(f, gx0 + prog * (gx1 - gx0), gy - 70 * (1 - Math.exp(-prog * 4.5)), 7, C.hot);
    text(f, '能量随迭代单调下降并收敛（变分性质保证）', gx0, gy + 24, { color: C.fg, font: '14px sans-serif' });
    text(f, 'HF 是后续 CI/MP2/DFT 的出发点 —— 量子化学的高速公路入口', gx0, gy + 50, { color: C.yellow, font: '14px sans-serif' });
    footnotes(f, [
      '多体波函数 N! 项不可承受 ⇒ 平均场把 N 体拆成 N 个单体（独立粒子近似）',
      'Slater 行列式自动满足反对易：交换项由此而来（Hartree 方法没有它）',
      '误差来源=关联能：HF 丢掉的"粒子间躲闪"由后哈特里方法补回',
    ]);
    heading(f, '多体问题的第一近似');
  },
});
registerViz(hartreeFockMeanField);

/** P519 拉比振荡与两能级系统。 */
const rabiOscillation = defineViz({
  slug: 'rabi-oscillation',
  title: '拉比振荡与两能级系统',
  params: { detune: { type: 'range', min: -5, max: 5, default: 0, step: 0.5, label: '失谐 Δ/Ω' } },
  draw: (f) => {
    const { w, h, params } = f;
    const delta = num(params, 'detune', 0);
    clear(f);
    // 左：两能级+驱动
    const cx = w * 0.24;
    seg(f, cx - 130, h * 0.3, cx + 130, h * 0.3, C.cool, 3.4);
    seg(f, cx - 130, h * 0.62, cx + 130, h * 0.62, C.cool, 3.4);
    text(f, '|e⟩ (激发)', cx - 126, h * 0.3 - 14, { color: C.cool, font: '14px serif' });
    text(f, '|g⟩ (基态)', cx - 126, h * 0.62 + 26, { color: C.cool, font: '14px serif' });
    // 驱动场（波浪）
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 200; i++) {
      const x = cx - 130 + (i / 200) * 260;
      pts.push([x, h * 0.46 + Math.sin(i * 0.35 - f.t * 6) * 18]);
    }
    poly(f, pts, { stroke: C.yellow, lw: 2.4 });
    text(f, `驱动 Ω，失谐 Δ = ${delta.toFixed(1)}Ω`, cx - 130, h * 0.46 + 52, { align: 'center', color: C.yellow, font: '14px serif' });
    // 粒子在两能级间跳
    const prob = (() => {
      const R = Math.sqrt(1 + delta * delta);
      return (1 / (1 + delta * delta)) * Math.pow(Math.sin(f.t * R * 1.2), 2);
    })();
    const py = h * 0.62 - prob * (h * 0.32);
    dot(f, cx + 60, py, 10, C.hot);
    // 右：占据概率随时间
    const v = view(f, { xMin: 0, xMax: 12, yMin: 0, yMax: 1.1, inset: w * 0.46, insetRight: 46, insetBottom: 46 });
    grid(f, v);
    const pe: Array<[number, number]> = [];
    for (let i = 0; i <= 300; i++) {
      const t = (i / 300) * 12;
      const R = Math.sqrt(1 + delta * delta);
      pe.push([v.sx(t), v.sy((1 / (1 + delta * delta)) * Math.pow(Math.sin(t * R * 0.9), 2))]);
    }
    poly(f, pe, { stroke: C.hot, lw: 2.8 });
    // 满足共振时最大值 1
    const maxP = 1 / (1 + delta * delta);
    seg(f, v.sx(0), v.sy(maxP), v.sx(12), v.sy(maxP), `${C.green}aa`, 1.4);
    text(f, `翻转效率上限 = 1/(1+(Δ/Ω)²) = ${(maxP * 100).toFixed(0)}%`, v.sx(0.4), v.sy(Math.min(1.06, maxP + 0.08)), { color: C.green, font: '14px serif' });
    text(f, 't', (v.sx(0) + v.sx(12)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'P_e（激发态占据）', v.sx(0.4), v.sy(1.06), { color: C.dim, font: '12px sans-serif' });
    text(f, delta === 0 ? '共振（Δ=0）：100% 完全倒转 —— π 脉冲 = 量子比特翻转' : `失谐：振荡幅度打折，相位也偏 —— 需要复合脉冲校正`,
      56, h - 116, { color: C.yellow, font: '15px sans-serif' });
    text(f, '广义拉比频率 Ω_R = √(Ω²+Δ²)：失谐越大转得越快但翻不满', 56, h - 86, { color: C.fg, font: '14px sans-serif' });
    footnotes(f, [
      '两能级+单色驱动的精确解：概率在 0/1 间正弦振荡（Rabi 1937 分子束实验）',
      '量子计算的门操作=控制 Ω 与 Δ 的脉冲序列（Ramsey、spin echo 同源）',
      '与受迫共振经典对应：共振吸收、NMR/ESR 峰、光学 Bloch 方程',
    ]);
    heading(f, '量子比特翻转的物理原型');
  },
});
registerViz(rabiOscillation);