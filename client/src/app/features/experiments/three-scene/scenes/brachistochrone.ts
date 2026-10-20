import type { SceneContext, SceneInstance } from '../types';

/**
 * 最速降线（P07）：质点在重力下从 A 滑到 B，摆线（旋轮线）用时最短。
 * 物理：t = √(a/g)·θ，摆线 x = a(θ − sinθ), 下落 y = a(1 − cosθ)；
 *       对比直线（斜面）与圆弧——同一起终点下摆线明显更快；
 *       要点：先陡后缓，早期获得速度，变分 δ∫ds/v = 0 给出摆线。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [];
  const mats: { dispose(): void }[] = [];
  const texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T) => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T) => { mats.push(m); return m; };

  const starPos = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 200;
  }
  const starGeo = geo(new THREE.BufferGeometry());
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }));
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);
  const grid = new THREE.GridHelper(22, 22, 0x334155, 0x1e293b);
  grid.position.y = -4.6;
  group.add(grid);

  const A = new THREE.Vector3(-5, 2.5, 0);
  const B = new THREE.Vector3(5, -2.5, 0);

  // —— 1) 直线（斜面）——
  const straightGeo = geo(new THREE.BufferGeometry().setFromPoints([A, B]));
  group.add(new THREE.Line(straightGeo, mat(new THREE.LineBasicMaterial({ color: 0x94a3b8 }))));

  // —— 2) 摆线（最速降线）——
  const cyc = solveCycloid(A, B);
  const N = 200;
  const cycPts: import('three').Vector3[] = [];
  if (cyc) {
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * cyc.thEnd;
      cycPts.push(new THREE.Vector3(
        cyc.a * (th - Math.sin(th)) + cyc.x0,
        cyc.y0 - cyc.a * (1 - Math.cos(th)),
        0,
      ));
    }
  } else {
    cycPts.push(A.clone(), B.clone());
  }
  const cycGeo = geo(new THREE.BufferGeometry().setFromPoints(cycPts));
  group.add(new THREE.Line(cycGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e }))));

  // —— 3) 圆弧（次优）——
  const arcPts = arcThrough(THREE, A, B);
  const arcGeo = geo(new THREE.BufferGeometry().setFromPoints(arcPts));
  const arcLine = new THREE.Line(arcGeo, mat(new THREE.LineDashedMaterial({ color: 0xf472b6, gapSize: 0.2, dashSize: 0.28 })));
  arcLine.computeLineDistances();
  group.add(arcLine);

  // —— 端点标记 ——
  const dotGeo = geo(new THREE.SphereGeometry(0.18, 16, 16));
  const dotMat = mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 0.4 }));
  [A, B].forEach((p) => { const m = new THREE.Mesh(dotGeo, dotMat); m.position.copy(p); group.add(m); });
  group.add(label(THREE, geo, mat, 'A', A.x, A.y + 0.75));
  group.add(label(THREE, geo, mat, 'B', B.x, B.y - 0.75));

  // —— 三个赛跑小球 ——
  const racerSpecs: { color: number; pts: import('three').Vector3[]; name: string }[] = [
    { color: 0x22c55e, pts: cycPts, name: '摆线' },
    { color: 0x94a3b8, pts: [A.clone(), B.clone()], name: '直线' },
    { color: 0xf472b6, pts: arcPts, name: '圆弧' },
  ];
  const racers = racerSpecs.map((r) => {
    const m = new THREE.Mesh(
      geo(new THREE.SphereGeometry(0.2, 16, 16)),
      mat(new THREE.MeshStandardMaterial({ color: r.color, emissive: r.color, emissiveIntensity: 0.35 })),
    );
    group.add(m);
    return { pts: r.pts, name: r.name, mesh: m, cum: cumulative(r.pts) };
  });

  // —— 说明面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 720; infoCv.height = 214;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = geo(new THREE.CanvasTexture(infoCv));
  const infoMat = mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false }));
  const infoPlane = new THREE.Mesh(geo(new THREE.PlaneGeometry(8.4, 2.51)), infoMat);
  infoPlane.position.set(0, 5.1, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  ctx.camera.position.set(0, 1.6, 13.5);

  const g0 = 9.81;
  const times = racers.map((r) => travelTime(r.pts, g0));
  let lastPhase = -1;
  let infoDirty = true;

  return {
    update(t) {
      const phase = t % 9;
      if (phase < lastPhase) infoDirty = true;
      lastPhase = phase;

      racers.forEach((r) => {
        const T = times[racers.indexOf(r)];
        const s = phase < T ? slideDistance(r.pts, r.cum, phase, g0) : r.cum[r.cum.length - 1];
        r.mesh.position.copy(pointAt(r.pts, r.cum, s));
        r.mesh.scale.setScalar(phase < T ? 1 : 0.72);
      });

      if (infoDirty || Math.floor(t * 3) % 3 === 0) {
        infoDirty = false;
        drawPanel();
      }
      stars.rotation.y = t * 0.004;
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
      scene.remove(stars);
    },
  };

  function drawPanel(): void {
    infoCtx.clearRect(0, 0, 720, 214);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 712, 206);
    infoCtx.strokeStyle = '#334155';
    infoCtx.lineWidth = 3;
    infoCtx.strokeRect(4, 4, 712, 206);

    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 32px "PingFang SC", sans-serif';
    infoCtx.fillText('最速降线（摆线）  t = √(a/g)·θ', 24, 48);

    infoCtx.font = '30px "PingFang SC", sans-serif';
    const cols = ['#22c55e', '#94a3b8', '#f472b6'];
    racers.forEach((r, i) => {
      infoCtx.fillStyle = cols[i];
      infoCtx.fillText(`${r.name}：${times[i].toFixed(3)} s`, 24 + i * 232, 104);
    });

    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '26px "PingFang SC", sans-serif';
    infoCtx.fillText('同一起终点下摆线用时最短；先陡后缓，早期获得速度', 24, 152);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.fillText('变分法 δ∫ds/v = 0 → 摆线（等时性）', 24, 190);
    infoTex.needsUpdate = true;
  }
}

function cumulative(pts: import('three').Vector3[]): number[] {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  return cum;
}

function pointAt(pts: import('three').Vector3[], cum: number[], s: number): import('three').Vector3 {
  let i = 1;
  while (i < cum.length - 1 && cum[i] < s) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  const u = Math.min(1, Math.max(0, (s - cum[i - 1]) / seg));
  return pts[i - 1].clone().lerp(pts[i], u);
}

/** 按 v = √(2g·Δh) 沿路径积分出该时刻已走弧长 */
function slideDistance(pts: import('three').Vector3[], cum: number[], time: number, gg: number): number {
  const h0 = pts[0].y;
  let s = 0, acc = 0;
  let i = 1;
  while (i < cum.length && acc < time) {
    const mid = (pts[i - 1].y + pts[i].y) / 2;
    const drop = Math.max(1e-4, h0 - mid);
    const v = Math.sqrt(2 * gg * drop);
    const ds = cum[i] - cum[i - 1];
    acc += ds / v;
    s += ds;
    i++;
  }
  return Math.min(s, cum[cum.length - 1]);
}

function travelTime(pts: import('three').Vector3[], gg: number): number {
  const h0 = pts[0].y;
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const mid = (pts[i - 1].y + pts[i].y) / 2;
    const drop = Math.max(1e-4, h0 - mid);
    acc += pts[i].distanceTo(pts[i - 1]) / Math.sqrt(2 * gg * drop);
  }
  return acc;
}

/** 求过 A、B 的下凸摆线参数（a、终点角度）；无解返回 null */
function solveCycloid(A: import('three').Vector3, B: import('three').Vector3) {
  const dx = B.x - A.x;
  const dy = A.y - B.y; // A 高于 B
  if (dy <= 0) return null;
  let best: { a: number; thEnd: number } | null = null;
  let bestErr = Infinity;
  for (let thEnd = 0.35; thEnd <= Math.PI * 1.98; thEnd += 0.01) {
    const rx = thEnd - Math.sin(thEnd);
    const ry = 1 - Math.cos(thEnd);
    if (ry < 1e-6) continue;
    const a = dy / ry;
    const err = Math.abs(a * rx - Math.abs(dx));
    if (err < bestErr) { bestErr = err; best = { a, thEnd }; }
  }
  if (!best) return null;
  return { a: best.a, thEnd: best.thEnd, x0: A.x, y0: A.y };
}

/** 过 A、B 的下凸圆弧（次优对照） */
function arcThrough(
  THREE: typeof import('three'),
  A: import('three').Vector3,
  B: import('three').Vector3,
): import('three').Vector3[] {
  const chord = A.distanceTo(B);
  const R = chord * 1.35;
  const h = Math.sqrt(Math.max(0.01, R * R - (chord / 2) ** 2));
  const mx = (A.x + B.x) / 2;
  const my = (A.y + B.y) / 2;
  const ux = (B.x - A.x) / chord;
  const uy = (B.y - A.y) / chord;
  // 法向量取指向"下方"的一侧，使弧下凸
  const nx = uy, ny = -ux;
  const sign = ny >= 0 ? -1 : 1;
  const cx = mx + nx * h * sign;
  const cy = my + ny * h * sign;
  const a0 = Math.atan2(A.y - cy, A.x - cx);
  let sweep = Math.atan2(B.y - cy, B.x - cx) - a0;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  while (sweep < -Math.PI) sweep += 2 * Math.PI;
  const pts: import('three').Vector3[] = [];
  const steps = 120;
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (sweep * i) / steps;
    pts.push(new THREE.Vector3(cx + R * Math.cos(a), cy + R * Math.sin(a), 0));
  }
  return pts;
}

function label(
  THREE: typeof import('three'),
  geo: <T extends { dispose(): void }>(g: T) => T,
  mat: <T extends { dispose(): void }>(m: T) => T,
  text: string,
  x: number,
  y: number,
): import('three').Sprite {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#fbbf24';
  c.font = 'bold 88px sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, 64, 64);
  const tex = geo(new THREE.CanvasTexture(cv));
  const sp = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })));
  sp.scale.set(0.9, 0.9, 1);
  sp.position.set(x, y, 0);
  sp.renderOrder = 1000;
  return sp;
}
