import type { SceneContext, SceneInstance } from '../types';
/** 相对论多普勒（P130）：主控方程 ν_obs = ν₀ / [γ(1−β·cosθ)]，γ=(1−β²)^(-1/2)（θ=0 迎面蓝移、θ=90° 纯横向红移 1/γ）。
 *  光源逐周期发射球面波前，发射周期在接收系中为 γτ₀（时间膨胀）：第 i 个波前圆心后退 β·a、半径 a
 *  ⇒ 前方间距 γ(1−β)λ₀ = √((1−β)/(1+β))·λ₀、后方 γ(1+β)λ₀ —— 图形与 ν_obs 公式同源，不是经典 (1∓β)。
 *   aberration 集束半角 sinθ_c = 1/γ：β→1 时全部辐射压进前方"探照灯"锥。 */
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
  const NR = 13;          // 波前数
  const TAU = 0.62;       // 发射周期（c=1 单位/s，画面尺度）
  const RMAX = NR * TAU;  // 最老波前半径（单位）
  const SC = 0.72;        // 世界尺度系数

  // —— 波前圆环（x–y 平面）：每个独立材质控制淡出 ——
  const SEG = 56;
  const rings: { geo: import('three').BufferGeometry; arr: Float32Array; mat: import('three').LineBasicMaterial }[] = [];
  for (let k = 0; k < NR; k++) {
    const g = geo(new THREE.BufferGeometry());
    const arr = new Float32Array((SEG + 1) * 3);
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const m = mat(new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.7 }));
    group.add(new THREE.Line(g, m));
    rings.push({ geo: g, arr, mat: m });
  }

  // —— 光源、观察者、集束锥、视线 ——
  const src = new THREE.Mesh(geo(new THREE.SphereGeometry(0.17, 14, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  group.add(src);
  const obs = new THREE.Mesh(geo(new THREE.SphereGeometry(0.26, 14, 12)), mat(new THREE.MeshBasicMaterial({ color: 0x22c55e })));
  group.add(obs);
  const losGeo = geo(new THREE.BufferGeometry());
  losGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  group.add(new THREE.Line(losGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.6 }))));
  const coneGeo = geo(new THREE.BufferGeometry());
  coneGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  group.add(new THREE.Line(coneGeo, mat(new THREE.LineBasicMaterial({ color: 0xf472b6 }))));

  const lbBeam = (() => {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#f472b6';
    c.font = 'bold 28px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('集束锥 sinθc = 1/γ（相对论头灯效应）', 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(4.4, 4.4 / 8, 1);
    s.position.set(2.2, 2.9, 0);
    return s;
  })();
  group.add(lbBeam);

  // —— 面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 800; infoCv.height = 236;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(8.8, 2.6)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 5.7, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  let beta = 0, gamma = 1, thetaDeg = 0, doppler = 1, beamDeg = 90;

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 800, 236);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 792, 228);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 792, 228);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 29px "PingFang SC", sans-serif';
    infoCtx.fillText('相对论多普勒 —— 波前包络、集束与横向频移', 22, 42);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '27px "PingFang SC", sans-serif';
    infoCtx.fillText('ν_obs = ν₀ / [γ(1−β·cosθ)]，γ = 1/√(1−β²)', 22, 82);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText(`波前间距（含 γ）：前 γ(1−β)λ₀ = ${(gamma * (1 - beta)).toFixed(3)}λ₀   后 γ(1+β)λ₀ = ${(gamma * (1 + beta)).toFixed(2)}λ₀   θc = ${beamDeg.toFixed(1)}°`, 22, 122);
    infoCtx.fillStyle = doppler >= 1 ? '#fbbf24' : '#ef4444';
    infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：β = ${beta.toFixed(3)}  γ = ${gamma.toFixed(2)}  θ = ${thetaDeg.toFixed(0)}°  ν_obs/ν₀ = ${doppler.toFixed(3)} ${doppler > 1.005 ? '（蓝移）' : doppler < 0.995 ? '（红移）' : ''}`,
      22, 168,
    );
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '24px "PingFang SC", sans-serif';
    infoCtx.fillText('θ=90° 时仍有纯横向红移 1/γ —— 星系红移与 Ives–Stilwell 实验的底座', 22, 206);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  const c = Math.cos, s = Math.sin;

  return {
    update(t, dt) {
      // 扫描 β：0→0.90→0，16s；视线角 θ 独立扫描（11s）
      // β 上限取 0.90（γ=2.29）：发射周期 γτ₀ 若再大，视场内可见波前数 NR/γ 太少，图形退化
      const ph = (t % 16) / 16;
      beta = 0.9 * (0.5 - 0.5 * c(TWO_PI * ph));
      gamma = 1 / Math.sqrt(Math.max(1e-6, 1 - beta * beta));
      thetaDeg = 180 * (0.5 - 0.5 * c(TWO_PI * ((t % 11) / 11)));
      const theta = (thetaDeg / 57.2958);

      // 波前：接收系中发射周期为 γ·τ₀（时间膨胀），龄 a_i = phase + i·γτ₀；圆心 x=−β·a、半径 a
      // ⇒ 前方间距 = γ(1−β)λ₀ = √((1−β)/(1+β))·λ₀，与面板 ν_obs 公式完全一致
      const tEmit = TAU * gamma;
      const baseAge = t % tEmit;
      for (let k = 0; k < NR; k++) {
        const a = baseAge + k * tEmit; // 龄（单位）
        if (a > RMAX) { rings[k].mat.opacity = 0; continue; }   // 超出视场的老波前隐藏
        const rr = a * SC;
        const cx = -beta * a * SC;
        const arr = rings[k].arr;
        for (let j = 0; j <= SEG; j++) {
          const ang = (j / SEG) * TWO_PI;
          arr[j * 3] = cx + rr * c(ang);
          arr[j * 3 + 1] = rr * s(ang);
          arr[j * 3 + 2] = 0;
        }
        rings[k].geo.attributes['position'].needsUpdate = true;
        rings[k].mat.opacity = 0.85 * (1 - a / (RMAX * 1.05));
        // 前方波前更"蓝"：色相随压缩比偏移
        const comp = 1 / Math.max(0.05, 1 - beta);
        rings[k].mat.color.setHSL(0.5 - 0.13 * Math.min(3, comp) * 0.33, 0.8, 0.55);
      }

      // 光源在原点（随动系）；观察者按瞬时视线角放置
      src.position.set(0, 0, 0);
      const od = 5.2;
      obs.position.set(od * c(theta), od * s(theta), 0);
      const lp = losGeo.attributes['position'] as import('three').BufferAttribute;
      const la = lp.array as Float32Array;
      la[0] = 0; la[1] = 0; la[2] = 0;
      la[3] = obs.position.x; la[4] = obs.position.y; la[5] = 0;
      lp.needsUpdate = true;
      doppler = 1 / (gamma * (1 - beta * c(theta)));

      // 集束锥（+x 方向，半角 asin(1/γ)）
      beamDeg = (Math.asin(Math.min(1, 1 / gamma)) * 57.2958);
      const cp = coneGeo.attributes['position'] as import('three').BufferAttribute;
      const ca2 = cp.array as Float32Array;
      const bc = Math.asin(Math.min(1, 1 / gamma));
      ca2[0] = 0; ca2[1] = 0; ca2[2] = 0;
      ca2[3] = od * Math.cos(bc); ca2[4] = od * Math.sin(bc); ca2[5] = 0;
      ca2[6] = od * Math.cos(bc); ca2[7] = -od * Math.sin(bc); ca2[8] = 0;
      cp.needsUpdate = true;
      lbBeam.position.set(3.4, 0.6, 0);

      src.material instanceof THREE.MeshBasicMaterial && src.material.color.setHSL(
        0.08 + 0.5 * Math.min(1, (doppler - 1) / 3), 0.8, 0.55,
      );

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
