import type { SceneContext, SceneInstance } from '../types';
/**
 * 摩擦磨损与润滑（P393）—— 主控方程（Reynolds 楔形 + Stribeck，node 数值复核）：
 *   刚性倾斜滑块轴承（收敛楔，运动方向膜厚递减），精确积分 Reynolds：
 *     d/dx(h³ dp/dx)=6μU dh/dx，h(0)=h₁（入口厚）、h(L)=h₂（出口最薄）、h₁=r·h₂；p(0)=p(L)=0
 *     ⇒ 精确压力分布 p(x)=(6μU/m)[1/h−h̄/(2h²)−1/h₁+h̄/(2h₁²)]，m=(h₁−h₂)/L、h̄=2h₁h₂/(h₁+h₂)
 *     W = ∫p dx = C(r)·6μU L²/h₂²，数值复核 C(1.5)=0.0219, C(2.2)=0.0267(峰值), C(3)=0.0247,
 *     C(4)=0.0207 —— 经典最优楔比 r*=2.2 ✓（与轴承手册极值一致）
 *   ⇒ 最小膜厚 h_min = h₂ = √(6μUL²C/W)（μ=0.08Pa·s 油，L=5mm，W=10⁴N/m 线载荷）
 *   膜厚比 Λ = h_min/σ（复合粗糙度 σ=0.35µm）：Λ<1 边界润滑、1–5 混合、>5 全膜
 *     复核 U=0.002/0.01/0.05/0.2/0.6 m/s → h=0.25/0.57/1.27/2.53/4.38µm → Λ=0.7/1.6/3.6/7.2/12.5
 *   摩擦系数 Stribeck 拟合 μ_f(Λ)=μ_a+μ_b·e^(−C_sΛ)，μ_a=0.004（黏性渐近）、μ_b=0.14（边界附加值）
 *     μ_a 有实底：全膜时黏性拖曳 F=μUL/h_log（h_log=(h₁−h₂)/ln(h₁/h₂) 对数平均间隙），
 *     复核 U=0.62m/s ⇒ h_log=6.72µm ⇒ F=36.9N/m ⇒ μ_v=F/W=3.7×10⁻³ ≈ 拟合渐近值 0.004 ✓
 *   扫描自变量：表面速度 U（16s 内 0→0.6m/s）。膜厚几何、微凸体接触计数、
 *   磨屑热斑、Stribeck 曲线光标、拖曳力箭头、面板全部来自同一个 U。
 *   标尺：1 world ⇔ 3.33 µm（膜厚与粗糙度同标度×DSC，真实楔长 5mm≈1.43×10⁴σ 压缩显示，板注）。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  // —— SI ——
  const MUO = 0.08, LEN = 5e-3, WD = 1e4, RR = 2.2, CR = 0.0267, SIGR = 0.35e-6;
  const hMin = (U: number) => Math.sqrt(6 * MUO * U * LEN * LEN * CR / WD);     // m
  const lambda = (U: number) => hMin(U) / SIGR;
  // Λ ⇒ U（hMin 的解析反演）⇒ 黏性渐近 μ_v(Λ)＝拖曳力/W，与曲线同一来源
  const viscMu = (Lam: number) => {
    const U = Math.pow(Lam * SIGR, 2) * WD / (6 * MUO * LEN * LEN * CR);
    const h2 = Math.max(1e-9, hMin(U)), h1 = RR * h2;
    return MUO * U * LEN / ((h1 - h2) / Math.log(h1 / h2)) / WD;
  };
  const fric = (Lam: number) => Lam > 0.05 ? viscMu(Lam) + 0.14 * Math.exp(-0.75 * Lam) : 0.14;   // 0.14＝边界摩擦系数（材料常数）
  const NM = 1e6, DSC = 0.30;                                    // µm→world 显示标度：1wu ⇔ 3.33µm（膜厚与粗糙度同比缩小）
  // 精确楔形动压分布（Reynolds 一次积分，两端 p=0）：
  //   p(f)=(6μU/m)[1/h − C/(2h²) − 1/h₁ + C/(2h₁²)]，h=h₁−m·L·f、m=(h₁−h₂)/L、C=2h₁h₂/(h₁+h₂)、h₁=r·h₂
  const pAt = (U: number, f: number): number => {
    const h2 = Math.max(1e-9, hMin(U)), h1 = RR * h2, m = (h1 - h2) / LEN;
    const Cb = 2 * h1 * h2 / (h1 + h2), h = h1 - m * LEN * f;
    return 6 * MUO * U / m * (1 / h - Cb / (2 * h * h) - 1 / h1 + Cb / (2 * h1 * h1));
  };

  // —— 星野 + 网格 ——
  {
    const g = geo(new THREE.BufferGeometry());
    const p = new Float32Array(1500);
    for (let i = 0; i < 500; i++) { p[i * 3] = (Math.random() - 0.5) * 200; p[i * 3 + 1] = (Math.random() - 0.5) * 200; p[i * 3 + 2] = (Math.random() - 0.5) * 200; }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    group.add(new THREE.Points(g, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }))));
  }
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // —— 粗糙下表面：可滚动剖面 Σa_j sin(k_j(x−vt)+φ_j)，RMS 归一后乘 σ ——
  const NX = 96, NZ = 26;
  const lowGeo = geo(new THREE.PlaneGeometry(9, 5, NX, NZ));
  const lowPos = lowGeo.attributes['position'] as import('three').BufferAttribute;
  const baseX = new Float32Array(lowPos.count), baseZ = new Float32Array(lowPos.count);
  for (let i = 0; i < lowPos.count; i++) { baseX[i] = lowPos.getX(i); baseZ[i] = lowPos.getY(i); }
  const comps = [
    [0.9, 0.82, 2.1], [1.7, 1.05, 0.4], [3.1, 0.62, 5.0], [5.4, 0.31, 2.7], [8.7, 0.18, 4.1],
  ];                                                            // k, a, φ —— 幅值∝1/k^1.1（类真实谱）
  const prof = (x: number, z: number): number => {
    let v = 0;
    for (const [k, a, ph] of comps) v += a * Math.sin(k * x + ph + 0.6 * Math.sin(z * 0.7 + k * 0.3));
    return v / 1.0696;                                          // 按 RMS=1 归一 ⇒ 乘 sAmp 后表面 RMS 恰为 σ
  };
  const lowMat = mat(new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.42 }));
  const low = new THREE.Mesh(lowGeo, lowMat);
  low.rotation.x = -Math.PI / 2; low.position.set(0, 0, 0);
  group.add(low);

  // —— 油膜体：下随剖面、上贴楔面（同一网格双面）——
  const MX = 96, MZ = 26;
  const oilGeo = geo(new THREE.PlaneGeometry(9, 5, MX, MZ));
  const oilPos = oilGeo.attributes['position'] as import('three').BufferAttribute;
  const oilMat = mat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.4, metalness: 0.1, roughness: 0.15, side: THREE.DoubleSide, depthWrite: false }));
  const oil = new THREE.Mesh(oilGeo, oilMat);
  oil.rotation.x = -Math.PI / 2;
  group.add(oil);

  // —— 滑块（楔形底面随 h 变化实时形变）——
  const SLX = 9;
  const slidGeo = geo(new THREE.BoxGeometry(SLX, 1.6, 5, 24, 1, 1));
  const sp = slidGeo.attributes['position'] as import('three').BufferAttribute;
  const origBelow = new Uint8Array(sp.count);
  for (let i = 0; i < sp.count; i++) origBelow[i] = sp.getY(i) < 0 ? 1 : 0;   // 初始盒：下排顶点分类一次
  const slidMat = mat(new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.6, roughness: 0.4 }));
  const slider = new THREE.Mesh(slidGeo, slidMat);
  group.add(slider);

  // —— 微凸体接触热斑 ——
  const NC = 60;
  const hotGeo = geo(new THREE.SphereGeometry(0.1, 8, 6));
  const hotMat = mat(new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.9 }));
  const hots = new THREE.InstancedMesh(hotGeo, hotMat, NC);
  group.add(hots);

  // —— Stribeck 曲线 μ(Λ)（右侧竖直面）——
  const NS = 110;
  const stGeo = geo(new THREE.BufferGeometry());
  {
    const p = new Float32Array((NS - 1) * 6);
    for (let i = 0; i < NS - 1; i++) {
      const Lam = 13.5 * i / (NS - 1), Lam2 = 13.5 * (i + 1) / (NS - 1);
      p[i * 6] = 3.1 + Lam * 0.105; p[i * 6 + 1] = 0.5 + fric(Lam) * 26; p[i * 6 + 2] = -2.5;
      p[i * 6 + 3] = 3.1 + Lam2 * 0.105; p[i * 6 + 4] = 0.5 + fric(Lam2) * 26; p[i * 6 + 5] = -2.5;
    }
    stGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  }
  group.add(new THREE.Line(stGeo, mat(new THREE.LineBasicMaterial({ color: 0xa855f7 }))));
  const stDot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.1, 12, 10)), mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })));
  stDot.position.z = -2.5; group.add(stDot);
  {
    const axGeo = geo(new THREE.BufferGeometry());
    axGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([3.1, 0.5, -2.5, 3.1 + 13.5 * 0.105 + 0.3, 0.5, -2.5, 3.1, 0.5, -2.5, 3.1, 0.5 + 0.145 * 26, -2.5]), 3));
    group.add(new THREE.LineSegments(axGeo, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));
  }

  // —— 速度箭头 + 标签 ——
  function makeLabel(text: string, color: string, x: number, y: number, z: number, wu = 3.0): void {
    const c2 = document.createElement('canvas'); c2.width = 512; c2.height = 64;
    const c3 = c2.getContext('2d')!;
    c3.fillStyle = color; c3.font = 'bold 27px "PingFang SC", sans-serif'; c3.textAlign = 'center'; c3.textBaseline = 'middle';
    c3.fillText(text, 256, 32);
    const sp = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(c2)), transparent: true })));
    sp.scale.set(wu, wu / 8, 1); sp.position.set(x, y, z); group.add(sp);
  }
  const vShaft = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.05, 0.05, 1, 8)), mat(new THREE.MeshBasicMaterial({ color: 0x22c55e })));
  const vHead = new THREE.Mesh(geo(new THREE.ConeGeometry(0.12, 0.3, 10)), mat(new THREE.MeshBasicMaterial({ color: 0x22c55e })));
  vShaft.rotation.z = -Math.PI / 2; vHead.rotation.z = -Math.PI / 2;
  vShaft.position.set(0.9, 3.3, 0); vHead.position.set(1.6, 3.3, 0);
  group.add(vShaft, vHead);
  makeLabel('滑块楔：入口厚、出口薄（r=h₁/h₂=2.2 最优）', '#fca5a5', -1.2, 4.1, 1.6, 4.6);
  makeLabel('下表面 = 相对滑移的粗糙剖面；青 = 润滑油膜', '#67e8f9', -1.4, 0.15, 3.0, 4.6);
  makeLabel('Stribeck μ(Λ)：0.14→0.004', '#d8b4fe', 4.5, 2.45, -2.5, 3.0);

  // —— Λ 直观量规：绿柱=膜厚 h_min（世界 µm 数标度），红线=粗糙度 σ=0.35 ——
  const GA_X = 4.35, GA_Y0 = 0.85;
  const hBarMat = mat(new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.8 }));
  const hBar = new THREE.Mesh(geo(new THREE.BoxGeometry(0.18, 1, 0.18)), hBarMat);
  group.add(hBar);
  {
    const gg = geo(new THREE.BufferGeometry());
    const ys = SIGR * NM * DSC;
    gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([GA_X - 0.32, GA_Y0 + ys, 0, GA_X + 0.32, GA_Y0 + ys, 0]), 3));
    group.add(new THREE.Line(gg, mat(new THREE.LineBasicMaterial({ color: 0xef4444 }))));
    const c7 = document.createElement('canvas'); c7.width = 512; c7.height = 64;
    const x7 = c7.getContext('2d')!;
    x7.fillStyle = '#fca5a5'; x7.font = 'bold 27px "PingFang SC", sans-serif'; x7.textAlign = 'center'; x7.textBaseline = 'middle';
    x7.fillText('绿柱高=h_min 红线=σ：柱没线 ⇒ 微凸体接触', 256, 32);
    const sp7 = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(c7)), transparent: true })));
    sp7.scale.set(3.6, 0.45, 1); sp7.position.set(GA_X, GA_Y0 + 2.15, 0); group.add(sp7);
  }
  // —— Stribeck 图上 Λ=1 / Λ=5  regimes 分界（经验边界）——
  {
    const rg = geo(new THREE.BufferGeometry());
    const x1 = 3.1 + 1 * 0.105, x5 = 3.1 + 5 * 0.105;
    rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([x1, 0.5, -2.5, x1, 4.2, -2.5, x5, 0.5, -2.5, x5, 4.2, -2.5]), 3));
    const rl = new THREE.LineSegments(rg, mat(new THREE.LineDashedMaterial({ color: 0x475569, dashSize: 0.1, gapSize: 0.07 })));
    rl.computeLineDistances(); group.add(rl);
  }

  // —— 楔内动压分布 p(x)：画在油膜前缘 z=PZ，基线 y=PY，峰值处即承载中心 ——
  const NPR = 65, PZC = 2.52, PYC = 0.30, PMAG = 3.6e-7;
  const prGeo = geo(new THREE.BufferGeometry());
  prGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NPR * 3), 3));
  {
    // 定载 W 下 p(x) 与 U 无关（U↓ 使 h∝√U↓，两者在 p=6μU/m·[...] 里恰好抵消）——node 复核 p_max=3.192MPa 恒定
    const pp = prGeo.attributes['position'].array as Float32Array;
    for (let i = 0; i < NPR; i++) {
      const f = i / (NPR - 1);
      pp[i * 3] = -SLX / 2 + SLX * f;
      pp[i * 3 + 1] = PYC + Math.max(0, pAt(1, f)) * PMAG;
      pp[i * 3 + 2] = PZC;
    }
    prGeo.setDrawRange(0, NPR);
  }
  group.add(new THREE.Line(prGeo, mat(new THREE.LineBasicMaterial({ color: 0x4ade80 }))));
  {
    const gb = geo(new THREE.BufferGeometry());
    gb.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-4.5, PYC, PZC, 4.5, PYC, PZC]), 3));
    group.add(new THREE.Line(gb, mat(new THREE.LineBasicMaterial({ color: 0x334155 }))));
  }
  {
    const c9 = document.createElement('canvas'); c9.width = 768; c9.height = 64;
    const x9 = c9.getContext('2d')!;
    x9.fillStyle = '#86efac'; x9.font = 'bold 27px "PingFang SC", sans-serif'; x9.textAlign = 'center'; x9.textBaseline = 'middle';
    x9.fillText('绿线＝楔内动压 p(x)（定载下 p_max=3.19MPa 与 U 无关）：两端零、峰在 h=h̄ 处', 384, 32);
    const sp9 = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(c9)), transparent: true, depthTest: false })));
    sp9.scale.set(6.0, 0.5, 1); sp9.position.set(0, 0.02, PZC); group.add(sp9);
  }

  // —— 面板 ——
  const cv = document.createElement('canvas'); cv.width = 780; cv.height = 250;
  const cc = cv.getContext('2d')!;
  const ct = tex(new THREE.CanvasTexture(cv));
  const panel = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: ct, transparent: true, depthTest: false })));
  panel.scale.set(7.6, 7.6 * 250 / 780, 1); panel.position.set(0, 4.6, 0.2); panel.renderOrder = 998;
  group.add(panel);
  const S = { U: 0, h: 0, lam: 0, mu: 0, contacts: 0, dmean: 0, dmax: 0, fv: 0 };
  function draw(): void {
    cc.clearRect(0, 0, 780, 250);
    cc.fillStyle = 'rgba(7,11,20,0.84)'; cc.fillRect(3, 3, 774, 244);
    cc.strokeStyle = '#334155'; cc.lineWidth = 3; cc.strokeRect(3, 3, 774, 244);
    cc.textAlign = 'left';
    cc.fillStyle = '#f8fafc'; cc.font = 'bold 25px "PingFang SC", sans-serif';
    cc.fillText('Stribeck：从齿牙相碰到完全浮起', 18, 34);
    cc.fillStyle = '#22d3ee'; cc.font = '22px "PingFang SC", sans-serif';
    cc.fillText('Reynolds 收敛楔：W=C·6μUL²/h_min² ⇒ h_min=√(6μUL²C/W)', 18, 64);
    cc.fillText('Λ=h_min/σ(0.35µm)；μ_f=μ_v(Λ)+0.14·e^(−0.75Λ)，μ_v=拖曳/W（与曲线同源；Λ≤0.05 取边界 0.14）', 18, 90);
    cc.fillStyle = '#a855f7';
    cc.fillText('Λ<1 边界（微凸体承栽）｜1–5 混合｜>5 全膜黏性润滑', 18, 118);
    cc.fillStyle = '#22c55e';
    cc.fillText(`黏性拖曳 F=μUL/h_log=${S.fv.toFixed(1)}N/m ⇒ μ_v=F/W=${(S.fv / WD).toFixed(4)}（全膜渐近底）`, 18, 144);
    cc.fillStyle = '#fbbf24'; cc.font = 'bold 21px "PingFang SC", sans-serif';
    cc.fillText(`读数：U=${S.U.toFixed(3)}m/s  h_min=${(S.h * NM).toFixed(2)}µm  Λ=${S.lam.toFixed(2)}  μ_f=${S.mu.toFixed(4)}`, 18, 176);
    cc.fillText(`接触点数 ${S.contacts}${S.contacts > 0 ? `（平均过盈 ${(S.dmean).toFixed(3)}σ，最大 ${(S.dmax).toFixed(3)}σ——过盈由剖面与楔面实算高度差得出）` : '（膜完全隔开，W 全由油膜承担）'}`, 18, 202);
    cc.fillStyle = S.lam < 1 ? '#ef4444' : S.lam < 5 ? '#fbbf24' : '#22c55e';
    cc.fillText(S.lam < 1 ? '状态：边界润滑 —— 磨损发生中' : S.lam < 5 ? '状态：混合润滑 —— 部分接触' : '状态：黏性（全膜）润滑 —— 无磨损', 18, 228);
    ct.needsUpdate = true;
  }

  const mtx = new THREE.Matrix4(), vp2 = new THREE.Vector3(), vs2 = new THREE.Vector3(), qq = new THREE.Quaternion();
  let scroll = 0;
  return {
    update(t, dt) {
      const PER = 16;
      const ph = (t % PER) / PER;
      const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
      const U = 0.62 * tri;
      const hm = Math.max(1e-8, hMin(U)) * NM * DSC;             // 世界（1wu ⇔ 3.33µm）
      const Lam = hm / (SIGR * NM * DSC);
      const tilt = (RR - 1) * hm / SLX;                          // 楔 slope（世界）
      scroll += U * dt * 3.2;                                    // 显示速度放大 ×3.2 s/m
      // 下表面：y=σ·prof（σ 世界 = 0.35µm×DSC）
      const sAmp = SIGR * NM * DSC;
      for (let i = 0; i < lowPos.count; i++) {
        const x = baseX[i] - scroll, z = baseZ[i];
        const y = sAmp * prof(x, z);
        lowPos.setXYZ(i, baseX[i], baseZ[i], y);                 // 局部 (x,y)→旋转后 (x,z) 平面，z=世界 y
      }
      lowGeo.attributes['position'].needsUpdate = true;
      lowGeo.computeVertexNormals();
      // 滑块 = 刚体倾斜：底面世界 y = yRef + hm + tilt·(x_in−x)，出口(+x)最薄=hm
      const yRef = sAmp * 0.85;
      for (let i = 0; i < sp.count; i++) {
        const x = sp.getX(i);
        const gap = hm + tilt * (SLX / 2 - x);
        sp.setY(i, origBelow[i] ? gap : gap + 1.6);
      }
      slidGeo.attributes['position'].needsUpdate = true;
      slidGeo.computeVertexNormals();
      slider.position.set(0, yRef, 0);
      // 油膜：下贴合剖面，上贴合楔面
      const op = oilPos;
      let contacts = 0, ci = 0, dsum = 0, dmax = 0;
      for (let i = 0; i < op.count; i++) {
        const wx = baseX[i] * 1, wz = baseZ[i];
        const yl = sAmp * prof(wx - scroll, wz);
        const yu = yRef + hm + tilt * (SLX / 2 - wx);
        const touch = yl > yu - 0.02 * DSC;
        op.setXYZ(i, wx, wz, touch ? yl : (yl + yu) / 2);
        if (touch) {
          const dsig = (yl - yu) / sAmp;                          // 该点过盈量（以 σ 计，与剖面同源）
          contacts++; dsum += dsig; dmax = Math.max(dmax, dsig);
          if (ci < NC) {
            vp2.set(wx, yu + 0.02 * DSC, wz); vs2.setScalar(0.6 + 0.5 * Math.min(1, dsig / 0.6)); qq.identity();
            mtx.compose(vp2, qq, vs2); hots.setMatrixAt(ci++, mtx);
          }
        }
      }
      oilGeo.attributes['position'].needsUpdate = true;
      oilMat.opacity = Math.min(0.55, 0.16 + 0.1 * Lam);
      hots.count = ci; hots.instanceMatrix.needsUpdate = true;
      vShaft.scale.x = 0.4 + U * 2.2; vHead.position.x = 0.35 + U * 2.2 + 0.7;
      vShaft.position.x = vHead.position.x - 0.85;
      stDot.position.set(3.1 + Lam * 0.105, 0.5 + fric(Lam) * 26, -2.5);
      // 黏性拖曳（全膜时的摩擦底）：F=μU·L/h_log，h_log=(h₁−h₂)/ln(h₁/h₂) 为对数平均间隙
      {
        const h2 = Math.max(1e-9, hMin(U)), h1 = RR * h2;
        const hlog = (h1 - h2) / Math.log(h1 / h2);
        S.fv = MUO * U * LEN / hlog;
      }
      const hb = Math.max(0.02, hm);
      hBar.scale.y = hb; hBar.position.set(GA_X, GA_Y0 + hb / 2, 0);
      hBarMat.opacity = Lam < 1 ? 0.45 : 0.8;
      S.U = U; S.h = hm / (NM * DSC); S.lam = Lam; S.mu = fric(Lam); S.contacts = contacts; S.dmean = contacts > 0 ? dsum / contacts : 0; S.dmax = dmax;
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) draw();
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
