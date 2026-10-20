import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text, view } from '../canvas';

/** P84 球面镜成像。 */
const mirrorConcave = defineViz({
  slug: 'mirror-concave', title: '球面镜成像',
  params: {
    do: { type: 'range', min: 0.3, max: 4, default: 1.6, step: 0.1, label: '物距 u（f 倍）' },
    kind: { type: 'select', options: ['凹面镜', '凸面镜'], default: '凹面镜', label: '镜型' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const uRatio = num(params, 'do', 1.6);
    const concave = (params as Record<string, unknown>)['kind'] !== '凸面镜';
    const axis = h * 0.62;
    const cx = w * 0.8;
    const R = Math.min(w * 0.4, 260);
    const ff = R / 2;
    const u = uRatio * ff;
    clear(f);
    // 主光轴
    seg(f, 40, axis, w - 30, axis, C.dim, 1.4);
    text(f, 'P 点（顶点）', cx - 34, axis + 18, { color: C.dim, font: '11px sans-serif' });
    // 镜面
    const mirror: [number, number][] = [];
    const sign = concave ? -1 : 1;
    for (let i = -40; i <= 40; i++) {
      const x = i * (R * 0.9) / 80;
      const y = (x * x) / (4 * R);
      mirror.push([cx + x, axis + sign * y]);
    }
    poly(f, mirror, { stroke: C.cool, lw: 3.4 });
    // 焦点与曲率中心
    const fx = cx - ff;
    dot(f, fx, axis, 4, C.warm);
    text(f, 'F', fx - 4, axis + 18, { color: C.warm, font: '11px sans-serif' });
    if (concave) {
      const rx = cx - R;
      dot(f, rx, axis, 3, C.dim);
      text(f, 'C', rx - 4, axis + 18, { color: C.dim, font: '11px sans-serif' });
    }
    // 物与像（透镜公式 1/u+1/v=1/f）
    const ox = cx - u;
    const vv = concave ? 1 / (1 / ff - 1 / u) : 1 / (1 / (-ff) - 1 / u);
    const objectH = 44;
    seg(f, ox, axis, ox, axis - objectH, C.hot, 3);
    poly(f, [[ox, axis - objectH], [ox - 7, axis - objectH + 10], [ox + 7, axis - objectH + 10]], { stroke: C.hot, lw: 1.4, fill: C.hot } as any);
    text(f, '物', ox - 8, axis - objectH - 8, { color: C.hot, font: '11px sans-serif' });
    if (isFinite(vv) && Math.abs(vv) < 3 * ff) {
      const ix = cx - vv;
      const mag = -vv / u;
      const ih = objectH * mag;
      seg(f, ix, axis, ix, axis - ih, C.green, 3);
      text(f, `像（${(mag > 0 ? '正立放大' : mag < -1 ? '倒立放大' : '倒立缩小')}）`, ix - 40, axis - ih + (mag > 0 ? -10 : 26), { color: C.green, font: '11px sans-serif' });
    } else {
      text(f, '物在焦点上 → 像在无穷远（探照灯原理）', 60, 60, { color: C.green, font: '12px sans-serif' });
    }
    text(f, `u = ${uRatio} f：${uRatio > 2 ? 'u>2f，倒立缩小实像（照相机）' : uRatio > 1 ? 'f<u<2f，倒立放大实像（投影仪）' : 'u<f，正立放大虚像（放大镜）'}`,
      40, 44, { color: C.cyan, font: '12px sans-serif' });

    void view;
    footnotes(f, [
      '球面镜公式 1/u + 1/v = 1/f，放大率 m = −v/u：一条公式管住所有成像情况',
      '凹面镜聚光（太阳灶、反射式望远镜），凸面镜广角（汽车后视镜、路口广角镜）',
      '抛物面镜把轴上平行光精确聚焦到一点——大口径望远镜避免球面像差的正解',
    ]);
    heading(f, '球面镜：一条公式五种像');
  },
});
registerViz(mirrorConcave);

/** P85 棱镜色散。 */
const prismDispersion = defineViz({
  slug: 'prism-dispersion', title: '棱镜色散', animated: true,
  params: {
    apex: { type: 'range', min: 20, max: 70, default: 45, step: 1, label: '顶角 (°)' },
    n: { type: 'range', min: 1.4, max: 2.0, default: 1.62, step: 0.01, label: '折射率 n（589nm）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const apex = (num(params, 'apex', 45) * Math.PI) / 180;
    const n = num(params, 'n', 1.62);
    clear(f);
    const cx = w * 0.44, cy = h / 2 + 10;
    const S = Math.min(w, h) * 0.3;
    // 三棱镜（顶角在上）
    const tri: [number, number][] = [
      [cx, cy - S * 0.7],
      [cx - S * 0.9, cy + S * 0.62],
      [cx + S * 0.9, cy + S * 0.62],
    ];
    poly(f, tri, { stroke: C.cool, lw: 2.4, fill: 'rgba(66,153,225,0.18)' } as any);
    // 白光入射（左侧）
    const inY = cy - S * 0.1;
    seg(f, 30, inY + 10, cx - S * 0.62, inY, '#f8fafc', 2.6);
    text(f, '白光', 34, inY + 34, { color: '#f8fafc', font: '11px sans-serif' });
    // 出射彩虹（红偏折小、紫偏折大）——按 Cauchy 色散示意
    const exitX = cx + S * 0.42, exitY = cy + S * 0.08;
    const spread = (n - 1) * 0.9; // 色散总展宽
    const rays = 7;
    const palette = ['#ff4d4f', '#ff9800', '#ffd600', '#52c41a', '#1890ff', '#4a6cf7', '#9254de'];
    for (let i = 0; i < rays; i++) {
      const k = i / (rays - 1) - 0.5; // -0.5..0.5
      const ang = 0.16 + k * spread * 0.8 + Math.sin(f.t * 1.4) * 0.004;
      const L = w - exitX - 40;
      const pts: [number, number][] = [[exitX, exitY], [exitX + L, exitY + L * Math.tan(ang)]];
      poly(f, pts, { stroke: palette[i], lw: 2.4 });
      if (i % 3 === 0) text(f, i === 0 ? '红（偏折小）' : i === 6 ? '紫（偏折大）' : '', exitX + L + 4, exitY + L * Math.tan(ang), { color: palette[i], font: '11px sans-serif' });
    }
    text(f, `n(${Math.round((n - 1) * 1000)}‰)：折射率随波长变化（柯西公式）→ 不同色分开走`, 30, 44, { color: C.cyan, font: '12px sans-serif' });

    void apex;
    footnotes(f, [
      '玻璃对紫光的折射率大于红光——同一入射角下紫光偏折更多，白光被拉成色带',
      '最小偏向角法测折射率是光学计量的经典手段：顶角、偏向角、波长三者联动',
      "牛顿 1666 年用棱镜证明白光本是复合色；彩虹则是天上亿万颗'小棱镜'的集体作品",
    ]);
    heading(f, '棱镜色散：白光的分解');
  },
});
registerViz(prismDispersion);

/** P86 彩虹的形成。 */
const rainbow = defineViz({
  slug: 'rainbow', title: '彩虹的形成', animated: true,
  params: {
    dropR: { type: 'range', min: 0.5, max: 4, default: 1.5, step: 0.1, label: '雨滴半径（mm）' },
    sun: { type: 'range', min: 0, max: 70, default: 40, step: 1, label: '太阳高度角 (°)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const R = num(params, 'dropR', 1.5);
    const sunAng = num(params, 'sun', 40);
    clear(f);
    // 太阳
    const sx = w - 70, sy = 40 + sunAng * 0.5;
    dot(f, sx, sy, 16, '#ffd76e');
    text(f, '太阳', sx - 20, sy + 34, { color: '#ffd76e', font: '11px sans-serif' });
    // 雨滴（放大示意）：入射→内反射→出射
    const dx = w * 0.3, dy = h * 0.42, dr = Math.min(w, h) * (0.06 + R * 0.02);
    f.ctx.beginPath(); f.ctx.arc(dx, dy, dr, 0, Math.PI * 2);
    f.ctx.fillStyle = 'rgba(120,190,255,0.35)'; f.ctx.fill();
    f.ctx.strokeStyle = C.cool; f.ctx.lineWidth = 2; f.ctx.stroke();
    text(f, `雨滴 R=${R}mm`, dx - 34, dy - dr - 12, { color: C.cool, font: '11px sans-serif' });
    // 光线：入射 → 折射 → 内反射 → 出射折射（红 42° 紫 40°）
    const inPts: [number, number][] = [[dx + dr * 2.6, dy - dr * 1.5], [dx + dr * 0.62, dy - dr * 0.62]];
    poly(f, inPts, { stroke: '#fff8e6', lw: 2.4 });
    const refl: [number, number][] = [[dx + dr * 0.62, dy - dr * 0.62], [dx - dr * 0.7, dy + dr * 0.55], [dx + dr * 0.4, dy + dr * 0.8]];
    poly(f, refl, { stroke: '#ffe9b0', lw: 2 });
    // 出射两色
    poly(f, [[dx + dr * 0.4, dy + dr * 0.8], [dx - dr * 2.2, dy + dr * 2.0]], { stroke: '#ff6b6b', lw: 2.4 });
    poly(f, [[dx + dr * 0.4, dy + dr * 0.8], [dx - dr * 2.3, dy + dr * 2.4]], { stroke: '#9254de', lw: 2.4 });
    text(f, '红光出射角 ≈ 42°', dx - dr * 3.4, dy + dr * 2.1, { color: '#ff6b6b', font: '10px sans-serif' });
    text(f, '紫光 ≈ 40°', dx - dr * 3.4, dy + dr * 2.7, { color: '#9254de', font: '10px sans-serif' });
    // 宏观彩虹弧（42° 锥面）
    const hx = w * 0.2, hy = h - 60;
    const arc: [number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const a = Math.PI * (i / 60);
      arc.push([hx + Math.cos(a) * 180, hy - Math.sin(a) * 140]);
    }
    const bands = ['#ff4d4f', '#ff9800', '#ffd600', '#52c41a', '#1890ff', '#4a6cf7', '#9254de'];
    for (let b = 0; b < bands.length; b++) {
      const arc2: [number, number][] = [];
      for (let i = 0; i <= 60; i++) {
        const a = Math.PI * (i / 60);
        const rr = 180 - b * 5;
        arc2.push([hx + Math.cos(a) * rr, hy - Math.sin(a) * (rr * 0.78)]);
      }
      poly(f, arc2, { stroke: bands[b], lw: 4 });
    }
    void f;
    text(f, `观测者背对太阳、面对雨幕：主虹 40°~42°（红在外）`, 30, 44, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      '一次折射+一次内反射构成主虹（42°），二次内反射构成霓（51°，色序相反）',
      '每个雨滴同时发出全谱，观测者只看到各自方向对应角度的那一种颜色',
      '雨滴越大色越浓（阵雨的彩虹更艳）；太阳越低彩虹越高——日出日落才有完整弧',
    ]);
    heading(f, '彩虹：42 度的约定');
  },
});
registerViz(rainbow);

/** P87 光纤传输。 */
const fiber = defineViz({
  slug: 'fiber', title: '光纤传输', animated: true,
  params: {
    coreN: { type: 'range', min: 1.44, max: 1.5, default: 1.48, step: 0.005, label: '纤芯折射率' },
    cladN: { type: 'range', min: 1.4, max: 1.47, default: 1.46, step: 0.005, label: '包层折射率' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const nc = num(params, 'coreN', 1.48), ncl = num(params, 'cladN', 1.46);
    const totalRef = nc > ncl;
    clear(f);
    const yMid = h / 2 + 6, coreH = 46;
    // 包层与纤芯
    poly(f, [[50, yMid - coreH - 30], [w - 40, yMid - coreH - 30], [w - 40, yMid - 40], [50, yMid - 40]], { stroke: C.dim, lw: 1.6, fill: 'rgba(148,163,184,0.18)' } as any);
    poly(f, [[50, yMid - 40], [w - 40, yMid - 40], [w - 40, yMid + 40], [50, yMid + 40]], { stroke: C.cool, lw: 2, fill: 'rgba(56,130,215,0.20)' } as any);
    poly(f, [[50, yMid + 40], [w - 40, yMid + 40], [w - 40, yMid + 40 + 30], [50, yMid + 40 + 30]], { stroke: C.dim, lw: 1.6, fill: 'rgba(148,163,184,0.18)' } as any);
    text(f, '包层', w - 80, yMid - coreH - 44, { color: C.dim, font: '11px sans-serif' });
    text(f, `纤芯 n₁=${nc}`, 60, yMid + 64, { color: C.cool, font: '11px sans-serif' });
    // 光线锯齿传播（全反射时）
    const pts: [number, number][] = [];
    const bounce = totalRef ? 7 : 3;
    for (let i = 0; i <= 400; i++) {
      const t = i / 400;
      const x = 50 + t * (w - 90);
      const tri = Math.abs(((t * bounce) % 2) - 1); // 0..1 三角波
      const y = yMid - (tri - 0.5) * 2 * (coreH - 8);
      pts.push([x, y]);
    }
    poly(f, pts, { stroke: totalRef ? C.warm : C.hot, lw: 2.4, dash: totalRef ? undefined : [7, 5] } as any);
    text(f, totalRef ? 'n₁>n₂：全反射约束，光在纤芯中弹反射前进' : 'n₁≤n₂：全反射条件破坏，光泄漏出纤芯',
      30, 44, { color: totalRef ? C.green : C.hot, font: '13px sans-serif' });

    footnotes(f, [
      '数值孔径 NA = √(n₁²−n₂²) 决定可接收的最大入射角——纤芯包层折射率差是核心设计参数',
      '石英光纤在 1550nm 窗口损耗低至 0.2dB/km：跨洋光缆 20 来公里才需一次中继',
      '单模光纤纤芯极细（~9μm）只传基模，消除模间色散——长途通信的主力',
    ]);
    heading(f, '光纤：全反射的信息高速公路');
  },
});
registerViz(fiber);

/** P88 景深。 */
const depthOfField = defineViz({
  slug: 'depth-of-field', title: '景深',
  params: {
    fnum: { type: 'range', min: 1.4, max: 16, default: 2.8, step: 0.1, label: '光圈 f/N' },
    focus: { type: 'range', min: 0.5, max: 10, default: 3, step: 0.1, label: '对焦距离 (m)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const fnum = num(params, 'fnum', 2.8);
    const focus = num(params, 'focus', 3);
    clear(f);
    const x0 = 56, x1 = w - 30, y0 = h - 56, y1 = 56;
    // 景深范围示意：超焦距公式简化
    const coc = 0.03; // 弥散圆
    const fl = 0.05; // 50mm
    const H = (focus * focus) / ((fl * focus) / (fnum * coc * 1000) - fl) + focus; // 超焦距近似
    const near = isFinite(H) && H > focus ? (H * focus) / (H + (focus - 0)) : focus * 0.6;
    const far = isFinite(H) && H > focus ? (H * focus) / (Math.max(H - focus, 0.01)) : Infinity;
    const sx = (d: number) => x0 + (Math.min(Math.log10(Math.max(d, 0.3) / 0.3), Math.log10(50 / 0.3))) / Math.log10(50 / 0.3) * (x1 - x0);
    seg(f, x0, y0 + 20, x1, y0 + 20, C.grid, 1.3);
    // 清晰带
    const nA = sx(Math.max(near, 0.31)), fA = Math.min(sx(isFinite(far) ? far : 50), x1);
    poly(f, [[nA, y0], [fA, y0], [fA, y1 + 20], [nA, y1 + 20]], { stroke: 'rgba(16,185,129,0.15)', fill: 'rgba(16,185,129,0.15)' } as any);
    seg(f, sx(focus), y1 + 10, sx(focus), y0 + 30, C.hot, 2.4);
    text(f, `对焦 ${focus}m`, sx(focus) - 28, y1, { color: C.hot, font: '12px sans-serif' });
    dot(f, sx(Math.max(near, 0.31)), y0 + 20, 5, C.green);
    text(f, `近界 ${near.toFixed(2)}m`, sx(Math.max(near, 0.31)) - 20, y0 + 44, { color: C.green, font: '11px sans-serif' });
    if (isFinite(far) && far < 49) {
      dot(f, fA, y0 + 20, 5, C.green);
      text(f, `远界 ${far.toFixed(1)}m`, fA - 20, y0 + 44, { color: C.green, font: '11px sans-serif' });
    } else {
      text(f, '远界 → ∞（进入超焦距区）', x1 - 120, y0 + 44, { color: C.green, font: '11px sans-serif' });
    }
    text(f, `f/${fnum}：${fnum < 4 ? '大光圈 → 浅景深（人像背景虚化）' : fnum > 8 ? '小光圈 → 深景深（风光全清晰）' : '中等景深'}`, 30, 44, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '景深由弥散圆容许值、焦距、光圈、对焦距离共同决定——f/1.4 的焦外是奶油，f/16 的前后都锐',
      '超焦距：对焦在 H 处可获得 0.5H 到 ∞ 的清晰区——风光摄影的经典设置',
      "中画幅相机弥散圆标准更严、景深更浅，这是全画幅与中画幅'虚化差异'的量化来源",
    ]);
    heading(f, '景深：清晰的边界在哪里');
  },
});
registerViz(depthOfField);

/** P89 望远镜的分辨极限。 */
const telescopeResolution = defineViz({
  slug: 'telescope-resolution', title: '望远镜的分辨极限',
  params: {
    D: { type: 'range', min: 50, max: 6500, default: 500, step: 50, label: '口径 D (mm)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const D = num(params, 'D', 500);
    const theta = (1.22 * 550e-9) / (D / 1000) * (180 / Math.PI) * 3600; // 角秒
    clear(f);
    // 口径对比条
    const labels = [
      ['人眼', 7], ['双筒 10×50', 50], ['伽利略', 40], ['哈勃', 2400], ['JWST', 6500],
    ] as const;
    const x0 = 70, yTop = 76;
    for (let i = 0; i < labels.length; i++) {
      const [name, dia] = labels[i];
      const y = yTop + i * 44;
      const bw = (dia / 6500) * (w - 240) + 6;
      const isNow = (D >= dia - 250 && D <= dia + 250);
      poly(f, [[x0, y], [x0 + bw, y], [x0 + bw, y + 22], [x0, y + 22]],
        { stroke: isNow ? C.warm : C.cool, lw: 2, fill: isNow ? 'rgba(237,137,54,0.35)' : 'rgba(66,153,225,0.25)' } as any);
      text(f, `${name}（${dia >= 1000 ? (dia / 1000).toFixed(1) + 'm' : dia + 'mm'}）`, x0 + bw + 10, y + 16, { color: isNow ? C.warm : C.dim, font: '11px sans-serif' });
      const t2 = (1.22 * 550e-9) / (dia / 1000) * (180 / Math.PI) * 3600;
      text(f, `θ≈${t2 < 1 ? t2.toFixed(2) : t2.toFixed(1)}″`, x0 - 60, y + 16, { color: C.cyan, font: '11px sans-serif' });
    }
    // 当前值
    poly(f, [[x0 - 66, yTop + 5 * 44 + 4], [w - 60, yTop + 5 * 44 + 4]], { stroke: `${C.hot}88`, lw: 1.4 } as any);
    text(f, `当前 D=${D >= 1000 ? (D / 1000).toFixed(1) + 'm' : D + 'mm'} → θ_min = 1.22λ/D = ${theta < 1 ? theta.toFixed(2) : theta.toFixed(1)} 角秒`,
      x0 - 66, yTop + 5 * 44 + 34, { color: C.hot, font: '14px sans-serif' });

    footnotes(f, [
      '同一星光过越大的口径，艾里斑越小，越能分开靠得近的双星——分辨率 ∝ 1/D',
      'JWST 6.5m 的衍射极限约 0.07″；EHT 用地球直径的虚拟口径得到 ~20μas 的黑洞影子',
      '地面望远镜还要过大气视宁度这一关，自适应光学与干涉测量是两条突破路线',
    ]);
    heading(f, '口径即硬道理：分辨极限的阶梯');
  },
});
registerViz(telescopeResolution);

/** P90 放大镜与视角。 */
const magnifier = defineViz({
  slug: 'magnifier', title: '放大镜与视角',
  params: {
    f: { type: 'range', min: 10, max: 100, default: 25, step: 1, label: '焦距 f (mm)' },
    d: { type: 'range', min: 20, max: 1000, default: 250, step: 10, label: '明视距离 (mm)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const fl = num(params, 'f', 25);
    const dd = num(params, 'd', 250);
    const mag = 1 + dd / fl;
    clear(f);
    const eyeX = w * 0.82, eyeY = h / 2 + 6;
    // 物（小箭头）
    const objX = eyeX - dd * 0.6;
    seg(f, objX, eyeY + 60, objX, eyeY + 30, C.hot, 3);
    text(f, '物（小）', objX - 26, eyeY + 76, { color: C.hot, font: '11px sans-serif' });
    // 透镜
    const lensX = eyeX - dd * 0.32;
    f.ctx.beginPath();
    f.ctx.ellipse(lensX, eyeY, 16, 74, 0, 0, Math.PI * 2);
    f.ctx.fillStyle = 'rgba(120,220,255,0.30)'; f.ctx.fill();
    f.ctx.strokeStyle = C.cool; f.ctx.lineWidth = 2.4; f.ctx.stroke();
    text(f, `f=${fl}mm`, lensX - 22, eyeY - 86, { color: C.cool, font: '11px sans-serif' });
    // 眼睛
    f.ctx.beginPath();
    f.ctx.moveTo(eyeX, eyeY); f.ctx.quadraticCurveTo(eyeX + 34, eyeY - 22, eyeX, eyeY + 22);
    f.ctx.closePath(); f.ctx.fillStyle = '#cbd5e1'; f.ctx.fill();
    text(f, '眼', eyeX + 6, eyeY + 5, { color: '#0a0a1a', font: '11px sans-serif' });
    // 虚像（放大的箭头，同侧）
    const imgH = (eyeY + 30 - (eyeY + 60)) * mag;
    const imgX = eyeX - dd * 0.9;
    seg(f, imgX, eyeY + 60, imgX, eyeY + 60 - Math.abs(imgH) * 0.66, C.green, 4);
    text(f, `视角放大 M = 1 + d/f = ${mag.toFixed(1)}×`, 40, 44, { color: C.cyan, font: '14px sans-serif' });
    text(f, '像在近处变大 → 对眼睛张开的视角变大', 40, 66, { color: C.green, font: '12px sans-serif' });

    footnotes(f, [
      "放大镜不是'放大物体'，而是把物体的像放在近处，让视角变大——视角才是视觉大小的本质",
      '标准明视距离 d=25cm：M=1+d/f，25mm 焦距约 10×——放大镜标称倍数的来源',
      '把物体放在焦点上成像于无穷远，眼睛最放松——验光仪与低视力助视器的设计点',
    ]);
    heading(f, '放大镜：视角的游戏');
  },
});
registerViz(magnifier);

/** P91 光圈与快门。 */
const cameraAperture = defineViz({
  slug: 'camera-aperture', title: '光圈与快门', animated: true,
  params: {
    fnum: { type: 'range', min: 1.4, max: 16, default: 5.6, step: 0.2, label: '光圈 f/N' },
    shutter: { type: 'select', options: ['1/1000s', '1/125s', '1/30s', '1s'], default: '1/125s', label: '快门' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const fnum = num(params, 'fnum', 5.6);
    const shutterStr = String((params as Record<string, unknown>)['shutter'] ?? '1/125s');
    const shutter = shutterStr === '1s' ? 1 : 1 / parseFloat(shutterStr.slice(1));
    const ev = Math.log2((fnum * fnum) / Math.max(shutter, 1e-6));
    clear(f);
    // 光圈叶片（孔径 ∝ 1/fnum）
    const cx = w * 0.3, cy = h / 2 + 6;
    const holeR = Math.min(64, 18 * (5.6 / fnum) * 2.4);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + f.t * 0.3;
      const inner = holeR;
      const outer = 92;
      const pts: [number, number][] = [];
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        const r = inner + (outer - inner) * t;
        pts.push([cx + Math.cos(a + t * 0.7) * r, cy + Math.sin(a + t * 0.7) * r]);
      }
      poly(f, pts, { stroke: C.cool, lw: 2, fill: 'rgba(66,153,225,0.22)' } as any);
    }
    text(f, `f/${fnum}`, cx - 24, cy + 6, { color: '#fff', font: '16px sans-serif' });
    // 快门开合（动画相位）
    const phase = (f.t * 0.5) % 1;
    const open = phase < 0.6 ? 1 : 0.1;
    const sx = w * 0.66;
    poly(f, [[sx, cy - 70], [sx + 130, cy - 70], [sx + 130, cy - 70 + 140 * open], [sx, cy - 70 + 140 * open]],
      { stroke: C.warm, lw: 2.4, fill: 'rgba(237,137,54,0.22)' } as any);
    text(f, `快门 ${shutterStr}`, sx + 22, cy - 84, { color: C.warm, font: '13px sans-serif' });
    // 曝光量表
    text(f, `曝光量 E ∝ 1/(f²)·t：当前 EV 示意 = ${ev.toFixed(1)}`, 40, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, ev > 0 ? '进光少（画面偏暗）：开大光圈或放慢快门补偿' : '进光多（画面偏亮）：收小光圈或加快快门',
      40, 66, { color: ev > 0 ? C.cool : C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '光圈每开一级进光翻倍（f/2.8→f/2），快门每慢一档进光也翻倍——曝光三角互换',
      '小光圈换景深、慢快门拖出车轨流水——创意摄影本质是在三个变量间做交换',
      '极限处有约束：光圈太小衍射变糊，快门太慢手抖与主体模糊——画质的边界',
    ]);
    heading(f, '光圈与快门：进光的两个阀门');
  },
});
registerViz(cameraAperture);
