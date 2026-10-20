import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** 宇宙暴胀。 */
const cosmicInflation = defineViz({
  slug: 'cosmic-inflation', title: '宇宙暴胀', animated: true,
  params: {
    N: { type: 'range', min: 40, max: 70, default: 60, step: 1, label: 'e-折叠数 N' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const Ne = num(params, 'N', 60);
    clear(f);
    const x0 = 60, y0 = h - 60, y1 = 70;
    const vv = view(f, { xMin: 0, xMax: 70, yMin: -8, yMax: 8, inset: 50 });
    grid(f, vv, { divisions: 4, ticks: true });
    // 暴胀子场滚下势能坡（慢滚）
    const phi = (t: number): number => 6 * Math.exp(-t / 26) + 1.2 * Math.sin(t / 8) * Math.exp(-t / 40);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const t = (i / 300) * 70;
      pts.push([vv.sx(t), vv.sy(phi(t))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.8 });
    // 滚动的场点
    const tNow = ((f.t * 6) % 66) + 2;
    dot(f, vv.sx(tNow), vv.sy(phi(tNow)), 8, C.warm);
    // 尺度因子 a(t) 指数插图
    const ix0 = w * 0.62, iy0 = y1 + 90;
    const exp: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      exp.push([ix0 + t * (w - ix0 - 50), iy0 - Math.exp(t * 5.6) * 44]);
    }
    poly(f, exp, { stroke: C.green, lw: 2.4 });
    text(f, 'a(t) ∝ e^(Ht)：32 个数量级的指数膨胀', ix0 + 6, iy0 - 130, { color: C.green, font: '11px sans-serif' });
    text(f, `N=${Ne} e-折叠：10⁻³⁶ 秒内尺寸至少翻 ${Ne} 番 → 视界/平坦性问题一并解决`, 30, 44, { color: C.cyan, font: '14px sans-serif' });

    footnotes(f, [
      '古斯（1981）暴胀：驱动场在势能平坦段慢滚，真空能主导 → 指数膨胀',
      '三个预言全被验证：空间平坦（Ω≈1）、视界问题解决、原初涨落谱（Planck 精密核对）',
      "暴胀结束时场衰变再加热——大爆炸的'热'由此开始（热大爆炸模型）",
    ]);
    heading(f, '暴胀：宇宙诞生第一瞬的指数膨胀');
  },
});
registerViz(cosmicInflation);

/** 宇宙演化时间线。 */
const universeTimeline = defineViz({
  slug: 'universe-timeline', title: '宇宙演化时间线', animated: true,
  params: {
    log: { type: 'select', options: ['对数时间轴', '线性（近现代）'], default: '对数时间轴', label: '刻度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const linear = String((params as Record<string, unknown>)['log'] ?? '').includes('线性');
    clear(f);
    const x0 = 60, x1 = w - 50, yMid = h / 2 + 10;
    seg(f, x0, yMid, x1, yMid, C.grid, 1.6);
    const events: [string, number, string][] = [
      ['普朗克时期 10⁻⁴³s', 0.02, '#9254de'],
      ['暴胀 10⁻³⁶s', 0.1, C.warm],
      ['夸克-胶子等离子体', 0.2, C.hot],
      ['强子形成 10⁻⁶s', 0.3, C.hot],
      ['太初核合成 3min', 0.42, '#ffd600'],
      ['复合（中性原子）38万年', 0.56, C.cool],
      ['暗时代→第一代恒星', 0.66, C.cool],
      ['星系形成 数亿年', 0.74, C.green],
      ['太阳系 92亿年', 0.86, C.warm],
      ['今天 138亿年', 0.97, C.green],
    ];
    for (let i = 0; i < events.length; i++) {
      const [label, tRaw, color] = events[i];
      const t = linear ? 0.55 + tRaw * 0.45 : tRaw;
      const x = x0 + t * (x1 - x0);
      const up = i % 2 === 0;
      const pulse = Math.abs(t - ((f.t * 0.14) % 1)) < 0.04 ? 1 : 0.75;
      seg(f, x, yMid, x, yMid + (up ? -34 : 34), `rgba(${color === C.green ? '16,185,129' : '255,255,255'},0.5)`, 1.4);
      dot(f, x, yMid, 6, color);
      text(f, label, x - 46, yMid + (up ? -44 : 56), { color, font: `${(10 + pulse * 1.5).toFixed(0)}px sans-serif` } as any);
    }
    text(f, linear ? '线性轴：前 40 万年被压缩到左端 0.05%——这就是为什么要对数轴' : '对数时间轴：从 10⁻⁴³s 到 10¹⁷s 全装进一屏', 30, 44, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '宇宙 138 亿年：前 3 分钟造出氢氦锂，38 万年让光自由飞行（CMB），其后引力慢慢雕刻结构',
      '每一步都有观测化石：CMB、原初丰度、最古老恒星、星系红移巡天',
      '对数轴是宇宙学的必需品：线性轴上整个人类史只占一个像素点',
    ]);
    heading(f, '宇宙时间线：138 亿年的十一个台阶');
  },
});
registerViz(universeTimeline);

/** 宇宙视界。 */
const cosmologicalHorizon = defineViz({
  slug: 'cosmological-horizon', title: '宇宙视界与因果', animated: true,
  params: {
    kind: { type: 'select', options: ['粒子视界', '事件视界（加速膨胀）'], default: '粒子视界', label: '类型' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const event = String((params as Record<string, unknown>)['kind'] ?? '').includes('事件');
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    const R = Math.min(w, h) * 0.34;
    // 视界圈
    const pulse = 0.9 + 0.1 * Math.sin(f.t * 2);
    f.ctx.beginPath(); f.ctx.arc(cx, cy, R * pulse, 0, Math.PI * 2);
    f.ctx.setLineDash([9, 6]);
    f.ctx.strokeStyle = event ? C.hot : C.cool;
    f.ctx.lineWidth = 2.6; f.ctx.stroke();
    f.ctx.setLineDash([]);
    // 圈内可因果联系的星系
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const rr = R * (0.25 + ((k * 37) % 60) / 100);
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (Math.hypot(x - cx, y - cy) < R * pulse) dot(f, x, y, 4, C.cool);
      else dot(f, x, y, 4, `${C.hot}aa`);
    }
    // 中心观测者
    dot(f, cx, cy, 7, C.green);
    text(f, '我们', cx + 10, cy + 4, { color: C.green, font: '11px sans-serif' });
    // 光信号脉冲
    const ph = (f.t * 0.5) % 1;
    f.ctx.beginPath(); f.ctx.arc(cx, cy, ph * R * pulse, 0, Math.PI * 2);
    f.ctx.strokeStyle = `rgba(255,255,255,${0.6 - ph * 0.5})`; f.ctx.lineWidth = 2; f.ctx.stroke();
    text(f, event
      ? '事件视界：加速膨胀下，未来也永远到不了的区域（de Sitter 屏障）'
      : '粒子视界：光从大爆炸至今能走的距离——465 亿光年（共动）',
      30, 44, { color: event ? C.hot : C.cyan, font: '13px sans-serif' });
    text(f, '圈外星系的光尚未到达我们：CMB 就是视界之墙的投影', 30, 66, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '粒子视界随时间增长：更多区域进入因果——但宇宙加速膨胀时事件视界反而收缩',
      '视界外的星系正以超光速退行（空间膨胀不违反相对论）——永远失去联系',
      '视界内约 2×10⁷⁹ 个恒星系（可观测宇宙）；视界外是否无限——不可检验的边界',
    ]);
    heading(f, '宇宙视界：因果的围墙');
  },
});
registerViz(cosmologicalHorizon);

/** 暗能量状态方程。 */
const darkEnergyEos = defineViz({
  slug: 'dark-energy-eos', title: '暗能量状态方程', animated: true,
  params: {
    w: { type: 'range', min: -1.6, max: -0.4, default: -1, step: 0.05, label: '状态方程参数 w' },
  },
  draw: (f) => {
    const { w: W, h, params } = f;
    const w0 = num(params, 'w', -1);
    clear(f);
    const x0 = 60, y0 = h - 56, y1 = 60;
    const vv = view(f, { xMin: 0, xMax: 1, yMin: 0, yMax: 1.6, inset: 50 });
    grid(f, vv, { divisions: 4, ticks: true });
    // 能量密度演化 ρ ∝ a^(−3(1+w))
    const expo = -3 * (1 + w0);
    const pts: [number, number][] = [];
    for (let i = 1; i <= 200; i++) {
      const a = (i / 200) * 1;
      const rho = Math.pow(Math.max(a, 0.05), expo);
      if (rho < 1.65) pts.push([vv.sx(a), vv.sy(rho)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 3 });
    // 参考线
    const ref: [number, number][] = [];
    for (let i = 1; i <= 100; i++) {
      const a = i / 100;
      ref.push([vv.sx(a), vv.sy(Math.pow(Math.max(a, 0.05), 0))]);
    }
    poly(f, ref, { stroke: `${C.green}88`, lw: 1.6, dash: [7, 5] } as any);
    text(f, '绿虚线：w=−1（宇宙学常数 ρ 恒定）', vv.sx(0.06), vv.sy(1.5), { color: C.green, font: '12px sans-serif' });
    const aNow = 1;
    dot(f, vv.sx(aNow), vv.sy(Math.min(Math.pow(1, expo), 1.6)), 7, C.warm);
    void x0; void y0; void y1; void W;
    text(f, `ρ_де ∝ a^(−3(1+w))：w=${w0.toFixed(2)} → ${w0 < -1.02 ? '幻能（密度随膨胀增加，大撕裂风险）' : w0 > -0.98 ? '精质（密度被稀释，暗能量渐弱）' : '真空能：密度永恒不变'}`,
      30, 44, { color: C.cyan, font: '14px sans-serif' });

    footnotes(f, [
      'w=p/ρ 是暗能量的身份证：w=−1 是宇宙学常数的判据（Planck+BAO 联合约束 −1.03±0.03）',
      'Ia 超新星 1998 发现加速膨胀（2011 诺奖）：DES、DESI 与 Euclid 正在测 w 是否随时间变',
      '若 w≠−1：暗能量是动态场（quintessence/phantom）——宇宙命运随之改写',
    ]);
    heading(f, '暗能量状态方程：宇宙加速的密码');
  },
});
registerViz(darkEnergyEos);

/** 哈勃张力。 */
const hubbleTension = defineViz({
  slug: 'hubble-tension', title: '哈勃张力', animated: true,
  params: {
    method: { type: 'select', options: ['两种测法对比', '距离阶梯细节'], default: '两种测法对比', label: '视角' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const ladder = String((params as Record<string, unknown>)['method'] ?? '').includes('阶梯');
    clear(f);
    const x0 = 70, y0 = h - 60, y1 = 70;
    if (!ladder) {
      // 两种测量的钟形分布
      const vv = view(f, { xMin: 64, xMax: 76, yMin: 0, yMax: 1.2, inset: 50 });
      grid(f, vv, { divisions: 4, ticks: true });
      const gauss = (x: number, mu: number, s: number): number => Math.exp(-((x - mu) ** 2) / (2 * s * s));
      const p1: [number, number][] = [];
      const p2: [number, number][] = [];
      for (let i = 0; i <= 240; i++) {
        const x = 64 + (i / 240) * 12;
        p1.push([vv.sx(x), vv.sy(gauss(x, 67.4, 0.8))]);
        p2.push([vv.sx(x), vv.sy(gauss(x, 73.0, 1.0))]);
      }
      poly(f, p1, { stroke: C.cool, lw: 2.8 });
      poly(f, p2, { stroke: C.hot, lw: 2.8 });
      // 间隙标注
      const pulse = 0.6 + 0.4 * Math.sin(f.t * 3);
      seg(f, vv.sx(67.4), vv.sy(1.12), vv.sx(73), vv.sy(1.12), `rgba(255,214,0,${pulse})`, 2.4);
      text(f, 'ΔH ≈ 5.6 km/s/Mpc（>4σ）', vv.sx(68.4), vv.sy(1.12) - 8, { color: '#ffd600', font: '13px sans-serif' });
      text(f, '蓝：早期宇宙（CMB+ΛCDM 外推）67.4±0.5', vv.sx(64.4), vv.sy(0.5), { color: C.cool, font: '12px sans-serif' });
      text(f, '红：晚期宇宙（距离阶梯直接测）73.0±1.0', vv.sx(69.6), vv.sy(0.4), { color: C.hot, font: '12px sans-serif' });
      text(f, '两条路线都可靠，数字却对不上——新物理的可能裂缝', 30, 44, { color: C.cyan, font: '14px sans-serif' });
    } else {
      // 距离阶梯
      const rungs: [string, string][] = [
        ['造父变星 / Ia 超新星', '几何视差锚定'],
        ['SH0ES：JWST 复核造父', '阶梯逐级放大误差'],
        ['TRGB / JAGB 新方法', '系统差排查中'],
      ];
      for (let i = 0; i < rungs.length; i++) {
        const y = y1 + 40 + i * 76;
        poly(f, [[x0, y - 26], [w - 50, y - 26], [w - 50, y + 26], [x0, y + 26]],
          { stroke: `${C.cool}aa`, lw: 1.8, fill: 'rgba(66,153,225,0.10)' } as any);
        text(f, `${i + 1}. ${rungs[i][0]}`, x0 + 16, y - 4, { color: C.cyan, font: '13px sans-serif' });
        text(f, rungs[i][1], x0 + 16, y + 16, { color: C.dim, font: '11px sans-serif' });
        if (i < 2) {
          const pulse = ((f.t * 0.7 + i * 0.3) % 1);
          dot(f, (x0 + w / 2), y + 26 + pulse * 24, 5, `rgba(255,214,0,${1 - pulse})`);
        }
      }
      text(f, '每一级都可能带入系统误差——张力是测法问题还是新物理？', 30, 44, { color: C.warm, font: '14px sans-serif' });
      void y0;
    }

    footnotes(f, [
      '哈勃常数是宇宙膨胀的当前速率：73 vs 67 的 8% 差距超出全部已知误差预算',
      '若张力为真：ΛCDM 需要暗物质之外的新组分、早期暗能量或中微子新性质',
      '2024-2025 年争论白热化：JWST 确认造父、DESI 暗示 w 随时间变——可能正在改写教科书',
    ]);
    heading(f, '哈勃张力：宇宙学的新裂缝？');
  },
});
registerViz(hubbleTension);

/** 重子不对称。 */
const matterAntimatter = defineViz({
  slug: 'matter-antimatter', title: '重子不对称', animated: true,
  params: {
    eta: { type: 'range', min: 0, max: 1, default: 1, step: 0.05, label: '对称破缺程度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const asym = num(params, 'eta', 1);
    clear(f);
    // 湮灭对 + 残余物质
    const cy = h * 0.4;
    const kept = asym;
    for (let k = 0; k < 10; k++) {
      const ph = ((f.t * 0.7 + k * 0.13) % 1);
      const x = 80 + k * ((w - 160) / 9);
      if (ph < 0.65) {
        // 成对
        dot(f, x - 8, cy, 5, C.cool);
        dot(f, x + 8, cy, 5, C.hot);
      } else {
        // 湮灭成光子（k 个未复活的）
        const isKept = k < Math.round(kept * 10);
        if (isKept) {
          dot(f, x, cy, 6, C.cool);
        } else {
          const g = (ph - 0.65) / 0.35;
          f.ctx.beginPath();
          f.ctx.arc(x, cy, 4 + g * 14, 0, Math.PI * 2);
          f.ctx.strokeStyle = `rgba(255,255,255,${1 - g * 0.8})`;
          f.ctx.lineWidth = 1.6; f.ctx.stroke();
        }
      }
    }
    text(f, '湮灭后残留：十亿分之一的物质幸存——今天的全部星系与我们', 30, 44, { color: C.cool, font: '14px sans-serif' });
    // 计数
    const mCount = 10, aCount = Math.round(10 * (1 - asym));
    text(f, `物质 : 反物质 ≈ (1+η) : (1−η)，η~6×10⁻¹⁰（CMB 精密测定）`, 30, h - 60, { color: C.cyan, font: '13px sans-serif' });
    text(f, `图示当前比例：物质 ${mCount}、反物质 ${aCount}`, 30, h - 34, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '萨哈罗夫三条件（1967）：重子数破坏、C/CP 破坏、偏离热平衡——缺一不可',
      'CP 破坏已在 B 介子与 K 介子系统观测，但强度不足以解释 10⁻¹⁰ 的不对称',
      '反物质在哪里？丁肇中 AMS 实验在空间搜寻反氦——答案仍是：我们是孤本',
    ]);
    heading(f, '重子不对称：十亿分之一的幸存者');
  },
});
registerViz(matterAntimatter);
