import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text, view, grid, curve, circle, vec, rng } from '../canvas';

/** P534 皮卡存在唯一性定理。 */
const picardUniqueness = defineViz({
  slug: 'picard-uniqueness',
  title: '皮卡存在唯一性定理',
  params: { slope: { type: 'range', min: -3, max: 3, default: 1, step: 0.25, label: '利普希茨常数 L' } },
  draw: (f) => {
    const { w, h, params } = f;
    const L = num(params, 'slope', 1);
    clear(f);
    const v = view(f, { xMin: -3, xMax: 3, yMin: -3, yMax: 3, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 真解（示意：y' = y ⇒ y = e^x 过 (0,1)）
    curve(f, v, (x) => Math.exp(x) * (L > 0 ? 1 : 1) * Math.exp((L - 1) * x * 0.15), { color: C.hot, lw: 3 });
    dot(f, v.sx(0), v.sy(1), 7, C.yellow);
    text(f, '初值 (0, 1)', v.sx(0) + 10, v.sy(1) - 10, { color: C.yellow, font: '13px serif' });
    // 逐步逼近序列（皮卡迭代）
    const rand = rng(7);
    const iterColors = [C.cool, C.green, C.cyan, C.accent, C.pink];
    for (let k = 1; k <= 5; k++) {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 120; i++) {
        const x = -1.6 + (i / 120) * 3.2;
        // 逼近真解：误差 ~ (Lx)^k/k!
        let y = 1;
        let term = 1;
        for (let n = 1; n <= k; n++) {
          term *= (L * x) / n;
          y += term;
        }
        pts.push([v.sx(x), v.sy(Math.max(-3, Math.min(3, y)))]);
      }
      poly(f, pts, { stroke: iterColors[k - 1], lw: 1.8, dash: [6, 4] });
    }
    void rand;
    text(f, '虚线 = 皮卡迭代 φ₁…φ₅：逐步逼近真解', v.sx(-2.9), v.sy(2.75), { color: C.fg, font: '14px serif' });
    text(f, `利普希茨条件 |f(x,y₁)-f(x,y₂)| ≤ L·|y₁-y₂|（当前 L=${L.toFixed(2)}）`, v.sx(-2.9), v.sy(2.5), { color: C.cool, font: '13px serif' });
    // 收敛域
    if (Math.abs(L) > 0.01) {
      const R = Math.min(3, 1 / Math.abs(L));
      poly(f, [[v.sx(-R), v.sy(-3)], [v.sx(R), v.sy(-3)], [v.sx(R), v.sy(3)], [v.sx(-R), v.sy(3)]],
        { stroke: `${C.green}99`, lw: 1.6, dash: [8, 6] });
      text(f, `|x-x₀| < 1/L = ${R.toFixed(2)} 保证收敛`, v.sx(-R + 0.06), v.sy(-2.8), { color: C.green, font: '13px serif' });
    }
    text(f, 'x', (v.sx(-3) + v.sx(3)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'y', v.sx(-2.92), v.sy(2.92), { color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      '皮卡-林德洛夫：f 连续 + 对 y 利普希茨 ⇒ 初值问题在邻域内解存在且唯一',
      '逐步逼近 φ_{n+1}(x) = y₀ + ∫f(t,φ_n(t))dt 构成一致收敛的压缩映射序列',
      '利普希茨不成立的经典反例：y\' = √y 过原点有无穷多解（唯一性失效）',
    ]);
    heading(f, '初值问题什么时候有且只有一个解');
  },
});
registerViz(picardUniqueness);

/** P535 Frobenius 幂级数解法。 */
const frobeniusSeries = defineViz({
  slug: 'frobenius-series',
  title: 'Frobenius 幂级数解法',
  params: { root: { type: 'select', options: ['两个实根差非整数', '重根', '差为整数'], default: '两个实根差非整数', label: '指标方程根型' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'root', '两个实根差非整数');
    clear(f);
    // 左：解的三步流程
    const bx = 56;
    const steps = [
      ['① 写成 x^r Σa_n x^n', C.cool],
      ['② 代入得指标方程 r(r-1)+p₀r+q₀=0', C.yellow],
      ['③ 递推定系数 a_n(r)', C.green],
    ] as Array<[string, string]>;
    steps.forEach(([s, color], i) => {
      const y = 92 + i * 66;
      poly(f, [[bx, y], [bx + 400, y], [bx + 400, y + 50], [bx, y + 50]],
        { fill: `${color}14`, stroke: `${color}bb`, lw: 1.8 });
      text(f, s, bx + 14, y + 32, { color, font: '15px serif' });
      if (i < 2) vec(f, bx + 200, y + 50, bx + 200, y + 62, C.dim, 1.6, 6);
    });
    // 右：两种根的解结构
    const cx = w * 0.66;
    if (kind === '两个实根差非整数') {
      text(f, 'r₁ ≠ r₂（差非整数）：', cx, 96, { color: C.fg, font: '16px serif' });
      text(f, 'y = a·y₁(x) + b·y₂(x)', cx, 132, { color: C.cool, font: '16px serif' });
      text(f, '两个独立级数解直接线性组合', cx, 166, { color: C.dim, font: '14px sans-serif' });
      text(f, '例：贝塞尔方程 J_ν 与 J_-ν（ν 非整数）', cx, 208, { color: C.yellow, font: '14px sans-serif' });
      // 画两条级数曲线
      const v = view(f, { xMin: 0, xMax: 4, yMin: -0.6, yMax: 1.4, inset: 40, insetBottom: 40 });
      grid(f, v);
      const c1: Array<[number, number]> = [], c2: Array<[number, number]> = [];
      for (let i = 0; i <= 100; i++) {
        const x = (i / 100) * 4;
        c1.push([v.sx(x), v.sy(1 - x * x / 6 + x * x * x * x / 120)]);
        c2.push([v.sx(x), v.sy(x - x * x * x / 18 + x * x * x * x * x / 480)]);
      }
      poly(f, c1, { stroke: C.cool, lw: 2.4 });
      poly(f, c2, { stroke: C.green, lw: 2.4 });
    } else if (kind === '重根') {
      text(f, 'r₁ = r₂（重根）：', cx, 96, { color: C.fg, font: '16px serif' });
      text(f, 'y₂ 出现 ln x 项', cx, 132, { color: C.hot, font: '16px serif' });
      text(f, 'y₂ = C·y₁·ln x + x^r Σb_n x^n', cx, 166, { color: C.dim, font: '14px sans-serif' });
      text(f, '例：欧拉方程 x²y″+xy′-y=0 的 x 与 ln x', cx, 208, { color: C.yellow, font: '14px sans-serif' });
      const v = view(f, { xMin: 0.2, xMax: 4, yMin: -1, yMax: 2.2, inset: 40, insetBottom: 40 });
      grid(f, v);
      const c1: Array<[number, number]> = [], c2: Array<[number, number]> = [];
      for (let i = 1; i <= 100; i++) {
        const x = 0.2 + (i / 100) * 3.8;
        c1.push([v.sx(x), v.sy(x * 0.5)]);
        c2.push([v.sx(x), v.sy(x * 0.5 * Math.log(x) * 1.6 + 0.4)]);
      }
      poly(f, c1, { stroke: C.cool, lw: 2.4 });
      poly(f, c2, { stroke: C.hot, lw: 2.4, dash: [7, 5] });
      text(f, '蓝：x　红虚：x·ln x', v.sx(0.3), v.sy(2.05), { color: C.fg, font: '13px serif' });
    } else {
      text(f, 'r₁ - r₂ = 正整数：', cx, 96, { color: C.fg, font: '16px serif' });
      text(f, '小根的级数可能被 log 污染', cx, 132, { color: C.warm, font: '16px serif' });
      text(f, '先做大根的级数；小根解需仔细处理共振项', cx, 166, { color: C.dim, font: '14px sans-serif' });
      text(f, '例：合流超几何、整数阶贝塞尔 J_n 与 Y_n', cx, 208, { color: C.yellow, font: '14px sans-serif' });
      text(f, '共振 = 大根解"吃掉"了小根的席位', cx, 260, { color: C.hot, font: '14px sans-serif' });
      text(f, '此时第二个独立解必须用极限过程造出来', cx, 292, { color: C.dim, font: '14px sans-serif' });
    }
    footnotes(f, [
      '正则奇点：x p(x) 与 x² q(x) 在 x=0 解析 —— Frobenius 法的适用前提',
      '指标方程 r(r-1)+p₀r+q₀=0 定主导行为：物理上决定可接受的解族',
      '所有特殊函数（勒让德/贝塞尔/合流超几何）都是二阶 ODE 的 Frobenius 解',
    ]);
    heading(f, '指标方程先定指数，级数随后跟上');
  },
});
registerViz(frobeniusSeries);

/** P536 施特姆-刘维尔本征值问题。 */
const sturmLouiville = defineViz({
  slug: 'sturm-liouville',
  title: '施特姆-刘维尔本征值问题',
  params: { mode: { type: 'select', options: ['弦振动模态', '正交展开'], default: '弦振动模态', label: '视图' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = str(params, 'mode', '弦振动模态');
    clear(f);
    if (mode === '弦振动模态') {
      // 固定端弦的本征模
      const x0 = 70, x1 = w - 70, y0 = h * 0.5;
      seg(f, x0, y0 - 150, x0, y0 + 150, C.dim, 3);
      seg(f, x1, y0 - 150, x1, y0 + 150, C.dim, 3);
      text(f, '固定端', x0 - 34, y0 - 160, { color: C.dim, font: '13px serif' });
      const modeN = 3;
      for (let n = 1; n <= modeN; n++) {
        const amp = 70 / n;
        const yOff = (n - 2) * 110;
        const pts: Array<[number, number]> = [];
        for (let i = 0; i <= 200; i++) {
          const s = i / 200;
          pts.push([x0 + s * (x1 - x0), y0 + yOff + Math.sin(n * Math.PI * s) * amp * Math.cos(f.t * 2 * n)]);
        }
        poly(f, pts, { stroke: n === 1 ? C.accent : n === 2 ? C.cool : C.green, lw: 2.4 });
        text(f, `n=${n}　λ_n = (nπ/L)²　y_n = sin(nπx/L)`, x0 + 12, y0 + yOff - amp - 14,
          { color: n === 1 ? C.accent : n === 2 ? C.cool : C.green, font: '13px serif' });
      }
      text(f, '边界条件选定本征值族：这是 SL 问题的本质', 70, h - 128, { color: C.yellow, font: '15px sans-serif' });
      text(f, '一般型：[p y\']\' + (q + λw)y = 0，权 w 决定正交内积', 70, h - 100, { color: C.fg, font: '14px serif' });
      text(f, '一般型：', 70, h - 100 + 0, { color: C.fg, font: '14px serif' });
      footnotes(f, [
        'SL 标准型：-(py\')\' + qy = λwy：p、q、w 实值且满足正则条件',
        '本征函数关于权 w 正交：∫y_m y_n w dx = 0（m≠n）—— 展开的数学根据',
        '斯特姆-刘维尔定理：实系数边值问题的本征值全为实、可排序、函数系完备',
      ]);
      heading(f, '边界条件一锁，谱就定了');
    } else {
      // 正交展开：方波逼近
      const v = view(f, { xMin: -3.2, xMax: 3.2, yMin: -1.6, yMax: 1.9, inset: 46, insetBottom: 46 });
      grid(f, v);
      // 方波
      const sq: Array<[number, number]> = [];
      for (let i = 0; i <= 400; i++) {
        const x = -3.2 + (i / 400) * 6.4;
        sq.push([v.sx(x), v.sy(Math.sign(Math.sin(x)) * 1)]);
      }
      poly(f, sq, { stroke: `${C.dim}aa`, lw: 2, dash: [7, 5] });
      // 部分和
      const partial = (x: number, N: number) => {
        let s = 0;
        for (let n = 1; n <= N; n += 2) s += Math.sin(n * x) / n;
        return (4 / Math.PI) * s;
      };
      const N = Math.round(1 + (Math.sin(f.t * 0.9) * 0.5 + 0.5) * 9);
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 400; i++) {
        const x = -3.2 + (i / 400) * 6.4;
        pts.push([v.sx(x), v.sy(Math.max(-1.6, Math.min(1.9, partial(x, N))))]);
      }
      poly(f, pts, { stroke: C.accent, lw: 2.6 });
      text(f, `前 ${N} 项部分和逼近方波`, v.sx(-3.1), v.sy(1.78), { color: C.accent, font: '14px serif' });
      text(f, '间断处的过冲不消失（吉布斯现象 ~9%）', v.sx(-3.1), v.sy(1.6), { color: C.hot, font: '13px serif' });
      text(f, '虚线 = 目标方波', v.sx(-3.1), v.sy(-1.5), { color: C.dim, font: '13px serif' });
      text(f, 'x', (v.sx(-3.2) + v.sx(3.2)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
      footnotes(f, [
        '任何满足条件的函数都能按本征函数展开 —— 傅里叶级数是 SL 理论的特例',
        '系数 c_n = ∫f y_n w / ∫y_n² w：正交性让每个系数独立可求',
        '量子力学的谱分解、振动的模态叠加、热传导的特征展开同一套理论',
      ]);
      heading(f, '正交函数系展开一切');
    }
  },
});
registerViz(sturmLouiville);

/** P537 勒让德多项式与球谐函数。 */
const legendreSphericalHarmonics = defineViz({
  slug: 'legendre-spherical-harmonics',
  title: '勒让德多项式与球谐函数',
  params: { view2: { type: 'select', options: ['P_n(x) 曲线', '球谐彩图 |Y_lm|²'], default: 'P_n(x) 曲线', label: '视图' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = str(params, 'view2', 'P_n(x) 曲线');
    clear(f);
    if (mode === 'P_n(x) 曲线') {
      const v = view(f, { xMin: -1, xMax: 1, yMin: -1.3, yMax: 1.4, inset: 46, insetBottom: 46 });
      grid(f, v);
      const legendre = (n: number, x: number): number => {
        if (n === 0) return 1;
        if (n === 1) return x;
        let pm1 = 1, pm = x;
        for (let k = 2; k <= n; k++) {
          const next = ((2 * k - 1) * x * pm - (k - 1) * pm1) / k;
          pm1 = pm;
          pm = next;
        }
        return pm;
      };
      const colors = [C.accent, C.cool, C.green, C.warm, C.pink, C.cyan];
      for (let n = 0; n <= 5; n++) {
        const pts: Array<[number, number]> = [];
        for (let i = 0; i <= 200; i++) {
          const x = -1 + (i / 200) * 2;
          pts.push([v.sx(x), v.sy(legendre(n, x))]);
        }
        poly(f, pts, { stroke: colors[n], lw: n === 3 ? 3 : 1.9 });
        const xe = 0.92;
        text(f, `P${n}`, v.sx(xe), v.sy(legendre(n, xe)) - 6, { color: colors[n], font: '12px serif' });
      }
      text(f, '递推：(k+1)P_{k+1} = (2k+1)xP_k - kP_{k-1}', v.sx(-0.98), v.sy(1.32), { color: C.fg, font: '14px serif' });
      text(f, 'P_n(1)=1、n 次多项式、n 个零点 —— 角度问题的完备基', v.sx(-0.98), v.sy(-1.2), { color: C.yellow, font: '13px serif' });
      text(f, 'x = cosθ', (v.sx(-1) + v.sx(1)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
      footnotes(f, [
        '勒让德方程 (1-x²)y″ - 2xy\' + n(n+1)y = 0 在 [-1,1] 正则',
        '生成函数 1/√(1-2xt+t²) = ΣtⁿP_n(x)：多极展开与球谐的桥',
        '连带勒让德 P_l^m 给出球谐 Y_lm(θ,φ) —— 角向波函数的通用答案',
      ]);
      heading(f, '角度问题的通用解');
    } else {
      // 球谐彩图（网格上计算 |Y_lm|²）
      const l = 2, m = 1;
      const cell = 26;
      const cols = 24, rows = 12;
      const ox = (w - cols * cell) / 2, oy = 76;
      const Ylm = (th: number, ph: number) => {
        // 简化归一：Y_21 ∝ sinθ cosθ e^{iφ}
        return Math.pow(Math.sin(th) * Math.cos(th), 2);
      };
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const ph = (c / cols) * Math.PI * 2;
          const th = ((r + 0.5) / rows) * Math.PI;
          const val = Ylm(th, ph);
          const { ctx } = f;
          ctx.fillStyle = `hsl(${210 + val * 120}, 70%, ${24 + val * 44}%)`;
          ctx.fillRect(ox + c * cell, oy + r * cell, cell - 1.5, cell - 1.5);
        }
      }
      text(f, `|Y_${l}${m}(θ,φ)|² 展开图（极角×方位角网格）`, ox, oy - 16, { color: C.fg, font: '14px serif' });
      text(f, '四个亮斑 = 角向概率的四极分布', ox, oy + rows * cell + 30, { color: C.yellow, font: '14px sans-serif' });
      text(f, 'Y_lm 完备正交：任意角度函数都能按它展开', ox, oy + rows * cell + 60, { color: C.cool, font: '14px sans-serif' });
      text(f, '轨道形状（s/p/d/f）就是 |Y_lm|² 的等值面', ox, oy + rows * cell + 90, { color: C.fg, font: '14px sans-serif' });
      footnotes(f, [
        'Y_lm(θ,φ) = N P_l^m(cosθ) e^{imφ}：分离变量在球坐标的标准产物',
        '正交性 ∫Y*_lm Y_l\'m\' dΩ = δ：量子数 (l,m) 的数学身份证',
        '宇宙学 CMB 功率谱 C_l 就是温度场按球谐展开的系数统计',
      ]);
      heading(f, '球面上的傅里叶基');
    }
  },
});
registerViz(legendreSphericalHarmonics);

/** P538 贝塞尔函数与圆柱问题。 */
const besselCylindrical = defineViz({
  slug: 'bessel-cylindrical',
  title: '贝塞尔函数与圆柱问题',
  params: { nu: { type: 'range', min: 0, max: 5, default: 0, step: 1, label: '阶数 ν (整数)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const nu = Math.round(num(params, 'nu', 0));
    clear(f);
    // 左：J_ν 曲线
    const v = view(f, { xMin: 0, xMax: 14, yMin: -0.5, yMax: 1.1, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 数值近似 J_ν(x)（级数+渐近混合，示意）
    const J = (n: number, x: number): number => {
      if (x < 0.001) return n === 0 ? 1 : 0;
      let s = 0;
      for (let k = 0; k < 12; k++) {
        let fact = 1;
        for (let j = 2; j <= k; j++) fact *= j;
        let gfact = 1;
        for (let j = 2; j <= k + n; j++) gfact *= j;
        const term = Math.pow(-1, k) / fact / gfact * Math.pow(x / 2, 2 * k + n);
        s += term;
      }
      if (x > 10) {
        const asy = Math.sqrt(2 / (Math.PI * x)) * Math.cos(x - (n / 2 + 0.25) * Math.PI);
        s = 0.4 * s + 0.6 * asy;
      }
      return s;
    };
    const pts: Array<[number, number]> = [];
    for (let i = 1; i <= 400; i++) {
      const x = (i / 400) * 14;
      pts.push([v.sx(x), v.sy(J(nu, x))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.8 });
    // 零点示意（第一零点表）
    const zeros: Record<number, number> = { 0: 2.405, 1: 3.832, 2: 5.136, 3: 6.380, 4: 7.588, 5: 8.771 };
    const z1 = zeros[nu] ?? 8;
    seg(f, v.sx(z1), v.sy(0), v.sx(z1), v.sy(1.0), `${C.hot}aa`, 1.8);
    text(f, `第一零点 j_{${nu},1} = ${z1.toFixed(3)}`, v.sx(z1) + 8, v.sy(0.92), { color: C.hot, font: '13px serif' });
    text(f, `J_${nu}(x)`, v.sx(0.4), v.sy(1.05), { color: C.accent, font: '15px serif' });
    text(f, 'x', (v.sx(0) + v.sx(14)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    // 右：鼓面模态
    const cx = w * 0.76, cy = h * 0.4;
    circle(f, cx, cy, 110, { stroke: C.grid, lw: 2 });
    // 画节线圆（零点位置）
    const scale = 110 / (z1 + 3);
    if (nu > 0) {
      for (let k = 0; k < Math.min(nu, 3); k++) {
        const a = (k / Math.max(1, nu)) * Math.PI * 2;
        seg(f, cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, cx + Math.cos(a) * 108, cy + Math.sin(a) * 108, `${C.warm}bb`, 2);
      }
      text(f, `${nu} 条径向节线`, cx, cy + 136, { align: 'center', color: C.warm, font: '13px serif' });
    }
    const pulse = Math.sin(f.t * 3) * 0.5 + 0.5;
    circle(f, cx, cy, 70 * (0.7 + pulse * 0.3), { stroke: `rgba(66,153,225,${0.4 + pulse * 0.5})`, lw: 2.4 });
    circle(f, cx, cy, 36 * (1 - pulse * 0.3), { stroke: `rgba(72,187,120,${0.4 + pulse * 0.5})`, lw: 2 });
    text(f, '鼓面振动：节圆落在 J_n 零点处', cx, cy - 130, { align: 'center', color: C.fg, font: '13px serif' });
    footnotes(f, [
      '圆柱坐标分离变量的径向方程：x²y″ + xy\' + (x²-ν²)y = 0',
      'J_ν 有界、Y_ν 对数发散：物理选 J；半整数 ν 给出球贝塞尔函数',
      '零点就是频率表：鼓、光纤 HE₁₁ 模、圆波导 TM₀₁ 全靠 j_{ν,n} 定频',
    ]);
    heading(f, '圆对称一出现，贝塞尔就登场');
  },
});
registerViz(besselCylindrical);

/** P539 拉盖尔多项式与氢原子径向方程。 */
const laguerreHydrogenRadial = defineViz({
  slug: 'laguerre-hydrogen-radial',
  title: '拉盖尔多项式与氢原子径向方程',
  params: { n: { type: 'range', min: 1, max: 6, default: 3, step: 1, label: '主量子数 n' } },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'n', 3));
    const l = Math.min(n - 1, 1);
    clear(f);
    // 左：径向方程推导链
    const bx = 56;
    const lines = [
      ['-(ℏ²/2m)R″ + [-e²/ε₀r + ℏ²l(l+1)/2mr²]R = ER', C.fg],
      ['代入 ρ = 2r/(na₀)，设 R = e^{-ρ/2} ρ^l L(ρ)', C.cool],
      [`得连合拉盖尔方程 ⇒ L = L_{${n - l - 1}}^{${2 * l + 1}}(ρ)`, C.yellow],
      ['量子化：n - l - 1 ≥ 0 ⇒ l ≤ n-1（能级只依赖 n）', C.hot],
    ] as Array<[string, string]>;
    lines.forEach(([s, color], i) => text(f, s, bx, 96 + i * 46, { color, font: '14px serif' }));
    // 右：径向波函数
    const v = view(f, { xMin: 0, xMax: 30, yMin: -0.4, yMax: 1.1, inset: w * 0.52, insetRight: 46, insetBottom: 46 });
    grid(f, v);
    // R_nl 示意（节点数 = n-l-1）
    const nodes = n - l - 1;
    const Rnl = (x: number) => {
      const rho = x / n * 2;
      let polyv = 1;
      // 广义拉盖尔多项式（级数前几项，示意）
      let term = 1;
      for (let k = 1; k <= nodes; k++) {
        term *= -rho / k;
        polyv += term * (function () { let c = 1; for (let j = 1; j <= k; j++) c = c * (2 * l + 1 + k - j + 1) / (k - j + 1) / 1; return c; })() * 0.14;
      }
      const val = Math.exp(-rho / 2) * Math.pow(rho, l) * polyv;
      return val;
    };
    const pts: Array<[number, number]> = [];
    let peak = 0.001;
    const raw: number[] = [];
    for (let i = 1; i <= 300; i++) {
      const x = (i / 300) * 30;
      const val = Math.abs(Rnl(x));
      raw.push(val);
      if (val > peak) peak = val;
    }
    for (let i = 0; i < 300; i++) {
      const x = ((i + 1) / 300) * 30;
      pts.push([v.sx(x), v.sy(raw[i] / peak * 0.95)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.8 });
    text(f, `R_${n}${l}(r)（绝对值，峰归一）`, v.sx(0.5), v.sy(1.05), { color: C.accent, font: '14px serif' });
    text(f, `径向节点数 = n-l-1 = ${nodes}（波函数穿零 ${nodes} 次）`, v.sx(0.5), v.sy(0.94), { color: C.yellow, font: '13px serif' });
    text(f, 'r (a₀ 单位)', (v.sx(0) + v.sx(30)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    // 能级
    text(f, `E_n = -13.6/n² = ${(-13.6 / (n * n)).toFixed(3)} eV（l 简并！）`, w * 0.52, h - 108, { color: C.hot, font: '15px serif' });
    text(f, '库仑势的隐藏对称性使能量与 l 无关 — SO(4) 对称的回声', w * 0.52, h - 78, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '连合拉盖尔多项式 L_k^α(x)：α=2l+1、k=n-l-1 —— Frobenius 法的完整产物',
      '径向节点随 n 增多：高激发态电子"钻进"核区的概率增大（穿透效应）',
      '多电子原子中 l 简并被打破：能级分裂来自屏蔽与钻穿的差异',
    ]);
    heading(f, '连合拉盖尔解出的自然量子数');
  },
});
registerViz(laguerreHydrogenRadial);

/** P540 超几何函数与合流型。 */
const hypergeometricFunction = defineViz({
  slug: 'hypergeometric-function',
  title: '超几何函数与合流型',
  params: { param: { type: 'range', min: -2, max: 2, default: 1, step: 0.25, label: '参数 a' } },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'param', 1);
    clear(f);
    const v = view(f, { xMin: -2, xMax: 2, yMin: -1.5, yMax: 3.4, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 2F1(a,b;c;x) 截断级数（b=1,c=1 示意）
    const F = (x: number) => {
      let s = 0, term = 1;
      for (let k = 0; k < 14; k++) {
        if (k > 0) term *= (a + k - 1) / k * x;
        s += term;
        if (Math.abs(term) < 1e-9) break;
      }
      return s;
    };
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 300; i++) {
      const x = -2 + (i / 300) * 4;
      const val = F(x);
      if (Math.abs(val) > 6) continue;
      pts.push([v.sx(x), v.sy(val)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.8 });
    // 特例标注
    seg(f, v.sx(1), v.sy(-1.5), v.sx(1), v.sy(3.4), `${C.hot}88`, 1.6);
    text(f, 'x=1 收敛边界（c-a-b>0 时有限）', v.sx(1.06), v.sy(3.2), { color: C.hot, font: '13px serif' });
    text(f, `₂F₁(a=${a.toFixed(2)},1;1;x)：b=c 时退化为 (1-x)^{-a}`, v.sx(-1.94), v.sy(3.25), { color: C.fg, font: '14px serif' });
    // 特例谱系图
    const bx = 56, by = h - 176;
    text(f, '特例谱系（参数取值一变就是老朋友）：', bx, by, { color: C.yellow, font: '15px sans-serif' });
    const fam = [
      ['b=c=1/2 → 第一类椭圆积分 K(x)', C.cool],
      ['a=1,b=c → 对数级数', C.green],
      ['合流极限 c→∞ → ᵱF₁（拉盖尔/合流超几何）', C.warm],
      ['ν 半整数 → 球函数/库仑波', C.pink],
    ];
    fam.forEach(([s, color], i) => text(f, '· ' + s, bx, by + 30 + i * 30, { color, font: '14px sans-serif' }));
    text(f, 'x', (v.sx(-2) + v.sx(2)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      '定义：₂F₁(a,b;c;x) = Σ (a)_n(b)_n/(c)_n · xⁿ/n!，Pochhammer 符号记系数',
      '一个方程（超几何方程）两个解：任何二阶正则奇点 ODE 都能化归它',
      '物理谱系：氢原子、谐振子、椭圆摆、库仑散射都是它的具体取值',
    ]);
    heading(f, '一个母函数生出一族特殊函数');
  },
});
registerViz(hypergeometricFunction);

/** P541 相平面与稳定性分析。 */
const phasePlaneStability = defineViz({
  slug: 'phase-plane-stability',
  title: '相平面与稳定性分析',
  params: { type: { type: 'select', options: ['鞍点', '稳定节点', '焦点', '中心'], default: '焦点', label: '不动点类型' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'type', '焦点');
    clear(f);
    const v = view(f, { xMin: -3, xMax: 3, yMin: -3, yMax: 3, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 向量场 + 轨线
    const field = (x: number, y: number): [number, number] => {
      switch (kind) {
        case '鞍点': return [x, -y * 1.2];
        case '稳定节点': return [-x * 1.1 - y * 0.2, x * 0.3 - y * 1.3];
        case '焦点': return [x * 0.15 - y * 1.4, x * 1.4 + y * 0.15];
        default: return [-y * 1.3, x * 1.3];
      }
    };
    // 轨线（欧拉积分）
    const starts: Array<[number, number]> = [[2.4, 0], [-2.4, 0], [0, 2.4], [0, -2.4], [1.7, 1.7], [-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7]];
    const colors = [C.cool, C.cool, C.green, C.green, C.warm, C.warm, C.pink, C.pink];
    starts.forEach(([sx0, sy0], idx) => {
      let x = sx0, y = sy0;
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < 240; i++) {
        pts.push([v.sx(x), v.sy(y)]);
        const [dx, dy] = field(x, y);
        const dt = 0.02;
        x += dx * dt;
        y += dy * dt;
        if (Math.abs(x) > 4 || Math.abs(y) > 4) break;
      }
      poly(f, pts, { stroke: colors[idx], lw: 1.8 });
    });
    // 向量场箭头（稀疏）
    for (let gx = -2.5; gx <= 2.5; gx += 1) {
      for (let gy = -2.5; gy <= 2.5; gy += 1) {
        const [dx, dy] = field(gx, gy);
        const len = Math.hypot(dx, dy) || 1;
        vec(f, v.sx(gx), v.sy(gy), v.sx(gx + dx * 0.12 / len * 1.4), v.sy(gy + dy * 0.12 / len * 1.4), `${C.grid}dd`, 1.2, 5);
      }
    }
    dot(f, v.sx(0), v.sy(0), 7, C.hot);
    const eig: Record<string, string> = {
      '鞍点': 'λ₁>0>λ₂（一正一负）→ 不稳定，双向逃逸',
      '稳定节点': 'λ 均为负实部同号 → 全轨汇入',
      '焦点': '共轭复根 Re<0 → 螺旋汇入',
      '中心': '纯虚根 → 闭合轨道（线性判稳失效，看非线性项）',
    };
    text(f, `${kind}：${eig[kind]}`, v.sx(-2.9), v.sy(2.8), { color: C.yellow, font: '15px serif' });
    text(f, '判据：雅可比矩阵 J 的特征值（trace–determinant 平面分型）', v.sx(-2.9), v.sy(2.5), { color: C.fg, font: '14px serif' });
    text(f, 'x', (v.sx(-3) + v.sx(3)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'y (相平面)', v.sx(-2.9), v.sy(2.95), { color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      '不动点 f(x*)=0 + 雅可比特征值 ⇒ 局部相图：不动微分方程先判稳定',
      '中心的微妙：纯虚根线性判稳"不确定"，需李雅普诺夫函数或正规形',
      '结构稳定性：鞍点与节点抗扰动，中心在阻尼下立刻塌成焦点',
    ]);
    heading(f, '不动方程就判出四种命运');
  },
});
registerViz(phasePlaneStability);

/** P542 极限环与分岔。 */
const limitCycleBifurcation = defineViz({
  slug: 'limit-cycle-bifurcation',
  title: '极限环与分岔',
  params: { mu: { type: 'range', min: -1, max: 1, default: 0.5, step: 0.1, label: '分岔参数 μ' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mu = num(params, 'mu', 0.5);
    clear(f);
    // 左：相平面（范德波尔）
    const v = view(f, { xMin: -3, xMax: 3, yMin: -3, yMax: 3, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 范德波尔：x'' = μ(1-x²)x' - x
    let x = 2.2, y = 0;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < 500; i++) {
      pts.push([v.sx(x), v.sy(y)]);
      const dx = y;
      const dy = mu * (1 - x * x) * y - x;
      const dt = 0.02;
      x += dx * dt;
      y += dy * dt;
      if (Math.abs(x) > 5) break;
    }
    poly(f, pts, { stroke: mu > 0 ? C.warm : C.cool, lw: 2.2 });
    // 稳定极限环（μ>0）叠加
    if (mu > 0.05) {
      const ring: Array<[number, number]> = [];
      for (let i = 0; i <= 160; i++) {
        const th = (i / 160) * Math.PI * 2;
        const r = 2 - 0.16 * Math.cos(th * 2);
        ring.push([v.sx(Math.cos(th) * r * 1.05), v.sy(Math.sin(th) * r * 1.05)]);
      }
      poly(f, ring, { stroke: C.hot, lw: 2.4, dash: [8, 6] });
      text(f, '稳定极限环（自持振荡）', v.sx(-2.9), v.sy(2.8), { color: C.hot, font: '14px serif' });
    } else {
      text(f, 'μ ≤ 0：原点稳定焦点，无环 — 振荡衰亡', v.sx(-2.9), v.sy(2.8), { color: C.cool, font: '14px serif' });
    }
    dot(f, v.sx(0), v.sy(0), 6, C.yellow);
    text(f, 'x', (v.sx(-3) + v.sx(3)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'y = x\'', v.sx(-2.9), v.sy(2.95), { color: C.dim, font: '12px sans-serif' });
    // 右：霍普夫分岔图
    const gx0 = w * 0.62, gy0 = h * 0.62, gx1 = w - 50, gy1 = h * 0.18;
    seg(f, gx0, gy0, gx1, gy0, C.grid, 1.4);
    seg(f, (gx0 + gx1) / 2, gy0, (gx0 + gx1) / 2, gy1, C.grid, 1.4);
    text(f, 'μ', gx1 - 6, gy0 + 22, { align: 'right', color: C.dim, font: '13px serif' });
    text(f, '振幅', (gx0 + gx1) / 2 + 14, gy1 - 6, { color: C.dim, font: '13px serif' });
    // 分岔曲线：μ>0 振幅 ~ √μ
    const br: Array<[number, number]> = [];
    for (let i = 0; i <= 80; i++) {
      const m = (i / 80) * 1;
      if (m <= 0) continue;
      br.push([gx0 + m * (gx1 - gx0), gy0 - Math.sqrt(m) * (gy0 - gy1) * 0.92]);
    }
    poly(f, br, { stroke: C.hot, lw: 2.8 });
    seg(f, gx0, gy0, (gx0 + gx1) / 2, gy0, C.cool, 2.4);
    dot(f, (gx0 + gx1) / 2, gy0, 7, C.yellow);
    text(f, '超临界霍普夫分岔点', (gx0 + gx1) / 2 - 60, gy0 + 40, { color: C.yellow, font: '13px serif' });
    // 当前 μ
    const cx2 = gx0 + Math.max(0, (mu + 1) / 2) * (gx1 - gx0);
    dot(f, cx2, gy0 - (mu > 0 ? Math.sqrt(mu) * (gy0 - gy1) * 0.92 : 0), 6, C.green);
    text(f, `当前 μ=${mu.toFixed(1)}`, gx0, gy1 - 24, { color: C.green, font: '14px serif' });
    footnotes(f, [
      '极限环=相平面上孤立的闭轨：非线性系统独有的自持振荡（线性系统只有中心族）',
      '范德波尔方程：电子管振荡器的数学模型 —— 非线性阻尼在小振幅供能、大振幅耗能',
      '霍普夫分岔：焦点失稳"长出"环 —— 心脏起搏、化学振荡（BZ 反应）、飞机颤振的共同机制',
    ]);
    heading(f, '非线性把衰减振荡扭成永动节拍');
  },
});
registerViz(limitCycleBifurcation);

/** P543 微分方程的对称性与诺特。 */
const symmetryLieGroup = defineViz({
  slug: 'symmetry-lie-group',
  title: '微分方程的对称性与诺特',
  params: { symmetry: { type: 'select', options: ['时间平移', '空间平移', '旋转'], default: '时间平移', label: '对称性' } },
  draw: (f) => {
    const { w, h, params } = f;
    const sym = str(params, 'symmetry', '时间平移');
    clear(f);
    // 左：对称变换演示（轨迹平移/旋转后仍解）
    const v = view(f, { xMin: -3, xMax: 3, yMin: -2.4, yMax: 2.4, inset: 46, insetBottom: 46 });
    grid(f, v);
    const base: Array<[number, number]> = [];
    for (let i = 0; i <= 200; i++) {
      const t = -3 + (i / 200) * 6;
      if (sym === '旋转') base.push([Math.cos(t * 1.4) * 1.8, Math.sin(t * 1.4) * 1.5]);
      else base.push([t, Math.sin(t * 1.6) * 1.3 * Math.exp(-Math.abs(t) * 0.12)]);
    }
    poly(f, base, { stroke: C.accent, lw: 2.8 });
    // 变换后的像（虚线）
    const shift = Math.sin(f.t * 1.2) * 0.9;
    const img: Array<[number, number]> = [];
    for (const [bx0, by0] of base) {
      if (sym === '时间平移') img.push([bx0 + shift, by0]);
      else if (sym === '空间平移') img.push([bx0, by0]);
      else {
        const c = Math.cos(shift), s = Math.sin(shift);
        img.push([bx0 * c - by0 * s, bx0 * s + by0 * c]);
      }
    }
    poly(f, img, { stroke: C.hot, lw: 2.2, dash: [8, 6] });
    text(f, '蓝 = 原解　红虚 = 变换后的像（仍是解）', v.sx(-2.9), v.sy(2.2), { color: C.fg, font: '14px serif' });
    text(f, sym === '时间平移' ? 't → t+ε：拉氏量不显含 t' : sym === '空间平移' ? 'x → x+ε：拉氏量不显含 x' : '绕原点转 ε：拉氏量只依赖 r',
      v.sx(-2.9), v.sy(1.95), { color: C.hot, font: '14px serif' });
    // 右：对称 ↔ 守恒律对照表
    const bx = w * 0.56;
    text(f, '诺特定理（1918）：每种连续对称 ⇒ 一个守恒律', bx, 84, { color: C.yellow, font: '16px serif' });
    const table = [
      ['时间平移', '能量 E 守恒', C.hot],
      ['空间平移', '动量 p 守恒', C.cool],
      ['旋转', '角动量 L 守恒', C.green],
      ['规范相位', '电荷守恒', C.pink],
      ['重标度', '共形守恒流', C.warm],
    ] as Array<[string, string, string]>;
    table.forEach(([s1, s2, color], i) => {
      const y = 130 + i * 62;
      poly(f, [[bx, y], [bx + 330, y], [bx + 330, y + 48], [bx, y + 48]],
        { fill: `${color}14`, stroke: `${color}bb`, lw: 1.6 });
      text(f, s1, bx + 14, y + 30, { color, font: '15px sans-serif' });
      vec(f, bx + 130, y + 24, bx + 190, y + 24, C.dim, 1.8, 7);
      text(f, s2, bx + 206, y + 30, { color: C.fg, font: '15px sans-serif' });
    });
    text(f, '李群方法：无穷小生成元 ξ∂ 代入方程 → 直接给出对称与守恒流', bx, 130 + 5 * 62 + 14, { color: C.fg, font: '14px sans-serif' });
    footnotes(f, [
      '诺特把"守恒"从巧合升格为必然：对称性是比守恒律更基本的组织原则',
      '李第一定理：单参数对称群生成守恒量的显式公式（可操作的诺特）',
      '广义相对论没有全局对称 ⇒ 能量守恒要换成赝张量/ADM 质量（微妙的前沿）',
    ]);
    heading(f, '对称性=守恒律的生成器');
  },
});
registerViz(symmetryLieGroup);

/** P544 分离变量法（直角坐标）。 */
const separationCartesian = defineViz({
  slug: 'separation-cartesian',
  title: '分离变量法（直角坐标）',
  params: { pde: { type: 'select', options: ['热传导', '波动', '拉普拉斯'], default: '热传导', label: '方程' } },
  draw: (f) => {
    const { w, h, params } = f;
    const pde = str(params, 'pde', '热传导');
    clear(f);
    // 左：分离步骤流程
    const bx = 56;
    const flows: Record<string, string[][]> = {
      '热传导': [['u = X(x)T(t)', C.cool], ['X\'\'/X = T\'/(αT) = -λ（常数）', C.yellow], ['T\' = -αλT ⇒ 指数衰减', C.green], ['X\'\' + λX = 0 ⇒ sin/cos', C.accent]],
      '波动': [['u = X(x)T(t)', C.cool], ['X\'\'/X = T\'\'/T = -ω²', C.yellow], ['T：cos(ωt) 振荡', C.green], ['X：驻波 sin(nπx/L)', C.accent]],
      '拉普拉斯': [['u = X(x)Y(y)', C.cool], ['X\'\'/X = -Y\'\'/Y = k²', C.yellow], ['X：周期或双曲', C.green], ['Y：e^{±ky} 指数', C.accent]],
    };
    (flows[pde] ?? flows['热传导']).forEach(([s, color], i) => {
      const y = 92 + i * 66;
      poly(f, [[bx, y], [bx + 400, y], [bx + 400, y + 50], [bx, y + 50]],
        { fill: `${color}14`, stroke: `${color}bb`, lw: 1.8 });
      text(f, s, bx + 14, y + 32, { color, font: '15px serif' });
      if (i < 3) vec(f, bx + 200, y + 50, bx + 200, y + 62, C.dim, 1.6, 6);
    });
    text(f, '关键一步：偏导=常数 ⇒ 两个常微分方程', bx, 92 + 4 * 66 + 16, { color: C.yellow, font: '15px sans-serif' });
    // 右：本征函数叠加
    const v = view(f, { xMin: 0, xMax: 1, yMin: -0.6, yMax: 1.6, inset: w * 0.55, insetRight: 46, insetBottom: 46 });
    grid(f, v);
    const t = (f.t * 0.4) % 1;
    const series = (x: number) => {
      let s = 0;
      for (let n = 1; n <= 7; n += 2) {
        s += Math.sin(n * Math.PI * x) * Math.exp(-n * n * t * 1.6) / n;
      }
      return s * 1.1;
    };
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 200; i++) {
      const x = i / 200;
      pts.push([v.sx(x), v.sy(series(x))]);
    }
    poly(f, pts, { stroke: C.hot, lw: 2.8 });
    text(f, 'u(x,t) = Σ b_n sin(nπx/L)·e^{-α(nπ/L)²t}', v.sx(0.03), v.sy(1.5), { color: C.fg, font: '14px serif' });
    text(f, '高次模指数衰减更快 → 温度分布越来越平滑', v.sx(0.03), v.sy(1.32), { color: C.yellow, font: '13px serif' });
    text(f, 'x/L', (v.sx(0) + v.sx(1)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      '适用三件套：直角/柱/球坐标 + 线性方程 + 齐次边界（非齐次先处理边界）',
      '本征值链：每个方向的 ODE 带边界条件 ⇒ 分立谱 λ_n ⇒ 级数解',
      '叠加原理收拾初值：傅里叶系数把初始分布分配给各模态',
    ]);
    heading(f, '一步拆开，两步级数');
  },
});
registerViz(separationCartesian);

/** P545 球坐标分离与角动量。 */
const separationSpherical = defineViz({
  slug: 'separation-spherical',
  title: '球坐标分离与角动量',
  params: { l: { type: 'range', min: 0, max: 3, default: 1, step: 1, label: '角量子数 l' } },
  draw: (f) => {
    const { w, h, params } = f;
    const l = Math.round(num(params, 'l', 1));
    clear(f);
    // 左：拉氏方程分离链
    const bx = 56;
    const lines = [
      ['∇²Ψ = 0 或 [∇² + k²]Ψ = 0', C.fg],
      ['Ψ = R(r)·Θ(θ)·Φ(φ)', C.cool],
      ['Φ 方程：Φ\'\' + m²Φ = 0 ⇒ e^{imφ}（周期条件！）', C.green],
      ['Θ 方程 ⇒ 连带勒让德 P_l^m(cosθ)', C.yellow],
      ['R 方程 ⇒ 球贝塞尔 j_l / 球诺伊曼 y_l', C.hot],
    ] as Array<[string, string]>;
    lines.forEach(([s, color], i) => text(f, s, bx, 96 + i * 46, { color, font: '14px serif' }));
    text(f, '周期边界条件只允许整数 m —— 量子化的第一个脚印', bx, 96 + 5 * 46 + 20, { color: C.yellow, font: '15px sans-serif' });
    // 右：角动量代数
    const rx = w * 0.54;
    text(f, '角向方程 = 角动量算符本征问题：', rx, 96, { color: C.fg, font: '16px serif' });
    const rows = [
      ['L² Y_lm = ℏ²l(l+1) Y_lm', C.accent],
      ['L_z Y_lm = ℏm Y_lm', C.cool],
      ['m = -l, …, +l（2l+1 个值）', C.green],
      ['L± Y_lm ∝ Y_{l,m±1}', C.warm],
    ] as Array<[string, string]>;
    rows.forEach(([s, color], i) => text(f, s, rx, 148 + i * 50, { color, font: '16px serif' }));
    // l 的多重态图
    const my = h * 0.66;
    for (let k = 0; k <= l; k++) {
      const yy = my - k * 44;
      seg(f, rx, yy, rx + 240, yy, k === 0 ? C.cool : C.accent, 2.4);
      text(f, `l=${k}: ${2 * k + 1} 重态 (m=${-k}…${k})`, rx + 252, yy + 5, { color: C.dim, font: '13px serif' });
    }
    text(f, `当前 l=${l}：总角动量 ℏ√(${l}·${l + 1}) = ℏ·${Math.sqrt(l * (l + 1)).toFixed(2)}`, rx, my + 34, { color: C.yellow, font: '15px serif' });
    footnotes(f, [
      '球坐标把拉氏算符拆成径向+角向：角向方程与 r 无关 —— 处处适用',
      'l、m 从边界条件自然掉出：不是人为添加而是几何的必然',
      's/p/d/f 命名来自谱线锐线系（sharp/principal/diffuse/fundamental）的历史',
    ]);
    heading(f, '角动量量子化是几何的产物');
  },
});
registerViz(separationSpherical);