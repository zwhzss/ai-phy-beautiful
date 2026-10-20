import type { SceneContext, SceneInstance } from '../types';
/** Poynting向量（P211）：S = E×H，载流导线周围的能流沿导线方向（+z，与电流同向）传播。 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  // Starfield background
  const starGeo = new THREE.BufferGeometry();
  const starPts: import('three').Vector3[] = [];
  for (let i = 0; i < 500; i++) starPts.push(new THREE.Vector3((Math.random()-0.5)*200,(Math.random()-0.5)*200,(Math.random()-0.5)*200));
  starGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(starPts.flatMap(v=>[v.x,v.y,v.z])),3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true });
  group.add(new THREE.Points(starGeo, starMat));
  group.add(new THREE.GridHelper(20, 20, 0x334155, 0x1e293b));

  // Current-carrying wire（CylinderGeometry 默认轴向 Y，旋转 π/2 使导线与电流/E/B/S 整套装置同沿 z 轴）
  const wireGeo = new THREE.CylinderGeometry(0.15, 0.15, 10, 16);
  const wireMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.3, roughness: 0.6 });
  const wire = new THREE.Mesh(wireGeo, wireMat);
  wire.rotation.x = Math.PI / 2;
  group.add(wire);

  // Current direction arrow
  const currentArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -5.5), 1.2, 0xf59e0b);
  group.add(currentArrow);

  // Poynting vector arrows: S = E×H 沿导线 +z（E 径向 × B 方位向），长度按 |S| ∝ 1/r² 衰减
  const arrows: import("three").ArrowHelper[] = [];
  const arrowMeta: { len: number; phase: number }[] = [];
  const sRadii = [1.1, 1.1, 2.0, 2.0, 2.9, 2.9];
  const sAngles = [0.3, Math.PI + 0.3, Math.PI * 0.5 + 0.2, -Math.PI * 0.5 + 0.2, 0.9, Math.PI + 0.9];
  for (let i = 0; i < sRadii.length; i++) {
    const r = sRadii[i];
    const base = new THREE.Vector3(r * Math.cos(sAngles[i]), r * Math.sin(sAngles[i]), 0);
    const len = Math.max(0.3, 1.6 * (1.1 / r) * (1.1 / r)); // |S| ∝ 1/r²
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), base, len, 0x22d3ee, 0.18, 0.1);
    group.add(arrow);
    arrows.push(arrow);
    arrowMeta.push({ len, phase: i * 1.63 });
  }

  // E-field radial arrows (outward from wire)
  const eArrows: import("three").ArrowHelper[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const base = new THREE.Vector3(1.2 * Math.cos(angle), 1.2 * Math.sin(angle), 0);
    const dir = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0).normalize();
    const arrow = new THREE.ArrowHelper(dir, base, 0.6, 0xef4444);
    group.add(arrow);
    eArrows.push(arrow);
  }

  // B-field circles (magnetic field around wire)
  const bCircleGeo = new THREE.TorusGeometry(2.0, 0.02, 8, 64);
  const bCircleMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.5 });
  const bCircle = new THREE.Mesh(bCircleGeo, bCircleMat);
  group.add(bCircle);

  // ---- r 扫描探头：在 (r,0,0) 处 E∥x̂（径向）、H∥ŷ（方位向）、S=E×H∥+ẑ（沿导线）----
  // 归一化场量：E ∝ 1/r、H ∝ 1/r ⇒ |S| = E×H ∝ 1/r²；探头几何与面板读数共用这一份计算
  const E0 = 1.0;            // r = 1 处归一化 E
  const H0 = 0.8;            // r = 1 处归一化 H（真空中 H = B/μ₀，同一归一化单位）
  const S0 = E0 * H0;        // r = 1 处 |S| 基准
  const L_SCALE = 1.5;       // 探头箭头显示比例
  function fieldVals(r: number) {
    const E = E0 / r;
    const H = H0 / r;
    return { E, H, S: E * H }; // S ∝ 1/r²
  }
  const readout = { r: 1.0, ...fieldVals(1.0) };

  const probe = new THREE.Group();
  group.add(probe);
  const probeE = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), L_SCALE, 0xef4444, 0.16, 0.09);
  const probeH = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), L_SCALE * H0 / E0, 0x3b82f6, 0.16, 0.09);
  const probeS = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), L_SCALE * S0 / E0, 0x22d3ee, 0.22, 0.13);
  probe.add(probeE, probeH, probeS);

  // 探头所在半径的 B 环（单位环按 rProbe 缩放，与探头共用同一个 r）
  const probeRingGeo = new THREE.TorusGeometry(1.0, 0.015, 8, 64);
  const probeRingMat = new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.35 });
  const probeRing = new THREE.Mesh(probeRingGeo, probeRingMat);
  probeRing.scale.set(1.0, 1.0, 1);
  group.add(probeRing);

  // Labels using canvas textures
  function makeLabel(text: string, color: string): import("three").Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const c = canvas.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 32px Arial';
    c.textAlign = 'center';
    c.fillText(text, 128, 42);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(3, 0.75, 1);
    return sprite;
  }

  const labelS = makeLabel('S = E x H', '#22d3ee');
  labelS.position.set(0, 3.2, 0);
  group.add(labelS);

  const labelI = makeLabel('I (current)', '#f59e0b');
  labelI.position.set(0, -3.2, 0);
  group.add(labelI);

  // 信息面板：S = E×H、方向、1/r² 衰减、能量在场中、辐射压 + 实时读数（5Hz）
  const infoCv = document.createElement('canvas');
  infoCv.width = 840; infoCv.height = 340;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = new THREE.CanvasTexture(infoCv);
  const infoSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false }));
  infoSprite.position.set(0, 5.4, 0);
  infoSprite.scale.set(8.4, 3.4, 1);
  infoSprite.renderOrder = 999;
  group.add(infoSprite);

  function drawInfo() {
    infoCtx.clearRect(0, 0, 840, 340);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)';
    infoCtx.fillRect(4, 4, 832, 332);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 832, 332);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 30px "PingFang SC", sans-serif';
    infoCtx.fillText('坡印廷矢量 S = E×H [W/m²]（真空中 H = B/μ₀）', 22, 48);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '26px "PingFang SC", sans-serif';
    infoCtx.fillText('方向 = E×B → 沿导线 +z，与电流 I 同向：能量沿输电线传播', 22, 96);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('E ∝ 1/r（径向）、B ∝ 1/r（方位向）⇒ |S| ∝ 1/r²（r 加倍 → 能流密度降为 1/4）', 22, 140);
    infoCtx.fillStyle = '#34d399';
    infoCtx.fillText('能量在电磁场里跑，不在导线或电子内部（导线只负责导向并补偿损耗）', 22, 184);
    infoCtx.fillStyle = '#f59e0b';
    infoCtx.fillText('辐射压 p = S/c：光被吸收/反射时把动量交给物体', 22, 228);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('红 = E（径向）　蓝环 = B（方位向）　青 = S 能流脉冲（沿导线 +z）　探头 = 沿 r 扫描读数点', 22, 266);
    // 读数行：与探头几何同源的 r / E / H / |S|
    const pct = (readout.S / S0) * 100;
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：r = ${readout.r.toFixed(2)}｜E∝1/r = ${(readout.E / E0).toFixed(3)}｜H∝1/r = ${(readout.H / H0).toFixed(3)}｜|S| = E×H = ${readout.S.toFixed(3)}（为 r=1 处的 ${pct.toFixed(0)}%）`,
      22, 306);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  return {
    update(t, dt) {
      // B-field circle slowly rotates (field existence示意)
      bCircle.rotation.z = t * 0.5;

      // ---- r 扫描（16s 周期，r: 1.0 → 3.4 → 1.0，扫过 1/r² 衰减转折区间）----
      const scan = (t % 16) / 16;
      const tri = scan < 0.5 ? scan * 2 : 2 - scan * 2;
      const rProbe = 1.0 + 2.4 * tri;
      const fv = fieldVals(rProbe);
      readout.r = rProbe; readout.E = fv.E; readout.H = fv.H; readout.S = fv.S;
      probe.position.set(rProbe, 0, 0);
      probeE.setLength(L_SCALE * (fv.E / E0));
      probeH.setLength(L_SCALE * (fv.H / E0));
      probeS.setLength(L_SCALE * (fv.S / S0));
      probeRing.scale.set(rProbe, rProbe, 1); // B 环半径 = 探头半径（同一 r）

      // Poynting arrows: 沿 +z 的能流脉冲（能量沿输电线传播），长度 ∝ 1/r² 呼吸
      for (let i = 0; i < arrows.length; i++) {
        arrows[i].position.z = ((t * 1.5 + arrowMeta[i].phase) % 9) - 4.5;
        arrows[i].setLength(arrowMeta[i].len * (1 + 0.15 * Math.sin(t * 3 + i)));
      }

      // Pulse E-field arrows
      for (let i = 0; i < eArrows.length; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const pulse = 1.0 + 0.2 * Math.sin(t * 3 + i);
        eArrows[i].position.set(1.2 * pulse * Math.cos(angle), 1.2 * pulse * Math.sin(angle), 0);
      }

      // Pulse current arrow
      currentArrow.position.z = -5.5 + 0.2 * Math.sin(t * 2);

      // 面板 5Hz 刷新读数
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
    },
    dispose() {
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points || obj instanceof THREE.Sprite) {
          (obj as any).geometry?.dispose();
          const mat = (obj as any).material;
          if (Array.isArray(mat)) mat.forEach((m: any) => { m.map?.dispose(); m.dispose(); });
          else if (mat) { mat.map?.dispose(); mat.dispose(); }
        }
      });
      starGeo.dispose(); starMat.dispose();
      infoTex.dispose();
    }
  };
}
