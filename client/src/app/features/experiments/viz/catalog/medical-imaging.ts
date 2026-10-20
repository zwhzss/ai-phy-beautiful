import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, circle, curve, dot, footnotes, grid, heading, poly, seg, text, view, rng, vec } from '../canvas';

/** X 射线衰减成像。 */
const xrayAttenuation = defineViz({
  slug: 'xray-attenuation', title: 'X 射线衰减成像', animated: true,
  params: { kv: { type: 'range', min: 40, max: 140, default: 80, step: 10, label: '管电压 (kV)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kv = num(params, 'kv', 80);
    clear(f);
    // 衰减示意：三段组织（肺/软组织/骨）
    const x0 = 70, segW = (w - 200) / 3;
    const tiss: [string, number, string][] = [
      ['肺（低密度）', 0.25, 'rgba(66,153,225,0.5)'],
      ['软组织', 0.6, 'rgba(146,84,222,0.5)'],
      ['骨（高密度）', 1.5, 'rgba(236,201,75,0.7)'],
    ];
    tiss.forEach(([name, mu, color], i) => {
      const x = x0 + i * segW;
      poly(f, [[x, h * 0.3], [x + segW, h * 0.3], [x + segW, h * 0.62], [x, h * 0.62]],
        { stroke: `${C.grid}aa`, lw: 1.4, fill: color });
      text(f, name, x + 14, h * 0.3 + 26, { color: '#fff', font: '12px sans-serif' });
      // 衰减后的光子数（点密度随 μ 与 kv 变化）
      const keep = Math.exp(-mu * 2.4 * (80 / kv));
      const rand = rng(30 + i);
      const nDots = Math.round(keep * 60);
      for (let k = 0; k < nDots; k++) dot(f, x + 8 + rand() * (segW - 16), h * 0.66 + rand() * (h * 0.18), 2.6, `rgba(236,201,75,${0.5 + rand() * 0.5})`);
      text(f, `I/I₀ = e^(−μx) ≈ ${(keep * 100).toFixed(0)}%`, x + 6, h * 0.62 + 24, { color: C.dim, font: '10px sans-serif' });
    });
    // 入射光子
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 4);
    for (let k = 0; k < 6; k++) {
      const y = h * 0.32 + k * ((h * 0.28) / 6);
      seg(f, 34, y, x0 - 4, y, `rgba(245,101,101,${0.5 + pulse * 0.5})`, 2.4);
    }
    text(f, '入射 X 线（均匀）', 34, h * 0.28, { color: C.hot, font: '11px sans-serif' });
    text(f, `${kv} kV：电压越高越穿透——对比度下降但剂量减少`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 穿透率对比条
    const by = h - 116;
    tiss.forEach(([, mu], i) => {
      const keep = Math.exp(-mu * 2.4 * (80 / kv));
      const x = x0 + i * segW;
      poly(f, [[x, by], [x + (segW - 20) * keep, by], [x + (segW - 20) * keep, by + 22], [x, by + 22]],
        { stroke: 'transparent', fill: 'rgba(72,187,120,0.7)' });
      text(f, `${(keep * 100).toFixed(0)}%`, x + 4, by + 38, { color: C.green, font: '11px sans-serif' });
    });
    text(f, '穿透率（越低在片上越白）——密度差就是灰度差', x0, by - 8, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '光电吸收与康普顿散射共同决定 μ——原子序数高的组织更"吸光"',
      '滤过与准直把无用软射线挡掉——患者剂量的第一道节约',
      '栅格拦住散射线，代价是略增剂量——对比度与剂量的日常取舍',
    ]);
    heading(f, 'X 射线衰减：明暗差的物理');
  },
});
registerViz(xrayAttenuation);

/** CT 反投影重建。 */
const ctReconstruction = defineViz({
  slug: 'ct-reconstruction', title: 'CT 反投影重建', animated: true,
  params: { angles: { type: 'range', min: 5, max: 180, default: 60, step: 5, label: '投影角度数' } },
  draw: (f) => {
    const { w, h, params } = f;
    const nA = num(params, 'angles', 60);
    clear(f);
    const cx = w * 0.32, cy = h * 0.48, R = Math.min(w * 0.2, h * 0.3);
    // 待重建体模（两块高密度）
    circle(f, cx, cy, R, { stroke: `${C.dim}aa`, lw: 2, fill: 'rgba(100,116,139,0.2)' });
    circle(f, cx - R * 0.35, cy - R * 0.2, R * 0.3, { fill: 'rgba(236,201,75,0.85)' });
    circle(f, cx + R * 0.4, cy + R * 0.3, R * 0.22, { fill: 'rgba(66,153,225,0.85)' });
    text(f, '体模（真实结构）', cx - 56, cy + R + 26, { color: C.dim, font: '11px sans-serif' });
    // 旋转的投影（动画）
    const angle = (f.t * 0.7) % (Math.PI * 2);
    const px = w * 0.66, py = h * 0.4;
    // 探测器条
    const dcos = Math.cos(angle), dsin = Math.sin(angle);
    const dx = cx + dcos * (R + 70), dy = cy + dsin * (R + 70);
    seg(f, dx - dsin * 90, dy + dcos * 90, dx + dsin * 90, dy - dcos * 90, C.cool, 4);
    text(f, '探测器', dx - dsin * 96 - 30, dy + dcos * 96 + 14, { color: C.cool, font: '10px sans-serif' });
    // 射线扇
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 6);
    for (let k = -3; k <= 3; k++) {
      const ox = cx - dcos * (R + 120) - dsin * k * 34;
      const oy = cy - dsin * (R + 120) + dcos * k * 34;
      seg(f, ox, oy, dx - dsin * k * 26, dy + dcos * k * 26, `rgba(245,101,101,${0.4 + pulse * 0.4})`, 1.6);
    }
    // 反投影条带（累积重建）
    const rand = rng(9);
    for (let a = 0; a < nA; a++) {
      const th = (a / nA) * Math.PI;
      const alpha = 0.05 + 0.03 * Math.sin(f.t * 3 + a);
      const nx = Math.cos(th), ny = Math.sin(th);
      poly(f, [[cx - ny * R * 1.4, cy + nx * R * 1.4], [cx + ny * R * 1.4, cy - nx * R * 1.4],
        [cx + ny * R * 1.4 + nx * 6, cy - nx * R * 1.4 + ny * 6], [cx - ny * R * 1.4 + nx * 6, cy + nx * R * 1.4 + ny * 6]],
        { stroke: 'transparent', fill: `rgba(102,126,234,${alpha})` });
      void rand;
    }
    text(f, '每条反投影把该角度的值抹回整幅图', cx - 116, cy - R - 40, { color: '#667eea', font: '11px sans-serif' });
    // 滤波对比（右侧）
    const v = view(f, { xMin: 0, xMax: 1, yMin: 0, yMax: 1.2, inset: 46, insetBottom: 96 });
    const prof: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      const raw = Math.exp(-Math.pow((t - 0.4) * 6, 2)) + Math.exp(-Math.pow((t - 0.7) * 7, 2)) * 0.6 + 0.25;
      const filt = Math.max(0, raw - 0.25 - 0.06 * Math.sin(t * 40));
      prof.push([v.sx(t), v.sy(filt)]);
    }
    poly(f, prof, { stroke: C.green, lw: 3 });
    text(f, '滤波后：边缘锐利、晕圈消除', v.sx(0.05), v.sy(1.14), { color: C.green, font: '11px sans-serif' });
    text(f, `${nA} 个角度：采样不足则出现星状条纹伪影`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '中心切片定理：一维投影 = 图像傅里叶空间的一条直径', 30, h - 96, { color: C.warm, font: '13px sans-serif' });
    footnotes(f, [
      '反投影直接叠加会糊——先滤波再反投影才是清晰重建的诀窍',
      'CT 值以 HU 标定：水 0、空气 −1000、致密骨 +1000 以上',
      '1971 年第一台临床 CT 让断层解剖无创可见——1979 年诺贝尔奖',
    ]);
    heading(f, 'CT 重建：投影反推断层');
  },
});
registerViz(ctReconstruction);

/** MRI 与 k 空间。 */
const mriKSpace = defineViz({
  slug: 'mri-k-space', title: 'MRI 与 k 空间', animated: true,
  params: { fill: { type: 'range', min: 5, max: 100, default: 55, step: 5, label: 'k 空间填充 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const fill = num(params, 'fill', 55);
    clear(f);
    // 左：k 空间（螺旋填充）
    const kx = w * 0.26, ky = h * 0.48, kR = Math.min(w * 0.18, h * 0.28);
    circle(f, kx, ky, kR, { stroke: `${C.grid}cc`, lw: 1.6 });
    seg(f, kx - kR, ky, kx + kR, ky, `${C.grid}88`, 1);
    seg(f, kx, ky - kR, kx, ky + kR, `${C.grid}88`, 1);
    const nDots = Math.round((fill / 100) * 420);
    const rand = rng(5);
    for (let i = 0; i < nDots; i++) {
      const t = i / 420;
      const a = t * Math.PI * 14;
      const r = Math.sqrt(t) * kR * 0.96;
      const jitter = (rand() - 0.5) * 6;
      const glow = 0.5 + 0.5 * Math.sin(f.t * 3 + i * 0.3);
      dot(f, kx + Math.cos(a) * r + jitter, ky + Math.sin(a) * r + jitter, 2.4, `rgba(102,126,234,${0.35 + glow * 0.55})`);
    }
    text(f, 'k 空间（中心=低频对比，边缘=细节）', kx - 116, ky - kR - 16, { color: '#667eea', font: '11px sans-serif' });
    // 右：重建图像（随填充度变清晰）
    const ix = w * 0.7, iy = h * 0.48, iR = Math.min(w * 0.17, h * 0.26);
    circle(f, ix, iy, iR, { stroke: C.cool, lw: 2.4, fill: 'rgba(26,32,44,0.9)' });
    const sharp = fill / 100;
    // 脑部结构示意（填充越多细节越多）
    circle(f, ix, iy, iR * 0.86, { stroke: `rgba(66,153,225,${0.4 + sharp * 0.5})`, lw: 3 });
    circle(f, ix, iy - iR * 0.1, iR * 0.5, { stroke: `rgba(146,84,222,${0.35 + sharp * 0.55})`, lw: 2.6 });
    if (fill > 40) {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + 0.3;
        const pts: [number, number][] = [];
        for (let i = 0; i <= 16; i++) {
          const t = i / 16;
          pts.push([ix + Math.cos(a + t * 0.5) * iR * (0.55 + t * 0.3), iy + Math.sin(a + t * 0.5) * iR * (0.55 + t * 0.3)]);
        }
        poly(f, pts, { stroke: `rgba(72,187,120,${0.25 + sharp * 0.5})`, lw: 2 });
      }
    }
    if (fill > 75) text(f, '沟回细节浮现（高频到位）', ix - 74, iy + iR + 24, { color: C.green, font: '11px sans-serif' });
    else text(f, '只剩对比轮廓（缺高频）', ix - 68, iy + iR + 24, { color: C.warm, font: '11px sans-serif' });
    // 傅里叶箭头
    vec(f, kx + kR + 24, ky, ix - iR - 24, iy, C.warm, 3);
    text(f, '2D FT', (kx + kR + ix - iR) / 2 - 22, ky - 16, { color: C.warm, font: '12px sans-serif' });
    text(f, `${fill}% 填充：k 空间中心决定对比，边缘决定锐度——少扫边缘只损失细节`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, 'ω₀ = γB₀：氢核进动频率 42.58 MHz/T——射频脉冲只激发它', 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '梯度场把位置编码成频率与相位——k 空间就是采到的原始数据',
      '无电离辐射、任意方向断层——软组织对比是它的杀手锏',
      '快速采样与并行线圈把扫描压到几分钟——2003 年诺贝尔奖的技术线',
    ]);
    heading(f, 'MRI：填满 k 空间即成像');
  },
});
registerViz(mriKSpace);

/** 功能磁共振成像 fMRI。 */
const fmriBold = defineViz({
  slug: 'fmri-bold', title: '功能磁共振成像 fMRI', animated: true,
  params: { stim: { type: 'range', min: 0, max: 100, default: 60, step: 5, label: '刺激强度 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const stim = num(params, 'stim', 60);
    clear(f);
    // 左：脑切面 + 激活点亮
    const bx = w * 0.28, by = h * 0.46, R = Math.min(w * 0.19, h * 0.28);
    circle(f, bx, by, R, { stroke: C.cool, lw: 3, fill: 'rgba(66,153,225,0.14)' });
    circle(f, bx, by - R * 0.14, R * 0.58, { stroke: `${C.dim}aa`, lw: 2 });
    // 激活簇（随刺激脉动）
    const active = Math.sin(f.t * 0.9) > -0.2;
    const rand = rng(31);
    const n = Math.round(stim / 6);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * R * 0.72;
      const x = bx + Math.cos(a) * r, y = by + Math.sin(a) * r;
      const glow = active ? 0.5 + 0.5 * Math.sin(f.t * 4 + i) : 0.2;
      dot(f, x, y, 5.4, `rgba(245,101,101,${glow})`);
    }
    text(f, 'BOLD 激活簇（血氧变化区）', bx - 92, by - R - 16, { color: C.hot, font: '11px sans-serif' });
    text(f, '刺激 → 神经活动 → 血流超量补充 → 去氧血红蛋白稀释 → 信号变亮', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 右：血流响应曲线
    const v = view(f, { xMin: 0, xMax: 14, yMin: -0.3, yMax: 1.3, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 7, ticks: true });
    // 刺激方波
    const on1 = (f.t * 0.5) % 1 > 0.15 && (f.t * 0.5) % 1 < 0.65;
    const square: [number, number][] = [];
    for (let i = 0; i <= 400; i++) {
      const t = (i / 400) * 14;
      const p = (t + f.t * 0.7) % 7;
      square.push([v.sx(t), v.sy(p > 1 && p < 4 ? 1.12 : -0.16)]);
    }
    poly(f, square, { stroke: `${C.dim}aa`, lw: 1.8, dash: [5, 4] });
    // BOLD 响应（滞后 + 过冲）
    const bold: [number, number][] = [];
    for (let i = 0; i <= 400; i++) {
      const t = (i / 400) * 14;
      const p = ((t - 1.2) + f.t * 0.7) % 7;
      let y = 0;
      if (p > 0 && p < 3.4) {
        const rise = Math.min(1, p / 1.4);
        const fall = p > 2.6 ? Math.max(0, 1 - (p - 2.6) / 1.6) : 1;
        y = rise * fall * (stim / 100) * 1.0;
        if (p > 3 && p < 4.2) y = -0.1 * (stim / 100); // 血氧过冲
      }
      bold.push([v.sx(t), v.sy(y)]);
    }
    poly(f, bold, { stroke: C.hot, lw: 3.4 });
    void on1;
    text(f, '灰虚线=刺激；红线=BOLD 响应（滞后 4-6 秒）', 56, 44, { color: C.warm, font: '12px sans-serif' });
    text(f, '时间 →（s）', w - 110, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, `刺激 ${stim}%：${stim < 30 ? '信号淹没在噪声里——统计功效不足' : '响应清晰可检——但只是神经活动的间接影子'}`,
      30, h - 96, { color: stim < 30 ? C.warm : C.cyan, font: '13px sans-serif' });
    footnotes(f, [
      'BOLD 测的是血氧不是神经元——血流响应的滞后是它的固有代价',
      '头动是最大噪声源：配准与运动校正是每篇 fMRI 论文的必修',
      '静息态网络、术前定位与脑机接口——从科研走进临床的主力工具',
    ]);
    heading(f, 'fMRI：拍一张血氧的影子');
  },
});
registerViz(fmriBold);

/** PET 正电子发射断层。 */
const petImaging = defineViz({
  slug: 'pet-imaging', title: 'PET 正电子发射断层', animated: true,
  params: { tof: { type: 'select', options: ['传统符合', '飞行时间 PET'], default: '传统符合', label: '符合模式' } },
  draw: (f) => {
    const { w, h, params } = f;
    const tof = String((params as Record<string, unknown>)['tof'] ?? '').includes('飞行');
    clear(f);
    const cx = w * 0.4, cy = h * 0.5, R = Math.min(w * 0.2, h * 0.3);
    // 探测器环
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2;
      const x = cx + Math.cos(a) * (R + 46), y = cy + Math.sin(a) * (R + 46);
      circle(f, x, y, 8, { stroke: C.cool, lw: 2, fill: 'rgba(66,153,225,0.35)' });
    }
    text(f, 'BGO 探测器环', cx - 44, cy - R - 78, { color: C.cool, font: '11px sans-serif' });
    // 体模与病灶（FDG 摄取）
    circle(f, cx, cy, R, { stroke: `${C.dim}aa`, lw: 2, fill: 'rgba(100,116,139,0.22)' });
    const hot = 0.6 + 0.4 * Math.sin(f.t * 3);
    circle(f, cx + R * 0.36, cy - R * 0.24, R * 0.26, { fill: `rgba(245,101,101,${hot})` });
    text(f, '高代谢灶（FDG 富集）', cx + R * 0.42, cy - R * 0.6, { color: C.hot, font: '10px sans-serif' });
    // 湮灭事件与 180° 光子对
    const ev = ((f.t * 0.7) % 1);
    const ex = cx + R * 0.36, ey = cy - R * 0.24;
    const burst = ev < 0.4;
    if (burst) {
      const r = ev / 0.4;
      for (const a of [0, Math.PI]) {
        const px = ex + Math.cos(a + 0.12) * r * (R + 40), py = ey + Math.sin(a + 0.12) * r * (R + 40);
        dot(f, px, py, 6, `rgba(236,201,75,${1 - r * 0.6})`);
      }
      if (r > 0.85) {
        seg(f, ex, ey, cx + R + 46, cy, C.yellow, 3);
        seg(f, ex, ey, cx - R - 46, cy, C.yellow, 3);
        text(f, '511 keV ×2（近 180°）', cx - 76, ey - 14, { color: C.yellow, font: '11px sans-serif' });
      }
    }
    // 符合窗与 TOF 对比
    const bx = w * 0.7, by = h * 0.28;
    text(f, tof ? '飞行时间 PET：再用时间差缩小到一条短线' : '传统符合：两探头同时响 → 连线（整条线上都可能）',
      bx - 10, by - 10, { color: tof ? C.green : C.cool, font: '12px sans-serif' });
    const lineA: [number, number] = [bx + 30, by + 60], lineB: [number, number] = [bx + 230, by + 140];
    seg(f, lineA[0], lineA[1], lineB[0], lineB[1], `${C.cool}99`, 2.4);
    if (tof) {
      const mx = (lineA[0] + lineB[0]) / 2 + 30, my = (lineA[1] + lineB[1]) / 2 + 30;
      seg(f, mx - 26, my - 26, mx + 26, my + 26, C.green, 6);
      text(f, 'TOF 锁定段', mx + 34, my + 6, { color: C.green, font: '11px sans-serif' });
    } else {
      dot(f, (lineA[0] + lineB[0]) / 2, (lineA[1] + lineB[1]) / 2, 5, `${C.dim}cc`);
    }
    dot(f, lineA[0], lineA[1], 7, C.cool);
    dot(f, lineB[0], lineB[1], 7, C.cool);
    text(f, `${tof ? '时间分辨 400 ps → 位置误差压到 ±6 cm' : '符合线路只认同时到达——方向由连线确定'}`,
      30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '正电子先走 1-2 mm 再湮灭——这个程差是 PET 分辨率的物理下限', 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      'FDG 是葡萄糖类似物——高代谢细胞"吃糖"多于是亮得早',
      'F-18 半衰期 110 分钟：够检查、少挨辐射——核素选择的黄金参数',
      'PET/CT、PET/MR 融合让代谢与解剖一次对齐——肿瘤分期的利器',
    ]);
    heading(f, 'PET：湮灭光子对的符合游戏');
  },
});
registerViz(petImaging);

/** SPECT 单光子成像。 */
const spectImaging = defineViz({
  slug: 'spect-imaging', title: 'SPECT 单光子成像', animated: true,
  params: { holes: { type: 'range', min: 1, max: 60, default: 24, step: 3, label: '准直器孔数' } },
  draw: (f) => {
    const { w, h, params } = f;
    const holes = num(params, 'holes', 24);
    clear(f);
    const cx = w * 0.34, cy = h * 0.5, R = Math.min(w * 0.17, h * 0.26);
    // 体模与放射源
    circle(f, cx, cy, R, { stroke: `${C.dim}aa`, lw: 2, fill: 'rgba(100,116,139,0.22)' });
    const hot = 0.55 + 0.45 * Math.sin(f.t * 3);
    circle(f, cx - R * 0.3, cy + R * 0.2, R * 0.3, { fill: `rgba(237,137,54,${hot})` });
    text(f, 'Tc-99m 示踪灶', cx - R * 0.6, cy + R * 0.72, { color: C.warm, font: '10px sans-serif' });
    // 准直器（铅孔板）
    const colX = cx + R + 60;
    const colH = 200;
    seg(f, colX, cy - colH / 2, colX, cy + colH / 2, C.dim, 6);
    for (let k = 0; k < holes; k++) {
      const y = cy - colH / 2 + (k + 0.5) * (colH / holes);
      seg(f, colX, y - 1, colX, y + 1, C.bg, 4);
    }
    text(f, `准直器（${holes} 孔）`, colX - 46, cy - colH / 2 - 14, { color: C.dim, font: '11px sans-serif' });
    // 光子：只有平行准直方向的通过
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 5);
    const srcY = cy + R * 0.2;
    seg(f, cx - R * 0.3, srcY, colX, srcY, `rgba(236,201,75,${0.5 + pulse * 0.5})`, 2.6);
    seg(f, colX, srcY, colX + 150, srcY, `rgba(72,187,120,${0.5 + pulse * 0.5})`, 3);
    dot(f, colX + 156, srcY, 7, C.green);
    // 被挡住的斜射光子
    seg(f, cx - R * 0.3, srcY, colX, cy - 60, `rgba(245,101,101,${0.4 + pulse * 0.3})`, 1.8, );
    text(f, '斜射光子被铅壁吸收', colX - 76, cy - 74, { color: C.hot, font: '10px sans-serif' });
    // 探头（旋转）
    const rot = f.t * 0.5;
    const dx = cx + Math.cos(rot) * (R + 150), dy = cy + Math.sin(rot) * (R + 150);
    circle(f, dx, dy, 26, { stroke: C.cool, lw: 3, fill: 'rgba(66,153,225,0.3)' });
    text(f, '探头（绕体旋转采投影）', dx - 84, dy + 44, { color: C.cool, font: '10px sans-serif' });
    // 说明
    text(f, '准直器用空间换方向：挡掉绝大多数光子，只留一条直线的信使', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, `孔越多灵敏度越高、分辨率越差——当前 ${holes} 孔的折中`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      'SPECT 不测能量只数方向——准直牺牲计数率换来空间定位',
      'Tc-99m 140 keV 光子穿透力适中、剂量低——占核医学检查八成',
      '设备比 PET 便宜、示踪剂随用随取——基层医院的心肌灌注主力',
    ]);
    heading(f, 'SPECT：铅筛子选出来的方向');
  },
});
registerViz(spectImaging);

/** 超声回波成像。 */
const ultrasoundEcho = defineViz({
  slug: 'ultrasound-echo', title: '超声回波成像', animated: true,
  params: { depth: { type: 'range', min: 2, max: 20, default: 10, step: 1, label: '成像深度 (cm)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const depth = num(params, 'depth', 10);
    clear(f);
    const px = w * 0.3, topY = 74;
    // 探头
    poly(f, [[px - 60, topY - 40], [px + 60, topY - 40], [px + 50, topY], [px - 50, topY]],
      { stroke: C.cool, lw: 3, fill: 'rgba(66,153,225,0.35)' });
    text(f, '压电探头', px - 30, topY - 52, { color: C.cool, font: '11px sans-serif' });
    // 扇形声束
    const openA = 0.5;
    for (let k = -6; k <= 6; k++) {
      const a = k * (openA / 6);
      const len = (h - 200) * (depth / 20 + 0.4);
      seg(f, px, topY, px + Math.sin(a) * len, topY + Math.cos(a) * len, `rgba(56,178,172,${0.16 + 0.06 * Math.abs(k)})`, 1.6);
    }
    // 界面回波（深度处的层）
    const layers: [number, string][] = [
      [0.22, '皮肤/皮下'],
      [0.5, '器官包膜（强反射）'],
      [0.78, '深部界面'],
    ];
    layers.forEach(([t, name], i) => {
      const y = topY + t * (h - 240) * (depth / 20 + 0.5);
      if (y < h - 110) {
        const glow = 0.5 + 0.5 * Math.sin(f.t * 4 - i * 1.2);
        seg(f, px - 130 * (0.4 + t), y, px + 130 * (0.4 + t), y, `rgba(236,201,75,${glow})`, 4);
        text(f, name, px + 140 * (0.4 + t), y + 4, { color: C.warm, font: '10px sans-serif' });
        // 回波脉冲返回
        const back = ((f.t * 2 + i * 0.3) % 1);
        if (back < 0.5) {
          const yy = y - (y - topY) * (back / 0.5);
          dot(f, px, yy, 6, `rgba(72,187,120,${0.9 - back})`);
        }
      }
    });
    text(f, `回波时延 → 深度：d = c·t/2（c≈1540 m/s）`, 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // A 超波形（右侧）
    const v = view(f, { xMin: 0, xMax: 1, yMin: 0, yMax: 1.15, inset: 46, insetBottom: 96 });
    const amp: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const t = i / 300;
      let y = 0.04 + Math.abs(Math.sin(t * 60 + f.t * 4)) * 0.03;
      for (const [lt] of layers) y += Math.exp(-Math.pow((t - lt) * 60, 2)) * (0.9 - lt * 0.4);
      amp.push([v.sx(t), v.sy(Math.min(1.1, y))]);
    }
    poly(f, amp, { stroke: C.green, lw: 2.4 });
    text(f, 'A 超回波包络（深度-幅度）', v.sx(0.04), v.sy(1.1), { color: C.green, font: '11px sans-serif' });
    text(f, `当前深度设定 ${depth} cm：声阻抗差越大回波越强`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '空气是超声的大敌——耦合剂排掉探头与皮肤之间的气泡',
      '从 A 超到 B 超再到全数字彩超：探头阵列与波束成形越看越清',
      '无辐射、可实时——产科与急诊首选，胎儿心跳当场听见',
    ]);
    heading(f, '超声回波：边喊边听的深度尺');
  },
});
registerViz(ultrasoundEcho);

/** 多普勒超声。 */
const dopplerUltrasound = defineViz({
  slug: 'doppler-ultrasound', title: '多普勒超声', animated: true,
  params: { theta: { type: 'range', min: 0, max: 90, default: 60, step: 5, label: '声束-血流夹角 (°)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const th = num(params, 'theta', 60);
    clear(f);
    // 血管与血流
    const vy = h * 0.5;
    poly(f, [[50, vy - 40], [w - 50, vy - 40], [w - 50, vy + 40], [50, vy + 40]],
      { stroke: C.hot, lw: 2.4, fill: 'rgba(245,101,101,0.14)' });
    text(f, '血管', 56, vy - 50, { color: C.hot, font: '11px sans-serif' });
    // 血细胞（动画流动）
    const rand = rng(3);
    for (let i = 0; i < 16; i++) {
      const x = 60 + ((rand() * 900 + f.t * 120) % (w - 120));
      const y = vy - 26 + rand() * 52;
      dot(f, x, y, 5.4, `rgba(236,201,75,${0.5 + rand() * 0.4})`);
    }
    // 探头与声束
    const tx = w * 0.24, ty = h * 0.2;
    poly(f, [[tx - 50, ty - 34], [tx + 50, ty - 34], [tx + 42, ty], [tx - 42, ty]],
      { stroke: C.cool, lw: 3, fill: 'rgba(66,153,225,0.35)' });
    const rad = (th * Math.PI) / 180;
    const beamLen = (h * 0.32) / Math.max(0.2, Math.cos(rad));
    const hx = tx + Math.sin(rad) * beamLen, hy = ty + Math.cos(rad) * beamLen;
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 6);
    seg(f, tx, ty, hx, hy, `rgba(56,178,172,${0.5 + pulse * 0.5})`, 3.4);
    seg(f, hx, hy, hx + 130, hy, `rgba(236,201,75,0.9)`, 3);
    dot(f, hx, hy, 7, C.green);
    // 夹角标注
    seg(f, hx, hy, hx + 90, hy, `${C.dim}aa`, 1.4, );
    const arc: [number, number][] = [];
    for (let i = 0; i <= 20; i++) {
      const a = -Math.PI / 2 + rad * (i / 20) + Math.PI / 2;
      arc.push([hx + Math.cos(a - Math.PI / 2 + rad) * 46, hy + Math.sin(a - Math.PI / 2 + rad) * 46]);
    }
    void arc;
    text(f, `θ=${th}°`, hx + 14, hy - 14, { color: C.warm, font: '12px sans-serif' });
    // 频移读数
    const df = Math.cos(rad) * 100;
    text(f, `Δf = 2·f₀·v·cosθ/c → 测速 ${df.toFixed(0)}%（${th === 90 ? '垂直：cos90°=0，测不到！' : '夹角越小越准'}）`,
      30, 44, { color: th === 90 ? C.hot : C.cyan, font: '13px sans-serif' });
    // 彩色血流图（下）
    const by = h - 116;
    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      const speed = 0.4 + 0.6 * Math.abs(Math.sin(t * Math.PI));
      const color = speed > 0.6 ? `rgba(245,101,101,${0.4 + speed * 0.5})` : `rgba(66,153,225,${0.4 + speed * 0.5})`;
      poly(f, [[70 + i * ((w - 150) / 40), by], [70 + (i + 1) * ((w - 150) / 40), by],
        [70 + (i + 1) * ((w - 150) / 40), by + 30], [70 + i * ((w - 150) / 40), by + 30]],
        { stroke: 'transparent', fill: color });
    }
    text(f, '彩色编码：红=朝向探头，蓝=远离——层流的抛物线速度一眼可见', 70, by + 52, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '多普勒测速必须知道夹角——超声报告上的角度校正就是它',
      '取样容积圈定测量点：狭窄处速度飙升是诊断的直接依据',
      '从连续波到彩色血流——形态学检查升级为功能检查的分水岭',
    ]);
    heading(f, '多普勒超声：给血流上色');
  },
});
registerViz(dopplerUltrasound);

/** 高强度聚焦超声 HIFU。 */
const hifu = defineViz({
  slug: 'hifu', title: '高强度聚焦超声 HIFU', animated: true,
  params: { power: { type: 'range', min: 10, max: 100, default: 65, step: 5, label: '声功率 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const power = num(params, 'power', 65);
    clear(f);
    // 阵列探头（体外）
    const ax = w * 0.24, ay = h * 0.72;
    for (let k = 0; k < 14; k++) {
      const off = (k - 6.5) * 18;
      const a = -Math.PI / 2 + off * 0.012;
      circle(f, ax + off, ay, 7, { stroke: C.cool, lw: 2, fill: 'rgba(66,153,225,0.5)' });
      void a;
    }
    text(f, '体外超声阵列', ax - 76, ay + 34, { color: C.cool, font: '11px sans-serif' });
    // 会聚声束
    const fx = w * 0.56, fy = h * 0.34;
    for (let k = -6; k <= 6; k++) {
      const sx = ax + k * 18;
      const wob = Math.sin(f.t * 8 + k) * 2;
      const mid = [(sx + fx) / 2 + wob, (ay + fy) / 2];
      poly(f, [[sx, ay], [mid[0], mid[1]], [fx, fy]],
        { stroke: `rgba(56,178,172,${0.1 + power / 500})`, lw: 1.6 });
    }
    // 焦点（热斑）
    const heat = power / 100;
    const glow = 0.5 + 0.5 * Math.sin(f.t * 5);
    circle(f, fx, fy, 22 + heat * 14, { stroke: `rgba(245,101,101,${glow})`, lw: 3, fill: `rgba(245,101,101,${0.25 + heat * 0.5})` });
    circle(f, fx, fy, 10, { fill: `rgba(255,250,200,${glow})` });
    const tempC = (40 + heat * 45).toFixed(0);
    text(f, `焦点 ${tempC}℃（>65℃ 即刻凝固）`, fx - 76, fy - 44, { color: C.hot, font: '12px sans-serif' });
    // 皮肤路径（低强度安全）
    text(f, '声路组织仅 40-45℃——能量全在焦点兑现', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // 病灶扫描（焦点移动示意）
    const lesionX = fx + 60, lesionY = fy + 60;
    circle(f, lesionX, lesionY, 34, { stroke: `${C.dim}cc`, lw: 2.4, fill: 'rgba(100,116,139,0.35)' });
    text(f, '病灶', lesionX - 16, lesionY + 5, { color: C.fg, font: '11px sans-serif' });
    // 焦点逐点扫描
    const scan = ((f.t * 0.5) % 1);
    const sx2 = lesionX - 30 + scan * 60, sy2 = lesionY - 20 + Math.sin(scan * Math.PI * 3) * 16;
    dot(f, sx2, sy2, 7, `rgba(236,201,75,${0.6 + 0.4 * glow})`);
    text(f, '焦点逐点扫描覆盖整个病灶', lesionX - 96, lesionY + 56, { color: C.warm, font: '11px sans-serif' });
    // 温度-时间示意
    const v = view(f, { xMin: 0, xMax: 6, yMin: 30, yMax: 90, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    const tp: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * 6;
      const y = 37 + (1 - Math.exp(-t * heat * 1.4)) * (80 - 37) * heat;
      tp.push([v.sx(t), v.sy(y)]);
    }
    poly(f, tp, { stroke: C.hot, lw: 3 });
    seg(f, v.sx(0), v.sy(65), v.sx(6), v.sy(65), `${C.green}99`, 1.6, );
    text(f, '65℃ 凝固阈值', v.sx(0.1), v.sy(65) - 8, { color: C.green, font: '11px sans-serif' });
    text(f, '辐照时间 →（s）', w - 130, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, `当前功率 ${power}%：${power > 80 ? '过快升温需防周围灼伤' : '焦点温升受控，路径安全'}`, 30, h - 96,
      { color: power > 80 ? C.warm : C.cyan, font: '12px sans-serif' });
    footnotes(f, [
      '声能只有在焦点被吸收转热——路径组织安然、病灶被烧蚀',
      '实时测温反馈控制每点剂量——无创手术的安全闭环',
      '子宫肌瘤、前列腺与颅内治疗——从诊断到治疗的超升',
    ]);
    heading(f, 'HIFU：体外聚焦的无创手术刀');
  },
});
registerViz(hifu);

/** 光学相干断层 OCT。 */
const octImaging = defineViz({
  slug: 'oct-imaging', title: '光学相干断层 OCT', animated: true,
  params: { bw: { type: 'range', min: 20, max: 400, default: 120, step: 20, label: '光源带宽 (nm)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const bw = num(params, 'bw', 120);
    clear(f);
    const res = 0.44 * Math.pow(0.85, 2) / (bw / 100); // 示意轴向分辨（μm 量级）
    // 干涉仪（左）
    const sx = 76, sy = h * 0.3;
    circle(f, sx, sy, 8, { fill: C.hot });
    text(f, '宽带光源', sx - 30, sy - 20, { color: C.hot, font: '11px sans-serif' });
    // 分束器
    const bsX = sx + 130, bsY = sy;
    seg(f, bsX, bsY - 30, bsX, bsY + 30, C.dim, 4);
    seg(f, bsX - 26, bsY + 26, bsX + 26, bsY - 26, `${C.yellow}cc`, 3.4);
    text(f, '分束', bsX - 20, bsY - 44, { color: C.dim, font: '10px sans-serif' });
    // 参考臂（上）
    seg(f, bsX, bsY - 30, bsX, sy - 90, C.cool, 3);
    seg(f, bsX - 40, sy - 90, bsX + 40, sy - 90, C.cool, 6);
    text(f, '参考臂（移动扫描）', bsX + 50, sy - 86, { color: C.cool, font: '11px sans-serif' });
    const mirrorY = sy - 90 + Math.sin(f.t * 3) * 16;
    seg(f, bsX - 40, mirrorY, bsX + 40, mirrorY, C.cool, 6);
    // 样品臂（右 → 眼底）
    seg(f, bsX + 30, bsY, w * 0.66, bsY, C.green, 3);
    const ex = w * 0.72, ey = sy;
    text(f, '样品臂 → 眼底', w * 0.6, sy - 26, { color: C.green, font: '11px sans-serif' });
    // 眼底分层（反射）
    for (let L = 0; L < 4; L++) {
      const y = ey + 30 + L * 26;
      const glow = 0.45 + 0.55 * Math.abs(Math.sin(f.t * 3 + L));
      seg(f, ex - 40, y, ex + 110, y, `rgba(236,201,75,${glow})`, 3.4);
    }
    text(f, '视网膜分层（不同层反射不同）', ex - 40, ey + 158, { color: C.warm, font: '10px sans-serif' });
    // 干涉条件说明
    text(f, '只有光程差 < 相干长度的回波才相干——这一条就是层选', 30, 44, { color: C.cyan, font: '13px sans-serif' });
    // A 扫描结果（下）
    const v = view(f, { xMin: 0, xMax: 1, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 96 });
    const peaks: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const t = i / 300;
      let y = 0.03;
      for (let L = 0; L < 4; L++) y += Math.exp(-Math.pow((t - (0.2 + L * 0.16)) * (90 / (res / 8)), 2)) * (0.95 - L * 0.15);
      peaks.push([v.sx(t), v.sy(Math.min(1.05, y))]);
    }
    poly(f, peaks, { stroke: C.green, lw: 2.6 });
    text(f, `轴向分辨 ≈ ${(res).toFixed(0)} μm：${bw > 200 ? '带宽越大峰越细' : '增加带宽可显著提锐'}`, 56, 44, { color: C.green, font: '12px sans-serif' });
    text(f, '深度 →（层析方向）', w - 150, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, `当前带宽 ${bw} nm——低相干干涉把毫米级组织切成微米级薄片`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      'OCT 之于眼睛如同超声之于腹部——但用的是光不是声',
      '频域 OCT 不动参考镜、一次曝光采全深度——速度跃升',
      '黄斑病变随访从猜测变成测量——眼科影像的革命（1991, MIT）',
    ]);
    heading(f, 'OCT：光的断层扫描');
  },
});
registerViz(octImaging);

/** 放射治疗与剂量。 */
const radiotherapyDose = defineViz({
  slug: 'radiotherapy-dose', title: '放射治疗与剂量', animated: true,
  params: { energy: { type: 'range', min: 4, max: 25, default: 6, step: 1, label: '射线能量 (MV)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mv = num(params, 'energy', 6);
    clear(f);
    const dmaxCm = 1.5 + mv * 0.45; // 建成深度示意
    const v = view(f, { xMin: 0, xMax: 25, yMin: 0, yMax: 1.15, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    // PDD 曲线
    const pdd: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const z = (i / 300) * 25;
      let y: number;
      if (z < dmaxCm) y = 0.3 + 0.7 * Math.sin((z / dmaxCm) * (Math.PI / 2));
      else y = Math.exp(-(z - dmaxCm) / (9 + mv * 0.9)) * (1 + (z - dmaxCm) * 0.004);
      pdd.push([v.sx(z), v.sy(Math.min(1.1, Math.max(0.03, y)))]);
    }
    poly(f, pdd, { stroke: C.accent, lw: 3.4 });
    // 建成点与峰值
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
    seg(f, v.sx(dmaxCm), v.sy(0), v.sx(dmaxCm), v.sy(1.08), `rgba(72,187,120,${pulse})`, 1.8, );
    dot(f, v.sx(dmaxCm), v.sy(1.0), 8, C.green);
    text(f, `d_max = ${dmaxCm.toFixed(1)} cm（建成区顶）`, v.sx(dmaxCm) + 10, v.sy(1.06), { color: C.green, font: '12px sans-serif' });
    // 肿瘤靶区
    const tx0 = dmaxCm + 4, tx1 = dmaxCm + 10;
    poly(f, [[v.sx(tx0), v.sy(0)], [v.sx(tx1), v.sy(0)], [v.sx(tx1), v.sy(1.15)], [v.sx(tx0), v.sy(1.15)]],
      { stroke: 'transparent', fill: 'rgba(245,101,101,0.16)' });
    text(f, '肿瘤靶区', v.sx(tx0) + 6, v.sy(1.11), { color: C.hot, font: '11px sans-serif' });
    // 皮肤与入射
    dot(f, v.sx(0), v.sy(0.3 + (mv < 10 ? 0.06 : 0.12)), 7, C.warm);
    text(f, '皮肤量 ≈ 30-40%', v.sx(0.4), v.sy(0.22), { color: C.warm, font: '11px sans-serif' });
    text(f, `${mv} MV：能量越高建成越深——高能线对皮肤更友好、但需要更厚的水等效深度`, 56, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '深度 →（cm 水当量）', w - 170, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '百分深度剂量 PDD (%)', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    text(f, '多野照射 + 调强：把高剂量区捏成肿瘤的形状，危及器官限量是硬约束', 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '剂量分布设计是放疗的核心：靶区足量、周围组织尽量少挨',
      '分次照射利用正常组织修复快于肿瘤的差异——2 Gy × 35 的智慧',
      '从钴-60 到直线加速器与质子束——精度与焦点一路收紧',
    ]);
    heading(f, '放射治疗：深度剂量的取舍');
  },
});
registerViz(radiotherapyDose);

/** 放射性核素选择。 */
const radiopharmaceutical = defineViz({
  slug: 'radiopharmaceutical', title: '放射性核素选择', animated: true,
  params: { half: { type: 'select', options: ['Tc-99m (6 h)', 'F-18 (110 min)', 'I-131 (8 d)'], default: 'Tc-99m (6 h)', label: '核素' } },
  draw: (f) => {
    const { w, h, params } = f;
    const sel = String((params as Record<string, unknown>)['half'] ?? 'Tc');
    const tHalf = sel.includes('99m') ? 6 : sel.includes('F-18') ? 1.83 : 192; // 小时
    clear(f);
    // 衰变曲线
    const v = view(f, { xMin: 0, xMax: 24, yMin: 0, yMax: 1.08, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    const dec: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const t = (i / 300) * 24;
      dec.push([v.sx(t), v.sy(Math.pow(0.5, t / tHalf))]);
    }
    poly(f, dec, { stroke: C.accent, lw: 3.4 });
    // 半衰期标记
    let n = 0;
    for (let k = 1; k <= 4; k++) {
      const th = tHalf * k;
      if (th > 24) break;
      const y = Math.pow(0.5, k);
      seg(f, v.sx(th), v.sy(0), v.sx(th), v.sy(y), `${C.warm}99`, 1.4, );
      dot(f, v.sx(th), v.sy(y), 6, C.warm);
      text(f, `T½×${k}`, v.sx(th) - 18, v.sy(0) + 24, { color: C.warm, font: '10px sans-serif' });
      n++;
    }
    void n;
    // 检查窗口
    const win = Math.min(24, tHalf * 1.5);
    poly(f, [[v.sx(0), v.sy(0)], [v.sx(win), v.sy(0)], [v.sx(win), v.sy(1.08)], [v.sx(0), v.sy(1.08)]],
      { stroke: 'transparent', fill: 'rgba(72,187,120,0.14)' });
    text(f, '最佳成像窗口', v.sx(0.3), v.sy(1.03), { color: C.green, font: '11px sans-serif' });
    // 核素卡片
    const bx = w * 0.66;
    const cards: [string, boolean][] = [
      ['Tc-99m：6 h，140 keV，剂量低', sel.includes('99m')],
      ['F-18：110 min，正电子，PET 用', sel.includes('F-18')],
      ['I-131：8 d，治疗兼显像', sel.includes('I-131')],
    ];
    cards.forEach(([t, on], i) => {
      const y = 96 + i * 52;
      poly(f, [[bx, y], [bx + 240, y], [bx + 240, y + 40], [bx, y + 40]],
        { stroke: on ? C.green : `${C.grid}aa`, lw: on ? 2.6 : 1.4, fill: on ? 'rgba(72,187,120,0.18)' : 'rgba(45,55,72,0.5)' });
      text(f, t, bx + 12, y + 25, { color: on ? C.green : C.dim, font: '12px sans-serif' });
    });
    text(f, `${sel}：半衰期 ${tHalf} h——太短赶不上检查、太长白挨辐射`, 56, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '时间 →（h）', w - 110, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '剩余活度', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    text(f, '配体决定去向（进心肌的、进骨骼的、进肿瘤的各配各的载体）', 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      'Tc-99m 占核医学检查八成——钼锝发生器让它随用随取',
      '半衰期匹配流程：排队、注射、采集、报告——一步都不能拖',
      '诊疗一体化用同一靶点既成像又给药——精准医学的物理底座',
    ]);
    heading(f, '核素选择：半衰期的时刻表');
  },
});
registerViz(radiopharmaceutical);

/** 双能 CT 与能谱成像。 */
const dualEnergyCt = defineViz({
  slug: 'dual-energy-ct', title: '双能 CT 与能谱成像', animated: true,
  params: { kev: { type: 'range', min: 40, max: 140, default: 80, step: 10, label: '有效能量 (keV)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kev = num(params, 'kev', 80);
    clear(f);
    // 左：两种能量下的衰减差异
    const mats: [string, number, number][] = [
      ['尿酸结石', 0.28, 0.42],   // [μ低, μ高] 相对
      ['草酸钙结石', 0.55, 0.46],
      ['软组织', 0.3, 0.32],
    ];
    const x0 = 60, y0 = h * 0.3;
    mats.forEach(([name, lo, hi], i) => {
      const y = y0 + i * 78;
      text(f, name, x0, y - 8, { color: C.fg, font: '12px sans-serif' });
      const amp = kev < 80 ? lo : hi;
      const glow = 0.5 + 0.5 * Math.sin(f.t * 3 + i);
      poly(f, [[x0, y], [x0 + amp * 420 * (kev < 80 ? 1.4 : 1), y], [x0 + amp * 420 * (kev < 80 ? 1.4 : 1), y + 26], [x0, y + 26]],
        { stroke: 'transparent', fill: i === 0 ? `rgba(245,101,101,${glow})` : i === 1 ? `rgba(236,201,75,${glow})` : `rgba(66,153,225,${glow})` });
      text(f, `μ ≈ ${(amp * (kev < 80 ? 1.4 : 1)).toFixed(2)}`, x0 + amp * 420 * (kev < 80 ? 1.4 : 1) + 10, y + 18, { color: C.dim, font: '11px sans-serif' });
    });
    text(f, kev < 80 ? '低能端：光电效应主导——重元素 μ 骤增' : '高能端：康普顿主导——差异收窄但可分离',
      60, 44, { color: kev < 80 ? C.hot : C.cool, font: '13px sans-serif' });
    // 右：分解结果
    const rx = w * 0.66, ry = h * 0.34;
    text(f, '双能分解 →', rx - 10, ry - 24, { color: C.cyan, font: '12px sans-serif' });
    const decomposed = Math.sin(f.t * 1.4) > 0;
    if (decomposed) {
      // 成分图：结石被单独标出
      circle(f, rx + 70, ry + 50, 40, { stroke: C.hot, lw: 3.4, fill: 'rgba(245,101,101,0.55)' });
      text(f, '尿酸', rx + 52, ry + 55, { color: '#fff', font: '12px sans-serif' });
      circle(f, rx + 190, ry + 74, 30, { stroke: C.cool, lw: 3, fill: 'rgba(66,153,225,0.45)' });
      text(f, '软组织', rx + 168, ry + 78, { color: '#fff', font: '11px sans-serif' });
      text(f, '材质图：成分一目了然', rx, ry + 140, { color: C.green, font: '12px sans-serif' });
    } else {
      circle(f, rx + 70, ry + 50, 40, { stroke: C.dim, lw: 3, fill: 'rgba(100,116,139,0.55)' });
      text(f, '结石?', rx + 52, ry + 55, { color: C.dim, font: '12px sans-serif' });
      circle(f, rx + 190, ry + 74, 30, { stroke: C.dim, lw: 3, fill: 'rgba(100,116,139,0.5)' });
      text(f, '静脉?', rx + 174, ry + 78, { color: C.dim, font: '11px sans-serif' });
      text(f, '单能图：密度相近分不清', rx, ry + 140, { color: C.warm, font: '12px sans-serif' });
    }
    text(f, `当前 ${kev} keV：两种能量联立即可解出光电与康普顿两个分量`, 60, h - 96, { color: C.cyan, font: '13px sans-serif' });
    footnotes(f, [
      '单能 CT 只给密度，双能给成分——有效原子序数是新的维度',
      '尿酸结石可溶石治疗、草酸钙往往要手术——分清了治疗才精准',
      '虚拟单能、去骨减影与痛风检测——能谱成像的日常岗位',
    ]);
    heading(f, '双能 CT：从密度到成分');
  },
});
registerViz(dualEnergyCt);

/** 磁粒子成像 MPI。 */
const magneticParticleImaging = defineViz({
  slug: 'magnetic-particle-imaging', title: '磁粒子成像 MPI', animated: true,
  params: { drive: { type: 'range', min: 10, max: 100, default: 60, step: 5, label: '驱动场幅值 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const drive = num(params, 'drive', 60);
    clear(f);
    // 选择场梯度 + 零场窗口
    const cx = w * 0.4, cy = h * 0.5;
    for (let i = 0; i < 8; i++) {
      const x = 60 + i * 60;
      const field = (x - cx) / 60;
      vec(f, x, cy + 90, x, cy + 90 - (30 + field * 40), field > 0 ? C.hot : C.cool, 2.4);
    }
    text(f, '选择场梯度（两侧磁化饱和）', 60, cy + 130, { color: C.dim, font: '11px sans-serif' });
    // 零场窗口（FOV 窗口移动）
    const windowX = cx + Math.sin(f.t * 0.8) * 140;
    poly(f, [[windowX - 44, cy - 96], [windowX + 44, cy - 96], [windowX + 44, cy + 60], [windowX - 44, cy + 60]],
      { stroke: `rgba(72,187,120,${0.5 + 0.4 * Math.sin(f.t * 3)})`, lw: 3, fill: 'rgba(72,187,120,0.14)' });
    text(f, '零场窗口（唯一未饱和区）', windowX - 84, cy - 106, { color: C.green, font: '11px sans-serif' });
    // 磁粉（窗口内非线性响应）
    const rand = rng(64);
    for (let i = 0; i < 12; i++) {
      const tx = windowX - 40 + rand() * 80, ty = cy - 88 + rand() * 140;
      const nl = Math.abs(Math.sin(f.t * 6 + i)) * (drive / 100);
      dot(f, tx, ty, 6.4, `rgba(146,84,222,${0.3 + nl * 0.7})`);
    }
    // 信号波形（超谐波）
    const v = view(f, { xMin: 0, xMax: 1, yMin: -1.1, yMax: 1.1, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    const sig: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const t = i / 300;
      const fund = Math.sin(t * Math.PI * 2 * 2 + f.t * 4);
      const harm3 = Math.sin(t * Math.PI * 2 * 6 + f.t * 12) * 0.5;
      sig.push([v.sx(t), v.sy((fund + harm3) * (drive / 100) * 0.85)]);
    }
    poly(f, sig, { stroke: C.accent, lw: 3 });
    text(f, '磁粉响应的超谐波（背景组织沉默——只测示踪剂）', 56, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '驱动场周期 →', w - 130, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, `驱动 ${drive}%：非线性越强高次谐波越丰富，信噪比越高`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '不测衰减、不测弛豫——MPI 只测磁化率，是全新成像对比度',
      '零场窗口逐行扫描成像——毫秒级时间分辨可实时看血流',
      '超谐波是技术指纹：自然组织不产生它们——本底天然干净',
    ]);
    heading(f, '磁粒子成像：只听磁粉的回声');
  },
});
registerViz(magneticParticleImaging);

/** 红外热成像。 */
const thermalImaging = defineViz({
  slug: 'thermal-imaging', title: '红外热成像', animated: true,
  params: { emiss: { type: 'range', min: 40, max: 100, default: 97, step: 1, label: '发射率 ε (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const emis = num(params, 'emiss', 97) / 100;
    clear(f);
    // 左：伪彩热图（人体轮廓 + 血流热区）
    const bx = w * 0.26, by = h * 0.48;
    circle(f, bx, by - 96, 44, { fill: 'rgba(236,201,75,0.7)' }); // 头
    poly(f, [[bx - 56, by - 46], [bx + 56, by - 46], [bx + 44, by + 110], [bx - 44, by + 110]],
      { stroke: 'transparent', fill: 'rgba(237,137,54,0.55)' }); // 躯干
    // 热区（红外看到的血流）
    const heatZones: [number, number, number][] = [[bx, by - 96, 30], [bx, by + 10, 46], [bx - 40, by - 30, 22], [bx + 40, by - 30, 22]];
    for (const [hx, hy, hr] of heatZones) {
      const glow = 0.5 + 0.5 * Math.sin(f.t * 2);
      circle(f, hx, hy, hr + glow * 6, { fill: `rgba(245,101,101,${0.35 + glow * 0.3})` });
    }
    // 色标
    for (let i = 0; i < 80; i++) {
      const t = i / 80;
      const color = t < 0.33 ? `rgba(66,153,225,${0.9})` : t < 0.66 ? `rgba(236,201,75,0.9)` : `rgba(245,101,101,0.9)`;
      poly(f, [[bx - 70 + i * 1.7, by + 138], [bx - 70 + i * 1.7 + 1.8, by + 138], [bx - 70 + i * 1.7 + 1.8, by + 156], [bx - 70 + i * 1.7, by + 156]],
        { stroke: 'transparent', fill: color });
    }
    text(f, '冷 ← → 热', bx - 66, by + 176, { color: C.dim, font: '11px sans-serif' });
    // 右：斯特藩-玻尔兹曼曲线
    const v = view(f, { xMin: 0, xMax: 60, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    const sb: [number, number][] = [];
    for (let i = 1; i <= 200; i++) {
      const T = (i / 200) * 60 + 5;
      sb.push([v.sx(T), v.sy(Math.pow(T / 65, 4) * emis)]);
    }
    poly(f, sb, { stroke: C.hot, lw: 3.4 });
    const Tskin = 33;
    dot(f, v.sx(Tskin), v.sy(Math.pow(Tskin / 65, 4) * emis), 8, C.warm);
    text(f, `33℃ 皮肤：P = εσT⁴ = ${(Math.pow(Tskin / 65, 4) * emis * 100).toFixed(0)}%（相对）`,
      v.sx(Tskin) + 10, v.sy(Math.pow(Tskin / 65, 4) * emis) - 12, { color: C.warm, font: '11px sans-serif' });
    text(f, `发射率 ${Math.round(emis * 100)}%：皮肤近乎黑体（0.98），抛光金属只有 0.05——读温先读表面`, 56, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '温度 →（℃）', w - 110, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '相对辐射功率', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    text(f, '皮下血流改变表面温度 0.5℃ 即可分辨——热像看的是循环而不是体温计', 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '红外热像无接触、全视野——发热筛查与血管病变的快速手段',
      '同一温度下不同材料亮度不同——测金属必须先标定发射率',
      '工业无损检测、建筑节能与电路过热排查都是它的日常岗位',
    ]);
    heading(f, '红外热成像：把体温变成地形');
  },
});
registerViz(thermalImaging);

/** 造影剂与弛豫。 */
const contrastAgent = defineViz({
  slug: 'contrast-agent', title: '造影剂与弛豫', animated: true,
  params: { conc: { type: 'range', min: 0, max: 2, default: 1, step: 0.1, label: '钆浓度 (mmol/L)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const c = num(params, 'conc', 1);
    clear(f);
    // T1 弛豫曲线（造影剂缩短 T1 → 信号变亮）
    const v = view(f, { xMin: 0, xMax: 3, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 6, ticks: true });
    const t1 = 0.8 / (1 + c * 0.9); // 造影剂缩短 T1
    const relax: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const t = (i / 300) * 3;
      relax.push([v.sx(t), v.sy(1 - Math.exp(-t / t1))]);
    }
    poly(f, relax, { stroke: C.green, lw: 3.4 });
    // 无造影对照
    const noC: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const t = (i / 300) * 3;
      noC.push([v.sx(t), v.sy(1 - Math.exp(-t / 0.8))]);
    }
    poly(f, noC, { stroke: `${C.dim}aa`, lw: 2, dash: [6, 5] });
    // TR 处的信号采样
    const TR = 0.6;
    const sigWith = 1 - Math.exp(-TR / t1);
    const sigWithout = 1 - Math.exp(-TR / 0.8);
    seg(f, v.sx(TR), v.sy(0), v.sx(TR), v.sy(1.05), `${C.warm}99`, 1.6, );
    dot(f, v.sx(TR), v.sy(sigWith), 8, C.green);
    dot(f, v.sx(TR), v.sy(sigWithout), 7, C.dim);
    text(f, `TR 处信号：有造影 ${(sigWith * 100).toFixed(0)}% vs 无造影 ${(sigWithout * 100).toFixed(0)}%`,
      56, 44, { color: C.cyan, font: '13px sans-serif' });
    // 血管亮起示意（右）
    const ax = w * 0.74, ay = h * 0.44;
    const bright = 0.35 + (c / 2) * 0.6 * (0.7 + 0.3 * Math.sin(f.t * 3));
    const vessel: [number, number][] = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      vessel.push([ax - 60 + t * 130, ay + Math.sin(t * Math.PI * 2.2) * 54]);
    }
    poly(f, vessel, { stroke: `rgba(255,250,200,${bright})`, lw: 14 });
    poly(f, vessel, { stroke: `rgba(245,101,101,${bright})`, lw: 9 });
    text(f, 'T1 加权像上的血管', ax - 60, ay + 96, { color: C.warm, font: '11px sans-serif' });
    // 钆离子示意
    for (let k = 0; k < 6; k++) {
      const a = f.t * 2 + (k / 6) * Math.PI * 2;
      dot(f, ax + Math.cos(a) * 74, ay - 110 + Math.sin(a) * 20, 5, `rgba(146,84,222,${0.5 + 0.4 * Math.sin(a + f.t)})`);
    }
    text(f, 'Gd³⁺（7 个未配对电子）', ax - 66, ay - 138, { color: '#9254de', font: '11px sans-serif' });
    text(f, `浓度 ${c} mmol/L：T1 越短、纵向磁化恢复越快、图像越亮`, 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    text(f, '弛豫时间 →（s）', w - 130, h - 86, { color: C.dim, font: '11px sans-serif' });
    text(f, '纵向磁化恢复', 56, h - 118, { color: C.dim, font: '11px sans-serif' });
    footnotes(f, [
      '造影剂不改变质子数量，只改变弛豫节奏——对比度的催化剂',
      '游离钆有毒，必须螯合；肾功能不全者需谨慎——安全高于清晰',
      '从血管造影到血脑屏障破坏提示——钆是 MRI 的通用信号旗',
    ]);
    heading(f, '造影剂：让弛豫为对比服务');
  },
});
registerViz(contrastAgent);

/** 影像剂量与 ALARA。 */
const imagingDoseAlara = defineViz({
  slug: 'imaging-dose-alara', title: '影像剂量与 ALARA', animated: true,
  params: { exam: { type: 'select', options: ['头颅 X 光', '胸部 X 光', '低剂量胸部 CT', '腹部 CT'], default: '胸部 X 光', label: '检查类型' } },
  draw: (f) => {
    const { w, h, params } = f;
    const exam = String((params as Record<string, unknown>)['exam'] ?? '胸部');
    const dose = exam.includes('头颅') ? 0.1 : exam.includes('胸部 X') ? 0.02 : exam.includes('低剂量') ? 1.5 : 10;
    const eff = exam.includes('头颅') ? 0.02 : exam.includes('胸部 X') ? 0.00004 : exam.includes('低剂量') ? 0.4 : 1.0;
    clear(f);
    // 剂量对数标尺
    const v = view(f, { xMin: -4, xMax: 2, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 96 });
    grid(f, v, { divisions: 7, ticks: true });
    // 参考线（自然本底/胸片/CT/致死）
    const refs: [number, string, string][] = [
      [-3.4, '天然本底 2.4 mSv/年', C.green],
      [-1, '胸片 0.02 mSv', C.cool],
      [0, '低剂量 CT 1.5 mSv', C.warm],
      [1, '腹部 CT 10 mSv', C.hot],
      [1.7, '急性致死 ~2000 mSv', '#9254de'],
    ];
    for (const [x, label, color] of refs) {
      seg(f, v.sx(x), v.sy(0), v.sx(x), v.sy(1.05), `${color}99`, 1.6, );
      text(f, label, v.sx(x) + 6, v.sy(1.02), { color, font: '10px sans-serif' });
    }
    // 当前检查标记（脉动）
    const lx = Math.log10(Math.max(0.00001, dose));
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 3);
    dot(f, v.sx(lx), v.sy(0.5), 10, `rgba(102,126,234,${pulse})`);
    seg(f, v.sx(lx), v.sy(0.5), v.sx(lx), v.sy(0.05), C.accent, 3);
    text(f, `${exam}：${dose} mSv（有效剂量 ${eff} mSv）`, 56, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, '剂量 →（mSv，对数刻度）', w - 180, h - 86, { color: C.dim, font: '11px sans-serif' });
    // 风险-效益卡
    const bx = 60, by = h - 154;
    const items: [string, string][] = [
      ['辐射风险', '随机效应随剂量线性累积——没有绝对安全的零'],
      ['诊断价值', '一次漏诊的代价往往远高于万分之一的理论风险'],
      ['ALARA', '满足诊断 → 尽可能低的剂量：优化而非恐低'],
    ];
    items.forEach(([k, txt2], i) => {
      const y = by + i * 34;
      const on = (f.t * 0.6) % 1 > i / 3;
      text(f, `${on ? '✓' : '·'} ${k}：${txt2}`, bx, y, { color: on ? C.green : C.dim, font: '12px sans-serif' });
    });
    text(f, '儿童与孕妇对辐射更敏感——检查前先问一句"真的需要吗"', 30, h - 96, { color: C.warm, font: '12px sans-serif' });
    footnotes(f, [
      '有效剂量 = 吸收剂量 × 组织权重——比较不同检查风险的统一标尺',
      '低剂量 CT 与迭代重建把剂量减半而不损图像——技术兑现伦理',
      'ALARA 是最优化思维：既不无谓检查，也不因噎废食拒绝必要影像',
    ]);
    heading(f, '影像剂量：ALARA 的权衡术');
  },
});
registerViz(imagingDoseAlara);
