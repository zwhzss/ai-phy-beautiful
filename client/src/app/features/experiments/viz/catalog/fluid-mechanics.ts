import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text, view } from '../canvas';

/** P66 文丘里管。 */
const venturi = defineViz({
  slug: 'venturi', title: '文丘里管', animated: true,
  params: {
    Q: { type: 'range', min: 0.5, max: 3, default: 1.5, step: 0.1, label: '流量（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const Q = num(params, 'Q', 1.5);
    clear(f);
    const cy = h / 2 + 6, x0 = 60, x1 = w - 60;
    const R0 = 54, Rn = 24; // 粗/细段半径
    const neck = (x0 + x1) / 2;
    const halfAt = (x: number): number => {
      const d = Math.abs(x - neck);
      const w2 = (x1 - x0) * 0.16;
      return Rn + (R0 - Rn) * Math.min(1, d / w2);
    };
    const top: [number, number][] = [], bot: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const x = x0 + (i / 120) * (x1 - x0);
      top.push([x, cy - halfAt(x)]);
      bot.push([x, cy + halfAt(x)]);
    }
    poly(f, [...top, ...bot.reverse()], { stroke: C.dim, lw: 2.4, fill: 'rgba(56,130,215,0.10)' } as any);
    // 流速箭头（细处快）
    for (let i = 1; i < 8; i++) {
      const x = x0 + (i / 8) * (x1 - x0);
      const v = Q * (R0 / halfAt(x)) * 26;
      seg(f, x - v / 2, cy, x + v / 2, cy, `${C.cool}cc`, 2);
      poly(f, [[x + v / 2, cy], [x + v / 2 - 8, cy - 5], [x + v / 2 - 8, cy + 5]], { stroke: C.cool, lw: 1.4, fill: C.cool } as any);
    }
    // 压强读数（伯努利）
    const pThroat = 1 - Math.pow(R0 / Rn, 4) * 0.0;
    text(f, `连续性 A₁v₁ = A₂v₂：细处流速 ≈ 粗处 ${(Math.pow(R0 / Rn, 2)).toFixed(1)} 倍`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, `压强差 Δp ≈ ½ρ(v₂²−v₁²)（细处压强更低）${pThroat > 0 ? '' : ''}`, 30, h - 40, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '喷油器、化油器、文丘里流量计都靠这段收缩管：流速换压强',
      '飞机机翼上表面的加速与这里同理——伯努利方程的工程三连：连续性、伯努利、静压',
      '注意适用条件：无黏、定常、不可压；真实管道要补黏性损失（达西公式）',
    ]);
    heading(f, '文丘里管：流速换压强');
  },
});
registerViz(venturi);

/** P67 泊肃叶流。 */
const poiseuille = defineViz({
  slug: 'poiseuille', title: '泊肃叶流',
  params: {
    eta: { type: 'range', min: 0.5, max: 5, default: 2, step: 0.1, label: '黏度 η（相对）' },
    dp: { type: 'range', min: 1, max: 10, default: 5, step: 0.5, label: '压差 Δp（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const eta = num(params, 'eta', 2), dp = num(params, 'dp', 5);
    clear(f);
    const x0 = 70, x1 = w - 70, cy = h / 2 + 6, R = 70;
    // 管壁
    seg(f, x0, cy - R, x1, cy - R, C.dim, 3);
    seg(f, x0, cy + R, x1, cy + R, C.dim, 3);
    // 抛物线速度剖面 v(r)=vmax(1-r²/R²)
    const vMax = (dp / eta) * 60;
    const prof: [number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const r = -R + (i / 60) * 2 * R;
      const v = vMax * (1 - (r * r) / (R * R));
      prof.push([x0 + 20 + v, cy + r]);
    }
    poly(f, prof, { stroke: C.accent, lw: 2.6 });
    // 速度矢量
    for (let k = -3; k <= 3; k++) {
      const r = (k / 3) * R * 0.92;
      const v = vMax * (1 - (r * r) / (R * R));
      seg(f, x0 + 20, cy + r, x0 + 20 + v, cy + r, `${C.cool}aa`, 1.6);
      poly(f, [[x0 + 20 + v, cy + r], [x0 + 14 + v, cy + r - 4], [x0 + 14 + v, cy + r + 4]], { stroke: C.cool, lw: 1.2, fill: C.cool } as any);
    }
    text(f, `v(r) = v_max·(1 − r²/R²)　v_max ∝ Δp/η = ${(dp / eta).toFixed(2)}`, 30, 44, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      `黏度 η=${eta}、压差 Δp=${dp}：流量 Q = πR⁴Δp/(8ηL) —— 半径四次方是主宰`,
      '管径减半流量降到十六分之一：血管阻力对半径极度敏感（泊肃叶定律的生理学）',
      '层流条件：雷诺数 Re = ρvD/η 低于约 2300，超过则转湍流',
    ]);
    heading(f, '泊肃叶流：抛物线剖面与四次方定律');
  },
});
registerViz(poiseuille);

/** P68 马格努斯效应。 */
const magnus = defineViz({
  slug: 'magnus', title: '马格努斯效应', animated: true,
  params: {
    spin: { type: 'range', min: -30, max: 30, default: 18, step: 1, label: '自旋 (rev/s，负=反旋)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const spin = num(params, 'spin', 18);
    const curve = Math.max(-1, Math.min(1, spin / 30));
    clear(f);
    const x0 = 60, x1 = w - 60, cy = h / 2 + 6;
    // 球轨迹（香蕉球弧线）
    const path: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * (x1 - x0);
      const bend = curve * 140 * Math.pow(t / (x1 - x0), 2);
      path.push([x0 + t, cy - bend]);
    }
    poly(f, path, { stroke: `${C.dim}aa`, lw: 1.6, dash: [6, 5] } as any);
    const prog = ((f.t * 0.4) % 1);
    const bx = x0 + prog * (x1 - x0);
    const by = cy - curve * 140 * Math.pow(prog, 2);
    dot(f, bx, by, 15, C.warm);
    // 自旋箭头
    text(f, spin >= 0 ? '↻' : '↺', bx - 7, by + 5, { color: '#fff', font: '15px sans-serif' });
    // 受力：升力垂直速度
    const slope = -curve * 280 * prog / (x1 - x0);
    const nx = -slope / Math.sqrt(1 + slope * slope), ny = 1 / Math.sqrt(1 + slope * slope);
    seg(f, bx, by, bx + nx * 52, by - ny * 52, C.hot, 2.4);
    text(f, 'F_升力', bx + nx * 56, by - ny * 56 + 4, { color: C.hot, font: '11px sans-serif' });
    text(f, `自旋 ${spin} rev/s → 轨迹${curve > 0.1 ? '右' : curve < -0.1 ? '左' : '几乎'}偏转`, 30, 44, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '旋转球带动一侧空气加速：该侧压强低，压差把球推向弯道内侧（马格努斯力）',
      '足球香蕉球、乒乓球弧圈球、高尔夫后旋上飘全是它——自旋方向决定弯曲方向',
      '同一原理造出 Flettner 转子船：旋转圆柱当帆，省油新船仍在试航',
    ]);
    heading(f, '马格努斯效应：旋转制造弯道');
  },
});
registerViz(magnus);

/** P69 升力曲线与攻角。 */
const liftCurve = defineViz({
  slug: 'lift-curve', title: '升力曲线与攻角',
  params: {
    clmax: { type: 'range', min: 1, max: 2.5, default: 1.6, step: 0.1, label: '最大升力系数' },
    stall: { type: 'range', min: 8, max: 25, default: 16, step: 1, label: '失速角 (°)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const clMax = num(params, 'clmax', 1.6), aStall = num(params, 'stall', 16);
    clear(f);
    const x0 = 56, x1 = w - 30, y0 = h - 60, y1 = 56;
    seg(f, x0, y0, x1, y0, C.grid, 1.3);
    seg(f, x0, (y0 + y1) / 2, x1, (y0 + y1) / 2, C.grid, 1.3);
    const sx = (a: number) => x0 + ((a + 4) / 28) * (x1 - x0);
    const sy = (cl: number) => (y0 + y1) / 2 - cl * ((y0 - y1) / 2) / 2.6;
    const clOf = (a: number): number => {
      if (a < -4) return NaN;
      if (a <= aStall) return (clMax / aStall) * a;
      // 失速后骤降
      return Math.max(clMax * 0.35, clMax * Math.exp(-(a - aStall) * 0.28)) * (a < aStall + 16 ? 1 : 0);
    };
    const pts: [number, number][] = [];
    for (let i = 0; i <= 240; i++) {
      const a = -4 + (i / 240) * 28;
      const cl = clOf(a);
      if (!isNaN(cl)) pts.push([sx(a), sy(cl)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.8 });
    // 失速角标记
    seg(f, sx(aStall), y0, sx(aStall), y1, `${C.hot}aa`, 1.4);
    text(f, '失速角', sx(aStall) + 6, y1 + 12, { color: C.hot, font: '11px sans-serif' });
    dot(f, sx(aStall), sy(clMax), 6, C.warm);
    text(f, `C_L(max) = ${clMax}`, sx(aStall) + 8, sy(clMax) - 8, { color: C.warm, font: '12px sans-serif' });
    text(f, '攻角 α (°)', x1 - 4, y0 + 18, { align: 'right', color: C.dim, font: '12px sans-serif' });
    text(f, '升力系数 C_L', x0 + 6, y1 - 6, { color: C.accent, font: '12px sans-serif' });

    footnotes(f, [
      '小攻角内升力近似线性（薄翼理论 C_L≈2πα）；过失速角气流分离、升力崩塌',
      '失速是机翼的悬崖：飞行员训练的第一要务是感知接近失速（抖振、攻角指示）',
      '襟翼与缝翼增大桥段弯度，让 C_L 最大值提升——起飞着陆靠它们低速托举',
    ]);
    heading(f, '升力曲线：攻角的甜点与悬崖');
  },
});
registerViz(liftCurve);

/** P70 边界层。 */
const boundaryLayer = defineViz({
  slug: 'boundary-layer', title: '边界层', animated: true,
  params: {
    Re: { type: 'range', min: 100, max: 5000, default: 1200, step: 100, label: '雷诺数（×100）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const Re = num(params, 'Re', 1200) * 100;
    const turbulent = Re > 3e5 ? 1 : Re > 2e5 ? 0.5 : 0; // 示意阈值
    clear(f);
    const plateY = h / 2 + 60;
    // 平板
    poly(f, [[70, plateY], [w - 60, plateY], [w - 60, plateY + 26], [70, plateY + 26]], { stroke: C.dim, lw: 2, fill: 'rgba(100,116,139,0.25)' } as any);
    text(f, '平板（来流 →）', 76, plateY + 54, { color: C.dim, font: '11px sans-serif' });
    // 速度剖面族 + 边界层厚度增长 δ ∝ √x（层流）
    const deltaAt = (x: number): number => 6 * Math.sqrt((x - 70) / 60) + 2;
    for (let k = 1; k <= 6; k++) {
      const xp = 70 + k * ((w - 140) / 6);
      const d = deltaAt(xp);
      const prof: [number, number][] = [];
      for (let i = 0; i <= 30; i++) {
        const y = plateY - (i / 30) * d;
        const ratio = Math.min(1, (plateY - y) / d);
        const prof2 = Math.sqrt(ratio);
        prof.push([xp, y]);
        void prof2;
      }
      // 用速度矢量近似剖面
      for (let i = 1; i <= 5; i++) {
        const frac = i / 5;
        const y = plateY - frac * d;
        const vlen = 10 + frac * 34;
        seg(f, xp, y, xp + vlen, y, `${C.cool}bb`, 1.4);
      }
      poly(f, prof, { stroke: `${C.hot}99`, lw: 1.6 });
    }
    // 边界层外缘
    const edge: [number, number][] = [];
    for (let x = 70; x <= w - 60; x += 6) edge.push([x, plateY - deltaAt(x)]);
    poly(f, edge, { stroke: C.hot, lw: 2, dash: [7, 5] } as any);
    text(f, 'δ(x) 边界层厚度 ∝ √x（层流）', w - 60, plateY - deltaAt(w - 60) - 10, { align: 'right', color: C.hot, font: '11px sans-serif' });
    text(f, `Re = ${Re.toExponential(1)}（${turbulent > 0 ? '转捩区/湍流' : '层流'}）`, 30, 44, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '紧贴壁面的速度从零升到来流值——这层薄薄的剪切区承担了几乎全部摩擦阻力',
      '边界层分离产生压差阻力：流线型设计的目的就是让边界层多走一段再分离',
      '层流转捩到湍流由雷诺数决定；湍流边界层抗分离能力反而更强（高尔夫球凹坑同理）',
    ]);
    heading(f, '边界层：摩擦与分离发生的地方');
  },
});
registerViz(boundaryLayer);

/** P71 瑞利-泰勒不稳定性。 */
const rayleighTaylor = defineViz({
  slug: 'rayleigh-taylor', title: '瑞利-泰勒不稳定性', animated: true,
  params: {
    amp: { type: 'range', min: 0.2, max: 1.5, default: 0.8, step: 0.1, label: '初始扰动幅度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const A = num(params, 'amp', 0.8);
    clear(f);
    // 界面演化：重（上）压轻（下）→ 扰动指数增长出蘑菇指状
    const iface = h * 0.44;
    f.ctx.fillStyle = 'rgba(90,100,120,0.55)';
    f.ctx.fillRect(0, 0, w, iface);
    f.ctx.fillStyle = 'rgba(80,160,255,0.30)';
    f.ctx.fillRect(0, iface, w, h - iface);
    const growth = Math.exp(Math.min(f.t, 6) * 0.5);
    const pts: [number, number][] = [[0, iface]];
    for (let x = 0; x <= w; x += 5) {
      const ph = Math.sin(x * 0.045) + 0.6 * Math.sin(x * 0.093 + 1.7);
      const y = iface + ph * A * 14 * growth * Math.exp(-Math.abs(x - w / 2) / (w * 0.9));
      pts.push([x, Math.min(y, h - 30)]);
    }
    pts.push([w, iface]);
    poly(f, pts, { stroke: C.warm, lw: 2.4 });
    text(f, '重流体（密度 ρ₁）', 26, 30, { color: '#cbd5e0', font: '12px sans-serif' });
    text(f, '轻流体（密度 ρ₂ < ρ₁）', 26, h - 24, { color: '#90cdf4', font: '12px sans-serif' });
    text(f, `扰动增长 γ = √(A·g·Δρ/ρ) — 当前放大 ${growth.toFixed(1)}×`, 30, iface - 44, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '重流体在上、轻流体在下（有效重力反向）时界面必然不稳定——轻微扰动长成蘑菇状指状',
      '惯性约束聚变的燃料靶丸内爆、超新星爆发的喷发结构都受它支配',
      '另一种同源现象：不同密度液体混合时的漂亮花纹（朗之万对流）',
    ]);
    heading(f, '瑞利-泰勒：重压轻的界面之花');
  },
});
registerViz(rayleighTaylor);

/** P72 瑞利-贝纳德对流胞。 */
const convectionCell = defineViz({
  slug: 'convection-cell', title: '瑞利-贝纳德对流胞', animated: true,
  params: {
    Ra: { type: 'range', min: 500, max: 5000, default: 2000, step: 100, label: '瑞利数 Ra（×100）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const Ra = num(params, 'Ra', 2000) * 100;
    const ordered = Ra > 1708; // 临界瑞利数（经典值）
    clear(f);
    // 六角形胞（俯视）
    const cx = w / 2, cy = h / 2 + 6, cell = Math.min(w, h) * 0.16;
    const hex = (x: number, y: number, r: number): [number, number][] => {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        pts.push([x + r * Math.cos(a), y + r * Math.sin(a) * 0.86]);
      }
      return pts;
    };
    if (ordered) {
      const pulse = 0.85 + 0.15 * Math.sin(f.t * 2);
      for (let row = -1; row <= 1; row++) {
        for (let col = -2; col <= 2; col++) {
          const x = cx + col * cell * 1.72 + (row % 2 ? cell * 0.86 : 0);
          const y = cy + row * cell * 1.5;
          if (Math.hypot(x - cx, y - cy) > Math.min(w, h) * 0.44) continue;
          poly(f, hex(x, y, cell * 0.92), { stroke: `${C.cool}cc`, lw: 1.6, fill: `rgba(56,130,215,${0.10 * pulse})` } as any);
          dot(f, x, y, 3, C.warm);
        }
      }
      text(f, '有序对流胞（六角形，流体上下翻腾形成定常花纹）', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    } else {
      const rand = (i: number): number => Math.abs(Math.sin(i * 91.7) * 43758.5) % 1;
      for (let i = 0; i < 60; i++) {
        const x = 30 + rand(i) * (w - 60);
        const y = 30 + rand(i + 40) * (h - 70);
        dot(f, x, y, 3, `${C.dim}66`);
      }
      text(f, 'Ra < 1708：热传导主导，流体静止无序', 30, 44, { color: C.dim, font: '13px sans-serif' });
    }
    text(f, `Ra = ${Ra.toExponential(1)}（临界 ≈ 1708）`, 30, h - 34, { color: ordered ? C.green : C.dim, font: '12px sans-serif' });

    footnotes(f, [
      '下热上冷的流体层，温差超过临界值后浮力压过黏性与扩散——对流突然自组织出现',
      '这是分岔理论与耗散结构的经典标本：无序中长出六角形有序（普里戈金的贝纳德实验）',
      '大气对流胞、太阳米粒组织（对流）都是同一不稳定性的宏大版本',
    ]);
    heading(f, '贝纳德对流：自组织的六角花纹');
  },
});
registerViz(convectionCell);

/** P73 空化。 */
const cavitation = defineViz({
  slug: 'cavitation', title: '空化', animated: true,
  params: {
    speed: { type: 'range', min: 5, max: 40, default: 18, step: 1, label: '来流速度 (m/s)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const v = num(params, 'speed', 18);
    const active = v > 12;
    clear(f);
    const cx = w * 0.3, cy = h / 2 + 6;
    // 螺旋桨叶片截面（旋转）
    const rot = f.t * 6;
    for (let k = 0; k < 3; k++) {
      const a = rot + (k * Math.PI * 2) / 3;
      const pts: [number, number][] = [];
      for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        const r = 14 + t * 46;
        const spread = Math.sin(t * Math.PI) * 16;
        pts.push([cx + Math.cos(a) * r - Math.sin(a) * spread, cy + Math.sin(a) * r + Math.cos(a) * spread]);
      }
      poly(f, pts, { stroke: C.cool, lw: 2, fill: 'rgba(66,153,225,0.25)' } as any);
    }
    dot(f, cx, cy, 8, C.dim);
    // 来流线
    for (let k = -2; k <= 2; k++) {
      const y = cy + k * 40;
      const flow: [number, number][] = [];
      for (let x = cx + 60; x < w - 30; x += 8) flow.push([x, y + Math.sin(x * 0.03 + f.t * 3) * 4]);
      poly(f, flow, { stroke: `${C.cool}55`, lw: 1.2 });
    }
    // 气泡（低压区生成、下游溃灭闪光）
    if (active) {
      for (let i = 0; i < 16; i++) {
        const ph = ((f.t * 1.4 + i * 0.17) % 1);
        const bx = cx + 60 + ph * (w * 0.5);
        const by = cy + ((i % 5) - 2) * 18 * (1 - ph * 0.4);
        const r = (1 - ph) * 6 + 2;
        f.ctx.beginPath(); f.ctx.arc(bx, by, r, 0, Math.PI * 2);
        f.ctx.strokeStyle = `rgba(255,255,255,${0.85 - ph * 0.7})`; f.ctx.lineWidth = 1.5; f.ctx.stroke();
        if (ph > 0.75) dot(f, bx, by, 3, C.hot); // 溃灭
      }
    }
    text(f, active ? `v=${v} m/s：叶片背面低压 → 汽化成泡 → 下游高压溃灭（空化噪声/剥蚀）` : `v=${v} m/s：未达空化阈值，气泡不生成`,
      30, 44, { color: active ? C.hot : C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      "伯努利效应的破坏性一面：局部压强跌破饱和蒸汽压，液体'沸腾'出空泡",
      "空泡溃灭产生微射流与冲击波——螺旋桨、水轮机叶面被'点蚀'得千疮百孔",
      '超声空化反而有用：清洗精密零件、声化学与医学碎石都靠受控空化',
    ]);
    heading(f, '空化：低压区的沸腾与破坏');
  },
});
registerViz(cavitation);
