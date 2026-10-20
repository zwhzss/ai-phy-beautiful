import type { SceneContext, SceneInstance } from '../types';
/** 度规与克里斯托费尔符号（P573）：Γᵘ_{αβ} = ½g^{μσ}(∂_α g_{βσ}+∂_β g_{ασ}−∂_σ g_{αβ})。
 *  画面主角是"基矢随坐标格逐格转动"：拉伸旋转面 ρ=sinθ, z=h·cosθ（h 扫描 0.5→1.7，16s 周期）的第一基本形式
 *  g_θθ=E=h相关、g_φφ=G=sin²θ，由度量函数经中心差分**数值求解** Γ（面板同时给出闭式解交叉验证）。
 *  每个格点画局部标架箭头 e_θ、e_φ：|e_φ|=√G 随 θ 收缩、方向沿 φ 逐格偏转——这正是 ∂_β e_α=Γᵘ_{αβ}e_μ+K_αβ n̂。
 *  探测点处把"下一格基矢平移到本格"的差向量投影到切平面，红箭头即换帧修正率 Γⁱ_{φφ}eᵢdφ；
 *  三层球壳热图堆叠显示三个独立分量的空间分布。与协变导数场景（平行输运和乐角）互补：此处只谈"帧本身怎么变"。 */
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

  const TWO_PI = Math.PI * 2;
  const SC = 2.35;                    // 世界尺度：曲面半径系数
  let H = 1;                          // 极轴拉伸比 b/a（扫描变量）

  // —— 度量（第一基本形式，坐标 x¹=θ, x²=φ）——
  const gm = (th: number): [[number, number], [number, number]] => {
    const s = Math.sin(th), c = Math.cos(th);
    return [[c * c + H * H * s * s, 0], [0, s * s]];
  };
  // Γᵘ_{αβ} 由中心差分从度量真正算出（与场景几何同源）；g 与 φ 无关 → ∂_φ g = 0
  const FD = 1e-4;
  const dg = (a: number, b: number, s: number, th: number): number =>
    (a === 1 ? 0 : (gm(th + FD)[b][s] - gm(th - FD)[b][s]) / (2 * FD));
  function christoffel(th: number): number[][][] {
    const g = gm(th);
    const det = g[0][0] * g[1][1] - g[0][1] * g[1][0];
    const gi = [[g[1][1] / det, -g[0][1] / det], [-g[1][0] / det, g[0][0] / det]];
    const G = [[[0, 0], [0, 0]], [[0, 0], [0, 0]]];
    for (let mu = 0; mu < 2; mu++) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
      let acc = 0;
      for (let s = 0; s < 2; s++) acc += gi[mu][s] * (dg(a, b, s, th) + dg(b, a, s, th) - dg(s, a, b, th));
      G[mu][a][b] = 0.5 * acc;
    }
    return G;
  }
  // 闭式解（面板交叉验证用）
  const ana = (th: number): [number, number, number] => {
    const s = Math.sin(th), c = Math.cos(th), E = c * c + H * H * s * s;
    return [(H * H - 1) * s * c / E, -s * c / E, c / s];  // Γ^θ_θθ, Γ^θ_φφ, Γ^φ_θφ
  };

  // —— 拉伸曲面 + 坐标网格 ——
  const TN = 44, PN = 48;
  const surfGeo = geo(new THREE.BufferGeometry());
  const surfPos = new Float32Array((TN + 1) * (PN + 1) * 3);
  surfGeo.setAttribute('position', new THREE.BufferAttribute(surfPos, 3));
  {
    const idx: number[] = [];
    for (let i = 0; i < TN; i++) for (let j = 0; j < PN; j++) {
      const a = i * (PN + 1) + j, b = a + 1, c = a + PN + 1, e = c + 1;
      idx.push(a, b, c, b, e, c);
    }
    surfGeo.setIndex(idx);
  }
  const surfSolid = new THREE.Mesh(surfGeo, mat(new THREE.MeshBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.24, side: THREE.DoubleSide })));
  const surfWire = new THREE.Mesh(surfGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.16, side: THREE.DoubleSide })));
  group.add(surfSolid, surfWire);

  const pAt = (th: number, ph: number, out: { x: number; y: number; z: number }): void => {
    const s = Math.sin(th), c = Math.cos(th);
    out.x = SC * s * Math.cos(ph); out.y = SC * H * c; out.z = SC * s * Math.sin(ph);
  };
  const pt3 = { x: 0, y: 0, z: 0 };
  function updateSurface(): void {
    let v = 0;
    for (let i = 0; i <= TN; i++) {
      const th = 0.05 + (Math.PI - 0.1) * (i / TN);
      for (let j = 0; j <= PN; j++) {
        const ph = (j / PN) * TWO_PI;
        pAt(th, ph, pt3);
        surfPos[v * 3] = pt3.x; surfPos[v * 3 + 1] = pt3.y; surfPos[v * 3 + 2] = pt3.z;
        v++;
      }
    }
    surfGeo.attributes['position'].needsUpdate = true;
  }

  // —— 格点基矢箭头场：e_θ（青）与 e_φ（紫，长度 ∝ √G=sinθ）——
  const BT = 7, BP = 12;
  const eThGeo = geo(new THREE.BufferGeometry());
  const eThPos = new Float32Array(BT * BP * 6);
  eThGeo.setAttribute('position', new THREE.BufferAttribute(eThPos, 3));
  const ePhGeo = geo(new THREE.BufferGeometry());
  const ePhPos = new Float32Array(BT * BP * 6);
  ePhGeo.setAttribute('position', new THREE.BufferAttribute(ePhPos, 3));
  group.add(
    new THREE.LineSegments(eThGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85 }))),
    new THREE.LineSegments(ePhGeo, mat(new THREE.LineBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.85 }))),
  );
  const coneTh = new THREE.InstancedMesh(geo(new THREE.ConeGeometry(0.05, 0.14, 8)), mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee })), BT * BP);
  const conePh = new THREE.InstancedMesh(geo(new THREE.ConeGeometry(0.05, 0.14, 8)), mat(new THREE.MeshBasicMaterial({ color: 0xa855f7 })), BT * BP);
  group.add(coneTh, conePh);
  const dummy = new THREE.Object3D();
  const UPV = new THREE.Vector3(0, 1, 0);
  function updateBasisArrows(): void {
    let k = 0;
    for (let i = 0; i < BT; i++) {
      const th = 0.35 + (Math.PI - 0.7) * (i / (BT - 1));
      for (let j = 0; j < BP; j++) {
        const ph = (j / BP) * TWO_PI;
        pAt(th, ph, pt3);
        const bpx = pt3.x, bpy = pt3.y, bpz = pt3.z;
        // 切向基矢（来自嵌入导数）：∂θ p 与 ∂φ p
        const eps = 1e-3;
        pAt(th + eps, ph, pt3); const tX = (pt3.x - bpx) / eps, tY = (pt3.y - bpy) / eps, tZ = (pt3.z - bpz) / eps;
        pAt(th, ph + eps, pt3); const uX = (pt3.x - bpx) / eps, uY = (pt3.y - bpy) / eps, uZ = (pt3.z - bpz) / eps;
        const tl = Math.hypot(tX, tY, tZ), ul = Math.hypot(uX, uY, uZ);
        const lenT = 0.34, lenP = 0.44 * Math.min(1, ul / SC);   // |e_φ|=√G=sinθ → 箭头逐格收缩
        eThPos[k * 6] = bpx; eThPos[k * 6 + 1] = bpy; eThPos[k * 6 + 2] = bpz;
        eThPos[k * 6 + 3] = bpx + (tX / tl) * lenT; eThPos[k * 6 + 4] = bpy + (tY / tl) * lenT; eThPos[k * 6 + 5] = bpz + (tZ / tl) * lenT;
        const t1 = new THREE.Vector3(bpx + (tX / tl) * lenT, bpy + (tY / tl) * lenT, bpz + (tZ / tl) * lenT);
        dummy.position.copy(t1); dummy.quaternion.setFromUnitVectors(UPV, new THREE.Vector3(tX / tl, tY / tl, tZ / tl)); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        coneTh.setMatrixAt(k, dummy.matrix);
        ePhPos[k * 6] = bpx; ePhPos[k * 6 + 1] = bpy; ePhPos[k * 6 + 2] = bpz;
        ePhPos[k * 6 + 3] = bpx + (uX / ul) * lenP; ePhPos[k * 6 + 4] = bpy + (uY / ul) * lenP; ePhPos[k * 6 + 5] = bpz + (uZ / ul) * lenP;
        const t2 = new THREE.Vector3(bpx + (uX / ul) * lenP, bpy + (uY / ul) * lenP, bpz + (uZ / ul) * lenP);
        dummy.position.copy(t2); dummy.quaternion.setFromUnitVectors(UPV, new THREE.Vector3(uX / ul, uY / ul, uZ / ul)); dummy.updateMatrix();
        conePh.setMatrixAt(k, dummy.matrix);
        k++;
      }
    }
    eThGeo.attributes['position'].needsUpdate = true;
    ePhGeo.attributes['position'].needsUpdate = true;
    coneTh.instanceMatrix.needsUpdate = true;
    conePh.instanceMatrix.needsUpdate = true;
  }

  // —— Γ 分量三层热图堆叠（球壳，顶点色 = 分量值）——
  const HN = 30, HP = 40;
  const compIdx = [0, 1, 2];         // Γ^θ_θθ, Γ^θ_φφ, Γ^φ_θφ
  const compScale = [1.2, 0.55, 4];  // 各分量典型幅值 → 色标归一
  const sheets: { m: import('three').Mesh; pos: Float32Array; col: Float32Array }[] = [];
  for (let sIdx = 0; sIdx < 3; sIdx++) {
    const g = geo(new THREE.BufferGeometry());
    const pos = new Float32Array((HN + 1) * (HP + 1) * 3);
    const col = new Float32Array((HN + 1) * (HP + 1) * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const idx: number[] = [];
    for (let i = 0; i < HN; i++) for (let j = 0; j < HP; j++) {
      const a = i * (HP + 1) + j, b = a + 1, c = a + HP + 1, e = c + 1;
      idx.push(a, b, c, b, e, c);
    }
    g.setIndex(idx);
    const m = new THREE.Mesh(g, mat(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.62, side: THREE.DoubleSide })));
    const rad = 3.35 + sIdx * 0.62;
    for (let i = 0; i <= HN; i++) {
      const th = 0.25 + (Math.PI - 0.5) * (i / HN);
      for (let j = 0; j <= HP; j++) {
        const ph = (j / HP) * TWO_PI, v = i * (HP + 1) + j;
        pos[v * 3] = rad * Math.sin(th) * Math.cos(ph);
        pos[v * 3 + 1] = rad * Math.cos(th);
        pos[v * 3 + 2] = rad * Math.sin(th) * Math.sin(ph);
      }
    }
    group.add(m);
    sheets.push({ m, pos, col });
  }
  function heatColor(v: number, out: Float32Array, o: number): void {
    const t = Math.max(-1, Math.min(1, v));
    if (t >= 0) { out[o] = 0.35 + 0.65 * t; out[o + 1] = 0.25; out[o + 2] = 0.25 + 0.1 * t; }
    else { out[o] = 0.2; out[o + 1] = 0.3 + 0.55 * (-t); out[o + 2] = 0.85; }
  }
  function updateHeatmaps(): void {
    for (let sIdx = 0; sIdx < 3; sIdx++) {
      const comp = compIdx[sIdx], sc = compScale[sIdx];
      const sh = sheets[sIdx];
      for (let i = 0; i <= HN; i++) {
        const th = 0.25 + (Math.PI - 0.5) * (i / HN);
        const G = christoffel(th);
        const val = comp === 0 ? G[0][0][0] : comp === 1 ? G[0][1][1] : G[1][0][1];
        for (let j = 0; j <= HP; j++) heatColor(val / sc, sh.col, (i * (HP + 1) + j) * 3);
      }
      sh.m.geometry.attributes['color']!.needsUpdate = true;
    }
  }
  function makeLabel(text: string, colorHex: string, scale = 3.2): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = colorHex; c.font = 'bold 30px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  const sheetLabels: [string, string, number][] = [
    ['Γ^θ_θθ 层', '#22c55e', 3.35], ['Γ^θ_φφ 层', '#fbbf24', 3.97], ['Γ^φ_θφ 层', '#f472b6', 4.59],
  ];
  sheetLabels.forEach(([txt, col, rad]) => {
    const lb = makeLabel(txt, col);
    lb.position.set(rad * 0.72, rad * 0.72, 0);
    group.add(lb);
  });

  // —— 探测点与"换帧修正"矢量 ——
  const probe = new THREE.Mesh(geo(new THREE.SphereGeometry(0.08, 12, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  group.add(probe);
  function mkDynLine(color: number, dashed: boolean, width = 1): { g: import('three').BufferGeometry; m: import('three').LineDashedMaterial | import('three').LineBasicMaterial; ln: import('three').Line } {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    g.setDrawRange(0, 2);
    const m = dashed
      ? mat(new THREE.LineDashedMaterial({ color, dashSize: 0.09, gapSize: 0.06, transparent: true, opacity: 0.9 }))
      : mat(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }));
    const ln = new THREE.Line(g, m); ln.scale.setScalar(width); group.add(ln);
    return { g, m, ln };
  }
  const dGray = mkDynLine(0x94a3b8, true);   // 平移过来的下一格 e_φ（不修正）
  const dRed = mkDynLine(0xef4444, false);   // 切向差 = Γⁱ_φφ eᵢ dφ
  function setLine(l: { g: import('three').BufferGeometry; m: import('three').LineDashedMaterial | import('three').LineBasicMaterial; ln: import('three').Line }, a: number[], b: number[]): void {
    const arr = l.g.attributes['position'].array as Float32Array;
    arr[0] = a[0]; arr[1] = a[1]; arr[2] = a[2];
    arr[3] = b[0]; arr[4] = b[1]; arr[5] = b[2];
    l.g.attributes['position'].needsUpdate = true;
    if (l.m instanceof THREE.LineDashedMaterial) l.ln.computeLineDistances();
  }

  // —— 面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 840; infoCv.height = 300;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.2, 3.3)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 6.1, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  const TH_PROBE = 1.05;
  let fdErr = 0, gTTH = 0, gTPH = 0, gPH = 0, corrLen = 0, corrExp = 0;
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 840, 300);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 832, 292);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 832, 292);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText('Γᵘ_{αβ} = ½ g^{μσ}(∂_α g_βσ + ∂_β g_ασ − ∂_σ g_αβ)　联络=换帧修正率', 22, 40);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '24px "PingFang SC", sans-serif';
    infoCtx.fillText('∂_β e_α = Γᵘ_{αβ} e_μ + K_αβ n̂（高斯公式）：Γ 是基矢转动的切向投影', 22, 78);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText(`h=1 球面检验：Γ^θ_φφ=−sinθcosθ；差分误差 ${fdErr.toExponential(1)}；Γ^φ_θφ=cotθ 与拉伸无关`, 22, 112);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：h=b/a=${H.toFixed(2)}  θ=${(TH_PROBE * 57.2958).toFixed(0)}°  Γ^θ_θθ=${gTTH.toFixed(3)}  Γ^θ_φφ=${gTPH.toFixed(3)}  Γ^φ_θφ=${gPH.toFixed(3)}`, 22, 150);
    infoCtx.fillText(`|de_φ/dφ|切向=${corrLen.toFixed(3)}  对照 √E·|Γ^θ_φφ|/√G=${corrExp.toFixed(3)}（红箭头=换帧修正）`, 22, 184);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('紫箭头长度 ∝ √g_φφ=sinθ 逐格收缩；沿 φ 走一格的基矢转动量即三层热图分量', 22, 224);
    infoCtx.fillText('灰虚线=不修正直接平移下一格基矢；其与本格紫箭头之差投影到切平面即红箭头', 22, 256);
    infoTex.needsUpdate = true;
  }

  updateSurface(); updateBasisArrows(); updateHeatmaps();
  const G0 = christoffel(TH_PROBE);
  const A0 = ana(TH_PROBE);
  fdErr = Math.abs(G0[0][1][1] - A0[1]);
  gTTH = G0[0][0][0]; gTPH = G0[0][1][1]; gPH = G0[1][0][1];
  drawInfo();

  const pa = { x: 0, y: 0, z: 0 }, pb = { x: 0, y: 0, z: 0 };
  return {
    update(t, _dt) {
      // 扫描极轴拉伸比 h：0.5 → 1.7，16s 周期（度量与所有 Γ 随之重算）
      H = 0.5 + 1.2 * (0.5 - 0.5 * Math.cos(TWO_PI * ((t % 16) / 16)));
      updateSurface();
      updateBasisArrows();
      updateHeatmaps();

      const ph = ((t % 9) / 9) * TWO_PI;
      const DPH = 0.16;
      pAt(TH_PROBE, ph, pa);
      probe.position.set(pa.x, pa.y, pa.z);
      // 下一格的单位 e_φ
      const eps = 1e-3;
      pAt(TH_PROBE, ph + eps, pb);
      const nx = (pb.x - pa.x) / eps, ny = (pb.y - pa.y) / eps, nz = (pb.z - pa.z) / eps;
      const nl = Math.hypot(nx, ny, nz);
      pAt(TH_PROBE, ph + DPH, pb);
      const qx = (pb.x - pa.x) / eps, qy = (pb.y - pa.y) / eps, qz = (pb.z - pa.z) / eps;
      // 该处单位 e_φ（数值上 = 方向 / |∂φ p|）
      const ql = Math.hypot(qx, qy, qz);
      const ex = qx / ql, ey = qy / ql, ez = qz / ql;
      // 平移到探测点：灰色 = 未修正的原样箭头；红 = 切向差 e_next − e_cur（投影到切平面）
      const len = 0.9;
      setLine(dGray, [pa.x, pa.y, pa.z], [pa.x + ex * len, pa.y + ey * len, pa.z + ez * len]);
      // 切平面法向（近似 = 径向修正后归一化）
      const nrm = new THREE.Vector3(pa.x / (SC * SC), pa.y / (SC * SC * H * H), pa.z / (SC * SC)).normalize();
      let dx = (ex - nx / nl), dy = (ey - ny / nl), dz = (ez - nz / nl);
      const dn = dx * nrm.x + dy * nrm.y + dz * nrm.z;
      dx -= dn * nrm.x; dy -= dn * nrm.y; dz -= dn * nrm.z;
      const scale = 0.5 / DPH;   // 红箭头长 = |de_φ/dφ|切向 × 0.5（与 corrLen 同源）
      setLine(dRed, [pa.x, pa.y, pa.z], [pa.x + dx * scale, pa.y + dy * scale, pa.z + dz * scale]);
      corrLen = Math.hypot(dx, dy, dz) / DPH;

      const G = christoffel(TH_PROBE);
      const Aa = ana(TH_PROBE);
      fdErr = Math.abs(G[0][1][1] - Aa[1]);
      gTTH = G[0][0][0]; gTPH = G[0][1][1]; gPH = G[1][0][1];
      const Egm = Math.cos(TH_PROBE) ** 2 + H * H * Math.sin(TH_PROBE) ** 2;
      corrExp = Math.sqrt(Egm) * Math.abs(G[0][1][1]) / Math.sin(TH_PROBE);
      if (Math.floor(t * 5) !== Math.floor((t - _dt) * 5)) drawInfo();
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
