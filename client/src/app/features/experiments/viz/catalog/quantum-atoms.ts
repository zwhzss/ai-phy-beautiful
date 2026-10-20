import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** 氢原子波函数。 */
const hydrogenWavefunction = defineViz({
  slug: 'hydrogen-wavefunction', title: '氢原子波函数', animated: true,
  params: {
    st: { type: 'select', options: ['1s', '2p_z', '3d_z²', '2s'], default: '1s', label: '轨道态' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const st = String((params as Record<string, unknown>)['st'] ?? '1s');
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    const R = Math.min(w, h) * 0.34;
    const pulse = 0.85 + 0.15 * Math.sin(f.t * 2);
    const drawBlob = (rr: number, sy: number, alpha: number): void => {
      f.ctx.beginPath();
      f.ctx.ellipse(cx, cy, rr, rr * sy, 0, 0, Math.PI * 2);
      f.ctx.fillStyle = `rgba(66,153,225,${alpha * pulse})`;
      f.ctx.fill();
      f.ctx.strokeStyle = `rgba(140,210,255,${alpha * 0.9})`;
      f.ctx.lineWidth = 2; f.ctx.stroke();
    };
    if (st === '1s') {
      drawBlob(R * 0.5, 1, 0.42);
      drawBlob(R * 0.26, 1, 0.62);
      dot(f, cx, cy, 5, C.warm);
      text(f, '1s：球对称，概率在核附近最大（|ψ|²∝e^(−2r/a₀)）', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    } else if (st === '2s') {
      drawBlob(R * 0.8, 1, 0.30);
      // 径向节点（内球与外壳间）
      f.ctx.beginPath(); f.ctx.arc(cx, cy, R * 0.42, 0, Math.PI * 2);
      f.ctx.setLineDash([6, 5]);
      f.ctx.strokeStyle = `${C.warm}aa`; f.ctx.lineWidth = 1.8; f.ctx.stroke();
      f.ctx.setLineDash([]);
      drawBlob(R * 1.1, 1, 0.18);
      text(f, '2s：一个径向节点（节面处概率为零）', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    } else if (st === '2p_z') {
      // 上下双瓣
      for (const s of [1, -1]) {
        f.ctx.beginPath();
        f.ctx.ellipse(cx, cy + s * R * 0.5, R * 0.34, R * 0.52, 0, 0, Math.PI * 2);
        f.ctx.fillStyle = s > 0 ? 'rgba(66,153,225,0.5)' : 'rgba(237,137,54,0.45)';
        f.ctx.fill();
        f.ctx.strokeStyle = s > 0 ? C.cool : C.warm; f.ctx.lineWidth = 2; f.ctx.stroke();
      }
      seg(f, cx - R * 0.9, cy, cx + R * 0.9, cy, `${C.green}aa`, 1.6);
      text(f, '2p_z：哑铃形，节面在 xy 平面（正负相位两瓣）', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    } else {
      // 3d_z²：双瓣+环
      for (const s of [1, -1]) {
        f.ctx.beginPath();
        f.ctx.ellipse(cx, cy + s * R * 0.62, R * 0.26, R * 0.4, 0, 0, Math.PI * 2);
        f.ctx.fillStyle = 'rgba(66,153,225,0.5)'; f.ctx.fill();
        f.ctx.strokeStyle = C.cool; f.ctx.lineWidth = 2; f.ctx.stroke();
      }
      f.ctx.beginPath();
      f.ctx.ellipse(cx, cy, R * 0.62, R * 0.24, 0, 0, Math.PI * 2);
      f.ctx.fillStyle = 'rgba(237,137,54,0.36)'; f.ctx.fill();
      f.ctx.strokeStyle = C.warm; f.ctx.lineWidth = 2; f.ctx.stroke();
      text(f, '3d_z²：双瓣加腰环——d 轨道决定过渡金属的化学个性', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    }
    text(f, 'n 决定能层（Eₙ=−13.6/n² eV），l、m 决定形状与取向', 30, h - 34, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '薛定谔方程解出的氢原子谱精确到小数点后十位——量子力学的第一个大胜利',
      '电子没有确定轨道，只有概率云：化学键、元素周期表全建立在这朵云上',
      's/p/d/f 的形状语言是化学家与凝聚态物理的共同词汇——从共价键到高温超导',
    ]);
    heading(f, '氢原子波函数：概率云的形状');
  },
});
registerViz(hydrogenWavefunction);

/** 精细结构。 */
const fineStructure = defineViz({
  slug: 'fine-structure', title: '精细结构', animated: true,
  params: {
    Z: { type: 'range', min: 1, max: 30, default: 1, step: 1, label: '原子序数 Z' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const Z = num(params, 'Z', 1);
    const alpha = 1 / 137;
    const fine = 13.6 * Math.pow(Z, 2) * alpha * alpha; // eV 量级修正
    clear(f);
    const x0 = 100, yTop = 90, gap = 64;
    // 能级分裂示意（2p 分成 2p_{1/2} 与 2p_{3/2}）
    const levels: [string, number, string][] = [
      ['2p_{3/2}', 0, C.cool],
      ['2p_{1/2}', 1, C.cool],
      ['2s_{1/2}', 1.03, C.warm],
      ['1s_{1/2}', 3, C.dim],
    ];
    for (let i = 0; i < levels.length; i++) {
      const [, off, color] = levels[i];
      const y = yTop + off * gap + i * 6;
      seg(f, x0, y, x0 + 260, y, color, 3);
      text(f, levels[i][0].replace('_{', '_').replace('}', ''), x0 + 272, y + 4, { color, font: '13px sans-serif' });
    }
    // 箭头（Lamb 位移）
    seg(f, x0 + 120, yTop + gap * 1.03 + 6, x0 + 120, yTop + gap * 1 + 6, C.hot, 2.2);
    text(f, `Lamb 位移 1057MHz（QED）`, x0 + 130, yTop + gap * 1.02 + 4, { color: C.hot, font: '11px sans-serif' });
    // 跃迁光谱线
    const pulse = 0.6 + 0.4 * Math.sin(f.t * 4);
    seg(f, x0 + 60, yTop, x0 + 60, yTop + gap * 3, `rgba(16,185,129,${pulse})`, 2);
    text(f, 'Hα 线（656nm）被分成三重', x0 + 70, yTop + gap * 1.6, { color: C.green, font: '11px sans-serif' });
    text(f, `精细结构常数 α=1/137 给出分裂 ~${fine.toFixed(4)} eV（Z=${Z}）：Z⁴ 标度`, 30, 44, { color: C.cyan, font: '14px sans-serif' });

    footnotes(f, [
      '自旋-轨道耦合 + 相对论修正 + 真空极化（QED）共同劈裂能级——多重精细结构',
      'α 是无量纲耦合常数：1/137 这个数字是物理学最深的谜之一（狄拉克：上帝的号码）',
      '兰姆位移（1947）揭示真空涨落真实存在——QED 诞生的实验导火索（1955 诺奖）',
    ]);
    heading(f, '精细结构：能级里的 α=1/137');
  },
});
registerViz(fineStructure);

/** 塞曼效应。 */
const zeemanEffect = defineViz({
  slug: 'zeeman-effect', title: '塞曼效应', animated: true,
  params: {
    B: { type: 'range', min: 0, max: 3, default: 1.2, step: 0.1, label: '磁场 B（相对）' },
    kind: { type: 'select', options: ['正常塞曼', '反常塞曼'], default: '反常塞曼', label: '类型' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const B = num(params, 'B', 1.2);
    const anom = String((params as Record<string, unknown>)['kind'] ?? '').includes('反常');
    clear(f);
    // 零场单线 → 分裂
    const cx = w / 2, y0 = h - 80;
    const split = anom ? 3 : 2;
    const pulse = 0.7 + 0.3 * Math.sin(f.t * 3);
    const singleX = w * 0.2;
    seg(f, singleX, y0, singleX, y0 - 120, `rgba(16,185,129,${pulse})`, 3.4);
    text(f, 'B=0：一条谱线', singleX - 40, y0 + 24, { color: C.green, font: '12px sans-serif' });
    // 分裂组
    const spread = B * 70;
    for (let k = 0; k < split; k++) {
      const dx = (k - (split - 1) / 2) * (spread / Math.max(split - 1, 1)) * (anom ? 1.6 : 1);
      const x = w * 0.72 + dx;
      const hgt = k === Math.floor(split / 2) && anom ? 100 : 84;
      const color = anom && Math.abs(dx) < 1 ? C.warm : C.cool;
      seg(f, x, y0, x, y0 - hgt, `rgba(${color === C.warm ? '237,137,54' : '66,153,225'},${pulse})`, 3);
      // π/σ 标注
      text(f, dx === 0 ? 'π' : 'σ', x - 4, y0 - hgt - 12, { color, font: '12px sans-serif' });
    }
    text(f, `B=${B}：ΔE = m·g·μ_B·B — ${anom ? '反常塞曼：自旋参与（g≈2），多条等间距分裂' : '正常塞曼：三线分裂'}`, 30, 44, { color: C.cyan, font: '14px sans-serif' });
    text(f, '塞曼分裂正比于 B——天文磁场测量与原子磁力计的原理', 30, 66, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '1896 年塞曼发现钠 D 线在磁场中展宽——洛伦兹用电子论解释（1902 诺奖）',
      '反常塞曼需要电子自旋（乌伦贝克-古兹米特 1925）——自旋最早的证据之一',
      '顺磁共振（EPR/ESR）、核磁共振（NMR/MRI）都是塞曼分裂的现代应用',
    ]);
    heading(f, '塞曼效应：磁场劈开能级');
  },
});
registerViz(zeemanEffect);

/** 斯塔克效应。 */
const starkEffect = defineViz({
  slug: 'stark-effect', title: '斯塔克效应', animated: true,
  params: {
    E: { type: 'range', min: 0, max: 5, default: 2, step: 0.2, label: '电场强度（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const E = num(params, 'E', 2);
    clear(f);
    // 平行板与能级分裂
    const y0 = h - 70;
    const pl = h * 0.2;
    poly(f, [[w * 0.72, pl], [w * 0.96, pl], [w * 0.96, pl + 14], [w * 0.72, pl + 14]],
      { stroke: C.hot, lw: 2, fill: 'rgba(237,137,54,0.5)' } as any);
    poly(f, [[w * 0.72, y0 - 14], [w * 0.96, y0 - 14], [w * 0.96, y0], [w * 0.72, y0]],
      { stroke: C.cool, lw: 2, fill: 'rgba(56,130,215,0.5)' } as any);
    // 场线
    for (let k = 0; k < 5; k++) {
      const x = w * 0.75 + k * 44;
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin(f.t * 3 + k));
      seg(f, x, pl + 18, x, y0 - 18, `rgba(255,170,80,${pulse * 0.7})`, 1.6);
    }
    // n=3 分裂成 9 条（线性斯塔克）
    const levels = 7;
    const spread = E * 40;
    for (let i = 0; i < levels; i++) {
      const m = i - (levels - 1) / 2;
      const y = h * 0.42 - m * spread * 0.34;
      const x1 = 60 + Math.abs(m) * 14;
      seg(f, x1, y, w * 0.6, y, C.cool, 2.4);
      if (E > 0.3) {
        // 极化位移
        const shift = m * E * 6;
        dot(f, w * 0.6, y + shift * 0, 0.1, C.dim);
      }
    }
    text(f, `电场 E=${E}：n=3 的氢能级劈裂为 9 条（线性斯塔克 ∝ E·n(n₁−n₂)）`, 30, 44, { color: C.cyan, font: '14px sans-serif' });
    text(f, '与塞曼不同：斯塔克分裂来自电偶极矩与电场的耦合', 30, 66, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '1913 年斯塔克在氢光谱上观测到电场分裂——比塞曼效应晚了 17 年（电场实验更难）',
      '量子力学用微扰论精确再现分裂图样（海森堡 1926）——新量子论的验证战',
      '斯塔克调谐是量子技术工具：电场可调量子点与里德伯原子的能级对齐',
    ]);
    heading(f, '斯塔克效应：电场劈开能级');
  },
});
registerViz(starkEffect);

/** 拉姆位移。 */
const lambShift = defineViz({
  slug: 'lamb-shift', title: '拉姆位移', animated: true,
  params: {
    fine: { type: 'select', options: ['狄拉克理论预言', 'QED 实测'], default: 'QED 实测', label: '视角' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const qed = String((params as Record<string, unknown>)['fine'] ?? '').includes('QED');
    clear(f);
    const x0 = w * 0.3, y = h / 2 + 10;
    // 两个近邻能级
    const dy = qed ? 26 : 0;
    seg(f, x0, y, x0 + 220, y, C.cool, 3.2);
    text(f, '2S₁/₂', x0 + 232, y + 4, { color: C.cool, font: '14px sans-serif' });
    seg(f, x0, y - dy - 74, x0 + 220, y - dy - 74, C.warm, 3.2);
    text(f, '2P₁/₂', x0 + 232, y - dy - 74 + 4, { color: C.warm, font: '14px sans-serif' });
    if (qed) {
      // 位移箭头与测量
      seg(f, x0 + 110, y - 74, x0 + 110, y, C.hot, 2.4);
      poly(f, [[x0 + 110, y], [x0 + 104, y - 10], [x0 + 116, y - 10]], { stroke: C.hot, lw: 1.6, fill: C.hot } as any);
      text(f, '1057 MHz（1947 拉姆与韦瑟福德）', x0 + 124, y - 34, { color: C.hot, font: '13px sans-serif' });
      // 电子涨落
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + f.t * 2;
        dot(f, x0 + 60 + Math.cos(a) * 40, y - 36 + Math.sin(a) * 22, 3, `rgba(140,210,255,${0.4 + 0.4 * Math.sin(f.t * 4 + k)})`);
      }
      text(f, '真空涨落与电子自能把 2S 抬高——狄拉克方程需要 QED 补丁', 30, 44, { color: C.cyan, font: '14px sans-serif' });
    } else {
      text(f, '狄拉克方程：2S₁/₂ 与 2P₁/₂ 严格简并（同 n、同 j）', 30, 44, { color: C.cyan, font: '14px sans-serif' });
      text(f, '理论如此干净——但实验偏偏分开了', 30, 66, { color: C.warm, font: '12px sans-serif' });
    }

    footnotes(f, [
      '拉姆位移是 QED 的出生证：微扰计算与 1057MHz 测量吻合到 10⁻⁶ 量级',
      '真空不是空无：虚光子不断敲打电子，抬高其自能——实测的真空极化',
      '电子反常磁矩 g−2 精度达 10⁻¹²——物理学史上最精确的理论预言',
    ]);
    heading(f, '拉姆位移：真空并不空');
  },
});
registerViz(lambShift);

/** 里德伯原子。 */
const rydbergSeries = defineViz({
  slug: 'rydberg-series', title: '里德伯原子与电离', animated: true,
  params: {
    n: { type: 'range', min: 1, max: 60, default: 10, step: 1, label: '主量子数 n' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'n', 10));
    clear(f);
    const cx = w * 0.3, cy = h / 2 + 6;
    // 核与轨道壳层
    dot(f, cx, cy, 6, C.warm);
    const maxVis = Math.min(n, 14);
    for (let k = 1; k <= maxVis; k++) {
      const rr = 18 + (k / maxVis) * Math.min(w * 0.24, 170);
      f.ctx.beginPath(); f.ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      f.ctx.strokeStyle = `rgba(66,153,225,${0.85 - k * 0.045})`;
      f.ctx.lineWidth = 1.8; f.ctx.stroke();
    }
    // 电子（高 n 大轨道）
    const ea = f.t * 2;
    const eR = 18 + (Math.min(n, 14) / Math.min(n, 14)) * Math.min(w * 0.24, 170);
    dot(f, cx + Math.cos(ea) * (n > 14 ? eR * 0.9 : eR), cy + Math.sin(ea) * (n > 14 ? eR * 0.9 : eR), 5, C.cyan);
    // 能级图（右）
    const x0 = w * 0.56, yBase = h - 66, yTop = 70;
    seg(f, x0 - 10, yBase, w - 40, yBase, `${C.dim}aa`, 1.6);
    const E = (k: number): number => -13.6 / (k * k);
    for (let k of [1, 2, 3, 5, 10, 20, 50]) {
      const yy = yBase + (E(k) + 13.6) / 13.6 * (yTop - yBase);
      seg(f, x0, yy, x0 + 150, yy, k <= 3 ? C.cool : `${C.warm}88`, 2);
      text(f, `n=${k}（${E(k).toFixed(3)}eV）`, x0 + 158, yy + 4, { color: C.dim, font: '10px sans-serif' });
    }
    seg(f, x0, yTop, w - 40, yTop, C.hot, 1.8);
    text(f, '电离极限 0 eV', x0 + 4, yTop - 8, { color: C.hot, font: '11px sans-serif' });
    const yyN = yBase + (E(Math.min(n, 60)) + 13.6) / 13.6 * (yTop - yBase);
    dot(f, x0 + 70, yyN, 6, C.cyan);
    text(f, `n=${n}：E≈${E(Math.min(n, 60)).toFixed(4)} eV，轨道半径 ∝ n² → ${(n * n)}× 氢基态`, 30, 44, { color: C.cyan, font: '14px sans-serif' });

    footnotes(f, [
      '里德伯原子：电子跑到几十上百的 n——实验室可制备 n>100、轨道达微米级的"巨型原子"',
      '相邻高 n 能级间距趋零：对微波与场强极度敏感——里德伯原子是单光子探测的利器',
      '同一条 −13.6/n² 能级公式统摄氢、类氢离子与里德伯系列——量子数的胜利',
    ]);
    heading(f, '里德伯原子：趋近电离的巨型氢');
  },
});
registerViz(rydbergSeries);

/** 选择定则。 */
const selectionRules = defineViz({
  slug: 'selection-rules', title: '跃迁选择定则', animated: true,
  params: {
    kind: { type: 'select', options: ['电偶极跃迁', '禁戒跃迁'], default: '电偶极跃迁', label: '类型' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const forbidden = String((params as Record<string, unknown>)['kind'] ?? '').includes('禁戒');
    clear(f);
    const x0 = w * 0.24, x1 = w * 0.7;
    // 两能级
    const y1 = h * 0.66, y2 = h * 0.34;
    seg(f, x0 - 60, y1, x1 + 60, y1, C.cool, 3);
    seg(f, x0 - 60, y2, x1 + 60, y2, C.warm, 3);
    text(f, '2p（l=1）', x1 + 74, y1 + 4, { color: C.cool, font: '13px sans-serif' });
    text(f, '1s（l=0）', x1 + 74, y2 + 4, { color: C.warm, font: '13px sans-serif' });
    if (!forbidden) {
      // 允许跃迁（光子波）
      const prog = (f.t * 0.6) % 1;
      const yy = y1 + (y2 - y1) * prog;
      const wave: [number, number][] = [];
      for (let i = 0; i <= 50; i++) {
        const t = i / 50;
        wave.push([w * 0.44 + t * 60, yy + Math.sin(t * Math.PI * 6 - f.t * 8) * 12]);
      }
      poly(f, wave, { stroke: C.green, lw: 2.6 });
      text(f, 'Δl = ±1：电偶极允许（莱曼系 121.6nm）', w * 0.44 - 100, (y1 + y2) / 2 - 40, { color: C.green, font: '13px sans-serif' });
    } else {
      // 禁戒（打叉 + 磁偶极微弱）
      seg(f, w * 0.4, y2 + 10, w * 0.5, y1 - 10, C.hot, 3);
      seg(f, w * 0.5, y2 + 10, w * 0.4, y1 - 10, C.hot, 3);
      text(f, 'Δl=0 或 ±2：电偶极禁戒（需磁偶极/电四极，弱 10⁵ 倍）', w * 0.26, (y1 + y2) / 2 - 46, { color: C.hot, font: '13px sans-serif' });
      // 禁戒跃迁仍可发生（闪烁线）
      const pulse = Math.sin(f.t * 2) > 0 ? 0.7 : 0.15;
      seg(f, w * 0.56, y2, w * 0.56, y1, `rgba(146,84,222,${pulse})`, 2);
      text(f, '禁线（如 [O III] 5007nm）——星云发光的紫色', w * 0.56 + 10, (y1 + y2) / 2 + 6, { color: '#9254de', font: '11px sans-serif' });
    }
    text(f, '选择定则来自角动量与宇称守恒——不是动力学，是对称性', 30, 44, { color: C.cyan, font: '14px sans-serif' });

    footnotes(f, [
      '电偶极跃迁要求 Δl=±1、Δm=0,±1：谱线强度的_selection_由对称性裁决',
      '"禁戒"只是极弱：亚稳态寿命长（毫秒~秒）——氦氖激光的氖亚稳态即靠它储能',
      '天体物理用禁线诊断星云密度温度：[O III]、[N II] 是星云光谱的常客',
    ]);
    heading(f, '选择定则：对称性决定哪些谱线亮');
  },
});
registerViz(selectionRules);

/** 费米黄金规则与跃迁率。 */
const goldenRule = defineViz({
  slug: 'golden-rule', title: '费米黄金规则', animated: true,
  params: {
    V: { type: 'range', min: 0.2, max: 3, default: 1, step: 0.1, label: '微扰强度 |V|' },
    rho: { type: 'range', min: 0.5, max: 5, default: 2, step: 0.1, label: '末态密度 ρ(E)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const V = num(params, 'V', 1), rho = num(params, 'rho', 2);
    const rate = (2 * Math.PI) * V * V * rho; // ħ=1
    clear(f);
    const x0 = 56, y0 = h - 56, y1 = 56;
    const vv = view(f, { xMin: 0, xMax: 3, yMin: 0, yMax: 12, inset: 50 });
    grid(f, vv, { divisions: 4, ticks: true });
    // 初态 + 末态连续谱
    const Ei = 0.6;
    seg(f, vv.sx(Ei) - 40, vv.sy(2), vv.sx(Ei) + 40, vv.sy(2), C.warm, 3.4);
    text(f, '初态 |i⟩', vv.sx(Ei) - 34, vv.sy(2) - 12, { color: C.warm, font: '12px sans-serif' });
    // 末态带
    poly(f, [[vv.sx(1.4), vv.sy(8)], [vv.sx(3), vv.sy(8)], [vv.sx(3), vv.sy(11)], [vv.sx(1.4), vv.sy(11)]],
      { stroke: C.cool, lw: 2, fill: 'rgba(66,153,225,0.18)', dash: [6, 4] } as any);
    text(f, '末态连续谱 ρ(E)', vv.sx(1.5), vv.sy(11) - 8, { color: C.cool, font: '12px sans-serif' });
    // 跃迁（脉冲）
    const prob = Math.min(rate / 12, 1);
    const pulse = prob * (0.6 + 0.4 * Math.sin(f.t * 5));
    for (let k = 0; k < 3; k++) {
      const t = ((f.t * 0.7 + k / 3) % 1);
      const x = vv.sx(Ei) + 40 + t * (vv.sx(1.4) - vv.sx(Ei) - 60);
      const y = vv.sy(2) + t * (vv.sy(9) - vv.sy(2));
      dot(f, x, y, 4, `rgba(16,185,129,${pulse})`);
    }
    text(f, `Γ = (2π/ħ)|V|²ρ(E) = ${(rate).toFixed(2)}（相对）`, 30, 44, { color: C.cyan, font: '14px sans-serif' });
    text(f, '跃迁率 ∝ 微扰强度平方 × 末态密度——散射与衰变的通用公式', 30, 66, { color: C.green, font: '12px sans-serif' });
    void x0; void y0; void y1;

    footnotes(f, [
      "1927 年费米给出：一阶微扰 + 连续末态 = 稳定跃迁率——命名即'黄金规则'",
      "自发辐射、β 衰变、光电子产额、荧光寿命全都由它计算——统一了'衰变'的语言",
      "矩阵元管'耦合多强“、密度管”有多少去处'——两因子决定一切速率",
    ]);
    heading(f, '费米黄金规则：跃迁率的统一公式');
  },
});
registerViz(goldenRule);

/** 散射截面。 */
const scatteringCrossSection = defineViz({
  slug: 'scattering-cross-section', title: '散射截面与微分截面', animated: true,
  params: {
    l: { type: 'range', min: 0, max: 4, default: 1, step: 1, label: '分波级次 l' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const ell = Math.round(num(params, 'l', 1));
    clear(f);
    const cx = w * 0.3, cy = h / 2 + 6;
    // 靶核与入射粒子
    dot(f, cx, cy, 12, C.warm);
    const prog = (f.t * 0.45) % 1;
    const px = w * 0.06 + prog * (cx - w * 0.06 - 30);
    dot(f, px, cy, 6, C.cyan);
    // 散射后的分波（角分布花瓣）
    if (prog > 0.55) {
      const petals = ell + 1;
      for (let k = 0; k < petals; k++) {
        const baseA = ((k + 0.5) / petals) * Math.PI - Math.PI / 2;
        for (const sgn of [1, -1]) {
          const pts: [number, number][] = [];
          for (let i = 0; i <= 30; i++) {
            const t = i / 30;
            const th = baseA * sgn;
            const spread = Math.sin(t * Math.PI) * 0.5;
            const r = t * Math.min(w * 0.3, 210);
            pts.push([cx + r * Math.cos(th + spread * (sgn > 0 ? 1 : -1) * 0.5), cy + r * Math.sin(th + spread * (sgn > 0 ? 1 : -1) * 0.5)]);
          }
          poly(f, pts, { stroke: `rgba(16,185,129,${0.85 - prog * 0.4})`, lw: 2.4 });
        }
      }
    }
    text(f, `l=${ell} 分波：dσ/dΩ 的角分布有 ${ell + 1} 个花瓣（球谐形状）`, 30, 44, { color: C.cyan, font: '14px sans-serif' });
    text(f, '总截面 σ = Σ_l πλ²(2l+1)·sin²δ_l —— 分波展开把散射拆成角动量通道', 30, 66, { color: C.green, font: '12px sans-serif' });

    footnotes(f, [
      "截面是概率的几何化：把'打中的可能性“换算成”等效靶面积'（单位靶恩=10⁻²⁴cm²）",
      '卢瑟福散射截面揭示原子核（1911）；质子-质子总截面支撑太阳聚变率',
      "LHC 的希格斯产生截面以 pb（10⁻³⁶cm²）计——'看到'一个事件需要 10¹⁵ 次对撞",
    ]);
    heading(f, '散射截面：概率的靶面积');
  },
});
registerViz(scatteringCrossSection);

/** 量子测量与波函数坍缩。 */
const quantumMeasurement = defineViz({
  slug: 'quantum-measurement', title: '测量与波函数坍缩', animated: true,
  params: {
    th: { type: 'range', min: 0, max: 180, default: 60, step: 1, label: '自旋 z 轴测量角 (°)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const ang = (num(params, 'th', 60) * Math.PI) / 180;
    const pUp = Math.cos(ang / 2) ** 2;
    clear(f);
    // 测量前：叠加态（布洛赫球面概率云）
    const cx = w * 0.28, cy = h / 2 + 6;
    const R = Math.min(w * 0.2, 110);
    f.ctx.beginPath(); f.ctx.arc(cx, cy, R, 0, Math.PI * 2);
    f.ctx.strokeStyle = `${C.dim}aa`; f.ctx.lineWidth = 1.6; f.ctx.stroke();
    seg(f, cx, cy + R, cx, cy - R, `${C.cool}aa`, 1.4);
    text(f, '|↑⟩', cx - 10, cy - R - 8, { color: C.cool, font: '13px sans-serif' });
    text(f, '|↓⟩', cx - 10, cy + R + 20, { color: C.cool, font: '13px sans-serif' });
    // 概率云（不确定）
    for (let k = 0; k < 14; k++) {
      const a = f.t * 0.6 + (k / 14) * Math.PI * 2;
      const rr = R * 0.8;
      dot(f, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 3, `rgba(140,210,255,${0.3 + 0.3 * Math.sin(f.t * 3 + k)})`);
    }
    text(f, '测量前：叠加态', cx - 54, cy - R - 34, { color: C.cyan, font: '13px sans-serif' });
    // 测量装置
    const mx = w * 0.52;
    poly(f, [[mx, h * 0.28], [mx + 44, h * 0.28], [mx + 44, h * 0.72], [mx, h * 0.72]],
      { stroke: C.warm, lw: 2.4, fill: 'rgba(237,137,54,0.16)' } as any);
    text(f, '测量', mx + 4, h * 0.52, { color: C.warm, font: '13px sans-serif' });
    // 测量后：坍缩到确定态（按概率闪烁）
    const outcome = Math.sin(f.t * 1.2) > (pUp * 2 - 1) ? 1 : 0;
    const cx2 = w * 0.78;
    f.ctx.beginPath(); f.ctx.arc(cx2, cy, R, 0, Math.PI * 2);
    f.ctx.strokeStyle = `${C.dim}aa`; f.ctx.lineWidth = 1.6; f.ctx.stroke();
    seg(f, cx2, cy + R, cx2, cy - R, `${C.cool}aa`, 1.4);
    dot(f, cx2, outcome === 0 ? cy - R : cy + R, 9, outcome === 0 ? C.cool : C.warm);
    text(f, outcome === 0 ? '坍缩到 |↑⟩' : '坍缩到 |↓⟩', cx2 - 40, cy + R + 44, { color: C.green, font: '14px sans-serif' });
    text(f, `P(↑)=cos²(θ/2)=${pUp.toFixed(2)}，P(↓)=${(1 - pUp).toFixed(2)}：每次一个确定结果`, 30, 44, { color: C.cyan, font: '14px sans-serif' });

    footnotes(f, [
      '测量把叠加态投影到本征态：结果随机、概率由玻恩定则给出——量子的核心仪式',
      '测量装置与量子系统边界在哪里？冯·诺依曼-维格纳佯谬至今仍是基础问题',
      "退相干解释了经典世界的涌现：环境'记录'让干涉项指数消失——坍缩不再神秘但更深刻",
    ]);
    heading(f, '量子测量：概率变成事实的一瞬');
  },
});
registerViz(quantumMeasurement);
