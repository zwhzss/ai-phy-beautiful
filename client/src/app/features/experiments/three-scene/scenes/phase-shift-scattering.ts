import type { SceneContext, SceneInstance } from '../types';
/**
 * 分波法与相移（P517）—— 主控方程（每个顶点都由下列实式算出）：
 *   径向方程  u_l″ + [k² − 2mV(r)/ħ² − l(l+1)/r²]·u_l = 0，
 *   渐近式    u_l ∼ sin(kr − lπ/2 + δ_l)
 *   振幅      f(θ) = (1/k) Σ_l (2l+1)·e^{iδ_l}·sin δ_l·P_l(cos θ)
 *   截面      dσ/dΩ = |f|²，  σ_tot = (4π/k²) Σ_l (2l+1)sin²δ_l = (4π/k)·Im f(0)（光学定理）
 *   δ_l 由 r=a 处对数导数连续严格求出（硬球 u(a)=0 → tanδ_l=j_l/y_l；
 *   方势阱 ξ=a√(2mV0)/ħ，内部 κ=√(k²+ξ²/a²)，tanδ_l=(B·Ji−s·Jpi·A)/(D·Ji−s·Jpi·C)）
 * 画面：入射平面波波前（间距 λ=2π/k 真比）撞上势球，势球外一圈圈同心 s/p/d/f 分波瓣
 * 按 (2l+1)sin²δ_l 加权，远场花瓣面即 dσ/dΩ。
 * 扫描自变量：ρ=ka 在 0.08↔12 之间对数往复（周期 18 s）；每个周期换一种势
 * （硬球 / ξ=4.4934 散射长度过零的"零能透明" / ξ=3π/2 阈值共振 σ=4π/k² / 深阱 ξ=8.5）。
 * 地面图把本周期的 σ_tot(ka) 曲线逐点累积下来，四种势的曲线明显不同。
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

  const PI = Math.PI, TWO_PI = PI * 2;
  // —— 势场与波数（无量纲，长度单位 = 势半径 a）——
  const LMAX = 13;                 // 保留的分波数上限（l>LMAX 的 sin²δ_l 已 <1e-6）
  const RHO_MIN = 0.08, RHO_MAX = 12;   // ρ = k·a
  const CYCLE = 18;
  const A_W = 0.62;                // world / a
  const R0 = 2.05;                 // 远场花瓣最大半径（world）
  const LR_MIN = Math.log10(RHO_MIN), LR_SPAN = Math.log10(RHO_MAX) - LR_MIN;
  // 每个周期一种势：ξ=0 硬球；tanξ=ξ 的根 → a_s=0 零能透明；ξ=(n+½)π → a_s→∞ 阈值共振
  const POTS = [
    { xi: 0, name: '硬球（排斥）V=∞·θ(a−r)' },
    { xi: 4.4934, name: '方势阱 ξ=4.4934=根(tanξ=ξ) → a_s=0' },
    { xi: 3 * PI / 2, name: '方势阱 ξ=3π/2 → a_s→∞ 阈值共振' },
    { xi: 8.5, name: '深方势阱 ξ=8.5（3 个束缚态＋形状共振）' },
  ];

  // 星野 + 地面
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

  // 光束轴（入射方向 +x）
  {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-4.6, 0, 0, A_W, 0, 0]), 3));
    group.add(new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.9 }))));
  }

  // —— 势场球（半径 a）——
  const potGeo = geo(new THREE.SphereGeometry(A_W, 28, 20));
  const potMat = mat(new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x7f1d1d, emissiveIntensity: 0.45, roughness: 0.35, transparent: true, opacity: 0.92 }));
  const potMesh = new THREE.Mesh(potGeo, potMat);
  group.add(potMesh);
  const potWire = new THREE.Mesh(geo(new THREE.SphereGeometry(A_W * 1.0, 16, 10)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24, wireframe: true, transparent: true, opacity: 0.22 })));
  group.add(potWire);

  // —— 入射平面波波前：间距 = 真实 λ = 2π/k（以 a 为单位再乘 A_W）——
  const RING_R = 1.78, RING_SEG = 44, NRING = 12;
  const ringGeo = geo(new THREE.BufferGeometry());
  {
    const p = new Float32Array((RING_SEG + 1) * 3);
    for (let i = 0; i <= RING_SEG; i++) {
      const a = TWO_PI * (i / RING_SEG);
      p[i * 3] = 0; p[i * 3 + 1] = RING_R * Math.cos(a); p[i * 3 + 2] = RING_R * Math.sin(a);
    }
    ringGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  }
  const ringMat = mat(new THREE.LineBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.75 }));
  const rings: import('three').LineLoop[] = [];
  for (let i = 0; i < NRING; i++) {
    const r = new THREE.LineLoop(ringGeo, ringMat);
    group.add(r);
    rings.push(r);
  }

  // —— 远场 dσ/dΩ 旋转面（由 |f(θ)|² 直接生成顶点）——
  const TH = 45, PH = 45;
  const ffGeo = geo(new THREE.BufferGeometry());
  const ffPos = new Float32Array(TH * (PH + 1) * 3);
  const ffIdx: number[] = [];
  for (let i = 0; i < TH - 1; i++) {
    for (let j = 0; j < PH; j++) {
      const a = i * (PH + 1) + j, b = a + 1, c = a + PH + 1, d = c + 1;
      ffIdx.push(a, c, b, b, c, d);
    }
  }
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  ffGeo.setIndex(ffIdx);
  const ffMat = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  group.add(new THREE.Mesh(ffGeo, ffMat));

  // 子午线轮廓（θ∈[0,2π)）
  const MR = 181;
  const merGeo = geo(new THREE.BufferGeometry());
  const merPos = new Float32Array(MR * 3);
  merGeo.setAttribute('position', new THREE.BufferAttribute(merPos, 3));
  group.add(new THREE.Line(merGeo, mat(new THREE.LineBasicMaterial({ color: 0x67e8f9 }))));

  // 前向 / 后向标记点
  const dotGeo = geo(new THREE.SphereGeometry(0.055, 10, 8));
  const dotF = new THREE.Mesh(dotGeo, mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  const dotB = new THREE.Mesh(dotGeo, mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })));
  group.add(dotF, dotB);

  // —— 同心分波瓣 s/p/d/f：r = r0_l + amp_l·|P_l(cosθ)|，amp ∝ √(σ_l/σ_tot) ——
  const NSHELL = 4, SH_PTS = 145;
  const shellR0 = [0.72, 0.95, 1.18, 1.41];
  const shellCol = [0x22d3ee, 0x22c55e, 0xa855f7, 0xfbbf24];
  const shellGeo: import('three').BufferGeometry[] = [];
  const shellPos: Float32Array[] = [];
  const shellLine: import('three').Line[] = [];
  for (let l = 0; l < NSHELL; l++) {
    const g = geo(new THREE.BufferGeometry());
    const p = new Float32Array(SH_PTS * 3);
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = mat(new THREE.LineBasicMaterial({ color: shellCol[l], transparent: true, opacity: 0.95 }));
    const ln = new THREE.Line(g, m);
    group.add(ln);
    shellGeo.push(g); shellPos.push(p); shellLine.push(ln);
  }

  // —— 地面 σ_tot(ka) 累积曲线（对数坐标）——
  const CX0 = -4.35, CX1 = -2.35, CZ0 = 1.15, CZ1 = 2.75;   // log10 ρ → x，log10(σ/πa²) → z
  const LG_MIN = -1.15, LG_SPAN = 4.7;                       // σ/πa² 从 0.07 到 ~2e3
  const NPTS = 240;
  const trGeo = geo(new THREE.BufferGeometry());
  const trPos = new Float32Array(NPTS * 3);
  trGeo.setAttribute('position', new THREE.BufferAttribute(trPos, 3));
  trGeo.setDrawRange(0, 0);
  group.add(new THREE.Line(trGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 }))));
  const dotTr = new THREE.Mesh(dotGeo, mat(new THREE.MeshBasicMaterial({ color: 0xffffff })));
  group.add(dotTr);
  {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      CX0, 0.02, CZ0, CX1, 0.02, CZ0,      // ρ 轴
      CX1, 0.02, CZ0, CX1, 0.02, CZ1,      // σ 轴
      CX0, 0.02, CZ0, CX0, 0.02, CZ1,      // 参考竖边
      CX0, 0.02, CZ1, CX1, 0.02, CZ1,      // 顶边
    ]), 3));
    group.add(new THREE.LineSegments(g, mat(new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.8 }))));
    // ka=1 与 σ=4πa²（硬球瑞利极限）两条参考线
    const x1 = CX0 + ((0 - LR_MIN) / LR_SPAN) * (CX1 - CX0);
    const z4 = CZ0 + ((Math.log10(4) - LG_MIN) / LG_SPAN) * (CZ1 - CZ0);
    const g2 = geo(new THREE.BufferGeometry());
    g2.setAttribute('position', new THREE.BufferAttribute(new Float32Array([x1, 0.03, CZ0, x1, 0.03, CZ1, CX0, 0.03, z4, CX1, 0.03, z4]), 3));
    group.add(new THREE.LineSegments(g2, mat(new THREE.LineBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.5 }))));
  }

  // —— 标签 ——
  function makeLabel(text: string, color: string, scale = 3.0): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  const lbWave = makeLabel('入射平面波：波前间距 λ=2π/k', '#a855f7', 3.4); lbWave.position.set(-3.5, 2.0, 0);
  const lbPot = makeLabel('势场 r=a（本周期换势）', '#fbbf24', 3.2); lbPot.position.set(0.1, -0.62, 0.6);
  const lbFF = makeLabel('远场花瓣：径向 ∝ dσ/dΩ=|f(θ)|²（归一）', '#22d3ee', 4.2); lbFF.position.set(1.0, -1.35, 0);
  const lbShell = makeLabel('同心分波瓣 r= r0_l+√(σ_l/σ_tot)·|P_l|', '#34d399', 4.2); lbShell.position.set(-1.55, 2.05, 0.9);
  const lbChart = makeLabel('地面：σ_tot/(πa²) vs ka（双对数，逐周期累积）', '#fbbf24', 3.8); lbChart.position.set((CX0 + CX1) / 2, 0.62, (CZ0 + CZ1) / 2);
  const lbRes = makeLabel('σ=4πa² 瑞利极限', '#0ea5e9', 2.8); lbRes.position.set(CX0 + 0.35, 0.3, zRefLineZ(CZ0, CZ1));
  function zRefLineZ(a: number, b: number): number { return a + ((Math.log10(4) - LG_MIN) / LG_SPAN) * (b - a); }
  const shellLb: import('three').Sprite[] = [];
  for (let l = 0; l < NSHELL; l++) {
    const s = makeLabel(['l=0 s 波', 'l=1 p 波', 'l=2 d 波', 'l=3 f 波'][l], ['#67e8f9', '#4ade80', '#c084fc', '#fcd34d'][l], 2.4);
    s.position.set(-2.6, 0.5 + 0.3 * l, 2.9 + 0.24 * l);
    group.add(s); shellLb.push(s);
  }
  group.add(lbWave, lbPot, lbFF, lbShell, lbChart, lbRes);

  // —— 信息面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 800; infoCv.height = 264;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(7.4, 2.44)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 3.42, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  const rd = {
    rho: RHO_MIN, xi: 0, L: 0, sig: 0, f0: 0, fb: 0, d0: 0, d1: 0, d2: 0,
    fr: [0, 0, 0, 0], potIdx: 0, lam: 78.5,
  };
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 800, 264);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 792, 256);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3;
    infoCtx.strokeRect(4, 4, 792, 256);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 25px "PingFang SC", sans-serif';
    infoCtx.fillText('分波法：相移 δ_l 一旦确定，角度分布与总截面全部到手', 20, 32);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('u_l″+[k²−2mV/ħ²−l(l+1)/r²]u_l=0，u_l∼sin(kr−lπ/2+δ_l)', 20, 60);
    infoCtx.fillText('f(θ)=(1/k)Σ(2l+1)e^{iδ_l}sinδ_l P_l(cosθ)，dσ/dΩ=|f|²', 20, 86);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('σ_tot=(4π/k²)Σ(2l+1)sin²δ_l=(4π/k)Im f(0) — 光学定理两条路径同值', 20, 112);
    infoCtx.fillStyle = '#34d399';
    infoCtx.fillText(POTS[rd.potIdx].name + `，ξ=a√(2mV0)/ħ，κ²=k²+2mV0/ħ²`, 20, 138);
    infoCtx.fillStyle = '#f472b6';
    infoCtx.fillText(`共振判据 δ_l=π/2 → σ_l=4π(2l+1)/k²；a_s=0（tanξ=ξ）→ 零能透明 σ→0`, 20, 164);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 21px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：ka=${rd.rho.toFixed(2)} λ/a=${rd.lam.toFixed(2)} 有效分波 L=${rd.L}  σ_tot/πa²=${fmtS(rd.sig)}  |f(0)|²/a²=${fmtS(rd.f0)}  |f(π)|²/a²=${fmtS(rd.fb)}`, 20, 192,
    );
    infoCtx.fillText(
      `δ₀=${rd.d0.toFixed(2)}π（已解绕）δ₁=${rd.d1.toFixed(2)}π δ₂=${rd.d2.toFixed(2)}π  占比 σ₀:σ₁:σ₂:σ₃=${pct(rd.fr[0])}:${pct(rd.fr[1])}:${pct(rd.fr[2])}:${pct(rd.fr[3])}`, 20, 218,
    );
    infoCtx.fillText(
      `低能极限：硬球 σ→4πa²（几何截面 πa² 的 4 倍），高能 σ→2πa²（一半衍射shadow）`, 20, 244,
    );
    infoTex.needsUpdate = true;
  }
  function fmtS(v: number): string {
    if (!isFinite(v)) return '∞';
    if (v >= 1000) return (v / 1000).toFixed(2) + 'k';
    if (v >= 100) return v.toFixed(0);
    if (v >= 1) return v.toFixed(2);
    return v.toFixed(4);
  }
  function pct(v: number): string { return (v * 100).toFixed(0); }
  drawInfo();

  // —— 特殊函数（递推，实式）——
  const Jarr = new Float64Array(LMAX + 3), Yarr = new Float64Array(LMAX + 3);
  const Ji = new Float64Array(LMAX + 3), Jpi = new Float64Array(LMAX + 3);
  function ricJ(x: number, out: Float64Array): void {
    out[0] = Math.sin(x) / x;
    out[1] = out[0] / x - Math.cos(x) / x;
    for (let n = 1; n < LMAX + 2; n++) out[n + 1] = ((2 * n + 1) * out[n]) / x - out[n - 1];
  }
  function ricY(x: number, out: Float64Array): void {
    out[0] = -Math.cos(x) / x;
    out[1] = out[0] / x - Math.sin(x) / x;
    for (let n = 1; n < LMAX + 2; n++) out[n + 1] = ((2 * n + 1) * out[n]) / x - out[n - 1];
  }
  // P_l(cosθ) 表（θ 网格固定）
  const cosT = new Float64Array(TH), PL = new Float64Array(TH * (LMAX + 1));
  for (let i = 0; i < TH; i++) {
    const c = Math.cos(PI * i / (TH - 1));
    cosT[i] = c;
    PL[i * (LMAX + 1) + 0] = 1;
    if (LMAX >= 1) PL[i * (LMAX + 1) + 1] = c;
    for (let n = 1; n < LMAX; n++) {
      PL[i * (LMAX + 1) + n + 1] = ((2 * n + 1) * c * PL[i * (LMAX + 1) + n] - n * PL[i * (LMAX + 1) + n - 1]) / (n + 1);
    }
  }
  const cRe = new Float64Array(LMAX + 1), cIm = new Float64Array(LMAX + 1);
  const dUn = new Float64Array(LMAX + 1);
  const dPrev = new Float64Array(LMAX + 1);
  const prof = new Float64Array(TH);
  // 任意角的 P_l（递推，精确）—— 子午线与分波瓣用它，避免网格取整
  function plAt(l: number, c: number): number {
    if (l === 0) return 1;
    let p0 = 1, p1 = c;
    for (let n = 1; n < l; n++) { const p2 = ((2 * n + 1) * c * p1 - n * p0) / (n + 1); p0 = p1; p1 = p2; }
    return p1;
  }
  // |f(θ)|²/a²（与花瓣面同一批 cRe/cIm 系数）
  function fa2(th: number, rho: number): number {
    const c = Math.cos(th);
    let re = 0, im = 0;
    for (let l = 0; l <= LMAX; l++) { const p = plAt(l, c); re += cRe[l] * p; im += cIm[l] * p; }
    re /= rho; im /= rho;
    return re * re + im * im;
  }

  let potIdx = -1;
  let trCount = 0, trLastLr = -99;

  return {
    update(t, dt) {
      const ph = (t % CYCLE) / CYCLE;
      const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
      const rho = RHO_MIN * Math.pow(RHO_MAX / RHO_MIN, tri);
      const pi = Math.floor(t / CYCLE) % POTS.length;
      if (pi !== potIdx) {              // 换势：清空累积曲线与解绕基准
        potIdx = pi; trCount = 0; trLastLr = -99; trGeo.setDrawRange(0, 0);
        const hard = POTS[potIdx].xi <= 0;
        potMat.color.setHex(hard ? 0xef4444 : 0x0d9488);
        potMat.emissive.setHex(hard ? 0x7f1d1d : 0x134e4a);
        potMat.opacity = hard ? 0.92 : 0.42;
        potWire.visible = !hard;
        for (let l = 0; l <= LMAX; l++) dPrev[l] = NaN;
      }
      const xi = POTS[potIdx].xi;
      const L = Math.min(LMAX, Math.max(0, Math.ceil(rho + 3 * Math.sqrt(rho))));

      // δ_l：r=a 处对数导数连续
      ricJ(rho, Jarr); ricY(rho, Yarr);
      if (xi > 0) {
        const x2 = Math.sqrt(rho * rho + xi * xi);
        ricJ(x2, Ji);
        for (let n = 0; n <= LMAX + 1; n++) Jpi[n] = (n / x2) * Ji[n] - Ji[n + 1];
      }
      let wsum = 0;
      for (let l = 0; l <= L; l++) {
        const A = Jarr[l], B = (l / rho) * Jarr[l] - Jarr[l + 1];
        const C = Yarr[l], D = (l / rho) * Yarr[l] - Yarr[l + 1];
        let num: number, den: number;
        if (xi <= 0) { num = A; den = C; }                     // 硬球：u(a)=0 → tanδ=j/y
        else {
          const s = Math.sqrt(rho * rho + xi * xi) / rho;
          num = B * Ji[l] - s * Jpi[l] * A;
          den = D * Ji[l] - s * Jpi[l] * C;
        }
        let d = Math.atan2(num, den);                          // 观测只依赖 δ mod π
        if (d > PI / 2) d -= PI;
        if (d <= -PI / 2) d += PI;
        // 显示用：连续解绕（跨过共振 δ 上跳 π）
        if (isNaN(dPrev[l])) dUn[l] = d;
        else {
          let u = d + PI * Math.round((dPrev[l] - d) / PI);
          while (u - dPrev[l] > 1.9) u -= PI;
          while (dPrev[l] - u > 1.9) u += PI;
          dUn[l] = u;
        }
        dPrev[l] = dUn[l];
        const sd = Math.sin(d), cd = Math.cos(d);
        cRe[l] = (2 * l + 1) * sd * cd;
        cIm[l] = (2 * l + 1) * sd * sd;
        wsum += cIm[l];
      }
      for (let l = L + 1; l <= LMAX; l++) { cRe[l] = 0; cIm[l] = 0; }

      // f(θ) 角度分布 → 花瓣面顶点
      let mx = 1e-30;
      for (let i = 0; i < TH; i++) {
        const off = i * (LMAX + 1);
        let re = 0, im = 0;
        for (let l = 0; l <= L; l++) { re += cRe[l] * PL[off + l]; im += cIm[l] * PL[off + l]; }
        re /= rho; im /= rho;
        prof[i] = re * re + im * im;
        if (prof[i] > mx) mx = prof[i];
      }
      const f0 = prof[0], fb = prof[TH - 1];      // θ=0 前向 / θ=π 后向恰在网格端点
      const inv = R0 / mx;
      let v = 0;
      for (let i = 0; i < TH; i++) {
        const rr = prof[i] * inv, st = Math.sin(PI * i / (TH - 1)), ct = cosT[i];
        const px = rr * ct, ry = rr * st;
        for (let j = 0; j <= PH; j++) {
          const a = TWO_PI * (j / PH);
          ffPos[v] = px; ffPos[v + 1] = ry * Math.cos(a); ffPos[v + 2] = ry * Math.sin(a);
          v += 3;
        }
      }
      ffGeo.attributes['position'].needsUpdate = true;
      ffMat.opacity = 0.14 + 0.2 * Math.min(1, fb / mx);       // 后向占比越大（各向同性的 s 波/共振）越亮

      // 子午线轮廓：直接用 fa2(θ)（与花瓣面同一批 δ_l 系数）
      for (let k = 0; k < MR; k++) {
        const th = TWO_PI * (k / (MR - 1));
        const rr = Math.min(R0 + 0.05, fa2(th, rho) * inv) + 0.004;
        merPos[k * 3] = rr * Math.cos(th); merPos[k * 3 + 1] = rr * Math.sin(th); merPos[k * 3 + 2] = 0;
      }
      merGeo.attributes['position'].needsUpdate = true;
      dotF.position.set(f0 * inv, 0, 0);
      dotB.position.set(-fb * inv, 0, 0);

      // 分波瓣（同心）
      for (let l = 0; l < NSHELL; l++) {
        const fr = wsum > 0 ? cIm[l] / wsum : 0;
        const amp = 0.36 * Math.sqrt(fr);
        for (let k = 0; k < SH_PTS; k++) {
          const th = TWO_PI * (k / (SH_PTS - 1));
          const rr = shellR0[l] + amp * Math.abs(plAt(l, Math.cos(th)));
          shellPos[l][k * 3] = rr * Math.cos(th); shellPos[l][k * 3 + 1] = rr * Math.sin(th); shellPos[l][k * 3 + 2] = 0;
        }
        shellGeo[l].attributes['position'].needsUpdate = true;
        rd.fr[l] = fr;
      }

      // 入射波前：真实 λ = 2π/k（world = A_W·2π/ρ）
      const SPAN = 3.7, XMIN = -4.6;
      const lamW = A_W * TWO_PI / rho;
      const nn = Math.max(1, Math.min(NRING, Math.floor(SPAN / lamW)));
      const drift = (t * 0.9) % SPAN;
      for (let i = 0; i < NRING; i++) {
        if (i < nn) {
          rings[i].visible = true;
          rings[i].position.x = XMIN + ((drift + i * lamW) % SPAN);
        } else rings[i].visible = false;
      }

      // 累积 σ(ka) 曲线（只在升程半周期写点，回程复用同一条线）
      const lr = Math.log10(rho);
      if (ph < 0.5 && trCount < NPTS && (lr - trLastLr) > LR_SPAN / NPTS) {
        trLastLr = lr;
        const sv = 4 * wsum / (rho * rho);                  // σ_tot/(πa²) = 4·Σ(2l+1)sin²δ_l/(ka)²
        const lg = Math.max(LG_MIN, Math.min(LG_MIN + LG_SPAN, Math.log10(Math.max(1e-9, sv))));
        trPos[trCount * 3] = CX0 + ((lr - LR_MIN) / LR_SPAN) * (CX1 - CX0);
        trPos[trCount * 3 + 1] = 0.04;
        trPos[trCount * 3 + 2] = CZ0 + ((lg - LG_MIN) / LG_SPAN) * (CZ1 - CZ0);
        trCount++;
        trGeo.setDrawRange(0, trCount);
        trGeo.attributes['position'].needsUpdate = true;
      }
      {
        const sv = 4 * wsum / (rho * rho);
        const lg = Math.log10(Math.max(1e-3, sv));
        dotTr.position.set(CX0 + ((lr - LR_MIN) / LR_SPAN) * (CX1 - CX0), 0.06,
          CZ0 + Math.max(0, Math.min(1, (lg - LG_MIN) / LG_SPAN)) * (CZ1 - CZ0));
      }

      // 面板同源读数
      rd.rho = rho; rd.xi = xi; rd.L = L; rd.lam = TWO_PI / rho;
      rd.sig = 4 * wsum / (rho * rho);
      rd.f0 = f0; rd.fb = fb;
      rd.d0 = dUn[0] / PI; rd.d1 = dUn[1] / PI; rd.d2 = dUn[2] / PI;
      rd.potIdx = potIdx;

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
