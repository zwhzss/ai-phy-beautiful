import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, clear, curve, dot, footnotes, grid, heading, poly, rng, seg, text, view } from '../canvas';

/** P23 时空弯曲（2D 解释版）：质量凹陷剖面与测地线。 */
const spacetimeBending = defineViz({
  slug: 'spacetime-bending',
  title: '时空弯曲与测地线',
  params: {
    M: { type: 'range', min: 0.5, max: 3, default: 1.4, step: 0.1, label: '中心质量 M（教学单位）' },
    orbit: { type: 'range', min: 2, max: 8, default: 4, step: 0.5, label: '轨道半径 r' },
  },
  draw: (f) => {
    const { params } = f;
    const M = num(params, 'M', 1.4);
    const r0 = num(params, 'orbit', 4);
    const well = (r: number): number => -((M * 2.2) / (0.5 + r * 0.6));

    const v = view(f, { xMin: -9, xMax: 9, yMin: -4.4, yMax: 1.4, inset: 44 });
    grid(f, v, { divisions: 5, ticks: true });
    // 凹陷剖面（左右对称）
    curve(f, v, (x) => well(Math.abs(x)), { color: C.accent, lw: 2.6, samples: 300 });
    // 中心质量
    dot(f, v.sx(0), v.sy(well(0)), 12, C.warm);
    text(f, 'M', v.sx(0), v.sy(well(0)) + 4, { align: 'center', color: '#1a202c', font: '12px sans-serif' });
    // 测地线（轨道位置）
    seg(f, v.sx(-r0), v.sy(well(r0)), v.sx(r0), v.sy(well(r0)), `${C.green}77`, 1.2);
    dot(f, v.sx(-r0), v.sy(well(r0)), 6, C.green);
    dot(f, v.sx(r0), v.sy(well(r0)), 6, C.green);
    text(f, `r = ${r0}`, v.sx(r0) + 6, v.sy(well(r0)) - 8, { color: C.green, font: '12px sans-serif' });

    footnotes(f, [
      `凹陷深度 ∝ M/r（教学示意剖面，非史瓦西解）：质量越大、越近，时空弯曲越强`,
      '自由物体沿弯曲时空的测地线运动 —— "引力"不是力，而是几何效应（爱因斯坦等效原理）',
      '光线同样走测地线：1919 年日食观测到星光偏折，与广义相对论预言一致（双星 PSR B1913+16 轨道衰减亦验证引力波）',
    ]);
    heading(f, '质量弯曲时空（剖面示意）');
  },
});
registerViz(spacetimeBending);

/** P24 黑洞与吸积盘（2D 解释版）：史瓦西半径与光子环。 */
const blackholeAccretion = defineViz({
  slug: 'blackhole-accretion',
  title: '黑洞与吸积盘',
  params: {
    rs: { type: 'range', min: 0.6, max: 2.2, default: 1.2, step: 0.05, label: '史瓦西半径 r_s (cm 示意)' },
    tilt: { type: 'range', min: 5, max: 45, default: 18, step: 1, label: '盘面倾角 (°)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const rs = num(params, 'rs', 1.2);
    const tilt = (num(params, 'tilt', 18) * Math.PI) / 180;

    clear(f);
    const cx = w / 2, cy = h / 2 + 4;
    const R = Math.min(w, h) * 0.36;
    const rS = R * (rs / 2.2);

    // 吸积盘（透视椭圆环带）
    const ctx2 = f.ctx;
    for (let ring = 0; ring < 14; ring++) {
      const rr = rS * (1.55 + ring * 0.16);
      const alpha = 0.6 - ring * 0.035;
      ctx2.beginPath();
      ctx2.ellipse(cx, cy, rr, rr * Math.sin(tilt) + 3, 0, 0, Math.PI * 2);
      const hue = 30 - ring * 1.6;
      ctx2.strokeStyle = `hsla(${hue}, 95%, ${58 - ring}%, ${Math.max(alpha, 0.1)})`;
      ctx2.lineWidth = 3.2;
      ctx2.stroke();
    }
    // 事件视界（黑球）
    ctx2.beginPath();
    ctx2.arc(cx, cy, rS, 0, Math.PI * 2);
    ctx2.fillStyle = '#000';
    ctx2.fill();
    ctx2.strokeStyle = `${C.dim}88`;
    ctx2.lineWidth = 1;
    ctx2.stroke();
    // 光子环
    ctx2.beginPath();
    ctx2.arc(cx, cy, rS * 1.14, 0, Math.PI * 2);
    ctx2.strokeStyle = '#ffd27a';
    ctx2.lineWidth = 2;
    ctx2.stroke();
    // 标注
    seg(f, cx, cy, cx + rS, cy, C.cyan, 1.4);
    text(f, `r_s = 2GM/c²`, cx + rS + 6, cy - 8, { color: C.cyan, font: '12px sans-serif' });
    text(f, '光子环 1.5 r_s', cx + rS * 1.5 + 6, cy + rS * 1.2, { color: '#ffd27a', font: '11px sans-serif' });
    text(f, '吸积盘（多普勒增亮：迎面侧更亮）', 24, h - 56, { color: C.warm, font: '11px sans-serif' });

    footnotes(f, [
      '事件视界内光也无法逃逸；史瓦西半径 r_s = 2GM/c²，太阳约 3 km、地球约 9 mm',
      '吸积盘气体被加热至 10⁶ K 发出 X 射线；内缘最短稳定圆轨道 ISCO = 3 r_s（史瓦西度规）',
      'EHT 2019 年拍到的 M87* 阴影直径约 2.6×（2√3 GM/c² 的光子捕获截面），与广义相对论一致',
    ]);
    heading(f, '黑洞结构：视界、光子环与吸积盘');
  },
});
registerViz(blackholeAccretion);

/** P25 引力波涟漪（2D 解释版）：应变波形与传播。 */
const gwRipple = defineViz({
  slug: 'gw-ripple',
  title: '引力波与应变波形',
  animated: true,
  params: {
    f0: { type: 'range', min: 20, max: 80, default: 35, step: 1, label: '起始频率 (Hz)' },
    mchirp: { type: 'range', min: 10, max: 60, default: 28, step: 1, label: '啁啾质量 (M☉)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const f0 = num(params, 'f0', 35);
    const mc = num(params, 'mchirp', 28);

    clear(f);
    // 上：波形 h(t)
    const x0 = 50, x1 = w - 30, yTop = 64, yMid = h * 0.52;
    const T = 0.55;
    const sx = (t: number) => x0 + (t / T) * (x1 - x0);
    const sy = (hv: number) => yMid - hv * (yMid - yTop);
    seg(f, x0, yMid, x1, yMid, C.grid, 1.2);
    // 包络
    const env: [number, number][] = [];
    const wave: [number, number][] = [];
    let phase = 0;
    for (let i = 0; i <= 420; i++) {
      const t = (i / 420) * T;
      // 简化啁啾：频率随时间上升（质量越大演化越快）
      const tau = Math.max(0, 0.42 - t);
      const fr = f0 * (0.6 + (0.42 - tau) / 0.42 * 6) * (30 / mc) ** 0.6;
      phase += 2 * Math.PI * fr * 0.0013;
      const amp = (0.15 + 0.85 * (1 - tau / 0.42) ** 0.5) * 0.9;
      env.push([sx(t), sy(amp)]);
      env.unshift([sx(t), sy(-amp)]);
      wave.push([sx(t), sy(amp * Math.cos(phase))]);
    }
    poly(f, env, { stroke: `${C.warm}66`, lw: 1.2, dash: [5, 4] } as any);
    poly(f, wave, { stroke: C.cyan, lw: 2.2 });
    // 并合标记
    seg(f, sx(0.42), yTop, sx(0.42), yMid + 56, `${C.hot}aa`, 1.2);
    text(f, '并合', sx(0.42) + 6, yTop + 4, { color: C.hot, font: '11px sans-serif' });
    text(f, 'h(t) 应变（理论模板）', x0 + 4, yTop - 12, { color: C.cyan, font: '12px sans-serif' });

    // 下：俯视涟漪（同心波纹示意，动画）
    const cx = w / 2, cy = h * 0.78;
    for (let k = 0; k < 5; k++) {
      const r = ((f.t * 46 + k * 42) % 210) + 8;
      const alpha = Math.max(0.06, 0.5 - r / 260);
      f.ctx.beginPath();
      f.ctx.ellipse(cx, cy, r, r * 0.32, 0, 0, Math.PI * 2);
      f.ctx.strokeStyle = `rgba(122, 215, 255, ${alpha})`;
      f.ctx.lineWidth = 1.6;
      f.ctx.stroke();
    }
    dot(f, cx - 10, cy, 5, C.cool);
    dot(f, cx + 10, cy, 5, C.warm);

    footnotes(f, [
      `双致密星旋进：频率上升（chirp）直至并合；啁啾质量 M_c ≈ ${mc} M☉ 决定演化快慢`,
      '应变 h ~ ΔL/L ≈ 10⁻²¹：LIGO 4 km 臂长变化不到质子直径的千分之一（GW150914 实测）',
      '引力波以光速传播、携带能量：双星 PSR B1913+16 轨道衰减与广义相对论预言逐年吻合（1993 诺贝尔奖）',
    ]);
    heading(f, '引力波：旋进波形与时空涟漪');
  },
});
registerViz(gwRipple);

/** P26 宇宙网与大尺度结构（2D 解释版）。 */
const cosmicWeb2D = defineViz({
  slug: 'cosmic-web',
  title: '宇宙网与大尺度结构',
  params: {
    nodes: { type: 'range', min: 8, max: 40, default: 22, step: 1, label: '团簇节点数' },
    seed: { type: 'range', min: 1, max: 20, default: 7, step: 1, label: '模拟随机种子' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const nNodes = Math.round(num(params, 'nodes', 22));
    const seed = Math.round(num(params, 'seed', 7));
    const rand = rng(seed * 7919);

    clear(f);
    // 节点
    const nodes: [number, number][] = [];
    for (let i = 0; i < nNodes; i++) {
      nodes.push([40 + rand() * (w - 80), 46 + rand() * (h - 110)]);
    }
    // 纤维（节点间连线，短边连接）
    for (let i = 0; i < nodes.length; i++) {
      const dists = nodes
        .map((p, j) => ({ j, d: Math.hypot(p[0] - nodes[i][0], p[1] - nodes[i][1]) }))
        .filter((x) => x.j !== i)
        .sort((a, b) => a.d - b.d);
      for (const nb of dists.slice(0, 2)) {
        if (nb.d < 190) seg(f, nodes[i][0], nodes[i][1], nodes[nb.j][0], nodes[nb.j][1], `${C.accent}44`, 1);
      }
    }
    // 纤维上的星系点
    for (let i = 0; i < nodes.length; i++) {
      for (const nb of nodes.slice(i + 1)) {
        const d = Math.hypot(nb[0] - nodes[i][0], nb[1] - nodes[i][1]);
        if (d > 190) continue;
        const cnt = 5;
        for (let k = 1; k < cnt; k++) {
          const t = k / cnt + (rand() - 0.5) * 0.12;
          dot(
            f,
            nodes[i][0] + (nb[0] - nodes[i][0]) * t + (rand() - 0.5) * 9,
            nodes[i][1] + (nb[1] - nodes[i][1]) * t + (rand() - 0.5) * 9,
            1.6,
            `${C.cool}`,
          );
        }
      }
    }
    // 团簇节点（大亮点）
    nodes.forEach((p, i) => {
      dot(f, p[0], p[1], 5 + (i % 3) * 2, i % 2 ? C.accent : C.cyan);
    });
    text(f, '● 团簇节点（超星系团）　细线：纤维（星系分布沿暗物质骨架）　空白：空洞', 24, h - 34, { color: C.dim, font: '11px sans-serif' });

    footnotes(f, [
      '宇宙大尺度结构呈"宇宙网"：纤维—节点—空洞三要素，尺度 > 10 Mpc 时星系分布非随机',
      '结构来源：原初密度涨落（CMB 中 ±10⁻⁵）经引力不稳定性放大 138 亿年（N 体模拟可复现）',
      'SDSS / 2MSS 巡天的三维星系分布证实了这一形态——暗物质提供了看不见的"骨架"',
    ]);
    heading(f, '宇宙网：大尺度结构');
  },
});
registerViz(cosmicWeb2D);
