import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text, view, grid, curve, circle, vec, rng } from '../canvas';

/** P566 傅里叶级数与收敛性。 */
const fourierSeriesConvergence = defineViz({
  slug: 'fourier-series-convergence',
  title: '傅里叶级数与收敛性',
  params: { wave: { type: 'select', options: ['方波', '锯齿波', '三角波'], default: '方波', label: '目标波形' }, N: { type: 'range', min: 1, max: 31, default: 9, step: 2, label: '级数项数 N' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'wave', '方波');
    const N = Math.round(num(params, 'N', 9));
    clear(f);
    const v = view(f, { xMin: -3.4, xMax: 3.4, yMin: -1.6, yMax: 1.9, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 目标波形
    const target = (x: number): number => {
      if (kind === '方波') return Math.sign(Math.sin(x));
      if (kind === '锯齿波') return (((x + Math.PI) % (2 * Math.PI)) / Math.PI) - 1;
      const t = ((x + Math.PI) % (2 * Math.PI)) / Math.PI;
      return 4 * Math.abs(t - 0.5) - 1;
    };
    const tpts: Array<[number, number]> = [];
    for (let i = 0; i <= 500; i++) {
      const x = -3.4 + (i / 500) * 6.8;
      tpts.push([v.sx(x), v.sy(target(x))]);
    }
    poly(f, tpts, { stroke: `${C.dim}bb`, lw: 2, dash: [7, 5] });
    // 部分和
    const partial = (x: number): number => {
      let s = 0;
      if (kind === '方波') {
        for (let n = 1; n <= N; n += 2) s += Math.sin(n * x) / n;
        return (4 / Math.PI) * s;
      }
      if (kind === '锯齿波') {
        for (let n = 1; n <= N; n++) s += Math.pow(-1, n + 1) * Math.sin(n * x) / n;
        return (2 / Math.PI) * s;
      }
      for (let n = 1; n <= N; n += 2) {
        const k = (n - 1) / 2;
        s += Math.pow(-1, k) * Math.cos(n * x) / (n * n);
      }
      return (8 / (Math.PI * Math.PI)) * s;
    };
    const spts: Array<[number, number]> = [];
    for (let i = 0; i <= 500; i++) {
      const x = -3.4 + (i / 500) * 6.8;
      const y = partial(x);
      if (Math.abs(y) > 2.4) continue;
      spts.push([v.sx(x), v.sy(y)]);
    }
    poly(f, spts, { stroke: C.accent, lw: 2.8 });
    // 吉布斯现象标记（方波跳变处）
    if (kind === '方波') {
      for (const x0 of [-Math.PI, 0, Math.PI]) {
        seg(f, v.sx(x0), v.sy(1.05), v.sx(x0), v.sy(1.25), C.hot, 2);
      }
      text(f, '↑ 跳变处过冲 ≈ 9%（吉布斯，N 增大不消失只变窄）', v.sx(-3.3), v.sy(1.75), { color: C.hot, font: '14px serif' });
    }
    text(f, `前 ${N} 项部分和（蓝实） vs 目标（灰虚）`, v.sx(-3.3), v.sy(1.5), { color: C.fg, font: '14px serif' });
    text(f, kind === '方波' ? '奇函数 → 只有正弦项' : kind === '锯齿波' ? '半波对称 → 基波+奇次谐波' : '偶函数 → 只有余弦项（1/n² 收敛快）',
      v.sx(-3.3), v.sy(-1.45), { color: C.yellow, font: '14px serif' });
    text(f, 'x', (v.sx(-3.4) + v.sx(3.4)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      '系数公式 a_n、b_n = 内积投影：正交性让每个谐波独立计价',
      '收敛性分层：连续光滑 → 一致收敛；有跳变 → 间断点 1/2 与吉布斯过冲',
      'Parseval：时域能量 = 频域能量之和 —— 压缩与通信的理论底线',
    ]);
    heading(f, '任何周期信号都是正弦的合唱');
  },
});
registerViz(fourierSeriesConvergence);

/** P567 傅里叶变换与卷积定理。 */
const fourierConvolution = defineViz({
  slug: 'fourier-convolution',
  title: '傅里叶变换与卷积定理',
  params: { op: { type: 'select', options: ['卷积（时域）', '相乘（频域）'], default: '卷积（时域）', label: '演示侧' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = str(params, 'op', '卷积（时域）');
    clear(f);
    const shift = Math.sin(f.t * 1.1) * 1.6;
    if (mode === '卷积（时域）') {
      // 三行：f、g、f*g
      const rows = [
        { y: h * 0.26, label: 'f(t)：矩形窗', color: C.cool, fn: (x: number) => (Math.abs(x) < 1 ? 1 : 0) },
        { y: h * 0.52, label: `g(t)：高斯（中心 ${shift.toFixed(1)}）`, color: C.warm, fn: (x: number) => Math.exp(-Math.pow((x - shift) * 1.4, 2)) },
        { y: h * 0.78, label: 'f ∗ g：卷积结果（平滑化）', color: C.green, fn: (x: number) => 0 },
      ];
      for (let r = 0; r < 3; r++) {
        const row = rows[r];
        const x0 = 60, x1 = w - 60;
        seg(f, x0, row.y, x1, row.y, C.grid, 1.4);
        text(f, row.label, x0, row.y - 64, { color: row.color, font: '14px serif' });
        const pts: Array<[number, number]> = [];
        for (let i = 0; i <= 300; i++) {
          const x = -3.2 + (i / 300) * 6.4;
          let val: number;
          if (r === 0) val = row.fn(x);
          else if (r === 1) val = row.fn(x);
          else {
            // 解析卷积：矩形*高斯 ≈ 平顶 erf
            const erfApprox = (t: number) => 1 - Math.exp(-Math.pow(t * 1.6, 2)) * 0.9;
            val = 0.5 * (erfApprox(x + 1 - shift) + erfApprox(-(x - 1 - shift))) * Math.exp(-Math.pow(shift * 0.4, 2)) + 0.45;
          }
          pts.push([x0 + ((x + 3.2) / 6.4) * (x1 - x0), row.y - val * 56]);
        }
        poly(f, pts, { stroke: row.color, lw: 2.6 });
      }
      text(f, '卷积 = 把 g 平移着"抹"过 f：每个输出点是加权平均', 60, h * 0.78 + 56, { color: C.fg, font: '15px serif' });
      text(f, '效果：平滑、模糊、展宽 —— 滤波的时域视角', 60, h * 0.78 + 86, { color: C.yellow, font: '14px serif' });
    } else {
      // 频域：乘法
      const v = view(f, { xMin: -5, xMax: 5, yMin: 0, yMax: 1.4, inset: 46, insetBottom: 46 });
      grid(f, v);
      // F(ω) sinc，G(ω) 高斯
      const F = (x: number) => (Math.abs(x) < 0.02 ? 1 : Math.abs(Math.sin(x * 1.6) / (x * 1.6)));
      const G = (x: number) => Math.exp(-Math.pow((x - shift * 0.6) * 0.9, 2));
      const p1: Array<[number, number]> = [], p2: Array<[number, number]> = [], p3: Array<[number, number]> = [];
      for (let i = 0; i <= 400; i++) {
        const x = -5 + (i / 400) * 10;
        p1.push([v.sx(x), v.sy(Math.min(1.35, F(x)))]);
        p2.push([v.sx(x), v.sy(Math.min(1.35, G(x)) * 0.9)]);
        p3.push([v.sx(x), v.sy(Math.min(1.35, F(x) * G(x)))]);
      }
      poly(f, p1, { stroke: C.cool, lw: 2.2, dash: [7, 5] });
      poly(f, p2, { stroke: C.warm, lw: 2.2, dash: [7, 5] });
      poly(f, p3, { stroke: C.green, lw: 3 });
      text(f, '蓝虚：F(ω)　橙虚：G(ω)　绿实：F·G（乘积）', v.sx(-4.9), v.sy(1.33), { color: C.fg, font: '14px serif' });
      text(f, '频域相乘 = 时域卷积 —— 两个视角一个账本', v.sx(-4.9), v.sy(1.2), { color: C.yellow, font: '14px serif' });
      text(f, '低通=乘窗截高频 ⇒ 时域变模糊（高斯抹平一切细节）', v.sx(-4.9), v.sy(0.1), { color: C.hot, font: '14px serif' });
      text(f, 'ω', (v.sx(-5) + v.sx(5)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
      footnotes(f, [
        '卷积定理：ℱ[f∗g] = ℱ[f]·ℱ[f] —— 乘法比卷积好算，这就是 FFT 的意义',
        '窗函数决定频谱泄漏：矩形窗 sinc 旁瓣、汉宁窗旁瓣小但主瓣宽',
        '成像系统的点扩散函数 PSF：像 = 物 ∗ PSF，频域里是乘积',
      ]);
      heading(f, '时域卷积=频域相乘');
      return;
    }
    footnotes(f, [
      '卷积定理：ℱ[f∗g] = ℱ[f]·ℱ[g] —— 乘法比卷积好算，FFT 因此改变世界',
      '物理对应：散射/成像 = 真实结构与仪器响应的卷积（分辨受限的根源）',
      '概率论：独立随机变量之和的分布 = 各自分布的卷积（CLT 的入口）',
    ]);
    heading(f, '两个视角一本账');
  },
});
registerViz(fourierConvolution);

/** P568 δ 函数与广义函数。 */
const diracDeltaGeneralized = defineViz({
  slug: 'dirac-delta-generalized',
  title: 'δ 函数与广义函数',
  params: { eps: { type: 'range', min: 1, max: 60, default: 12, step: 1, label: '脉冲宽度 ε⁻¹' } },
  draw: (f) => {
    const { w, h, params } = f;
    const narrow = num(params, 'eps', 12);
    clear(f);
    const v = view(f, { xMin: -3, xMax: 3, yMin: 0, yMax: 1.4, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 一列越来越窄的脉冲（面积恒为 1）
    const widths = [1.4, 0.8, 0.4];
    const colors = [C.cool, C.warm, C.hot];
    widths.forEach((wd, i) => {
      const pts: Array<[number, number]> = [];
      const scaled = wd * (12 / narrow);
      for (let i2 = 0; i2 <= 300; i2++) {
        const x = -3 + (i2 / 300) * 6;
        const val = (1 / scaled) * Math.exp(-Math.pow(x / scaled, 2)) * 0.34;
        if (val > 1.42) continue;
        pts.push([v.sx(x), v.sy(val)]);
      }
      poly(f, pts, { stroke: colors[i], lw: 2.4 });
    });
    // 当前最窄脉冲
    const cur = 0.25 * (12 / narrow);
    const p2: Array<[number, number]> = [];
    for (let i = 0; i <= 300; i++) {
      const x = -3 + (i / 300) * 6;
      const val = (1 / cur) * Math.exp(-Math.pow(x / cur, 2)) * 0.34;
      if (val > 1.42) continue;
      p2.push([v.sx(x), v.sy(val)]);
    }
    poly(f, p2, { stroke: C.pink, lw: 3 });
    text(f, '一族脉冲：宽度 → 0，高度 → ∞，但面积恒 = 1', v.sx(-2.9), v.sy(1.34), { color: C.fg, font: '15px serif' });
    text(f, `当前宽度 ∝ 1/${narrow}：∫δ(x)dx = 1 永远成立`, v.sx(-2.9), v.sy(1.2), { color: C.pink, font: '14px serif' });
    // 筛选性质演示
    const g0 = 0.7;
    dot(f, v.sx(g0), v.sy(0.1), 7, C.yellow);
    text(f, `∫f(x)δ(x−x₀)dx = f(x₀)：δ 挑出一点的值（筛选）`, v.sx(-2.9), v.sy(0.36), { color: C.yellow, font: '15px serif' });
    text(f, 'x', (v.sx(-3) + v.sx(3)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    // 底部：严格化
    text(f, '严格化：δ 是作用在测试函数上的线性泛函（施瓦茨分布）—— 不是函数', 56, h - 148, { color: C.green, font: '16px serif' });
    text(f, '导数也有定义：⟨δ\', φ⟩ = −φ\'(0)（分部积分的移植）', 56, h - 118, { color: C.cool, font: '15px serif' });
    text(f, '傅里叶视角：δ = 所有频率等权叠加 —— 白噪声的确定性版本', 56, h - 88, { color: C.hot, font: '15px serif' });
    footnotes(f, [
      '物理学家的 δ"不合法"（在 0 点发散）—— 分布论让直觉合法化',
      '点源、脉冲、初值条件、本征态归一 ⟨x|x\'⟩=δ(x−x\')：处处是它',
      '正规化家族：sinc 极限、洛伦兹峰、高斯窄包 —— 结果与选型无关',
    ]);
    heading(f, '把不合法的函数请进严格框架');
  },
});
registerViz(diracDeltaGeneralized);

/** P569 拉普拉斯变换与求解器。 */
const laplaceTransformSolve = defineViz({
  slug: 'laplace-transform-solve',
  title: '拉普拉斯变换与求解器',
  params: { problem: { type: 'select', options: ['RLC 暂态', '积分方程', '阻尼振荡'], default: 'RLC 暂态', label: '问题' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'problem', 'RLC 暂态');
    clear(f);
    // 左：变换流程
    const bx = 56;
    text(f, '拉氏变换的解题流水线：', bx, 92, { color: C.yellow, font: '17px serif' });
    const flow = [
      ['① 时域方程（微分/积分）', C.cool],
      ['② 变换 → s 域代数方程', C.green],
      ['③ 代数解出 U(s)', C.warm],
      ['④ 逆变换回时域（查表+部分分式）', C.hot],
    ] as Array<[string, string]>;
    flow.forEach(([s, color], i) => {
      const y = 130 + i * 66;
      poly(f, [[bx, y], [bx + 370, y], [bx + 370, y + 50], [bx, y + 50]],
        { fill: `${color}14`, stroke: `${color}bb`, lw: 1.8 });
      text(f, s, bx + 14, y + 32, { color, font: '15px serif' });
      if (i < 3) vec(f, bx + 185, y + 50, bx + 185, y + 62, C.dim, 1.6, 6);
    });
    const keyLines: Record<string, string[]> = {
      'RLC 暂态': ['L·di/dt + Ri + (1/C)∫i dt = V(t)', '⇒ LsI + RI + I/(Cs) = V(s)（微积分全变乘除）'],
      '积分方程': ['f(t) + ∫K(t−τ)f(τ)dτ = g(t)', '⇒ F + K·F = G（积分变乘法！）'],
      '阻尼振荡': ['x\'\' + 2ζωx\' + ω²x = 0', '⇒ s² + 2ζωs + ω² = 0（特征方程即分母）'],
    };
    (keyLines[kind] ?? keyLines['RLC 暂态']).forEach((s, i) => {
      text(f, s, bx, 130 + 4 * 66 + 30 + i * 34, { color: i === 0 ? C.fg : C.green, font: '15px serif' });
    });
    // 右：s 平面极点与响应
    const cx = w * 0.74, cy = h * 0.44;
    seg(f, cx - 150, cy, cx + 150, cy, C.dim, 1.5);
    seg(f, cx, cy - 130, cx, cy + 130, C.dim, 1.5);
    text(f, 'Re s', cx + 156, cy + 16, { color: C.dim, font: '13px serif' });
    text(f, 'Im s', cx + 8, cy - 138, { color: C.dim, font: '13px serif' });
    // 极点位置决定响应形态
    const mode = kind === '阻尼振荡' ? 'complex' : kind === 'RLC 暂态' ? 'complex' : 'real';
    if (mode === 'complex') {
      dot(f, cx - 60, cy - 50, 9, C.hot);
      dot(f, cx - 60, cy + 50, 9, C.hot);
      text(f, 's = −ζω ± iω_d', cx - 130, cy - 74, { color: C.hot, font: '14px serif' });
      text(f, '左半平面 ⇒ e^{−at}cos(ωt)：衰减振荡', cx - 150, cy + 160, { color: C.green, font: '14px serif' });
    } else {
      dot(f, cx - 90, cy, 9, C.hot);
      dot(f, cx - 30, cy, 9, C.warm);
      text(f, '实极点 ⇒ 指数衰减叠加', cx - 150, cy - 30, { color: C.hot, font: '14px serif' });
      text(f, '极点位置 = 时域行为的密码', cx - 150, cy + 160, { color: C.green, font: '14px serif' });
    }
    text(f, '右半平面极点 ⇒ 发散（不稳定！）', cx - 150, cy + 190, { color: C.yellow, font: '14px serif' });
    footnotes(f, [
      '拉氏变换把"微积分"变成"乘除"：初值定理/终值定理还能一步查首末',
      '核心表只有十几条：线性、微分、位移、卷积四条撑起全部运算',
      '控制系统稳定性的根轨迹、波特图都从 s 平面极点出发',
    ]);
    heading(f, '微分变乘法的代数捷径');
  },
});
registerViz(laplaceTransformSolve);

/** P570 多维傅里叶变换与衍射。 */
const multidimFourierDiffraction = defineViz({
  slug: 'multidim-fourier-diffraction',
  title: '多维傅里叶变换与衍射',
  params: { aperture: { type: 'select', options: ['单缝', '双缝', '圆孔', '方格网'], default: '圆孔', label: '光瞳形状' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'aperture', '圆孔');
    clear(f);
    // 左：光瞳（物）
    const ax = w * 0.25, ay = h * 0.4, S = 150;
    poly(f, [[ax - S / 2, ay - S / 2], [ax + S / 2, ay - S / 2], [ax + S / 2, ay + S / 2], [ax - S / 2, ay + S / 2]],
      { stroke: C.grid, lw: 1.6, fill: '#0d1117' });
    text(f, '光瞳 P(x,y)（透过=1，其余=0）', ax, ay - S / 2 - 16, { align: 'center', color: C.fg, font: '14px serif' });
    if (kind === '单缝') {
      poly(f, [[ax - 16, ay - 60], [ax + 16, ay - 60], [ax + 16, ay + 60], [ax - 16, ay + 60]], { fill: 'rgba(236,201,75,0.85)' });
    } else if (kind === '双缝') {
      poly(f, [[ax - 26, ay - 56], [ax - 8, ay - 56], [ax - 8, ay + 56], [ax - 26, ay + 56]], { fill: 'rgba(236,201,75,0.85)' });
      poly(f, [[ax + 8, ay - 56], [ax + 26, ay - 56], [ax + 26, ay + 56], [ax + 8, ay + 56]], { fill: 'rgba(236,201,75,0.85)' });
    } else if (kind === '圆孔') {
      circle(f, ax, ay, 54, { fill: 'rgba(236,201,75,0.85)' });
    } else {
      for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) {
          if ((i + j) % 2 === 0) poly(f, [[ax + i * 26 - 10, ay + j * 26 - 10], [ax + i * 26 + 10, ay + j * 26 - 10], [ax + i * 26 + 10, ay + j * 26 + 10], [ax + i * 26 - 10, ay + j * 26 + 10]], { fill: 'rgba(236,201,75,0.85)' });
        }
      }
    }
    // 箭头：变换
    vec(f, ax + S / 2 + 20, ay, w * 0.5 - 20, ay, C.yellow, 3.4, 11);
    text(f, 'ℱ', (ax + S / 2 + w * 0.5) / 2, ay - 16, { align: 'center', color: C.yellow, font: '20px serif' });
    // 右：衍射图样（屏幕）
    const bx = w * 0.75;
    poly(f, [[bx - S / 2, ay - S / 2], [bx + S / 2, ay - S / 2], [bx + S / 2, ay + S / 2], [bx - S / 2, ay + S / 2]],
      { stroke: C.grid, lw: 1.6, fill: '#0d1117' });
    text(f, '|ℱ{P}|²：夫琅禾费衍射图样', bx, ay - S / 2 - 16, { align: 'center', color: C.yellow, font: '14px serif' });
    // 图样渲染
    const cell = 7;
    for (let gx = -S / 2; gx < S / 2; gx += cell) {
      for (let gy = -S / 2; gy < S / 2; gy += cell) {
        const u = gx / 34, vv = gy / 34;
        let val = 0;
        if (kind === '单缝') val = Math.abs(Math.sin(u) / (u + 1e-6)) * Math.exp(-vv * vv * 3);
        else if (kind === '双缝') { const s1 = Math.abs(Math.sin(u) / (u + 1e-6)); val = s1 * Math.abs(Math.cos(u * 2.2)) * Math.exp(-vv * vv * 2); }
        else if (kind === '圆孔') { const r = Math.hypot(u, vv); val = r < 0.01 ? 1 : Math.abs(2 * (Math.sin(r) - r * Math.cos(r)) / (r * r * r)) * 0.5; }
        else val = Math.abs(Math.sin(u) * Math.sin(vv)) * (Math.abs(Math.sin(u * 3)) > 0.4 ? 1 : 0.3);
        const k = Math.min(1, val);
        if (k > 0.03) {
          const { ctx } = f;
          ctx.fillStyle = `rgba(236,201,75,${k * 0.95})`;
          ctx.fillRect(bx + gx, ay + gy, cell, cell);
        }
      }
    }
    text(f, '形状 ↔ 图样是一一对应的傅里叶对', 56, h - 148, { color: C.fg, font: '16px serif' });
    text(f, '圆孔 → 艾里斑；双缝 → 等间距条纹包络；晶格 → 衍射斑点', 56, h - 118, { color: C.yellow, font: '15px serif' });
    text(f, '反过来：从衍射图样反推结构 = 傅里叶逆问题（X 射线晶体学的日常）', 56, h - 88, { color: C.cool, font: '15px serif' });
    footnotes(f, [
      '夫琅禾费衍射=光瞳函数的傅里叶变换（透镜做实时模拟计算）',
      '空域与频域互反：缝越窄（空域紧）图样越宽（频域散）—— 不确定性的光学版',
      '相位问题：探测器只记录强度 |ℱ|²，相位丢失 —— 相位复原算法的动机',
    ]);
    heading(f, '一次变换看穿成像系统');
  },
});
registerViz(multidimFourierDiffraction);

/** P571 积分变换解演化方程。 */
const transformEvolutionEquation = defineViz({
  slug: 'transform-evolution-equation',
  title: '积分变换解演化方程',
  params: { ic: { type: 'select', options: ['δ 脉冲', '高斯包', '周期调制'], default: 'δ 脉冲', label: '初始条件' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'ic', 'δ 脉冲');
    clear(f);
    // 左：求解流程
    const bx = 56;
    text(f, '热传导方程的变换解法：', bx, 92, { color: C.yellow, font: '17px serif' });
    const steps = [
      ['∂u/∂t = α ∂²u/∂x²', C.fg],
      ['对 x 做傅里叶：dÛ/dt = −αk²Û', C.cool],
      ['Û(k,t) = Û(k,0)·e^{−αk²t}（乘法！）', C.green],
      ['逆变换 ⇒ 与热核 K(x,t) 卷积', C.hot],
    ] as Array<[string, string]>;
    steps.forEach(([s, color], i) => {
      const y = 130 + i * 62;
      poly(f, [[bx, y], [bx + 390, y], [bx + 390, y + 48], [bx, y + 48]],
        { fill: `${color}14`, stroke: `${color}bb`, lw: 1.8 });
      text(f, s, bx + 14, y + 31, { color, font: '15px serif' });
    });
    text(f, '频域每个模态独立衰减：e^{−αk²t} 是低通滤波器', bx, 130 + 4 * 62 + 26, { color: C.yellow, font: '15px serif' });
    text(f, '色散关系 ω(k) 从变换里直接读出 —— 波包展宽、光速全都从它来', bx, 130 + 4 * 62 + 62, { color: C.cool, font: '14px sans-serif' });
    // 右：时域演化
    const v = view(f, { xMin: -5, xMax: 5, yMin: 0, yMax: 1.4, inset: w * 0.53, insetRight: 46, insetBottom: 46 });
    grid(f, v);
    const tAnim = ((f.t * 0.3) % 1) * 2.4;
    const curve1: Array<[number, number]> = [];
    for (let i = 0; i <= 300; i++) {
      const x = -5 + (i / 300) * 10;
      let val: number;
      if (kind === 'δ 脉冲') val = (1 / Math.sqrt(4 * Math.PI * (0.06 + tAnim))) * Math.exp(-x * x / (4 * (0.06 + tAnim))) * Math.sqrt(0.5);
      else if (kind === '高斯包') val = Math.exp(-Math.pow((x - Math.sin(tAnim) * 1.4) * 0.8, 2)) * Math.exp(-tAnim * 0.25);
      else val = Math.cos(x * 1.6) * Math.exp(-0.4 * 1.6 * 1.6 * tAnim * 0.3) * Math.exp(-x * x * 0.03) * 0.9;
      if (val > 1.42) continue;
      curve1.push([v.sx(x), v.sy(Math.max(0, val))]);
    }
    poly(f, curve1, { stroke: C.accent, lw: 3 });
    text(f, kind === 'δ 脉冲' ? 'δ 初值 → 高斯扩散（热核自己长出来）' :
      kind === '高斯包' ? '高斯包展宽+衰减（扩散抹平一切）' : '调制波包：高频先衰减，包络变宽',
      v.sx(-4.9), v.sy(1.35), { color: C.fg, font: '14px serif' });
    text(f, `t = ${tAnim.toFixed(2)}`, v.sx(-4.9), v.sy(1.2), { color: C.yellow, font: '14px serif' });
    text(f, 'x', (v.sx(-5) + v.sx(5)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      '积分变换的统一战术：把难操作（微分/卷积/积分）变成好操作（乘除）',
      '傅里叶管空间、拉氏管时间 —— 分离变量的变换版',
      '逆变换时的收敛因子决定物理因果性：为什么热不倒流、波不先到',
    ]);
    heading(f, '变换域里演化=乘一个因子');
  },
});
registerViz(transformEvolutionEquation);

/** P572 笛卡尔张量与变换律。 */
const cartesianTensor = defineViz({
  slug: 'cartesian-tensor',
  title: '笛卡尔张量与变换律',
  params: { rank: { type: 'range', min: 0, max: 2, default: 1, step: 1, label: '张量阶数 r' } },
  draw: (f) => {
    const { w, h, params } = f;
    const r = Math.round(num(params, 'rank', 1));
    clear(f);
    // 左：坐标系旋转演示
    const cx = w * 0.27, cy = h * 0.46;
    const ang = f.t * 0.5;
    // 固定系
    seg(f, cx - 140, cy, cx + 140, cy, C.cool, 2.4);
    seg(f, cx, cy - 130, cx, cy + 130, C.cool, 2.4);
    text(f, 'x', cx + 148, cy + 16, { color: C.cool, font: '14px serif' });
    text(f, 'y', cx + 8, cy - 140, { color: C.cool, font: '14px serif' });
    // 转动系
    const ux = Math.cos(ang) * 130, uy = -Math.sin(ang) * 130;
    const vx = Math.sin(ang) * 130, vy = Math.cos(ang) * 130;
    seg(f, cx - ux, cy - uy, cx + ux, cy + uy, C.warm, 2.4, );
    seg(f, cx - vx, cy - vy, cx + vx, cy + vy, C.warm, 2.4);
    text(f, "x'", cx + ux + 8, cy + uy + 4, { color: C.warm, font: '14px serif' });
    text(f, "y'", cx + vx + 8, cy + vy + 4, { color: C.warm, font: '14px serif' });
    // 矢量（物理对象，不随坐标变）
    const px = Math.cos(-0.6) * 100, py = -Math.sin(-0.6) * 100;
    vec(f, cx, cy, cx + px, cy + py, C.hot, 3.4, 10);
    text(f, '同一个矢量（红色物理量不动）', cx - 140, cy - 158, { color: C.hot, font: '14px serif' });
    // 分量投影（坐标变了，分量读数变）
    const compX = px * Math.cos(-ang) - py * Math.sin(-ang) * -1;
    void compX;
    text(f, `分量：(${(px / 100).toFixed(2)}, ${(py / 100).toFixed(2)}) → 读数随坐标变`, cx - 150, cy + 168, { color: C.yellow, font: '14px serif' });
    // 右：变换律
    const bx = w * 0.56;
    const laws = [
      ['阶 0（标量）：\' = A\'（不变）', 'T = 数字', C.green],
      ['阶 1（矢量）：v\'ᵢ = Aᵢⱼvⱼ', 'v = 方向+大小', C.cool],
      ['阶 2（张量）：T\'ᵢⱼ = AᵢₖAⱼₗTₖₗ', 'T = 应力/惯量/度规', C.warm],
    ] as Array<[string, string, string]>;
    laws.forEach(([law, note, color], i) => {
      const active = i === r;
      const y = 100 + i * 84;
      poly(f, [[bx, y], [bx + 350, y], [bx + 350, y + 68], [bx, y + 68]],
        { fill: active ? `${color}30` : `${color}10`, stroke: color, lw: active ? 3 : 1.5 });
      text(f, law, bx + 14, y + 30, { color: active ? C.fg : color, font: '15px serif' });
      text(f, note, bx + 14, y + 56, { color: C.dim, font: '13px sans-serif' });
    });
    text(f, '指标重复即求和（爱因斯坦约定）：vᵢ = Σ Aᵢⱼvⱼ 省掉 Σ', bx, 100 + 3 * 84 + 20, { color: C.yellow, font: '16px serif' });
    text(f, '张量方程两边变换律相同 ⇒ 物理定律与坐标系无关', bx, 100 + 3 * 84 + 58, { color: C.green, font: '15px serif' });
    text(f, '例：∇·E = ρ/ε₀ 在任何坐标系都成立（协变性）', bx, 100 + 3 * 84 + 94, { color: C.fg, font: '14px sans-serif' });
    footnotes(f, [
      '张量 = 坐标变换下按规则变换的对象集合（分量的打包）',
      '对称/反对称部分、缩并降阶、迹 —— 指标运算的三板斧',
      '惯性张量、应力张量、电磁场张量 Fᵘᵛ：物理里到处是阶 2 张量',
    ]);
    heading(f, '带指标才与坐标系无关');
  },
});
registerViz(cartesianTensor);

/** P573 度规与克里斯托费尔符号。 */
const christoffelSymbols = defineViz({
  slug: 'christoffel-symbols',
  title: '度规与克里斯托费尔符号',
  params: { space: { type: 'select', options: ['球面（极坐标）', '平直空间', '圆锥面'], default: '球面（极坐标）', label: '几何' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'space', '球面（极坐标）');
    clear(f);
    const cx = w * 0.28, cy = h * 0.46, R = 140;
    // 度规决定"尺子怎么量"
    if (kind.startsWith('球面')) {
      circle(f, cx, cy, R, { stroke: C.cool, lw: 2.6 });
      // 经纬网
      for (let k = 1; k < 4; k++) {
        const { ctx } = f;
        ctx.save();
        ctx.strokeStyle = `${C.grid}bb`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(cx, cy, R * Math.cos((k / 4) * Math.PI - Math.PI / 4) + 10, R, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx, cy, R, R * (0.3 + k * 0.2), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      text(f, '球面 ds² = R²dθ² + R²sin²θ dφ²', cx - 150, cy - R - 30, { color: C.fg, font: '15px serif' });
      text(f, 'g_μν = diag(R², R²sin²θ) —— 分量随位置变！', cx - 150, cy + R + 40, { color: C.yellow, font: '14px serif' });
      // 一个矢量的平行移动（方向变化）
      const a0 = 0.6;
      const p1x = cx + Math.cos(a0) * R * 0.7, p1y = cy + Math.sin(a0) * R * 0.7;
      const p2x = cx + Math.cos(a0 + 0.7) * R * 0.7, p2y = cy + Math.sin(a0 + 0.7) * R * 0.7;
      dot(f, p1x, p1y, 6, C.hot);
      dot(f, p2x, p2y, 6, C.hot);
      vec(f, p1x, p1y, p1x + 40, p1y - 26, C.warm, 2.6);
      vec(f, p2x, p2y, p2x + 40, p2y - 26, C.warm, 2.6);
      text(f, '同方向平移 → 到新点方向"变"了', cx - 150, cy + R + 68, { color: C.hot, font: '14px serif' });
    } else if (kind === '平直空间') {
      seg(f, cx - 140, cy, cx + 140, cy, C.cool, 2.4);
      seg(f, cx, cy - 130, cx, cy + 130, C.cool, 2.4);
      text(f, '直角坐标：g = δ（单位矩阵）', cx - 140, cy - 150, { color: C.fg, font: '15px serif' });
      text(f, 'Γ = 0：没有联络修正，导数就是普通导数', cx - 140, cy + 160, { color: C.green, font: '14px serif' });
      text(f, '平直空间的"零联络"正是判断背景平坦的标准', cx - 140, cy + 190, { color: C.dim, font: '14px serif' });
      vec(f, cx - 100, cy + 60, cx - 60, cy + 34, C.warm, 2.6);
      vec(f, cx + 40, cy + 60, cx + 80, cy + 34, C.warm, 2.6);
      text(f, '平移后方向不变', cx - 100, cy + 100, { color: C.warm, font: '14px serif' });
    } else {
      // 圆锥
      poly(f, [[cx - 110, cy + 120], [cx, cy - 120], [cx + 110, cy + 120]], { stroke: C.warm, lw: 2.6, fill: 'rgba(237,137,54,0.1)' });
      for (let k = 1; k <= 3; k++) {
        const yy = cy + 120 - k * 70;
        const rr = 110 * (1 - k * 0.23);
        const { ctx } = f;
        ctx.save();
        ctx.strokeStyle = `${C.grid}bb`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(cx, yy, rr, rr * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      text(f, '圆锥（有缺陷角）：局部平直、全局有曲率', cx - 150, cy - 150, { color: C.fg, font: '15px serif' });
      text(f, 'Γ 非零修正坐标基的"自然转动"', cx - 150, cy + 160, { color: C.yellow, font: '14px serif' });
    }
    // 右侧公式
    const bx = w * 0.58;
    text(f, '度规 g_μν：把"长度"定义给空间', bx, 96, { color: C.yellow, font: '17px serif' });
    text(f, 'ds² = g_μν dxᵘdxᵛ（一切几何量的原料）', bx, 136, { color: C.fg, font: '16px serif' });
    text(f, 'Γᵘ_{μν} = ½gᵘλ(∂_μg_λν + ∂_νg_λμ − ∂_λg_μν)', bx, 196, { color: C.cool, font: '16px serif' });
    text(f, '（度规的导数 → 联络系数 → 直角坐标下为 0）', bx, 230, { color: C.dim, font: '14px sans-serif' });
    text(f, 'Γ 不是张量：坐标变换会"混"出非张量项 —— 它是联络', bx, 282, { color: C.hot, font: '15px serif' });
    text(f, '但 Γ 的变换律保证协变导数是张量', bx, 316, { color: C.green, font: '15px serif' });
    text(f, '物理读法：Γ 描述"局部惯性系"如何随点转动', bx, h - 130, { color: C.yellow, font: '15px serif' });
    text(f, '引力 = 度规场 = Γ 的时空变化（爱因斯坦的几何引力）', bx, h - 100, { color: C.pink, font: '15px serif' });
    footnotes(f, [
      '度规是空间的"量尺+钟表"：所有距离、角度、体积从它算出',
      '克氏符号从度规纯代数导出 —— 没有额外动力学，是几何的派生量',
      '极坐标里 Γ^θ_{φφ} = −sinθcosθ 等经典结果：坐标弯曲的代价',
    ]);
    heading(f, '度规量出时空，克氏系数记账');
  },
});
registerViz(christoffelSymbols);

/** P574 协变导数与平行输运。 */
const covariantDerivative = defineViz({
  slug: 'covariant-derivative',
  title: '协变导数与平行输运',
  params: { path: { type: 'select', options: ['球面上绕行', '沿测地线', '对比普通导数'], default: '球面上绕行', label: '演示' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = str(params, 'path', '球面上绕行');
    clear(f);
    const cx = w * 0.3, cy = h * 0.46, R = 150;
    circle(f, cx, cy, R, { stroke: C.cool, lw: 2.6 });
    text(f, '弯曲流形（球面）', cx, cy - R - 26, { align: 'center', color: C.fg, font: '15px serif' });
    if (mode === '球面上绕行') {
      // 小圈平行移动：矢量转回时方向变了（和乐）
      const loopR = 76;
      const t = (f.t * 0.5) % 1;
      const ang = t * Math.PI * 2;
      // 路径
      const path: Array<[number, number]> = [];
      for (let i = 0; i <= 80; i++) {
        const a = (i / 80) * Math.PI * 2;
        path.push([cx + Math.cos(a) * loopR, cy + Math.sin(a) * loopR * 0.7]);
      }
      poly(f, path, { stroke: `${C.grid}cc`, lw: 2, dash: [8, 6] });
      // 沿路径的矢量（平行移动：保持"局部水平"）
      const px = cx + Math.cos(ang) * loopR, py = cy + Math.sin(ang) * loopR * 0.7;
      const rotation = ang * 0.5; // 和乐角
      const va = -0.5 + rotation;
      vec(f, px, py, px + Math.cos(va) * 54, py + Math.sin(va) * 54, C.hot, 3);
      dot(f, px, py, 7, C.yellow);
      text(f, '沿小圈移动一周，矢量方向转了 Ω = ∮Γ', cx - 150, cy + R + 44, { color: C.hot, font: '15px serif' });
      text(f, '和乐（holonomy）= 曲率的足迹 —— 平行是局部的，方向是全局记账的', cx - 150, cy + R + 74, { color: C.yellow, font: '14px sans-serif' });
      // 起点矢量对照（虚）
      vec(f, cx + loopR, cy, cx + loopR + Math.cos(-0.5) * 54, cy + Math.sin(-0.5) * 54, `${C.warm}aa`, 2.4);
      text(f, '起始方向', cx + loopR + 60, cy - 4, { color: C.warm, font: '13px serif' });
    } else if (mode === '沿测地线') {
      // 赤道上的测地线移动
      seg(f, cx - R, cy, cx + R, cy, C.green, 3);
      const px = cx + Math.sin(f.t * 1.2) * R * 0.9;
      vec(f, px, cy, px + 56, cy, C.hot, 3);
      text(f, '沿测地线：协变导数 = 0（矢量"自然"保持方向）', cx - 150, cy + R + 44, { color: C.green, font: '15px serif' });
      text(f, 'D Vᵘ/dτ = 0 ⇒ Vᵘ∂_μVᵘ + Γᵘ_{μν}VᵘVᵛ = 0', cx - 150, cy + R + 74, { color: C.fg, font: '15px serif' });
      text(f, '这就是测地线方程 —— 自由粒子的弯曲时空版', cx - 150, cy + R + 104, { color: C.yellow, font: '14px sans-serif' });
    } else {
      // 普通导数 vs 协变导数
      text(f, '普通导数 ∂_μVᵘ：基矢本身在变，结果不是张量', cx - 160, cy - 40, { color: C.hot, font: '15px serif' });
      text(f, '协变导数 ∇_μVᵘ = ∂_μVᵘ + Γᵘ_{μλ}V^λ', cx - 160, cy - 6, { color: C.green, font: '16px serif' });
      text(f, '= 补上基矢的变化（联络修正）→ 张量', cx - 160, cy + 30, { color: C.fg, font: '14px sans-serif' });
      text(f, '协变导数三性质：', cx - 160, cy + 84, { color: C.yellow, font: '15px serif' });
      ['莱布尼茨积法则 ✓', '与张量缩并相容 ✓', '无挠：∇_μ∇_ν 对称（克氏对称）✓'].forEach((s, i) => {
        text(f, '· ' + s, cx - 160, cy + 118 + i * 34, { color: C.cool, font: '14px sans-serif' });
      });
      void R;
    }
    // 右侧公式区
    const bx = w * 0.58;
    if (mode !== '对比普通导数') {
      text(f, '协变导数：弯曲空间的"求导"', bx, 96, { color: C.yellow, font: '17px serif' });
      text(f, '∇_μ Vᵘ = ∂_μVᵘ + Γᵘ_{μλ}V^λ', bx, 140, { color: C.green, font: '17px serif' });
      text(f, '联络项把"基矢在不同点不同"的账补上', bx, 184, { color: C.fg, font: '15px sans-serif' });
      text(f, '张量场方程全部改写成协变形式：', bx, 246, { color: C.cool, font: '15px serif' });
      text(f, '∇_μTᵘᵛ = 0（能量动量守恒的弯曲版）', bx, 284, { color: C.cool, font: '15px serif' });
      text(f, '∇_μFᵘᵛ = μ₀Jᵘ（麦氏方程的协变形式）', bx, 320, { color: C.cool, font: '15px serif' });
      text(f, '物理定律写成协变式 = 自动适用于一切坐标系', bx, 380, { color: C.yellow, font: '15px serif' });
    }
    footnotes(f, [
      '平行移动的路径依赖（和乐）直接测量曲率 —— 霍尔效应的引力类比',
      '协变导数保持张量性：∇ 作用后仍是张量，可以继续缩并做方程',
      '广义相对论全部方程都是协变导数拼的 —— 等效原理的数学兑现',
    ]);
    heading(f, '弯曲空间里求导要补克氏项');
  },
});
registerViz(covariantDerivative);

/** P575 黎曼曲率张量。 */
const riemannCurvature = defineViz({
  slug: 'riemann-curvature',
  title: '黎曼曲率张量',
  params: { surf: { type: 'select', options: ['球面（正曲率）', '马鞍（负曲率）', '平面（零曲率）'], default: '球面（正曲率）', label: '曲面' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'surf', '球面（正曲率）');
    clear(f);
    const cx = w * 0.3, cy = h * 0.44, R = 140;
    // 曲面绘制
    if (kind.startsWith('球面')) {
      circle(f, cx, cy, R, { stroke: C.cool, lw: 2.8, fill: 'rgba(66,153,225,0.08)' });
      for (let k = 1; k <= 3; k++) {
        const { ctx } = f;
        ctx.save();
        ctx.strokeStyle = `${C.grid}aa`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy, R * Math.cos(k * 0.5 - 0.75), R, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      text(f, 'K > 0：三角形内角和 > 180°', cx - 140, cy + R + 40, { color: C.cool, font: '15px serif' });
      text(f, '平行四边形闭合差 ∝ K·面积', cx - 140, cy + R + 70, { color: C.fg, font: '14px serif' });
      // 三角形（曲面上）
      poly(f, [[cx - 70, cy + 40], [cx + 70, cy + 40], [cx, cy - 76]], { stroke: C.hot, lw: 2.6, fill: 'rgba(245,101,101,0.15)' });
    } else if (kind.startsWith('马鞍')) {
      const pts1: Array<[number, number]> = [], pts2: Array<[number, number]> = [];
      for (let i = 0; i <= 60; i++) {
        const t = -1 + (i / 60) * 2;
        pts1.push([cx + t * R, cy + t * t * R * 0.5 - 40]);
        pts2.push([cx + t * R, cy - t * t * R * 0.5 + 40]);
      }
      poly(f, pts1, { stroke: C.warm, lw: 2.8 });
      poly(f, pts2, { stroke: C.warm, lw: 2.8 });
      text(f, 'K < 0：三角形内角和 < 180°', cx - 140, cy + R + 40, { color: C.warm, font: '15px serif' });
      text(f, '双曲几何的舞台（庞加莱圆盘）', cx - 140, cy + R + 70, { color: C.fg, font: '14px serif' });
    } else {
      seg(f, cx - R, cy, cx + R, cy, C.green, 2.4);
      seg(f, cx - R * 0.6, cy - 60, cx + R * 0.6, cy - 60, C.green, 2);
      seg(f, cx - R * 0.6, cy + 60, cx + R * 0.6, cy + 60, C.green, 2);
      text(f, 'K = 0：平移无路径差', cx - 140, cy + R + 40, { color: C.green, font: '15px serif' });
      text(f, '欧几里得几何（零曲率特例）', cx - 140, cy + R + 70, { color: C.fg, font: '14px ' + 'serif' });
    }
    // 右：张量公式
    const bx = w * 0.58;
    text(f, '曲率张量：', bx, 96, { color: C.yellow, font: '17px ' + 'serif' });
    text(f, 'Rᵘ_{νρσ} = ∂_ρΓᵘ_{νσ} − ∂_σΓᵘ_{νρ} + ΓΓ − ΓΓ', bx, 140, { color: C.fg, font: '15px serif' });
    text(f, '读法：沿无穷小闭环平行移动矢量的转角', bx, 184, { color: C.cool, font: '15px serif' });
    text(f, 'R^ρ_{σμν}V^σ = ∇_μ∇_νV^ρ − ∇_ν∇_μV^ρ（对易子=曲率）', bx, 224, { color: C.green, font: '14px serif' });
    text(f, '对称性（第一/第二比安基）⇒ 恒等式 ⇒ 场方程的守恒律', bx, 278, { color: C.warm, font: '14px serif' });
    text(f, '缩并：', bx, 330, { color: C.yellow, font: '15px serif' });
    text(f, 'R_{νσ} = Rᵘ_{νuσ}（里奇张量）', bx, 366, { color: C.cool, font: '15px serif' });
    text(f, 'R = g^{νσ}R_{νσ}（标量曲率）', bx, 400, { color: C.cool, font: '15px serif' });
    text(f, `当前：${kind.startsWith('球面') ? 'R > 0（球面处处正）' : kind.startsWith('马鞍') ? 'R < 0（马鞍处处负）' : 'R = 0（平直）'}`,
      bx, h - 118, { color: C.hot, font: '15px serif' });
    text(f, '高斯绝妙定理：曲率是内蕴的 —— 面上蚂蚁就能测出', bx, h - 88, { color: C.yellow, font: '14px sans-serif' });
    footnotes(f, [
      '黎曼张量是"完整曲率"：分量数 n²(n²−1)/2（3D 空间 6 个独立分量）',
      '里奇张量只记录体积亏损、标量曲率取平均 —— 场方程用压缩版',
      '引力波探测的本质：测量两点间距离（潮汐）随曲率振荡',
    ]);
    heading(f, '绕小圈转一周方向变了');
  },
});
registerViz(riemannCurvature);

/** P576 爱因斯坦场方程的推导脉络。 */
const einsteinFieldEquations = defineViz({
  slug: 'einstein-field-equations',
  title: '爱因斯坦场方程的推导脉络',
  params: { source: { type: 'select', options: ['点质量（牛顿极限）', '宇宙学流体', '引力波'], default: '点质量（牛顿极限）', label: '源' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'source', '点质量（牛顿极限）');
    clear(f);
    const cx = w * 0.3, cy = h * 0.46;
    if (kind.startsWith('点质量')) {
      // 橡皮膜上的质量凹陷（经典示意）
      const gridN = 12;
      const size = 260;
      for (let i = 0; i <= gridN; i++) {
        const pts1: Array<[number, number]> = [], pts2: Array<[number, number]> = [];
        for (let j = 0; j <= gridN; j++) {
          const x = (i / gridN - 0.5) * size;
          const y = (j / gridN - 0.5) * size;
          const r = Math.hypot(x, y) + 1;
          const dip = -90 * Math.exp(-Math.pow(r / 60, 2)) * 1.6;
          pts1.push([cx + x, cy + y * 0.55 + dip * 0.5]);
          const x2 = (j / gridN - 0.5) * size;
          const r2 = Math.hypot(x2, x) + 1;
          const dip2 = -90 * Math.exp(-Math.pow(r2 / 60, 2)) * 1.6;
          pts2.push([cx + x2, cy + x * 0.55 + dip2 * 0.5]);
        }
        poly(f, pts1, { stroke: `${C.cool}99`, lw: 1.3 });
        poly(f, pts2, { stroke: `${C.cool}99`, lw: 1.3 });
      }
      circle(f, cx, cy - 8, 13, { fill: C.hot, stroke: C.hot, lw: 2 });
      text(f, 'M', cx, cy - 4, { align: 'center', color: C.fg, font: '14px serif' });
      text(f, '牛顿极限：g₀₀ = −(1 + 2Φ/c²) ⇒ 回到 F = GMm/r²', 56, h - 148, { color: C.green, font: '16px serif' });
      text(f, '弱场慢速下场方程退化为泊松方程 ∇²Φ = 4πGρ', 56, h - 118, { color: C.fg, font: '15px serif' });
      text(f, '（橡皮膜图是类比不是证明：真实引力是度规不是张力）', 56, h - 88, { color: C.hot, font: '14px sans-serif' });
    } else if (kind === '宇宙学流体') {
      // 弗里德曼方程
      const v = view(f, { xMin: 0, xMax: 8, yMin: 0, yMax: 2.4, inset: 46, insetBottom: 46 });
      grid(f, v);
      const aMatter: Array<[number, number]> = [], aLambda: Array<[number, number]> = [];
      for (let i = 1; i <= 120; i++) {
        const t = (i / 120) * 8;
        aMatter.push([v.sx(t), v.sy(Math.pow(t * 0.5, 0.66))]);
        aLambda.push([v.sx(t), v.sy(Math.min(2.35, Math.exp(t * 0.22) * 0.35))]);
      }
      poly(f, aMatter, { stroke: C.cool, lw: 2.6 });
      poly(f, aLambda, { stroke: C.hot, lw: 2.6, dash: [8, 5] });
      text(f, '蓝：物质主导 a∝t^{2/3}（减速）', v.sx(0.3), v.sy(2.25), { color: C.cool, font: '14px serif' });
      text(f, '红虚：Λ 主导 a∝e^{Ht}（加速）', v.sx(0.3), v.sy(2.05), { color: C.hot, font: '14px serif' });
      text(f, '(ȧ/a)² = 8πGρ/3 − kc²/a² + Λc²/3（弗里德曼方程）', v.sx(0.3), v.sy(0.4), { color: C.yellow, font: '15px serif' });
      text(f, 't', (v.sx(0) + v.sx(8)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
      text(f, 'a (标度因子)', v.sx(0.3), v.sy(2.38), { color: C.dim, font: '12px sans-serif' });
      text(f, '场方程均匀性假设下的解 —— 宇宙学的全部动力学', 56, h - 116, { color: C.fg, font: '15px serif' });
      footnotes(f, [
        '爱因斯坦 1917 用它算静态宇宙，1929 后加回 Λ（1998 发现加速）',
        '弗里德曼方程 = 场方程的 FLRW 特解：现代宇宙学的发动机',
      ]);
    } else {
      // 引力波：度规振荡
      const v = view(f, { xMin: -4, xMax: 4, yMin: -1.6, yMax: 1.6, inset: 46, insetBottom: 46 });
      grid(f, v);
      const t = f.t * 2.2;
      // h_+ 型振荡网格
      for (let gy = -1.2; gy <= 1.2; gy += 0.4) {
        const pts: Array<[number, number]> = [];
        for (let i = 0; i <= 160; i++) {
          const x = -4 + (i / 160) * 8;
          const hplus = 0.28 * Math.cos(x * 1.4 - t) * (1 - Math.abs(gy) * 0.4);
          pts.push([v.sx(x), v.sy(gy + hplus * (1 - Math.abs(x) * 0.12))]);
        }
        poly(f, pts, { stroke: `rgba(66,153,225,${0.4 + Math.abs(gy) * 0.3})`, lw: 1.6 });
      }
      text(f, '度规振荡 h_+(t)：空间本身横着呼吸', v.sx(-3.9), v.sy(1.5), { color: C.fg, font: '15px serif' });
      text(f, '真空解 Gᵘᵛ = 0 ≠ 平直：Riemann ≠ 0（横波穿过）', v.sx(-3.9), v.sy(1.3), { color: C.yellow, font: '14px serif' });
      text(f, '四极辐射：质量四极矩变化率 → L = G⟨Q̈⟩²/c⁵', v.sx(-3.9), v.sy(-1.4), { color: C.hot, font: '14px serif' });
      text(f, 'GW150914：3 个太阳质量在 0.2 秒变光 —— 直接探测到曲率波', v.sx(-3.9), v.sy(-1.2), { color: C.green, font: '14px serif' });
      footnotes(f, [
        '引力波是线性化的真空场方程解：扰动以光速传播',
        'LIGO 测的是 ΔL/L ~ 10⁻²¹：4 km 长度变化小于质子直径千分之一',
      ]);
    }
    if (!kind.startsWith('点质量') && kind !== '宇宙学流体') {
      // 引力波情形的方程
      text(f, 'Gᵘᵛ + Λgᵘᵛ = (8πG/c⁴) Tᵘᵛ', 56, 96, { color: C.yellow, font: '19px serif' });
    } else {
      text(f, 'Gᵘᵛ + Λgᵘᵛ = (8πG/c⁴) Tᵘᵛ', 56, 96, { color: C.yellow, font: '19px serif' });
      text(f, '左边=时空曲率（几何）　右边=物质能量（源）', 56, 132, { color: C.fg, font: '15px serif' });
      text(f, '推导路线：等效原理 → 广义协变 → 最小作用量 S = ∫(R−2Λ)√−g d⁴x 变分', 56, 166, { color: C.cool, font: '14px serif' });
      text(f, '守恒约束 ∇_μGᵘᵛ = 0 自动成立（比安基恒等式）—— 方程自洽的担保', 56, 196, { color: C.green, font: '14px serif' });
    }
    footnotes(f, [
      '场方程二阶非线性：10 个分量方程、4 个微分恒等式约束 ⇒ 独立自由度=2（引力波两个偏振）',
      '牛顿极限、弱场、旋后近似层层可解 —— 水星进动 43″/世纪是第一个验证',
      '数值相对论（2005 首次双黑洞波形）成为 LIGO 模板库的生产线',
    ]);
    heading(f, '几何与物质的双向记账');
  },
});
registerViz(einsteinFieldEquations);

/** P577 微分形式与广义斯托克斯。 */
const differentialForms = defineViz({
  slug: 'differential-forms',
  title: '微分形式与广义斯托克斯',
  params: { dim2: { type: 'select', options: ['1-形式（线积分）', '2-形式（面积分）', '3-形式（体积分）'], default: '2-形式（面积分）', label: '形式阶数' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'dim2', '2-形式（面积分）');
    clear(f);
    const cx = w * 0.3, cy = h * 0.46;
    if (kind.startsWith('1')) {
      // 环路上的线积分
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 100; i++) {
        const a = (i / 100) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * 130, cy + Math.sin(a) * 90]);
      }
      poly(f, pts, { stroke: C.cool, lw: 3 });
      const a = f.t * 1.5;
      const px = cx + Math.cos(a) * 130, py = cy + Math.sin(a) * 90;
      vec(f, px, py, px - Math.sin(a) * 46, py + Math.cos(a) * 46, C.yellow, 3);
      dot(f, px, py, 7, C.hot);
      text(f, '∮_C ω：1-形式 ω 沿曲线的积分', cx - 150, cy - 130, { color: C.fg, font: '16px serif' });
      text(f, '斯托克斯（低维版）：∮A·dl = ∫(∇×A)·dS', cx - 150, cy + 130, { color: C.yellow, font: '16px serif' });
      text(f, '1-形式=“沿线累积的量”：电势差、做功、相位', cx - 150, cy + 160, { color: C.cool, font: '14px sans-serif' });
      footnotes(f, [
        '形式阶数匹配积分对象：1-形式配线、2-形式配面、3-形式配体',
        '外微分 d 升阶：d(1-形式) = 2-形式（梯度→旋度的抽象化）',
      ]);
    } else if (kind.startsWith('2')) {
      // 面积分与边界
      const quad: Array<[number, number]> = [
        [cx - 130, cy - 80], [cx + 110, cy - 100], [cx + 130, cy + 80], [cx - 110, cy + 96],
      ];
      poly(f, quad, { stroke: C.green, lw: 3, fill: 'rgba(72,187,120,0.15)' });
      // 网格
      for (let i = 1; i < 5; i++) {
        const t = i / 5;
        seg(f, quad[0][0] + (quad[3][0] - quad[0][0]) * t, quad[0][1] + (quad[3][1] - quad[0][1]) * t,
          quad[1][0] + (quad[2][0] - quad[1][0]) * t, quad[1][1] + (quad[2][1] - quad[1][1]) * t, `${C.green}77`, 1.4);
        seg(f, quad[0][0] + (quad[1][0] - quad[0][0]) * t, quad[0][1] + (quad[1][1] - quad[0][1]) * t,
          quad[3][0] + (quad[2][0] - quad[3][0]) * t, quad[3][1] + (quad[2][1] - quad[3][1]) * t, `${C.green}77`, 1.4);
      }
      // 边界方向
      const per = (f.t * 0.4) % 1;
      const idx = per * 4;
      const si = Math.floor(idx), st = idx - si;
      const p1 = quad[si], p2 = quad[(si + 1) % 4];
      const bx0 = p1[0] + (p2[0] - p1[0]) * st, by0 = p1[1] + (p2[1] - p1[1]) * st;
      vec(f, bx0, by0, bx0 + (p2[0] - p1[0]) * 0.2, by0 + (p2[1] - p1[1]) * 0.2, C.hot, 3);
      dot(f, bx0, by0, 7, C.yellow);
      text(f, '∂S（边界，定向环绕）', cx - 150, cy - 130, { color: C.hot, font: '16px serif' });
      text(f, '∫_S dω = ∮_{∂S} ω（广义斯托克斯的 2D 版）', cx - 150, cy + 140, { color: C.yellow, font: '16px serif' });
      text(f, '2-形式 = 通量密度：电通量、磁通量、概率流', cx - 150, cy + 170, { color: C.cool, font: '14px sans-serif' });
      footnotes(f, [
        '麦克斯韦方程组的微分形式版：dF = 0，d⋆F = μ₀J —— 只有两行！',
        '外微分的外微分恒为零：d² = 0 ⇒ 守恒律的几何源头（∂∂=0）',
      ]);
    } else {
      // 体积分
      const s = 110;
      const proj = (x: number, y: number, z: number): [number, number] => [
        cx + (x - y) * 0.8 * s * 0.5, cy + (x + y) * 0.45 * s * 0.4 - z * s * 0.8,
      ];
      const corners: Array<[number, number, number]> = [];
      for (const z of [0, 1]) for (const y of [0, 1]) for (const x of [0, 1]) corners.push([x, y, z]);
      for (let i = 0; i < 8; i++) {
        for (let j = i + 1; j < 8; j++) {
          const d = Math.abs(corners[i][0] - corners[j][0]) + Math.abs(corners[i][1] - corners[j][1]) + Math.abs(corners[i][2] - corners[j][2]);
          if (d === 1) {
            const [x1, y1] = proj(...corners[i]);
            const [x2, y2] = proj(...corners[j]);
            seg(f, x1, y1, x2, y2, C.warm, 2.2);
          }
        }
      }
      text(f, '∫_V Ω：3-形式在体上的积分', cx - 160, cy - 150, { color: C.fg, font: '16px serif' });
      text(f, '∫_V dη = ∮_{∂V} η（高斯定理是它的 3D 版）', cx - 160, cy + 156, { color: C.yellow, font: '16px serif' });
      text(f, '3-形式 = 体元密度：质量、电荷、概率', cx - 160, cy + 186, { color: C.cool, font: '14px sans-serif' });
      footnotes(f, [
        '统一：格林、斯托克斯、高斯三大定理 = 同一个 ∫d = ∮',
        '流形上的积分不依赖坐标：定向 + 形式 = 唯一答案',
        '诺特定理的现代形式：d⋆J = 0（守恒流=闭形式）',
      ]);
    }
    // 右侧总公式
    const bx = w * 0.62;
    text(f, '广义斯托克斯定理：', bx, 96, { color: C.yellow, font: '18px serif' });
    text(f, '∫_M dω = ∫_{∂M} ω', bx, 144, { color: C.hot, font: '24px serif' });
    text(f, '一式统摄整个向量分析：', bx, 210, { color: C.fg, font: '16px serif' });
    text(f, '· 牛顿-莱布尼茨（0,1 维）', bx, 250, { color: C.cool, font: '15px serif' });
    text(f, '· 格林定理（1,2 维）', bx, 286, { color: C.cool, font: '15px ' + 'serif' });
    text(f, '· 斯托克斯定理（2,3 维）', bx, 322, { color: C.cool, font: '15px serif' });
    text(f, '· 高斯定理（3,3 维）', bx, 358, { color: C.cool, font: '15px serif' });
    text(f, '边界的边界为零：∂∂ = 0 ⇔ d² = 0', bx, 420, { color: C.green, font: '16px serif' });
    text(f, '—— 守恒与拓扑的共同地基', bx, 454, { color: C.yellow, font: '15px serif' });
    void num;
  },
});
registerViz(differentialForms);

/** P578 测地线方程与变分。 */
const geodesicVariation = defineViz({
  slug: 'geodesic-variation',
  title: '测地线方程与变分',
  params: { curve: { type: 'select', options: ['球面大圆', '马鞍曲线', '对比：非测地线'], default: '球面大圆', label: '路径' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'curve', '球面大圆');
    clear(f);
    const cx = w * 0.3, cy = h * 0.46, R = 150;
    circle(f, cx, cy, R, { stroke: C.cool, lw: 2.8, fill: 'rgba(66,153,225,0.06)' });
    if (kind === '球面大圆') {
      // 大圆（倾斜的）
      const { ctx } = f;
      ctx.save();
      ctx.strokeStyle = C.hot;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.ellipse(cx, cy, R, R * 0.36, -0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      // 运动点与切矢
      const a = f.t * 1.2;
      const px = cx + Math.cos(a) * R * Math.cos(-0.5) - Math.sin(a) * R * 0.36 * Math.sin(-0.5);
      const py = cy + Math.cos(a) * R * Math.sin(-0.5) + Math.sin(a) * R * 0.36 * Math.cos(-0.5);
      dot(f, px, py, 8, C.yellow);
      vec(f, px, py, px + 52, py - 16, C.green, 3);
      text(f, 'V（切矢）', px + 58, py - 14, { color: C.green, font: '14px serif' });
      vec(f, px, py, px - 30, py + 46, C.warm, 2.4);
      text(f, 'DV/dτ = 0（协变导数为零）', cx - 150, cy + R + 44, { color: C.green, font: '15px serif' });
      text(f, '球面上的"直线"=大圆：赤道、经线圈都是，纬线不是！', cx - 150, cy + R + 74, { color: C.hot, font: '15px serif' });
      text(f, '飞机航线、最短路径总是往极地方向弯一点', cx - 150, cy + R + 104, { color: C.dim, font: '14px serif' });
    } else if (kind === '马鞍曲线') {
      const pts1: Array<[number, number]> = [];
      for (let i = 0; i <= 60; i++) {
        const t = -1 + (i / 60) * 2;
        pts1.push([cx + t * R, cy + t * t * R * 0.5 - 30]);
      }
      poly(f, pts1, { stroke: C.warm, lw: 3.4 });
      const t = Math.sin(f.t) * 0.8;
      const px = cx + t * R, py = cy + t * t * R * 0.5 - 30;
      dot(f, px, py, 8, C.yellow);
      text(f, '负曲面上测地线发散：初始平行的两条越来越远', cx - 150, cy + R + 60, { color: C.warm, font: '15px serif' });
      text(f, '（几何发散=引力潮汐的另一种面貌）', cx - 150, cy + R + 90, { color: C.dim, font: '14px serif' });
      void R;
    } else {
      // 非测地线：球面上的小圆（纬线）
      const { ctx } = f;
      ctx.save();
      ctx.strokeStyle = C.green;
      ctx.lineWidth = 3.4;
      ctx.setLineDash([10, 7]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, R * 0.9, R * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      text(f, '虚线 = 纬线（不是测地线！）', cx - 150, cy - R - 26, { color: C.green, font: '15px serif' });
      // 趋近力示意
      const a = f.t;
      const px = cx + Math.cos(a) * R * 0.9, py = cy + Math.sin(a) * R * 0.3;
      vec(f, px, py, px, py + 30, C.hot, 3);
      text(f, '"离心力"其实=测地线偏离（联络效应）', px + 10, py + 44, { color: C.hot, font: '14px serif' });
      text(f, '约束力做功维持非测地路径 —— 纬线需要持续"踩刹车"', cx - 150, cy + R + 60, { color: C.fg, font: '15px serif' });
      void R;
    }
    // 右侧公式
    const bx = w * 0.6;
    text(f, '从固定端点的变分出发：', bx, 96, { color: C.yellow, font: '17px serif' });
    text(f, 'δ ∫ ds = 0 ⇒ δ ∫ √(g_μν dxᵘdxᵛ) = 0', bx, 140, { color: C.fg, font: '15px serif' });
    text(f, '欧拉-拉格朗日 → 测地线方程：', bx, 196, { color: C.cool, font: '16px serif' });
    text(f, 'd²xᵘ/dτ² + Γᵘ_{μν}(dxᵘ/dτ)(dxᵛ/dτ) = 0', bx, 236, { color: C.hot, font: '17px serif' });
    text(f, 'Γ 项 = 引力：自由下落=沿测地线，引力是几何效应', bx, 290, { color: C.green, font: '16px serif' });
    text(f, '等效原理的直接翻译：', bx, 344, { color: C.yellow, font: '15px serif' });
    text(f, '惯性质量=引力质量 ⇒ 全体粒子同走一条测地线', bx, 380, { color: C.fg, font: '15px serif' });
    text(f, '卫星轨道、光线偏折、水星进动全是它的解', bx, h - 128, { color: C.cool, font: '15px serif' });
    text(f, '弱场低速近似 → 牛顿引力方程（再次闭环）', bx, h - 98, { color: C.green, font: '14px serif' });
    footnotes(f, [
      '变分法与几何的会合：最短路径问题在弯曲空间的自然推广',
      '测地线是"局部最短"（球面上两点近距走大圆弧，远距走另一侧）',
      'ADM 形式、数值相对论的轨道计算：解测地线方程=预测引力波相位',
    ]);
    heading(f, '自由粒子走直线的弯曲空间版');
  },
});
registerViz(geodesicVariation);