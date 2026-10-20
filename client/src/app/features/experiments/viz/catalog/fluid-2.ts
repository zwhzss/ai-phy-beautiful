import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** 纳维-斯托克斯方程。 */
const navierStokes = defineViz({
  slug: 'navier-stokes', title: '纳维-斯托克斯方程', animated: true,
  params: {
    visc: { type: 'range', min: 0.01, max: 2, default: 0.3, step: 0.05, label: '运动黏度 ν（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const nu = num(params, 'visc', 0.3);
    clear(f);
    // 方程排版
    text(f, 'ρ(∂v/∂t + v·∇v) = −∇p + μ∇²v + f', 30, 46, { color: C.cyan, font: '17px serif' });
    text(f, '惯性项（非线性）= 压力梯度 + 黏性项 + 体积力', 30, 72, { color: C.dim, font: '12px sans-serif' });
    // 流场动画（速度剖面受 ν 控制）
    const y0 = h - 60, y1 = 110;
    seg(f, 60, y0, w - 60, y0, C.dim, 3);
    for (let k = 1; k <= 5; k++) {
      const yy = y0 - (k / 5) * (y0 - y1);
      const pts: [number, number][] = [];
      for (let i = 0; i <= 80; i++) {
        const x = 60 + (i / 80) * (w - 120);
        const phase = x * 0.02 - f.t * 2.4;
        // 黏度越高涡越平滑
        const amp = 22 * Math.exp(-nu * 1.6 * k * 0.4);
        pts.push([x, yy + Math.sin(phase + k) * amp + Math.sin(phase * 2.3 + k * 2) * amp * nu]);
      }
      poly(f, pts, { stroke: `rgba(66,153,225,${0.9 - k * 0.1})`, lw: 2.2 });
    }
    text(f, `ν=${nu.toFixed(2)}：${nu > 1 ? '黏性主导——流动平滑（蠕动流）' : nu < 0.15 ? '惯性主导——非线性涡旋串级（湍流倾向）' : '过渡区——层流涡开始失稳'}`,
      30, 96, { color: nu > 1 ? C.green : C.hot, font: '13px sans-serif' });

    footnotes(f, [
      'N-S 是牛顿第二定律的流体版：逐质量的动量守恒——非线性对流项是一切湍流之源',
      '千禧年难题之一：三维弱解的存在性与光滑性——存在性若断言失败即获奖',
      '从飞机翼型到血液循环，工程与生理的流动计算都从它出发（CFD 数值求解）',
    ]);
    heading(f, '纳维-斯托克斯：流动的总方程');
  },
});
registerViz(navierStokes);

/** 雷诺转捩。 */
const reynoldsTransition = defineViz({
  slug: 'reynolds-transition', title: '雷诺转捩', animated: true,
  params: {
    Re: { type: 'range', min: 200, max: 8000, default: 1200, step: 100, label: '雷诺数 Re×10' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const Re = num(params, 'Re', 1200) * 10;
    const turbulent = Re > 4000 ? 1 : Re > 2300 ? 0.5 : 0;
    clear(f);
    // 管流（左层流右湍流）
    const yMid = h / 2 + 6;
    seg(f, 40, yMid - 52, w - 40, yMid - 52, C.dim, 3);
    seg(f, 40, yMid + 52, w - 40, yMid + 52, C.dim, 3);
    // 层流段（抛物线剖面）
    for (let k = 1; k <= 4; k++) {
      const yy = yMid - 40 + (k - 1) * 26;
      const prof = 1 - Math.pow((yy - yMid) / 52, 2);
      const len = (w * 0.42) * prof;
      seg(f, 60, yy, 60 + len, yy, `rgba(66,153,225,${0.55 + prof * 0.4})`, 2);
    }
    text(f, '层流（有序）', 70, yMid - 74, { color: C.cool, font: '12px sans-serif' });
    // 转捩与湍流段（随机脉动）
    const transX = w * 0.5;
    const rand = (i: number, j: number): number => Math.abs(Math.sin(i * 12.9 + j * 78.2) * 43758.5) % 1;
    for (let k = 0; k < 26; k++) {
      const x = transX + k * ((w - transX - 60) / 26);
      const amp = Math.min((x - transX) / 70, 1);
      for (let j = 0; j < 5; j++) {
        const jitter = (rand(k, j) - 0.5) * 60 * amp * (0.6 + 0.4 * Math.sin(f.t * 4 + k));
        dot(f, x, yMid - 40 + j * 20 + jitter, 3.4, `rgba(237,137,54,${0.5 + amp * 0.4})`);
      }
    }
    text(f, '湍流（脉动+涡旋）', transX + 20, yMid - 74, { color: C.warm, font: '12px sans-serif' });
    text(f, `Re=${Re}：${turbulent === 0 ? '<2300 层流' : turbulent === 0.5 ? '2300~4000 转捩带（不稳定）' : '>4000 充分发展湍流'}`,
      30, 44, { color: turbulent === 1 ? C.hot : turbulent === 0.5 ? C.warm : C.green, font: '14px sans-serif' });

    footnotes(f, [
      '雷诺数=惯性力/黏性力：一个无量纲数决定流动的整个性格——相似性原理的基石',
      '1883 年雷诺染色线实验：层流到湍流的转捩可重复、可预报——实验流体力学经典',
      '转捩预测至今是开放难题（直接数值模拟 DNS 的算力瓶颈），飞机减阻就卡在这里',
    ]);
    heading(f, '雷诺转捩：一个数决定流动性格');
  },
});
registerViz(reynoldsTransition);

/** 湍流级串。 */
const kolmogorovCascade = defineViz({
  slug: 'kolmogorov-cascade', title: '柯尔莫哥洛夫级串', animated: true,
  params: {
    diss: { type: 'range', min: 0.3, max: 3, default: 1, step: 0.1, label: '耗散尺度（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const dk = num(params, 'diss', 1);
    clear(f);
    // 大涡 → 小涡（左到右分裂）
    const cy = h / 2 + 6;
    const sizes = [90, 52, 30, 17, 10];
    for (let lvl = 0; lvl < sizes.length; lvl++) {
      const x = 90 + lvl * ((w - 190) / (sizes.length - 1));
      const r = sizes[lvl] / dk * 0.9 + 4;
      const rot = f.t * (1.6 - lvl * 0.25) * (lvl % 2 ? -1 : 1);
      const pts: [number, number][] = [];
      for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.12) {
        const rr = r * (1 + 0.28 * Math.sin(a * 3 + rot * 2));
        pts.push([x + rr * Math.cos(a + rot), cy + rr * Math.sin(a + rot)]);
      }
      poly(f, [...pts, pts[0]], { stroke: `rgba(66,153,225,${0.9 - lvl * 0.13})`, lw: 2.2 });
      if (lvl < sizes.length - 1) {
        text(f, '→', x + r + 14, cy + 4, { color: C.dim, font: '16px sans-serif' });
      }
    }
    // 能谱斜率 -5/3（右下角小图）
    const x0 = w * 0.62, y0 = h - 56, y1 = h * 0.62;
    seg(f, x0, y0, w - 40, y0, C.grid, 1.2);
    seg(f, x0, y0, x0, y1, C.grid, 1.2);
    const spec: [number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      spec.push([x0 + t * (w - 40 - x0), y0 - Math.pow(1 - t, 1.66) * (y0 - y1) * (0.7 + 0.3 * Math.sin(f.t + t * 4))]);
    }
    poly(f, spec, { stroke: C.warm, lw: 2.4 });
    text(f, 'E(k) ∝ k^(−5/3)', x0 + 10, y1 - 8, { color: C.warm, font: '12px sans-serif' });
    text(f, '能量从大涡逐级传给小涡，直到黏性热耗散——惯性子区的普适谱', 30, 44, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '柯尔莫哥洛夫 1941：湍流是能量的瀑布——大尺度注入、小尺度烧掉，中间尺度自相似',
      '−5/3 谱在大气、海洋、等离子体中普适出现——湍流最坚实的统计定律',
      '间歇性修正（非高斯尾）与结构函数标度仍是活跃研究——K41 的现代补丁',
    ]);
    heading(f, '湍流级串：能量的瀑布');
  },
});
registerViz(kolmogorovCascade);

/** 斯托克斯阻力。 */
const stokesDrag = defineViz({
  slug: 'stokes-drag', title: '斯托克斯阻力',
  params: {
    r: { type: 'range', min: 1, max: 40, default: 8, step: 1, label: '球半径 (μm)' },
    mu: { type: 'range', min: 0.5, max: 5, default: 1, step: 0.1, label: '黏度 μ（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const r = num(params, 'r', 8), mu = num(params, 'mu', 1);
    const F = 6 * Math.PI * mu * r; // 含 v=1、归一
    const vterm = (r * r) / mu;
    clear(f);
    // 沉降球与速度剖面
    const cx = w * 0.3, cy = h / 2 + 6;
    const R = 10 + r * 1.6;
    f.ctx.beginPath(); f.ctx.arc(cx, cy, R, 0, Math.PI * 2);
    f.ctx.fillStyle = 'rgba(100,116,139,0.5)'; f.ctx.fill();
    f.ctx.strokeStyle = C.dim; f.ctx.lineWidth = 2; f.ctx.stroke();
    // 绕流线（前后不对称）
    for (let k = -2; k <= 2; k++) {
      if (k === 0) continue;
      const off = k * 34;
      const pts: [number, number][] = [];
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const x = 60 + t * (w - 120);
        const dx = x - cx;
        const deflect = off * Math.exp(-Math.abs(dx) / 70) * (Math.abs(off) / 34) * Math.sign(off);
        pts.push([x, cy + off + deflect * (dx > 0 ? 0.5 : -0.5)]);
      }
      poly(f, pts, { stroke: `${C.cool}66`, lw: 1.4 });
    }
    // 阻力箭头
    seg(f, cx, cy + R, cx, cy + R + 50, C.hot, 2.6);
    text(f, 'F=6πμrv', cx + 8, cy + R + 54, { color: C.hot, font: '12px sans-serif' });
    text(f, `F=${F.toFixed(1)}（相对）、收尾速度 v∝r²/μ ≈ ${vterm.toFixed(1)}`, 30, 44, { color: C.cyan, font: '14px sans-serif' });

    footnotes(f, [
      '低雷诺数下惯性可忽略：阻力严格线性于速度——微生物与气溶胶的运动法则',
      '收尾速度与半径平方成正比：雨滴不会砸伤人、雾滴悬浮不落的定量原因',
      '斯托克斯公式是微流控细胞分选、离心沉降分析的计算底稿（1851）',
    ]);
    heading(f, '斯托克斯阻力：黏性世界的沉降律');
  },
});
registerViz(stokesDrag);

/** 泰勒-库埃特流。 */
const taylorCouette = defineViz({
  slug: 'taylor-couette', title: '泰勒-库埃特流', animated: true,
  params: {
    omega: { type: 'range', min: 0.5, max: 6, default: 2, step: 0.1, label: '内筒角速度（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const om = num(params, 'omega', 2);
    const taylor = om > 2.4; // 失稳阈值示意
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    const R1 = Math.min(w, h) * 0.18, R2 = Math.min(w, h) * 0.34;
    // 同心双筒（俯视）
    f.ctx.beginPath(); f.ctx.arc(cx, cy, R2, 0, Math.PI * 2);
    f.ctx.strokeStyle = C.dim; f.ctx.lineWidth = 4; f.ctx.stroke();
    // 内筒旋转
    f.ctx.beginPath(); f.ctx.arc(cx, cy, R1, 0, Math.PI * 2);
    f.ctx.fillStyle = 'rgba(100,116,139,0.4)'; f.ctx.fill();
    f.ctx.strokeStyle = C.warm; f.ctx.lineWidth = 3; f.ctx.stroke();
    const rot = f.t * om;
    for (let k = 0; k < 4; k++) {
      const a = rot + (k * Math.PI) / 2;
      seg(f, cx, cy, cx + Math.cos(a) * R1, cy + Math.sin(a) * R1, C.warm, 2);
    }
    if (taylor) {
      // 泰勒涡环（失稳后的胞状结构）
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + rot * 0.3;
        const rm = (R1 + R2) / 2;
        const pts: [number, number][] = [];
        for (let t = 0; t <= Math.PI * 2 + 0.1; t += 0.15) {
          const rr = rm + 14 * Math.cos(t) * Math.sin(f.t * 3 + k);
          pts.push([cx + rr * Math.cos(a + t * 0.12), cy + rr * Math.sin(a + t * 0.12)]);
        }
        poly(f, pts, { stroke: `${C.cool}aa`, lw: 1.8 });
      }
      text(f, `Ω=${om.toFixed(1)} 超过临界：环状泰勒涡（1923）——流动失稳的第一级有序`, 30, 44, { color: C.cool, font: '13px sans-serif' });
    } else {
      text(f, `Ω=${om.toFixed(1)}：纯库埃特剪切流（层流）——内筒拖着流体一起转`, 30, 44, { color: C.green, font: '13px sans-serif' });
    }

    footnotes(f, [
      '同轴双筒间的流动随转速分岔：库埃特 → 泰勒涡 → 波涡 → 湍流——实验室里的分岔树',
      '泰勒 1923 年的精巧实验与理论预言完全一致——可视化流体失稳的里程碑',
      '离心机与行星齿轮润滑中的流动稳定性直接沿用这套分析',
    ]);
    heading(f, '泰勒-库埃特：失稳长出有序涡');
  },
});
registerViz(taylorCouette);

/** 毛细波与表面张力。 */
const capillaryWave = defineViz({
  slug: 'capillary-wave', title: '毛细波与表面张力', animated: true,
  params: {
    gamma: { type: 'range', min: 0.2, max: 2, default: 1, step: 0.1, label: '表面张力系数（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const g = num(params, 'gamma', 1);
    clear(f);
    // 液面与波纹
    const ySurf = h * 0.5;
    f.ctx.fillStyle = 'rgba(56,130,215,0.25)';
    f.ctx.fillRect(0, ySurf, w, h - ySurf);
    const wave: [number, number][] = [];
    for (let i = 0; i <= 200; i++) {
      const x = (i / 200) * w;
      const damp = Math.exp(-Math.abs(x - w / 2) / (w * 0.4));
      const y = ySurf + Math.sin(x * 0.05 - f.t * 3) * 10 * g * damp + Math.sin(x * 0.11 + f.t * 2) * 4;
      wave.push([x, y]);
    }
    poly(f, wave, { stroke: C.cool, lw: 3 });
    // 液滴（球形化）
    const dx = w * 0.74;
    f.ctx.beginPath();
    f.ctx.ellipse(dx, h * 0.3, 26 / Math.max(g, 0.6), 26 * Math.max(g, 0.6) * 0.9, 0, 0, Math.PI * 2);
    f.ctx.fillStyle = 'rgba(56,130,215,0.5)'; f.ctx.fill();
    f.ctx.strokeStyle = C.cool; f.ctx.lineWidth = 2; f.ctx.stroke();
    text(f, `γ=${g.toFixed(1)}：表面要面积最小 → 液滴趋球、液面抗拒扰动`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 毛细波色散：ω²=gk+γk³/ρ（重力-张力交叉）
    const x0 = 60, y0 = h - 56, y1 = h * 0.7;
    seg(f, x0, y0, w - 50, y0, C.grid, 1.2);
    const disp: [number, number][] = [];
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      disp.push([x0 + t * (w - 110), y0 - (t * t * 0.5 + Math.pow(t, 3) * 0.5 * g) * (y0 - y1)]);
    }
    poly(f, disp, { stroke: C.warm, lw: 2.2 });
    text(f, 'ω²=gk+γk³：短波靠张力撑、长波靠重力撑', x0 + 6, y1 - 6, { color: C.warm, font: '11px sans-serif' });

    footnotes(f, [
      '表面张力源自分子引力的不平衡——表面层像一张拉紧的弹性膜',
      '毛细波（波长<1cm）由张力主导色散：露珠颤动、昆虫水面行走都靠它',
      '毛细上升与润湿决定涂料铺展、植物导水与微流控液滴操控',
    ]);
    heading(f, '毛细波：表面张力撑起的短波');
  },
});
registerViz(capillaryWave);

/** 马兰戈尼效应。 */
const marangoni = defineViz({
  slug: 'marangoni', title: '马兰戈尼效应', animated: true,
  params: {
    dT: { type: 'range', min: 1, max: 20, default: 8, step: 1, label: '温差 ΔT (K)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const dT = num(params, 'dT', 8);
    clear(f);
    const y0 = h * 0.44;
    // 液面（左热右冷）：表面张力梯度驱动流动
    f.ctx.fillStyle = 'rgba(56,130,215,0.25)';
    f.ctx.fillRect(0, y0, w, h - y0);
    // 热源
    poly(f, [[60, y0 + 40], [110, y0 + 40], [110, y0 + 70], [60, y0 + 70]], { stroke: C.hot, lw: 2, fill: 'rgba(237,87,54,0.55)' } as any);
    text(f, '热', 76, y0 + 62, { color: '#fff', font: '12px sans-serif' });
    // 表面流（热处 γ 低 → 流向冷处）
    const prog = (f.t * 0.8) % 1;
    for (let k = 0; k < 6; k++) {
      const t = ((prog + k / 6) % 1);
      const x = 80 + t * (w - 170);
      const surfY = y0 + 8 + Math.sin(t * Math.PI * 3 + f.t * 4) * 4;
      dot(f, x, surfY, 4.6, `rgba(255,${200 - t * 80},120,0.9)`);
    }
    // 回流环
    const ring: [number, number][] = [];
    for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.12) {
      ring.push([w * 0.5 + Math.cos(a + f.t) * (w * 0.3), y0 + 60 + Math.sin(a + f.t) * 46]);
    }
    poly(f, ring, { stroke: `${C.cool}77`, lw: 1.6, dash: [6, 4] } as any);
    text(f, `ΔT=${dT}K：γ(T) 梯度驱动表面从热端流向冷端（与 Marangoni 数成正比）`, 30, 44, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '表面张力随温度升高而降低：表面被从热处拽向冷处——温差即马兰戈尼流',
      "葡萄酒'挂杯“泪”是溶质梯度版的马兰戈尼效应（马拉戈尼 1865）",
      '焊接虚焊、晶体生长条纹、微重力沸腾都受它支配——材料工艺的隐形手',
    ]);
    heading(f, '马兰戈尼：表面张力梯度驱动流动');
  },
});
registerViz(marangoni);

/** 液滴与表面张力测量。 */
const dropletSurfaceTension = defineViz({
  slug: 'droplet-surface-tension', title: '液滴与表面张力', animated: true,
  params: {
    kind: { type: 'select', options: ['挂滴法（Young-Laplace 拟合）', '毛细上升'], default: '挂滴法（Young-Laplace 拟合）', label: '测量法' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const capillary = String((params as Record<string, unknown>)['kind'] ?? '').includes('毛细');
    clear(f);
    if (capillary) {
      // 毛细上升
      const cx = w * 0.4, yBase = h * 0.68;
      const R = 16, rise = 70;
      // 水槽
      poly(f, [[cx - 130, yBase], [cx + 130, yBase], [cx + 130, yBase + 60], [cx - 130, yBase + 60]],
        { stroke: C.dim, lw: 2, fill: 'rgba(56,130,215,0.2)' } as any);
      // 毛细管与上升液柱（脉动）
      const bob = Math.sin(f.t * 2) * 3;
      poly(f, [[cx - R, yBase - rise - 80], [cx + R, yBase - rise - 80], [cx + R, yBase + 40], [cx - R, yBase + 40]],
        { stroke: C.dim, lw: 2, fill: 'rgba(148,163,184,0.10)' } as any);
      f.ctx.fillStyle = 'rgba(56,130,215,0.55)';
      f.ctx.fillRect(cx - R + 3, yBase - rise + bob, 2 * R - 6, rise + 40);
      // 弯月面
      f.ctx.beginPath();
      f.ctx.ellipse(cx, yBase - rise + bob, R - 3, 12, 0, Math.PI, 0);
      f.ctx.strokeStyle = C.cool; f.ctx.lineWidth = 2.4; f.ctx.stroke();
      // 高度标注
      seg(f, cx + R + 24, yBase, cx + R + 24, yBase - rise + bob, C.hot, 2);
      text(f, `h=2γcosθ/(ρgr)：测 h 即得 γ`, cx + R + 34, yBase - rise / 2, { color: C.hot, font: '12px sans-serif' });
      text(f, '玻璃管中水上升、水银下降——润湿性由接触角 θ 定', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    } else {
      // 挂滴（Young-Laplace）
      const cx = w * 0.42, cy = h * 0.4;
      const wob = 1 + 0.06 * Math.sin(f.t * 2.4);
      const Rp = 44 * wob, Rv = 38 / wob;
      f.ctx.beginPath();
      f.ctx.moveTo(cx - Rp, cy - 80);
      f.ctx.quadraticCurveTo(cx - Rp * 1.2, cy + 30, cx, cy + 96);
      f.ctx.quadraticCurveTo(cx + Rp * 1.2, cy + 30, cx + Rp, cy - 80);
      f.ctx.closePath();
      f.ctx.fillStyle = 'rgba(56,130,215,0.4)'; f.ctx.fill();
      f.ctx.strokeStyle = C.cool; f.ctx.lineWidth = 2.4; f.ctx.stroke();
      // 悬挂丝
      seg(f, cx, cy - 140, cx, cy - 78, C.dim, 3);
      // Δp 标注
      text(f, 'Δp = γ(1/R₁ + 1/R₂)', cx + 70, cy - 10, { color: C.hot, font: '14px sans-serif' });
      text(f, '压差与两个主曲率半径成正比——轮廓反演即得 γ（精度 0.1mN/m）', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    }

    footnotes(f, [
      'Young-Laplace 方程把压差与曲率连接——毛细现象的统一描述（1805）',
      '水 γ≈72mN/m、肥皂水≈25：表面活性剂把水的皮肤变松——洗涤与起泡的机理',
      '微重力下液滴成完美球形——国际空间站的燃烧与胶体实验借它校准',
    ]);
    heading(f, '表面张力测量：读液面的几何');
  },
});
registerViz(dropletSurfaceTension);
