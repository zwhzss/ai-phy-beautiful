import type { SceneContext, SceneInstance } from '../types';
/**
 * 宇宙线观测（P277）：10^15–10^20 eV 原初质子诱发的广延大气簇射（EAS）。
 *
 * 深度坐标（全场景唯一坐标系）：X = 从大气顶沿竖直方向累计的大气面密度（g/cm²，静力学平衡下等于该高度气压/g）。
 *   X=0 为大气顶、X=X_G=1030 g/cm² 为地面；视觉高度 y(X)=(1−X/X_G)·6.2 ⇒ 纵轴**线性于深度**（EAS 纵向剖面的标准坐标）。
 *   几何高度只作读数用：h(X)=H·ln(X_G/X)，等温拟合 H≈6.9 km（0–30 km 内与标准大气表偏差 <0.8 km）。
 * 首次强子作用：X₁≈λ_p-air≈90 g/cm²（σ_p-air≈500 mb ⇒ λ=[(N_A/28.97)σ]⁻¹≈96 g/cm²@1e18 eV），对应 h≈17 km；
 *   级联从 X₁ 一路发展到地面，覆盖整层大气的 91%（旧版把首作用画在 X=920 g/cm²≈离地 0.8 km，深度轴倒置，已纠正）。
 * 纵向发展（Gaisser–Hill）：f(X) ∝ [(X−X₁)/(X_max−X₁)]^[(X_max−X₁)/λ_sh]·exp[(X_max−X)/λ_sh]，解析峰位恰为 X_max；
 *   质子 X_max = 600 + 80·log₁₀(E₀/10¹⁵) g/cm²（拉长率≈80 g/cm²/十倍能量，Auger/TA 口径），λ_sh≈70 g/cm²。
 * Heitler 标度：N_max≈E₀/E_c（E_c≈85 MeV）；理想电磁 t_max=log₂(E₀/E_c) 辐射长度，斜率 X₀/ln2·ln10≈123 g/cm²/decade
 *   比强子实测陡（前导粒子效应），故几何一律用 GH 的 X_max，t_max 仅作对照读数。
 * 横向：多重散射与能量损失平衡 ⇒ 锥半张角 θ_M=E_s/E_c（E_s=21 MeV 屏蔽能量）≈0.25 rad，半径 r(X)=θ_M·(X−X₁)·secθ。
 * 缪子 N_μ≈0.08·N_e 小角度贯穿到地面以下；荧光 337 nm、4 光子/m/keV ⇒ 望远镜沿轴记录纵向轨迹。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  // [PHYS-BEGIN] 纯物理内核（不依赖 THREE / DOM）：画面几何与面板读数都由这一组常量＋函数现算，保证同源
  const Y_TOP = 6.2;                    // 大气顶视觉高度 wu（纵轴线性于深度 X）
  const X_G = 1030;                     // 地面大气深度 g/cm²（海平面气压 1013 hPa ÷ g）
  const X1 = 90;                        // 首次强子作用深度＝λ_p-air ≈ 90 g/cm²（h≈17 km）
  const X0_AIR = 37;                    // 空气辐射长度 g/cm²
  const E_C = 8.5e7;                    // eV，空气临界能量 85 MeV
  const E_S = 21e6;                     // eV，Molière 屏蔽能量 21 MeV
  const TH_MOL = E_S / E_C;             // ≈0.247 rad：锥半张角 θ_M=E_s/E_c
  const LAM_SH = 70;                    // Gaisser–Hill 级联长度 λ_sh≈70 g/cm²（剖面宽度标度）
  const H_ATM = 6.9;                    // km，等温标高：h(X)=H·ln(X_G/X)
  const LOGE_MIN = 15, LOGE_MAX = 20;   // 能量扫描区间 10^15→10^20 eV（膝→GZK 能区）
  const PERIOD = 16;                    // s
  const CORE_X = 1.2;                   // 簇射轴落地（阵列核心）横向位置 wu
  const INCL = 0.35;                    // 展示天顶角 rad（≈20°）
  const TAN_I = Math.tan(INCL), SEC_I = 1 / Math.cos(INCL);
  const S_Y = Y_TOP / X_G;              // wu per g/cm²
  const yOf = (X: number) => (1 - X / X_G) * Y_TOP;                 // 深度 → 视觉高度
  const hKm = (X: number) => H_ATM * Math.log(X_G / Math.max(1, X)); // 深度 → 几何高度（读数）
  const xOf = (X: number) => CORE_X - TAN_I * yOf(X);               // 沿倾斜轴的横向位置
  const xmaxOf = (logE: number) => 600 + 80 * (logE - 15);          // GH 峰深（质子拉长率 80/decade）
  const rOf = (X: number) => 0.05 + (X <= X1 ? 0 : TH_MOL * (X - X1) * SEC_I * S_Y); // 锥半径
  const gh = (X: number, xm: number) => (X <= X1 ? 0 : Math.min(1,
    Math.pow((X - X1) / (xm - X1), (xm - X1) / LAM_SH) * Math.exp((xm - X) / LAM_SH))); // 峰位=xm，归一峰=1
  // 点云显示概率：真实剖面自 X_max 向上骤降 2–3 个量级，开方＋0.08 地板做动态范围压缩；
  // 单调变换不改变极大值位置 ⇒ 可见粒数密度峰仍恰好落在 X_max（早期级联也不至于画面全空）
  const dens = (X: number, xm: number) => Math.max(0.08, Math.sqrt(gh(X, xm)));
  const tmaxEm = (E0: number) => Math.log(E0 / E_C) / Math.LN2;    // 理想电磁 Heitler 峰位（辐射长度 X₀）
  // [PHYS-END]

  const starGeo = geo(new THREE.BufferGeometry());
  const starPos = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 400;
    starPos[i * 3 + 1] = Math.random() * 220 - 20;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 400;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // —— 原初入射线：大气层外 → 大气顶 → 首次作用点（轴上，X₁＝1 个作用长度）——
  {
    const g = geo(new THREE.BufferGeometry());
    const yTop = Y_TOP + 1.0;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      CORE_X - TAN_I * yTop, yTop, 0,   // 大气层外
      CORE_X - TAN_I * Y_TOP, Y_TOP, 0, // 大气顶 X=0
      xOf(X1), yOf(X1), 0,               // 首次作用点 X₁≈90 g/cm²
    ]), 3));
    group.add(new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color: 0xef4444 }))));
  }
  const firstHit = new THREE.Mesh(geo(new THREE.SphereGeometry(0.14, 12, 12)), mat(new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.5 })));
  firstHit.position.set(xOf(X1), yOf(X1), 0);
  group.add(firstHit);

  // —— 级联锥壳（电磁成分，自 X₁ 向地面发展；半径由 θ_M 标度驱动）——
  function shellGeo(): import('three').BufferGeometry {
    const SH = 30, RA = 12;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array((SH + 1) * (RA + 1) * 3);
    const idx: number[] = [];
    let v = 0;
    for (let i = 0; i <= SH; i++) {
      const X = X1 + (i / SH) * (X_G - X1);
      const r = rOf(X), ax = xOf(X), ay = yOf(X);
      for (let j = 0; j <= RA; j++) {
        const a = (j / RA) * Math.PI * 2;
        pos[v * 3] = ax + r * Math.cos(a);
        pos[v * 3 + 1] = ay;
        pos[v * 3 + 2] = r * Math.sin(a);
        v++;
      }
    }
    for (let i = 0; i < SH; i++) for (let j = 0; j < RA; j++) {
      const a = i * (RA + 1) + j, b = a + 1, c = a + RA + 1, d2 = c + 1;
      idx.push(a, b, c, b, d2, c);
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  }
  const shell1 = new THREE.Mesh(geo(shellGeo()), mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.26 })));
  const shell2 = shell1.clone();
  shell2.geometry = shell1.geometry;
  shell2.material = mat(new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false }));
  group.add(shell1, shell2);

  // —— 粒子点云：深度均匀铺开，显示概率＝dens(X)=√GH 剖面（单调压缩，峰位不变）⇒ 可见粒数密度峰落在 X_max ——
  // mulberry32（32 位整周期，无浮点截断）：旧 LCG 在 JS 里 seed·1103515245 超 2^53 丢低位，周期仅 ~1e4，
  // 深度分位与径向分位是相邻两次取样，弱相关会让锥壳出现条纹，故换成整周期发生器。
  let prn = 987654321 >>> 0;
  const rnd = () => { prn = (prn + 0x6d2b79f5) >>> 0; let t = Math.imul(prn ^ (prn >>> 15), 1 | prn); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const NEM = 2400, NMU = 90;   // 池大一些：GH 拒绝采样后 X_max 处的密度峰才统计得干净
  const emU = new Float32Array(NEM * 2), emA = new Float32Array(NEM);
  for (let i = 0; i < NEM; i++) {
    emU[i * 2] = rnd();            // 深度分位 u：X = X₁ + u·(X_G−X₁)
    emU[i * 2 + 1] = rnd();        // 径向填充（√ ⇒ 锥内面积均匀）
    emA[i] = rnd() * Math.PI * 2;
  }
  const muU = new Float32Array(NMU * 2), muA = new Float32Array(NMU), muSkew = new Float32Array(NMU);
  for (let i = 0; i < NMU; i++) {
    muU[i * 2] = Math.pow(rnd(), 0.5);
    muU[i * 2 + 1] = 0.25 + 0.75 * rnd();
    muA[i] = rnd() * Math.PI * 2;
    muSkew[i] = (rnd() - 0.5) * 0.35;               // 小角度 ⇒ 径迹长、贯穿到地下
  }
  const emGeo = geo(new THREE.BufferGeometry());
  const emPos = new Float32Array(NEM * 3);
  emGeo.setAttribute('position', new THREE.BufferAttribute(emPos, 3));
  group.add(new THREE.Points(emGeo, mat(new THREE.PointsMaterial({ color: 0x67e8f9, size: 0.07, sizeAttenuation: true, transparent: true, opacity: 0.95 }))));
  const muGeo = geo(new THREE.BufferGeometry());
  const muPos = new Float32Array(NMU * 3);
  muGeo.setAttribute('position', new THREE.BufferAttribute(muPos, 3));
  group.add(new THREE.Points(muGeo, mat(new THREE.PointsMaterial({ color: 0xa855f7, size: 0.11, sizeAttenuation: true }))));

  // —— X_max 标记盘（等深面切片）＋ 与纵向剖面峰位的连线 ——
  const xmark = new THREE.Mesh(geo(new THREE.RingGeometry(0.07, 0.5, 32)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.9, side: THREE.DoubleSide })));
  xmark.rotation.x = -Math.PI / 2;
  group.add(xmark);
  const xline = geo(new THREE.BufferGeometry());
  xline.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  group.add(new THREE.Line(xline, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.55 }))));

  // —— 纵向剖面曲线（真算 GH，逐帧随 X_max 移动）＋ 深度轴刻度 ——
  const PROF_X = -5.0, PROF_AMP = 1.5, NP = 48;
  const profGeo = geo(new THREE.BufferGeometry());
  profGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((NP + 1) * 3), 3));
  group.add(new THREE.Line(profGeo, mat(new THREE.LineBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.85 }))));
  {
    const g = geo(new THREE.BufferGeometry());
    const ticks = [0, 250, 500, 750, X_G];
    const p = new Float32Array(ticks.length * 6);
    ticks.forEach((X, i) => {
      const y = yOf(X);
      p[i * 6] = PROF_X - 0.18; p[i * 6 + 1] = y; p[i * 6 + 2] = 0;
      p[i * 6 + 3] = PROF_X + 0.18; p[i * 6 + 4] = y; p[i * 6 + 5] = 0;
    });
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    group.add(new THREE.LineSegments(g, mat(new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.7 }))));
    const axis = geo(new THREE.BufferGeometry());
    axis.setAttribute('position', new THREE.BufferAttribute(new Float32Array([PROF_X, Y_TOP, 0, PROF_X, 0, 0]), 3));
    group.add(new THREE.Line(axis, mat(new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.8 }))));
  }

  // —— 地面阵列（Auger 型水切伦科夫池，站间距 1.5 km）与荧光望远镜 ——
  // 比例尺自洽：横向 1 wu = 2.4 km；纵向 1 wu = 166 g/cm² 大气（按平均密度约 3 km 路程）⇒ 画出的锥开角接近真值 θ_M。
  const detN = 7, detPos: import('three').Vector3[] = [];
  const SPACING = 0.62, M_PER_WU = 1500 / SPACING;   // 2419 m/wu（由站间距 1.5 km 反推）
  const detGeo = geo(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 10));
  const detMatOn = mat(new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 1.2 }));
  const detMatOff = mat(new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0x0f172a, emissiveIntensity: 0.2 }));
  const dets: import('three').Mesh[] = [];
  for (let ix = 0; ix < detN; ix++) for (let iz = 0; iz < detN; iz++) {
    const m = new THREE.Mesh(detGeo, detMatOff);
    m.position.set((ix - (detN - 1) / 2) * SPACING, 0.06, (iz - (detN - 1) / 2) * SPACING);
    group.add(m); dets.push(m);
    detPos.push(m.position.clone());
  }
  const ftel = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.22, 0.28, 0.5, 12)), mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5, roughness: 0.4 })));
  ftel.position.set(-6.6, 0.4, 3.8);
  group.add(ftel);
  // 荧光轨迹：望远镜视场内沿 X_max 附近的一段纵向辉光
  const flGeo = geo(new THREE.BufferGeometry());
  const flPos = new Float32Array(3 * 2);
  flGeo.setAttribute('position', new THREE.BufferAttribute(flPos, 3));
  group.add(new THREE.Line(flGeo, mat(new THREE.LineBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.5 }))));

  function makeLabel(text: string, color: string, scale = 3.2): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(scale, scale / 8, 1);
    s.renderOrder = 998;
    return s;
  }
  const lPrim = makeLabel(`原初质子：首作用 X₁≈${X1} g/cm²（h≈${hKm(X1).toFixed(0)} km）`, '#ef4444', 4.0);
  lPrim.position.set(-2.0, 6.6, 0); group.add(lPrim);
  const lProf = makeLabel('纵向剖面 dN/dX（GH，峰在 X_max）', '#f8fafc', 3.6);
  lProf.position.set(PROF_X + 1.0, 6.15, 0); group.add(lProf);
  const lAxisTop = makeLabel(`大气顶 X=0 → 地面 X=${X_G} g/cm²`, '#94a3b8', 3.4);
  lAxisTop.position.set(PROF_X + 0.85, -0.75, 0); group.add(lAxisTop);
  const lMax = makeLabel('X_max：粒数峰＝等深盘', '#fbbf24', 2.6);
  group.add(lMax);
  const lMu = makeLabel('缪子成分：贯穿到地下', '#a855f7', 3.0); lMu.position.set(-2.6, 0.9, 2.6); group.add(lMu);
  const lDet = makeLabel('地面粒子阵（水切伦科夫池，1.5 km 间距）', '#22c55e', 3.8); lDet.position.set(1.4, -0.8, 2.2); group.add(lDet);
  const lTel = makeLabel('空气荧光望远镜', '#e2e8f0', 3.0); lTel.position.set(-6.6, 1.3, 3.8); group.add(lTel);

  const infoCv = document.createElement('canvas');
  infoCv.width = 512; infoCv.height = 256;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const info = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  info.scale.set(7.4, 3.7, 1);
  info.position.set(0.4, 8.7, 0);
  info.renderOrder = 999;
  group.add(info);

  let E0 = 1e15, tmax = 23.5, xmax = 600, nMax = 1.2e7, nMu = 9.6e5, hitN = 0, logE = LOGE_MIN;

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 512, 256);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)';
    infoCtx.fillRect(3, 3, 506, 250);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3;
    infoCtx.strokeRect(3, 3, 506, 250);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    infoCtx.fillText('广延大气簇射 EAS：X 自大气顶累计 g/cm²', 14, 32);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '20px "PingFang SC", sans-serif';
    infoCtx.fillText(`首作用 X₁=λ_p≈${X1} g/cm²（h≈${hKm(X1).toFixed(0)} km）起级联`, 14, 62);
    infoCtx.fillText('X_max≈600+80·log₁₀(E₀/10¹⁵) g/cm²（80/decade）', 14, 88);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('N_max≈E₀/E_c，N_μ≈0.08N_e 贯穿；荧光 4ph/m/keV', 14, 114);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 19px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数 E₀=10^${logE.toFixed(2)} eV  N_max≈${nMax.toExponential(1)}`, 14, 146);
    infoCtx.fillText(`X_max=${xmax.toFixed(0)}(h≈${hKm(xmax).toFixed(1)}km) 位于级联${(((xmax - X1) / (X_G - X1)) * 100).toFixed(0)}%深处`, 14, 172);
    infoCtx.fillText(`N_μ≈${nMu.toExponential(1)} 阵内命中${hitN}/${detN * detN} t_max=${tmax.toFixed(0)}X₀`, 14, 198);
    infoCtx.fillText(`理想EM峰深=${(tmax * X0_AIR).toFixed(0)} g/cm²（比强子陡⇒用GH）`, 14, 224);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  return {
    update(t, dt) {
      // PERIOD 秒周期：E₀ 从 10^15 扫到 10^20 eV —— X_max 逐级变深（盘下移）、级联更稠密、阵列命中更多
      const cyc = (Math.sin(Math.PI * 2 * (t % PERIOD) / PERIOD) + 1) / 2;
      logE = LOGE_MIN + (LOGE_MAX - LOGE_MIN) * cyc;
      E0 = Math.pow(10, logE);
      xmax = Math.min(X_G - 10, xmaxOf(logE));                          // GH 峰深，画在大气之内
      tmax = tmaxEm(E0);
      nMax = E0 / E_C;
      nMu = 0.08 * nMax;

      // 级联前锋自 X₁ 向地面推进（展示循环 2.2 s 一次）；只在 (X₁, Xfront) 内按 dens(X) 出现
      const front = 0.45 + 0.6 * ((t * 0.45) % 1);
      const Xfront = X1 + Math.min(1, front) * (X_G - X1);
      const show = 800 + 1600 * cyc;                                    // 可视粒数随能量增多（真实 N_max 相差 5 个量级）
      for (let i = 0; i < NEM; i++) {
        const u = emU[i * 2], X = X1 + u * (X_G - X1);
        const on = i < show && X <= Xfront && X >= X1 && emU[i * 2 + 1] < dens(X, xmax);
        const rNow = rOf(X) * Math.sqrt(emU[i * 2 + 1]) * (0.35 + 0.65 * Math.min(1, u / Math.max(1e-3, front)));
        emPos[i * 3] = on ? xOf(X) + rNow * Math.cos(emA[i]) : 0;
        emPos[i * 3 + 1] = on ? yOf(X) : -50;
        emPos[i * 3 + 2] = on ? rNow * Math.sin(emA[i]) : 0;
      }
      (emGeo.attributes['position'] as import('three').BufferAttribute).needsUpdate = true;

      // 缪子：近似直线穿透，X>X_G 时画到地面以下
      for (let i = 0; i < NMU; i++) {
        const u = Math.min(1.15, muU[i * 2] + front * 0.6);
        const X = X1 + u * (X_G - X1);
        const rNow = rOf(X_G) * muU[i * 2 + 1] * (1 + muSkew[i]);
        muPos[i * 3] = xOf(Math.min(X, X_G)) + rNow * Math.cos(muA[i]);
        muPos[i * 3 + 1] = yOf(X);
        muPos[i * 3 + 2] = rNow * Math.sin(muA[i]);
      }
      (muGeo.attributes['position'] as import('three').BufferAttribute).needsUpdate = true;

      // X_max 盘：半径＝该等深面的锥截面（与壳层同一 rOf），位置在轴上同一 xmax
      const mx = xOf(xmax), my = yOf(xmax), mr = rOf(xmax);
      xmark.position.set(mx, my, 0);
      xmark.scale.setScalar(mr / 0.5);
      const xa = xline.attributes['position'] as import('three').BufferAttribute;
      const xv = xa.array as Float32Array;
      xv[0] = PROF_X + PROF_AMP; xv[1] = my; xv[2] = 0;                 // 剖面曲线峰点
      xv[3] = mx + mr; xv[4] = my; xv[5] = 0;                            // 锥截面盘外缘
      xa.needsUpdate = true;
      lMax.position.set(mx - 0.2, my + 0.42, 0);

      // 纵向剖面：真实 GH 采样，前锋未到的深度置零
      {
        const pa = profGeo.attributes['position'] as import('three').BufferAttribute;
        const pv = pa.array as Float32Array;
        for (let i = 0; i <= NP; i++) {
          const X = (i / NP) * X_G;
          const f = X <= Xfront ? gh(X, xmax) : 0;
          pv[i * 3] = PROF_X + PROF_AMP * f;
          pv[i * 3 + 1] = yOf(X);
          pv[i * 3 + 2] = 0;
        }
        pa.needsUpdate = true;
      }

      // 地面命中：可触发半径 r(600)≈1300·(E₀/3e17)^0.4 m（Auger 标定口径）⇒ wu＝m/M_PER_WU
      // 1e15 eV 仅核心 1 台、1e18≈0.9 wu、1e20 超出阵面 ⇒ 命中数随能量增长，正是"平方公里级阵列才够统计量"
      const rG0 = 1300 * Math.pow(E0 / 3e17, 0.4) / M_PER_WU;
      const rG = Math.max(0.05, Math.min(4.2, rG0)) * (front > 0.94 ? 1 : front / 0.94);
      hitN = 0;
      for (let i = 0; i < dets.length; i++) {
        const d = Math.hypot(detPos[i].x - CORE_X, detPos[i].z);
        const hit = front > 0.9 && d < rG;
        dets[i].material = hit ? detMatOn : detMatOff;
        dets[i].scale.setScalar(hit ? 1.6 : 1);
        if (hit) hitN++;
      }

      // 荧光轨迹：沿轴跨过 X_max 前后各 ~1.5 个级联长度
      const fA = Math.max(X1, xmax - 1.5 * LAM_SH), fB = Math.min(X_G - 5, xmax + 1.5 * LAM_SH);
      flPos[0] = xOf(fA); flPos[1] = yOf(fA); flPos[2] = 0;
      flPos[3] = xOf(fB); flPos[4] = yOf(fB); flPos[5] = 0;
      flGeo.attributes['position'].needsUpdate = true;

      firstHit.scale.setScalar(1 + 0.5 * Math.abs(Math.sin(t * 3)));
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
