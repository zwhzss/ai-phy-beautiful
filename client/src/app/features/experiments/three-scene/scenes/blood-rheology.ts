import type { SceneContext, SceneInstance } from '../types';
/**
 * 血液流变与法–朗效应（P337）—— 主控方程（Fåhræus–Lindqvist，几何驱动版）：
 *   无细胞血浆层  δ = δ₀·(H_D/0.4)·(1 − e^(−D/40))       （近壁贫细胞层）
 *   管中压积(Fåhræus)  H_T = H_D·((R−δ)/R)²                （红细胞向轴心迁移）
 *   核心黏度  η_core = η_p·(1 + 2.5·H_T + 7.35·H_T²)
 *   表观黏度  η_app/η_p = η_core·((R−δ)/R)⁴ + c·H_D·max(0, 8−D)²  （管越细越稀，<8µm 膜变形反弹）
 *   剪切变稀  η(γ̇)/η_p = η∞ + (η0−η∞)/(1+(γ̇/γ̇c)^m)  （Cross 本构：低剪切钱串→η↑，高剪切散开→η↓）
 * 管径 D 越小 → 血浆层占比越大 → 有效管腔 (R−δ)/R 越小 → 表观黏度随管径下降（法–朗管径效应，非剪切变稀；
 * 二者机理不同，故本场景分别画出：η(D)、H_T(D) 随直径扫描，η(γ̇) 随剪切率扫描）。
 * 扫描自变量：血管直径 D（4→300 µm，周期 18 s）与剪切率 γ̇（0.1→1000 s⁻¹，周期 11 s，对数往返）；
 * 管腔、贫细胞壳、红细胞核心、缗钱聚集⇌散开与面板三条曲线/读数全部同源。
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

  const starGeo = geo(new THREE.BufferGeometry());
  const starPos = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 200;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  grid.position.y = -3.4; group.add(grid);

  // —— 流变学常数 ——
  const H_D = 0.40;          // 供体（大血管）压积
  const DELTA0 = 1.15;       // µm，饱和血浆层厚度
  function model(D: number) {
    const R = D / 2;
    const delta = DELTA0 * (H_D / 0.4) * (1 - Math.exp(-D / 40));
    const coreFrac = Math.max(0.05, (R - delta) / R);       // (R−δ)/R
    const H_T = H_D * coreFrac * coreFrac;                    // Fåhræus
    const etaCore = 1 + 2.5 * H_T + 7.35 * H_T * H_T;         // 相对血浆
    const def = 0.06 * H_D * Math.pow(Math.max(0, 8 - D), 2);
    const etaApp = etaCore * Math.pow(coreFrac, 4) + def;
    return { R, delta, coreFrac, H_T, etaApp };
  }

  // —— 剪切变稀 η(γ̇)：Cross 型本构，红细胞低剪切叠成钱串（η→η0），高剪切散开取向（η→η∞） ——
  //   η(γ̇)/η_p = η∞ + (η0−η∞)/(1+(γ̇/γ̇c)^m)，γ̇→0 时 8.6×，γ̇→∞ 时 3.5×，随剪切率单调下降。
  const ETA0 = 9.0, ETA_INF = 3.5, GC = 1.0, M_EXP = 1.1;
  const shearEta = (g: number): number => ETA_INF + (ETA0 - ETA_INF) / (1 + Math.pow(g / GC, M_EXP));

  // —— 主管（直径随 D 变化）：壁壳 + 贫细胞血浆壳 + 红细胞核心 ——
  const AX_LEN = 8;
  const tubeGroup = new THREE.Group(); tubeGroup.rotation.z = -Math.PI / 2; group.add(tubeGroup);
  const wallGeo = geo(new THREE.CylinderGeometry(1, 1, AX_LEN, 28, 1, true));
  const wallMat = mat(new THREE.MeshStandardMaterial({ color: 0xf87171, transparent: true, opacity: 0.22, roughness: 0.6, side: THREE.DoubleSide }));
  const wall = new THREE.Mesh(wallGeo, wallMat); tubeGroup.add(wall);
  const plasmaGeo = geo(new THREE.CylinderGeometry(1, 1, AX_LEN, 24, 1, true));
  const plasmaMat = mat(new THREE.MeshStandardMaterial({ color: 0xfde68a, transparent: true, opacity: 0.3, roughness: 0.9, side: THREE.DoubleSide }));
  const plasma = new THREE.Mesh(plasmaGeo, plasmaMat); tubeGroup.add(plasma);   // 内径=核心，示意血浆层为壁与此之间空隙

  // —— 两支固定直径的参考血管（背景）：粗=体血黏度，细=黏度低谷 ——
  const refGeo = geo(new THREE.CylinderGeometry(1, 1, 6, 20, 1, true));
  const refMat = mat(new THREE.MeshStandardMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.16, roughness: 0.8, side: THREE.DoubleSide }));
  const refA = new THREE.Mesh(refGeo, refMat); refA.scale.set(1.6, 1, 1.6); refA.position.set(0, 2.7, 0); group.add(refA);
  refA.rotation.z = -Math.PI / 2;
  const refB = new THREE.Mesh(refGeo, refMat); refB.scale.set(0.35, 1, 0.35); refB.position.set(0, -2.7, 0); group.add(refB);
  refB.rotation.z = -Math.PI / 2;

  // —— 红细胞（双凹近似）：绕轴心核心分布，宽径下叠成缗钱状 ——
  const rbcGeo = geo(new THREE.SphereGeometry(1, 16, 10));
  const rbcMat = mat(new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 }));
  const RBC_N = 30;
  const rbcs: { m: import('three').Mesh; seed: number; stack: number }[] = [];
  for (let i = 0; i < RBC_N; i++) {
    const m = new THREE.Mesh(rbcGeo, rbcMat); group.add(m);
    rbcs.push({ m, seed: Math.random(), stack: Math.floor(Math.random() * 3) });
  }

  // —— 标签 ——
  function makeLabel(text: string, color: string, scale = 3.2): import('three').Sprite {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 26px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1); return s;
  }
  const lW = makeLabel('粗血管 D≈200µm：η≈体血', '#93c5fd', 4); lW.position.set(0, 3.6, 0); group.add(lW);
  const lM = makeLabel('测量微血管：D 实时扫描', '#f87171', 4); lM.position.set(0, 1.5, 0); group.add(lM);
  const lN = makeLabel('细血管 D≈3µm：单列、膜变形', '#60a5fa', 4); lN.position.set(0, -3.6, 0); group.add(lN);
  const lPlasma = makeLabel('无细胞血浆层 δ', '#fde68a', 2.8); lPlasma.position.set(2.6, 0.8, 0); group.add(lPlasma);

  // —— 信息面板（含 η(D)、H_T(D)、剪切变稀 η(γ̇) 迷你曲线） ——
  const infoCv = document.createElement('canvas'); infoCv.width = 860; infoCv.height = 440;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoSprite = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  infoSprite.position.set(0, 6.2, 0); infoSprite.scale.set(9.6, 4.92, 1); infoSprite.renderOrder = 999;
  group.add(infoSprite);

  let D = 200, gDot = 1;
  function drawInfo(): void {
    const mo = model(D);
    infoCtx.clearRect(0, 0, 860, 440);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(4, 4, 852, 432);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 852, 432);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText('血液流变 — Fåhræus–Lindqvist 管径效应 ＋ 剪切变稀 η(γ̇)', 20, 40);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '23px "PingFang SC", sans-serif';
    infoCtx.fillText('η_app/η_p = η_core·((R−δ)/R)⁴ + c·H_D·max(0,8−D)²，  H_T = H_D·((R−δ)/R)²', 20, 78);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('管越细→血浆层占比越大→有效管腔越小→管径效应（F-L）；剪切变稀见下方 η(γ̇)；<8µm 红细胞须变形，黏度反弹', 20, 112);

    // 迷你曲线：η(D) 与 H_T(D)，横轴 log D
    const gx0 = 30, gx1 = 380, gy0 = 300, gy1 = 150, Dmin = 4, Dmax = 300;
    const xd = (d: number) => gx0 + (Math.log10(d) - Math.log10(Dmin)) / (Math.log10(Dmax) - Math.log10(Dmin)) * (gx1 - gx0);
    const ymax = 3.2;
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 1;
    infoCtx.strokeRect(gx0, gy1, gx1 - gx0, gy0 - gy1);
    infoCtx.fillStyle = '#64748b'; infoCtx.font = '16px sans-serif';
    infoCtx.fillText('η_app/η_p', gx0, gy1 - 6); infoCtx.fillText('4→300 µm', gx0, gy0 + 16);
    infoCtx.strokeStyle = '#ef4444'; infoCtx.lineWidth = 2; infoCtx.beginPath();
    for (let i = 0; i <= 60; i++) { const d = Dmin * Math.pow(Dmax / Dmin, i / 60); const e = model(d).etaApp; const y = gy0 - (e / ymax) * (gy0 - gy1); i === 0 ? infoCtx.moveTo(xd(d), y) : infoCtx.lineTo(xd(d), y); }
    infoCtx.stroke();
    // 当前点
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.beginPath(); infoCtx.arc(xd(D), gy0 - (mo.etaApp / ymax) * (gy0 - gy1), 4, 0, Math.PI * 2); infoCtx.fill();
    // H_T 曲线（右侧第二小图）
    const hx0 = 470, hx1 = 830;
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 1; infoCtx.strokeRect(hx0, gy1, hx1 - hx0, gy0 - gy1);
    infoCtx.fillStyle = '#64748b'; infoCtx.fillText('管中压积 H_T (H_D=0.40)', hx0, gy1 - 6);
    infoCtx.strokeStyle = '#22d3ee'; infoCtx.lineWidth = 2; infoCtx.beginPath();
    for (let i = 0; i <= 60; i++) { const d = Dmin * Math.pow(Dmax / Dmin, i / 60); const ht = model(d).H_T; const y = gy0 - (ht / 0.45) * (gy0 - gy1); i === 0 ? infoCtx.moveTo(hx0 + (Math.log10(d) - Math.log10(Dmin)) / (Math.log10(Dmax) - Math.log10(Dmin)) * (hx1 - hx0), y) : infoCtx.lineTo(hx0 + (Math.log10(d) - Math.log10(Dmin)) / (Math.log10(Dmax) - Math.log10(Dmin)) * (hx1 - hx0), y); }
    infoCtx.stroke();
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.beginPath(); infoCtx.arc(hx0 + (Math.log10(D) - Math.log10(Dmin)) / (Math.log10(Dmax) - Math.log10(Dmin)) * (hx1 - hx0), gy0 - (mo.H_T / 0.45) * (gy0 - gy1), 4, 0, Math.PI * 2); infoCtx.fill();

    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数(管径)：D = ${D.toFixed(0)}µm   δ = ${mo.delta.toFixed(2)}µm   (R−δ)/R = ${mo.coreFrac.toFixed(2)}   H_T = ${mo.H_T.toFixed(2)}   η_app/η_p = ${mo.etaApp.toFixed(2)}`,
      20, 132,
    );

    // —— 剪切变稀 η(γ̇) 对照曲线（Cross 本构，横轴 log γ̇，随动画扫描 γ̇ 同源） ——
    const sx0 = 40, sx1 = 560, sy0 = 402, sy1 = 312, gmin = 0.1, gmax = 1000, eymin = 3.0, eymax = 9.2;
    const xg = (g: number) => sx0 + (Math.log10(g) - Math.log10(gmin)) / (Math.log10(gmax) - Math.log10(gmin)) * (sx1 - sx0);
    const ye = (e: number) => sy0 - (e - eymin) / (eymax - eymin) * (sy0 - sy1);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 1; infoCtx.strokeRect(sx0, sy1, sx1 - sx0, sy0 - sy1);
    infoCtx.fillStyle = '#64748b'; infoCtx.font = '16px sans-serif';
    infoCtx.fillText('剪切变稀 η(γ̇)/η_p（Cross 本构）', sx0, sy1 - 6);
    infoCtx.fillText('γ̇ 0.1→1000 s⁻¹', sx0, sy0 + 16);
    infoCtx.strokeStyle = '#f472b6'; infoCtx.lineWidth = 2; infoCtx.beginPath();
    for (let i = 0; i <= 80; i++) { const g = gmin * Math.pow(gmax / gmin, i / 80); const y = ye(shearEta(g)); i === 0 ? infoCtx.moveTo(xg(g), y) : infoCtx.lineTo(xg(g), y); }
    infoCtx.stroke();
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.beginPath(); infoCtx.arc(xg(gDot), ye(shearEta(gDot)), 4, 0, Math.PI * 2); infoCtx.fill();
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '16px sans-serif';
    infoCtx.fillText('低剪切：钱串 → η↑', sx1 + 10, ye(8.3));
    infoCtx.fillText('高剪切：散开取向 → η↓', sx1 + 10, ye(3.6));
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 21px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数(剪切)：γ̇ = ${gDot.toFixed(1)} s⁻¹`, sx1 + 10, ye(6.0));
    infoCtx.fillText(`η(γ̇)/η_p = ${shearEta(gDot).toFixed(2)}`, sx1 + 10, ye(6.0) + 24);
    infoTex.needsUpdate = true;
  }

  function rebuild(): void {
    // 世界半径与核心半径由 model() 在 update 中即时计算并赋给管壁/血浆壳；此处保留给 dispose 前的对齐。
    const mo = model(D);
    const rVis = 0.25 + Math.sqrt(mo.R) * 0.16;
    wall.scale.set(rVis, 1, rVis);
    plasma.scale.set(rVis * mo.coreFrac, 1, rVis * mo.coreFrac);
  }
  rebuild();
  drawInfo();

  return {
    update(t, dt) {
      const cycle = t % 18;
      const frac = cycle / 18;
      D = 4 + (Math.sin(frac * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5) * 296;   // 4↔300 往返
      // 剪切率 γ̇ 独立扫描 0.1→1000 s⁻¹（对数往返，周期 11 s）——驱动 η(γ̇) 曲线当前点与缗钱聚集
      gDot = Math.pow(10, -1 + 4 * (Math.sin((t % 11) / 11 * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5));
      const mo = model(D);
      const rVis = 0.25 + Math.sqrt(mo.R) * 0.16;
      const rCore = rVis * mo.coreFrac;
      wall.scale.set(rVis, 1, rVis);
      plasma.scale.set(rCore, 1, rCore);

      const shearDisperse = gDot > 60;      // 高剪切→钱串散开（剪切变稀的微观机制）
      const rolling = D > 8 && !shearDisperse;   // 缗钱叠合仅在较大径且低剪切处出现
      for (let i = 0; i < RBC_N; i++) {
        const rb = rbcs[i];
        const u = ((t * (0.07 + 0.1 * (1 - mo.coreFrac)) + rb.seed) % 1);
        const x = -AX_LEN / 2 + u * AX_LEN;
        const ang = rb.seed * Math.PI * 2;
        const rr = rCore * 0.62 * Math.sqrt(rb.seed);      // 核心内偏轴
        const stackGap = rolling && rb.stack > 0 ? rb.stack * 0.55 : 0;   // 缗钱沿轴向串叠
        rb.m.position.set(x + stackGap, Math.cos(ang) * rr, Math.sin(ang) * rr);
        rb.m.rotation.set(ang + t * 0.8, Math.PI / 2, 0);
        const flat = 0.16 + (rolling ? 0 : 0.02);         // 窄管略扁
        const stretch = rolling ? 1 : 1.5;               // 窄管中拉长（膜变形）
        rb.m.scale.set(flat * stretch, flat * 0.55, flat * stretch);
      }

      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
      scene.remove(tubeGroup);
    },
  };
}
