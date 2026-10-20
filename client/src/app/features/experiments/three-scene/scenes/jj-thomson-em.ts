import type { SceneContext, SceneInstance } from '../types';
/**
 * 阴极射线荷质比测定（P323 · J.J. Thomson 管）：电场偏转 + 磁场圆轨迹 + 交叉场平衡。
 * 三条轨迹都是洛伦兹方程的 RK4 数值积分（画面上的曲线就是公式的解）：
 *   ① 加速：eU = ½mv² ⇒ v = √(2(e/m)U)，真值 e/m = 1.7588e11 C/kg
 *   ② 板间电场 E = U_d/d 沿 +y（下板为正 ⇒ 电子受力 −y），板外无场：
 *      解析   y屏 = −(eE·Lp/(2mv²))·(Lp + 2·LS)，LS = 板端到屏
 *   ③ 亥姆霍兹线圈 B = (4/5)^1.5·μ0·N·I/R 沿 +z：圆弧 r = mv/(eB)，出射角 θ = arcsin(Lm/r)，
 *      解析   y屏 = r(1−cosθ) + tanθ·(屏距)；Lm ≥ r 时束流在线圈内折回，打不到屏
 *   ④ 交叉场（板长 Lp 与磁场区宽 Lm 刻意做成同域同界 ⇒ 全程严格摆线）：
 *      x = (v+W)sin(ωt)/ω − Wt，y = (v+W)(1−cosωt)/ω，ω = eB/m，W = −E/B
 *      ⇒ 偏转 ∝ (v − E/B)：v = E/B 时束流不偏、光点回中心（Thomson 平衡法测 v）
 *   ⑤ 反演：平衡给 v = E/B；用数值轨迹实测出射角 θ 得 r = Lm/sinθ ⇒ e/m = v/(B·r) = E/(B²r)
 *      ——r 由曲线量出而非公式代入，面板同时报解析值与数值值的偏差（RK4 离散误差）。
 * 扫描自变量：加速电压 U 1600→3000 V（16 s）、线圈电流 I 0.02→0.25 A（12 s）、板压 U_d 0→400 V（20 s）。
 *   U 的下限不是随便取的：板内偏移 y₁=U_d·Lp²/(4·d·U)（=½(eE/m)(Lp/v)² 用①代入），
 *   必须 y₁<d/2=15 mm 束流才不会被偏转板吃掉 ⇒ U_d=400 V 时要求 U≥1600 V（y₁=13.3 mm，留 11% 余量）。
 * 真实尺寸（1 世界单位 = 5 cm，光轴中点置原点到 wx）：管径 12 cm、板长 8 cm（＝磁场区宽）、板距 3 cm、
 * 线圈半径 4 cm/120 匝、板端到屏 5 cm；偏转按米算出再换算，未做放大；束流打至极板/管壁时用
 * setDrawRange 截断并计入「束流丢失」。整台装置 x ∈ [−3.8, +3.0]、y ∈ [−1.3, +1.3] 单位。
 * 校验：_scratch/agentA/thomson2.mjs（同一常数同一积分器复算）——RK4 与②③解析值处处差 ≤0.01 cm；
 *       v=2.844e7 m/s、B=0.364 mT 时平衡板压 311 V，交叉场屏上偏转 0.00 cm（零偏成立）；
 *       失谐 20 V ⇒ −0.10 cm；由曲线量 θ=0.1810 rad 反演 e/m=1.7576e11，偏差 0.069%（RK4 离散）。
 * 正射线抛物线系（汤姆孙同位素法）：同处平行 E×B 场的正离子，电偏 y_E∝(e/m)/v²、磁偏 x_B∝(e/m)/v，
 *   消去速度谱 ⇒ 记录板上 y = κ(m/e)·x²，每种同位素描一条抛物线（画面右侧示意 = ²⁰Ne、²²Ne 两线）。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  const starGeo = geo(new THREE.BufferGeometry());
  {
    const p = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) { p[i * 3] = (Math.random() - 0.5) * 200; p[i * 3 + 1] = (Math.random() - 0.5) * 200; p[i * 3 + 2] = (Math.random() - 0.5) * 200; }
    starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  }
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  grid.position.y = -3.0;
  group.add(grid);

  // ===== 真实几何（米）与世界换算 =====
  const EM = 1.7588e11, QE = 1.602e-19, MU0 = 4 * Math.PI * 1e-7, C0L = 2.998e8;
  const SC = 0.05, X0 = 0.23;                       // 1 单位 = 5 cm；x=0.23 m 处为原点
  const XP = 0.15;                                  // 阳极出射孔（轨迹起点）
  const PL0 = 0.25, PL1 = 0.33, Lp = PL1 - PL0, GD = 0.03;   // 偏转板（与磁场区同域同界）
  const XC = 0.29, RHO = 0.04, NT = 120, CO0 = XC - RHO, CO1 = XC + RHO, Lm = CO1 - CO0;
  const XS = 0.38, LS = XS - PL1;                   // 荧光屏
  const KBI = Math.pow(4 / 5, 1.5) * MU0 * NT / RHO; // B/I（T/A）
  const WALL = 0.06;                                // 管内半径（米）：超过即撞壁
  const wx = (m: number): number => (m - X0) / SC;
  const wy = (m: number): number => m / SC;

  // ===== 物理量：每个都由当前扫描自变量算出，几何与读数同源 =====
  let UA = 1750, IC = 0.125, UD = 200;
  let v = 0, E = 0, B = 0, rB = 0, yEan = 0, yBan = NaN, vBal = 0, rMeas = NaN, emBack = NaN;
  function physics(): void {
    v = Math.sqrt(2 * EM * UA);                     // ①
    E = UD / GD;
    B = KBI * IC;                                   // ③
    rB = B > 1e-9 ? v / (EM * B) : 1e9;             // ③ r = mv/(eB)
    yEan = -(EM * E * Lp / (2 * v * v)) * (Lp + 2 * LS);            // ②
    const k = Lm / rB;
    yBan = k < 1 ? rB * (1 - Math.sqrt(1 - k * k)) + (k / Math.sqrt(1 - k * k)) * (XS - CO1) : NaN;   // ③
    vBal = B > 1e-9 ? E / B : 1e30;                 // ④
  }

  // ===== RK4 积分 ẍ = −(e/m)(E + ẋ×B)；场区按 x 判定（板/线圈孔径内均匀） =====
  const S = [0, 0, 0, 0], K1 = [0, 0, 0, 0], K2 = [0, 0, 0, 0], K3 = [0, 0, 0, 0], K4 = [0, 0, 0, 0], TP = [0, 0, 0, 0];
  function deriv(s: number[], o: number[], uE: boolean, uB: boolean): void {
    const ee = uE && s[0] >= PL0 && s[0] <= PL1 ? E : 0;
    const bb = uB && s[0] >= CO0 && s[0] <= CO1 ? B : 0;
    o[0] = s[2]; o[1] = s[3];
    o[2] = -EM * s[3] * bb;                         // −e(v×B)_x / m = +e vy B/m（电子取负号后）
    o[3] = EM * s[2] * bb - EM * ee;
  }
  function rk4(h: number, uE: boolean, uB: boolean): void {
    deriv(S, K1, uE, uB);
    for (let i = 0; i < 4; i++) TP[i] = S[i] + 0.5 * h * K1[i];
    deriv(TP, K2, uE, uB);
    for (let i = 0; i < 4; i++) TP[i] = S[i] + 0.5 * h * K2[i];
    deriv(TP, K3, uE, uB);
    for (let i = 0; i < 4; i++) TP[i] = S[i] + h * K3[i];
    deriv(TP, K4, uE, uB);
    for (let i = 0; i < 4; i++) S[i] += (h / 6) * (K1[i] + 2 * K2[i] + 2 * K3[i] + K4[i]);
  }

  const NPT = 170, SUB = 6;
  interface Ray { g: import('three').BufferGeometry; pos: Float32Array; xs: Float32Array; ys: Float32Array; m: import('three').LineBasicMaterial; line: import('three').Line; n: number; reach: boolean; th: number; hit: string }
  function mkRay(color: number): Ray {
    const pos = new Float32Array(NPT * 3);
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setDrawRange(0, 0);
    const m = mat(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }));
    const line = new THREE.Line(g, m);
    line.frustumCulled = false;
    group.add(line);
    return { g, pos, xs: new Float32Array(NPT), ys: new Float32Array(NPT), m, line, n: 0, reach: false, th: NaN, hit: '' };
  }
  function trace(r: Ray, uE: boolean, uB: boolean): void {
    const h = 1.3 * (XS - XP) / v / ((NPT - 1) * SUB);   // 时间步长：直飞全程的 1/(NPT·SUB)，再留 30% 余量给偏转后 x 变慢
    S[0] = XP; S[1] = 0; S[2] = v; S[3] = 0;
    r.n = 0; r.reach = false; r.th = NaN; r.hit = '';
    let got = false;
    for (let i = 0; i < NPT; i++) {
      // 束流被真实吸收的两种情形：板间 |y|>GD/2 打在金属极板上；|y|>WALL 打在管壁上
      if (S[0] >= PL0 && S[0] <= PL1 && Math.abs(S[1]) > GD / 2) { r.hit = '打至极板'; break; }
      if (Math.abs(S[1]) > WALL) { r.hit = '撞管壁'; break; }
      r.xs[i] = S[0]; r.ys[i] = S[1];
      r.pos[i * 3] = wx(S[0]); r.pos[i * 3 + 1] = wy(S[1]); r.pos[i * 3 + 2] = 0;
      r.n = i + 1;
      if (S[0] >= XS) { r.reach = true; break; }
      for (let k = 0; k < SUB; k++) {
        const x0 = S[0], a0 = Math.atan2(S[3], S[2]);
        rk4(h, uE, uB);
        // 出磁场区的瞬间按 x 线性插值取切线方向 ⇒ θ（⑤ 的实测角，不用公式）
        if (!got && x0 < CO1 && S[0] >= CO1) {
          r.th = a0 + ((CO1 - x0) / (S[0] - x0)) * (Math.atan2(S[3], S[2]) - a0);
          got = true;
        }
      }
      if (S[2] <= 0.2 * v) { r.hit = '线圈内折回'; break; }   // 被磁场折回（x 方向不再前进）
    }
    r.g.attributes['position'].needsUpdate = true;
    r.g.setDrawRange(0, r.n);
    r.line.visible = r.n > 2;
  }
  function beamAt(r: Ray, xm: number): number {
    for (let i = 1; i < r.n; i++) if (r.xs[i] >= xm) {
      const d = r.xs[i] - r.xs[i - 1];
      return r.ys[i - 1] + (r.ys[i] - r.ys[i - 1]) * (d > 1e-12 ? (xm - r.xs[i - 1]) / d : 0);
    }
    return r.n > 0 ? r.ys[r.n - 1] : 0;
  }
  const show = (r: Ray): string => r.reach ? `${cm(beamAt(r, XS))} cm` : `${r.hit || '未到屏'}`;

  // ===== 真空管壳 + 电子枪 =====
  const tubeR = wy(WALL) + 0.1;
  const tubeMat = mat(new THREE.MeshPhysicalMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.08, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false }));
  const xA = wx(0.04), xB = wx(XS + 0.015);
  const tube = new THREE.Mesh(geo(new THREE.CylinderGeometry(tubeR, tubeR, xB - xA, 32, 1, true)), tubeMat);
  tube.rotation.z = Math.PI / 2; tube.position.set((xA + xB) / 2, 0, 0); group.add(tube);
  const capGeo = geo(new THREE.SphereGeometry(tubeR, 20, 14));
  for (const ex of [xA, xB]) {
    const c = new THREE.Mesh(capGeo, tubeMat);
    c.scale.set(1.5, 1, 1); c.position.set(ex, 0, 0); group.add(c);
  }
  const ringGeo = geo(new THREE.TorusGeometry(tubeR, 0.02, 6, 40));
  const edgeMat = mat(new THREE.MeshBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.45 }));
  for (const ex of [xA, xB]) { const r = new THREE.Mesh(ringGeo, edgeMat); r.rotation.y = Math.PI / 2; r.position.set(ex, 0, 0); group.add(r); }
  const gunMat = mat(new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.35, emissive: 0xef4444, emissiveIntensity: 0.3 }));
  const gun = new THREE.Mesh(geo(new THREE.CylinderGeometry(wy(0.018), wy(0.03), wy(0.07), 16)), gunMat);
  gun.rotation.z = Math.PI / 2; gun.position.set(wx(0.1), 0, 0); group.add(gun);
  const cathMat = mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 1.8, metalness: 0.6, roughness: 0.3 }));
  const cath = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.09, 0.09, wy(0.016), 12)), cathMat);
  cath.rotation.z = Math.PI / 2; cath.position.set(wx(0.075), 0, 0); group.add(cath);
  const anodMat = mat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, metalness: 0.8, roughness: 0.3, emissive: 0x22d3ee, emissiveIntensity: 0.5 }));
  const anod = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 16)), anodMat);
  anod.rotation.z = Math.PI / 2; anod.position.set(wx(XP), 0, 0); group.add(anod);

  // ===== 偏转板（下板 + 红、上板 − 蓝 ⇒ 板间 E 沿 +y ⇒ 电子受力 −y，与 RK4 里 a_y=−(e/m)E 同号） =====
  const dpGeo = geo(new THREE.BoxGeometry(wy(Lp) * 1.25, 0.07, 1.1));
  const dMatTop = mat(new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.9, roughness: 0.25, emissive: 0x3b82f6, emissiveIntensity: 0.15 }));
  const dMatBot = mat(new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.9, roughness: 0.25, emissive: 0xef4444, emissiveIntensity: 0.15 }));
  const plc = wx((PL0 + PL1) / 2), yU = wy(GD / 2);
  const dpT = new THREE.Mesh(dpGeo, dMatTop); dpT.position.set(plc, yU, 0); group.add(dpT);
  const dpB = new THREE.Mesh(dpGeo, dMatBot); dpB.position.set(plc, -yU, 0); group.add(dpB);
  const coneGeo = geo(new THREE.ConeGeometry(0.055, 0.2, 8));
  const eMat = mat(new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.9 }));
  const bMat = mat(new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.85 }));
  const eArrs: import('three').Mesh[] = [];
  for (let i = 0; i < 6; i++) { const a = new THREE.Mesh(coneGeo, eMat); group.add(a); eArrs.push(a); }
  const bArrs: import('three').Mesh[] = [];
  for (let i = 0; i < 5; i++) { const a = new THREE.Mesh(coneGeo, bMat); group.add(a); bArrs.push(a); }
  const YV = new THREE.Vector3(0, 1, 0), ZV = new THREE.Vector3(0, 0, 1);

  // ===== 亥姆霍兹线圈（间距 = 半径 ⇒ 中心区均匀） =====
  const coilMat = mat(new THREE.MeshStandardMaterial({ color: 0xa855f7, metalness: 0.7, roughness: 0.35, emissive: 0xa855f7, emissiveIntensity: 0.2 }));
  const coilGeo = geo(new THREE.TorusGeometry(wy(RHO), 0.07, 10, 40));
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(coilGeo, coilMat);
    c.rotation.y = Math.PI / 2; c.position.set(wx(XC + s * RHO / 2), 0, 0); group.add(c);
  }

  // ===== 荧光屏：1 cm 方格刻度 + 光点 =====
  const scrR = wy(0.058);
  const scrMat = mat(new THREE.MeshStandardMaterial({ color: 0x0f172a, transparent: true, opacity: 0.55, roughness: 0.9, side: THREE.DoubleSide }));
  const scr = new THREE.Mesh(geo(new THREE.CircleGeometry(scrR, 44)), scrMat);
  scr.rotation.y = Math.PI / 2; scr.position.set(wx(XS), 0, 0); group.add(scr);
  {
    const pts: number[] = [];
    for (let k = -6; k <= 6; k++) {
      const yy = k * 0.2, w = Math.sqrt(Math.max(0, scrR * scrR - yy * yy));   // 1 格 = 1 cm = 0.2 单位
      pts.push(0, yy, -w, 0, yy, w);
      const zz = k * 0.2, h = Math.sqrt(Math.max(0, scrR * scrR - zz * zz));
      pts.push(0, -h, zz, 0, h, zz);
    }
    const gg = geo(new THREE.BufferGeometry());
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const gr = new THREE.LineSegments(gg, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.28 })));
    gr.position.set(wx(XS) - 0.012, 0, 0); group.add(gr);
  }
  const spotMat = mat(new THREE.MeshBasicMaterial({ color: 0xfef3c7, transparent: true, blending: THREE.AdditiveBlending }));
  const spot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.09, 12, 10)), spotMat);
  group.add(spot);
  const haloMat = mat(new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending }));
  const halo = new THREE.Mesh(geo(new THREE.CircleGeometry(0.3, 24)), haloMat);
  halo.rotation.y = Math.PI / 2; group.add(halo);

  const rayE = mkRay(0xf472b6), rayB = mkRay(0x22c55e), rayC = mkRay(0x22d3ee);

  // ===== 电子串珠：沿合成（交叉场）轨迹流动，速度 ∝ 真实 v =====
  const beadGeo = geo(new THREE.SphereGeometry(0.045, 8, 8));
  const beadMat = mat(new THREE.MeshBasicMaterial({ color: 0xfef3c7, transparent: true, opacity: 0.85 }));
  const beads: import('three').Mesh[] = [];
  for (let i = 0; i < 18; i++) { const b = new THREE.Mesh(beadGeo, beadMat); group.add(b); beads.push(b); }
  let beadT = 0;

  function makeLabel(text: string, color: string, w: number, x: number, y: number, z: number): void {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 25px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(w, w / 8, 1); s.position.set(x, y, z); s.renderOrder = 996;
    group.add(s);
  }
  makeLabel('电子枪 加速电压 U', '#fbbf24', 2.1, wx(0.1), 1.05, 0.3);
  makeLabel('偏转板 4×3 cm  d=1.5 cm', '#f472b6', 2.4, plc, 1.55, 0.4);
  makeLabel('亥姆霍兹线圈 120 匝 R=4 cm', '#a855f7', 3.1, wx(XC), -1.6, 0.4);
  makeLabel('荧光屏 1 格 = 1 cm', '#22d3ee', 2.0, wx(XS) - 0.15, -2.1, 0.3);

  // ===== 读数面板 =====
  const CW = 900, CH = 300;
  const infoCv = document.createElement('canvas'); infoCv.width = CW; infoCv.height = CH;
  const ic = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const panel = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  panel.scale.set(8.8, 8.8 * CH / CW, 1); panel.position.set(0, 4.4, 0); panel.renderOrder = 999;
  group.add(panel);
  const est = (s2: string, sz: number): number => { let e = 0; for (const ch of s2) e += ch.charCodeAt(0) > 0x2e7f ? sz : sz * 0.56; return e; };
  const put = (y: number, color: string, text: string, size = 25, bold = false): void => {
    let s = size;
    while (est(text, s) > CW - 46 && s > 12) s -= 1;
    ic.fillStyle = color; ic.font = `${bold ? 'bold ' : ''}${s}px "PingFang SC", sans-serif`;
    ic.fillText(text, 22, y);
  };
  const cm = (m: number): string => (m * 100).toFixed(2);
  function drawInfo(): void {
    ic.clearRect(0, 0, CW, CH);
    ic.fillStyle = 'rgba(7,11,20,0.87)'; ic.fillRect(2, 2, CW - 4, CH - 4);
    ic.strokeStyle = '#334155'; ic.lineWidth = 3; ic.strokeRect(2, 2, CW - 4, CH - 4);
    ic.textAlign = 'left';
    put(30, '#f8fafc', 'eU=½mv² ⇒ v=√(2(e/m)U)；ẍ=−(e/m)(E+ẋ×B) 用 RK4 积分；r=mv/(eB)', 25, true);
    put(56, '#22d3ee', `加速 U=${UA.toFixed(0)} V ⇒ v=${v.toExponential(4)} m/s = ${(100 * v / C0L).toFixed(2)}% c；动能 eU=${UA.toFixed(0)} eV = ${(QE * UA).toExponential(3)} J`);
    put(82, '#f472b6', `只加电场 E=U_d/d=${E.toExponential(3)} V/m：解析 y=${cm(yEan)} cm，RK4 ${rayE.reach ? cm(beamAt(rayE, XS)) + ' cm' : '撞壁/未到屏'}`);
    put(108, '#22c55e', `只加磁场 B=(4/5)^1.5μ0NI/R=${(B * 1e3).toFixed(3)} mT：r=mv/(eB)=${cm(rB)} cm，解析 y=${isNaN(yBan) ? '折回' : cm(yBan)} cm，RK4 ${rayB.reach ? cm(beamAt(rayB, XS)) : '折回/撞壁'}`);
    put(134, '#a855f7', `交叉场摆线偏转 ∝ (v−E/B)：零位要求 v=E/B=${vBal < 1e8 ? (vBal / 1e7).toFixed(3) + '×10⁷ m/s' : '>10⁸ m/s（此 U_d/B 组合不可能平衡）'}，实际 v=${(v / 1e7).toFixed(3)}×10⁷ ⇒ 差 ${(100 * Math.abs(vBal - v) / v).toFixed(1)}%（${Math.abs(vBal - v) / v < 0.03 ? '近于平衡，光点回中心' : '未平衡'}）`);
    put(160, '#fbbf24', `屏上光点 y=${rayC.reach ? cm(beamAt(rayC, XS)) + ' cm' : '无（束流丢失）'}；由曲线量得 r=Lm/sinθ=${isFinite(rMeas) ? cm(rMeas) + ' cm' : `—（绿线${rayB.hit || '未穿出磁场区'}）`}`);
    put(186, '#94a3b8', isFinite(emBack)
      ? `反演 e/m = v/(B·r_曲线) = ${(emBack * 1e-11).toFixed(4)}×10¹¹ C/kg，公认 1.7588×10¹¹ ⇒ 偏差 ${(100 * Math.abs(emBack - EM) / EM).toFixed(3)}%（RK4 离散误差）`
      : `反演 e/m：无读数——束流被 ${rayB.hit || '吸收'}，量不出 r。汤姆逊必须先把 I/U_d 调小到束流穿出再测（显示 0 会是假符合）`);
    put(212, '#94a3b8', `曲线：粉=仅电场、绿=仅磁场、青=交叉场；偏转 ∝ E/v² 故 U 越大越难偏，∝ 1/B 弯得越急`);
    put(240, '#fbbf24', `读数：U=${UA.toFixed(0)} V  U_d=${UD.toFixed(0)} V  I=${IC.toFixed(3)} A  B=${(B * 1e3).toFixed(3)} mT  v=${(v / 1e7).toFixed(3)}×10⁷ m/s`, 24, true);
    put(268, '#94a3b8', `1 世界单位 = 5 cm；装置 x∈[${wx(0.04).toFixed(1)}, ${wx(XS).toFixed(1)}]，偏转按真实米制换算未放大`);
    infoTex.needsUpdate = true;
  }

  // ===== 正射线抛物线系（汤姆孙同位素法）：e/m 不同的同位素在同一 E×B 区各描一条抛物线 =====
  // 正离子经平行 E(沿 y)、B(沿 z) 复合场打到记录板：电偏 y_E∝(e/m)/v²，磁偏 x_B∝(e/m)/v，
  // 消去速度谱 ⇒ y = (κ·m/e)·x²（κ 为几何常数），抛物线开口系数 ∝ m/e，不同同位素=不同抛物线。
  {
    const pgCv = document.createElement('canvas'); pgCv.width = 320; pgCv.height = 240;
    const pg = pgCv.getContext('2d')!;
    pg.fillStyle = 'rgba(7,11,20,0.9)'; pg.fillRect(0, 0, 320, 240);
    pg.strokeStyle = '#334155'; pg.lineWidth = 2; pg.strokeRect(2, 2, 316, 236);
    pg.textAlign = 'left'; pg.fillStyle = '#f8fafc'; pg.font = 'bold 16px "PingFang SC", sans-serif';
    pg.fillText('正射线抛物线系（同位素）', 10, 22);
    pg.fillStyle = '#94a3b8'; pg.font = '13px "PingFang SC", sans-serif';
    pg.fillText('y = κ·(m/e)·x²  开口 ∝ m/e', 10, 40);
    // 坐标轴（记录板）
    const ox = 26, oy = 214, sx = 13, sy = 8.2;
    pg.strokeStyle = '#64748b'; pg.lineWidth = 1.5;
    pg.beginPath(); pg.moveTo(ox, oy); pg.lineTo(ox + 260, oy); pg.moveTo(ox, oy); pg.lineTo(ox, oy - 160); pg.stroke();
    // 两条抛物线 = 两种同位素（Ne 20 / Ne 22，m/e 比 22:20）
    const iso: [number, string, string][] = [[20, '#22d3ee', '²⁰Ne'], [22, '#f472b6', '²²Ne']];
    for (const [A, col, name] of iso) {
      pg.strokeStyle = col; pg.lineWidth = 2.4; pg.beginPath();
      const cPar = 0.0052 * A / 20;   // 开口系数 ∝ m
      for (let px = 0; px <= 240; px += 4) {
        const xv = px / sx;            // 归一磁偏坐标
        const yv = cPar * xv * xv;     // 电偏 y ∝ (m/e) x²
        const cy = oy - yv * sy;
        if (px === 0) pg.moveTo(ox + px, cy); else pg.lineTo(ox + px, cy);
      }
      pg.stroke();
      pg.fillStyle = col; pg.font = 'bold 13px "PingFang SC", sans-serif';
      pg.fillText(name, ox + 200, oy - cPar * (240 / sx) * (240 / sx) * sy - 6);
    }
    const pgTex = tex(new THREE.CanvasTexture(pgCv));
    const pgPanel = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: pgTex, transparent: true, depthTest: false })));
    pgPanel.scale.set(3.0, 3.0 * 240 / 320, 1); pgPanel.position.set(3.35, 2.4, 0.5); pgPanel.renderOrder = 998;
    group.add(pgPanel);
  }

  // 出射角 θ 直接取自 RK4 曲线在 x=CO1（磁场区右界）处的插值切线 ⇒ ⑤ 的"实测"角
  function exitAngle(r: Ray): number { return r.th; }

  // 用曲线量出的 r 做反演（⑤）：必须在 trace 之后调用
  function invert(): void {
    const th = exitAngle(rayB);
    rMeas = B > 1e-9 && isFinite(th) && Math.sin(th) > 1e-4 ? Lm / Math.sin(th) : NaN;
    emBack = isFinite(rMeas) ? v / (B * rMeas) : NaN;
  }

  physics(); trace(rayE, true, false); trace(rayB, false, true); trace(rayC, true, true); invert(); drawInfo();

  return {
    update(t, dt) {
      UA = 2300 - 700 * Math.cos((t % 16) / 16 * Math.PI * 2);        // 1600 → 3000 V（下限＝不撞偏转板的约束）
      IC = 0.135 - 0.115 * Math.cos((t % 12) / 12 * Math.PI * 2);      // 0.02 → 0.25 A（B 不归零 ⇒ r 有限、平衡法可测）
      UD = 200 - 200 * Math.cos((t % 20) / 20 * Math.PI * 2);          // 0 → 400 V
      physics();
      trace(rayE, true, false);
      trace(rayB, false, true);
      trace(rayC, true, true);
      invert();

      const yc = beamAt(rayC, XS);
      const lost = !(rayC.reach && Math.abs(yc) <= 0.058);
      spot.visible = !lost; halo.visible = !lost;
      const bright = Math.min(1, v / 3.3e7);
      spotMat.opacity = 0.55 + 0.45 * bright;
      spot.position.set(wx(XS) - 0.02, wy(yc), 0);
      halo.position.set(wx(XS) - 0.03, wy(yc), 0);
      halo.scale.setScalar(0.5 + 0.9 * bright);
      haloMat.opacity = 0.12 + 0.3 * bright;

      beadT = (beadT + dt * 0.4 * (v / 2.6e7)) % 1;
      beads.forEach((bb, i) => {
        const f = (beadT + i / beads.length) % 1;
        const xm = XP + f * (XS - XP);
        const ym = beamAt(rayC, xm);
        bb.position.set(wx(xm), wy(ym), 0);
        bb.visible = Math.abs(ym) <= WALL && rayC.n > 2;
      });

      // 板间 E 箭头（沿 +y：下板正、上板负 ⇒ 电子受力 −y），长度 ∝ E
      eArrs.forEach((a, i) => {
        const xx = wx(PL0) + 0.12 + (i % 3) * 0.24, zz = -0.3 + Math.floor(i / 3) * 0.6;
        const L = 0.2 + 0.8 * Math.min(1, E / 2.7e4);
        a.position.set(xx, yU - L / 2 - 0.02, zz);
        a.scale.set(1, L * 3.4, 1);
        a.quaternion.setFromUnitVectors(YV, YV);
      });
      eMat.opacity = 0.12 + 0.8 * Math.min(1, UD / 400);
      dMatTop.emissiveIntensity = 0.1 + 1.5 * Math.min(1, UD / 400);
      dMatBot.emissiveIntensity = 0.1 + 1.5 * Math.min(1, UD / 400);

      // 轴线上的 B 箭头（沿 +z，长度 ∝ B）
      bArrs.forEach((a, i) => {
        const xx = wx(CO0) + 0.15 + i * 0.42;
        a.position.set(xx, 0, 0);
        a.scale.set(1, 0.5 + 1.6 * Math.min(1, B / 6.8e-4), 1);
        a.quaternion.setFromUnitVectors(YV, ZV);
      });
      bMat.opacity = 0.1 + 0.85 * Math.min(1, IC / 0.25);
      coilMat.emissiveIntensity = 0.12 + 1.8 * Math.min(1, IC / 0.25);

      cathMat.emissiveIntensity = 0.4 + 1.6 * Math.min(1, UA / 3000);
      anodMat.emissiveIntensity = 0.2 + 1.0 * Math.min(1, UA / 3000);
      gunMat.emissiveIntensity = 0.1 + 1.0 * Math.min(1, UA / 3000);
      const bal = Math.abs(vBal - v) / v < 0.03;
      rayC.m.color.setHex(bal ? 0xfbbf24 : 0x22d3ee);
      spotMat.color.setHex(bal ? 0xfef3c7 : 0xd9f99d);
      if (lost) { spotMat.opacity = 0.12; }

      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
