import type { SceneContext, SceneInstance } from '../types';
/** 光程与费马原理（P449）：主控方程
 *  ① 光程 OPL = n₁·s₁ + n₂·s₂（s 为几何路程，n 为折射率）；时间 = OPL/c ⇒ 最光程 = 最时
 *  ② 费马：δOPL=0 对界面上出射点 x 求极值 ⇒ n₁·(x−x_S)/s₁ = n₂·(x_T−x)/s₂，即 n₁sinθ₁ = n₂sinθ₂（Snell 定律被"推导"出来）
 *  ③ 波长介质内收缩 λ = λ₀/n，故"光程 = 等效真空路程 = 所容纳的波数 × λ₀"
 *  画面：界面上撒开 25 条候选折线光路 S→P(x)→T，按各自 OPL 长短染成冷(短)→暖(长)色带；
 *  三条近邻虚线（金）随 n₂ 扫描连续滑动最速解 x*；下方 OPL(x) 曲线面板同一公式逐点计算并标出极小。
 *  一个"光子"沿最速路径以 v=c/n 两段速度跑完 —— 它真的更省时。自变量：液体折射率 n₂ 1.33↔1.78，16 s 周期。 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
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
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  const N1 = 1.0, LAM0 = 0.55;                 // µm；世界单位 1 = 1 µm
  const S = new THREE.Vector3(-2.0, 2.2, 0);
  const T = new THREE.Vector3(1.6, -2.0, 0);
  const XCAND: number[] = [];
  const NC = 25;
  for (let k = 0; k < NC; k++) XCAND.push(-2.6 + (5.8 * k) / (NC - 1));

  // —— 介质块（下半空间 n₂ 液体） ——
  const liqGeo = geo(new THREE.BoxGeometry(8.2, 2.9, 4.2));
  const liq = new THREE.Mesh(liqGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.1 })));
  liq.position.set(0, -1.5, 0);
  group.add(liq);
  const ifaceGeo = geo(new THREE.PlaneGeometry(8.2, 4.2));
  const iface = new THREE.Mesh(ifaceGeo, mat(new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.18, side: THREE.DoubleSide })));
  iface.rotation.x = -Math.PI / 2;
  group.add(iface);
  // 法线（在 x* 处，随解滑动）——虚线需要 computeLineDistances
  const normGeo = geo(new THREE.BufferGeometry());
  normGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
  const normLine = new THREE.Line(normGeo, mat(new THREE.LineDashedMaterial({ color: 0x94a3b8, dashSize: 0.14, gapSize: 0.1, transparent: true, opacity: 0.8 })));
  group.add(normLine);

  // —— 候选光路簇（LineSegments + 顶点色，冷暖 = OPL 长短） ——
  const candGeo = geo(new THREE.BufferGeometry());
  const candPos = new Float32Array(NC * 4 * 3);
  const candCol = new Float32Array(NC * 4 * 3);
  candGeo.setAttribute('position', new THREE.BufferAttribute(candPos, 3));
  candGeo.setAttribute('color', new THREE.BufferAttribute(candCol, 3));
  group.add(new THREE.LineSegments(candGeo, mat(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8 }))));

  // —— 最速解（金线 3 点）与两段速度光子 ——
  const bestGeo = geo(new THREE.BufferGeometry());
  bestGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 3), 3));
  group.add(new THREE.Line(bestGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 }))));
  const photon = new THREE.Mesh(geo(new THREE.SphereGeometry(0.09, 12, 10)), mat(new THREE.MeshBasicMaterial({ color: 0xfef3c7 })));
  group.add(photon);

  // —— 直线参考路（虚灰）：S→T 直线违背 Snell，付出 ΔOPL 代价 ——
  const xLin = S.x + (S.y / (S.y - T.y)) * (T.x - S.x);
  const straightGeo = geo(new THREE.BufferGeometry());
  straightGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([S.x, S.y, S.z, T.x, T.y, T.z]), 3));
  const straightLine = new THREE.Line(straightGeo, mat(new THREE.LineDashedMaterial({ color: 0x94a3b8, dashSize: 0.16, gapSize: 0.12, transparent: true, opacity: 0.5 })));
  group.add(straightLine);
  straightLine.computeLineDistances();

  // —— 波动视图：沿最速两段画正弦波，介质内 λ=λ₀/n 收缩 ⇒ 波数密度 ∝ n ——
  const NW = 120;
  function mkWave(color: number): import('three').BufferGeometry {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NW * 3), 3));
    group.add(new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 }))));
    return g;
  }
  const wave1Geo = mkWave(0xfde68a), wave2Geo = mkWave(0x67e8f9);
  const wDir = new THREE.Vector3(), wPerp = new THREE.Vector3(), wP = new THREE.Vector3();
  function setWave(g: import('three').BufferGeometry, A: import('three').Vector3, B: import('three').Vector3, lam: number): void {
    wDir.subVectors(B, A);
    const L = wDir.length();
    wDir.divideScalar(L);
    wPerp.set(-wDir.y, wDir.x, 0);
    const arr = g.attributes['position'].array as Float32Array;
    for (let k = 0; k < NW; k++) {
      const s = (k / (NW - 1)) * L;
      const off = Math.sin((s / lam) * 2 * Math.PI) * 0.13;
      wP.copy(A).addScaledVector(wDir, s).addScaledVector(wPerp, off);
      arr[k * 3] = wP.x; arr[k * 3 + 1] = wP.y; arr[k * 3 + 2] = wP.z;
    }
    g.attributes['position'].needsUpdate = true;
  }

  function makeLabel(text: string, color: string, scale: number, pos: import('three').Vector3): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    s.position.copy(pos);
    return s;
  }
  group.add(makeLabel('空气 n₁=1.00', '#f8fafc', 2.8, new THREE.Vector3(-3.3, 1.6, 1.4)));
  group.add(makeLabel('液体 n₂（扫描）', '#22d3ee', 3.0, new THREE.Vector3(-3.2, -1.6, 1.4)));
  group.add(makeLabel('S 点光源', '#fbbf24', 2.2, new THREE.Vector3(S.x - 0.7, S.y + 0.3, 0)));
  group.add(makeLabel('T 接收点', '#f472b6', 2.2, new THREE.Vector3(T.x + 0.8, T.y - 0.3, 0)));
  group.add(makeLabel('波在两段内 λ=λ₀/n：液体内波更密、总波数不变', '#67e8f9', 3.8, new THREE.Vector3(0.2, -2.62, 2.35)));
  const srcMesh = new THREE.Mesh(geo(new THREE.SphereGeometry(0.12, 14, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  srcMesh.position.copy(S); group.add(srcMesh);
  const tgtMesh = new THREE.Mesh(geo(new THREE.SphereGeometry(0.12, 14, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })));
  tgtMesh.position.copy(T); group.add(tgtMesh);

  // —— OPL(x) 曲线面板 ——
  const opCv = document.createElement('canvas');
  opCv.width = 512; opCv.height = 320;
  const opCtx = opCv.getContext('2d')!;
  const opTex = tex(new THREE.CanvasTexture(opCv));
  const opPlane = new THREE.Mesh(geo(new THREE.PlaneGeometry(3.1, 1.94)), mat(new THREE.MeshBasicMaterial({ map: opTex, transparent: true })));
  opPlane.position.set(4.42, 0.9, 0.6);
  group.add(opPlane);

  let n2 = 1.5;
  const opl = (x: number): number => N1 * Math.hypot(x - S.x, S.y) + n2 * Math.hypot(T.x - x, -T.y);
  function solveXstar(): number {
    let lo = -2.6, hi = 3.2;
    for (let i = 0; i < 64; i++) {
      const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
      if (opl(m1) < opl(m2)) hi = m2; else lo = m1;
    }
    return (lo + hi) / 2;
  }
  function drawOpl(xs: number): void {
    opCtx.clearRect(0, 0, 512, 320);
    opCtx.fillStyle = 'rgba(7,11,20,0.85)'; opCtx.fillRect(0, 0, 512, 320);
    opCtx.strokeStyle = '#334155'; opCtx.lineWidth = 2; opCtx.strokeRect(3, 3, 506, 314);
    const vals: number[] = [];
    let vmax = -1e9, vmin = 1e9;
    for (let k = 0; k <= 48; k++) { const v = opl(-2.6 + (5.8 * k) / 48); vals.push(v); if (v > vmax) vmax = v; if (v < vmin) vmin = v; }
    const X = (x: number): number => 44 + ((x + 2.6) / 5.8) * 450, Y = (v: number): number => 286 - ((v - vmin) / (vmax - vmin + 1e-9)) * 230;
    opCtx.strokeStyle = '#22d3ee'; opCtx.lineWidth = 3; opCtx.beginPath();
    for (let k = 0; k <= 48; k++) {
      const x = -2.6 + (5.8 * k) / 48;
      if (k === 0) opCtx.moveTo(X(x), Y(vals[k])); else opCtx.lineTo(X(x), Y(vals[k]));
    }
    opCtx.stroke();
    opCtx.strokeStyle = '#fbbf24'; opCtx.lineWidth = 2;
    opCtx.beginPath(); opCtx.moveTo(X(xs), 26); opCtx.lineTo(X(xs), 286); opCtx.stroke();
    opCtx.fillStyle = '#fbbf24'; opCtx.beginPath(); opCtx.arc(X(xs), Y(opl(xs)), 5, 0, 7); opCtx.fill();
    opCtx.fillStyle = '#94a3b8'; opCtx.font = '20px "PingFang SC", sans-serif';
    opCtx.fillText('OPL(x) = n₁s₁ + n₂s₂', 60, 42);
    opCtx.fillText('极小 ⇔ n₁sinθ₁ = n₂sinθ₂', 60, 68);
    opCtx.fillText('出射点 x', 220, 308);
    opTex.needsUpdate = true;
  }

  // —— 主面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 860; infoCv.height = 250;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.0, 2.61)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 5.7, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  let xs = 0, th1 = 0, th2 = 0, oplMin = 0, oplMax = 0, oplLin = 0;
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 860, 250);
    infoCtx.fillStyle = 'rgba(7,11,20,0.86)';
    infoCtx.fillRect(4, 4, 852, 242);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 852, 242);
    infoCtx.textAlign = 'left';
    const ln = (y: number, c: string, s: string, bold = false, sz = 26): void => {
      infoCtx.fillStyle = c; infoCtx.font = `${bold ? 'bold ' : ''}${sz}px "PingFang SC", sans-serif`;
      infoCtx.fillText(s, 22, y);
    };
    ln(40, '#f8fafc', '费马原理：光走"最时"路径 δ∫n·ds = 0', true);
    ln(78, '#22d3ee', '光程 OPL = n₁s₁ + n₂s₂；时间 = OPL/c');
    ln(112, '#a855f7', '对界面出射点取极小 ⇒ Snell：n₁sinθ₁ = n₂sinθ₂');
    ln(148, '#fbbf24', `读数：n₂=${n2.toFixed(3)}  x*=${xs.toFixed(3)}µm  OPL_min=${oplMin.toFixed(3)}µm = ${(oplMin / LAM0).toFixed(1)} 个λ₀`, true, 24);
    ln(180, '#fbbf24', `θ₁=${(th1 * 57.2958).toFixed(2)}° θ₂=${(th2 * 57.2958).toFixed(2)}°  n₁sinθ₁=${(N1 * Math.sin(th1)).toFixed(4)} = n₂sinθ₂=${(n2 * Math.sin(th2)).toFixed(4)}`, false, 24);
    ln(212, '#94a3b8', `最慢候选 ΔOPL=${(oplMax - oplMin).toFixed(3)}µm｜直路 x=${xLin.toFixed(2)} 罚 ${(oplLin - oplMin).toFixed(3)}µm=违反费马的代价`, false, 21);
    infoTex.needsUpdate = true;
  }

  function solve(tt: number): void {
    xs = solveXstar();
    oplMin = opl(xs);
    const P = new THREE.Vector3(xs, 0, 0);
    const s1 = S.distanceTo(P), s2 = P.distanceTo(T);
    th1 = Math.atan2(P.x - S.x, S.y);
    th2 = Math.atan2(T.x - P.x, -T.y);
    // 候选簇顶点色：冷→暖
    let vmax = -1e9, vmin = 1e9;
    const vals: number[] = [];
    for (const x of XCAND) { const v = opl(x); vals.push(v); if (v > vmax) vmax = v; if (v < vmin) vmin = v; }
    oplMax = vmax;
    let o = 0;
    for (let k = 0; k < NC; k++) {
      const x = XCAND[k], pk = new THREE.Vector3(x, 0, 0);
      const t = (vals[k] - vmin) / (vmax - vmin + 1e-9);
      // 冷 (0.25,0.85,1.0) → 暖 (1.0,0.32,0.15)；接近极小者加亮
      const near = 1 - Math.min(1, Math.abs(x - xs) / 1.6);
      const bright = 0.55 + 0.45 * near;
      const r = (0.25 + 0.75 * t) * bright, g = (0.85 - 0.53 * t) * bright, b = (1.0 - 0.85 * t) * bright;
      for (const [a, bnd] of [[S, pk], [pk, T]] as [import('three').Vector3, import('three').Vector3][]) {
        candPos[o * 3] = a.x; candPos[o * 3 + 1] = a.y; candPos[o * 3 + 2] = a.z;
        candCol[o * 3] = r; candCol[o * 3 + 1] = g; candCol[o * 3 + 2] = b; o++;
        candPos[o * 3] = bnd.x; candPos[o * 3 + 1] = bnd.y; candPos[o * 3 + 2] = bnd.z;
        candCol[o * 3] = r; candCol[o * 3 + 1] = g; candCol[o * 3 + 2] = b; o++;
      }
    }
    candGeo.attributes['position'].needsUpdate = true;
    candGeo.attributes['color'].needsUpdate = true;
    // 最速金线 + 法线
    const bArr = bestGeo.attributes['position'].array as Float32Array;
    [S, P, T].forEach((v, i) => { bArr[i * 3] = v.x; bArr[i * 3 + 1] = v.y; bArr[i * 3 + 2] = v.z; });
    bestGeo.attributes['position'].needsUpdate = true;
    const nArr = normGeo.attributes['position'].array as Float32Array;
    nArr[0] = xs; nArr[1] = 1.3; nArr[2] = 0; nArr[3] = xs; nArr[4] = -1.5; nArr[5] = 0;
    normGeo.attributes['position'].needsUpdate = true;
    normLine.computeLineDistances();
    setWave(wave1Geo, S, P, (LAM0 * 4) / N1);
    setWave(wave2Geo, P, T, (LAM0 * 4) / n2);
    oplLin = opl(xLin);
    // 光子：两段速度 c/n ⇒ 段时间 ∝ n·s
    const t1 = N1 * s1, t2 = n2 * s2, tot = t1 + t2;
    let u = (tt * 0.42) % 1, d: number;
    if (u * tot < t1) { d = (u * tot) / t1; photon.position.copy(S).lerp(P, d); }
    else { d = (u * tot - t1) / t2; photon.position.copy(P).lerp(T, d); }
  }

  function update(t: number, dt: number): void {
    n2 = 1.33 + 0.45 * (0.5 - 0.5 * Math.cos((t % 16) / 16 * 2 * Math.PI));
    solve(t);
    if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) { drawInfo(); drawOpl(xs); }
  }

  solve(0);
  drawOpl(xs);
  drawInfo();

  return {
    update,
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
