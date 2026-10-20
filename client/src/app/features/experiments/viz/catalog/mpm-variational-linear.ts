import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text, view, grid, curve, circle, vec, rng } from '../canvas';

/** P579 泛函与欧拉-拉格朗日方程。 */
const eulerLagrangeFunctional = defineViz({
  slug: 'euler-lagrange-functional',
  title: '泛函与欧拉-拉格朗日方程',
  params: { functional: { type: 'select', options: ['最短路径（弧长）', '最速降线', '薄膜最小面积'], default: '最短路径（弧长）', label: '泛函' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'functional', '最短路径（弧长）');
    clear(f);
    const v = view(f, { xMin: 0, xMax: 10, yMin: 0, yMax: 7, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 端点 A、B
    const Ax = 1, Ay = 1, Bx = 9, By = 5;
    dot(f, v.sx(Ax), v.sy(Ay), 8, C.hot);
    dot(f, v.sx(Bx), v.sy(By), 8, C.hot);
    text(f, 'A', v.sx(Ax) - 14, v.sy(Ay) + 6, { color: C.hot, font: '15px serif' });
    text(f, 'B', v.sx(Bx) + 10, v.sy(By) + 6, { color: C.hot, font: '15px serif' });
    // 候选路径族（变分过程）
    const wiggle = Math.sin(f.t * 1.4) * 0.5;
    for (const eps of [-0.7, -0.35, 0, 0.35, 0.7]) {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 120; i++) {
        const t = i / 120;
        const x = Ax + t * (Bx - Ax);
        let y: number;
        if (kind === '最短路径（弧长）') {
          y = Ay + t * (By - Ay) + eps * Math.sin(Math.PI * t) * (1 + wiggle * 0.3);
        } else if (kind === '最速降线') {
          // 摆线
          const th = t * Math.PI * 1.2;
          y = By - 2.2 * (1 - Math.cos(th)) * (1 + eps * 0.12) + eps * 0.3;
        } else {
          y = Ay + t * (By - Ay) + eps * Math.cos(Math.PI * t) * 1.4;
        }
        pts.push([v.sx(x), v.sy(y)]);
      }
      poly(f, pts, { stroke: Math.abs(eps) < 0.01 ? C.green : `${C.cool}${Math.abs(eps) > 0.4 ? '55' : '99'}`, lw: Math.abs(eps) < 0.01 ? 3.4 : 1.7, dash: Math.abs(eps) < 0.01 ? undefined : [7, 5] });
    }
    text(f, '绿=极值曲线　蓝虚=变分试探（端点固定）', v.sx(0.15), v.sy(6.7), { color: C.fg, font: '14px serif' });
    // 公式
    const bx = 56;
    text(f, '泛函 J[y] = ∫F(x,y,y\')dx：给函数打分', bx, h - 176, { color: C.yellow, font: '17px serif' });
    text(f, '极值条件 δJ = 0 ⇒ ∂F/∂y − d/dx(∂F/∂y\') = 0', bx, h - 144, { color: C.hot, font: '17px serif' });
    const notes: Record<string, string> = {
      '最短路径（弧长）': 'F = √(1+y\'²) ⇒ y\'\'=0：直线！（最古老的变分题）',
      '最速降线': 'F = √(1+y\'²)/√(2gy) ⇒ 摆线（伯努利 1696，全欧罗巴参与）',
      '薄膜最小面积': 'F = √(1+y\'²)（等周问题变体）⇒ 悬链线 → 拱桥',
    };
    text(f, notes[kind], bx, h - 112, { color: C.fg, font: '15px sans-serif' });
    text(f, '自然边界条件：端点自由时 F−y\'(∂F/∂y\') 为零 —— 常被忽略的另一半', bx, h - 82, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '变分法把"极值"从函数推广到函数的函数：变量本身是无穷维的',
      '欧拉-拉格朗日方程=泛函极值的"导数等于零"，微分学的无穷维翻版',
      '力学、光学（费马）、经济学（最优控制）共享这一套语言',
    ]);
    heading(f, '给函数打分，找最高分的那条曲线');
  },
});
registerViz(eulerLagrangeFunctional);

/** P580 等周问题与约束变分。 */
const isoperimetricProblem = defineViz({
  slug: 'isoperimetric-problem',
  title: '等周问题与约束变分',
  params: { shape: { type: 'select', options: ['固定周长圈面积', '固定能量找轨道'], default: '固定周长圈面积', label: '问题' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'shape', '固定周长圈面积');
    clear(f);
    if (kind.startsWith('固定周长')) {
      // 变形的闭曲线趋向圆
      const cx = w * 0.4, cy = h * 0.46;
      const distort = (Math.sin(f.t * 1.1) * 0.5 + 0.5) * 0.55;
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 200; i++) {
        const a = (i / 200) * Math.PI * 2;
        const r = 130 * (1 + distort * (0.3 * Math.sin(3 * a) + 0.2 * Math.cos(5 * a)));
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      poly(f, pts, { stroke: C.accent, lw: 3.2, fill: 'rgba(102,126,234,0.14)' });
      // 参考圆（同周长）
      const { ctx } = f;
      ctx.save();
      ctx.strokeStyle = `${C.green}aa`;
      ctx.lineWidth = 2;
      ctx.setLineDash([9, 7]);
      ctx.beginPath();
      ctx.arc(cx, cy, 130 * (1 - distort * 0.1), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      text(f, '橙=当前形状（周长固定）　绿虚=同周长的圆', 56, 76, { color: C.fg, font: '15px serif' });
      // 面积对比条
      const areaRatio = 1 / (1 + distort * distort * 1.6);
      const bx = w * 0.72, by = h * 0.34;
      text(f, '面积比 A/A_圆', bx, by, { color: C.yellow, font: '15px serif' });
      poly(f, [[bx, by + 24], [bx + 240, by + 24], [bx + 240, by + 64], [bx, by + 64]], { fill: 'rgba(58,74,99,0.7)', stroke: C.grid });
      poly(f, [[bx, by + 24], [bx + 240 * areaRatio, by + 24], [bx + 240 * areaRatio, by + 64], [bx, by + 64]], { fill: 'rgba(72,187,120,0.7)' });
      text(f, `${(areaRatio * 100).toFixed(1)}%`, bx + 100, by + 50, { color: C.fg, font: '16px serif' });
      text(f, '等周不等式：4πA ≤ L²，等号 ⇔ 圆', bx, by + 110, { color: C.green, font: '16px serif' });
      text(f, '柏拉图当年悬赏的题目：圆是周长给定时面积最大的形状', bx, by + 150, { color: C.fg, font: '14px sans-serif' });
      text(f, '严格证明拖到 19 世纪（雅可比/施泰纳的变分法）', bx, by + 184, { color: C.cool, font: '14px sans-serif' });
      footnotes(f, [
        '带约束的变分：拉格朗日乘子法把 ∫F + λ∫G 一起变分',
        '肥皂膜自动求极小面积 —— 表面张力在实验室里跑变分法',
        '管路设计、包装材料、细胞形状：等周问题的现代变体',
      ]);
    } else {
      // 固定能量的轨道
      const v = view(f, { xMin: -6, xMax: 6, yMin: -4, yMax: 4, inset: 46, insetBottom: 46 });
      grid(f, v);
      dot(f, v.sx(0), v.sy(0), 9, C.hot);
      text(f, 'M', v.sx(0) + 12, v.sy(0) - 8, { color: C.hot, font: '14px serif' });
      // 轨道族（不同角动量同能量）
      const eCurve = (L: number, color: string, dash?: number[]) => {
        const pts: Array<[number, number]> = [];
        for (let i = 0; i <= 240; i++) {
          const phi = (i / 240) * Math.PI * 2;
          const r = 1 / (0.28 + 0.42 * Math.cos(phi)) * (1 + L * 0.06);
          if (r > 8 || r < 0.4) { if (pts.length > 1) poly(f, pts, { stroke: color, lw: 2, dash }); pts.length = 0; continue; }
          pts.push([v.sx(r * Math.cos(phi)), v.sy(r * Math.sin(phi))]);
        }
        if (pts.length > 1) poly(f, pts, { stroke: color, lw: 2, dash });
      };
      eCurve(1.4, `${C.cool}99`, [7, 5]);
      eCurve(0.4, `${C.cool}99`, [7, 5]);
      eCurve(0.9, C.green);
      text(f, '绿：作用量驻值轨道（椭圆）', v.sx(-5.8), v.sy(3.7), { color: C.green, font: '14px serif' });
      text(f, '蓝虚：同能量不同角动量的试探轨道', v.sx(-5.8), v.sy(3.35), { color: C.cool, font: '14px serif' });
      text(f, 'δS = 0 在能量+角动量双约束下选出真实轨道', v.sx(-5.8), v.sy(-3.6), { color: C.yellow, font: '15px serif' });
      text(f, '（开普勒问题：变分原理重新推导行星运动）', v.sx(-5.8), v.sy(-3.25), { color: C.fg, font: '14px sans-serif' });
      footnotes(f, [
        '守恒量=变分约束的乘子：能量↔时间平移、角动量↔旋转（诺特再上岗）',
        '约束变分的乘子法在广义相对论里变成拉格朗日乘子场（规范固定）',
        '最优控制的庞特里亚金极大值原理是等周问题的动态推广',
      ]);
    }
    heading(f, '拉格朗日乘子进入变分法');
  },
});
registerViz(isoperimetricProblem);

/** P581 哈密顿原理与最小作用量。 */
const hamiltonPrincipleAction = defineViz({
  slug: 'hamilton-principle-action',
  title: '哈密顿原理与最小作用量',
  params: { system: { type: 'select', options: ['自由下落', '谐振子', '单摆'], default: '谐振子', label: '系统' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'system', '谐振子');
    clear(f);
    // 左：路径空间（真实路径 vs 试探路径的作用量）
    const v = view(f, { xMin: 0, xMax: 4, yMin: -2, yMax: 2, inset: 46, insetBottom: 46 });
    grid(f, v);
    const truePath = (t: number): number => {
      if (kind === '自由下落') return -0.5 * t * t + 2;
      if (kind === '谐振子') return Math.cos(t * 2) * 1.5;
      return Math.sin(t * 2.2) * 1.4;
    };
    // 真实路径
    const tp: Array<[number, number]> = [];
    for (let i = 0; i <= 200; i++) {
      const t = (i / 200) * 4;
      tp.push([v.sx(t), v.sy(truePath(t))]);
    }
    poly(f, tp, { stroke: C.green, lw: 3.4 });
    // 试探族
    const wobble = Math.sin(f.t * 1.3);
    for (const eps of [-0.55, -0.28, 0.28, 0.55]) {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 160; i++) {
        const t = (i / 160) * 4;
        pts.push([v.sx(t), v.sy(truePath(t) + eps * Math.sin(Math.PI * (t / 4)) * (1 + wobble * 0.2))]);
      }
      poly(f, pts, { stroke: `${C.cool}77`, lw: 1.6, dash: [7, 5] });
    }
    text(f, '绿=真实路径（δS=0）　蓝虚=扰动路径（S 变化一阶为零）', v.sx(0.1), v.sy(1.9), { color: C.fg, font: '14px serif' });
    text(f, 'x', (v.sx(0) + v.sx(4)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 't', v.sx(0.1), v.sy(-1.92), { color: C.dim, font: '12px sans-serif' });
    // 右：作用量账本
    const bx = w * 0.58;
    text(f, '作用量 S = ∫L dt　L = T − V', bx, 96, { color: C.yellow, font: '18px serif' });
    text(f, '哈密顿原理：真实路径使 S 取驻值', bx, 140, { color: C.fg, font: '16px serif' });
    text(f, 'δS = 0 ⇔ 欧拉-拉格朗日 ⇔ 牛顿定律', bx, 184, { color: C.green, font: '16px serif' });
    // 作用量对比条
    const sValues = [['试探 A', 0.72, C.cool], ['真实路径', 1.0, C.green], ['试探 B', 0.81, C.cool]] as Array<[string, number, string]>;
    sValues.forEach(([name, val, color], i) => {
      const y = 246 + i * 56;
      text(f, name, bx, y + 4, { color, font: '14px serif' });
      poly(f, [[bx + 90, y - 12], [bx + 90 + 220 * val, y - 12], [bx + 90 + 220 * val, y + 12], [bx + 90, y + 12]],
        { fill: `${color}aa`, stroke: color, lw: 1.4 });
      text(f, name === '真实路径' ? 'S（驻值）' : `S ± δS（一阶同）`, bx + 100 + 220 * val, y + 5, { color: C.dim, font: '12px serif' });
    });
    text(f, '最小？驻值？历史有趣：莫佩尔蒂"最小"被欧拉挑剔，', bx, 448, { color: C.dim, font: '14px serif' });
    text(f, '哈密顿改成"驻值"才真正正确（可能极大、极小、鞍点）', bx, 476, { color: C.hot, font: '14px serif' });
    text(f, '量子版本：路径积分把所有路径按 e^{iS/ℏ} 加权求和', bx, h - 116, { color: C.pink, font: '15px serif' });
    text(f, '经典路径=相位平稳相长（驻值）—— 经典从量子里浮现', bx, h - 86, { color: C.yellow, font: '14px serif' });
    footnotes(f, [
      '一条原理统一经典力学：从 L 出发可导出全部运动方程与守恒律',
      '诺特定理的家：对称性如何改变 S ⇒ 守恒律（能量/动量/角动量）',
      '广义相对论的作用量=曲率标量积分（爱因斯坦-希尔伯特作用量）',
    ]);
    heading(f, 'δS = 0：一条原理统治经典动力学');
  },
});
registerViz(hamiltonPrincipleAction);

/** P582 瑞利-里兹数值变分。 */
const rayleighRitz = defineViz({
  slug: 'rayleigh-ritz',
  title: '瑞利-里兹数值变分',
  params: { basis: { type: 'range', min: 1, max: 6, default: 2, step: 1, label: '基函数个数' } },
  draw: (f) => {
    const { w, h, params } = f;
    const N = Math.round(num(params, 'basis', 2));
    clear(f);
    // 左：试探函数逼近
    const v = view(f, { xMin: 0, xMax: 1, yMin: -0.3, yMax: 1.3, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 精确解（无限深势阱基态 cos）
    const exact: Array<[number, number]> = [];
    for (let i = 0; i <= 200; i++) {
      const x = i / 200;
      exact.push([v.sx(x), v.sy(Math.sin(Math.PI * x))]);
    }
    poly(f, exact, { stroke: C.green, lw: 3, dash: [8, 5] });
    // 试探：前 N 个正弦基的组合（系数按最小能量优化示意）
    const approx: Array<[number, number]> = [];
    for (let i = 0; i <= 200; i++) {
      const x = i / 200;
      let y = 0;
      for (let n = 1; n <= N; n++) {
        const coef = n === 1 ? 1.06 - 0.05 * N : (n % 4 === 1 ? 0.5 / Math.pow(n, 3) : -0.4 / Math.pow(n, 3));
        y += coef * Math.sin(n * Math.PI * x);
      }
      approx.push([v.sx(x), v.sy(Math.max(-0.25, Math.min(1.25, y)))]);
    }
    poly(f, approx, { stroke: C.accent, lw: 3 });
    text(f, '绿虚=精确解　蓝实=瑞利-里兹近似', v.sx(0.03), v.sy(1.25), { color: C.fg, font: '14px serif' });
    text(f, `用了前 ${N} 个基函数：能量误差随 N 指数掉（基越好掉越快）`, v.sx(0.03), v.sy(1.12), { color: C.yellow, font: '14px serif' });
    text(f, 'x', (v.sx(0) + v.sx(1)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    // 右：能量随 N 收敛（变分上界单调下降）
    const bx = w * 0.58, by0 = h - 140, by1 = 120;
    seg(f, bx, by0, w - 50, by0, C.grid, 1.4);
    seg(f, bx, by0, bx, by1, C.grid, 1.4);
    const Eexact = 0.49;
    seg(f, bx, by0 - Eexact * (by0 - by1), w - 50, by0 - Eexact * (by0 - by1), C.green, 2, );
    text(f, '精确 E₀', w - 100, by0 - Eexact * (by0 - by1) - 8, { color: C.green, font: '13px serif' });
    const pts: Array<[number, number]> = [];
    for (let n = 1; n <= 6; n++) {
      const E = Eexact + 0.5 / Math.pow(n, 2.4);
      pts.push([bx + ((n - 1) / 5) * (w - 100 - bx), by0 - Math.min(1, E) * (by0 - by1)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.8 });
    dot(f, pts[N - 1][0], pts[N - 1][1], 7, C.hot);
    text(f, 'E_N ≥ E₀：变分法保证近似能量永远偏高', bx, by1 - 24, { color: C.yellow, font: '15px serif' });
    text(f, '单调不增 ⇒ 误差有明确上界（可量化）', bx, by0 + 26, { color: C.fg, font: '14px serif' });
    text(f, 'N（基函数数）', bx + 60, by0 + 52, { color: C.dim, font: '13px serif' });
    footnotes(f, [
      '瑞利-里兹：把无穷维极值问题截断成有限维矩阵本征值问题',
      '有限元方法=分段多项式基的瑞利-里兹（单元组装实现大规模求解）',
      '量子化学的基石：选好基组（高斯型轨道），SCF 迭代找最优系数',
    ]);
    heading(f, '有限基逼近泛函极小');
  },
});
registerViz(rayleighRitz);

/** P583 变分不等式与詹森界。 */
const variationalInequalities = defineViz({
  slug: 'variational-inequalities',
  title: '变分不等式与詹森界',
  params: { dist: { type: 'select', options: ['单峰分布', '双峰分布', '重尾分布'], default: '单峰分布', label: '分布' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'dist', '单峰分布');
    clear(f);
    const v = view(f, { xMin: -4, xMax: 4, yMin: 0, yMax: 1.4, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 分布
    const pdf = (x: number): number => {
      if (kind === '单峰分布') return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI) * 2.5;
      if (kind === '双峰分布') return (Math.exp(-Math.pow(x - 1.6, 2) / 0.7) + Math.exp(-Math.pow(x + 1.6, 2) / 0.7)) / Math.sqrt(2 * Math.PI) * 1.4;
      return 0.9 / (1 + Math.pow(Math.abs(x), 3)) * 1.2;
    };
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 300; i++) {
      const x = -4 + (i / 300) * 8;
      pts.push([v.sx(x), v.sy(Math.min(1.35, pdf(x)))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.8, fill: 'rgba(102,126,234,0.12)', close: true });
    // 均值与 φ(均值)
    const mean = kind === '双峰分布' ? 0 : 0;
    const phiConvex = (x: number) => Math.exp(-0.5) * Math.exp(x * x / 2.6) * 0.62;
    dot(f, v.sx(mean), v.sy(0.05), 7, C.hot);
    text(f, '⟨x⟩', v.sx(mean), v.sy(0.05) + 24, { align: 'center', color: C.hot, font: '14px serif' });
    // 詹森不等式图示：φ(⟨x⟩) ≤ ⟨φ(x)⟩
    const bx = w * 0.58;
    text(f, '詹森不等式（凸函数 φ）：', bx, 96, { color: C.yellow, font: '18px serif' });
    text(f, 'φ(⟨X⟩) ≤ ⟨φ(X)⟩', bx, 144, { color: C.hot, font: '24px serif' });
    text(f, '凸函数"弦在弧上方"：先平均再变换 ≤ 先变换再平均', bx, 196, { color: C.fg, font: '15px serif' });
    // 两个应用
    text(f, '物理战果：', bx, 260, { color: C.cool, font: '16px serif' });
    const apps = [
      ['信息论：I(X) = −⟨ln p⟩ 凸性 ⇒ 数据处理不等式', C.cool],
      ['统计物理：⟨lnZ⟩ ≤ ln⟨Z⟩ ⇒ 自由能是内能上界', C.green],
      ['量子信息：冯诺依曼熵的凸性 ⇒ 可加性证明', C.warm],
      ['概率：几何-算术均值不等式是它的一次特例', C.pink],
    ] as Array<[string, string]>;
    apps.forEach(([s, color], i) => text(f, '· ' + s, bx, 300 + i * 40, { color, font: '14px sans-serif' }));
    text(f, '变分法给上界的思路：不求精确解，先框住答案', bx, h - 140, { color: C.yellow, font: '16px serif' });
    text(f, '李茨上界、Pekeris 约束变分、Fischer 界 —— 计算物理的保守主义', bx, h - 108, { color: C.fg, font: '14px sans-serif' });
    text(f, 'x', (v.sx(-4) + v.sx(4)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      '凸性是不等式的发动机：一阶条件 φ(y) ≥ φ(x) + φ\'(x)(y−x) 直接积分出詹森',
      '负号翻转：凹函数不等式反向（熵是凹的 → 各种熵不等式）',
      '数值验证：蒙特卡洛随机抽样估计两端 —— 不等式的计算机证明',
    ]);
    heading(f, '不求精确解也能框住答案');
  },
});
registerViz(variationalInequalities);

/** P584 谱定理与对角化。 */
const spectralDecomposition = defineViz({
  slug: 'spectral-decomposition',
  title: '谱定理与对角化',
  params: { mode: { type: 'select', options: ['厄米矩阵对角化', '正交基投影', '函数演算'], default: '厄米矩阵对角化', label: '演示' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'mode', '厄米矩阵对角化');
    clear(f);
    if (kind === '厄米矩阵对角化') {
      // 左：矩阵 → 对角
      const bx = 60, by = 110, cell = 54;
      text(f, '厄米矩阵 A（A† = A）', bx, by - 24, { color: C.fg, font: '16px serif' });
      const M = [[2, 1 + 0.5], [1 - 0.5, -1]];
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          poly(f, [[bx + c * cell, by + r * cell], [bx + (c + 1) * cell, by + r * cell], [bx + (c + 1) * cell, by + (r + 1) * cell], [bx + c * cell, by + (r + 1) * cell]],
            { fill: `rgba(102,126,234,${0.14 + Math.abs(M[r][c]) * 0.3})`, stroke: C.grid, lw: 1.6 });
          text(f, M[r][c].toFixed(1), bx + c * cell + cell / 2, by + r * cell + cell / 2 + 6, { align: 'center', color: C.fg, font: '15px serif' });
        }
      }
      vec(f, bx + 2 * cell + 16, by + cell, bx + 2 * cell + 84, by + cell, C.yellow, 3, 10);
      text(f, 'U†AU', bx + 2 * cell + 26, by + cell - 16, { color: C.yellow, font: '15px serif' });
      // 对角矩阵
      const dx = bx + 2 * cell + 110;
      const eig = [[2.22, 0], [0, -1.22]];
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          poly(f, [[dx + c * cell, by + r * cell], [dx + (c + 1) * cell, by + r * cell], [dx + (c + 1) * cell, by + (r + 1) * cell], [dx + c * cell, by + (r + 1) * cell]],
            { fill: `rgba(72,187,120,${Math.abs(eig[r][c]) > 0 ? 0.55 : 0.12})`, stroke: Math.abs(eig[r][c]) > 0 ? C.green : C.grid, lw: 1.6 });
          text(f, eig[r][c].toFixed(2), dx + c * cell + cell / 2, by + r * cell + cell / 2 + 6, { align: 'center', color: C.fg, font: '15px serif' });
        }
      }
      text(f, 'A = UDU†（谱分解）：A = λ₁|u₁⟩⟨u₁| + λ₂|u₂⟩⟨u₂|', bx, by + 2 * cell + 50, { color: C.green, font: '16px serif' });
      text(f, '厄米 ⇒ 特征值全实、本征矢正交 —— "最好的基"必然存在', bx, by + 2 * cell + 88, { color: C.yellow, font: '15px serif' });
      text(f, '量子力学：可观测量=厄米算符，测量=在本征基上投影', bx, by + 2 * cell + 126, { color: C.hot, font: '15px serif' });
      footnotes(f, [
        '谱定理三版本：矩阵（对角化）、算符（谱测度）、函数（积分表示）',
        '正规矩阵（AA†=A†A）是厄米的推广：也能被酉对角化',
        '不可对角化的若尔当块=临界阻尼这类"退化"动力学',
      ]);
    } else if (kind === '正交基投影') {
      // 矢量分解
      const cx = w * 0.3, cy = h * 0.5;
      seg(f, cx - 180, cy + 120, cx + 180, cy - 120, C.cool, 3);
      seg(f, cx - 180, cy - 60, cx + 200, cy + 150, C.warm, 3);
      text(f, '|e₁⟩', cx + 150, cy - 118, { color: C.cool, font: '15px serif' });
      text(f, '|e₂⟩', cx + 170, cy + 145, { color: C.warm, font: '15px serif' });
      // 矢量与投影
      const vx = 120, vy = -70;
      vec(f, cx, cy, cx + vx, cy + vy, C.hot, 3.6, 11);
      text(f, '|ψ⟩', cx + vx + 12, cy + vy, { color: C.hot, font: '16px serif' });
      // 投影（点积方向）
      const e1x = Math.cos(Math.atan2(-120, 360)), e1y = Math.sin(Math.atan2(-120, 360));
      const proj = vx * e1x + vy * e1y;
      vec(f, cx, cy, cx + e1x * proj, cy + e1y * proj, C.green, 3);
      text(f, '⟨e₁|ψ⟩|e₁⟩', cx + e1x * proj * 0.5 - 40, cy + e1y * proj * 0.5 - 14, { color: C.green, font: '14px serif' });
      const e2x = Math.cos(Math.atan2(210, 380)), e2y = Math.sin(Math.atan2(210, 380));
      const proj2 = vx * e2x + vy * e2y;
      vec(f, cx, cy, cx + e2x * proj2, cy + e2y * proj2, C.yellow, 3);
      text(f, '⟨e₂|ψ⟩|e₂⟩', cx + e2x * proj2 * 0.5 + 10, cy + e2y * proj2 * 0.5 + 20, { color: C.yellow, font: '14px serif' });
      text(f, '|ψ⟩ = Σ ⟨eᵢ|ψ⟩|eᵢ⟩（完备性恒等式）', 60, h - 148, { color: C.green, font: '17px serif' });
      text(f, '投影算符 P = Σ|eᵢ⟩⟨eᵢ|：拆解-重组不丢信息', 60, h - 116, { color: C.fg, font: '15px serif' });
      text(f, '傅里叶级数、量子测量、主成分分析都是这幅图', 60, h - 84, { color: C.cool, font: '15px serif' });
      footnotes(f, [
        '正交归一基 ⟨eᵢ|eⱼ⟩ = δᵢⱼ：系数独立可求（投影的漂亮之处）',
        '完备性 Σ|eᵢ⟩⟨eᵢ| = 1̂ 是"没有漏网方向"的数学陈述',
        'Parseval 定理=投影长度平方和守恒：能量在任何基下同账',
      ]);
    } else {
      // 函数演算
      const bx = 60;
      text(f, '函数演算：f(A) = U f(D) U†', bx, 100, { color: C.yellow, font: '19px serif' });
      text(f, '矩阵函数 = 对特征值取函数再拼回：', bx, 148, { color: C.fg, font: '16px serif' });
      text(f, 'e^{At}、√A、ln A 全部这样定义', bx, 188, { color: C.cool, font: '16px serif' });
      // 例子表
      const examples = [
        ['e^{−iĤt/ℏ}', '量子时间演化（对角化后逐分量取相位）', C.green],
        ['A^{−1}', '求逆 = 1/λ₁, 1/λ₂ 逐个取倒数', C.cool],
        ['sign(A)', '符号函数 → 投影到正/负本征子空间', C.warm],
        ['√A', '密度矩阵求纯态振幅、协方差白化', C.pink],
      ] as Array<[string, string, string]>;
      examples.forEach(([expr, note, color], i) => {
        const y = 250 + i * 74;
        poly(f, [[bx, y], [bx + 640, y], [bx + 640, y + 58], [bx, y + 58]],
          { fill: `${color}12`, stroke: `${color}aa`, lw: 1.6 });
        text(f, expr, bx + 14, y + 37, { color, font: '17px serif' });
        text(f, note, bx + 220, y + 37, { color: C.fg, font: '14px sans-serif' });
      });
      text(f, '谱定理的实际红利：任何"好函数"作用在算符上都变得平凡', bx, 250 + 4 * 74 + 20, { color: C.yellow, font: '16px serif' });
      text(f, '（前提是可对角化 —— 厄米/酉矩阵永远满足）', bx, 250 + 4 * 74 + 56, { color: C.dim, font: '15px serif' });
      footnotes(f, [
        '函数演算绕过"矩阵怎么乘无穷次"：先对角化再逐点取函数',
        '热力学配分函数 e^{−βĤ}、密度矩阵幂 ρⁿ 都靠它',
        '谱半径、矩阵范数、稳定性分析：特征值说了算',
      ]);
    }
    void num;
  },
});
registerViz(spectralDecomposition);

/** P585 矩阵指数与时间演化。 */
const matrixExponential = defineViz({
  slug: 'matrix-exponential',
  title: '矩阵指数与时间演化',
  params: { H: { type: 'select', options: ['两能级哈密顿', '阻尼振子', '谐振子相干'], default: '两能级哈密顿', label: '生成元' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'H', '两能级哈密顿');
    clear(f);
    const t = f.t;
    // 左：e^{iAt} 作用（球面旋转）
    const cx = w * 0.27, cy = h * 0.46, R = 130;
    circle(f, cx, cy, R, { stroke: C.cool, lw: 2 });
    const { ctx } = f;
    ctx.save();
    ctx.strokeStyle = `${C.grid}aa`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, R, R * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // 旋转轨迹
    const th = t * 1.6;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 80; i++) {
      const a = (i / 80) * th;
      pts.push([cx + Math.sin(a) * R * 0.8, cy - Math.cos(a) * R * 0.5]);
    }
    poly(f, pts, { stroke: `${C.yellow}bb`, lw: 2.4 });
    const px = cx + Math.sin(th) * R * 0.8, py = cy - Math.cos(th) * R * 0.5;
    dot(f, px, py, 8, C.hot);
    text(f, kind === '两能级哈密顿' ? 'Bloch 矢量绕 H 方向进动' : '态矢在相空间旋转', cx - 130, cy - R - 30, { color: C.fg, font: '15px serif' });
    text(f, 'U(t) = e^{−iĤt/ℏ}：幺正 ⇒ 只转不缩（概率守恒）', cx - 150, cy + R + 46, { color: C.yellow, font: '15px serif' });
    // 右：级数与对角化求法
    const bx = w * 0.56;
    text(f, '定义：e^A = Σ Aⁿ/n! = I + A + A²/2! + …', bx, 96, { color: C.fg, font: '17px serif' });
    text(f, '性质：e^{A+B} = e^A·e^B（仅当 [A,B]=0）', bx, 140, { color: C.cool, font: '16px serif' });
    text(f, '对角化法：A = UDU† ⇒ e^A = U·diag(e^{λᵢ})·U†', bx, 196, { color: C.green, font: '16px serif' });
    // 具体动画：对角分量相位
    text(f, '两能级的显式结果（ω₀=2, Ω=1.5）：', bx, 262, { color: C.yellow, font: '16px serif' });
    // 布居随时间
    const v = view(f, { xMin: 0, xMax: 12, yMin: 0, yMax: 1.1, inset: w * 0.55, insetRight: 46, insetBottom: 46 });
    grid(f, v);
    const pE: Array<[number, number]> = [];
    for (let i = 0; i <= 300; i++) {
      const tt = (i / 300) * 12;
      pE.push([v.sx(tt), v.sy(Math.pow(Math.sin(tt * 0.75), 2))]);
    }
    poly(f, pE, { stroke: C.hot, lw: 2.8 });
    const pEnow = Math.pow(Math.sin(t * 0.75, ), 2);
    void pEnow;
    dot(f, v.sx(t % 12), v.sy(Math.pow(Math.sin((t % 12) * 0.75, ), 2)), 7, C.yellow);
    text(f, '布居 |c_e(t)|²：级数求和=精确的 Rabi 振荡', v.sx(0.3), v.sy(1.05), { color: C.fg, font: '14px serif' });
    text(f, 't', (v.sx(0) + v.sx(12)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, '换基定理：H 的本征基下 U 只是逐分量相位 e^{−iEₙt/ℏ}', bx, h - 116, { color: C.green, font: '15px serif' });
    text(f, '李代数 ↔ 李群：生成元的对易关系决定 U 的群结构', bx, h - 86, { color: C.pink, font: '14px sans-serif' });
    footnotes(f, [
      '矩阵指数把线性微分方程组化为闭式解：x(t) = e^{At}x(0)',
      '幺正性 U†U = I：e^{iH}（H 厄米）自动守恒内积 —— 量子演化的必然形式',
      'Rodrigues 公式：e^{iθn·σ} = cosθ·I + i sinθ·n·σ（旋转的自旋 1/2 版）',
    ]);
    heading(f, 'ê^(−iHt/ℏ) 把初值问题变成指数幂');
  },
});
registerViz(matrixExponential);

/** P586 投影算符与子空间分解。 */
const projectorSubspace = defineViz({
  slug: 'projector-subspace',
  title: '投影算符与子空间分解',
  params: { kind2: { type: 'select', options: ['对称/反对称分解', '自旋上/下投影', '密度矩阵分块'], default: '对称/反对称分解', label: '分解' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'kind2', '对称/反对称分解');
    clear(f);
    const cx = w * 0.5, cy = h * 0.44;
    if (kind === '对称/反对称分解') {
      // 态空间分成两半
      text(f, '两粒子态空间 = 对称 ⊕ 反对称', cx - 240, 96, { color: C.fg, font: '17px serif' });
      const bx = w * 0.14, by = 140, bw = w * 0.32, bh = h * 0.4;
      poly(f, [[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]],
        { stroke: C.green, lw: 2.6, fill: 'rgba(72,187,120,0.16)' });
      text(f, '对称子空间（玻色子住这）', bx + 20, by + 34, { color: C.green, font: '15px serif' });
      text(f, 'P_S = ½(1 + P₁₂)', bx + 20, by + 70, { color: C.fg, font: '16px serif' });
      text(f, '|ab⟩+|ba⟩ 型', bx + 20, by + 108, { color: C.dim, font: '14px serif' });
      // 粒子动画
      const swap = (Math.sin(f.t * 1.6) + 1) / 2;
      circle(f, bx + 60 + swap * 90, by + bh - 70, 16, { fill: 'rgba(66,153,225,0.85)', stroke: C.cool });
      circle(f, bx + 150 - swap * 90, by + bh - 70, 16, { fill: 'rgba(237,137,54,0.85)', stroke: C.warm });
      text(f, '交换后波函数不变号 ✓', bx + 20, by + bh - 24, { color: C.green, font: '14px serif' });
      const bx2 = w * 0.54;
      poly(f, [[bx2, by], [bx2 + bw, by], [bx2 + bw, by + bh], [bx2, by + bh]],
        { stroke: C.hot, lw: 2.6, fill: 'rgba(245,101,101,0.14)' });
      text(f, '反对称子空间（费米子住这）', bx2 + 20, by + 34, { color: C.hot, font: '15px serif' });
      text(f, 'P_A = ½(1 − P₁₂)', bx2 + 20, by + 70, { color: C.fg, font: '16px serif' });
      text(f, '|ab⟩−|ba⟩ 型（Slater 行列式）', bx2 + 20, by + 108, { color: C.dim, font: '14px serif' });
      text(f, '交换后变号 ⇒ 同态不能同占（泡利）', bx2 + 20, by + bh - 24, { color: C.hot, font: '14px serif' });
      // 中间的交换算符
      vec(f, bx + bw + 14, cy, bx2 - 14, cy, C.yellow, 3.4, 11);
      text(f, 'P₁₂', (bx + bw + bx2) / 2 - 14, cy - 16, { color: C.yellow, font: '16px serif' });
      text(f, 'P_S + P_A = 1̂，P_S·P_A = 0（正交补）', cx - 250, by + bh + 56, { color: C.yellow, font: '16px serif' });
      footnotes(f, [
        '投影三条件：P² = P、P† = P、完备分解 ΣP = 1̂',
        '全同粒子的对称性公设=预先选定住在哪个子空间（自旋统计的输入）',
        '化学键的价键/分子轨道之争本质是对称化方案之争',
      ]);
    } else if (kind === '自旋上/下投影') {
      text(f, '自旋 1/2 态按 σz 分解：|ψ⟩ = α|↑⟩ + β|↓⟩', cx - 250, 96, { color: C.fg, font: '17px serif' });
      text(f, 'P↑ = |↑⟩⟨↑| = (1+σz)/2　P↓ = (1−σz)/2', cx - 250, 140, { color: C.cool, font: '16px serif' });
      // 概率条
      const prob = Math.pow(Math.cos(f.t * 1.1), 2);
      const bx = cx - 200, by = 220;
      text(f, '测量投影：', bx, by - 24, { color: C.yellow, font: '15px serif' });
      poly(f, [[bx, by], [bx + 400, by], [bx + 400, by + 56], [bx, by + 56]], { fill: 'rgba(58,74,99,0.7)', stroke: C.grid });
      poly(f, [[bx, by], [bx + 400 * prob, by], [bx + 400 * prob, by + 56], [bx, by + 56]], { fill: 'rgba(66,153,225,0.75)' });
      text(f, `P(↑) = |α|² = ${prob.toFixed(2)}`, bx + 10, by + 36, { color: C.fg, font: '15px serif' });
      text(f, `P(↓) = |β|² = ${(1 - prob).toFixed(2)}`, bx + 412, by + 36, { color: C.warm, font: '15px serif' });
      text(f, '投影后态塌缩到子空间：P|ψ⟩/‖P|ψ⟩‖', bx, by + 96, { color: C.fg, font: '15px serif' });
      text(f, '不同方向的投影互不相容（σx 与 σz 的投影子空间不正交补）', bx, by + 136, { color: C.hot, font: '15px serif' });
      text(f, '—— 测量问题的代数面孔', bx, by + 172, { color: C.yellow, font: '15px serif' });
      footnotes(f, [
        '投影测量（Lüders 规则）：先投影再归一化 —— 量子测量的标准模型',
        'POVM 是投影的推广：非正交态的最优识别（量子信息常用）',
        '冯诺依曼的测量公设：期望值 = Tr(ρA) 就是"加权投影和"',
      ]);
    } else {
      // 密度矩阵分块
      text(f, '约化密度矩阵：ρ_A = Tr_B ρ（部分迹）', cx - 250, 96, { color: C.fg, font: '17px serif' });
      const cell = 46, ox = cx - 180, oy = 150;
      const rho = [[0.5, 0, 0.2, 0], [0, 0.5, 0, -0.15], [0.2, 0, 0.3, 0], [0, -0.15, 0, 0.3]];
      text(f, 'ρ（AB 联合，4×4）', ox, oy - 18, { color: C.cool, font: '14px serif' });
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const v0 = rho[r][c];
          const inBlockA = (r < 2 && c < 2), inBlockD = (r >= 2 && c >= 2);
          const tracePart = (r === c && (r === 0 || r === 3));
          poly(f, [[ox + c * cell, oy + r * cell], [ox + (c + 1) * cell, oy + r * cell], [ox + (c + 1) * cell, oy + (r + 1) * cell], [ox + c * cell, oy + (r + 1) * cell]],
            { fill: v0 === 0 ? 'rgba(45,55,72,0.7)' : tracePart ? 'rgba(72,187,120,0.55)' : `rgba(102,126,234,${0.2 + Math.abs(v0) * 1.4})`, stroke: C.grid, lw: 1.4 });
          if (v0 !== 0) text(f, v0.toFixed(2), ox + c * cell + cell / 2, oy + r * cell + cell / 2 + 5, { align: 'center', color: C.fg, font: '12px serif' });
          void inBlockA; void inBlockD;
        }
      }
      // 部分迹箭头
      vec(f, ox + 4 * cell + 20, oy + cell, ox + 4 * cell + 96, oy + cell, C.yellow, 3, 10);
      text(f, 'Tr_B', ox + 4 * cell + 32, oy + cell - 16, { color: C.yellow, font: '15px serif' });
      const dx = ox + 4 * cell + 120;
      text(f, 'ρ_A（2×2）', dx, oy - 18, { color: C.green, font: '14px serif' });
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          const v0 = rho[r][c] + rho[r + 2][c + 2];
          poly(f, [[dx + c * cell, oy + r * cell], [dx + (c + 1) * cell, oy + r * cell], [dx + (c + 1) * cell, oy + (r + 1) * cell], [dx + c * cell, oy + (r + 1) * cell]],
            { fill: `rgba(72,187,120,${0.2 + Math.abs(v0) * 0.8})`, stroke: C.green, lw: 1.6 });
          text(f, v0.toFixed(2), dx + c * cell + cell / 2, oy + r * cell + cell / 2 + 5, { align: 'center', color: C.fg, font: '13px serif' });
        }
      }
      text(f, '对角块相加（B 的指标迹掉）', dx - 20, oy + 2 * cell + 34, { color: C.green, font: '14px serif' });
      text(f, '纠缠 ⇒ ρ_A 是混合态（非对角消失）—— 子系统"看不懂"全局相位', ox - 40, oy + 4 * cell + 50, { color: C.hot, font: '15px serif' });
      text(f, '纠缠熵 S(ρ_A) 量化纠缠程度：面积定律、黑洞熵都用它数', ox - 40, oy + 4 * cell + 86, { color: C.yellow, font: '14px sans-serif' });
      footnotes(f, [
        '部分迹是最常用的"粗粒化"：丢掉一个子系统的全部记录',
        '纯态的约化可以是混合态 —— 纠缠的量子信息定义',
        'Schmidt 分解：纠缠态在双方本征基下的标准型',
      ]);
    }
    void num;
  },
});
registerViz(projectorSubspace);

/** P587 张量积与多体态空间。 */
const tensorProductSpace = defineViz({
  slug: 'tensor-product-space',
  title: '张量积与多体态空间',
  params: { state: { type: 'select', options: ['可分态', '纠缠态（Bell）', '三体 GHZ'], default: '纠缠态（Bell）', label: '态类型' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'state', '纠缠态（Bell）');
    clear(f);
    // 左：空间维度增长
    const bx = 56;
    text(f, 'H = H_A ⊗ H_B：维度相乘不是相加', bx, 96, { color: C.yellow, font: '17px serif' });
    const dims = kind === '三体 GHZ' ? [2, 2, 2] : [2, 2];
    let total = 1;
    dims.forEach((d) => { total *= d; });
    text(f, `${dims.map((d, i) => 'H' + 'ABCD'[i] + '(' + d + ')').join(' ⊗ ')} = ${total} 维`, bx, 140, { color: C.fg, font: '16px serif' });
    // 基矢格
    const cell = 56;
    const labels = kind === '可分态' ? ['|00⟩', '|01⟩', '|10⟩', '|11⟩']
      : kind === '纠缠态（Bell）' ? ['|00⟩+|11⟩', '（除 √2）', '叠加两项', '不可分解']
        : ['|000⟩+|111⟩', '（除 √2）', '三体纠缠', '非局域'];
    for (let i = 0; i < total; i++) {
      const c = i % 4, r = Math.floor(i / 4);
      const x = bx + c * (cell + 8), y = 180 + r * (cell + 8);
      const active = kind === '可分态' ? true : i === 0 || i === 3;
      poly(f, [[x, y], [x + cell, y], [x + cell, y + cell], [x, y + cell]],
        { fill: active ? 'rgba(102,126,234,0.65)' : 'rgba(45,55,72,0.7)', stroke: active ? C.accent : C.grid, lw: 1.8 });
      if (i < 4) text(f, labels[i].length <= 4 ? labels[i] : '', x + cell / 2, y + cell / 2 + 5, { align: 'center', color: C.fg, font: '13px serif' });
    }
    text(f, kind === '可分态' ? '可分态：|ψ⟩ = |a⟩⊗|b⟩（占据确定格点）' : '纠缠态：基矢的相干叠加（占两个格点）',
      bx, 180 + 2 * (cell + 8) + 34, { color: kind === '可分态' ? C.green : C.pink, font: '15px serif' });
    // 右：可分性判据
    const rx = w * 0.55;
    if (kind === '可分态') {
      text(f, '判据：系数矩阵秩 = 1', rx, 110, { color: C.green, font: '17px serif' });
      const M = [[0.6, 0.2], [0.3, 0.1]];
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          poly(f, [[rx + c * 54, 150 + r * 54], [rx + (c + 1) * 54, 150 + r * 54], [rx + (c + 1) * 54, 150 + (r + 1) * 54], [rx + c * 54, 150 + (r + 1) * 54]],
            { fill: `rgba(72,187,120,${0.15 + M[r][c]})`, stroke: C.grid, lw: 1.4 });
          text(f, M[r][c].toFixed(1), rx + c * 54 + 27, 150 + r * 54 + 33, { align: 'center', color: C.fg, font: '14px serif' });
        }
      }
      text(f, '行成比例 ⇒ 秩 1 ⇒ 可分离', rx, 290, { color: C.green, font: '15px serif' });
      text(f, '各测各的：联合概率 = 概率相乘', rx, 330, { color: C.fg, font: '15px serif' });
    } else {
      text(f, '判据：系数矩阵秩 ≥ 2（纠缠）', rx, 110, { color: C.pink, font: '17px serif' });
      const M = kind === '纠缠态（Bell）' ? [[0.7, 0], [0, 0.7]] : [[0.7, 0], [0, 0.7]];
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          poly(f, [[rx + c * 54, 150 + r * 54], [rx + (c + 1) * 54, 150 + r * 54], [rx + (c + 1) * 54, 150 + (r + 1) * 54], [rx + c * 54, 150 + (r + 1) * 54]],
            { fill: `rgba(237,100,166,${0.15 + M[r][c]})`, stroke: C.pink, lw: 1.6 });
          text(f, M[r][c].toFixed(1), rx + c * 54 + 27, 150 + r * 54 + 33, { align: 'center', color: C.fg, font: '14px serif' });
        }
      }
      text(f, '对角占优：无法写成外积', rx, 290, { color: C.pink, font: '15px serif' });
      text(f, '测量 A 立即决定 B：非局域关联（贝尔不等式破缺）', rx, 330, { color: C.hot, font: '15px serif' });
      text(f, '但不能传信息：约化态不变（无信号定理）', rx, 370, { color: C.cool, font: '14px sans-serif' });
    }
    text(f, '为什么必须张量积：全同粒子交换对称作用在积空间上', rx, h - 130, { color: C.yellow, font: '15px serif' });
    text(f, '直和（⊕）= 选一个空间；张量积（⊗）= 同时拥有两者', rx, h - 98, { color: C.fg, font: '14px sans-serif' });
    footnotes(f, [
      '多体希尔伯特空间指数膨胀：300 电子 = 2³⁰⁰ 维 —— 量子计算的全部难度',
      '纠缠是张量积结构的产物：不可分解态=量子信息的资源',
      '密度矩阵、部分迹、Schmidt 分解都在这个积空间上运作',
    ]);
    heading(f, '纠缠从张量积的不可分解态诞生');
  },
});
registerViz(tensorProductSpace);

/** P588 本征值扰动理论。 */
const eigenvaluePerturbation = defineViz({
  slug: 'eigenvalue-perturbation',
  title: '本征值扰动理论',
  params: { eps: { type: 'range', min: 0, max: 1, default: 0.5, step: 0.05, label: '微扰强度 ε' } },
  draw: (f) => {
    const { w, h, params } = f;
    const eps = num(params, 'eps', 0.5);
    clear(f);
    // 左：特征值随 ε 移动
    const v = view(f, { xMin: 0, xMax: 1, yMin: -3, yMax: 3, inset: 46, insetBottom: 46 });
    grid(f, v);
    // λ1 = 2 + ε·1.5, λ2 = -1 - ε·0.8, λ3 = 0.4 + ε²（二阶效应）
    const curves: Array<[string, (e: number) => number, string]> = [
      ['λ₁(ε) = 2 + 1.5ε', (e) => 2 + 1.5 * e, C.cool],
      ['λ₂(ε) = −1 − 0.8ε', (e) => -1 - 0.8 * e, C.warm],
      ['λ₃(ε) = 0.4 + 1.2ε²', (e) => 0.4 + 1.2 * e * e, C.green],
    ];
    for (const [name, fn, color] of curves) {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 80; i++) {
        const e = (i / 80) * 1;
        pts.push([v.sx(e), v.sy(fn(e))]);
      }
      poly(f, pts, { stroke: color, lw: 2.8 });
      const yEnd = fn(1);
      text(f, name, v.sx(0.55), v.sy(fn(0.55)) - 12, { color, font: '13px serif' });
      void yEnd;
    }
    // 当前 ε
    dot(f, v.sx(eps), v.sy(2 + 1.5 * eps), 7, C.hot);
    dot(f, v.sx(eps), v.sy(-1 - 0.8 * eps), 7, C.hot);
    dot(f, v.sx(eps), v.sy(0.4 + 1.2 * eps * eps), 7, C.hot);
    seg(f, v.sx(eps), v.sy(-3), v.sx(eps), v.sy(3), `${C.hot}77`, 1.6);
    text(f, `ε = ${eps.toFixed(2)}`, v.sx(eps) + 8, v.sy(2.85), { color: C.hot, font: '14px serif' });
    text(f, 'λ (特征值)', v.sx(0.05), v.sy(2.9), { color: C.dim, font: '12px sans-serif' });
    text(f, 'ε（微扰参数）', (v.sx(0) + v.sx(1)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, '蓝/橙：一阶修正（斜率=矩阵元）　绿：纯二阶（一阶为零时）', v.sx(0.05), v.sy(-2.8), { color: C.fg, font: '14px serif' });
    // 右侧公式
    const bx = w * 0.6;
    text(f, '非简并一阶：', bx, 96, { color: C.yellow, font: '16px serif' });
    text(f, 'λₙ⁽¹⁾ = ⟨n|V|n⟩（微扰矩阵元）', bx, 132, { color: C.cool, font: '16px serif' });
    text(f, '二阶：Σ_{m≠n} |⟨m|V|n⟩|²/(λₙ−λₘ)', bx, 172, { color: C.green, font: '15px serif' });
    text(f, '二阶恒负（基态被拉低）—— 变分法的呼应', bx, 208, { color: C.dim, font: '14px serif' });
    text(f, '简并时：子空间内先对角化（久期方程）', bx, 262, { color: C.hot, font: '16px serif' });
    text(f, '误差量级：O(ε²)（|V| ≪ 能级差时可靠）', bx, 316, { color: C.yellow, font: '15px serif' });
    text(f, '应用场景：', bx, 372, { color: C.fg, font: '15px serif' });
    ['原子能级在外场中的移动（Stark/Zeeman）', '晶格振动谱对缺陷的响应', '结构灵敏度分析、模态置信度'].forEach((s, i) => {
      text(f, '· ' + s, bx, 406 + i * 34, { color: C.cool, font: '14px sans-serif' });
    });
    footnotes(f, [
      '矩阵加小量，特征值挪多少：MATLAB 的 `eig(A+εB)` 背后的解析理论',
      '简并微扰是分水岭：必须在简并子空间对角化，否则一阶失效',
      '数值矩阵扰动理论（ Bauer-Fike）：条件数决定特征值对扰动的敏感度',
    ]);
    heading(f, '矩阵加小量，特征值挪多少');
  },
});
registerViz(eigenvaluePerturbation);

/** P589 最小二乘与曲线拟合。 */
const leastSquaresFitting = defineViz({
  slug: 'least-squares-fitting',
  title: '最小二乘与曲线拟合',
  params: { model: { type: 'select', options: ['直线', '二次曲线', '指数'], default: '直线', label: '拟合模型' } },
  draw: (f) => {
    const { w, h, params } = f;
    const model = str(params, 'model', '直线');
    clear(f);
    const v = view(f, { xMin: -0.3, xMax: 6.3, yMin: -1, yMax: 7, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 数据点（确定性噪声）
    const rand = rng(23);
    const data: Array<[number, number]> = [];
    for (let i = 0; i < 14; i++) {
      const x = 0.3 + i * 0.43;
      const yTrue = model === '直线' ? 0.8 * x + 0.8 : model === '二次曲线' ? 0.16 * x * x - 0.3 * x + 1.4 : 0.42 * Math.exp(x * 0.42);
      data.push([x, yTrue + (rand() - 0.5) * 1.5]);
    }
    for (const [x, y] of data) dot(f, v.sx(x), v.sy(y), 5.4, C.cool);
    // 拟合曲线
    const fit: Array<[number, number]> = [];
    for (let i = 0; i <= 120; i++) {
      const x = (i / 120) * 6.3;
      const y = model === '直线' ? 0.82 * x + 0.72 : model === '二次曲线' ? 0.155 * x * x - 0.28 * x + 1.35 : 0.42 * Math.exp(x * 0.42);
      fit.push([v.sx(x), v.sy(y)]);
    }
    poly(f, fit, { stroke: C.hot, lw: 3 });
    // 残差线
    for (const [x, y] of data) {
      const yFit = model === '直线' ? 0.82 * x + 0.72 : model === '二次曲线' ? 0.155 * x * x - 0.28 * x + 1.35 : 0.42 * Math.exp(x * 0.42);
      seg(f, v.sx(x), v.sy(y), v.sx(x), v.sy(yFit), `${C.yellow}aa`, 1.6);
    }
    text(f, '黄竖线 = 残差 (yᵢ − ŷᵢ)：最小化其平方和', v.sx(0), v.sy(6.7), { color: C.yellow, font: '14px serif' });
    text(f, 'x', (v.sx(-0.3) + v.sx(6.3)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    // 右下：正规方程
    const bx = w * 0.56;
    text(f, '正规方程：XᵀXβ = Xᵀy', bx, h - 190, { color: C.yellow, font: '18px serif' });
    text(f, '投影解释：y 在列空间上的最近点 = 拟合值', bx, h - 154, { color: C.fg, font: '15px serif' });
    text(f, '残差 ⊥ 列空间：(y − Xβ̂)ᵀX = 0', bx, h - 120, { color: C.green, font: '15px serif' });
    text(f, model === '直线' ? 'β̂ = (Σxᵢyᵢ − n x̄ȳ)/(Σxᵢ² − n x̄²)（手算公式）' :
      model === '二次曲线' ? '设计矩阵列：[1, x, x²] —— 多项式拟合' :
        '非线性模型：取对数线性化，或高斯-牛顿迭代', bx, h - 84, { color: C.cool, font: '15px serif' });
    footnotes(f, [
      '高斯的天才想法：误差高斯分布 ⇒ 最大似然 = 最小二乘 —— 概率给了它合法性',
      '几何视角：最小二乘=正交投影，残差与模型空间垂直',
      '加权最小二乘（方差不等）、岭回归（病态 XᵀX）是常用变体',
    ]);
    heading(f, '残差平方和最小=投影到列空间');
  },
});
registerViz(leastSquaresFitting);

/** P590 线性方程组与伪逆。 */
const linearSystemsPseudoinverse = defineViz({
  slug: 'linear-systems-pseudoinverse',
  title: '线性方程组与伪逆',
  params: { system: { type: 'select', options: ['欠定（无穷多解）', '超定（无精确解）', '奇异（无解）'], default: '超定（无精确解）', label: '系统类型' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'system', '超定（无精确解）');
    clear(f);
    const cx = w * 0.3, cy = h * 0.46;
    text(f, `Ax = b：${kind}`, cx - 220, 92, { color: C.yellow, font: '17px serif' });
    if (kind.startsWith('欠定')) {
      // 两平面交线
      const quad1: Array<[number, number]> = [[cx - 170, cy - 60], [cx + 130, cy - 100], [cx + 170, cy + 60], [cx - 130, cy + 100]];
      poly(f, quad1, { stroke: C.cool, lw: 2.4, fill: 'rgba(66,153,225,0.16)' });
      const quad2: Array<[number, number]> = [[cx - 150, cy - 100], [cx + 150, cy - 50], [cx + 130, cy + 90], [cx - 170, cy + 40]];
      poly(f, quad2, { stroke: C.warm, lw: 2.4, fill: 'rgba(237,137,54,0.14)' });
      seg(f, cx - 60, cy - 70, cx + 40, cy + 70, C.hot, 3.4);
      text(f, '交线 = 无穷多解', cx + 54, cy + 84, { color: C.hot, font: '15px serif' });
      text(f, '两个平面（两个方程），未知数三个', cx - 200, cy + 150, { color: C.fg, font: '15px serif' });
      text(f, '伪逆 x⁺ = A⁺b 给出最小范数解（离原点最近的那个）', cx - 200, cy + 184, { color: C.yellow, font: '15px serif' });
      footnotes(f, [
        '欠定系统：解空间是仿射子集 —— 需要额外准则（最小范数/最大熵/稀疏）',
        '伪逆的 Moore-Penrose 四条件唯一确定 A⁺（与可逆逆同性质）',
        '压缩感知：欠定但解稀疏 ⇒ 仍然唯一（L1 最小化）',
      ]);
    } else if (kind.startsWith('超定')) {
      // 直线族无公共交点
      const lines = [[0.9, 1.2], [1.1, 0.7], [0.7, 1.6], [1.3, 0.9], [0.85, 1.35]];
      lines.forEach(([m, b0], i) => {
        const x1 = -2.6, x2 = 2.6;
        seg(f, cx + x1 * 44, cy - (m * x1 + b0) * 44, cx + x2 * 44, cy - (m * x2 + b0) * 44,
          `rgba(66,153,225,${0.55 + i * 0.08})`, 2.2);
      });
      // 最小二乘解（交汇带）
      dot(f, cx, cy - 1.15 * 44, 9, C.hot);
      text(f, '没有公共交点，但"最近交汇点"存在', cx + 16, cy - 1.15 * 44 - 12, { color: C.hot, font: '15px serif' });
      text(f, '方程个数 > 未知数：精确解不存在', cx - 240, cy + 200, { color: C.fg, font: '15px serif' });
      text(f, 'x⁺ = (AᵀA)⁻¹Aᵀ：投影回列空间的最近点', cx - 240, cy + 234, { color: C.yellow, font: '16px serif' });
      text(f, '（AᵀA 可逆时伪逆=最小二乘解 —— 与 P589 合流）', cx - 240, cy + 268, { color: C.cool, font: '14px sans-serif' });
      footnotes(f, [
        '超定系统的"解"=正交投影：残差不可为零，但可最小',
        '条件数差时 (AᵀA)⁻¹ 放大误差：直接 SVD 求数值稳定的伪逆',
        'Kalman 滤波、系统辨识、机器学习回归全是最小二乘家族',
      ]);
    } else {
      // 奇异：两平行线
      seg(f, cx - 200, cy - 40, cx + 200, cy - 70, C.cool, 2.6);
      seg(f, cx - 200, cy + 40, cx + 200, cy + 10, C.warm, 2.6);
      text(f, '平行不相交：0 = 非零（矛盾）', cx - 60, cy - 108, { color: C.hot, font: '15px serif' });
      text(f, 'A 不满秩：det(A) = 0，逆不存在', cx - 240, cy + 140, { color: C.fg, font: '15px serif' });
      text(f, '两种处理：', cx - 240, cy + 180, { color: C.yellow, font: '15px serif' });
      text(f, '① 广义逆 A⁺：给最小二乘意义下的"伪解"', cx - 240, cy + 216, { color: C.cool, font: '15px serif' });
      text(f, '② SVD 截断小奇异值：正则化去噪声（病态反问题）', cx - 240, cy + 252, { color: C.green, font: '15px serif' });
      text(f, '条件数 κ = σ_max/σ_min：判读"这个方程组有多难算"', cx - 240, cy + 296, { color: C.hot, font: '14px sans-serif' });
      footnotes(f, [
        '奇异=信息不足：零奇异值方向上 b 的分量无法被任何 x 生成',
        '秩亏系统的广泛应用：图像重建、层析成形、推荐系统（隐语义）',
        '伪逆统一三态：唯一解（退化为逆）、超定（最小二乘）、欠定（最小范数）',
      ]);
    }
    void num;
  },
});
registerViz(linearSystemsPseudoinverse);