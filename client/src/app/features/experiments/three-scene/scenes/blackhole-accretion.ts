import type { SceneContext, SceneInstance } from '../types';

/**
 * 黑洞与吸积盘：事件视界（黑球）+ 光子环 + 开普勒差速旋转的吸积盘粒子。
 * 物理：内圈角速度 ∝ r^(-3/2)（开普勒第三定律）；盘内缘落在 ISCO = 6M。
 * 多普勒增亮：盘物质轨道运动，朝向观测者一侧 δ>1（更亮、蓝移），背离侧 δ<1（更暗、红移）。
 * 世界单位与引力单位 M 通过 RG 统一标定，面板读数与几何同源。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  // —— 资源登记，dispose 时统一释放 ——
  const geos: { dispose(): void }[] = [];
  const mats: { dispose(): void }[] = [];
  const texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  // —— 引力标度：1 个引力质量单位 M（=GM/c²）对应的世界单位长度 ——
  const RG = 0.5;
  const R_HORIZON = 2 * RG;   // 事件视界（史瓦西）r_s = 2M
  const R_PHOTON = 3 * RG;    // 光子球/光子环 r = 3M
  const R_ISCO = 6 * RG;      // 最内稳定圆轨道 ISCO = 6M
  const R_DISK_OUT = 12 * RG; // 盘外缘 ~12M
  const DISK_TILT = 0.32;     // 展示盘面用的倾角（rad）

  // 事件视界
  const horizon = new THREE.Mesh(
    geo(new THREE.SphereGeometry(R_HORIZON, 48, 48)),
    mat(new THREE.MeshBasicMaterial({ color: 0x000000 })),
  );
  group.add(horizon);

  // 光子环（光子球 r=3M）
  const photonRing = new THREE.Mesh(
    geo(new THREE.TorusGeometry(R_PHOTON, 0.035, 12, 128)),
    mat(new THREE.MeshBasicMaterial({ color: 0xffcf7a })),
  );
  photonRing.rotation.x = Math.PI / 2;
  group.add(photonRing);

  // 吸积盘粒子（环带 r∈ISCO~外缘，内缘恰落在 6M）
  const N = 2600;
  const radii = new Float32Array(N);
  const angles = new Float32Array(N);
  const speeds = new Float32Array(N);
  const positions = new Float32Array(N * 3);
  const colors = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
  // 三色温标（热-中-冷），按半径等效温度内橙外红
  const HOT = [1.0, 0.69, 0.4];     // 0xffb066
  const MID = [1.0, 0.42, 0.24];    // 0xff6a3d
  const COOL = [0.54, 0.17, 0.11];  // 0x8a2c1c
  const BAND = R_DISK_OUT - R_ISCO;
  for (let i = 0; i < N; i++) {
    const rr = R_ISCO + Math.pow(Math.random(), 0.8) * BAND;
    radii[i] = rr;
    angles[i] = Math.random() * Math.PI * 2;
    speeds[i] = 1.6 / Math.pow(rr, 1.5); // 开普勒角速度 ∝ r^{-3/2}
    positions[i * 3] = rr * Math.cos(angles[i]);
    positions[i * 3 + 1] = (Math.random() - 0.5) * 0.14 * (rr - R_ISCO * 0.8);
    positions[i * 3 + 2] = rr * Math.sin(angles[i]);
  }
  const pGeo = geo(new THREE.BufferGeometry());
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pGeo.setAttribute('color', colors);
  const points = new THREE.Points(
    pGeo,
    mat(new THREE.PointsMaterial({ size: 0.075, vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })),
  );
  points.rotation.x = DISK_TILT; // 轻微倾斜展示盘面
  group.add(points);

  // ISCO 半径标记环（画面可见的最内稳定圆轨道，与宣称 ISCO=6M 同尺度）
  const iscoRing = new THREE.Mesh(
    geo(new THREE.TorusGeometry(R_ISCO, 0.02, 10, 160)),
    mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85 })),
  );
  iscoRing.rotation.x = Math.PI / 2 + DISK_TILT;
  group.add(iscoRing);

  // 盘面薄环网格（增强结构感，覆盖盘带宽）
  const ring = new THREE.Mesh(
    geo(new THREE.TorusGeometry((R_ISCO + R_DISK_OUT) / 2, BAND / 2, 8, 96)),
    mat(new THREE.MeshBasicMaterial({ color: 0x993311, wireframe: true, transparent: true, opacity: 0.16 })),
  );
  ring.rotation.x = Math.PI / 2 + DISK_TILT;
  group.add(ring);

  // 透镜化背景星点
  const starN = 700;
  const starPos = new Float32Array(starN * 3);
  for (let i = 0; i < starN; i++) {
    const r = 60 + Math.random() * 260;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    starPos[i * 3 + 1] = r * Math.cos(ph);
    starPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const starGeo = geo(new THREE.BufferGeometry());
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xaabbdd, size: 0.5, sizeAttenuation: true })));
  scene.add(stars);

  // 多普勒量（内缘 ISCO=6M 处轨道最快、增亮最强，作为读数基准）：
  const bIn = Math.sqrt(1 / (R_ISCO / RG - 2));         // v/c = √(M/(r-2M))，ISCO 处 = 0.5
  const gIn = 1 / Math.sqrt(1 - bIn * bIn);
  const deltaAppr = 1 / (gIn * (1 - bIn));              // 朝向侧 δ>1
  const deltaRec = 1 / (gIn * (1 + bIn));               // 背离侧 δ<1
  const BEAM_N = 3.2;                                   // 增亮指数 亮度 ∝ δ^n
  const deltaNorm = 1 / (gIn * gIn);                    // δ²/γ² 归一因子，使 δ=1 时 f=1
  const ratio = Math.pow(deltaAppr / deltaRec, BEAM_N); // 朝向/背离侧明暗对比

  // ===== 面板：ISCO、温度标度、多普勒增亮（读数与几何同源，5Hz 刷新）=====
  const infoCv = document.createElement('canvas'); infoCv.width = 760; infoCv.height = 220;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const panel = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  panel.scale.set(7.6, (7.6 * 220) / 760, 1); panel.position.set(0, 6.5, 0); panel.renderOrder = 999;
  group.add(panel);

  function drawInfo(incl: number): void {
    infoCtx.clearRect(0, 0, 760, 220);
    infoCtx.fillStyle = 'rgba(7,11,20,0.86)'; infoCtx.fillRect(0, 0, 760, 220);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 2; infoCtx.strokeRect(0, 0, 760, 220);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 22px "PingFang SC", sans-serif';
    infoCtx.fillText('黑洞吸积盘（史瓦西）', 20, 34);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = '19px "PingFang SC", sans-serif';
    infoCtx.fillText('ISCO = 6M = 3·R_s（R_s=2M）：盘内缘落于此，青色环标出 6M', 20, 62);
    infoCtx.fillText('开普勒差速 ω ∝ r^(-3/2)，内快外慢（盘带 6M~12M）', 20, 86);
    infoCtx.fillText('温度标度 T ∝ r^(-3/4)：内橙热 → 外红冷', 20, 110);
    infoCtx.fillText('多普勒增亮：δ=1/[γ(1−β·cosθ)]，朝向观测者一侧更亮', 20, 134);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '15px "PingFang SC", sans-serif';
    infoCtx.fillText('单位换算：1M=' + RG.toFixed(2) + ' 世界单位（视界 2M、光子环 3M 同尺度）', 20, 160);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = 'bold 16px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：内缘 β=${bIn.toFixed(2)}c  δ(朝向)=${deltaAppr.toFixed(2)}>1  δ(背离)=${deltaRec.toFixed(2)}<1  明暗比≈${ratio.toFixed(0)}×`,
      20, 186,
    );
    infoCtx.fillText(
      `轨道局域速度 v=√(M/(r−2M))；视线投影 θ_obs≈${(incl * 57.2958).toFixed(0)}°  δⁿ定亮度·蓝红移`,
      20, 208,
    );
    infoTex.needsUpdate = true;
  }

  // 每帧依据粒子方位与观测者朝向重算多普勒亮度/色移（几何与读数同源，随动画动态涌现）
  function applyBeaming(thetaObs: number): void {
    const ca = colors.array as Float32Array;
    for (let i = 0; i < N; i++) {
      const rr = radii[i];
      const b = Math.sqrt(1 / (rr / RG - 2 + 1e-6));   // v/c = √(M/(r-2M))
      const g = 1 / Math.sqrt(1 - b * b);
      const blost = b * Math.sin(thetaObs - angles[i]); // 速度沿视线分量（>0 朝向观测者）
      const delta = 1 / (g * (1 - blost));
      // 温度色（按半径）→ 多普勒蓝/红移 → 增亮 δⁿ
      const frac = (rr - R_ISCO) / BAND;
      let cr: number, cg: number, cb: number;
      if (frac < 0.5) {
        const k = frac * 2; cr = HOT[0] + (MID[0] - HOT[0]) * k; cg = HOT[1] + (MID[1] - HOT[1]) * k; cb = HOT[2] + (MID[2] - HOT[2]) * k;
      } else {
        const k = (frac - 0.5) * 2; cr = MID[0] + (COOL[0] - MID[0]) * k; cg = MID[1] + (COOL[1] - MID[1]) * k; cb = MID[2] + (COOL[2] - MID[2]) * k;
      }
      const s = (delta - 1) * 0.55; // 蓝移/红移：朝向增蓝减红，背离反之
      const f = Math.min(2.3, Math.max(0.25, Math.pow(delta, BEAM_N) / deltaNorm));
      const ia = i * 3;
      ca[ia] = Math.max(0, (cr - s * 0.4) * f);
      ca[ia + 1] = Math.max(0, cg * f);
      ca[ia + 2] = Math.max(0, (cb + s * 0.7) * f);
    }
    colors.needsUpdate = true;
  }

  const sRX = Math.sin(DISK_TILT);
  const cRX = Math.cos(DISK_TILT);
  function observerAzimuth(): number {
    // 相机（观测者）方向旋回盘面局部 x-z 平面，得到视线投影方位 θ_obs
    const cam = ctx.camera.position;
    const lz = -cam.y * sRX + cam.z * cRX;
    return Math.atan2(lz, cam.x);
  }

  ctx.camera.position.set(0, 5.5, 12);

  const thetaObs0 = observerAzimuth();
  applyBeaming(thetaObs0);
  drawInfo(DISK_TILT);

  return {
    update(t, dt) {
      for (let i = 0; i < N; i++) {
        angles[i] += speeds[i] * dt * 6;
        positions[i * 3] = radii[i] * Math.cos(angles[i]);
        positions[i * 3 + 2] = radii[i] * Math.sin(angles[i]);
      }
      (pGeo.attributes['position'] as import('three').BufferAttribute).needsUpdate = true;
      // 观测者朝向随相机（可被 OrbitControls 移动）变化，多普勒图样随之重算
      applyBeaming(observerAzimuth());
      photonRing.rotation.z = t * 0.6;
      stars.rotation.y = t * 0.01;
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo(DISK_TILT);
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
      scene.remove(stars);
    },
  };
}
