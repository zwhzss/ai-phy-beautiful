import type { SceneContext, SceneInstance } from '../types';
/** 位移电流（P212）：电容器中的位移电流与安培-麦克斯韦定律可视化。 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  // Starfield
  const starGeo = new THREE.BufferGeometry();
  const starPts: import('three').Vector3[] = [];
  for (let i = 0; i < 500; i++) starPts.push(new THREE.Vector3((Math.random()-0.5)*200,(Math.random()-0.5)*200,(Math.random()-0.5)*200));
  starGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(starPts.flatMap(v=>[v.x,v.y,v.z])),3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true });
  group.add(new THREE.Points(starGeo, starMat));
  group.add(new THREE.GridHelper(20, 20, 0x334155, 0x1e293b));

  // Capacitor plates (parallel disks)
  const plateGeo = new THREE.CylinderGeometry(2.5, 2.5, 0.1, 32);
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.5, roughness: 0.4 });

  const topPlate = new THREE.Mesh(plateGeo, plateMat);
  topPlate.position.set(0, 1.5, 0);
  group.add(topPlate);

  const bottomPlate = new THREE.Mesh(plateGeo, plateMat);
  bottomPlate.position.set(0, -1.5, 0);
  group.add(bottomPlate);

  // Wire leading to top plate
  const wireCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(3, 3, 0),
    new THREE.Vector3(2.5, 2, 0),
    new THREE.Vector3(2.5, 1.6, 0)
  ]);
  const wireGeo = new THREE.TubeGeometry(wireCurve, 20, 0.06, 8, false);
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
  group.add(new THREE.Mesh(wireGeo, wireMat));

  // Wire from bottom plate
  const wireCurve2 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(2.5, -1.6, 0),
    new THREE.Vector3(2.5, -2, 0),
    new THREE.Vector3(3, -3, 0)
  ]);
  const wireGeo2 = new THREE.TubeGeometry(wireCurve2, 20, 0.06, 8, false);
  group.add(new THREE.Mesh(wireGeo2, wireMat));

  // Electric field lines between plates (dashed style using points)
  const eFieldLines: import("three").Points[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const r = 1.5;
    const pts: import('three').Vector3[] = [];
    for (let j = 0; j < 20; j++) {
      const y = -1.4 + (j / 19) * 2.8;
      pts.push(new THREE.Vector3(r * Math.cos(angle), y, r * Math.sin(angle)));
    }
    const eGeo = new THREE.BufferGeometry();
    eGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts.flatMap(v=>[v.x,v.y,v.z])),3));
    const eMat = new THREE.PointsMaterial({ color: 0xef4444, size: 0.12, sizeAttenuation: true, transparent: true });
    const eLine = new THREE.Points(eGeo, eMat);
    group.add(eLine);
    eFieldLines.push(eLine);
  }

  // Displacement current arrow (between plates, along +z)
  const dispArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 2.2, 0x22c55e);
  group.add(dispArrow);

  // Conduction current arrow (in wire, downward)
  const iArrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(2.8, 2.5, 0), 1.0, 0xf59e0b);
  group.add(iArrow);

  // B-field circles around the axis (from Ampère-Maxwell)
  const bCircles: import("three").Mesh[] = [];
  for (let y = -1; y <= 1; y += 1) {
    const bGeo = new THREE.TorusGeometry(2.0, 0.025, 8, 64);
    const bMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.6 });
    const bCircle = new THREE.Mesh(bGeo, bMat);
    bCircle.position.set(0, y, 0);
    bCircle.rotation.x = Math.PI / 2;
    group.add(bCircle);
    bCircles.push(bCircle);
  }

  // Labels
  function makeLabel(text: string, color: string): import("three").Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const c = canvas.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 28px Arial';
    c.textAlign = 'center';
    c.fillText(text, 128, 42);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(3.5, 0.875, 1);
    return sprite;
  }

  const labelD = makeLabel('ε₀∂E/∂t (位移电流)', '#22c55e');
  labelD.position.set(-3.5, 0, 0);
  group.add(labelD);

  const labelIc = makeLabel('I (传导电流)', '#f59e0b');
  labelIc.position.set(3.5, 2.5, 0);
  group.add(labelIc);

  const labelB = makeLabel('B (磁场)', '#3b82f6');
  labelB.position.set(3.5, -1, 0);
  group.add(labelB);

  // —— 面板：安培-麦克斯韦定律 + E / ∂E/∂t / B 实时读数 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 1024; infoCv.height = 200;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = new THREE.CanvasTexture(infoCv);
  const infoPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 1.95),
    new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false }),
  );
  infoPlane.position.set(0, 4.8, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  let eVal = 0, dEdtVal = 0;
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 1024, 200);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 1016, 192);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 1016, 192);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 30px "PingFang SC", sans-serif';
    infoCtx.fillText('安培-麦克斯韦定律：∇×B = μ₀(J + ε₀∂E/∂t)——变化的 E 激发 B（电磁波之源）', 22, 46);
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '27px "PingFang SC", sans-serif';
    infoCtx.fillText('交流充电：E = E₀ sin ωt；∂E/∂t = E₀ω cos ωt 相位导前 E 场 90°', 22, 90);
    const sgn = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2);
    infoCtx.fillStyle = '#ef4444';
    infoCtx.fillText(`读数：E = ${sgn(eVal)}`, 22, 134);
    infoCtx.fillStyle = '#22c55e';
    infoCtx.fillText(`∂E/∂t = ${sgn(dEdtVal)}（位移电流 ∝ 此值）`, 250, 134);
    infoCtx.fillStyle = '#3b82f6';
    infoCtx.fillText(`B ∝ ∂E/∂t = ${sgn(dEdtVal)}，过零 ⇔ B 环消失`, 660, 134);
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.fillText('极板颜色随 E 变号（红 + / 蓝 −）；E 场点流向、箭头方向均随符号反向', 22, 176);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  let bSpin = 0;
  return {
    update(t, dt) {
      // 交流充电：E = E₀ sin ωt（E₀ = 1），∂E/∂t 相位导前 90°
      const w = 1.6;
      const s = Math.sin(w * t), c = Math.cos(w * t);
      eVal = s;
      dEdtVal = w * c;
      const cSign = c >= 0 ? 1 : -1;

      // 位移电流箭头：长度 ∝ |∂E/∂t|，方向随 ∂E/∂t 变号
      dispArrow.setDirection(new THREE.Vector3(0, cSign, 0));
      dispArrow.setLength(Math.max(2.2 * Math.abs(c), 0.06), 0.45, 0.3);
      // 传导电流与位移电流连续（同相显示，I = A·ε₀∂E/∂t）
      iArrow.setDirection(new THREE.Vector3(0, -cSign, 0));
      iArrow.setLength(Math.max(Math.abs(c), 0.06), 0.3, 0.22);

      // B 环强度 ∝ |∂E/∂t|：过零时消失，∂E/∂t 变号时旋转反向
      const bAmp = Math.abs(c);
      bSpin += dt * 0.9 * cSign;
      for (const bc of bCircles) {
        bc.scale.setScalar(0.35 + 0.65 * bAmp);
        (bc.material as import('three').MeshBasicMaterial).opacity = 0.85 * bAmp;
        bc.rotation.z = bSpin;
      }

      // E 场：亮度 ∝ |E|，点流方向随 E 变号；极板颜色随 E 变号（红 + / 蓝 −）
      const eSign = s >= 0 ? 1 : -1;
      plateMat.emissive.setRGB(0.3 * Math.max(s, 0), 0, 0.3 * Math.max(-s, 0));
      for (let i = 0; i < eFieldLines.length; i++) {
        (eFieldLines[i].material as import('three').PointsMaterial).opacity = 0.15 + 0.85 * Math.abs(s);
        const positions = (eFieldLines[i].geometry.attributes['position'] as any).array as Float32Array;
        const raw = (t * 0.5 * eSign + i * 0.3) % 1;
        const offset = (raw + 1) % 1;
        for (let j = 0; j < positions.length / 3; j++) {
          const baseY = -1.4 + offset * 2.8;
          positions[j * 3 + 1] = baseY + (j / 19) * 0.3 - 0.15 + s * 0.18;
        }
        (eFieldLines[i].geometry.attributes['position'] as any).needsUpdate = true;
      }

      // 面板 5Hz 刷新
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
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
      starGeo.dispose(); starMat.dispose(); infoTex.dispose();
    }
  };
}
