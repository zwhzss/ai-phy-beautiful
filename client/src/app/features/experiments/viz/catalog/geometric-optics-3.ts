import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** 人眼光学模型。 */
const eyeOptics = defineViz({
  slug: 'eye-optics', title: '人眼与调焦', animated: true,
  params: {
    objD: { type: 'range', min: 0.15, max: 6, default: 1, step: 0.05, label: '物距 (m)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const d = num(params, 'objD', 1);
    const isMyopia = d > 2.4; // 远物吃力（示意近视不调）
    clear(f);
    // 眼球
    const cx = w * 0.66, cy = h / 2 + 6;
    const R = Math.min(w, h) * 0.24;
    f.ctx.beginPath(); f.ctx.arc(cx, cy, R, 0, Math.PI * 2);
    f.ctx.fillStyle = 'rgba(148,163,184,0.14)'; f.ctx.fill();
    f.ctx.strokeStyle = C.dim; f.ctx.lineWidth = 2.6; f.ctx.stroke();
    // 角膜与晶状体
    f.ctx.beginPath();
    f.ctx.ellipse(cx - R * 0.82, cy, 16, R * 0.5, 0, 0, Math.PI * 2);
    f.ctx.fillStyle = 'rgba(120,210,255,0.4)'; f.ctx.fill();
    f.ctx.strokeStyle = C.cool; f.ctx.lineWidth = 2; f.ctx.stroke();
    const bulge = Math.min(1, 0.4 + 0.6 / d); // 近物更凸
    f.ctx.beginPath();
    f.ctx.ellipse(cx - R * 0.5, cy, 12 * bulge, R * 0.36, 0, 0, Math.PI * 2);
    f.ctx.fillStyle = 'rgba(66,153,225,0.55)'; f.ctx.fill();
    f.ctx.strokeStyle = C.cool; f.ctx.lineWidth = 2; f.ctx.stroke();
    // 视网膜与像
    dot(f, cx + R - 6, cy, 4, C.warm);
    // 光线
    const objX = cx - R - d * 90;
    seg(f, objX, cy - 40, cx - R * 0.86, cy - 20, C.warm, 2);
    seg(f, cx - R * 0.86, cy - 20, cx + R - 6, cy + 4, `${C.cool}cc`, 1.8);
    seg(f, objX, cy + 40, cx - R * 0.86, cy + 20, C.warm, 2);
    seg(f, cx - R * 0.86, cy + 20, cx + R - 6, cy - 4, `${C.cool}cc`, 1.8);
    seg(f, objX, cy - 40, objX, cy + 40, C.hot, 3);
    text(f, '物', objX - 14, cy + 4, { color: C.hot, font: '13px sans-serif' });
    // 近点提示
    text(f, `物距 ${d.toFixed(2)}m：晶状体屈光度 ${(1 / 0.017 + 1 / d).toFixed(0)}D（调节负荷）`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, isMyopia ? '看远物——睫状肌放松，晶状体变扁' : '看近物——睫状肌收缩，晶状体变凸（调焦）', 30, 66, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '人眼通过改变晶状体曲率调焦（调焦不是移动底片）——近点随年龄外移即老花',
      '近视=眼轴过长：远处像落在视网膜前；凹透镜发散矫正——全球半数年轻人的光学问题',
      '简化眼模型：等效焦距约 17mm、光圈 f/2~f/8——一张与相机同构的工程图',
    ]);
    heading(f, '人眼光学：可变焦的生物镜头');
  },
});
registerViz(eyeOptics);

/** 透镜制作者公式。 */
const lensmaker = defineViz({
  slug: 'lensmaker', title: '透镜制作者公式',
  params: {
    R1: { type: 'range', min: 30, max: 200, default: 80, step: 5, label: '前表面曲率半径 R₁' },
    nGlass: { type: 'range', min: 1.4, max: 2.1, default: 1.62, step: 0.02, label: '玻璃折射率 n' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const R1 = num(params, 'R1', 80), n = num(params, 'nGlass', 1.62);
    const R2 = -R1 * 1.15; // 双凸（凹面朝右为负）
    const ff = 1 / ((n - 1) * (1 / R1 - 1 / R2)); // 焦距（单位一致时）
    const fpx = Math.min(Math.max(ff, 40), 400);
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    const halfH = Math.min(h * 0.3, 130);
    // 透镜轮廓（双凸）
    const lens: [number, number][] = [];
    for (let i = -40; i <= 40; i++) {
      const y = (i / 40) * halfH;
      const bow = (y * y) / (4 * R1) * 1.4;
      lens.push([cx - 26 - bow + 52, y]);
    }
    const back: [number, number][] = [];
    for (let i = 40; i >= -40; i--) {
      const y = (i / 40) * halfH;
      const bow = (y * y) / (4 * R2) * -1.4;
      back.push([cx + 26 + bow - 52, y]);
    }
    poly(f, [...lens, ...back, lens[0]], { stroke: C.cool, lw: 2.4, fill: 'rgba(66,153,225,0.22)' } as any);
    // 主光轴与焦点
    seg(f, 40, cy, w - 40, cy, C.grid, 1.4);
    const fx = cx + fpx * 0.42;
    dot(f, fx, cy, 5, C.warm);
    text(f, `F（f≈${ff.toFixed(0)} 单位）`, fx - 20, cy + 20, { color: C.warm, font: '12px sans-serif' });
    // 平行光聚焦
    for (const off of [-34, 0, 34]) {
      seg(f, 50, cy + off, cx - 34, cy + off, C.cool, 1.6);
      seg(f, cx + 34, cy + off, fx, cy, C.cool, 1.6);
    }
    text(f, `1/f = (n−1)(1/R₁ − 1/R₂)：n=${n}、R₁=${R1}——磨玻璃之前先算数`, 30, 44, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '透镜制作者公式把焦距拆成材料（n）与形状（R）两项——光学设计的第一课',
      '薄透镜近似（厚度≪曲率半径）之外要加厚度修正——高精度镜头用主面/节点描述',
      '折射率色散使焦距随波长变——消色差双胶合透镜用两种玻璃把两色焦点对齐',
    ]);
    heading(f, '透镜制作者公式：材料+形状=焦距');
  },
});
registerViz(lensmaker);

/** 厚透镜与主面。 */
const thickLens = defineViz({
  slug: 'thick-lens', title: '厚透镜与主面', animated: true,
  params: {
    t: { type: 'range', min: 2, max: 30, default: 12, step: 1, label: '透镜厚度 (mm)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const th = num(params, 't', 12);
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    const halfH = Math.min(h * 0.28, 120);
    // 透镜实体
    const lensW = th * 3.4;
    poly(f, [[cx - lensW / 2, cy - halfH], [cx + lensW / 2, cy - halfH], [cx + lensW / 2, cy + halfH], [cx - lensW / 2, cy + halfH]],
      { stroke: C.cool, lw: 2.4, fill: 'rgba(66,153,225,0.20)' } as any);
    // 主面 H/H'（厚于透镜面的等效面）
    const hp = 14 + th * 0.8;
    seg(f, cx - hp, cy - halfH - 24, cx - hp, cy + halfH + 24, C.warm, 2.4);
    seg(f, cx + hp, cy - halfH - 24, cx + hp, cy + halfH + 24, C.hot, 2.4);
    text(f, 'H（前主面）', cx - hp - 76, cy - halfH - 32, { color: C.warm, font: '11px sans-serif' });
    text(f, "H'（后主面）", cx + hp - 46, cy - halfH - 32, { color: C.hot, font: '11px sans-serif' });
    // 节点
    dot(f, cx - hp, cy, 5, C.warm); dot(f, cx + hp, cy, 5, C.hot);
    // 物像（相对主面量）
    seg(f, cx - halfH * 2.2, cy - 44, cx - halfH * 2.2, cy, C.dim, 3);
    text(f, '物', cx - halfH * 2.2 - 12, cy + 16, { color: C.dim, font: '11px sans-serif' });
    seg(f, cx - halfH * 2.2, cy, cx - hp, cy - 26, C.cool, 1.5);
    seg(f, cx + hp, cy - 26, cx + halfH * 1.6, cy + 34, C.cool, 1.5);
    seg(f, cx + halfH * 1.6, cy + 34, cx + halfH * 1.6, cy, C.green, 3);
    text(f, '像', cx + halfH * 1.6 - 10, cy + 54, { color: C.green, font: '11px sans-serif' });
    text(f, `厚 ${th}mm：一切物像距离从主面量起——单透镜公式在厚透镜中复活`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '节点性质：过前节点的入射光线从后节点平行射出（角放大率=1）', 30, h - 34, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '厚透镜用四点（两主面两节点）+焦距完整描述——高斯光学的通用模型',
      "摄影镜头的'焦平面'实际是后主面后的等效焦点——法兰距的设计依据",
      '变焦镜头的主面会随焦距组移动——光学设计中最精巧的主面管理',
    ]);
    heading(f, '厚透镜：主面替代镜面');
  },
});
registerViz(thickLens);

/** 像差。 */
const opticalAberration = defineViz({
  slug: 'optical-aberration', title: '像差与校正', animated: true,
  params: {
    kind: { type: 'select', options: ['球差', '色差', '场曲'], default: '球差', label: '像差' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = String((params as Record<string, unknown>)['kind'] ?? '球差');
    clear(f);
    const cx = w * 0.4, cy = h / 2 + 6;
    // 透镜
    const lensH = Math.min(h * 0.3, 120);
    f.ctx.beginPath();
    f.ctx.ellipse(cx, cy, 18, lensH, 0, 0, Math.PI * 2);
    f.ctx.fillStyle = 'rgba(66,153,225,0.3)'; f.ctx.fill();
    f.ctx.strokeStyle = C.cool; f.ctx.lineWidth = 2.4; f.ctx.stroke();
    seg(f, 40, cy, w - 40, cy, C.grid, 1.3);
    const imgX = cx + Math.min(w * 0.34, 240);
    if (mode === '球差') {
      // 边缘光线聚焦更近
      for (const off of [-lensH + 16, -lensH * 0.5, 0, lensH * 0.5, lensH - 16]) {
        const focusX = imgX - Math.abs(off) / lensH * 54;
        seg(f, 50, cy + off * 0.4, cx - 18, cy + off, C.warm, 1.5);
        seg(f, cx + 18, cy + off, focusX, cy, C.cool, 1.5);
      }
      text(f, '边缘光线比近轴光线聚焦更近——弥散斑', imgX - 96, cy - 74, { color: C.hot, font: '12px sans-serif' });
    } else if (mode === '色差') {
      // 红蓝焦点分离
      for (const [col, shift] of [['#ff6b6b', -46], ['#9254de', 0], ['#4a90d9', 44]] as [string, number][]) {
        for (const off of [-lensH + 20, lensH - 20]) {
          seg(f, 50, cy + off * 0.3, cx - 18, cy + off, col, 1.5);
          seg(f, cx + 18, cy + off, imgX + shift, cy, col, 1.5);
        }
        dot(f, imgX + shift, cy, 5, col);
      }
      text(f, '红光焦长、蓝光焦短——色差随色散展开', imgX - 120, cy - 74, { color: C.warm, font: '12px sans-serif' });
    } else {
      // 场曲（像面弯曲）
      const curve: [number, number][] = [];
      for (let i = -6; i <= 6; i++) {
        curve.push([imgX - Math.abs(i) * 4, cy + i * 34]);
      }
      poly(f, curve, { stroke: C.warm, lw: 3 });
      seg(f, imgX + 40, cy - lensH * 0.9, imgX + 40, cy + lensH * 0.9, `${C.green}aa`, 2);
      text(f, '平场探测器 vs 弯曲像面——边缘失焦', imgX + 50, cy - 60, { color: C.green, font: '12px sans-serif' });
    }
    const pulse = 0.7 + 0.3 * Math.sin(f.t * 3);
    dot(f, imgX, cy, 7, `rgba(255,255,255,${pulse})`);
    text(f, mode === '球差' ? '球差：孔径越大越严重（∝h³）——非球面镜片的主战场' :
      mode === '色差' ? '色差：玻璃色散所致——消色差胶合与 ED 玻璃的使命' :
        '场曲：像面天生弯曲——平场设计与传感器匹配的拉锯', 30, 44, { color: C.cyan, font: '13px sans-serif' });

    footnotes(f, [
      '五种赛德尔像差（球差、彗差、像散、场曲、畸变）构成经典像差理论',
      '现实镜头是十几片镜片的妥协艺术：每种玻璃、每个曲面都在偿还某一种像差',
      '衍射极限之上再谈像差：好镜头先到衍射极限，才轮到传感器像素说话',
    ]);
    heading(f, '像差：完美聚焦的敌人');
  },
});
registerViz(opticalAberration);
