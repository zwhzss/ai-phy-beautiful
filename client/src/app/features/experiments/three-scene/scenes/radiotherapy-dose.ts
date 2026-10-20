import type { SceneContext, SceneInstance } from '../types';
/** P358 放射治疗与剂量：6 MV 光子 vs 质子束的百分深度剂量、布拉格峰与多射束等剂量面。 */
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
  {
    const sp = new Float32Array(1500);
    for (let i = 0; i < 1500; i++) sp[i] = (Math.random() - 0.5) * 400;
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  }
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // ═══ 物理内核（自变量单位：cm）═══
  const PI = Math.PI, WSC = 3.4, SSD = 45, A = 12;
  const LB = 0.7, MU = 0.03, PE = 1 / 1.77, UF = 0.02, SIGF = 0.012;
  const erfc = (x: number): number => {
    const ax = Math.abs(x), t = 1 / (1 + 0.3275911 * ax);
    const e = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax));
    return x >= 0 ? e : 2 - e;
  };
  const sig = (R: number): number => SIGF * R;
  const pRaw = (x: number): number => (1 - Math.exp(-x / LB)) * Math.exp(-MU * x) * Math.pow(SSD / (SSD + x), 2);
  const pdd = (x: number): number => 100 * pRaw(x);
  const rangeE = (E: number): number => 0.0022 * Math.pow(E, 1.77);
  const eRange = (R: number): number => Math.pow(R / 0.0022, 1 / 1.77);
  const bragg = (s: number, R: number): number =>
    Math.pow(Math.max(1 - s / R, UF), -PE) * 0.5 * erfc((s - R + 1.5 * sig(R)) / sig(R));
  const bPeak = (R: number): number => { let m = 0; for (let s = 0; s <= R; s += 0.02) m = Math.max(m, bragg(s, R)); return m; };
  const sobpArr: number[] = [];
  const SOBPN = 16, SOBPO = 6;
  for (let j = 0; j < SOBPN; j++) sobpArr.push(SOBPO * (j + 0.5) / SOBPN);
  const sobpRaw = (s: number, Rp: number): number => {
    let a = 0;
    for (let j = 0; j < SOBPN; j++) { const R = Rp - sobpArr[j]; a += bragg(s, R) / bPeak(R); }
    return a / SOBPN;
  };
  const sobpN = (s: number, Rp: number): number => sobpRaw(s, Rp) / sobpRaw(Rp - SOBPO - 1.5, Rp);
  const RMATCH = A + 0.5;
  const sobpRpMax = (() => { let best = RMATCH + 3, bv = 0;
    for (let Rp = RMATCH; Rp <= RMATCH + 8; Rp += 0.1) { const v = sobpRaw(RMATCH, Rp); if (v > bv) { bv = v; best = Rp; } }
    return best; })();
  const pNorm = pdd(RMATCH) / pdd(RMATCH - 0.5);
  type BM = { th: number; ph: boolean };
  const PH_TH = [20, 80, 140, 200, 260, 320].map((d) => (d * PI) / 180);
  const PR_TH = [155, 180, 205].map((d) => (d * PI) / 180);
  const BEAMS: BM[] = [...PH_TH.map((th) => ({ th, ph: true })), ...PR_TH.map((th) => ({ th, ph: false }))];
  let FPH = 1, FPR = 1;
  const kDose = (s: number, rr: number, ph: boolean, R: number): number => {
    if (s < 0 || s > 2 * A + 2) return 0;
    const q = Math.pow(SSD / rr, 2);
    return ph ? q * (1 - Math.exp(-s / LB)) * Math.exp(-MU * s) : q * bragg(s, R);
  };
  const rawAt = (th: number, ph: boolean, R: number, px: number, py: number): number => {
    const d0 = Math.cos(th), d1 = Math.sin(th);
    return kDose(px * d0 + py * d1 + A, Math.hypot(px + SSD * d0, py + SSD * d1), ph, R);
  };
  const planRaw = (ph: boolean, R: number, px: number, py: number): number => {
    let a = 0; const ts = ph ? PH_TH : PR_TH;
    for (let k = 0; k < ts.length; k++) a += rawAt(ts[k], ph, R, px, py);
    return a;
  };
  const OAR = [-7, 0, 3.5];
  const inTumor = (x: number, y: number): boolean => x * x + y * y <= 6.25;
  const inOar = (x: number, y: number): boolean => (x - OAR[0]) * (x - OAR[0]) + (y - OAR[1]) * (y - OAR[1]) <= OAR[2] * OAR[2];

  // ═══ 剂量场网格（等剂量线 + 体素着色同源）═══
  const GS = 37, GE = 13.2, GST = (2 * GE) / (GS - 1);
  const dFld = new Float32Array(GS * GS);
  let mode = true, curR = RMATCH, DmaxHot = 0;
  function computeField(): void {
    for (let iy = 0; iy < GS; iy++) {
      const y = -GE + GST * iy;
      for (let ix = 0; ix < GS; ix++) {
        const x = -GE + GST * ix;
        dFld[iy * GS + ix] = Math.hypot(x, y) <= A ? planRaw(mode, curR, x, y) : 0;
      }
    }
  }

  // ═══ 场景物件 ═══
  const bodyGeo = geo(new THREE.CircleGeometry(A * WSC, 64));
  const body = new THREE.Mesh(bodyGeo, mat(new THREE.MeshBasicMaterial({ color: 0x2b3552, transparent: true, opacity: 0.5, side: THREE.DoubleSide })));
  body.position.z = 0.03;
  const rimGeo = geo(new THREE.RingGeometry(A * WSC - 0.02, A * WSC + 0.02, 64));
  group.add(body, new THREE.Mesh(rimGeo, mat(new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.65, side: THREE.DoubleSide }))));
  const tmGeo = geo(new THREE.SphereGeometry(2.5 * WSC, 18, 14));
  const tmMat = mat(new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.42 }));
  const tumor = new THREE.Mesh(tmGeo, tmMat);
  const oarGeo = geo(new THREE.RingGeometry(3.5 * WSC - 0.015, 3.5 * WSC + 0.015, 40));
  group.add(tumor);
  const oarMesh = new THREE.Mesh(oarGeo, mat(new THREE.MeshBasicMaterial({ color: 0xa855f7 })));
  oarMesh.position.set(OAR[0] * WSC, OAR[1] * WSC, 0.06);   // 脊髓环落在剂量计算位 (−7cm, 0)
  group.add(oarMesh);
  const srcGeo = geo(new THREE.BoxGeometry(0.28, 0.28, 0.28));
  const srcMats: import('three').MeshBasicMaterial[] = [];
  const srcMeshes: import('three').Mesh[] = [];
  for (let k = 0; k < BEAMS.length; k++) {
    const m = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
    const q = new THREE.Mesh(srcGeo, m);
    q.position.set(-SSD * Math.cos(BEAMS[k].th) * WSC, -SSD * Math.sin(BEAMS[k].th) * WSC, 0);
    group.add(q); srcMats.push(m); srcMeshes.push(q);
  }
  const bmGeo: import('three').BufferGeometry[] = [];
  const bmMats: import('three').MeshBasicMaterial[] = [];
  for (let k = 0; k < BEAMS.length; k++) {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    const m = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    group.add(new THREE.Mesh(g, m)); bmGeo.push(g); bmMats.push(m);
  }
  const dvGeo = geo(new THREE.BufferGeometry());
  dvGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(1500 * 3), 3));
  const dvMat = mat(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const doseVol = new THREE.Mesh(dvGeo, dvMat);
  doseVol.position.z = 0.05;
  group.add(doseVol);
  function ramp(t: number, o: Float32Array, i: number): void {
    const c = Math.max(0, Math.min(1, t));
    let r: number, g: number, b: number;
    if (c < 0.38) { r = 0.1 * c; g = 0.3 + 0.55 * c; b = 0.7 + 0.3 * c; }
    else if (c < 0.72) { const u2 = (c - 0.38) / 0.34; r = 0.55 * u2; g = 0.75; b = 0.15 * (1 - u2); }
    else { const u2 = (c - 0.72) / 0.28; r = 0.6 + 0.4 * u2; g = 0.75 - 0.45 * u2; b = 0.05; }
    o[i] = r; o[i + 1] = g; o[i + 2] = b;
  }
  function fillDose(): void {
    const pos = (dvGeo.attributes['position'] as import('three').BufferAttribute).array as Float32Array;
    const col = (dvGeo.attributes['color'] as import('three').BufferAttribute).array as Float32Array;
    let v = 0;
    for (let iy = 0; iy < GS - 1; iy++) for (let ix = 0; ix < GS - 1; ix++) {
      const cell = [dFld[iy * GS + ix], dFld[iy * GS + ix + 1], dFld[(iy + 1) * GS + ix], dFld[(iy + 1) * GS + ix + 1]];
      let s = 0, n = 0;
      for (const d of cell) if (d > 0) { s += d; n++; }
      if (!n) continue;
      const x = -GE + GST * ix, y = -GE + GST * iy, hv = s / n / 2.5;
      const quad = [[x, y], [x + GST, y], [x + GST, y + GST], [x, y + GST]];
      for (const q of quad) { pos[v * 3] = q[0] * WSC; pos[v * 3 + 1] = q[1] * WSC; pos[v * 3 + 2] = 0; ramp(hv, col, v * 3); v++; }
      for (const t2 of [0, 1, 2, 0, 2, 3]) { pos[v * 3] = pos[((v - 4 + t2) * 3)]; pos[v * 3 + 1] = pos[((v - 4 + t2) * 3) + 1]; pos[v * 3 + 2] = 0; col[v * 3] = col[((v - 4 + t2) * 3)]; col[v * 3 + 1] = col[((v - 4 + t2) * 3) + 1]; col[v * 3 + 2] = col[((v - 4 + t2) * 3) + 2]; v++; }
    }
    dvGeo.setDrawRange(0, v);
    dvGeo.attributes['position'].needsUpdate = true;
    dvGeo.attributes['color'].needsUpdate = true;
  }
  function buildVol(): void {
    const idx: number[] = [];
    for (let k = 0; k < 1500; k++) idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
    dvGeo.setIndex(idx);
    dvGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(1500 * 3), 3));
  }

  // ═══ 深度剂量曲线图（左下，物理坐标轴）═══
  const CP = 96, CH = { x0: -5, x1: 26, d0: 0, d1: 110 };
  const cx = (x: number): number => ((x - CH.x0) / (CH.x1 - CH.x0)) * 3.3 - 4.8;
  const cy = (d: number): number => (d / CH.d1) * 1.7 - 4.35;
  const axGeo = geo(new THREE.BufferGeometry());
  {
    const ap = [cx(0), cy(0), 0, cx(24), cy(0), 0, cx(0), cy(0), 0, cx(0), cy(105), 0];
    axGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ap), 3));
  }
  group.add(new THREE.LineSegments(axGeo, mat(new THREE.LineBasicMaterial({ color: 0x334155 }))));
  const phCGeo = geo(new THREE.BufferGeometry()); phCGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CP * 3), 3));
  const soCGeo = geo(new THREE.BufferGeometry()); soCGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CP * 3), 3));
  const sgCGeo = geo(new THREE.BufferGeometry()); sgCGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CP * 3), 3));
  const mkCurve = (g: import('three').BufferGeometry, c: number): import('three').Line => {
    const l = new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color: c })));
    l.frustumCulled = false; group.add(l); return l;
  };
  mkCurve(phCGeo, 0x22d3ee); mkCurve(soCGeo, 0x22c55e); mkCurve(sgCGeo, 0xf472b6);
  let dmaxPh = 0, dmaxSo = 0;   // dmax：对所绘深度剂量曲线求 argmax（与曲线同源）
  function updateCurves(Rp: number): void {
    const pd = (a: import('three').BufferAttribute, i: number, x: number, y: number): void => { a.setXYZ(i, cx(x), cy(y), 0); };
    let bph = -1, bxph = 0, bso = -1, bxso = 0;
    for (let i = 0; i < CP; i++) {
      const x = CH.x0 + (i / (CP - 1)) * (CH.x1 - CH.x0);
      const dv = pdd(x) * pNorm;
      const sv = 100 * sobpN(x, Rp);
      if (x >= 0) { if (dv > bph) { bph = dv; bxph = x; } if (sv > bso) { bso = sv; bxso = x; } }
      pd((phCGeo.attributes['position'] as import('three').BufferAttribute), i, x, dv);
      pd((soCGeo.attributes['position'] as import('three').BufferAttribute), i, x, sv);
      pd((sgCGeo.attributes['position'] as import('three').BufferAttribute), i, x, 100 * bragg(x, R) / bPeak(R));
    }
    dmaxPh = bxph; dmaxSo = bxso;
    phCGeo.attributes['position'].needsUpdate = true;
    soCGeo.attributes['position'].needsUpdate = true;
    sgCGeo.attributes['position'].needsUpdate = true;
  }
  let R = RMATCH;
  const mkLabel = (text: string, color: string, sx: number, sy: number, px: number, py: number): import('three').Sprite => {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 48;
    const c2 = cv.getContext('2d')!;
    c2.fillStyle = color; c2.font = 'bold 26px "PingFang SC", sans-serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle';
    c2.fillText(text, 128, 24);
    const tp = tex(new THREE.CanvasTexture(cv));
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tp, transparent: true })));
    s.scale.set(sx, sy, 1); s.position.set(px, py, 0.2); group.add(s); return s;
  };
  mkLabel('深度 (cm)', '#94a3b8', 1.2, 0.22, cx(13), -4.62);
  mkLabel('剂量 (%)', '#94a3b8', 1.1, 0.22, cx(2), cy(113));
  mkLabel('SOBP', '#22c55e', 0.7, 0.18, cx(19.5), cy(112));
  mkLabel('质子', '#f472b6', 0.7, 0.18, cx(22.5), cy(112));
  mkLabel('光子', '#22d3ee', 0.7, 0.18, cx(25.3), cy(112));
  mkLabel('危及器官 (脊髓)', '#a855f7', 1.7, 0.24, -23.8, -0.6);
  mkLabel('靶区 GTV', '#f472b6', 1.05, 0.2, 0, -23.6);

  // ═══ 读数面板 ═══
  const icv = document.createElement('canvas');
  icv.width = 640; icv.height = 480;
  const ic = icv.getContext('2d')!;
  const itx = tex(new THREE.CanvasTexture(icv));
  const panel = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: itx, transparent: true, depthTest: false })));
  panel.scale.set(3.6, 2.7, 1);
  panel.position.set(2.7, 3.1, 1.2);
  panel.renderOrder = 999;
  group.add(panel);
  let R90 = 0, pkR = 1, dTum = 0, dOar = 0;
  function statsNow(): void {
    computeField();
    let mx = 0, mo = 0, mt = 0, c = 0, sc = 0, sm = 0;
    for (let iy = 0; iy < GS; iy++) for (let ix = 0; ix < GS; ix++) {
      const x = -GE + GST * ix, y = -GE + GST * iy, d = dFld[iy * GS + ix];
      if (d <= 0) continue;
      if (d > mx) mx = d;
      if (inOar(x, y)) { mo += d; c++; }
      if (inTumor(x, y)) { mt = Math.max(mt, d); }
    }
    sc = mo / Math.max(c, 1);
    DmaxHot = (mode ? FPH : FPR) * mx;
    dOar = (mode ? FPH : FPR) * sc;
    dTum = (mode ? FPH : FPR) * mt;
    let b = 0; for (let i = 0; i < 90; i++) { const s = 2 + (i / 90) * (2 * A); if (bragg(s, R) > b) b = bragg(s, R); }
    pkR = b;
    let r9 = 0; for (let s = R; s > 0; s -= 0.01) if (bragg(s, R) >= 0.9 * b) { r9 = s; break; }
    R90 = r9;
  }
  function drawInfo(): void {
    ic.clearRect(0, 0, 640, 480);
    ic.fillStyle = 'rgba(7,11,20,0.85)';
    ic.fillRect(4, 4, 632, 472);
    ic.strokeStyle = '#334155'; ic.lineWidth = 3; ic.strokeRect(4, 4, 632, 472);
    ic.textAlign = 'left';
    ic.fillStyle = '#f8fafc'; ic.font = 'bold 29px "PingFang SC", sans-serif';
    ic.fillText('P358 放射治疗与剂量 · 6MV 光子 vs 质子', 18, 42);
    ic.fillStyle = '#ffffff'; ic.font = '27px "PingFang SC", sans-serif';
    ic.fillText('D = Φ·ψ·S/ρ：光子 I=I₀e^(−µx)/(r/SSD)²', 18, 90);
    ic.fillText('µ=0.03/cm · 电子失衡 B(x)=1−e^(−x/0.7)', 18, 127);
    ic.fillText('质子 R=0.0022E^1.77 · S∝(1−x/R)^−0.565', 18, 164);
    ic.fillStyle = '#22d3ee';
    ic.fillText('布拉格峰/平台 ≈ ' + (pkR * 1).toFixed(1) + '× (E≈' + eRange(R).toFixed(0) + 'MeV)，', 18, 212);
    ic.fillText('峰后 erfc 陡降；SOBP=R−6..R 16 档展宽叠加', 18, 249);
    ic.fillStyle = mode ? '#fbbf24' : '#fbbf24';
    ic.font = 'bold 27px "PingFang SC", sans-serif';
    ic.fillText('读数：' + (mode ? '6MV 光子 (6 野)' : '质子 (3 野)') + ' dmax=' + (mode ? dmaxPh : dmaxSo).toFixed(1) + 'cm', 18, 300);
    ic.fillText('PDD10=' + (pdd(10) / pdd(Math.max(dmaxPh, 0.5)) * 100).toFixed(0) + '% (dmax 归一)  R90=' + R90.toFixed(1) + 'cm  E=' + eRange(R).toFixed(0) + 'MeV', 18, 337);
    ic.fillText('D_tumor=' + dTum.toFixed(2) + 'Gy  D_OAR=' + dOar.toFixed(2) + 'Gy', 18, 374);
    ic.fillText('D_max=' + DmaxHot.toFixed(2) + 'Gy  100%覆盖率=' + (dTum / Math.max(DmaxHot, 0.01) * 100).toFixed(0) + '%', 18, 411);
    ic.font = '24px "PingFang SC", sans-serif'; ic.fillStyle = '#94a3b8';
    ic.fillText('γ：指数衰减+平方反比 · p：CSDA 射程 + 能损 B', 18, 452);
    itx.needsUpdate = true;
  }

  // ═══ 标定与初始状态 ═══
  FPH = 2 / planRaw(true, 0, 0, 0);
  FPR = 2 / planRaw(false, RMATCH, 0, 0);
  statsNow();
  buildVol();
  fillDose();
  updateCurves(sobpRpMax);
  drawInfo();
  let animT = 0;

  return {
    update(t, dt) {
      animT += dt;
      const cyc = animT % 16;
      mode = cyc < 8;
      if (!mode) curR = Math.max(5, Math.min(22, 6 + (cyc - 8) * (17 / 8)));
      R = curR;
      const Rp = Math.max(curR + 0.45, A + 2);
      const nBeams = mode ? PH_TH.length : PR_TH.length;
      const order = mode ? PH_TH : PR_TH;
      const idxOf = (th: number): number => BEAMS.findIndex((b) => b.th === th);
      const firing = Math.floor(animT * 1.6) % nBeams;
      for (let k = 0; k < BEAMS.length; k++) {
        const b = BEAMS[k];
        const active = mode === b.ph;
        const isFire = active && idxOf(b.th) === firing;
        srcMats[k].color.setHex(b.ph ? 0x22d3ee : 0xf472b6);
        srcMeshes[k].scale.setScalar(active ? (isFire ? 1.55 : 1.0) : 0.35);
        const o = bmMats[k];
        o.color.setHex(b.ph ? 0x22d3ee : 0xf472b6);
        o.opacity = active ? (isFire ? 0.3 : 0.07) : 0;
        if (active) {
          const d0 = Math.cos(b.th), d1 = Math.sin(b.th);
          const px = -d1, py = d0;
          const srcx = -SSD * d0 * WSC, srcy = -SSD * d1 * WSC;
          const w = 3 * WSC;
          const p = (bmGeo[idxOf(b.th)].attributes['position'] as import('three').BufferAttribute).array as Float32Array;
          p[0] = srcx - px * 0.12; p[1] = srcy - py * 0.12; p[2] = 0;
          p[3] = srcx + px * 0.12; p[4] = srcy + py * 0.12; p[5] = 0;
          p[6] = (A * 1.02) * d0 * WSC + px * w; p[7] = (A * 1.02) * d0 * WSC * 0 + (A * 1.02) * d1 * WSC + py * w; p[8] = 0;
          p[9] = (A * 1.02) * d0 * WSC - px * w; p[10] = (A * 1.02) * d1 * WSC - py * w; p[11] = 0;
          bmGeo[idxOf(b.th)].attributes['position'].needsUpdate = true;
        }
      }
      tmMat.opacity = 0.3 + 0.2 * Math.sin(t * 2.4);
      statsNow();
      fillDose();
      updateCurves(Rp);
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
