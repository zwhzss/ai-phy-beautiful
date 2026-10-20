/**
 * 数学史里程碑 · doubao 补充批次四（T92–T102：20 世纪下半叶）。
 */
import { defineViz, num, str, VizFrame } from '../types';
import { registerViz } from '../registry';
import { C, curve, dot, equalView, footnotes, grid, heading, poly, rng, scatter, seg, text, view } from '../canvas';

function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}

// ---------------------------------------------------------------- T92
/** T92 图灵停机问题。 */
const turingHaltingViz = defineViz({
  slug: 'turing-halting-problem',
  title: '图灵停机问题',
  params: {
    rows: { type: 'range', min: 4, max: 10, default: 7, label: '枚举的程序个数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const rows = Math.max(3, Math.round(num(params, 'rows', 7)));

    const rand = rng(1936);
    // 虚构的「程序 × 输入」停机表（H = 停机，L = 不停机）
    const table: string[][] = [];
    for (let i = 0; i < rows; i++) {
      const row: string[] = [];
      for (let j = 0; j < rows; j++) row.push(rand() < 0.55 ? 'H' : 'L');
      table.push(row);
    }
    // 对角线取反 → 构造出让所有程序都判断错的行
    const diag: string[] = table.map((row, i) => (row[i] === 'H' ? 'L' : 'H'));

    const cell = Math.min(40, (w - 280) / rows);
    const ox = 150;
    const oy = 120;

    for (let i = 0; i < rows; i++) {
      text(f, `P${i + 1}`, ox - 18, oy + i * cell + cell / 2 + 4, { align: 'right', color: C.dim, font: '12px system-ui' });
      text(f, `x${i + 1}`, ox + i * cell + cell / 2, oy - 10, { align: 'center', color: C.dim, font: '12px system-ui' });
      for (let j = 0; j < rows; j++) {
        const x = ox + j * cell;
        const y = oy + i * cell;
        const on = i === j;
        poly(f, [[x, y], [x + cell - 3, y], [x + cell - 3, y + cell - 3], [x, y + cell - 3]], {
          fill: on ? 'rgba(237,137,54,0.55)' : table[i][j] === 'H' ? 'rgba(72,187,120,0.45)' : 'rgba(245,101,101,0.35)',
          close: true,
        });
        text(f, table[i][j], x + (cell - 3) / 2, y + cell / 2 + 1, { align: 'center', color: C.fg, font: '12px Consolas, monospace' });
      }
    }

    // 构造出的「反行」
    const ny = oy + rows * cell + 30;
    text(f, 'P*', ox - 18, ny + cell / 2 + 4, { align: 'right', color: C.hot, font: 'bold 12px system-ui' });
    for (let j = 0; j < rows; j++) {
      const x = ox + j * cell;
      poly(f, [[x, ny], [x + cell - 3, ny], [x + cell - 3, ny + cell - 3], [x, ny + cell - 3]], {
        fill: diag[j] === 'H' ? 'rgba(72,187,120,0.6)' : 'rgba(245,101,101,0.5)', close: true,
      });
      text(f, diag[j], x + (cell - 3) / 2, ny + cell / 2 + 1, { align: 'center', color: C.fg, font: '12px Consolas, monospace' });
    }
    text(f, 'P* 在第 k 项上与 P_k 的判断相反 ⇒ 没有程序能正确判断 P*', ox, ny + cell + 28, {
      color: C.hot, font: 'bold 13px system-ui',
    });

    text(f, '假设存在停机判定程序 H(P, x)', w / 2, 52, {
      align: 'center', font: 'bold 16px system-ui', color: C.warm,
    });
    text(f, '对它本身作用对角线取反，即得矛盾 ⇒ 停机问题不可判定', w / 2, 78, {
      align: 'center', color: C.fg, font: '13px system-ui',
    });
    text(f, '绿色 = 停机，红色 = 不停机，橙色 = 对角线', w / 2, 102, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });

    heading(f, '图灵停机问题：计算的极限');
    footnotes(f, [
      '用与康托尔对角线法同样的技巧：遍历所有程序，构造一个「行为与每个程序都不同」的程序',
      '结论：不存在通用算法能判定任意程序是否停机——这是计算的固有边界',
      '它直接推出许多问题不可判定（如程序等价性），也界定了「能自动化什么」的边界',
    ]);
  },
});

// ---------------------------------------------------------------- T93
/** T93 怀特海德定理。 */
const whiteheadTheoremViz = defineViz({
  slug: 'whitehead-theorem',
  title: '怀特海德定理',
  params: {
    dim: { type: 'select', options: ['S¹（圆周）', 'S²（球面）', 'T²（环面）'], default: 'S²（球面）', label: '空间 X' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'dim', 'S²（球面）');

    const v = equalView(f, 0, 0, 1.6, 54);
    grid(f, v, { divisions: 4, ticks: false });

    if (kind.startsWith('S¹')) {
      const c: Array<[number, number]> = [];
      for (let i = 0; i <= 120; i++) {
        const a = (i * 2 * Math.PI) / 120;
        c.push([v.sx(78 * Math.cos(a)), v.sy(78 * Math.sin(a))]);
      }
      poly(f, c, { stroke: C.accent, lw: 2.6 });
      text(f, 'π₁ = ℤ，其余为 0', w / 2, h - 108, { align: 'center', color: C.accent, font: '13px system-ui' });
    } else if (kind.startsWith('S²')) {
      const c: Array<[number, number]> = [];
      for (let i = 0; i <= 130; i++) {
        const a = (i * 2 * Math.PI) / 130;
        c.push([v.sx(78 * Math.cos(a)), v.sy(78 * Math.sin(a) * 0.9)]);
      }
      poly(f, c, { fill: 'rgba(102,126,234,0.22)', stroke: C.accent, lw: 2.2 });
      for (const k of [-0.6, -0.2, 0.2, 0.6]) {
        const line: Array<[number, number]> = [];
        for (let i = 0; i <= 60; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 60;
          line.push([v.sx(78 * k * Math.cos(a) * 0.9), v.sy(78 * Math.sin(a) * 0.9)]);
        }
        poly(f, line, { stroke: 'rgba(160,174,192,0.3)', lw: 1 });
      }
      text(f, 'π₂ = ℤ，其余为 0', w / 2, h - 108, { align: 'center', color: C.accent, font: '13px system-ui' });
    } else {
      const cx = v.sx(0);
      const cy = v.sy(0);
      const rx = 88;
      const ry = 54;
      const tube = 26;
      const torus: Array<[number, number]> = [];
      for (let i = 0; i <= 160; i++) {
        const a = (i * 2 * Math.PI) / 160;
        torus.push([cx + (rx + tube * Math.cos(6 * a)) * Math.cos(a), cy + (ry + tube * Math.cos(6 * a) * 0.68) * Math.sin(a)]);
      }
      poly(f, torus, { stroke: C.accent, lw: 1.8, fill: 'rgba(102,126,234,0.2)', close: true });
      text(f, 'π₁ = ℤ²（非平凡）', w / 2, h - 108, { align: 'center', color: C.accent, font: '13px system-ui' });
    }

    // 五条公理式的示意：同伦群同构 ⇒ 同伦等价
    text(f, 'f : X → Y 诱导所有同伦群同构', w / 2, 52, {
      align: 'center', font: 'bold 16px "Times New Roman", serif', color: C.warm,
    });
    text(f, '⇒ f 是同伦等价（当 X、Y 为 CW 复形时）', w / 2, 78, {
      align: 'center', color: C.fg, font: '14px system-ui',
    });
    text(f, '即：同伦群能完全「看穿」CW 复形', w / 2, 102, {
      align: 'center', color: C.green, font: '13px system-ui',
    });

    heading(f, '怀特海德定理：同伦群同构蕴含同伦等价');
    footnotes(f, [
      '对 CW 复形，只要一个映射在所有维数上都诱导同伦群的同构，它本身就是同伦等价',
      '这说明同伦群是 CW 复形的完备不变量——没有「同伦群相同但不同伦等价」的 CW 复形',
      '它是代数拓扑的基本工具，也是 Whitehead 塔、Postnikov 分解等理论的出发点',
    ]);
  },
});

// ---------------------------------------------------------------- T94
/** T94 艾伦伯格-斯廷罗德公理。 */
const eilenbergSteenrodViz = defineViz({
  slug: 'eilenberg-steenrod',
  title: '艾伦伯格-斯廷罗德公理',
  params: {
    pick: { type: 'range', min: 0, max: 4, default: 0, label: '第几条公理' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const axioms = [
      { name: '1° 同伦不变性', desc: '同伦的映射诱导相同的同态' },
      { name: '2° 正合性', desc: '三元组的长正合列（连接同态存在）' },
      { name: '3° 切除公理', desc: '内部子空间的切除不改变同调' },
      { name: '4° 维数公理', desc: '单点空间的 H₀ = ℤ，其余为 0' },
      { name: '5° 可加性', desc: '不交并的同调是同调群的直和' },
    ];
    const idx = Math.max(0, Math.min(4, Math.round(num(params, 'pick', 0))));

    axioms.forEach((a, i) => {
      const y = 118 + i * 56;
      const on = i === idx;
      poly(f, [[56, y], [w - 56, y], [w - 56, y + 46], [56, y + 46]], {
        fill: on ? 'rgba(102,126,234,0.35)' : 'rgba(45,55,72,0.7)',
        stroke: on ? C.accent : C.grid, lw: on ? 2 : 1.2, close: true,
      });
      text(f, a.name, 72, y + 29, { color: on ? C.fg : C.dim, font: (on ? 'bold ' : '') + '14px system-ui' });
      text(f, a.desc, 300, y + 29, { color: on ? C.fg : C.dim, font: '13px system-ui' });
    });

    // 底部：各种同调理论的统一
    const theories = ['奇异同调', '单纯同调', '胞腔同调', '德拉姆上同调', 'Čech 上同调'];
    theories.forEach((t, i) => {
      const x = 70 + i * ((w - 140) / theories.length);
      poly(f, [[x, h - 118], [x + 132, h - 118], [x + 132, h - 74], [x, h - 74]], {
        fill: 'rgba(56,178,172,0.4)', close: true,
      });
      text(f, t, x + 66, h - 92, { align: 'center', color: C.fg, font: '12px system-ui' });
    });
    text(f, '五条公理统一了各种同调理论的构造', w / 2, h - 50, {
      align: 'center', color: C.green, font: 'bold 13px system-ui',
    });

    heading(f, '艾伦伯格-斯廷罗德公理：同调论的公理化');
    footnotes(f, [
      '用一组公理刻画「同调论应该满足什么」，而不是规定「同调怎么算」',
      '奇异、单纯、胞腔同调都满足这组公理，因此在 CW 复形上彼此自然同构',
      '公理化方法是 20 世纪数学的显著特征：先定性质，再找实现',
    ]);
  },
});

// ---------------------------------------------------------------- T95
/** T95 香农信息熵公式。 */
const shannonEntropyViz = defineViz({
  slug: 'shannon-entropy',
  title: '香农信息熵公式',
  params: {
    p: { type: 'range', min: 0.01, max: 0.99, step: 0.01, default: 0.5, label: '概率 p（二元信源）' },
    n: { type: 'range', min: 2, max: 8, default: 4, label: '信源符号数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const p = Math.min(0.99, Math.max(0.01, num(params, 'p', 0.5)));
    const n = Math.max(2, Math.round(num(params, 'n', 4)));

    // 二元熵函数 H(p) = −p log₂p − (1−p) log₂(1−p)
    const H2 = (x: number): number => (x <= 0 || x >= 1 ? 0 : -x * (Math.log(x) / Math.LN2) - (1 - x) * (Math.log(1 - x) / Math.LN2));
    const Hn = Math.log(n) / Math.LN2;

    const v = view(f, { xMin: 0, xMax: 1, yMin: 0, yMax: 3.4, inset: 54 });
    grid(f, v, { divisions: 5, ticks: true });
    seg(f, v.sx(0), v.sy(Hn), v.sx(1), v.sy(Hn), { color: C.cyan, lw: 1.6, dash: [6, 4] } as never);
    text(f, `等概率 ${n} 符号的最大熵 log₂${n} = ${Hn.toFixed(3)}`, v.sx(1) - 8, v.sy(Hn) - 10, {
      align: 'right', color: C.cyan, font: '12px system-ui',
    });
    curve(f, v, H2, { color: C.accent, lw: 2.6 } as never);
    dot(f, v.sx(p), v.sy(H2(p)), 6, C.warm);

    text(f, 'H = −Σ pᵢ log₂ pᵢ', w / 2, 48, {
      align: 'center', font: 'bold 20px "Times New Roman", serif', color: C.warm,
    });
    text(f, `p = ${p.toFixed(2)} 时 H = ${H2(p).toFixed(4)} 比特`, w / 2, 76, {
      align: 'center', color: C.green, font: '15px Consolas, monospace',
    });
    text(f, 'p = 0.5 时熵最大（最不确定）；p → 0 或 1 时熵为 0（结果确定）', w / 2, 100, {
      align: 'center', color: C.dim, font: '13px system-ui',
    });

    heading(f, '香农信息熵：不确定性的度量');
    footnotes(f, [
      'H 度量信源的平均不确定性，单位为比特；它也是无损压缩的理论下界',
      '香农定理：任何无损编码的平均码长不可能低于熵——压缩的极限由此确定',
      '「熵」这一概念来自热力学，香农借用它命名，从此贯穿信息论、统计与机器学习',
    ]);
  },
});

// ---------------------------------------------------------------- T96
/** T96 阿蒂亚-辛格指标定理。 */
const atiyahSingerViz = defineViz({
  slug: 'atiyah-singer-index',
  title: '阿蒂亚-辛格指标定理',
  params: {
    pick: { type: 'select', options: ['欧拉示性数（de Rham）', '符号差（签名算子）', '自旋流形（Â 亏格）'], default: '欧拉示性数（de Rham）', label: '经典案例' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'pick', '欧拉示性数（de Rham）');
    const cases: Record<string, { analytic: string; topo: string; dim: string }> = {
      '欧拉示性数（de Rham）': { analytic: 'ker d − im d 的维数差', topo: '欧拉示性数 χ(M)', dim: 'd + d*' },
      '符号差（签名算子）': { analytic: '正负特征子空间维数差', topo: '符号差 σ(M)（L 亏格积分）', dim: 'd + d*（Hodge 星）' },
      '自旋流形（Â 亏格）': { analytic: 'Dirac 算子零空间的维数', topo: 'Â 亏格 Â(M)', dim: 'Dirac 算子 D' },
    };
    const c = cases[kind] ?? cases['欧拉示性数（de Rham）'];

    const boxW = Math.min(280, w * 0.34);
    const cy = h / 2 - 10;

    const panel = (cx: number, title: string, body: string[], color: string) => {
      poly(f, [[cx - boxW / 2, cy - 88], [cx + boxW / 2, cy - 88], [cx + boxW / 2, cy + 88], [cx - boxW / 2, cy + 88]], {
        fill: color + '33', stroke: color, lw: 2, close: true,
      });
      text(f, title, cx, cy - 56, { align: 'center', color, font: 'bold 14px system-ui' });
      body.forEach((s, i) => {
        text(f, s, cx, cy - 20 + i * 26, { align: 'center', color: C.fg, font: '12px system-ui' });
      });
    };

    panel(w * 0.26, '解析指标', [c.analytic, `算子：${c.dim}`], C.accent);
    panel(w * 0.74, '拓扑指标', [c.topo, '（特征类的积分）'], C.cyan);
    text(f, '=', w / 2, cy + 6, { align: 'center', color: C.warm, font: 'bold 32px system-ui' });

    text(f, '阿蒂亚-辛格指标定理', w / 2, 52, {
      align: 'center', font: 'bold 18px "Times New Roman", serif', color: C.warm,
    });
    text(f, '椭圆算子的解析指标 = 流形的拓扑指标', w / 2, 80, {
      align: 'center', color: C.fg, font: '14px system-ui',
    });
    text(f, '它在微分方程与拓扑不变量之间架起桥梁，被誉为 20 世纪最宏大的定理之一', w / 2, 104, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });

    heading(f, '阿蒂亚-辛格指标定理：分析 = 拓扑');
    footnotes(f, [
      '「解析指标」是微分算子解空间的维数差，「拓扑指标」是流形的拓扑不变量',
      '切换案例可看到三类经典算子：de Rham（欧拉示性数）、签名（符号差）、Dirac（Â 亏格）',
      '它是 20 世纪数学的高峰，深刻影响了拓扑、几何、代数与理论物理（含弦论中的反常消除）',
    ]);
  },
});

// ---------------------------------------------------------------- T97
/** T97 塞尔对偶定理。 */
const serreDualityViz = defineViz({
  slug: 'serre-duality',
  title: '塞尔对偶定理',
  params: {
    dim: { type: 'range', min: 1, max: 3, default: 2, label: '代数簇维数 n' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.max(1, Math.round(num(params, 'dim', 2)));

    // 上同调维数阶梯：H^i 与 H^{n−i} 对偶配对
    const levelY = (i: number): number => 140 + (n - i) * 62;
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i <= Math.floor(n / 2); i++) pairs.push([i, n - i]);

    for (let i = 0; i <= n; i++) {
      const y = levelY(i);
      poly(f, [[90, y], [90 + 200, y], [90 + 200, y + 44], [90, y + 44]], {
        fill: i === 0 || i === n ? 'rgba(102,126,234,0.55)' : 'rgba(56,178,172,0.45)',
        stroke: C.accent, lw: 1.4, close: true,
      });
      text(f, `H^${i}(X, F)`, 100, y + 28, { color: C.fg, font: 'bold 13px Consolas, monospace' });

      const x2 = w - 290;
      poly(f, [[x2, y], [x2 + 200, y], [x2 + 200, y + 44], [x2, y + 44]], {
        fill: i === 0 || i === n ? 'rgba(102,126,234,0.55)' : 'rgba(56,178,172,0.45)',
        stroke: C.accent, lw: 1.4, close: true,
      });
      text(f, `H^${n - i}(X, F)`, x2 + 10, y + 28, { color: C.fg, font: 'bold 13px Consolas, monospace' });
    }

    // 配对连线
    pairs.forEach(([i, j]) => {
      seg(f, 290, levelY(i) + 22, w - 290, levelY(j) + 22, {
        color: 'rgba(237,137,54,0.6)', lw: 1.6, dash: [5, 4],
      } as never);
    });

    text(f, 'H^i(X, F) × H^{n−i}(X, ω) → k', w / 2, 52, {
      align: 'center', font: 'bold 17px "Times New Roman", serif', color: C.warm,
    });
    text(f, '塞尔对偶：上同调与其对偶层之间存在非退化配对', w / 2, 80, {
      align: 'center', color: C.fg, font: '14px system-ui',
    });
    text(f, `当前 n = ${n}：H^i 与 H^${n}−i 配对（橙色虚线）`, w / 2, 104, {
      align: 'center', color: C.dim, font: '13px system-ui',
    });

    heading(f, '塞尔对偶定理：高维上同调的「镜像」');
    footnotes(f, [
      '塞尔把微分几何中的庞加莱对偶推广到代数几何：用对偶层把高维上同调换成低维',
      '它使许多原本困难的高维计算得以降低维数完成，是层论方法的核心工具',
      '后来的格罗滕迪克对偶把它推广到任意态射，成为现代代数几何的标准语言',
    ]);
  },
});

// ---------------------------------------------------------------- T98
/** T98 惠特尼嵌入定理。 */
const whitneyEmbeddingViz = defineViz({
  slug: 'whitney-embedding',
  title: '惠特尼嵌入定理',
  params: {
    n: { type: 'range', min: 1, max: 3, default: 2, label: '流形维数 n' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.max(1, Math.round(num(params, 'n', 2)));

    const v = equalView(f, 0, 0, 1.7, 54);
    grid(f, v, { divisions: 4, ticks: false });

    if (n === 1) {
      curve(f, v, (x) => 0.5 * Math.sin(2.2 * x), { color: C.accent, lw: 3 } as never);
      text(f, '1 维曲线（8 字形）', w / 2, h - 104, { align: 'center', color: C.accent, font: '13px system-ui' });
    } else if (n === 2) {
      // 克莱因瓶/环面示意：无法嵌入 ℝ³（不自交）
      const cx = v.sx(0);
      const cy = v.sy(0);
      const rx = 84;
      const ry = 52;
      const tube = 26;
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 180; i++) {
        const a = (i * 2 * Math.PI) / 180;
        pts.push([cx + (rx + tube * Math.cos(6 * a)) * Math.cos(a), cy + (ry + tube * Math.cos(6 * a) * 0.68) * Math.sin(a)]);
      }
      poly(f, pts, { stroke: C.accent, lw: 1.8, fill: 'rgba(102,126,234,0.2)', close: true });
      dot(f, cx, cy, 5, C.hot);
      text(f, '自交点（在 ℝ³ 中不可避免）', cx + 12, cy - 10, { color: C.hot, font: '12px system-ui' });
      text(f, '2 维曲面（如克莱因瓶需 ℝ⁴ 才能嵌入）', w / 2, h - 104, {
        align: 'center', color: C.accent, font: '13px system-ui',
      });
    } else {
      // 3 维流形示意（多层曲面）
      for (let k = 0; k < 3; k++) {
        const y0 = k * 0.42 - 0.42;
        curve(f, v, (x) => 0.3 * Math.sin(2.0 * x) + y0, {
          color: [C.accent, C.cyan, C.green][k], lw: 2,
        } as never);
      }
      text(f, '3 维流形（层状示意）', w / 2, h - 104, { align: 'center', color: C.accent, font: '13px system-ui' });
    }

    text(f, '惠特尼嵌入定理', w / 2, 52, {
      align: 'center', font: 'bold 18px "Times New Roman", serif', color: C.warm,
    });
    text(f, `任意 ${n} 维光滑流形都可浸入 ℝ^${2 * n}、嵌入 ℝ^${2 * n + 1}`, w / 2, 80, {
      align: 'center', color: C.fg, font: '14px system-ui',
    });
    text(f, '即：再抽象的流形，也总能放进足够高维的欧氏空间被「看见」', w / 2, 104, {
      align: 'center', color: C.green, font: '13px system-ui',
    });

    heading(f, '惠特尼嵌入定理：抽象流形可以被嵌入');
    footnotes(f, [
      '惠特尼（1936 浸入 / 1944 嵌入）：n 维光滑流形必能浸入 ℝ²ⁿ、嵌入 ℝ²ⁿ⁺¹',
      '这解决了「抽象定义的流形是否真存在于某个空间中」的根本疑问',
      '可数多条线（1 维流形）可在平面里画开，但克莱因瓶在 ℝ³ 中必然自交——需 ℝ⁴',
    ]);
  },
});

// ---------------------------------------------------------------- T99
/** T99 洛伦兹发现混沌吸引子。 */
const lorenzAttractorViz = defineViz({
  slug: 'lorenz-attractor-discovery',
  title: '洛伦兹发现混沌吸引子',
  params: {
    rho: { type: 'range', min: 10, max: 40, step: 1, default: 28, label: '瑞利数 ρ' },
    steps: { type: 'range', min: 300, max: 3000, default: 1800, label: '迭代步数' },
    spread: { type: 'range', min: 0, max: 0.02, step: 0.001, default: 0.005, label: '初值扰动' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const rho = num(params, 'rho', 28);
    const steps = Math.round(num(params, 'steps', 1800));
    const delta = num(params, 'spread', 0.005);

    const sigma = 10;
    const beta = 8 / 3;
    const dt = 0.006;

    const simulate = (x0: number, y0: number, z0: number): Array<[number, number]> => {
      let x = x0;
      let y = y0;
      let z = z0;
      const out: Array<[number, number]> = [];
      for (let i = 0; i < steps; i++) {
        const dx = sigma * (y - x);
        const dy = x * (rho - z) - y;
        const dz = x * y - beta * z;
        x += dx * dt;
        y += dy * dt;
        z += dz * dt;
        if (i % 3 === 0) out.push([x, z]);
      }
      return out;
    };

    const trajA = simulate(1, 1, 1);
    const trajB = simulate(1 + delta, 1, 1);
    const all: Array<[number, number]> = [...trajA, ...trajB];
    const xs = all.map((p) => p[0]);
    const zs = all.map((p) => p[1]);
    const pad = 0.06;
    const xMin = Math.min(...xs) - (Math.max(...xs) - Math.min(...xs)) * pad;
    const xMax = Math.max(...xs) + (Math.max(...xs) - Math.min(...xs)) * pad;
    const zMin = Math.min(...zs) - (Math.max(...zs) - Math.min(...zs)) * pad;
    const zMax = Math.max(...zs) + (Math.max(...zs) - Math.min(...zs)) * pad;

    const v = view(f, { xMin, xMax, yMin: zMin, yMax: zMax, inset: 54 });
    grid(f, v, { divisions: 4, ticks: false });
    for (let i = 1; i < trajA.length; i++) {
      seg(f, v.sx(trajA[i - 1][0]), v.sy(trajA[i - 1][1]), v.sx(trajA[i][0]), v.sy(trajA[i][1]), {
        color: 'rgba(102,126,234,0.75)', lw: 1,
      } as never);
    }
    for (let i = 1; i < trajB.length; i++) {
      seg(f, v.sx(trajB[i - 1][0]), v.sy(trajB[i - 1][1]), v.sx(trajB[i][0]), v.sy(trajB[i][1]), {
        color: 'rgba(237,137,54,0.7)', lw: 1,
      } as never);
    }

    const dist = Math.hypot(trajA[trajA.length - 1][0] - trajB[trajB.length - 1][0], trajA[trajA.length - 1][1] - trajB[trajB.length - 1][1]);
    text(f, 'ẋ = σ(y−x), ẏ = x(ρ−z)−y, ż = xy−βz', 50, 48, {
      font: 'bold 14px "Times New Roman", serif', color: C.warm,
    });
    text(f, `ρ = ${rho}，迭代 ${steps} 步`, 50, 74, { color: C.fg, font: '13px Consolas, monospace' });
    text(f, `两条轨迹初值相差 ${delta.toFixed(3)}，末态距离 = ${dist.toFixed(3)}`, 50, 98, {
      color: C.hot, font: '13px Consolas, monospace',
    });
    text(f, '起点几乎相同，终点却相差甚远 —— 初值敏感依赖', 50, 122, {
      color: C.warm, font: 'bold 12px system-ui',
    });

    heading(f, '洛伦兹吸引子：确定性系统的不可预测性');
    footnotes(f, [
      '洛伦兹 1963 年用三个方程模拟大气对流，发现轨道被吸引到一个分形集合（蝴蝶形）上',
      '蓝橙两条曲线的初值只差千分之五，却很快分道扬镳 —— 这就是「蝴蝶效应」',
      '轨迹永不重复、永不离开有界区域：确定性方程也能产生不可长期预测的行为',
    ]);
  },
});

// ---------------------------------------------------------------- T100
/** T100 瑟斯顿几何化纲领。 */
const thurstonGeometrizationViz = defineViz({
  slug: 'thurston-geometrization',
  title: '瑟斯顿几何化纲领',
  params: {
    pick: { type: 'range', min: 0, max: 7, default: 0, label: '第几种几何' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const geoms = [
      { name: '球面几何 S³', curv: '+', desc: '正曲率，三角形内角和 > 180°' },
      { name: '欧氏几何 E³', curv: '0', desc: '零曲率，平行公设成立' },
      { name: '双曲几何 H³', curv: '−', desc: '负曲率，内角和 < 180°' },
      { name: 'S² × ℝ', curv: '混合', desc: '球面与直线的乘积' },
      { name: 'H² × ℝ', curv: '混合', desc: '双曲面与直线的乘积' },
      { name: 'SL̃(2,ℝ)', curv: '混合', desc: '万有覆叠，幂零几何' },
      { name: 'Nil（幂零）', curv: '混合', desc: '海森堡群的几何' },
      { name: 'Sol（可解）', curv: '混合', desc: '可解李群的几何' },
    ];
    const idx = Math.max(0, Math.min(7, Math.round(num(params, 'pick', 0))));

    // 曲面示意
    const cx = w * 0.3;
    const cy = h / 2 + 6;
    const R = 88;
    const curvature = idx === 0 ? 1 : idx === 1 ? 0 : idx === 2 ? -1 : 0;
    if (curvature > 0) {
      const c: Array<[number, number]> = [];
      for (let i = 0; i <= 120; i++) {
        const a = (i * 2 * Math.PI) / 120;
        c.push([cx + R * Math.cos(a), cy + R * Math.sin(a) * 0.92]);
      }
      poly(f, c, { fill: 'rgba(102,126,234,0.25)', stroke: C.accent, lw: 2.2 });
      text(f, '（正曲率：封闭）', cx, cy + R + 32, { align: 'center', color: C.dim, font: '12px system-ui' });
    } else if (curvature === 0) {
      for (let i = -2; i <= 2; i++) {
        seg(f, cx - R, cy + i * 32, cx + R, cy + i * 32, { color: 'rgba(102,126,234,0.5)', lw: 1.6 } as never);
      }
      for (let i = -2; i <= 2; i++) {
        seg(f, cx + i * 32, cy - R * 0.8, cx + i * 32, cy + R * 0.8, { color: 'rgba(102,126,234,0.5)', lw: 1.6 } as never);
      }
      text(f, '（零曲率：平坦）', cx, cy + R + 32, { align: 'center', color: C.dim, font: '12px system-ui' });
    } else {
      // 双曲：发散射线
      for (let k = -3; k <= 3; k++) {
        const pts: Array<[number, number]> = [];
        for (let t = 0; t <= 1; t += 0.05) {
          pts.push([cx - R + 2 * R * t, cy + k * (10 + 18 * (1 - t) * (1 - t)) * 1.4]);
        }
        poly(f, pts, { stroke: k === 0 ? C.hot : 'rgba(102,126,234,0.5)', lw: k === 0 ? 2.4 : 1.4 });
      }
      text(f, '（负曲率：发散）', cx, cy + R + 32, { align: 'center', color: C.dim, font: '12px system-ui' });
    }

    // 右侧列表
    const g = geoms[idx];
    geoms.forEach((it, i) => {
      const y = 120 + i * 34;
      const on = i === idx;
      poly(f, [[w * 0.56, y], [w - 50, y], [w - 50, y + 27], [w * 0.56, y]], {
        fill: on ? 'rgba(102,126,234,0.35)' : 'transparent',
        stroke: on ? C.accent : 'transparent', lw: 1.2, close: true,
      } as never);
      text(f, `${it.name}`, w * 0.56 + 8, y + 19, { color: on ? C.fg : C.dim, font: (on ? 'bold ' : '') + '12px system-ui' });
    });

    text(f, '瑟斯顿几何化纲领', w / 2, 52, {
      align: 'center', font: 'bold 18px "Times New Roman", serif', color: C.warm,
    });
    text(f, `当前：${g.name}（曲率 ${g.curv}）—— ${g.desc}`, w / 2, 80, {
      align: 'center', color: C.fg, font: '14px system-ui',
    });
    text(f, '闭三维流形可沿本质球面切开，每块拥有 8 种几何结构之一', w / 2, 104, {
      align: 'center', color: C.cyan, font: '13px system-ui',
    });

    heading(f, '瑟斯顿几何化纲领：三维流形的统一图景');
    footnotes(f, [
      '瑟斯顿提出：三维流形可分解为若干块，每块由八种标准几何结构之一控制',
      '佩雷尔曼用里奇流证明该纲领，庞加莱猜想则是它的一个特例（单连通 ⇒ 球面几何）',
      '这是 20 世纪末拓扑学最宏大的成果，也把几何分析带入拓扑研究的核心',
    ]);
  },
});

// ---------------------------------------------------------------- T101
/** T101 四色定理。 */
const fourColorTheoremViz = defineViz({
  slug: 'four-color-theorem',
  title: '四色定理',
  params: {
    cells: { type: 'range', min: 6, max: 20, default: 12, label: '区域数' },
    seed: { type: 'range', min: 1, max: 20, default: 7, label: '地图样式' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const count = Math.max(3, Math.round(num(params, 'cells', 12)));
    const seed = Math.round(num(params, 'seed', 7));

    const rand = rng(seed * 977);
    // 用随机点做「半平面划分」生成地图
    const sites: Array<[number, number]> = [];
    for (let i = 0; i < count; i++) sites.push([0.1 + rand() * 0.8, 0.12 + rand() * 0.76]);

    const colors = ['rgba(102,126,234,0.75)', 'rgba(72,187,120,0.75)', 'rgba(237,137,54,0.75)', 'rgba(237,100,166,0.72)'];
    const px = (u: number) => 70 + u * (w - 140);
    const py = (v: number) => 110 + v * (h - 250);

    // 按最近站点着色（Voronoi 近似）+ 贪心调整为 4 色
    const step = 9;
    const colorIdx: number[][] = [];
    for (let gx = 0; gx < Math.ceil((w - 140) / step); gx++) {
      colorIdx.push([]);
      for (let gy = 0; gy < Math.ceil((h - 250) / step); gy++) {
        const u = (gx * step + step / 2) / (w - 140);
        const v = (gy * step + step / 2) / (h - 250);
        let best = 0;
        let bestD = Infinity;
        sites.forEach((s, i) => {
          const d = (s[0] - u) ** 2 + (s[1] - v) ** 2;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        // 用 index 的某种「图着色」近似：按邻接贪心
        colorIdx[gx].push(best);
      }
    }
    // 站点相邻关系（近似：距离较近视为相邻），贪心着色
    const adj: Set<number>[] = sites.map(() => new Set<number>());
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const d = Math.hypot(sites[i][0] - sites[j][0], sites[i][1] - sites[j][1]);
        if (d < 0.32) {
          adj[i].add(j);
          adj[j].add(i);
        }
      }
    }
    const assign = new Array(count).fill(-1);
    for (let i = 0; i < count; i++) {
      const used = new Set<number>();
      adj[i].forEach((j) => {
        if (assign[j] >= 0) used.add(assign[j]);
      });
      let c = 0;
      while (used.has(c)) c++;
      assign[i] = c % 4;
    }

    for (let gx = 0; gx < colorIdx.length; gx++) {
      for (let gy = 0; gy < colorIdx[gx].length; gy++) {
        const region = colorIdx[gx][gy];
        const x = 70 + gx * step;
        const y = 110 + gy * step;
        poly(f, [[x, y], [x + step, y], [x + step, y + step], [x, y + step]], {
          fill: colors[assign[region] % 4], close: true,
        });
      }
    }
    sites.forEach((s, i) => {
      dot(f, px(s[0]), py(s[1]), 3.5, C.fg);
    });
    void colorIdx;

    heading(f, '四色定理：任何平面地图只需四色');
    footnotes(f, [
      '阿佩尔与哈肯 1976 年证明该定理，过程中验证了 1936 种「不可避免构形」',
      '这是首个依赖大规模计算机运算的著名定理，当时引发了「什么算证明」的争论',
      '注意：三维空间中的地图需要任意多色，四色定理本质上是「平面」的性质',
    ]);
  },
});

// ---------------------------------------------------------------- T102
/** T102 格林-陶定理。 */
const greenTaoViz = defineViz({
  slug: 'green-tao-theorem',
  title: '格林-陶定理',
  params: {
    len: { type: 'range', min: 3, max: 8, default: 5, label: '等差数列长度 k' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const len = Math.max(3, Math.round(num(params, 'len', 5)));

    // 寻找长度为 len 的素数等差数列（小范围演示）
    let found: number[] = [];
    const limit = 4000;
    const primes: number[] = [];
    for (let i = 2; i <= limit; i++) if (isPrime(i)) primes.push(i);
    const pset = new Set(primes);

    outer: for (const p of primes) {
      for (let d = 2; d < 600; d += 2) {
        let ok = true;
        const seq: number[] = [];
        for (let i = 0; i < len; i++) {
          const v = p + i * d;
          if (!pset.has(v)) {
            ok = false;
            break;
          }
          seq.push(v);
        }
        if (ok) {
          found = seq;
          break outer;
        }
      }
    }

    // 数轴展示
    const axisY = h * 0.42;
    const maxV = found.length ? found[found.length - 1] : 100;
    seg(f, 60, axisY, w - 60, axisY, { color: C.dim, lw: 1.4 } as never);
    // 素数刻度
    primes.filter((p) => p <= maxV).forEach((p) => {
      const x = 60 + (p / maxV) * (w - 120);
      dot(f, x, axisY, 1.6, 'rgba(160,174,192,0.4)');
    });
    // 等差数列
    found.forEach((v) => {
      const x = 60 + (v / maxV) * (w - 120);
      dot(f, x, axisY, 6, C.warm);
      text(f, String(v), x, axisY - 16, { align: 'center', color: C.warm, font: 'bold 12px system-ui' });
    });
    if (found.length > 1) {
      const d = found[1] - found[0];
      seg(f, 60 + (found[0] / maxV) * (w - 120), axisY + 26, 60 + (found[found.length - 1] / maxV) * (w - 120), axisY + 26, {
        color: C.cyan, lw: 1.8,
      } as never);
      text(f, `公差 d = ${d}`, w / 2, axisY + 48, { align: 'center', color: C.cyan, font: '13px system-ui' });
    }

    text(f, '素数中存在任意长的等差数列', w / 2, 52, {
      align: 'center', font: 'bold 17px "Times New Roman", serif', color: C.warm,
    });
    text(f, found.length ? `当前 k = ${len}：${found.join(', ')}` : `k = ${len}：小范围内未找到（定理保证无穷大范围存在）`, w / 2, 78, {
      align: 'center', color: found.length ? C.green : C.dim, font: '14px Consolas, monospace',
    });
    text(f, '灰色细点为素数，橙色为找到的等差数列', w / 2, 102, {
      align: 'center', color: C.dim, font: '13px system-ui',
    });

    heading(f, '格林-陶定理：素数中藏着任意长的等差数列');
    footnotes(f, [
      '2004 年格林与陶哲轩证明：对任意长度 k，都存在 k 个素数构成等差数列',
      '素数看似随机稀疏，却蕴含无限的规律结构——这是「随机性中的必然秩序」',
      '证明依赖「转移原理」：把稠密集合的组合结论搬到稀疏的素数集合上',
    ]);
  },
});

registerViz(
  turingHaltingViz,
  whiteheadTheoremViz,
  eilenbergSteenrodViz,
  shannonEntropyViz,
  atiyahSingerViz,
  serreDualityViz,
  whitneyEmbeddingViz,
  lorenzAttractorViz,
  thurstonGeometrizationViz,
  fourColorTheoremViz,
  greenTaoViz,
);
