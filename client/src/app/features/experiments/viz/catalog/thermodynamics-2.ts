import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** P99 斯特林循环。 */
const stirling = defineViz({
  slug: 'stirling', title: '斯特林循环', animated: true,
  params: {
    Tcold: { type: 'range', min: 250, max: 450, default: 300, step: 10, label: '低温热源 T_L (K)' },
    Thot: { type: 'range', min: 500, max: 1100, default: 800, step: 20, label: '高温热源 T_H (K)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const TL = num(params, 'Tcold', 300), TH = num(params, 'Thot', 800);
    const eta = 1 - TL / TH;
    clear(f);
    const vv = view(f, { xMin: 0.4, xMax: 2.4, yMin: 0.6, yMax: 3.4, inset: 52 });
    grid(f, vv, { divisions: 4, ticks: true });
    // 卡诺式四程示意：等温吸热→等容→等温放热→等容
    const v1 = 1.0, v2 = 2.0;
    const s1 = 3.0, s2 = 1.6;
    const cycle: [number, number][] = [
      [vv.sx(v1), vv.sy(s1)],
      [vv.sx(v2), vv.sy(s1)],   // 等温膨胀（T_H）
      [vv.sx(v2), vv.sy(s2)],   // 等容冷却
      [vv.sx(v1), vv.sy(s2)],   // 等温压缩（T_L）
      [vv.sx(v1), vv.sy(s1)],   // 等容加热
    ];
    poly(f, cycle, { stroke: C.accent, lw: 2.6, dash: [7, 5] });
    // 行进点
    const prog = (f.t * 0.25) % 1;
    const idx = prog * 4;
    const seg2 = Math.floor(idx), tt = idx - seg2;
    const a = cycle[seg2], b = cycle[(seg2 + 1) % 4];
    dot(f, a[0] + (b[0] - a[0]) * tt, a[1] + (b[1] - a[1]) * tt, 7, C.warm);
    text(f, `η = 1 − T_L/T_H = ${(eta * 100).toFixed(1)}%`, 30, 44, { color: C.green, font: '14px sans-serif' });
    text(f, '横轴 V、纵轴 p·V/T（示意熵坐标）', vv.sx(vv.xMax) - 4, vv.sy(vv.yMin) + 20, { align: 'right', color: C.dim, font: '11px sans-serif' });
    text(f, `T_H=${TH}K、T_L=${TL}K`, 30, 66, { color: C.cyan, font: '12px sans-serif' });
    void f;

    footnotes(f, [
      '等温膨胀吸热、等温压缩放热，中间用回热器储放热——理想效率逼近卡诺极限',
      '斯特林发动机外燃、安静、可烧任何热源：太阳能碟式发电与潜艇 AIP 系统的选项',
      '回热器是斯特林的灵魂：把压缩行程的放热存起来还给膨胀行程',
    ]);
    heading(f, '斯特林循环：回热造就的效率');
  },
});
registerViz(stirling);

/** P100 奥托循环。 */
const otto = defineViz({
  slug: 'otto', title: '奥托循环', animated: true,
  params: {
    r: { type: 'range', min: 4, max: 14, default: 10, step: 0.5, label: '压缩比 r' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const r = num(params, 'r', 10);
    const eta = 1 - Math.pow(r, 1 - 1.4);
    clear(f);
    const vv = view(f, { xMin: 0.6, xMax: 3.2, yMin: 0.4, yMax: 4.6, inset: 52 });
    grid(f, vv, { divisions: 4, ticks: true });
    const vc = 1.0, ve = r / 6;
    const pc = 1.4, pe = 1.4 * Math.pow(ve / vc, -1.4);
    const pMax = pe * 3.2, vMax = vc * 3;
    const cycle: [number, number][] = [
      [vv.sx(vc), vv.sy(pc)],       // 压缩始
      [vv.sx(ve), vv.sy(pe)],       // 压缩终
      [vv.sx(ve), vv.sy(pMax)],     // 定容加热（燃烧）
      [vv.sx(vMax), vv.sy(pMax * 0.35)],  // 膨胀做功
      [vv.sx(vc), vv.sy(pc)],       // 定容放热
    ];
    poly(f, cycle, { stroke: C.accent, lw: 2.6 });
    const prog = (f.t * 0.3) % 1;
    const idx = prog * 4;
    const s = Math.floor(idx), t2 = idx - s;
    const a = cycle[s], b = cycle[(s + 1) % cycle.length];
    dot(f, a[0] + (b[0] - a[0]) * t2, a[1] + (b[1] - a[1]) * t2, 7, C.warm);
    text(f, `η = 1 − r^(1−γ) = ${(eta * 100).toFixed(1)}%（γ=1.4）`, 30, 44, { color: C.green, font: '14px sans-serif' });
    text(f, `压缩比 r=${r}：${r > 11 ? '接近爆震极限，需高辛烷汽油' : '常规汽油机区间'}`, 30, 66, { color: r > 11 ? C.hot : C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      '四冲程：吸气→压缩→点火做功→排气，效率只由压缩比与气体性质决定',
      '提高压缩比是省油的第一杠杆，但过高压缩引发爆震（末端混合气自燃）',
      '柴油机压缩比更高（14~22）且靠压燃，所以同排量更省油更有力',
    ]);
    heading(f, '奥托循环：汽油机的心跳');
  },
});
registerViz(otto);

/** P101 焦耳-汤姆孙膨胀。 */
const jouleThomson = defineViz({
  slug: 'joule-thomson', title: '焦耳-汤姆孙膨胀', animated: true,
  params: {
    T: { type: 'range', min: 100, max: 400, default: 250, step: 10, label: '入口温度 (K)' },
    kind: { type: 'select', options: ['室温氮气', '室温氢气（反转温下）'], default: '室温氮气', label: '气体/工况' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const Tin = num(params, 'T', 250);
    const h2 = String((params as Record<string, unknown>)['kind'] ?? '').includes('氢');
    // 焦-汤系数示意：N2 室温为正（降温），H2 室温为负（升温）
    const mu = h2 ? -0.06 : 0.18;
    const Tout = Tin + mu * (Tin - 100) * 0.6;
    const cools = mu > 0;
    clear(f);
    // 多孔塞节流装置
    const cx = w * 0.42, cy = h / 2 + 6;
    poly(f, [[cx - 170, cy - 44], [cx - 10, cy - 44], [cx - 10, cy + 44], [cx - 170, cy + 44]],
      { stroke: C.dim, lw: 2, fill: 'rgba(100,116,139,0.18)' } as any);
    // 多孔塞
    for (let i = -4; i <= 4; i++) dot(f, cx, cy + i * 9, 3, C.dim);
    text(f, '多孔塞（节流）', cx - 76, cy - 56, { color: C.dim, font: '11px sans-serif' });
    // 活塞与流动箭头
    poly(f, [[cx - 190, cy - 44], [cx - 184, cy - 44], [cx - 184, cy + 44], [cx - 190, cy + 44]], { stroke: C.warm, lw: 2, fill: C.warm } as any);
    seg(f, cx - 160, cy, cx - 30, cy, `${C.cyan}aa`, 2);
    for (let i = 0; i < 5; i++) {
      const x = cx + 30 + i * 44 + ((f.t * 40) % 44);
      seg(f, x, cy, x + 18, cy, `${cools ? C.cool : C.hot}aa`, 2.4);
      poly(f, [[x + 24, cy], [x + 16, cy - 5], [x + 16, cy + 5]], { stroke: cools ? C.cool : C.hot, lw: 1.2, fill: cools ? C.cool : C.hot } as any);
    }
    // 温度显示
    text(f, `T_in = ${Tin} K → T_out ≈ ${Tout.toFixed(1)} K`, 30, 44, { color: C.cyan, font: '14px sans-serif' });
    text(f, cools ? 'μ_JT > 0：节流后降温 — 空气液化与冰箱的物理内核' : 'μ_JT < 0：节流后升温 — 氢氦在室温必须先预冷（林德工艺的教训）',
      30, 66, { color: cools ? C.green : C.hot, font: '12px sans-serif' });
    text(f, '等焓过程 h_in = h_out（压力下降但焓不变）', cx - 60, h - 34, { color: C.dim, font: '12px sans-serif' });

    footnotes(f, [
      "焦-汤系数 μ = (∂T/∂p)_h 决定降温还是升温——每种气体有自己的'反转温度'曲线",
      '1908 年卡末林-昂内斯正是用多级节流把氦液化到 4.2K，打开超导世界的大门',
      '空调、冰箱、气体分离工业全部站在节流膨胀这一边——不用运动部件的制冷',
    ]);
    heading(f, '节流膨胀：让气体自己变冷');
  },
});
registerViz(jouleThomson);

/** P102 一维热传导。 */
const heatConductionRod = defineViz({
  slug: 'heat-conduction-rod', title: '一维热传导', animated: true,
  params: {
    k: { type: 'range', min: 0.5, max: 8, default: 2, step: 0.1, label: '热导率 κ（相对）' },
    Tl: { type: 'range', min: 100, max: 500, default: 400, step: 10, label: '左端温度 (K)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const k = num(params, 'k', 2), Tl = num(params, 'Tl', 400);
    const Tr = 300;
    clear(f);
    const x0 = 70, x1 = w - 70, rodY = h * 0.4;
    // 金属棒
    poly(f, [[x0, rodY], [x1, rodY], [x1, rodY + 34], [x0, rodY + 34]], { stroke: C.dim, lw: 2, fill: 'rgba(100,116,139,0.22)' } as any);
    // 温度剖面：瞬态扩散（左热右冷），t 大→线性稳态
    const prof: [number, number][] = [];
    const tau = (f.t * 0.5) % 3;
    for (let i = 0; i <= 120; i++) {
      const x = i / 120;
      // 稳态线性 + 瞬态高斯扩散项（示意）
      const steady = Tl + (Tr - Tl) * x;
      const transient = (Tl - Tr) * 0.5 * (1 - x) * Math.exp(-tau * k * 1.2);
      const T = steady + transient * Math.exp(-Math.pow((x - 0.15) * 3, 2));
      prof.push([x0 + x * (x1 - x0), rodY - 12 - ((T - 250) / 300) * 110]);
    }
    poly(f, prof, { stroke: C.hot, lw: 2.8 });
    // 热流方向
    for (let i = 1; i < 7; i++) {
      const x = x0 + (i / 7) * (x1 - x0);
      const ph = ((f.t * 60 + i * 40) % (x1 - x0));
      const px2 = x0 + ph;
      if (px2 < x1) poly(f, [[px2, rodY + 17], [px2 - 10, rodY + 12], [px2 - 10, rodY + 22]], { stroke: C.warm, lw: 1.4, fill: C.warm } as any);
    }
    text(f, `T_L=${Tl}K`, x0 - 24, rodY + 54, { color: C.hot, font: '11px sans-serif' });
    text(f, `T_R=${Tr}K`, x1 - 16, rodY + 54, { color: C.cool, font: '11px sans-serif' });
    text(f, `∂T/∂t = κ·∂²T/∂x²　κ=${k}：${k > 4 ? '快，迅速趋近线性稳态' : '慢，剖面鼓包持久'}`, 30, 44, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '傅里叶定律 q = −κ·∇T：热流密度正比于温度梯度，方向由热指向冷',
      '稳态时温度剖面是直线（一维），热阻 R = L/(κA)——串联热阻像电阻一样叠加',
      '隔热材料把 κ 压到极低，保温瓶的真空夹层连传导与对流都一并省掉',
    ]);
    heading(f, '热传导：从鼓包到直线');
  },
});
registerViz(heatConductionRod);

/** P103 温熵图。 */
const tsDiagram = defineViz({
  slug: 'ts-diagram', title: '温熵图', animated: true,
  params: {
    kind: { type: 'select', options: ['卡诺循环', '朗肯循环（蒸汽动力）'], default: '卡诺循环', label: '循环' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const rankine = String((params as Record<string, unknown>)['kind'] ?? '').includes('朗肯');
    clear(f);
    const vv = view(f, { xMin: 0, xMax: 10, yMin: 0.4, yMax: 7.2, inset: 52 });
    grid(f, vv, { divisions: 4, ticks: true });
    if (!rankine) {
      const loop: [number, number][] = [
        [vv.sx(2), vv.sy(6.4)], [vv.sx(7), vv.sy(6.4)],
        [vv.sx(7), vv.sy(2.2)], [vv.sx(2), vv.sy(2.2)],
      ];
      poly(f, loop, { stroke: C.accent, lw: 2.6, dash: [8, 5] });
      const prog = (f.t * 0.25) % 1;
      const idx = prog * 4, s = Math.floor(idx), t = idx - s;
      const a = loop[s], b = loop[(s + 1) % 4];
      dot(f, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 7, C.warm);
      text(f, '卡诺循环 = T-S 平面上的长方形', 30, 44, { color: C.cyan, font: '14px sans-serif' });
      text(f, `面积 = 吸收净热 = 对外做功　η = 1 − T_L/T_H`, 30, 66, { color: C.green, font: '12px sans-serif' });
    } else {
      // 朗肯循环（含两相区）
      const cycle: [number, number][] = [
        [vv.sx(1.4), vv.sy(1.6)], [vv.sx(3.6), vv.sy(1.6)],
        [vv.sx(6.4), vv.sy(5.6)], [vv.sx(2.4), vv.sy(6.6)],
      ];
      poly(f, cycle, { stroke: C.accent, lw: 2.6, dash: [8, 5] });
      const prog = (f.t * 0.22) % 1;
      const idx = prog * 4, s = Math.floor(idx), t2 = idx - s;
      const a = cycle[s], b = cycle[(s + 1) % 4];
      dot(f, a[0] + (b[0] - a[0]) * t2, a[1] + (b[1] - a[1]) * t2, 7, C.warm);
      text(f, '朗肯循环：锅炉吸热→汽轮机膨胀→冷凝→泵回', 30, 44, { color: C.cyan, font: '13px sans-serif' });
      text(f, '两相区的水平段 = 等温冷凝（蒸汽电厂的循环骨架）', 30, 66, { color: C.warm, font: '12px sans-serif' });
    }
    text(f, 'T (K)', vv.sx(0.05), vv.sy(7.0), { color: C.dim, font: '12px sans-serif' });
    text(f, 'S', vv.sx(vv.xMax) - 8, vv.sy(vv.yMin) + 20, { align: 'right', color: C.dim, font: '12px sans-serif' });

    footnotes(f, [
      'T-S 图的妙处：可逆过程的线下面积=热量，循环面积=净功——图形直接读能量',
      '等温线越靠上，卡诺效率越高：蒸汽电厂提高蒸汽温度（超超临界）正是在推高上边',
      '相变区的水平段说明：沸腾与冷凝时温度不变，潜热全用在改变状态上',
    ]);
    heading(f, '温熵图：把循环画成面积');
  },
});
registerViz(tsDiagram);

/** P104 制冷循环。 */
const refrigeration = defineViz({
  slug: 'refrigeration', title: '制冷循环', animated: true,
  params: {
    cop: { type: 'range', min: 1.5, max: 7, default: 4, step: 0.1, label: '制冷系数 COP' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const cop = num(params, 'cop', 4);
    clear(f);
    // 四部件环（压缩机→冷凝→节流→蒸发）
    const cx = w / 2, cy = h / 2 + 6;
    const rx = Math.min(w, h) * 0.3, ry = rx * 0.62;
    const parts = [
      { name: '压缩机（耗功 W）', ang: -Math.PI / 2, color: C.hot },
      { name: '冷凝器（放热给室外）', ang: 0, color: '#ff9800' },
      { name: '节流阀（降压降温）', ang: Math.PI / 2, color: C.cool },
      { name: '蒸发器（从冰箱吸热 Q_L）', ang: Math.PI, color: C.green },
    ];
    // 环线
    const ring: [number, number][] = [];
    for (let a = 0; a <= Math.PI * 2; a += 0.05) ring.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
    poly(f, ring, { stroke: `${C.dim}aa`, lw: 2 });
    // 流动粒子（逆时针：制冷方向）
    for (let k = 0; k < 8; k++) {
      const a = -(f.t * 0.7 + (k / 8) * Math.PI * 2);
      dot(f, cx + rx * Math.cos(a), cy + ry * Math.sin(a), 5, C.warm);
    }
    for (const p of parts) {
      const x = cx + rx * Math.cos(p.ang), y = cy + ry * Math.sin(p.ang);
      dot(f, x, y, 13, p.color);
      const ly = p.ang === -Math.PI / 2 ? y - 24 : p.ang === Math.PI / 2 ? y + 30 : y + 5;
      const lx = p.ang === 0 ? x - 8 : p.ang === Math.PI ? x - 150 : x;
      text(f, p.name, lx, ly, { align: p.ang === 0 ? 'center' : undefined, color: p.color, font: '11px sans-serif' } as any);
    }
    text(f, `COP = Q_L / W = ${cop.toFixed(1)}：每耗 1J 电，搬走 ${cop.toFixed(1)}J 热`, 30, 44, { color: C.green, font: '14px sans-serif' });
    text(f, "热量只能'从冷处被搬运'——代价是付功，制冷永不违逆热二律", 30, 66, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      '制冷循环是逆卡诺：外界做功把热量从低温热源搬到高温热源（冰箱内→厨房）',
      'COP 受温差制约：内外温差越大 COP 越低——空调最热天最费电的定量解释',
      '变频压缩机按需调功，避免启停损耗——现代空调把平均 COP 又抬高了一截',
    ]);
    heading(f, '制冷循环：逆着自然搬热量');
  },
});
registerViz(refrigeration);

/** P105 配分函数与自由能。 */
const partitionFunction = defineViz({
  slug: 'partition-function', title: '配分函数与自由能',
  params: {
    T: { type: 'range', min: 0.5, max: 6, default: 2, step: 0.1, label: '温度 (kT 单位)' },
    levels: { type: 'range', min: 3, max: 8, default: 5, step: 1, label: '能级数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const T = num(params, 'T', 2);
    const n = Math.round(num(params, 'levels', 5));
    clear(f);
    const cx = w / 2;
    // 能级与玻尔兹曼占据
    let Z = 0;
    const weights: number[] = [];
    for (let i = 0; i < n; i++) {
      const E = i;
      const p = Math.exp(-E / T);
      weights.push(p);
      Z += p;
    }
    const yBase = h - 80;
    for (let i = 0; i < n; i++) {
      const y = yBase - i * (h - 150) / n;
      const occ = weights[i] / Z;
      const barW = 46 + occ * (w - 200);
      seg(f, cx - barW, y, cx + barW, y, C.cool, 2.4);
      // 占据概率填充
      poly(f, [[cx - barW, y - 7], [cx - barW + occ * barW * 2, y - 7], [cx - barW + occ * barW * 2, y + 7], [cx - barW, y + 7]],
        { stroke: 'transparent', fill: 'rgba(237,137,54,0.75)' } as any);
      text(f, `E=${i}ε　p=${(occ * 100).toFixed(1)}%`, cx + barW + 10, y + 4, { color: C.dim, font: '11px sans-serif' });
    }
    text(f, `Z = Σe^(−Eᵢ/kT) = ${Z.toFixed(3)}　F = −kT·lnZ`, 30, 44, { color: C.cyan, font: '14px sans-serif' });
    text(f, T > 3 ? '高温：各能级占据趋均（Z 大，熵大）' : T < 1.2 ? '低温：几乎都挤在基态（Z→1，熵→0）' : '温度居中：指数衰减的占据阶梯', 30, 66, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      "配分函数把全部微观状态'配分'成概率——它是统计力学的生成函数",
      '知道 Z 就知道一切：内能、熵、自由能、压强、热容全可由 lnZ 的导数导出',
      '第三定律的体现：T→0 时 Z→基态一项，熵趋于零——完美晶体的终点',
    ]);
    heading(f, '配分函数：一个求和统管全部热力学');
  },
});
registerViz(partitionFunction);

/** P106 德拜比热。 */
const debyeSpecificHeat = defineViz({
  slug: 'debye-specific-heat', title: '德拜比热',
  params: {
    Td: { type: 'range', min: 100, max: 600, default: 300, step: 10, label: '德拜温度 Θ_D (K)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const Td = num(params, 'Td', 300);
    clear(f);
    const x0 = 56, x1 = w - 30, y0 = h - 56, y1 = 56;
    seg(f, x0, y0, x1, y0, C.grid, 1.3);
    seg(f, x0, y0, x0, y1, C.grid, 1.3);
    const Tmax = Td * 2.2;
    const sx = (T: number) => x0 + (T / Tmax) * (x1 - x0);
    const sy = (cv: number) => y0 - (cv / 3.6) * (y0 - y1); // 以 3R 为上限
    // 德拜曲线（示意：低温 T³ 上升 → 高温饱和 3R）
    const pts: [number, number][] = [];
    for (let i = 1; i <= 300; i++) {
      const T = (i / 300) * Tmax;
      const x = T / Td;
      const cv = x < 0.3 ? 3 * Math.pow(x, 3) : 3 * (1 - Math.min(0.05, 3 / (x * x * x * 8)));
      pts.push([sx(T), sy(Math.min(cv, 3))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.8 });
    // 经典极限线 3R
    seg(f, x0, sy(3), x1, sy(3), `${C.green}aa`, 1.4);
    text(f, '3R（杜隆-珀替经典极限）', x1 - 60, sy(3) - 8, { align: 'right', color: C.green, font: '11px sans-serif' });
    // 低温 T³ 线
    const t3: [number, number][] = [];
    for (let i = 1; i <= 80; i++) {
      const T = (i / 80) * Tmax * 0.4;
      t3.push([sx(T), sy(3 * Math.pow(T / Td, 3))]);
    }
    poly(f, t3, { stroke: `${C.hot}aa`, lw: 1.6, dash: [6, 4] } as any);
    dot(f, sx(Td), sy(3 * 0.72), 6, C.warm);
    text(f, `Θ_D=${Td}K：此温度以上趋近 3R`, sx(Td) + 8, sy(3 * 0.72) - 10, { color: C.warm, font: '11px sans-serif' });
    text(f, '温度 (K)', x1 - 4, y0 + 18, { align: 'right', color: C.dim, font: '12px sans-serif' });
    text(f, 'C_V', x0 + 6, y1 - 6, { color: C.accent, font: '12px sans-serif' });

    footnotes(f, [
      '爱因斯坦模型先解出低温指数衰减，德拜改数声子态密度得 T³——与实验完美吻合',
      '低温 C ∝ T³ 是晶格振动量子化的铁证：冻结的声子只剩低频长波在贡献',
      "金刚石 Θ_D≈2200K，室温比热仍明显低于 3R；铅 Θ_D≈105K，早就饱和——软硬有'量子出身'的差别",
    ]);
    heading(f, '德拜比热：低温 T³ 定律');
  },
});
registerViz(debyeSpecificHeat);
