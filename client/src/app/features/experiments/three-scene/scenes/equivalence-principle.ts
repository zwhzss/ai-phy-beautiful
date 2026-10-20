import type { SceneContext, SceneInstance } from '../types';

/**
 * 等效原理（P137）：爱因斯坦电梯——局域惯性系与均匀引力场不可分辨。
 * 物理：a = g 的加速电梯内，自由小球相对电梯的运动，与静止于引力场 g
 *       的电梯内完全一致 ⇒ m_g = m_i（弱等效原理），
 *       进而可推出光线弯曲与引力红移。
 * 画面上方：加速电梯（无引力，箱以 a↑ 加速）；
 * 画面下方：静止电梯（处于引力场 g↓）；两箱内小球轨迹逐帧重合。
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
  group.add(new THREE.GridHelper(26, 26, 0x334155, 0x1e293b));

  const BOX_W = 3.2, BOX_H = 3.4, FLOOR_Y = -1.7;

  /** 造一个"电梯"：框架 + 地板 + 自由小球 + 等效场箭头 + 拖尾 */
  function makeElevator(yOff: number, color: number) {
    const sub = new THREE.Group();
    sub.position.y = yOff;
    group.add(sub);

    const boxGeo = geo(new THREE.BoxGeometry(BOX_W, BOX_H, BOX_W));
    const boxMat = mat(new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.55 }));
    sub.add(new THREE.Mesh(boxGeo, boxMat));

    const floorGeo = geo(new THREE.BoxGeometry(BOX_W, 0.1, BOX_W));
    const floorMat = mat(new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.3, roughness: 0.7 }));
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = FLOOR_Y + 0.05;
    sub.add(floor);

    const ball = new THREE.Mesh(
      geo(new THREE.SphereGeometry(0.24, 20, 20)),
      mat(new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xdb2777, emissiveIntensity: 0.4 })),
    );
    sub.add(ball);

    // 等效"向下"场（惯性力 / 引力）
    const arrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(BOX_W * 0.34, FLOOR_Y + BOX_H * 0.42, 0),
      BOX_H * 0.72,
      color,
      0.3, 0.15,
    );
    sub.add(arrow);

    const tickMat = mat(new THREE.LineBasicMaterial({ color: 0x475569 }));
    for (let i = 1; i < 6; i++) {
      const y = FLOOR_Y + (BOX_H * i) / 6;
      const g2 = geo(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-BOX_W / 2, y, BOX_W / 2),
        new THREE.Vector3(-BOX_W / 2 + 0.5, y, BOX_W / 2),
      ]));
      sub.add(new THREE.Line(g2, tickMat));
    }

    const TRAIL = 90;
    const trailGeo = geo(new THREE.BufferGeometry());
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
    sub.add(new THREE.Points(trailGeo, mat(new THREE.PointsMaterial({
      color: 0xf472b6, size: 0.11, transparent: true, opacity: 0.75,
    }))));

    return { sub, ball, arrow, trailGeo, trailN: TRAIL, head: 0 };
  }

  const upper = makeElevator(3.6, 0x06b6d4);  // 加速电梯 a↑ = g
  const lower = makeElevator(-3.6, 0xf59e0b); // 静止于引力场 g↓

  const upLbl = panel(THREE, geo, mat, [
    { text: '① 加速电梯 a↑ = g（箱外无引力）', color: '#67e8f9' },
    { text: '自由小球相对电梯 a↓ = g', color: '#94a3b8' },
  ], 4.8);
  upLbl.position.set(0, 6.5, 0);
  group.add(upLbl);

  const dnLbl = panel(THREE, geo, mat, [
    { text: '② 静止电梯处于引力场 g↓', color: '#fbbf24' },
    { text: '自由小球相对电梯 a↓ = g', color: '#94a3b8' },
  ], 4.8);
  dnLbl.position.set(0, -0.35, 0);
  group.add(dnLbl);

  const eqLbl = panel(THREE, geo, mat, [
    { text: '局域实验不可分辨  ⇔  m_g = m_i', color: '#f8fafc' },
    { text: '⇒ 光线弯曲 · 引力红移', color: '#a78bfa' },
  ], 5.4);
  eqLbl.position.set(0, 1.6, 0);
  group.add(eqLbl);

  const infoCv = document.createElement('canvas');
  infoCv.width = 720; infoCv.height = 190;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = geo(new THREE.CanvasTexture(infoCv));
  const infoMat = mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false }));
  const infoPlane = new THREE.Mesh(geo(new THREE.PlaneGeometry(8.6, 2.27)), infoMat);
  infoPlane.position.set(0, -6.6, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  ctx.camera.position.set(0, 1.5, 15);

  const cycle = 4.0; // 每轮自由下落周期

  function stepElevator(e: ReturnType<typeof makeElevator>, phase: number): void {
    const u = phase / cycle;
    const top = FLOOR_Y + BOX_H * 0.42;
    const bot = FLOOR_Y + 0.3;
    const y = top - (top - bot) * u * u; // 匀加速下落
    e.ball.position.set(0, y, 0);

    const arr = e.trailGeo.getAttribute('position') as import('three').BufferAttribute;
    const a = arr.array as Float32Array;
    a[e.head * 3] = 0;
    a[e.head * 3 + 1] = y;
    a[e.head * 3 + 2] = 0;
    e.head = (e.head + 1) % e.trailN;
    arr.needsUpdate = true;
  }

  let panelDirty = true;
  let lastPhase = -1;
  return {
    update(t) {
      const phase = t % cycle;
      if (phase < lastPhase) panelDirty = true;
      lastPhase = phase;

      stepElevator(upper, phase);
      stepElevator(lower, phase);
      const k = 1 + 0.12 * Math.sin(t * 4);
      upper.arrow.setLength(BOX_H * 0.72 * k, 0.3, 0.15);
      lower.arrow.setLength(BOX_H * 0.72 * k, 0.3, 0.15);

      if (panelDirty) {
        panelDirty = false;
        drawPanel(phase);
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

  function drawPanel(phase: number): void {
    infoCtx.clearRect(0, 0, 720, 190);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 712, 182);
    infoCtx.strokeStyle = '#334155';
    infoCtx.lineWidth = 3;
    infoCtx.strokeRect(4, 4, 712, 182);

    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 32px "PingFang SC", sans-serif';
    infoCtx.fillText('弱等效原理 WEP：m_g = m_i', 24, 46);

    infoCtx.font = '27px "PingFang SC", sans-serif';
    infoCtx.fillStyle = '#67e8f9';
    infoCtx.fillText('① a↑ = g（真空、无引力场）→ 球 a↓,rel = g', 24, 92);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.fillText('② 引力场 g↓（电梯静止）→ 球 a↓,rel = g', 24, 130);

    infoCtx.fillStyle = '#a78bfa';
    infoCtx.font = '25px "PingFang SC", sans-serif';
    infoCtx.fillText(`两箱轨迹逐帧重合（相位 ${(phase / cycle).toFixed(2)}）⇒ 光线弯曲、谱线红移`, 24, 168);
    infoTex.needsUpdate = true;
  }
}

function panel(
  THREE: typeof import('three'),
  geo: <T extends { dispose(): void }>(g: T) => T,
  mat: <T extends { dispose(): void }>(m: T) => T,
  lines: { text: string; color?: string }[],
  worldW: number,
): import('three').Sprite {
  const w = 640;
  const lineH = 56;
  const h = lines.length * lineH + 34;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!;
  c.clearRect(0, 0, w, h);
  c.fillStyle = 'rgba(7,11,20,0.78)';
  c.beginPath();
  (c as CanvasRenderingContext2D & { roundRect(x: number, y: number, ww: number, hh: number, r: number): void })
    .roundRect(4, 4, w - 8, h - 8, 16);
  c.fill();
  c.strokeStyle = 'rgba(51,65,85,0.95)';
  c.lineWidth = 3;
  c.stroke();
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  lines.forEach((ln, i) => {
    c.fillStyle = ln.color ?? '#cbd5e1';
    c.font = `bold ${i === 0 ? 34 : 28}px "PingFang SC", sans-serif`;
    c.fillText(ln.text, w / 2, 30 + lineH * i + lineH / 2 - 8, w - 40);
  });
  const tex = geo(new THREE.CanvasTexture(cv));
  const sp = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })));
  sp.scale.set(worldW, (worldW * h) / w, 1);
  sp.renderOrder = 998;
  return sp;
}
