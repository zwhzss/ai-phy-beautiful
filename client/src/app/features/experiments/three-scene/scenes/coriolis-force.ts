import type { SceneContext, SceneInstance } from '../types';

/**
 * 科里奥利力（P48）：旋转平台上径向滚动的球，展示科氏偏转。
 * 物理：F_c = 2mΩv_r（面板按 m = 1 kg 口径读数）；径向为滑槽约束恒速驱动 r(t)=r₀+v_r·t
 * （自由球应有 r̈=Ω²r₀²/r³ 离心加速，此处不模拟）；旋转系偏转精确解 θ̇ = −Ω(1−r₀²/r²)。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const Omega = 1.0; // 平台角速度 rad/s
  const R_platform = 3.0;
  let t_sim = 0;
  let ballRelPos = { r: 0, θ: 0 }; // 在旋转系中的极坐标
  const trailPoints: import('three').Vector3[] = [];

  // —— 旋转平台（网格）——
  const platformGroup = new THREE.Group();
  group.add(platformGroup);

  // 圆形平台面
  const platGeo = new THREE.CylinderGeometry(R_platform, R_platform, 0.05, 48);
  const platMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.3, roughness: 0.6, transparent: true, opacity: 0.8 });
  const platform = new THREE.Mesh(platGeo, platMat);
  platform.position.y = -0.5;
  platformGroup.add(platform);

  // 径向网格线
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -0.47, 0),
      new THREE.Vector3(Math.cos(angle) * R_platform, -0.47, Math.sin(angle) * R_platform),
    ]);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.5 });
    platformGroup.add(new THREE.Line(lineGeo, lineMat));
  }
  // 同心圆网格
  for (let r = 0.5; r < R_platform; r += 0.5) {
    const circleGeo = new THREE.TorusGeometry(r, 0.01, 4, 32);
    const circleMat = new THREE.MeshBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.4 });
    const circle = new THREE.Mesh(circleGeo, circleMat);
    circle.rotation.x = Math.PI / 2;
    circle.position.y = -0.47;
    platformGroup.add(circle);
  }

  // —— 球体 ——
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.4, metalness: 0.3, roughness: 0.4 }),
  );
  group.add(ball);

  // —— 科里奥利力箭头（青色）——
  const corArrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 0, 0),
    1.2,
    0x06b6d4,
    0.25,
    0.12,
  );
  group.add(corArrow);

  // —— 轨迹点云（在惯性系中）——
  const trailN = 400;
  const trailPos = new Float32Array(trailN * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  const trail = new THREE.Points(trailGeo, new THREE.PointsMaterial({ color: 0xf472b6, size: 0.1, transparent: true, opacity: 0.7 }));
  group.add(trail);
  let trailHead = 0;

  // —— 信息面板 ——
  const infoCanvas = document.createElement('canvas');
  infoCanvas.width = 220;
  infoCanvas.height = 148;
  const infoCtx = infoCanvas.getContext('2d')!;
  const infoTex = new THREE.CanvasTexture(infoCanvas);
  const infoGeo = new THREE.PlaneGeometry(3.2, 2.15);
  const infoMat = new THREE.MeshBasicMaterial({ map: infoTex, transparent: true });
  const infoPlot = new THREE.Mesh(infoGeo, infoMat);
  infoPlot.position.set(-6, 2, 0);
  group.add(infoPlot);

  // —— 地面网格 ——
  const gridHelper = new THREE.GridHelper(20, 20, 0x1e293b, 0x0f172a);
  gridHelper.position.y = -0.55;
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

  ctx.camera.position.set(0, 8, 6);

  return {
    update(t) {
      const dt = 0.016;
      t_sim += dt;

      // 重置模拟
      if (t_sim > 8) {
        t_sim = 0;
        ballRelPos = { r: 0.3, θ: 0 };
        trailPoints.length = 0;
        trailHead = 0;
      }

      // 在旋转参考系中：球以恒定速度径向向外运动
      const v_r = 0.4; // 径向速度 m/s
      ballRelPos.r = 0.3 + v_r * t_sim;
      if (ballRelPos.r > R_platform - 0.2) {
        ballRelPos.r = 0.3;
        ballRelPos.θ = 0;
        t_sim = 0;
        trailPoints.length = 0;
        trailHead = 0;
      }

      // 科里奥利偏转：精确解 θ̇ = −Ω(1−r₀²/r²)，近似式 2Ωv_r/r 为小偏移近似（r₀=0.3）
      const r0 = 0.3;
      ballRelPos.θ += (-Omega * (1 - r0 * r0 / Math.max(ballRelPos.r, r0))) * dt;

      // 转换为惯性系坐标（平台旋转了 Ωt）
      const platformAngle = Omega * t;
      const absAngle = ballRelPos.θ + platformAngle;
      const bx = ballRelPos.r * Math.cos(absAngle);
      const bz = ballRelPos.r * Math.sin(absAngle);
      ball.position.set(bx, 0, bz);

      // 更新轨迹
      const tp = trailGeo.attributes['position'] as import('three').BufferAttribute;
      const idx = (trailHead * 3) % (trailN * 3);
      tp.array[idx] = bx;
      tp.array[idx + 1] = 0.05;
      tp.array[idx + 2] = bz;
      trailHead++;
      tp.needsUpdate = true;

      // 平台旋转视觉
      platformGroup.rotation.y = platformAngle;

      // 科里奥利力方向（旋转系中 a_θ = −2Ωv_r < 0，即沿 −e_φ，与偏转 θ̇ = −2Ωv_r/r 同向）
      const corDir = new THREE.Vector3(Math.sin(absAngle), 0, -Math.cos(absAngle)); // 切向反方向 −e_φ
      corArrow.position.set(bx, 0.3, bz);
      corArrow.setDirection(corDir);
      const Fcor = 2 * v_r * Omega;
      corArrow.setLength(Fcor * 0.5, 0.25, 0.12);

      // 信息面板
      infoCtx.fillStyle = 'rgba(7,11,20,0.9)';
      infoCtx.fillRect(0, 0, 220, 148);
      infoCtx.fillStyle = '#f8fafc';
      infoCtx.font = 'bold 13px monospace';
      infoCtx.fillText(`Ω = ${Omega.toFixed(1)} rad/s  v_r = ${v_r.toFixed(1)} m/s`, 15, 25);
      infoCtx.fillStyle = '#06b6d4';
      infoCtx.font = 'bold 12px monospace';
      infoCtx.fillText(`F_c = 2mΩv_r = ${Fcor.toFixed(2)} N（m=1 kg）`, 15, 48);
      infoCtx.fillStyle = '#94a3b8';
      infoCtx.font = '11px sans-serif';
      infoCtx.fillText('粉色轨迹=科氏偏转', 15, 72);
      infoCtx.fillText('青箭头=科氏力方向', 15, 88);
      infoCtx.font = '10px sans-serif';
      infoCtx.fillText('北半球向右偏（气旋逆时针、河流右岸侵蚀）', 15, 110);
      infoCtx.fillText('径向：滑槽约束恒速驱动 r=r₀+v_r·t（非自由球）', 15, 132);
      infoTex.needsUpdate = true;

      stars.rotation.y = t * 0.004;
    },
    dispose() {
      [starGeo, platGeo, trailGeo, infoGeo].forEach((g) => g.dispose());
      stars.material.dispose();
      infoTex.dispose();
      infoMat.dispose();
      platMat.dispose();
      ball.geometry?.dispose();
      ball.material.dispose();
      scene.remove(group);
      scene.remove(stars);
    },
  };
}
