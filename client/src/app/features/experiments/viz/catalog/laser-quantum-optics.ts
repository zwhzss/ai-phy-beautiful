import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** 四能级激光。 */
const fourLevelLaser = defineViz({
  slug: 'four-level-laser', title: '四能级激光', animated: true,
  params: {
    pump: { type: 'range', min: 0, max: 2, default: 1, step: 0.1, label: '泵浦强度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const pump = num(params, 'pump', 1);
    clear(f);
    const x = w * 0.42;
    const levels: [string, number, string][] = [
      ['E₄（泵浦吸收带）', 0.16, C.hot],
      ['E₃（亚稳态·上能级）', 0.34, C.warm],
      ['E₂（下能级·快弛豫）', 0.68, C.cool],
      ['E₁（基态）', 0.86, C.green],
    ];
    for (const [label, t, color] of levels) {
      const y = h * t;
      seg(f, x - 150, y, x + 150, y, color, 3.4);
      text(f, label, x + 160, y + 4, { color, font: '12px sans-serif' });
    }
    const y4 = h * 0.16, y3 = h * 0.34, y2 = h * 0.68, y1 = h * 0.86;
    // 泵浦（闪烁箭头）
    const pumpA = 0.4 + 0.6 * Math.abs(Math.sin(f.t * 3));
    poly(f, [[x - 60, y1 - 6], [x - 60, y4 + 8], [x - 68, y4 + 8], [x - 52, y4 - 6], [x - 36, y4 + 8], [x - 44, y4 + 8], [x - 44, y1 - 6]],
      { stroke: 'transparent', fill: `rgba(255,80,80,${pumpA})` } as any);
    text(f, '泵浦', x - 92, (y1 + y4) / 2, { color: C.hot, font: '12px sans-serif' });
    // 快弛豫 E4→E3（无辐射）
    seg(f, x + 60, y4, x + 60, y3 + 6, `${C.dim}aa`, 2);
    text(f, '快弛豫', x + 70, (y4 + y3) / 2, { color: C.dim, font: '11px sans-serif' });
    // 激光跃迁 E3→E2（光子串）
    const ph = (f.t * 1.6) % 1;
    for (let k = 0; k < 3; k++) {
      const t = ((ph + k / 3) % 1);
      const yy = y3 + t * (y2 - y3);
      text(f, '⟩⟩', x - 8, yy, { color: C.green, font: '13px sans-serif' });
    }
    text(f, '受激辐射输出', x - 74, (y3 + y2) / 2 + 4, { color: C.green, font: '12px sans-serif' });
    seg(f, x - 60, y2, x - 60, y1 - 6, `${C.dim}aa`, 2);
    text(f, '泵浦强度 ' + pump.toFixed(1) + '：粒子数反转 n₃>n₂ 持续维持——增益大于损耗即起振', 30, 44, { color: C.cyan, font: "13px sans-serif" });

    footnotes(f, [
      '四能级比三能级优越：下能级 E₂ 被快速抽空，粒子数反转无需超过一半粒子',
      'Nd:YAG（1064nm）、红宝石（694nm）与光纤激光器都是这套能级的工程化身',
      '泵浦-反转-受激辐射-谐振放大——激光四要素在能级图上一目了然',
    ]);
    heading(f, '四能级激光：反转如何维持');
  },
});
registerViz(fourLevelLaser);

/** 粒子数反转。 */
const populationInversion = defineViz({
  slug: 'population-inversion', title: '粒子数反转', animated: true,
  params: {
    T: { type: 'range', min: 0.5, max: 10, default: 3, step: 0.5, label: '热平衡温度（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const T = num(params, 'T', 3);
    const inverted = f.t % 6 > 3; // 交替显示平衡/反转
    clear(f);
    const x0 = w * 0.24, y0 = h - 66;
    const up = inverted ? 7 : 3;
    const dn = inverted ? 3 : 7;
    // 能级与粒子（下能级/上能级）
    const yLow = y0 - 60, yHigh = y0 - 190;
    seg(f, x0 - 170, yHigh, x0 + 170, yHigh, C.warm, 3.4);
    seg(f, x0 - 170, yLow, x0 + 170, yLow, C.cool, 3.4);
    text(f, '上能级 E₂', x0 + 180, yHigh + 4, { color: C.warm, font: '12px sans-serif' });
    text(f, '下能级 E₁', x0 + 180, yLow + 4, { color: C.cool, font: '12px sans-serif' });
    for (let k = 0; k < dn; k++) dot(f, x0 - 120 + k * 40, yLow - 14, 8, C.cool);
    for (let k = 0; k < up; k++) dot(f, x0 - 120 + k * 40, yHigh + 14, 8, C.warm);
    text(f, inverted ? `反转！n₂(${up}) > n₁(${dn})：介质变增益（受激辐射>吸收）` : `热平衡 n₁(${dn}) > n₂(${up})：玻尔兹曼分布下只会吸收`,
      30, 44, { color: inverted ? C.green : C.hot, font: "14px sans-serif" });
    // 右侧光束对比
    const beamY = (yHigh + yLow) / 2;
    if (inverted) {
      for (let k = 0; k < 6; k++) {
        const x = w * 0.55 + ((f.t * 70 + k * 44) % (w * 0.4));
        text(f, '光', x, beamY + Math.sin(k) * 6, { color: C.green, font: "13px sans-serif" });
      }
      text(f, '光子每过一处“买一送一”地增殖', w * 0.55, beamY + 40, { color: C.green, font: "12px sans-serif" });
    } else {
      seg(f, w * 0.55, beamY, w * 0.9, beamY, `${C.dim}88`, 2.4);
      text(f, '入射光子被吸收（指数衰减）', w * 0.55, beamY + 34, { color: C.dim, font: "12px sans-serif" });
    }
    text(f, '爱因斯坦 A/B 系数：受激辐射率 ∝ 光子数——泵浦必须打破玻尔兹曼', 30, h - 30, { color: C.cyan, font: "12px sans-serif" });

    footnotes(f, [
      "热平衡下高能级永远人少——激光的前提是用泵浦把分布'推翻'一次",
      '1950 年珀塞尔-布洛赫实现氦核反转（磁共振），1960 年梅曼做出首台红宝石激光',
      '反转是耗散的：抽运速率必须持续大于自发衰减——激光是远离平衡的稳态',
    ]);
    heading(f, '粒子数反转：打破自然的分配');
  },
});
registerViz(populationInversion);

/** 激光谐振腔。 */
const laserCavity = defineViz({
  slug: 'laser-cavity', title: '激光谐振腔与纵模', animated: true,
  params: {
    L: { type: 'range', min: 10, max: 100, default: 30, step: 5, label: '腔长 L (cm)' },
    loss: { type: 'range', min: 0.01, max: 0.3, default: 0.05, step: 0.01, label: '单程损耗' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const L = num(params, 'L', 30), loss = num(params, 'loss', 0.05);
    const Nmodes = Math.floor((2 * L * 10 * 1.5e10) / 1); // 视觉化纵模数示意
    clear(f);
    const x0 = w * 0.18, x1 = w * 0.82, cy = h * 0.34;
    // 两面镜
    poly(f, [[x0, cy - 54], [x0 + 14, cy - 54], [x0 + 14, cy + 54], [x0, cy + 54]],
      { stroke: C.cool, lw: 2.4, fill: 'rgba(66,153,225,0.4)' } as any);
    poly(f, [[x1 - 14, cy - 54], [x1, cy - 54], [x1, cy + 54], [x1 - 14, cy + 54]],
      { stroke: C.cool, lw: 2.4, fill: 'rgba(66,153,225,0.25)' } as any);
    text(f, '全反镜', x0 - 24, cy - 66, { color: C.cool, font: '11px sans-serif' });
    text(f, '输出镜', x1 - 24, cy - 66, { color: C.cool, font: '11px sans-serif' });
    // 腔内驻波（来回放大）
    const gain = Math.max(0, 1 - loss * 6);
    for (let k = 1; k <= 3; k++) {
      const amp = 30 * Math.pow(gain, k - 1);
      const pts: [number, number][] = [];
      for (let i = 0; i <= 240; i++) {
        const x = x0 + (i / 240) * (x1 - x0);
        pts.push([x, cy + Math.sin(((x - x0) / (x1 - x0)) * Math.PI * 12) * amp * Math.sin(f.t * 5 + k)]);
      }
      poly(f, pts, { stroke: `rgba(66,153,225,${0.85 - k * 0.22})`, lw: 1.8 });
    }
    // 输出光束
    for (let k = 0; k < 4; k++) {
      const x = x1 + 20 + ((f.t * 60 + k * 34) % (w * 0.14));
      text(f, '光', x, cy, { color: C.green, font: '13px sans-serif' });
    }
    // 纵模谱（下）
    const y0 = h - 56, y1 = h * 0.6;
    const vv = view(f, { xMin: 0, xMax: 10, yMin: 0, yMax: 1.2, inset: 46 });
    grid(f, vv, { divisions: 4, ticks: true });
    const envelope: [number, number][] = [];
    const modes: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const x = (i / 300) * 10;
      const g = Math.exp(-Math.pow((x - 5) / 2.6, 2));
      envelope.push([vv.sx(x), vv.sy(g)]);
    }
    poly(f, envelope, { stroke: `${C.warm}77`, lw: 1.6, dash: [6, 4] } as any);
    void y0; void y1; void modes; void Nmodes;
    const spacing = 2 * L / 100;
    for (let n = 1; n <= 7; n++) {
      const x = 5 + (n - 4) * spacing * 1.4;
      if (x < 0.3 || x > 9.7) continue;
      const g = Math.exp(-Math.pow((x - 5) / 2.6, 2));
      if (g < 0.05) continue;
      const flick = 0.7 + 0.3 * Math.sin(f.t * 3 + n);
      poly(f, [[vv.sx(x), vv.sy(0)], [vv.sx(x), vv.sy(g * flick)]], { stroke: 'transparent', fill: C.cyan } as any);
      seg(f, vv.sx(x), vv.sy(0), vv.sx(x), vv.sy(g * flick), C.cyan, 2.2);
    }
    text(f, `L=${L}cm：纵模间隔 Δν=c/2L≈${(1.5e10 / L).toFixed(0)}Hz——增益曲线内站得下的模式`, 30, 44, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '谐振腔三重职责：选频（纵模）、聚能（来回放大）、准直（几何损耗小）',
      '单模激光靠短腔或标准具挑出一根纵模——线宽可达 Hz 级（精密测量的尺子）',
      '锁模把纵模相位对齐，输出飞秒脉冲——啁啾脉冲放大获 2018 诺贝尔物理学奖',
    ]);
    heading(f, '激光谐振腔：光的选频放大器');
  },
});
registerViz(laserCavity);

/** 相干态。 */
const coherentState = defineViz({
  slug: 'coherent-state', title: '相干态', animated: true,
  params: {
    alpha: { type: 'range', min: 0.5, max: 6, default: 3, step: 0.1, label: '|α|（光子数幅）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const al = num(params, 'alpha', 3);
    const nMean = al * al;
    clear(f);
    // 相空间中的相干态（复平面圆盘旋转）
    const cx = w * 0.3, cy = h / 2 + 16;
    const R = Math.min(w, h) * 0.3;
    seg(f, cx - R * 1.1, cy, cx + R * 1.1, cy, C.grid, 1.3);
    seg(f, cx, cy - R * 1.1, cx, cy + R * 1.1, C.grid, 1.3);
    text(f, 'Re(α)', cx + R * 1.1 - 40, cy - 8, { color: C.dim, font: '11px sans-serif' });
    text(f, 'Im(α)', cx + 8, cy - R * 1.1 + 4, { color: C.dim, font: '11px sans-serif' });
    // 相干态圆盘（半径=量子不确定 1/2）沿圆轨道进动
    const phi = f.t * 1.2;
    const px = cx + Math.cos(phi) * al * (R / 6.5);
    const py = cy + Math.sin(phi) * al * (R / 6.5);
    const unc = 26;
    f.ctx.beginPath(); f.ctx.arc(px, py, unc, 0, Math.PI * 2);
    f.ctx.fillStyle = 'rgba(66,153,225,0.30)'; f.ctx.fill();
    f.ctx.strokeStyle = C.cool; f.ctx.lineWidth = 2.4; f.ctx.stroke();
    dot(f, px, py, 6, C.warm);
    text(f, '不确定圆（ΔxΔp=½）：相干态最接近经典', px - 96, py - unc - 12, { color: C.cool, font: '11px sans-serif' });
    // 光子数分布（泊松）
    const x0 = w * 0.58, y0 = h - 56, y1 = 70;
    seg(f, x0, y0, w - 40, y0, C.grid, 1.2);
    seg(f, x0, y0, x0, y1, C.grid, 1.2);
    let maxP = 0;
    const ps: number[] = [];
    for (let n = 0; n <= Math.ceil(nMean + 4 * Math.sqrt(nMean) + 4); n++) {
      let logP = -nMean;
      for (let k = 2; k <= n; k++) logP -= Math.log(k);
      const p = Math.exp(logP);
      ps.push(p);
      if (p > maxP) maxP = p;
    }
    for (let n = 0; n < ps.length; n++) {
      const bx = x0 + 16 + n * ((w - 40 - x0 - 30) / Math.max(ps.length - 1, 1));
      const bh = (ps[n] / maxP) * (y0 - y1);
      seg(f, bx, y0, bx, y0 - bh, C.green, 6);
    }
    text(f, `⟨n⟩=|α|²=${nMean.toFixed(1)}：泊松分布（Δn=√⟨n⟩）`, x0 + 6, y1 - 8, { color: C.green, font: '12px sans-serif' });
    text(f, `相干态=激光场的量子态：最小不确定+经典相位`, 30, 44, { color: C.cyan, font: '14px sans-serif' });

    footnotes(f, [
      "相干态是 a 的本征态：a|α⟩=α|α⟩——算符语言里的'最像经典波'的量子态",
      '光子数服从泊松分布：散粒噪声 Δn=√n 就是这份量子不确定的可观测面貌',
      'Glauber 2005 因相干态与光的量子理论获诺贝尔奖——激光的量子身份证',
    ]);
    heading(f, '相干态：量子与经典的握手点');
  },
});
registerViz(coherentState);

/** 压缩态。 */
const squeezedState = defineViz({
  slug: 'squeezed-state', title: '压缩态', animated: true,
  params: {
    r: { type: 'range', min: 0, max: 2, default: 1, step: 0.05, label: '压缩参数 r' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const r = num(params, 'r', 1);
    clear(f);
    const cx = w * 0.3, cy = h / 2 + 16;
    const R = Math.min(w, h) * 0.3;
    seg(f, cx - R * 1.2, cy, cx + R * 1.2, cy, C.grid, 1.3);
    seg(f, cx, cy - R * 1.2, cx, cy + R * 1.2, C.grid, 1.3);
    text(f, 'X（振幅）', cx + R * 1.2 - 56, cy - 8, { color: C.dim, font: '11px sans-serif' });
    text(f, 'P（相位）', cx + 8, cy - R * 1.2 + 4, { color: C.dim, font: '11px sans-serif' });
    // 相干圆（参考）
    f.ctx.beginPath(); f.ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    f.ctx.setLineDash([5, 4]);
    f.ctx.strokeStyle = `${C.dim}aa`; f.ctx.lineWidth = 1.6; f.ctx.stroke();
    f.ctx.setLineDash([]);
    // 压缩椭圆（旋转摆动）
    const squeeze = Math.exp(r), anti = Math.exp(-r);
    f.ctx.save();
    f.ctx.translate(cx, cy);
    f.ctx.rotate(Math.sin(f.t * 0.7) * 0.3);
    f.ctx.beginPath();
    f.ctx.ellipse(0, 0, 30 * squeeze, 30 * anti, 0, 0, Math.PI * 2);
    f.ctx.fillStyle = 'rgba(16,185,129,0.24)'; f.ctx.fill();
    f.ctx.strokeStyle = C.green; f.ctx.lineWidth = 2.6; f.ctx.stroke();
    f.ctx.restore();
    text(f, '虚线=相干态极限（圆）：压缩把一个正交分量压到圆内', cx - 120, cy + 90, { color: C.dim, font: '11px sans-serif' });
    // 不确定度条
    const x0 = w * 0.6, y0 = h - 60, y1 = 90;
    const dX = 30 * squeeze, dP = 30 * anti;
    seg(f, x0, y0 - 40, x0 + dX * 2, y0 - 40, C.cool, 9);
    text(f, `ΔX = e^r·½ = ${(squeeze / 2).toFixed(2)}`, x0 + dX * 2 + 12, y0 - 36, { color: C.cool, font: '12px sans-serif' });
    seg(f, x0, y0 - 90, x0 + dP * 2, y0 - 90, C.warm, 9);
    text(f, `ΔP = e^(−r)·½ = ${(anti / 2).toFixed(2)}`, x0 + dP * 2 + 12, y0 - 86, { color: C.warm, font: '12px sans-serif' });
    text(f, `乘积 ΔX·ΔP = ¼（≥海森堡极限）：r=${r.toFixed(1)}`, x0, y1, { color: C.green, font: '14px sans-serif' });
    void y1;

    footnotes(f, [
      '压缩不违反不确定性——把噪声从一个分量挪到另一个：此消彼长、总量守恒',
      'LIGO 已用压缩真空注入把干涉仪量子噪声再降 3dB——引力波灵敏度的量子升级',
      '压缩光是连续变量量子通信与量子计量的核心资源（2023 年相关工作引人瞩目）',
    ]);
    heading(f, '压缩态：重新分配真空噪声');
  },
});
registerViz(squeezedState);

/** 光子反聚束。 */
const photonAntibunching = defineViz({
  slug: 'photon-antibunching', title: '光子反聚束', animated: true,
  params: {
    kind: { type: 'select', options: ['热光（聚束）', '单光子源（反聚束）'], default: '单光子源（反聚束）', label: '光源' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const single = String((params as Record<string, unknown>)['kind'] ?? '').includes('单光子');
    clear(f);
    // 探测时间直方图 g²(τ)
    const x0 = 70, y0 = h - 66, y1 = 84;
    const vv = view(f, { xMin: -4, xMax: 4, yMin: 0, yMax: 1.3, inset: 50 });
    grid(f, vv, { divisions: 4, ticks: true });
    const g2 = single
      ? (tau: number): number => 1 - Math.exp(-(Math.abs(tau) ** 1.4) * 1.6)
      : (tau: number): number => 1 + Math.exp(-(Math.abs(tau) ** 1.4) * 1.6) * (Math.cos(tau * 3) * 0 + 1);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const tau = -4 + (i / 300) * 8;
      pts.push([vv.sx(tau), vv.sy(g2(tau))]);
    }
    poly(f, pts, { stroke: single ? C.green : C.hot, lw: 3 });
    seg(f, vv.sx(0), y1, vv.sx(0), y0, `${C.dim}aa`, 1.4);
    seg(f, vv.sx(-4), vv.sy(1), vv.sx(4), vv.sy(1), `${C.warm}aa`, 1.4);
    text(f, 'g²(0)=1（相干光基准线）', vv.sx(2), vv.sy(1) - 8, { color: C.warm, font: '11px sans-serif' });
    void y1;
    text(f, single ? 'g²(0)=0：两个探测器不会同时响——光子“一个一个来”' : 'g²(0)>1：热光爱扎堆（聚束）——灯泡的光子统计',
      30, 44, { color: single ? C.green : C.hot, font: "14px sans-serif" });
    // 探测器示意
    const dy = h * 0.68;
    for (const dx of [w * 0.66, w * 0.8]) {
      poly(f, [[dx, dy - 22], [dx + 40, dy - 22], [dx + 40, dy + 22], [dx, dy + 22]],
        { stroke: C.cool, lw: 2, fill: 'rgba(66,153,225,0.16)' } as any);
      text(f, 'SPD', dx + 4, dy + 5, { color: C.cool, font: '11px sans-serif' });
    }
    text(f, 'HBT 分束器符合计数——单光子源的判决性实验', w * 0.64, dy + 44, { color: C.dim, font: '11px sans-serif' });

    footnotes(f, [
      'g²(0)<1 是单光子源的铁证：不可分割性由符合计数为零来证明（HBT，1950s）',
      '热光 g²(0)=2（聚束）、激光 g²(0)=1、单光子 g²(0)=0——光的三副面孔',
      "单光子源是量子密钥分发与量子计算的光子'弹药'——量子信息的基础设施",
    ]);
    heading(f, '光子反聚束：一个一个来的光');
  },
});
registerViz(photonAntibunching);

/** 散粒噪声。 */
const shotNoise = defineViz({
  slug: 'shot-noise', title: '散粒噪声', animated: true,
  params: {
    I: { type: 'range', min: 1, max: 100, default: 25, step: 1, label: '平均电流/光强 (相对)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const I = num(params, 'I', 25);
    const snr = Math.sqrt(I);
    clear(f);
    // 时间信号（离散粒子导致的涨落）
    const x0 = 60, yMid = h * 0.36;
    seg(f, x0, yMid, w - 40, yMid, `${C.grid}aa`, 1.3);
    const sig: [number, number][] = [];
    const rand = (i: number): number => Math.abs(Math.sin(i * 91.7 + f.t * 3) * 43758.5) % 1;
    for (let i = 0; i <= 300; i++) {
      const x = x0 + (i / 300) * (w - 100);
      const noise = (rand(i) - 0.5) * 2 * (30 / Math.sqrt(I));
      sig.push([x, yMid - 30 - noise]);
    }
    poly(f, sig, { stroke: C.cool, lw: 1.8 });
    text(f, `信号 ${I} ± ${ (30 / Math.sqrt(I)).toFixed(1) }：噪声∝√I — 信噪比∝√I`, 30, 44, { color: C.cyan, font: "14px sans-serif" });
    // √N 统计（右下直方图）
    const hx = w * 0.6, hy = h - 60, hy1 = h * 0.6;
    seg(f, hx, hy, w - 40, hy, C.grid, 1.2);
    for (let k = -6; k <= 6; k++) {
      const p = Math.exp(-(k * k) / 6);
      const bx = hx + 30 + (k + 6) * ((w - 40 - hx - 60) / 12);
      const bh = p * (hy - hy1) * 0.9;
      seg(f, bx, hy, bx, hy - bh, C.warm, 6);
    }
    text(f, '粒子计数的泊松统计：⟨N⟩=N、σ=√N', hx + 6, hy1 - 8, { color: C.warm, font: '12px sans-serif' });
    text(f, `信噪比 = ${snr.toFixed(1)}（∝√光强）——想更清晰就加光子，这是量子的税`, 30, h - 26, { color: C.green, font: "13px sans-serif" });

    footnotes(f, [
      '散粒噪声源于电荷/光子的离散性：即使完美放大器也消不掉这份量子底噪',
      '天文自适应光学用光子计数极限标定曝光：暗弱天体的像质被 √N 卡住',
      "压缩光正是要'挪走'这份噪声的量子手段——突破标准量子极限（SQL）",
    ]);
    heading(f, '散粒噪声：离散性交的税');
  },
});
registerViz(shotNoise);
