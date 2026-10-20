import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text, rng } from '../canvas';

/** P22 放射性衰变与半衰期：指数规律 + 蒙特卡洛点阵。 */
const radioactiveDecay = defineViz({
  slug: 'radioactive-decay',
  title: '放射性衰变与半衰期',
  params: {
    halfLife: { type: 'range', min: 1, max: 10, default: 3, step: 0.5, label: '半衰期 t½ (s)' },
    t: { type: 'range', min: 0, max: 5, default: 1.5, step: 0.05, label: '经过时间 t (×t½)' },
    N0: { type: 'range', min: 200, max: 2000, default: 1000, step: 100, label: '初始核数 N₀' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const t12 = num(params, 'halfLife', 3);
    const tUnits = num(params, 't', 1.5);
    const N0 = Math.round(num(params, 'N0', 1000));
    const t = tUnits * t12;
    const lam = Math.LN2 / t12;
    const N = N0 * Math.exp(-lam * t);

    clear(f);
    // 左：N(t) 指数曲线
    const half = w * 0.54;
    const x0 = 50, x1 = half - 16, y0 = h - 56, y1 = 52;
    const T = 5 * t12;
    const sx = (tt: number) => x0 + (tt / T) * (x1 - x0);
    const sy = (n: number) => y0 - (n / N0) * (y0 - y1);
    // 网格与轴
    for (let i = 0; i <= 5; i++) {
      const gy = y0 - (i / 5) * (y0 - y1);
      seg(f, x0, gy, x1, gy, `${C.grid}88`, 1);
      text(f, `${(N0 * i) / 5}`, x0 - 6, gy + 4, { align: 'right', color: C.dim, font: '10px sans-serif' });
    }
    seg(f, x0, y0, x1, y0, C.grid, 1.4);
    // 曲线
    const pts: [number, number][] = [];
    for (let i = 0; i <= 240; i++) {
      const tt = (i / 240) * T;
      pts.push([sx(tt), sy(N0 * Math.exp(-lam * tt))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.6 });
    // 半衰期刻度
    for (let k = 1; k <= 5; k++) {
      const tk = k * t12;
      seg(f, sx(tk), y0, sx(tk), y0 + 6, C.dim, 1.4);
      text(f, `${k}t½`, sx(tk), y0 + 20, { align: 'center', color: C.dim, font: '11px sans-serif' });
      seg(f, x0, sy(N0 / Math.pow(2, k)), sx(tk), sy(N0 / Math.pow(2, k)), `${C.warm}55`, 1);
      dot(f, sx(tk), sy(N0 / Math.pow(2, k)), 4, C.warm);
    }
    // 当前时刻
    seg(f, sx(t), y1, sx(t), y0, `${C.hot}99`, 1.4);
    dot(f, sx(t), sy(N), 6, C.hot);
    text(f, `N = ${N.toFixed(0)}`, sx(t) + 8, sy(N) - 10, { color: C.hot, font: '13px sans-serif' });
    text(f, '核数 N(t)', x0 + 4, y1 - 10, { color: C.accent, font: '12px sans-serif' });
    text(f, '时间 t', x1 - 4, y0 + 20, { align: 'right', color: C.dim, font: '12px sans-serif' });

    // 右：蒙特卡洛点阵（确定性种子：亮=未衰变，暗=已衰变）
    const gx = half + 30, gy0 = 66;
    const cols = 40;
    const rows = Math.ceil(N0 / cols);
    const cell = Math.min(9, (w - gx - 30) / cols, (h - gy0 - 90) / rows);
    const rand = rng(42);
    const survived = Math.round(N);
    // 用固定随机序确定哪些核已衰变（阈值按衰变概率排序近似）
    const decayProb = 1 - Math.exp(-lam * t);
    let shownDecayed = 0;
    for (let i = 0; i < N0; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = gx + col * cell;
      const y = gy0 + row * cell;
      if (y > h - 96) break;
      const r = rand();
      const isDecayed = r < decayProb;
      if (isDecayed) shownDecayed++;
      f.ctx.fillStyle = isDecayed ? 'rgba(120,130,150,0.25)' : 'rgba(72,187,120,0.95)';
      f.ctx.fillRect(x, y, cell - 1.6, cell - 1.6);
    }
    text(f, `未衰变 ${survived} / ${N0}（绿）　已衰变 ${N0 - survived}（灰）`, gx, gy0 - 14, { color: C.green, font: '12px sans-serif' });

    footnotes(f, [
      `N(t) = N₀e^(−λt)，λ = ln2/t½ = ${lam.toFixed(4)} /s；t = ${tUnits} t½ ⇒ 剩余 ${(100 * Math.pow(0.5, tUnits)).toFixed(1)}%`,
      '单个核何时衰变完全随机（量子偶然性），但 N₀→∞ 时统计行为精确指数 —— 宏观确定性源于微观随机性',
      '半衰期与"何时衰完"无关：每个半衰期都剩一半，永远不为零（指数尾）；这是碳-14 定年与核废料处置的物理基础',
    ]);
    heading(f, '指数衰变：曲线与随机抽样');
  },
});
registerViz(radioactiveDecay);
