import type { SceneContext, SceneInstance } from '../types';
/**
 * 波的叠加与双源干涉（P09）：两同频相干点源叠加，形成双曲线条纹。
 * y = sin(k r₁ − ωt) + sin(k r₂ − ωt) = 2 sin(k(r₁+r₂)/2 − ωt)·cos(kΔr/2)
 * 时间平均强度 I ∝ 1 + cos(k·Δr)：明纹 Δr = mλ（含中垂线上的 m=0 中央明纹），暗纹 Δr = (m+½)λ。
 * 观察点 P 沿圆弧扫描，实时给出 r₁、r₂、Δr 与级数 m 的读数。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  // —— 物理参数 ——
  const lambda = 2.0;                    // 波长 λ (m)
  const k = (2 * Math.PI) / lambda;      // 波数 k = 2π/λ
  const omega = 4.0;                     // 角频率 ω (rad/s)
  const d = 3 * lambda;                  // 源距 d = 6 m = 3λ（可见 m = 0…±3 级条纹）
  const S1 = new THREE.Vector3(-d / 2, 0.15, 0);  // 源 S₁
  const S2 = new THREE.Vector3(d / 2, 0.15, 0);   // 源 S₂

  const texs: { dispose(): void }[] = []; // CanvasTexture 集合（traverse 不释放纹理）

  // —— 背景星点 ——
  const starGeo = new THREE.BufferGeometry();
  const starPts: import('three').Vector3[] = [];
  for (let i = 0; i < 500; i++) starPts.push(new THREE.Vector3((Math.random()-0.5)*200,(Math.random()-0.5)*200,(Math.random()-0.5)*200));
  starGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(starPts.flatMap(v=>[v.x,v.y,v.z])),3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true });
  group.add(new THREE.Points(starGeo, starMat));
  const grid = new THREE.GridHelper(20, 20, 0x334155, 0x1e293b);
  grid.position.y = -0.06;
  group.add(grid);

  // —— 干涉场（平面上逐像素按瞬时叠加 |sin(k r₁−ωt)+sin(k r₂−ωt)| 上色） ——
  const FW = 240, FH = 165;              // 纹理分辨率
  const PW = 16, PH = 11;                // 平面尺寸 (m)，位于 x–z 平面
  const fieldCv = document.createElement('canvas');
  fieldCv.width = FW; fieldCv.height = FH;
  const fieldCtx = fieldCv.getContext('2d')!;
  const fieldImg = fieldCtx.createImageData(FW, FH);
  const fieldTex = new THREE.CanvasTexture(fieldCv);
  texs.push(fieldTex);

  // r₁/r₂ 与源位置无关时间，预计算一次
  const r1Buf = new Float32Array(FW * FH);
  const r2Buf = new Float32Array(FW * FH);
  for (let v = 0; v < FH; v++) {
    const wz = ((v / (FH - 1)) - 0.5) * PH;
    for (let u = 0; u < FW; u++) {
      const wx = ((u / (FW - 1)) - 0.5) * PW;
      const i = v * FW + u;
      r1Buf[i] = Math.hypot(wx - S1.x, wz - S1.z);
      r2Buf[i] = Math.hypot(wx - S2.x, wz - S2.z);
    }
  }
  const fieldGeo = new THREE.PlaneGeometry(PW, PH);
  const fieldMat = new THREE.MeshBasicMaterial({ map: fieldTex });
  const fieldMesh = new THREE.Mesh(fieldGeo, fieldMat);
  fieldMesh.rotation.x = -Math.PI / 2;   // 平铺在 x–z 水平面（水槽俯视）
  fieldMesh.position.y = 0;
  group.add(fieldMesh);

  // —— 双源小球 + 源间连线 ——
  const srcGeo = new THREE.SphereGeometry(0.22, 24, 24);
  const s1Mat = new THREE.MeshStandardMaterial({ color: 0xf87171, emissive: 0x991b1b, emissiveIntensity: 0.5 });
  const s2Mat = new THREE.MeshStandardMaterial({ color: 0x60a5fa, emissive: 0x1e40af, emissiveIntensity: 0.5 });
  const src1 = new THREE.Mesh(srcGeo, s1Mat); src1.position.copy(S1); group.add(src1);
  const src2 = new THREE.Mesh(srcGeo, s2Mat); src2.position.copy(S2); group.add(src2);

  const linkGeo = new THREE.BufferGeometry().setFromPoints([S1, S2]);
  const linkMat = new THREE.LineBasicMaterial({ color: 0x94a3b8 });
  group.add(new THREE.Line(linkGeo, linkMat));

  // —— 中垂线（零级明纹 Δr=0） ——
  const bisGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.06, -PH / 2), new THREE.Vector3(0, 0.06, PH / 2),
  ]);
  const bisMat = new THREE.LineDashedMaterial({ color: 0x4ade80, dashSize: 0.35, gapSize: 0.22 });
  const bisLine = new THREE.Line(bisGeo, bisMat);
  bisLine.computeLineDistances();
  group.add(bisLine);

  // —— 文字标签（Sprite） ——
  function makeLabel(text: string, color: string, scale = 3.2): { sprite: import('three').Sprite; redraw: (t: string) => void } {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    const tex = new THREE.CanvasTexture(cv); texs.push(tex);
    const draw = (t: string): void => {
      c.clearRect(0, 0, 512, 64);
      c.fillStyle = color; c.font = 'bold 30px "PingFang SC", sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, 256, 32);
      tex.needsUpdate = true;
    };
    draw(text);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    s.scale.set(scale, scale / 8, 1);
    return { sprite: s, redraw: draw };
  }
  const lblS1 = makeLabel('S₁', '#fca5a5', 1.6).sprite;
  lblS1.position.set(S1.x, 1.0, 0); group.add(lblS1);
  const lblS2 = makeLabel('S₂', '#93c5fd', 1.6).sprite;
  lblS2.position.set(S2.x, 1.0, 0); group.add(lblS2);
  const lblD = makeLabel(`d = ${d.toFixed(1)} m = 3λ`, '#e2e8f0', 3.4).sprite;
  lblD.position.set(0, 0.75, 0); group.add(lblD);
  const lblBis = makeLabel('中垂线：零级明纹（Δr = 0）', '#4ade80', 5.2).sprite;
  lblBis.position.set(0, 0.45, -PH / 2 - 0.8); group.add(lblBis);

  // —— 观察点 P（沿圆弧扫描）+ 到两源的波程连线 + Δr 动态标签 ——
  const obs = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 20, 20),
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 0.6 }),
  );
  group.add(obs);
  const path1Geo = new THREE.BufferGeometry().setFromPoints([S1, S1]);
  const path2Geo = new THREE.BufferGeometry().setFromPoints([S2, S2]);
  const path1 = new THREE.Line(path1Geo, new THREE.LineBasicMaterial({ color: 0xf87171 }));
  const path2 = new THREE.Line(path2Geo, new THREE.LineBasicMaterial({ color: 0x60a5fa }));
  group.add(path1); group.add(path2);
  const lblP = makeLabel('', '#fde68a', 6.0);
  lblP.sprite.position.set(0, 1.35, 0); group.add(lblP.sprite);

  // —— 信息面板（Sprite，4 Hz 刷新） ——
  const infoCv = document.createElement('canvas'); infoCv.width = 900; infoCv.height = 300;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = new THREE.CanvasTexture(infoCv); texs.push(infoTex);
  const infoMat = new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false });
  const infoSprite = new THREE.Sprite(infoMat);
  infoSprite.position.set(0, 6.8, 0); infoSprite.scale.set(11.4, 3.8, 1); infoSprite.renderOrder = 999;
  group.add(infoSprite);

  let lastPanelT = -1;
  function drawInfo(px: number, pz: number, r1: number, r2: number, dr: number, m: number): void {
    infoCtx.clearRect(0, 0, 900, 300);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(4, 4, 892, 292);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 892, 292);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText('双源干涉（P09）— 两同频相干点源叠加：y = sin(k r₁−ωt) + sin(k r₂−ωt)', 20, 40);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('和差化积 = 2·sin(k(r₁+r₂)/2 − ωt)·cos(kΔr/2)，驻定图样由 cos(kΔr/2) 决定', 20, 76);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('时间平均强度 I ∝ 1 + cos(k·Δr)：明纹 Δr = mλ，暗纹 Δr = (m+½)λ（条纹为双曲线族）', 20, 106);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 22px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `参数：d = ${d.toFixed(2)} m（= 3λ）　λ = ${lambda.toFixed(2)} m　k = ${k.toFixed(3)} rad/m　ω = ${omega.toFixed(2)} rad/s`,
      20, 142,
    );
    const n = Math.round(m);
    const dm = Math.abs(m - n);
    let state: string;
    if (dm < 0.12) state = n === 0 ? '中央明纹（m = 0）' : `第 ${n} 级明纹`;
    else if (Math.abs(dm - 0.5) < 0.12) state = `第 ${n} + ½ 级暗纹`;
    else state = '明纹与暗纹之间';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `观察点 P(${px.toFixed(1)}, ${pz.toFixed(1)})：r₁ = ${r1.toFixed(2)} m　r₂ = ${r2.toFixed(2)} m　Δr = r₂−r₁ = ${dr.toFixed(2)} m = ${m.toFixed(2)}λ`,
      20, 180,
    );
    infoCtx.fillStyle = '#fde68a'; infoCtx.font = 'bold 22px "PingFang SC", sans-serif';
    infoCtx.fillText(`当前判据：Δr ≈ ${n >= 0 ? n : `(${n})`}λ → ${state}`, 20, 212);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '21px "PingFang SC", sans-serif';
    infoCtx.fillText(`明纹角位置 sinθ = mλ/d（θ 相对中垂线量起，θ=0 即中垂线零级明纹）；d = 3λ ⇒ 可见 m = 0, ±1, ±2, ±3`, 20, 246);
    infoCtx.fillText(`P 沿半径 5 m 圆弧往返扫描，Δr 连续变化 ⇒ 明纹/暗纹交替；绿色虚线为 Δr=0 的零级明纹`, 20, 274);
    infoTex.needsUpdate = true;
  }

  let time = 0;
  return {
    update(t, dt) {
      time = t;
      const ph = omega * time;

      // 干涉场逐像素上色（等幅理想点源）：正值偏琥珀、负值偏靛蓝，节点处为暗色
      const data = fieldImg.data;
      for (let i = 0, n = FW * FH; i < n; i++) {
        const s = 0.5 * (Math.sin(k * r1Buf[i] - ph) + Math.sin(k * r2Buf[i] - ph)); // ∈ [-1,1]
        const a = Math.abs(s);
        const j = i * 4;
        if (s >= 0) {
          data[j] = 12 + 233 * a; data[j + 1] = 18 + 140 * a; data[j + 2] = 32 - 21 * a;
        } else {
          data[j] = 12 + 44 * a; data[j + 1] = 18 + 114 * a; data[j + 2] = 32 + 223 * a;
        }
        data[j + 3] = 255;
      }
      fieldCtx.putImageData(fieldImg, 0, 0);
      fieldTex.needsUpdate = true;

      // 双源脉动（同频同相）
      const pulse = 1 + 0.25 * Math.sin(ph);
      src1.scale.setScalar(pulse); src2.scale.setScalar(pulse);

      // 观察点 P 沿圆弧扫描：θ_P = 0.9·sin(0.25t) rad
      const thP = 0.9 * Math.sin(0.25 * time);
      const R = 5.0;
      const px = R * Math.sin(thP);
      const pz = R * Math.cos(thP);
      obs.position.set(px, 0.2, pz);
      const p1 = path1Geo.attributes['position'];
      const p2 = path2Geo.attributes['position'];
      p1.setXYZ(0, S1.x, S1.y, S1.z); p1.setXYZ(1, px, 0.2, pz);
      p2.setXYZ(0, S2.x, S2.y, S2.z); p2.setXYZ(1, px, 0.2, pz);
      p1.needsUpdate = true; p2.needsUpdate = true;

      // 波程差与级数读数
      const r1 = Math.hypot(px - S1.x, pz - S1.z);
      const r2 = Math.hypot(px - S2.x, pz - S2.z);
      const dr = r2 - r1;
      const m = dr / lambda;
      lblP.sprite.position.set(px, 1.35, pz);
      if (t - lastPanelT >= 0.25) {
        lastPanelT = t;
        lblP.redraw(`Δr = ${dr.toFixed(2)} m = ${m.toFixed(2)}λ`);
        drawInfo(px, pz, r1, r2, dr, m);
      }
    },
    dispose() {
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
          (obj as any).geometry?.dispose();
          const mat = (obj as any).material;
          if (Array.isArray(mat)) mat.forEach((m: any) => m.dispose());
          else if (mat) mat.dispose();
        }
        if (obj instanceof THREE.Sprite) {
          const mat = obj.material as import('three').SpriteMaterial;
          mat.map?.dispose();
          mat.dispose();
        }
      });
      texs.forEach((x) => x.dispose());
      starGeo.dispose(); starMat.dispose();
      obs.geometry.dispose();
      (obs.material as import('three').Material).dispose();
    }
  };
}
