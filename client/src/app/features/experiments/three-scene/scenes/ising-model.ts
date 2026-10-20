import type { SceneContext, SceneInstance } from '../types';
/**
 * Ising模型（P39）：二维自旋系统 Metropolis 蒙特卡洛 + 相变。
 *   ΔE=2s·Σ_nn，接受概率 min(1,e^{−ΔE/T})；Onsager 自发磁化 M=[1−sinh⁻⁴(2/T)]^{1/8}（T<Tc）；Tc=2.269。
 *   临界涨落→磁化率：χ=N·(⟨m²⟩−⟨m⟩²)/T（涨落-耗散），在 Tc 附近达峰。每帧多轮扫描以消除弛豫滞后。
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

  const N = 16;
  const spacing = 0.5;
  const spins: number[][] = [];
  const spinMeshes: import("three").Mesh[] = [];

  // Initialize random spins
  for (let i = 0; i < N; i++) {
    spins[i] = [];
    for (let j = 0; j < N; j++) {
      spins[i][j] = Math.random() < 0.5 ? 1 : -1;
    }
  }

  // Create spin cubes
  const cubeGeo = new THREE.BoxGeometry(spacing * 0.8, spacing * 0.8, spacing * 0.8);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const mesh = new THREE.Mesh(cubeGeo, mat);
      mesh.position.set(
        (i - N/2) * spacing,
        0,
        (j - N/2) * spacing
      );
      group.add(mesh);
      spinMeshes.push(mesh);
    }
  }

  // Magnetization vs Temperature graph
  const graphCanvas = document.createElement('canvas');
  graphCanvas.width = 512;
  graphCanvas.height = 384;
  const gctx = graphCanvas.getContext('2d')!;

  const Tc = 2.269;
  // Onsager 自发磁化强度（解析）：T<Tc 时 M=[1−sinh⁻⁴(2/T)]^(1/8)，T≥Tc 时 M=0
  function onsagerM(T: number): number {
    if (T >= Tc) return 0;
    if (T <= 0) return 1;
    return Math.pow(1 - Math.pow(Math.sinh(2 / T), -4), 1 / 8);
  }

  const chiHist: { T: number; chi: number }[] = [];

  function drawMagnetizationCurve(T: number, measuredM: number, chi: number) {
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
    gctx.fillText('T (J/kB)', 400, 370);
    gctx.save();
    gctx.translate(15, 200);
    gctx.rotate(-Math.PI/2);
    gctx.fillText('M', 0, 0);
    gctx.restore();

    // Theoretical curve (Onsager)
    gctx.strokeStyle = '#38bdf8';
    gctx.lineWidth = 3;
    gctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const x = 60 + (i / 200) * 430;
      const T = (i / 200) * 5;
      const M = onsagerM(T);
      const y = 340 - M * 280;
      if (i === 0) gctx.moveTo(x, y);
      else gctx.lineTo(x, y);
    }
    gctx.stroke();

    // Critical temperature marker
    const Tcx = 60 + (Tc / 5) * 430;
    gctx.strokeStyle = '#f472b6';
    gctx.lineWidth = 1;
    gctx.setLineDash([4, 4]);
    gctx.beginPath();
    gctx.moveTo(Tcx, 30);
    gctx.lineTo(Tcx, 340);
    gctx.stroke();
    gctx.setLineDash([]);
    gctx.fillStyle = '#f472b6';
    gctx.fillText('Tc', Tcx + 5, 45);

    // Current temperature marker
    const Tx = 60 + (Math.min(T, 5) / 5) * 430;
    gctx.strokeStyle = '#fbbf24';
    gctx.beginPath();
    gctx.moveTo(Tx, 30);
    gctx.lineTo(Tx, 340);
    gctx.stroke();

    // Mark theoretical M(T) point on the curve + readouts (linked to simulation)
    const Mnow = onsagerM(T);
    const Mx = Tx;
    const My = 340 - Mnow * 280;
    gctx.fillStyle = '#38bdf8';
    gctx.beginPath();
    gctx.arc(Mx, My, 5, 0, Math.PI * 2);
    gctx.fill();
    gctx.fillStyle = '#e2e8f0';
    gctx.font = '13px monospace';
    gctx.fillText(`T = ${T.toFixed(2)}`, 70, 300);
    gctx.fillStyle = '#38bdf8';
    gctx.fillText(`M(Onsager) = ${Mnow.toFixed(3)}`, 70, 318);
    gctx.fillStyle = '#fbbf24';
    gctx.fillText(`M(实测|m|) = ${measuredM.toFixed(3)}`, 70, 336);

    // ===== 右上插图：磁化率 χ(T)（临界涨落）——concept"临界现象"的直观呈现 =====
    // 记录自旋涨落样本（与模拟同源），先入栈再定标
    chiHist.push({ T, chi });
    if (chiHist.length > 640) chiHist.shift();
    const IX0 = 300, IY0 = 40, IX1 = 490, IY1 = 160; // 插图像素框
    gctx.fillStyle = '#0b1120'; gctx.fillRect(IX0, IY0, IX1 - IX0, IY1 - IY0);
    gctx.strokeStyle = '#475569'; gctx.lineWidth = 1; gctx.strokeRect(IX0, IY0, IX1 - IX0, IY1 - IY0);
    // 温度扫描区间 0→3.2（temperature=1.5±1.5，跨越 Tc=2.269）；χ 幅值自适应实测峰
    const tMaxI = 3.2;
    let chiMaxI = 1.0;
    for (const h of chiHist) if (h.chi > chiMaxI) chiMaxI = h.chi;
    chiMaxI *= 1.15;
    const mapX = (tt: number) => IX0 + (Math.min(tt, tMaxI) / tMaxI) * (IX1 - IX0);
    const mapY = (cc: number) => IY1 - 2 - (Math.min(cc, chiMaxI) / chiMaxI) * (IY1 - IY0 - 12);
    // Tc 参考线
    const TcxI = mapX(Tc);
    gctx.strokeStyle = '#f472b6'; gctx.setLineDash([4, 4]); gctx.lineWidth = 1;
    gctx.beginPath(); gctx.moveTo(TcxI, IY0 + 2); gctx.lineTo(TcxI, IY1 - 2); gctx.stroke();
    gctx.setLineDash([]);
    // 理论示意峰 χ∝1/|T−Tc|（按实测幅值定标，仅示"在 Tc 处发散/达峰"的趋势，与实测点同一标度）
    const wpk = 0.18;
    gctx.strokeStyle = '#a855f7'; gctx.lineWidth = 2; gctx.beginPath();
    for (let i = 0; i <= 140; i++) {
      const tt = (i / 140) * tMaxI;
      const g = wpk / (wpk + Math.abs(tt - Tc)); // 0..1 峰形，Tc 处=1
      const x = mapX(tt), y = mapY(g * chiMaxI);
      if (i === 0) gctx.moveTo(x, y); else gctx.lineTo(x, y);
    }
    gctx.stroke();
    // 实测散点（金）+ 当前点（绿）
    gctx.fillStyle = 'rgba(251,191,36,0.7)';
    for (const h of chiHist) gctx.fillRect(mapX(h.T) - 1, mapY(h.chi) - 1, 2, 2);
    gctx.fillStyle = '#22c55e';
    gctx.beginPath(); gctx.arc(mapX(T), mapY(chi), 4, 0, Math.PI * 2); gctx.fill();
    // 图注
    gctx.fillStyle = '#94a3b8'; gctx.font = '11px monospace';
    gctx.fillText('χ(T) 磁化率（临界涨落）', IX0 + 6, IY0 + 13);
    gctx.fillStyle = '#a855f7';
    gctx.fillText('示意峰 ∝1/|T−Tc|', IX0 + 6, IY1 - 18);
    gctx.fillStyle = '#fbbf24';
    gctx.fillText('实测 N⟨δm²⟩/T', IX0 + 6, IY1 - 6);
    gctx.fillStyle = '#e2e8f0'; gctx.font = '12px monospace';
    gctx.fillText(`χ(实测) = ${chi.toFixed(2)}`, 70, 354);
  }

  drawMagnetizationCurve(1.5, 0, 0);
  const graphTex = new THREE.CanvasTexture(graphCanvas);
  const graphGeo = new THREE.PlaneGeometry(6, 4.5);
  const graphMat = new THREE.MeshBasicMaterial({ map: graphTex });
  const graphMesh = new THREE.Mesh(graphGeo, graphMat);
  graphMesh.position.set(0, 0, -5);
  group.add(graphMesh);

  let time = 0;
  let temperature = 1.5;
  // 涨落-耗散定理求磁化率：χ = N·(⟨m²⟩−⟨m⟩²)/kT（m 为逐自旋磁化强度），用指数滑动平均累积
  let emaM = 0, emaM2 = 0;
  const EMA_A = 0.04;
  return {
    update(t, dt) {
      time = t;
      temperature = 1.5 + Math.sin(t * 0.3) * 1.5;

      // Metropolis 单点翻转：每帧做多次扫描（N² 量级尝试）以加速弛豫，消除升/降温滞后
      const T = Math.max(temperature, 0.05);
      const SWEEPS = 3;
      for (let sweep = 0; sweep < SWEEPS; sweep++) {
        for (let a = 0; a < N * N; a++) {
          const i = Math.floor(Math.random() * N);
          const j = Math.floor(Math.random() * N);
          const s = spins[i][j];
          let E_neighbor = 0;
          if (i > 0) E_neighbor += spins[i-1][j];
          if (i < N-1) E_neighbor += spins[i+1][j];
          if (j > 0) E_neighbor += spins[i][j-1];
          if (j < N-1) E_neighbor += spins[i][j+1];
          const dE = 2 * s * E_neighbor;
          if (dE <= 0 || Math.random() < Math.exp(-dE / T)) {
            spins[i][j] = -s;
          }
        }
      }

      // Update spin colors（同时累积 m、m²，与 χ 实测同源）
      let magnetization = 0;
      spinMeshes.forEach((mesh, idx) => {
        const i = Math.floor(idx / N);
        const j = idx % N;
        const s = spins[i][j];
        magnetization += s;
        const mat = mesh.material as import("three").MeshBasicMaterial;
        if (s > 0) {
          mat.color.setHex(0x38bdf8); // up: blue
        } else {
          mat.color.setHex(0xf472b6); // down: pink
        }
        mesh.position.y = s * 0.15 * Math.sin(t * 3 + i + j);
      });
      magnetization /= (N * N);

      // 涨落 → 磁化率（临界涨落在 Tc 附近发散）
      emaM += (magnetization - emaM) * EMA_A;
      emaM2 += (magnetization * magnetization - emaM2) * EMA_A;
      const chi = (N * Math.max(0, emaM2 - emaM * emaM)) / T;

      drawMagnetizationCurve(temperature, Math.abs(magnetization), chi);
      graphTex.needsUpdate = true;
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
