import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, heading, poly, seg, text, view } from '../canvas';

/** P74 单缝衍射。 */
const singleSlit = defineViz({
  slug: 'single-slit', title: '单缝衍射',
  params: {
    a: { type: 'range', min: 1, max: 10, default: 3, step: 0.5, label: '缝宽 a（λ 倍）' },
    lambda: { type: 'range', min: 400, max: 700, default: 550, step: 10, label: '波长 (nm)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 3);
    const lam = num(params, 'lambda', 550);
    const hue = ((lam - 400) / 300) * 240;
    const lightColor = `hsl(${360 - hue}, 85%, 58%)`;
    clear(f);
    const x0 = 56, x1 = w - 30, y0 = h - 56, y1 = 56;
    seg(f, x0, y0, x1, y0, C.grid, 1.3);
    seg(f, x0, y0, x0, y1, C.grid, 1.3);
    const sx = (th: number) => x0 + ((th + 0.5) / 1) * (x1 - x0);
    const sy = (I: number) => y0 - I * (y0 - y1);
    const Iof = (th: number): number => {
      const u = Math.PI * a * Math.sin(th);
      const s = u === 0 ? 1 : Math.sin(u) / u;
      return s * s;
    };
    const pts: [number, number][] = [];
    for (let i = 0; i <= 400; i++) {
      const th = -0.5 + (i / 400) * 1;
      pts.push([sx(th), sy(Iof(th))]);
    }
    poly(f, pts, { stroke: lightColor, lw: 2.6 });
    // 极小位置标记
    for (const m of [-1, 1]) {
      const th = Math.asin(Math.min(1, m / a));
      if (Math.abs(th) <= 0.5) {
        seg(f, sx(th), y0, sx(th), y1, `${C.green}66`, 1.2);
        text(f, '极小', sx(th), y1 - 6, { align: 'center', color: C.green, font: '10px sans-serif' });
      }
    }
    text(f, '中央亮纹最宽（两侧极小间距的两倍）', 30, 44, { color: C.cyan, font: '12px sans-serif' });
    text(f, `a = ${a}λ：${a > 3 ? '缝越宽衍射越不明显（直线传播回归）' : '缝越窄衍射越展开'}`, 30, h - 34, { color: C.warm, font: '12px sans-serif' });
    void view;

    footnotes(f, [
      `强度 I = sinc²(πa·sinθ/λ)，第一极小在 sinθ = λ/a —— 缝宽 a=${a}λ`,
      '半波带分析法：把缝分成偶数份，两两相消——菲涅耳的直观几何',
      '声波过门缝能绕墙、光过窄缝不能——因为声波波长与门同量级而光波远小于缝',
    ]);
    heading(f, '单缝衍射：光不再走直线');
  },
});
registerViz(singleSlit);

/** P75 艾里斑与分辨极限。 */
const airyDisk = defineViz({
  slug: 'airy-disk', title: '艾里斑与分辨极限', animated: true,
  params: {
    D: { type: 'range', min: 2, max: 30, default: 8, step: 1, label: '孔径 D（mm 相对）' },
    sep: { type: 'range', min: 0.2, max: 3, default: 1.2, step: 0.1, label: '双星角距（瑞利单位）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const D = num(params, 'D', 8);
    const sep = num(params, 'sep', 1.2);
    clear(f);
    const cy = h * 0.4;
    // 两个艾里斑（Airy函数近似为 sinc² 圆斑）
    const centers = [w * 0.42 - sep * 40, w * 0.42 + sep * 40];
    const resolved = sep >= 1;
    const drawSpot = (cx: number, alpha: number): void => {
      for (let ring = 0; ring <= 8; ring++) {
        const r = ring * 9;
        const bright = ring === 0 ? 0.95 : Math.max(0.06, 0.5 / (ring * ring));
        f.ctx.beginPath();
        f.ctx.arc(cx, cy, r, 0, Math.PI * 2);
        f.ctx.fillStyle = `rgba(255,240,200,${bright * alpha * (ring === 0 ? 1 : 0.35)})`;
        f.ctx.fill();
      }
      f.ctx.beginPath(); f.ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      f.ctx.fillStyle = `rgba(255,250,230,${alpha})`; f.ctx.fill();
    };
    drawSpot(centers[0], 0.95);
    drawSpot(centers[1], 0.95);
    text(f, resolved ? '能分辨（角距 ≥ 瑞利判据：中心落在对方第一极小）' : '不能分辨（两斑重叠成一坨）',
      30, 44, { color: resolved ? C.green : C.hot, font: '13px sans-serif' });
    text(f, `θ_min = 1.22 λ/D：孔径 D=${D}，D 越大斑越小`, 30, h - 34, { color: C.cyan, font: '12px sans-serif' });
    // 衍射极限示意
    text(f, '点光源成像 = 艾里斑（中心亮斑+同心环）', w * 0.5, h - 60, { align: 'center', color: C.dim, font: '11px sans-serif' });

    footnotes(f, [
      '任何光学仪器都把点成像成斑——望远镜、显微镜、人眼的分辨率都被衍射封顶',
      'JWST 6.5 米口径的角分辨率约 0.07 角秒；地球大小的虚拟望远镜（EHT）才拍到黑洞影子',
      '自适应光学实时校正大气抖动，让地面大镜接近衍射极限',
    ]);
    heading(f, '艾里斑：衍射给分辨率上的天花板');
  },
});
registerViz(airyDisk);

/** P76 衍射光栅。 */
const grating = defineViz({
  slug: 'grating', title: '衍射光栅',
  params: {
    N: { type: 'range', min: 2, max: 60, default: 20, step: 1, label: '缝数 N' },
    d: { type: 'range', min: 2, max: 12, default: 5, step: 0.5, label: '光栅常数 d（λ 倍）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const N = Math.round(num(params, 'N', 20));
    const d = num(params, 'd', 5);
    clear(f);
    const x0 = 56, x1 = w - 30, y0 = h - 56, y1 = 56;
    seg(f, x0, y0, x1, y0, C.grid, 1.3);
    seg(f, x0, y0, x0, y1, C.grid, 1.3);
    const sx = (th: number) => x0 + ((th + 0.6) / 1.2) * (x1 - x0);
    const sy = (I: number) => y0 - I * (y0 - y1);
    // 多缝干涉 × 单缝因子
    const Ifn = (th: number): number => {
      const b = Math.PI * d * Math.sin(th);
      const single = Math.abs(Math.PI * Math.sin(th)) < 1e-9 ? 1 : Math.pow(Math.sin(Math.PI * Math.sin(th)) / (Math.PI * Math.sin(th)), 2);
      const inter = Math.abs(Math.sin(N * b) / (N * Math.sin(b) || 1e-9)) ** 2;
      return Math.min(1, inter * (0.35 + 0.65 * single));
    };
    const pts: [number, number][] = [];
    for (let i = 0; i <= 600; i++) {
      const th = -0.6 + (i / 600) * 1.2;
      pts.push([sx(th), sy(Ifn(th))]);
    }
    poly(f, pts, { stroke: C.warm, lw: 2.4 });
    text(f, `N=${N} 条缝：主极大宽度 ∝ 1/N —— ${N > 10 ? '条纹又锐又亮，光谱分辨本领强' : '缝少条纹宽钝'}`, 30, 44, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      `光栅方程 d·sinθ = kλ（d=${d}λ）：同级下长波长偏折更大——光谱仪把白光展开成彩虹`,
      '缝数 N 决定锐度：天文光栅上千条缝，能把星系光谱的吸收线一根根分开',
      '光谱学是天体物理的化学分析：恒星成分、红移、磁场都从这些条纹读出',
    ]);
    heading(f, '衍射光栅：把光拆成谱');
  },
});
registerViz(grating);

/** P77 牛顿环。 */
const newtonRings = defineViz({
  slug: 'newton-rings', title: '牛顿环',
  params: {
    R: { type: 'range', min: 5, max: 40, default: 15, step: 1, label: '透镜曲率半径（相对）' },
    lam: { type: 'range', min: 400, max: 700, default: 589, step: 10, label: '波长 (nm)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const Rl = num(params, 'R', 15);
    const lam = num(params, 'lam', 589);
    const hue = ((lam - 400) / 300) * 240;
    const color = `hsl(${360 - hue}, 85%, 60%)`;
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    // 环半径 r_k = √(k·R·λ)（缩放）
    const kMax = 9;
    for (let k = 0; k <= kMax; k++) {
      const r = Math.sqrt((k + 0.5) * Rl * (lam / 589)) * 16;
      const bright = k % 2 === 0;
      f.ctx.beginPath();
      f.ctx.arc(cx, cy, r, 0, Math.PI * 2);
      f.ctx.strokeStyle = bright ? color : '#0a0a1a';
      f.ctx.lineWidth = bright ? 7 : 7;
      f.ctx.globalAlpha = bright ? 0.9 : 0.85;
      f.ctx.stroke();
      f.ctx.globalAlpha = 1;
    }
    dot(f, cx, cy, 4, '#0a0a1a');
    text(f, `接触点为暗斑（半波损失）：第 k 环半径 r = √(kRλ)`, 30, 44, { color: C.cyan, font: '12px sans-serif' });
    text(f, `R=${Rl}、λ=${lam}nm：环间距随级次变疏`, 30, h - 34, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      '平凸透镜与平板间的空气隙厚度随半径增大，等厚处形成同一级干涉环',
      '检验光学元件表面平整度的经典手段：牛顿环的畸变直接读出面形误差',
      '换用白光则出现彩色环——不同波长的亮环半径不同（色分辨直观演示）',
    ]);
    heading(f, '牛顿环：等厚干涉的同心圆');
  },
});
registerViz(newtonRings);

/** P78 薄膜干涉。 */
const thinFilm = defineViz({
  slug: 'thin-film', title: '薄膜干涉', animated: true,
  params: {
    n: { type: 'range', min: 1.2, max: 2.4, default: 1.33, step: 0.01, label: '膜折射率 n' },
    thick: { type: 'range', min: 100, max: 800, default: 350, step: 10, label: '膜厚 (nm)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = num(params, 'n', 1.33);
    const dk = num(params, 'thick', 350);
    clear(f);
    const cx = w / 2;
    // 薄膜截面
    const filmY = h * 0.42, filmH = 40;
    poly(f, [[cx - 200, filmY], [cx + 200, filmY], [cx + 200, filmY + filmH], [cx - 200, filmY + filmH]],
      { stroke: C.dim, lw: 2, fill: `rgba(80,160,255,${0.12 + (dk / 800) * 0.2})` } as any);
    text(f, `空气 n₁=1`, cx - 250, filmY - 14, { color: C.dim, font: '11px sans-serif' });
    text(f, `薄膜 n₂=${n}，厚 d=${dk}nm`, cx - 250, filmY + filmH + 26, { color: C.cool, font: '11px sans-serif' });
    // 两束反射光（上表面反射 + 下表面反射）
    for (const off of [0, 1]) {
      const xStart = cx - 150 + off * 6;
      const pts: [number, number][] = [];
      for (let i = 0; i < 40; i++) {
        const t = i / 39;
        if (off === 0) pts.push([xStart + t * 120, filmY - t * 90]);
        else pts.push([xStart + 40 + t * 120, filmY - t * 90 + 8]);
      }
      poly(f, pts, { stroke: off ? C.cyan : C.hot, lw: 2 });
      // 波形调制
      text(f, off ? '光束②（下表面）' : '光束①（上表面）', pts[38][0] + 6, pts[38][1], { color: off ? C.cyan : C.hot, font: '10px sans-serif' });
    }
    // 出射颜色（相长/相消由 2nd cos 判定示意）
    const phase = (4 * Math.PI * n * dk) / (lamOf(h));
    const constructive = Math.cos(phase / 2) ** 2;
    const hue = ((589 - 400) / 300) * 240;
    text(f, constructive > 0.5 ? `相长：该厚度对黄光呈亮色（反射增强）` : `相消：该厚度对黄光呈暗色（增透）`,
      30, 44, { color: constructive > 0.5 ? `hsl(${360 - hue},85%,60%)` : C.dim, font: '13px sans-serif' });
    void view;

    function lamOf(_f: unknown): number { return 589; }

    footnotes(f, [
      `光程差 2·n·d（再计半波损失）：d=${dk}nm、n=${n} 时干涉级次 m≈${Math.round((2 * n * dk) / 589)}`,
      '相机镜头的增透膜把反射光相消掉，透光率提升——膜厚恰为四分之一波长',
      '肥皂泡的彩：厚度百纳米级的膜对不同波长同时满足不同级次，颜色随角度流动',
    ]);
    heading(f, '薄膜干涉：两束反射光的对话');
  },
});
registerViz(thinFilm);

/** P79 马吕斯定律与偏振。 */
const malus = defineViz({
  slug: 'malus', title: '马吕斯定律与偏振',
  params: {
    theta: { type: 'range', min: 0, max: 90, default: 45, step: 1, label: '检偏器夹角 (°)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const th = (num(params, 'theta', 45) * Math.PI) / 180;
    const T = Math.cos(th) ** 2;
    clear(f);
    // 三段：起偏 → 检偏 → 输出
    const y = h / 2 + 6;
    const xs = [w * 0.2, w * 0.5, w * 0.8];
    // 入射自然光（全向振动示意）
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI;
      seg(f, xs[0] - 60, y + Math.sin(a) * 22, xs[0] - 60, y - Math.sin(a) * 22, `${C.dim}88`, 1);
      seg(f, xs[0] - 60, y, xs[0] - 60 + Math.cos(a) * 30, y - Math.sin(a) * 26 * 0 + Math.sin(a) * 26, `${C.dim}88`, 1);
      break;
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI;
      seg(f, xs[0] - 76, y - Math.cos(a) * 26, xs[0] - 76, y + Math.cos(a) * 26, `${C.dim}77`, 1);
    }
    text(f, '自然光（各方向振动）', xs[0] - 100, y - 52, { color: C.dim, font: '11px sans-serif' });
    // 起偏器
    drawPolarizer(xs[0], y, 0, C.cool, '起偏器 0°');
    // 线偏振光（水平振动）
    seg(f, xs[0] + 34, y, xs[1] - 40, y, C.cool, 3);
    for (let k = 0; k < 5; k++) {
      seg(f, xs[0] + 50 + k * 36, y - 14, xs[0] + 50 + k * 36, y + 14, `${C.cool}77`, 1.4);
    }
    text(f, '线偏振光', (xs[0] + xs[1]) / 2 - 30, y - 34, { color: C.cool, font: '11px sans-serif' });
    // 检偏器（角度 th）
    drawPolarizer(xs[1], y, th, C.warm, `检偏器 ${((th * 180) / Math.PI).toFixed(0)}°`);
    // 输出光强
    const out = Math.max(T, 0.015);
    seg(f, xs[1] + 34, y, w - 40, y, C.hot, 1 + out * 4);
    text(f, `T = cos²θ = ${T.toFixed(3)}`, xs[1] + 40, y - 44, { color: C.hot, font: '14px sans-serif' });
    if (T < 0.02) text(f, '消光！两偏振片正交——液晶显示的像素开关', xs[1] + 40, y + 44, { color: C.green, font: '12px sans-serif' });

    function drawPolarizer(x: number, yy: number, angle: number, color: string, label: string): void {
      const half = 46;
      poly(f, [[x - 8, yy - half], [x + 8, yy - half], [x + 8, yy + half], [x - 8, yy + half]],
        { stroke: color, lw: 2, fill: `${color}33` } as any);
      // 透光轴
      const dx = Math.cos(angle) * half, dy = Math.sin(angle) * half;
      seg(f, x - dx, yy - dy, x + dx, yy + dy, color, 2);
      text(f, label, x, yy + half + 16, { align: 'center', color, font: '11px sans-serif' });
    }
    void view;

    footnotes(f, [
      '起偏器选定振动方向，检偏器与之夹角 θ 决定透光率——马吕斯定律 T=cos²θ',
      '夹角 90° 完全消光：液晶屏每个像素就是一对可电控角度的偏振片',
      '布儒斯特角下反射光完全偏振——拍摄水面倒影的摄影师偏振镜由此工作',
    ]);
    heading(f, '偏振：光的振动方向');
  },
});
registerViz(malus);

/** P80 双折射。 */
const birefringence = defineViz({
  slug: 'birefringence', title: '双折射', animated: true,
  params: {
    axis: { type: 'range', min: 0, max: 180, default: 45, step: 1, label: '晶轴方向 (°)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const ax = (num(params, 'axis', 45) * Math.PI) / 180;
    clear(f);
    const cx = w / 2, cy = h / 2 + 6;
    // 方解石晶体（平行四边形）
    const S = Math.min(w, h) * 0.24;
    poly(f, [[cx - S, cy - S * 0.5], [cx + S * 0.7, cy - S * 0.7], [cx + S, cy + S * 0.5], [cx - S * 0.7, cy + S * 0.7]],
      { stroke: C.dim, lw: 2.2, fill: 'rgba(148,163,184,0.12)' } as any);
    // 晶轴
    seg(f, cx - Math.cos(ax) * S * 1.2, cy - Math.sin(ax) * S * 1.2, cx + Math.cos(ax) * S * 1.2, cy + Math.sin(ax) * S * 1.2, `${C.warm}aa`, 1.6);
    text(f, '光轴', cx + Math.cos(ax) * S * 1.2 + 6, cy + Math.sin(ax) * S * 1.2, { color: C.warm, font: '11px sans-serif' });
    // 入射光
    const inX = 40, inY = cy - 60;
    seg(f, inX, inY, cx - 30, cy - 10, C.hot, 2.4);
    // o光与e光（折射方向不同）
    const t = f.t;
    const jitter = Math.sin(t * 2) * 2;
    seg(f, cx + 30, cy + 10, w - 60, cy + 74 + jitter, C.cool, 2.4);
    seg(f, cx + 30, cy + 10, w - 60, cy + 100 - jitter * 2, C.cyan, 2.4);
    text(f, 'o 光（寻常光，遵守折射定律）', w - 60, cy + 90, { align: 'end' as never, color: C.cool, font: '11px sans-serif' });
    text(f, 'e 光（非寻常光，偏离晶轴方向）', w - 60, cy + 118, { color: C.cyan, font: '11px sans-serif' });
    text(f, '一束进、两束出 — 各自有独立折射率与偏振方向', 30, 44, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      '方解石中 o 光各向同性、e 光折射率随方向变化——晶体的双折射源于离子排列的各向异性',
      '尼科耳棱镜把两束分开的光只留一束，成为十九世纪的标准起偏器',
      '液晶显示、应力双折射（玻璃检验）、棱镜光谱仪都靠双折射工作',
    ]);
    heading(f, '双折射：一束光劈成两束');
  },
});
registerViz(birefringence);

/** P81 迈克尔逊干涉仪。 */
const michelsonInterferometer = defineViz({
  slug: 'michelson-interferometer', title: '迈克尔逊干涉仪', animated: true,
  params: {
    dl: { type: 'range', min: 0, max: 4, default: 1, step: 0.05, label: '臂长差（λ 倍）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const dl = num(params, 'dl', 1);
    clear(f);
    const cx = w * 0.4, cy = h / 2 + 6, arm = Math.min(w, h) * 0.26;
    // 分束器
    poly(f, [[cx - 26, cy - 26], [cx + 26, cy + 26], [cx + 34, cy + 18], [cx - 18, cy - 34]], { stroke: C.warm, lw: 2.4, fill: 'rgba(237,137,54,0.35)' } as any);
    text(f, '分束器 50/50', cx + 44, cy - 6, { color: C.warm, font: '11px sans-serif' });
    // 两臂与反射镜
    seg(f, cx, cy, cx + arm, cy, C.hot, 2.4);           // 臂1（右）
    seg(f, cx, cy, cx, cy - arm, C.cool, 2.4);          // 臂2（上）
    seg(f, cx + arm - 8, cy - 26, cx + arm + 8, cy + 26, C.hot, 4);
    seg(f, cx - 26, cy - arm + 8, cx + 26, cy - arm - 8, C.cool, 4);
    text(f, `臂长 L₁`, cx + arm * 0.55, cy - 10, { color: C.hot, font: '11px sans-serif' });
    text(f, `臂长 L₂ ${dl > 0 ? `（差 ${dl}λ）` : ''}`, cx + 12, cy - arm * 0.5, { color: C.cool, font: '11px sans-serif' });
    // 入射与出射
    seg(f, 40, cy + 70, cx, cy, C.green, 2.4);
    text(f, '光源', 40, cy + 88, { color: C.green, font: '11px sans-serif' });
    seg(f, cx, cy, cx, cy + arm * 0.9, C.cyan, 2.4);
    // 干涉条纹（屏幕）
    const scrX = cx - 8, scrY0 = cy + arm * 0.9;
    for (let i = -6; i <= 6; i++) {
      const phase = ((i * 0.5 + dl * 2 + f.t * 0.4) % 2);
      const a = Math.cos(phase * Math.PI) ** 2;
      f.ctx.fillStyle = `rgba(122,215,255,${0.15 + a * 0.8})`;
      f.ctx.fillRect(scrX - 60 + (i + 6) * 10, scrY0, 10, 44);
    }
    text(f, '干涉条纹：臂长每变 λ/2，条纹移动一格', scrX - 100, scrY0 + 60, { color: C.cyan, font: '11px sans-serif' });

    footnotes(f, [
      '两束光分路再汇合，相位差完全由臂长差决定——把长度测量变成数条纹',
      'LIGO 把它放大到 4 公里并垂直放置，测 10⁻²¹ 的应变；迈克尔逊用它否定以太',
      '引力波探测、光学平台检测、光谱分析（傅里叶变换光谱仪）都是它的后代',
    ]);
    heading(f, '迈克尔逊干涉仪：把长度变成条纹');
  },
});
registerViz(michelsonInterferometer);

/** P82 泊松亮斑。 */
const poissonSpot = defineViz({
  slug: 'poisson-spot', title: '泊松亮斑', animated: true,
  params: {
    R: { type: 'range', min: 10, max: 60, default: 30, step: 2, label: '圆盘半径 (mm)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const R = num(params, 'R', 30);
    clear(f);
    const cx = w * 0.3, cy = h / 2 + 6;
    const scrX = w * 0.72;
    // 点源
    dot(f, cx - w * 0.2, cy, 5, C.warm);
    text(f, '点光源', cx - w * 0.2 - 24, cy - 14, { color: C.warm, font: '11px sans-serif' });
    // 圆盘
    seg(f, cx, cy - R, cx, cy + R, C.dim, 4);
    text(f, '不透明圆盘', cx - 34, cy - R - 12, { color: C.dim, font: '11px sans-serif' });
    // 衍射光线绕过边缘汇聚到屏中央（惠更斯子波）
    for (const yy of [-R, -R * 0.5, 0, R * 0.5, R]) {
      const path: [number, number][] = [];
      for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        const x = cx + t * (scrX - cx);
        const ySrc = yy * (1 - t * 0.82);
        path.push([x, cy + ySrc]);
      }
      poly(f, path, { stroke: `${C.cool}77`, lw: 1.3 });
    }
    // 屏与亮斑
    seg(f, scrX, cy - R * 1.6, scrX, cy + R * 1.6, C.dim, 3);
    const pulse = 0.7 + 0.3 * Math.sin(f.t * 3);
    f.ctx.beginPath(); f.ctx.arc(scrX + 6, cy, 7, 0, Math.PI * 2);
    f.ctx.fillStyle = `rgba(255,250,220,${pulse})`; f.ctx.fill();
    f.ctx.beginPath(); f.ctx.arc(scrX + 6, cy, 14, 0, Math.PI * 2);
    f.ctx.strokeStyle = `rgba(255,250,220,${pulse * 0.4})`; f.ctx.lineWidth = 3; f.ctx.stroke();
    text(f, '阴影正中的亮斑', scrX + 26, cy - 20, { color: '#fffbeb', font: '12px sans-serif' });
    text(f, `圆盘半径 R=${R}mm — 越小亮斑越强（衍射越显著）`, 30, 44, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      "泊松 1818 年用波动说'归谬'：若光是波，阴影中心必有亮点——他以为这荒谬，阿拉果却实验找到了它",
      '圆盘边缘的子波在轴线上路程差为零，相长叠加成亮斑——波动说的胜利判决',
      '同轴激光的中空光束、光镊的暗斑都延续着这套衍射图像',
    ]);
    heading(f, '泊松亮斑：一个反直觉的胜利');
  },
});
registerViz(poissonSpot);

/** P83 倏逝波。 */
const evanescent = defineViz({
  slug: 'evanescent', title: '倏逝波',
  params: {
    d: { type: 'range', min: 50, max: 600, default: 200, step: 10, label: '第二介质厚度 (nm)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const d = num(params, 'd', 200);
    clear(f);
    const cx = w / 2, ifaceY = h / 2 + 6;
    // 介质分区
    f.ctx.fillStyle = 'rgba(56,130,215,0.10)';
    f.ctx.fillRect(0, ifaceY, w, h - ifaceY);
    seg(f, 30, ifaceY, w - 30, ifaceY, C.cool, 2.4);
    text(f, '介质 n₁（光密）', 40, ifaceY - 14, { color: C.dim, font: '11px sans-serif' });
    text(f, `介质 n₂（光疏）厚 ${d}nm`, 40, ifaceY + 24, { color: C.cool, font: '11px sans-serif' });
    // 全反射入射光
    const inX = w * 0.26, inY = ifaceY - h * 0.3;
    seg(f, inX, inY, cx, ifaceY, C.hot, 2.6);
    seg(f, cx, ifaceY, w - 0.26 * w, ifaceY - h * 0.3, C.hot, 2.6);
    text(f, '全反射', cx + 10, ifaceY - h * 0.3 + 14, { color: C.hot, font: '12px sans-serif' });
    //倏逝波（指数衰减）
    const ez: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      const y = ifaceY + t * Math.min(90, h * 0.32);
      const amp = Math.exp(-t * 4) * 40;
      const x = cx + Math.sin(t * 18 + f.t * 3) * amp;
      ez.push([x, y]);
    }
    poly(f, ez, { stroke: C.cyan, lw: 2.4 });
    // 第二介质中的接收（受抑全反射）
    const through = d < 300;
    if (through) {
      seg(f, cx, ifaceY + Math.min(90, h * 0.32), w - 60, h - 50, `${C.green}cc`, 2.2);
      text(f, "足够薄 → 光'隧穿'到另一侧（受抑全反射）", w - 60, h - 36, { align: 'right' as never, color: C.green, font: '11px sans-serif' });
    }
    text(f, '场强 ∝ e^(−z/d_p)：穿透深度仅百纳米量级', 30, 44, { color: C.cyan, font: '12px sans-serif' });

    footnotes(f, [
      "全反射时光并未'消失'，而是以倏逝场渗入第二介质——近场光学与隐失波耦合的基础",
      '扫描近场光学显微镜（SNOM）用纳米探针抓住倏逝场，分辨率突破衍射极限',
      '光纤弯曲损耗、波导耦合器乃至量子参照的卡西米尔力都与倏逝场有关',
    ]);
    heading(f, '倏逝波：界面另一侧的隐匿场');
  },
});
registerViz(evanescent);
