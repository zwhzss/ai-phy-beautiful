import type { SceneContext, SceneInstance } from '../types';
/** 哈密顿力学（P195）：正则方程 q̇ᵢ = ∂H/∂pᵢ, ṗᵢ = −∂H/∂qᵢ，
 *  H = ½|p|² + V，V(q) = ½ρ²(q₃²−1) + ½q₃²（ρ² = q₁²+q₂²）
 *   ⇒ q̇ = p，ṗ₁ = q₁(1−q₃²)，ṗ₂ = q₂(1−q₃²)，ṗ₃ = −q₃(ρ²+1)。
 *  ① 严格周期解：不变直线 ρ=0 上 q̈₃ = −q₃ ⇒ q₃(t) = A·cos t，A = √(2H)（本场景 H=0.1 ⇒ A=0.4472）。
 *  ② 横向失稳：偏离直线者 ρ̈ = (1−q₃²)ρ，因 |q₃|≤A<1 恒成立 ⇒ 系数 ≥0.8，偏差按 e^{0.93t} 指数拉伸（数值实测）。
 *     除竖直轨道外无一轨迹有界：6 条螺旋轨迹与 180 点云团都在 4–5 s 内被甩出漏斗。
 *  ③ 零速（转折）面 V=H：ρ_turn(q₃) = √((q₃²−2H)/(1−q₃²))，|q₃|∈[A,1)；面内是禁区，两个喉口正在竖直轨道的两个 turning point 上。
 *  ④ 刘维尔定理：哈密顿流散度自由 ∇·v̇ = Σ(∂q̇ᵢ/∂qᵢ + ∂ṡ...) = 0 ⇒ 沿轨道的切线线性流 δṡ = J(s)·δs 满足 d(det T)/dt = 0。
 *     6×6 框架 T 的列 = 6 个单位基向量的切线像，与参考轨道同一次 RK4 耦合推进（时间一致）。
 *     实测 16 s 后四列模长 → 10⁶、两列保持 1，det 仍 =1.000 ⇒ 体积守恒由"各列趋于共面"补偿：
 *     形状因子 |det T|/∏‖δⱼ‖（多元角正弦）从 1 塌到 10⁻²⁴，这才是指数拉伸下 det≡1 非平凡的原因。
 *  显示长度做 1+log₁₀ 压缩，只改线段长短，不改 det 度量；面板同时给出 H 漂移作为积分精度自检。 */
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
  const TWO_PI = Math.PI * 2;
  const H0 = 0.1, AMAX = Math.sqrt(2 * H0);        // 参考（竖直）轨道的能量与振幅
  const QFUN = 0.93, RHO_MAX = 2.2;                // 漏斗面采样上限 / 轨迹逃逸半径
  const SX = 1.55, SY = 2.5, SZ = 1.55;            // (q₁,q₃,q₂) → 世界坐标
  const ox = -3.1, oy = -1.3;                      // 相空间原点

  const starGeo = geo(new THREE.BufferGeometry());
  const starPos = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) { starPos[i * 3] = (Math.random() - 0.5) * 200; starPos[i * 3 + 1] = (Math.random() - 0.5) * 200; starPos[i * 3 + 2] = (Math.random() - 0.5) * 200; }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  function axisLine(vec: [number, number, number], color: number): void {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([ox, oy, 0, ox + vec[0], oy + vec[1], vec[2]]), 3));
    group.add(new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 }))));
  }
  axisLine([2.9, 0, 0], 0xf472b6); axisLine([0, 2.6, 0], 0xa855f7); axisLine([0, 0, 2.9], 0x22d3ee);   // q₁, q₃, q₂

  function makeLabel(text: string, color: string, scale = 1.15): import('three').Sprite {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 36px "PingFang SC", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 128, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 4, 1);
    return s;
  }
  const lq1 = makeLabel('q₁', '#f472b6'); lq1.position.set(ox + 3.15, oy, 0); group.add(lq1);
  const lq3 = makeLabel('q₃', '#a855f7'); lq3.position.set(ox, oy + 2.8, 0); group.add(lq3);
  const lq2 = makeLabel('q₂', '#22d3ee'); lq2.position.set(ox, oy, 3.15); group.add(lq2);

  // 世界坐标映射（位形空间 (q₁,q₂,q₃) → 画面 (x,y,z)，q₃ 作竖直轴）
  const px = (q1: number): number => ox + q1 * SX;
  const py = (q3: number): number => oy + q3 * SY;
  const pz = (q2: number): number => q2 * SZ;

  // —— ③ 零速漏斗面 V=H：ρ_turn(q₃)，绕 q₃ 轴旋转 ——
  const NU = 40, NV = 56;
  const surfGeo = geo(new THREE.BufferGeometry());
  const sPos = new Float32Array((NU + 1) * (NV + 1) * 3);
  surfGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  {
    const idx: number[] = [];
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
      const a = i * (NV + 1) + j, b = a + 1, cc = a + (NV + 1), e = cc + 1;
      idx.push(a, b, cc, b, e, cc);
    }
    surfGeo.setIndex(idx);
  }
  group.add(new THREE.Mesh(surfGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.28, side: THREE.DoubleSide }))));
  const rhoTurn = (q3: number): number => {
    const a = Math.abs(q3);
    if (a <= AMAX) return 0;                                  // |q₃|<A：全 ρ 允许（无禁区）
    return Math.sqrt(Math.max(0, (q3 * q3 - 2 * H0) / Math.max(1e-6, 1 - q3 * q3)));
  };
  function buildSurface(): void {
    let v = 0;
    for (let i = 0; i <= NU; i++) {
      const phi = (i / NU) * TWO_PI, cp = Math.cos(phi), sp = Math.sin(phi);
      for (let j = 0; j <= NV; j++) {
        const q3 = -QFUN + (2 * QFUN * j) / NV;
        const rr = Math.min(RHO_MAX, rhoTurn(q3));
        sPos[v * 3] = px(rr * cp); sPos[v * 3 + 1] = py(q3); sPos[v * 3 + 2] = pz(rr * sp); v++;
      }
    }
    surfGeo.attributes['position'].needsUpdate = true;
  }
  // 两个喉口（turning points）与竖直周期轨道本身
  const neckMat = mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
  for (const s of [1, -1]) {
    const g = geo(new THREE.SphereGeometry(0.055, 12, 10));
    const m = new THREE.Mesh(g, neckMat);
    m.position.set(px(0), py(s * AMAX), pz(0));
    group.add(m);
  }
  {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([px(0), py(-QFUN), pz(0), px(0), py(QFUN), pz(0)]), 3));
    group.add(new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.55 }))));
  }

  // —— 正则方程右端（6D 状态 [q₁,q₂,q₃,p₁,p₂,p₃]）——
  function deriv6(src: Float64Array, so: number, out: Float64Array, oo: number): void {
    const q1 = src[so], q2 = src[so + 1], q3 = src[so + 2];
    out[oo] = src[so + 3]; out[oo + 1] = src[so + 4]; out[oo + 2] = src[so + 5];
    out[oo + 3] = q1 * (1 - q3 * q3); out[oo + 4] = q2 * (1 - q3 * q3);
    out[oo + 5] = -q3 * (q1 * q1 + q2 * q2 + 1);
  }
  const e1 = new Float64Array(6), e2 = new Float64Array(6), e3 = new Float64Array(6), e4 = new Float64Array(6), eb = new Float64Array(6);
  function orbitStep(s: Float64Array, h: number): void {
    deriv6(s, 0, e1, 0);
    for (let m = 0; m < 6; m++) eb[m] = s[m] + (h / 2) * e1[m]; deriv6(eb, 0, e2, 0);
    for (let m = 0; m < 6; m++) eb[m] = s[m] + (h / 2) * e2[m]; deriv6(eb, 0, e3, 0);
    for (let m = 0; m < 6; m++) eb[m] = s[m] + h * e3[m]; deriv6(eb, 0, e4, 0);
    for (let m = 0; m < 6; m++) s[m] += (h / 6) * (e1[m] + 2 * e2[m] + 2 * e3[m] + e4[m]);
  }

  // —— ② 6 条真实轨迹：贴着竖直轨道起步，被横向指数失稳甩出漏斗 ——
  const NT = 6, TLEN = 120;
  const tState: Float64Array[] = [];
  const tGeo: import('three').BufferGeometry[] = [];
  const tPos: Float32Array[] = [];
  const tMat = mat(new THREE.LineBasicMaterial({ color: 0xfb7185, transparent: true, opacity: 0.9 }));
  for (let k = 0; k < NT; k++) {
    const s = new Float64Array(6); tState.push(s);
    const g = geo(new THREE.BufferGeometry());
    const arr = new Float32Array(TLEN * 3); tPos.push(arr);
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    group.add(new THREE.Line(g, tMat)); tGeo.push(g);
  }
  function seedTrail(k: number): void {
    const s = tState[k], th = (k / NT) * TWO_PI, tau = (k / NT) * TWO_PI;
    s[0] = 0.02 * Math.cos(th); s[1] = 0.02 * Math.sin(th); s[2] = AMAX * Math.cos(tau);
    s[3] = 0; s[4] = 0; s[5] = -AMAX * Math.sin(tau);           // 严格竖直解的相位 ⇒ 只靠 0.02 的横向偏差起爆
    const arr = tPos[k];
    for (let i = 0; i < TLEN; i++) { arr[i * 3] = px(s[0]); arr[i * 3 + 1] = py(s[2]); arr[i * 3 + 2] = pz(s[1]); }
    tGeo[k].attributes['position'].needsUpdate = true;
  }
  let trailEsc = 0;
  function stepTrails(h: number): void {
    for (let k = 0; k < NT; k++) {
      const s = tState[k], arr = tPos[k];
      orbitStep(s, h);
      if (!Number.isFinite(s[0]) || Math.hypot(s[0], s[1]) > RHO_MAX) { seedTrail(k); trailEsc++; continue; }
      for (let i = 0; i < TLEN - 1; i++) { arr[i * 3] = arr[i * 3 + 3]; arr[i * 3 + 1] = arr[i * 3 + 4]; arr[i * 3 + 2] = arr[i * 3 + 5]; }
      arr[(TLEN - 1) * 3] = px(s[0]); arr[(TLEN - 1) * 3 + 1] = py(s[2]); arr[(TLEN - 1) * 3 + 2] = pz(s[1]);
      tGeo[k].attributes['position'].needsUpdate = true;
    }
  }

  // —— 180 代表点云团（大小有限 ⇒ 只演示"沿不稳定流形逃逸成丝"，不是相体积元）——
  const NP = 180;
  const st = new Float64Array(NP * 6);
  const esc = new Uint8Array(NP);
  const lastPos = new Float32Array(NP * 3);
  const cloudGeo = geo(new THREE.BufferGeometry());
  const cPos = new Float32Array(NP * 3), cCol = new Float32Array(NP * 3);
  cloudGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
  cloudGeo.setAttribute('color', new THREE.BufferAttribute(cCol, 3));
  group.add(new THREE.Points(cloudGeo, mat(new THREE.PointsMaterial({ vertexColors: true, size: 0.075, transparent: true, opacity: 0.95 }))));
  const rnd = (i: number, k: number): number => { const s = Math.sin(i * 91.7 + k * 47.3) * 3719.17; return s - Math.floor(s); };
  let rhoSpan0 = 1, rhoSpan = 1, nAlive = NP;
  function seedBlob(): void {
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < NP; i++) {
      const o = i * 6, v = i * 3;
      st[o] = -0.05 + rnd(i, 1) * 0.1; st[o + 1] = -0.05 + rnd(i, 2) * 0.1; st[o + 2] = -0.38 + rnd(i, 3) * 0.76;
      st[o + 3] = -0.05 + rnd(i, 4) * 0.1; st[o + 4] = -0.05 + rnd(i, 5) * 0.1; st[o + 5] = -0.34 + rnd(i, 6) * 0.68;
      esc[i] = 0;
      const rr = Math.hypot(st[o], st[o + 1]); mn = Math.min(mn, rr); mx = Math.max(mx, rr);
      const cc = new THREE.Color().setHSL(rnd(i, 7), 0.75, 0.62);
      cCol[v] = cc.r; cCol[v + 1] = cc.g; cCol[v + 2] = cc.b;
      lastPos[v] = px(st[o]); lastPos[v + 1] = py(st[o + 2]); lastPos[v + 2] = pz(st[o + 1]);
    }
    rhoSpan0 = Math.max(0.02, mx - mn);
    cloudGeo.attributes['color'].needsUpdate = true;
  }
  const ybuf = new Float64Array(6);
  function stepBlob(h: number): void {
    for (let i = 0; i < NP; i++) {
      if (esc[i]) continue;
      const o = i * 6;
      for (let m = 0; m < 6; m++) ybuf[m] = st[o + m];
      orbitStep(ybuf, h);
      for (let m = 0; m < 6; m++) st[o + m] = ybuf[m];
    }
  }
  function updateCloud(): void {
    let mx = 0, dimmed = false, alive = 0;
    for (let i = 0; i < NP; i++) {
      const o = i * 6, v = i * 3, q1 = st[o], q2 = st[o + 1], q3 = st[o + 2];
      if (!esc[i]) {
        if (!Number.isFinite(q1 + q2 + q3) || Math.hypot(q1, q2) > RHO_MAX || Math.abs(q3) > 2.4) {
          esc[i] = 1; dimmed = true;                            // 甩出漏斗口：冻结在边界并变暗，18 s 一轮重新播种
        } else {
          lastPos[v] = px(q1); lastPos[v + 1] = py(q3); lastPos[v + 2] = pz(q2);
          mx = Math.max(mx, Math.hypot(q1, q2)); alive++;
        }
      }
      cPos[v] = lastPos[v]; cPos[v + 1] = lastPos[v + 1]; cPos[v + 2] = lastPos[v + 2];
    }
    if (dimmed) {
      for (let i = 0; i < NP; i++) if (esc[i]) { const w = i * 3; cCol[w] = 0.14; cCol[w + 1] = 0.17; cCol[w + 2] = 0.22; }
      cloudGeo.attributes['color'].needsUpdate = true;
    }
    cloudGeo.attributes['position'].needsUpdate = true;
    rhoSpan = mx / rhoSpan0; nAlive = alive;
  }

  // —— ④ 参考轨道（严格竖直周期解）+ 切线线性流：真正的无穷小 6D 相体积元 ——
  // Y[0..5] = 参考轨道；Y[6..41] = 框架 T（列主序 T[c*6+r]，第 c 列 = 第 c 个单位基向量的切线像）
  const Y = new Float64Array(42);
  const k1 = new Float64Array(42), k2 = new Float64Array(42), k3 = new Float64Array(42), k4 = new Float64Array(42), kb = new Float64Array(42);
  const colN0 = new Float64Array(6);
  let det0 = 1, detRatio = 1, strMax = 1, strMin = 1, shapeF = 1, nStretch = 0, nCompress = 0, hRef = H0, hDrift = 0;
  // δṡ = J(s)·δs：J 由上面的正则方程对 (q,p) 直接求导（在参考轨道同一点取值）
  function derivY(src: Float64Array, out: Float64Array): void {
    const q1 = src[0], q2 = src[1], q3 = src[2];
    out[0] = src[3]; out[1] = src[4]; out[2] = src[5];
    out[3] = q1 * (1 - q3 * q3); out[4] = q2 * (1 - q3 * q3);
    out[5] = -q3 * (q1 * q1 + q2 * q2 + 1);
    const a = 1 - q3 * q3, b1 = -2 * q1 * q3, b2 = -2 * q2 * q3, c3 = -(q1 * q1 + q2 * q2 + 1);
    for (let col = 0; col < 6; col++) {
      const o = 6 + col * 6, dq1 = src[o], dq2 = src[o + 1], dq3 = src[o + 2];
      out[o] = src[o + 3]; out[o + 1] = src[o + 4]; out[o + 2] = src[o + 5];
      out[o + 3] = a * dq1 + b1 * dq3; out[o + 4] = a * dq2 + b2 * dq3;
      out[o + 5] = b1 * dq1 + b2 * dq2 + c3 * dq3;
    }
  }
  const colNorm = (c: number): number => { let s = 0; for (let r = 0; r < 6; r++) { const x = Y[6 + c * 6 + r]; s += x * x; } return Math.sqrt(s); };
  function detT(): number {                                        // |det T|：高斯消元 + 部分主元
    const m: number[][] = [];
    for (let r = 0; r < 6; r++) { const row: number[] = []; for (let c = 0; c < 6; c++) row.push(Y[6 + c * 6 + r]); m.push(row); }
    let det = 1;
    for (let col = 0; col < 6; col++) {
      let piv = col;
      for (let r = col + 1; r < 6; r++) if (Math.abs(m[r][col]) > Math.abs(m[piv][col])) piv = r;
      if (piv !== col) { const sw = m[col]; m[col] = m[piv]; m[piv] = sw; det = -det; }
      const pv = m[col][col];
      if (Math.abs(pv) < 1e-300) return 0;
      det *= pv;
      for (let r = col + 1; r < 6; r++) { const f = m[r][col] / pv; for (let c = col; c < 6; c++) m[r][c] -= f * m[col][c]; }
    }
    return det;
  }
  function frameStep(h: number): void {                            // 参考轨道与框架同一次 RK4 耦合 ⇒ 时间一致
    derivY(Y, k1);
    for (let i = 0; i < 42; i++) kb[i] = Y[i] + (h / 2) * k1[i]; derivY(kb, k2);
    for (let i = 0; i < 42; i++) kb[i] = Y[i] + (h / 2) * k2[i]; derivY(kb, k3);
    for (let i = 0; i < 42; i++) kb[i] = Y[i] + h * k3[i]; derivY(kb, k4);
    for (let i = 0; i < 42; i++) Y[i] += (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  }
  function seedFrame(): void {
    for (let i = 0; i < 42; i++) Y[i] = 0;
    Y[2] = AMAX; Y[5] = 0;                                          // 竖直轨道 turning point：ρ=0, q₃=A, p=0
    for (let c = 0; c < 6; c++) Y[6 + c * 6 + c] = 1;               // T(0) = I
    det0 = Math.abs(detT()) || 1;
    for (let c = 0; c < 6; c++) colN0[c] = colNorm(c);
  }

  // 6 条偏差向量 = 从参考点引出的线段；显示长度 0.78·(1+log₁₀(‖δ‖/‖δ₀‖)) 只压缩显示，det 度量不动
  const frGeo = geo(new THREE.BufferGeometry());
  const frPos = new Float32Array(12 * 3), frCol = new Float32Array(12 * 3);
  frGeo.setAttribute('position', new THREE.BufferAttribute(frPos, 3));
  frGeo.setAttribute('color', new THREE.BufferAttribute(frCol, 3));
  group.add(new THREE.LineSegments(frGeo, mat(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 }))));
  const dotGeo = geo(new THREE.BufferGeometry());
  const dotPos = new Float32Array(3);
  dotGeo.setAttribute('position', new THREE.BufferAttribute(dotPos, 3));
  group.add(new THREE.Points(dotGeo, mat(new THREE.PointsMaterial({ color: 0xf8fafc, size: 0.3, sizeAttenuation: true }))));
  const C_STRETCH = new THREE.Color(0xfb7185), C_SHRINK = new THREE.Color(0x38bdf8), C_NEUTRAL = new THREE.Color(0x94a3b8);
  function updateFrame(): void {
    const rx = px(Y[0]), ry = py(Y[2]), rz = pz(Y[1]);
    dotPos[0] = rx; dotPos[1] = ry; dotPos[2] = rz;
    dotGeo.attributes['position'].needsUpdate = true;
    let mx = 0, mn = 0, ns = 0, nc = 0, prod = 1;
    for (let c = 0; c < 6; c++) {
      const o = 6 + c * 6, f = colNorm(c) / Math.max(1e-300, colN0[c]);   // 该方向拉伸因子 ‖δ‖/‖δ₀‖
      if (c === 0 || f > mx) mx = f;
      if (c === 0 || f < mn) mn = f;
      prod *= f;
      if (f > 1.02) ns++; else if (f < 0.98) nc++;
      const cw = f > 1.02 ? C_STRETCH : f < 0.98 ? C_SHRINK : C_NEUTRAL;
      let dx = Y[o] * SX, dy = Y[o + 2] * SY, dz = Y[o + 1] * SZ;         // 方向取偏差的位形分量
      let L = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (L < 1e-9) { dx = Y[o + 3] * SX; dy = Y[o + 5] * SY; dz = Y[o + 4] * SZ; L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1; }
      const len = Math.min(3.1, Math.max(0.08, 0.72 * (1 + Math.log10(Math.max(1e-8, f)))));
      const v = c * 6, ex = (dx / L) * len, ey = (dy / L) * len, ez = (dz / L) * len;
      frPos[v] = rx; frPos[v + 1] = ry; frPos[v + 2] = rz; frPos[v + 3] = rx + ex; frPos[v + 4] = ry + ey; frPos[v + 5] = rz + ez;
      for (let e = 0; e < 2; e++) { frCol[v + e * 3] = cw.r; frCol[v + e * 3 + 1] = cw.g; frCol[v + e * 3 + 2] = cw.b; }
    }
    frGeo.attributes['position'].needsUpdate = true;
    frGeo.attributes['color'].needsUpdate = true;
    const dt = detT();
    detRatio = Math.abs(dt) / det0; strMax = mx; strMin = mn; nStretch = ns; nCompress = nc;
    shapeF = detRatio / Math.max(1e-300, prod);                          // 多元角正弦：→0 即各列共面
    hRef = (Y[3] * Y[3] + Y[4] * Y[4] + Y[5] * Y[5]) / 2
      + (Y[0] * Y[0] + Y[1] * Y[1]) * (Y[2] * Y[2] - 1) / 2 + Y[2] * Y[2] / 2;
    hDrift = (hRef - H0) / H0;
  }

  // —— 面板（canvas 精灵，5 Hz 刷新）——
  const infoCv = document.createElement('canvas');
  infoCv.width = 800; infoCv.height = 330;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(8.6, 3.55)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 5.4, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);
  function drawInfo(t: number): void {
    infoCtx.clearRect(0, 0, 800, 330);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)'; infoCtx.fillRect(4, 4, 792, 322);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 792, 322);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 25px "PingFang SC", sans-serif';
    infoCtx.fillText('哈密顿力学：切线线性流 δṡ = J(s)·δs 与刘维尔定理 det≡1', 22, 36);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '19px "PingFang SC", sans-serif';
    infoCtx.fillText('H = ½|p|² + ½ρ²(q₃²−1) + ½q₃² ⇒ q̇ = p, ṗ₁ = q₁(1−q₃²), ṗ₃ = −q₃(ρ²+1)', 22, 66);
    infoCtx.fillText('严格解 ρ=0：q₃(t) = A·cos t, A = √(2H) = 0.447；横向 ρ̈ = (1−q₃²)ρ ⇒ e^{0.93t} 失稳', 22, 92);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('零速面 V=H：ρ_turn = √((q₃²−2H)/(1−q₃²))，喉口在 turning point，张开方向即逃逸通道', 22, 122);
    infoCtx.fillText('哈密顿流散度自由 ⇒ |det T| ≡ 1：列拉伸 10ⁿ 倍，靠各列共面（形状因子塌向 0）补偿', 22, 148);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 21px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数 t = ${(t % 18).toFixed(1)}s  |det T|/|det T₀| = ${detRatio.toFixed(5)}  形状因子 = ${shapeF.toExponential(2)}`, 22, 182);
    infoCtx.fillText(`列拉伸 max = ${strMax.toExponential(2)}×  min = ${strMin.toExponential(2)}×  拉伸 ${nStretch} 条 / 压缩 ${nCompress} 条`, 22, 208);
    infoCtx.fillText(`参考轨道 H 漂移 = ${hDrift.toExponential(1)}（RK4 自检）  云团 ρ 展 = ${rhoSpan.toFixed(1)}×  仍在框内 ${nAlive}/180`, 22, 234);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '19px "PingFang SC", sans-serif';
    infoCtx.fillText('六条线段 = T 的 6 列 = 6 个单位基向量的切线像；方向取偏差的位形分量', 22, 266);
    infoCtx.fillText('显示长度 ∝ 1+log₁₀(‖δ‖/‖δ₀‖) 仅压缩显示，det 度量未被缩放；粉红拉伸/蓝压缩/灰中性', 22, 290);
    infoCtx.fillText(`有限大小云团 ≠ 相体积元：除竖直轨道外全部沿漏斗逃逸（本轮已甩出 ${trailEsc} 次）`, 22, 314);
    infoTex.needsUpdate = true;
  }

  buildSurface();
  for (let k = 0; k < NT; k++) seedTrail(k);
  seedBlob(); seedFrame(); updateCloud(); updateFrame(); drawInfo(0);
  let lastCycle = -1;
  return {
    update(t, dt) {
      // 扫描自变量 = 流动时间（18 s 一轮：重新播种，比较两次积分一致性）
      const cyc = Math.floor(t / 18);
      if (cyc !== lastCycle) { lastCycle = cyc; seedBlob(); seedFrame(); for (let k = 0; k < NT; k++) seedTrail(k); }
      const dts = Math.min(0.1, dt > 0 ? dt : 0.016);
      const nsub = Math.max(1, Math.min(40, Math.ceil(dts / 0.005)));  // 框架用细步：det 恒到 5 位小数需 h ≲ 5 ms
      for (let s = 0; s < nsub; s++) { frameStep(dts / nsub); stepTrails(dts / nsub); }
      const bsteps = Math.max(1, Math.min(4, Math.ceil(dts / 0.016)));
      for (let s = 0; s < bsteps; s++) stepBlob(dts / bsteps);
      updateCloud(); updateFrame();
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo(t);
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
