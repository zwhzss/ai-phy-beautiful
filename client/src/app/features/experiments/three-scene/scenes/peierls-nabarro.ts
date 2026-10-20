import type { SceneContext, SceneInstance } from '../types';
/**
 * 佩尔斯-纳巴罗应力（P370）—— 主控方程（Frenkel–Peak 周期势 + 各向同性弹性，SI 直算）：
 *   点阵阻力      τ_p = (2G/(1−ν))·exp(−2π w/b)，w = d/(1−ν)（d＝滑移面面间距）
 *   周期势        V(x) = (τ_p b/2π)(1 − cos 2πx/b)；位错位置能量
 *                 E(x_d) = (τ_p b/2π)(1 − cos 2πx_d/b) − τ_app·b·x_d
 *                 dE/dx_d = b(τ_p sin 2πx_d/b − τ_app) → τ_app > τ_p 时极小消失＝脱钉
 *   钉扎弹性偏移  Δu = (b/2π)·arcsin(τ_app/τ_p)（核心停在势谷内偏斜，最大 b/4）
 *   位移场（刃型，b∥x，线∥z，额外半原子面在滑移面上方）
 *     u_x = (b/2π)[ atan2(y,x) + xy/(2(1−ν)r²) ]
 *     u_y = −(b/2π)[ (1−2ν)/(2(1−ν))·ln(r/a) + x²/(2(1−ν)r²) ]
 *     （跨滑移面的位移跃变＝b，即伯氏矢量；core 内以 r≥w/2 截断；该场经数值验证满足 div σ=0）
 * 真实锚点：α-Fe {110}⟨111⟩，G=81.6GPa，ν=0.293，b=0.2486nm，d=0.2029nm
 *   → κ=w/b=1.1544 → τ_p=163MPa（F–P 理论值），Frenkel 理想剪切强度 τ_max=Gb/(2πd)=15.9GPa，
 *   τ_p/τ_max≈1% —— 位错宽度只增加 1 倍，点阵阻力下降两个数量级。
 * 各向异性对照（面板末行，同一 τ_p(d) 公式）：{112}⟨111⟩ d=0.1170nm ⇒ κ=0.666 ⇒ τ_p≈3.5GPa，
 *   比 {110} 高 ~20 倍——真实晶体按滑移系/位错型不同，佩尔斯应力可差数量级（本画面弹性场取各向同性近似）。
 * 画面：五层原子列（上方两层为额外半原子面，终止于位错线）＋滑移面下锯齿势谷（高度∝τ_p）
 * ＋前方能量曲线 E(x_d)（势谷＋加载斜坡）：有极小＝钉扎，极小消失＝连续滑移。
 * 扫描自变量：一个 18 s 循环内，位错宽度比 κ=w/b 由 1.05→1.90（核心变宽、势谷变浅），
 * 同时切应力载荷 τ_app 由 0 线性加到 1.1·τ_p(κ_min)；二者共同决定脱钉时刻。
 * 长度显示比例：点阵周期＝伯氏矢量 b＝0.5 world（1 world = 0.497 nm），真实值全部在面板读出。
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

  // —— α-Fe 真实参数（SI）——
  const GB = 81.6e9;                 // 剪切模量 Pa
  const NU = 0.293;                  // 泊松比
  const BP = 0.2486e-9;              // 伯氏矢量 m（=a√3/2）
  const D110 = 0.2029e-9;            // {110} 面间距 m
  const TPREF = 2 * GB / (1 - NU);   // 指前因子 2G/(1−ν) = 230.8 GPa
  const TAUMAX = GB * BP / (2 * PI * D110);   // Frenkel 理想剪切强度 15.9 GPa
  const K_ANCHOR = D110 / ((1 - NU) * BP);    // 1.1544 → τ_p=163 MPa
  const D112 = 0.1170e-9;                     // {112} 面间距 m（α-Fe 另一滑移系，各向异性对照）
  const K112 = D112 / ((1 - NU) * BP);        // 0.666
  const TP112 = TPREF * Math.exp(-TWO_PI * K112);   // ≈3.5 GPa：同一公式，面间距差 ⇒ τ_p 差 ~20 倍
  const K_MIN = 1.05, K_MAX = 1.90;
  const TPMAX = TPREF * Math.exp(-TWO_PI * K_MIN);   // 314.9 MPa
  const TPMIN = TPREF * Math.exp(-TWO_PI * K_MAX);   // 1.51 MPa
  const TA_MAX = 1.1 * TPMAX;
  const CY = 18;

  // —— 显示比例：1 个伯氏矢量 = 0.5 world ——
  const BW = 0.5, X0 = -3.0, NCOL = 13;
  const DROW = 0.30, GLIDE_Y = 1.17;
  const ROW_BELOW = [GLIDE_Y - 2 * DROW, GLIDE_Y - DROW, GLIDE_Y - 0.5 * DROW];
  const ROW_ABOVE = [GLIDE_Y + 0.5 * DROW, GLIDE_Y + 1.5 * DROW];
  const ZS = [-1.05, -0.35, 0.35, 1.05];
  const HF = 0.127;                  // world / (τ_p_max·b/π)：能量与势谷的同一显示比例
  const CHZ = 1.9, CHX = 0.8, CHY = 0.95;    // 能量曲线所在平面与窗口

  // —— 星野 + 地面 ——
  {
    const g = geo(new THREE.BufferGeometry());
    const p = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      p[i * 3] = (Math.random() - 0.5) * 200;
      p[i * 3 + 1] = (Math.random() - 0.5) * 200;
      p[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    group.add(new THREE.Points(g, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  }
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // —— 原子：完整行（下）／额外半原子面（上）／核心发光列 ——
  const NB = 3 * NCOL * ZS.length, NAB = 2 * NCOL * ZS.length, NTOT = NB + NAB;
  const atomGeo = geo(new THREE.SphereGeometry(1, 10, 8));
  const matBelow = mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.55, roughness: 0.35 }));
  const matAbove = mat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0e7490, emissiveIntensity: 0.55, metalness: 0.4, roughness: 0.3 }));
  const matGlow = mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.85 }));
  const meshBelow = new THREE.InstancedMesh(atomGeo, matBelow, NB);
  const meshAbove = new THREE.InstancedMesh(atomGeo, matAbove, NAB);
  const meshGlow = new THREE.InstancedMesh(atomGeo, matGlow, NTOT);
  meshBelow.frustumCulled = false; meshAbove.frustumCulled = false; meshGlow.frustumCulled = false;
  group.add(meshBelow, meshAbove, meshGlow);

  // 行/列/z 的静态查表：n = ((rowIdx*NCOL)+col)*NZ + zi
  const rowY = new Float32Array(NTOT);
  const zArr = new Float32Array(NTOT);
  const aboveArr = new Uint8Array(NTOT);
  {
    let n = 0;
    for (let r = 0; r < 5; r++) {
      const y = r < 3 ? ROW_BELOW[r] : ROW_ABOVE[r - 3];
      for (let c = 0; c < NCOL; c++) {
        for (let zi = 0; zi < ZS.length; zi++) {
          rowY[n] = y;
          zArr[n] = ZS[zi];
          aboveArr[n] = r >= 3 ? 1 : 0;
          n++;
        }
      }
    }
  }
  const mtx = new THREE.Matrix4();
  const vPos = new THREE.Vector3();
  const vScl = new THREE.Vector3();
  const qId = new THREE.Quaternion();

  // —— 滑移面 / 额外半原子面 ——
  const slipGeo = geo(new THREE.PlaneGeometry(6.4, 2.5));
  const slipMesh = new THREE.Mesh(slipGeo, mat(new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false })));
  slipMesh.rotation.x = -PI / 2;
  slipMesh.position.set(0, GLIDE_Y, 0);
  group.add(slipMesh);
  const halfGeo = geo(new THREE.PlaneGeometry(1, 2.5));
  const halfMat = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
  const halfMesh = new THREE.Mesh(halfGeo, halfMat);
  halfMesh.rotation.x = -PI / 2;
  halfMesh.position.set(0, GLIDE_Y + 0.5 * DROW + 0.5 * DROW, 0);
  group.add(halfMesh);

  // —— 位错线 + 伯氏矢量箭头 ——
  const lineGeo = geo(new THREE.BufferGeometry());
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0, 0, ZS[0] - 0.14, 0, 0, ZS[ZS.length - 1] + 0.14,
  ]), 3));
  const dnLine = new THREE.Line(lineGeo, mat(new THREE.LineBasicMaterial({ color: 0xfef3c7 })));
  dnLine.position.set(0, GLIDE_Y, 0);
  group.add(dnLine);
  const ringGeo = geo(new THREE.BufferGeometry());
  {
    // 围绕位错线（线沿 z）的核心标记环，位于 x–y 平面
    const p = new Float32Array(41 * 3);
    for (let i = 0; i < 41; i++) {
      const a = TWO_PI * i / 40;
      p[i * 3] = Math.cos(a) * 0.13; p[i * 3 + 1] = Math.sin(a) * 0.13; p[i * 3 + 2] = 0;
    }
    ringGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  }
  const coreRing = new THREE.Line(ringGeo, mat(new THREE.LineBasicMaterial({ color: 0xf472b6 })));
  coreRing.position.set(0, GLIDE_Y, ZS[0] - 0.16);
  group.add(coreRing);
  const shaftGeo = geo(new THREE.CylinderGeometry(0.022, 0.022, 1, 8));
  const headGeo = geo(new THREE.ConeGeometry(0.06, 0.14, 10));
  const vecMat = mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
  const bShaft = new THREE.Mesh(shaftGeo, vecMat);
  const bHead = new THREE.Mesh(headGeo, vecMat);
  bShaft.rotation.z = -PI / 2; bHead.rotation.z = -PI / 2;
  bShaft.scale.set(1, 0.74 * BW, 1);
  group.add(bShaft, bHead);

  // —— 势谷（滑移面下方锯齿面，高度∝τ_p）——
  const BX = 121, BZC = 3;
  const barGeo = geo(new THREE.BufferGeometry());
  const barPos = new Float32Array(BX * BZC * 3);
  const barIdx: number[] = [];
  for (let i = 0; i < BX - 1; i++) {
    for (let j = 0; j < BZC - 1; j++) {
      const a = i * BZC + j, b2 = a + 1, c = a + BZC, d = c + 1;
      barIdx.push(a, c, b2, b2, c, d);
    }
  }
  barGeo.setAttribute('position', new THREE.BufferAttribute(barPos, 3));
  barGeo.setIndex(barIdx);
  const barMat = mat(new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x6d28d9, emissiveIntensity: 0.4, transparent: true, opacity: 0.62, side: THREE.DoubleSide, roughness: 0.5 }));
  const barMesh = new THREE.Mesh(barGeo, barMat);
  group.add(barMesh);

  // —— 能量曲线 E(x_d)（前方竖直平面，跟随核心）——
  const EP = 65;
  const eGeo = geo(new THREE.BufferGeometry());
  const ePos = new Float32Array((EP - 1) * 6);
  eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
  const eMesh = new THREE.LineSegments(eGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e })));
  group.add(eMesh);
  const dotGeo = geo(new THREE.SphereGeometry(0.055, 12, 10));
  const dot = new THREE.Mesh(dotGeo, mat(new THREE.MeshBasicMaterial({ color: 0xfef3c7 })));
  group.add(dot);
  const eFrame = new THREE.Group();
  {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -CHX, 0, 0, CHX, 0, 0,                 // 水平轴（E=0 参考线）
      -CHX, -0.66, 0, -CHX, 0.72, 0,         // 竖直轴
      CHX, -0.66, 0, CHX, 0.72, 0,
    ]), 3));
    eFrame.add(new THREE.LineSegments(g, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));
  }
  eFrame.position.set(0, CHY, CHZ);
  group.add(eFrame);

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
  const lb1 = makeLabel('刃型位错：上方两层为额外半原子面，终止于位错线', '#67e8f9', 4.6); lb1.position.set(-0.2, 1.92, 0);
  const lb2 = makeLabel('滑移面：两侧 u_x 跃变 = b，核心内原子逐列翻越势垒', '#93c5fd', 4.4); lb2.position.set(-0.6, 0.62, -1.5);
  const lb3 = makeLabel('势谷高度 ∝ τ_p=(2G/(1−ν))e^(−2πw/b)：变宽即变浅', '#c084fc', 4.4); lb3.position.set(-0.4, 0.14, 1.55);
  const lb4 = makeLabel('E(x_d)：有极小＝钉扎，τ_app>τ_p 时极小消失＝滑移', '#86efac', 4.2); lb4.position.set(CHX + 1.5, CHY + 0.66, CHZ);
  const lb5 = makeLabel('b = 0.2486 nm（点阵周期＝0.5 world）', '#fcd34d', 3.4); lb5.position.set(0.9, 1.34, 1.35);
  group.add(lb1, lb2, lb3, lb4, lb5);

  // —— 信息面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 800; infoCv.height = 292;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(7.4, 2.70)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 3.52, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  const rd = { k: K_MIN, tp: TPMAX, ta: 0, wnm: 0, dnm: 0, uoff: 0, hops: 0, xd: 0, v: 0, un: false };
  function fmtMPa(pa: number): string {
    const m = pa / 1e6;
    if (m >= 1) return `${m.toFixed(m >= 100 ? 0 : 1)} MPa`;
    return `${(m * 1e3).toFixed(m * 1e3 >= 10 ? 0 : 1)} kPa`;
  }
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 800, 292);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 792, 284);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3;
    infoCtx.strokeRect(4, 4, 792, 284);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 25px "PingFang SC", sans-serif';
    infoCtx.fillText('佩尔斯-纳巴罗应力：晶格给位错的摩擦力', 20, 32);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('τ_p=(2G/(1−ν))·exp(−2πw/b)，w=d/(1−ν)，V=(τ_p b/2π)(1−cos2πx/b)', 20, 60);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('脱钉判据 τ_app>τ_p ⇔ E(x_d) 的极小消失；钉扎时 Δu=(b/2π)arcsin(τ_app/τ_p)', 20, 86);
    infoCtx.fillStyle = '#22c55e';
    infoCtx.fillText(`α-Fe{110}⟨111⟩：κ=${K_ANCHOR.toFixed(3)}→τ_p=${(TPREF * Math.exp(-TWO_PI * K_ANCHOR) / 1e6).toFixed(0)}MPa＝理想强度 ${(TAUMAX / 1e9).toFixed(1)}GPa 的 ${(TPREF * Math.exp(-TWO_PI * K_ANCHOR) / TAUMAX * 100).toFixed(1)}%`, 20, 112);
    infoCtx.fillStyle = '#f472b6';
    infoCtx.fillText(`当前：${rd.un ? '已脱钉——位错连续滑移，逐层扫过原子面' : '被钉扎在势谷内（只有弹性偏移 Δu<b/4）'}`, 20, 138);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 21px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：κ=w/b=${rd.k.toFixed(3)}  w=${rd.wnm.toFixed(3)}nm  d=${rd.dnm.toFixed(3)}nm  τ_p=${fmtMPa(rd.tp)}  τ_p/τ_max=${(rd.tp / TAUMAX * 100).toFixed(2)}%`, 20, 166,
    );
    infoCtx.fillText(
      `τ_app=${fmtMPa(rd.ta)}  τ_app/τ_p=${(rd.ta / rd.tp).toFixed(3)}  Δu=${(rd.uoff * BP / BW * 1e9).toFixed(4)}nm=${(rd.uoff / BW).toFixed(3)}b`, 20, 192,
    );
    infoCtx.fillText(
      `已翻越势垒 ${rd.hops} 个（x_d=${(rd.xd * BP / BW * 1e9).toFixed(3)}nm）  v∝(τ_app−τ_p)（显示律，非真实迁移率）`, 20, 218,
    );
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '20px "PingFang SC", sans-serif';
    infoCtx.fillText(`G=81.6GPa ν=0.293 b=0.2486nm d₁₁₀=0.2029nm；κ:${K_MIN}→${K_MAX} 时 τ_p:${(TPMAX / 1e6).toFixed(0)}→${(TPMIN / 1e6).toFixed(1)}MPa`, 20, 246);
    infoCtx.fillStyle = '#67e8f9';
    const tpA = TPREF * Math.exp(-TWO_PI * K_ANCHOR);
    infoCtx.fillText(`各向异性对照（同一 τ_p(d) 式）：{112}⟨111⟩ d=0.1170nm→κ=${K112.toFixed(3)}→τ_p=${fmtMPa(TP112)}，是 {110} 锚点(${fmtMPa(tpA)})的 ${(TP112 / tpA).toFixed(0)} 倍`, 20, 274);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  // —— 状态 ——
  let xd = X0 + 2 * BW;
  let hops = 0;
  let prevInt = Math.round((xd - X0) / BW);
  let phasePrev = 0;

  return {
    update(t, dt) {
      const step = Math.min(dt, 0.05);
      const ph = (t % CY) / CY;
      if (ph < phasePrev) { xd = X0 + 2 * BW; hops = 0; prevInt = Math.round((xd - X0) / BW); }
      phasePrev = ph;

      // 自变量 1：位错宽度比 κ=w/b（1.05→1.90）；自变量 2：切应力载荷 τ_app 线性加载
      const k = K_MIN + (K_MAX - K_MIN) * (0.5 - 0.5 * Math.cos(TWO_PI * ph));
      const tp = TPREF * Math.exp(-TWO_PI * k);          // τ_p(κ)
      const ta = TA_MAX * ph;                             // τ_app
      const un = ta > tp;
      const ratio = ta / tp;
      const wW = k * BW;                                  // 核心宽度（world）
      const RC = Math.max(0.13, wW / 2);                  // 弹性截断半径

      // 位错线位置：钉扎→弛豫到势谷＋弹性偏移；脱钉→按超出量黏性滑移
      const uoff = un ? 0 : Math.asin(Math.min(0.9995, ratio)) * BW / TWO_PI;
      const snap = (Math.round((xd - X0) / BW)) * BW + X0 + uoff;
      if (!un) {
        xd += (snap - xd) * Math.min(1, step * 6);
      } else {
        const v = Math.min(3.0, 0.9 * (ta - tp) / TPMAX);
        xd = Math.min(2.05, xd + v * step);
      }
      const gi = Math.round((xd - X0) / BW);
      if (gi > prevInt) { hops += gi - prevInt; }
      prevInt = gi;

      // 原子位置：真实弹性位移场（core 内 r 截断）
      const inv2 = 1 / (2 * (1 - NU));
      const acoef = (1 - 2 * NU) / (2 * (1 - NU));
      const tip = Math.floor((xd - X0) / BW);        // 额外半原子面终止于核心后第一个格点
      let nb = 0, na = 0, ng = 0;
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < NCOL; c++) {
          for (let zi = 0; zi < ZS.length; zi++) {
            const n = (r * NCOL + c) * ZS.length + zi;
            const y = rowY[n];
            const z = zArr[n];
            let X = X0 + c * BW;
            let vis = true;
            if (aboveArr[n] === 1) {
              const m = tip - c;                     // 插入行：核心及其左侧才存在原子
              X = X0 + m * BW;
              vis = m >= 0;
            }
            const dx = X - xd, dy = y - GLIDE_Y;
            let rr = Math.sqrt(dx * dx + dy * dy);
            const th = Math.atan2(dy, dx);
            if (rr < RC) rr = RC;
            const r2 = rr * rr;
            const ux = (BW / TWO_PI) * (th + dx * dy * inv2 / r2);
            const uy = -(BW / TWO_PI) * (acoef * Math.log(rr / BW) + dx * dx * inv2 / r2);
            if (vis) {
              vPos.set(X + ux, y + uy, z);
              vScl.set(0.075, 0.075, 0.075);
              mtx.compose(vPos, qId, vScl);
              if (aboveArr[n] === 1) meshAbove.setMatrixAt(na++, mtx);
              else meshBelow.setMatrixAt(nb++, mtx);
              // 核心宽度内的原子＝正在翻越周期势垒（金色球半径随靠近核心而增大）
              const g = Math.max(0, 1 - Math.abs(dx) / RC) * (Math.abs(dy) < 0.6 ? 1 : 0);
              vScl.setScalar(0.024 + 0.055 * g);
              mtx.compose(vPos, qId, vScl);
              meshGlow.setMatrixAt(ng++, mtx);
            } else {
              vPos.set(0, -50, 0);
              vScl.setScalar(0.0001);
              mtx.compose(vPos, qId, vScl);
              if (aboveArr[n] === 1) meshAbove.setMatrixAt(na++, mtx);
              else meshBelow.setMatrixAt(nb++, mtx);
              meshGlow.setMatrixAt(ng++, mtx);
            }
          }
        }
      }
      meshBelow.count = nb; meshAbove.count = na; meshGlow.count = ng;
      meshBelow.instanceMatrix.needsUpdate = true;
      meshAbove.instanceMatrix.needsUpdate = true;
      meshGlow.instanceMatrix.needsUpdate = true;

      // 位错线 / 核心环 / b 矢量
      dnLine.position.x = xd;
      coreRing.position.x = xd;
      bShaft.position.set(xd + 0.37 * BW, GLIDE_Y - 0.46, 1.35);
      bHead.position.set(xd + 0.74 * BW + 0.07, GLIDE_Y - 0.46, 1.35);
      // 额外半原子面薄片：从晶体左边界伸到核心
      const halfLen = Math.max(0.05, xd - (X0 - 0.5 * BW));
      halfMesh.scale.x = halfLen;
      halfMesh.position.x = (X0 - 0.5 * BW + xd) / 2;
      halfMat.opacity = 0.10 + 0.12 * (k / K_MAX);

      // 势谷锯齿（高度 ∝ τ_p）
      const amp = HF * tp / TPMAX;
      {
        let v = 0;
        for (let i = 0; i < BX; i++) {
          const xw = -3.2 + 6.4 * i / (BX - 1);
          const h = amp * (1 - Math.cos(TWO_PI * (xw - X0) / BW)) / 2;
          for (let j = 0; j < BZC; j++) {
            barPos[v] = xw; barPos[v + 1] = 0.05 + h; barPos[v + 2] = -1.2 + 2.4 * j / (BZC - 1);
            v += 3;
          }
        }
        barGeo.attributes['position'].needsUpdate = true;
        barGeo.computeVertexNormals();
      }
      barMat.opacity = 0.34 + 0.4 * amp / HF;

      // 能量曲线：势谷 + 加载斜坡（两项同一比例，极小消失条件严格等价于 τ_app>τ_p）
      {
        const slope = HF * PI / BW;
        const tilt = slope * ta / TPMAX;
        eFrame.position.x = xd;
        for (let i = 0; i < EP - 1; i++) {
          const x1 = xd - CHX + 2 * CHX * i / (EP - 1);
          const x2 = xd - CHX + 2 * CHX * (i + 1) / (EP - 1);
          const h1 = CHY + amp * (1 - Math.cos(TWO_PI * (x1 - X0) / BW)) / 2 - tilt * (x1 - xd);
          const h2 = CHY + amp * (1 - Math.cos(TWO_PI * (x2 - X0) / BW)) / 2 - tilt * (x2 - xd);
          const o = i * 6;
          ePos[o] = x1; ePos[o + 1] = Math.max(0.06, Math.min(2.0, h1)); ePos[o + 2] = CHZ;
          ePos[o + 3] = x2; ePos[o + 4] = Math.max(0.06, Math.min(2.0, h2)); ePos[o + 5] = CHZ;
        }
        eGeo.attributes['position'].needsUpdate = true;
        const hd = CHY + amp * (1 - Math.cos(TWO_PI * (xd - X0) / BW)) / 2;
        dot.position.set(xd, Math.max(0.08, Math.min(2.0, hd)), CHZ);
      }

      rd.k = k; rd.tp = tp; rd.ta = ta; rd.un = un;
      rd.wnm = k * BP * 1e9; rd.dnm = k * (1 - NU) * BP * 1e9;
      rd.uoff = uoff; rd.hops = hops; rd.xd = xd;

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
