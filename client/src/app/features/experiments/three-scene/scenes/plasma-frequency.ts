import type { SceneContext, SceneInstance } from '../types';
/**
 * 等离子体频率与截止（P246）：电子流体相对静止离子背景的集体振荡。
 * 平板模型（严格一维）：ẍ_e = −ω_p² x_e，ω_p=√(n_e e²/ε₀m_e) ⇔ f_p=8.98·√n_e Hz。
 *   n_e=10¹⁰→f_p=0.898MHz（c/ω_p=53.1m）；10¹²→8.98MHz（5.31m）；介电 ε_r=1−ω_p²/ω²，
 *   f<f_p：全反射+趋肤 δ=c/√(ω_p²−ω²)；f>f_p：透射 λ_ion=λ₀/√(1−n_e/n_c)，临界密度 n_c=ε₀m_eω²/e²（100MHz⇒1.24×10¹⁴）。
 * 示意 Chapman 层：n(h)=n_m(h/h_m)²e^{2(1−h/h_m)}，峰值 1.5×10¹² @110km ⇒ f_p(max)=11.0MHz=foF2：
 *   短波被反射（天波）、GPS L 波段穿透 —— 电离层就是天然等离子体截止滤波器。
 * 画面统一演示时钟：真实角频率 ÷1.1×10⁸；空间比例 1 WU=12 m。
 *   左侧发射源发出平面波（场曲线分段解析），中间离子晶格静止、电子薄片整体位移 x_e(t)=Xcos(ω_p t)（严格解），
 *   E 场箭头随 ẍ=−ω²x 反相回复；右侧相位环 (x, ẋ/ω) 为标准椭圆（能量守恒）。
 * 扫描：A 段 n_e:10¹⁰→10¹² @f=5MHz（透射→截止）；B 段 f_sig:2→20MHz @n=10¹²（穿越截止恢复透射）。
 * 数值核对（_scratch/agentC/plasma.mjs）：f_p(1e11)=2.839MHz、n_c(100M)=1.240e14、f_p(1.5e12)=11.0MHz、30MHz@1e12 λ:9.99→10.47m。
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

  // —— SI 常数 + 显示换算 ——
  const E_CH = 1.602176634e-19, EPS0 = 8.8541878128e-12, ME = 9.1093837015e-31, C0 = 2.99792458e8;
  const CLOCK = 1.1e8, WSP = 1 / 12;                     // 时间压缩；1 WU = 12 m
  const fpOf = (n: number) => Math.sqrt(n * E_CH * E_CH / (EPS0 * ME)) / TWO_PI;
  const ncOf = (f: number) => EPS0 * ME * Math.pow(TWO_PI * f, 2) / (E_CH * E_CH);

  // —— 离子晶格（静止背景）+ 电子薄片（整体位移 = 严格解）——
  const ionGeo = geo(new THREE.IcosahedronGeometry(0.09, 1));
  const ionMat = mat(new THREE.MeshStandardMaterial({ color: 0xa78bfa, roughness: 0.5, metalness: 0.2 }));
  for (let iy = 0; iy < 5; iy++) for (let iz = 0; iz < 7; iz++) {
    const m = new THREE.Mesh(ionGeo, ionMat);
    m.position.set(0, -1.7 + iy * 0.85, -1.5 + iz * 0.5);
    group.add(m);
  }
  const NEL = 210;
  const elGeo = geo(new THREE.BufferGeometry());
  const elPos = new Float32Array(NEL * 3);
  elGeo.setAttribute('position', new THREE.BufferAttribute(elPos, 3));
  group.add(new THREE.Points(elGeo, mat(new THREE.PointsMaterial({ color: 0x22d3ee, size: 0.055, transparent: true, opacity: 0.9 }))));
  { let s = 5150; const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < NEL; i++) { elPos[i * 3] = 0; elPos[i * 3 + 1] = (rnd() - 0.5) * 3.6; elPos[i * 3 + 2] = (rnd() - 0.5) * 3.1; } }
  // E 场箭头（板间），长度 ∝ x_e，方向随符号
  const arrowGeo = geo(new THREE.ConeGeometry(0.07, 0.2, 8));
  const shaftGeo = geo(new THREE.CylinderGeometry(0.016, 0.016, 1, 6));
  const eMatP = mat(new THREE.MeshBasicMaterial({ color: 0xf43f5e }));
  const eMatN = mat(new THREE.MeshBasicMaterial({ color: 0x3b82f6 }));
  const arrows: { s: import('three').Mesh; c: import('three').Mesh }[] = [];
  for (let i = 0; i < 5; i++) {
    const yy = -1.5 + i * 0.75;
    const sm = i % 2 === 0 ? eMatP : eMatN;
    const sh = new THREE.Mesh(shaftGeo, sm); sh.rotation.z = PI / 2; sh.position.set(0, yy, 1.95); group.add(sh);
    const ch = new THREE.Mesh(arrowGeo, sm); ch.rotation.z = PI / 2; ch.position.set(0, yy, 1.95); group.add(ch);
    arrows.push({ s: sh, c: ch });
  }
  // 相位环：(x, ẋ/ω) 椭圆（能量守恒的严格轨迹）
  const ringGeo = geo(new THREE.BufferGeometry());
  { const p: number[] = [];
    for (let i = 0; i <= 64; i++) { const a = i / 64 * TWO_PI; p.push(4.35 + 0.5 * Math.cos(a), 2.3 + 0.5 * Math.sin(a), -0.4); }
    ringGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3)); }
  group.add(new THREE.Line(ringGeo, mat(new THREE.LineBasicMaterial({ color: 0x64748b }))));
  const phGeo = geo(new THREE.SphereGeometry(0.09, 10, 8));
  const phaseDot = new THREE.Mesh(phGeo, mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  group.add(phaseDot);

  // —— 场曲线（左：入射+反射；中：板内；右：透射/倏逝）——
  const lfGeo = geo(new THREE.BufferGeometry()); const lfPos = new Float32Array(61 * 3);
  lfGeo.setAttribute('position', new THREE.BufferAttribute(lfPos, 3));
  group.add(new THREE.Line(lfGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 }))));
  const midGeo = geo(new THREE.BufferGeometry()); const midPos = new Float32Array(41 * 3);
  midGeo.setAttribute('position', new THREE.BufferAttribute(midPos, 3));
  group.add(new THREE.Line(midGeo, mat(new THREE.LineBasicMaterial({ color: 0xfdbf5e }))));
  const rfGeo = geo(new THREE.BufferGeometry()); const rfPos = new Float32Array(61 * 3);
  rfGeo.setAttribute('position', new THREE.BufferAttribute(rfPos, 3));
  group.add(new THREE.Line(rfGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 }))));
  // 传播/截止指示旗
  const flagGeo = geo(new THREE.PlaneGeometry(0.62, 0.34));
  const flagMat = mat(new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
  const flag = new THREE.Mesh(flagGeo, flagMat); flag.position.set(2.7, 2.9, 0); group.add(flag);

  // —— Chapman 层地面剖面（右侧竖立小图，位于 x 轴=高度，y=归一化 n）——
  const chapGeo = geo(new THREE.BufferGeometry()); const chapPos = new Float32Array(61 * 3);
  chapGeo.setAttribute('position', new THREE.BufferAttribute(chapPos, 3));
  group.add(new THREE.Line(chapGeo, mat(new THREE.LineBasicMaterial({ color: 0xa855f7 }))));
  const cutGeo = geo(new THREE.SphereGeometry(0.085, 10, 8));
  const cutDot = new THREE.Mesh(cutGeo, mat(new THREE.MeshBasicMaterial({ color: 0xf43f5e })));
  group.add(cutDot);
  const chapBase = { x0: 1.35, x1: 4.35, y0: 0.06, yMax: 1.05 };
  const Hm = 110, HLo = 40, HHi = 380;
  const nShape = (h: number) => { const z = h / Hm; return z * z * Math.exp(2 * (1 - z)); };   // 峰值恰在 h_m=110km
  { const g = geo(new THREE.BufferGeometry()); const p: number[] = [];
    p.push(chapBase.x0, chapBase.y0, 0, chapBase.x1, chapBase.y0, 0, chapBase.x0, chapBase.y0, 0, chapBase.x0, chapBase.yMax + 0.1, 0);
    for (let h = 100; h <= 300; h += 100) { const xx = chapBase.x0 + (h - HLo) / (HHi - HLo) * (chapBase.x1 - chapBase.x0); p.push(xx, chapBase.y0, 0, xx, chapBase.y0 + 0.08, 0); }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3));
    group.add(new THREE.LineSegments(g, mat(new THREE.LineBasicMaterial({ color: 0x334155 })))); }

  function makeLabel(text: string, color: string, scale: number, x: number, y: number, z: number): void {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(scale, scale / 8, 1); s.position.set(x, y, z); s.renderOrder = 998; group.add(s);
  }
  makeLabel('离子背景静止 · 电子整体位移：ẍ=−ω_p²x（严格解）', '#c4b5fd', 4.4, 0, 3.35, 0.4);
  makeLabel('相位环 (x, ẋ/ω_p)=椭圆 ⇒ 振荡能量守恒', '#94a3b8', 3.2, 4.35, 3.05, -0.4);
  makeLabel('Chapman 层 n(h)：f_p(h)=f_sig 处截止反射（红点）', '#a855f7', 3.6, 2.85, 1.35, 0.2);
  makeLabel('发射源 f_sig', '#fbbf24', 1.9, -4.15, 2.85, 0);

  const infoCv = document.createElement('canvas'); infoCv.width = 664; infoCv.height = 264;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const info = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  info.scale.set(6.64, 2.64, 1); info.position.set(-0.3, 4.55, 0.4); info.renderOrder = 999;
  group.add(info);

  const rd = { n: 1e10, fp: 0, f: 5e6, eps: 1, delta: 0, lamT: 0, nc: 0, cut: false, fmax: 0 };
  const T2S = (n: number) => CLOCK / fpOf(n);           // 显示周期（秒）
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 664, 264);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(3, 3, 658, 258);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(3, 3, 658, 258);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 23px "PingFang SC", sans-serif';
    infoCtx.fillText('等离子体频率：电子质量 vs 静电力恢复 —— 集体振荡的本征频率', 12, 27);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '18px "PingFang SC", sans-serif';
    infoCtx.fillText('ω_p=√(n e²/ε₀m) ⇔ f_p=8.98√n Hz；平板内 ẍ=−ω_p²x 严格成立（场由两面电荷提供）', 12, 52);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('ε_r=1−ω_p²/ω²：ω<ω_p 全反射+趋肤 δ=c/√(ω_p²−ω²)；ω>ω_p 透射 λ=λ₀/√(1−n/n_c)', 12, 76);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 19px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：n=${rd.n.toExponential(2)}m⁻³  f_p=${(rd.fp / 1e6).toFixed(2)}MHz  f_sig=${(rd.f / 1e6).toFixed(1)}MHz  ε_r=${rd.eps.toFixed(3)}`, 12, 104);
    const st = rd.cut ? `截止！反射+倏逝尾 δ=${(rd.delta * WSP).toFixed(3)}WU=${rd.delta.toFixed(1)}m（驻波节点在表面）`
      : `透射：λ_ion=${(rd.lamT / WSP).toFixed(2)}WU=${(rd.lamT).toFixed(1)}m（n_c(${(rd.f / 1e6).toFixed(0)}M)=${rd.nc.toExponential(2)}，n/n_c=${(rd.n / rd.nc).toFixed(3)}）`;
    infoCtx.fillText(`  ${st}`, 12, 128);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '17px "PingFang SC", sans-serif';
    infoCtx.fillText(`电离层：n_max=${rd.n.toExponential(1)} ⇒ f_p(max)=${(rd.fmax / 1e6).toFixed(1)}MHz=foF2；${rd.f < rd.fmax ? '低于 foF2 → 天波反射' : '高于 foF2 → 穿透（GPS/卫星链路）'}`, 12, 154);
    infoCtx.fillStyle = '#22c55e'; infoCtx.font = '16px "PingFang SC", sans-serif';
    infoCtx.fillText('核对：f_p(1e11)=2.84MHz · n_c(100MHz)=1.24e14 · f_p(1.5e12)=11.0MHz', 12, 180);
    infoCtx.fillText('演示时钟：真实频率÷1.1e8；1WU=12m。金属的光泽=紫外前 ε_r<0（ω_p 在紫外）', 12, 204);
    infoCtx.fillText(`电子薄片周期 T=2π/ω_p：${(T2S(rd.n)).toFixed(2)}s 显示（真 ${(1 / fpOf(rd.n) * 1e6).toFixed(2)}µs）`, 12, 228);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  const CYCLE = 18, XSL = -0.85, XSR = 0.85, SLAB = XSR - XSL, AMP = 0.5, SHEETX0 = 0;
  let xe = AMP, xev = 0, prevU = 1;
  return {
    update(t, dt) {
      const u = (t % CYCLE) / CYCLE;
      if (u < prevU) { xe = AMP; xev = 0; }   // 新循环：重新 kick 电子薄片
      prevU = u;
      let n = 1e12, f = 5e6;
      if (u < 0.5) { const s0 = u / 0.5; n = 1e10 * Math.pow(1e2, s0); f = 5e6; }
      else { const s0 = (u - 0.5) / 0.5; n = 1e12; f = 2e6 * Math.pow(10, s0); }
      const wp = TWO_PI * fpOf(n), wDisp = wp / CLOCK;
      const wt = TWO_PI * f / CLOCK;
      // —— 薄片严格振荡：半隐式积分 ẍ=−ω_disp²x（能量漂移极小，相位守恒）——
      const dts = Math.min(dt, 0.05);
      xev += -wDisp * wDisp * xe * dts; xe += xev * dts;
      for (let i = 0; i < NEL; i++) elPos[i * 3] = SHEETX0 + xe;
      elGeo.attributes['position'].needsUpdate = true;
      for (let i = 0; i < 5; i++) {
        const a = arrows[i], L = Math.max(0.02, Math.abs(xe) * 1.1);
        a.s.scale.set(1, L, 1);
        const dir = xe > 0 ? (i % 2 === 0 ? 1 : -1) : (i % 2 === 0 ? -1 : 1);
        a.s.position.x = dir * L / 2; a.c.position.x = dir * (L / 2 + 0.11);
        a.c.rotation.z = dir > 0 ? -PI / 2 : PI / 2;
        a.c.visible = L > 0.08;
      }
      phaseDot.position.set(4.35 + xe / AMP * 0.5, 2.3 + xev / (wDisp * AMP) * 0.5, -0.4);
      // —— 场曲线分段解析：ε_r、Fresnel 反射、趋肤/透射 ——
      const eps = 1 - wp * wp / Math.pow(TWO_PI * f, 2);
      const cut = eps < 0;
      rd.n = n; rd.fp = fpOf(n); rd.f = f; rd.eps = eps; rd.cut = cut; rd.nc = ncOf(f); rd.fmax = fpOf(n);
      const lambda0 = C0 / f * WSP;                 // 真空波长（WU）
      const kD = TWO_PI / lambda0;
      const delta = cut ? C0 / Math.sqrt(Math.max(1e-30, wp * wp - Math.pow(TWO_PI * f, 2))) : 0;
      rd.delta = delta;
      const kapW = cut ? 1 / (delta * WSP) : 0;     // 倏逝衰减系数（每 WU）
      const beta = cut ? 0 : Math.sqrt(Math.max(1e-12, eps));   // 折射指数 n=√ε_r<1
      rd.lamT = lambda0 / Math.max(1e-6, beta);     // λ_ion=λ₀/√(1−n/n_c)
      const kT = TWO_PI / rd.lamT;                  // = β·kD（板内波数）
      const phiR = cut ? -2 * Math.atan2(Math.sqrt(-eps), 1) : 0;  // 全反射相移（复 Fresnel 幅角）
      const rAmp = cut ? 1 : (1 - beta) / (1 + beta);
      // 左段：入射(＋x 行波)+反射(−x)：截止时 |r|=1 完全驻波，透射时部分驻波
      for (let i = 0; i <= 60; i++) {
        const x = -4.5 + (XSL + 4.5) * i / 60;
        const yi = Math.sin(wt * t - kD * (x - XSL));
        const yr = rAmp * Math.sin(wt * t + kD * (x - XSL) + phiR);
        lfPos[i * 3] = x; lfPos[i * 3 + 1] = 1.55 + (yi + yr) * 0.42; lfPos[i * 3 + 2] = 0;
      }
      // 板内：透射波 2/(1+β)（界面连续）或双界面倏逝尾
      for (let i = 0; i <= 40; i++) {
        const x = XSL + SLAB * i / 40;
        let yv = 0;
        if (cut) yv = (Math.exp(-kapW * (x - XSL)) + Math.exp(kapW * (x - XSL) - 2 * kapW * SLAB)) * Math.sin(wt * t + phiR);
        else yv = (2 / (1 + beta)) * Math.sin(wt * t - kT * (x - XSL));
        midPos[i * 3] = x; midPos[i * 3 + 1] = 1.55 + yv * 0.42; midPos[i * 3 + 2] = 0;
      }
      // 右段：透射（出射界面 Fresnel×板内幅=4β/(1+β)²，含板相位滞后）或隧穿泄漏
      const ampR = cut ? 2 * Math.exp(-kapW * SLAB) : 4 * beta / ((1 + beta) * (1 + beta));
      for (let i = 0; i <= 60; i++) {
        const x = XSR + (4.5 - XSR) * i / 60;
        const yv = ampR * Math.sin(wt * t - kT * SLAB - kD * (x - XSR) + (cut ? phiR : 0));
        rfPos[i * 3] = x; rfPos[i * 3 + 1] = 1.55 + yv * 0.42; rfPos[i * 3 + 2] = 0;
      }
      lfGeo.attributes['position'].needsUpdate = true;
      midGeo.attributes['position'].needsUpdate = true;
      rfGeo.attributes['position'].needsUpdate = true;
      flagMat.color.setHex(cut ? 0xf43f5e : 0x22c55e);
      // —— Chapman 层：剖面 + 截止高度（自低向高首个 f_p(h)≥f_sig 处）——
      for (let i = 0; i <= 60; i++) {
        const h = HLo + (HHi - HLo) * i / 60;
        chapPos[i * 3] = chapBase.x0 + (h - HLo) / (HHi - HLo) * (chapBase.x1 - chapBase.x0);
        chapPos[i * 3 + 1] = chapBase.y0 + nShape(h) * rd.n / 2e12 * chapBase.yMax;
        chapPos[i * 3 + 2] = 0.05;
      }
      chapGeo.attributes['position'].needsUpdate = true;
      let hCut = -1;
      for (let h = HLo; h <= HHi; h += 1) { if (fpOf(n * nShape(h)) >= f) { hCut = h; break; } }
      if (f < rd.fmax && hCut > 0) {
        cutDot.position.set(chapBase.x0 + (hCut - HLo) / (HHi - HLo) * (chapBase.x1 - chapBase.x0),
          chapBase.y0 + nShape(hCut) * rd.n / 2e12 * chapBase.yMax, 0.05);
        cutDot.visible = true;
      } else cutDot.visible = false;
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
    },
    dispose() {
      geos.forEach((x) => x.dispose()); mats.forEach((x) => x.dispose()); texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
