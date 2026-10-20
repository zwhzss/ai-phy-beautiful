import type { SceneContext, SceneInstance } from '../types';
/**
 * 视向速度法搜寻系外行星（P282）：恒星-行星绕质心的三维轨道 + 视线投影出 RV 曲线。
 * 主控方程：
 *   ① 开普勒第三定律 P² = 4π²a³/(G(M★+m_p))；质心条件 a★ = a·m_p/(M★+m_p)
 *   ② 速度半幅 K = (2πG/P)^{1/3}·(m_p sin i)/(M★+m_p)^{2/3}/√(1−e²)
 *   ③ RV 方程 v_r(t) = K[cos(ν+ω) + e cos ω]，取 ω=0 ⇒ v_r = −K(cos ν + e)（+为退行）
 *   ④ 轨道解：M = E − e sin E（牛顿迭代），r cos ν = a(cos E − e)，r sin ν = a√(1−e²) sin E
 *      视线坐标 x = a★√(1−e²) sin E·sin i ⇒ 只测到 m_p·sin i（质量下限）
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

  const starField = geo(new THREE.BufferGeometry());
  {
    const p = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      p[i * 3] = (Math.random() - 0.5) * 200;
      p[i * 3 + 1] = (Math.random() - 0.5) * 200;
      p[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    starField.setAttribute('position', new THREE.BufferAttribute(p, 3));
  }
  group.add(new THREE.Points(starField, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));

  // ============ 真实系统参数（SI） ============
  const G = 6.6743e-11, M_SUN = 1.98892e30, M_JUP = 1.89813e27, AU = 1.495978707e11, R_SUN = 6.957e8;
  const MSTAR = 1.0 * M_SUN;
  const MPLANET = 2.0 * M_JUP;
  const SMA = 0.05 * AU;            // 半长轴
  const ECC = 0.4;
  const MTOT = MSTAR + MPLANET;
  const P_SEC = TWO_PI * Math.sqrt(SMA ** 3 / (G * MTOT));
  const P_DAY = P_SEC / 86400;
  const A_STAR_M = SMA * MPLANET / MTOT;              // 恒星轨道半径（m）
  const A_STAR_R = A_STAR_M / R_SUN;                   // 以太阳半径为单位
  const K_MS = ((2 * Math.PI * G / P_SEC) ** (1 / 3)) * (MPLANET / MTOT ** (2 / 3)) / Math.sqrt(1 - ECC * ECC); // m/s（i=90°）
  const M_RATIO = MPLANET / MSTAR;                    // 真实 a★/a_p

  // ============ 绘制尺度 ============
  const CX = -0.5, CY = 1.0;                          // 质心位置
  const A_STAR_U = 0.72;                              // 恒星轨道绘制半长轴
  const A_PL_U = 2.3;                                 // 行星轨道绘制半径
  const EXAG = (A_STAR_U / A_PL_U) / M_RATIO;         // 放大倍数（面板注明）
  const ORB_T = 12;                                   // 一个轨道周期 = 12 s

  let incl = 88, E = 0, nu = 0, vr = 0, Kobs = 0, msini = 0;

  // 开普勒方程 M = E − e sin E
  function solveE(M: number): number {
    let x = M + ECC * Math.sin(M);
    for (let k = 0; k < 8; k++) {
      const f = x - ECC * Math.sin(x) - M;
      x -= f / (1 - ECC * Math.cos(x));
    }
    return x;
  }

  // ============ 天体 ============
  const glowCv = document.createElement('canvas');
  glowCv.width = 128; glowCv.height = 128;
  {
    const c = glowCv.getContext('2d')!;
    const g = c.createRadialGradient(64, 64, 2, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,246,214,0.95)');
    g.addColorStop(0.4, 'rgba(251,191,36,0.4)');
    g.addColorStop(1, 'rgba(251,140,40,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  }
  const glowTex = tex(new THREE.CanvasTexture(glowCv));
  const sunSprite = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.95 })));
  sunSprite.scale.setScalar(1.25);
  group.add(sunSprite);
  const starMesh = new THREE.Mesh(geo(new THREE.SphereGeometry(0.2, 20, 16)), mat(new THREE.MeshBasicMaterial({ color: 0xfef3c7 })));
  group.add(starMesh);
  // 隐形行星：暗盘 + 描边（我们看不见它，只看见恒星的摆动）
  const planet = new THREE.Mesh(geo(new THREE.SphereGeometry(0.15, 18, 14)), mat(new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.3, roughness: 0.8 })));
  group.add(planet);
  const planetRim = new THREE.Mesh(geo(new THREE.RingGeometry(0.15, 0.19, 22)), mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.5, side: THREE.DoubleSide })));
  group.add(planetRim);
  // 质心标记
  const baryMat = mat(new THREE.LineBasicMaterial({ color: 0xf472b6 }));
  {
    const g = geo(new THREE.BufferGeometry());
    const s = 0.16;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([CX - s, CY, 0, CX + s, CY, 0, CX, CY - s, 0, CX, CY + s, 0, CX, CY, -s, CX, CY, s]), 3));
    group.add(new THREE.LineSegments(g, baryMat));
  }

  // 轨道线（恒星椭圆 + 行星椭圆），随倾角重新生成
  const TRK_N = 150;
  const trkStarGeo = geo(new THREE.BufferGeometry());
  trkStarGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((TRK_N + 1) * 3), 3));
  const trkPlanGeo = geo(new THREE.BufferGeometry());
  trkPlanGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((TRK_N + 1) * 3), 3));
  group.add(new THREE.Line(trkStarGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.85 }))));
  group.add(new THREE.Line(trkPlanGeo, mat(new THREE.LineDashedMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.55 }))));
  const planLine = group.children[group.children.length - 1] as import('three').Line;

  function orbitPoint(A: number, sign: number, ecc: number, Eang: number, si: number, ci: number, out: import('three').Vector3): import('three').Vector3 {
    const Xu = A * (Math.cos(Eang) - ecc) * sign;
    const Yu = A * Math.sqrt(1 - ecc * ecc) * Math.sin(Eang) * sign;
    return out.set(CX + Yu * si, CY + Xu, Yu * ci);
  }
  function updateOrbits(si: number, ci: number): void {
    const sp = trkStarGeo.attributes['position'].array as Float32Array;
    const pp = trkPlanGeo.attributes['position'].array as Float32Array;
    const v = new THREE.Vector3();
    for (let i = 0; i <= TRK_N; i++) {
      const Eang = (i / TRK_N) * TWO_PI;
      orbitPoint(A_STAR_U, 1, ECC, Eang, si, ci, v);
      sp[i * 3] = v.x; sp[i * 3 + 1] = v.y; sp[i * 3 + 2] = v.z;
      orbitPoint(A_PL_U, -1, ECC, Eang, si, ci, v);
      pp[i * 3] = v.x; pp[i * 3 + 1] = v.y; pp[i * 3 + 2] = v.z;
    }
    trkStarGeo.attributes['position'].needsUpdate = true;
    trkPlanGeo.attributes['position'].needsUpdate = true;
    planLine.computeLineDistances();
  }

  // ============ 观测者（沿 +x 的视线） ============
  const OBS_X = 4.5;
  const scopeBody = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.16, 0.22, 0.7, 14)), mat(new THREE.MeshStandardMaterial({ color: 0xa855f7, metalness: 0.5, roughness: 0.4 })));
  scopeBody.rotation.z = Math.PI / 2;
  scopeBody.position.set(OBS_X, CY, 0);
  group.add(scopeBody);
  const losGeo = geo(new THREE.BufferGeometry());
  {
    const pts: number[] = [];
    for (let i = 0; i < 16; i++) {
      const x0 = CX + 0.6 + (OBS_X - CX - 0.9) * (i / 16);
      pts.push(x0, CY, 0, x0 + (OBS_X - CX - 0.9) / 32, CY, 0);
    }
    losGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  }
  group.add(new THREE.LineSegments(losGeo, mat(new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.7 }))));

  // 恒星速度矢量（切向）与视线分量（彩色：红=退行、蓝=趋近）
  const velGeo = geo(new THREE.BufferGeometry());
  velGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const velMat = mat(new THREE.LineBasicMaterial({ color: 0x22d3ee }));
  group.add(new THREE.Line(velGeo, velMat));
  const losVecGeo = geo(new THREE.BufferGeometry());
  losVecGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const losVecMat = mat(new THREE.LineBasicMaterial({ color: 0xef4444 }));
  group.add(new THREE.Line(losVecGeo, losVecMat));
  const coneGeo = geo(new THREE.ConeGeometry(0.08, 0.24, 10));
  const losTip = new THREE.Mesh(coneGeo, mat(new THREE.MeshBasicMaterial({ color: 0xef4444 })));
  group.add(losTip);
  const UPV = new THREE.Vector3(0, 1, 0);

  // ============ RV 曲线（画在轨道后方的屏幕上） ============
  const SC_Z = -2.9, SC_X0 = -3.3, SC_X1 = 2.4, SC_Y = -1.35, RV_H = 1.0;
  const rvGeo = geo(new THREE.BufferGeometry());
  const RV_N = 240;
  rvGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((RV_N + 1) * 3), 3));
  group.add(new THREE.Line(rvGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e }))));
  const rvDot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.075, 12, 12)), mat(new THREE.MeshBasicMaterial({ color: 0x22c55e })));
  group.add(rvDot);
  const linkGeo = geo(new THREE.BufferGeometry());
  linkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  group.add(new THREE.Line(linkGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.45 }))));
  {
    const g = geo(new THREE.BufferGeometry());
    const pts: number[] = [SC_X0, SC_Y, SC_Z, SC_X1, SC_Y, SC_Z, SC_X0, SC_Y, SC_Z, SC_X0, SC_Y + RV_H * 1.35, SC_Z];
    for (let i = 0; i <= 4; i++) {
      const x = SC_X0 + (SC_X1 - SC_X0) * (i / 4);
      pts.push(x, SC_Y - 0.09, SC_Z, x, SC_Y, SC_Z);
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    group.add(new THREE.LineSegments(g, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));
  }

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
  const lblBary = makeLabel('质心：恒星与隐形行星反相绕转', '#f472b6', 3.9);
  lblBary.position.set(CX - 0.2, CY + 1.55, 0);
  group.add(lblBary);
  const lblObs = makeLabel('视线方向（观测者）', '#a855f7', 3.0);
  lblObs.position.set(OBS_X - 0.2, CY + 0.62, 0);
  group.add(lblObs);
  const lblRv = makeLabel('视向速度曲线 v_r(t) = K[cos ν + e]', '#22c55e', 3.9);
  lblRv.position.set((SC_X0 + SC_X1) / 2, SC_Y + RV_H * 1.75, SC_Z);
  group.add(lblRv);
  const lblI = makeLabel('倾角 i ⇒ 只能测 m_p·sin i', '#22d3ee', 3.4);
  lblI.position.set(CX + 0.3, CY - 1.75, 0);
  group.add(lblI);

  // ============ 面板 ============
  const infoCv = document.createElement('canvas');
  infoCv.width = 900; infoCv.height = 300;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.4, 3.13)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 5.35, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  const ln = (y: number, color: string, text: string, bold = false, size = 26): void => {
    infoCtx.fillStyle = color;
    infoCtx.font = `${bold ? 'bold ' : ''}${size}px "PingFang SC", sans-serif`;
    infoCtx.fillText(text, 22, y);
  };
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 900, 300);
    infoCtx.fillStyle = 'rgba(7,11,20,0.86)';
    infoCtx.fillRect(4, 4, 892, 292);
    infoCtx.strokeStyle = '#334155';
    infoCtx.lineWidth = 3;
    infoCtx.strokeRect(4, 4, 892, 292);
    infoCtx.textAlign = 'left';

    ln(40, '#f8fafc', '视向速度法 —— 恒星被看不见的质量拽着摆', true);
    ln(78, '#22d3ee', `P = 2π√(a³/GM) = ${P_DAY.toFixed(2)} d，a★ = a·m_p/M = ${(A_STAR_M / 1e6).toFixed(0)}×10³ km = ${A_STAR_R.toFixed(2)} R★`);
    ln(112, '#fbbf24', `K = (2πG/P)^{1/3}(m_p sin i)/M^{2/3}/√(1−e²) = ${Kobs.toFixed(1)} m/s（e=${ECC}，m_p=${(MPLANET / M_JUP).toFixed(1)} M_jup）`);
    ln(146, '#22c55e', `v_r = K[cos(ν+ω)+e cos ω] ⇒ 曲线偏离正弦的量 = e·K = ${(Kobs * ECC).toFixed(1)} m/s，用来定 e 与 ω`);
    ln(180, '#f472b6', `质量函数 f = K³P(1−e²)^{3/2}/(2πG) = ${(Math.pow(Kobs, 3) * P_SEC * Math.pow(1 - ECC * ECC, 1.5) / (TWO_PI * G) / (M_JUP ** 3 / M_SUN ** 2)).toFixed(2)} M_jup³/M★²（= (m_p sin i)³/M★²）⇒ 只给 m_p sin i 下限`);

    infoCtx.fillStyle = incl > 45 ? '#fbbf24' : '#ef4444';
    infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：i = ${incl.toFixed(0)}°  v_r = ${vr >= 0 ? '+' : ''}${vr.toFixed(1)} m/s  m_p sin i = ${msini.toFixed(3)} M_jup${incl < 20 ? '（低估！真实值 ' + (MPLANET / M_JUP).toFixed(1) + '）' : ''}`,
      22, 222,
    );
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText(`恒星轨道半径按 ×${EXAG.toFixed(0)} 放大绘制；地球测得的 1 m/s 级信号要求光谱仪在数年内稳定到一杯水速度的千分之一`, 22, 264);
    infoTex.needsUpdate = true;
  }

  function computeState(t: number): void {
    const M = ((t % ORB_T) / ORB_T) * TWO_PI;
    E = solveE(M);
    const si = Math.sin(incl / DEG), ci = Math.cos(incl / DEG);
    const cosNu = (Math.cos(E) - ECC) / (1 - ECC * Math.cos(E));
    nu = Math.acos(Math.max(-1, Math.min(1, cosNu)));
    if (Math.sin(E) < 0) nu = TWO_PI - nu;
    Kobs = K_MS * si;                        // m/s
    vr = -Kobs * (cosNu + ECC);                 // m/s（+ = 退行）
    msini = (MPLANET / M_JUP) * si;
    // 位置（世界坐标）
    const starPos = orbitPoint(A_STAR_U, 1, ECC, E, si, ci, new THREE.Vector3());
    starMesh.position.copy(starPos);
    sunSprite.position.copy(starPos);
    const plPos = orbitPoint(A_PL_U, -1, ECC, E, si, ci, new THREE.Vector3());
    planet.position.copy(plPos);
    planetRim.position.copy(plPos);
    planetRim.quaternion.copy(ctx.camera.quaternion);
    // 速度（世界坐标）：dx/dt ∝ d(Y)/dt，dy/dt ∝ d(X)/dt
    const dXe = -Math.sin(E), dYe = Math.sqrt(1 - ECC * ECC) * Math.cos(E);
    const vel = new THREE.Vector3(dYe * si, dXe, dYe * ci).multiplyScalar(1.15);
    const vp = velGeo.attributes['position'].array as Float32Array;
    vp[0] = starPos.x; vp[1] = starPos.y; vp[2] = starPos.z;
    vp[3] = starPos.x + vel.x; vp[4] = starPos.y + vel.y; vp[5] = starPos.z + vel.z;
    velGeo.attributes['position'].needsUpdate = true;
    // 视线分量（沿 x）
    const lp = losVecGeo.attributes['position'].array as Float32Array;
    const lv = new THREE.Vector3(vel.x, 0, 0);
    lp[0] = starPos.x; lp[1] = starPos.y - 0.34; lp[2] = starPos.z;
    lp[3] = starPos.x + lv.x; lp[4] = starPos.y - 0.34; lp[5] = starPos.z;
    losVecGeo.attributes['position'].needsUpdate = true;
    losTip.position.set(starPos.x + lv.x, starPos.y - 0.34, starPos.z);
    losTip.quaternion.setFromUnitVectors(UPV, lv.x >= 0 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(-1, 0, 0));
    losTip.visible = Math.abs(lv.x) > 0.05;
    losVecMat.color.setHex(vr > 0 ? 0xef4444 : 0x60a5fa);
    (losTip.material as import('three').MeshBasicMaterial).color.setHex(vr > 0 ? 0xef4444 : 0x60a5fa);

    // RV 曲线：整个周期解析重绘（随 i 变形）
    const rp = rvGeo.attributes['position'].array as Float32Array;
    const Kmax = K_MS;
    for (let i = 0; i <= RV_N; i++) {
      const Mi = (i / RV_N) * TWO_PI;
      const Ei = solveE(Mi);
      const cn = (Math.cos(Ei) - ECC) / (1 - ECC * Math.cos(Ei));
      const vv = -Kmax * si * (cn + ECC);
      rp[i * 3] = SC_X0 + (SC_X1 - SC_X0) * (i / RV_N);
      rp[i * 3 + 1] = SC_Y + (vv / (Kmax * 1.6 + 1e-6)) * RV_H * 2;
      rp[i * 3 + 2] = SC_Z;
    }
    rvGeo.attributes['position'].needsUpdate = true;
    const ph = (t % ORB_T) / ORB_T;
    const dotY = SC_Y + (vr / (Kmax * 1.6 + 1e-6)) * RV_H * 2;
    rvDot.position.set(SC_X0 + (SC_X1 - SC_X0) * ph, dotY, SC_Z);
    const lk = linkGeo.attributes['position'].array as Float32Array;
    lk[0] = starPos.x; lk[1] = starPos.y; lk[2] = starPos.z;
    lk[3] = rvDot.position.x; lk[4] = rvDot.position.y; lk[5] = rvDot.position.z;
    linkGeo.attributes['position'].needsUpdate = true;
  }

  updateOrbits(Math.sin(88 / DEG), Math.cos(88 / DEG));
  computeState(0);
  drawInfo();

  return {
    update(t, dt) {
      // 轨道周期 12 s（真实 P = 4.07 d 压缩）；倾角 16 s 往复 90°→4°
      incl = 47 + 43 * Math.cos(((t % 16) / 16) * TWO_PI);
      const si = Math.sin(incl / DEG), ci = Math.cos(incl / DEG);
      updateOrbits(si, ci);
      computeState(t);

      const pulse = 1 + 0.04 * Math.sin(t * 3.1);
      sunSprite.scale.setScalar(1.25 * pulse);
      const bright = 0.4 + 0.6 * Math.abs(Math.sin((t % ORB_T) / ORB_T * TWO_PI));
      (planetRim.material as import('three').MeshBasicMaterial).opacity = 0.25 + 0.35 * bright;

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
