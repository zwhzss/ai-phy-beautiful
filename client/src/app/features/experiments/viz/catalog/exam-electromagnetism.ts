import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text, view, grid, curve, circle, vec, rng } from '../canvas';

/** P481 柱对称高斯定理。 */
const cylindricalGaussLaw = defineViz({
  slug: 'cylindrical-gauss-law',
  title: '柱对称高斯定理',
  params: { r: { type: 'range', min: 5, max: 160, default: 80, step: 5, label: '高斯面半径 r' } },
  draw: (f) => {
    const { w, h, params } = f;
    const R = num(params, 'r', 80);
    clear(f);
    // 左：横截面（带电直线 + 圆柱高斯面）
    const cx = w * 0.28, cy = h * 0.44;
    // 电荷线（垂直纸面）
    circle(f, cx, cy, 9, { fill: C.hot, stroke: C.hot, lw: 2 });
    text(f, 'λ ⊙', cx + 16, cy - 12, { color: C.hot, font: '14px serif' });
    // 场线
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      vec(f, cx + Math.cos(a) * 16, cy + Math.sin(a) * 16, cx + Math.cos(a) * 168, cy + Math.sin(a) * 168, `rgba(66,153,225,0.5)`, 1.8, 7);
    }
    // 高斯面（虚线圆，半径随参数）
    const { ctx } = f;
    ctx.save();
    ctx.strokeStyle = C.green;
    ctx.lineWidth = 2.4;
    ctx.setLineDash([9, 7]);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    text(f, 'r', cx + R * 0.7, cy - R * 0.7, { color: C.green, font: '15px serif' });
    text(f, '高斯面 S（柱面侧）', cx - 70, cy + R + 28, { align: 'center', color: C.green, font: '13px serif' });
    // 右：E(r) 曲线
    const v = view(f, { xMin: 0, xMax: 200, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 46 });
    grid(f, v);
    curve(f, v, (x) => (x < 12 ? NaN : Math.min(1.05, 10 / x)), { color: C.accent, lw: 2.8 });
    const E = R < 12 ? 1 : Math.min(1.05, 10 / R);
    dot(f, v.sx(R), v.sy(E), 7, C.hot);
    text(f, `E(r) = λ/(2πε₀r)　当前 E = ${E.toFixed(3)}`, v.sx(30), v.sy(1.02), { color: C.fg, font: '14px serif' });
    text(f, 'E ∝ 1/r（线电荷），与面电荷的 1/r² 不同档', v.sx(30), v.sy(0.92), { color: C.yellow, font: '13px serif' });
    text(f, 'r', (v.sx(0) + v.sx(200)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'E', v.sx(4), v.sy(1.06), { color: C.dim, font: '12px sans-serif' });
    // 推导账本
    text(f, '∮E·dS = E·2πrL = λL/ε₀ ⇒ E = λ/(2πε₀r)', 52, h - 116, { color: C.fg, font: '15px serif' });
    text(f, '对称性三问：E 什么方向？何处恒定？通量只算哪块？', 52, h - 88, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '高斯定理对任何电荷分布成立，但只有球/柱/平面对称才能"算出" E',
      '无限长带电直线：侧面通量=全部，两端面 E⊥dS=0 —— 选面即答案',
      '带电导体内部 E=0 是高斯定理+静电平衡的联合推论',
    ]);
    heading(f, '柱面一画，积分变除法');
  },
});
registerViz(cylindricalGaussLaw);

/** P482 法拉第定律与楞次方向。 */
const faradayLenzLaw = defineViz({
  slug: 'faraday-lenz-law',
  title: '法拉第定律与楞次方向',
  params: { mode: { type: 'select', options: ['磁铁插入', '磁铁拔出', '面积变化'], default: '磁铁插入', label: '操作' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = str(params, 'mode', '磁铁插入');
    clear(f);
    // 线圈
    const cx = w * 0.5, cy = h * 0.5, R = 120;
    const { ctx } = f;
    ctx.save();
    ctx.strokeStyle = C.warm;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.ellipse(cx, cy, R, R * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    const phase = Math.sin(f.t * 3) * 0.5 + 0.5;
    let dPhiSign = 1;
    let label = '';
    if (mode === '磁铁插入') {
      const t = (Math.sin(f.t * 1.2) * 0.5 + 0.5);
      const nx = cx - 200 + t * 140;
      poly(f, [[nx, cy - 26], [nx + 96, cy - 26], [nx + 96, cy + 26], [nx, cy + 26]], { fill: C.cool, stroke: C.cool, lw: 2 });
      poly(f, [[nx + 96, cy - 26], [nx + 140, cy - 26], [nx + 140, cy + 26], [nx + 96, cy + 26]], { fill: C.hot, stroke: C.hot, lw: 2 });
      text(f, 'N', nx + 118, cy + 5, { align: 'center', color: C.bg, font: '15px serif' });
      text(f, 'S', nx + 46, cy + 5, { align: 'center', color: C.bg, font: '15px serif' });
      for (let i = 0; i < 4; i++) {
        vec(f, nx + 148, cy - 30 + i * 20, cx - R + 6, cy - 30 + i * 20, `rgba(66,153,225,${0.4 + phase * 0.4})`, 2, 7);
      }
      dPhiSign = 1;
      label = 'Φ 增加 ⇒ 感应磁场反向阻挡（向左）';
    } else if (mode === '磁铁拔出') {
      const t = (Math.sin(f.t * 1.2) * 0.5 + 0.5);
      const nx = cx + 60 + t * 180;
      poly(f, [[nx, cy - 26], [nx + 96, cy - 26], [nx + 96, cy + 26], [nx, cy + 26]], { fill: C.cool, stroke: C.cool, lw: 2 });
      poly(f, [[nx + 96, cy - 26], [nx + 140, cy - 26], [nx + 140, cy + 26], [nx + 96, cy + 26]], { fill: C.hot, stroke: C.hot, lw: 2 });
      for (let i = 0; i < 4; i++) {
        vec(f, cx + R - 6, cy - 30 + i * 20, nx + 6, cy - 30 + i * 20, `rgba(66,153,225,${0.4 + phase * 0.4})`, 2, 7);
      }
      dPhiSign = -1;
      label = 'Φ 减少 ⇒ 感应磁场同向补偿（向右拉）';
    } else {
      const scale = 0.6 + 0.4 * (Math.sin(f.t * 1.4) * 0.5 + 0.5);
      ctx.save();
      ctx.strokeStyle = C.warm;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.ellipse(cx, cy, R * scale, R * 0.5 * scale, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      dPhiSign = Math.cos(f.t * 1.4) > 0 ? 1 : -1;
      label = `面积变化 ⇒ dΦ/dt ${dPhiSign > 0 ? '正（反向感应）' : '负（同向感应）'}`;
    }
    // 感应电流方向箭头
    const dir = mode === '磁铁拔出' ? -dPhiSign : dPhiSign;
    for (const a of [0.3, 2.4, 4.4]) {
      const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.5;
      const tangent = a + Math.PI / 2 * (dir > 0 ? 1 : -1);
      vec(f, x, y, x + Math.cos(tangent) * 40, y + Math.sin(tangent) * 40, C.green, 3, 8);
    }
    text(f, `感应电流方向（绿）：${dPhiSign > 0 ? '逆时针（俯视）' : '顺时针（俯视）'}`, cx - 130, cy + R * 0.5 + 60, { color: C.green, font: '14px sans-serif' });
    // 公式
    text(f, 'ε = −dΦ/dt　负号就是楞次定律', 52, 84, { color: C.fg, font: '16px serif' });
    text(f, label, 52, 116, { color: C.yellow, font: '14px sans-serif' });
    text(f, '磁通链 Ψ = NΦ：匝数直接乘进感应电动势', 52, h - 96, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '感应电场是涡旋场：∮E·dl = −dΦ/dt —— 静电势概念在此失效',
      '负号=能量守恒：若感应电流助增磁通就成了永动机（楞次=热力学第二定律的电路版）',
      '动生与感生电动势：洛伦兹力版本与麦克斯韦电场版本，统一于法拉第定律',
    ]);
    heading(f, '先定正方向再取负号');
  },
});
registerViz(faradayLenzLaw);

/** P483 电偶极子的电场与势。 */
const electricDipoleField = defineViz({
  slug: 'electric-dipole-field',
  title: '电偶极子的电场与势',
  params: { view2: { type: 'select', options: ['电场线', '等势面', '轴向/赤道曲线'], default: '电场线', label: '视图' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = str(params, 'view2', '电场线');
    clear(f);
    const cx = w * 0.4, cy = h * 0.46, d = 70;
    if (mode === '电场线') {
      // ±q
      circle(f, cx, cy - d, 14, { fill: C.hot, stroke: C.hot, lw: 2 });
      circle(f, cx, cy + d, 14, { fill: C.cool, stroke: C.cool, lw: 2 });
      text(f, '+q', cx + 20, cy - d + 4, { color: C.hot, font: '14px serif' });
      text(f, '−q', cx + 20, cy + d + 4, { color: C.cool, font: '14px serif' });
      // 偶极场线（解析绘制近似）
      for (const n of [-3, -2, -1, 1, 2, 3]) {
        const pts: Array<[number, number]> = [];
        for (let i = 0; i <= 60; i++) {
          const s = i / 60;
          // 从 +q 出发弯向 −q 的弧线族近似
          const ang = n * 0.55;
          const rr = 26 + s * 300;
          const bend = Math.sin(s * Math.PI) * n * 34;
          pts.push([cx + Math.sin(ang) * rr * 0.75 + bend * 0.4, cy - d + s * 2 * d + bend]);
        }
        poly(f, pts, { stroke: `rgba(66,153,225,${0.75 - Math.abs(n) * 0.12})`, lw: 1.8 });
      }
      // 近轴直连线
      for (const off of [0, 26, -26]) {
        seg(f, cx + off, cy - d + 16, cx + off, cy + d - 16, `rgba(66,153,225,0.6)`, 1.6);
      }
      text(f, '场线从 +q 出发终止于 −q（闭合回路经无穷远）', 46, h - 148, { color: C.fg, font: '14px sans-serif' });
    } else if (mode === '等势面') {
      // 势云图（色块）
      const cell = 18;
      for (let gx = -14; gx <= 14; gx++) {
        for (let gy = -10; gy <= 10; gy++) {
          const x = gx * cell, y = gy * cell;
          const r1 = Math.hypot(x, y + d) + 6;
          const r2 = Math.hypot(x, y - d) + 6;
          const phi = 1 / r1 - 1 / r2;
          const k = Math.max(-1, Math.min(1, phi * 3.4));
          const { ctx } = f;
          ctx.fillStyle = k > 0 ? `rgba(245,101,101,${Math.abs(k) * 0.75})` : `rgba(66,153,225,${Math.abs(k) * 0.75})`;
          ctx.fillRect(cx + x - cell / 2, cy + y - cell / 2, cell - 1.5, cell - 1.5);
        }
      }
      circle(f, cx, cy - d, 9, { fill: C.hot });
      circle(f, cx, cy + d, 9, { fill: C.cool });
      text(f, '红=正电势区　蓝=负电势区　中垂面 Φ=0（接地参考面）', 46, h - 148, { color: C.fg, font: '14px sans-serif' });
      text(f, 'Φ = p·cosθ/(4πε₀r²)：角向不对称是偶极势的灵魂', 46, h - 120, { color: C.yellow, font: '14px serif' });
    } else {
      const v = view(f, { xMin: -4, xMax: 4, yMin: -1.4, yMax: 1.4, inset: 46, insetBottom: 46 });
      grid(f, v);
      // 轴向 E ~ 1/r³，赤道 Φ ~ 1/r²
      curve(f, v, (x) => (Math.abs(x) < 0.5 ? NaN : Math.min(1.35, 2 / (Math.pow(Math.abs(x), 3) * 0.9))), { color: C.hot, lw: 2.6 });
      curve(f, v, (x) => (Math.abs(x) < 0.5 ? NaN : -Math.min(1.35, 2 / (Math.pow(Math.abs(x), 3) * 0.9))), { color: C.cool, lw: 2.2 });
      text(f, '红：轴线上 E（2p/r³，与 p 同向）', v.sx(-3.8), v.sy(1.25), { color: C.hot, font: '13px serif' });
      text(f, '蓝：赤道面上 E（−p/r³，与 p 反向）', v.sx(-3.8), v.sy(1.1), { color: C.cool, font: '13px serif' });
      text(f, '两侧反号=场方向相反；|E| 都按 1/r³ 掉', v.sx(-3.8), v.sy(-1.15), { color: C.yellow, font: '13px serif' });
      text(f, '对比单极：Φ~1/r、E~1/r² —— 偶极高频快一档', v.sx(-3.8), v.sy(-1.3), { color: C.dim, font: '13px serif' });
      text(f, 'r（沿轴/赤道）', (v.sx(-4) + v.sx(4)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    }
    footnotes(f, [
      'p = qd 从 −q 指向 +q：远场一切中性分子对外都像一个小偶极',
      '势 1/r²、场 1/r³：多极展开第二级 —— 再高（四极）衰减更快',
      '范德华力=瞬时偶极-诱导偶极（~1/r⁶ 能量）、天线辐射=振荡偶极（电动力学重头戏）',
    ]);
    heading(f, '远场衰减比单极快一档');
  },
});
registerViz(electricDipoleField);

/** P484 电势的多极展开。 */
const potentialMultipoleExpansion = defineViz({
  slug: 'potential-multipole-expansion',
  title: '电势的多极展开',
  params: { term: { type: 'select', options: ['单极', '+偶极', '+四极', '全展开'], default: '+偶极', label: '展开到' } },
  draw: (f) => {
    const { w, h, params } = f;
    const term = str(params, 'term', '+偶极');
    clear(f);
    // 上：原电荷分布（+q 在上，−q 在下，外加远处观察点）
    const cx = w * 0.32, cy = h * 0.4;
    circle(f, cx, cy - 40, 13, { fill: C.hot });
    circle(f, cx, cy + 40, 13, { fill: C.cool });
    text(f, '+q', cx + 18, cy - 36, { color: C.hot, font: '13px serif' });
    text(f, '−q', cx + 18, cy + 44, { color: C.cool, font: '13px serif' });
    // 观察点
    const ox = cx + 300, oy = cy - 90;
    dot(f, ox, oy, 7, C.green);
    text(f, 'P(r, θ)', ox + 12, oy + 4, { color: C.green, font: '14px serif' });
    seg(f, cx, cy, ox, oy, `${C.dim}aa`, 1.4);
    seg(f, cx, cy - 40, ox, oy, `${C.hot}66`, 1.2);
    seg(f, cx, cy + 40, ox, oy, `${C.cool}66`, 1.2);
    text(f, 'r', (cx + ox) / 2, (cy + oy) / 2 - 8, { color: C.dim, font: '13px serif' });
    // 右：级数逐项
    const bx = w * 0.62;
    const terms = [
      ['单极项', 'q/(4πε₀r)', '总电荷（本例为 0）', 1],
      ['偶极项', 'p·cosθ/(4πε₀r²)', 'p = qd，角向不对称', 2],
      ['四极项', '∝ 1/r³', '形变与不对称的修正', 3],
    ] as Array<[string, string, string, number]>;
    let level = 1;
    if (term === '+偶极') level = 2;
    else if (term === '+四极') level = 3;
    else if (term === '全展开') level = 4;
    terms.forEach(([name, expr, note, lv], i) => {
      const active = i < level;
      const y = 96 + i * 74;
      poly(f, [[bx, y], [bx + 320, y], [bx + 320, y + 60], [bx, y + 60]],
        { fill: active ? 'rgba(102,126,234,0.25)' : 'rgba(45,55,72,0.5)', stroke: active ? C.accent : C.grid, lw: active ? 2 : 1.2 });
      text(f, name, bx + 14, y + 24, { color: active ? C.yellow : C.dim, font: '15px sans-serif' });
      text(f, expr, bx + 120, y + 24, { color: active ? C.fg : C.dim, font: '14px serif' });
      text(f, note, bx + 14, y + 48, { color: active ? C.cool : C.dim, font: '12px sans-serif' });
    });
    // 收敛性
    text(f, 'r ≫ d 时逐级收敛：级数在近场发散、远场是唯一合理工具', bx, 96 + 3 * 74 + 24, { color: C.green, font: '14px sans-serif' });
    // 底部：本例的净效果
    const showQuad = level >= 3;
    text(f, level === 1
      ? 'q_total = 0 ⇒ 单极项为零，展开从偶极起步'
      : level === 2
        ? '偶极主导：Φ = p cosθ/(4πε₀r²)，这就是中性分子的远场'
        : showQuad ? '四极修正上线：分子非球形（如 CO₂ 直线形）由它刻画' : '', 56, h - 124, { color: C.fg, font: '15px sans-serif' });
    text(f, '通式：Φ(r) = Σ_l (1/r^{l+1}) · Σ_i q_i r_i^l P_l(cosγ_i)', 56, h - 96, { color: C.yellow, font: '15px serif' });
    text(f, '球谐语言：同一套展开在量子力学里变成 Y_lm（角动量的谱）', 56, h - 68, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '把 1/|r−r′| 按 (r′/r) 的幂展开 —— 远场逐级压低一档 r',
      '球谐展开系数=多极矩：单极（q）、偶极（p）、四极（Q）、八极……',
      '核四极矩共振、引力波四极辐射、天线方向图：同一数学不同物理',
    ]);
    heading(f, '把复杂源逐级拆成可算的壳');
  },
});
registerViz(potentialMultipoleExpansion);

/** P485 RL 电路的暂态过程。 */
const rlCircuitTransient = defineViz({
  slug: 'rl-circuit-transient',
  title: 'RL 电路的暂态过程',
  params: { R: { type: 'range', min: 1, max: 50, default: 10, step: 1, label: '电阻 R (Ω)' }, L: { type: 'range', min: 0.1, max: 5, default: 1, step: 0.1, label: '电感 L (H)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const R = num(params, 'R', 10), L = num(params, 'L', 1);
    const tau = L / R;
    clear(f);
    // 电路图（左）
    const bx = 60, by = 100, bw = 260, bh = 150;
    poly(f, [[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]], { stroke: C.grid, lw: 2 });
    // 电池
    seg(f, bx, by + 60, bx, by + 90, C.warm, 4);
    seg(f, bx - 10, by + 70, bx + 10, by + 70, C.warm, 4);
    text(f, 'ε', bx - 24, by + 80, { color: C.warm, font: '15px serif' });
    // 开关（动画闭合）
    const closed = (f.t * 0.6) % 1 > 0.3;
    const swx = bx + bw / 2;
    if (closed) {
      seg(f, swx - 20, by, swx + 20, by, C.green, 3);
    } else {
      seg(f, swx - 20, by, swx + 14, by - 22, C.green, 3);
    }
    text(f, closed ? '开关闭合' : '开关断开', swx + 28, by + 6, { color: closed ? C.green : C.hot, font: '13px serif' });
    // 电阻
    const rx = bx + bw, ry = by + 60;
    poly(f, [[rx - 12, ry - 26], [rx + 12, ry - 26], [rx + 12, ry + 26], [rx - 12, ry + 26]], { fill: 'rgba(237,137,54,0.7)', stroke: C.warm, lw: 2 });
    text(f, `R=${R}`, rx + 20, ry + 5, { color: C.warm, font: '14px serif' });
    // 电感（线圈）
    const lx = bx + bw / 2, ly = by + bh;
    for (let i = 0; i < 5; i++) {
      const { ctx } = f;
      ctx.save();
      ctx.strokeStyle = C.cool;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(lx - 44 + i * 22, ly, 11, Math.PI, 0);
      ctx.stroke();
      ctx.restore();
    }
    text(f, `L=${L}H  τ=L/R=${tau.toFixed(3)}s`, lx - 50, ly + 34, { color: C.cool, font: '14px serif' });
    // 右：电流曲线
    const v = view(f, { xMin: 0, xMax: 5, yMin: 0, yMax: 1.1, inset: w * 0.42, insetRight: 46, insetBottom: 46 });
    grid(f, v);
    const Imax = 1; // 归一
    const curveI = (t: number) => Imax * (1 - Math.exp(-t / (tau * 0.8)));
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 300; i++) {
      const t = (i / 300) * 5;
      pts.push([v.sx(t), v.sy(curveI(Math.min(t, (f.t * 1.4) % 6)))]);
    }
    poly(f, pts, { stroke: C.green, lw: 2.8 });
    // τ 标注
    const tauVis = tau * 0.8;
    if (tauVis * 4 < 5) {
      for (const k of [1, 2, 3]) {
        seg(f, v.sx(tauVis * k), v.sy(0), v.sx(tauVis * k), v.sy(1.05), `${C.yellow}66`, 1.4, );
        text(f, `${k}τ`, v.sx(tauVis * k) + 4, v.sy(1.02), { color: C.yellow, font: '12px serif' });
      }
      dot(f, v.sx(tauVis), v.sy(1 - Math.exp(-1)), 6, C.hot);
      text(f, '1τ 时到 63.2%', v.sx(tauVis) + 8, v.sy(1 - Math.exp(-1)) - 10, { color: C.hot, font: '13px serif' });
    }
    text(f, 'i(t) = (ε/R)(1 − e^(−Rt/L))', v.sx(0.4), v.sy(0.92), { color: C.fg, font: '15px serif' });
    text(f, '时间 (s)', (v.sx(0) + v.sx(5)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'i / i_max', v.sx(0.15), v.sy(1.06), { color: C.dim, font: '12px sans-serif' });
    text(f, '三要素法：稳态值 ε/R、初值 0、时间常数 L/R —— 任何一阶电路的通解模板', 56, h - 116, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '电感抗拒电流突变：t=0⁺ 时刻 i=0⁺（开路等效），t→∞ 变短路（导线等效）',
      '断开关流会产生高压电弧：E = −L di/dt（感性负载断电保护的物理依据）',
      '能量 ½Li² 存在磁场：断电时它要么泄放要么以火花形式烧掉',
    ]);
    heading(f, '指数爬升的三要素法');
  },
});
registerViz(rlCircuitTransient);

/** P486 RLC 串联谐振与复阻抗。 */
const rlcImpedanceResonance = defineViz({
  slug: 'rlc-impedance-resonance',
  title: 'RLC 串联谐振与复阻抗',
  params: { w: { type: 'range', min: 0.2, max: 3, default: 1, step: 0.05, label: 'ω/ω₀' }, Q: { type: 'range', min: 1, max: 40, default: 12, step: 1, label: '品质因数 Q' } },
  draw: (f) => {
    const { w: W, h, params } = f;
    const r = num(params, 'w', 1), Q = num(params, 'Q', 12);
    clear(f);
    // 左：阻抗幅频曲线
    const v = view(f, { xMin: 0.2, xMax: 3, yMin: 0, yMax: 6, inset: 46, insetBottom: 46 });
    grid(f, v);
    const Z = (x: number) => Math.sqrt(Math.pow(1 - x * x, 2) + Math.pow(x / Q, 2));
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 300; i++) {
      const x = 0.2 + (i / 300) * 2.8;
      pts.push([v.sx(x), v.sy(Math.min(6, Z(x) * Q * 0.6))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.8 });
    const zc = Z(r) * Q * 0.6;
    dot(f, v.sx(r), v.sy(Math.min(6, zc)), 7, C.hot);
    text(f, `|Z|·Q·0.6 = ${zc.toFixed(2)}`, v.sx(r) + 10, v.sy(Math.min(5.8, zc)) - 10, { color: C.hot, font: '13px serif' });
    text(f, 'ω=ω₀ 时 X_L=X_C 抵消，|Z|=R（纯阻性）', v.sx(0.3), v.sy(5.7), { color: C.yellow, font: '13px serif' });
    text(f, 'ω/ω₀', (v.sx(0.2) + v.sx(3)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, '|Z|（归一）', v.sx(0.3), v.sy(5.9), { color: C.dim, font: '12px sans-serif' });
    // 右：相量图
    const cx = W * 0.76, cy = h * 0.4;
    const scale = 52;
    // R 水平、L 垂直上、C 垂直下
    vec(f, cx, cy, cx + scale, cy, C.warm, 3);
    text(f, 'IR', cx + scale * 0.5, cy + 20, { align: 'center', color: C.warm, font: '13px serif' });
    const xl = (r * Q) * 0.9, xc = (r / Q) * Q * 0.9 * 0.9;
    vec(f, cx + scale, cy, cx + scale, cy - xl, C.cool, 3);
    text(f, 'IX_L', cx + scale + 8, cy - xl / 2, { color: C.cool, font: '13px serif' });
    vec(f, cx + scale, cy, cx + scale, cy + xc * 0.7, C.cyan, 3);
    text(f, 'IX_C', cx + scale + 8, cy + xc * 0.35, { color: C.cyan, font: '13px serif' });
    // 合成
    const netY = -xl + xc * 0.7;
    vec(f, cx, cy, cx + scale, cy + netY, C.green, 3.4);
    vec(f, cx, cy, cx + scale, cy, `${C.warm}55`, 2);
    const phi = Math.atan2(netY, scale);
    text(f, `φ = atan(X/R) = ${(phi * 180 / Math.PI).toFixed(1)}°`, cx - 60, cy - 130, { color: C.green, font: '14px serif' });
    text(f, '电压超前电流（感性）/ 滞后（容性）', cx - 60, cy - 106, { color: C.dim, font: '13px sans-serif' });
    // 底部
    text(f, `谐振 ω₀ = 1/√(LC)　Q = ω₀L/R = ${Q}　带宽 Δω = ω₀/Q`, 56, h - 116, { color: C.fg, font: '15px serif' });
    text(f, 'Q 大 ⇒ 选频尖锐：收音机中频变压器调到谐振点选台', 56, h - 88, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '复阻抗 Z = R + j(ωL − 1/ωC)：把微分方程变成复数代数（相量法）',
      '谐振时电压分配：U_L = U_C = Q·U（谐振升压——绝缘设计要防）',
      '串联谐振电流最大、并联谐振阻抗最大：低通/带通滤波器的两种接法',
    ]);
    heading(f, '相量图上转一圈');
  },
});
registerViz(rlcImpedanceResonance);

/** P487 交流功率与功率因数。 */
const acPowerFactor = defineViz({
  slug: 'ac-power-factor',
  title: '交流功率与功率因数',
  params: { phi: { type: 'range', min: -1.57, max: 1.57, default: 0.6, step: 0.05, label: '相位差 φ (rad)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const phi = num(params, 'phi', 0.6);
    clear(f);
    // 左：功率三角形
    const bx = w * 0.3, by = h * 0.52, S = 210;
    const P = Math.cos(phi), Q = Math.sin(phi);
    poly(f, [[bx - S / 2, by], [bx + S / 2 * P, by], [bx + S / 2 * P, by - S * Q]], { stroke: C.cool, lw: 2.4, fill: 'rgba(66,153,225,0.15)' });
    seg(f, bx - S / 2, by, bx + S / 2 * P, by, C.green, 4);
    seg(f, bx + S / 2 * P, by, bx + S / 2 * P, by - S * Q, C.hot, 4);
    seg(f, bx - S / 2, by, bx + S / 2 * P, by - S * Q, C.accent, 4);
    text(f, 'S 视在功率 (VA)', bx - S / 2 - 6, by - S * Q / 2, { color: C.accent, font: '14px serif' });
    text(f, 'P 有功 (W) 做真功', bx - S / 6, by + 26, { align: 'center', color: C.green, font: '14px serif' });
    text(f, 'Q 无功 (var) 来回搬', bx + S / 2 * P + 8, by - S * Q / 2, { color: C.hot, font: '14px serif' });
    text(f, `cosφ = ${P.toFixed(3)}`, bx - 30, by - S * Q - 16, { color: C.yellow, font: '17px serif' });
    text(f, `φ = ${(phi * 180 / Math.PI).toFixed(1)}°`, bx - 30, by - S * Q - 44, { color: C.yellow, font: '14px serif' });
    // 右：电压电流波形
    const gx0 = w * 0.58, gx1 = w - 40, gy = h * 0.4;
    const sx = (t: number) => gx0 + (t / (2 * Math.PI)) * (gx1 - gx0);
    seg(f, gx0, gy, gx1, gy, C.grid, 1.2);
    const u: Array<[number, number]> = [], i: Array<[number, number]> = [];
    for (let k = 0; k <= 200; k++) {
      const t = (k / 200) * 2 * Math.PI;
      u.push([sx(t), gy - Math.sin(t) * 56]);
      i.push([sx(t), gy - Math.sin(t - phi) * 40]);
    }
    poly(f, u, { stroke: C.warm, lw: 2.4 });
    poly(f, i, { stroke: C.cool, lw: 2.4 });
    const tNow = (f.t * 1.5) % (2 * Math.PI);
    seg(f, sx(tNow), gy - 70, sx(tNow), gy + 70, `${C.pink}88`, 1.4);
    dot(f, sx(tNow), gy - Math.sin(tNow) * 56, 5, C.warm);
    dot(f, sx(tNow), gy - Math.sin(tNow - phi) * 40, 5, C.cool);
    text(f, '橙=U　蓝=I', gx0 + 6, gy - 78, { color: C.dim, font: '13px serif' });
    text(f, phi > 0.05 ? 'I 滞后 U（感性负载：电机/变压器）' : phi < -0.05 ? 'I 超前 U（容性负载：电容组）' : '同相（纯阻性，cosφ=1 最优）',
      gx0, gy + 100, { color: C.pink, font: '14px sans-serif' });
    // 底部
    text(f, 'P = UI cosφ：只有有功分量进电表', 56, h - 142, { color: C.fg, font: '15px serif' });
    text(f, `当前：S = UI，P = ${(P * 100).toFixed(0)}%·S，Q = ${(Math.abs(Q) * 100).toFixed(0)}%·S`, 56, h - 114, { color: C.yellow, font: '14px serif' });
    text(f, '无功补偿：并联电容抵消感性无功 → cosφ↑ → 线损↓（电网考核指标）', 56, h - 86, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '三种功率构成直角三角形：S² = P² + Q² —— 设备按 S 选型、电费按 P 结算',
      'cosφ 低 = 同样的线电流只干更少的活：电流白白在线路上发热',
      '功率因数校正到 0.95 以上可免供电公司罚款——电力系统最普及的"优化"',
    ]);
    heading(f, '电网为什么在乎那个夹角');
  },
});
registerViz(acPowerFactor);

/** P488 互感与理想变压器。 */
const transformerMutualInductance = defineViz({
  slug: 'transformer-mutual-inductance',
  title: '互感与理想变压器',
  params: { n: { type: 'range', min: 0.1, max: 4, default: 2, step: 0.1, label: '匝数比 N₂/N₁' }, k: { type: 'range', min: 0.2, max: 1, default: 0.95, step: 0.05, label: '耦合系数 k' } },
  draw: (f) => {
    const { w, h, params } = f;
    const n = num(params, 'n', 2), k = num(params, 'k', 0.95);
    clear(f);
    // 铁芯与两组线圈
    const cx = w * 0.4, cy = h * 0.44;
    poly(f, [[cx - 130, cy - 110], [cx + 130, cy - 110], [cx + 130, cy + 110], [cx - 130, cy + 110]],
      { stroke: C.dim, lw: 3, fill: 'rgba(58,74,99,0.55)' });
    poly(f, [[cx - 70, cy - 55], [cx + 70, cy - 55], [cx + 70, cy + 55], [cx - 70, cy + 55]], { fill: C.bg, stroke: C.grid, lw: 2 });
    // 初级（左柱）
    const n1turns = 6;
    for (let i = 0; i < n1turns; i++) {
      const y = cy - 80 + i * 30;
      const { ctx } = f;
      ctx.save();
      ctx.strokeStyle = C.cool;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(cx - 100, y, 14, 12, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // 次级（右柱）匝数随参数
    const n2turns = Math.max(2, Math.round(n1turns * n));
    for (let i = 0; i < n2turns; i++) {
      const y = cy - 90 + i * (180 / n2turns);
      const { ctx } = f;
      ctx.save();
      ctx.strokeStyle = C.warm;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(cx + 100, y, 14, 11, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    text(f, `N₁=${n1turns}`, cx - 150, cy - 120, { color: C.cool, font: '14px serif' });
    text(f, `N₂=${n2turns}`, cx + 96, cy - 130, { color: C.warm, font: '14px serif' });
    // 磁通（脉动）
    const flux = Math.sin(f.t * 3);
    for (let i = 0; i < 3; i++) {
      const y = cy - 30 + i * 30;
      vec(f, cx - 56, y, cx + 56, y, `rgba(72,187,120,${0.4 + flux * 0.35})`, 2.2, 7);
    }
    text(f, 'Φ（铁芯里同一束磁通）', cx - 66, cy + 96, { color: C.green, font: '13px serif' });
    // 右侧读数
    const bx = w * 0.68;
    const V2overV1 = n;
    text(f, '理想变压器：', bx, 96, { color: C.fg, font: '16px sans-serif' });
    text(f, `V₂/V₁ = N₂/N₁ = ${V2overV1.toFixed(2)}`, bx, 132, { color: C.yellow, font: '15px serif' });
    text(f, `I₂/I₁ = N₁/N₂ = ${(1 / n).toFixed(2)}`, bx, 164, { color: C.cool, font: '15px serif' });
    text(f, 'P₁ ≈ P₂（理想无损）', bx, 196, { color: C.green, font: '15px serif' });
    text(f, `M = k√(L₁L₂)　当前 k = ${k.toFixed(2)}`, bx, 244, { color: C.hot, font: '15px serif' });
    text(f, k > 0.95 ? '紧耦合：漏磁可忽略' : `漏感占比 ${((1 - k * k) * 100).toFixed(0)}% —— 实际变压器要处理`, bx, 274, { color: C.dim, font: '14px sans-serif' });
    text(f, '变压器方程从 e = −N dΦ/dt 来：同一 Φ 穿过两组线圈', bx, h - 130, { color: C.fg, font: '14px sans-serif' });
    text(f, '电网长距离输电：升压降流 → 线损 I²R 大幅减少', bx, h - 102, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '互感 M 对称：M₁₂ = M₂₁（互易定理），耦合系数 k = M/√(L₁L₂) ≤ 1',
      '理想化三条：无漏磁、无电阻、磁导率无穷 —— 偏离它们才有铜损铁损',
      '铁芯=磁路：硅钢片叠压减涡流，磁滞回线面积即铁损来源',
    ]);
    heading(f, '匝数比既变压又变流');
  },
});
registerViz(transformerMutualInductance);

/** P489 位移电流与全电流定律。 */
const maxwellDisplacementCurrent = defineViz({
  slug: 'maxwell-displacement-current',
  title: '位移电流与全电流定律',
  params: { charge: { type: 'range', min: 0, max: 100, default: 50, step: 5, label: '充电进度 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const prog = num(params, 'charge', 50) / 100;
    clear(f);
    // 平行板电容 + 导线
    const cx = w * 0.4, cy = h * 0.44;
    const gap = 150;
    const plateY1 = cy - gap / 2, plateY2 = cy + gap / 2;
    // 导线（上下）
    seg(f, cx - 200, cy - 240, cx, cy - 240, C.dim, 4);
    seg(f, cx, cy - 240, cx, plateY1 - 6, C.dim, 4);
    seg(f, cx - 200, cy + 240, cx, cy + 240, C.dim, 4);
    seg(f, cx, cy + 240, cx, plateY2 + 6, C.dim, 4);
    // 板
    poly(f, [[cx - 110, plateY1 - 6], [cx + 110, plateY1 - 6], [cx + 110, plateY1], [cx - 110, plateY1]], { fill: C.cool });
    poly(f, [[cx - 110, plateY2], [cx + 110, plateY2], [cx + 110, plateY2 + 6], [cx - 110, plateY2 + 6]], { fill: C.hot });
    // 导线电流（流动点）
    for (let i = 0; i < 6; i++) {
      const t = ((f.t * 0.7 + i / 6) % 1);
      dot(f, cx - 200 + t * 200, cy - 240, 5, C.yellow);
      dot(f, cx - 200 + t * 200, cy + 240, 5, C.yellow);
    }
    text(f, '传导电流 I_c（电子流）', cx - 260, cy - 254, { color: C.yellow, font: '13px sans-serif' });
    // 板间位移电流（电场增长）
    for (let i = 0; i < 5; i++) {
      const y = plateY1 + 24 + i * ((gap - 48) / 4);
      const E = prog;
      vec(f, cx - 90, y, cx + 90, y, `rgba(102,126,234,${0.3 + E * 0.6})`, 2, 7);
    }
    text(f, `E = σ/ε₀ = ${prog.toFixed(2)} (归一)`, cx - 90, cy - 18, { color: C.accent, font: '13px serif' });
    // 位移电流箭头（与传导同向）
    for (let i = 0; i < 4; i++) {
      const x = cx - 70 + i * 46;
      vec(f, x, cy + 44, x, cy - 44, C.green, 2.4, 7);
    }
    text(f, 'J_d = ∂D/∂t（位移电流密度）', cx - 96, cy + 68, { color: C.green, font: '14px serif' });
    // 高斯面（包住上板）
    ctx2(f, cx, plateY1, 130, 90);
    // 右侧账本
    const bx = w * 0.68;
    text(f, '安培定律的漏洞：', bx, 96, { color: C.hot, font: '16px sans-serif' });
    text(f, '包住导线的环路 → I_c', bx, 130, { color: C.fg, font: '14px serif' });
    text(f, '包住电容间隙的环路 → 0？', bx, 160, { color: C.fg, font: '14px serif' });
    text(f, '同一环两种答案 = 矛盾！', bx, 194, { color: C.hot, font: '14px sans-serif' });
    text(f, '麦克斯韦的修复：', bx, 240, { color: C.yellow, font: '16px sans-serif' });
    text(f, '∮B·dl = μ₀(I_c + ε₀ dΦ_E/dt)', bx, 276, { color: C.green, font: '16px serif' });
    text(f, '板间 dΦ_E/dt = I_c —— 两个环路给出同一个 B', bx, 310, { color: C.green, font: '14px sans-serif' });
    text(f, '全电流处处连续：传导+位移接力跑完全程', bx, 350, { color: C.fg, font: '14px sans-serif' });
    footnotes(f, [
      '位移电流不是电荷运动，是电场的变化率 —— 真空中它照样激发磁场',
      '由此预言电磁波：变化 E 生 B、变化 B 生 E，自持传播 c = 1/√(μ₀ε₀)',
      '麦克斯韦方程组的第四式：把安培定律从"恒定电流的规则"升级成"宇宙的规则"',
    ]);
    heading(f, '没有电荷流却有电流');
  },
});
function ctx2(f: { ctx: CanvasRenderingContext2D }, cx: number, cy: number, hw: number, hh: number): void {
  const { ctx } = f;
  ctx.save();
  ctx.strokeStyle = 'rgba(72,187,120,0.8)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(cx - hw, cy - hh, hw * 2, hh);
  ctx.strokeRect(cx - hw + 30, cy - hh + 20, hw * 2 - 60, hh - 20);
  ctx.restore();
}
registerViz(maxwellDisplacementCurrent);

/** P490 坡印廷矢量与电磁能流。 */
const poyntingEnergyFlow = defineViz({
  slug: 'poynting-energy-flow',
  title: '坡印廷矢量与电磁能流',
  params: { dc: { type: 'select', options: ['直流稳态', '电容充电', '电阻发热'], default: '直流稳态', label: '场景' } },
  draw: (f) => {
    const { w, h, params } = f;
    const scene = str(params, 'dc', '直流稳态');
    clear(f);
    // 直导线截面视角 + S 场
    const cx = w * 0.4, cy = h * 0.46;
    // 导线截面
    circle(f, cx, cy, 46, { fill: 'rgba(237,137,54,0.75)', stroke: C.warm, lw: 3 });
    // 电流出纸面
    text(f, 'I ⊙', cx, cy + 6, { align: 'center', color: C.bg, font: '17px serif' });
    // E 径向（外）、B 环向（切向）、S = E×B 沿轴向
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = 84;
      const ex = cx + Math.cos(a) * r, ey = cy + Math.sin(a) * r;
      vec(f, cx + Math.cos(a) * 52, cy + Math.sin(a) * 52, ex, ey, C.cool, 2, 6); // E 向外
      // B 切向
      const tb = a + Math.PI / 2;
      vec(f, ex, ey, ex + Math.cos(tb) * 30, ey + Math.sin(tb) * 30, C.hot, 2, 6);
      // S 出纸面（用圆点）
      dot(f, ex + Math.cos(tb) * 44, ey + Math.sin(tb) * 44, 5, C.green);
    }
    text(f, '蓝=E（径向）　红=B（环向）　绿点=S=E×H（出纸面）', cx - 220, cy - 180, { color: C.fg, font: '14px sans-serif' });
    text(f, '能量沿导线外的场流动，进入导线变成焦耳热', cx - 220, cy - 154, { color: C.yellow, font: '14px sans-serif' });
    // 右侧场景解释
    const bx = w * 0.68;
    const scenes: Record<string, string[]> = {
      '直流稳态': ['S 指向导线内侧', '能量从场流入电阻', 'P = ∮S·dA = I²R（安培功率的场版本）', '导线内部 E∥≠0 才有能流'],
      '电容充电': ['两板之间 S 侧向流入', '能量存进电场 ½ε₀E²', '板间没有电荷流，照样有能流', '充电完成后 S → 0'],
      '电阻发热': ['S 径向指向电阻内部', '坡印廷定理：−∂u/∂t − ∇·S = J·E', '右边 J·E > 0 = 每立方米的发热功率', '电磁场是能量的搬运工与仓库'],
    };
    text(f, scene, bx, 100, { color: C.green, font: '17px sans-serif' });
    (scenes[scene] ?? scenes['直流稳态']).forEach((line, i) => {
      text(f, '· ' + line, bx, 140 + i * 38, { color: C.fg, font: '14px sans-serif' });
    });
    text(f, 'S = E×H (W/m²)　u = ½(ε₀E² + B²/μ₀)', bx, 340, { color: C.cool, font: '15px serif' });
    footnotes(f, [
      '坡印廷定理：场能密度减少率 + 流出 = 对电荷做功（−J·E）—— 能量守恒的场形式',
      '"能量在导线里"是错觉：导线只是引导 S 方向的边界条件（Poynting 的反直觉结论）',
      '坡印廷矢量方向=能量流向：天线辐射、微波输能、无线充电都靠它算账',
    ]);
    heading(f, '能量不在导线里而在场中');
  },
});
registerViz(poyntingEnergyFlow);

/** P491 传输线与阻抗匹配。 */
const transmissionLineMatching = defineViz({
  slug: 'transmission-line-matching',
  title: '传输线与阻抗匹配',
  params: { zL: { type: 'range', min: 10, max: 200, default: 50, step: 5, label: '负载阻抗 Z_L (Ω)' }, len: { type: 'range', min: 0, max: 1, default: 0.25, step: 0.05, label: '线长 l/λ' } },
  draw: (f) => {
    const { w, h, params } = f;
    const zL = num(params, 'zL', 50), len = num(params, 'len', 0.25);
    const Z0 = 50;
    clear(f);
    // 反射系数
    const gamma = (zL - Z0) / (zL + Z0);
    const VSWR = (1 + Math.abs(gamma)) / (1 - Math.abs(gamma));
    // 传输线示意图
    const y0 = h * 0.3, x0 = 60, x1 = w - 160;
    seg(f, x0, y0 - 14, x1, y0 - 14, C.cool, 3);
    seg(f, x0, y0 + 14, x1, y0 + 14, C.warm, 3);
    text(f, 'Z₀ = 50Ω', x0 + 4, y0 - 26, { color: C.cool, font: '13px serif' });
    // 负载
    poly(f, [[x1, y0 - 30], [x1 + 46, y0 - 30], [x1 + 46, y0 + 30], [x1, y0 + 30]], { fill: 'rgba(72,187,120,0.7)', stroke: C.green, lw: 2 });
    text(f, `Z_L=${zL}`, x1 + 23, y0 + 5, { align: 'center', color: C.bg, font: '13px serif' });
    // 入射/反射行波（沿线驻波）
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 300; i++) {
      const s = i / 300;
      const x = x0 + s * (x1 - x0);
      const beta = 2 * Math.PI * (x1 - x) / (w * 0.5);
      const refl = gamma;
      const v = Math.cos(beta - f.t * 6) + refl * Math.cos(beta + f.t * 6 + Math.PI * 2 * len);
      pts.push([x, y0 - 70 - v * 34 * (1 + refl) / 2]);
    }
    poly(f, pts, { stroke: C.pink, lw: 2.4 });
    text(f, '沿线电压 = 入射波 + 反射波（驻波图案）', x0, y0 - 128, { color: C.pink, font: '14px sans-serif' });
    // 右侧读数
    const bx = w - 150;
    text(f, `Γ = ${(gamma >= 0 ? '' : '')}${gamma.toFixed(3)}`, bx, y0 + 90, { color: gamma === 0 ? C.green : C.hot, font: '16px serif' });
    text(f, `驻波比 VSWR = ${VSWR.toFixed(2)}`, bx, y0 + 122, { color: C.yellow, font: '15px serif' });
    const matched = Math.abs(gamma) < 0.02;
    text(f, matched ? '完美匹配：无反射' : `反射功率 = ${(Math.abs(gamma) ** 2 * 100).toFixed(1)}%`, bx, y0 + 154, { color: matched ? C.green : C.warm, font: '14px sans-serif' });
    // λ/4 变换器
    text(f, 'λ/4 阻抗变换器：', 60, h - 156, { color: C.fg, font: '15px sans-serif' });
    text(f, `Z_in = Z₀²/Z_L = ${(Z0 * Z0 / zL).toFixed(1)}Ω（当前 l=λ/4 时）`, 60, h - 128, { color: C.cool, font: '15px serif' });
    text(f, '经验：天线馈线、示波器探头、射频模块都要 50Ω 对 50Ω', 60, h - 100, { color: C.yellow, font: '14px sans-serif' });
    text(f, '终端匹配电阻吸掉最后一点反射 —— 示波器的 1MΩ/50Ω 开关', 60, h - 72, { color: C.dim, font: '14px sans-serif' });
    footnotes(f, [
      '线长与波长可比时电压电流沿线变化：分布参数取代集总参数',
      'Γ = (Z_L−Z₀)/(Z_L+Z₀)：失配的幅度与相位，史密斯圆图就是它的极坐标',
      'VSWR=1 完美匹配；工程上 <1.5 即可，天线驻波比过大烧发射机',
    ]);
    heading(f, '驻波比是失配的体温计');
  },
});
registerViz(transmissionLineMatching);

/** P492 磁滞回线与磁化曲线。 */
const hysteresisLoop = defineViz({
  slug: 'hysteresis-loop',
  title: '磁滞回线与磁化曲线',
  params: { Hmax: { type: 'range', min: 20, max: 100, default: 70, step: 5, label: '最大磁场 H_max (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const Hm = num(params, 'Hmax', 70) / 100;
    clear(f);
    const v = view(f, { xMin: -1.2, xMax: 1.2, yMin: -1.3, yMax: 1.3, inset: 46, insetBottom: 46 });
    grid(f, v);
    // 初始磁化曲线
    const init: Array<[number, number]> = [];
    for (let i = 0; i <= 60; i++) {
      const x = (i / 60) * 1.1;
      init.push([v.sx(x), v.sy(1.15 * Math.tanh(2.4 * x) / Math.tanh(2.4 * 1.1) * 0.98)]);
    }
    poly(f, init, { stroke: C.yellow, lw: 2.2 });
    // 滞后回线（参数化）
    const loop: Array<[number, number]> = [];
    for (let i = 0; i <= 240; i++) {
      const th = (i / 240) * Math.PI * 2;
      const H = Hm * Math.sin(th);
      const lag = th - 0.7;
      const B = 1.1 * Math.tanh(2.4 * Math.sin(lag) * Hm) * 0.95;
      loop.push([v.sx(H / Hm * 1.1 * Hm), v.sy(B)]);
    }
    poly(f, loop, { stroke: C.accent, lw: 2.8 });
    // 运动点
    const th = f.t * 1.6;
    const Hp = Hm * Math.sin(th);
    const Bp = 1.1 * Math.tanh(2.4 * Math.sin(th - 0.7) * Hm) * 0.95;
    dot(f, v.sx(Hp), v.sy(Bp), 7, C.hot);
    text(f, 'H', (v.sx(-1.2) + v.sx(1.2)) / 2, h - 50, { align: 'center', color: C.dim, font: '13px sans-serif' });
    text(f, 'B', v.sx(-1.15), v.sy(1.24), { color: C.dim, font: '13px sans-serif' });
    // 关键点标注
    dot(f, v.sx(0), v.sy(0.75), 5, C.green);
    text(f, 'B_r 剩磁', v.sx(0.05), v.sy(0.8), { color: C.green, font: '13px serif' });
    dot(f, v.sx(-0.45), v.sy(0), 5, C.warm);
    text(f, 'H_c 矫顽力', v.sx(-0.42), v.sy(-0.12), { color: C.warm, font: '13px serif' });
    // 面积=损耗标注
    text(f, '回线面积 ∝ 每周期磁滞损耗 (J/m³·cycle)', v.sx(-1.1), v.sy(-1.1), { color: C.hot, font: '14px serif' });
    text(f, '黄线=初始磁化曲线（从零磁状态出发）', v.sx(-1.1), v.sy(-1.2), { color: C.yellow, font: '13px serif' });
    // 底部：软硬磁对比
    text(f, '软磁（H_c 小，回线瘦）→ 变压器铁芯：易磁化易退磁，损耗低', 56, h - 116, { color: C.cool, font: '14px sans-serif' });
    text(f, '硬磁（H_c 大，回线胖）→ 永磁体：一旦磁化"赖着不走"', 56, h - 88, { color: C.warm, font: '14px sans-serif' });
    footnotes(f, [
      '磁滞：B 落后 H —— 磁畴壁翻转需要能量，回线面积就是学费',
      '铁损 = 磁滞损 + 涡流损：前者正比频率、后者正比频率²（硅钢片+叠压的动机）',
      '磁记录、MRAM、变压器节能钢：全部在"把回线掰成想要的形状"',
    ]);
    heading(f, 'B 落后 H 一拍，面积即铁损');
  },
});
registerViz(hysteresisLoop);

/** P493 最小耦合与正则动量。 */
const minimalCouplingMomentum = defineViz({
  slug: 'minimal-coupling-momentum',
  title: '最小耦合与正则动量',
  params: { B: { type: 'range', min: 0, max: 10, default: 4, step: 0.5, label: '磁场 B (T)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const B = num(params, 'B', 4);
    clear(f);
    // 左：回旋圆轨道（机械动量 mv 与正则动量 p 差 qA）
    const cx = w * 0.3, cy = h * 0.44;
    const rc = 60 + (10 - B) * 6; // 半径随 B 减小
    // 均匀磁场（出纸面点阵）
    for (let gx = 40; gx < w * 0.55; gx += 46) {
      for (let gy = 70; gy < h * 0.72; gy += 46) {
        dot(f, gx, gy, 3, `rgba(66,153,225,${0.3 + B * 0.04})`);
      }
    }
    circle(f, cx, cy, rc, { stroke: C.warm, lw: 2.6 });
    const th = f.t * 2;
    const px = cx + Math.cos(th) * rc, py = cy + Math.sin(th) * rc;
    dot(f, px, py, 8, C.hot);
    // 机械动量 mv（切向）
    vec(f, px, py, px - Math.sin(th) * 64, py + Math.cos(th) * 64, C.warm, 3);
    text(f, 'mv', px - Math.sin(th) * 70 - 10, py + Math.cos(th) * 70, { color: C.warm, font: '14px serif' });
    // 正则动量 p = mv + qA（沿切向加 A 分量，示意更长）
    vec(f, px, py, px - Math.sin(th) * 96, py + Math.cos(th) * 96, C.green, 2.6);
    text(f, 'p = mv + qA', px - Math.sin(th) * 104 - 30, py + Math.cos(th) * 104 - 8, { color: C.green, font: '14px serif' });
    // 洛伦兹力指向圆心
    vec(f, px, py, cx + (px - cx) * 0.28, cy + (py - cy) * 0.28, C.cool, 3);
    text(f, 'qv×B', (px + cx) / 2 + 8, (py + cy) / 2 - 8, { color: C.cool, font: '13px serif' });
    text(f, `回旋半径 r = mv/qB　（B = ${B.toFixed(1)} T）`, 56, h - 156, { color: C.fg, font: '15px serif' });
    text(f, '回旋频率 ω_c = qB/m 与速度无关 —— 回旋加速器的原理', 56, h - 128, { color: C.yellow, font: '14px sans-serif' });
    // 右：公式推导
    const bx = w * 0.58;
    text(f, '从拉格朗日出发：', bx, 96, { color: C.fg, font: '16px sans-serif' });
    const lines = [
      'L = ½mv² − qφ + qA·v',
      'p = ∂L/∂v = mv + qA　（正则动量！）',
      'H = (p − qA)²/2m + qφ',
      '⇒ 哈密顿量里 B 以 A 的形式入场',
    ];
    lines.forEach((s, i) => text(f, s, bx, 134 + i * 46, { color: i === 1 ? C.green : i === 2 ? C.yellow : C.cool, font: '15px serif' }));
    text(f, '规范变换 A → A + ∇χ：物理不变', bx, 336, { color: C.hot, font: '14px sans-serif' });
    text(f, '（H 里多出的项正好被 φ 的变换抵消）', bx, 366, { color: C.dim, font: '13px sans-serif' });
    text(f, '量子力学版本：p → −iℏ∇，最小耦合 ∇ → ∇ − iqA/ℏ', bx, 410, { color: C.green, font: '14px sans-serif' });
    footnotes(f, [
      '正则动量守恒（循环坐标）：A 方向平移对称 ⇒ 朗道能级与量子霍尔的起点',
      '"最小耦合"=把 ∂_μ 换成 D_μ = ∂_μ + iqA_μ：电磁相互作用的规范原理',
      'Aharonov-Bohm 效应：A 本身有可观测的非局域效应（电子绕磁通）',
    ]);
    heading(f, '磁场里连哈密顿量都要改写');
  },
});
registerViz(minimalCouplingMomentum);