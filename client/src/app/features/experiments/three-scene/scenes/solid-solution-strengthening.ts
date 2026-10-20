import type { SceneContext, SceneInstance } from '../types';
/**
 * 固溶与沉淀强化（P372）：主控方程 —— 位错线张力与两种障碍的同一条临界切应力
 *   线张力 T ≈ G·b²/2，外加切应力 τ 对位错单位长度推力 f = τ·b ⇒ 曲率半径 R = T/f = G·b/(2τ)
 *   钉扎点间半跨 s 的弓出高度 h = R − √(R² − s²)（圆弧，本面实算）
 *   临界（半圆，R = s）⇒ τ_c = G·b/(2s) = G·b/L，L = 障碍间距
 *   ① 固溶：溶质点障碍间距 L_ss = b/√c = 1.43 nm，障碍强度 f = ε·G·b²（ε = 错配度）⇒ Δτ_ss = G·ε·√c = 52 MPa（Fleischer/Labusch）
 *      画面上点障碍间距按 ×48 示意放大，但细弓高仍由同一条 h = √(R²−u²) − √(R²−s²) 实算（真实 nm 级，见面板标尺行）
 *   ② 沉淀：不可切过粒子间距 L_or = λ − 2r_eff ⇒ Δτ_Orowan = G·b/(λ − 2r_eff) = 57 MPa；
 *      绕过后在粒子周围留下一个 Orowan 环，r_eff += b ⇒ L 变小 ⇒ 下一轮更难（6 圈后 τ_c → 137 MPa = 时效硬化）
 *   扫描自变量：外加 τ（0.35τ_c → τ_c，达到即绕过）；弓出高度、绕过、环累积、面板读数全部同源。
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
  const starPos = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 200;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // —— 物理常数（铝合金 2000/7000 系量级）——
  const G = 26e9;                      // Pa 剪切模量
  const BN = 0.286e-9;                 // m 柏氏矢量 b
  const C_SOL = 0.04;                  // 溶质原子分数 4 at%
  const EPS_MIS = 0.01;                // 错配度 ε = |dln a/d c|
  const LAM_NM = 200;                  // nm 析出相间距 λ
  const R_NM = 35;                     // nm 粒子半径 r
  const WU_NM = 125;                   // 1 世界单位 ⇔ 125 nm（λ=1.6wu）
  const B_WU = BN * 1e9 * 22 / WU_NM;    // 画面上的 b：真实 b=0.286nm→0.0023wu 看不见，放大 ×22（面板注明）

  const LAM_W = LAM_NM / WU_NM;        // λ 世界单位 1.6
  const R_W = R_NM / WU_NM;            // r 世界单位 0.28

  const tauSS = G * EPS_MIS * Math.sqrt(C_SOL);                     // Pa 固溶强化
  const LSS_NM = BN * 1e9 / Math.sqrt(C_SOL);                       // nm 溶质障碍间距 L_ss = b/√c
  let nLoop = 0;                                                    // 已留下的 Orowan 环数/粒子
  const rEffW = (): number => R_W + nLoop * B_WU;
  const lambdaEffW = (): number => LAM_W - 2 * rEffW();
  const tauOrowan = (): number => (G * BN) / (lambdaEffW() * WU_NM * 1e-9);
  const radiusW = (t: number): number => (G * BN) / (2 * Math.max(t, 1e-9)) / (WU_NM * 1e-9); // R = Gb/2τ → 世界单位

  // —— 滑移面 ——
  const planeGeo = geo(new THREE.PlaneGeometry(13.4, 5.2));
  const plane = new THREE.Mesh(planeGeo, mat(new THREE.MeshStandardMaterial({ color: 0x0f1b2e, transparent: true, opacity: 0.5, metalness: 0.1, roughness: 0.9, side: THREE.DoubleSide })));
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -0.02;
  group.add(plane);

  // —— 析出第二相粒子（一排，沿 x）——
  const NPART = 7;
  const particles: import('three').Mesh[] = [];
  const pGeo = geo(new THREE.SphereGeometry(1, 26, 20));
  const pMat = mat(new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xb45309, emissiveIntensity: 0.35, metalness: 0.55, roughness: 0.35 }));
  for (let i = 0; i < NPART; i++) {
    const m = new THREE.Mesh(pGeo, pMat);
    const x = -((NPART - 1) / 2) * LAM_W;
    m.position.set(x + i * LAM_W, 0, 0);
    m.scale.setScalar(R_W);
    group.add(m);
    particles.push(m);
  }
  const pX = particles.map((p) => p.position.x);

  // —— Orowan 环（每次绕过在每个粒子上加一圈）——
  const rings: import('three').Mesh[] = [];
  const ringGeo = geo(new THREE.TorusGeometry(1, 0.055, 10, 44));
  const ringMat = mat(new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.4 }));
  for (let k = 0; k < 6; k++) {
    for (let i = 0; i < NPART; i++) {
      const t = new THREE.Mesh(ringGeo, ringMat);
      t.rotation.x = Math.PI / 2;
      t.position.set(particles[i].position.x, 0, 0);
      t.scale.set(1, 1, 1);
      t.visible = false;
      group.add(t);
      rings.push(t);
    }
  }

  // —— 溶质原子：位错线上的点障碍（画面向间距 SOL_W 放大，真实 L_ss = b/√c = 1.43 nm）——
  let sd = 77123;
  const rnd = (): number => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff; };
  const SOL_W = 0.55;                                // 画面点障碍间距（= 69 nm，真实 1.43 nm 的 ×48 示意放大）
  const solX: number[] = [];
  const solGeo = geo(new THREE.SphereGeometry(0.062, 12, 10));
  const solMat = mat(new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x7c3aed, emissiveIntensity: 0.5, roughness: 0.4 }));
  const solMeshes: import('three').Mesh[] = [];
  for (let x = -6.3; x <= 6.3; x += SOL_W) {
    const jx = x + (rnd() - 0.5) * 0.22;
    const frac = Math.abs((jx / LAM_W + (NPART - 1) / 2) % 1);           // 距最近粒子中心（以 λ 为周期）
    if (Math.min(frac, 1 - frac) * LAM_W < R_W + 0.06) continue;         // 落在粒子体内的溶质不钉线
    const m = new THREE.Mesh(solGeo, solMat);
    m.position.set(jx, 0.035, 0.06);
    group.add(m);
    solX.push(jx);
    solMeshes.push(m);
  }
  solX.sort((a, b) => a - b);

  // —— 位错线：折线，逐点由圆弧公式算出弓出量 ——
  const M = 360;
  const XMAX = 6.4;
  const dlGeo = geo(new THREE.BufferGeometry());
  const dlPos = new Float32Array(M * 3);
  dlGeo.setAttribute('position', new THREE.BufferAttribute(dlPos, 3));
  const dlMat = mat(new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 2 }));
  group.add(new THREE.Line(dlGeo, dlMat));
  // 位错的管子（更醒目）：用细圆柱逐段近似
  const segGeo = geo(new THREE.BufferGeometry());
  const segPos = new Float32Array((M - 1) * 6);
  segGeo.setAttribute('position', new THREE.BufferAttribute(segPos, 3));
  group.add(new THREE.LineSegments(segGeo, mat(new THREE.LineBasicMaterial({ color: 0xfca5a5 }))));

  const SS_MAG = SOL_W * WU_NM / LSS_NM;   // 画面向溶质间距的示意放大倍数
  let tau = 0.35 * tauOrowan(), Rw = 1e9, bulgeW = 0, bulgeSsW = 0, tauC = 0, flash = 0;

  // 半径 R 的圆弧：弦半跨 s、离弦中点 u 处的弓高（u=±s 时为 0 ⇒ 与钉扎点连续）
  function arcY(Rv: number, s: number, u: number): number {
    const rr = Math.max(Rv, s);                       // R<s：已超临界，几何上限为半圆
    const us = Math.min(Math.abs(u), s);
    return Math.sqrt(Math.max(0, rr * rr - us * us)) - Math.sqrt(Math.max(0, rr * rr - s * s));
  }
  function arcH(Rv: number, s: number): number {
    return arcY(Rv, s, 0);
  }

  function lineShape(): void {
    // 同一条线张力给出同一个 R = G b/(2τ)：粒子间的大弓出与溶质间的粗滑移纹同源
    const sBig = Math.max(1e-4, lambdaEffW() / 2);    // 粒子表面钉扎点半跨
    const x0 = -((NPART - 1) / 2) * LAM_W;            // 首个粒子中心
    Rw = radiusW(tau);
    tauC = tauOrowan();
    bulgeW = arcH(Rw, sBig);
    bulgeSsW = arcH(Rw, SOL_W / 2);                   // 画面向间距下的溶质弓高
    for (let i = 0; i < M; i++) {
      const x = -XMAX + (2 * XMAX * i) / (M - 1);
      // ① 大弓出：x 所属的粒子间隙（第 gi 与 gi+1 个粒子之间）
      const gi = Math.max(0, Math.min(NPART - 2, Math.round((x - x0) / LAM_W - 0.5)));
      const gc = x0 + (gi + 0.5) * LAM_W;             // 间隙中点
      const y = arcY(Rw, sBig, x - gc);
      // ② 粗滑移纹：相邻溶质点障碍之间由同一 R 实算的小弓出（粒子footprint 内被钉住 ⇒ 0）
      let ys = 0;
      let fp = 1e9;
      for (let p = 0; p < NPART; p++) { const dd = Math.abs(x - pX[p]); if (dd < fp) fp = dd; }
      if (fp > rEffW() && solX.length > 1) {
        let k = 0;
        while (k < solX.length - 1 && solX[k + 1] < x) k++;
        const xn = solX[Math.min(k + 1, solX.length - 1)];
        const mid = (solX[k] + xn) / 2;
        ys = arcY(Rw, Math.max(1e-4, (xn - solX[k]) / 2), x - mid);
      }
      dlPos[i * 3] = x;
      dlPos[i * 3 + 1] = 0.035;                  // 位错线躺在滑移面（xz 面）内
      dlPos[i * 3 + 2] = 0.06 + y + ys;          // 弓出也在滑移面内（朝 +z）：线张力弧与滑移面同一平面
    }
    dlGeo.attributes['position'].needsUpdate = true;
    // 溶质点障碍骑在弓出后的线上（弧在其两侧归零 ⇒ 障碍恰在线上）
    for (let k = 0; k < solMeshes.length; k++) {
      const gx = Math.max(0, Math.min(NPART - 2, Math.round((solX[k] - x0) / LAM_W - 0.5)));
      solMeshes[k].position.z = 0.06 + arcY(Rw, sBig, solX[k] - (x0 + (gx + 0.5) * LAM_W));
    }
    for (let i = 0; i < M - 1; i++) {
      segPos[i * 6] = dlPos[i * 3]; segPos[i * 6 + 1] = dlPos[i * 3 + 1]; segPos[i * 6 + 2] = dlPos[i * 3 + 2];
      segPos[i * 6 + 3] = dlPos[i * 3 + 3]; segPos[i * 6 + 4] = dlPos[i * 3 + 4]; segPos[i * 6 + 5] = dlPos[i * 3 + 5];
    }
    segGeo.attributes['position'].needsUpdate = true;
  }

  // —— 面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 880; infoCv.height = 274;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.6, 2.99)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 4.55, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 880, 274);
    infoCtx.fillStyle = 'rgba(7,11,20,0.84)'; infoCtx.fillRect(4, 4, 872, 266);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 872, 266);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 27px "PingFang SC", sans-serif';
    infoCtx.fillText('固溶与沉淀强化：位错被钉住、被弓出、被绕过', 22, 38);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '23px "PingFang SC", sans-serif';
    infoCtx.fillText('线张力 T=Gb²/2，推力 f=τb ⇒ 曲率半径 R = G·b/(2τ)', 22, 72);
    infoCtx.fillText('弓出 h = R − √(R²−s²)；临界半圆 R=s ⇒ τ_c = G·b/L', 22, 100);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText(`① 固溶：L_ss = b/√c = ${LSS_NM.toFixed(2)} nm，f = εGb² ⇒ Δτ_ss = G·ε·√c = ${(tauSS / 1e6).toFixed(1)} MPa`, 22, 132);
    infoCtx.fillStyle = '#f472b6';
    infoCtx.fillText(`② 沉淀 Orowan：Δτ = G·b/(λ−2r_eff) = ${(tauOrowan() / 1e6).toFixed(1)} MPa（绕过留环，r_eff += b ⇒ 越来越硬）`, 22, 162);
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText(`标尺：1wu = ${WU_NM} nm；b 画面向放大 ×22 ⇒ 环后硬化速率同步放大（真实每环只 +${(BN / (LAM_NM - 2 * R_NM) * 100).toFixed(1)}%，画面 +${(B_WU * WU_NM / (lambdaEffW() * WU_NM) * 100).toFixed(0)}%）；溶质间距示意放大 ×${SS_MAG.toFixed(0)}（真实 L_ss=${LSS_NM.toFixed(2)}nm ⇒ h_ss=${(arcH(Rw, LSS_NM / WU_NM / 2) * WU_NM).toFixed(3)}nm 只到 nm 级）`, 22, 192);
    infoCtx.fillStyle = flash > 0 ? '#ef4444' : '#fbbf24';
    infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    const st = flash > 0 ? '  ⟳ 刚绕过一个粒子，留下 Orowan 环！' : Rw <= lambdaEffW() / 2 * 1.02 ? '  —— 已达临界：即将绕过' : '';
    infoCtx.fillText(
      `读数：τ = ${(tau / 1e6).toFixed(1)} MPa  τ_c = ${(tauC / 1e6).toFixed(1)} MPa  R = ${Rw.toFixed(2)}wu(${(Rw * WU_NM).toFixed(0)}nm)  L/2 = ${(lambdaEffW() / 2).toFixed(2)}wu  弓高 h = ${bulgeW.toFixed(2)}wu(${(bulgeW * WU_NM).toFixed(0)}nm)  溶质细纹 h_ss = ${bulgeSsW.toFixed(3)}wu  r_eff = ${(rEffW() * WU_NM).toFixed(0)}nm  环数/粒子 = ${nLoop}${st}`,
      22, 232,
    );
    infoTex.needsUpdate = true;
  }

  lineShape();
  drawInfo();

  let ramp = 0;

  function pinRings(): void {
    for (let k = 0; k < nLoop && k < 6; k++) {
      for (let i = 0; i < NPART; i++) {
        const t = rings[k * NPART + i];
        t.visible = true;
        const rr = R_W + (k + 0.6) * B_WU;
        t.scale.set(rr, rr, 1);
      }
    }
  }

  return {
    update(t, dt) {
      // 扫描外加切应力 τ：线性爬升 → 达到 τ_c 即绕过（留环、τ_c 上升）→ 重新加载 = 时效硬化循环
      ramp += dt;
      const period = 9;
      const ph = (ramp % period) / period;
      tau = (0.35 + 1.25 * ph) * tauOrowan();
      if (tau >= tauOrowan() && nLoop < 6) {
        nLoop++;
        pinRings();
        ramp = 0;
        flash = 0.6;
      }
      if (flash > 0) flash = Math.max(0, flash - dt);
      lineShape();
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
