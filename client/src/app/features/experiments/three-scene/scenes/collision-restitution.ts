import type { SceneContext, SceneInstance } from '../types';
/** Collision Restitution（P473）：Elastic/inelastic collision with coefficient of restitution. */
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

  const restitution = 0.75;
  const wallX = 8;
  const m1 = 2, m2 = 1; // 两球质量（kg）

  // Floor
  const floorGeo = new THREE.PlaneGeometry(20, 2);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.5;
  group.add(floor);

  // Walls
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 });
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 2), wallMat);
  leftWall.position.set(-wallX, 0.5, 0);
  group.add(leftWall);
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 2), wallMat);
  rightWall.position.set(wallX, 0.5, 0);
  group.add(rightWall);

  // Ball 1 (larger, from left)
  const ball1Geo = new THREE.SphereGeometry(0.6, 24, 24);
  const ball1Mat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x1d4ed8, emissiveIntensity: 0.3 });
  const ball1 = new THREE.Mesh(ball1Geo, ball1Mat);
  group.add(ball1);

  // Ball 2 (smaller, from right)
  const ball2Geo = new THREE.SphereGeometry(0.4, 24, 24);
  const ball2Mat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.3 });
  const ball2 = new THREE.Mesh(ball2Geo, ball2Mat);
  group.add(ball2);

  // Velocity vectors
  const v1Arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 2, '#3b82f6');
  group.add(v1Arrow);
  const v2Arrow = new THREE.ArrowHelper(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 0), 1.5, '#ef4444');
  group.add(v2Arrow);

  // e 标签（canvas 文字，替代无文字的深色 Box 空壳）
  const eLabelCanvas = document.createElement('canvas');
  eLabelCanvas.width = 256;
  eLabelCanvas.height = 48;
  const eLabelCtx = eLabelCanvas.getContext('2d')!;
  const eLabelTex = new THREE.CanvasTexture(eLabelCanvas);
  const eLabelGeo = new THREE.PlaneGeometry(3.2, 0.6);
  const eLabelMat = new THREE.MeshBasicMaterial({ map: eLabelTex, transparent: true });
  const eLabel = new THREE.Mesh(eLabelGeo, eLabelMat);
  eLabel.position.set(0, 2.5, 0);
  group.add(eLabel);

  // 信息面板：p = m₁v₁+m₂v₂ 前后对照、E_k 前后与 e 读数
  const infoCanvas = document.createElement('canvas');
  infoCanvas.width = 320;
  infoCanvas.height = 150;
  const infoCtx = infoCanvas.getContext('2d')!;
  const infoTex = new THREE.CanvasTexture(infoCanvas);
  const infoGeo = new THREE.PlaneGeometry(5.6, 2.6);
  const infoMat = new THREE.MeshBasicMaterial({ map: infoTex, transparent: true });
  const infoPlot = new THREE.Mesh(infoGeo, infoMat);
  infoPlot.position.set(0, 4.6, 0);
  group.add(infoPlot);

  let tAnim = 0;
  let b1x = -4, b1v = 3.0;
  let b2x = 3, b2v = -2.0;
  // 最近一次球-球碰撞的前后快照（面板对照）
  let col: {
    pB: number; pA: number; ekB: number; ekA: number;
    v1b: number; v2b: number; v1a: number; v2a: number;
  } | null = null;
  return {
    update(t, dt) {
      tAnim += dt;
      // Move balls
      b1x += b1v * dt;
      b2x += b2v * dt;

      // Collision detection
      const dist = Math.abs(b1x - b2x);
      if (dist < 1.0 && b1v > b2v) {
        // 先快照碰撞前速度，再联立求解（勿用被覆写的 b1v）
        const u1 = b1v, u2 = b2v;
        // 动量守恒 m₁u₁+m₂u₂ = m₁v₁′+m₂v₂′ 与 e = (v₂′−v₁′)/(u₁−u₂) 联立：
        // v₁′ = [(m₁−e m₂)u₁ + (1+e)m₂u₂]/(m₁+m₂)
        // v₂′ = [(m₂−e m₁)u₂ + (1+e)m₁u₁]/(m₁+m₂)   （等质量 e=1 ⇒ 速度交换）
        const v1n = ((m1 - restitution * m2) * u1 + (1 + restitution) * m2 * u2) / (m1 + m2);
        const v2n = ((m2 - restitution * m1) * u2 + (1 + restitution) * m1 * u1) / (m1 + m2);
        b1v = v1n;
        b2v = v2n;
        col = {
          pB: m1 * u1 + m2 * u2,
          pA: m1 * v1n + m2 * v2n,
          ekB: 0.5 * m1 * u1 * u1 + 0.5 * m2 * u2 * u2,
          ekA: 0.5 * m1 * v1n * v1n + 0.5 * m2 * v2n * v2n,
          v1b: u1, v2b: u2, v1a: v1n, v2a: v2n,
        };
        // Separate
        const overlap = 1.0 - dist;
        b1x -= overlap / 2;
        b2x += overlap / 2;
      }

      // Wall bounce
      if (b1x < -wallX + 0.6) { b1x = -wallX + 0.6; b1v = Math.abs(b1v) * restitution; }
      if (b1x > wallX - 0.6) { b1x = wallX - 0.6; b1v = -Math.abs(b1v) * restitution; }
      if (b2x < -wallX + 0.4) { b2x = -wallX + 0.4; b2v = Math.abs(b2v) * restitution; }
      if (b2x > wallX - 0.4) { b2x = wallX - 0.4; b2v = -Math.abs(b2v) * restitution; }

      ball1.position.set(b1x, 0, 0);
      ball2.position.set(b2x, 0, 0);

      // Update velocity arrows
      const v1Scale = Math.min(Math.abs(b1v) * 0.5, 2);
      v1Arrow.setDirection(new THREE.Vector3(Math.sign(b1v), 0, 0));
      v1Arrow.setLength(v1Scale, v1Scale * 0.3);
      v1Arrow.position.set(b1x, 0.6, 0);

      const v2Scale = Math.min(Math.abs(b2v) * 0.5, 2);
      v2Arrow.setDirection(new THREE.Vector3(Math.sign(b2v), 0, 0));
      v2Arrow.setLength(v2Scale, v2Scale * 0.3);
      v2Arrow.position.set(b2x, 0.4, 0);

      // e 标签（canvas 文字）
      eLabelCtx.fillStyle = 'rgba(7,11,20,0.85)';
      eLabelCtx.fillRect(0, 0, 256, 48);
      eLabelCtx.fillStyle = '#fbbf24';
      eLabelCtx.font = 'bold 17px monospace';
      eLabelCtx.fillText(`e = ${restitution.toFixed(2)}  恢复系数`, 12, 31);
      eLabelTex.needsUpdate = true;

      // 信息面板（公式 + 最近一次碰撞前后对照）
      infoCtx.fillStyle = 'rgba(7,11,20,0.9)';
      infoCtx.fillRect(0, 0, 320, 150);
      infoCtx.font = '12px monospace';
      infoCtx.fillStyle = '#f8fafc';
      infoCtx.fillText('p = m₁v₁ + m₂v₂  动量总守恒', 12, 24);
      infoCtx.fillStyle = '#7dd3fc';
      infoCtx.fillText(`e = (v₂′ − v₁′)/(v₁ − v₂) = ${restitution.toFixed(2)}`, 12, 44);
      if (col) {
        infoCtx.fillStyle = '#94a3b8';
        infoCtx.fillText(`v: ${col.v1b.toFixed(2)}, ${col.v2b.toFixed(2)} → ${col.v1a.toFixed(2)}, ${col.v2a.toFixed(2)}`, 12, 68);
        infoCtx.fillStyle = '#22c55e';
        infoCtx.fillText(`碰撞前 p = ${col.pB.toFixed(3)}   E_k = ${col.ekB.toFixed(2)}`, 12, 90);
        infoCtx.fillText(`碰撞后 p = ${col.pA.toFixed(3)}   E_k = ${col.ekA.toFixed(2)}`, 12, 110);
        infoCtx.fillStyle = '#fbbf24';
        infoCtx.fillText(`Δp = ${(col.pA - col.pB).toFixed(3)}（Σp 严格守恒）`, 12, 128);
        infoCtx.fillStyle = '#f472b6';
        infoCtx.fillText(`ΔE_k = ${(col.ekB - col.ekA).toFixed(2)} = (1−e²)·E_rel`, 12, 146);
      } else {
        infoCtx.fillStyle = '#94a3b8';
        infoCtx.fillText('等待球-球碰撞…（壁为外物不计入）', 12, 90);
        infoCtx.fillText('m₁ = 2 kg   m₂ = 1 kg', 12, 112);
      }
      infoTex.needsUpdate = true;

      // Reset on long time
      if (tAnim > 15) {
        b1x = -4; b1v = 3.0;
        b2x = 3; b2v = -2.0;
        col = null;
        tAnim = 0;
      }
    },
    dispose() {
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
          (obj as any).geometry?.dispose();
          const mat = (obj as any).material;
          if (Array.isArray(mat)) mat.forEach((m: any) => m.dispose());
          else if(mat) mat.dispose();
        }
      });
      starGeo.dispose(); starMat.dispose();
      eLabelTex.dispose();
      infoTex.dispose();
    }
  };
}
