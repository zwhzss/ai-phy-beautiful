import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, curve, dot, footnotes, grid, heading, seg, text, view } from '../canvas';

/** P15 卡诺循环与热机效率。 */
const carnotCycle = defineViz({
  slug: 'carnot-cycle',
  title: '卡诺循环与热机效率',
  params: {
    Th: { type: 'range', min: 400, max: 900, default: 600, step: 10, label: '高温热源 T_H (K)' },
    Tc: { type: 'range', min: 250, max: 450, default: 300, step: 10, label: '低温热源 T_C (K)' },
    V2: { type: 'range', min: 1.5, max: 4, default: 2.5, step: 0.1, label: '膨胀比 V₂/V₁' },
  },
  draw: (f) => {
    const { params } = f;
    let Th = num(params, 'Th', 600);
    let Tc = num(params, 'Tc', 300);
    if (Tc >= Th) Tc = Th - 50;
    const ratio = num(params, 'V2', 2.5);
    const gamma = 1.4;
    const V1 = 1;
    const V2 = ratio;
    const V3 = V2 * Math.pow(Th / Tc, 1 / (gamma - 1));
    const V4 = Math.pow(Th / Tc, 1 / (gamma - 1));
    const eta = 1 - Tc / Th;
    const nR = 1;

    const v = view(f, { xMin: 0.8, xMax: Math.max(V3 * 1.1, 4), yMin: 0, yMax: (nR * Th / V1) * 1.12, inset: 50 });
    grid(f, v, { divisions: 5, ticks: true });

    // 四段：1→2 等温膨胀(Th)，2→3 绝热膨胀，3→4 等温压缩(Tc)，4→1 绝热压缩
    const seg1 = (V: number) => (nR * Th) / V;                 // 等温 Th
    const seg2 = (V: number) => (nR * Th * Math.pow(V2, gamma - 1)) / Math.pow(V, gamma); // 绝热 从(V2, Th)
    const seg3 = (V: number) => (nR * Tc) / V;                 // 等温 Tc
    const seg4 = (V: number) => (nR * Tc * Math.pow(V4, gamma - 1)) / Math.pow(V, gamma); // 绝热 从(V4, Tc)

    const part = (fn: (V: number) => number, a: number, b: number, color: string) =>
      curve(f, v, (V) => (V >= Math.min(a, b) && V <= Math.max(a, b) ? fn(V) : NaN), { color, lw: 2.4, samples: 160 });

    part(seg1, V1, V2, C.hot);
    part(seg2, V2, V3, C.warm);
    part(seg3, V4, V3, C.cool);
    part(seg4, V1, V4, C.cyan);

    // 顶点与方向
    const corners: [number, number, string][] = [
      [V1, seg1(V1), '1'],
      [V2, seg1(V2), '2'],
      [V3, seg2(V3), '3'],
      [V4, seg3(V4), '4'],
    ];
    for (const [vx, py, label] of corners) {
      dot(f, v.sx(vx), v.sy(py), 5, C.fg);
      text(f, label, v.sx(vx) + 8, v.sy(py) - 8, { color: C.fg, font: '13px sans-serif' });
    }
    // 热源/热汇标注
    text(f, `吸热 T_H=${Th}K`, v.sx((V1 + V2) / 2), v.sy(seg1((V1 + V2) / 2)) - 14, { align: 'center', color: C.hot, font: '12px sans-serif' });
    text(f, `放热 T_C=${Tc}K`, v.sx((V3 + V4) / 2), v.sy(seg3((V4 + V3) / 2)) + 20, { align: 'center', color: C.cool, font: '12px sans-serif' });
    text(f, 'V', v.sx(v.xMax) + 6, v.sy(0) + 4, { color: C.dim, font: '13px sans-serif' });
    text(f, 'P', v.sx(v.xMin) - 6, v.sy(v.yMax) + 4, { color: C.dim, font: '13px sans-serif' });

    // 效率读数
    text(f, `η = 1 − T_C/T_H = ${(eta * 100).toFixed(1)}%`, 60, 34, { color: C.green, font: '15px sans-serif' });
    text(f, `绝热点：V₃=${V3.toFixed(2)}、V₄=${V4.toFixed(2)}（TV^(γ−1)=const）`, 60, 54, { color: C.dim, font: '11px sans-serif' });

    footnotes(f, [
      `四个冲程：1→2 等温膨胀（吸热）→ 2→3 绝热膨胀（降温）→ 3→4 等温压缩（放热）→ 4→1 绝热压缩（升温）`,
      `卡诺效率只取决于两热源温度：η = 1 − ${Tc}/${Th} = ${(eta * 100).toFixed(1)}% —— 一切真实热机效率都低于它`,
      '提高效率只有两条路：升高 T_H 或降低 T_C；蒸汽机 ~40%、燃气轮机 ~60%，都受此上限约束（热力学第二定律）',
    ]);
    heading(f, '卡诺循环：P-V 图');
  },
});
registerViz(carnotCycle);

/** P16 麦克斯韦速率分布。 */
const maxwellBoltzmann = defineViz({
  slug: 'maxwell-boltzmann',
  title: '麦克斯韦速率分布',
  params: {
    T: { type: 'range', min: 100, max: 1500, default: 300, step: 10, label: '温度 T (K)' },
    gas: { type: 'select', options: ['氢气 H₂ (M=2)', '空气 N₂ (M=28)', '氧气 O₂ (M=32)'], default: '空气 N₂ (M=28)', label: '气体' },
  },
  draw: (f) => {
    const { params } = f;
    const T = num(params, 'T', 300);
    const gas = String(params['gas'] ?? '空气 N₂ (M=28)');
    const M = gas.includes('H₂') ? 0.002 : gas.includes('O₂') ? 0.032 : 0.028; // kg/mol
    const R = 8.314;
    const vp = Math.sqrt((2 * R * T) / M);       // 最概然速率
    const vrms = Math.sqrt((3 * R * T) / M);     // 均方根速率
    const vmax = vp * 3;

    const v = view(f, { xMin: 0, xMax: vmax, yMin: 0, yMax: 1.15, inset: 48 });
    grid(f, v, { divisions: 5, ticks: true });
    const alpha = (M) / (2 * R * T);
    const fOf = (x: number): number => {
      const c = 4 * Math.PI * Math.pow(alpha / Math.PI, 1.5);
      return c * x * x * Math.exp(-alpha * x * x) / (4 * Math.PI * Math.pow(alpha / Math.PI, 1.5)); // 归一前峰值≈1
    };
    // 归一到峰值=1 便于比较形状
    let peak = 0;
    for (let i = 1; i <= 300; i++) {
      const x = (i / 300) * vmax;
      peak = Math.max(peak, fOf(x));
    }
    curve(f, v, (x) => fOf(x) / peak, { color: C.accent, lw: 2.6, samples: 400 });
    // 对比温度（±150K 虚线）
    for (const Talt of [T - 150, T + 150]) {
      if (Talt < 50) continue;
      const a2 = M / (2 * R * Talt);
      const g = (x: number) => 4 * Math.PI * Math.pow(a2 / Math.PI, 1.5) * x * x * Math.exp(-a2 * x * x);
      let pk = 0;
      for (let i = 1; i <= 300; i++) {
        const x = (i / 300) * vmax;
        pk = Math.max(pk, g(x));
      }
      curve(f, v, (x) => g(x) / pk, { color: `${C.dim}66`, lw: 1.2, dash: [5, 4], samples: 300 });
    }
    // 特征速率标注
    seg(f, v.sx(vp), v.sy(0), v.sx(vp), v.sy(1), `${C.warm}aa`, 1.4);
    seg(f, v.sx(vrms), v.sy(0), v.sx(vrms), v.sy(0.7), `${C.green}aa`, 1.2);
    text(f, `v_p=${vp.toFixed(0)}`, v.sx(vp) + 6, v.sy(1) - 6, { color: C.warm, font: '12px sans-serif' });
    text(f, `v_rms=${vrms.toFixed(0)}`, v.sx(vrms) + 6, v.sy(0.7) - 6, { color: C.green, font: '12px sans-serif' });
    text(f, '速率 v (m/s)', v.sx(v.xMax) - 4, v.sy(0) + 20, { align: 'right', color: C.dim, font: '12px sans-serif' });
    text(f, 'f(v)（归一）', v.sx(0) - 40, v.sy(1.1), { color: C.accent, font: '12px sans-serif' });

    footnotes(f, [
      `${gas.split(' ')[0]} 在 T = ${T} K：v_p = √(2RT/M) = ${vp.toFixed(0)} m/s，v_rms = √(3RT/M) = ${vrms.toFixed(0)} m/s`,
      '温度升高：曲线峰值右移且变矮变宽 —— 更多分子获得高速（恒容下总概率始终为 1）',
      'f(v) ∝ v²·e^(−Mv²/2RT)：v² 来自相空间体积、指数来自玻尔兹曼因子 —— 两种倾向的竞争产生"最概然速率"',
      '0 K 时所有分子静止是经典图像；量子统计（费米/玻色）在低温与高密下取代 Maxwell-Boltzmann 分布',
    ]);
    heading(f, '麦克斯韦速率分布：温度与分子速率');
  },
});
registerViz(maxwellBoltzmann);
