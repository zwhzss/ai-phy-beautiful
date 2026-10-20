/**
 * 数学史里程碑 · 第四批（T41–T53：现代数学的抽象与巅峰）。
 */
import { defineViz, num, str, VizFrame } from '../types';
import { registerViz } from '../registry';
import { C, curve, dot, equalView, footnotes, grid, heading, poly, rng, scatter, seg, text, view } from '../canvas';

function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}

// ---------------------------------------------------------------- T41
/** T41 魏尔斯特拉斯-波尔查诺定理。 */
const bolzanoWeierstrassViz = defineViz({
  slug: 'bolzano-weierstrass',
  title: '魏尔斯特拉斯-波尔查诺定理',
  params: {
    n: { type: 'range', min: 20, max: 300, default: 120, label: '数列项数' },
    seed: { type: 'range', min: 1, max: 30, default: 7, label: '随机种子' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.max(5, Math.round(num(params, 'n', 120)));
    const seed = Math.round(num(params, 'seed', 7));

    const rand = rng(seed);
    const seq: number[] = [0];
    for (let i = 1; i < n; i++) seq.push(seq[i - 1] + (rand() - 0.5) * 0.9);
    // 归一化到 [-1, 1]（有界）
    const maxAbs = Math.max(...seq.map((v) => Math.abs(v)), 1);
    const bounded = seq.map((v) => Math.sin(v * 0.7) * 0.85 + Math.sin(v * 0.13) * 0.1);

    const v = view(f, { xMin: 0, xMax: n, yMin: -1.15, yMax: 1.15, inset: 52 });
    grid(f, v, { divisions: 4, ticks: true });
    // 有界带
    seg(f, v.sx(0), v.sy(-1), v.sx(n), v.sy(-1), { color: C.grid, lw: 1.4, dash: [6, 4] } as never);
    seg(f, v.sx(0), v.sy(1), v.sx(n), v.sy(1), { color: C.grid, lw: 1.4, dash: [6, 4] } as never);
    scatter(f, v, bounded.map((y, i) => [i + 1, y] as [number, number]), { r: 2.6, color: C.accent });

    // 标出一个聚点附近的点
    const target = 0;
    const near = bounded.map((y, i) => [i + 1, y] as [number, number]).filter(([, y]) => Math.abs(y - target) < 0.06);
    seg(f, v.sx(0), v.sy(target), v.sx(n), v.sy(target), { color: C.warm, lw: 1.6 } as never);
    near.slice(0, 14).forEach(([x, y]) => dot(f, v.sx(x), v.sy(y), 4.6, C.hot));
    void maxAbs;

    text(f, '有界数列必有收敛子列', w / 2, 46, {
      align: 'center', font: 'bold 17px system-ui', color: C.warm,
    });
    text(f, `红点 = 落在聚点（橙色线）附近的项，共 ${near.length} 个`, w / 2, 72, {
      align: 'center', color: C.fg, font: '13px system-ui',
    });
    text(f, '数列虽有界，却未必收敛；但总能从中挑出收敛的子列', w / 2, 96, {
      align: 'center', color: C.dim, font: '13px system-ui',
    });

    heading(f, '波尔查诺-魏尔斯特拉斯定理：有界必有收敛子列');
    footnotes(f, [
      '实数序列只要有界（落在有限区间内），就一定存在收敛的子列',
      '它等价于实数的完备性（连续统性质），是分析严密化的基石之一',
      '「聚点」概念由此清晰化，后来发展为拓扑学中的紧致性',
    ]);
  },
});

// ---------------------------------------------------------------- T42
/** T42 高斯二次互反律。 */
const quadraticReciprocityViz = defineViz({
  slug: 'quadratic-reciprocity',
  title: '高斯二次互反律',
  params: {
    size: { type: 'range', min: 5, max: 12, default: 9, label: '奇素数个数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const size = Math.max(3, Math.round(num(params, 'size', 9)));

    const primes: number[] = [];
    for (let i = 3; primes.length < size; i += 2) if (isPrime(i)) primes.push(i);

    // 勒让德符号 (q/p)：q 是否为模 p 的二次剩余
    const legendre = (q: number, p: number): number => {
      const set = new Set<number>();
      for (let x = 1; x < p; x++) set.add((x * x) % p);
      return set.has(q % p) ? 1 : -1;
    };

    const cell = Math.max(24, Math.min(46, Math.floor((Math.min(w, h) - 180) / size)));
    const ox = Math.max(90, w / 2 - (size * cell) / 2);
    const oy = 130;

    primes.forEach((p, j) => {
      text(f, String(p), ox + j * cell + cell / 2, oy - 12, { align: 'center', color: C.dim, font: '12px system-ui' });
      text(f, String(p), ox - 26, oy + j * cell + cell / 2 + 4, { align: 'center', color: C.dim, font: '12px system-ui' });
    });

    let symCount = 0;
    let asymCount = 0;
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (i === j) continue;
        const p = primes[i];
        const q = primes[j];
        const x = ox + j * cell;
        const y = oy + i * cell;
        const s = legendre(q, p);
        const opposite = legendre(p, q);
        const symmetric = (s === opposite && (p % 4 === 3 && q % 4 === 3) === false) || (p % 4 === 3 && q % 4 === 3 && s === -opposite);
        if (symmetric) symCount++;
        else asymCount++;
        poly(f, [[x, y], [x + cell - 3, y], [x + cell - 3, y + cell - 3], [x, y + cell - 3]], {
          fill: s === 1 ? 'rgba(72,187,120,0.62)' : 'rgba(245,101,101,0.5)', close: true,
        });
        text(f, s === 1 ? '+1' : '−1', x + (cell - 3) / 2, y + cell / 2, {
          align: 'center', color: C.fg, font: '11px Consolas, monospace',
        });
      }
    }

    text(f, '勒让德符号 (q/p)：绿色 +1 表示 q 是模 p 的二次剩余', w / 2, 52, {
      align: 'center', font: 'bold 15px system-ui', color: C.fg,
    });
    text(f, '二次互反律把 (p/q) 与 (q/p) 联系起来（当 p、q 均为 4k+3 型时差一个负号）', w / 2, 78, {
      align: 'center', color: C.warm, font: '13px system-ui',
    });
    text(f, `表格关于对角线「相容」的格子：${symCount} 个`, w / 2, 102, {
      align: 'center', color: C.green, font: '13px Consolas, monospace',
    });
    void asymCount;

    heading(f, '二次互反律：算术的宝石');
    footnotes(f, [
      '它让「p 是否模 q 的二次剩余」可以「反过来」由 q 是否模 p 的二次剩余决定',
      '高斯称其为「算术的宝石」，一生给出了八个不同证明',
      '这是近代数论的起点，后来由类域论、自守形式等理论层层推广',
    ]);
  },
});

// ---------------------------------------------------------------- T43
/** T43 伽罗瓦理论。 */
const galoisTheoryViz = defineViz({
  slug: 'galois-theory',
  title: '伽罗瓦理论',
  params: {
    poly: { type: 'select', options: ['三次（群 S₃）', '四次（群 S₄）'], default: '三次（群 S₃）', label: '方程' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = str(params, 'poly', '三次（群 S₃）');
    const isCubic = mode.startsWith('三次');

    // 三次：3 个根的 6 个置换；四次：4 个根的 24 个置换（只展示前 12 个）
    const base = isCubic ? [1, 2, 3] : [1, 2, 3, 4];
    const perms: number[][] = [];
    const permute = (arr: number[], cur: number[]): void => {
      if (arr.length === 0) {
        perms.push([...cur]);
        return;
      }
      for (let i = 0; i < arr.length; i++) {
        const rest = arr.slice(0, i).concat(arr.slice(i + 1));
        permute(rest, [...cur, arr[i]]);
      }
    };
    permute(base, []);
    const shown = perms.slice(0, isCubic ? 6 : 12);

    const cell = 34;
    const cols = isCubic ? 3 : 4;
    const perRow = 3;
    const ox = 70;
    const oy = 130;

    shown.forEach((pm, k) => {
      const row = Math.floor(k / perRow);
      const col = k % perRow;
      const x0 = ox + col * (cols * cell + 34);
      const y0 = oy + row * (cell + 40);
      text(f, `σ${k + 1}`, x0, y0 - 8, { color: C.dim, font: '12px system-ui' });
      pm.forEach((val, i) => {
        const x = x0 + i * cell;
        poly(f, [[x, y0], [x + cell - 4, y0], [x + cell - 4, y0 + cell - 4], [x, y0 + cell - 4]], {
          fill: val === i + 1 ? 'rgba(72,187,120,0.35)' : 'rgba(102,126,234,0.5)',
          close: true,
        });
        text(f, String(val), x + (cell - 4) / 2, y0 + cell / 2, { align: 'center', color: C.fg, font: 'bold 13px system-ui' });
      });
      // 箭头示意
      text(f, '↓', x0 + (cols * cell) / 2, y0 + cell + 14, { align: 'center', color: C.grid, font: '13px system-ui' });
    });

    text(f, isCubic ? '三次方程：根的 3! = 6 个置换（群 S₃）' : '四次方程：根的 4! = 24 个置换（群 S₄）', w / 2, 52, {
      align: 'center', font: 'bold 16px system-ui', color: C.warm,
    });
    text(f, '每个方块是一次置换：绿色表示该根「留在原位」', w / 2, 78, {
      align: 'center', color: C.fg, font: '13px system-ui',
    });
    text(f, '方程可用根式解 ⇔ 它的伽罗瓦群是「可解群」', w / 2, 102, {
      align: 'center', color: C.green, font: 'bold 14px system-ui',
    });

    heading(f, '伽罗瓦理论：用「对称群」判定方程能否根式求解');
    footnotes(f, [
      '伽罗瓦（1832 年去世时不到 21 岁）把「方程可解性」翻译成群的性质',
      '三次、四次方程的群可解 → 有根式解；五次方程的群 A₅ 不可解 → 没有根式解',
      '这一判决终结了三百年的追问，也让「群」成为整个现代数学的语言',
    ]);
  },
});

// ---------------------------------------------------------------- T44
/** T44 黎曼几何。 */
const riemannianGeometryViz = defineViz({
  slug: 'riemannian-geometry',
  title: '黎曼几何',
  params: {
    curvature: { type: 'range', min: -1, max: 1, step: 0.05, default: 0.6, label: '曲率 K' },
    lines: { type: 'range', min: 2, max: 7, default: 5, label: '测地线条数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const K = num(params, 'curvature', 0.6);
    const lineCount = Math.max(2, Math.round(num(params, 'lines', 5)));
    const cx = w / 2;

    // 视作球面/双曲面的侧视图：用一族「测地线」展示汇聚/发散
    const centerY = 130;
    const radius = Math.min(h * 0.72, 240);

    const v = view(f, { xMin: -1.3, xMax: 1.3, yMin: -0.2, yMax: 1.5, inset: 40 });
    grid(f, v, { divisions: 4, ticks: false });

    for (let i = 0; i < lineCount; i++) {
      const off = (i - (lineCount - 1) / 2) * (0.42 / Math.max(1, lineCount - 1)) * 2;
      const pts: Array<[number, number]> = [];
      for (let t = 0; t <= 1.001; t += 0.01) {
        const y = t * 1.35;
        // K > 0：汇聚（球面）；K < 0：发散（双曲面）；K = 0：平行（欧氏）
        const spread = 0.22 + off * (K > 0 ? 1 - y / 1.45 : 1 + (Math.abs(K) * y) / 0.55);
        pts.push([v.sx(spread * 2.2), v.sy(y)]);
      }
      poly(f, pts, { stroke: K > 0.02 ? C.accent : K < -0.02 ? C.green : C.warm, lw: 2.1 });
    }
    void cx;
    void centerY;
    void radius;

    text(f, K > 0.02 ? '正曲率（球面）：测地线相互汇聚' : K < -0.02 ? '负曲率（双曲面）：测地线相互发散' : '零曲率（欧氏平面）：测地线保持平行', w / 2, 52, {
      align: 'center', font: 'bold 15px system-ui', color: K > 0.02 ? C.accent : K < -0.02 ? C.green : C.warm,
    });
    text(f, `当前曲率 K = ${K.toFixed(2)}`, w / 2, 78, { align: 'center', color: C.fg, font: '13px Consolas, monospace' });
    text(f, '三角形内角和：球面 > 180°，欧氏 = 180°，双曲 < 180°', w / 2, 102, {
      align: 'center', color: C.dim, font: '13px system-ui',
    });

    heading(f, '黎曼几何：曲率是内蕴的');
    footnotes(f, [
      '黎曼（1854）提出：几何的本质是在每点给定「如何测量长度」的规则（度量）',
      '曲率不必依赖外部空间——它由度量本身决定，所以是「内蕴」的',
      '半世纪后爱因斯坦用这套语言描述时空弯曲，广义相对论由此诞生',
    ]);
  },
});

// ---------------------------------------------------------------- T45
/** T45 狄利克雷三角级数收敛定理。 */
const dirichletConvergenceViz = defineViz({
  slug: 'dirichlet-convergence',
  title: '狄利克雷三角级数收敛定理',
  params: {
    terms: { type: 'range', min: 1, max: 60, default: 15, label: '谐波项数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const terms = Math.max(1, Math.round(num(params, 'terms', 15)));

    // 目标：分段单调的阶跃函数（在 π/2 处跳跃）
    const jump = Math.PI / 2;
    const target = (x: number): number => (x < jump ? -0.5 : 0.7);
    // 傅里叶部分和（用数值积分求系数，保证在跳跃点收敛到左右极限中点）
    const N = 200;
    const a0 = (() => {
      let s = 0;
      for (let i = 0; i < N; i++) {
        const x = (i + 0.5) * ((2 * Math.PI) / N);
        s += target(x);
      }
      return (2 * s) / N;
    })();
    const an: number[] = [];
    const bn: number[] = [];
    for (let n = 1; n <= terms; n++) {
      let ca = 0;
      let sb = 0;
      for (let i = 0; i < N; i++) {
        const x = (i + 0.5) * ((2 * Math.PI) / N);
        ca += target(x) * Math.cos(n * x);
        sb += target(x) * Math.sin(n * x);
      }
      an.push((2 * ca) / N);
      bn.push((2 * sb) / N);
    }
    const partial = (x: number): number => {
      let s = a0 / 2;
      for (let n = 1; n <= terms; n++) s += an[n - 1] * Math.cos(n * x) + bn[n - 1] * Math.sin(n * x);
      return s;
    };

    const v = view(f, { xMin: 0, xMax: 2 * Math.PI, yMin: -1.1, yMax: 1.1, inset: 52 });
    grid(f, v, { divisions: 6, ticks: true });
    curve(f, v, target, { color: 'rgba(160,174,192,0.6)', lw: 1.8, dash: [5, 4] } as never);
    curve(f, v, partial, { color: C.accent, lw: 2.3 } as never);

    // 跳跃点处的收敛值（左右极限平均值）
    const left = -0.5;
    const right = 0.7;
    const mid = (left + right) / 2;
    seg(f, v.sx(jump), v.sy(-1.1), v.sx(jump), v.sy(1.1), { color: C.grid, lw: 1.2, dash: [4, 4] } as never);
    dot(f, v.sx(jump), v.sy(mid), 6, C.warm);
    text(f, `跳跃点收敛到左右极限的平均值 ${mid.toFixed(3)}`, v.sx(jump) + 10, v.sy(mid) - 12, {
      color: C.warm, font: '12px system-ui',
    });

    text(f, `前 ${terms} 个谐波`, 50, 46, { font: 'bold 16px "Times New Roman", serif', color: C.accent });
    text(f, '灰色虚线：分段单调函数；蓝色：傅里叶部分和', 50, 72, { color: C.fg, font: '13px system-ui' });
    text(f, '狄利克雷条件：分段单调 + 有界 ⇒ 每点收敛（跳跃点取左右极限平均）', 50, 96, {
      color: C.dim, font: '12px system-ui',
    });

    heading(f, '狄利克雷收敛定理：给傅里叶级数一个严格身份');
    footnotes(f, [
      '傅里叶的断言起初被批评「不严格」，狄利克雷（1829）给出了第一个收敛判据',
      '在连续点级数收敛到函数值；在跳跃点收敛到左右极限的平均值（图中橙点）',
      '这项工作是分析严密化运动的关键一步，也开启了「何种函数可展开」的长期研究',
    ]);
  },
});

// ---------------------------------------------------------------- T46
/** T46 诺特定理。 */
const noethersTheoremViz = defineViz({
  slug: 'noethers-theorem',
  title: '诺特定理',
  params: {
    pick: { type: 'range', min: 0, max: 3, default: 0, label: '选择对称性' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const items: Array<{ sym: string; keep: string; law: string; color: string }> = [
      { sym: '时间平移不变', keep: '能量守恒', law: '物理规律今天和明天一样', color: C.accent },
      { sym: '空间平移不变', keep: '动量守恒', law: '物理规律在这里和那里一样', color: C.cyan },
      { sym: '空间旋转不变', keep: '角动量守恒', law: '物理规律朝哪个方向看都一样', color: C.green },
      { sym: '相位变换不变', keep: '电荷守恒', law: '波函数的整体相位不可观测', color: C.yellow },
    ];
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(num(params, 'pick', 0))));
    const cur = items[idx];

    const topY = 120;
    const boxW = Math.min(230, w * 0.34);
    const boxH = 74;

    // 左：对称性
    items.forEach((it, i) => {
      const y = topY + i * (boxH + 16);
      const on = i === idx;
      poly(f, [[60, y], [60 + boxW, y], [60 + boxW, y + boxH], [60, y + boxH]], {
        fill: on ? it.color + '55' : 'rgba(45,55,72,0.7)',
        stroke: on ? it.color : C.grid, lw: on ? 2 : 1.2, close: true,
      });
      text(f, it.sym, 60 + boxW / 2, y + boxH / 2 + 5, {
        align: 'center', color: on ? C.fg : C.dim, font: (on ? 'bold ' : '') + '14px system-ui',
      });
      // 箭头
      seg(f, 60 + boxW + 8, y + boxH / 2, w - 60 - boxW - 8, y + boxH / 2, {
        color: on ? it.color : 'rgba(58,74,99,0.7)', lw: on ? 2.2 : 1.2,
      } as never);
    });

    // 右：守恒量
    const rx = w - 60 - boxW;
    poly(f, [[rx, topY + (boxH + 16) * 0.9], [rx + boxW, topY + (boxH + 16) * 0.9], [rx + boxW, topY + (boxH + 16) * 2.4], [rx, topY + (boxH + 16) * 2.4]], {
      fill: cur.color + '44', stroke: cur.color, lw: 2, close: true,
    });
    text(f, cur.keep, rx + boxW / 2, topY + (boxH + 16) * 1.65, {
      align: 'center', color: C.fg, font: 'bold 20px system-ui',
    });

    text(f, '诺特定理：每一个连续对称性 ⇒ 一个守恒量', w / 2, 52, {
      align: 'center', font: 'bold 17px system-ui', color: C.warm,
    });
    text(f, cur.law, w / 2, 80, { align: 'center', color: C.dim, font: '13px system-ui' });
    text(f, `当前：${cur.sym} ⇒ ${cur.keep}`, w / 2, h - 96, {
      align: 'center', color: cur.color, font: 'bold 15px system-ui',
    });

    heading(f, '诺特定理：对称性是物理定律的根基');
    footnotes(f, [
      '艾米·诺特（1918）证明：连续对称性与守恒律一一对应',
      '这不仅解释了已知的守恒律，更给出了「寻找新守恒量」的方法：先找对称性',
      '它成为现代理论物理（量子场论、粒子物理）的支柱',
    ]);
  },
});

// ---------------------------------------------------------------- T47
/** T47 哥德尔不完备性定理。 */
const godelIncompletenessViz = defineViz({
  slug: 'godel-incompleteness',
  title: '哥德尔不完备性定理',
  params: {
    show: { type: 'select', options: ['显示 G 的位置', '隐藏 G 的位置'], default: '显示 G 的位置', label: '标注' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const showG = str(params, 'show', '显示 G 的位置') === '显示 G 的位置';

    // 三个集合：全部命题 ⊃ 真命题；可证命题 ⊂ 真命题（但 G 在真命题中却不可证）
    const cx = w / 2;
    const cy = h / 2 + 16;
    const rAll = Math.min(w * 0.3, h * 0.36);
    const rTrue = rAll * 0.72;
    const rProv = rTrue * 0.72;

    const ellipse = (rx: number, ry: number, color: string, lw: number, fill?: string) => {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 120; i++) {
        const a = (i * 2 * Math.PI) / 120;
        pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
      }
      poly(f, pts, { stroke: color, lw, fill, close: true });
    };

    ellipse(rAll, rAll * 0.82, C.grid, 1.6);
    ellipse(rTrue, rTrue * 0.82, C.accent, 2, 'rgba(102,126,234,0.12)');
    ellipse(rProv, rProv * 0.82, C.green, 2, 'rgba(72,187,120,0.18)');

    // G 属于真命题但不可证 → 放在「真但不(_可证)」的环带里
    const gx = cx + (rTrue * 0.86 + rProv * 0.86) / 2 * 0.92;
    const gy = cy - (rTrue * 0.82 * 0.62 + rProv * 0.82 * 0.62) / 2 * 0.6;
    if (showG) {
      dot(f, gx, gy, 7, C.hot);
      text(f, 'G', gx + 12, gy - 10, { color: C.hot, font: 'bold 16px system-ui' });
      text(f, '“本命题不可证”', gx + 12, gy + 8, { color: C.hot, font: '12px system-ui' });
    }

    text(f, '全部命题', cx, cy - rAll * 0.82 + 18, { align: 'center', color: C.dim, font: '12px system-ui' });
    text(f, '真命题', cx, cy - rTrue * 0.82 + 20, { align: 'center', color: C.accent, font: '12px system-ui' });
    text(f, '可证命题', cx, cy - rProv * 0.82 + 20, { align: 'center', color: C.green, font: 'bold 12px system-ui' });

    text(f, 'G：真，但系统内无法证明（也无法证伪）', w / 2, 50, {
      align: 'center', font: 'bold 16px system-ui', color: C.hot,
    });
    text(f, '绿色 = 可证；蓝色 = 真；红色点 G 落在「真但不可证」的环带里', w / 2, 76, {
      align: 'center', color: C.fg, font: '13px system-ui',
    });
    text(f, '⇒ 任何足够强、一致的形式系统都是「不完备」的', w / 2, h - 92, {
      align: 'center', color: C.warm, font: 'bold 14px system-ui',
    });

    heading(f, '哥德尔不完备性定理：数学不可能被完全形式化');
    footnotes(f, [
      '哥德尔（1931）构造出自指命题 G：「本命题不可证」',
      '若 G 可证 → 系统不一致；若 G 不可证 → G 为真却不可证 ⇒ 系统不完备',
      '它终结了希尔伯特「把数学完全公理化」的计划，深刻影响了逻辑学与计算机科学',
    ]);
  },
});

// ---------------------------------------------------------------- T48
/** T48 维诺格拉多夫三素数定理。 */
const vinogradovThreePrimesViz = defineViz({
  slug: 'vinogradov-three-primes',
  title: '维诺格拉多夫三素数定理',
  params: {
    odd: { type: 'range', min: 7, max: 599, step: 2, default: 101, label: '奇数 n' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = (() => {
      let v = Math.round(num(params, 'odd', 101));
      if (v % 2 === 0) v += 1;
      return Math.max(9, v);
    })();

    // 寻找一组 p1 ≤ p2 ≤ p3，和为 n
    let found: [number, number, number] | null = null;
    const primes: number[] = [];
    for (let i = 3; i <= n; i += 2) if (isPrime(i)) primes.push(i);
    for (const p1 of primes) {
      if (found) break;
      for (const p2 of primes) {
        if (p2 < p1) continue;
        const p3 = n - p1 - p2;
        if (p3 >= p2 && isPrime(p3)) {
          found = [p1, p2, p3];
          break;
        }
      }
    }

    // 柱状展示三个素数
    const parts = found ?? [3, 3, 3];
    const baseY = h - 150;
    const maxV = Math.max(...parts, 1);
    parts.forEach((p, i) => {
      const bw = Math.min(120, (w - 200) / 3 - 20);
      const x = 140 + i * (bw + 34);
      const bh = (p / maxV) * (h - 300);
      poly(f, [[x, baseY - bh], [x + bw, baseY - bh], [x + bw, baseY], [x, baseY]], {
        fill: [C.accent, C.cyan, C.green][i] + 'cc', close: true,
      });
      text(f, String(p), x + bw / 2, baseY - bh - 10, { align: 'center', color: C.fg, font: 'bold 16px system-ui' });
      text(f, `p${i + 1}`, x + bw / 2, baseY + 18, { align: 'center', color: C.dim, font: '13px system-ui' });
    });

    text(f, `${parts[0]} + ${parts[1]} + ${parts[2]} = ${n}`, w / 2, 52, {
      align: 'center', font: 'bold 22px "Times New Roman", serif', color: C.warm,
    });
    text(f, `奇数 n = ${n} 表示为三个素数之和`, w / 2, 82, {
      align: 'center', color: C.fg, font: '14px system-ui',
    });
    text(f, '维诺格拉多夫（1937）证明：足够大的奇数都可以这样表示', w / 2, 108, {
      align: 'center', color: C.dim, font: '13px system-ui',
    });

    heading(f, '三素数定理：向哥德巴赫猜想迈出的关键一步');
    footnotes(f, [
      '弱哥德巴赫猜想（奇数版）由维诺格拉多夫用「三角和方法」证明（对充分大的奇数）',
      '图中给出当前 n 的一个具体表示，可拖动滑块查看其他奇数',
      '该定理与强哥德巴赫猜想（偶数 = 两素数之和）共同构成解析数论的经典问题',
    ]);
  },
});

// ---------------------------------------------------------------- T49
/** T49 素数定理与初等证明。 */
const primeNumberTheoremViz = defineViz({
  slug: 'prime-number-theorem',
  title: '素数定理与初等证明',
  params: {
    xMax: { type: 'range', min: 50, max: 3000, default: 800, label: '范围 x' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const xMax = Math.max(20, Math.round(num(params, 'xMax', 800)));

    // 素数计数 π(x)
    const sieve = new Array<boolean>(xMax + 1).fill(true);
    sieve[0] = sieve[1] = false;
    for (let i = 2; i * i <= xMax; i++) if (sieve[i]) for (let j = i * i; j <= xMax; j += i) sieve[j] = false;

    const pts: Array<[number, number]> = [];
    let count = 0;
    for (let x = 2; x <= xMax; x++) {
      if (sieve[x]) count++;
      if (x % Math.max(1, Math.floor(xMax / 260)) === 0) pts.push([x, count]);
    }

    const estimate = (x: number): number => x / Math.log(Math.max(x, Math.E));
    const yMax = estimate(xMax) * 1.15;
    const v = view(f, { xMin: 0, xMax, yMin: 0, yMax: Math.max(yMax, 5), inset: 52 });
    grid(f, v, { divisions: 6, ticks: true });
    if (pts.length > 1) {
      for (let i = 1; i < pts.length; i++) {
        seg(f, v.sx(pts[i - 1][0]), v.sy(pts[i - 1][1]), v.sx(pts[i][0]), v.sy(pts[i][1]), { color: C.accent, lw: 2.2 } as never);
      }
      dot(f, v.sx(pts[pts.length - 1][0]), v.sy(pts[pts.length - 1][1]), 5, C.accent);
    }
    curve(f, v, estimate, { color: C.warm, lw: 1.8, dash: [6, 4] } as never);

    const actual = pts.length ? pts[pts.length - 1][1] : 0;
    text(f, `π(x) = ${actual}　　x/ln x = ${estimate(xMax).toFixed(1)}`, 50, 46, {
      font: 'bold 15px Consolas, monospace', color: C.accent,
    });
    text(f, `比值 π(x)/(x/ln x) = ${(actual / estimate(xMax)).toFixed(4)} → 1`, 50, 72, {
      color: C.green, font: '13px Consolas, monospace',
    });
    text(f, '蓝色：实际素数个数 π(x)　橙色虚线：x/ln x 渐近估计', 50, 96, {
      color: C.dim, font: '12px system-ui',
    });

    heading(f, '素数定理：素数分布的渐近规律');
    footnotes(f, [
      '小于 x 的素数个数 π(x) ~ x/ln x（等价于第 n 个素数 ~ n ln n）',
      '1896 年由阿达马与德拉瓦莱普桑用复分析证明；1949 年塞尔伯格与埃尔德什给出初等证明',
      '「初等」指不使用复变函数——这让许多人意外，也让素数分布与 ζ 函数的关系更显深刻',
    ]);
  },
});

// ---------------------------------------------------------------- T50
/** T50 费马大定理。 */
const fermatsLastTheoremViz = defineViz({
  slug: 'fermats-last-theorem',
  title: '费马大定理',
  params: {
    n: { type: 'range', min: 2, max: 9, default: 3, label: '幂次 n' },
    limit: { type: 'range', min: 10, max: 120, default: 60, label: '搜索范围' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.max(2, Math.round(num(params, 'n', 3)));
    const limit = Math.max(3, Math.round(num(params, 'limit', 60)));

    // 搜索整数解 x^n + y^n = z^n（在范围内）
    const solutions: Array<[number, number, number]> = [];
    for (let x = 1; x <= limit; x++) {
      for (let y = x; y <= limit; y++) {
        const sum = Math.pow(x, n) + Math.pow(y, n);
        const z = Math.round(Math.pow(sum, 1 / n));
        for (const zz of [z - 1, z, z + 1]) {
          if (zz > 0 && Math.pow(zz, n) === sum) solutions.push([x, y, zz]);
        }
      }
    }

    const v = equalView(f, 0, limit / 2, limit * 0.62, 60);
    grid(f, v, { divisions: 6, ticks: false });
    // 所有 (x, y) 格点
    for (let x = 1; x <= limit; x += Math.max(1, Math.floor(limit / 40))) {
      for (let y = x; y <= limit; y += Math.max(1, Math.floor(limit / 40))) {
        dot(f, v.sx(x), v.sy(y), 1.6, 'rgba(160,174,192,0.35)');
      }
    }
    solutions.forEach(([x, y, z]) => {
      dot(f, v.sx(x), v.sy(y), 6, C.hot);
      text(f, `${x}^${n}+${y}^${n}=${z}^${n}`, v.sx(x) + 10, v.sy(y) - 8, { color: C.hot, font: '12px system-ui' });
    });

    text(f, `x^${n} + y^${n} = z^${n}`, 60, 50, {
      font: 'bold 20px "Times New Roman", serif', color: C.warm,
    });
    text(f, `在 1 ≤ x, y ≤ ${limit} 内找到 ${solutions.length} 组正整数解`, 60, 78, {
      color: solutions.length ? C.green : C.hot, font: 'bold 14px system-ui',
    });
    text(f, n === 2 ? 'n = 2（勾股定理）：解有无穷多组' : n < 2 ? '' : `n = ${n} > 2：找不到任何解——这正是费马大定理`, 60, 102, {
      color: C.dim, font: '13px system-ui',
    });

    heading(f, '费马大定理：358 年的空白批注');
    footnotes(f, [
      '费马在丢番图《算术》的页边写道：「我确信已找到绝妙证明，可惜这里空白太小」',
      'n = 2 时有无穷多组解（勾股数）；n > 2 时一组也没有——拖动滑块对比',
      '1994 年怀尔斯完成证明，1997 年获得沃尔夫斯堡奖（后并入阿贝尔奖体系）',
    ]);
  },
});

// ---------------------------------------------------------------- T51
/** T51 怀尔斯对费马大定理的证明。 */
const wilesProofViz = defineViz({
  slug: 'wiles-proof',
  title: '怀尔斯对费马大定理的证明',
  params: {
    mode: { type: 'select', options: ['椭圆曲线 ↔ 模形式', '证明的逻辑链'], default: '椭圆曲线 ↔ 模形式', label: '展示' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = str(params, 'mode', '椭圆曲线 ↔ 模形式');

    if (mode === '椭圆曲线 ↔ 模形式') {
      // 左：椭圆曲线 y² = x³ − x（在实数平面）
      const v1 = view(f, { xMin: -2, xMax: 2.6, yMin: -3, yMax: 3, inset: 46 });
      grid(f, v1, { divisions: 5, ticks: false });
      const right = (x: number): number => Math.sqrt(Math.max(0, x * x * x - x));
      curve(f, v1, (x) => (x >= -1 && x <= 0 ? 0 : x >= 1 ? right(x) : NaN), { color: C.accent, lw: 2.4 } as never);
      curve(f, v1, (x) => (x >= -1 && x <= 0 ? 0 : x >= 1 ? -right(x) : NaN), { color: C.accent, lw: 2.4 } as never);
      text(f, 'y² = x³ − x', w * 0.24, 50, { align: 'center', color: C.accent, font: 'bold 15px "Times New Roman", serif' });
      text(f, '椭圆曲线', w * 0.24, 76, { align: 'center', color: C.dim, font: '13px system-ui' });

      // 右：模形式（示意：周期性的对称波形）
      const v2 = view(f, { xMin: 0, xMax: 4, yMin: -2, yMax: 2, inset: 46 });
      const base = w * 0.52;
      for (let k = 0; k < 6; k++) {
        const pts: Array<[number, number]> = [];
        for (let t = 0; t <= 1.001; t += 0.02) {
          const x = k + t;
          const y = Math.sin(Math.PI * t) * (1 / (1 + k * 0.4)) * Math.cos(k * 0.7);
          pts.push([base + v2.sx(x) * 0.22, v2.sy(y * 1.4)]);
        }
        poly(f, pts, { stroke: C.green, lw: 1.8 - k * 0.12 });
      }
      text(f, '模形式（高度对称的周期结构）', w * 0.78, 50, {
        align: 'center', color: C.green, font: 'bold 14px system-ui',
      });
      text(f, '谷山-志村猜想：每条椭圆曲线都对应一个模形式', w / 2, h - 120, {
        align: 'center', color: C.warm, font: 'bold 14px system-ui',
      });
      text(f, '怀尔斯证明了其中的关键情形 ⇒ 费马大定理成立', w / 2, h - 96, {
        align: 'center', color: C.fg, font: '13px system-ui',
      });
    } else {
      const stepsQ = [
        '假设存在 x³ + y³ = z³ 的整数解',
        '↓ 由此构造出特殊的椭圆曲线（弗雷曲线）',
        '↓ 弗雷曲线「太奇怪」，不可能对应任何模形式',
        '↓ 怀尔斯证明：某类椭圆曲线必对应模形式（谷山-志村）',
        '⇒ 矛盾：这样的整数解不存在，n = 3 成立',
        '⇒ 推广到所有 n > 2（含 n = 4 的独立情形）',
      ];
      stepsQ.forEach((s, i) => {
        text(f, s, 60, 96 + i * 46, { color: i === 0 ? C.hot : i === 4 ? C.green : C.fg, font: i === 0 || i === 4 ? 'bold 15px system-ui' : '14px system-ui' });
      });
    }

    heading(f, '怀尔斯证明：把数论与代数几何编织起来');
    footnotes(f, [
      '1993 年宣布证明，随后发现漏洞；1994 年与泰勒合作补全，同年 10 月完成',
      '关键工具是椭圆曲线、模形式与伽罗瓦表示之间的深刻对应（朗兰兹纲领的一部分）',
      '费马于 1637 年写下猜想，到 1994 年被证明——历时 358 年',
    ]);
  },
});

// ---------------------------------------------------------------- T52
/** T52 庞加莱猜想。 */
const poincareConjectureViz = defineViz({
  slug: 'poincare-conjecture',
  title: '庞加莱猜想',
  params: {
    model: { type: 'select', options: ['球面（单连通）', '环面（有洞）'], default: '球面（单连通）', label: '曲面类型' },
    t: { type: 'range', min: 0, max: 1, step: 0.02, default: 1, label: '收缩程度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const isSphere = str(params, 'model', '球面（单连通）') === '球面（单连通）';
    const t = Math.max(0, Math.min(1, num(params, 't', 1)));

    const cx = w / 2;
    const cy = h / 2 + 14;
    const R = Math.min(w * 0.3, h * 0.34);

    if (isSphere) {
      // 球面：网格线 + 一条可收缩的闭曲线
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 140; i++) {
        const a = (i * 2 * Math.PI) / 140;
        pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a) * 0.78]);
      }
      poly(f, pts, { stroke: C.accent, lw: 2.2, fill: 'rgba(102,126,234,0.14)' });
      // 经线
      for (const k of [-0.6, -0.2, 0.2, 0.6]) {
        const line: Array<[number, number]> = [];
        for (let i = 0; i <= 80; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 80;
          line.push([cx + R * k * Math.cos(a) * 0.95, cy + R * Math.sin(a) * 0.78]);
        }
        poly(f, line, { stroke: 'rgba(160,174,192,0.3)', lw: 1 });
      }
      // 收缩中的环
      const rr = R * (0.75 * t + 0.06);
      const loop: Array<[number, number]> = [];
      for (let i = 0; i <= 100; i++) {
        const a = (i * 2 * Math.PI) / 100;
        loop.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a) * 0.5 + R * 0.34]);
      }
      poly(f, loop, { stroke: C.hot, lw: 2.2 });

      text(f, '球面上的闭曲线可以连续收缩成一点', w / 2, 50, {
        align: 'center', font: 'bold 15px system-ui', color: C.hot,
      });
      text(f, `收缩程度：${(t * 100).toFixed(0)}%（红色环逐渐缩小）`, w / 2, 76, {
        align: 'center', color: C.fg, font: '13px system-ui',
      });
      text(f, '⇒ 球面是「单连通」的', w / 2, h - 96, {
        align: 'center', color: C.green, font: 'bold 14px system-ui',
      });
    } else {
      // 环面：甜甜圈形状 + 一条无法收缩的环
      const rx = R * 1.05;
      const ry = R * 0.62;
      const tube = R * 0.3;
      const torus: Array<[number, number]> = [];
      for (let i = 0; i <= 160; i++) {
        const a = (i * 2 * Math.PI) / 160;
        torus.push([cx + (rx + tube * Math.cos(4 * a)) * Math.cos(a) * 0.98, cy + (ry + tube * Math.cos(4 * a) * 0.72) * Math.sin(a)]);
      }
      poly(f, torus, { stroke: C.accent, lw: 2, fill: 'rgba(102,126,234,0.12)', close: true });
      const hole: Array<[number, number]> = [];
      for (let i = 0; i <= 120; i++) {
        const a = (i * 2 * Math.PI) / 120;
        hole.push([cx + (rx * 0.42) * Math.cos(a), cy + (ry * 0.42) * Math.sin(a)]);
      }
      poly(f, hole, { stroke: C.dim, lw: 1.6 });
      // 绕洞一圈的曲线（无法收缩）
      const loop: Array<[number, number]> = [];
      for (let i = 0; i <= 120; i++) {
        const a = (i * 2 * Math.PI) / 120;
        loop.push([cx + (rx * 0.6 + tube * 0.5) * Math.cos(a) * (0.9 + 0.1 * t), cy + (ry * 0.6 + tube * 0.5) * Math.sin(a) * (0.9 + 0.1 * t)]);
      }
      poly(f, loop, { stroke: C.hot, lw: 2.4 });

      text(f, '环面上这条曲线被洞「卡住」，无法收缩成一点', w / 2, 50, {
        align: 'center', font: 'bold 15px system-ui', color: C.hot,
      });
      text(f, '⇒ 环面不是单连通的，与球面不同胚', w / 2, 76, {
        align: 'center', color: C.fg, font: '13px system-ui',
      });
      text(f, '（庞加莱猜想：三维情形的判定）', w / 2, h - 96, {
        align: 'center', color: C.dim, font: '13px system-ui',
      });
    }

    heading(f, '庞加莱猜想：单连通的闭三维流形就是三维球面');
    footnotes(f, [
      '猜想（1904）：任何单连通的闭三维流形都同胚于三维球面',
      '关键在「单连通」：闭曲线能否收缩成一点——二维的直觉在三维中失效',
      '佩雷尔曼（2002—2003）用里奇流与熵技巧完成证明，并拒绝菲尔兹奖与百万美元奖金',
    ]);
  },
});

// ---------------------------------------------------------------- T53
/** T53 拉格朗日与置换群。 */
const lagrangePermutationViz = defineViz({
  slug: 'lagrange-permutation-group',
  title: '拉格朗日与置换群',
  params: {
    pick: { type: 'range', min: 0, max: 5, default: 0, label: '第几个置换' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    // 三次方程三根的 6 个置换
    const perms: number[][] = [
      [1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1],
    ];
    const idx = Math.max(0, Math.min(perms.length - 1, Math.round(num(params, 'pick', 0))));
    const pm = perms[idx];

    const cell = 52;
    const ox = 90;
    const rowY = [130, 250];

    // 根的位置
    const roots = ['r₁', 'r₂', 'r₃'];
    text(f, '根的原始顺序', ox + (0.5 * cell), 108, { align: 'center', color: C.dim, font: '13px system-ui' });
    roots.forEach((r, i) => {
      const x = ox + i * cell;
      poly(f, [[x, rowY[0]], [x + cell - 6, rowY[0]], [x + cell - 6, rowY[0] + 44], [x, rowY[0] + 44]], {
        fill: 'rgba(45,55,72,0.9)', close: true,
      });
      text(f, r, x + (cell - 6) / 2, rowY[0] + 28, { align: 'center', color: C.fg, font: 'bold 15px system-ui' });
    });

    // 置换后的顺序
    text(f, `置换 σ${idx + 1}`, ox + 1.5 * cell, rowY[1] - 22, { align: 'center', color: C.warm, font: 'bold 13px system-ui' });
    pm.forEach((val, i) => {
      const x = ox + i * cell;
      const isFix = val === i + 1;
      poly(f, [[x, rowY[1]], [x + cell - 6, rowY[1]], [x + cell - 6, rowY[1] + 44], [x, rowY[1] + 44]], {
        fill: isFix ? 'rgba(72,187,120,0.6)' : 'rgba(102,126,234,0.62)', close: true,
      });
      text(f, roots[val - 1], x + (cell - 6) / 2, rowY[1] + 28, { align: 'center', color: C.fg, font: 'bold 15px system-ui' });
      // 连线
      const fromX = ox + (val - 1) * cell + (cell - 6) / 2;
      seg(f, fromX, rowY[0] + 44, x + (cell - 6) / 2, rowY[1], { color: isFix ? C.green : C.accent, lw: 1.6 } as never);
    });

    const fixed = pm.filter((v, i) => v === i + 1).length;
    text(f, `三次方程根的全部置换共 3! = 6 个`, 60, 50, {
      font: 'bold 15px system-ui', color: C.warm,
    });
    text(f, `当前置换 (${pm.join(' ')})：${fixed} 个根保持不变（绿色）`, 60, 76, {
      color: C.fg, font: '13px system-ui',
    });
    text(f, '根的对称组合（在这些置换下不变）就是「预解式」，群的思想从这里萌芽', 60, 100, {
      color: C.dim, font: '12px system-ui',
    });
    text(f, '六十年后，伽罗瓦用这些置换构成群，一举解开方程可解性的谜题', w / 2, h - 92, {
      align: 'center', color: C.green, font: 'bold 14px system-ui',
    });

    heading(f, '拉格朗日：群论的第一个脚印');
    footnotes(f, [
      '拉格朗日研究方程根的有序置换，发现某些对称组合在置换下保持不变',
      '他提出的「预解式」思想，把方程求解归结为对称性的分析',
      '这项工作为伽罗瓦的群论铺平了道路——「群」作为数学对象正式登场',
    ]);
  },
});

registerViz(
  bolzanoWeierstrassViz,
  quadraticReciprocityViz,
  galoisTheoryViz,
  riemannianGeometryViz,
  dirichletConvergenceViz,
  noethersTheoremViz,
  godelIncompletenessViz,
  vinogradovThreePrimesViz,
  primeNumberTheoremViz,
  fermatsLastTheoremViz,
  wilesProofViz,
  poincareConjectureViz,
  lagrangePermutationViz,
);
