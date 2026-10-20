import type { SceneContext, SceneInstance } from '../types';
/** 希格斯粒子发现实验（P328）：主控方程 不变质量 m²c⁴ = (ΣEᵢ)² − |Σpᵢc|²；
 *  H→γγ 二体情形 m² = 2E₁E₂(1−cosθ₁₂) —— 画面按公式由 (E₁,E₂,m) 反解两光子开角；
 *  H→ZZ*→4μ 取 cosθ_k = 1−2(k+½)/4 的二体级联运动学，μ 子在 B∥z 螺线管内按 r = p_T/(0.3B) 弯折（夸大 600 倍）。
 *  直方图逐事件堆积，125 GeV 峰与面板显著性 Z=√(2[(S+B)ln(1+S/B)−S]) 同源于这批事件。 */
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

  // —— ATLAS 型筒形探测器逐层（筒轴 = z 束流轴），半径按真实层序递增 ——
  const LEN = 5.4;
  function addLayer(r: number, color: number, opacity: number, wire: boolean): void {
    const c = new THREE.Mesh(
      geo(new THREE.CylinderGeometry(r, r, LEN, 40, 1, true)),
      mat(new THREE.MeshBasicMaterial({ color, wireframe: wire, transparent: true, opacity, side: THREE.DoubleSide })),
    );
    c.rotation.x = Math.PI / 2;
    group.add(c);
    const ringGeo = geo(new THREE.RingGeometry(r * 0.955, r, 40));
    const ringMat = mat(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    const r1 = new THREE.Mesh(ringGeo, ringMat); r1.position.z = LEN / 2;
    const r2 = new THREE.Mesh(ringGeo, ringMat); r2.position.z = -LEN / 2;
    group.add(r1, r2);
  }
  const pipe = new THREE.Mesh(
    geo(new THREE.CylinderGeometry(0.13, 0.13, LEN, 14)),
    mat(new THREE.MeshBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.55 })),
  );
  pipe.rotation.x = Math.PI / 2;
  group.add(pipe);
  addLayer(0.95, 0x22d3ee, 0.6, true);    // 内径迹室
  addLayer(1.55, 0x22c55e, 0.16, false);  // 电磁量能器 ECAL
  addLayer(2.25, 0xa855f7, 0.14, false);  // 强子量能器 HCAL
  addLayer(2.95, 0xf472b6, 0.5, true);    // μ 子谱仪

  function makeLabel(text: string, color: string, scale = 2.6): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 28px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  const layerLabels: [string, string, number][] = [
    ['内径迹室', '#22d3ee', 0.95], ['ECAL γγ 簇', '#22c55e', 1.55],
    ['HCAL', '#a855f7', 2.25], ['μ 子谱仪', '#f472b6', 2.95],
  ];
  layerLabels.forEach(([txt, col, r]) => {
    const lb = makeLabel(txt, col);
    lb.position.set(r * 0.71, r * 0.71, -LEN / 2 - 0.45);
    group.add(lb);
  });

  // —— 粒子线：2 条 γ + 4 条 μ ——
  const gamMat = mat(new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 1 }));
  const muMat = mat(new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 1 }));
  const gamGeos: import('three').BufferGeometry[] = [];
  for (let s = 0; s < 2; s++) {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
    g.setDrawRange(0, 0);
    group.add(new THREE.Line(g, gamMat));
    gamGeos.push(g);
  }
  const muGeos: import('three').BufferGeometry[] = [];
  for (let k = 0; k < 4; k++) {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(13 * 3), 3));
    g.setDrawRange(0, 0);
    group.add(new THREE.Line(g, muMat));
    muGeos.push(g);
  }
  const calCell = new THREE.Mesh(geo(new THREE.SphereGeometry(0.12, 10, 10)), mat(new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.9 })));
  calCell.visible = false;
  group.add(calCell);
  const vtx = new THREE.Mesh(geo(new THREE.SphereGeometry(0.08, 10, 10)), mat(new THREE.MeshBasicMaterial({ color: 0xef4444 })));
  group.add(vtx);

  // —— 事件与直方图（数据同源） ——
  const NB = 64, MLO = 60, MHI = 320;
  const hsig = [new Float32Array(NB), new Float32Array(NB)];
  const hbkg = [new Float32Array(NB), new Float32Array(NB)];
  let nEv = 0;
  const hash = (a: number, b: number): number => {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const gsum = (i: number): number => hash(i, 11) + hash(i, 12) + hash(i, 13) + hash(i, 14) - 2;

  let evIsGamma = true, evM = 125, evE1 = 0, evE2 = 0, evTheta = 0, evPhi = 0;
  const evMu = [0, 0, 0, 0];

  function binOf(m: number): number {
    return Math.max(0, Math.min(NB - 1, Math.floor(((m - MLO) / (MHI - MLO)) * NB)));
  }
  function buildEvent(i: number): void {
    evIsGamma = hash(i, 1) < 0.5;
    const sig = hash(i, 2) < 0.6;
    evM = sig ? 125 + 9 * gsum(i) : 92 + 210 * Math.pow(hash(i, 3), 2.6);
    evM = Math.max(MLO + 1, Math.min(MHI - 1, evM));
    const ch = evIsGamma ? 0 : 1;
    if (sig) hsig[ch][binOf(evM)] += 1; else hbkg[ch][binOf(evM)] += 1;
    nEv++;
    if (evIsGamma) {
      evE1 = 48 + 28 * hash(i, 5);
      evE2 = 40 + 28 * hash(i, 6);
      // 几何反解：cosθ₁₂ = 1 − m²/(2E₁E₂)（需 E₁E₂ ≥ m²/4）
      const minE1 = (evM * evM) / (4 * evE2) * 1.08;
      if (evE1 < minE1) evE1 = minE1;
      evTheta = Math.acos(Math.max(-1, Math.min(1, 1 - (evM * evM) / (2 * evE1 * evE2))));
      evPhi = hash(i, 7) * Math.PI * 2;
    } else {
      let s = 0;
      for (let k = 0; k < 4; k++) { evMu[k] = (evM / 4) * (1 + 0.3 * (hash(i, 8 + k) - 0.5)); s += evMu[k]; }
      for (let k = 0; k < 4; k++) evMu[k] *= evM / s; // ΣE = m（μ 质量忽略）
    }
  }

  const AXIS_Z = new THREE.Vector3(0, 0, 1);
  function renderEvent(t: number, evT: number): void {
    const age = t - evT;
    const vis = age >= 0 && age < 1.4;
    const op = vis ? Math.max(0, 1 - age / 1.4) : 0;
    gamMat.opacity = op; muMat.opacity = op;
    vtx.visible = vis;
    calCell.visible = false;
    if (!vis) { gamGeos.forEach((g) => g.setDrawRange(0, 0)); muGeos.forEach((g) => g.setDrawRange(0, 0)); return; }
    if (evIsGamma) {
      muGeos.forEach((g) => g.setDrawRange(0, 0));
      // 两光子开角 θ₁₂，绕方位 evPhi 张成平面：dir± = R(±θ₁₂/2, â)·ŷ，â=(cosφ,0,sinφ) ⟂ ŷ
      const half = evTheta / 2, sa = Math.sin(half), ca = Math.cos(half);
      const ax = new THREE.Vector3(Math.cos(evPhi), 0, Math.sin(evPhi));
      const cross = ax.cross(new THREE.Vector3(0, 1, 0)); // â×ŷ（轴向量保持不动：cross 就地修改 ax，已用完）
      for (let s = 0; s < 2; s++) {
        const sgn = s === 0 ? 1 : -1;
        const dir = new THREE.Vector3(cross.x * sa * sgn, ca, cross.z * sa * sgn).normalize();
        const e = s === 0 ? evE1 : evE2;
        const len = Math.min(2.6, 0.4 + e * 0.032);
        const arr = gamGeos[s].attributes['position'].array as Float32Array;
        arr[0] = 0; arr[1] = 0; arr[2] = 0;
        arr[3] = dir.x * len; arr[4] = dir.y * len; arr[5] = dir.z * len;
        gamGeos[s].attributes['position'].needsUpdate = true;
        gamGeos[s].setDrawRange(0, 2);
        if (s === 0) { calCell.visible = age > 0.25; calCell.position.copy(dir).multiplyScalar(Math.min(len, 1.55)); }
      }
    } else {
      gamGeos.forEach((g) => g.setDrawRange(0, 0));
      for (let k = 0; k < 4; k++) {
        const ct = 1 - (2 * (k + 0.5)) / 4;
        const st = Math.sqrt(Math.max(1e-6, 1 - ct * ct));
        const phi = 0.7 + k * 1.85;
        const dirHat = new THREE.Vector3(st * Math.cos(phi), ct, st * Math.sin(phi));
        const q = k < 2 ? 1 : -1; // μ⁺μ⁻ / μ⁻μ⁺ 对
        // 真实回旋半径 r[m] = p_T[GeV]/(0.3·B[T])，1 场景单位 = 2cm，夸大 EX=600 倍
        const pT = st * evMu[k];
        const rReal = pT / (0.3 * 2.0) / 0.02;         // 场景单位
        const R = rReal / 600;
        const L = Math.min(2.75, 0.5 + evMu[k] * 0.03); // 线长 ∝ 动量
        const th0 = L / Math.max(R, 0.05);
        const bend = dirHat.clone().cross(AXIS_Z).multiplyScalar(q).normalize(); // v×B 向心
        const arr = muGeos[k].attributes['position'].array as Float32Array;
        const C = bend.clone().multiplyScalar(R);
        const e0 = bend.clone().multiplyScalar(-1);
        for (let ss = 0; ss < 13; ss++) {
          const th = th0 * (ss / 12);
          const pos = new THREE.Vector3()
            .addScaledVector(e0, R * Math.cos(th))
            .addScaledVector(dirHat, R * Math.sin(th))
            .add(C);
          arr[ss * 3] = pos.x; arr[ss * 3 + 1] = pos.y; arr[ss * 3 + 2] = pos.z;
        }
        muGeos[k].attributes['position'].needsUpdate = true;
        muGeos[k].setDrawRange(0, 13);
      }
    }
  }

  // —— 面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 840; infoCv.height = 384;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.2, 4.2)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 6.5, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  function signif(ch: number): number {
    let s = 0, b = 0;
    for (let i = 0; i < NB; i++) {
      const m = MLO + ((i + 0.5) / NB) * (MHI - MLO);
      if (m > 112 && m < 138) { s += hsig[ch][i]; b += hbkg[ch][i]; }
    }
    return b > 0 && s > 0 ? Math.sqrt(Math.max(0, 2 * ((s + b) * Math.log(1 + s / b) - s))) : 0;
  }
  function drawHist(ch: number, x0: number, y0: number, w: number, hgt: number, color: string): void {
    let mx = 1;
    for (let i = 0; i < NB; i++) mx = Math.max(mx, hsig[ch][i] + hbkg[ch][i]);
    infoCtx.strokeStyle = '#334155';
    infoCtx.strokeRect(x0, y0, w, hgt);
    const bw = w / NB;
    for (let i = 0; i < NB; i++) {
      const tot = hsig[ch][i] + hbkg[ch][i];
      const hh = (Math.log(1 + tot) / Math.log(1 + mx)) * (hgt - 6);
      if (hh < 0.4) continue;
      infoCtx.fillStyle = color;
      infoCtx.fillRect(x0 + i * bw + 0.5, y0 + hgt - hh, bw - 1, hh);
    }
    const x125 = x0 + ((125 - MLO) / (MHI - MLO)) * w;
    infoCtx.strokeStyle = '#ef4444';
    infoCtx.beginPath(); infoCtx.moveTo(x125, y0); infoCtx.lineTo(x125, y0 + hgt); infoCtx.stroke();
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '17px "PingFang SC", sans-serif';
    infoCtx.fillText('60 GeV', x0 + 2, y0 + hgt + 16);
    infoCtx.fillText('320 GeV', x0 + w - 46, y0 + hgt + 16);
  }
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 840, 384);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 832, 376);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 832, 376);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 27px "PingFang SC", sans-serif';
    infoCtx.fillText('希格斯发现：m²c⁴ = (ΣEᵢ)² − |Σpᵢc|²；γγ 道 m² = 2E₁E₂(1−cosθ₁₂)', 22, 38);
    infoCtx.fillStyle = '#f472b6';
    infoCtx.font = '25px "PingFang SC", sans-serif';
    infoCtx.fillText(
      evIsGamma
        ? `当前事件 H→γγ：E₁=${evE1.toFixed(0)}、E₂=${evE2.toFixed(0)} GeV，θ₁₂=${(evTheta * 57.2958).toFixed(1)}° ⇒ m=${evM.toFixed(1)} GeV`
        : `当前事件 H→ZZ*→4μ：ΣE=${evMu.reduce((a, b) => a + b, 0).toFixed(1)} GeV ⇒ m=${evM.toFixed(1)} GeV（曲率夸大×600）`,
      22, 76,
    );
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 25px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：N=${nEv}  Z(γγ)=${signif(0).toFixed(1)}σ  Z(4μ)=${signif(1).toFixed(1)}σ  双道同时出峰 ⇒ 联合显著性 >5σ`, 22, 114);
    drawHist(0, 26, 148, 380, 150, '#fbbf24');
    drawHist(1, 434, 148, 380, 150, '#22d3ee');
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '21px "PingFang SC", sans-serif';
    infoCtx.fillText('左：γγ 不变质量（黄）  右：4μ 不变质量（青）  红线=125 GeV', 26, 332);
    infoCtx.fillText('2012-07-04 CERN ATLAS/CMS：标准模型最后一块拼图', 26, 360);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  let prevRound = -1, prevEv = -1, evT = 0;

  return {
    update(t, dt) {
      // 扫描自变量：累积事件数（每 1.5s 一个，每 24s = 16 个事件一轮重积）
      const ROUND = 24;
      const round = Math.floor(t / ROUND);
      if (round !== prevRound) {
        hsig.forEach((a) => a.fill(0));
        hbkg.forEach((a) => a.fill(0));
        nEv = 0;
        prevRound = round;
        prevEv = -1;
      }
      const ev = Math.floor((t - round * ROUND) / 1.5);
      if (ev !== prevEv) {
        prevEv = ev;
        evT = round * ROUND + ev * 1.5;
        buildEvent(round * 16 + ev + 1);
      }
      renderEvent(t, evT);
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
