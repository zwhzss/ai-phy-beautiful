/**
 * 数学史里程碑 · doubao 补充批次五（T103–T114：泛函分析、交换代数、同调代数、微分几何）。
 */
import { defineViz, num, str, VizFrame } from '../types';
import { registerViz } from '../registry';
import { C, curve, dot, equalView, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

// ---------------------------------------------------------------- T103
/** T103 哈恩-巴拿赫延拓定理。 */
const hahnBanachViz = defineViz({
  slug: 'hahn-banach',
  title: '哈恩-巴拿赫延拓定理',
  params: {
    dir: { type: 'range', min: 0, max: 6.28, step: 0.05, default: 0.9, label: '泛函方向' },
    scale: { type: 'range', min: 0.2, max: 1.6, step: 0.05, default: 1, label: '延拓倍数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const th = num(params, 'dir', 0.9);
    const k = num(params, 'scale', 1);

    const v = equalView(f, 0, 0, 3.4, 54);
    grid(f, v, { divisions: 6, ticks: true });
    seg(f, v.sx(-3.4), v.sy(0), v.sx(3.4), v.sy(0), { color: C.dim, lw: 1.1 } as never);
    seg(f, v.sx(0), v.sy(-3.4), v.sx(0), v.sy(3.4), { color: C.dim, lw: 1.1 } as never);

    // 子空间 Y（一条直线）
    const ux = Math.cos(0.35);
    const uy = Math.sin(0.35);
    seg(f, v.sx(-3.2 * ux), v.sy(-3.2 * uy), v.sx(3.2 * ux), v.sy(3.2 * uy), { color: C.accent, lw: 2.6 } as never);
    text(f, '子空间 Y', v.sx(2.6 * ux) + 8, v.sy(2.6 * uy) - 8, { color: C.accent, font: 'bold 13px system-ui' });

    // Y 上的泛函 f（等值线垂直于 Y 上的方向向量 g）
    const gx = Math.cos(th);
    const gy = Math.sin(th);
    for (let t = -3; t <= 3; t++) {
      const off = t * k * 0.55;
      seg(f, v.sx(-3.4 * gx + off * -gy), v.sy(-3.4 * gy + off * gx),
        v.sx(3.4 * gx + off * -gy), v.sy(3.4 * gy + off * gx),
        { color: t === 0 ? C.warm : 'rgba(237,137,54,0.25)', lw: t === 0 ? 2.2 : 1.1 } as never);
    }
    seg(f, v.sx(0), v.sy(0), v.sx(2.6 * gx), v.sy(2.6 * gy), { color: C.warm, lw: 2.4 } as never);

    // 范数控制：泛函的界
    const ratio = Math.abs(k);
    text(f, '哈恩-巴拿赫延拓定理', w / 2, 48, {
      align: 'center', font: 'bold 17px "Times New Roman", serif', color: C.warm,
    });
    text(f, '子空间 Y 上的有界线性泛函 f₀，可保范延拓到整个空间 X', w / 2, 76, {
      align: 'center', color: C.fg, font: '14px system-ui',
    });
    text(f, '橙色为延拓后的泛函等值线（垂直方向向量 g），蓝色为子空间 Y', w / 2, 100, {
      align: 'center', color: C.dim, font: '13px system-ui',
    });
    text(f, `当前 |f| / |f₀| = ${ratio.toFixed(2)}（保范延拓要求 ≤ 1）`, w / 2, h - 96, {
      align: 'center', color: ratio <= 1.001 ? C.green : C.hot, font: 'bold 14px Consolas, monospace',
    });

    heading(f, '哈恩-巴拿赫延拓定理：泛函可以「长大」而不变强');
    footnotes(f, [
      '子空间上的有界线性泛函，总能延拓到整个空间，并且保持范数不变',
      '它保证对偶空间「足够丰富」——总能构造出分离两个点的泛函',
      '这是泛函分析三大基本定理之一，也是凸集分离定理与最优性条件的理论基础',
    ]);
  },
});

// ---------------------------------------------------------------- T104
/** T104 开映射定理。 */
const openMappingTheoremViz = defineViz({
  slug: 'open-mapping-theorem',
  title: '开映射定理',
  params: {
    r: { type: 'range', min: 0.15, max: 0.85, step: 0.05, default: 0.45, label: '定义域球半径' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const r = num(params, 'r', 0.45);

    const v = equalView(f, 0, 0, 1.7, 54);
    grid(f, v, { divisions: 4, ticks: false });

    // 定义域球 U
    const cx = v.sx(-0.85);
    const cy = v.sy(0);
    const R = r * 150;
    const drawBall = (x: number, y: number, rad: number, color: string, label: string, lx: number) => {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 120; i++) {
        const a = (i * 2 * Math.PI) / 120;
        pts.push([x + rad * Math.cos(a), y + rad * Math.sin(a) * 0.92]);
      }
      poly(f, pts, { fill: color + '33', stroke: color, lw: 2.2 });
      text(f, label, x, y + rad + 26, { align: 'center', color, font: 'bold 13px system-ui' });
      void lx;
    };
    drawBall(cx, cy, R, C.accent, '开球 U（定义域）', 0);
    drawBall(v.sx(0.85), cy, R * 1.6, C.warm, '像 T(U) 仍是开集', 0);

    // 箭头
    seg(f, cx + R + 8, cy, v.sx(0.85) - R * 1.6 - 8, cy, { color: C.cyan, lw: 2 } as never);
    text(f, 'T（满射有界线性算子）', w / 2, cy - 12, { align: 'center', color: C.cyan, font: 'bold 12px system-ui' });

    text(f, '开映射定理', w / 2, 48, {
      align: 'center', font: 'bold 18px "Times New Roman", serif', color: C.warm,
    });
    text(f, '巴拿赫空间之间的满射有界线性算子，必把开集映成开集', w / 2, 76, {
      align: 'center', color: C.fg, font: '14px system-ui',
    });
    text(f, '推论：若 T 可逆，则 T⁻¹ 自动连续（「可逆」⇒「有界可逆」）', w / 2, 100, {
      align: 'center', color: C.green, font: '13px system-ui',
    });

    heading(f, '开映射定理：满射算子保持「开性」');
    footnotes(f, [
      '开映射 = 把开集映成开集的映射；这里的关键前提是「完备」（巴拿赫空间）与「满射」',
      '直接推论是逆算子定理：连续双射的逆自动连续，无需额外验证',
      '三者（哈恩-巴拿赫、开映射、一致有界）共同构成泛函分析的三大基本定理',
    ]);
  },
});

// ---------------------------------------------------------------- T105
/** T105 闭图像定理。 */
const closedGraphTheoremViz = defineViz({
  slug: 'closed-graph-theorem',
  title: '闭图像定理',
  params: {
    slope: { type: 'range', min: 0.2, max: 2, step: 0.1, default: 1, label: '算子斜率' },
    gap: { type: 'range', min: 0, max: 0.6, step: 0.05, default: 0, label: '图像断裂量' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const slope = num(params, 'slope', 1);
    const gap = num(params, 'gap', 0);

    const v = view(f, { xMin: -3, xMax: 3, yMin: -3, yMax: 3, inset: 52 });
    grid(f, v, { divisions: 6, ticks: true });
    seg(f, v.sx(-3), v.sy(0), v.sx(3), v.sy(0), { color: C.dim, lw: 1.1 } as never);
    seg(f, v.sx(0), v.sy(-3), v.sx(0), v.sy(3), { color: C.dim, lw: 1.1 } as never);

    // 图像 G(T) = {(x, Tx)}
    if (gap < 0.02) {
      seg(f, v.sx(-3), v.sy(-3 * slope), v.sx(3), v.sy(3 * slope), { color: C.accent, lw: 2.6 } as never);
      text(f, '图像 G(T) 是闭集 ⇒ T 有界', w / 2, 48, {
        align: 'center', font: 'bold 16px system-ui', color: C.green,
      });
    } else {
      seg(f, v.sx(-3), v.sy(-3 * slope), v.sx(0), v.sy(0), { color: C.accent, lw: 2.6 } as never);
      seg(f, v.sx(0), v.sy(gap), v.sx(3), v.sy(3 * slope + gap), { color: C.accent, lw: 2.6 } as never);
      dot(f, v.sx(0), v.sy(0), 5, C.hot);
      dot(f, v.sx(0), v.sy(gap), 5, C.hot);
      text(f, `图像出现 ${gap.toFixed(2)} 的断裂 ⇒ 不是闭集`, w / 2, 48, {
        align: 'center', font: 'bold 16px system-ui', color: C.hot,
      });
    }

    text(f, '闭图像定理', w / 2, 76, {
      align: 'center', font: 'bold 17px "Times New Roman", serif', color: C.warm,
    });
    text(f, '线性算子的图像若为闭集，则算子有界（连续）', w / 2, 102, {
      align: 'center', color: C.fg, font: '14px system-ui',
    });
    text(f, '拖大「图像断裂量」可看到图像不再闭合，定理前提被破坏', w / 2, 126, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });

    heading(f, '闭图像定理：把连续性问题变成几何问题');
    footnotes(f, [
      '算子 T 的图像是 {(x, Tx)}；「图像闭」比「算子连续」容易验证得多',
      '定理说明：在巴拿赫空间之间，闭图像与有界（连续）是等价的',
      '实用价值：验证算子有界时，只需检查图像闭合——这是分析中常用的捷径',
    ]);
  },
});

// ---------------------------------------------------------------- T106
/** T106 谱定理（自伴算子）。 */
const spectralTheoremOperatorsViz = defineViz({
  slug: 'spectral-theorem-operators',
  title: '谱定理（自伴算子）',
  params: {
    a: { type: 'range', min: 0.5, max: 3, step: 0.1, default: 2, label: '特征值 λ₁' },
    b: { type: 'range', min: 0.3, max: 2, step: 0.1, default: 0.8, label: '特征值 λ₂' },
    angle: { type: 'range', min: 0, max: 180, step: 5, default: 30, label: '特征方向旋转角' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const l1 = num(params, 'a', 2);
    const l2 = num(params, 'b', 0.8);
    const deg = num(params, 'angle', 30);
    const th = (deg * Math.PI) / 180;

    const v = equalView(f, 0, 0, 3.2, 54);
    grid(f, v, { divisions: 6, ticks: true });
    seg(f, v.sx(-3.2), v.sy(0), v.sx(3.2), v.sy(0), { color: C.dim, lw: 1.1 } as never);
    seg(f, v.sx(0), v.sy(-3.2), v.sx(0), v.sy(3.2), { color: C.dim, lw: 1.1 } as never);

    // 变换后的单位圆（椭圆），半轴 = 特征值
    const c = Math.cos(th);
    const s = Math.sin(th);
    const ell: Array<[number, number]> = [];
    for (let i = 0; i <= 140; i++) {
      const a = (i * 2 * Math.PI) / 140;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      // 先旋转到特征基，再按 λ 缩放，再转回
      const e1 = ux * c + uy * s;
      const e2 = -ux * s + uy * c;
      const rx = e1 * l1;
      const ry = e2 * l2;
      ell.push([v.sx(rx * c - ry * s), v.sy(rx * s + ry * c)]);
    }
    poly(f, ell, { fill: 'rgba(102,126,234,0.16)', stroke: C.accent, lw: 2.2 });

    // 特征方向（主轴）
    for (const sign of [1, -1]) {
      seg(f, v.sx(0), v.sy(0), v.sx(sign * l1 * c), v.sy(sign * l1 * s), { color: C.warm, lw: 2.2 } as never);
      seg(f, v.sx(0), v.sy(0), v.sx(sign * l2 * -s), v.sy(sign * l2 * c), { color: C.cyan, lw: 2.2 } as never);
    }
    dot(f, v.sx(l1 * c), v.sy(l1 * s), 5, C.warm);
    dot(f, v.sx(-l2 * s), v.sy(l2 * c), 5, C.cyan);

    text(f, 'A = Σ λᵢ Pᵢ（投影分解）', w / 2, 48, {
      align: 'center', font: 'bold 17px "Times New Roman", serif', color: C.warm,
    });
    text(f, `λ₁ = ${l1.toFixed(1)}（橙色主轴）　λ₂ = ${l2.toFixed(1)}（青色主轴）`, w / 2, 76, {
      align: 'center', color: C.fg, font: '14px Consolas, monospace',
    });
    text(f, '自伴算子把单位圆拉成椭圆：半轴即为特征值，主轴方向为特征方向', w / 2, 100, {
      align: 'center', color: C.dim, font: '13px system-ui',
    });

    heading(f, '谱定理：自伴算子的对角化');
    footnotes(f, [
      '自伴（Hermite）算子可以按正交投影做谱分解，相当于无穷维版本的「对称矩阵可对角化」',
      '单位圆被映成椭圆，半轴长度就是特征值——这直观展示了「谱」的几何含义',
      '量子力学中「可观测量」正是自伴算子，其特征值对应可测量的物理量（如能级）',
    ]);
  },
});

// ---------------------------------------------------------------- T107
/** T107 克鲁尔主理想定理。 */
const krullPrincipalIdealViz = defineViz({
  slug: 'krull-principal-ideal',
  title: '克鲁尔主理想定理',
  params: {
    chain: { type: 'range', min: 2, max: 6, default: 4, label: '素理想链长度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const len = Math.max(2, Math.round(num(params, 'chain', 4)));

    // 素理想链 p₀ ⊊ p₁ ⊊ … ⊊ pₙ，高度 = 链长度
    const topY = 118;
    const gap = Math.min(58, (h - 280) / Math.max(1, len - 1));
    for (let i = 0; i < len; i++) {
      const y = topY + i * gap;
      const bw = 120 + i * 46;
      const x = w / 2 - bw / 2;
      poly(f, [[x, y], [x + bw, y], [x + bw, y + 42], [x, y + 42]], {
        fill: `rgba(102,126,234,${0.28 + i * 0.14})`,
        stroke: C.accent, lw: 1.4, close: true,
      });
      text(f, `p${i}`, x + bw / 2, y + 27, { align: 'center', color: C.fg, font: 'bold 13px system-ui' });
      if (i > 0) text(f, '⊊', x - 20, y + 27, { align: 'center', color: C.hot, font: '16px system-ui' });
    }
    const lastY = topY + (len - 1) * gap;
    text(f, `高度 ht(p${len - 1}) = ${len - 1}`, w / 2, lastY + 70, {
      align: 'center', color: C.green, font: 'bold 14px system-ui',
    });

    text(f, '克鲁尔主理想定理', w / 2, 50, {
      align: 'center', font: 'bold 18px "Times New Roman", serif', color: C.warm,
    });
    text(f, '诺特环中，由非零因子生成的主理想，其极小素理想高度为 1', w / 2, 78, {
      align: 'center', color: C.fg, font: '13px system-ui',
    });
    text(f, '即：不存在形如 p₀ ⊊ p₁ ⊊ p₂ 的更长素理想链', w / 2, 102, {
      align: 'center', color: C.dim, font: '13px system-ui',
    });

    heading(f, '克鲁尔主理想定理：用「高度」约束理想链');
    footnotes(f, [
      '素理想的高度 = 它下面最长的素理想链长度，是交换代数中的「维数」概念',
      '定理断言：单个非零因子「贡献」的维数恰好是 1，不能更多',
      '它是交换代数维数理论的基本结果，也是几何上「超曲面余维数为 1」的代数表述',
    ]);
  },
});

// ---------------------------------------------------------------- T108
/** T108 诺特标准化引理。 */
const noetherNormalizationViz = defineViz({
  slug: 'noether-normalization',
  title: '诺特标准化引理',
  params: {
    dim: { type: 'range', min: 1, max: 3, default: 2, label: '代数簇维数 d' },
    degree: { type: 'range', min: 2, max: 4, default: 3, label: '曲线次数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const d = Math.max(1, Math.round(num(params, 'dim', 2)));
    const dg = Math.max(2, Math.round(num(params, 'degree', 3)));

    const v = equalView(f, 0, 0, 1.7, 54);
    grid(f, v, { divisions: 4, ticks: false });

    // 代数簇（曲线）+ 投影到线性子空间
    curve(f, v, (x) => Math.pow(x, dg) * 0.55 - 0.2, { color: C.accent, lw: 2.6 } as never);
    // 投影线
    for (let k = -3; k <= 3; k++) {
      const x = k * 0.42;
      seg(f, v.sx(x), v.sy(-0.9), v.sx(x), v.sy(0.9), { color: 'rgba(160,174,192,0.22)', lw: 1 } as never);
      dot(f, v.sx(x), v.sy(Math.pow(x, dg) * 0.55 - 0.2), 3.5, C.warm);
    }
    // 像空间（底部直线）
    seg(f, v.sx(-1.5), v.sy(-0.95), v.sx(1.5), v.sy(-0.95), { color: C.cyan, lw: 2.6 } as never);
    for (let k = -3; k <= 3; k++) {
      dot(f, v.sx(k * 0.42), v.sy(-0.95), 4, C.cyan);
    }

    text(f, '诺特标准化引理', w / 2, 48, {
      align: 'center', font: 'bold 18px "Times New Roman", serif', color: C.warm,
    });
    text(f, `有限生成 k-代数 A 可表示为多项式环 k[x₁…x_${d}] 的整扩张`, w / 2, 76, {
      align: 'center', color: C.fg, font: '14px system-ui',
    });
    text(f, '几何含义：任意 d 维代数簇都能有限地映到 d 维仿射空间上', w / 2, 100, {
      align: 'center', color: C.green, font: '13px system-ui',
    });
    text(f, '蓝线为代数簇，青线为其在低维子空间上的「投影像」', w / 2, 124, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });

    heading(f, '诺特标准化引理：代数簇可以投影到仿射空间');
    footnotes(f, [
      '诺特 1926 年证明：任何有限生成代数都是多项式环的整扩张',
      '它使「维数」有了严格定义（标准化子环的变量个数），也让不同簇之间可以比较维数',
      '这是交换代数与代数几何的基本工具，用于证明维数定理与诺特环的各种性质',
    ]);
  },
});

// ---------------------------------------------------------------- T109
/** T109 戴德金环判别。 */
const dedekindDomainViz = defineViz({
  slug: 'dedekind-domain',
  title: '戴德金环判别',
  params: {
    pick: { type: 'range', min: 0, max: 2, default: 0, label: '示例' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const idx = Math.max(0, Math.min(2, Math.round(num(params, 'pick', 0))));
    const examples = [
      { ring: 'ℤ（整数环）', factors: ['6 = 2 × 3', '12 = 2² × 3'], ok: true },
      { ring: 'ℤ[√−5]（非 UFD）', factors: ['6 = 2 × 3', '6 = (1+√−5)(1−√−5)'], ok: false },
      { ring: 'ℤ[i]（高斯整数）', factors: ['5 = (2+i)(2−i)', '2 = (1+i)(1−i)'], ok: true },
    ];
    const ex = examples[idx];

    // 左侧：元素的分解（可能不唯一）
    ex.factors.forEach((s, i) => {
      const y = 150 + i * 54;
      poly(f, [[70, y], [w * 0.52, y], [w * 0.52, y + 42], [70, y + 42]], {
        fill: i === 0 ? 'rgba(102,126,234,0.4)' : 'rgba(237,137,54,0.35)',
        stroke: i === 0 ? C.accent : C.warm, lw: 1.6, close: true,
      });
      text(f, s, 80, y + 27, { color: C.fg, font: '14px Consolas, monospace' });
    });

    // 右侧：判定条件
    const conds = [
      { s: '① 诺特环（理想升链稳定）', v: ex.ok },
      { s: '② 整闭（无「缺失」的整数）', v: ex.ok },
      { s: '③ 维数为 1', v: true },
    ];
    conds.forEach((c, i) => {
      const y = 150 + i * 54;
      poly(f, [[w * 0.58, y], [w - 60, y], [w - 60, y + 42], [w * 0.58, y]], {
        fill: c.v ? 'rgba(72,187,120,0.3)' : 'rgba(245,101,101,0.3)',
        stroke: c.v ? C.green : C.hot, lw: 1.6, close: true,
      } as never);
      text(f, `${c.v ? '✓' : '✗'} ${c.s}`, w * 0.58 + 10, y + 27, { color: C.fg, font: '13px system-ui' });
    });

    text(f, ex.ring, w / 2, 52, {
      align: 'center', font: 'bold 17px "Times New Roman", serif', color: C.warm,
    });
    text(f, ex.ok ? '满足三条 ⇒ 是戴德金环 ⇒ 理想可唯一分解' : '不满足 ⇒ 元素分解不唯一（但理想仍可唯一分解）', w / 2, 80, {
      align: 'center', color: ex.ok ? C.green : C.warm, font: '13px system-ui',
    });
    text(f, '戴德金环判别：诺特 + 整闭 + 维数 1', w / 2, h - 96, {
      align: 'center', color: C.cyan, font: 'bold 14px system-ui',
    });

    heading(f, '戴德金环判别：理想层面的「唯一分解」');
    footnotes(f, [
      '戴德金环的定义：诺特、整闭、维数为 1 的整环；其中每个非零理想都可唯一分解为素理想之积',
      'ℤ[√−5] 中元素分解不唯一（6 有两种分解），但理想层面仍唯一分解——这正是戴德金的洞察',
      '它是代数数论的基础框架：代数整数环的理想类群衡量「唯一分解」失效的程度',
    ]);
  },
});

// ---------------------------------------------------------------- T110
/** T110 蛇引理。 */
const snakeLemmaViz = defineViz({
  slug: 'snake-lemma',
  title: '蛇引理',
  params: {
    showSnake: { type: 'select', options: ['显示蛇形连接', '仅显示交换图'], default: '显示蛇形连接', label: '连接同态' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const show = str(params, 'showSnake', '显示蛇形连接') === '显示蛇形连接';

    const cols = 3;
    const rows = 2;
    const cellW = Math.min(120, (w - 260) / cols);
    const cellH = 54;
    const ox = (w - cols * cellW) / 2;
    const oy = 140;

    const labels = [
      ['A', 'B', 'C'],
      ["A'", "B'", "C'"],
    ];
    const colors = [
      ['rgba(102,126,234,0.5)', 'rgba(102,126,234,0.5)', 'rgba(102,126,234,0.5)'],
      ['rgba(56,178,172,0.5)', 'rgba(56,178,172,0.5)', 'rgba(56,178,172,0.5)'],
    ];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = ox + c * cellW;
        const y = oy + r * (cellH + 56);
        poly(f, [[x, y], [x + cellW - 20, y], [x + cellW - 20, y + cellH], [x, y + cellH]], {
          fill: colors[r][c], stroke: C.accent, lw: 1.4, close: true,
        });
        text(f, labels[r][c], x + (cellW - 20) / 2, y + cellH / 2 + 5, {
          align: 'center', color: C.fg, font: 'bold 16px "Times New Roman", serif',
        });
        // 水平箭头
        if (c < cols - 1) {
          seg(f, x + cellW - 20, y + cellH / 2, x + cellW, y + cellH / 2, { color: C.fg, lw: 1.6 } as never);
        }
      }
    }
    // 垂直箭头
    for (let c = 0; c < cols; c++) {
      const x = ox + c * cellW + (cellW - 20) / 2;
      seg(f, x, oy + cellH, x, oy + cellH + 56, { color: C.warm, lw: 1.8 } as never);
    }

    // 蛇形连接同态
    if (show) {
      const pts: Array<[number, number]> = [];
      const startX = ox + 2 * cellW + (cellW - 20) / 2;
      const startY = oy + cellH + 56;
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const x = startX - t * startX + ox - 60;
        const y = oy + cellH + 56 + Math.sin(t * Math.PI) * 46;
        pts.push([startX - t * (startX - 40), y]);
        void x;
        void y;
      }
      poly(f, pts, { stroke: C.hot, lw: 2.4 });
      text(f, '连接同态 δ', 44, oy + cellH + 66, { color: C.hot, font: 'bold 13px system-ui' });
    }

    text(f, '蛇引理：两行正合 ⇒ 存在长正合列', w / 2, 52, {
      align: 'center', font: 'bold 17px "Times New Roman", serif', color: C.warm,
    });
    text(f, 'ker a → ker b → ker c →(δ) coker a → coker b → coker c', w / 2, 80, {
      align: 'center', color: C.fg, font: '13px Consolas, monospace',
    });
    text(f, '红色弧线就是那条「蛇」——连接同态 δ 把各行同调连起来', w / 2, h - 96, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });

    heading(f, '蛇引理：同调代数的基本工具');
    footnotes(f, [
      '给定两行正合列与它们之间的竖直映射，必然存在一条「蛇形」长正合列穿过整个图',
      '它把「核」与「余核」（同调信息）通过连接同态 δ 串起来，是推导长正合列的标准手段',
      '几乎所有同调代数结论（相对同调、Mayer-Vietoris 序列等）都由蛇引理推出',
    ]);
  },
});

// ---------------------------------------------------------------- T111
/** T111 五引理。 */
const fiveLemmaViz = defineViz({
  slug: 'five-lemma',
  title: '五引理',
  params: {
    center: { type: 'select', options: ['中间是同构', '中间是满射', '中间是单射'], default: '中间是同构', label: '中间映射' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'center', '中间是同构');

    const n = 5;
    const cellW = Math.min(150, (w - 140) / n);
    const cellH = 58;
    const ox = (w - n * cellW) / 2;
    const oy = 150;

    const labels = ['A₁', 'A₂', 'A₃', 'A₄', 'A₅'];
    const labels2 = ["A'₁", "A'₂", "A'₃", "A'₄", "A'₅"];

    for (let i = 0; i < n; i++) {
      const x = ox + i * cellW;
      const isCenter = i === 2;
      for (let r = 0; r < 2; r++) {
        const y = oy + r * (cellH + 70);
        poly(f, [[x, y], [x + cellW - 26, y], [x + cellW - 26, y + cellH], [x, y + cellH]], {
          fill: isCenter
            ? (kind === '中间是同构' ? 'rgba(72,187,120,0.45)' : kind === '中间是满射' ? 'rgba(237,137,54,0.45)' : 'rgba(56,178,172,0.45)')
            : 'rgba(102,126,234,0.3)',
          stroke: isCenter ? C.warm : C.accent, lw: isCenter ? 2.2 : 1.2, close: true,
        });
        text(f, r === 0 ? labels[i] : labels2[i], x + (cellW - 26) / 2, y + cellH / 2 + 5, {
          align: 'center', color: C.fg, font: 'bold 14px "Times New Roman", serif',
        });
        // 水平箭头
        if (i < n - 1) {
          seg(f, x + cellW - 26, y + cellH / 2, x + cellW, y + cellH / 2, { color: C.dim, lw: 1.4 } as never);
        }
        // 竖直映射
        if (r === 0) {
          const cx = x + (cellW - 26) / 2;
          seg(f, cx, y + cellH, cx, y + cellH + 70, {
            color: isCenter ? C.warm : C.cyan, lw: isCenter ? 2.2 : 1.4,
          } as never);
        }
      }
    }

    const centerNote =
      kind === '中间是同构'
        ? '两端四处的映射都是同构 ⇒ 中间那个也是同构'
        : kind === '中间是满射'
          ? '右侧两处为满射、左侧一处为单射 ⇒ 中间是满射'
          : '左侧两处为单射、右侧一处为满射 ⇒ 中间是单射';
    text(f, '五引理', w / 2, 52, {
      align: 'center', font: 'bold 18px "Times New Roman", serif', color: C.warm,
    });
    text(f, centerNote, w / 2, 80, { align: 'center', color: C.green, font: '14px system-ui' });
    text(f, '橙色列即被「夹住」的中间映射，其性质由两侧的同调信息决定', w / 2, 104, {
      align: 'center', color: C.dim, font: '13px system-ui',
    });

    heading(f, '五引理：只需检查两端');
    footnotes(f, [
      '长正合列中，如果中间映射左右「各两个」映射都是同构，那么中间那个也必是同构',
      '这是图表追法（diagram chasing）中最常用的引理，几乎所有同构传递论证都靠它',
      '切换下拉框可看到满射/单射版本：只需单侧的弱条件即可推出中间的相应性质',
    ]);
  },
});

// ---------------------------------------------------------------- T112
/** T112 投射模与内射模理论。 */
const projectiveInjectiveModulesViz = defineViz({
  slug: 'projective-injective-modules',
  title: '投射模与内射模理论',
  params: {
    pick: { type: 'select', options: ['投射模（自由模的直和项）', '内射模（对偶概念）', '同调维数'], default: '投射模（自由模的直和项）', label: '展示' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'pick', '投射模（自由模的直和项）');

    const v = equalView(f, 0, 0, 1.7, 54);
    grid(f, v, { divisions: 4, ticks: false });

    if (kind.startsWith('投射')) {
      // 自由模 = 投射模 ⊕ 另一个模
      poly(f, [[v.sx(-1.4), v.sy(-0.6)], [v.sx(0.2), v.sy(-0.6)], [v.sx(0.2), v.sy(0.6)], [v.sx(-1.4), v.sy(0.6)]], {
        fill: 'rgba(102,126,234,0.45)', stroke: C.accent, lw: 2, close: true,
      });
      text(f, '投射模 P', v.sx(-0.6), v.sy(0.05), { align: 'center', color: C.fg, font: 'bold 14px system-ui' });
      poly(f, [[v.sx(0.28), v.sy(-0.6)], [v.sx(1.4), v.sy(-0.6)], [v.sx(1.4), v.sy(0.6)], [v.sx(0.28), v.sy(0.6)]], {
        fill: 'rgba(56,178,172,0.4)', stroke: C.cyan, lw: 2, close: true,
      });
      text(f, "模 Q", v.sx(0.84), v.sy(0.05), { align: 'center', color: C.fg, font: 'bold 14px system-ui' });
      text(f, '⊕', v.sx(0.24), v.sy(-0.72), { align: 'center', color: C.warm, font: 'bold 22px system-ui' });
      text(f, '自由模 F = P ⊕ Q', v.sx(0), v.sy(-0.86), { align: 'center', color: C.warm, font: 'bold 13px system-ui' });
      text(f, '投射模是自由模的直和项（可「提升」映射）', w / 2, h - 96, {
        align: 'center', color: C.green, font: '13px system-ui',
      });
    } else if (kind.startsWith('内射')) {
      // 内射：映射可「延拓」
      poly(f, [[v.sx(-1.3), v.sy(-0.5)], [v.sx(0.1), v.sy(-0.5)], [v.sx(0.1), v.sy(0.5)], [v.sx(-1.3), v.sy(0.5)]], {
        fill: 'rgba(102,126,234,0.3)', stroke: C.accent, lw: 1.8, close: true,
      });
      text(f, '子模 A', v.sx(-0.6), v.sy(0.05), { align: 'center', color: C.fg, font: '13px system-ui' });
      poly(f, [[v.sx(-1.5), v.sy(-0.8)], [v.sx(1.5), v.sy(-0.8)], [v.sx(1.5), v.sy(0.8)], [v.sx(-1.5), v.sy(0.8)]], {
        stroke: C.cyan, lw: 2.2,
      });
      text(f, '内射模 E', v.sx(0), v.sy(0.66), { align: 'center', color: C.cyan, font: 'bold 13px system-ui' });
      seg(f, v.sx(0.1), v.sy(0), v.sx(1.4), v.sy(0), { color: C.warm, lw: 2 } as never);
      text(f, '映射可延拓', v.sx(0.75), v.sy(0.14), { align: 'center', color: C.warm, font: '12px system-ui' });
      text(f, '内射模：定义在子模上的映射总能延拓到整个模', w / 2, h - 96, {
        align: 'center', color: C.green, font: '13px system-ui',
      });
    } else {
      // 同调维数：分辨长度
      for (let i = 0; i < 4; i++) {
        const x = v.sx(-1.4 + i * 0.95);
        poly(f, [[x - 34, v.sy(-0.45)], [x + 34, v.sy(-0.45)], [x + 34, v.sy(0.45)], [x - 34, v.sy(0.45)]], {
          fill: i === 3 ? 'rgba(72,187,120,0.4)' : 'rgba(102,126,234,0.4)',
          stroke: i === 3 ? C.green : C.accent, lw: 1.6, close: true,
        });
        text(f, i === 3 ? 'P_n' : `P${i}`, x, v.sy(0.04), { align: 'center', color: C.fg, font: 'bold 13px system-ui' });
        if (i < 3) seg(f, x + 34, v.sy(0), x + 0.95 * 0 + (v.sx(0.95) - 0) - 34 + (x - v.sx(-1.4)) - 34, v.sy(0), { color: C.dim, lw: 1.6 } as never);
      }
      text(f, '0 → P_n → … → P₀ → M → 0（投射分辨）', v.sx(0), v.sy(-0.72), {
        align: 'center', color: C.warm, font: 'bold 12px system-ui',
      });
      text(f, '最短分辨的长度就是投射维数 pd(M)', w / 2, h - 96, {
        align: 'center', color: C.green, font: '13px system-ui',
      });
    }

    text(f, '投射模与内射模理论', w / 2, 52, {
      align: 'center', font: 'bold 17px "Times New Roman", serif', color: C.warm,
    });
    text(f, '它们的存在性决定了环上的同调维数，从而刻画环的「复杂程度」', w / 2, 80, {
      align: 'center', color: C.fg, font: '13px system-ui',
    });

    heading(f, '投射模与内射模：模的「好性质」');
    footnotes(f, [
      '投射模 = 自由模的直和项 = 能把映射从满射「提升」回去的模',
      '内射模是对偶概念：定义在子模上的映射总能延拓到整个模',
      '用它们构造分辨（resolution），可定义同调维数；例如「整体维数为 0」正是半单环',
    ]);
  },
});

// ---------------------------------------------------------------- T113
/** T113 高斯绝妙定理。 */
const gaussTheoremaEgregiumViz = defineViz({
  slug: 'gauss-theorema-egregium',
  title: '高斯绝妙定理',
  params: {
    bend: { type: 'range', min: 0, max: 1, step: 0.05, default: 0.6, label: '弯曲程度' },
    twist: { type: 'range', min: 0, max: 1, step: 0.05, default: 0.3, label: '扭转（不可弯曲）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const bend = num(params, 'bend', 0.6);
    const twist = num(params, 'twist', 0.3);

    const v = equalView(f, 0, 0, 1.7, 54);
    grid(f, v, { divisions: 4, ticks: false });

    // 一张纸（网格）被弯曲：圆柱面 / 平面
    const rows = 9;
    const cols = 13;
    for (let i = 0; i < rows; i++) {
      const pts: Array<[number, number]> = [];
      for (let j = 0; j < cols; j++) {
        const u = -1 + (2 * j) / (cols - 1);
        const vv = -1 + (2 * i) / (rows - 1);
        // 弯曲成柱面：x = sin(bend·u·π/2)，z 保留
        const ang = u * (Math.PI / 2) * bend;
        const X = Math.sin(ang) * 1.2 + twist * 0.15 * vv;
        const Y = vv * 0.75 + twist * 0.35 * u;
        pts.push([v.sx(X), v.sy(Y)]);
      }
      poly(f, pts, { stroke: 'rgba(102,126,234,0.5)', lw: 1.2 });
    }
    for (let j = 0; j < cols; j++) {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < rows; i++) {
        const u = -1 + (2 * j) / (cols - 1);
        const vv = -1 + (2 * i) / (rows - 1);
        const ang = u * (Math.PI / 2) * bend;
        const X = Math.sin(ang) * 1.2 + twist * 0.15 * vv;
        const Y = vv * 0.75 + twist * 0.35 * u;
        pts.push([v.sx(X), v.sy(Y)]);
      }
      poly(f, pts, { stroke: 'rgba(102,126,234,0.5)', lw: 1.2 });
    }

    // 高斯曲率的「数值」是否随弯曲改变
    const K = 0; // 可展曲面（平面、柱面、锥面）高斯曲率恒为 0
    text(f, '弯曲程度 = ' + bend.toFixed(2) + '，高斯曲率 K = ' + K, w / 2, 48, {
      align: 'center', font: 'bold 16px system-ui', color: C.warm,
    });
    text(f, '无论怎样「弯」，K 始终为 0 —— 因为弯曲不改变内蕴度量', w / 2, 76, {
      align: 'center', color: C.green, font: '14px system-ui',
    });
    text(f, '把「扭转」调大，纸面被拉伸，K 才会改变（说明它被强行变形了）', w / 2, 100, {
      align: 'center', color: twist > 0.05 ? C.hot : C.dim, font: '13px system-ui',
    });

    heading(f, '高斯绝妙定理：曲率是内蕴的');
    footnotes(f, [
      '高斯曲率只依赖曲面上的度量（如何测长、测角），与它如何嵌入三维空间无关',
      '所以一张纸可以卷成圆柱或圆锥，但绝不能在不皱、不撕的前提下「包住」一个球',
      '这是黎曼几何的思想源头：几何性质可以由内部测量完全确定，无需外部空间',
    ]);
  },
});

// ---------------------------------------------------------------- T114
/** T114 陈-高斯-博内定理。 */
const chernGaussBonnetViz = defineViz({
  slug: 'chern-gauss-bonnet',
  title: '陈-高斯-博内定理',
  params: {
    genus: { type: 'range', min: 0, max: 4, default: 1, label: '亏格 g（洞数）' },
    phi: { type: 'range', min: 0, max: 360, step: 10, default: 0, label: '旋转角' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const g = Math.max(0, Math.round(num(params, 'genus', 1)));
    const rot = (num(params, 'phi', 0) * Math.PI) / 180;

    const chi = 2 - 2 * g;

    const v = equalView(f, 0, 0, 1.7, 54);
    grid(f, v, { divisions: 4, ticks: false });

    if (g === 0) {
      const c: Array<[number, number]> = [];
      for (let i = 0; i <= 130; i++) {
        const a = (i * 2 * Math.PI) / 130;
        c.push([v.sx(78 * Math.cos(a + rot)), v.sy(78 * Math.sin(a + rot) * 0.9)]);
      }
      poly(f, c, { fill: 'rgba(102,126,234,0.25)', stroke: C.accent, lw: 2.2 });
      // 网格线示意曲率
      for (const k of [-0.55, -0.18, 0.18, 0.55]) {
        const line: Array<[number, number]> = [];
        for (let i = 0; i <= 60; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 60;
          line.push([v.sx(78 * k * Math.cos(a) * 0.9), v.sy(78 * Math.sin(a) * 0.9)]);
        }
        poly(f, line, { stroke: 'rgba(160,174,192,0.35)', lw: 1 });
      }
    } else {
      for (let k = 0; k < g; k++) {
        const cx = v.sx((k - (g - 1) / 2) * 1.05);
        const cy = v.sy(0);
        const rx = 76;
        const ry = 48;
        const tube = 24;
        const pts: Array<[number, number]> = [];
        for (let i = 0; i <= 160; i++) {
          const a = (i * 2 * Math.PI) / 160 + rot;
          pts.push([cx + (rx + tube * Math.cos(6 * a)) * Math.cos(a), cy + (ry + tube * Math.cos(6 * a) * 0.68) * Math.sin(a)]);
        }
        poly(f, pts, { stroke: C.accent, lw: 1.8, fill: 'rgba(102,126,234,0.2)', close: true });
      }
    }

    text(f, '∬_M K dA = 2π·χ(M)', w / 2, 48, {
      align: 'center', font: 'bold 20px "Times New Roman", serif', color: C.warm,
    });
    text(f, `亏格 g = ${g} ⇒ 欧拉示性数 χ = 2 − 2g = ${chi}`, w / 2, 76, {
      align: 'center', color: C.accent, font: '15px Consolas, monospace',
    });
    text(f, `曲率积分 = ${(2 * Math.PI * chi).toFixed(4)}　（必然为 2π 的整数倍）`, w / 2, 100, {
      align: 'center', color: C.green, font: '15px Consolas, monospace',
    });
    text(f, '旋转曲面不改变 χ —— 曲率积分这个「总量」是拓扑决定的', w / 2, h - 96, {
      align: 'center', color: C.dim, font: '12px system-ui',
    });

    heading(f, '陈-高斯-博内定理：局部曲率决定整体拓扑');
    footnotes(f, [
      '闭曲面上的高斯曲率积分，等于 2π 乘以欧拉示性数——必然是一个离散的整数值',
      '调节亏格（洞数）可看到积分随之跳变：球面 4π、环面 0、双环面 −4π…',
      '陈省身把它推广到高维流形与复流形（陈类），成为整体微分几何的基石',
    ]);
  },
});

registerViz(
  hahnBanachViz,
  openMappingTheoremViz,
  closedGraphTheoremViz,
  spectralTheoremOperatorsViz,
  krullPrincipalIdealViz,
  noetherNormalizationViz,
  dedekindDomainViz,
  snakeLemmaViz,
  fiveLemmaViz,
  projectiveInjectiveModulesViz,
  gaussTheoremaEgregiumViz,
  chernGaussBonnetViz,
);
