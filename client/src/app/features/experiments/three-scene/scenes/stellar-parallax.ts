import type { SceneContext, SceneInstance } from '../types';
/**
 * 三角视差测距（P270）：地球公转轨道作 2 AU 基线测恒星光锥。
 * 主控方程：p(") = 1/d(pc)（半年基线 2 AU 对应全位移 2p）；1 pc = 206265 AU = 3.26 ly。
 * 画面位移严格按振幅 ∝ 基线/距离 计算：背景屏上全摆动幅度 = 2·CAMP/d，CAMP 为 1 pc 恒星的视位振幅。
 */
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
    starPos[i * 3] = (Math.random() - 0.5) * 400;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 400;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 400;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // —— 水平面内：地球轨道（左）→ 目标星（中）→ 背景天球屏（右）——
  const ORBIT_R = 1.0;            // 1 AU（世界单位）
  const STAR_X = 3.4;             // 目标星的展示方位（距离沿视线压缩，位移按 1/d 保比例）
  const BG_X = 5.6;               // 背景天球屏
  const CAMP = 2.6;               // 1 pc 恒星的视位振幅（世界单位）——振幅(d) = CAMP/d
  const YEAR = 10;                // 1 年的动画秒数

  // 太阳与地球轨道
  const sun = new THREE.Mesh(geo(new THREE.SphereGeometry(0.18, 16, 16)), mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 1.4 })));
  sun.position.set(0, 0, 0);
  group.add(sun);
  const orbitGeo = geo(new THREE.BufferGeometry());
  {
    const n = 96, pa = new Float32Array((n + 1) * 3);
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      pa[i * 3] = Math.cos(a) * ORBIT_R; pa[i * 3 + 1] = 0; pa[i * 3 + 2] = Math.sin(a) * ORBIT_R;
    }
    orbitGeo.setAttribute('position', new THREE.BufferAttribute(pa, 3));
  }
  group.add(new THREE.LineLoop(orbitGeo, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));
  const earth = new THREE.Mesh(geo(new THREE.SphereGeometry(0.09, 12, 12)), mat(new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x1d4ed8, emissiveIntensity: 0.6 })));
  group.add(earth);

  // 真星（实体）与视星（贴背景屏的标记）
  const trueStar = new THREE.Mesh(geo(new THREE.SphereGeometry(0.14, 14, 14)), mat(new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xf472b6, emissiveIntensity: 1.0 })));
  trueStar.position.set(STAR_X, 0, 0);
  group.add(trueStar);
  const appStar = new THREE.Mesh(geo(new THREE.SphereGeometry(0.1, 12, 12)), mat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 1.3 })));
  appStar.position.set(BG_X - 0.05, 0, 0);
  group.add(appStar);

  // 视差锥：地球两端 → 背景屏交点（全摆动 2p 张角）
  const coneGeo = geo(new THREE.BufferGeometry());
  coneGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4 * 3), 3));
  group.add(new THREE.LineSegments(coneGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.55 }))));
  // 视线：地球 → 真星 → 延伸（每帧更新）
  const losGeo = geo(new THREE.BufferGeometry());
  losGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  group.add(new THREE.Line(losGeo, mat(new THREE.LineBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.35 }))));

  // 背景屏：1 pc 参考摆幅圆 + 刻度
  const circPts: import('three').Vector3[] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    circPts.push(new THREE.Vector3(BG_X, Math.cos(a) * CAMP, Math.sin(a) * CAMP));
  }
  {
    const cg = geo(new THREE.BufferGeometry().setFromPoints(circPts));
    group.add(new THREE.Line(cg, mat(new THREE.LineBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.7 }))));
  }
  const tickGeo = geo(new THREE.BufferGeometry());
  {
    const tp: number[] = [];
    for (let k = -2; k <= 2; k++) {
      const y = k * CAMP;
      tp.push(BG_X, y - 0.1, 0, BG_X, y + 0.1, 0);
    }
    tickGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tp), 3));
  }
  group.add(new THREE.LineSegments(tickGeo, mat(new THREE.LineBasicMaterial({ color: 0x64748b }))));

  // 背景屏网格板（XY 平面朝向地球）
  {
    const bg = new THREE.Mesh(
      geo(new THREE.PlaneGeometry(2.8, 8.2)),
      mat(new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.6, side: THREE.DoubleSide })),
    );
    bg.position.set(BG_X + 0.02, 0, 0);
    bg.rotation.y = Math.PI / 2;
    group.add(bg);
  }

  function makeLabel(text: string, color: string, scale = 3.2): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(scale, scale / 8, 1);
    s.renderOrder = 998;
    return s;
  }
  const lSun = makeLabel('太阳—地球轨道（1 AU）', '#94a3b8', 3.4); lSun.position.set(0, -0.9, 0); group.add(lSun);
  const lTrue = makeLabel('目标近星', '#f472b6', 2.2); lTrue.position.set(STAR_X, 0.75, 0); group.add(lTrue);
  const lBg = makeLabel('背景天球屏（1 pc 参考摆幅圆）', '#a855f7', 3.6); lBg.position.set(BG_X, CAMP + 1.9, 0); group.add(lBg);

  const infoCv = document.createElement('canvas');
  infoCv.width = 512; infoCv.height = 256;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const info = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  info.scale.set(7.4, 3.7, 1);
  info.position.set(1.6, 3.6, 0);
  info.renderOrder = 999;
  group.add(info);

  let dist = 5;      // 秒差距（扫描变量）
  let earthA = 0;    // 地球轨道相位

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 512, 256);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)';
    infoCtx.fillRect(3, 3, 506, 250);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3;
    infoCtx.strokeRect(3, 3, 506, 250);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText('三角视差测距', 14, 36);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '21px "PingFang SC", sans-serif';
    infoCtx.fillText('p(") = 1/d(pc)   基线 = 2 AU(半年)', 14, 72);
    infoCtx.fillText('1 pc = 206265 AU = 3.26 ly', 14, 100);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('视差角与距离成反比 —— 直接几何量纲', 14, 128);
    infoCtx.fillText('盖亚 σ_p≈0.02 mas ⇒ 精度测到千秒差距', 14, 156);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 20px "PingFang SC", sans-serif';
    const p = 1 / dist;
    infoCtx.fillText(`读数: d=${dist.toFixed(1)} pc (${(dist * 3.26).toFixed(1)}光年)`, 14, 190);
    infoCtx.fillText(`p=${(p * 1000).toFixed(1)} mas  全摆2p=${(2 * p * 1000).toFixed(1)}mas 幅${((2 * CAMP / dist)).toFixed(2)}`, 14, 220);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  return {
    update(t, dt) {
      // 16 s 周期：距离 d 从 2 pc 扫到 24 pc —— 摆幅按 1/d 缩小
      const cycle = (t % 16) / 16;
      dist = 2 + 22 * (0.5 - 0.5 * Math.cos(Math.PI * 2 * cycle));
      earthA = (t % YEAR) / YEAR * Math.PI * 2;
      const ez = Math.sin(earthA) * ORBIT_R, ex = Math.cos(earthA) * ORBIT_R;
      earth.position.set(ex, 0, ez);

      // 视差摆动沿 z（与地球运动方向一致，反相）：振幅 ∝ 1/d
      const swing = (CAMP / dist) * Math.sin(earthA + Math.PI); // 视差与地球反向
      appStar.position.set(BG_X - 0.05, 0, swing);

      // 视差锥：星顶到半年基线两端对应的背景屏 ±p 全摆角
      const amp = CAMP / dist;
      const ca = coneGeo.attributes['position'] as import('three').BufferAttribute;
      const cp = ca.array as Float32Array;
      cp[0] = STAR_X; cp[1] = 0; cp[2] = 0; cp[3] = BG_X; cp[4] = 0; cp[5] = amp;
      cp[6] = STAR_X; cp[7] = 0; cp[8] = 0; cp[9] = BG_X; cp[10] = 0; cp[11] = -amp;
      ca.needsUpdate = true;

      const la = losGeo.attributes['position'] as import('three').BufferAttribute;
      const lp = la.array as Float32Array;
      lp[0] = ex; lp[1] = 0; lp[2] = ez;
      lp[3] = BG_X; lp[4] = 0; lp[5] = swing;
      la.needsUpdate = true;

      trueStar.position.x = STAR_X;
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
