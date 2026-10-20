import type { SceneContext, SceneInstance } from '../types';
/** 显微镜与分辨极限（P448）：主控方程
 *  ① NA = n·sinθ（半孔径角 θ、物方介质 n）；阿贝判据 d_min = λ/(2NA)；瑞利两点判据 0.61λ/NA
 *  ② 衍射光栅方程（斜照明、最佳配置）：sinθ_m = sinθ₀ + mλ/(nd)，取 sinθ₀ = λ/(2nd)
 *     ⇒ 0 级与 −1 级恰好对称擦孔径边缘：两级同时进入物镜 ⇔ NA ≥ λ/(2d) ⇔ 阿贝判据
 *  ③ 相干成像强度 I(x') = a₀²+a₁²+2a₀a₁·C₀C₋₁·cos(2πx'/P)，缝宽占空比 0.5 ⇒ a₁/a₀ = sinc(0.5) = 0.637
 *  画面：样品栅（d=400nm）发出斜入射光与 0/−1 级出射光线；孔径环（光阑）半径 = h·tanθ 随扫描收缩，
 *  高级次丢失时出射级变红虚线、像面条纹消失成一片糊光；16 s 前段干镜扫 θ(12°→67°)，后段浸油 n→1.52 突破 NA=1。 */
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

  const DEG = 180 / Math.PI;
  const LAM = 550;                 // nm
  const DPER = 400;                // 样品栅周期 d，nm
  const SY = -1.0, LY = 1.0, H = LY - SY, IY = 2.9;
  const TH_MAX = 67 / DEG;
  const A1 = Math.sin(Math.PI * 0.5) / (Math.PI * 0.5);   // sinc(0.5)=0.6366 一级复振幅（缝宽/周期=0.5）

  // —— 物方介质块 ——
  const medGeo = geo(new THREE.BoxGeometry(8.2, 2.0, 4.0));
  const medMat = mat(new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.06 }));
  const med = new THREE.Mesh(medGeo, medMat);
  med.position.set(0, 0, 0);
  group.add(med);
  // 样品载物台 + 栅线（周期条）
  const stageGeo = geo(new THREE.BoxGeometry(4.6, 0.08, 1.8));
  const stage = new THREE.Mesh(stageGeo, mat(new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.4, roughness: 0.6 })));
  stage.position.set(0, SY - 0.06, 0);
  group.add(stage);
  const slitGeo = geo(new THREE.BoxGeometry(0.09, 0.1, 1.5));
  const slitMat = mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
  const PERW = 0.64;               // 世界单位栅周期（示意）
  for (let k = -3; k <= 3; k++) {
    const s = new THREE.Mesh(slitGeo, slitMat);
    s.position.set(k * PERW, SY, 0);
    group.add(s);
  }

  // —— 物镜：孔径环（光阑）+ 透镜面元 ——
  const stopRing = new THREE.Mesh(geo(new THREE.RingGeometry(0.96, 1.0, 48)), mat(new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide })));
  stopRing.rotation.x = -Math.PI / 2;
  stopRing.position.y = LY;
  group.add(stopRing);
  const lensDisc = new THREE.Mesh(geo(new THREE.CircleGeometry(1, 48)), mat(new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.1, side: THREE.DoubleSide })));
  lensDisc.rotation.x = -Math.PI / 2;
  lensDisc.position.y = LY;
  group.add(lensDisc);

  // —— 光线（0 级/−1 级/入射），丢失时转红虚线 ——
  function beam(color: number): { line: import('three').Line; g: import('three').BufferGeometry; m: import('three').LineDashedMaterial } {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
    const m = mat(new THREE.LineDashedMaterial({ color, dashSize: 0.12, gapSize: 0.09, transparent: true, opacity: 0.95 }));
    const line = new THREE.Line(g, m);
    group.add(line);
    return { line, g, m };
  }
  const bIn = beam(0xef4444), bO0 = beam(0x22c55e), bO1 = beam(0x22d3ee);
  function setBeam(b: { line: import('three').Line; g: import('three').BufferGeometry; m: import('three').LineDashedMaterial }, a: import('three').Vector3, c: import('three').Vector3, col: number): void {
    const arr = b.g.attributes['position'].array as Float32Array;
    arr[0] = a.x; arr[1] = a.y; arr[2] = a.z; arr[3] = c.x; arr[4] = c.y; arr[5] = c.z;
    b.g.attributes['position'].needsUpdate = true;
    b.g.setDrawRange(0, 2);
    b.m.color.setHex(col);
    b.line.computeLineDistances();
  }

  // —— 会聚至像面的两段线（0 级、−1 级） ——
  function seg2(color: number): { g: import('three').BufferGeometry; m: import('three').LineBasicMaterial } {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4 * 3), 3));
    const m = mat(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 }));
    group.add(new THREE.Line(g, m));
    return { g, m };
  }
  const conv0 = seg2(0x22c55e), conv1 = seg2(0x22d3ee);

  // —— 像面条纹带（与曲线面板同一 I(x')） ——
  const stripCv = document.createElement('canvas');
  stripCv.width = 256; stripCv.height = 40;
  const stripCtx = stripCv.getContext('2d')!;
  const stripTex = tex(new THREE.CanvasTexture(stripCv));
  const strip = new THREE.Mesh(geo(new THREE.PlaneGeometry(3.4, 0.5)), mat(new THREE.MeshBasicMaterial({ map: stripTex, side: THREE.DoubleSide })));
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(0, IY, 0.4);
  group.add(strip);

  // —— 像面强度曲线面板 ——
  const profCv = document.createElement('canvas');
  profCv.width = 512; profCv.height = 256;
  const profCtx = profCv.getContext('2d')!;
  const profTex = tex(new THREE.CanvasTexture(profCv));
  const profPlane = new THREE.Mesh(geo(new THREE.PlaneGeometry(3.2, 1.6)), mat(new THREE.MeshBasicMaterial({ map: profTex, transparent: true })));
  profPlane.position.set(4.4, 2.2, 0.6);
  group.add(profPlane);

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
  group.add(makeLabel('样品栅 d=400 nm', '#fbbf24', 3.0, new THREE.Vector3(0, SY - 0.55, 1.2)));
  group.add(makeLabel('物镜孔径（光阑）', '#ef4444', 2.8, new THREE.Vector3(-2.9, LY + 0.3, 0)));
  group.add(makeLabel('像面：条纹=可分辨', '#22d3ee', 3.0, new THREE.Vector3(0, IY + 0.55, -0.6)));

  let n = 1.0, th = 20 / DEG, NA = 0, m0Sin = 0, m1Sin = 0, cap0 = 0, cap1 = 0, vis = 0, dA = 0, dR = 0;
  const IMG_P = 1.06;               // 像面条纹显示周期（世界单位）
  function profileAt(u: number): number {
    const base = 1 + A1 * A1;
    return base + 2 * A1 * cap0 * cap1 * Math.cos(2 * Math.PI * u / IMG_P);
  }
  function drawProf(): void {
    profCtx.clearRect(0, 0, 512, 256);
    profCtx.fillStyle = 'rgba(7,11,20,0.85)'; profCtx.fillRect(0, 0, 512, 256);
    profCtx.strokeStyle = '#334155'; profCtx.lineWidth = 2; profCtx.strokeRect(3, 3, 506, 250);
    profCtx.strokeStyle = '#22d3ee'; profCtx.lineWidth = 3; profCtx.beginPath();
    const imax = 1 + A1 * A1 + 2 * A1, imin = Math.max(1e-6, 1 + A1 * A1 - 2 * A1);
    for (let k = 0; k <= 240; k++) {
      const xw = -1.7 + (3.4 * k) / 240;
      const yv = 34 + (1 - (profileAt(xw) - imin) / (imax - imin)) * 180;
      if (k === 0) profCtx.moveTo(30 + (k / 240) * 460, yv); else profCtx.lineTo(30 + (k / 240) * 460, yv);
    }
    profCtx.stroke();
    profCtx.fillStyle = '#94a3b8'; profCtx.font = '20px "PingFang SC", sans-serif';
    profCtx.fillText('像面强度 I(x′)（3.4 单位视场）', 60, 240);
    profCtx.fillStyle = vis > 0.25 ? '#22c55e' : '#ef4444';
    profCtx.font = 'bold 22px "PingFang SC", sans-serif';
    profCtx.fillText(vis > 0.25 ? `可见度 V=${vis.toFixed(2)} → 分辨` : `V=${vis.toFixed(2)} → 两点合并`, 300, 34);
    profTex.needsUpdate = true;
    // 像面条带：同一 profileAt
    for (let px = 0; px < 256; px++) {
      const xw = -1.7 + (3.4 * px) / 256;
      const g = Math.max(0, Math.min(1, (profileAt(xw) - imin) / (imax - imin)));
      stripCtx.fillStyle = `rgba(${(40 + 200 * g) | 0},${(40 + 215 * g) | 0},${(60 + 195 * g) | 0},1)`;
      stripCtx.fillRect(px, 0, 1, 40);
    }
    stripTex.needsUpdate = true;
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
    ln(40, '#f8fafc', '阿贝成像：NA = n·sinθ，d_min = λ/(2NA)', true);
    ln(78, '#22d3ee', '0 级与 −1 级 ⇔ NA ≥ λ/(2d) —— 级次丢失 ⇒ 条纹消失');
    ln(112, '#a855f7', `瑞利两点判据 0.61λ/NA；干镜天花板 NA<1，浸油突破`);
    ln(148, '#fbbf24', `读数：n=${n.toFixed(2)} θ=${(th * DEG).toFixed(1)}° NA=${NA.toFixed(3)}  d_min(阿贝)=${dA.toFixed(0)}nm  d_min(瑞利)=${dR.toFixed(0)}nm`, true, 24);
    ln(180, '#fbbf24', `0 级入镜=${cap0 > 0.5 ? '是' : '否'} −1 级入镜=${cap1 > 0.5 ? '是' : '否'}  可见度 V=${vis.toFixed(2)}  样品 d=${DPER}nm`, false, 24);
    ln(212, '#94a3b8', `斜照明 sinθ₀=λ/(2nd)=${m0Sin.toFixed(3)}；NA=1.4 时 0.61λ/NA = ${(0.61*550/1.4).toFixed(0)} nm`, false, 22);
    infoTex.needsUpdate = true;
  }

  function solve(): void {
    NA = n * Math.sin(th);
    dA = LAM / (2 * NA);
    dR = 0.61 * LAM / NA;
    m0Sin = LAM / (2 * n * DPER);                // 最佳斜照明：0 级与 −1 级对称擦边
    m1Sin = m0Sin - LAM / (n * DPER);            // −1 级
    const rho = H * Math.tan(th);
    const hitX = (sm: number): number => {
      const cs = Math.sqrt(Math.max(1e-9, 1 - sm * sm));
      return H * (sm / cs);
    };
    const soft = (xh: number): number => Math.max(0, Math.min(1, (rho - Math.abs(xh)) / (0.18 * Math.max(0.3, rho)) + 0.5));
    cap0 = soft(hitX(m0Sin)); cap1 = soft(hitX(m1Sin));
    vis = (2 * A1 * cap0 * cap1) / (1 + A1 * A1);
    // 入射（斜）：从上方右侧到样品中心 O
    const O = new THREE.Vector3(0, SY, 0);
    const inSm = m0Sin;                          // 入射与 0 级同角（透射栅 0 级不偏折）
    const inFrom = O.clone().add(new THREE.Vector3(hitX(inSm), H * 0.92, 0));
    setBeam(bIn, inFrom, O, cap0 > 0.5 ? 0xef4444 : 0x7f1d1d);
    const x0 = hitX(m0Sin), x1 = hitX(m1Sin);
    setBeam(bO0, O, new THREE.Vector3(x0, LY, 0), cap0 > 0.5 ? 0x22c55e : 0xef4444);
    setBeam(bO1, O, new THREE.Vector3(x1, LY, 0), cap1 > 0.5 ? 0x22d3ee : 0xef4444);
    bO0.m.opacity = 0.25 + 0.75 * cap0; bO1.m.opacity = 0.25 + 0.75 * cap1;
    // 会聚线：孔径命中点 → 像面 ±IMG_P/2 会聚成条纹
    const setConv = (c: { g: import('three').BufferGeometry }, xh: number, xi: number, on: number): void => {
      const a = c.g.attributes['position'].array as Float32Array;
      a[0] = xh; a[1] = LY; a[2] = 0; a[3] = xi; a[4] = IY; a[5] = 0;
      a[6] = xi; a[7] = IY; a[8] = 0; a[9] = xi; a[10] = IY; a[11] = 0;
      c.g.attributes['position'].needsUpdate = true;
      c.g.setDrawRange(0, on > 0.5 ? 2 : 0);
    };
    setConv(conv0, x0, IMG_P / 2, cap0); setConv(conv1, x1, -IMG_P / 2, cap1);
    // 孔径环半径
    stopRing.scale.setScalar(Math.max(0.05, rho));
    lensDisc.scale.setScalar(Math.max(0.05, rho));
    // 介质色：油变浓
    medMat.opacity = 0.05 + 0.13 * ((n - 1) / 0.52);
    medMat.color.setHex(n > 1.2 ? 0x22d3ee : 0x60a5fa);
  }

  function update(t: number, dt: number): void {
    const u = (t % 16) / 16;
    if (u < 0.55) {
      n = 1.0;
      th = (12 + 55 * (u / 0.55)) / DEG;
    } else {
      th = TH_MAX;
      const v = (u - 0.55) / 0.45;
      n = 1.0 + 0.52 * (0.5 - 0.5 * Math.cos(v * 2 * Math.PI));
    }
    solve();
    if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) { drawInfo(); drawProf(); }
  }

  n = 1.0; th = 50 / DEG;
  solve(); drawProf(); drawInfo();

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
