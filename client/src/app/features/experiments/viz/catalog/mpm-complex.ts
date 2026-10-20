import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text, view, grid, curve, circle, vec, rng } from '../canvas';

/** P556 解析函数与柯西-黎曼条件。 */
const cauchyRiemann = defineViz({
  slug: 'cauchy-riemann',
  title: '解析函数与柯西-黎曼条件',
  params: { fn: { type: 'select', options: ['f = z²', 'f = e^z', 'f = 1/z', 'f = √z（非解析处）'], default: 'f = z²', label: '函数' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'fn', 'f = z²');
    clear(f);
    // 左：z 平面网格
    const ax = w * 0.25, ay = h * 0.44, R = 110;
    seg(f, ax - R - 30, ay, ax + R + 30, ay, C.dim, 1.4);
    seg(f, ax, ay - R - 30, ax, ay + R + 30, C.dim, 1.4);
    text(f, 'z 平面：正交网格（直角）', ax, ay - R - 44, { align: 'center', color: C.fg, font: '15px serif' });
    for (let k = -2; k <= 2; k++) {
      const p1: Array<[number, number]> = [], p2: Array<[number, number]> = [];
      for (let i = 0; i <= 60; i++) {
        const t = -1 + (i / 60) * 2;
        p1.push([ax + t * R, ay - (k / 2) * R]);
        p2.push([ax + (k / 2) * R, ay - t * R]);
      }
      poly(f, p1, { stroke: `${C.cool}aa`, lw: 1.5 });
      poly(f, p2, { stroke: `${C.warm}aa`, lw: 1.5 });
    }
    // 右：w 平面像
    const bx = w * 0.74;
    seg(f, bx - R - 30, ay, bx + R + 30, ay, C.dim, 1.4);
    seg(f, bx, ay - R - 30, bx, ay + R + 30, C.dim, 1.4);
    text(f, 'w 平面：像网格（仍正交）', bx, ay - R - 44, { align: 'center', color: C.yellow, font: '15px serif' });
    const mapFn = (x: number, y: number): [number, number] => {
      switch (kind) {
        case 'f = z²': return [x * x - y * y, 2 * x * y];
        case 'f = e^z': return [Math.exp(x) * Math.cos(y), Math.exp(x) * Math.sin(y)];
        case 'f = 1/z': { const d = x * x + y * y + 1e-6; return [x / d, -y / d]; }
        default: { const r = Math.hypot(x, y); const th = Math.atan2(y, x); return [Math.sqrt(r) * Math.cos(th / 2), Math.sqrt(r) * Math.sin(th / 2)]; }
      }
    };
    const singular = kind === 'f = 1/z';
    const branchy = kind === 'f = √z（非解析处）';
    for (let k = -2; k <= 2; k++) {
      for (const horiz of [true, false]) {
        const p: Array<[number, number]> = [];
        for (let i = 0; i <= 100; i++) {
          const t = -1 + (i / 100) * 2;
          const zx = horiz ? t * 1.05 : (k / 2) * 1.05;
          const zy = horiz ? (k / 2) * 1.05 : t * 1.05;
          const [u, vv] = mapFn(zx, zy);
          const sc = kind === 'f = 1/z' ? 76 : kind === 'f = e^z' ? 34 : 40;
          if (!Number.isFinite(u) || Math.abs(u) > 4 || Math.abs(vv) > 4) continue;
          p.push([bx + u * sc, ay - vv * sc]);
        }
        if (p.length > 1) poly(f, p, { stroke: horiz ? `${C.cool}aa` : `${C.warm}aa`, lw: 1.5 });
      }
    }
    if (singular) {
      dot(f, bx, ay, 8, C.hot);
      text(f, 'z=0：一阶极点（非解析）', bx + 14, ay - 12, { color: C.hot, font: '13px serif' });
    }
    if (branchy) {
      seg(f, bx, ay, bx + R + 30, ay, `${C.hot}bb`, 2.4);
      text(f, '割线：负实轴不解析（分支点）', bx + 8, ay + 22, { color: C.hot, font: '13px serif' });
    }
    // CR 条件公式
    text(f, '∂u/∂x = ∂v/∂y，　∂u/∂y = −∂v/∂x（CR 方程）', 56, h - 148, { color: C.yellow, font: '17px serif' });
    text(f, '满足 ⇒ 复可导 ⇒ 无穷次可导 ⇒ 幂级数收敛 —— 解析的超强套餐', 56, h - 118, { color: C.fg, font: '15px sans-serif' });
    text(f, '几何意义：映射是旋转+伸缩（保角）—— 正交网格映成正交网格', 56, h - 88, { color: C.green, font: '15px serif' });
    footnotes(f, [
      'CR 方程是复可导的充要条件（在点连续前提下）—— 实部虚部被死死绑在一起',
      'u、v 各自调和：∇²u = ∇²v = 0 —— 解析函数与拉氏方程的血缘',
      '反例 f = z̄ = x−iy：处处"可微"却不解析 —— 复可导比实可导苛刻得多',
    ]);
    heading(f, 'CR 条件一满足，函数就有超强性质');
  },
});
registerViz(cauchyRiemann);

/** P557 柯西积分公式与高阶导数。 */
const cauchyIntegralFormula = defineViz({
  slug: 'cauchy-integral-formula',
  title: '柯西积分公式与高阶导数',
  params: { n: { type: 'range', min: 0, max: 3, default: 0, step: 1, label: '导数阶 n' } },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'n', 0));
    clear(f);
    // 左：围道与内部点
    const cx = w * 0.27, cy = h * 0.44;
    const { ctx } = f;
    ctx.save();
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 140, 110, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    text(f, '围道 C（正向）', cx, cy - 128, { align: 'center', color: C.accent, font: '14px serif' });
    // 方向箭头
    const a = f.t * 1.4;
    const ax2 = cx + Math.cos(a) * 140, ay2 = cy + Math.sin(a) * 110;
    vec(f, ax2, ay2, ax2 - Math.sin(a) * 34, ay2 + Math.cos(a) * 34, C.accent, 3, 9);
    // 内部点 z₀
    const z0x = cx + 40, z0y = cy - 24;
    dot(f, z0x, z0y, 8, C.hot);
    text(f, 'z₀（内部）', z0x + 12, z0y - 8, { color: C.hot, font: '14px serif' });
    // 围道上的点与连线
    for (let k = 0; k < 10; k++) {
      const t = (k / 10) * Math.PI * 2;
      const px = cx + Math.cos(t) * 140, py = cy + Math.sin(t) * 110;
      dot(f, px, py, 4.4, C.yellow);
      seg(f, px, py, z0x, z0y, `${C.grid}88`, 1);
    }
    text(f, '边界值 → 内部值（全息式）', cx, cy + 154, { align: 'center', color: C.yellow, font: '15px serif' });
    // 右：公式族
    const rx = w * 0.56;
    const formulas = [
      ['f(z₀) = (1/2πi) ∮ f(z)/(z−z₀) dz', C.cool],
      ['f\'(z₀) = (1/2πi) ∮ f(z)/(z−z₀)² dz', C.green],
      ['f\'\'(z₀) = (2!/2πi) ∮ f(z)/(z−z₀)³ dz', C.warm],
      ['f⁽ⁿ⁾(z₀) = (n!/2πi) ∮ f(z)/(z−z₀)^{n+1} dz', C.hot],
    ] as Array<[string, string]>;
    formulas.forEach(([s, color], i) => {
      const active = i === n;
      const y = 100 + i * 66;
      poly(f, [[rx, y], [rx + 350, y], [rx + 350, y + 52], [rx, y + 52]],
        { fill: active ? `${color}33` : `${color}10`, stroke: color, lw: active ? 3 : 1.5 });
      text(f, s, rx + 14, y + 34, { color: active ? C.fg : color, font: '15px serif' });
    });
    text(f, `当前 n=${n}：${n === 0 ? '函数值由边界完全决定' : n === 1 ? '一阶导数也由边界决定' : '高阶导数同样'}`,
      rx, 100 + 4 * 66 + 14, { color: C.yellow, font: '15px serif' });
    text(f, '柯西估计：|f⁽ⁿ⁾(z₀)| ≤ n!·M/R —— 导数被边界值 M 卡死', rx, 100 + 4 * 66 + 50, { color: C.green, font: '15px serif' });
    text(f, '推论：有界整函数必为常数（刘维尔定理）', rx, 100 + 4 * 66 + 86, { color: C.hot, font: '15px serif' });
    footnotes(f, [
      '解析函数"边界即全部"：内部每个值、每阶导数都能从围道积分捞出',
      '无穷可导的来源：n 阶公式对任意 n 成立 —— 实函数哪有这待遇',
      '莫雷拉定理：反过来，围道积分为零 ⇒ 解析 —— 解析性的另一入口',
    ]);
    heading(f, '边界值决定内部一切');
  },
});
registerViz(cauchyIntegralFormula);

/** P558 留数定理与定积分计算。 */
const residueTheorem = defineViz({
  slug: 'residue-theorem',
  title: '留数定理与定积分计算',
  params: { integral: { type: 'select', options: ['∮ dz/z（=2πi）', '实积分 ∫dx/(1+x²)', '半圆围道 ∫dx/(x⁴+1)'], default: '实积分 ∫dx/(1+x²)', label: '演示' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'integral', '实积分 ∫dx/(1+x²)');
    clear(f);
    // 左：复平面围道
    const cx = w * 0.27, cy = h * 0.46, R = 130;
    seg(f, cx - R - 40, cy, cx + R + 40, cy, C.dim, 1.4);
    seg(f, cx, cy - R - 40, cx, cy + R + 40, C.dim, 1.4);
    text(f, 'Re', cx + R + 44, cy + 16, { color: C.dim, font: '13px serif' });
    text(f, 'Im', cx + 8, cy - R - 44, { color: C.dim, font: '13px serif' });
    if (kind.startsWith('∮')) {
      // 圆围道 + 原点极点
      circle(f, cx, cy, R, { stroke: C.accent, lw: 2.8, dash: [10, 7] });
      dot(f, cx, cy, 8, C.hot);
      text(f, '× 极点 z=0（留数 1）', cx + 14, cy - 12, { color: C.hot, font: '14px serif' });
      const a = f.t * 1.6;
      vec(f, cx + Math.cos(a) * R, cy + Math.sin(a) * R,
        cx + Math.cos(a) * R - Math.sin(a) * 36, cy + Math.sin(a) * R + Math.cos(a) * 36, C.accent, 3, 9);
      text(f, '∮ dz/z = 2πi × Res = 2πi', cx - 150, cy + R + 54, { color: C.yellow, font: '16px serif' });
    } else if (kind.startsWith('实积分')) {
      // 上半圆围道
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 60; i++) {
        const t = (i / 60) * Math.PI;
        pts.push([cx + Math.cos(t) * R, cy - Math.sin(t) * R]);
      }
      poly(f, pts, { stroke: C.accent, lw: 2.8, dash: [10, 7] });
      seg(f, cx - R, cy, cx + R, cy, C.accent, 2.8);
      // 极点 ±i
      dot(f, cx, cy - R * 0.62, 8, C.hot);
      text(f, '× z = i（上半平面唯一极点）', cx + 14, cy - R * 0.62 - 8, { color: C.hot, font: '14px serif' });
      dot(f, cx, cy + R * 0.62, 7, C.dim);
      text(f, 'z = −i（围道外，不计）', cx + 14, cy + R * 0.62 + 16, { color: C.dim, font: '13px serif' });
      text(f, '大弧贡献 → 0（1/z² 衰减）', cx - 130, cy - R - 24, { color: C.cool, font: '13px serif' });
      text(f, '∫dx/(1+x²) = 2πi × Res(i) = π', cx - 150, cy + R + 54, { color: C.yellow, font: '16px serif' });
    } else {
      // 半圆 + 两个极点
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 60; i++) {
        const t = (i / 60) * Math.PI;
        pts.push([cx + Math.cos(t) * R, cy - Math.sin(t) * R]);
      }
      poly(f, pts, { stroke: C.accent, lw: 2.8, dash: [10, 7] });
      seg(f, cx - R, cy, cx + R, cy, C.accent, 2.8);
      // z⁴+1=0 的四个根，上半两个
      const roots = [Math.PI / 4, (3 * Math.PI) / 4];
      roots.forEach((t, i) => {
        const rx0 = cx + Math.cos(t) * R * 0.72, ry0 = cy - Math.sin(t) * R * 0.72;
        dot(f, rx0, ry0, 8, C.hot);
        text(f, `× e^{iπ/${i === 0 ? 4 : 4 + 2}}`, rx0 + 12, ry0 - 6, { color: C.hot, font: '13px serif' });
      });
      text(f, '上半平面 2 个极点都算：和 ×2πi ÷ 2 = 实积分', cx - 150, cy + R + 54, { color: C.yellow, font: '15px serif' });
    }
    // 右侧：方法三步
    const rx = w * 0.58;
    text(f, '围道定积分三步法：', rx, 96, { color: C.yellow, font: '17px serif' });
    const steps = [
      ['① 补围道：实轴 + 大弧（或半圆）', C.cool],
      ['② 数极点：围道内孤立奇点逐个', C.green],
      ['③ 取极限：大弧贡献算出来（常为 0）', C.warm],
    ] as Array<[string, string]>;
    steps.forEach(([s, color], i) => {
      const y = 138 + i * 66;
      poly(f, [[rx, y], [rx + 350, y], [rx + 350, y + 50], [rx, y + 50]],
        { fill: `${color}14`, stroke: `${color}bb`, lw: 1.8 });
      text(f, s, rx + 14, y + 32, { color, font: '15px serif' });
    });
    text(f, '∮ = 2πi × Σ 留数（围道内）', rx, 138 + 3 * 66 + 18, { color: C.fg, font: '17px serif' });
    text(f, '留数 = (z−z₀) f(z) 在 z₀ 的泰勒系数 a₋₁', rx, 138 + 3 * 66 + 56, { color: C.cool, font: '15px serif' });
    text(f, '物理应用：格林函数极点求模式、松原求和、色散关系', rx, 138 + 3 * 66 + 96, { color: C.green, font: '14px sans-serif' });
    footnotes(f, [
      '留数定理把围道积分变成加法：不用原函数，直接数奇点',
      '实积分的"作弊码"：补一个虚拟的虚轴方向把实轴闭合成围道',
      '极点留数公式按阶数分类（单极点、高阶极点）—— 分母求导即可',
    ]);
    heading(f, '围道积分=2πi 乘留数和');
  },
});
registerViz(residueTheorem);

/** P559 洛朗级数与奇点分类。 */
const laurentSeries = defineViz({
  slug: 'laurent-series',
  title: '洛朗级数与奇点分类',
  params: { sing: { type: 'select', options: ['可去奇点', '极点', '本性奇点'], default: '极点', label: '奇点类型' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'sing', '极点');
    clear(f);
    const v = view(f, { xMin: -3, xMax: 3, yMin: -2.4, yMax: 2.4, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 函数行为
    const fn = (x: number): number => {
      if (Math.abs(x) < 0.02) return NaN;
      if (kind === '可去奇点') return Math.abs(x) < 0.02 ? 1 : Math.sin(x) / x;
      if (kind === '极点') return 1 / (x * x) > 40 ? NaN : 1 / (x * x) - 0.5;
      return 1 / Math.sin(x * 6) * 0.4 + Math.sin(1 / (x + 0.001)) * 0.8;
    };
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 600; i++) {
      const x = -3 + (i / 600) * 6;
      const y = fn(x);
      if (!Number.isFinite(y) || Math.abs(y) > 2.6) { if (pts.length) { poly(f, pts, { stroke: C.accent, lw: 2.4 }); pts.length = 0; } continue; }
      pts.push([v.sx(x), v.sy(y)]);
    }
    if (pts.length > 1) poly(f, pts, { stroke: C.accent, lw: 2.4 });
    dot(f, v.sx(0), v.sy(0), 8, C.hot);
    // 洛朗级数形式
    const forms: Record<string, string> = {
      '可去奇点': 'f(z) = Σ aₙzⁿ（无负幂，可补定义变解析）',
      '极点': 'f(z) = Σ aₙzⁿ + a₋₁/z + a₋₂/z² + …（有限负幂）',
      '本性奇点': 'f(z) = … a₋₂/z² + a₋₁/z（无穷负幂，庞加莱：任意逼近值）',
    };
    text(f, forms[kind], v.sx(-2.9), v.sy(2.2), { color: C.yellow, font: '15px serif' });
    text(f, '环域展开：r < |z−z₀| < R 内收敛', v.sx(-2.9), v.sy(1.96), { color: C.fg, font: '14px serif' });
    const notes: Record<string, string> = {
      '可去奇点': 'lim 存在 ⇒ 擦掉即可（如 sin z/z 在 0）',
      '极点': '留数就在 a₋₁：阶数 = 负幂最低次',
      '本性奇点': 'Picard 定理：任意邻域取遍几乎所有值（e^{1/z} 在 0）',
    };
    text(f, notes[kind], v.sx(-2.9), v.sy(-2.1), { color: kind === '本性奇点' ? C.hot : C.cool, font: '14px serif' });
    // 右下：判定流程
    const bx = w * 0.56, by = h - 178;
    text(f, '分类判定：', bx, by, { color: C.yellow, font: '15px serif' });
    ['lim 存在？ → 可去', 'lim = ∞？ → 数负幂最高阶 = 极点阶数', 'lim 振荡不存在？ → 本性奇点'].forEach((s, i) => {
      text(f, '· ' + s, bx, by + 32 + i * 32, { color: C.fg, font: '14px sans-serif' });
    });
    footnotes(f, [
      '洛朗 = 泰勒 + 负幂部：解析部分好算、负幂部分装奇点',
      '负幂最高阶 m ⇒ 留数可由求 m−1 阶导得到（通用留数公式）',
      '孤立奇点三分类覆盖一切：非孤立奇点（如割线）另作处理',
    ]);
    heading(f, '负幂项是奇点的显微镜');
  },
});
registerViz(laurentSeries);

/** P560 施瓦茨-克里斯托费尔映射。 */
const schwartzChristoffel = defineViz({
  slug: 'schwartz-christoffel',
  title: '施瓦茨-克里斯托费尔映射',
  params: { poly: { type: 'select', options: ['上半平面→矩形', '上半平面→三角形', '上半平面→半带'], default: '上半平面→矩形', label: '目标' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'poly', '上半平面→矩形');
    clear(f);
    // 左：上半平面与实轴上的点
    const ax = w * 0.25, ay = h * 0.6, R = 150;
    poly(f, [[ax - R, ay - 130], [ax + R, ay - 130], [ax + R, ay], [ax - R, ay]],
      { fill: 'rgba(66,153,225,0.1)', stroke: C.grid, lw: 2 });
    seg(f, ax - R - 30, ay, ax + R + 30, ay, C.cool, 3);
    text(f, '上半平面 Im z > 0', ax, ay - 150, { align: 'center', color: C.cool, font: '15px serif' });
    // 实轴上的原像点
    const pre = kind === '上半平面→矩形' ? [-1.2, -0.4, 0.4, 1.2] : kind === '上半平面→三角形' ? [-1, 0.5] : [-1.4, 0.8];
    const marks = kind === '上半平面→矩形' ? ['−1', '0⁻', '0⁺', '1'] : ['x₁', 'x₂'];
    pre.forEach((x, i) => {
      dot(f, ax + x * R * 0.75, ay, 7, C.hot);
      text(f, marks[i] ?? '', ax + x * R * 0.75, ay + 22, { align: 'center', color: C.hot, font: '13px serif' });
    });
    text(f, '实轴上的点 → 多边形顶点', ax - R, ay + 54, { color: C.yellow, font: '14px serif' });
    text(f, '无穷远 → 边（多边形总在"手边"）', ax - R, ay + 84, { color: C.dim, font: '14px sans-serif' });
    // 右：目标多边形（动画闭合程度）
    const bx = w * 0.74, by = h * 0.42;
    const grow = 0.5 + (Math.sin(f.t * 1.2) * 0.5 + 0.5) * 0.5;
    const s = 110 * grow;
    if (kind === '上半平面→矩形') {
      poly(f, [[bx - s, by - s * 0.66], [bx + s, by - s * 0.66], [bx + s, by + s * 0.66], [bx - s, by + s * 0.66]],
        { stroke: C.warm, lw: 3.4, fill: 'rgba(237,137,54,0.12)' });
      // 顶点角标注（都是直角）
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
        text(f, 'π/2', bx + sx * s - sx * 26, by + sy * s * 0.66 - sy * 12, { align: 'center', color: C.yellow, font: '12px serif' });
      });
    } else if (kind === '上半平面→三角形') {
      poly(f, [[bx, by - s * 0.8], [bx + s, by + s * 0.5], [bx - s, by + s * 0.5]],
        { stroke: C.green, lw: 3.4, fill: 'rgba(72,187,120,0.12)' });
      text(f, 'π/3', bx - 16, by + s * 0.5 - 18, { color: C.yellow, font: '12px serif' });
      text(f, 'π/3', bx + 16, by + s * 0.5 - 18, { color: C.yellow, font: '12px serif' });
      text(f, 'π/3', bx, by - s * 0.8 + 26, { color: C.yellow, font: '12px serif' });
    } else {
      poly(f, [[bx - s, by - s * 0.8], [bx + s, by - s * 0.8], [bx + s, by + s * 0.7], [bx - s, by + s * 0.7]],
        { stroke: C.pink, lw: 3.4, fill: 'rgba(237,100,166,0.1)' });
      // 右边开口（半带）
      seg(f, bx + s, by - s * 0.8, bx + s, by + s * 0.7, C.bg, 6);
      text(f, '（开口边 ← ∞）', bx + s - 40, by + s * 0.7 + 26, { color: C.dim, font: '12px serif' });
    }
    text(f, 'w = C ∫∏(z−xₖ)^{(αₖ/π)−1} dz', bx - s, by - s - 40, { color: C.yellow, font: '15px serif' });
    text(f, '指数由顶点内角 αₖ 定：角 ↔ 零点/极点', bx - s, by + s + 60, { color: C.fg, font: '14px serif' });
    text(f, '把上半平面的拉氏解搬过去 = 多边形边值问题的通解', 56, h - 92, { color: C.green, font: '15px serif' });
    footnotes(f, [
      'SC 映射：解析映射把直线边界变成多边形，保角性保持场图正交',
      '顶点对应实轴点，内角决定因子指数 —— 几何信息编码进幂次',
      '应用：平行板电容器边缘场、流体力学角域、芯片电极的奇点场强',
    ]);
    heading(f, '上半平面变多边形的积分机器');
  },
});
registerViz(schwartzChristoffel);

/** P561 解析延拓与黎曼面。 */
const analyticContinuation = defineViz({
  slug: 'analytic-continuation',
  title: '解析延拓与黎曼面',
  params: { view2: { type: 'select', options: ['延拓接力', '黎曼面（√z）'], default: '延拓接力', label: '演示' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = str(params, 'view2', '延拓接力');
    clear(f);
    if (mode === '延拓接力') {
      // 圆盘链式延拓
      const y0 = h * 0.4;
      const discs = [
        [w * 0.16, y0, 90, 'D₁：级数收敛盘', C.cool],
        [w * 0.36, y0 - 30, 90, 'D₂：新的中心', C.green],
        [w * 0.56, y0 + 20, 90, 'D₃：重叠区值必须一致', C.warm],
        [w * 0.78, y0 - 10, 90, 'Dₙ → 最大解析域', C.pink],
      ] as Array<[number, number, number, string, string]>;
      discs.forEach(([x, y, r, label, color], i) => {
        circle(f, x, y, r, { stroke: color, lw: 2.4, fill: `${color}14`, dash: [7, 5] });
        dot(f, x, y, 6, color);
        text(f, `c${i + 1}`, x, y + 5, { align: 'center', color, font: '14px serif' });
        text(f, label, x - r, y + r + 26, { align: 'center', color, font: '12px serif' });
        if (i < 3) {
          const [nx] = discs[i + 1];
          text(f, '≡', (x + nx) / 2, y - 46, { align: 'center', color: C.yellow, font: '18px serif' });
        }
      });
      text(f, '解析延拓唯一性：重叠区一旦相同，整个延拓链被锁死', 56, h - 168, { color: C.yellow, font: '16px serif' });
      text(f, 'ζ(s)：级数只在 Re s>1 收敛 —— 沿接力盘延到全平面（s=1 极点除外）', 56, h - 138, { color: C.fg, font: '15px sans-serif' });
      text(f, '黎曼猜想研究的正是延拓后零点的分布 —— 素数定理的复分析通道', 56, h - 108, { color: C.hot, font: '15px sans-serif' });
      text(f, '唯一性定理：若两解析函数在有极限点的集合上相等，则处处相等', 56, h - 78, { color: C.cool, font: '14px sans-serif' });
      footnotes(f, [
        '解析延拓 = 唯一地把函数从"小盘"推到"最大域" —— 复分析的全局化',
        '解析奇点（极点、本性）是延拓的天花板 —— 奇点位置携带物理信息',
        '物理例子：色散关系把响应函数的解析性与因果性绑在一起（Kramers-Kronig）',
      ]);
    } else {
      // 黎曼面演示：√z 的两叶
      const cx1 = w * 0.3, cx2 = w * 0.7, cy = h * 0.44, R = 120;
      // 第一叶
      circle(f, cx1, cy, R, { stroke: C.cool, lw: 2.6 });
      text(f, '第一叶（Re √z ≥ 0）', cx1, cy - R - 24, { align: 'center', color: C.cool, font: '14px serif' });
      // 相位从 0 到 2π
      const pts1: Array<[number, number]> = [];
      for (let i = 0; i <= 200; i++) {
        const th = (i / 200) * Math.PI * 2;
        const r = 40 + th * 9;
        if (r > R - 8) break;
        pts1.push([cx1 + Math.cos(th) * r, cy + Math.sin(th) * r]);
      }
      poly(f, pts1, { stroke: C.yellow, lw: 2.6 });
      dot(f, cx1, cy, 7, C.hot);
      text(f, '分支点', cx1 + 10, cy + 22, { color: C.hot, font: '13px serif' });
      // 第二叶
      circle(f, cx2, cy, R, { stroke: C.green, lw: 2.6, dash: [8, 6] });
      text(f, '第二叶（绕一圈后，√z 变号）', cx2, cy - R - 24, { align: 'center', color: C.green, font: '14px serif' });
      const pts2: Array<[number, number]> = [];
      for (let i = 0; i <= 200; i++) {
        const th = (i / 200) * Math.PI * 2;
        const r = 40 + th * 9;
        if (r > R - 8) break;
        pts2.push([cx2 + Math.cos(th) * r, cy + Math.sin(th) * r]);
      }
      poly(f, pts2, { stroke: C.pink, lw: 2.6 });
      dot(f, cx2, cy, 7, C.hot);
      // 缝合标记
      const flow = (f.t * 0.6) % 1;
      const fx = cx1 + R * 0.5 + flow * (cx2 - cx1 - R);
      dot(f, fx, cy, 7, C.yellow);
      text(f, '穿过割线 → 滑到另一叶', (cx1 + cx2) / 2, cy + R + 40, { align: 'center', color: C.yellow, font: '15px serif' });
      text(f, '两叶在分支点相连：√z 单值化需要两层复平面', 56, h - 138, { color: C.fg, font: '16px serif' });
      text(f, '割线是人为的"楼层隔板"：函数本身没事，是我们要求单值', 56, h - 108, { color: C.cool, font: '15px sans-serif' });
      text(f, '多叶结构：ln（无穷叶）、√z（2 叶）—— 拓扑从复分析里长出来', 56, h - 78, { color: C.green, font: '14px sans-serif' });
      footnotes(f, [
        '多值函数的病根：绕分支点一圈函数变号 —— 黎曼面把多值变单值',
        '分支点是拓扑的（绕行改变值），与奇点类型是两个维度的分类',
        '物理中的相位滑移（BJJosephson、Berry 相位）是黎曼面思想的实数版',
      ]);
    }
    heading(f, '一个定义域外推到最大舞台');
  },
});
registerViz(analyticContinuation);

/** P562 分支点与多值函数。 */
const branchCuts = defineViz({
  slug: 'branch-cuts',
  title: '分支点与多值函数',
  params: { fn: { type: 'select', options: ['√z', 'ln z', 'z^(1/3)'], default: '√z', label: '函数' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'fn', '√z');
    clear(f);
    // 复平面 + 割线 + 绕行点
    const cx = w * 0.3, cy = h * 0.44, R = 140;
    seg(f, cx - R - 40, cy, cx + R + 40, cy, C.dim, 1.4);
    seg(f, cx, cy - R - 40, cx, cy + R + 40, C.dim, 1.4);
    text(f, 'Re', cx + R + 46, cy + 16, { color: C.dim, font: '13px serif' });
    text(f, 'Im', cx + 10, cy - R - 44, { color: C.dim, font: '13px serif' });
    // 分支点
    dot(f, cx, cy, 9, C.hot);
    text(f, '分支点 z=0', cx + 14, cy + 24, { color: C.hot, font: '14px serif' });
    // 割线（负实轴）
    seg(f, cx - R - 30, cy, cx, cy, `${C.hot}bb`, 3.4, );
    text(f, '割线（函数在此"跳变"）', cx - R - 30, cy - 16, { color: C.hot, font: '13px serif' });
    // 绕行动画
    const phase = (f.t * 0.5) % 1;
    const ang = -Math.PI + phase * Math.PI * 2;
    const orbitR = R * 0.62;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 80; i++) {
      const a = -Math.PI + (i / 80) * phase * Math.PI * 2;
      pts.push([cx + Math.cos(a) * orbitR, cy + Math.sin(a) * orbitR]);
    }
    poly(f, pts, { stroke: C.yellow, lw: 2.6 });
    const px = cx + Math.cos(ang) * orbitR, py = cy + Math.sin(ang) * orbitR;
    dot(f, px, py, 8, C.yellow);
    const revs = phase;
    // 值显示（绕行前后对比）
    const baseVal = kind === '√z' ? '1.00 → −1.00' : kind === 'ln z' ? '0 → 2πi' : '1 → e^{2πi/3}';
    text(f, `绕一圈：f 的值 ${baseVal}`, cx - R - 30, cy + R + 54, { color: C.yellow, font: '16px serif' });
    text(f, `已完成 ${(revs * 100).toFixed(0)}% 的绕行`, cx - R - 30, cy + R + 84, { color: C.dim, font: '14px serif' });
    // 右侧：多值的处理
    const rx = w * 0.56;
    text(f, `f = ${kind} 的分支结构：`, rx, 100, { color: C.fg, font: '17px serif' });
    const info: Record<string, [string, string, string]> = {
      '√z': ['2 个分支（两叶黎曼面）', '主值取 Re ≥ 0', '分支点：z=0 与 z=∞'],
      'ln z': ['无穷多分支（±2πi 步进）', '主值 Arg ∈ (−π,π]', '分支点：z=0 与 z=∞'],
      'z^(1/3)': ['3 个分支', '主值辐角 ∈ (−π,π]', '分支点：z=0 与 z=∞'],
    };
    const [leaves, principal, points] = info[kind] ?? info['√z'];
    [leaves, principal, points].forEach((s, i) => {
      text(f, '· ' + s, rx, 148 + i * 40, { color: i === 0 ? C.yellow : i === 1 ? C.cool : C.hot, font: '15px sans-serif' });
    });
    text(f, '围道积分时的铁律：', rx, 300, { color: C.green, font: '16px serif' });
    text(f, '绕分支点的围道必须记账（每绕一圈换一枝）', rx, 338, { color: C.green, font: '15px sans-serif' });
    text(f, '留数法遇到支割线：改路径 + 加两岸连接段', rx, 382, { color: C.fg, font: '14px sans-serif' });
    text(f, '物理中的多值：相位、规范势、色荷空间的 SU(2) 覆盖', rx, h - 108, { color: C.pink, font: '14px sans-serif' });
    footnotes(f, [
      '分支点是使多值性出现的特殊点：绕它一周不回原值 —— 拓扑性质',
      '割线是人为的单值化切割：两岸函数值差=跳跃量（间断恰好可算）',
      '常用约定：负实轴割线 + 主值分支 —— 计算前先约定再动手',
    ]);
    heading(f, '割线不是病，是选择');
  },
});
registerViz(branchCuts);

/** P563 鞍点法与最速下降。 */
const saddlePointMethod = defineViz({
  slug: 'saddle-point-method',
  title: '鞍点法与最速下降',
  params: { scale: { type: 'range', min: 1, max: 10, default: 6, step: 1, label: '大参数 λ' } },
  draw: (f) => {
    const { w, h, params } = f;
    const lam = num(params, 'scale', 6);
    clear(f);
    // 左：复平面上的被积函数相位/模（鞍点地形示意）
    const cx = w * 0.27, cy = h * 0.44;
    // 等高线族（鞍面：x²−y² 型）
    for (let k = -4; k <= 4; k++) {
      const level = k * 0.6;
      const { ctx } = f;
      ctx.save();
      ctx.strokeStyle = level > 0 ? `rgba(245,101,101,${0.35 + level * 0.1})` : `rgba(66,153,225,${0.35 - level * 0.1})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      // 双曲线 x²−y² = c
      if (level >= 0) {
        const a = Math.sqrt(level + 0.001) * 52;
        ctx.ellipse(cx, cy, a * 1.5, a * 0.9, 0, 0, Math.PI * 2);
      } else {
        const a = Math.sqrt(-level + 0.001) * 52;
        ctx.beginPath();
        ctx.ellipse(cx, cy, a * 0.9, a * 1.5, 0, 0, Math.PI * 2);
      }
      ctx.stroke();
      ctx.restore();
    }
    // 鞍点
    dot(f, cx, cy, 9, C.yellow);
    text(f, '鞍点 z₀（∂f/∂z=0）', cx + 14, cy - 12, { color: C.yellow, font: '14px serif' });
    // 最速下降路径（穿过鞍点的沟线）
    const dep: Array<[number, number]> = [];
    const asc: Array<[number, number]> = [];
    const rot = 0.5;
    for (let i = -8; i <= 8; i++) {
      const t = i * 20;
      dep.push([cx + Math.cos(rot) * t, cy + Math.sin(rot) * t]);
      asc.push([cx + Math.cos(rot + Math.PI / 2) * t, cy + Math.sin(rot + Math.PI / 2) * t]);
    }
    poly(f, dep, { stroke: C.green, lw: 3, dash: [9, 6] });
    poly(f, asc, { stroke: C.hot, lw: 2.4, dash: [5, 5] });
    text(f, '绿虚：最速下降路（变形后穿过）', cx - 150, cy + R2() + 40, { color: C.green, font: '13px serif' });
    text(f, '红虚：最速上升路（避开）', cx - 150, cy + R2() + 66, { color: C.hot, font: '13px serif' });
    // 右侧：做法与例子
    const rx = w * 0.56;
    text(f, '大 λ 积分 I = ∫e^{λf(z)}dz 的策略：', rx, 96, { color: C.fg, font: '16px serif' });
    const steps = [
      ['① 变形围道 → 只过一个鞍点', C.cool],
      ['② 鞍点展开 f ≈ f(z₀) + ½f″(z₀)(z−z₀)²', C.yellow],
      ['③ 高斯积分收尾：I ≈ e^{λf(z₀)}·√(2π/λf″)', C.green],
    ] as Array<[string, string]>;
    steps.forEach(([s, color], i) => {
      const y = 136 + i * 66;
      poly(f, [[rx, y], [rx + 350, y], [rx + 350, y + 50], [rx, y + 50]],
        { fill: `${color}14`, stroke: `${color}bb`, lw: 1.8 });
      text(f, s, rx + 14, y + 32, { color, font: '15px serif' });
    });
    text(f, `当前 λ=${lam}：误差 ~ 1/λ = ${(100 / lam).toFixed(1)}%（λ 越大越准）`,
      rx, 136 + 3 * 66 + 16, { color: C.hot, font: '15px serif' });
    text(f, '斯特林公式 ln n! ≈ n ln n − n：最速下降的第一个战果', rx, 136 + 3 * 66 + 52, { color: C.yellow, font: '15px serif' });
    text(f, '量子场论微扰级数的渐近性、BCS 指数、路径积分半经典近似全靠它', rx, 136 + 3 * 66 + 88, { color: C.fg, font: '14px sans-serif' });
    footnotes(f, [
      '大参数下 e^{λf} 被鞍点主导：其余路径相消，只剩鞍点邻域贡献',
      '为什么变形到鞍点：沿最速下降方向相位恒定（无震荡）⇒ 可直接高斯积',
      '鞍点法给出的是渐近级数（可能发散但截断最优）—— 物理学接受"有用的近似"',
    ]);
    heading(f, '大参数积分只在鞍点贡献');
  },
});
function R2(): number { return 170; }

/** P564 围道变形的物理应用。 */
const contourDeformation = defineViz({
  slug: 'contour-deformation',
  title: '围道变形的物理应用',
  params: { which: { type: 'select', options: ['实轴极点绕行', '松原频率求和', '费曼 iε'], default: '实轴极点绕行', label: '场景' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'which', '实轴极点绕行');
    clear(f);
    const cx = w * 0.4, cy = h * 0.46;
    // 坐标轴
    seg(f, cx - w * 0.32, cy, cx + w * 0.32, cy, C.dim, 1.6);
    seg(f, cx, cy - h * 0.3, cx, cy + h * 0.3, C.dim, 1.6);
    text(f, 'Re', cx + w * 0.32 + 8, cy + 16, { color: C.dim, font: '13px serif' });
    text(f, 'Im', cx + 10, cy - h * 0.3 - 10, { color: C.dim, font: '13px serif' });
    if (kind === '实轴极点绕行') {
      // 极点在实轴上，围道从上方绕过
      [-1.4, 0.6].forEach((x0, i) => {
        dot(f, cx + x0 * w * 0.16, cy, 8, C.hot);
        text(f, `极点 ${i === 0 ? 'ωₙ' : '−ωₙ'}`, cx + x0 * w * 0.16 - 26, cy + 26, { color: C.hot, font: '13px serif' });
      });
      // 围道（上半绕行）
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 120; i++) {
        const t = -3 + (i / 120) * 6;
        const bump = 0.16 * Math.exp(-Math.pow((t + 1.4) / 0.3, 2)) + 0.16 * Math.exp(-Math.pow((t - 0.6) / 0.3, 2));
        pts.push([cx + t * w * 0.1, cy - bump * h * 0.5]);
      }
      poly(f, pts, { stroke: C.accent, lw: 3.2 });
      text(f, '围道从极点上方绕过（因果性选择）', cx - 240, cy - h * 0.26, { color: C.accent, font: '15px serif' });
      text(f, '⟹ 下方绕行 = 反因果响应（被排除）', cx - 240, cy - h * 0.26 + 30, { color: C.green, font: '14px serif' });
      text(f, '推迟/超前格林函数的全部差别：极点绕行方向', cx - 240, cy + h * 0.2, { color: C.yellow, font: '15px serif' });
    } else if (kind === '松原频率求和') {
      // 虚轴上的极点（松原频率 ω_n = 2nπT）
      for (let n = -3; n <= 3; n++) {
        const y0 = n * h * 0.075;
        dot(f, cx, cy - y0, 7, C.cool);
      }
      text(f, 'iω_n（松原频率，虚轴等距）', cx + 14, cy - h * 0.24, { color: C.cool, font: '14px serif' });
      // 围道（大半圆包住）
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 80; i++) {
        const t = Math.PI - (i / 80) * Math.PI;
        pts.push([cx + Math.cos(t) * w * 0.28, cy + Math.sin(t) * h * 0.3]);
      }
      poly(f, pts, { stroke: C.warm, lw: 3, dash: [10, 7] });
      // 留数和 → 求和公式
      text(f, 'Σ_n f(iω_n) = 围道留数和', cx - 240, cy + h * 0.24, { color: C.yellow, font: '16px serif' });
      text(f, '把"离散频率求和"变回"围道积分"再变回"实频率积分"', cx - 240, cy + h * 0.24 + 32, { color: C.fg, font: '14px serif' });
      text(f, '有限温度场论（Matsubara 求和）的日常操作', cx - 240, cy + h * 0.24 + 62, { color: C.hot, font: '14px serif' });
    } else {
      // 费曼 iε：极点微移
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 60; i++) {
        const t = -3 + (i / 60) * 6;
        pts.push([cx + t * w * 0.1, cy - Math.exp(-Math.pow(t, 2)) * 0]);
      }
      // 两个极点微移
      const eps = 0.1 + Math.sin(f.t * 2) * 0.03;
      dot(f, cx - 1.2 * w * 0.16, cy - eps * h * 0.4, 8, C.hot);
      dot(f, cx + 1.2 * w * 0.16, cy + eps * h * 0.4, 8, C.cool);
      text(f, 'ω − iε（推迟：极点下移）', cx - 1.2 * w * 0.16 - 60, cy - eps * h * 0.4 - 16, { color: C.hot, font: '13px serif' });
      text(f, 'ω + iε（超前：极点上移）', cx + 1.2 * w * 0.16 - 40, cy + eps * h * 0.4 + 30, { color: C.cool, font: '13px serif' });
      // 积分路径（沿实轴）
      seg(f, cx - w * 0.3, cy, cx + w * 0.3, cy, C.yellow, 3);
      text(f, '±iε 是"无穷小的因果方向"—— 一个符号决定整套传播子', cx - 260, cy - h * 0.24, { color: C.yellow, font: '15px serif' });
      text(f, '自由场传播子 D_F 的围道选择 = 时间序（T 乘积）', cx - 260, cy - h * 0.24 + 32, { color: C.fg, font: '14px serif' });
      text(f, '欧氏化（Wick 转动）：iε 把 Minkowski 围道旋到虚轴', cx - 260, cy + h * 0.24, { color: C.green, font: '14px serif' });
    }
    footnotes(f, [
      '围道变形不改积分值（柯西定理）—— 但极点绕行方向承载物理',
      '同一条围道：不同绕法 = 不同物理（推迟/超前、因果/反因果）',
      '松原求和、Steepest descent、Wick 转动都是围道几何的物理变形',
    ]);
    heading(f, '极点绕不绕，物理大不同');
  },
});
registerViz(contourDeformation);

/** P565 莫比乌斯变换与映射。 */
const mobiusTransform = defineViz({
  slug: 'mobius-transform',
  title: '莫比乌斯变换与映射',
  params: { abcd: { type: 'select', options: ['w = (z−i)/(z+i)', 'w = 1/z', 'w = (z+1)/(z−1)'], default: 'w = (z−i)/(z+i)', label: '变换' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'abcd', 'w = (z−i)/(z+i)');
    clear(f);
    // 左：z 平面的圆族与单位圆
    const ax = w * 0.25, ay = h * 0.44, R = 120;
    circle(f, ax, ay, R, { stroke: C.cool, lw: 2.6 });
    seg(f, ax - R - 30, ay, ax + R + 30, ay, C.dim, 1.3);
    seg(f, ax, ay - R - 30, ax, ay + R + 30, C.dim, 1.3);
    text(f, 'z 平面：单位圆与正交圆族', ax, ay - R - 42, { align: 'center', color: C.fg, font: '15px serif' });
    // 正交圆族（过 ±1 的圆）
    for (let k = -3; k <= 3; k++) {
      const { ctx } = f;
      ctx.save();
      ctx.strokeStyle = `${C.warm}99`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(ax + k * 34, ay, Math.abs(k) * 34 + 44, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // 三点标记（三点定映射）
    const three: Array<[number, number, string]> = [[1, 0, 'z₁=1'], [0, 1, 'z₂=i'], [-1, 0, 'z₃=−1']];
    three.forEach(([x, y, label]) => {
      dot(f, ax + x * R, ay - y * R, 7, C.hot);
      text(f, label, ax + x * R + 10, ay - y * R - 8, { color: C.hot, font: '13px serif' });
    });
    // 右：w 平面像（动画微调相位）
    const bx = w * 0.74;
    circle(f, bx, ay, R, { stroke: C.grid, lw: 1.6, dash: [6, 5] });
    seg(f, bx - R - 30, ay, bx + R + 30, ay, C.dim, 1.3);
    seg(f, bx, ay - R - 30, bx, ay + R + 30, C.dim, 1.3);
    text(f, 'w 平面：圆变圆、直角保持', bx, ay - R - 42, { align: 'center', color: C.yellow, font: '15px serif' });
    const mapFn = (x: number, y: number): [number, number] => {
      if (kind === 'w = (z−i)/(z+i)') {
        // (z-i)/(z+i)
        const dr = x, di = y - 1;
        const dd = x, di2 = y + 1;
        const den = dd * dd + di2 * di2 + 1e-9;
        return [(dr * dd + di * di2) / den, (di * dd - dr * di2) / den];
      }
      if (kind === 'w = 1/z') {
        const den = x * x + y * y + 1e-9;
        return [x / den, -y / den];
      }
      // (z+1)/(z-1)
      const dr = x + 1, di = y;
      const dd = x - 1, di2 = y;
      const den = dd * dd + di2 * di2 + 1e-9;
      return [(dr * dd + di * di2) / den, (di * dd - dr * di2) / den];
    };
    // 像曲线：单位圆
    const img: Array<[number, number]> = [];
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      const [u, v0] = mapFn(Math.cos(a) * 0.98, Math.sin(a) * 0.98);
      img.push([bx + u * R * 1.4, ay - v0 * R * 1.4]);
    }
    poly(f, img, { stroke: C.cool, lw: 2.6 });
    // 正交圆族的像
    for (let k = -3; k <= 3; k++) {
      const p: Array<[number, number]> = [];
      for (let i = 0; i <= 100; i++) {
        const a = (i / 100) * Math.PI * 2;
        const zx = ax === 0 ? 0 : Math.cos(a) * (Math.abs(k) * 34 + 44) + k * 34;
        const zy = Math.sin(a) * (Math.abs(k) * 34 + 44);
        const nzx = (zx - w * 0.25) / R, nzy = -(zy - h * 0.44) / R;
        const [u, v0] = mapFn(nzx, nzy);
        if (!Number.isFinite(u) || Math.abs(u) > 6) { if (p.length > 1) poly(f, p, { stroke: `${C.warm}88`, lw: 1.5 }); p.length = 0; continue; }
        p.push([bx + u * R * 1.4, ay - v0 * R * 1.4]);
      }
      if (p.length > 1) poly(f, p, { stroke: `${C.warm}88`, lw: 1.5 });
    }
    text(f, kind, bx, ay + R + 36, { align: 'center', color: C.yellow, font: '16px serif' });
    text(f, '三点唯一确定一个莫比乌斯变换；交比是它的不变量', 56, h - 130, { color: C.fg, font: '16px serif' });
    text(f, '狭义相对论的速度合成 w = (u+v)/(1+uv/c²) 就是它（快度相加的线性化）', 56, h - 100, { color: C.hot, font: '15px serif' });
    text(f, '庞加莱圆盘模型：双曲几何的载体 —— 保圆变换群=共形群的一半', 56, h - 70, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '莫比乌斯变换 = 分式线性：复平面上"圆保持"的全部共形自同构',
      '群结构：变换的复合仍是莫比乌斯型（构成群）—— 三维旋转的复数亲戚',
      '应用：速度合成、激光腔模式匹配、图像圆柱化校正、双曲几何',
    ]);
    heading(f, '圆变圆、三点定映射');
  },
});
registerViz(mobiusTransform);