import type { SceneContext, SceneInstance } from '../types';
/**
 * 恒星光谱观测（P269）：狭缝→准直镜→反射光栅→CCD 的三维光路，谱线扇面随视向速度整体平移。
 * 主控方程：
 *   ① 光栅方程 mλ = d(sinα + sinβ)，α 入射角、d 刻线间距 ⇒ 出射方向角 = θ_n − β
 *   ② 角色散 dθ/dλ = m/(d·cosβ)；线色散 = L·dθ/dλ
 *   ③ 多普勒视向速度 v_r = c·Δλ/λ₀ ⇒ λ_obs = λ₀(1 + v_r/c)
 *   ④ 分辨率 R = λ/Δλ = m·N_ill；谱廓 I(λ) = B_λ(T_eff)·Π[1 − d_j·exp(−Δλ²/2σ²)]
 *   ⑤ 等值宽度 EW = ∫(1 − I/B_λ)dλ（对当前 Hα 观测位置直接数值积分，与画布谱廓同一 profileAt 源）
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

  const TWO_PI = Math.PI * 2, DEG = 180 / Math.PI;

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

  // ============ 真实光栅/探测器参数（世界尺度 1 unit = 0.1 m = 10 cm） ============
  const M_PER_UNIT = 0.1;
  const C_KMS = 299792.458;                 // km/s
  const GROOVE_D_NM = 833.33;               // nm ⇒ 1200 线/mm
  const ORDER = 1;
  const ALPHA = 20 / DEG;                   // 入射角
  const BEAM_R = 0.26;                      // unit ⇒ 准直光束半径 2.6 cm
  const N_ILL = (2 * BEAM_R * M_PER_UNIT) / (GROOVE_D_NM * 1e-9); // 照明刻线数
  const L_CAM = 2.6;                        // unit ⇒ 相机焦距 26 cm
  const H_P = 6.62607015e-34, C_L = 2.99792458e8, K_B = 1.380649e-23, T_EFF = 5778;
  const NM_LO = 400, NM_HI = 700;

  const LINES: { nm: number; depth: number; name: string }[] = [
    { nm: 393.4, depth: 0.93, name: 'Ca K' },
    { nm: 434.0, depth: 0.6, name: 'Hγ' },
    { nm: 486.1, depth: 0.72, name: 'Hβ' },
    { nm: 517.0, depth: 0.55, name: 'Mg b' },
    { nm: 589.0, depth: 0.6, name: 'Na D' },
    { nm: 656.3, depth: 0.78, name: 'Hα' },
  ];

  const betaOf = (nm: number): number => {
    const s = (ORDER * nm) / GROOVE_D_NM - Math.sin(ALPHA);
    return Math.asin(Math.max(-0.999, Math.min(0.999, s)));
  };
  const REF_NM = 550;
  const BETA_REF = betaOf(REF_NM);
  const TH_N = 160 / DEG;                              // 光栅法线方位角
  const dirOf = (nm: number): import('three').Vector3 => {
    const b = betaOf(nm);
    // m=0 ⇒ β=−α 必须落回镜面反射方位 TH_N−α，故衍射光线方位为 TH_N+β
    return new THREE.Vector3(Math.cos(TH_N + b), Math.sin(TH_N + b), 0);
  };
  const meanDir = dirOf(REF_NM);
  const inPlane = new THREE.Vector3(Math.cos(TH_N + BETA_REF + Math.PI / 2), Math.sin(TH_N + BETA_REF + Math.PI / 2), 0);
  const GX = 0.9, GY = -1.35;
  const Gpt = new THREE.Vector3(GX, GY, 0);
  const P0 = Gpt.clone().addScaledVector(meanDir, L_CAM);
  const GAP_W = 0.66;                                   // 焦面半宽（unit）

  // 波长 → 焦面归一化坐标（±1 = 焦面边缘），由光线与焦面平面的真实交点算出
  function detCoord(nm: number): number {
    const u = dirOf(nm);
    const den = u.dot(meanDir);
    if (den <= 1e-3) return NaN;
    const hit = Gpt.clone().addScaledVector(u, L_CAM / den).sub(P0);
    return hit.dot(inPlane) / GAP_W;
  }
  // px ↔ 波长查找表（保证纹理谱线与几何光线用同一套坐标）
  const TAB_N = 600;
  const tabNm: number[] = [], tabPx: number[] = [];
  for (let i = 0; i <= TAB_N; i++) {
    const nm = NM_LO + ((NM_HI - NM_LO) * i) / TAB_N;
    tabNm.push(nm);
    tabPx.push((((detCoord(nm) + 1) / 2) * 1024));
  }
  function pxOfNm(nm: number): number {
    if (nm <= tabNm[0]) return tabPx[0];
    if (nm >= tabNm[TAB_N]) return tabPx[TAB_N];
    const f = ((nm - NM_LO) / (NM_HI - NM_LO)) * TAB_N;
    const i = Math.floor(f), w = f - i;
    return tabPx[i] * (1 - w) + tabPx[i + 1] * w;
  }

  function wavelengthRGB(nm: number): [number, number, number] {
    let r = 0, g = 0, b = 0;
    if (nm < 440) { r = (440 - nm) / 60; b = 1; }
    else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
    else if (nm < 510) { g = 1; b = (510 - nm) / 20; }
    else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
    else if (nm < 645) { r = 1; g = (645 - nm) / 65; }
    else r = 1;
    const edge = 0.35 + 0.65 * Math.max(0, Math.min(1, (nm - 396) / 50)) * Math.max(0, Math.min(1, (704 - nm) / 50));
    return [r * edge, g * edge, b * edge];
  }

  // ============ 光机元件 ============
  const benchMat = mat(new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.6 }));
  const rail = new THREE.Mesh(geo(new THREE.BoxGeometry(6.2, 0.07, 0.28)), benchMat);
  rail.position.set(-0.7, -1.9, 0);
  group.add(rail);

  // 恒星（带光晕纹理）
  const glowCv = document.createElement('canvas');
  glowCv.width = 128; glowCv.height = 128;
  {
    const c = glowCv.getContext('2d')!;
    const grad = c.createRadialGradient(64, 64, 2, 64, 64, 62);
    grad.addColorStop(0, 'rgba(253,230,138,0.95)');
    grad.addColorStop(0.45, 'rgba(251,191,36,0.35)');
    grad.addColorStop(1, 'rgba(251,191,36,0)');
    c.fillStyle = grad;
    c.fillRect(0, 0, 128, 128);
  }
  const glowTex = tex(new THREE.CanvasTexture(glowCv));
  const haloMat = mat(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.9 }));
  const halo = new THREE.Sprite(haloMat);
  halo.scale.setScalar(1.5);
  halo.position.set(-3.5, -1.35, 0);
  group.add(halo);
  const starMesh = new THREE.Mesh(geo(new THREE.SphereGeometry(0.2, 20, 16)), mat(new THREE.MeshBasicMaterial({ color: 0xfef3c7 })));
  starMesh.position.copy(halo.position);
  group.add(starMesh);

  // 狭缝
  const slitMat = mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.35 }));
  for (const dy of [-0.62, 0.62]) {
    const plate = new THREE.Mesh(geo(new THREE.BoxGeometry(0.07, 1.16, 0.4)), slitMat);
    plate.position.set(-2.5, -1.35 + dy, 0);
    group.add(plate);
  }
  const slitGap = new THREE.Mesh(geo(new THREE.BoxGeometry(0.09, 0.07, 0.42)), mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85 })));
  slitGap.position.set(-2.5, -1.35, 0);
  group.add(slitGap);

  // 准直镜
  const lensMat = mat(new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.4, metalness: 0.1, roughness: 0.15 }));
  const collimator = new THREE.Mesh(geo(new THREE.CylinderGeometry(BEAM_R + 0.07, BEAM_R + 0.07, 0.08, 28)), lensMat);
  collimator.rotation.z = Math.PI / 2;
  collimator.position.set(-1.7, -1.35, 0);
  group.add(collimator);

  // 光栅（面元法线 = TH_N）
  const gratingMat = mat(new THREE.MeshStandardMaterial({ color: 0xc7d2e5, metalness: 0.95, roughness: 0.2 }));
  const grating = new THREE.Mesh(geo(new THREE.BoxGeometry(1.3, 0.05, 0.5)), gratingMat);
  grating.position.set(GX, GY, 0);
  grating.rotation.z = TH_N - Math.PI / 2;
  group.add(grating);
  const grooveGeo = geo(new THREE.BufferGeometry());
  {
    const pts: number[] = [];
    const tdir = new THREE.Vector3(Math.cos(TH_N - Math.PI / 2), Math.sin(TH_N - Math.PI / 2), 0);   // 刻线沿光栅表面（⊥ 法线）排布
    for (let i = -12; i <= 12; i++) {
      const p = new THREE.Vector3(GX, GY, 0).addScaledVector(tdir, i * 0.05);
      pts.push(p.x, p.y, -0.26, p.x, p.y, 0.26);
    }
    grooveGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  }
  group.add(new THREE.LineSegments(grooveGeo, mat(new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.65 }))));

  // 相机镜头 + CCD 焦面（板面：local x = 色散方向，local y = 狭缝方向，法向 ≈ 平均出射方向）
  const camLens = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 26)), lensMat);
  camLens.position.copy(P0).addScaledVector(meanDir, -0.5);
  camLens.rotation.z = Math.atan2(meanDir.y, meanDir.x) - Math.PI / 2;
  group.add(camLens);

  const detQuat = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(inPlane, new THREE.Vector3(0, 0, 1), meanDir.clone().negate()),
  );
  const specCv = document.createElement('canvas');
  specCv.width = 1024; specCv.height = 256;
  const specCtx = specCv.getContext('2d')!;
  const specTex = tex(new THREE.CanvasTexture(specCv));
  const ccd = new THREE.Mesh(geo(new THREE.PlaneGeometry(GAP_W * 2, 0.5)), mat(new THREE.MeshBasicMaterial({ map: specTex, side: THREE.DoubleSide })));
  ccd.position.copy(P0);
  ccd.quaternion.copy(detQuat);
  group.add(ccd);
  const ccdFrame = new THREE.Mesh(geo(new THREE.PlaneGeometry(GAP_W * 2 + 0.1, 0.6)), mat(new THREE.MeshBasicMaterial({ color: 0x1e293b, side: THREE.DoubleSide })));
  ccdFrame.position.copy(P0).addScaledVector(meanDir, 0.03);
  ccdFrame.quaternion.copy(detQuat);
  group.add(ccdFrame);

  // 入射平行光束
  const inGeo = geo(new THREE.BufferGeometry());
  {
    const pts: number[] = [];
    for (let k = -2; k <= 2; k++) {
      const yy = GY + k * 0.105;
      pts.push(-2.45, yy, 0, GX, yy, 0);
    }
    inGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  }
  group.add(new THREE.LineSegments(inGeo, mat(new THREE.LineBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.7 }))));

  // 色散扇面（顶点色 = 波长色）
  const FAN_N = 26;
  const fanGeo = geo(new THREE.BufferGeometry());
  const fanPos = new Float32Array(FAN_N * 6);
  const fanCol = new Float32Array(FAN_N * 6);
  fanGeo.setAttribute('position', new THREE.BufferAttribute(fanPos, 3));
  fanGeo.setAttribute('color', new THREE.BufferAttribute(fanCol, 3));
  const fanMat = mat(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 }));
  group.add(new THREE.LineSegments(fanGeo, fanMat));

  let vr = 0; // km/s
  function updateFan(): void {
    let v = 0;
    const addRay = (nm: number, bright: number): void => {
      if (v >= FAN_N) return;
      const u = dirOf(nm);
      const den = u.dot(meanDir);
      if (den <= 1e-3) return;
      const hit = Gpt.clone().addScaledVector(u, L_CAM / den);
      const [r, g, b] = wavelengthRGB(nm);
      fanPos[v * 6] = GX; fanPos[v * 6 + 1] = GY; fanPos[v * 6 + 2] = 0;
      fanPos[v * 6 + 3] = hit.x; fanPos[v * 6 + 4] = hit.y; fanPos[v * 6 + 5] = hit.z;
      for (let q = 0; q < 2; q++) {
        fanCol[v * 6 + q * 3] = r * bright;
        fanCol[v * 6 + q * 3 + 1] = g * bright;
        fanCol[v * 6 + q * 3 + 2] = b * bright;
      }
      v++;
    };
    for (let i = 0; i < 16; i++) addRay(NM_LO + 6 + ((NM_HI - NM_LO - 12) * i) / 15, 0.45);
    for (const L of LINES) addRay(L.nm * (1 + vr / C_KMS), 1.7);
    for (; v < FAN_N; v++) {
      for (let q = 0; q < 6; q++) { fanPos[v * 6 + q] = 0; fanCol[v * 6 + q] = 0; }
    }
    fanGeo.attributes['position'].needsUpdate = true;
    fanGeo.attributes['color'].needsUpdate = true;
  }

  // 静止波长参考刻度（粉色）
  const refGeo = geo(new THREE.BufferGeometry());
  {
    const pts: number[] = [];
    for (const L of LINES) {
      const p = P0.clone().addScaledVector(inPlane, detCoord(L.nm) * GAP_W);
      pts.push(p.x, p.y, p.z - 0.3, p.x, p.y, p.z + 0.3);
    }
    refGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  }
  group.add(new THREE.LineSegments(refGeo, mat(new THREE.LineBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.9 }))));

  // 流量廓线（与焦面共用同一色散坐标，画在焦面上方的“屏幕面”内）
  const PROF_N = 220;
  const profGeo = geo(new THREE.BufferGeometry());
  profGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((PROF_N + 1) * 3), 3));
  const profMat = mat(new THREE.LineBasicMaterial({ color: 0x22c55e }));
  group.add(new THREE.Line(profGeo, profMat));
  const planck = (nm: number): number => {
    const l = nm * 1e-9;
    return (2 * H_P * C_L * C_L / l ** 5) / (Math.exp((H_P * C_L) / (l * K_B * T_EFF)) - 1);
  };
  const CONT = planck(500);
  function profileAt(nmObs: number): number {
    const nmRest = nmObs / (1 + vr / C_KMS);
    let f = 1;
    for (const L of LINES) {
      const d = nmRest - L.nm;
      f *= 1 - L.depth * Math.exp(-(d * d) / (2 * 0.85 * 0.85));
    }
    return (planck(nmObs) / CONT) * f;
  }
  const PROF_BASE = 0.42, PROF_H = 0.95;
  // 等值宽度 EW(Hα)=∫(1−I/B_λ)dλ：与画面谱廓同一 profileAt，对当前观测波长 ±6nm 直接数值积分
  function ewHaAngstrom(): number {
    const nmObs0 = 656.3 * (1 + vr / C_KMS);
    const HALF = 6, STEPS = 240, dLam = (2 * HALF) / STEPS;
    let ew = 0;
    for (let i = 0; i < STEPS; i++) {
      const lam = nmObs0 - HALF + dLam * (i + 0.5);
      const cont = planck(lam) / CONT;
      ew += (1 - profileAt(lam) / cont) * dLam;
    }
    return ew * 10; // nm → Å
  }
  function updateProfile(): void {
    const a = profGeo.attributes['position'].array as Float32Array;
    for (let i = 0; i <= PROF_N; i++) {
      const nm = NM_LO + ((NM_HI - NM_LO) * i) / PROF_N;
      const p = P0.clone()
        .addScaledVector(inPlane, detCoord(nm) * GAP_W)
        .addScaledVector(meanDir, PROF_BASE + Math.min(1.2, profileAt(nm)) * PROF_H);
      a[i * 3] = p.x; a[i * 3 + 1] = p.y; a[i * 3 + 2] = 0;
    }
    profGeo.attributes['position'].needsUpdate = true;
  }

  // ============ 标签 ============
  function makeLabel(text: string, color: string, scale = 3.4): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 26px "PingFang SC", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  const lblIn = makeLabel('星光 → 狭缝 → 准直镜 → 光栅', '#94a3b8', 3.9);
  lblIn.position.set(-1.9, -0.6, 0);
  group.add(lblIn);
  const lblFan = makeLabel('扇形色散：长波偏折更大', '#f472b6', 3.5);
  lblFan.position.set(0.05, 0.75, 0);
  group.add(lblFan);
  const lblCcd = makeLabel('CCD：谱线随 v_r 整体滑移', '#22d3ee', 3.6);
  lblCcd.position.copy(P0).addScaledVector(meanDir, -0.62);
  group.add(lblCcd);
  const lblProf = makeLabel('流量廓线 I(λ) = B_λ(T_eff)×吸收线', '#22c55e', 3.9);
  lblProf.position.copy(P0).addScaledVector(meanDir, PROF_BASE + PROF_H + 0.45);
  group.add(lblProf);

  // ============ 面板 ============
  const infoCv = document.createElement('canvas');
  infoCv.width = 900; infoCv.height = 296;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.4, 3.09)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 5.5, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  const dthetaDlam = ORDER / ((GROOVE_D_NM * 1e-9) * Math.cos(BETA_REF)); // rad/m
  const ln = (y: number, color: string, text: string, bold = false, size = 26): void => {
    infoCtx.fillStyle = color;
    infoCtx.font = `${bold ? 'bold ' : ''}${size}px "PingFang SC", sans-serif`;
    infoCtx.fillText(text, 22, y);
  };
  function drawDetector(): void {
    const W = specCv.width, H = specCv.height;
    specCtx.fillStyle = 'rgba(2,6,14,1)';
    specCtx.fillRect(0, 0, W, H);
    for (let i = 0; i < TAB_N; i++) {
      const nm = tabNm[i], nm2 = tabNm[i + 1];
      const x0 = Math.round(tabPx[i]), x1 = Math.max(x0 + 1, Math.round(tabPx[i + 1]));
      if (x1 < 0 || x0 > W) continue;
      for (let px = Math.max(0, x0); px < Math.min(W, x1); px++) {
        const lam = nm + ((nm2 - nm) * (px - x0)) / (x1 - x0);
        const [r, g, b] = wavelengthRGB(lam);
        const inten = Math.max(0, Math.min(1, profileAt(lam)));
        specCtx.fillStyle = `rgba(${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0},${(0.12 + 0.88 * inten).toFixed(3)})`;
        specCtx.fillRect(px, H * 0.3, 1, H * 0.42);
      }
    }
    specCtx.textAlign = 'left';
    specCtx.font = '24px "PingFang SC", sans-serif';
    specCtx.fillStyle = '#94a3b8';
    specCtx.fillText('400 nm', 8, H * 0.24);
    specCtx.fillText('700 nm', W - 78, H * 0.24);
    for (const L of LINES) {
      const nm = L.nm * (1 + vr / C_KMS);
      if (nm < NM_LO || nm > NM_HI) continue;
      const px = pxOfNm(nm);
      specCtx.strokeStyle = 'rgba(248,250,252,0.9)';
      specCtx.lineWidth = 2;
      specCtx.beginPath();
      specCtx.moveTo(px, H * 0.26); specCtx.lineTo(px, H * 0.78);
      specCtx.stroke();
      specCtx.fillStyle = '#f8fafc';
      specCtx.fillText(L.name, px - 16, H * 0.9);
    }
    specTex.needsUpdate = true;
  }
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 900, 296);
    infoCtx.fillStyle = 'rgba(7,11,20,0.86)';
    infoCtx.fillRect(4, 4, 892, 288);
    infoCtx.strokeStyle = '#334155';
    infoCtx.lineWidth = 3;
    infoCtx.strokeRect(4, 4, 892, 288);
    infoCtx.textAlign = 'left';

    ln(40, '#f8fafc', '恒星光谱观测 —— 光栅色散与谱线多普勒位移', true);
    ln(78, '#22d3ee', `mλ = d(sinα+sinβ)：d = ${GROOVE_D_NM.toFixed(0)} nm（1200 线/mm），α = ${(ALPHA * DEG).toFixed(0)}°，m = ${ORDER} ⇒ β(550nm) = ${(BETA_REF * DEG).toFixed(2)}°`);
    ln(112, '#a855f7', `dθ/dλ = m/(d·cosβ) = ${(dthetaDlam * 1e-9).toExponential(3)} rad/nm = ${(dthetaDlam * 1e-9 * DEG).toFixed(4)} °/nm（长波处色散更快）`);
    ln(146, '#22c55e', `线色散 L·dθ/dλ = ${(L_CAM * M_PER_UNIT * dthetaDlam * 1e-9 * 1000).toFixed(3)} mm/nm；R = m·N_ill = ${(ORDER * N_ILL).toExponential(2)}（Δλ ≈ ${((550 / N_ILL) * 1000).toFixed(2)} mÅ）`);
    ln(180, '#f472b6', `粉色刻度=静止波长、白色=观测位置：Δλ(Hα)=${(656.3 * vr / C_KMS * 10).toFixed(3)} Å；EW(Hα)=∫(1−I/B_λ)dλ=${ewHaAngstrom().toFixed(2)} Å`);

    infoCtx.fillStyle = vr > 0 ? '#ef4444' : '#60a5fa';
    infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：v_r = c·Δλ/λ₀ = ${vr >= 0 ? '+' : ''}${vr.toFixed(1)} km/s ⇒ 整条谱线扇面${vr > 0.5 ? '红移（源远离）' : vr < -0.5 ? '蓝移（源靠近）' : '回到零速参考'}`,
      22, 222,
    );
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('恒星/星系的系统速度由此测得；要分辨 m/s 级的行星信号，需要光纤入射＋恒温恒压谱仪', 22, 262);
    infoTex.needsUpdate = true;
  }

  updateFan();
  updateProfile();
  drawDetector();
  drawInfo();

  return {
    update(t, dt) {
      // 视向速度 ±45 km/s 正弦扫描，周期 16 s
      vr = 45 * Math.sin(((t % 16) / 16) * TWO_PI);

      const pulse = 1 + 0.06 * Math.sin(t * 2.2);
      halo.scale.setScalar(1.5 * pulse);
      starMesh.scale.setScalar(pulse);
      slitGap.scale.set(1, 1 + 0.3 * Math.sin(t * 3), 1);

      updateFan();
      updateProfile();

      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) { drawDetector(); drawInfo(); }
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
