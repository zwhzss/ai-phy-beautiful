import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** 临界指数。 */
const criticalExponent = defineViz({
  slug: 'critical-exponent', title: '临界指数与普适性', animated: true,
  params: {
    t: { type: 'range', min: -2, max: 2, default: 0, step: 0.1, label: '约化温度 t=(T−Tc)/Tc' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const t = num(params, 't', 0);
    const beta = 0.326;
    const order = t >= 0 ? 0 : Math.pow(-t, beta);
    clear(f);
    const x0 = 64, y0 = h - 56, y1 = 64;
    const vv = view(f, { xMin: -2, xMax: 2, yMin: 0, yMax: 1.3, inset: 50 });
    grid(f, vv, { divisions: 4, ticks: true });
    // 序参量曲线
    const pts: [number, number][] = [];
    for (let i = 0; i <= 240; i++) {
      const tt = -2 + (i / 240) * 4;
      pts.push([vv.sx(tt), vv.sy(tt >= 0 ? 0.02 : Math.pow(-tt, beta))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 3 });
    seg(f, vv.sx(0), y1, vv.sx(0), y0, `${C.hot}aa`, 1.6);
    text(f, 'T_c', vv.sx(0) + 6, y1 + 12, { color: C.hot, font: '12px sans-serif' });
    dot(f, vv.sx(t), vv.sy(Math.max(order, 0.02)), 7, C.warm);
    void x0; void y0;
    text(f, `M ∝ |t|^β（β≈0.326）：t=${t.toFixed(1)} → 序参量 ${order.toFixed(3)}`, 30, 44, { color: C.cyan, font: '14px sans-serif' });
    text(f, '三个临界指数（β,γ,ν）只分三维/二维等类——与微观细节无关的普适性', 30, 66, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '临界点附近一切观测量按幂律发散/消失：临界指数是相变的指纹',
      '普适类只依赖维度与序参量分量数：液气、铁磁、二元合金共用同一组指数',
      'Widom 标度律、费歇尔标度律把指数约束成两三个独立量——重正化群一并算出（1974 诺奖）',
    ]);
    heading(f, '临界指数：相变的普适指纹');
  },
});
registerViz(criticalExponent);

/** 序参量。 */
const orderParameter = defineViz({
  slug: 'order-parameter', title: '序参量', animated: true,
  params: {
    kind: { type: 'select', options: ['铁磁磁化', '液晶取向', '超导凝聚'], default: '铁磁磁化', label: '体系' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = String((params as Record<string, unknown>)['kind'] ?? '铁磁');
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    if (mode === '铁磁磁化') {
      // 自旋阵列从无序到有序（随时间摆动→对齐）
      const order = 0.5 + 0.5 * Math.sin(f.t * 0.8);
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 12; col++) {
          const x = cx - 220 + col * 40;
          const y = cy - 70 + row * 30;
          const rand = Math.abs(Math.sin(col * 31.7 + row * 17.3) * 43758.5) % 1;
          const angle = order * Math.PI / 2 + (rand - 0.5) * (1 - order) * Math.PI * 2;
          const L = 12;
          const ex = x + Math.cos(angle) * L, ey = y + Math.sin(angle) * L;
          seg(f, x, y, ex, ey, `rgba(66,153,225,${0.5 + order * 0.5})`, 2.4);
          dot(f, ex, ey, 3.4, C.hot);
        }
      }
      text(f, `序参量 M = ⟨自旋⟩ ≈ ${order.toFixed(2)}：${order > 0.6 ? '铁磁相（对称自发破缺）' : '顺磁相（完全对称）'}`,
        30, 44, { color: C.cyan, font: '14px sans-serif' });
    } else if (mode === '液晶取向') {
      const order = 0.6 + 0.35 * Math.sin(f.t * 0.9);
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 10; col++) {
          const x = cx - 190 + col * 42;
          const y = cy - 60 + row * 30;
          const rand = Math.abs(Math.sin(col * 12.9 + row * 78.2) * 43758.5) % 1;
          const angle = Math.PI / 4 + (rand - 0.5) * (1 - order) * Math.PI;
          seg(f, x - Math.cos(angle) * 13, y - Math.sin(angle) * 13, x + Math.cos(angle) * 13, y + Math.sin(angle) * 13,
            `rgba(146,84,222,${0.45 + order * 0.5})`, 3);
        }
      }
      text(f, `序参量 S=⟨(3cos²θ−1)/2⟩ ≈ ${order.toFixed(2)}：向列相的取向整齐度`, 30, 44, { color: C.cyan, font: '14px sans-serif' });
    } else {
      // 库珀对凝聚（BCS 凝聚因子）
      const cond = 0.5 + 0.45 * Math.sin(f.t * 0.7);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + f.t * 0.3;
        const rr = 70 + (1 - cond) * 90;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.7;
        dot(f, x - 7, y, 5, C.cool);
        dot(f, x + 7, y, 5, C.cool);
      }
      f.ctx.beginPath(); f.ctx.ellipse(cx, cy, 60 * cond, 40 * cond, 0, 0, Math.PI * 2);
      f.ctx.fillStyle = `rgba(66,153,225,${cond * 0.35})`; f.ctx.fill();
      f.ctx.strokeStyle = C.cool; f.ctx.lineWidth = 2; f.ctx.stroke();
      text(f, `序参量 Δ（能隙）≈ ${cond.toFixed(2)}：库珀对相干凝聚——超导的身份证`, 30, 44, { color: C.cyan, font: '14px sans-serif' });
    }
    text(f, '高温无序相：对称　→　低温有序相：对称自发破缺', 30, h - 34, { color: C.warm, font: '13px sans-serif' });

    footnotes(f, [
      '序参量是区分相的宏观量：磁化、密度差、能隙、超流序——朗道理论的主角',
      '朗道相变理论（1937）：自由能按序参量展开，二级相变是抛物线底部的翻转',
      '对称破缺是现代物理的核心语言：从铁磁到希格斯场一脉相承',
    ]);
    heading(f, '序参量：区分相的那一个数字');
  },
});
registerViz(orderParameter);

/** 重正化群。 */
const renormalizationGroup = defineViz({
  slug: 'renormalization-group', title: '重正化群', animated: true,
  params: {
    scale: { type: 'range', min: 1, max: 4, default: 2, step: 0.5, label: '粗粒化尺度 b' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const b = num(params, 'scale', 2);
    clear(f);
    // 三步粗粒化（格点自旋逐级合并）
    const cell = 20;
    const drawGrid = (ox: number, oy: number, n: number, size: number, label: string, blurry: number): void => {
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const rand = Math.abs(Math.sin((i + 1) * 12.9 + (j + 1) * 78.2 + size) * 43758.5) % 1;
          const up = rand > 0.5;
          const x = ox + i * size, y = oy + j * size;
          const a = Math.min(1, Math.abs(rand - 0.5) * 2) + blurry;
          poly(f, [[x, y], [x + size - 3, y], [x + size - 3, y + size - 3], [x, y + size - 3]],
            { stroke: 'transparent', fill: up ? `rgba(66,153,225,${a})` : `rgba(237,137,54,${a})` } as any);
        }
      }
      text(f, label, ox, oy - 12, { color: C.dim, font: '11px sans-serif' });
    };
    const pulse = 0.4 + 0.6 * Math.abs(Math.sin(f.t + b));
    drawGrid(60, 90, 8, cell, '原格点', 0);
    text(f, '→', 60 + 8 * cell + 14, 90 + 4 * cell, { color: C.dim, font: '20px sans-serif' });
    drawGrid(60 + 8 * cell + 40, 90, 4, cell * 2, `b=${b} 粗粒化`, 0.15 * (b - 1));
    text(f, '→', 60 + 8 * cell + 40 + 4 * cell * 2 + 14, 90 + 2 * cell * 2, { color: C.dim, font: '20px sans-serif' });
    drawGrid(60 + 8 * cell + 40 + 4 * cell * 2 + 40, 90, 2, cell * 4, '再粗化（只剩长程关联）', 0.3 * (b - 1));
    void pulse;
    text(f, 'K′ = R_b(K)：沿重正化流走到不动点——临界点只有长程关联幸存', 30, 44, { color: C.cyan, font: '14px sans-serif' });
    text(f, '不动点附近的流速给出临界指数——重正化群把临界现象变成几何问题', 30, 66, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      'Kadanoff 块自旋（1966）→ 威尔逊重正化群（1971-74，1982 诺奖）：逐级积掉短程自由度',
      '临界点是不动点：只有它在任意放大下保持不变——幂律与标度不变性的来源',
      '重正化群不止于相变：QCD 渐近自由、量子引力的有效场论都靠它运转',
    ]);
    heading(f, '重正化群：逐级放大看本质');
  },
});
registerViz(renormalizationGroup);

/** 平均场近似。 */
const meanFieldApprox = defineViz({
  slug: 'mean-field-approx', title: '平均场近似', animated: true,
  params: {
    z: { type: 'range', min: 2, max: 20, default: 8, step: 1, label: '配位数 z（近邻数）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const zz = num(params, 'z', 8);
    const Tc = zz / 4; // 示意标度
    clear(f);
    // 中心自旋与近邻（场=平均化）
    const cx = w * 0.3, cy = h / 2 + 6;
    const order = 0.6 + 0.35 * Math.sin(f.t * 0.9);
    for (let k = 0; k < zz; k++) {
      const a = (k / zz) * Math.PI * 2;
      const x = cx + Math.cos(a) * 84, y = cy + Math.sin(a) * 84;
      seg(f, cx, cy, x, y, `${C.dim}77`, 1.2);
      const rand = Math.abs(Math.sin(k * 12.9) * 43758.5) % 1;
      const up = order > rand;
      dot(f, x, y, 8, up ? C.cool : C.warm);
      // 关键：每个近邻被平均场替代
      if (k % 2 === 0) {
        text(f, '⟨s⟩', x + 10, y + 4, { color: C.dim, font: '9px sans-serif' });
      }
    }
    const up0 = order > 0.5;
    dot(f, cx, cy, 11, up0 ? C.cool : C.warm);
    text(f, '中心自旋感受到的不是具体邻居，而是一个平均的场 h_eff = zJ⟨s⟩', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 自洽方程
    const x0 = w * 0.6, y0 = h - 56, y1 = h * 0.34;
    seg(f, x0, y0, w - 40, y0, C.grid, 1.2);
    seg(f, x0, y0, x0, y1, C.grid, 1.2);
    const m: [number, number][] = [];
    const tanhC: [number, number][] = [];
    for (let i = 0; i <= 100; i++) {
      const mm = i / 100;
      m.push([x0 + mm * (w - 40 - x0), y0 - mm * (y0 - y1)]);
      tanhC.push([x0 + mm * (w - 40 - x0), y0 - Math.tanh(mm * 3.4 / (Tc / 4)) * (y0 - y1)]);
    }
    poly(f, m, { stroke: `${C.green}aa`, lw: 1.6, dash: [6, 4] } as any);
    poly(f, tanhC, { stroke: C.accent, lw: 2.6 });
    text(f, `M=tanh(zJM/T)：z=${zz}、T_c∝zJ — 交点即自洽解`, x0 + 6, y1 - 8, { color: C.accent, font: '11px sans-serif' });

    footnotes(f, [
      '平均场把多体问题变成单体在有效场中：居里外斯定律、范德瓦尔斯方程皆其产物',
      '精确但有系统偏差：临界指数在平均场给出经典值，与实验（涨落主导）不符',
      '涨落何时可忽略？空间维度足够高（d>dc=4）时平均场精确——重正化群的判决',
    ]);
    heading(f, '平均场：用一个平均代替全部细节');
  },
});
registerViz(meanFieldApprox);

/** 居里-外斯定律。 */
const curieWeiss = defineViz({
  slug: 'curie-weiss', title: '居里-外斯定律', animated: true,
  params: {
    Tc: { type: 'range', min: 300, max: 1200, default: 770, step: 10, label: '居里点 Tc (K)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const Tc = num(params, 'Tc', 770);
    clear(f);
    const x0 = 64, y0 = h - 56, y1 = 64;
    const vv = view(f, { xMin: 0, xMax: 1400, yMin: 0, yMax: 1.2, inset: 50 });
    grid(f, vv, { divisions: 4, ticks: true });
    // 磁化 M(T)（平均场曲线）
    const pts: [number, number][] = [];
    for (let i = 1; i <= 300; i++) {
      const T = (i / 300) * 1400;
      if (T < Tc) {
        // 近似 m=tanh(3m·Tc/T)
        let m = 0.9;
        for (let k = 0; k < 30; k++) m = Math.tanh((3 * m * Tc) / T / 3);
        pts.push([vv.sx(T), vv.sy(m)]);
      } else {
        pts.push([vv.sx(T), vv.sy(0.02)]);
      }
    }
    poly(f, pts, { stroke: C.accent, lw: 3 });
    // 1/χ 线性段
    const chi: [number, number][] = [];
    for (let T = Tc * 0.96; T <= 1400; T += 20) {
      chi.push([vv.sx(T), vv.sy((T - Tc * 0.94) / 1400 * 1.1 + 0.06)]);
    }
    poly(f, chi, { stroke: C.green, lw: 2, dash: [7, 5] } as any);
    seg(f, vv.sx(Tc), y1, vv.sx(Tc), y0, `${C.hot}aa`, 1.6);
    text(f, `T_c=${Tc}K：铁磁→顺磁（居里点）`, vv.sx(Tc) + 8, y1 + 14, { color: C.hot, font: '12px sans-serif' });
    text(f, 'χ = C/(T−Tc)（外斯）：1/χ 在 Tc 以上是直线——外推即得 Tc', 30, 44, { color: C.green, font: '13px sans-serif' });
    void x0; void y0;
    text(f, `当前磁化 M(T→Tc⁻)→0——二级相变的连续序参量`, 30, 66, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '居里 1905 用朗之万理论解释顺磁；外斯 1907 引入分子场假说 Tc——平均场的先驱',
      '铁磁居里点是工业标尺：钕铁硼 312℃、钐钴 750℃——永磁体的温度天花板',
      '实测指数 0.326 ≠ 平均场 0.5：临界区涨落破坏平均场——重正化群登场的理由',
    ]);
    heading(f, '居里-外斯：磁性消失的温度刻度');
  },
});
registerViz(curieWeiss);

/** 涨落耗散定理。 */
const fluctuationDissipation = defineViz({
  slug: 'fluctuation-dissipation', title: '涨落耗散定理', animated: true,
  params: {
    T: { type: 'range', min: 0.2, max: 4, default: 1, step: 0.1, label: '温度 T（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const T = num(params, 'T', 1);
    clear(f);
    // 左：布朗粒子的随机涨落；右：响应函数
    const cx = w * 0.28, cy = h / 2 + 6;
    const rand = (i: number): number => Math.abs(Math.sin(i * 91.7) * 43758.5) % 1;
    const trail: [number, number][] = [];
    let x = cx, y = cy;
    for (let i = 0; i < 160; i++) {
      x += (rand(i + Math.floor(f.t * 6)) - 0.5) * 14 * Math.sqrt(T);
      y += (rand(i + 55 + Math.floor(f.t * 6)) - 0.5) * 14 * Math.sqrt(T);
      x = Math.max(cx - 130, Math.min(cx + 130, x));
      y = Math.max(cy - 110, Math.min(cy + 110, y));
      trail.push([x, y]);
    }
    poly(f, trail, { stroke: `${C.cool}88`, lw: 1.4 });
    dot(f, x, y, 8, C.warm);
    text(f, `热涨落幅度 ∝ √T（T=${T.toFixed(1)}）`, cx - 90, cy - 130, { color: C.cool, font: '13px sans-serif' });
    // 右：耗散（阻尼响应）
    const x0 = w * 0.58, y0 = h - 56, y1 = 70;
    seg(f, x0, y0, w - 40, y0, C.grid, 1.2);
    seg(f, x0, y0, x0, y1, C.grid, 1.2);
    const resp: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120 * 10;
      const decay = Math.exp(-t * 0.4 * T);
      resp.push([x0 + t * (w - 40 - x0) / 10, y0 - (y0 - y1) * 0.5 * (1 - decay) - (y0 - y1) * 0.4 * decay * Math.cos(t * 3)]);
    }
    poly(f, resp, { stroke: C.hot, lw: 2.6 });
    text(f, '响应 χ″(ω)：外驱动的耗散', x0 + 10, y1 - 8, { color: C.hot, font: '12px sans-serif' });
    text(f, 'S(ω) = (2kT/ω)·χ″(ω)：涨落谱与耗散谱被 T 焊死', w * 0.5 - 170, h - 26, { color: C.cyan, font: '14px serif' });

    footnotes(f, [
      '涨落耗散定理（Callen-Welton 1951）：系统怎么耗散，就怎么涨落——涨落是耗散的镜像',
      '布朗运动的爱因斯坦关系 D=μkT、约翰逊噪声 S=4kTR 都是它的特例',
      '它规定了测量的终极精度：想要更小的涨落就得接受更强的耗散（LIGO 的量子极限）',
    ]);
    heading(f, '涨落耗散定理：噪声与摩擦同源');
  },
});
registerViz(fluctuationDissipation);

/** 玻尔兹曼分布。 */
const boltzmannDistribution = defineViz({
  slug: 'boltzmann-distribution', title: '玻尔兹曼分布', animated: true,
  params: {
    T: { type: 'range', min: 0.3, max: 6, default: 1.5, step: 0.1, label: '温度 T（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const T = num(params, 'T', 1.5);
    clear(f);
    const x0 = 64, y0 = h - 56, y1 = 64;
    const vv = view(f, { xMin: 0, xMax: 8, yMin: 0, yMax: 1.15, inset: 50 });
    grid(f, vv, { divisions: 4, ticks: true });
    // 分布曲线（能级离散柱+连续包络）
    const lam = 1 / T;
    for (let E = 1; E <= 7; E += 1) {
      const p = Math.exp(-E * lam) / (1 - Math.exp(-lam) + 1e-9);
      const bx = vv.sx(E);
      poly(f, [[bx - 10, y0], [bx + 10, y0], [bx + 10, vv.sy(p)], [bx - 10, vv.sy(p)]],
        { stroke: 'transparent', fill: 'rgba(66,153,225,0.55)' } as any);
      dot(f, bx, vv.sy(p), 4, C.warm);
    }
    const pts: [number, number][] = [];
    for (let i = 1; i <= 200; i++) {
      const E = (i / 200) * 8;
      pts.push([vv.sx(E), vv.sy(Math.exp(-E * lam))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.6 });
    text(f, `P(E) ∝ e^(−E/kT)：T=${T.toFixed(1)} — ${T < 1 ? '低温：粒子挤在低能态' : T > 3 ? '高温：各态接近均分' : '适中：指数阶梯清晰'}`,
      30, 44, { color: C.cyan, font: '14px sans-serif' });
    text(f, 'S = −kΣp·ln p：熵就是这套概率的不确定度（玻尔兹曼墓志铭 S=k·lnW）', 30, 66, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '指数因子 e^(−E/kT) 是统计力学的原子：占据数、化学平衡、费米面填充皆由此来',
      'kT 是热能的标尺——室温 25.7meV 决定了半导体、生物分子与相变的能量边界',
      '麦克斯韦速度分布、费米-狄拉克与玻色-爱因斯坦分布都是它的变体（换计数规则）',
    ]);
    heading(f, '玻尔兹曼分布：温度写成指数');
  },
});
registerViz(boltzmannDistribution);

/** 遍历假说。 */
const ergodicHypothesis = defineViz({
  slug: 'ergodic-hypothesis', title: '遍历假说与系综', animated: true,
  params: {
    kind: { type: 'select', options: ['单粒子长时间演化', '系综快照'], default: '单粒子长时间演化', label: '视角' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const ensemble = String((params as Record<string, unknown>)['kind'] ?? '').includes('系综');
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    const S = Math.min(w, h) * 0.32;
    // 相空间盒
    poly(f, [[cx - S, cy - S * 0.7], [cx + S, cy - S * 0.7], [cx + S, cy + S * 0.7], [cx - S, cy + S * 0.7]],
      { stroke: C.dim, lw: 2 } as any);
    text(f, '能量面（等 H 曲面）', cx - S, cy - S * 0.7 - 12, { color: C.dim, font: '11px sans-serif' });
    if (!ensemble) {
      // 单点长时间轨迹（填满能量面）
      const trail: [number, number][] = [];
      for (let i = 0; i <= 500; i++) {
        const t = i * 0.35 + f.t * 2;
        const x = cx + Math.cos(t) * (S - 24) * Math.cos(t * 0.37);
        const y = cy + Math.sin(t * 1.61) * (S * 0.7 - 20);
        trail.push([x, y]);
      }
      poly(f, trail, { stroke: `${C.cool}55`, lw: 1 });
      const last = trail[trail.length - 1];
      dot(f, last[0], last[1], 8, C.warm);
      text(f, '单个系综点长时间跑遍整个能量面——时间平均=系综平均', 40, 44, { color: C.cyan, font: '13px sans-serif' });
    } else {
      // 系综（多点同分布）
      for (let k = 0; k < 26; k++) {
        const rand1 = Math.abs(Math.sin(k * 12.9) * 43758.5) % 1;
        const rand2 = Math.abs(Math.sin(k * 78.2) * 43758.5) % 1;
        const wob = Math.sin(f.t * 1.4 + k) * 6;
        dot(f, cx + (rand1 - 0.5) * 2 * (S - 30) + wob, cy + (rand2 - 0.5) * 2 * (S * 0.7 - 24), 5.4, C.cool);
      }
      text(f, '同一时刻撒一把点（微正则系综）：统计=对点集的平均', 40, 44, { color: C.cyan, font: '13px sans-serif' });
    }
    text(f, '遍历：时间平均 ⟨·⟩_t = 系综平均 ⟨·⟩_ens ——统计力学合法性的公理级假设', 40, h - 34, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '玻尔兹曼引入遍历假说：单体系的长期行为足以代表所有同类体系——把时间换成集合',
      '系综（吉布斯）：微正则、正则、巨正则对应不同约束——统计力学的三副透镜',
      '遍历破缺（玻璃、台球混沌）至今是数学与物理的开放问题——公理并不平凡',
    ]);
    heading(f, '遍历假说：用时间换集合');
  },
});
registerViz(ergodicHypothesis);
