import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import {
  C,
  PALETTE,
  bars,
  dot,
  footnotes,
  gaussians,
  grid,
  heading,
  poly,
  rng,
  seg,
  text,
  view,
} from '../canvas';

const NODES: Array<[number, number]> = [
  [0.08, 0.5], [0.3, 0.2], [0.3, 0.8], [0.55, 0.35], [0.55, 0.75], [0.8, 0.2], [0.8, 0.62], [0.95, 0.42],
];
const EDGES: Array<[number, number]> = [
  [0, 1], [0, 2], [1, 3], [2, 3], [2, 4], [3, 4], [3, 5], [3, 6], [4, 6], [5, 6], [5, 7], [6, 7],
];

/** A72 图论深化。 */
const graphTheoryA72 = defineViz({
  slug: 'graph-theory-a72',
  title: '图论深化',
  params: {
    metric: { type: 'select', options: ['度分布', '连通分量', '二分图判定'], default: '度分布', label: '分析' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const metric = str(params, 'metric', '度分布');
    const adj: number[][] = NODES.map(() => []);
    EDGES.forEach(([u, v]) => {
      adj[u].push(v);
      adj[v].push(u);
    });
    const degree = adj.map((a) => a.length);
    const px = (p: [number, number]): [number, number] => [60 + p[0] * (w - 140), 54 + p[1] * (h - 130)];

    let nodeColors: string[] = NODES.map(() => C.accent);
    if (metric === '度分布') {
      const maxD = Math.max(...degree);
      nodeColors = degree.map((d) => PALETTE[Math.min(PALETTE.length - 1, Math.round((d / maxD) * 4))]);
    } else if (metric === '连通分量') {
      const comp = new Array<number>(NODES.length).fill(-1);
      let c = 0;
      for (let i = 0; i < NODES.length; i++) {
        if (comp[i] >= 0) continue;
        const stack = [i];
        comp[i] = c;
        while (stack.length) {
          const cur = stack.pop() as number;
          for (const nb of adj[cur]) if (comp[nb] < 0) {
            comp[nb] = c;
            stack.push(nb);
          }
        }
        c++;
      }
      nodeColors = comp.map((cc) => PALETTE[cc % PALETTE.length]);
    } else {
      // 二分图着色
      const color = new Array<number>(NODES.length).fill(-1);
      for (let i = 0; i < NODES.length; i++) {
        if (color[i] >= 0) continue;
        color[i] = 0;
        const queue = [i];
        while (queue.length) {
          const cur = queue.shift() as number;
          for (const nb of adj[cur]) {
            if (color[nb] < 0) {
              color[nb] = 1 - color[cur];
              queue.push(nb);
            }
          }
        }
      }
      nodeColors = color.map((c) => (c === 0 ? C.accent : C.hot));
    }

    EDGES.forEach(([u, v]) => {
      const [x1, y1] = px(NODES[u]);
      const [x2, y2] = px(NODES[v]);
      seg(f, x1, y1, x2, y2, 'rgba(160,174,192,0.4)', 1.4);
    });
    NODES.forEach((p, i) => {
      const [x, y] = px(p);
      dot(f, x, y, 13, nodeColors[i]);
      text(f, String(degree[i]), x, y + 5, { align: 'center', color: '#fff', font: 'bold 11px sans-serif' });
    });

    const edgesCount = EDGES.length;
    const info = metric === '度分布'
      ? `平均度 = 2|E|/|V| = ${(2 * edgesCount / NODES.length).toFixed(3)}，最大度 = ${Math.max(...degree)}`
      : metric === '连通分量'
        ? `图分成若干连通分量（同色为同一分量），分量内任意两点都有路径相连`
        : '二分图判定：用 BFS 交替染两色，若发现同色相邻则不是二分图';
    footnotes(f, [
      `|V| = ${NODES.length}，|E| = ${edgesCount}，节点内数字为度数`,
      info,
      '图论把"关系"抽象成点与边：社交网络、地图导航、任务依赖、化学分子都是图',
    ]);
    heading(f, `图论深化：${metric}`);
  },
});

/** A73 图着色深化。 */
const graphColoringA73 = defineViz({
  slug: 'graph-coloring-a73',
  title: '图着色深化',
  params: {
    order: { type: 'select', options: ['按度降序（Welsh-Powell）', '按编号顺序'], default: '按度降序（Welsh-Powell）', label: '着色顺序' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const order = str(params, 'order', '按度降序（Welsh-Powell）');
    const adj: number[][] = NODES.map(() => []);
    EDGES.forEach(([u, v]) => {
      adj[u].push(v);
      adj[v].push(u);
    });
    const seq = NODES.map((_, i) => i).sort((a, b) => (order.startsWith('按度') ? adj[b].length - adj[a].length : a - b));
    const color = new Array<number>(NODES.length).fill(-1);
    let used = 0;
    for (const node of seq) {
      const taken = new Set(adj[node].filter((nb) => color[nb] >= 0).map((nb) => color[nb]));
      let c = 0;
      while (taken.has(c)) c++;
      color[node] = c;
      used = Math.max(used, c + 1);
    }
    // 冲突检测
    const conflicts = EDGES.filter(([u, v]) => color[u] === color[v]).length;

    const px = (p: [number, number]): [number, number] => [60 + p[0] * (w - 140), 54 + p[1] * (h - 130)];
    EDGES.forEach(([u, v]) => {
      const [x1, y1] = px(NODES[u]);
      const [x2, y2] = px(NODES[v]);
      seg(f, x1, y1, x2, y2, color[u] === color[v] ? `${C.hot}cc` : 'rgba(160,174,192,0.35)', color[u] === color[v] ? 2.6 : 1.4);
    });
    NODES.forEach((p, i) => {
      const [x, y] = px(p);
      dot(f, x, y, 14, PALETTE[color[i] % PALETTE.length]);
      text(f, String(color[i] + 1), x, y + 5, { align: 'center', color: '#fff', font: 'bold 12px sans-serif' });
    });
    // 颜色使用统计
    const counts = new Array<number>(used).fill(0);
    color.forEach((c) => counts[c]++);
    counts.forEach((c, i) => {
      const x = 60 + i * 60;
      const y = h - 40;
      dot(f, x, y, 8, PALETTE[i % PALETTE.length]);
      text(f, `×${c}`, x + 14, y + 4, { color: C.dim, font: '11px sans-serif' });
    });

    footnotes(f, [
      `${order}：用 ${used} 种颜色完成着色，冲突边 ${conflicts} 条（应为 0）`,
      '贪心着色不保证最优：不同访问顺序可能得到不同的颜色数（色数是 NP 难问题）',
      '四色定理（1976 年 Appel-Haken 计算机证明）：任何平面图都能用 4 色着色',
    ]);
    heading(f, `图着色：${order}`);
  },
});

/** A74 欧拉与哈密顿深化。 */
const eulerHamiltonPathA74 = defineViz({
  slug: 'euler-hamilton-path-a74',
  title: '欧拉哈密顿深化',
  params: {
    graph: { type: 'select', options: ['欧拉图（全偶度）', '半欧拉图（2 奇度）', '非欧拉图（4 奇度）'], default: '半欧拉图（2 奇度）', label: '图类型' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const gt = str(params, 'graph', '半欧拉图（2 奇度）');
    // 三种度配置的图
    const spec = gt.startsWith('欧拉图')
      ? { nodes: [[0.2, 0.5], [0.5, 0.2], [0.5, 0.8], [0.8, 0.5]] as Array<[number, number]>, edges: [[0, 1], [0, 2], [1, 3], [2, 3]] as Array<[number, number]> }
      : gt.startsWith('半欧拉图')
        ? { nodes: [[0.15, 0.5], [0.4, 0.2], [0.4, 0.8], [0.68, 0.5], [0.9, 0.3]] as Array<[number, number]>, edges: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]] as Array<[number, number]> }
        : { nodes: [[0.15, 0.35], [0.15, 0.75], [0.45, 0.2], [0.45, 0.9], [0.8, 0.35], [0.8, 0.75]] as Array<[number, number]>, edges: [[0, 1], [2, 3], [4, 5], [0, 2], [1, 3], [2, 4], [3, 5]] as Array<[number, number]> };

    const adj = new Map<number, number[]>();
    spec.nodes.forEach((_, i) => adj.set(i, []));
    spec.edges.forEach(([u, v]) => {
      (adj.get(u) as number[]).push(v);
      (adj.get(v) as number[]).push(u);
    });
    const odd = spec.nodes.map((_, i) => (adj.get(i) as number[]).length % 2 === 1);
    const oddCount = odd.filter(Boolean).length;

    const px = (p: [number, number]): [number, number] => [60 + p[0] * (w - 140), 54 + p[1] * (h - 130)];
    // Hierholzer 求欧拉路径
    const edgeUsed = new Array<boolean>(spec.edges.length).fill(false);
    const start = oddCount === 2 ? odd.findIndex(Boolean) : 0;
    const stack = [start];
    const tour: number[] = [];
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const edgeIdx = spec.edges.findIndex(([u, v], i) => !edgeUsed[i] && (u === cur || v === cur));
      if (edgeIdx < 0) {
        tour.push(stack.pop() as number);
      } else {
        edgeUsed[edgeIdx] = true;
        const [u, v] = spec.edges[edgeIdx];
        stack.push(u === cur ? v : u);
      }
    }
    const tourEdges: Array<[number, number]> = [];
    for (let i = 0; i + 1 < tour.length; i++) tourEdges.push([tour[i], tour[i + 1]]);

    spec.edges.forEach(([u, v]) => {
      const [x1, y1] = px(spec.nodes[u]);
      const [x2, y2] = px(spec.nodes[v]);
      const on = tourEdges.some(([p, q]) => (p === u && q === v) || (p === v && q === u));
      seg(f, x1, y1, x2, y2, on ? C.green : 'rgba(160,174,192,0.35)', on ? 3 : 1.4);
    });
    spec.nodes.forEach((p, i) => {
      const [x, y] = px(p);
      dot(f, x, y, 13, odd[i] ? C.hot : C.accent);
      text(f, String((adj.get(i) as number[]).length), x, y + 5, { align: 'center', color: '#fff', font: 'bold 11px sans-serif' });
    });

    footnotes(f, [
      `奇度节点 ${oddCount} 个（红色）：${oddCount === 0 ? '存在欧拉回路（可一笔画回到起点）' : oddCount === 2 ? '存在欧拉路径（可一笔画但不回到起点）' : '不存在一笔画（奇度点 > 2）'}`,
      '欧拉路径的判定只看度数：这是图论中最简洁的"存在性判据"之一（对应中国邮递员问题）',
      '哈密顿路径（经过每个点恰好一次）没有这样的判据 —— 判定与求解都是 NP 完全问题',
    ]);
    heading(f, `欧拉路径：${gt}`);
  },
});

/** A75 PageRank 深化。 */
const pagerankA75 = defineViz({
  slug: 'pagerank-a75',
  title: 'PageRank深化',
  params: {
    damping: { type: 'range', min: 0.5, max: 0.95, default: 0.85, step: 0.05, label: '阻尼系数 d' },
    iterations: { type: 'range', min: 1, max: 40, default: 15, label: '迭代轮数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const d = num(params, 'damping', 0.85);
    const iters = Math.round(num(params, 'iterations', 15));
    const n = NODES.length;
    // 有向边（含悬挂节点处理）
    const arcs: Array<[number, number]> = [
      [0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 4], [4, 5], [5, 6], [6, 5], [6, 7], [3, 7], [7, 6],
    ];
    const out: number[][] = NODES.map(() => []);
    arcs.forEach(([u, v]) => out[u].push(v));

    let rank = new Array<number>(n).fill(1 / n);
    const history: Array<number[]> = [rank];
    for (let it = 0; it < iters; it++) {
      const next = new Array<number>(n).fill((1 - d) / n);
      // 悬挂节点（无出边）均分
      let dangling = 0;
      for (let u = 0; u < n; u++) {
        if (out[u].length === 0) {
          dangling += rank[u];
          continue;
        }
        for (const v of out[u]) next[v] += (d * rank[u]) / out[u].length;
      }
      for (let v = 0; v < n; v++) next[v] += (d * dangling) / n;
      rank = next;
      history.push(rank);
    }
    const maxRank = Math.max(...rank);

    const px = (p: [number, number]): [number, number] => [60 + p[0] * (w - 150), 60 + p[1] * (h - 180)];
    arcs.forEach(([u, v]) => {
      const a = px(NODES[u]);
      const b = px(NODES[v]);
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const shrink = 15;
      const x1 = a[0] + Math.cos(ang) * shrink;
      const y1 = a[1] + Math.sin(ang) * shrink;
      const x2 = b[0] - Math.cos(ang) * shrink;
      const y2 = b[1] - Math.sin(ang) * shrink;
      seg(f, x1, y1, x2, y2, 'rgba(160,174,192,0.4)', 1.2);
      f.ctx.save();
      f.ctx.fillStyle = 'rgba(160,174,192,0.7)';
      f.ctx.beginPath();
      f.ctx.moveTo(x2, y2);
      f.ctx.lineTo(x2 - 7 * Math.cos(ang - 0.4), y2 - 7 * Math.sin(ang - 0.4));
      f.ctx.lineTo(x2 - 7 * Math.cos(ang + 0.4), y2 - 7 * Math.sin(ang + 0.4));
      f.ctx.closePath();
      f.ctx.fill();
      f.ctx.restore();
    });
    NODES.forEach((p, i) => {
      const [x, y] = px(p);
      const r = 9 + (rank[i] / maxRank) * 17;
      dot(f, x, y, r, i === 5 || i === 6 ? C.warm : C.accent);
      text(f, String(i), x, y + 4, { align: 'center', color: '#fff', font: 'bold 11px sans-serif' });
    });
    // 收敛曲线
    const gv = view(f, { xMin: 0, xMax: iters, yMin: 0, yMax: maxRank * 1.2, inset: 30, insetRight: w * 0.5 });
    [5, 6, 0].forEach((node, k) => {
      poly(f, history.map((r2, i) => [gv.sx(i), gv.sy(r2[node])] as [number, number]), { stroke: PALETTE[k], lw: 1.8 });
    });

    const sorted = rank.map((v, i) => [i, v] as [number, number]).sort((a, b) => b[1] - a[1]);
    footnotes(f, [
      `${iters} 轮后权重排序：${sorted.slice(0, 3).map(([i, v]) => `#${i}=${v.toFixed(4)}`).join('  ')}（右上三条曲线为 #5、#6、#0 的收敛过程）`,
      `悬挂节点权重均分 + 阻尼系数 d = ${d}：PR = (1-d)/n + d·(Σ 入链贡献)`,
      'PageRank = 求转移矩阵的主特征向量（幂迭代）；d 保证矩阵不可约，迭代一定收敛到唯一平稳分布',
    ]);
    heading(f, 'PageRank：迭代收敛与权重');
  },
});

/** A76 马尔可夫链深化。 */
const markovChain = defineViz({
  slug: 'markov-chain',
  title: '马尔可夫链深化',
  params: {
    persistence: { type: 'range', min: 0.5, max: 0.95, default: 0.8, step: 0.01, label: '状态保持概率' },
    steps: { type: 'range', min: 10, max: 60, default: 30, label: '模拟步数' },
    runs: { type: 'range', min: 1, max: 8, default: 4, label: '样本轨迹' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const p = num(params, 'persistence', 0.8);
    const steps = Math.round(num(params, 'steps', 30));
    const runs = Math.round(num(params, 'runs', 4));
    const rand = rng(4242);
    // 三状态链
    const P = [
      [p, (1 - p) / 2, (1 - p) / 2],
      [(1 - p) / 2, p, (1 - p) / 2],
      [(1 - p) / 2, (1 - p) / 2, p],
    ];
    const sample = (cur: number): number => {
      const r = rand();
      let acc = 0;
      for (let s = 0; s < 3; s++) {
        acc += P[cur][s];
        if (r <= acc) return s;
      }
      return cur;
    };

    const top = 56;
    const plotH = (h - 200) / 2;
    // 轨迹
    for (let k = 0; k < runs; k++) {
      let cur = Math.floor(rand() * 3);
      const pts: Array<[number, number]> = [[40, top + plotH - (cur / 2) * plotH * 0.85]];
      for (let s = 1; s <= steps; s++) {
        cur = sample(cur);
        pts.push([40 + (s / steps) * (w - 90), top + plotH - (cur / 2) * plotH * 0.85]);
      }
      poly(f, pts, { stroke: `${PALETTE[k % PALETTE.length]}cc`, lw: 1.6 });
    }
    text(f, '样本轨迹（阶梯线表示状态跳转）', 44, top - 8, { color: C.dim, font: '12px sans-serif' });

    // 转移矩阵
    const base2 = top + plotH + 50;
    const cell = Math.min(46, (w - 200) / 3);
    P.forEach((row, i) => {
      row.forEach((val, j) => {
        const x = 100 + j * (cell + 4);
        const y = base2 + i * (cell + 4);
        f.ctx.save();
        f.ctx.fillStyle = `hsla(230, 60%, ${20 + val * 40}%, 0.95)`;
        f.ctx.fillRect(x, y, cell, cell);
        f.ctx.restore();
        text(f, val.toFixed(2), x + cell / 2, y + cell * 0.65, { align: 'center', color: C.fg, font: '11px Consolas, monospace' });
      });
      text(f, `状态 ${i}`, 94, base2 + i * (cell + 4) + cell * 0.65, { align: 'right', color: C.dim, font: '11px sans-serif' });
    });
    text(f, '转移矩阵 P：行和恒为 1', 100, base2 - 8, { color: C.dim, font: '11px sans-serif' });

    footnotes(f, [
      `保持概率 ${p}：下一状态只依赖当前状态（无记忆性 —— 马尔可夫性质）`,
      '转移矩阵每行之和为 1（概率分布），P^n 的第 i 行就是"从状态 i 出发 n 步后的分布"',
      '马尔可夫链是 MCMC、隐马尔可夫、强化学习、PageRank 的共同数学框架',
    ]);
    heading(f, '马尔可夫链：状态转移');
  },
});

/** A77 马尔可夫平稳分布。 */
const markovStationary = defineViz({
  slug: 'markov-stationary',
  title: '马尔可夫平稳分布',
  params: {
    p12: { type: 'range', min: 0.05, max: 0.95, default: 0.3, step: 0.05, label: 'P(1→2)' },
    p21: { type: 'range', min: 0.05, max: 0.95, default: 0.6, step: 0.05, label: 'P(2→1)' },
    start: { type: 'select', options: ['从状态 1 出发', '从状态 2 出发', '均匀分布'], default: '从状态 1 出发', label: '初始分布' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const p12 = num(params, 'p12', 0.3);
    const p21 = num(params, 'p21', 0.6);
    const startMode = str(params, 'start', '从状态 1 出发');
    const P = [[1 - p12, p12], [p21, 1 - p21]];
    let dist: [number, number] = startMode.startsWith('从状态 1') ? [1, 0] : startMode.startsWith('从状态 2') ? [0, 1] : [0.5, 0.5];

    const history: Array<[number, number]> = [dist];
    for (let i = 0; i < 20; i++) {
      dist = [dist[0] * P[0][0] + dist[1] * P[1][0], dist[0] * P[0][1] + dist[1] * P[1][1]];
      history.push([dist[0], dist[1]]);
    }
    // 平稳分布解析解
    const pi1 = p21 / (p12 + p21);
    const pi2 = p12 / (p12 + p21);

    const v = view(f, { xMin: 0, xMax: 20, yMin: 0, yMax: 1.05, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });
    poly(f, history.map(([a], i) => [v.sx(i), v.sy(a)] as [number, number]), { stroke: C.accent, lw: 2.4 });
    poly(f, history.map(([, b], i) => [v.sx(i), v.sy(b)] as [number, number]), { stroke: C.warm, lw: 2.4 });
    seg(f, v.sx(0), v.sy(pi1), v.sx(20), v.sy(pi1), `${C.green}88`, 1.6);
    seg(f, v.sx(0), v.sy(pi2), v.sx(20), v.sy(pi2), `${C.cool}88`, 1.6);

    footnotes(f, [
      `平稳分布 π = (${pi1.toFixed(4)}, ${pi2.toFixed(4)})（绿色/蓝色虚线），与初始分布无关`,
      `解方程 πP = π 得 π₁ = P(2→1)/(P(1→2)+P(2→1)) = ${pi1.toFixed(4)}`,
      startMode.startsWith('均匀') ? '从均匀分布出发：两步就基本收敛到平稳分布' : '从单点出发：分布迅速收敛到同一个平稳分布（遍历性）',
    ]);
    heading(f, '马尔可夫链的平稳分布');
  },
});

/** A78 信息论基础。 */
const entropyCoding = defineViz({
  slug: 'entropy-coding',
  title: '信息论基础',
  params: {
    p: { type: 'range', min: 0.02, max: 0.98, default: 0.25, step: 0.01, label: 'P(正面) p' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const p = num(params, 'p', 0.25);
    const q = 1 - p;
    const H = -(p > 0 ? p * Math.log2(p) : 0) - (q > 0 ? q * Math.log2(q) : 0);
    const Hmax = 1;
    // 编码长度与熵的关系
    const gv = view(f, { xMin: 0, xMax: 1, yMin: 0, yMax: 1.05, inset: 42 });
    grid(f, gv, { divisions: 5, ticks: true });
    const entropyCurve: Array<[number, number]> = [];
    const avgHuffman: Array<[number, number]> = [];
    for (let i = 1; i < 100; i++) {
      const pp = i / 100;
      const hh = -(pp * Math.log2(pp) + (1 - pp) * Math.log2(1 - pp));
      entropyCurve.push([gv.sx(pp), gv.sy(hh)]);
      // 哈夫曼平均码长（二元情形：短码给大概率符号）
      const len = pp >= 0.5 ? 1 + (1 - pp) : 1 + pp;
      avgHuffman.push([gv.sx(pp), gv.sy(Math.min(1, len))]);
    }
    poly(f, entropyCurve, { stroke: C.accent, lw: 2.6 });
    poly(f, avgHuffman, { stroke: C.warm, lw: 1.8, dash: [6, 4] });
    dot(f, gv.sx(p), gv.sy(H), 5.5, C.green);

    footnotes(f, [
      `p = ${p}：熵 H = -p·log₂p - q·log₂q = ${H.toFixed(4)} bit（橙色虚线是哈夫曼平均码长 ${(p >= 0.5 ? 2 - p : 1 + p).toFixed(4)}）`,
      `熵是"平均信息量"的下界：p = 0.5 时熵最大（1 bit，完全随机，最难压缩）；p → 0 或 1 时熵 → 0`,
      '香农信源编码定理：无损压缩的平均码长不可能小于熵 —— 这是压缩的物理极限',
    ]);
    heading(f, '熵与压缩极限');
  },
});

/** A79 互信息。 */
const mutualInformation = defineViz({
  slug: 'mutual-information',
  title: '互信息',
  params: {
    correlation: { type: 'range', min: 0, max: 0.95, default: 0.6, step: 0.05, label: '相关性 ρ' },
    samples: { type: 'range', min: 500, max: 5000, default: 2000, step: 100, label: '样本数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const rho = num(params, 'correlation', 0.6);
    const count = Math.round(num(params, 'samples', 2000));
    const rand = rng(8899);
    // 生成相关的二元高斯
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < count; i++) {
      const x = gaussians(rand, 1)[0];
      const e = gaussians(rand, 1)[0];
      pts.push([x, rho * x + Math.sqrt(1 - rho * rho) * e]);
    }
    // 分箱估计互信息
    const bins = 12;
    const range = 3;
    const joint = Array.from({ length: bins }, () => new Array<number>(bins).fill(0));
    const pxArr = new Array<number>(bins).fill(0);
    const pyArr = new Array<number>(bins).fill(0);
    pts.forEach(([x, y]) => {
      const bx = Math.min(bins - 1, Math.max(0, Math.floor(((x + range) / (2 * range)) * bins)));
      const by = Math.min(bins - 1, Math.max(0, Math.floor(((y + range) / (2 * range)) * bins)));
      joint[bx][by]++;
      pxArr[bx]++;
      pyArr[by]++;
    });
    let mi = 0;
    for (let i = 0; i < bins; i++) {
      for (let j = 0; j < bins; j++) {
        const pj = joint[i][j] / count;
        const pxj = pxArr[i] / count;
        const pyj = pyArr[j] / count;
        if (pj > 0 && pxj > 0 && pyj > 0) mi += pj * Math.log2(pj / (pxj * pyj));
      }
    }
    const theory = -0.5 * Math.log2(1 - rho * rho);

    // 左：散点
    const lv = view(f, { xMin: -3, xMax: 3, yMin: -3, yMax: 3, inset: 34, insetRight: w / 2 + 10 });
    pts.slice(0, 600).forEach(([x, y]) => dot(f, lv.sx(x), lv.sy(y), 1.6, `${C.accent}77`));
    grid(f, lv, { divisions: 3, ticks: false });

    // 右：联合分布热图
    const cell = Math.min((w / 2 - 100) / bins, (h - 175) / bins);
    const ox = w / 2 + 40;
    const oy = 56;
    for (let i = 0; i < bins; i++) {
      for (let j = 0; j < bins; j++) {
        const val = joint[i][j] / count;
        const maxVal = Math.max(...joint.flat()) / count;
        f.ctx.save();
        f.ctx.fillStyle = `hsla(230, 65%, ${20 + (val / maxVal) * 45}%, 0.95)`;
        f.ctx.fillRect(ox + j * cell, oy + i * cell, cell - 1, cell - 1);
        f.ctx.restore();
      }
    }
    text(f, '联合分布 P(X,Y)', ox, oy - 8, { color: C.dim, font: '11px sans-serif' });

    footnotes(f, [
      `相关系数 ρ = ${rho}：样本互信息估计 = ${mi.toFixed(4)} bit，理论值 -½log₂(1-ρ²) = ${theory.toFixed(4)} bit`,
      '互信息 I(X;Y) = H(X) + H(Y) - H(X,Y)：衡量"知道 X 后 Y 的不确定性减少了多少"',
      '互信息比相关系数更一般：它能捕捉非线性依赖（相关系数为 0 不代表独立，但互信息为 0 则独立）',
    ]);
    heading(f, '互信息与联合分布');
  },
});

registerViz(
  graphTheoryA72,
  graphColoringA73,
  eulerHamiltonPathA74,
  pagerankA75,
  markovChain,
  markovStationary,
  entropyCoding,
  mutualInformation,
);
