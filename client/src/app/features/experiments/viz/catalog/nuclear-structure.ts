import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** 核子结构。 */
const nucleonStructure = defineViz({
  slug: 'nucleon-structure', title: '核子结构与夸克', animated: true,
  params: {
    probe: { type: 'select', options: ['弹性散射', '深度非弹性'], default: '弹性散射', label: '探针' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const dis = String((params as Record<string, unknown>)['probe'] ?? '').includes('深度');
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    const R = Math.min(w, h) * 0.26;
    // 质子边界
    f.ctx.beginPath(); f.ctx.arc(cx, cy, R, 0, Math.PI * 2);
    f.ctx.fillStyle = 'rgba(66,153,225,0.16)'; f.ctx.fill();
    f.ctx.strokeStyle = C.cool; f.ctx.lineWidth = 2.4; f.ctx.stroke();
    text(f, '质子 (uud)', cx - 34, cy - R - 14, { color: C.cool, font: '12px sans-serif' });
    // 三价夸克
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + f.t * 0.5;
      const rr = R * 0.42;
      const qx = cx + Math.cos(a) * rr, qy = cy + Math.sin(a) * rr;
      dot(f, qx, qy, 9, k < 2 ? C.warm : C.green);
      text(f, k < 2 ? 'u' : 'd', qx - 4, qy + 4, { color: '#fff', font: '12px sans-serif' });
      // 胶子弹簧
      for (let j = k + 1; j < 3; j++) {
        const a2 = (j / 3) * Math.PI * 2 + f.t * 0.5;
        const qx2 = cx + Math.cos(a2) * rr, qy2 = cy + Math.sin(a2) * rr;
        const mid: [number, number][] = [];
        for (let i = 0; i <= 20; i++) {
          const t = i / 20;
          const x = qx + (qx2 - qx) * t;
          const y = qy + (qy2 - qy) * t;
          mid.push([x + Math.sin(t * Math.PI * 5 + f.t * 6) * 4, y]);
        }
        poly(f, mid, { stroke: `${C.warm}99`, lw: 1.6 });
      }
    }
    // 入射电子
    if (dis) {
      // 深度非弹性：散射出簇射
      const prog = (f.t * 0.5) % 1;
      const ex = w * 0.06 + prog * (cx - w * 0.06);
      dot(f, ex, cy - 40, 6, C.cyan);
      if (prog > 0.6) {
        for (let k = 0; k < 6; k++) {
          const a = -Math.PI / 4 + (k / 6) * Math.PI / 2;
          const rr = (prog - 0.6) * 260;
          dot(f, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 4, C.warm);
        }
        text(f, '打出夸克碎片（喷注）：质子内部是点状部分子', cx + 40, cy - 70, { color: C.hot, font: '12px sans-serif' });
      }
      text(f, '深度非弹性（SLAC 1968）：电子看到的不是弥散电荷而是点——部分子模型', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    } else {
      const prog = (f.t * 0.5) % 1;
      dot(f, w * 0.06 + prog * (cx - w * 0.06 - R - 10), cy - 60, 6, C.cyan);
      text(f, '弹性散射：整体回弹——测得半径约 0.8 fm', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    }

    footnotes(f, [
      '质子不是基本粒子：三个价夸克+海夸克+胶子——质量的 98% 来自胶子能量（E=mc²）',
      '霍夫斯塔特 1956 测出核子电磁形状因子——获 1990 诺奖；2015 年仍测得质子半径之谜',
      '夸克禁闭：色中性束缚——永远抓不到裸夸克，只能看喷注间接成像',
    ]);
    heading(f, '核子结构：质子内部的夸克胶子汤');
  },
});
registerViz(nucleonStructure);

/** 核力。 */
const nuclearForce = defineViz({
  slug: 'nuclear-force', title: '核力与介子交换', animated: true,
  params: {
    r: { type: 'range', min: 0.4, max: 5, default: 1.5, step: 0.1, label: '核子间距 (fm)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const r = num(params, 'r', 1.5);
    // 势能曲线 V(r)
    const V = (x: number): number => {
      if (x < 0.5) return 30 * Math.exp(-(x - 0.5) * 14) + 8; // 硬芯排斥
      return -11 * Math.exp(-(x - 0.5) * 1.8) / Math.max(x * 0.6, 0.4); // 吸引阱
    };
    clear(f);
    const x0 = 56, y0 = h - 56, y1 = 56;
    const vv = view(f, { xMin: 0.4, xMax: 5, yMin: -14, yMax: 34, inset: 50 });
    grid(f, vv, { divisions: 4, ticks: true });
    seg(f, vv.sx(0.4), vv.sy(0), vv.sx(5), vv.sy(0), C.grid, 1.4);
    const pts: [number, number][] = [];
    for (let i = 1; i <= 300; i++) {
      const x = 0.4 + (i / 300) * 4.6;
      pts.push([vv.sx(x), vv.sy(Math.max(-14, Math.min(34, V(x))))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.8 });
    dot(f, vv.sx(r), vv.sy(Math.max(-14, Math.min(34, V(r)))), 7, C.warm);
    void x0; void y0; void y1;
    // 两核子交换介子示意
    const cy2 = h * 0.24;
    dot(f, w * 0.3, cy2, 11, C.cool);
    dot(f, w * 0.7, cy2, 11, C.cool);
    const ph = (f.t * 1.5) % 1;
    const mx = w * 0.3 + ph * (w * 0.4);
    dot(f, mx, cy2 + Math.sin(ph * Math.PI * 4) * 10, 5, C.warm);
    text(f, 'π 介子交换（汤川 1935）：力程 ~1/m_πc ≈ 1.4 fm', w * 0.3 - 60, cy2 - 34, { color: C.warm, font: '12px sans-serif' });
    text(f, `r=${r} fm：${r < 0.7 ? '硬芯强排斥（核子不可重叠）' : r < 2 ? '中程强吸引（束缚原子核）' : '快速衰减（核力短程）'}`, 30, h - 34, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '核力：短程强吸引+更短程硬芯排斥，且自旋相关（氘核只有单态束缚）',
      '汤川预言介子传递核力——1947 年发现 π 介子（1949 诺奖）；今天读作残余色力',
      '液滴模型与壳层模型都从核力出发：结合能曲线、幻数、裂变垒全由它标定',
    ]);
    heading(f, '核力：交换介子的短程胶水');
  },
});
registerViz(nuclearForce);

/** 液滴模型。 */
const liquidDropModel = defineViz({
  slug: 'liquid-drop-model', title: '液滴模型与裂变垒', animated: true,
  params: {
    Z: { type: 'range', min: 10, max: 100, default: 92, step: 1, label: '质子数 Z' },
    N: { type: 'range', min: 10, max: 150, default: 146, step: 1, label: '中子数 N' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const Z = num(params, 'Z', 92), N = num(params, 'N', 146);
    const A = Z + N;
    // 半经验质量公式各项
    const av = 15.75 * A, as = -17.8 * Math.pow(A, 2 / 3), ac = -0.711 * Z * (Z - 1) / Math.pow(A, 1 / 3);
    const asym = -23.7 * Math.pow(N - Z, 2) / A, pair = (A % 2 === 0 && Z % 2 === 0 ? 12 : A % 2 === 0 ? -12 : 0) * Math.pow(A, -0.75);
    const B = av + as + ac + asym + pair;
    clear(f);
    const cy = h * 0.34;
    // 核液滴（呼吸脉动 + 变形趋向裂变）
    const deform = Math.sin(f.t * 1.4) * 0.12;
    f.ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.05; a += 0.05) {
      const rr = (Math.min(w, h) * 0.16) * (1 + deform * Math.cos(2 * a));
      const x = w * 0.3 + rr * Math.cos(a) * 1.4;
      const y = cy + rr * Math.sin(a);
      if (a === 0) f.ctx.moveTo(x, y); else f.ctx.lineTo(x, y);
    }
    f.ctx.closePath();
    f.ctx.fillStyle = 'rgba(66,153,225,0.3)'; f.ctx.fill();
    f.ctx.strokeStyle = C.cool; f.ctx.lineWidth = 2.4; f.ctx.stroke();
    // 能量项条形（右）
    const bx = w * 0.62, by = 76;
    const items: [string, number, string][] = [
      ['体积项', av / A / 10, C.green], ['表面项', as / A / 10, C.warm],
      ['库仑项', ac / A / 10, C.hot], ['对称项', asym / A / 10, C.cool], ['对能', pair / A * 100, '#9254de'],
    ];
    for (let i = 0; i < items.length; i++) {
      const y = by + i * 40;
      const len = Math.min(Math.abs(items[i][1]) * 3, w * 0.3);
      seg(f, bx, y, bx + len, y, items[i][2], 10);
      text(f, `${items[i][0]} ${items[i][1].toFixed(2)} MeV/核子`, bx + len + 8, y + 4, { color: items[i][2], font: '11px sans-serif' });
    }
    text(f, `A=${A}（Z=${Z},N=${N}）：B≈${B.toFixed(1)} MeV，B/A≈${(B / A).toFixed(2)} MeV`, 30, 44, { color: C.cyan, font: '14px sans-serif' });
    text(f, '形变↑ → 库仑能降、表面能升 → 裂变垒（锝得诺贝尔的关键计算）', 30, 66, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '魏茨泽克半经验质量公式（1935）：五项拼出结合能——核质量精确到 MeV',
      '裂变垒高度由液滴形变算出：U-235 俘中子后超额激发能越过垒 → 裂变',
      '铁-56 在曲线顶点：恒星聚变的终点与超新星爆发的起点',
    ]);
    heading(f, '液滴模型：原子核像一滴带电的水');
  },
});
registerViz(liquidDropModel);

/** 壳层模型与幻数。 */
const shellModel = defineViz({
  slug: 'shell-model', title: '壳层模型与幻数', animated: true,
  params: {
    A: { type: 'range', min: 16, max: 250, default: 208, step: 1, label: '质量数 A' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const A = num(params, 'A', 208);
    const magic = [2, 8, 20, 28, 50, 82, 126];
    clear(f);
    // 幻数能级堆叠
    const x0 = w * 0.24;
    let y = h - 80;
    const gapBase = 54;
    const shells: [string, number][] = [
      ['1s₁/₂', 2], ['1p₃/₂ 1p₁/₂', 8], ['1d₅/₂ 2s₁/₂ 1d₃/₂', 20],
      ['1f₇/₂ …', 28], ['1g₉/₂ …', 50], ['1h₁₁/₂ …', 82], ['1i₁₃/₂ …', 126],
    ];
    for (let i = 0; i < shells.length; i++) {
      const isMagic = magic.includes(shells[i][1]);
      const width = 210 - i * 14;
      const pulse = isMagic ? 0.75 + 0.25 * Math.sin(f.t * 2.4 + i) : 0.6;
      seg(f, x0, y, x0 + width, y, isMagic ? `rgba(237,137,54,${pulse})` : `rgba(66,153,225,${pulse})`, 3);
      text(f, `${shells[i][0]}（N=${shells[i][1]}）`, x0 + width + 10, y + 4, { color: isMagic ? C.warm : C.cool, font: '11px sans-serif' });
      y -= gapBase + i * 5;
      // 闭壳间隙
      if (isMagic) {
        text(f, '闭壳', x0 - 40, y + 24, { color: C.warm, font: '10px sans-serif' });
      }
    }
    const isMa = magic.some((m) => Math.abs(A - m * 2) < 6 || A === 208 || A === 4 || A === 40);
    text(f, `A=${A}：幻数核（2,8,20,28,50,82,126 附近）格外稳定、丰度异常高`, 30, 44, { color: C.cyan, font: '14px sans-serif' });
    text(f, isMa ? '双幻核（Pb-208、Ca-48、O-16）是壳层模型的明星' : '壳层由自旋-轨道耦合劈裂给出（梅耶-延森 1949，1963 诺奖）', 30, 66, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '幻数核的高稳定性类比惰性气体：独立粒子势阱+强自旋-轨道项重排能级',
      '壳层模型预言双幻核与 β 稳定线——核素图的骨架由此确定',
      "超重元素'稳定岛'（预言幻数 114/126）正被 DUBNA-GSI 合成实验追逐",
    ]);
    heading(f, '壳层模型：核内的能级与幻数');
  },
});
registerViz(shellModel);

/** 结合能曲线。 */
const bindingEnergyCurve = defineViz({
  slug: 'binding-energy-curve', title: '比结合能曲线', animated: true,
  params: {
    process: { type: 'select', options: ['裂变方向', '聚变方向'], default: '聚变方向', label: '能量释放' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const fission = String((params as Record<string, unknown>)['process'] ?? '').includes('裂变');
    clear(f);
    const x0 = 56, y0 = h - 56, y1 = 66;
    const vv = view(f, { xMin: 0, xMax: 250, yMin: 0, yMax: 9.2, inset: 50 });
    grid(f, vv, { divisions: 4, ticks: true });
    // 比结合能曲线（B/A）
    const bA = (A: number): number => {
      if (A < 20) return 1.1 * Math.pow(A, 0.5) * 1.28;
      return 8.5 - 14 / Math.sqrt(A);
    };
    const pts: [number, number][] = [];
    for (let i = 1; i <= 300; i++) {
      const A = (i / 300) * 250;
      pts.push([vv.sx(A), vv.sy(Math.min(bA(A), 9))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 3 });
    // 铁峰
    dot(f, vv.sx(56), vv.sy(bA(56)), 7, C.warm);
    text(f, 'Fe-56 峰顶（8.8 MeV）', vv.sx(56) + 10, vv.sy(bA(56)) - 10, { color: C.warm, font: '12px sans-serif' });
    // 过程箭头
    const prog = (f.t * 0.5) % 1;
    if (fission) {
      const a1 = 235 - prog * 180;
      dot(f, vv.sx(a1), vv.sy(bA(a1)), 7, C.hot);
      text(f, '裂变：重核向峰顶 → 释放 ~200MeV', vv.sx(120), vv.sy(3), { color: C.hot, font: '13px sans-serif' });
    } else {
      const a1 = 2 + prog * 54;
      dot(f, vv.sx(a1), vv.sy(bA(a1)), 7, C.green);
      text(f, '聚变：轻核向峰顶 → 每核子释放更多', vv.sx(6), vv.sy(1.4), { color: C.green, font: '13px sans-serif' });
    }
    text(f, 'B/A 越大越稳定：两侧向峰顶走都放能——核能的总路线图', 30, 44, { color: C.cyan, font: '14px sans-serif' });
    void x0; void y0; void y1;

    footnotes(f, [
      "比结合能曲线是核能的地形图：铀裂变与氘氚聚变都在'下坡'放能",
      'Fe-56 最稳定——大质量恒星聚变到铁即失去能源，核心坍缩触发超新星',
      '每克聚变燃料释放的能量是裂变的 3~4 倍、化学燃料的百万倍',
    ]);
    heading(f, '结合能曲线：核能的地形图');
  },
});
registerViz(bindingEnergyCurve);

/** α 衰变与隧穿。 */
const alphaDecay = defineViz({
  slug: 'alpha-decay-tunnel', title: 'α 衰变与量子隧穿', animated: true,
  params: {
    Q: { type: 'range', min: 3, max: 9, default: 5.5, step: 0.1, label: '衰变能 Q (MeV)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const Q = num(params, 'Q', 5.5);
    // 盖莫夫穿透概率 ∝ e^(−2G/√Q)
    const G = 1.7; // 示意常数
    const P = Math.exp(-2 * G / Math.sqrt(Q));
    const halfLife = Math.pow(10, 21 - 30 * Math.sqrt(Q)); // 示意标度
    clear(f);
    const x0 = 56, y0 = h - 66, y1 = 56;
    const vv = view(f, { xMin: 0, xMax: 10, yMin: -12, yMax: 26, inset: 50 });
    grid(f, vv, { divisions: 4, ticks: true });
    // 库仑势垒 + 核势阱
    const coul = (r: number): number => (r < 1 ? 24 : 10 / Math.max(r, 0.6));
    const well = (r: number): number => (r < 1 ? -12 : coul(r));
    const barrier: [number, number][] = [];
    const inner: [number, number][] = [];
    for (let i = 1; i <= 240; i++) {
      const r = 0.2 + (i / 240) * 9.8;
      barrier.push([vv.sx(r), vv.sy(Math.min(coul(r), 26))]);
      inner.push([vv.sx(r), vv.sy(well(r))]);
    }
    poly(f, barrier, { stroke: C.hot, lw: 2.6 });
    poly(f, inner, { stroke: C.cool, lw: 1.8 });
    // α 粒子在阱内弹跳+隧穿逃逸
    const inWell = ((f.t * 1.2) % 1) < 0.75;
    const ax = inWell ? vv.sx(0.3 + Math.abs(Math.sin(f.t * 8)) * 0.5) : vv.sx(1.5 + (((f.t * 1.2) % 1) - 0.75) * 4 * 12);
    dot(f, ax, vv.sy(Q), 8, C.warm);
    // 能量线
    seg(f, vv.sx(0), vv.sy(Q), vv.sx(10), vv.sy(Q), `${C.green}aa`, 1.6);
    text(f, `Q=${Q} MeV：垒内波函数 e^(−∫κdr) → 穿透 P≈${P.toExponential(1)}`, 30, 44, { color: C.cyan, font: '14px sans-serif' });
    text(f, `半衰期对 Q 极敏感：Q 微增 1 倍，寿命缩短数十个量级（Geiger-Nuttall 定律）`, 30, 66, { color: C.warm, font: '12px sans-serif' });
    void halfLife;

    footnotes(f, [
      '1928 年盖莫夫用量子隧穿解释 α 衰变——隧穿理论的首个辉煌应用',
      'Geiger-Nuttall 定律（1911 经验）lnT 与 1/√Q 线性——盖莫夫势垒公式给出理论根',
      '铀矿中百万年不衰的铀-238 与毫秒衰变的钋-212，都是同一条指数曲线上的点',
    ]);
    heading(f, 'α 衰变：盖莫夫势垒与隧穿');
  },
});
registerViz(alphaDecay);

/** β 衰变与弱作用。 */
const betaDecay = defineViz({
  slug: 'beta-decay', title: 'β 衰变与弱作用', animated: true,
  params: {
    kind: { type: 'select', options: ['β⁻ 衰变', 'β⁺ 衰变', '电子俘获'], default: 'β⁻ 衰变', label: '类型' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = String((params as Record<string, unknown>)['kind'] ?? 'β⁻');
    clear(f);
    const cy = h / 2 + 6;
    // 母核 → 子核
    const cx1 = w * 0.22, cx2 = w * 0.78;
    dot(f, cx1, cy, 26, C.cool);
    dot(f, cx2, cy, 25, C.warm);
    if (mode === 'β⁻ 衰变') {
      text(f, 'n → p + e⁻ + ν̄ₑ', cx1 - 44, cy + 5, { color: '#fff', font: '13px sans-serif' });
      text(f, 'p', cx2 - 5, cy + 5, { color: '#fff', font: '13px sans-serif' });
      // 电子与反中微子飞出
      const prog = (f.t * 0.6) % 1;
      dot(f, cx2 + 40 + prog * (w * 0.14), cy - prog * 60, 6, C.green);
      dot(f, cx2 + 40 + prog * (w * 0.12), cy + prog * 66, 5, '#9254de');
      text(f, 'e⁻', cx2 + 60, cy - 70, { color: C.green, font: '12px sans-serif' });
      text(f, 'ν̄ₑ', cx2 + 56, cy + 86, { color: '#9254de', font: '12px sans-serif' });
    } else if (mode === 'β⁺ 衰变') {
      text(f, 'p → n + e⁺ + νₑ', cx1 - 44, cy + 5, { color: '#fff', font: '13px sans-serif' });
      const prog = (f.t * 0.6) % 1;
      dot(f, cx2 + 40 + prog * (w * 0.14), cy - prog * 60, 6, C.hot);
      dot(f, cx2 + 40 + prog * (w * 0.12), cy + prog * 66, 5, C.cyan);
      text(f, 'e⁺（后湮灭成 γ）', cx2 + 56, cy - 74, { color: C.hot, font: '12px sans-serif' });
    } else {
      text(f, 'p + e⁻ → n + νₑ', cx1 - 44, cy + 5, { color: '#fff', font: '13px sans-serif' });
      const prog = (f.t * 0.6) % 1;
      dot(f, cx1 + 40 + prog * (cx2 - cx1 - 80), cy + Math.sin(prog * 8) * 16, 6, C.green);
      text(f, '俘获内层电子', (cx1 + cx2) / 2 - 44, cy + 44, { color: C.green, font: '12px sans-serif' });
    }
    // 连续能谱（中微子分走能量）
    const x0 = w * 0.34, y0 = h - 40;
    const spec: [number, number][] = [];
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      spec.push([x0 + t * (w * 0.3), y0 - Math.sin(t * Math.PI) * 26 * (1 - t * 0.3)]);
    }
    poly(f, spec, { stroke: `${C.cyan}aa`, lw: 2 });
    text(f, '连续能谱 → 中微子存在的第一个证据（泡利 1930）', x0 - 20, y0 - 44, { color: C.cyan, font: '12px sans-serif' });
    text(f, '弱作用（W/Z 玻色子传递）：唯一的宇称破坏者', 30, 44, { color: C.warm, font: '14px sans-serif' });

    footnotes(f, [
      'β 衰变中子变质子：味变的弱作用——夸克 d→u + W⁻，标准模型的基本顶点',
      '连续能谱曾是危机：泡利假设中微子（1930），1956 年直接探测（Cowan-Reines，1995 诺奖）',
      '吴健雄 1957 极化钴-60 实验证明弱作用宇称不守恒——对称破缺的第一声惊雷',
    ]);
    heading(f, 'β 衰变：中微子与弱力的登场');
  },
});
registerViz(betaDecay);

/** 临界质量。 */
const criticalMass = defineViz({
  slug: 'critical-mass', title: '临界质量与链式反应', animated: true,
  params: {
    size: { type: 'range', min: 0.5, max: 2, default: 1, step: 0.05, label: '裂变材料球半径（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const rr = num(params, 'size', 1);
    const subcritical = rr < 1;
    clear(f);
    const cx = w * 0.36, cy = h / 2 + 6;
    const R = Math.min(w, h) * 0.24 * rr;
    // 材料球
    f.ctx.beginPath(); f.ctx.arc(cx, cy, R, 0, Math.PI * 2);
    f.ctx.fillStyle = subcritical ? 'rgba(100,116,139,0.5)' : 'rgba(237,87,54,0.45)';
    f.ctx.fill();
    f.ctx.strokeStyle = subcritical ? C.dim : C.hot; f.ctx.lineWidth = 3; f.ctx.stroke();
    // 中子链式反应
    const gen = subcritical ? 2 : 3;
    const nodes: [number, number, number][] = [[cx, cy, 0]];
    let count = 1;
    for (let g = 1; g <= gen; g++) {
      const next: [number, number, number][] = [];
      for (const [px, py, pg] of nodes) {
        const branches = subcritical && pg >= 1 ? 1 : 2;
        for (let b = 0; b < branches; b++) {
          const a = Math.atan2(py - cy, px - cx) + (b - 0.5) * 1.6 + g;
          const dist = (g / (gen + 1)) * R * 1.1;
          next.push([cx + Math.cos(a) * dist * 1.4, cy + Math.sin(a) * dist, g]);
          count++;
        }
      }
      nodes.push(...next);
    }
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 5);
    for (const [px, py, g] of nodes) {
      const a = Math.min(g / (gen + 1), 1);
      const born = ((f.t * 0.8 - g * 0.3) % 1 + 1) % 1;
      const alpha = born < 0.6 ? 0.4 + pulse * 0.6 : 0.15;
      dot(f, px, py, 4, g > 0 ? `rgba(255,230,140,${alpha})` : C.cyan);
    }
    // 中子逃逸
    if (subcritical) {
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + f.t;
        dot(f, cx + Math.cos(a) * (R + 30 + (f.t * 30) % 30), cy + Math.sin(a) * (R + 30 + (f.t * 30) % 30), 3, `${C.green}aa`);
      }
    }
    const kEff = subcritical ? (0.5 + rr * 0.45).toFixed(2) : (0.95 + (rr - 1) * 1.4).toFixed(2);
    text(f, subcritical ? `k_eff=${kEff} < 1：次临界——中子泄漏多于增殖，反应熄灭` : `k_eff=${kEff} > 1：超临界——链式反应指数增长！`,
      30, 44, { color: subcritical ? C.green : C.hot, font: '14px sans-serif' });
    text(f, 'U-235 临界质量裸球约 52kg——爆轰压缩可大幅降低（武器化核心）', 30, 66, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      'k_eff=1 是生死线：反应堆靠控制棒精细调节，原子弹靠两块亚临界合体瞬间超临界',
      '费米 1942 年芝加哥 1 号堆（CP-1）首次自持链式反应——堆的字源（pile）',
      '临界质量取决于材料、密度与反射层：贫铀反射层可省掉近半材料',
    ]);
    heading(f, '临界质量：链式反应的开关');
  },
});
registerViz(criticalMass);

/** 核素图。 */
const nuclideChart = defineViz({
  slug: 'nuclide-chart', title: '核素图（塞格雷图）', animated: true,
  params: {
    highlight: { type: 'select', options: ['稳定线', '幻数线', 'β 衰变带'], default: '稳定线', label: '高亮' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = String((params as Record<string, unknown>)['highlight'] ?? '');
    clear(f);
    const x0 = 70, y0 = h - 62, yTop = 70;
    const Zmax = 110, Nmax = 170;
    const sx = (N: number): number => x0 + (N / Nmax) * (w - 120);
    const sy = (Z: number): number => y0 - (Z / Zmax) * (y0 - yTop);
    // 轴
    seg(f, x0, y0, w - 40, y0, C.grid, 1.4);
    seg(f, x0, y0, x0, yTop, C.grid, 1.4);
    text(f, '中子数 N', w - 110, y0 + 22, { color: C.dim, font: '12px sans-serif' });
    text(f, '质子数 Z', x0 + 4, yTop - 10, { color: C.dim, font: '12px sans-serif' });
    // 稳定线与核素点
    const rand = (i: number): number => Math.abs(Math.sin(i * 91.17) * 43758.5) % 1;
    let i = 0;
    for (let Z = 1; Z <= Zmax; Z += 2) {
      // 稳定 N/Z 比（重核中子多）
      const Ns = Z * (1 + 0.0055 * Z * Z / Math.max(Z, 1) * 0.6 + 0.15);
      const stable = Math.round(Ns);
      // 稳定核素（±1）
      for (let d = -1; d <= 1; d++) {
        i++;
        if (rand(i) < 0.75) dot(f, sx(stable + d), sy(Z), 2.4, mode === '稳定线' ? 'rgba(16,185,129,0.9)' : 'rgba(66,153,225,0.4)');
      }
      // 两侧衰变带
      for (let d = -8; d <= 10; d += 2) {
        i++;
        if (rand(i) < 0.4 && stable + d > 0) dot(f, sx(stable + d), sy(Z), 1.8, mode === 'β 衰变带' ? 'rgba(237,137,54,0.7)' : 'rgba(66,153,225,0.22)');
      }
      // 幻数线
      if (mode === '幻数线' && [8, 20, 28, 50, 82, 126].includes(Z)) {
        seg(f, x0, sy(Z), w - 40, sy(Z), 'rgba(237,137,54,0.5)', 1.2);
        text(f, `${Z}`, x0 - 22, sy(Z) + 4, { color: C.warm, font: '11px sans-serif' });
      }
      void Nmax;
    }
    // 丰度峰值提示
    dot(f, sx(82), sy(82), 4, C.warm);
    text(f, `Sn-120 附近（双幻 Pb-208：Z=82,N=126）`, sx(96), sy(84), { color: C.warm, font: '11px sans-serif' });
    text(f, '约 250 种稳定核素、3000+ 已知核素——质子中子配比的稳定谷', 30, 44, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '核素图是核物理的地图：稳定线偏离 Z=N 因为库仑排斥偏好更多中子',
      '全部稳定核素聚在窄谷中——偏离即 β 衰变拉回（放射性的热力学必然）',
      '超重核合成沿图的上缘推进：扩展这张图就是扩展元素周期表的边界',
    ]);
    heading(f, '核素图：3000 种原子核的地图');
  },
});
registerViz(nuclideChart);

/** 核反应堆。 */
const nuclearReactor = defineViz({
  slug: 'nuclear-reactor', title: '核反应堆', animated: true,
  params: {
    power: { type: 'range', min: 0, max: 100, default: 60, step: 5, label: '功率 (%)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const p = num(params, 'power', 60) / 100;
    clear(f);
    const cx = w * 0.3, cy = h / 2 + 6;
    // 堆芯
    poly(f, [[cx - 84, cy - 96], [cx + 84, cy - 96], [cx + 84, cy + 96], [cx - 84, cy + 96]],
      { stroke: C.hot, lw: 2.6, fill: 'rgba(237,87,54,0.14)' } as any);
    text(f, '堆芯（U-235 裂变）', cx - 66, cy - 106, { color: C.hot, font: '12px sans-serif' });
    // 燃料棒与控制棒
    for (let k = -2; k <= 2; k++) {
      const x = cx + k * 32;
      poly(f, [[x - 8, cy - 84], [x + 8, cy - 84], [x + 8, cy + 84], [x - 8, cy + 84]],
        { stroke: 'transparent', fill: 'rgba(255,180,80,0.35)' } as any);
      // 控制棒插入深度（功率反比）
      const insert = (1 - p) * 150;
      poly(f, [[x - 4, cy - 84], [x + 4, cy - 84], [x + 4, cy - 84 + insert], [x - 4, cy - 84 + insert]],
        { stroke: 'transparent', fill: 'rgba(66,153,225,0.8)' } as any);
    }
    // 中子闪烁
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + f.t * 3;
      const rr = Math.abs(Math.sin(f.t * 2 + k)) * 70;
      dot(f, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 3, `rgba(255,255,255,${0.3 + p * 0.6})`);
    }
    // 热回路与汽轮机
    const tx = w * 0.7;
    poly(f, [[tx - 60, cy - 40], [tx + 60, cy - 40], [tx + 60, cy + 10], [tx - 60, cy + 10]],
      { stroke: C.cool, lw: 2.2, fill: 'rgba(66,153,225,0.16)' } as any);
    text(f, '蒸汽轮机', tx - 34, cy - 52, { color: C.cool, font: '12px sans-serif' });
    const rot = f.t * p * 10;
    for (let b = 0; b < 4; b++) {
      const a = rot + (b * Math.PI) / 2;
      seg(f, tx, cy - 14, tx + Math.cos(a) * 30, cy - 14 + Math.sin(a) * 22, C.green, 2.4);
    }
    // 热流箭头
    for (let k = 0; k < 3; k++) {
      const x = cx + 90 + ((f.t * 60 * (0.4 + p) + k * 50) % (tx - cx - 160));
      poly(f, [[x, cy + 40], [x + 14, cy + 40], [x + 7, cy + 32]], { stroke: C.warm, lw: 1.6, fill: C.warm } as any);
    }
    text(f, `功率 ${(p * 100).toFixed(0)}%：控制棒插入越深、中子越少、功率越低——k_eff 精调至 1.0000`, 30, 44, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '压水堆（PWR）：慢化剂让快中子变热中子提高裂变截面——水兼三职（慢化/冷却/屏蔽）',
      '控制棒（B/Cd）吸中子：插入即减速，拔出即加速——反应堆的油门与刹车合一',
      '全球约 440 座机组供约 10% 电力：单机百万千瓦、年耗铀仅数十吨',
    ]);
    heading(f, '核反应堆：驯服链式反应');
  },
});
registerViz(nuclearReactor);
