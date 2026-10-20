import type { SceneContext, SceneInstance } from '../types';
/** 正则变换（P200）：两对解耦正则变量的辛流 —— (x,p) 为含时（参数驱动）谐振子，
 *  H = ½p² + ½ω(t)²x² + ½π² + ½Ω²q²（π 为 q 的共轭动量，仅参与演化、不在画面显示）。
 *  正则方程：ẋ = ∂H/∂p = p，ṗ = −∂H/∂x = −ω(t)²x；q̇ = ∂H/∂π = π，π̇ = −∂H/∂q = −Ω²q。
 *  (x,p) 子系统闭合且 tr A ≡ 0 ⇒ det Φ(t) = e^{∫tr dt} = 1：云团可以剪切拉伸旋转，
 *  但 (x,p) 协方差椭圆面积 πab（2.3σ 等概率椭圆）≡ 初值（面板逐帧实测 a、b、πab）；四维相体积同样守恒。
 *  生成函数观点：辛映射 Φ 由 F₂ 型母函数生成 ⇔ 相环量 J_环 = ∮p dq = πab 守恒（面板读数同源实测）。 */
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

  // —— 相空间坐标：x（红，+x）、p（青，+z 深度）、q（紫，+y 共轭坐标） ——
  const SX = 2.4, SP = 1.55, SQ = 2.0;
  const oy = -1.4;
  function axisLine(v: [number, number, number], color: number): void {
    const g = geo(new THREE.BufferGeometry());
    const a = new Float32Array(6);
    a[3] = v[0]; a[4] = v[1]; a[5] = v[2];
    g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    group.add(new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 }))));
  }
  axisLine([3.3, 0, 0], 0xf472b6);
  axisLine([0, 0, 2.6], 0x22d3ee);
  axisLine([0, 3.0, 0], 0xa855f7);

  function makeLabel(text: string, color: string, scale = 1.2): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 36px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 128, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 4, 1);
    return s;
  }
  const lx = makeLabel('x', '#f472b6'); lx.position.set(3.55, 0, 0); group.add(lx);
  const lp = makeLabel('p', '#22d3ee'); lp.position.set(0, 0, 2.85); group.add(lp);
  const lq = makeLabel('q（第二对正则坐标）', '#a855f7', 2.0); lq.position.set(0, 3.25, 0); group.add(lq);

  // —— 点云：线性辛流 v̇ = A(t)v（(x,p) 含时谐振子 + (q,π) 简谐振子，两对解耦） ——
  //   ẋ = ∂H/∂p = p；ṗ = −∂H/∂x = −ω(t)²x；q̇ = ∂H/∂π = π；π̇ = −∂H/∂q = −Ω²q
  const NP = 460;
  const X = new Float64Array(NP), P = new Float64Array(NP), Q = new Float64Array(NP), PI = new Float64Array(NP);
  const clGeo = geo(new THREE.BufferGeometry());
  const clPos = new Float32Array(NP * 3);
  const clCol = new Float32Array(NP * 3);
  clGeo.setAttribute('position', new THREE.BufferAttribute(clPos, 3));
  clGeo.setAttribute('color', new THREE.BufferAttribute(clCol, 3));
  group.add(new THREE.Points(clGeo, mat(new THREE.PointsMaterial({ vertexColors: true, size: 0.075, transparent: true, opacity: 0.95 }))));

  const rnd = (i: number, k: number): number => {
    const s = Math.sin(i * 78.2 + k * 131.7) * 4371.53;
    const r = s - Math.floor(s);
    return r;
  };
  // —— (x,p) 样本协方差（去质心）：返回 [sxx, spp, sxp, 质心x, 质心p] ——
  function covSP(): [number, number, number, number, number] {
    let sx = 0, sp = 0;
    for (let i = 0; i < NP; i++) { sx += X[i]; sp += P[i]; }
    const cx = sx / NP, cp = sp / NP;
    let sxx = 0, spp = 0, sxp = 0;
    for (let i = 0; i < NP; i++) {
      const dx = X[i] - cx, dp = P[i] - cp;
      sxx += dx * dx; spp += dp * dp; sxp += dx * dp;
    }
    return [sxx / NP, spp / NP, sxp / NP, cx, cp];
  }

  let area0 = 1;
  function seed(): void {
    for (let i = 0; i < NP; i++) {
      // Box–Muller：高斯云 σx=0.95、σp=0.5、σq=0.7、σπ=0.5
      const g1 = Math.sqrt(-2 * Math.log(rnd(i, 1) + 1e-9)) * Math.cos(2 * Math.PI * rnd(i, 2));
      const g2 = Math.sqrt(-2 * Math.log(rnd(i, 3) + 1e-9)) * Math.cos(2 * Math.PI * rnd(i, 4));
      X[i] = 0.95 * g1;
      P[i] = 0.5 * g2;
      Q[i] = 0.7 * Math.sqrt(-2 * Math.log(rnd(i, 5) + 1e-9)) * Math.cos(2 * Math.PI * rnd(i, 6));
      PI[i] = 0.5 * Math.sqrt(-2 * Math.log(rnd(i, 8) + 1e-9)) * Math.cos(2 * Math.PI * rnd(i, 9));
      const cc = new THREE.Color().setHSL(0.52 + 0.35 * rnd(i, 7), 0.8, 0.6);
      clCol[i * 3] = cc.r; clCol[i * 3 + 1] = cc.g; clCol[i * 3 + 2] = cc.b;
    }
    // 初值 = 播种后 (x,p) 样本的实测面积（与逐帧 a、b 用同一 2.3σ 椭圆估计）
    const [sxx0, spp0, sxp0] = covSP();
    area0 = 2.3 * 2.3 * Math.PI * Math.sqrt(Math.max(1e-9, sxx0 * spp0 - sxp0 * sxp0));
    clGeo.attributes['color'].needsUpdate = true;
  }

  let wT = 1.15;
  const OM = 1.6; // (q,π) 对的固有频率 Ω
  function deriv(i: number, w: number): [number, number, number, number] {
    const x = X[i], p = P[i], q = Q[i], pi = PI[i];
    return [p, -w * w * x, pi, -OM * OM * q]; // ẋ=∂H/∂p，ṗ=−∂H/∂x，q̇=∂H/∂π，π̇=−∂H/∂q
  }
  function step(h: number): void {
    // RK4（线性流：∂ẋ/∂x = ∂ṗ/∂p = ∂q̇/∂q = ∂π̇/∂π = 0 ⇒ tr A ≡ 0 ⇒ det Φ = e^{∫tr dt} = 1）
    for (let i = 0; i < NP; i++) {
      const x0 = X[i], p0 = P[i], q0 = Q[i], z0 = PI[i];
      const k1 = deriv(i, wT);
      X[i] = x0 + k1[0] * h / 2; P[i] = p0 + k1[1] * h / 2; Q[i] = q0 + k1[2] * h / 2; PI[i] = z0 + k1[3] * h / 2;
      const k2 = deriv(i, wT);
      X[i] = x0 + k2[0] * h / 2; P[i] = p0 + k2[1] * h / 2; Q[i] = q0 + k2[2] * h / 2; PI[i] = z0 + k2[3] * h / 2;
      const k3 = deriv(i, wT);
      X[i] = x0 + k3[0] * h; P[i] = p0 + k3[1] * h; Q[i] = q0 + k3[2] * h; PI[i] = z0 + k3[3] * h;
      const k4 = deriv(i, wT);
      X[i] = x0 + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
      P[i] = p0 + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      Q[i] = q0 + (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
      PI[i] = z0 + (h / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);
    }
  }

  // —— x–p 投影椭圆（协方差矩阵特征分解，逐帧实测面积） ——
  const eGeo = geo(new THREE.BufferGeometry());
  const eArr = new Float32Array(73 * 3);
  eGeo.setAttribute('position', new THREE.BufferAttribute(eArr, 3));
  group.add(new THREE.Line(eGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 }))));
  const axGeo = geo(new THREE.BufferGeometry());
  axGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 3), 3));
  group.add(new THREE.LineSegments(axGeo, mat(new THREE.LineBasicMaterial({ color: 0xf472b6 }))));
  let aBig = 1, bSmall = 1, theta = 0;
  function updateEllipse(): void {
    const [sxx, spp, sxp, mx, mp] = covSP();
    const tr = sxx + spp, det = sxx * spp - sxp * sxp;
    const l1 = tr / 2 + Math.sqrt(Math.max(1e-9, tr * tr / 4 - det));
    const l2 = Math.max(1e-9, det / l1);
    aBig = 2.3 * Math.sqrt(l1); // 2σ 等概率椭圆半轴
    bSmall = 2.3 * Math.sqrt(l2);
    theta = 0.5 * Math.atan2(2 * sxp, sxx - spp);
    const ct = Math.cos(theta), st = Math.sin(theta);
    const ccx = mx * SX, ccz = mp * SP; // 椭圆随云团质心平移
    for (let j = 0; j <= 72; j++) {
      const a = (j / 72) * 2 * Math.PI;
      const ex = aBig * Math.cos(a), ep = bSmall * Math.sin(a);
      eArr[j * 3] = ccx + (ex * ct - ep * st) * SX;
      eArr[j * 3 + 1] = oy;
      eArr[j * 3 + 2] = ccz + (ex * st + ep * ct) * SP;
    }
    eGeo.attributes['position'].needsUpdate = true;
    const ap = axGeo.attributes['position'].array as Float32Array;
    const setv = (idx: number, vx: number, vy: number, vz: number): void => { ap[idx * 3] = vx; ap[idx * 3 + 1] = vy; ap[idx * 3 + 2] = vz; };
    setv(0, ccx, oy, ccz);
    setv(1, ccx + aBig * ct * SX, oy, ccz + aBig * st * SP);
    setv(2, ccx, oy, ccz);
    setv(3, ccx - bSmall * st * SX, oy, ccz + bSmall * ct * SP);
    axGeo.attributes['position'].needsUpdate = true;
  }

  // —— 3D 云位置 ——
  function updateCloud(): void {
    for (let i = 0; i < NP; i++) {
      clPos[i * 3] = X[i] * SX;
      clPos[i * 3 + 1] = oy + 0.55 + Q[i] * SQ * 0.9 + 0.9;
      clPos[i * 3 + 2] = P[i] * SP;
    }
    clGeo.attributes['position'].needsUpdate = true;
  }

  // —— 面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 800; infoCv.height = 268;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(8.8, 2.95)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 5.7, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 800, 268);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 792, 260);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 792, 260);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 29px "PingFang SC", sans-serif';
    infoCtx.fillText('正则变换（辛流）：含时谐振子，(x,p) 相面积 πab 严格守恒', 22, 42);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '26px "PingFang SC", sans-serif';
    infoCtx.fillText('H = ½p² + ½ω(t)²x² + ½π² + ½Ω²q²（π 为 q 的共轭动量，不显示）', 22, 78);
    infoCtx.fillText('ẋ = ∂H/∂p = p，ṗ = −∂H/∂x = −ω(t)²x（(x,p) 闭合二维流）', 22, 112);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('q̇ = ∂H/∂π = π，π̇ = −∂H/∂q = −Ω²q；tr A ≡ 0 ⇒ det Φ ≡ 1', 22, 146);
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.fillText('生成函数 F₂ 型辛变换：相环量 ∮p dq = πab 不变（J = ∮p dq/2π）', 22, 180);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    const loop = Math.PI * aBig * bSmall;
    infoCtx.fillText(
      `读数：ω(t) = ${wT.toFixed(2)}  a = ${aBig.toFixed(2)}  b = ${bSmall.toFixed(2)}  比 ${(aBig / bSmall).toFixed(1)}×`,
      22, 214,
    );
    infoCtx.fillText(
      `环量读数：∮p dq = πab = ${loop.toFixed(2)}（初值 ${area0.toFixed(2)}）⇒ 守恒，J = ${((loop) / (2 * Math.PI)).toFixed(2)}`,
      22, 248,
    );
    infoTex.needsUpdate = true;
  }

  seed();
  updateEllipse();
  updateCloud();
  drawInfo();

  let lastCycle = -1;

  return {
    update(t, dt) {
      // 扫描自变量：周期驱动 u(t)（16s 一轮；新周期重播种重放剪切过程）
      const cyc = Math.floor(t / 16);
      if (cyc !== lastCycle) { lastCycle = cyc; seed(); }
      const htot = Math.min(dt, 0.05);
      const sub = Math.max(1, Math.ceil(htot / 0.012));
      for (let s = 0; s < sub; s++) {
        const tt = t - htot + (s + 0.5) * (htot / sub);
        wT = 1.15 + 0.5 * Math.sin(2 * Math.PI * (((tt % 16) + 16) % 16) / 16); // ω(t)：0.65–1.65，恒正
        step(htot / sub);
      }
      wT = 1.15 + 0.5 * Math.sin(2 * Math.PI * ((t % 16) / 16));
      updateEllipse();
      updateCloud();
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
