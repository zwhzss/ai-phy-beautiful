/**
 * 数学史里程碑 · doubao 补充批次七（T125–T136：组合数学与重大猜想）。
 */
import { defineViz, num, str, VizFrame } from '../types';
import { registerViz } from '../registry';
import { C, curve, dot, equalView, footnotes, grid, heading, poly, rng, seg, text, view } from '../canvas';

function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}

// ---------------------------------------------------------------- T125
/** T125 霍尔婚配定理。 */
const hallMarriageViz = defineViz({
  slug: 'hall-marriage-theorem',
  title: '霍尔婚配定理',
  params: {
    seed: { type: 'range', min: 1, max: 12, default: 3, label: '二分图样式' },
    perfect: { type: 'select', options: ['满足霍尔条件', '存在「孤立」子集'], default: '满足霍尔条件', label: '图结构' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const seed = Math.round(num(params, 'seed', 3));
    const ok = str(params, 'perfect', '满足霍尔条件') === '满足霍尔条件';
    const rand = rng(seed * 313);

    const nL = 5;
    const nR = 5;
    const leftX = w * 0.28;
    const rightX = w * 0.72;
    const ys = (i: number, n: number): number => 150 + (i * (h - 300)) / (n - 1 > 0 ? n - 1 : 1);

    // 邻接
    const edges: Array<[number, number]> = [];
    for (let i = 0; i < nL; i++) {
      const deg = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < deg; k++) {
        const j = Math.floor(rand() * nR);
        if (!edges.some(([a, b]) => a === i && b === j)) edges.push([i, j]);
      }
    }
    if (!ok) {
      // 制造违反：前两个左侧点共享同一个右侧邻居
      const filtered = edges.filter(([a]) => a !== 0 && a !== 1);
      filtered.push([0, 2], [1, 2]);
      edges.length = 0;
      edges.push(...filtered);
    }

    // 匹配（贪心）
    const matchR = new Array(nR).fill(-1);
    const matched: Array<[number, number]> = [];
    for (const [i, j] of edges) {
      if (matchR[j] === -1) {
        matchR[j] = i;
        matched.push([i, j]);
      }
    }
    const isMatched = new Set(matched.map(([a]) => a));

    edges.forEach(([i, j]) => {
      const isMatch = matched.some(([a, b]) => a === i && b === j);
      seg(f, leftX, ys(i, nL), rightX, ys(j, nR), {
        color: isMatch ? 'rgba(237,137,54,0.9)' : 'rgba(160,174,192,0.28)', lw: isMatch ? 2.4 : 1.1,
      } as never);
    });
    for (let i = 0; i < nL; i++) {
      dot(f, leftX, ys(i, nL), 9, isMatched.has(i) ? C.warm : C.accent);
      text(f, `L${i + 1}`, leftX - 20, ys(i, nL) + 4, { align: 'right', color: C.fg, font: '11px system-ui' });
    }
    for (let j = 0; j < nR; j++) {
      dot(f, rightX, ys(j, nR), 9, matchR[j] >= 0 ? C.warm : C.accent);
      text(f, `R${j + 1}`, rightX + 20, ys(j, nR) + 4, { color: C.fg, font: '11px system-ui' });
    }

    const matchedCount = matched.length;
    text(f, '霍尔条件：左侧任意 k 个点至少邻接右侧 k 个点', w / 2, 48, {
      align: 'center', font: 'bold 15px system-ui', color: C.warm,
    });
    text(f, `当前匹配数 ${matchedCount} / ${nL}　${matchedCount === nL ? '⇒ 存在完美匹配 ✓' : '⇒ 不存在完美匹配（违反霍尔条件）'}`, w / 2, 76, {
      align: 'center', color: matchedCount === nL ? C.green : C.hot, font: '14px system-ui',
    });
    text(f, '橙线为已匹配的边；点击参数切换图结构对比', w / 2, 100, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });

    heading(f, '霍尔婚配定理：完美匹配的充要条件');
    footnotes(f, [
      '二分图中存在覆盖左侧全部顶点的匹配，当且仅当左侧任意 k 个顶点的邻域至少有 k 个顶点',
      '这个条件把「能不能配对」化为一组计数不等式，可逐一检验',
      '应用：任务分配、稳定婚姻、网络流的可行性判定等；它是组合数学最实用的存在性定理之一',
    ]);
  },
});

// ---------------------------------------------------------------- T126
/** T126 拉姆齐定理。 */
const ramseyTheoremViz = defineViz({
  slug: 'ramsey-theorem',
  title: '拉姆齐定理',
  params: {
    seed: { type: 'range', min: 1, max: 20, default: 5, label: '染色方式' },
    n: { type: 'range', min: 5, max: 8, default: 6, label: '点数 n' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const seed = Math.round(num(params, 'seed', 5));
    const n = Math.max(3, Math.round(num(params, 'n', 6)));
    const rand = rng(seed * 997);

    const cx = w / 2;
    const cy = h / 2 + 10;
    const R = Math.min(w * 0.28, h * 0.32);

    const pts: Array<[number, number]> = [];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    }

    // 红蓝二色染色
    const color = (i: number, j: number): number => (rand() < 0.5 ? 0 : 1);
    const cm: number[][] = [];
    for (let i = 0; i < n; i++) {
      cm.push([]);
      for (let j = 0; j < n; j++) cm[i].push(-1);
    }
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const c = color(i, j);
        cm[i][j] = c;
        cm[j][i] = c;
      }
    }
    // 找单色三角形
    let mono: number[] | null = null;
    for (let i = 0; i < n && !mono; i++) {
      for (let j = i + 1; j < n && !mono; j++) {
        for (let k = j + 1; k < n && !mono; k++) {
          if (cm[i][j] === cm[j][k] && cm[j][k] === cm[i][k]) mono = [i, j, k];
        }
      }
    }

    const inMono = (i: number, j: number): boolean => !!mono && mono.includes(i) && mono.includes(j);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const c = cm[i][j];
        seg(f, pts[i][0], pts[i][1], pts[j][0], pts[j][1], {
          color: inMono(i, j) ? (c === 0 ? 'rgba(245,101,101,0.95)' : 'rgba(102,126,234,0.95)') : c === 0 ? 'rgba(245,101,101,0.3)' : 'rgba(102,126,234,0.3)',
          lw: inMono(i, j) ? 3 : 1.2,
        } as never);
      }
    }
    pts.forEach((p, i) => {
      dot(f, p[0], p[1], 8, C.warm);
      text(f, String(i + 1), p[0], p[1] + 4, { align: 'center', color: C.bg, font: 'bold 11px system-ui' });
    });

    text(f, 'R(3, 3) = 6：六点二色染色必有单色三角形', w / 2, 48, {
      align: 'center', font: 'bold 16px system-ui', color: C.warm,
    });
  text(f, `当前 n = ${n}，${mono ? `找到单色三角形（顶点 ${mono.map((x) => x + 1).join(', ')}）` : '未找到（n < 6 时允许规避）'}`, w / 2, 76, {
      align: 'center', color: mono ? C.green : C.dim, font: '14px system-ui',
    });
    text(f, '红/蓝为两种颜色；加粗线即单色三角形', w / 2, 100, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });

    heading(f, '拉姆齐定理：足够大的结构必含有序');
    footnotes(f, [
      '六个人中，必有三人互相认识或互相不认识——这就是 R(3,3) = 6',
      '一般地 R(s,t) 存在但极难计算：R(5,5) 至今未知（介于 43 与 48 之间）',
      '它说明「完全无序」在足够大的尺度上不可能存在，是组合数学的基石之一',
    ]);
  },
});

// ---------------------------------------------------------------- T127
/** T127 P 对 NP 问题。 */
const pVsNpViz = defineViz({
  slug: 'p-vs-np',
  title: 'P 对 NP 问题',
  params: {
    view: { type: 'select', options: ['假设 P ≠ NP', '假设 P = NP'], default: '假设 P ≠ NP', label: '情形' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const equal = str(params, 'view', '假设 P ≠ NP') === '假设 P = NP';

    const cx = w / 2;
    const cy = h / 2 + 6;
    const R = Math.min(w * 0.3, h * 0.36);

    const ellipse = (rx: number, ry: number, color: string, fill: string, label: string, dy: number) => {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 130; i++) {
        const a = (i * 2 * Math.PI) / 130;
        pts.push([cx + rx * Math.cos(a), cy + dy + ry * Math.sin(a)]);
      }
      poly(f, pts, { stroke: color, lw: 2.2, fill, close: true });
      text(f, label, cx, cy + dy - ry + 20, { align: 'center', color, font: 'bold 13px system-ui' });
    };

    if (equal) {
      ellipse(R, R * 0.82, C.green, 'rgba(72,187,120,0.2)', 'P = NP', 0);
      text(f, '若 P = NP：两类的所有问题都能高效求解', w / 2, cy + R * 0.2, {
        align: 'center', color: C.fg, font: '14px system-ui',
      });
      text(f, '（密码学将崩塌，优化问题将迎刃而解）', w / 2, 100, {
        align: 'center', color: C.hot, font: '13px system-ui',
      });
    } else {
      ellipse(R * 1.3, R * 0.92, C.accent, 'rgba(102,126,234,0.18)', 'NP（可快速验证）', 0);
      ellipse(R * 0.62, R * 0.52, C.green, 'rgba(72,187,120,0.3)', 'P（可快速求解）', R * 0.16);
      // NP 完全问题（在 NP 内、P 外）
      const marks: Array<[number, number, string]> = [[-R * 0.62, -R * 0.3, 'SAT'], [R * 0.66, R * 0.06, 'TSP'], [R * 0.1, -R * 0.55, '团问题']];
      for (const [dx, dy, label] of marks) {
        dot(f, cx + dx, cy + dy, 5, C.hot);
        text(f, label, cx + dx + 10, cy + dy - 8, { color: C.hot, font: '11px system-ui' });
      }
      text(f, 'NP 完全问题（红点）：最难的一类，只要其中一个属于 P，则 P = NP', w / 2, 100, {
        align: 'center', color: C.dim, font: '12px system-ui',
      });
    }

    text(f, 'P ≠ NP ？（千禧年难题）', w / 2, 48, {
      align: 'center', font: 'bold 18px "Times New Roman", serif', color: C.warm,
    });
    text(f, 'P：能在多项式时间求解　NP：能在多项式时间验证', w / 2, 76, {
      align: 'center', color: C.fg, font: '13px system-ui',
    });
    text(f, '几乎所有数学家相信 P ≠ NP，但至今无人证明', w / 2, h - 96, {
      align: 'center', color: C.hot, font: 'bold 13px system-ui',
    });

    heading(f, 'P 对 NP：验证容易，求解难？');
    footnotes(f, [
      'P 是「能快速求解」的问题类，NP 是「能快速验证」的问题类；显然 P ⊆ NP',
      '问题是：这个包含关系是否严格？切换下拉框可看到两种情形的差别',
      '它是千禧年七大难题之一，也是现代密码学安全性的理论前提——若 P = NP，公钥加密将不再安全',
    ]);
  },
});

// ---------------------------------------------------------------- T128
/** T128 霍奇猜想。 */
const hodgeConjectureViz = defineViz({
  slug: 'hodge-conjecture',
  title: '霍奇猜想',
  params: {
    degree: { type: 'range', min: 1, max: 3, default: 2, label: '代数闭链的次数 k' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const k = Math.max(1, Math.round(num(params, 'degree', 2)));

    const v = equalView(f, 0, 0, 1.7, 54);
    grid(f, v, { divisions: 4, ticks: false });

    // 代数簇（复射影空间中的曲面示意）：带网格的球面
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 130; i++) {
      const a = (i * 2 * Math.PI) / 130;
      pts.push([v.sx(82 * Math.cos(a)), v.sy(82 * Math.sin(a) * 0.9)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.2, fill: 'rgba(102,126,234,0.16)' });
    for (const r of [0.35, 0.65, 0.9]) {
      const line: Array<[number, number]> = [];
      for (let i = 0; i <= 60; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 60;
        line.push([v.sx(82 * r * Math.cos(a) * 0.92), v.sy(82 * Math.sin(a) * 0.9)]);
      }
      poly(f, line, { stroke: 'rgba(160,174,192,0.28)', lw: 1 });
    }
    // 代数闭链（曲线上的一族点）
    for (let i = 0; i < 7; i++) {
      const a = (i * 2 * Math.PI) / 7 + 0.3;
      dot(f, v.sx(66 * Math.cos(a)), v.sy(66 * Math.sin(a) * 0.9), 5, C.hot);
    }
    // 霍奇类（示意：一族等值线）
    for (let i = -2; i <= 2; i++) {
      const line: Array<[number, number]> = [];
      for (let t = -1.2; t <= 1.2; t += 0.05) {
        line.push([v.sx(t * 1.2 + i * 0.22), v.sy(0.5 * i + 0.3 * Math.sin(t * 2))]);
      }
      poly(f, line, { stroke: 'rgba(237,137,54,0.4)', lw: 1.2 });
    }

    text(f, '霍奇猜想', w / 2, 48, {
      align: 'center', font: 'bold 18px "Times New Roman", serif', color: C.warm,
    });
    text(f, '非奇异复射影代数簇上的每个霍奇类，都是代数闭链类的有理线性组合', w / 2, 76, {
      align: 'center', color: C.fg, font: '12px system-ui',
    });
    text(f, '红点 = 代数闭链（由多项式方程定义的几何对象）', w / 2, 100, {
      align: 'center', color: C.hot, font: '12px system-ui',
    });
    text(f, '橙线 = 霍奇类（由调和形式定义的「拓扑形状」）', w / 2, 124, {
      align: 'center', color: C.warm, font: '12px system-ui',
    });

    heading(f, '霍奇猜想：拓扑形状是否都来自代数方程？');
    footnotes(f, [
      '霍奇类来自「调和微分形式」，是分析/拓扑层面的对象；代数闭链来自多项式方程',
      '猜想断言：前者一定是后者的有理线性组合——即「能用拓扑看到的，都能用方程写出」',
      '它是千禧年七大难题之一，也是代数几何与拓扑之间最深层的联系，目前仅低维有部分进展',
    ]);
  },
});

// ---------------------------------------------------------------- T129
/** T129 杨-米尔斯存在性与质量间隙。 */
const yangMillsViz = defineViz({
  slug: 'yang-mills-mass-gap',
  title: '杨-米尔斯存在性与质量间隙',
  params: {
    n: { type: 'range', min: 3, max: 8, default: 5, label: '展示能级数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.max(2, Math.round(num(params, 'n', 5)));

    // 左侧：能谱（有质量间隙）
    const gap = 0.35;
    const levels: number[] = [0];
    let acc = gap;
    for (let i = 1; i < n; i++) {
      levels.push(acc);
      acc += 0.35 + 0.12 * i;
    }

    const axisX = 110;
    const baseY = h - 140;
    const scaleY = (h - 280) / Math.max(...levels, 0.1);

    seg(f, axisX, baseY, axisX, baseY - (h - 280) * 1.05, { color: C.dim, lw: 1.6 } as never);
    text(f, '能量', axisX - 12, baseY - (h - 280) * 1.0, { align: 'right', color: C.dim, font: '12px system-ui' });

    levels.forEach((lv, i) => {
      const y = baseY - lv * scaleY;
      seg(f, axisX - 30, y, axisX + 170, y, { color: i === 0 ? C.green : C.accent, lw: 2.4 } as never);
      text(f, i === 0 ? '真空态 |0⟩' : `激发态 ${i}`, axisX + 180, y + 4, {
        color: i === 0 ? C.green : C.fg, font: '12px system-ui',
      });
    });
    // 质量间隙标注
    const gapY1 = baseY;
    const gapY2 = baseY - gap * scaleY;
    seg(f, axisX + 60, gapY1, axisX + 60, gapY2, { color: C.hot, lw: 3 } as never);
    text(f, '质量间隙 Δ > 0', axisX + 80, (gapY1 + gapY2) / 2 + 4, { color: C.hot, font: 'bold 13px system-ui' });

    // 右侧：规范场示意（不同颜色的场）
    const cx = w * 0.75;
    const cy = h / 2 + 10;
    for (let i = 0; i < 6; i++) {
      const a = (i * 2 * Math.PI) / 6;
      const x = cx + 60 * Math.cos(a);
      const y = cy + 60 * Math.sin(a);
      dot(f, x, y, 7, [C.accent, C.cyan, C.green, C.warm, C.pink, C.yellow][i]);
      seg(f, cx, cy, x, y, { color: 'rgba(160,174,192,0.35)', lw: 1.4 } as never);
    }
    dot(f, cx, cy, 9, C.fg);
    text(f, '非阿贝尔规范场', cx, cy + 96, { align: 'center', color: C.dim, font: '12px system-ui' });

    text(f, '杨-米尔斯存在性与质量间隙', w / 2, 48, {
      align: 'center', font: 'bold 17px "Times New Roman", serif', color: C.warm,
    });
    text(f, '需证明：四维非阿贝尔规范场论存在，且能谱与真空之间有正间隙', w / 2, 76, {
      align: 'center', color: C.fg, font: '13px system-ui',
    });
    text(f, '物理上这解释了强作用的短程性（传递粒子有质量）', w / 2, 100, {
      align: 'center', color: C.green, font: '13px system-ui',
    });
    text(f, '数学上却仍未严格构造——它是千禧年七大难题中「最物理」的一个', w / 2, h - 96, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });

    heading(f, '杨-米尔斯：量子场论的公理化困境');
    footnotes(f, [
      '杨-米尔斯理论描述非阿贝尔规范场，是粒子物理标准模型的数学核心',
      '「质量间隙」指最低激发态能量严格大于真空能量——它解释了为什么核力是短程的',
      '难点在于：该理论在四维时空中尚未被严格数学构造（连续场论缺乏严格定义）',
    ]);
  },
});

// ---------------------------------------------------------------- T130
/** T130 纳维-斯托克斯方程解的存在性与光滑性。 */
const navierStokesViz = defineViz({
  slug: 'navier-stokes-existence',
  title: '纳维-斯托克斯方程解的存在性与光滑性',
  params: {
    viscosity: { type: 'range', min: 0.02, max: 0.4, step: 0.01, default: 0.12, label: '黏性 ν' },
    steps: { type: 'range', min: 200, max: 1200, default: 600, label: '时间步数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const nu = num(params, 'viscosity', 0.12);
    const steps = Math.round(num(params, 'steps', 600));

    // 简化的速度场演化：涡旋强度随时间的变化
    const rand = rng(20241007);
    const timeSeries: Array<{ t: number; energy: number }> = [];
    let energy = 1;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      // 黏性耗散 vs 非线性放大
      const dissip = -nu * energy * 2.2;
      const nonlinear = 1.6 * energy * energy * 0.06 * (rand() - 0.35);
      energy = Math.max(0.02, energy + (dissip + nonlinear) * (1 / steps) * 60);
      if (i % Math.max(1, Math.floor(steps / 200)) === 0) timeSeries.push({ t, energy });
    }

    const v = view(f, { xMin: 0, xMax: 1, yMin: 0, yMax: Math.max(1.6, Math.max(...timeSeries.map((s) => s.energy)) * 1.1), inset: 54 });
    grid(f, v, { divisions: 5, ticks: true });
    for (let i = 1; i < timeSeries.length; i++) {
      seg(f, v.sx(timeSeries[i - 1].t), v.sy(timeSeries[i - 1].energy), v.sx(timeSeries[i].t), v.sy(timeSeries[i].energy), {
        color: C.accent, lw: 2.2,
      } as never);
    }
    const maxE = Math.max(...timeSeries.map((s) => s.energy));
    seg(f, v.sx(0), v.sy(maxE), v.sx(1), v.sy(maxE), { color: C.hot, lw: 1.6, dash: [6, 4] } as never);

    // 流场示意
    const gx = w * 0.78;
    const gy = h * 0.42;
    for (let i = 0; i < 7; i++) {
      const pts: Array<[number, number]> = [];
      const y0 = gy - 80 + i * 27;
      for (let k = 0; k <= 60; k++) {
        const u = k / 60;
        const x = gx - 100 + u * 200;
        const y = y0 + Math.sin(u * 6 + i * 0.5) * (5 + 8 * nu * 4);
        pts.push([x, y]);
      }
      poly(f, pts, { stroke: 'rgba(102,126,234,0.5)', lw: 1.4 });
    }
    text(f, '速度场 u(x, t)', gx, gy + 96, { align: 'center', color: C.dim, font: '12px system-ui' });

    text(f, '纳维-斯托克斯方程是否始终有光滑解？', w / 2, 48, {
      align: 'center', font: 'bold 16px system-ui', color: C.warm,
    });
    text(f, `黏性 ν = ${nu.toFixed(2)}　最大能量密度 ≈ ${maxE.toFixed(3)}`, w / 2, 76, {
      align: 'center', color: C.fg, font: '13px Consolas, monospace',
    });
    text(f, '黏性大时能量耗散（光滑）；黏性极小时可能「爆破」成一束奇点', w / 2, 100, {
      align: 'center', color: C.green, font: '13px system-ui',
    });
    text(f, '三维情形至今未决：要么证明光滑解永存，要么构造出爆破的反例', w / 2, h - 96, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });

    heading(f, '纳维-斯托克斯：流体的数学之谜');
    footnotes(f, [
      '方程描述黏性流体：惯性项带来非线性，黏性项带来耗散，两者的竞争决定解的命运',
      '二维情形已被证明光滑解永远存在；三维情形（= 真实流体）至今未决',
      '它是千禧年七大难题之一，也与湍流这一经典物理难题深刻相关',
    ]);
  },
});

// ---------------------------------------------------------------- T131
/** T131 贝赫-斯维讷通-戴尔猜想。 */
const birchSwinnertonDyerViz = defineViz({
  slug: 'birch-swinnerton-dyer',
  title: '贝赫-斯维讷通-戴尔猜想',
  params: {
    curve: { type: 'select', options: ['y² = x³ − x（秩 0）', 'y² = x³ − 4x（秩 1）', 'y² = x³ − x² − 4x + 4'], default: 'y² = x³ − 4x（秩 1）', label: '椭圆曲线' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'curve', 'y² = x³ − 4x（秩 1）');
    const fn = kind.startsWith('y² = x³ − x（')
      ? (x: number): number => x * x * x - x
      : kind.startsWith('y² = x³ − 4x')
        ? (x: number): number => x * x * x - 4 * x
        : (x: number): number => x * x * x - x * x - 4 * x + 4;
    const rank = kind.startsWith('y² = x³ − x（') ? 0 : kind.startsWith('y² = x³ − 4x') ? 1 : 0;

    const v = view(f, { xMin: -3, xMax: 3.4, yMin: -4.5, yMax: 4.5, inset: 54 });
    grid(f, v, { divisions: 5, ticks: true });
    seg(f, v.sx(-3), v.sy(0), v.sx(3.4), v.sy(0), { color: C.dim, lw: 1.1 } as never);

    for (const sign of [1, -1]) {
      const pts: Array<[number, number]> = [];
      let prevOk = false;
      for (let i = 0; i <= 400; i++) {
        const x = -3 + (6.4 * i) / 400;
        const y2 = fn(x);
        if (y2 >= 0) {
          const y = sign * Math.sqrt(y2);
          if (!prevOk) pts.push([v.sx(x), v.sy(y)]);
          pts.push([v.sx(x), v.sy(y)]);
          prevOk = true;
        } else {
          if (pts.length > 1) poly(f, pts.splice(0, pts.length), { stroke: C.accent, lw: 2.4 });
          prevOk = false;
        }
      }
      if (pts.length > 1) poly(f, pts, { stroke: C.accent, lw: 2.4 });
    }

    // 有理点
    const rationals: Array<[number, number]> = [];
    for (let px = -4; px <= 6; px++) {
      const y2 = fn(px);
      if (y2 >= 0) {
        const y = Math.sqrt(y2);
        if (Math.abs(y - Math.round(y)) < 1e-9) {
          rationals.push([px, Math.round(y)]);
          if (y !== 0) rationals.push([px, -Math.round(y)]);
        }
      }
    }
    rationals.forEach(([x, y]) => {
      if (x >= -3 && x <= 3.4) dot(f, v.sx(x), v.sy(y), 5, C.hot);
    });

    // L 函数零点阶示意
    text(f, 'L(E, s)', w * 0.8, 52, { align: 'center', color: C.cyan, font: 'bold 13px "Times New Roman", serif' });
    const lv = view(f, { xMin: 0, xMax: 3, yMin: -0.4, yMax: 1.2, inset: 40 });
    curve(f, lv, (s) => Math.sin((s - 1) * (rank === 0 ? 2.2 : 1.2)) * 0.3 + (s - 1) * (rank === 0 ? 0.35 : 0.18), {
      color: C.cyan, lw: 1.8,
    } as never);
    seg(f, lv.sx(1), lv.sy(-0.4), lv.sx(1), lv.sy(1.2), { color: C.dim, lw: 1.2, dash: [4, 3] } as never);
    for (let i = 0; i < Math.max(1, rank); i++) {
      dot(f, lv.sx(1), lv.sy(0), 4.5, C.hot);
    }

    text(f, '贝赫-斯维讷通-戴尔猜想（BSD）', w / 2, 48, {
      align: 'center', font: 'bold 16px "Times New Roman", serif', color: C.warm,
    });
    text(f, '椭圆曲线有理点的「秩」= L 函数在 s = 1 处零点的阶', w / 2, 76, {
      align: 'center', color: C.fg, font: '13px system-ui',
    });
    text(f, `当前曲线：秩 ${rank} ⇒ L(E, 1) 应有 ${rank} 阶零点`, w / 2, 100, {
      align: 'center', color: C.green, font: '13px system-ui',
    });
    text(f, '红点 = 曲线上的整点/有理点；它们生成的群的秩正是猜想的核心', w / 2, 124, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });

    heading(f, 'BSD 猜想：算术与分析的对应');
    footnotes(f, [
      '椭圆曲线上的有理点构成有限生成阿贝尔群，其「秩」衡量有理点有多丰富',
      '猜想断言：秩恰等于 L 函数在 s = 1 处零点的阶——把「算术」与「分析」精确对应',
      '它是千禧年七大难题中与数论联系最紧密的一个，仅在特殊情形（如解析秩 ≤ 1）被证明',
    ]);
  },
});

// ---------------------------------------------------------------- T132
/** T132 孪生素数猜想。 */
const twinPrimeConjectureViz = defineViz({
  slug: 'twin-prime-conjecture',
  title: '孪生素数猜想',
  params: {
    limit: { type: 'range', min: 100, max: 3000, default: 800, label: '扫描上限' },
    gap: { type: 'range', min: 2, max: 20, step: 2, default: 2, label: '间隔 d' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const limit = Math.max(50, Math.round(num(params, 'limit', 800)));
    const gap = Math.max(2, Math.round(num(params, 'gap', 2)));

    const primes: number[] = [];
    const sieve = new Array(limit + 1).fill(true);
    sieve[0] = sieve[1] = false;
    for (let i = 2; i * i <= limit; i++) if (sieve[i]) for (let j = i * i; j <= limit; j += i) sieve[j] = false;
    for (let i = 2; i <= limit; i++) if (sieve[i]) primes.push(i);
    const pset = new Set(primes);

    const pairs: Array<[number, number]> = [];
    primes.forEach((p) => {
      if (pset.has(p + gap)) pairs.push([p, p + gap]);
    });

    const v = view(f, { xMin: 0, xMax: limit, yMin: -0.6, yMax: 1.6, inset: 54 });
    grid(f, v, { divisions: 5, ticks: false });
    seg(f, v.sx(0), v.sy(0.5), v.sx(limit), v.sy(0.5), { color: C.dim, lw: 1.2 } as never);
    primes.forEach((p) => {
      dot(f, v.sx(p), v.sy(0.3), 2.2, 'rgba(160,174,192,0.5)');
    });
    pairs.forEach(([p]) => {
      dot(f, v.sx(p), v.sy(1.0), 4.2, C.hot);
    });
    // 计数曲线
    const counts: Array<[number, number]> = [];
    let acc = 0;
    pairs.forEach(([p]) => {
      acc++;
      counts.push([p, acc]);
    });

    text(f, `间隔 d = ${gap} 的素数对`, w / 2, 48, {
      align: 'center', font: 'bold 15px system-ui', color: C.warm,
    });
    text(f, `在 1…${limit} 内共找到 ${pairs.length} 对`, w / 2, 76, {
      align: 'center', color: C.hot, font: 'bold 15px system-ui',
    });
    text(f, gap === 2 ? '孪生素数（d = 2）：猜想有无穷多对，至今未证' : `间隔 ${gap} 的素数对：同样猜想有无穷多组`, w / 2, 100, {
      align: 'center', color: C.green, font: '13px system-ui',
    });
    text(f, '灰点为素数，红点为配对起点；张益唐证明「有界间隔」存在无穷多对', w / 2, 124, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });
    void counts;

    heading(f, '孪生素数猜想：素数对的无限性');
    footnotes(f, [
      '孪生素数指相差 2 的素数对，如 (3,5)、(11,13)、(41,43)；猜想它们有无穷多对',
      '张益唐 2013 年证明：存在无穷多对间隔不超过 7000 万的素数，后被优化到 246',
      '把「间隔」压到 2 仍未成功，这是数论中最著名的未解问题之一',
    ]);
  },
});

// ---------------------------------------------------------------- T133
/** T133 考拉兹猜想（3n+1）。 */
const collatzConjectureViz = defineViz({
  slug: 'collatz-conjecture',
  title: '考拉兹猜想（3n+1）',
  params: {
    n: { type: 'range', min: 2, max: 200, default: 27, label: '起始整数 n' },
    segments: { type: 'range', min: 1, max: 6, default: 4, label: '同时展示的序列数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n0 = Math.max(2, Math.round(num(params, 'n', 27)));
    const segs = Math.max(1, Math.round(num(params, 'segments', 4)));

    const collatz = (start: number): number[] => {
      const seq: number[] = [start];
      let x = start;
      let guard = 0;
      while (x !== 1 && guard < 400) {
        x = x % 2 === 0 ? x / 2 : 3 * x + 1;
        seq.push(x);
        guard++;
      }
      return seq;
    };

    const seqs = [collatz(n0)];
    for (let i = 1; i < segs; i++) seqs.push(collatz(Math.max(2, n0 - i * 3)));

    const maxLen = Math.max(...seqs.map((s) => s.length));
    const maxVal = Math.max(...seqs.flat());

    const v = view(f, { xMin: 0, xMax: maxLen, yMin: 0, yMax: Math.max(4, maxVal * 1.08), inset: 54 });
    grid(f, v, { divisions: 6, ticks: true });

    const colors = [C.accent, C.cyan, C.green, C.warm, C.pink, C.yellow];
    seqs.forEach((seq, si) => {
      for (let i = 1; i < seq.length; i++) {
        seg(f, v.sx(i - 1), v.sy(seq[i - 1]), v.sx(i), v.sy(seq[i]), {
          color: si === 0 ? C.accent : colors[si % colors.length] + '', lw: si === 0 ? 2.2 : 1.3,
        } as never);
      }
      dot(f, v.sx(0), v.sy(seq[0]), 4.5, colors[si % colors.length]);
    });
    // 终点 1
    dot(f, v.sx(maxLen), v.sy(1), 5, C.hot);

    text(f, `n = ${n0}：迭代 ${seqs[0].length - 1} 步到达 1`, w / 2, 48, {
      align: 'center', font: 'bold 15px system-ui', color: C.warm,
    });
    text(f, `序列最高峰值 = ${Math.max(...seqs[0])}`, w / 2, 76, {
      align: 'center', color: C.fg, font: '13px Consolas, monospace',
    });
    text(f, '规则：偶数除以 2，奇数乘 3 加 1；所有已知序列都最终落到 1', w / 2, 100, {
      align: 'center', color: C.green, font: '13px system-ui',
    });
    text(f, '已验证到约 2⁶⁸ 的所有整数，但无人能证明它对所有 n 成立', w / 2, 124, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });

    heading(f, '考拉兹猜想：最简单的未解问题');
    footnotes(f, [
      '任取正整数，偶数除以 2、奇数乘以 3 加 1，反复迭代——猜想最终必然到达 1',
      '陈述只需小学算术，却难倒了所有数学家近百年；保罗·埃尔德什说「数学还没准备好」',
      'n = 27 是著名例子：峰值达 9232，需 111 步才降到 1，过程剧烈震荡',
    ]);
  },
});

// ---------------------------------------------------------------- T134
/** T134 奇完全数猜想。 */
const oddPerfectNumberViz = defineViz({
  slug: 'odd-perfect-number',
  title: '奇完全数猜想',
  params: {
    pick: { type: 'range', min: 0, max: 3, default: 1, label: '第几个偶完全数' },
    oddCheck: { type: 'range', min: 3, max: 999, step: 2, default: 45, label: '检验奇数 n' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const idx = Math.max(0, Math.min(3, Math.round(num(params, 'pick', 1))));
    const odd = (() => {
      let v = Math.round(num(params, 'oddCheck', 45));
      if (v % 2 === 0) v += 1;
      return Math.max(3, v);
    })();

    const ps = [2, 3, 5, 7];
    const p = ps[idx];
    const perfect = Math.pow(2, p - 1) * (Math.pow(2, p) - 1);

    const divisors = (x: number): number[] => {
      const out: number[] = [];
      for (let i = 1; i < x; i++) if (x % i === 0) out.push(i);
      return out;
    };
    const perfectDivs = divisors(perfect);
    const perfectSum = perfectDivs.reduce((a, b) => a + b, 0);
    const oddDivs = divisors(odd);
    const oddSum = oddDivs.reduce((a, b) => a + b, 0);

    // 偶完全数展示
    text(f, `偶完全数 ${perfect} = 2^${p - 1}(2^${p} − 1)`, w / 2, 48, {
      align: 'center', font: 'bold 17px "Times New Roman", serif', color: C.green,
    });
    text(f, `真因子 ${perfectDivs.slice(0, 6).join(' + ')}${perfectDivs.length > 6 ? ' + …' : ''} = ${perfectSum} ✓`, w / 2, 76, {
      align: 'center', color: C.fg, font: '13px Consolas, monospace',
    });

    // 奇数检验
    const surplus = oddSum - odd;
    text(f, `检验奇数 ${odd}：真因子之和 = ${oddSum}`, w / 2, 116, {
      align: 'center', color: C.accent, font: '14px Consolas, monospace',
    });
    text(f, surplus === 0 ? '完全数！（若出现，将推翻猜想）' : surplus < 0 ? `比自身少 ${-surplus} ⇒ 亏数（不足）` : `比自身多 ${surplus} ⇒ 盈数（过剩）`, w / 2, 144, {
      align: 'center', color: surplus === 0 ? C.hot : C.dim, font: '14px system-ui',
    });

    // 简单的「亏数/盈数」条形
    const barW = Math.min(300, w * 0.4);
    const barX = w / 2 - barW / 2;
    const baseY = h - 150;
    const scale = Math.min(1, (barW / 2) / Math.max(odd, oddSum));
    poly(f, [[barX, baseY], [barX + odd * scale, baseY], [barX + odd * scale, baseY + 26], [barX, baseY + 26]], {
      fill: 'rgba(102,126,234,0.6)', close: true,
    });
    poly(f, [[barX, baseY + 36], [barX + oddSum * scale, baseY + 36], [barX + oddSum * scale, baseY + 62], [barX, baseY + 62]], {
      fill: surplus === 0 ? 'rgba(237,137,54,0.7)' : 'rgba(56,178,172,0.6)', close: true,
    });
    text(f, `n = ${odd}`, barX, baseY - 8, { color: C.fg, font: '12px system-ui' });
    text(f, `σ(n) = ${oddSum}`, barX, baseY + 88, { color: C.cyan, font: '12px system-ui' });

    heading(f, '奇完全数猜想：两千年的空缺');
    footnotes(f, [
      '完全数 = 等于自身所有真因子之和的数：6、28、496、8128…（欧几里得定理给出全部偶完全数）',
      '猜想不存在奇完全数；若存在，它必须大于约 10¹⁵⁰⁰ 且至少有 9 个不同素因子',
      '拖动参数可检验任意奇数：它们总是「亏数」——但检验不是证明',
    ]);
  },
});

// ---------------------------------------------------------------- T135
/** T135 连续统假设。 */
const continuumHypothesisViz = defineViz({
  slug: 'continuum-hypothesis',
  title: '连续统假设',
  params: {
    show: { type: 'select', options: ['显示「中间基数」', '隐藏「中间基数」'], default: '显示「中间基数」', label: '标注' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const show = str(params, 'show', '显示「中间基数」') === '显示「中间基数」';

    const levels = [
      { name: 'ℵ₀', desc: '自然数集 |ℕ|', color: C.cyan, y: 0 },
      { name: '?', desc: '是否存在介于两者之间的基数？', color: C.hot, y: 1, dashed: true },
      { name: '2^ℵ₀', desc: '实数集 |ℝ|（连续统）', color: C.accent, y: 2 },
      { name: '2^(2^ℵ₀)', desc: '实数集的幂集', color: C.warm, y: 3 },
    ];

    const boxH = 52;
    const gapY = (h - 240) / (levels.length - 1 > 0 ? levels.length - 1 : 1);
    levels.forEach((lv, i) => {
      const y = 130 + i * gapY;
      const skip = lv.dashed && !show;
      const bw = skip ? 0 : Math.min(280, w * 0.42);
      if (!skip) {
        const x = w / 2 - bw / 2;
        poly(f, [[x, y], [x + bw, y], [x + bw, y + boxH], [x, y + boxH]], {
          fill: lv.color + (lv.dashed ? '22' : '44'),
          stroke: lv.color, lw: lv.dashed ? 2.2 : 1.8, close: true,
        } as never);
        text(f, lv.name, w / 2, y + boxH / 2 + 2, {
          align: 'center', color: C.fg, font: 'bold 18px "Times New Roman", serif',
        });
        text(f, lv.desc, w / 2 + bw / 2 + 16, y + boxH / 2 + 4, {
          color: lv.dashed ? C.hot : C.dim, font: '12px system-ui',
        });
      }
      if (i < levels.length - 1) {
        const y2 = y + boxH;
        seg(f, w / 2, y2, w / 2, y2 + gapY - boxH, { color: C.grid, lw: 1.4 } as never);
      }
    });

    text(f, '连续统假设（CH）', w / 2, 48, {
      align: 'center', font: 'bold 18px "Times New Roman", serif', color: C.warm,
    });
    text(f, '不存在基数严格介于 ℵ₀ 与 2^ℵ₀ 之间的集合', w / 2, 76, {
      align: 'center', color: C.fg, font: '14px system-ui',
    });
    text(f, '哥德尔（1940）与科恩（1963）证明：CH 在 ZFC 中既不可证也不可否证', w / 2, h - 96, {
      align: 'center', color: C.hot, font: '13px system-ui',
    });

    heading(f, '连续统假设：独立于 ZFC 的命题');
    footnotes(f, [
      '康托尔猜想：实数集的基数是最小的不可数基数——即 ℵ₀ 与 ℝ 之间没有别的基数',
      '哥德尔证明 CH 与 ZFC 相容（可构造出 CH 成立的模型），科恩证明 ¬CH 也相容',
      '结论：CH 独立于 ZFC，无法用集合论公理判定——这是希尔伯特第一问题的最终答案',
    ]);
  },
});

// ---------------------------------------------------------------- T136
/** T136 ABC 猜想。 */
const abcConjectureViz = defineViz({
  slug: 'abc-conjecture',
  title: 'ABC 猜想',
  params: {
    limit: { type: 'range', min: 20, max: 300, default: 120, label: '扫描上限' },
    epsilon: { type: 'range', min: 0.1, max: 1.5, step: 0.05, default: 0.6, label: '指数 ε' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const limit = Math.max(10, Math.round(num(params, 'limit', 120)));
    const eps = num(params, 'epsilon', 0.6);

    const rad = (n: number): number => {
      let r = 1;
      let x = n;
      for (let p = 2; p * p <= x; p++) {
        if (x % p === 0) {
          r *= p;
          while (x % p === 0) x /= p;
        }
      }
      if (x > 1) r *= x;
      return r;
    };
    const gcd = (m: number, n: number): number => (n === 0 ? m : gcd(n, m % n));

    // 找出满足 a + b = c 且 rad(abc) < c 的三元组
    const triples: Array<{ a: number; b: number; c: number; ratio: number }> = [];
    for (let a = 1; a <= limit; a++) {
      for (let b = a; b <= limit; b++) {
        const c = a + b;
        if (gcd(a, b) !== 1) continue;
        const r = rad(a * b * c);
        if (r < c) {
          triples.push({ a, b, c, ratio: Math.log(c) / Math.log(r) });
        }
      }
    }
    triples.sort((x, y) => y.ratio - x.ratio);
    const top = triples.slice(0, 14);

    const v = view(f, { xMin: 1, xMax: 2.2, yMin: 0, yMax: 1.1, inset: 54 });
    grid(f, v, { divisions: 4, ticks: true });
    // 临界线 log c / log rad = 1 + ε
    const thresh = 1 + eps;
    seg(f, v.sx(1), v.sy(Math.min(1.05, (thresh - 1) / 1.2)), v.sx(2.2), v.sy(Math.min(1.05, (thresh - 1) / 1.2)), {
      color: C.hot, lw: 2, dash: [6, 4],
    } as never);
    text(f, `1 + ε = ${thresh.toFixed(2)}`, v.sx(2.18), v.sy(Math.min(1.05, (thresh - 1) / 1.2)) - 8, {
      align: 'right', color: C.hot, font: '11px system-ui',
    });
    top.forEach((t) => {
      const x = t.ratio;
      const y = (t.c / (t.a + t.b + 100)) * 0.8 + (1 - 1 / Math.log10(t.c + 2)) * 0.4;
      dot(f, v.sx(x), v.sy(y), 5, x > thresh ? C.hot : C.accent);
      text(f, `${t.a}+${t.b}=${t.c}`, v.sx(x) + 8, v.sy(y) - 6, { color: C.dim, font: '10px Consolas, monospace' });
    });

    text(f, 'ABC 猜想', w / 2, 48, {
      align: 'center', font: 'bold 18px "Times New Roman", serif', color: C.warm,
    });
    text(f, '互素 a + b = c 时，c 不能比 rad(abc) 大太多（对任意 ε > 0，仅有限例外）', w / 2, 76, {
      align: 'center', color: C.fg, font: '12px system-ui',
    });
    text(f, `本范围内满足 rad(abc) < c 的三元组共 ${triples.length} 个`, w / 2, 100, {
      align: 'center', color: C.accent, font: '13px system-ui',
    });
    text(f, `橙色虚线为 1 + ε = ${thresh.toFixed(2)} 的临界；红点即「超出」的例外`, w / 2, 124, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });

    heading(f, 'ABC 猜想：互素和式的素因子约束');
    footnotes(f, [
      'rad(abc) 是 a、b、c 所有不同素因子的乘积；猜想它很少比 c 小很多',
      '看似技术性的陈述，却能一举推出大量丢番图方程的结论（包括费马大定理的部分情形）',
      '望月新一 2012 年宣布证明（「宇宙际几何」），但至今仍在数学界争议中',
    ]);
  },
});

registerViz(
  hallMarriageViz,
  ramseyTheoremViz,
  pVsNpViz,
  hodgeConjectureViz,
  yangMillsViz,
  navierStokesViz,
  birchSwinnertonDyerViz,
  twinPrimeConjectureViz,
  collatzConjectureViz,
  oddPerfectNumberViz,
  continuumHypothesisViz,
  abcConjectureViz,
);
