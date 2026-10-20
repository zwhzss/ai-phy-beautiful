import type { SceneContext, SceneInstance } from '../types';
/**
 * 感应圈与高压火花（P305）：鲁姆科夫（Ruhmkorff）感应圈三维模型——铁丝束铁芯、初级、密绕次级、振动子断电、火花隙击穿。
 * 主控方程（几何与面板同源，都由 τ、d 两个扫描量算出）：
 *   ① 磁路：Rm = l_c/(μ0·μr·A) ⇒ L1 = N1²/Rm，L2 = N2²/Rm，M = N1N2/Rm
 *   ② 工作点：Φ = L1·I1/N1，B = Φ/A（铁芯用细铁丝束 ⇒ 有效 μr 只 ~500，但涡流被绝缘丝切断）
 *   ③ 断电瞬态：|ε2| = N2·ΔΦ/τ（ΔΦ = Φ−Φ_r，剩磁 Φ_r = 0.15Φ）；ε2/ε1 = N2/N1（同一 dΦ/dt ⇒ 初级也出高压尖峰，触点打火）
 *   ④ 击穿条件：ε2 ≥ E_break·d，E_break ≈ 3 kV/mm ⇒ 可拉间隙 d_max = ε2/E_break
 *   ⑤ 能量：W = ½L1I1² 每次断开放出 ⇒ P = W·(真实断电频率 35 s⁻¹)；合闸侧 τ_L = L1/R ≫ τ ⇒ 只有断电才出高压
 *   ⑥ 电弧等效 L2 与分布电容 C2 并联 ⇒ 阻尼振荡 f = 1/(2π√(L2C2))，特征阻抗 √(L2/C2)
 * 扫描自变量：断电时间 τ（25→120 μs，16 s）、电极间距 d（6→26 mm，12 s）。振动子画面 4 s 一次（真实 ~35 次/秒 ⇒ 慢放 1.4×10²）。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  const MU0 = 4 * Math.PI * 1e-7, S = 0.1, TWO_PI = Math.PI * 2;   // 1 世界单位 = 10 cm
  // —— 真实器件参数（_scratch/agentA/induction.mjs 校核） ——
  const N1 = 150, N2 = 15000, A_CORE = 2.0e-4, LC = 0.25, MUR = 500;
  const Rm = LC / (MU0 * MUR * A_CORE);
  const L1 = (N1 * N1) / Rm, L2 = (N2 * N2) / Rm, Mmut = (N1 * N2) / Rm;
  const U1 = 24, R_CIR = 6, I1SS = U1 / R_CIR;                     // I∞ = 4 A，τ_L = 1.89 ms
  const PHI = (L1 * I1SS) / N1, BMAX = PHI / A_CORE, REM = 0.15;
  const DPHI = PHI * (1 - REM);
  const E_BREAK = 3.0e6, RATE = 35, C2 = 2.0e-11;
  const T_BREAK = 4, SLOMO = 1.4e2;
  const YH = new THREE.Vector3(0, 1, 0), XH = new THREE.Vector3(1, 0, 0);

  // ===== 星野 + 网格 =====
  const starGeo = geo(new THREE.BufferGeometry());
  {
    const q = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) { q[i * 3] = (Math.random() - 0.5) * 200; q[i * 3 + 1] = (Math.random() - 0.5) * 200; q[i * 3 + 2] = (Math.random() - 0.5) * 200; }
    starGeo.setAttribute('position', new THREE.BufferAttribute(q, 3));
  }
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  grid.position.y = -2.4;
  group.add(grid);

  // ===== 铁丝束铁芯（沿 x，长 3.2 单位 = 32 cm） =====
  const CORE_Y = 0.35;
  const wireGeo = geo(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 7));
  const wireMat = mat(new THREE.MeshStandardMaterial({ color: 0x8b98a8, metalness: 0.75, roughness: 0.45, emissive: 0x22d3ee, emissiveIntensity: 0.05 }));
  for (let i = 0; i < 13; i++) {
    const a = (i / 12) * TWO_PI, rr = i === 0 ? 0 : 0.15;
    const w = new THREE.Mesh(wireGeo, wireMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(0, CORE_Y + rr * Math.sin(a), rr * Math.cos(a));
    group.add(w);
  }
  const capGeo = geo(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 16));
  const capMat = mat(new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.6 }));
  for (const sx of [-1.6, 1.6]) {
    const c = new THREE.Mesh(capGeo, capMat);
    c.rotation.z = Math.PI / 2; c.position.set(sx, CORE_Y, 0);
    group.add(c);
  }

  // ===== 初级（粗线疏绕）+ 次级（密绕）+ 骨架 =====
  const pTurnGeo = geo(new THREE.TorusGeometry(0.34, 0.05, 8, 26));
  const pMat = mat(new THREE.MeshStandardMaterial({ color: 0xc9762b, metalness: 0.8, roughness: 0.35, emissive: 0xfbbf24, emissiveIntensity: 0.1 }));
  for (let i = 0; i < 9; i++) {
    const t = new THREE.Mesh(pTurnGeo, pMat);
    t.rotation.y = Math.PI / 2; t.position.set(-1.1 + i * 0.27, CORE_Y, 0);
    group.add(t);
  }
  const sTurnGeo = geo(new THREE.TorusGeometry(0.52, 0.022, 6, 22));
  const sMat = mat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, metalness: 0.6, roughness: 0.4, emissive: 0x22d3ee, emissiveIntensity: 0.12 }));
  const sTurns: import('three').Mesh[] = [];
  for (let i = 0; i < 34; i++) {
    const t = new THREE.Mesh(sTurnGeo, sMat);
    t.rotation.y = Math.PI / 2; t.position.set(-1.24 + i * 0.076, CORE_Y, 0);
    group.add(t); sTurns.push(t);
  }
  const spool = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.62, 0.62, 2.7, 20, 1, true)), mat(new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.2, roughness: 0.85, side: THREE.DoubleSide, transparent: true, opacity: 0.42 })));
  spool.rotation.z = Math.PI / 2; spool.position.set(0, CORE_Y, 0);
  group.add(spool);

  // ===== 磁通：芯内轴向箭头 + 上下漏磁椭圆回路（断电时漏磁剪切次级） =====
  const coneGeo = geo(new THREE.ConeGeometry(0.075, 0.26, 8));
  const fluxMat = mat(new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.9 }));
  const flux: import('three').Mesh[] = [];
  for (let i = 0; i < 11; i++) { const m = new THREE.Mesh(coneGeo, fluxMat); group.add(m); flux.push(m); }
  const leakMat = mat(new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.7 }));
  const leak: import('three').Mesh[] = [];
  for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(coneGeo, leakMat); group.add(m); leak.push(m); }

  // ===== 振动子：电磁铁吸合 / 弹片弹起断电 =====
  const reedGroup = new THREE.Group();
  reedGroup.position.set(-2.05, 1.4, 0);
  group.add(reedGroup);
  const reedMat = mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.3 }));
  const reed = new THREE.Mesh(geo(new THREE.BoxGeometry(0.9, 0.08, 0.16)), reedMat);
  reed.position.set(0.45, 0, 0);
  reedGroup.add(reed);
  reedGroup.add(new THREE.Mesh(geo(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 10)), reedMat)).position.set(0, -0.75, 0);
  const contactMat = mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.25, emissive: 0xfbbf24, emissiveIntensity: 0.2 }));
  const contact = new THREE.Mesh(geo(new THREE.SphereGeometry(0.085, 12, 12)), contactMat);
  contact.position.set(0.9, -0.14, 0);
  reedGroup.add(contact);
  reedGroup.add(new THREE.Mesh(geo(new THREE.CylinderGeometry(0.14, 0.11, 0.16, 14)), mat(new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.95, roughness: 0.15 })))).position.set(0.9, -0.36, 0);
  const reedSparkMat = mat(new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0 }));
  const reedSpark = new THREE.Mesh(geo(new THREE.SphereGeometry(0.11, 10, 10)), reedSparkMat);
  reedSpark.position.set(0.9, -0.02, 0);
  reedGroup.add(reedSpark);
  // 次级引出线 → 电极
  const leadPts: number[] = [];
  {
    const raw: [number, number][] = [[1.24, CORE_Y + 0.52], [1.6, 1.5], [2.05, GAP_Y0()]];
    for (let i = 0; i < raw.length - 1; i++) for (let k = 0; k <= 10; k++) { const f = k / 10; leadPts.push(raw[i][0] + (raw[i + 1][0] - raw[i][0]) * f, raw[i][1] + (raw[i + 1][1] - raw[i][1]) * f, 0); }
  }
  function GAP_Y0(): number { return 2.05; }
  const leadGeo = geo(new THREE.BufferGeometry());
  leadGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(leadPts), 3));
  leadGeo.setDrawRange(0, leadPts.length / 3);
  group.add(new THREE.Line(leadGeo, mat(new THREE.LineBasicMaterial({ color: 0xc9762b }))));

  // ===== 火花隙：两电极球（表面间距 = 真实 d），锯齿电弧 =====
  const GAP_X = 2.35, GAP_Y = 2.05, BALL_R = 0.12;
  const ballGeo = geo(new THREE.SphereGeometry(BALL_R, 16, 16));
  const ballMat = mat(new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.9, roughness: 0.28, emissive: 0xfbbf24, emissiveIntensity: 0.1 }));
  const ballA = new THREE.Mesh(ballGeo, ballMat), ballB = new THREE.Mesh(ballGeo, ballMat);
  group.add(ballA, ballB);
  const ARC_N = 46;
  const arcGeo = geo(new THREE.BufferGeometry());
  const arcPos = new Float32Array(ARC_N * 3);
  arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPos, 3));
  arcGeo.setDrawRange(0, 0);
  const arcMat = mat(new THREE.LineBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.95 }));
  group.add(new THREE.Line(arcGeo, arcMat));
  const haloMat = mat(new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0 }));
  const halo = new THREE.Mesh(geo(new THREE.SphereGeometry(0.26, 14, 14)), haloMat);
  group.add(halo);

  // ===== 标签 =====
  function label(text: string, color: string, x: number, y: number, z: number, w = 2.4): void {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 24px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(w, w / 8, 1); s.position.set(x, y, z); s.renderOrder = 997;
    group.add(s);
  }
  label('铁丝束铁芯：涡流被绝缘丝切断', '#8b98a8', 0, CORE_Y - 1.05, 0, 2.7);
  label('初级 N1=150 匝', '#fbbf24', -0.75, CORE_Y - 1.5, 0.5, 1.9);
  label('次级 N2=15000 匝密绕', '#22d3ee', 0.55, 1.32, 0.5, 2.2);
  label('振动子（真实 ~35 次/秒）', '#94a3b8', -1.95, 2.42, 0, 2.3);
  label('火花隙 d：ε2≥3 kV/mm·d 才击穿', '#f8fafc', 2.4, 2.72, 0, 2.8);

  // ===== 面板 =====
  const CW = 900, CH = 300;
  const infoCv = document.createElement('canvas'); infoCv.width = CW; infoCv.height = CH;
  const ic = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const panel = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  panel.scale.set(8.8, (8.8 * CH) / CW, 1); panel.position.set(0, 4.35, 0); panel.renderOrder = 999;
  group.add(panel);
  const est = (s2: string, px: number): number => { let e = 0; for (const ch of s2) e += ch.charCodeAt(0) > 0x2e7f ? px : px * 0.56; return e; };
  const put = (y: number, color: string, text: string, size = 24, bold = false): void => {
    let s = size;
    while (est(text, s) > CW - 44 && s > 11) s -= 1;
    ic.fillStyle = color; ic.font = `${bold ? 'bold ' : ''}${s}px "PingFang SC", sans-serif`;
    ic.fillText(text, 20, y);
  };
  let tau = 6e-5, gap = 0.016, e2 = 0, e1 = 0, iNow = I1SS, phiNow = PHI, brk = false, arcOn = 0, collapsing = false;
  const fRing = 1 / (TWO_PI * Math.sqrt(L2 * C2));
  function drawInfo(): void {
    ic.clearRect(0, 0, CW, CH);
    ic.fillStyle = 'rgba(7,11,20,0.86)'; ic.fillRect(2, 2, CW - 4, CH - 4);
    ic.strokeStyle = '#334155'; ic.lineWidth = 3; ic.strokeRect(2, 2, CW - 4, CH - 4);
    ic.textAlign = 'left';
    put(30, '#f8fafc', '断电高压：|ε2| = N2·ΔΦ/τ，ε2/ε1 = N2/N1', 25, true);
    put(58, '#22d3ee', `磁路 Rm=${(Rm / 1e6).toFixed(3)} MA/Wb ⇒ L1=${(L1 * 1e3).toFixed(2)} mH  L2=${L2.toFixed(1)} H  M=${Mmut.toFixed(2)} H`);
    put(84, '#a855f7', `工作点 Φ=L1I1/N1=${(PHI * 1e3).toFixed(3)} mWb  B=Φ/A=${BMAX.toFixed(3)} T  剩磁 ${REM}·Φ ⇒ ΔΦ=${(DPHI * 1e3).toFixed(3)} mWb`);
    put(111, '#22c55e', `储能 W=½L1I1²=${(0.5 * L1 * I1SS * I1SS * 1e3).toFixed(1)} mJ ⇒ P=W×${RATE}/s=${(0.5 * L1 * I1SS * I1SS * RATE).toFixed(2)} W  合闸 τ_L=${(L1 / R_CIR * 1e3).toFixed(2)} ms`);
    put(138, '#f472b6', `匝比 N2/N1=${(N2 / N1).toFixed(0)} ⇒ 同一 dΦ/dt 下次级电压是初级的 ${(N2 / N1).toFixed(0)} 倍；触点处只看到 ${Math.round(e1)} V 自感尖峰打火`);
    put(165, '#22d3ee', `电弧= L2 与 C2=${(C2 * 1e12).toFixed(0)} pF 并联 ⇒ f=1/(2π√(L2C2))=${(fRing / 1e3).toFixed(2)} kHz  √(L2/C2)=${(Math.sqrt(L2 / C2) / 1e6).toFixed(2)} MΩ`);
    put(192, '#94a3b8', `慢放说明：振动子画面 ${T_BREAK} s 一次（真实 ${RATE} 次/秒），断电塌缩 ×${SLOMO.toFixed(0)} 放大；面板数值一律用真实 τ、d`);
    put(226, '#fbbf24', `读数：τ=${(tau * 1e6).toFixed(1)} μs  d=${(gap * 1000).toFixed(0)} mm  |ε2|=${(e2 / 1e3).toFixed(1)} kV  ε1=${e1.toFixed(0)} V`, 23, true);
    put(254, '#fbbf24', `读数：可拉火花 d_max=${(e2 / E_BREAK * 1000).toFixed(1)} mm ⇒ 当前间隙${brk ? '已击穿，电弧燃烧中' : '未击穿（ε2 < E_break·d）'}`, 23, true);
    put(282, '#94a3b8', `读数：I1=${iNow.toFixed(2)} A  Φ=${(phiNow * 1e3).toFixed(3)} mWb  B=${(phiNow / A_CORE).toFixed(3)} T  电弧亮度=${(arcOn * 100).toFixed(0)}%  ${collapsing ? '断电中' : '闭合储能中'}`, 22);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  let seed = 7;
  const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
  return {
    update(t, dt) {
      // 自变量：断电时间 τ（25→120 μs / 16 s）、电极间距 d（6→26 mm / 12 s）
      tau = 7.25e-5 - 4.75e-5 * Math.cos((t % 16) / 16 * TWO_PI);
      gap = 0.016 - 0.01 * Math.cos((t % 12) / 12 * TWO_PI);
      e2 = N2 * DPHI / tau;
      e1 = N1 * DPHI / tau;
      brk = e2 >= E_BREAK * gap;

      const p = (t % T_BREAK) / T_BREAK;
      const tCol = tau * SLOMO;                       // 画面上的塌缩时长（秒）
      const pCol = tCol / T_BREAK;
      collapsing = p >= 0.5 && p < 0.5 + pCol;
      let frac: number;
      if (p < 0.5) {
        const tp = (p / 0.5) * 2 * L1 / R_CIR * 60;   // 画面 2 s 走完 ~60 个 τ_L ⇒ 升到 I∞
        iNow = I1SS * (1 - Math.exp(-tp / (L1 / R_CIR)));
        frac = iNow / I1SS; arcOn = 0;
      } else if (collapsing) {
        const q = (p - 0.5) / pCol;
        frac = 1 - (1 - REM) * q; iNow = I1SS * frac; arcOn = brk ? 1 : 0;
      } else {
        const ta = (p - 0.5 - pCol) * T_BREAK;
        frac = REM; iNow = 0;
        arcOn = brk ? Math.max(0, Math.exp(-ta / (tCol * 5)) * (0.55 + 0.45 * Math.cos(TWO_PI * (fRing / SLOMO) * ta))) : 0;
      }
      phiNow = PHI * frac;
      const rate = collapsing ? DPHI / tCol : 0;      // 画面 dΦ/dt
      const rateReal = collapsing ? DPHI / tau : 0;   // 真实 dΦ/dt（面板 ε2 用它）

      // 芯内磁通箭头：沿 +x 流动，长度/亮度 ∝ Φ
      for (let i = 0; i < flux.length; i++) {
        const x = -1.5 + (i / (flux.length - 1)) * 3.0;
        flux[i].position.set(x, CORE_Y, 0);
        flux[i].quaternion.setFromUnitVectors(YH, XH);
        flux[i].scale.setScalar(0.3 + 1.4 * frac);
      }
      fluxMat.opacity = 0.15 + 0.8 * frac;
      // 漏磁：上下两条椭圆回路，断电时塌缩最快 ⇒ 剪切次级（紫箭头炸开）
      for (let i = 0; i < leak.length; i++) {
        const side = i < 7 ? 1 : -1, u = (i % 7) / 6;
        const th = side > 0 ? u * Math.PI : Math.PI + u * Math.PI;
        const rx = 1.45, ry = 0.62;
        leak[i].position.set(rx * Math.cos(th), CORE_Y + ry * Math.sin(th), 0);
        const tg = new THREE.Vector3(-rx * Math.sin(th), ry * Math.cos(th), 0).normalize();
        leak[i].quaternion.setFromUnitVectors(YH, tg);
        leak[i].scale.setScalar(0.25 + 1.1 * frac + 0.5 * (rateReal / (DPHI / 2.5e-5)) * (side < 0 ? 1 : 1));
      }
      leakMat.opacity = 0.12 + 0.7 * Math.min(1, frac + rateReal / 12);

      // 绕组：初级随 I1 发光；次级整串随 |dΦ/dt| 爆闪
      pMat.emissiveIntensity = 0.06 + 1.3 * (iNow / I1SS);
      sMat.emissiveIntensity = 0.1 + 3.4 * Math.min(1, rateReal / 10);
      for (let i = 0; i < sTurns.length; i++) {
        sTurns[i].scale.setScalar(1 + 0.06 * Math.min(1, rateReal / 10) * Math.sin(TWO_PI * (i / sTurns.length) * 6 - t * 9));
      }
      wireMat.emissiveIntensity = 0.03 + 0.55 * frac;

      // 振动子：闭合吸下（通电）／断电弹起 + 触点自感尖峰打火
      const closed = p < 0.5;
      reed.position.y = (closed ? -0.09 : 0.07) + (closed ? 0 : 0.03 * Math.sin(t * 30));
      reed.rotation.z = closed ? -0.05 : 0.06;
      contactMat.emissiveIntensity = closed ? 0.8 : 0.05;
      reedSparkMat.opacity = collapsing ? 0.85 * Math.min(1, e1 / 700) : 0;

      // 电极球：表面间距 = 真实 d（1 单位=10 cm ⇒ d/S 世界长度）
      const sep = 2 * BALL_R + gap / S;
      ballA.position.set(GAP_X - sep / 2, GAP_Y, 0);
      ballB.position.set(GAP_X + sep / 2, GAP_Y, 0);
      ballMat.emissiveIntensity = 0.1 + 1.6 * arcOn;
      if (arcOn > 0.02) {
        const x0 = GAP_X - sep / 2 + BALL_R, x1 = GAP_X + sep / 2 - BALL_R;
        for (let i = 0; i < ARC_N; i++) {
          const u = i / (ARC_N - 1), jit = Math.sin(u * Math.PI);
          const edge = i === 0 || i === ARC_N - 1 ? 0 : 1;
          arcPos[i * 3] = x0 + (x1 - x0) * u;
          arcPos[i * 3 + 1] = GAP_Y + jit * (0.03 + 0.13 * Math.abs(rnd())) * edge;
          arcPos[i * 3 + 2] = jit * (0.03 + 0.11 * Math.abs(rnd())) * edge;
        }
        arcGeo.attributes['position'].needsUpdate = true;
        arcGeo.setDrawRange(0, ARC_N);
        arcMat.opacity = 0.45 + 0.55 * arcOn;
        haloMat.opacity = 0.3 * arcOn;
        halo.position.set(GAP_X, GAP_Y, 0);
        halo.scale.setScalar(0.5 + 1.5 * arcOn + sep);
      } else {
        arcGeo.setDrawRange(0, 0);
        haloMat.opacity = 0;
      }
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
