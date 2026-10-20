import type { SceneContext, SceneInstance } from '../types';
/** 散射截面（P159）：主控方程
 *  ① 卢瑟福：dσ/dΩ = |f_C|² = [Z₁Z₂e'²/(4E)]²·csc⁴(θ/2)（a = 11.4 fm ⇒ 前向尖峰 ∝1/sin⁴），
 *     σ(θ>θ₀) = 4πa²cot²(θ₀/2)；索末菲参数 η = Z₁Z₂e'²μ/(ħ²k) ≫1 ⇒ 经典近似成立
 *  ② 分波展开：f(θ) = f_C·e^{iφ_C} + Σ_l (2l+1)P_l(cosθ)·sinδ_l·e^{iδ_l}/k，φ_C = −η·ln sin²(θ/2)
 *     布莱特–维格纳共振相移 δ_l = atan2(Γ/2, E−E_l)：E 扫过 E_l 时 δ_l = π/2 ⇒ 共振球（|f_l|≤1/k 幺正极限）
 *  画面：粒子束沿 +x̂ 打向靶核，出射角分布铺成三维微分截面"花瓣"曲面（径向 ∝ (dσ/dΩ)^0.35 压缩显示），
 *  前向细针 = 库仑小角散射；E 扫过共振能级时花瓣上鼓出干涉瓣。探测器弧上 26 个计数点随 dσ/dΩ 缩放。
 *  自变量：入射 α 粒子能量 E = 4→9 MeV（16 s 周期），Au 靶 Z=79。 */
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

  const PIM = Math.PI;
  const Z1 = 2, Z2 = 79, E2 = 1.44;                // MeV·fm
  const MU = 3650, HBC = 197.327;                  // MeV/c²、MeV·fm
  const ERES = [5.6, 6.8, 7.9], GAM = 0.45;        // 复合核共振能级（l=0,1,2）与宽度
  const TC = new THREE.Vector3(0, 0.9, 0);         // 靶心

  function legendre(l: number, x: number): number {
    if (l === 0) return 1;
    if (l === 1) return x;
    let p0 = 1, p1 = x;
    for (let k = 2; k <= l; k++) { const p = ((2 * k - 1) * x * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p; }
    return p1;
  }

  let E = 6;
  function dsig(th: number): number {             // fm²/sr，θ 弧度（|f_C + f_N|²）
    const s2 = Math.sin(th / 2);
    const a = Z1 * Z2 * E2 / (4 * E);
    const k = Math.sqrt(2 * MU * E) / HBC;
    const eta = Z1 * Z2 * E2 * MU / (HBC * HBC * k);
    const fCmag = a / (s2 * s2);
    const phiC = -eta * Math.log(Math.max(1e-6, s2 * s2));
    let re = fCmag * Math.cos(phiC), im = fCmag * Math.sin(phiC);
    for (let l = 0; l <= 2; l++) {
      const d = Math.atan2(GAM / 2, E - ERES[l]);
      const fl = ((2 * l + 1) * legendre(l, Math.cos(th)) * Math.sin(d)) / k;
      re += fl * Math.cos(d); im += fl * Math.sin(d);
    }
    return re * re + im * im;
  }

  // —— 花瓣旋转曲面 ——
  const NT = 46, NP = 40;
  const TH_MIN = 6 / 57.2958;
  const petalGeo = geo(new THREE.BufferGeometry());
  const pPos = new Float32Array((NT + 1) * (NP + 1) * 3);
  const pCol = new Float32Array((NT + 1) * (NP + 1) * 3);
  petalGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  petalGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const pIdx: number[] = [];
  for (let i = 0; i < NT; i++) for (let j = 0; j < NP; j++) {
    const a0 = i * (NP + 1) + j, b0 = a0 + NP + 1;
    pIdx.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1);
  }
  petalGeo.setIndex(pIdx);
  const petal = new THREE.Mesh(petalGeo, mat(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })));
  group.add(petal);

  function updatePetal(): void {
    const rmax = Math.pow(dsig(TH_MIN), 0.35);
    let v = 0;
    for (let i = 0; i <= NT; i++) {
      const th = TH_MIN + (PIM - TH_MIN) * (i / NT);
      const R = 2.7 * Math.pow(dsig(th), 0.35) / rmax;
      const u = i / NT;
      const cr = 0.13 + 0.9 * u, cg = 0.83 - 0.5 * u, cb = 0.93 - 0.25 * u;
      for (let j = 0; j <= NP; j++) {
        const ph = (j / NP) * 2 * Math.PI;
        const dirx = Math.cos(th), rr = Math.sin(th);
        pPos[v * 3] = TC.x + R * dirx;
        pPos[v * 3 + 1] = TC.y + R * rr * Math.cos(ph);
        pPos[v * 3 + 2] = R * rr * Math.sin(ph);
        pCol[v * 3] = cr; pCol[v * 3 + 1] = cg; pCol[v * 3 + 2] = cb;
        v++;
      }
    }
    petalGeo.attributes['position'].needsUpdate = true;
    petalGeo.attributes['color'].needsUpdate = true;
  }

  // —— 入射束 ——
  const beamGeo = geo(new THREE.BufferGeometry());
  beamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -4.6, TC.y, 0, TC.x - 0.3, TC.y, 0,
    -4.6, TC.y + 0.16, 0.16, TC.x - 0.3, TC.y + 0.16, 0.16,
    -4.6, TC.y - 0.16, -0.16, TC.x - 0.3, TC.y - 0.16, -0.16,
  ]), 3));
  const beamDash = new THREE.LineSegments(beamGeo, mat(new THREE.LineDashedMaterial({ color: 0xfbbf24, dashSize: 0.16, gapSize: 0.1, transparent: true, opacity: 0.8 })));
  beamDash.computeLineDistances();
  group.add(beamDash);
  const bullets: import('three').Mesh[] = [];
  const bulletGeo = geo(new THREE.SphereGeometry(0.07, 10, 8));
  const bulletMat = mat(new THREE.MeshBasicMaterial({ color: 0xfef3c7 }));
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(bulletGeo, bulletMat);
    group.add(b); bullets.push(b);
  }
  // 靶核 + 库仑场环
  const target = new THREE.Mesh(geo(new THREE.SphereGeometry(0.22, 18, 14)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  target.position.copy(TC);
  group.add(target);
  const ringGeoU = geo(new THREE.BufferGeometry());
  {
    const cp = new Float32Array(65 * 3);
    for (let j = 0; j <= 64; j++) { const a = (j / 64) * 2 * Math.PI; cp[j * 3] = 0; cp[j * 3 + 1] = Math.cos(a); cp[j * 3 + 2] = Math.sin(a); }
    ringGeoU.setAttribute('position', new THREE.BufferAttribute(cp, 3));
  }
  const rings: import('three').Line[] = [];
  for (const rr of [0.5, 0.9, 1.4]) {
    const l = new THREE.Line(ringGeoU, mat(new THREE.LineBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.3 })));
    l.position.set(TC.x, TC.y, 0);
    l.scale.setScalar(rr);
    group.add(l); rings.push(l);
  }

  // —— 探测器弧点 ——
  const NDET = 26;
  const detGeo = geo(new THREE.SphereGeometry(0.05, 8, 6));
  const dets: import('three').Mesh[] = [];
  for (let i = 0; i < NDET; i++) {
    const m = new THREE.Mesh(detGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.9 })));
    group.add(m); dets.push(m);
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
  group.add(makeLabel('α 粒子束 4→9 MeV', '#fbbf24', 3.2, new THREE.Vector3(-2.6, TC.y + 0.8, 0)));
  group.add(makeLabel('Au 靶 Z=79', '#f472b6', 1.9, new THREE.Vector3(TC.x - 0.4, TC.y - 0.65, 0)));
  group.add(makeLabel('前向尖峰 ∝ csc⁴(θ/2)', '#22d3ee', 3.3, new THREE.Vector3(2.9, TC.y + 1.7, 0)));

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

  let aFM = 0, etaV = 0, kV = 0, d90 = 0, sig90 = 0, reson = -1;
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
    ln(40, '#f8fafc', '卢瑟福 dσ/dΩ = a²csc⁴(θ/2)，a=Z₁Z₂e′²/4E', true);
    ln(78, '#22d3ee', `σ(θ>90°) = 4πa²·cot²45° = 4πa² = ${(4 * PIM * aFM * aFM / 100).toFixed(2)} b`);
    ln(112, '#a855f7', '分波：f=(2l+1)P_l·sinδ_l·e^{iδ}/k，δ=π/2 ⇒ 共振');
    ln(148, '#fbbf24', `读数：E=${E.toFixed(2)} MeV  a=${aFM.toFixed(2)}fm  k=${kV.toFixed(3)}fm⁻¹  η=${etaV.toFixed(1)}  dσ(90°)=${(d90 / 100).toFixed(2)} b/sr`, true, 23);
    ln(180, '#fbbf24', `δ₀=${(Math.atan2(GAM / 2, E - ERES[0]) * 57.2958).toFixed(0)}° δ₁=${(Math.atan2(GAM / 2, E - ERES[1]) * 57.2958).toFixed(0)}° δ₂=${(Math.atan2(GAM / 2, E - ERES[2]) * 57.2958).toFixed(0)}°  σ(>90°)=${(sig90 / 100).toFixed(2)} b`, false, 23);
    ln(212, reson >= 0 ? '#ef4444' : '#94a3b8', reson >= 0 ? `共振！l=${reson} 道 δ=90°，该分波幺正极限 4π(2l+1)/k²=${(4 * PIM * (2 * reson + 1) / (kV * kV) / 100).toFixed(2)} b` : '远离共振：库仑主导，前向针越尖锐 E↑ 越缩', false, 22);
    infoTex.needsUpdate = true;
  }

  function refreshScalars(): void {
    aFM = Z1 * Z2 * E2 / (4 * E);
    kV = Math.sqrt(2 * MU * E) / HBC;
    etaV = Z1 * Z2 * E2 * MU / (HBC * HBC * kV);
    d90 = dsig(PIM / 2);
    sig90 = 4 * PIM * aFM * aFM;                    // 纯库仑 σ(>90°)
    reson = -1;
    for (let l = 0; l < 3; l++) if (Math.abs(E - ERES[l]) < GAM / 2) reson = l;
  }

  function update(t: number, dt: number): void {
    E = 4 + 5 * (0.5 - 0.5 * Math.cos((t % 16) / 16 * 2 * Math.PI));
    refreshScalars();
    updatePetal();
    // 入射粒子
    for (let i = 0; i < 4; i++) {
      const u = ((t * 0.55 + i / 4) % 1);
      bullets[i].position.set(-4.6 + u * (4.6 + TC.x - 0.4), TC.y + (i % 2 ? 0.16 : -0.16) * (i < 2 ? 1 : 1), i < 2 ? 0.16 : -0.16);
      bullets[i].visible = u < 0.96;
    }
    // 探测器点：计数 ∝ (dσ)^{1/3}
    const rmax = Math.pow(dsig(TH_MIN), 0.35);
    for (let i = 0; i < NDET; i++) {
      const th = TH_MIN + (PIM - TH_MIN) * (i / (NDET - 1));
      const rad = 3.15;
      dets[i].position.set(TC.x + rad * Math.cos(th), TC.y + rad * Math.sin(th), 0);
      const s = Math.pow(dsig(th), 0.35) / rmax;
      dets[i].scale.setScalar(0.4 + 6 * s);
      (dets[i].material as import('three').MeshBasicMaterial).opacity = 0.15 + 0.85 * Math.min(1, s * 4);
    }
    for (const rg of rings) rg.rotation.x = 0.15 * Math.sin(t * 0.7);
    if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
  }

  refreshScalars();
  updatePetal();
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
