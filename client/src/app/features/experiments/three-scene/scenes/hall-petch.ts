import type { SceneContext, SceneInstance } from '../types';
/**
 * 霍尔-佩奇强化（P371）—— 主控方程（退火软钢铁素体实参数，SI 直算，node 已复核）：
 *   屈服强度      σ_y = σ₀ + k_y/√d，σ₀=80 MPa（晶内摩擦），k_y=0.5 MPa·m^1/2
 *   位错塞积      长度 L=d/2 的塞积群在切应力 τ 下的位错数
 *                 n = π·τ·L / [2(1−ν)·G·b]，τ=σ_y/M（刃型塞积；G=81.6 GPa，b=0.2486 nm，ν=0.293，M=3.06）
 *   标度来源      塞积头集中 τ_head=τ·√(πL/2b) 须达晶界激发临界 ⇒ 强度增量 ∝ √L ⇒ 斜率 k/√d
 *   晶界密度      单位体积晶界面积 S_V=3/d（等轴晶）；d 减半 ⇒ 晶界面积翻倍 ⇒ σ_y 上跳
 *   纳米反常      两机制取"更软者"：σ_hp=σ₀+k/√d（塞积）与 σ_gb=σ₀+C_GB·d²（晶界滑动，d 越小越易滑），
 *                 C_GB 由 d_c=15 nm 交点定 ⇒ d<d_c 强度掉头下降＝反 Hall-Petch
 * 复核：d=500/100/10/1 µm ⇒ σ_y=102/130/238/580 MPa；d=15nm 峰值 4163 MPa；d=2nm ⇒ 152.6 MPa（已软化）。
 * 画面：透明多晶网络（晶粒数随 d 加密、尺寸随之缩小）＋中央晶粒滑移面上的位错塞积群
 * （塞积显示长度固定、位数 n 为实算 ⇒ 晶粒变小则位数骤减、间距变宽，正是 1/√d 标度的图像）
 * ＋红色塞积头压在晶界墙前＋前方 σ_y–1/√d 曲线（直线段＋纳米峰后反转），标记点与几何同源。
 * 扫描自变量：d 在 18 s 内 500 µm ↔ 2 nm 对数往返（含反常支）。
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

  const SIG0 = 80e6, KY = 0.5e6;              // Pa, Pa·m^1/2
  const G = 81.6e9, B = 0.2486e-9, NU = 0.293, MT = 3.06;
  const DC = 15e-9;                            // m 反 Hall-Petch 转折晶粒尺寸
  const CGB = KY / (DC * DC * Math.sqrt(DC)); // 令 C·d²=k/√d 于 d_c ⇒ C=k·d_c^-2.5
  const sigHP = (d: number) => KY / Math.sqrt(d);
  const sigGB = (d: number) => CGB * d * d;
  const sigmaY = (d: number) => SIG0 + Math.min(sigHP(d), sigGB(d));
  const PEAK = sigmaY(DC);

  const D_MAX = 500, D_MIN = 0.002, CY = 18;   // µm（对数往返）
  const dUm = (ph: number) => D_MAX * Math.pow(D_MIN / D_MAX, 0.5 - 0.5 * Math.cos(TWO_PI * ph));

  // —— 星野 + 地面 ——
  {
    const g = geo(new THREE.BufferGeometry());
    const p = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      p[i * 3] = (Math.random() - 0.5) * 200; p[i * 3 + 1] = (Math.random() - 0.5) * 200; p[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    group.add(new THREE.Points(g, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  }
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // —— 多晶网络：壳层上的 InstancedMesh 晶粒（数随 d 加密、尺寸随之缩小）——
  const NMAX = 420;
  const grainGeo = geo(new THREE.IcosahedronGeometry(1, 1));
  const grainMat = mat(new THREE.MeshStandardMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.13, metalness: 0.25, roughness: 0.55, depthWrite: false }));
  const grains = new THREE.InstancedMesh(grainGeo, grainMat, NMAX);
  grains.frustumCulled = false;
  const edgeGeo = geo(new THREE.IcosahedronGeometry(1, 0));
  const edgeMat = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.34 }));
  const edges = new THREE.InstancedMesh(edgeGeo, edgeMat, NMAX);
  edges.frustumCulled = false;
  group.add(grains, edges);
  const gp: number[] = [];
  {
    let idx = 0;
    for (let sh = 1; sh <= 6; sh++) {
      const ring = sh * 12, R = 0.62 * sh;
      for (let k = 0; k < ring; k++) {
        const ph = Math.acos(1 - 2 * (k + 0.5) / ring);
        const th = PI * (1 + Math.sqrt(5)) * k;
        const j = 0.86 + 0.28 * (((idx * 2654435761) % 997) / 997);
        gp.push(Math.sin(ph) * Math.cos(th) * R * j, Math.cos(ph) * R * j + 1.5, Math.sin(ph) * Math.sin(th) * R * j);
        idx++;
      }
    }
  }
  const NP = gp.length / 3;
  const mtx = new THREE.Matrix4(), vP = new THREE.Vector3(), vS = new THREE.Vector3(), q = new THREE.Quaternion(), eu = new THREE.Euler();

  // —— 中央晶粒的滑移面 + 晶界墙 + 晶界位错网络 ——
  const slipGeo = geo(new THREE.PlaneGeometry(5.4, 3.2));
  const slipMat = mat(new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }));
  const slip = new THREE.Mesh(slipGeo, slipMat);
  slip.rotation.x = -PI / 2; slip.position.set(0, 1.06, 0);
  group.add(slip);
  const gbGeo = geo(new THREE.PlaneGeometry(3.2, 5.2));
  const gbMat = mat(new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x6d28d9, emissiveIntensity: 0.5, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
  const gbWall = new THREE.Mesh(gbGeo, gbMat);
  gbWall.rotation.y = PI / 2; gbWall.position.set(2.35, 1.5, 0);
  group.add(gbWall);
  const GBn = 26;
  const dotGeo = geo(new THREE.SphereGeometry(0.05, 8, 6));
  const gbDots = new THREE.InstancedMesh(dotGeo, mat(new THREE.MeshBasicMaterial({ color: 0xc084fc })), GBn * 3);
  {
    let n = 0;
    for (let i = 0; i < GBn; i++) {
      const z = -1.5 + 3 * i / (GBn - 1);
      for (let r = 0; r < 3; r++) {
        vP.set(2.35, 1.06 - 0.42 + r * 0.42, z); vS.setScalar(1); q.set(0, 0, 0, 1);
        mtx.compose(vP, q, vS); gbDots.setMatrixAt(n++, mtx);
      }
    }
    gbDots.count = n; gbDots.instanceMatrix.needsUpdate = true;
  }
  gbDots.frustumCulled = false;
  group.add(gbDots);

  // —— 塞积群：每条位错＝滑移面内一段弓出弧（LineSegments + setDrawRange）——
  const NDIS = 64, SEG = 14;
  const plGeo = geo(new THREE.BufferGeometry());
  const plPos = new Float32Array(NDIS * SEG * 2 * 3);
  plGeo.setAttribute('position', new THREE.BufferAttribute(plPos, 3));
  plGeo.setDrawRange(0, 0);
  const plMat = mat(new THREE.LineBasicMaterial({ color: 0xfef3c7 }));
  group.add(new THREE.LineSegments(plGeo, plMat));
  const coreGeo = geo(new THREE.SphereGeometry(0.062, 10, 8));
  const cores = new THREE.InstancedMesh(coreGeo, mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })), NDIS);
  cores.frustumCulled = false;
  group.add(cores);
  const head = new THREE.Mesh(geo(new THREE.SphereGeometry(0.13, 12, 10)), mat(new THREE.MeshBasicMaterial({ color: 0xef4444 })));
  head.position.set(2.18, 1.06, 0);
  group.add(head);

  // —— 前方 σ_y–1/√d 曲线（竖直面 x–y，z=PZ）——
  const PX0 = -3.05, PX1 = 3.05, PY0 = 0.06, PY1 = 2.05, PZ = 2.5;
  const SMAX = 4600e6, INVMAX = 26000;          // 纵轴 4.6 GPa；横轴 1/√d 到 26000 m⁻½（d≈1.5nm）
  const NCU = 240;
  const pGeo = geo(new THREE.BufferGeometry());
  pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NCU * 3), 3));
  group.add(new THREE.Line(pGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e }))));
  const axGeo = geo(new THREE.BufferGeometry());
  axGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    PX0, PY0, PZ, PX1, PY0, PZ, PX0, PY0, PZ, PX0, PY1, PZ,
  ]), 3));
  group.add(new THREE.LineSegments(axGeo, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));
  const marker = new THREE.Mesh(geo(new THREE.SphereGeometry(0.085, 12, 10)), mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })));
  group.add(marker);

  // —— 标签 ——
  function makeLabel(text: string, color: string, sx = 4.6): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 768; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 384, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(sx, sx / 12, 1);
    return s;
  }
  const lb1 = makeLabel('塞积群 n=πτL/2(1−ν)Gb：晶粒小→塞积短→位数少→需更大 σ 才开相邻位错源', '#67e8f9', 6.2); lb1.position.set(0.2, 1.72, 1.5);
  const lb2 = makeLabel('晶界＝障碍墙（位错网络）：塞积头（红）的应力集中在此激发下一晶粒', '#c084fc', 5.4); lb2.position.set(0.2, 2.32, 2.05);
  const lb3 = makeLabel('σ_y–1/√d：直线段＋纳米晶峰后反转（晶界滑动接管）', '#86efac', 5.0); lb3.position.set(0.35, 2.32, PZ);
  group.add(lb1, lb2, lb3);

  // —— 面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 880; infoCv.height = 274;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.6, 2.99)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 4.6, 0); infoPlane.renderOrder = 999;
  group.add(infoPlane);

  const rd = { d: 500, sig: 0, hp: 0, gb: 0, nr: 0, tau: 0, sv: 0, N: 0, inv: 0, nc: false, th: 0 };
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 880, 274);
    infoCtx.fillStyle = 'rgba(7,11,20,0.84)'; infoCtx.fillRect(4, 4, 872, 266);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 872, 266);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 27px "PingFang SC", sans-serif';
    infoCtx.fillText('霍尔-佩奇强化：晶界是位错的刹车片', 22, 36);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '23px "PingFang SC", sans-serif';
    infoCtx.fillText('σ_y = σ₀ + k/√d　σ₀=80MPa，k=0.5MPa·m½　⇒　增量 ∝ 1/√d（非 1/d）', 22, 68);
    infoCtx.fillText('塞积位数 n = πτL/[2(1−ν)Gb]，L=d/2，τ=σ_y/M（M=3.06）', 22, 96);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText(`推论：晶界面积密度 S_V=3/d=${(rd.sv / 1e6).toExponential(2)}×10⁶ m⁻¹ —— d 减半 ⇒ 晶界翻倍`, 22, 124);
    infoCtx.fillStyle = '#22c55e';
    infoCtx.fillText(`纳米反常：σ 取 min(σ₀+k/√d, σ₀+C_GB·d²)，d_c=15nm 交点＝峰值 ${(PEAK / 1e6).toFixed(0)} MPa`, 22, 152);
    infoCtx.fillStyle = rd.nc ? '#ef4444' : '#f472b6';
    infoCtx.fillText(rd.nc ? '当前：晶界滑动接管 —— 反 Hall-Petch，越细越软' : '当前：塞积机制主导 —— 正常 Hall-Petch，越细越强', 22, 180);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 23px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：d=${rd.d >= 1 ? rd.d.toFixed(0) + ' µm' : (rd.d * 1000).toFixed(1) + ' nm'}  1/√d=${(rd.inv / 100).toFixed(1)}×10² m⁻½  τ=${(rd.tau / 1e6).toFixed(0)} MPa`, 22, 210);
    infoCtx.fillText(`σ₀+k/√d=${((SIG0 + rd.hp) / 1e6).toFixed(0)} MPa　σ₀+C·d²=${((SIG0 + rd.gb) / 1e6).toFixed(0)} MPa ⇒ σ_y=${rd.sig >= 1000 ? (rd.sig / 1000).toFixed(2) + ' GPa' : rd.sig.toFixed(0) + ' MPa'}`, 22, 238);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '21px "PingFang SC", sans-serif';
    infoCtx.fillText(`塞积实算 n=${rd.nr} 条（画面显示上限 ${NDIS} 条）τ_head=τ√(πd/2b)=${(rd.th / 1e9).toFixed(1)} GPa  晶粒 ${rd.N} 颗`, 22, 264);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  return {
    update(t, dt) {
      const ph = (t % CY) / CY;
      const dd = dUm(ph) * 1e-6;                     // m
      const sig = sigmaY(dd), hp = sigHP(dd), gb = sigGB(dd);
      const inv = 1 / Math.sqrt(dd), sv = 3 / dd;
      const tau = sig / MT;
      const nReal = PI * tau * (dd / 2) / (2 * (1 - NU) * G * B);
      const n = Math.max(1, Math.min(NDIS, Math.round(nReal)));
      const tauHead = tau * Math.sqrt(Math.PI * dd / 4 / B);   // Eshelby 塞积头集中（r₀=b）

      // 晶粒网络（显示数与半径同源）
      const N = Math.max(8, Math.min(NMAX, Math.round(90 * Math.pow(50 / (dd * 1e6), 0.6))));
      const rg = 3.02 / Math.pow(N, 1 / 3) * 0.92;
      let used = 0;
      for (let i = 0; i < N && used < NMAX; i++) {
        const k = i % NP;
        vP.set(gp[k * 3], gp[k * 3 + 1], gp[k * 3 + 2]);
        const s = rg * (0.78 + 0.44 * (((i * 40503) % 131) / 131));
        eu.set(i * 0.7, i * 1.3, i * 0.31); q.setFromEuler(eu);
        vS.setScalar(s); mtx.compose(vP, q, vS); grains.setMatrixAt(used, mtx);
        vS.setScalar(s * 1.03); mtx.compose(vP, q, vS); edges.setMatrixAt(used, mtx);
        used++;
      }
      grains.count = used; edges.count = used;
      grains.instanceMatrix.needsUpdate = true; edges.instanceMatrix.needsUpdate = true;
      grainMat.opacity = 0.10 + 0.16 * Math.min(1, rg);
      edgeMat.opacity = 0.16 + 0.34 * Math.min(1, 1 / (1 + rg * 1.6));

      // 塞积弧：显示长度固定，n 条按幂律密排靠界
      const xa = -2.25, xb = 2.16;
      let v = 0;
      for (let i = 0; i < n; i++) {
        const fx = n > 1 ? i / (n - 1) : 0.5;
        const xc = xa + (xb - xa) * Math.pow(fx, 0.72);
        const bulge = 0.34 * (0.35 + 0.65 * fx) * Math.min(1, tau / 1.2e8) + 0.06;
        for (let s = 0; s < SEG; s++) {
          const t1 = -0.5 + s / SEG, t2 = -0.5 + (s + 1) / SEG;
          for (const a of [t1, t2]) {
            plPos[v++] = xc + bulge * (1 - 4 * a * a) * 0.5;
            plPos[v++] = 1.06;
            plPos[v++] = a * 1.42;
          }
        }
        vP.set(xc + bulge * 0.5, 1.06, 0); q.set(0, 0, 0, 1); vS.setScalar(Math.max(0.55, 1.3 - rg));
        mtx.compose(vP, q, vS); cores.setMatrixAt(i, mtx);
      }
      cores.count = n; cores.instanceMatrix.needsUpdate = true;
      plGeo.setDrawRange(0, n * SEG * 2);
      plGeo.attributes['position'].needsUpdate = true;
      plMat.color.setHex(dd < DC ? 0xf472b6 : 0xfef3c7);
      head.scale.setScalar(0.7 + 0.9 * Math.min(1, tauHead / 6e9));
      gbMat.opacity = 0.16 + 0.26 * Math.min(1, inv / INVMAX);
      slipMat.opacity = 0.07 + 0.13 * Math.min(1, tau / 2e8);

      // σ_y(1/√d) 曲线
      {
        const p = pGeo.attributes['position'].array as Float32Array;
        for (let i = 0; i < NCU; i++) {
          const f = i / (NCU - 1);
          const iv = f * INVMAX;
          p[i * 3] = PX0 + (PX1 - PX0) * f;
          p[i * 3 + 1] = PY0 + (PY1 - PY0) * Math.min(1, sigmaY(1 / (iv * iv)) / SMAX);
          p[i * 3 + 2] = PZ;
        }
        pGeo.attributes['position'].needsUpdate = true;
        pGeo.setDrawRange(0, NCU);
      }
      marker.position.set(PX0 + (PX1 - PX0) * Math.min(1, inv / INVMAX), PY0 + (PY1 - PY0) * Math.min(1, sig / SMAX), PZ);

      rd.d = dd * 1e6; rd.sig = sig / 1e6; rd.hp = hp; rd.gb = gb; rd.nr = Math.round(nReal);
      rd.tau = tau; rd.sv = sv; rd.N = used; rd.inv = inv; rd.nc = dd < DC; rd.th = tauHead;
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
