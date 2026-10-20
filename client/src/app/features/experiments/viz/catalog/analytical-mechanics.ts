import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** 拉格朗日方程。 */
const lagrangeEquation = defineViz({
  slug: 'lagrange-equation', title: '拉格朗日方程', animated: true,
  params: {
    demo: { type: 'select', options: ['单摆', '弹簧振子'], default: '单摆', label: '体系' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const pendulum = String((params as Record<string, unknown>)['demo'] ?? '').includes('单摆');
    clear(f);
    // 体系动画
    const cx = w * 0.26, py = h * 0.3;
    const L = 120;
    if (pendulum) {
      const th = 0.9 * Math.sin(f.t * 2.1);
      const bx = cx + Math.sin(th) * L, by = py + Math.cos(th) * L;
      seg(f, cx, py, bx, by, C.cool, 2.4);
      dot(f, bx, by, 13, C.warm);
      text(f, 'q = θ（广义坐标）', cx - 56, py - 18, { color: C.cool, font: '12px sans-serif' });
      text(f, `L = T − V = ½mL²θ̇² − mgL(1−cosθ)`, cx - 130, py + L + 44, { color: C.cyan, font: '13px sans-serif' });
    } else {
      const x = 44 * Math.sin(f.t * 2.4);
      seg(f, cx, py, cx, py + 60, C.dim, 2);
      // 弹簧（锯齿）
      const spring: [number, number][] = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        spring.push([cx + (i % 2 ? 14 : -14) * (1 - Math.abs(t - 0.5) * 0.4) + x * t, py + 60 + t * 70]);
      }
      poly(f, spring, { stroke: C.cool, lw: 2 });
      dot(f, cx + x, py + 140, 13, C.warm);
      text(f, 'q = x', cx - 26, py + 176, { color: C.cool, font: '12px sans-serif' });
      text(f, 'L = ½mẋ² − ½kx²', cx - 76, py + 200, { color: C.cyan, font: '13px sans-serif' });
    }
    // 方程（大写）
    text(f, 'd/dt(∂L/∂q̇) − ∂L/∂q = 0', w * 0.5, 60, { color: C.warm, font: '22px serif' });
    text(f, '对每个广义坐标写一条——自动消去所有约束力', w * 0.5 - 160, 92, { color: C.cyan, font: '13px sans-serif' });
    // 能量条
    const E0 = h - 54;
    seg(f, w * 0.52, E0, w * 0.52 + 200, E0, `${C.green}aa`, 8);
    text(f, '机械能守恒（L 的时间平移对称性 → 能量）', w * 0.52, E0 - 16, { color: C.green, font: '12px sans-serif' });

    footnotes(f, [
      '拉格朗日力学把牛顿的矢量力改写为标量 L=T−V——复杂约束体系的高效语言',
      '从摆到行星、从电路到场论：分析力学是理论物理的公共语法',
      '诺特定理反过来读：每种对称性对应一条守恒律——物理最美的一一对应',
    ]);
    heading(f, '拉格朗日方程：用能量写运动');
  },
});
registerViz(lagrangeEquation);

/** 哈密顿力学。 */
const hamiltonianMechanics = defineViz({
  slug: 'hamiltonian-mechanics', title: '哈密顿力学', animated: true,
  params: {
    demo: { type: 'select', options: ['相空间轨迹', '能量面'], default: '相空间轨迹', label: '视角' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    const S = Math.min(w, h) * 0.32;
    // 相空间轴
    seg(f, cx - S * 1.3, cy, cx + S * 1.3, cy, C.grid, 1.4);
    seg(f, cx, cy - S * 1.3, cx, cy + S * 1.3, C.grid, 1.4);
    text(f, 'q（坐标）', cx + S * 1.3 - 60, cy - 10, { color: C.dim, font: '12px sans-serif' });
    text(f, 'p（动量）', cx + 10, cy - S * 1.3 + 6, { color: C.dim, font: '12px sans-serif' });
    if (String((params as Record<string, unknown>)['demo'] ?? '').includes('相空间')) {
      // 谐振子椭圆轨道（多条能量）
      for (let lvl = 1; lvl <= 4; lvl++) {
        const a = S * 0.32 * lvl;
        const pts: [number, number][] = [];
        for (let t = 0; t <= Math.PI * 2 + 0.1; t += 0.06) pts.push([cx + a * Math.cos(t), cy + a * Math.sin(t)]);
        poly(f, [...pts, pts[0]], { stroke: `${C.cool}${70 + lvl * 40}`, lw: 1.6 });
        const an = f.t * 1.4;
        if (lvl === 3) dot(f, cx + a * Math.cos(an), cy + a * Math.sin(an), 7, C.warm);
      }
      text(f, '谐振子的相轨是闭合椭圆：H=p²/2m+½mω²q²=常数', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    } else {
      // 能量面（等高线）
      for (let lvl = 1; lvl <= 5; lvl++) {
        const r = (lvl / 5) * S;
        const pts: [number, number][] = [];
        for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.08) {
          pts.push([cx + r * Math.cos(a) * 1.2, cy + r * Math.sin(a) * 0.9]);
        }
        poly(f, [...pts, pts[0]], { stroke: `${C.warm}${40 + lvl * 30}`, lw: 1.8 });
      }
      dot(f, cx, cy, 5, C.green);
      text(f, 'H 的等值线：动力学沿等能量面流动——哈密顿流保体积（刘维尔定理）', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    }
    text(f, 'q̇ = ∂H/∂p　ṗ = −∂H/∂q', cx - 96, h - 34, { color: C.warm, font: '15px serif' });

    footnotes(f, [
      '哈密顿形式以 (q,p) 对偶变量重写力学——相空间流像不可压缩流体（刘维尔定理）',
      '从统计力学的系综到量子力学的正则量子化，H 是全理论的桥',
      '辛几何是哈密顿力学的现代外衣——数值积分器（蛙跳）必须保辛结构',
    ]);
    heading(f, '哈密顿力学：相空间中的流动');
  },
});
registerViz(hamiltonianMechanics);

/** 最小作用量原理。 */
const leastAction = defineViz({
  slug: 'least-action', title: '最小作用量原理', animated: true,
  params: {
    kind: { type: 'select', options: ['自由下落', '镜面反射'], default: '自由下落', label: '体系' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const reflect = String((params as Record<string, unknown>)['kind'] ?? '').includes('反射');
    clear(f);
    if (reflect) {
      // 费马原理：光程最短
      const y0 = h * 0.7, xA = w * 0.16, yA = h * 0.24, xB = w * 0.84, yB = h * 0.3;
      seg(f, 40, y0, w - 40, y0, C.dim, 3);
      const xHit = (xA * yB + xB * y0 - xB * y0 - 0) / 1; // 见下：直接用解析
      const xStar = xA + (xB - xA) * ((y0 - yA) / ((y0 - yA) + (y0 - yB)));
      void xHit;
      // 真实路径（驻相）
      seg(f, xA, yA, xStar, y0, C.hot, 2.8);
      seg(f, xStar, y0, xB, yB, C.hot, 2.8);
      dot(f, xA, yA, 7, C.cool); dot(f, xB, yB, 7, C.cool); dot(f, xStar, y0, 7, C.warm);
      // 两个试探路径
      for (const off of [-60, 54]) {
        const xp = xStar + off;
        seg(f, xA, yA, xp, y0, `${C.dim}aa`, 1.4);
        seg(f, xp, y0, xB, yB, `${C.dim}aa`, 1.4);
        text(f, '试探', xp - 14, y0 + 20, { color: C.dim, font: '10px sans-serif' });
      }
      text(f, '真实路径的光程取驻值（费马 1657）——反射定律是变分法的解', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    } else {
      // 下落路径比较（最速落径 vs 直线 vs 抛物线）
      const x0 = 70, y0 = 70;
      seg(f, x0, y0, x0, h - 60, C.dim, 2);
      seg(f, x0, y0, w - 60, y0, C.dim, 2);
      const draw = (fn: (t: number) => [number, number], color: string, lw: number, dash?: number[]): void => {
        const pts: [number, number][] = [];
        for (let i = 0; i <= 80; i++) pts.push(fn(i / 80));
        poly(f, pts, { stroke: color, lw, ...(dash ? { dash } : {}) } as any);
      };
      draw((t) => [x0 + t * (w - 130), y0 + t * (h - 130)], `${C.dim}aa`, 1.6, [6, 4]);
      draw((t) => [x0 + t * (w - 130), y0 + Math.pow(t, 1.6) * (h - 130)], C.hot, 3);
      const prog = (f.t * 0.5) % 1;
      const px = x0 + prog * (w - 130), py = y0 + Math.pow(prog, 1.6) * (h - 130);
      dot(f, px, py, 8, C.warm);
      text(f, '虚线=任意路径：作用量 S=∫Ldt 各不相同；红=真实路径使 δS=0', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    }
    text(f, 'δ∫L(q,q̇,t)dt = 0 —— 宇宙只走驻值路线', w * 0.5 - 140, h - 30, { color: C.warm, font: '15px serif' });

    footnotes(f, [
      '最小作用量原理是力学的最高形式：牛顿、拉格朗日、哈密顿全部等价导出',
      '几何光学的费马、费曼的路径积分、广义相对论的爱因斯坦-希尔伯特作用量——同一原理的放大',
      '自然界不计算力，只比较路径——物理被变分原理重新定义',
    ]);
    heading(f, '最小作用量：自然界的选择方式');
  },
});
registerViz(leastAction);

/** 广义坐标与自由度。 */
const generalizedCoordinates = defineViz({
  slug: 'generalized-coordinates', title: '广义坐标与自由度', animated: true,
  params: {
    demo: { type: 'select', options: ['双摆', '滑块+摆'], default: '双摆', label: '体系' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const slider = String((params as Record<string, unknown>)['demo'] ?? '').includes('滑块');
    clear(f);
    if (slider) {
      // 滑块+摆：3 个笛卡尔坐标 → 2 个广义坐标
      const y0 = h * 0.4;
      seg(f, 70, y0, w - 70, y0, C.dim, 3);
      const sx = w * 0.4 + Math.sin(f.t * 1.4) * 70;
      poly(f, [[sx - 34, y0 - 30], [sx + 34, y0 - 30], [sx + 34, y0 - 4], [sx - 34, y0 - 4]],
        { stroke: C.cool, lw: 2.4, fill: 'rgba(66,153,225,0.3)' } as any);
      const th = Math.sin(f.t * 2.3) * 0.8;
      const bx = sx + Math.sin(th) * 96, by = y0 - 4 + Math.cos(th) * 96;
      seg(f, sx, y0 - 4, bx, by, C.warm, 2.4);
      dot(f, bx, by, 11, C.warm);
      text(f, '笛卡尔坐标：(x滑块, x摆, y摆) = 3 个', 70, y0 - 60, { color: C.dim, font: '13px sans-serif' });
      text(f, '广义坐标：q₁=x（滑块）、q₂=θ（摆角）= 2 个', 70, y0 + 96, { color: C.green, font: '14px sans-serif' });
      text(f, '约束 x_绳=常数 自动消去一个自由度——广义坐标的全部意义', 70, y0 + 124, { color: C.cyan, font: '12px sans-serif' });
    } else {
      // 双摆自由度
      const px = w * 0.3, py = h * 0.24;
      const th1 = Math.sin(f.t * 2.1) * 0.9, th2 = Math.sin(f.t * 3.1 + 1) * 1.2;
      const x1 = px + Math.sin(th1) * 100, y1 = py + Math.cos(th1) * 100;
      const x2 = x1 + Math.sin(th1 + th2) * 90, y2 = y1 + Math.cos(th1 + th2) * 90;
      seg(f, px, py, x1, y1, C.cool, 2.6);
      seg(f, x1, y1, x2, y2, C.warm, 2.6);
      dot(f, px, py, 5, C.dim); dot(f, x1, y1, 9, C.cool); dot(f, x2, y2, 9, C.warm);
      text(f, 'q = (θ₁, θ₂)：绳长约束让 4 个笛卡尔坐标塌缩成 2 个角', px - 70, 56, { color: C.green, font: '14px sans-serif' });
      text(f, '自由度 f = 3N − 完整约束数 = 2', px - 70, 84, { color: C.cyan, font: '13px sans-serif' });
      // 自由度示意
      text(f, '每个 q 配一个 q̇，拉格朗日方程写 2 条——比牛顿的 4 条分量方程干净', 70, h - 34, { color: C.warm, font: '12px sans-serif' });
    }

    footnotes(f, [
      '广义坐标不必是长度：角度、面积、任何独立参数都行——坐标的自由即方法的自由',
      '完整约束减少自由度；非完整约束（如滚动无滑）不能这样消——分类决定方程写法',
      '从多体分子到场的无穷自由度 (x,t)：广义坐标一路通向场论',
    ]);
    heading(f, '广义坐标：选对变量方程就简单');
  },
});
registerViz(generalizedCoordinates);

/** 约束与虚功。 */
const constrainedDof = defineViz({
  slug: 'constrained-dof', title: '约束、虚功与达朗贝尔', animated: true,
  params: {
    demo: { type: 'select', options: ['斜面滑块（理想约束）', '纯滚动（非完整）'], default: '斜面滑块（理想约束）', label: '体系' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const rolling = String((params as Record<string, unknown>)['demo'] ?? '').includes('滚动');
    clear(f);
    if (!rolling) {
      const bx = w * 0.3, by = h * 0.66;
      poly(f, [[bx - 150, by + 60], [bx + 160, by + 60], [bx + 160, by - 20]], { stroke: C.dim, lw: 2.4, fill: 'rgba(100,116,139,0.18)' } as any);
      const prog = ((f.t * 0.3) % 1);
      const sx = bx - 120 + prog * 250;
      const sy = by + 60 - (sx - (bx - 150)) * (80 / 310);
      poly(f, [[sx - 16, sy], [sx + 16, sy], [sx + 16, sy - 24], [sx - 16, sy - 24]], { stroke: C.warm, lw: 2.2, fill: 'rgba(237,137,54,0.4)' } as any);
      // 约束力（法向）垂直位移 → 虚功为零
      seg(f, sx, sy - 12, sx - 18, sy - 46, C.cool, 2.4);
      text(f, 'N（约束力）⊥ 虚位移 δr', sx + 14, sy - 50, { color: C.cool, font: '11px sans-serif' });
      text(f, '理想约束的虚功恒为零：约束力从不出现在方程里', 40, 44, { color: C.cyan, font: '14px sans-serif' });
      text(f, '达朗贝尔原理：主动力 + 惯性力 = 虚功和为零 → 拉格朗日的出发点', 40, h - 34, { color: C.warm, font: '12px sans-serif' });
    } else {
      // 纯滚动
      const cx = w * 0.4, cy = h * 0.62, R = 46;
      seg(f, 60, cy + R, w - 60, cy + R, C.dim, 3);
      const roll = (f.t * 0.7) % 1;
      const x = 90 + roll * (w - 220);
      const rot = (x - 90) / R;
      dot(f, x, cy, R, 'rgba(100,116,139,0.45)');
      for (let k = 0; k < 4; k++) {
        const a = rot + (k * Math.PI) / 2;
        seg(f, x, cy, x + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4), C.cool, 1.8);
      }
      dot(f, x, cy + R, 3.4, C.hot);
      text(f, '接触点瞬时静止（v=ωR）——非完整约束：滚动不能积分成位置方程', 40, 44, { color: C.hot, font: '13px sans-serif' });
      text(f, '但虚功仍为零：理想纯滚同样不进方程——约束的分级处理', 40, h - 34, { color: C.cyan, font: '12px sans-serif' });
    }

    footnotes(f, [
      '完整约束（等式可积分）可消自由度；非完整约束（速度型不等式/微分型）不能——分类决定方程架构',
      '虚位移是约束允许的无穷小试探位移——虚功原理把静力学推广到动力学',
      '达朗贝尔把惯性力当主动力：动力学变静力学——分析力学的历史跳板',
    ]);
    heading(f, '约束与虚功：看不见的力不出场');
  },
});
registerViz(constrainedDof);

/** 泊松括号。 */
const poissonBracket = defineViz({
  slug: 'poisson-bracket', title: '泊松括号', animated: true,
  params: {
    kind: { type: 'select', options: ['正则对易关系', '守恒量判据'], default: '正则对易关系', label: '视角' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    clear(f);
    if (String((params as Record<string, unknown>)['kind'] ?? '').includes('正则')) {
      text(f, '{A, B} = ∂A/∂q·∂B/∂p − ∂A/∂p·∂B/∂q', w * 0.5 - 190, 84, { color: C.cyan, font: '19px serif' });
      text(f, '{q, p} = 1　{q, q} = {p, p} = 0', w * 0.5 - 140, 124, { color: C.warm, font: '17px serif' });
      // 相空间中的流（正则变换保持面积）
      const cx = w / 2, cy = h / 2 + 40;
      const S = Math.min(w, h) * 0.3;
      seg(f, cx - S * 1.2, cy, cx + S * 1.2, cy, C.grid, 1.3);
      seg(f, cx, cy - S * 1.2, cx, cy + S * 1.2, C.grid, 1.3);
      // 面积元变形（保持面积）
      const ph = f.t;
      const base: [number, number][] = [
        [cx - 50, cy - 34], [cx + 50, cy - 34], [cx + 50, cy + 34], [cx - 50, cy + 34],
      ];
      const shear = Math.sin(ph) * 40;
      const sheared = base.map(([x, y]) => [x + (y - cy) * (shear / 40), y + (x - cx) * 0.18] as [number, number]);
      poly(f, [...sheared, sheared[0]], { stroke: C.warm, lw: 2.2, fill: 'rgba(237,137,54,0.16)' } as any);
      poly(f, [...base, base[0]], { stroke: `${C.cool}aa`, lw: 1.4, dash: [6, 4] } as any);
      text(f, '正则变换把面积元剪切变形——但面积不变（刘维尔=辛形式守恒）', 40, 44, { color: C.cyan, font: '13px sans-serif' });
      text(f, '量子对应：{·,·} → (i/ħ)[·,·]——泊松括号直接变成对易子', 40, h - 34, { color: C.green, font: '13px sans-serif' });
    } else {
      text(f, 'dA/dt = {A, H} + ∂A/∂t', w * 0.5 - 130, 92, { color: C.cyan, font: '20px serif' });
      text(f, 'A 守恒 ⇔ {A, H}=0 且不显含 t', w * 0.5 - 150, 134, { color: C.warm, font: '17px serif' });
      // 守恒量示例（能量/动量/角动量）
      const items: [string, string][] = [
        ['H（能量）', '时间平移对称'],
        ['p（动量）', '空间平移对称'],
        ['L（角动量）', '转动对称'],
      ];
      for (let i = 0; i < items.length; i++) {
        const y = h * 0.42 + i * 56;
        const pulse = 0.7 + 0.3 * Math.sin(f.t * 2 + i);
        poly(f, [[w * 0.2, y - 20], [w * 0.8, y - 20], [w * 0.8, y + 20], [w * 0.2, y + 20]],
          { stroke: `rgba(66,153,225,${pulse})`, lw: 1.8, fill: 'rgba(66,153,225,0.08)' } as any);
        text(f, `{${items[i][0]}, H} = 0`, w * 0.24, y + 5, { color: C.cool, font: '14px sans-serif' });
        text(f, `来源：${items[i][1]}`, w * 0.56, y + 5, { color: C.warm, font: '13px sans-serif' });
      }
      text(f, '守恒律=对称性，在泊松括号里写成与 H 对易', w * 0.5 - 160, h - 34, { color: C.green, font: '14px sans-serif' });
    }

    footnotes(f, [
      '泊松括号是哈密顿力学的运算内核：导数、守恒、正则变换全用它表达',
      '狄拉克 1925 从 {A,B} 与 (i/ħ)[A,B] 的对应猜出量子力学的对易结构',
      '诺特定理的现代形式：对称生成元与 H 的泊松括号为零即守恒',
    ]);
    heading(f, '泊松括号：从经典通往量子的桥');
  },
});
registerViz(poissonBracket);

/** 正则变换。 */
const canonicalTransform = defineViz({
  slug: 'canonical-transform', title: '正则变换', animated: true,
  params: {
    kind: { type: 'select', options: ['生成函数 F₁', '相图变形'], default: '相图变形', label: '演示' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    clear(f);
    const cx = w / 2, cy = h / 2 + 16;
    const S = Math.min(w, h) * 0.3;
    seg(f, cx - S * 1.2, cy, cx + S * 1.2, cy, C.grid, 1.3);
    seg(f, cx, cy - S * 1.2, cx, cy + S * 1.2, C.grid, 1.3);
    if (String((params as Record<string, unknown>)['kind'] ?? '').includes('生成')) {
      text(f, '(q,p) → (Q,P)：新旧变量都满足哈密顿方程', 40, 44, { color: C.cyan, font: '15px serif' });
      text(f, '存在生成函数 F(q,Q,t) 使 dF = p dq − P dQ + K dt', 40, 74, { color: C.warm, font: '14px serif' });
      // 两组坐标对照
      const orig = [[-60, -40], [-20, -52], [24, -38], [52, -6]];
      const canon = orig.map(([x, y], i) => [x * Math.cos(0.5) - y * Math.sin(0.5) * 0.7 + i * 6, x * Math.sin(0.5) * 0.7 + y * Math.cos(0.5)] as [number, number]);
      poly(f, orig.map(([x, y]) => [cx + x, cy + y] as [number, number]), { stroke: C.cool, lw: 2 });
      poly(f, canon.map(([x, y]) => [cx + x, cy + y] as [number, number]), { stroke: C.warm, lw: 2, dash: [6, 4] } as any);
      text(f, '蓝=原相轨　橙=正则变换后（物理等价、坐标更顺手）', 40, h - 34, { color: C.dim, font: '12px sans-serif' });
    } else {
      // 相图变形保持面积（辛）
      const ph = f.t * 0.7;
      const pts: [number, number][] = [];
      for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.1) {
        const r = S * 0.7 * (1 + 0.2 * Math.cos(2 * a));
        pts.push([cx + r * Math.cos(a + ph * 0.3), cy + r * Math.sin(a) * (1 + 0.15 * Math.sin(ph))]);
      }
      poly(f, [...pts, pts[0]], { stroke: C.accent, lw: 2.6 });
      // 面积元
      const e: [number, number][] = [[cx - 34, cy - 22], [cx + 34, cy - 22], [cx + 34, cy + 22], [cx - 34, cy + 22]];
      poly(f, [...e, e[0]], { stroke: C.warm, lw: 1.8, fill: 'rgba(237,137,54,0.14)' });
      text(f, '相轨随生成函数变形——但圈起来的相面积不变（辛条件）', 40, 44, { color: C.cyan, font: '14px sans-serif' });
      text(f, '作用量-角变量 (J,θ) 正则变换让可积系统的轨道变直线', 40, h - 34, { color: C.warm, font: '12px sans-serif' });
    }

    footnotes(f, [
      '正则变换是"换一套更聪明的坐标"——物理不变，方程变简（如作用量-角变量）',
      '辛几何条件 det(∂(Q,P)/∂(q,p))=1 是相面积守恒的现代表述',
      'KAM 定理用作用量-角变量研究近可积系统的稳定性——天体力学的现代支柱',
    ]);
    heading(f, '正则变换：换坐标不换物理');
  },
});
registerViz(canonicalTransform);

/** 维里定理。 */
const virialTheorem = defineViz({
  slug: 'virial-theorem', title: '维里定理', animated: true,
  params: {
    kind: { type: 'select', options: ['平方反比势', '谐振子势'], default: '平方反比势', label: '势型' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const harmonic = String((params as Record<string, unknown>)['kind'] ?? '').includes('谐振');
    clear(f);
    const x0 = 64, y0 = h - 56, y1 = 64;
    const vv = view(f, { xMin: -3, xMax: 3, yMin: -1.4, yMax: 3, inset: 50 });
    grid(f, vv, { divisions: 4, ticks: true });
    // 势能曲线
    const V = harmonic ? (x: number): number => 0.5 * x * x : (x: number): number => -1 / Math.max(Math.abs(x), 0.3);
    const pot: [number, number][] = [];
    for (let i = 0; i <= 240; i++) {
      const x = -3 + (i / 240) * 6;
      const v = Math.max(-1.4, Math.min(3, V(x)));
      pot.push([vv.sx(x), vv.sy(v)]);
    }
    poly(f, pot, { stroke: C.accent, lw: 2.8 });
    // 往复运动的粒子
    const ph = f.t * 2.2;
    const xa = harmonic ? 2.2 * Math.sin(ph) : Math.sign(Math.sin(ph)) * (0.4 + 1.6 * Math.abs(Math.sin(ph)));
    dot(f, vv.sx(Math.max(-2.9, Math.min(2.9, xa))), vv.sy(Math.max(-1.3, Math.min(2.9, V(xa)))), 8, C.warm);
    void x0; void y0; void y1;
    const avgT = harmonic ? '⟨T⟩ = ½⟨V⟩（等分）' : '⟨T⟩ = −½⟨V⟩（维里）';
    text(f, harmonic ? '谐振子：⟨T⟩=⟨V⟩ 严格等分——维里的特例 2⟨T⟩=−⟨V⟩+2⟨T⟩' : '2⟨T⟩ = −⟨V⟩ = n⟨E⟩（平方反比势）', 30, 44, { color: C.cyan, font: '14px sans-serif' });
    text(f, avgT + `：对时间平均的 ${harmonic ? '等分定理' : '维里关系'}`, 30, 66, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      'virial（克劳修斯 1870）：vir = 力×位置的时均——束缚系统的动能与势能被锁死比例',
      '恒星的质光关系、白矮星与中子星的质量-半径关系都从维里关系起步',
      '分子动理论用它推理想气体 PV=NkT；天体物理用它称量星团的总质量',
    ]);
    heading(f, '维里定理：束缚系统的能量配比');
  },
});
registerViz(virialTheorem);
