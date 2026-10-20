import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** 克尔黑洞（旋转）。 */
const kerrBlackHole = defineViz({
  slug: 'kerr-black-hole', title: '克尔黑洞与能层', animated: true,
  params: {
    a: { type: 'range', min: 0, max: 0.998, default: 0.9, step: 0.02, label: '自旋 a/M' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const spin = num(params, 'a', 0.9);
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    const R = Math.min(w, h) * 0.4;
    // 静止界面 r_± 与能层（赤道方向外凸）
    const rPlus = 1 + Math.sqrt(1 - spin * spin);   // M=1 单位
    const rMinus = 1 - Math.sqrt(1 - spin * spin);
    const drawSurface = (r: number, color: string, lw: number, fill?: string): void => {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 100; i++) {
        const th = (i / 100) * Math.PI * 2;
        const equat = 1 + 0.5 * spin * Math.sin(th) ** 2;
        const rr = (r / 2.4) * R * equat;
        pts.push([cx + rr * Math.cos(th), cy + rr * Math.sin(th) * 0.8]);
      }
      poly(f, [...pts, pts[0]], { stroke: color, lw, ...(fill ? { fill } : {}) } as any);
    };
    // 能层（外视界之外的椭球）
    drawSurface(rPlus * 1.5, `${C.warm}aa`, 2, 'rgba(237,137,54,0.10)');
    // 内外视界
    drawSurface(rPlus, `${C.cool}cc`, 2.4, 'rgba(5,5,16,0.9)');
    if (spin < 0.95) drawSurface(Math.max(rMinus, 0.15), `${C.dim}88`, 1.4);
    // 奇环（克尔奇点是环不是点）
    const ringPts: [number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const th = (i / 60) * Math.PI * 2;
      ringPts.push([cx + Math.cos(th) * rMinus * (R / 2.4) * 30 + 30, cy + Math.sin(th) * 8]);
    }
    void ringPts;
    // 拖曳箭头（参考系拖曳）
    for (let k = 0; k < 6; k++) {
      const th = (k / 6) * Math.PI * 2 + f.t * 1.6;
      const rr = R * 0.62;
      const x = cx + rr * Math.cos(th), y = cy + rr * Math.sin(th) * 0.8;
      const tx = -Math.sin(th) * 26, ty = Math.cos(th) * 20;
      poly(f, [[x + tx, y + ty], [x + tx * 0.4 - 7, y + ty * 0.4], [x + tx * 0.4 + 7, y + ty * 0.4]],
        { stroke: `${C.green}cc`, lw: 1.6, fill: `${C.green}cc` } as any);
    }
    text(f, `a=${spin}M：外视界 r₊=${rPlus.toFixed(2)}M，能层内空间被拖着转（无法静止）`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '橙色椭球=能层：Penrose 过程可从此提取黑洞转动能', 30, 66, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '克尔解（1963）描述旋转黑洞：奇点成环、视界与能层分离——真实黑洞（a≈0.9+）的标配',
      '能层内没有任何东西能保持静止：时空本身被拖着旋转（Lense-Thirring 效应）',
      'Penrose 过程与 Blandford-Znajek 机制从黑洞抽取能量——类星体的引擎',
    ]);
    heading(f, '克尔黑洞：旋转改写几何');
  },
});
registerViz(kerrBlackHole);

/** 霍金辐射。 */
const hawkingRadiation = defineViz({
  slug: 'hawking-radiation', title: '霍金辐射', animated: true,
  params: {
    M: { type: 'range', min: 0, max: 10, default: 4, step: 0.5, label: '黑洞质量（相对，大=冷）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const mass = num(params, 'M', 4);
    const T = 1 / Math.max(mass, 0.3); // T ∝ 1/M
    clear(f);
    const cx = w * 0.36, cy = h / 2 + 6;
    const R = Math.min(w, h) * 0.22;
    // 黑洞
    f.ctx.beginPath(); f.ctx.arc(cx, cy, R, 0, Math.PI * 2);
    f.ctx.fillStyle = '#04040c'; f.ctx.fill();
    f.ctx.strokeStyle = `${C.cool}aa`; f.ctx.lineWidth = 2.4; f.ctx.stroke();
    // 视界外虚粒子对（涨落示意）
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + f.t * 0.5;
      const rr = R + 26 + ((f.t * 40 + k * 30) % 70);
      const alpha = Math.max(0, 1 - (rr - R) / 74);
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      dot(f, x, y, 4, `rgba(255,230,150,${alpha * 0.9})`);
      if (k % 3 === 0 && alpha > 0.4) {
        // 逃逸光子波纹
        f.ctx.beginPath();
        f.ctx.arc(x, y, 8 + Math.sin(f.t * 5 + k) * 3, 0, Math.PI * 2);
        f.ctx.strokeStyle = `rgba(120,215,255,${alpha * 0.6})`;
        f.ctx.lineWidth = 1.4; f.ctx.stroke();
      }
    }
    // 温度标尺
    const x0 = w * 0.66, y0 = h - 60, y1 = 60;
    const vv = { sx: (t: number) => x0 + t * (w - x0 - 50), sy: (t: number) => y0 - t * (y0 - y1) };
    void vv;
    text(f, `T_H = ħc³/(8πGMk_B) ∝ 1/M：当前温度 ${T.toFixed(2)}（相对）`, 30, 44, { color: C.cyan, font: '14px sans-serif' });
    text(f, mass > 6 ? '大黑洞比星际空间还冷——霍金辐射微弱到无法探测' : mass < 2 ? '小黑洞更热、蒸发更快：末期加速爆炸' : 'M 越小越热：蒸发是自加速过程', 30, 66, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      "1974 年霍金用量子场论证明：视界附近真空涨落让黑洞'漏光'，温度反比于质量",
      '恒星质量黑洞温度仅 60nK——宇宙年龄远小于其蒸发时间；微型黑洞才可能蒸发',
      '霍金辐射把广义相对论、量子力学与热力学焊在一起——黑洞热力学的第四条定律',
    ]);
    heading(f, '霍金辐射：黑洞不是全黑的');
  },
});
registerViz(hawkingRadiation);

/** 黑洞热力学四定律。 */
const blackHoleThermo = defineViz({
  slug: 'black-hole-thermo', title: '黑洞热力学四定律', animated: true,
  params: {
    kind: { type: 'select', options: ['四定律对照', '熵与视界面积'], default: '四定律对照', label: '视角' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const laws = String((params as Record<string, unknown>)['kind'] ?? '').includes('对照');
    clear(f);
    if (laws) {
      const rows: [string, string, string][] = [
        ['第零定律', 'κ（表面引力）处处恒定', '↔ 温度 T 均匀'],
        ['第一定律', 'dM = κdA/8G + ΩdJ + ΦdQ', '↔ dE = TdS + …'],
        ['第二定律', 'δA ≥ 0（面积不减）', '↔ δS ≥ 0'],
        ['第三定律', 'κ→0 不可达（无极端黑洞）', '↔ T→0 不可达'],
      ];
      for (let i = 0; i < rows.length; i++) {
        const y = 84 + i * 66;
        poly(f, [[40, y - 24], [w - 40, y - 24], [w - 40, y + 24], [40, y + 24]],
          { stroke: `${C.cool}88`, lw: 1.6, fill: 'rgba(66,153,225,0.08)' } as any);
        text(f, rows[i][0], 56, y - 4, { color: C.warm, font: '14px sans-serif' });
        text(f, rows[i][1], 156, y - 4, { color: C.cyan, font: '13px sans-serif' });
        text(f, rows[i][2], w - 260, y - 4, { color: C.green, font: '13px sans-serif' });
      }
      text(f, '黑洞与热力学惊人逐条对译——贝肯斯坦-霍金的里程碑', 30, 44, { color: C.cyan, font: '14px sans-serif' });
    } else {
      // 熵 ∝ 面积
      const x0 = 70, y0 = h - 60, y1 = 70;
      const vv = view(f, { xMin: 0, xMax: 10, yMin: 0, yMax: 50, inset: 50 });
      grid(f, vv, { divisions: 4, ticks: true });
      const pts: [number, number][] = [];
      for (let i = 1; i <= 100; i++) {
        const r = (i / 100) * 10;
        pts.push([vv.sx(r), vv.sy(r * r)]);
      }
      poly(f, pts, { stroke: C.accent, lw: 2.8 });
      const rr = 3 + Math.sin(f.t * 0.8) * 2.5;
      dot(f, vv.sx(rr), vv.sy(rr * rr), 7, C.warm);
      void x0; void y0; void y1;
      text(f, `S_BH = k_B·A/(4l_P²)：S ∝ R²（线性轴已致曲线为抛物线）`, 30, 44, { color: C.cyan, font: '14px sans-serif' });
      text(f, `R=${rr.toFixed(1)} → S ∝ ${(rr * rr).toFixed(1)}：黑洞熵大得装下整个宇宙常规物质都富余`, 30, 66, { color: C.warm, font: '12px sans-serif' });
    }

    footnotes(f, [
      '贝肯斯坦提出熵与视界面积（而非体积）成正比——全息原理的首个实例',
      '霍金辐射温度与表面引力对应：四条热力学定律在黑洞上逐条成立',
      'S=A/4 用普朗克面积量子化视界——每 4 个普朗克面积一个熵量子（信息去哪儿了？）',
    ]);
    heading(f, '黑洞热力学：几何即温度与熵');
  },
});
registerViz(blackHoleThermo);

/** 吸积盘温度分布。 */
const accretionDiskTemp = defineViz({
  slug: 'accretion-disk-temp', title: '吸积盘温度分布', animated: true,
  params: {
    M: { type: 'range', min: 1, max: 10, default: 4, step: 0.5, label: '黑洞质量（10⁶ M☉ 相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const M = num(params, 'M', 4);
    clear(f);
    const x0 = 64, y0 = h - 56, y1 = 56;
    const vv = view(f, { xMin: 1, xMax: 30, yMin: 0, yMax: 1, inset: 50 });
    grid(f, vv, { divisions: 4, ticks: true });
    // T(r) ∝ r^(−3/4)
    const pts: [number, number][] = [];
    for (let i = 1; i <= 200; i++) {
      const r = 1 + (i / 200) * 29;
      const T = Math.pow(r, -0.75);
      pts.push([vv.sx(r), vv.sy(T)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.8 });
    const rNow = 4 + Math.sin(f.t * 0.7) * 2.6;
    dot(f, vv.sx(rNow), vv.sy(Math.pow(rNow, -0.75)), 7, C.warm);
    void x0; void y0; void y1;
    // 色温条（内紫外外红）
    for (let i = 0; i < 8; i++) {
      const hue = 250 - i * 30;
      poly(f, [[vv.sx(1 + i * 3.6), y1 - 34], [vv.sx(1 + (i + 1) * 3.6), y1 - 34], [vv.sx(1 + (i + 1) * 3.6), y1 - 16], [vv.sx(1 + i * 3.6), y1 - 16]],
        { stroke: 'transparent', fill: `hsl(${hue},85%,60%)` } as any);
    }
    text(f, '内圈紫外（百万K）→ 外圈可见/红外：多色黑体谱', vv.sx(2), y1 - 44, { color: C.cyan, font: '12px sans-serif' });
    text(f, `T(r) ∝ (M·Ṁ)^{1/4}·r^(−3/4)：质量越大盘越冷（M=${M}×10⁶M☉ 时 T_max 降低）`, 30, 44, { color: C.warm, font: '13px sans-serif' });

    footnotes(f, [
      '黏滞把引力能逐层转化为热——外缘辐射冷却，形成温度梯度盘',
      'X 射线双星与活动星系核的连续谱正是积分的多色黑体——盘模型的观测签名',
      '盘的内缘停在 ISCO：拟合截断半径即可称量黑洞自旋（与 ISCO 联动）',
    ]);
    heading(f, '吸积盘：引力能的逐级放热');
  },
});
registerViz(accretionDiskTemp);

/** 彭罗斯过程。 */
const penroseProcess = defineViz({
  slug: 'penrose-process', title: '彭罗斯过程', animated: true,
  params: {
    split: { type: 'range', min: 0.1, max: 0.9, default: 0.5, step: 0.05, label: '碎片分裂比例' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const k = num(params, 'split', 0.5);
    clear(f);
    const cx = w * 0.44, cy = h / 2 + 6;
    const R = Math.min(w, h) * 0.24;
    // 能层与视界
    const pts: [number, number][] = [];
    for (let i = 0; i <= 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      const eq = 1 + 0.45 * Math.sin(a) ** 2;
      pts.push([cx + R * 1.7 * eq * Math.cos(a), cy + R * 1.7 * eq * Math.sin(a) * 0.8]);
    }
    poly(f, [...pts, pts[0]], { stroke: `${C.warm}aa`, lw: 2, fill: 'rgba(237,137,54,0.08)' } as any);
    f.ctx.beginPath(); f.ctx.arc(cx, cy, R, 0, Math.PI * 2);
    f.ctx.fillStyle = '#04040c'; f.ctx.fill();
    f.ctx.strokeStyle = `${C.cool}aa`; f.ctx.lineWidth = 2; f.ctx.stroke();
    text(f, '能层', cx + R * 1.7 + 8, cy - 12, { color: C.warm, font: '11px sans-serif' });
    text(f, '视界', cx - 24, cy + 4, { color: C.cool, font: '11px sans-serif' });
    // 碎片进入能层分裂（负能碎片坠入、正能碎片逃逸）
    const prog = (f.t * 0.4) % 1;
    const inX = w * 0.92, inY = cy - 90;
    const sx0 = inX + (cx - inX) * prog, sy0 = inY + (cy - 20 - inY) * prog;
    dot(f, sx0, sy0, 8, C.cyan);
    if (prog > 0.55) {
      const t2 = (prog - 0.55) / 0.45;
      // 逃逸碎片（能量变大）
      dot(f, sx0 + t2 * 220 * k, sy0 - t2 * 120 * k, 7, C.green);
      // 坠入碎片（负能量）
      dot(f, sx0 - t2 * 60, sy0 + t2 * 70, 6, C.hot);
      text(f, '逃逸碎片 E′ > E（提取转动能）', sx0 + 60, sy0 - 80, { color: C.green, font: '11px sans-serif' });
      text(f, '坠入 E<0', sx0 - 90, sy0 + 88, { color: C.hot, font: '11px sans-serif' });
    }
    text(f, `分裂比例 k=${k.toFixed(2)}：飞船在能层内解体，一片坠入一片逃出——总能量增加`, 30, 44, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      '彭罗斯 1969 年证明：旋转黑洞能层内的负能轨道让碎片组合后总能量大于入射能量',
      "能量来自黑洞转动能——黑洞被慢慢'抽脂'，自旋随之下降",
      'Blandford-Znajek 机制是天体版本：磁场从旋转黑洞抽取能量点亮类星体',
    ]);
    heading(f, '彭罗斯过程：从黑洞偷能量');
  },
});
registerViz(penroseProcess);
