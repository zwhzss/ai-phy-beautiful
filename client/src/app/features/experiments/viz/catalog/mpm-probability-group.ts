import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text, view, grid, curve, circle, vec, rng, hist } from '../canvas';

/** P591 矩生成函数与分布族。 */
const momentGenerating = defineViz({
  slug: 'moment-generating',
  title: '矩生成函数与分布族',
  params: { dist: { type: 'select', options: ['高斯', '泊松', '指数'], default: '高斯', label: '分布' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'dist', '高斯');
    clear(f);
    const v = view(f, { xMin: -4, xMax: 8, yMin: 0, yMax: 1.4, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 分布密度
    const pdf = (x: number): number => {
      if (kind === '高斯') return Math.exp(-Math.pow(x - 1.5, 2) / 2) / Math.sqrt(2 * Math.PI) * 2.4;
      if (kind === '泊松') {
        if (x < 0) return 0;
        const k = Math.round(x), lam = 4;
        let fact = 1;
        for (let i = 2; i <= k; i++) fact *= i;
        return Math.exp(-lam) * Math.pow(lam, k) / fact * 6;
      }
      return Math.exp(-(x - 0.5) / 1.6) / 1.6 * 1.5 * (x > 0.5 ? 1 : 0);
    };
    const pts: Array<[number, number]> = [];
    if (kind === '泊松') {
      for (let k = 0; k <= 8; k++) {
        const val = pdf(k);
        seg(f, v.sx(k), v.sy(0), v.sx(k), v.sy(Math.min(1.35, val)), C.cool, 6);
      }
      dot(f, v.sx(4), v.sy(Math.min(1.35, pdf(4))), 6, C.hot);
      text(f, 'λ=4：均值=方差（泊松签名）', v.sx(4.6), v.sy(1.28), { color: C.hot, font: '14px serif' });
    } else {
      for (let i = 0; i <= 300; i++) {
        const x = -4 + (i / 300) * 12;
        const val = pdf(x);
        if (val > 1.4) continue;
        pts.push([v.sx(x), v.sy(val)]);
      }
      poly(f, pts, { stroke: kind === '高斯' ? C.cool : C.green, lw: 2.8, fill: kind === '高斯' ? undefined : 'rgba(72,187,120,0.12)', close: kind !== '高斯' });
    }
    // 矩标记
    const meanM = kind === '高斯' ? 1.5 : kind === '泊松' ? 4 : 2.1;
    seg(f, v.sx(meanM), v.sy(0), v.sx(meanM), v.sy(1.2), `${C.yellow}aa`, 2);
    text(f, '⟨X⟩', v.sx(meanM) - 6, v.sy(1.28), { color: C.yellow, font: '14px serif' });
    text(f, 'x', (v.sx(-4) + v.sx(8)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    // 右侧：MGF 表
    const bx = w * 0.6;
    text(f, 'MGF：M(t) = ⟨e^{tX}⟩ = Σ μₙtⁿ/n!', bx, 96, { color: C.yellow, font: '17px serif' });
    text(f, '对 t 求 n 次导再令 t=0 → 第 n 阶矩 μₙ', bx, 136, { color: C.fg, font: '15px serif' });
    const table = [
      ['高斯 N(μ,σ²)', 'e^{μt+σ²t²/2}', C.cool],
      ['泊松(λ)', 'e^{λ(eᵗ-1)}', C.warm],
      ['指数(β)', '1/(1-βt)', C.green],
      ['伯努利(p)', '1-p+peᵗ', C.pink],
    ] as Array<[string, string, string]>;
    table.forEach(([name, mgf, color], i) => {
      const y = 196 + i * 62;
      const active = name.startsWith(kind === '高斯' ? '高斯' : kind === '泊松' ? '泊松' : '指数');
      poly(f, [[bx, y], [bx + 340, y], [bx + 340, y + 48], [bx, y + 48]],
        { fill: active ? `${color}30` : `${color}10`, stroke: color, lw: active ? 2.6 : 1.4 });
      text(f, name, bx + 14, y + 30, { color, font: '15px serif' });
      text(f, mgf, bx + 170, y + 30, { color: active ? C.fg : C.dim, font: '15px serif' });
    });
    text(f, '卷积友好：独立和的 MGF = MGF 相乘（CLF 的捷径）', bx, 196 + 4 * 62 + 20, { color: C.green, font: '15px serif' });
    text(f, '累积量 ln M(t)：加法性 → 大数定律与 CLT 的骨架', bx, 196 + 4 * 62 + 56, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '矩生成函数=分布的"指纹生成器"：存在邻域内唯一确定分布',
      '矩问题：知道全部矩能唯一确定分布吗？（Hamburger 问题有反例）',
      '特征函数 φ(t) = M(it) 处处存在 —— 更普适的版本（Lévy 连续性定理）',
    ]);
    heading(f, '一个生成函数吐出全部矩');
  },
});
registerViz(momentGenerating);

/** P592 中心极限定理（高斯卷积极限）。 */
const gaussianConvolutionLimit = defineViz({
  slug: 'gaussian-convolution-limit',
  title: '中心极限定理',
  params: { shape: { type: 'select', options: ['均匀分布', '双峰分布', '重尾分布'], default: '均匀分布', label: '原始分布' }, n: { type: 'range', min: 1, max: 40, default: 1, step: 1, label: '求和项数 n' } },
  draw: (f) => {
    const { w, h, params } = f;
    const shape = str(params, 'shape', '均匀分布');
    const n = Math.round(num(params, 'n', 1));
    clear(f);
    const v = view(f, { xMin: -4, xMax: 4, yMin: 0, yMax: 1.5, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 原始分布（每次抽样）
    const base = (x: number): number => {
      if (shape === '均匀分布') return (x > -1 && x < 1) ? 0.5 : 0;
      if (shape === '双峰分布') return (Math.exp(-Math.pow(x - 1.6, 2) / 0.5) + Math.exp(-Math.pow(x + 1.6, 2) / 0.5)) / Math.sqrt(2 * Math.PI) * 1.3;
      return 0.55 / (1 + Math.pow(Math.abs(x), 3.2));
    };
    // 原始
    const p0: Array<[number, number]> = [];
    for (let i = 0; i <= 400; i++) {
      const x = -4 + (i / 400) * 8;
      p0.push([v.sx(x), v.sy(Math.min(1.45, base(x)))]);
    }
    poly(f, p0, { stroke: `${C.cool}88`, lw: 2, dash: [7, 5] });
    // n 项和的分布（卷积近似：按 CLT 缩放，用数值卷积太重——用 Edgeworth 型近似）
    const skew = shape === '重尾分布' ? 1.4 : shape === '双峰分布' ? 0 : 0;
    const kurt = shape === '重尾分布' ? 2.2 : shape === '双峰分布' ? -0.8 : -1.2;
    const phi = (x: number) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
    const H3 = (x: number) => Math.pow(x, 3) - 3 * x;
    const H4 = (x: number) => Math.pow(x, 4) - 6 * x * x + 3;
    const pn: Array<[number, number]> = [];
    for (let i = 0; i <= 400; i++) {
      const z = -4 + (i / 400) * 8;
      const corr = 1 + (skew / (6 * Math.sqrt(n))) * H3(z) + (kurt / (24 * n)) * H4(z) + ((skew * skew) / (72 * n)) * (H3(z) * H3(z) - 6);
      const val = phi(z) * Math.max(0, corr) * 1.42;
      if (val > 1.5) continue;
      pn.push([v.sx(z), v.sy(Math.max(0, val))]);
    }
    poly(f, pn, { stroke: C.hot, lw: 3 });
    // 标准高斯参考
    const gref: Array<[number, number]> = [];
    for (let i = 0; i <= 300; i++) {
      const z = -4 + (i / 300) * 8;
      gref.push([v.sx(z), v.sy(phi(z) * 1.42)]);
    }
    poly(f, gref, { stroke: `${C.green}99`, lw: 1.6, dash: [7, 5] });
    text(f, '蓝虚=单次分布　红实=n 项标准化和　绿虚=标准高斯', v.sx(-3.9), v.sy(1.45), { color: C.fg, font: '14px serif' });
    text(f, n === 1 ? 'n=1：还长原始的样子' : n < 6 ? `n=${n}：双峰开始融化、峰在聚拢` : `n=${n}：已经很像高斯（Edgeworth 修正 ~1/n 修正尾巴）`,
      v.sx(-3.9), v.sy(1.32), { color: C.yellow, font: '14px serif' });
    text(f, 'x（标准化）', (v.sx(-4) + v.sx(4)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, '收敛速度 Edgeworth：偏度 ~n^{-1/2}，峰度 ~n^{-1}（重尾更慢！）', 56, h - 116, { color: C.fg, font: '15px serif' });
    text(f, '列维定理推广：独立同分布 + 有限方差 ⇒ 高斯吸引子（稳定分布家族的 α=2 成员）', 56, h - 86, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '不管单次分布多怪：大量独立求和标准化后趋向高斯 —— 统计之王',
      '证明路线：特征函数 φ(t)ⁿ ≈ e^{-t²/2}（对数展开消掉高阶项）',
      '金融/保险的教训：重尾分布 CLT 收敛极慢 —— 极值理论才是正解',
    ]);
    heading(f, '大量独立求和的宿命是高斯');
  },
});
registerViz(gaussianConvolutionLimit);

/** P593 布朗运动与随机路径。 */
const wienerBrownianPath = defineViz({
  slug: 'wiener-brownian-path',
  title: '布朗运动与随机路径',
  params: { D: { type: 'range', min: 1, max: 50, default: 10, step: 1, label: '扩散系数 D' } },
  draw: (f) => {
    const { w, h, params } = f;
    const D = num(params, 'D', 10);
    clear(f);
    const v = view(f, { xMin: 0, xMax: 10, yMin: -3, yMax: 3, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 多条样本路径（确定性种子）
    const rand = rng(41);
    const paths: number[][] = [];
    for (let p = 0; p < 5; p++) {
      const path = [0];
      for (let i = 1; i <= 400; i++) {
        path.push(path[i - 1] + (rand() - 0.5) * Math.sqrt(D) * 0.22);
      }
      paths.push(path);
    }
    const tAnim = Math.floor(((f.t * 0.4) % 1) * 400) + 40;
    paths.forEach((path, i) => {
      const pts: Array<[number, number]> = [];
      const upto = i === 0 ? Math.min(400, tAnim) : 400;
      for (let k = 0; k <= upto; k++) {
        pts.push([v.sx((k / 400) * 10), v.sy(path[k])]);
      }
      poly(f, pts, { stroke: i === 0 ? C.hot : `rgba(66,153,225,${0.35 + i * 0.12})`, lw: i === 0 ? 2.8 : 1.7 });
    });
    text(f, '红=正在生成的路径　蓝=其他样本（同一统计律）', v.sx(0.15), v.sy(2.85), { color: C.fg, font: '14px serif' });
    text(f, '⟨x²⟩ = 2Dt：包络 ∝ √t（不是线性增长！）', v.sx(0.15), v.sy(2.6), { color: C.yellow, font: '15px serif' });
    // √t 包络
    for (const sgn of [1, -1]) {
      const env: Array<[number, number]> = [];
      for (let i = 0; i <= 60; i++) {
        const t = (i / 60) * 10;
        env.push([v.sx(t), v.sy(sgn * Math.sqrt(2 * D * t * 0.05))]);
      }
      poly(f, env, { stroke: `${C.green}99`, lw: 1.8, dash: [8, 6] });
    }
    text(f, '绿虚：±√(2Dt)', v.sx(6.6), v.sy(2.3), { color: C.green, font: '13px serif' });
    text(f, 't', (v.sx(0) + v.sx(10)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    // 底部性质
    text(f, '三条定义性质：连续、独立增量、增量 ~ N(0, 2DΔt)', 56, h - 148, { color: C.fg, font: '16px serif' });
    text(f, '病态之美：几乎必然连续却处处不可微（总变差无限）', 56, h - 118, { color: C.hot, font: '15px serif' });
    text(f, '爱因斯坦 1905：用它称量分子（扩散 → 布朗位移 → 阿伏伽德罗数）', 56, h - 88, { color: C.yellow, font: '15px serif' });
    text(f, '维纳测度 = 路径空间上的概率：量子路径积分的经典对应', 56, h - 58, { color: C.pink, font: '14px sans-serif' });
    footnotes(f, [
      '均方位移线性增长、位移分布高斯 —— 扩散方程的随机推导（Kramers-Moyal）',
      '首次通过时间、反射原理、布朗棘轮：经典随机过程工具箱',
      '分数布朗运动（H≠1/2）：长程相关，反常扩散与湍流脉动',
    ]);
    heading(f, '连续却处处不可微的路径');
  },
});
registerViz(wienerBrownianPath);

/** P594 朗之万方程与福克-普朗克。 */
const langevinFokkerplanck = defineViz({
  slug: 'langevin-fokkerplanck',
  title: '朗之万方程与福克-普朗克',
  params: { potential: { type: 'select', options: ['单势阱', '双势阱（棘轮）'], default: '单势阱', label: '势能景观' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'potential', '单势阱');
    clear(f);
    const v = view(f, { xMin: -4, xMax: 4, yMin: -0.6, yMax: 2.6, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 势能曲线
    const U = (x: number) => (kind === '单势阱' ? 0.5 * x * x * 0.35 : (x * x - 4) * (x * x - 4) * 0.06 - 0.1);
    const pot: Array<[number, number]> = [];
    for (let i = 0; i <= 240; i++) {
      const x = -4 + (i / 240) * 8;
      pot.push([v.sx(x), v.sy(U(x))]);
    }
    poly(f, pot, { stroke: C.cool, lw: 2.8 });
    text(f, 'U(x)', v.sx(-3.9), v.sy(U(-3.9)) - 12, { color: C.cool, font: '14px serif' });
    // 平衡分布 e^{-U/D}
    const pdfPts: Array<[number, number]> = [];
    let norm = 0;
    const vals: number[] = [];
    for (let i = 0; i <= 240; i++) {
      const x = -4 + (i / 240) * 8;
      const val = Math.exp(-U(x) / (kind === '双势阱（棘轮）' ? 0.35 : 0.6));
      vals.push(val);
      norm += val;
    }
    for (let i = 0; i < 240; i++) {
      const x = -4 + (i / 240) * 8;
      pdfPts.push([v.sx(x), v.sy(0.6 + (vals[i] / norm) * 240 * 0.016)]);
    }
    poly(f, pdfPts, { stroke: C.hot, lw: 2.6, fill: 'rgba(245,101,101,0.1)', close: true });
    text(f, '红：稳态分布 P_ss ∝ e^{-U/D}（细致平衡）', v.sx(-3.9), v.sy(2.45), { color: C.hot, font: '14px serif' });
    // 随机运动的粒子
    const rand = rng(77);
    const walk: number[] = [0];
    for (let i = 1; i < 200; i++) walk.push(walk[i - 1] + (rand() - 0.5) * 0.34);
    const idx = Math.floor(((f.t * 0.7) % 1) * 199);
    const px = walk[idx];
    const py = U(px) + 0.12;
    dot(f, v.sx(px), v.sy(py), 8, C.yellow);
    text(f, '受力 -U\'(x) + 随机踢（白噪声）', v.sx(-3.9), v.sy(-0.45), { color: C.yellow, font: '14px serif' });
    // 右侧方程
    const bx = w * 0.58;
    text(f, '朗之万（单粒子轨迹）：', bx, 96, { color: C.fg, font: '17px serif' });
    text(f, 'm dx/dt = -∇U + ξ(t)，⟨ξξ⟩ = 2Dδ(t-t\')', bx, 136, { color: C.cool, font: '16px serif' });
    text(f, '福克-普朗克（概率密度）：', bx, 196, { color: C.fg, font: '17px serif' });
    text(f, '∂P/∂t = ∂/∂x(U\'P/D + ∂P/∂x)', bx, 236, { color: C.hot, font: '16px serif' });
    text(f, '两式等价（同一随机过程的两种语言）', bx, 288, { color: C.yellow, font: '15px serif' });
    if (kind === '双势阱（棘轮）') {
      text(f, '对称双阱 + 周期驱动 → 净定向流（分子棘轮）', bx, 348, { color: C.green, font: '15px serif' });
      text(f, '热涨落+不对称势=方向性 —— 分子马达的工作原理', bx, 384, { color: C.fg, font: '14px sans-serif' });
      text(f, '（涨落-耗散定理守恒：不能只靠噪声白嫖功）', bx, 420, { color: C.hot, font: '14px sans-serif' });
    } else {
      text(f, '弛豫时间 τ = m/γ：过阻尼下轨迹直接服从 FP', bx, 348, { color: C.green, font: '15px serif' });
      text(f, 'Kramers 逃逸率：跨势垒概率 ~ e^{-ΔU/D}（隧穿的经典堂兄）', bx, 384, { color: C.fg, font: '14px sans-serif' });
      text(f, '应用：胶体粒子光镊、股票几何布朗、蛋白质折叠', bx, 420, { color: C.cool, font: '14px sans-serif' });
    }
    footnotes(f, [
      '朗之万 1908：给牛顿方程加随机力 —— 布朗运动的第一性理论',
      '福克-普朗克把轨迹统计升格为密度演化：漂移+扩散两项定生死',
      '涨落-耗散定理：噪声强度与摩擦系数绑定 —— 热平衡的深层联系',
    ]);
    heading(f, '轨迹与概率的两面描述');
  },
});
registerViz(langevinFokkerplanck);

/** P595 主方程与马尔可夫链。 */
const masterEquationMarkov = defineViz({
  slug: 'master-equation-markov',
  title: '主方程与马尔可夫链',
  params: { chain: { type: 'select', options: ['两态生灭', '三态循环', '随机游走'], default: '两态生灭', label: '链结构' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'chain', '两态生灭');
    clear(f);
    // 左：状态转移图
    const cx = w * 0.26, cy = h * 0.42;
    const nodes: Array<[number, number, string]> = kind === '两态生灭'
      ? [[cx - 90, cy, 'A'], [cx + 90, cy, 'B']]
      : kind === '三态循环'
        ? [[cx, cy - 90, '1'], [cx + 90, cy + 50, '2'], [cx - 90, cy + 50, '3']]
        : [[cx - 130, cy, 'L'], [cx, cy, 'M'], [cx + 130, cy, 'R']];
    nodes.forEach(([x, y, label]) => {
      circle(f, x, y, 34, { fill: 'rgba(102,126,234,0.75)', stroke: C.accent, lw: 2.4 });
      text(f, label, x, y + 6, { align: 'center', color: C.fg, font: '17px serif' });
    });
    // 转移箭头（动画流量）
    type Flow = [[number, number, string], [number, number, string], string];
    const flows: Flow[] = kind === '两态生灭'
      ? [[nodes[0], nodes[1], 'k₁'], [nodes[1], nodes[0], 'k₂']]
      : kind === '三态循环'
        ? [[nodes[0], nodes[1], 'k'], [nodes[1], nodes[2], 'k'], [nodes[2], nodes[0], 'k']]
        : [[nodes[0], nodes[1], 'w'], [nodes[1], nodes[0], 'w'], [nodes[1], nodes[2], 'w'], [nodes[2], nodes[1], 'w']];
    flows.forEach(([a, b, label], i) => {
      const [ax, ay] = [a[0], a[1]], [bx0, by0] = [b[0], b[1]];
      const dx = bx0 - ax, dy = by0 - ay;
      const len = Math.hypot(dx, dy);
      const ux = dx / len, uy = dy / len;
      const off = 16;
      const x1 = ax + ux * 40 + (-uy) * off, y1 = ay + uy * 40 + ux * off;
      const x2 = bx0 - ux * 40 + (-uy) * off, y2 = by0 - uy * 40 + ux * off;
      vec(f, x1, y1, x2, y2, C.warm, 2.4, 8);
      const pulse = (Math.sin(f.t * 4 + i * 1.3) + 1) / 2;
      dot(f, x1 + (x2 - x1) * pulse, y1 + (y2 - y1) * pulse, 4.6, C.yellow);
      text(f, String(label), (x1 + x2) / 2 + 16 * Math.sign(uy || 1), (y1 + y2) / 2 - 14, { color: C.warm, font: '14px serif' });
    });
    text(f, '马尔可夫性：下一状态只看现在（无记忆）', 56, h - 168, { color: C.fg, font: '15px serif' });
    text(f, kind === '三态循环' ? '循环流破坏细致平衡 → 稳态有净概率流（非平衡稳态）' :
      kind === '两态生灭' ? '稳态：k₁P_A = k₂P_B（细致平衡，P_B/P_A = k₁/k₂）' :
        '对称随机游走：首达时间 ~ L²/D（扩散标度）',
      56, h - 138, { color: C.yellow, font: '15px serif' });
    // 右：主方程与概率演化
    const bx = w * 0.56;
    text(f, '主方程：', bx, 96, { color: C.yellow, font: '17px serif' });
    text(f, 'dP_n/dt = Σ_m [W_{n→m}P_m - W_{m→n}P_n]', bx, 140, { color: C.fg, font: '16px serif' });
    text(f, '流入 - 流出：概率守恒的连续性方程', bx, 184, { color: C.cool, font: '15px serif' });
    // 概率柱状动画
    const gy = h * 0.62;
    const pA = 1 / (1 + Math.exp(-Math.sin(f.t * 0.9) * 2));
    const bars: Array<[string, number, string]> = [['P_A', pA, C.cool], ['P_B', 1 - pA, C.warm]];
    bars.forEach(([name, p, color], i) => {
      const x = bx + i * 170;
      text(f, name, x + 40, gy - 14, { align: 'center', color, font: '15px serif' });
      poly(f, [[x, gy + 160], [x + 80, gy + 160], [x + 80, gy + 160 - p * 150], [x, gy + 160 - p * 150]],
        { fill: `${color}bb`, stroke: color, lw: 1.6 });
      text(f, p.toFixed(3), x + 40, gy + 184, { align: 'center', color: C.fg, font: '14px serif' });
    });
    text(f, '时间演化：指数趋近稳态（转移矩阵次大本征值定速率）', bx, gy + 220, { color: C.fg, font: '14px sans-serif' });
    text(f, '化学反应动力学、酶催化、病毒传播（SIR）都是主方程', bx, gy + 254, { color: C.green, font: '14px sans-serif' });
    footnotes(f, [
      '主方程=连续时间马尔可夫链的概率版本：从微观转移率到宏观动力学',
      '细致平衡 vs 循环流：平衡与非稳态热力学的分水岭（熵产生诊断）',
      'Kolmogorov 前向方程、Kramers-Moyal 展开：主方程的层级家族',
    ]);
    heading(f, '只看现在的概率账本');
  },
});
registerViz(masterEquationMarkov);

/** P596 蒙特卡洛方法与重要性抽样。 */
const monteCarloSampling = defineViz({
  slug: 'monte-carlo-sampling',
  title: '蒙特卡洛方法与重要性抽样',
  params: { integrand: { type: 'select', options: ['π 估算（投点）', '高维积分', '重要性抽样'], default: 'π 估算（投点）', label: '演示' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'integrand', 'π 估算（投点）');
    clear(f);
    const rand = rng(97);
    if (kind.startsWith('π')) {
      // 投点估计 π
      const cx = w * 0.3, cy = h * 0.46, R = 150;
      poly(f, [[cx - R, cy - R], [cx + R, cy - R], [cx + R, cy + R], [cx - R, cy + R]], { stroke: C.grid, lw: 2 });
      circle(f, cx, cy, R, { stroke: C.cool, lw: 2.4 });
      const N = 600;
      let inside = 0;
      for (let i = 0; i < N; i++) {
        const x = rand() * 2 - 1, y = rand() * 2 - 1;
        const isIn = x * x + y * y <= 1;
        if (isIn) inside++;
        if (i < 300) {
          dot(f, cx + x * R, cy + y * R, 2.4, isIn ? C.green : C.hot);
        }
      }
      const est = 4 * inside / N;
      text(f, `π ≈ 4·N_内/N = 4×${inside}/${N} = ${est.toFixed(4)}`, cx - R, cy + R + 44, { color: C.yellow, font: '16px serif' });
      text(f, `真值 3.14159…，误差 ~ 1/√N = ${(1 / Math.sqrt(N)).toFixed(4)}`, cx - R, cy + R + 76, { color: C.fg, font: '15px serif' });
      text(f, '收敛慢（1/√N）但与维度几乎无关 —— 高维积分的救星', cx - R, cy + R + 112, { color: C.cool, font: '15px serif' });
      footnotes(f, [
        '蒙特卡洛 = 用随机抽样近似期望：𝔼[f] ≈ 样本均值（大数定律担保）',
        '误差 ~ σ/√N：翻一位精度要 100 倍样本 —— 方差缩减技术的动机',
        '应用：格点 QCD、核反应堆屏蔽、期权定价、渲染方程',
      ]);
    } else if (kind === '高维积分') {
      // 维度灾难
      const v = view(f, { xMin: 0, xMax: 10, yMin: 0, yMax: 1.2, inset: 46, insetBottom: 46 });
      grid(f, v);
      const gridErr: Array<[number, number]> = [], mcErr: Array<[number, number]> = [];
      for (let i = 0; i <= 90; i++) {
        const d = i / 9;
        gridErr.push([v.sx(d), v.sy(Math.min(1.15, Math.pow(10, -d * 0.34 + 0.4)))]);
        mcErr.push([v.sx(d), v.sy(0.85 / Math.sqrt(30))]);
      }
      poly(f, gridErr, { stroke: C.hot, lw: 2.8 });
      poly(f, mcErr, { stroke: C.green, lw: 2.6, dash: [8, 5] });
      text(f, '红：规则网格法误差 ~ 每维 m 点 ⇒ m^d 个点爆炸', v.sx(0.3), v.sy(1.1), { color: C.hot, font: '14px serif' });
      text(f, '绿虚：蒙特卡洛误差 ~ 1/√N（与维度 d 无关！）', v.sx(0.3), v.sy(0.98), { color: C.green, font: '14px serif' });
      text(f, '维度 d', (v.sx(0) + v.sx(10)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
      text(f, '误差', v.sx(0.3), v.sy(1.18), { color: C.dim, font: '12px sans-serif' });
      text(f, '量子多体、路径积分配分函数：维度=自由度数（几百维起步）', 56, h - 116, { color: C.fg, font: '15px serif' });
      text(f, '网格法在 d>6 基本报废 —— 蒙特卡洛是唯一活路', 56, h - 86, { color: C.yellow, font: '15px serif' });
      footnotes(f, [
        '维度灾难：网格点数随维度指数增长，MC 误差只随样本根号下降',
        'MC 的代价换来了"维度无关性" —— 这笔交易在高维稳赚',
        '伪随机/低差异序列（准蒙特卡洛）：收敛可到 1/N（Korobov）',
      ]);
    } else {
      // 重要性抽样
      const v = view(f, { xMin: -4, xMax: 4, yMin: 0, yMax: 1.4, inset: 46, insetBottom: 46 });
      grid(f, v);
      const target = (x: number) => Math.exp(-x * x / 0.8) * 0.9; // 尖峰目标
      const proposal = (x: number) => Math.exp(-Math.abs(x) * 0.9) * 0.42; // 宽提议
      const t1: Array<[number, number]> = [], t2: Array<[number, number]> = [];
      for (let i = 0; i <= 300; i++) {
        const x = -4 + (i / 300) * 8;
        t1.push([v.sx(x), v.sy(Math.min(1.35, target(x)))]);
        t2.push([v.sx(x), v.sy(Math.min(1.35, proposal(x)))]);
      }
      poly(f, t1, { stroke: C.hot, lw: 2.8 });
      poly(f, t2, { stroke: C.cool, lw: 2.4, dash: [8, 5] });
      text(f, '红：目标函数（尖峰，直采浪费样本在零贡献区）', v.sx(-3.9), v.sy(1.32), { color: C.hot, font: '14px serif' });
      text(f, '蓝虚：提议分布 q(x)（罩住尖峰）', v.sx(-3.9), v.sy(1.18), { color: C.cool, font: '14px serif' });
      // 样本分布点
      const rand2 = rng(31);
      for (let i = 0; i < 60; i++) {
        const u = rand2();
        const x = -Math.sign(rand2() - 0.5) * Math.log(1 - u) / 0.9;
        if (Math.abs(x) < 4) dot(f, v.sx(x), v.sy(0.06), 3.4, C.yellow);
      }
      text(f, '⟨f⟩_q = ⟨f·p/q⟩_q：把样本"搬"到重要区域', v.sx(-3.9), v.sy(0.36), { color: C.yellow, font: '15px serif' });
      text(f, '权重 p/q 修正偏差：样本量同预算下误差大降', v.sx(-3.9), v.sy(0.22), { color: C.fg, font: '14px ' + 'serif' });
      text(f, 'MCMC：让马尔可夫链的稳态=p，免去直接抽样的困难', 56, h - 116, { color: C.green, font: '15px serif' });
      text(f, 'Metropolis-Hastings、Hamiltonian MC、退火 —— 贝叶斯推断的引擎', 56, h - 86, { color: C.cool, font: '14px sans-serif' });
      footnotes(f, [
        '重要性抽样：改变抽样分布但用权重改回 —— 方差缩减最直接的招',
        '最优提议 q* ∝ |f|·p：让样本全花在刀刃上（self-normalized 估计）',
        '退火重要性抽样、序贯 MC：温度参数化的一族方差缩减',
      ]);
    }
    void num;
  },
});
registerViz(monteCarloSampling);

/** P597 群表示与特征标表。 */
const groupCharacterTable = defineViz({
  slug: 'group-character-table',
  title: '群表示与特征标表',
  params: { group: { type: 'select', options: ['C₃ᵥ（氨分子）', 'D₄ₕ（方形）', 'S₃（置换）'], default: 'C₃ᵥ（氨分子）', label: '点群' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'group', 'C₃ᵥ（氨分子）');
    clear(f);
    // 左：对称操作示意
    const cx = w * 0.25, cy = h * 0.42;
    const ops = kind === 'C₃ᵥ（氨分子）'
      ? [['E', 0], ['C₃', 1], ['C₃²', 2], ['σᵥ', 3], ['σᵥ\'', 4], ['σᵥ\'\'', 5]] as Array<[string, number]>
      : kind === 'D₄ₕ（方形）'
        ? [['E', 0], ['C₄', 1], ['C₂', 2], ['C₄³', 3], ['σd', 4], ['…共 16 个', 5]] as Array<[string, number]>
        : [['E', 0], ['(12)', 1], ['(13)', 2], ['(23)', 3], ['(123)', 4], ['(132)', 5]] as Array<[string, number]>;
    ops.forEach(([name, i], idx) => {
      const col = idx % 3, row = Math.floor(idx / 3);
      const x = cx - 130 + col * 130, y = cy - 40 + row * 90;
      const active = Math.floor(f.t * 0.8) % 6 === idx;
      circle(f, x, y, 40, { fill: active ? 'rgba(236,201,75,0.5)' : 'rgba(102,126,234,0.3)', stroke: active ? C.yellow : C.accent, lw: active ? 3.4 : 2 });
      text(f, name, x, y + 6, { align: 'center', color: C.fg, font: '15px serif' });
      // 图形示意
      if (name.startsWith('C') && !name.startsWith('σ')) {
        text(f, '↻', x + 24, y - 24, { color: C.cool, font: '15px serif' });
      } else if (name.startsWith('σ')) {
        seg(f, x - 26, y + 26, x + 26, y - 26, C.warm, 2);
      }
    });
    text(f, `${kind}：群的"操作清单"（封闭的对称动作集合）`, 46, cy - 84, { color: C.fg, font: '15px serif' });
    text(f, '类：互相共轭的操作打包（特征标在类内相同）', 46, cy + 150, { color: C.cool, font: '14px serif' });
    // 右：特征标表
    const bx = w * 0.54;
    const tables: Record<string, { classes: string[]; rows: Array<[string, number[]]> }> = {
      'C₃ᵥ（氨分子）': {
        classes: ['E', '2C₃', '3σᵥ'],
        rows: [['A₁', [1, 1, 1]], ['A₂', [1, 1, -1]], ['E', [2, -1, 0]]],
      },
      'D₄ₕ（方形）': {
        classes: ['E', '2C₄', 'C₂', '2C₂\'', '…'],
        rows: [['A₁g', [1, 1, 1, 1]], ['B₁g', [1, -1, 1, 1]], ['E_g', [2, 0, -2, 0]]],
      },
      'S₃（置换）': {
        classes: ['E', '2C₃', '3σᵥ'],
        rows: [['A\'', [1, 1, 1]], ['A\'\'', [1, 1, -1]], ['E\'', [2, -1, 0]]],
      },
    };
    const tbl = tables[kind] ?? tables['C₃ᵥ（氨分子）'];
    text(f, '特征标表', bx, 100, { color: C.yellow, font: '17px serif' });
    // 表头
    tbl.classes.forEach((cls, c) => {
      text(f, cls, bx + 100 + c * 90, 144, { align: 'center', color: C.cool, font: '15px serif' });
    });
    seg(f, bx, 156, bx + 100 + tbl.classes.length * 90, 156, C.grid, 1.6);
    tbl.rows.forEach(([name, chars], r) => {
      const y = 186 + r * 56;
      text(f, name, bx + 44, y + 6, { align: 'center', color: C.hot, font: '16px serif' });
      chars.forEach((ch, c) => {
        text(f, String(ch), bx + 100 + c * 90, y + 6, { align: 'center', color: C.fg, font: '17px serif' });
      });
      seg(f, bx, y + 26, bx + 100 + tbl.classes.length * 90, y + 26, `${C.grid}88`, 1.2);
    });
    // 正交关系
    const oy = 186 + tbl.rows.length * 56 + 30;
    text(f, '正交关系：', bx, oy, { color: C.green, font: '16px serif' });
    text(f, 'Σ_g χᵢ(g)*χⱼ(g) = |G|δᵢⱼ', bx, oy + 38, { color: C.green, font: '17px serif' });
    text(f, '一张表两用：①分解表示 ②算跃迁（P599）', bx, oy + 82, { color: C.fg, font: '15px serif' });
    footnotes(f, [
      '特征标 χ = 表示矩阵的迹：相似不变 —— 不用画矩阵，数对角线即可',
      '不可约表示的数量 = 共轭类数（氨分子 3 类 ⇒ 3 个不可约表示）',
      '直积规则、投影算符 P = (d/|G|)Σχ*(R)D(R)：表示论的瑞士军刀',
    ]);
    heading(f, '一张表浓缩整个群');
  },
});
registerViz(groupCharacterTable);

/** P598 SO(3) 与 SU(2) 表示。 */
const so3Su2Representation = defineViz({
  slug: 'so3-su2-representation',
  title: 'SO(3) 与 SU(2) 表示',
  params: { view2: { type: 'select', options: ['双覆盖（转两圈回原点）', '自旋旋量旋转', '表示维数阶梯'], default: '双覆盖（转两圈回原点）', label: '演示' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = str(params, 'view2', '双覆盖（转两圈回原点）');
    clear(f);
    const cx = w * 0.3, cy = h * 0.46, R = 140;
    if (mode.startsWith('双覆盖')) {
      // SO(3) 圆与 SU(2) 双覆盖圆
      const { ctx } = f;
      ctx.save();
      ctx.strokeStyle = C.cool;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      text(f, 'SO(3)：物理旋转（转 360° 回原点）', cx - R, cy - R - 30, { color: C.cool, font: '15px serif' });
      // 运动点在 SO(3) 上
      const a = (f.t * 1.1) % (Math.PI * 2);
      dot(f, cx + Math.cos(a) * R, cy + Math.sin(a) * R, 9, C.hot);
      // SU(2) 上的对应点（双倍角）
      const bx = w * 0.72;
      ctx.save();
      ctx.strokeStyle = C.warm;
      ctx.lineWidth = 3.4;
      ctx.setLineDash([10, 7]);
      ctx.beginPath();
      ctx.arc(bx, cy, R * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      text(f, 'SU(2)：旋量空间（转 720° 才回原点）', bx - R, cy - R * 0.8 - 30, { color: C.warm, font: '15px serif' });
      const b = a * 2;
      dot(f, bx + Math.cos(b) * R * 0.8, cy + Math.sin(b) * R * 0.8, 9, C.yellow);
      // 连线
      seg(f, cx + Math.cos(a) * R + 12, cy + Math.sin(a) * R, bx + Math.cos(b) * R * 0.8 - 12, cy + Math.sin(b) * R * 0.8, `${C.green}aa`, 2, );
      text(f, `旋转角 θ = ${(a * 180 / Math.PI).toFixed(0)}°：SO(3) 走了 θ，SU(2) 走了 2θ`,
        (cx + bx) / 2 - 180, h * 0.86, { color: C.yellow, font: '16px serif' });
      text(f, '映射 SU(2) → SO(3) 是 2:1（核 = {±1}）—— 双覆盖群', (cx + bx) / 2 - 180, h * 0.86 + 34, { color: C.fg, font: '15px serif' });
      text(f, '物理后果：电子自旋旋转 720° 才复原（中子干涉实验证实）', (cx + bx) / 2 - 180, h * 0.86 + 68, { color: C.hot, font: '15px serif' });
    } else if (mode === '自旋旋量旋转') {
      // 旋量在 Bloch 球上转半角
      circle(f, cx, cy, R, { stroke: C.cool, lw: 2.4 });
      const { ctx } = f;
      ctx.save();
      ctx.strokeStyle = `${C.grid}aa`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, R, R * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      const th = f.t * 1.2;
      // 经过 2π 旋量相位反号
      const mod2 = ((th % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const px = cx + Math.sin(th) * R * 0.85, py = cy - Math.cos(th) * R * 0.85;
      vec(f, cx, cy, px, py, C.hot, 3.4);
      const sign = Math.cos(th / 2) >= 0 ? '+' : '-';
      text(f, `旋量符号：${sign}（转过 π 时翻号）`, cx - R, cy + R + 46, { color: C.hot, font: '16px serif' });
      text(f, `当前转角 ${(mod2 * 180 / Math.PI).toFixed(0)}°，旋量相位 ±1`, cx - R, cy + R + 80, { color: C.yellow, font: '15px serif' });
      text(f, '旋量 = SO(3) 的"平方根表示"：波函数在旋转下的行为', cx - R, cy + R + 114, { color: C.fg, font: '15px ' + 'serif' });
      void sign;
    } else {
      // 表示维数阶梯
      const bx = 80;
      text(f, 'SO(3) 的不可约表示按 j = 0, 1/2, 1, 3/2, … 分级：', bx, 100, { color: C.yellow, font: '17px serif' });
      const ladder = [
        ['j = 0', '1 维（标量）', '整数 j → SO(3) 单值（轨道角动量）', C.cool],
        ['j = 1/2', '2 维（旋量）', '半整数 j → 只在 SU(2) 单值（自旋）', C.hot],
        ['j = 1', '3 维（矢量）', '四极矩、引力波偏振', C.green],
        ['j = 3/2', '4 维', '核共振跃迁的多极混合', C.warm],
        ['j = 2', '5 维', '引力子（待发现的自旋 2 粒子）', C.pink],
      ] as Array<[string, string, string, string]>;
      ladder.forEach(([j, dim, note, color], i) => {
        const y = 148 + i * 74;
        poly(f, [[bx, y], [bx + 660, y], [bx + 660, y + 58], [bx, y + 58]],
          { fill: `${color}14`, stroke: color, lw: 1.8 });
        text(f, j, bx + 16, y + 37, { color, font: '17px serif' });
        text(f, dim, bx + 130, y + 37, { color: C.fg, font: '15px serif' });
        text(f, note, bx + 300, y + 37, { color: C.dim, font: '14px sans-serif' });
      });
      text(f, '自旋统계定理：整数→玻色子，半整数→费米子（相对论+量子的联合判决）',
        bx, 148 + 5 * 74 + 24, { color: C.yellow, font: '16px serif' });
    }
    footnotes(f, [
      'SO(3) 与 SU(2) 的关系是"自旋为什么存在"的群论答案',
      '泡利矩阵生成 SU(2) 李代数：σ/2 是自旋 1/2 的角动量算符',
      '旋量的 720° 周期被中子衍射（Rauch 1975）直接观测 —— 群论的实验判决',
    ]);
    heading(f, '半整数自旋为什么存在的群论答案');
  },
});
registerViz(so3Su2Representation);

/** P599 不可约表示与选择定则。 */
const selectionRules = defineViz({
  slug: 'group-selection-rules',
  title: '不可约表示与选择定则',
  params: { transition: { type: 'select', options: ['电偶极跃迁（光学）', '分子振动 IR/Raman', '核跃迁多极'], default: '电偶极跃迁（光学）', label: '跃迁类型' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'transition', '电偶极跃迁（光学）');
    clear(f);
    // 左：跃迁示意
    const cx = w * 0.26;
    if (kind.startsWith('电偶极')) {
      // 能级与选择定则
      const levels = [
        { y: h * 0.66, label: '2p (L=1)', color: C.warm },
        { y: h * 0.4, label: '1s (L=0)', color: C.cool },
        { y: h * 0.24, label: '2s (L=0)', color: C.cool },
      ];
      levels.forEach((lv) => {
        seg(f, cx - 140, lv.y, cx + 140, lv.y, lv.color, 3.4);
        text(f, lv.label, cx + 150, lv.y + 5, { color: lv.color, font: '14px serif' });
      });
      // 允许跃迁
      vec(f, cx - 40, levels[0].y - 4, cx - 40, levels[1].y + 4, C.green, 3.4);
      text(f, 'ΔL = ±1 ✓（允许）', cx - 200, (levels[0].y + levels[1].y) / 2, { color: C.green, font: '14px serif' });
      // 禁戒跃迁
      vec(f, cx + 60, levels[2].y + 4, cx + 60, levels[1].y - 4, C.hot, 2.6, );
      seg(f, cx + 52, (levels[0].y + levels[1].y) / 2 - 8, cx + 68, (levels[0].y + levels[1].y) / 2 + 8, C.hot, 3);
      seg(f, cx + 68, (levels[0].y + levels[1].y) / 2 - 8, cx + 52, (levels[0].y + levels[1].y) / 2 + 8, C.hot, 3);
      text(f, '2s→1s：ΔL = 0 ✗（禁戒）', cx + 74, (levels[0].y + levels[1].y) / 2, { color: C.hot, font: '14px serif' });
      text(f, '宇称必须改变（Laporte 定则）：电偶极算符是奇宇称', cx - 200, h * 0.78, { color: C.yellow, font: '15px serif' });
      text(f, '寿命对比：允许 ~10⁻⁸ s，禁戒 ~10⁻² s（亚稳态！）', cx - 200, h * 0.78 + 34, { color: C.fg, font: '14px ' + 'serif' });
    } else if (kind.startsWith('分子振动')) {
      text(f, 'IR 活性 ⇔ 偶极矩变化（∂μ/∂Q ≠ 0）', cx - 200, h * 0.3, { color: C.yellow, font: '16px serif' });
      text(f, 'Raman 活性 ⇔ 极化率变化（∂α/∂Q ≠ 0）', cx - 200, h * 0.3 + 40, { color: C.cool, font: '16px serif' });
      // CO2 三种模式
      const modes = [['对称伸缩', 'IR✗ Raman✓'], ['反对称伸缩', 'IR✓ Raman✗'], ['弯曲', 'IR✓ Raman✗']];
      modes.forEach(([name, act], i) => {
        const y = h * 0.44 + i * 70;
        text(f, name, cx - 200, y, { color: C.fg, font: '15px serif' });
        const irOk = act.includes('IR✓');
        text(f, act, cx + 40, y, { color: irOk ? C.green : C.warm, font: '15px serif' });
        // 分子示意
        const mx = cx + 180, my = y - 8;
        dot(f, mx - 34, my, 9, C.cool);
        dot(f, mx, my, 11, C.hot);
        dot(f, mx + 34, my, 9, C.cool);
        const wig = Math.sin(f.t * 3 + i) * 6;
        if (i === 0) { dot(f, mx - 34 - wig, my, 9, C.cool); dot(f, mx + 34 + wig, my, 9, C.cool); }
        if (i === 1) { dot(f, mx - 34 + wig, my, 9, C.cool); dot(f, mx + 34 + wig, my, 9, C.cool); }
        if (i === 2) { dot(f, mx, my - wig, 11, C.hot); }
      });
      text(f, '同核双原子（O₂/N₂）：IR 全禁 —— 大气温室效应的选择性根源', cx - 200, h * 0.44 + 3 * 70 + 24, { color: C.hot, font: '15px serif' });
    } else {
      text(f, '核跃迁多极展开：E1 ≫ M1 ≫ E2 ≫ M2 …', cx - 200, h * 0.3, { color: C.yellow, font: '16px serif' });
      const mult = [['E1 电偶极', '~10⁻⁸ s', C.green], ['M1 磁偶极', '~10⁻¹⁶ s', C.cool], ['E2 电四极', '~10⁻⁶ s', C.warm], ['E3+ 禁戒', '~10⁰–10³ s', C.hot]];
      mult.forEach(([name, life, color], i) => {
        const y = h * 0.42 + i * 66;
        poly(f, [[cx - 200, y], [cx + 170, y], [cx + 170, y + 48], [cx - 200, y + 48]],
          { fill: `${color}16`, stroke: color, lw: 1.8 });
        text(f, name, cx - 186, y + 30, { color, font: '15px serif' });
        text(f, life, cx + 40, y + 30, { color: C.fg, font: '15px serif' });
      });
      text(f, '高阶多极被"压低"（kR 的幂次）—— 半径越小禁戒越狠', cx - 200, h * 0.42 + 4 * 66 + 24, { color: C.fg, font: '15px serif' });
    }
    // 右侧：群论判据
    const bx = w * 0.58;
    text(f, '群论的一行判据：', bx, 96, { color: C.yellow, font: '18px serif' });
    text(f, '⟨f|Q|i⟩ ≠ 0 ⇔ Γ_f ⊗ Γ_Q ⊗ Γ_i 含 A₁', bx, 144, { color: C.hot, font: '16px serif' });
    text(f, '（直积表示里出现恒等表示 = 矩阵元不被对称性杀掉）', bx, 184, { color: C.fg, font: '15px serif' });
    const steps = [
      ['① 查分子点群的特征标表', C.cool],
      ['② 算 Γ_f ⊗ Γ_Q ⊗ Γ_i 的特征标', C.green],
      ['③ 数 A₁ 出现次数 = 独立矩阵元个数', C.warm],
      ['④ 为零 → 对称性禁戒（不用算积分！）', C.hot],
    ] as Array<[string, string]>;
    steps.forEach(([s, color], i) => {
      const y = 244 + i * 62;
      poly(f, [[bx, y], [bx + 360, y], [bx + 360, y + 48], [bx, y + 48]],
        { fill: `${color}14`, stroke: `${color}bb`, lw: 1.8 });
      text(f, s, bx + 14, y + 31, { color, font: '15px serif' });
    });
    text(f, '不写波函数就能预言"看不见"—— 对称性威力的最好展示', bx, 244 + 4 * 62 + 24, { color: C.yellow, font: '15px serif' });
    text(f, '宇称守恒破坏（吴健雄实验）也改写了这里的某些"禁戒"', bx, 244 + 4 * 62 + 60, { color: C.pink, font: '14px serif' });
    footnotes(f, [
      '选择定则三来源：对称性（群论）、守恒律（角动量/宇称）、动力学（跃迁矩非零）',
      '直积分解公式：Γ_f⊗Γ_i 中 A₁ 的次数 = ⟨f|Q|i⟩ 允许的独立分量数',
      '红外、拉曼、核谱、X 射线发射：同一张特征标表管全部',
    ]);
    heading(f, '直积里有没有恒等表示，跃迁就有没有戏');
  },
});
registerViz(selectionRules);

/** P600 对称性破缺与序参量。 */
const symmetryBreakingOrder = defineViz({
  slug: 'symmetry-breaking-order',
  title: '对称性破缺与序参量',
  params: { temp: { type: 'range', min: 0, max: 100, default: 40, step: 5, label: '温度 T/T_c (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const T = num(params, 'temp', 40) / 100;
    clear(f);
    // 左：墨西哥帽势（朗道势）
    const cx = w * 0.28, cy = h * 0.46, R = 150;
    const { ctx } = f;
    // 用同心椭圆画帽子（俯视+侧视混合示意）
    const hatR = T > 1 ? 0 : (1 - T) * 70 + 14;
    // 帽檐环（极小值圆）
    for (let k = 3; k >= 1; k--) {
      ctx.save();
      ctx.strokeStyle = k === 1 && T <= 1 ? C.hot : `rgba(66,153,225,${0.16 + (3 - k) * 0.14})`;
      ctx.lineWidth = k === 1 && T <= 1 ? 3.4 : 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 40, hatR + k * 26, (hatR + k * 26) * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    text(f, T > 1 ? 'T > T_c：帽子塌平 —— 对称的碗底（无序相）' :
      'T < T_c：环形谷 —— 真空选一个点（对称破缺）', cx - 200, cy - 130,
      { color: T > 1 ? C.cool : C.hot, font: '15px serif' });
    // 小球在环上滚动
    if (T <= 1) {
      const a = f.t * 1.3;
      const bx0 = cx + Math.cos(a) * hatR, by0 = cy + 40 + Math.sin(a) * hatR * 0.4;
      dot(f, bx0, by0, 9, C.yellow);
      text(f, '序参量选了这个方向（简并真空）', cx - 200, cy + 150, { color: C.yellow, font: '15px serif' });
      text(f, '金石玻色 = 谷底滚小球（恢复对称的激发，零质量）', cx - 200, cy + 184, { color: C.green, font: '15px serif' });
    } else {
      text(f, '小球在中心：⟨φ⟩ = 0（对称保持，无序）', cx - 200, cy + 150, { color: C.cool, font: '15px serif' });
      text(f, '降温穿过 T_c：势自发长出环形谷 —— 相变发生', cx - 200, cy + 184, { color: C.hot, font: '15px serif' });
    }
    // 右：序参量曲线
    const v = view(f, { xMin: 0, xMax: 1.3, yMin: 0, yMax: 1.3, inset: w * 0.54, insetRight: 46, insetBottom: 46 });
    grid(f, v);
    const order = (t: number) => (t < 1 ? Math.pow(1 - t, 0.5) : 0);
    const curve1: Array<[number, number]> = [];
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * 1.3;
      curve1.push([v.sx(t), v.sy(order(t))]);
    }
    poly(f, curve1, { stroke: C.accent, lw: 3.2 });
    dot(f, v.sx(T), v.sy(order(T)), 8, C.hot);
    seg(f, v.sx(1), v.sy(0), v.sx(1), v.sy(1.3), `${C.yellow}aa`, 1.8);
    text(f, 'T_c', v.sx(1) + 8, v.sy(1.24), { color: C.yellow, font: '14px serif' });
    text(f, '序参量 φ(T)：β = 1/2（平均场）', v.sx(0.05), v.sy(1.25), { color: C.fg, font: '14px serif' });
    text(f, `当前 T/T_c = ${T.toFixed(2)}　φ = ${order(T).toFixed(3)}`, v.sx(0.05), v.sy(1.12), { color: C.hot, font: '14px serif' });
    text(f, 'T/T_c', (v.sx(0) + v.sx(1.3)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    // 右下：例子
    const ex = [
      ['铁磁：φ = 磁化强度 M', 'T_c = 居里点', C.warm],
      ['超导：φ = 对凝聚相位', '规范对称破缺 ⇒ 光子有质量（Meissner）', C.cool],
      ['Higgs：φ = 真空期望值 ≠ 0', 'W/Z 获得质量，电磁与弱力分家', C.hot],
      ['液晶/铁电/BCS：同一朗道语法', '序参量+对称性+涨落 = 相变三件套', C.green],
    ] as Array<[string, string, string]>;
    ex.forEach(([name, note, color], i) => {
      const y = h - 200 + i * 46;
      text(f, '· ' + name, w * 0.54, y, { color, font: '14px serif' });
      text(f, note, w * 0.54 + 240, y, { color: C.dim, font: '13px sans-serif' });
    });
    footnotes(f, [
      '朗道范式：对称性+序参量分类一切连续相变（1937，1962 诺奖）',
      '戈德斯通定理：连续对称破缺 ⇒ 无质量玻色子（超流声子、自旋波）',
      '希格斯机制：规范对称破缺时戈德斯通道被"吃掉" → 规范玻色子变重',
    ]);
    heading(f, '真空选了不对称的答案');
  },
});
registerViz(symmetryBreakingOrder);