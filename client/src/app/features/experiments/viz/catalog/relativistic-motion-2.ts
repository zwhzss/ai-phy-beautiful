import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** 相对论动量与速度依赖。 */
const relativisticMomentum = defineViz({
  slug: 'relativistic-momentum', title: '相对论动量', animated: true,
  params: {
    beta: { type: 'range', min: 0, max: 0.999, default: 0.8, step: 0.01, label: 'v/c' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const beta = num(params, 'beta', 0.8);
    const gamma = 1 / Math.sqrt(1 - beta * beta);
    clear(f);
    const x0 = 56, x1 = w - 30, y0 = h - 56, y1 = 56;
    const vv = view(f, { xMin: 0, xMax: 1, yMin: 0, yMax: 6, inset: 46 });
    grid(f, vv, { divisions: 5, ticks: true });
    // p=γmv（以 mv 为单位）曲线
    const pts: [number, number][] = [];
    for (let i = 1; i <= 300; i++) {
      const b = (i / 300) * 0.999;
      pts.push([vv.sx(b), vv.sy(1 / Math.sqrt(1 - b * b))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.8 });
    // 经典直线 p=mv
    poly(f, [[vv.sx(0), vv.sy(1)], [vv.sx(0.999), vv.sy(0.999 * 6 + 1)]], { stroke: `${C.dim}aa`, lw: 1.6, dash: [7, 5] } as any);
    dot(f, vv.sx(beta), vv.sy(gamma), 7, C.warm);
    text(f, `β=${beta}：γ=${gamma.toFixed(2)}，p=γmv=${gamma.toFixed(2)}mv`, vv.sx(beta) + 10, vv.sy(gamma) - 8, { color: C.warm, font: '13px sans-serif' });
    text(f, '虚线=牛顿动量：高速时被甩开；v→c 时 p→∞（永远推不到光速）', 30, 44, { color: C.cyan, font: '12px sans-serif' });
    void x0; void x1; void y0; void y1;

    footnotes(f, [
      '洛伦兹因子 γ 让动量在接近光速时陡增——加速器的每一分能量都在对抗 γ',
      'p=∞ 需要无限能量：光速是质量粒子不可达的天花板（LHC 的质子 γ≈7500）',
      '相对论动量与能量构成四矢量 p^μ——守恒律在所有惯性系保持同一形式',
    ]);
    heading(f, '相对论动量：γ 因子的统治');
  },
});
registerViz(relativisticMomentum);

/** 质能等价。 */
const massEnergy = defineViz({
  slug: 'mass-energy-equivalence', title: '质能等价 E=mc²', animated: true,
  params: {
    demo: { type: 'select', options: ['太阳聚变亏损', '铀-235 裂变', '电子湮灭'], default: '太阳聚变亏损', label: '案例' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const demo = String((params as Record<string, unknown>)['demo'] ?? '');
    const cases: Record<string, [string, string, string]> = {
      '太阳聚变亏损': ['4p → ⁴He + 2e⁺ + 2ν', '0.7% 质量转能量', '每秒 4×10⁶ 吨质量亏损 → 光'],
      '铀-235 裂变': ['n + ²³⁵U → 碎片 + 3n', '0.09% 质量转能量', '1g 铀 ≈ 20 吨 TNT 当量'],
      '电子湮灭': ['e⁻ + e⁺ → 2γ', '100% 湮灭（m 全转）', '两个 0.511MeV 光子背向飞出'],
    };
    const [formula, pct, note] = cases[demo] ?? cases['太阳聚变亏损'];
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    // E=mc² 中心徽标
    const pulse = 1 + 0.06 * Math.sin(f.t * 3);
    f.ctx.beginPath();
    f.ctx.arc(cx, cy - 40, 66 * pulse, 0, Math.PI * 2);
    f.ctx.strokeStyle = C.warm; f.ctx.lineWidth = 3; f.ctx.stroke();
    f.ctx.fillStyle = 'rgba(237,137,54,0.12)'; f.ctx.fill();
    text(f, 'E = mc²', cx - 54, cy - 32, { color: C.warm, font: '26px serif' });
    text(f, formula, cx - 96, cy + 54, { color: C.cyan, font: '15px sans-serif' });
    text(f, pct, cx - 78, cy + 84, { color: C.green, font: '14px sans-serif' });
    text(f, note, cx - 150, cy + 116, { color: C.dim, font: '13px sans-serif' });
    // 能量等价尺度（1g = 9×10¹³ J）
    text(f, '1 g 物质 = 9×10¹³ J = 21 吨 TNT ≈ 一座小城一天的用电', 30, 44, { color: C.warm, font: '13px sans-serif' });

    footnotes(f, [
      '质量是被束缚的能量：c² 是换算系数（每千克对应 9×10¹⁶ 焦耳）',
      '聚变只亏损 0.7% 就点亮恒星；裂变 0.09% 撑起核电——太阳靠引力约束持续亿万年',
      '湮灭把质量 100% 变光：正电子发射断层扫描（PET）正是它的医院日常',
    ]);
    heading(f, '质能等价：质量是储存的能量');
  },
});
registerViz(massEnergy);

/** 光锥。 */
const lightCone = defineViz({
  slug: 'light-cone', title: '光锥与因果结构', animated: true,
  params: {
    kind: { type: 'select', options: ['闵氏时空（平坦）', '弯曲时空'], default: '闵氏时空（平坦）', label: '时空' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const curved = String((params as Record<string, unknown>)['kind'] ?? '').includes('弯曲');
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    // 时空轴
    seg(f, 40, cy, w - 40, cy, C.grid, 1.4);
    seg(f, cx, h - 40, cx, 40, C.grid, 1.4);
    text(f, '空间 x', w - 90, cy - 10, { color: C.dim, font: '12px sans-serif' });
    text(f, '时间 ct', cx + 8, 52, { color: C.dim, font: '12px sans-serif' });
    const S = Math.min(w, h) * 0.34;
    const drawCone = (ox: number, oy: number, k: number): void => {
      for (const dir of [1, -1]) {
        const pts: [number, number][] = [];
        for (let i = 0; i <= 40; i++) {
          const t = i / 40;
          const yy = dir * t * S * k;
          const bend = curved ? Math.pow(t, 2) * 34 * Math.sin(ox * 0.01) : 0;
          pts.push([ox + t * S + bend, oy - yy]);
        }
        poly(f, pts, { stroke: C.warm, lw: 2.4 });
        const pts2 = pts.map(([x, y]) => [2 * ox - x, y] as [number, number]);
        poly(f, pts2, { stroke: C.warm, lw: 2.4 });
      }
      // 上下光锥填充
      const top: [number, number][] = [[ox, oy - S * k], [ox + S, oy], [ox, oy + S * k], [ox - S, oy]];
      poly(f, top, { stroke: 'transparent', fill: 'rgba(237,137,54,0.10)' } as any);
      dot(f, ox, oy, 7, C.cool);
      text(f, '事件', ox + 10, oy + 4, { color: C.cool, font: '11px sans-serif' });
      text(f, '未来光锥（可影响）', ox + 18, oy - S * k * 0.5, { color: C.warm, font: '11px sans-serif' });
      text(f, '过去光锥（可受因）', ox + 18, oy + S * k * 0.5, { color: `${C.warm}cc`, font: '11px sans-serif' });
    };
    drawCone(cx, cy + 30, 1);
    text(f, curved ? "弯曲时空中光锥倾斜——'因果方向'本身被引力扭转" : "45° 光锥：类时（内）因果相连、类光（面）、类空（外）无缘",
      30, 44, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      '光锥是闵氏时空的骨架：因果关系只能在锥内传递——相对论的因果律几何化',
      '同时性的相对论即锥外区域：两个类空事件的先后顺序因参考系而异',
      '黑洞视界是未来光锥整体指向 singularity 的区域——进去就再无出路',
    ]);
    heading(f, '光锥：时空的因果地图');
  },
});
registerViz(lightCone);

/** 同时性的相对论。 */
const simultaneity = defineViz({
  slug: 'simultaneity', title: '同时性的相对论', animated: true,
  params: {
    v: { type: 'range', min: 0, max: 0.9, default: 0.5, step: 0.05, label: '相对速度 v/c' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const beta = num(params, 'v', 0.5);
    clear(f);
    // 上：静止系的列车与两闪电；下：运动系看到的时钟
    const y1 = h * 0.3, y2 = h * 0.68;
    const trainLen = w * 0.5;
    const shift = (f.t * 60 * beta) % (w + trainLen);
    const tx = -trainLen + shift;
    // 列车
    poly(f, [[tx, y1 - 34], [tx + trainLen, y1 - 34], [tx + trainLen, y1 + 34], [tx, y1 + 34]],
      { stroke: C.cool, lw: 2.2, fill: 'rgba(66,153,225,0.14)' } as any);
    text(f, '运动列车（参考系 S′）', tx + 20, y1 - 44, { color: C.cool, font: '11px sans-serif' });
    // 车头车尾钟（A 后 B 前——S′ 看到 B 先响）
    const frontX = tx + trainLen, backX = tx;
    const clockA = 0.5 + 0.5 * Math.sin(f.t * 4);
    const clockB = 0.5 + 0.5 * Math.sin(f.t * 4 + 1.6 + beta * 2);
    dot(f, backX + 30, y1, 14, C.hot);
    text(f, `A ${(clockA * 100).toFixed(0)}`, backX + 14, y1 + 4, { color: '#fff', font: '11px sans-serif' });
    dot(f, frontX - 30, y1, 14, C.green);
    text(f, `B ${(clockB * 100).toFixed(0)}`, frontX - 46, y1 + 4, { color: '#fff', font: '11px sans-serif' });
    // 地面观察者
    const obsX = w * 0.5;
    dot(f, obsX, y2, 10, C.dim);
    text(f, '地面站（S 系）：两次闪电对他是同时的', obsX - 120, y2 + 30, { color: C.dim, font: '12px sans-serif' });
    // 文字结论
    text(f, `v=${beta}c：S′ 系中 ${beta > 0.05 ? '车头 B 的钟先响、车尾 A 后响——先后顺序变了！' : '两钟同步（v=0）'}`,
      30, 44, { color: beta > 0.05 ? C.hot : C.green, font: '13px sans-serif' });
    text(f, "同时是相对的：没有任何实验能为全宇宙挑出一个'绝对同时面'", 30, h - 34, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      "爱因斯坦 1905 年思想实验：'同时'必须先定义——用光信号对表，定义即相对",
      '洛伦兹变换里 t′ 含 −vx/c² 项：时间与空间混合，这才是时空的本质',
      '这一步推倒了以太与绝对时间，狭义相对论的地基由此浇筑',
    ]);
    heading(f, '同时性的相对论：时间没有统一刻度');
  },
});
registerViz(simultaneity);

/** 双生子佯谬。 */
const twinParadox = defineViz({
  slug: 'twin-paradox', title: '双生子佯谬', animated: true,
  params: {
    beta: { type: 'range', min: 0.3, max: 0.99, default: 0.9, step: 0.01, label: '飞船速度 v/c' },
    years: { type: 'range', min: 5, max: 50, default: 20, step: 1, label: '地面年数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const beta = num(params, 'beta', 0.9);
    const T = num(params, 'years', 20);
    const gamma = 1 / Math.sqrt(1 - beta * beta);
    const proper = T / gamma;
    clear(f);
    // 时空图：地球世界线（竖直）与飞船（往返 V 形）
    const x0 = w * 0.3, x1 = w * 0.7, y0 = h - 70, y1 = 70;
    seg(f, x0, y0, x0, y1, C.cool, 3.4);
    text(f, '地球 twin（年复一年）', x0 - 100, y1 + 6, { color: C.cool, font: '12px sans-serif' });
    const mid = (x0 + x1) / 2;
    seg(f, x0, y0, mid, (y0 + y1) / 2, C.hot, 3);
    seg(f, mid, (y0 + y1) / 2, x0, y1, C.warm, 3);
    dot(f, mid, (y0 + y1) / 2, 6, C.warm);
    text(f, '飞船 twin（折返）', x1 - 30, (y0 + y1) / 2 - 14, { color: C.hot, font: '12px sans-serif' });
    // 年龄标签
    text(f, `地面：${T} 年`, x0 + 16, y0 - 40, { color: C.green, font: '15px sans-serif' });
    text(f, `飞船：${proper.toFixed(1)} 年（γ=${gamma.toFixed(2)}）`, mid + 16, (y0 + y1) / 2 + 40, { color: C.green, font: '15px sans-serif' });
    text(f, `回来后地面 ${T} 岁、飞船才 ${proper.toFixed(1)} 岁——年龄差 ${(T - proper).toFixed(1)} 年`, 30, 44, { color: C.hot, font: '14px sans-serif' });
    text(f, '不佯谬：飞船有加速折返（非惯性段），两个世界线根本不对等', 30, 66, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      '双生子年龄差是固有时间（世界线长度）之差——时钟读数就是四维路程',
      '1971 年哈费尔-基廷实验用喷气飞机上的铯钟验证：预言 40ns、实测 37±7ns',
      'GPS 卫星每天相对地面偏 38μs（引力）−7μs（速度）——不做相对论修正，导航一天漂 10km',
    ]);
    heading(f, '双生子佯谬：时间取决于走了哪条路');
  },
});
registerViz(twinParadox);

/** 相对论多普勒。 */
const relativisticDoppler = defineViz({
  slug: 'relativistic-doppler', title: '相对论多普勒效应',
  params: {
    beta: { type: 'range', min: -0.95, max: 0.95, default: 0.5, step: 0.05, label: '径向速度 v/c（正=接近）' },
    theta: { type: 'range', min: 0, max: 180, default: 0, step: 5, label: '观测夹角 (°)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const beta = num(params, 'beta', 0.5);
    const th = (num(params, 'theta', 0) * Math.PI) / 180;
    const root = Math.sqrt(1 - beta * beta);
    const shift = 1 / (root * (1 - beta * Math.cos(th)));
    clear(f);
    const x0 = 56, y0 = h - 56, y1 = 56;
    const vv = view(f, { xMin: -0.95, xMax: 0.95, yMin: 0.4, yMax: 6, inset: 46 });
    grid(f, vv, { divisions: 4, ticks: true });
    const pts: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const b = -0.95 + (i / 300) * 1.9;
      const r = Math.sqrt(1 - b * b);
      const y = 1 / (r * (1 - b * Math.cos(th)));
      if (y >= 0.4 && y <= 6) pts.push([vv.sx(b), vv.sy(y)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.8 });
    dot(f, vv.sx(beta), vv.sy(Math.max(0.4, Math.min(6, shift))), 7, C.warm);
    void x0; void y0; void y1;
    text(f, `f′/f = √((1+β)/(1−β))（θ=0）：当前比值 ${shift.toFixed(2)}`, 30, 44, { color: C.cyan, font: '14px sans-serif' });
    text(f, beta > 0.05 ? '蓝移（接近）' : beta < -0.05 ? '红移（远离）' : '静止：无频移', 30, 66, { color: beta > 0.05 ? C.cool : beta < -0.05 ? C.hot : C.green, font: '13px sans-serif' });

    footnotes(f, [
      '相对论多普勒含 γ 因子：纵向公式与声波不同——v→c 时频移发散（趋光）、横向也有频移',
      '横向多普勒效应（θ=90°）只有相对论版本（∝γ）——1960 年庞德-雷布卡实验的旋转钴源验证',
      '星系谱线红移测退行速度、Ia 超新星红移揭开暗能量——宇宙学读的就是这条曲线',
    ]);
    heading(f, '相对论多普勒：频移量速度');
  },
});
registerViz(relativisticDoppler);

/** 速度加合。 */
const velocityAddition = defineViz({
  slug: 'velocity-addition', title: '相对论速度加合',
  params: {
    u: { type: 'range', min: 0, max: 0.95, default: 0.7, step: 0.05, label: 'u/c（船速）' },
    v: { type: 'range', min: 0, max: 0.95, default: 0.7, step: 0.05, label: 'v/c（弹速相对船）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const u = num(params, 'u', 0.7), v = num(params, 'v', 0.7);
    const sum = (u + v) / (1 + u * v);
    clear(f);
    const x0 = 56, y0 = h - 56, y1 = 56;
    const vv = view(f, { xMin: 0, xMax: 1, yMin: 0, yMax: 1.06, inset: 46 });
    grid(f, vv, { divisions: 5, ticks: true });
    // 相对论加合曲线（v_sum vs u 对固定相对船速）
    const pts: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const uu = (i / 300) * 0.999;
      pts.push([vv.sx(uu), vv.sy((uu + v) / (1 + uu * v))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.8 });
    // 牛顿直线 u+v（越过 1 的部分被截断）
    poly(f, [[vv.sx(0), vv.sy(v)], [vv.sx(1 - v), vv.sy(1)]], { stroke: `${C.dim}aa`, lw: 1.6, dash: [7, 5] } as any);
    // 光速天花板
    seg(f, vv.sx(0), vv.sy(1), vv.sx(1), vv.sy(1), C.hot, 1.8);
    text(f, 'c = 1（绝对天花板）', vv.sx(0.55), vv.sy(1) - 8, { color: C.hot, font: '12px sans-serif' });
    dot(f, vv.sx(u), vv.sy(sum), 7, C.warm);
    void x0; void y0; void y1;
    text(f, `w = (u+v)/(1+uv) = (${u}+${v})/(1+${(u * v).toFixed(2)}) = ${sum.toFixed(3)}c < c ✓`, 30, 44, { color: C.cyan, font: '14px sans-serif' });
    text(f, '牛顿会得 1.4c（虚线），相对论永远缝不破光速', 30, 66, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '速度加合公式保证任何惯性系测得的光速都是 c——光速不变的自洽检验',
      '追光思想实验（1895）曾让爱因斯坦困惑十年：正是这个问题引出狭义相对论',
      'μ 子以 0.998c 飞行仍能到达地面：在它自己看来寿命没变、大气层变薄了——时间膨胀的等价视角',
    ]);
    heading(f, '速度加合：怎么加都不过光速');
  },
});
registerViz(velocityAddition);

/** 尺缩效应。 */
const lengthContraction = defineViz({
  slug: 'length-contraction', title: '长度收缩', animated: true,
  params: {
    beta: { type: 'range', min: 0, max: 0.97, default: 0.8, step: 0.01, label: 'v/c' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const beta = num(params, 'beta', 0.8);
    const gamma = 1 / Math.sqrt(1 - beta * beta);
    const ratio = 1 / gamma;
    clear(f);
    // 静止杆（长）与运动杆（短）对比
    const restLen = Math.min(w * 0.6, 480);
    const y1 = h * 0.34, y2 = h * 0.62;
    const cx = w / 2;
    poly(f, [[cx - restLen / 2, y1 - 16], [cx + restLen / 2, y1 - 16], [cx + restLen / 2, y1 + 16], [cx - restLen / 2, y1 + 16]],
      { stroke: C.cool, lw: 2.4, fill: 'rgba(66,153,225,0.20)' } as any);
    text(f, `静止长度 L₀（参考系静止测量）`, cx - restLen / 2, y1 - 26, { color: C.cool, font: '12px sans-serif' });
    const movLen = restLen * ratio;
    const jitter = Math.sin(f.t * 3) * 6;
    poly(f, [[cx - movLen / 2 + jitter, y2 - 16], [cx + movLen / 2 + jitter, y2 - 16], [cx + movLen / 2 + jitter, y2 + 16], [cx - movLen / 2 + jitter, y2 + 16]],
      { stroke: C.hot, lw: 2.4, fill: 'rgba(237,137,54,0.24)' } as any);
    text(f, `运动长度 L = L₀/γ = ${(ratio * 100).toFixed(0)}% L₀（γ=${gamma.toFixed(2)}）`, cx - movLen / 2, y2 + 36, { color: C.hot, font: '13px sans-serif' });
    // 虚线对齐
    poly(f, [[cx - restLen / 2, y1 + 16], [cx - restLen / 2, y2 + 16]], { stroke: `${C.dim}77`, lw: 1, dash: [5, 4] });
    poly(f, [[cx + restLen / 2, y1 + 16], [cx + restLen / 2, y2 + 16]], { stroke: `${C.dim}77`, lw: 1, dash: [5, 4] });
    text(f, 'v→c：运动的杆缩成一条线——只在运动方向收缩', 30, 44, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      "尺缩不是'压扁'，而是同时测量两端的位置差变小——时空几何的投影效应",
      '菲茨杰拉德-洛伦兹收缩先于相对论被提出（为解释以太风），爱因斯坦给了它新地基',
      'LHC 的 27km 环在实验室系不动；环上粒子看来整条环缩到约 18m——互为镜像的描述',
    ]);
    heading(f, '长度收缩：运动方向的几何效应');
  },
});
registerViz(lengthContraction);

/** 对撞机质心能量。 */
const collidingBeams = defineViz({
  slug: 'colliding-beams', title: '对撞机与质心能量', animated: true,
  params: {
    mode: { type: 'select', options: ['固定靶（束流撞静靶）', '对撞（两束迎头）'], default: '对撞（两束迎头）', label: '模式' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const collider = String((params as Record<string, unknown>)['mode'] ?? '').includes('对撞');
    const E = 7; // 每束 7 TeV（LHC）
    const fixed = 2 * 7 * 7 * 0.938 / (0.938); // √s 固定靶 ≈ 2√(E·m)
    const sFixed = Math.sqrt(2 * E * 0.938 * 1000); // GeV 量级示意
    const sCollider = 2 * E * 1000; // GeV
    clear(f);
    const cy = h / 2 + 6;
    if (collider) {
      const prog = (f.t * 0.5) % 1;
      const xL = w * 0.1 + prog * (w * 0.4);
      const xR = w * 0.9 - prog * (w * 0.4);
      dot(f, xL, cy, 9, C.hot);
      dot(f, xR, cy, 9, C.cool);
      seg(f, xL + 14, cy, xL + 54, cy, `${C.hot}aa`, 2.4);
      seg(f, xR - 14, cy, xR - 54, cy, `${C.cool}aa`, 2.4);
      if (Math.abs(xL - xR) < 90) {
        const flash = 1 - Math.abs(xL - xR) / 90;
        f.ctx.beginPath(); f.ctx.arc((xL + xR) / 2, cy, 40 * flash + 8, 0, Math.PI * 2);
        f.ctx.fillStyle = `rgba(255,240,180,${flash * 0.7})`; f.ctx.fill();
      }
      text(f, `对撞 √s ≈ ${sCollider} GeV 级（LHC 13.6 TeV）：能量全用于造新粒子`, 30, 44, { color: C.green, font: '14px sans-serif' });
      text(f, '迎头对撞的质心能量 ∝ E——发现希格斯与顶夸克的唯一高效方式', 30, 66, { color: C.cyan, font: '12px sans-serif' });
    } else {
      const prog = (f.t * 0.5) % 1;
      const xL = w * 0.08 + prog * (w * 0.55);
      dot(f, xL, cy, 9, C.hot);
      dot(f, w * 0.78, cy, 14, C.dim);
      text(f, '静靶', w * 0.78 - 16, cy + 34, { color: C.dim, font: '11px sans-serif' });
      text(f, `固定靶 √s ≈ ${sFixed.toFixed(0)} GeV 量级：质心能量 ∝ √E，大部分动能浪费在整体运动`, 30, 44, { color: C.hot, font: '13px sans-serif' });
      text(f, '同样 7TeV 束流，固定靶的有效能量低一个量级以上', 30, 66, { color: C.cyan, font: '12px sans-serif' });
    }

    footnotes(f, [
      '爱因斯坦方程 s=(E₁+E₂)²−(p₁+p₂)² 决定可创造的新质量——对撞机比的就是 √s',
      '费米实验室 Tevatron 与 CERN LHC 都选对撞模式：省能量、创质量的正解',
      'LHC 每次对撞把质心推到 13.6TeV——大爆炸后 0.1 微秒的温度重现',
    ]);
    heading(f, '对撞机：把动能变成质量');
  },
});
registerViz(collidingBeams);
