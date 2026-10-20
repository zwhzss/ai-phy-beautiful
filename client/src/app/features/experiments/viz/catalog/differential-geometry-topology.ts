import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, PALETTE, dot, footnotes, heading, poly, seg, text, vec } from '../canvas';
import { proj3, renderSurface, SurfOpts, V3 } from '../surface3d';

/** P01 微分几何入门。 */
const differentialGeometry = defineViz({
  slug: 'differential-geometry',
  title: '微分几何入门',
  params: {
    a: { type: 'range', min: 0.5, max: 2.5, default: 1.4, step: 0.1, label: '参数 a' },
    b: { type: 'range', min: 0.5, max: 2.5, default: 1, step: 0.1, label: '参数 b' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 1.4);
    const b = num(params, 'b', 1);
    // 环面：展示主曲率方向
    renderSurface(f, (u, v) => [
      (a + b * Math.cos(v)) * Math.cos(u),
      (a + b * Math.cos(v)) * Math.sin(u),
      b * Math.sin(v),
    ], { uMin: 0, uMax: Math.PI * 2, vMin: 0, vMax: Math.PI * 2, uSteps: 40, vSteps: 22, scale: Math.min(w, h) / 7, hue: (u) => 210 - (u / (Math.PI * 2)) * 120 }, w / 2, h / 2 + 6);

    footnotes(f, [
      `环面 S(u,v) = ((a + b·cos v)cos u, (a + b·cos v)sin u, b·sin v)，a = ${a}、b = ${b}`,
      '微分几何研究"曲面本身的几何"，而不依赖它如何嵌入空间：切平面、法曲率、测地线',
      '主曲率 κ₁、κ₂ 是法曲率的极值；外侧 κ > 0（凸）、内侧 κ < 0（凹）、上下缘有一个为 0',
    ]);
    heading(f, '参数曲面：环面');
  },
});

/** P02 高斯曲率。 */
const gaussianCurvature = defineViz({
  slug: 'gaussian-curvature',
  title: '高斯曲率',
  params: {
    kind: { type: 'select', options: ['球面（K>0）', '平面（K=0）', '鞍面（K<0）'], default: '鞍面（K<0）', label: '曲面' },
    scale: { type: 'range', min: 0.5, max: 2, default: 1.2, step: 0.1, label: '尺度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'kind', '鞍面（K<0）');
    const s = num(params, 'scale', 1.2);
    const fn = kind.startsWith('球面')
      ? (u: number, v: number): V3 => [s * Math.sin(u) * Math.cos(v), s * Math.cos(u), s * Math.sin(u) * Math.sin(v)]
      : kind.startsWith('平面')
        ? (u: number, v: number): V3 => [u * s, v * s, 0]
        : (u: number, v: number): V3 => [u * s, v * s, (u * u - v * v) * 0.5];
    const opts = kind.startsWith('球面')
      ? { uMin: 0, uMax: Math.PI, vMin: 0, vMax: Math.PI * 2, uSteps: 26, vSteps: 34 }
      : { uMin: -1.5, uMax: 1.5, vMin: -1.5, vMax: 1.5, uSteps: 26, vSteps: 26 };
    renderSurface(f, fn, { ...opts, scale: Math.min(w, h) / 6, hue: (u, v) => (kind.startsWith('球面') ? 200 : fn(u, v)[2] * 60 + 210) }, w / 2, h / 2 + 6);

    const K = kind.startsWith('球面') ? 1 / (s * s) : kind.startsWith('平面') ? 0 : -1;
    footnotes(f, [
      `${kind}：高斯曲率 K = ${K === 0 ? '0' : K.toFixed(4)}`,
      'K > 0：曲面"碗状"（两个方向同向弯曲，三角形内角和 > 180°）',
      '高斯绝妙定理（Theorema Egregium）：K 是内蕴量，只靠曲面上的测量就能确定，与嵌入方式无关',
    ]);
    heading(f, `高斯曲率：${kind}`);
  },
});

/** P03 莫比乌斯带。 */
const mobius = defineViz({
  slug: 'mobius',
  title: '莫比乌斯带',
  params: {
    width: { type: 'range', min: 0.2, max: 1, default: 0.5, step: 0.05, label: '带宽' },
    twists: { type: 'range', min: 0, max: 3, default: 1, label: '半扭转次数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const width = num(params, 'width', 0.5);
    const twists = Math.round(num(params, 'twists', 1));
    // 莫比乌斯带：(R + v·w/2·cos(tu/2), ...) 略带高度
    renderSurface(f, (u, v) => {
      const t = (twists * u) / 2;
      const r = 1.4 + (v * width * Math.cos(t)) / 2;
      return [r * Math.cos(u), r * Math.sin(u), (v * width * Math.sin(t)) / 2];
    }, {
      uMin: 0, uMax: Math.PI * 2, vMin: -1, vMax: 1, uSteps: 60, vSteps: 8,
      scale: Math.min(w, h) / 4.4,
      hue: (u) => (u / (Math.PI * 2)) * 300,
    }, w / 2, h / 2 + 6);

    footnotes(f, [
      `半扭转 ${twists} 次：${twists % 2 === 1 ? '莫比乌斯带（只有一个面、一条边）' : '普通环带（两个面、两条边）'}`,
      twists % 2 === 1 ? '沿着带子中线走一圈会走到"背面"，再走一圈才回到起点 —— 这就是"不可定向"' : '无扭转时是最普通的圆柱环，内外分明',
      '莫比乌斯带是最简单的不可定向曲面；它只有一个边界圆，且不能嵌入平面而不自交',
    ]);
    heading(f, `莫比乌斯带：扭转 ${twists} 次`);
  },
});

/** P04 三叶结曲面。 */
const trefoilSurface = defineViz({
  slug: 'trefoil-surface',
  title: '三叶结曲面',
  params: {
    tube: { type: 'range', min: 0.06, max: 0.4, default: 0.14, step: 0.01, label: '管半径' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const tube = num(params, 'tube', 0.14);
    // 三叶结曲线
    const curve = (t: number): V3 => [Math.sin(t) + 2 * Math.sin(2 * t), Math.cos(t) - 2 * Math.cos(2 * t), -Math.sin(3 * t)];
    renderSurface(f, (u, v) => {
      const p = curve(u);
      const p2 = curve(u + 0.02);
      const dx = p2[0] - p[0];
      const dy = p2[1] - p[1];
      const dz = p2[2] - p[2];
      const len = Math.hypot(dx, dy, dz) || 1;
      const T: V3 = [dx / len, dy / len, dz / len];
      // 与 z 轴叉乘得法向，再叉乘得副法向 —— 构成法平面的正交基
      const nRaw: V3 = [T[1], -T[0], 0];
      const nl = Math.hypot(nRaw[0], nRaw[1], nRaw[2]) || 1;
      const N: V3 = [nRaw[0] / nl, nRaw[1] / nl, nRaw[2] / nl];
      const B: V3 = [T[1] * N[2] - T[2] * N[1], T[2] * N[0] - T[0] * N[2], T[0] * N[1] - T[1] * N[0]];
      return [
        p[0] + tube * (Math.cos(v) * N[0] + Math.sin(v) * B[0]),
        p[1] + tube * (Math.cos(v) * N[1] + Math.sin(v) * B[1]),
        p[2] + tube * (Math.cos(v) * N[2] + Math.sin(v) * B[2]),
      ];
    }, { uMin: 0, uMax: Math.PI * 2, vMin: 0, vMax: Math.PI * 2, uSteps: 90, vSteps: 8, scale: Math.min(w, h) / 8, hue: (u) => 200 + (u / (Math.PI * 2)) * 130 }, w / 2, h / 2 + 6);

    footnotes(f, [
      '三叶结是最简单的非平凡纽结：无法在不剪断的情况下解成普通圆环',
      '管状邻域把"曲线"加粗成"曲面"，让纽结可以用曲面语言研究（管半径不影响纽结类型）',
      '纽结不变量（Jones 多项式、Alexander 多项式）用于区分不同的结 —— 也是拓扑量子计算的工具',
    ]);
    heading(f, '三叶结的管状曲面');
  },
});

/** P05 Costa 曲面。 */
const costaSurface = defineViz({
  slug: 'costa-surface',
  title: 'Costa曲面',
  params: {
    size: { type: 'range', min: 0.6, max: 1.6, default: 1, step: 0.1, label: '尺度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const s = num(params, 'size', 1);
    // Costa 曲面的参数近似（用 Weierstrass 表示的简化形式）
    renderSurface(f, (u, v) => {
      const uu = u;
      const vv = v;
      const aux = Math.cosh(2 * vv) - Math.cos(2 * uu);
      const x = (2 * Math.sin(2 * uu) * Math.sinh(vv) * Math.cosh(vv)) / aux;
      const y = (2 * Math.sin(2 * uu) * Math.sinh(2 * vv)) / aux;
      const z = (2 * Math.sin(2 * vv) * Math.cosh(vv)) / aux;
      return [x * s, z * s, y * s];
    }, {
      uMin: 0.001, uMax: Math.PI - 0.001, vMin: -1.6, vMax: 1.6, uSteps: 40, vSteps: 34,
      scale: Math.min(w, h) / 2.6,
      hue: (u, v) => 200 + v * 30,
      faceAlpha: 0.9,
    }, w / 2, h / 2 + 6);

    footnotes(f, [
      'Costa 曲面：第一个被发现的新极小曲面（1984 年），亏格 1、有三个端点',
      '极小曲面处处平均曲率为 0（局部面积最小），肥皂膜就自发形成这类形状',
      'Costa 曲面后由 Hoffman-Meeks 推广为无限族，其存在性曾是几何分析的著名难题',
    ]);
    heading(f, 'Costa 极小曲面');
  },
});

/** P06 Enneper 曲面。 */
const enneperSurface = defineViz({
  slug: 'enneper-surface',
  title: 'Enneper曲面',
  params: {
    range: { type: 'range', min: 1, max: 2.6, default: 1.8, step: 0.1, label: '参数范围' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const r = num(params, 'range', 1.8);
    renderSurface(f, (u, v) => {
      const x = u - (u * u * u) / 3 + u * v * v;
      const y = v - (v * v * v) / 3 + v * u * u;
      const z = u * u - v * v;
      return [x, z, y];
    }, { uMin: -r, uMax: r, vMin: -r, vMax: r, uSteps: 44, vSteps: 44, scale: Math.min(w, h) / 9, hue: (u, v) => 190 + (u + v) * 35 }, w / 2, h / 2 + 6);

    footnotes(f, [
      'Enneper 曲面：极小子曲面，自交但局部面积最小（自交处不是极小曲面的一部分）',
      '参数方程：x = u - u³/3 + uv²，y = v - v³/3 + vu²，z = u² - v²',
      '极小曲面与复分析深度相关：每个极小曲面都由一对共形映射（Weierstrass 表示）生成',
    ]);
    heading(f, 'Enneper 曲面');
  },
});

/** P07 Dini 曲面。 */
const diniSurface = defineViz({
  slug: 'dini-surface',
  title: 'Dini曲面',
  params: {
    a: { type: 'range', min: 0.2, max: 1.5, default: 0.6, step: 0.05, label: '参数 a' },
    b: { type: 'range', min: 0.5, max: 2.5, default: 1.2, step: 0.1, label: '参数 b' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 0.6);
    const b = num(params, 'b', 1.2);
    renderSurface(f, (u, v) => {
      const cu = Math.cosh(u);
      return [a * Math.sin(u) * Math.cos(v) * cu, a * Math.sin(u) * Math.sin(v) * cu, a * (Math.cos(u) + Math.log(Math.tan(u / 2 + Math.PI / 4)))] as V3;
    }, {
      uMin: 0.15, uMax: 1.6, vMin: 0, vMax: Math.PI * 2 * b, uSteps: 26, vSteps: 60,
      scale: Math.min(w, h) / 4.6,
      hue: (u, v) => 200 + (v / (Math.PI * 2)) * 120,
    }, w / 2, h / 2 + 6);

    footnotes(f, [
      `Dini 曲面（a = ${a}、b = ${b}）：常负高斯曲率的螺旋面`,
      '它有"伪球面"的形状：像喇叭一样无限延伸，但每一点的曲率恒定',
      '常负曲率曲面的内蕴几何是双曲几何 —— 可以在物理曲面上"演示"非欧几何',
    ]);
    heading(f, 'Dini 曲面');
  },
});

/** P08 罗马曲面。 */
const romanSurface = defineViz({
  slug: 'roman-surface',
  title: '罗马曲面',
  params: {
    range: { type: 'range', min: 0.4, max: 1, default: 1, step: 0.05, label: '投影范围' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const r = num(params, 'range', 1);
    // Steiner 罗马曲面（球面在中心投影下的像）
    renderSurface(f, (u, v) => {
      const theta = u;
      const phi = v;
      const sTheta = Math.sin(theta);
      const x = sTheta * sTheta * Math.sin(2 * phi) * 0.5;
      const y = sTheta * sTheta * Math.cos(2 * phi) * 0.5;
      const z = sTheta * Math.cos(theta) * Math.cos(phi) * 0.7;
      return [x * r, z * r, y * r];
    }, { uMin: 0, uMax: Math.PI, vMin: 0, vMax: Math.PI, uSteps: 40, vSteps: 60, scale: Math.min(w, h) / 2.6, hue: (u, v) => 220 + v * 20, faceAlpha: 0.88 }, w / 2, h / 2 + 6);

    footnotes(f, [
      '罗马曲面（Steiner 曲面）：把实射影平面 RP² 浸入三维空间的最简单例子',
      '它有三条二重交线、六个捏点（pinch point）—— 浸入但不嵌入（必然自交）',
      '射影平面不能无自交地嵌入三维空间（Whitney 定理）：这是拓扑对几何的强约束',
    ]);
    heading(f, '罗马曲面');
  },
});

/** P09 交叉帽。 */
const crossCap = defineViz({
  slug: 'cross-cap',
  title: '交叉帽',
  params: {
    size: { type: 'range', min: 0.5, max: 1.5, default: 1, step: 0.1, label: '尺度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const s = num(params, 'size', 1);
    renderSurface(f, (u, v) => {
      const uu = (u - 0.5) * Math.PI;
      const vv = (v - 0.5) * Math.PI * 2;
      const cu = Math.cos(uu);
      const su = Math.sin(uu);
      const sv = Math.sin(vv);
      const cv = Math.cos(vv);
      return [su * sv * s, (1 - 2 * cu * cu * cv * cv) * s * 0.7, cu * cv * s];
    }, { uMin: 0, uMax: 1, vMin: 0, vMax: 1, uSteps: 40, vSteps: 60, scale: Math.min(w, h) / 2.4, hue: (u) => 250 + u * 60, faceAlpha: 0.9 }, w / 2, h / 2 + 6);

    footnotes(f, [
      '交叉帽：射影平面在三维中另一种标准浸入，形似"帽子 + 自相交的圆盘"',
      '图中所有点都在曲面上，但看起来"穿过自身"的那一圈实际上只是投影造成的错觉',
      '交叉帽与罗马曲面、Boy 曲面都是 RP² 的浸入 —— 它们拓扑等价，只是形状不同',
    ]);
    heading(f, '交叉帽');
  },
});

/** P10 Boy 曲面。 */
const boySurface = defineViz({
  slug: 'boy-surface',
  title: 'Boy曲面',
  params: {
    size: { type: 'range', min: 0.6, max: 1.4, default: 1, step: 0.1, label: '尺度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const s = num(params, 'size', 1);
    renderSurface(f, (u, v) => {
      // Boy 曲面的 Bryant-Kusner 参数化（简化）
      const theta = u;
      const phi = v;
      const ct = Math.cos(theta);
      const cp = Math.cos(phi);
      const denom2 = 2 - Math.sqrt(2) * Math.sin(2 * theta) * Math.sin(phi) + Math.sqrt(2) * Math.cos(theta) * Math.cos(theta) * Math.cos(2 * phi);
      const d = Math.abs(denom2) < 0.1 ? 0.1 : denom2;
      const x = (Math.sqrt(2) * Math.cos(2 * theta) * cp * cp + Math.cos(theta) * Math.sin(2 * phi)) / d;
      const y = (Math.sqrt(2) * Math.sin(2 * theta) * cp * cp - Math.sin(theta) * Math.sin(2 * phi)) / d;
      const z = (3 * cp * cp) / d;
      return [x * s * 1.2, z * s * 1.2 - 0.6, y * s * 1.2];
    }, { uMin: 0, uMax: Math.PI, vMin: -Math.PI / 2, vMax: Math.PI / 2, uSteps: 44, vSteps: 40, scale: Math.min(w, h) / 3.6, hue: (u, v) => 200 + v * 40, faceAlpha: 0.92 }, w / 2, h / 2 + 6);

    footnotes(f, [
      'Boy 曲面：射影平面 RP² 的一种光滑浸入（无尖点，只有自交曲线）',
      '它由 Werner Boy 于 1901 年发现，是"无奇点的 RP² 浸入"的第一个例子',
      '三种 RP² 浸入（罗马曲面、交叉帽、Boy 曲面）几何上互不相同，但拓扑等价 —— 拓扑不变量才是不变的',
    ]);
    heading(f, 'Boy 曲面');
  },
});

/** P11 双曲抛物面。 */
const hyperbolicParaboloid = defineViz({
  slug: 'hyperbolic-paraboloid',
  title: '双曲抛物面',
  params: {
    a: { type: 'range', min: 0.2, max: 1.5, default: 0.7, step: 0.05, label: '曲率参数' },
    showLines: { type: 'select', options: ['显示直纹', '隐藏'], default: '显示直纹', label: '直母线' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 0.7);
    const showLines = str(params, 'showLines', '显示直纹') === '显示直纹';
    const cxv = w / 2;
    const cyv = h / 2 + 6;
    const scale = Math.min(w, h) / 5.5;
    const ay = 0.6;
    const ax = 0.45;
    renderSurface(f, (u, v) => [u, a * (u * u - v * v), v], {
      uMin: -1.5, uMax: 1.5, vMin: -1.5, vMax: 1.5, uSteps: 28, vSteps: 28, scale,
      hue: (u, v) => 210 + (u * u - v * v) * 50,
      faceAlpha: 0.9,
    }, cxv, cyv);

    // 直母线：z = a(u²-v²) 上有两族直线
    if (showLines) {
      for (let k = -6; k <= 6; k++) {
        const t = k / 5;
        const line: Array<[number, number]> = [];
        for (let i = 0; i <= 20; i++) {
          const u = -1.5 + (3 * i) / 20;
          const v = u + t;
          if (Math.abs(v) > 1.5) continue;
          const p = proj3([u, a * (u * u - v * v), v], ay, ax, scale, cxv, cyv);
          line.push([p[0], p[1]]);
        }
        if (line.length > 1) poly(f, line, { stroke: 'rgba(245,200,101,0.75)', lw: 1.2 });
        const line2: Array<[number, number]> = [];
        for (let i = 0; i <= 20; i++) {
          const u = -1.5 + (3 * i) / 20;
          const v = -u + t;
          if (Math.abs(v) > 1.5) continue;
          const p = proj3([u, a * (u * u - v * v), v], ay, ax, scale, cxv, cyv);
          line2.push([p[0], p[1]]);
        }
        if (line2.length > 1) poly(f, line2, { stroke: 'rgba(101,200,245,0.7)', lw: 1.2 });
      }
    }

    footnotes(f, [
      `双曲抛物面 z = ${a}(x² - y²)：马鞍形状，高斯曲率处处为负`,
      '它虽然弯曲，却完全由直线构成（直纹面）：两族直母线各自落在曲面上',
      '因此建筑上用"直梁"就能造出双曲抛物面屋顶（如著名的"马鞍形"体育场）',
    ]);
    heading(f, '双曲抛物面（马鞍面）');
  },
});

/** P12 二次曲面族。 */
const quadricSurfaces = defineViz({
  slug: 'quadric-surfaces',
  title: '二次曲面族',
  params: {
    kind: { type: 'select', options: ['椭球面', '单叶双曲面', '双叶双曲面', '椭圆抛物面'], default: '单叶双曲面', label: '曲面' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'kind', '单叶双曲面');
    const scale = Math.min(w, h) / (kind === '双叶双曲面' ? 3.4 : 4.4);
    let fn: (u: number, v: number) => V3;
    let opts: SurfOpts;
    if (kind === '椭球面') {
      fn = (u, v) => [Math.sin(u) * Math.cos(v), 1.4 * Math.cos(u), Math.sin(u) * Math.sin(v)];
      opts = { uMin: 0, uMax: Math.PI, vMin: 0, vMax: Math.PI * 2, uSteps: 26, vSteps: 44, scale, hue: (u, v) => 210 + v * 15 };
    } else if (kind === '单叶双曲面') {
      fn = (u, v) => [Math.cosh(u) * Math.cos(v), Math.sinh(u), Math.cosh(u) * Math.sin(v)];
      opts = { uMin: -1.4, uMax: 1.4, vMin: 0, vMax: Math.PI * 2, uSteps: 24, vSteps: 48, scale, hue: (u, v) => 195 + u * 40 };
    } else if (kind === '双叶双曲面') {
      fn = (u, v) => [Math.sinh(u) * Math.cos(v), Math.cosh(u) * (u > 0 ? 1 : -1), Math.sinh(u) * Math.sin(v)];
      opts = { uMin: 0.001, uMax: 1.8, vMin: 0, vMax: Math.PI * 2, uSteps: 20, vSteps: 44, scale, hue: (u, v) => 240 + u * 30 };
    } else {
      fn = (u, v) => [u, u * u + v * v * 0.6, v];
      opts = { uMin: -1.4, uMax: 1.4, vMin: -1.4, vMax: 1.4, uSteps: 26, vSteps: 26, scale, hue: (u, v) => 200 + (u * u + v * v) * 30 };
    }
    renderSurface(f, fn, opts, w / 2, h / 2 + 6);

    const desc: Record<string, string> = {
      '椭球面': 'x²/a² + y²/b² + z²/c² = 1：有界、闭合，高斯曲率处处为正',
      '单叶双曲面': 'x²/a² + y²/b² - z²/c² = 1：连通、直纹（可以用直线织出曲面），曲率符号混合',
      '双叶双曲面': 'x²/a² + y²/b² - z²/c² = -1：分成两片，不连通',
      '椭圆抛物面': 'z = x²/a² + y²/b²：像"碗"，只有一个顶点，曲率非负',
    };
    footnotes(f, [
      desc[kind],
      '二次曲面是三元二次方程的零点集，共有 17 类标准形（含退化情形）',
      '它们都可以由平面截圆锥得到（圆锥曲线在三维的推广）',
    ]);
    heading(f, `二次曲面：${kind}`);
  },
});

/** P13 超环面。 */
const supertoroid = defineViz({
  slug: 'supertoroid',
  title: '超环面',
  params: {
    n1: { type: 'range', min: 0.2, max: 4, default: 2, step: 0.1, label: '截面指数 n₁' },
    n2: { type: 'range', min: 0.2, max: 4, default: 1, step: 0.1, label: '环向指数 n₂' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n1 = num(params, 'n1', 2);
    const n2 = num(params, 'n2', 1);
    const sgnPow = (x: number, e: number): number => Math.sign(x) * Math.pow(Math.abs(x), e);
    renderSurface(f, (u, v) => {
      // 超二次曲面截面 + 超椭球环向
      const c = (x: number, e: number): number => sgnPow(Math.cos(x), e);
      const s = (x: number, e: number): number => sgnPow(Math.sin(x), e);
      const r1 = 1.2;
      const r2 = 0.55;
      const ringX = c(v, n2);
      const ringY = s(v, n2);
      const tubeX = c(u, n1);
      const tubeY = s(u, n1);
      return [ringX * (r1 + r2 * tubeX), r1 * 0 + tubeY * r2 * 1.0, ringY * (r1 + r2 * tubeX)];
    }, { uMin: -Math.PI, uMax: Math.PI, vMin: -Math.PI, vMax: Math.PI, uSteps: 40, vSteps: 50, scale: Math.min(w, h) / 4.6, hue: (u, v) => 210 + v * 20 }, w / 2, h / 2 + 6);

    footnotes(f, [
      `超环面（n₁ = ${n1}、n₂ = ${n2}）：用"超椭圆"截面与超椭圆环向生成`,
      'n = 1 得到普通环面；n < 1 使形状变"瘦"（星形）；n > 1 使形状变"胖"（圆角方形）',
      '超二次曲面族用少量参数覆盖大量工业设计形状，常用于图形学与 CAD 建模',
    ]);
    heading(f, '超环面');
  },
});

/** P14 超二次曲面。 */
const superquadric = defineViz({
  slug: 'superquadric',
  title: '超二次曲面',
  params: {
    e1: { type: 'range', min: 0.1, max: 3, default: 0.6, step: 0.1, label: '纬度指数 e₁' },
    e2: { type: 'range', min: 0.1, max: 3, default: 0.6, step: 0.1, label: '经度指数 e₂' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const e1 = num(params, 'e1', 0.6);
    const e2 = num(params, 'e2', 0.6);
    const sgnPow = (x: number, e: number): number => Math.sign(x) * Math.pow(Math.abs(x), e);
    renderSurface(f, (u, v) => {
      const c1 = sgnPow(Math.cos(u), e1);
      const s1 = sgnPow(Math.sin(u), e1);
      const c2 = sgnPow(Math.cos(v), e2);
      const s2 = sgnPow(Math.sin(v), e2);
      return [c1 * c2, c1 * s2, s1];
    }, { uMin: -Math.PI / 2, uMax: Math.PI / 2, vMin: -Math.PI, vMax: Math.PI, uSteps: 34, vSteps: 48, scale: Math.min(w, h) / 3.4, hue: (u, v) => 205 + u * 40 }, w / 2, h / 2 + 6);

    footnotes(f, [
      `超椭球（e₁ = ${e1}、e₂ = ${e2}）：把球面方程中的平方换成 e 次方`,
      'e < 1 时趋于立方体（棱角分明）；e = 1 是球；e > 1 变成"水滴/双锥"形状',
      '只需两个参数就能在球体与立方体之间连续变形 —— 图形学用它做"可调形状"原型',
    ]);
    heading(f, '超二次曲面');
  },
});

/** P15 直纹曲面族。 */
const ruledSurfaces = defineViz({
  slug: 'ruled-surfaces',
  title: '直纹曲面族',
  params: {
    kind: { type: 'select', options: ['单叶双曲面', '螺旋面', '双曲抛物面'], default: '单叶双曲面', label: '曲面' },
    twist: { type: 'range', min: 0, max: 5, default: 2, step: 0.5, label: '扭曲参数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'kind', '单叶双曲面');
    const twist = num(params, 'twist', 2);
    const cxv = w / 2;
    const cyv = h / 2 + 6;
    const scale = Math.min(w, h) / 5;
    const ay = 0.6;
    const ax = 0.42;

    let fn: (u: number, v: number) => V3;
    if (kind.startsWith('单叶')) {
      fn = (u, v) => [Math.cosh(u) * Math.cos(v), Math.sinh(u), Math.cosh(u) * Math.sin(v)];
    } else if (kind.startsWith('螺旋')) {
      fn = (u, v) => [v * Math.cos(twist * u), u, v * Math.sin(twist * u)];
    } else {
      fn = (u, v) => [u, u * u - v * v, v];
    }
    renderSurface(f, fn, { uMin: -1.3, uMax: 1.3, vMin: 0, vMax: Math.PI * 2, uSteps: 22, vSteps: 46, scale, hue: (u, v) => 200 + v * 18, faceAlpha: 0.72 }, cxv, cyv);

    // 突出显示几族直母线
    for (let k = 0; k < 12; k++) {
      const v0 = (k / 12) * Math.PI * 2;
      const line: Array<[number, number]> = [];
      for (let i = 0; i <= 16; i++) {
        const u = -1.3 + (2.6 * i) / 16;
        const p = proj3(fn(u, v0), ay, ax, scale, cxv, cyv);
        line.push([p[0], p[1]]);
      }
      poly(f, line, { stroke: 'rgba(245,200,101,0.8)', lw: 1.2 });
    }

    footnotes(f, [
      `${kind}：整个曲面由直线"织"成（直纹面），黄色线就是其中的一族直母线`,
      kind.startsWith('螺旋') ? '螺旋面是可展曲面（能展开成平面而不撕裂），但带子会"扭转"' : '单叶双曲面有两族直母线，冷却塔就是按它建造的',
      '直纹面把"弯曲"与"直线"统一：弯曲是整体性质，局部仍是直的（高斯曲率 ≤ 0）',
    ]);
    heading(f, `直纹曲面：${kind}`);
  },
});

registerViz(
  differentialGeometry,
  gaussianCurvature,
  mobius,
  trefoilSurface,
  costaSurface,
  enneperSurface,
  diniSurface,
  romanSurface,
  crossCap,
  boySurface,
  hyperbolicParaboloid,
  quadricSurfaces,
  supertoroid,
  superquadric,
  ruledSurfaces,
);
