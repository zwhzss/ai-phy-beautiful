import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text, view, grid, curve, circle, vec, rng, gaussians } from '../canvas';

/** P494 麦克斯韦速率分布。 */
const speedDistributionDerivation = defineViz({
  slug: 'speed-distribution-derivation',
  title: '麦克斯韦速率分布',
  params: { T: { type: 'range', min: 100, max: 1000, default: 300, step: 50, label: '温度 T (K)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const T = num(params, 'T', 300);
    clear(f);
    const v = view(f, { xMin: 0, xMax: 2500, yMin: 0, yMax: 1.15, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 分布族（三个温度对比）
    const mk = (temp: number) => (x: number) => {
      const a = Math.sqrt(2 / Math.PI) * Math.pow(1.67e-27 / (2 * 1.38e-23 * temp), 1.5);
      const val = a * x * x * Math.exp((-1.67e-27 * x * x) / (2 * 1.38e-23 * temp)) * 1e-9;
      return Math.min(1.1, val * 3.2e18);
    };
    const curves: Array<[number, string]> = [[150, C.cool], [T, C.accent], [600, C.hot]];
    for (const [temp, color] of curves) {
      const fn = mk(temp);
      const pts: Array<[number, number]> = [];
      for (let i = 1; i <= 300; i++) {
        const x = (i / 300) * 2500;
        pts.push([v.sx(x), v.sy(Math.min(1.1, fn(x)))]);
      }
      poly(f, pts, { stroke: color, lw: temp === T ? 3 : 1.6, dash: temp === T ? undefined : [6, 5] });
      // 最概然速率标注
      const vp = Math.sqrt(2 * 1.38e-23 * temp / 1.67e-27);
      if (vp < 2500) {
        dot(f, v.sx(vp), v.sy(Math.min(1.1, fn(vp))), 5, color);
        text(f, `v_p(${temp}K)=${vp.toFixed(0)}`, v.sx(vp) + 6, v.sy(Math.min(1.1, fn(vp))) - 8, { color, font: '11px serif' });
      }
    }
    text(f, 'f(v)dv：单位速率区间的概率（归一化面积=1）', v.sx(40), v.sy(1.1), { color: C.fg, font: '13px serif' });
    text(f, 'v (m/s)', (v.sx(0) + v.sx(2500)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'f(v)', v.sx(40), v.sy(0.6), { color: C.dim, font: '12px sans-serif' });
    // 三种特征速率
    const vp = Math.sqrt(2 * 1.38e-23 * T / 1.67e-27);
    const vavg = Math.sqrt(8 * 1.38e-23 * T / (Math.PI * 1.67e-27));
    const vrms = Math.sqrt(3 * 1.38e-23 * T / 1.67e-27);
    text(f, `v_p : v_avg : v_rms = √2 : √(8/π) : √3 = 1 : 1.128 : 1.225`, 52, h - 116, { color: C.yellow, font: '15px serif' });
    text(f, `T=${T}K（空气）：v_p=${vp.toFixed(0)}　v_avg=${vavg.toFixed(0)}　v_rms=${vrms.toFixed(0)} m/s`, 52, h - 88, { color: C.fg, font: '14px serif' });
    text(f, '推导三步：各向同性速度空间 → 高斯 → 换成球壳 4πv²dv', 52, h - 60, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      'f(v) = 4π(m/2πkT)^{3/2} v² e^(−mv²/2kT)：v² 起步、指数收尾，峰值在 √(2kT/m)',
      '高温曲线右移变矮（归一化守恒）—— 气体"热"在分布形状里',
      '逃逸大气、恒星核聚变、麦克斯韦妖的思想实验都从这条曲线出发',
    ]);
    heading(f, '高斯球壳把分布推成三行');
  },
});
registerViz(speedDistributionDerivation);

/** P495 能量均分定理与自由度冻结。 */
const equipartitionFreeze = defineViz({
  slug: 'equipartition-freeze',
  title: '能量均分定理与自由度冻结',
  params: { molecule: { type: 'select', options: ['单原子 He', '双原子 N₂', '非线性 H₂O'], default: '双原子 N₂', label: '分子' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mol = str(params, 'molecule', '双原子 N₂');
    clear(f);
    const dof: Record<string, [number, number, string]> = {
      '单原子 He': [3, 3, '平动×3（T 无关）'],
      '双原子 N₂': [5, 7, '平动3+转动2（高温加振动2）'],
      '非线性 H₂O': [6, 6, '平动3+转动3（振动常温已冻）'],
    };
    const [fLow, fHigh, note] = dof[mol] ?? dof['双原子 N₂'];
    // C_V(T) 曲线（阶梯：自由度逐级解冻）
    const v = view(f, { xMin: -1, xMax: 5, yMin: 0, yMax: 8.6, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 阶梯函数：log T 轴
    const steps: Array<[number, number]> = [];
    for (let i = 0; i <= 300; i++) {
      const x = -1 + (i / 300) * 6;
      let dofT = 3;
      if (mol !== '单原子 He') {
        dofT = 5;
        if (x > 1.4) dofT = 7;
      } else {
        if (x > 3.5) dofT = 5;
      }
      if (mol === '非线性 H₂O') { dofT = 6; if (x > 2.5) dofT = 9; }
      steps.push([v.sx(x), v.sy(dofT / 2 + 0.2)]);
    }
    poly(f, steps, { stroke: C.accent, lw: 3 });
    // 理想平台参考
    seg(f, v.sx(-1), v.sy(2.5), v.sx(5), v.sy(2.5), `${C.green}88`, 1.6);
    text(f, '单原子 3/2 R', v.sx(-0.9), v.sy(2.7), { color: C.green, font: '13px serif' });
    // 当前温度标记（低温/高温）
    dot(f, v.sx(0.5), v.sy(fLow / 2 + 0.2), 6, C.cool);
    text(f, '常温：f = ' + fLow, v.sx(0.5) + 10, v.sy(fLow / 2 + 0.36), { color: C.cool, font: '13px serif' });
    dot(f, v.sx(4.2), v.sy(fHigh / 2 + 0.2), 6, C.hot);
    text(f, '高温：f = ' + fHigh, v.sx(3.4), v.sy(fHigh / 2 + 0.5), { color: C.hot, font: '13px serif' });
    text(f, 'log₁₀T (K)', (v.sx(-1) + v.sx(5)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'C_V / R（f/2）', v.sx(-0.9), v.sy(8.4), { color: C.dim, font: '12px sans-serif' });
    // 右侧说明
    text(f, mol, w * 0.62, h * 0.24, { color: C.yellow, font: '17px sans-serif' });
    text(f, note, w * 0.62, h * 0.24 + 32, { color: C.fg, font: '14px sans-serif' });
    text(f, '每个二次自由度 → kT/2（动能+势能各算一个）', w * 0.62, h * 0.24 + 76, { color: C.green, font: '15px serif' });
    text(f, 'C_V = f/2·R　C_p = C_V + R　γ = C_p/C_V', w * 0.62, h * 0.24 + 110, { color: C.cool, font: '15px serif' });
    text(f, '振动自由度 ε ≈ kT 才解冻：N₂ 在 ~10⁴K 才给', w * 0.62, h * 0.24 + 154, { color: C.hot, font: '14px sans-serif' });
    footnotes(f, [
      '经典均分：每个 ½mv²、½kx² 项都分到 ½kT —— 等概率原理的直接后果',
      '与实验的偏差（H₂、Cl₂ 比热）是量子化的第一道证据（1912 年前后）',
      'C_V vs C_p：定容不膨胀做功，多出的 R 就是"膨胀的工资"',
    ]);
    heading(f, '量子把自由度一个个冻住');
  },
});
registerViz(equipartitionFreeze);

/** P496 配分函数与热力学量。 */
const partitionFunctionZ = defineViz({
  slug: 'partition-function-z',
  title: '配分函数与热力学量',
  params: { levels: { type: 'range', min: 2, max: 8, default: 4, step: 1, label: '能级数' } },
  draw: (f) => {
    const { w, h, params } = f;
    const N = Math.round(num(params, 'levels', 4));
    const kT = 0.7;
    clear(f);
    // 左：能级图与玻尔兹曼权重
    const cx = w * 0.26;
    let Z = 0;
    const weights: number[] = [];
    for (let n = 0; n < N; n++) {
      const E = n * 0.9;
      const wgt = Math.exp(-E / kT);
      weights.push(wgt);
      Z += wgt;
    }
    for (let n = 0; n < N; n++) {
      const y = h * 0.72 - n * 52;
      const p = weights[n] / Z;
      const barW = p * 220;
      seg(f, cx - 90, y, cx + 90, y, C.cool, 3);
      text(f, `E${n}=${(n * 0.9).toFixed(1)}`, cx - 148, y + 5, { color: C.cool, font: '13px serif' });
      poly(f, [[cx + 110, y - 9], [cx + 110 + barW, y - 9], [cx + 110 + barW, y + 9], [cx + 110, y + 9]],
        { fill: `rgba(72,187,120,${0.4 + p})` });
      text(f, `p=${p.toFixed(3)}`, cx + 120 + barW, y + 5, { color: C.green, font: '12px serif' });
    }
    text(f, 'Z = Σ e^(−Eᵢ/kT)', cx - 90, 76, { color: C.yellow, font: '17px serif' });
    text(f, `当前 Z = ${Z.toFixed(3)}（kT=${kT}）`, cx - 90, 106, { color: C.fg, font: '15px serif' });
    text(f, 'pᵢ = e^(−Eᵢ/kT)/Z：归一化的玻尔兹曼权重', cx - 90, h * 0.72 + 44, { color: C.cool, font: '14px serif' });
    // 右：从 Z 求一切
    const bx = w * 0.55;
    const rows = [
      ['F = −kT lnZ', '亥姆霍兹自由能', C.yellow],
      ['U = −∂lnZ/∂β', '内能（能量平均）', C.cool],
      ['S = (U−F)/T', '熵（能量-自由能差）', C.green],
      ['C_V = ∂U/∂T', '热容（U 对 T 求导）', C.warm],
      ['P = kT ∂lnZ/∂V', '压强（体积方向的力）', C.hot],
    ] as Array<[string, string, string]>;
    rows.forEach(([expr, note, color], i) => {
      const y = 96 + i * 64;
      poly(f, [[bx, y], [bx + 330, y], [bx + 330, y + 50], [bx, y + 50]],
        { fill: `${color}1e`, stroke: `${color}aa`, lw: 1.6 });
      text(f, expr, bx + 14, y + 32, { color, font: '16px serif' });
      text(f, note, bx + 210, y + 32, { color: C.dim, font: '13px sans-serif' });
    });
    text(f, '一个 Z，五张工资条 —— 统计力学的记账中枢', bx, 96 + 5 * 64 + 16, { color: C.fg, font: '15px sans-serif' });
    footnotes(f, [
      'Z 是"概率分配的分母"：所有热力学量都是 lnZ 的导数（自由能原理）',
      '熵 S = k(lnZ + βU)：微观状态数的宏观读法，与 S=k lnW 一致',
      '巨正则系综 Ξ 给粒子数涨落；正则 vs 微正则的等价性=统计力学基础问题',
    ]);
    heading(f, '对 lnZ 求导领工资');
  },
});
registerViz(partitionFunctionZ);

/** P497 玻尔兹曼熵公式。 */
const boltzmannEntropyFormula = defineViz({
  slug: 'boltzmann-entropy-formula',
  title: '玻尔兹曼熵公式',
  params: { box: { type: 'range', min: 1, max: 10, default: 4, step: 1, label: '小球数 n' } },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'box', 4));
    clear(f);
    // 左：盒子分成 2^n 个小格，n 个球的分布
    const bx = 60, by = 100, bw = w * 0.42, bh = h * 0.44;
    poly(f, [[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]], { stroke: C.grid, lw: 2 });
    const cellsN = 16;
    for (let i = 1; i < cellsN; i++) {
      seg(f, bx + (i / cellsN) * bw, by, bx + (i / cellsN) * bw, by + bh, `${C.grid}88`, 1);
    }
    // 随机放 n 个球（确定性种子）
    const rand = rng(11 + n);
    const placed: number[] = [];
    for (let i = 0; i < n; i++) {
      const cell = Math.floor(rand() * cellsN);
      placed.push(cell);
      const count = placed.filter((c) => c === cell).length - 1;
      dot(f, bx + (cell + 0.5) * (bw / cellsN), by + bh * (0.3 + count * 0.28), 10, C.warm);
    }
    text(f, `${n} 个球放进 ${cellsN} 格`, bx, by - 14, { color: C.fg, font: '15px sans-serif' });
    // 微观态计数
    const W = Math.pow(cellsN, n);
    // 最概然（均匀）微观态数 = n! / Πnᵢ!
    const factorial = (m: number): number => { let r = 1; for (let i = 2; i <= m; i++) r *= i; return r; };
    const per = Math.floor(n / cellsN);
    const Wmax = factorial(n) / Math.pow(factorial(per), cellsN);
    text(f, `总微观态 Ω = 16^${n} = ${W.toExponential(2)}`, bx, by + bh + 34, { color: C.cool, font: '15px serif' });
    text(f, `最概然（均匀）构型数 ≈ ${Wmax.toExponential(2)}`, bx, by + bh + 64, { color: C.green, font: '15px serif' });
    text(f, `W_max/Ω = ${((Wmax / W) * 100).toFixed(1)}% —— 不均匀才怪`, bx, by + bh + 94, { color: C.hot, font: '15px sans-serif' });
    // 右：熵随规模
    const v = view(f, { xMin: 0, xMax: 12, yMin: 0, yMax: 10, inset: w * 0.52, insetRight: 46, insetBottom: 46 });
    grid(f, v);
    curve(f, v, (x) => x * 0.85, { color: C.accent, lw: 2.8 });
    text(f, 'S = k lnW', v.sx(1), v.sy(9.4), { color: C.yellow, font: '17px serif' });
    text(f, '熵 ∝ ln(微观态数)：每多一个二进制选择 +k ln2', v.sx(0.3), v.sy(8.6), { color: C.fg, font: '13px serif' });
    text(f, '香农熵 H = −Σp lnp 与它同形（信息=负熵的争议延续百年）', v.sx(0.3), v.sy(1.2), { color: C.cool, font: '13px serif' });
    text(f, 'n (选择位数)', (v.sx(0) + v.sx(12)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      'S = k_B lnW（墓志铭公式）：宏观温度是微观计数的对数读数',
      '等概率假设=最大熵原理的起点：没有理由偏向任何一个微观态',
      '涨落 ~1/√W：宏观熵减的概率小到宇宙年龄乘以万亿倍也不够 —— 第二定律的统计必然',
    ]);
    heading(f, '一个墓志铭式公式');
  },
});
registerViz(boltzmannEntropyFormula);

/** P498 热机效率与卡诺上限。 */
const heatEngineEfficiency = defineViz({
  slug: 'heat-engine-efficiency',
  title: '热机效率与卡诺上限',
  params: { TH: { type: 'range', min: 300, max: 1200, default: 600, step: 50, label: '高温热源 T_H (K)' }, TL: { type: 'range', min: 250, max: 500, default: 300, step: 10, label: '低温热源 T_L (K)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const TH = num(params, 'TH', 600), TL = num(params, 'TL', 300);
    const etaCarnot = 1 - TL / TH;
    clear(f);
    // 上：热机示意（两热源+机器）
    const cx = w * 0.5;
    poly(f, [[cx - 260, 70], [cx + 260, 70], [cx + 260, 116], [cx - 260, 116]], { fill: 'rgba(245,101,101,0.6)' });
    text(f, `高温热源 T_H = ${TH} K`, cx, 100, { align: 'center', color: C.fg, font: '15px sans-serif' });
    poly(f, [[cx - 260, 320], [cx + 260, 320], [cx + 260, 366], [cx - 260, 366]], { fill: 'rgba(66,153,225,0.6)' });
    text(f, `低温热源 T_L = ${TL} K`, cx, 350, { align: 'center', color: C.fg, font: '15px sans-serif' });
    circle(f, cx, 220, 62, { fill: 'rgba(45,55,72,0.9)', stroke: C.yellow, lw: 2.6 });
    text(f, '热机', cx, 216, { align: 'center', color: C.yellow, font: '15px sans-serif' });
    text(f, 'η', cx, 244, { align: 'center', color: C.green, font: '16px serif' });
    // 热流箭头（宽度按能量分配）
    const QinW = 60;
    const QoutW = 60 * (1 - etaCarnot);
    const workW = 60 * etaCarnot;
    vec(f, cx - 120, 116, cx - 120, 162, C.hot, QinW / 8, 26);
    text(f, `Q_H = 100%`, cx - 96, 148, { color: C.hot, font: '14px serif' });
    vec(f, cx + 120, 278, cx + 120, 320, C.cool, QoutW / 8, 24);
    text(f, `Q_L = ${((1 - etaCarnot) * 100).toFixed(0)}%`, cx + 140, 306, { color: C.cool, font: '14px serif' });
    vec(f, cx + 62, 220, cx + 200, 220, C.green, workW / 6, 24);
    text(f, `W = ${(etaCarnot * 100).toFixed(0)}%`, cx + 214, 216, { color: C.green, font: '15px serif' });
    // 卡诺上限读数
    const bx = 60;
    text(f, `卡诺效率 η_C = 1 − T_L/T_H = ${(etaCarnot * 100).toFixed(1)}%`, bx, h - 148, { color: C.yellow, font: '17px serif' });
    text(f, '实际热机 η < η_C（摩擦、非等温、不可逆…差距=改进空间）', bx, h - 118, { color: C.fg, font: '14px sans-serif' });
    text(f, `例：燃煤电厂 T_H≈850K T_L≈300K ⇒ 上限 65%，实际 ~45%`, bx, h - 88, { color: C.cool, font: '14px sans-serif' });
    text(f, '提高效率两条路：抬 T_H（材料极限）或压 T_L（环境温度=硬约束）', bx, h - 58, { color: C.hot, font: '14px sans-serif' });
    footnotes(f, [
      '卡诺定理：同两热源间任何热机 η ≤ 1 − T_L/T_H，等号仅可逆',
      '开尔文表述的来源：T_L 不可为绝对零度（第三定律的前奏）',
      '温标本身由卡诺循环定义（热力学温标）—— 效率反过来定义温度',
    ]);
    heading(f, '效率竞赛的终点线');
  },
});
registerViz(heatEngineEfficiency);

/** P499 制冷循环与制冷系数。 */
const refrigerationCop = defineViz({
  slug: 'refrigeration-cop',
  title: '制冷循环与制冷系数',
  params: { TH: { type: 'range', min: 280, max: 330, default: 300, step: 5, label: '室内 T_H (K)' }, TL: { type: 'range', min: 230, max: 290, default: 260, step: 5, label: '室外 T_L (K)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const TH = num(params, 'TH', 300), TL = num(params, 'TL', 260);
    const cop = TL / (TH - TL);
    clear(f);
    // 热泵方向图（与热机相反）
    const cx = w * 0.42;
    poly(f, [[cx - 220, 76], [cx + 220, 76], [cx + 220, 118], [cx - 220, 118]], { fill: 'rgba(66,153,225,0.6)' });
    text(f, `被冷却对象 T_L = ${TL} K（冰箱内）`, cx, 104, { align: 'center', color: C.fg, font: '15px sans-serif' });
    poly(f, [[cx - 220, 316], [cx + 220, 316], [cx + 220, 358], [cx - 220, 358]], { fill: 'rgba(245,101,101,0.6)' });
    text(f, `放热环境 T_H = ${TH} K（厨房）`, cx, 344, { align: 'center', color: C.fg, font: '15px sans-serif' });
    circle(f, cx, 216, 64, { fill: 'rgba(45,55,72,0.9)', stroke: C.cool, lw: 2.6 });
    text(f, '压缩机', cx, 212, { align: 'center', color: C.cool, font: '14px sans-serif' });
    text(f, '逆卡诺', cx, 236, { align: 'center', color: C.dim, font: '12px sans-serif' });
    // 逆向热流（Q_L 从冷→机，Q_H 从机→热）
    vec(f, cx - 140, 118, cx - 140, 170, C.cool, 5, 22);
    text(f, 'Q_L（吸热）', cx - 124, 152, { color: C.cool, font: '14px serif' });
    vec(f, cx + 140, 266, cx + 140, 316, C.hot, 7, 24);
    text(f, 'Q_H（放热）', cx + 160, 300, { color: C.hot, font: '14px serif' });
    vec(f, cx - 64, 216, cx - 170, 216, C.green, 4, 20);
    text(f, 'W 电费', cx - 250, 212, { color: C.green, font: '14px serif' });
    // 读数
    const bx = w * 0.7;
    text(f, 'COP = Q_L/W = T_L/(T_H−T_L)', bx, 110, { color: C.fg, font: '16px serif' });
    text(f, `当前 COP = ${cop.toFixed(1)}`, bx, 156, { color: C.yellow, font: '22px serif' });
    text(f, '（搬走 1 J 冷量只花 1/COP J 电）', bx, 190, { color: C.dim, font: '14px sans-serif' });
    text(f, cop > 3 ? '温差小 ⇒ 高效（热泵供暖 COP 3~5）' : '温差大 ⇒ 吃力（酷夏空调费电）', bx, 232, { color: C.cool, font: '14px sans-serif' });
    text(f, '注意：COP 不是效率，可以 >1', bx, 274, { color: C.hot, font: '15px sans-serif' });
    text(f, '因为 W 只是"搬运费"，热量本身不要钱', bx, 304, { color: C.dim, font: '14px sans-serif' });
    text(f, '热泵供暖：COP_H = T_H/(T_H−T_L) 更高 —— 直接从空气里"提"热', 60, h - 92, { color: C.green, font: '15px sans-serif' });
    text(f, '制冷与供暖是同一台机器：换个方向阀就行（空调制热原理）', 60, h - 62, { color: C.fg, font: '14px sans-serif' });
    footnotes(f, [
      '制冷机=热机倒放：外界做功把热量从低温搬到高温（热力学第二定律允许）',
      'COP 受卡诺上限 T_L/(T_H−T_L) 约束 —— 温差每降 10K 电费差一截',
      '冰箱放热到厨房所以厨房更热：空调室外机为什么吹热风',
    ]);
    heading(f, 'COP 可以大于 1 的原因');
  },
});
registerViz(refrigerationCop);

/** P500 绝热过程与多方过程。 */
const adiabaticPolytropic = defineViz({
  slug: 'adiabatic-polytropic',
  title: '绝热过程与多方过程',
  params: { n: { type: 'range', min: 1, max: 1.7, default: 1.4, step: 0.05, label: '多方指数 n' } },
  draw: (f) => {
    const { w, h, params } = f;
    const nn = num(params, 'n', 1.4);
    clear(f);
    const v = view(f, { xMin: 0.5, xMax: 5, yMin: 0, yMax: 5, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 四条过程线（过同一点 V=2, P=2）
    const processes: Array<[string, number, string]> = [
      ['等温 T=const (n=1)', 1, C.cool],
      ['绝热 (n=γ=1.4)', 1.4, C.hot],
      [`多方 n=${nn.toFixed(2)}`, nn, C.yellow],
      ['等压 (n=0)', 0, C.green],
    ];
    for (const [name, expo, color] of processes) {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 200; i++) {
        const Vx = 0.55 + (i / 200) * 4.4;
        const P = expo === 0 ? 2 : 2 * Math.pow(2 / Vx, expo);
        if (P > 5.2) continue;
        pts.push([v.sx(Vx), v.sy(P)]);
      }
      if (pts.length > 1) poly(f, pts, { stroke: color, lw: name.startsWith('多方') ? 3.2 : 2, dash: name.startsWith('等温') ? [7, 5] : undefined });
    }
    // 当前点
    dot(f, v.sx(2), v.sy(2), 7, C.pink);
    text(f, '共同起点 (V₀, P₀)', v.sx(2) + 10, v.sy(2) - 8, { color: C.pink, font: '13px serif' });
    // 斜率对比标注
    text(f, 'P-V 图斜率：等压 0 < 等温 |1| < 绝热 |γ|', v.sx(0.6), v.sy(4.7), { color: C.fg, font: '14px serif' });
    text(f, '(dP/dV)_绝热 = γ·(dP/dV)_等温：绝热更陡（膨胀时降温更快）', v.sx(0.6), v.sy(4.35), { color: C.hot, font: '13px serif' });
    text(f, 'V (任意单位)', (v.sx(0.5) + v.sx(5)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'P', v.sx(0.55), v.sy(4.85), { color: C.dim, font: '12px sans-serif' });
    // 右下账本
    const bx = w * 0.62;
    text(f, '四过程一览：', bx, h - 176, { color: C.yellow, font: '15px sans-serif' });
    const table = [
      ['等温', 'PV=C', 'ΔU=0, Q=W'],
      ['绝热', 'PV^γ=C', 'Q=0, W=−ΔU'],
      ['等压', 'V/T=C', 'W=PΔV'],
      ['等容', 'P/T=C', 'W=0, Q=ΔU'],
    ];
    table.forEach(([name, rel, note], i) => {
      const y = h - 148 + i * 30;
      text(f, name, bx, y, { color: C.cool, font: '14px sans-serif' });
      text(f, rel, bx + 66, y, { color: C.fg, font: '14px serif' });
      text(f, note, bx + 170, y, { color: C.green, font: '13px sans-serif' });
    });
    footnotes(f, [
      '多方过程 PV^n = C 统一四态：n=0 等压、1 等温、γ 绝热、∞ 等容',
      '绝热指数 γ = Cp/CV（单原子 5/3、双原子 7/5）—— 声速公式里也有它',
      '绝热降温：冰箱膨胀阀、云滴上升凝结、柴油机压燃全靠这条线',
    ]);
    heading(f, '把四种过程画进同一张图');
  },
});
registerViz(adiabaticPolytropic);

/** P501 克劳修斯不等式与熵产。 */
const clausiusInequality = defineViz({
  slug: 'clausius-inequality',
  title: '克劳修斯不等式与熵产',
  params: { path: { type: 'select', options: ['可逆卡诺', '不可逆热机', '自发传热'], default: '不可逆热机', label: '循环' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = str(params, 'path', '不可逆热机');
    clear(f);
    // P-V 循环图
    const v = view(f, { xMin: 0.5, xMax: 5, yMin: 0, yMax: 5, inset: 46, insetBottom: 46 });
    grid(f, v);
    let integral = 0;
    if (mode === '可逆卡诺') {
      // 卡诺循环：两等温+两绝热
      const pts: Array<[number, number]> = [];
      // 等温压缩
      for (let i = 0; i <= 60; i++) { const Vx = 1 + (i / 60); pts.push([v.sx(Vx), v.sy(4 / Vx)]); }
      // 绝热压缩
      for (let i = 0; i <= 40; i++) { const Vx = 2 - (i / 40) * 1; pts.push([v.sx(Vx), v.sy(8 * Math.pow(2 / Vx, 1.4) / 2)]); }
      // 等温膨胀
      for (let i = 0; i <= 60; i++) { const Vx = 2 - (i / 60); pts.push([v.sx(Math.max(1, Vx)), v.sy(4 / Math.max(1, Vx))]); }
      poly(f, pts, { stroke: C.cool, lw: 2.8, fill: 'rgba(66,153,225,0.14)', close: true });
      integral = 0;
      text(f, '可逆循环：∮δQ_rev/T = 0（严格为零）', v.sx(0.6), v.sy(4.7), { color: C.cool, font: '15px serif' });
      text(f, '每一份热在它的温度进出，账目两清', v.sx(0.6), v.sy(4.35), { color: C.dim, font: '13px serif' });
    } else if (mode === '不可逆热机') {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 160; i++) {
        const th = (i / 160) * Math.PI * 2;
        pts.push([v.sx(2.7 + Math.cos(th) * (1.6 + 0.2 * Math.sin(th * 2))), v.sy(2.4 + Math.sin(th) * 1.7)]);
      }
      poly(f, pts, { stroke: C.warm, lw: 2.8, fill: 'rgba(237,137,54,0.15)', close: true });
      integral = -0.35;
      text(f, '不可逆循环：∮δQ/T < 0（欠的账=熵产）', v.sx(0.6), v.sy(4.7), { color: C.hot, font: '15px serif' });
      text(f, '摩擦、有限温差传热、自由膨胀都在这里扣分', v.sx(0.6), v.sy(4.35), { color: C.dim, font: '13px serif' });
    } else {
      // 自发传热
      poly(f, [[v.sx(1), v.sy(1)], [v.sx(2.4), v.sy(1)], [v.sx(2.4), v.sy(3.4)], [v.sx(1), v.sy(3.4)]],
        { fill: 'rgba(245,101,101,0.4)', stroke: C.hot, lw: 2 });
      poly(f, [[v.sx(2.6), v.sy(1)], [v.sx(4), v.sy(1)], [v.sx(4), v.sy(3.4)], [v.sx(2.6), v.sy(3.4)]],
        { fill: 'rgba(66,153,225,0.4)', stroke: C.cool, lw: 2 });
      text(f, 'T_H=400K', v.sx(1.3), v.sy(2.2), { align: 'center', color: C.hot, font: '14px serif' });
      text(f, 'T_L=300K', v.sx(3.1), v.sy(2.2), { align: 'center', color: C.cool, font: '14px serif' });
      vec(f, v.sx(2.4), v.sy(2.2), v.sx(2.6), v.sy(2.2), C.yellow, 4, 14);
      text(f, 'Q 从热到冷自发', v.sx(2.2), v.sy(3.7), { align: 'center', color: C.yellow, font: '13px serif' });
      integral = -0.3;
      text(f, '热流 Q 在 400K 放出、300K 吸回', v.sx(0.6), v.sy(4.7), { color: C.fg, font: '14px serif' });
      text(f, `∮δQ/T = Q/300 − Q/400 = Q·(−1/1200) < 0　⇒ 不可逆`, v.sx(0.6), v.sy(4.35), { color: C.hot, font: '14px serif' });
    }
    text(f, 'V', (v.sx(0.5) + v.sx(5)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'P', v.sx(0.55), v.sy(4.85), { color: C.dim, font: '12px sans-serif' });
    // 底部
    text(f, `∮δQ/T ≤ 0（克劳修斯不等式）　当前 ∮ = ${integral.toFixed(2)}　欠账 = T·σ`, 56, h - 116, { color: C.yellow, font: '16px serif' });
    text(f, '熵产 σ ≥ 0：不可逆程度的定量刻度，σ=0 即可逆极限', 56, h - 86, { color: C.fg, font: '15px sans-serif' });
    text(f, '工程应用：㶲分析（火用）、传热温差优化、永动机判废', 56, h - 56, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '克劳修斯不等式是第二定律的数学形式：可逆取等、不可逆取小于',
      '推论一：不可能造出只从单一热源吸热全变功的机器（第二类永动机判死）',
      '推论二：可逆机效率最高（卡诺定理）—— 两条推论都从这一行积分出发',
    ]);
    heading(f, '可逆得等号，不可逆欠熵债');
  },
});
registerViz(clausiusInequality);

/** P502 麦克斯韦妖与第二定律统计义。 */
const maxwellDemonStatistical = defineViz({
  slug: 'maxwell-demon-statistical',
  title: '麦克斯韦妖与第二定律统计义',
  params: { demon: { type: 'select', options: ['小门关闭', '妖开门', '信息擦除'], default: '妖开门', label: '阶段' } },
  draw: (f) => {
    const { w, h, params } = f;
    const stage = str(params, 'demon', '妖开门');
    clear(f);
    // 左：容器与小门
    const bx = 60, by = 96, bw = w * 0.4, bh = h * 0.5;
    poly(f, [[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]], { stroke: C.grid, lw: 2.4, fill: 'rgba(45,55,72,0.5)' });
    const midx = bx + bw / 2;
    // 分隔与门
    seg(f, midx, by, midx, by + bh * 0.42, C.dim, 4);
    seg(f, midx, by + bh * 0.58, midx, by + bh, C.dim, 4);
    const doorOpen = stage !== '小门关闭';
    if (doorOpen) {
      seg(f, midx, by + bh * 0.42, midx + 30, by + bh * 0.5, C.green, 4);
    } else {
      seg(f, midx, by + bh * 0.42, midx, by + bh * 0.58, C.green, 4);
    }
    // 分子（快红慢蓝）
    const rand = rng(7);
    const speedUp: number[] = [];
    const speedDn: number[] = [];
    for (let i = 0; i < 14; i++) {
      const side = i % 2 === 0;
      const fast = rand() > 0.5;
      const x = bx + 24 + rand() * (bw / 2 - 50) + (side ? bw / 2 + 26 : 0);
      const y = by + 24 + rand() * (bh - 48);
      const col = fast ? C.hot : C.cool;
      if (fast) { if (side) speedUp.push(1); else speedDn.push(1); } else { if (side) speedUp.push(0); else speedDn.push(0); }
      dot(f, x, y, 7, col);
      // 速度箭头
      const dir = rand() > 0.5 ? 1 : -1;
      vec(f, x, y, x + dir * (fast ? 30 : 12), y + (rand() - 0.5) * 14, `${col}aa`, 1.8, 6);
    }
    const leftFast = speedDn.filter((s) => s === 1).length;
    const rightFast = speedUp.filter((s) => s === 1).length;
    text(f, '红=快分子　蓝=慢分子', bx + 10, by - 14, { color: C.fg, font: '13px sans-serif' });
    text(f, stage === '小门关闭' ? '门关闭：左右温度相同（平衡）' :
      stage === '信息擦除' ? '妖只放快的去右、慢的去左 —— 但记住选择要花代价' :
        `门开着：只许快分子过闸 → 右侧快分子 ${rightFast} 个`, bx + 10, by + bh + 30,
      { color: stage === '小门关闭' ? C.cool : C.yellow, font: '15px sans-serif' });
    // 右：结论链
    const rx = w * 0.56;
    const chain = [
      ['妖的花招', '选择性开门 → 温差自发出现？', C.hot],
      ['看似违反', '孤立系熵减了（ΔS < 0）', C.warm],
      ['妖的死穴', '测量+记忆+擦除必须耗散', C.cool],
      ['兰道尔原理', '擦除 1 bit 耗能 ≥ kT ln2', C.green],
      ['账目摆平', '信息熵补回热力学熵，总熵仍增', C.yellow],
    ] as Array<[string, string, string]>;
    chain.forEach(([title, note, color], i) => {
      const y = 96 + i * 68;
      poly(f, [[rx, y], [rx + 340, y], [rx + 340, y + 54], [rx, y + 54]],
        { fill: `${color}14`, stroke: `${color}bb`, lw: 1.8 });
      text(f, title, rx + 14, y + 24, { color, font: '15px sans-serif' });
      text(f, note, rx + 14, y + 46, { color: C.fg, font: '13px sans-serif' });
      if (i < 4) vec(f, rx + 170, y + 54, rx + 170, y + 66, C.dim, 1.6, 6);
    });
    footnotes(f, [
      '1871 年妖精思想实验：把热力学第二定律逼成"统计的"而非"绝对的"',
      'Szilard 引擎（1929）：单分子测量把 k ln2 的信息变成 kT ln2 的功',
      'Bennett (1982) 补完：逻辑不可逆 → 物理不可逆；Landauer (1961) 实验验证擦除发热',
    ]);
    heading(f, '妖精测量分子就要记信息');
  },
});
registerViz(maxwellDemonStatistical);

/** P503 焦耳-汤姆孙效应。 */
const jouleThomsonThrottle = defineViz({
  slug: 'joule-thomson-throttle',
  title: '焦耳-汤姆孙效应',
  params: { T: { type: 'range', min: 150, max: 450, default: 300, step: 10, label: '入口温度 T (K)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const Tin = num(params, 'T', 300);
    clear(f);
    // 左：节流阀示意
    const bx = 60, by = 110;
    poly(f, [[bx, by], [bx + 320, by], [bx + 320, by + 50], [bx, by + 50]], { fill: 'rgba(66,153,225,0.2)', stroke: C.cool, lw: 2 });
    // 多孔塞
    for (let i = 0; i < 8; i++) {
      seg(f, bx + 150, by + 6 + i * 5, bx + 170, by + 6 + i * 5, C.warm, 2.4);
    }
    text(f, '多孔塞（节流）', bx + 132, by - 14, { color: C.warm, font: '14px serif' });
    // 流动粒子
    const rand = rng(19);
    for (let i = 0; i < 10; i++) {
      const t = ((f.t * 0.4 + i / 10) % 1);
      const x = bx + t * 320;
      const post = x > bx + 170;
      const temp = post ? Tin - 18 : Tin;
      const speed = 10 + (temp - 150) / 20;
      dot(f, x, by + 8 + rand() * 34, 5, post ? C.cool : C.hot);
      void speed;
    }
    text(f, `入口 ${Tin} K →（等焓）→ 出口 ${(Tin - 18).toFixed(0)} K（当前工质降温）`, bx, by + 84, { color: C.fg, font: '15px serif' });
    text(f, 'h₁ = h₂：没有热交换、不做轴功 —— 唯一改变的是压强', bx, by + 114, { color: C.yellow, font: '14px sans-serif' });
    // 右：转化曲线（反转曲线）
    const v = view(f, { xMin: 100, xMax: 500, yMin: 0, yMax: 6, inset: w * 0.5, insetRight: 46, insetBottom: 46 });
    grid(f, v);
    // 反转曲线（钟形）
    const inv: Array<[number, number]> = [];
    for (let i = 0; i <= 80; i++) {
      const T = 150 + (i / 80) * 350;
      const P = 5.4 * Math.exp(-Math.pow((T - 280) / 130, 2));
      inv.push([v.sx(T), v.sy(P)]);
    }
    poly(f, inv, { stroke: C.yellow, lw: 2.8 });
    // 冷区/热区
    text(f, '曲线内：制冷（μ>0）', v.sx(230), v.sy(1.4), { color: C.cool, font: '13px serif' });
    text(f, '曲线外：制热（μ<0）', v.sx(380), v.sy(4.4), { color: C.hot, font: '13px serif' });
    dot(f, v.sx(Tin), v.sy(2.4), 7, C.green);
    text(f, `当前 T=${Tin}K`, v.sx(Tin) + 10, v.sy(2.4) - 8, { color: C.green, font: '13px serif' });
    text(f, 'T (K)', (v.sx(100) + v.sx(500)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'P (MPa)', v.sx(110), v.sy(5.8), { color: C.dim, font: '12px sans-serif' });
    text(f, 'μ = (∂T/∂P)_h：反转曲线上 μ=0', v.sx(110), v.sy(5.3), { color: C.yellow, font: '13px serif' });
    // 底部
    text(f, '理想气体 μ_JT ≡ 0：降温靠的是分子间作用力（范德瓦尔斯 a 项）', 60, h - 116, { color: C.fg, font: '15px sans-serif' });
    text(f, '室温下 He/H₂ 的反转曲线在低温 —— 先预冷才能液化（林德工艺）', 60, h - 86, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '节流过程（等焓）：绝热、无轴功、只改变阀前后压强 —— 最"经济"的降温手段',
      '转折温度：μ_JT 由正转负的分界，由气体的状态方程决定',
      '应用：空调制冷循环的膨胀阀、空气液化、氦低温恒温器',
    ]);
    heading(f, '焓不变却能降温');
  },
});
registerViz(jouleThomsonThrottle);

/** P504 临界现象与临界指数。 */
const criticalExponents = defineViz({
  slug: 'critical-exponents',
  title: '临界现象与临界指数',
  params: { t: { type: 'range', min: -60, max: 60, default: -30, step: 5, label: '约化温度 t×10⁻³' } },
  draw: (f) => {
    const { w, h, params } = f;
    const tt = num(params, 't', -30) / 1000;
    clear(f);
    // 左：P-T 相图与临界点
    const cx = w * 0.26, cy = h * 0.5;
    // 气液共存线
    const coex: Array<[number, number]> = [];
    for (let i = 0; i <= 60; i++) {
      const s = i / 60;
      coex.push([cx - 150 + s * 190, cy - 120 + s * 130 - Math.pow(s, 2) * 8]);
    }
    poly(f, coex, { stroke: C.cool, lw: 2.6 });
    dot(f, cx + 40, cy - 90, 8, C.hot);
    text(f, '临界点 (T_c, P_c)', cx + 54, cy - 94, { color: C.hot, font: '14px serif' });
    text(f, '气液共存线', cx - 146, cy - 40, { color: C.cool, font: '13px serif' });
    text(f, '↑ 线上两相共存；过临界点后气液不可分', cx - 146, cy - 14, { color: C.dim, font: '13px sans-serif' });
    text(f, 'CO₂ 临界点 31°C / 7.38 MPa：超临界萃取咖啡因', cx - 146, cy + 120, { color: C.green, font: '13px sans-serif' });
    // 右：序参量随 t 的幂律
    const v = view(f, { xMin: -0.06, xMax: 0.06, yMin: 0, yMax: 1.1, inset: w * 0.5, insetRight: 46, insetBottom: 46 });
    grid(f, v);
    const beta = 0.326;
    const order = (t: number) => (t < 0 ? Math.pow(-t / 0.06, beta) : 0);
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 120; i++) {
      const t = -0.06 + (i / 120) * 0.12;
      pts.push([v.sx(t), v.sy(order(t))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 3 });
    dot(f, v.sx(tt), v.sy(order(tt)), 7, C.yellow);
    text(f, `|t|<1 时 序参量 ~ |t|^β，β = 0.326（三维伊辛）`, v.sx(-0.058), v.sy(1.05), { color: C.fg, font: '13px serif' });
    text(f, `当前 t = ${tt.toFixed(3)}　序参量 = ${order(tt).toFixed(3)}`, v.sx(-0.058), v.sy(0.95), { color: C.yellow, font: '13px serif' });
    text(f, 't = (T−T_c)/T_c', (v.sx(-0.06) + v.sx(0.06)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'ρ_液 − ρ_气', v.sx(-0.056), v.sy(1.08), { color: C.dim, font: '12px sans-serif' });
    // 底部：普适性
    text(f, '临界指数：β≈0.326　γ≈1.24　ν≈0.63　α≈0.11（三维伊辛）', 60, h - 116, { color: C.yellow, font: '16px serif' });
    text(f, '普适性：水、铁、聚合物的指数竟然相同 —— 只与维度/对称性有关', 60, h - 86, { color: C.fg, font: '14px sans-serif' });
    text(f, '重正化群（Wilson 1972 诺奖）：不同微观模型流向同一不动点', 60, h - 56, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '临界点处关联长度 ξ→∞：微观细节被"抹掉"，只剩对称性与维度说了算',
      '标度律 α+2β+γ=2 等：指数之间不独立 —— 一套数描述所有热力学量',
      '应用：合金有序-无序转变、磁性材料居里点、聚合物溶液 θ 点',
    ]);
    heading(f, '与物质身份无关的一组数');
  },
});
registerViz(criticalExponents);

/** P505 量子统计的经典极限。 */
const quantumStatisticsLimit = defineViz({
  slug: 'quantum-statistics-limit',
  title: '量子统计的经典极限',
  params: { deg: { type: 'range', min: -3, max: 1, default: -1, step: 0.1, label: 'log₁₀(e^μ/kT)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const logA = num(params, 'deg', -1);
    const a = Math.pow(10, logA); // e^(μ/kT)
    clear(f);
    const v = view(f, { xMin: 0, xMax: 5, yMin: 0, yMax: 2.4, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 三种分布（对数纵轴近似：直接画数值）
    const fd = (x: number) => 1 / (Math.exp(x) / a + 1);
    const be = (x: number) => 1 / (Math.exp(x) / a - 1.0000001);
    const mb = (x: number) => a * Math.exp(-x);
    const curves: Array<[string, (x: number) => number, string]> = [
      ['FD（费米）', fd, C.cool],
      ['BE（玻色）', be, C.hot],
      ['MB（经典）', mb, C.green],
    ];
    for (const [name, fn, color] of curves) {
      const pts: Array<[number, number]> = [];
      for (let i = 1; i <= 300; i++) {
        const x = (i / 300) * 5;
        const val = fn(x);
        if (!Number.isFinite(val) || val < 0) continue;
        if (val > 2.5) { pts.push([v.sx(x), v.sy(2.5)]); break; }
        pts.push([v.sx(x), v.sy(val)]);
      }
      poly(f, pts, { stroke: color, lw: 2.6 });
      text(f, name, v.sx(3.4), v.sy(Math.min(2.3, fn(3.4) + 0.12)), { color, font: '13px serif' });
    }
    // 重合区标注
    text(f, a < 0.2
      ? 'e^μ/kT ≪ 1：三条线重合 ⇒ 量子统计退化为玻尔兹曼'
      : 'e^μ/kT → 1：量子效应显形（BE 发散=凝聚前兆，FD 饱和=不相容）',
      v.sx(0.2), v.sy(2.32), { color: C.yellow, font: '14px serif' });
    text(f, 'ε/kT', (v.sx(0) + v.sx(5)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, '⟨n(ε)⟩', v.sx(0.15), v.sy(2.35), { color: C.dim, font: '12px sans-serif' });
    // 底部判据
    const bx = 60;
    text(f, `非简并条件：n·λ_th³ ≪ 1（λ_th = h/√(2πmkT)）　当前 e^μ/kT = ${a.toFixed(3)}`, bx, h - 116, { color: C.fg, font: '16px serif' });
    text(f, '室温空气：nλ³ ≈ 10⁻⁶ —— 完全经典，气体动理论随便用', bx, h - 86, { color: C.green, font: '14px sans-serif' });
    text(f, '金属电子：nλ³ ≈ 10² —— 强简并，必须用 FD（比热之谜的答案）', bx, h - 56, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '三种分布只差分母 ±1 与化学势：量子修正的全部内容',
      'MB 是 BE/FD 在 a→0 的共同极限 —— 经典极限=稀薄+高温',
      '简并温度 T_d ∝ n^{2/3}：白矮星电子 T_d~10⁹K（恒星内部永远量子）',
    ]);
    heading(f, '量子统计何时可以忘');
  },
});
registerViz(quantumStatisticsLimit);