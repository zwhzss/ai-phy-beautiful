import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** 参考系拖曳。 */
const frameDragging = defineViz({
  slug: 'frame-dragging', title: '参考系拖曳（Lense-Thirring）', animated: true,
  params: {
    J: { type: 'range', min: 0, max: 1, default: 0.6, step: 0.05, label: '角动量 J（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const J = num(params, 'J', 0.6);
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    const R = Math.min(w, h) * 0.4;
    // 旋转中心
    dot(f, cx, cy, 13 + J * 6, C.warm);
    // 拖曳的时空漩涡（同心圆上的切向箭头随 J 变强）
    for (let ring = 1; ring <= 4; ring++) {
      const rr = (ring / 4) * R;
      const pts: [number, number][] = [];
      for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.07) {
        const twist = J * 0.5 * Math.exp(-rr / 80);
        pts.push([cx + rr * Math.cos(a + twist), cy + rr * Math.sin(a + twist) * 0.8]);
      }
      poly(f, pts, { stroke: `${C.cool}77`, lw: 1.4, dash: [6, 4] } as any);
      // 箭头
      const a0 = f.t * (0.4 + J * 1.2) + ring;
      const x = cx + rr * Math.cos(a0), y = cy + rr * Math.sin(a0) * 0.8;
      const tx = -Math.sin(a0) * 22, ty = Math.cos(a0) * 17;
      poly(f, [[x + tx, y + ty], [x + tx * 0.35 - 6, y + ty * 0.35], [x + tx * 0.35 + 6, y + ty * 0.35]],
        { stroke: C.cyan, lw: 1.6, fill: C.cyan } as any);
    }
    // 引力探测器 B 卫星轨迹
    const orbit = f.t * 1.2;
    const ox = cx + R * 0.86 * Math.cos(orbit), oy = cy + R * 0.86 * Math.sin(orbit) * 0.5;
    dot(f, ox, oy, 6, C.green);
    text(f, 'Gravity Probe B：陀螺指向被时空漩涡拖偏 6.6″/年（2011 实测证实）', 30, 44, { color: C.green, font: '12px sans-serif' });
    text(f, `J=${J}：旋转质量拖着周围时空一起转——没有'绝对静止'的参照`, 30, 66, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '克尔解的Off-分量 g_tφ：旋转质量让惯性系本身旋转——惯性被拖曳',
      '地球也拖曳（极微弱）：Gravity Probe B 用超导陀螺在 650km 轨道测到了',
      '拖曳对 LIGO 双黑洞波形有可测贡献——强场拖曳已进入引力波天文学时代',
    ]);
    heading(f, '参考系拖曳：时空被旋转拧动');
  },
});
registerViz(frameDragging);

/** FLRW 宇宙学度规。 */
const flrwMetric = defineViz({
  slug: 'flrw-cosmology', title: 'FLRW 宇宙与尺度因子', animated: true,
  params: {
    omega: { type: 'range', min: 0, max: 2, default: 1, step: 0.1, label: 'Ω（密度参数）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const om = num(params, 'omega', 1);
    clear(f);
    const x0 = 60, y0 = h - 56, y1 = 56;
    const vv = view(f, { xMin: 0, xMax: 10, yMin: 0, yMax: 2.4, inset: 50 });
    grid(f, vv, { divisions: 4, ticks: true });
    // 尺度因子 a(t)：开放(加速)、平坦(线性)、封闭(先胀后缩)
    const aOf = (t: number): number => {
      if (om > 1.05) { const s = Math.sin((t / 10) * Math.PI); return Math.max(s * 2.1, 0); }
      if (om < 0.95) return Math.pow(t / 10, 1.35) * 1.9;
      return (t / 10) * 1.7;
    };
    const pts: [number, number][] = [];
    for (let i = 0; i <= 240; i++) {
      const t = (i / 240) * 10;
      pts.push([vv.sx(t), vv.sy(aOf(t))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.8 });
    const tNow = 7.4;
    dot(f, vv.sx(tNow), vv.sy(aOf(tNow)), 7, C.warm);
    // 星系随网格退行
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const rr = (0.2 + aOf(tNow) * 0.34) * 60;
      dot(f, w * 0.74 + Math.cos(a) * rr, h * 0.3 + Math.sin(a) * rr * 0.7, 4, C.cool);
    }
    text(f, `ds² = −c²dt² + a(t)²[dr²/(1−kr²) + r²dΩ²]`, 30, 44, { color: C.cyan, font: '14px sans-serif' });
    text(f, om > 1.05 ? 'Ω>1：封闭宇宙——先膨胀后坍缩（大反弹？）' : om < 0.95 ? 'Ω<1：开放宇宙——永远加速膨胀（曲率为负）' : 'Ω=1：平坦宇宙——观测支持（暴胀的预言）',
      30, 66, { color: C.warm, font: '12px sans-serif' });
    void x0; void y0; void y1;

    footnotes(f, [
      'FLRW（1927-1931）是唯一满足宇宙学原理（均匀各向同性）的度规——现代宇宙学的舞台',
      'k=+1/0/−1 三种空间曲率由 Ω 总量定：临界密度精确到 1%（Planck 2018）',
      "星系退行不是'在空间中飞'，而是空间本身带着它们拉伸——哈勃流的正确读法",
    ]);
    heading(f, 'FLRW 度规：一个公式装下宇宙几何');
  },
});
registerViz(flrwMetric);

/** 后牛顿近似。 */
const postNewtonian = defineViz({
  slug: 'post-newtonian', title: '后牛顿近似（1PN）', animated: true,
  params: {
    v: { type: 'range', min: 0.01, max: 0.6, default: 0.1, step: 0.01, label: '轨道速度 v/c' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const beta = num(params, 'v', 0.1);
    const corr = beta * beta; // 1PN 修正 ∝ v²/c²
    clear(f);
    const x0 = 56, y0 = h - 56, y1 = 56;
    const vv = view(f, { xMin: 0, xMax: 0.6, yMin: 0, yMax: 1.2, inset: 50 });
    grid(f, vv, { divisions: 4, ticks: true });
    // 牛顿势 vs 1PN 修正曲线
    const newton: [number, number][] = [];
    const pn: [number, number][] = [];
    for (let i = 1; i <= 200; i++) {
      const b = (i / 200) * 0.6;
      newton.push([vv.sx(b), vv.sy(1)]);
      pn.push([vv.sx(b), vv.sy(1 + b * b * 1.1)]);
    }
    poly(f, newton, { stroke: `${C.dim}aa`, lw: 2, dash: [7, 5] } as any);
    poly(f, pn, { stroke: C.accent, lw: 2.8 });
    dot(f, vv.sx(beta), vv.sy(1 + corr * 1.1), 7, C.warm);
    void x0; void y0; void y1;
    text(f, `1PN 修正量级 ~ (v/c)² = ${corr.toFixed(3)}：牛顿引力是 (v/c)→0 的首项`, 30, 44, { color: C.cyan, font: '14px sans-serif' });
    text(f, '双星脉冲 PSR 1913+16 的轨道衰减与 1PN 能量辐射吻合——间接发现引力波（1974）', 30, 66, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '后牛顿展开按 (v/c)² 逐阶修正爱因斯坦场方程——弱场慢速的系统化近似',
      'PN 波形模板是 LIGO 搜索引力波的基石：数值相对论之外最重要的计算工具',
      '水星进动、引力红移、引力延迟（Shapiro）都是 1PN/2PN 效应——太阳系检验的常客',
    ]);
    heading(f, '后牛顿近似：把相对论逐阶修正牛顿');
  },
});
registerViz(postNewtonian);

/** 测地偏离（潮汐加速度）。 */
const geodesicDeviation = defineViz({
  slug: 'geodesic-deviation', title: '测地偏离与潮汐力', animated: true,
  params: {
    kind: { type: 'select', options: ['黑洞潮汐', '引力波扫过'], default: '黑洞潮汐', label: '场景' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const wave = String((params as Record<string, unknown>)['kind'] ?? '').includes('引力波');
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    if (wave) {
      // 引力波：圆环被交变拉伸（+与×极化交替）
      const amp = Math.sin(f.t * 3);
      const S = Math.min(w, h) * 0.3;
      const pts: [number, number][] = [];
      for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.06) {
        const rx = S * (1 + amp * 0.3 * Math.cos(2 * a));
        const ry = S * (1 - amp * 0.3 * Math.cos(2 * a));
        pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
      }
      poly(f, [...pts, pts[0]], { stroke: C.accent, lw: 2.8 });
      // 自由测试质量
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        const rx = S * (1 + amp * 0.3 * Math.cos(2 * a));
        const ry = S * (1 - amp * 0.3 * Math.cos(2 * a));
        dot(f, cx + rx * Math.cos(a), cy + ry * Math.sin(a), 6, C.warm);
      }
      text(f, '引力波：交变潮汐把圆环拉成椭圆再反向——LIGO 的4km臂长伸缩 10⁻²¹', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    } else {
      // 黑洞潮汐：纵向拉伸横向压缩（面条化）
      const dist = (f.t * 0.5) % 1;
      const px = w * 0.8 - dist * (w * 0.5);
      const stretch = 1 + (1 - dist) * 2.4;
      const squeeze = 1 / Math.sqrt(stretch);
      f.ctx.save();
      f.ctx.translate(px, cy);
      f.ctx.scale(squeeze, stretch);
      f.ctx.beginPath();
      f.ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
      f.ctx.fillStyle = 'rgba(66,153,225,0.6)'; f.ctx.fill();
      f.ctx.restore();
      dot(f, w * 0.86, cy, 12, C.warm);
      text(f, '靠近视界：纵向拉伸横向压缩——"意大利面化"', 30, 44, { color: C.hot, font: '13px sans-serif' });
      // 潮汐箭头
      seg(f, px, cy - 60, px, cy - 30, C.hot, 2.4);
      seg(f, px, cy + 60, px, cy + 30, C.hot, 2.4);
      seg(f, px - 50, cy, px - 26, cy, C.cool, 2.4);
      seg(f, px + 26, cy, px + 50, cy, C.cool, 2.4);
    }
    text(f, 'R^μ_{νρσ} 决定邻近测地线的分离率——曲率就是潮汐', 30, h - 34, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      "测地偏离方程 D²ξ^μ/dτ² = −R^μ_{νρσ}u^ν ξ^ρ u^σ：曲率直接度量'分开走'的加速度",
      '潮汐力是曲率的可观测体现——中子星在 8 倍太阳质量黑洞前的潮汐半径内被撕碎',
      '引力波的"+与×"两种极化本质是交变潮汐模式——LIGO 臂的伸缩即测地偏离',
    ]);
    heading(f, '测地偏离：曲率让邻近轨迹分开');
  },
});
registerViz(geodesicDeviation);
