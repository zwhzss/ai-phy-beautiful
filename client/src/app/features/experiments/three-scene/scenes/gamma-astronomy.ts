import type { SceneContext, SceneInstance } from '../types';
/**
 * 伽马射线天文观测（P280）：对产生量能器 + 上下追踪器符合锥重建入射方向（Fermi-LAT 型结构）。
 * 主控方程：
 *   ① 对产生阈值（核场中）E_γ > 2m_e c² = 1.022 MeV；转换概率 P = 1 − exp(−7t/9X₀)
 *   ② Heitler 电磁级联：N(t) = 2^t，每个粒子能量 E₀/2^t，直到临界能 E_c ⇒ t_max = log₂(E₀/E_c)（单位 X₀）
 *   ③ 对产生开对角 θ_pair ≈ m_e c²/E_γ（相对论会聚）
 *   ④ 纵向剖面 dE/dt ∝ t^{a}e^{−t}（峰位于 t_max）；符合锥半角 θ = atan(|r₂−r₁|/Δz)，前后向歧义
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

  // ============ 真实探测参数 ============
  const ME_C2 = 0.511;          // MeV
  const THRESH = 2 * ME_C2;     // 1.022 MeV
  const X0_CSI = 0.86;          // cm（CsI 辐射长度）
  const E_CRIT = 34;            // MeV（CsI 临界能量）
  const LAYER_X0 = 1.0;         // 每量能器层厚度（X₀）
  const N_CAL = 11;
  const K_B = 1.380649e-23, H_P = 6.62607015e-34, C_L = 2.99792458e8;

  // 世界尺度：量能器层间距 0.31 unit = 1 X₀ ⇒ 1 unit ≈ 2.8 cm
  const STACK_X = -2.4, TRK_TOP = 2.25, TRK_BOT = 1.55, CAL_TOP = 1.05, LAYER_H = 0.31;
  const CM_PER_UNIT = X0_CSI / LAYER_H;     // 2.774 cm/unit（由层间距反推的比例尺）
  const X0_W = 0.676;                        // cm（钨辐射长度，转换箔为钨）
  const FOIL_T_UNIT = 0.035;                 // 转换箔在场景中画出的厚度（unit）
  const FOIL_X0 = (FOIL_T_UNIT * CM_PER_UNIT) / X0_W;   // ⇒ 0.097 cm ≈ 0.14 X₀
  const BAR_X0 = STACK_X + 0.85;
  const dzTrk = TRK_TOP - TRK_BOT;

  let e0MeV = 1000;             // 入射光子能量（MeV，扫描量，对数）
  let tMax = 0, thetaPair = 0, convProb = 0;

  // ============ 追踪器：两片径迹室 + 钨转换箔 ============
  const trkMat = mat(new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6, roughness: 0.45, transparent: true, opacity: 0.45 }));
  const trkGeo = geo(new THREE.BoxGeometry(2.5, 0.05, 2.5));
  for (const y of [TRK_TOP, TRK_BOT]) {
    const plane = new THREE.Mesh(trkGeo, trkMat);
    plane.position.set(STACK_X, y, 0);
    group.add(plane);
  }
  const convFoil = new THREE.Mesh(geo(new THREE.BoxGeometry(2.3, FOIL_T_UNIT, 2.3)), mat(new THREE.MeshStandardMaterial({ color: 0xa855f7, metalness: 0.8, roughness: 0.3, transparent: true, opacity: 0.55 })));
  convFoil.position.set(STACK_X, TRK_BOT - 0.12, 0);
  group.add(convFoil);

  // 命中环（每片上的半径圈，标记击中的横向位置）
  const ringGeo = geo(new THREE.TorusGeometry(1, 0.02, 6, 40));
  const ringMatA = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
  const ringMatB = mat(new THREE.MeshBasicMaterial({ color: 0x22c55e }));
  const ringA = new THREE.Mesh(ringGeo, ringMatA);
  const ringB = new THREE.Mesh(ringGeo, ringMatB);
  ringA.rotation.x = Math.PI / 2;
  ringB.rotation.x = Math.PI / 2;
  ringA.position.set(STACK_X, TRK_TOP + 0.05, 0);
  ringB.position.set(STACK_X, TRK_BOT + 0.05, 0);
  group.add(ringA, ringB);
  const hitGeo = geo(new THREE.SphereGeometry(0.055, 10, 8));
  const hitMatA = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
  const hitMatB = mat(new THREE.MeshBasicMaterial({ color: 0x22c55e }));
  const hitA = new THREE.Mesh(hitGeo, hitMatA);
  const hitB = new THREE.Mesh(hitGeo, hitMatB);
  group.add(hitA, hitB);

  // ============ 量能器：等厚 CsI 层（发光 ∝ dE/dt），旁侧条形图给出纵向剖面 ============
  const calMats: import('three').MeshStandardMaterial[] = [];
  const calMeshes: import('three').Mesh[] = [];
  const barMats: import('three').MeshBasicMaterial[] = [];
  const barMeshes: import('three').Mesh[] = [];
  const calGeo = geo(new THREE.BoxGeometry(1.5, 0.26, 1.6));
  const barGeo = geo(new THREE.BoxGeometry(1, 0.16, 0.42));
  for (let j = 0; j < N_CAL; j++) {
    const m = mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.2, roughness: 0.6, emissive: 0xfbbf24, emissiveIntensity: 0.2, transparent: true, opacity: 0.8 }));
    const b = new THREE.Mesh(calGeo, m);
    b.position.set(STACK_X, CAL_TOP - LAYER_H * (j + 0.5), 0);
    group.add(b);
    calMats.push(m);
    calMeshes.push(b);
    const bm = mat(new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.85 }));
    const bar = new THREE.Mesh(barGeo, bm);
    group.add(bar);
    barMats.push(bm);
    barMeshes.push(bar);
  }
  const profGeo = geo(new THREE.BufferGeometry());
  profGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N_CAL + 1) * 3), 3));
  group.add(new THREE.Line(profGeo, mat(new THREE.LineBasicMaterial({ color: 0xf8fafc }))));

  // 纵向剖面：Heitler γ 分布，峰在 t_max（∝ 每层能量）
  function deposit(j: number): number {
    const t = j + 0.5;                        // 深度（X₀）
    if (e0MeV <= THRESH) return 0;
    const a = Math.max(0.2, tMax);
    const f = Math.pow(t / a, a) * Math.exp(a - t);   // 归一化峰 = 1
    return Math.min(1, f);
  }
  function updateCalorimeter(): void {
    const pp = profGeo.attributes['position'].array as Float32Array;
    pp[0] = BAR_X0; pp[1] = CAL_TOP; pp[2] = 0;
    for (let j = 0; j < N_CAL; j++) {
      const y = CAL_TOP - LAYER_H * (j + 0.5);
      const f = deposit(j) * eventScale;
      const len = 0.06 + 2.5 * f;
      const bar = barMeshes[j];
      bar.scale.x = len;
      bar.position.set(BAR_X0 + len / 2, y, 1.15);
      barMats[j].color.setHSL(0.02 + 0.1 * f, 0.92, 0.42 + 0.22 * f);
      calMats[j].emissiveIntensity = 0.12 + 1.1 * f;
      calMats[j].color.setHSL(0.14 - 0.1 * f, 0.85, 0.4 + 0.2 * f);
      pp[(j + 1) * 3] = BAR_X0 + len;
      pp[(j + 1) * 3 + 1] = y;
      pp[(j + 1) * 3 + 2] = 1.15;
    }
    profGeo.attributes['position'].needsUpdate = true;
  }

  // ============ 簇射树（对产生 + 级联，逐代分叉） ============
  const MAX_SEG = 460;
  const showerGeo = geo(new THREE.BufferGeometry());
  const shPos = new Float32Array(MAX_SEG * 6);
  const shCol = new Float32Array(MAX_SEG * 6);
  showerGeo.setAttribute('position', new THREE.BufferAttribute(shPos, 3));
  showerGeo.setAttribute('color', new THREE.BufferAttribute(shCol, 3));
  const showerMat = mat(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 }));
  group.add(new THREE.LineSegments(showerGeo, showerMat));
  const ePlusMat = mat(new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  const eMinusMat = mat(new THREE.MeshBasicMaterial({ color: 0x3b82f6 }));
  const trackBallGeo = geo(new THREE.SphereGeometry(0.05, 8, 6));
  const ballP = new THREE.Mesh(trackBallGeo, ePlusMat);
  const ballM = new THREE.Mesh(trackBallGeo, eMinusMat);
  group.add(ballP, ballM);

  let eventScale = 1;
  let convX = 0.4, convZ = -0.2, dirTheta = 9, dirPhi = 0.6;
  let nSeg = 0;

  function buildShower(): void {
    nSeg = 0;
    const yStart = TRK_BOT - 0.12;
    if (e0MeV <= THRESH) {
      for (let i = 0; i < MAX_SEG * 6; i++) { shPos[i] = 0; shCol[i] = 0; }
      showerGeo.attributes['position'].needsUpdate = true;
      showerGeo.attributes['color'].needsUpdate = true;
      return;
    }
    // 放大系数：真实 θ_pair 为毫弧度级，画面上放大到可见（面板注明）
    const thReal = ME_C2 / e0MeV;                       // rad
    const thDraw = Math.min(0.42, 0.035 + 0.55 * thReal * 400);
    const steps = Math.min(N_CAL + 3, Math.max(3, Math.round(tMax * 0.9) + 3));
    const dy = (CAL_TOP - yStart + 2.4) / steps;
    interface Br { x: number; y: number; z: number; dx: number; dz: number; e: number; gen: number; }
    const dir0 = new THREE.Vector3(Math.sin(dirTheta / DEG) * Math.cos(dirPhi), 0, Math.sin(dirTheta / DEG) * Math.sin(dirPhi));
    let frontier: Br[] = [
      { x: convX, y: yStart, z: convZ, dx: dir0.x, dz: dir0.z, e: 0.5, gen: 0 },
      { x: convX, y: yStart, z: convZ, dx: -dir0.x * 0.6, dz: -dir0.z * 0.6, e: 0.5, gen: 0 },
    ];
    for (let s = 0; s < steps && nSeg < MAX_SEG; s++) {
      const next: Br[] = [];
      for (const b of frontier) {
        const ny = b.y - dy;
        const nx = b.x + b.dx * dy * 1.6, nz = b.z + b.dz * dy * 1.6;
        if (nSeg < MAX_SEG) {
          const c = 0.55 + 0.45 * Math.sin(b.gen * 1.7);
          shPos[nSeg * 6] = b.x; shPos[nSeg * 6 + 1] = b.y; shPos[nSeg * 6 + 2] = b.z;
          shPos[nSeg * 6 + 3] = nx; shPos[nSeg * 6 + 4] = ny; shPos[nSeg * 6 + 5] = nz;
          const bright = Math.max(0.12, b.e);
          shCol[nSeg * 6] = c * bright; shCol[nSeg * 6 + 1] = (1 - c) * bright * 0.8; shCol[nSeg * 6 + 2] = bright;
          shCol[nSeg * 6 + 3] = c * bright; shCol[nSeg * 6 + 4] = (1 - c) * bright * 0.8; shCol[nSeg * 6 + 5] = bright;
          nSeg++;
        }
        // 每代能量折半；到临界能以下停止倍增（吸收）
        const eChild = b.e * 0.5;
        if (eChild > 0.012 && next.length + frontier.length < 130) {
          for (let k = 0; k < 2; k++) {
            const ang = thDraw * (k === 0 ? 1 : -1) * (0.6 + 0.7 * Math.random());
            const ca = Math.cos(ang), sa = Math.sin(ang);
            const ddx = b.dx * ca - b.dz * sa, ddz = b.dx * sa + b.dz * ca;
            next.push({ x: nx, y: ny, z: nz, dx: ddx + (Math.random() - 0.5) * 0.02, dz: ddz + (Math.random() - 0.5) * 0.02, e: eChild, gen: b.gen + 1 });
          }
        }
      }
      if (!next.length) break;
      frontier = next;
    }
    for (let i = nSeg; i < MAX_SEG; i++) {
      for (let q = 0; q < 6; q++) { shPos[i * 6 + q] = 0; shCol[i * 6 + q] = 0; }
    }
    showerGeo.attributes['position'].needsUpdate = true;
    showerGeo.attributes['color'].needsUpdate = true;
  }

  // ============ 符合锥与重建方向 ============
  const coneGeo = geo(new THREE.BufferGeometry());
  const CONE_RAYS = 24;
  coneGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CONE_RAYS * 2 * 3), 3));
  const coneMat = mat(new THREE.LineBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.5 }));
  group.add(new THREE.LineSegments(coneGeo, coneMat));
  const reconGeo = geo(new THREE.BufferGeometry());
  reconGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  const reconMat = mat(new THREE.LineBasicMaterial({ color: 0x22c55e }));
  group.add(new THREE.LineSegments(reconGeo, reconMat));

  function updateCone(): number {
    const r1 = convRadius;                     // 上片命中半径
    const r2 = r1 + dzTrk * Math.tan(dirTheta / DEG);
    const th = Math.atan((r2 - r1) / dzTrk);   // 符合锥半角 = 入射角
    ringA.scale.setScalar(r1);
    ringB.scale.setScalar(Math.min(r2, 1.2));
    const apex = new THREE.Vector3(STACK_X + r1 * Math.cos(dirPhi), TRK_TOP, r1 * Math.sin(dirPhi));
    hitA.position.copy(apex);
    const low = new THREE.Vector3(STACK_X + r2 * Math.cos(dirPhi), TRK_BOT, r2 * Math.sin(dirPhi));
    hitB.position.copy(low);
    const L = 2.4;
    const ca = coneGeo.attributes['position'].array as Float32Array;
    for (let k = 0; k < CONE_RAYS; k++) {
      const phi = (k / CONE_RAYS) * TWO_PI;
      // 锥轴 = 由命中指向下方的候选方向；绕水平轴旋转 th
      const axx = -Math.cos(phi) * Math.sin(th), ayy = -Math.cos(th), azz = -Math.sin(phi) * Math.sin(th);
      ca[k * 6] = apex.x; ca[k * 6 + 1] = apex.y; ca[k * 6 + 2] = apex.z;
      ca[k * 6 + 3] = apex.x + axx * L; ca[k * 6 + 4] = apex.y + ayy * L; ca[k * 6 + 5] = apex.z + azz * L;
    }
    coneGeo.attributes['position'].needsUpdate = true;
    // 重建方向（下/上双解 = 前后向歧义）
    const rp = reconGeo.attributes['position'].array as Float32Array;
    const dxx = Math.sin(th) * Math.cos(dirPhi), dzz = Math.sin(th) * Math.sin(dirPhi);
    rp[0] = apex.x - dxx * 1.0; rp[1] = apex.y + Math.cos(th) * 1.0; rp[2] = apex.z - dzz * 1.0;
    rp[3] = low.x + dxx * L; rp[4] = low.y - Math.cos(th) * L; rp[5] = low.z + dzz * L;
    rp[6] = apex.x - dxx * 1.0; rp[7] = apex.y + Math.cos(th) * 1.0; rp[8] = apex.z - dzz * 1.0;
    rp[9] = apex.x + dxx * 1.6; rp[10] = apex.y - Math.cos(th) * 1.6; rp[11] = apex.z + dzz * 1.6;
    reconGeo.attributes['position'].needsUpdate = true;
    return th;
  }

  let convRadius = 0.42;
  function newEvent(seed: number): void {
    const rnd = (n: number): number => {
      const v = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
      return v - Math.floor(v);
    };
    convRadius = 0.2 + 0.45 * rnd(1);
    // 先定方向再用同一 dirPhi 定位转换点：否则径迹/锥面（updateCone 用新值）与转换点（旧值）错位
    dirTheta = 4 + 16 * rnd(2);
    dirPhi = rnd(3) * TWO_PI;
    convX = STACK_X + convRadius * Math.cos(dirPhi);
    convZ = convRadius * Math.sin(dirPhi);
  }

  // ============ 入射光子 ============
  const gammaGeo = geo(new THREE.BufferGeometry());
  gammaGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const gammaMat = mat(new THREE.LineBasicMaterial({ color: 0xa855f7 }));
  group.add(new THREE.LineSegments(gammaGeo, gammaMat));

  // ============ 标签 ============
  function makeLabel(text: string, color: string, scale = 3.4): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 25px "PingFang SC", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  const lblTrk = makeLabel('径迹室：上下两片符合 ⇒ 锥面', '#22d3ee', 3.4);
  lblTrk.position.set(STACK_X - 1.5, TRK_TOP + 0.75, 0);
  group.add(lblTrk);
  const lblCal = makeLabel('CsI 量能器：每层 1 X₀，柱长 ∝ dE/dt', '#fbbf24', 3.9);
  lblCal.position.set(0.6, -1.5, 0);
  group.add(lblCal);
  const lblCone = makeLabel('符合锥：前后向二义性', '#f472b6', 3.2);
  lblCone.position.set(STACK_X + 0.2, TRK_TOP + 1.6, 1.3);
  group.add(lblCone);

  // ============ 面板 ============
  const infoCv = document.createElement('canvas');
  infoCv.width = 900; infoCv.height = 300;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.4, 3.13)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0.6, 5.3, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  const ln = (y: number, color: string, text: string, bold = false, size = 26): void => {
    infoCtx.fillStyle = color;
    infoCtx.font = `${bold ? 'bold ' : ''}${size}px "PingFang SC", sans-serif`;
    infoCtx.fillText(text, 22, y);
  };
  let reconTheta = 0, evLabel = '';
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 900, 300);
    infoCtx.fillStyle = 'rgba(7,11,20,0.86)';
    infoCtx.fillRect(4, 4, 892, 292);
    infoCtx.strokeStyle = '#334155';
    infoCtx.lineWidth = 3;
    infoCtx.strokeRect(4, 4, 892, 292);
    infoCtx.textAlign = 'left';

    ln(40, '#f8fafc', '伽马射线天文 —— 对产生、电磁级联与符合定向', true);
    ln(78, '#a855f7', `阈值 E > 2m_ec² = ${THRESH.toFixed(3)} MeV（真空中动量守恒禁止单光子对产生，需核场）；钨箔 t = ${(FOIL_T_UNIT * CM_PER_UNIT).toFixed(3)} cm = ${FOIL_X0.toFixed(3)} X₀ ⇒ P = 1−e^{−7t/9X₀} = ${(convProb * 100).toFixed(1)}%`);
    ln(112, '#22d3ee', `Heitler：N(t)=2^t ⇒ t_max = log₂(E₀/E_c) = ${tMax.toFixed(2)} X₀ = ${(tMax * X0_CSI).toFixed(2)} cm（CsI，E_c=${E_CRIT} MeV）`);
    ln(146, '#fbbf24', `对开角 θ_pair ≈ m_ec²/E₀ = ${(thetaPair * 1000).toFixed(4)} mrad = ${(thetaPair * DEG * 3600).toFixed(2)}″（图中按可见尺度放大）`);
    ln(180, '#f472b6', `符合锥半角 θ = atan(|r₂−r₁|/Δz) = ${(reconTheta * DEG).toFixed(2)}°（Δz = ${(dzTrk * X0_CSI / LAYER_H).toFixed(1)} cm 比例尺），双解=前后向歧义`);

    infoCtx.fillStyle = e0MeV > THRESH ? '#fbbf24' : '#ef4444';
    infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：E₀ = ${e0MeV >= 1000 ? (e0MeV / 1000).toFixed(2) + ' GeV' : e0MeV.toFixed(1) + ' MeV'}  转换概率 ${(convProb * 100).toFixed(0)}%  ${evLabel}`,
      22, 222,
    );
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText(e0MeV > THRESH ? '能量沉积剖面峰位随 E₀ 每增 10 倍下移 log₂10 = 3.32 X₀（暴发 vs 稳态源的判据）' : '低于阈值：只能靠康普顿散射/准直器成像，方向分辨能力骤降', 22, 264);
    infoTex.needsUpdate = true;
  }

  function computeState(): void {
    tMax = Math.log2(Math.max(e0MeV, 1e-6) / E_CRIT);
    thetaPair = ME_C2 / e0MeV;
    convProb = e0MeV > THRESH ? 1 - Math.exp(-(7 / 9) * FOIL_X0) : 0;   // Bethe–Heitler：P = 1−e^{−7t/9X₀}，t 取自画出箔厚 ⇒ ≈10%
  }

  computeState();
  newEvent(1);
  updateCone();
  buildShower();
  updateCalorimeter();
  drawInfo();

  let seed = 1;
  let lastEvent = -1;

  return {
    update(t, dt) {
      // 入射光子能量在 0.3 MeV → 50 GeV 间对数扫描，周期 16 s（跨越 1.022 MeV 阈值）
      const ph = 0.5 - 0.5 * Math.cos(((t % 16) / 16) * TWO_PI);
      e0MeV = Math.pow(10, Math.log10(0.3) + ph * (Math.log10(5e4) - Math.log10(0.3)));
      computeState();

      // 事例发育：每 4 s 一个新事例（新的命中位置/入射角），簇射逐段生长
      const ev = Math.floor(t / 4);
      if (ev !== lastEvent) {
        lastEvent = ev;
        seed = ev + 1;
        newEvent(seed);
        reconTheta = updateCone();
        buildShower();
      }
      const grow = (t % 4) / 2.2;
      eventScale = Math.min(1, grow);
      const shown = Math.min(nSeg, Math.floor(nSeg * Math.min(1, grow)));
      showerGeo.setDrawRange(0, shown * 2);
      updateCalorimeter();

      // 入射光子轨迹（自上而下直至转换箔）
      const gp = gammaGeo.attributes['position'].array as Float32Array;
      const apexY = TRK_TOP + 1.5;
      gp[0] = convX + 1.4; gp[1] = apexY; gp[2] = convZ + 1.4;
      const k = Math.min(1, grow * 1.4);
      gp[3] = gp[0] + (convX - gp[0]) * k; gp[4] = apexY + (TRK_BOT - 0.12 - apexY) * k; gp[5] = gp[2] + (convZ - gp[2]) * k;
      gammaGeo.attributes['position'].needsUpdate = true;
      gammaMat.color.setHex(e0MeV > THRESH ? 0xa855f7 : 0xef4444);

      // e± 首对粒子
      const sep = 0.5 * Math.min(1, grow);
      ballP.position.set(convX + sep * 0.6, TRK_BOT - 0.12 - sep, convZ + sep * 0.3);
      ballM.position.set(convX - sep * 0.5, TRK_BOT - 0.12 - sep * 1.1, convZ - sep * 0.4);
      ballP.visible = ballM.visible = e0MeV > THRESH;

      evLabel = e0MeV > THRESH
        ? `簇射峰在第 ${tMax.toFixed(1)} 层（共 ${N_CAL} 层 X₀），${tMax > N_CAL ? '能量泄露！需更厚量能器' : '纵向约束良好'}`
        : 'E < 1.022 MeV：不发生对产生，无级联';

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
