import type { SceneContext, SceneInstance } from '../types';
/**
 * 引力波四极公式（P233）—— 主控方程（SI 常数直算，画面尺度已注明）：
 *   四极公式   h_ij^TT = (2G / c⁴R)·d²Q_ij/dt²      （无单极、无偶极 → 频率 = 2×轨道频率）
 *   圆双星     ω_o=√(GM/r³)，f_GW=ω_o/π，λ_GW=c/f_GW
 *   振幅       h₀=(4/R)(GM_c/c²)^{5/3}(πf/c)^{2/3}，M_c=(m1m2)^{3/5}/M^{1/5}
 *              h_+=h₀(1+cos²ι)/2·cosΦ，h_×=h₀·cosι·sinΦ      （ι=视倾角）
 *   辐射       P=(32/5)(G⁴/c⁵)μ²M³/r⁵，dr/dt=−(64/5)G³μM²/(c⁵r³)，t_ins=5c⁵r⁴/(256G³μM²)
 *   角分布     dE/dΩ ∝ (1+6cos²ι+cos⁴ι)/8（赤道最强，轴向 1/8，但从不为零）
 *   测地偏离   自由质点环沿 ψ 方向的相对伸缩 δL/L=(1/2)(h_+cos2ψ − h_×sin2ψ)
 * 画面：倾斜旋转的双星源 + 四极花瓣 + 沿视线飞行的 h(u) 波形 + 一环自由落体测试质点被
 * 交替拉压成椭圆。扫描自变量：① 轨道间距 r 从 60GM/c² 单调旋近到 12GM/c²（周期 18 s，
 * 到尾重置）；② 视倾角 ι 在 0°↔90° 之间缓变（周期 36 s，圆偏振↔线偏振切换可见）。
 * 真实 h~1e-22 看不见：环形变放大 2.6×10²⁰ 倍、波形纵向 0.16 world/(1e-22)，
 * 画面 GW 频率固定 1.05 周期/s（时间压缩系数在面板读出）；h₀/f/P/λ/t_ins 全为真实值，
 * 与几何同源。
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

  const PI = Math.PI, TWO_PI = PI * 2;
  // —— 真实物理常量与源参数（GW170817 型双中子星，40 Mpc）——
  const GC = 6.6743e-11, C0 = 2.99792458e8, MS = 1.98892e30, MPC = 3.0857e22;
  const M1 = 1.4 * MS, M2 = 1.4 * MS;
  const MTT = M1 + M2, MU = (M1 * M2) / MTT;
  const MCH = Math.pow(M1 * M2, 0.6) / Math.pow(MTT, 0.2);
  const DIST = 40 * MPC;
  const RG = GC * MTT / (C0 * C0);              // GM/c² = 4.13 km
  const RMAX_M = 60, RMIN_M = 12;               // r 以 GM/c² 计
  const CYCLE = 18, TILT_C = 36;
  const KM_W = 0.00695;                          // world / km（轨道尺度，真比例）
  const MAG_H = 2.6e20;                          // 环形变放大（真实 h~1e-22 看不见）
  const H_W = 0.16;                              // world / (h/1e-22)（波形纵向）
  const NU_VIS = 1.05;                           // 画面 GW 频率 cycle/s
  const L_P = Math.pow(C0, 5) / GC;              // 普朗克光度 c⁵/G = 3.63e52 W
  const F_ISCO = Math.pow(C0, 3) / (Math.pow(6, 1.5) * PI * GC * MTT);

  // 星野 + 地面
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

  // —— 源：随倾角倾斜的组（轨道面 = 局部 x–z，角动量 L = 局部 +y）——
  const src = new THREE.Group();
  group.add(src);

  const nsGeo = geo(new THREE.SphereGeometry(0.17, 20, 14));
  const nsMatA = mat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0e7490, emissiveIntensity: 0.7, roughness: 0.35 }));
  const nsMatB = mat(new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x6b21a8, emissiveIntensity: 0.7, roughness: 0.35 }));
  const nsA = new THREE.Mesh(nsGeo, nsMatA);
  const nsB = new THREE.Mesh(nsGeo, nsMatB);
  src.add(nsA, nsB);

  // 轨道圆（共享单位圆，按 r1/r2 缩放）
  const circGeo = geo(new THREE.BufferGeometry());
  {
    const n = 65, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = TWO_PI * (i / (n - 1));
      p[i * 3] = Math.cos(a); p[i * 3 + 1] = 0; p[i * 3 + 2] = Math.sin(a);
    }
    circGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  }
  const orbMat = mat(new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.8 }));
  const orbA = new THREE.Line(circGeo, orbMat);
  const orbB = new THREE.Line(circGeo, orbMat);
  src.add(orbA, orbB);

  // 四极矩花瓣（|cos2(ψ−ϑ)| 四瓣，尺寸 ∝ Q̈∝1/r）
  const QP = 181;
  const quadGeo = geo(new THREE.BufferGeometry());
  const quadPos = new Float32Array(QP * 3);
  quadGeo.setAttribute('position', new THREE.BufferAttribute(quadPos, 3));
  src.add(new THREE.Line(quadGeo, mat(new THREE.LineBasicMaterial({ color: 0xf472b6 }))));

  // 角动量箭头（局部 +y）
  const jGeo = geo(new THREE.BufferGeometry());
  jGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, 1.75, 0]), 3));
  src.add(new THREE.Line(jGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 }))));
  const coneGeo = geo(new THREE.ConeGeometry(0.075, 0.24, 12));
  const jCone = new THREE.Mesh(coneGeo, mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  jCone.position.set(0, 1.87, 0);
  src.add(jCone);

  // 辐射角分布面 dE/dΩ ∝ (1+6cos²ι+cos⁴ι)/8（绕 L 旋转，静态真式网格）
  const TH = 37, PH = 41;
  const ffGeo = geo(new THREE.BufferGeometry());
  const ffPos = new Float32Array(TH * (PH + 1) * 3);
  const ffIdx: number[] = [];
  for (let i = 0; i < TH - 1; i++) {
    for (let j = 0; j < PH; j++) {
      const a = i * (PH + 1) + j, b = a + 1, c = a + PH + 1, d = c + 1;
      ffIdx.push(a, c, b, b, c, d);
    }
  }
  {
    let v = 0;
    for (let i = 0; i < TH; i++) {
      const th = PI * i / (TH - 1), c = Math.cos(th), s = Math.sin(th);
      const F = (1 + 6 * c * c + Math.pow(c, 4)) / 8;      // 归一：F(0)=1, F(π/2)=1/8
      const rr = 0.5 + 1.05 * F;
      for (let j = 0; j <= PH; j++) {
        const a = TWO_PI * (j / PH);
        ffPos[v] = rr * s * Math.cos(a); ffPos[v + 1] = rr * c; ffPos[v + 2] = rr * s * Math.sin(a);
        v += 3;
      }
    }
  }
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  ffGeo.setIndex(ffIdx);
  ffGeo.computeVertexNormals();
  src.add(new THREE.Mesh(ffGeo, mat(new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x14532d, emissiveIntensity: 0.3, transparent: true, opacity: 0.17, side: THREE.DoubleSide, roughness: 0.6, depthWrite: false }))));

  // 视线（探测器方向 = 全局 +x）
  {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 4.15, 0, 0]), 3));
    group.add(new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.9 }))));
  }

  // —— h(u) 波形：沿视线展开的推迟时间轴，+ 与 × 两条 ——
  const WT = 151, WX0 = 0.55, WX1 = 2.95, LAMD = 0.82;
  const wPlusGeo = geo(new THREE.BufferGeometry());
  const wPlusPos = new Float32Array(WT * 3);
  wPlusGeo.setAttribute('position', new THREE.BufferAttribute(wPlusPos, 3));
  group.add(new THREE.Line(wPlusGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee }))));
  const wCrsGeo = geo(new THREE.BufferGeometry());
  const wCrsPos = new Float32Array(WT * 3);
  wCrsGeo.setAttribute('position', new THREE.BufferAttribute(wCrsPos, 3));
  group.add(new THREE.Line(wCrsGeo, mat(new THREE.LineBasicMaterial({ color: 0xf472b6 }))));

  // —— 探测器：一环自由落体测试质点（平面 ⊥ 视线）——
  const RX = 3.35, RRING = 1.15, NR = 48;
  const rgGeo = geo(new THREE.BufferGeometry());
  const rgPos = new Float32Array(NR * 3);
  rgGeo.setAttribute('position', new THREE.BufferAttribute(rgPos, 3));
  group.add(new THREE.Points(rgGeo, mat(new THREE.PointsMaterial({ color: 0xfbbf24, size: 0.13, sizeAttenuation: true }))));
  const reGeo = geo(new THREE.BufferGeometry());
  const rePos = new Float32Array((NR + 1) * 3);
  reGeo.setAttribute('position', new THREE.BufferAttribute(rePos, 3));
  group.add(new THREE.Line(reGeo, mat(new THREE.LineBasicMaterial({ color: 0xffddd1, transparent: true, opacity: 0.9 }))));
  const re0Geo = geo(new THREE.BufferGeometry());
  {
    const p = new Float32Array((NR + 1) * 3);
    for (let i = 0; i <= NR; i++) {
      const a = TWO_PI * (i / NR);
      p[i * 3] = RX; p[i * 3 + 1] = RRING * Math.cos(a); p[i * 3 + 2] = RRING * Math.sin(a);
    }
    re0Geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  }
  group.add(new THREE.Line(re0Geo, mat(new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.6 }))));

  // —— 地面 chirp 图：log h₀ vs log f_GW ——
  const CX0 = -4.35, CX1 = -2.35, CZ0 = 1.05, CZ1 = 2.65;
  const LF_MIN = Math.log10(40), LF_SPAN = Math.log10(3200) - LF_MIN;
  const LH_MIN = -1.35, LH_SPAN = 1.0;                     // log10(h₀/1e-21)：本例 −1.25…−0.55
  const NPTS = 220;
  const trGeo = geo(new THREE.BufferGeometry());
  const trPos = new Float32Array(NPTS * 3);
  trGeo.setAttribute('position', new THREE.BufferAttribute(trPos, 3));
  trGeo.setDrawRange(0, 0);
  group.add(new THREE.Line(trGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 }))));
  const dotTr = new THREE.Mesh(geo(new THREE.SphereGeometry(0.055, 10, 8)), mat(new THREE.MeshBasicMaterial({ color: 0xffffff })));
  group.add(dotTr);
  {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      CX0, 0.02, CZ0, CX1, 0.02, CZ0,
      CX1, 0.02, CZ0, CX1, 0.02, CZ1,
      CX0, 0.02, CZ0, CX0, 0.02, CZ1,
      CX0, 0.02, CZ1, CX1, 0.02, CZ1,
    ]), 3));
    group.add(new THREE.LineSegments(g, mat(new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.8 }))));
    // 真式斜率参考线：h₀ ∝ f^{2/3}；竖线：f_ISCO=c³/(6^{3/2}πGM)
    const x2 = CX0 + (1.0 / LF_SPAN) * (CX1 - CX0);
    const h2 = LH_MIN + 2 / 3;
    const z2 = CZ0 + ((h2 - LH_MIN) / LH_SPAN) * (CZ1 - CZ0);
    const xI = CX0 + ((Math.log10(F_ISCO) - LF_MIN) / LF_SPAN) * (CX1 - CX0);
    const g2 = geo(new THREE.BufferGeometry());
    g2.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      CX0, 0.03, CZ0, x2, 0.03, z2,
      xI, 0.03, CZ0, xI, 0.03, CZ1,
    ]), 3));
    group.add(new THREE.LineSegments(g2, mat(new THREE.LineBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.55 }))));
  }

  // —— 标签 ——
  function makeLabel(text: string, color: string, scale = 3.0): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  const lbSrc = makeLabel('双中子星源 1.4+1.4 M☉，R=40 Mpc', '#67e8f9', 4.0); lbSrc.position.set(-0.2, 2.05, -0.6);
  const lbQuad = makeLabel('四极花瓣 ∝|Q̈|·|cos2(ψ−ϑ)|：转一圈出两个波', '#f472b6', 4.4); lbQuad.position.set(-1.5, -0.75, 1.1);
  const lbFF = makeLabel('dE/dΩ ∝ (1+6cos²ι+cos⁴ι)/8', '#4ade80', 3.6); lbFF.position.set(-1.9, 1.3, -1.5);
  const lbWave = makeLabel('沿视线：上 h_+，下 h_×（横轴=推迟时间）', '#a855f7', 4.4); lbWave.position.set(1.75, 1.55, 0);
  const lbRing = makeLabel('自由质点环：δL/L=(h_+cos2ψ−h_×sin2ψ)/2', '#fbbf24', 4.6); lbRing.position.set(RX, -1.6, 0);
  const lbChart = makeLabel('log h₀ – log f：斜率 2/3 ⇒ 直接量出 chirp 质量', '#fbbf24', 4.2); lbChart.position.set((CX0 + CX1) / 2, 0.62, (CZ0 + CZ1) / 2);
  const lbJ = makeLabel('L（角动量）', '#fcd34d', 2.2); lbJ.position.set(0, 2.3, 0); src.add(lbJ);
  group.add(lbSrc, lbQuad, lbFF, lbWave, lbRing, lbChart);

  // —— 信息面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 800; infoCv.height = 264;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(7.4, 2.44)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 3.42, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  const rd = { rk: 248, rm: 60, f: 50, h0: 2.6e-21, ap: 2.6e-21, ac: 0, P: 0, dr: 0, tin: 0, lam: 6000, inc: 0, comp: 1, dh: 0 };
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 800, 264);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 792, 256);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3;
    infoCtx.strokeRect(4, 4, 792, 256);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 25px "PingFang SC", sans-serif';
    infoCtx.fillText('四极公式：引力没有偶极辐射，h 由 Q̈ 与 c⁴ 决定', 20, 32);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('h_ij=(2G/c⁴R)·d²Q_ij/dt²，f_GW=2f_orb=√(GM/r³)/π', 20, 60);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('h₀=(4/R)(GM_c/c²)^{5/3}(πf/c)^{2/3}，h₊=h₀(1+cos²ι)/2，h×=h₀cosι', 20, 86);
    infoCtx.fillStyle = '#34d399';
    infoCtx.fillText(`P=(32/5)(G⁴/c⁵)μ²M³/r⁵ = ${fmtE(rd.P, 1)} W = ${fmtE(rd.P / L_P, 2)}·(c⁵/G)  ← c⁵ 在分母＝难探测的根源`, 20, 112);
    infoCtx.fillStyle = '#f472b6';
    infoCtx.fillText(`λ_GW=c/f=${rd.lam.toFixed(0)} km（轨道间距 ${rd.rk.toFixed(0)} km 的 ${(rd.lam / rd.rk).toFixed(1)} 倍），f_ISCO=${F_ISCO.toFixed(0)} Hz`, 20, 138);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 21px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：r=${rd.rk.toFixed(0)} km=${rd.rm.toFixed(1)} GM/c²  f_GW=${rd.f.toFixed(0)} Hz  h₀=${fmtE(rd.h0, 2)}  ι=${(rd.inc * 180 / PI).toFixed(0)}°`, 20, 166,
    );
    infoCtx.fillText(
      `h₊=${fmtE(rd.ap, 2)}  h×=${fmtE(rd.ac, 2)}  M_c=${MCH.toFixed(3)} M☉  dr/dt=${fmtE(rd.dr, 2)} m/s`, 20, 192,
    );
    infoCtx.fillText(
      `并合前剩余时间 ${fmtT(rd.tin)}（画面 18 s 走完，时间压缩 ×${rd.comp.toFixed(0)}）  环放大 ${MAG_H.toExponential(0)} 倍：真实 1000 km 臂长只变 ${fmtE(rd.dh, 2)} m`, 20, 218,
    );
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '20px "PingFang SC", sans-serif';
    infoCtx.fillText('面内：ι=0 圆偏振（椭圆持续旋转）→ ι=90° 线偏振（轴向压缩），h_× 随 cosι 消失', 20, 246);
    infoTex.needsUpdate = true;
  }
  function fmtE(v: number, d: number): string {
    if (!isFinite(v) || v === 0) return '0';
    const e = Math.floor(Math.log10(Math.abs(v)));
    if (e >= -2 && e <= 3) return v.toFixed(d);
    return (v / Math.pow(10, e)).toFixed(d) + 'e' + e;
  }
  function fmtT(v: number): string {
    if (v > 31536000) return (v / 31536000).toFixed(2) + ' 年';
    if (v > 3600) return (v / 3600).toFixed(2) + ' 小时';
    if (v > 60) return (v / 60).toFixed(1) + ' 分';
    return v.toFixed(2) + ' 秒';
  }
  drawInfo();

  let phase = 0;
  let cycSeen = -1;
  let trCount = 0;

  return {
    update(t, dt) {
      const ph = (t % CYCLE) / CYCLE;
      const rm = RMAX_M + (RMIN_M - RMAX_M) * ph;         // r = 60 → 12 GM/c²（单调旋近）
      const r = rm * RG;                                   // m
      const ci = Math.cos((PI / 2) * (0.5 - 0.5 * Math.cos(TWO_PI * t / TILT_C)));
      const inc = Math.acos(ci);
      const rk = r / 1000;

      // 真实量（全部由上式算出）
      const wO = Math.sqrt(GC * MTT / (r * r * r));
      const fGW = wO / PI;
      const h0 = (4 / DIST) * Math.pow(GC * MCH / (C0 * C0), 5 / 3) * Math.pow(PI * fGW / C0, 2 / 3);
      const ap = h0 * (1 + ci * ci) / 2, ac = h0 * ci;
      const P = (32 / 5) * Math.pow(GC, 4) * MU * MU * Math.pow(MTT, 3) / (Math.pow(C0, 5) * Math.pow(r, 5));
      const drd = -(64 / 5) * Math.pow(GC, 3) * MU * MTT * MTT / (Math.pow(C0, 5) * r * r * r);
      const tin = (5 / 256) * Math.pow(C0, 5) * Math.pow(r, 4) / (Math.pow(GC, 3) * MU * MTT * MTT);

      // 画面相位：固定 1.05 周期/s（真实 f 只影响压缩系数）
      phase += TWO_PI * NU_VIS * dt;
      if (phase > TWO_PI * 1e6) phase -= TWO_PI * 1e6;
      const Phi = phase;                                      // 源处（x=0）的 GW 相位
      const PH_R = RX * TWO_PI / LAMD;                        // 到探测器的推迟相移
      const PuDet = Phi - PH_R;
      const hp = ap * Math.cos(PuDet), hx = -ac * Math.sin(PuDet);

      // 换周期：清空 chirp 轨迹
      const cyc = Math.floor(t / CYCLE);
      if (cyc !== cycSeen) { cycSeen = cyc; trCount = 0; trGeo.setDrawRange(0, 0); }

      // 源（局部坐标：轨道面 x–z）
      const rVis = rk * KM_W;
      const r1 = rVis * (M2 / MTT), r2 = rVis * (M1 / MTT);
      const th = Phi / 2;                                    // 轨道相位 = GW 相位/2
      nsA.position.set(r1 * Math.cos(th), 0, r1 * Math.sin(th));
      nsB.position.set(-r2 * Math.cos(th), 0, -r2 * Math.sin(th));
      orbA.scale.set(r1, r1, r1); orbB.scale.set(r2, r2, r2);
      src.rotation.z = inc - PI / 2;                        // 视线=+x：L 与 +x 的夹角正好是 ι
      src.rotation.y = 0; src.rotation.x = 0;

      // 四极花瓣：r=0.20+amp|cos2(ψ−ϑ)|，amp ∝ (Q̈ 归一)
      const qn = (1 / r - 1 / (RMAX_M * RG)) / (1 / (RMIN_M * RG) - 1 / (RMAX_M * RG));
      const qA = 0.16 + 0.34 * Math.max(0, Math.min(1, qn));
      for (let i = 0; i < QP; i++) {
        const ps = TWO_PI * (i / (QP - 1));
        const rr = 0.24 + qA * Math.abs(Math.cos(2 * (ps - th)));
        quadPos[i * 3] = rr * Math.cos(ps); quadPos[i * 3 + 1] = 0; quadPos[i * 3 + 2] = rr * Math.sin(ps);
      }
      quadGeo.attributes['position'].needsUpdate = true;

      // h(u) 波形（横轴=推迟时间：x 越大越早，相位越滞后）
      for (let i = 0; i < WT; i++) {
        const x = WX0 + (WX1 - WX0) * (i / (WT - 1));
        const pu = Phi - x * TWO_PI / LAMD;                 // h ∝ cos(ωt − kx)：波峰沿 +x 朝探测器行进
        wPlusPos[i * 3] = x; wPlusPos[i * 3 + 1] = 0.62 + (ap * 1e22) * H_W * Math.cos(pu); wPlusPos[i * 3 + 2] = 0;
        wCrsPos[i * 3] = x; wCrsPos[i * 3 + 1] = -0.62 - (ac * 1e22) * H_W * Math.sin(pu); wCrsPos[i * 3 + 2] = 0;
      }
      wPlusGeo.attributes['position'].needsUpdate = true;
      wCrsGeo.attributes['position'].needsUpdate = true;

      // 探测器环：δL/L=(1/2)(h_+cos2ψ − h_×sin2ψ)，放大 MAG_H
      for (let i = 0; i < NR; i++) {
        const ps = TWO_PI * (i / NR);
        const disp = 1 + 0.5 * MAG_H * (hp * Math.cos(2 * ps) - hx * Math.sin(2 * ps));
        const yy = RRING * disp * Math.cos(ps), zz = RRING * disp * Math.sin(ps);
        rgPos[i * 3] = RX; rgPos[i * 3 + 1] = yy; rgPos[i * 3 + 2] = zz;
        rePos[i * 3] = RX; rePos[i * 3 + 1] = yy; rePos[i * 3 + 2] = zz;
      }
      rePos[NR * 3] = RX; rePos[NR * 3 + 1] = rePos[1]; rePos[NR * 3 + 2] = rePos[2];
      rgGeo.attributes['position'].needsUpdate = true;
      reGeo.attributes['position'].needsUpdate = true;

      // chirp 图（h₀–f 对数坐标，逐点累积）
      if (trCount < NPTS) {
        const lf = Math.log10(fGW), lh = Math.log10(h0 * 1e21);
        trPos[trCount * 3] = CX0 + ((lf - LF_MIN) / LF_SPAN) * (CX1 - CX0);
        trPos[trCount * 3 + 1] = 0.04;
        trPos[trCount * 3 + 2] = CZ0 + ((lh - LH_MIN) / LH_SPAN) * (CZ1 - CZ0);
        trCount++;
        trGeo.setDrawRange(0, trCount);
        trGeo.attributes['position'].needsUpdate = true;
      }
      {
        const lf = Math.log10(fGW), lh = Math.log10(h0 * 1e21);
        dotTr.position.set(CX0 + ((lf - LF_MIN) / LF_SPAN) * (CX1 - CX0), 0.06,
          CZ0 + Math.max(0, Math.min(1, (lh - LH_MIN) / LH_SPAN)) * (CZ1 - CZ0));
      }

      rd.rk = rk; rd.rm = rm; rd.f = fGW; rd.h0 = h0; rd.ap = ap; rd.ac = ac;
      rd.P = P; rd.dr = drd; rd.tin = tin; rd.lam = (C0 / fGW) / 1000; rd.inc = inc;
      rd.comp = fGW / NU_VIS; rd.dh = 1e6 * (ap / 2);

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
