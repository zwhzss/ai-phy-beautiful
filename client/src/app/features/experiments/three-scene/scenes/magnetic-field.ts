import type { SceneContext, SceneInstance } from '../types';
/** Magnetic Field（P14）：电流的磁场 —— 通电直导线的同心圆磁感线与有限长螺线管的近均匀内部场。 */
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

  const UP = new THREE.Vector3(0, 1, 0);
  const TWO_PI = Math.PI * 2;

  // 方向箭头库：锥体共享，位置/朝向由 dir 记录，电流反向时整体翻转
  const arrowGeo = geo(new THREE.ConeGeometry(0.11, 0.3, 10));
  const arrows: { mesh: import('three').Mesh; dir: import('three').Vector3; neg: import('three').Vector3 }[] = [];
  function makeArrow(pos: import('three').Vector3, dir: import('three').Vector3, material: import('three').Material): void {
    const mesh = new THREE.Mesh(arrowGeo, material);
    mesh.position.copy(pos);
    mesh.quaternion.setFromUnitVectors(UP, dir);
    group.add(mesh);
    arrows.push({ mesh, dir: dir.clone(), neg: dir.clone().negate() });
  }

  // ============ 左半：通电直导线 + 同心圆磁感线 ============
  const WIRE_X = -4.7;
  const WIRE_H = 3.2;
  const wire = new THREE.Mesh(
    geo(new THREE.CylinderGeometry(0.07, 0.07, WIRE_H * 2, 10)),
    mat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.3 })),
  );
  wire.position.set(WIRE_X, 0, 0);
  group.add(wire);

  const circleMat = mat(new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.7 }));
  const circleArrowMat = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
  const RADII = [0.75, 1.2, 1.65];
  const HEIGHTS = [-1.9, 0, 1.9];
  const circGeos = RADII.map((r) => {
    const pts: import('three').Vector3[] = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * TWO_PI;
      pts.push(new THREE.Vector3(r * Math.cos(a), 0, r * Math.sin(a)));
    }
    return geo(new THREE.BufferGeometry().setFromPoints(pts));
  });
  HEIGHTS.forEach((h) => {
    circGeos.forEach((g, ri) => {
      const loop = new THREE.Line(g, circleMat);
      loop.position.set(WIRE_X, h, 0);
      group.add(loop);
      // 每条圆环 4 个切向箭头：I 沿 +y 时 B̂ = ŷ×r̂ = (sin a, 0, −cos a)
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * TWO_PI;
        makeArrow(
          new THREE.Vector3(WIRE_X + RADII[ri] * Math.cos(a), h, RADII[ri] * Math.sin(a)),
          new THREE.Vector3(Math.sin(a), 0, -Math.cos(a)),
          circleArrowMat,
        );
      }
    });
  });

  // 导线电流方向大箭头 + 沿导线流动的载流子
  const wireArrowMat = mat(new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
  makeArrow(new THREE.Vector3(WIRE_X, WIRE_H + 0.45, 0), new THREE.Vector3(0, 1, 0), wireArrowMat);
  const carrierGeo = geo(new THREE.SphereGeometry(0.085, 10, 10));
  const carrierMat = mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
  const wireCarriers: import('three').Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Mesh(carrierGeo, carrierMat);
    group.add(c);
    wireCarriers.push(c);
  }

  // ============ 右半：有限长螺线管 ============
  const SOL_CX = 4.4, SOL_CY = 1.0, SOL_CZ = 0;
  const SOL_L = 4.0, SOL_R = 1.15, SOL_TURNS = 9;
  function helixPoint(u: number): import('three').Vector3 {
    const phi = TWO_PI * SOL_TURNS * u;
    return new THREE.Vector3(
      SOL_CX - SOL_L / 2 + SOL_L * u,
      SOL_CY + SOL_R * Math.cos(phi),
      SOL_CZ + SOL_R * Math.sin(phi),
    );
  }
  const helixPts: import('three').Vector3[] = [];
  for (let i = 0; i <= 540; i++) helixPts.push(helixPoint(i / 540));
  const coil = new THREE.Line(
    geo(new THREE.BufferGeometry().setFromPoints(helixPts)),
    mat(new THREE.LineBasicMaterial({ color: 0xd97706 })),
  );
  group.add(coil);

  // 管内近均匀场线（轴向平行线）+ 管外返回磁感线（半椭圆闭合线）
  const solFieldMat = mat(new THREE.LineBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.75 }));
  const solArrowMat = mat(new THREE.MeshBasicMaterial({ color: 0xa78bfa }));
  const AZIMUTHS = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI, (5 * Math.PI) / 4, (3 * Math.PI) / 2, (7 * Math.PI) / 4];
  const R_IN = 0.3;
  AZIMUTHS.forEach((phi, k) => {
    const oy = Math.cos(phi), oz = Math.sin(phi);
    const bulge = k % 2 === 0 ? 1.35 : 2.1; // 内圈/外圈交替，避免全部重叠
    const pts: import('three').Vector3[] = [];
    for (let s = 0; s <= 20; s++) { // 管内段：-L/2 → +L/2，半径 R_IN
      pts.push(new THREE.Vector3(SOL_CX - SOL_L / 2 + (SOL_L * s) / 20, SOL_CY + oy * R_IN, SOL_CZ + oz * R_IN));
    }
    for (let s = 1; s <= 60; s++) { // 管外返回段：+L/2 绕回 −L/2，鼓出 bulge
      const u = s / 60;
      const rr = R_IN + bulge * Math.sin(Math.PI * u);
      pts.push(new THREE.Vector3(SOL_CX + (SOL_L / 2) * Math.cos(Math.PI * u), SOL_CY + oy * rr, SOL_CZ + oz * rr));
    }
    group.add(new THREE.Line(geo(new THREE.BufferGeometry().setFromPoints(pts)), solFieldMat));
    // 管内箭头 +x、管外顶段箭头 −x（dir=+1 时；电流反向随箭头整体翻转）
    makeArrow(new THREE.Vector3(SOL_CX, SOL_CY + oy * R_IN, SOL_CZ + oz * R_IN), new THREE.Vector3(1, 0, 0), solArrowMat);
    makeArrow(new THREE.Vector3(SOL_CX, SOL_CY + oy * (R_IN + bulge), SOL_CZ + oz * (R_IN + bulge)), new THREE.Vector3(-1, 0, 0), solArrowMat);
  });
  // 中心轴线（管内最匀场区）
  const axisGeo = geo(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(SOL_CX - SOL_L / 2, SOL_CY, SOL_CZ),
    new THREE.Vector3(SOL_CX + SOL_L / 2, SOL_CY, SOL_CZ),
  ]));
  group.add(new THREE.Line(axisGeo, solFieldMat));
  makeArrow(new THREE.Vector3(SOL_CX - 1.0, SOL_CY, SOL_CZ), new THREE.Vector3(1, 0, 0), solArrowMat);
  makeArrow(new THREE.Vector3(SOL_CX + 1.0, SOL_CY, SOL_CZ), new THREE.Vector3(1, 0, 0), solArrowMat);

  // 螺线管电流载流子（沿线圈前进）
  const coilCarriers: import('three').Mesh[] = [];
  for (let i = 0; i < 12; i++) {
    const c = new THREE.Mesh(carrierGeo, wireArrowMat);
    group.add(c);
    coilCarriers.push(c);
  }

  // ============ 右手定则示意（弯指弧 + 拇指箭头） ============
  const handGroup = new THREE.Group();
  handGroup.position.set(0, 3.5, 0);
  group.add(handGroup);
  const thumb = new THREE.Mesh(
    geo(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8)),
    mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })),
  );
  thumb.position.y = 0.2;
  handGroup.add(thumb);
  makeArrow(new THREE.Vector3(0, 3.5 + 0.85, 0), new THREE.Vector3(0, 1, 0), mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })));
  const fingerGeo = geo(new THREE.TorusGeometry(0.55, 0.045, 8, 28, Math.PI * 1.5));
  const fingerMat = mat(new THREE.MeshBasicMaterial({ color: 0x34d399 }));
  const fingers = new THREE.Mesh(fingerGeo, fingerMat);
  fingers.rotation.x = -Math.PI / 2; // 环面转到水平 xz 平面，缠绕拇指（+y）
  fingers.position.set(0, 3.62, 0);
  group.add(fingers);
  {
    // 弧末端：局部角 1.5π 经 rotation.x=−π/2 后落在世界 (0, 3.62, +0.55)，切向 (1,0,0)
    // 与 +y 电流的 B̂ 绕向（a=π/2 处 B̂=(1,0,0)）一致
    makeArrow(new THREE.Vector3(0, 3.62, 0.55), new THREE.Vector3(1, 0, 0), fingerMat);
  }

  // ============ 标签与面板 ============
  function makeLabel(text: string, color: string, scale = 3.6): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 30px "PingFang SC", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  const labelWire = makeLabel('通电直导线：同心圆磁感线', '#22d3ee', 4.4);
  labelWire.position.set(WIRE_X, WIRE_H + 1.3, 0);
  group.add(labelWire);
  const labelSol = makeLabel('螺线管：管内近均匀场', '#a78bfa', 4.2);
  labelSol.position.set(SOL_CX, SOL_CY + 3.4, 0);
  group.add(labelSol);
  const labelHand = makeLabel('右手定则：拇指→I，弯指→B', '#34d399', 4.0);
  labelHand.position.set(0, 4.9, 0);
  group.add(labelHand);
  const labelN = makeLabel('N', '#ef4444', 1.2);
  const labelS = makeLabel('S', '#3b82f6', 1.2);
  group.add(labelN, labelS);

  const infoCv = document.createElement('canvas');
  infoCv.width = 800; infoCv.height = 236;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(8.8, 2.6)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 6.1, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  ctx.camera.position.set(0, 3.6, 13.5);
  ctx.camera.lookAt(0, 1.2, 0);

  function drawInfo(dir: number): void {
    infoCtx.clearRect(0, 0, 800, 236);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 792, 228);
    infoCtx.strokeStyle = '#334155';
    infoCtx.lineWidth = 3;
    infoCtx.strokeRect(4, 4, 792, 228);

    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 30px "PingFang SC", sans-serif';
    infoCtx.fillText('电流的磁场（奥斯特）—— 毕奥-萨伐尔定律', 22, 44);

    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '27px "PingFang SC", sans-serif';
    infoCtx.fillText('dB = μ₀·I·(d𝐥×r̂)/(4πr²)', 22, 84);

    infoCtx.fillStyle = '#34d399';
    infoCtx.fillText('直导线：B = μ₀I/(2πr)，磁感线为同心圆，越远越疏', 22, 122);

    infoCtx.fillStyle = '#a78bfa';
    infoCtx.fillText('螺线管：B = μ₀nI，管内近均匀、管外为返回磁感线', 22, 160);

    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 27px "PingFang SC", sans-serif';
    const state = dir > 0.5 ? '电流方向 ↑（+y）' : dir < -0.5 ? '电流方向 ↓（−y）—— 场线已全部反向！' : '电流换向中…';
    infoCtx.fillText(`读数：${state}`, 22, 202);
    infoTex.needsUpdate = true;
  }
  drawInfo(1);

  let dirSmooth = 1;

  return {
    update(t, dt) {
      // 约每 10s 电流反向一次（快速过零、两段驻留）
      dirSmooth = Math.max(-1, Math.min(1, 3.2 * Math.sin(t * (TWO_PI / 10))));
      const s = Math.abs(dirSmooth);

      // 所有方向箭头：随 |dir| 缩放，过零时翻转 180°
      arrows.forEach((a) => {
        a.mesh.visible = s > 0.05;
        a.mesh.scale.setScalar(Math.max(0.2, s));
        a.mesh.quaternion.setFromUnitVectors(UP, dirSmooth >= 0 ? a.dir : a.neg);
      });

      // 载流子沿导线/线圈漂移，速度正比于电流
      const wrap = (x: number) => ((x % 1) + 1) % 1;
      wireCarriers.forEach((c, i) => {
        const u = wrap(t * 0.16 * dirSmooth + i / wireCarriers.length);
        c.position.set(WIRE_X, -WIRE_H + 2 * WIRE_H * u, 0);
      });
      coilCarriers.forEach((c, i) => {
        const u = wrap(t * 0.1 * dirSmooth + i / coilCarriers.length);
        c.position.copy(helixPoint(u));
      });

      // 螺线管等效 N/S 极随电流换端
      const side = dirSmooth >= 0 ? 1 : -1;
      labelN.position.set(SOL_CX + side * (SOL_L / 2 + 0.6), SOL_CY, 0);
      labelS.position.set(SOL_CX - side * (SOL_L / 2 + 0.6), SOL_CY, 0);

      // 场线呼吸感 + 面板 5Hz 刷新（右手定则示意保持静止，弯指弧末端箭头与弧对齐）
      circleMat.opacity = 0.45 + 0.3 * s + 0.08 * Math.sin(t * 3);
      solFieldMat.opacity = 0.45 + 0.3 * s + 0.08 * Math.sin(t * 3 + 1.5);
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo(dirSmooth);
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
      scene.remove(handGroup);
    },
  };
}
