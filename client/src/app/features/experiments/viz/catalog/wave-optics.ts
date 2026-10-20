import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text } from '../canvas';

/** P09 波的叠加与双源干涉：2D 干涉场 + 强度分布。 */
const waveSuperposition = defineViz({
  slug: 'wave-superposition',
  title: '波的叠加与双源干涉',
  params: {
    d: { type: 'range', min: 1, max: 8, default: 3, step: 0.5, label: '源距 d (λ)' },
    phase: { type: 'range', min: 0, max: 6.28, default: 1.57, step: 0.01, label: '初相位差' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const d = num(params, 'd', 3);
    const dPhi = num(params, 'phase', 1.57);

    clear(f);
    // 左半：2D 干涉强度图（4px 块）
    const boxW = Math.min(w * 0.5, h - 60);
    const ox = 30, oy = 30;
    const px0 = ox, py0 = oy;
    const s1y = h / 2 - (d * 26) / 2;
    const s2y = h / 2 + (d * 26) / 2;
    const k = (2 * Math.PI) / 40; // λ = 40px
    const block = 4;
    for (let y = py0; y < py0 + boxW && y < h - 30; y += block) {
      for (let x = px0; x < px0 + boxW && x < w * 0.5; x += block) {
        const r1 = Math.hypot(x - px0 - 18, y - s1y);
        const r2 = Math.hypot(x - px0 - 18, y - s2y);
        const I = Math.cos(((k * (r2 - r1)) + dPhi) / 2) ** 2; // 0..1
        const a = 0.12 + I * 0.75;
        f.ctx.fillStyle = `rgba(102, 126, 234, ${a})`;
        f.ctx.fillRect(x, y, block, block);
      }
    }
    dot(f, px0 + 18, s1y, 6, C.hot);
    dot(f, px0 + 18, s2y, 6, C.hot);
    text(f, 'S₁', px0 + 26, s1y + 4, { color: C.hot, font: '12px sans-serif' });
    text(f, 'S₂', px0 + 26, s2y + 4, { color: C.hot, font: '12px sans-serif' });

    // 右半：强度分布 I(θ)
    const rx0 = w * 0.55, rx1 = w - 24, ry0 = h - 56, ry1 = 40;
    seg(f, rx0, ry0, rx1, ry0, C.grid, 1.4);
    seg(f, rx0, ry0, rx0, ry1, C.grid, 1.4);
    const sx = (th: number) => rx0 + ((th + Math.PI / 2) / Math.PI) * (rx1 - rx0);
    const sy = (I: number) => ry0 - I * (ry0 - ry1);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const th = -Math.PI / 2 + (i / 300) * Math.PI;
      const I = Math.cos((Math.PI * d * Math.sin(th)) + dPhi / 2) ** 2;
      pts.push([sx(th), sy(I)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.2 });
    // 极大方向标注
    for (let m = -2; m <= 2; m++) {
      const sinTh = (m - dPhi / (2 * Math.PI)) / d;
      if (Math.abs(sinTh) <= 1) {
        const th = Math.asin(sinTh);
        seg(f, sx(th), ry0, sx(th), ry1, `${C.green}55`, 1);
        text(f, `m=${m}`, sx(th), ry1 - 6, { align: 'center', color: C.green, font: '11px sans-serif' });
      }
    }
    text(f, 'θ', rx1 - 4, ry0 + 18, { align: 'right', color: C.dim, font: '12px sans-serif' });
    text(f, 'I(θ)', rx0 + 8, ry1 + 4, { color: C.accent, font: '12px sans-serif' });

    footnotes(f, [
      `源距 d = ${d}λ、初相位差 Δφ₀ = ${dPhi.toFixed(2)} rad：I(θ) = cos²(πd·sinθ + Δφ₀/2)`,
      '左图亮纹 = 波程差为波长整数倍（相长干涉）；暗纹 = 半整数倍（相消）—— 明暗条纹是"波叠加"的直接证据',
      '相干条件：同频率、相位差恒定。两盏灯互照不会干涉，因为普通光源相位随机（时间相干性）',
    ]);
    heading(f, '双源干涉：干涉场与角分布');
  },
});
registerViz(waveSuperposition);

/** P10 双缝干涉：强度分布与条纹。 */
const doubleSlit = defineViz({
  slug: 'double-slit',
  title: '双缝干涉',
  params: {
    d: { type: 'range', min: 2, max: 20, default: 8, step: 1, label: '缝距 d (λ)' },
    a: { type: 'range', min: 0.2, max: 4, default: 1, step: 0.1, label: '缝宽 a (λ)' },
    lambda: { type: 'range', min: 400, max: 700, default: 550, step: 10, label: '波长 (nm)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const d = num(params, 'd', 8);
    const a = num(params, 'a', 1);
    const lam = num(params, 'lambda', 550);
    // 波长 → 颜色（粗略映射）
    const hue = ((lam - 400) / 300) * 240; // 400nm≈紫(240) → 700nm≈红(0)
    const lightColor = `hsl(${360 - hue}, 85%, 58%)`;

    clear(f);
    // 强度曲线：双缝因子 × 单缝包络
    const x0 = 56, x1 = w - 30, y0 = h - 56, y1 = 44;
    seg(f, x0, y0, x1, y0, C.grid, 1.4);
    seg(f, x0, y0, x0, y1, C.grid, 1.4);
    const sx = (th: number) => x0 + ((th + Math.PI / 3) / (2 * Math.PI / 3)) * (x1 - x0);
    const sy = (I: number) => y0 - I * (y0 - y1);
    const intensity = (th: number): number => {
      const u = (Math.PI * a * Math.sin(th));       // 缝宽因子（以 λ 为单位已归一）
      const s = u === 0 ? 1 : Math.sin(u) / u;
      return s * s * Math.cos(Math.PI * d * Math.sin(th)) ** 2;
    };
    const pts: [number, number][] = [];
    for (let i = 0; i <= 480; i++) {
      const th = -Math.PI / 3 + (i / 480) * (2 * Math.PI / 3);
      pts.push([sx(th), sy(intensity(th))]);
    }
    poly(f, pts, { stroke: lightColor, lw: 2.4 });
    // 单缝包络（虚线）
    const env: [number, number][] = [];
    for (let i = 0; i <= 480; i++) {
      const th = -Math.PI / 3 + (i / 480) * (2 * Math.PI / 3);
      const u = Math.PI * a * Math.sin(th);
      const s = u === 0 ? 1 : Math.sin(u) / u;
      env.push([sx(th), sy(s * s)]);
    }
    poly(f, env, { stroke: `${C.dim}88`, lw: 1.2, dash: [5, 4] } as any);
    text(f, '单缝包络', x1 - 6, y1 + 14, { align: 'right', color: C.dim, font: '11px sans-serif' });
    text(f, 'I(θ)', x0 + 8, y1 + 4, { color: lightColor, font: '12px sans-serif' });
    text(f, 'θ = 0', (x0 + x1) / 2, y0 + 18, { align: 'center', color: C.dim, font: '12px sans-serif' });

    // 底部：观察屏条纹
    const stripY = h - 40;
    const stripH = 22;
    for (let px = x0; px <= x1; px += 2) {
      const th = ((px - x0) / (x1 - x0)) * (2 * Math.PI / 3) - Math.PI / 3;
      const I = intensity(th);
      f.ctx.fillStyle = `rgba(${hue > 120 ? '160,120,255' : hue > 60 ? '80,160,255' : '255,140,80'}, ${0.15 + I * 0.85})`;
      f.ctx.fillRect(px, stripY, 2, stripH);
    }
    // 条纹间距标注
    const fringe = Math.asin(Math.min(1, 1 / d));
    text(f, `相邻亮纹角间距 Δθ ≈ λ/d = ${((1 / d) * (180 / Math.PI)).toFixed(2)}°`, x0, stripY - 8, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      `d = ${d}λ、a = ${a}λ、λ = ${lam} nm（${lightColor ? '色标随波长变化' : ''}）：I = cos²(πd·sinθ/λ) · sinc²(πa·sinθ/λ)`,
      '双缝因子产生等间距条纹；单缝包络（虚线）限制边缘条纹强度 —— 缝越宽、包络越窄',
      'λ=400nm 紫光条纹最密、700nm 红光最疏：Δy = Lλ/d，条纹间距与波长成正比（可用此测光的波长）',
    ]);
    heading(f, '双缝干涉：强度分布与条纹');
  },
});
registerViz(doubleSlit);

/** P11 振动弦与驻波（复用渲染，此处为谐波叠加示意）。 */
