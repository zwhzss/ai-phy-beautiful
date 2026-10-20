import type { SceneContext, SceneInstance } from '../types';
/**
 * 三相电（P118）：三相对称绕组的空间旋转磁动势与恒定瞬时功率。
 * 主控方程：f(θ,t) = F_max·Σ_k cos(θ−k·2π/3)·cos(ωt−k·2π/3) = (3/2)F_max·cos(θ−ωt)
 * —— 幅值恒为 3/2·F_max 且以 ω 匀速旋转；断一相后分解为正转 1 + 反转 ½ ⇒ 脉动椭圆场；
 * 功率 p = R·Σ i_k²：对称 = 3/2·R·I²（恒定），缺 C 相 ⇒ p 叠加 2ω 纹波（幅值 ½）。
 * 接线制式（画面右上实际布线）：Y（星形）三相末端共中性点 N ⇒ 线电压 U_L=|V_a−V_b|=√3·U_ph（对称时，
 * 由相量差实算，缺相即偏离 √3）；Δ（三角形）首尾相接成环 ⇒ U_L=U_ph、I_L=√3·I_ph。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  const starGeo = geo(new THREE.BufferGeometry());
  const starPos = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 400;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 400;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 400;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  const TWO_PI = Math.PI * 2;
  const PHI = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];       // 三相绕组轴线方位角（空间互差 120°）
  const OMEGA = 1.1;                                            // 展示电角速度 rad/s
  const R_BASE = 2.3;                                           // 磁动势曲面基圆半径
  const K_SURF = 0.55;                                          // f(θ,t) 的径向显示增益
  const AMPS = [1, 1, 1];                                       // 三相电流幅值（a_c 被扫描）
  const WIND_Y = 1.7;                                           // 绕组平面高度

  // —— 磁动势曲面：r(θ) = R_BASE + K·f(θ,t)，θ∈[0,2π) ——
  const SEGS = 144;
  const surfGeo = geo(new THREE.BufferGeometry());
  const surfPos = new Float32Array((SEGS + 1) * 2 * 3);
  surfGeo.setAttribute('position', new THREE.BufferAttribute(surfPos, 3));
  {
    const idx: number[] = [];
    for (let i = 0; i < SEGS; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d2 = a + 3;
      idx.push(a, b, c, b, d2, c);
    }
    surfGeo.setIndex(idx);
  }
  const surfMat = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  const surf = new THREE.Mesh(surfGeo, surfMat);
  surf.position.y = 0.05;
  group.add(surf);

  function fAt(th: number, wt: number): number {
    let s = 0;
    for (let k = 0; k < 3; k++) s += AMPS[k] * Math.cos(th - PHI[k]) * Math.cos(wt - PHI[k]);
    return s;
  }
  function updateSurf(wt: number): void {
    for (let i = 0; i <= SEGS; i++) {
      const th = (i / SEGS) * TWO_PI;
      const r = R_BASE + K_SURF * fAt(th, wt);
      surfPos[i * 6] = r * Math.cos(th); surfPos[i * 6 + 1] = 0; surfPos[i * 6 + 2] = r * Math.sin(th);
      surfPos[i * 6 + 3] = r * Math.cos(th); surfPos[i * 6 + 4] = 0.75; surfPos[i * 6 + 5] = r * Math.sin(th);
    }
    surfGeo.attributes['position'].needsUpdate = true;
  }

  // —— 合成磁动势矢量 Fx = Σ a_k cos(ωt−φk)cosφk, Fy = Σ a_k cos(ωt−φk)sinφk ——
  const fLineGeo = geo(new THREE.BufferGeometry());
  fLineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  group.add(new THREE.Line(fLineGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 }))));
  const fTip = new THREE.Mesh(geo(new THREE.ConeGeometry(0.11, 0.34, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  group.add(fTip);
  const UP = new THREE.Vector3(0, 1, 0);

  // —— 三相绕组线圈（沿各自轴线方向的扁平环）与电流柱 ——
  const coilMats: import('three').MeshStandardMaterial[] = [];
  const bars: import('three').Mesh[] = [];
  const barMats: import('three').MeshStandardMaterial[] = [];
  const COIL_COLORS = [0xef4444, 0x22c55e, 0x3b82f6];
  for (let k = 0; k < 3; k++) {
    const coilMat = mat(new THREE.MeshStandardMaterial({ color: COIL_COLORS[k], emissive: COIL_COLORS[k], emissiveIntensity: 0.25, metalness: 0.3, roughness: 0.5, transparent: true, opacity: 0.9 }));
    const coil = new THREE.Mesh(geo(new THREE.TorusGeometry(0.42, 0.07, 10, 28)), coilMat);
    coil.position.set(0, WIND_Y, 0);
    // 环面所在平面包含轴线 φk：法向取水平垂直方向
    coil.rotation.set(Math.PI / 2, 0, 0);
    const holder = new THREE.Group();
    holder.rotation.y = PHI[k];
    coil.position.set(1.35, 0, 0);
    holder.add(coil);
    holder.position.y = WIND_Y;
    group.add(holder);
    coilMats.push(coilMat);
    // 电流柱：竖直圆柱，高度 ∝ 瞬时电流
    const barMat = mat(new THREE.MeshStandardMaterial({ color: COIL_COLORS[k], emissive: COIL_COLORS[k], emissiveIntensity: 0.55, transparent: true, opacity: 0.9 }));
    const bar = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.11, 0.11, 1, 10)), barMat);
    bar.position.set(Math.cos(PHI[k]) * 3.0, 0, Math.sin(PHI[k]) * 3.0);
    group.add(bar);
    bars.push(bar);
    barMats.push(barMat);
  }

  // —— Y（星形）/ Δ（三角形）接线：端子取在电流柱顶（r=3.0），与三相绕组同源 ——
  const R_TERM = 3.0, TERM_Y = 1.92, DL_Y = 2.45;
  const termPts = PHI.map((p) => new THREE.Vector3(Math.cos(p) * R_TERM, TERM_Y, Math.sin(p) * R_TERM));
  const dlPts = PHI.map((p) => new THREE.Vector3(Math.cos(p) * R_TERM, DL_Y, Math.sin(p) * R_TERM));
  const termGeo = geo(new THREE.SphereGeometry(0.085, 10, 10));
  const termMat = mat(new THREE.MeshBasicMaterial({ color: 0xe2e8f0 }));
  termPts.forEach((tp) => { const tm = new THREE.Mesh(termGeo, termMat); tm.position.copy(tp); group.add(tm); });
  const neutral = new THREE.Mesh(geo(new THREE.SphereGeometry(0.14, 12, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xa855f7 })));
  neutral.position.set(0, TERM_Y, 0);
  group.add(neutral);
  {
    const yGeo = geo(new THREE.BufferGeometry());
    const yp: number[] = [];
    termPts.forEach((tp) => { yp.push(tp.x, tp.y, tp.z, 0, TERM_Y, 0); });   // 三相末端拉到中性点 N
    yGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(yp), 3));
    group.add(new THREE.LineSegments(yGeo, mat(new THREE.LineBasicMaterial({ color: 0xa855f7 }))));
  }
  {
    const dGeo = geo(new THREE.BufferGeometry());
    const dp: number[] = [];
    for (let k = 0; k < 3; k++) {
      const a = dlPts[k], b = dlPts[(k + 1) % 3];
      dp.push(termPts[k].x, termPts[k].y, termPts[k].z, a.x, DL_Y, a.z);      // 竖引线
      dp.push(a.x, a.y, a.z, b.x, b.y, b.z);                                    // 首尾相接（三角形边）
    }
    dGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dp), 3));
    group.add(new THREE.LineSegments(dGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e }))));
  }

  // —— 转子环（被拖动旋转，角度 = ωt）——
  const rotor = new THREE.Group();
  {
    const rim = new THREE.Mesh(geo(new THREE.TorusGeometry(1.05, 0.09, 10, 40)), mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.35 })));
    rim.rotation.x = Math.PI / 2;
    rotor.add(rim);
    const spokeGeo = geo(new THREE.BoxGeometry(1.9, 0.06, 0.09));
    const spokeMat = mat(new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6, roughness: 0.4 }));
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Mesh(spokeGeo, spokeMat);
      sp.rotation.y = (i / 4) * Math.PI;
      rotor.add(sp);
    }
    const brush = new THREE.Mesh(geo(new THREE.BoxGeometry(0.16, 0.16, 0.5)), mat(new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xf472b6, emissiveIntensity: 0.4 })));
    brush.position.set(1.05, 0, 0);
    rotor.add(brush);
  }
  rotor.position.y = 0.9;
  group.add(rotor);

  // —— 瞬时功率曲线（滚动）——
  const pCv = document.createElement('canvas');
  pCv.width = 512; pCv.height = 128;
  const pCtx = pCv.getContext('2d')!;
  const pTex = tex(new THREE.CanvasTexture(pCv));
  const pPanel = new THREE.Mesh(geo(new THREE.PlaneGeometry(4.4, 1.1)), mat(new THREE.MeshBasicMaterial({ map: pTex, transparent: true })));
  pPanel.position.set(-3.4, 2.6, 0);
  pPanel.rotation.y = Math.PI / 2.4;
  group.add(pPanel);
  const HIST = 128;
  const pHist = new Float32Array(HIST);
  function drawPower(): void {
    pCtx.clearRect(0, 0, 512, 128);
    pCtx.fillStyle = 'rgba(7,11,20,0.8)';
    pCtx.fillRect(0, 0, 512, 128);
    pCtx.strokeStyle = '#334155';
    pCtx.beginPath(); pCtx.moveTo(0, 64); pCtx.lineTo(512, 64); pCtx.stroke();
    for (let i = 0; i < HIST; i++) {
      const x = (i / HIST) * 512;
      const v = pHist[i];
      pCtx.fillStyle = Math.abs(v - 1.5) < 0.05 ? '#22c55e' : '#fbbf24';
      const h = Math.max(2, v * 38);
      pCtx.fillRect(x, 122 - h, 3, h);
    }
    pTex.needsUpdate = true;
  }

  function makeLabel(text: string, color: string, scale = 3.0): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(scale, scale / 8, 1);
    s.renderOrder = 998;
    return s;
  }
  const lA = makeLabel('A 相绕组', '#ef4444', 1.8); lA.position.set(Math.cos(PHI[0]) * 1.9, WIND_Y + 0.7, Math.sin(PHI[0]) * 1.9); group.add(lA);
  const lB = makeLabel('B 相绕组', '#22c55e', 1.8); lB.position.set(Math.cos(PHI[1]) * 1.9, WIND_Y + 0.7, Math.sin(PHI[1]) * 1.9); group.add(lB);
  const lC = makeLabel('C 相绕组', '#3b82f6', 1.8); lC.position.set(Math.cos(PHI[2]) * 1.9, WIND_Y + 0.7, Math.sin(PHI[2]) * 1.9); group.add(lC);
  const lP = makeLabel('瞬时功率 p(t)=RΣi_k²', '#fbbf24', 3.0); lP.position.set(-3.4, 3.4, 0.3); group.add(lP);
  const lY = makeLabel('Y 星形：三相末端共中性点 N ⇒ U_L=√3·U_ph', '#c4b5fd', 5.2); lY.position.set(0, 1.5, 2.9); group.add(lY);
  const lDL = makeLabel('Δ 三角形：首尾相接成环 ⇒ U_L=U_ph、I_L=√3·I_ph', '#86efac', 5.6); lDL.position.set(0, 2.86, -0.6); group.add(lDL);

  const infoCv = document.createElement('canvas');
  infoCv.width = 512; infoCv.height = 320;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const info = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  info.scale.set(6.7, 6.7 * 320 / 512, 1);
  info.position.set(0, 5.3, 0);
  info.renderOrder = 999;
  group.add(info);

  let wt = 0, fMag = 1.5, fRip = 0, pRip = 0, aC = 1, uYab = 1.732, uYbc = 1.732;
  let lastWtCyc = -1, fMin = 1e9, fMax = -1e9, pMin = 1e9, pMax = -1e9;

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 512, 320);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)';
    infoCtx.fillRect(3, 3, 506, 314);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3;
    infoCtx.strokeRect(3, 3, 506, 314);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText('三相电：旋转磁场与恒定功率', 14, 36);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '21px "PingFang SC", sans-serif';
    infoCtx.fillText('Σcos(θ−120°k)cos(ωt−120°k)', 14, 72);
    infoCtx.fillText('= (3/2)F_max·cos(θ−ωt)：匀速旋转', 14, 100);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('缺相 ⇒ 正转1+反转½：脉动椭圆场', 14, 128);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 20px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数: |F|=${fMag.toFixed(2)}Fm (对称1.50)`, 14, 162);
    infoCtx.fillText(`幅值纹波 ${(fRip * 100).toFixed(0)}% 功率纹波 ${(pRip * 100).toFixed(0)}%`, 14, 192);
    infoCtx.fillStyle = aC < 0.5 ? '#ef4444' : '#94a3b8';
    infoCtx.fillText(`a_C=${aC.toFixed(2)}${aC < 0.05 ? ' —— C 相断开！' : ''}`, 14, 226);
    infoCtx.fillStyle = '#c4b5fd';
    infoCtx.fillText(`接线读数 Y：|U_ab|=${uYab.toFixed(2)}·U_ph  |U_bc|=${uYbc.toFixed(2)}·U_ph`, 14, 258);
    infoCtx.fillStyle = '#86efac';
    infoCtx.fillText(`对称时 =√3=1.732（Δ 接法：U_L=U_ph=1.00）`, 14, 290);
    infoTex.needsUpdate = true;
  }

  updateSurf(0);
  drawPower();
  drawInfo();

  return {
    update(t, dt) {
      // 16 s 周期：前 9 s 三相对称，后 7 s C 相幅值 1→0（断相演示），再恢复
      const cycle = t % 16;
      if (cycle < 9) aC = 1;
      else if (cycle < 12) aC = 1 - (cycle - 9) / 3;
      else if (cycle < 15) aC = 0;
      else aC = (cycle - 15) * 1;
      AMPS[2] = aC;

      // 相电压相量 V_k = a_k·e^{−iφ_k} ⇒ Y 接法线电压 = |V_a−V_b|（与绕组幅值同源；对称时恰为 √3）
      const re = AMPS.map((a, kk) => a * Math.cos(PHI[kk]));
      const im = AMPS.map((a, kk) => -a * Math.sin(PHI[kk]));
      uYab = Math.hypot(re[0] - re[1], im[0] - im[1]);
      uYbc = Math.hypot(re[1] - re[2], im[1] - im[2]);

      wt = t * OMEGA;

      updateSurf(wt);

      // 合成矢量
      let fx = 0, fy = 0, pnow = 0;
      for (let k = 0; k < 3; k++) {
        const i = AMPS[k] * Math.cos(wt - PHI[k]);
        fx += i * Math.cos(PHI[k]);
        fy += i * Math.sin(PHI[k]);
        pnow += i * i;
      }
      fMag = Math.hypot(fx, fy);
      const FL = 1 + fMag * K_SURF;
      const ang = Math.atan2(fy, fx);
      const fa = fLineGeo.attributes['position'] as import('three').BufferAttribute;
      const fv = fa.array as Float32Array;
      fv[0] = 0; fv[1] = 0.42; fv[2] = 0;
      fv[3] = FL * Math.cos(ang); fv[4] = 0.42; fv[5] = FL * Math.sin(ang);
      fa.needsUpdate = true;
      fTip.position.set(FL * Math.cos(ang), 0.55, FL * Math.sin(ang));
      fTip.quaternion.setFromUnitVectors(UP, new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)));

      // |F| 纹波与功率纹波：在整电周期内实测 min/max（与几何同源）
      const cycIdx = Math.floor(wt / TWO_PI);
      if (cycIdx !== lastWtCyc) { lastWtCyc = cycIdx; fMin = 1e9; fMax = -1e9; pMin = 1e9; pMax = -1e9; }
      fMin = Math.min(fMin, fMag); fMax = Math.max(fMax, fMag);
      pMin = Math.min(pMin, pnow); pMax = Math.max(pMax, pnow);
      fRip = fMax - fMin > 1e-3 ? (fMax - fMin) / (fMax + fMin) : 0;
      pRip = pMax - pMin > 1e-3 ? (pMax - pMin) / (pMax + pMin) : 0;

      // 电流柱
      for (let k = 0; k < 3; k++) {
        const i = AMPS[k] * Math.cos(wt - PHI[k]);
        const h = 0.25 + Math.abs(i) * 1.1;
        bars[k].scale.set(1, h, 1);
        bars[k].position.y = h / 2 - 0.1;
        barMats[k].emissiveIntensity = 0.3 + Math.abs(i);
        coilMats[k].emissiveIntensity = 0.15 + 0.5 * Math.abs(i);
      }

      // 功率滚动窗
      pHist.copyWithin(0, 1);
      pHist[HIST - 1] = Math.min(2.9, pnow);
      drawPower();

      // 转子被磁场拖动
      rotor.rotation.y = -wt;
      if (aC < 0.99) rotor.rotation.y = -wt + 0.35 * Math.sin(2 * wt); // 2ω 转矩脉动

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
