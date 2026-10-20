import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** RC 电路暂态。 */
const rcCircuit = defineViz({
  slug: 'rc-circuit', title: 'RC 电路暂态', animated: true,
  params: {
    R: { type: 'range', min: 1, max: 50, default: 10, step: 1, label: '电阻 R (kΩ)' },
    C0: { type: 'range', min: 1, max: 100, default: 10, step: 1, label: '电容 C (μF)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const R = num(params, 'R', 10), Cc = num(params, 'C0', 10);
    const tau = R * Cc / 1000; // 秒（kΩ·μF = ms）
    clear(f);
    const vv = view(f, { xMin: 0, xMax: 5 * tau, yMin: -0.05, yMax: 1.15, inset: 52 });
    grid(f, vv, { divisions: 4, ticks: true });
    // 充电曲线 V=1−e^(−t/τ) 与放电 e^(−t/τ)
    const charge: [number, number][] = [];
    const discharge: [number, number][] = [];
    for (let i = 0; i <= 240; i++) {
      const t = (i / 240) * 5 * tau;
      charge.push([vv.sx(t), vv.sy(1 - Math.exp(-t / tau))]);
      discharge.push([vv.sx(t), vv.sy(Math.exp(-t / tau))]);
    }
    poly(f, charge, { stroke: C.accent, lw: 2.8 });
    poly(f, discharge, { stroke: C.warm, lw: 2.4, dash: [7, 5] } as any);
    // 时间常数标记
    seg(f, vv.sx(tau), vv.sy(0), vv.sx(tau), vv.sy(1.1), `${C.green}99`, 1.4);
    dot(f, vv.sx(tau), vv.sy(1 - Math.exp(-1)), 6, C.green);
    text(f, `τ = RC = ${tau.toFixed(1)} ms（充到 63%）`, vv.sx(tau) + 8, vv.sy(1.1) + 14, { color: C.green, font: '12px sans-serif' });
    text(f, `R=${R}kΩ、C=${Cc}μF：蓝=充电 1−e^(−t/τ)，橙=放电 e^(−t/τ)`, 30, 44, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      '时间常数 τ=RC 决定快慢：5τ 后基本完成——数字电路的上升沿就卡在 RC 上',
      '电容电压不能突变（电流可以）：这是暂态分析的第一条公理',
      '定时器 555、相机闪光灯充电、触摸屏检测全都由 RC 暂态标定时间',
    ]);
    heading(f, 'RC 电路：指数充放电与时间常数');
  },
});
registerViz(rcCircuit);

/** RL 电路。 */
const rlCircuit = defineViz({
  slug: 'rl-circuit', title: 'RL 电路暂态', animated: true,
  params: {
    R: { type: 'range', min: 1, max: 30, default: 8, step: 1, label: '电阻 R (Ω)' },
    L: { type: 'range', min: 1, max: 50, default: 10, step: 1, label: '电感 L (mH)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const R = num(params, 'R', 8), L = num(params, 'L', 10);
    const tau = L / R; // mH/Ω = ms
    clear(f);
    const vv = view(f, { xMin: 0, xMax: 5 * tau, yMin: -0.05, yMax: 1.15, inset: 52 });
    grid(f, vv, { divisions: 4, ticks: true });
    const rise: [number, number][] = [];
    const fall: [number, number][] = [];
    for (let i = 0; i <= 240; i++) {
      const t = (i / 240) * 5 * tau;
      rise.push([vv.sx(t), vv.sy(1 - Math.exp(-t / tau))]);
      fall.push([vv.sx(t), vv.sy(Math.exp(-t / tau))]);
    }
    poly(f, rise, { stroke: C.accent, lw: 2.8 });
    poly(f, fall, { stroke: C.hot, lw: 2.4, dash: [7, 5] } as any);
    seg(f, vv.sx(tau), vv.sy(0), vv.sx(tau), vv.sy(1.1), `${C.green}99`, 1.4);
    text(f, `τ = L/R = ${tau.toFixed(2)} ms`, vv.sx(tau) + 8, vv.sy(1.1) + 14, { color: C.green, font: '12px sans-serif' });
    text(f, '电感电流不能突变：断电瞬间线圈会产生反电动势火花', 30, 44, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      '与 RC 完全对偶：τ=L/R，电感扮演电容的倒数角色——储能换成了磁场',
      '继电器与电机关断时的火花就是反电动势（−L·dI/dt）击穿空气',
      '续流二极管给感应电流一条出路——保护晶体管的标配元件',
    ]);
    heading(f, 'RL 电路：磁场的惯性');
  },
});
registerViz(rlCircuit);

/** LC 谐振。 */
const lcResonance = defineViz({
  slug: 'lc-resonance', title: 'LC 谐振', animated: true,
  params: {
    L: { type: 'range', min: 1, max: 50, default: 10, step: 1, label: '电感 L (mH)' },
    C0: { type: 'range', min: 1, max: 100, default: 22, step: 1, label: '电容 C (pF→相对)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const L = num(params, 'L', 10), Cc = num(params, 'C0', 22);
    const freq = 1 / (2 * Math.PI * Math.sqrt((L / 1000) * (Cc / 1e6) * 1e-6 + 1e-12));
    clear(f);
    const x0 = 70, x1 = w - 70, mid = h / 2 + 6;
    // 电荷振荡（正弦）与能量交换动画
    const q: [number, number][] = [];
    const eE: [number, number][] = [];
    const omega = 2.4;
    for (let i = 0; i <= 400; i++) {
      const x = x0 + (i / 400) * (x1 - x0);
      const t = (i / 400) * 14 - f.t * omega * 4;
      q.push([x, mid - Math.sin(t) * 74]);
      eE.push([x, mid - Math.cos(t) * Math.cos(t) * 74]);
    }
    poly(f, q, { stroke: C.accent, lw: 2.6 });
    poly(f, eE, { stroke: `${C.warm}88`, lw: 2, dash: [6, 4] } as any);
    seg(f, x0, mid, x1, mid, `${C.grid}aa`, 1.3);
    // 电容（电荷脉动）与线圈（电流脉动）
    const phase = (f.t * omega * 4) % (Math.PI * 2);
    text(f, `f₀ = 1/(2π√LC) ≈ ${(freq / 1e3).toFixed(1)} kHz（示意量级）`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, `电荷与能量在 C 与 L 之间永不停歇地交换：E_C=${Math.abs(Math.cos(phase) * Math.cos(phase) * 100).toFixed(0)}% E_L=${Math.abs(Math.sin(phase) * Math.sin(phase) * 100).toFixed(0)}%`,
      30, 66, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      'LC 电路是电磁振荡的原型：电场能与磁能周期互换，等价于弹簧振子',
      '无阻尼理想 LC 永振；真实电路的 R 让它衰减——Q 值=ωL/R 描述多能振',
      '收音机调谐回路选台、晶振与滤波器——LC 谐振是无线电选频的基石',
    ]);
    heading(f, 'LC 谐振：电磁的钟摆');
  },
});
registerViz(lcResonance);

/** 交流阻抗与相位。 */
const acImpedance = defineViz({
  slug: 'ac-impedance', title: '交流阻抗与相位', animated: true,
  params: {
    freq: { type: 'range', min: 10, max: 1000, default: 200, step: 10, label: '频率 f (Hz)' },
    kind: { type: 'select', options: ['RLC 串联', 'RC 低通', 'RL 高通'], default: 'RLC 串联', label: '电路' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const fr = num(params, 'freq', 200);
    clear(f);
    const vv = view(f, { xMin: 10, xMax: 1000, yMin: 0, yMax: 1.2, inset: 52 });
    grid(f, vv, { divisions: 4, ticks: true });
    const f0 = 220;
    const H = (x: number): number => 1 / Math.sqrt(Math.pow(1 - (x / f0) ** 2, 2) + Math.pow((x / f0) / 3.5, 2));
    const pts: [number, number][] = [];
    for (let i = 1; i <= 300; i++) {
      const x = 10 + (i / 300) * 990;
      pts.push([vv.sx(x), vv.sy(Math.min(H(x), 1.15))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.8 });
    const cur = Math.min(H(fr), 1.15);
    dot(f, vv.sx(fr), vv.sy(cur), 7, C.warm);
    // 相位角示意
    const phi = Math.atan2((fr / f0) / 3.5, 1 - (fr / f0) ** 2) * (180 / Math.PI);
    text(f, `|H|=${cur.toFixed(2)}，相位 φ=${phi.toFixed(0)}°`, vv.sx(fr) + 10, vv.sy(cur) - 8, { color: C.warm, font: '12px sans-serif' });
    text(f, `f₀≈${f0}Hz 谐振点：阻抗最小、电流最大、电压电流同相`, 30, 44, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      '阻抗 Z=R+j(ωL−1/ωC) 是复数：模管幅度、辐角管相位——交流分析复数化的胜利',
      '感抗随频率升、容抗随频率降，交点即谐振——收音机、滤波器与天线匹配都靠它',
      '功率因数 cosφ 是电网考核指标：工厂用电要无功补偿，否则被罚',
    ]);
    heading(f, '交流阻抗：复数管电学');
  },
});
registerViz(acImpedance);

/** 变压器。 */
const transformer = defineViz({
  slug: 'transformer', title: '变压器', animated: true,
  params: {
    n1: { type: 'range', min: 50, max: 500, default: 200, step: 10, label: '初级匝数 N₁' },
    n2: { type: 'range', min: 10, max: 500, default: 40, step: 5, label: '次级匝数 N₂' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n1 = num(params, 'n1', 200), n2 = num(params, 'n2', 40);
    const ratio = n2 / n1;
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    // 铁芯
    poly(f, [[cx - 130, cy - 110], [cx + 130, cy - 110], [cx + 130, cy + 110], [cx - 130, cy + 110],
      [cx - 104, cy - 84], [cx - 104, cy + 84], [cx + 104, cy + 84], [cx + 104, cy - 84], [cx - 104, cy - 84]],
      { stroke: C.dim, lw: 2.4, fill: 'rgba(100,116,139,0.22)' } as any);
    // 初/次级线圈（匝数视觉化）
    const drawCoil = (x: number, turns: number, color: string, side: string): void => {
      const shown = Math.min(14, Math.round(turns / 25));
      for (let i = 0; i < shown; i++) {
        const y = cy - 70 + (i * 140) / Math.max(shown - 1, 1);
        f.ctx.beginPath();
        f.ctx.arc(x, y, 12, -Math.PI / 2, Math.PI / 2);
        f.ctx.strokeStyle = color; f.ctx.lineWidth = 3; f.ctx.stroke();
      }
      text(f, `${side} N=${turns}`, x - 34, cy + 100, { color, font: '12px sans-serif' });
    };
    drawCoil(cx - 116, n1, C.hot, '初级');
    drawCoil(cx + 116, n2, C.cool, '次级');
    // 磁通脉动
    const flux = 0.5 + 0.5 * Math.sin(f.t * 6);
    text(f, `V₂/V₁ = N₂/N₁ = ${ratio.toFixed(2)}（${ratio < 1 ? '降压' : '升压'}）`, 30, 44, { color: C.cyan, font: '14px sans-serif' });
    text(f, `磁通 Φ ∝ sin(ωt) 瞬时 ${(flux * 100).toFixed(0)}%：互感是唯一的桥梁（交流才工作）`, 30, 66, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '法拉第定律让两个线圈通过同一铁芯磁通耦合：变压比严格等于匝数比',
      '理想变压器功率守恒 V₁I₁=V₂I₂——升压必降流，这就是高压输电省铜省线的道理',
      '变压器只吃交流：直流磁通恒定不感应——正是这一限制把直流电机推回历史',
    ]);
    heading(f, '变压器：匝数比决定电压比');
  },
});
registerViz(transformer);

/** 三相电。 */
const threePhase = defineViz({
  slug: 'three-phase', title: '三相电', animated: true,
  params: {
    load: { type: 'select', options: ['星形（Y）', '三角形（Δ）'], default: '星形（Y）', label: '接法' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const star = String((params as Record<string, unknown>)['load'] ?? '').includes('星');
    clear(f);
    const x0 = 60, x1 = w * 0.55, mid = h / 2 + 10;
    // 三相波形（互差 120°）
    const colors = [C.hot, C.cool, C.green];
    for (let k = 0; k < 3; k++) {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 300; i++) {
        const x = x0 + (i / 300) * (x1 - x0);
        const t = (i / 300) * Math.PI * 4 - f.t * 4;
        pts.push([x, mid - Math.sin(t + (k * 2 * Math.PI) / 3) * 80]);
      }
      poly(f, pts, { stroke: colors[k], lw: 2.2 });
    }
    text(f, 'A、B、C 三相各差 120°：瞬时功率之和恒定', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 右侧接法示意
    const cx = w * 0.78, cy = h / 2;
    if (star) {
      for (let k = 0; k < 3; k++) {
        const a = (k * 2 * Math.PI) / 3 - Math.PI / 2;
        seg(f, cx, cy, cx + 74 * Math.cos(a), cy + 74 * Math.sin(a), colors[k], 2.6);
        dot(f, cx + 74 * Math.cos(a), cy + 74 * Math.sin(a), 8, colors[k]);
      }
      dot(f, cx, cy, 6, C.dim);
      text(f, 'Y：中线电流≈0（负载平衡时）', cx - 84, cy + 108, { color: C.warm, font: '11px sans-serif' });
    } else {
      const pts: [number, number][] = [];
      for (let k = 0; k < 3; k++) {
        const a = (k * 2 * Math.PI) / 3 - Math.PI / 2;
        pts.push([cx + 74 * Math.cos(a), cy + 74 * Math.sin(a)]);
      }
      poly(f, [...pts, pts[0]], { stroke: C.warm, lw: 2.6 });
      for (const p of pts) dot(f, p[0], p[1], 8, C.cool);
      text(f, 'Δ：线电压=相电压，启动电流大', cx - 84, cy + 108, { color: C.warm, font: '11px sans-serif' });
    }

    footnotes(f, [
      '三相瞬时功率之和是常数——电动机转矩平稳不脉动，这是三相制统治工业的原因',
      '同样功率下三相输电比单相省 25% 导线材料——电网经济性的数学根源',
      '1891 年多相制战胜直流（特斯拉 vs 爱迪生）：谁赢了，谁定义了今天的世界',
    ]);
    heading(f, '三相电：120° 的工业基石');
  },
});
registerViz(threePhase);

/** 直流电动机。 */
const dcMotor = defineViz({
  slug: 'dc-motor', title: '直流电动机', animated: true,
  params: {
    V: { type: 'range', min: 3, max: 48, default: 12, step: 1, label: '电压 V' },
    load: { type: 'range', min: 0, max: 100, default: 30, step: 5, label: '负载 (%)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const V = num(params, 'V', 12), load = num(params, 'load', 30);
    const speed = (V * 0.5) * (1 - load / 160);
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    // 定子磁极
    poly(f, [[cx - 130, cy - 96], [cx - 60, cy - 60], [cx - 60, cy + 60], [cx - 130, cy + 96]],
      { stroke: C.dim, lw: 2, fill: 'rgba(100,116,139,0.3)' } as any);
    poly(f, [[cx + 130, cy - 96], [cx + 60, cy - 60], [cx + 60, cy + 60], [cx + 130, cy + 96]],
      { stroke: C.dim, lw: 2, fill: 'rgba(100,116,139,0.3)' } as any);
    text(f, 'N', cx - 104, cy + 6, { color: '#fff', font: '16px sans-serif' });
    text(f, 'S', cx + 96, cy + 6, { color: '#fff', font: '16px sans-serif' });
    // 转子（旋转线圈 + 换向器）
    const ang = f.t * speed * 0.4;
    f.ctx.save();
    f.ctx.translate(cx, cy);
    f.ctx.rotate(ang);
    poly(f, [[-52, -40], [52, -40], [52, 40], [-52, 40]], { stroke: C.cool, lw: 2.4, fill: 'rgba(66,153,225,0.25)' } as any);
    for (let k = 0; k < 3; k++) {
      const yy = -26 + k * 26;
      seg(f, -44, yy, 44, yy, C.hot, 2);
    }
    f.ctx.restore();
    dot(f, cx, cy, 8, C.dim);
    // 受力箭头（安培力）
    const fx = Math.cos(ang) * 40, fy = Math.sin(ang) * 40;
    poly(f, [[cx - fx - 24, cy - fy], [cx - fx, cy - fy - 14]], { stroke: C.green, lw: 2 } as any);
    seg(f, cx - fx - 26, cy - fy, cx - fx - 56, cy - fy, C.green, 2.6);
    seg(f, cx + fx + 26, cy + fy, cx + fx + 56, cy + fy, C.green, 2.6);
    text(f, `转速≈${speed.toFixed(0)}（相对）：F=BIl 力偶驱动转子，换向器每半圈翻转电流`, 30, 44, { color: C.cyan, font: '12px sans-serif' });
    text(f, `电压 ${V}V、负载 ${load}%：负载加大转速下降（机械特性变软）`, 30, 66, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '通电线圈在磁场中受力矩转动：左手定则给方向，换向器保证力矩方向恒定',
      '反电动势 E=keΦω 让电机自调节：负载加重→转速降→反电动势降→电流回升',
      '电动车与电钻的调速本质是调压（PWM）——现代电机驱动的最简原理',
    ]);
    heading(f, '直流电动机：安培力的旋转舞台');
  },
});
registerViz(dcMotor);

/** 磁滞回线。 */
const hysteresis = defineViz({
  slug: 'hysteresis', title: '磁滞回线', animated: true,
  params: {
    Hmax: { type: 'range', min: 0.3, max: 1.5, default: 1, step: 0.05, label: '最大励磁 H_max（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const Hm = num(params, 'Hmax', 1);
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    const sx = (x: number): number => cx + x * Math.min(w * 0.36, 240) * Hm;
    const sy = (y: number): number => cy - y * Math.min(h * 0.3, 130);
    // 轴
    seg(f, sx(-1.15 / Hm), cy, sx(1.15 / Hm), cy, C.grid, 1.4);
    seg(f, cx, sy(-1.15), cx, sy(1.15), C.grid, 1.4);
    text(f, 'H', sx(1.15 / Hm) + 6, cy + 4, { color: C.dim, font: '13px sans-serif' });
    text(f, 'B', cx + 8, sy(1.15) - 4, { color: C.dim, font: '13px sans-serif' });
    // 磁滞回线（参数方程）
    const pts: [number, number][] = [];
    for (let i = 0; i <= 240; i++) {
      const a = (i / 240) * Math.PI * 2;
      const hx = Math.sin(a) * Hm;
      const by = Math.tanh(2.4 * Math.sin(a) - 0.55 * Math.cos(a) * 0 + 0.6 * Math.cos(a)) * 0.9;
      pts.push([sx(hx), sy(by)]);
    }
    poly(f, pts, { stroke: C.hot, lw: 2.8 });
    // 工作点
    const a2 = f.t * 2;
    dot(f, sx(Math.sin(a2) * Hm), sy(Math.tanh(2.4 * Math.sin(a2) + 0.6 * Math.cos(a2)) * 0.9), 7, C.warm);
    text(f, `矫顽力 H_c≈${(0.35 / Hm).toFixed(2)}，剩磁 B_r：回线面积=每周期磁滞损耗`, 30, 44, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      '磁畴壁在外场下不可逆跳跃（巴克豪森跳跃）——磁化落后于外场即滞后',
      '软磁（回线窄）做变压器铁芯省损耗；硬磁（回线宽）做永磁体扛住退磁',
      '磁滞损耗 P∝f·B_max^n：电网 50Hz 的铁芯发热由回线面积定价',
    ]);
    heading(f, '磁滞回线：磁化的记忆');
  },
});
registerViz(hysteresis);

/** 趋肤效应。 */
const skinEffect = defineViz({
  slug: 'skin-effect', title: '趋肤效应',
  params: {
    freq: { type: 'range', min: 1, max: 1000, default: 100, step: 1, label: '频率 (kHz 相对)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const fr = num(params, 'freq', 100);
    const delta = 1 / Math.sqrt(fr); // 趋肤深度 ∝ 1/√f
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    const R = Math.min(w, h) * 0.3;
    // 导线截面
    f.ctx.beginPath(); f.ctx.arc(cx, cy, R, 0, Math.PI * 2);
    f.ctx.fillStyle = 'rgba(100,116,139,0.25)'; f.ctx.fill();
    f.ctx.strokeStyle = C.dim; f.ctx.lineWidth = 3; f.ctx.stroke();
    // 电流密度分布（表面环带亮度）
    const rings = 12;
    for (let i = 0; i < rings; i++) {
      const rOuter = R - (i * R) / rings;
      const rInner = R - ((i + 1) * R) / rings;
      const rel = (R - (rInner + rOuter) / 2) / R;
      const dens = Math.exp(-rel / Math.max(delta, 0.05));
      f.ctx.beginPath();
      f.ctx.arc(cx, cy, (rOuter + rInner) / 2, 0, Math.PI * 2);
      f.ctx.strokeStyle = `rgba(66,153,225,${dens * 0.95})`;
      f.ctx.lineWidth = R / rings + 1;
      f.ctx.stroke();
    }
    text(f, `δ = √(2ρ/ωμ) ∝ 1/√f：当前趋肤深度≈导线半径的 ${(delta * 100).toFixed(0)}%`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, fr > 300 ? '高频电流几乎只走表面——空心导线即可（利兹线的原理）' : '低频时电流基本均匀充满截面', 30, 66, { color: fr > 300 ? C.warm : C.green, font: '12px sans-serif' });

    footnotes(f, [
      '变化的电流激发变化的涡旋电场，把电荷推向表面——自感的截面表达',
      '有效截面积缩小→交流电阻增大：高压线用扩径分裂导线抑制电晕与损耗',
      '利兹线用多股绝缘细线编织，让每根线的趋肤深度尽量用满——高频变压器标配',
    ]);
    heading(f, '趋肤效应：高频只走表面');
  },
});
registerViz(skinEffect);

/** 谐振腔。 */
const resonantCavity = defineViz({
  slug: 'resonant-cavity', title: '谐振腔与驻波模式', animated: true,
  params: {
    mode: { type: 'select', options: ['TE₁₀₁', 'TE₀₁₁', 'TM₁₁₀'], default: 'TE₁₀₁', label: '模式' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = String((params as Record<string, unknown>)['mode'] ?? 'TE₁₀₁');
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    const W = Math.min(w, h) * 0.46, Hh = W * 0.62;
    // 腔体（等轴测方箱）
    const dx = 46, dy = -34;
    const front: [number, number][] = [
      [cx - W, cy - Hh], [cx + W, cy - Hh], [cx + W, cy + Hh], [cx - W, cy + Hh],
    ];
    const back = front.map(([x, y]) => [x + dx, y + dy] as [number, number]);
    poly(f, [...front, front[0]], { stroke: C.dim, lw: 2.2, fill: 'rgba(100,116,139,0.14)' } as any);
    poly(f, [...back, back[0]], { stroke: `${C.dim}aa`, lw: 1.6 } as any);
    for (let i = 0; i < 4; i++) seg(f, front[i][0], front[i][1], back[i][0], back[i][1], `${C.dim}aa`, 1.6);
    // 腔内驻波（电场斑图呼吸）
    const nodes = mode === 'TE₁₀₁' ? 1 : 2;
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 4);
    for (let i = 1; i <= nodes * 3; i++) {
      const px = cx - W + (i * 2 * W) / (nodes * 3 + 1);
      const amp = Math.abs(Math.sin((i * Math.PI) / (nodes * 3 + 1)));
      const r = 14 + amp * 30 * pulse;
      f.ctx.beginPath();
      f.ctx.ellipse(px, cy, r * 0.7, r, 0, 0, Math.PI * 2);
      f.ctx.fillStyle = `rgba(66,153,225,${0.15 + amp * 0.5 * pulse})`;
      f.ctx.fill();
      f.ctx.strokeStyle = `${C.cool}cc`; f.ctx.lineWidth = 1.6; f.ctx.stroke();
    }
    text(f, `模式 ${mode}：场斑图在腔内定域，截止频率以上才能共振`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '微波炉 2.45GHz 就是一个多模谐振腔——搅拌叶片搅动驻波热点', 30, 66, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '把传输线两端短路就成腔：电磁波在三对壁面反复反射形成三维驻波',
      '每个模式有特征截止频率与 Q 值（可达 10⁴~10⁶）——频谱分析的利器',
      '粒子加速器的加速腔、激光的光学腔与微波炉，本质是同一件事的不同尺寸',
    ]);
    heading(f, '谐振腔：被关住的电磁驻波');
  },
});
registerViz(resonantCavity);

/** 波导。 */
const waveguide = defineViz({
  slug: 'waveguide', title: '矩形波导与截止频率', animated: true,
  params: {
    a: { type: 'range', min: 10, max: 40, default: 23, step: 1, label: '宽边 a (mm)' },
    fr: { type: 'range', min: 1, max: 40, default: 10, step: 1, label: '工作频率 (GHz)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 23);
    const freq = num(params, 'fr', 10);
    const fc = 150 / (2 * a); // TE10 截止 ≈ c/(2a) GHz（a 用 mm：300/(2a) MHz*1000→GHz=150/a）
    const passes = freq > fc;
    clear(f);
    // 波导管（透视长管）
    const x0 = w * 0.14, x1 = w * 0.86, cy = h * 0.42;
    const bh = 70;
    poly(f, [[x0, cy - bh], [x1, cy - bh], [x1, cy + bh], [x0, cy + bh]],
      { stroke: C.dim, lw: 2.4, fill: 'rgba(100,116,139,0.12)' } as any);
    text(f, `宽边 a=${a}mm`, x0, cy - bh - 12, { color: C.dim, font: '11px sans-serif' });
    // 管内 TE10 场型（沿轴行进的波）
    if (passes) {
      const beta = Math.sqrt((freq / fc) ** 2 - 1);
      for (let s = 0; s < 5; s++) {
        const pts: [number, number][] = [];
        for (let i = 0; i <= 60; i++) {
          const t = i / 60;
          const x = x0 + t * (x1 - x0);
          const phase = t * beta * 14 - f.t * 5;
          pts.push([x, cy - Math.sin((Math.PI * 0) + phase + s * 1.3) * (bh - 14) * Math.sin(Math.PI * ((s + 0.5) / 5))]);
        }
        poly(f, pts, { stroke: `rgba(66,153,225,${0.9 - s * 0.14})`, lw: 2.2 });
      }
      // 能流箭头
      for (let k = 0; k < 4; k++) {
        const x = x0 + 60 + k * 90 + ((f.t * 50) % 90);
        if (x < x1 - 30) poly(f, [[x, cy + 88], [x + 16, cy + 88], [x + 8, cy + 78]], { stroke: C.green, lw: 1.6, fill: C.green } as any);
      }
      text(f, `f=${freq}GHz > f_c=${fc.toFixed(1)}GHz：传播模式（λ_g > λ₀，慢波）`, 30, 44, { color: C.green, font: '13px sans-serif' });
    } else {
      for (let i = 0; i < 40; i++) {
        const x = x0 + 14 + i * 4;
        const decay = Math.exp(-i / 6);
        seg(f, x, cy - 40 * decay, x, cy + 40 * decay, `rgba(237,87,54,${decay * 0.8})`, 2);
      }
      text(f, `f=${freq}GHz < f_c=${fc.toFixed(1)}GHz：截止！场按 e^(−αx) 衰减，无功率通过`, 30, 44, { color: C.hot, font: '13px sans-serif' });
    }

    footnotes(f, [
      '波导比同轴线损耗低、功率大——雷达与微波中继的主干通道',
      '截止频率以下如同关闸：波导天生是高通器件，尺寸决定通带',
      'TE₁₀ 是主模：单模工作避免多模色散——微波工程的频段规划基础',
    ]);
    heading(f, '波导：有门槛的电磁通道');
  },
});
registerViz(waveguide);

/** 天线方向图。 */
const antennaPattern = defineViz({
  slug: 'antenna-pattern', title: '天线方向图', animated: true,
  params: {
    n: { type: 'range', min: 1, max: 10, default: 3, step: 1, label: '阵元数 N' },
    d: { type: 'range', min: 0.3, max: 1.5, default: 0.6, step: 0.05, label: '间距 d（λ 倍）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const N = Math.round(num(params, 'n', 3));
    const dd = num(params, 'd', 0.6);
    clear(f);
    const cx = w / 2, cy = h / 2 + 10;
    const R = Math.min(w, h) * 0.34;
    const gain = (theta: number): number => {
      const u = Math.PI * dd * Math.sin(theta);
      if (Math.abs(u) < 1e-9) return 1;
      return Math.abs(Math.sin(N * u) / (N * Math.sin(u)));
    };
    // 极坐标方向图（左右对称两叶+旁瓣）
    for (const dir of [1, -1]) {
      const pts: [number, number][] = [];
      for (let i = -90; i <= 90; i++) {
        const th = (i * Math.PI) / 180;
        const g = gain(th);
        const r = R * g;
        const a = dir > 0 ? th : Math.PI - th;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      poly(f, [...pts, [cx, cy]], { stroke: C.accent, lw: 2.4, fill: 'rgba(66,153,225,0.22)' } as any);
    }
    // 阵元
    for (let k = 0; k < N; k++) {
      dot(f, cx - (N - 1) * 8 + k * 16, cy, 4, C.warm);
    }
    text(f, `N=${N} 阵元、d=${dd}λ：主瓣宽度∝1/N，阵元越多波束越尖`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, dd > 1 && N > 3 ? 'd>λ 时出现栅瓣（假主瓣）——阵列设计的红线' : '均匀激励阵列：sin(Nu)/(N·sin u) 的经典包络', 30, 66, { color: dd > 1 ? C.hot : C.warm, font: '12px sans-serif' });
    void f;

    footnotes(f, [
      '阵列因子与单元方向图相乘——相控阵雷达不转天线、只调相位就扫描空域',
      '5G 毫米波 Massive MIMO 用 64~256 阵元把能量对准用户——频谱效率的倍增器',
      '从军用相控阵到射电干涉阵（VLA、SKA）：阵列天线是观天测地的共同语言',
    ]);
    heading(f, '天线阵列：用干涉雕刻波束');
  },
});
registerViz(antennaPattern);
