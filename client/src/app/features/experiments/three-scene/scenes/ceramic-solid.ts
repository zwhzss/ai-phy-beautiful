import type { SceneContext, SceneInstance } from '../types';
/**
 * 陶瓷与共价网络固体（P384）—— 主控方程（Born 点阵能 + Griffith 脆断，Al₂O₃/SiC 实参数，node 已复核）：
 *   离子键合      U = −(M·z₊z₋·e²)/(4πε₀·r₀)·(1−1/n)，Al₂O₃：M=1.7476，z=3/2，r₀=0.194 nm，n=8
 *                 ⇒ 每离子对 −1.09×10⁻¹⁷ J（＝−6.5 MJ/mol 离子对），实验点阵能 −15.9 MJ/mol ⇒ 键能是金属的数倍
 *   共价方向性    3C-SiC a=0.43595 nm ⇒ Si–C = a√3/4 = 0.1888 nm，键角 109.47°（四面体 sp³），4.6 eV/键
 *   理论强度      σ_th = √(E·γ_s/d₀)（Born/Frenkel）：Al₂O₃ E=380GPa γ_s=1.2 J/m² d₀=0.208nm ⇒ 46.8 GPa=E/8
 *                 SiC 440GPa γ_s=3.0 d₀=0.252nm ⇒ 72.4 GPa=E/6
 *   真实强度      σ_f = K_IC/(Y√(πa))（Y=1）：Al₂O₃ K_IC=4 MPa·m½ ⇒ a=0.2/2/20/50 µm → 5050/1596/505/319 MPa
 *                 ⇒ 与多晶氧化铝抗弯强度 300–600 MPa 同量级；σ_f/σ_th≈1/100 —— 差的全部是缺陷
 *   无塑性缓冲    同一切换：金属位错可弓出滑移（τ<τ_c 即动），陶瓷 Peierls 应力 τ_pN∼G/10 ⇒ 位错不动
 *                 ⇒ 应力集中无法松弛 ⇒ 直接在特定晶面上解理（断键面密度 1/d₀²=2.3×10¹⁹ m⁻²）
 * 画面：左＝SiC 四面体共价网络（键长/键角可见、方向性明显）；右＝离子交替点阵（示意 NaCl 型，
 * Al₂O₃ 实参数），预制裂纹沿水平解理面推进——裂纹后方跨面键逐排断开、上下晶面弹开并同号电荷相斥；
 * 前方对照两条位错线（青＝金属弓出，红＝陶瓷保持笔直）；σ_f–a 曲线与 σ_app 水平线的交点＝a_c。
 * 扫描自变量：临界缺陷半长 a 在 18 s 内 0.2↔50 µm 对数往复；σ_app=600 MPa 固定，a>a_c=14.2 µm 即解理。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };
  const PI = Math.PI, TWO_PI = PI * 2;

  // —— 材料常数 ——
  const E_AL = 380e9, GS_AL = 1.2, D0_AL = 0.208e-9, KIC_AL = 4e6, NU = 0.26;
  const E_SI = 440e9, GS_SI = 3.0, D0_SI = 0.252e-9;
  const M_AD = 1.7476, ZP = 3, ZM = 2, R0 = 0.194e-9, NBORN = 8, KE = 2.3071e-28;  // e²/4πε₀ J·m
  const U_PAIR = M_AD * ZP * ZM * KE / R0 * (1 - 1 / NBORN);                        // J（每离子对，取绝对值）
  const SIG_TH_AL = Math.sqrt(E_AL * GS_AL / D0_AL);
  const SIG_TH_SI = Math.sqrt(E_SI * GS_SI / D0_SI);
  const SIG_APP = 600e6;
  const AC = (1 / PI) * Math.pow(KIC_AL / SIG_APP, 2);      // 14.2 µm
  const sigF = (a: number) => KIC_AL / Math.sqrt(PI * a);   // Pa

  // —— 显示比例 ——
  const ALX = 0.7e-9;                     // 1 world ⇔ 0.7 nm（真实晶格参数）
  const A_MIN = 0.2e-6, A_MAX = 50e-6, CY = 18;
  const BOND_MAG = 26;                     // 键长弹性伸长放大（面板注明）

  // —— 星野 + 地面 ——
  {
    const g = geo(new THREE.BufferGeometry());
    const p = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      p[i * 3] = (Math.random() - 0.5) * 200; p[i * 3 + 1] = (Math.random() - 0.5) * 200; p[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    group.add(new THREE.Points(g, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  }
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  const mtx = new THREE.Matrix4(), vP = new THREE.Vector3(), vS = new THREE.Vector3(), q = new THREE.Quaternion(0, 0, 0, 1);

  // ============ 左：SiC 四面体共价网络（闪锌矿：FCC Si + C 位移 a/4(111)）============
  const AC0 = 0.43595e-9;                       // m 3C-SiC 晶格常数
  const CELL = AC0 / ALX;                        // world ≈ 1.246
  const NX = 3, NY = 3, NZ = 3;
  const siPos: number[] = [], cPos: number[] = [];
  const LX = -(CELL * NX) / 2 - 2.3;
  {
    const fcc = [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]];
    for (let ix = 0; ix < NX; ix++) for (let iy = 0; iy < NY; iy++) for (let iz = 0; iz < NZ; iz++) {
      for (const b of fcc) {
        const x = LX + (ix + b[0]) * CELL, y = 1.55 + (iy + b[1]) * CELL - (NY * CELL) / 2 + 0.5, z = (iz + b[2]) * CELL - (NZ * CELL) / 2;
        siPos.push(x, y, z);
        cPos.push(x + CELL / 4, y + CELL / 4, z + CELL / 4);
      }
    }
  }
  const NSI = siPos.length / 3, NC = cPos.length / 3;
  const atomGeo = geo(new THREE.SphereGeometry(1, 12, 10));
  const siMesh = new THREE.InstancedMesh(atomGeo, mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.3 })), NSI);
  const cMesh = new THREE.InstancedMesh(atomGeo, mat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0e7490, emissiveIntensity: 0.4, metalness: 0.4, roughness: 0.3 })), NC);
  {
    for (let i = 0; i < NSI; i++) { vP.set(siPos[i * 3], siPos[i * 3 + 1], siPos[i * 3 + 2]); vS.setScalar(0.115); mtx.compose(vP, q, vS); siMesh.setMatrixAt(i, mtx); }
    for (let i = 0; i < NC; i++) { vP.set(cPos[i * 3], cPos[i * 3 + 1], cPos[i * 3 + 2]); vS.setScalar(0.098); mtx.compose(vP, q, vS); cMesh.setMatrixAt(i, mtx); }
    siMesh.instanceMatrix.needsUpdate = true; cMesh.instanceMatrix.needsUpdate = true;
  }
  siMesh.frustumCulled = false; cMesh.frustumCulled = false;
  group.add(siMesh, cMesh);
  // 四面体键：每个 Si 连最近 4 个 C（d = a√3/4）
  const DBOND = AC0 * Math.sqrt(3) / 4 / ALX;
  const bondCyl = geo(new THREE.CylinderGeometry(1, 1, 1, 6));
  const bondMat = mat(new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x6d28d9, emissiveIntensity: 0.35, roughness: 0.4 }));
  const bonds = new THREE.InstancedMesh(bondCyl, bondMat, NSI * 4);
  {
    const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), qq = new THREE.Quaternion();
    let n = 0;
    for (let i = 0; i < NSI; i++) {
      for (let j = 0; j < NC; j++) {
        dir.set(cPos[j * 3] - siPos[i * 3], cPos[j * 3 + 1] - siPos[i * 3 + 1], cPos[j * 3 + 2] - siPos[i * 3 + 2]);
        const L = dir.length();
        if (Math.abs(L - DBOND) < 0.05 * DBOND) {
          dir.normalize();
          vP.set((siPos[i * 3] + cPos[j * 3]) / 2, (siPos[i * 3 + 1] + cPos[j * 3 + 1]) / 2, (siPos[i * 3 + 2] + cPos[j * 3 + 2]) / 2);
          qq.setFromUnitVectors(up, dir);
          vS.set(0.026, L, 0.026); mtx.compose(vP, qq, vS); bonds.setMatrixAt(n++, mtx);
        }
      }
    }
    bonds.count = n; bonds.instanceMatrix.needsUpdate = true;
  }
  bonds.frustumCulled = false;
  group.add(bonds);

  // ============ 右：离子交替点阵（示意 NaCl 型，Al₂O₃ 实参数）============
  const IALS = 2 * 0.194e-9 / ALX;               // world 立方边 = 2 r₀
  const IX = 6, IY = 6, IZ = 3;
  const BX = 0.4, BY0 = 1.55 - (IY * IALS) / 2, BZ0 = -(IZ * IALS) / 2;
  const NSITE = IX * IY * IZ;
  const iPos = new Float32Array(NSITE * 3), iCharge = new Int8Array(NSITE), iRow = new Int16Array(NSITE), iCol = new Int16Array(NSITE);
  const oMesh = new THREE.InstancedMesh(atomGeo, mat(new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x15803d, emissiveIntensity: 0.3, roughness: 0.35 })), NSITE);
  const alMesh = new THREE.InstancedMesh(atomGeo, mat(new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0x9d174d, emissiveIntensity: 0.3, roughness: 0.35 })), NSITE);
  oMesh.frustumCulled = false; alMesh.frustumCulled = false;
  group.add(oMesh, alMesh);
  // 跨解理面（y = 面内某排）的离子键：连接 (i,j,k) 与 (i,j+1,k) 等
  const iBond = geo(new THREE.CylinderGeometry(1, 1, 1, 5));
  const iBondMat = mat(new THREE.MeshStandardMaterial({ color: 0xfde68a, emissive: 0xca8a04, emissiveIntensity: 0.25, roughness: 0.5, transparent: true, opacity: 0.85 }));
  const ibList: number[] = [];                   // 每 8 个 float：ax,ay,az,bx,by,bz,row,crossFlag
  const CUT_ROW = Math.floor(IY / 2);             // 解理面在 CUT_ROW 与 CUT_ROW+1 排之间
  {
    const idx = (i: number, j: number, k: number) => (k * IY + j) * IX + i;
    for (let k = 0; k < IZ; k++) for (let j = 0; j < IY; j++) for (let i = 0; i < IX; i++) {
      const n = idx(i, j, k);
      iPos[n * 3] = BX + i * IALS; iPos[n * 3 + 1] = BY0 + j * IALS; iPos[n * 3 + 2] = BZ0 + k * IALS;
      iCharge[n] = (i + j + k) % 2 === 0 ? -2 : 3;      // O²⁻ / Al³⁺ 交替
      iRow[n] = j; iCol[n] = i;
    }
    for (let k = 0; k < IZ; k++) for (let j = 0; j < IY; j++) for (let i = 0; i < IX; i++) {
      const n = idx(i, j, k);
      const ax = iPos[n * 3], ay = iPos[n * 3 + 1], az = iPos[n * 3 + 2];
      if (i + 1 < IX) { const m = idx(i + 1, j, k); ibList.push(ax, ay, az, iPos[m * 3], iPos[m * 3 + 1], iPos[m * 3 + 2], j, 0); }
      if (j + 1 < IY) { const m = idx(i, j + 1, k); ibList.push(ax, ay, az, iPos[m * 3], iPos[m * 3 + 1], iPos[m * 3 + 2], j, j === CUT_ROW ? 1 : 0); }
    }
  }
  const NIB = ibList.length / 8;
  const ionBonds = new THREE.InstancedMesh(iBond, iBondMat, NIB);
  ionBonds.frustumCulled = false;
  group.add(ionBonds);
  // 解理面 + 裂纹前缘
  const cleavGeo = geo(new THREE.PlaneGeometry(IX * IALS, 0.03));
  const cleavMat = mat(new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.75, depthWrite: false }));
  const cleav = new THREE.Mesh(cleavGeo, cleavMat);
  cleav.rotation.x = -PI / 2;
  group.add(cleav);

  // ============ 位错对照：金属弓出 vs 陶瓷笔直 ============
  const disGeo = geo(new THREE.BufferGeometry());
  const ND = 40;
  disGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ND * 3 * 2), 3));
  const disMetal = new THREE.Line(disGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee })));
  const d2Geo = geo(new THREE.BufferGeometry());
  d2Geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ND * 3 * 2), 3));
  const disCeram = new THREE.Line(d2Geo, mat(new THREE.LineBasicMaterial({ color: 0xef4444 })));
  group.add(disMetal, disCeram);

  // ============ σ_f–a 曲线 + σ_app 水平线 ============
  const PX0 = -3.0, PX1 = 0.6, PY0 = 0.2, PY1 = 2.5, PZ = 2.55;
  const SMIN = 100e6, SMAXP = 5600e6, AMINP = 0.1e-6, AMAXP = 60e-6;
  const nGeo = geo(new THREE.BufferGeometry());
  const NCV = 150;
  nGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NCV * 3), 3));
  group.add(new THREE.Line(nGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e }))));
  const lmap = (s: number) => PY0 + (PY1 - PY0) * (Math.log(Math.max(s, SMIN)) - Math.log(SMIN)) / (Math.log(SMAXP) - Math.log(SMIN));
  const amap = (a: number) => PX0 + (PX1 - PX0) * (Math.log(a) - Math.log(AMINP)) / (Math.log(AMAXP) - Math.log(AMINP));
  {
    const p = nGeo.attributes['position'].array as Float32Array;
    for (let i = 0; i < NCV; i++) {
      const a = AMINP * Math.pow(AMAXP / AMINP, i / (NCV - 1));
      p[i * 3] = amap(a); p[i * 3 + 1] = lmap(sigF(a)); p[i * 3 + 2] = PZ;
    }
    nGeo.attributes['position'].needsUpdate = true;
  }
  const frGeo = geo(new THREE.BufferGeometry());
  frGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    PX0, PY0, PZ, PX1, PY0, PZ, PX0, PY0, PZ, PX0, PY1, PZ,
    PX0, lmap(SIG_APP), PZ, PX1, lmap(SIG_APP), PZ,
    amap(AC), PY0, PZ, amap(AC), PY1, PZ,
  ]), 3));
  group.add(new THREE.LineSegments(frGeo, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));
  const mk2 = new THREE.Mesh(geo(new THREE.SphereGeometry(0.08, 12, 10)), mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })));
  group.add(mk2);

  // —— 标签 ——
  function makeLabel(text: string, color: string, sx = 4.6): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 768; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 384, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(sx, sx / 12, 1);
    return s;
  }
  const l1 = makeLabel('SiC：sp³ 四面体，键角 109.47°，Si–C=0.1888 nm —— 方向性锁死滑移', '#c084fc', 6.0); l1.position.set(LX + CELL / 2, 3.35, 0);
  const l2 = makeLabel('离子点阵：同号相邻即相斥，解理面一开就停不住', '#f9a8d4', 5.4); l2.position.set(BX + IX * IALS / 2 - 0.3, BY0 + IY * IALS + 0.28, 0.4);
  const l3 = makeLabel('对照位错：青＝金属弓出（塑性缓冲），红＝陶瓷笔直（无缓冲）', '#a5f3fc', 5.8); l3.position.set(0.2, 4.05, -1.9);
  const l4 = makeLabel('σ_f=K_IC/√(πa) 与 σ_app 交点＝临界缺陷 a_c', '#86efac', 5.2); l4.position.set((PX0 + PX1) / 2, PY1 + 0.3, PZ);
  group.add(l1, l2, l3, l4);

  // —— 面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 880; infoCv.height = 274;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.6, 2.99)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 4.72, 0); infoPlane.renderOrder = 999;
  group.add(infoPlane);

  const rd = { a: A_MIN, sf: 0, fail: false, nBond: 0, area: 0, gap: 0, ratio: 1 };
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 880, 274);
    infoCtx.fillStyle = 'rgba(7,11,20,0.84)'; infoCtx.fillRect(4, 4, 872, 266);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 872, 266);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText('陶瓷与共价网络固体：键太强、太有方向 ⇒ 只能脆断', 22, 34);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('σ_th=√(E·γ_s/d₀)　Al₂O₃ ⇒ ' + (SIG_TH_AL / 1e9).toFixed(1) + ' GPa=E/8　SiC ⇒ ' + (SIG_TH_SI / 1e9).toFixed(1) + ' GPa=E/6', 22, 64);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText(`离子键：U=−M z₊z₋e²/(4πε₀r₀)(1−1/n)=−${U_PAIR.toExponential(2)} J/离子对（实验点阵能 −15.9 MJ/mol）`, 22, 92);
    infoCtx.fillStyle = '#22c55e';
    infoCtx.fillText('Griffith：σ_f = K_IC/√(πa)，K_IC(Al₂O₃)=4 MPa·m½ —— 强度由缺陷尺寸而非键强决定', 22, 120);
    infoCtx.fillStyle = rd.fail ? '#ef4444' : '#f472b6';
    infoCtx.fillText(rd.fail
      ? `解理！σ_app=${(SIG_APP / 1e6).toFixed(0)}MPa > σ_f=${(rd.sf / 1e6).toFixed(0)}MPa —— 无位错塑性缓冲，裂纹沿晶面瞬断`
      : `安全：σ_f=${(rd.sf / 1e6).toFixed(0)} MPa ≥ σ_app=${(SIG_APP / 1e6).toFixed(0)} MPa（a_c=${(AC * 1e6).toFixed(1)} µm）`, 22, 150);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 22px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：a=${(rd.a * 1e6).toFixed(2)} µm　σ_f=${(rd.sf / 1e6).toFixed(0)} MPa　σ_f/σ_th=${rd.ratio.toFixed(3)}　断键面密度=${(rd.nBond).toExponential(2)} /µm²`, 22, 182);
    infoCtx.fillText(`　　　键面密度 1/d₀²=${(1 / (D0_AL * D0_AL) / 1e12).toExponential(2)}×10¹² m⁻²　裂纹张开 COD=${rd.gap.toFixed(1)} nm（弹性伸长放大 ×${BOND_MAG}）`, 22, 210);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '20px "PingFang SC", sans-serif';
    infoCtx.fillText(`标尺：1wu=${(ALX * 1e9).toFixed(2)} nm（真实晶格）；SiC a=0.43595nm 四面体键；离子块为示意交替格，力学取 Al₂O₃ 参数`, 22, 242);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  const upV = new THREE.Vector3(0, 1, 0), dirV = new THREE.Vector3(), qq = new THREE.Quaternion();
  return {
    update(t, dt) {
      const ph = (t % CY) / CY;
      const s = 0.5 - 0.5 * Math.cos(TWO_PI * ph);
      const a = A_MIN * Math.pow(A_MAX / A_MIN, s);                 // 自变量：临界缺陷半长
      const sf = sigF(a);
      const fail = sf < SIG_APP;
      const ratio = sf / SIG_TH_AL;
      // 解理裂纹长度：a 超过 a_c 后裂纹在画面上推进（用同一 a 归一）
      const frac = Math.max(0, Math.min(1, (a - AC) / (A_MAX - AC)));
      const runLen = fail ? frac * IX * IALS : 0;
      const frontX = BX - 0.5 * IALS + runLen;
      const openD = fail ? 0.055 + 0.075 * frac : 0.0;
      // 弹性伸长：ε=σ/E（放大显示）
      const eps = SIG_APP / E_AL;
      const stretch = eps * IALS * BOND_MAG * (fail ? 1.9 : 1);

      // 离子原子：解理面以上的排（j>CUT_ROW）在裂纹区内被弹开
      let no = 0, na = 0;
      for (let n = 0; n < NSITE; n++) {
        const x = iPos[n * 3], y = iPos[n * 3 + 1], z = iPos[n * 3 + 2];
        const isCracked = iRow[n] > CUT_ROW && x < frontX;
        const dx = (x - BX) * eps * BOND_MAG * 0.15;
        vP.set(x + dx, y + (isCracked ? openD : 0) + stretch * (iRow[n] / IY), z);
        vS.setScalar(iCharge[n] === -2 ? 0.125 : 0.082);
        mtx.compose(vP, q, vS);
        if (iCharge[n] === -2) oMesh.setMatrixAt(no++, mtx); else alMesh.setMatrixAt(na++, mtx);
      }
      oMesh.count = no; alMesh.count = na;
      oMesh.instanceMatrix.needsUpdate = true; alMesh.instanceMatrix.needsUpdate = true;

      // 离子键：跨 CUT_ROW 且裂纹已过 → 断开（长度 0）
      for (let b = 0; b < NIB; b++) {
        const o = b * 8;
        const ax = ibList[o], ay = ibList[o + 1], az = ibList[o + 2];
        const bx = ibList[o + 3], by = ibList[o + 4], bz = ibList[o + 5];
        const cross = ibList[o + 7] === 1;
        const broken = cross && (ax + 0.5 * IALS) < frontX;
        dirV.set(bx - ax, by - ay + (broken ? 0 : 0), bz - az);
        const L = broken ? 0.0001 : dirV.length();
        dirV.normalize();
        qq.setFromUnitVectors(upV, dirV);
        vP.set((ax + bx) / 2, (ay + by) / 2 + (cross && !broken ? stretch : 0), (az + bz) / 2);
        vS.set(broken ? 0.0001 : 0.021, L, broken ? 0.0001 : 0.021);
        mtx.compose(vP, qq, vS); ionBonds.setMatrixAt(b, mtx);
      }
      ionBonds.instanceMatrix.needsUpdate = true;
      iBondMat.color.setHex(fail ? 0xfca5a5 : 0xfde68a);
      cleav.position.set(BX + (IX * IALS) / 2 - 0.5 * IALS, BY0 + (CUT_ROW + 0.5) * IALS, 0);
      cleav.scale.x = Math.max(0.02, runLen / (IX * IALS));
      cleavMat.opacity = fail ? 0.85 : 0.28;
      cleav.visible = IX * IALS > 0.1;

      // 位错对照线：金属随应力弓出，陶瓷保持笔直
      const bulge = 0.42 * Math.min(1, SIG_APP / SIG_TH_AL * 30);
      const mp = disGeo.attributes['position'].array as Float32Array;
      const cp = d2Geo.attributes['position'].array as Float32Array;
      for (let i = 0; i < ND - 1; i++) {
        const u1 = i / (ND - 1), u2 = (i + 1) / (ND - 1);
        const x1 = -1.6 + 3.2 * u1, x2 = -1.6 + 3.2 * u2;
        const h1 = bulge * Math.sin(PI * u1), h2 = bulge * Math.sin(PI * u2);
        mp[i * 6] = x1; mp[i * 6 + 1] = 4.0 + h1; mp[i * 6 + 2] = -1.9;
        mp[i * 6 + 3] = x2; mp[i * 6 + 4] = 4.0 + h2; mp[i * 6 + 5] = -1.9;
        cp[i * 6] = x1; cp[i * 6 + 1] = 3.72; cp[i * 6 + 2] = -1.9;
        cp[i * 6 + 3] = x2; cp[i * 6 + 4] = 3.72; cp[i * 6 + 5] = -1.9;
      }
      disGeo.attributes['position'].needsUpdate = true; disGeo.setDrawRange(0, (ND - 1) * 2);
      d2Geo.attributes['position'].needsUpdate = true; d2Geo.setDrawRange(0, (ND - 1) * 2);

      mk2.position.set(amap(a), lmap(sf), PZ);
      // 每 µm² 需打断的键数（真实面密度）
      const perUm2 = 1e-12 / (D0_AL * D0_AL);
      rd.a = a; rd.sf = sf; rd.fail = fail; rd.ratio = ratio; rd.nBond = perUm2;
      rd.gap = 8 * SIG_APP * a / (PI * (E_AL / (1 - NU * NU))) * 1e9;   // 裂纹中心张开 COD，nm
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
