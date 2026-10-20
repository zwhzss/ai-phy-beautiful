import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, seg, text } from '../canvas';

/** P08 时间膨胀：洛伦兹因子与运动的钟。 */
const timeDilation = defineViz({
  slug: 'time-dilation',
  title: '时间膨胀与钟慢效应',
  animated: true,
  params: {
    beta: { type: 'range', min: 0, max: 0.999, default: 0.87, step: 0.001, label: '速度 v/c (β)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const beta = num(params, 'beta', 0.87);
    const gamma = 1 / Math.sqrt(1 - beta * beta);

    clear(f);
    // 左：γ(β) 曲线
    const half = w * 0.56;
    const x0 = 46, x1 = half - 20, y0 = h - 44, y1 = 44;
    const sx = (b: number) => x0 + b * (x1 - x0);
    const sy = (g: number) => y1 + (1 - Math.min(g, 10) / 10) * (y0 - y1);
    for (let i = 0; i <= 5; i++) {
      const gy = y1 + (i / 5) * (y0 - y1);
      seg(f, x0, gy, x1, gy, `${C.grid}88`, 1);
      seg(f, x0 + (i / 5) * (x1 - x0), y1, x0 + (i / 5) * (x1 - x0), y0, `${C.grid}88`, 1);
    }
    seg(f, x0, y0, x1, y0, C.grid, 1.4);
    seg(f, x0, y0, x0, y1, C.grid, 1.4);
    // γ 曲线（手工映射绘制）
    const pts: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const b = (i / 300) * 0.999;
      pts.push([sx(b), sy(1 / Math.sqrt(1 - b * b))]);
    }
    f.ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? f.ctx.moveTo(p[0], p[1]) : f.ctx.lineTo(p[0], p[1])));
    f.ctx.strokeStyle = C.accent;
    f.ctx.lineWidth = 2.4;
    f.ctx.stroke();
    // 当前点
    seg(f, sx(beta), y0, sx(beta), sy(gamma), `${C.warm}88`, 1.4);
    seg(f, x0, sy(gamma), sx(beta), sy(gamma), `${C.warm}88`, 1.4);
    dot(f, sx(beta), sy(gamma), 6, C.warm);
    text(f, `β=${beta}  γ=${gamma.toFixed(3)}`, sx(beta) + (beta > 0.7 ? -12 : 10), sy(gamma) - 12, { align: beta > 0.7 ? 'right' : 'left', color: C.warm, font: '13px sans-serif' });
    text(f, 'γ = 1/√(1−β²)', (x0 + x1) / 2 - 40, y1 + 16, { color: C.accent, font: '13px sans-serif' });
    text(f, 'β = v/c', x1 - 4, y0 + 20, { align: 'right', color: C.dim, font: '12px sans-serif' });
    text(f, 'γ', x0 - 26, y1 + 6, { color: C.dim, font: '12px sans-serif' });

    // 右：双钟对比（静止钟 vs 运动钟）
    const cx1 = x1 + (w - x1) * 0.32;
    const cx2 = x1 + (w - x1) * 0.74;
    const cy = h * 0.44;
    const R = Math.min(52, (w - x1) / 6);
    for (const [cx, moving, label, color] of [
      [cx1, false, '静止的钟', C.cool],
      [cx2, true, '运动的钟（1/γ 变慢）', C.warm],
    ] as [number, boolean, string, string][]) {
      // 钟面
      f.ctx.beginPath();
      f.ctx.arc(cx, cy, R, 0, Math.PI * 2);
      f.ctx.strokeStyle = color;
      f.ctx.lineWidth = 2;
      f.ctx.stroke();
      const speed = moving ? 1 / gamma : 1;
      const ang = f.t * Math.PI * 2 * speed - Math.PI / 2;
      seg(f, cx, cy, cx + R * 0.72 * Math.cos(ang), cy + R * 0.72 * Math.sin(ang), color, 2.4);
      dot(f, cx, cy, 3, color);
      text(f, label, cx, cy + R + 22, { align: 'center', color, font: '12px sans-serif' });
      if (moving) {
        text(f, `${gamma.toFixed(2)} 秒才走 1 格`, cx, cy + R + 40, { align: 'center', color: C.dim, font: '11px sans-serif' });
      }
    }

    footnotes(f, [
      `v = ${beta}c ≈ ${(beta * 299792458 / 1000).toFixed(0)} km/s ⇒ γ = ${gamma.toFixed(3)}：运动的钟每过 1 秒，静止的钟已过 ${gamma.toFixed(3)} 秒`,
      'μ子以 0.998c 穿过大气：γ ≈ 15，寿命延长 15 倍才使地表探测成为可能 —— 时间膨胀是实测效应',
      'GPS 卫星钟每天快 38 μs（狭义 +45、广义 −7 μs 混合），不修正定位一天漂移约 10 km',
    ]);
    heading(f, '时间膨胀：洛伦兹因子 γ(β)');
  },
});
registerViz(timeDilation);
