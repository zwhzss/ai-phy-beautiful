import type { SceneContext, SceneInstance } from '../types';
/**
 * 电容器的能量（P439）：充电账本 + 「能量定域在场」的三维体元 + 拉开极板的机械功。
 * 全部画面几何与面板数字来自同一个 energy() 计算（两条真实规律按时间接力的两段）：
 *   段Ⅰ 闭合开关经 R 充电（电源 V0 恒定）
 *     v(t)=V0(1−e^(−t/RC))，i(t)=(V0/R)e^(−t/RC)，E=v/d
 *     电源做功 W_bat=V0·q=C·V0·v ，场储能 W_c=½C·v² ，焦耳热 W_R=W_bat−W_c
 *     ⇒ 充满时 W_c=W_R=½C·V0²（各占一半，与 R 无关 —— 这是本场景的核心结论）
 *   段Ⅱ 断开电源（Q=C(d0)V0 固定）后再把极板从 d0 拉开到 d
 *     E=σ/ε0=Q/(ε0S) 与 d 无关，U=Q/C=V0·d/d0 线性升高
 *     W=Q²/(2C)=½ε0E²·S·d ，板间吸引力 F=½ε0E²S 恒定 ⇒ 手的机械功 W_m=F·(d−d0) 恰好等于 ΔW
 *   能量定域：u=½ε0E² [J/m³]（介质中变 ½ε0εrE_介²=u/εr，εr=4）；场体积=S·d，∭u dV=W
 * 扫描自变量：充电进度 t/RC（画面 5 s = 4 个时间常数）+ 板间距 d（1→4 cm，15 s）。
 * 断开时刻把真实电荷 q=C0·v(4τ)=0.9817·C0V0 冻结下来（不是理想 C0V0），段Ⅱ全部由它推 V、E、W，
 *   于是 ΔW 与 ∫F·dd 从 d=d0 那一刻起就逐帧吻合（面板"差"≈ 0，而非 100% 的假守恒）。
 * 校验：_scratch/agentA2/verify.mjs（S=1e-2 m²、V0=200 V、d0=1 cm ⇒ C=8.854 pF、
 *        q=1.738 nC、E=1.963×10⁴ V/m、u=1.707×10⁻³ J/m³、W(4τ)=170.7 nJ、
 *        W(4 cm)=682.9 nJ = 170.7 + 512.2(机械功)，∫F·dd=512.2 nJ 逐帧一致）。
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
  {
    const p = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) { p[i * 3] = (Math.random() - 0.5) * 200; p[i * 3 + 1] = (Math.random() - 0.5) * 200; p[i * 3 + 2] = (Math.random() - 0.5) * 200; }
    starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  }
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  grid.position.y = -3.2;
  group.add(grid);

  // ===== 真实参数（1 世界单位 = 4 cm） =====
  const EPS0 = 8.854e-12, U2M = 0.04;
  const LP = 0.10;                                     // 方板边长 10 cm ⇒ S = 1.0e-2 m²
  const S = LP * LP;
  const V0 = 200, RES = 1.0e4;                         // 电源电压、充电电阻
  const D0 = 0.01;                                     // 充电时板间距 1 cm
  const TAU = EPS0 * S / D0 * RES;                     // τ = RC（d0 时）
  const QF = EPS0 * S * V0 / D0;                       // 充满后断开的电荷（1.77 nC）

  let uC = 0, dNow = D0, vC = 0, iC = 0, Enow = 0, Cnow = 0, Unow = 0, Wbat = 0, Wc = 0, Wr = 0, Wm = 0, unow = 0, Fnow = 0;
  let charging = true;
  const C0 = EPS0 * S / D0;                            // 充电完成（d0）时的电容
  let qNow = C0 * V0;                                  // 断开瞬间冻结的真实电荷（=C0·v(4τ)，比 C0·V0 小 1.8%）
  let WbatF = 0, Wc0 = 0, WrF = 0, WmMech = 0;         // 断开瞬间冻结的账本 + 机械功的逐步累积 ∫F·dd
  function energy(): void {
    Cnow = EPS0 * S / dNow;
    if (charging) {
      vC = V0 * (1 - Math.exp(-4 * uC));               // 画面 5 s 展示 0→4τ
      iC = (V0 / RES) * Math.exp(-4 * uC);
      Cnow = C0; dNow = D0;
      qNow = C0 * vC;                                  // 逐帧跟踪真实电荷 ⇒ 断开时刻不带跳变地冻结
      Wbat = C0 * V0 * vC;                             // 电源做功 = V0·q（q=C0v）
      Wc = 0.5 * C0 * vC * vC;                         // ½CV²
      Wr = Wbat - Wc;                                  // 焦耳热（同一时刻的差额）
      Wm = 0;
    } else {
      vC = qNow / Cnow; iC = 0;                        // Q 固定 ⇒ U=Q/C ∝ d、E=σ/ε0=Q/(ε0S) 恒定
      Wbat = WbatF; Wr = WrF;
      Wc = 0.5 * Cnow * vC * vC;                       // = ½ε0E²·S·d
      Wm = Wc - Wc0;                                   // 储能增量
    }
    Enow = vC / dNow;
    Unow = vC;
    unow = 0.5 * EPS0 * Enow * Enow;                   // 能量密度 [J/m³]
    Fnow = unow * S;                                   // 板间吸引力 F=½ε0E²S [N]
  }

  // ===== 极板 + 场体积（体元，颜色与不透明度 ∝ u=½ε0E²） =====
  const plateMat = mat(new THREE.MeshStandardMaterial({ color: 0xcfd8e3, metalness: 0.92, roughness: 0.2, emissive: 0x22d3ee, emissiveIntensity: 0.04 }));
  const plateGeo = geo(new THREE.BoxGeometry(0.1, LP / U2M, LP / U2M));
  const pL = new THREE.Mesh(plateGeo, plateMat); pL.rotation.z = Math.PI / 2; group.add(pL);
  const pR = new THREE.Mesh(plateGeo, plateMat); pR.rotation.z = Math.PI / 2; group.add(pR);
  const fieldMat = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false }));
  const fieldVol = new THREE.Mesh(geo(new THREE.BoxGeometry(1, LP / U2M * 0.94, LP / U2M * 0.94)), fieldMat);
  group.add(fieldVol);
  const wireEdge = new THREE.LineSegments(geo(new THREE.EdgesGeometry(fieldVol.geometry)), mat(new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.5 })));
  group.add(wireEdge);

  // 场强箭头（3×3 方阵，杆长 ∝ E=V/d，色/透明 ∝ u=½ε0E²）；E 由 +x 板指向 −x 板（左板带负电）
  const arrGeo = geo(new THREE.ConeGeometry(0.07, 0.3, 8));
  const arrShaft = geo(new THREE.CylinderGeometry(0.018, 0.018, 1, 6));   // 单位高沿本地 +Y ⇒ rotation.z=+90° 后沿 −x，scale.y 即世界长度
  const arrows: { head: import('three').Mesh, shaft: import('three').Mesh, m: import('three').MeshBasicMaterial, y: number, z: number }[] = [];
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
    const m = mat(new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.9 }));
    const head = new THREE.Mesh(arrGeo, m); head.rotation.z = Math.PI / 2;   // 锥尖朝 −x
    const shaft = new THREE.Mesh(arrShaft, m); shaft.rotation.z = Math.PI / 2;
    group.add(head, shaft);
    arrows.push({ head, shaft, m, y: (a - 1) * 0.78, z: (b - 1) * 0.78 });
  }
  const EMAX = V0 / D0;                                // 参考场强（d0、V0 满压）

  // ===== 电荷点（数量 ∝ Q=σS 固定，断开后不变；充电时逐步出现） =====
  const dotGeo = geo(new THREE.SphereGeometry(0.055, 8, 8));
  const posMat = mat(new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  const negMat = mat(new THREE.MeshBasicMaterial({ color: 0x3b82f6 }));
  const NDOT = 30;
  const dots: import('three').Mesh[] = [];
  for (let i = 0; i < NDOT * 2; i++) {
    const m = new THREE.Mesh(dotGeo, i < NDOT ? negMat : posMat);
    group.add(m); dots.push(m);
  }

  // ===== 充电回路：电源、电阻（发热 ∝ i²R）、开关、导线 =====
  const batMat = mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.3, metalness: 0.6, roughness: 0.4 }));
  const bat = new THREE.Mesh(geo(new THREE.BoxGeometry(0.34, 0.7, 0.3)), batMat);
  bat.position.set(-2.9, -2.35, 0); group.add(bat);
  const resMat = mat(new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.2, metalness: 0.4, roughness: 0.5 }));
  const res = new THREE.Mesh(geo(new THREE.TorusKnotGeometry(0.2, 0.05, 48, 6)), resMat);
  res.position.set(-0.6, -2.35, 0); group.add(res);
  const swMat = mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.25, emissive: 0x22c55e, emissiveIntensity: 0.1 }));
  const swBlade = new THREE.Mesh(geo(new THREE.BoxGeometry(0.55, 0.06, 0.06)), swMat);
  swBlade.position.set(1.5, -2.28, 0); group.add(swBlade);
  for (const sx of [1.28, 1.72]) {
    const post = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 8)), swMat);
    post.position.set(sx, -2.35, 0); group.add(post);
  }
  {
    const wp: number[] = [];
    const push = (x1: number, y1: number, x2: number, y2: number) => { wp.push(x1, y1, 0, x2, y2, 0); };
    push(-2.9, -2.0, -2.9, -1.6); push(-2.9, -1.6, -1.9, -1.6); push(-1.9, -1.6, -1.9, 0);
    push(-2.9, -2.7, -0.6, -2.7); push(-0.6, -2.35, -0.6, -2.7); push(-0.6, -2.7, 1.28, -2.7);
    push(1.72, -2.7, 1.9, -2.7); push(1.9, -2.7, 1.9, -1.6); push(1.9, -1.6, 2.9, -1.6); push(2.9, -1.6, 2.9, 0);
    const wg = geo(new THREE.BufferGeometry());
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
    group.add(new THREE.LineSegments(wg, mat(new THREE.LineBasicMaterial({ color: 0x64748b }))));
  }
  // 电流串珠（速度 ∝ i，方向为充电电流方向）
  const CURVE: [number, number][] = [[-1.9, -1.6], [-1.9, -2.7], [-0.6, -2.7], [1.28, -2.7], [1.72, -2.7], [1.9, -2.7], [1.9, -1.6], [2.9, -1.6]];
  let clen = 0;
  const cseg: number[] = [];
  for (let i = 1; i < CURVE.length; i++) { clen += Math.hypot(CURVE[i][0] - CURVE[i - 1][0], CURVE[i][1] - CURVE[i - 1][1]); cseg.push(clen); }
  const beadGeo = geo(new THREE.SphereGeometry(0.06, 8, 8));
  const beadMat = mat(new THREE.MeshBasicMaterial({ color: 0xfef3c7 }));
  const beads: import('three').Mesh[] = [];
  for (let i = 0; i < 16; i++) { const b = new THREE.Mesh(beadGeo, beadMat); group.add(b); beads.push(b); }
  let beadPos = 0;
  function curveAt(s: number): [number, number] {
    let u = ((s % clen) + clen) % clen;
    let prev = 0;
    for (let i = 0; i < cseg.length; i++) {
      if (u <= cseg[i]) {
        const f = (u - prev) / (cseg[i] - prev);
        const a = CURVE[i], b = CURVE[i + 1];
        return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      }
      prev = cseg[i];
    }
    return CURVE[CURVE.length - 1];
  }

  // ===== 能量账本：四根条（电源功 / 场储能 / 焦耳热 / 机械功） =====
  const bars: { mesh: import('three').Mesh, m: import('three').MeshStandardMaterial, name: string, color: number }[] = [];
  const barGeo = geo(new THREE.BoxGeometry(0.34, 1, 0.34));
  function addBar(x: number, color: number, name: string): void {
    const m = mat(new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.45, transparent: true, opacity: 0.92 }));
    const mesh = new THREE.Mesh(barGeo, m);
    mesh.position.set(x, 0.6, 2.2);
    group.add(mesh); bars.push({ mesh, m, name, color });
  }
  addBar(-3.5, 0xfbbf24, 'W_bat'); addBar(-3.0, 0x22d3ee, 'W_c'); addBar(-2.5, 0xef4444, 'W_R'); addBar(-2.0, 0x22c55e, 'W_m');
  // 半程参考线：电源功的一半 = 储能 = 焦耳热（充电核心结论）
  {
    const hg = geo(new THREE.BufferGeometry());
    hg.setAttribute('position', new THREE.Float32BufferAttribute([-3.72, 0.6, 2.2, -1.78, 0.6, 2.2], 3));
    group.add(new THREE.Line(hg, mat(new THREE.LineBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.55 }))));
  }

  // ===== 等效立方体：棱长 = (W/Wref)^(1/3)，直观显示「储能有多少」 =====
  const cubeMat = mat(new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.35 }));
  const cubeGeo = geo(new THREE.BoxGeometry(1, 1, 1));
  const cube = new THREE.Mesh(cubeGeo, cubeMat);
  cube.position.set(3.3, 1.15, 2.0); group.add(cube);
  const cubeEdge = new THREE.LineSegments(geo(new THREE.EdgesGeometry(cubeGeo)), mat(new THREE.LineBasicMaterial({ color: 0xa855f7 })));
  cubeEdge.position.copy(cube.position); group.add(cubeEdge);

  // ===== 板间距标尺 + 拉力箭头 =====
  {
    const pts: number[] = [];
    for (let cm = 0; cm <= 40; cm += 2) { const u = cm / 4 / U2M * 0.4; pts.push(-u, -1.15, 1.35, -u, cm % 10 === 0 ? -1.35 : -1.25, 1.35); }
    const rg = geo(new THREE.BufferGeometry());
    rg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    group.add(new THREE.LineSegments(rg, mat(new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.8 }))));
  }
  const pullMat = mat(new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.9 }));
  const pull = new THREE.Mesh(geo(new THREE.ConeGeometry(0.13, 0.44, 10)), pullMat);
  pull.rotation.z = -Math.PI / 2; group.add(pull);

  function makeLabel(text: string, color: string, w: number, x: number, y: number, z: number): void {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 25px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(w, w / 8, 1); s.position.set(x, y, z); s.renderOrder = 996;
    group.add(s);
  }
  makeLabel('① 充电：½ 储能 + ½ 焦耳热（与 R 无关）', '#fbbf24', 3.6, -2.75, 3.2, 2.2);
  makeLabel('② 断开后拉开 d：E 不变、U∝d、机械功=ΔW', '#22c55e', 3.7, 0.4, -2.95, 1.2);
  makeLabel('场体积 S·d，颜色 ∝ u=½ε0E²', '#22d3ee', 2.8, 0, 1.55, -1.3);
  makeLabel('等效立方体 棱∝∛W', '#a855f7', 2.2, 3.3, 2.05, 2.0);

  // ===== 读数面板 =====
  const CW = 900, CH = 300;
  const infoCv = document.createElement('canvas'); infoCv.width = CW; infoCv.height = CH;
  const ic = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const panel = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  panel.scale.set(8.8, 8.8 * CH / CW, 1); panel.position.set(0, 5.1, 0); panel.renderOrder = 999;
  group.add(panel);
  const est = (s2: string, sz: number): number => { let e = 0; for (const ch of s2) e += ch.charCodeAt(0) > 0x2e7f ? sz : sz * 0.56; return e; };
  const put = (y: number, color: string, text: string, size = 25, bold = false): void => {
    let s = size;
    while (est(text, s) > CW - 46 && s > 12) s -= 1;
    ic.fillStyle = color; ic.font = `${bold ? 'bold ' : ''}${s}px "PingFang SC", sans-serif`;
    ic.fillText(text, 22, y);
  };
  function drawInfo(): void {
    ic.clearRect(0, 0, CW, CH);
    ic.fillStyle = 'rgba(7,11,20,0.87)'; ic.fillRect(2, 2, CW - 4, CH - 4);
    ic.strokeStyle = '#334155'; ic.lineWidth = 3; ic.strokeRect(2, 2, CW - 4, CH - 4);
    ic.textAlign = 'left';
    put(32, '#f8fafc', 'W = ½CU² = ½QU = Q²/(2C)，能量密度 u = ½ε0E²', 26, true);
    put(62, '#22d3ee', `C=ε0S/d=${(Cnow * 1e12).toFixed(2)} pF  E=v/d=${(Enow / 1e4).toFixed(2)}×10⁴ V/m  u=${unow.toExponential(3)} J/m³  ∭u dV=${(unow * S * dNow * 1e9).toFixed(1)} nJ = W`);
    put(88, '#a855f7', `充电 v=V0(1−e^(−t/RC))，τ=RC=${(TAU * 1e9).toFixed(1)} ns；W_bat=CV0v=${(Wbat * 1e9).toFixed(1)} nJ，W_c=½Cv²=${(Wc * 1e9).toFixed(1)} nJ`);
    put(114, '#ef4444', `焦耳热 W_R=W_bat−W_c=${(Wr * 1e9).toFixed(1)} nJ（i=${(iC * 1e3).toFixed(2)} mA，P=i²R=${(iC * iC * RES).toFixed(2)} mW）⇒ 充满时恰好=½W_bat，与 R 大小无关`);
    put(140, '#22c55e', `断开后 Q=C0·v(4τ)=${(qNow * 1e9).toFixed(2)} nC 不变（理想满值 C0V0=${(QF * 1e9).toFixed(2)} nC）：E=σ/ε0 与 d 无关，U=Q/C=${Unow.toFixed(0)} V，吸引力 F=½ε0E²S=${(Fnow * 1e6).toFixed(1)} μN 恒定`);
    put(166, '#f472b6', `机械功 ∫F·dd=${(WmMech * 1e9).toFixed(1)} nJ，储能增量 ΔW=${(Wm * 1e9).toFixed(1)} nJ ⇒ 差 ${(100 * Math.abs(WmMech - Wm) / (Wm + 1e-30)).toFixed(1)}%（能量守恒：手做的功全进了场）`);
    put(192, '#94a3b8', `介质中 u'=½ε0εr(E/εr)²=u/εr（εr=4 ⇒ ${(unow / 4).toExponential(2)} J/m³），故插入介质整体储能下降、板把介质吸进去`);
    put(224, '#fbbf24', `读数：${charging ? `充电 t/RC=${(4 * uC).toFixed(2)}` : '已断开电源'}  d=${(dNow * 100).toFixed(1)} cm  v=${vC.toFixed(0)} V  i=${(iC * 1e3).toFixed(2)} mA`, 24, true);
    put(256, '#fbbf24', `读数：W_bat=${(Wbat * 1e9).toFixed(0)} nJ  W_c=${(Wc * 1e9).toFixed(0)} nJ  W_R=${(Wr * 1e9).toFixed(0)} nJ  W_m=${(Wm * 1e9).toFixed(0)} nJ`, 24, true);
    infoTex.needsUpdate = true;
  }
  energy(); drawInfo();

  const WREF = 0.5 * EPS0 * S * V0 * V0 / D0;          // d0 充满时的储能（177 nJ）作条形与立方体的标度
  const CHARGE_END = 5, CYC = 20;
  let lastD = D0;

  return {
    update(t, dt) {
      const ph = t % CYC;
      const wasCharging = charging;
      charging = ph < CHARGE_END;
      if (charging && !wasCharging) WmMech = 0;                                          // 新一轮：机械功累积清零
      uC = charging ? ph / CHARGE_END : 1;             // 0→1 对应真实 0→4τ
      dNow = charging ? D0 : D0 + 0.03 * (0.5 - 0.5 * Math.cos((ph - CHARGE_END) / (CYC - CHARGE_END) * 2 * Math.PI));
      energy();
      if (charging) { WbatF = Wbat; Wc0 = Wc; WrF = Wr; }                                 // 断开前逐帧跟踪 ⇒ 切换瞬间自然冻结
      else WmMech += Fnow * (dNow - lastD);                                               // 逐步积分 ∫F·dd
      lastD = dNow;

      const half = dNow / 2 / U2M;
      pL.position.set(-half, 0, 0); pR.position.set(half, 0, 0);
      pL.scale.set(1, 1, 1); pR.scale.set(1, 1, 1);
      fieldVol.scale.x = Math.max(0.001, 2 * half);
      fieldVol.position.set(0, 0, 0);
      wireEdge.scale.copy(fieldVol.scale);
      const frac = Math.min(1, Enow / EMAX);
      fieldMat.opacity = 0.03 + 0.45 * (unow / (0.5 * EPS0 * EMAX * EMAX));

      for (const m of dots) m.visible = false;
      const nd = Math.round(NDOT * Math.min(1, vC / V0));
      for (let i = 0; i < nd; i++) {
        const gy = ((i * 7) % 5 - 2) * 0.42, gz = ((i * 3) % 5 - 2) * 0.42;
        dots[i].visible = true; dots[i].position.set(-half - 0.06, gy, gz);
        dots[2 * NDOT - 1 - i].visible = true; dots[2 * NDOT - 1 - i].position.set(half + 0.06, gy, gz);
      }

      arrows.forEach((ar, i) => {
        const gap = 2 * half;                                  // 板间净距（世界单位）：1 cm ⇒ 0.25，4 cm ⇒ 1.0
        const hs = Math.min(1, gap * 1.05);                     // 箭头随间距缩放，d 小时也塞得进缝里
        const L = Math.max(0.004, (gap * 0.88 - 0.3 * hs) * frac);   // 杆长严格 ∝ E（frac=E/Emax），起点贴着 +x 板内侧
        ar.shaft.scale.set(1, L, 1);                             // 沿本地 Y＝世界 −x 伸缩
        ar.shaft.position.set(half - 0.07 - L / 2, ar.y, ar.z);
        ar.head.scale.setScalar(hs);
        ar.head.position.set(half - 0.07 - L - 0.15 * hs, ar.y, ar.z);
        const uFrac = Math.min(1, unow / (0.5 * EPS0 * EMAX * EMAX));
        ar.m.color.setHSL(0.34 - 0.34 * uFrac, 0.85, 0.55);
        ar.m.opacity = 0.25 + 0.7 * uFrac;
        void i;
      });

      // 开关：充电段闭合（刀片水平），断开段弹起 30°
      swBlade.rotation.z = charging ? 0 : 0.52;
      swBlade.position.set(1.5 - (charging ? 0 : 0.06), -2.28 + (charging ? 0 : 0.13), 0);
      swMat.emissiveIntensity = charging ? 0.6 : 0.1;
      resMat.emissiveIntensity = 0.15 + 3.5 * (iC * RES / V0);            // 发热 ∝ i
      batMat.emissiveIntensity = 0.25 + 0.4 * (charging ? 1 : 0.2);

      beadPos += iC / (V0 / RES) * dt * 2.4;
      beads.forEach((b, i) => {
        const p = curveAt(beadPos + (i / beads.length) * clen);
        b.position.set(p[0], p[1], 0);
        b.visible = iC > 1e-6;
      });

      const hMax = 2.0, WSCALE = 4 * WREF;             // 条形满刻度 = 708 nJ（d=4 cm 时的储能）
      [Wbat, Wc, Wr, Wm].forEach((wv, i) => {
        const h = Math.max(0.001, (wv / WSCALE) * hMax);
        bars[i].mesh.scale.set(1, h, 1);
        bars[i].mesh.position.y = 0.6 + h / 2;
        bars[i].m.emissiveIntensity = 0.25 + 1.2 * Math.min(1, wv / WREF);
      });

      const cubeF = Math.cbrt(Math.max(0.001, Wc / (4 * WREF)));   // 满储能 708 nJ ⇒ 棱长 1.3 unit（棱 ∝ ∛W）
      cube.scale.setScalar(1.3 * cubeF);
      cubeEdge.scale.setScalar(1.3 * cubeF);

      pull.position.set(half + 0.42, 0, 0);
      pullMat.opacity = 0.25 + 0.7 * Math.min(1, Fnow / (0.5 * EPS0 * EMAX * EMAX * S));
      lastD = dNow;

      plateMat.emissiveIntensity = 0.04 + 0.6 * frac;
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
