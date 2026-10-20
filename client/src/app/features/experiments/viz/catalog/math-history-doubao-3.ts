/**
 * 数学史里程碑 · doubao 补充批次三（T81–T91：20 世纪上半叶）。
 */
import { defineViz, num, str, VizFrame } from '../types';
import { registerViz } from '../registry';
import { C, curve, dot, equalView, footnotes, grid, heading, poly, rng, scatter, seg, text, view } from '../canvas';

/** 数值导数。 */
function d1(fn: (x: number) => number, x: number): number {
  return (fn(x + 1e-5) - fn(x - 1e-5)) / 2e-5;
}

// ---------------------------------------------------------------- T81
/** T81 里斯表示定理。 */
const rieszRepresentationViz = defineViz({
  slug: 'riesz-representation',
  title: '里斯表示定理',
  params: {
    vx: { type: 'range', min: -2, max: 2, step: 0.1, default: 1, label: '表示向量 y 的 x 分量' },
    vy: { type: 'range', min: -2, max: 2, step: 0.1, default: 0.6, label: '表示向量 y 的 y 分量' },
    px: { type: 'range', min: -3, max: 3, step: 0.2, default: -1.6, label: '试探向量 x 的 x 分量' },
    py: { type: 'range', min: -3, max: 3, step: 0.2, default: 2.2, label: '试探向量 x 的 y 分量' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const yv = [num(params, 'vx', 1), num(params, 'vy', 0.6)];
    const xv = [num(params, 'px', -1.6), num(params, 'py', 2.2)];
    const inner = xv[0] * yv[0] + xv[1] * yv[1];

    const v = equalView(f, 0, 0, 3.3, 54);
    grid(f, v, { divisions: 6, ticks: true });
    seg(f, v.sx(-3.3), v.sy(0), v.sx(3.3), v.sy(0), { color: C.dim, lw: 1.1 } as never);
    seg(f, v.sx(0), v.sy(-3.3), v.sx(0), v.sy(3.3), { color: C.dim, lw: 1.1 } as never);

    // y（表示向量）
    seg(f, v.sx(0), v.sy(0), v.sx(yv[0]), v.sy(yv[1]), { color: C.warm, lw: 2.8 } as never);
    dot(f, v.sx(yv[0]), v.sy(yv[1]), 5, C.warm);
    text(f, 'y', v.sx(yv[0]) + 10, v.sy(yv[1]) - 8, { color: C.warm, font: 'bold 14px system-ui' });

    // x（试探向量）
    seg(f, v.sx(0), v.sy(0), v.sx(xv[0]), v.sy(xv[1]), { color: C.accent, lw: 2.2 } as never);
    dot(f, v.sx(xv[0]), v.sy(xv[1]), 4.5, C.accent);
    text(f, 'x', v.sx(xv[0]) + 10, v.sy(xv[1]) - 8, { color: C.accent, font: 'bold 14px system-ui' });

    // y 的垂直方向（泛函的等值线方向）
    const perp: [number, number] = [-yv[1], yv[0]];
    const nrm = Math.hypot(perp[0], perp[1]) || 1;
    const u: [number, number] = [perp[0] / nrm, perp[1] / nrm];
    for (let k = -3; k <= 3; k++) {
      const off = k * 0.9;
      seg(f, v.sx(-3.3 * u[0] + off * yv[0]), v.sy(-3.3 * u[1] + off * yv[1]),
        v.sx(3.3 * u[0] + off * yv[0]), v.sy(3.3 * u[1] + off * yv[1]),
        { color: 'rgba(160,174,192,0.18)', lw: 1 } as never);
    }

    text(f, 'f(x) = ⟨x, y⟩', w / 2, 48, {
      align: 'center', font: 'bold 20px "Times New Roman", serif', color: C.warm,
    });
    text(f, `当前 x 处：⟨x, y⟩ = ${inner.toFixed(3)}`, w / 2, 76, {
      align: 'center', color: C.green, font: '15px Consolas, monospace',
    });
    text(f, '灰色平行线是泛函的等值线（垂直于 y）', w / 2, 100, {
      align: 'center', color: C.dim, font: '13px system-ui',
    });

    heading(f, '里斯表示定理：每个连续线性泛函都来自一个向量');
    footnotes(f, [
      '希尔伯特空间上的连续线性泛函 f，都存在唯一向量 y 使得 f(x) = ⟨x, y⟩',
      '图中 x 移动时，泛函的值由「x 在 y 方向上的投影长度」给出',
      '它把抽象的泛函与具体向量对应起来，是泛函分析的三大支柱之一',
    ]);
  },
});

// ---------------------------------------------------------------- T82
/** T82 闵可夫斯基时空度量。 */
const minkowskiSpacetimeViz = defineViz({
  slug: 'minkowski-spacetime',
  title: '闵可夫斯基时空度量',
  params: {
    v: { type: 'range', min: 0, max: 0.9, step: 0.05, default: 0.5, label: '运动速度 v/c' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const beta = num(params, 'v', 0.5);

    const v = view(f, { xMin: -3, xMax: 3, yMin: -0.5, yMax: 3.4, inset: 54 });
    grid(f, v, { divisions: 6, ticks: true });
    // 光锥边界 x = ±ct
    seg(f, v.sx(0), v.sy(0), v.sx(3), v.sy(3), { color: C.yellow, lw: 1.8, dash: [6, 4] } as never);
    seg(f, v.sx(0), v.sy(0), v.sx(-3), v.sy(3), { color: C.yellow, lw: 1.8, dash: [6, 4] } as never);
    text(f, '光锥 x = ±ct', v.sx(2.1), v.sy(2.55), { color: C.yellow, font: '12px system-ui' });

    // 世界线：以速度 v 匀速运动的粒子
    seg(f, v.sx(0), v.sy(0), v.sx(3 * beta), v.sy(3), { color: C.accent, lw: 2.6 } as never);
    dot(f, v.sx(3 * beta), v.sy(3), 5, C.accent);

    // 同时面（t' = 常数）
    const slopeInv = beta;
    for (let k = 1; k <= 3; k++) {
      seg(f, v.sx(-2.6), v.sy(k), v.sx(2.6), v.sy(k + 2.6 * slopeInv), {
        color: 'rgba(56,178,172,0.35)', lw: 1.2,
      } as never);
    }

    // 时空间隔
    const t = 2;
    const x = 1.2;
    const s2 = -t * t + x * x;
    text(f, 'ds² = −c²dt² + dx² + dy² + dz²', w / 2, 48, {
      align: 'center', font: 'bold 17px "Times New Roman", serif', color: C.warm,
    });
    text(f, `事件 (t=${t}, x=${x})：s² = ${s2.toFixed(2)} ${s2 < 0 ? '（类时，可通信）' : s2 > 0 ? '（类空，不可通信）' : '（类光）'}`, w / 2, 76, {
      align: 'center', color: C.fg, font: '13px Consolas, monospace',
    });
    text(f, `当前世界线速度 β = ${beta.toFixed(2)}c；青色虚线为「同时」的参考面`, w / 2, 100, {
      align: 'center', color: C.dim, font: '13px system-ui',
    });

    heading(f, '闵可夫斯基时空：把相对论几何化');
    footnotes(f, [
      '时间与空间合并为四维时空，间隔 ds² 在洛伦兹变换下保持不变（如同欧氏距离在旋转下不变）',
      '光锥把时空分为类时（可被因果影响）、类光、类空（无因果联系）三部分',
      '闵可夫斯基 1905 年的这项工作，为半年后爱因斯坦的狭义相对论提供了几何语言',
    ]);
  },
});

// ---------------------------------------------------------------- T83
/** T83 维数不变性定理。 */
const invarianceOfDimensionViz = defineViz({
  slug: 'invariance-of-dimension',
  title: '维数不变性定理',
  params: {
    pick: { type: 'select', options: ['1 维 ↔ 2 维', '2 维 ↔ 3 维', '1 维 ↔ 3 维'], default: '1 维 ↔ 2 维', label: '对比' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'pick', '1 维 ↔ 2 维');
    const pair = kind.startsWith('1 维 ↔ 2') ? [1, 2] : kind.startsWith('2 维 ↔ 3') ? [2, 3] : [1, 3];

    const boxW = Math.min(300, w * 0.36);
    const cy = h / 2 + 10;

    const drawSpace = (dim: number, cx: number) => {
      poly(f, [[cx - boxW / 2, cy - 110], [cx + boxW / 2, cy - 110], [cx + boxW / 2, cy + 110], [cx - boxW / 2, cy + 110]], {
        stroke: C.grid, lw: 1.6,
      });
      if (dim === 1) {
        seg(f, cx - boxW / 2 + 20, cy, cx + boxW / 2 - 20, cy, { color: C.accent, lw: 3 } as never);
        for (let k = -4; k <= 4; k++) dot(f, cx + k * ((boxW - 80) / 8), cy, 4, C.warm);
        text(f, '直线 ℝ¹', cx, cy - 126, { align: 'center', color: C.accent, font: 'bold 14px system-ui' });
      } else if (dim === 2) {
        for (let i = 1; i < 5; i++) {
          const y = cy - 110 + (220 * i) / 5;
          seg(f, cx - boxW / 2 + 10, y, cx + boxW / 2 - 10, y, { color: 'rgba(102,126,234,0.25)', lw: 1 } as never);
        }
        for (let i = 1; i < 6; i++) {
          const x = cx - boxW / 2 + (boxW * i) / 6;
          seg(f, x, cy - 110 + 10, x, cy + 110 - 10, { color: 'rgba(102,126,234,0.25)', lw: 1 } as never);
        }
        for (let i = 0; i < 18; i++) dot(f, cx - boxW / 2 + 24 + (i % 6) * ((boxW - 48) / 5), cy - 88 + Math.floor(i / 6) * 88, 4, C.warm);
        text(f, '平面 ℝ²', cx, cy - 126, { align: 'center', color: C.accent, font: 'bold 14px system-ui' });
      } else {
        const s = 78;
        poly(f, [[cx - s, cy - s * 0.55], [cx + s, cy - s * 0.55], [cx + s, cy + s * 0.55], [cx - s, cy + s * 0.55]], {
          stroke: 'rgba(102,126,234,0.5)', lw: 1.4,
        });
        poly(f, [[cx - s + 40, cy - s * 0.55 - 40], [cx + s + 40, cy - s * 0.55 - 40], [cx + s + 40, cy + s * 0.55 - 40], [cx - s + 40, cy + s * 0.55 - 40]], {
          stroke: C.accent, lw: 1.6,
        });
        for (let i = 0; i < 8; i++) {
          dot(f, cx - s + 24 + (i % 4) * 52, cy + 30 + Math.floor(i / 4) * 40, 4, C.warm);
        }
        text(f, '空间 ℝ³', cx, cy - 126, { align: 'center', color: C.accent, font: 'bold 14px system-ui' });
      }
    };

    drawSpace(pair[0], w * 0.27);
    drawSpace(pair[1], w * 0.73);

    text(f, '不存在同胚映射', w / 2, cy - 4, { align: 'center', color: C.hot, font: 'bold 15px system-ui' });
    text(f, '≠', w / 2, cy - 32, { align: 'center', color: C.hot, font: 'bold 26px system-ui' });

    text(f, '布劳威尔维数不变性定理', w / 2, 52, {
      align: 'center', font: 'bold 17px "Times New Roman", serif', color: C.warm,
    });
    text(f, `ℝ^${pair[0]} 与 ℝ^${pair[1]} 不同胚：维数是拓扑不变量`, w / 2, 80, {
      align: 'center', color: C.fg, font: '14px system-ui',
    });
    text(f, '（直觉上显然，但严格证明需要代数拓扑工具）', w / 2, 104, {
      align: 'center', color: C.dim, font: '13px system-ui',
    });

    heading(f, '维数不变性定理：维数不能「连续地」改变');
    footnotes(f, [
      '布劳威尔证明：不同维数的欧氏空间之间不存在同胚映射',
      '这看似显然，但历史上曾出现过「曲线填满正方形」的皮亚诺曲线等反例，使问题变得不平凡',
      '结论：维数是拓扑性质——连续变形不能改变它，这是代数拓扑的基本前提',
    ]);
  },
});

// ---------------------------------------------------------------- T84
/** T84 布劳威尔不动点定理。 */
const brouwerFixedPointViz = defineViz({
  slug: 'brouwer-fixed-point',
  title: '布劳威尔不动点定理',
  params: {
    twist: { type: 'range', min: 0, max: 1, step: 0.05, default: 0.6, label: '映射扭转强度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const twist = num(params, 'twist', 0.6);
    const R = 118;

    const v = equalView(f, 0, 0, R * 1.35, 54);
    grid(f, v, { divisions: 4, ticks: false });
    const disc: Array<[number, number]> = [];
    for (let i = 0; i <= 140; i++) {
      const a = (i * 2 * Math.PI) / 140;
      disc.push([v.sx(R * Math.cos(a)), v.sy(R * Math.sin(a))]);
    }
    poly(f, disc, { fill: 'rgba(102,126,234,0.16)', stroke: C.accent, lw: 2.2 });

    // 连续自映射：p → 旋转 + 向圆心收缩，但不完全缩到中心
    const map = (p: [number, number]): [number, number] => {
      const r = Math.hypot(p[0], p[1]) / R;
      const th = Math.atan2(p[1], p[0]) + twist * (1 - r * 0.5);
      const nr = R * (0.15 + 0.85 * r);
      return [nr * Math.cos(th), nr * Math.sin(th)];
    };

    // 画出映射前后的点对
    const rand = rng(20241003);
    let best: { p: [number, number]; d: number } = { p: [0, 0], d: Infinity };
    for (let i = 0; i < 260; i++) {
      const a = rand() * 2 * Math.PI;
      const rr = Math.sqrt(rand()) * R;
      const p: [number, number] = [rr * Math.cos(a), rr * Math.sin(a)];
      const q = map(p);
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d < best.d) best = { p, d };
      seg(f, v.sx(p[0]), v.sy(p[1]), v.sx(q[0]), v.sy(q[1]), { color: 'rgba(160,174,192,0.22)', lw: 1 } as never);
    }
    dot(f, v.sx(best.p[0]), v.sy(best.p[1]), 7, C.hot);
    text(f, '不动点', v.sx(best.p[0]) + 12, v.sy(best.p[1]) - 10, {
      color: C.hot, font: 'bold 13px system-ui',
    });

    text(f, 'f : D² → D² 连续 ⇒ 必存在 x 使 f(x) = x', w / 2, 48, {
      align: 'center', font: 'bold 16px "Times New Roman", serif', color: C.warm,
    });
    text(f, `当前最小位移 |f(x) − x| = ${best.d.toFixed(3)}（红点为近似不动点）`, w / 2, 76, {
      align: 'center', color: C.green, font: '13px Consolas, monospace',
    });
    text(f, `扭转强度越大，不动点位置随之移动，但始终存在`, w / 2, 100, {
      align: 'center', color: C.dim, font: '13px system-ui',
    });

    heading(f, '布劳威尔不动点定理：搅动咖啡总有一点不动');
    footnotes(f, [
      '把闭圆盘连续映射到自身，一定存在至少一个不动点——无论怎样「搅动」',
      '拖动扭转强度，可看到灰线（映射方向）不断变化，红点（不动点）随之移动却永不消失',
      '它是拓扑学最优美的结论之一，也是博弈论纳什均衡与经济一般均衡存在性的基础',
    ]);
  },
});

// ---------------------------------------------------------------- T85
/** T85 施坦-魏尔斯特拉斯逼近定理。 */
const stoneWeierstrassViz = defineViz({
  slug: 'stone-weierstrass',
  title: '施坦-魏尔斯特拉斯逼近定理',
  params: {
    degree: { type: 'range', min: 1, max: 20, default: 5, label: '多项式次数' },
    kind: { type: 'select', options: ['|x|', '分段折线', 'sin 型'], default: '|x|', label: '目标函数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const deg = Math.max(1, Math.round(num(params, 'degree', 5)));
    const kind = str(params, 'kind', '|x|');

    const target = (x: number): number =>
      kind === '|x|' ? Math.abs(x) : kind === '分段折线' ? (x < -0.4 ? 0.3 : x > 0.5 ? -0.6 : 0.3 - (x + 0.4) * 1.0) : 0.7 * Math.sin(3 * x);

    // 用最小二乘（切比雪夫节点插值即可示意）拟合多项式
    const xs: number[] = [];
    const ys: number[] = [];
    const N = 22;
    for (let i = 0; i <= N; i++) {
      const x = -1 + (2 * i) / N;
      xs.push(x);
      ys.push(target(x));
    }
    // 简单最小二乘拟合
    const m = deg + 1;
    const A: number[][] = [];
    const bvec: number[] = [];
    for (let i = 0; i < m; i++) {
      A.push(new Array(m).fill(0));
      bvec.push(0);
    }
    for (let k = 0; k <= N; k++) {
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < m; j++) A[i][j] += Math.pow(xs[k], i + j);
        bvec[i] += ys[k] * Math.pow(xs[k], i);
      }
    }
    // 高斯消元
    for (let i = 0; i < m; i++) {
      let piv = i;
      for (let k = i + 1; k < m; k++) if (Math.abs(A[k][i]) > Math.abs(A[piv][i])) piv = k;
      [A[i], A[piv]] = [A[piv], A[i]];
      [bvec[i], bvec[piv]] = [bvec[piv], bvec[i]];
      if (Math.abs(A[i][i]) < 1e-12) continue;
      for (let k = i + 1; k < m; k++) {
        const factor = A[k][i] / A[i][i];
        for (let j = i; j < m; j++) A[k][j] -= factor * A[i][j];
        bvec[k] -= factor * bvec[i];
      }
    }
    const coef = new Array(m).fill(0);
    for (let i = m - 1; i >= 0; i--) {
      let s = bvec[i];
      for (let j = i + 1; j < m; j++) s -= A[i][j] * coef[j];
      coef[i] = Math.abs(A[i][i]) > 1e-12 ? s / A[i][i] : 0;
    }
    const fit = (x: number): number => {
      let s = 0;
      for (let i = 0; i < m; i++) s += coef[i] * Math.pow(x, i);
      return s;
    };

    let maxErr = 0;
    for (let i = 0; i <= 400; i++) {
      const x = -1 + (2 * i) / 400;
      maxErr = Math.max(maxErr, Math.abs(target(x) - fit(x)));
    }

    const v = view(f, { xMin: -1.1, xMax: 1.1, yMin: -0.9, yMax: 0.9, inset: 54 });
    grid(f, v, { divisions: 5, ticks: true });
    curve(f, v, target, { color: 'rgba(160,174,192,0.7)', lw: 1.8, dash: [6, 4] } as never);
    curve(f, v, fit, { color: C.accent, lw: 2.4 } as never);
    scatter(f, v, xs.map((x, i) => [x, ys[i]] as [number, number]), { r: 2.4, color: C.warm });

    text(f, `${kind}：${deg} 次多项式一致逼近`, 50, 48, {
      font: 'bold 15px "Times New Roman", serif', color: C.warm,
    });
    text(f, `最大误差 = ${maxErr.toFixed(5)}`, 50, 74, {
      color: maxErr < 0.05 ? C.green : C.hot, font: '14px Consolas, monospace',
    });
    text(f, '灰虚线为目标函数，蓝线为多项式逼近，橙点为插值节点', 50, 98, {
      color: C.dim, font: '12px system-ui',
    });

    heading(f, '施坦-魏尔斯特拉斯：连续函数都能用多项式逼近');
    footnotes(f, [
      '紧集上的连续函数，可以用多项式（或满足分离条件的函数族）任意精确地一致逼近',
      '注意 |x| 在原点不可导，但依然能被多项式逼近——逼近只要求「连续」',
      '它说明多项式在连续函数空间中是稠密的，是分析学与数值计算的基本工具',
    ]);
  },
});

// ---------------------------------------------------------------- T86
/** T86 巴拿赫不动点定理（压缩映射）。 */
const banachFixedPointViz = defineViz({
  slug: 'banach-fixed-point',
  title: '巴拿赫不动点定理',
  params: {
    q: { type: 'range', min: 0.1, max: 0.9, step: 0.05, default: 0.6, label: '压缩系数 q' },
    start: { type: 'range', min: -2, max: 2, step: 0.1, default: 1.8, label: '初始点 x₀' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const q = Math.min(0.95, Math.max(0.05, num(params, 'q', 0.6)));
    const x0 = num(params, 'start', 1.8);

    // 压缩映射 T(x) = q·x + 1（不动点 x* = 1/(1−q)）
    const T = (x: number): number => q * x + 1;
    const star = 1 / (1 - q);

    const v = view(f, { xMin: -3, xMax: 3, yMin: -3, yMax: 4, inset: 52 });
    grid(f, v, { divisions: 6, ticks: true });
    seg(f, v.sx(-3), v.sy(0), v.sx(3), v.sy(0), { color: C.dim, lw: 1.1 } as never);
    curve(f, v, T, { color: C.accent, lw: 2.2 } as never);
    curve(f, v, (x) => x, { color: 'rgba(160,174,192,0.5)', lw: 1.6, dash: [5, 4] } as never);
    dot(f, v.sx(star), v.sy(star), 6, C.hot);
    text(f, '不动点 x*', v.sx(star) + 10, v.sy(star) - 10, { color: C.hot, font: 'bold 12px system-ui' });

    // 迭代轨迹（蛛网图）
    let x = x0;
    const iterates: number[] = [x];
    for (let i = 0; i < 14; i++) {
      const y = T(x);
      seg(f, v.sx(x), v.sy(x), v.sx(x), v.sy(y), { color: 'rgba(237,137,54,0.7)', lw: 1.3 } as never);
      seg(f, v.sx(x), v.sy(y), v.sx(y), v.sy(y), { color: 'rgba(237,137,54,0.7)', lw: 1.3 } as never);
      x = y;
      iterates.push(x);
    }
    dot(f, v.sx(x0), v.sy(x0), 4.5, C.green);
    dot(f, v.sx(x), v.sy(x), 4.5, C.warm);

    text(f, 'T(x) = qx + 1（q < 1 为压缩映射）', 50, 46, {
      font: 'bold 14px "Times New Roman", serif', color: C.warm,
    });
    text(f, `q = ${q.toFixed(2)}　x* = 1/(1−q) = ${star.toFixed(4)}`, 50, 72, {
      color: C.fg, font: '13px Consolas, monospace',
    });
    text(f, `迭代 14 次后 x ≈ ${x.toFixed(6)}，误差 ${Math.abs(x - star).toFixed(8)}`, 50, 96, {
      color: C.green, font: '13px Consolas, monospace',
    });
    text(f, '橙色蛛网：每次迭代都更靠近不动点', 50, 120, { color: C.dim, font: '12px system-ui' });

    heading(f, '巴拿赫不动点定理：压缩映射必有唯一不动点');
    footnotes(f, [
      '完备度量空间上的压缩映射（每两点距离都按 q < 1 的比例缩短）存在唯一不动点',
      '而且：从任意初始点出发反复迭代，都收敛到这个不动点——它是构造性的',
      '这是微分方程解的存在唯一性、隐函数定理与各种迭代数值算法的理论基础',
    ]);
  },
});

// ---------------------------------------------------------------- T87
/** T87 韦德伯恩小定理。 */
const wedderburnLittleViz = defineViz({
  slug: 'wedderburn-little-theorem',
  title: '韦德伯恩小定理',
  params: {
    pick: { type: 'range', min: 0, max: 3, default: 0, label: '示例' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const idx = Math.max(0, Math.min(3, Math.round(num(params, 'pick', 0))));
    const examples = [
      { name: 'ℤ/pℤ（p 为素数）', size: 7, note: '有限域，乘法交换' },
      { name: '𝔽₄ = 𝔽₂[x]/(x²+x+1)', size: 4, note: '4 元有限域，仍交换' },
      { name: '𝔽₉ = 𝔽₃[x]/(x²+1)', size: 9, note: '9 元有限域，仍交换' },
      { name: 'ℍ（四元数）', size: 0, note: '非交换，但不是有限除环（无限）' },
    ];
    const ex = examples[idx];

    // 乘法表（有限域用模运算示意）
    const n = Math.min(ex.size || 5, 7);
    const cell = Math.min(44, (w - 300) / (n + 1));
    const ox = 120;
    const oy = 150;

    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        const x = ox + j * cell;
        const y = oy + i * cell;
        let label = '';
        if (i === 0 && j === 0) label = '×';
        else if (i === 0) label = String(j);
        else if (j === 0) label = String(i);
        else label = String((i * j) % n);
        poly(f, [[x, y], [x + cell - 3, y], [x + cell - 3, y + cell - 3], [x, y + cell - 3]], {
          fill: i === 0 || j === 0 ? 'rgba(160,174,192,0.22)' : (i === j ? 'rgba(72,187,120,0.35)' : 'rgba(102,126,234,0.45)'),
          close: true,
        });
        text(f, label, x + (cell - 3) / 2, y + cell / 2 + 1, { align: 'center', color: C.fg, font: '12px system-ui' });
      }
    }

    // 对称性提示
    let symmetric = true;
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= n; j++) {
        if (((i * j) % n) !== ((j * i) % n)) symmetric = false;
      }
    }

    text(f, ex.name, w / 2, 52, { align: 'center', font: 'bold 17px "Times New Roman", serif', color: C.warm });
    text(f, ex.note, w / 2, 80, { align: 'center', color: C.fg, font: '14px system-ui' });
    text(f, `乘法表关于对角线对称：${symmetric ? '是（交换）✓' : '否（非交换）'}`, w / 2, 106, {
      align: 'center', color: symmetric ? C.green : C.hot, font: '14px system-ui',
    });
    text(f, '韦德伯恩小定理：有限除环一定是域（乘法必然交换）', w / 2, h - 96, {
      align: 'center', color: C.warm, font: 'bold 14px system-ui',
    });

    heading(f, '韦德伯恩小定理：有限的「非交换域」不存在');
    footnotes(f, [
      '除环 = 每个非零元都可逆的环；域 = 乘法还满足交换律的除环',
      '韦德伯恩（1905）证明：只要除环的元素个数有限，它就一定是域',
      '对比：四元数是真正的非交换除环，但它有无限多个元素——有限性才是关键',
    ]);
  },
});

// ---------------------------------------------------------------- T88
/** T88 德拉姆定理。 */
const deRhamTheoremViz = defineViz({
  slug: 'de-rham-theorem',
  title: '德拉姆定理',
  params: {
    pick: { type: 'select', options: ['环面（1 个洞）', '球面（0 个洞）', '双环面（2 个洞）'], default: '环面（1 个洞）', label: '流形' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'pick', '环面（1 个洞）');
    const holes = kind.startsWith('环面') ? 1 : kind.startsWith('球面') ? 0 : 2;

    const v = equalView(f, 0, 0, 1.6, 54);
    grid(f, v, { divisions: 4, ticks: false });

    if (holes === 0) {
      const c: Array<[number, number]> = [];
      for (let i = 0; i <= 120; i++) {
        const a = (i * 2 * Math.PI) / 120;
        c.push([v.sx(76 * Math.cos(a)), v.sy(76 * Math.sin(a) * 0.9)]);
      }
      poly(f, c, { fill: 'rgba(102,126,234,0.25)', stroke: C.accent, lw: 2.2 });
    } else {
      for (let k = 0; k < holes; k++) {
        const cx = v.sx((k - (holes - 1) / 2) * 1.15);
        const cy = v.sy(0);
        const rx = 80;
        const ry = 50;
        const tube = 25;
        const torus: Array<[number, number]> = [];
        for (let i = 0; i <= 160; i++) {
          const a = (i * 2 * Math.PI) / 160;
          torus.push([cx + (rx + tube * Math.cos(6 * a)) * Math.cos(a), cy + (ry + tube * Math.cos(6 * a) * 0.68) * Math.sin(a)]);
        }
        poly(f, torus, { stroke: C.accent, lw: 1.8, fill: 'rgba(102,126,234,0.2)', close: true });
        // 不可收缩的闭路（同调类）
        const loop: Array<[number, number]> = [];
        for (let i = 0; i <= 120; i++) {
          const a = (i * 2 * Math.PI) / 120;
          loop.push([cx + (rx * 0.55) * Math.cos(a), cy + (ry * 0.55 + tube * 0.6) * Math.sin(a)]);
        }
        poly(f, loop, { stroke: C.warm, lw: 2.2 });
      }
    }

    // 上同调维数表
    const betti = holes === 0 ? [1, 0, 1] : holes === 1 ? [1, 2, 1] : [1, 4, 1];
    text(f, '微分形式上同调 ≅ 奇异上同调', w / 2, 48, {
      align: 'center', font: 'bold 16px "Times New Roman", serif', color: C.warm,
    });
    text(f, `H⁰ = ℝ^${betti[0]}　H¹ = ℝ^${betti[1]}　H² = ℝ^${betti[2]}`, w / 2, 76, {
      align: 'center', color: C.accent, font: '15px Consolas, monospace',
    });
    text(f, '橙色闭路无法收缩为点 —— 它对应 H¹ 中一个非零上同调类', w / 2, 102, {
      align: 'center', color: C.fg, font: '13px system-ui',
    });
    text(f, '（这就是「用微积分算出的量」与「用拓扑数出的洞」的同一性）', w / 2, 126, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });

    heading(f, '德拉姆定理：微分形式与拓扑的桥梁');
    footnotes(f, [
      '把「闭形式模去恰当形式」（微分上同调）与「奇异上同调」等同起来',
      '直观理解：无法收缩的闭路 ⇔ 沿它积分非零的闭形式 ⇔ 上同调的非零元素',
      '它是微分拓扑的核心结果，也让「用积分探测洞」成为严格的数学方法',
    ]);
  },
});

// ---------------------------------------------------------------- T89
/** T89 扎里斯基主定理。 */
const zariskiMainTheoremViz = defineViz({
  slug: 'zariski-main-theorem',
  title: '扎里斯基主定理',
  params: {
    branch: { type: 'range', min: 1, max: 4, default: 2, label: '分支度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const k = Math.max(1, Math.round(num(params, 'branch', 2)));

    const v = equalView(f, 0, 0, 1.7, 54);
    grid(f, v, { divisions: 4, ticks: false });

    // 底空间（x 轴）
    seg(f, v.sx(-1.5), v.sy(0), v.sx(1.5), v.sy(0), { color: C.accent, lw: 2.4 } as never);
    // 覆盖空间：k 条分支（模拟 k 层覆叠）
    for (let i = 0; i < k; i++) {
      const off = (i - (k - 1) / 2) * 0.42;
      curve(f, v, (x) => off + 0.22 * Math.sin(2 * x), { color: [C.cyan, C.green, C.warm, C.pink][i % 4], lw: 2 } as never);
    }
    // 分支点（纤维退化处）
    dot(f, v.sx(0), v.sy(0), 6, C.hot);
    text(f, '分支点', v.sx(0) + 10, v.sy(0) - 12, { color: C.hot, font: 'bold 12px system-ui' });

    // 一般纤维
    for (let i = 0; i < k; i++) {
      const off = (i - (k - 1) / 2) * 0.42;
      dot(f, v.sx(1.1), v.sy(off), 5, C.warm);
    }
    seg(f, v.sx(1.1), v.sy(-0.8), v.sx(1.1), v.sy(0.8), { color: 'rgba(237,137,54,0.5)', lw: 1.4, dash: [4, 3] } as never);
    text(f, `${k} 个原像（一般纤维）`, v.sx(1.1) + 12, v.sy(0.72), { color: C.warm, font: '12px system-ui' });

    text(f, '扎里斯基主定理（主定理）', w / 2, 48, {
      align: 'center', font: 'bold 17px "Times New Roman", serif', color: C.warm,
    });
    text(f, '双有理映射除一个例外集合外，都是有限映射', w / 2, 76, {
      align: 'center', color: C.fg, font: '14px system-ui',
    });
    text(f, `当前分支度 = ${k}；红点为分支点（纤维在此退化）`, w / 2, 100, {
      align: 'center', color: C.dim, font: '13px system-ui',
    });

    heading(f, '扎里斯基主定理：双有理映射的纤维结构');
    footnotes(f, [
      '双有理映射在「绝大部分」位置上是有限对一的：一般纤维含固定个数（次数）的原像',
      '只有在一个低维例外集合上，纤维才会「退化」（个数变化或维度升高）',
      '它是代数几何中研究双有理变换、以及证明奇异点可解消的基本工具',
    ]);
  },
});

// ---------------------------------------------------------------- T90
/** T90 巴拿赫-斯坦豪斯一致有界原理。 */
const banachSteinhausViz = defineViz({
  slug: 'banach-steinhaus',
  title: '巴拿赫-斯坦豪斯一致有界原理',
  params: {
    n: { type: 'range', min: 2, max: 12, default: 6, label: '算子个数' },
    norm: { type: 'range', min: 0.2, max: 2, step: 0.1, default: 1, label: '基范数 M₀' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.max(1, Math.round(num(params, 'n', 6)));
    const M0 = num(params, 'norm', 1);

    // 一族算子 T_n，逐点有界但范数可以很大：|T_n x| ≤ C(x)
    const v = view(f, { xMin: 0, xMax: n + 0.5, yMin: 0, yMax: M0 * 6, inset: 52 });
    grid(f, v, { divisions: 5, ticks: true });

    const norms: number[] = [];
    for (let i = 1; i <= n; i++) norms.push(M0 * (1 + Math.sqrt(i) * 0.9));
    const maxNorm = Math.max(...norms);

    norms.forEach((nv, i) => {
      const x = i + 1;
      // 柱：算子范数
      poly(f, [[v.sx(x - 0.3), v.sy(0)], [v.sx(x + 0.3), v.sy(0)], [v.sx(x + 0.3), v.sy(nv)], [v.sx(x - 0.3), v.sy(nv)]], {
        fill: 'rgba(102,126,234,0.6)', close: true,
      });
      // 逐点界（对给定 x，各算子取值有界）
      dot(f, v.sx(x), v.sy(nv), 4.5, C.warm);
      text(f, `T${i}`, v.sx(x), v.sy(0) + 16, { align: 'center', color: C.dim, font: '11px system-ui' });
    });

    // 一致界
    seg(f, v.sx(0), v.sy(maxNorm), v.sx(n + 0.5), v.sy(maxNorm), { color: C.hot, lw: 2, dash: [6, 4] } as never);
    text(f, '一致界 sup‖Tₙ‖ < ∞', v.sx(n + 0.4), v.sy(maxNorm) - 10, {
      align: 'right', color: C.hot, font: '12px system-ui',
    });

    text(f, '一致有界原理（巴拿赫-斯坦豪斯）', w / 2, 48, {
      align: 'center', font: 'bold 16px "Times New Roman", serif', color: C.warm,
    });
    text(f, '若 sup_n |Tₙx| < ∞ 对每个 x 成立（逐点有界）', w / 2, 74, {
      align: 'center', color: C.fg, font: '13px system-ui',
    });
    text(f, '则 sup_n ‖Tₙ‖ < ∞（算子范数一致有界）', w / 2, 98, {
      align: 'center', color: C.green, font: 'bold 13px system-ui',
    });
    text(f, '关键前提：定义域必须是完备的（巴拿赫空间）', w / 2, 122, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });

    heading(f, '一致有界原理：逐点有界蕴含一致有界');
    footnotes(f, [
      '「逐点有界」比「一致有界」弱得多，但完备性使它升级为一致有界——这是泛函分析的奇迹',
      '与哈恩-巴拿赫定理、开映射定理并称泛函分析三大基本定理',
      '典型应用：证明傅里叶级数的发散现象、以及数值方法的稳定性（如 Lax 等价定理）',
    ]);
  },
});

// ---------------------------------------------------------------- T91
/** T91 哈尔测度。 */
const haarMeasureViz = defineViz({
  slug: 'haar-measure',
  title: '哈尔测度',
  params: {
    shift: { type: 'range', min: 0, max: 6.28, step: 0.1, default: 1, label: '平移量 g' },
    radius: { type: 'range', min: 0.05, max: 0.3, step: 0.01, default: 0.12, label: '集合宽度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const shift = num(params, 'shift', 1);
    const rad = num(params, 'radius', 0.12);

    const v = equalView(f, 0, 0, 1.45, 54);
    grid(f, v, { divisions: 4, ticks: false });
    const circle: Array<[number, number]> = [];
    for (let i = 0; i <= 140; i++) {
      const a = (i * 2 * Math.PI) / 140;
      circle.push([v.sx(Math.cos(a)), v.sy(Math.sin(a))]);
    }
    poly(f, circle, { stroke: C.grid, lw: 1.5 });

    // 集合 A（一段弧，宽度对应测度）
    const arc = (center: number, color: string, lw: number, label: string, labelOff: number) => {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 60; i++) {
        const a = center - rad * Math.PI + (2 * rad * Math.PI * i) / 60;
        pts.push([v.sx(Math.cos(a)), v.sy(Math.sin(a))]);
      }
      poly(f, pts, { stroke: color, lw });
      const mx = Math.cos(center) * (1 + labelOff);
      const my = Math.sin(center) * (1 + labelOff);
      text(f, label, v.sx(mx), v.sy(my), { align: 'center', color, font: 'bold 12px system-ui' });
    };
    arc(0.6, C.accent, 6, 'A', 0.14);
    arc(0.6 + shift, C.warm, 6, 'gA', 0.14);

    // 平移箭头
    const arrowPts: Array<[number, number]> = [];
    for (let i = 0; i <= 40; i++) {
      const a = 0.6 + (shift * i) / 40;
      arrowPts.push([v.sx(Math.cos(a) * 0.8), v.sy(Math.sin(a) * 0.8)]);
    }
    poly(f, arrowPts, { stroke: 'rgba(160,174,192,0.6)', lw: 1.4, dash: [4, 3] } as never);

    text(f, 'μ(A) = μ(gA)　（平移不变）', w / 2, 48, {
      align: 'center', font: 'bold 17px "Times New Roman", serif', color: C.warm,
    });
    text(f, `集合宽度 ${(2 * rad).toFixed(2)}；平移量 g = ${shift.toFixed(1)}`, w / 2, 76, {
      align: 'center', color: C.fg, font: '14px system-ui',
    });
    text(f, '无论怎样平移，弧长（测度）都不改变', w / 2, 100, {
      align: 'center', color: C.green, font: '13px system-ui',
    });
    text(f, '（圆周群上的哈尔测度就是弧长；ℤⁿ 上的就是计数测度）', w / 2, 124, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });

    heading(f, '哈尔测度：群上的平移不变测度');
    footnotes(f, [
      '局部紧拓扑群上存在（在平移下）唯一的、正的不变测度，称为哈尔测度',
      '有了它，就能在群上做积分，从而把傅里叶分析推广到抽象群——调和分析由此诞生',
      '圆周群的哈尔测度是弧长，实数加法群的是勒贝格测度，有限群的是计数测度',
    ]);
  },
});

registerViz(
  rieszRepresentationViz,
  minkowskiSpacetimeViz,
  invarianceOfDimensionViz,
  brouwerFixedPointViz,
  stoneWeierstrassViz,
  banachFixedPointViz,
  wedderburnLittleViz,
  deRhamTheoremViz,
  zariskiMainTheoremViz,
  banachSteinhausViz,
  haarMeasureViz,
);
