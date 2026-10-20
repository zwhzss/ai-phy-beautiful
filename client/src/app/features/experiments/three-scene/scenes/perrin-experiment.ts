import type { SceneContext, SceneInstance } from '../types';

/**
 * 佩兰实验（P307）：悬浮微粒布朗运动 —— 用统计确证阿伏伽德罗常数 N_A。
 *
 * 核心物理（画面几何与读数全部由下列公式驱动，两分支相互独立却收敛到同一个 N_A）：
 *   ① Stokes–Einstein 扩散系数   D = k·T / (6π·η·a)，  k = R/N_A（玻尔兹曼常数）
 *   ② 二维布朗运动均方位移        ⟨Δr²⟩ = 2·d·D·t = 4·D·t（d=2，显微镜焦平面内 x–z 二维无规行走）
 *      → 每轴每步 Langevin 增量 Δ ~ N(0, 2D·dt)，即 std=√(2D·dt)；⟨Δr²⟩–t 直线斜率 = 4D
 *   ③ 沉降–扩散平衡高度分布       n(h) = n₀·exp(−m_eff·g·h / k·T)，标度高 λ = k·T/(m_eff·g)
 *      m_eff = (4/3)π·a³·Δρ（浮力质量）；指数分布 mean(h)=λ（无偏 MLE）
 *   ④ 反推 N_A（只用可测量与已知常量 R,η,a,T,Δρ）：
 *        分支A：由 MSD 斜率测得 D → k = D·6πηa/T → N_A = R/k
 *        分支B：由高度分布测得 λ → k = m_eff·g·λ/T → N_A = R/k
 *
 * 扫描自变量：颗粒半径 a 在 0.3–0.9 µm 间周期扫描（18 s 一周）。a↓ ⇒ D↑（游走更快、MSD 斜率更陡）、
 *   λ↑（高度分布更高更散）——几何随条件改变可见；但两分支反推的 N_A 与 a 无关，恒落在 ≈6.0×10²³ mol⁻¹
 *   （有限颗粒 → 统计涨落，正是佩兰“改变粒子大小、多次测量仍得同一常数”的阿伏伽德罗确证）。
 *
 * 反演细节：布朗窗口法——每窗(1.8 s)把系综局部坐标归零重锚定，使扩散云团始终留在观察室内、位移不被截断，
 *   窗内 a 视常；⟨Δr²⟩=mean_p|p_p(τ)|²（相对锚点）→ 窗末最小二乘斜率/4=D_win → N_A_win；对 N_A 估计做
 *   指数滑动平均（τ≈6 s，N_A 与 a 无关故可跨不同 a 池化）得稳定读数。当前窗 (τ,⟨Δr²⟩) 散点 + 拟合线实时上屏。
 *   高度分布按解析平衡分布 n∝exp(−h/λ(a)) 对有限颗粒做逆 CDF 采样（真实沉降平衡需数小时，动画时长不足，
 *   故直接按理论平衡分布采样以在固定 µm 轴上呈现分布形状随 a 变陡，并用 mean(h) 归算 λ→N_A）。
 *
 * 单位与放大：内部全程 SI（米、秒、m²/s），1 世界单位 = 1/WMU µm；布朗云团与沉降柱按各自 µm 尺度线性放大显示。
 *   校验脚本：_scratch/r4fix/perrin/verify.mjs（两分支 ±5%）、runavg.mjs（逐窗 N_A 运行均值收敛 5.9–6.8e23、
 *   预热后近窗波动 ±1–2%）、finalcheck.mjs / ou2.mjs（放弃慢 OU 弛豫、改用逆 CDF 采样的依据）。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  // —— 资源登记，dispose 统一释放 ——
  const geos: { dispose(): void }[] = [];
  const mats: { dispose(): void }[] = [];
  const texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  // —— 可复现随机源（mulberry32：低比特 LCG 会让 Box–Muller 方差偏移，MSD 斜率随之偏差）——
  let s32 = 0x9e3f77b9;
  const rnd = (): number => {
    s32 |= 0; s32 = (s32 + 0x6d2b79f5) | 0;
    let t = Math.imul(s32 ^ (s32 >>> 15), 1 | s32);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = (): number => {
    let u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  // —— 常量（SI）——
  const R = 8.314462618;              // 气体常数 J/(mol·K)（已知）
  const NA_TRUE = 6.02214076e23;      // 仅用于“仿真驱动”的真值：nature 里的 N_A
  const K_B = R / NA_TRUE;            // 玻尔兹曼常数（=R/N_A，本应是被测出的未知量）
  const TEMP = 293;                   // 20 °C
  const ETA = 1.0e-3;                 // 介质黏度 Pa·s（水）
  const DRHO = 150;                   // 颗粒–介质密度差 kg/m³（教学化简，面板声明）
  const GRAV = 9.81;
  const WMU = 0.9;                    // 世界单位 / µm（布朗云团显示放大）
  const UM = 1e6;                     // m → µm

  const D_of = (a_m: number): number => (K_B * TEMP) / (6 * Math.PI * ETA * a_m);   // m²/s（真值）
  const mEff = (a_m: number): number => (4 / 3) * Math.PI * a_m ** 3 * DRHO;          // kg
  const lambda_of = (a_m: number): number => (K_B * TEMP) / (mEff(a_m) * GRAV);       // m（标度高真值）

  // —— 星野 ——
  const starGeo = geo(new THREE.BufferGeometry());
  {
    const p = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      p[i * 3] = (Math.random() - 0.5) * 200;
      p[i * 3 + 1] = (Math.random() - 0.5) * 200;
      p[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  }
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));

  // —— 地面栅格 ——
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  grid.position.y = -2.6;
  group.add(grid);

  // —— 观察室（显微镜焦平面薄片，半透明）+ 锚点标记 ——
  const chamber = new THREE.Mesh(
    geo(new THREE.BoxGeometry(8.4, 0.9, 8.4)),
    mat(new THREE.MeshPhysicalMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.06, roughness: 0.1, side: THREE.DoubleSide })),
  );
  chamber.position.set(0, 0.35, 0);
  group.add(chamber);
  const chamberEdge = new THREE.LineSegments(
    geo(new THREE.EdgesGeometry(chamber.geometry)),
    mat(new THREE.LineBasicMaterial({ color: 0x1e3a5f })),
  );
  chamberEdge.position.copy(chamber.position);
  group.add(chamberEdge);
  const anchorRing = new THREE.Mesh(
    geo(new THREE.RingGeometry(0.12, 0.2, 24)),
    mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide })),
  );
  anchorRing.rotation.x = -Math.PI / 2;
  anchorRing.position.set(0, -0.12, 0);
  group.add(anchorRing);

  // ============ 分支 A：二维布朗系综（x–z 焦平面内无规行走 + 尾迹）============
  const NP_A = 20;
  const TRAIL = 66;
  const WINDOW = 1.8;                          // MSD 测量窗（秒）
  interface Granule {
    x: number; z: number;                       // 相对本窗锚点的位移（米）
    mesh: import('three').Mesh;
    trailGeo: import('three').BufferGeometry;
    tpos: Float32Array; tn: number;
  }
  const grGeo = geo(new THREE.SphereGeometry(0.08, 10, 10));
  const grMat = mat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0891b2, emissiveIntensity: 0.7, roughness: 0.4, metalness: 0.1 }));
  const trailMat = mat(new THREE.LineBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.5 }));
  const grains: Granule[] = [];
  for (let i = 0; i < NP_A; i++) {
    const mesh = new THREE.Mesh(grGeo, grMat);
    group.add(mesh);
    const tpos = new Float32Array(TRAIL * 3);
    const tg = geo(new THREE.BufferGeometry());
    tg.setAttribute('position', new THREE.BufferAttribute(tpos, 3));
    tg.setDrawRange(0, 0);
    const ln = new THREE.Line(tg, trailMat);
    ln.frustumCulled = false;
    group.add(ln);
    grains.push({ x: 0, z: 0, mesh, trailGeo: tg, tpos, tn: 0 });
  }

  // 当前窗 (τ, ⟨Δr²⟩) 采样（米²），用于实时画 MSD 直线
  const msdTau: number[] = [];
  const msdVal: number[] = [];   // µm²
  let winClock = 0;
  let Dwin = D_of(0.3e-6);

  // 反演量：D、λ 为“随条件变”的量 ⇒ 轻平滑（跟随 a，几何/读数可见其变化）；
  //   N_A 为普适常数 ⇒ 逐窗用匹配的 (a_m, Dwin) 组装后重平滑（与 a 无关，求稳，正是确证结论）。
  //   （a、D 同窗配对避免跨 a 池化的 Cauchy/Jensen 偏差；N_A 线性均值近似无偏。）
  let Ddisp = D_of(0.3e-6);
  let NAdispA = NA_TRUE;
  let slopeDisp = 4 * D_of(0.3e-6);

  // ============ 分支 B：沉降–扩散平衡高度分布（逆 CDF 采样）============
  const NP_B = 48;
  const B_AXIS_UM = 6 * lambda_of(0.3e-6) * UM;   // 固定 µm 轴上限 = 6λ(a=0.3)≈146 µm，跨 a 可比较
  const COL_H = 3.0;                               // 沉降柱世界高度
  const bColScale = COL_H / B_AXIS_UM;             // 世界 / µm（固定轴 ⇒ 柱高随 λ(a) 变）
  const bGeo = geo(new THREE.SphereGeometry(0.07, 8, 8));
  const bMat = mat(new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xdb2777, emissiveIntensity: 0.6, roughness: 0.5 }));
  const bMeshes: import('three').Mesh[] = [];
  const BX = -5.6, BZ = 0;
  for (let i = 0; i < NP_B; i++) {
    const msh = new THREE.Mesh(bGeo, bMat);
    msh.position.set(BX, 0, BZ);
    group.add(msh);
    bMeshes.push(msh);
  }
  // 沉降柱底面参考线
  {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute([BX - 0.6, 0, BZ, BX + 0.6, 0, BZ], 3));
    group.add(new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color: 0x64748b }))));
  }
  let lamB = lambda_of(0.3e-6);     // 测得标度高（EMA，跟随 a）
  let NAdispB = NA_TRUE;            // 逐帧匹配 (a, mean(h)) 组装后重平滑
  const bHist = new Array(20).fill(0);   // 高度直方图（供 B 面板，µm 轴均分 20 bin）

  // ============ 面板画布 ============
  function makePanel(w: number, h: number, px: number, py: number, pz: number, scale: number): { cv: HTMLCanvasElement; cx: CanvasRenderingContext2D; tex: import('three').CanvasTexture } {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const cx = cv.getContext('2d')!;
    const t = tex(new THREE.CanvasTexture(cv));
    const sprite = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })));
    sprite.scale.set(scale, scale * (h / w), 1);
    sprite.position.set(px, py, pz);
    sprite.renderOrder = 998;
    group.add(sprite);
    return { cv, cx, tex: t };
  }
  // 顶部读数面板
  const info = makePanel(1000, 320, 0, 4.9, 0, 9.2);
  // 右侧 MSD–t 拟合面板
  const msdP = makePanel(320, 320, 4.9, 1.2, 0.5, 3.4);
  // 左侧玻尔兹曼高度分布面板
  const bP = makePanel(320, 320, -5.6, 4.3, 0, 3.4);

  function label(text: string, color: string, w: number, x: number, y: number, z: number): void {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 26px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(w, w / 8, 1);
    s.position.set(x, y, z);
    s.renderOrder = 996;
    group.add(s);
  }
  label('二维布朗系综 · 显微镜焦平面 x–z', '#22d3ee', 4.2, 0, 1.5, 0);
  label('沉降–扩散平衡 n(h)∝e^(−h/λ)', '#f472b6', 4.0, BX, -1.0, BZ);

  // ============ 拟合工具 ============
  function lsqSlope(xs: number[], ys: number[]): number {
    const n = xs.length;
    if (n < 2) return NaN;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; }
    const den = n * sxx - sx * sx;
    return den === 0 ? NaN : (n * sxy - sx * sy) / den;
  }

  function drawInfo(aUm: number): void {
    const { cx, tex: t } = info;
    const W = 1000, H = 320;
    cx.clearRect(0, 0, W, H);
    cx.fillStyle = 'rgba(7,11,20,0.86)'; cx.fillRect(2, 2, W - 4, H - 4);
    cx.strokeStyle = '#334155'; cx.lineWidth = 3; cx.strokeRect(2, 2, W - 4, H - 4);
    cx.textAlign = 'left';
    const put = (y: number, col: string, s: string, size: number, bold = false): void => {
      let sz = size;
      cx.font = `${bold ? 'bold ' : ''}${sz}px "PingFang SC", sans-serif`;
      while (cx.measureText(s).width > W - 44 && sz > 13) { sz -= 1; cx.font = `${bold ? 'bold ' : ''}${sz}px "PingFang SC", sans-serif`; }
      cx.fillStyle = col; cx.fillText(s, 22, y);
    };
    const a = aUm * 1e-6;
    const mE = mEff(a);
    put(32, '#f8fafc', '佩兰实验 · 布朗运动统计确证阿伏伽德罗常数', 27, true);
    put(66, '#22d3ee', 'D = kT/(6πηa)，k = R/N_A；  二维 ⟨Δr²⟩ = 4D·t（斜率=4D）', 24);
    put(98, '#a855f7', `反推(分支A)：测 D → k=D·6πηa/T → N_A=R/k`, 24);
    put(130, '#f472b6', '分支B(沉降平衡)：n(h)=n₀e^(−m_eff·g·h/kT)，λ=kT/(m_eff·g)，k=m_eff·g·λ/T', 23);
    put(162, '#94a3b8', `假设：球形颗粒·Stokes无滑移·稀薄互不作用·等温T=${TEMP}K·η=${ETA.toExponential(1)}Pa·s·Δρ=${DRHO}kg/m³·a=${aUm.toFixed(2)}µm·m_eff=${mE.toExponential(2)}kg`, 19);
    put(188, '#94a3b8', '（真实沉降平衡需数小时达，动画时长不足，分支B按理论平衡分布对有限颗粒逆CDF采样呈现；竖直弛豫未实时模拟）', 17);
    // 读数行（黄色，随 5Hz 刷新）
    put(224, '#fbbf24', `读数：D(实测)=${(Ddisp * 1e12).toFixed(3)} µm²/s  MSD斜率=${(slopeDisp * 1e12).toFixed(2)}(µm²/s)≈4D=${(4 * Ddisp * 1e12).toFixed(2)}   λ(实测)=${(lamB * UM).toFixed(2)}µm`, 22, true);
    put(256, '#fbbf24', `反推 N_A：分支A=${(NAdispA / 1e23).toFixed(2)}×10²³  分支B=${(NAdispB / 1e23).toFixed(2)}×10²³ mol⁻¹  (真值 ${(NA_TRUE / 1e23).toFixed(2)}×10²³)`, 22, true);
    put(290, '#22c55e', `结论：改变颗粒半径 a，D、λ 随之变，两分支反推的 N_A 却恒≈6.0×10²³ —— 阿伏伽德罗常数的统计确证`, 21, true);
    t.needsUpdate = true;
  }

  function drawMSD(): void {
    const { cx, tex: t } = msdP;
    const W = 320, H = 320;
    cx.clearRect(0, 0, W, H);
    cx.fillStyle = 'rgba(7,11,20,0.82)'; cx.fillRect(0, 0, W, H);
    cx.strokeStyle = '#334155'; cx.lineWidth = 2; cx.strokeRect(1, 1, W - 2, H - 2);
    cx.fillStyle = '#94a3b8'; cx.font = 'bold 15px "PingFang SC", sans-serif'; cx.textAlign = 'left';
    cx.fillText('⟨Δr²⟩ – t 拟合', 10, 18);
    const x0 = 40, y0 = H - 34, x1 = W - 12, y1 = 30;
    cx.strokeStyle = '#475569'; cx.lineWidth = 1.5;
    cx.beginPath(); cx.moveTo(x0, y1); cx.lineTo(x0, y0); cx.lineTo(x1, y0); cx.stroke();
    cx.fillStyle = '#64748b'; cx.font = '11px sans-serif';
    cx.textAlign = 'center'; cx.fillText('t /s', (x0 + x1) / 2, H - 10);
    cx.save(); cx.translate(12, (y0 + y1) / 2); cx.rotate(-Math.PI / 2); cx.fillText('⟨Δr²⟩ /µm²', 0, 0); cx.restore();
    cx.textAlign = 'left';

    const maxT = WINDOW;
    let maxM = 0.5;
    for (const v of msdVal) if (v > maxM) maxM = v;
    maxM *= 1.1;
    const PX = (tt: number): number => x0 + ((x1 - x0) * tt) / maxT;
    const PY = (m: number): number => y0 - ((y0 - y1) * m) / maxM;

    // 当前窗散点（实测）
    cx.fillStyle = '#22d3ee';
    for (let i = 0; i < msdTau.length; i++) { cx.fillRect(PX(msdTau[i]) - 1.3, PY(msdVal[i]) - 1.3, 2.6, 2.6); }

    // 拟合直线（过原点，斜率=当前窗最小二乘）——实测同源
    if (msdTau.length > 3) {
      const s = lsqSlope(msdTau, msdVal);
      if (isFinite(s)) {
        cx.strokeStyle = '#fbbf24'; cx.lineWidth = 2; cx.beginPath();
        cx.moveTo(PX(0), PY(0)); cx.lineTo(PX(maxT), PY(Math.min(maxM, s * maxT))); cx.stroke();
        cx.fillStyle = '#fbbf24'; cx.font = '11px sans-serif';
        cx.fillText(`斜率=${s.toFixed(2)} ≈4D=${(4 * Ddisp * 1e12).toFixed(2)}`, x0 + 6, y1 + 12);
      }
    }
    // 理论 4D 参考虚线
    cx.strokeStyle = '#22c55e'; cx.setLineDash([5, 4]); cx.lineWidth = 1.5; cx.beginPath();
    cx.moveTo(PX(0), PY(0)); cx.lineTo(PX(maxT), PY(Math.min(maxM, 4 * Ddisp * 1e12 * maxT))); cx.stroke();
    cx.setLineDash([]);
    cx.fillStyle = '#22c55e'; cx.font = '10px sans-serif'; cx.fillText('— 理论 4D·t', x0 + 96, H - 20);
    t.needsUpdate = true;
  }

  function drawBoltz(): void {
    const { cx, tex: t } = bP;
    const W = 320, H = 320;
    cx.clearRect(0, 0, W, H);
    cx.fillStyle = 'rgba(7,11,20,0.82)'; cx.fillRect(0, 0, W, H);
    cx.strokeStyle = '#334155'; cx.lineWidth = 2; cx.strokeRect(1, 1, W - 2, H - 2);
    cx.fillStyle = '#94a3b8'; cx.font = 'bold 15px "PingFang SC", sans-serif'; cx.textAlign = 'left';
    cx.fillText('n(h) 高度分布', 10, 18);
    const x0 = 34, y0 = H - 30, x1 = W - 10, y1 = 30;
    cx.strokeStyle = '#475569'; cx.lineWidth = 1.5;
    cx.beginPath(); cx.moveTo(x0, y1); cx.lineTo(x0, y0); cx.lineTo(x1, y0); cx.stroke();
    cx.fillStyle = '#64748b'; cx.font = '11px sans-serif'; cx.textAlign = 'center';
    cx.fillText(`h /µm  (轴 0–${B_AXIS_UM.toFixed(0)})`, (x0 + x1) / 2, H - 9);
    cx.save(); cx.translate(12, (y0 + y1) / 2); cx.rotate(-Math.PI / 2); cx.fillText('n', 0, 0); cx.restore();

    const NB = bHist.length;
    let maxC = 1; for (const c of bHist) if (c > maxC) maxC = c;
    const bw = (x1 - x0) / NB;
    cx.fillStyle = '#f472b6';
    for (let b = 0; b < NB; b++) {
      const hh = (bHist[b] / maxC) * (y0 - y1);
      cx.fillRect(x0 + b * bw + 1, y0 - hh, bw - 2, hh);
    }
    // 拟合 exp(−h/λ_fit) 曲线（用测得 λ，同源）
    cx.strokeStyle = '#fbbf24'; cx.lineWidth = 2; cx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const h = (i / 60) * B_AXIS_UM;
      const n = Math.exp(-h / (lamB * UM));
      const px = x0 + (h / B_AXIS_UM) * (x1 - x0);
      const py = y0 - n * (y0 - y1);
      if (i === 0) cx.moveTo(px, py); else cx.lineTo(px, py);
    }
    cx.stroke();
    cx.fillStyle = '#fbbf24'; cx.font = '11px sans-serif'; cx.textAlign = 'left';
    cx.fillText(`λ(实测)=${(lamB * UM).toFixed(1)}µm`, x0 + 6, y1 + 12);
    t.needsUpdate = true;
  }

  // ============ 每帧：布朗子步进 + 高度分布采样 ============
  let stepAcc = 0;
  const FIXED_DT = 1 / 90;         // 物理子步上限（保证 √(2D·dt) 步长远小于 λ 与云团尺度）

  function stepBrownian(dtS: number, a_m: number, D: number): void {
    const sg = Math.sqrt(2 * D * dtS);
    for (let i = 0; i < NP_A; i++) {
      const g = grains[i];
      g.x += sg * gauss();
      g.z += sg * gauss();
    }
    // 世界坐标 = 位移 × WMU；尾迹保留。窗内不重锚（短窗位移天然留在室内，避免大位移截断偏置斜率）
    for (let i = 0; i < NP_A; i++) {
      const g = grains[i];
      const wp = g.tn % TRAIL;
      g.tpos[wp * 3] = g.x * UM * WMU;
      g.tpos[wp * 3 + 1] = 0;
      g.tpos[wp * 3 + 2] = g.z * UM * WMU;
      g.tn++;
      g.trailGeo.attributes['position'].needsUpdate = true;
      g.trailGeo.setDrawRange(0, Math.min(g.tn, TRAIL));
      g.mesh.position.set(g.x * UM * WMU, 0, g.z * UM * WMU);
    }
  }

  function sampleBoltz(a_m: number): void {
    const lam = lambda_of(a_m);
    bHist.fill(0);
    let sum = 0;
    for (let i = 0; i < NP_B; i++) {
      // 逆 CDF：h = −λ ln(1−U)，U∈(0,1)（完整指数，mean=λ 无偏）
      const u = Math.max(1e-9, rnd());
      const h = -lam * Math.log(1 - u);   // 米
      sum += h;
      const hUm = h * UM;
      const bin = Math.min(bHist.length - 1, Math.floor((hUm / B_AXIS_UM) * bHist.length));
      bHist[bin]++;
      bMeshes[i].position.set(BX + (rnd() - 0.5) * 0.7, hUm * bColScale, BZ + (rnd() - 0.5) * 0.7);
    }
    // mean(h)=λ（指数分布无偏 MLE）。λ 轻平滑跟随 a；N_A 逐帧用匹配的 (a_m, meanH) 组装后重平滑（普适常数，求稳）
    const meanH = sum / NP_B;
    lamB += (meanH - lamB) * 0.12;
    const NAw = (R * TEMP) / (mEff(a_m) * GRAV * meanH);
    if (isFinite(NAw)) NAdispB += (NAw - NAdispB) * 0.04;
  }

  drawInfo(0.6); drawMSD(); drawBoltz();

  return {
    update(t, dt) {
      // —— 扫描自变量：颗粒半径 a（0.3–0.9 µm，18 s 一周）——
      const aUm = 0.6 - 0.3 * Math.cos((t % 18) / 18 * Math.PI * 2);
      const a_m = aUm * 1e-6;
      const D = D_of(a_m);

      // —— 分支A：固定物理子步进布朗 + 窗法测 MSD ——
      stepAcc += dt;
      let steps = 0;
      while (stepAcc >= FIXED_DT && steps < 8) {
        stepBrownian(FIXED_DT, a_m, D);
        stepAcc -= FIXED_DT;
        steps++;
      }
      if (steps >= 8) stepAcc = 0;
      winClock += dt;
      // 采样当前窗 ⟨Δr²⟩（相对锚点，µm²）
      {
        let acc = 0;
        for (let i = 0; i < NP_A; i++) acc += grains[i].x ** 2 + grains[i].z ** 2;
        msdTau.push(winClock);
        msdVal.push((acc / NP_A) * 1e12);
      }
      if (winClock >= WINDOW && msdTau.length > 4) {
        const s = lsqSlope(msdTau, msdVal);              // µm²/s = 4D（当前窗拟合）
        if (isFinite(s) && s > 0) {
          Dwin = s / 4 / 1e12;                            // m²/s
          Ddisp += (Dwin - Ddisp) * 0.3;                  // D 轻平滑 ⇒ 跟随 a（与 λ 同为“随条件变”量）
          slopeDisp = 4 * Ddisp * 1e12;                   // 显示斜率(µm²/s)，与 D 同源
          const NAw = (R * TEMP) / (6 * Math.PI * ETA * a_m * Dwin);   // 同窗匹配 (a_m, Dwin)
          if (isFinite(NAw)) NAdispA += (NAw - NAdispA) * 0.1;          // 重平滑：N_A 普适，求稳
        }
        // 归零重锚定下一窗：位移与尾迹清空（云团回到观察室中心，位移从 0 起算 ⇒ ⟨Δr²⟩=4Dτ 无截断）
        msdTau.length = 0; msdVal.length = 0; winClock = 0;
        for (let i = 0; i < NP_A; i++) {
          grains[i].x = 0; grains[i].z = 0;
          grains[i].tn = 0; grains[i].trailGeo.setDrawRange(0, 0);
        }
      }

      // —— 分支B：玻尔兹曼高度分布采样（随 a 变陡）——
      sampleBoltz(a_m);

      // 颗粒显示半径随 a 微增（大颗粒→大球），两系综同步
      const sz = 0.7 + 0.9 * (0.5 + 0.5 * ((aUm - 0.3) / 0.6));
      for (let i = 0; i < NP_A; i++) grains[i].mesh.scale.setScalar(sz);

      // 锚点环呼吸
      anchorRing.scale.setScalar(1 + 0.15 * Math.sin(t * 3));

      // —— 面板 5Hz 刷新 ——
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) {
        drawInfo(aUm); drawMSD(); drawBoltz();
      }
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
