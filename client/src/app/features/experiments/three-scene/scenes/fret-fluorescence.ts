import type { SceneContext, SceneInstance } from '../types';
/**
 * 荧光共振能量转移 FRET（P344）—— 主控方程（偶极–偶极无辐射转移）：
 *   效率   E = 1 / (1 + (r/R₀)⁶)
 *   转移速率 k_ET = (1/τ_D)·(R₀/r)⁶      （∝ 1/r⁶ —— 这就是“分子尺光学卡尺”的来源）
 *   取向因子 κ = μ_D·μ_A − 3(μ_D·r̂)(μ_A·r̂)，  R₀⁶ ∝ κ²  ⇒ R₀_eff = R₀·(κ²/(2/3))^{1/6}
 * 供体(青)与受体(品红)两偶极在 1–10 nm 尺度上，扫描间距 r 与受体偶极取向 φ_A：
 * 转移效率按 r⁻⁶ 与 κ² 实时改变供/受体亮度、能量跳迁频率与 E(r) 曲线，全部同源计算。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [];
  const mats: { dispose(): void }[] = [];
  const texs: { dispose(): void }[] = [];
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
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  grid.position.y = -3.2; group.add(grid);

  // —— 常数 ——
  const R0 = 5.0;        // nm，典型 CFP–YFP Förster 半径
  const tauD = 3.0;      // ns，供体荧光寿命
  const K_ISO = 2 / 3;   // 动态随机取向平均

  // —— 供/受体分子球 ——
  const molGeo = geo(new THREE.SphereGeometry(0.5, 20, 16));
  const donorMat = mat(new THREE.MeshStandardMaterial({ color: 0x0e7490, emissive: 0x22d3ee, emissiveIntensity: 1, roughness: 0.3 }));
  const acceptMat = mat(new THREE.MeshStandardMaterial({ color: 0x86198f, emissive: 0xf472b6, emissiveIntensity: 0.2, roughness: 0.3 }));
  const donor = new THREE.Mesh(molGeo, donorMat); group.add(donor);
  const acceptor = new THREE.Mesh(molGeo, acceptMat); group.add(acceptor);

  // —— 偶极矢量（沿局部 +Y 的杆+两端箭头）——
  const UP = new THREE.Vector3(0, 1, 0);
  function makeDipole(rodCol: number): { g: import('three').Group; rodMat: import('three').MeshStandardMaterial; headMat: import('three').MeshBasicMaterial } {
    const g = new THREE.Group();
    const rodMat = mat(new THREE.MeshStandardMaterial({ color: rodCol, metalness: 0.4, roughness: 0.4 }));
    const headMat = mat(new THREE.MeshBasicMaterial({ color: rodCol }));
    const rod = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 8)), rodMat);
    const coneP = new THREE.Mesh(geo(new THREE.ConeGeometry(0.14, 0.34, 10)), headMat);
    coneP.position.y = 0.85;
    const coneN = coneP.clone(); coneN.position.y = -0.85; coneN.rotation.z = Math.PI;
    g.add(rod, coneP, coneN); group.add(g);
    return { g, rodMat, headMat };
  }
  const dipD = makeDipole(0x67e8f9);
  const dipA = makeDipole(0xf9a8d4);

  // —— 能量跳迁“光子” + 连接视线 ——
  const hopGeo = geo(new THREE.SphereGeometry(0.16, 10, 10));
  const hopMat = mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
  const hop = new THREE.Mesh(hopGeo, hopMat); group.add(hop);
  const linkGeo = geo(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]));
  const link = new THREE.Line(linkGeo, mat(new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.6 })));
  group.add(link);
  const linkPos = linkGeo.attributes['position'] as import('three').BufferAttribute;

  // —— 距离标尺（两端到中心的双箭头）——
  const scaleGeo = geo(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-2, -1.4, 0), new THREE.Vector3(2, -1.4, 0)]));
  group.add(new THREE.Line(scaleGeo, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));

  function makeLabel(text: string, color: string, scale = 3): import('three').Sprite {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 26px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1); return s;
  }
  const lD = makeLabel('供体 Donor', '#67e8f9', 2.6); group.add(lD);
  const lA = makeLabel('受体 Acceptor', '#f9a8d4', 2.6); group.add(lA);

  // —— 信息面板（含 E(r) 曲线）——
  const infoCv = document.createElement('canvas'); infoCv.width = 860; infoCv.height = 320;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoSprite = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  infoSprite.position.set(0, 5.9, 0); infoSprite.scale.set(9.8, 3.6, 1); infoSprite.renderOrder = 999;
  group.add(infoSprite);

  let rNm = 5, k2 = 1, R0eff = R0, E = 0.5, kET = 1 / tauD;

  function efficiency(rr: number, r0e: number): number {
    const x = rr / r0e;
    return 1 / (1 + Math.pow(x, 6));
  }
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 860, 320);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(4, 4, 852, 312);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 852, 312);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    infoCtx.fillText('FRET 荧光共振能量转移 — 偶极–偶极 1/r⁶ 无辐射耦合', 20, 36);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('E = 1/(1+(r/R₀)⁶)    k_ET = τ_D⁻¹·(R₀/r)⁶    R₀_eff=R₀·(κ²/(2/3))^{1/6}', 20, 70);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('κ = μ_D·μ_A − 3(μ_D·r̂)(μ_A·r̂)，κ²∈[0,4] —— 取向失准可“关掉”转移', 20, 102);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 22px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：r = ${rNm.toFixed(1)}nm  κ² = ${k2.toFixed(2)}  R₀_eff = ${R0eff.toFixed(2)}nm  E = ${(E * 100).toFixed(0)}%  k_ET = ${kET.toFixed(1)} ns⁻¹`, 20, 134);

    // E(r) 曲线，横轴 r 1..10 nm
    const gx0 = 30, gx1 = 400, gy0 = 300, gy1 = 160;
    const xr = (rv: number) => gx0 + ((rv - 1) / 9) * (gx1 - gx0);
    const ye = (ev: number) => gy0 - ev * (gy0 - gy1);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 1; infoCtx.strokeRect(gx0, gy1, gx1 - gx0, gy0 - gy1);
    infoCtx.fillStyle = '#64748b'; infoCtx.font = '16px sans-serif';
    infoCtx.fillText('E', gx0 + 4, gy1 + 16); infoCtx.fillText('r (nm) 1→10', gx1 - 90, gy0 + 16);
    // 当前 κ² 曲线
    infoCtx.strokeStyle = '#ef4444'; infoCtx.lineWidth = 2; infoCtx.beginPath();
    for (let i = 0; i <= 90; i++) { const rv = 1 + (i / 90) * 9; const e = efficiency(rv, R0eff); i === 0 ? infoCtx.moveTo(xr(rv), ye(e)) : infoCtx.lineTo(xr(rv), ye(e)); }
    infoCtx.stroke();
    // R0(κ²=2/3) 参考曲线（虚线感：多点）
    infoCtx.fillStyle = '#475569';
    for (let i = 0; i <= 60; i++) { const rv = 1 + (i / 60) * 9; const e = efficiency(rv, R0); infoCtx.fillRect(xr(rv), ye(e), 2, 2); }
    // 当前点
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.beginPath(); infoCtx.arc(xr(rNm), ye(E), 5, 0, Math.PI * 2); infoCtx.fill();
    // E=0.5 线
    infoCtx.strokeStyle = '#22c55e'; infoCtx.lineWidth = 1;
    infoCtx.beginPath(); infoCtx.moveTo(gx0, ye(0.5)); infoCtx.lineTo(gx1, ye(0.5)); infoCtx.stroke();

    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '20px "PingFang SC", sans-serif';
    infoCtx.fillText('供体亮 ∝(1−E)，受体亮 ∝E；能量跳迁频率 ∝k_ET', 420, 200);
    infoCtx.fillText('绿线 E=50% 处 r=R₀_eff：这就是测分子间距的原理', 420, 236);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  return {
    update(t, dt) {
      // 主扫描：间距 r 1→10 nm（周期 16 s）
      const rf = (t % 16) / 16;
      rNm = 1 + (Math.sin(rf * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5) * 9;
      // 次扫描：受体偶极取向 φ_A（周期 11 s），供体偶极沿 r̂（x 轴）
      const phiA = (Math.sin(((t % 11) / 11) * Math.PI * 2) * 0.5 + 0.5) * Math.PI;   // 0..π
      const rHat = new THREE.Vector3(1, 0, 0);
      const muD = new THREE.Vector3(1, 0, 0);
      const muA = new THREE.Vector3(Math.cos(phiA), Math.sin(phiA), 0);
      const kap = muD.dot(muA) - 3 * muD.dot(rHat) * muA.dot(rHat);
      k2 = kap * kap;
      R0eff = R0 * Math.pow(Math.max(1e-3, k2) / K_ISO, 1 / 6);
      E = efficiency(rNm, R0eff);
      kET = (1 / tauD) * Math.pow(R0eff / rNm, 6);

      // 布局
      const half = rNm * 0.42 / 2;
      donor.position.set(-half, 0, 0);
      acceptor.position.set(half, 0, 0);
      dipD.g.position.copy(donor.position); dipD.g.quaternion.setFromUnitVectors(UP, muD);
      dipA.g.position.copy(acceptor.position); dipA.g.quaternion.setFromUnitVectors(UP, muA);

      // 亮度（同源 E）：供体脉冲幅度∝(1−E)，受体∝E
      const pulse = 0.55 + 0.45 * Math.sin(t * 4);
      donorMat.emissiveIntensity = 0.3 + 2.4 * (1 - E) * pulse;
      acceptMat.emissiveIntensity = 0.2 + 2.6 * E * pulse;

      // 能量跳迁光子：速率 ∝ k_ET（归一化）
      const hopRate = 0.4 + 4 * E;                 // E 大→跳得频繁
      const ph = (t * hopRate) % 1;
      hop.position.set(-half + ph * (2 * half), 0, 0);
      hop.visible = E > 0.02;
      hop.material.opacity = 1;

      // 连接视线 + 标签跟随
      const la = linkPos.array as Float32Array;
      la[0] = -half; la[3] = half; la[1] = la[4] = 0.5;
      linkPos.needsUpdate = true;
      lD.position.set(-half, -0.9, 0);
      lA.position.set(half, -0.9, 0);

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
