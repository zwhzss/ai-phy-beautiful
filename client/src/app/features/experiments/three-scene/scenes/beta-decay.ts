import type { SceneContext, SceneInstance } from '../types';
/** β 衰变与弱相互作用（P176）：⁶⁰Co β⁻（n→p+e⁻+ν̄e，经由虚 W⁻）。
 *  能谱用允许谱形状 N(T)∝p·E·(K₀−T)²，⁶⁰Co 端点 K₀=318keV（布居 ⁶⁰Ni 2505.7keV 能级）；
 *  费米函数 F(Z,p)=2πζ/(1−e^{−2πζ})，ζ=αZE/p，子核 Z=28 —— 两排能谱柱分别画“裸形状”和“含 F”。
 *  ⟨T⟩ 由同一 spec() 数值积分：裸 114.5keV，含 F 96.6keV（实测 95.7keV）。
 *  Wu 不对称：W(θ)=1+A·P·cosθ，V−A 给出 A=−0.62（演示值，符号与 Wu 实验一致：e⁻ 优先逆自旋），
 *  前向份额闭式 =0.5+A·P/4（P=1 时 0.345），叶瓣曲面与电子发射均由同式接受—拒绝采样。 */
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
  const K0 = 318, ME = 511, ALPHA = 1 / 137.036, ZD = 28, AWU = -0.62;

  // —— β 谱与统计量（面板、谱柱、采样共用同一函数）——
  const spec = (T: number, fermi: boolean): number => {
    if (T <= 0 || T >= K0) return 0;
    const E = T + ME, p = Math.sqrt(E * E - ME * ME);
    let f = 1;
    if (fermi) { const z = TWO_PI * ALPHA * ZD * E / p; f = z / (1 - Math.exp(-z)); }
    return p * E * (K0 - T) * (K0 - T) * f;
  };
  const NI = 900;
  let meanRaw = 0, meanF = 0, sRaw = 0, sF = 0, fMax = 0, rMax = 0, peakT = 0;
  for (let i = 0; i < NI; i++) {
    const T = ((i + 0.5) / NI) * K0;
    const a = spec(T, false), b = spec(T, true);
    sRaw += a; sF += b; meanRaw += a * T; meanF += b * T;
    if (a > rMax) { rMax = a; peakT = T; }
    if (b > fMax) fMax = b;
  }
  meanRaw /= sRaw; meanF /= sF;

  const dummy = new THREE.Object3D();

  // —— 能谱柱墙：两排（裸形状灰色 / 含费米函数青色），T→x 线性映射 ——
  const NB = 30;
  const TX = (T: number): number => -4.7 + 4.0 * (T / K0);
  const barGeo = geo(new THREE.BoxGeometry(0.1, 1, 0.1));
  const barRaw = new THREE.InstancedMesh(barGeo, mat(new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.65 })), NB);
  const barFermi = new THREE.InstancedMesh(barGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee })), NB);
  group.add(barRaw, barFermi);
  for (let i = 0; i < NB; i++) {
    const T = ((i + 0.5) / NB) * K0;
    const ha = 1.9 * spec(T, false) / rMax, hb = 1.9 * spec(T, true) / fMax;
    dummy.position.set(TX(T), 0.05 + ha / 2, -0.45); dummy.scale.set(1, Math.max(0.02, ha), 1); dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix(); barRaw.setMatrixAt(i, dummy.matrix);
    dummy.position.set(TX(T), 0.05 + hb / 2, 0.45); dummy.scale.set(1, Math.max(0.02, hb), 1);
    dummy.updateMatrix(); barFermi.setMatrixAt(i, dummy.matrix);
  }
  barRaw.instanceMatrix.needsUpdate = true; barFermi.instanceMatrix.needsUpdate = true;

  function makeLabel(text: string, color: string, scale = 2.4): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  const lbSpec = makeLabel('β 谱 N(T)∝pE(K₀−T)²　灰=裸形状 青=含费米 F', '#94a3b8', 3.6);
  lbSpec.position.set(-2.7, 2.5, 0); group.add(lbSpec);
  const lbEnd = makeLabel('K₀=318keV 端点', '#ef4444', 2.3);
  lbEnd.position.set(TX(K0) + 0.25, 0.7, 0.9); group.add(lbEnd);
  const lbPeak = makeLabel(`谱峰≈${peakT.toFixed(0)}keV`, '#fbbf24', 2.3);
  lbPeak.position.set(TX(peakT), 2.25, 0.9); group.add(lbPeak);

  // —— 核衰变事件动画：n→p，虚 W⁻，e⁻/ν̄ 背对背 ——
  const NC = new THREE.Vector3(0.8, 3.8, 0);
  const nBall = new THREE.Mesh(geo(new THREE.SphereGeometry(0.3, 14, 12)), mat(new THREE.MeshBasicMaterial({ color: 0x94a3b8 })));
  nBall.position.copy(NC); group.add(nBall);
  const pBall = new THREE.Mesh(geo(new THREE.SphereGeometry(0.32, 14, 12)), mat(new THREE.MeshBasicMaterial({ color: 0x22c55e })));
  pBall.position.copy(NC); pBall.scale.setScalar(0.001); group.add(pBall);
  const wGeo = geo(new THREE.BufferGeometry());
  wGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const wLine = new THREE.Line(wGeo, mat(new THREE.LineDashedMaterial({ color: 0xef4444, dashSize: 0.09, gapSize: 0.06 })));
  group.add(wLine);
  const eGeo = geo(new THREE.BufferGeometry());
  eGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const eLine = new THREE.Line(eGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 })));
  group.add(eLine);
  const vGeo = geo(new THREE.BufferGeometry());
  vGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const vLine = new THREE.Line(vGeo, mat(new THREE.LineDashedMaterial({ color: 0xf8fafc, dashSize: 0.07, gapSize: 0.07 })));
  group.add(vLine);
  const eDot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.08, 10, 10)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  group.add(eDot);
  const lbNucl = makeLabel('⁶⁰Co → ⁶⁰Ni + e⁻ + ν̄e', '#f8fafc', 2.6);
  lbNucl.position.set(NC.x, NC.y - 0.75, 0); group.add(lbNucl);
  const de = new THREE.Vector3(0.45, 0.85, 0.2).normalize();
  const dv = new THREE.Vector3(-0.8, 0.5, -0.35).normalize();
  const dw = new THREE.Vector3(-0.15, -0.95, 0.25).normalize();

  // —— Wu 叶瓣：W(θ)=1+A·P·cosθ 绕自旋轴的回转面 + 采样电子 ——
  const LC = new THREE.Vector3(2.9, 2.3, 0);
  const LR0 = 1.05, NU = 14, NF = 28;
  const lobeGeo = geo(new THREE.BufferGeometry());
  lobeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((NU + 1) * (NF + 1) * 3), 3));
  const lIdx: number[] = [];
  for (let i = 0; i < NU; i++) for (let j = 0; j < NF; j++) {
    const a = i * (NF + 1) + j, b = a + 1, c = a + NF + 1, e = c + 1;
    lIdx.push(a, b, c, b, e, c);
  }
  lobeGeo.setIndex(lIdx);
  const lobe = new THREE.Mesh(lobeGeo, mat(new THREE.MeshBasicMaterial({ color: 0xa855f7, wireframe: true, transparent: true, opacity: 0.55, side: THREE.DoubleSide })));
  group.add(lobe);
  const spinGeo = geo(new THREE.BufferGeometry());
  spinGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([LC.x, LC.y - 1.9, LC.z, LC.x, LC.y + 1.9, LC.z]), 3));
  group.add(new THREE.Line(spinGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee }))));
  const spinCone = new THREE.Mesh(geo(new THREE.ConeGeometry(0.09, 0.3, 8)), mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee })));
  spinCone.position.set(LC.x, LC.y + 2.0, LC.z); group.add(spinCone);
  const lbSpin = makeLabel('自旋轴 +y（θ 从此量起）', '#22d3ee', 2.6);
  lbSpin.position.set(LC.x + 1.4, LC.y + 2.05, 0); group.add(lbSpin);
  const lbWu = makeLabel('W(θ)=1+A·P·cosθ', '#a855f7', 2.6);
  lbWu.position.set(LC.x + 1.55, LC.y - 1.55, 0); group.add(lbWu);

  const NE = 96;
  const eSphere = geo(new THREE.SphereGeometry(0.055, 8, 8));
  const eInst = new THREE.InstancedMesh(eSphere, mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })), NE);
  group.add(eInst);
  const eDir = new Float32Array(NE * 3);
  const eBorn = new Float32Array(NE).fill(-9);
  const eSpd = new Float32Array(NE);
  let eSlot = 0, lastBatch = -1, emaFrac = 0.5, lastBatchT = 0;

  const rs = (): number => Math.random();
  function sampleT(): number {
    for (let k = 0; k < 30; k++) { const T = rs() * K0; if (rs() * fMax < spec(T, true)) return T; }
    return 0.25 * K0;
  }
  function sampleU(P: number): number {
    const top = 1 + Math.abs(AWU * P);
    for (let k = 0; k < 30; k++) { const u = 2 * rs() - 1; if (rs() * top < 1 + AWU * P * u) return u; }
    return -1;
  }
  function emitBatch(P: number, t: number): void {
    let nf = 0, tSum = 0;
    for (let k = 0; k < 8; k++) {
      const u = sampleU(P), ph = rs() * TWO_PI, st = Math.sqrt(Math.max(0, 1 - u * u));
      const T = sampleT();
      if (u > 0) nf++;
      tSum += T;
      const i = eSlot; eSlot = (eSlot + 1) % NE;
      eDir[i * 3] = st * Math.cos(ph); eDir[i * 3 + 1] = u; eDir[i * 3 + 2] = st * Math.sin(ph);
      eBorn[i] = t;
      eSpd[i] = 0.25 + 0.35 * (T / K0);
    }
    emaFrac = emaFrac * 0.82 + (nf / 8) * 0.18;
    lastBatchT = tSum / 8;
  }

  function buildLobe(P: number): void {
    const arr = lobeGeo.attributes['position'].array as Float32Array;
    for (let i = 0; i <= NU; i++) {
      const u = -1 + 2 * (i / NU);
      const r = LR0 * (1 + AWU * P * u);
      const st = Math.sqrt(Math.max(0, 1 - u * u));
      for (let j = 0; j <= NF; j++) {
        const ph = (j / NF) * TWO_PI, v = i * (NF + 1) + j;
        arr[v * 3] = LC.x + r * st * Math.cos(ph);
        arr[v * 3 + 1] = LC.y + r * u;
        arr[v * 3 + 2] = LC.z + r * st * Math.sin(ph);
      }
    }
    lobeGeo.attributes['position'].needsUpdate = true;
  }

  function setSeg(g: import('three').BufferGeometry, a: import('three').Vector3, b: import('three').Vector3): void {
    const arr = g.attributes['position'].array as Float32Array;
    arr[0] = a.x; arr[1] = a.y; arr[2] = a.z;
    arr[3] = b.x; arr[4] = b.y; arr[5] = b.z;
    g.attributes['position'].needsUpdate = true;
  }

  // —— 面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 840; infoCv.height = 300;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.2, 3.3)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 6.4, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  let curP = 0, curAge = 0;
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 840, 300);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 832, 292);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 832, 292);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText('β⁻：n→p+e⁻+ν̄e（经虚 W⁻）｜N(T)∝p·E·(K₀−T)²，K₀=318keV', 22, 40);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '24px "PingFang SC", sans-serif';
    infoCtx.fillText(`⟨T⟩=∫TN/∫N：裸 ${meanRaw.toFixed(1)}keV → 含费米 ${meanF.toFixed(1)}keV（实测 95.7）`, 22, 78);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('W(θ)=1+A·P·cosθ（V−A）：A=−0.62 ⇒ e⁻ 逆自旋占优（Wu 实验）', 22, 112);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：P=${curP.toFixed(2)} 前向份额 ${emaFrac.toFixed(3)} vs 闭式 ${(0.5 + AWU * curP / 4).toFixed(3)}`, 22, 152);
    infoCtx.fillText(`衰变事件龄 ${curAge.toFixed(1)}s｜本批 e⁻ 平均动能 ${lastBatchT.toFixed(0)}keV（谱峰 ${peakT.toFixed(0)}）`, 22, 186);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('β 后 ⁶⁰Ni* 级联退激 γ 1173/1332keV ⇒ 标定源；中微子带走其余能量', 22, 226);
    infoTex.needsUpdate = true;
  }

  buildLobe(0);
  drawInfo();

  return {
    update(t, dt) {
      // 扫描：极化 P 0→1→0，16s 余弦
      const P = 0.5 - 0.5 * Math.cos(TWO_PI * ((t % 16) / 16));
      curP = P;
      buildLobe(P);

      // 电子发射批次（2s 一批，按当前 P 的 W(θ) 与谱形采样）
      const batch = Math.floor(t / 2);
      if (batch !== lastBatch) { lastBatch = batch; emitBatch(P, t); }
      for (let i = 0; i < NE; i++) {
        const age = t - eBorn[i];
        if (age >= 0 && age < 3.4) {
          const d = age * eSpd[i];
          dummy.position.set(LC.x + eDir[i * 3] * d, LC.y + eDir[i * 3 + 1] * d, LC.z + eDir[i * 3 + 2] * d);
          dummy.scale.setScalar(age > 3.0 ? (3.4 - age) / 0.4 : 1);
        } else dummy.scale.setScalar(0.0001);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix(); eInst.setMatrixAt(i, dummy.matrix);
      }
      eInst.instanceMatrix.needsUpdate = true;

      // 核事件循环 6s：n→p（1.0–1.6s），W⁻ 虚线（1.6–2.2s），e⁻/ν̄ 外飞（2.2–4.2s）
      const cyc = Math.floor(t / 6), age = t - cyc * 6;
      curAge = age;
      const gN = Math.max(0.001, age < 1.0 ? 1 : age < 1.6 ? 1 - (age - 1) / 0.6 : 0);
      nBall.scale.setScalar(gN); nBall.visible = gN > 0.01;
      pBall.scale.setScalar(Math.max(0.001, age < 1.0 ? 0.001 : Math.min(1, (age - 1) / 0.6)));
      const gw = age < 1.6 ? 0 : Math.min(1, (age - 1.6) / 0.6);
      setSeg(wGeo, NC, NC.clone().addScaledVector(dw, 0.85 * gw));
      wLine.visible = gw > 0.01 && age < 2.3;
      if (wLine.visible) wLine.computeLineDistances();
      const ge = age < 2.2 ? 0 : Math.min(1, (age - 2.2) / 2.0);
      setSeg(eGeo, NC, NC.clone().addScaledVector(de, 1.5 * ge));
      setSeg(vGeo, NC, NC.clone().addScaledVector(dv, 1.4 * ge));
      eLine.visible = vLine.visible = ge > 0.01;
      if (vLine.visible) vLine.computeLineDistances();
      eDot.visible = ge > 0.01;
      eDot.position.copy(NC).addScaledVector(de, 1.5 * ge);

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
