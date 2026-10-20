import type { SceneContext, SceneInstance } from '../types';
/** 哈勃图（P34）：红移与距离关系，宇宙膨胀。H₀ 为固定参数（v–d 直线斜率），高红移处超新星给出偏离线性的转折。 */
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

  // Hubble diagram canvas
  const graphCanvas = document.createElement('canvas');
  graphCanvas.width = 512;
  graphCanvas.height = 384;
  const gctx = graphCanvas.getContext('2d')!;

  // 哈勃常数：v–d 直线的斜率，取固定参数（不再逐帧来回扫/抖动）
  const H0 = 70; // km/s/Mpc
  const OMEGA_M = 0.3, OMEGA_L = 0.7, C_KMS = 299792.458; // ΛCDM 参数与光速 km/s
  // 超新星转折：同一红移处 ΛCDM 退行速度 v(z)=c∫₀^z dz′/E(z′)，E(z)=√(Ω_m(1+z)³+Ω_Λ)。
  // 低 z 时 v→cz（线性）；z 大时 E>1 ⇒ v<cz，偏离线性外推（Simpson 数值积分）。
  function vLcdm(z: number): number {
    const N = 48, h = z / N;
    let s = 0;
    for (let i = 0; i <= N; i++) {
      const zz = i * h;
      const ez = Math.sqrt(OMEGA_M * (1 + zz) ** 3 + OMEGA_L);
      s += (i === 0 || i === N ? 1 : i % 2 === 1 ? 4 : 2) / ez;
    }
    return C_KMS * s * h / 3;
  }

  function drawHubbleDiagram() {
    gctx.fillStyle = '#0f172a';
    gctx.fillRect(0, 0, 512, 384);

    gctx.strokeStyle = '#475569';
    gctx.lineWidth = 2;
    gctx.beginPath();
    gctx.moveTo(60, 30);
    gctx.lineTo(60, 340);
    gctx.lineTo(490, 340);
    gctx.stroke();

    gctx.fillStyle = '#94a3b8';
    gctx.font = '14px monospace';
    gctx.fillText('d (Mpc)', 400, 370);
    gctx.save();
    gctx.translate(15, 200);
    gctx.rotate(-Math.PI/2);
    gctx.fillText('v (km/s)', 0, 0);
    gctx.restore();

    // Data points (simulated supernova data，固定种子可复现)
    const seed = 42;
    function rand(s: number) { s = (s * 16807) % 2147483647; return s / 2147483647; }
    const samples: { d: number; v: number }[] = [];
    for (let i = 0; i < 80; i++) {
      const d = 50 + rand(seed + i * 7) * 1500;
      const z = H0 * d / C_KMS;
      const v_lcdm = vLcdm(z);
      const v = v_lcdm + (rand(seed + i * 13) - 0.5) * 3000;
      samples.push({ d, v });
    }

    const maxD = 1600;
    const maxV = H0 * maxD;

    // Hubble line v = H0 * d（低红移线性外推）
    gctx.strokeStyle = '#38bdf8';
    gctx.lineWidth = 3;
    gctx.beginPath();
    gctx.moveTo(60, 340);
    gctx.lineTo(60 + (maxD / maxD) * 430, 340 - (maxV / (H0 * maxD)) * 280);
    gctx.stroke();

    // 高红移转折：同一红移（z = H₀d/c）下超新星/ΛCDM 的 v 低于线性外推
    gctx.strokeStyle = '#fb923c';
    gctx.lineWidth = 2;
    gctx.setLineDash([7, 5]);
    gctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const d = (i / 40) * maxD;
      const z = H0 * d / C_KMS;
      const px = 60 + (d / maxD) * 430;
      const py = 340 - (vLcdm(z) / maxV) * 280;
      if (i === 0) gctx.moveTo(px, py); else gctx.lineTo(px, py);
    }
    gctx.stroke();
    gctx.setLineDash([]);

    for (const p of samples) {
      const d = p.d, v = p.v;
      const px = 60 + (d / maxD) * 430;
      const py = 340 - (v / maxV) * 280;
      const redshift = v / 300000;
      const r = Math.min(255, 100 + redshift * 200000);
      const g = Math.max(50, 150 - redshift * 100000);
      const b = Math.max(50, 200 - redshift * 150000);
      gctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
      gctx.beginPath();
      gctx.arc(px, py, 4, 0, Math.PI * 2);
      gctx.fill();
    }

    // 底部红移刻度（线性映射 z = H₀d/c），标出高红移偏离区
    gctx.fillStyle = '#64748b';
    gctx.font = '11px monospace';
    for (const zt of [0.1, 0.2, 0.3]) {
      const dz = zt * C_KMS / H0;
      gctx.fillText(`z≈${zt}`, 60 + (dz / maxD) * 430 - 15, 357);
    }

    // 图例：线性外推 vs 超新星高红移转折
    gctx.font = '13px monospace';
    gctx.strokeStyle = '#38bdf8';
    gctx.lineWidth = 3;
    gctx.beginPath(); gctx.moveTo(66, 50); gctx.lineTo(96, 50); gctx.stroke();
    gctx.fillStyle = '#38bdf8';
    gctx.fillText('线性外推 v = H₀ d（低 z）', 102, 54);
    gctx.strokeStyle = '#fb923c';
    gctx.lineWidth = 2;
    gctx.setLineDash([5, 4]);
    gctx.beginPath(); gctx.moveTo(66, 76); gctx.lineTo(96, 76); gctx.stroke();
    gctx.setLineDash([]);
    gctx.fillStyle = '#fb923c';
    gctx.fillText('超新星 Ia：高 z 偏离线性（转折）', 102, 80);

    // H0 label：固定参数（不做逐帧扫描）
    gctx.fillStyle = '#38bdf8';
    gctx.font = '16px monospace';
    gctx.fillText(`H₀ = ${H0.toFixed(1)} km/s/Mpc`, 320, 50);
    gctx.fillStyle = '#94a3b8';
    gctx.font = '12px monospace';
    gctx.fillText('（v–d 直线斜率·固定参数）', 320, 70);

    // 标准烛光测距：横轴 d 的来源——由 Ia 超新星的视星等反演光度距离
    gctx.fillStyle = '#fbbf24';
    gctx.font = '13px monospace';
    gctx.fillText('标准烛光（Ia 超新星）测距：', 102, 104);
    gctx.fillStyle = '#e2e8f0';
    gctx.font = '12px monospace';
    gctx.fillText('距离模数 m−M = 5·lg(d/10pc)', 110, 122);
    gctx.fillText('⇒ 由视星等 m 反演光度距离 d（横轴）', 110, 138);
  }

  drawHubbleDiagram();
  const graphTex = new THREE.CanvasTexture(graphCanvas);
  const graphGeo = new THREE.PlaneGeometry(6, 4.5);
  const graphMat = new THREE.MeshBasicMaterial({ map: graphTex });
  const graphMesh = new THREE.Mesh(graphGeo, graphMat);
  graphMesh.position.set(0, 0, -5);
  group.add(graphMesh);

  // Expanding universe visualization
  const galaxies: { mesh: import("three").Mesh; pos: import('three').Vector3 }[] = [];
  const galaxyColors = [0x38bdf8, 0xa78bfa, 0xf472b6, 0xfb923c, 0x4ade80];
  for (let i = 0; i < 50; i++) {
    const geo = new THREE.SphereGeometry(0.08 + Math.random() * 0.12, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: galaxyColors[i % galaxyColors.length] });
    const mesh = new THREE.Mesh(geo, mat);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 1 + Math.random() * 4;
    mesh.position.set(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi)
    );
    group.add(mesh);
    galaxies.push({
      mesh,
      pos: mesh.position.clone()
    });
  }

  // 退行速度矢量：v = H·d（长度 ∝ 距离）——把哈勃定律的线性关系直接画进 3D 空间
  const recessArrows: import('three').ArrowHelper[] = [];
  for (let i = 0; i < 6 && i < galaxies.length; i++) {
    const ar = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 1, 0xf472b6, 0.24, 0.14);
    group.add(ar);
    recessArrows.push(ar);
  }

  // Central observer
  const observerGeo = new THREE.SphereGeometry(0.2, 16, 16);
  const observerMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
  const observer = new THREE.Mesh(observerGeo, observerMat);
  group.add(observer);

  // Light cone
  const coneGeo = new THREE.ConeGeometry(3, 6, 32, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.y = 3;
  group.add(cone);

  let time = 0;
  return {
    update(t, dt) {
      time = t;
      // 哈勃图为静态 ΛCDM 计算图（H₀ 固定参数），按 5Hz 刷新即可，不必逐帧重绘
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) {
        drawHubbleDiagram();
        graphTex.needsUpdate = true;
      }

      // 均匀标度膨胀：所有位置同乘 (1 + H·dt)，退行速度 v = ṙ = H·d（哈勃定律 v∝d 由空间动画直接支撑）
      const HubbleRate = 0.06; // 示意膨胀率 s⁻¹（去掉逐星系随机 vel，改用统一标度因子）
      galaxies.forEach((g, idx) => {
        g.pos.multiplyScalar(1 + HubbleRate * dt);
        const nd = g.pos.length();
        if (nd > 8) g.pos.multiplyScalar(1.5 / nd); // 越界回收：沿原方向重置到内界，持续退行
        g.mesh.position.copy(g.pos);
        // 红移 z ∝ 距离 ∝ 退行速度（同源）：越远越红
        const z = Math.min(1, g.pos.length() * 0.11);
        const mat = g.mesh.material as import("three").MeshBasicMaterial;
        mat.color.setRGB(0.22 + 0.72 * z, 0.62 - 0.42 * z, 0.92 - 0.78 * z);
        // 退行速度箭头：长度 ∝ H·d，直观展示线性关系
        if (idx < recessArrows.length) {
          const ar = recessArrows[idx];
          ar.position.set(0, 0, 0);
          ar.setDirection(g.pos.clone().normalize());
          ar.setLength(g.pos.length(), 0.24, 0.14);
        }
      });

      cone.rotation.y += dt * 0.3;
      cone.scale.setScalar(1 + Math.sin(t) * 0.05);
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
      graphTex.dispose();
    }
  };
}
