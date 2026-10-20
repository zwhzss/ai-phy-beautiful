import type { SceneContext, SceneInstance } from '../types';
/** 同时的相对性（P528）：洛伦兹变换 t′ = γ(t − βx/c)，c=1 单位制（画面纵轴 = ct）。
 *  三维时空图 (x, y, ct)：光锥 |ct|=√(x²+y²) 立成双锥，其内 s²=(ct)²−x²−y²>0 为类时（再画 s²=+1 双叶双曲面），
 *  锥外类空 —— 时序依赖参考系。两颗"站台上同时"的闪光事件固定在 (±d, 0, ct=0)：
 *  运动系 t′=常数等时面是 ct = βx + const 的倾斜平面（倾角 tanθ=β），
 *  两事件各落在自己的 t′ 切片上：Δt′ = −γβΔx = −2γβd，β 变号即先后翻转。
 *  β(t) 以 16s 周期在 −0.75…+0.75 余弦扫描；面板 t′ 读数与切片位置同源计算。 */
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
  const SC = 0.92;                    // 时空图 → 世界单位
  const D = 3.0;                      // 事件半间距（c=1 单位）
  const CY = 3.0;                     // 图形中心高度
  let beta = 0.6, gam = 1.25;

  // —— 坐标轴 ——
  const axGeo = geo(new THREE.BufferGeometry());
  axGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -5 * SC, CY, 0, 5 * SC, CY, 0,           // x
    0, CY - 2.9, 0, 0, CY + 2.9, 0,          // ct
    0, CY, -4 * SC, 0, CY, 4 * SC,           // y（第二空间轴，深度）
  ]), 3));
  group.add(new THREE.LineSegments(axGeo, mat(new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.7 }))));
  function makeLabel(text: string, color: string, scale = 1.8): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 30px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  function addLabel(text: string, color: string, scale: number, x: number, y: number, z: number): void {
    const lb = makeLabel(text, color, scale);
    lb.position.set(x, y, z);
    group.add(lb);
  }
  addLabel('x', '#94a3b8', 1.8, 4.9 * SC, CY + 0.3, 0);
  addLabel('ct', '#94a3b8', 1.8, 0.35, CY + 2.9, 0);
  addLabel('y', '#94a3b8', 1.8, 0, CY + 0.25, 3.9 * SC);

  // —— 光锥（双锥）+ 类时双叶双曲面 s²=+1 ——
  const coneMat = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.1, side: THREE.DoubleSide, wireframe: false }));
  const coneUp = new THREE.Mesh(geo(new THREE.ConeGeometry(2.6, 2.6, 36, 1, true)), coneMat);
  coneUp.position.y = CY + 1.3; coneUp.rotation.x = Math.PI;  // 锥尖在下
  const coneDn = new THREE.Mesh(coneUp.geometry, coneMat);
  coneDn.position.y = CY - 1.3;
  group.add(coneUp, coneDn);
  const hypGeo = geo(new THREE.BufferGeometry());
  {
    const HN = 16, HA = 32;
    const pos = new Float32Array((HN + 1) * (HA + 1) * 3);
    const idx: number[] = [];
    for (let s = 0; s < 2; s++) {
      const off = s * (HN + 1) * (HA + 1);
      for (let i = 0; i <= HN; i++) {
        const r = 0.15 + 2.1 * (i / HN);
        const ct = Math.sqrt(1 + r * r);                    // s² = c²t² − r² = 1
        for (let j = 0; j <= HA; j++) {
          const a = (j / HA) * TWO_PI, v = off + i * (HA + 1) + j;
          pos[v * 3] = r * Math.cos(a) * SC; pos[v * 3 + 1] = (s ? -ct : ct) * SC; pos[v * 3 + 2] = r * Math.sin(a) * SC;
        }
      }
      for (let i = 0; i < HN; i++) for (let j = 0; j < HA; j++) {
        const a = off + i * (HA + 1) + j, b = a + 1, c = a + HA + 1, e = c + 1;
        idx.push(a, b, c, b, e, c);
      }
    }
    hypGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    hypGeo.setIndex(idx);
  }
  const hypMesh = new THREE.Mesh(hypGeo, mat(new THREE.MeshBasicMaterial({ color: 0xa855f7, wireframe: true, transparent: true, opacity: 0.3, side: THREE.DoubleSide })));
  hypMesh.position.y = CY; group.add(hypMesh);

  // —— S 系同时面 ct=0 ——
  const planeGeo = geo(new THREE.PlaneGeometry(8.6 * SC, 7.2 * SC));
  const sPlane = new THREE.Mesh(planeGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.09, side: THREE.DoubleSide })));
  sPlane.rotation.x = -Math.PI / 2; sPlane.position.y = CY; group.add(sPlane);

  // —— 两条 S′ 等时面（过两事件）：法向 ∝ (−β,1,0)，绕 z 轴转 θ=atanβ ——
  const mkSlice = (color: number): import('three').Mesh => {
    const m = new THREE.Mesh(planeGeo, mat(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14, side: THREE.DoubleSide })));
    m.rotation.order = 'ZYX';                         // 必须先 Rx 躺平、再绕世界 z 倾 θ（默认 XYZ 会把 z 转到平面自身法向上 ⇒ 永不倾斜）
    m.rotation.x = -Math.PI / 2;
    group.add(m);
    return m;
  };
  const sliceF = mkSlice(0x22c55e);   // 过前事件
  const sliceR = mkSlice(0xf472b6);   // 过后事件

  // —— 事件：两枚闪光球 + 各自小光锥 ——
  const evMat = mat(new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.85 }));
  const evGeo = geo(new THREE.SphereGeometry(0.13, 14, 14));
  const evF = new THREE.Mesh(evGeo, evMat); evF.position.set(D * SC, CY, 0);
  const evR = new THREE.Mesh(evGeo, mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.85 })));
  evR.position.set(-D * SC, CY, 0);
  group.add(evF, evR);
  const evConeMat = mat(new THREE.MeshBasicMaterial({ color: 0xef4444, wireframe: true, transparent: true, opacity: 0.16 }));
  const evConeF = new THREE.Mesh(geo(new THREE.ConeGeometry(1.15, 1.15, 20, 1, true)), evConeMat);
  evConeF.position.set(D * SC, CY + 0.58, 0); evConeF.rotation.x = Math.PI;
  const evConeR = new THREE.Mesh(evConeF.geometry, mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24, wireframe: true, transparent: true, opacity: 0.16 })));
  evConeR.position.set(-D * SC, CY + 0.58, 0); evConeR.rotation.x = Math.PI;
  group.add(evConeF, evConeR);

  // —— 火车中心世界线（x=βct）与 ct′ 轴 ——
  const wlGeo = geo(new THREE.BufferGeometry());
  const wlPos = new Float32Array(6);                            // 仅 2 个端点（12 会多画出落在原点的第 3、4 顶点）
  wlGeo.setAttribute('position', new THREE.BufferAttribute(wlPos, 3));
  const worldline = new THREE.Line(wlGeo, mat(new THREE.LineDashedMaterial({ color: 0xfbbf24, dashSize: 0.16, gapSize: 0.1 })));
  group.add(worldline);

  addLabel('前事件（x=+d, t=0）', '#ef4444', 3.0, D * SC + 0.8, CY + 0.55, 0);
  addLabel('后事件（x=−d, t=0）', '#fbbf24', 3.0, -D * SC - 0.8, CY + 0.55, 0);

  // —— 长度收缩对比尺：站台尺 L₀（静）vs 火车尺 L=L₀/γ（同 β 扫描）——
  const L0W = 4.4;
  const rodGeo = geo(new THREE.BoxGeometry(1, 0.08, 0.08));
  const rodS = new THREE.Mesh(rodGeo, mat(new THREE.MeshBasicMaterial({ color: 0x64748b })));
  rodS.scale.set(L0W, 1, 1); rodS.position.set(0, 0.34, -2.4); group.add(rodS);
  const rodT = new THREE.Mesh(rodGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee })));
  rodT.scale.set(L0W, 1, 1); rodT.position.set(0, 0.56, -2.4); group.add(rodT);
  addLabel('长度收缩：蓝尺 L=L₀/γ 随 β 缩放', '#94a3b8', 3.2, -2.55, 0.45, -2.4);

  // —— 光钟：S 系中看到 Λ 形斜路（钟静止于画面中心，站台相对后退）——
  const CKX = 3.95, CKY = 1.32, CH = 0.5;
  const clkGeo = geo(new THREE.BufferGeometry());
  clkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  const clkLine = new THREE.Line(clkGeo, mat(new THREE.LineBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.85 })));
  group.add(clkLine);
  const mirGeo = geo(new THREE.BoxGeometry(0.34, 0.05, 0.05));
  const mirBot = new THREE.Mesh(mirGeo, mat(new THREE.MeshBasicMaterial({ color: 0xa855f7 })));
  const mirTop = new THREE.Mesh(mirGeo, mat(new THREE.MeshBasicMaterial({ color: 0xa855f7 })));
  group.add(mirBot, mirTop);
  const phGeo = geo(new THREE.SphereGeometry(0.07, 10, 10));
  const photon = new THREE.Mesh(phGeo, mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  group.add(photon);
  addLabel('光钟（S 系视角）', '#a855f7', 2.4, CKX, 0.62, 0);

  // —— 面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 840; infoCv.height = 300;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.2, 3.3)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 6.4, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  let tF = 0, tR = 0, tiltDeg = 0;
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 840, 300);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 832, 292);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 832, 292);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText('t′ = γ(t − βx/c)，γ = 1/√(1−β²)　等同时面：ct = βx + c′（tanθ = β）', 22, 40);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '24px "PingFang SC", sans-serif';
    infoCtx.fillText('类空间隔 Δs² = Δx²−c²Δt² = (2d)² > 0 ⇒ 时序随参考系而变；|β| 越大 Δt′ 越大', 22, 78);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('双锥面 = 光锥（45°）；紫双叶曲面 s²=+1 上各事件与原点类时', 22, 112);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：β=${beta.toFixed(2)} γ=${gam.toFixed(3)} θ=${tiltDeg.toFixed(1)}°  t′前=${tF.toFixed(2)}  t′后=${tR.toFixed(2)}  Δt′=${(tF - tR).toFixed(2)}`, 22, 152);
    infoCtx.fillText(`Δt′ = −2γβd = ${(-2 * gam * beta * D).toFixed(2)}（c=1, d=${D.toFixed(0)}）；β→0 唯一使两事件同时的参考系`, 22, 186);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('β 过零变号 ⇒ 两切片上下互换：前/后事件的先后次序翻转（火车思想实验）', 22, 226);
    infoCtx.fillText(`光钟周期 γ·2H/c=${(gam * 2 * CH).toFixed(2)}（本征 1.00）｜火车尺 L=L₀/γ=${(L0W / gam).toFixed(2)}/${L0W.toFixed(1)}`, 22, 258);
    infoTex.needsUpdate = true;
  }

  function syncSlices(): void {
    tiltDeg = Math.atan(beta) * 57.2958;
    const th = Math.atan(beta);
    // 事件 t′：γ(t−βx)
    tF = gam * (0 - beta * D);
    tR = gam * (0 - beta * (-D));
    // 过前事件的切片：ct = βx + c′, c′ = −βd（在 x=d 处 ct=0）；中心沿 ct 平移 c′·? 用平面 y 偏移 + 旋转
    sliceF.rotation.z = th;
    sliceR.rotation.z = th;
    // 平面原为水平（法向 +Y）；绕世界 z 轴转 θ 后法向 = (−sinθ, cosθ, 0) ∝ (−β,1,0) ✓
    // 平面 ct = βx + c′ ⇒ 沿 ct 轴平移 c′（再乘 SC）
    sliceF.position.set(0, CY + (-beta * D) * SC, 0);
    sliceR.position.set(0, CY + (beta * D) * SC, 0);
    // 世界线 x = β·ct（从 ct=−2.7 到 2.7）
    const s0 = -2.7, s1 = 2.7;
    wlPos[0] = beta * s0 * SC; wlPos[1] = CY + s0 * SC; wlPos[2] = 0;
    wlPos[3] = beta * s1 * SC; wlPos[4] = CY + s1 * SC; wlPos[5] = 0;
    wlGeo.attributes['position'].needsUpdate = true;
    worldline.computeLineDistances();
  }
  syncSlices(); drawInfo();

  return {
    update(t, dt) {
      // 扫描 β：−0.75 … +0.75，16s 余弦周期（过零 ⇒ 时序翻转）
      beta = 0.75 * Math.cos(TWO_PI * ((t % 16) / 16));
      gam = 1 / Math.sqrt(Math.max(1e-6, 1 - beta * beta));
      syncSlices();
      // 火车尺收缩：L = L₀/γ（S 系测量）
      rodT.scale.x = L0W / gam;
      // 光钟：S 系中光子走 Λ 形斜边，半个 tick 漂移 βγH ⇒ tick 周期 = γ·2H/c
      {
        const dir = beta >= 0 ? 1 : -1;
        const Sx = Math.min(1.05, Math.abs(beta) * gam * CH);
        const T = 1.1 * gam;
        const u = (t / T) % 1;
        const up = u < 0.5, pu = up ? u / 0.5 : (u - 0.5) / 0.5;
        const ax = CKX - dir * Sx;
        const mx = ax + 2 * dir * Sx * u;
        const ca = clkGeo.attributes['position'].array as Float32Array;
        ca[0] = ax; ca[1] = CKY - CH; ca[2] = 0;
        ca[3] = CKX; ca[4] = CKY + CH; ca[5] = 0;
        ca[6] = ax + 2 * dir * Sx; ca[7] = CKY - CH; ca[8] = 0;
        clkGeo.attributes['position'].needsUpdate = true;
        mirBot.position.set(mx, CKY - CH, 0);
        mirTop.position.set(mx, CKY + CH, 0);
        photon.position.set(mx, up ? CKY - CH + 2 * CH * pu : CKY + CH - 2 * CH * pu, 0);
      }
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
