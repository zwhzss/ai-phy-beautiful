import { defineViz, num, str, type VizFrame } from '../types';
import { registerViz } from '../registry';
import { C, dot, footnotes, grid, heading, poly, seg, text, view, type View } from '../canvas';

/** P27 宇宙数量级阶梯：50 个数量级的对数尺。 */
const orderOfMagnitude = defineViz({
  slug: 'order-of-magnitude',
  title: '宇宙数量级阶梯',
  params: {
    range: { type: 'select', options: ['全谱 (10⁻³⁵~10²⁶ m)', '微观 (10⁻¹⁵~10⁰ m)', '宏观 (10⁰~10²⁶ m)'], default: '全谱 (10⁻³⁵~10²⁶ m)', label: '视野' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const range = str(params, 'range', '全谱 (10⁻³⁵~10²⁶ m)');
    const [xMin, xMax] = range.startsWith('微观') ? [-15, 0] : range.startsWith('宏观') ? [0, 26] : [-35, 26];

    const anchors: { e: number; label: string }[] = [
      { e: -35, label: '普朗克长' }, { e: -18, label: '夸克' }, { e: -15, label: '质子' },
      { e: -10, label: '原子' }, { e: -9, label: 'DNA' }, { e: -5, label: '细胞' },
      { e: 0, label: '人 1.7m' }, { e: 4, label: '珠峰' }, { e: 7, label: '地球' },
      { e: 11, label: '日地距' }, { e: 16, label: '比邻星' }, { e: 21, label: '银河系' },
      { e: 24, label: '超星系团' }, { e: 26, label: '可观测宇宙' },
    ].filter((a) => a.e >= xMin && a.e <= xMax);

    const v = view(f, { xMin, xMax, yMin: 0, yMax: 1.35, inset: 44 });
    grid(f, v, { divisions: 6, ticks: true });
    // 阶梯（每 5 个数量级一档）
    const step = (xMax - xMin) > 40 ? 5 : 2;
    for (let e = Math.ceil(xMin / step) * step; e <= xMax; e += step) {
      const frac = (e - xMin) / (xMax - xMin);
      const barH = 0.12 + frac * 0.75;
      const x0 = v.sx(e), x1 = v.sx(Math.min(e + step, xMax));
      poly(f, [[x0, v.sy(0)], [x1, v.sy(0)], [x1, v.sy(barH)], [x0, v.sy(barH)]], {
        stroke: `${C.accent}66`, lw: 1, fill: `rgba(102,126,234,${0.10 + frac * 0.35})`,
      } as any);
      if ((xMax - xMin) <= 45) text(f, `10${sup(e)}`, (x0 + x1) / 2, v.sy(0) + 16, { align: 'center', color: C.dim, font: '10px sans-serif' });
    }
    // 代表物体标记
    anchors.forEach((a, i) => {
      const x = v.sx(a.e);
      const frac = (a.e - xMin) / (xMax - xMin);
      const y = 0.12 + frac * 0.75;
      dot(f, x, v.sy(y), 5, i % 2 ? C.warm : C.cyan);
      text(f, a.label, x, v.sy(y) - 10, { align: 'center', color: i % 2 ? C.warm : C.cyan, font: '10px sans-serif' });
    });

    footnotes(f, [
      `视野 ${range}：每上一格台阶，尺度放大 ${step === 5 ? '10 万' : '100'} 倍——对数尺让'从夸克到宇宙'同框显示`,
      '数量级估计（费米问题）是物理学家的核心技能：先猜数量级、再求精确解',
      '50 个数量级之内，人类已经建立了统一的物理理论；之外（普朗克尺度以下）仍是未知（需量子引力）',
    ]);
    heading(f, '数量级阶梯：从夸克到宇宙');
  },
});
registerViz(orderOfMagnitude);

function sup(n: number): string {
  const map: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  return String(n).split('').map((c) => map[c] ?? c).join('');
}

/** P28 平方-立方律：为什么小动物更强壮。 */
const scalingLaw = defineViz({
  slug: 'scaling-law',
  title: '平方-立方律',
  params: {
    L: { type: 'range', min: 1, max: 10, default: 3, step: 0.5, label: '体长 L（相对单位）' },
  },
  draw: (f) => {
    const { params } = f;
    const L = num(params, 'L', 3);

    const v = view(f, { xMin: 0, xMax: 10, yMin: 0, yMax: 1000, inset: 48 });
    grid(f, v, { divisions: 5, ticks: true });
    // 截面积 ~L²，体积/质量 ~L³
    const area = (x: number) => x * x;
    const volume = (x: number) => x * x * x;
    curveWith(v, f, area, `${C.cool}`);
    curveWith(v, f, volume, C.warm);
    // 当前 L 标记
    seg(f, v.sx(L), v.sy(0), v.sx(L), v.sy(Math.min(volume(L), 1000)), `${C.green}aa`, 1.4);
    dot(f, v.sx(L), v.sy(Math.min(area(L), 1000)), 6, C.cool);
    dot(f, v.sx(L), v.sy(Math.min(volume(L), 1000)), 6, C.warm);
    text(f, `截面 L²=${area(L).toFixed(0)}`, v.sx(L) + 8, v.sy(Math.min(area(L), 1000)) - 8, { color: C.cool, font: '12px sans-serif' });
    text(f, `体积 L³=${volume(L).toFixed(0)}`, v.sx(L) + 8, v.sy(Math.min(volume(L), 1000)) - 8, { color: C.warm, font: '12px sans-serif' });
    text(f, '体长 L', v.sx(v.xMax) - 4, v.sy(0) + 20, { align: 'right', color: C.dim, font: '12px sans-serif' });

    const ratio = area(L) / volume(L);
    footnotes(f, [
      `L = ${L}：截面（承力）∝ L² = ${area(L).toFixed(0)}，体积（重量）∝ L³ = ${volume(L).toFixed(0)}，强度/重量 ∝ 1/L = ${ratio.toFixed(3)}`,
      '体长翻倍 → 强度变 4 倍、重量变 8 倍：承力比反而减半——蚂蚁能举 50 倍体重，大象却举不动自己',
      '这也是鼠类心跳约 600 次/分（散热面积/体积比大）、蓝鲸心脏仅每分钟 2 次、恐龙不能太高的原因',
    ]);
    heading(f, '平方-立方律：尺度决定强度');
  },
});
registerViz(scalingLaw);

function curveWith(v: View, f: VizFrame, fn: (x: number) => number, color: string): void {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 200; i++) {
    const x = (i / 200) * 10;
    pts.push([v.sx(x), v.sy(Math.min(fn(x), 1000))]);
  }
  poly(f, pts, { stroke: color, lw: 2.4 });
}
