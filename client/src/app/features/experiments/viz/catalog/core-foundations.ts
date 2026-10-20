import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text, view, grid, curve, circle, vec, rng } from '../canvas';

/** P433 质点系与质心运动定理：内力不改质心动量。 */
const particleSystemDynamics = defineViz({
  slug: 'particle-system-dynamics',
  title: '质点系与质心运动定理',
  params: { ext: { type: 'range', min: -10, max: 10, default: 4, step: 1, label: '外力（0=孤立）' } },
  draw: (f) => {
    const { w, h, params } = f;
    const Fext = num(params, 'ext', 4);
    clear(f);
    const rand = rng(23);
    // 质点群：内部相互作用（弹簧样内力）+ 质心
    const N = 7;
    const pts = Array.from({ length: N }, () => ({
      x: w * 0.5 + (rand() - 0.5) * 300, y: h * 0.42 + (rand() - 0.5) * 170,
      vx: (rand() - 0.5) * 90, vy: (rand() - 0.5) * 60,
    }));
    const dt = 0.035;
    for (let k = 0; k < 30; k++) {
      for (let i = 0; i < N; i++) {
        const p = pts[i];
        // 边界反弹
        if (p.x < 60 || p.x > w - 60) { p.vx *= -1; p.x = Math.max(60, Math.min(w - 60, p.x)); }
        if (p.y < 70 || p.y > h - 120) { p.vy *= -1; p.y = Math.max(70, Math.min(h - 120, p.y)); }
        // 内力：成对拉近（牛顿第三定律）
        for (let j = i + 1; j < N; j++) {
          const q = pts[j];
          const dx = q.x - p.x, dy = q.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          const F = (d - 90) * 0.03;
          p.vx += (dx / d) * F; p.vy += (dy / d) * F;
          q.vx -= (dx / d) * F; q.vy -= (dy / d) * F;
        }
        p.vx += (Fext / 40) * dt * 20;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
    }
    // 画连线（内力）
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
        if (Math.hypot(dx, dy) < 120) seg(f, pts[i].x, pts[i].y, pts[j].x, pts[j].y, `${C.grid}aa`, 1.2);
      }
    }
    pts.forEach((p) => dot(f, p.x, p.y, 7, C.cool));
    // 质心
    const cx = pts.reduce((s, p) => s + p.x, 0) / N;
    const cy = pts.reduce((s, p) => s + p.y, 0) / N;
    circle(f, cx, cy, 11, { stroke: C.hot, lw: 2.6, fill: 'rgba(245,101,101,0.3)' });
    text(f, 'R (质心)', cx + 16, cy + 4, { color: C.hot, font: '13px sans-serif' });
    if (Fext !== 0) {
      vec(f, cx, cy, cx + Fext * 9, cy, C.warm, 3);
      text(f, `F_ext = ${Fext} ⇒ a_cm = F/M`, cx + Fext * 9 + 6, cy - 10, { color: C.warm, font: '13px sans-serif' });
    } else {
      text(f, 'F_ext = 0 ⇒ 质心匀速 —— 内力在打架，质心不动心', cx + 18, cy + 26, { color: C.green, font: '13px sans-serif' });
    }
    footnotes(f, [
      '质心运动定理：M·R̈ = ΣF_ext —— 内力成对抵消（牛顿第三定律的推论）',
      '爆炸/开链问题先求质心：鞭梢超音速不违反相对论（质心仍亚光速）',
      '柯尼希定理：T = ½Mv_cm² + T_相对 —— 分离平动与相对运动的记账法',
    ]);
    heading(f, '内力不改质心动量：复杂系统的简化钥匙');
  },
});
registerViz(particleSystemDynamics);

/** P434 刚体平面运动：瞬心与滚轮。 */
const rigidPlaneMotion = defineViz({
  slug: 'rigid-plane-motion',
  title: '刚体平面运动',
  params: { roll: { type: 'select', options: ['纯滚动', '滑动', '纯滚动+滑'], default: '纯滚动', label: '运动模式' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = String(params['roll'] ?? '纯滚动');
    clear(f);
    const gy = h * 0.7;
    const R = 60;
    const dist = (f.t * 60) % (w - 200);
    const cx = 100 + dist;
    seg(f, 40, gy, w - 40, gy, C.grid, 2);
    // 车轮
    const omega = mode === '纯滚动' ? dist / R : dist / R * 1.6;
    const { ctx } = f;
    ctx.save();
    ctx.translate(cx, gy - R);
    ctx.rotate(omega);
    circle(f, 0, 0, R, { stroke: C.accent, lw: 3, fill: 'rgba(102,126,234,0.12)' });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      seg(f, 0, 0, Math.cos(a) * R, Math.sin(a) * R, `${C.accent}aa`, 1.6);
    }
    ctx.restore();
    // 瞬心：纯滚动在接触点，滑动时按比例
    const slip = mode === '纯滚动' ? 1 : mode === '滑动' ? 0 : 0.5;
    const icx = cx - R + 2 * R * slip * 0 + (slip < 1 ? R * (1 - 2 * (1 - slip)) * 0.0 : 0);
    const Icx = mode === '纯滚动' ? cx : mode === '滑动' ? cx + 1e4 : cx + R * 0.5;
    const icon = isFinite(Icx) ? Icx : cx;
    dot(f, icon, gy, 8, C.hot);
    text(f, mode === '滑动' ? '瞬心 ∞（无）' : 'I 瞬心', icon, gy + 24, { align: 'center', color: C.hot, font: '13px sans-serif' });
    // 瞬时速度分布
    if (mode !== '滑动') {
      for (let k = -3; k <= 3; k++) {
        const y = gy - R + k * (R / 3.5);
        const v = (y - icon) * (dist ? 1 : 1) * 0.9;
        const y2 = y;
        vec(f, cx + 30, y2, cx + 30 + Math.max(-90, Math.min(90, v)), y2, C.green, 1.8, 6);
      }
      text(f, 'v = ω × r（绕瞬心转动）', cx - 60, gy - R - 76, { color: C.green, font: '13px sans-serif' });
    } else {
      text(f, '纯滑动：v_cm = v_滑，ω 独立 —— 无瞬心', cx - 60, gy - R - 76, { color: C.warm, font: '13px sans-serif' });
    }
    // 动能分解
    text(f, 'T = ½Mv² + ½I_cm·ω²（平动+转动）', 56, 66, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '纯滚动条件 v_cm = ωR；瞬心 = 速度为零的接触点，整轮绕它瞬时转动',
      '滚动摩擦/滑动：能量进热 —— 滑冰刹车、保龄球旋转都是滑滚混合',
      'I_cm 换轴用垂直轴定理与平行轴定理；实心球 2/5 MR²、空心球 2/3 MR²',
    ]);
    heading(f, '平动加转动：滚轮问题的一套方程');
  },
});
registerViz(rigidPlaneMotion);

/** P435 引力势与逃逸速度：势能井与宇宙速度。 */
const gravitationalPotential = defineViz({
  slug: 'gravitational-potential',
  title: '引力势与逃逸速度',
  params: { v: { type: 'range', min: 0, max: 14, default: 11.2, step: 0.2, label: '发射速度 (km/s)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const v0 = num(params, 'v', 11.2);
    clear(f);
    // 势能井曲线 U(r) = -GMm/r
    const v = view(f, { xMin: 1, xMax: 10, yMin: -3, yMax: 2.6, inset: 46, insetBottom: 46 });
    grid(f, v);
    curve(f, v, (r) => -2.6 / r, { color: C.accent, lw: 2.8 });
    // 地球位置
    dot(f, v.sx(1.6), v.sy(-2.6 / 1.6), 8, C.cool);
    text(f, '地表', v.sx(1.6) + 12, v.sy(-2.6 / 1.6) - 8, { color: C.cool, font: '13px sans-serif' });
    // 能量线：E = ½v² - 2.6/r（v in scaled units）
    const E = (v0 * v0) / 28 - 2.6 / 1.6;
    seg(f, v.sx(1), v.sy(E), v.sx(10), v.sy(E), C.warm, 1.8);
    const reach = E < 0 ? -2.6 / E : 11;
    if (E < 0) {
      dot(f, v.sx(reach), v.sy(E), 6, C.hot);
      text(f, `远地点 r = ${reach.toFixed(1)}`, v.sx(reach) - 10, v.sy(E) - 12, { align: 'right', color: C.hot, font: '13px sans-serif' });
    } else {
      text(f, 'E > 0：逃逸！轨道延伸至无穷', v.sx(4), v.sy(1.6), { color: C.green, font: '14px sans-serif' });
    }
    text(f, 'r（地球半径单位）', (v.sx(1) + v.sx(10)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'U / |U_地表|', v.sx(1) + 4, v.sy(2.3), { color: C.dim, font: '12px sans-serif' });
    // 右下：三宇宙速度表
    const speeds = [['一·环绕', 7.9], ['二·逃逸', 11.2], ['三·太阳系', 16.7]] as Array<[string, number]>;
    speeds.forEach(([name, vs], i) => {
      const y = h - 150 + i * 30;
      const reached = v0 >= vs;
      text(f, `${name} ${vs} km/s`, 60, y, { color: reached ? C.green : C.dim, font: '13px sans-serif' });
      poly(f, [[220, y - 12], [220 + (vs / 16.7) * 160, y - 12], [220 + (vs / 16.7) * 160, y + 2], [220, y + 2]],
        { fill: reached ? 'rgba(72,187,120,0.6)' : 'rgba(58,74,99,0.7)' });
      if (reached) text(f, '✓', 226 + (vs / 16.7) * 160, y, { color: C.green, font: '13px sans-serif' });
    });
    footnotes(f, [
      'U(r) = −GMm/r：无穷远为零 ⇒ 引力势处处为负，越深越"束缚"',
      '逃逸速度 v = √(2GM/R) 与质量无关 —— 伽利略没想通的等效原理味道',
      '轨道能量守恒给出椭圆：v 大于环绕小于逃逸 ⇒ 远地点折返',
    ]);
    heading(f, '挖一口井逃出地球要多快');
  },
});
registerViz(gravitationalPotential);

/** P436 点的复合运动：牵连、相对与科氏。 */
const composedMotion = defineViz({
  slug: 'composed-motion',
  title: '点的复合运动',
  params: { omega: { type: 'range', min: 0, max: 3, default: 1.2, step: 0.1, label: '转台角速度 ω' } },
  draw: (f) => {
    const { w, h, params } = f;
    const om = num(params, 'omega', 1.2);
    clear(f);
    const cx = w * 0.5, cy = h * 0.44, R = 140;
    const th = f.t * om;
    // 转台
    circle(f, cx, cy, R, { stroke: C.grid, lw: 2, fill: 'rgba(45,55,72,0.5)' });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      seg(f, cx, cy, cx + Math.cos(a) * R, cy + Math.sin(a) * R, `${C.grid}88`, 1);
    }
    // 转台上的径向轨道
    const a0 = th;
    const rRel = (Math.sin(f.t * 0.7) * 0.5 + 0.5) * (R - 30);
    const px = cx + Math.cos(a0) * rRel, py = cy + Math.sin(a0) * rRel;
    seg(f, cx, cy, cx + Math.cos(a0) * (R - 24), cy + Math.sin(a0) * (R - 24), C.cool, 2.4);
    dot(f, px, py, 9, C.hot);
    // 速度分解：牵连 + 相对
    const vRel = Math.cos(f.t * 0.7) * 0.35 * (R - 30) * om; // 径向速度示意
    const vE = om * rRel;
    // 牵连速度（切向）
    vec(f, px, py, px - Math.sin(a0) * vE * 1.6, py + Math.cos(a0) * vE * 1.6, C.cool, 2.6);
    // 相对速度（径向）
    vec(f, px, py, px + Math.cos(a0) * vRel * 2.4, py + Math.sin(a0) * vRel * 2.4, C.green, 2.6);
    // 科氏加速度：2ω × v_rel（垂直相对速度）
    const aCor = 2 * om * Math.abs(vRel);
    const corDirX = -Math.sin(a0) * Math.sign(vRel), corDirY = Math.cos(a0) * Math.sign(vRel);
    vec(f, px, py, px + corDirX * aCor * 2.6, py + corDirY * aCor * 2.6, C.warm, 3);
    // 绝对速度
    const vax = -Math.sin(a0) * vE + Math.cos(a0) * vRel;
    const vay = Math.cos(a0) * vE + Math.sin(a0) * vRel;
    vec(f, px, py, px + vax * 1.6, py + vay * 1.6, C.pink, 2.4);
    // 图例
    const lx = 56;
    text(f, 'v_a = v_e + v_r（速度合成恒等式）', lx, 76, { color: C.pink, font: '15px sans-serif' });
    text(f, '蓝 = 牵连 v_e = ω×r', lx, 104, { color: C.cool, font: '13px sans-serif' });
    text(f, '绿 = 相对 v_r（沿动系径向）', lx, 128, { color: C.green, font: '13px sans-serif' });
    text(f, '橙 = 科氏加速度 a_c = 2ω×v_r', lx, 152, { color: C.warm, font: '13px sans-serif' });
    text(f, '粉 = 绝对速度 v_a', lx, 176, { color: C.pink, font: '13px sans-serif' });
    footnotes(f, [
      '加速度合成：a_a = a_e + a_r + 2ω×v_r —— 科氏项只在旋转参照系出现',
      '地转偏向力：北半球右偏 —— 河岸侵蚀、炮弹修正、傅科摆的旋转背景',
      '牵连加速度含 α×r 与 ω×(ω×r)（切向 + 向心）两项',
    ]);
    heading(f, '牵连、相对与绝对：科里奥利的运动学前身');
  },
});
registerViz(composedMotion);

/** P437 伯努利方程：沿流线的能账本。 */
const bernoulliEquation = defineViz({
  slug: 'bernoulli-equation',
  title: '伯努利方程',
  params: { a1: { type: 'range', min: 20, max: 100, default: 60, step: 5, label: '入口截面积 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const A1 = num(params, 'a1', 60) / 100;
    clear(f);
    // 变截面管
    const y0 = h * 0.3, y1 = h * 0.6;
    const x0 = 60, x1 = w - 60;
    const h1 = (y1 - y0) * A1;
    const h2 = (y1 - y0) * 0.36;
    const ptsTop: [number, number][] = [[x0, y0], [x1, y0 + (y1 - y0 - h2) / 1.6]];
    const ptsBot: [number, number][] = [[x0, y1], [x1, y1 - (y1 - y0 - h2) / 1.6]];
    poly(f, [...ptsTop, ...ptsBot.reverse()], { fill: 'rgba(66,153,225,0.14)', stroke: C.cool, lw: 2.2 });
    // 流线
    const V1 = 1 / A1, V2 = 1 / 0.36;
    for (let i = 0; i < 5; i++) {
      const t = (i + 0.5) / 5;
      const yStart = y0 + t * h1;
      const yEnd = y0 + (y1 - y0 - h2) / 1.6 + t * h2;
      const pts: [number, number][] = [];
      for (let k = 0; k <= 40; k++) {
        const s = k / 40;
        const x = x0 + s * (x1 - x0);
        pts.push([x, yStart + (yEnd - yStart) * s]);
      }
      poly(f, pts, { stroke: `${C.cyan}aa`, lw: 1.4 });
      // 粒子动画
      const s = (f.t * 0.5 + i * 0.2) % 1;
      const idx = Math.floor(s * 40);
      const pt = pts[Math.min(idx, 40)];
      dot(f, pt[0], pt[1], 4, C.yellow);
    }
    // 压力条：窄处低压
    const P = (V: number) => 1 - 0.86 * ((V - V1) / (V2 - V1));
    const p1 = P(V1), p2 = P(V2);
    text(f, `v₁ = ${V1.toFixed(2)}v₀`, x0 + 8, y0 - 14, { color: C.green, font: '14px sans-serif' });
    text(f, `v₂ = ${V2.toFixed(2)}v₀`, x1 - 60, y0 - 14, { color: C.green, font: '14px sans-serif' });
    text(f, `P₁ 高`, x0 + 8, y1 + 26, { color: C.hot, font: '14px sans-serif' });
    text(f, `P₂ 低 ⇐ 窄道快流`, x1 - 90, y1 + 26, { color: C.hot, font: '14px sans-serif' });
    // 压力柱
    for (let i = 0; i < 14; i++) {
      const x = x0 + i * ((x1 - x0) / 14);
      const p = p1 + (p2 - p1) * (i / 13);
      const bh = 46 * p;
      poly(f, [[x, h - 96 - bh], [x + 24, h - 96 - bh], [x + 24, h - 96], [x, h - 96]],
        { fill: `rgba(245,101,101,${0.25 + p * 0.5})` });
    }
    text(f, '沿程压强 P + ½ρv² = 常数', x0, h - 108, { color: C.fg, font: '14px sans-serif' });
    footnotes(f, [
      '定常无黏沿流线：P + ½ρv² + ρgh = 常数 —— 能量密度的三种记账',
      '升力：机翼上下流速差 → 压强差（同时满足连续性与环量）',
      '局限：黏性（文丘里损耗）、分离流、非定常 —— 这些场合用纳维-斯托克斯',
    ]);
    heading(f, '流速高处压强低的全部依据');
  },
});
registerViz(bernoulliEquation);

/** P438 电介质的极化：束缚电荷与介电常数。 */
const dielectricPolarization = defineViz({
  slug: 'dielectric-polarization',
  title: '电介质的极化',
  params: { E0: { type: 'range', min: 0, max: 10, default: 6, step: 0.5, label: '外场 E₀' } },
  draw: (f) => {
    const { w, h, params } = f;
    const E0 = num(params, 'E0', 6);
    clear(f);
    // 平行板电容器
    const plateL = h * 0.62;
    const lx = w * 0.34, rx = w * 0.66;
    const y0 = h * 0.18;
    poly(f, [[lx - 14, y0], [lx + 6, y0], [lx + 6, y0 + plateL], [lx - 14, y0 + plateL]], { fill: C.cool });
    poly(f, [[rx - 6, y0], [rx + 14, y0], [rx + 14, y0 + plateL], [rx - 6, y0 + plateL]], { fill: C.cool });
    text(f, '+', lx - 4, y0 + plateL / 2, { align: 'center', color: C.fg, font: '22px serif' });
    text(f, '−', rx + 4, y0 + plateL / 2, { align: 'center', color: C.fg, font: '22px serif' });
    // 外场线
    for (let i = 0; i < 7; i++) {
      const y = y0 + 30 + i * ((plateL - 60) / 6);
      const strength = 40 + E0 * 14;
      vec(f, lx + 8, y, lx + 8 + strength, y, `rgba(66,153,225,${0.35 + E0 * 0.06})`, 2, 7);
      vec(f, rx - 8 - strength * 0.5, y, rx - 8, y, `rgba(66,153,225,${0.35 + E0 * 0.06})`, 2, 7);
    }
    // 介质内的偶极子
    const dx0 = lx + 8 + E0 * 14 + 14, dx1 = rx - 8 - E0 * 7 - 14;
    for (let gx = dx0; gx < dx1; gx += 52) {
      for (let gy = y0 + 34; gy < y0 + plateL - 20; gy += 54) {
        const stretch = 8 + E0 * 1.6;
        seg(f, gx - stretch, gy, gx + stretch, gy, C.green, 2);
        dot(f, gx - stretch, gy, 4.6, C.cool);
        dot(f, gx + stretch, gy, 4.6, C.hot);
      }
    }
    // 束缚电荷层
    const leftX = dx0 - 12, rightX = dx1 + 12;
    for (let gy = y0 + 34; gy < y0 + plateL - 20; gy += 26) {
      dot(f, leftX, gy, 5, C.hot);
      dot(f, rightX, gy, 5, C.cool);
    }
    text(f, 'σ_b 束缚电荷 →', leftX - 62, y0 + plateL / 2, { color: C.hot, font: '13px sans-serif' });
    text(f, '← σ_b', rightX + 10, y0 + plateL / 2, { color: C.cool, font: '13px sans-serif' });
    // 底部：场关系
    text(f, `E_内 = E₀ − P/ε₀ = E₀/ε_r ⇒ 介电常数 ε_r = 1 + χ_e`, 60, h - 92, { color: C.fg, font: '15px sans-serif' });
    text(f, `当前：E₀ = ${E0.toFixed(1)}，内部场被削弱 ${(100 * (1 - 1 / (1 + E0 * 0.12))).toFixed(0)}%（示意）`, 60, h - 66, { color: C.yellow, font: '13px sans-serif' });
    footnotes(f, [
      '极化强度 P = Σp/V：单位体积电偶极矩 —— 电子位移（电子极化）+ 离子位移 + 偶极转向',
      '束缚电荷 σ_b = P·n：极化"头尾相消"只剩表面 —— 静电场电容增大的微观出处',
      '边界条件 D_⊥ 连续、E_∥ 连续 —— 有介质时用 D 场最省事',
    ]);
    heading(f, '电场让束缚电荷挪位');
  },
});
registerViz(dielectricPolarization);

/** P439 电容器的能量：½CV² 与能量密度。 */
const capacitorEnergy = defineViz({
  slug: 'capacitor-energy',
  title: '电容器的能量',
  params: { V: { type: 'range', min: 0, max: 100, default: 60, step: 5, label: '电压 V (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const V = num(params, 'V', 60) / 100;
    clear(f);
    // 充电 RC 电路示意
    const cx = w * 0.3, cy = h * 0.4;
    // 电容板
    poly(f, [[cx - 60, cy - 40], [cx - 52, cy - 40], [cx - 52, cy + 40], [cx - 60, cy + 40]], { fill: C.cool });
    poly(f, [[cx + 52, cy - 40], [cx + 60, cy - 40], [cx + 60, cy + 40], [cx + 52, cy + 40]], { fill: C.cool });
    text(f, `${(V * 25).toFixed(0)} V`, cx, cy - 56, { align: 'center', color: C.yellow, font: '15px sans-serif' });
    // 板上电荷
    for (let i = 0; i < 7; i++) {
      const y = cy - 36 + i * 12;
      text(f, '+', cx - 68, y + 4, { color: C.hot, font: '14px serif' });
      text(f, '−', cx + 62, y + 4, { color: C.cool, font: '14px serif' });
    }
    // 场线
    for (let i = 0; i < 6; i++) {
      const y = cy - 30 + i * 12;
      vec(f, cx - 50, y, cx + 50, y, `rgba(102,126,234,${0.3 + V * 0.6})`, 1.8, 6);
    }
    // 导线回路
    poly(f, [[cx - 60, cy - 40], [cx - 60, cy - 110], [cx + 150, cy - 110], [cx + 150, cy - 40]],
      { stroke: C.dim, lw: 2.2 });
    poly(f, [[cx - 60, cy + 40], [cx - 60, cy + 110], [cx + 150, cy + 110], [cx + 150, cy + 40]],
      { stroke: C.dim, lw: 2.2 });
    // 电池
    poly(f, [[cx + 60, cy - 122], [cx + 72, cy - 98], [cx + 84, cy - 122]], { fill: C.warm });
    seg(f, cx + 90, cy - 110, cx + 110, cy - 110, C.warm, 3);
    text(f, `Q = CV = ${(V * 25 * 40).toFixed(0)} μC`, cx + 60, cy - 134, { color: C.warm, font: '13px sans-serif' });
    // 右：能量曲线 W = ½CV² 与能量密度
    const gx0 = w * 0.58, gy0 = h - 110, gx1 = w - 50, gy1 = 90;
    seg(f, gx0, gy0, gx1, gy0, C.grid, 1.4);
    seg(f, gx0, gy0, gx0, gy1 - 10, C.grid, 1.4);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const vv = i / 60;
      pts.push([gx0 + vv * (gx1 - gx0), gy0 - vv * vv * (gy0 - gy1)]);
    }
    poly(f, pts, { stroke: C.pink, lw: 2.8 });
    dot(f, gx0 + V * (gx1 - gx0), gy0 - V * V * (gy0 - gy1), 6, C.yellow);
    text(f, `W = ½CV² = ${(0.5 * V * V * 100).toFixed(1)} J（示意 C=2F）`, gx0 + 8, gy1 + 16, { color: C.pink, font: '13px sans-serif' });
    text(f, 'V', gx1 - 4, gy0 + 20, { align: 'right', color: C.dim, font: '12px sans-serif' });
    text(f, 'W ∝ V²：电压翻倍，储能四倍', gx0, h - 132, { color: C.fg, font: '14px sans-serif' });
    footnotes(f, [
      'W = ∫₀^Q (q/C)dq = ½CV² = Q²/2C = ½QV —— 记账口径三选一',
      '能量密度 u = ½ε₀E²：能量在场里，板间体积越大储能越多（击穿场强是天花板）',
      '充电过程：电源一半能量变热（½CV² 损耗与 R 无关的经典结论）',
    ]);
    heading(f, '½CV²：能量存在场里不是电荷里');
  },
});
registerViz(capacitorEnergy);

/** P440 安培环路定理的应用：对称性选路径。 */
const ampereCircuitalLaw = defineViz({
  slug: 'ampere-circuital-law',
  title: '安培环路定理的应用',
  params: { geo: { type: 'select', options: ['长直导线', '螺绕环', '无限长螺线管'], default: '长直导线', label: '对称构型' } },
  draw: (f) => {
    const { w, h, params } = f;
    const geo = String(params['geo'] ?? '长直导线');
    clear(f);
    const cx = w * 0.34, cy = h * 0.44;
    if (geo === '长直导线') {
      circle(f, cx, cy, 16, { fill: C.hot, stroke: C.hot, lw: 2 });
      text(f, 'I ⊙', cx, cy + 5, { align: 'center', color: C.fg, font: '12px serif' });
      // 同心圆磁场
      [46, 78, 110, 142].forEach((r, i) => {
        const { ctx } = f;
        ctx.save();
        ctx.strokeStyle = `rgba(66,153,225,${0.8 - i * 0.14})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 7]);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        const a = -0.6;
        vec(f, cx + Math.cos(a) * r, cy + Math.sin(a) * r,
          cx + Math.cos(a) * r + Math.sin(a) * -14, cy + Math.sin(a) * r + Math.cos(a) * 14, C.cool, 2, 6);
      });
      text(f, '∮B·dl = μ₀I', cx - 46, cy + 176, { color: C.fg, font: '16px serif' });
      text(f, 'B·2πr = μ₀I ⇒ B = μ₀I/(2πr)', cx - 66, cy + 202, { color: C.cool, font: '14px serif' });
    } else if (geo === '螺绕环') {
      const R0 = 130;
      // 环芯
      const { ctx } = f;
      ctx.save();
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 46;
      ctx.beginPath();
      ctx.arc(cx, cy, R0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      // 绕线
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        const x = cx + Math.cos(a) * R0, y = cy + Math.sin(a) * R0;
        seg(f, x - Math.sin(a) * 30, y + Math.cos(a) * 30, x + Math.sin(a) * 30, y - Math.cos(a) * 30, C.warm, 3);
      }
      // 积分回路（环内）
      const { ctx: c2 } = f;
      c2.save();
      c2.strokeStyle = C.green;
      c2.lineWidth = 2;
      c2.setLineDash([8, 6]);
      c2.beginPath();
      c2.arc(cx, cy, R0, 0, Math.PI * 2);
      c2.stroke();
      c2.restore();
      text(f, 'B·2πR = μ₀NI ⇒ B = μ₀NI/(2πR)', cx - 100, cy + R0 + 74, { color: C.green, font: '15px serif' });
      text(f, '环外：穿过回路电流净为零 ⇒ B ≈ 0', cx - 90, cy + R0 + 100, { color: C.dim, font: '13px sans-serif' });
    } else {
      // 螺线管
      poly(f, [[cx - 170, cy - 46], [cx + 170, cy - 46], [cx + 170, cy + 46], [cx - 170, cy + 46]],
        { fill: 'rgba(45,55,72,0.7)', stroke: C.accent, lw: 2 });
      for (let i = 0; i < 14; i++) {
        const x = cx - 155 + i * 24;
        const { ctx } = f;
        ctx.save();
        ctx.strokeStyle = C.warm;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x, cy, 7, 52, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      for (let i = 0; i < 5; i++) {
        const y = cy - 30 + i * 15;
        vec(f, cx - 130, y, cx + 130, y, `rgba(66,153,225,0.75)`, 2, 7);
      }
      // 矩形回路
      poly(f, [[cx - 100, cy - 100], [cx + 100, cy - 100], [cx + 100, cy + 26], [cx - 100, cy + 26]],
        { stroke: C.green, lw: 2, dash: [8, 6] });
      text(f, 'B·L = μ₀nIL ⇒ B = μ₀nI', cx - 90, cy + 118, { color: C.green, font: '15px serif' });
      text(f, '内部均匀，外部近零', cx - 66, cy + 144, { color: C.dim, font: '13px sans-serif' });
    }
    // 右侧通用提示
    text(f, '三步法：', w * 0.7, 84, { color: C.yellow, font: '15px sans-serif' });
    ['① 找对称性（柱/环/平）', '② 猜 B 方向与大小规律', '③ 选积分路径算 ∮B·dl'].forEach((s, i) => {
      text(f, s, w * 0.7, 116 + i * 30, { color: C.fg, font: '14px sans-serif' });
    });
    if (geo === '长直导线') {
      text(f, '位移电流修正：电容器充电时改用安培-麦克斯韦定律', w * 0.7, 230, { color: C.hot, font: '13px sans-serif' });
      text(f, '∮B·dl = μ₀(I_c + ε₀ dΦ_E/dt)', w * 0.7, 256, { color: C.hot, font: '14px serif' });
    }
    footnotes(f, [
      '安培环路定理只在对称构型下"好算" —— 本质是毕奥-萨伐尔积分的对称性捷径',
      '螺绕环/螺线管是"人造均匀场"：实验室与 MRI 磁体的基本结构',
      '麦克斯韦补上位移电流：否则电容充电不满足电荷守恒（1865 拼图完成）',
    ]);
    heading(f, '对称性选积分路径：磁场计算的捷径');
  },
});
registerViz(ampereCircuitalLaw);

/** P441 磁偶极与磁矩：磁场中的力矩与进动。 */
const magneticDipole = defineViz({
  slug: 'magnetic-dipole',
  title: '磁偶极与磁矩',
  params: { mode: { type: 'select', options: ['力矩', '进动', '势能'], default: '进动', label: '演示模式' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = String(params['mode'] ?? '进动');
    clear(f);
    const cx = w * 0.42, cy = h * 0.44;
    if (mode === '力矩') {
      // 均匀场 + 电流环
      for (let i = 0; i < 6; i++) {
        const y = 90 + i * 50;
        vec(f, 70, y, w - 70, y, `rgba(66,153,225,0.55)`, 2.4, 9);
      }
      text(f, 'B 均匀场', 74, 76, { color: C.cool, font: '14px sans-serif' });
      const tilt = Math.sin(f.t * 1.4) * 0.5;
      const rx = 78, ry = 26;
      const { ctx } = f;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt - 0.5);
      ctx.strokeStyle = C.warm;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      // μ 矢量
      const mx = -Math.sin(tilt - 0.5), my = Math.cos(tilt - 0.5) * 0.4 + 0.6;
      vec(f, cx, cy, cx + mx * 70, cy - my * 70, C.pink, 3);
      text(f, 'μ', cx + mx * 74, cy - my * 74 + 4, { color: C.pink, font: '16px serif' });
      // 力矩方向
      vec(f, cx, cy, cx - 66, cy + 8, C.hot, 3);
      text(f, 'τ = μ × B → 对齐', cx - 130, cy + 44, { color: C.hot, font: '15px sans-serif' });
      text(f, 'U = −μ·B：磁矩像指南针一样转向对齐 B', cx - 150, cy + 130, { color: C.fg, font: '14px sans-serif' });
    } else if (mode === '进动') {
      // 拉莫尔进动
      vec(f, cx, cy + 120, cx, cy - 140, C.cool, 3);
      text(f, 'B', cx + 10, cy - 146, { color: C.cool, font: '16px serif' });
      const ang = f.t * 2.2;
      const tilt = 0.55;
      const mx = Math.sin(tilt) * Math.cos(ang) * 130;
      const my = Math.sin(tilt) * Math.sin(ang) * 46;
      const mz = Math.cos(tilt) * 130;
      vec(f, cx, cy + 60, cx + mx, cy + 60 - mz, C.pink, 3.4);
      // 进动圆
      const { ctx } = f;
      ctx.save();
      ctx.strokeStyle = `${C.yellow}aa`;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.ellipse(cx, cy + 60 - mz, Math.abs(mx) || 1, Math.abs(my) + 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      text(f, 'ω_L = γB（拉莫尔频率）', cx - 210, cy - 170, { color: C.yellow, font: '15px sans-serif' });
      text(f, 'γ = e/2m：回磁比', cx - 210, cy - 144, { color: C.fg, font: '13px sans-serif' });
      text(f, 'NMR/MRI：射频打在 ω_L 上共振吸收', cx - 210, cy - 118, { color: C.cool, font: '13px sans-serif' });
      text(f, 'τ = μ×B ⊥ μ：不改变夹角，只改变方位', cx - 210, cy + 140, { color: C.hot, font: '14px sans-serif' });
    } else {
      // 势能 U(θ)
      const v = view(f, { xMin: 0, xMax: 3.14, yMin: -1.4, yMax: 1.4, inset: 50, insetBottom: 50 });
      grid(f, v);
      curve(f, v, (th) => -Math.cos(th), { color: C.accent, lw: 2.8 });
      const th = (f.t * 0.8) % (Math.PI * 2);
      const thp = ((th % (Math.PI * 2)) + Math.PI * 2) % Math.PI;
      dot(f, v.sx(Math.min(thp, 3.14)), v.sy(-Math.cos(Math.min(thp, 3.14))), 7, C.hot);
      text(f, 'θ = 0（平行）最稳', v.sx(0.1), v.sy(-0.75), { color: C.green, font: '13px sans-serif' });
      text(f, 'θ = π（反平行）最不稳', v.sx(1.9), v.sy(0.7), { color: C.hot, font: '13px sans-serif' });
      text(f, 'U = −μB cosθ', v.sx(1.0), v.sy(1.2), { color: C.fg, font: '15px serif' });
      text(f, 'θ', (v.sx(0) + v.sx(3.14)) / 2, h - 56, { align: 'center', color: C.dim, font: '13px sans-serif' });
      text(f, '玻尔磁子 μ_B = eℏ/2m_e —— 原子磁矩的天然单位', 60, h - 104, { color: C.yellow, font: '14px sans-serif' });
    }
    footnotes(f, [
      '载流回路 μ = I·A·n̂：宏观小磁铁的全部磁学（条形磁铁 = 巨量微观 μ 之和）',
      '力矩 τ = μ×B、势能 U = −μ·B —— 与电偶极公式完全同构',
      '塞曼效应：磁场把能级按 m 拆开，间距 gμ_BB —— 从光谱反测太阳磁场',
    ]);
    heading(f, '电流回路就是小磁铁');
  },
});
registerViz(magneticDipole);

/** P442 麦克斯韦关系：热力学量互相翻译的字典。 */
const maxwellRelations = defineViz({
  slug: 'maxwell-relations',
  title: '麦克斯韦关系',
  draw: (f) => {
    const { w, h } = f;
    clear(f);
    // 四个热力学势方形图
    const cx = w * 0.36, cy = h * 0.44, S = 130;
    const nodes = [
      { x: cx - S, y: cy - S, name: 'U 内能', sub: 'dU = TdS − PdV', color: C.accent },
      { x: cx + S, y: cy - S, name: 'H 焓', sub: 'dH = TdS + VdP', color: C.cool },
      { x: cx - S, y: cy + S, name: 'F 自由能', sub: 'dF = −SdT − PdV', color: C.green },
      { x: cx + S, y: cy + S, name: 'G 自由能G', sub: 'dG = −SdT + VdP', color: C.warm },
    ];
    // 边
    seg(f, nodes[0].x, nodes[0].y, nodes[1].x, nodes[1].y, C.grid, 1.6);
    seg(f, nodes[2].x, nodes[2].y, nodes[3].x, nodes[3].y, C.grid, 1.6);
    seg(f, nodes[0].x, nodes[0].y, nodes[2].x, nodes[2].y, C.grid, 1.6);
    seg(f, nodes[1].x, nodes[1].y, nodes[3].x, nodes[3].y, C.grid, 1.6);
    // 对角线（勒让德变换）
    seg(f, nodes[0].x, nodes[0].y, nodes[3].x, nodes[3].y, `${C.pink}88`, 2);
    seg(f, nodes[1].x, nodes[1].y, nodes[2].x, nodes[2].y, `${C.pink}88`, 2);
    text(f, '勒让德变换', cx + 8, cy + 6, { color: C.pink, font: '13px sans-serif' });
    nodes.forEach((n) => {
      poly(f, [[n.x - 78, n.y - 30], [n.x + 78, n.y - 30], [n.x + 78, n.y + 30], [n.x - 78, n.y + 30]],
        { fill: 'rgba(45,55,72,0.92)', stroke: n.color, lw: 2.2 });
      text(f, n.name, n.x, n.y - 4, { align: 'center', color: n.color, font: '15px sans-serif' });
      text(f, n.sub, n.x, n.y + 18, { align: 'center', color: C.dim, font: '11px serif' });
    });
    // 右：四条麦克斯韦关系
    const bx = w * 0.62;
    text(f, '∂ 对易换位：', bx, 92, { color: C.yellow, font: '16px sans-serif' });
    const rels = [
      '(∂T/∂V)_S = −(∂P/∂S)_V',
      '(∂T/∂P)_S = (∂V/∂S)_P',
      '(∂S/∂V)_T = (∂P/∂T)_V',
      '(∂S/∂P)_T = −(∂V/∂T)_P',
    ];
    rels.forEach((r, i) => {
      const y = 134 + i * 52;
      poly(f, [[bx, y - 18], [bx + 300, y - 18], [bx + 300, y + 22], [bx, y + 22]],
        { fill: `${i % 2 ? C.cool : C.accent}1e`, stroke: `${i % 2 ? C.cool : C.accent}aa`, lw: 1.4 });
      text(f, r, bx + 14, y + 8, { color: C.fg, font: '15px serif' });
    });
    text(f, '第 4 条直接给 ∂S/∂P —— 卡路里计变压力计', bx, 134 + 4 * 52 + 14, { color: C.green, font: '13px sans-serif' });
    footnotes(f, [
      '来源：全微分对易性（dU 的两种读法）+ 勒让德变换换变量不换信息',
      '实验可测的都是 (T,P,V) —— 关系把测不到的 S 换成能测的偏导',
      '应用：焦耳-汤姆孙系数、绝热冷却、磁热效应（冰箱之外的制冷路线）',
    ]);
    heading(f, '四个偏导的交叉换位');
  },
});
registerViz(maxwellRelations);

/** P443 熵变计算：可逆路径替身法。 */
const entropyCalculation = defineViz({
  slug: 'entropy-calculation',
  title: '熵变计算',
  params: { path: { type: 'select', options: ['等温可逆', '自由膨胀', '绝热不可逆'], default: '自由膨胀', label: '过程' } },
  draw: (f) => {
    const { w, h, params } = f;
    const path = String(params['path'] ?? '自由膨胀');
    clear(f);
    // PV 图
    const v = view(f, { xMin: 0.5, xMax: 6, yMin: 0, yMax: 5, inset: 50, insetBottom: 52 });
    grid(f, v);
    let S = '';
    if (path === '等温可逆') {
      curve(f, v, (V) => 4 / V, { color: C.cool, lw: 2.8 });
      // 面积阴影
      const pts: [number, number][] = [];
      for (let i = 0; i <= 60; i++) {
        const V = 1 + (i / 60) * 3;
        pts.push([v.sx(V), v.sy(4 / V)]);
      }
      poly(f, [...pts, [v.sx(4), v.sy(0)], [v.sx(1), v.sy(0)]], { fill: 'rgba(66,153,225,0.2)', close: true });
      text(f, 'W = nRT ln(V₂/V₁) ⇒ ΔS = Q_rev/T = nR ln2', v.sx(1.2), v.sy(4.4), { color: C.cool, font: '14px serif' });
      S = '可逆：ΔS = Q/T 直接用（热温商就是熵流）';
    } else if (path === '自由膨胀') {
      // 从 1→4 等温（真空气体不变）
      seg(f, v.sx(1), v.sy(4), v.sx(4), v.sy(4), `${C.hot}88`, 2);
      seg(f, v.sx(1), v.sy(4), v.sx(1), v.sy(0), C.hot, 2);
      seg(f, v.sx(4), v.sy(4), v.sx(4), v.sy(0), C.hot, 2);
      dot(f, v.sx(1), v.sy(4), 7, C.cool);
      dot(f, v.sx(4), v.sy(4), 7, C.hot);
      text(f, '始态', v.sx(1) - 34, v.sy(4) - 10, { color: C.cool, font: '13px sans-serif' });
      text(f, '末态', v.sx(4) + 10, v.sy(4) - 10, { color: C.hot, font: '13px sans-serif' });
      text(f, 'Q = 0, W = 0 ⇒ ΔU = 0（理想气体）', v.sx(1.2), v.sy(4.5), { color: C.fg, font: '14px serif' });
      text(f, '但 ΔS = nR ln(V₂/V₁) ≠ 0 —— 不可逆!', v.sx(1.2), v.sy(4.1), { color: C.hot, font: '14px serif' });
      text(f, '替身路径：假装慢慢等温膨胀回末态，算它的热', v.sx(1.2), v.sy(3.5), { color: C.green, font: '13px sans-serif' });
      S = '不可逆：状态函数只看首末 —— 找可逆路径当替身';
    } else {
      curve(f, v, (V) => 4 * Math.pow(1.6 / V, 1), { color: C.warm, lw: 2.4, dash: [7, 5] });
      curve(f, v, (V) => 4 * Math.pow(1.6 / V, 1.4), { color: C.pink, lw: 2.8 });
      text(f, '粉 = 绝热可逆 PV^γ（等熵）', v.sx(1.1), v.sy(4.7), { color: C.pink, font: '13px serif' });
      text(f, '橙虚 = 不可逆绝热：S 增加了', v.sx(1.1), v.sy(4.3), { color: C.warm, font: '13px serif' });
      text(f, '摩擦生热：ΔS_总 = ΔS_系统 + ΔS_环境 ≥ 0', v.sx(1.1), v.sy(3.7), { color: C.yellow, font: '14px serif' });
      S = '孤立系 ΔS ≥ 0：克劳修斯不等式的一般形式';
    }
    text(f, 'V (L)', (v.sx(0.5) + v.sx(6)) / 2, h - 56, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'P (atm)', v.sx(0.55), v.sy(4.85), { color: C.dim, font: '12px sans-serif' });
    // 底部：三态熵与温熵图
    text(f, S, 60, h - 116, { color: C.yellow, font: '15px sans-serif' });
    footnotes(f, [
      '熵是状态函数：路径可恶没关系，首末态定生死',
      '气体 ΔS = nC_v ln(T₂/T₁) + nR ln(V₂/V₁) —— 拆成热项与体积项',
      '熵产 σ ≥ 0（第二定律的局域表述）：不可逆程度的定量刻度',
    ]);
    heading(f, '不可逆过程怎么算熵：找替身');
  },
});
registerViz(entropyCalculation);

/** P444 克拉佩龙方程：相图上一条线的斜率。 */
const clapeyronEquation = defineViz({
  slug: 'clapeyron-equation',
  title: '克拉佩龙方程',
  params: { L: { type: 'range', min: 50, max: 400, default: 2260, step: 10, label: '潜热 (kJ/kg, /10)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const Lq = num(params, 'L', 2260) / 10;
    clear(f);
    // 相图 P-T
    const v = view(f, { xMin: -40, xMax: 420, yMin: 0, yMax: 220, inset: 50, insetBottom: 52 });
    grid(f, v);
    // 三相点与临界点
    const tp = [0.01, 0.61], cp = [374, 221];
    // 汽化线（Clausius-Clapeyron 近似 lnP ∝ -1/T）
    const vap: [number, number][] = [];
    for (let i = 1; i <= 60; i++) {
      const T = 0.01 + (i / 60) * (374 - 0.01) + 10;
      const P = 0.61 * Math.exp(17.2 * (T - 273.15) / (T - 38 + 273.15 - 273.15 + 38 - 38));
      // 简化：Antoine 近似
      const Pa = Math.pow(10, 8.07 - 1730.63 / (T - 233.43 + 273.15 - 273.15 + 33));
      vap.push([v.sx(T), v.sy(Math.min(215, Pa * 0.0075))]);
    }
    poly(f, vap, { stroke: C.cool, lw: 2.8 });
    // 熔化线（斜率正，几乎竖直）
    poly(f, [[v.sx(0.01), v.sy(0.61)], [v.sx(-8), v.sy(210)]], { stroke: C.green, lw: 2.6 });
    text(f, '固-液（冰反常：斜率负）', v.sx(-38), v.sy(190), { color: C.green, font: '12px sans-serif' });
    // 升华线
    poly(f, [[v.sx(0.01), v.sy(0.61)], [v.sx(-60 + 30), v.sy(0.1)]], { stroke: C.pink, lw: 2.2 });
    dot(f, v.sx(tp[0]), v.sy(0.61), 6, C.hot);
    text(f, '三相点 0.01°C / 611 Pa', v.sx(0.01) + 10, v.sy(0.61) - 8, { color: C.hot, font: '12px sans-serif' });
    dot(f, v.sx(cp[0]), v.sy(215), 6, C.yellow);
    text(f, '临界点', v.sx(cp[0]) - 60, v.sy(215) - 10, { color: C.yellow, font: '12px sans-serif' });
    text(f, '液-气', v.sx(240), v.sy(90), { color: C.cool, font: '13px sans-serif' });
    // 方程
    text(f, 'dP/dT = L / (T·Δv) ≈ L·ρ/(T·ΔT)', 60, 84, { color: C.fg, font: '16px serif' });
    text(f, `当前 L = ${Lq.toFixed(0)} kJ/kg ⇒ 汽化线斜率随之变化`, 60, 112, { color: C.yellow, font: '14px sans-serif' });
    text(f, '水的汽化：100°C 处 3.6 kPa/K —— 高压锅 120°C 需 2 atm', 60, 140, { color: C.cool, font: '13px sans-serif' });
    text(f, 'T (°C)', (v.sx(-40) + v.sx(420)) / 2, h - 58, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'P (×10 kPa)', v.sx(-38), v.sy(215), { color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      '克拉佩龙：一阶相变通用 —— 斜率由潜热与体积差决定，无需知道细节机制',
      'Clausius-Clapeyron（气相近似）：d lnP/dT = L/(RT²) —— 定压不纯净水的沸点公式',
      '应用：天气（气压降 → 沸点降）、行星（火星 CO₂ 冰盖升华）、寒带发动机',
    ]);
    heading(f, '压力如何抬高熔沸点');
  },
});
registerViz(clapeyronEquation);

/** P445 菲涅耳衍射与半波带：泊松亮斑的定量版。 */
const fresnelDiffraction = defineViz({
  slug: 'fresnel-diffraction',
  title: '菲涅耳衍射与半波带',
  params: { zones: { type: 'range', min: 1, max: 12, default: 6, step: 1, label: '半波带数' } },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'zones', 6));
    clear(f);
    // 左：圆盘与同心半波带
    const cx = w * 0.3, cy = h * 0.44;
    circle(f, cx, cy, 168, { stroke: C.grid, lw: 1.6, dash: [6, 5] });
    for (let k = 1; k <= n; k++) {
      const r = Math.sqrt(k) * 62;
      const alt = k % 2 === 0;
      circle(f, cx, cy, r, { stroke: alt ? C.cool : C.warm, lw: 2.2, fill: alt ? 'rgba(66,153,225,0.10)' : 'rgba(237,137,54,0.10)' });
      if (k <= 6) {
        text(f, `z${k}`, cx + r - 22, cy - 6, { color: alt ? C.cool : C.warm, font: '12px sans-serif' });
      }
    }
    text(f, `半波带：相邻带程差 λ/2 ⇒ 相位差 π`, cx, cy + 196, { align: 'center', color: C.fg, font: '13px sans-serif' });
    text(f, '不透明屏遮住奇数带 → 剩余带同相叠加', cx, cy + 218, { align: 'center', color: C.yellow, font: '13px sans-serif' });
    // 右：振幅矢量合成（考纽螺线简化为矢量链）
    const bx = w * 0.66, by = h * 0.4;
    let ax = bx - 90, ay = by + 70;
    let angle = -0.9;
    const decay = 0.9;
    const pts: [number, number][] = [[ax, ay]];
    for (let k = 0; k < n + 2; k++) {
      const len = 120 * Math.pow(decay, k * 0.4) / (1 + k * 0.14);
      angle += Math.PI * 0.34;
      ax += Math.cos(angle) * len;
      ay += Math.sin(angle) * len;
      pts.push([ax, ay]);
      dot(f, ax, ay, 4, k % 2 === 0 ? C.warm : C.cool);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.4 });
    // 合成
    seg(f, bx - 90, by + 70, ax, ay, C.hot, 2.8);
    text(f, `合成振幅（n = ${n}）`, ax + 8, ay - 4, { color: C.hot, font: '13px sans-serif' });
    text(f, '屏上轴点：所有带矢量螺旋相加', bx - 130, by - 96, { color: C.fg, font: '14px sans-serif' });
    // 中心亮暗交替
    const bright = n % 2 !== 0;
    circle(f, bx + 110, by + 130, 30, { fill: bright ? `rgba(236,201,75,${0.4 + 0.4 * Math.sin(f.t * 3)})` : 'rgba(13,17,23,0.9)', stroke: bright ? C.yellow : C.grid, lw: 2 });
    text(f, bright ? '轴上亮' : '轴上暗', bx + 110, by + 178, { align: 'center', color: bright ? C.yellow : C.dim, font: '13px sans-serif' });
    footnotes(f, [
      '菲涅尔衍射：近场，波前分成环带，程差 λ/2 —— 计算从"硬积分"变"加法"',
      '泊松亮斑 (1818)：圆盘阴影中心意外全亮 —— 阿拉戈实验证实波动说获胜',
      '波带片：只留奇数带 → 聚焦（X 射线显微镜没有好透镜，靠它）',
    ]);
    heading(f, '半波带分割：衍射的定量算法');
  },
});
registerViz(fresnelDiffraction);

/** P446 阿贝成像与空间频率：频谱面滤波。 */
const abbeImaging = defineViz({
  slug: 'abbe-imaging',
  title: '阿贝成像与空间频率',
  params: { filter: { type: 'select', options: ['全部通过', '低通(去细节)', '高通(去轮廓)', '带通(边缘)'], default: '全部通过', label: '频谱滤波' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = String(params['filter'] ?? '全部通过');
    clear(f);
    // 三段式：物体 → 频谱面 → 像
    const colW = (w - 80) / 3;
    const y0 = 96, bh = h * 0.46;
    // 1. 物（光栅 + 图形）
    const ox = 40;
    poly(f, [[ox, y0], [ox + colW, y0], [ox + colW, y0 + bh], [ox, y0 + bh]], { stroke: C.grid, lw: 1.6, fill: '#0d1117' });
    for (let i = 0; i < 20; i++) {
      if (i % 2) continue;
      const x = ox + 6 + i * ((colW - 12) / 20);
      poly(f, [[x, y0 + 6], [x + (colW - 12) / 20, y0 + 6], [x + (colW - 12) / 20, y0 + bh - 6], [x, y0 + bh - 6]],
        { fill: 'rgba(226,232,240,0.55)' });
    }
    text(f, '① 物 f(x,y)', ox, y0 - 14, { color: C.fg, font: '14px sans-serif' });
    // 2. 频谱面
    const sx0 = 40 + colW + 40;
    poly(f, [[sx0, y0], [sx0 + colW, y0], [sx0 + colW, y0 + bh], [sx0, y0 + bh]], { stroke: C.grid, lw: 1.6, fill: '#0d1117' });
    const scx = sx0 + colW / 2, scy = y0 + bh / 2;
    dot(f, scx, scy, 8, C.yellow);
    for (let k = 1; k <= 5; k++) {
      for (const sgn of [1, -1]) {
        const x = scx + sgn * k * 34;
        const pass = mode === '全部通过'
          || (mode === '低通(去细节)' && k <= 2)
          || (mode === '高通(去轮廓)' && k >= 2)
          || (mode === '带通(边缘)' && k >= 2 && k <= 3);
        circle(f, x, scy, 7, { fill: pass ? C.cool : 'rgba(58,74,99,0.9)', stroke: pass ? C.cool : C.grid, lw: 1.6 });
        if (!pass) {
          seg(f, x - 5, scy - 5, x + 5, scy + 5, C.hot, 2);
          seg(f, x + 5, scy - 5, x - 5, scy + 5, C.hot, 2);
        }
      }
    }
    text(f, '② 频谱面 F(u,v)', sx0, y0 - 14, { color: C.fg, font: '14px sans-serif' });
    text(f, '衍射 = 一次傅里叶变换', sx0, y0 + bh + 24, { color: C.cool, font: '13px sans-serif' });
    // 3. 像（按滤波模式渲染）
    const ix0 = 40 + (colW + 40) * 2;
    poly(f, [[ix0, y0], [ix0 + colW, y0], [ix0 + colW, y0 + bh], [ix0, y0 + bh]], { stroke: C.grid, lw: 1.6, fill: '#0d1117' });
    const contrast = mode === '低通(去细节)' ? 0.25 : 1;
    const edges = mode === '高通(去轮廓)' || mode === '带通(边缘)';
    const blur = mode === '低通(去细节)' ? 6 : 0;
    for (let i = 0; i < 20; i++) {
      if (i % 2) continue;
      const x = ix0 + 6 + i * ((colW - 12) / 20);
      if (edges) {
        const xx = x - blur;
        poly(f, [[xx, y0 + 6], [xx + 3, y0 + 6], [xx + 3, y0 + bh - 6], [xx, y0 + bh - 6]], { fill: C.cyan });
        poly(f, [[x + (colW - 12) / 20 - 3, y0 + 6], [x + (colW - 12) / 20, y0 + 6], [x + (colW - 12) / 20, y0 + bh - 6], [x + (colW - 12) / 20 - 3, y0 + bh - 6]], { fill: C.cyan });
      } else {
        poly(f, [[x - blur, y0 + 6], [x + (colW - 12) / 20 + blur, y0 + 6], [x + (colW - 12) / 20 + blur, y0 + bh - 6], [x - blur, y0 + bh - 6]],
          { fill: `rgba(226,232,240,${0.15 + contrast * 0.5})` });
      }
    }
    text(f, '③ 像 g(x,y)', ix0, y0 - 14, { color: C.fg, font: '14px sans-serif' });
    text(f, '干涉 = 再变换 = 成像', ix0, y0 + bh + 24, { color: C.pink, font: '13px sans-serif' });
    // 底部：阿贝公式
    text(f, 'd = λ/(2·NA)：分辨率上限由频谱面截断决定', 40, y0 + bh + 76, { color: C.yellow, font: '16px serif' });
    text(f, '空间频率 = 细节粗细：挡住高频 = 挡住细节；挡住零频 = 只剩轮廓', 40, y0 + bh + 106, { color: C.fg, font: '14px sans-serif' });
    footnotes(f, [
      '阿贝 (1873)：成像两步 —— 衍射（物→频谱）+ 干涉（频谱→像），缺一不成像',
      '阿贝极限正是"第二步丢了多少高频"的表述；相衬显微镜靠相位板改频谱相位',
      '4f 系统、光信息处理、全息：都是在频谱面上做文章',
    ]);
    heading(f, '成像分两步：衍射再干涉');
  },
});
registerViz(abbeImaging);

/** P447 光栅分辨本领与缺级：三个指标。 */
const gratingResolvingPower = defineViz({
  slug: 'grating-resolving-power',
  title: '光栅分辨本领与缺级',
  params: { N: { type: 'range', min: 5, max: 100, default: 30, step: 5, label: '光栅线数 N' } },
  draw: (f) => {
    const { w, h, params } = f;
    const N = Math.round(num(params, 'N', 30));
    clear(f);
    // 衍射强度 I(θ) = [sin(Nγ)/sinγ]²，γ = πa(sinθ)/λ
    const v = view(f, { xMin: -6, xMax: 6, yMin: 0, yMax: 1.15, inset: 50, insetBottom: 52 });
    grid(f, v);
    const I = (u: number) => {
      const g = (Math.PI * u) / 1;
      if (Math.abs(Math.sin(g)) < 1e-9) return 1;
      const s = Math.sin(N * g) / (N * Math.sin(g));
      return s * s;
    };
    const pts: [number, number][] = [];
    for (let i = 0; i <= 900; i++) {
      const u = -6 + (i / 900) * 12;
      pts.push([v.sx(u), v.sy(Math.min(1.1, I(u)))]);
    }
    poly(f, pts, { stroke: C.cool, lw: 1.6 });
    // 主极大位置 u = k（0, ±1, ±2...）；缺级当 a = 2d：k = 2 处缺
    for (const k of [-4, -3, -2, -1, 0, 1, 2, 3, 4]) {
      const missing = Math.abs(k) === 2;
      if (missing) {
        seg(f, v.sx(k), v.sy(0), v.sx(k), v.sy(1.05), `${C.hot}aa`, 1.6);
        text(f, '缺级', v.sx(k) + 6, v.sy(0.95), { color: C.hot, font: '12px sans-serif' });
      } else {
        dot(f, v.sx(k), v.sy(1.0), 4.6, C.yellow);
      }
    }
    // 分辨双线：波长差 Δλ = λ/(kN)
    const dlambda = 1 / (3 * N);
    text(f, `分辨极限 Δλ = λ/(kN)：k=3 处 Δλ/λ = ${dlambda.toFixed(4)}`, v.sx(-5.8), v.sy(1.1), { color: C.green, font: '13px serif' });
    text(f, `角色散 dθ/dλ = k/(d·cosθ) —— N 不管色散，只管峰锐度`, v.sx(-5.8), v.sy(1.02), { color: C.cool, font: '13px serif' });
    text(f, 'u = (πd sinθ)/λ', (v.sx(-6) + v.sx(6)) / 2, h - 56, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'I/I₀', v.sx(-6) + 4, v.sy(1.1), { color: C.dim, font: '12px sans-serif' });
    // 底部：三个量
    text(f, `光栅方程 d sinθ = kλ ｜ 分辨 R = kN = ${3 * N} ｜ 缺级 d/a = 2 ⇒ k = 2,4,6… 消失`, 60, h - 104, { color: C.yellow, font: '15px serif' });
    footnotes(f, [
      '峰宽 ∝ 1/N：线越多，主极大越细 —— 分辨本领来自"多缝干涉更挑剔"',
      '双线分辨判据：一峰极大落在另一峰极小上（瑞利判据的光栅版）',
      '闪耀光栅：把能量从零级搬到一级 —— 光谱仪效率的关键工艺',
    ]);
    heading(f, '分得开与数得清：色散、分辨与缺级');
  },
});
registerViz(gratingResolvingPower);

/** P448 显微镜与分辨极限：数值孔径。 */
const microscopeResolution = defineViz({
  slug: 'microscope-resolution',
  title: '显微镜与分辨极限',
  params: { na: { type: 'range', min: 0.1, max: 1.4, default: 0.65, step: 0.05, label: '数值孔径 NA' } },
  draw: (f) => {
    const { w, h, params } = f;
    const NA = num(params, 'na', 0.65);
    clear(f);
    const lam = 550; // nm
    const d = (lam / (2 * NA)); // nm
    // 左：两个点的艾里斑
    const cx = w * 0.3, cy = h * 0.42;
    const sepPx = Math.max(6, 120 / NA * 0.6);
    const drawAiry = (x0: number, y0: number, scale: number) => {
      for (let r = 30; r >= 2; r -= 2) {
        const alpha = r <= 4 ? 0.85 : 0.3 * Math.exp(-r / 14);
        circle(f, x0, y0, r * scale, { fill: `rgba(236,201,75,${alpha})` });
      }
      dot(f, x0, y0, 3 * scale, '#fffbe6');
    };
    drawAiry(cx - sepPx / 2, cy, 1);
    drawAiry(cx + sepPx / 2, cy, 1);
    const resolved = NA > 0.45;
    text(f, resolved ? '两点可分辨 ✓' : '两点糊成一团 ✗', cx, cy + 120, { align: 'center', color: resolved ? C.green : C.hot, font: '15px sans-serif' });
    text(f, `d = 0.61λ/NA ≈ ${d.toFixed(0)} nm`, cx, cy + 148, { align: 'center', color: C.fg, font: '14px serif' });
    // 右：物镜锥与油浸
    const bx = w * 0.74;
    seg(f, bx - 90, h * 0.66, bx + 90, h * 0.66, C.cool, 4);
    text(f, '物镜前透镜', bx, h * 0.66 + 24, { align: 'center', color: C.cool, font: '13px sans-serif' });
    const sinTheta = Math.min(0.99, NA / 1.33);
    const halfAngle = Math.asin(sinTheta);
    const lensY = h * 0.66;
    const objY = h * 0.4;
    poly(f, [[bx, lensY], [bx - Math.tan(halfAngle) * (lensY - objY), objY], [bx + Math.tan(halfAngle) * (lensY - objY), objY]],
      { fill: 'rgba(236,201,75,0.14)', stroke: C.yellow, lw: 1.6 });
    circle(f, bx, objY, 8, { fill: C.hot });
    text(f, 'θ', bx + Math.tan(halfAngle) * (lensY - objY) * 0.6, objY + 46, { color: C.yellow, font: '14px serif' });
    // 折射
    if (NA > 1) {
      text(f, '油浸 n=1.515：θ 可 > 空气极限', bx - 130, lensY + 54, { color: C.green, font: '13px sans-serif' });
    }
    text(f, `NA = n·sinθ = ${NA.toFixed(2)}`, bx - 60, objY - 44, { color: C.yellow, font: '15px serif' });
    // 刻度尺
    text(f, '放大 ≠ 看清：电子显微镜 λ~pm ⇒ 突破光学极限', 56, h - 96, { color: C.pink, font: '15px sans-serif' });
    footnotes(f, [
      '阿贝 (1873)：光学显微镜分辨率天花板 d ≈ λ/(2NA) —— 再放大也只是空放大',
      'NA = n·sin(θ/2) 简写 n·sinθ；油浸提高 n 并增大收集角，NA 可达 1.4',
      '超分辨（2014 诺奖）：STED/PALM 用荧光开关绕过衍射极限 ~20 nm',
    ]);
    heading(f, '放大不等于看清：阿贝判据封顶');
  },
});
registerViz(microscopeResolution);

/** P449 光程与费马原理：折射定律的变分写法。 */
const opticalPathLength = defineViz({
  slug: 'optical-path-length',
  title: '光程与费马原理',
  params: { n: { type: 'range', min: 1, max: 2.2, default: 1.5, step: 0.05, label: '下方介质 n' } },
  draw: (f) => {
    const { w, h, params } = f;
    const n = num(params, 'n', 1.5);
    clear(f);
    // 界面
    const iy = h * 0.5;
    seg(f, 40, iy, w - 40, iy, C.cool, 2.4);
    poly(f, [[40, iy], [w - 40, iy], [w - 40, h - 70], [40, h - 70]], { fill: 'rgba(66,153,225,0.12)' });
    text(f, 'n₁ = 1', 52, iy - 14, { color: C.dim, font: '13px sans-serif' });
    text(f, `n₂ = ${n.toFixed(2)}`, 52, iy + 26, { color: C.cool, font: '13px sans-serif' });
    // 源与目标
    const sx = w * 0.2, sy = h * 0.18;
    const tx = w * 0.78, ty = h * 0.84;
    dot(f, sx, sy, 7, C.hot);
    dot(f, tx, ty, 7, C.green);
    text(f, 'A', sx - 16, sy + 2, { color: C.hot, font: '15px serif' });
    text(f, 'B', tx + 12, ty + 4, { color: C.green, font: '15px serif' });
    // 折射点候选（试几条路径展示费马取极值）
    const cands = [0.3, 0.45, 0.58, 0.72];
    let best = 1e18, bestX = 0;
    for (const frac of cands) {
      const xi = 40 + frac * (w - 80);
      const L1 = Math.hypot(xi - sx, iy - sy);
      const L2 = Math.hypot(tx - xi, ty - iy);
      const OPL = L1 + n * L2;
      if (OPL < best) { best = OPL; bestX = xi; }
    }
    // 实际折射点（斯涅尔）
    // 由 sinθ1 = n sinθ2 数值求解
    let lo = 40, hi = w - 40, xi = 0;
    for (let it = 0; it < 40; it++) {
      xi = (lo + hi) / 2;
      const s1 = (xi - sx) / Math.hypot(xi - sx, iy - sy);
      const s2 = (xi - tx) / Math.hypot(xi - tx, ty - iy);
      if (s1 - n * s2 > 0) lo = xi; else hi = xi;
    }
    // 画候选路径（虚线）
    for (const frac of cands) {
      const px = 40 + frac * (w - 80);
      seg(f, sx, sy, px, iy, `${C.grid}cc`, 1.4);
      seg(f, px, iy, tx, ty, `${C.grid}cc`, 1.4);
    }
    // 真实路径
    seg(f, sx, sy, xi, iy, C.yellow, 3);
    seg(f, xi, iy, tx, ty, C.yellow, 3);
    dot(f, xi, iy, 7, C.yellow);
    // 法线
    seg(f, xi, iy - 60, xi, iy + 60, `${C.dim}aa`, 1.4);
    // 角度
    text(f, 'θ₁', xi - 24, iy - 40, { color: C.fg, font: '14px serif' });
    text(f, 'θ₂', xi + 8, iy + 52, { color: C.fg, font: '14px serif' });
    text(f, `n₁ sinθ₁ = n₂ sinθ₂（n=${n.toFixed(2)} 时最快）`, sx - 10, sy + 44, { color: C.yellow, font: '15px serif' });
    // 光程表达
    text(f, '光程 OPL = n·L：介质中 1 米 = 真空 n 米的时间', 56, h - 96, { color: C.fg, font: '15px serif' });
    text(f, `虚线候选：只有 OPL 极值（驻值）的那条是光实际走的`, 56, h - 72, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '费马原理：δ∫n ds = 0 —— 光"选择"光程极值路径（极大、极小或鞍点）',
      '折射、反射、透镜聚焦、梯度折射率：全部是同一个变分原理的特例',
      '与最小作用量同源：几何光学 = 经典力学的 WKB 极限',
    ]);
    heading(f, '光永远走最省时的路');
  },
});
registerViz(opticalPathLength);