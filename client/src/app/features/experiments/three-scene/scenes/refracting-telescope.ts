import type { SceneContext, SceneInstance } from '../types';
/**
 * 折射望远镜（P261，Kepler 开普勒式）—— 主控方程：
 *   薄透镜成像  1/s + 1/s′ = 1/f ；无穷远物 ⇒ 实像成在后焦面 s′=f
 *   透镜制造者  1/f = (n−1)(1/R₁ − 1/R₂)  ⇒  f ∝ 1/(n−1)
 *   角放大率    M = f_obj/f_eye
 *   色  差      n(λ)=A+B/λ²（柯西），蓝光 n 大 ⇒ f_B<f_R ⇒ 焦点纵向分离 Δf ≈ f/V（V=阿贝数）
 * 物镜把平行光折成焦面实像、目镜再准直出射（两段共轭光锥）；扫描自变量为波长 λ（450→650 nm）：
 * 焦距随 n(λ) 移动、探测器面弥散斑半径与 R/G/B 三焦点分离全部由同一柯西模型计算。
 * 注：光线图把纵向色差位移按固定增益放大以便观察；趋势(f_B<f_R)与放大率/阿贝数由公式原值给出。
 */
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
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  grid.position.y = -2.6; group.add(grid);

  // —— 光学参数 ——
  const A = 1.5046, B = 0.00420;                 // 柯西（λ 以 µm 计，BK7 冕牌：n_D=1.5168、V≈64）
  const nOf = (lamNm: number) => { const l = lamNm / 1000; return A + B / (l * l); };
  const ND = nOf(587.6);
  const NC = nOf(656.3), NF = nOf(486.1);
  const V_ABBE = (ND - 1) / (NF - NC);           // 阿贝数（≈ 实值 64）
  const F_OBJ_MM = 1000, F_EYE_MM = 25;
  const MAG = F_OBJ_MM / F_EYE_MM;               // 40×
  const dfLCA_MM = F_OBJ_MM * (1 / (NC - 1) - 1 / (NF - 1)) / (1 / (ND - 1));  // 纵向色差(红-蓝) 实际 mm

  const OBJ_X = -1.6, EYE_X = 2.9, F_WORLD = 3.3;   // 物镜到焦面世界距离
  const DET_X = OBJ_X + F_WORLD;                    // 探测器（设计焦面）
  const AP = 0.95;                                  // 物镜孔径半径（世界）
  const CA_GAIN = 7;                               // 色差几何放大（仅用于可视化位移）

  // —— 光轴 ——
  const axisGeo = geo(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-5.2, 0, 0), new THREE.Vector3(6.6, 0, 0)]));
  group.add(new THREE.Line(axisGeo, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));

  // —— 物镜 / 目镜（扁椭球近似双凸透镜）——
  const lensGeo = geo(new THREE.SphereGeometry(1, 28, 20));
  const objMat = mat(new THREE.MeshStandardMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.4, roughness: 0.1, metalness: 0.1 }));
  const objLens = new THREE.Mesh(lensGeo, objMat); objLens.position.set(OBJ_X, 0, 0); objLens.scale.set(0.18, AP, AP); group.add(objLens);
  const eyeLens = new THREE.Mesh(lensGeo, objMat); eyeLens.position.set(EYE_X, 0, 0); eyeLens.scale.set(0.12, 0.42, 0.42); group.add(eyeLens);

  // 镜筒
  const tubeGeo = geo(new THREE.CylinderGeometry(AP + 0.15, AP + 0.15, EYE_X - OBJ_X, 28, 1, true));
  const tube = new THREE.Mesh(tubeGeo, mat(new THREE.MeshStandardMaterial({ color: 0x1e293b, transparent: true, opacity: 0.18, side: THREE.DoubleSide })));
  tube.rotation.z = Math.PI / 2; tube.position.set((OBJ_X + EYE_X) / 2, 0, 0); group.add(tube);

  // —— 探测器焦面（竖直薄框）+ 弥散斑环 ——
  const detGeo = geo(new THREE.PlaneGeometry(0.08, 1.6));
  const det = new THREE.Mesh(detGeo, mat(new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.5 })));
  det.position.set(DET_X, 0, 0); det.rotation.y = Math.PI / 2; group.add(det);
  const blurGeo = geo(new THREE.TorusGeometry(1, 0.05, 8, 32));
  const blurMat = mat(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
  const blur = new THREE.Mesh(blurGeo, blurMat); blur.rotation.y = Math.PI / 2; blur.position.set(DET_X, 0, 0); group.add(blur);

  // —— 当前 λ 的光锥（入射平行段 + 会聚到焦点 + 经目镜出射平行），折线 Line ——
  const RAY_H = [0.85, 0.5, 0, -0.5, -0.85];
  const RAYS_PER = 5;         // 每束：入→焦→出
  const bundleGeo = geo(new THREE.BufferGeometry());
  bundleGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAY_H.length * 4 * 3), 3));
  const bundleLine = new THREE.LineSegments(bundleGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee })));
  group.add(bundleLine);
  const foci = new THREE.Mesh(geo(new THREE.SphereGeometry(0.12, 12, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  group.add(foci);

  // —— R/G/B 三色固定参考焦点（演示纵向分离）——
  const refMat = mat(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9 }));
  const refGeo = geo(new THREE.SphereGeometry(0.09, 10, 10));
  const refs: { m: import('three').Mesh; lam: number; col: number }[] = [];
  [[656.3, 0xef4444], [546.1, 0x22c55e], [486.1, 0x3b82f6]].forEach(([lam, col]) => {
    const m = new THREE.Mesh(refGeo, refMat.clone()); m.material.color.setHex(col); group.add(m); refs.push({ m, lam, col });
  });

  function lamColor(nm: number): number {
    const hue = (nm < 450 ? 0.66 : nm > 650 ? 0.0 : (650 - nm) / 650 * 0.66);
    const c = new THREE.Color().setHSL(hue, 0.9, 0.55);
    return c.getHex();
  }
  const fWorld = (lam: number) => F_WORLD * (ND - 1) / (nOf(lam) - 1);

  // —— 标签 ——
  function makeLabel(text: string, color: string, scale = 3): import('three').Sprite {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 24px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1); return s;
  }
  const lObj = makeLabel('物镜 f_obj', '#93c5fd', 2.4); lObj.position.set(OBJ_X, 1.4, 0); group.add(lObj);
  const lEye = makeLabel('目镜 f_eye', '#93c5fd', 2.2); lEye.position.set(EYE_X, 0.9, 0); group.add(lEye);
  const lDet = makeLabel('焦面/色差弥散斑', '#fbbf24', 2.8); lDet.position.set(DET_X, -1.3, 0); group.add(lDet);

  // —— 信息面板 ——
  const infoCv = document.createElement('canvas'); infoCv.width = 880; infoCv.height = 300;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoSprite = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  infoSprite.position.set(0, 4.4, 0); infoSprite.scale.set(10, 3.4, 1); infoSprite.renderOrder = 999;
  group.add(infoSprite);

  let lam = 546, n = ND, fmm = F_OBJ_MM, blurR = 0;
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 880, 300);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(4, 4, 872, 292);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 872, 292);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    infoCtx.fillText('折射望远镜（开普勒式）— 成像 & 色差', 20, 36);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('1/s+1/s′=1/f   M=f_obj/f_eye   1/f=(n−1)(1/R₁−1/R₂)', 20, 72);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText(`柯西 n(λ)=A+B/λ² ⇒ f∝1/(n−1)：蓝 n 大、f 短 ⇒ 焦点靠前（Δf≈f/V）`, 20, 106);
    infoCtx.fillStyle = '#22c55e';
    infoCtx.fillText(`物镜 f=${F_OBJ_MM}mm · 目镜 f=${F_EYE_MM}mm ⇒ 放大率 M=${MAG.toFixed(0)}×  ·  阿贝数 V=${V_ABBE.toFixed(0)}`, 20, 140);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 22px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：λ=${lam.toFixed(0)}nm  n=${n.toFixed(4)}  f(λ)=${fmm.toFixed(1)}mm  焦面弥散斑 r=${(blurR * 10).toFixed(2)}mm  Δf(R-B)=${dfLCA_MM.toFixed(1)}mm`, 20, 184);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '20px "PingFang SC", sans-serif';
    infoCtx.fillText('扫描波长：焦点沿轴移动(R/G/B 三球为纵向分离)；斑径=|Δf|·孔径/焦距', 20, 222);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  return {
    update(t, dt) {
      // 扫描波长 450→650 nm（周期 16 s 往返）
      const cycle = (t % 16) / 16;
      lam = 550 + Math.sin(cycle * Math.PI * 2) * 100;   // 450..650
      n = nOf(lam);
      const fw = fWorld(lam);
      const focalX = OBJ_X + fw + (fw - F_WORLD) * (CA_GAIN - 1);   // 放大纵向位移（可视化）
      const col = lamColor(lam);
      (bundleLine.material as import('three').LineBasicMaterial).color.setHex(col);
      (foci.material as import('three').MeshBasicMaterial).color.setHex(col);
      foci.position.set(focalX, 0, 0);

      // 光锥折线：入射平行(−5.2→OBJ_X @h) ; 物镜→焦点; 焦点→目镜@h′ ; 目镜出射平行
      const arr = bundleGeo.attributes['position'].array as Float32Array;
      let w = 0;
      const push = (x: number, y: number) => { arr[w * 3] = x; arr[w * 3 + 1] = y; arr[w * 3 + 2] = 0; w++; };
      for (const h of RAY_H) {
        const slope = (0 - h) / (focalX - OBJ_X);
        const hEye = slope * (EYE_X - focalX);
        push(-5.2, h); push(OBJ_X, h);
        push(OBJ_X, h); push(focalX, 0);
        push(focalX, 0); push(EYE_X, hEye);
        push(EYE_X, hEye); push(6.4, hEye);
      }
      bundleGeo.attributes['position'].needsUpdate = true;

      // 弥散斑半径 = |focalX - DET_X|·AP/|focalX-OBJ_X|
      blurR = Math.abs(focalX - DET_X) * AP / Math.max(0.2, Math.abs(focalX - OBJ_X));
      blur.scale.set(0.2 + blurR, 0.2 + blurR, 1);
      blurMat.color.setHex(col);

      // 三色参考焦点
      for (const rr of refs) {
        const fwx = fWorld(rr.lam);
        const fx = OBJ_X + fwx + (fwx - F_WORLD) * (CA_GAIN - 1);
        rr.m.position.set(fx, 0.0, 0);
      }

      // 出射锥的放大目镜角度（示意角放大）
      eyeLens.scale.set(0.12 + 0.01 * Math.sin(t * 2), 0.42, 0.42);
      fmm = F_OBJ_MM * (ND - 1) / (n - 1);

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
