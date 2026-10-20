import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** 麦克斯韦方程组。 */
const maxwellEquations = defineViz({
  slug: 'maxwell-equations', title: '麦克斯韦方程组', animated: true,
  params: {
    kind: { type: 'select', options: ['积分形式', '微分形式'], default: '微分形式', label: '形式' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const diff = String((params as Record<string, unknown>)['kind'] ?? '').includes('微分');
    clear(f);
    const rows: [string, string, string][] = diff ? [
      ['∇·E = ρ/ε₀', '电荷是电场之源', C.hot],
      ['∇·B = 0', '无磁单极子', C.cool],
      ['∇×E = −∂B/∂t', '变化磁场产生电场', C.green],
      ['∇×B = μ₀J + μ₀ε₀∂E/∂t', '电流+变化电场产生磁场', C.warm],
    ] : [
      ['∮E·dA = Q/ε₀', '通量=面内电荷/ε₀', C.hot],
      ['∮B·dA = 0', '穿进等于穿出', C.cool],
      ['∮E·dl = −dΦ_B/dt', '法拉第感应', C.green],
      ['∮B·dl = μ₀I + …', '安培-麦克斯韦定律', C.warm],
    ];
    for (let i = 0; i < rows.length; i++) {
      const y = 92 + i * 74;
      const pulse = 0.7 + 0.3 * Math.sin(f.t * 2 + i);
      poly(f, [[40, y - 30], [w - 40, y - 30], [w - 40, y + 30], [40, y + 30]],
        { stroke: rows[i][2], lw: 1.6, fill: `${rows[i][2]}14` } as any);
      text(f, rows[i][0], 60, y + 6, { color: rows[i][2], font: `${(15 + pulse * 2).toFixed(0)}px serif` });
      text(f, rows[i][1], w * 0.56, y + 5, { color: C.dim, font: '13px sans-serif' });
    }
    text(f, diff ? '四个方程写尽全部经典电磁——位移电流补上第四个' : '麦克斯韦 1865《电磁通论》：一个体系统一电、磁、光', 30, 46, { color: C.cyan, font: '14px sans-serif' });

    footnotes(f, [
      '位移电流项 μ₀ε₀∂E/∂t 是麦克斯韦的补笔——它让电荷守恒自洽并预言电磁波',
      '光被证明就是电磁波：c=1/√(μ₀ε₀) 纯由电磁常数算出',
      '爱因斯坦相对论正是从这组方程与伽利略变换的矛盾出发——经典物理的顶点与裂缝',
    ]);
    heading(f, '麦克斯韦方程：经典物理的完成');
  },
});
registerViz(maxwellEquations);

/** 坡印廷矢量。 */
const poyntingVector = defineViz({
  slug: 'poynting-vector', title: '坡印廷矢量与能流', animated: true,
  params: {
    demo: { type: 'select', options: ['电磁波能流', '直流传能'], default: '电磁波能流', label: '场景' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const dc = String((params as Record<string, unknown>)['demo'] ?? '').includes('直流');
    clear(f);
    if (!dc) {
      // E×B 能流（横波）
      const yMid = h / 2 + 6;
      const ptsE: [number, number][] = [];
      const ptsB: [number, number][] = [];
      const sPts: [number, number][] = [];
      for (let i = 0; i <= 300; i++) {
        const x = 60 + (i / 300) * (w - 120);
        const ph = (i / 300) * Math.PI * 4 - f.t * 4;
        ptsE.push([x, yMid - Math.sin(ph) * 74]);
        ptsB.push([x, yMid - Math.sin(ph + Math.PI / 2) * 44 * 0]);
        // S 方向（恒向右，强度波动）
        sPts.push([x, yMid + 60]);
      }
      poly(f, ptsE, { stroke: C.hot, lw: 2.6 });
      poly(f, ptsB, { stroke: C.cool, lw: 2.2 });
      // B 场（画成小叉/点示意垂直纸面）
      for (let i = 0; i < 16; i++) {
        const x = 70 + i * ((w - 140) / 16);
        const ph = i * 0.5 - f.t * 4;
        const bz = Math.sin(ph + Math.PI / 2);
        text(f, bz > 0 ? '⊙' : '⊗', x, yMid + 16, { color: C.cool, font: '13px sans-serif' });
      }
      // 能流箭头
      for (let k = 0; k < 6; k++) {
        const x = 80 + ((f.t * 60 + k * 60) % (w - 180));
        poly(f, [[x, yMid + 56], [x + 18, yMid + 56], [x + 9, yMid + 48]], { stroke: C.green, lw: 1.8, fill: C.green } as any);
      }
      text(f, 'E（红）× B（蓝）= S（绿）：能流垂直于两者，以光速前进', 30, 44, { color: C.cyan, font: '13px sans-serif' });
      text(f, 'S = E×B/μ₀：太阳光每平方米 1361W（太阳常数）就用它算', 30, h - 34, { color: C.warm, font: '12px sans-serif' });
    } else {
      // 直流线缆的能流（坡印廷矢量在导线外环绕）
      const cx = w / 2, cy = h / 2 + 6;
      poly(f, [[60, cy - 14], [w - 60, cy - 14], [w - 60, cy + 14], [60, cy + 14]],
        { stroke: C.dim, lw: 2.4, fill: 'rgba(100,116,139,0.35)' } as any);
      // 电子漂移（慢）
      for (let k = 0; k < 8; k++) {
        const x = 70 + ((f.t * 10 + k * 40) % (w - 150));
        dot(f, x, cy, 4, C.cool);
      }
      // 环绕的能流（上方入下方出？实际 E×S 指向线内=供给电阻）
      for (let k = 0; k < 10; k++) {
        const x = 80 + k * ((w - 170) / 10);
        const ph = (f.t * 1.4 + k * 0.4) % 1;
        poly(f, [[x + ph * 14, cy - 46], [x + ph * 14 + 12, cy - 46], [x + ph * 14 + 6, cy - 36]],
          { stroke: C.green, lw: 1.6, fill: C.green } as any);
      }
      text(f, '能量不在线内流动——在导线外的电磁场中（Poynting 1884）', 30, 44, { color: C.green, font: '13px sans-serif' });
      text(f, 'S 斜指向轴线：场把能量交给导线电阻变成热', 30, h - 34, { color: C.warm, font: '12px sans-serif' });
    }

    footnotes(f, [
      '坡印廷定理：∂u/∂t + ∇·S = −J·E——场的能量密度与能流的守恒账本',
      '反直觉的事实：直流输电的能量在导线外的场里跑，电子只是极慢的搬运工',
      '辐射压与光镊：S/c 给出动量流——激光能抓住微粒（2018 诺奖相关）',
    ]);
    heading(f, '坡印廷矢量：能量在场中流动');
  },
});
registerViz(poyntingVector);

/** 位移电流。 */
const displacementCurrent = defineViz({
  slug: 'displacement-current', title: '位移电流', animated: true,
  params: {
    demo: { type: 'select', options: ['电容器充电回路', '真空中的位移流'], default: '电容器充电回路', label: '演示' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    clear(f);
    const cy = h / 2 + 6;
    // 回路与电容器
    const cx = w * 0.5;
    const plateGap = 54;
    const charge = 0.5 + 0.5 * Math.sin(f.t * 2);
    // 导线回路
    seg(f, 70, cy - 60, cx - plateGap - 4, cy - 60, C.cool, 3);
    seg(f, 70, cy - 60, 70, cy + 60, C.cool, 3);
    seg(f, 70, cy + 60, cx - plateGap - 4, cy + 60, C.cool, 3);
    seg(f, cx + plateGap + 4, cy - 60, w - 70, cy - 60, C.cool, 3);
    seg(f, w - 70, cy - 60, w - 70, cy + 60, C.cool, 3);
    seg(f, w - 70, cy + 60, cx + plateGap + 4, cy + 60, C.cool, 3);
    // 两板
    seg(f, cx - plateGap, cy - 76, cx - plateGap, cy + 76, C.hot, 5);
    seg(f, cx + plateGap, cy - 76, cx + plateGap, cy + 76, C.cool, 5);
    // 电荷累积
    for (let k = -5; k <= 5; k++) {
      text(f, charge > 0.5 ? '+' : '−', cx - plateGap - 14, cy + k * 26 + 4, { color: C.hot, font: '13px sans-serif' });
      text(f, charge > 0.5 ? '−' : '+', cx + plateGap + 6, cy + k * 26 + 4, { color: C.cool, font: '13px sans-serif' });
    }
    // 间隙中的位移电流（E 增强）
    for (let k = -3; k <= 3; k++) {
      const y = cy + k * 22;
      const amp = 0.4 + 0.6 * Math.abs(Math.sin(f.t * 2));
      seg(f, cx - plateGap + 6, y, cx + plateGap - 6, y, `rgba(255,170,80,${amp * 0.8})`, 1.8);
    }
    text(f, '间隙无电荷流，但 ∂E/∂t ≠ 0 —— 位移电流 I_d = ε₀ dΦ_E/dt', 30, 44, { color: C.warm, font: '14px sans-serif' });
    text(f, '它接上了安培定律的断点：∮B·dl = μ₀(I + I_d) 处处自洽', 30, 66, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      "麦克斯韦 1861 用'位移电流'补全安培定律——纯理论动机却预言了电磁波",
      '变化的电场向四周辐射磁场——电磁波不需要任何介质在真空中自我推演',
      "电容器在高频电路里是'通交流'的：位移电流就是它的物理面孔",
    ]);
    heading(f, '位移电流：补上最后一块拼图');
  },
});
registerViz(displacementCurrent);

/** 推迟势与因果。 */
const retardedPotential = defineViz({
  slug: 'retarded-potential', title: '推迟势与电磁因果', animated: true,
  params: {
    v: { type: 'range', min: 0, max: 1.6, default: 0.4, step: 0.1, label: '源速度 v/c' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const beta = num(params, 'v', 0.4);
    const gamma = beta < 1 ? 1 / Math.sqrt(1 - Math.min(beta, 0.98) ** 2) : 1;
    clear(f);
    const cy = h / 2 + 6;
    // 运动源与其历史球面波（推迟位置）
    const prog = (f.t * 0.4) % 1;
    const sx = 70 + prog * (w - 160);
    dot(f, sx, cy, 9, C.warm);
    text(f, '源（现在）', sx - 24, cy - 20, { color: C.warm, font: '11px sans-serif' });
    // 历史波前（从过去位置发出的球截面）
    for (let k = 1; k <= 5; k++) {
      const age = ((prog * 3 + k * 0.6) % 3);
      const origin = sx - age * (w * 0.18) * Math.max(beta, 0.05);
      const r = age * (w * 0.18);
      const alpha = Math.max(0.06, 0.5 - age * 0.15);
      f.ctx.beginPath();
      f.ctx.arc(origin, cy, r, -Math.PI / 2.4, Math.PI / 2.4);
      f.ctx.strokeStyle = `rgba(102,126,234,${alpha})`;
      f.ctx.lineWidth = 2.2; f.ctx.stroke();
      void gamma;
    }
    text(f, '观测者收到的是源在 t−r/c 时刻的信息——场以有限速度传播', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    if (beta > 1) {
      text(f, 'v>c：波面堆积成激波锥（切伦科夫辐射的前身）', 30, 66, { color: C.hot, font: '13px sans-serif' });
    }
    // 公式
    text(f, 'φ(r,t) = q/4πε₀·1/(r−v·r̂/c)', w * 0.5 - 120, h - 34, { color: C.warm, font: '14px serif' });

    footnotes(f, [
      '推迟势承认信息传播要时间：现在的位置由过去的状态决定——电磁的因果结构',
      '超前势（提前解）同样满足方程，却被因果律与边界条件排除——时间箭头的物理',
      '拉莫尔公式（加速电荷辐射）与天线滞后相位都从推迟势直接积分而来',
    ]);
    heading(f, '推迟势：场带着过去的记忆');
  },
});
registerViz(retardedPotential);

/** 多极辐射。 */
const multipoleRadiation = defineViz({
  slug: 'multipole-radiation', title: '多极辐射', animated: true,
  params: {
    kind: { type: 'select', options: ['电偶极', '电四极/磁偶极'], default: '电偶极', label: '主导项' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const quad = String((params as Record<string, unknown>)['kind'] ?? '').includes('四极');
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    if (!quad) {
      // 电偶极振荡辐射图（8字形）
      const lobes: [number, number][] = [];
      for (let a = -Math.PI / 2; a <= Math.PI * 1.5; a += 0.04) {
        const r = Math.abs(Math.cos(a)) * Math.min(w, h) * 0.3 * (1 + 0.06 * Math.sin(f.t * 3));
        lobes.push([cx + r * Math.cos(a) * 0.7, cy + r * Math.sin(a)]);
      }
      poly(f, [...lobes, lobes[0]], { stroke: C.accent, lw: 2.6, fill: 'rgba(66,153,225,0.14)' } as any);
      // 振荡偶极子
      const dip = Math.sin(f.t * 4) * 34;
      dot(f, cx, cy - dip, 9, C.hot);
      dot(f, cx, cy + dip, 9, C.cool);
      seg(f, cx, cy - dip - 8, cx, cy - 80, `${C.dim}aa`, 1.6);
      seg(f, cx, cy + dip + 8, cx, cy + 80, `${C.dim}aa`, 1.6);
      text(f, '电偶极 ∝ ω⁴：辐射最强的主导项——天线、原子自发辐射皆是它', 30, 44, { color: C.cyan, font: '13px sans-serif' });
      text(f, '图样：沿偶极轴零辐射、垂直方向最强（8 字形）', 30, 66, { color: C.warm, font: '12px sans-serif' });
    } else {
      // 四极四瓣图
      const petals: [number, number][] = [];
      for (let a = 0; a <= Math.PI * 2 + 0.05; a += 0.03) {
        const r = Math.abs(Math.sin(2 * a)) * Math.min(w, h) * 0.32 * (1 + 0.05 * Math.sin(f.t * 3));
        petals.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      poly(f, [...petals, petals[0]], { stroke: C.green, lw: 2.6, fill: 'rgba(16,185,129,0.16)' } as any);
      dot(f, cx, cy, 7, C.warm);
      text(f, '四极辐射 ∝ ω⁶：四瓣角分布——核 γ 跃迁与分子振动的主要通道', 30, 44, { color: C.cyan, font: '13px sans-serif' });
      text(f, '偶极被禁戒时四极/磁偶极才登场——谱线选择定则的辐射版', 30, 66, { color: C.warm, font: '12px sans-serif' });
    }

    footnotes(f, [
      '多极展开按 1/r 阶次组织辐射：偶极 ≫ 四极 ≫ 八极——高阶逐级变弱',
      '原子自发辐射的爱因斯坦 A 系数本质是电偶极矩阵元——量子电动力学的经典前身',
      '引力波没有偶极辐射（质心守恒）——只能从四极起步：LIGO 听的是四极之歌',
    ]);
    heading(f, '多极辐射：电磁波的等级制');
  },
});
registerViz(multipoleRadiation);
