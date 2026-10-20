import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text, view, grid, curve, circle, vec, rng } from '../canvas';

/** P450 量子力学公设与算符：五条公设撑起理论。 */
const qmPostulates = defineViz({
  slug: 'qm-postulates',
  title: '量子力学公设与算符',
  params: { step: { type: 'select', options: ['1 态空间', '2 可观测量', '3 测量', '4 演化', '5 全同粒子'], default: '3 测量', label: '公设' } },
  draw: (f) => {
    const { w, h, params } = f;
    const step = String(params['step'] ?? '3 测量');
    clear(f);
    // 左：五条公设列表
    const items = [
      '① 态：希尔伯特空间矢量 |ψ⟩',
      '② 可观测量：厄米算符 Â',
      '③ 测量：本征值随机，概率 |⟨aᵢ|ψ⟩|²',
      '④ 演化：iℏ ∂|ψ⟩/∂t = Ĥ|ψ⟩',
      '⑤ 全同粒子：交换对称/反对称',
    ];
    items.forEach((s, i) => {
      const active = step.startsWith(String(i + 1));
      const y = 90 + i * 52;
      poly(f, [[50, y], [w * 0.46, y], [w * 0.46, y + 40], [50, y + 40]],
        { fill: active ? 'rgba(102,126,234,0.3)' : 'rgba(45,55,72,0.6)', stroke: active ? C.accent : C.grid, lw: active ? 2.2 : 1.2 });
      text(f, s, 62, y + 26, { color: active ? C.fg : C.dim, font: '14px sans-serif' });
    });
    // 右：对应可视化
    const bx = w * 0.54;
    if (step.startsWith('1')) {
      // 叠加态 Bloch 球
      const cx = bx + 130, cy = h * 0.42, R = 100;
      circle(f, cx, cy, R, { stroke: C.cool, lw: 2 });
      const { ctx } = f;
      ctx.save();
      ctx.strokeStyle = `${C.grid}aa`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, R, R * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      const th = f.t * 1.6;
      vec(f, cx, cy, cx + Math.sin(th) * R * 0.9, cy - Math.cos(th) * R * 0.9, C.pink, 3);
      text(f, '|ψ⟩ = α|0⟩ + β|1⟩', bx + 40, 100, { color: C.fg, font: '16px serif' });
      text(f, '|α|² + |β|² = 1', bx + 40, 130, { color: C.cool, font: '15px serif' });
      text(f, '复系数：幅度 + 相位（全局相位无观测意义）', bx + 40, 174, { color: C.dim, font: '13px sans-serif' });
    } else if (step.startsWith('2')) {
      // 厄米矩阵
      const m = [[2, 1 - 0.4], [1 - 0.4, -1]];
      const cell = 62, ox = bx + 80, oy = 130;
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          poly(f, [[ox + c * cell, oy + r * cell], [ox + (c + 1) * cell, oy + r * cell], [ox + (c + 1) * cell, oy + (r + 1) * cell], [ox + c * cell, oy + (r + 1) * cell]],
            { fill: `rgba(102,126,234,${0.15 + Math.abs(m[r][c]) * 0.3})`, stroke: C.grid, lw: 1.4 });
          text(f, m[r][c].toFixed(1), ox + c * cell + cell / 2, oy + r * cell + cell / 2 + 6, { align: 'center', color: C.fg, font: '15px serif' });
        }
      }
      text(f, 'Â = Â†（矩阵转置共轭不变）', bx + 60, 110, { color: C.fg, font: '15px serif' });
      text(f, '⇒ 本征值实数、本征态正交', bx + 60, oy + 2 * cell + 40, { color: C.cool, font: '14px sans-serif' });
      text(f, '动量 p̂ = −iℏ∂/x：微分算符也是算符', bx + 60, oy + 2 * cell + 68, { color: C.dim, font: '13px sans-serif' });
    } else if (step.startsWith('3')) {
      // 投影测量
      const cx = bx + 130, cy = h * 0.4;
      circle(f, cx, cy, 86, { stroke: C.accent, lw: 2.4, fill: 'rgba(102,126,234,0.1)' });
      text(f, '|ψ⟩', cx, cy + 6, { align: 'center', color: C.fg, font: '22px serif' });
      // 三根概率箭头
      const outs = [['|a₁⟩  60%', 0.6, C.cool], ['|a₂⟩  30%', 0.3, C.warm], ['|a₃⟩  10%', 0.1, C.pink]] as Array<[string, number, string]>;
      outs.forEach(([label, p, color], i) => {
        const y = cy - 60 + i * 60;
        vec(f, cx + 90, cy, cx + 210, y, color, 2 + p * 5);
        text(f, label, cx + 220, y + 4, { color, font: '14px serif' });
      });
      text(f, '测量前：确定的 |ψ⟩', bx + 40, cy + 130, { color: C.dim, font: '13px sans-serif' });
      text(f, '测量后：随机落到本征态（波函数坍缩）', bx + 40, cy + 156, { color: C.hot, font: '13px sans-serif' });
      text(f, '系综重复：频率 → |⟨aᵢ|ψ⟩|²（玻恩规则）', bx + 40, cy + 182, { color: C.green, font: '13px sans-serif' });
    } else if (step.startsWith('4')) {
      // 薛定谔方程演化
      const v = view(f, { xMin: -6, xMax: 6, yMin: 0, yMax: 1.4, inset: 46, insetBottom: 46 });
      grid(f, v);
      const t = f.t;
      const pts: [number, number][] = [];
      for (let i = 0; i <= 200; i++) {
        const x = -6 + (i / 200) * 12;
        const amp = Math.exp(-Math.pow((x - 2 * Math.sin(t * 0.5)) / 1.6, 2));
        pts.push([v.sx(x), v.sy(amp * (0.75 + 0.25 * Math.cos(x * 2 - t * 4)))]);
      }
      poly(f, pts, { stroke: C.cool, lw: 2.6 });
      text(f, 'iℏ ∂_t|ψ⟩ = Ĥ|ψ⟩', bx + 60, 108, { color: C.fg, font: '17px serif' });
      text(f, '幺演化：概率守恒、时间可逆', bx + 60, 138, { color: C.cool, font: '14px sans-serif' });
      text(f, '定态解 ψ·e^{−iEt/ℏ}：能量本征态相位匀转', bx + 60, h - 110, { color: C.yellow, font: '13px sans-serif' });
    } else {
      // 全同粒子
      const cx = bx + 130, cy = h * 0.4;
      const p1 = [[cx - 70, cy], [cx + 70, cy]];
      circle(f, p1[0][0], p1[0][1], 20, { fill: 'rgba(66,153,225,0.85)', stroke: C.cool, lw: 2 });
      circle(f, p1[1][0], p1[1][1], 20, { fill: 'rgba(237,137,54,0.85)', stroke: C.warm, lw: 2 });
      text(f, '1', p1[0][0], p1[0][1] + 6, { align: 'center', color: C.bg, font: '15px serif' });
      text(f, '2', p1[1][0], p1[1][1] + 6, { align: 'center', color: C.bg, font: '15px serif' });
      vec(f, cx - 40, cy - 60, cx + 40, cy - 60, C.dim, 2);
      vec(f, cx + 40, cy - 60, cx - 40, cy - 60, C.dim, 2);
      circle(f, cx - 70, cy + 110, 20, { fill: 'rgba(237,137,54,0.85)', stroke: C.warm, lw: 2 });
      circle(f, cx + 70, cy + 110, 20, { fill: 'rgba(66,153,225,0.85)', stroke: C.cool, lw: 2 });
      text(f, '交换后波函数 ×(±1)：玻色 +1 / 费米 −1', bx + 40, cy + 180, { color: C.pink, font: '14px serif' });
      text(f, '色标签只标记历史，不是身份 —— 原子全同由构造保证', bx + 40, cy + 206, { color: C.dim, font: '13px sans-serif' });
    }
    footnotes(f, [
      '公设可换等价表述（路径积分、矩阵力学）—— 但测量与概率的来源仍是哲学深水区',
      '算符代数 [x̂, p̂] = iℏ 直接导出不确定性关系，不是实验遗憾而是结构',
      '第 ③ 条（测量）是诠释争论的火药库：坍缩 vs 分支 vs 退相干历史',
    ]);
    heading(f, '五条公设撑起整个理论');
  },
});
registerViz(qmPostulates);

/** P451 狄拉克符号与矩阵表示：内积外积记账法。 */
const diracNotationBraket = defineViz({
  slug: 'dirac-notation-braket',
  title: '狄拉克符号与矩阵表示',
  params: { which: { type: 'select', options: ['内积 ⟨φ|ψ⟩', '外积 |ψ⟩⟨φ|', '表象变换'], default: '内积 ⟨φ|ψ⟩', label: '运算' } },
  draw: (f) => {
    const { w, h, params } = f;
    const which = String(params['which'] ?? '内积 ⟨φ|ψ⟩');
    clear(f);
    const bx = 60;
    if (which.startsWith('内积')) {
      text(f, '⟨φ|ψ⟩ = Σᵢ φᵢ* ψᵢ ∈ ℂ（标量）', bx, 100, { color: C.fg, font: '18px serif' });
      // 两个复矢量柱状图
      const v = view(f, { xMin: -0.5, xMax: 3.5, yMin: -1.4, yMax: 1.4, inset: 46, insetBottom: 46 });
      grid(f, v);
      const phi = [1.0, -0.6, 0.45], psi = [0.6, 0.8, -0.3];
      for (let i = 0; i < 3; i++) {
        const bw = 0.3;
        poly(f, [[v.sx(i - bw), v.sy(0)], [v.sx(i), v.sy(0)], [v.sx(i), v.sy(phi[i])], [v.sx(i - bw), v.sy(phi[i])]],
          { fill: 'rgba(66,153,225,0.65)', stroke: C.cool, lw: 1.4 });
        poly(f, [[v.sx(i), v.sy(0)], [v.sx(i + bw), v.sy(0)], [v.sx(i + bw), v.sy(psi[i])], [v.sx(i), v.sy(psi[i])]],
          { fill: 'rgba(237,137,54,0.65)', stroke: C.warm, lw: 1.4 });
        text(f, phi[i].toFixed(2), v.sx(i - bw / 2), v.sy(phi[i]) + (phi[i] > 0 ? -8 : 16), { align: 'center', color: C.cool, font: '11px serif' });
        text(f, psi[i].toFixed(2), v.sx(i + bw / 2), v.sy(psi[i]) + (psi[i] > 0 ? -8 : 16), { align: 'center', color: C.warm, font: '11px serif' });
      }
      const ip = phi.reduce((s, x, i) => s + x * psi[i], 0);
      text(f, `逐分量相乘再求和 = ${ip.toFixed(3)}`, bx, h - 130, { color: C.yellow, font: '15px serif' });
      text(f, '正交 ⟨φ|ψ⟩=0；归一 ⟨ψ|ψ⟩=1；完备 Σ|aᵢ⟩⟨aᵢ| = 1̂', bx, h - 100, { color: C.cool, font: '14px sans-serif' });
      text(f, '蓝 = ⟨φ|（左矢，取共轭），橙 = |ψ⟩（右矢）', bx, h - 72, { color: C.dim, font: '13px sans-serif' });
    } else if (which.startsWith('外积')) {
      text(f, '|ψ⟩⟨φ| = 矩阵（算符），作用：|ψ⟩⟨φ|χ⟩ = ⟨φ|χ⟩·|ψ⟩', bx, 100, { color: C.fg, font: '16px serif' });
      // 秩 1 矩阵示意
      const cell = 54, ox = bx + 30, oy = 150;
      const psiV = [0.8, -0.5], phiV = [0.6, 0.9];
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          const val = psiV[r] * phiV[c];
          poly(f, [[ox + c * cell, oy + r * cell], [ox + (c + 1) * cell, oy + r * cell], [ox + (c + 1) * cell, oy + (r + 1) * cell], [ox + c * cell, oy + (r + 1) * cell]],
            { fill: `rgba(${val > 0 ? '72,187,120' : '245,101,101'},${0.2 + Math.abs(val) * 0.5})`, stroke: C.grid, lw: 1.4 });
          text(f, val.toFixed(2), ox + c * cell + cell / 2, oy + r * cell + cell / 2 + 6, { align: 'center', color: C.fg, font: '14px serif' });
        }
      }
      text(f, '投影算符 P̂ = |a⟩⟨a|：把 |ψ⟩ 抓到 a 方向', ox + 170, oy + 40, { color: C.cool, font: '14px sans-serif' });
      text(f, 'P̂² = P̂（打两次同一次）', ox + 170, oy + 70, { color: C.green, font: '14px serif' });
      text(f, '密度矩阵 ρ = |ψ⟩⟨ψ| 也是外积', ox + 170, oy + 100, { color: C.pink, font: '14px sans-serif' });
    } else {
      text(f, '同一矢量在不同基下的坐标：|ψ⟩ = Σᵢ cᵢ|eᵢ⟩', bx, 100, { color: C.fg, font: '16px serif' });
      // 旋转基示意
      const cx = w * 0.4, cy = h * 0.5, R = 110;
      circle(f, cx, cy, R, { stroke: C.grid, lw: 1.4, dash: [6, 5] });
      seg(f, cx - R - 16, cy, cx + R + 16, cy, C.cool, 2.4);
      seg(f, cx, cy + R + 16, cx, cy - R - 16, C.cool, 2.4);
      const ang = 0.6 + Math.sin(f.t * 0.8) * 0.25;
      seg(f, cx - Math.cos(ang) * (R + 16), cy - Math.sin(ang) * (R + 16), cx + Math.cos(ang) * (R + 16), cy + Math.sin(ang) * (R + 16), C.warm, 2.4);
      const psiA = -0.8;
      vec(f, cx, cy, cx + Math.cos(psiA) * R * 0.8, cy + Math.sin(psiA) * R * 0.8, C.pink, 3);
      text(f, '|ψ⟩', cx + Math.cos(psiA) * R * 0.9 + 8, cy + Math.sin(psiA) * R * 0.9, { color: C.pink, font: '15px serif' });
      text(f, '|e₁⟩,|e₂⟩（旧基）', cx + R + 24, cy + 4, { color: C.cool, font: '13px serif' });
      text(f, "|e'₁⟩（转 θ）", cx + Math.cos(ang) * (R + 34), cy + Math.sin(ang) * (R + 34), { color: C.warm, font: '13px serif' });
      const c1 = Math.cos(psiA - ang) * 0.8;
      text(f, `新坐标 c' = U†c：旋转矩阵只改账本不改物理`, bx, h - 130, { color: C.yellow, font: '15px serif' });
      text(f, `⟨e'₁|ψ⟩ = ${c1.toFixed(3)}（随基变化的分量）`, bx, h - 100, { color: C.fg, font: '14px serif' });
      text(f, '内积 ⟨ψ|ψ⟩ 在任何基下相同 —— 观测量是不变量', bx, h - 72, { color: C.green, font: '14px sans-serif' });
    }
    footnotes(f, [
      '⟨左|右⟩ 像括号把矢量夹成数 —— 狄拉克 1930 年发明，矩阵力学从此会算',
      '完备性 Σᵢ|eᵢ⟩⟨eᵢ| = 1̂ 是"插入单位算符"技巧的来源（插入求和、挑一项）',
      '表象变换 U：矩阵元 A\' = U†AU —— 对角化 = 选到算符的本征基',
    ]);
    heading(f, '左矢右矢一夹就是内积');
  },
});
registerViz(diracNotationBraket);

/** P452 一阶微扰论：能级移动拆账术。 */
const perturbationFirstOrder = defineViz({
  slug: 'perturbation-first-order',
  title: '一阶微扰论',
  params: { lam: { type: 'range', min: 0, max: 100, default: 40, step: 5, label: '微扰强度 λ' } },
  draw: (f) => {
    const { w, h, params } = f;
    const lam = num(params, 'lam', 40) / 100;
    clear(f);
    // 能级图：未微扰 → 微扰后
    const x0 = w * 0.2, x1 = w * 0.55, x2 = w * 0.85;
    const base = [60, 175, 265]; // n=1,2,3 能级 y
    const shifts = [-34, 26, -16];
    text(f, '未微扰 Eₙ', x0, 74, { align: 'center', color: C.dim, font: '14px sans-serif' });
    text(f, '加 λV', x1, 74, { align: 'center', color: C.hot, font: '14px sans-serif' });
    text(f, '微扰后 Eₙ + λ⟨n|V|n⟩', x2, 74, { align: 'center', color: C.green, font: '14px sans-serif' });
    base.forEach((y, i) => {
      seg(f, x0 - 80, y, x0 + 80, y, C.cool, 3);
      text(f, `n=${i + 1}`, x0 - 108, y + 5, { color: C.cool, font: '13px serif' });
      const dy = shifts[i] * lam;
      // 连接斜线
      seg(f, x0 + 80, y, x2 - 100, y + dy, `${C.grid}aa`, 1.6, );
      seg(f, x2 - 100, y + dy, x2 + 100, y + dy, C.green, 3);
      text(f, `ΔE = ${(shifts[i] * 0.04 * lam).toFixed(2)} eV`, x2 + 108, y + dy + 5, { color: C.green, font: '12px serif' });
      // 标注矩阵元
      if (lam > 0.05) {
        text(f, `⟨${i + 1}|V|${i + 1}⟩`, (x0 + x2) / 2 + 30, y + dy / 2 - 8, { color: C.hot, font: '12px serif' });
      }
    });
    // 底部：公式与适用条件
    text(f, 'Eₙ¹ = ⟨n|V|n⟩（对角元）｜ ψₙ¹ = Σₘ≠ₙ |m⟩⟨m|V|n⟩/(Eₙ−Eₘ)', 60, h - 156, { color: C.fg, font: '16px serif' });
    text(f, '非简并条件：|⟨m|V|n⟩| ≪ |Eₙ−Eₘ|（微扰不能连接近邻能级）', 60, h - 126, { color: C.yellow, font: '14px sans-serif' });
    // Stark 效应示意
    text(f, '例：氢 Stark 效应 —— 电场把 n=2 拆开 ±3eF·a₀', 60, h - 96, { color: C.cool, font: '14px sans-serif' });
    text(f, '简并微扰：先在简并子空间对角化再算（l 混合）', 60, h - 70, { color: C.pink, font: '14px sans-serif' });
    footnotes(f, [
      '微扰论是"拆账"：可解部分 + 小修正 —— 修正量由矩阵元与能级差共同决定',
      '二阶修正恒为负（对基态）⇒ 变分法与微扰论互为印证',
      '发散警报：QED 逐阶展开各阶有限但总和渐近 —— 有效场论的哲学（算到所需精度即可）',
    ]);
    heading(f, '小扰动让能级挪一点');
  },
});
registerViz(perturbationFirstOrder);

/** P453 变分法与近似基态：瑞利商给上界。 */
const variationalMethod = defineViz({
  slug: 'variational-method',
  title: '变分法与近似基态',
  params: { trial: { type: 'range', min: 20, max: 160, default: 80, step: 5, label: '试探波函数宽度 a (pm)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'trial', 80) / 40; // 归一宽度
    clear(f);
    // 左：势阱与试探波函数
    const v = view(f, { xMin: -5, xMax: 5, yMin: -0.2, yMax: 1.6, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 无限深方阱基态（真值）
    curve(f, v, (x) => (Math.abs(x) < 5 ? Math.cos((x * Math.PI) / 10) ** 2 : NaN), { color: C.green, lw: 2.4 });
    // 高斯试探
    curve(f, v, (x) => Math.exp(-(x * x) / (a * a * 0.5)), { color: C.hot, lw: 2.6 });
    text(f, '绿：方阱精确基态', v.sx(-4.8), v.sy(1.5), { color: C.green, font: '12px serif' });
    text(f, '红：高斯试探 ψ_a', v.sx(-4.8), v.sy(1.38), { color: C.hot, font: '12px serif' });
    text(f, 'x', (v.sx(-5) + v.sx(5)) / 2, h - 52, { align: 'center', color: C.dim, font: '12px sans-serif' });
    // 右：瑞利商 E(a) 曲线
    const gx0 = w * 0.62, gy0 = h - 130, gx1 = w - 50, gy1 = 100;
    seg(f, gx0, gy0, gx1, gy0, C.grid, 1.4);
    seg(f, gx0, gy0, gx0, gy1 - 10, C.grid, 1.4);
    const E = (aa: number) => 0.5 * (1 / (aa * aa) * 0.65 + aa * aa * 0.16) + 0.42; // 示意有最小值
    let eMin = 1e9, aMin = 0;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 80; i++) {
      const aa = 0.5 + (i / 80) * 3.5;
      const e = E(aa);
      pts.push([gx0 + ((aa - 0.5) / 3.5) * (gx1 - gx0), gy0 - ((e - 0.4) / 1.6) * (gy0 - gy1)]);
      if (e < eMin) { eMin = e; aMin = aa; }
    }
    poly(f, pts, { stroke: C.accent, lw: 2.6 });
    // 精确值线
    const exact = 0.472;
    seg(f, gx0, gy0 - ((exact - 0.4) / 1.6) * (gy0 - gy1), gx1, gy0 - ((exact - 0.4) / 1.6) * (gy0 - gy1), C.green, 1.8);
    text(f, '精确 E₀', gx1 - 6, gy0 - ((exact - 0.4) / 1.6) * (gy0 - gy1) - 8, { align: 'right', color: C.green, font: '12px serif' });
    // 当前 a
    const cur = E(a);
    const cx = gx0 + ((a - 0.5) / 3.5) * (gx1 - gx0);
    const cy = gy0 - ((cur - 0.4) / 1.6) * (gy0 - gy1);
    dot(f, cx, cy, 6, C.hot);
    text(f, `E(a) = ${cur.toFixed(3)}`, cx + 10, cy - 8, { color: C.hot, font: '13px serif' });
    // 最小值
    const minx = gx0 + ((aMin - 0.5) / 3.5) * (gx1 - gx0);
    const miny = gy0 - ((eMin - 0.4) / 1.6) * (gy0 - gy1);
    dot(f, minx, miny, 6, C.yellow);
    text(f, `变分最优 ${eMin.toFixed(3)} ≥ E₀`, minx - 6, miny + 22, { align: 'right', color: C.yellow, font: '13px serif' });
    text(f, 'a (试探参数)', (gx0 + gx1) / 2, gy0 + 24, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, '瑞利商 E⟨ψ|Ĥ|ψ⟩/⟨ψ|ψ⟩', gx0, gy1 - 24, { color: C.accent, font: '13px serif' });
    text(f, '任何试探态的能量 ≥ 真基态 —— 误差可正不可负', 60, h - 96, { color: C.yellow, font: '15px serif' });
    footnotes(f, [
      '变分原理：⟨E⟩ = Σ|cₙ|²Eₙ ≥ E₀ —— 概率平均必然高于最低能级',
      '氦原子、分子轨道、量子化学：先选好参数形式，再数值极小化（Hartree-Fock 前身）',
      '与微扰论互补：微扰给修正方向，变分给可靠上界',
    ]);
    heading(f, '试波函数算出的能量永远偏高');
  },
});
registerViz(variationalMethod);

/** P454 全同粒子与交换对称：费米与玻色的分水岭。 */
const identicalParticles = defineViz({
  slug: 'identical-particles',
  title: '全同粒子与交换对称',
  params: { kind: { type: 'select', options: ['玻色子 (+1)', '费米子 (−1)'], default: '费米子 (−1)', label: '粒子类型' } },
  draw: (f) => {
    const { w, h, params } = f;
    const fermi = String(params['kind'] ?? '').startsWith('费米');
    clear(f);
    // 左：交换操作示意
    const cx = w * 0.24, cy = h * 0.36;
    const drawPair = (y: number, swapped: boolean, phase: number) => {
      const x1 = swapped ? cx + 70 : cx - 70;
      const x2 = swapped ? cx - 70 : cx + 70;
      circle(f, x1, y, 24, { fill: phase > 0 ? 'rgba(66,153,225,0.85)' : 'rgba(66,153,225,0.5)', stroke: C.cool, lw: 2.4 });
      circle(f, x2, y, 24, { fill: phase > 0 ? 'rgba(237,137,54,0.85)' : 'rgba(237,137,54,0.5)', stroke: C.warm, lw: 2.4 });
      text(f, 'a', x1, y + 6, { align: 'center', color: C.bg, font: '16px serif' });
      text(f, 'b', x2, y + 6, { align: 'center', color: C.bg, font: '16px serif' });
    };
    drawPair(cy, false, 1);
    text(f, '|a b⟩', cx - 170, cy + 6, { color: C.fg, font: '17px serif' });
    vec(f, cx + 110, cy, cx + 180, cy, C.dim, 2.6);
    text(f, 'P̂₁₂', cx + 128, cy - 14, { color: C.dim, font: '14px serif' });
    drawPair(cy + 130, true, fermi ? -1 : 1);
    text(f, fermi ? '|b a⟩ = −|a b⟩' : '|b a⟩ = +|a b⟩', cx - 210, cy + 136, { color: fermi ? C.hot : C.green, font: '17px serif' });
    text(f, 'P̂₁²₂ = 1（交换两次复原）⇒ 本征值 ±1', cx - 210, cy + 200, { color: C.fg, font: '14px serif' });
    // 右：泡利排斥可视化
    const bx = w * 0.54;
    text(f, fermi ? '费米子：同态占据数 0 或 1' : '玻色子：同态可无限聚集', bx, 96, { color: fermi ? C.hot : C.green, font: '16px sans-serif' });
    const rand = rng(fermi ? 17 : 29);
    const levels = 5;
    for (let l = 0; l < levels; l++) {
      const y = 140 + l * 56;
      seg(f, bx, y, bx + 240, y, C.grid, 2);
      text(f, `E${l + 1}`, bx - 34, y + 5, { color: C.dim, font: '13px serif' });
      const occ = fermi ? (l < 3 ? 2 - (l % 2) : 0) : Math.round(rand() * 3.4);
      for (let p = 0; p < occ; p++) {
        const x = bx + 40 + p * 46;
        circle(f, x, y - 12, 10, { fill: p % 2 ? C.warm : C.cool, stroke: C.fg, lw: 1.2 });
      }
      if (fermi && l === 1) text(f, '← 已满，第三个进不来', bx + 250, y - 8, { color: C.hot, font: '13px sans-serif' });
      if (!fermi && l === 0) text(f, '← 挤！玻色凝聚趋势', bx + 250, y - 8, { color: C.green, font: '13px sans-serif' });
    }
    // 分布曲线
    const gy = h - 140;
    const gx0 = bx, gx1 = w - 60;
    seg(f, gx0, gy, gx1, gy, C.grid, 1.4);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 80; i++) {
      const x = i / 80;
      const yv = fermi
        ? 1 / (Math.exp((x - 1) * 6) + 1)
        : 1 / (Math.exp((x - 0.8) * 6) - 1 + 0.02);
      pts.push([gx0 + x * (gx1 - gx0), gy - Math.min(1, yv) * 74]);
    }
    poly(f, pts, { stroke: fermi ? C.cool : C.pink, lw: 2.6 });
    text(f, fermi ? '费米-狄拉克：T→0 时阶梯切在 ε_F' : '玻色-爱因斯坦：低化学势堆积基态', gx0, gy + 24, { color: fermi ? C.cool : C.pink, font: '13px serif' });
    footnotes(f, [
      '全同性是严格量子事实：交换无可观测差别 ⇒ 波函数只能整体 ±1（3D；任意相位只在 2D 编织）',
      '费米子（半整数自旋）泡利不相容 —— 白矮星简并压、元素周期表的物理根源',
      '玻色子（整数自旋）爱因斯坦凝聚 —— 激光相干、超流、超导库珀对（费米子配对后像玻色子）',
    ]);
    heading(f, '交换两个电子什么都不发生');
  },
});
registerViz(identicalParticles);

/** P455 密度矩阵与混合态：纯态与统计系综。 */
const densityMatrix = defineViz({
  slug: 'density-matrix',
  title: '密度矩阵与混合态',
  params: { p: { type: 'range', min: 0, max: 100, default: 70, step: 5, label: '纯态权重 p (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const p = num(params, 'p', 70) / 100;
    clear(f);
    // 左：Bloch 球表示（混合态在球内）
    const cx = w * 0.26, cy = h * 0.42, R = 110;
    circle(f, cx, cy, R, { stroke: C.cool, lw: 2 });
    const { ctx } = f;
    ctx.save();
    ctx.strokeStyle = `${C.grid}aa`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, R, R * 0.32, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, R * 0.32, R, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // 纯态在表面，混合态在内部
    const th = f.t * 1.4;
    dot(f, cx + Math.sin(th) * R, cy - Math.cos(th) * R * 0.8, 7, C.pink);
    text(f, '纯态（表面）', cx + Math.sin(th) * R + 12, cy - Math.cos(th) * R * 0.8, { color: C.pink, font: '12px serif' });
    dot(f, cx + Math.sin(th) * R * p, cy - Math.cos(th) * R * 0.8 * p, 8, C.yellow);
    text(f, `混合态（内部 r = ${p.toFixed(2)}）`, cx - 60, cy + R + 30, { color: C.yellow, font: '13px serif' });
    text(f, 'ρ = ½(1̂ + r·σ)：纯态 |r|=1，混合 |r|<1', cx - 150, cy + R + 56, { color: C.fg, font: '13px serif' });
    // 右：矩阵与熵
    const bx = w * 0.55;
    const cell = 56, ox = bx + 20, oy = 130;
    const m00 = (1 + p) / 2, m11 = (1 - p) / 2, m01 = p * 0.4;
    const M = [[m00, m01], [m01, m11]];
    text(f, 'ρ = p|0⟩⟨0| + (1−p)·½1̂（示意）', bx, 96, { color: C.fg, font: '15px serif' });
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        poly(f, [[ox + c * cell, oy + r * cell], [ox + (c + 1) * cell, oy + r * cell], [ox + (c + 1) * cell, oy + (r + 1) * cell], [ox + c * cell, oy + (r + 1) * cell]],
          { fill: `rgba(102,126,234,${0.14 + Math.abs(M[r][c]) * 0.55})`, stroke: C.grid, lw: 1.4 });
        text(f, M[r][c].toFixed(2), ox + c * cell + cell / 2, oy + r * cell + cell / 2 + 6, { align: 'center', color: C.fg, font: '14px serif' });
      }
    }
    text(f, 'Tr ρ = 1（概率归一）', ox, oy + 2 * cell + 36, { color: C.cool, font: '14px serif' });
    text(f, 'Tr ρ² < 1 ⇒ 混合；= 1 ⇒ 纯', ox, oy + 2 * cell + 62, { color: C.cool, font: '14px sans-serif' });
    // 冯诺依曼熵曲线
    const gy = oy + 2 * cell + 110;
    const gx0 = bx + 10, gx1 = w - 60;
    seg(f, gx0, gy, gx1, gy, C.grid, 1.4);
    const pts: [number, number][] = [];
    for (let i = 1; i < 80; i++) {
      const q = i / 80;
      const S = -(q * Math.log(q) + (1 - q) * Math.log(1 - q)) / Math.LN2;
      pts.push([gx0 + q * (gx1 - gx0), gy - S * 70]);
    }
    poly(f, pts, { stroke: C.green, lw: 2.6 });
    const Sp = -(p * Math.log(p) + (1 - p) * Math.log(1 - p)) / Math.LN2;
    dot(f, gx0 + p * (gx1 - gx0), gy - Sp * 70, 6, C.hot);
    text(f, `S = −Tr ρ lnρ = ${(Sp * 0.693).toFixed(2)}（×ln2 归一）`, gx0, gy + 24, { color: C.green, font: '13px serif' });
    footnotes(f, [
      '密度矩阵 ρ = Σ pᵢ|ψᵢ⟩⟨ψᵢ|：纯态（p=1）与混合系综（概率 + 态）统一记账',
      '部分迹 Tr_B：丢掉子系统信息得到约化密度矩阵 —— 纠缠 ⇒ 子系统必混合',
      '量子信息：纠缠熵 = 形状因子；Black hole = 最大混合态（’t Hooft/Susskind）',
    ]);
    heading(f, '纯态用波函数、混合态用矩阵');
  },
});
registerViz(densityMatrix);

/** P456 相对论能量动量与阈能：四维不变量。 */
const relativisticEnergyMomentum = defineViz({
  slug: 'relativistic-energy-momentum',
  title: '相对论能量动量与阈能',
  params: { Ebeam: { type: 'range', min: 0, max: 100, default: 55, step: 5, label: '束流能量 (对数示意)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const Elog = num(params, 'Ebeam', 55) / 100;
    clear(f);
    // 左：色散关系 E² = (pc)² + (mc²)² 双曲线
    const v = view(f, { xMin: 0, xMax: 4, yMin: 0, yMax: 4.2, inset: 46, insetBottom: 46 });
    grid(f, v);
    curve(f, v, (x) => Math.sqrt(1 + x * x), { color: C.cool, lw: 2.6 }); // m=1
    curve(f, v, (x) => x, { color: C.warm, lw: 2, dash: [7, 5] }); // 光子线 E=pc
    text(f, 'E² = p² + m²（自然单位）', v.sx(0.2), v.sy(3.9), { color: C.cool, font: '14px serif' });
    text(f, '光子：E = pc（无质量）', v.sx(2.1), v.sy(3.5), { color: C.warm, font: '13px serif' });
    const p = Elog * 4;
    const E = Math.sqrt(1 + p * p);
    dot(f, v.sx(Math.min(4, p)), v.sy(Math.min(4.2, E)), 6, C.hot);
    text(f, `γ = ${E.toFixed(2)}，v/c = ${(p / E).toFixed(4)}`, v.sx(Math.min(4, p)) - 10, v.sy(Math.min(4.2, E)) - 12, { align: 'right', color: C.hot, font: '13px serif' });
    text(f, 'pc', (v.sx(0) + v.sx(4)) / 2, h - 52, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'E', v.sx(0.08), v.sy(4.1), { color: C.dim, font: '12px sans-serif' });
    // 右：阈能 —— 对撞 vs 固定靶
    const bx = w * 0.58;
    text(f, '阈能：制造新粒子的最低能量', bx, 92, { color: C.yellow, font: '15px sans-serif' });
    // 固定靶
    const m = 1;
    text(f, '固定靶：γ_th = 1 + 2m/M + (m/M)²', bx, 130, { color: C.fg, font: '14px serif' });
    text(f, '静止靶吸收动量 —— 大部分能量变成动能浪费', bx, 156, { color: C.cool, font: '13px sans-serif' });
    // 对撞
    text(f, '对撞：√s = 2E ⇒ 阈值直线上升', bx, 200, { color: C.fg, font: '14px serif' });
    text(f, '质心系全部可用 —— LHC 14 TeV √s', bx, 226, { color: C.hot, font: '13px sans-serif' });
    // 示意条形对比
    const barY = 270, barMax = w - bx - 70;
    poly(f, [[bx, barY], [bx + barMax, barY], [bx + barMax, barY + 26], [bx, barY + 26]], { fill: 'rgba(66,153,225,0.5)' });
    text(f, '固定靶等效 √s ∝ √E：线性慢', bx + 8, barY + 18, { color: C.fg, font: '13px serif' });
    poly(f, [[bx, barY + 42], [bx + barMax, barY + 42], [bx + barMax, barY + 68], [bx, barY + 68]], { fill: 'rgba(245,101,101,0.55)' });
    text(f, '对撞 √s ∝ E：同样预算高效百倍', bx + 8, barY + 60, { color: C.fg, font: '13px serif' });
    // 例子
    text(f, '例：p + p → 质量 M：', bx, barY + 116, { color: C.green, font: '14px serif' });
    text(f, 'Higgs 125 GeV：固定靶需 ~10⁴ TeV，对撞 125+ 就够', bx, barY + 142, { color: C.green, font: '13px sans-serif' });
    footnotes(f, [
      '四动量 pᵘ = (E, p)：不变量 pᵘp_μ = m² —— 换参照系不换物理',
      '阈能公式来自 √s 刚好等于末态总静止质量：动量守恒卡住固定靶',
      '这也是正负电子对撞机做精密测量、强子对撞机找重粒子的分工原因',
    ]);
    heading(f, '对撞阈值为什么总差一点');
  },
});
registerViz(relativisticEnergyMomentum);

/** P457 放射系与级联衰变：半衰期接力。 */
const decayChain = defineViz({
  slug: 'decay-chain',
  title: '放射系与级联衰变',
  params: { series: { type: 'select', options: ['铀系 (4n+2)', '锕系 (4n+3)', '钍系 (4n)'], default: '铀系 (4n+2)', label: '放射系' } },
  draw: (f) => {
    const { w, h, params } = f;
    const series = String(params['series'] ?? '铀系 (4n+2)');
    clear(f);
    const chains: Record<string, Array<[string, number, string]>> = {
      '铀系 (4n+2)': [['²³⁸U', 4.47e9, 'α'], ['²³⁴Th', 24.1, 'β'], ['²³⁴Pa', 1.17, 'β'], ['²³⁴U', 2.46e5, 'α'], ['²³⁰Th', 7.54e4, 'α'], ['²²⁶Ra', 1600, 'α'], ['²²²Rn', 3.82, 'α'], ['²¹⁸Po', 3.1, 'α'], ['²¹⁴Pb', 26.8, 'β'], ['²¹⁰Pb', 22.2, 'β'], ['²⁰⁶Pb', 0, '终']],
      '锕系 (4n+3)': [['²³⁵U', 7.04e8, 'α'], ['²³¹Th', 25.5, 'β'], ['²³¹Pa', 3.28e4, 'α'], ['²²⁷Th', 18.7, 'α'], ['²²³Ra', 11.4, 'α'], ['²¹⁹Rn', 3.96, 'α'], ['²¹⁵Po', 1.78e-3, 'α'], ['²¹¹Pb', 36.1, 'β'], ['²⁰⁷Tl', 4.77, 'β'], ['²⁰⁷Pb', 0, '终']],
      '钍系 (4n)': [['²³²Th', 1.4e10, 'α'], ['²²⁸Ra', 5.75, 'β'], ['²²⁸Ac', 6.15, 'β'], ['²²⁸Th', 1.91, 'α'], ['²²⁴Ra', 3.66, 'α'], ['²²⁰Rn', 55.6, 'α'], ['²¹⁶Po', 0.145, 'α'], ['²¹²Pb', 10.6, 'β'], ['²¹²Bi', 60.6, 'β'], ['²⁰⁸Tl', 3.05, 'β'], ['²⁰⁸Pb', 0, '终']],
    };
    const chain = chains[series];
    // 链式布局：两行
    const n = chain.length;
    const cols = Math.ceil(n / 2);
    const bw = Math.min(96, (w - 80) / cols);
    chain.forEach(([nucl, t12, mode], i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = 44 + col * bw + (row === 1 ? bw / 2 : 0);
      const y = 88 + row * 150;
      const alpha = mode === 'α';
      const isEnd = t12 === 0;
      poly(f, [[x, y], [x + bw - 12, y], [x + bw - 12, y + 46], [x, y + 46]],
        { fill: isEnd ? 'rgba(72,187,120,0.5)' : alpha ? 'rgba(102,126,234,0.4)' : 'rgba(237,137,54,0.4)',
          stroke: isEnd ? C.green : alpha ? C.accent : C.warm, lw: 2 });
      text(f, nucl, x + (bw - 12) / 2, y + 22, { align: 'center', color: C.fg, font: '14px serif' });
      const tl = t12 >= 1e6 ? `${(t12 / 1e6).toFixed(1)} Ma` : t12 >= 1000 ? `${(t12 / 1000).toFixed(1)} ka` : t12 >= 1 ? `${t12} y` : `${(t12 * 3.15e7).toFixed(1)} s`;
      text(f, t12 === 0 ? '稳定' : `t½ = ${tl}`, x + (bw - 12) / 2, y + 40, { align: 'center', color: C.dim, font: '10px sans-serif' });
      if (i < n - 1) {
        const nextRow = Math.floor((i + 1) / cols);
        const ny = 88 + nextRow * 150 + 46;
        const isRowChange = nextRow !== row;
        if (!isRowChange) {
          vec(f, x + bw - 12, y + 23, x + bw + 2, y + 23, C.yellow, 2, 6);
        } else {
          vec(f, x + (bw - 12) / 2, y + 46, x + bw / 2 + 8, ny - 4, C.yellow, 2, 6);
        }
        text(f, mode === 'α' ? 'α' : 'β', x + bw - 6, y + 14, { color: mode === 'α' ? C.cool : C.hot, font: '13px serif' });
      }
    });
    text(f, `${series}：α 走质量数 −4，β 走质量数不变 —— 最后都到铅`, 44, h - 116, { color: C.fg, font: '15px sans-serif' });
    text(f, '久期平衡：子核产率 = 母核衰变率（考古定年的物理基础）', 44, h - 88, { color: C.yellow, font: '14px sans-serif' });
    footnotes(f, [
      '四个放射系：4n、4n+1（已灭）、4n+2、4n+3 —— α/β 交替直到稳定铅/铋同位素',
      '半衰期跨度 10¹⁰ 年到微秒：单独核随机，大样本指数精确',
      'U-Pb 定年：²³⁸U→²⁰⁶Pb 4.47 Ga —— 地球年龄 4.54 Ga 的定盘星',
    ]);
    heading(f, '母子衰变排队走');
  },
});
registerViz(decayChain);

/** P458 特征 X 射线与莫塞莱：谱线频率随 Z 开方。 */
const xrayCharacteristic = defineViz({
  slug: 'xray-characteristic',
  title: '特征 X 射线与莫塞莱',
  params: { target: { type: 'select', options: ['Mo (Z=42)', 'Cu (Z=29)', 'W (Z=74)'], default: 'Cu (Z=29)', label: '靶材料' } },
  draw: (f) => {
    const { w, h, params } = f;
    const Z = Number(String(params['target'] ?? 'Cu').match(/Z=(\d+)/)?.[1] ?? 29);
    clear(f);
    // 左：连续轫致辐射 + 特征峰谱
    const v = view(f, { xMin: 0, xMax: 60, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 连续谱
    const brems = (E: number) => (E >= 0.02 ? Math.max(0, (E - 0.02) * Math.exp(-E / 14) * 0.13) : 0);
    const cont: [number, number][] = [];
    for (let i = 1; i <= 300; i++) {
      const E = (i / 300) * 60;
      cont.push([v.sx(E), v.sy(brems(E))]);
    }
    poly(f, cont, { stroke: C.cool, lw: 2 });
    // 特征峰（Kα, Kβ）：√ 莫塞莱
    const Kalpha = 10.2e-3 * Z * Z; // eV 近似（实际 10.2*(Z-1)² eV）
    const Kalpha2 = 10.2e-3 * Math.pow(Z - 1, 2);
    const peaks: Array<[number, number, string]> = [[Kalpha2, 0.78, 'Kα₂'], [Kalpha, 1.0, 'Kα₁'], [Kalpha * 1.14, 0.5, 'Kβ']];
    for (const [Ep, hh, label] of peaks) {
      if (Ep > 60) continue;
      seg(f, v.sx(Ep), v.sy(0), v.sx(Ep), v.sy(hh * Math.min(1, brems(Ep) * 8 + 0.55)), C.hot, 2.6);
      text(f, label, v.sx(Ep) - 8, v.sy(hh * 0.92) - 8, { color: C.hot, font: '12px serif' });
    }
    // 管电压截止
    const kV = 35;
    seg(f, v.sx(kV), v.sy(0), v.sx(kV), v.sy(0.6), `${C.yellow}aa`, 1.6);
    text(f, `截止 = e·kV = ${kV} keV（与靶无关）`, v.sx(kV) + 6, v.sy(0.66), { color: C.yellow, font: '12px serif' });
    text(f, '光子能量 (keV)', (v.sx(0) + v.sx(60)) / 2, h - 52, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, '强度', v.sx(0.6), v.sy(1.06), { color: C.dim, font: '12px sans-serif' });
    // 右：莫塞莱直线 √f ∝ Z
    const bx = w * 0.62, by0 = 110, by1 = h - 140;
    seg(f, bx, by1, w - 50, by1, C.grid, 1.4);
    seg(f, bx, by1, bx, by0, C.grid, 1.4);
    seg(f, bx + 8, by1 - 8, w - 60, by0 + 8, C.green, 2.6);
    // 数据点
    const rand = rng(63);
    for (let i = 0; i < 9; i++) {
      const z = 20 + i * 6;
      const x = bx + ((z - 18) / 56) * (w - 110 - bx);
      const y = by1 - ((z - 18) / 56) * (by1 - by0) + (rand() - 0.5) * 6;
      dot(f, x, y, 4.4, C.hot);
    }
    const curX = bx + ((Z - 18) / 56) * (w - 110 - bx);
    dot(f, curX, by1 - ((Z - 18) / 56) * (by1 - by0), 7, C.yellow);
    text(f, `√ν = a(Z − b)：${String(params['target'])}`, bx + 10, by0 - 14, { color: C.fg, font: '14px serif' });
    text(f, `K 系：b ≈ 1，当前 Z = ${Z} ⇒ √ν ∝ ${Z - 1}`, bx + 10, by0 + 8, { color: C.yellow, font: '13px serif' });
    text(f, 'Z', w - 66, by1 + 22, { color: C.dim, font: '13px serif' });
    text(f, '√f', bx - 4, by0 + 4, { color: C.dim, font: '13px serif' });
    text(f, '1913：莫塞莱据此给元素排定 Z —— 铝到金的序列', bx + 10, by1 + 52, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '特征峰机制：高能电子敲出 K 层电子，L→K 跃迁释放固定能量光子',
      '莫塞莱 √f = c(Z−1)：把周期表从原子量序改成核电荷序，填补空位预言新元素',
      '应用：XRF 元素分析、CT 管电压选择、牙片低剂量（钼/铑滤过只留特征峰）',
    ]);
    heading(f, '谱线频率随原子序数开方');
  },
});
registerViz(xrayCharacteristic);

/** P459 对产生与吸收：1.022 MeV 门槛。 */
const pairProduction = defineViz({
  slug: 'pair-production',
  title: '对产生与吸收',
  params: { Eph: { type: 'range', min: 0.5, max: 8, default: 2.5, step: 0.1, label: '光子能量 (MeV)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const E = num(params, 'Eph', 2.5);
    clear(f);
    const cx = w * 0.5, cy = h * 0.44;
    // 原子核
    circle(f, cx, cy, 30, { fill: 'rgba(102,126,234,0.85)', stroke: C.accent, lw: 2.4 });
    text(f, 'Z⁺', cx, cy + 5, { align: 'center', color: C.fg, font: '15px serif' });
    const allowed = E >= 1.022;
    if (allowed) {
      // 光子进来（波浪线）
      const pts: [number, number][] = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        pts.push([cx - 250 + t * 210, cy - 60 + Math.sin(t * 26) * 14]);
      }
      poly(f, pts, { stroke: C.yellow, lw: 2.4 });
      text(f, `γ (${E.toFixed(2)} MeV)`, cx - 250, cy - 86, { color: C.yellow, font: '14px serif' });
      // 正负电子
      vec(f, cx, cy, cx - 120, cy + 130, C.cool, 3);
      vec(f, cx, cy, cx + 140, cy + 110, C.hot, 3);
      text(f, 'e⁻', cx - 134, cy + 146, { color: C.cool, font: '16px serif' });
      text(f, 'e⁺', cx + 154, cy + 124, { color: C.hot, font: '16px serif' });
      const KE = E - 1.022;
      text(f, `动能分配：2×${(KE / 2).toFixed(2)} MeV（动能，余为静质量）`, cx - 190, cy + 190, { color: C.fg, font: '14px serif' });
      text(f, '必须有核（动量守恒）：真空中单光子变不了对', cx - 190, cy + 216, { color: C.dim, font: '13px sans-serif' });
      // 角度
      text(f, 'cosθ ≈ m/E：能量越高越前冲', cx + 30, cy + 44, { color: C.green, font: '13px serif' });
    } else {
      text(f, `E = ${E.toFixed(2)} MeV < 1.022 MeV = 2m_ec²`, cx - 190, cy - 120, { color: C.hot, font: '17px serif' });
      text(f, '光子直接穿过 —— 能量不足以造出静质量', cx - 190, cy - 90, { color: C.dim, font: '14px sans-serif' });
      const pts: [number, number][] = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        pts.push([cx - 220 + t * 440, cy + 40 + Math.sin(t * 26) * 14]);
      }
      poly(f, pts, { stroke: `${C.yellow}aa`, lw: 2.4 });
      text(f, 'γ → 无事发生', cx + 40, cy + 96, { align: 'center', color: C.yellow, font: '14px serif' });
    }
    // 右下：湮灭（逆过程）
    text(f, '逆过程 e⁺e⁻ → γγ：湮灭两光子各 ≥0.511 MeV，背对背', 56, h - 108, { color: C.pink, font: '15px serif' });
    text(f, 'PET 正是它：注入 ¹⁸F-脱氧葡萄糖 → 湮灭符合探测成像', 56, h - 80, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '阈值 2m_ec² = 1.022 MeV：质能等价的最直接演示（E=mc² 进实验室）',
      '截面随 E 上升后趋于对数饱和（高原区）；核电荷 Z² 加速（重靶好）',
      '逆效应宇宙线缪子发现（1932）；γγ → e⁺e⁻ 高能天体物理中的光深问题',
    ]);
    heading(f, '光子变正负电子：门槛与角度');
  },
});
registerViz(pairProduction);

/** P460 超精细结构与同位素位移：21 厘米线的出处。 */
const hyperfineStructure = defineViz({
  slug: 'hyperfine-structure',
  title: '超精细结构与同位素位移',
  params: { iso: { type: 'select', options: ['¹H', '²H (D)', '³He'], default: '¹H', label: '同位素' } },
  draw: (f) => {
    const { w, h, params } = f;
    const iso = String(params['iso'] ?? '¹H');
    clear(f);
    // 左：氢 1s 能级超精细分裂
    const x0 = w * 0.22;
    const yF1 = h * 0.3, yF0 = h * 0.3 + 60;
    seg(f, x0 - 130, yF1, x0 + 130, yF1, C.cool, 3);
    seg(f, x0 - 130, yF0, x0 + 130, yF0, C.warm, 3);
    text(f, 'F = 1（三重态）', x0 + 140, yF1 + 5, { color: C.cool, font: '14px serif' });
    text(f, 'F = 0（单态）', x0 + 140, yF0 + 5, { color: C.warm, font: '14px serif' });
    // 跃迁箭头（光子）
    const ph = Math.sin(f.t * 4) * 0.5 + 0.5;
    vec(f, x0, yF1, x0, yF0, `rgba(236,201,75,${0.5 + ph * 0.5})`, 3.2);
    text(f, '1420.406 MHz', x0 + 14, (yF1 + yF0) / 2 + 4, { color: C.yellow, font: '14px serif' });
    text(f, 'λ = 21.1 cm', x0 + 14, (yF1 + yF0) / 2 + 26, { color: C.yellow, font: '14px serif' });
    // 自旋示意
    text(f, 'e 自旋 ↑', x0 - 128, yF1 - 46, { color: C.cool, font: '13px serif' });
    text(f, 'p 自旋 ↑（平行 ⇒ F=1 高）', x0 - 128, yF1 - 26, { color: C.cool, font: '13px serif' });
    text(f, 'e ↑ p ↓（反平行 ⇒ F=0 低）', x0 - 128, yF0 + 40, { color: C.warm, font: '13px serif' });
    // 右：同位素位移
    const bx = w * 0.6;
    text(f, '同位素位移：同 Z 不同 A', bx, 92, { color: C.fg, font: '15px sans-serif' });
    const isotopes = [['¹H', 1.0, 1420.406], ['²H', 1.00015, 1420.406 * 1.000276], ['³He', 0.9998, 1420.406 * 0.9997]] as Array<[string, number, number]>;
    isotopes.forEach(([name, shift, freq], i) => {
      const y = 150 + i * 66;
      const offset = (shift - 0.9995) * 90000;
      seg(f, bx + 40 + offset, y, bx + 40 + offset + 80, y, name === iso ? C.hot : C.cool, name === iso ? 4 : 2.4);
      text(f, name, bx - 6, y + 5, { color: name === iso ? C.hot : C.dim, font: '14px serif' });
      text(f, `${freq.toFixed(3)} MHz`, bx + 134 + offset, y + 5, { color: C.dim, font: '11px serif' });
    });
    text(f, '质量差 → 折合质量修正（同位素位移）', bx, 150 + 3 * 66 + 6, { color: C.cool, font: '13px sans-serif' });
    text(f, '核半径差 → 有限核体积修正（都测核结构）', bx, 150 + 3 * 66 + 30, { color: C.warm, font: '13px sans-serif' });
    // 底部：应用
    text(f, '21 cm 线：中性氢最丰富 → 画出银河旋臂（荷兰，1945）', 56, h - 108, { color: C.yellow, font: '15px sans-serif' });
    text(f, '氢钟：超精细跃迁定义秒（铯 9.19 GHz 是同理的微波标）', 56, h - 80, { color: C.green, font: '14px sans-serif' });
    footnotes(f, [
      '超精细 = 电子与核磁矩的偶极耦合：能标 μ_eμ_p/a³ ~ 10⁻⁶ eV（α⁴m_ec² 级）',
      '21 cm 天文学：红移测绘中性氢 —— 21cm 功率谱也是再电离时代探针（HERA）',
      '精细 vs 超精细：前者来自电子轨道-自旋，后者来自核自旋参与',
    ]);
    heading(f, '核自旋给能级再裂一道');
  },
});
registerViz(hyperfineStructure);

/** P461 费米-狄拉克统计：分布函数与简并压。 */
const fermiDiracStatistics = defineViz({
  slug: 'fermi-dirac-statistics',
  title: '费米-狄拉克统计',
  params: { T: { type: 'range', min: 0, max: 100, default: 25, step: 5, label: '温度 T/T_F (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const T = Math.max(0.01, num(params, 'T', 25) / 100);
    clear(f);
    const v = view(f, { xMin: 0, xMax: 3, yMin: 0, yMax: 1.12, inset: 46, insetBottom: 46 });
    grid(f, v);
    // FD 分布
    const fd = (x: number) => 1 / (Math.exp((x - 1) / T) + 1);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const x = (i / 300) * 3;
      pts.push([v.sx(x), v.sy(fd(x))]);
    }
    poly(f, pts, { stroke: C.cool, lw: 2.8 });
    // 麦克斯韦-玻尔兹曼对比
    const mb: [number, number][] = [];
    for (let i = 1; i <= 300; i++) {
      const x = (i / 300) * 3;
      mb.push([v.sx(x), v.sy(Math.min(1.1, Math.exp(-(x - 1) / T)))]);
    }
    poly(f, mb, { stroke: C.warm, lw: 1.8, dash: [7, 5] });
    // ε_F 线
    seg(f, v.sx(1), v.sy(0), v.sx(1), v.sy(1.06), C.hot, 1.8);
    text(f, 'ε_F', v.sx(1) + 8, v.sy(1.02), { color: C.hot, font: '14px serif' });
    text(f, '蓝：费米-狄拉克', v.sx(0.06), v.sy(1.06), { color: C.cool, font: '13px serif' });
    text(f, '橙虚：经典玻尔兹曼（高能尾重合）', v.sx(0.06), v.sy(0.97), { color: C.warm, font: '13px serif' });
    text(f, 'ε/ε_F', (v.sx(0) + v.sx(3)) / 2, h - 52, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, '占据数', v.sx(0.06), v.sy(0.5), { color: C.dim, font: '12px sans-serif' });
    // 右下：简并压与比热
    text(f, `T/T_F = ${T.toFixed(2)}：`, w * 0.6, h - 156, { color: C.yellow, font: '15px sans-serif' });
    text(f, T < 0.1 ? '阶梯锐利 ⇒ 完全简并，比热 ∝ T 指数冻结' : T < 0.6 ? '半简并：电子气偏离经典（金属输运）' : '趋近经典：量子统计可以忘', w * 0.6, h - 128, { color: C.fg, font: '14px sans-serif' });
    text(f, '白矮星：电子简并压抵抗引力（钱德拉塞卡极限 1.4 M_⊙）', w * 0.6, h - 100, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      'f(ε) = 1/(e^{(ε−μ)/kT} + 1)：+1 而不是 −1 就是费米与玻色的全部差别',
      '金属电子 T≪T_F（~10⁵ K）⇒ 室温比热只有经典值的一半 —— 索末菲的胜利',
      '泡利不相容是简并压的源头：费米子"没有地方坐"的压力支撑恒星',
    ]);
    heading(f, '同费米子绝不挤同一格');
  },
});
registerViz(fermiDiracStatistics);

/** P462 玻色-爱因斯坦分布：聚束与化学势。 */
const boseEinsteinDistribution = defineViz({
  slug: 'bose-einstein-distribution',
  title: '玻色-爱因斯坦分布',
  params: { mu: { type: 'range', min: -2, max: -0.01, default: -0.6, step: 0.01, label: '化学势 μ/kT' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mu = num(params, 'mu', -0.6);
    clear(f);
    const v = view(f, { xMin: 0, xMax: 5, yMin: 0, yMax: 3.4, inset: 46, insetBottom: 46 });
    grid(f, v);
    // BE 分布
    const be = (x: number) => (x <= 0 && mu >= -1e-6 ? 1e6 : 1 / (Math.exp(x - mu) - 1));
    const pts: [number, number][] = [];
    for (let i = 1; i <= 400; i++) {
      const x = (i / 400) * 5;
      const val = be(x);
      if (val > 3.6) { pts.push([v.sx(x), v.sy(3.6)]); break; }
      pts.push([v.sx(x), v.sy(val)]);
    }
    poly(f, pts, { stroke: C.pink, lw: 2.8 });
    // FD 对比
    const fd: [number, number][] = [];
    for (let i = 0; i <= 400; i++) {
      const x = (i / 400) * 5;
      fd.push([v.sx(x), v.sy(1 / (Math.exp(x - mu) + 1))]);
    }
    poly(f, fd, { stroke: C.cool, lw: 2, dash: [7, 5] });
    // 光子（μ=0）
    const ph: [number, number][] = [];
    for (let i = 1; i <= 400; i++) {
      const x = (i / 400) * 5;
      const val = 1 / (Math.exp(x) - 1);
      ph.push([v.sx(x), v.sy(Math.min(3.4, val))]);
    }
    poly(f, ph, { stroke: C.yellow, lw: 1.8 });
    text(f, `粉：BE μ=${mu.toFixed(2)}`, v.sx(2.2), v.sy(3.2), { color: C.pink, font: '13px serif' });
    text(f, '蓝虚：FD（无聚束）', v.sx(2.2), v.sy(3.0), { color: C.cool, font: '13px serif' });
    text(f, '黄：光子气体 μ=0 ⇒ 普朗克黑体谱', v.sx(2.2), v.sy(2.8), { color: C.yellow, font: '13px serif' });
    text(f, 'ε/kT', (v.sx(0) + v.sx(5)) / 2, h - 52, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, '⟨n⟩', v.sx(0.1), v.sy(3.3), { color: C.dim, font: '12px sans-serif' });
    // 右下：聚束示意
    const bx = w * 0.62, by = h - 168;
    text(f, '聚束 vs 反聚束：', bx, by, { color: C.fg, font: '14px sans-serif' });
    const rand = rng(88);
    for (let i = 0; i < 22; i++) {
      const clustered = rand() < 0.6;
      const x = bx + (clustered ? 40 + Math.floor(rand() * 3) * 14 : 30 + rand() * 170);
      const y = by + 26 + Math.floor(i / 6) * 16;
      dot(f, x, y, 4.4, C.pink);
    }
    text(f, '光子爱挤同态：激光受激辐射的统计根', bx, by + 106, { color: C.pink, font: '13px sans-serif' });
    text(f, 'μ→0⁻ 时基态占据发散 ⇒ BEC（玻色凝聚）', bx, by + 130, { color: C.green, font: '13px sans-serif' });
    footnotes(f, [
      'n(ε) = 1/(e^{(ε−μ)/kT} − 1)：分母的 −1 造就低能发散与聚束',
      '黑体谱、声子气体、超流 ⁴He、BEC（2001 诺奖：凝聚碱金属原子气体）',
      '化学势对光子必须为 0（粒子数不守恒）—— 普朗克 1900 公式的统计骨架',
    ]);
    heading(f, '光子爱挤同态：黑体与激光的统计根');
  },
});
registerViz(boseEinsteinDistribution);

/** P463 晶体结合与内聚能：四种黏法。 */
const crystalBinding = defineViz({
  slug: 'crystal-binding',
  title: '晶体结合与内聚能',
  params: { kind: { type: 'select', options: ['离子键 NaCl', '共价 金刚石', '金属 Na', '范德华 Ar'], default: '离子键 NaCl', label: '结合类型' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = String(params['kind'] ?? '离子键 NaCl');
    clear(f);
    // 左：晶格示意
    const cx = w * 0.28, cy = h * 0.42, cell = 54;
    const neg = kind.startsWith('离子');
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const x = cx + (c - 2) * cell, y = cy + (r - 2) * cell;
        const even = (r + c) % 2 === 0;
        if (kind.startsWith('共价')) {
          // 金刚石式：只画顶点
          if ((r + c) % 2 === 0 || (r + c) % 4 === 1) {
            circle(f, x, y, 12, { fill: 'rgba(66,153,225,0.8)', stroke: C.cool, lw: 1.6 });
            if (c < 4) seg(f, x, y, x + cell, y, C.yellow, 2.4);
            if (r < 4) seg(f, x, y, x, y + cell, C.yellow, 2.4);
          }
        } else if (kind.startsWith('金属')) {
          // 电子海
          circle(f, x, y, 13, { fill: 'rgba(237,137,54,0.9)', stroke: C.warm, lw: 1.8 });
          const rand = rng(r * 7 + c * 13);
          for (let k = 0; k < 2; k++) {
            dot(f, x + (rand() - 0.5) * cell * 0.8, y + (rand() - 0.5) * cell * 0.8, 3, C.cool);
          }
        } else if (kind.startsWith('范德华')) {
          circle(f, x, y, 15, { fill: 'rgba(160,174,192,0.55)', stroke: C.dim, lw: 1.6 });
        } else {
          // 离子
          const isCation = even;
          circle(f, x, y, isCation ? 12 : 18, { fill: isCation ? 'rgba(66,153,225,0.85)' : 'rgba(245,101,101,0.75)', stroke: isCation ? C.cool : C.hot, lw: 1.8 });
          text(f, isCation ? '+' : '−', x, y + 5, { align: 'center', color: C.fg, font: '14px serif' });
        }
      }
    }
    // 右：Lennard-Jones 型势能曲线
    const gx0 = w * 0.56, gy0 = h - 140, gx1 = w - 50, gy1 = 110;
    seg(f, gx0, gy0, gx1, gy0, C.grid, 1.4);
    seg(f, gx0, gy0, gx0, gy1 - 10, C.grid, 1.4);
    const wellDepth: Record<string, number> = { '离子键 NaCl': 0.9, '共价 金刚石': 0.75, '金属 Na': 0.35, '范德华 Ar': 0.14 };
    const D = wellDepth[kind] ?? 0.6;
    const U = (r: number) => (r < 0.62 ? 8 : (Math.pow(0.62 / r, 12) - 2 * Math.pow(0.62 / r, 6)) * D + D * 0);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 200; i++) {
      const r = 0.55 + (i / 200) * 2.6;
      const u = U(r);
      pts.push([gx0 + ((r - 0.55) / 2.6) * (gx1 - gx0), gy0 - ((u + 1.2) / 2.6) * (gy0 - gy1)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.8 });
    // 势阱深度
    const wellY = gy0 - ((-D + 1.2) / 2.6) * (gy0 - gy1);
    seg(f, gx0, wellY, gx1 - 40, wellY, `${C.hot}aa`, 1.4, );
    text(f, `内聚能 ≈ ${D.toFixed(2)} × 1 eV/原子`, gx0 + 8, wellY - 8, { color: C.hot, font: '13px serif' });
    seg(f, gx0, gy0 - ((1.2) / 2.6) * (gy0 - gy1), gx1, gy0 - ((1.2) / 2.6) * (gy0 - gy1), `${C.dim}88`, 1.2);
    text(f, 'r (晶格间距)', (gx0 + gx1) / 2, gy0 + 24, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'U', gx0 - 6, gy1 + 6, { color: C.dim, font: '12px sans-serif' });
    // 底部：数值对比
    const energies: Record<string, string> = {
      '离子键 NaCl': '库仑求和（马德隆常数）：NaCl 7.9 eV，硬度高、熔点 801°C',
      '共价 金刚石': '方向性共价：C-C 3.6 eV × 4 键 —— 金刚石 7.6 eV、超硬',
      '金属 Na': '电子海 + 离子实：Na 1.1 eV，软、导电、延展性',
      '范德华 Ar': '瞬时偶极（London 色散）：Ar 0.08 eV —— 惰性气体只在低温固化',
    };
    text(f, energies[kind], 56, h - 96, { color: C.yellow, font: '14px sans-serif' });
    text(f, '判定性质：硬度、熔点、导电性全部由"黏法"决定', 56, h - 70, { color: C.fg, font: '14px sans-serif' });
    footnotes(f, [
      '离子晶体：正负交替使库仑能收敛 —— 马德隆常数把无穷求和打包',
      '四类键常共存（石墨层内共价、层间范德华、金属电子）—— 分类是理想化',
      '势能曲线通用形状：排斥芯（泡利）+ 吸引尾 ⇒ 平衡间距 r₀',
    ]);
    heading(f, '四种黏法定性质');
  },
});
registerViz(crystalBinding);

/** P464 半导体 PN 结：耗尽层与整流。 */
const pnJunction = defineViz({
  slug: 'pn-junction',
  title: '半导体 PN 结',
  params: { Vbias: { type: 'range', min: -2, max: 0.8, default: 0, step: 0.1, label: '偏压 V (负=反向)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const Vb = num(params, 'Vbias', 0);
    clear(f);
    const jx = w * 0.5, y0 = h * 0.24, bh = h * 0.4;
    // 半导体块
    poly(f, [[80, y0], [jx, y0], [jx, y0 + bh], [80, y0 + bh]], { fill: 'rgba(66,153,225,0.22)', stroke: C.cool, lw: 1.8 });
    poly(f, [[jx, y0], [w - 80, y0], [w - 80, y0 + bh], [jx, y0 + bh]], { fill: 'rgba(245,101,101,0.18)', stroke: C.hot, lw: 1.8 });
    text(f, 'P 型（多空穴）', 96, y0 + 26, { color: C.cool, font: '14px sans-serif' });
    text(f, 'N 型（多电子）', w - 200, y0 + 26, { color: C.hot, font: '14px sans-serif' });
    // 耗尽层宽度随偏压变化
    const width = 34 * (1 - Vb / 1.0) + 8;
    poly(f, [[jx - width, y0], [jx + width, y0], [jx + width, y0 + bh], [jx - width, y0 + bh]],
      { fill: 'rgba(26,32,44,0.75)', stroke: C.yellow, lw: 2 });
    // 内建电场
    vec(f, jx + width - 6, y0 + bh * 0.5, jx - width + 6, y0 + bh * 0.5, C.warm, 3);
    text(f, 'E_内建', jx - 40, y0 + bh * 0.5 - 14, { align: 'center', color: C.warm, font: '13px serif' });
    // 杂质电荷
    for (let i = 0; i < 4; i++) {
      text(f, '−', jx - width + 12 + i * 14, y0 + bh - 16, { color: C.cool, font: '15px serif' });
      text(f, '+', jx + width - 24 - i * 14, y0 + bh - 16, { color: C.hot, font: '15px serif' });
    }
    text(f, `偏压 V = ${Vb.toFixed(1)} V ⇒ 耗尽层 ${Vb > 0 ? '变窄（正向导通）' : Vb < -0.1 ? '变宽（反向截止）' : '平衡'}`, 80, y0 - 16,
      { color: Vb > 0.2 ? C.green : Vb < -0.2 ? C.hot : C.yellow, font: '15px sans-serif' });
    // I-V 曲线
    const gx0 = w * 0.62, gy0 = h - 96, gcx = gx0 + 70, gcy = gy0 - 90;
    seg(f, gx0, gcy, w - 50, gcy, C.grid, 1.4);
    seg(f, gcx, gy0, gcx, gcy - 80, C.grid, 1.4);
    // 二极管曲线
    const iv: [number, number][] = [];
    for (let i = 0; i <= 100; i++) {
      const vb = -2 + (i / 100) * 2.8;
      let I = 1e-7 * (Math.exp(vb / 0.026) - 1);
      I = Math.min(I, 3);
      iv.push([gcx + (vb / 0.8) * ((w - 90 - gcx) / 0.8) * 0.8 * 0.35, gcy - I * 30]);
    }
    poly(f, iv, { stroke: C.green, lw: 2.6 });
    dot(f, gcx + (Vb / 0.8) * ((w - 90 - gcx) / 0.8) * 0.8 * 0.35, gcy - Math.min(3, 1e-7 * (Math.exp(Vb / 0.026) - 1)) * 30, 6, C.yellow);
    text(f, 'I-V：指数单向', gx0 + 6, gy0 + 20, { color: C.green, font: '13px serif' });
    text(f, '开启 ~0.7 V（Si）', gcx + 12, gcy - 40, { color: C.dim, font: '12px serif' });
    text(f, 'V', w - 62, gcy + 18, { color: C.dim, font: '12px serif' });
    footnotes(f, [
      '扩散 vs 漂移在结处动态平衡 ⇒ 费米能级拉平、内建电势 qV_bi ≈ 0.7 V',
      '正向：势垒降低，指数注入电流 I = I_s(e^{V/V_T}−1)（肖克利方程）',
      '整流、LED、太阳能电池、MOSFET 源漏结：整个电子工业的最小单元',
    ]);
    heading(f, 'P 与 N 相遇：整流从这里开始');
  },
});
registerViz(pnJunction);

/** P465 费米能级与载流子：半导体仪表盘。 */
const semiconductorFermiLevel = defineViz({
  slug: 'semiconductor-fermi-level',
  title: '费米能级与载流子',
  params: { doping: { type: 'range', min: -3, max: 3, default: 0, step: 0.25, label: '掺杂 log₁₀(N_D−N_A)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const lg = num(params, 'doping', 0);
    clear(f);
    // 能带图
    const x0 = 70, x1 = w - 70;
    const Ec = h * 0.3, Ev = h * 0.62;
    const Eg = 1.12; // eV
    const kT = 0.026;
    const Ef = Ec - kT * Math.LN2 / 1 + lg * 0.05; // 示意：n 型上移，p 型下移（相对中点）
    const EfMid = (Ec + Ev) / 2;
    const Efermi = EfMid + lg * 0.06;
    // 导带/价带
    poly(f, [[x0, Ec - 60], [x1, Ec - 60], [x1, Ec], [x0, Ec]], { fill: 'rgba(66,153,225,0.25)', stroke: C.cool, lw: 1.6 });
    poly(f, [[x0, Ev], [x1, Ev], [x1, Ev + 60], [x0, Ev + 60]], { fill: 'rgba(237,137,54,0.25)', stroke: C.warm, lw: 1.6 });
    text(f, '导带 E_C', x0 + 8, Ec - 12, { color: C.cool, font: '14px serif' });
    text(f, '价带 E_V', x0 + 8, Ev + 34, { color: C.warm, font: '14px serif' });
    // 带隙
    seg(f, x1 - 60, Ec, x1 - 60, Ev, `${C.dim}aa`, 1.4);
    text(f, 'E_g = 1.12 eV (Si)', x1 - 210, (Ec + Ev) / 2, { color: C.dim, font: '13px serif' });
    // 费米能级
    seg(f, x0, Efermi, x1, Efermi, C.hot, 2.6);
    text(f, `E_F ${lg > 0.5 ? '（n 型，近导带）' : lg < -0.5 ? '（p 型，近价带）' : '（本征，近带中）'}`, x0 + 8, Efermi - 8, { color: C.hot, font: '14px serif' });
    // 载流子
    const n = Math.exp((Efermi - Ec) / kT);
    const p = Math.exp((Ev - Efermi) / kT);
    const scale = (x: number) => Math.max(1, Math.min(40, Math.log10(Math.max(1e-3, x)) * 12 + 40));
    // 电子点（导带底）
    const nDots = Math.round(scale(n) / 3);
    for (let i = 0; i < nDots; i++) {
      const rand = rng(300 + i);
      dot(f, x0 + 30 + rand() * (x1 - x0 - 60), Ec + 12 + rand() * 36, 4, C.cool);
    }
    const pDots = Math.round(scale(p) / 3);
    for (let i = 0; i < pDots; i++) {
      const rand = rng(400 + i);
      dot(f, x0 + 30 + rand() * (x1 - x0 - 60), Ev + 12 + rand() * 36, 4, C.warm);
    }
    // 底部：读数
    const nShow = n * 1e10, pShow = p * 1e10;
    text(f, `n ≈ ${nShow > 1e18 ? nShow.toExponential(1) : nShow.toExponential(1)} cm⁻³ ｜ p ≈ ${pShow.toExponential(1)} cm⁻³`, 70, h - 118, { color: C.fg, font: '15px serif' });
    text(f, 'n·p = n_i²（质量作用定律）—— 一个动，另一个跟着让位', 70, h - 90, { color: C.yellow, font: '14px sans-serif' });
    text(f, lg > 0.5 ? 'n 型：施主能级在 E_C 下 ~0.05 eV，电子易激发' : lg < -0.5 ? 'p 型：受主能级在 E_V 上 ~0.05 eV，空穴为多子' : '本征：n = p = n_i（Si 1.5×10¹⁰ cm⁻³ @300K）', 70, h - 62,
      { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      'E_F 是"电子填充水平"：掺杂把它在带隙里上下挪动 —— 一切 p-n 结的账本',
      '接触电势、载流子浓度、电导率 σ = q(nμ_n + pμ_p) 都从 E_F 读出',
      '费米钉扎：表面态把 E_F 钉死在带中 —— 欧姆接触与肖特基势垒的设计难点',
    ]);
    heading(f, '半导体一切特性的仪表盘');
  },
});
registerViz(semiconductorFermiLevel);

/** P466 声强与声压级：分贝是对数的耳朵。 */
const soundIntensity = defineViz({
  slug: 'sound-intensity',
  title: '声强与声压级',
  params: { I: { type: 'range', min: -12, max: 2, default: -6, step: 0.5, label: '声强 log₁₀(I/I₀)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const lg = num(params, 'I', -6);
    const dB = Math.round(10 * lg + 120);
    clear(f);
    // 左：分贝刻度尺
    const x0 = 70, x1 = w - 60, y = h * 0.34;
    seg(f, x0, y, x1, y, C.grid, 2);
    const stops = [[0, '0'], [20, '20'], [40, '耳语'], [60, '对话'], [80, '交通'], [100, '电锯'], [120, '痛阈'], [140, '喷气']] as Array<[number, string]>;
    for (const [db, label] of stops) {
      const x = x0 + (db / 140) * (x1 - x0);
      seg(f, x, y - 8, x, y + 8, C.dim, 1.6);
      text(f, label, x, y + 26, { align: 'center', color: C.dim, font: '11px sans-serif' });
      text(f, String(db), x, y - 16, { align: 'center', color: C.dim, font: '11px sans-serif' });
    }
    // 游标
    const cx = x0 + (Math.max(0, dB) / 140) * (x1 - x0);
    vec(f, cx, y - 54, cx, y - 10, C.hot, 3);
    dot(f, cx, y - 54, 7, C.hot);
    text(f, `${dB} dB SPL`, cx, y - 68, { align: 'center', color: C.hot, font: '16px sans-serif' });
    // 听阈到痛阈的强度跨度
    const barY = y + 66;
    poly(f, [[x0, barY], [x1, barY], [x1, barY + 34], [x0, barY + 34]], { fill: 'rgba(58,74,99,0.6)', stroke: C.grid, lw: 1.2 });
    const fillW = (Math.max(0, dB) / 140) * (x1 - x0);
    poly(f, [[x0, barY], [x0 + fillW, barY], [x0 + fillW, barY + 34], [x0, barY + 34]], { fill: 'rgba(72,187,120,0.55)' });
    text(f, '强度比 I/I₀：', x0, barY + 62, { color: C.fg, font: '15px serif' });
    const ratio = Math.pow(10, lg);
    text(f, ratio > 1e6 ? `10^${lg.toFixed(1)}（即 ${(Math.pow(10, lg)).toExponential(1)} 倍）` : `${ratio.toPrecision(3)} 倍`, x0 + 130, barY + 62, { color: C.yellow, font: '15px serif' });
    // 右：正弦波示意
    const wx = w * 0.5, wy = h * 0.72;
    const amp = 10 + (lg + 12) * 3.4;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 240; i++) {
      const t = i / 240;
      pts.push([wx + t * (w - wx - 60), wy + Math.sin(t * 26 + f.t * 6) * Math.min(70, amp)]);
    }
    poly(f, pts, { stroke: C.cool, lw: 2.4 });
    text(f, '声压 ∝ √I：强度十倍，声压 3.16 倍', wx, wy + 100, { color: C.cool, font: '14px serif' });
    text(f, '每 +10 dB = 强度 ×10 = 响度大致 ×2（主观）', wx, wy + 126, { color: C.yellow, font: '14px serif' });
    footnotes(f, [
      'I₀ = 10⁻¹² W/m²（1 kHz 听阈）：L_I = 10 lg(I/I₀) dB —— 对数压缩 10¹⁴ 动态范围',
      '声压级 L_p = 20 lg(p/p₀)，p₀ = 20 μPa：空气中与 L_I 数值相同',
      '职业健康：85 dB/8h 是红线；MP3 满音量 ≈ 105 dB 持续半小时即超安全剂量',
    ]);
    heading(f, '分贝是对数的耳朵');
  },
});
registerViz(soundIntensity);