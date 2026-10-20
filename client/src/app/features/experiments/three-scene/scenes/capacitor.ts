import type { SceneContext, SceneInstance } from '../types';
/**
 * 平行板电容器（P94）：三维矢量场（板间均匀场 + 边缘鼓形 fringe）、介质板插入产生束缚电荷、能量随 U² 变化。
 * 电场不是画出来的装饰，而是对两块均匀带电圆盘做数值叠加：
 *   ① E(p) = Σ_元件 σ·dA/(4πε0)·(p−p')/|p−p'|³（+σ 盘与 −σ 盘各 280 个面元，向日葵分布保证等权）
 *      ⇒ 板间中心 |E| = 0.825·σ/ε0（有限板的真实结果；无限大理想板才是 σ/ε0），边缘外急剧衰减 ⇒ 鼓形漏场
 *   ② 理想电容 C0 = ε0S/d；由 ① 沿轴积分 U=∫E·dl 得 C_fringe = Q/U = +28.7% C0（边缘场使电容增大）
 *   ③ 介质板（厚度 x，串联插入，极板孤立 ⇒ Q 不变）：
 *      C(x) = 1/[(d−x)/(ε0S) + x/(ε0εrS)]，E_空 = σ/ε0 不变，E_介 = σ/(ε0εr) 减弱，
 *      表面束缚电荷 σ_pol = P·n̂ = σ(1−1/εr)（上界面负、下界面正：P 沿 E 向下）
 *   ④ U = Q/C，W = Q²/(2C) = ½CU² ⇒ 插入介质后 C↑、U↓、W↓（能量被电源/外力收走）
 * 扫描自变量：介质厚度 x（0→d，12 s）、极板电荷 Q（0.4→1.6 nC，16 s）。1 世界单位 = 20 mm。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  const EPS0 = 8.8541878128e-12, PI = Math.PI, TWO_PI = 2 * PI;
  // —— 真实尺寸（米）与归一化：1 世界单位 = 20 mm ——
  const U_PER_M = 50;                                   // 1 m = 50 世界单位（20 mm/单位）
  const A_P = 0.0564, D_P = 0.02, ER = 3.5;             // 极板半径 5.64 cm、间距 2 cm、介质 εr=3.5（玻璃/云母量级）
  const S_AREA = PI * A_P * A_P;
  const C0 = EPS0 * S_AREA / D_P;                        // 理想平行板电容
  const N_EL = 280;
  // 向日葵面元分布（等面积权重）
  const elR: number[] = [], elT: number[] = [];
  for (let i = 0; i < N_EL; i++) { elR.push(A_P * Math.sqrt((i + 0.5) / N_EL)); elT.push(i * 2.39996323); }
  const dA = S_AREA / N_EL;
  const YH = new THREE.Vector3(0, 1, 0);

  // ===== 星野 + 网格 =====
  const starGeo = geo(new THREE.BufferGeometry());
  {
    const q = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) { q[i * 3] = (Math.random() - 0.5) * 200; q[i * 3 + 1] = (Math.random() - 0.5) * 200; q[i * 3 + 2] = (Math.random() - 0.5) * 200; }
    starGeo.setAttribute('position', new THREE.BufferAttribute(q, 3));
  }
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  grid.position.y = -2.5;
  group.add(grid);

  // ===== 电场计算（真空、单位面元电荷 ⇒ 结果线性于 σ，运行时按 σ 缩放） =====
  function eUnit(px: number, py: number, pz: number): { x: number, y: number, z: number, m: number } {
    let ex = 0, ey = 0, ez = 0;
    for (const sgn of [1, -1]) {
      const sy = sgn * (D_P / 2);                       // +σ 在上板
      for (let i = 0; i < N_EL; i++) {
        const rx = elR[i] * Math.cos(elT[i]), rz = elR[i] * Math.sin(elT[i]);
        const dx = px - rx, dy = py - sy, dz = pz - rz;
        const r2 = dx * dx + dy * dy + dz * dz;
        const inv = (dA * sgn) / (4 * PI * EPS0 * Math.sqrt(r2) * r2);
        ex += dx * inv; ey += dy * inv; ez += dz * inv;
      }
    }
    return { x: ex, y: ey, z: ez, m: Math.hypot(ex, ey, ez) };
  }

  // ===== 极板 + 面电荷点阵 =====
  const plateGeo = geo(new THREE.CylinderGeometry(A_P * U_PER_M, A_P * U_PER_M, 0.06, 40));
  const plateMat = mat(new THREE.MeshStandardMaterial({ color: 0x9aa8b8, metalness: 0.85, roughness: 0.32, transparent: true, opacity: 0.55 }));
  for (const sgn of [1, -1]) {
    const p = new THREE.Mesh(plateGeo, plateMat);
    p.position.set(0, sgn * (D_P / 2) * U_PER_M, 0);
    group.add(p);
  }
  const dotGeo = geo(new THREE.SphereGeometry(0.055, 8, 8));
  const posDotMat = mat(new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.5 }));
  const negDotMat = mat(new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x3b82f6, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.5 }));
  const posDots: import('three').Mesh[] = [], negDots: import('three').Mesh[] = [];
  {
    const ND = 46;
    for (let i = 0; i < ND; i++) {
      const r = A_P * Math.sqrt((i + 0.5) / ND) * U_PER_M, th = i * 2.39996323;
      const x = r * Math.cos(th), z = r * Math.sin(th);
      const a = new THREE.Mesh(dotGeo, posDotMat); a.position.set(x, (D_P / 2) * U_PER_M + 0.045, z); group.add(a); posDots.push(a);
      const b = new THREE.Mesh(dotGeo, negDotMat); b.position.set(x, -(D_P / 2) * U_PER_M - 0.045, z); group.add(b); negDots.push(b);
    }
  }

  // ===== 介质板（厚度 x 沿 y 变化，从下往上填充间隙） =====
  const slabR = A_P * 0.98 * U_PER_M;                 // 半径略小于极板，避免与极板边缘打架
  const slabGeo = geo(new THREE.CylinderGeometry(slabR, slabR, 1, 40));
  const slabMat = mat(new THREE.MeshStandardMaterial({ color: 0xa855f7, metalness: 0.1, roughness: 0.6, transparent: true, opacity: 0.4 }));
  const slab = new THREE.Mesh(slabGeo, slabMat);
  group.add(slab);
  const polPosMat = mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.6 }));
  const polNegMat = mat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.6 }));
  const polDots: { m: import('three').Mesh, up: boolean }[] = [];
  {
    const NP2 = 26;
    for (let i = 0; i < NP2; i++) {
      const r = A_P * 0.92 * Math.sqrt((i + 0.5) / NP2) * U_PER_M, th = i * 2.39996323;
      const x = r * Math.cos(th), z = r * Math.sin(th);
      for (const up of [true, false]) {
        const m = new THREE.Mesh(dotGeo, up ? polNegMat : polPosMat);   // P 沿 E（−y）⇒ 上界面 −σ_pol、下界面 +σ_pol
        m.position.set(x, 0, z);
        group.add(m); polDots.push({ m, up });
      }
    }
  }

  // ===== 矢量场箭头（板间 + 边缘外侧，位置固定，长度/朝向由 E 决定） =====
  interface Arrow { mesh: import('three').Mesh; p: [number, number, number]; e0: { x: number, y: number, z: number, m: number }; }
  const arrowGeo = geo(new THREE.ConeGeometry(0.055, 0.4, 8));
  const arrowMat = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.9 }));
  const arrows: Arrow[] = [];
  {
    const rhoList = [0, 0.35, 0.7, 1.0, 1.25, 1.55];        // 以极板半径 a 为单位
    const nAng = rhoList.map((r) => (r === 0 ? 1 : 8));
    const yList = [-0.36, -0.12, 0.12, 0.36];
    for (let k = 0; k < rhoList.length; k++) {
      for (let j = 0; j < nAng[k]; j++) {
        const th = (j / nAng[k]) * TWO_PI;
        const rr = rhoList[k] * A_P;
        for (const yf of yList) {
          const px = rr * Math.cos(th), pz = rr * Math.sin(th), py = yf * D_P;
          const mesh = new THREE.Mesh(arrowGeo, arrowMat);
          mesh.position.set(px * U_PER_M, py * U_PER_M, pz * U_PER_M);
          group.add(mesh);
          arrows.push({ mesh, p: [px, py, pz], e0: eUnit(px, py, pz) });
        }
      }
    }
  }
  // 轴线 |E| 峰值（用于归一化箭头长度）
  const E_AXIS = eUnit(0, 0, 0).m;                     // σ=1 C/m² 时板间中心的 |E|（有限板 ⇒ 0.825·σ/ε0）
  const IDEAL = 1 / EPS0;                                    // σ=1 C/m² 时的理想板间场 σ/ε0

  // ===== 电场线（含边缘鼓形）：对 ① 的单位场做 RK 流线积分，一次算好 =====
  {
    const lineMat = mat(new THREE.LineBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.55 }));
    for (const r0a of [0.15, 0.55, 0.86, 1.02, 1.18]) {
      const pts: number[] = [];
      let px = r0a * A_P, py = D_P / 2 - 0.0006, pz = 0;
      const ds = D_P / 420;                              // 固定弧长步长（方向归一，边缘弱场不掉队）⇒ 20mm 间隙可跨越
      for (let i = 0; i < 620; i++) {
        const e1 = eUnit(px, py, pz);
        const m1 = Math.max(1e-12, e1.m);
        const e2 = eUnit(px + e1.x / m1 * ds / 2, py + e1.y / m1 * ds / 2, pz + e1.z / m1 * ds / 2);
        const m2 = Math.max(1e-12, e2.m);
        px += e2.x / m2 * ds; py += e2.y / m2 * ds; pz += e2.z / m2 * ds;
        if (py < -D_P / 2 + 0.0004 || Math.abs(px) > 2.2 * A_P || Math.abs(py) > 1.6 * D_P) break;
        pts.push(px * U_PER_M, py * U_PER_M, 0);
      }
      if (pts.length < 6) continue;
      const g = geo(new THREE.BufferGeometry());
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
      g.setDrawRange(0, pts.length / 3);
      group.add(new THREE.Line(g, lineMat));
    }
  }

  // ===== 标签 =====
  function label(text: string, color: string, x: number, y: number, z: number, w = 2.4): void {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 24px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(w, w / 8, 1); s.position.set(x, y, z); s.renderOrder = 997;
    group.add(s);
  }
  label('上板 +σ（孤立，Q 不变）', '#ef4444', -1.6, 1.85, 0, 2.3);
  label('下板 −σ', '#3b82f6', -1.6, -1.85, 0, 1.8);
  label('介质板 εr=3.5：厚度 x 扫描', '#a855f7', 2.6, 0.2, 0, 2.4);
  label('边缘鼓形电场线（数值流线）', '#f472b6', 2.4, -2.05, 0, 2.5);

  // ===== 面板 =====
  const CW = 900, CH = 300;
  const infoCv = document.createElement('canvas'); infoCv.width = CW; infoCv.height = CH;
  const ic = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const panel = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  panel.scale.set(8.8, (8.8 * CH) / CW, 1); panel.position.set(0, 4.5, 0); panel.renderOrder = 999;
  group.add(panel);
  const est = (s2: string, px: number): number => { let e = 0; for (const ch of s2) e += ch.charCodeAt(0) > 0x2e7f ? px : px * 0.56; return e; };
  const put = (y: number, color: string, text: string, size = 24, bold = false): void => {
    let s = size;
    while (est(text, s) > CW - 44 && s > 11) s -= 1;
    ic.fillStyle = color; ic.font = `${bold ? 'bold ' : ''}${s}px "PingFang SC", sans-serif`;
    ic.fillText(text, 20, y);
  };
  let Q = 1e-9, sig = 0, xSlab = 0, cX = C0, uCap = 0, wE = 0, eAir = 0, eDiel = 0, sPol = 0, eCenter = 0;
  // 轴向积分求 fringe 电容（与箭头同一 eUnit，保证同源）
  // 轴向 U=∫E·dl（σ=1 C/m²）：有限圆盘 ⇒ 轴线平均场 < σ/ε0 ⇒ U 比理想值小 ⇒ 同 Q 下 C_fringe 比 ε0S/d 大
  const V_UNIT: number = (() => {
    let v = 0; const n = 240, h = D_P / n;
    for (let i = 0; i < n; i++) { const y = -D_P / 2 + (i + 0.5) * h; v += -eUnit(0, y, 0).y * h; }
    return v;
  })();
  const C_FRINGE = S_AREA / V_UNIT;
  const V_IDEAL = D_P / EPS0;
  function drawInfo(): void {
    ic.clearRect(0, 0, CW, CH);
    ic.fillStyle = 'rgba(7,11,20,0.86)'; ic.fillRect(2, 2, CW - 4, CH - 4);
    ic.strokeStyle = '#334155'; ic.lineWidth = 3; ic.strokeRect(2, 2, CW - 4, CH - 4);
    ic.textAlign = 'left';
    put(30, '#f8fafc', 'C=ε0S/d ＋边缘修正；W=½CU²=Q²/2C', 25, true);
    put(58, '#22d3ee', `几何：a=${(A_P * 1000).toFixed(1)} mm  d=${(D_P * 1000).toFixed(0)} mm  S=${(S_AREA * 1e4).toFixed(2)} cm²  a/d=${(A_P / D_P).toFixed(2)} ⇒ C0=${(C0 * 1e12).toFixed(2)} pF`);
    put(85, '#a855f7', `两圆盘 2×280 面元数值叠加：中心 |E|=${(E_AXIS / IDEAL).toFixed(3)}·σ/ε0（有限板真实值，非理想 1.000）=${(eCenter / 1e4).toFixed(3)}×10⁴ V/m`);
    put(112, '#22c55e', `串联介质：C(x)=1/[(d−x)/ε0S + x/(ε0εrS)]，E_空=σ/ε0=${(eAir / 1e4).toFixed(3)}×10⁴ V/m 不变，E_介=E_空/εr=${(eDiel / 1e4).toFixed(3)}×10⁴ V/m`);
    put(139, '#f472b6', `束缚电荷：σ_pol=P·n̂=σ(1−1/εr)=${(sPol * 1e9).toFixed(1)} nC/m²（上界面负、下界面正 ⇒ 部分抵消自由电荷的场）`);
    put(166, '#22d3ee', `边缘（鼓形）修正：轴向 ∫E·dl=${(V_UNIT / 1e9).toFixed(4)}×10⁹ V(σ=1) < 理想 ${(V_IDEAL / 1e9).toFixed(4)}×10⁹ ⇒ C_fringe=${(C_FRINGE * 1e12).toFixed(2)} pF=${(C_FRINGE / C0).toFixed(3)}·C0`);
    put(193, '#94a3b8', `x=${(xSlab * 1000).toFixed(1)} mm（0→${(D_P * 1000).toFixed(0)} mm，12 s 一巡）：C↑ ⇒ 孤立极板 U↓ ⇒ 储能↓（介质被吸入板间，外力做负功）`);
    put(227, '#fbbf24', `读数(理想 ε0S/d 网络)：Q=${(Q * 1e9).toFixed(2)} nC  σ=${(sig * 1e9).toFixed(2)} nC/m²  C=${(cX * 1e12).toFixed(2)} pF  U=${uCap.toFixed(1)} V`, 23, true);
    put(256, '#fbbf24', `读数：W=Q²/2C=${(wE * 1e9).toFixed(1)} nJ  ½CU²=${(0.5 * cX * uCap * uCap * 1e9).toFixed(1)} nJ（两式必须相等）`, 23, true);
    put(284, '#94a3b8', `读数：u=½εE² 空气 ${(0.5 * EPS0 * eAir * eAir * 1e6).toFixed(2)} μJ/m³，介质 ${(0.5 * EPS0 * ER * eDiel * eDiel * 1e6).toFixed(2)} μJ/m³=1/${ER.toFixed(1)} ⇒ Q 不变时介质内变少（总储能降 ⇒ 介质被吸入）`, 22);
    infoTex.needsUpdate = true;
  }
  sig = Q / S_AREA;

  return {
    update(t, dt) {
      // 自变量：介质厚度 x（12 s）、极板电荷 Q（16 s）
      xSlab = D_P * (0.5 - 0.5 * Math.cos((t % 12) / 12 * TWO_PI));
      Q = 1.0e-9 * (1 + 0.6 * Math.cos((t % 16) / 16 * TWO_PI));
      sig = Q / S_AREA;
      cX = 1 / ((D_P - xSlab) / (EPS0 * S_AREA) + xSlab / (EPS0 * ER * S_AREA));
      uCap = Q / cX;
      wE = (Q * Q) / (2 * cX);
      eAir = sig / EPS0;
      eDiel = eAir / ER;
      sPol = sig * (1 - 1 / ER);
      eCenter = E_AXIS * sig;

      // 介质板：厚度沿 y、面积略小于极板；束缚电荷面随 x 出现在两个界面上
      slab.scale.set(1, Math.max(0.002, xSlab * U_PER_M), 1);   // 直径固定，只把高度拉成厚度 x
      slabMat.opacity = xSlab > 1e-4 ? 0.42 : 0.0;
      const yFace = (xSlab / 2) * U_PER_M;
      for (const d of polDots) {
        d.m.position.y = d.up ? yFace + 0.03 : -yFace - 0.03;
        d.m.visible = xSlab > 2e-3;
        d.m.scale.setScalar(0.5 + 0.9 * (sPol / (sig * 0.8)) * Math.min(1, xSlab / 0.004));
      }
      // 自由电荷点：尺寸/亮度 ∝ σ
      const dotSc = 0.4 + 1.3 * (sig / (1.6e-9 / S_AREA));
      for (const d of posDots) d.scale.setScalar(dotSc);
      for (const d of negDots) d.scale.setScalar(dotSc);
      posDotMat.emissiveIntensity = 0.2 + 0.9 * (sig / 1e-7);
      negDotMat.emissiveIntensity = 0.2 + 0.9 * (sig / 1e-7);

      // 矢量箭头：E = 单位场 × σ；落在介质内的按 1/εr 削弱；朝向沿 E（边缘自动倾斜 ⇒ 鼓形）
      for (const a of arrows) {
        const inside = Math.abs(a.p[1]) < xSlab / 2;
        const kf = inside ? 1 / ER : 1;
        const ex = a.e0.x * sig * kf, ey = a.e0.y * sig * kf, ez = a.e0.z * sig * kf;
        const m = Math.hypot(ex, ey, ez);
        const L = Math.max(0.001, Math.min(1.6, m / (IDEAL * sig) * 0.9));
        a.mesh.scale.set(0.55 + 0.5 * L, L, 0.55 + 0.5 * L);
        a.mesh.quaternion.setFromUnitVectors(YH, new THREE.Vector3(ex, ey, ez).normalize());
      }
      arrowMat.opacity = 0.25 + 0.7 * Math.min(1, sig / 1e-7);

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
