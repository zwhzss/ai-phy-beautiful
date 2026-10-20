import type { SceneContext, SceneInstance } from '../types';

/**
 * 陀螺进动（P51）： spinning disk on a string support, precession cone.
 * 物理：τ = MgR, Ω = MgR/L, 进动锥面动画。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const M = 1.0; // 质量 kg
  const g = 9.81;
  const R = 0.5; // 悬挂点到质心的水平距离 m
  const diskR = 0.6; // 圆盘半径
  const diskMass = 0.5;
  const L_spin = 5.0; // 自转角动量 kg·m²/s
  const Omega_prec = (M * g * R) / L_spin; // 进动角速度 rad/s

  // —— 悬挂点 ——
  const pivot = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.3 }),
  );
  pivot.position.y = 2;
  group.add(pivot);

  // —— 悬挂绳/杆 ——
  const rodGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.5, 8);
  const rodMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.5, roughness: 0.4 });
  const rod = new THREE.Mesh(rodGeo, rodMat);
  group.add(rod);

  // —— 圆盘（陀螺）——
  const diskGeo = new THREE.CylinderGeometry(diskR, diskR, 0.1, 32);
  const diskMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.3, metalness: 0.4, roughness: 0.3 });
  const disk = new THREE.Mesh(diskGeo, diskMat);
  group.add(disk);

  // —— 进动锥面（半透明）——
  const coneGeo = new THREE.ConeGeometry(R + 0.1, 1.5, 32, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.06, side: THREE.DoubleSide });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.y = 1.25;
  group.add(cone);

  // —— 重力箭头（向下，白色）——
  const gArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 0),
    1.5,
    0xffffff,
    0.25,
    0.12,
  );
  group.add(gArrow);

  // —— 重力矩箭头（水平，红色）——
  const tauArrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 0, 0),
    1.0,
    0xef4444,
    0.25,
    0.12,
  );
  group.add(tauArrow);

  // —— 角动量箭头（沿自转轴，绿色）——
  const LArrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 0, 0),
    1.2,
    0x22c55e,
    0.25,
    0.12,
  );
  group.add(LArrow);

  // —— 进动角速度箭头（向上，蓝色）——
  const OmegaArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 0),
    1.0,
    0x3b82f6,
    0.25,
    0.12,
  );
  group.add(OmegaArrow);

  // —— 信息面板 ——
  const infoCanvas = document.createElement('canvas');
  infoCanvas.width = 240;
  infoCanvas.height = 130;
  const infoCtx = infoCanvas.getContext('2d')!;
  const infoTex = new THREE.CanvasTexture(infoCanvas);
  const infoGeo = new THREE.PlaneGeometry(3.4, 1.85);
  const infoMat = new THREE.MeshBasicMaterial({ map: infoTex, transparent: true });
  const infoPlot = new THREE.Mesh(infoGeo, infoMat);
  infoPlot.position.set(-6, 1, 0);
  group.add(infoPlot);

  // —— 地面网格 ——
  const gridHelper = new THREE.GridHelper(20, 20, 0x1e293b, 0x0f172a);
  gridHelper.position.y = -0.8;
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

  ctx.camera.position.set(0, 2, 8);

  let precessionAngle = 0;

  return {
    update(t) {
      // 进动角：ω_p = τ/L 沿 +y（右手系下 xz 面内相位随时间递减，故取 -Ωt）
      precessionAngle = -Omega_prec * t;

      // 陀螺位置（进动）
      const gx = R * Math.cos(precessionAngle);
      const gz = R * Math.sin(precessionAngle);
      const gy = 2 - 1.5;

      disk.position.set(gx, gy, gz);
      rod.position.set(gx / 2, (2 + gy) / 2, gz / 2);

      // 圆盘自转 + 倾斜
      disk.rotation.y = precessionAngle;
      disk.rotation.x = Math.PI / 2; // 圆盘竖直
      disk.rotation.z = precessionAngle; // 进动方向

      // 锥面跟随
      cone.position.set(gx / 2, 1.25, gz / 2);

      // 重力（作用在质心）
      gArrow.position.set(gx, gy, gz);
      gArrow.setLength(M * g * 0.08, 0.25, 0.12);

      // 重力矩 τ = r × F（r：悬点→质心，F = −Mg ŷ ⇒ τ ∝ (sinφ, 0, −cosφ)，与 dL/dt = τ 同向）
      const tauDir = new THREE.Vector3(Math.sin(precessionAngle), 0, -Math.cos(precessionAngle));
      tauArrow.position.set(gx, gy, gz);
      tauArrow.setDirection(tauDir);
      tauArrow.setLength(M * g * R * 0.1, 0.25, 0.12);

      // 角动量（沿自转轴，水平径向向外）
      const Ldir = new THREE.Vector3(Math.cos(precessionAngle), 0, Math.sin(precessionAngle));
      LArrow.position.set(gx, gy, gz);
      LArrow.setDirection(Ldir);
      LArrow.setLength(L_spin * 0.15, 0.25, 0.12);

      // 进动角速度（向上）
      OmegaArrow.position.set(0, 1, 0);
      OmegaArrow.setLength(Omega_prec * 0.3, 0.25, 0.12);

      // 信息面板
      infoCtx.fillStyle = 'rgba(7,11,20,0.9)';
      infoCtx.fillRect(0, 0, 240, 130);
      infoCtx.fillStyle = '#f8fafc';
      infoCtx.font = 'bold 13px monospace';
      infoCtx.fillText('陀螺进动 Ω = MgR/L', 15, 22);
      infoCtx.fillStyle = '#94a3b8';
      infoCtx.font = '11px monospace';
      infoCtx.fillText(`MgR = ${(M * g * R).toFixed(2)} N·m`, 15, 44);
      infoCtx.fillText(`L = ${L_spin.toFixed(2)} kg·m²/s`, 15, 62);
      infoCtx.fillStyle = '#3b82f6';
      infoCtx.fillText(`Ω = ${Omega_prec.toFixed(3)} rad/s`, 15, 80);
      infoCtx.fillStyle = '#94a3b8';
      infoCtx.fillText('红=力矩τ', 15, 100);
      infoCtx.fillText('绿=L 自转角动量', 15, 116);
      infoCtx.fillText('蓝=Ω 进动角速度', 15, 130);
      infoTex.needsUpdate = true;

      stars.rotation.y = t * 0.004;
    },
    dispose() {
      [starGeo, rodGeo, diskGeo, coneGeo, infoGeo].forEach((g) => g.dispose());
      stars.material.dispose();
      infoTex.dispose();
      infoMat.dispose();
      coneMat.dispose();
      rodMat.dispose();
      diskMat.dispose();
      pivot.geometry?.dispose();
      pivot.material.dispose();
      scene.remove(group);
      scene.remove(stars);
    },
  };
}
