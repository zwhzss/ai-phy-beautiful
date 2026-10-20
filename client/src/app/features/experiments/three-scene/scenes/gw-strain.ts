import type { SceneContext, SceneInstance } from '../types';
/** 引力波应变与灵敏度（P231）：+ 偏振过顶波 h(t)=h₀cos(2πft) 作用于 L 形双臂：
 *  测地线偏差 δx = (h/2)cos(ωt)·x、δy = −(h/2)cos(ωt)·y ⇒ ΔL/L = h（一臂伸、一臂缩，四极交替）。
 *  环上 16 颗自由测试质量按上式实时形变（形变放大 ×1.4e21 标注在面板）。
 *  背景 U 形曲线 = aLIGO 幅值噪声谱 fit：h_n(f) = 1e-23·√((12/f)^6.4 + 1 + (f/150)^2.2)，
 *  谷底 ≈1.05e-23/√Hz @ ~45Hz、150Hz ≈1.4e-23（量级与设计灵敏度一致），左壁=地震噪声、右坡=散粒噪声、
 *  中段平台=热噪声；h<2e-23 绿段 = 可探频带 ~10–250Hz。源点标记沿曲线滑动，h₀ 与 f 双扫描（16s）。 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [];
  const mats: { dispose(): void }[] = [];
  const texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  const starGeo = geo(new THREE.BufferGeometry());
  const starPos = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 200;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  const TWO_PI = Math.PI * 2;
  const CY = 2.1;                     // 探测器中心高度
  const L_ARM = 3.6;                  // 臂长（世界单位，代表 4 km）
  const EX = 1.4e21;                  // 形变视觉放大倍数（h=1e-21 时臂端摆幅 ≈0.35）
  let h0 = 1e-21, fSrc = 150, eps = 0;

  // —— L 形真空臂 + 端镜 ——
  const tubeMat = mat(new THREE.MeshBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.35 }));
  const tubeX = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.09, 0.09, L_ARM, 12)), tubeMat);
  tubeX.rotation.z = Math.PI / 2; tubeX.position.set(L_ARM / 2, CY, -0.2);
  const tubeY = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.09, 0.09, L_ARM, 12)), tubeMat);
  tubeY.rotation.x = Math.PI / 2; tubeY.position.set(-0.2, CY, L_ARM / 2);
  group.add(tubeX, tubeY);
  const massGeo = geo(new THREE.SphereGeometry(0.16, 14, 14));
  const massMat = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
  const msx = new THREE.Mesh(massGeo, massMat);
  const msy = new THREE.Mesh(massGeo, massMat);
  group.add(msx, msy);
  const beam = new THREE.Mesh(geo(new THREE.SphereGeometry(0.32, 16, 16)), mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })));
  beam.position.set(-0.2, CY, -0.2); group.add(beam);
  const laserMat = mat(new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.85 }));
  const laserGeos: import('three').BufferGeometry[] = [];
  for (let k = 0; k < 2; k++) {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    group.add(new THREE.Line(g, laserMat));
    laserGeos.push(g);
  }

  // —— 四极形变环：16 颗自由测试质量 ——
  const NRING = 16;
  const ringGeo = geo(new THREE.BufferGeometry());
  const ringPos = new Float32Array(NRING * 3);
  ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPos, 3));
  const ringMesh = new THREE.Points(ringGeo, mat(new THREE.PointsMaterial({ color: 0x22c55e, size: 0.13 })));
  ringMesh.position.set(0, CY, 0);
  group.add(ringMesh);
  const ellGeo = geo(new THREE.BufferGeometry());
  const ellPos = new Float32Array((NRING + 1) * 3);
  ellGeo.setAttribute('position', new THREE.BufferAttribute(ellPos, 3));
  group.add(new THREE.Line(ellGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.4 }))));

  // —— aLIGO 噪声曲线（背景立面）——
  const hshape = (f: number): number => Math.sqrt(Math.pow(12 / f, 6.4) + 1 + Math.pow(f / 150, 2.2));
  const hmin = 1e-23;
  const NF = 180, ZC = -3.6;
  const curveGeo = geo(new THREE.BufferGeometry());
  const curvePos = new Float32Array(NF * 3);
  const curveCol = new Float32Array(NF * 3);
  curveGeo.setAttribute('position', new THREE.BufferAttribute(curvePos, 3));
  curveGeo.setAttribute('color', new THREE.BufferAttribute(curveCol, 3));
  const fx = (f: number): number => -4.6 + 9.2 * (Math.log10(f / 3) / Math.log10(3000 / 3));
  const hy = (hh: number): number => Math.min(3.35, 0.5 + 1.3 * Math.log10(Math.max(1.02, hh / hmin)));
  {
    for (let i = 0; i < NF; i++) {
      const f = 3 * Math.pow(1000, i / (NF - 1));
      const s = hshape(f);
      curvePos[i * 3] = fx(f); curvePos[i * 3 + 1] = hy(s); curvePos[i * 3 + 2] = ZC;
      const inBand = s * hmin < 2e-23;
      if (inBand) { curveCol[i * 3] = 0.13; curveCol[i * 3 + 1] = 0.77; curveCol[i * 3 + 2] = 0.37; }
      else { curveCol[i * 3] = 0.94; curveCol[i * 3 + 1] = 0.27; curveCol[i * 3 + 2] = 0.27; }
    }
  }
  group.add(new THREE.Line(curveGeo, mat(new THREE.LineBasicMaterial({ vertexColors: true }))));
  // 地面参考线 + 标签
  const baseLineGeo = geo(new THREE.BufferGeometry());
  baseLineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-4.6, 0.5, ZC, 4.6, 0.5, ZC]), 3));
  group.add(new THREE.Line(baseLineGeo, mat(new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.4 }))));
  function makeLabel(text: string, color: string, scale = 3.0): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  const labSeis = makeLabel('地震噪声墙 f⁻³·²', '#ef4444', 2.6); labSeis.position.set(-3.9, 2.6, ZC); group.add(labSeis);
  const labShot = makeLabel('散粒噪声 f⁰·⁹（量子）', '#ef4444', 2.7); labShot.position.set(4.0, 2.4, ZC); group.add(labShot);
  const labBand = makeLabel('热噪声平台·可探带 10–250Hz', '#22c55e', 3.2); labBand.position.set(0.2, 1.15, ZC); group.add(labBand);
  const labGrid = makeLabel('应变椭圆场（同一 ε(t) 驱动）', '#22c55e', 3.4); labGrid.position.set(0, 0.42, -3.4); group.add(labGrid);

  // —— 应变椭圆场：5×5 环圈按 δx=ε·x、δz=−ε·z 同步变形（与环/端镜同一 eps 变量）——
  const EG_N = 5, EG_SP = 1.55, EG_R = 0.42, EG_SEG = 12;
  const egGeo = geo(new THREE.BufferGeometry());
  const egPos = new Float32Array(EG_N * EG_N * EG_SEG * 2 * 3);
  egGeo.setAttribute('position', new THREE.BufferAttribute(egPos, 3));
  group.add(new THREE.LineSegments(egGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.5 }))));
  function updateEllipses(e: number): void {
    let k = 0;
    for (let gi = 0; gi < EG_N; gi++) for (let gj = 0; gj < EG_N; gj++) {
      const cx = (gi - (EG_N - 1) / 2) * EG_SP, cz = (gj - (EG_N - 1) / 2) * EG_SP;
      for (let s = 0; s < EG_SEG; s++) {
        const a1 = (s / EG_SEG) * TWO_PI, a2 = ((s + 1) / EG_SEG) * TWO_PI;
        egPos[k * 3] = cx + EG_R * Math.cos(a1) * (1 + e); egPos[k * 3 + 1] = 0.72; egPos[k * 3 + 2] = cz + EG_R * Math.sin(a1) * (1 - e); k++;
        egPos[k * 3] = cx + EG_R * Math.cos(a2) * (1 + e); egPos[k * 3 + 1] = 0.72; egPos[k * 3 + 2] = cz + EG_R * Math.sin(a2) * (1 - e); k++;
      }
    }
    egGeo.attributes['position'].needsUpdate = true;
  }

  // —— FP 腔循环光子：在三臂间往返，端镜随应变移动 ⇒ 光程被实时拉伸 ——
  const NPHT = 8;
  const phtGeo = geo(new THREE.SphereGeometry(0.05, 6, 6));
  const phtMat = mat(new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  const phtMesh = new THREE.InstancedMesh(phtGeo, phtMat, NPHT);
  group.add(phtMesh);
  const dumO = new THREE.Object3D();
  function updatePhotons(t: number): void {
    const lenX = L_ARM + L_ARM * eps, lenY = L_ARM - L_ARM * eps;
    for (let i = 0; i < NPHT; i++) {
      const arm = i < 4 ? 0 : 1, ph = ((t * 1.9 + (i % 4) / 4) % 1);
      const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;      // 0→1→0 往返
      if (arm === 0) dumO.position.set(-0.2 + tri * lenX, CY, -0.2);
      else dumO.position.set(-0.2, CY, -0.2 + tri * lenY);
      dumO.scale.setScalar(1); dumO.updateMatrix();
      phtMesh.setMatrixAt(i, dumO.matrix);
    }
    phtMesh.instanceMatrix.needsUpdate = true;
  }
  const labSrc = makeLabel('源 (f, h₀)', '#fbbf24', 2.0); const srcDot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.12, 12, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  group.add(srcDot);
  const marginGeo = geo(new THREE.BufferGeometry());
  marginGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const marginLine = new THREE.Line(marginGeo, mat(new THREE.LineDashedMaterial({ color: 0xfbbf24, dashSize: 0.1, gapSize: 0.07 })));
  group.add(marginLine);

  // —— 面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 840; infoCv.height = 300;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.2, 3.3)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 6.3, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  let dLm = 0, hn = 0, snr = 0;
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 840, 300);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 832, 292);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 832, 292);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText('+偏振过顶波：δx=(h/2)cosωt·x, δy=−(h/2)cosωt·y ⇒ ΔL/L = h(t)', 22, 40);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '24px "PingFang SC", sans-serif';
    infoCtx.fillText(`h=1e-21, L=4km ⇒ ΔL=hL≈4.0e-18 m ≈ 质子直径(1.7fm)的 0.5%；形变放大 ×${EX.toExponential(1)}`, 22, 78);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('h_n(f)=1e-23·√((12/f)^6.4+1+(f/150)^2.2)：谷≈1.05e-23@45Hz，150Hz≈1.4e-23/√Hz', 22, 112);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：h₀=${h0.toExponential(1)}  f=${fSrc.toFixed(0)}Hz  h_n(f)=${hn.toExponential(2)}/√Hz`, 22, 152);
    infoCtx.fillText(`ΔL=${dLm.toExponential(1)} m  SNR∝(h₀/h_n)√T(1yr)=${snr.toFixed(1)}`, 22, 186);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('黄点悬在绿线上方 ⇒ 可探测；埋进红段 ⇒ 被噪声淹没', 22, 226);
    infoCtx.fillText(`干涉相位：Δφ=4πΔL/λ=${(4 * Math.PI * dLm / 1.064e-6).toExponential(2)} rad（λ=1064nm，FP 往返叠加）`, 22, 258);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  return {
    update(t, dt) {
      // 双扫描（16s）：h₀ 1e-22→1e-21，f 20→400Hz（对数）
      const u = 0.5 - 0.5 * Math.cos(TWO_PI * ((t % 16) / 16));
      h0 = 1e-22 * Math.pow(10, u);
      fSrc = 20 * Math.pow(20, u);
      const omegaVis = TWO_PI * 0.55 * (fSrc / 120);
      eps = (h0 / 2) * EX * Math.cos(omegaVis * t);       // 视觉应变
      hn = hmin * hshape(fSrc);
      dLm = h0 * 4e3;
      snr = (h0 / hn) * Math.sqrt(1);                     // T = 1yr 归一
      // 端镜
      msx.position.set(-0.2 + (L_ARM + L_ARM * eps), CY, -0.2);
      msy.position.set(-0.2, CY, -0.2 + (L_ARM - L_ARM * eps));
      const a0 = laserGeos[0].attributes['position'].array as Float32Array;
      a0[0] = -0.2; a0[1] = CY; a0[2] = -0.2; a0[3] = msx.position.x; a0[4] = CY; a0[5] = -0.2;
      laserGeos[0].attributes['position'].needsUpdate = true;
      const a1 = laserGeos[1].attributes['position'].array as Float32Array;
      a1[0] = -0.2; a1[1] = CY; a1[2] = -0.2; a1[3] = -0.2; a1[4] = CY; a1[5] = msy.position.z;
      laserGeos[1].attributes['position'].needsUpdate = true;
      // 环
      const R = 1.35;
      for (let i = 0; i < NRING; i++) {
        const a = (i / NRING) * TWO_PI;
        ringPos[i * 3] = R * Math.cos(a) * (1 + eps);
        ringPos[i * 3 + 1] = 0;
        ringPos[i * 3 + 2] = R * Math.sin(a) * (1 - eps);
        ellPos[i * 3] = ringPos[i * 3]; ellPos[i * 3 + 1] = 0; ellPos[i * 3 + 2] = ringPos[i * 3 + 2];
      }
      ellPos[NRING * 3] = ellPos[0]; ellPos[NRING * 3 + 1] = 0; ellPos[NRING * 3 + 2] = ellPos[2];
      ringGeo.attributes['position'].needsUpdate = true;
      ellGeo.attributes['position'].needsUpdate = true;
      updateEllipses(eps);
      updatePhotons(t);
      // 源标记
      const ys = hy(h0 / hmin);
      srcDot.position.set(fx(fSrc), ys, ZC);
      labSrc.position.set(fx(fSrc), ys + 0.35, ZC);
      const mArr = marginGeo.attributes['position'].array as Float32Array;
      mArr[0] = fx(fSrc); mArr[1] = ys; mArr[2] = ZC;
      mArr[3] = fx(fSrc); mArr[4] = hy(hshape(fSrc)); mArr[5] = ZC;
      marginGeo.attributes['position'].needsUpdate = true;
      marginLine.computeLineDistances();
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
