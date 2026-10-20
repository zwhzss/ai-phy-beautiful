import { defineViz, num, str, VizFrame } from '../types';
import { registerViz } from '../registry';
import {
  C,
  PALETTE,
  curve,
  dot,
  footnotes,
  grid,
  heading,
  poly,
  rng,
  seg,
  text,
  vec,
  view,
} from '../canvas';

type V3 = [number, number, number];

/** 3D → 2D 投影（绕 y、x 轴旋转）。 */
function proj3(p: V3, ay: number, ax: number, scale: number, cx: number, cy: number): [number, number] {
  const x1 = p[0] * Math.cos(ay) + p[2] * Math.sin(ay);
  const z1 = -p[0] * Math.sin(ay) + p[2] * Math.cos(ay);
  const y1 = p[1] * Math.cos(ax) - z1 * Math.sin(ax);
  return [cx + x1 * scale, cy - y1 * scale];
}

/** 用 RK4 积分一条 3D 轨迹并绘制。 */
function drawTrajectory(
  f: VizFrame,
  deriv: (p: V3, params: Record<string, any>) => V3,
  init: V3,
  steps: number,
  dt: number,
  project: (p: V3) => [number, number],
  color: string,
  params: Record<string, any>,
  lw = 1.2,
): V3 {
  let p = init;
  const pts: Array<[number, number]> = [project(p)];
  for (let i = 0; i < steps; i++) {
    const k1 = deriv(p, params);
    const p2: V3 = [p[0] + (dt / 2) * k1[0], p[1] + (dt / 2) * k1[1], p[2] + (dt / 2) * k1[2]];
    const k2 = deriv(p2, params);
    const p3: V3 = [p[0] + (dt / 2) * k2[0], p[1] + (dt / 2) * k2[1], p[2] + (dt / 2) * k2[2]];
    const k3 = deriv(p3, params);
    const p4: V3 = [p[0] + dt * k3[0], p[1] + dt * k3[1], p[2] + dt * k3[2]];
    const k4 = deriv(p4, params);
    p = [
      p[0] + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
      p[1] + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
      p[2] + (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
    ];
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1]) || !Number.isFinite(p[2])) break;
    pts.push(project(p));
  }
  poly(f, pts, { stroke: color, lw });
  return p;
}

/** A28 常微分方程。 */
const ode = defineViz({
  slug: 'ode',
  title: '常微分方程',
  params: {
  a: { type: 'range', min: -2, max: 1, default: -0.8, step: 0.1, label: '系数 a（y\' = a·y）' },
    y0: { type: 'range', min: -3, max: 3, default: 2, step: 0.25, label: '初值 y(0)' },
    slopeField: { type: 'select', options: ['显示', '隐藏'], default: '显示', label: '斜率场' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', -0.8);
    const y0 = num(params, 'y0', 2);
    const showField = str(params, 'slopeField', '显示') === '显示';
    const v = view(f, { xMin: 0, xMax: 6, yMin: -4, yMax: 4, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });

    if (showField) {
      for (let x = 0; x <= 6; x += 0.5) {
        for (let y = -4; y <= 4; y += 0.5) {
          const slope = a * y;
          const len = 0.22;
          const ang = Math.atan2(slope * (v.sy(0) - v.sy(1)), v.sx(1) - v.sx(0));
          const dx = Math.cos(ang) * len * (v.sx(1) - v.sx(0));
          const dy = Math.sin(ang) * len * (v.sx(1) - v.sx(0));
          seg(f, v.sx(x) - dx, v.sy(y) - dy, v.sx(x) + dx, v.sy(y) + dy, 'rgba(160,174,192,0.35)', 1);
        }
      }
    }
    // 解析解 y = y0 e^(ax)（数值积分对照）
    curve(f, v, (x) => y0 * Math.exp(a * x), { color: C.accent, lw: 2.6 });
    // 其他初值
    for (const alt of [-3, -1.5, 1.5, 3]) {
      if (Math.abs(alt - y0) < 0.01) continue;
      curve(f, v, (x) => alt * Math.exp(a * x), { color: `${PALETTE[Math.abs(alt) % PALETTE.length]}66`, lw: 1.2 });
    }
    dot(f, v.sx(0), v.sy(y0), 5.5, C.warm);

    footnotes(f, [
      `y' = ${a}y，初值 y(0) = ${y0} ⇒ 解 y = ${y0}e^(${a}x)`,
      a < 0 ? 'a < 0：所有解都指数衰减到 0（稳定平衡点）—— 这是"冷却方程"的形式' : a > 0 ? 'a > 0：解指数增长（不稳定），任何微小扰动都会被放大' : 'a = 0：解为常数（中性稳定）',
      '斜率场（灰线段）表示每点处的导数方向；解曲线处处与斜率场相切',
    ]);
    heading(f, '一阶常微分方程与斜率场');
  },
});

/** A29 热传导方程。 */
const heatEquation = defineViz({
  slug: 'heat-equation',
  title: '热传导方程',
  params: {
    modes: { type: 'range', min: 1, max: 5, default: 3, label: '初始模式数' },
    diffusivity: { type: 'range', min: 0.005, max: 0.1, default: 0.02, step: 0.005, label: '扩散系数 α' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const modes = Math.round(num(params, 'modes', 3));
    const alpha = num(params, 'diffusivity', 0.02);

    // u(x,t) = Σ a_n sin(nπx) e^(-α n²π² t)
    const N = 80;
    const timeSteps = 40;
    const ox = 50;
    const oy = 56;
    const iw = w - 100;
    const ih = h - 165;
    const cellW = iw / N;
    const cellH = ih / timeSteps;

    const amplitude = (n: number): number => 2 / n;
    for (let ti = 0; ti < timeSteps; ti++) {
      const t = (ti / timeSteps) * 30;
      for (let xi = 0; xi < N; xi++) {
        const x = (xi + 0.5) / N;
        let u = 0;
        for (let n = 1; n <= modes; n++) {
          u += amplitude(n) * Math.sin(n * Math.PI * x) * Math.exp(-alpha * n * n * Math.PI * Math.PI * t);
        }
        const hue = 220 - Math.max(-1, Math.min(1, u * 2)) * 220;
        f.ctx.save();
        f.ctx.fillStyle = `hsl(${Math.abs(hue)}, 70%, ${28 + Math.min(0.5, Math.abs(u)) * 90}%)`;
        f.ctx.fillRect(ox + xi * cellW, oy + ti * cellH, cellW + 0.6, cellH + 0.6);
        f.ctx.restore();
      }
    }
    text(f, '时间 t ↑', ox - 40, oy + 40, { color: C.dim, font: '11px sans-serif' });
    text(f, '位置 x →', w / 2, oy + ih + 20, { align: 'center', color: C.dim, font: '12px sans-serif' });
    seg(f, ox, oy - 6, ox + iw, oy - 6, C.dim, 1);
    seg(f, ox - 6, oy, ox - 6, oy + ih, C.dim, 1);

    footnotes(f, [
      `初始为 ${modes} 个正弦模式叠加，扩散系数 α = ${alpha}`,
      '高频（n 大）模式的衰减因子 e^(-αn²π²t) 衰减极快，所以温度分布迅速变光滑',
      '热传导方程 u_t = α u_xx 是抛物型 PDE 的原型：它把"尖峰"抹平，且不可逆（熵增）',
    ]);
    heading(f, '一维热传导：正弦模式的指数衰减');
  },
});

/** A30 波动方程。 */
const waveEquation = defineViz({
  slug: 'wave-equation',
  title: '波动方程',
  params: {
    mode: { type: 'range', min: 1, max: 5, default: 2, label: '驻波阶数 n' },
    time: { type: 'range', min: 0, max: 1, default: 0.35, step: 0.01, label: '时刻 t' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'mode', 2));
    const t = num(params, 'time', 0.35);
    const v = view(f, { xMin: 0, xMax: 1, yMin: -1.3, yMax: 1.3, inset: 42 });
    grid(f, v, { divisions: 4, ticks: true });
    seg(f, v.sx(0), v.sy(0), v.sx(1), v.sy(0), C.dim, 1.2);

    // 驻波 u(x,t) = sin(nπx)cos(nπct)
    const standing: Array<[number, number]> = [];
    for (let i = 0; i <= 200; i++) {
      const x = i / 200;
      standing.push([v.sx(x), v.sy(Math.sin(n * Math.PI * x) * Math.cos(n * Math.PI * t))]);
    }
    poly(f, standing, { stroke: C.accent, lw: 2.6 });

    // 前进波与后退波（它们叠加成驻波）
    const forward: Array<[number, number]> = [];
    const backward: Array<[number, number]> = [];
    for (let i = 0; i <= 200; i++) {
      const x = i / 200;
      const s1 = 0.5 * Math.sin(n * Math.PI * (x - t));
      const s2 = 0.5 * Math.sin(n * Math.PI * (x + t));
      forward.push([v.sx(x), v.sy(s1)]);
      backward.push([v.sx(x), v.sy(s2)]);
    }
    poly(f, forward, { stroke: `${C.green}88`, lw: 1.4, dash: [5, 4] });
    poly(f, backward, { stroke: `${C.cool}88`, lw: 1.4, dash: [5, 4] });

    // 节点
    for (let k = 0; k <= n; k++) {
      const x = k / n;
      dot(f, v.sx(x), v.sy(0), 4, C.hot);
    }

    footnotes(f, [
      `第 ${n} 阶驻波在 t = ${t.toFixed(2)} 时的形状（蓝）；红点是 ${n + 1} 个节点（始终不动）`,
      '两个反向传播的行波（绿、蓝虚线）叠加就得到驻波：sin(kx-ωt) + sin(kx+ωt) = 2sin(kx)cos(ωt)',
      `一维波动方程 u_tt = c²u_xx，本征频率成整数倍（${n} 阶有 ${n} 个腹点）—— 这是弦乐器音高的来源`,
    ]);
    heading(f, '波动方程：驻波与行波');
  },
});

/** A31 偏微分方程入门。 */
const pde = defineViz({
  slug: 'pde',
  title: '偏微分方程入门',
  params: {
    kind: { type: 'select', options: ['椭圆型（拉普拉斯）', '抛物型（热传导）', '双曲型（波动）'], default: '双曲型（波动）', label: '类型' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'kind', '双曲型（波动）');
    const v = view(f, { xMin: -0.2, xMax: 3.2, yMin: -0.4, yMax: 3.2, inset: 42 });
    grid(f, v, { divisions: 4, ticks: true });

    // 特征线
    if (kind.startsWith('双曲')) {
      // 波：特征线沿 (1, ±1) 方向
      for (let c = -2; c <= 4; c++) {
        poly(f, [[v.sx(-0.2), v.sy(-0.2 + c)], [v.sx(1.4), v.sy(1.4 + c)]], { stroke: `${C.accent}cc`, lw: 2 });
        poly(f, [[v.sx(-0.2), v.sy(0.2 + c)], [v.sx(1.4), v.sy(-1.4 + c)]], { stroke: `${C.warm}cc`, lw: 2 });
      }
      text(f, '特征线成两族直线', 44, 66, { color: C.accent, font: '12px sans-serif' });
      footnotes(f, [
        '双曲型：u_tt = c²u_xx（波动方程），判别式 B² - 4AC > 0',
        '两族特征线（蓝、橙）把"扰动"以有限速度 c 传播 —— 信息只能沿特征线传播',
        '物理直觉：双曲型描述可逆的波动传播（声、光、水波），初始的"尖峰"会分裂成左右两个波',
      ]);
    } else if (kind.startsWith('抛物')) {
      // 热传导：只有一个特征族（抛物线族），信息瞬间扩散
      for (let c = -1; c <= 4; c += 0.8) {
        const pts: Array<[number, number]> = [];
        for (let t = 0; t <= 3; t += 0.05) {
          const spread = Math.sqrt(Math.max(0.01, t)) * 0.5;
          const x = c + spread * 0;
          pts.push([v.sx(x), v.sy(t)]);
        }
        poly(f, pts, { stroke: `${PALETTE[Math.abs(Math.round(c)) % PALETTE.length]}cc`, lw: 2 });
      }
      // 高斯扩散锥
      for (let t = 0.2; t <= 3; t += 0.4) {
        const spread = Math.sqrt(t) * 0.7;
        const gPts: Array<[number, number]> = [];
        for (let x = -0.2; x <= 3.2; x += 0.05) {
          gPts.push([v.sx(x), v.sy(t) + (Math.exp(-((x - 1.5) ** 2) / (2 * spread * spread)) * 0.5 - 0.5)]);
        }
        poly(f, gPts, { stroke: `${C.accent}66`, lw: 1.2 });
      }
      text(f, '扩散无特征线，影响瞬间遍及全域', 44, 66, { color: C.accent, font: '12px sans-serif' });
      footnotes(f, [
        '抛物型：u_t = αu_xx（热传导方程），判别式 B² - 4AC = 0',
        '高斯型解随时间展宽（宽度 ~ √t），影响在任意远处瞬间非零（无限传播速度）',
        '物理直觉：抛物型描述不可逆的扩散过程（热、浓度），尖峰被"抹平"且无法复原',
      ]);
    } else {
      // 椭圆：等值线闭合
      for (let r = 0.4; r <= 2.6; r += 0.4) {
        const pts: Array<[number, number]> = [];
        for (let i = 0; i <= 120; i++) {
          const t = (i / 120) * Math.PI * 2;
          pts.push([v.sx(1.5 + r * Math.cos(t)), v.sy(1.5 + r * Math.sin(t))]);
        }
        poly(f, pts, { stroke: `${PALETTE[Math.round(r * 2) % PALETTE.length]}cc`, lw: 2 });
      }
      text(f, '无实特征线，解由边界唯一决定', 44, 66, { color: C.accent, font: '12px sans-serif' });
      footnotes(f, [
        '椭圆型：u_xx + u_yy = 0（拉普拉斯方程），判别式 B² - 4AC < 0',
        '没有实特征线：解在区域内处处依赖整个边界（边值问题）',
        '物理直觉：椭圆型描述平衡态（静电势、稳态温度）—— 边界上一处改变会立刻影响整个区域',
      ]);
    }
    heading(f, `PDE 分类：${kind}`);
  },
});

/** 三阶动力系统的通用绘图封装。 */
function renderAttractor(
  f: VizFrame,
  deriv: (p: V3, params: Record<string, any>) => V3,
  init: V3,
  scale: number,
  steps: number,
  dt: number,
  params: Record<string, any>,
  names: [string, string, string] = ['x', 'y', 'z'],
  center: V3 = [0, 0, 0],
  mode: '3d' | 'xz' = '3d',
): void {
  const { w, h } = f;
  const cx = w * 0.5;
  const cy = h / 2 + 6;
  // xz 模式给出"正视"视图（多数吸引子的经典角度），3d 模式带轻微透视
  const project = mode === 'xz'
    ? (p: V3): [number, number] => [cx + (p[0] - center[0]) * scale, cy - (p[2] - center[2]) * scale]
    : (p: V3): [number, number] => {
      const q: V3 = [p[0] - center[0], p[1] - center[1], p[2] - center[2]];
      return proj3(q, 0.42, 0.28, scale, cx, cy);
    };
  // 坐标轴
  const o = project([0, 0, 0]);
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((axis, i) => {
    const e = project([axis[0] * 1.4, axis[1] * 1.4, axis[2] * 1.4]);
    vec(f, o[0], o[1], e[0], e[1], 'rgba(160,174,192,0.4)', 1.2);
    text(f, names[i], e[0] + 5, e[1] - 4, { color: C.dim, font: '10px sans-serif' });
  });
  const rand = rng(20240607);
  for (let k = 0; k < 3; k++) {
    const start: V3 = [init[0] + (rand() - 0.5) * 0.6, init[1] + (rand() - 0.5) * 0.6, init[2] + (rand() - 0.5) * 0.6];
    drawTrajectory(f, deriv, start, steps, dt, project, k === 0 ? `${C.accent}` : `${PALETTE[k + 1]}bb`, params, k === 0 ? 1.4 : 1);
  }
}

/** A32 洛伦兹吸引子。 */
const lorenzAttractor = defineViz({
  slug: 'lorenz-attractor',
  title: '洛伦兹吸引子',
  params: {
    sigma: { type: 'range', min: 4, max: 16, default: 10, label: 'σ' },
    rho: { type: 'range', min: 10, max: 40, default: 28, label: 'ρ' },
    beta: { type: 'range', min: 1, max: 5, default: 2.667, step: 0.1, label: 'β' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const p = {
      sigma: num(params, 'sigma', 10),
      rho: num(params, 'rho', 28),
      beta: num(params, 'beta', 2.667),
    };
    renderAttractor(
      f,
      (q, prm) => [
        prm['sigma'] * (q[1] - q[0]),
        q[0] * (prm['rho'] - q[2]) - q[1],
        q[0] * q[1] - prm['beta'] * q[2],
      ],
      [0.1, 0, 0],
      Math.min(w, h) / 55,
      3600,
      0.006,
      p,
      ['x', 'y', 'z'],
      [0, 0, 25],
      'xz',
    );

    footnotes(f, [
      `σ = ${p.sigma}、ρ = ${p.rho}、β = ${p.beta.toFixed(3)}：三条几乎同源的轨迹（不同颜色）逐渐分离`,
      '洛伦兹系统的"蝴蝶"形状是混沌吸引子的经典图像：轨迹永不重复却始终被吸引子约束',
      '洛伦兹 1963 年研究大气对流时发现它 —— 这直接催生了"蝴蝶效应"与混沌理论',
    ]);
    heading(f, '洛伦兹吸引子');
  },
});

/** A33 Rössler 吸引子。 */
const rosslerAttractor = defineViz({
  slug: 'rossler-attractor',
  title: 'Rössler吸引子',
  params: {
    a: { type: 'range', min: 0.1, max: 0.5, default: 0.2, step: 0.02, label: 'a' },
    b: { type: 'range', min: 0.1, max: 1, default: 0.2, step: 0.05, label: 'b' },
    c: { type: 'range', min: 2, max: 12, default: 5.7, label: 'c' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const p = { a: num(params, 'a', 0.2), b: num(params, 'b', 0.2), c: num(params, 'c', 5.7) };
    renderAttractor(
      f,
      (q, prm) => [-q[1] - q[2], q[0] + prm['a'] * q[1], prm['b'] + q[2] * (q[0] - prm['c'])],
      [1, 1, 0],
      Math.min(w, h) / 34,
      4200,
      0.01,
      p,
      ['x', 'y', 'z'],
      [0, 0, 12],
      'xz',
    );
    footnotes(f, [
      `a = ${p.a.toFixed(2)}、b = ${p.b.toFixed(2)}、c = ${p.c.toFixed(2)}`,
      'Rössler 系统只有一项非线性（xz），是"最简单的混沌系统"之一，其结构是"单卷"的带状吸引子',
      '轨迹在平面上螺旋展开，偶尔被"弹出"到上方再落回 —— 这个机制让它成为混沌教学的经典例子',
    ]);
    heading(f, 'Rössler 吸引子');
  },
});

/** A34 Thomas 吸引子。 */
const thomasAttractor = defineViz({
  slug: 'thomas-attractor',
  title: 'Thomas吸引子',
  params: {
    b: { type: 'range', min: 0.05, max: 0.4, default: 0.19, step: 0.01, label: '阻尼 b' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const p = { b: num(params, 'b', 0.19) };
    renderAttractor(
      f,
      (q, prm) => [
        Math.sin(q[1]) - prm['b'] * q[0],
        Math.sin(q[2]) - prm['b'] * q[1],
        Math.sin(q[0]) - prm['b'] * q[2],
      ],
      [0.3, 0.2, 0.1],
      Math.min(w, h) / 13,
      3200,
      0.02,
      p,
    );
    footnotes(f, [
      `阻尼 b = ${p.b.toFixed(2)}（洛伦兹系统的推广，带正弦耦合）`,
      'Thomas 吸引子具有"环面"般的对称结构，是研究高维混沌与对称性的模型',
      'b 较小时吸引子更"蓬松"，b 增大到约 0.2 以上时混沌消失、轨迹收敛到固定点',
    ]);
    heading(f, 'Thomas 吸引子');
  },
});

/** A35 Aizawa 吸引子。 */
const aizawaAttractor = defineViz({
  slug: 'aizawa-attractor',
  title: 'Aizawa吸引子',
  params: {
    a: { type: 'range', min: 0.5, max: 1.5, default: 0.95, step: 0.05, label: 'a' },
    e: { type: 'range', min: 0.1, max: 0.6, default: 0.25, step: 0.05, label: 'e' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const p = { a: num(params, 'a', 0.95), e: num(params, 'e', 0.25) };
    renderAttractor(
      f,
      (q, prm) => {
        const aa = prm['a'];
        const ee = prm['e'];
        return [
          (q[2] - 0.7) * q[0] - 3.5 * q[1],
          3.5 * q[0] + (q[2] - 0.7) * q[1],
          0.6 + aa * q[2] - (q[2] ** 3) / 3 - (q[0] ** 2 + q[1] ** 2) * (1 + ee * q[2]) + 0.0001 * q[2] * q[0] ** 3,
        ];
      },
      [0.1, 0, 0],
      Math.min(w, h) / 5,
      3600,
      0.008,
      p,
    );
    footnotes(f, [
      `a = ${p.a.toFixed(2)}、e = ${p.e.toFixed(2)}：吸引子呈"球面 + 中轴"的漏斗结构`,
      'Aizawa 吸引子是在非线性动力学中构造出来的模型，其几何形态介于球面与环面之间',
      '它常被用作"混沌可视化"的示例：结构漂亮、对参数敏感、且能稳定复现',
    ]);
    heading(f, 'Aizawa 吸引子');
  },
});

/** A36 Chua 电路。 */
const chuaAttractor = defineViz({
  slug: 'chua-attractor',
  title: 'Chua电路',
  params: {
    alpha: { type: 'range', min: 6, max: 18, default: 15.6, step: 0.2, label: 'α' },
    beta: { type: 'range', min: 20, max: 32, default: 28, step: 0.5, label: 'β' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const alpha = num(params, 'alpha', 15.6);
    const beta = num(params, 'beta', 28);
    const p = { alpha, beta };
    const m0 = -1.143;
    const m1 = -0.714;
    renderAttractor(
      f,
      (q, prm) => {
        const gx = m1 * q[0] + 0.5 * (m0 - m1) * (Math.abs(q[0] + 1) - Math.abs(q[0] - 1));
        return [prm['alpha'] * (q[1] - q[0] - gx), q[0] - q[1] + q[2], -prm['beta'] * q[1]];
      },
      [0.7, 0, 0],
      Math.min(w, h) / 5.5,
      3400,
      0.01,
      p,
    );
    footnotes(f, [
      `α = ${alpha.toFixed(1)}、β = ${beta.toFixed(1)}：双涡卷吸引子（两个"眼睛"结构）`,
      'Chua 电路是最早被物理实现的混沌电路：只有一个非线性元件（分段线性电阻）',
      '双涡卷结构来自分段线性函数的两个转折点 —— 它把"混沌"从数学带进了实验室',
    ]);
    heading(f, 'Chua 电路：双涡卷混沌');
  },
});

/** A37 Halvorsen 吸引子。 */
const halvorsenAttractor = defineViz({
  slug: 'halvorsen-attractor',
  title: 'Halvorsen吸引子',
  params: {
    a: { type: 'range', min: 0.8, max: 2.4, default: 1.89, step: 0.01, label: '参数 a' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const p = { a: num(params, 'a', 1.89) };
    renderAttractor(
      f,
      (q, prm) => {
        const aa = prm['a'];
        return [-aa * q[0] - 4 * q[1] - 4 * q[2] - q[1] * q[1], -aa * q[1] - 4 * q[2] - 4 * q[0] - q[2] * q[2], -aa * q[2] - 4 * q[0] - 4 * q[1] - q[0] * q[0]];
      },
      [-1.48, -1.51, 2.04],
      Math.min(w, h) / 34,
      3800,
      0.005,
      p,
    );
    footnotes(f, [
      `a = ${p.a.toFixed(2)}：三条自相似的"旋臂"围绕中心旋转`,
      'Halvorsen 吸引子的方程具有循环对称性（x→y→z），因此图像呈现三重旋转对称',
      '对称的混沌系统往往产生对称的吸引子 —— 但单条轨迹依然不重复',
    ]);
    heading(f, 'Halvorsen 吸引子');
  },
});

/** A38 Hénon 映射。 */
const henonMap = defineViz({
  slug: 'henon-map',
  title: 'Henon映射',
  params: {
    a: { type: 'range', min: 1, max: 1.45, default: 1.4, step: 0.01, label: 'a' },
    b: { type: 'range', min: 0.1, max: 0.4, default: 0.3, step: 0.01, label: 'b' },
    iterations: { type: 'range', min: 1000, max: 20000, default: 8000, step: 1000, label: '迭代次数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 1.4);
    const b = num(params, 'b', 0.3);
    const iters = Math.round(num(params, 'iterations', 8000));
    // x_{n+1} = 1 - a x_n² + y_n, y_{n+1} = b x_n
    let x = 0.1;
    let y = 0.1;
    const v = view(f, { xMin: -1.6, xMax: 1.6, yMin: -0.5, yMax: 0.5, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    for (let i = 0; i < iters; i++) {
      const nx = 1 - a * x * x + y;
      const ny = b * x;
      x = nx;
      y = ny;
      if (i < 50) continue;
      dot(f, v.sx(x), v.sy(y), 0.8, `${C.accent}bb`);
    }

    footnotes(f, [
      `a = ${a.toFixed(2)}、b = ${b.toFixed(2)}：迭代 ${iters} 次得到的点集（Hénon 吸引子）`,
      '离散映射也能产生混沌：这个吸引子由无数条"曲线"组成，任意放大都还有细节',
      'Hénon 映射是"拉伸 + 折叠"的原型：拉伸造成敏感性，折叠把轨道拉回有界区域',
    ]);
    heading(f, 'Hénon 映射');
  },
});

/** A39 逻辑斯蒂分岔。 */
const logisticBifurcation = defineViz({
  slug: 'logistic-bifurcation',
  title: '逻辑斯蒂分岔',
  params: {
    rMin: { type: 'range', min: 1, max: 3.5, default: 2.5, step: 0.1, label: 'r 起始' },
    rMax: { type: 'range', min: 3.2, max: 4, default: 4, step: 0.05, label: 'r 结束' },
    samples: { type: 'range', min: 200, max: 1200, default: 700, step: 50, label: 'r 采样数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const rMin = num(params, 'rMin', 2.5);
    const rMax = Math.max(rMin + 0.2, num(params, 'rMax', 4));
    const samples = Math.round(num(params, 'samples', 700));
    const v = view(f, { xMin: rMin, xMax: rMax, yMin: 0, yMax: 1, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });

    for (let i = 0; i < samples; i++) {
      const r = rMin + ((rMax - rMin) * i) / samples;
      let x = 0.4;
      for (let k = 0; k < 300; k++) x = r * x * (1 - x);
      // 记录后续迭代值（吸引子）
      const seen: number[] = [];
      for (let k = 0; k < 60; k++) {
        x = r * x * (1 - x);
        seen.push(x);
      }
      // 去重后画点
      seen.forEach((val) => {
        if (seen.findIndex((s) => Math.abs(s - val) < 0.004) === seen.indexOf(val)) {
          dot(f, v.sx(r), v.sy(val), 0.9, `${C.accent}aa`);
        }
      });
    }
    // 关键分岔点
    [3, 3.449, 3.5699].forEach((r) => {
      if (r < rMin || r > rMax) return;
      seg(f, v.sx(r), v.sy(0), v.sx(r), v.sy(1), `${C.warm}88`, 1.2);
      text(f, String(r), v.sx(r), v.sy(1) - 8, { align: 'center', color: C.warm, font: '10px sans-serif' });
    });

    footnotes(f, [
      `logistic 映射 x_{n+1} = r·x_n(1-x_n)，r 从 ${rMin.toFixed(1)} 到 ${rMax.toFixed(2)}`,
      'r < 3 收敛到单点；r ≈ 3 第一次分岔为 2 周期；3.449 分岔为 4 周期 …… 3.5699 之后进入混沌',
      `分岔间隔比趋于费根鲍姆常数 δ ≈ 4.669 —— 这是普适常数，与具体映射无关`,
    ]);
    heading(f, 'logistic 映射的分岔图');
  },
});

registerViz(
  ode,
  heatEquation,
  waveEquation,
  pde,
  lorenzAttractor,
  rosslerAttractor,
  thomasAttractor,
  aizawaAttractor,
  chuaAttractor,
  halvorsenAttractor,
  henonMap,
  logisticBifurcation,
);
