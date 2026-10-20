import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text } from '../canvas';

/** P35 简正模式与耦合摆。 */
const normalModes = defineViz({
  slug: 'normal-modes',
  title: '简正模式与耦合摆',
  animated: true,
  params: {
    mode: { type: 'select', options: ['模式1：同相摆动', '模式2：反相摆动', '叠加：拍频能量交换'], default: '叠加：拍频能量交换', label: '振动模式' },
    coupling: { type: 'range', min: 0.1, max: 1, default: 0.5, step: 0.05, label: '耦合强度 κ' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = str(params, 'mode', '叠加：拍频能量交换');
    const kappa = num(params, 'coupling', 0.5);

    clear(f);
    // 两摆位置
    const ax = w * 0.3, bx = w * 0.62, topY = 70, len = Math.min(h * 0.34, 190);
    const w1 = 2 * Math.PI * 0.5;                 // 基频（示意）
    const w2 = w1 * Math.sqrt(1 + kappa);         // 耦合后第二模式
    const t = f.t;
    let a1: number, a2: number;
    if (mode.includes('同相')) {
      a1 = 0.4 * Math.cos(w1 * t);
      a2 = a1;
    } else if (mode.includes('反相')) {
      a1 = 0.4 * Math.cos(w2 * t);
      a2 = -a1;
    } else {
      // 叠加：能量在两摆间拍频交换
      a1 = 0.4 * Math.cos(w1 * t) * Math.cos((kappa * w1 * t) / 2);
      a2 = 0.4 * Math.cos(w2 * t) * Math.sin((kappa * w1 * t) / 2) * 1.4;
    }
    // 横梁
    seg(f, ax - 70, topY, bx + 70, topY, C.dim, 4);
    for (const [x, a, color] of [[ax, a1, C.cool], [bx, a2, C.warm]] as [number, number, string][]) {
      const px = x + Math.sin(a) * len;
      const py = topY + Math.cos(a) * len;
      seg(f, x, topY, px, py, color, 2);
      dot(f, x, topY, 3, C.dim);
      dot(f, px, py, 11, color);
    }
    // 耦合弹簧（两摆之间）
    const mx1 = ax + Math.sin(a1) * len * 0.55;
    const my1 = topY + Math.cos(a1) * len * 0.55;
    const mx2 = bx + Math.sin(a2) * len * 0.55;
    const my2 = topY + Math.cos(a2) * len * 0.55;
    const spring: [number, number][] = [];
    const nSeg = 10;
    for (let i = 0; i <= nSeg; i++) {
      const t2 = i / nSeg;
      spring.push([mx1 + (mx2 - mx1) * t2, my1 + (my2 - my1) * t2 + (i % 2 ? -7 : 7)]);
    }
    poly(f, spring, { stroke: `${C.green}cc`, lw: 1.4 });

    // 下方：位移-时间曲线
    const x0 = 60, x1c = w - 30, y1c = h - 40, y0c = h * 0.62;
    seg(f, x0, (y0c + y1c) / 2, x1c, (y0c + y1c) / 2, C.grid, 1);
    const cur1: [number, number][] = [];
    const cur2: [number, number][] = [];
    const win = 6; // 显示 6 秒窗口
    for (let i = 0; i <= 200; i++) {
      const ts = t + (i / 200) * win - win * 0.3;
      let v1: number, v2: number;
      if (mode.includes('同相')) { v1 = Math.cos(w1 * ts); v2 = v1; }
      else if (mode.includes('反相')) { v1 = Math.cos(w2 * ts); v2 = -v1; }
      else {
        v1 = Math.cos(w1 * ts) * Math.cos((kappa * w1 * ts) / 2);
        v2 = Math.cos(w2 * ts) * Math.sin((kappa * w1 * ts) / 2) * 1.4;
      }
      const px = x0 + ((i / 200) * (x1c - x0));
      const mid = (y0c + y1c) / 2;
      cur1.push([px, mid - v1 * (y1c - y0c) * 0.32]);
      cur2.push([px, mid - v2 * (y1c - y0c) * 0.32]);
    }
    poly(f, cur1, { stroke: C.cool, lw: 2 });
    poly(f, cur2, { stroke: C.warm, lw: 2 });
    text(f, 'x₁(t)', x1c - 4, y0c - 4, { align: 'right', color: C.cool, font: '11px sans-serif' });
    text(f, 'x₂(t)', x1c - 4, y1c + 4, { align: 'right', color: C.warm, font: '11px sans-serif' });

    footnotes(f, [
      `${mode}；耦合 κ = ${kappa}：复杂运动 = 简正模式的线性叠加（本征问题）`,
      '叠加态下能量以拍频在两摆间来回传递——能量交换的频率即两模式频率之差',
      "同一数学：双原子振动、LC 电路、分子红外吸收、桥梁模态分析都是'简正模式'的应用",
    ]);
    heading(f, '简正模式：耦合摆的本征振动');
  },
});
registerViz(normalModes);

/** P36 拉格朗日点。 */
const lagrangePoints = defineViz({
  slug: 'lagrange-points',
  title: '拉格朗日点',
  animated: true,
  params: {
    show: { type: 'select', options: ['全部 L1-L5', '仅稳定点 L4/L5', '仅不稳点 L1/L2/L3'], default: '全部 L1-L5', label: '显示' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const show = str(params, 'show', '全部 L1-L5');

    clear(f);
    const sunX = w * 0.3, sunY = h / 2, earthX = w * 0.74, earthY = h / 2;
    const R = earthX - sunX;
    // 轨道虚线
    for (const [cx, rr] of [[sunX, R * 0.55], [sunX, R], [sunX, R * 1.18], [sunX, R * 1.53]] as [number, number][]) {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 90; i++) {
        const a = (i / 90) * Math.PI * 2;
        pts.push([cx + rr * Math.cos(a), sunY + rr * Math.sin(a) * 0.42]);
      }
      poly(f, pts, { stroke: `${C.dim}33`, lw: 1 } as any);
    }
    // 太阳与地球
    dot(f, sunX, sunY, 17, C.warm);
    text(f, '太阳', sunX, sunY + 34, { align: 'center', color: C.warm, font: '12px sans-serif' });
    dot(f, earthX, earthY, 9, C.cool);
    text(f, '地球', earthX, earthY + 26, { align: 'center', color: C.cool, font: '12px sans-serif' });

    const pts: { id: string; x: number; y: number; stable: boolean }[] = [
      { id: 'L1', x: sunX + R * 0.98, y: sunY, stable: false },
      { id: 'L2', x: sunX + R * 1.15, y: sunY, stable: false },
      { id: 'L3', x: sunX - R, y: sunY, stable: false },
      { id: 'L4', x: sunX + R * Math.cos(Math.PI / 3), y: sunY - R * Math.sin(Math.PI / 3) * 0.42 * 1.7, stable: true },
      { id: 'L5', x: sunX + R * Math.cos(-Math.PI / 3), y: sunY - R * Math.sin(-Math.PI / 3) * 0.42 * 1.7, stable: true },
    ];
    for (const p of pts) {
      if (show.includes('仅稳定') && !p.stable) continue;
      if (show.includes('仅不稳') && p.stable) continue;
      const color = p.stable ? C.green : C.hot;
      dot(f, p.x, p.y, 6, color);
      text(f, p.id, p.x, p.y - 12, { align: 'center', color, font: '12px sans-serif' });
    }
    // L2 上的晕轨探测器动画
    if (!show.includes('仅稳定')) {
      const l2 = pts[1];
      const a = f.t * 1.4;
      dot(f, l2.x + Math.cos(a) * 16, l2.y + Math.sin(a) * 16 * 0.5, 4, C.cyan);
      text(f, '晕轨道探测器（如 JWST）', l2.x + 6, l2.y - 26, { color: C.cyan, font: '10px sans-serif' });
    }

    footnotes(f, [
      '限制性三体问题的五个平动解：日-地系统中 L1 看太阳、L2 看深空（韦布望远镜在此）、L4/L5 与地球成 60°',
      'L4/L5 稳定（离心与科氏力平衡，可聚集小行星：特洛伊群）；L1/L2/L3 为鞍点，需主动轨道维持',
      '有效势 U_eff = −GM₁/r₁ − GM₂/r₂ − ½ω²r²（旋转系）的五个驻点即拉格朗日点——分析力学的工程回报',
    ]);
    heading(f, '拉格朗日点：三体问题的五个平衡');
  },
});
registerViz(lagrangePoints);

/** P38 电磁波的产生与传播。 */
const emWave = defineViz({
  slug: 'em-wave',
  title: '电磁波的产生与传播',
  animated: true,
  params: {
    amp: { type: 'range', min: 0.3, max: 1.5, default: 1, step: 0.1, label: '场振幅（相对）' },
    freq: { type: 'range', min: 0.5, max: 3, default: 1.4, step: 0.1, label: '频率 ω（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const A = num(params, 'amp', 1);
    const om = num(params, 'freq', 1.4);

    clear(f);
    const yMid = h / 2 + 8;
    const x0 = 70, x1 = w - 60;
    const k = 0.02;
    const phase = -f.t * om * 2;

    // 传播轴
    seg(f, x0, yMid, x1, yMid, `${C.dim}88`, 1.4);
    text(f, '传播方向 z', x1 - 4, yMid + 20, { align: 'right', color: C.dim, font: '12px sans-serif' });

    // E 场（竖直，红）与 B 场（透视水平，蓝）
    const ePts: [number, number][] = [];
    const bPts: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const x = x0 + (i / 300) * (x1 - x0);
      const val = A * 70 * Math.sin(k * (x - x0) + phase);
      ePts.push([x, yMid - val]);
      // B：沿透视短轴（斜向 30°）
      bPts.push([x + val * 0.28, yMid + val * 0.5]);
    }
    poly(f, ePts, { stroke: C.hot, lw: 2.6 });
    poly(f, bPts, { stroke: C.cool, lw: 2.2 });
    // 场矢量抽样
    for (let i = 30; i < 300; i += 60) {
      const [ex, ey] = ePts[i];
      seg(f, ex, yMid, ex, ey, `${C.hot}aa`, 1.6);
      const [bx, by] = bPts[i];
      seg(f, bx - (by - yMid) * 0.4, yMid + (by - yMid) * 0.2, bx, by, `${C.cool}aa`, 1.6);
    }
    text(f, 'E（电场）⊥ B（磁场）⊥ 传播方向', x0, yMid - 96, { color: C.hot, font: '12px sans-serif' });
    text(f, 'B', x1 - 8, yMid + 56, { color: C.cool, font: '13px sans-serif' });
    text(f, 'E', x0 - 8, yMid - 70, { color: C.hot, font: '13px sans-serif' });
    // c 标注
    text(f, `E × B 方向即能流方向（坡印廷矢量 S = E×H/μ₀），永远以 c = 299792458 m/s 传播`, 60, h - 34, { color: C.cyan, font: '11px sans-serif' });

    footnotes(f, [
      '麦克斯韦方程的直接推论：变化的电场激发磁场、变化的磁场激发电场，两者交替自持向外传播',
      `频率 ω = ${om}（相对单位）、振幅 A = ${A}：光就是这段自我接力的电磁波，波长 λ = c/f`,
      '赫兹 1887 年用火花隙证实了它；从此电报、广播、雷达、5G 都是同一段波的不同频段',
    ]);
    heading(f, '电磁波：正交场量的自我接力');
  },
});
registerViz(emWave);

/** P39 伊辛模型与相变（2D 格点，Metropolis 单步动画）。 */
const isingModel = defineViz({
  slug: 'ising-model',
  title: '伊辛模型与相变',
  animated: true,
  params: {
    T: { type: 'range', min: 0.5, max: 4.5, default: 1.8, step: 0.1, label: '温度 T（T_c ≈ 2.269）' },
    size: { type: 'range', min: 16, max: 40, default: 28, step: 2, label: '格点尺寸 L' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const T = num(params, 'T', 1.8);
    const L = Math.round(num(params, 'size', 28));
    const Tc = 2.269;

    clear(f);
    // 自旋格点（帧间演化：每帧 Metropolis 若干次，用时间做确定性种子扰动）
    const cell = Math.min((h - 90) / L, (w * 0.5) / L);
    const ox = 30, oy = 54;
    const spins = isingState(L, T, Math.floor(f.t * 12));
    let m = 0;
    for (let i = 0; i < L; i++) {
      for (let j = 0; j < L; j++) {
        const s = spins[i * L + j];
        m += s;
        f.ctx.fillStyle = s > 0 ? 'rgba(102,126,234,0.92)' : 'rgba(237,137,54,0.92)';
        f.ctx.fillRect(ox + j * cell, oy + i * cell, cell - 0.6, cell - 0.6);
      }
    }
    m = Math.abs(m) / (L * L);

    // 右侧：序参量-温度曲线（平均场/精确 2D 低温展开示意）
    const rx0 = ox + L * cell + 50, rx1 = w - 34, ry0 = h - 56, ry1 = 60;
    if (rx1 - rx0 > 120) {
      seg(f, rx0, ry0, rx1, ry0, C.grid, 1.3);
      seg(f, rx0, ry0, rx0, ry1, C.grid, 1.3);
      const mOf = (t: number): number => (t >= Tc ? 0 : Math.pow(1 - (t / Tc) ** 2.2, 0.32));
      const pts: [number, number][] = [];
      for (let i = 0; i <= 100; i++) {
        const t2 = 0.5 + (i / 100) * 4;
        pts.push([rx0 + ((t2 - 0.5) / 4) * (rx1 - rx0), ry0 - mOf(t2) * (ry0 - ry1) * 0.9]);
      }
      poly(f, pts, { stroke: C.accent, lw: 2.4 });
      // 当前 T 标记
      const tx = rx0 + ((T - 0.5) / 4) * (rx1 - rx0);
      seg(f, tx, ry0, tx, ry1, `${C.warm}99`, 1.3);
      dot(f, tx, ry0 - mOf(T) * (ry0 - ry1) * 0.9, 5, C.warm);
      text(f, 'T_c', rx0 + ((Tc - 0.5) / 4) * (rx1 - rx0), ry0 + 16, { align: 'center', color: C.green, font: '11px sans-serif' });
      text(f, '序参量 |m|', rx0 + 4, ry1 - 8, { color: C.accent, font: '11px sans-serif' });
      text(f, 'T', rx1 - 4, ry0 + 16, { align: 'right', color: C.dim, font: '11px sans-serif' });
    }

    const phase = T < Tc * 0.97 ? '有序相（磁畴+长程有序）' : T > Tc * 1.03 ? '无序相（顺磁，涨落主导）' : '临界点附近（关联长度发散）';
    footnotes(f, [
      `T = ${T}（T_c ≈ 2.269）：当前${phase}，瞬时磁化强度 |m| ≈ ${m.toFixed(2)}`,
      'Metropolis 准则：ΔE≤0 接受，否则以 e^(−ΔE/T) 概率接受——温度越高翻转越多，热涨落瓦解有序',
      '临界点处关联长度发散、出现标度律与普适性——重正化群（威尔逊 1975 诺奖）由此诞生',
    ]);
    heading(f, '伊辛模型：温度如何瓦解有序');
  },
});
registerViz(isingModel);

/** 确定性 Metropolis 演化（纯函数式，供每帧调用）。 */
function isingState(L: number, T: number, frame: number): Int8Array {
  const s = new Int8Array(L * L);
  let seed = 12345;
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  // 初始低温有序 / 高温随机
  for (let i = 0; i < L * L; i++) s[i] = T < 2.269 ? 1 : rnd() > 0.5 ? 1 : -1;
  // 演化步数随帧增加（截断在 40 步避免过慢）
  const steps = Math.min(frame % 41, 40);
  const J = 1;
  for (let step = 0; step < steps; step++) {
    for (let n = 0; n < L * L; n++) {
      const i = Math.floor(n / L), j = n % L;
      const up = s[((i - 1 + L) % L) * L + j];
      const dn = s[((i + 1) % L) * L + j];
      const lf = s[i * L + ((j - 1 + L) % L)];
      const rt = s[i * L + ((j + 1) % L)];
      const dE = 2 * J * s[n] * (up + dn + lf + rt);
      if (dE <= 0 || rnd() < Math.exp(-dE / T)) s[n] = -s[n];
    }
  }
  return s;
}

/** P42 费曼图：电子-电子散射（树图）。 */
const feynmanDiagram = defineViz({
  slug: 'feynman-diagram',
  title: '费曼图与粒子散射',
  params: {
    q: { type: 'range', min: 0.2, max: 1, default: 0.6, step: 0.05, label: '动量转移 q/|p|（相对）' },
    timeDir: { type: 'select', options: ['时间向上', '时间向右'], default: '时间向上', label: '时间方向' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const q = num(params, 'q', 0.6);
    const vertical = str(params, 'timeDir', '时间向上') === '时间向上';

    clear(f);
    if (vertical) {
      const cx = w / 2, cy = h / 2 + 6;
      const dx = 60 + q * 60;
      // 入射电子（下两线）与出射（上两线）
      const inA: [number, number][] = [[cx - dx - 60, cy + 150], [cx - dx * 0.4, cy + 40]];
      const inB: [number, number][] = [[cx + dx + 60, cy + 150], [cx + dx * 0.4, cy + 40]];
      const outA: [number, number][] = [[cx - dx * 0.4, cy - 40], [cx - dx * 0.9 - 40, cy - 150]];
      const outB: [number, number][] = [[cx + dx * 0.4, cy - 40], [cx + dx * 0.9 + 40, cy - 150]];
      const drawLine = (p: [number, number][], color: string) => seg(f, p[0][0], p[0][1], p[1][0], p[1][1], color, 2.4);
      drawLine(inA, C.cool); drawLine(inB, C.cool);
      drawLine(outA, C.cool); drawLine(outB, C.cool);
      // 顶点
      dot(f, cx - dx * 0.4, cy + 40, 6, C.fg);
      dot(f, cx + dx * 0.4, cy + 40, 6, C.fg);
      dot(f, cx - dx * 0.4, cy - 40, 6, C.fg);
      dot(f, cx + dx * 0.4, cy - 40, 6, C.fg);
      // 交换光子（波浪线）
      const photon: [number, number][] = [];
      const vx1 = cx - dx * 0.4, vx2 = cx + dx * 0.4;
      for (let i = 0; i <= 40; i++) {
        const t2 = i / 40;
        const x = vx1 + (vx2 - vx1) * t2;
        photon.push([x, cy + 40 - 80 * t2 + Math.sin(t2 * Math.PI * 8) * 9]);
      }
      poly(f, photon, { stroke: C.hot, lw: 2.2 });
      text(f, 'γ（交换虚光子）', cx + 8, cy - 52, { color: C.hot, font: '11px sans-serif' });
      text(f, 'e⁻', inA[0][0] - 18, inA[0][1], { color: C.cool, font: '13px sans-serif' });
      text(f, 'e⁻', inB[0][0] + 10, inB[0][1], { color: C.cool, font: '13px sans-serif' });
      text(f, '时间 ↑', 30, 44, { color: C.dim, font: '11px sans-serif' });
      text(f, `顶点耦合 e（α = e²/4πε₀ℏc ≈ 1/137）　动量转移 q ≈ ${q.toFixed(2)}|p|`, 30, h - 34, { color: C.cyan, font: '11px sans-serif' });
    } else {
      // 时间向右（同一图旋转简化版）
      const cx = w / 2, cy = h / 2 + 6;
      const dy = 50 + q * 50;
      seg(f, 70, cy - dy - 60, cx - 40, cy - dy * 0.3, C.cool, 2.4);
      seg(f, 70, cy + dy + 60, cx - 40, cy + dy * 0.3, C.cool, 2.4);
      seg(f, cx + 40, cy - dy * 0.3, w - 70, cy - dy - 60, C.cool, 2.4);
      seg(f, cx + 40, cy + dy * 0.3, w - 70, cy + dy + 60, C.cool, 2.4);
      const photon: [number, number][] = [];
      for (let i = 0; i <= 40; i++) {
        const t2 = i / 40;
        photon.push([cx - 40 + 80 * t2, cy - dy * 0.3 + (dy * 0.6) * t2 + Math.sin(t2 * Math.PI * 8) * 8]);
      }
      poly(f, photon, { stroke: C.hot, lw: 2.2 });
      text(f, '时间 →', 30, 44, { color: C.dim, font: '11px sans-serif' });
    }

    footnotes(f, [
      '每条线是一个粒子的传播子，每个顶点贡献一个耦合常数 e——图即公式：截面 = |M|² × 相空间',
      '最低阶（树图）给出主导贡献；圈图带来 α≈1/137 的微扰修正，QED 磁矩理论与实验吻合到小数点后十位',
      '费曼图不是装饰：它是把无穷级数变成可计算图形的记账系统（1965 年诺奖）',
    ]);
    heading(f, '费曼图：电子-电子散射树图');
  },
});
registerViz(feynmanDiagram);
