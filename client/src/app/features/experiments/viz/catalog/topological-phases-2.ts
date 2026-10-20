import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** 陈绝缘体与陈数。 */
const chernInsulator = defineViz({
  slug: 'chern-insulator', title: '陈绝缘体与陈数', animated: true,
  params: {
    gap: { type: 'range', min: 0.1, max: 2, default: 1, step: 0.1, label: '拓扑能隙' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    clear(f);
    // 能带（手性边态穿过体隙）
    const x0 = 70, y0 = h - 66, y1 = 74;
    const vv = view(f, { xMin: -Math.PI, xMax: Math.PI, yMin: -2.6, yMax: 2.6, inset: 50 });
    grid(f, vv, { divisions: 4, ticks: true });
    // 体态（上下带）
    const up: [number, number][] = [], dn: [number, number][] = [];
    for (let i = 0; i <= 240; i++) {
      const k = -Math.PI + (i / 240) * Math.PI * 2;
      const E = Math.sqrt(Math.sin(k) ** 2 + 0.6);
      up.push([vv.sx(k), vv.sy(E * 1.05)]);
      dn.push([vv.sx(k), vv.sy(-E * 1.05)]);
    }
    poly(f, up, { stroke: C.cool, lw: 2.6 });
    poly(f, dn, { stroke: C.cool, lw: 2.6 });
    // 手性边态（线性穿过费米能）
    const edge: [number, number][] = [];
    for (let i = 0; i <= 240; i++) {
      const k = -Math.PI + (i / 240) * Math.PI * 2;
      edge.push([vv.sx(k), vv.sy(Math.sin(k) * 1.5)]);
    }
    poly(f, edge, { stroke: C.hot, lw: 3.4 });
    // 行进的边缘态载流子
    const t = (f.t * 0.5) % 1;
    const kNow = -Math.PI + t * Math.PI * 2;
    dot(f, vv.sx(kNow), vv.sy(Math.sin(kNow) * 1.5), 7, C.warm);
    void x0; void y0;
    text(f, '红=受拓扑保护的手性边态：穿过体能隙、单向导电（背散射被禁）', 30, 44, { color: C.hot, font: "14px sans-serif" });
    text(f, '陈数 C=(1/2π)∫_BZ Ω d²k = 1：整数不变量保证边态数——扰动改不掉', 30, 68, { color: C.cyan, font: "12px sans-serif" });

    footnotes(f, [
      '陈绝缘体：体态绝缘、边缘态导电且受拓扑保护——量子反常霍尔效应的载体',
      'TKNN 不变量把霍尔电导量子化到 e²/h 的整数倍——拓扑相的严格判据',
      '碲化铋/磁性掺杂体系的量子反常霍尔效应（薛其坤团队 2013）——无耗散边缘通道',
    ]);
    heading(f, '陈绝缘体：整数保护的边缘通道');
  },
});
registerViz(chernInsulator);

/** 任意子。 */
const anyon = defineViz({
  slug: 'anyon', title: '任意子与统计', animated: true,
  params: {
    kind: { type: 'select', options: ['交换相位', '辫群（二维）'], default: '交换相位', label: '演示' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const braid = String((params as Record<string, unknown>)['kind'] ?? '').includes('辫');
    clear(f);
    if (!braid) {
      // 交换路径与相位标尺
      const y1 = h * 0.34, y2 = h * 0.62;
      const xA = w * 0.2, xB = w * 0.8;
      const prog = (f.t * 0.4) % 1;
      const ax = xA + (xB - xA) * prog, bx = xB - (xB - xA) * prog;
      dot(f, ax, y1, 13, C.cool);
      dot(f, bx, y2, 13, C.warm);
      // 交换轨迹
      const pa: [number, number][] = [], pb: [number, number][] = [];
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        pa.push([xA + t * (xB - xA), y1 + Math.sin(t * Math.PI) * (y2 - y1) * 0.6]);
        pb.push([xB - t * (xB - xA), y2 - Math.sin(t * Math.PI) * (y2 - y1) * 0.6]);
      }
      poly(f, pa, { stroke: `${C.cool}77`, lw: 2 });
      poly(f, pb, { stroke: `${C.warm}77`, lw: 2 });
      // 三种统计对照
      const stats: [string, string, string][] = [
        ['玻色子（3D）', '交换 → +1（无事发生）', C.cool],
        ['费米子（3D）', '交换 → −1（反对称）', C.warm],
        ['任意子（2D）', '交换 → e^(iθ)（任意相位）', '#9254de'],
      ];
      for (let i = 0; i < stats.length; i++) {
        const y = h * 0.78 + 0;
        text(f, `${stats[i][0]}：${stats[i][1]}`, 40 + (i % 1) * 0, h * 0.74 + i * 34, { color: stats[i][2], font: '13px sans-serif' });
      }
      text(f, '二维才有任意子：交换的历史是路径而非置换——辫群代替对称群', 30, 44, { color: C.cyan, font: "14px sans-serif" });
      void y2;
    } else {
      // 辫群（世界线编织）
      const x0 = w * 0.2, x1 = w * 0.8;
      const strands: [number, number][][] = [[], [], []];
      const phase = f.t;
      for (let i = 0; i <= 80; i++) {
        const t = i / 80;
        const x = x0 + t * (x1 - x0);
        for (let s = 0; s < 3; s++) {
          const base = h * 0.3 + s * h * 0.2;
          const weave = Math.sin(t * Math.PI * 2 + phase + s * 2.1) * h * 0.09;
          strands[s].push([x, base + weave]);
        }
      }
      const colors = [C.cool, C.warm, '#9254de'];
      for (let s = 0; s < 3; s++) poly(f, strands[s], { stroke: colors[s], lw: 3 });
      dot(f, x1, strands[0][80][1], 8, colors[0]);
      dot(f, x1, strands[1][80][1], 8, colors[1]);
      dot(f, x1, strands[2][80][1], 8, colors[2]);
      text(f, '世界线在 2+1 维时空中编织——辫群元素编码交换的历史', 30, 44, { color: C.cyan, font: "14px sans-serif" });
      text(f, '非阿贝尔任意子的编织=对量子比特做门操作——拓扑量子计算', 30, h - 34, { color: C.warm, font: "12px sans-serif" });
    }

    footnotes(f, [
      '任意子（Wilczek 1982 命名）：二维体系的交换统计既非 +1 也非 −1',
      '分数量子霍尔态中的任意子带分数电荷与分数统计——Laughlin 波函数的激发',
      '非阿贝尔任意子（Ising/Majorana）编织即量子门——拓扑量子计算的抗噪逻辑（Kitaev）',
    ]);
    heading(f, '任意子：二维世界的统计自由度');
  },
});
registerViz(anyon);

/** 拓扑不变量。 */
const topologicalInvariant = defineViz({
  slug: 'topological-invariant', title: '拓扑不变量', animated: true,
  params: {
    kind: { type: 'select', options: ['亏格（甜甜圈数）', '陈数积分'], default: '亏格（甜甜圈数）', label: '不变量' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const chern = String((params as Record<string, unknown>)['kind'] ?? '').includes('陈');
    clear(f);
    if (!chern) {
      // 曲面形变但亏格不变
      const cx = w * 0.3, cy = h / 2 + 6;
      const wob = Math.sin(f.t) * 0.3;
      // 环面（参数曲面投影）
      const pts: [number, number][] = [];
      const back: [number, number][] = [];
      for (let u = 0; u <= Math.PI * 2 + 0.1; u += 0.1) {
        const R1 = 70 * (1 + wob * 0.3), R2 = 34 * (1 - wob * 0.3);
        const x = cx + (R1 + R2 * Math.cos(u)) * 1.0;
        const y = cy + R2 * Math.sin(u) * 0.8;
        pts.push([x, y]);
        back.push([x, y - 40 - 10 * Math.sin(f.t + u)]);
      }
      poly(f, back, { stroke: `${C.cool}88`, lw: 2 });
      poly(f, [...pts, pts[0]], { stroke: C.cool, lw: 2.6 });
      // 内孔
      const hole: [number, number][] = [];
      for (let u = 0; u <= Math.PI * 2 + 0.1; u += 0.12) {
        hole.push([cx + 70 + Math.cos(u) * 34, cy + Math.sin(u) * 27]);
      }
      poly(f, [...hole, hole[0]], { stroke: C.cool, lw: 2.2 });
      text(f, `g = ${1}（亏格：甜甜圈的洞数）`, cx - 80, cy + 96, { color: C.warm, font: '15px sans-serif' });
      // 形变保持
      text(f, '压扁、拉伸、揉捏都不改变洞的数量——微分不同、拓扑相同', cx - 150, 44, { color: C.cyan, font: "14px sans-serif" });
      text(f, 'χ = 2 − 2g（欧拉示性数）：环面 χ=0，球面 χ=2', cx - 150, 68, { color: C.green, font: "13px sans-serif" });
      // 对照：破洞的形变不行
      const cx2 = w * 0.74;
      poly(f, [[cx2 - 60, cy - 50], [cx2 + 60, cy - 50], [cx2 + 40, cy + 50], [cx2 - 40, cy + 50]],
        { stroke: `${C.dim}aa`, lw: 2.4 } as any);
      text(f, '球壳（g=0）', cx2 - 34, cy + 76, { color: C.dim, font: '13px sans-serif' });
      text(f, 'g=1 vs g=0：拓扑相变需要撕裂', cx2 - 66, cy - 76, { color: C.hot, font: '12px sans-serif' });
    } else {
      // 陈数（布里渊区积分）
      const cx = w * 0.36, cy = h / 2 + 10;
      const S = Math.min(w, h) * 0.26;
      const pts: [number, number][] = [];
      for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.06) pts.push([cx + S * Math.cos(a), cy + S * Math.sin(a)]);
      poly(f, [...pts, pts[0]], { stroke: C.dim, lw: 2 });
      // 曲率密度（颜色斑）
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 + f.t * 0.3;
        const rr = S * (0.3 + 0.5 * ((k * 37) % 70) / 100);
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        dot(f, x, y, 12, k % 3 === 0 ? C.hot : C.cool);
      }
      text(f, 'Ω(k)：布里渊区上的曲率分布', cx - 90, cy + S + 30, { color: C.cool, font: '12px sans-serif' });
      text(f, `C = (1/2π)∫_BZ Ω(k) d²k = ${Math.round(1 + Math.sin(f.t) * 0.0)}`, w * 0.6, h * 0.4, { color: C.warm, font: '20px serif' });
      text(f, '局域曲率可连续变化，总和只能是整数——量子化的拓扑根源', w * 0.58, h * 0.4 + 40, { color: C.cyan, font: "13px sans-serif" });
      text(f, '（高斯-博内定理的动量空间版本：∮K dA = 2πχ）', w * 0.58, h * 0.4 + 76, { color: C.green, font: "12px sans-serif" });
    }

    footnotes(f, [
      '拓扑不变量对连续形变免疫——整数量子化天然抵抗扰动，这正是拓扑保护的含义',
      '从高斯-博内到陈-西蒙斯形式：几何的整体不变量是拓扑物态的数学骨架',
      '能带陈数、Z₂ 不变量、缠绕数……凝聚态的新分类表全部由拓扑量写成',
    ]);
    heading(f, '拓扑不变量：怎么形变都不变的数');
  },
});
registerViz(topologicalInvariant);

/** 边缘态与体边对应。 */
const edgeState = defineViz({
  slug: 'edge-state', title: '边缘态与体边对应', animated: true,
  params: {
    gap: { type: 'range', min: 0.2, max: 2, default: 1, step: 0.1, label: '体能隙（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    clear(f);
    // 材料样品（左体态、右边缘导电）
    const x0 = w * 0.16, x1 = w * 0.84, y0 = h * 0.3, y1 = h * 0.66;
    poly(f, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
      { stroke: C.dim, lw: 2.4, fill: 'rgba(100,116,139,0.10)' } as any);
    text(f, '拓扑材料体态（绝缘）', (x0 + x1) / 2 - 70, y0 - 14, { color: C.dim, font: '12px sans-serif' });
    // 体态（无载流子——暗）
    for (let k = 0; k < 14; k++) {
      const x = x0 + 40 + k * ((x1 - x0 - 80) / 14);
      const y = y0 + 30 + (k % 3) * 34;
      dot(f, x, y, 5, `${C.dim}66`);
    }
    // 上边缘单向流动
    const dir = Math.sin(f.t * 0.5) > -2 ? 1 : 1;
    for (let k = 0; k < 6; k++) {
      const t = ((f.t * 0.6 + k / 6) % 1);
      const x = x0 + t * (x1 - x0);
      dot(f, x, y0 + 8, 6.4, C.hot);
      poly(f, [[x + 14, y0 + 8], [x + 24, y0 + 8], [x + 19, y0 + 3]], { stroke: C.hot, lw: 1.4, fill: C.hot } as any);
    }
    // 下边缘反向
    for (let k = 0; k < 6; k++) {
      const t = ((f.t * 0.6 + k / 6) % 1);
      const x = x1 - t * (x1 - x0);
      dot(f, x, y1 - 8, 6.4, C.cool);
      poly(f, [[x - 14, y1 - 8], [x - 24, y1 - 8], [x - 19, y1 - 3]], { stroke: C.cool, lw: 1.4, fill: C.cool } as any);
    }
    text(f, '上缘 →、下缘 ←：手性边缘态被体拓扑“数出来”', 30, 44, { color: C.hot, font: "14px sans-serif" });
    // 缺陷（不背散射）
    const dx = w * 0.55;
    poly(f, [[dx, y0 + 2], [dx + 26, y0 + 2], [dx + 13, y0 + 16]], { stroke: C.warm, lw: 2, fill: 'rgba(237,137,54,0.5)' } as any);
    text(f, '缺陷：边缘流绕行而过（无背散射→无耗散）', dx - 60, y0 - 34, { color: C.warm, font: '11px sans-serif' });
    text(f, '体边对应：体拓扑不变量 = 边缘态的数目（体决定边）', 30, h - 34, { color: C.cyan, font: "14px sans-serif" });

    footnotes(f, [
      '体边对应（bulk-edge correspondence）：体态的整数不变量直接数出边缘通道数',
      "量子霍尔、拓扑绝缘体、外尔半金属——'体是拓扑的，边就必然导电'的三连证明",
      '无背散射的边缘通道是低功耗电子学与拓扑量子比特的物理承诺',
    ]);
    heading(f, '边缘态：体拓扑在边界上的显形');
  },
});
registerViz(edgeState);
