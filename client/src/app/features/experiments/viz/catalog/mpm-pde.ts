import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text, view, grid, curve, circle, vec, rng } from '../canvas';

/** P546 泊松方程与格林函数。 */
const poissonGreenFunction = defineViz({
  slug: 'poisson-green-function',
  title: '泊松方程与格林函数',
  params: { sources: { type: 'range', min: 1, max: 5, default: 3, step: 1, label: '点源个数' } },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'sources', 3));
    clear(f);
    // 势场色块（点源叠加）
    const cell = 22;
    const cols = Math.floor((w * 0.52 - 40) / cell);
    const rows = Math.floor((h - 150) / cell);
    const ox = 40, oy = 76;
    const rand = rng(11);
    const src: Array<[number, number, number]> = [];
    for (let i = 0; i < n; i++) src.push([rand(), rand(), i % 2 === 0 ? 1 : -1]);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) / cols, y = (r + 0.5) / rows;
        let phi = 0;
        for (const [sx, sy, q] of src) {
          const d = Math.hypot(x - sx, y - sy) + 0.035;
          phi += q / d;
        }
        const k = Math.max(-1, Math.min(1, phi * 0.16));
        const { ctx } = f;
        ctx.fillStyle = k > 0 ? `rgba(245,101,101,${Math.abs(k) * 0.8})` : `rgba(66,153,225,${Math.abs(k) * 0.8})`;
        ctx.fillRect(ox + c * cell, oy + r * cell, cell - 1.5, cell - 1.5);
      }
    }
    // 画源点
    for (const [sx, sy, q] of src) {
      const px = ox + sx * cols * cell, py = oy + sy * rows * cell;
      circle(f, px, py, 9, { fill: q > 0 ? C.hot : C.cool, stroke: C.fg, lw: 1.6 });
      text(f, q > 0 ? '+' : '−', px, py + 5, { align: 'center', color: C.fg, font: '14px serif' });
    }
    text(f, '红=正势　蓝=负势（点源线性叠加）', ox, oy - 14, { color: C.fg, font: '13px sans-serif' });
    // 右侧：公式
    const bx = w * 0.56;
    text(f, '∇²φ = −ρ/ε₀', bx, 100, { color: C.yellow, font: '19px serif' });
    text(f, '线性 ⇒ 解可叠加：', bx, 146, { color: C.fg, font: '15px sans-serif' });
    text(f, 'φ(r) = ∫ G(r,r\')ρ(r\')d³r\'', bx, 182, { color: C.cool, font: '17px serif' });
    text(f, '格林函数 G = 对点源的响应', bx, 226, { color: C.green, font: '15px sans-serif' });
    text(f, '∇²G = −δ³(r−r\')', bx, 258, { color: C.green, font: '15px serif' });
    text(f, '无限空间：G = 1/(4π|r−r\'|)', bx, 302, { color: C.dim, font: '15px serif' });
    text(f, '有边界：G = G_∞ + G_h（修正项满足齐次边界）', bx, 346, { color: C.warm, font: '14px sans-serif' });
    text(f, '点源一旦会解，任意源只是加权平均', bx, h - 130, { color: C.yellow, font: '15px sans-serif' });
    text(f, '这就是线性方程的全部战略：化归为基本解', bx, h - 100, { color: C.fg, font: '14px sans-serif' });
    footnotes(f, [
      '泊松方程是拉氏方程带源的推广：静电、引力势、稳态温度场统一于此',
      '格林函数的对称性 G(r,r\') = G(r\',r)：互易定理（天线收发对等的数学根）',
      '库仑势 1/r 是三维点源的格林函数 —— 整个静电学从这一个函数长出来',
    ]);
    heading(f, '知道了点源就知道了全部');
  },
});
registerViz(poissonGreenFunction);

/** P547 格林函数的镜像法构造。 */
const greenMirrorImage = defineViz({
  slug: 'green-mirror-image',
  title: '格林函数的镜像法构造',
  params: { plane: { type: 'select', options: ['接地导体平面', '球面导体'], default: '接地导体平面', label: '边界' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = str(params, 'plane', '接地导体平面');
    clear(f);
    const cx = w * 0.44;
    if (mode === '接地导体平面') {
      // 导体平面（y=0）
      const gy = h * 0.56;
      poly(f, [[60, gy], [w - 60, gy], [w - 60, gy + 34], [60, gy + 34]], { fill: 'rgba(58,74,99,0.9)', stroke: C.grid, lw: 2 });
      for (let gx = 80; gx < w - 60; gx += 34) {
        seg(f, gx, gy + 34, gx - 10, gy + 46, C.dim, 1.4);
      }
      text(f, '接地导体（φ=0）', 76, gy + 24, { color: C.fg, font: '14px serif' });
      // 真电荷与镜像电荷
      const qx = w * 0.4, qy = gy - 170;
      circle(f, qx, qy, 15, { fill: C.hot, stroke: C.hot, lw: 2 });
      text(f, '+q', qx + 22, qy + 5, { color: C.hot, font: '16px serif' });
      const my = gy + 170;
      circle(f, qx, my, 15, { stroke: C.cool, lw: 2.4, fill: 'rgba(66,153,225,0.3)' });
      text(f, '−q（镜像）', qx + 24, my + 5, { color: C.cool, font: '16px serif' });
      // 连线与中垂
      seg(f, qx, qy, qx, my, `${C.dim}aa`, 1.4, );
      dot(f, qx, gy, 6, C.yellow);
      // 场线示意（从 +q 到平面）
      for (let k = -3; k <= 3; k++) {
        const pts: Array<[number, number]> = [];
        for (let i = 0; i <= 40; i++) {
          const t = i / 40;
          const x = qx + k * 46 * t * 1.2;
          const y = qy + (gy - qy) * t + Math.sin(t * Math.PI) * k * 16;
          pts.push([x, y]);
        }
        poly(f, pts, { stroke: `rgba(66,153,225,0.45)`, lw: 1.6 });
      }
      text(f, '上半空间的场线 = 真电荷与镜像电荷共同产生', 60, h - 148, { color: C.fg, font: '15px sans-serif' });
      text(f, '镜像电荷放在边界另一侧 ⇒ 平面上每点 φ = q/r + (−q)/r = 0 ✓', 60, h - 118, { color: C.green, font: '15px serif' });
      text(f, '边界条件自动满足 ⇒ 上半空间的格林函数就造出来了', 60, h - 88, { color: C.yellow, font: '15px serif' });
      footnotes(f, [
        '镜像法的本质：用边界外的假电荷替代边界上的感应电荷分布',
        '导体受力 = 真电荷与镜像电荷的库仑力（F = q²/16πε₀d²）—— 直接可算',
        '限制：镜像位置必须在求解区域之外，否则改变原问题',
      ]);
    } else {
      // 球面导体镜像
      circle(f, cx, h * 0.44, 110, { fill: 'rgba(58,74,99,0.85)', stroke: C.grid, lw: 2.6 });
      text(f, '接地导体球', cx, h * 0.44 - 116, { align: 'center', color: C.fg, font: '14px serif' });
      const a = 110;
      const d = 250;
      const qx = cx - d, qy = h * 0.44;
      circle(f, qx, qy, 14, { fill: C.hot, stroke: C.hot, lw: 2 });
      text(f, '+q', qx - 34, qy + 5, { color: C.hot, font: '16px serif' });
      // 镜像位置 a²/d，电荷 −qa/d
      const dd = (a * a) / d;
      const mi = cx - dd;
      circle(f, mi, qy, 10, { stroke: C.cool, lw: 2.4, fill: 'rgba(66,153,225,0.35)' });
      text(f, `q\' = −qa/d`, mi - 10, qy + 36, { align: 'center', color: C.cool, font: '14px serif' });
      seg(f, cx - d - 26, qy, cx + a + 26, qy, `${C.dim}aa`, 1.4);
      // 场线
      for (let k = -2; k <= 2; k++) {
        vec(f, qx + 18, qy + k * 40, cx - Math.sqrt(Math.max(0, a * a - (k * 40) ** 2)) + 6, qy + k * 40, `rgba(66,153,225,0.5)`, 1.8, 7);
      }
      text(f, '镜像在球内（求解区外）：q\' 位置 a²/d、电量 −qa/d', 60, h - 148, { color: C.fg, font: '15px sans-serif' });
      text(f, '点电荷旁接地球的电容、粒子探测器镜像、微带线边缘场都用它', 60, h - 118, { color: C.green, font: '15px serif' });
      text(f, '推广：反演法把球面问题化归平面问题（几何的又一次复用）', 60, h - 88, { color: C.yellow, font: '15px serif' });
      footnotes(f, [
        '球面镜像的两个条件：球面等势 + 总电量配合 ⇒ 定出 q\' 与位置',
        '球外一点的势 = 真电荷 + 镜像电荷，球面恰为零势面',
        '功与力：把电荷从无穷远移到 d 处外力做功 = q\' 的势 × q',
      ]);
    }
    heading(f, '镜像电荷让边界条件自动满足');
  },
});
registerViz(greenMirrorImage);

/** P548 亥姆霍兹方程与本征模。 */
const helmholtzModes = defineViz({
  slug: 'helmholtz-modes',
  title: '亥姆霍兹方程与本征模',
  params: { cavity: { type: 'select', options: ['矩形腔', '圆柱腔'], default: '矩形腔', label: '腔体' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = str(params, 'cavity', '矩形腔');
    clear(f);
    const bx = 60, by = 90, bw = w * 0.44, bh = h * 0.5;
    poly(f, [[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]], { stroke: C.grid, lw: 3 });
    if (mode === '矩形腔') {
      // 驻波模式 sin(mπx/a)sin(nπy/b)
      const m = 2, n = 3;
      const cell = 14;
      for (let c = 0; c * cell < bw; c++) {
        for (let r = 0; r * cell < bh; r++) {
          const x = (c + 0.5) * cell, y = (r + 0.5) * cell;
          const val = Math.sin((m * Math.PI * x) / bw) * Math.sin((n * Math.PI * y) / bh) * Math.cos(f.t * 2.4);
          const { ctx } = f;
          ctx.fillStyle = val >= 0 ? `rgba(66,153,225,${0.15 + Math.abs(val) * 0.7})` : `rgba(245,101,101,${0.15 + Math.abs(val) * 0.7})`;
          ctx.fillRect(bx + c * cell, by + r * cell, cell - 1, cell - 1);
        }
      }
      text(f, `TE_${m}${n} 模：sin(${m}πx/a)·sin(${n}πy/b)`, bx, by - 16, { color: C.fg, font: '15px serif' });
      text(f, `k_{mn} = π√((m/a)² + (n/b)²) ⇒ f = ck/2π`, bx, by + bh + 32, { color: C.yellow, font: '15px serif' });
      text(f, '蓝=波腹　红=波节反相　边界必须为零（壁条件）', bx, by + bh + 62, { color: C.dim, font: '13px sans-serif' });
    } else {
      // 圆柱腔：贝塞尔模式
      const cx = bx + bw / 2, cy = by + bh / 2;
      circle(f, cx, cy, Math.min(bw, bh) / 2 - 6, { stroke: C.grid, lw: 3 });
      const cell = 14;
      const R = Math.min(bw, bh) / 2 - 8;
      for (let c = -Math.ceil(R / cell); c <= Math.ceil(R / cell); c++) {
        for (let r = -Math.ceil(R / cell); r <= Math.ceil(R / cell); r++) {
          const x = c * cell, y = r * cell;
          const rad = Math.hypot(x, y);
          if (rad > R - 2) continue;
          const val = Math.cos(2 * Math.atan2(y, x)) * Math.cos(f.t * 2.4);
          const { ctx } = f;
          ctx.fillStyle = val >= 0 ? `rgba(72,187,120,${0.2 + Math.abs(val) * 0.65})` : `rgba(237,137,54,${0.2 + Math.abs(val) * 0.65})`;
          ctx.fillRect(cx + x, cy + y, cell - 1, cell - 1);
        }
      }
      text(f, 'TE_{11} 模（圆腔最低阶）', bx, by - 16, { color: C.fg, font: '15px serif' });
      text(f, 'k = j\'_{mn}/R：零点来自贝塞尔函数', bx, by + bh + 32, { color: C.yellow, font: '15px serif' });
      text(f, '微波炉 2.45GHz 对应的腔模数以百万计', bx, by + bh + 62, { color: C.dim, font: '13px sans-serif' });
    }
    // 右：模式密度与频率
    const rx = w * 0.56;
    text(f, '本征模 = (∇²+k²)ψ = 0 + 边界条件', rx, 100, { color: C.fg, font: '16px serif' });
    text(f, '每个 k 值对应一个共振频率', rx, 140, { color: C.cool, font: '15px sans-serif' });
    text(f, '分立谱（封闭腔）→ 连续谱（开放系统）', rx, 180, { color: C.green, font: '15px sans-serif' });
    // 频谱梳
    const sy0 = 260;
    seg(f, rx, sy0, w - 50, sy0, C.grid, 1.6);
    const rand = rng(5);
    for (let i = 0; i < 26; i++) {
      const x = rx + 6 + i * ((w - 110 - rx) / 26) + rand() * 3;
      const amp = 20 + rand() * 44;
      seg(f, x, sy0, x, sy0 - amp, `rgba(236,201,75,${0.4 + rand() * 0.6})`, 2.2);
    }
    text(f, '腔的频谱：每条谱线=一个本征模', rx, sy0 + 26, { color: C.yellow, font: '14px sans-serif' });
    text(f, '模式密度 ∝ ω²（瑞利-金斯公式 → 黑体辐射紫外灾难的来源）', rx, sy0 + 56, { color: C.hot, font: '14px sans-serif' });
    text(f, '声学厅堂、激光谐振腔、口袋型量子点：同一套模分析', rx, sy0 + 92, { color: C.fg, font: '14px sans-serif' });
    footnotes(f, [
      '亥姆霍兹方程 (∇²+k²)ψ=0：波动按频率分解的驻波版本',
      '分离变量给出分立 k 谱：边界几何决定频率表（本征值问题）',
      '开放腔的 k 变复数：实部=频率、虚部=损耗 ⇒ 腔 Q 值的出处',
    ]);
    heading(f, '腔体、波导、口袋的共振频率全从这里算');
  },
});
registerViz(helmholtzModes);

/** P549 热核与基本解。 */
const heatKernelSolution = defineViz({
  slug: 'heat-kernel-solution',
  title: '热核与基本解',
  params: { dim: { type: 'select', options: ['1D 线', '2D 面', '3D 体'], default: '1D 线', label: '维度' } },
  draw: (f) => {
    const { w, h, params } = f;
    const dim = str(params, 'dim', '1D 线');
    clear(f);
    const v = view(f, { xMin: -4, xMax: 4, yMin: 0, yMax: 1.4, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 不同时刻的高斯热核
    const times = [0.15, 0.5, 1.4, 3.2];
    const colors = [C.hot, C.warm, C.yellow, C.cool];
    const tAnim = ((f.t * 0.35) % 1);
    times.forEach((t0, i) => {
      const t = t0 + tAnim * 0.3;
      const pts: Array<[number, number]> = [];
      const norm = dim === '1D 线' ? 1 / Math.sqrt(4 * Math.PI * t) : dim === '2D 面' ? 1 / (4 * Math.PI * t) : 1 / Math.pow(4 * Math.PI * t, 1.5);
      for (let i2 = 0; i2 <= 300; i2++) {
        const x = -4 + (i2 / 300) * 8;
        const val = norm * Math.exp(-(x * x) / (4 * t)) * (dim === '1D 线' ? 1 : dim === '2D 面' ? 1.6 : 2.2);
        if (val > 1.45) continue;
        pts.push([v.sx(x), v.sy(val)]);
      }
      poly(f, pts, { stroke: colors[i], lw: 2.4 });
      text(f, `t=${t.toFixed(2)}`, v.sx(3.1), v.sy(Math.min(1.32, (dim === '1D 线' ? 1 : dim === '2D 面' ? 1.6 : 2.2) / Math.sqrt(4 * Math.PI * t) * Math.exp(-9 / (4 * t)) + 0.06 + i * 0.05)),
        { color: colors[i], font: '12px serif' });
    });
    text(f, `K(x,t) = ${dim === '1D 线' ? '(4παt)^(−1/2) e^(−x²/4αt)' : dim === '2D 面' ? '(4παt)^(−1) e^(−r²/4αt)' : '(4παt)^(−3/2) e^(−r²/4αt)'}`,
      v.sx(-3.9), v.sy(1.35), { color: C.fg, font: '15px serif' });
    text(f, '峰随时间变矮变宽 —— 热量扩散，面积（概率）守恒', v.sx(-3.9), v.sy(1.22), { color: C.yellow, font: '14px serif' });
    text(f, 'x', (v.sx(-4) + v.sx(4)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    // 底部：应用
    text(f, '通解 = 初始分布与热核的卷积：u(x,t) = ∫K(x−x\',t)u(x\',0)dx\'', 56, h - 136, { color: C.fg, font: '16px serif' });
    text(f, '路径积分的传播子就是自由粒子热核 —— 统计力学与量子力学在此会合', 56, h - 106, { color: C.pink, font: '15px sans-serif' });
    text(f, '量子场论：Tr e^{−βH} = ∫⟨x|e^{−βH}|x⟩dx：配分函数=虚时间上的热核', 56, h - 76, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '热核 K(x,t)：t=0 时是 δ 函数 —— 点热源的响应即基本解',
      '高斯扩散的方差 ∝ t：布朗运动均方位移 ⟨x²⟩=2Dt 的母体',
      '热核展开系数含曲率不变量（Seeley-DeWitt）—— 黑洞熵计算的数学工具',
    ]);
    heading(f, '瞬时点热源的高斯扩散核');
  },
});
registerViz(heatKernelSolution);

/** P550 波动方程的达朗贝尔解。 */
const waveDalembertSolution = defineViz({
  slug: 'wave-dalembert-solution',
  title: '波动方程的达朗贝尔解',
  params: { shape: { type: 'select', options: ['高斯脉冲', '方形脉冲', '正弦段'], default: '高斯脉冲', label: '初始波形' } },
  draw: (f) => {
    const { w, h, params } = f;
    const shape = str(params, 'shape', '高斯脉冲');
    clear(f);
    // 上下两条行波
    const v = view(f, { xMin: -6, xMax: 6, yMin: -1.5, yMax: 1.5, inset: 46, insetBottom: 46 });
    grid(f, v);
    const t = ((f.t * 0.55) % 2) * 6;
    const wave = (x: number, x0: number, sign: number): number => {
      const u = x - sign * x0;
      if (shape === '高斯脉冲') return Math.exp(-u * u * 0.8);
      if (shape === '方形脉冲') return Math.abs(u) < 1.1 ? 1 : 0;
      return Math.abs(u) < 1.6 ? Math.sin((u * Math.PI) / 1.6) : 0;
    };
    // f(x−ct) 向右
    const p1: Array<[number, number]> = [];
    for (let i = 0; i <= 400; i++) {
      const x = -6 + (i / 400) * 12;
      p1.push([v.sx(x), v.sy(0.75 + wave(x, t - 6, 1) * 0.6 - 0.0)]);
    }
    poly(f, p1, { stroke: C.cool, lw: 2.6 });
    text(f, 'f(x − ct)：向右行进', v.sx(-5.8), v.sy(1.42), { color: C.cool, font: '14px serif' });
    // g(x+ct) 向左
    const p2: Array<[number, number]> = [];
    for (let i = 0; i <= 400; i++) {
      const x = -6 + (i / 400) * 12;
      p2.push([v.sx(x), v.sy(-0.75 + wave(x, 6 - t, -1) * 0.6 - 0.0)]);
    }
    poly(f, p2, { stroke: C.warm, lw: 2.6 });
    text(f, 'g(x + ct)：向左行进', v.sx(-5.8), v.sy(-0.16), { color: C.warm, font: '14px serif' });
    // 叠加结果
    const p3: Array<[number, number]> = [];
    for (let i = 0; i <= 400; i++) {
      const x = -6 + (i / 400) * 12;
      p3.push([v.sx(x), v.sy(0 + wave(x, t - 6, 1) * 0.5 + wave(x, 6 - t, -1) * 0.5 - 0.42)]);
    }
    poly(f, p3, { stroke: C.green, lw: 2.6, dash: [8, 5] });
    text(f, 'u = f + g：叠加结果（形状可能改变也可能保持）', v.sx(-5.8), v.sy(-1.4), { color: C.green, font: '14px serif' });
    text(f, 'x', (v.sx(-6) + v.sx(6)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      '达朗贝尔 (1747)：一维波动通解只有两项 —— 两个方向的行波各走各的',
      '特征线 x±ct=常数：沿它们偏导为常数 —— 双曲方程的几何本质',
      '弦的初值问题：f、g 由初始位移与速度定出（d\'Alembert 公式）',
    ]);
    heading(f, '一维波动的通解只有两项');
  },
});
registerViz(waveDalembertSolution);

/** P551 拉普拉斯方程的唯一性。 */
const laplaceUniqueness = defineViz({
  slug: 'laplace-uniqueness',
  title: '拉普拉斯方程的唯一性',
  params: { boundary: { type: 'select', options: ['固定边界', '周期边界', '混合边界'], default: '固定边界', label: '边界条件' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = str(params, 'boundary', '固定边界');
    clear(f);
    // 方腔内的调和场（色块 + 等势线示意）
    const bx = 60, by = 90, bw = w * 0.46, bh = h * 0.52;
    const cell = 20;
    const cols = Math.floor(bw / cell), rows = Math.floor(bh / cell);
    // 边界值设定
    const bnd = (c: number, r: number): number => {
      if (mode === '固定边界') {
        if (r === 0) return 1;
        if (r === rows - 1) return -1;
        if (c === 0) return 0.5;
        if (c === cols - 1) return -0.5;
        return NaN;
      }
      if (mode === '周期边界') {
        if (r === 0) return Math.sin((c / cols) * Math.PI * 2);
        if (r === rows - 1) return -Math.sin((c / cols) * Math.PI * 2);
        if (c === 0 || c === cols - 1) return 0;
        return NaN;
      }
      if (r === 0 || c === 0) return 1;
      if (r === rows - 1 || c === cols - 1) return 0;
      return NaN;
    };
    // 迭代松弛（取几帧积累效果）
    let grid2: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const b = bnd(c, r);
        if (!Number.isNaN(b)) grid2[r][c] = b;
      }
    }
    for (let iter = 0; iter < 60; iter++) {
      const next = grid2.map((row) => row.slice());
      for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
          if (!Number.isNaN(bnd(c, r))) continue;
          next[r][c] = 0.25 * (grid2[r - 1][c] + grid2[r + 1][c] + grid2[r][c - 1] + grid2[r][c + 1]);
        }
      }
      grid2 = next;
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = grid2[r][c];
        const k = Math.max(-1, Math.min(1, val));
        const { ctx } = f;
        ctx.fillStyle = k >= 0 ? `rgba(245,101,101,${0.12 + Math.abs(k) * 0.7})` : `rgba(66,153,225,${0.12 + Math.abs(k) * 0.7})`;
        ctx.fillRect(bx + c * cell, by + r * cell, cell - 1.5, cell - 1.5);
      }
    }
    poly(f, [[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]], { stroke: C.grid, lw: 2.4 });
    text(f, mode, bx, by - 16, { color: C.fg, font: '15px serif' });
    // 右侧结论
    const rx = w * 0.56;
    text(f, '唯一性定理：', rx, 100, { color: C.yellow, font: '17px serif' });
    text(f, '边界值一旦给定，内部调和函数唯一', rx, 140, { color: C.fg, font: '15px sans-serif' });
    text(f, '证明（反证）：设两解之差 u 满足 ∇²u=0 且边界为 0', rx, 188, { color: C.cool, font: '14px sans-serif' });
    text(f, '∫|∇u|² = ∮u(∂u/∂n) − ∫u∇²u = 0 ⇒ ∇u ≡ 0 ⇒ u ≡ 0', rx, 224, { color: C.green, font: '15px serif' });
    text(f, '格林第一恒等式亮出底牌', rx, 258, { color: C.dim, font: '14px sans-serif' });
    text(f, '三类边界条件都唯一：', rx, 312, { color: C.yellow, font: '15px sans-serif' });
    ['狄利克雷：给 φ（本图）', '诺伊曼：给 ∂φ/∂n（总流量需相容）', '罗宾：给组合（辐射边界）'].forEach((s, i) => {
      text(f, '· ' + s, rx, 346 + i * 34, { color: C.fg, font: '14px sans-serif' });
    });
    text(f, '数值算法（松弛/多重网格）之所以可靠，正因为解唯一', rx, h - 108, { color: C.hot, font: '14px sans-serif' });
    text(f, '本图即松弛法：反复平均邻域直至收敛（拉氏方程=局部平均）', rx, h - 78, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '调和函数的均值性质：任一点值=周围圆周平均 —— 平滑到没有局部极值',
      '唯一性不保证存在性：诺伊曼问题需要总流量为零的相容条件',
      '狄利克雷原理：给定边界值使 Dirichlet 能量最小的函数正是调和函数',
    ]);
    heading(f, '边界定则，内部无争');
  },
});
registerViz(laplaceUniqueness);

/** P552 保角映射与二维问题。 */
const conformalMapping = defineViz({
  slug: 'conformal-mapping',
  title: '保角映射与二维问题',
  params: { map: { type: 'select', options: ['w = z²', 'w = ln z', 'w = 1/z'], default: 'w = z²', label: '映射' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'map', 'w = z²');
    clear(f);
    // 左：z 平面网格
    const ax = w * 0.25, ay = h * 0.44, R = 120;
    circle(f, ax, ay, R, { stroke: C.grid, lw: 1.6, dash: [6, 5] });
    seg(f, ax - R - 20, ay, ax + R + 20, ay, C.dim, 1.4);
    seg(f, ax, ay - R - 20, ax, ay + R + 20, C.dim, 1.4);
    text(f, 'z 平面（正交网格）', ax, ay - R - 34, { align: 'center', color: C.fg, font: '15px serif' });
    // 网格线
    for (let k = -3; k <= 3; k++) {
      const pts1: Array<[number, number]> = [], pts2: Array<[number, number]> = [];
      for (let i = 0; i <= 60; i++) {
        const t = -1 + (i / 60) * 2;
        const re = t * R, im = (k / 3) * R;
        pts1.push([ax + re * 0.33, ay - im * 0.33]);
        pts2.push([ax + (k / 3) * R * 0.33, ay + t * R * 0.33]);
      }
      poly(f, pts1, { stroke: `${C.cool}99`, lw: 1.3 });
      poly(f, pts2, { stroke: `${C.warm}99`, lw: 1.3 });
    }
    // 右：w 平面像
    const bx = w * 0.74;
    circle(f, bx, ay, R, { stroke: C.grid, lw: 1.6, dash: [6, 5] });
    seg(f, bx - R - 20, ay, bx + R + 20, ay, C.dim, 1.4);
    seg(f, bx, ay - R - 20, bx, ay + R + 20, C.dim, 1.4);
    text(f, 'w 平面（网格依旧正交！）', bx, ay - R - 34, { align: 'center', color: C.yellow, font: '15px serif' });
    // 变换后的曲线（动画相位）
    const ph = f.t * 0.6;
    const mapFn = (x: number, y: number): [number, number] => {
      if (kind === 'w = z²') return [x * x - y * y, 2 * x * y];
      if (kind === 'w = ln z') { const r2 = Math.hypot(x, y) + 0.001; return [Math.log(r2), Math.atan2(y, x)]; }
      const d = x * x + y * y + 0.001; return [x / d, -y / d];
    };
    for (let k = -3; k <= 3; k++) {
      for (const horiz of [true, false]) {
        const pts: Array<[number, number]> = [];
        for (let i = 0; i <= 80; i++) {
          const t = -1 + (i / 80) * 2;
          const zx = horiz ? t * 1.1 : (k / 3) * 1.1;
          const zy = horiz ? (k / 3) * 1.1 : t * 1.1;
          const [u0, v0] = mapFn(zx, zy);
          const sc = kind === 'w = ln z' ? 60 : kind === 'w = 1/z' ? 70 : 44;
          pts.push([bx + Math.cos(ph * 0) * u0 * sc, ay - v0 * sc]);
        }
        poly(f, pts, { stroke: horiz ? `${C.cool}aa` : `${C.warm}aa`, lw: 1.4 });
      }
    }
    text(f, kind, bx, ay + R + 34, { align: 'center', color: C.yellow, font: '16px serif' });
    text(f, '保角=保持交角 ⇒ 拉氏方程的解映过去仍是解', 56, h - 148, { color: C.fg, font: '16px serif' });
    text(f, '应用：机翼绕流（儒可夫斯基变换）、槽道场、芯片电极边值', 56, h - 118, { color: C.cool, font: '15px sans-serif' });
    text(f, '解析函数 f(z)=u+iv 的实虚部天然共轭：等势线⊥流线', 56, h - 88, { color: C.green, font: '15px sans-serif' });
    footnotes(f, [
      '导数非零处保角：小圆映成小圆且方位角不变（旋转+缩放的局部动作）',
      '施瓦茨引理：单位圆到单位圆的解析映射只会"收缩" — 对称性的原型',
      '二维拉氏问题的困难全在边界形状 —— 保角映射把难形状变成圆',
    ]);
    heading(f, '把难看的边界映成圆');
  },
});
registerViz(conformalMapping);

/** P553 边界积分与边界元思想。 */
const boundaryIntegral = defineViz({
  slug: 'boundary-integral',
  title: '边界积分与边界元思想',
  params: { dim: { type: 'select', options: ['3D 问题→2D 边界', '2D 问题→1D 边界'], default: '3D 问题→2D 边界', label: '降维演示' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = str(params, 'dim', '3D 问题→2D 边界');
    clear(f);
    if (mode.startsWith('3D')) {
      // 左：立方体域，只在表面布点
      const cx = w * 0.3, cy = h * 0.44;
      const s = 110;
      const proj = (x: number, y: number, z: number): [number, number] => [
        cx + (x - y) * 0.86 * s * 0.5,
        cy + (x + y) * 0.5 * s * 0.42 - z * s * 0.8,
      ];
      // 立方体边
      const corners: Array<[number, number, number]> = [];
      for (const z of [0, 1]) for (const y of [0, 1]) for (const x of [0, 1]) corners.push([x, y, z]);
      const edges: Array<[number, number]> = [];
      for (let i = 0; i < 8; i++) {
        for (let j = i + 1; j < 8; j++) {
          const d = Math.abs(corners[i][0] - corners[j][0]) + Math.abs(corners[i][1] - corners[j][1]) + Math.abs(corners[i][2] - corners[j][2]);
          if (d === 1) edges.push([i, j]);
        }
      }
      for (const [i, j] of edges) {
        const [x1, y1] = proj(...corners[i]);
        const [x2, y2] = proj(...corners[j]);
        seg(f, x1, y1, x2, y2, C.grid, 2);
      }
      // 边界上的点（只在表面）
      const rand = rng(9);
      for (let k = 0; k < 40; k++) {
        // 随机取一个面
        const face = Math.floor(rand() * 6);
        const u = rand(), vv = rand();
        const coords: Array<[number, number, number]> = [
          [u, vv, 0], [u, vv, 1], [u, 0, vv], [u, 1, vv], [0, u, vv], [1, u, vv],
        ];
        const [px, py] = proj(...coords[face]);
        dot(f, px, py, 5, C.yellow);
      }
      // 内部点（灰暗，不布点）
      text(f, '边界上的黄点 = 全部未知量', cx - 130, cy - 170, { color: C.yellow, font: '15px serif' });
      text(f, '内部（蓝灰）不需要网格！', cx - 130, cy + 170, { color: C.cool, font: '15px serif' });
      text(f, '3D 体问题 → 只在 2D 面上积分方程', 56, h - 148, { color: C.fg, font: '16px serif' });
      footnotes(f, [
        '格林第二恒等式：体积分变面积分 ⇒ 边界元方法（BEM）的数学内核',
        '优势：降维省网格、无限域天然精确（散射、流场、地电）',
        '代价：满阵（非稀疏）—— 快速多极子 FMM 加速的动机',
      ]);
    } else {
      // 2D→1D 边界
      const cx = w * 0.3, cy = h * 0.44, R = 140;
      circle(f, cx, cy, R, { stroke: C.grid, lw: 3, fill: 'rgba(45,55,72,0.4)' });
      const rand = rng(13);
      for (let k = 0; k < 36; k++) {
        const a = (k / 36) * Math.PI * 2;
        dot(f, cx + Math.cos(a) * R, cy + Math.sin(a) * R, 5.4, C.yellow);
      }
      void rand;
      // 内部场（颜色较淡）
      for (let gx = -3; gx <= 3; gx++) {
        for (let gy = -3; gy <= 3; gy++) {
          const x = gx * 40, y = gy * 40;
          if (Math.hypot(x, y) > R - 24) continue;
          const val = Math.sin(x / 46) * Math.cos(y / 52);
          const { ctx } = f;
          ctx.fillStyle = val >= 0 ? `rgba(66,153,225,${0.1 + Math.abs(val) * 0.3})` : `rgba(245,101,101,${0.1 + Math.abs(val) * 0.3})`;
          ctx.fillRect(cx + x - 17, cy + y - 17, 34, 34);
        }
      }
      circle(f, cx, cy, R, { stroke: C.grid, lw: 2.4 });
      text(f, '边界点 = 全部自由度', cx - 80, cy - R - 24, { color: C.yellow, font: '15px serif' });
      text(f, '2D 域问题 → 1D 边界积分方程', 56, h - 148, { color: C.fg, font: '16px serif' });
      text(f, '单层/双层势：φ = ∮(G ∂φ/∂n − φ ∂G/∂n)ds', 56, h - 118, { color: C.green, font: '15px serif' });
      text(f, '边界未知量解出后，内部任意点的值一算就有', 56, h - 88, { color: C.cool, font: '15px sans-serif' });
      footnotes(f, [
        '边界元把 PDE 化为边界上的积分方程（第二类弗雷德霍姆）',
        '本质：内部解完全由边界数据与其法向导数决定（单层+双层势叠加）',
        '工程应用：声散射、水波、断裂力学应力强度因子、静电屏蔽',
      ]);
    }
    heading(f, '三维问题降到边界上算');
  },
});
registerViz(boundaryIntegral);

/** P554 适定性与三类边界条件。 */
const wellPosedness = defineViz({
  slug: 'well-posedness',
  title: '适定性与三类边界条件',
  params: { bc: { type: 'select', options: ['狄利克雷', '诺伊曼', '罗宾'], default: '狄利克雷', label: '边界条件' } },
  draw: (f) => {
    const { w, h, params } = f;
    const bc = str(params, 'bc', '狄利克雷');
    clear(f);
    // 左：三条标准
    const bx = 56;
    text(f, '哈达玛适定三条件：', bx, 92, { color: C.yellow, font: '17px serif' });
    const criteria = [
      ['① 解存在（有解吗）', C.cool],
      ['② 解唯一（只有一个吗）', C.green],
      ['③ 解稳定（初值微动解不大动吗）', C.hot],
    ] as Array<[string, string]>;
    criteria.forEach(([s, color], i) => {
      const y = 130 + i * 62;
      poly(f, [[bx, y], [bx + 380, y], [bx + 380, y + 48], [bx, y + 48]],
        { fill: `${color}14`, stroke: `${color}bb`, lw: 1.8 });
      text(f, s, bx + 14, y + 31, { color, font: '16px serif' });
    });
    text(f, '三条缺一即"不适定"：病态问题数值上会放大噪声', bx, 130 + 3 * 62 + 16, { color: C.fg, font: '15px sans-serif' });
    text(f, '经典反例：不适定的热传导反问题（从现在推过去）', bx, 130 + 3 * 62 + 52, { color: C.hot, font: '14px sans-serif' });
    text(f, '解为 e^{+α²t}：微小初值扰动被指数放大 — 稳定性崩了', bx, 130 + 3 * 62 + 84, { color: C.dim, font: '14px sans-serif' });
    // 右：三类边界条件
    const rx = w * 0.58;
    const bcs: Array<[string, string, string]> = [
      ['狄利克雷：边界上给 u 值', '例：导体接地 φ=0、冰水混合物 T=0°C', C.cool],
      ['诺伊曼：给法向导数 ∂u/∂n', '例：绝热壁 ∂T/∂n=0、给定电荷密度', C.green],
      ['罗宾：给组合 αu+β∂u/∂n', '例：对流散热（牛顿冷却）、阻抗边界', C.warm],
    ];
    bcs.forEach(([title, note, color], i) => {
      const y = 100 + i * 108;
      const active = bc === title.slice(0, 4);
      poly(f, [[rx, y], [rx + 340, y], [rx + 340, y + 88], [rx, y + 88]],
        { fill: active ? `${color}30` : `${color}12`, stroke: color, lw: active ? 3 : 1.6 });
      text(f, title, rx + 14, y + 32, { color, font: '15px serif' });
      text(f, note, rx + 14, y + 64, { color: active ? C.fg : C.dim, font: '13px sans-serif' });
    });
    text(f, '混合问题：不同边界段可各用一类（柯西问题除外——波动方程给全边界反而不适定）',
      rx, 100 + 3 * 108 + 16, { color: C.yellow, font: '14px sans-serif' });
    footnotes(f, [
      '适定性是"可计算"的前提：数值方法面对不适定问题会输出看似合理的垃圾',
      '正则化（Tikhonov）把不适定问题近似成适定族 — 反问题求解的标准姿势',
      '柯西问题（给初值+法向导数）对椭圆方程不适定：为什么拉氏方程只问边界',
    ]);
    heading(f, '存在、唯一、稳定缺一不可');
  },
});
registerViz(wellPosedness);

/** P555 极值原理与调和函数。 */
const maximumPrinciple = defineViz({
  slug: 'maximum-principle',
  title: '极值原理与调和函数',
  params: { boundary2: { type: 'range', min: -50, max: 50, default: 30, step: 5, label: '边界峰值位置 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const peakPos = num(params, 'boundary2', 30) / 100;
    clear(f);
    // 左：一维调和函数（拉氏方程 d²u/dx²=0 ⇒ 线性！）与非调和对比
    const v = view(f, { xMin: 0, xMax: 1, yMin: -1.3, yMax: 1.6, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 调和函数在 1D 是直线（连接两端边界值）
    seg(f, v.sx(0), v.sy(0.4), v.sx(1), v.sy(-0.7), C.cool, 3);
    text(f, '1D 调和解（直线）：内部值=端点线性插值', v.sx(0.03), v.sy(1.5), { color: C.cool, font: '14px serif' });
    // 非调和对比：内部出现极值的函数（违反极值原理）
    const bad: Array<[number, number]> = [];
    for (let i = 0; i <= 200; i++) {
      const x = i / 200;
      bad.push([v.sx(x), v.sy(0.4 + (-1.1) * x + 1.3 * Math.sin(x * Math.PI) * Math.sin(f.t))]);
    }
    poly(f, bad, { stroke: C.hot, lw: 2.4, dash: [7, 5] });
    text(f, '红虚：非调和函数可在内部取到更极端值', v.sx(0.03), v.sy(1.3), { color: C.hot, font: '14px serif' });
    // 端点
    dot(f, v.sx(0), v.sy(0.4), 7, C.yellow);
    dot(f, v.sx(1), v.sy(-0.7), 7, C.yellow);
    text(f, '边界值', v.sx(0.04), v.sy(0.24), { color: C.yellow, font: '13px serif' });
    // 右：二维边界与内部
    const bx = w * 0.56, by = h * 0.28, bw = w * 0.38, bh = h * 0.4;
    poly(f, [[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]], { stroke: C.grid, lw: 2.4 });
    // 边界温度分布（峰值在参数位置）
    const cell = 16;
    for (let c = 0; c * cell < bw; c++) {
      const t = c * cell / bw;
      const val = Math.exp(-Math.pow((t - peakPos) * 4, 2));
      const { ctx } = f;
      ctx.fillStyle = `rgba(245,101,101,${0.2 + val * 0.75})`;
      ctx.fillRect(bx + c * cell, by - cell * 0.8, cell - 1, cell * 0.8);
      ctx.fillStyle = `rgba(66,153,225,${0.25 + (1 - val) * 0.3})`;
      ctx.fillRect(bx + c * cell, by + bh, cell - 1, cell * 0.8);
    }
    text(f, '红边=热点边界　蓝边=冷边界', bx, by - cell * 0.8 - 14, { color: C.fg, font: '14px serif' });
    // 内部温度（调和=平滑无极值）
    for (let c = 0; c * cell < bw; c += 2) {
      for (let r = 0; r * cell < bh; r += 2) {
        const t = c * cell / bw, s = r * cell / bh;
        // 近似调和插值
        const val = Math.exp(-Math.pow((t - peakPos) * 4, 2)) * (1 - s) + 0.2 * s;
        const interior = val * (1 - 0.35 * Math.sin(s * Math.PI));
        const { ctx } = f;
        ctx.fillStyle = `rgba(${interior > 0.4 ? '236,201,75' : '102,126,234'},${0.1 + interior * 0.5})`;
        ctx.fillRect(bx + c * cell + 1, by + r * cell + 1, cell * 2 - 3, cell * 2 - 3);
      }
    }
    text(f, '内部任何点的温度 ≤ 边界最高温', bx, by + bh + 40, { color: C.yellow, font: '15px serif' });
    text(f, '且除非恒等，内部取不到边界最值 ⇒ 最值只能在边界', bx, by + bh + 70, { color: C.fg, font: '14px sans-serif' });
    text(f, '物理直觉：没有热源时屋里不会比暖气片还烫', bx, by + bh + 100, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '强极值原理：非常值调和函数的最值只能在边界取到（内部不取）',
      '推论链：唯一性、稳定估计、傅里叶方法收敛性全部由它担保',
      '广义：次调和函数满足 u(p) ≤ 圈上平均 —— 调和函数=等号情形',
    ]);
    heading(f, '温度不会自己在屋里烧起来');
  },
});
registerViz(maximumPrinciple);