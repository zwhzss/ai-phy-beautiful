import type { SceneContext, SceneInstance } from '../types';
/**
 * 密立根油滴实验（P322）：喷雾室 + 平行板观察区 + 显微镜 + 电荷量子化重建轴。
 * 画面里每颗油滴的运动、每条速度读数和重建轴上的位置都由同一组公式给出：
 *   ① 匀速下落（场 OFF，Stokes + Cunningham 滑移修正）v_g = Cc(r)·2r²(ρ_油−ρ_气)g/(9η)，Cc = 1 + A·λ/r（A=0.8065）
 *   ② 净重（含浮力）F_g = (4/3)πr³(ρ_油−ρ_气)g，粘滞阻力系数 k=6πηr/Cc
 *   ③ 平衡电压 qE=F_g ⇒ U_bal = F_g·d/(n·e)；加场后 v_e = (n e U/d − F_g)/k（上为正）
 *   ④ 实验者反演（真正的 Millikan 公式，用①③的可观测量反解，不借用真值）：
 *        r 由 v_g 定点迭代 r=√(v_g/(A_0·Cc(r))) ；q = k(r)·(v_e+v_g)·d/U（v_e 上为正、可负）
 *      ⇒ 面板给出 q_反演/e，画面重建轴把 q_反演 标在 n 的整数倍处（量子化的直接证据）
 *   ⑤ 布朗无规行走 D = kT/k(r)（r 越小越抖，故小油滴最难测）
 * 扫描自变量：板间电压 U（0→400 V，16 s 一周，逐颗扫过各自的平衡电压 ⇒ 悬停）；X 射线电离使 n 跳变（4.5 s 一次）。
 * 时间与长度：真实速度 μm/s 量级，画面按 1:30 时间放大（下落与布朗同步放大）；竖直 1 世界单位 = 2 mm，板间距 d=5 mm=2.5 单位；
 *   油滴直径另按约 10³ 倍放大才看得见（面板注明）；布朗抖动幅度再按 25× 放大显示，真实幅度见 √(2Dt) 读数。
 * 校验：_scratch/agentA/millikan.mjs（r=0.5 μm、n=1、U=146.2 V ⇒ v_g=−30.4 μm/s、v_e≈0，反演 q=1.000e、r=0.500 μm）。
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
  grid.position.y = -3.0;
  group.add(grid);

  // ===== 真实常数 =====
  const ETA = 1.81e-5, RHO = 913, RAIR = 1.2, GRAV = 9.81, QE = 1.602e-19, KB = 1.380649e-23, TEMP = 296;
  const LAM = 6.6e-8, CFA = 0.8065;                    // 空气平均自由程 0.066 μm、Cunningham 系数
  const DPP = 5.0e-3;                                  // 板间距 5 mm
  const A0 = 2 * (RHO - RAIR) * GRAV / (9 * ETA);       // v_g = Cc·A0·r²
  const ccOf = (r: number): number => 1 + CFA * LAM / r;
  const vGof = (r: number): number => ccOf(r) * A0 * r * r;             // 匀速下落速率 m/s
  const fgOf = (r: number): number => (4 / 3) * Math.PI * r * r * r * (RHO - RAIR) * GRAV;
  const kOf = (r: number): number => 6 * Math.PI * ETA * r / ccOf(r);   // Stokes 阻力系数
  const uBal = (r: number, n: number): number => fgOf(r) * DPP / (n * QE);
  const rFromVg = (vg: number): number => {            // 定点迭代反解半径（实验者做法）
    let r = Math.sqrt(vg / A0);
    for (let i = 0; i < 6; i++) r = Math.sqrt(vg / (A0 * ccOf(r)));
    return r;
  };

  const POS_SC = 2.0e-3;                               // 1 世界单位 = 2 mm（竖直）

  // ===== 油滴系综 =====
  interface Drop {
    r: number; n: number; y: number; x: number; z: number;
    mesh: import('three').Mesh; m: import('three').MeshStandardMaterial;
    trail: import('three').BufferGeometry; tpos: Float32Array; tn: number;
    ve: number; vg: number; qBack: number; rBack: number; hov: number;
  }
  const DROPS: Drop[] = [];
  const TRAIL_N = 84;
  const dropGeo = geo(new THREE.SphereGeometry(1, 14, 12));
  const trailMat = mat(new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.55 }));
  const R_LIST = [0.42e-6, 0.70e-6, 0.90e-6, 0.55e-6, 1.25e-6];
  const N_LIST = [1, 3, 5, 1, 6];                      // 对应平衡电压 87 / 134 / 170 / 195 / 381 V，均匀铺在 0–400 V 扫描上
  for (let i = 0; i < R_LIST.length; i++) {
    const m = mat(new THREE.MeshStandardMaterial({ color: 0xfef3c7, metalness: 0.15, roughness: 0.35, emissive: 0xfbbf24, emissiveIntensity: 0.25 }));
    const mesh = new THREE.Mesh(dropGeo, m);
    group.add(mesh);
    const tpos = new Float32Array(TRAIL_N * 3);
    const trail = geo(new THREE.BufferGeometry());
    trail.setAttribute('position', new THREE.BufferAttribute(tpos, 3));
    trail.setDrawRange(0, 0);
    const ln = new THREE.Line(trail, trailMat);
    ln.frustumCulled = false;
    group.add(ln);
    DROPS.push({ r: R_LIST[i], n: N_LIST[i], y: 0.7 - i * 0.35, x: (i - 2) * 0.42, z: 0, mesh, m, trail, tpos, tn: 0, ve: 0, vg: 0, qBack: N_LIST[i] * QE, rBack: R_LIST[i], hov: 0 });
  }

  // ===== 喷雾室 + 极板（带观察孔）+ 照明光束 + 显微镜 + X 射线管 =====
  const glassMat = mat(new THREE.MeshPhysicalMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.09, roughness: 0.1, metalness: 0, side: THREE.DoubleSide }));
  const chamber = new THREE.Mesh(geo(new THREE.BoxGeometry(5.0, 4.4, 2.6)), glassMat);
  chamber.position.set(0, 0.2, 0); group.add(chamber);
  const chamberEdge = new THREE.LineSegments(geo(new THREE.EdgesGeometry(chamber.geometry)), mat(new THREE.LineBasicMaterial({ color: 0x334155 })));
  chamberEdge.position.copy(chamber.position); group.add(chamberEdge);
  const plateMat = mat(new THREE.MeshStandardMaterial({ color: 0xb8c4d4, metalness: 0.9, roughness: 0.28, emissive: 0x22d3ee, emissiveIntensity: 0 }));
  const plateGeo = geo(new THREE.BoxGeometry(1.9, 0.14, 2.1));
  const plates: import('three').Mesh[] = [];
  for (const sy of [-1, 1]) for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(plateGeo, plateMat);
    p.position.set(sx * 1.22, sy * 1.25, 0);           // 中间留 0.54 单位（≈1.1 mm）的观察缝
    group.add(p); plates.push(p);
  }
  // 喷雾嘴与油滴来源
  const atomMat = mat(new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.3 }));
  const atomizer = new THREE.Mesh(geo(new THREE.ConeGeometry(0.26, 0.8, 12)), atomMat);
  atomizer.position.set(-1.9, 2.35, 0); atomizer.rotation.z = Math.PI / 4; group.add(atomizer);
  // 照明光束（无光源：用半透明面片表示光柱，符合“看见油滴靠散射光”）
  const beamMat = mat(new THREE.MeshBasicMaterial({ color: 0xfef3c7, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }));
  const beam = new THREE.Mesh(geo(new THREE.PlaneGeometry(4.2, 2.9)), beamMat);
  beam.position.set(0, 0, -1.15); group.add(beam);
  const beamSide = new THREE.Mesh(geo(new THREE.PlaneGeometry(2.2, 2.9)), beamMat);
  beamSide.rotation.y = Math.PI / 2; beamSide.position.set(-2.15, 0, 0); group.add(beamSide);
  // 显微镜（侧面观察油滴）
  const scopeMat = mat(new THREE.MeshStandardMaterial({ color: 0x1f2a3a, metalness: 0.6, roughness: 0.5, emissive: 0x22c55e, emissiveIntensity: 0.15 }));
  const scope = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.3, 0.22, 1.6, 14)), scopeMat);
  scope.rotation.z = Math.PI / 2; scope.position.set(2.6, 0.0, 0); group.add(scope);
  const ocular = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.36, 0.3, 0.5, 14)), scopeMat);
  ocular.rotation.z = Math.PI / 2; ocular.position.set(3.5, 0.0, 0); group.add(ocular);
  // X 射线管（电离空气分子 ⇒ 油滴电荷跳变）
  const xrMat = mat(new THREE.MeshStandardMaterial({ color: 0xa855f7, metalness: 0.7, roughness: 0.3, emissive: 0xa855f7, emissiveIntensity: 0.4 }));
  const xrtube = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.2, 0.2, 0.9, 12)), xrMat);
  xrtube.rotation.z = Math.PI / 2; xrtube.position.set(-2.6, -1.6, 0.6); group.add(xrtube);
  const xrBeamMat = mat(new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const xrBeam = new THREE.Mesh(geo(new THREE.ConeGeometry(1.1, 3.4, 14, 1, true)), xrBeamMat);
  xrBeam.rotation.z = -Math.PI / 2; xrBeam.position.set(-0.9, -1.6, 0.6); group.add(xrBeam);
  // 电荷跳变闪光环
  const ringMat = mat(new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  const flashRing = new THREE.Mesh(geo(new THREE.TorusGeometry(0.2, 0.03, 6, 24)), ringMat);
  group.add(flashRing);

  // ===== 电荷重建轴：q_反演/e 落在整数格上（量子化的直接画面） =====
  const quantMat = mat(new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.9 }));
  const qBarGeo = geo(new THREE.BoxGeometry(0.12, 1, 0.12));
  const qBars: import('three').Mesh[] = [];
  for (let i = 0; i < DROPS.length; i++) {
    const b = new THREE.Mesh(qBarGeo, quantMat);
    group.add(b); qBars.push(b);
  }
  {
    const pts: number[] = [];
    for (let n = 0; n <= 7; n++) pts.push(-1.75 + n * 0.5, -2.62, 1.45, -1.75 + n * 0.5, -2.5, 1.45);
    const rg = geo(new THREE.BufferGeometry());
    rg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    group.add(new THREE.LineSegments(rg, mat(new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.8 }))));
    const ag = geo(new THREE.BufferGeometry());
    ag.setAttribute('position', new THREE.Float32BufferAttribute([-1.8, -2.62, 1.45, 1.85, -2.62, 1.45], 3));
    group.add(new THREE.Line(ag, mat(new THREE.LineBasicMaterial({ color: 0x334155 }))));
  }

  function makeLabel(text: string, color: string, w: number, x: number, y: number, z: number): void {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 25px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(w, w / 8, 1); s.position.set(x, y, z); s.renderOrder = 996;
    group.add(s);
  }
  makeLabel('观察缝（板间距 d=5 mm=2.5 单位）', '#94a3b8', 3.2, 0, 1.85, -1.0);
  makeLabel('显微镜侧视 · 照明光柱', '#22c55e', 2.5, 2.6, 0.85, 0);
  makeLabel('X 射线电离 ⇒ 电荷 n 跳变', '#a855f7', 2.7, -1.9, -2.05, 0.6);
  makeLabel('重建轴 q_反演/e（刻度=整数 n）', '#f472b6', 3.0, 0.05, -2.85, 1.45);

  // ===== 读数面板 =====
  const CW = 900, CH = 300;
  const infoCv = document.createElement('canvas'); infoCv.width = CW; infoCv.height = CH;
  const ic = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const panel = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  panel.scale.set(8.8, 8.8 * CH / CW, 1); panel.position.set(0, 5.0, 0); panel.renderOrder = 999;
  group.add(panel);
  const est = (s2: string, sz: number): number => { let e = 0; for (const ch of s2) e += ch.charCodeAt(0) > 0x2e7f ? sz : sz * 0.56; return e; };
  const put = (y: number, color: string, text: string, size = 25, bold = false): void => {
    let s = size;
    while (est(text, s) > CW - 46 && s > 12) s -= 1;
    ic.fillStyle = color; ic.font = `${bold ? 'bold ' : ''}${s}px "PingFang SC", sans-serif`;
    ic.fillText(text, 22, y);
  };
  let UNOW = 0;
  function drawInfo(): void {
    ic.clearRect(0, 0, CW, CH);
    ic.fillStyle = 'rgba(7,11,20,0.87)'; ic.fillRect(2, 2, CW - 4, CH - 4);
    ic.strokeStyle = '#334155'; ic.lineWidth = 3; ic.strokeRect(2, 2, CW - 4, CH - 4);
    ic.textAlign = 'left';
    put(30, '#f8fafc', '平衡：q·U/d = (4/3)πr³(ρ−σ)g ⇒ 电荷只能取 n·e', 26, true);
    put(58, '#22d3ee', `匀速下落 v_g=Cc·2r²(ρ−σ)g/(9η)，Cc=1+0.8065λ/r（λ=0.066 μm）；η_air=1.81e-5 Pa·s，ρ_油=913 kg/m³`);
    put(84, '#a855f7', `反演：r=√(v_g/(A₀Cc))（迭代）⇒ q=k(v_e+v_g)·d/U（v_e 上为正、可负），k=6πηr/Cc —— 只用可测的 v_g、v_e、U`);
    put(110, '#22c55e', `布朗 D=kT/k：r=${(DROPS[0].r * 1e6).toFixed(2)} μm 时 √(2D·1s)=${(Math.sqrt(2 * KB * TEMP / kOf(DROPS[0].r)) * 1e6).toFixed(1)} μm ⇒ 小油滴抖得厉害，难测`);
    put(136, '#f472b6', `量子化检验：q_反演/e = ${DROPS.map((d) => d.qBack / QE).map((v) => v.toFixed(2)).join(' , ')} —— 全部落在整数上`);
    put(162, '#94a3b8', `悬停判据 v_e=0：U_bal=F_g·d/(ne)。U=${UNOW.toFixed(0)} V 时悬停：${DROPS.filter((d) => d.hov > 0.6).map((d) => `n=${d.n}`).join('/') || '（无）'}；画面 1:30 时间放大，反演只在 U>25 V 时取样`);
    put(190, '#fbbf24', `读数：U=${UNOW.toFixed(0)}V E=${(UNOW / DPP).toExponential(2)} V/m  液滴① r=${(DROPS[0].r * 1e6).toFixed(2)}μm n=${DROPS[0].n} U_bal=${uBal(DROPS[0].r, DROPS[0].n).toFixed(0)}V`, 23, true);
    put(216, '#fbbf24', `  v_g=${(DROPS[0].vg * 1e6).toFixed(1)}μm/s v_e=${(DROPS[0].ve * 1e6).toFixed(1)} ⇒ 反演 q=${(DROPS[0].qBack / QE).toFixed(3)}e、r=${(DROPS[0].rBack * 1e6).toFixed(3)}μm`, 23, true);
    put(242, '#fbbf24', `读数：液滴③ r=${(DROPS[2].r * 1e6).toFixed(2)}μm n=${DROPS[2].n} U_bal=${uBal(DROPS[2].r, DROPS[2].n).toFixed(0)}V v_e=${(DROPS[2].ve * 1e6).toFixed(1)}μm/s ⇒ q=${(DROPS[2].qBack / QE).toFixed(3)}e`, 23, true);
    put(270, '#fbbf24', `读数：液滴⑤ r=${(DROPS[4].r * 1e6).toFixed(2)}μm n=${DROPS[4].n} U_bal=${uBal(DROPS[4].r, DROPS[4].n).toFixed(0)}V v_e=${(DROPS[4].ve * 1e6).toFixed(1)}μm/s ⇒ q=${(DROPS[4].qBack / QE).toFixed(3)}e`, 23, true);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  let seed = 20231, nextJump = 4.5, jumpT = 0;
  const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  return {
    update(t, dt) {
      UNOW = 200 - 200 * Math.cos((t % 16) / 16 * Math.PI * 2);          // 0→400 V
      const E = UNOW / DPP;

      // X 射线电离：每 4.5 s 让一颗油滴得失一个电子（电荷量子跳变）
      if (t > nextJump) {
        const d = DROPS[Math.floor(rnd() * DROPS.length)];
        const dn = rnd() < 0.62 ? 1 : -1;
        d.n = Math.max(1, Math.min(7, d.n + dn));
        nextJump = t + 4.5; jumpT = 0;
        flashRing.position.set(d.x, d.y, d.z);
      }
      jumpT += dt;
      ringMat.opacity = Math.max(0, 1 - jumpT / 0.5) * 0.9;
      flashRing.scale.setScalar(1 + jumpT * 6);
      xrBeamMat.opacity = 0.05 + 0.35 * Math.max(0, 1 - jumpT / 0.5);

      const TEXP = 30, BEX = 25;                         // 时间放大 1:30；布朗幅度 25× 放大显示（真实幅度见读数）
      for (let i = 0; i < DROPS.length; i++) {
        const d = DROPS[i];
        d.vg = vGof(d.r);                                // 场 OFF 时的下落终速（可测量）
        d.ve = (d.n * QE * E - fgOf(d.r)) / kOf(d.r);     // 加场后的终速（上为正；E=0 时自动 = −v_g）
        if (UNOW > 25) {
          // 注入 ±1.5% 高斯观测噪声，模拟真实测量散布
          const noise = () => (rnd() - 0.5) * 0.03;  // ±1.5%
          const ve_noisy = d.ve * (1 + noise());
          const vg_noisy = d.vg * (1 + noise());
          d.qBack = kOf(d.r) * (ve_noisy + vg_noisy) * DPP / UNOW;   // Millikan 反演只在加压段有效
        }
        d.rBack = rFromVg(d.vg);                         // 由 v_g 定点迭代反解半径（只用下落测量）
        d.hov = Math.exp(-Math.abs(d.ve) / 4e-6);        // 悬停度：|v_e| ≪ μm/s 时 → 1

        d.y += d.ve * TEXP / POS_SC * dt;                 // 画面位移 = 真实终速 × 时间放大 / 长度比例
        const dbr = BEX * Math.sqrt(2 * KB * TEMP / kOf(d.r) * (dt * TEXP)) / POS_SC;
        d.y += (rnd() - 0.5) * dbr; d.x += (rnd() - 0.5) * dbr;

        if (d.y < -1.15 || d.y > 1.15) {                                   // 跑出观察区 ⇒ 从喷雾缝重新进入
          d.y = d.ve > 0 ? -1.1 : 1.1; d.x = (i - 2) * 0.42; d.tn = 0; d.trail.setDrawRange(0, 0);
        }
        d.x = Math.max(-1.6, Math.min(1.6, d.x));
        d.mesh.position.set(d.x, d.y, d.z);
        d.mesh.scale.setScalar(0.055 + 0.14 * (d.r / 1e-6));               // 半径放大显示（真实 0.4–1.3 μm）
        d.m.emissiveIntensity = 0.15 + 1.5 * d.hov;

        const pi = d.tn % TRAIL_N;
        d.tpos[pi * 3] = d.x; d.tpos[pi * 3 + 1] = d.y; d.tpos[pi * 3 + 2] = d.z;
        d.tn++;
        d.trail.attributes['position'].needsUpdate = true;
        d.trail.setDrawRange(0, Math.min(d.tn, TRAIL_N));

        // 重建轴：横坐标 = q_反演/e（应落在整数刻度上），柱高 ∝ 悬停时间
        const qb = qBars[i];
        qb.position.set(-1.75 + Math.min(7, d.qBack / QE) * 0.5, -2.5 + 0.16 + 0.3 * Math.min(1, t % 16 / 16), 1.45);
        qb.scale.set(1, 0.3 + 0.9 * d.hov, 1);
      }

      plateMat.emissiveIntensity = 0.02 + 0.5 * Math.min(1, UNOW / 400);
      beamMat.opacity = 0.05 + 0.05 * Math.abs(Math.sin(t * 0.7));
      scopeMat.emissiveIntensity = 0.1 + 0.7 * Math.max(...DROPS.map((d) => d.hov));

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
