import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, circle, curve, dot, footnotes, grid, heading, poly, seg, text, view, rng, vec } from '../canvas';

/** DNA 双螺旋与 X 射线衍射。 */
const dnaDiffraction = defineViz({
  slug: 'dna-diffraction', title: 'DNA 双螺旋与 X 射线衍射', animated: true,
  params: { humidity: { type: 'range', min: 40, max: 98, default: 92, step: 2, label: '纤维湿度 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const wet = num(params, 'humidity', 92);
    clear(f);
    const bx = w * 0.3, by = h * 0.48;
    // Photo 51：X 形衍射斑纹
    const pulse = 0.6 + 0.4 * Math.sin(f.t * 2);
    for (const s of [-1, 1]) {
      for (let i = 1; i <= 6; i++) {
        const r = 14 + i * 17;
        const alpha = (0.9 - i * 0.11) * pulse;
        dot(f, bx + s * r * 0.62, by - r, 5.4, `rgba(102,126,234,${alpha})`);
        dot(f, bx - s * r * 0.62, by + r, 5.4, `rgba(102,126,234,${alpha})`);
      }
    }
    // 层线（水平条纹 = 碱基间距 0.34 nm）
    for (const s of [-1, 1]) {
      poly(f, [[bx - 76, by + s * 106], [bx + 76, by + s * 106], [bx + 76, by + s * 113], [bx - 76, by + s * 113]],
        { stroke: 'transparent', fill: `rgba(56,178,172,${0.5 + 0.3 * pulse})` });
    }
    circle(f, bx, by, 84, { stroke: `${C.dim}66`, lw: 1.4, dash: [5, 5] });
    text(f, 'Photo 51：交叉层线暴露螺旋', bx - 96, by - 128, { color: C.cyan, font: '12px sans-serif' });
    text(f, '交叉角 → 螺距；层线间距 → 0.34 nm 碱基堆叠', bx - 116, by + 140, { color: C.dim, font: '11px sans-serif' });
    // 右：双螺旋示意
    const sx = w * 0.72;
    for (let i = 0; i <= 60; i++) {
      const t = (i / 60);
      const y = 80 + t * (h - 190);
      const a1 = t * Math.PI * 4 + f.t * 0.8;
      const x1 = sx + Math.sin(a1) * 40;
      const x2 = sx + Math.sin(a1 + Math.PI) * 40;
      if (i > 0) {
        seg(f, sx + Math.sin(((i - 1) / 60) * Math.PI * 4 + f.t * 0.8) * 40, 80 + ((i - 1) / 60) * (h - 190), x1, y, C.cool, 3);
        seg(f, sx + Math.sin(((i - 1) / 60) * Math.PI * 4 + Math.PI + f.t * 0.8) * 40, 80 + ((i - 1) / 60) * (h - 190), x2, y, C.warm, 3);
      }
      if (i % 5 === 0) seg(f, x1, y, x2, y, `${C.green}aa`, 2);
    }
    text(f, wet < 65 ? '干燥纤维 → A 型（更粗更短）' : '湿润纤维 → B 型（经典 Watson-Crick）', sx - 92, h - 96,
      { color: wet < 65 ? C.warm : C.green, font: '12px sans-serif' });
    footnotes(f, [
      '富兰克林坚持先解决含水量——B 型 DNA 的照片出自她对湿度的控制',
      '沃森与克里克用层线数据反推螺旋参数，再搭模型——衍射加建模的范式',
      '碱基配对互补立刻暗示复制机制：结构即功能的第一课',
    ]);
    heading(f, 'Photo 51：一张照片定下双螺旋');
  },
});
registerViz(dnaDiffraction);

/** 蛋白质折叠与能量景观。 */
const proteinFolding = defineViz({
  slug: 'protein-folding', title: '蛋白质折叠与能量景观', animated: true,
  params: { temp: { type: 'range', min: 20, max: 80, default: 37, step: 1, label: '温度 (℃)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const T = num(params, 'temp', 37);
    clear(f);
    // 漏斗（等高线）
    const cx = w * 0.38, cy = h * 0.5;
    for (let k = 1; k <= 7; k++) {
      const r = k * 34;
      const pts: [number, number][] = [];
      for (let i = 0; i <= 70; i++) {
        const a = (i / 70) * Math.PI * 2;
        const rough = 1 + Math.sin(a * 6 + k) * 0.08;
        pts.push([cx + Math.cos(a) * r * rough, cy + Math.sin(a) * r * rough * 0.78]);
      }
      poly(f, pts, { stroke: `rgba(66,153,225,${0.85 - k * 0.09})`, lw: 1.8 });
    }
    dot(f, cx, cy, 9, C.green);
    text(f, '天然态（深井）', cx - 44, cy + 34, { color: C.green, font: '11px sans-serif' });
    // 折叠轨迹（动画随机游走下漏斗）
    const rand = rng(42);
    const step = (f.t * 0.8) % 1;
    const tr: [number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const t = (i / 40) * step;
      const r = (1 - t) * 236;
      const a = t * 7 + rand() * 0.6;
      tr.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.78]);
    }
    if (tr.length > 1) poly(f, tr, { stroke: `rgba(237,137,54,0.9)`, lw: 2.6 });
    dot(f, tr[tr.length - 1][0], tr[tr.length - 1][1], 6, C.warm);
    // 错折叠陷阱
    dot(f, cx + 130, cy - 92, 10, `${C.hot}cc`);
    text(f, '错折叠陷阱→', cx + 140, cy - 96, { color: C.hot, font: '11px sans-serif' });
    // 右侧：自由能曲线
    const v = view(f, { xMin: 0, xMax: 1, yMin: -0.2, yMax: 1.2, inset: 46, insetBottom: 96 });
    const g: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const q = i / 120;
      const barrier = Math.exp(-Math.pow((q - 0.55) * 6, 2)) * (T / 37) * 0.5;
      g.push([v.sx(q), v.sy(0.9 - q * 0.75 + barrier + Math.sin(q * 24) * 0.05)]);
    }
    poly(f, g, { stroke: C.accent, lw: 3 });
    text(f, '反应坐标 →（展开 → 折叠）', w - 200, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, `T=${T}℃：${T > 60 ? '高温破坏弱相互作用——热变性展开' : '体温下漏斗顺畅——弱相互作用协同导向天然态'}`,
      30, 44, { color: T > 60 ? C.hot : C.cyan, font: '13px sans-serif' });
    footnotes(f, [
      '折叠靠氢键、疏水与范德华的集体协作——没有一步靠蛮力',
      'Levinthal 悖论：穷举需百亿年，实际只需微秒——漏斗给出答案',
      '错折叠滑进错误深井并互相模板化——淀粉样纤维的物理起源',
    ]);
    heading(f, '能量景观：折叠是一场下坡竞赛');
  },
});
registerViz(proteinFolding);

/** 分子马达。 */
const molecularMotor = defineViz({
  slug: 'molecular-motor', title: '分子马达', animated: true,
  params: { load: { type: 'range', min: 0, max: 60, default: 10, step: 5, label: '负载 (pN)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const load = num(params, 'load', 10);
    clear(f);
    const y = h * 0.52;
    // 微管（轨道）
    seg(f, 60, y, w - 60, y, C.cool, 8);
    for (let x = 70; x < w - 60; x += 34) seg(f, x, y - 6, x, y + 6, `${C.bg}aa`, 2);
    text(f, '微管（轨道）', 60, y + 34, { color: C.cool, font: '11px sans-serif' });
    // 驱动蛋白两头行走
    const stall = 60;
    const speed = Math.max(0, 1 - load / (stall * 1.3));
    const gx = 90 + ((f.t * 60 * speed) % (w - 240));
    const stepPhase = Math.floor(f.t * 6 * speed) % 2;
    // 头部（交替）
    circle(f, gx, y - 40, 17, { fill: 'rgba(237,137,54,0.9)' });
    circle(f, gx + 30 + stepPhase * 8, y - 66, 17, { fill: 'rgba(236,201,75,0.9)' });
    seg(f, gx, y - 40, gx + 30 + stepPhase * 8, y - 66, C.warm, 3);
    // 颈部与货物
    seg(f, gx + 15, y - 52, gx + 26, y - 110, C.dim, 3);
    circle(f, gx + 30, y - 134, 26, { stroke: C.green, lw: 3, fill: 'rgba(72,187,120,0.3)' });
    text(f, '货物', gx + 12, y - 130, { color: C.green, font: '11px sans-serif' });
    text(f, 'ATP → ADP+Pi（化学能）', gx - 60, y - 6, { color: C.warm, font: '10px sans-serif' });
    // 脚迹（8 nm 步距）
    for (let i = 0; i < 8; i++) {
      const x = 90 + i * 46;
      if (x < w - 80) dot(f, x, y + 18, 3, `${C.dim}aa`);
    }
    text(f, '每步 8 nm（一个 tubulin 二聚体）', 90, y + 54, { color: C.dim, font: '11px sans-serif' });
    // 负载与速度
    const by = h - 130;
    text(f, `负载 ${load} pN：${load < 45 ? `前进速度约 ${(speed * 100).toFixed(0)}%（自由值）` : '接近失速（stall ≈ 50-60 pN）——马达开始倒走'}`,
      40, by, { color: load < 45 ? C.cyan : C.hot, font: '13px sans-serif' });
    poly(f, [[40, by + 20], [40 + speed * (w - 140), by + 20], [40 + speed * (w - 140), by + 44], [40, by + 44]],
      { stroke: 'transparent', fill: 'rgba(66,153,225,0.55)' });
    text(f, '力-速度曲线：化学步进被外负载拖慢直到失速', 40, by + 68, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '马达在热噪声里定向——棘轮式不对称势能面把布朗运动变成方向',
      '单分子光镊实测力与步距——统计力学的涨落定理第一次可直接称量',
      'ATP 合酶旋转马达与它互为镜像：一个造 ATP、一个花 ATP',
    ]);
    heading(f, '分子马达：8 纳米的舞步');
  },
});
registerViz(molecularMotor);

/** 细胞膜与脂双层。 */
const cellMembrane = defineViz({
  slug: 'cell-membrane', title: '细胞膜与脂双层', animated: true,
  params: { temp: { type: 'range', min: 5, max: 45, default: 30, step: 1, label: '温度 (℃)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const T = num(params, 'temp', 30);
    const fluid = T > 20;
    clear(f);
    const mid = h * 0.5;
    // 脂双层剖面
    const rand = rng(7);
    for (let i = 0; i < 46; i++) {
      const x = 40 + i * ((w - 90) / 46);
      const jitter = fluid ? Math.sin(f.t * 2 + i * 0.7) * 5 : 0;
      // 上层头尾
      dot(f, x + jitter, mid - 62, 9, `rgba(102,126,234,0.9)`);
      seg(f, x + jitter, mid - 54, x + jitter, mid - 12, `${C.dim}cc`, 2.4);
      dot(f, x - jitter, mid + 62, 9, `rgba(102,126,234,0.9)`);
      seg(f, x - jitter, mid + 54, x - jitter, mid + 12, `${C.dim}cc`, 2.4);
      void rand;
    }
    text(f, '亲水头（磷酸基）', 40, mid - 78, { color: '#667eea', font: '11px sans-serif' });
    text(f, '疏水尾（脂肪酸）', 40, mid + 96, { color: C.dim, font: '11px sans-serif' });
    // 膜蛋白（漂移）
    const px = w * 0.5 + (fluid ? Math.sin(f.t * 0.7) * 60 : 0);
    poly(f, [[px - 30, mid - 76], [px + 30, mid - 76], [px + 22, mid + 76], [px - 22, mid + 76]],
      { stroke: C.green, lw: 3, fill: 'rgba(72,187,120,0.35)' });
    text(f, '整合膜蛋白', px + 36, mid - 40, { color: C.green, font: '11px sans-serif' });
    // 通道蛋白（开合）
    const cx2 = w * 0.78;
    const open = Math.sin(f.t * 3) > 0;
    poly(f, [[cx2 - 34, mid - 76], [cx2 - 10, mid - 76], [cx2 - (open ? 24 : 8), mid + 76], [cx2 - 34, mid + 76]],
      { stroke: C.cool, lw: 3, fill: 'rgba(66,153,225,0.3)' });
    poly(f, [[cx2 + 10, mid - 76], [cx2 + 34, mid - 76], [cx2 + 34, mid + 76], [cx2 + (open ? 24 : 8), mid + 76]],
      { stroke: C.cool, lw: 3, fill: 'rgba(66,153,225,0.3)' });
    text(f, open ? '通道开放' : '通道关闭', cx2 - 30, mid - 88, { color: C.cool, font: '11px sans-serif' });
    // 状态
    text(f, T < 15 ? '低温：凝胶态——脂链冻结、膜变脆' : '生理温度：流动态——膜是二维液体，蛋白自由漂移',
      30, 44, { color: T < 15 ? C.hot : C.cyan, font: '13px sans-serif' });
    text(f, `当前 T=${T}℃${T < 15 ? '（相变点以下）' : ''}；胆固醇在中间充当流动性缓冲剂`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '双层自发形成——疏水效应是热力学的必然，不需要模板',
      '流动镶嵌模型（1972）终结了膜的静态结构之争',
      '病毒入侵、囊泡融合与神经递质释放都靠这层软界面完成',
    ]);
    heading(f, '细胞膜：一张会流动的国境线');
  },
});
registerViz(cellMembrane);

/** 膜电位与离子通道。 */
const membranePotential = defineViz({
  slug: 'membrane-potential', title: '膜电位与离子通道', animated: true,
  params: { kk: { type: 'range', min: 1, max: 40, default: 5, step: 1, label: '外/内 K⁺ 浓度比 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const ratio = num(params, 'kk', 5) / 100;
    clear(f);
    // 膜两侧离子
    const mid = w * 0.5;
    poly(f, [[mid - 16, 70], [mid + 16, 70], [mid + 16, h - 110], [mid - 16, h - 110]],
      { stroke: C.dim, lw: 3, fill: 'rgba(100,116,139,0.3)' });
    text(f, '膜', mid - 12, 60, { color: C.dim, font: '11px sans-serif' });
    const rand = rng(11);
    const nIn = 26, nOut = Math.max(1, Math.round(26 * ratio * 4));
    for (let i = 0; i < nIn; i++) dot(f, mid - 60 - rand() * (w * 0.3), 90 + rand() * (h - 240), 6, `rgba(66,153,225,0.85)`);
    for (let i = 0; i < nOut; i++) dot(f, mid + 60 + rand() * (w * 0.3), 90 + rand() * (h - 240), 6, `rgba(237,137,54,0.85)`);
    text(f, 'K⁺（内高：30:5）', 40, h - 84, { color: C.cool, font: '12px sans-serif' });
    text(f, 'Na⁺（外高）', w - 240, h - 84, { color: C.warm, font: '12px sans-serif' });
    // 泵
    const pump = 0.5 + 0.5 * Math.sin(f.t * 3);
    circle(f, mid, h - 148, 24, { stroke: `rgba(72,187,120,${pump})`, lw: 3, fill: 'rgba(72,187,120,0.2)' });
    text(f, '钠钾泵（3Na 出/2K 进）', mid + 34, h - 142, { color: C.green, font: '11px sans-serif' });
    // 电位读数
    const E = 26.7 * Math.log(Math.max(0.01, ratio)) / Math.LN10 * 10;
    const vNow = Math.max(-100, Math.min(0, E * 1.15 - 10 + Math.sin(f.t * 2) * 2));
    text(f, `能斯特电位 E = (RT/F)·ln([K]out/[K]in) = ${vNow.toFixed(0)} mV`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 电压条
    const bx = 40, by = 74, bw = w - 90;
    poly(f, [[bx, by], [bx + bw, by], [bx + bw, by + 26], [bx, by + 26]],
      { stroke: `${C.grid}aa`, lw: 1.4, fill: 'rgba(45,55,72,0.6)' });
    const fillW = bw * (Math.abs(vNow) / 110);
    poly(f, [[bx, by], [bx + fillW, by], [bx + fillW, by + 26], [bx, by + 26]],
      { stroke: 'transparent', fill: 'rgba(66,153,225,0.75)' });
    text(f, `${vNow.toFixed(0)} mV（静息约 −70 mV）`, bx + fillW + 10, by + 19, { color: C.cool, font: '12px sans-serif' });
    text(f, '浓度差 + 选择通透 = 电压；泵只负责维持浓度差', 30, h - 96, { color: C.warm, font: '13px sans-serif' });
    footnotes(f, [
      '能斯特平衡是浓度差与电场力的拔河——谁也不肯让步就停在电位上',
      '钠钾泵每循环烧一个 ATP，神经细胞两成能量花在这上面',
      '静息电位是所有电生理的地基：心电、脑电、肌电都从它出发',
    ]);
    heading(f, '膜电位：细胞的充电电池');
  },
});
registerViz(membranePotential);

/** 神经动作电位。 */
const actionPotential = defineViz({
  slug: 'action-potential', title: '神经动作电位', animated: true,
  params: { stim: { type: 'range', min: 0, max: 40, default: 25, step: 5, label: '刺激强度' } },
  draw: (f) => {
    const { w, h, params } = f;
    const stim = num(params, 'stim', 25);
    clear(f);
    const v = view(f, { xMin: 0, xMax: 10, yMin: -90, yMax: 50, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 8, ticks: true });
    // 阈值线
    const thr = -55;
    seg(f, v.sx(0), v.sy(thr), v.sx(10), v.sy(thr), `${C.hot}aa`, 1.6, );
    text(f, '阈值 −55 mV', v.sx(0.1), v.sy(thr) - 8, { color: C.hot, font: '11px sans-serif' });
    seg(f, v.sx(0), v.sy(-70), v.sx(10), v.sy(-70), `${C.dim}aa`, 1.2, );
    text(f, '静息 −70 mV', v.sx(0.1), v.sy(-70) + 16, { color: C.dim, font: '11px sans-serif' });
    // 动作电位（随动画推进）
    const fire = stim >= 25;
    const prog = (f.t * 1.6) % 1.3;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const t = (i / 300) * 10;
      let y = -70;
      if (fire) {
        if (t > 2 && t < 2.6) y = -70 + ((t - 2) / 0.6) * 45;         // 去极
        else if (t >= 2.6 && t < 3.4) y = -25 - ((t - 2.6) / 0.8) * 90; // 下冲
        else if (t >= 3.4 && t < 5.5) y = -115 + ((t - 3.4) / 2.1) * 45; // 复极回稳
        else if (t >= 5.5) y = -70;
      } else if (t > 2 && t < 3) y = -70 + Math.sin(((t - 2) / 1) * Math.PI) * (stim / 40) * 30;
      pts.push([v.sx(t), v.sy(y)]);
      if (t > prog * 10) break;
    }
    poly(f, pts, { stroke: fire ? C.green : C.warm, lw: 3.2 });
    if (fire) {
      text(f, '+40 mV 峰值（Na⁺ 内流）', v.sx(2.62), v.sy(46), { color: C.green, font: '11px sans-serif' });
      text(f, '超射后的不应期', v.sx(3.7), v.sy(-124), { color: C.dim, font: '11px sans-serif' });
    }
    text(f, fire ? '全或无：超过阈值就发完整一炮，强度不改波形' : '未达阈值：只有局部电位，随即衰减',
      56, 44, { color: fire ? C.cyan : C.warm, font: '13px sans-serif' });
    text(f, '时间 →（ms）', w - 120, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '膜电位 (mV)', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    text(f, `当前刺激 ${stim}：${fire ? '触发动作电位' : '低于阈值（需 ≥25）'}`, 30, h - 96, { color: fire ? C.green : C.warm, font: '13px sans-serif' });
    footnotes(f, [
      '钠通道爆发后迅速失活——这就是不应期，也是信号不回头的原因',
      '电位沿轴突自我再生、不衰减传导——电话线与它正相反',
      '髓鞘让信号跳跃传导——多发性硬化正是髓鞘受损的后果',
    ]);
    heading(f, '动作电位：全或无的钠浪');
  },
});
registerViz(actionPotential);

/** 血液流变与法-朗效应。 */
const bloodRheology = defineViz({
  slug: 'blood-rheology', title: '血液流变与法-朗效应', animated: true,
  params: { hct: { type: 'range', min: 20, max: 70, default: 45, step: 5, label: '血细胞比容 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const hct = num(params, 'hct', 45);
    clear(f);
    // 左：剪切变稀曲线
    const v = view(f, { xMin: 0, xMax: 10, yMin: 0, yMax: 6, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    const base = hct / 45;
    const eta: [number, number][] = [];
    for (let i = 1; i <= 200; i++) {
      const g = (i / 200) * 10;
      eta.push([v.sx(g), v.sy(0.6 + 4.4 * base / (1 + g * 0.9))]);
    }
    poly(f, eta, { stroke: C.hot, lw: 3.4 });
    const gNow = ((f.t * 2) % 10) + 0.1;
    const etaNow = 0.6 + 4.4 * base / (1 + gNow * 0.9);
    dot(f, v.sx(gNow), v.sy(etaNow), 8, C.green);
    text(f, '表观黏度 η', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    text(f, '剪切率 γ̇ →', w - 130, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, `剪切越快越稀：η 从 ${(0.6 + 4.4 * base).toFixed(1)} 掉到 ${(0.6 + 4.4 * base / 10).toFixed(1)}（相对单位）`, 56, 44, { color: C.cyan, font: '13px sans-serif' });
    // 右：缗钱形成
    const cx = w * 0.78, cy = h * 0.42;
    const shear = gNow > 5;
    if (!shear) {
      for (let s = 0; s < 4; s++) {
        for (let k = 0; k < 5; k++) dot(f, cx + Math.sin(f.t + s) * 6, cy - 46 + k * 24 + s * 4, 11, `rgba(245,101,101,0.85)`);
      }
      text(f, '低剪切：红细胞叠成缗钱 → 黏', cx - 78, cy + 88, { color: C.hot, font: '12px sans-serif' });
    } else {
      for (let i = 0; i < 20; i++) {
        const a = f.t * 3 + i;
        dot(f, cx + Math.cos(a + i) * 62, cy + Math.sin(a * 1.3 + i) * 54, 11, `rgba(245,101,101,0.8)`);
      }
      text(f, '高剪切：缗钱散开 → 稀', cx - 64, cy + 88, { color: C.green, font: '12px sans-serif' });
    }
    text(f, `比容 ${hct}%：比容越高整体越稠（贫血时反而过稀）`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '血液是非牛顿流体——毛细管里表观黏度反而更低（Fåhræus-Lindqvist）',
      '心脏做功远低于按牛顿流体估算——剪切变稀是省力的生理红利',
      '病理态下缗钱加剧、微循环受阻——流变指标是心脑血管的风险信号',
    ]);
    heading(f, '血液流变：越流越顺的液体');
  },
});
registerViz(bloodRheology);

/** 协同结合与血红蛋白。 */
const hemoglobin = defineViz({
  slug: 'hemoglobin', title: '协同结合与血红蛋白', animated: true,
  params: { ph: { type: 'range', min: 7.0, max: 7.8, default: 7.4, step: 0.1, label: 'pH' } },
  draw: (f) => {
    const { w, h, params } = f;
    const ph = num(params, 'ph', 7.4);
    clear(f);
    const v = view(f, { xMin: 0, xMax: 110, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 7, ticks: true });
    const bohr = (7.4 - ph) * 0.55; // Bohr 效应：pH 低 → 曲线右移
    // S 形氧解离曲线
    const sat = (p: number) => 1 / (1 + Math.pow(Math.max(1, (p + bohr * 40) / 34), -2.6));
    const pts: [number, number][] = [];
    for (let i = 0; i <= 220; i++) {
      const p = (i / 220) * 110;
      pts.push([v.sx(p), v.sy(sat(p))]);
    }
    poly(f, pts, { stroke: C.hot, lw: 3.4 });
    // 对照：单体（双曲线）
    const mono: [number, number][] = [];
    for (let i = 0; i <= 220; i++) {
      const p = (i / 220) * 110;
      mono.push([v.sx(p), v.sy(1 / (1 + 26 / Math.max(1, p + bohr * 40)))]);
    }
    poly(f, mono, { stroke: `${C.dim}aa`, lw: 2, dash: [6, 5] });
    text(f, '红色 S 形 = 血红蛋白（协同）；虚线 = 单亚基（无协同）', 56, 44, { color: C.cyan, font: '13px sans-serif' });
    // P50
    let p50 = 0;
    for (let p = 1; p <= 110; p++) { if (sat(p) >= 0.5) { p50 = p; break; } }
    seg(f, v.sx(p50), v.sy(0), v.sx(p50), v.sy(0.5), `${C.warm}88`, 1.6, );
    seg(f, v.sx(p50), v.sy(0.5), v.sx(0), v.sy(0.5), `${C.warm}88`, 1.6, );
    dot(f, v.sx(p50), v.sy(0.5), 6, C.warm);
    text(f, `P50 ≈ ${p50.toFixed(0)} mmHg`, v.sx(p50) + 8, v.sy(0.5) - 10, { color: C.warm, font: '12px sans-serif' });
    // 动画点（肺/组织）
    const pulse = Math.sin(f.t * 2) > 0;
    dot(f, v.sx(pulse ? 100 : 26), v.sy(sat(pulse ? 100 : 26)), 9, pulse ? C.green : C.cool);
    text(f, pulse ? '肺（高氧，抓得紧）' : '组织（低氧，放得开）', v.sx(pulse ? 100 : 26) - 60, v.sy(sat(pulse ? 100 : 26)) - 16,
      { color: pulse ? C.green : C.cool, font: '11px sans-serif' });
    text(f, `pH=${ph.toFixed(1)}：${ph < 7.3 ? 'Bohr 效应右移——组织产酸时更易放氧' : '标准位置'}`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    text(f, '氧分压 →（mmHg）', w - 150, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '氧饱和度', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    footnotes(f, [
      '协同性来自四亚基的 T→R 构象切换——第一个结合是开门最难的一步',
      'S 形曲线一头一尾两个平台：肺部装满、组织卸货，效率翻倍',
      'pH、CO₂ 与 2,3-BPG 都能左右曲线——别构调节的教科书样本',
    ]);
    heading(f, '血红蛋白：协同的装氧艺术');
  },
});
registerViz(hemoglobin);

/** 光合作用与光系统。 */
const photosynthesis = defineViz({
  slug: 'photosynthesis', title: '光合作用与光系统', animated: true,
  params: { light: { type: 'range', min: 0, max: 100, default: 70, step: 5, label: '光照强度 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const light = num(params, 'light', 70);
    clear(f);
    // Z 方案：能级阶梯
    const x0 = 90, yBase = h - 140, x1 = w - 90;
    const levels: [number, number, string, string][] = [
      [x0, yBase - 40, 'P680⁺', 'PSII 反应中心'],
      [x0 + 120, yBase - 150, 'P680*', '激发态（光子打入）'],
      [x1 - 200, yBase - 110, 'P700*', 'PSI 激发态'],
      [x1 - 60, yBase - 30, 'NADPH', '还原力输出'],
    ];
    for (const [x, y, name, note] of levels) {
      seg(f, x - 44, y, x + 44, y, C.cool, 4);
      text(f, name, x - 24, y - 12, { color: C.cool, font: '13px sans-serif' });
      text(f, note, x - 44, y + 22, { color: C.dim, font: '10px sans-serif' });
    }
    // 电子传递箭头（动画）
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
    const arrows: [number, number, number, number][] = [
      [x0 + 44, yBase - 40, x0 + 76, yBase - 150],
      [x0 + 164, yBase - 150, x1 - 244, yBase - 110],
      [x1 - 156, yBase - 110, x1 - 104, yBase - 30],
    ];
    for (const [ax, ay, bx, by] of arrows) vec(f, ax, ay, bx, by, `rgba(236,201,75,${0.5 + pulse * 0.5})`, 3);
    // 下行放能（质子泵）
    vec(f, x0 + 164, yBase - 140, x1 - 250, yBase - 60, `rgba(72,187,120,0.8)`, 2.4);
    text(f, '下行放能 → 泵出 H⁺（造 ATP）', x0 + 190, yBase - 76, { color: C.green, font: '11px sans-serif' });
    // 水的氧化
    vec(f, x0 - 66, yBase - 10, x0 - 46, yBase - 36, `rgba(66,153,225,0.9)`, 2.6);
    text(f, '2H₂O → O₂ + 4H⁺ + 4e⁻', x0 - 120, yBase + 14, { color: C.cool, font: '11px sans-serif' });
    // 光子
    for (let i = 0; i < 5; i++) {
      const t = ((f.t * (0.4 + light / 130) + i * 0.2) % 1);
      const px = x0 - 70 + t * 90;
      const py = yBase - 150 - Math.sin(t * Math.PI) * 30;
      dot(f, px, py, 4.4, `rgba(236,201,75,${0.9 - i * 0.12})`);
    }
    text(f, `光照 ${light}%：${light < 25 ? '弱光限制——光反应跟不上暗反应' : '光子充足——电子传递链满负荷'}`,
      30, 44, { color: light < 25 ? C.warm : C.cyan, font: '13px sans-serif' });
    footnotes(f, [
      '水被夺走四个电子放出氧气——地球大气的氧全部是光合的废气',
      '两个光系统串联把电子逐步抬升——Z 方案是能量阶梯的巧妙设计',
      '反应中心的电荷分离效率接近 100%——人工光合至今难以企及',
    ]);
    heading(f, '光合作用：光子拆水的电荷阶梯');
  },
});
registerViz(photosynthesis);

/** 酶与米氏方程。 */
const enzymeKinetics = defineViz({
  slug: 'enzyme-kinetics', title: '酶与米氏方程', animated: true,
  params: { inhibit: { type: 'select', options: ['无抑制', '竞争性抑制', '非竞争性抑制'], default: '无抑制', label: '抑制剂' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = String((params as Record<string, unknown>)['inhibit'] ?? '');
    const comp = mode.includes('竞争'), noncomp = mode.includes('非竞争');
    clear(f);
    const v = view(f, { xMin: 0, xMax: 10, yMin: 0, yMax: 1.15, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 7, ticks: true });
    const vmax = noncomp ? 0.55 : 1;
    const km = comp ? 4.6 : 2.4;
    const curveOf = (k: number, vm: number, color: string, lw: number) => {
      const pts: [number, number][] = [];
      for (let i = 1; i <= 220; i++) {
        const s = (i / 220) * 10;
        pts.push([v.sx(s), v.sy(vm * s / (k + s))]);
      }
      poly(f, pts, { stroke: color, lw });
    };
    curveOf(2.4, 1, `${C.dim}aa`, 2);
    curveOf(km, vmax, noncomp ? C.hot : comp ? C.warm : C.green, 3.4);
    // Vmax 与 Km 标记
    seg(f, v.sx(0), v.sy(vmax), v.sx(10), v.sy(vmax), `${C.cool}99`, 1.4, );
    text(f, `Vmax ${(vmax * 100).toFixed(0)}%`, v.sx(8.6), v.sy(vmax) - 10, { color: C.cool, font: '11px sans-serif' });
    seg(f, v.sx(km), v.sy(0), v.sx(km), v.sy(vmax / 2), `${C.warm}99`, 1.4, );
    dot(f, v.sx(km), v.sy(vmax / 2), 6, C.warm);
    text(f, `Km=${km.toFixed(1)}`, v.sx(km) - 34, v.sy(0) + 24, { color: C.warm, font: '11px sans-serif' });
    // 动画底物点
    const sNow = (f.t * 3) % 10;
    const yNow = vmax * sNow / (km + sNow);
    dot(f, v.sx(sNow), v.sy(yNow), 8, C.green);
    text(f, `V = Vmax·[S]/(Km+[S])：${comp ? '竞争性——Km 变大、Vmax 不变' : noncomp ? '非竞争性——Vmax 腰斩、Km 不变' : '标准米氏曲线'}`,
      56, 44, { color: comp ? C.warm : noncomp ? C.hot : C.green, font: '13px sans-serif' });
    text(f, '底物浓度 [S] →', w - 140, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '反应速率 V', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    text(f, '灰色虚线为无抑制对照——抑制剂的类型看曲线往哪边挪', 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '饱和是酶动力学的指纹：再多底料也快不过活性位点的周转',
      '竞争性抑制与底物抢位置——磺胺药就是这么骗过细菌的',
      'Km 是亲和力的惯用读数，Vmax 是产能上限——一个方程两个参数定药性',
    ]);
    heading(f, '米氏方程：催化的天花板');
  },
});
registerViz(enzymeKinetics);

/** 细菌鞭毛马达。 */
const bacterialFlagellum = defineViz({
  slug: 'bacterial-flagellum', title: '细菌鞭毛马达', animated: true,
  params: { pmf: { type: 'range', min: 20, max: 180, default: 120, step: 10, label: '质子动力势 (mV)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const pmf = num(params, 'pmf', 120);
    clear(f);
    const rpm = pmf * 3;
    const cx = w * 0.4, cy = h * 0.52;
    // 膜
    poly(f, [[40, cy - 96], [w - 40, cy - 96], [w - 40, cy - 60], [40, cy - 60]],
      { stroke: 'rgba(102,126,234,0.7)', lw: 2, fill: 'rgba(102,126,234,0.25)' });
    poly(f, [[40, cy + 60], [w - 40, cy + 60], [w - 40, cy + 96], [40, cy + 96]],
      { stroke: 'rgba(102,126,234,0.7)', lw: 2, fill: 'rgba(102,126,234,0.25)' });
    text(f, '细胞膜', 46, cy - 106, { color: '#667eea', font: '11px sans-serif' });
    // 定子（嵌在膜里）
    for (const s of [-1, 1]) {
      poly(f, [[cx + s * 76 - 16, cy - 96], [cx + s * 76 + 16, cy - 96], [cx + s * 76 + 12, cy + 44], [cx + s * 76 - 12, cy + 44]],
        { stroke: C.warm, lw: 2.6, fill: 'rgba(237,137,54,0.3)' });
    }
    text(f, '定子（质子流经过）', cx + 96, cy - 76, { color: C.warm, font: '11px sans-serif' });
    // 转子（旋转）
    const a = (f.t * rpm * 0.06) % (Math.PI * 2);
    circle(f, cx, cy, 52, { stroke: C.cool, lw: 3.4, fill: 'rgba(66,153,225,0.18)' });
    for (let k = 0; k < 6; k++) {
      const ang = a + (k / 6) * Math.PI * 2;
      seg(f, cx, cy, cx + Math.cos(ang) * 48, cy + Math.sin(ang) * 48, C.cool, 3);
      dot(f, cx + Math.cos(ang) * 48, cy + Math.sin(ang) * 48, 6, C.green);
    }
    // 质子流箭头
    for (const s of [-1, 1]) {
      const flow = ((f.t * 60) % 60);
      dot(f, cx + s * 76, cy - 90 + flow * 1.6, 5, `rgba(236,201,75,${0.9 - flow / 70})`);
    }
    text(f, 'H⁺ 流 → 定子 → 转子（化学渗透偶联）', cx - 130, cy + 122, { color: C.yellow, font: '11px sans-serif' });
    // 鞭毛丝
    const whip = Math.sin(f.t * 6) * 20;
    const flag: [number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      flag.push([cx + t * (w * 0.4), cy - 56 - Math.sin(t * 5 + f.t * 4) * (10 + t * whip)]);
    }
    poly(f, flag, { stroke: C.green, lw: 4 });
    text(f, '鞭毛（螺旋桨）', w * 0.4 + cx - 60, cy - 128, { color: C.green, font: '11px sans-serif' });
    text(f, `质子动力势 ${pmf} mV → 转速约 ${rpm} rpm${pmf > 100 ? '（可正反转切换，实现趋化游走）' : '（动力不足转速下降）'}`,
      30, 44, { color: C.cyan, font: '13px sans-serif' });
    footnotes(f, [
      '不用 ATP，直接吃质子梯度——化学渗透偶联的原教科书案例',
      '每秒上百转、效率接近完美：纳米马达里的工程奇迹',
      '马达可瞬时反转——细菌靠正反转做追逐与躲闪的随机游走',
    ]);
    heading(f, '细菌鞭毛：质子驱动的纳米马达');
  },
});
registerViz(bacterialFlagellum);

/** 肌肉收缩的横桥周期。 */
const muscleContraction = defineViz({
  slug: 'muscle-contraction', title: '肌肉收缩的横桥周期', animated: true,
  params: { ca: { type: 'range', min: 0, max: 100, default: 70, step: 5, label: 'Ca²⁺ 释放 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const ca = num(params, 'ca', 70);
    const active = ca > 30;
    clear(f);
    // 粗丝（肌球蛋白）
    const mid = h * 0.5;
    seg(f, 70, mid, w - 70, mid, C.hot, 12);
    text(f, '粗丝（肌球蛋白）', 70, mid + 34, { color: C.hot, font: '11px sans-serif' });
    // 细丝（肌动蛋白）两条
    for (const s of [-1, 1]) {
      const yy = mid + s * 74;
      seg(f, 70, yy, w - 70, yy, C.cool, 8);
      text(f, '细丝（肌动蛋白）', 70, yy - 14, { color: C.cool, font: '11px sans-serif' });
      // 肌球蛋白头（横桥摆动）
      const n = 10;
      for (let i = 0; i < n; i++) {
        const base = 90 + i * ((w - 190) / n);
        const phase = active ? ((f.t * 2 + i * 0.35) % 1) : 0;
        const reach = active ? Math.sin(phase * Math.PI * 2) : 0;
        const hx = base + reach * 18;
        const hy = mid + s * (mid - 14 - (Math.abs(reach) * 16));
        seg(f, base, mid - s * 6, hx, hy, active ? C.green : `${C.dim}aa`, 3);
        dot(f, hx, hy, 6, active ? C.green : `${C.dim}cc`);
        if (active && phase < 0.4) text(f, '', hx, hy, {});
      }
    }
    // 滑动方向与位移
    const slide = active ? ((f.t * 40) % 60) - 30 : 0;
    vec(f, w * 0.5, h - 116, w * 0.5 + (active ? 60 : 0), h - 116, active ? C.green : C.dim, 4);
    text(f, active ? `细丝滑动中（本周期位移 ${slide.toFixed(0)} 单位）` : '无 Ca²⁺：肌钙蛋白挡住结合位点，横桥无法形成',
      w * 0.5 - 130, h - 96, { color: active ? C.green : C.warm, font: '13px sans-serif' });
    text(f, `Ca²⁺ ${ca}%：${active ? '结合肌钙蛋白 → 暴露位点 → ATP 驱动摆动' : '低于 30% 静息——肌肉舒张'}`,
      30, 44, { color: active ? C.cyan : C.warm, font: '13px sans-serif' });
    text(f, '肌节缩短靠滑动，丝本身不变长——滑丝模型（1954）', 30, h - 66, { color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      '一次横桥循环消耗一个 ATP——肌肉收缩的账单按分子结算',
      '钙离子是开关：神经冲动只负责放钙，真正干活的是横桥',
      '从细菌鞭毛到肌球蛋白，往复马达共享同一套化学-机械转换',
    ]);
    heading(f, '肌肉收缩：上亿台机器同步拉绳');
  },
});
registerViz(muscleContraction);

/** 骨骼与胶原复合力学。 */
const collagenBone = defineViz({
  slug: 'collagen-bone', title: '骨骼与胶原复合力学', animated: true,
  params: { mineral: { type: 'range', min: 30, max: 70, default: 55, step: 2, label: '矿化度 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const min = num(params, 'mineral', 55);
    clear(f);
    // 层状结构放大图
    const x0 = 60, y0 = h * 0.3, bw = w * 0.44, bh = h * 0.34;
    poly(f, [[x0, y0], [x0 + bw, y0], [x0 + bw, y0 + bh], [x0, y0 + bh]],
      { stroke: C.dim, lw: 2.4, fill: 'rgba(45,55,72,0.5)' });
    // 胶原纤维（层间波浪）
    for (let L = 0; L < 5; L++) {
      const yy = y0 + 24 + L * (bh - 40) / 5;
      const pts: [number, number][] = [];
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        pts.push([x0 + t * bw, yy + Math.sin(t * Math.PI * 5 + L) * 9]);
      }
      poly(f, pts, { stroke: `rgba(72,187,120,${0.55 + 0.3 * Math.sin(f.t * 2 + L)})`, lw: 3.4 });
      // 磷灰石晶粒（随矿化度增减）
      const nCryst = Math.round(min / 8);
      for (let c = 0; c < nCryst; c++) {
        const t = (c + 0.5) / nCryst;
        dot(f, x0 + t * bw, yy + Math.sin(t * Math.PI * 5 + L) * 9 + 9, 4.4, `rgba(236,201,75,0.85)`);
      }
    }
    text(f, '绿=胶原纤维（韧性）／黄=羟基磷灰石晶粒（刚性）', x0, y0 - 14, { color: C.cyan, font: '12px sans-serif' });
    // 应力-应变（右）
    const v = view(f, { xMin: 0, xMax: 1, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 5, ticks: true });
    const stiff = min / 55;
    const curvePts: [number, number][] = [];
    for (let i = 0; i <= 100; i++) {
      const e = (i / 100) * Math.min(1, 1.1 / stiff);
      curvePts.push([v.sx(Math.min(1, e)), v.sy(Math.min(1.05, e * stiff * (e > 0.6 ? 0.6 + (1 - e) * 1.2 : 1)))]);
    }
    poly(f, curvePts, { stroke: min > 62 ? C.hot : min < 42 ? C.cool : C.green, lw: 3.4 });
    text(f, min > 62 ? '过硬：脆性增加，易裂' : min < 42 ? '过软：强度不足，易弯' : '刚柔平衡：刚度与韧性兼得',
      56, 44, { color: min > 62 ? C.hot : min < 42 ? C.cool : C.green, font: '13px sans-serif' });
    text(f, '应变 →', w - 100, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '应力', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    text(f, `当前矿化度 ${min}%：胶原先拉住裂纹、磷灰石再扛住载荷`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '纳米层压结构让裂纹在层间偏转——贝壳与骨骼共用这套增韧术',
      '沃尔夫定律：骨架沿主应力方向改建——不用的骨会被吸收',
      '骨质疏松是矿化与胶原的双重流失——补钙之外还要补力学刺激',
    ]);
    heading(f, '骨骼：纳米层压的复合杰作');
  },
});
registerViz(collagenBone);

/** 荧光共振能量转移 FRET。 */
const fretFluorescence = defineViz({
  slug: 'fret-fluorescence', title: '荧光共振能量转移 FRET', animated: true,
  params: { dist: { type: 'range', min: 1, max: 20, default: 6, step: 1, label: '供受体距离 (nm)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const r = num(params, 'dist', 6);
    const R0 = 5.4;
    const E = 1 / (1 + Math.pow(r / R0, 6));
    clear(f);
    // 供体与受体
    const dy = h * 0.4;
    const dx = w * 0.32;
    const ax = dx + r * 26;
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
    circle(f, dx, dy, 30, { stroke: C.cool, lw: 3.4, fill: `rgba(66,153,225,${0.3 + pulse * 0.3})` });
    text(f, '供体 D', dx - 24, dy + 52, { color: C.cool, font: '12px sans-serif' });
    circle(f, ax, dy, 30, { stroke: C.warm, lw: 3.4, fill: `rgba(237,137,54,${0.2 + E * 0.7 * pulse})` });
    text(f, '受体 A', ax - 24, dy + 52, { color: C.warm, font: '12px sans-serif' });
    // 距离标尺
    seg(f, dx + 34, dy + 76, ax - 34, dy + 76, C.dim, 2);
    text(f, `r = ${r} nm`, (dx + ax) / 2 - 26, dy + 96, { color: C.dim, font: '12px sans-serif' });
    // 能量转移（波浪）
    if (E > 0.15) {
      const wave: [number, number][] = [];
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        wave.push([dx + 34 + t * (ax - dx - 68), dy + Math.sin(t * 16 - f.t * 8) * 18 * E]);
      }
      poly(f, wave, { stroke: `rgba(56,178,172,${0.4 + E * 0.6})`, lw: 3.4 });
      text(f, '无辐射能量转移（r⁻⁶）', dx + 40, dy - 52, { color: C.cyan, font: '12px sans-serif' });
    } else {
      text(f, '距离太远——供体只能自己发荧光', dx + 40, dy - 52, { color: C.dim, font: '12px sans-serif' });
    }
    // 效率曲线（下）
    const v = view(f, { xMin: 1, xMax: 20, yMin: 0, yMax: 1.05, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    const eff: [number, number][] = [];
    for (let i = 1; i <= 200; i++) {
      const rr = 1 + (i / 200) * 19;
      eff.push([v.sx(rr), v.sy(1 / (1 + Math.pow(rr / R0, 6)))]);
    }
    poly(f, eff, { stroke: C.green, lw: 3.2 });
    seg(f, v.sx(R0), v.sy(0), v.sx(R0), v.sy(0.5), `${C.warm}99`, 1.6, );
    dot(f, v.sx(R0), v.sy(0.5), 6, C.warm);
    text(f, `R₀=${R0} nm（效率恰好一半）`, v.sx(R0) + 8, v.sy(0.5) - 10, { color: C.warm, font: '11px sans-serif' });
    text(f, `当前效率 E = ${(E * 100).toFixed(1)}%——10 倍 R₀ 内都能"握手"`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '距离 r →（nm）', w - 130, h - 86, { color: C.dim, font: '11px sans-serif' });
    footnotes(f, [
      '效率对距离六次方敏感——这把尺子的量程正好卡在分子尺度上',
      '光谱重叠与取向因子决定 R₀——设计 FRET 探针要同时算这几项',
      '单分子 FRET 直接看构象变化——分子生物学的实时窥镜',
    ]);
    heading(f, 'FRET：量分子的光学卡尺');
  },
});
registerViz(fretFluorescence);

/** DNA 复制与半保留。 */
const dnaReplication = defineViz({
  slug: 'dna-replication', title: 'DNA 复制与半保留', animated: true,
  params: { rate: { type: 'range', min: 10, max: 200, default: 80, step: 10, label: '复制叉速度 (nt/s)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const rate = num(params, 'rate', 80);
    clear(f);
    const forkX = w * 0.5 + Math.sin(f.t * 0.6) * (w * 0.22);
    const mid = h * 0.46;
    // 未复制的双链（左侧）
    for (const s of [-1, 1]) {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const x = 60 + t * Math.max(60, forkX - 60);
        pts.push([x, mid + s * 24 + Math.sin(t * 14 + f.t * 2) * 8]);
      }
      poly(f, pts, { stroke: s > 0 ? C.cool : C.warm, lw: 3.4 });
    }
    text(f, '模板双链（亲代）', 66, mid - 64, { color: C.dim, font: '11px sans-serif' });
    // 已复制（右侧分开的两条）
    for (const s of [-1, 1]) {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const x = forkX + t * (w - 60 - forkX);
        pts.push([x, mid + s * (24 + t * 46)]);
      }
      if (pts.length > 1) poly(f, pts, { stroke: s > 0 ? C.cool : C.warm, lw: 3.4 });
      // 新合成链（绿色跟随）
      const pts2: [number, number][] = [];
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const x = forkX + t * (w - 60 - forkX);
        pts2.push([x, mid + s * (24 + t * 46) + s * 12]);
      }
      if (pts2.length > 1) poly(f, pts2, { stroke: C.green, lw: 2.6, dash: [7, 5] });
    }
    // 复制叉酶
    circle(f, forkX, mid, 22, { stroke: C.hot, lw: 3.4, fill: 'rgba(245,101,101,0.3)' });
    text(f, '解旋酶', forkX - 24, mid - 34, { color: C.hot, font: '11px sans-serif' });
    // 前导/后随链标注
    text(f, '前导链（连续合成）→', forkX + 40, mid - 78, { color: C.green, font: '11px sans-serif' });
    text(f, '← 后随链（冈崎片段）', 66, mid + 96, { color: C.warm, font: '11px sans-serif' });
    // 保真度读数
    text(f, `复制叉推进 ${rate} nt/s：聚合酶每掺 10⁵ 个碱基才错一次，校对再降到 10⁷ 分之一`,
      30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '半保留：两条子代双链各含一条亲代链——Meselson-Stahl 一眼看清', 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '解旋、解开、合成、校对必须偶联——复制叉是分子流水线',
      '后随链分段合成再由连接酶缝合——方向矛盾用分段解决',
      'PCR 人为复制这套逻辑：变性-退火-延伸，指数扩增到百万倍',
    ]);
    heading(f, 'DNA 复制：半保留的分子流水线');
  },
});
registerViz(dnaReplication);

/** 脑电与神经振荡。 */
const neuralOscillations = defineViz({
  slug: 'neural-oscillations', title: '脑电与神经振荡', animated: true,
  params: { band: { type: 'select', options: ['α (8-13 Hz)', 'β (13-30 Hz)', 'γ (30-80 Hz)'], default: 'α (8-13 Hz)', label: '频段' } },
  draw: (f) => {
    const { w, h, params } = f;
    const band = String((params as Record<string, unknown>)['band'] ?? 'α');
    const freq = band.includes('α') ? 10 : band.includes('β') ? 20 : 45;
    const amp = band.includes('α') ? 40 : band.includes('β') ? 22 : 10;
    clear(f);
    // EEG 波形（多通道）
    const chans = 4;
    for (let c = 0; c < chans; c++) {
      const y0 = 110 + c * 74;
      const pts: [number, number][] = [];
      for (let i = 0; i <= 400; i++) {
        const t = (i / 400) * 10;
        const y = y0
          + Math.sin((t + f.t * 1.2) * freq * 0.62) * amp * (0.7 + 0.3 * Math.sin(t + c))
          + Math.sin((t + f.t * 1.2) * freq * 1.7) * amp * 0.24
          + Math.sin((t + f.t) * 3.1 + c * 2) * 5;
        pts.push([60 + t * ((w - 120) / 10), y]);
      }
      poly(f, pts, { stroke: `rgba(66,153,225,${0.9 - c * 0.14})`, lw: 2.4 });
      text(f, `F${c + 1}`, 34, y0 + 5, { color: C.dim, font: '11px sans-serif' });
    }
    text(f, `${band} 节律（${freq} Hz 中心）——千百万神经元同步放电才能在头皮记到`,
      30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 相位耦合示意（右下）
    const px = w * 0.84, py = h - 128;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + f.t * 2;
      dot(f, px + Math.cos(a) * 40, py + Math.sin(a) * 40, 5, `rgba(72,187,120,${0.5 + 0.5 * Math.sin(f.t * 3 + i)})`);
    }
    circle(f, px, py, 46, { stroke: `${C.green}88`, lw: 1.4, dash: [4, 4] });
    text(f, '相位同步', px - 30, py + 66, { color: C.green, font: '11px sans-serif' });
    const bandNote = band.includes('α') ? '闭眼放松时最强——枕区主导' : band.includes('β') ? '专注与运动执行相关' : '绑定与工作记忆的载体';
    text(f, bandNote, 30, h - 96, { color: C.warm, font: '13px sans-serif' });
    footnotes(f, [
      '头皮电位是突触后电位的时空总和——不是神经元的"放电"本身',
      '不同频段分工合作：θ 记忆、γ 绑定，相位-幅度耦合传递信息',
      '麻醉与昏迷瓦解节律结构——脑电是意识状态的敏感指标',
    ]);
    heading(f, '神经振荡：亿万神经元的合唱');
  },
});
registerViz(neuralOscillations);

/** 蛋白质结构层次。 */
const proteinStructure = defineViz({
  slug: 'protein-structure', title: '蛋白质结构层次', animated: true,
  params: { level: { type: 'range', min: 1, max: 4, default: 4, step: 1, label: '结构层次 (1-4)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const lvl = num(params, 'level', 4);
    clear(f);
    const cy = h * 0.46;
    // 一级：序列
    if (lvl >= 1) {
      const aas = ['G', 'A', 'L', 'V', 'K', 'E', 'W', 'F', 'R', 'S', 'T', 'M'];
      for (let i = 0; i < aas.length; i++) {
        const x = 50 + i * 34;
        poly(f, [[x, 64], [x + 28, 64], [x + 28, 92], [x, 92]],
          { stroke: `${C.grid}cc`, lw: 1.4, fill: 'rgba(66,153,225,0.25)' });
        text(f, aas[i], x + 8, 83, { color: C.cool, font: '13px sans-serif' });
      }
      text(f, '一级：氨基酸序列', 50, 54, { color: C.cool, font: '12px sans-serif' });
    }
    // 二级：α螺旋与β折叠
    if (lvl >= 2) {
      const hx = w * 0.26, hy = h * 0.36;
      for (let i = 0; i <= 34; i++) {
        const t = i / 34;
        const y = hy - 52 + t * 104;
        const x = hx + Math.sin(t * Math.PI * 6) * 30;
        if (i > 0) {
          const t2 = (i - 1) / 34;
          seg(f, hx + Math.sin(t2 * Math.PI * 6) * 30, hy - 52 + t2 * 104, x, y, C.warm, 3.4);
        }
      }
      text(f, 'α 螺旋（氢键 C=O···H-N）', hx - 76, hy + 76, { color: C.warm, font: '12px sans-serif' });
      const bx = w * 0.56;
      for (let s = 0; s < 3; s++) {
        const yy = hy - 44 + s * 34;
        seg(f, bx, yy, bx + 150, yy, C.green, 5);
        // 箭头
        poly(f, [[bx + 150, yy - 7], [bx + 166, yy], [bx + 150, yy + 7]], { stroke: C.green, lw: 3, fill: C.green });
        // 链间氢键
        if (s < 2) for (let k = 0; k < 6; k++) seg(f, bx + 14 + k * 24, yy + 8, bx + 14 + k * 24, yy + 26, `${C.cool}aa`, 1.4, );
      }
      text(f, 'β 折叠片（链间氢键）', bx - 4, hy + 76, { color: C.green, font: '12px sans-serif' });
    }
    // 三级：折叠球
    if (lvl >= 3) {
      const tx = w * 0.8, ty = cy;
      const fold: [number, number][] = [];
      for (let i = 0; i <= 90; i++) {
        const t = (i / 90) * Math.PI * 5;
        const r = 52 * (1 - i / 140);
        fold.push([tx + Math.cos(t) * r, ty + Math.sin(t) * r * 0.8]);
      }
      poly(f, fold, { stroke: `rgba(146,84,222,${0.75 + 0.2 * Math.sin(f.t * 2)})`, lw: 4 });
      text(f, '三级：三维折叠', tx - 52, ty + 84, { color: '#9254de', font: '12px sans-serif' });
    }
    // 四级：多亚基
    if (lvl >= 4) {
      const qx = w * 0.3, qy = h - 132;
      for (const [ox, oy, color] of [[-30, -20, C.cool], [30, -20, C.warm], [-30, 22, C.green], [30, 22, C.hot]] as [number, number, string][]) {
        circle(f, qx + ox, qy + oy, 26, { stroke: color, lw: 3, fill: `${color}44` });
      }
      text(f, '四级：亚基组装（血红蛋白四聚体）', qx + 74, qy + 6, { color: C.cyan, font: '12px sans-serif' });
    }
    const names = ['', '一级 → 序列', '二级 → 局部氢键规则', '三级 → 三维功能形状', '四级 → 多亚基协作'];
    text(f, `${names[lvl]}：序列是说明书，折叠是施工，组装是交付`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '每一层都由上一层约束——错一个残基可能全盘失折叠', 30, h - 96, { color: C.warm, font: '13px sans-serif' });
    footnotes(f, [
      'Pauling 的 α 螺旋靠模型搭建加化学直觉得出——1951 年诺奖',
      '结构决定功能：酶的活性位点、抗体的结合面都是折叠的产物',
      'AlphaFold 预测结构震惊学界——但动态构象仍需实验捕捉',
    ]);
    heading(f, '蛋白质结构：从序列到机器');
  },
});
registerViz(proteinStructure);
