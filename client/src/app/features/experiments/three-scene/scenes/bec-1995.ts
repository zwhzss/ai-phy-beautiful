import type { SceneContext, SceneInstance } from '../types';
/**
 * 玻色–爱因斯坦凝聚（P330）：87Rb 磁阱，N=10⁶，ā=（ω⊥²ω∥)^{1/3}=2π×37.5 Hz。
 * 真实常数：ħ=1.0546e−34，k_B=1.3806e−23，m=86.909u=1.443e−25 kg，a_s=5.29 nm。
 *   kTc = ħω̄(N/ζ(3))^{1/3} ⇒ Tc=169.3 nK（ħω̄/k_B=1.80 nK）；
 *   热云 σ_i(T)=√(kT/m)/ω_i ⇒ σ̄(Tc)=17.1 µm（∝√T：T=2Tc 时 ×1.41）；
 *   凝聚体 TF：μ=kTc·(15Na_s/a_ho)^{2/5}/√2 ⇒ μ/kB=92.5 nK，R_TF=√(2μ/mω̄²)=17.9 µm；
 *   N₀/N=1−(T/Tc)³（T=0.5Tc → 0.875）；TOF：R_i(t)=R_i(0)√(1+(ω_i t)²)，τ=1/ω̄=4.24 ms → 各向异性膨胀+_aspect 反转。
 * 画面：阶段一降温 T:1.8Tc→0.25Tc（热云收缩、蓝色 TF 核心按 N₀ 揭示）；阶段二释 trap，
 *   两团云按 √(1+(ω_i t)²) 膨胀（ω⊥/ω∥=3.36 ⇒ 轴向细长翻转为横向）；地面为动量分布曲线
 *   （热高斯宽 σ_p=√(mkT)，凝聚体窄脊宽 ħ/R_TF ≈ 6% σ_p），远场 r(t)=p·t/m ⇒ 屏幕即动量谱；
 *   右侧简并度柱：n₀λ_dB³（λ_dB=h/√(2πmkT)）在 Tc 恰触 ζ(3)=1.202 满格线。
 * 数值核对（_scratch/agentC/bec.mjs）：Tc=169.3nK、μ/kB=92.5nK、R_TF=17.9µm、σ_th=17.1µm、τ=4.24ms。
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
  const starGeo = geo(new THREE.BufferGeometry());
  { const p = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) { p[i * 3] = (Math.random() - 0.5) * 400; p[i * 3 + 1] = (Math.random() - 0.5) * 400; p[i * 3 + 2] = (Math.random() - 0.5) * 400; }
    starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3)); }
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // —— 真实参数（SI），世界尺度 1 WU = 40 µm ——
  const hbar = 1.054571817e-34, kB = 1.380649e-23, mRb = 86.909 * 1.66053906660e-27;
  const N = 1e6, aHo = Math.sqrt(hbar / (mRb * 2 * PI * 37.5));   // 谐振子长度
  const fbar = 37.5, fPar = 16.7, fPer = 56.1;                     // ω/2π：轴向软，径向硬
  const wBar = TWO_PI * fbar, wPar = TWO_PI * fPar, wPer = TWO_PI * fPer;
  const z3 = 1.2020569;
  const Tc = (hbar * wBar / kB) * Math.cbrt(N / z3);               // 169.3 nK
  const mu = hbar * wBar * Math.pow(15 * N * 5.29e-9 / aHo, 0.4) / Math.SQRT2; // 化学势（全 N）
  const RTF0 = Math.sqrt(2 * mu / (mRb * wBar * wBar));            // 17.9 µm
  const ST = 1 / 40e-6, CY = 2.25;                                 // µm→世界单位；云心高度
  const sigBar = Math.sqrt(kB * Tc / (mRb * wBar * wBar));
  const sigPar0 = sigBar * wBar / wPar, sigPer0 = sigBar * wBar / wPer;   // σ_i(Tc)：38.4 / 11.4 µm

  // —— 高斯随机表（Box–Muller，种子固定）——
  let rs = 20250101;
  const rnd = () => { rs = (rs + 0x6D2B79F5) | 0; let t = Math.imul(rs ^ (rs >>> 15), 1 | rs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const GTH = 900, GCND = 520;
  const gt = new Float32Array(GTH * 3);
  for (let i = 0; i < GTH * 3; i += 2) {
    const u1 = Math.max(1e-9, rnd()), u2 = rnd(); const r = Math.sqrt(-2 * Math.log(u1));
    gt[i] = r * Math.cos(TWO_PI * u2); gt[i + 1] = r * Math.sin(TWO_PI * u2);
  }
  for (let i = 0; i < GTH; i++) gt[i * 3 + 2] = Math.sqrt(-2 * Math.log(Math.max(1e-9, rnd()))) * Math.cos(TWO_PI * rnd());
  const cdir = new Float32Array(GCND * 3);
  for (let i = 0; i < GCND; i++) {
    const z = rnd() * 2 - 1, ph = rnd() * TWO_PI, rr = Math.sqrt(1 - z * z);
    const rad = Math.cbrt(rnd());
    cdir[i * 3] = rr * Math.cos(ph) * rad; cdir[i * 3 + 1] = rr * Math.sin(ph) * rad; cdir[i * 3 + 2] = z * rad;
  }
  const shufT = new Float32Array(GTH); for (let i = 0; i < GTH; i++) shufT[i] = rnd();

  // —— 热云 Points ——
  const thGeo = geo(new THREE.BufferGeometry());
  const thPos = new Float32Array(GTH * 3);
  thGeo.setAttribute('position', new THREE.BufferAttribute(thPos, 3));
  const thCol = new Float32Array(GTH * 3);
  thGeo.setAttribute('color', new THREE.BufferAttribute(thCol, 3));
  const thPts = new THREE.Points(thGeo, mat(new THREE.PointsMaterial({ vertexColors: true, size: 0.055, transparent: true, opacity: 0.8 })));
  group.add(thPts);
  // —— 凝聚体 Points（TF 椭球，drawRange 按 N₀/N 揭示）——
  const cdGeo = geo(new THREE.BufferGeometry());
  const cdPos = new Float32Array(GCND * 3);
  cdGeo.setAttribute('position', new THREE.BufferAttribute(cdPos, 3));
  cdGeo.setDrawRange(0, 0);
  const cdPts = new THREE.Points(cdGeo, mat(new THREE.PointsMaterial({ color: 0x60a5fa, size: 0.05, transparent: true, opacity: 0.95 })));
  group.add(cdPts);
  // 凝聚体轮廓椭球
  const ellGeo = geo(new THREE.SphereGeometry(1, 20, 14));
  const ellMat = mat(new THREE.MeshBasicMaterial({ color: 0x3b82f6, wireframe: true, transparent: true, opacity: 0.24 }));
  const ell = new THREE.Mesh(ellGeo, ellMat); ell.position.set(0, CY, 0); group.add(ell);
  // 磁阱锅形（等势面 V=kTc 绕 x 轴旋转），TOF 阶段淡出
  const lathePts: import('three').Vector2[] = [];
  for (let i = 0; i <= 22; i++) { const rho = i / 22 * 0.95; lathePts.push(new THREE.Vector2(rho, 0.62 * rho * rho - 0.5)); }
  const trapGeo = geo(new THREE.LatheGeometry(lathePts, 40));
  const trapMat = mat(new THREE.MeshBasicMaterial({ color: 0xa855f7, wireframe: true, transparent: true, opacity: 0.18 }));
  const trap = new THREE.Mesh(trapGeo, trapMat);
  trap.rotation.z = PI / 2; trap.position.set(0, CY, 0); group.add(trap);
  // 轴向标记
  { const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-4.4, CY, 0, 4.4, CY, 0]), 3));
    group.add(new THREE.Line(g, mat(new THREE.LineDashedMaterial({ color: 0x475569, dashSize: 0.18, gapSize: 0.12 }))));
    const ln = group.children[group.children.length - 1] as import('three').Line;
    ln.computeLineDistances(); }

  // —— 地面动量分布曲线 ——
  const MZ0 = -2.6, MZ1 = -1.35, MH = 0.78;
  const mkGeo = geo(new THREE.BufferGeometry());
  const mkPos = new Float32Array(81 * 3);
  mkGeo.setAttribute('position', new THREE.BufferAttribute(mkPos, 3));
  group.add(new THREE.Line(mkGeo, mat(new THREE.LineBasicMaterial({ color: 0x60a5fa }))));
  const mkThGeo = geo(new THREE.BufferGeometry());
  const mkThPos = new Float32Array(81 * 3);
  mkThGeo.setAttribute('position', new THREE.BufferAttribute(mkThPos, 3));
  group.add(new THREE.Line(mkThGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee }))));
  { const g = geo(new THREE.BufferGeometry()); const p: number[] = [];
    p.push(-2.5, 0.03, MZ0, 2.5, 0.03, MZ0, 0, 0.03, MZ0, 0, 0.03, MZ1 - 0.1);
    for (let i = 0; i <= 10; i++) { const xx = -2.4 + i * 0.48; p.push(xx, 0.03, MZ0, xx, 0.03, MZ0 - 0.09); }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3));
    group.add(new THREE.LineSegments(g, mat(new THREE.LineBasicMaterial({ color: 0x334155 })))); }

  // —— 简并度计：柱高 ∝ n₀·λ_dB³/ζ(3)（λ_dB=h/√(2πmkT)）：T→Tc 恰触满格（金线）——
  const HPLANCK = TWO_PI * hbar;
  const degBar = new THREE.Mesh(geo(new THREE.BoxGeometry(0.14, 1, 0.14)), mat(new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0x9d174d, emissiveIntensity: 0.4 })));
  group.add(degBar);
  const degTick = new THREE.Mesh(geo(new THREE.BoxGeometry(0.36, 0.02, 0.36)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  degTick.position.set(4.0, 0.03 + 1.4, -1.6);   // ζ(3) 满高线（h=0.25+1.15）
  group.add(degTick);

  function makeLabel(text: string, color: string, scale: number, x: number, y: number, z: number): void {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(scale, scale / 8, 1); s.position.set(x, y, z); s.renderOrder = 998; group.add(s);
  }
  makeLabel('磁阱（ω∥<ω⊥）：蒸发冷却穿 Tc', '#c4b5fd', 3.4, 0, 3.6, 0);
  makeLabel('地面：动量分布 n(p)——热高斯 σ_p=√(mkT) 与凝聚体脊 ħ/R_TF', '#94a3b8', 4.2, 0, 0.35, -2.15);
  makeLabel('简并度计：满格金线=n₀λ_dB³=ζ(3) @Tc', '#f472b6', 3.4, 4.0, 1.75, -1.6);

  const infoCv = document.createElement('canvas'); infoCv.width = 660; infoCv.height = 260;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const info = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  info.scale.set(6.6, 2.6, 1); info.position.set(0, 4.6, 0.4); info.renderOrder = 999;
  group.add(info);

  const rd = { T: 0, frac: 0, n0: 0, tTof: 0, bPer: 1, bPar: 1, phase: 0, Dpk: 0, lamUm: 0 };
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 660, 260);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(3, 3, 654, 254);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(3, 3, 654, 254);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 23px "PingFang SC", sans-serif';
    infoCtx.fillText('BEC（1995，Cornell–Wieman–Ketterle）：87Rb，N=10⁶，f̄=37.5 Hz', 12, 28);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '18px "PingFang SC", sans-serif';
    infoCtx.fillText('kTc=ħω̄(N/ζ(3))^(1/3) ⇒ Tc=169.3nK；N₀/N=1−(T/Tc)³；σ_i=√(kT/m)/ω_i', 12, 54);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('TF：μ=kTc(15Na_s/a_ho)^{2/5}/√2 ⇒ R_TF=17.9µm；TOF R_i(t)=R_i(0)√(1+(ω_i t)²)，τ=4.24ms', 12, 78);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 19px "PingFang SC", sans-serif';
    const TnK = rd.T * 1e9;
    infoCtx.fillText(`读数：T=${TnK.toFixed(1)}nK（T/Tc=${rd.frac.toFixed(2)}）  N₀/N=${rd.n0.toFixed(3)}`, 12, 106);
    const sParA = sigPar0 * Math.sqrt(Math.max(rd.frac, 0.02)) * rd.bPar;
    infoCtx.fillText(`σ_∥(t)=${sParA.toFixed(1)}µm（√T·b）  膨胀 b⊥=${rd.bPer.toFixed(2)}  b∥=${rd.bPar.toFixed(2)}  t=${(rd.tTof * 1e3).toFixed(1)}ms=${(rd.tTof * wBar).toFixed(1)}τ`, 12, 130);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '17px "PingFang SC", sans-serif';
    const asp = (sigPar0 * rd.bPar) / (sigPer0 * rd.bPer);
    infoCtx.fillText(`长宽比 R∥/R⊥=${asp.toFixed(2)}（trap 内 ${(sigPar0 / sigPer0).toFixed(2)} → 远场翻转 = aspect inversion）`, 12, 156);
    infoCtx.fillText('远场 r(t)=p·t/m ⇒ 膨胀屏幕直接读出动量谱（窄脊=物质波相干）', 12, 180);
    infoCtx.fillStyle = '#22c55e'; infoCtx.font = '16px "PingFang SC", sans-serif';
    infoCtx.fillText(`核对：ħω̄/kB=1.80nK，T/Tc=0.5 ⇒ N₀/N=0.875，σ∝√T：2Tc 宽 ×1.41`, 12, 206);
    infoCtx.fillText(`简并度 n₀λ_dB³=${rd.Dpk.toFixed(2)}（ζ(3)=1.20 @Tc）λ_dB=${rd.lamUm.toFixed(2)}µm`, 12, 230);
    // 小插图：N₀/N 曲线 + 当前点
    infoCtx.strokeStyle = '#1e293b'; infoCtx.strokeRect(520, 92, 122, 96);
    infoCtx.strokeStyle = '#22c55e'; infoCtx.beginPath();
    for (let i = 0; i <= 24; i++) { const x = i / 24;
      const f = 1 - x * x * x;
      const px = 520 + x * 122, py = 188 - f * 92;
      if (i === 0) infoCtx.moveTo(px, py); else infoCtx.lineTo(px, py); }
    infoCtx.stroke();
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.beginPath(); infoCtx.arc(520 + Math.min(rd.frac, 1) * 122, 188 - Math.max(rd.n0, 0) * 92, 4, 0, TWO_PI); infoCtx.fill();
    infoCtx.fillStyle = '#64748b'; infoCtx.font = '12px sans-serif';
    infoCtx.fillText('N₀/N vs T/Tc', 528, 106);
    infoTex.needsUpdate = true;
  }

  const CYCLE = 17;
  drawInfo();

  return {
    update(t, dt) {
      const u = (t % CYCLE) / CYCLE;
      // 阶段：降温 u∈[0,.45]（T:1.8→0.25），hold [.45,.5]，TOF [.5,.9]（0→5τ），reset [.9,1]
      let T: number, tTof = 0, phase = 0;
      if (u < 0.45) { const s = u / 0.45; T = (1.8 - 1.55 * s) * Tc; }
      else if (u < 0.5) { T = 0.25 * Tc; }
      else if (u < 0.9) { T = 0.25 * Tc; phase = 1; tTof = ((u - 0.5) / 0.4) * (5 / wBar); }
      else { T = (0.25 + (u - 0.9) / 0.1 * 1.55) * Tc; }
      const frac = T / Tc;
      const n0f = frac < 1 ? 1 - frac * frac * frac : 0;
      const bPar = Math.sqrt(1 + Math.pow(wPar * tTof, 2)), bPer = Math.sqrt(1 + Math.pow(wPer * tTof, 2));
      rd.T = T; rd.frac = frac; rd.n0 = n0f; rd.tTof = tTof; rd.bPar = bPar; rd.bPer = bPer; rd.phase = phase;
      // 简并度计：n_pk=N/((2π)^{3/2}σ∥σ⊥²)，λ_dB=h/√(2πmkT) ⇒ D=n_pk·λ³ →ζ(3)=1.20 @Tc（柱高封顶 1.5ζ₃ 显示）
      const lamDB = HPLANCK / Math.sqrt(TWO_PI * mRb * kB * T);
      const fS = Math.sqrt(Math.max(frac, 0.015));
      const nPk = N / (Math.pow(TWO_PI, 1.5) * sigPar0 * fS * sigPer0 * fS * sigPer0 * fS);
      const Dpk = nPk * lamDB * lamDB * lamDB;
      rd.Dpk = Dpk; rd.lamUm = lamDB * 1e6;
      const dH = 0.25 + 1.15 * Math.min(1.5, Dpk / z3);
      degBar.scale.y = dH; degBar.position.set(4.0, dH / 2 + 0.03, -1.6);
      // 热云：σ_i(T)·b_i，色温由青→紫
      const sPar = sigPar0 * Math.sqrt(Math.max(frac, 0.015)) * bPar * ST;
      const sPer = sigPer0 * Math.sqrt(Math.max(frac, 0.015)) * bPer * ST;
      const jitter = Math.floor(t * 8);
      for (let i = 0; i < GTH; i++) {
        const o = i * 3;
        // 每 125ms 重抽一批（微扰 shimmer），其余保持表值×当前 σ
        const gi = ((jitter * 7 + i * 3) % (GTH * 3 - 2)) | 0;
        thPos[o] = (gt[o] * 0.8 + gt[gi] * 0.2) * sPar;
        thPos[o + 1] = (gt[o + 1] * 0.8 + gt[gi + 1] * 0.2) * sPer;
        thPos[o + 2] = (gt[o + 2] * 0.8 + gt[gi] * 0.2) * sPer;
        const sp = Math.hypot(thPos[o] / sPar, thPos[o + 1] / sPer, thPos[o + 2] / sPer) / 3.4;
        thCol[o] = 0.13 + 0.5 * sp; thCol[o + 1] = 0.83 - 0.5 * sp; thCol[o + 2] = 0.9;
      }
      thGeo.attributes['position'].needsUpdate = true;
      thGeo.attributes['color'].needsUpdate = true;
      // 凝聚体 TF：R_i = R_TF·(N₀/N)^{1/5}·b_i；drawRange=N₀/N·GCND
      const rr = n0f > 0 ? Math.pow(n0f, 0.2) : 0;
      const cPar = RTF0 * (wBar / wPar) * rr * bPar * ST, cPer = RTF0 * (wBar / wPer) * rr * bPer * ST;
      for (let i = 0; i < GCND; i++) {
        const o = i * 3;
        cdPos[o] = cdir[o] * cPar; cdPos[o + 1] = cdir[o + 1] * cPer; cdPos[o + 2] = cdir[o + 2] * cPer;
      }
      cdGeo.attributes['position'].needsUpdate = true;
      cdGeo.setDrawRange(0, Math.floor(n0f * GCND));
      ell.scale.set(cPar, cPer, cPer);
      ellMat.opacity = n0f > 0 ? 0.24 : 0;
      trapMat.opacity = phase === 0 ? 0.18 : 0;
      trap.visible = u < 0.5;
      // 动量分布：p 范围 ±3σ_p(Tc)（固定轴以热波长 √(m k Tc) 为单位）
      const sigP = Math.sqrt(mRb * kB * T), sigPc = Math.sqrt(mRb * kB * Tc);
      const sigC = hbar / Math.max(1e-12, RTF0 * rr);
      const span = 3 * sigPc * 1.05;
      for (let i = 0; i <= 80; i++) {
        const pv = -span + (i / 80) * 2 * span;
        const fTh = (1 - n0f) * Math.exp(-pv * pv / (2 * sigP * sigP));
        const fCd = n0f * Math.exp(-pv * pv / (2 * sigC * sigC)) * Math.min(1, sigP / sigC);
        const xx = pv / span * 2.4;
        mkThPos[i * 3] = xx; mkThPos[i * 3 + 1] = 0.04 + fTh * MH; mkThPos[i * 3 + 2] = MZ0 + (MZ1 - MZ0) * 0.15;
        mkPos[i * 3] = xx; mkPos[i * 3 + 1] = 0.04 + (fTh + fCd) * MH; mkPos[i * 3 + 2] = MZ0 + (MZ1 - MZ0) * 0.15;
      }
      mkThGeo.attributes['position'].needsUpdate = true;
      mkGeo.attributes['position'].needsUpdate = true;
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
    },
    dispose() {
      geos.forEach((x) => x.dispose()); mats.forEach((x) => x.dispose()); texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
