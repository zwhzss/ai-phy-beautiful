import type { SceneContext, SceneInstance } from '../types';

/**
 * 斜面（P46）：物体在斜面上受力分析，重力分解为平行/垂直分量。
 * 物理：F_∥ = mg sinθ, F_⊥ = mg cosθ, N = mg cosθ, f = μN.
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  let theta = Math.PI / 6; // 初始倾角 30°
  const m = 1.0;
  const g = 9.81;
  const μ = 0.2;
  // 摩擦角（临界角）θ_c = arctan μ：θ 扫过它即发生静↔动转折
  const THETA_C_DEG = Math.atan(μ) * 180 / Math.PI; // ≈ 11.31°
  const TH_MIN = 5 * Math.PI / 180;  // 5° < θ_c：静止区
  const TH_MAX = 60 * Math.PI / 180; // 60° > θ_c：滑动区
  const planeLen = 5;
  let blockDist = 1.5; // 物块沿斜面坐标（沿斜面向上为正）
  let vDown = 0;       // 物块沿斜面向下的速度 m/s

  // —— 斜面体 ——
  const planeGeo = new THREE.BoxGeometry(planeLen, 0.15, 2);
  const planeMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.3, roughness: 0.7 });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  group.add(plane);

  // —— 斜面支撑腿 ——
  const legGeo = new THREE.CylinderGeometry(0.1, 0.1, 2, 8);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.4, roughness: 0.5 });
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-planeLen / 2 + 0.5, -1, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(planeLen / 2 - 0.5, -0.5, 0);
  group.add(legR);

  // —— 物块 ——
  const block = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.6, 0.6),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.2, metalness: 0.3, roughness: 0.4 }),
  );
  group.add(block);

  // —— 力箭头容器 ——
  const forceGroup = new THREE.Group();
  group.add(forceGroup);

  // 重力（向下，白色）—— 挂在世界系（不进随斜面旋转的 forceGroup），恒指 −y
  const gArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 0),
    2.0,
    0xffffff,
    0.25,
    0.12,
  );
  group.add(gArrow);

  // 平行分量（红色）
  const fParArrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 0, 0),
    1.5,
    0xef4444,
    0.25,
    0.12,
  );
  forceGroup.add(fParArrow);

  // 垂直分量（蓝色）
  const fPerpArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 0),
    1.5,
    0x3b82f6,
    0.25,
    0.12,
  );
  forceGroup.add(fPerpArrow);

  // 支持力（绿色）
  const nArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 0),
    1.5,
    0x22c55e,
    0.25,
    0.12,
  );
  forceGroup.add(nArrow);

  // 摩擦力（青色，沿斜面向上）
  const fArrow = new THREE.ArrowHelper(
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 0, 0),
    1.0,
    0x06b6d4,
    0.25,
    0.12,
  );
  forceGroup.add(fArrow);

  // —— 角度读数面板 ——
  const readCanvas = document.createElement('canvas');
  readCanvas.width = 220;
  readCanvas.height = 140;
  const readCtx = readCanvas.getContext('2d')!;
  const readTex = new THREE.CanvasTexture(readCanvas);
  const readGeo = new THREE.PlaneGeometry(3.2, 2.0);
  const readMat = new THREE.MeshBasicMaterial({ map: readTex, transparent: true });
  const readPlot = new THREE.Mesh(readGeo, readMat);
  readPlot.position.set(-6, 2, 0);
  group.add(readPlot);

  // —— 地面网格 ——
  const gridHelper = new THREE.GridHelper(20, 20, 0x1e293b, 0x0f172a);
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

  ctx.camera.position.set(0, 3, 10);

  return {
    update(t, dt) {
      // 角度动画：在 5°~60° 之间振荡，跨过摩擦角 θ_c=arctan μ≈11.3°
      // （θ<θ_c 静摩擦平衡、物块静止；θ>θ_c 转为滑动），让"何时滑动"的静↔动转折可见
      theta = TH_MIN + (TH_MAX - TH_MIN) * (0.5 + 0.5 * Math.sin(t * 0.5));

      // 斜面旋转
      plane.rotation.z = -theta;
      legL.position.y = -planeLen / 2 * Math.sin(theta) * 0.5;
      legR.position.y = planeLen / 2 * Math.sin(theta) * 0.5 - 0.5;

      // 力计算
      const Fg = m * g;
      const Fpar = Fg * Math.sin(theta);
      const Fperp = Fg * Math.cos(theta);
      const N = Fperp;
      const fMax = μ * N;
      // F∥ 超过最大摩擦 → 滑动（动摩擦 = fMax）；否则静止（静摩擦与 F∥ 平衡）
      const sliding = Fpar > fMax;
      const f = sliding ? fMax : Fpar;
      // 合力：滑动时 = F∥ − f_k > 0；静止时 = 0（静摩擦完全平衡 F∥）
      const Fnet = Fpar - f;
      const acc = Fnet / m;

      // 物块动力学：加速度与 F_net 同号 —— F_net>0 沿斜面加速下滑，F_net≤0 静止
      const h = Math.min(Math.max(dt, 0), 0.05);
      if (Fnet > 0) {
        vDown += acc * h;      // 沿斜面向下加速
        blockDist -= vDown * h; // 沿斜面向下（斜面坐标减小）
      } else {
        vDown = 0;             // 静平衡，物块不动
      }
      const lim = planeLen / 2 - 0.4;
      if (blockDist < -lim) { blockDist = lim; vDown = 0; } // 滑到底端 → 回到顶端重新下滑

      // 物块位置：沿斜面方向参数化 —— 与斜面共线（斜面局部 +x 即下坡方向），
      // 再沿法向抬升 半厚(0.075) + 物块半厚(0.3)，正好贴在斜面上不穿出
      const nLift = 0.075 + 0.3;
      const bx = -blockDist * Math.cos(theta);
      const by = blockDist * Math.sin(theta);
      block.position.set(bx + nLift * Math.sin(theta), by + nLift * Math.cos(theta), 0);
      block.rotation.z = -theta;

      // 力箭头：forceGroup 锚定在物块中心且随斜面转，分力/合力箭头局部原点 = (0,0,0)
      forceGroup.position.copy(block.position);
      forceGroup.rotation.z = -theta;

      // 重力（世界系，恒竖直向下），作用点取物块中心
      gArrow.position.copy(block.position);
      gArrow.setDirection(new THREE.Vector3(0, -1, 0));
      gArrow.setLength(Fg * 0.12, 0.25, 0.12);

      // 平行分量（沿斜面向下）
      fParArrow.position.set(0, 0, 0);
      fParArrow.setDirection(new THREE.Vector3(1, 0, 0));
      fParArrow.setLength(Fpar * 0.12, 0.25, 0.12);

      // 垂直分量（垂直斜面向下）
      fPerpArrow.position.set(0, 0, 0);
      fPerpArrow.setDirection(new THREE.Vector3(0, -1, 0));
      fPerpArrow.setLength(Fperp * 0.12, 0.25, 0.12);

      // 支持力（垂直斜面向上）
      nArrow.position.set(0, 0, 0);
      nArrow.setDirection(new THREE.Vector3(0, 1, 0));
      nArrow.setLength(N * 0.12, 0.25, 0.12);

      // 摩擦力（沿斜面向上）
      fArrow.position.set(0, 0, 0);
      fArrow.setDirection(new THREE.Vector3(-1, 0, 0));
      fArrow.setLength(f * 0.12, 0.25, 0.12);

      // 读数面板
      const deg = (theta * 180 / Math.PI).toFixed(1);
      readCtx.fillStyle = 'rgba(7,11,20,0.9)';
      readCtx.fillRect(0, 0, 220, 140);
      readCtx.fillStyle = '#f8fafc';
      readCtx.font = 'bold 14px monospace';
      readCtx.fillText(`θ = ${deg}°  (摩擦角 θc=${THETA_C_DEG.toFixed(1)}°)`, 15, 25);
      readCtx.fillStyle = '#ef4444';
      readCtx.fillText(`F∥ = ${Fpar.toFixed(2)} N`, 15, 50);
      readCtx.fillStyle = '#3b82f6';
      readCtx.fillText(`F⊥ = ${Fperp.toFixed(2)} N`, 15, 70);
      readCtx.fillStyle = '#22c55e';
      readCtx.fillText(`N = ${N.toFixed(2)} N`, 15, 90);
      readCtx.fillStyle = '#06b6d4';
      readCtx.fillText(`f = ${f.toFixed(2)} N${sliding ? '（动）' : '（静）'}`, 15, 110);
      readCtx.fillStyle = '#facc15';
      readCtx.fillText(`F_net = ${Fnet.toFixed(2)} N ${sliding ? '加速下滑' : '静止'}`, 15, 130);
      readCtx.fillStyle = '#94a3b8';
      readCtx.font = '10px sans-serif';
      readCtx.fillText('↑ 红色=平行分量', 130, 25);
      readCtx.fillText('↑ 蓝色=垂直分量', 130, 45);
      readCtx.fillText('↑ 绿色=支持力', 130, 65);
      readCtx.fillText('↑ 青色=摩擦力', 130, 85);
      readCtx.fillText('↓ 白=重力(竖直)', 130, 105);
      readTex.needsUpdate = true;

      stars.rotation.y = t * 0.004;
    },
    dispose() {
      [starGeo, readGeo].forEach((g) => g.dispose());
      stars.material.dispose();
      readTex.dispose();
      readMat.dispose();
      planeGeo.dispose();
      planeMat.dispose();
      legGeo.dispose();
      legMat.dispose();
      block.geometry?.dispose();
      block.material.dispose();
      scene.remove(group);
      scene.remove(stars);
    },
  };
}
