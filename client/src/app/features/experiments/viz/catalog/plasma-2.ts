import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** 德拜屏蔽。 */
const debyeShielding = defineViz({
  slug: 'debye-shielding', title: '德拜屏蔽', animated: true,
  params: {
    lamD: { type: 'range', min: 10, max: 120, default: 44, step: 4, label: '德拜长度 λ_D（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const ld = num(params, 'lamD', 44);
    clear(f);
    const cx = w * 0.4, cy = h / 2 + 6;
    // 中心电荷与屏蔽云（脉动）
    dot(f, cx, cy, 11, C.hot);
    text(f, '+q', cx + 14, cy + 4, { color: C.hot, font: '13px sans-serif' });
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const rr = ld * (0.65 + 0.3 * Math.sin(f.t * 2 + k));
      dot(f, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.85, 4.6, C.cool);
    }
    text(f, '异号离子云随热运动涨落——屏蔽不完全（德拜球是统计意义上的）', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 电势衰减曲线
    const x0 = w * 0.6, y0 = h - 56, y1 = 70;
    const vv = view(f, { xMin: 0, xMax: 3, yMin: 0, yMax: 1.1, inset: 46 });
    grid(f, vv, { divisions: 4, ticks: true });
    const pts: [number, number][] = [];
    for (let i = 1; i <= 200; i++) {
      const r = (i / 200) * 3;
      pts.push([vv.sx(r), vv.sy((1 / Math.max(r, 0.12)) * Math.exp(-r * (3 / (ld / 18))))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.8 });
    poly(f, [[vv.sx(0), vv.sy(1)], [vv.sx(3), vv.sy(0)]], { stroke: `${C.dim}aa`, lw: 1.5, dash: [6, 4] } as any);
    text(f, '实线=屏蔽后 φ∝e^(−r/λ_D)/r；虚线=裸库仑势', vv.sx(0.3), vv.sy(0.96), { color: C.dim, font: '10px sans-serif' });
    text(f, `λ_D=${ld}：超过它等离子体对外部电场'视而不见'`, vv.sx(0.2), y1 - 6, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '德拜长度是等离子体的屏蔽半径：内部集体行为、外部看作电中性——准中性的量化',
      'λ_D∝√(T/n)：温度越高、密度越低屏蔽越弱——恒星际等离子体与实验室参数的分野',
      '朗道对理想等离子体的巨正则修正由此展开——等离子体物理的统计起点',
    ]);
    heading(f, '德拜屏蔽：等离子体的自我保护');
  },
});
registerViz(debyeShielding);

/** 等离子体频率。 */
const plasmaFrequency = defineViz({
  slug: 'plasma-frequency', title: '等离子体频率', animated: true,
  params: {
    n: { type: 'range', min: 0.2, max: 3, default: 1, step: 0.1, label: '电子密度 n（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = num(params, 'n', 1);
    const wp = Math.sqrt(n); // ω_p ∝ √n
    clear(f);
    // 电子集体振荡（恢复力来自电荷分离）
    const x0 = 60, yMid = h * 0.4;
    // 平衡位置格点 + 位移正弦
    for (let i = 0; i < 22; i++) {
      const x = x0 + i * ((w - 130) / 22);
      const disp = Math.sin(i * 0.55 - f.t * 4 * wp) * 18 * (i / 22);
      dot(f, x + disp, yMid, 5.4, C.cool);
    }
    seg(f, x0 - 10, yMid, w - 50, yMid, `${C.grid}aa`, 1.2);
    text(f, '电子集体位移 → 恢复电场 → 以 ω_p 振荡（离子固定背景）', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 色散关系（右下）
    const vx = w * 0.56, vy0 = h - 56, vy1 = h * 0.64;
    seg(f, vx, vy0, w - 40, vy0, C.grid, 1.2);
    seg(f, vx, vy0, vx, vy1, C.grid, 1.2);
    const disp2: [number, number][] = [];
    for (let i = 0; i <= 80; i++) {
      const kk = i / 80;
      const omega = Math.sqrt(wp * wp + 2.25 * kk * kk);
      disp2.push([vx + kk * (w - 40 - vx), vy0 - (omega / 3.2) * (vy0 - vy1)]);
    }
    poly(f, disp2, { stroke: C.accent, lw: 2.6 });
    seg(f, vx, vy0 - (wp / 3.2) * (vy0 - vy1), w - 40, vy0 - (wp / 3.2) * (vy0 - vy1), `${C.warm}aa`, 1.4);
    text(f, `ω_p = √(ne²/mε₀)：截止频率（n=${n.toFixed(1)}，ω_p∝√n）`, vx + 6, vy1 - 6, { color: C.warm, font: '11px sans-serif' });
    text(f, 'ω<ω_p 的电磁波被反射——电离层反射中波广播的原理', 30, h - 30, { color: C.green, font: '13px sans-serif' });

    footnotes(f, [
      '等离子体频率是电子集体振荡的天然节拍——电磁波在其中色散并截止',
      '电离层把短波弹回地面实现跨洋广播；金属等离子体频率在紫外（Lorentz 电子论）',
      'ω_p 是等离子体参量的秒表：汤姆孙散射测密度、微波干涉测等离子体参数',
    ]);
    heading(f, '等离子体频率：集体振荡的节拍');
  },
});
registerViz(plasmaFrequency);

/** 磁流体动力学。 */
const magnetohydrodynamic = defineViz({
  slug: 'magnetohydrodynamic', title: '磁流体动力学（MHD）', animated: true,
  params: {
    Rm: { type: 'range', min: 0.2, max: 3, default: 1, step: 0.1, label: '磁雷诺数 Rm（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const Rm = num(params, 'Rm', 1);
    const frozen = Rm > 0.7; // 磁冻结近似
    clear(f);
    // 流体+磁场线（冻结则随流体一起动）
    const y0 = h * 0.3, y1 = h * 0.7;
    // 场线
    for (let k = 0; k < 5; k++) {
      const yy = y0 + k * ((y1 - y0) / 4);
      const pts: [number, number][] = [];
      for (let i = 0; i <= 120; i++) {
        const t = i / 120;
        const x = 60 + t * (w - 120);
        const bend = frozen
          ? Math.sin(t * Math.PI * 2 - f.t * 2) * 26 * Math.exp(-Math.abs(t - 0.5) * 2)
          : Math.sin(t * Math.PI * 2 - f.t * 2) * 10;
        pts.push([x, yy + bend]);
      }
      poly(f, pts, { stroke: `rgba(66,153,225,${0.75 - k * 0.08})`, lw: 2.2 });
    }
    // 流体速度箭头
    for (let k = 0; k < 6; k++) {
      const x = 80 + k * ((w - 170) / 6);
      const ph = (f.t * 40 + k * 30) % 40;
      poly(f, [[x + ph, y1 + 30], [x + ph + 16, y1 + 30], [x + ph + 8, y1 + 22]], { stroke: C.green, lw: 1.6, fill: C.green } as any);
    }
    text(f, frozen ? 'Rm≫1：磁力线“冻”在流体里随波逐流（太阳发电机、星系磁场的机制）' : 'Rm≪1：磁力线相对流体滑移、扩散湮灭',
      30, 44, { color: frozen ? C.cyan : C.warm, font: '13px sans-serif' });
    // 方程
    text(f, '∂B/∂t = ∇×(v×B) + η∇²B（感应方程：平流 vs 扩散）', 30, h - 30, { color: C.cyan, font: '14px serif' });

    footnotes(f, [
      'MHD 把导电流体与磁场当一个整体：太阳对流、地核发电机、聚变磁约束全用它',
      '磁冻结（阿尔文 1942，1970 诺奖）：高 Rm 下磁场随流体拉伸扭曲——阿尔文波由此诞生',
      '托卡马克的磁面演化、太阳耀斑的磁重联都是感应方程的剧场',
    ]);
    heading(f, '磁流体：导电流体与磁场共舞');
  },
});
registerViz(magnetohydrodynamic);

/** 离子声波。 */
const ionAcoustic = defineViz({
  slug: 'ion-acoustic', title: '离子声波', animated: true,
  params: {
    Te: { type: 'range', min: 0.3, max: 3, default: 1, step: 0.1, label: '电子温度 T_e（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const Te = num(params, 'Te', 1);
    const cs = Math.sqrt(Te); // 声速∝√Te
    clear(f);
    const x0 = 60, yIon = h * 0.36, yElc = h * 0.62;
    // 离子（重、慢、形成密度波）
    for (let i = 0; i < 24; i++) {
      const x = x0 + i * ((w - 130) / 24);
      const comp = Math.sin(i * 0.5 - f.t * 3 * cs) * 14;
      dot(f, x + comp, yIon, 6.4, C.warm);
    }
    text(f, '离子（暖、慢）：惯性载荷形成密度压缩', 30, yIon - 34, { color: C.warm, font: '13px sans-serif' });
    // 电子（轻、快、提供恢复压力）
    for (let i = 0; i < 40; i++) {
      const x = x0 + i * ((w - 130) / 40);
      const jitter = Math.sin(i * 0.9 - f.t * 6 * cs) * 6;
      dot(f, x + jitter, yElc, 3.6, C.cool);
    }
    text(f, '电子（快、压力化）：跟随但不参与惯性——像空气中的声波', 30, yElc + 30, { color: C.cool, font: '13px sans-serif' });
    text(f, `离子声速 c_s = √(ZT_e/m_i) ∝ √T_e = ${cs.toFixed(2)}（相对）`, 30, 44, { color: C.cyan, font: '14px sans-serif' });

    footnotes(f, [
      '离子声波=等离子体里的声波：电子提供压强、离子提供惯性——两流体各司其职',
      "无碰撞的'声'：靠自洽电场（德拜屏蔽）传递——集体效应的教科书范例",
      '它是实验室等离子体诊断的常用波：相速直接读出电子温度',
    ]);
    heading(f, '离子声波：无碰撞的声');
  },
});
registerViz(ionAcoustic);

/** 磁重联。 */
const magneticReconnection = defineViz({
  slug: 'magnetic-reconnection', title: '磁重联', animated: true,
  params: {
    speed: { type: 'range', min: 0.3, max: 3, default: 1, step: 0.1, label: '重联率（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const rate = num(params, 'speed', 1);
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    // 上下反向磁场线
    for (let k = -2; k <= 2; k++) {
      if (k === 0) continue;
      const yy = cy + k * 62;
      const pts: [number, number][] = [];
      for (let i = 0; i <= 120; i++) {
        const t = i / 120;
        const x = 60 + t * (w - 120);
        const pinch = Math.exp(-Math.pow((x - cx) / 70, 2)) * 44 * Math.sign(k);
        pts.push([x, yy - pinch]);
      }
      poly(f, pts, { stroke: `rgba(66,153,225,${0.8 - Math.abs(k) * 0.12})`, lw: 2.4 });
      // 箭头（反向）
      const dir = k > 0 ? -1 : 1;
      for (const tt of [0.2, 0.5, 0.8]) {
        const x = 60 + tt * (w - 120);
        const pinch = Math.exp(-Math.pow((x - cx) / 70, 2)) * 44 * Math.sign(k);
        poly(f, [[x + dir * 14, yy - pinch], [x, yy - pinch - 6], [x, yy - pinch + 6]],
          { stroke: C.cool, lw: 1.4, fill: C.cool } as any);
      }
    }
    // X 点与喷流
    dot(f, cx, cy, 7, C.hot);
    text(f, 'X 点（扩散区）：磁力线断开重接', cx - 84, cy - 14, { color: C.hot, font: '12px sans-serif' });
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 4 * rate);
    // 喷流与粒子加速
    for (const s of [-1, 1]) {
      const px = cx + s * (30 + ((f.t * 80 * rate) % (w * 0.34)));
      dot(f, px, cy, 5, `rgba(255,230,140,${0.4 + pulse * 0.6})`);
      poly(f, [[cx + s * w * 0.34, cy], [cx + s * w * 0.34 - s * 18, cy - 8], [cx + s * w * 0.34 - s * 18, cy + 8]],
        { stroke: C.warm, lw: 1.6, fill: C.warm } as any);
    }
    // 重联出的闭合环（上下）
    const arc: [number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      arc.push([cx - 50 + t * 100, cy - 70 - Math.sin(t * Math.PI) * 34 * (0.6 + pulse * 0.4)]);
    }
    poly(f, arc, { stroke: `${C.green}cc`, lw: 2.4 });
    text(f, '磁能爆发式转化为粒子动能与热——能量释放比扩散快千倍', 30, 44, { color: C.green, font: '13px sans-serif' });

    footnotes(f, [
      '磁重联：反向磁力线在扩散区断开重接，磁能瞬间释放——等离子体最剧烈的能量转换',
      '太阳耀斑与日冕物质抛射（10³² J）、磁层亚暴都由它驱动——空间天气的源头',
      '快速重联（Petschek 1964）解释了爆发时标；实验室与 MHD 模拟持续验证中',
    ]);
    heading(f, '磁重联：磁场的断路与爆发');
  },
});
registerViz(magneticReconnection);

/** 惯性约束聚变。 */
const icfInertialConfinement = defineViz({
  slug: 'icf-inertial-confinement', title: '惯性约束聚变', animated: true,
  params: {
    drive: { type: 'range', min: 0, max: 1, default: 0.5, step: 0.05, label: '驱动进度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const drive = num(params, 'drive', 0.5);
    const prog = (f.t * 0.5) % 1;
    const compress = 1 - prog * 0.72;
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    const R = Math.min(w, h) * 0.3;
    // 黑腔（hohlraum）与激光
    if (prog < 0.15) {
      poly(f, [[cx - R, cy - R * 0.6], [cx + R, cy - R * 0.6], [cx + R, cy + R * 0.6], [cx - R, cy + R * 0.6]],
        { stroke: C.dim, lw: 2.6, fill: 'rgba(100,116,139,0.18)' } as any);
      text(f, '金黑腔', cx - 24, cy - R * 0.6 - 12, { color: C.dim, font: '11px sans-serif' });
    }
    // 激光束（NIF 192 束示意）
    const laserA = 0.5 + 0.5 * Math.sin(f.t * 6);
    for (const s of [-1, 1]) {
      for (let k = -2; k <= 2; k++) {
        const yy = cy + k * 34;
        seg(f, cx + s * (w * 0.46), yy, cx + s * R * 0.9, yy, `rgba(255,80,80,${laserA})`, 2.2);
      }
    }
    text(f, '192 束激光 → X 射线烧蚀', 30, 44, { color: C.hot, font: '13px sans-serif' });
    // 燃料丸（压缩中）
    const rFuel = R * 0.42 * compress;
    f.ctx.beginPath(); f.ctx.arc(cx, cy, rFuel, 0, Math.PI * 2);
    f.ctx.fillStyle = `rgba(66,153,225,${0.4 + prog * 0.4})`; f.ctx.fill();
    f.ctx.strokeStyle = C.cool; f.ctx.lineWidth = 2.4; f.ctx.stroke();
    // 内爆射流与点火闪光
    if (prog > 0.75) {
      const flash = Math.min((prog - 0.75) / 0.2, 1);
      f.ctx.beginPath(); f.ctx.arc(cx, cy, rFuel + flash * 70, 0, Math.PI * 2);
      f.ctx.strokeStyle = `rgba(255,250,200,${1 - flash})`;
      f.ctx.lineWidth = 5; f.ctx.stroke();
      text(f, '点火！热核燃烧波传播', cx + 60, cy - 60, { color: '#fffbeb', font: '14px sans-serif' });
    }
    // 压缩比标注
    const ratio = (1 / Math.max(compress, 0.28)).toFixed(1);
    text(f, `内爆压缩 ~${ratio}×：密度达铅的百倍、中心 1 亿℃ 维持数十皮秒`, 30, h - 34, { color: C.cyan, font: '13px sans-serif' });
    void drive;

    footnotes(f, [
      'ICF：用激光驱动向心内爆压缩氘氚靶丸——与磁约束（托卡马克）并行的聚变路线',
      'NIF 2022 首次实现科学净增益（Q>1，激光能量→聚变能量）——点火里程碑',
      '瑞利-泰勒不稳定性是内爆对称性的天敌——靶丸涂层与激光整形都在对抗它',
    ]);
    heading(f, '惯性约束聚变：激光点火');
  },
});
registerViz(icfInertialConfinement);
