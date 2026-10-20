import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** 真空涨落。 */
const vacuumFluctuation = defineViz({
  slug: 'vacuum-fluctuation', title: '真空涨落', animated: true,
  params: {
    scale: { type: 'select', options: ['零点能海', '虚粒子对'], default: '虚粒子对', label: '视角' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const pairs = String((params as Record<string, unknown>)['scale'] ?? '').includes('虚粒');
    clear(f);
    if (!pairs) {
      // 零点能海（谐振模式起伏）
      const y0 = h - 90;
      for (let mode = 0; mode < 9; mode++) {
        const x = 70 + mode * ((w - 140) / 9);
        const amp = 18 + mode * 4;
        const pts: [number, number][] = [];
        for (let i = 0; i <= 40; i++) {
          const t = i / 40;
          pts.push([x - 22 + t * 44, y0 - 90 + mode * 10 - Math.sin(t * Math.PI * (mode + 1) + f.t * (2 + mode)) * amp * 0.4]);
        }
        poly(f, pts, { stroke: `rgba(66,153,225,${0.8 - mode * 0.07})`, lw: 2 });
      }
      text(f, '真空=所有场模的基态：每个模式仍以 ½ħω 振荡（零点能）', 30, 44, { color: C.cyan, font: '14px sans-serif' });
      text(f, '卡西米尔力、兰姆位移、霍金辐射——零点能的三张面孔', 30, 68, { color: C.warm, font: '13px sans-serif' });
    } else {
      // 虚粒子对（生灭闪现）
      const rand = (i: number): number => Math.abs(Math.sin(i * 91.7) * 43758.5) % 1;
      for (let k = 0; k < 9; k++) {
        const x = 80 + rand(k) * (w - 170);
        const y = 100 + rand(k + 9) * (h - 200);
        const life = ((f.t * 0.8 + rand(k + 3)) % 1);
        const alpha = life < 0.5 ? life * 2 : (1 - life) * 2;
        const sep = life * 34;
        dot(f, x - sep, y, 5, `rgba(66,153,225,${alpha * 0.9})`);
        dot(f, x + sep, y, 5, `rgba(237,137,54,${alpha * 0.9})`);
        if (life > 0.46 && life < 0.54) {
          f.ctx.beginPath(); f.ctx.arc(x, y, 16, 0, Math.PI * 2);
          f.ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.6})`;
          f.ctx.lineWidth = 1.4; f.ctx.stroke();
        }
      }
      text(f, '虚对不断生灭：ΔE·Δt ≲ ħ ——能量在普朗克时间内可以“借用”', 30, 44, { color: C.cyan, font: '14px sans-serif' });
      text(f, '视界附近落入者借负能（成为真实粒子）→ 霍金辐射', 30, 68, { color: C.warm, font: '13px sans-serif' });
    }

    footnotes(f, [
      '真空不是空无：量子场的基态永在涨落——电动力学的全部精密修正都源于它',
      '卡西米尔（1948）预言平行板间真空压差，1997 年精确验证——零点能的力学证据',
      '虚粒子是微扰展开的图像（费曼图内部线），可观测的是它们的累积效应',
    ]);
    heading(f, '真空涨落：空无中的沸腾');
  },
});
registerViz(vacuumFluctuation);

/** 重整化。 */
const renormalization = defineViz({
  slug: 'renormalization', title: '重整化', animated: true,
  params: {
    cutoff: { type: 'range', min: 1, max: 4, default: 2, step: 0.1, label: '截断 Λ（对数）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const lam = num(params, 'cutoff', 2);
    clear(f);
    const x0 = 64, y0 = h - 56, y1 = 70;
    const vv = view(f, { xMin: 0, xMax: 4, yMin: 0, yMax: 5, inset: 50 });
    grid(f, vv, { divisions: 4, ticks: true });
    // 发散的圈图积分（随 Λ 线性/对数增长）
    const pts: [number, number][] = [];
    for (let i = 1; i <= 200; i++) {
      const L = (i / 200) * 4;
      const val = Math.exp(L * 0.8) * 0.5;
      if (val <= 5) pts.push([vv.sx(L), vv.sy(val)]);
    }
    poly(f, pts, { stroke: C.hot, lw: 3 });
    // 重整化后（物理量与 Λ 无关）
    const ren: [number, number][] = [];
    for (let i = 1; i <= 200; i++) {
      const L = (i / 200) * 4;
      ren.push([vv.sx(L), vv.sy(1.4 + 0.15 * Math.sin(L * 3 + f.t * 0.5))]);
    }
    poly(f, ren, { stroke: C.green, lw: 2.8, dash: [7, 5] } as any);
    dot(f, vv.sx(lam), vv.sy(Math.min(Math.exp(lam * 0.8) * 0.5, 4.8)), 7, C.warm);
    text(f, '红=裸参数随截断发散；绿=测量输入后抵消（物理可观测量有限）', 30, 44, { color: C.cyan, font: '14px sans-serif' });
    text(f, "把无穷大吸进电荷/质量的重新定义——'无穷大被减掉了'", 30, 68, { color: C.warm, font: '12px sans-serif' } as any);
    void y1;

    footnotes(f, [
      '圈积分紫外发散 → 重整化把发散吸收进参数的重新定义，留下有限且可测的物理',
      "重整化群观点（Wilson）：跑动耦合 α(μ)——测量尺度改变则'耦合常数'随之改变",
      'QED 重整化后电子反常磁矩精确到 10⁻¹²——人类最精确的理论预言',
    ]);
    heading(f, '重整化：驯服无穷大的艺术');
  },
});
registerViz(renormalization);

/** 自发对称破缺。 */
const symmetryBreaking = defineViz({
  slug: 'symmetry-breaking', title: '自发对称破缺', animated: true,
  params: {
    kind: { type: 'select', options: ['墨西哥帽势', '铁磁/希格斯'], default: '墨西哥帽势', label: '演示' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const hat = String((params as Record<string, unknown>)['kind'] ?? '').includes('帽');
    clear(f);
    if (hat) {
      // 墨西哥帽势（剖面）
      const cx = w / 2, cy = h / 2 + 30;
      const R = Math.min(w, h) * 0.34;
      for (const s of [1, -1]) {
        const pts: [number, number][] = [];
        for (let i = 0; i <= 120; i++) {
          const r = -R + (i / 120) * 2 * R;
          const V = 0.14 * Math.pow(r / R, 4) - 0.5 * Math.pow(r / R, 2);
          pts.push([cx + r, cy - V * R * 0.9]);
        }
        poly(f, pts, { stroke: C.accent, lw: 3 });
        void s;
      }
      // 谷底圆
      const rMin = Math.sqrt(0.5 / (0.14 * 2)) * R * 0.5;
      const ring: [number, number][] = [];
      for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.07) {
        ring.push([cx + rMin * Math.cos(a) * 0.94, cy + 30 + Math.sin(a) * 22]);
      }
      poly(f, [...ring, ring[0]], { stroke: `${C.warm}99`, lw: 2, dash: [6, 4] } as any);
      // 小球在谷中滚动（破缺的真空选择）
      const a = f.t * 0.9;
      dot(f, cx + rMin * Math.cos(a) * 0.94, cy + 30 + Math.sin(a) * 22, 9, C.warm);
      // 帽顶的对称态（不稳定）
      dot(f, cx, cy, 7, `${C.dim}aa`);
      text(f, '原点=对称但不稳定（假真空）；谷底=稳定却不对称（选了一个方向）', 30, 44, { color: C.cyan, font: '14px sans-serif' });
      text(f, '势与解不同对称：Higgs 场取非零真空值 → 粒子获得质量', 30, 68, { color: C.warm, font: '13px sans-serif' });
    } else {
      // 自旋从无序到有序
      const order = 0.5 + 0.5 * Math.sin(f.t * 0.7);
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 12; col++) {
          const x = w * 0.5 - 220 + col * 40, y = h * 0.32 + row * 34;
          const rand = Math.abs(Math.sin(col * 17.3 + row * 31.7) * 43758.5) % 1;
          const ang = order * Math.PI / 2 + (rand - 0.5) * (1 - order) * Math.PI * 2;
          seg(f, x, y, x + Math.cos(ang) * 13, y + Math.sin(ang) * 13, `rgba(66,153,225,${0.5 + order * 0.5})`, 2.4);
          dot(f, x + Math.cos(ang) * 13, y + Math.sin(ang) * 13, 3.4, C.hot);
        }
      }
      text(f, `对称度 ${order.toFixed(2)}：高温无序（对称）→ 低温有序（对称自发破缺）`, 30, 44, { color: C.cyan, font: '14px sans-serif' });
      text(f, '海森堡铁磁模型与 Higgs 机制共用同一逻辑——凝聚态走进粒子物理', 30, 68, { color: C.warm, font: '13px sans-serif' });
    }

    footnotes(f, [
      "拉格朗日对称而基态不对称——'自发'破缺不破坏任何方程，只挑中了一个真空",
      '戈德斯通玻色子（相位方向的涨落）与希格斯机制（规范场吃掉它获得质量）',
      '朗道 1937 相变理论、1960s 弱电统一——对称破缺是现代物理的枢纽概念',
    ]);
    heading(f, '自发对称破缺：对称的方程，不对称的世界');
  },
});
registerViz(symmetryBreaking);

/** 规范场论。 */
const gaugeTheory = defineViz({
  slug: 'gauge-theory', title: '规范场论', animated: true,
  params: {
    group: { type: 'select', options: ['U(1) 电磁', 'SU(3) 强作用'], default: 'U(1) 电磁', label: '规范群' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const su3 = String((params as Record<string, unknown>)['group'] ?? '').includes('SU');
    clear(f);
    if (!su3) {
      // 相位变换与规范势
      const cx = w * 0.3, cy = h / 2 + 6;
      const R = Math.min(w, h) * 0.24;
      f.ctx.beginPath(); f.ctx.arc(cx, cy, R, 0, Math.PI * 2);
      f.ctx.strokeStyle = `${C.cool}aa`; f.ctx.lineWidth = 2.4; f.ctx.stroke();
      const a = f.t * 1.4;
      const px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R;
      seg(f, cx, cy, px, py, C.warm, 3);
      dot(f, px, py, 8, C.warm);
      text(f, '局域相位 e^(iθ(x))：每点可自由旋转', cx - 110, cy - R - 24, { color: C.cyan, font: '13px sans-serif' });
      // 规范势'联络'
      const pot: [number, number][] = [];
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const x = cx + R + 60 + t * (w * 0.42);
        pot.push([x, cy + Math.sin(t * Math.PI * 3 + f.t * 3) * 30]);
      }
      poly(f, pot, { stroke: C.cool, lw: 2.4 });
      text(f, 'A_μ（规范势）补偿局域变换——自由度=光子', cx + R + 60, cy - 60, { color: C.cool, font: '13px sans-serif' });
      text(f, '要求理论在局域相位下不变 → 必须引入规范场 → 光子', 30, h - 34, { color: C.cyan, font: '14px sans-serif' });
    } else {
      // 色 SU(3)（三色循环）
      const cx = w / 2, cy = h / 2 + 10;
      const colors = ['#e05252', '#52c452', '#5280e0'];
      const labels = ['r', 'g', 'b'];
      const R = Math.min(w, h) * 0.2;
      for (let k = 0; k < 3; k++) {
        const a0 = (k / 3) * Math.PI * 2 - Math.PI / 2;
        const a = a0 + f.t * 0.8;
        const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
        dot(f, x, y, 14, colors[k]);
        text(f, labels[k], x - 4, y + 5, { color: '#fff', font: '14px sans-serif' });
        // 胶子（八种色流转动）
        const a2 = a0 + f.t * 0.8 + Math.PI / 3;
        const gx = cx + Math.cos(a2) * R * 0.5, gy = cy + Math.sin(a2) * R * 0.5;
        dot(f, gx, gy, 7, C.warm);
        seg(f, x, y, gx, gy, `${C.warm}88`, 1.6);
      }
      text(f, 'SU(3)：8 种胶子带色荷、自相互作用——渐近自由的源头', 30, 44, { color: C.cyan, font: '14px sans-serif' });
      text(f, '规范原理 + 最小群 → 标准模型三大相互作用（SU(3)×SU(2)×U(1)）', 30, 68, { color: C.warm, font: '13px sans-serif' });
    }

    footnotes(f, [
      '规范原理：物理定律不应依赖局域相位/色的选法——自由度必须由规范场补偿',
      '杨-米尔斯（1954）非阿贝尔规范理论成为强弱作用的框架（2004 诺奖）',
      "相互作用不是外加的，是'保持对称'的代价——耦合常数由此被决定",
    ]);
    heading(f, '规范场论：对称性创造相互作用');
  },
});
registerViz(gaugeTheory);

/** 虚粒子与费曼图。 */
const virtualParticle = defineViz({
  slug: 'virtual-particle', title: '虚粒子与费曼图', animated: true,
  params: {
    process: { type: 'select', options: ['电子-电子散射', '电子自能修正'], default: '电子-电子散射', label: '过程' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const selfEnergy = String((params as Record<string, unknown>)['process'] ?? '').includes('自能');
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    if (!selfEnergy) {
      // Møller 散射（树图）
      const in1 = [w * 0.14, cy - 90], in2 = [w * 0.14, cy + 90];
      const out1 = [w * 0.86, cy - 90], out2 = [w * 0.86, cy + 90];
      const vtx1 = [cx - 46, cy - 40], vtx2 = [cx + 46, cy + 40];
      for (const [a, b, col] of [[in1, vtx1, C.cool], [in2, vtx2, C.cool], [vtx1, out1, C.cool], [vtx2, out2, C.cool]] as [number[], number[], string][]) {
        seg(f, a[0], a[1], b[0], b[1], col, 3);
      }
      // 光子传播子（波浪）
      const ph: [number, number][] = [];
      for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        ph.push([vtx1[0] + t * (vtx2[0] - vtx1[0]), vtx1[1] + t * (vtx2[1] - vtx1[1]) + Math.sin(t * Math.PI * 6 + f.t * 5) * 9]);
      }
      poly(f, ph, { stroke: C.warm, lw: 2.4 });
      text(f, 'γ（虚光子：内部线，不守恒质壳 p²≠0）', cx - 96, cy + 6, { color: C.warm, font: '12px sans-serif' });
      text(f, 'e⁻', w * 0.14 - 30, cy - 94, { color: C.cool, font: '13px sans-serif' });
      text(f, 'e⁻', w * 0.14 - 30, cy + 104, { color: C.cool, font: '13px sans-serif' });
      text(f, '树图=领头阶：截面 σ ∝ α²；圈图给下一位修正', 30, 44, { color: C.cyan, font: '14px sans-serif' });
    } else {
      // 自能圈（电子发射并吸收光子）
      const x0 = w * 0.24, x1 = w * 0.76;
      seg(f, w * 0.1, cy, x0, cy, C.cool, 3);
      seg(f, x0, cy, x1, cy, C.cool, 3);
      seg(f, x1, cy, w * 0.9, cy, C.cool, 3);
      const loop: [number, number][] = [];
      for (let i = 0; i <= 60; i++) {
        const a = -Math.PI * (i / 60);
        loop.push([cx + Math.cos(a) * 70, cy + Math.sin(a) * 70]);
      }
      poly(f, loop, { stroke: C.warm, lw: 2.4, dash: [6, 4] } as any);
      dot(f, cx - 70, cy, 6, C.cool);
      dot(f, cx + 70, cy, 6, C.cool);
      const ph2 = (f.t * 0.6) % 1;
      dot(f, cx + Math.cos(-Math.PI * ph2) * 70, cy + Math.sin(-Math.PI * ph2) * 70, 6, C.warm);
      text(f, '电子自能圈：发射又收回虚光子——发散需要重整化', 30, 44, { color: C.cyan, font: '14px sans-serif' });
      text(f, '修正了电子的“裸质量”与反常磁矩 g−2（α/2π 领头项）', 30, 68, { color: C.warm, font: '13px sans-serif' });
    }
    text(f, '费曼图=微扰展开的记账法：每条线一个传播子、每个点一个耦合', 30, h - 30, { color: C.green, font: '13px sans-serif' });

    footnotes(f, [
      '虚粒子是内部传播子：不满足质壳条件 p²=m²，寿命受 ΔE·Δt≈ħ 约束——计算工具而非粒子',
      '费曼图与费曼规则（1949）把天书级计算变成画图数线——QED 的普及革命',
      '每阶修正对应更复杂的图：α≈1/137 让级数快速收敛——微扰论的成功范本',
    ]);
    heading(f, '虚粒子：画在图上的中间态');
  },
});
registerViz(virtualParticle);
