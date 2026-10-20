import type { SceneContext, SceneInstance } from '../types';
/**
 * 表面催化与吸附（P391）—— 主控方程（Langmuir + Arrhenius 脱附 + 鞍点速率，node 复核）：
 *   平衡覆盖度  θ = Kp/(1+Kp)，K(T)=10³·exp[5500(1/T−1/500)] 1/Pa（ΔH_ads≈−0.47eV）
 *     复核 p=10⁻³Pa：θ=0.999(300K) → 0.773(450K) → 0.138(600K) → 0.0075(900K)
 *   停留时间    τ_des = ν₀⁻¹·e^{E_d/RT}，ν₀=10¹³Hz， terrace E_d=1.1eV / 台阶位 1.7eV
 *     复核：τ(300K)=3.0×10⁵s ↔ τ(900K)=1.4×10⁻⁷s —— 12.3 个数量级，升温即“清空”表面
 *   台阶催化：解离鞍点 E_a 由气相 1.0eV 降到 0.35eV ⇒ 速率比 e^{0.65·11604/T}
 *     复核 600K：≈2.9×10⁵ 倍 —— 势能面上催化剂把鞍点“削矮一截”
 *   Langmuir–Hinshelwood 速率 r = k_s·θ_A·θ_B·e^{−E_a/RT}（画面 r∝θ²·kf）
 *   扫描自变量：T 300→900K（16s 往返）。吸附位占用数=round(θ·N)、热抖动幅∝√T、
 *   分子解离驻留时长、势能面小球越垒速率、面板全部来自同一个 T。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  // —— 物理（eV / K）——
  const KB11 = 11604;                                            // 1 eV 对应 11604 K
  const TH0 = 1e-3;
  const Kof = (T: number) => 1e3 * Math.exp(5500 * (1 / T - 1 / 500));
  const theta = (T: number) => { const k = Kof(T) * TH0; return k / (1 + k); };
  const tauDes = (T: number, ed: number) => 1e-13 * Math.exp(ed * KB11 / T);
  const kf = (T: number) => Math.exp(-0.35 * KB11 * (1 / T - 1 / 900));   // 归一化台阶解离速率
  const lhr = (T: number) => { const t = theta(T); return t * t * Math.exp(-0.35 * KB11 / T); };  // LH 速率 r=k_s·θ²·e^{−E_a/RT}
  let TOPT = 0;
  const RMAX = (() => { let bt = 300, bv = 0; for (let T = 300; T <= 900; T += 0.25) { const v = lhr(T); if (v > bv) { bv = v; bt = T; } } TOPT = bt; return bv; })();

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

  // —— 金属晶面：上平台（x<1.3）+ 台阶下落 + 下层 ——
  const metalMat = mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.85, roughness: 0.3 }));
  const atGeo = geo(new THREE.SphereGeometry(0.135, 12, 10));
  const sites: [number, number][] = [];                            // 上平台吸附位（六方排列）
  const stepSites: [number, number][] = [];
  {
    let n = 0;
    const xs = -2.9, dz = 0.42, dxp = 0.48;
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 9; c++) {
        const x = xs + c * dxp + (r % 2) * dxp / 2;
        const z = -1.25 + r * dz;
        if (x < 1.28) sites.push([x, z]); else if (x < 1.75) stepSites.push([x, z]);
        const m = new THREE.Mesh(atGeo, metalMat);
        m.position.set(x, 0, z); group.add(m); n++;
        const m2 = new THREE.Mesh(atGeo, metalMat);
        m2.position.set(x + dxp / 2, -0.42, z); group.add(m2); n++;
      }
    }
    for (let r = 0; r < 7; r++) for (let c = 0; c < 3; c++) {      // 台阶下方的低台面
      const m = new THREE.Mesh(atGeo, metalMat);
      m.position.set(1.45 + c * dxp, -0.55, -1.25 + r * dz + (c % 2) * 0.2); group.add(m);
    }
  }
  const NS = sites.length;

  // —— 吸附原子（θ 决定数量），热抖动 ——
  const adsGeo = geo(new THREE.SphereGeometry(0.09, 10, 8));
  const adsMat = mat(new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x7f1d1d, emissiveIntensity: 0.6, roughness: 0.35 }));
  const ads = new THREE.InstancedMesh(adsGeo, adsMat, NS);
  group.add(ads);

  // —— 双原子分子 + 键 + 产物 ——
  const molMat = mat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0e7490, emissiveIntensity: 0.5, roughness: 0.3 }));
  const prodMat = mat(new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x14532d, emissiveIntensity: 0.6, roughness: 0.3 }));
  const m1 = new THREE.Mesh(adsGeo, molMat), m2 = new THREE.Mesh(adsGeo, molMat);
  const pr1 = new THREE.Mesh(adsGeo, prodMat), pr2 = new THREE.Mesh(adsGeo, prodMat);
  group.add(m1, m2, pr1, pr2);
  const bondGeo = geo(new THREE.BufferGeometry());
  bondGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const bondLine = new THREE.Line(bondGeo, mat(new THREE.LineBasicMaterial({ color: 0xa5f3fc })));
  group.add(bondLine);

  // —— 势能面（背面竖直平面）：气相垒 1.0eV vs 台阶催化 0.35eV + 前驱体深阱 ——
  const PP = 130;
  const gasGeo = geo(new THREE.BufferGeometry()), catGeo = geo(new THREE.BufferGeometry());
  const Es = new Float32Array(PP), Ec = new Float32Array(PP);
  const egX = (s: number) => -3.4 + 6.8 * s;
  const egY = (e: number) => 0.7 + e * 1.45;                        // eV→wu
  const well = (s: number) => -0.5 * Math.exp(-Math.pow((s - 0.14) / 0.07, 2));
  for (let i = 0; i < PP; i++) {
    const s = i / (PP - 1);
    Es[i] = 1.0 * Math.sin(Math.PI * s) ** 2;
    Ec[i] = 0.35 * Math.sin(Math.PI * s) ** 2 + well(s) + (s > 0.75 ? -0.15 * Math.sin(Math.PI * (s - 0.75) / 0.5) : 0);
  }
  {
    const p = new Float32Array((PP - 1) * 6);
    for (let i = 0; i < PP - 1; i++) {
      p[i * 6] = egX(i / (PP - 1)); p[i * 6 + 1] = egY(Es[i]); p[i * 6 + 2] = -2.5;
      p[i * 6 + 3] = egX((i + 1) / (PP - 1)); p[i * 6 + 4] = egY(Es[i + 1]); p[i * 6 + 5] = -2.5;
    }
    gasGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const p2 = new Float32Array((PP - 1) * 6);
    for (let i = 0; i < PP - 1; i++) {
      p2[i * 6] = egX(i / (PP - 1)); p2[i * 6 + 1] = egY(Ec[i]); p2[i * 6 + 2] = -2.5;
      p2[i * 6 + 3] = egX((i + 1) / (PP - 1)); p2[i * 6 + 4] = egY(Ec[i + 1]); p2[i * 6 + 5] = -2.5;
    }
    catGeo.setAttribute('position', new THREE.BufferAttribute(p2, 3));
  }
  group.add(new THREE.LineSegments(gasGeo, mat(new THREE.LineBasicMaterial({ color: 0x94a3b8 }))));
  const catLine = new THREE.Line(catGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e })));
  group.add(catLine);
  const ball = new THREE.Mesh(geo(new THREE.SphereGeometry(0.11, 12, 10)), mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })));
  ball.position.z = -2.45; group.add(ball);

  // —— 标签 ——
  function makeLabel(text: string, color: string, x: number, y: number, z: number, wu = 3.0): void {
    const c2 = document.createElement('canvas'); c2.width = 512; c2.height = 64;
    const c3 = c2.getContext('2d')!;
    c3.fillStyle = color; c3.font = 'bold 27px "PingFang SC", sans-serif'; c3.textAlign = 'center'; c3.textBaseline = 'middle';
    c3.fillText(text, 256, 32);
    const sp = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(c2)), transparent: true })));
    sp.scale.set(wu, wu / 8, 1); sp.position.set(x, y, z); group.add(sp);
  }
  makeLabel('台阶位：分子在此解离（E_a 1.0→0.35eV）', '#fcd34d', 1.6, 1.15, 0.4, 3.6);
  makeLabel('灰=气相路径 绿=台阶催化路径（势能面 E(反应坐标)）', '#a7f3d0', 0, 3.05, -2.5, 4.6);

  // —— 面板 ——
  const cv = document.createElement('canvas'); cv.width = 780; cv.height = 250;
  const cc = cv.getContext('2d')!;
  const ct = tex(new THREE.CanvasTexture(cv));
  const panel = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: ct, transparent: true, depthTest: false })));
  panel.scale.set(7.6, 7.6 * 250 / 780, 1); panel.position.set(0, 3.9, 0.6); panel.renderOrder = 998;
  group.add(panel);
  const S = { T: 300, th: 0, K: 0, tau: 0, taus: 0, occ: 0, ratio: 0, r: 0, rf: 0 };
  function fmtT(sec: number): string {
    if (sec > 1e4) return `${(sec / 3600).toExponential(1)}h`;
    if (sec > 1) return `${sec.toFixed(1)}s`;
    return sec.toExponential(1) + 's';
  }
  function draw(): void {
    cc.clearRect(0, 0, 780, 250);
    cc.fillStyle = 'rgba(7,11,20,0.84)'; cc.fillRect(3, 3, 774, 244);
    cc.strokeStyle = '#334155'; cc.lineWidth = 3; cc.strokeRect(3, 3, 774, 244);
    cc.textAlign = 'left';
    cc.fillStyle = '#f8fafc'; cc.font = 'bold 25px "PingFang SC", sans-serif';
    cc.fillText('表面催化：先盖满表面，再把鞍点削矮', 18, 34);
    cc.fillStyle = '#22d3ee'; cc.font = '22px "PingFang SC", sans-serif';
    cc.fillText('Langmuir θ=Kp/(1+Kp)，K∝e^{|ΔH|/RT}；Arrhenius τ=ν₀⁻¹e^{Ed/RT}', 18, 64);
    cc.fillStyle = '#a855f7';
    cc.fillText('LH 速率 r=k_s·θ²·e^{−E_a/RT}：低温θ高但越过不了鞍点', 18, 92);
    cc.fillStyle = '#22c55e';
    cc.fillText(`台阶把 E_a 从 1.0eV 压到 0.35eV ⇒ 速率比=e^{0.65·11604/T}`, 18, 118);
    cc.fillStyle = '#fbbf24'; cc.font = 'bold 21px "PingFang SC", sans-serif';
    cc.fillText(`读数：T=${S.T.toFixed(0)}K  p=10⁻³Pa  K=${S.K.toExponential(2)}1/Pa  θ=${S.th.toFixed(4)}`, 18, 150);
    cc.fillText(`覆盖位 ${S.occ}/${NS}  τ_des(平台Ed=1.1eV)=${fmtT(S.tau)}  台阶(1.7eV)=${fmtT(S.taus)}`, 18, 176);
    cc.fillText(`LH 速率 r=${S.r.toExponential(2)}＝${(S.rf * 100).toFixed(1)}% 峰（峰位 T_opt=${TOPT.toFixed(0)}K）  台阶/气相速率比=${S.ratio.toExponential(2)}`, 18, 202);
    cc.fillStyle = S.rf > 0.85 ? '#22c55e' : S.rf < 0.1 ? '#ef4444' : '#fbbf24';
    cc.fillText(S.th > 0.9 ? 'θ≈1 表面被“冻满”——越垒概率极低 ⇒ r 受活化项压制' : S.th < 0.15 ? 'θ→0 表面几乎清空——脱附主导 ⇒ r 受覆盖项压制' : `黄金窗口：θ=${S.th.toFixed(2)} 与越垒项相乘取峰（r=${(S.rf * 100).toFixed(0)}% 峰值，T_opt=${TOPT.toFixed(0)}K）`, 18, 228);
    ct.needsUpdate = true;
  }

  const mtx = new THREE.Matrix4(), vp = new THREE.Vector3(), vs = new THREE.Vector3(), qq = new THREE.Quaternion();
  let cyc = 0;
  const ballAt = (s: number): number => {
    const i = Math.max(0, Math.min(PP - 1, Math.round(s * (PP - 1))));
    return egY(Ec[i]);
  };

  return {
    update(t, dt) {
      const PER = 16;
      const ph = (t % PER) / PER;
      const T = 300 + 600 * (ph < 0.5 ? ph * 2 : 2 - ph * 2);
      const th = theta(T);
      S.T = T; S.th = th; S.K = Kof(T); S.tau = tauDes(T, 1.1); S.taus = tauDes(T, 1.7);
      S.r = lhr(T); S.rf = S.r / RMAX;
      S.ratio = Math.exp((1.0 - 0.35) * KB11 / T);
      // 吸附层：数量=θ·N；抖动幅 ∝ √T，脱附闪烁 ∝ 1/τ
      const occ = Math.round(th * NS); S.occ = occ;
      const shake = 0.02 + 0.05 * Math.sqrt(T / 900);
      for (let i = 0; i < NS; i++) {
        const on = i < occ;
        const [sx, sz] = sites[(i * 5 + 3) % NS];
        const yy = 0.24 + shake * Math.sin(t * (4 + (i % 5)) + i);
        vp.set(sx, on ? yy : -3, sz);
        const r = on ? 1 : 0.0001; vs.set(r, r, r); qq.identity(); mtx.compose(vp, qq, vs);
        ads.setMatrixAt(i, mtx);
      }
      ads.count = occ; ads.instanceMatrix.needsUpdate = true;
      // 分子循环：吸附→台阶驻留（∝1/kf）→解离→产物脱附
      const kfT = kf(T);
      cyc += dt * (0.25 + 1.2 * kfT);                            // 高温周转快
      if (cyc > 4) cyc -= 4;
      const stepX = 1.55, stepZ = 0.35;
      let ax: number, ay: number, az: number, bx: number, by: number, bz: number, split = 0;
      if (cyc < 1) {                                              // 飞来：抛物线落向台阶
        const u = cyc;
        ax = stepX - 1.4 + 1.4 * u; ay = 2.6 - 2.35 * u * u; az = stepZ;
        bx = ax - 0.22; by = ay + 0.1; bz = az; split = 0;
      } else if (cyc < 2.6) {                                     // 台阶前驱体阱中振动（低温驻留更久由驻留相位时长体现）
        const u = (cyc - 1) / 1.6;
        const wob = 0.05 * Math.sin(u * 26);
        ax = stepX + wob; ay = 0.3 + wob * 0.6; az = stepZ;
        bx = stepX - 0.2 + wob; by = 0.38; bz = stepZ + 0.06; split = 0;
      } else if (cyc < 3.3) {                                     // 解离：两原子被拉到相邻位
        const u = (cyc - 2.6) / 0.7;
        ax = stepX + u * 0.5; ay = 0.3 - 0.05 * Math.sin(Math.PI * u); az = stepZ - u * 0.4;
        bx = stepX - u * 0.45; by = 0.32; bz = stepZ + u * 0.42; split = 1;
      } else {                                                    // 复合产物 CO₂ 型脱附上升
        const u = (cyc - 3.3) / 0.7;
        ax = stepX; ay = 0.3 + 2.9 * u * u; az = stepZ;
        bx = stepX + 0.16; by = ay + 0.1; bz = az; split = 2;
      }
      m1.position.set(ax, ay, az); m2.position.set(bx, by, bz);
      m1.visible = m2.visible = cyc < 3.3 || cyc > 3.85;
      pr1.visible = pr2.visible = cyc >= 3.3 && cyc <= 4;
      if (pr1.visible) { const u = (cyc - 3.3) / 0.7; pr1.position.set(stepX, 0.3 + 3.2 * u, stepZ); pr2.position.set(stepX - 0.14, 0.36 + 3.2 * u, stepZ); bondLine.visible = false; }
      const bp = bondGeo.attributes['position'] as import('three').BufferAttribute;
      if (!pr1.visible && m1.visible) {
        bp.setXYZ(0, ax, ay, az); bp.setXYZ(1, bx, by, bz); bondGeo.attributes['position'].needsUpdate = true;
        bondLine.visible = split !== 1;
        bondGeo.setDrawRange(0, 2);
      } else bondLine.visible = false;
      molMat.color.setHSL(split === 1 ? 0.02 : 0.52, 0.7, 0.55);
      // 势能面小球：驻留阱内（低速随机），偶尔按 kf 概率翻鞍
      const s = kfT > 0.7 ? (cyc % 1) * 0.9 + 0.05 : 0.14 + 0.02 * Math.sin(t * 3);
      ball.position.set(egX(s), ballAt(s) + 0.12, -2.45);
      S.occ = occ;
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
