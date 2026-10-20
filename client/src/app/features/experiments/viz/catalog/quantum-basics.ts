import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text, view } from '../canvas';

/** P107 无限深势阱。 */
const infiniteWell = defineViz({
  slug: 'infinite-well', title: '无限深势阱',
  params: {
    n: { type: 'range', min: 1, max: 6, default: 2, step: 1, label: '量子数 n' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'n', 2));
    clear(f);
    const x0 = 70, x1 = w - 70, base = h - 90;
    // 势阱壁
    seg(f, x0, base - 320, x0, base, C.dim, 3.4);
    seg(f, x1, base - 320, x1, base, C.dim, 3.4);
    seg(f, x0, base, x1, base, C.dim, 3.4);
    text(f, 'V=∞', x0 - 34, base - 330, { color: C.dim, font: '11px sans-serif' });
    text(f, 'V=∞', x1 + 6, base - 330, { color: C.dim, font: '11px sans-serif' });
    // 波函数 ψₙ = √(2/L) sin(nπx/L)（上下画概率密度包络）
    const psi = (x: number): number => Math.sin((n * Math.PI * x) / (x1 - x0));
    for (const s of [1, -1]) {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 300; i++) {
        const x = x0 + (i / 300) * (x1 - x0);
        pts.push([x, base - 170 + s * psi((x - x0)) * 110]);
      }
      poly(f, pts, { stroke: s > 0 ? C.accent : `${C.accent}66`, lw: 2.6, ...(s > 0 ? {} : { dash: [6, 4] }) } as any);
    }
    // |ψ|² 概率密度填充
    const dens: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const x = x0 + (i / 300) * (x1 - x0);
      dens.push([x, base - 170 - Math.pow(psi(x - x0), 2) * 130]);
    }
    poly(f, [...dens, [x1, base - 170], [x0, base - 170]], { stroke: 'transparent', fill: 'rgba(16,185,129,0.30)' } as any);
    // 能级
    const En = n * n;
    seg(f, x0, base - 340 - 0, x1, base - 340, `${C.warm}55`, 1);
    text(f, `Eₙ = n²E₁ = ${En} E₁　（n=${n}，节点数 ${n - 1}）`, 30, 44, { color: C.warm, font: '14px sans-serif' });
    text(f, '能级间隔越来越大：量子化的指纹', 30, 66, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      '边界条件 ψ(0)=ψ(L)=0 只允许 sin(nπx/L) —— 不是假设，是数学的必然',
      '能量 Eₙ ∝ n²：盒越大能级越密——纳米量子点的尺寸决定发光颜色（量子限域效应）',
      '零点能（n=1）不可移除：不确定性原理的直接后果，氦直到 4K 也不凝固',
    ]);
    heading(f, '无限深势阱：量子化的诞生');
  },
});
registerViz(infiniteWell);

/** P108 量子谐振子。 */
const quantumOscillator = defineViz({
  slug: 'quantum-oscillator', title: '量子谐振子',
  params: {
    n: { type: 'range', min: 0, max: 5, default: 0, step: 1, label: '量子数 n' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'n', 0));
    clear(f);
    const x0 = 70, x1 = w - 70, base = h - 80, cx = (x0 + x1) / 2;
    // 抛物线势 V = ½mω²x²
    const pot: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const x = x0 + (i / 120) * (x1 - x0);
      const u = (x - cx) / ((x1 - x0) / 2);
      pot.push([x, base - u * u * 260]);
    }
    poly(f, pot, { stroke: C.dim, lw: 2.6 });
    // 能级 Eₙ = (n+½)ħω
    const En = n + 0.5;
    const eY = base - 30 - En * 42;
    const turn = Math.sqrt(En / 3.2) * ((x1 - x0) / 2);
    seg(f, cx - turn, eY, cx + turn, eY, C.warm, 2.4);
    text(f, `E${n === 0 ? '₀' : 'ₙ'} = ${n}+½ = ${En} ħω`, cx + turn + 8, eY + 4, { color: C.warm, font: '12px sans-serif' });
    // 波函数（厄米多项式示意：n 节点）
    const psi = (x: number): number => {
      const t = (x - cx) / ((x1 - x0) / 4);
      const gauss = Math.exp(-(t * t) / 2.2);
      // 用切比雪夫式振荡近似厄米多项式的节点结构
      let polyV = 1;
      for (let k = 0; k < n; k++) polyV *= 1;
      const osc = n === 0 ? 1 : Math.cos(t * Math.sqrt(n + 0.5) * 1.7);
      return gauss * osc * polyV;
    };
    const pts: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const x = x0 + (i / 300) * (x1 - x0);
      pts.push([x, eY - psi(x) * 56]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.4 });
    if (n === 0) text(f, '基态：单峰高斯，概率最低点在中心并不为零', cx - 140, eY - 70, { color: C.cyan, font: '12px sans-serif' });
    text(f, n > 0 ? `第 ${n} 激发态：${n} 个节点，振幅包络仍在中心最大` : 'E₀ = ½ħω：零点能永不可消除', 30, 44, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '等间距能级 ħω 是升湮算符 a⁺/a 的直接结果——量子场论粒子概念的原型',
      '任何势阱底部附近都近似谐振子：分子振动、晶格声子、超导库珀对都用它',
      "零点涨落导致卡西米尔力——真空中两片金属因'没有空间'放虚光子而相吸",
    ]);
    heading(f, '量子谐振子：等间距的量子阶梯');
  },
});
registerViz(quantumOscillator);

/** P109 量子隧穿。 */
const tunneling = defineViz({
  slug: 'tunneling', title: '量子隧穿', animated: true,
  params: {
    E: { type: 'range', min: 20, max: 95, default: 55, step: 5, label: '粒子能量 E（势垒高的 %）' },
    V0: { type: 'range', min: 40, max: 100, default: 80, step: 5, label: '势垒高 V₀（%）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const E = num(params, 'E', 55), V0 = num(params, 'V0', 80);
    const tunnel = E < V0;
    clear(f);
    const x0 = 60, x1 = w - 60, base = h - 90;
    const bx0 = w * 0.42, bx1 = w * 0.58;
    // 势垒
    const barH = (V0 / 100) * 240;
    poly(f, [[bx0, base], [bx0, base - barH], [bx1, base - barH], [bx1, base]],
      { stroke: C.hot, lw: 2.4, fill: 'rgba(237,87,54,0.18)' } as any);
    text(f, `V₀=${V0}%`, bx0 + 10, base - barH - 10, { color: C.hot, font: '12px sans-serif' });
    // 能量线
    const eY = base - (E / 100) * 240;
    poly(f, [[x0, eY], [x1, eY]], { stroke: `${C.warm}aa`, lw: 1.6, dash: [8, 5] });
    text(f, `E=${E}%`, x0, eY - 8, { color: C.warm, font: '11px sans-serif' });
    // 波函数：入射+反射 → 势垒内指数衰减 → 透射
    const A = 44;
    const left: [number, number][] = [];
    const right: [number, number][] = [];
    const inside: [number, number][] = [];
    for (let i = 0; i <= 260; i++) {
      const x = x0 + (i / 260) * (x1 - x0);
      const ph = x * 0.10 - f.t * 5;
      if (x < bx0) {
        left.push([x, eY - (Math.sin(ph) + 0.55 * Math.sin(-ph)) * A]);
      } else if (x > bx1) {
        right.push([x, eY - Math.sin(ph - 3.2) * A * (tunnel ? 0.45 : 0.06)]);
      } else {
        const t = (x - bx0) / (bx1 - bx0);
        const decay = Math.exp(-t * 3.4);
        inside.push([x, eY - Math.sin(-ph * 0.3) * A * decay]);
      }
    }
    poly(f, left, { stroke: C.accent, lw: 2.4 });
    poly(f, inside, { stroke: `${C.accent}aa`, lw: 2, dash: [5, 4] } as any);
    poly(f, right, { stroke: tunnel ? C.green : `${C.dim}aa`, lw: 2.4 });
    text(f, tunnel ? `透射概率 T ≈ e^(−2κL) > 0：粒子出现在右侧（经典禁区！）` : 'E > V₀：可越垒而过，仅轻微反射（经典允许）',
      30, 44, { color: tunnel ? C.green : C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '势垒内波函数按 e^(−κx) 衰减却不到零——厚度有限就留有透射的可能',
      '扫描隧穿显微镜（STM）：针尖与样品间隧穿电流对间距指数敏感，单原子成像',
      '太阳核心氢核靠隧穿克服库仑势垒才发生聚变——没有隧穿就没有阳光',
    ]);
    heading(f, '量子隧穿：穿墙的概率');
  },
});
registerViz(tunneling);

/** P110 角动量量子化。 */
const angularMomentumQm = defineViz({
  slug: 'angular-momentum-qm', title: '角动量量子化',
  params: {
    l: { type: 'range', min: 0, max: 4, default: 2, step: 1, label: '角量子数 l' },
    m: { type: 'range', min: -4, max: 4, default: 1, step: 1, label: '磁量子数 m（绝对值≤l）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const l = Math.round(num(params, 'l', 2));
    let m = Math.round(num(params, 'm', 1));
    if (Math.abs(m) > l) m = l;
    clear(f);
    const cx = w / 2, cy = h / 2 + 20;
    // z 轴
    seg(f, cx, cy - 150, cx, cy + 150, `${C.dim}aa`, 2);
    text(f, 'z 轴', cx + 8, cy - 158, { color: C.dim, font: '11px sans-serif' });
    // L 矢量（与 z 轴夹角：cosθ = m/√(l(l+1))）
    const Lz = m;
    const Lmag = Math.sqrt(l * (l + 1));
    const costh = Lz / Lmag;
    const th = Math.acos(Math.max(-1, Math.min(1, costh)));
    const len = 130;
    // 进动画圆（量子不确定的测不准示意：方位角自由）
    const phi = f.t * 1.3;
    const tipX = cx + Math.sin(th) * len * Math.cos(phi);
    const tipY = cy - Math.cos(th) * len;
    const tipZ = Math.sin(th) * len * Math.sin(phi);
    const persp = 1 + tipZ / (len * 6);
    const tx = cx + (tipX - cx) * persp;
    seg(f, cx, cy, tx, tipY, C.accent, 3.4);
    dot(f, tx, tipY, 7, C.accent);
    // Lz 投影
    seg(f, cx, cy, cx, cy - Lz * (len / Lmag), C.warm, 3);
    dot(f, cx, cy - Lz * (len / Lmag), 5, C.warm);
    // 进动圆锥
    const ring: [number, number][] = [];
    for (let a = 0; a <= Math.PI * 2; a += 0.07) {
      const px = cx + Math.sin(th) * len * Math.cos(a);
      const pz = Math.sin(th) * len * Math.sin(a);
      ring.push([cx + (px - cx) * (1 + pz / (len * 6)), tipY]);
    }
    poly(f, ring, { stroke: `${C.warm}66`, lw: 1.4, dash: [5, 4] } as any);
    text(f, `|L| = √(l(l+1)) ħ = ${Lmag.toFixed(2)}ħ　L_z = m ħ = ${Lz}ħ`, 30, 44, { color: C.cyan, font: '14px sans-serif' });
    text(f, `l=${l}（${2 * l + 1} 个 m 态）：与 z 轴夹角 θ = ${((th * 180) / Math.PI).toFixed(1)}°`, 30, 66, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      `l=${l} 时 |L|=√${(l * (l + 1)).toFixed(1)}ħ 略大于 L_z——矢量永不与 z 轴完全对齐（不确定性原理）`,
      '方位角 φ 完全不定，L 只能绕 z 轴进动：空间量子化的几何图景',
      '2l+1 个 m 态在磁场中分裂成 2l+1 条谱线——塞曼效应的直接观测验证',
    ]);
    heading(f, '角动量量子化：空间本身有刻度');
  },
});
registerViz(angularMomentumQm);

/** P111 自旋进动。 */
const spinPrecession = defineViz({
  slug: 'spin-precession', title: '自旋进动', animated: true,
  params: {
    B: { type: 'range', min: 0.1, max: 3, default: 1, step: 0.1, label: '磁场 B₀（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const B = num(params, 'B', 1);
    const omegaL = B * 1.6; // 拉莫尔频率 ∝ B
    clear(f);
    const cx = w / 2, cy = h / 2 + 24;
    // 磁场方向（向上）
    for (const dx of [-90, 0, 90]) {
      seg(f, cx + dx, cy + 150, cx + dx, cy - 150, `${C.cool}55`, 1.6);
      poly(f, [[cx + dx, cy - 156], [cx + dx - 6, cy - 144], [cx + dx + 6, cy - 144]], { stroke: C.cool, lw: 1.4, fill: C.cool } as any);
    }
    text(f, 'B₀', cx + 96, cy - 150, { color: C.cool, font: '13px sans-serif' });
    // 自旋磁矩（绕 B 进动）
    const tilt = 0.6;
    const phi = f.t * omegaL;
    const tipX = cx + Math.sin(tilt) * 130 * Math.cos(phi);
    const tipY = cy - Math.cos(tilt) * 130;
    const tipZ = Math.sin(tilt) * 130 * Math.sin(phi);
    const persp = 1 + tipZ / 780;
    const tx = cx + (tipX - cx) * persp;
    seg(f, cx, cy, tx, tipY, C.warm, 3.4);
    text(f, 'μ（自旋磁矩）', tx + 8, tipY, { color: C.warm, font: '12px sans-serif' });
    // 进动圆
    const ring: [number, number][] = [];
    for (let a = 0; a <= Math.PI * 2; a += 0.06) {
      const px = cx + Math.sin(tilt) * 130 * Math.cos(a);
      const pz = Math.sin(tilt) * 130 * Math.sin(a);
      ring.push([cx + (px - cx) * (1 + pz / 780), tipY]);
    }
    poly(f, ring, { stroke: `${C.warm}aa`, lw: 2, dash: [6, 4] } as any);
    dot(f, cx, cy, 7, C.dim);
    text(f, `ω_L = γB₀ = ${omegaL.toFixed(2)} rad/s（γ 为旋磁比）`, 30, 44, { color: C.cyan, font: '14px sans-serif' });
    text(f, `B₀=${B}：磁场越强，进动越快`, 30, 66, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '自旋磁矩在磁场中受力矩却不改变倾角，只改变方位——与陀螺进动完全同构',
      '施加匹配 ω_L 的射频场可翻转自旋（磁共振条件）——MRI 成像的第一步',
      '原子磁钟、核磁共振波谱、极化中子源都建立在精确操控进动之上',
    ]);
    heading(f, '自旋进动：微观世界的陀螺');
  },
});
registerViz(spinPrecession);

/** P112 波包扩散。 */
const wavepacket = defineViz({
  slug: 'wavepacket', title: '波包扩散', animated: true,
  params: {
    spread: { type: 'range', min: 0.5, max: 4, default: 1, step: 0.1, label: '初始宽度（窄←→宽）' },
    v: { type: 'range', min: 0, max: 3, default: 1, step: 0.2, label: '群速度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const sigma0 = num(params, 'spread', 1);
    const vg = num(params, 'v', 1);
    clear(f);
    const x0 = 60, x1 = w - 60, base = h / 2 + 60;
    const cx0 = (x0 + x1) / 2;
    // 时间演化：中心以群速度移动，宽度随 t 增长（色散）
    const tt = (f.t * 0.6) % 5;
    const cxp = cx0 + vg * tt * 40;
    const sigma = (1 / sigma0) * (1 + tt * 0.55);
    // |ψ|² 高斯包络
    const dens: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const x = x0 + (i / 300) * (x1 - x0);
      const d = Math.exp(-Math.pow(x - cxp, 2) / (2 * sigma * sigma));
      dens.push([x, base - d * 130]);
    }
    poly(f, [...dens, [x1, base], [x0, base]], { stroke: 'transparent', fill: 'rgba(16,185,129,0.30)' } as any);
    poly(f, dens, { stroke: C.green, lw: 2.8 });
    // 波函数实部（振荡在包络内）
    const wave: [number, number][] = [];
    for (let i = 0; i <= 400; i++) {
      const x = x0 + (i / 400) * (x1 - x0);
      const d = Math.sqrt(Math.exp(-Math.pow(x - cxp, 2) / (2 * sigma * sigma)));
      wave.push([x, base - d * 130 * Math.cos((x - cxp) * 0.14 - f.t * 5) * 0.92]);
    }
    poly(f, wave, { stroke: C.accent, lw: 1.6 });
    seg(f, x0, base, x1, base, `${C.grid}aa`, 1.3);
    // 1σ 宽度标记
    seg(f, cxp - sigma, base + 24, cxp + sigma, base + 24, C.warm, 2.4);
    text(f, `σ(t) = σ₀√(1+(κt/2σ₀²²)²) ≈ ${sigma.toFixed(1)}`, cxp - 60, base + 44, { color: C.warm, font: '12px sans-serif' });
    text(f, `波包展宽 = 位置越来越不确定（Δx↑ → Δp↓）`, 30, 44, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '自由粒子的波包由许多动量成分叠加而成，各成分速度不同（色散）→ 包络必然摊开',
      "这就是微观'粒子'没有确定轨迹的原因：测量只会给出一次抽样位置",
      '冷原子实验可直接录像看到波包扩散与反射——波动方程的可视化实证',
    ]);
    heading(f, '波包扩散：不确定性在时间中生长');
  },
});
registerViz(wavepacket);
