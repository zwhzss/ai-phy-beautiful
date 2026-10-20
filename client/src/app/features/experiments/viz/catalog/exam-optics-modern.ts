import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text, view, grid, curve, circle, vec, rng } from '../canvas';

/** P520 单缝夫琅禾费衍射。 */
const singleSlitFraunhofer = defineViz({
  slug: 'single-slit-fraunhofer',
  title: '单缝夫琅禾费衍射',
  params: { a: { type: 'range', min: 2, max: 20, default: 6, step: 1, label: '缝宽 a (×λ)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 6);
    clear(f);
    // 上：缝与屏
    const y1 = h * 0.2, y2 = h * 0.62;
    poly(f, [[40, y1], [w / 2 - 40 - a * 6, y1], [w / 2 - 40 - a * 6, y1 + 60], [40, y1 + 60]], { fill: C.panel, stroke: C.grid, lw: 2 });
    poly(f, [[w / 2 + 40 + a * 6, y1], [w - 40, y1], [w - 40, y1 + 60], [w / 2 + 40 + a * 6, y1 + 60]], { fill: C.panel, stroke: C.grid, lw: 2 });
    text(f, `缝宽 a = ${a}λ`, w / 2, y1 - 12, { align: 'center', color: C.fg, font: '14px serif' });
    // 平面波前
    for (let i = 0; i < 4; i++) {
      const y = y1 - 16 - i * 22;
      seg(f, 46, y, w - 46, y, `${C.cool}88`, 1.6);
    }
    // 屏上强度分布
    const v = view(f, { xMin: -3, xMax: 3, yMin: 0, yMax: 1.15, inset: 50, insetBottom: 52 });
    grid(f, v);
    const I = (u: number) => (Math.abs(u) < 1e-9 ? 1 : Math.pow(Math.sin(Math.PI * u) / (Math.PI * u), 2));
    // u = a sinθ / λ，映射 x 到 u（视野内 ~±3 级）
    const uOf = (x: number) => x * (a / 6) * 1.05;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 400; i++) {
      const x = -3 + (i / 400) * 6;
      pts.push([v.sx(x), v.sy(I(uOf(x)))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.8 });
    // 极小位置（u = 整数）
    for (const m of [-3, -2, -1, 1, 2, 3]) {
      const x = 3 * (m / (a / 6 * 1.05)) * (1 / 3) * 3;
      const xv = 6 * (m / (a * 1.05)) / 6 * 6;
      void x;
      const xp = (m / (a / 6 * 1.05)) * 0.5;
      if (Math.abs(xp) <= 3) {
        seg(f, v.sx(xp), v.sy(0), v.sx(xp), v.sy(0.5), `${C.hot}88`, 1.4);
        text(f, `${m}λ/a`, v.sx(xp) + 4, v.sy(0.55), { color: C.hot, font: '11px serif' });
      }
      void xv;
    }
    text(f, 'sinθ = mλ/a（暗纹条件）：缝越窄条纹越宽', v.sx(-2.9), v.sy(1.1), { color: C.fg, font: '14px serif' });
    text(f, '中央亮纹宽度 = 2×两侧（半波带多留一半）', v.sx(-2.9), v.sy(1.0), { color: C.yellow, font: '13px serif' });
    text(f, 'sinθ（以 λ/a 为单位）', (v.sx(-3) + v.sx(3)) / 2, h - 54, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'I/I₀', v.sx(-2.9), v.sy(1.14), { color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      '半波带法：把波前按程差 λ/2 切环带，奇偶抵消 → 暗纹条件一行出',
      '强度 I = sinc²(β)：中央占总能量 90%，级次越高越暗（β=πa sinθ/λ）',
      '反直觉：缝越窄衍射越显著（孔径与角宽成反比）—— 显微镜要大孔径',
    ]);
    heading(f, '中央亮纹是缝宽倒数的回声');
  },
});
registerViz(singleSlitFraunhofer);

/** P521 布儒斯特角与偏振。 */
const brewstersAngle = defineViz({
  slug: 'brewsters-angle',
  title: '布儒斯特角与偏振',
  params: { n: { type: 'range', min: 1.2, max: 2.4, default: 1.5, step: 0.05, label: '折射率 n' } },
  draw: (f) => {
    const { w, h, params } = f;
    const n = num(params, 'n', 1.5);
    const thetaB = Math.atan(n); // tan θB = n2/n1 = n
    clear(f);
    // 界面
    const iy = h * 0.52;
    seg(f, 40, iy, w - 40, iy, C.cool, 2.6);
    poly(f, [[40, iy], [w - 40, iy], [w - 40, iy + h], [40, iy + h]], { fill: 'rgba(66,153,225,0.1)' });
    text(f, 'n₁ = 1', 54, iy - 14, { color: C.dim, font: '14px serif' });
    text(f, `n₂ = ${n.toFixed(2)}`, 54, iy + 28, { color: C.cool, font: '14px serif' });
    // 法线
    seg(f, w * 0.4, iy - 190, w * 0.4, iy + 150, `${C.dim}aa`, 1.4);
    text(f, '法线', w * 0.4 + 8, iy - 196, { color: C.dim, font: '13px serif' });
    // 入射光（来自左上）
    const ix = w * 0.4, iy0 = iy;
    const inLen = 220;
    const iStartX = ix - Math.sin(thetaB) * inLen, iStartY = iy0 - Math.cos(thetaB) * inLen;
    vec(f, iStartX, iStartY, ix, iy0, C.yellow, 3);
    text(f, '入射', iStartX - 20, iStartY - 8, { color: C.yellow, font: '14px serif' });
    // 反射（偏振，垂直纸面点）
    const rEndX = ix + Math.sin(thetaB) * inLen, rEndY = iy0 - Math.cos(thetaB) * inLen;
    vec(f, ix, iy0, rEndX, rEndY, C.hot, 3);
    text(f, '反射（全为 ⊥ 偏振）', rEndX - 30, rEndY - 12, { color: C.hot, font: '14px serif' });
    for (let i = 1; i <= 4; i++) {
      const t = i / 5;
      dot(f, ix + (rEndX - ix) * t, iy0 + (rEndY - iy0) * t, 4.4, C.hot);
    }
    // 折射（折射角 θr = 90° − θB）
    const thetaR = Math.PI / 2 - thetaB;
    const tEndX = ix + Math.sin(thetaR) * inLen * 0.9, tEndY = iy0 + Math.cos(thetaR) * inLen * 0.9;
    vec(f, ix, iy0, tEndX, tEndY, C.green, 3);
    text(f, '折射（部分偏振）', tEndX + 8, tEndY + 4, { color: C.green, font: '14px serif' });
    // 角度弧
    text(f, `θB = ${(thetaB * 180 / Math.PI).toFixed(1)}°`, ix - 96, iy0 - 66, { color: C.yellow, font: '15px serif' });
    text(f, `θr = ${(thetaR * 180 / Math.PI).toFixed(1)}°（反射⊥折射 ⇒ 平行分量无反射）`, ix + 24, iy0 + 84, { color: C.fg, font: '14px serif' });
    // 底部
    text(f, `tanθB = n₂/n₁ = ${n.toFixed(2)} ⇒ θB = ${(thetaB * 180 / Math.PI).toFixed(1)}°`, 56, h - 130, { color: C.yellow, font: '17px serif' });
    text(f, '物理：折射光中偶极子沿折射方向振荡，该方向不辐射反射波（平行分量被"吃掉"）', 56, h - 100, { color: C.fg, font: '14px sans-serif' });
    text(f, '应用：偏振太阳镜、激光腔布儒斯特窗（损耗最小的出入方式）', 56, h - 70, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '布儒斯特定律：θB = arctan(n) —— 反射与折射恰好垂直时反射光 100% 线偏振',
      '玻璃 n≈1.5 → 56.3°；水 n=1.33 → 53.1°：摄影与激光窗的常用数',
      '只靠一次反射偏振不纯：叠多片玻璃（偏振堆）或用偏振片补足',
    ]);
    heading(f, '反射与折射垂直的那个角');
  },
});
registerViz(brewstersAngle);

/** P522 四分之一波片与椭圆偏振。 */
const quarterWavePlate = defineViz({
  slug: 'quarter-wave-plate',
  title: '四分之一波片与椭圆偏振',
  params: { input: { type: 'select', options: ['线偏振 45°', '线偏振水平', '圆偏振'], default: '线偏振 45°', label: '输入偏振' }, phase: { type: 'range', min: 0, max: 3.14, default: 1.57, step: 0.05, label: '相位延迟 δ' } },
  draw: (f) => {
    const { w, h, params } = f;
    const input = str(params, 'input', '线偏振 45°');
    const delta = num(params, 'phase', 1.57);
    clear(f);
    // 左：输入态
    const drawState = (cx: number, cy: number, title: string, color: string, kind: string, ph: number) => {
      circle(f, cx, cy, 78, { stroke: C.grid, lw: 1.4, dash: [6, 5] });
      seg(f, cx - 92, cy, cx + 92, cy, `${C.grid}aa`, 1.2);
      seg(f, cx, cy - 92, cx, cy + 92, `${C.grid}aa`, 1.2);
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 120; i++) {
        const t = (i / 120) * Math.PI * 2;
        let x: number, y: number;
        if (kind === 'linear45') { x = Math.cos(t) * 70; y = -Math.cos(t) * 70; }
        else if (kind === 'linear0') { x = Math.cos(t) * 70; y = 0; }
        else if (kind === 'circular') { x = Math.cos(t) * 66; y = -Math.sin(t) * 66; }
        else {
          x = Math.cos(t) * 66;
          y = -Math.sin(t + ph) * 44;
        }
        pts.push([cx + x, cy + y]);
      }
      poly(f, pts, { stroke: color, lw: 2.6 });
      // 运动光点
      const tt = f.t * 2;
      let px: number, py: number;
      if (kind === 'linear45') { px = Math.cos(tt) * 70; py = -Math.cos(tt) * 70; }
      else if (kind === 'linear0') { px = Math.cos(tt) * 70; py = 0; }
      else if (kind === 'circular') { px = Math.cos(tt) * 66; py = -Math.sin(tt) * 66; }
      else { px = Math.cos(tt) * 66; py = -Math.sin(tt + ph) * 44; }
      dot(f, cx + px, cy + py, 6, C.yellow);
      text(f, title, cx, cy + 106, { align: 'center', color, font: '15px serif' });
    };
    const inKind = input === '线偏振 45°' ? 'linear45' : input === '线偏振水平' ? 'linear0' : 'circular';
    drawState(w * 0.2, h * 0.44, '输入：' + input, C.cool, inKind, 0);
    // 波片
    const px0 = w * 0.44;
    poly(f, [[px0, h * 0.24], [px0 + 34, h * 0.24], [px0 + 34, h * 0.66], [px0, h * 0.66]], { fill: 'rgba(236,201,75,0.3)', stroke: C.yellow, lw: 2.4 });
    text(f, 'λ/4', px0 + 17, h * 0.44, { align: 'center', color: C.yellow, font: '16px serif' });
    text(f, '快慢轴', px0 + 17, h * 0.22, { align: 'center', color: C.dim, font: '12px serif' });
    vec(f, px0 + 44, h * 0.44, px0 + 96, h * 0.44, C.dim, 2);
    // 输出态（45° 线偏 + δ=π/2 → 圆偏）
    let outKind = 'ellipse', outTitle = '输出：椭圆偏振', outColor = C.pink;
    if (Math.abs(delta - Math.PI / 2) < 0.12) {
      if (inKind === 'linear45') { outKind = 'circular'; outTitle = '输出：圆偏振（线↔圆）'; outColor = C.pink; }
      else if (inKind === 'circular') { outKind = 'linear45'; outTitle = '输出：线偏振（圆↔线）'; outColor = C.green; }
    } else if (delta < 0.08) {
      outKind = inKind; outTitle = 'δ≈0：原样通过'; outColor = C.cool;
    }
    drawState(w * 0.68, h * 0.44, outTitle, outColor, outKind, delta);
    // 底部
    text(f, `相位延迟 δ = 2π·Δn·d/λ = ${(delta / Math.PI).toFixed(2)}π`, 56, h - 136, { color: C.fg, font: '16px serif' });
    text(f, outKind === 'circular' ? '线偏 45° 入射 + δ=π/2 ⇒ 两正交分量等幅差 90° ⇒ 圆偏' :
      outKind === 'linear45' ? '圆偏入射 + δ=π/2 ⇒ 反向延迟抵消 ⇒ 退回线偏' :
        '任意 δ：端点轨迹是椭圆 —— 线/圆是它的特例', 56, h - 106, { color: C.yellow, font: '15px sans-serif' });
    text(f, '半波片 δ=π：线偏转轴（快慢轴夹角×2）；波片家族=偏振态旋转门', 56, h - 76, { color: C.cool, font: '14px sans-serif' });
    text(f, 'Jones 矩阵语言：M = R(−θ)·diag(e^{−iδ/2}, e^{iδ/2})·R(θ) —— 2×2 装下全部线性偏振光学', 56, h - 46, { color: C.dim, font: '14px sans-serif' });
    footnotes(f, [
      '石英/云母波片按 Δn·d 定制：可见光常用 1/4 与 1/2 波片',
      '椭圆偏振的完整描述：方位角+轴比（椭偏仪测薄膜的原理）',
      '圆二色 CD 谱：手性分子对左右旋吸收不同 —— 生物大分子构象探针',
    ]);
    heading(f, '快慢轴 90° 相位差的旋转门');
  },
});
registerViz(quarterWavePlate);

/** P523 望远镜的衍射极限。 */
const telescopeDiffractionLimit = defineViz({
  slug: 'telescope-diffraction-limit',
  title: '望远镜的衍射极限',
  params: { D: { type: 'range', min: 5, max: 300, default: 60, step: 5, label: '口径 D (cm)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const D = num(params, 'D', 60) / 100;
    clear(f);
    const lambda = 550e-9;
    const theta = 1.22 * lambda / D; // rad
    const thetaArc = theta * 206265; // 角秒
    // 左：艾里斑与双星分辨
    const cx = w * 0.27, cy = h * 0.44;
    const sepPx = Math.min(150, 6 + (0.6 / Math.max(0.03, thetaArc / 50)) * 6);
    const drawAiry = (x0: number, y0: number) => {
      for (let r = 46; r >= 3; r -= 2.4) {
        const alpha = r <= 5 ? 0.9 : 0.26 * Math.exp(-r / 15);
        circle(f, x0, y0, r, { fill: `rgba(236,201,75,${alpha})` });
      }
      dot(f, x0, y0, 3.4, '#fffbe6');
    };
    drawAiry(cx - sepPx / 2, cy);
    drawAiry(cx + sepPx / 2, cy);
    const resolved = sepPx > 40;
    text(f, resolved ? '双星可分辨 ✓（满足瑞利判据）' : '双星糊成一团 ✗', cx, cy + 120, { align: 'center', color: resolved ? C.green : C.hot, font: '15px sans-serif' });
    text(f, `θ = 1.22λ/D = ${thetaArc.toFixed(1)} 角秒`, cx, cy + 148, { align: 'center', color: C.yellow, font: '15px serif' });
    // 右：口径 vs 分辨角
    const v = view(f, { xMin: 0, xMax: 10, yMin: -2, yMax: 1.6, inset: w * 0.52, insetRight: 46, insetBottom: 46 });
    grid(f, v);
    curve(f, v, (x) => (x < 0.4 ? NaN : Math.log10((1.22 * 550e-9 / (x / 100)) * 206265)), { color: C.accent, lw: 2.8 });
    const curLg = Math.log10(thetaArc);
    dot(f, v.sx(Math.min(10, D * 100 / 30)), v.sy(Math.max(-2, Math.min(1.6, curLg))), 7, C.hot);
    text(f, 'log₁₀ 分辨角(″)', v.sx(0.3), v.sy(1.5), { color: C.dim, font: '12px sans-serif' });
    text(f, 'D (m, 0–30)', (v.sx(0) + v.sx(10)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, `人眼 D≈5mm：7″　哈勃 2.4m：0.05″　EHT 8m 等效：${(1.22 * 1.3e-3 / 8 * 206265 * 1000).toFixed(1)} μ″`, v.sx(0.3), v.sy(1.1), { color: C.fg, font: '13px serif' });
    // 底部
    text(f, `当前口径 ${D}m：角分辨 ${thetaArc.toFixed(2)}″ —— 10 km 外看报纸标题的极限`, 56, h - 116, { color: C.yellow, font: '16px serif' });
    text(f, '地面望远镜还卡在大气视宁度（~1″）：自适应光学逐个波前畸变补掉', 56, h - 86, { color: C.cool, font: '14px sans-serif' });
    text(f, '口径合成（VLBI/EHT）：多镜等效大口径 —— 黑洞照片的干涉测量之路', 56, h - 56, { color: C.green, font: '14px sans-serif' });
    footnotes(f, [
      '瑞利判据：一星艾里斑中心压在另一星第一暗环上 —— θ = 1.22λ/D',
      '角分辨与 λ 成正比：蓝光优于红光，紫外更优（电子显微镜绕过波动极限）',
      '为什么天文学家痴迷大镜片：分辨率、集光力、信噪比三重收益',
    ]);
    heading(f, '口径决定角分辨');
  },
});
registerViz(telescopeDiffractionLimit);

/** P524 布拉格衍射与晶格分析。 */
const braggDiffraction = defineViz({
  slug: 'bragg-diffraction',
  title: '布拉格衍射与晶格分析',
  params: { theta: { type: 'range', min: 5, max: 60, default: 20, step: 1, label: '掠射角 θ (°)' }, d: { type: 'range', min: 1, max: 5, default: 2.8, step: 0.1, label: '晶面间距 d (Å)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const th = num(params, 'theta', 20) * Math.PI / 180;
    const d = num(params, 'd', 2.8);
    const lambda = 1.54; // Å (Cu Kα)
    clear(f);
    // 晶面与原子
    const bx = w * 0.3, by0 = h * 0.32, rows = 4, cols = 8;
    const dPx = 54;
    for (let r = 0; r < rows; r++) {
      const y = by0 + r * dPx;
      seg(f, bx - 60, y, bx + 300, y, `${C.grid}aa`, 1.4);
      for (let c = 0; c < cols; c++) {
        const x = bx - 40 + c * 44;
        circle(f, x, y, 8, { fill: `rgba(102,126,234,${0.85 - r * 0.12})`, stroke: C.accent, lw: 1.4 });
      }
    }
    text(f, `晶面间距 d = ${d} Å`, bx + 250, by0 - 20, { color: C.accent, font: '14px serif' });
    // 入射与反射（两层）
    const hitY = by0 + dPx;
    const inX = bx + 90;
    const L = 200;
    const iSx = inX - Math.cos(th) * L, iSy = hitY - Math.sin(th) * L;
    vec(f, iSx, iSy, inX, hitY, C.yellow, 3);
    const rEx = inX + Math.cos(th) * L, rEy = hitY - Math.sin(th) * L;
    vec(f, inX, hitY, rEx, rEy, C.yellow, 3);
    // 第二层
    const hit2Y = hitY + dPx;
    const hit2X = inX + Math.cos(th) * (dPx / Math.tan(th));
    vec(f, hit2X - Math.cos(th) * L, hit2Y - Math.sin(th) * L, hit2X, hit2Y, C.warm, 3);
    vec(f, hit2X, hit2Y, hit2X + Math.cos(th) * L, hit2Y - Math.sin(th) * L, C.warm, 3);
    // 程差标注
    const pathDiff = 2 * d * Math.sin(th);
    text(f, `程差 2d sinθ = ${pathDiff.toFixed(2)} Å`, inX + 60, hitY + 44, { color: C.green, font: '15px serif' });
    const m = pathDiff / lambda;
    const isInt = Math.abs(m - Math.round(m)) < 0.06;
    text(f, `2d sinθ / λ = ${m.toFixed(2)} ${isInt ? '→ 整数 ⇒ 相长干涉！峰值' : '→ 非整数 ⇒ 抵消，无衍射峰'}`,
      56, h - 140, { color: isInt ? C.green : C.hot, font: '16px serif' });
    // 强度扫描（右侧小图）
    const gx0 = w * 0.6, gy0 = h - 190, gx1 = w - 50, gy1 = h - 120;
    seg(f, gx0, gy0, gx1, gy0, C.grid, 1.4);
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 240; i++) {
      const t = 5 + (i / 240) * 55;
      const pd = 2 * d * Math.sin(t * Math.PI / 180) / lambda;
      const I = Math.pow(Math.sin(Math.PI * pd) / (Math.PI * (pd - Math.round(pd) + 0.0001)), 2) * Math.exp(-Math.pow(pd - Math.round(pd), 2) * 300);
      const peak = (() => { let s = 0; for (let n = 1; n <= 4; n++) { const dd = pd - n; s += Math.exp(-dd * dd * 400); } return Math.min(1, s); })();
      pts.push([gx0 + ((t - 5) / 55) * (gx1 - gx0), gy0 - peak * (gy0 - gy1) + 0]);
      void I;
    }
    poly(f, pts, { stroke: C.hot, lw: 2.4 });
    dot(f, gx0 + ((th * 180 / Math.PI - 5) / 55) * (gx1 - gx0), gy0 - (isInt ? 1 : 0.1) * (gy0 - gy1), 5, C.yellow);
    text(f, 'θ 扫描 → 衍射峰（粉末衍射仪的原始数据）', gx0, gy1 - 12, { color: C.fg, font: '13px serif' });
    text(f, 'Bragg (1913)：把晶体当光栅 → 结构化学的 X 光之眼', 56, h - 90, { color: C.yellow, font: '15px serif' });
    text(f, '已知 λ 测 θ 得 d（结构）；已知 d 测 Λ 得 λ（后被用于 X 射线谱）', 56, h - 60, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '2d sinθ = nλ：相邻晶面反射波程差为波长整数倍才相长（一维光栅方程的体版）',
      '结构因子决定峰强：原子种类与位置调制幅度（消光规律=晶体对称性指纹）',
      '单晶衍射定蛋白结构（诺奖 1962 DNA/1985 Hauptman）、粉末衍射看物相',
    ]);
    heading(f, 'X 射线由此看清原子排队');
  },
});
registerViz(braggDiffraction);

/** P525 拉曼散射。 */
const ramanScattering = defineViz({
  slug: 'raman-scattering',
  title: '拉曼散射',
  params: { shift: { type: 'range', min: 0, max: 3000, default: 1500, step: 100, label: '分子振动频率 (cm⁻¹)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const vib = num(params, 'shift', 1500);
    clear(f);
    // 左：能级跃迁示意
    const cx = w * 0.24;
    const E0 = h * 0.66, E1 = h * 0.52, Ev = h * 0.26;
    seg(f, cx - 120, E0, cx + 120, E0, C.cool, 3.4);
    seg(f, cx - 120, E1, cx + 120, E1, C.cool, 3.4);
    seg(f, cx - 120, Ev, cx + 120, Ev, `${C.hot}88`, 2, );
    text(f, 'v=0', cx - 150, E0 + 5, { color: C.cool, font: '14px serif' });
    text(f, 'v=1', cx - 150, E1 + 5, { color: C.cool, font: '14px serif' });
    text(f, '虚态（非共振）', cx - 120, Ev - 10, { color: C.hot, font: '13px serif' });
    // 拉曼斯托克斯（吸收）
    const flash = Math.sin(f.t * 3) * 0.5 + 0.5;
    vec(f, cx - 60, E0, cx - 60, Ev - 4, C.yellow, 2.4 + flash, 8);
    vec(f, cx - 60, Ev, cx - 60, E1 + 4, C.green, 2.4 + flash, 8);
    text(f, '入射光子', cx - 170, (E0 + Ev) / 2, { color: C.yellow, font: '13px serif' });
    // 斯托克斯（散射，降频）
    vec(f, cx + 60, Ev, cx + 60, E1 + 4, C.warm, 2.4, 8);
    vec(f, cx + 60, Ev - 4, cx + 60, E0, C.pink, 2.4, 8);
    text(f, '散射', cx + 74, (E0 + Ev) / 2, { color: C.pink, font: '13px serif' });
    text(f, '斯托克斯：出射光子损失 ΔE = 振动能量', cx - 170, E1 + 40, { color: C.green, font: '14px serif' });
    // 右：光谱
    const v = view(f, { xMin: 0, xMax: 3500, yMin: 0, yMax: 1.15, inset: w * 0.46, insetRight: 46, insetBottom: 46 });
    grid(f, v);
    // 瑞利峰（0 位移）
    const ray: Array<[number, number]> = [];
    for (let i = 0; i <= 600; i++) {
      const s = -300 + (i / 600) * 3800;
      ray.push([v.sx(Math.max(0, s + 300)), v.sy(Math.min(1.1, Math.exp(-Math.pow(s / 40, 2)) * 1.1 + Math.exp(-Math.pow((s - vib) / 90, 2)) * 0.6 + Math.exp(-Math.pow((s - vib * 2) / 90, 2)) * 0.18))]);
    }
    poly(f, ray, { stroke: C.accent, lw: 2.4 });
    text(f, '瑞利峰（弹性散射）', v.sx(60), v.sy(1.1), { color: C.hot, font: '13px serif' });
    text(f, `斯托克斯峰 @ ${vib} cm⁻¹`, v.sx(Math.min(3200, vib)) - 60, v.sy(0.7), { color: C.green, font: '13px serif' });
    text(f, '反斯托克斯（弱）', v.sx(Math.min(3200, vib * 0.94)) + 10, v.sy(0.3), { color: C.warm, font: '12px serif' });
    text(f, '拉曼位移 (cm⁻¹)', (v.sx(0) + v.sx(3500)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, '强度', v.sx(60), v.sy(0.5), { color: C.dim, font: '12px sans-serif' });
    text(f, '峰位与入射光波长无关 —— 分子振动的"指纹区"', w * 0.46, h - 100, { color: C.yellow, font: '14px serif' });
    text(f, '红外吸收看偶极矩变化，拉曼看极化率变化：两者互补定对称性', w * 0.46, h - 70, { color: C.fg, font: '14px sans-serif' });
    footnotes(f, [
      '非弹性散射概率极小（10⁻⁶~10⁻⁸）：激光+弱信号检测才看得见（1928 发现）',
      '斯托克斯 > 反斯托克斯：v=1 热布居少（玻尔兹曼因子）—— 温度计原理',
      '应用：碳材料 D/G 峰、毒品快检、乳腺癌组织成像、受激拉曼显微',
    ]);
    heading(f, '把光变成分子的指纹扫描仪');
  },
});
registerViz(ramanScattering);

/** P526 空间相干性与缝宽。 */
const spatialCoherence = defineViz({
  slug: 'spatial-coherence',
  title: '空间相干性与缝宽',
  params: { sourceW: { type: 'range', min: 0.1, max: 6, default: 0.5, step: 0.1, label: '光源宽度 (mm)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const sw = num(params, 'sourceW', 0.5);
    clear(f);
    // 上：杨氏双缝装置
    const y0 = h * 0.16;
    // 扩展光源
    const srcW = sw * 16;
    poly(f, [[w * 0.1 - srcW / 2, y0], [w * 0.1 + srcW / 2, y0], [w * 0.1 + srcW / 2, y0 + 44], [w * 0.1 - srcW / 2, y0 + 44]],
      { fill: 'rgba(236,201,75,0.8)', stroke: C.yellow, lw: 2 });
    text(f, `光源宽 ${sw}mm`, w * 0.1 - 50, y0 - 10, { color: C.yellow, font: '13px serif' });
    // 双缝
    const sx0 = w * 0.44;
    poly(f, [[sx0, y0 - 30], [sx0 + 14, y0 - 30], [sx0 + 14, y0 + 74], [sx0, y0 + 74]], { fill: C.panel, stroke: C.grid, lw: 2 });
    const gapY = y0 + 22;
    text(f, 'S₁', sx0 - 34, gapY - 8, { color: C.fg, font: '14px serif' });
    text(f, 'S₂', sx0 - 34, gapY + 40, { color: C.fg, font: '14px serif' });
    // 光线
    for (const sy of [gapY - 14, gapY + 14]) {
      seg(f, w * 0.1 + srcW / 2, y0 + 22, sx0, sy, `${C.yellow}aa`, 1.6);
    }
    // 屏与条纹
    const scrX = w * 0.78;
    const scrY0 = y0 - 40, scrH = h * 0.5;
    poly(f, [[scrX, scrY0], [scrX + 26, scrY0], [scrX + 26, scrY0 + scrH], [scrX, scrY0 + scrH]], { fill: '#0d1117', stroke: C.grid, lw: 1.6 });
    // 可见度随光源宽度衰减：V = |sinc(π s a/(λ D))|
    const vis = Math.abs(Math.sin(Math.PI * sw * 1.2) / (Math.PI * sw * 1.2 + 1e-9));
    for (let i = 0; i < 140; i++) {
      const t = i / 140;
      const y = scrY0 + 8 + t * (scrH - 16);
      const phase = (y - scrY0 - scrH / 2) * 0.4;
      const I = 0.5 + 0.5 * vis * Math.cos(phase);
      const { ctx } = f;
      ctx.fillStyle = `rgba(236,201,75,${Math.max(0.04, I)})`;
      ctx.fillRect(scrX + 4, y, 18, (scrH - 16) / 140 + 1);
    }
    text(f, `条纹可见度 V = ${vis.toFixed(2)}`, scrX - 60, scrY0 + scrH + 30, { color: vis > 0.5 ? C.green : C.hot, font: '15px serif' });
    // 下：可见度曲线
    const v = view(f, { xMin: 0, xMax: 6, yMin: 0, yMax: 1.1, inset: 46, insetBottom: 46 });
    grid(f, v);
    const pts: Array<[number, number]> = [];
    for (let i = 1; i <= 300; i++) {
      const s = (i / 300) * 6;
      pts.push([v.sx(s), v.sy(Math.abs(Math.sin(Math.PI * s * 1.2) / (Math.PI * s * 1.2)))]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2.6 });
    dot(f, v.sx(sw), v.sy(Math.max(0, vis)), 7, C.hot);
    text(f, 'V(s)：第一个零点=完全失相干的临界缝宽', v.sx(0.15), v.sy(1.05), { color: C.fg, font: '13px serif' });
    text(f, '光源宽度 (mm)', (v.sx(0) + v.sx(6)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, 'V', v.sx(0.15), v.sy(1.1), { color: C.dim, font: '12px sans-serif' });
    footnotes(f, [
      '空间相干性问：波前上两点的相位是否相关 —— 决定双缝能不能出条纹',
      '范·西泰特-泽尼克定理：可见度=光源亮度分布的傅里叶变换（恒星角径测量的原理）',
      '迈克尔逊星体干涉仪：调基线长度找 V 的零点 → 直接量出恒星直径',
    ]);
    heading(f, '光源太胖条纹就糊');
  },
});
registerViz(spatialCoherence);

/** P527 激光原理与振荡阈值。 */
const laserThreshold = defineViz({
  slug: 'laser-threshold',
  title: '激光原理与振荡阈值',
  params: { pump: { type: 'range', min: 0, max: 100, default: 60, step: 5, label: '泵浦功率 (%)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const pump = num(params, 'pump', 60) / 100;
    clear(f);
    // 左：谐振腔+增益介质
    const cx = w * 0.28, cy = h * 0.42;
    // 两面镜
    poly(f, [[cx - 170, cy - 70], [cx - 156, cy - 70], [cx - 156, cy + 70], [cx - 170, cy + 70]], { fill: C.dim, stroke: C.fg, lw: 2 });
    poly(f, [[cx + 156, cy - 70], [cx + 170, cy - 70], [cx + 170, cy + 70], [cx + 156, cy + 70]], { fill: C.dim, stroke: C.fg, lw: 2 });
    text(f, '全反镜', cx - 186, cy - 84, { color: C.fg, font: '13px serif' });
    text(f, '输出镜', cx + 130, cy - 84, { color: C.fg, font: '13px serif' });
    // 增益介质
    poly(f, [[cx - 140, cy - 40], [cx + 140, cy - 40], [cx + 140, cy + 40], [cx - 140, cy + 40]],
      { fill: `rgba(102,126,234,${0.25 + pump * 0.45})`, stroke: C.accent, lw: 2 });
    text(f, '增益介质（粒子数反转）', cx - 116, cy + 6, { color: C.fg, font: '14px serif' });
    // 泵浦光
    for (let i = 0; i < 4; i++) {
      vec(f, cx - 60 + i * 40, cy - 110, cx - 60 + i * 40, cy - 46, C.warm, 2.4, 7);
    }
    text(f, `泵浦 ${(pump * 100).toFixed(0)}%`, cx - 50, cy - 122, { color: C.warm, font: '14px serif' });
    // 腔内光（超过阈值时增强）
    const above = pump > 0.45;
    const intensity = above ? Math.min(1, (pump - 0.45) / 0.4) : 0.06;
    const beamAlpha = 0.2 + intensity * 0.75;
    for (let k = 0; k < 3; k++) {
      const y = cy - 16 + k * 16;
      const bounce = Math.sin(f.t * 14 + k) * 0.5 + 0.5;
      seg(f, cx - 150, y, cx + 150, y, `rgba(245,101,101,${beamAlpha * (0.5 + bounce * 0.5)})`, 2.4);
    }
    // 输出光束
    if (above) {
      const flicker = 0.7 + 0.3 * Math.sin(f.t * 20);
      vec(f, cx + 172, cy, cx + 250, cy, `rgba(245,101,101,${flicker})`, 4 + intensity * 4, 16);
      text(f, '激光输出', cx + 190, cy - 26, { color: C.hot, font: '15px serif' });
    } else {
      text(f, '未起振（自发辐射为主）', cx + 172, cy + 60, { color: C.dim, font: '14px serif' });
    }
    // 右：增益-损耗图
    const v = view(f, { xMin: 0, xMax: 1.2, yMin: 0, yMax: 1.2, inset: w * 0.5, insetRight: 46, insetBottom: 46 });
    grid(f, v);
    // 增益曲线（随泵浦上升后饱和）
    const gain = (x: number) => (1 - Math.exp(-3 * x)) * 0.9;
    const gpts: Array<[number, number]> = [];
    for (let i = 0; i <= 120; i++) {
      const x = (i / 120) * 1.2;
      gpts.push([v.sx(x), v.sy(gain(x))]);
    }
    poly(f, gpts, { stroke: C.green, lw: 2.8 });
    // 损耗线
    seg(f, v.sx(0), v.sy(0.42), v.sx(1.2), v.sy(0.42), C.hot, 2.2);
    text(f, '总损耗 α（镜透射+散射+吸收）', v.sx(0.05), v.sy(0.47), { color: C.hot, font: '13px serif' });
    // 阈值点
    const thr = -Math.log(1 - 0.42 / 0.9) / 3;
    dot(f, v.sx(thr), v.sy(0.42), 7, C.yellow);
    text(f, `阈值泵浦 ${((thr / 1.2) * 100).toFixed(0)}%`, v.sx(thr) + 10, v.sy(0.36), { color: C.yellow, font: '14px serif' });
    // 当前
    dot(f, v.sx(pump), v.sy(gain(pump)), 6, C.cool);
    seg(f, v.sx(pump), v.sy(0), v.sx(pump), v.sy(gain(pump)), `${C.cool}77`, 1.4);
    text(f, '泵浦 (归一)', (v.sx(0) + v.sx(1.2)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    text(f, '增益/损耗', v.sx(0.05), v.sy(1.15), { color: C.dim, font: '12px sans-serif' });
    text(f, above ? `增益 > 损耗：振荡建立，增益被"钳位"到=损耗（${gain(pump).toFixed(2)}）` : '增益 < 损耗：光子被吃掉，只有荧光',
      56, h - 116, { color: above ? C.green : C.hot, font: '15px serif' });
    text(f, '阈值以上输出功率 ∝ (泵浦−阈值)：斜率效率是激光器名片', 56, h - 86, { color: C.yellow, font: '14px sans-serif' });
    footnotes(f, [
      '受激辐射截面×反转布居=增益；谐振腔提供反馈让光来回通过介质',
      '阈值三条件：增益≥损耗、粒子数反转、腔模对齐（三者缺一不振）',
      '纵模间隔 Δν = c/2nL：单纵模=好相干，多模=功率高（应用场景分家）',
    ]);
    heading(f, '增益追上损耗的那一瞬');
  },
});
registerViz(laserThreshold);

/** P528 同时的相对性。 */
const relativitySimultaneity = defineViz({
  slug: 'relativity-simultaneity',
  title: '同时的相对性',
  params: { v: { type: 'range', min: -0.9, max: 0.9, default: 0.5, step: 0.05, label: '列车速度 v/c' } },
  draw: (f) => {
    const { w, h, params } = f;
    const beta = num(params, 'v', 0.5);
    clear(f);
    // 上：站台参考系（两闪光同时）
    const yS = h * 0.3;
    text(f, '站台参考系：', 60, yS - 74, { color: C.cool, font: '17px sans-serif' });
    seg(f, 80, yS, w - 80, yS, C.grid, 3);
    const xA = w * 0.3, xB = w * 0.7;
    // 闪光动画（周期）
    const flash = (Math.sin(f.t * 3) * 0.5 + 0.5);
    const ends: Array<[number, string]> = [[xA, 'A 端'], [xB, 'B 端']];
    for (const [x, name] of ends) {
      circle(f, x, yS, 14 + flash * 16, { stroke: C.yellow, lw: 2.4, fill: `rgba(236,201,75,${0.6 - flash * 0.5})` });
      dot(f, x, yS, 6, C.yellow);
      text(f, name, x, yS + 34, { align: 'center', color: C.fg, font: '14px serif' });
    }
    // 光信号向中点
    const t = flash;
    const mid = (xA + xB) / 2;
    const travel = (xB - xA) / 2;
    seg(f, xA, yS, xA + travel * t, yS, `rgba(245,101,101,${0.8})`, 2.6);
    seg(f, xB, yS, xB - travel * t, yS, `rgba(72,187,120,${0.8})`, 2.6);
    if (t > 0.98) {
      dot(f, mid, yS, 9, C.pink);
      text(f, '中点 M：两光同时到达 ⇒ "同时发生" ✓', mid, yS - 30, { align: 'center', color: C.pink, font: '15px serif' });
    }
    // 下：列车参考系（闪光不同时）
    const yT = h * 0.66;
    const shift = beta * 60 * Math.sin(f.t * 0.8);
    text(f, '列车参考系（向右 v = ' + beta + 'c）：', 60, yT - 74, { color: C.warm, font: '17px sans-serif' });
    poly(f, [[100 + shift, yT - 40], [w - 100 + shift, yT - 40], [w - 100 + shift, yT + 40], [100 + shift, yT + 40]],
      { stroke: C.warm, lw: 2.4, fill: 'rgba(237,137,54,0.08)' });
    text(f, '列车', w - 140 + shift, yT - 52, { color: C.warm, font: '15px serif' });
    // 车上中点接收到闪光：因为车在动，B 光先到（v>0 时 B 端迎着光）
    const tA = 1, tB = 1 - beta * 0.6;
    // 在站台画：B 端闪光先发/先到？
    const xA2 = xA + shift * 0.4, xB2 = xB + shift * 0.4;
    circle(f, xB2, yT, 10 + (1 - tB) * 20, { stroke: C.green, lw: 2.2, fill: 'rgba(72,187,120,0.35)' });
    circle(f, xA2, yT, 10 + (1 - tA) * 8, { stroke: C.hot, lw: 2.2, fill: 'rgba(245,101,101,0.2)' });
    dot(f, xA2, yT, 5, C.hot);
    dot(f, xB2, yT, 5, C.green);
    const midT = (xA2 + xB2) / 2;
    dot(f, midT, yT, 8, C.pink);
    text(f, '车上观察者：B 端的光先到达中点 ⇒ "B 先闪光" ✓', 120, yT + 84, { color: C.pink, font: '15px serif' });
    text(f, '两事件在站台同时、在车上不同时 —— 同时性是参考系依赖的', 120, yT + 114, { color: C.yellow, font: '15px sans-serif' });
    text(f, '这不是错觉：任何测量都无法调和 —— 绝对同时性被逐出物理', 120, yT + 144, { color: C.fg, font: '14px sans-serif' });
    footnotes(f, [
      '光速不变 + 中点判断法：在某参考系中点同时收到两端信号 ⇔ 该系认为同时',
      '洛伦兹变换 t\' = γ(t − vx/c²)：混合了空间与时间，这就是"时空"的由来',
      '推论链：同时相对 → 尺缩钟慢 → 因果顺序（类空间隔事件无因果）',
    ]);
    heading(f, '狭义相对论的第一块多米诺');
  },
});
registerViz(relativitySimultaneity);

/** P529 相对论碰撞与不变质量。 */
const invariantMassCollision = defineViz({
  slug: 'invariant-mass-collision',
  title: '相对论碰撞与不变质量',
  params: { mode: { type: 'select', options: ['对撞 pp', '固定靶 p+p', '湮灭 e⁺e⁻'], default: '对撞 pp', label: '碰撞类型' } },
  draw: (f) => {
    const { w, h, params } = f;
    const mode = str(params, 'mode', '对撞 pp');
    clear(f);
    const cx = w * 0.4, cy = h * 0.44;
    const boom = (Math.sin(f.t * 2.2) + 1) / 2;
    if (mode === '对撞 pp') {
      const off = (1 - boom) * 220;
      circle(f, cx - off, cy, 16, { fill: C.cool, stroke: C.cool, lw: 2 });
      circle(f, cx + off, cy, 16, { fill: C.warm, stroke: C.warm, lw: 2 });
      text(f, 'p', cx - off, cy + 5, { align: 'center', color: C.bg, font: '14px serif' });
      text(f, 'p', cx + off, cy + 5, { align: 'center', color: C.bg, font: '14px serif' });
      if (boom > 0.8) {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          vec(f, cx, cy, cx + Math.cos(a) * 90, cy + Math.sin(a) * 70, i % 2 ? C.hot : C.green, 2.4, 8);
        }
        text(f, '末态（如 H→γγ 需要 √s ≥ 125 GeV）', cx, cy + 116, { align: 'center', color: C.yellow, font: '14px serif' });
      }
      text(f, '对撞：两束等大反向 → 质心系即实验室系', 60, h - 156, { color: C.fg, font: '15px sans-serif' });
    } else if (mode === '固定靶 p+p') {
      const off = boom * 200;
      circle(f, cx - 140 + off, cy, 16, { fill: C.cool, stroke: C.cool, lw: 2 });
      circle(f, cx + 90, cy, 20, { fill: C.warm, stroke: C.warm, lw: 2 });
      text(f, '束流 p', cx - 140 + off - 44, cy - 26, { color: C.cool, font: '13px serif' });
      text(f, '靶 p', cx + 90, cy + 5, { align: 'center', color: C.bg, font: '14px serif' });
      if (boom > 0.7) {
        for (let i = 0; i < 6; i++) {
          const a = -0.9 + (i / 5) * 1.8;
          vec(f, cx + 90, cy, cx + 90 + Math.cos(a) * 130, cy + Math.sin(a) * 100, C.hot, 2.2, 8);
        }
        text(f, '末态整体前冲：动量守恒拖走一大块能量', cx + 60, cy + 130, { color: C.hot, font: '14px serif' });
      }
      text(f, '固定靶：质心系在跑 → 可用能量 ∝ √E（浪费巨大）', 60, h - 156, { color: C.fg, font: '15px sans-serif' });
    } else {
      const off = (1 - boom) * 200;
      circle(f, cx - off, cy - 30, 13, { fill: C.cool, stroke: C.cool, lw: 2 });
      circle(f, cx + off, cy + 30, 13, { fill: C.hot, stroke: C.hot, lw: 2 });
      text(f, 'e⁻', cx - off, cy - 44, { color: C.cool, font: '13px serif' });
      text(f, 'e⁺', cx + off, cy + 50, { color: C.hot, font: '13px serif' });
      if (boom > 0.75) {
        vec(f, cx, cy, cx - 150, cy - 60, C.yellow, 3, 10);
        vec(f, cx, cy, cx + 150, cy + 60, C.yellow, 3, 10);
        text(f, 'γγ（背对背，每光子 ≥ m_e c² = 0.511 MeV）', cx - 120, cy - 84, { color: C.yellow, font: '14px serif' });
      }
      text(f, '湮灭：初末态不变质量都等于 2m_e —— s 守恒的最好例子', 60, h - 156, { color: C.fg, font: '15px sans-serif' });
    }
    // 不变量公式
    const bx = w * 0.66;
    text(f, '不变质量：', bx, 96, { color: C.yellow, font: '17px sans-serif' });
    text(f, 's = (ΣE/c²)² − (Σp⃗/c)²', bx, 136, { color: C.fg, font: '17px serif' });
    text(f, '与参考系无关 ⇒ 可直接当"质量"读', bx, 172, { color: C.green, font: '15px sans-serif' });
    text(f, '阈值：√s_min = Σm_末态 c²', bx, 226, { color: C.hot, font: '16px serif' });
    text(f, '对撞：E_thr = Σm/2', bx, 262, { color: C.cool, font: '15px serif' });
    text(f, '固定靶：E_thr ≈ (Σm)²/2m_靶（浪费在动能上）', bx, 294, { color: C.cool, font: '15px serif' });
    text(f, '发现新粒子：扫能量看 √s 处产额突增', bx, 344, { color: C.yellow, font: '14px sans-serif' });
    footnotes(f, [
      '四动量 pᵘ = (E/c, p⃗)：闵氏长度 pᵘp_μ = m²c² 是唯一"称重"方式',
      'LHC 14 TeV 对撞 ≈ 固定靶 10⁸ TeV —— 对撞机存在的全部理由',
      '粒子物理的命名法：J/ψ、Λ、Ω⁻ 全部来自不变质量峰',
    ]);
    heading(f, '对撞阈值题的万能钥匙');
  },
});
registerViz(invariantMassCollision);

/** P530 氢原子光谱与里德伯系。 */
const rydbergSeriesHydrogen = defineViz({
  slug: 'rydberg-series-hydrogen',
  title: '氢原子光谱与里德伯系',
  params: { nmax: { type: 'range', min: 2, max: 10, default: 6, step: 1, label: '最高能级 n' } },
  draw: (f) => {
    const { w, h, params } = f;
    const nmax = Math.round(num(params, 'nmax', 6));
    clear(f);
    // 左：能级图（-13.6/n²）
    const cx = w * 0.26;
    const E0 = h * 0.78;
    const E1 = h * 0.3;
    const sy = (n: number) => E0 + (E1 - E0) * (1 - 1 / (n * n)) / (1 - 1 / 36) * (n <= 6 ? 1 : 1);
    const levels: number[] = [];
    for (let n = 1; n <= Math.max(6, nmax); n++) {
      const y = E0 + (E1 - E0) * (1 - 1 / (n * n)) / (1 - 1 / 36);
      levels.push(y);
      seg(f, cx - 130, y, cx + 130, y, n === 1 ? C.hot : n === 2 ? C.cool : C.accent, n <= 2 ? 3.4 : 2.2);
      text(f, `n=${n}  E=${(-13.6 / (n * n)).toFixed(2)}eV`, cx - 250, y + 5, { color: C.fg, font: '13px serif' });
      if (n > 1) {
        // 跃迁箭头（n→2 巴尔末）
        const c = n <= nmax ? n : 6;
        vec(f, cx + 60 + (n % 3) * 24, levels[c - 1], cx + 60 + (n % 3) * 24, levels[1] + 4, C.yellow, 2, 7);
      }
    }
    void sy;
    text(f, 'E_n = −13.6/n² eV', cx - 250, E0 + 44, { color: C.yellow, font: '16px serif' });
    text(f, '能级越密越靠近 0（电离阈）', cx - 250, E0 + 74, { color: C.dim, font: '14px serif' });
    // 右：谱线系
    const rx = w * 0.54;
    const series: Array<[string, number, string, string]> = [
      ['莱曼系 n→1（紫外）', 1, C.hot, 'Ly-α 121.6nm'],
      ['巴尔末系 n→2（可见）', 2, C.green, 'Hα 656.3nm 红'],
      ['帕邢系 n→3（近红外）', 3, C.cool, '1.875μm'],
      ['布拉开/普丰德系', 4, C.accent, '4.05/7.5μm'],
    ];
    series.forEach(([name, nf, color, note], i) => {
      const y = 108 + i * 66;
      poly(f, [[rx, y], [rx + 340, y], [rx + 340, y + 52], [rx, y + 52]],
        { fill: `${color}14`, stroke: `${color}bb`, lw: 1.8 });
      text(f, name, rx + 14, y + 24, { color, font: '14px sans-serif' });
      text(f, note, rx + 14, y + 44, { color: C.dim, font: '12px sans-serif' });
      // 谱线示意（在框右侧画竖线）
      for (let k = 3; k <= Math.max(3, nmax); k++) {
        const lx = rx + 240 + (k - 3) * 22;
        if (lx < rx + 332) seg(f, lx, y + 8, lx, y + 44, color, 2);
      }
    });
    text(f, '里德伯公式 1/λ = R(1/n_f² − 1/n_i²)，R = 1.097×10⁷ m⁻¹', rx, 108 + 4 * 66 + 20, { color: C.yellow, font: '16px serif' });
    text(f, '里兹组合原则：谱线频率=两条线频之差 → 背后是能级', rx, 108 + 4 * 66 + 52, { color: C.fg, font: '14px sans-serif' });
    footnotes(f, [
      '1885 巴尔末凭数字拟出公式；1913 玻尔用量子化轨道解释 R 的来源',
      'R_∞ = m e⁴/8ε₀²h³c —— 组合了 m、e、h、c 四个基本常数（原子物理的基准）',
      '精细结构、兰姆位移、超精细：每层"修正"都打开一个新物理（QED 的三级台阶）',
    ]);
    heading(f, '光谱线是量子化的指纹');
  },
});
registerViz(rydbergSeriesHydrogen);

/** P531 不确定性关系与基态能量。 */
const uncertaintyGroundState = defineViz({
  slug: 'uncertainty-ground-state',
  title: '不确定性关系与基态能量',
  params: { width: { type: 'range', min: 0.4, max: 3, default: 1.2, step: 0.1, label: '波包宽度 Δx (×a₀)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const dx = num(params, 'width', 1.2);
    clear(f);
    // 左：两个高斯（位置窄→动量宽）
    const v = view(f, { xMin: -4, xMax: 4, yMin: 0, yMax: 1.6, inset: 46, insetBottom: 46 });
    grid(f, v);
    const g1: Array<[number, number]> = [], g2: Array<[number, number]> = [];
    for (let i = 0; i <= 240; i++) {
      const x = -4 + (i / 240) * 8;
      g1.push([v.sx(x), v.sy(Math.exp(-Math.pow(x / dx, 2)) * 1.05)]);
      g2.push([v.sx(x), v.sy(Math.exp(-Math.pow(x * dx * 0.8, 2)) * 0.62)]);
    }
    poly(f, g1, { stroke: C.cool, lw: 2.8 });
    poly(f, g2, { stroke: C.hot, lw: 2.4, dash: [7, 5] });
    text(f, `蓝：|ψ(x)|² 　Δx = ${dx.toFixed(2)}`, v.sx(-3.9), v.sy(1.55), { color: C.cool, font: '14px serif' });
    text(f, `红虚：|ψ(p)|² 　Δp ∝ 1/Δx = ${(1 / dx).toFixed(2)}`, v.sx(-3.9), v.sy(1.42), { color: C.hot, font: '14px serif' });
    text(f, dx < 1 ? '位置收得越紧，动量铺得越开（红包变宽）' : dx > 1.8 ? '位置摊开，动量变尖（红峰变窄）' : '两者此消彼长：乘积恒有下限',
      v.sx(-3.9), v.sy(0.2), { color: C.yellow, font: '14px serif' });
    text(f, 'x 或 p（同一坐标轴示意两种分布）', (v.sx(-4) + v.sx(4)) / 2, h - 50, { align: 'center', color: C.dim, font: '12px sans-serif' });
    // 右：用 ΔxΔp 估算零点能
    const bx = w * 0.56;
    text(f, '估算基态能量（变分式的粗算）：', bx, 96, { color: C.fg, font: '16px sans-serif' });
    const steps = [
      ['E ≈ p²/2m + ½mω²x²', C.cool],
      ['令 Δx ~ x，Δp ~ p', C.green],
      ['E(Δx) = ℏ²/8mΔx² + ½mω²Δx²', C.yellow],
      ['dE/d(Δx) = 0 ⇒ Δx = √(ℏ/mω)', C.warm],
      ['E_min = ½ℏω = 零点能 ✓', C.hot],
    ] as Array<[string, string]>;
    steps.forEach(([s, color], i) => text(f, s, bx, 140 + i * 44, { color, font: '16px serif' }));
    text(f, '不确定性关系直接给出量子基态 —— 不用解薛定谔方程', bx, 140 + 5 * 44 + 16, { color: C.green, font: '15px sans-serif' });
    text(f, '氢原子估计：Δx ~ a₀ ⇒ E ~ ℏ²/ma₀ ≈ 几 eV 量级 ✓', bx, 140 + 5 * 44 + 52, { color: C.cool, font: '14px sans-serif' });
    text(f, '定性：Δx→0 需要无限动量 ⇒ 禁止粒子静止在确定点', bx, 140 + 5 * 44 + 88, { color: C.dim, font: '14px sans-serif' });
    footnotes(f, [
      'ΔxΔp ≥ ℏ/2（罗伯逊界的一维特例）：不是测量干扰，是波函数的数学性质',
      '能量-时间不确定性 ΔEΔt ≥ ℏ/2：激发态寿命越短谱线越宽（自然线宽）',
      '零点能是宇宙的真实存在：液氦在 0K 不冻结、LC 电路噪声、LIGO 量子噪声',
    ]);
    heading(f, '用不确定关系估出零点能');
  },
});
registerViz(uncertaintyGroundState);

/** P532 霍尔效应与载流子判型。 */
const hallEffectCarriers = defineViz({
  slug: 'hall-effect-carriers',
  title: '霍尔效应与载流子判型',
  params: { carrier: { type: 'select', options: ['电子 (n 型)', '空穴 (p 型)'], default: '电子 (n 型)', label: '载流子' } },
  draw: (f) => {
    const { w, h, params } = f;
    const isElectron = str(params, 'carrier', '电子 (n 型)').startsWith('电子');
    clear(f);
    // 样品块
    const bx = w * 0.24, by = h * 0.3, bw = 280, bh = 140;
    poly(f, [[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]], { fill: 'rgba(45,55,72,0.85)', stroke: C.grid, lw: 2 });
    // 电流方向（向右）
    text(f, 'I', bx - 34, by + bh / 2 + 5, { color: C.yellow, font: '17px serif' });
    vec(f, bx - 30, by + bh / 2, bx + 8, by + bh / 2, C.yellow, 3);
    // B 出纸面
    for (let gx = bx + 30; gx < bx + bw; gx += 64) {
      for (let gy = by + 26; gy < by + bh; gy += 44) {
        dot(f, gx, gy, 4.4, C.cool);
      }
    }
    text(f, 'B ⊙（出纸面）', bx + bw - 108, by - 14, { color: C.cool, font: '14px serif' });
    // 载流子漂移
    const dir = isElectron ? -1 : 1; // 电子反向漂移
    for (let i = 0; i < 5; i++) {
      const t = ((f.t * 0.5 + i / 5) % 1);
      const x = bx + 20 + t * (bw - 40);
      const y = by + 34 + i * 18;
      dot(f, isElectron ? bx + bw - 20 - (x - bx - 20) : x, y, 6, isElectron ? C.cool : C.warm);
    }
    text(f, isElectron ? '电子漂移方向与 I 相反' : '空穴漂移方向与 I 相同', bx + 30, by + bh + 26, { color: isElectron ? C.cool : C.warm, font: '14px sans-serif' });
    // 洛伦兹力方向与霍尔电压
    const fy = isElectron ? by + bh : by; // 电子受力向上？q(v×B)：v 左，B 出 → v×B 向下，q<0 → 力向上
    const forceLabel = isElectron ? '洛伦兹力向上 → 电子聚上沿' : '洛伦兹力向下 → 空穴聚下沿';
    text(f, forceLabel, bx + 30, by - 34, { color: C.hot, font: '14px sans-serif' });
    const upper = isElectron ? by : by + bh;
    const lower = isElectron ? by + bh : by;
    // 霍尔电压极性
    poly(f, [[bx + bw, upper - 8], [bx + bw + 60, upper - 8], [bx + bw + 60, upper + 8], [bx + bw, upper + 8]],
      { fill: isElectron ? 'rgba(245,101,101,0.75)' : 'rgba(72,187,120,0.75)' });
    text(f, isElectron ? '−' : '+', bx + bw + 76, upper + 6, { color: isElectron ? C.cool : C.warm, font: '22px serif' });
    poly(f, [[bx + bw, lower - 8], [bx + bw + 60, lower - 8], [bx + bw + 60, lower + 8], [bx + bw, lower + 8]],
      { fill: isElectron ? 'rgba(72,187,120,0.75)' : 'rgba(245,101,101,0.75)' });
    text(f, isElectron ? '+' : '−', bx + bw + 76, lower + 6, { color: isElectron ? C.hot : C.cool, font: '22px serif' });
    text(f, 'V_H（霍尔电压）', bx + bw + 12, (upper + lower) / 2 + 5, { align: 'center', color: C.fg, font: '14px serif' });
    // 右侧公式
    const rx = w * 0.66;
    text(f, '平衡条件：qE_H = qvB ⇒', rx, 110, { color: C.fg, font: '16px serif' });
    text(f, 'V_H = IB/(nqt)', rx, 152, { color: C.yellow, font: '18px serif' });
    text(f, '霍尔系数 R_H = 1/(nq)', rx, 192, { color: C.green, font: '16px serif' });
    text(f, isElectron ? 'q < 0 ⇒ R_H < 0 ⇒ 极性翻转 —— n 型判据' : 'q > 0 ⇒ R_H > 0 ⇒ 极性正常 —— p 型判据',
      rx, 234, { color: C.hot, font: '15px sans-serif' });
    text(f, '一次测量同时得：载流子类型 + 浓度 n', rx, 290, { color: C.fg, font: '15px sans-serif' });
    text(f, '（迁移率 μ = σ|R_H| 顺带到手）', rx, 320, { color: C.dim, font: '14px sans-serif' });
    text(f, '量子霍尔：二维电子气 R_H = h/(νe²) 精确量子化 —— 电阻基准', rx, 372, { color: C.cool, font: '14px sans-serif' });
    text(f, '应用：半导体工业的日常表征、铟锡氧化物触摸屏、磁强计', 60, h - 76, { color: C.yellow, font: '15px sans-serif' });
    footnotes(f, [
      '霍尔 1879：本来想找磁场对载流子的偏转，顺手测出了载流子电荷符号',
      '金属 R_H 小（n 大）、半导体 R_H 大（n 小）：半导体更"敏感"',
      '萧克利看到霍尔系数随掺杂变号才懂半导体 —— 晶体管的前夜',
    ]);
    heading(f, '磁场里最诚实的测量');
  },
});
registerViz(hallEffectCarriers);

/** P533 塞曼效应与能级分裂。 */
const zeemanSplittingPattern = defineViz({
  slug: 'zeeman-splitting-pattern',
  title: '塞曼效应与能级分裂',
  params: { kind: { type: 'select', options: ['正常塞曼', '反常塞曼（Na D 线）'], default: '正常塞曼', label: '类型' }, B: { type: 'range', min: 0, max: 10, default: 5, step: 0.5, label: '磁场 B (T)' } },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'kind', '正常塞曼');
    const B = num(params, 'B', 5);
    clear(f);
    const anomalous = kind.startsWith('反常');
    // 左：能级分裂
    const cx = w * 0.26;
    const Jup = anomalous ? [0.5, 1.5] : [1, 1];
    const gl = anomalous ? [1, 1.334] : [1, 1];
    // 上下能级（取 J, mJ）
    const split = (J: number, g: number) => {
      const ms: number[] = [];
      for (let m = -J; m <= J + 1e-9; m += 1) ms.push(m);
      return ms.map((m) => ({ m, E: g * m * B * 0.16 }));
    };
    const lower = split(Jup[0], gl[0]);
    const upper = split(Jup[1], gl[1]);
    const baseU = h * 0.3, baseL = h * 0.6;
    const spread = 58;
    // 上能级
    for (const lv of upper) {
      const y = baseU - lv.E * spread;
      seg(f, cx - 110, y, cx + 110, y, C.cool, 3);
      text(f, `m=${lv.m === Math.round(lv.m) ? lv.m : lv.m.toFixed(1)}`, cx + 118, y + 5, { color: C.cool, font: '12px serif' });
    }
    for (const lv of lower) {
      const y = baseL - lv.E * spread;
      seg(f, cx - 110, y, cx + 110, y, C.warm, 3);
      text(f, `m=${lv.m === Math.round(lv.m) ? lv.m : lv.m.toFixed(1)}`, cx + 118, y + 5, { color: C.warm, font: '12px serif' });
    }
    // 跃迁线（Δm = 0, ±1）
    const lines: Array<{ x: number; color: string }> = [];
    for (const u of upper) {
      for (const l of lower) {
        const dm = u.m - l.m;
        if (Math.abs(dm) > 1) continue;
        const dE = (baseL - l.E * spread) - (baseU - u.E * spread);
        lines.push({ x: cx - 90 + lines.length * 26, color: dm === 0 ? C.green : dm === 1 ? C.hot : C.cool });
        void dE;
      }
    }
    text(f, '选择定则 Δm = 0, ±1（π 与 σ 线）', cx - 200, baseU - 96, { color: C.green, font: '14px serif' });
    // 右：谱线分裂图
    const gx0 = w * 0.56, gy = h * 0.5;
    seg(f, gx0, gy, w - 50, gy, C.grid, 1.6);
    text(f, 'λ', w - 62, gy + 24, { color: C.dim, font: '14px serif' });
    const center = (gx0 + w - 50) / 2;
    // 未加磁场
    seg(f, center, gy - 66, center, gy + 12, `${C.dim}aa`, 3);
    text(f, 'B = 0（单线）', center - 44, gy + 36, { color: C.dim, font: '13px serif' });
    if (B > 0.2) {
      if (!anomalous) {
        // 正常：三重线
        for (const [off, color] of [[-40, C.cool], [0, C.green], [40, C.hot]] as Array<[number, string]>) {
          seg(f, center + off * (B / 5), gy - 100, center + off * (B / 5), gy + 12, color, 3.4);
        }
        text(f, '正常塞曼：三条线（Lorentz 1896）', gx0, gy - 122, { color: C.fg, font: '15px serif' });
        text(f, 'Δλ = eλ²B/(4πm_ec) ≈ 0.47 nm·B/T', gx0, gy + 66, { color: C.yellow, font: '14px serif' });
      } else {
        // 反常：多重线
        const offs = [-64, -40, -26, -12, 12, 26, 40, 64];
        const cols = [C.cool, C.green, C.hot, C.warm, C.warm, C.hot, C.green, C.cool];
        offs.forEach((off, i) => {
          seg(f, center + off * (B / 5), gy - 108 + (i % 3) * 10, center + off * (B / 5), gy + 12, cols[i], 3);
        });
        text(f, '反常塞曼：更多条线（Na D 双线各裂成 4+6）', gx0, gy - 128, { color: C.fg, font: '15px serif' });
        text(f, '自旋参与 ⇒ g 因子不同 ⇒ 电子自旋的早期证据', gx0, gy + 66, { color: C.yellow, font: '14px serif' });
      }
    }
    text(f, `B = ${B.toFixed(1)} T：分裂间距 ∝ B`, gx0, gy - 84, { color: C.yellow, font: '15px serif' });
    // 底部
    text(f, 'ΔE = g·μ_B·m_J·B　μ_B = eℏ/2m_e = 5.79×10⁻⁵ eV/T', 56, h - 92, { color: C.fg, font: '16px serif' });
    text(f, '应用：天文磁场测量（Zeeman 分裂测太阳黑子）、STM 单原子谱、EPR/ESR', 56, h - 62, { color: C.cool, font: '14px sans-serif' });
    footnotes(f, [
      '正常塞曼（单重线裂三条）：纯轨道磁矩；反常塞曼需要自旋 + 相对论修正',
      'Paschen-Back 强场区：自旋与轨道先各自与 B 耦合，图案再次简化',
      'g 因子精确检验 QED：电子反常磁矩 a_e = (g−2)/2 是物理学最准的预言',
    ]);
    heading(f, '角动量量子化的可见证据');
  },
});
registerViz(zeemanSplittingPattern);