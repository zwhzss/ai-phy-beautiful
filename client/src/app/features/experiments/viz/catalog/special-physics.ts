import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, PALETTE, curve, dot, footnotes, grid, heading, poly, rng, seg, text, view } from '../canvas';
import { drawAxes3, proj3, renderSurface, V3 } from '../surface3d';

/** P54 曲面旋转族。 */
const surfaceRevolution = defineViz({
  slug: 'surface-revolution',
  title: '曲面旋转族',
  params: {
    kind: { type: 'select', options: ['球面', '环面', '花瓶', '圆锥面'], default: '花瓶', label: '母线' },
    scale: { type: 'range', min: 0.6, max: 1.8, default: 1.1, step: 0.1, label: '尺度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'kind', '花瓶');
    const s = num(params, 'scale', 1.1);
    const profile: (t: number) => number = kind.startsWith('球面')
      ? (t) => Math.sin(t * Math.PI)
      : kind.startsWith('环面')
        ? () => 1
        : kind.startsWith('圆锥')
          ? (t) => 1 - t * 0.8
          : (t) => 0.5 + 0.55 * Math.sin(t * Math.PI * 1.6) + t * 0.35;
    renderSurface(f, (u, v) => {
      const r = profile(u) * s;
      const z = (u - 0.5) * 2.4 * s;
      return [r * Math.cos(v), z, r * Math.sin(v)];
    }, { uMin: 0, uMax: 1, vMin: 0, vMax: Math.PI * 2, uSteps: 28, vSteps: 44, scale: Math.min(w, h) / 5, hue: (u) => 200 + u * 60 }, w / 2, h / 2 + 6);

    footnotes(f, [
      `旋转曲面：把母线 r = r(t) 绕轴旋转一周 ${kind.startsWith('球面') ? '（半圆旋转得球面）' : ''}`,
      '旋转曲面的子午线是测地线，且所有子午线都全等 —— 这是它最重要的几何性质',
      '旋转面的高斯曲率只依赖母线的位置与曲率：K = (r′z″ − z′r″)·r′ / (r(r′²+z′²)²)',
    ]);
    heading(f, `旋转曲面：${kind}`);
  },
});

/** P55 管状曲面。 */
const tubeSurface = defineViz({
  slug: 'tube-surface',
  title: '管状曲面',
  params: {
    curve: { type: 'select', options: ['螺旋线', '圆', '空间曲线'], default: '螺旋线', label: '中心曲线' },
    radius: { type: 'range', min: 0.05, max: 0.5, default: 0.22, step: 0.01, label: '管半径' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const curveKind = str(params, 'curve', '螺旋线');
    const tubeR = num(params, 'radius', 0.22);
    const center = (t: number): V3 => curveKind.startsWith('螺旋')
      ? [Math.cos(t * 3), t * 0.5 - 1.2, Math.sin(t * 3)]
      : curveKind.startsWith('圆')
        ? [1.4 * Math.cos(t * 2), 0.4 * Math.sin(t * 4), 1.4 * Math.sin(t * 2)]
        : [Math.sin(t * 2), Math.cos(t * 3) * 0.8, Math.sin(t * 4) * 0.5];
    const scal = Math.min(w, h) / 5;
    const cx = w / 2;
    const cy = h / 2 + 6;
    renderSurface(f, (u, v) => {
      const t = u;
      const p = center(t);
      const p2 = center(t + 0.01);
      const T: V3 = [p2[0] - p[0], p2[1] - p[1], p2[2] - p[2]];
      const tl = Math.hypot(T[0], T[1], T[2]) || 1;
      const Tn: V3 = [T[0] / tl, T[1] / tl, T[2] / tl];
      const nRaw: V3 = [-Tn[2], 0, Tn[0]];
      const nl = Math.hypot(nRaw[0], nRaw[1], nRaw[2]) || 1;
      const N: V3 = [nRaw[0] / nl, nRaw[1] / nl, nRaw[2] / nl];
      const B: V3 = [Tn[1] * N[2] - Tn[2] * N[1], Tn[2] * N[0] - Tn[0] * N[2], Tn[0] * N[1] - Tn[1] * N[0]];
      return [
        p[0] + tubeR * (Math.cos(v) * N[0] + Math.sin(v) * B[0]),
        p[1] + tubeR * (Math.cos(v) * N[1] + Math.sin(v) * B[1]),
        p[2] + tubeR * (Math.cos(v) * N[2] + Math.sin(v) * B[2]),
      ];
    }, { uMin: 0, uMax: Math.PI * 2 * 2, vMin: 0, vMax: Math.PI * 2, uSteps: 90, vSteps: 10, scale: scal, hue: (u) => 210 + (u % 6.28) * 22 }, cx, cy);
    drawAxes3(f, 0.6, 0.45, scal, cx, cy, 1.6);

    footnotes(f, [
      `管状曲面：沿中心曲线（${curveKind}）取法平面上的圆，扫出管状曲面`,
      '用 Frenet 标架（切线 T、法线 N、副法线 B）构造截面圆，因此曲面不会"扭曲塌陷"',
      'DNA 双螺旋、血管、光纤都可建模为管状曲面；管半径不影响中心曲线的曲率与挠率',
    ]);
    heading(f, `管状曲面：${curveKind}`);
  },
});

/** P56 猴鞍面。 */
const monkeySaddle = defineViz({
  slug: 'monkey-saddle',
  title: '猴鞍面',
  params: {
    a: { type: 'range', min: 0.2, max: 1.5, default: 0.8, step: 0.05, label: '参数 a' },
    range: { type: 'range', min: 0.8, max: 2, default: 1.4, step: 0.1, label: '范围' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 0.8);
    const range = num(params, 'range', 1.4);
    renderSurface(f, (u, v) => [u, a * (u * u * u - 3 * u * v * v), v], {
      uMin: -range, uMax: range, vMin: -range, vMax: range, uSteps: 34, vSteps: 34,
      scale: Math.min(w, h) / 4.2,
      hue: (u, v) => 205 + (u * u * u - 3 * u * v * v) * 20,
    }, w / 2, h / 2 + 6);

    footnotes(f, [
      `猴鞍面 z = ${a}(x³ − 3xy²)：有 3 个下坡方向（"给猴子坐的鞍"，一鞍三腿）`,
      '它是鞍点概念的高阶推广：原点处沿三个方向下降、三个方向上升（共 6 个"方向极值"）',
      '临界点的类型（极大/极小/鞍点）由 Hessian 的特征值符号决定，猴鞍面的 Hessian 在原点退化',
    ]);
    heading(f, '猴鞍面');
  },
});

/** P57 海贝曲面。 */
const seashellSurface = defineViz({
  slug: 'seashell-surface',
  title: '海贝曲面',
  params: {
    turns: { type: 'range', min: 1, max: 6, default: 3.5, step: 0.1, label: '螺旋圈数' },
    growth: { type: 'range', min: 0.05, max: 0.35, default: 0.16, step: 0.01, label: '增长系数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const turns = num(params, 'turns', 3.5);
    const growth = num(params, 'growth', 0.16);
    renderSurface(f, (u, v) => {
      const theta = u * Math.PI * 2 * turns;
      const g = Math.exp(growth * theta);
      const r = 0.35 * (1 + v * 0.9) * g;
      return [r * Math.cos(theta), (0.3 * v + 0.2) * g, r * Math.sin(theta)];
    }, { uMin: 0, uMax: 1, vMin: -1, vMax: 1, uSteps: 90, vSteps: 16, scale: Math.min(w, h) / 11, hue: (u, v) => 30 + u * 200 + v * 20, faceAlpha: 0.92 }, w / 2, h / 2 + 6);

    footnotes(f, [
      `海贝曲面：对数螺线（等角螺线）扫出的管状面，半径按 e^(${growth}θ) 增长`,
      '贝壳的生长遵循"对数螺线"：每转一圈半径按固定比例放大，因此形状自相似（从小贝到大贝"同形"）',
      `这也解释了为什么鹦鹉螺、羊角、星系旋臂都呈现相同的曲线 —— 生长规则相同`,
    ]);
    heading(f, '海贝曲面：对数螺线生长');
  },
});

/** P58 惠特尼伞。 */
const whitneyUmbrella = defineViz({
  slug: 'whitney-umbrella',
  title: '惠特尼伞',
  params: {
    size: { type: 'range', min: 0.5, max: 1.6, default: 1, step: 0.1, label: '尺度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const s = num(params, 'size', 1);
    renderSurface(f, (u, v) => [u * v * s, u * s * 0.9, v * v * s], {
      uMin: -1.3, uMax: 1.3, vMin: -1.3, vMax: 1.3, uSteps: 30, vSteps: 30,
      scale: Math.min(w, h) / 3.6, hue: (u, v) => 220 + v * 30, faceAlpha: 0.94,
    }, w / 2, h / 2 + 6);

    footnotes(f, [
      '惠特尼伞（Whitney umbrella）：x = uv，y = u，z = v² —— 包含一条"自交线"（z 轴）',
      '沿 z 轴（u = 0 处）曲面不是流形：局部看起来像"伞柄"，无法与平面同胚',
      '它是研究"奇点"的标准例子：奇点理论刻画曲面/映射在哪些点失去光滑性',
    ]);
    heading(f, '惠特尼伞：带自交奇点的曲面');
  },
});

/** P59 球面调和函数。 */
const sphericalHarmonics = defineViz({
  slug: 'spherical-harmonics',
  title: '球面调和函数',
  params: {
    l: { type: 'range', min: 0, max: 6, default: 3, label: '阶数 l' },
    m: { type: 'range', min: -6, max: 6, default: 2, label: '次 m' },
    amp: { type: 'range', min: 0.2, max: 1, default: 0.5, step: 0.05, label: '变形幅度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const l = Math.round(num(params, 'l', 3));
    const mRaw = Math.round(num(params, 'm', 2));
    const m = Math.abs(mRaw) > l ? l : Math.abs(mRaw);
    const amp = num(params, 'amp', 0.5);
    // 用简化的关联勒让德多项式
    const assocLegendre = (ll: number, mm: number, x: number): number => {
      let pmm = 1;
      if (mm > 0) {
        const somx2 = Math.sqrt(Math.max(0, 1 - x * x));
        let fact = 1;
        for (let i = 1; i <= mm; i++) {
          pmm *= -fact * somx2;
          fact += 2;
        }
      }
      if (ll === mm) return pmm;
      let pmmp1 = x * (2 * mm + 1) * pmm;
      if (ll === mm + 1) return pmmp1;
      let pll = 0;
      for (let k = mm + 2; k <= ll; k++) {
        pll = ((2 * k - 1) * x * pmmp1 - (k + mm - 1) * pmm) / (k - mm);
        pmm = pmmp1;
        pmmp1 = pll;
      }
      return pll;
    };
    renderSurface(f, (u, v) => {
      // u: 极角 θ ∈ [0,π]，v: 方位角 φ
      const plm = assocLegendre(l, m, Math.cos(u));
      const y = plm * Math.cos(m * v);
      const r = 1 + amp * y * 0.8;
      return [r * Math.sin(u) * Math.cos(v), r * Math.cos(u), r * Math.sin(u) * Math.sin(v)];
    }, { uMin: 0, uMax: Math.PI, vMin: 0, vMax: Math.PI * 2, uSteps: 40, vSteps: 56, scale: Math.min(w, h) / 3, hue: (u, v) => 210 + Math.sin(v * m) * 60 }, w / 2, h / 2 + 6);

    footnotes(f, [
      `球面调和函数 Y_${l}^${m} 调制球面半径（l = ${l}，m = ${m}）：节线把球面分成 ${l - m + 1} 个纬带`,
      '球面调和是球坐标下拉普拉斯方程的角度解，在球面上正交（类似傅里叶级数之于圆周）',
      '应用：原子轨道形状（s、p、d 轨道就是 l = 0、1、2）、地球重力场建模、宇宙微波背景分析',
    ]);
    heading(f, `球面调和：Y_${l}^${m}`);
  },
});

/** 环面纽结的管状曲面（P60 / P63 共用）。 */
function torusKnotSurface(
  f: Parameters<typeof poly>[0],
  p: number,
  q: number,
  tube: number,
  R1: number,
  R2: number,
  scale: number,
  cx: number,
  cy: number,
  hueBase: number,
): void {
  const knot = (t: number): V3 => {
    const r = R1 + R2 * Math.cos(q * t);
    return [r * Math.cos(p * t), r * Math.sin(p * t), R2 * Math.sin(q * t)];
  };
  renderSurface(f, (u, v) => {
    const t = u;
    const pos = knot(t);
    const pos2 = knot(t + 0.01);
    const T: V3 = [pos2[0] - pos[0], pos2[1] - pos[1], pos2[2] - pos[2]];
    const tl = Math.hypot(T[0], T[1], T[2]) || 1;
    const Tn: V3 = [T[0] / tl, T[1] / tl, T[2] / tl];
    const nRaw: V3 = [-Tn[1], Tn[0], 0];
    const nl = Math.hypot(nRaw[0], nRaw[1], nRaw[2]) || 1;
    const N: V3 = [nRaw[0] / nl, nRaw[1] / nl, nRaw[2] / nl];
    const B: V3 = [Tn[1] * N[2] - Tn[2] * N[1], Tn[2] * N[0] - Tn[0] * N[2], Tn[0] * N[1] - Tn[1] * N[0]];
    return [
      pos[0] + tube * (Math.cos(v) * N[0] + Math.sin(v) * B[0]),
      pos[1] + tube * (Math.cos(v) * N[1] + Math.sin(v) * B[1]),
      pos[2] + tube * (Math.cos(v) * N[2] + Math.sin(v) * B[2]),
    ];
  }, { uMin: 0, uMax: Math.PI * 2, vMin: 0, vMax: Math.PI * 2, uSteps: 140, vSteps: 8, scale, hue: (u) => hueBase + (u / (Math.PI * 2)) * 200 }, cx, cy);
}

/** P60 环面纽结曲面。 */
const torusKnotSurfaceViz = defineViz({
  slug: 'torus-knot-surface',
  title: '环面纽结曲面',
  params: {
    p: { type: 'range', min: 1, max: 8, default: 3, label: '经向圈数 p' },
    q: { type: 'range', min: 1, max: 8, default: 2, label: '纬向圈数 q' },
    tube: { type: 'range', min: 0.05, max: 0.3, default: 0.12, step: 0.01, label: '管半径' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const p = Math.round(num(params, 'p', 3));
    const q = Math.round(num(params, 'q', 2));
    const tube = num(params, 'tube', 0.12);
    let gcdVal = 1;
    for (let i = 1; i <= Math.min(p, q); i++) if (p % i === 0 && q % i === 0) gcdVal = i;
    torusKnotSurface(f, p, q, tube, 1.3, 0.5, Math.min(w, h) / 4.4, w / 2, h / 2 + 6, 200);

    footnotes(f, [
      `(${p},${q}) 环面纽结：绕环面经向 ${p} 圈、纬向 ${q} 圈，${gcdVal === 1 ? '因为 gcd(p,q)=1 所以是真正的纽结（不自交成多个环）' : `gcd(p,q)=${gcdVal} 时是 ${gcdVal} 条分离的纽结（链环）`}`,
      '环面纽结是最容易可视化的纽结族：它们恰好是能"躺在环面上"的纽结',
      '纽结理论是低维拓扑的核心：所有纽结的分类至今没有完全解决（不变量是主要工具）',
    ]);
    heading(f, `环面纽结：(${p}, ${q})`);
  },
});

/** P61 克莱因瓶八字形。 */
const kleinBottleFigure8 = defineViz({
  slug: 'klein-bottle-figure8',
  title: '克莱因瓶八字形',
  params: {
    scale: { type: 'range', min: 0.1, max: 0.4, default: 0.24, step: 0.01, label: '管半径' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const tube = num(params, 'scale', 0.24);
    // 8 字形克莱因瓶（figure-8 immersion）
    renderSurface(f, (u, v) => {
      const theta = u * Math.PI * 2;
      const phi = v * Math.PI * 2;
      const ct = Math.cos(theta / 2);
      const st = Math.sin(theta / 2);
      const c2 = Math.cos(theta);
      const cp = Math.cos(phi);
      const sp = Math.sin(phi);
      const x = (tube + cp) * ct;
      const y = (tube + cp) * st;
      const z = c2 * (sp + 0.6 * cp * cp * Math.sin(theta)) * 1.4;
      return [x * 1.6, z * 1.1, y * 1.6];
    }, { uMin: 0, uMax: 2, vMin: 0, vMax: 1, uSteps: 70, vSteps: 30, scale: Math.min(w, h) / 4.6, hue: (u, v) => 260 + v * 80, faceAlpha: 0.92 }, w / 2, h / 2 + 6);

    footnotes(f, [
      '克莱因瓶的 8 字形浸入：不可定向、无边界的闭曲面，在三维空间中必然自交',
      '与"瓶形"浸入相比，8 字形版本的对称性更好（有双重旋转对称）',
      '克莱因瓶不能在三维欧氏空间中无自交地嵌入（这是拓扑对嵌入维数的硬约束，需要 4 维空间）',
    ]);
    heading(f, '克莱因瓶（8 字形浸入）');
  },
});

/** P62 可展曲面。 */
const developableSurface = defineViz({
  slug: 'developable-surface',
  title: '投影曲面族',
  params: {
    kind: { type: 'select', options: ['圆柱面', '圆锥面', '切线面'], default: '切线面', label: '可展曲面' },
    curvature: { type: 'range', min: 0.2, max: 1.4, default: 0.7, step: 0.05, label: '弯曲程度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'kind', '切线面');
    const curv = num(params, 'curvature', 0.7);
    const fn: (u: number, v: number) => V3 = kind.startsWith('圆柱')
      ? (u, v) => [Math.cos(u), v * 1.6, Math.sin(u)]
      : kind.startsWith('圆锥')
        ? (u, v) => [(1 - v) * Math.cos(u), v * 1.6 - 0.8, (1 - v) * Math.sin(u)]
        : (u, v) => {
          // 切线面：沿一条曲线取切线方向延伸
          const base: V3 = [Math.cos(u) * curv, Math.sin(u * 1.4) * 0.5, Math.sin(u) * curv];
          const next: V3 = [Math.cos(u + 0.01) * curv, Math.sin((u + 0.01) * 1.4) * 0.5, Math.sin(u + 0.01) * curv];
          const T: V3 = [next[0] - base[0], next[1] - base[1], next[2] - base[2]];
          const tl = Math.hypot(T[0], T[1], T[2]) || 1;
          return [base[0] + (v * T[0]) / tl, base[1] + (v * T[1]) / tl, base[2] + (v * T[2]) / tl];
        };
    renderSurface(f, fn, { uMin: 0, uMax: Math.PI * 2, vMin: -1, vMax: 1, uSteps: 60, vSteps: 12, scale: Math.min(w, h) / 5, hue: (u, v) => 200 + u * 20 + v * 30 }, w / 2, h / 2 + 6);

    footnotes(f, [
      `${kind}：可展曲面（高斯曲率处处为 0），可以不拉伸、不撕裂地展开成平面`,
      '三类可展曲面：柱面、锥面、切线面（都由直线族构成且沿直线切平面相同）',
      '这正是"纸可以卷成圆柱、圆锥"的数学原因；钣金、造船、服装打版都依赖可展性',
    ]);
    heading(f, `可展曲面：${kind}`);
  },
});

/** P64 平均曲率流。 */
const meanCurvatureFlow = defineViz({
  slug: 'mean-curvature-flow',
  title: '平均曲率流',
  params: {
    steps: { type: 'range', min: 1, max: 12, default: 7, label: '展示时刻数' },
    anisotropy: { type: 'range', min: 0, max: 0.8, default: 0.35, step: 0.05, label: '初始各向异性' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const steps = Math.round(num(params, 'steps', 7));
    const aniso = num(params, 'anisotropy', 0.35);
    const cx = w / 2;
    const cy = h / 2 + 6;
    const baseR = Math.min(w, h) * 0.36;
    for (let k = 0; k < steps; k++) {
      const t = k / (steps - 1 || 1);
      const shrink = 1 - Math.sqrt(t) * 0.92;
      const roundness = t;
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 160; i++) {
        const a = (i / 160) * Math.PI * 2;
        const r = baseR * shrink * (1 + (1 - roundness) * aniso * Math.cos(4 * a));
        pts.push([cx + r * Math.cos(a), cy - r * Math.sin(a) * 0.8]);
      }
      poly(f, pts, { stroke: `hsl(${210 + k * 22}, 65%, ${68 - k * 5}%)`, lw: 2.2 - k * 0.15 });
    }
    dot(f, cx, cy, 3.5, C.hot);

    footnotes(f, [
      `平均曲率流：曲线/曲面沿法向以"平均曲率"的速度收缩（箭头方向），初始有 ${aniso.toFixed(2)} 的各向异性`,
      '无论初始形状多不规则（有棱角），平均曲率流都会迅速平滑它，最终缩成一点（二维曲线）',
      '这是"最速降面积"的梯度流：肥皂膜、金属退火、图像去噪（Perona-Malik）都用它建模',
    ]);
    heading(f, '平均曲率流：形状的平滑收缩');
  },
});

/** P65 立体角。 */
const solidAngle = defineViz({
  slug: 'solid-angle',
  title: '立体角',
  params: {
    halfAngle: { type: 'range', min: 5, max: 90, default: 40, label: '锥半角(°)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const halfAngle = (num(params, 'halfAngle', 40) * Math.PI) / 180;
    const cx = w * 0.4;
    const cy = h / 2 + 6;
    const R = Math.min(w, h) * 0.3;
    // 球面
    const sphere: Array<[number, number]> = [];
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * Math.PI * 2;
      sphere.push([cx + R * Math.cos(t), cy + R * Math.sin(t)]);
    }
    poly(f, sphere, { stroke: C.dim, lw: 1.6, dash: [5, 4] });
    // 圆锥在球面上的截口（立体角对应面积）
    const capPts: Array<[number, number]> = [];
    for (let i = 0; i <= 80; i++) {
      const a = (i / 80) * Math.PI * 2;
      capPts.push([cx + R * Math.sin(halfAngle) * Math.cos(a), cy + R * Math.sin(halfAngle) * Math.sin(a)]);
    }
    poly(f, capPts, { fill: 'rgba(102,126,234,0.35)', stroke: C.accent, lw: 2, close: true });
    // 锥体侧线
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      seg(f, cx, cy, cx + R * Math.sin(halfAngle) * Math.cos(a), cy + R * Math.sin(halfAngle) * Math.sin(a), `${C.warm}77`, 1);
    }
    dot(f, cx, cy, 5, C.warm);

    // 立体角数值 Ω = 2π(1 - cos θ)
    const omega = 2 * Math.PI * (1 - Math.cos(halfAngle));
    const fraction = omega / (4 * Math.PI);
    footnotes(f, [
      `锥半角 ${num(params, 'halfAngle', 40).toFixed(0)}°：立体角 Ω = 2π(1 − cos θ) = ${omega.toFixed(4)} sr`,
      `占整个球面的 ${(fraction * 100).toFixed(3)}%（整球为 4π = ${(4 * Math.PI).toFixed(4)} sr）`,
      '立体角是"面积在球面上的投影"：单位球面上区域的面积；辐射度学、计算机图形学用它度量光源的"张角"',
    ]);
    heading(f, '立体角：球面上的面积');
  },
});

/** P66 四面体体积。 */
const tetrahedronVolume = defineViz({
  slug: 'tetrahedron-volume',
  title: '四面体体积',
  params: {
    a: { type: 'range', min: 0.5, max: 2.5, default: 1.5, step: 0.1, label: '边长 a（x 方向）' },
    b: { type: 'range', min: 0.5, max: 2.5, default: 1.2, step: 0.1, label: '边长 b（y 方向）' },
    c: { type: 'range', min: 0.5, max: 2.5, default: 1.8, step: 0.1, label: '边长 c（z 方向）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 1.5);
    const b = num(params, 'b', 1.2);
    const c = num(params, 'c', 1.8);
    const scale = Math.min(w, h) / 6;
    const cx = w / 2;
    const cy = h / 2 + 6;
    const ay = 0.62;
    const ax = 0.42;
    const O: V3 = [0, 0, 0];
    const A: V3 = [a, 0, 0];
    const B: V3 = [0, b, 0];
    const D: V3 = [0, 0, c];
    // 体积 = |det(A-O, B-O, D-O)| / 6
    const volume = Math.abs(a * b * c) / 6;
    const faces: Array<[V3, V3, V3, string]> = [
      [O, A, B, C.accent],
      [O, B, D, C.green],
      [O, D, A, C.cool],
      [A, B, D, C.warm],
    ];
    interface PFace { pts: Array<[number, number]>; depth: number; color: string }
    const list: PFace[] = faces.map(([p, q, r, color]) => {
      const pp = proj3(p, ay, ax, scale, cx, cy);
      const qq = proj3(q, ay, ax, scale, cx, cy);
      const rr = proj3(r, ay, ax, scale, cx, cy);
      return { pts: [[pp[0], pp[1]], [qq[0], qq[1]], [rr[0], rr[1]]], depth: (pp[2] + qq[2] + rr[2]) / 3, color };
    });
    list.sort((p, q) => p.depth - q.depth);
    list.forEach((face) => poly(f, face.pts, { fill: `${face.color}44`, stroke: face.color, lw: 1.8, close: true }));
    [O, A, B, D].forEach((p) => {
      const pp = proj3(p, ay, ax, scale, cx, cy);
      dot(f, pp[0], pp[1], 4, C.fg);
    });

    footnotes(f, [
      `以原点出发的三条棱长 ${a}、${b}、${c}（两两垂直）：体积 = abc/6 = ${volume.toFixed(4)}`,
      '一般四面体：V = |det(A−D, B−D, C−D)| / 6 —— 体积就是"行列式"的几何意义',
      '体积与坐标无关（平移旋转不变），因此行列式的绝对值是"有向体积"的自然度量',
    ]);
    heading(f, '四面体体积与行列式');
  },
});

/** P67 开普勒轨道。 */
const keplerOrbit = defineViz({
  slug: 'kepler-orbit',
  title: '开普勒轨道',
  params: {
    e: { type: 'range', min: 0, max: 0.85, default: 0.55, step: 0.05, label: '离心率 e' },
    speed: { type: 'range', min: 0.05, max: 0.5, default: 0.2, step: 0.05, label: '公转速度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const ecc = num(params, 'e', 0.55);
    const speed = num(params, 'speed', 0.2);
    // 半长轴 1，焦点在原点：r = a(1-e²)/(1 + e cos θ)
    const a = 1;
    const b = a * Math.sqrt(1 - ecc * ecc);
    const c = a * ecc;
    const scale = Math.min(w * 0.55, h * 0.75) / 1.6;
    const cx = w * 0.55;
    const cy = h / 2 + 6;
    // 轨道
    const orbit: Array<[number, number]> = [];
    for (let i = 0; i <= 200; i++) {
      const t = (i / 200) * Math.PI * 2;
      orbit.push([cx + (-c + a * Math.cos(t)) * scale, cy - b * Math.sin(t) * scale]);
    }
    poly(f, orbit, { stroke: C.dim, lw: 1.6 });
    // 太阳（焦点）
    dot(f, cx, cy, 7, C.warm);
    // 扫过相等面积的扇形（开普勒第二定律）
    const sweepArea = (theta0: number): void => {
      const pts: Array<[number, number]> = [];
      const steps = 30;
      for (let i = 0; i <= steps; i++) {
        const theta = theta0 + (i / steps) * speed * 3;
        const r = (a * (1 - ecc * ecc)) / (1 + ecc * Math.cos(theta));
        const x = r * Math.cos(theta) - c;
        const y = r * Math.sin(theta);
        pts.push([cx + x * scale, cy - y * scale]);
      }
      pts.push([cx, cy]);
      poly(f, pts, { fill: 'rgba(102,126,234,0.3)', stroke: C.accent, lw: 1, close: true });
    };
    sweepArea(0.2);
    sweepArea(Math.PI - 0.1);
    // 行星位置
    const t0 = Math.PI / 2;
    const r0 = (a * (1 - ecc * ecc)) / (1 + ecc * Math.cos(t0));
    dot(f, cx + (r0 * Math.cos(t0) - c) * scale, cy - r0 * Math.sin(t0) * scale, 5, C.cool);

    footnotes(f, [
      `椭圆轨道（离心率 ${ecc}）：太阳位于一个焦点（橙点），不是中心`,
      '开普勒第二定律（面积律）：图中两块阴影在相同时间内扫过 —— 近日点附近跑得快、远日点慢',
      '开普勒第三定律：T² ∝ a³；牛顿用万有引力定律证明了这三条经验定律',
    ]);
    heading(f, '开普勒轨道与面积定律');
  },
});

/** P68 三体问题。 */
const threeBody = defineViz({
  slug: 'three-body',
  title: '三体问题',
  params: {
    mass1: { type: 'range', min: 0.5, max: 2, default: 1, step: 0.1, label: '天体 1 质量' },
    mass2: { type: 'range', min: 0.5, max: 2, default: 1, step: 0.1, label: '天体 2 质量' },
    mass3: { type: 'range', min: 0.5, max: 2, default: 1, step: 0.1, label: '天体 3 质量' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const m = [num(params, 'mass1', 1), num(params, 'mass2', 1), num(params, 'mass3', 1)];
    const scale = Math.min(w, h) / 5;
    const cx = w / 2;
    const cy = h / 2 + 6;
    // 初始条件：近似八字形轨道（Chenciner-Montgomery）
    const pos: Array<[number, number]> = [[0.97, 0], [-0.97, 0], [0, 0]];
    const vel: Array<[number, number]> = [[0.34, 0.54], [0.34, 0.54], [-0.68, -1.08]];
    const trails: Array<Array<[number, number]>> = [[], [], []];
    const dt = 0.004;
    for (let step = 0; step < 2600; step++) {
      const acc: Array<[number, number]> = [[0, 0], [0, 0], [0, 0]];
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          if (i === j) continue;
          const dx = pos[j][0] - pos[i][0];
          const dy = pos[j][1] - pos[i][1];
          const dist2 = dx * dx + dy * dy + 0.01;
          const f2 = (m[j] * dx) / Math.pow(dist2, 1.5);
          const g2 = (m[j] * dy) / Math.pow(dist2, 1.5);
          acc[i][0] += f2;
          acc[i][1] += g2;
        }
      }
      for (let i = 0; i < 3; i++) {
        vel[i][0] += acc[i][0] * dt;
        vel[i][1] += acc[i][1] * dt;
        pos[i][0] += vel[i][0] * dt;
        pos[i][1] += vel[i][1] * dt;
      }
      if (step % 6 === 0) for (let i = 0; i < 3; i++) trails[i].push([cx + pos[i][0] * scale, cy - pos[i][1] * scale]);
    }
    trails.forEach((tr, i) => poly(f, tr, { stroke: `${PALETTE[i % PALETTE.length]}cc`, lw: 1.4 }));
    pos.forEach((p, i) => dot(f, cx + p[0] * scale, cy - p[1] * scale, 6, PALETTE[i % PALETTE.length]));

    footnotes(f, [
      `三体问题（质量 ${m.join(':')}）：牛顿引力下三个天体的运动`,
      '图中是著名的"八字形解"（2000 年由 Chenciner 与 Montgomery 证明存在）：三个等质量天体沿同一条 8 字曲线追逐',
      '三体问题没有通解（庞加莱证明）：一般情形只能数值求解，且对初值极度敏感（混沌）',
    ]);
    heading(f, '三体问题：八字形解');
  },
});

/** P69 N 体模拟。 */
const nbodySimulation = defineViz({
  slug: 'nbody-simulation',
  title: 'N体模拟',
  params: {
    count: { type: 'range', min: 10, max: 120, default: 60, step: 5, label: '天体数' },
    steps: { type: 'range', min: 100, max: 800, default: 400, step: 50, label: '模拟步数' },
    softening: { type: 'range', min: 0.02, max: 0.3, default: 0.08, step: 0.01, label: '软化因子 ε' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const count = Math.round(num(params, 'count', 60));
    const steps = Math.round(num(params, 'steps', 400));
    const eps = num(params, 'softening', 0.08);
    const rand = rng(20240607);
    const scale = Math.min(w, h) / 3.2;
    const cx = w / 2;
    const cy = h / 2 + 6;
    const pos: Array<[number, number]> = [];
    const vel: Array<[number, number]> = [];
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(rand()) * 1.2;
      const a = rand() * Math.PI * 2;
      pos.push([r * Math.cos(a), r * Math.sin(a) * 0.7]);
      // 近似圆轨道速度
      vel.push([-pos[i][1] * 1.1, pos[i][0] * 1.1]);
    }
    const dt = 0.004;
    for (let step = 0; step < steps; step++) {
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const dx = pos[j][0] - pos[i][0];
          const dy = pos[j][1] - pos[i][1];
          const d2 = dx * dx + dy * dy + eps * eps;
          const inv = 1 / (d2 * Math.sqrt(d2));
          const fx = dx * inv;
          const fy = dy * inv;
          vel[i][0] += fx * dt;
          vel[i][1] += fy * dt;
          vel[j][0] -= fx * dt;
          vel[j][1] -= fy * dt;
        }
      }
      for (let i = 0; i < count; i++) {
        pos[i][0] += vel[i][0] * dt;
        pos[i][1] += vel[i][1] * dt;
      }
    }
    pos.forEach((p, i) => {
      const speed = Math.hypot(vel[i][0], vel[i][1]);
      dot(f, cx + p[0] * scale, cy - p[1] * scale, 2.6, `hsl(${200 + Math.min(1, speed * 3) * 100}, 70%, 60%)`);
    });

    footnotes(f, [
      `${count} 个自引力质点演化 ${steps} 步（软化因子 ε = ${eps}）`,
      '软化因子避免"两体距离趋零时力发散"的数值奇点 —— 这是 N 体模拟的标准技巧',
      '直接计算需要 O(N²) 次力计算；Barnes-Hut 树算法把它降到 O(N log N)（正是 KD 树的应用）',
    ]);
    heading(f, 'N 体引力模拟');
  },
});

/** P70 阻尼振动。 */
const dampedOscillation = defineViz({
  slug: 'damped-oscillation',
  title: '阻尼振动',
  params: {
    zeta: { type: 'range', min: 0, max: 2, default: 0.25, step: 0.05, label: '阻尼比 ζ' },
    omega: { type: 'range', min: 0.5, max: 4, default: 2, step: 0.1, label: '固有频率 ω₀' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const zeta = num(params, 'zeta', 0.25);
    const omega = num(params, 'omega', 2);
    const v = view(f, { xMin: 0, xMax: 10, yMin: -1.4, yMax: 1.4, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });
    // x(t) 解
    const x = (t: number): number => {
      if (zeta < 1) {
        const wd = omega * Math.sqrt(1 - zeta * zeta);
        return Math.exp(-zeta * omega * t) * Math.cos(wd * t);
      }
      if (Math.abs(zeta - 1) < 1e-6) return (1 + omega * t) * Math.exp(-omega * t);
      const r1 = -omega * (zeta - Math.sqrt(zeta * zeta - 1));
      const r2 = -omega * (zeta + Math.sqrt(zeta * zeta - 1));
      return (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
    };
    curve(f, v, x, { color: C.accent, lw: 2.6, samples: 600 });
    // 包络
    for (const sign of [1, -1]) {
      curve(f, v, (t) => sign * Math.exp(-zeta * omega * t), { color: `${C.warm}88`, lw: 1.4, dash: [5, 4] });
    }
    // 对比其他阻尼比
    [0.05, 0.7, 1.5].forEach((alt, i) => {
      const xa = (t: number): number => {
        if (alt < 1) {
          const wd = omega * Math.sqrt(1 - alt * alt);
          return Math.exp(-alt * omega * t) * Math.cos(wd * t);
        }
        const r1 = -omega * (alt - Math.sqrt(alt * alt - 1));
        const r2 = -omega * (alt + Math.sqrt(alt * alt - 1));
        return (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
      };
      curve(f, v, xa, { color: `${PALETTE[i + 2]}55`, lw: 1.2 });
    });

    const regime = zeta < 0.999 ? '欠阻尼（振荡衰减）' : zeta > 1.001 ? '过阻尼（缓慢回零）' : '临界阻尼（最快回零且不振荡）';
    footnotes(f, [
      `阻尼比 ζ = ${zeta}、固有频率 ω₀ = ${omega} ⇒ ${regime}`,
      '橙色虚线是包络 e^(-ζω₀t)：振幅按指数衰减，周期为 2π/(ω₀√(1−ζ²))',
      '临界阻尼（ζ = 1）是"最快回到平衡位置且不过冲"的状态 —— 汽车减震、门闭门器都调到此点',
    ]);
    heading(f, `阻尼振动：${regime}`);
  },
});

/** P71 悬链线。 */
const catenary = defineViz({
  slug: 'catenary',
  title: '悬链线',
  params: {
    a: { type: 'range', min: 0.3, max: 2, default: 0.8, step: 0.05, label: '参数 a' },
    span: { type: 'range', min: 2, max: 8, default: 5, step: 0.5, label: '跨度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 0.8);
    const span = num(params, 'span', 5);
    const cat = (x: number): number => a * Math.cosh(x / a) - a;
    const v = view(f, { xMin: -span / 2 - 0.5, xMax: span / 2 + 0.5, yMin: -0.3, yMax: cat(span / 2) * 1.15 + 0.3, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });
    curve(f, v, cat, { color: C.accent, lw: 2.6, samples: 500 });
    // 抛物线对比（相同端点与顶点）
    const parabA = cat(span / 2) / Math.pow(span / 2, 2);
    curve(f, v, (x) => parabA * x * x, { color: `${C.warm}99`, lw: 1.6, dash: [6, 4] });
    // 悬挂点
    for (const s of [-1, 1]) dot(f, v.sx((s * span) / 2), v.sy(cat(span / 2)), 5, C.warm);

    const arcLen = 2 * a * Math.sinh(span / (2 * a));
    footnotes(f, [
      `悬链线 y = a·cosh(x/a) − a（a = ${a}，跨度 ${span}）：弧长 = 2a·sinh(L/2a) = ${arcLen.toFixed(4)}`,
      '橙色虚线是同样端点与顶点的抛物线 —— 两者很接近但不重合（悬链线略"瘦"）',
      '悬链线是"自重均匀的绳子"的平衡形状（最小势能）；抛物线的假设是"载荷均匀分布在水平投影上"（如吊桥）',
    ]);
    heading(f, '悬链线 vs 抛物线');
  },
});

/** P72 最速降线。 */
const brachistochrone = defineViz({
  slug: 'brachistochrone',
  title: '最速降线',
  params: {
    endX: { type: 'range', min: 1, max: 5, default: 3, step: 0.25, label: '终点横坐标' },
    endY: { type: 'range', min: 1, max: 5, default: 2.5, step: 0.25, label: '终点纵坐标' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const ex = num(params, 'endX', 3);
    const ey = num(params, 'endY', 2.5);
    const v = view(f, { xMin: -0.4, xMax: ex + 0.6, yMin: -0.4, yMax: ey + 0.6, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });
    // 直线
    poly(f, [[v.sx(0), v.sy(0)], [v.sx(ex), v.sy(ey)]], { stroke: `${C.dim}aa`, lw: 1.8, dash: [5, 4] });
    // 摆线（最速降线）：x = R(θ - sin θ), y = R(1 - cos θ)
    // 求 R 使终点落在给定点
    let bestR = 1;
    let bestErr = Infinity;
    for (let R = 0.2; R < 8; R += 0.02) {
      for (let theta = 0.4; theta < Math.PI * 2; theta += 0.05) {
        const px = R * (theta - Math.sin(theta));
        const py = R * (1 - Math.cos(theta));
        const err = Math.hypot(px - ex, py - ey);
        if (err < bestErr) {
          bestErr = err;
          bestR = R;
        }
      }
    }
    let bestTheta = 0;
    let bestErr2 = Infinity;
    for (let theta = 0.4; theta < Math.PI * 2; theta += 0.01) {
      const px = bestR * (theta - Math.sin(theta));
      const py = bestR * (1 - Math.cos(theta));
      const err = Math.hypot(px - ex, py - ey);
      if (err < bestErr2) {
        bestErr2 = err;
        bestTheta = theta;
      }
    }
    const cyc: Array<[number, number]> = [];
    for (let t = 0; t <= bestTheta; t += bestTheta / 120) {
      cyc.push([v.sx(bestR * (t - Math.sin(t))), v.sy(bestR * (1 - Math.cos(t)))]);
    }
    poly(f, cyc, { stroke: C.accent, lw: 2.6 });
    dot(f, v.sx(0), v.sy(0), 5, C.green);
    dot(f, v.sx(ex), v.sy(ey), 5, C.hot);
    // 时间对比：摆线更快
    const g2 = 9.8;
    const timeOf = (path: Array<[number, number]>): number => {
      let t = 0;
      for (let i = 1; i < path.length; i++) {
        const dx = path[i][0] - path[i - 1][0];
        const dy = path[i][1] - path[i - 1][1];
        const ds = Math.hypot(dx, dy);
        const vAvg = Math.sqrt(Math.max(0.01, 2 * g2 * (path[i - 1][1] + dy / 2)));
        t += ds / vAvg;
      }
      return t;
    };
    const straightPath: Array<[number, number]> = Array.from({ length: 100 }, (_, i) => [(ex * i) / 100, (ey * i) / 100]);
    const cycReal: Array<[number, number]> = [];
    for (let t = 0; t <= bestTheta; t += bestTheta / 120) cycReal.push([bestR * (t - Math.sin(t)), bestR * (1 - Math.cos(t))]);
    const tStraight = timeOf(straightPath);
    const tCycloid = timeOf(cycReal);

    footnotes(f, [
      `最速降线（摆线，蓝）比直线（灰虚线）更快：${tCycloid.toFixed(4)} s vs ${tStraight.toFixed(4)} s`,
      '伯努利 1696 年提出：重力下从 A 滑到 B 最快的曲线不是直线，而是摆线（旋轮线）',
      '这个问题催生了变分法：欧拉-拉格朗日方程给出了求"泛函极值"的通用方法',
    ]);
    heading(f, '最速降线：摆线最快');
  },
});

/** P73 螺旋面与悬链面。 */
const helicoidCatenoid = defineViz({
  slug: 'helicoid-catenoid',
  title: '螺旋面-悬链面',
  params: {
    morph: { type: 'range', min: 0, max: 1, default: 0.5, step: 0.05, label: '形变参数 t（0=悬链面，1=螺旋面）' },
    twists: { type: 'range', min: 0.5, max: 3, default: 1.4, step: 0.1, label: '螺旋圈数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const t = num(params, 'morph', 0.5);
    const twists = num(params, 'twists', 1.4);
    const scale = Math.min(w, h) / 5;
    const cx = w / 2;
    const cy = h / 2 + 6;
    // 螺旋面 (u cos v, c u, u sin v) 与 悬链面 (cosh u cos v, u, cosh u sin v) 之间的等距形变
    renderSurface(f, (u, v) => {
      const uu = (u - 0.5) * 2;
      const vv = v * Math.PI * 2;
      // 螺旋面参数
      const helicoid: V3 = [uu * Math.cos(vv * twists), uu * 0.8, uu * Math.sin(vv * twists)];
      // 悬链面参数
      const cu = Math.cosh(uu * 1.1);
      const catenoid: V3 = [cu * Math.cos(vv), uu * 1.1, cu * Math.sin(vv)];
      return [(1 - t) * catenoid[0] + t * helicoid[0], (1 - t) * catenoid[1] + t * helicoid[1], (1 - t) * catenoid[2] + t * helicoid[2]];
    }, { uMin: -0.85, uMax: 0.85, vMin: 0, vMax: 1, uSteps: 26, vSteps: 60, scale, hue: (u, v) => 200 + v * 120, faceAlpha: 0.9 }, cx, cy);

    footnotes(f, [
      `形变参数 t = ${t}：在悬链面（t=0）与螺旋面（t=1）之间连续变形，过程中高斯曲率处处为 0`,
      '这是极小曲面中最有名的"等距形变"（Associate family，由 Meusnier 与 Bonnet 给出）',
      '两者局部可以互相"弯曲"得到（都是直纹可展曲面），但不拉伸：肥皂膜可以连续变成螺旋面',
    ]);
    heading(f, '螺旋面 ⇄ 悬链面：等距形变');
  },
});

/** P74 振动弦。 */
const vibratingString = defineViz({
  slug: 'vibrating-string',
  title: '振动弦',
  params: {
    mode: { type: 'range', min: 1, max: 5, default: 3, label: '模态 n' },
    harmonics: { type: 'range', min: 1, max: 5, default: 2, label: '叠加谐波数' },
    time: { type: 'range', min: 0, max: 1, default: 0.3, step: 0.02, label: '时刻 t' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = Math.round(num(params, 'mode', 3));
    const harmonics = Math.round(num(params, 'harmonics', 2));
    const t = num(params, 'time', 0.3);
    const v = view(f, { xMin: 0, xMax: 1, yMin: -1.5, yMax: 1.5, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });
    seg(f, v.sx(0), v.sy(0), v.sx(1), v.sy(0), C.dim, 1.2);
    // 各阶模态
    for (let n = 1; n <= harmonics; n++) {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 200; i++) {
        const x = i / 200;
        pts.push([v.sx(x), v.sy(Math.sin(n * Math.PI * x) * Math.cos(n * Math.PI * t * 2) * (0.9 / n))]);
      }
      poly(f, pts, { stroke: `${PALETTE[n % PALETTE.length]}88`, lw: 1.4, dash: [5, 4] });
    }
    // 合成波形
    const combined: Array<[number, number]> = [];
    for (let i = 0; i <= 300; i++) {
      const x = i / 300;
      let y = 0;
      for (let n = 1; n <= harmonics; n++) y += (Math.sin(n * Math.PI * x) * Math.cos(n * Math.PI * t * 2)) / n;
      combined.push([v.sx(x), v.sy(y * 0.8)]);
    }
    poly(f, combined, { stroke: C.accent, lw: 2.6 });
    // 节点（第 mode 阶）
    for (let k = 0; k <= mode; k++) dot(f, v.sx(k / mode), v.sy(0), 4, C.hot);

    footnotes(f, [
      `第 ${mode} 阶模态有 ${mode + 1} 个节点（红点），频率是基频的 ${mode} 倍`,
      `弦振动是各阶驻波的叠加：y(x,t) = Σ aₙ sin(nπx)cos(nπct)，蓝色是前 ${harmonics} 阶的叠加`,
      '这正是弦乐器音色的来源：基频决定音高，各谐波的相对强度决定音色（小提琴与钢琴的差别）',
    ]);
    heading(f, '振动弦：模态与叠加');
  },
});

/** P75 空间曲线 Frenet 标架。 */
const spaceCurveFrenet = defineViz({
  slug: 'space-curve-frenet',
  title: '空间曲线Frenet标架',
  params: {
    curve: { type: 'select', options: ['螺线', '三叶曲线', '扭曲曲线'], default: '螺线', label: '空间曲线' },
    t0: { type: 'range', min: 0, max: 6, default: 2, step: 0.1, label: '考察参数 t' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const curveKind = str(params, 'curve', '螺线');
    const t0 = num(params, 't0', 2);
    const sc = Math.min(w, h) / 6;
    const cx = w / 2;
    const cy = h / 2 + 6;
    const ay = 0.6;
    const ax = 0.42;
    const pt = (t: number): V3 => curveKind.startsWith('螺线')
      ? [Math.cos(t * 1.2), t * 0.35 - 1, Math.sin(t * 1.2)]
      : curveKind.startsWith('三叶')
        ? [Math.sin(t) + 2 * Math.sin(2 * t), Math.cos(t) - 2 * Math.cos(2 * t), -Math.sin(3 * t)]
        : [Math.sin(t * 1.4), t * 0.3 - 0.8, Math.cos(t * 2.1)];
    // 曲线
    const pts: Array<[number, number]> = [];
    for (let t = 0; t <= 6.3; t += 0.03) {
      const p = proj3(pt(t), ay, ax, sc, cx, cy);
      pts.push([p[0], p[1]]);
    }
    poly(f, pts, { stroke: C.dim, lw: 2 });
    // Frenet 标架
    const p0 = pt(t0);
    const p1 = pt(t0 + 0.02);
    const T: V3 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const tl = Math.hypot(T[0], T[1], T[2]) || 1;
    const Tn: V3 = [T[0] / tl, T[1] / tl, T[2] / tl];
    const p2 = pt(t0 - 0.02);
    const Tprev: V3 = [p0[0] - p2[0], p0[1] - p2[1], p0[2] - p2[2]];
    const prevLen = Math.hypot(Tprev[0], Tprev[1], Tprev[2]) || 1;
    const dT: V3 = [Tn[0] - Tprev[0] / prevLen, Tn[1] - Tprev[1] / prevLen, Tn[2] - Tprev[2] / prevLen];
    const dl = Math.hypot(dT[0], dT[1], dT[2]) || 1;
    const N: V3 = [dT[0] / dl, dT[1] / dl, dT[2] / dl];
    const B: V3 = [Tn[1] * N[2] - Tn[2] * N[1], Tn[2] * N[0] - Tn[0] * N[2], Tn[0] * N[1] - Tn[1] * N[0]];
    const base = proj3(p0, ay, ax, sc, cx, cy);
    const arrows: Array<[V3, string, string]> = [[Tn, C.hot, 'T'], [N, C.green, 'N'], [B, C.cool, 'B']];
    arrows.forEach(([dir, color, label]) => {
      const tip = proj3([p0[0] + dir[0] * 0.9, p0[1] + dir[1] * 0.9, p0[2] + dir[2] * 0.9], ay, ax, sc, cx, cy);
      seg(f, base[0], base[1], tip[0], tip[1], color, 2.4);
      text(f, label, tip[0] + 5, tip[1] - 3, { color, font: 'bold 12px sans-serif' });
    });
    dot(f, base[0], base[1], 5, C.warm);

    footnotes(f, [
      `Frenet 标架：切线 T（红）、主法线 N（绿）、副法线 B（蓝），三者两两正交构成活动坐标系`,
      '曲率 κ = |dT/ds| 描述"转弯的快慢"，挠率 τ = −(dB/ds)·N 描述"离开平面的倾向"',
      '这就是空间曲线的"内蕴几何"：曲线形状完全由 κ(s) 与 τ(s) 决定（Frenet 基本定理）',
    ]);
    heading(f, '空间曲线的 Frenet 标架');
  },
});

/** P63 环面纽结深化：不同 (p,q) 的拓扑对比。 */
const torusKnotSurfaceP63 = defineViz({
  slug: 'torus-knot-surface-p63',
  title: '环面纽结深化',
  params: {
    p: { type: 'range', min: 1, max: 9, default: 4, label: '经向圈数 p' },
    q: { type: 'range', min: 1, max: 9, default: 3, label: '纬向圈数 q' },
    tube: { type: 'range', min: 0.04, max: 0.22, default: 0.09, step: 0.01, label: '管半径' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const p = Math.round(num(params, 'p', 4));
    const q = Math.round(num(params, 'q', 3));
    const tube = num(params, 'tube', 0.09);
    let gcdVal = 1;
    for (let i = 1; i <= Math.min(p, q); i++) if (p % i === 0 && q % i === 0) gcdVal = i;
    // 交叉数（T(p,q) 的交叉数为 min((p-1)q, (q-1)p)）
    const crossings = Math.min((p - 1) * q, (q - 1) * p);
    torusKnotSurface(f, p, q, tube, 1.35, 0.45, Math.min(w, h) / 4.2, w / 2, h / 2 + 6, 190);

    footnotes(f, [
      `(${p},${q}) 环面纽结：${gcdVal === 1 ? '真正的纽结（单个环）' : `链环：${gcdVal} 个互相缠绕的环（因为 gcd(${p},${q}) = ${gcdVal}）`}`,
      `交叉数 = min((p−1)q, (q−1)p) = ${crossings} —— 这是该纽结"最简投影中交叉点个数"的下界`,
      '(p,q) 与 (q,p) 互为镜像；(2,3) 就是三叶结，是所有非平凡纽结中交叉数最少的（3 个交叉）',
    ]);
    heading(f, `环面纽结 (${p}, ${q}) 的拓扑`);
  },
});

registerViz(
  surfaceRevolution,
  tubeSurface,
  monkeySaddle,
  seashellSurface,
  whitneyUmbrella,
  sphericalHarmonics,
  torusKnotSurfaceViz,
  kleinBottleFigure8,
  developableSurface,
  torusKnotSurfaceP63,
  meanCurvatureFlow,
  solidAngle,
  tetrahedronVolume,
  keplerOrbit,
  threeBody,
  nbodySimulation,
  dampedOscillation,
  catenary,
  brachistochrone,
  helicoidCatenoid,
  vibratingString,
  spaceCurveFrenet,
);
