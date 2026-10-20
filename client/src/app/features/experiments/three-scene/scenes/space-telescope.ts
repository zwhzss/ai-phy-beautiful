import type { SceneContext, SceneInstance } from '../types';
/**
 * 空间望远镜（P264）：日-地 L2 晕轨道 + 多层辐射屏蔽热控 + 主镜-副镜-焦面光路。
 * 主控方程：
 *   ① L2 距离  r_L2 = a·(μ/3)^{1/3}，μ = M⊕/(M⊙+M⊕) = 3.003×10⁻⁶ ⇒ 1.50×10⁶ km
 *   ② 共线点线性化面内本征频率 ω ≈ 1.996Ω ⇒ 晕轨道周期 T = 2π/ω ≈ 183 d
 *   ③ 多层屏蔽辐射平衡（每层两面各发射 σT⁴）：2u₁−u₂ = q/σ，−u_{i−1}+2u_i−u_{i+1} = 0，u_{n+1}=0
 *      闭合解 u_i = T_i⁴ = (q/σ)·(n+2−i)/(n+1)，q = (1−A)·S·cosβ（β = 姿态偏角）
 *      冷端（焦面，视角因子 g≪1）：T_c = T_n·(g/2)^{1/4}
 *   ④ 遮光判据（罩面 ⊥ 光轴，主镜高 h）：h·tanβ + a ≤ R_shield ⇒ β_crit = atan((R_shield−a)/h)
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  // —— 资源登记 ——
  const geos: { dispose(): void }[] = [];
  const mats: { dispose(): void }[] = [];
  const texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  const TWO_PI = Math.PI * 2;
  const DEG = 180 / Math.PI;

  const starGeo = geo(new THREE.BufferGeometry());
  const starPos = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 200;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));

  // ============ 真实常数（SI，量级正确） ============
  const SIGMA = 5.670374419e-8;          // W·m⁻²·K⁻⁴
  const S_L2 = 1361 / 1.01 ** 2;         // L2 处太阳辐照度 ≈ 1332 W/m²
  const ALBEDO = 0.05;                   // 罩面朝阳侧高反射镀层
  const EMIS = 0.85;                     // 背阳侧发射率
  const N_LAYER = 5;                     // 五层遮阳罩
  const VIEW_G = 1.2e-3;                 // 焦面对最内层的视角因子
  const R_SHIELD = 6.3, A_MIRROR = 2.7, H_SEP = 4.5; // m：罩半宽、主镜半径、主镜到罩面
  const BETA_CRIT = Math.atan((R_SHIELD - A_MIRROR) / H_SEP);      // 38.7°
  const MU_E = 3.003e-6;
  const R_L2_KM = 1.496e8 * Math.cbrt(MU_E / 3);                   // 1.50e6 km
  const T_HALO_D = 365.256 / 1.996;                               // 183 d
  const TH_SUN = Math.asin(6.96e5 / (1.01 * 1.496e8)) * DEG;      // 0.262°（日面半角）
  const TH_EARTH = Math.asin(6371 / R_L2_KM) * DEG;               // 0.243°（地面半角）
  const PENUMBRA = H_SEP * Math.tan(TH_SUN / DEG); // 半影宽 h·tanθ☉ ≈ 20.5 mm（罩面处；TH_SUN 已是角度，/DEG 化弧度仅此一次）

  let beta = 0, temps: number[] = [], shadowOK = true;
  function solveTemps(): void {
    const q = (1 - ALBEDO) * S_L2 * Math.max(0, Math.cos(beta));
    const u1 = q / (EMIS * SIGMA);
    temps = [];
    for (let i = 1; i <= N_LAYER; i++) temps.push(Math.pow((u1 * (N_LAYER + 1 - i)) / (N_LAYER + 1), 0.25));   // u₀=q/(εσ)（第 1 层的热流边界）、u_{n+1}=0 ⇒ 线性 u_i=u₁(n+1−i)/(n+1)
  }
  const coldK = (): number => temps[N_LAYER - 1] * Math.pow(VIEW_G / 2, 0.25);

  const cHot = new THREE.Color(0xef4444), cWarm = new THREE.Color(0xfbbf24), cCool = new THREE.Color(0x60a5fa), cDeep = new THREE.Color(0xa855f7);
  const tmpC = new THREE.Color();
  function tempColor(T: number): import('three').Color {
    const x = Math.max(0, Math.min(1, (T - 40) / (380 - 40)));
    if (x > 0.66) tmpC.copy(cWarm).lerp(cHot, (x - 0.66) / 0.34);
    else if (x > 0.33) tmpC.copy(cCool).lerp(cWarm, (x - 0.33) / 0.33);
    else tmpC.copy(cDeep).lerp(cCool, x / 0.33);
    return tmpC;
  }

  // 尺度：真实米 → 世界单位
  const UFM = 0.24;
  const ru = (m: number): number => m * UFM;
  const SHIELD_X = 2.0, SHIELD_Y = -1.5;

  // ============ 左上：L2 与晕轨道（1 unit = 5×10⁵ km） ============
  const KM_U = 5e5;                            // 1 unit = 5×10⁵ km
  const L2_TRUE_UNITS = R_L2_KM / KM_U;        // 真实应为 3.0 unit，绘制压缩到 L2_DRAW
  const l2 = new THREE.Group();
  l2.position.set(-3.6, 3.4, -1.0);
  group.add(l2);
  const sunBeamMat = mat(new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.5 }));
  for (let k = -2; k <= 2; k++) {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-3.2, k * 0.36, 0, -0.95, k * 0.36, 0]), 3));
    l2.add(new THREE.Line(g, sunBeamMat));
  }
  const earthMesh = new THREE.Mesh(geo(new THREE.SphereGeometry(0.26, 20, 16)), mat(new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.85 })));
  earthMesh.position.set(-0.6, 0, 0);
  l2.add(earthMesh);
  const l2Mark = new THREE.Mesh(geo(new THREE.SphereGeometry(0.06, 10, 10)), mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee })));
  // 真实 1 unit 应为 5×10⁵ km ⇒ r_L2 = 3.0 unit；为排版压缩到 1.30 unit（面板注明压缩比）
  const L2_DRAW = 1.3;
  l2Mark.position.set(L2_DRAW, 0, 0);
  l2.add(l2Mark);
  {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.6, 0, 0, L2_DRAW + 0.8, 0, 0]), 3));
    l2.add(new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.5 }))));
  }
  // 晕轨道：面内半轴 4×10⁵ km，垂直面半轴 8×10⁵ km（按比例 0.8/1.6 unit，同样压缩）
  const HALO_IN = 0.34, HALO_OUT = 0.68, HALO_Y = 0.5;
  const haloGeo = geo(new THREE.BufferGeometry());
  const haloN = 144;
  haloGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((haloN + 1) * 3), 3));
  {
    const a = haloGeo.attributes['position'].array as Float32Array;
    for (let i = 0; i <= haloN; i++) {
      const th = (i / haloN) * TWO_PI;
      a[i * 3] = L2_DRAW + HALO_IN * Math.cos(th);
      a[i * 3 + 1] = HALO_OUT * Math.sin(th);
      a[i * 3 + 2] = HALO_Y * Math.cos(th);
    }
  }
  const haloLine = new THREE.Line(haloGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.7 })));
  l2.add(haloLine);
  const scopeMesh = new THREE.Mesh(geo(new THREE.SphereGeometry(0.085, 10, 10)), mat(new THREE.MeshBasicMaterial({ color: 0x22c55e })));
  l2.add(scopeMesh);

  // ============ 观测台本体（罩 + 镜筒刚性连接，整体绕 z 倾 β） ============
  const obs = new THREE.Group();
  obs.position.set(SHIELD_X, SHIELD_Y, 0);
  group.add(obs);

  // 五层菱形薄膜（局部水平面，自上而下 i=0…4）
  const GAP = 0.2;
  const shieldMats: import('three').MeshBasicMaterial[] = [];
  for (let i = 0; i < N_LAYER; i++) {
    const s = new THREE.Shape();
    const wx = ru(R_SHIELD) * (1 - i * 0.035), wz = ru(10.6) * (1 - i * 0.035);
    s.moveTo(0, wz); s.lineTo(wx, 0); s.lineTo(0, -wz); s.lineTo(-wx, 0); s.closePath();
    const m = mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    const layer = new THREE.Mesh(geo(new THREE.ShapeGeometry(s)), m);
    layer.rotation.x = -Math.PI / 2;
    layer.position.y = -0.12 - i * GAP;
    obs.add(layer);
    shieldMats.push(m);
  }
  // 支撑桁架
  {
    const trussMat = mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.4 }));
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TWO_PI + Math.PI / 4;
      const t = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.02, 0.02, 0.75, 6)), trussMat);
      t.position.set(Math.cos(a) * 0.35, -0.5, Math.sin(a) * 0.35);
      t.rotation.x = Math.PI / 2;
      t.rotation.y = -a;
      obs.add(t);
    }
  }

  // 镜筒（局部：主镜平面 y = h，光轴沿局部 +y）
  const tube = new THREE.Group();
  tube.position.y = ru(H_SEP);
  obs.add(tube);
  const HEX_R = 0.145;
  const hexGeo = geo(new THREE.CylinderGeometry(HEX_R, HEX_R, 0.035, 6));
  const hexMats: import('three').MeshStandardMaterial[] = [];
  for (let q = -2; q <= 2; q++) {
    for (let r = -2; r <= 2; r++) {
      const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
      if (ring !== 1 && ring !== 2) continue;
      const m = mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.2 }));
      const hex = new THREE.Mesh(hexGeo, m);
      hex.position.set(Math.sqrt(3) * HEX_R * (q + r / 2), 0, 1.5 * HEX_R * r);
      tube.add(hex);
      hexMats.push(m);
    }
  }
  const MIRROR_A_U = Math.sqrt(3) * HEX_R * 2 + HEX_R; // 主镜外缘（世界单位）
  const H_SEC_U = ru(4.3);
  const sec = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 12)), mat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.25 })));
  sec.position.y = H_SEC_U;
  tube.add(sec);
  const strutGeo = geo(new THREE.CylinderGeometry(0.014, 0.014, H_SEC_U, 5));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TWO_PI;
    const st = new THREE.Mesh(strutGeo, mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.35 })));
    st.position.set(Math.cos(a) * MIRROR_A_U * 0.62, H_SEC_U / 2, Math.sin(a) * MIRROR_A_U * 0.62);
    st.rotation.z = Math.cos(a) * 0.24;
    st.rotation.x = -Math.sin(a) * 0.24;
    tube.add(st);
  }
  const focalMat = mat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, metalness: 0.35, roughness: 0.5, emissive: 0x0b3f4a }));
  const focal = new THREE.Mesh(geo(new THREE.BoxGeometry(0.2, 0.16, 0.2)), focalMat);
  focal.position.y = -0.14;
  tube.add(focal);

  // 光路：平行星光（沿光轴）→ 主镜 → 副镜 → 焦面
  const RAY_N = 6;
  const rayGeo = geo(new THREE.BufferGeometry());
  rayGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAY_N * 3 * 2 * 3), 3));
  const rayMat = mat(new THREE.LineBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.65 }));
  tube.add(new THREE.LineSegments(rayGeo, rayMat));
  {
    const a = rayGeo.attributes['position'].array as Float32Array;
    const RIN = MIRROR_A_U * 0.72;
    let v = 0;
    const put = (x: number, y: number, z: number): void => { a[v * 3] = x; a[v * 3 + 1] = y; a[v * 3 + 2] = z; v++; };
    for (let k = 0; k < RAY_N; k++) {
      const ang = (k / RAY_N) * TWO_PI;
      const x = RIN * Math.cos(ang), z = RIN * Math.sin(ang);
      put(x, H_SEC_U + 1.35, z); put(x, 0.02, z);
      put(x, 0.02, z); put(0, H_SEC_U, 0);
      put(0, H_SEC_U, 0); put(0, -0.14, 0);
    }
  }

  // 主镜落在罩面上的阴影轮廓（局部 x = h·tanβ 偏移）
  const shadowGeo = geo(new THREE.BufferGeometry());
  const SH_N = 64;
  shadowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SH_N + 1) * 3), 3));
  const shadowMat = mat(new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85 }));
  const shadowLoop = new THREE.Line(shadowGeo, shadowMat);
  obs.add(shadowLoop);
  function updateShadow(): void {
    const a = shadowGeo.attributes['position'].array as Float32Array;
    const cx = ru(H_SEP) * Math.tan(beta);
    for (let i = 0; i <= SH_N; i++) {
      const ang = (i / SH_N) * TWO_PI;
      a[i * 3] = cx + MIRROR_A_U * Math.cos(ang);
      a[i * 3 + 1] = -0.105;
      a[i * 3 + 2] = MIRROR_A_U * Math.sin(ang);
    }
    shadowGeo.attributes['position'].needsUpdate = true;
    shadowMat.color.setHex(shadowOK ? 0x22d3ee : 0xef4444);
  }

  // 太阳光（世界系竖直向下，罩面倾 β ⇒ 入射角 = β）
  const SUN_N = 15;
  const sunGeo = geo(new THREE.BufferGeometry());
  const sunPos = new Float32Array(SUN_N * 2 * 3);
  sunGeo.setAttribute('position', new THREE.BufferAttribute(sunPos, 3));
  const sunMat = mat(new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.7 }));
  group.add(new THREE.LineSegments(sunGeo, sunMat));
  {
    // 箭杆 + 落地范围：从 y = SHIELD_Y+2.6 下到罩面上界
    const top = SHIELD_Y + 2.9;
    const bot = SHIELD_Y + 0.05;
    for (let k = 0; k < SUN_N; k++) {
      const x = SHIELD_X - 1.75 + (3.5 * k) / (SUN_N - 1);
      sunPos[k * 6] = x; sunPos[k * 6 + 1] = top; sunPos[k * 6 + 2] = 0.9 * Math.sin(k);
      sunPos[k * 6 + 3] = x; sunPos[k * 6 + 4] = bot; sunPos[k * 6 + 5] = 0.9 * Math.sin(k);
    }
    sunGeo.attributes['position'].needsUpdate = true;
  }

  // ============ 标签 ============
  function makeLabel(text: string, color: string, scale = 3.6): import('three').Sprite {
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
  const lblHalo = makeLabel('日-地 L2 晕轨道（周期 183 d）', '#94a3b8', 4.0);
  lblHalo.position.set(-3.2, 5.3, -1);
  group.add(lblHalo);
  const lblSunDir = makeLabel('太阳光（L2 处 1332 W/m²）', '#fbbf24', 3.6);
  lblSunDir.position.set(SHIELD_X - 2.3, SHIELD_Y + 3.3, 0);
  group.add(lblSunDir);
  const lblOptics = makeLabel('18 块六角主镜 → 副镜 → 冷焦面', '#22c55e', 3.8);
  lblOptics.position.set(SHIELD_X + 1.9, SHIELD_Y + 2.0, 0);
  group.add(lblOptics);
  const lblShield = makeLabel('五层屏蔽：热侧 386 K → 冷端 ~50 K', '#a855f7', 4.0);
  lblShield.position.set(SHIELD_X, SHIELD_Y - 1.6, 0);
  group.add(lblShield);

  // ============ 信息面板 ============
  const infoCv = document.createElement('canvas');
  infoCv.width = 880; infoCv.height = 300;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.4, 3.2)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 7.2, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  const ln = (y: number, color: string, text: string, bold = false, size = 27): void => {
    infoCtx.fillStyle = color;
    infoCtx.font = `${bold ? 'bold ' : ''}${size}px "PingFang SC", sans-serif`;
    infoCtx.fillText(text, 22, y);
  };
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 880, 300);
    infoCtx.fillStyle = 'rgba(7,11,20,0.86)';
    infoCtx.fillRect(4, 4, 872, 292);
    infoCtx.strokeStyle = '#334155';
    infoCtx.lineWidth = 3;
    infoCtx.strokeRect(4, 4, 872, 292);
    infoCtx.textAlign = 'left';

    ln(42, '#f8fafc', '空间望远镜 —— L2 晕轨道与多层遮阳罩热控', true);
    ln(80, '#22d3ee', `r_L2 = a(μ/3)^{1/3} = ${(R_L2_KM / 1e6).toFixed(2)}×10⁶ km = ${(R_L2_KM / 1.496e8).toFixed(4)} AU，T_halo = 2π/(1.996Ω) ≈ ${T_HALO_D.toFixed(0)} d`);
    ln(114, '#a855f7', `天球张角：θ☉ = asin(R☉/1.01AU) = ${TH_SUN.toFixed(3)}°，θ⊕ = asin(R⊕/r_L2) = ${TH_EARTH.toFixed(3)}° ⇒ 罩只需挡 0.53° 锥`);
    ln(148, '#22c55e', `层平衡 2u_i = u_{i−1}+u_{i+1}，u₀=q/(εσ)、u_{n+1}=0 ⇒ T_i⁴ = (q/εσ)(n+1−i)/(n+1)，q = (1−A)S·cosβ = ${((1 - ALBEDO) * S_L2 * Math.cos(beta)).toFixed(0)} W/m²`);
    ln(182, '#f472b6', `遮光判据 h·tanβ + a ≤ R_sh ⇒ β_crit = ${(BETA_CRIT * DEG).toFixed(1)}°；半影宽 h·tanθ☉ = ${(PENUMBRA * 1000).toFixed(1)} mm`);
    ln(216, '#94a3b8', `冷端 T_c = T_n(g/2)^{1/4}，g = ${VIEW_G.toExponential(1)}（视角因子稀释，非主动制冷）`, false, 24);

    infoCtx.fillStyle = shadowOK ? '#fbbf24' : '#ef4444';
    infoCtx.font = 'bold 27px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：β = ${(beta * DEG).toFixed(1)}°  T₁ = ${temps[0].toFixed(0)} K  T₅ = ${temps[4].toFixed(0)} K  焦面 = ${coldK().toFixed(1)} K  直照：${shadowOK ? '全遮' : '泄漏！'}`,
      22, 254,
    );
    infoCtx.fillStyle = '#64748b';
    infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText(`（晕轨道按 1 unit=5×10⁵ km 绘制，r_L2 由 ${(L2_TRUE_UNITS).toFixed(1)} unit 压缩为 ${L2_DRAW} unit；光机 1 unit=4.2 m；183 d 压缩为 12.8 s）`, 22, 284);
    infoTex.needsUpdate = true;
  }

  solveTemps();
  updateShadow();
  function paint(): void {
    for (let i = 0; i < N_LAYER; i++) shieldMats[i].color.copy(tempColor(temps[i]));
    const cc = tempColor(coldK()).clone();
    focalMat.color.copy(cc);
    focalMat.emissive.copy(cc).multiplyScalar(0.4);
    const leak = ru(H_SEP) * Math.tan(Math.abs(beta)) + MIRROR_A_U > ru(R_SHIELD);
    shadowOK = !leak;
    hexMats.forEach((m) => m.emissive.setHex(leak ? 0x7f1d1d : 0x000000));
    sunMat.color.setHex(leak ? 0xef4444 : 0xfbbf24);
    updateShadow();
  }
  paint();
  drawInfo();

  return {
    update(t, dt) {
      // 姿态偏角 β 扫描 ±46°（越过 β_crit=38.7° 演示直接日照泄漏）；周期 12.8 s
      const period = 12.8;
      beta = 0.803 * Math.sin((t % period) / period * TWO_PI);
      solveTemps();
      paint();

      obs.rotation.z = -beta;                 // 整台望远镜相对固定日光转向 ⇒ 入射角 = β

      // 晕轨道动画：183 d 压缩为 12.8 s（14.3 d/s）
      const ha = (t / period) * TWO_PI;
      scopeMesh.position.set(L2_DRAW + HALO_IN * Math.cos(ha), HALO_OUT * Math.sin(ha), HALO_Y * Math.cos(ha));
      l2Mark.scale.setScalar(1 + 0.3 * Math.sin(t * 3));
      rayMat.opacity = 0.45 + 0.25 * (0.5 + 0.5 * Math.sin(t * 1.3));

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
