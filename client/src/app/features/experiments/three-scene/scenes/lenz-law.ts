import type { SceneContext, SceneInstance } from '../types';
/** Lenz's Law（P303）：Induced current opposing magnetic flux change. */
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

  // Solenoid coil (ring)
  const coilRadius = 2.5;
  const coilTurns = 20;
  for (let i = 0; i < coilTurns; i++) {
    const angle = (i / coilTurns) * Math.PI * 2;
    const turnGeo = new THREE.TorusGeometry(coilRadius, 0.06, 8, 48);
    const turnMat = new THREE.MeshStandardMaterial({ color: 0xd97706, emissive: 0x92400e, emissiveIntensity: 0.2 });
    const turn = new THREE.Mesh(turnGeo, turnMat);
    turn.position.set(0, 0, (i - coilTurns / 2) * 0.15);
    turn.rotation.y = angle;
    group.add(turn);
  }

  // Connected wire loop (large)
  const loopGeo = new THREE.TorusGeometry(4, 0.05, 8, 64);
  const loopMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
  const loop = new THREE.Mesh(loopGeo, loopMat);
  loop.position.z = -3;
  group.add(loop);

  // Galvanometer (circle with needle)
  const galvGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.2, 24);
  const galvMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
  const galv = new THREE.Mesh(galvGeo, galvMat);
  galv.rotation.x = Math.PI / 2;
  galv.position.set(5, 0, -3);
  group.add(galv);

  const needleGeo = new THREE.ConeGeometry(0.08, 0.5, 8);
  const needleMat = new THREE.MeshStandardMaterial({ color: 0xef4444 });
  const needle = new THREE.Mesh(needleGeo, needleMat);
  needle.position.set(5, 0.15, -3);
  group.add(needle);

  // Bar magnet
  const magnetGeo = new THREE.BoxGeometry(0.8, 0.4, 2.5);
  const magnetMatN = new THREE.MeshStandardMaterial({ color: 0xef4444 });
  const magnetMatS = new THREE.MeshStandardMaterial({ color: 0x3b82f6 });
  const magnet = new THREE.Mesh(magnetGeo, [magnetMatN, magnetMatN, magnetMatN, magnetMatN, magnetMatN, magnetMatS]);
  group.add(magnet);

  // Magnetic field lines around magnet
  const fieldLines = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const pts: import('three').Vector3[] = [];
    for (let j = 0; j <= 40; j++) {
      const t = j / 40;
      const r = 1.5 + t * 3;
      const y = Math.sin(t * Math.PI) * 2;
      pts.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r));
    }
    const flGeo = new THREE.BufferGeometry().setFromPoints(pts);
    fieldLines.push(new THREE.Line(flGeo, new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.3 })));
    group.add(fieldLines[fieldLines.length - 1]);
  }

  // B-field direction arrows through coil
  const bArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -2), 1.5, '#ef4444');
  group.add(bArrow);

  // Induced current arrow (circular)
  const currArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(coilRadius + 0.5, 0, 0), 0.8, '#22c55e');
  group.add(currArrow);

  // —— 信息面板（Φ / I 读数）——
  const LENZ_A = 1.5;   // 磁铁-线圈特征距离
  const LENZ_GAIN = 4;  // 检流计增益
  const panelCanvas = document.createElement('canvas');
  panelCanvas.width = 320;
  panelCanvas.height = 200;
  const panelCtx = panelCanvas.getContext('2d')!;
  const panelTex = new THREE.CanvasTexture(panelCanvas);
  const panelMat = new THREE.MeshBasicMaterial({ map: panelTex, transparent: true });
  const panelMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.75), panelMat);
  panelMesh.position.set(6.6, 3.0, -3);
  group.add(panelMesh);

  function drawPanel(flux: number, current: number) {
    panelCtx.fillStyle = 'rgba(7,11,20,0.88)';
    panelCtx.fillRect(0, 0, 320, 200);
    panelCtx.fillStyle = '#f8fafc';
    panelCtx.font = 'bold 16px monospace';
    panelCtx.fillText('楞次定律  I ∝ −dΦ/dt', 14, 26);
    panelCtx.fillStyle = '#7dd3fc';
    panelCtx.font = '15px monospace';
    panelCtx.fillText(`磁通量 Φ = ${(flux * 10).toFixed(2)}`, 14, 62);
    panelCtx.fillStyle = current >= 0 ? '#22c55e' : '#f472b6';
    panelCtx.fillText(`感应电流 I = ${current.toFixed(2)}`, 14, 92);
    // 电流条（中心为 0）
    panelCtx.fillStyle = '#334155';
    panelCtx.fillRect(14, 108, 292, 14);
    const clamped = Math.max(-1, Math.min(1, current));
    const w = clamped * 142;
    panelCtx.fillStyle = current >= 0 ? '#22c55e' : '#f472b6';
    panelCtx.fillRect(w >= 0 ? 160 : 160 + w, 108, Math.abs(w), 14);
    panelCtx.fillStyle = '#94a3b8';
    panelCtx.font = '11px sans-serif';
    panelCtx.fillText('磁铁过中心(x=0)换向；转向点 v=0 ⇒ I=0', 14, 140);
    panelCtx.fillText('Φ(x)=k/(x²+a²)^{3/2}，I ∝ −dΦ/dx·v', 14, 156);
    panelCtx.fillStyle = '#fbbf24';
    panelCtx.fillText('跳环：环流滞后 φ ⇒ F∝⟨i·r⟩=½sinφ>0 平均斥力→铝环跳起', 14, 176);
    panelTex.needsUpdate = true;
  }

  // —— 跳环实验（汤姆孙跳环）：AC 线圈 + 铝环，环流滞后于线圈电流 ⇒ 平均斥力 ⇒ 铝环跳起 ——
  const jrX = -6.2;                 // 跳环装置中心 x
  const jrCoreMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.5 });
  const jrCore = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.2, 16), jrCoreMat);
  jrCore.position.set(jrX, 0.1, 0);
  group.add(jrCore);
  for (let i = 0; i < 8; i++) {
    const jrTurnMat = new THREE.MeshStandardMaterial({ color: 0xd97706, emissive: 0x92400e, emissiveIntensity: 0.25 });
    const jt = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 8, 28), jrTurnMat);
    jt.rotation.x = Math.PI / 2;
    jt.position.set(jrX, -0.5 + i * 0.14, 0);
    group.add(jt);
  }
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 0.95, roughness: 0.25, emissive: 0x1f2937, emissiveIntensity: 0.2 });
  const jumpRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.13, 10, 32), ringMat);
  jumpRing.rotation.x = Math.PI / 2;
  group.add(jumpRing);
  // 跳环说明标签
  {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c2 = cv.getContext('2d')!;
    c2.fillStyle = '#fbbf24'; c2.font = 'bold 26px "PingFang SC", sans-serif';
    c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText('跳环：铝环被 AC 排斥跳起', 256, 32);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
    sp.scale.set(4.2, 4.2 / 8, 1); sp.position.set(jrX, 2.4, 0); sp.renderOrder = 995;
    group.add(sp);
  }

  let tAnim = 0;
  return {
    update(t, dt) {
      tAnim += dt;
      // Oscillate magnet through coil
      const magnetX = Math.sin(tAnim * 1.5) * 3;
      magnet.position.set(magnetX, 0, 0);
      const velocity = 4.5 * Math.cos(tAnim * 1.5);   // magnetX=sin(1.5t)·3 的真实导数 dx/dt=3·1.5·cos

      // 磁通量 Φ(x) ∝ 1/(x²+a²)^{3/2}（偶函数，x=0 处最大）
      const s2 = magnetX * magnetX + LENZ_A * LENZ_A;
      const flux = 1 / Math.pow(s2, 1.5);
      // dΦ/dt = (dΦ/dx)·v；感应电流 I ∝ −dΦ/dt（楞次定律）
      const dPhiDx = -3 * magnetX / Math.pow(s2, 2.5);
      const current = -(dPhiDx * velocity) * LENZ_GAIN;

      // 检流计指针按 −dΦ/dt 偏转（过中心换向，转向点归零）
      const clamped = Math.max(-1, Math.min(1, current));
      needle.rotation.z = clamped * 0.6;
      needle.position.x = 5 + clamped * 0.3;

      // B-field arrow intensity（随磁通量）
      bArrow.setLength(0.6 + flux * 6, 0.3);

      // 感应电流方向跟随 −dΦ/dt 符号
      if (Math.abs(clamped) > 0.02) {
        currArrow.setDirection(new THREE.Vector3(0, Math.sign(clamped), 0));
      }

      // —— 跳环物理：线圈电流 i∝sin(ωt)，环流 r∝−cos(ωt+φ)（φ 为铝环电阻滞后），斥力 F∝i·r，均值=½sinφ>0 ——
      const jrW = 7.0, jrPhi = 0.6;
      const iCoil = Math.sin(jrW * tAnim);
      const iRing = -Math.cos(jrW * tAnim + jrPhi);
      const repel = Math.max(0, iCoil * iRing);          // 瞬时斥力分量（含平均抬升）
      jumpRing.position.set(jrX, -0.35 + repel * 1.5, 0); // 环沿铁芯向上跳
      ringMat.emissiveIntensity = 0.15 + 0.5 * Math.abs(iRing);

      drawPanel(flux, current);
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
      panelTex.dispose();
    }
  };
}
