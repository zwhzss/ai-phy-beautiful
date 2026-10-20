import { defineViz, num, str, VizFrame } from '../types';
import { registerViz } from '../registry';
import {
  C,
  PALETTE,
  bars,
  dot,
  footnotes,
  grid,
  heading,
  poly,
  rng,
  seg,
  text,
  view,
} from '../canvas';

/** 演示用的加权图（归一化坐标）。 */
const NODES: Array<[number, number]> = [
  [0.08, 0.5], [0.28, 0.16], [0.28, 0.84], [0.52, 0.3],
  [0.52, 0.72], [0.76, 0.16], [0.76, 0.62], [0.94, 0.4],
];
const EDGES: Array<[number, number, number]> = [
  [0, 1, 4], [0, 2, 3], [1, 3, 6], [2, 3, 2], [2, 4, 5],
  [3, 4, 1], [3, 5, 7], [4, 6, 4], [5, 6, 2], [6, 7, 3], [3, 7, 9],
];

/** 把归一化坐标映射到画布并画图；可高亮指定边集合。 */
function drawGraph(
  f: VizFrame,
  highlightEdges: Array<[number, number]> = [],
  labels?: Map<number, string>,
  nodeColors?: string[],
  edgeLabels = false,
): void {
  const { w, h } = f;
  const px = (p: [number, number]): [number, number] => [60 + p[0] * (w - 120), 54 + p[1] * (h - 120)];
  for (const [u, v0, weight] of EDGES) {
    const a = px(NODES[u]);
    const b = px(NODES[v0]);
    const on = highlightEdges.some(([x, y]) => (x === u && y === v0) || (x === v0 && y === u));
    seg(f, a[0], a[1], b[0], b[1], on ? C.green : 'rgba(160,174,192,0.35)', on ? 3.2 : 1.4);
    if (edgeLabels) {
      text(f, String(weight), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 6, {
        align: 'center',
        color: on ? C.green : C.dim,
        font: '11px sans-serif',
      });
    }
  }
  NODES.forEach((p, i) => {
    const [x, y] = px(p);
    dot(f, x, y, 13, nodeColors?.[i] ?? C.accent);
    text(f, labels?.get(i) ?? String(i), x, y + 5, { align: 'center', color: '#fff', font: 'bold 12px sans-serif' });
  });
}

/** I45 BFS 与 DFS。 */
const bfsDfs = defineViz({
  slug: 'bfs-dfs',
  title: 'BFS 与 DFS',
  params: {
    mode: { type: 'select', options: ['BFS 广度优先', 'DFS 深度优先'], default: 'BFS 广度优先', label: '遍历方式' },
    start: { type: 'range', min: 0, max: 7, default: 0, label: '起点' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = str(params, 'mode', 'BFS 广度优先');
    const start = Math.round(num(params, 'start', 0));
    const adj: number[][] = NODES.map(() => []);
    for (const [u, v0] of EDGES) {
      adj[u].push(v0);
      adj[v0].push(u);
    }

    const order: number[] = [];
    const treeEdges: Array<[number, number]> = [];
    const visited = new Set<number>();
    if (mode.startsWith('BFS')) {
      const queue = [start];
      visited.add(start);
      while (queue.length) {
        const cur = queue.shift() as number;
        order.push(cur);
        for (const nb of adj[cur]) {
          if (!visited.has(nb)) {
            visited.add(nb);
            treeEdges.push([cur, nb]);
            queue.push(nb);
          }
        }
      }
    } else {
      const stack = [start];
      while (stack.length) {
        const cur = stack.pop() as number;
        if (visited.has(cur)) continue;
        visited.add(cur);
        order.push(cur);
        for (const nb of [...adj[cur]].reverse()) {
          if (!visited.has(nb)) {
            treeEdges.push([cur, nb]);
            stack.push(nb);
          }
        }
      }
    }

    const labels = new Map<number, string>();
    order.forEach((n, i) => labels.set(n, `${n}·${i + 1}`));
    drawGraph(f, treeEdges, labels, undefined, false);

    footnotes(f, [
      `${mode}从节点 ${start} 出发的访问顺序：${order.join(' → ')}`,
      mode.startsWith('BFS')
        ? 'BFS 用队列，逐层推进；在无权图上给出最短路径（边数最少）'
        : 'DFS 用栈（或递归），一条路走到底再回溯；常用于拓扑排序与连通性判断',
      '两者时间复杂度都是 O(V + E)，差别在于访问顺序与所需空间',
    ]);
    heading(f, `${mode}（绿色为遍历树边）`);
  },
});

/** I46 Dijkstra 算法。 */
const dijkstra = defineViz({
  slug: 'dijkstra',
  title: 'Dijkstra算法',
  params: {
    source: { type: 'range', min: 0, max: 7, default: 0, label: '源点' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const source = Math.round(num(params, 'source', 0));
    const dist = NODES.map(() => Infinity);
    const prev = NODES.map(() => -1);
    const done = new Set<number>();
    dist[source] = 0;
    const treeEdges: Array<[number, number]> = [];

    while (done.size < NODES.length) {
      let u = -1;
      let best = Infinity;
      for (let i = 0; i < NODES.length; i++) {
        if (!done.has(i) && dist[i] < best) {
          best = dist[i];
          u = i;
        }
      }
      if (u === -1) break;
      done.add(u);
      if (prev[u] >= 0) treeEdges.push([prev[u], u]);
      for (const [a, b, wgt] of EDGES) {
        const nb = a === u ? b : b === u ? a : -1;
        if (nb < 0) continue;
        if (dist[u] + wgt < dist[nb]) {
          dist[nb] = dist[u] + wgt;
          prev[nb] = u;
        }
      }
    }

    const labels = new Map<number, string>();
    NODES.forEach((_, i) => labels.set(i, dist[i] === Infinity ? '∞' : String(dist[i])));
    drawGraph(f, treeEdges, labels, undefined, true);

    footnotes(f, [
      `以节点 ${source} 为源点的单源最短路径（节点内数字为最短距离）`,
      `最远点距离 = ${Math.max(...dist.filter((x) => Number.isFinite(x)))}，绿色边构成最短路径树`,
      'Dijkstra 每次取出"当前未确定中距离最小"的点并松弛其邻边；不能处理负权边（改用 Bellman-Ford）',
    ]);
    heading(f, 'Dijkstra：单源最短路径');
  },
});

/** I47 排序算法。 */
const sortingAlgorithms = defineViz({
  slug: 'sorting-algorithms',
  title: '排序算法',
  params: {
    algorithm: { type: 'select', options: ['冒泡排序', '选择排序', '插入排序', '归并排序'], default: '冒泡排序', label: '算法' },
    count: { type: 'range', min: 6, max: 30, default: 14, label: '元素个数' },
    progress: { type: 'range', min: 0, max: 100, default: 40, label: '执行进度(%)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const algorithm = str(params, 'algorithm', '冒泡排序');
    const count = Math.round(num(params, 'count', 14));
    const progress = num(params, 'progress', 40) / 100;
    const rand = rng(4242);
    const arr = Array.from({ length: count }, () => Math.round(rand() * 90) + 10);

    // 记录关键比较/交换状态（用一次性模拟的快照，简化：直接展示已排序区间）
    const sortedBoundary = Math.floor(progress * count);
    const sorted = [...arr].sort((a, b) => a - b);
    for (let i = 0; i < sortedBoundary; i++) arr[i] = sorted[i];

    bars(f, arr, { x: 40, y: 60, w: w - 80, h: h - 175, colors: arr.map((v0, i) => (i < sortedBoundary ? C.green : C.accent)) });
    seg(f, 40 + ((w - 80) * sortedBoundary) / count, 56, 40 + ((w - 80) * sortedBoundary) / count, h - 111, C.warm, 2);

    const complexity: Record<string, string> = {
      '冒泡排序': '平均 O(n²)，稳定，每轮把最大值"冒"到末尾',
      '选择排序': '平均 O(n²)，不稳定，每轮选出最小值放到已排序区末尾',
      '插入排序': '平均 O(n²)，稳定，把新元素插入到已排好序的前缀中',
      '归并排序': '稳定 O(n log n)，分治 + 合并，需要 O(n) 额外空间',
    };
    footnotes(f, [
      `进度 ${(progress * 100).toFixed(0)}%：橙色分界线左侧为已就位的有序区间`,
      complexity[algorithm] ?? '',
      '比较排序的下界是 Ω(n log n)；计数排序/基数排序用额外空间突破这一下界',
    ]);
    heading(f, `排序算法：${algorithm}`);
  },
});

/** I48 动态规划。 */
const dynamicProgramming = defineViz({
  slug: 'dynamic-programming',
  title: '动态规划',
  params: {
    problem: { type: 'select', options: ['爬楼梯', '0/1 背包'], default: '0/1 背包', label: '问题' },
    n: { type: 'range', min: 4, max: 10, default: 7, label: '规模 n' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const problem = str(params, 'problem', '0/1 背包');
    const n = Math.round(num(params, 'n', 7));

    let table: number[][] = [];
    let rowLabels: string[] = [];
    let colLabels: string[] = [];
    let note = '';
    if (problem === '爬楼梯') {
      const dp = [1, 1];
      for (let i = 2; i <= n; i++) dp.push(dp[i - 1] + dp[i - 2]);
      table = [dp.slice(1)];
      rowLabels = ['方案数'];
      colLabels = Array.from({ length: n }, (_, i) => `n=${i + 1}`);
      note = `每次可走 1 或 2 级，走到第 n 级的方法数 = ${dp[n]}（即斐波那契）`;
    } else {
      const weights = Array.from({ length: n }, (_, i) => (i * 3) % 5 + 1);
      const values = Array.from({ length: n }, (_, i) => (i * 7) % 6 + 2);
      const capacity = Math.min(12, n + 4);
      const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(capacity + 1).fill(0));
      for (let i = 1; i <= n; i++) {
        for (let cap = 0; cap <= capacity; cap++) {
          dp[i][cap] = dp[i - 1][cap];
          if (cap >= weights[i - 1]) {
            dp[i][cap] = Math.max(dp[i][cap], dp[i - 1][cap - weights[i - 1]] + values[i - 1]);
          }
        }
      }
      table = dp;
      rowLabels = ['—', ...Array.from({ length: n }, (_, i) => `物品${i + 1}(w${weights[i]},v${values[i]})`)];
      colLabels = Array.from({ length: capacity + 1 }, (_, c) => `c=${c}`);
      note = `容量 ${capacity} 时的最大价值 = ${dp[n][capacity]}`;
    }

    const rows = table.length;
    const cols = Math.max(...table.map((r) => r.length));
    const cell = Math.min((w - 200) / cols, (h - 180) / rows, 30);
    const maxV = Math.max(...table.flat());
    const ox = 150;
    const oy = 60;
    colLabels.forEach((label, c) => {
      text(f, label, ox + c * cell + cell / 2, oy - 6, { align: 'center', color: C.dim, font: '9px sans-serif' });
    });
    table.forEach((row, r) => {
      text(f, rowLabels[r] ?? '', ox - 8, oy + r * cell + cell * 0.65, { align: 'right', color: C.dim, font: '10px sans-serif' });
      row.forEach((value, c) => {
        const t = maxV === 0 ? 0 : value / maxV;
        f.ctx.save();
        f.ctx.fillStyle = `hsl(230, 55%, ${22 + t * 34}%)`;
        f.ctx.fillRect(ox + c * cell, oy + r * cell, cell - 1.5, cell - 1.5);
        f.ctx.restore();
        if (cell > 18) {
          text(f, String(value), ox + c * cell + cell / 2, oy + r * cell + cell * 0.68, { align: 'center', color: C.fg, font: '10px sans-serif' });
        }
      });
    });

    footnotes(f, [
      note,
      '动态规划三要素：最优子结构、重叠子问题、状态转移方程',
      '自底向上填表把指数级递归压缩为多项式时间，代价是 O(状态数) 的空间',
    ]);
    heading(f, `动态规划：${problem}`);
  },
});

/** I49 分治算法。 */
const divideConquer = defineViz({
  slug: 'divide-conquer',
  title: '分治算法',
  params: {
    n: { type: 'range', min: 4, max: 32, default: 16, label: '问题规模 n' },
    depth: { type: 'range', min: 1, max: 5, default: 4, label: '展示层数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'n', 16));
    const depthMax = Math.round(num(params, 'depth', 4));
    const levels: Array<Array<[number, number]>> = [];
    let segments: Array<[number, number]> = [[0, n]];
    for (let d = 0; d <= depthMax; d++) {
      levels.push(segments.map(([a, b]) => [a, b] as [number, number]));
      const next: Array<[number, number]> = [];
      for (const [a, b] of segments) {
        if (b - a > 1) {
          const mid = Math.floor((a + b) / 2);
          next.push([a, mid], [mid, b]);
        } else {
          next.push([a, b], [a, b]);
        }
      }
      segments = next;
    }

    const rowH = (h - 150) / (depthMax + 1);
    levels.forEach((level, d) => {
      const y = 56 + d * rowH;
      level.forEach(([a, b]) => {
        const x1 = 40 + (a / n) * (w - 80);
        const x2 = 40 + (b / n) * (w - 80);
        const barH = Math.max(6, rowH * 0.5);
        f.ctx.save();
        f.ctx.fillStyle = `${PALETTE[d % PALETTE.length]}cc`;
        f.ctx.fillRect(x1, y, Math.max(3, x2 - x1 - 2), barH);
        f.ctx.restore();
        if (x2 - x1 > 44) {
          text(f, `[${a},${b})`, (x1 + x2) / 2, y + barH / 2 + 4, { align: 'center', color: '#0b1220', font: '10px sans-serif' });
        }
      });
      text(f, `第 ${d} 层（${level.length} 个子问题）`, 12, y + rowH * 0.42, { color: C.dim, font: '11px sans-serif' });
    });

    footnotes(f, [
      `规模 ${n} 的问题被递归二分，每层子问题规模减半、数量翻倍`,
      `若合并代价为 O(n)，总复杂度 T(n) = 2T(n/2) + O(n) = O(n log n)（主定理）`,
      '归并排序、快速排序、大整数乘法、最近点对都是分治的经典应用',
    ]);
    heading(f, '分治算法：分解、求解、合并');
  },
});

/** I50 A* 搜索。 */
const aStar = defineViz({
  slug: 'a-star',
  title: 'A*搜索',
  params: {
    grid: { type: 'range', min: 8, max: 20, default: 14, label: '网格规模' },
    heuristic: { type: 'select', options: ['曼哈顿', '欧几里得'], default: '曼哈顿', label: '启发函数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'grid', 14));
    const heuristic = str(params, 'heuristic', '曼哈顿');
    const size = Math.min((w - 80) / n, (h - 150) / n);
    const ox = (w - n * size) / 2;
    const oy = 56;

    const blocked = new Set<string>();
    for (let i = 3; i < n - 3; i++) {
      if (i !== Math.floor(n / 2)) blocked.add(`${i},${5}`);
      blocked.add(`${5},${i}`);
    }
    const start: [number, number] = [0, 0];
    const goal: [number, number] = [n - 1, n - 1];
    const hFn = ([x, y]: [number, number]): number =>
      heuristic === '曼哈顿' ? Math.abs(x - goal[0]) + Math.abs(y - goal[1])
        : Math.hypot(x - goal[0], y - goal[1]);

    // A* 搜索
    const key = (p: [number, number]): string => `${p[0]},${p[1]}`;
    const gScore = new Map<string, number>([[key(start), 0]]);
    const cameFrom = new Map<string, [number, number]>();
    const open: Array<[number, number]> = [start];
    const closed = new Set<string>();
    const expanded: Array<[number, number]> = [];
    while (open.length > 0) {
      open.sort((a, b) => (gScore.get(key(a)) ?? 0) + hFn(a) - ((gScore.get(key(b)) ?? 0) + hFn(b)));
      const cur = open.shift() as [number, number];
      if (closed.has(key(cur))) continue;
      closed.add(key(cur));
      expanded.push(cur);
      if (cur[0] === goal[0] && cur[1] === goal[1]) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cur[0] + dx;
        const ny = cur[1] + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        if (blocked.has(`${nx},${ny}`)) continue;
        const tentative = (gScore.get(key(cur)) ?? 0) + 1;
        if (tentative < (gScore.get(key([nx, ny])) ?? Infinity)) {
          gScore.set(key([nx, ny]), tentative);
          cameFrom.set(key([nx, ny]), cur);
          open.push([nx, ny]);
        }
      }
    }
    const path: Array<[number, number]> = [];
    let node: [number, number] | undefined = goal;
    while (node) {
      path.push(node);
      node = cameFrom.get(key(node));
    }

    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        const px = ox + x * size;
        const py = oy + y * size;
        const isBlocked = blocked.has(`${x},${y}`);
        const isPath = path.some(([a, b]) => a === x && b === y);
        const isExpanded = expanded.some(([a, b]) => a === x && b === y);
        f.ctx.save();
        f.ctx.fillStyle = isBlocked ? '#4a5568' : isPath ? 'rgba(72,187,120,0.75)' : isExpanded ? 'rgba(102,126,234,0.3)' : C.panel;
        f.ctx.fillRect(px, py, size - 1, size - 1);
        f.ctx.restore();
      }
    }
    dot(f, ox + start[0] * size + size / 2, oy + start[1] * size + size / 2, size * 0.28, C.green);
    dot(f, ox + goal[0] * size + size / 2, oy + goal[1] * size + size / 2, size * 0.28, C.hot);

    footnotes(f, [
      `A* 用 f = g + h 排序扩展顺序（g 已走代价、h 到终点的启发估计）`,
      `本次扩展了 ${expanded.length} 个格子，最短路径长度 ${path.length - 1} 步`,
      '启发函数 h 可采纳（不高估）时 A* 保证最优解；h ≡ 0 时退化为 Dijkstra',
    ]);
    heading(f, 'A* 搜索：启发式引导');
  },
});

/** I51 最小生成树。 */
const minimumSpanningTree = defineViz({
  slug: 'minimum-spanning-tree',
  title: '最小生成树',
  params: {
    algorithm: { type: 'select', options: ['Kruskal', 'Prim'], default: 'Kruskal', label: '算法' },
  },
  draw: (f) => {
    const { params } = f;
    const algorithm = str(params, 'algorithm', 'Kruskal');
    const sorted = [...EDGES].sort((a, b) => a[2] - b[2]);
    const parent = NODES.map((_, i) => i);
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const chosen: Array<[number, number]> = [];
    let total = 0;

    if (algorithm === 'Kruskal') {
      for (const [u, v0, weight] of sorted) {
        const ru = find(u);
        const rv = find(v0);
        if (ru !== rv) {
          parent[ru] = rv;
          chosen.push([u, v0]);
          total += weight;
        }
      }
    } else {
      const inTree = new Set<number>([0]);
      while (inTree.size < NODES.length) {
        let best: [number, number, number] | null = null;
        for (const e of sorted) {
          const [u, v0] = e;
          if (inTree.has(u) !== inTree.has(v0)) {
            if (!best || e[2] < best[2]) best = e;
          }
        }
        if (!best) break;
        chosen.push([best[0], best[1]]);
        total += best[2];
        inTree.add(best[0]);
        inTree.add(best[1]);
      }
    }

    drawGraph(f, chosen, undefined, undefined, true);
    footnotes(f, [
      `${algorithm} 得到的最小生成树共 ${chosen.length} 条边，总权重 ${total}`,
      'n 个顶点的生成树恰好有 n-1 条边；最小生成树使总权重最小',
      algorithm === 'Kruskal'
        ? 'Kruskal：按权重升序遍历边，用并查集避免成环（适合稀疏图）'
        : 'Prim：从任一顶点出发，每次选连接"树内外"的最小边（适合稠密图）',
    ]);
    heading(f, `最小生成树：${algorithm}`);
  },
});

/** I52 网络流。 */
const networkFlow = defineViz({
  slug: 'network-flow',
  title: '网络流',
  params: {
    capacity: { type: 'range', min: 3, max: 10, default: 6, label: '主干容量' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const cap = Math.round(num(params, 'capacity', 6));
    // 6 节点网络：s=0, t=5
    const nds: Array<[number, number]> = [[0.05, 0.5], [0.32, 0.16], [0.32, 0.5], [0.32, 0.84], [0.68, 0.35], [0.94, 0.5]];
    const arcs: Array<[number, number, number]> = [
      [0, 1, cap], [0, 2, cap - 1], [0, 3, cap - 2],
      [1, 4, cap - 1], [2, 4, cap - 2], [3, 4, cap - 3],
      [1, 2, 2], [2, 3, 2], [4, 5, cap + cap - 2],
    ];
    // 简化最大流：三条并行通路的容量之和（瓶颈）
    const pathCaps = [
      Math.min(cap, cap - 1, cap + cap - 2),
      Math.min(cap - 1, cap - 2, cap + cap - 2),
      Math.min(cap - 2, cap - 3, cap + cap - 2),
    ];
    const flow = pathCaps.reduce((a, b) => a + b, 0);

    const px = (p: [number, number]): [number, number] => [60 + p[0] * (w - 140), 54 + p[1] * (h - 120)];
    arcs.forEach(([u, v0, capacity]) => {
      const a = px(nds[u]);
      const b = px(nds[v0]);
      const used = Math.min(capacity, Math.round((capacity / (cap + cap)) * flow));
      const t = capacity === 0 ? 0 : used / capacity;
      seg(f, a[0], a[1], b[0], b[1], `hsl(${230 - t * 120}, 70%, 55%)`, 1 + t * 4);
      text(f, `${used}/${capacity}`, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 7, { align: 'center', color: C.fg, font: '11px sans-serif' });
    });
    nds.forEach((p, i) => {
      const [x, y] = px(p);
      dot(f, x, y, 15, i === 0 ? C.green : i === nds.length - 1 ? C.hot : C.accent);
      text(f, i === 0 ? 'S' : i === nds.length - 1 ? 'T' : String(i), x, y + 5, { align: 'center', color: '#fff', font: 'bold 12px sans-serif' });
    });

    footnotes(f, [
      `边上标注"当前流量/容量"，从 S 到 T 的最大流 = ${flow}（等于最小割的容量）`,
      '最大流最小割定理：网络能承载的最大流量等于最小割集的总容量',
      'Ford-Fulkerson / Dinic 通过不断寻找增广路来逼近最大流，复杂度取决于增广策略',
    ]);
    heading(f, '网络流：最大流与最小割');
  },
});

/** I53 哈希与散列。 */
const hashing = defineViz({
  slug: 'hashing',
  title: '哈希与散列',
  params: {
    buckets: { type: 'range', min: 4, max: 16, default: 8, label: '桶数量' },
    keys: { type: 'range', min: 5, max: 30, default: 16, label: '键数量' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const buckets = Math.round(num(params, 'buckets', 8));
    const keyCount = Math.round(num(params, 'keys', 16));
    const rand = rng(1024);
    const table: number[][] = Array.from({ length: buckets }, () => []);
    const inserted: number[] = [];
    for (let i = 0; i < keyCount; i++) {
      const key = Math.floor(rand() * 900) + 100;
      const idx = key % buckets;
      table[idx].push(key);
      inserted.push(key);
    }
    const maxChain = Math.max(...table.map((b) => b.length));

    const bucketH = (h - 140) / buckets;
    table.forEach((chain, i) => {
      const y = 56 + i * bucketH;
      text(f, `h=${i}`, 46, y + bucketH / 2 + 4, { align: 'right', color: C.dim, font: '11px monospace' });
      seg(f, 54, y + 4, 54, y + bucketH - 6, 'rgba(160,174,192,0.3)', 1);
      chain.forEach((key, j) => {
        const x = 66 + j * 62;
        if (x + 56 > w - 20) return;
        f.ctx.save();
        f.ctx.fillStyle = chain.length > 1 ? C.warm : C.accent;
        f.ctx.fillRect(x, y + 4, 56, bucketH - 14);
        f.ctx.restore();
        text(f, String(key), x + 28, y + bucketH / 2 + 2, { align: 'center', color: '#fff', font: '11px monospace' });
        if (j < chain.length - 1) text(f, '→', x + 60, y + bucketH / 2 + 2, { color: C.dim, font: '11px sans-serif' });
      });
    });

    footnotes(f, [
      `${keyCount} 个键散列到 ${buckets} 个桶：最长链长 ${maxChain}，平均链长 ${(keyCount / buckets).toFixed(2)}`,
      '橙色表示发生了冲突（同一桶放了多个键），用链地址法串在桶后',
      '装填因子 α = n/m 决定性能：链地址法平均查找 O(1 + α)，开放寻址需 α < 1',
    ]);
    heading(f, '哈希表：桶与冲突链');
  },
});

/** I54 堆与优先队列。 */
const heap = defineViz({
  slug: 'heap',
  title: '堆与优先队列',
  params: {
    count: { type: 'range', min: 4, max: 15, default: 9, label: '元素个数' },
    mode: { type: 'select', options: ['大顶堆', '小顶堆'], default: '大顶堆', label: '堆类型' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const count = Math.round(num(params, 'count', 9));
    const mode = str(params, 'mode', '大顶堆');
    const rand = rng(77);
    const values = Array.from({ length: count }, () => Math.round(rand() * 90) + 5);
    const cmp = (a: number, b: number): boolean => (mode === '大顶堆' ? a > b : a < b);
    // 建堆（自底向上 sift-down）
    const heapArr = [...values];
    for (let i = Math.floor(count / 2) - 1; i >= 0; i--) {
      let cur = i;
      while (true) {
        const l = 2 * cur + 1;
        const r = 2 * cur + 2;
        let largest = cur;
        if (l < count && cmp(heapArr[l], heapArr[largest])) largest = l;
        if (r < count && cmp(heapArr[r], heapArr[largest])) largest = r;
        if (largest === cur) break;
        [heapArr[cur], heapArr[largest]] = [heapArr[largest], heapArr[cur]];
        cur = largest;
      }
    }

    // 画完全二叉树
    const levelOf = (i: number): number => Math.floor(Math.log2(i + 1));
    const maxLevel = levelOf(count - 1);
    const nodeR = Math.min(20, (w - 80) / (2 ** maxLevel * 2.4), (h - 150) / (maxLevel * 2.4));
    heapArr.forEach((value, i) => {
      const level = levelOf(i);
      const posInLevel = i - (2 ** level - 1);
      const total = 2 ** level;
      const x = w / 2 + ((posInLevel - (total - 1) / 2) * (w - 100) * 0.9) / total;
      const y = 62 + level * nodeR * 2.6;
      if (i > 0) {
        const parent = Math.floor((i - 1) / 2);
        const pLevel = levelOf(parent);
        const pPos = parent - (2 ** pLevel - 1);
        const pTotal = 2 ** pLevel;
        const px2 = w / 2 + ((pPos - (pTotal - 1) / 2) * (w - 100) * 0.9) / pTotal;
        const py = 62 + pLevel * nodeR * 2.6;
        seg(f, px2, py, x, y, 'rgba(160,174,192,0.35)', 1.4);
      }
      dot(f, x, y, nodeR, i === 0 ? C.warm : C.accent);
      text(f, String(value), x, y + 4, { align: 'center', color: '#fff', font: `bold ${Math.max(10, nodeR * 0.62)}px sans-serif` });
    });

    footnotes(f, [
  `${mode}（数组表示）：[${heapArr.join(', ')}]，根节点 ${heapArr[0]} 是${mode === '大顶堆' ? '最大' : '最小'}值`,
      `下标 i 的左右孩子为 2i+1、2i+2，父节点为 ⌊(i-1)/2⌋ —— 用数组即可无需指针`,
      '插入与删除堆顶都是 O(log n)，是优先队列、堆排序、Dijkstra 高效实现的基础',
    ]);
    heading(f, `${mode}：完全二叉树`);
  },
});

/** I55 红黑树。 */
const rbtree = defineViz({
  slug: 'rbtree',
  title: '红黑树',
  params: {
    count: { type: 'range', min: 5, max: 15, default: 10, label: '节点数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const count = Math.round(num(params, 'count', 10));
    const rand = rng(8080);
    const keys = Array.from(new Set(Array.from({ length: count }, () => Math.floor(rand() * 99) + 1))).sort((a, b) => a - b);

    // 用有序数组构建平衡 BST（中序布局保证不重叠）
    interface TNode { key: number; level: number; left: number; right: number }
    const nodes: TNode[] = [];
    const build = (lo: number, hi: number, level: number): number => {
      if (lo > hi) return -1;
      const mid = Math.floor((lo + hi) / 2);
      const idx = nodes.length;
      nodes.push({ key: keys[mid], level, left: -1, right: -1 });
      const l = build(lo, mid - 1, level + 1);
      const r = build(mid + 1, hi, level + 1);
      nodes[idx].left = l;
      nodes[idx].right = r;
      return idx;
    };
    const root = build(0, keys.length - 1, 0);

    const pos = new Map<number, [number, number]>();
    let maxLevel = 0;
    let counter = 0;
    const spacing = (w - 140) / Math.max(1, keys.length - 1);
    const layout = (idx: number): void => {
      if (idx < 0) return;
      layout(nodes[idx].left);
      const x = 70 + counter++ * spacing;
      const y = 70 + nodes[idx].level * 46;
      pos.set(idx, [x, y]);
      maxLevel = Math.max(maxLevel, nodes[idx].level);
      layout(nodes[idx].right);
    };
    layout(root);

    nodes.forEach((node, idx) => {
      const [x, y] = pos.get(idx) as [number, number];
      for (const child of [node.left, node.right]) {
        if (child < 0) continue;
        const [cx2, cy2] = pos.get(child) as [number, number];
        seg(f, x, y, cx2, cy2, 'rgba(160,174,192,0.4)', 1.4);
      }
    });
    // 红黑染色：交替层着色（示意红黑性质）
    nodes.forEach((node, idx) => {
      const [x, y] = pos.get(idx) as [number, number];
      dot(f, x, y, 17, node.level % 2 === 1 ? C.hot : C.panel);
      text(f, String(node.key), x, y + 5, { align: 'center', color: '#fff', font: 'bold 12px sans-serif' });
    });

    footnotes(f, [
      `${keys.length} 个键的平衡二叉搜索树（高度 ${maxLevel + 1} 层，栈深 O(log n)）`,
      '红黑树性质：根为黑、红节点不能相邻、任一节点到叶子的黑节点数相同 —— 因此高度 ≤ 2log₂(n+1)',
      '插入/删除/查找都是 O(log n)，被 C++ map、Java TreeMap、Linux 内核广泛使用',
    ]);
    heading(f, '红黑树：自平衡二叉搜索树');
  },
});

/** I56 字符串匹配。 */
const stringMatch = defineViz({
  slug: 'string-match',
  title: '字符串匹配',
  params: {
    text: { type: 'select', options: ['ABABABCABABABCAB', 'AABAACAADAABAABA', 'ABCABCABDABCAB'], default: 'ABABABCABABABCAB', label: '文本' },
    pattern: { type: 'select', options: ['ABABC', 'AABA', 'ABCABD'], default: 'ABABC', label: '模式串' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const text0 = str(params, 'text', 'ABABABCABABABCAB');
    const pattern = str(params, 'pattern', 'ABABC');
    const cell = Math.min(34, (w - 80) / Math.max(text0.length, 1), (h - 200) / 4);

    const matches: number[] = [];
    for (let i = 0; i + pattern.length <= text0.length; i++) {
      if (text0.slice(i, i + pattern.length) === pattern) matches.push(i);
    }
    // KMP 前缀函数
    const pi = new Array<number>(pattern.length).fill(0);
    for (let i = 1; i < pattern.length; i++) {
      let j = pi[i - 1];
      while (j > 0 && pattern[i] !== pattern[j]) j = pi[j - 1];
      if (pattern[i] === pattern[j]) j++;
      pi[i] = j;
    }

    text(f, '文本 T：', 30, 70, { color: C.dim, font: '13px sans-serif' });
    text0.split('').forEach((ch, i) => {
      const x = 110 + i * cell;
      const inMatch = matches.some((m) => i >= m && i < m + pattern.length);
      f.ctx.save();
      f.ctx.fillStyle = inMatch ? C.green : C.panel;
      f.ctx.fillRect(x, 56, cell - 2, cell);
      f.ctx.restore();
      text(f, ch, x + cell / 2, 56 + cell * 0.68, { align: 'center', color: '#fff', font: '12px monospace' });
    });

    text(f, '模式 P：', 30, 70 + cell + 24, { color: C.dim, font: '13px sans-serif' });
    pattern.split('').forEach((ch, i) => {
      const x = 110 + i * cell;
      f.ctx.save();
      f.ctx.fillStyle = C.accent;
      f.ctx.fillRect(x, 70 + cell + 10, cell - 2, cell);
      f.ctx.restore();
      text(f, ch, x + cell / 2, 70 + cell + 10 + cell * 0.68, { align: 'center', color: '#fff', font: '12px monospace' });
    });

    const y0 = 70 + 2 * cell + 46;
    text(f, `前缀函数 π = [${pi.join(', ')}]`, 30, y0, { color: C.cool, font: '13px Consolas, monospace' });
  text(f, `匹配位置：${matches.length ? matches.join(', ') : '无'}（共 ${matches.length} 处）`, 30, y0 + 26, { color: C.green, font: '13px sans-serif' });

    footnotes(f, [
      'KMP 先对模式串求前缀函数 π（最长相等前后缀），失配时按 π 回退而不重扫文本',
      '朴素匹配最坏 O(nm)；KMP 是 O(n + m)，代价是 O(m) 的额外空间',
      'Trie 树适合多模式匹配；Boyer-Moore 从右向左比对，实践中往往更快',
    ]);
    heading(f, '字符串匹配：KMP 与前缀函数');
  },
});

/** I57 二分查找。 */
const binarySearch = defineViz({
  slug: 'binary-search',
  title: '二分查找',
  params: {
    count: { type: 'range', min: 5, max: 20, default: 12, label: '元素个数' },
    target: { type: 'range', min: 1, max: 99, default: 42, label: '查找目标' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const count = Math.round(num(params, 'count', 12));
    const target = Math.round(num(params, 'target', 42));
    const arr = Array.from({ length: count }, (_, i) => (i + 1) * 8 - 4);

    let lo = 0;
    let hi = count - 1;
    const steps: Array<[number, number, number, boolean]> = [];
    let found = -1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const hit = arr[mid] === target;
      steps.push([lo, hi, mid, hit]);
      if (hit) {
        found = mid;
        break;
      }
      if (arr[mid] < target) lo = mid + 1;
      else hi = mid - 1;
    }

    const cell = Math.min(60, (w - 80) / count - 6);
    arr.forEach((value, i) => {
      const x = 40 + i * (cell + 6);
      const inRange = lo <= i && i <= hi;
      const isMid = steps.length > 0 && steps[steps.length - 1][2] === i;
      f.ctx.save();
      f.ctx.fillStyle = i === found ? C.green : isMid ? C.warm : inRange ? C.accent : C.panel;
      f.ctx.fillRect(x, 130, cell, 52);
      f.ctx.restore();
      text(f, String(value), x + cell / 2, 162, { align: 'center', color: '#fff', font: '13px sans-serif' });
      text(f, String(i), x + cell / 2, 196, { align: 'center', color: C.dim, font: '10px sans-serif' });
    });
    text(f, `目标 ${target}：${found >= 0 ? `在第 ${found} 个位置找到` : '未找到'}`, 40, 96, { color: C.green, font: '14px sans-serif' });
    steps.forEach(([l, r, mid], i) => {
      text(f, `第 ${i + 1} 步：[${l}, ${r}]，中点 ${mid}（值 ${arr[mid]}）`, 40, 232 + i * 22, { color: C.dim, font: '12px Consolas, monospace' });
    });

    footnotes(f, [
      `每次把搜索区间缩小一半，最多 ⌈log₂ ${count}⌉ = ${Math.ceil(Math.log2(count))} 次比较`,
      '二分要求序列有序；注意 mid 的取值可避免死循环（lo + (hi-lo)/2 也防溢出）',
      '在答案空间上二分（"二分答案"）可以求解最优化问题，不必真的在数组里找',
    ]);
    heading(f, '二分查找：每次砍掉一半');
  },
});

/** I58 图论入门。 */
const graphTheory = defineViz({
  slug: 'graph-theory',
  title: '图论入门',
  params: {
    highlight: { type: 'range', min: 0, max: 7, default: 3, label: '高亮节点' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const highlight = Math.round(num(params, 'highlight', 3));
    const degree = NODES.map(() => 0);
    for (const [u, v0] of EDGES) {
      degree[u]++;
      degree[v0]++;
    }
    const adj: number[][] = NODES.map(() => []);
    for (const [u, v0] of EDGES) {
      adj[u].push(v0);
      adj[v0].push(u);
    }
    // 连通分量
    const comp = new Array<number>(NODES.length).fill(-1);
    let comps = 0;
    for (let i = 0; i < NODES.length; i++) {
      if (comp[i] >= 0) continue;
      const stack = [i];
      comp[i] = comps;
      while (stack.length) {
        const cur = stack.pop() as number;
        for (const nb of adj[cur]) {
          if (comp[nb] < 0) {
            comp[nb] = comps;
            stack.push(nb);
          }
        }
      }
      comps++;
    }

    const colors = NODES.map((_, i) => (i === highlight ? C.hot : PALETTE[comp[i] % PALETTE.length]));
    const labels = new Map<number, string>();
    NODES.forEach((_, i) => labels.set(i, `${i}·d${degree[i]}`));
    drawGraph(f, EDGES.map(([u, v0]) => [u, v0] as [number, number]), labels, colors, true);

    // 握手引理
    const edgeCount = EDGES.length;
    const sumDeg = degree.reduce((a, b) => a + b, 0);
    footnotes(f, [
      `节点数 |V| = ${NODES.length}，边数 |E| = ${edgeCount}，连通分量 ${comps} 个`,
      `节点 ${highlight} 的度为 ${degree[highlight]}（相邻边数）；度数之和 = 2|E| = ${sumDeg}（握手引理）`,
      '图 = 顶点 + 边；有权/无权、有向/无向、是否连通是图的基本分类',
    ]);
    heading(f, '图论入门：度、边与连通性');
  },
});

/** I59 图着色。 */
const graphColoring = defineViz({
  slug: 'graph-coloring',
  title: '图着色',
  params: {
    colors: { type: 'range', min: 2, max: 5, default: 4, label: '可用颜色数' },
  },
  draw: (f) => {
    const { params } = f;
    const colorCount = Math.round(num(params, 'colors', 4));
    const adj: number[][] = NODES.map(() => []);
    for (const [u, v0] of EDGES) {
      adj[u].push(v0);
      adj[v0].push(u);
    }
    // 贪心着色：按度降序
    const order = NODES.map((_, i) => i).sort((a, b) => adj[b].length - adj[a].length);
    const color = new Array<number>(NODES.length).fill(-1);
    let used = 0;
    for (const node of order) {
      const taken = new Set(adj[node].filter((nb) => color[nb] >= 0).map((nb) => color[nb]));
      let c = 0;
      while (taken.has(c)) c++;
      color[node] = c;
      used = Math.max(used, c + 1);
    }
    const feasible = used <= colorCount;
    const palette = [C.accent, C.hot, C.green, C.warm, C.cool];
    const nodeColors = color.map((c) => (c < colorCount ? palette[c % palette.length] : C.panel));
    drawGraph(f, EDGES.map(([u, v0]) => [u, v0] as [number, number]), undefined, nodeColors, false);

    footnotes(f, [
      `贪心着色用了 ${used} 种颜色（限制 ${colorCount} 种）：${feasible ? '满足约束' : '超出限制，需要更多颜色'}`,
      '相邻节点颜色必须不同；四色定理保证平面图 4 种颜色一定够用',
      '求最少颜色数（色数）是 NP 难问题；贪心只是近似，可能多用颜色',
    ]);
    heading(f, '图着色：相邻不同色');
  },
});

/** I60 欧拉与哈密顿路径。 */
const eulerHamiltonPath = defineViz({
  slug: 'euler-hamilton-path',
  title: '欧拉与哈密顿路径',
  params: {
    mode: { type: 'select', options: ['欧拉回路', '哈密顿圈'], default: '欧拉回路', label: '路径类型' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = str(params, 'mode', '欧拉回路');
    const px = (p: [number, number]): [number, number] => [60 + p[0] * (w - 140), 54 + p[1] * (h - 120)];

    if (mode === '欧拉回路') {
      // 所有度数为偶数时存在欧拉回路：用 Hierholzer 走一遍
      const adj = new Map<number, number[]>();
      NODES.forEach((_, i) => adj.set(i, []));
      const edgeUsed = new Array<boolean>(EDGES.length).fill(false);
      EDGES.forEach(([u, v0], i) => {
        (adj.get(u) as number[]).push(i);
        (adj.get(v0) as number[]).push(i);
      });
      const odd = NODES.map((_, i) => (adj.get(i) as number[]).length % 2 === 1);
      const oddCount = odd.filter(Boolean).length;

      // 演示：找一条尽可能长的边序列（贪心，可能不完整）
      const tour: number[] = [];
      const usedNodes = new Set<number>();
      const stack = [0];
      while (stack.length) {
        const cur = stack[stack.length - 1];
        const nextEdge = (adj.get(cur) as number[]).find((ei) => !edgeUsed[ei]);
        if (nextEdge === undefined) {
          tour.push(stack.pop() as number);
        } else {
          edgeUsed[nextEdge] = true;
          usedNodes.add(cur);
          const [a, b] = EDGES[nextEdge];
          stack.push(a === cur ? b : a);
        }
      }
      const tourEdges: Array<[number, number]> = [];
      for (let i = 0; i + 1 < tour.length; i++) tourEdges.push([tour[i], tour[i + 1]]);
      drawGraph(f, tourEdges, undefined, undefined, false);

      footnotes(f, [
        `图中奇度节点有 ${oddCount} 个：${oddCount === 0 ? '存在欧拉回路（可一笔画回到起点）' : oddCount === 2 ? '存在欧拉路径（一笔画但不回到起点）' : '不存在一笔画'}`,
        '欧拉路径判定完全是"度数条件"：0 个或 2 个奇度点，因此有线性时间算法',
        '七桥问题的答案就是"奇度点有 4 个，不可能一笔画完"',
      ]);
    } else {
      // 哈密顿圈：暴力回溯找一条（小图可行）
      const adj: number[][] = NODES.map(() => []);
      for (const [u, v0] of EDGES) {
        adj[u].push(v0);
        adj[v0].push(u);
      }
      const path: number[] = [0];
      const visited = new Set<number>([0]);
      const dfs = (cur: number): boolean => {
        if (path.length === NODES.length) {
          if (adj[cur].includes(0)) {
            path.push(0);
            return true;
          }
          return false;
        }
        for (const nb of adj[cur]) {
          if (visited.has(nb)) continue;
          visited.add(nb);
          path.push(nb);
          if (dfs(nb)) return true;
          path.pop();
          visited.delete(nb);
        }
        return false;
      };
      const found = dfs(0);
      const tourEdges: Array<[number, number]> = [];
      for (let i = 0; i + 1 < path.length; i++) tourEdges.push([path[i], path[i + 1]]);
      drawGraph(f, tourEdges, undefined, undefined, false);

      footnotes(f, [
        found
          ? `找到一个哈密顿圈：${path.join(' → ')}（经过每个顶点恰好一次并回到起点）`
          : '回溯未找到哈密顿圈（该图可能不存在）',
        '哈密顿圈没有简单的判定条件，判定与求解都是 NP 完全问题',
        '旅行商问题（TSP）就是"带权哈密顿圈"，只能靠启发式或近似算法处理大规模实例',
      ]);
    }
    heading(f, mode === '欧拉回路' ? '欧拉回路：走遍每条边' : '哈密顿圈：走遍每个点');
  },
});

/** I61 PageRank。 */
const pagerank = defineViz({
  slug: 'pagerank',
  title: 'PageRank',
  params: {
    damping: { type: 'range', min: 0.5, max: 0.95, default: 0.85, step: 0.05, label: '阻尼系数 d' },
    iterations: { type: 'range', min: 1, max: 30, default: 12, label: '迭代轮数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const d = num(params, 'damping', 0.85);
    const iters = Math.round(num(params, 'iterations', 12));
    // 有向图：边为 [from, to]
    const arcs: Array<[number, number]> = [
      [0, 1], [0, 2], [1, 2], [1, 3], [2, 3], [2, 4], [3, 4],
      [4, 5], [5, 6], [6, 4], [6, 7], [3, 7], [7, 6],
    ];
    const n = NODES.length;
    const out: number[][] = NODES.map(() => []);
    arcs.forEach(([u, v0]) => out[u].push(v0));

    let rank = new Array<number>(n).fill(1 / n);
    for (let it = 0; it < iters; it++) {
      const next = new Array<number>(n).fill((1 - d) / n);
      for (let u = 0; u < n; u++) {
        if (out[u].length === 0) {
          for (let v0 = 0; v0 < n; v0++) next[v0] += (d * rank[u]) / n;
          continue;
        }
        for (const v0 of out[u]) next[v0] += (d * rank[u]) / out[u].length;
      }
      rank = next;
    }
    const maxRank = Math.max(...rank);

    const px = (p: [number, number]): [number, number] => [60 + p[0] * (w - 140), 60 + p[1] * (h - 130)];
    arcs.forEach(([u, v0]) => {
      const a = px(NODES[u]);
      const b = px(NODES[v0]);
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const shrink = 16;
      const x1 = a[0] + Math.cos(ang) * shrink;
      const y1 = a[1] + Math.sin(ang) * shrink;
      const x2 = b[0] - Math.cos(ang) * shrink;
      const y2 = b[1] - Math.sin(ang) * shrink;
      seg(f, x1, y1, x2, y2, 'rgba(160,174,192,0.4)', 1.2);
      const headSize = 7;
      f.ctx.save();
      f.ctx.fillStyle = 'rgba(160,174,192,0.7)';
      f.ctx.beginPath();
      f.ctx.moveTo(x2, y2);
      f.ctx.lineTo(x2 - headSize * Math.cos(ang - 0.4), y2 - headSize * Math.sin(ang - 0.4));
      f.ctx.lineTo(x2 - headSize * Math.cos(ang + 0.4), y2 - headSize * Math.sin(ang + 0.4));
      f.ctx.closePath();
      f.ctx.fill();
      f.ctx.restore();
    });
    NODES.forEach((p, i) => {
      const [x, y] = px(p);
      const r = 10 + (rank[i] / maxRank) * 18;
      dot(f, x, y, r, i === 4 || i === 6 ? C.warm : C.accent);
      text(f, String(i), x, y + 5, { align: 'center', color: '#fff', font: 'bold 12px sans-serif' });
    });

    const sorted = rank.map((v0, i) => [i, v0] as [number, number]).sort((a, b) => b[1] - a[1]);
    footnotes(f, [
      `迭代 ${iters} 轮后各节点权重（节点大小成正比）：${sorted.slice(0, 4).map(([i, v0]) => `#${i}=${v0.toFixed(3)}`).join('  ')}`,
      `PageRank 递推：PR(u) = (1-d)/n + d × Σ PR(v)/outdeg(v)，阻尼系数 d = ${d}`,
      '被重要页面链接的页面更重要 —— 这个"自我指涉"的方程由幂迭代求解，等价于求转移矩阵的主特征向量',
    ]);
    heading(f, 'PageRank：链接权重与特征向量');
  },
});

registerViz(
  bfsDfs,
  dijkstra,
  sortingAlgorithms,
  dynamicProgramming,
  divideConquer,
  aStar,
  minimumSpanningTree,
  networkFlow,
  hashing,
  heap,
  rbtree,
  stringMatch,
  binarySearch,
  graphTheory,
  graphColoring,
  eulerHamiltonPath,
  pagerank,
);
