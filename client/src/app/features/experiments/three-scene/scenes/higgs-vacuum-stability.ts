import type { SceneContext, SceneInstance } from '../types';
/**
 * 希格斯真空稳定性（P407）：标准模型 Higgs 四次耦合 λ(μ) 跑动穿过零 ⇒ 电弱真空只是“亚稳”。
 * 真实输入：m_h=125.1 GeV，m_t=172.76 GeV，v=246.22 GeV ⇒ λ(m_t)=m_h²/2v²=0.1291。
 *   top Yukawa 负反馈使 λ 对数下降：λ≈0 @ μ≈10^{9.7} GeV（不确定带 10^{10±?}），λ_min≈−0.020 @ μ≈6×10^{14} GeV。
 *   （锚点表 + 平滑插值，数值来自两圈跑动文献。）
 * 隧道寿命：S_E=8π²/(3|λ_min|)=1316 ⇒ Γ/V~e^{−S_E}：τ/宇宙年龄 ~ 10^{572} —— 比“永恒”还久。
 * 薄壁临界泡：R_c=2σ/ΔV（示意 σ=0.02v³、ΔV=0.036v⁴ ⇒ R_c=4.5×10⁻³ GeV⁻¹≈9×10⁻⁴ fm）。
 * 画面（示意地形，真实 |V| 跨 70 个数序、做 √/线性压缩）：
 *   V̂(x)=x²(1−x/7.31)，x=log₁₀(h/GeV)−2.391：EW 真空在原点（ρ=2.39），势垒顶 ρ≈7.3，λ 过零 ρ=9.7，右侧滑向 AdS 深渊。
 *   探针小球沿地形扫描 ρ:0.5→13（18s 周期）；EW 井内小球以 ω=√(V̂″) 微振（希格斯质量刚度）；
 *   探针越过 ρ=9.7 时临界泡在深渊侧成核：R<R_c 收缩、R>R_c 膨胀吞掉假真空。
 *   地板左附 O(4) bounce（瞬子）薄壁轮廓 φ_b(ξ)=½(1−tanh(3(ξ−1)))，ξ=r/R_c：黄点跟膨胀泡半径；
 *   橙色半透明带 = m_t±1GeV 使 λ=0 交叉漂移 2~3 数序；EW 井底振子频率由曲率 ω=√(V̂″(0))=√2 给出。
 * 数值核对（_scratch/agentC/higgs.mjs）：λ(1e10GeV)=0.0000、λ_min=−0.020、S_E=1316、Mpl=1.221e19 GeV。
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

  // —— λ(μ) 锚点表（t=ln(h/m_t)），平滑插值 ——
  const vh = 246.22, mH = 125.1, mt = 172.76;
  const lamMt = mH * mH / (2 * vh * vh);
  const A: [number, number][] = [[0, lamMt], [4, 0.071], [8, 0.036], [12, 0.015], [16, 0.0035], [17.9, 0], [20, -0.009], [22, -0.013], [25, -0.016], [28, -0.018], [31, -0.0195], [34, -0.02], [36.9, -0.02]];
  const lamOfT = (tt: number): number => {
    if (tt <= A[0][0]) return A[0][1];
    for (let i = 1; i < A.length; i++) if (tt <= A[i][0]) {
      const u = (tt - A[i - 1][0]) / (A[i][0] - A[i - 1][0]);
      return A[i - 1][1] + (A[i][1] - A[i - 1][1]) * (u * u * (3 - 2 * u));
    }
    return A[A.length - 1][1];
  };
  const lamOfRho = (rho: number) => lamOfT(Math.log(Math.pow(10, rho) / mt));
  const lmin = -0.02, SE = 8 * PI * PI / (3 * Math.abs(lmin));   // 1316

  // —— 示意地形 V̂(x)=x²(1−x/7.31)，x=ρ−2.391；y 压缩映射 ——
  const X0 = 2.391, XZ = 7.31;
  const vhat = (x: number) => x * x * (1 - x / XZ);
  const RHO2X = (rho: number) => -4.6 + ((rho - 0.5) / 12.5) * 9.0;   // ρ∈[0.5,13] → x∈[−4.6,4.4]
  const YMAP = (vv: number) => vv >= 0 ? 0.18 * vv : -0.42 * Math.sqrt(-vv);
  const CWY = 1.05;                                                    // 地形整体抬高
  const terrainGeo = geo(new THREE.BufferGeometry());
  { const NT = 200, p = new Float32Array(NT * 3), c = new Float32Array(NT * 3);
    const cc = new THREE.Color();
    for (let i = 0; i < NT; i++) {
      const rho = 0.5 + 12.5 * i / (NT - 1), x = rho - X0, vv = vhat(x);
      p[i * 3] = RHO2X(rho); p[i * 3 + 1] = CWY + YMAP(vv); p[i * 3 + 2] = 0;
      const l = lamOfRho(rho);
      if (l > 0.05) cc.setHex(0xa78bfa); else if (l > 0) cc.lerpColors(new THREE.Color(0xa78bfa), new THREE.Color(0x22d3ee), (0.05 - l) / 0.05);
      else cc.lerpColors(new THREE.Color(0xfbbf24), new THREE.Color(0xf43f5e), Math.min(1, -l / 0.02));
      c[i * 3] = cc.r; c[i * 3 + 1] = cc.g; c[i * 3 + 2] = cc.b;
    }
    terrainGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
  group.add(new THREE.Line(terrainGeo, mat(new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 2 }))));
  // 地形下方竖向刻度（每 1 数序）
  { const g = geo(new THREE.BufferGeometry()); const p: number[] = [];
    for (let rho = 1; rho <= 13; rho++) { const x = rho - X0, y = CWY + YMAP(vhat(x));
      p.push(RHO2X(rho), y, 0, RHO2X(rho), y - 0.16, 0); }
    p.push(RHO2X(9.7), CWY + YMAP(vhat(9.7 - X0)) - 0.3, 0, RHO2X(9.7), CWY - 1.6, 0);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3));
    group.add(new THREE.LineSegments(g, mat(new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.6 })))); }
  // EW 真空基线与势垒标注线
  { const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([RHO2X(0.5), CWY, 0.001, RHO2X(13), CWY, 0.001]), 3));
    group.add(new THREE.Line(g, mat(new THREE.LineDashedMaterial({ color: 0x64748b, dashSize: 0.16, gapSize: 0.1 }))));
    (group.children[group.children.length - 1] as import('three').Line).computeLineDistances(); }

  // —— 探针球 + EW 井内振子球 + 势垒下“经典禁戒”阴影 ——
  const ballGeo = geo(new THREE.SphereGeometry(0.16, 14, 12));
  const probe = new THREE.Mesh(ballGeo, mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0x7c5a0f, roughness: 0.4 })));
  group.add(probe);
  const ewBall = new THREE.Mesh(geo(new THREE.SphereGeometry(0.11, 12, 10)), mat(new THREE.MeshStandardMaterial({ color: 0x60a5fa, emissive: 0x1e3a8a, roughness: 0.5 })));
  group.add(ewBall);
  // 临界泡（深渊侧成核）：两个 wireframe 球（亚临界收缩 / 超临界膨胀）
  const bubGeo = geo(new THREE.SphereGeometry(1, 16, 12));
  const bubSub = new THREE.Mesh(bubGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0 })));
  const bubSup = new THREE.Mesh(bubGeo, mat(new THREE.MeshBasicMaterial({ color: 0xf43f5e, wireframe: true, transparent: true, opacity: 0 })));
  bubSub.position.set(RHO2X(11.6), CWY + YMAP(vhat(11.6 - X0)) + 0.4, 0.5);
  bubSup.position.set(RHO2X(12.6), CWY + YMAP(vhat(12.6 - X0)) + 0.7, 0.5);
  group.add(bubSub, bubSup);

  // —— 地面：log₁₀|V| 真实量级条（70 个数序 → 地面横条），当前位置标记 ——
  { const g = geo(new THREE.BufferGeometry()); const p: number[] = [];
    for (let k = 0; k <= 70; k += 7) { const xx = -4.2 + (k / 70) * 8.4; p.push(xx, 0.03, 2.35, xx, 0.03, 2.05); }
    p.push(-4.2, 0.03, 2.2, 4.2, 0.03, 2.2);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3));
    group.add(new THREE.LineSegments(g, mat(new THREE.LineBasicMaterial({ color: 0x334155 })))); }
  const vBar = new THREE.Mesh(geo(new THREE.BoxGeometry(0.08, 0.1, 0.5)), mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })));
  vBar.position.set(-4.2, 0.09, 2.2); group.add(vBar);

  // —— 地板左：O(4) bounce（瞬子）薄壁示意轮廓 φ_b(ξ)，ξ=r/R_c：ξ<1 收缩、ξ>1 膨胀 ——
  const BOX0 = -4.3, BOXW = 3.4, BOY0 = 0.06, BOYS = 1.05;
  const bounce = (xi: number) => 0.5 * (1 - Math.tanh(3 * (xi - 1)));
  const bGeo = geo(new THREE.BufferGeometry());
  { const p = new Float32Array(81 * 3);
    for (let i = 0; i < 81; i++) { const xi = 3 * i / 80; p[i * 3] = BOX0 + BOXW * i / 80; p[i * 3 + 1] = BOY0 + BOYS * bounce(xi); p[i * 3 + 2] = -2.5; }
    bGeo.setAttribute('position', new THREE.BufferAttribute(p, 3)); }
  group.add(new THREE.Line(bGeo, mat(new THREE.LineBasicMaterial({ color: 0x34d399 }))));
  { const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([BOX0, BOY0, -2.5, BOX0 + BOXW, BOY0, -2.5, BOX0 + BOXW / 3, BOY0 - 0.07, -2.5, BOX0 + BOXW / 3, BOY0 + 0.06, -2.5]), 3));
    group.add(new THREE.LineSegments(g, mat(new THREE.LineBasicMaterial({ color: 0x334155 })))); }
  const bMark = new THREE.Mesh(geo(new THREE.SphereGeometry(0.07, 10, 8)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  group.add(bMark);
  // 隧道寿命标尺（对数）：S_E(λ)=8π²/3|λ| ⇒ log₁₀(τ/age)=S_E/ln10；紫条跟踪当前 λ 的深度
  const tlBar = new THREE.Mesh(geo(new THREE.BoxGeometry(0.1, 0.07, 0.78)), mat(new THREE.MeshBasicMaterial({ color: 0xa78bfa })));
  group.add(tlBar);
  { const g = geo(new THREE.BufferGeometry()); const p: number[] = [];
    for (let k = 0; k <= 5; k++) { const xx = 3.55 + k * 0.18; p.push(xx, 0.03, 1.28, xx, 0.03, 1.56); }
    p.push(3.55, 0.03, 1.42, 4.45, 0.03, 1.42);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3));
    group.add(new THREE.LineSegments(g, mat(new THREE.LineBasicMaterial({ color: 0x475569 })))); }
  const TLMAX_LOG = Math.log10(8 * PI * PI / (3 * 0.02) / Math.LN10);   // log₁₀571.5≈2.757（满标=λ_min）
  // m_t ±1GeV 不确定带 ⇒ λ=0 交叉点漂移 2~3 个数序（橙色半透明带示意）
  { const bx0 = RHO2X(8.9), bx1 = RHO2X(10.6);
    const band = new THREE.Mesh(geo(new THREE.PlaneGeometry(bx1 - bx0, 3.1)), mat(new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.13, side: THREE.DoubleSide })));
    band.position.set((bx0 + bx1) / 2, CWY + 0.35, -0.15); group.add(band); }
  // 探针尾迹：描出最近 120 个地形位置（u 单调 ⇒ 线性追加，循环边复位）
  const TRN = 120;
  const trGeo = geo(new THREE.BufferGeometry()); const trPos = new Float32Array(TRN * 3);
  trGeo.setAttribute('position', new THREE.BufferAttribute(trPos, 3));
  trGeo.setDrawRange(0, 0);
  group.add(new THREE.Line(trGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.45 }))));
  let trFill = 0, prevU = 1;

  function makeLabel(text: string, color: string, scale: number, x: number, y: number, z: number): void {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(scale, scale / 8, 1); s.position.set(x, y, z); s.renderOrder = 998; group.add(s);
  }
  makeLabel('V(h)≈λ(h)h⁴/4：势垒在 ρ≈7.3，λ 过零 ρ≈10.0，右侧 AdS 深渊', '#c4b5fd', 4.7, 0, 3.4, 0);
  makeLabel('EW 真空（亚稳）：h=246GeV 井底微振', '#60a5fa', 3.3, -2.1, 1.6, 0.4);
  makeLabel('泡成核：R<2σ/ΔV 收缩 | R>… 膨胀（示意）', '#f472b6', 3.9, 2.9, -1.1, 0.6);
  makeLabel('地面条：log₁₀|V|/GeV⁴ ≈ 4ρ−1.9（跨 70 数序）', '#94a3b8', 3.8, 0, 0.45, 2.2);
  makeLabel('O(4) bounce 薄壁轮廓 φ_b(ξ)，ξ=r/R_c：过刻度即膨胀', '#34d399', 3.8, BOX0 + BOXW / 2, 1.35, -2.5);
  makeLabel('橙带：m_t±1GeV ⇒ λ 零点漂移 2~3 数序', '#f59e0b', 3.2, (RHO2X(8.9) + RHO2X(10.6)) / 2, 3.05, -0.15);
  makeLabel('寿命尺：log₁₀(τ/age)=8π²/(3|λ|ln10)，对数紫条', '#a78bfa', 3.1, 3.9, 0.72, 1.42);

  const infoCv = document.createElement('canvas'); infoCv.width = 668; infoCv.height = 268;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const info = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  info.scale.set(6.68, 2.68, 1); info.position.set(0, 4.75, 0.2); info.renderOrder = 999;
  group.add(info);

  const rd = { rho: 2.39, lam: lamMt, Vlog: 8.07, tunnel: 0 };
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 668, 268);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(3, 3, 662, 262);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(3, 3, 662, 262);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 23px "PingFang SC", sans-serif';
    infoCtx.fillText('希格斯真空稳定性：λ 跑动下穿零 → 我们活在“假真空”里', 12, 28);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '18px "PingFang SC", sans-serif';
    infoCtx.fillText('λ(m_t)=m_h²/2v²=0.1291；top Yukawa 负贡献 ⇒ dλ/dlnμ<0；λ=0 @ 10^{10.0}GeV，λ_min=−0.020', 12, 54);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('欧氏作用量 S_E=8π²/(3|λ_min|)=1316 ⇒ τ/age≈e^{S_E}：log₁₀≈572（远超质子稳定要求）', 12, 78);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 19px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：探针 μ=10^{rd.rho.toFixed(2)} GeV  λ(μ)=${rd.lam.toFixed(4)}  log₁₀|V/GeV⁴|=${rd.Vlog.toFixed(1)}`, 12, 106);
    const side = rd.lam > 0 ? 'λ>0：势能从 EW 井单调爬升（经典稳定）' : 'λ<0：h≳10^{9.7}GeV 处 V→−∞（AdS 深渊，隧道只穿 ~400GeV 高薄壁）';
    infoCtx.fillText(`  ${side}`, 12, 130);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '17px "PingFang SC", sans-serif';
    infoCtx.fillText(`临界泡 R_c=2σ/ΔV=4.5e−3 GeV⁻¹≈9e−4 fm（σ,ΔV 为示意值）；Mpl=1.221e19GeV ⇒ t(Mpl)=${Math.log(1.221e19 / mt).toFixed(1)}`, 12, 156);
    infoCtx.fillText(`地形为示意压缩（真实 |V| 跨 70 数序）：V̂=x²(1−x/7.31)，x=ρ−2.391`, 12, 180);
    infoCtx.fillStyle = '#22c55e'; infoCtx.font = '16px "PingFang SC", sans-serif';
    infoCtx.fillText('核对(离线锚点表)：λ(1e10GeV)=0.00000 · λ_min=−0.020 · S_E=1316 · λ(Mpl)=−0.020', 12, 206);
    infoCtx.fillText('若 m_t 再重 1GeV：λ 提前过零 → 宇宙早该坍缩 ——“巧合的边缘”即精细调节问题', 12, 230);
    infoCtx.fillText('地板左：O(4) bounce 薄壁 tanh 轮廓；黄点=膨胀泡半径 ξ=2.4tₙ² 跟踪', 12, 254);
    // λ(ρ) inset
    infoCtx.strokeStyle = '#1e293b'; infoCtx.strokeRect(524, 96, 126, 108);
    infoCtx.strokeStyle = '#64748b'; infoCtx.beginPath(); infoCtx.moveTo(524, 96 + 108 * (0.135 / 0.16)); infoCtx.lineTo(650, 96 + 108 * (0.135 / 0.16)); infoCtx.stroke();
    infoCtx.strokeStyle = '#22d3ee'; infoCtx.beginPath();
    for (let i = 0; i <= 36; i++) { const rho = 1 + i * 0.5, l = lamOfRho(rho);
      const px = 524 + (i / 36) * 126, py = 96 + (0.135 - l) / 0.16 * 108;
      if (i === 0) infoCtx.moveTo(px, py); else infoCtx.lineTo(px, py); }
    infoCtx.stroke();
    infoCtx.fillStyle = '#fbbf24';
    const ci = (Math.min(Math.max(rd.rho, 1), 19) - 1) / 0.5 / 36;
    infoCtx.beginPath(); infoCtx.arc(524 + ci * 126, 96 + (0.135 - rd.lam) / 0.16 * 108, 4, 0, TWO_PI); infoCtx.fill();
    infoCtx.fillStyle = '#64748b'; infoCtx.font = '12px sans-serif';
    infoCtx.fillText('λ(μ)，μ=10^ρ GeV', 530, 108);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  const CYCLE = 18;
  const wEW = Math.sqrt(2) * 1.5;   // 井底曲率 V̂″(0)=2 ⇒ ω=√2（显示时间压缩 ×1.5）
  return {
    update(t, dt) {
      const u = (t % CYCLE) / CYCLE;
      if (u < prevU) trFill = 0;
      prevU = u;
      const rho = 0.5 + 12.5 * u;
      rd.rho = rho; rd.lam = lamOfRho(rho);
      rd.Vlog = Math.log10(Math.max(1e-300, Math.abs(rd.lam * Math.pow(10, 4 * rho) / 4)));
      const x = rho - X0, vv = vhat(x);
      probe.position.set(RHO2X(rho), CWY + YMAP(vv) + 0.16, 0.12);
      if (trFill < TRN) {
        trPos[trFill * 3] = probe.position.x; trPos[trFill * 3 + 1] = probe.position.y; trPos[trFill * 3 + 2] = probe.position.z - 0.05;
        trFill++; trGeo.setDrawRange(0, trFill); trGeo.attributes['position'].needsUpdate = true;
      }
      // 井底振子：ω=√(V̂″(0))=√2（显示时间系数 ×1.5），小振幅微振（希格斯曲率刚度）
      const ax = 0.42 * Math.sin(t * wEW) * Math.exp(-0.03 * ((t * wEW) % 13));
      ewBall.position.set(RHO2X(ax + X0), CWY + YMAP(vhat(ax)) + 0.11, 0.12);
      // 过零事件：泡成核动画（t 模周期）
      const tn = Math.max(0, Math.min(1, (rho - 10.0) / 1.6));
      rd.tunnel = tn;
      const RRC = 0.28;
      bubSub.scale.setScalar(Math.max(0.001, RRC * (1 + 0.8 * Math.sin(t * 3)) * (1 - tn) * 0.6));
      (bubSub.material as import('three').MeshBasicMaterial).opacity = tn > 0.02 ? 0.75 * (1 - tn) : 0;
      bubSup.scale.setScalar(Math.max(0.001, RRC * tn * tn * 2.4));
      (bubSup.material as import('three').MeshBasicMaterial).opacity = tn > 0.05 ? 0.85 : 0;
      // bounce 图上标记膨胀泡半径 ξ=2.4·tₙ²（越过 ξ=1 刻度 ⇒ 超临界）
      const xiM = Math.min(3, 2.4 * tn * tn);
      bMark.position.set(BOX0 + BOXW * xiM / 3, BOY0 + BOYS * bounce(xiM) + 0.05, -2.5);
      bMark.visible = tn > 0.02;
      // 寿命标尺：S_E=8π²/3|λ| ⇒ log₁₀(τ/age)=S/ln10（|λ| 最大处 S 最小=衰变最快 ⇒ λ_min 主导）
      const Scur = rd.lam < -1e-9 ? 8 * PI * PI / (3 * -rd.lam) : 0;
      const tauLog = Scur / Math.LN10;
      const frac = tauLog > 1 ? Math.min(1, Math.log10(tauLog) / TLMAX_LOG) : 0;
      tlBar.position.set(3.55 + frac * 0.9, 0.09, 1.42);
      // 地面 |V| 数序条标记：log10|V|≈4ρ−1.9 映射 [0.5,13]→4ρ−2∈[0,50]→条 [−4.2,4.2]
      vBar.position.x = -4.2 + (Math.max(0, Math.min(70, rd.Vlog + 2)) / 70) * 8.4;
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
    },
    dispose() {
      geos.forEach((x) => x.dispose()); mats.forEach((x) => x.dispose()); texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
