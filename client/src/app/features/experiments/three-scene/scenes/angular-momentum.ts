import type { SceneContext, SceneInstance } from '../types';

/**
 * 角动量守恒（P49）：花样滑冰运动员收臂/展臂，展示 L = Iω 守恒。
 * 物理：I₁ω₁ = I₂ω₂；手臂收回 → I 减小 → ω 增大。
 * 第二舞台：有心力场开普勒轨道（左）——单位质量 L = r²ω = const，近日点 r↓ ⇒ ω↑，
 *   与收臂是同一条守恒律；轨道与读数均由平近点角 M=n·t 牛顿解偏近点角 E 现算。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const m_body = 1.0; // 身体质量
  const R_body = 0.4; // 身体半径
  const m_arm = 0.3; // 手臂质量
  const L_arm = 0.8; // 手臂长度
  const I_min = 0.5; // 收臂时转动惯量（最小）
  const I_max = 2.0; // 展臂时转动惯量（最大）
  const L_angular = 2.0; // 角动量守恒值
  let omega = L_angular / I_max; // 初始角速度

  // —— 身体（球体）——
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(R_body, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0x7dd3fc, emissive: 0x0ea5e9, emissiveIntensity: 0.3, metalness: 0.3, roughness: 0.4 }),
  );
  group.add(body);

  // —— 手臂（圆柱体）——
  const armGeo = new THREE.CylinderGeometry(0.08, 0.08, L_arm, 12);
  const armMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.2, metalness: 0.3, roughness: 0.4 });

  const armL = new THREE.Mesh(armGeo, armMat);
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, armMat.clone());
  group.add(armR);

  // —— 旋转轴指示线 ——
  const axisGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -2, 0),
    new THREE.Vector3(0, 2, 0),
  ]);
  const axisMat = new THREE.LineDashedMaterial({ color: 0x475569, gapSize: 0.05 });
  const axisLine = new THREE.Line(axisGeo, axisMat);
  axisLine.computeLineDistances();
  group.add(axisLine);

  // —— 信息面板 ——
  const infoCanvas = document.createElement('canvas');
  infoCanvas.width = 240;
  infoCanvas.height = 130;
  const infoCtx = infoCanvas.getContext('2d')!;
  const infoTex = new THREE.CanvasTexture(infoCanvas);
  const infoGeo = new THREE.PlaneGeometry(3.4, 1.85);
  const infoMat = new THREE.MeshBasicMaterial({ map: infoTex, transparent: true });
  const infoPlot = new THREE.Mesh(infoGeo, infoMat);
  infoPlot.position.set(5.5, 1, 0);
  group.add(infoPlot);

  // —— 地面网格 ——
  const gridHelper = new THREE.GridHelper(20, 20, 0x1e293b, 0x0f172a);
  gridHelper.position.y = -1.5;
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

  // —— 第二舞台：有心力场 / 开普勒第二定律 ——
  // 与花样滑冰同一条守恒律：单位质量角动量 L = r²ω = const（近日点 r↓ ⇒ ω↑，等时扫等面积）。
  // 用平近点角 M=n·t 牛顿迭代解偏近点角 E（M=E−e·sinE），轨道几何与读数全部由该解算出。
  const KEP = new THREE.Group(); KEP.position.set(-5.2, 1.1, 0); group.add(KEP);
  const kepA = 1.6, kepE = 0.55, nK = 0.55;         // 半长轴 / 离心率 / 平均角速度(rad/s)
  const kepB = kepA * Math.sqrt(1 - kepE * kepE);   // 半短轴
  const Lkep = nK * kepA * kepA * Math.sqrt(1 - kepE * kepE); // 单位质量角动量（恒定）
  const ORBN = 128;
  const orbGeo = new THREE.BufferGeometry();
  const orbPos = new Float32Array((ORBN + 1) * 3);
  for (let i = 0; i <= ORBN; i++) {
    const E = (i / ORBN) * Math.PI * 2;
    orbPos[i * 3] = kepA * (Math.cos(E) - kepE);
    orbPos[i * 3 + 1] = kepB * Math.sin(E);
    orbPos[i * 3 + 2] = 0;
  }
  orbGeo.setAttribute('position', new THREE.BufferAttribute(orbPos, 3));
  const orbMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.6 });
  KEP.add(new THREE.Line(orbGeo, orbMat));
  const sunGeo = new THREE.SphereGeometry(0.17, 14, 14);
  const sunMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xd97706, emissiveIntensity: 0.7 });
  const sun = new THREE.Mesh(sunGeo, sunMat); KEP.add(sun);          // 太阳位于焦点（轨道坐标原点）
  const planetGeo = new THREE.SphereGeometry(0.13, 14, 14);
  const planetMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.35 });
  const planet = new THREE.Mesh(planetGeo, planetMat); KEP.add(planet);
  const rvGeo = new THREE.BufferGeometry();
  rvGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
  const rvMat = new THREE.LineBasicMaterial({ color: 0xf472b6 });
  const rvLine = new THREE.Line(rvGeo, rvMat); KEP.add(rvLine);       // 半径矢量（扫过的面积由它生成）

  // —— 有心场读数小面板（5 Hz 刷新，随轨道几何同源） ——
  const kInfoCanvas = document.createElement('canvas');
  kInfoCanvas.width = 240; kInfoCanvas.height = 96;
  const kInfoCtx = kInfoCanvas.getContext('2d')!;
  const kInfoTex = new THREE.CanvasTexture(kInfoCanvas);
  const kInfoGeo = new THREE.PlaneGeometry(2.6, 1.04);
  const kInfoMat = new THREE.MeshBasicMaterial({ map: kInfoTex, transparent: true });
  const kInfoPlot = new THREE.Mesh(kInfoGeo, kInfoMat);
  kInfoPlot.position.set(-5.2, -1.1, 0); group.add(kInfoPlot);
  function drawKepler(r: number, w: number): void {
    kInfoCtx.fillStyle = 'rgba(7,11,20,0.9)'; kInfoCtx.fillRect(0, 0, 240, 96);
    kInfoCtx.strokeStyle = '#334155'; kInfoCtx.strokeRect(1, 1, 238, 94);
    kInfoCtx.fillStyle = '#f8fafc'; kInfoCtx.font = 'bold 12px monospace';
    kInfoCtx.fillText('有心力场 · 开普勒第二定律', 8, 18);
    kInfoCtx.fillStyle = '#22c55e'; kInfoCtx.font = '11px monospace';
    kInfoCtx.fillText('L = r²·ω = const（等时扫等面积）', 8, 38);
    kInfoCtx.fillStyle = '#fbbf24'; kInfoCtx.font = '11px monospace';
    kInfoCtx.fillText(`r = ${r.toFixed(2)}   ω = ${w.toFixed(2)} rad/s`, 8, 58);
    kInfoCtx.fillText(`r²·ω = ${(r * r * w).toFixed(2)}（近日点 r 小→ω 大）`, 8, 78);
    kInfoTex.needsUpdate = true;
  }
  drawKepler(kepA * (1 - kepE), Lkep / (kepA * (1 - kepE)) ** 2);

  ctx.camera.position.set(0, 1, 8);

  return {
    update(t) {
      // 手臂开合动画（正弦）
      const armPhase = 0.5 + 0.5 * Math.sin(t * 0.8);
      // I 由臂节位置实时求和：I = Σ m r²，简化为两臂+身体
      const armSpread = armPhase * 1.2;
      const I_arm = 2 * m_arm * (R_body + L_arm * Math.cos(armSpread) / 2) ** 2;
      const I_body = m_body * R_body ** 2; // 身体转动惯量（简化为球体）
      const I = I_body + I_arm;
      // 角动量守恒：L = Iω = constant
      const L_const = L_angular;
      omega = L_const / I;

      // 身体旋转
      body.rotation.y += omega * 0.016;

      // 手臂位置（随身体旋转）
      const armAngle = body.rotation.y;
      // armSpread 已在上方计算（同一公式 armPhase * 1.2），直接复用
      armL.position.set(
        Math.cos(armAngle + Math.PI / 2) * (R_body + L_arm / 2 * Math.cos(armSpread)),
        0,
        Math.sin(armAngle + Math.PI / 2) * (R_body + L_arm / 2 * Math.cos(armSpread)),
      );
      armL.rotation.y = armAngle + Math.PI / 2;
      armL.rotation.z = armSpread;

      armR.position.set(
        Math.cos(armAngle - Math.PI / 2) * (R_body + L_arm / 2 * Math.cos(armSpread)),
        0,
        Math.sin(armAngle - Math.PI / 2) * (R_body + L_arm / 2 * Math.cos(armSpread)),
      );
      armR.rotation.y = armAngle - Math.PI / 2;
      armR.rotation.z = -armSpread;

      // 信息面板
      infoCtx.fillStyle = 'rgba(7,11,20,0.9)';
      infoCtx.fillRect(0, 0, 240, 130);
      infoCtx.fillStyle = '#f8fafc';
      infoCtx.font = 'bold 13px monospace';
      infoCtx.fillText('角动量守恒 L = Iω', 15, 22);
      infoCtx.fillStyle = '#7dd3fc';
      infoCtx.fillText(`I = ${I.toFixed(2)} kg·m²`, 15, 45);
      infoCtx.fillStyle = '#f59e0b';
      infoCtx.fillText(`ω = ${omega.toFixed(2)} rad/s`, 15, 68);
      infoCtx.fillStyle = '#22c55e';
      infoCtx.fillText(`L = ${L_const.toFixed(2)} kg·m²/s (恒定)`, 15, 91);
      infoCtx.fillStyle = '#94a3b8';
      infoCtx.font = '10px sans-serif';
      infoCtx.fillText('手臂收回 → I↓ → ω↑', 15, 112);
      infoCtx.fillText('手臂展开 → I↑ → ω↓', 15, 126);
      infoTex.needsUpdate = true;

      // —— 第二舞台：开普勒轨道（近日点加速，L=r²ω 守恒，与收臂同源守恒律） ——
      const M = (t * nK) % (Math.PI * 2);
      let Ek = M;
      for (let it = 0; it < 6; it++) Ek = Ek - (Ek - kepE * Math.sin(Ek) - M) / (1 - kepE * Math.cos(Ek));
      const px = kepA * (Math.cos(Ek) - kepE);
      const py = kepB * Math.sin(Ek);
      const rK = Math.hypot(px, py);
      const wK = Lkep / (rK * rK);                  // ω = L/r²：近日点 r 最小 → ω 最大
      planet.position.set(px, py, 0);
      sun.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
      const rva = rvGeo.attributes['position'].array as Float32Array;
      rva[0] = 0; rva[1] = 0; rva[2] = 0; rva[3] = px; rva[4] = py; rva[5] = 0;
      rvGeo.attributes['position'].needsUpdate = true;
      if (Math.floor(t * 5) !== Math.floor((t - 0.016) * 5)) drawKepler(rK, wK);

      stars.rotation.y = t * 0.004;
    },
    dispose() {
      [starGeo, armGeo, axisGeo, infoGeo, orbGeo, sunGeo, planetGeo, rvGeo, kInfoGeo].forEach((g) => g.dispose());
      stars.material.dispose();
      infoTex.dispose();
      infoMat.dispose();
      armMat.dispose();
      (armR.material as import('three').Material).dispose();
      body.geometry?.dispose();
      body.material.dispose();
      orbMat.dispose(); sunMat.dispose(); planetMat.dispose(); rvMat.dispose();
      kInfoTex.dispose(); kInfoMat.dispose();
      scene.remove(group);
      scene.remove(stars);
    },
  };
}
