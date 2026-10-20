import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, dot, footnotes, grid, heading, rng, seg, text, view } from '../canvas';

/** P34 哈勃图：星系退行速度与距离。 */
const hubbleDiagram = defineViz({
  slug: 'hubble-diagram',
  title: '哈勃图与宇宙膨胀',
  params: {
    H0: { type: 'range', min: 60, max: 75, default: 67.4, step: 0.1, label: '哈勃常数 H₀ (km/s/Mpc)' },
    scatter: { type: 'range', min: 0, max: 30, default: 12, step: 1, label: '观测弥散 ±(%)' },
    seed: { type: 'range', min: 1, max: 30, default: 11, step: 1, label: '数据随机种子' },
  },
  draw: (f) => {
    const { params } = f;
    const H0 = num(params, 'H0', 67.4);
    const scatter = num(params, 'scatter', 12);
    const seed = Math.round(num(params, 'seed', 11));
    const rand = rng(seed * 7919);

    const dMax = 600; // Mpc
    const vMax = H0 * dMax * 1.15;
    const v = view(f, { xMin: 0, xMax: dMax, yMin: 0, yMax: vMax, inset: 52 });
    grid(f, v, { divisions: 5, ticks: true });

    // 哈勃定律直线 v = H0·d
    seg(f, v.sx(0), v.sy(0), v.sx(dMax), v.sy(H0 * dMax), C.accent, 2.6);
    // 观测散点（±弥散，确定性种子）
    const pts: [number, number][] = [];
    for (let i = 0; i < 46; i++) {
      const d = 25 + rand() * (dMax - 40);
      const jitter = 1 + ((rand() - 0.5) * 2 * scatter) / 100;
      const vv = H0 * d * jitter;
      pts.push([v.sx(d), v.sy(Math.max(0, Math.min(vv, vMax)))]);
    }
    pts.forEach((p) => dot(f, p[0], p[1], 3.6, C.warm));

    text(f, `v = H₀·d　H₀ = ${H0} km/s/Mpc`, v.sx(dMax * 0.42), v.sy(H0 * dMax * 0.72), { color: C.accent, font: '13px sans-serif' });
    text(f, '距离 d (Mpc)', v.sx(v.xMax) - 4, v.sy(0) + 20, { align: 'right', color: C.dim, font: '12px sans-serif' });
    text(f, '退行速度 v (km/s)', v.sx(0) - 44, v.sy(v.yMax) - 8, { color: C.dim, font: '12px sans-serif' });
    // 参考刻度：1 Mpc ≈ 3.26 光年
    text(f, '600 Mpc ≈ 19.6 亿光年', v.sx(dMax) - 6, v.sy(0) + 36, { align: 'right', color: C.dim, font: '10px sans-serif' });

    footnotes(f, [
      `哈勃定律 v = H₀d：H₀ = ${H0} ± 观测弥散 ${scatter}% —— Planck 卫星 67.4、本地造父阶梯 73.0，两者差异（哈勃张力）是当前宇宙学焦点问题`,
      '1929 年哈勃用勒维特的周光关系测出 46 个星系距离，发现速度-距离线性关系——宇宙在膨胀',
      "斜率的倒数 1/H₀ ≈ 145 亿年，即宇宙年龄的量级；1998 年高红移超新星揭示'减速后加速'，暗能量登场",
    ]);
    heading(f, '哈勃图：膨胀宇宙的观测证据');
  },
});
registerViz(hubbleDiagram);
