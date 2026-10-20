import type { SceneContext, SceneInstance } from '../types';
/**  scaling律（P28）：平方-立方律可视化。 */
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

  // Scaling law visualization: compare objects of different sizes
  const scales = [0.5, 1.0, 2.0, 4.0];
  const cubes: import("three").Mesh[] = [];
  const labels: HTMLCanvasElement[] = [];

  scales.forEach((scale, idx) => {
    const size = scale;
    const geo = new THREE.BoxGeometry(size, size, size);
    const mat = new THREE.MeshBasicMaterial({
      color: idx === 0 ? 0x38bdf8 : idx === 1 ? 0x4ade80 : idx === 2 ? 0xfb923c : 0xf472b6,
      wireframe: idx > 0
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((idx - 1.5) * 3.5, size / 2, 0);
    group.add(mesh);
    cubes.push(mesh);

    // Surface area and volume labels via canvas
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx2d = canvas.getContext('2d')!;
    ctx2d.fillStyle = '#0f172a';
    ctx2d.fillRect(0, 0, 256, 128);
    ctx2d.fillStyle = '#e2e8f0';
    ctx2d.font = '18px monospace';
    ctx2d.fillText(`scale = ${scale}`, 20, 30);
    ctx2d.fillStyle = '#38bdf8';
    ctx2d.fillText(`A = ${(6*scale*scale).toFixed(1)}`, 20, 60);
    ctx2d.fillStyle = '#f472b6';
    ctx2d.fillText(`V = ${(scale*scale*scale).toFixed(1)}`, 20, 90);
    ctx2d.fillStyle = '#94a3b8';
    ctx2d.fillText(`A/V = ${(6/scale).toFixed(2)}`, 20, 115);

    const tex = new THREE.CanvasTexture(canvas);
    const labelGeo = new THREE.PlaneGeometry(2.5, 1.25);
    const labelMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.set((idx - 1.5) * 3.5, size / 2 + 1.5, 0);
    group.add(labelMesh);
    labels.push(canvas);
  });

  // Graph: A ~ L² and V ~ L³
  const graphCanvas = document.createElement('canvas');
  graphCanvas.width = 512;
  graphCanvas.height = 384;
  const gctx = graphCanvas.getContext('2d')!;

  function drawScalingGraph() {
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
    gctx.fillText('scale factor (L)', 350, 370);
    gctx.save();
    gctx.translate(15, 200);
    gctx.rotate(-Math.PI/2);
    gctx.fillText('A, V', 0, 0);
    gctx.restore();

    // A = L² (blue)
    gctx.strokeStyle = '#38bdf8';
    gctx.lineWidth = 3;
    gctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const L = (i / 100) * 5;
      const A = L * L;
      const px = 60 + (L / 5) * 430;
      const py = 340 - (A / 25) * 280;
      if (i === 0) gctx.moveTo(px, py);
      else gctx.lineTo(px, py);
    }
    gctx.stroke();

    // V = L³ (pink)
    gctx.strokeStyle = '#f472b6';
    gctx.lineWidth = 3;
    gctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const L = (i / 100) * 5;
      const V = L * L * L;
      const px = 60 + (L / 5) * 430;
      const py = 340 - (V / 125) * 280;
      if (i === 0) gctx.moveTo(px, py);
      else gctx.lineTo(px, py);
    }
    gctx.stroke();

    // Legend
    gctx.fillStyle = '#38bdf8';
    gctx.fillRect(380, 40, 20, 3);
    gctx.fillText('A ∝ L²', 405, 55);
    gctx.fillStyle = '#f472b6';
    gctx.fillRect(380, 70, 20, 3);
    gctx.fillText('V ∝ L³', 405, 85);

    // Square-cube law warning
    gctx.fillStyle = '#fbbf24';
    gctx.font = '13px monospace';
    gctx.fillText('Square-Cube Law:', 60, 280);
    gctx.fillText('Double size → 4× area, 8× volume', 60, 300);
    gctx.fillText('Strength ∝ area, Weight ∝ volume', 60, 320);
  }

  drawScalingGraph();
  const graphTex = new THREE.CanvasTexture(graphCanvas);
  const graphGeo = new THREE.PlaneGeometry(6, 4.5);
  const graphMat = new THREE.MeshBasicMaterial({ map: graphTex });
  const graphMesh = new THREE.Mesh(graphGeo, graphMat);
  graphMesh.position.set(0, 0, -5);
  group.add(graphMesh);

  let time = 0;
  return {
    update(t, dt) {
      time = t;
      cubes.forEach((cube, idx) => {
        cube.rotation.y += dt * (0.5 + idx * 0.2);
        cube.rotation.x = Math.sin(t * 0.5 + idx) * 0.1;
        const scale = scales[idx];
        cube.position.y = scale / 2 + Math.sin(t + idx * 1.5) * 0.15;
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
      graphTex.dispose();
    }
  };
}
