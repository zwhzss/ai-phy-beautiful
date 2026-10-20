import type { SceneContext, SceneInstance } from '../types';

/**
 * 圆周运动（P47）：匀速圆周运动，展示向心加速度与切向速度。
 * 物理：a_c = v²/r = ω²r；周期 T = 2π/ω；频率 f = 1/T（T、f 随 ω 扫描实时重算，与读数同源）。
 * 竖直轨道（过山车式）：环轨在 x–y 竖直面内，最高点不掉条件 v ≥ √(gR)；
 * 离心现象演示：每 12 s 周期在相位 8 s「松手」，紫点沿释放瞬间切线匀速飞出（v_r = ωR）。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  let R_base = 3.0; // 半径基准值
  const omega_base = 2.0; // 角速度基准 rad/s
  let R = R_base;
  let omega = omega_base;
  let v = omega * R; // 线速度
  let T = (2 * Math.PI) / omega; // 周期
  let f = 1 / T; // 频率

  // —— 轨道圆环 ——
  const orbitGeo = new THREE.TorusGeometry(R, 0.02, 8, 64);
  const orbitMat = new THREE.MeshBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.6 });
  const orbit = new THREE.Mesh(orbitGeo, orbitMat);
  orbit.rotation.x = Math.PI / 2;
  group.add(orbit);

  // —— 中心点 ——
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x94a3b8 }),
  );
  group.add(center);

  // —— 运动质点 ——
  const particle = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.4 }),
  );
  group.add(particle);

  // —— 向心加速度箭头（红色）——
  const acArrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 0, 0),
    1.5,
    0xef4444,
    0.3,
    0.15,
  );
  group.add(acArrow);

  // —— 切向速度箭头（绿色）——
  const vtArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 0),
    1.2,
    0x22c55e,
    0.25,
    0.12,
  );
  group.add(vtArrow);

  // —— 位置半径线 ——
  const radiusLineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(R, 0, 0),
  ]);
  const radiusLineMat = new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.5 });
  const radiusLine = new THREE.Line(radiusLineGeo, radiusLineMat);
  group.add(radiusLine);

  // —— 离心现象（松手演示）：紫点 + 切线飞出路径 ——
  const releaseDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xf472b6 }),
  );
  releaseDot.visible = false;
  group.add(releaseDot);
  const releaseLineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 0, 0),
  ]);
  const releaseLine = new THREE.Line(releaseLineGeo, new THREE.LineBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.55 }));
  releaseLine.visible = false;
  group.add(releaseLine);
  let released = false;
  const relPos = new THREE.Vector3();
  const relDir = new THREE.Vector3();
  let relSpeed = 0;

  // —— 信息面板 ——
  const infoCanvas = document.createElement('canvas');
  infoCanvas.width = 240;
  infoCanvas.height = 144;
  const infoCtx = infoCanvas.getContext('2d')!;
  const infoTex = new THREE.CanvasTexture(infoCanvas);
  const infoGeo = new THREE.PlaneGeometry(3.4, 2.04);
  const infoMat = new THREE.MeshBasicMaterial({ map: infoTex, transparent: true });
  const infoPlot = new THREE.Mesh(infoGeo, infoMat);
  infoPlot.position.set(0, 4.5, 0);
  group.add(infoPlot);

  // —— 角速度 ω 标签（随粒子运动）——
  const omegaCanvas = document.createElement('canvas');
  omegaCanvas.width = 64;
  omegaCanvas.height = 32;
  const omegaCtx = omegaCanvas.getContext('2d')!;
  const omegaTex = new THREE.CanvasTexture(omegaCanvas);
  const omegaGeo = new THREE.PlaneGeometry(0.8, 0.4);
  const omegaMat = new THREE.MeshBasicMaterial({ map: omegaTex, transparent: true });
  const omegaLabel = new THREE.Mesh(omegaGeo, omegaMat);
  group.add(omegaLabel);

  // —— 地面网格 ——
  const gridHelper = new THREE.GridHelper(20, 20, 0x1e293b, 0x0f172a);
  gridHelper.position.y = -0.01;
  group.add(gridHelper);

  // —— 背景星点 ——
  const starN = 500;
  const starPos = new Float32Array(starN * 3);
  for (let i = 0; i < starN; i++) {
    const r = 20 + Math.random() * 40;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    starPos[i * 3 + 1] = r * Math.cos(ph);
    starPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xc7d2fe, size: 0.2, sizeAttenuation: true }));
  scene.add(stars);

  ctx.camera.position.set(0, 6, 8);

  let theta = 0; // 累积转角 θ = ∫ω dt（ω 随时间扫描，不能用 ω·t）

  return {
    update(t, dt) {
      // R 和 omega 缓慢扫描（2.0~4.0 和 1.5~2.5），联动面板读数
      R = 3.0 + 1.0 * Math.sin(t * 0.3);
      omega = 2.0 + 0.5 * Math.cos(t * 0.25);
      v = omega * R;
      T = (2 * Math.PI) / omega; // 周期随 ω 实时重算（5Hz 面板读数同源）
      f = 1 / T;
      const step = Math.min(dt, 0.05);
      theta += omega * step;
      const angle = theta;
      const px = R * Math.cos(angle);
      const py = R * Math.sin(angle);
      particle.position.set(px, py, 0);
      orbit.scale.set(R / R_base, R / R_base, 1); // 环轨半径跟随 R 扫描（竖直轨道与质点同半径）

      // 离心现象演示：每 12s 周期在相位 8s「松手」，紫点沿切线匀速飞出 4s
      const phase = t % 12;
      if (phase > 8 && !released) {
        released = true;
        relPos.set(px, py, 0);
        relDir.set(-Math.sin(angle), Math.cos(angle), 0); // 释放瞬间速度方向（与切向箭头同向）
        relSpeed = R * omega; // 视觉速度 = 轨道运动的实际屏上速度
      }
      if (phase <= 8) released = false;
      const flyT = phase - 8;
      const showFly = released && flyT <= 4;
      releaseDot.visible = showFly;
      releaseLine.visible = showFly;
      if (showFly) {
        const gx = relPos.x + relDir.x * relSpeed * flyT;
        const gy = relPos.y + relDir.y * relSpeed * flyT;
        releaseDot.position.set(gx, gy, 0);
        const rl = releaseLine.geometry.attributes['position'] as import('three').BufferAttribute;
        rl.array[0] = relPos.x; rl.array[1] = relPos.y; rl.array[2] = 0;
        rl.array[3] = gx; rl.array[4] = gy; rl.array[5] = 0;
        rl.needsUpdate = true;
      }

      // 半径线
      const rPts = radiusLine.geometry.attributes['position'] as import('three').BufferAttribute;
      rPts.array[0] = 0; rPts.array[1] = 0; rPts.array[2] = 0;
      rPts.array[3] = px; rPts.array[4] = py; rPts.array[5] = 0;
      rPts.needsUpdate = true;

      // 向心加速度（指向中心）
      acArrow.position.set(px, py, 0);
      acArrow.setDirection(new THREE.Vector3(-px, -py, 0).normalize());
      acArrow.setLength(R * omega * omega * 0.08, 0.3, 0.15);

      // 切向速度（垂直半径，沿运动方向）
      vtArrow.position.set(px, py, 0);
      vtArrow.setDirection(new THREE.Vector3(-Math.sin(angle), Math.cos(angle), 0));
      vtArrow.setLength(v * 0.12, 0.25, 0.12);

      // ω 标签
      omegaLabel.position.set(px * 0.6, py * 0.6, 0.1);
      omegaCtx.fillStyle = '#f59e0b';
      omegaCtx.font = 'bold 20px serif';
      omegaCtx.fillText('ω', 20, 24);
      omegaTex.needsUpdate = true;

      // 信息面板
      infoCtx.fillStyle = 'rgba(7,11,20,0.9)';
      infoCtx.fillRect(0, 0, 240, 144);
      infoCtx.fillStyle = '#f8fafc';
      infoCtx.font = 'bold 13px monospace';
      infoCtx.fillText(`半径 r = ${R.toFixed(2)} m`, 15, 25);
      infoCtx.fillStyle = '#22c55e';
      infoCtx.fillText(`线速度 v = ${v.toFixed(2)} m/s`, 15, 48);
      infoCtx.fillStyle = '#ef4444';
      infoCtx.fillText(`向心加速度 a_c = ${(R * omega * omega).toFixed(2)} m/s²`, 15, 71);
      infoCtx.fillStyle = '#94a3b8';
      infoCtx.fillText(`周期 T = ${T.toFixed(2)} s`, 15, 94);
      infoCtx.fillText(`频率 f = ${f.toFixed(2)} Hz`, 140, 25);
      infoCtx.fillStyle = '#7dd3fc';
      infoCtx.fillText('红=向心加速度', 140, 48);
      infoCtx.fillText('绿=切向速度', 140, 71);
      infoCtx.fillText('橙=质点', 140, 94);
      infoCtx.fillStyle = '#fbbf24';
      infoCtx.fillText('最高点不掉：n=mv²/R−mg≥0 ⇒ v≥√(gR)', 15, 115);
      infoCtx.fillStyle = '#f472b6';
      infoCtx.fillText('紫点=松手后沿切线匀速飞出（离心演示）', 15, 136);
      infoTex.needsUpdate = true;

      stars.rotation.y = t * 0.004;
    },
    dispose() {
      [starGeo, orbitGeo, radiusLineGeo, infoGeo, omegaGeo, releaseLineGeo].forEach((g) => g.dispose());
      releaseDot.geometry?.dispose();
      releaseDot.material.dispose();
      releaseLine.material.dispose();
      stars.material.dispose();
      infoTex.dispose();
      infoMat.dispose();
      omegaTex.dispose();
      omegaMat.dispose();
      orbitMat.dispose();
      center.geometry?.dispose();
      center.material.dispose();
      particle.geometry?.dispose();
      particle.material.dispose();
      scene.remove(group);
      scene.remove(stars);
    },
  };
}
