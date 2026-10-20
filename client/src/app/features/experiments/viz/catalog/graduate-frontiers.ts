import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text } from '../canvas';

/** P37 卡门涡街。 */
const vortexStreet = defineViz({
  slug: 'vortex-street',
  title: '卡门涡街',
  animated: true,
  params: {
    Re: { type: 'range', min: 20, max: 300, default: 120, step: 5, label: '雷诺数 Re（×10）' },
    U: { type: 'range', min: 0.5, max: 3, default: 1.5, step: 0.1, label: '来流速度 U' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const Re = num(params, 'Re', 120);
    const U = num(params, 'U', 1.5);

    clear(f);
    const cx = w * 0.26, cy = h / 2 + 6, R = 22;
    const shedding = Re > 47; // 层流→涡脱落
    const St = 0.21;
    const fs = St * U / (2 * R) * 60; // 脱落频率（示意缩放）

    // 来流流线（绕圆柱弯曲）
    for (let ly = -3; ly <= 3; ly++) {
      const yBase = cy + ly * 34;
      const pts: [number, number][] = [];
      for (let x = 30; x < w - 24; x += 6) {
        let dy = 0;
        const dx = x - cx;
        if (Math.abs(yBase - cy) < R * 3.2) {
          dy = (yBase < cy ? -1 : 1) * (R * R * 1.4) / Math.max(Math.hypot(dx, yBase - cy), R) * Math.sign(Math.abs(yBase - cy) || 1);
        }
        pts.push([x, yBase + (Math.abs(yBase - cy) < R * 3.4 ? dy * 0.4 : 0)]);
      }
      poly(f, pts, { stroke: `${C.cool}3a`, lw: 1.1 });
    }
    // 圆柱
    dot(f, cx, cy, R, C.dim);
    dot(f, cx, cy, R - 6, `${C.panel}`);
    text(f, `Re ≈ ${(Re * 10).toFixed(0)}`, cx - 26, cy - R - 14, { color: C.cyan, font: '12px sans-serif' });

    // 下游交替涡旋
    if (shedding) {
      const nV = 9;
      for (let i = 0; i < nV; i++) {
        const age = (f.t * fs + i / nV) % 1;
        const x = cx + R + 20 + age * (w - cx - R - 60);
        const side = i % 2 === 0 ? 1 : -1;
        const y = cy + side * (26 + age * 8);
        const r = 9 + age * 7;
        const alpha = Math.max(0.15, 0.75 - age * 0.6);
        const pts: [number, number][] = [];
        const spin = side * (f.t * 5 + i);
        for (let a = 0; a <= Math.PI * 2 * 0.85; a += 0.25) {
          pts.push([x + Math.cos(a + spin) * r, y + Math.sin(a + spin) * r * 0.8]);
        }
        poly(f, pts, { stroke: `rgba(102,126,234,${alpha})`, lw: 2.2 });
        text(f, side > 0 ? '↻' : '↺', x - 5, y + 4, { color: `rgba(163,191,255,${alpha})`, font: '12px sans-serif' });
      }
      text(f, '交替脱落的涡旋（Strouhal 数 St ≈ 0.21）', w * 0.5, h - 30, { color: C.warm, font: '12px sans-serif' });
    } else {
      text(f, 'Re 过低：附着流动，无涡脱落', w * 0.5, h - 30, { color: C.dim, font: '12px sans-serif' });
    }

    footnotes(f, [
      `来流 U = ${U}：圆柱绕流在 Re ≈ 47 后出现周期性涡脱落，频率 f = St·U/D`,
      '涡交替施加横向周期力——1940 年塔科马海峡大桥共振坍塌的元凶（虽有争议，但抖振是真实设计约束）',
      '热线风速仪、涡街流量计反而利用它：数一数涡的个数就知道流速——不稳定成为仪表',
    ]);
    heading(f, '卡门涡街：流动失稳与周期脱落');
  },
});
registerViz(vortexStreet);

/** P41 爱因斯坦环与引力透镜。 */
const gravitationalLensing = defineViz({
  slug: 'gravitational-lensing',
  title: '爱因斯坦环与引力透镜',
  animated: true,
  params: {
    mass: { type: 'range', min: 0.2, max: 1.5, default: 0.8, step: 0.05, label: '前景质量（相对 M）' },
    align: { type: 'range', min: 0, max: 1, default: 1, step: 0.02, label: '对准程度（1=完全共线）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const M = num(params, 'mass', 0.8);
    const align = num(params, 'align', 1);

    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    // 背景星场
    const starRand = (i: number): number => Math.abs(Math.sin(i * 127.1) * 43758.5453) % 1;
    for (let i = 0; i < 40; i++) {
      const sx = 24 + starRand(i) * (w - 48);
      const sy = 30 + starRand(i + 99) * (h - 70);
      dot(f, sx, sy, 1.6 + starRand(i + 7) * 1.6, `${C.dim}aa`);
    }
    // 爱因斯坦环半径 ∝ √M
    const thetaE = 26 + M * 46;
    const ringPts: [number, number][] = [];
    const fullRing = align > 0.85;
    const arc = fullRing ? Math.PI * 2 : Math.PI * 2 * (0.25 + align * 0.6);
    for (let a = 0; a <= arc; a += 0.05) {
      ringPts.push([cx + Math.cos(a + f.t * 0.15) * thetaE, cy + Math.sin(a + f.t * 0.15) * thetaE]);
    }
    // 前景质量（暗星系/星系团）
    dot(f, cx, cy, 12 + M * 8, `${C.warm}55`);
    dot(f, cx, cy, 6, C.warm);
    text(f, '前景质量（透镜）', cx + 18, cy + 6, { color: C.warm, font: '11px sans-serif' });
    // 环/弧
    poly(f, ringPts, { stroke: C.cyan, lw: fullRing ? 3.4 : 2.6 });
    // 光线弯折示意（背景源→透镜→观察者折线）
    const srcX = cx + thetaE * 2.1, srcY = cy - thetaE * 1.1;
    dot(f, srcX, srcY, 4, C.cool);
    text(f, '背景光源', srcX + 8, srcY, { color: C.cool, font: '11px sans-serif' });
    seg(f, srcX, srcY, cx + thetaE * 0.5, cy - thetaE * 0.5, `${C.cool}77`, 1.2);
    seg(f, cx + thetaE * 0.5, cy - thetaE * 0.5, cx - thetaE * 1.4, cy + thetaE * 1.3, `${C.cool}77`, 1.2);
    text(f, fullRing ? '完全共线 → 爱因斯坦环' : '部分对齐 → 弧状像（星系弧）', cx - 90, h - 34, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      `前景质量 M = ${M}（相对）：环半径 θ_E ∝ √M——称出暗物质质量的'天平'`,
      '引力透镜三类：强透镜（环/多重像）、弱透镜（背景星系剪切畸变统计）、微透镜（亮度随时间变化，用于找系外行星与暗物质）',
      'EHT 的 M87* 阴影、星系团 Abell 370 的弧、ELASTIS/LSST 巡天的暗物质称量都靠光线偏折这门技术',
    ]);
    heading(f, '引力透镜：时空充当望远镜');
  },
});
registerViz(gravitationalLensing);

/** P43 受激辐射与激光原理。 */
const stimulatedEmission = defineViz({
  slug: 'stimulated-emission',
  title: '受激辐射与激光原理',
  animated: true,
  params: {
    pump: { type: 'range', min: 0, max: 1, default: 0.7, step: 0.05, label: '泵浦强度（粒子数反转度）' },
    photons: { type: 'range', min: 1, max: 8, default: 3, step: 1, label: '入射光子数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const pump = num(params, 'pump', 0.7);
    const nIn = Math.round(num(params, 'photons', 3));

    clear(f);
    // 三能级图
    const ex = w * 0.62, ey0 = h - 90, gap = h * 0.3;
    const yE1 = ey0, yE2 = ey0 - gap * 0.55, yE3 = ey0 - gap;
    for (const [y, label, color] of [[yE3, 'E₃（泵浦吸收带）', C.warm], [yE2, 'E₂（亚稳态 · 反转）', C.hot], [yE1, 'E₁（基态）', C.cool]] as [number, string, string][]) {
      seg(f, ex - 130, y, ex + 130, y, color, 3);
      text(f, label, ex + 140, y + 4, { color, font: '11px sans-serif' });
    }
    // 泵浦箭头（E1→E3）
    seg(f, ex - 60, yE1, ex - 60, yE3, `${C.warm}cc`, 2);
    text(f, '泵浦', ex - 54, (yE1 + yE3) / 2, { color: C.warm, font: '11px sans-serif' });
    // 粒子分布（E2 上的粒子数随 pump 增多）
    const nUp = Math.round(pump * 7);
    for (let i = 0; i < nUp; i++) dot(f, ex + 40 + i * 22, yE2 - 12, 6, C.hot);
    for (let i = 0; i < 7 - nUp; i++) dot(f, ex + 40 + i * 22, yE1 - 12, 6, C.cool);
    text(f, `N₂/N₁ 粒子数${nUp >= 4 ? '反转 ✓（增益 > 损耗）' : '未反转（净吸收）'}`, ex - 120, yE2 - 34, { color: nUp >= 4 ? C.green : C.dim, font: '12px sans-serif' });

    // 左侧：入射光子 → 放大输出（动画光子列）
    const laneY = h * 0.5;
    const t = f.t;
    for (let i = 0; i < nIn; i++) {
      const phase = ((t * 0.5 + i * 0.18) % 1);
      const px = 40 + phase * (w * 0.5);
      // 光子波浪
      const wv: [number, number][] = [];
      for (let k = 0; k <= 14; k++) {
        wv.push([px + k * 3, laneY + Math.sin(k * 1.1 + t * 6) * 7 - i * 16]);
      }
      poly(f, wv, { stroke: C.cyan, lw: 1.8 });
      // 受激后复制的光子（增益区后多一列）
      if (nUp >= 4 && px > w * 0.3) {
        const wv2: [number, number][] = wv.map(([x, y]) => [x, y + 12]);
        poly(f, wv2, { stroke: `${C.cyan}77`, lw: 1.4 });
      }
    }
    text(f, '一个光子进来、两个全同光子出去（受激辐射：同方向、同频率、同相位）', 34, 40, { color: C.cyan, font: '11px sans-serif' });
    // 谐振腔
    seg(f, 30, laneY + 66, w * 0.56, laneY + 66, `${C.dim}aa`, 3);
    seg(f, 30, laneY - 96, w * 0.56, laneY - 96, `${C.dim}aa`, 3);
    text(f, '光学谐振腔（反馈 + 选模）', 36, laneY + 84, { color: C.dim, font: '10px sans-serif' });

    footnotes(f, [
      `泵浦 = ${pump}：爱因斯坦 1917 年给出 A/B 系数与受激辐射；实现激光还需粒子数反转 + 谐振腔超过阈值`,
      '输出光的三大特性：单色性（能级差唯一）、相干性（受激复制相位）、方向性（腔模限定）',
      '1960 年梅曼的红宝石激光器问世——光纤通信、激光加工、LIGO 测距、激光手术全部由此点亮',
    ]);
    heading(f, '受激辐射：从爱因斯坦预言到激光');
  },
});
registerViz(stimulatedEmission);

/** P44 托卡马克与磁约束聚变。 */
const plasmaConfinement = defineViz({
  slug: 'plasma-confinement',
  title: '托卡马克与磁约束聚变',
  animated: true,
  params: {
    beta: { type: 'range', min: 0.01, max: 0.2, default: 0.05, step: 0.01, label: '等离子体 β（压强/磁压）' },
    current: { type: 'range', min: 0.5, max: 3, default: 1.5, step: 0.1, label: '等离子体电流 I_p（MA）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const beta = num(params, 'beta', 0.05);
    const Ip = num(params, 'current', 1.5);

    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    const R0 = Math.min(w * 0.3, 220), r0 = Math.min(h * 0.26, 120);

    // 环形磁面（嵌套 D 形近似：椭圆族偏移）
    for (let i = 5; i >= 1; i--) {
      const rr = (r0 * i) / 5;
      const pts: [number, number][] = [];
      for (let a = 0; a <= Math.PI * 2; a += 0.08) {
        const shaping = 1 + 0.18 * Math.cos(a); // D 形（三角形变）
        pts.push([cx + (R0 - rr * shaping * 0.35) + rr * shaping * Math.cos(a), cy + rr * Math.sin(a) * 0.92]);
      }
      poly(f, pts, { stroke: `rgba(102,126,234,${0.28 + i * 0.1})`, lw: i === 1 ? 2.4 : 1.3 });
    }
    // 等离子体环（粒子沿螺旋流动）
    const nP = 36;
    for (let i = 0; i < nP; i++) {
      const a = (i / nP) * Math.PI * 2 + f.t * (0.5 + Ip * 0.3);
      const spiral = a * 9; // 环向扭转（螺旋磁力线示意）
      const rr = r0 * (0.45 + 0.5 * Math.abs(Math.sin(spiral)));
      const px = cx + R0 + rr * Math.cos(a) * 0.9 - r0 * 0.2 * Math.cos(spiral);
      const py = cy + rr * Math.sin(a) * 0.8;
      dot(f, px, py, 3.4, i % 3 ? C.warm : C.cyan);
    }
    // 环形（外框）
    const ring: [number, number][] = [];
    for (let a = 0; a <= Math.PI * 2; a += 0.05) {
      ring.push([cx + R0 + (r0 + 26) * Math.cos(a), cy + (r0 + 26) * Math.sin(a) * 0.92]);
    }
    poly(f, ring, { stroke: `${C.dim}88`, lw: 2 });
    // 读数
    text(f, `β = ${beta.toFixed(2)}　I_p = ${Ip} MA`, 30, 40, { color: C.cyan, font: '13px sans-serif' });
    text(f, `劳森判据：nτE ≥ ${((1e21) / (beta * 100)).toFixed(1)}×10²⁰ s/m³（随 β 改善）`, 30, 62, { color: C.dim, font: '11px sans-serif' });

    footnotes(f, [
      '托卡马克：环形磁场（环向）+ 等离子体电流产生的旋转变压场 + 纵场线圈，磁力线螺旋缠绕避免粒子漂移损失',
      `β = 等离子体压强/磁压 = ${beta}：β 越大越'省磁铁'，但过大触发破裂不稳定性——聚变三重积 nTτE 的核心指标`,
      'EAST（中国）、JET、ITER（在建，500MW Q=10 目标）沿此路线逼近商业聚变；2022 年 NIF 激光点火 Q>1 另辟蹊径',
    ]);
    heading(f, '托卡马克：把一亿度关进磁场');
  },
});
registerViz(plasmaConfinement);

/** P45 量子霍尔效应与拓扑序。 */
const quantumHall = defineViz({
  slug: 'quantum-hall',
  title: '量子霍尔效应与拓扑序',
  params: {
    T: { type: 'range', min: 0.01, max: 1, default: 0.05, step: 0.01, label: '温度 T（相对，越低平台越陡）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const T = num(params, 'T', 0.05);

    clear(f);
    // 左：朗道能级 E vs B
    const lx0 = 60, lx1 = w * 0.44, ly0 = h - 66, ly1 = 60;
    seg(f, lx0, ly0, lx1, ly0, C.grid, 1.3);
    seg(f, lx0, ly0, lx0, ly1, C.grid, 1.3);
    for (let n = 0; n <= 4; n++) {
      // E_n = (n+1/2)·B 扇形
      const pts: [number, number][] = [];
      for (let i = 6; i <= 60; i++) {
        const B = (i / 60) * 4;
        pts.push([lx0 + (B / 4) * (lx1 - lx0), ly0 - ((n + 0.5) * B / 4.4) * (ly0 - ly1)]);
      }
      poly(f, pts, { stroke: n === 0 ? C.hot : C.accent, lw: n === 0 ? 2.6 : 1.8 });
      text(f, `n=${n}`, lx1 - 26, ly0 - ((n + 0.5) / 4.4) * (ly0 - ly1) - 6, { color: C.accent, font: '10px sans-serif' });
    }
    text(f, '朗道能级 E ∝ (n+½)B', lx0 + 6, ly1 - 8, { color: C.hot, font: '11px sans-serif' });
    text(f, 'B (T)', lx1 - 4, ly0 + 18, { align: 'right', color: C.dim, font: '11px sans-serif' });
    text(f, 'E', lx0 - 22, ly1 + 4, { color: C.dim, font: '12px sans-serif' });

    // 右：霍尔电阻平台（台阶）
    const rx0 = w * 0.54, rx1 = w - 40, ry0 = h - 66, ry1 = 60;
    seg(f, rx0, ry0, rx1, ry0, C.grid, 1.3);
    seg(f, rx0, ry0, rx0, ry1, C.grid, 1.3);
    const soften = T * 24;
    const rOf = (b: number): number => {
      // 平台：ν=1,2,3… Rxy = 1/ν（归一化）
      const v = Math.max(1, b);
      const nu = Math.ceil(v);
      const plateau = 1 / nu;
      const next = 1 / (nu + 1);
      const frac = v - Math.floor(v) - 0.5;
      const smooth = 1 / (1 + Math.exp(-frac * 14 / Math.max(soften, 0.6)));
      return next + (plateau - next) * smooth + (plateau - next) * 0.0;
    };
    const pts: [number, number][] = [];
    for (let i = 4; i <= 100; i++) {
      const b = (i / 100) * 4.4;
      pts.push([rx0 + (b / 4.4) * (rx1 - rx0), ry1 + (1 - rOf(b) * 0.9) * (ry0 - ry1) * 0.9]);
    }
    poly(f, pts, { stroke: C.green, lw: 2.8 });
    text(f, '霍尔电阻量子化平台 R_K/ν', rx0 + 6, ry1 - 8, { color: C.green, font: '11px sans-serif' });
    text(f, 'ν = 1', rx0 + (0.7 / 4.4) * (rx1 - rx0), ry1 + 18, { align: 'center', color: C.dim, font: '10px sans-serif' });
    text(f, 'ν = 2', rx0 + (1.7 / 4.4) * (rx1 - rx0), ry1 + 18, { align: 'center', color: C.dim, font: '10px sans-serif' });
    text(f, 'ν = 3', rx0 + (2.7 / 4.4) * (rx1 - rx0), ry1 + 18, { align: 'center', color: C.dim, font: '10px sans-serif' });
    text(f, 'B (T)', rx1 - 4, ry0 + 18, { align: 'right', color: C.dim, font: '11px sans-serif' });

    footnotes(f, [
      `温度 T = ${T}（相对）：温度升高使平台边缘变'坡'——量子化源于朗道能级的简并与杂质钉扎`,
      '体态朗道能级被杂质局域化钉扎，边缘态导电通道保证 R_xy 精确 = R_K/ν（R_K = h/e² ≈ 25812.8Ω）',
      "平台对无序与几何细节免疫——'拓扑保护'：陈数（TKNN 不变量）是整数，微扰改变不了它（2016 年诺奖）",
    ]);
    heading(f, '量子霍尔：朗道能级与拓扑平台');
  },
});
registerViz(quantumHall);

/** P40 超流与量子流体。 */
const superfluidHelium = defineViz({
  slug: 'superfluid-helium',
  title: '超流与量子流体',
  animated: true,
  params: {
    T: { type: 'range', min: 1.2, max: 3, default: 1.9, step: 0.05, label: '温度 T (K)，λ 点 2.17K' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const T = num(params, 'T', 1.9);
    const Tlambda = 2.17;
    const superfluid = T < Tlambda;

    clear(f);
    // 左：黏度-温度曲线
    const x0 = 56, x1 = w * 0.46, y0 = h - 60, y1 = 60;
    seg(f, x0, y0, x1, y0, C.grid, 1.3);
    seg(f, x0, y0, x0, y1, C.grid, 1.3);
    const sx = (t: number) => x0 + ((t - 1.2) / 1.8) * (x1 - x0);
    const eta = (t: number): number => (t <= Tlambda ? 0 : Math.min(1, ((t - Tlambda) / 0.9) ** 1.5 * 0.9 + 0.06));
    const pts: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const t = 1.2 + (i / 120) * 1.8;
      pts.push([sx(t), y0 - eta(t) * (y0 - y1) * 0.88]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.6 });
    // λ 点
    seg(f, sx(Tlambda), y0, sx(Tlambda), y1, `${C.green}aa`, 1.4);
    text(f, 'λ 点 2.17K', sx(Tlambda) + 6, y1 + 12, { color: C.green, font: '11px sans-serif' });
    dot(f, sx(T), y0 - eta(T) * (y0 - y1) * 0.88, 6, C.warm);
    text(f, `η(T=${T}) = ${superfluid ? '0（超流！）' : '正常黏度'}`, x0 + 8, y1 - 8, { color: superfluid ? C.cyan : C.warm, font: '12px sans-serif' });
    text(f, '温度 T (K)', x1 - 4, y0 + 18, { align: 'right', color: C.dim, font: '11px sans-serif' });
    text(f, '黏度 η', x0 - 40, y1 + 4, { color: C.dim, font: '12px sans-serif' });

    // 右：容器爬壁动画（超流时液膜上升）
    const cx = w * 0.72, cw = 150, ch = h - 150, cy0 = 80;
    // 容器壁
    seg(f, cx - cw / 2, cy0, cx - cw / 2, cy0 + ch, C.dim, 3);
    seg(f, cx + cw / 2, cy0, cx + cw / 2, cy0 + ch, C.dim, 3);
    seg(f, cx - cw / 2, cy0 + ch, cx + cw / 2, cy0 + ch, C.dim, 3);
    const level = cy0 + ch * (superfluid ? 0.55 : 0.62);
    // 液面
    const wave: [number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const x = cx - cw / 2 + (i / 40) * cw;
      wave.push([x, level + Math.sin(i * 0.5 + f.t * 3) * 2.2]);
    }
    poly(f, wave, { stroke: C.cool, lw: 2 });
    f.ctx.fillStyle = 'rgba(66,153,225,0.18)';
    f.ctx.fillRect(cx - cw / 2, level, cw, cy0 + ch - level);
    // 爬壁液膜（超流时沿壁上升并外溢）
    if (superfluid) {
      const climb = ((f.t * 0.5) % 1);
      const filmH = (level - cy0) * (0.4 + climb * 0.6);
      seg(f, cx - cw / 2 - 3, level, cx - cw / 2 - 3, level - filmH, C.cyan, 3);
      seg(f, cx + cw / 2 + 3, level, cx + cw / 2 + 3, level - filmH, C.cyan, 3);
      text(f, '液膜沿壁爬升 → 外溢', cx + cw / 2 + 10, level - filmH, { color: C.cyan, font: '11px sans-serif' });
      // 涡旋环
      const vr: [number, number][] = [];
      for (let a = 0; a <= Math.PI * 2; a += 0.2) {
        vr.push([cx + Math.cos(a) * 26, level + 34 + Math.sin(a) * 12]);
      }
      poly(f, vr, { stroke: `${C.accent}aa`, lw: 2 });
      text(f, '量子化涡旋环（Γ = h/m）', cx - 44, level + 62, { color: C.accent, font: '10px sans-serif' });
    } else {
      text(f, '正常液氦：壁面无爬升', cx - 56, level - 40, { color: C.dim, font: '11px sans-serif' });
    }

    footnotes(f, [
      `T = ${T} K：${superfluid ? '低于 λ 点——He-Ⅱ 超流相，黏度为零、爬壁、传热近乎无穷' : '高于 λ 点——He-Ⅰ 正常流体'}`,
      '玻色子在 λ 点以下占据同一量子态（凝聚）：宏观波函数给出超流速度量子化 Γ = ∮v·dl = n·h/m',
      '爬壁的 Rollin 膜、喷泉效应与第二声（温度波）——量子统计在日常尺度的直接显形',
    ]);
    heading(f, '超流：λ 相变与量子爬壁');
  },
});
registerViz(superfluidHelium);
