import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** P29 量子比特与布洛赫球（2D 正交投影 + 矢量动画）。 */
const blochSphere = defineViz({
  slug: 'bloch-sphere',
  title: '量子比特与布洛赫球',
  animated: true,
  params: {
    theta: { type: 'range', min: 0, max: 180, default: 60, step: 1, label: '极角 θ (°)' },
    phi: { type: 'range', min: 0, max: 360, default: 45, step: 1, label: '方位角 φ (°)' },
    spin: { type: 'select', options: ['自旋 1/2（标准布洛赫球）', '演示：φ 随时间进动'], default: '自旋 1/2（标准布洛赫球）', label: '模式' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const theta = (num(params, 'theta', 60) * Math.PI) / 180;
    const spin = str(params, 'spin', '自旋 1/2（标准布洛赫球）');
    const phi = ((num(params, 'phi', 45) * Math.PI) / 180) + (spin.startsWith('演示') ? f.t * 1.2 : 0);

    clear(f);
    const cx = w / 2, cy = h / 2 + 4;
    const R = Math.min(w * 0.3, h * 0.38);
    const ctx = f.ctx;

    // 球体外圆
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = `${C.accent}cc`;
    ctx.lineWidth = 2;
    ctx.stroke();
    // 赤道与经线（透视椭圆）
    ctx.beginPath();
    ctx.ellipse(cx, cy, R, R * 0.28, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `${C.accent}77`;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, R * 0.28, R, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `${C.accent}55`;
    ctx.stroke();

    // 极轴 |0> / |1>
    seg(f, cx, cy - R - 16, cx, cy + R + 16, `${C.dim}aa`, 1.2);
    text(f, '|0⟩', cx + 8, cy - R - 8, { color: C.cyan, font: '14px sans-serif' });
    text(f, '|1⟩', cx + 8, cy + R + 18, { color: C.warm, font: '14px sans-serif' });

    // Bloch 矢量（3D→2D 正交投影，z 轴竖直、φ 从 x 轴起）
    const sx = Math.sin(theta) * Math.cos(phi);
    const sy = Math.sin(theta) * Math.sin(phi);
    const sz = Math.cos(theta);
    const px = cx + R * sx * 0.94;
    const py = cy - R * sz * 0.94 + R * 0.26 * sy * 0.94; // φ 分量沿透视短轴
    seg(f, cx, cy, px, py, C.warm, 3);
    dot(f, px, py, 7, C.warm);
    // φ 角标
    text(f, `θ=${((theta * 180) / Math.PI).toFixed(0)}°  φ=${(((phi * 180) / Math.PI) % 360).toFixed(0)}°`, 24, 30, { color: C.warm, font: '13px sans-serif' });
    // 赤道投影参考点
    const ex = cx + R * Math.cos(phi) * 0.94;
    const ey = cy + R * Math.sin(phi) * 0.26 * 0.94;
    seg(f, cx, cy, ex, ey, `${C.dim}66`, 1);

    footnotes(f, [
      '任意单比特态 |ψ⟩ = cos(θ/2)|0⟩ + e^{iφ}sin(θ/2)|1⟩ —— 球面上唯一定点，整体相位不算自由度',
      'X/Y/Z 量子门 = 绕 Bloch 球三个轴旋转 90°；测量即投影到北极 |0⟩ 或南极 |1⟩',
      'n 比特需要 2ⁿ 维复矢量，但 Bloch 球只描述 1 比特——多体纠缠无法画出来，这正是量子计算的资源所在',
    ]);
    heading(f, '布洛赫球：单量子比特的几何');
  },
});
registerViz(blochSphere);

/** P30 贝尔不等式与量子关联（CHSH）。 */
const bellChsh = defineViz({
  slug: 'bell-chsh',
  title: '贝尔不等式与量子关联',
  params: {
    model: { type: 'select', options: ['量子力学预言', '经典隐变量（局域实在）'], default: '量子力学预言', label: '理论模型' },
    angle: { type: 'range', min: 0, max: 90, default: 22.5, step: 0.5, label: '测量基夹角 a (°)' },
  },
  draw: (f) => {
    const { params } = f;
    const model = str(params, 'model', '量子力学预言');
    const a = num(params, 'angle', 22.5);

    const v = view(f, { xMin: 0, xMax: 90, yMin: 0, yMax: 3.2, inset: 48 });
    grid(f, v, { divisions: 5, ticks: true });

    // CHSH 关联：量子 S(a,b=45°-a 形式)简化为 S = 2√2·|sin(2a)|（a 为基夹角参数化）
    const sQuantum = (x: number): number => 2 * Math.SQRT2 * Math.abs(Math.sin((2 * x * Math.PI) / 180));
    const ptsQ: [number, number][] = [];
    for (let i = 0; i <= 180; i++) {
      const x = (i / 180) * 90;
      ptsQ.push([v.sx(x), v.sy(sQuantum(x))]);
    }
    // 经典界限 S=2
    seg(f, v.sx(0), v.sy(2), v.sx(90), v.sy(2), `${C.hot}cc`, 2);
    text(f, '经典隐变量上限 S = 2', v.sx(90) - 6, v.sy(2) - 8, { align: 'right', color: C.hot, font: '12px sans-serif' });
    // 量子曲线
    const isQ = model.startsWith('量子');
    poly(f, ptsQ, { stroke: isQ ? C.accent : `${C.accent}55`, lw: isQ ? 2.8 : 1.6 });
    if (isQ) {
      seg(f, v.sx(0), v.sy(2 * Math.SQRT2), v.sx(90), v.sy(2 * Math.SQRT2), `${C.green}99`, 1.2);
      text(f, '量子上限 2√2 ≈ 2.83（Tsirelson 界）', v.sx(90) - 6, v.sy(2 * Math.SQRT2) - 8, { align: 'right', color: C.green, font: '12px sans-serif' });
    }
    // 当前角
    const sNow = isQ ? sQuantum(a) : 2;
    seg(f, v.sx(a), v.sy(0), v.sx(a), v.sy(sNow), `${C.warm}aa`, 1.4);
    dot(f, v.sx(a), v.sy(sNow), 6, C.warm);
    text(f, `S = ${sNow.toFixed(3)}`, v.sx(a) + 8, v.sy(sNow) - 8, { color: C.warm, font: '13px sans-serif' });
    text(f, '基夹角 a (°)', v.sx(v.xMax) - 4, v.sy(0) + 20, { align: 'right', color: C.dim, font: '12px sans-serif' });
    text(f, 'CHSH 值 S', v.sx(0) + 6, v.sy(3.1), { color: C.accent, font: '12px sans-serif' });

    footnotes(f, [
      `模型：${model}；a = ${a}° 时 S = ${sNow.toFixed(3)}（${sNow > 2 ? '超越经典界限 → 定域隐变量被排除' : '未超越经典界限'}）`,
      '贝尔 1964 年把爱因斯坦-玻尔之争变成可测量的不等式；阿斯佩 1982、蔡林格 2022 系列实验判定：自然违反贝尔不等式',
      '要点：关联强于任何"事先约定"能解释的程度——纠缠不是通信（不可超光速传信息），但确实非定域',
    ]);
    heading(f, '贝尔/CHSH：纠缠的实验裁判');
  },
});
registerViz(bellChsh);
