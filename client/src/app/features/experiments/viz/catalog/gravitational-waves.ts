import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** 引力波旋进信号。 */
const gwChirp = defineViz({
  slug: 'gw-chirp', title: '引力波旋进信号', animated: true,
  params: {
    mass: { type: 'range', min: 1, max: 80, default: 30, step: 1, label: '系统质量 (M☉)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const M = num(params, 'mass', 30);
    clear(f);
    const x0 = 60, yMid = h * 0.44;
    seg(f, x0, yMid, w - 40, yMid, `${C.grid}aa`, 1.3);
    // 旋进波形：频率与振幅随时间增长（chirp）
    const pts: [number, number][] = [];
    for (let i = 0; i <= 600; i++) {
      const t = (i / 600);
      const phase = Math.pow(t, -0.6) * 24 + f.t * 3;
      const amp = (0.12 + Math.pow(t, 2.2) * 0.7) * (h * 0.28);
      pts.push([x0 + t * (w - 100), yMid - Math.sin(phase) * amp * (t > 0.97 ? Math.max(0, (1 - t) * 30) : 1)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2 });
    // 合并标记
    const mergerX = x0 + (w - 100) * 0.97;
    const flash = Math.sin(f.t * 4) > 0 ? 1 : 0.5;
    dot(f, mergerX, yMid, 9, `rgba(255,240,180,${flash})`);
    text(f, '合并', mergerX - 16, yMid - 60, { color: '#fffbeb', font: '11px sans-serif' });
    // 两阶段标签
    text(f, '旋进 inspiral → 合并 merger → 铃宕 ringdown', x0, 44, { color: C.cyan, font: "14px sans-serif" });
    text(f, `M≈${M}M☉：质量越大频率越低（LIGO 听 10~1000Hz，LISA 听 mHz）`, x0, 68, { color: C.warm, font: "12px sans-serif" });
    // 时频示意（小图）
    const fx = w * 0.6, fy = h - 60, fy1 = h * 0.68;
    poly(f, [[fx, fy], [w - 40, fy], [w - 40, fy1], [fx, fy1]], { stroke: `${C.dim}88`, lw: 1.4, fill: 'rgba(100,116,139,0.10)' } as any);
    const track: [number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      track.push([fx + t * (w - 40 - fx), fy - 8 - Math.pow(t, -0.5) * 6 - t * (fy - fy1) * 0.72]);
    }
    poly(f, track, { stroke: C.green, lw: 2.6 });
    text(f, '时频图：频率上翘的蝌蚪——匹配滤波的模板指纹', fx + 6, fy1 + 16, { color: C.green, font: '11px sans-serif' });

    footnotes(f, [
      '双致密天体旋进辐射带走能量 → 轨道收缩 → 更快更强，正反馈到合并——chirp 信号',
      '从波形反演质量、自旋、距离：GW150914 读出 36+29 M☉ 与 13 亿光年（2017 诺奖）',
      "匹配滤波把模板与数据相关——信噪比靠已知波形从噪声里'捞'出来",
    ]);
    heading(f, '引力波旋进：双黑洞的最后乐章');
  },
});
registerViz(gwChirp);

/** 引力波应变灵敏度。 */
const gwStrain = defineViz({
  slug: 'gw-strain', title: '引力波应变与灵敏度', animated: true,
  params: {
    h: { type: 'range', min: -23, max: -19, default: -21, step: 0.5, label: '应变 h（10 的幂）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const exp = num(params, 'h', -21);
    clear(f);
    // 灵敏度曲线（U 形噪声地板）
    const x0 = 70, y0 = h - 60, y1 = 70;
    const vv = view(f, { xMin: 10, xMax: 5000, yMin: -24, yMax: -19, inset: 54, logX: true } as any);
    grid(f, vv, { divisions: 4, ticks: true });
    const curve: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const fr = 10 * Math.pow(500, i / 300);
      const Se = -24 + Math.pow(Math.log10(fr / 30) , 2) * 1.1 + (fr < 30 ? 1.6 : 0);
      const v = Math.max(-24, Math.min(-19, Se));
      curve.push([vv.sx(fr), vv.sy(v)]);
    }
    poly(f, curve, { stroke: C.accent, lw: 3 });
    // 探测线（当前 h）
    const hY = vv.sy(Math.max(-24, Math.min(-19, exp)));
    seg(f, x0, hY, w - 40, hY, C.green, 2);
    dot(f, vv.sx(100), hY, 7, C.warm);
    void y1;
    text(f, `h = 10^(${exp})：LIGO 地板 ~10⁻²³/√Hz — ${exp <= -22 ? '低于地板（需更长积分或下一代）' : '在地板之上（可探测）'}`,
      30, 44, { color: exp <= -22 ? C.warm : C.green, font: "14px sans-serif" });
    text(f, '4km 臂长被拉伸 10⁻²¹ ≈ 质子直径的千分之一', 30, 68, { color: C.cyan, font: "12px sans-serif" });
    text(f, '频率 (Hz)', x0, y0 + 20, { color: C.dim, font: '11px sans-serif' });

    footnotes(f, [
      '应变 h=ΔL/L 是引力波的强度单位——灵敏度曲线的 U 形底由散粒噪声与地震噪声夹出',
      '低频受地震与悬挂热噪声限制、高频受散粒噪声限制——压缩光正攻高频段',
      '爱因斯坦 1916 预言、2015 探测（百年之约）——从 10⁻²¹ 到脉冲星计时阵的 nHz 全频谱',
    ]);
    heading(f, '应变灵敏度：听懂引力波的耳朵');
  },
});
registerViz(gwStrain);

/** 双星旋进动力学。 */
const binaryInspiral = defineViz({
  slug: 'binary-inspiral', title: '双致密天体旋进', animated: true,
  params: {
    q: { type: 'range', min: 0.2, max: 1, default: 1, step: 0.05, label: '质量比 q=M₂/M₁' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const q = num(params, 'q', 1);
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    const prog = (f.t * 0.22) % 1;
    const sep = (1 - prog) * Math.min(w, h) * 0.34 + 26;
    const m1 = 1 / (1 + q), m2 = q / (1 + q);
    // 轨道螺旋
    const spiral: [number, number][] = [];
    for (let i = 0; i <= 400; i++) {
      const t = (i / 400) * prog * Math.PI * 6;
      const r = 26 + (1 - i / 400) * Math.min(w, h) * 0.34;
      spiral.push([cx + Math.cos(t + f.t) * r, cy + Math.sin(t + f.t) * r * 0.7]);
    }
    poly(f, spiral, { stroke: `${C.cool}55`, lw: 1.4 });
    // 两星
    const ang = f.t * 2 + prog * Math.PI * 6;
    const x1 = cx - Math.cos(ang) * sep * m2 * 1.2, y1 = cy - Math.sin(ang) * sep * m2 * 0.84;
    const x2 = cx + Math.cos(ang) * sep * m1 * 1.2, y2 = cy + Math.sin(ang) * sep * m1 * 0.84;
    dot(f, x1, y1, 12 + m1 * 8, C.cool);
    dot(f, x2, y2, 12 + m2 * 8, C.warm);
    text(f, 'M₁', x1 - 10, y1 - 24, { color: C.cool, font: '11px sans-serif' });
    text(f, 'M₂', x2 - 10, y2 + 34, { color: C.warm, font: '11px sans-serif' });
    // 质心
    dot(f, cx, cy, 4, C.dim);
    // 引力波外传
    for (let k = 1; k <= 4; k++) {
      const rr = ((f.t * 60 + k * 60) % 260) + sep;
      const alpha = Math.max(0.06, 0.5 - rr / 400);
      f.ctx.beginPath();
      f.ctx.ellipse(cx, cy, rr, rr * 0.7, 0, 0, Math.PI * 2);
      f.ctx.strokeStyle = `rgba(16,185,129,${alpha})`;
      f.ctx.lineWidth = 1.8; f.ctx.stroke();
    }
    text(f, `质量比 q=${q.toFixed(2)}：轨道能量以 h·f 的形式辐射——越旋越近直至并合`, 30, 44, { color: C.cyan, font: "14px sans-serif" });

    footnotes(f, [
      "引力辐射反作用使轨道收缩——双星旋进是'系统性能量泄漏'的教科书案例",
      'Hulse-Taylor 脉冲双星的轨道衰减与广义相对论预言吻合（1993 诺奖——间接证据）',
      '中子星并合的千新星抛射物含金、铂——宇宙的贵金属锻造炉（GW170817）',
    ]);
    heading(f, '双星旋进：轨道能量的流失之旅');
  },
});
registerViz(binaryInspiral);

/** 引力波四极辐射公式。 */
const quadrupoleFormula = defineViz({
  slug: 'quadrupole-formula', title: '引力波四极公式', animated: true,
  params: {
    demo: { type: 'select', options: ['四极振荡', '角动量守恒限制'], default: '四极振荡', label: '演示' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const quad = String((params as Record<string, unknown>)['kind'] ?? '').includes('四极');
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    if (quad) {
      // 四极形变球（椭球振荡）
      const stretch = Math.sin(f.t * 3) * 0.24;
      f.ctx.beginPath();
      f.ctx.ellipse(cx, cy, 60 * (1 + stretch), 60 * (1 - stretch), 0, 0, Math.PI * 2);
      f.ctx.fillStyle = 'rgba(66,153,225,0.3)'; f.ctx.fill();
      f.ctx.strokeStyle = C.cool; f.ctx.lineWidth = 2.6; f.ctx.stroke();
      // 外传 +与× 模式
      for (let k = 1; k <= 4; k++) {
        const rr = 80 + k * 40 + Math.sin(f.t * 3 - k) * 8;
        const pts: [number, number][] = [];
        for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.08) {
          const mod = 1 + stretch * Math.cos(2 * a) * 3.4;
          pts.push([cx + rr * mod * Math.cos(a) * 0.6, cy + rr * mod * Math.sin(a) * 0.9]);
        }
        poly(f, [...pts, pts[0]], { stroke: `rgba(16,185,129,${0.6 - k * 0.1})`, lw: 1.8 });
      }
      text(f, 'ḧ̈ = (2G/c⁴)·Q̈（质量四极矩的二阶导数）', 30, 44, { color: C.cyan, font: "15px serif" });
      text(f, '呼吸+剪切的交替形变：h₊ 与 h× 两种偏振', 30, 68, { color: C.warm, font: "12px sans-serif" });
    } else {
      // 质心运动不辐射（单体圆周）
      const R = Math.min(w, h) * 0.22;
      const a = f.t * 2;
      dot(f, cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.7, 13, C.warm);
      dot(f, cx, cy, 4, C.cool);
      seg(f, cx, cy, cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.7, `${C.dim}aa`, 1.4);
      text(f, '质心动量守恒：单体圆周运动（偶极）不辐射引力波', 30, 44, { color: C.cyan, font: "14px sans-serif" });
      text(f, '电磁有偶极辐射（电荷可正负）；引力只有质量 → 最低阶只能是四极', 30, 68, { color: C.warm, font: "12px sans-serif" });
      // 对（辐射的最低配置）
      const sep = 60 + Math.sin(f.t * 3) * 14;
      dot(f, cx - 150, cy + 140 - sep * 0.3, 9, C.cool);
      dot(f, cx - 150 + sep, cy + 140 + sep * 0.3, 9, C.warm);
      text(f, '双体振荡（四极变化）→ 辐射', cx - 190, cy + 200, { color: C.green, font: '12px sans-serif' });
    }

    footnotes(f, [
      '广义相对论的非线性使引力辐射只能从四极阶起步——比电磁的偶极辐射低效得多',
      '辐射功率 P=(G/5c⁵)·⟨Q̈²⟩——c⁵ 在分母：引力波极弱，必须有极端天体才可测',
      '双黑洞并合瞬间峰值光度超过全可观测宇宙所有恒星之和——以引力波的形式',
    ]);
    heading(f, '四极公式：引力波为何如此微弱');
  },
});
registerViz(quadrupoleFormula);

/** 随机引力波背景。 */
const stochasticGw = defineViz({
  slug: 'stochastic-gw', title: '随机引力波背景', animated: true,
  params: {
    source: { type: 'select', options: ['宇宙学起源', '天体物理叠加'], default: '宇宙学起源', label: '候选来源' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const cosmological = String((params as Record<string, unknown>)['source'] ?? '').includes('宇宙学');
    clear(f);
    // 随机波形（噪声背景）
    const x0 = 60, yMid = h * 0.4;
    const pts: [number, number][] = [];
    const rand = (i: number, j: number): number => Math.abs(Math.sin(i * 12.9 + j * 78.2) * 43758.5) % 1;
    for (let i = 0; i <= 400; i++) {
      const noise = (rand(i, Math.floor(f.t * 2)) - 0.5 + rand(i + 7, Math.floor(f.t * 2) + 3) - 0.5) * 44;
      pts.push([x0 + (i / 400) * (w - 100), yMid - noise * (cosmological ? 1 : 0.6)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 1.8 });
    seg(f, x0, yMid, w - 40, yMid, `${C.grid}aa`, 1.3);
    text(f, cosmological ? '暴胀原初引力波、相变气泡串、宇宙弦——宇宙学随机背景' : '遥远双星、超大质量黑洞对的不可分辨叠加——天体物理背景',
      30, 44, { color: C.cyan, font: "14px sans-serif" });
    // 频段示意
    const bands: [string, number, string][] = cosmological
      ? [['LISA mHz', 0.2, C.green], ['PTA nHz', 0.5, C.warm], ['BBN/CMB 约束', 0.8, C.hot]]
      : [['LIGO 100Hz', 0.3, C.green], ['PTA 纳赫兹', 0.65, C.warm]];
    for (const [label, t, color] of bands) {
      const bx = 70 + t * (w - 180);
      const pulse = 0.6 + 0.4 * Math.sin(f.t * 2 + t * 10);
      poly(f, [[bx, h - 76], [bx + 92, h - 76], [bx + 92, h - 52], [bx, h - 52]],
        { stroke: 'transparent', fill: `${color}${Math.round(pulse * 160).toString(16).padStart(2, '0')}` } as any);
      text(f, label, bx + 4, h - 60, { color, font: '11px sans-serif' });
    }
    text(f, 'NANOGrav 2023 已探测到纳赫兹“背景”迹象——全频谱引力波天文学开张', 30, 70, { color: C.green, font: "12px sans-serif" });

    footnotes(f, [
      '随机背景像 CMB 之于电磁：不解析单源，却携带着早期宇宙的统计指纹',
      'Ω_gw 的谱形区分暴胀、相变与宇宙弦——原初引力波是暴胀能标的直接探针',
      '脉冲星计时阵用毫秒脉冲星做星际时钟，测出 nHz 段的共同残差（2023）',
    ]);
    heading(f, '随机引力波背景：时空的底噪');
  },
});
registerViz(stochasticGw);

/** 引力波探测器原理。 */
const gwDetector = defineViz({
  slug: 'gw-detector', title: '激光干涉引力波探测器', animated: true,
  params: {
    arm: { type: 'range', min: 1, max: 4, default: 4, step: 0.5, label: '臂长 (km)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const L = num(params, 'arm', 4);
    clear(f);
    const cx = w * 0.3, cy = h * 0.6;
    const ax = w * 0.62, ay = h * 0.28;
    // L 形干涉仪
    seg(f, cx, cy, cx + ax, cy, C.cool, 7);
    seg(f, cx, cy, cx, cy - ay, C.cool, 7);
    text(f, `臂 1（${L}km）`, cx + ax * 0.4, cy + 26, { color: C.cool, font: '12px sans-serif' });
    text(f, `臂 2（${L}km）`, cx - 66, cy - ay * 0.5, { color: C.cool, font: '12px sans-serif' });
    // 镜与分束器
    dot(f, cx + ax, cy, 10, C.warm);
    dot(f, cx, cy - ay, 10, C.warm);
    text(f, '测试质量（40kg 悬丝摆）', cx + ax - 60, cy - 24, { color: C.warm, font: '10px sans-serif' });
    poly(f, [[cx - 14, cy - 14], [cx + 14, cy + 14], [cx + 20, cy + 8], [cx - 8, cy - 20]],
      { stroke: C.green, lw: 2.2, fill: 'rgba(16,185,129,0.4)' } as any);
    text(f, '分束器', cx + 24, cy + 34, { color: C.green, font: '11px sans-serif' });
    // 激光与光束（脉动）
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 6);
    seg(f, cx - 150, cy + 60, cx, cy, `rgba(255,80,80,${0.5 + pulse * 0.5})`, 2.4);
    text(f, '1064nm 激光', cx - 190, cy + 84, { color: C.hot, font: '11px sans-serif' });
    // 引力波使臂长交变伸缩
    const strain = Math.sin(f.t * 3) * 4;
    const dash: [number, number][] = [[cx + ax + strain, cy], [cx + ax + strain, cy - 40]];
    poly(f, dash, { stroke: C.warm, lw: 2.6 });
    text(f, 'h 使两臂一伸一缩（+极化）→ 相消输出被打破', 30, 44, { color: C.cyan, font: "14px sans-serif" });
    // 探测器
    const ox = cx - 60, oy = cy + 110;
    poly(f, [[ox, oy - 20], [ox + 70, oy - 20], [ox + 70, oy + 20], [ox, oy + 20]],
      { stroke: C.cool, lw: 2, fill: 'rgba(66,153,225,0.16)' } as any);
    text(f, '光电探测（暗端输出）', ox + 4, oy + 5, { color: C.cool, font: '10px sans-serif' });
    text(f, `${L}km 臂 × Fabry-Pérot 增强腔：等效光程数十万公里`, 30, h - 30, { color: C.warm, font: "12px sans-serif" });

    footnotes(f, [
      '迈克尔逊干涉仪的百年转身：1887 否定以太，2015 捕捉到时空的颤动',
      '测试质量悬丝摆隔离地震、真空管隔绝空气、Fabry-Pérot 腔折叠光程——层层降噪',
      'LIGO 双台站符合触发排除本地噪声；Virgo/KAGRA 联网定位源方向',
    ]);
    heading(f, '干涉型引力波探测器：4km 的时空听诊器');
  },
});
registerViz(gwDetector);
