import type { SceneContext, SceneInstance } from '../types';

/**
 * 维纳路径：连续却处处不可微 🟢（布朗运动样本轨道）
 *
 * 核心公式（画面全部由此驱动，与随机增量同源）：
 *   随机增量  X_{n+1} = X_n + sqrt(2·D·dt)·ξ,  ξ ~ N(0,1)（Box–Muller 极形式）
 *   扩散标度  ⟨x²(t)⟩ = 2·∫₀ᵗ D dτ（D 恒定即 2Dt；D̄ = (1/t)∫D dτ 为时均）
 *   不可微性  (Δx/Δt)_rms(Δ) ≈ sqrt(2D/Δ) → ∞（Δ→0 差商发散 ⇒ 处处不可导）
 * 画面：K=24 条真随机游走尾迹沿时间生长的系综 + ±1σ 理论包络；
 *       尺度细化窗（全窗 → ×1/6 → ×1/36 放大同一条轨迹，锯齿永不抚平）；
 *       ⟨x²⟩–t 实测曲线与 2D̄t 理论线来自同一随机流逐步累加。
 * 扫描自变量：D 在每个 16.5 s 循环内从 0.15 连续爬坡到 D₁∈{0.7,1.4,2.4}，
 *       步长 sqrt(2D·dt) 随之变大、扇形展宽与 MSD 弯曲同步可见。
 * MSD 数值验证（一次性脚本，复刻同款步进公式）：
 *   node _scratch/r4fix/wiener/msd-check.mjs
 *   恒定 D=1.0 系综 K=20000 拟合斜率 2.020≈2D；D=0.5 斜率 1.011≈2D；
 *   斜坡工况终点 ⟨x²⟩/2∫Ddτ = 0.969~1.031（K=8000），场景 K=24 多循环平均 ≈1.00。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  // —— 资源登记，dispose 时统一释放 ——
  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  // —— 模拟参数（与 msd-check.mjs 一致）——
  const DT = 0.02;                 // 随机步长（模拟秒）
  const GROW = 13.0;               // 每循环生长时长
  const PERIOD = 16.5;             // 生长 13 s + 定格检视 3.5 s
  const MAXN1 = Math.round(GROW / DT) + 1; // 651 顶点/轨迹
  const K = 24;                    // 系综轨迹条数
  const D0 = 0.15;                 // 每循环 D 由此爬坡
  const D1S = [0.7, 1.4, 2.4];     // 循环轮换的终点扩散系数（扫描自变量）
  const SCALE_Y = 0.3;             // 位移 → 世界坐标
  const X0W = -4.2, XSPAN = 8.4;   // 时间轴世界区间
  const xWorld = (tau: number): number => X0W + XSPAN * (tau / GROW);
  const zOff = (i: number): number => -1.5 + 3 * (i / (K - 1));

  // Box–Muller（极形式）标准正态
  let spare: number | null = null;
  function gauss(): number {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let u = 0, v = 0, s = 0;
    do {
      u = Math.random() * 2 - 1;
      v = Math.random() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const m = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * m;
    return u * m;
  }

  // —— 状态数组：xs 为 K 条轨迹，msdArr/theoArr 与随机流同源累加 ——
  const xs = new Float64Array(K * MAXN1);
  const msdArr = new Float64Array(MAXN1);
  const theoArr = new Float64Array(MAXN1);
  let nSteps = 0, theoVar = 0, cycleIdx = 0, d1Cur = D1S[0];

  // —— 星野与地面栅格（脚手架）——
  const starGeo = geo(new THREE.BufferGeometry());
  const starPos = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 200;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // —— 绘图坐标系：水平时间轴 + t=0 竖直位移轴 ——
  const axisMat = mat(new THREE.LineBasicMaterial({ color: 0x475569 }));
  const tAxGeo = geo(new THREE.BufferGeometry());
  tAxGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([xWorld(0), -2.7, 0, xWorld(GROW) + 0.5, -2.7, 0]), 3));
  group.add(new THREE.Line(tAxGeo, axisMat));
  const yAxGeo = geo(new THREE.BufferGeometry());
  yAxGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([xWorld(0), -2.7, 0, xWorld(0), 2.7, 0]), 3));
  group.add(new THREE.Line(yAxGeo, axisMat));

  // —— 系综尾迹：K 条 Line，逐随机步生长（drawRange 控制可见长度）——
  const PALETTE = [0x22d3ee, 0xa855f7, 0x22c55e, 0xf472b6];
  const trGeo: import('three').BufferGeometry[] = [];
  const trPos: import('three').BufferAttribute[] = [];
  for (let i = 0; i < K; i++) {
    const g = geo(new THREE.BufferGeometry());
    const a = new THREE.BufferAttribute(new Float32Array(MAXN1 * 3), 3);
    g.setAttribute('position', a);
    const hl = i === 0;
    g.setDrawRange(0, 1);
    group.add(new THREE.Line(g, mat(new THREE.LineBasicMaterial({
      color: hl ? 0xfbbf24 : PALETTE[i % 4],
      transparent: true, opacity: hl ? 1.0 : 0.55,
    }))));
    trGeo.push(g); trPos.push(a);
  }
  // 轨迹 0 的当前头部小球（放大观察对象）
  const headGeo = geo(new THREE.SphereGeometry(0.1, 12, 12));
  const headMat = mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
  const head = new THREE.Mesh(headGeo, headMat);
  group.add(head);

  // —— ±1σ 理论包络 y = ±sqrt(2∫D dτ)，与随机步同一 theoVar 变量 ——
  const envGeo = geo(new THREE.BufferGeometry());
  const envPos = new THREE.BufferAttribute(new Float32Array((MAXN1 - 1) * 4 * 3), 3);
  envGeo.setAttribute('position', envPos);
  const envLine = new THREE.LineSegments(envGeo, mat(new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.6 })));
  group.add(envLine);

  // —— 文字标签（Sprite）——
  function makeLabel(text: string, color: string, scale = 4.2): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 30px "PingFang SC", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const t = tex(new THREE.CanvasTexture(cv));
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: t, transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  const lblTitle = makeLabel(`维纳路径系综 K=${K}：连续、处处不可微`, '#94a3b8', 5.2);
  lblTitle.position.set(0, 3.4, 0);
  group.add(lblTitle);
  const lblT = makeLabel('t →', '#94a3b8', 2.2);
  lblT.position.set(xWorld(GROW) + 0.4, -3.15, 0);
  group.add(lblT);
  const lblX = makeLabel('x(t)', '#94a3b8', 2.2);
  lblX.position.set(xWorld(0) - 0.9, 2.9, 0);
  group.add(lblX);

  // —— 画布面板工具 ——
  function makePanel(cvW: number, cvH: number, planeW: number, x: number, y: number, z: number):
    { cv: HTMLCanvasElement; c: CanvasRenderingContext2D; texture: import('three').CanvasTexture } {
    const cv = document.createElement('canvas');
    cv.width = cvW; cv.height = cvH;
    const c = cv.getContext('2d')!;
    const texture = tex(new THREE.CanvasTexture(cv));
    const plane = new THREE.Mesh(
      geo(new THREE.PlaneGeometry(planeW, planeW * cvH / cvW)),
      mat(new THREE.MeshBasicMaterial({ map: texture, transparent: true })),
    );
    plane.position.set(x, y, z);
    plane.rotation.x = -0.5; // 朝默认相机（高位俯视）倾斜
    group.add(plane);
    return { cv, c, texture };
  }
  const zoom = makePanel(512, 368, 4.6, -2.6, -3.5, 1.2);   // 尺度细化观察
  const msdP = makePanel(400, 320, 4.2, 2.6, -3.5, 1.2);    // ⟨x²⟩–t vs 2D̄t

  // —— 读数信息板（顶部）——
  const infoCv = document.createElement('canvas');
  infoCv.width = 800; infoCv.height = 240;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(8.8, 2.64)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 5.4, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  // —— 单步随机增量：X_{n+1} = X_n + sqrt(2D dt)·ξ，同步刷新 MSD/理论/包络 ——
  function step(): void {
    const tau = nSteps * DT;
    const D = D0 + (d1Cur - D0) * (tau / GROW);      // 本循环内的 D 斜坡（扫描自变量）
    const sig = Math.sqrt(2 * D * DT);
    let sq = 0;
    for (let i = 0; i < K; i++) {
      const b = i * MAXN1;
      const nx = xs[b + nSteps] + sig * gauss();
      xs[b + nSteps + 1] = nx;
      sq += nx * nx;
      trPos[i].setXYZ(nSteps + 1, xWorld(tau + DT), nx * SCALE_Y, zOff(i));
    }
    theoVar += 2 * D * DT;                            // 理论 2∫D dτ，与增量方差严格同源
    nSteps++;
    msdArr[nSteps] = sq / K;
    theoArr[nSteps] = theoVar;
    const s = Math.sqrt(theoVar) * SCALE_Y;           // ±1σ 包络：每段两条独立线段（4 顶点）
    const arr = envPos.array as Float32Array;
    const px0 = xWorld((nSteps - 1) * DT), px1 = xWorld(nSteps * DT);
    const e = (nSteps - 1) * 12;
    arr[e + 0] = px0; arr[e + 1] = s; arr[e + 3] = px1; arr[e + 4] = s;
    arr[e + 6] = px0; arr[e + 7] = -s; arr[e + 9] = px1; arr[e + 10] = -s;
  }

  function resetEnsemble(): void {
    xs.fill(0); msdArr.fill(0); theoArr.fill(0);
    nSteps = 0; theoVar = 0; spare = null;
    for (let i = 0; i < K; i++) {
      trGeo[i].setDrawRange(0, 1);
      trPos[i].setXYZ(0, xWorld(0), 0, zOff(i));
      trPos[i].needsUpdate = true;
    }
    envGeo.setDrawRange(0, 0);
  }

  // —— 差商 rms：q(Δ)=[x(t+Δ)−x(t)]/Δ 在窗口内的均方根，Δ 取窗宽/25 ——
  function slopeRms(a: number, b: number): number {
    const tauNow = nSteps * DT;
    if (tauNow < 2 * DT) return 0;
    const lo = Math.max(0, Math.min(a, tauNow - DT));
    const hi = Math.max(lo + DT, Math.min(b, tauNow));
    let k = Math.max(1, Math.round(((hi - lo) / 25) / DT));
    const dl = k * DT;
    const n1 = Math.floor(hi / DT);
    let s = 0, c = 0;
    for (let n = Math.ceil(lo / DT); n + k <= n1; n += k) {
      const q = (xs[n + k] - xs[n]) / dl;
      s += q * q; c++;
    }
    return c > 0 ? Math.sqrt(s / c) : 0;
  }

  // —— 尺度细化面板：同一条（金色）轨迹在全窗/×(1/6)/×(1/36) 下的形态 ——
  function drawZoom(): void {
    const { c, cv } = zoom; const texture = zoom.texture;
    const tauNow = nSteps * DT;
    c.fillStyle = 'rgba(7,11,20,0.88)'; c.fillRect(0, 0, cv.width, cv.height);
    c.strokeStyle = '#334155'; c.lineWidth = 3; c.strokeRect(3, 3, cv.width - 6, cv.height - 6);
    c.textAlign = 'left'; c.fillStyle = '#f8fafc'; c.font = 'bold 20px "PingFang SC", sans-serif';
    c.fillText('尺度细化观察（金色轨迹）：放大后仍是锯齿', 14, 28);
    const rowCols = ['#22d3ee', '#a855f7', '#f472b6'];
    const rowTops = [44, 136, 228], rowH = 88, px0 = 132, px1 = 498;
    const tc = Math.min(Math.max(0.72 * tauNow, 0.4), tauNow - 0.4);
    const wins: [number, number][] = [
      [0, tauNow],
      [tc - GROW / 12, tc + GROW / 12],           // 窗宽 GROW/6 ≈ 2.17 s
      [tc - GROW / 72, tc + GROW / 72],           // 窗宽 GROW/36 ≈ 0.36 s
    ];
    for (let r = 0; r < 3; r++) {
      const midY = rowTops[r] + rowH / 2;
      c.fillStyle = '#0b1220'; c.fillRect(px0, rowTops[r], px1 - px0, rowH);
      c.strokeStyle = '#1e293b'; c.lineWidth = 1; c.strokeRect(px0, rowTops[r], px1 - px0, rowH);
      c.beginPath(); c.moveTo(px0, midY); c.lineTo(px1, midY); c.stroke();
      if (tauNow < 1.2) {
        c.fillStyle = '#94a3b8'; c.font = '16px "PingFang SC", sans-serif';
        c.fillText('数据积累中…', px0 + 10, midY - 6);
        continue;
      }
      let [a, b] = wins[r];
      a = Math.max(0, a); b = Math.min(tauNow, b);
      const na = Math.ceil(a / DT), nb = Math.floor(b / DT);
      if (nb - na < 2) continue;
      const nRef = Math.round(((r === 0 ? tauNow / 2 : (a + b) / 2)) / DT);
      const xRef = xs[Math.min(MAXN1 - 1, nRef)];
      let amp = 1e-4;
      for (let n = na; n <= nb; n++) amp = Math.max(amp, Math.abs(xs[n] - xRef));
      c.strokeStyle = rowCols[r]; c.lineWidth = 1.6;
      c.beginPath();
      for (let n = na; n <= nb; n++) {
        const px = px0 + ((n * DT - a) / (b - a)) * (px1 - px0);
        const py = midY - ((xs[n] - xRef) / amp) * (rowH / 2 - 7);
        if (n === na) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
      const dl = (b - a) / 25;
      c.fillStyle = '#94a3b8'; c.font = '16px "PingFang SC", sans-serif';
      c.fillText(`窗宽 Δ=${(b - a).toFixed(2)}s`, 12, midY - 16);
      c.fillStyle = rowCols[r];
      c.fillText(`(Δx/Δt)rms`, 12, midY + 4);
      c.fillText(`= ${slopeRms(a, b).toFixed(2)}`, 12, midY + 24);
    }
    c.fillStyle = '#fbbf24'; c.font = 'bold 18px "PingFang SC", sans-serif';
    c.fillText('Δt 缩小 ×6 → 差商 rms×≈√6，锯齿不抚平 ⇒ 导数不存在', 14, 352);
    texture.needsUpdate = true;
  }

  // —— MSD 面板：系综实测 ⟨x²⟩ 与理论 2∫D dτ 同源叠加 ——
  function drawMsd(): void {
    const { c, cv } = msdP; const texture = msdP.texture;
    c.fillStyle = 'rgba(7,11,20,0.88)'; c.fillRect(0, 0, cv.width, cv.height);
    c.strokeStyle = '#334155'; c.lineWidth = 3; c.strokeRect(3, 3, cv.width - 6, cv.height - 6);
    c.textAlign = 'left'; c.fillStyle = '#f8fafc'; c.font = 'bold 18px "PingFang SC", sans-serif';
    c.fillText(`⟨x²⟩–t：${K} 条轨迹系综`, 14, 26);
    const L = 50, R = cv.width - 14, T = 44, B = cv.height - 38;
    const tauNow = Math.max(nSteps * DT, 0.5);
    const ymax = Math.max(theoArr[nSteps], msdArr[nSteps], 1e-3) * 1.25;
    // 坐标轴
    c.strokeStyle = '#334155'; c.lineWidth = 1;
    c.strokeRect(L, T, R - L, B - T);
    c.fillStyle = '#94a3b8'; c.font = '14px "PingFang SC", sans-serif';
    c.fillText('t (s)', R - 34, B + 18);
    c.fillText('⟨x²⟩', 8, T + 4);
    const pxOf = (tau: number): number => L + (tau / tauNow) * (R - L);
    const pyOf = (v: number): number => B - (v / ymax) * (B - T);
    // 理论线 2∫D dτ（金色）
    c.strokeStyle = '#fbbf24'; c.lineWidth = 2; c.beginPath();
    for (let n = 0; n <= nSteps; n += 4) {
      const px = pxOf(n * DT), py = pyOf(theoArr[n]);
      if (n === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    if (nSteps % 4 !== 0) c.lineTo(pxOf(nSteps * DT), pyOf(theoArr[nSteps]));
    c.stroke();
    // 系综实测（青色，天然带 ~sqrt(2/K) 涨落）
    c.strokeStyle = '#22d3ee'; c.lineWidth = 1.5; c.beginPath();
    for (let n = 0; n <= nSteps; n += 4) {
      const px = pxOf(n * DT), py = pyOf(msdArr[n]);
      if (n === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    if (nSteps % 4 !== 0) c.lineTo(pxOf(nSteps * DT), pyOf(msdArr[nSteps]));
    c.stroke();
    const ratio = theoArr[nSteps] > 1e-9 ? msdArr[nSteps] / theoArr[nSteps] : 1;
    c.fillStyle = Math.abs(ratio - 1) < 0.2 ? '#22c55e' : '#94a3b8';
    c.font = 'bold 16px "PingFang SC", sans-serif';
    c.fillText(`⟨x²⟩/2D̄t = ${ratio.toFixed(3)}`, L + 8, T + 18);
    c.fillStyle = '#94a3b8'; c.font = '13px "PingFang SC", sans-serif';
    c.fillText('金线 2D̄t · 青线 系综实测', L + 8, B - 8);
    texture.needsUpdate = true;
  }

  // —— 读数信息板 ——
  function drawInfo(t: number): void {
    const phase = t - Math.floor(t / PERIOD) * PERIOD;
    const tau = Math.min(phase, GROW);
    const Dnow = D0 + (d1Cur - D0) * (tau / GROW);
    const Dbar = tau > 1e-6 ? theoVar / (2 * tau) : 0;
    const ratio = theoVar > 1e-9 ? msdArr[nSteps] / theoVar : 1;
    infoCtx.clearRect(0, 0, 800, 240);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 792, 232);
    infoCtx.strokeStyle = '#334155';
    infoCtx.lineWidth = 3;
    infoCtx.strokeRect(4, 4, 792, 232);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 29px "PingFang SC", sans-serif';
    infoCtx.fillText(`维纳路径（布朗轨道）  X(n+1) = X(n) + √(2D·dt)·ξ，  ξ ~ N(0,1) Box–Muller`, 22, 42);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '26px "PingFang SC", sans-serif';
    infoCtx.fillText(`扩散标度  ⟨x²(t)⟩ = 2D̄t，D̄=(1/t)∫D dτ —— 曲线与随机增量同源，系综 K=${K}`, 22, 84);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText(`尺度细化  |Δx/Δt|rms ≈ √(2D/Δt)：Δt→0 发散 ⇒ 连续却处处不可微`, 22, 124);
    infoCtx.fillStyle = '#f472b6';
    infoCtx.fillText(`本循环 D 斜坡 0.15 → ${d1Cur.toFixed(1)}（第 ${cycleIdx % 3 + 1}/3 组，步长 √(2D·dt) 随之增大）`, 22, 164);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：D=${Dnow.toFixed(2)}  D̄=${Dbar.toFixed(2)}  t=${tau.toFixed(1)}s  ⟨x²⟩=${msdArr[nSteps].toFixed(2)}  2D̄t=${theoVar.toFixed(2)}  比值=${ratio.toFixed(3)}`,
      22, 206,
    );
    infoTex.needsUpdate = true;
  }

  // —— 初始状态 ——
  resetEnsemble();
  d1Cur = D1S[0];
  drawZoom(); drawMsd(); drawInfo(0);

  return {
    update(t, dt) {
      const cyc = Math.floor(t / PERIOD);
      if (cyc !== cycleIdx) {                 // 新循环：换 D₁、清空系综重新生长
        cycleIdx = cyc;
        d1Cur = D1S[cyc % D1S.length];
        resetEnsemble();
      }
      const phase = t - cyc * PERIOD;
      const targetN = Math.min(Math.round(Math.min(phase, GROW) / DT), MAXN1 - 1);
      let moved = false;
      while (nSteps < targetN) { step(); moved = true; }
      if (moved) {
        for (let i = 0; i < K; i++) {
          trGeo[i].setDrawRange(0, nSteps + 1);
          trPos[i].needsUpdate = true;
        }
        envPos.needsUpdate = true;
        envGeo.setDrawRange(0, nSteps * 4);
      }
      // 金色轨迹头部小球（放大观察对象）
      head.position.set(xWorld(nSteps * DT), xs[nSteps] * SCALE_Y, zOff(0));
      // 面板按 5Hz 重绘
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) {
        drawInfo(t); drawZoom(); drawMsd();
      }
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
