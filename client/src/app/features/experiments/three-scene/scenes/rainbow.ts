import type { SceneContext, SceneInstance } from '../types';
/** Rainbow（P86）：主虹（一次内反射，~42°）+ 霓/次虹（两次内反射，~50–54°、色序反转）。
 *  主虹：sin²θi=(4−n²)/3，D₁=π+2θi−4θr，虹角=π−D₁。
 *  次虹：sin²θi=(9−n²)/8，D₂=2π+2θi−6θr，霓角=D₂−π（红≈50°在内、紫≈54°在外，色序与主虹相反）。 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);
  const starGeo = new THREE.BufferGeometry();
  const starPts: import('three').Vector3[] = [];
  for (let i = 0; i < 500; i++) starPts.push(new THREE.Vector3((Math.random()-0.5)*200,(Math.random()-0.5)*200,(Math.random()-0.5)*200));
  starGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(starPts.flatMap(v=>[v.x,v.y,v.z])),3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true });
  group.add(new THREE.Points(starGeo, starMat));
  group.add(new THREE.GridHelper(20, 20, 0x334155, 0x1e293b));

  // Raindrop (sphere)
  const dropGeo = new THREE.SphereGeometry(1.5, 32, 32);
  const dropMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.35,
    roughness: 0.0,
    metalness: 0.0
  });
  const raindrop = new THREE.Mesh(dropGeo, dropMat);
  group.add(raindrop);

  // Inner reflection sphere
  const innerGeo = new THREE.SphereGeometry(1.45, 32, 32);
  const innerMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.05 });
  group.add(new THREE.Mesh(innerGeo, innerMat));

  // —— Snell 定律：入射点取球面真实点，按折射率 n 计算主虹（一次内反射）——
  const dropR = 1.5;
  function refractDir(inc: import('three').Vector3, nrm: import('three').Vector3, eta: number): import('three').Vector3 {
    const cosI = -inc.dot(nrm);
    const sin2T = eta * eta * (1 - cosI * cosI);
    const cosT = Math.sqrt(Math.max(0, 1 - sin2T));
    return inc.clone().multiplyScalar(eta).add(nrm.clone().multiplyScalar(eta * cosI - cosT)).normalize();
  }
  function reflectDir(inc: import('three').Vector3, nrm: import('three').Vector3): import('three').Vector3 {
    return inc.clone().sub(nrm.clone().multiplyScalar(2 * inc.dot(nrm))).normalize();
  }
  // 最小偏向：主虹 sin²θi=(4−n²)/3，D=π+2θi−4θr，虹角=π−D（≈42°）
  function rainbowAngles(n: number): { thetaI: number; rainbow: number } {
    const s = Math.sqrt(Math.max(0, (4 - n * n) / 3));
    const thetaI = Math.asin(s);
    const thetaR = Math.asin(s / n);
    const dev = Math.PI + 2 * thetaI - 4 * thetaR;
    return { thetaI, rainbow: Math.PI - dev };
  }
  // 次虹（霓）：k=2 次内反射，sin²θi=(9−n²)/8，D₂=2π+2θi−6θr，霓角=D₂−π（≈50–54°）
  function rainbowAngles2(n: number): { thetaI: number; rainbow: number } {
    const s = Math.sqrt(Math.max(0, (9 - n * n) / 8));
    const thetaI = Math.asin(s);
    const thetaR = Math.asin(s / n);
    const dev = 2 * Math.PI + 2 * thetaI - 6 * thetaR;
    return { thetaI, rainbow: dev - Math.PI };
  }
  // k 次内反射的逐光线 Snell 矢量实算（内部弦共 k+1 条）；pts[0]=入射点，末点=出射延长线端点
  function buildRay(thetaI: number, n: number, k = 1) {
    const nrm = new THREE.Vector3(-Math.cos(thetaI), Math.sin(thetaI), 0);   // 入射点外法线
    const P = nrm.clone().multiplyScalar(dropR);                            // 入射点（真实落在球面上）
    const din = new THREE.Vector3(1, 0, 0);                                 // 日光方向（自左向右）
    let pin = P;
    let d = refractDir(din, nrm, 1 / n);                                    // 折射进入
    const pts: import('three').Vector3[] = [P];
    for (let r = 0; r < k; r++) {
      const pn = pin.clone().add(d.clone().multiplyScalar(-2 * pin.dot(d))); // 球内弦：下一交点
      pts.push(pn);
      d = reflectDir(d, pn.clone().multiplyScalar(1 / dropR));               // 内反射
      pin = pn;
    }
    const pExit = pin.clone().add(d.clone().multiplyScalar(-2 * pin.dot(d))); // 最后一条弦→出射点
    pts.push(pExit);
    const t3 = refractDir(d, pExit.clone().multiplyScalar(1 / dropR).negate(), n);  // 折射出射（水→空气）
    pts.push(pExit.clone().add(t3.clone().multiplyScalar(5)));
    return { P, pts, t3 };
  }

  const spectra = [
    { color: 0xff2020, n: 1.331 }, // 红（n 最小 → 主虹角最大 ≈42°）
    { color: 0xffa000, n: 1.335 },
    { color: 0xffff00, n: 1.338 },
    { color: 0x20d020, n: 1.341 },
    { color: 0x2080ff, n: 1.344 },
    { color: 0x8040ff, n: 1.347 }, // 紫（n 最大 → 主虹角最小 ≈40°）
  ];

  // 入射白光（起点在球外，终点为球面上真实入射点）
  const mainRed = buildRay(rainbowAngles(1.331).thetaI, 1.331);
  const incStart = mainRed.P.clone().add(new THREE.Vector3(-6, 0, 0));
  group.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([incStart, mainRed.P]),
    new THREE.LineBasicMaterial({ color: 0xffffff }),
  ));

  // 各色光的真实折射 → k 次内反射 → 出射路径
  spectra.forEach((sp) => {
    const ray = buildRay(rainbowAngles(sp.n).thetaI, sp.n, 1);
    const seg = (a: import('three').Vector3, b: import('three').Vector3, op = 1) => {
      group.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([a, b]),
        new THREE.LineBasicMaterial({ color: sp.color, transparent: true, opacity: op }),
      ));
    };
    for (let i = 0; i + 1 < ray.pts.length; i++) seg(ray.pts[i], ray.pts[i + 1]);
  });

  // 霓（次虹）：两次内反射的各色光线束（入射点更高，θi≈72°）
  const secWhite = buildRay(rainbowAngles2(1.331).thetaI, 1.331, 2);
  group.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([secWhite.P.clone().add(new THREE.Vector3(-6, 0, 0)), secWhite.P]),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
  ));
  spectra.forEach((sp) => {
    const ray = buildRay(rainbowAngles2(sp.n).thetaI, sp.n, 2);
    const seg = (a: import('three').Vector3, b: import('three').Vector3) => {
      group.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([a, b]),
        new THREE.LineBasicMaterial({ color: sp.color, transparent: true, opacity: 0.55 }),
      ));
    };
    for (let i = 0; i + 1 < ray.pts.length; i++) seg(ray.pts[i], ray.pts[i + 1]);
  });

  // 观察者看到的主虹弧：红在外(≈42°)、紫在内(≈40°)，关于反日轴对称；
  // 霓弧在外圈（红内紫外，色序反转），D₂=2π+2θi−6θr ⇒ 霓角=D₂−π≈50–54°
  const redInfo = rainbowAngles(1.331);
  const vioInfo = rainbowAngles(1.347);
  const secRed = rainbowAngles2(1.331);
  const secVio = rainbowAngles2(1.347);
  const arcR = 6;
  function drawArc(fromA: number, toA: number, mirror: number, cFrom: number, cTo: number, op = 1) {
    const steps = 40;
    for (let i = 0; i < steps; i++) {
      const a0 = fromA + (toA - fromA) * (i / steps);
      const a1 = fromA + (toA - fromA) * ((i + 1) / steps);
      const mix = i / (steps - 1);
      const c = new THREE.Color(cFrom).lerp(new THREE.Color(cTo), mix);
      const p0 = new THREE.Vector3(Math.cos(a0) * arcR, mirror * Math.sin(a0) * arcR, 0);
      const p1 = new THREE.Vector3(Math.cos(a1) * arcR, mirror * Math.sin(a1) * arcR, 0);
      group.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([p0, p1]),
        new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: op }),
      ));
    }
  }
  drawArc(vioInfo.rainbow, redInfo.rainbow, 1, 0x8040ff, 0xff2020);
  drawArc(vioInfo.rainbow, redInfo.rainbow, -1, 0x8040ff, 0xff2020);
  drawArc(secRed.rainbow, secVio.rainbow, 1, 0xff2020, 0x8040ff, 0.55);
  drawArc(secRed.rainbow, secVio.rainbow, -1, 0xff2020, 0x8040ff, 0.55);

  function mkLabel(text: string, color: string, px: number, py: number, scale = 3.2): void {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
    s.scale.set(scale, scale / 8, 1); s.position.set(px, py, 0.3);
    group.add(s);
  }
  mkLabel('主虹 40–42°：紫外红外', '#fbbf24', arcR * Math.cos(0.72) + 0.8, arcR * Math.sin(0.72) + 0.45);
  mkLabel('霓(次虹) ~50–54°：色序反转，红内紫外', '#94a3b8', arcR * Math.cos(0.92) + 0.6, arcR * Math.sin(0.92) + 0.45);

  // 反日轴（虚线）
  const axisLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(arcR, 0, 0)]),
    new THREE.LineDashedMaterial({ color: 0x64748b, dashSize: 0.3, gapSize: 0.2 }),
  );
  axisLine.computeLineDistances();
  group.add(axisLine);

  // —— 信息面板（n 与 42°/51° 读数）——
  const panelCanvas = document.createElement('canvas');
  panelCanvas.width = 420;
  panelCanvas.height = 250;
  const panelCtx = panelCanvas.getContext('2d')!;
  const panelTex = new THREE.CanvasTexture(panelCanvas);
  const panelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 3.10),
    new THREE.MeshBasicMaterial({ map: panelTex, transparent: true }),
  );
  panelMesh.position.set(0, 5.4, 0);
  group.add(panelMesh);
  (function drawPanel() {
    const deg = (r: number) => (r * 180) / Math.PI;
    panelCtx.fillStyle = 'rgba(7,11,20,0.9)';
    panelCtx.fillRect(0, 0, 420, 250);
    panelCtx.fillStyle = '#f8fafc';
    panelCtx.font = 'bold 16px monospace';
    panelCtx.fillText('虹与霓 — Snell 折射 + 一次/二次内反射', 14, 26);
    panelCtx.fillStyle = '#7dd3fc';
    panelCtx.font = '14px monospace';
    panelCtx.fillText('主虹: sin²θi=(4−n²)/3  D₁=π+2θi−4θr  虹角=π−D₁', 14, 56);
    panelCtx.fillText('次虹: sin²θi=(9−n²)/8  D₂=2π+2θi−6θr  霓角=D₂−π', 14, 80);
    panelCtx.fillStyle = '#f59e0b';
    panelCtx.fillText(`红 n=1.331：θi=${deg(redInfo.thetaI).toFixed(1)}° 主虹角=${deg(redInfo.rainbow).toFixed(1)}°`, 14, 108);
    panelCtx.fillStyle = '#a855f7';
    panelCtx.fillText(`紫 n=1.347：主虹角=${deg(vioInfo.rainbow).toFixed(1)}°`, 14, 132);
    panelCtx.fillStyle = '#4ade80';
    panelCtx.fillText(`主虹 ≈ ${deg(redInfo.rainbow).toFixed(1)}°（红在外、紫在内）`, 14, 160);
    panelCtx.fillStyle = '#22d3ee';
    panelCtx.fillText(`霓: 红θi=${deg(secRed.thetaI).toFixed(1)}° → ${deg(secRed.rainbow).toFixed(1)}°  紫 → ${deg(secVio.rainbow).toFixed(1)}°`, 14, 188);
    panelCtx.fillText(`霓 ≈50–54°、二次内反射、更暗，色序反转(红内紫外)`, 14, 212);
    panelTex.needsUpdate = true;
  })();

  // Sun direction indicator
  const sunGeo = new THREE.SphereGeometry(0.5, 16, 16);
  const sunMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 1.0 });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  sun.position.set(-8, 1.3, 0);
  group.add(sun);

  let tAnim = 0;
  return {
    update(t, dt) {
      tAnim += dt;
      raindrop.rotation.y = tAnim * 0.1;
    },
    dispose() {
      group.traverse((obj) => {
        if (obj instanceof THREE.Sprite) {
          const sm = (obj as any).material;
          sm.map?.dispose(); sm.dispose();
        }
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
          (obj as any).geometry?.dispose();
          const mat = (obj as any).material;
          if (Array.isArray(mat)) mat.forEach((m: any) => m.dispose());
          else if(mat) mat.dispose();
        }
      });
      starGeo.dispose(); starMat.dispose();
      panelTex.dispose();
    }
  };
}
