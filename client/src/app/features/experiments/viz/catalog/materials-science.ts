import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, circle, curve, dot, footnotes, grid, heading, poly, seg, text, view, rng, vec } from '../canvas';

/** 误差函数（Abramowitz-Stegun 有理逼近，用于菲克扩散剖面）。 */
function erf(x: number): number {
  const s = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return s * y;
}

/** 二元相图与吉布斯自由能。 */
const phaseDiagram = defineViz({
  slug: 'phase-diagram', title: '二元相图与吉布斯自由能', animated: true,
  params: { temp: { type: 'range', min: 300, max: 1400, default: 900, step: 20, label: '温度 (℃)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const T = num(params, 'temp', 900);
    clear(f);
    // 左：自由能曲线（两相 + 混合）
    const v = view(f, { xMin: 0, xMax: 1, yMin: -0.6, yMax: 0.6, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 5, ticks: true });
    const mix = (T - 300) / 1100;
    const ga = (x: number) => 0.4 - 0.5 * mix * (x * Math.log(Math.max(1e-6, x)) + (1 - x) * Math.log(Math.max(1e-6, 1 - x))) * 0.4 + (x - 0.05) * 0.9;
    const gb = (x: number) => 0.4 - 0.5 * mix * (x * Math.log(Math.max(1e-6, x)) + (1 - x) * Math.log(Math.max(1e-6, 1 - x))) * 0.4 - (x - 0.95) * 0.9;
    const gm = (x: number) => Math.min(ga(x), gb(x)) - mix * 0.16 * (x * Math.log(Math.max(1e-6, x)) + (1 - x) * Math.log(Math.max(1e-6, 1 - x))) * 0.5 - 0.12;
    const pa: [number, number][] = [], pm: [number, number][] = [];
    for (let i = 1; i < 200; i++) {
      const x = i / 200;
      pa.push([v.sx(x), v.sy(Math.max(-0.58, Math.min(0.58, x < 0.5 ? ga(x) : gb(x))))]);
      pm.push([v.sx(x), v.sy(Math.max(-0.58, Math.min(0.58, gm(x))))]);
    }
    poly(f, pm, { stroke: C.green, lw: 3.4 });
    // 公切线
    const t1 = 0.22, t2 = 0.78;
    const y1 = gm(t1), y2 = gm(t2);
    seg(f, v.sx(0.05), v.sy(y1 + (y2 - y1) * (0.05 - t1) / (t2 - t1)), v.sx(0.95), v.sy(y1 + (y2 - y1) * (0.95 - t1) / (t2 - t1)),
      C.warm, 2.4, );
    dot(f, v.sx(t1), v.sy(y1), 7, C.warm);
    dot(f, v.sx(t2), v.sy(y2), 7, C.warm);
    text(f, '公切线：切点即两相成分', v.sx(0.3), v.sy(0.5), { color: C.warm, font: '12px sans-serif' });
    text(f, '成分 →（A-B）', w * 0.44, h - 86, { color: C.dim, font: '11px sans-serif' });
    // 右：相图（温度-成分）
    const u = view(f, { xMin: 0, xMax: 1, yMin: 300, yMax: 1400, inset: 46, insetBottom: 96 });
    const shift = mix * 0.1;
    const liq: [number, number][] = [];
    for (let i = 0; i <= 100; i++) {
      const x = i / 100;
      const y = 1400 - 400 * (4 * x * (1 - x)) - shift * 100 * Math.sin(x * Math.PI);
      liq.push([u.sx(x), u.sy(y)]);
    }
    poly(f, liq, { stroke: C.hot, lw: 3 });
    // 固相线与两相区
    const sol: [number, number][] = [];
    for (let i = 0; i <= 100; i++) {
      const x = i / 100;
      const y = 1400 - 430 * (4 * x * (1 - x)) + 60;
      sol.push([u.sx(x), u.sy(y)]);
    }
    poly(f, sol, { stroke: C.cool, lw: 3, dash: [7, 5] });
    text(f, '液相 L', u.sx(0.5), u.sy(1320), { color: C.hot, font: '13px sans-serif' });
    text(f, '固相 α', u.sx(0.5), u.sy(460), { color: C.cool, font: '13px sans-serif' });
    text(f, 'L+α 两相区', u.sx(0.14), u.sy(1140), { color: C.warm, font: '12px sans-serif' });
    // 当前温度线
    seg(f, u.sx(0), u.sy(T), u.sx(1), u.sy(T), `rgba(72,187,120,${0.6 + 0.3 * Math.sin(f.t * 2)})`, 2.4, );
    text(f, `${T} ℃`, u.sx(0.02), u.sy(T) - 8, { color: C.green, font: '12px sans-serif' });
    text(f, `${T}℃ 下：自由能曲线的公切线切出相区——相图就是这么画出来的`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '成分 →', w - 110, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '温度 (℃)', w * 0.56, h - 118, { color: C.dim, font: '11px sans-serif' });
    footnotes(f, [
      '杠杆规则读两相比例——铸件里先共晶还是共晶全在图上',
      '相图默认平衡：快冷会冻结高温相，亚稳态是另一张图',
      'CALPHAD 用热力学数据库算多元相图——材料设计走向计算',
    ]);
    heading(f, '相图：材料的地图');
  },
});
registerViz(phaseDiagram);

/** 铁碳相图与珠光体。 */
const ironCarbonDiagram = defineViz({
  slug: 'iron-carbon-diagram', title: '铁碳相图与珠光体', animated: true,
  params: { carbon: { type: 'range', min: 0, max: 4, default: 0.77, step: 0.05, label: '含碳量 (wt%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const c = num(params, 'carbon', 0.77);
    clear(f);
    const v = view(f, { xMin: 0, xMax: 6.7, yMin: 400, yMax: 1600, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 7, ticks: true });
    // 关键线（示意）
    const lines: [number[][], string, string][] = [
      [[[0, 1538], [0.17, 1495], [2.11, 1148], [4.3, 1148], [6.7, 1148]], C.hot, '液相线'],
      [[[0, 912], [0.77, 727], [2.11, 727], [4.3, 727], [6.7, 727]], C.cool, '共析线 A₁'],
      [[[0, 912], [0.77, 727]], C.green, 'A₃'],
      [[[2.11, 1148], [2.11, 727]], C.warm, '钢/铸铁分界'],
      [[[4.3, 1148], [4.3, 727]], '#9254de', '共晶点'],
    ];
    for (const [pts, color] of lines) {
      const sp: [number, number][] = pts.map(([x, y]) => [v.sx(x), v.sy(y)] as [number, number]);
      if (sp.length > 1) poly(f, sp, { stroke: color, lw: 2.6 });
    }
    // 相区标注
    text(f, 'γ 奥氏体', v.sx(1.0), v.sy(1000), { color: C.cool, font: '13px sans-serif' });
    text(f, 'α 铁素体', v.sx(0.08), v.sy(600), { color: C.green, font: '12px sans-serif' });
    text(f, '液相', v.sx(3.4), v.sy(1480), { color: C.hot, font: '13px sans-serif' });
    text(f, 'Fe₃C（渗碳体）', v.sx(5.4), v.sy(600), { color: '#9254de', font: '12px sans-serif' });
    // 共析点
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 2);
    dot(f, v.sx(0.77), v.sy(727), 8, `rgba(236,201,75,${pulse})`);
    text(f, '共析 0.77% → 珠光体', v.sx(0.77) + 12, v.sy(727) - 10, { color: C.yellow, font: '12px sans-serif' });
    // 当前成分线
    seg(f, v.sx(c), v.sy(400), v.sx(c), v.sy(1600), `rgba(72,187,120,0.75)`, 2.4, );
    const mat = c < 0.0218 ? '工业纯铁' : c < 2.11 ? (c < 0.77 ? '亚共析钢' : c > 0.77 ? '过共析钢' : '共析钢') : c < 4.3 ? '亚共晶白口铁' : '过共晶白口铁';
    text(f, `${c.toFixed(2)}% C → ${mat}`, v.sx(Math.min(c + 0.1, 4.4)), v.sy(1560), { color: C.green, font: '13px sans-serif' });
    // 珠光体层状组织（右下角示意）
    const ox = w - 220, oy = h - 156;
    poly(f, [[ox, oy], [ox + 190, oy], [ox + 190, oy + 92], [ox, oy + 92]],
      { stroke: `${C.grid}cc`, lw: 1.6, fill: 'rgba(26,32,44,0.85)' });
    for (let k = 0; k < 8; k++) {
      const y = oy + 6 + k * 11;
      seg(f, ox + 4, y, ox + 186, y, k % 2 === 0 ? C.cool : '#9254de', 4.4);
    }
    text(f, '珠光体：铁素体+渗碳体层状', ox + 6, oy + 108, { color: C.dim, font: '10px sans-serif' });
    text(f, `${c.toFixed(2)}% C：相图决定组织、组织决定性能——热处理全靠它导航`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '温度 (℃) →', w - 130, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '含碳量 →（wt%）', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    footnotes(f, [
      '0.77% 共析点急冷得珠光体——层片间距越小强度越高',
      '2.11% 是钢与铸铁的分界——铸造性与可锻性在此换挡',
      '从锻打到淬火，几千年的经验最终都写进了这一张图',
    ]);
    heading(f, '铁碳相图：工业文明的骨架图');
  },
});
registerViz(ironCarbonDiagram);

/** 成分过冷与凝固。 */
const constitutionalSupercooling = defineViz({
  slug: 'constitutional-supercooling', title: '成分过冷与凝固', animated: true,
  params: { gOverR: { type: 'range', min: 0.2, max: 4, default: 1, step: 0.1, label: 'G/R（梯度/速率）' } },
  draw: (f) => {
    const { w, h, params } = f;
    const gOverR = num(params, 'gOverR', 1);
    const stable = gOverR > 2;
    clear(f);
    // 界面形貌（稳定平面 vs 枝晶）
    const mid = h * 0.5;
    poly(f, [[0, mid], [w, mid], [w, h - 90], [0, h - 90]],
      { stroke: 'transparent', fill: 'rgba(100,116,139,0.28)' });
    poly(f, [[0, 90], [w, 90], [w, mid], [0, mid]],
      { stroke: 'transparent', fill: 'rgba(66,153,225,0.14)' });
    text(f, '液相（上方）', 40, 116, { color: C.cool, font: '12px sans-serif' });
    text(f, '固相（下方）', 40, h - 108, { color: C.dim, font: '12px sans-serif' });
    if (stable) {
      seg(f, 0, mid, w, mid, C.green, 5);
      text(f, 'G/R 足够大：平界面稳定推进', 40, mid - 16, { color: C.green, font: '13px sans-serif' });
    } else {
      // 枝晶/胞晶生长
      const n = 7;
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) * (w / n);
        const amp = (2 - gOverR) * 46;
        const pts: [number, number][] = [];
        for (let k = 0; k <= 24; k++) {
          const t = k / 24;
          pts.push([x + Math.sin(t * Math.PI * 2 + f.t + i) * amp * t * 0.5, mid - t * amp * 2.2]);
        }
        poly(f, pts, { stroke: C.warm, lw: 4.6 });
        // 二次枝晶臂
        for (let s = 1; s <= 4; s++) {
          const y = mid - s * (amp * 1.1);
          seg(f, x - amp * 0.6, y, x + amp * 0.6, y, `rgba(237,137,54,0.75)`, 3);
        }
      }
      text(f, `G/R=${gOverR.toFixed(1)}：成分过冷失稳——平面 → 胞状 → 枝晶`, 40, mid - 16, { color: C.warm, font: '13px sans-serif' });
    }
    // 溶质堆积示意（界面液侧）
    const rand = rng(51);
    for (let i = 0; i < 50; i++) {
      const x = rand() * w;
      const y = mid + 6 + rand() * 60 * (1 - gOverR / 4);
      const near = 1 - Math.abs(x - w / 2) / (w / 2);
      if (rand() < near * 0.8) dot(f, x, y - 30 * (1 - gOverR / 4), 3.6, `rgba(245,101,101,${0.35 + rand() * 0.4})`);
    }
    text(f, '红点：被界面排出的溶质在液侧堆积 → 液相线抬升', 40, h - 66, { color: C.hot, font: '12px sans-serif' });
    text(f, `失稳判据 G/R < m·C₀(1−k)/(kD)：当前 ${stable ? '不满足——平面推进' : '满足——界面失稳长出枝晶'}`,
      30, 44, { color: stable ? C.green : C.hot, font: '13px sans-serif' });
    footnotes(f, [
      '溶质再分配是祸根：界面推着杂质走，前方液体被自己拖到过冷',
      '枝晶臂间距决定偏析尺度——后续均匀化退火要花的时间由此估算',
      '定向凝固单晶叶片正是在压制枝晶分叉中铸成——Tiller 理论的工程化',
    ]);
    heading(f, '成分过冷：平界面的失稳');
  },
});
registerViz(constitutionalSupercooling);

/** 晶体生长与区域提纯。 */
const czochralski = defineViz({
  slug: 'czochralski', title: '晶体生长与区域提纯', animated: true,
  params: { pull: { type: 'range', min: 0.5, max: 10, default: 3, step: 0.5, label: '提拉速率 (mm/min)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const pull = num(params, 'pull', 3);
    clear(f);
    const cx = w * 0.4;
    // 坩埚与熔体
    poly(f, [[cx - 130, h * 0.56], [cx + 130, h * 0.56], [cx + 108, h - 96], [cx - 108, h - 96]],
      { stroke: C.dim, lw: 3, fill: 'rgba(100,116,139,0.35)' });
    poly(f, [[cx - 124, h * 0.62], [cx + 124, h * 0.62], [cx + 106, h - 100], [cx - 106, h - 100]],
      { stroke: 'transparent', fill: 'rgba(237,137,54,0.5)' });
    text(f, '硅熔体（1420℃）', cx - 62, h * 0.66, { color: '#fff', font: '12px sans-serif' });
    text(f, '石英坩埚', cx + 140, h * 0.6, { color: C.dim, font: '11px sans-serif' });
    // 籽晶与晶锭（生长动画）
    const grow = ((f.t * pull * 0.6) % 100) / 100;
    const ingotLen = 60 + grow * 180;
    const topY = h * 0.56 - ingotLen;
    poly(f, [[cx - 40, topY], [cx + 40, topY], [cx + 52, h * 0.58], [cx - 52, h * 0.58]],
      { stroke: C.cool, lw: 3, fill: 'rgba(66,153,225,0.5)' });
    // 籽晶杆
    seg(f, cx, topY - 70, cx, topY, C.dim, 5);
    text(f, '籽晶（定晶向）', cx + 60, topY + 4, { color: C.cool, font: '11px sans-serif' });
    // 弯液面
    const meniscus = 0.5 + 0.5 * Math.sin(f.t * 3);
    seg(f, cx - 52, h * 0.58, cx + 52, h * 0.58, `rgba(236,201,75,${0.5 + meniscus * 0.5})`, 5);
    text(f, '弯液面（直径控制的观测点）', cx + 60, h * 0.6, { color: C.yellow, font: '11px sans-serif' });
    // 旋转箭头
    const a = f.t * 2;
    const arr: [number, number][] = [];
    for (let i = 0; i <= 20; i++) {
      const t = (i / 20) * Math.PI * 1.4;
      arr.push([cx - 80 + Math.cos(t + a) * 34, topY - 40 + Math.sin(t + a) * 12]);
    }
    poly(f, arr, { stroke: C.green, lw: 2.6 });
    text(f, '旋转（均匀热场）', cx - 160, topY - 46, { color: C.green, font: '11px sans-serif' });
    // 右侧：区域提纯小图
    const rx = w * 0.78;
    text(f, '区域提纯：熔区扫过，杂质留在熔中', rx - 120, h * 0.34, { color: C.warm, font: '12px sans-serif' });
    poly(f, [[rx - 110, h * 0.4], [rx + 110, h * 0.4], [rx + 110, h * 0.52], [rx - 110, h * 0.52]],
      { stroke: C.dim, lw: 2.4, fill: 'rgba(100,116,139,0.4)' });
    const zoneX = rx - 90 + ((f.t * 60) % 180);
    poly(f, [[zoneX - 30, h * 0.4], [zoneX + 30, h * 0.4], [zoneX + 24, h * 0.52], [zoneX - 24, h * 0.52]],
      { stroke: 'transparent', fill: 'rgba(237,137,54,0.75)' });
    text(f, '熔区（杂质跟着走）', zoneX - 52, h * 0.56, { color: C.warm, font: '10px sans-serif' });
    // 杂质分布
    for (let i = 0; i < 30; i++) {
      const t = i / 30;
      const impurity = Math.min(1, Math.exp(-(1 - t) * 3 + 0.4));
      dot(f, rx - 105 + t * 210, h * 0.46, 3.4, `rgba(245,101,101,${impurity * 0.85})`);
    }
    text(f, `提拉 ${pull} mm/min：${pull > 6 ? '过快易产生位错与杂质包裹' : '匀速慢拉——直径与完美度的平衡'}`,
      30, 44, { color: pull > 6 ? C.warm : C.cyan, font: '13px sans-serif' });
    text(f, '直拉法产衬底、区熔法提纯——芯片的原料由此而来', 30, h - 66, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      'Czochralski 1916 年的偶然发明——今天每块硅片都在讲这个故事',
      '分凝系数决定杂质去向：反复熔区可把纯度推到 99.9999999%',
      '无位错硅锭是器件良率的起点——晶向、氧碳含量都要在线监控',
    ]);
    heading(f, '晶体生长：把熔体拉成秩序');
  },
});
registerViz(czochralski);

/** 位错与塑性滑移。 */
const dislocationSlip = defineViz({
  slug: 'dislocation-slip', title: '位错与塑性滑移', animated: true,
  params: { stress: { type: 'range', min: 0, max: 100, default: 55, step: 5, label: '切应力 (% 极限)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const stress = num(params, 'stress', 55);
    clear(f);
    const rows = 7, cols = 16;
    const cell = Math.min((w - 160) / cols, 34);
    const ox = 90, oy = h * 0.3;
    // 原子列（中间插入半原子面 = 刃位错）
    const extraCol = 8;
    const shift = (f.t * 0.6) % 1;
    const move = stress > 10 ? ((f.t * stress / 100) % cols) : 0;
    for (let r = 0; r < rows; r++) {
      const below = r >= rows / 2;
      for (let c = -1; c <= cols; c++) {
        let x = ox + (c + (below ? 0.18 : 0)) * cell;
        // 位错核心附近的畸变
        const coreC = Math.floor(move) + (below ? 0 : 1);
        const d = c - coreC;
        if (Math.abs(d) < 3) x += (d / 3) * (below ? -14 : 14) * (1 - stress / 160);
        const y = oy + r * cell + (Math.abs(d) < 2 && r === Math.floor(rows / 2) - 1 ? 4 : 0);
        if (x > ox - 40 && x < ox + cols * cell + 40) {
          const near = Math.abs(d) < 2 && r >= Math.floor(rows / 2) - 1 && r <= Math.floor(rows / 2);
          dot(f, x, y, 7.4, near ? C.warm : `rgba(66,153,225,${stress > 60 ? 0.85 : 0.7})`);
        }
      }
      // 位错符号
      if (r === Math.floor(rows / 2) - 1) {
        const coreX = ox + (Math.floor(move) + 0.5) * cell;
        text(f, '⊥', coreX - 7, oy + r * cell + cell + 14, { color: C.hot, font: '16px sans-serif' });
      }
    }
    text(f, '⊥：多余的半原子面——位错线就是塑性的载体', 90, oy - 44, { color: C.hot, font: '13px sans-serif' });
    // 应力箭头
    vec(f, 44, oy + 40, 44, oy + rows * cell - 30, C.warm, 3.6);
    vec(f, w - 44, oy + rows * cell - 30, w - 44, oy + 40, C.warm, 3.6);
    text(f, '切应力', 34, oy + 26, { color: C.warm, font: '11px sans-serif' });
    // 伯氏矢量
    const bx = 90, by = oy + rows * cell + 46;
    vec(f, bx, by, bx + cell, by, C.green, 3.4);
    text(f, `伯氏矢量 b = ${cell.toFixed(0)} px（位错扫过一步，上方相对下方滑一个 b）`, bx + cell + 12, by + 5,
      { color: C.green, font: '12px sans-serif' });
    text(f, `应力 ${stress}%：${stress > 60 ? '位错快速扫过——宏观屈服正在发生' : stress > 15 ? '位错蠕动——塑性缓慢累积' : '弹性阶段——位错被钉扎不动'}`,
      30, 44, { color: stress > 60 ? C.cyan : C.warm, font: '13px sans-serif' });
    text(f, '若整层原子同时滑移需理论强度千倍的应力——位错把这条路拆成小步', 30, h - 66, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      'Taylor、Orowan 与 Polanyi 1934 年提出位错——解释金属为何又软又可强化',
      '位错密度随形变上升并互相缠结——加工硬化的微观图景',
      '透射电镜直接拍到位错滑移——理论与显微互证的范例',
    ]);
    heading(f, '位错：塑性的原子级载体');
  },
});
registerViz(dislocationSlip);

/** 佩尔斯-纳巴罗应力。 */
const peierlsNabarro = defineViz({
  slug: 'peierls-nabarro', title: '佩尔斯-纳巴罗应力', animated: true,
  params: { width: { type: 'range', min: 1, max: 8, default: 4, step: 0.5, label: '位错宽度 w/b' } },
  draw: (f) => {
    const { w, h, params } = f;
    const wd = num(params, 'width', 4);
    clear(f);
    // 点阵周期势 + 位错能量曲线
    const v = view(f, { xMin: -6, xMax: 6, yMin: -1.2, yMax: 1.6, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    // 周期势（底）
    const pot: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const x = -6 + (i / 300) * 12;
      pot.push([v.sx(x), v.sy(-0.9 + 0.16 * Math.cos(x * Math.PI * 1.2))]);
    }
    poly(f, pot, { stroke: `${C.dim}aa`, lw: 2.4 });
    text(f, '晶格周期势（位错移动要翻越的锯齿）', v.sx(-5.6), v.sy(-1.1), { color: C.dim, font: '11px sans-serif' });
    // 位错核心剖面（错配分布）
    const prof: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const x = -6 + (i / 300) * 12;
      const y = Math.tanh(x / Math.max(0.4, wd / 2));
      prof.push([v.sx(x), v.sy(y * 0.85)]);
    }
    poly(f, prof, { stroke: C.accent, lw: 3.4 });
    text(f, '错配分布 tanh(x/w)：位错核心', v.sx(-5.6), v.sy(1.1), { color: C.accent, font: '11px sans-serif' });
    // 移动中的能量起伏
    const shift = Math.sin(f.t * 1.2) * 1.6;
    const barrier: [number, number][] = [];
    for (let i = 0; i <= 200; i++) {
      const x = -6 + (i / 200) * 12;
      barrier.push([v.sx(x), v.sy(0.2 + 0.35 * Math.exp(-Math.pow((x - shift) / wd, 2)) * Math.abs(Math.cos(shift * Math.PI * 1.2)))]);
    }
    poly(f, barrier, { stroke: `rgba(245,101,101,${0.6 + 0.3 * Math.sin(f.t * 3)})`, lw: 3 });
    dot(f, v.sx(shift), v.sy(0.55), 8, C.warm);
    // P-N 应力 vs 宽度（右下角）
    const bx = w * 0.62, by = h - 168;
    text(f, 'τ_PN ∝ exp(−2πw/(1−ν)b)', bx, by - 10, { color: C.cyan, font: '13px sans-serif' });
    const pn: [number, number][] = [];
    for (let i = 0; i <= 100; i++) {
      const ww = 1 + (i / 100) * 7;
      pn.push([bx + (i / 100) * 220, by + 66 - Math.exp((-2 * Math.PI * ww) / 5) * 56]);
    }
    poly(f, pn, { stroke: C.green, lw: 3 });
    dot(f, bx + ((wd - 1) / 7) * 220, by + 66 - Math.exp((-2 * Math.PI * wd) / 5) * 56, 7, C.warm);
    text(f, '宽位错 → 低点阵阻力 → 易滑移', bx, by + 92, { color: C.dim, font: '11px sans-serif' });
    text(f, `当前 w/b=${wd.toFixed(1)}：位错越宽越"胖"，晶格摩擦越小`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, 'P-N 应力随温度指数下降——体心立方金属的低温脆性由此解释', 30, h - 66, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '连续介质弹性与晶格周期势的杂交模型——多尺度力学的第一级台阶',
      '窄位错（共价键、BCC）点阵阻力大——滑移难、解理易、易脆断',
      '压力容器钢的低温韧性红线，源头就在这条指数式里',
    ]);
    heading(f, 'P-N 应力：晶格对位错的摩擦税');
  },
});
registerViz(peierlsNabarro);

/** 霍尔-佩奇强化。 */
const hallPetch = defineViz({
  slug: 'hall-petch', title: '霍尔-佩奇强化', animated: true,
  params: { grain: { type: 'range', min: 10, max: 500, default: 50, step: 10, label: '晶粒直径 d (μm)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const d = num(params, 'grain', 50);
    clear(f);
    // 左：晶粒组织（Voronoi 近似）
    const rand = rng(88);
    const seeds: [number, number][] = [];
    const nG = Math.max(6, Math.round(3000 / d));
    for (let i = 0; i < nG; i++) seeds.push([60 + rand() * (w * 0.44), 100 + rand() * (h - 250)]);
    // 用色块近似：每个种子画一圈
    for (const [sx, sy] of seeds) {
      const pts: [number, number][] = [];
      for (let k = 0; k <= 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const rr = (w * 0.44) / Math.sqrt(nG) * (0.6 + rand() * 0.5);
        pts.push([sx + Math.cos(a) * rr, sy + Math.sin(a) * rr]);
      }
      poly(f, pts, { stroke: `${C.grid}cc`, lw: 1.8, fill: `rgba(66,153,225,${0.12 + rand() * 0.14})` });
    }
    text(f, `${d} μm 晶粒组织`, 66, 84, { color: C.cyan, font: '12px sans-serif' });
    // 位错塞积（晶界处）
    for (let k = 0; k < Math.min(6, Math.round(60 / d * 3)); k++) {
      text(f, '⊥⊥⊥', 76 + k * 4, 140 + k * 22, { color: C.hot, font: '13px sans-serif' });
    }
    text(f, '位错在晶界前塞积', 66, h - 118, { color: C.hot, font: '11px sans-serif' });
    // 右：Hall-Petch 曲线
    const v = view(f, { xMin: 0, xMax: 1.1, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    // x = 1/√d（归一）
    const kyp: [number, number][] = [];
    for (let i = 2; i <= 200; i++) {
      const dd = 10 + (i / 200) * 490;
      const inv = 1 / Math.sqrt(dd / 10) / (1 / Math.sqrt(1 / 500)) * 0.0 + (1 / Math.sqrt(dd)) * 8.9;
      kyp.push([v.sx(Math.min(1.05, inv / 2.0)), v.sy(Math.min(1.05, 0.3 + inv * 0.36))]);
    }
    poly(f, kyp, { stroke: C.green, lw: 3.4 });
    // 当前点
    const xNow = Math.min(1.05, (1 / Math.sqrt(d)) * 8.9 / 2.0);
    const yNow = 0.3 + (1 / Math.sqrt(d)) * 8.9 * 0.36;
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
    dot(f, v.sx(xNow), v.sy(Math.min(1.05, yNow)), 9, `rgba(237,137,54,${pulse})`);
    // 纳米晶反常区
    poly(f, [[v.sx(0.94), v.sy(0)], [v.sx(1.05), v.sy(0)], [v.sx(1.05), v.sy(1.1)], [v.sx(0.94), v.sy(1.1)]],
      { stroke: 'transparent', fill: 'rgba(146,84,222,0.14)' });
    text(f, '纳米晶：可能反常软化', v.sx(0.94) + 4, v.sy(1.03), { color: '#9254de', font: '10px sans-serif' });
    text(f, 'σ_y = σ₀ + k_y/√d：斜率量出晶界的阻碍力', 56, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '1/√d →', w - 110, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '屈服强度', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    text(f, `当前 d=${d} μm：${d > 200 ? '粗晶——强度低、塑性好' : d < 30 ? '细晶——强韧兼得（少数双赢手段）' : '常规工程晶粒'}`,
      30, h - 66, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      'Hall（1951）与 Petch（1953）给出最简明的强化经验律',
      '晶界挡位错、塞积传应力——晶粒越细需要的启动应力越高',
      '细晶强化钢与纳米晶涂层——唯一同时强化又增韧的手段',
    ]);
    heading(f, '霍尔-佩奇：界墙越多越结实');
  },
});
registerViz(hallPetch);

/** 固溶与沉淀强化。 */
const solidSolutionStrengthening = defineViz({
  slug: 'solid-solution-strengthening', title: '固溶与沉淀强化', animated: true,
  params: { mode: { type: 'select', options: ['固溶强化', '沉淀强化（Orowan）'], default: '沉淀强化（Orowan）', label: '机制' } },
  draw: (f) => {
    const { w, h, params } = f;
    const orowan = String((params as Record<string, unknown>)['mode'] ?? '').includes('Orowan');
    clear(f);
    const oy = h * 0.42;
    // 位错线（穿过画面）
    const line: [number, number][] = [];
    const rand = rng(orowan ? 21 : 7);
    const pinXs: number[] = [];
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const x = 60 + t * (w - 120);
      let y = oy + Math.sin(t * Math.PI * 3 + f.t * 1.4) * 8;
      if (orowan) {
        // 位错在粒子间弓出
        const px0 = w * 0.36, px1 = w * 0.6;
        const bow = Math.sin(t * Math.PI) ;
        if (x > px0 && x < px1) y += Math.sin(((x - px0) / (px1 - px0)) * Math.PI) * 34 * (0.6 + 0.4 * Math.sin(f.t * 2));
      } else {
        y += (rand() - 0.5) * 5;
      }
      line.push([x, y]);
    }
    poly(f, line, { stroke: C.hot, lw: 4.4 });
    if (orowan) {
      // 沉淀粒子
      for (const px of [w * 0.36, w * 0.6]) {
        circle(f, px, oy, 26, { stroke: C.cool, lw: 3.4, fill: 'rgba(66,153,225,0.45)' });
        dot(f, px, oy, 6, C.green);
      }
      text(f, '第二相粒子钉扎位错——绕过去需要更高应力', w * 0.3, oy - 64, { color: C.cool, font: '13px sans-serif' });
      text(f, 'Orowan 弯曲：粒子越细密越难绕', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    } else {
      // 溶质原子（畸变场）
      for (let i = 0; i < 14; i++) {
        const sx = 70 + rand() * (w - 160);
        const sy = oy - 60 + rand() * 130;
        const big = rand() > 0.5;
        circle(f, sx, sy, 11, { stroke: big ? C.warm : C.cool, lw: 2.4, fill: big ? 'rgba(237,137,54,0.4)' : 'rgba(66,153,225,0.4)' });
        // 畸变场
        circle(f, sx, sy, 19, { stroke: `${big ? C.warm : C.cool}55`, lw: 1.4, dash: [3, 3] });
        // 位错被局部牵拉
        void sy;
      }
      text(f, '溶质原子的晶格畸变牵住位错——点障碍随机散布', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    }
    // 强化量对比条
    const by = h - 130;
    const bars: [string, number, string][] = orowan
      ? [['Orowan 绕过（细密析出）', 0.85, C.cool], ['切过机制（共格析出）', 0.55, C.warm]]
      : [['固溶强化', 0.4, C.warm], ['纯金属基线', 0.14, C.dim]];
    bars.forEach(([name, val, color], i) => {
      const y = by + i * 40;
      text(f, name, 60, y, { color, font: '12px sans-serif' });
      poly(f, [[60, y + 8], [60 + val * (w - 160), y + 8], [60 + val * (w - 160), y + 30], [60, y + 30]],
        { stroke: 'transparent', fill: `${color}cc` });
    });
    text(f, orowan ? '粒子间距越小 → 绕过应力越大 → 强度越高' : '溶质浓度与尺寸差越大 → 畸变越强 → 强度越高',
      30, h - 66, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '铝铜合金时效硬化让飞机蒙皮既轻又强——杜拉铝的看家本领',
      '高温合金的 γ′ 沉淀相撑住涡轮叶片——航空发动机的材料基石',
      '过时效会让析出相粗化失去阻挡力——热处理窗口就是工艺诀窍',
    ]);
    heading(f, '固溶与沉淀：给位错设路障');
  },
});
registerViz(solidSolutionStrengthening);

/** 扩散与菲克定律。 */
const fickDiffusion = defineViz({
  slug: 'fick-diffusion', title: '扩散与菲克定律', animated: true,
  params: { temp: { type: 'range', min: 300, max: 1200, default: 600, step: 25, label: '温度 (K)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const T = num(params, 'temp', 600);
    clear(f);
    // 左：浓度剖面随时间演化
    const v = view(f, { xMin: 0, xMax: 10, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    const D = Math.exp(-8000 / T) * 10; // 有效扩散深度
    const tau = ((f.t * 0.35) % 1.6) + 0.1;
    const prof: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const x = (i / 300) * 10;
      const y = 0.5 * (1 - erf(x / (2 * Math.sqrt(Math.max(0.02, D * tau)))));
      prof.push([v.sx(x), v.sy(Math.max(0, y))]);
    }
    poly(f, prof, { stroke: C.accent, lw: 3.4 });
    // 初始阶跃（虚线）
    poly(f, [[v.sx(0), v.sy(1)], [v.sx(0.02), v.sy(1)], [v.sx(0.02), v.sy(0)], [v.sx(10), v.sy(0)]],
      { stroke: `${C.dim}aa`, lw: 2, dash: [6, 5] });
    text(f, '虚线=初始浓度阶跃；实线=扩散后剖面', 56, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '深度 →', w * 0.44, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '浓度 C', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    // 右：阿伦尼乌斯图
    const bx = w * 0.62, by = h * 0.36;
    text(f, 'D = D₀·exp(−Q/RT)', bx, by - 16, { color: C.warm, font: '13px sans-serif' });
    const arrPts: [number, number][] = [];
    for (let i = 0; i <= 100; i++) {
      const tt = 300 + (i / 100) * 900;
      const dd = Math.exp(-8000 / tt);
      arrPts.push([bx + (i / 100) * 240, by + 120 - dd * 110]);
    }
    poly(f, arrPts, { stroke: C.green, lw: 3 });
    const dNow = Math.exp(-8000 / T);
    dot(f, bx + ((T - 300) / 900) * 240, by + 120 - dNow * 110, 8, C.warm);
    text(f, `T=${T}K → D 相对值 ${dNow.toFixed(3)}`, bx + 10, by + 150, { color: C.warm, font: '12px sans-serif' });
    text(f, '温度每升 10℃，扩散大约翻倍——热激活跳过势垒', 30, h - 66, { color: C.cyan, font: '12px sans-serif' });
    footnotes(f, [
      '菲克 1855 年的定律把质量传输写成与热传导同构的方程',
      '渗碳、时效与烧结全以扩散时钟设定工艺节奏',
      '晶界与位错是短路快通道——多晶比单晶扩散快得多',
    ]);
    heading(f, '菲克定律：乱跳产生的净流向');
  },
});
registerViz(fickDiffusion);

/** 空位与间隙扩散。 */
const vacancyDiffusion = defineViz({
  slug: 'vacancy-diffusion', title: '空位与间隙扩散', animated: true,
  params: { mech: { type: 'select', options: ['空位机制', '间隙机制'], default: '空位机制', label: '扩散机制' } },
  draw: (f) => {
    const { w, h, params } = f;
    const inter = String((params as Record<string, unknown>)['mech'] ?? '').includes('间隙');
    clear(f);
    const rows = 6, cols = 13;
    const cell = Math.min((w - 200) / cols, 46);
    const ox = 110, oy = h * 0.3;
    // 空位位置（动画迁移）
    const hop = Math.floor(f.t * 1.2) % (cols - 1);
    const vacC = 2 + hop;
    const vacR = 2 + (Math.floor(f.t * 1.2) % 2);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = ox + c * cell, y = oy + r * cell;
        if (!inter && r === vacR && c === vacC) {
          // 空位（虚线圈）
          circle(f, x, y, cell * 0.34, { stroke: `${C.hot}cc`, lw: 2.4, dash: [4, 4] });
          text(f, '空位', x - 14, y - cell * 0.46, { color: C.hot, font: '10px sans-serif' });
          continue;
        }
        if (inter) {
          // 间隙小原子在行间穿行
          const gi = Math.floor(f.t * 1.4) % (cols - 1);
          if (r === 2 && c === gi) {
            dot(f, x + cell * 0.5, y + cell * 0.5, cell * 0.2, C.hot);
            // 周围晶格被挤开
            circle(f, x, y, cell * 0.4, { stroke: `${C.warm}aa`, lw: 1.6 });
            continue;
          }
          if (r === 3 && c === gi + 1) {
            dot(f, x, y, cell * 0.34, C.cool);
            continue;
          }
        }
        dot(f, x, y, cell * 0.32, `rgba(66,153,225,${0.8})`);
      }
    }
    if (inter) text(f, '红=间隙小原子（碳在铁中）——路径更挤、势垒更高', ox - 46, oy - 40, { color: C.hot, font: '12px sans-serif' });
    else text(f, '空位是热平衡缺陷——原子跳进空座换位，像公交车上挪位置', ox - 46, oy - 40, { color: C.cyan, font: '12px sans-serif' });
    // 空位浓度
    const by = h - 128;
    const Cv = Math.exp(-0.7);
    text(f, `空位浓度 C_v ∝ exp(−G_f/kT)：1000K 时约 ${'10⁻⁵'} 量级——高温才有足够多的空座`, 60, by, { color: C.warm, font: '13px sans-serif' });
    text(f, '近邻跳动是随机行走；净流向只由浓度梯度与温度场决定', 60, by + 34, { color: C.cyan, font: '12px sans-serif' });
    text(f, `当前机制：${inter ? '间隙扩散（小原子钻缝）' : '空位扩散（换位挪座）'}——空位浓度因子 ${Cv.toFixed(4)}（示意）`,
      30, 44, { color: C.cyan, font: '13px sans-serif' });
    footnotes(f, [
      '空位是晶体里天然存在的"空座"——热涨落随时在补充',
      '烧结致密化的驱动力其实是热力学空位——粉末冶金的黏合剂',
      '柯肯达尔效应证明原子确有净流动——扩散机制的直接证据',
    ]);
    heading(f, '空位扩散：原子的换座艺术');
  },
});
registerViz(vacancyDiffusion);

/** 退火与再结晶。 */
const annealingRecrystallization = defineViz({
  slug: 'annealing-recrystallization', title: '退火与再结晶', animated: true,
  params: { annealT: { type: 'range', min: 200, max: 800, default: 400, step: 20, label: '退火温度 (℃)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const T = num(params, 'annealT', 400);
    clear(f);
    const stage = T < 300 ? 0 : T < 550 ? 1 : 2; // 回复/再结晶/长大
    // 左：组织演变
    const rand = rng(66);
    const boxW = w * 0.44, boxH = h * 0.5;
    const bx = 60, by = h * 0.3;
    poly(f, [[bx, by], [bx + boxW, by], [bx + boxW, by + boxH], [bx, by + boxH]],
      { stroke: C.dim, lw: 2.6, fill: 'rgba(26,32,44,0.7)' });
    if (stage === 0) {
      // 变形组织：拉长晶粒 + 高位错密度
      for (let i = 0; i < 14; i++) {
        const y = by + 8 + i * (boxH / 14);
        const pts: [number, number][] = [];
        for (let k = 0; k <= 20; k++) {
          const t = k / 20;
          pts.push([bx + t * boxW, y + Math.sin(t * 9 + i) * 4]);
        }
        poly(f, pts, { stroke: `rgba(66,153,225,0.7)`, lw: 2.6 });
      }
      for (let i = 0; i < 40; i++) text(f, '⊥', bx + 12 + rand() * (boxW - 30), by + 14 + rand() * (boxH - 24), { color: C.hot, font: '10px sans-serif' });
      text(f, '冷变形组织：晶粒拉长、位错缠结（硬而脆）', bx + 6, by - 12, { color: C.hot, font: '11px sans-serif' });
    } else if (stage === 1) {
      // 再结晶：新晶粒蚕食
      for (let i = 0; i < 9; i++) {
        const cx = bx + 30 + rand() * (boxW - 60), cy = by + 30 + rand() * (boxH - 60);
        const r = 26 + rand() * 30 * (T / 550);
        const pts: [number, number][] = [];
        for (let k = 0; k <= 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          pts.push([cx + Math.cos(a) * r * (0.8 + rand() * 0.4), cy + Math.sin(a) * r * (0.8 + rand() * 0.4)]);
        }
        poly(f, pts, { stroke: C.green, lw: 2.6, fill: 'rgba(72,187,120,0.28)' });
      }
      text(f, '再结晶：无畸变新晶粒吃掉位错基体（重新变软）', bx + 6, by - 12, { color: C.green, font: '11px sans-serif' });
    } else {
      // 晶粒长大
      for (let i = 0; i < 4; i++) {
        const cx = bx + 60 + rand() * (boxW - 120), cy = by + 60 + rand() * (boxH - 120);
        const r = 54 + rand() * 40 * (T / 800);
        const pts: [number, number][] = [];
        for (let k = 0; k <= 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          pts.push([cx + Math.cos(a) * r * (0.85 + rand() * 0.3), cy + Math.sin(a) * r * (0.85 + rand() * 0.3)]);
        }
        poly(f, pts, { stroke: C.warm, lw: 3, fill: 'rgba(237,137,54,0.25)' });
      }
      text(f, '晶粒长大：界面能驱动吞并（强度反而下降）', bx + 6, by - 12, { color: C.warm, font: '11px sans-serif' });
    }
    // 右：三阶段示意曲线
    const v = view(f, { xMin: 200, xMax: 800, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    const prop: [number, number][] = [];
    for (let i = 0; i <= 200; i++) {
      const t = 200 + (i / 200) * 600;
      let y = 0.9;
      if (t > 300 && t < 550) y = 0.9 - ((t - 300) / 250) * 0.55;
      else if (t >= 550) y = 0.35 - ((t - 550) / 250) * 0.15;
      prop.push([v.sx(t), v.sy(y)]);
    }
    poly(f, prop, { stroke: C.accent, lw: 3.4 });
    for (const [x, label] of [[300, '回复'], [550, '再结晶'], [720, '长大']] as [number, string][]) {
      seg(f, v.sx(x), v.sy(0), v.sx(x), v.sy(1.05), `${C.dim}88`, 1.4, );
      text(f, label, v.sx(x) + 5, v.sy(1.0), { color: C.dim, font: '11px sans-serif' });
    }
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
    dot(f, v.sx(T), v.sy(T < 300 ? 0.9 : T < 550 ? 0.9 - ((T - 300) / 250) * 0.55 : 0.35 - ((T - 550) / 250) * 0.15), 8, `rgba(72,187,120,${pulse})`);
    text(f, '强度/硬度 →', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    text(f, '温度 →（℃）', w - 120, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, `${T}℃：${stage === 0 ? '回复阶段——位错重排，内应力先释放' : stage === 1 ? '再结晶——新晶粒成核长大，塑性恢复' : '晶粒粗化——过火了，强度开始走下坡'}`,
      30, 44, { color: stage === 0 ? C.cool : stage === 1 ? C.green : C.warm, font: '13px sans-serif' });
    footnotes(f, [
      '退火是金属加工的标准收尾——铝箔到硅片都要过这道热预算',
      '冷变形量越大再结晶温度越低——工艺参数互相牵制',
      '再结晶织构决定板材冲压性——汽车钢板深冲的钥匙',
    ]);
    heading(f, '退火：让金属重新柔软的三段路');
  },
});
registerViz(annealingRecrystallization);

/** 马氏体相变。 */
const martensiticTransformation = defineViz({
  slug: 'martensitic-transformation', title: '马氏体相变', animated: true,
  params: { quench: { type: 'select', options: ['缓冷（珠光体）', '淬火（马氏体）'], default: '淬火（马氏体）', label: '冷却方式' } },
  draw: (f) => {
    const { w, h, params } = f;
    const quench = String((params as Record<string, unknown>)['quench'] ?? '').includes('淬火');
    clear(f);
    // 左：晶格切变示意
    const cx = w * 0.3, cy = h * 0.46;
    const shear = quench ? 0.34 : 0;
    const drawLat = (ox: number, oy: number, sk: number, color: string, label: string) => {
      const cell2 = 34;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
        const x = ox + c * cell2 + r * sk * cell2;
        const y = oy + r * cell2;
        dot(f, x, y, 7, color);
        if (c < 4) seg(f, x, y, ox + (c + 1) * cell2 + r * sk * cell2, y, `${color}88`, 1.4);
        if (r < 3) seg(f, x, y, ox + c * cell2 + (r + 1) * sk * cell2, y + cell2, `${color}88`, 1.4);
      }
      text(f, label, ox - 6, oy - 18, { color, font: '12px sans-serif' });
    };
    const phase = (f.t * 0.5) % 2;
    if (quench) {
      drawLat(cx - 130, cy - 60, 0, C.cool, 'γ 奥氏体（FCC 对称）');
      if (phase > 0.7) {
        drawLat(cx + 40, cy - 60, shear, C.hot, 'α′ 马氏体（BCT 切变）');
        text(f, '无扩散协同剪切——碳被锁在晶格里', cx + 40, cy + 130, { color: C.hot, font: '12px sans-serif' });
        // 切变箭头
        vec(f, cx + 40, cy + 100, cx + 105, cy + 100, C.hot, 3);
        vec(f, cx + 40, cy - 90, cx + 40 - 0, cy - 90, C.cool, 3);
      } else {
        text(f, '淬火中…碳来不及扩散——晶格瞬时切变', cx + 40, cy + 130, { color: C.warm, font: '12px sans-serif' });
      }
    } else {
      drawLat(cx - 130, cy - 60, 0, C.cool, 'γ 奥氏体');
      if (phase > 0.7) {
        // 珠光体层状
        for (let k = 0; k < 6; k++) {
          seg(f, cx + 40, cy - 60 + k * 22, cx + 190, cy - 60 + k * 22, k % 2 === 0 ? C.cool : C.warm, 7);
        }
        text(f, '珠光体：铁素体+渗碳体层状（扩散型）', cx + 40, cy + 130, { color: C.green, font: '12px sans-serif' });
      }
    }
    // 右：TTT/CCT 示意
    const v = view(f, { xMin: 0, xMax: 3, yMin: 400, yMax: 900, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    // C 曲线（鼻尖）
    const nose: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const t = 0.2 + (i / 120) * 2.6;
      const y = 560 + 260 * Math.pow((t - 1.0) / 1.4, 2);
      nose.push([v.sx(t), v.sy(Math.min(880, Math.max(430, y)))]);
    }
    poly(f, nose, { stroke: C.warm, lw: 3.4 });
    text(f, 'C 曲线鼻尖（珠光体转变最快处）', v.sx(0.3), v.sy(860), { color: C.warm, font: '11px sans-serif' });
    // 冷却路径
    const path: [number, number][] = quench
      ? [[v.sx(0), v.sy(880)], [v.sx(0.5), v.sy(560)], [v.sx(0.9), v.sy(440)]]
      : [[v.sx(0), v.sy(880)], [v.sx(1.4), v.sy(700)], [v.sx(3), v.sy(640)]];
    poly(f, path, { stroke: quench ? C.green : C.cool, lw: 3, dash: [7, 5] });
    text(f, quench ? '淬火：绕过鼻尖 → 无扩散切变' : '缓冷：穿过鼻尖 → 扩散型珠光体', v.sx(0.06), v.sy(470),
      { color: quench ? C.green : C.cool, font: '11px sans-serif' });
    text(f, `${quench ? '淬火' : '缓冷'}：温度 →（s，示意）`, w * 0.52, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '温度 (℃)', w * 0.56, h - 118, { color: C.dim, font: '11px sans-serif' });
    text(f, `${quench ? '过饱和碳造成巨大畸变——位错几乎无法滑移，硬度飙升' : '扩散充分——组织接近平衡，软而韧'}`,
      30, 44, { color: quench ? C.hot : C.cyan, font: '13px sans-serif' });
    footnotes(f, [
      '马氏体相变是无扩散的：原子只挪不到一个原子间距——快到像多米诺',
      '淬火硬化是冶金史的分水岭——从刀剑到模具钢全靠这一步',
      '回火释放部分应力换回韧性——硬与韧的分配是热处理的艺术',
    ]);
    heading(f, '马氏体：一瞬之间的晶格剪切');
  },
});
registerViz(martensiticTransformation);

/** 形状记忆合金。 */
const shapeMemoryAlloy = defineViz({
  slug: 'shape-memory-alloy', title: '形状记忆合金', animated: true,
  params: { temp: { type: 'range', min: 20, max: 90, default: 65, step: 1, label: '温度 (℃)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const T = num(params, 'temp', 65);
    const recovered = T > 55;
    clear(f);
    // 左：变形的丝 → 加热恢复
    const y = h * 0.4;
    const wire: [number, number][] = [];
    const bendAmt = recovered ? 0 : 1;
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const x = 70 + t * (w * 0.44);
      const bend = Math.sin(t * Math.PI) * 110 * bendAmt;
      wire.push([x, y + bend]);
    }
    poly(f, wire, { stroke: recovered ? C.green : C.warm, lw: 7 });
    text(f, recovered ? '加热到 >As：恢复原始直态！' : '低温马氏体：被轻易掰弯（孪晶再排布）',
      70, y - 132, { color: recovered ? C.green : C.warm, font: '13px sans-serif' });
    // 形变箭头
    if (!recovered) {
      vec(f, w * 0.24, y + 130, w * 0.24, y + 40, C.hot, 3);
      text(f, '外力（低温可塑变形）', w * 0.24 + 12, y + 120, { color: C.hot, font: '11px sans-serif' });
    }
    // 右：滞回环（温度-形状回复）
    const v = view(f, { xMin: 0, xMax: 100, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 5, ticks: true });
    // 加热（马氏体→奥氏体）
    const heat: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const t = 20 + (i / 120) * 80;
      const yv = 1 / (1 + Math.exp(-(t - 55) / 5));
      heat.push([v.sx(t), v.sy(yv * 0.85 + 0.1)]);
    }
    poly(f, heat, { stroke: C.hot, lw: 3.4 });
    // 冷却（奥氏体→马氏体，滞后）
    const cool: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const t = 100 - (i / 120) * 80;
      const yv = 1 / (1 + Math.exp(-(t - 38) / 5));
      cool.push([v.sx(t), v.sy(yv * 0.85 + 0.1)]);
    }
    poly(f, cool, { stroke: C.cool, lw: 3.4, dash: [7, 5] });
    // 当前点
    const yNow = 1 / (1 + Math.exp(-(T - 55) / 5));
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
    dot(f, v.sx(T), v.sy(yNow * 0.85 + 0.1), 9, `rgba(72,187,120,${pulse})`);
    for (const [x, label] of [[55, 'A_s 加热转变'], [38, 'M_s 冷却转变']] as [number, string][]) {
      seg(f, v.sx(x), v.sy(0), v.sx(x), v.sy(1.05), `${C.dim}88`, 1.4, );
      text(f, label, v.sx(x) + 5, v.sy(1.0), { color: C.dim, font: '10px sans-serif' });
    }
    text(f, `T=${T}℃：${recovered ? '奥氏体主导——形状恢复中' : '马氏体主导——可自由变形'}`, 56, 44, { color: recovered ? C.green : C.warm, font: '13px sans-serif' });
    text(f, '温度 →（℃）', w - 120, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '形状回复率', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    text(f, '加热与冷却的转变温度不同（滞后）——驱动器正靠这段温差做往复', 30, h - 66, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '镍钛丝的记忆写在可逆马氏体相变里——形变只是孪晶再排布',
      '血管支架、牙齿矫正丝与恒温龙头——日常岗位遍布全身',
      '它把材料从被动承力变成感知温度并做功的智能器件',
    ]);
    heading(f, '形状记忆合金：加热即回的相变');
  },
});
registerViz(shapeMemoryAlloy);

/** 高温蠕变。 */
const creep = defineViz({
  slug: 'creep', title: '高温蠕变', animated: true,
  params: { temp: { type: 'range', min: 400, max: 1000, default: 750, step: 10, label: '温度 (℃)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const T = num(params, 'temp', 750);
    clear(f);
    // 蠕变三阶段曲线
    const v = view(f, { xMin: 0, xMax: 10, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 8, ticks: true });
    const rate = (T - 400) / 600; // 温度越高越快
    const rupture = 3 + (1 - rate) * 6;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 400; i++) {
      const t = (i / 400) * 10;
      let e: number;
      if (t < 0.6) e = 0.18 + t * 0.5;                          // 一次（减速）
      else if (t < rupture) e = 0.48 + (t - 0.6) * (0.35 + rate * 0.5); // 二次（稳态）
      else e = 0.48 + (rupture - 0.6) * (0.35 + rate * 0.5) + Math.pow((t - rupture) / Math.max(0.4, 10 - rupture), 2.4) * 0.9;
      if (e > 1.08) break;
      pts.push([v.sx(t), v.sy(e)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 3.4 });
    // 三阶段标注
    const labels: [number, string][] = [[0.3, '一次：减速蠕变'], [(0.6 + rupture) / 2, '二次：稳态（设计依据）'], [rupture + 0.6, '三次：空洞汇聚→断裂']];
    for (const [x, label] of labels) {
      const on = x < (f.t * 1.4) % 12;
      text(f, label, v.sx(x), v.sy(1.03), { color: on ? C.cyan : C.dim, font: '10px sans-serif' });
    }
    // 断裂标记
    if (rupture < 10) {
      const pulse = 0.5 + 0.5 * Math.sin(f.t * 4);
      seg(f, v.sx(rupture), v.sy(0), v.sx(rupture), v.sy(1.08), `rgba(245,101,101,${pulse})`, 1.8, );
      text(f, '断裂', v.sx(rupture) + 5, v.sy(0.1), { color: C.hot, font: '11px sans-serif' });
    }
    text(f, '应变 ε →（对数时间）', w - 180, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '蠕变应变', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    // Norton 律
    text(f, `ε̇ = A·σⁿ·exp(−Q/RT)：T=${T}℃ → 稳态速率相对值 ${(rate * 100).toFixed(0)}%`, 56, 44, { color: C.cyan, font: '13px sans-serif' });
    // 右下：蠕变机制卡
    const bx = 60, by = h - 154;
    const mechs = T > 800 ? ['扩散蠕变（晶格/晶界扩散主导）', '高温下原子自扩散加快——叶片寿命骤降']
      : T > 600 ? ['位错攀移（热激活越过障碍）', '刃型位错爬出滑移面继续滑移']
      : ['位错滑移为主（低温蠕变弱）', '此温度段蠕变尚不显著'];
    text(f, `主导机制：${mechs[0]}`, bx, by, { color: C.green, font: '13px sans-serif' });
    text(f, mechs[1], bx, by + 30, { color: C.dim, font: '12px sans-serif' });
    text(f, '稳态段斜率就是设计寿命的输入——涡轮叶片按它定检修周期', bx, by + 60, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '蠕变不猛却从不停歇——高温件的寿命由稳态速率与断裂时间决定',
      '单晶叶片消除晶界滑移——航空发动机耐温提升的关键一招',
      '蠕变研究让涡轮入口温度每十年升约 30℃——效率的隐形推手',
    ]);
    heading(f, '高温蠕变：慢慢拉长的叶片');
  },
});
registerViz(creep);

/** 疲劳与裂纹扩展。 */
const fatigueCrack = defineViz({
  slug: 'fatigue-crack', title: '疲劳与裂纹扩展', animated: true,
  params: { cycles: { type: 'range', min: 1, max: 100, default: 30, step: 1, label: '载荷循环 (万次)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const N = num(params, 'cycles', 30);
    clear(f);
    // 载荷波形（上）
    const v1 = view(f, { xMin: 0, xMax: 10, yMin: -1.4, yMax: 1.4, inset: 46, insetBottom: 190 });
    grid(f, v1, { divisions: 8, ticks: true });
    const load: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const t = (i / 300) * 10;
      load.push([v1.sx(t), v1.sy(Math.sin(t * 3 + f.t * 4) * 0.8 + 0.35)]);
    }
    poly(f, load, { stroke: C.accent, lw: 3 });
    text(f, '交变载荷（远低于极限强度）', 56, 44, { color: C.cyan, font: '13px sans-serif' });
    // 疲劳源与裂纹（带材示意）
    const y = h * 0.52;
    poly(f, [[60, y], [w - 60, y], [w - 60, y + 54], [60, y + 54]],
      { stroke: C.dim, lw: 2.4, fill: 'rgba(100,116,139,0.35)' });
    // 表面缺口
    poly(f, [[140, y], [156, y + 16], [172, y]], { stroke: 'transparent', fill: 'rgba(26,32,44,0.95)' });
    text(f, '表面缺陷（应力集中源）', 108, y - 12, { color: C.hot, font: '11px sans-serif' });
    // 裂纹长度随循环
    const a = 16 + Math.log10(1 + N) * 62;
    const crackX = 156 + a;
    poly(f, [[156, y + 16], [crackX, y + 30], [crackX + 6, y + 30], [crackX, y + 34], [crackX - 6, y + 30], [156, y + 18]],
      { stroke: 'transparent', fill: 'rgba(26,32,44,0.95)' });
    // 裂尖塑性区
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 4);
    circle(f, crackX, y + 32, 16 + pulse * 8, { stroke: `rgba(245,101,101,${0.5 + pulse * 0.4})`, lw: 2.4 });
    text(f, '裂尖塑性区', crackX + 24, y + 68, { color: C.hot, font: '11px sans-serif' });
    // S-N 曲线（下）
    const v2 = view(f, { xMin: 0, xMax: 8, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 76 });
    void v2;
    const bx = 60, by = h - 148;
    text(f, 'S-N 曲线：应力幅 vs 寿命（对数）', bx, by - 8, { color: C.green, font: '12px sans-serif' });
    const sn: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const nn = i / 120;
      sn.push([bx + 20 + nn * (w * 0.5), by + 40 + (1 - Math.exp(-nn * 4)) * 44]);
    }
    poly(f, sn, { stroke: C.green, lw: 3 });
    seg(f, bx + 20, by + 84, bx + 20 + (w * 0.5), by + 84, `${C.warm}88`, 1.6, );
    text(f, '疲劳极限（低于它无限次安全）', bx + 40, by + 76, { color: C.warm, font: '10px sans-serif' });
    // Paris 律（右下）
    const px = w * 0.66;
    text(f, 'Paris 律：da/dN = C·(ΔK)ᵐ', px, by - 8, { color: C.hot, font: '13px sans-serif' });
    const paris: [number, number][] = [];
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      paris.push([px + t * 200, by + 84 - Math.pow(t, 3) * 66]);
    }
    poly(f, paris, { stroke: C.hot, lw: 3 });
    text(f, `当前 ${N} 万次循环：裂纹 a ≈ ${a.toFixed(0)} 单位${N > 80 ? '——接近失稳扩展！' : ''}`,
      30, 44, { color: N > 80 ? C.hot : C.cyan, font: '13px sans-serif' });
    footnotes(f, [
      '19 世纪火车轴疲劳断裂催生了疲劳研究——断裂力学由此诞生',
      '裂纹在驻留滑移带萌生，扩展分三阶段直至瞬断',
      '从飞机蒙皮到桥梁焊缝——疲劳寿命核算是安全常规科目',
    ]);
    heading(f, '疲劳：沉默的断裂杀手');
  },
});
registerViz(fatigueCrack);

/** 断裂韧性。 */
const fractureToughness = defineViz({
  slug: 'fracture-toughness', title: '断裂韧性', animated: true,
  params: { crack: { type: 'range', min: 1, max: 30, default: 10, step: 1, label: '裂纹长度 a (mm)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'crack', 10);
    clear(f);
    // 试样与裂纹
    const y = h * 0.4, bw = w - 140, bh = 96;
    const bx = 70;
    poly(f, [[bx, y], [bx + bw, y], [bx + bw, y + bh], [bx, y + bh]],
      { stroke: C.dim, lw: 2.6, fill: 'rgba(100,116,139,0.3)' });
    const crackW = (a / 30) * bw * 0.5;
    poly(f, [[bx + bw / 2 - 8, y], [bx + bw / 2 + 8, y], [bx + bw / 2 + 2, y + bh], [bx + bw / 2 - 2, y + bh]],
      { stroke: 'transparent', fill: 'rgba(26,32,44,0.95)' });
    // 裂纹开口位移（加载中张开）
    const open = 4 + Math.sin(f.t * 3) * 3;
    poly(f, [[bx + bw / 2 - crackW, y + bh * 0.4], [bx + bw / 2, y + bh * 0.4 + open], [bx + bw / 2, y + bh], [bx + bw / 2 - crackW, y + bh]],
      { stroke: 'transparent', fill: 'rgba(26,32,44,0.96)' });
    // 裂尖应力场（平方根奇异性光环）
    const tipX = bx + bw / 2 - crackW, tipY = y + bh * 0.4;
    for (let k = 5; k >= 1; k--) {
      const r = k * 24 + Math.sin(f.t * 4) * 4;
      const glow = (0.55 - k * 0.08) * (1 - a / 40);
      const pts: [number, number][] = [];
      for (let i = 0; i <= 40; i++) {
        const ang = -Math.PI / 2 + (i / 40) * Math.PI;
        pts.push([tipX + Math.cos(ang) * r, tipY - Math.abs(Math.sin(ang)) * r * 0.7]);
      }
      poly(f, pts, { stroke: `rgba(245,101,101,${glow + 0.2})`, lw: 2.4 });
    }
    text(f, '裂尖应力 ∝ K/√(2πr)——平方根奇异性', tipX - 110, tipY - 66, { color: C.hot, font: '12px sans-serif' });
    // 载荷箭头
    vec(f, bx + bw / 2, y - 34, bx + bw / 2, y - 6, C.cool, 3.6);
    vec(f, bx + bw / 2, y + bh + 6, bx + bw / 2, y + bh + 34, C.cool, 3.6);
    text(f, '张开载荷 σ', bx + bw / 2 + 14, y - 20, { color: C.cool, font: '11px sans-serif' });
    // K_IC 仪表
    const K = 60 / Math.sqrt(Math.max(1, a)) * (Math.sin(f.t * 3) > 0 ? 1 : 0.96);
    const Kic = 60;
    const bx2 = 70, by2 = h - 148;
    text(f, `K_I = Y·σ·√(πa) = ${K.toFixed(1)} MPa√m`, bx2, by2, { color: C.cyan, font: '14px sans-serif' });
    const barW = w - 160;
    poly(f, [[bx2, by2 + 18], [bx2 + barW, by2 + 18], [bx2 + barW, by2 + 46], [bx2, by2 + 46]],
      { stroke: `${C.grid}aa`, lw: 1.4, fill: 'rgba(45,55,72,0.6)' });
    const ratio = Math.min(1, K / Kic);
    poly(f, [[bx2, by2 + 18], [bx2 + barW * ratio, by2 + 18], [bx2 + barW * ratio, by2 + 46], [bx2, by2 + 46]],
      { stroke: 'transparent', fill: ratio > 0.85 ? 'rgba(245,101,101,0.85)' : 'rgba(72,187,120,0.75)' });
    seg(f, bx2 + barW * (Kic / (Kic + 12)), by2 + 10, bx2 + barW * (Kic / (Kic + 12)), by2 + 54, C.yellow, 3);
    text(f, 'K_IC 失稳线', bx2 + barW * (Kic / (Kic + 12)) - 44, by2 + 70, { color: C.yellow, font: '11px sans-serif' });
    text(f, `a=${a} mm：${ratio > 0.85 ? '接近临界——裂纹即将失稳扩展' : '安全余量尚存——裂纹在可控范围'}`,
      30, 44, { color: ratio > 0.85 ? C.hot : C.cyan, font: '13px sans-serif' });
    text(f, '带裂纹工作的底气全在这条式子上——容限设计的基石', 30, h - 66, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      'Griffith 1921 年用表面能解释脆性断裂——断裂力学的种子',
      '厚板平面应变最危险——K_IC 就在这个最不利条件下测定',
      '低温脆性转变让压力容器钢必须做冲击试验——温度是红线',
    ]);
    heading(f, '断裂韧性：带裂纹工作的底线');
  },
});
registerViz(fractureToughness);

/** 纤维增强复合材料。 */
const fiberComposite = defineViz({
  slug: 'fiber-composite', title: '纤维增强复合材料', animated: true,
  params: { vf: { type: 'range', min: 10, max: 80, default: 55, step: 5, label: '纤维体积分数 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const vf = num(params, 'vf', 55);
    clear(f);
    // 左：铺层截面
    const bx = 60, by = h * 0.3, bw = w * 0.42, bh = h * 0.44;
    poly(f, [[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]],
      { stroke: C.dim, lw: 2.6, fill: 'rgba(100,116,139,0.35)' });
    // 基体（树脂）
    poly(f, [[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]],
      { stroke: 'transparent', fill: 'rgba(146,84,222,0.16)' });
    // 纤维（随体积分数变密）
    const nRows = 6;
    const fibersPerRow = Math.round((vf / 100) * 22);
    for (let r = 0; r < nRows; r++) {
      const y = by + 18 + r * ((bh - 30) / nRows);
      for (let c = 0; c < fibersPerRow; c++) {
        const x = bx + 16 + c * ((bw - 32) / Math.max(1, fibersPerRow));
        circle(f, x, y, 7.4, { stroke: C.cool, lw: 2, fill: 'rgba(66,153,225,0.65)' });
      }
    }
    text(f, '蓝=纤维（承力）／紫=基体（传剪）', bx, by - 14, { color: C.cyan, font: '12px sans-serif' });
    // 右：混合律曲线
    const v = view(f, { xMin: 0, xMax: 1, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 5, ticks: true });
    const Ef = 0.92, Em = 0.06;
    const mix: [number, number][] = [];
    for (let i = 0; i <= 100; i++) {
      const vv = i / 100;
      mix.push([v.sx(vv), v.sy(Em + vv * (Ef - Em))]);
    }
    poly(f, mix, { stroke: C.green, lw: 3.4 });
    const E = Em + (vf / 100) * (Ef - Em);
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
    dot(f, v.sx(vf / 100), v.sy(E), 9, `rgba(237,137,54,${pulse})`);
    text(f, 'E_c = E_f·V_f + E_m·V_m（混合律）', 56, 44, { color: C.green, font: '13px sans-serif' });
    text(f, '纤维体积分数 →', w - 160, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '复合模量（归一）', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    // 铺层角度示意
    const ax = w * 0.74, ay = h * 0.4;
    const angles = [0, 45, -45, 90];
    angles.forEach((a2, i) => {
      const y = ay - 60 + i * 40;
      const rad = (a2 * Math.PI) / 180;
      const dx = Math.cos(rad) * 66, dy = Math.sin(rad) * 66;
      seg(f, ax - dx, y - dy, ax + dx, y + dy, i % 2 === 0 ? C.cool : C.warm, 4.4);
      text(f, `±${a2}°`, ax + 80, y + 4, { color: C.dim, font: '11px sans-serif' });
    });
    text(f, '铺层设计：0° 抗拉、±45° 抗剪、90° 最弱', ax - 90, ay + 122, { color: C.warm, font: '11px sans-serif' });
    text(f, `V_f=${vf}%：${vf > 65 ? '接近密排上限——浸润与孔隙风险上升' : '常规铺层区间——树脂充分包裹纤维'}`,
      30, h - 66, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '强纤维扛拉、韧基体传剪——两种平庸材料叠出比金属还强的板',
      '失效模式从屈服变成分层——外观完好的冲击损伤要靠超声检出',
      '碳纤维让飞机与风叶一并减重——787 过半结构用复合材料',
    ]);
    heading(f, '纤维复合：各司其强的层压板');
  },
});
registerViz(fiberComposite);
