import type { SceneContext, SceneInstance } from '../types';
/**
 * 反射望远镜（P262）：凹面主镜+双曲面副镜的卡塞格林折返光路，并排画牛顿式焦点布局。
 * 主控方程：抛物面 y = r²/(4f) 使平行光严格会聚于焦点（反射无色差，1/s + 1/s' = 2/R 与波长无关）；
 * 副镜取以主焦点 F1 与卡焦 F2 为两焦点的双曲线支 |PF2|−|PF1| = 2a，
 * 按反射定律（切线为两焦点夹角的外角平分线）折回的光必过 F2；放大率 m = b2/b1，f_eff = m·f_p，集光力 ∝ D²。
 * 牛顿式：平面斜副镜 45°（过 (NX,0,0)，法向 (−1,1,0)/√2）把会聚锥折向筒侧——
 * 筒侧焦点 = 主焦点 F1 关于该平面的镜像 (NX, f_p−NX, 0)，光路仍由抛物面公式严格驱动。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  // 星野 + 栅格
  const starGeo = geo(new THREE.BufferGeometry());
  const starPos = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 400;
    starPos[i * 3 + 1] = Math.random() * 200 - 8;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 400;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // —— 光机参数（世界单位 = 米）——
  const FP = 4.5;                 // 主镜焦距 f_p，抛物面 x = r²/(4 f_p)
  const RP = 0.75;                // 主镜口径半径（D = 1.5 m，f/3）
  const F2X = -1.0;               // 卡塞格林焦点（主镜后方，穿中心孔）
  const HV = 3.63;                // 副镜顶点：2a 由顶点处 |F2H|−|F1H| 算出
  const A2 = 2 * HV - FP - F2X;   // = |PF2|−|PF1| 常量（顶点处，= 4.63−0.87 = 3.76）
  const SEC_R = 0.36;             // 副镜外缘半径
  const HOLE_R = 0.11;            // 主镜中心孔
  // —— 牛顿式焦点布局：平面斜副镜 45°，折向筒侧 ——
  const NX = 4.05;                // 斜副镜平面过 (NX,0,0)，方程 y = x − NX（45°）
  const SIDE_Y = FP - NX;         // 筒侧焦点 S=(NX, f_p−NX, 0)：F1 关于平面的镜像

  // —— 主镜：抛物面旋转体（Lathe 绕自身 Y，再旋到光学轴 X）——
  const priPts: import('three').Vector2[] = [];
  for (let i = 0; i <= 28; i++) {
    const r = HOLE_R + (RP - HOLE_R) * (i / 28);
    priPts.push(new THREE.Vector2(r, (r * r) / (4 * FP)));
  }
  const priMesh = new THREE.Mesh(geo(new THREE.LatheGeometry(priPts, 40)), mat(new THREE.MeshStandardMaterial({
    color: 0x9fb8c8, metalness: 0.9, roughness: 0.25, side: THREE.DoubleSide,
  })));
  priMesh.rotation.z = -Math.PI / 2; // 旋转轴 Y → X，开口朝入射光 +x
  group.add(priMesh);
  // 镜筒（前后环）
  for (const rx of [0.35, 4.1]) {
    const ring = new THREE.Mesh(
      geo(new THREE.TorusGeometry(rx > 2 ? SEC_R + 0.05 : RP + 0.04, 0.025, 8, 40)),
      mat(new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.5 })),
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.x = rx;
    group.add(ring);
  }
  // 副镜支撑叉片
  {
    const forkGeo = geo(new THREE.BoxGeometry(0.8, 0.03, 0.06));
    const forkMat = mat(new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6, roughness: 0.4 }));
    for (const s of [1, -1]) {
      const f = new THREE.Mesh(forkGeo, forkMat);
      f.position.set(HV - 0.28, s * (SEC_R + 0.12) * 0.62, 0);
      f.rotation.z = s * 0.55;
      group.add(f);
    }
  }

  // —— 副镜：双曲线支 PF2 − PF1 = A2，数值求 x(ρ) ——
  function hyperX(rho: number): number {
    const t = rho * rho;
    const g = (x: number) => Math.hypot(x - F2X, rho) - Math.hypot(x - FP, rho) - A2;
    let lo = HV - 0.2, hi = FP - 0.06;
    for (let i = 0; i < 48; i++) {
      const m0 = (lo + hi) / 2;
      if (g(m0) > 0) hi = m0; else lo = m0;
    }
    return (lo + hi) / 2;
  }
  const secPts: import('three').Vector2[] = [];
  for (let i = 0; i <= 20; i++) {
    const r = 0.02 + (SEC_R - 0.02) * (i / 20);
    secPts.push(new THREE.Vector2(r, hyperX(r)));
  }
  const secMesh = new THREE.Mesh(geo(new THREE.LatheGeometry(secPts, 36)), mat(new THREE.MeshStandardMaterial({
    color: 0xc8d6e5, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide,
  })));
  secMesh.rotation.z = -Math.PI / 2;
  group.add(secMesh);

  // 焦点标记
  const sphGeo = geo(new THREE.SphereGeometry(0.06, 10, 10));
  const f1Mark = new THREE.Mesh(sphGeo, mat(new THREE.MeshBasicMaterial({ color: 0x94a3b8 })));
  f1Mark.position.set(FP, 0, 0);
  group.add(f1Mark);
  const f2Mark = new THREE.Mesh(geo(new THREE.SphereGeometry(0.09, 12, 12)), mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 1.2 })));
  f2Mark.position.set(F2X, 0, 0);
  group.add(f2Mark);

  // —— 牛顿式：平面斜副镜 + 筒侧目镜 ——
  {
    const diag = new THREE.Mesh(
      geo(new THREE.PlaneGeometry(0.62, 0.5)),
      mat(new THREE.MeshStandardMaterial({ color: 0xdfe9f3, metalness: 0.9, roughness: 0.15, side: THREE.DoubleSide })),
    );
    diag.position.set(NX + SIDE_Y * 0.5, SIDE_Y * 0.5, 0); // 平面 y=x−NX 上取中心
    diag.lookAt(diag.position.x - 1, diag.position.y + 1, 0); // 法向 (−1,1,0)/√2 ⇒ 45°
    group.add(diag);
    const spy = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.075, 0.075, 0.34, 14)), mat(new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.4 })));
    spy.position.set(NX, SIDE_Y + 0.26, 0);
    group.add(spy);
  }
  const sideMark = new THREE.Mesh(sphGeo, mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })));
  sideMark.position.set(NX, SIDE_Y, 0);
  group.add(sideMark);

  // —— 光线：三色平行光（红/绿/紫）同落一焦 ⇒ 无色差 ——
  const RAY_COLORS = [0xef4444, 0x22c55e, 0x8b5cf6];
  const RAYS_PER = 3;             // 每色 3 条（不同孔径带），共 9 条
  const rayLines: import('three').Line[] = [];
  const rayGeoList: import('three').BufferGeometry[] = [];
  const rayPosList: Float32Array[] = [];
  for (let k = 0; k < RAY_COLORS.length * RAYS_PER; k++) {
    const g = geo(new THREE.BufferGeometry());
    const p = new Float32Array(15 * 3); // 5 点：∞→主镜→副镜→卡焦→焦后展束
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const l = new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color: RAY_COLORS[Math.floor(k / RAYS_PER) % 3], transparent: true, opacity: 0.9 })));
    group.add(l);
    rayLines.push(l);
    rayGeoList.push(g);
    rayPosList.push(p);
  }
  // 牛顿式光线：金色 3 条（同一孔径带），5 点：∞→主镜→斜副→筒侧焦点→焦后展束
  const newtGeoList: import('three').BufferGeometry[] = [];
  const newtPosList: Float32Array[] = [];
  for (let band = 0; band < RAYS_PER; band++) {
    const g = geo(new THREE.BufferGeometry());
    const p = new Float32Array(5 * 3);
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    group.add(new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.85 }))));
    newtGeoList.push(g);
    newtPosList.push(p);
  }
  // 副镜交点：沿 P→F1 线段对 h(x)=|PF2|−|PF1|−A2 二分
  function hitSecondary(xh: number, r: number): { x: number; y: number } | null {
    const dist = (x: number, y: number) => Math.hypot(x - F2X, y) - Math.hypot(x - FP, y) - A2;
    let t0 = 0, t1 = 1;
    if (dist(xh, r) > 0 || dist(FP, 0) < 0) return null;
    for (let i = 0; i < 40; i++) {
      const tm = (t0 + t1) / 2;
      const x = xh + (FP - xh) * tm, y = r * (1 - tm);
      if (dist(x, y) > 0) t1 = tm; else t0 = tm;
    }
    const tm = (t0 + t1) / 2;
    return { x: xh + (FP - xh) * tm, y: r * (1 - tm) };
  }

  // —— 标签与面板 ——
  function makeLabel(text: string, color: string, scale = 3.6): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 28px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(scale, scale / 8, 1);
    s.renderOrder = 998;
    return s;
  }
  const l1 = makeLabel('凹面主镜（抛物面）', '#94a3b8'); l1.position.set(0.1, -1.25, 0); group.add(l1);
  const l2 = makeLabel('双曲面副镜 折返', '#7dd3fc'); l2.position.set(HV, 0.95, 0); group.add(l2);
  const l3 = makeLabel('卡塞格林焦点', '#fbbf24', 2.6); l3.position.set(F2X - 0.15, -0.6, 0); group.add(l3);
  const l4 = makeLabel('平行星光（无色差）', '#f472b6', 3.0); l4.position.set(4.6, 1.5, 0); group.add(l4);
  const l5 = makeLabel('牛顿式：平面斜副镜 45°', '#86efac'); l5.position.set(NX - 0.4, -0.75, 0); group.add(l5);
  const l6 = makeLabel('筒侧焦点（目镜）', '#f472b6', 2.2); l6.position.set(NX + 0.75, SIDE_Y + 0.55, 0); group.add(l6);

  const infoCv = document.createElement('canvas');
  infoCv.width = 512; infoCv.height = 256;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const info = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  info.scale.set(7.4, 3.7, 1);
  info.position.set(1.6, 3.4, 0);
  info.renderOrder = 999;
  group.add(info);

  let aper = 1; // 有效光阑比例（扫描变量）

  function drawRays(): void {
    for (let band = 0; band < RAYS_PER; band++) {
      const r = aper * RP * (0.34 + 0.33 * band);
      for (let c = 0; c < RAY_COLORS.length; c++) {
        const k = c * RAYS_PER + band;
        const p = rayPosList[k];
        const az = (c / RAY_COLORS.length) * Math.PI * 2 + band * 0.35;
        const yy = r * Math.cos(az), zz = r * Math.sin(az);
        const xh = (r * r) / (4 * FP);
        const hit = hitSecondary(xh, r);
        p[0] = 5.6; p[1] = yy; p[2] = zz;
        p[3] = xh; p[4] = yy; p[5] = zz;
        if (hit && hit.y <= SEC_R + 0.02) {
          // 副镜交点 (hx,hy)：绕轴旋转保持半径
          const frac = hit.y / (r > 1e-9 ? r : 1);
          p[6] = hit.x; p[7] = yy * frac; p[8] = zz * frac;
          // 反射后必过 F2（双曲线光学性质），画到卡焦后再发散
          const ex = F2X - 0.55;
          p[9] = F2X; p[10] = 0; p[11] = 0;
          const dxl = ex - F2X, dl = Math.hypot(dxl, 0) || 1;
          p[12] = ex; p[13] = 0.28 * (zz >= 0 ? 1 : -1); p[14] = 0;
        } else {
          // 近轴光线：副镜中央无镀膜/穿孔区 ⇒ 直穿主镜中心孔到卡焦
          p[6] = 0; p[7] = yy * 0.12; p[8] = zz * 0.12;
          p[9] = F2X; p[10] = 0; p[11] = 0;
          p[12] = F2X - 0.5; p[13] = 0; p[14] = 0;
        }
        rayGeoList[k].attributes['position'].needsUpdate = true;
        rayLines[k].visible = true;
      }
    }
    // 主镜有效口径随光阑收缩（局部系：Y 为光轴，X/Z 为径向）
    priMesh.scale.set(Math.max(0.05, aper), 1, Math.max(0.05, aper));
    // 牛顿式光路：平行光→主镜（抛物面公式）→45° 平面斜副（与波长无关）→筒侧焦点 S
    for (let band = 0; band < RAYS_PER; band++) {
      const r = aper * RP * (0.34 + 0.33 * band);
      const k = band;
      const p = newtPosList[k];
      const az = (band / RAYS_PER) * Math.PI * 2 + 1.05;
      const yy = r * Math.cos(az), zz = r * Math.sin(az);
      const xh = (r * r) / (4 * FP);
      const tm = (xh - NX - yy) / (xh - FP - yy); // 与会聚段 P→F1 和平面 y=x−NX 的交点参数
      const qx = xh + (FP - xh) * tm, qy = yy * (1 - tm), qz = zz * (1 - tm);
      p[0] = 5.6; p[1] = yy; p[2] = zz;
      p[3] = xh; p[4] = yy; p[5] = zz;
      p[6] = qx; p[7] = qy; p[8] = qz;
      p[9] = NX; p[10] = SIDE_Y; p[11] = 0; // F1 的镜像 = 筒侧焦点
      p[12] = NX + 0.16; p[13] = SIDE_Y + 0.3; p[14] = 0.14 * (zz >= 0 ? 1 : -1);
      newtGeoList[k].attributes['position'].needsUpdate = true;
    }
  }

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 512, 256);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)';
    infoCtx.fillRect(3, 3, 506, 250);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3;
    infoCtx.strokeRect(3, 3, 506, 250);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText('反射望远镜：卡塞格林 + 牛顿双焦点', 14, 34);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '20px "PingFang SC", sans-serif';
    infoCtx.fillText('抛物面 y=r²/(4f)：平行光严格会聚主焦', 14, 66);
    infoCtx.fillText('卡式双曲面 |PF2|−|PF1|=2a ⇒ 折回镜后卡焦', 14, 92);
    infoCtx.fillText('牛顿式：平面斜副 45° ⇒ 焦点镜像折向筒侧', 14, 118);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('反射无色差：1/s+1/s\'=2/R 与波长无关', 14, 144);
    infoCtx.fillText('集光力 ∝ D² ∝ A²（口径决定一切）', 14, 170);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 20px "PingFang SC", sans-serif';
    const m = (HV - F2X) / (FP - HV);
    infoCtx.fillText(`读数: A=${aper.toFixed(2)} D=${(2 * aper * RP).toFixed(2)}m`, 14, 200);
    infoCtx.fillText(`集光 ${(Math.pow(aper, 2) * 100).toFixed(0)}%  卡焦 f_eff≈${(m * FP).toFixed(1)}m f/${((m * FP) / (2 * RP)).toFixed(1)}  牛焦侧距=${SIDE_Y.toFixed(2)}m`, 14, 230);
    infoTex.needsUpdate = true;
  }

  drawRays();
  drawInfo();

  return {
    update(t, dt) {
      // 16 s 周期：光阑从中心带推向全口径（0.12→1），看集光力随 D² 增长
      const cycle = t % 16;
      aper = 0.12 + 0.88 * (0.5 - 0.5 * Math.cos((Math.PI * 2 * cycle) / 16));
      drawRays();
      f2Mark.scale.setScalar(1 + 0.35 * Math.pow(aper, 2) * (0.5 + 0.5 * Math.sin(t * 5)));
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
