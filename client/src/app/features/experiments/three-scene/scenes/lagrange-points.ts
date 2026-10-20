import type { SceneContext, SceneInstance } from '../types';
/**
 * 拉格朗日点（P36）：限制性三体问题中的五个平衡点。
 *
 * 坐标系（全场景统一，勿混用）：日心旋转系 —— 太阳固定在原点，
 * 地球在 +x（日心距 r12 = 8），地球、L 点与连接线以同一角速度 ω 共转，
 * L1/L2/L3 按标准日心距公式给出，L4/L5 位于轨道面内与日地连线成 ±60°。
 */
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

  // Two primary bodies (Sun and Earth scaled)
  const M1 = 1.0; // Sun
  const M2 = 0.001; // Earth
  const mu = M2 / (M1 + M2);
  const r12 = 8;

  // Sun (large, yellow)
  const sunGeo = new THREE.SphereGeometry(0.8, 32, 32);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  group.add(sun);

  // Earth (small, blue)
  const earthGeo = new THREE.SphereGeometry(0.3, 16, 16);
  const earthMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const earth = new THREE.Mesh(earthGeo, earthMat);
  group.add(earth);

  // Orbit paths
  const sunOrbitGeo = new THREE.RingGeometry(0.75, 0.85, 64);
  const sunOrbitMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide, transparent: true, opacity: 0.3 });
  const sunOrbit = new THREE.Mesh(sunOrbitGeo, sunOrbitMat);
  sunOrbit.rotation.x = Math.PI / 2;
  group.add(sunOrbit);

  const earthOrbitGeo = new THREE.RingGeometry(r12 - 0.05, r12 + 0.05, 64);
  const earthOrbitMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.3 });
  const earthOrbit = new THREE.Mesh(earthOrbitGeo, earthOrbitMat);
  earthOrbit.rotation.x = Math.PI / 2;
  group.add(earthOrbit);

  // Calculate Lagrange points（基矢取 t=0 时地球在 +x 的日心系，update 中随 ω 共转）
  function calcLagrangePoints() {
    const points: { pos: import('three').Vector3; label: string; color: number }[] = [];
    const r = r12;
    const d = r * Math.pow(mu / 3, 1 / 3); // L1/L2 相对太阳的偏移量

    // L1: between bodies（日地之间，日心距 r − d）
    points.push({ pos: new THREE.Vector3(r - d, 0, 0), label: 'L1', color: 0x4ade80 });

    // L2: beyond smaller body（地球外侧，日心距 r + d）
    points.push({ pos: new THREE.Vector3(r + d, 0, 0), label: 'L2', color: 0x4ade80 });

    // L3: beyond larger body（太阳另一侧，与地球近似对称，日心距 r(1 + 5μ/12)）
    points.push({ pos: new THREE.Vector3(-r * (1 + 5 * mu / 12), 0, 0), label: 'L3', color: 0x4ade80 });

    // L4: equilateral triangle（轨道面内，领先地球 60°）
    points.push({ pos: new THREE.Vector3(r * Math.cos(Math.PI / 3), 0, r * Math.sin(Math.PI / 3)), label: 'L4', color: 0xf472b6 });

    // L5: equilateral triangle（轨道面内，落后地球 60°）
    points.push({ pos: new THREE.Vector3(r * Math.cos(Math.PI / 3), 0, -r * Math.sin(Math.PI / 3)), label: 'L5', color: 0xf472b6 });

    return points;
  }

  const lagrangePoints = calcLagrangePoints();
  const pointMeshes: import("three").Mesh[] = [];
  const labelMeshes: import("three").Mesh[] = [];

  lagrangePoints.forEach((lp) => {
    const geo = new THREE.SphereGeometry(0.15, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: lp.color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(lp.pos);
    group.add(mesh);
    pointMeshes.push(mesh);

    // Label
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx2d = canvas.getContext('2d')!;
    ctx2d.fillStyle = '#ffffff';
    ctx2d.font = 'bold 36px monospace';
    ctx2d.textAlign = 'center';
    ctx2d.textBaseline = 'middle';
    ctx2d.fillText(lp.label, 32, 32);
    const tex = new THREE.CanvasTexture(canvas);
    const labelGeo = new THREE.PlaneGeometry(0.6, 0.6);
    const labelMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.set(0, 0.4, 0); // 局部坐标：挂在标记上，随标记一起共转
    mesh.add(labelMesh);
    labelMeshes.push(labelMesh);
  });

  // Connection lines：每个 L 点连到太阳（原点）与地球，位置每帧跟随共转
  const connLines: import('three').Line[] = [];
  lagrangePoints.forEach((lp) => {
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      lp.pos.clone(), new THREE.Vector3(0, 0, 0),
      lp.pos.clone(), new THREE.Vector3(0, 0, 0),
    ]);
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.4 }));
    group.add(line);
    connLines.push(line);
  });

  // —— 坐标系与公式说明面板（与日心旋转系的实现同步） ——
  const infoCanvas = document.createElement('canvas');
  infoCanvas.width = 460;
  infoCanvas.height = 205;
  const infoCtx = infoCanvas.getContext('2d')!;
  infoCtx.fillStyle = 'rgba(7,11,20,0.9)';
  infoCtx.fillRect(0, 0, 460, 205);
  infoCtx.font = 'bold 15px monospace';
  infoCtx.fillStyle = '#f8fafc';
  infoCtx.fillText('日心旋转系：太阳在原点，地球在 +x（r = 8）', 14, 28);
  infoCtx.font = '14px monospace';
  infoCtx.fillStyle = '#4ade80';
  infoCtx.fillText('L1 = r − d          日地之间', 14, 58);
  infoCtx.fillText('L2 = r + d          地球外侧', 14, 86);
  infoCtx.fillText('L3 = −r(1 + 5μ/12)  与地球对称', 14, 114);
  infoCtx.fillStyle = '#f472b6';
  infoCtx.fillText('L4/L5 = r·e^(∓i60°) 轨道面内 ±60°', 14, 142);
  infoCtx.fillStyle = '#94a3b8';
  infoCtx.font = '12px monospace';
  infoCtx.fillText('d = r(μ/3)^(1/3)；μ(演示)=0.001，真实 M⊕/M☉≈3×10⁻⁶（放大约 333×，仅利可视', 14, 166);
  infoCtx.fillText('量级）⇒ L1/L2 距离比被夸大；有效势：L4/5 稳定极大、L1/2/3 鞍点不稳定', 14, 183);
  const infoTex = new THREE.CanvasTexture(infoCanvas);
  const infoGeo = new THREE.PlaneGeometry(5.9, 2.63);
  const infoMat = new THREE.MeshBasicMaterial({ map: infoTex, transparent: true });
  const infoPlot = new THREE.Mesh(infoGeo, infoMat);
  infoPlot.position.set(0, 5.9, 0);
  group.add(infoPlot);

  // —— 有效势等势轮廓层（日心旋转系，绕 x-z 平面）——
  //   Ψ(x,z) = −M1/|r−R1| − M2/|r−R2| − ½ω²|r|²  （离心项取负号 ⇒ 势能面）
  //   L4/L5 是 Ψ 的极大（稳定，科里奥利力兜住）、L1/2/3 是鞍点（不稳定）——与 Hessian 复算一致。
  const W2 = (M1 + M2) / (r12 * r12 * r12); // 与 r12、μ 同源的开普勒 ω²
  const WORLD = 11; // 半幅（世界单位），画 x∈[-WORLD,WORLD]
  const psiCanvas = document.createElement('canvas');
  psiCanvas.width = 256; psiCanvas.height = 256;
  {
    const pc = psiCanvas.getContext('2d')!;
    const img = pc.createImageData(256, 256);
    function psi(wx1: number, wz1: number): number {
      const r1 = Math.hypot(wx1, wz1);
      const r2 = Math.hypot(wx1 - r12, wz1);
      return -M1 / (r1 + 0.15) - M2 / (r2 + 0.05) - 0.5 * W2 * (wx1 * wx1 + wz1 * wz1);
    }
    // 先求值域用于着色
    let mn = Infinity, mx = -Infinity;
    const vals = new Float32Array(256 * 256);
    for (let py = 0; py < 256; py++) {
      for (let px = 0; px < 256; px++) {
        const wx1 = (px / 255 - 0.5) * 2 * WORLD;
        const wz1 = (py / 255 - 0.5) * 2 * WORLD;
        const v = psi(wx1, wz1); vals[py * 256 + px] = v;
        if (v < mn) mn = v; if (v > mx) mx = v;
      }
    }
    for (let py = 0; py < 256; py++) {
      for (let px = 0; px < 256; px++) {
        const i = py * 256 + px;
        const v = vals[i];
        const q = (v - mn) / (mx - mn);
        // 等势环带：对 q 量化出条纹
        const band = Math.floor(q * 16);
        const lum = 18 + band * 8;
        const edge = (q * 16 - band) > 0.86 ? 1 : 0;
        const o = i * 4;
        img.data[o] = lum * 0.5 + edge * 40;
        img.data[o + 1] = lum * 0.7 + edge * 70;
        img.data[o + 2] = lum + edge * 90;
        img.data[o + 3] = edge ? 255 : 175;
      }
    }
    pc.putImageData(img, 0, 0);
  }
  const psiTex = new THREE.CanvasTexture(psiCanvas);
  const psiGeo = new THREE.PlaneGeometry(2 * WORLD, 2 * WORLD);
  const psiMat = new THREE.MeshBasicMaterial({ map: psiTex, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });
  const psiPlane = new THREE.Mesh(psiGeo, psiMat);
  psiPlane.rotation.x = -Math.PI / 2; // 铺在 x-z 轨道面
  psiPlane.position.y = -0.001;
  const psiSpin = new THREE.Group();
  psiSpin.add(psiPlane);
  group.add(psiSpin);

  let time = 0;
  return {
    update(t, dt) {
      time = t;
      const omega = 1;

      // Rotate system
      group.rotation.y = t * omega * 0.3;

      // 日心旋转系：太阳固定在原点，地球在半径 r12 的圆轨道上（与 L 点同 ω）
      sun.position.set(0, 0, 0);
      const earthAngle = t * omega;
      earth.position.set(Math.cos(earthAngle) * r12, 0, Math.sin(earthAngle) * r12);

      // L 点与连接线：与地球同角速度共转（基矢为 t=0 地球在 +x 的日心系）
      const cosA = Math.cos(t * omega);
      const sinA = Math.sin(t * omega);
      lagrangePoints.forEach((lp, idx) => {
        const b = lp.pos;
        const px = b.x * cosA - b.z * sinA;
        const pz = b.x * sinA + b.z * cosA;
        pointMeshes[idx].position.set(px, b.y, pz);

        // 连接线跟随：L 点 → 太阳（原点）→ L 点 → 地球
        const geo = connLines[idx].geometry;
        const attr = geo.getAttribute('position') as import('three').BufferAttribute;
        attr.setXYZ(0, px, b.y, pz);
        attr.setXYZ(1, 0, 0, 0);
        attr.setXYZ(2, px, b.y, pz);
        attr.setXYZ(3, earth.position.x, earth.position.y, earth.position.z);
        attr.needsUpdate = true;
        geo.computeBoundingSphere();
      });

      // 有效势轮廓与地球/L 标记同源共转（图案关于日地 x 轴对称，镜像不改变鞍点/极大分布）
      psiSpin.rotation.y = t * omega;

      // 说明面板始终面向相机（抵消 group 的整体旋转）
      infoPlot.lookAt(ctx.camera.position);

      // Pulse Lagrange points（标签抵消脉动缩放，只跟随平移）
      pointMeshes.forEach((mesh, idx) => {
        const pulse = 1 + 0.2 * Math.sin(t * 3 + idx);
        mesh.scale.setScalar(pulse);
        const lbl = labelMeshes[idx];
        lbl.scale.setScalar(1 / pulse);
        lbl.position.y = 0.4 / pulse;
      });
    },
    dispose() {
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
          (obj as any).geometry?.dispose();
          const mat = (obj as any).material;
          if (Array.isArray(mat)) mat.forEach((m: any) => m.dispose());
          else if (mat) mat.dispose();
        }
      });
      starGeo.dispose(); starMat.dispose();
      infoTex.dispose();
    }
  };
}
