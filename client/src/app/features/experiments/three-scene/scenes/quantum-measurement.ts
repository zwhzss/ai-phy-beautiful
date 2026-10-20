import type { SceneContext, SceneInstance } from '../types';
/** 量子测量与坍缩（P160）：主控方程
 *  ① 玻恩规则：测量轴 â 与态矢 n̂ 夹角 χ ⇒ P₊=|⟨+â|ψ⟩|²=cos²(χ/2)，P₋=sin²(χ/2)
 *  ② 投影公设：测得 + 后 |ψ⟩→|+â⟩（矢钉到北极）；测得 − 钉到南极——每次试验随机跳变
 *  ③ 退相干：坍缩结果与环境持续耦合，布洛赫矢长度 r(t)=e^(−t/τ) 收缩（纯度=(1+r²)/2→混态）
 *  ④ 统计收敛：N 次试验的 N₊/N 阶梯逼近 Σcos²(χ/2)/N 量子预测（大数定律）
 *  画面：玻尔球（线框+三条大圆），金色态矢 |ψ⟩ 固定于 (θ=50°,φ=40°)；青色测量轴 â 极角在 16 s 内
 *  15°→165° 往返扫描。每 2.4 s 一次试验：虚线投影分量 → 闪光 → 随机跳至极点 → 退相干收缩 → 重新制备。
 *  球下方一排 40 颗结果珠记录 +/− 序列。面板：公式 / 推论 / 「读数：」χ、P₊、实测频率、预测均值、r(t)。 */
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

  const PI = Math.PI, PI2 = PI * 2, DEG = PI / 180;
  const CY = 2.3, R = 1.85;
  const CTR = new THREE.Vector3(0, CY, -0.3);
  const UP = new THREE.Vector3(0, 1, 0);

  // —— 球壳 + 大圆 ——
  group.add(new THREE.Mesh(geo(new THREE.SphereGeometry(R, 24, 16)),
    mat(new THREE.MeshBasicMaterial({ color: 0x1d4ed8, transparent: true, opacity: 0.07, side: THREE.DoubleSide }))));
  function ringGeo(): import('three').BufferGeometry {
    const g = geo(new THREE.BufferGeometry());
    const p = new Float32Array(65 * 3);
    for (let k = 0; k <= 64; k++) { const a = (k / 64) * PI2; p[k * 3] = Math.cos(a); p[k * 3 + 1] = 0; p[k * 3 + 2] = Math.sin(a); }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  }
  const lineMat = (c: number, o: number): import('three').Material => mat(new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o }));
  const eq = new THREE.Line(ringGeo(), lineMat(0x475569, 0.8));
  eq.position.copy(CTR); eq.scale.setScalar(R); group.add(eq);
  const mer1 = new THREE.Line(ringGeo(), lineMat(0x334155, 0.65));
  mer1.position.copy(CTR); mer1.scale.setScalar(R); mer1.rotation.x = PI / 2; group.add(mer1);
  const mer2 = new THREE.Line(ringGeo(), lineMat(0x334155, 0.65));
  mer2.position.copy(CTR); mer2.scale.setScalar(R); mer2.rotation.z = PI / 2; group.add(mer2);
  // 竖直 z 轴（|0⟩/|1⟩ 极点）淡线
  const zAx = geo(new THREE.BufferGeometry());
  zAx.setAttribute('position', new THREE.BufferAttribute(new Float32Array([CTR.x, CY - R - 0.25, CTR.z, CTR.x, CY + R + 0.25, CTR.z]), 3));
  group.add(new THREE.Line(zAx, lineMat(0x64748b, 0.5)));

  // —— 态矢 |ψ⟩（金色：线 + 锥） ——
  const thP = 50 * DEG, phP = 40 * DEG;
  const nPsi = new THREE.Vector3(Math.sin(thP) * Math.cos(phP), Math.cos(thP), Math.sin(thP) * Math.sin(phP));
  const psiGeo = geo(new THREE.BufferGeometry());
  psiGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
  const psiLine = new THREE.Line(psiGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 })));
  group.add(psiLine);
  const psiCone = new THREE.Mesh(geo(new THREE.ConeGeometry(0.1, 0.32, 14)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  group.add(psiCone);

  // —— 测量轴 â（青色过极直线）+ 两极标记球 + 闪光环 ——
  const axGeo = geo(new THREE.BufferGeometry());
  axGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4 * 3), 3));
  const axLine = new THREE.Line(axGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee })));
  group.add(axLine);
  const poleGeo = geo(new THREE.SphereGeometry(0.13, 14, 12));
  const poleMPlus = mat(new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.95 }));
  const poleMMinus = mat(new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.95 }));
  const polePlus = new THREE.Mesh(poleGeo, poleMPlus);
  const poleMinus = new THREE.Mesh(poleGeo, poleMMinus);
  group.add(polePlus, poleMinus);
  const flashGeo = geo(new THREE.TorusGeometry(0.24, 0.045, 8, 32));
  const flashMat = mat(new THREE.MeshBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0 }));
  const flash = new THREE.Mesh(flashGeo, flashMat);
  group.add(flash);

  // —— 投影虚线（ψ 尖端 → â 轴垂足）+ â 上投影分量粗淡线 ——
  const ghostGeo = geo(new THREE.BufferGeometry());
  ghostGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
  const ghostDash = new THREE.Line(ghostGeo, mat(new THREE.LineDashedMaterial({ color: 0xe2e8f0, dashSize: 0.09, gapSize: 0.07, transparent: true, opacity: 0.8 })));
  group.add(ghostDash);
  const projGeo = geo(new THREE.BufferGeometry());
  projGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
  const projLine = new THREE.Line(projGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.45 })));
  group.add(projLine);

  // —— 结果珠池：40 颗 ——
  const beadGeo = geo(new THREE.SphereGeometry(0.085, 10, 8));
  const beads: import('three').Mesh[] = [], beadMats: import('three').MeshBasicMaterial[] = [];
  for (let i = 0; i < 40; i++) {
    const bm = mat(new THREE.MeshBasicMaterial({ color: 0x334155 }));
    const b = new THREE.Mesh(beadGeo, bm);
    b.position.set(-3.7 + i * 0.19, 0.12, 2.6);
    beads.push(b); beadMats.push(bm);
    group.add(b);
  }

  function makeLabel(text: string, color: string, scale: number, x: number, y: number, z: number): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    s.position.set(x, y, z);
    return s;
  }
  group.add(makeLabel('|ψ⟩ 制备态（固定）', '#fbbf24', 2.6, CTR.x - 2.6, CY + 1.25, CTR.z));
  group.add(makeLabel('â 测量轴：16 s 扫 15°→165°', '#22d3ee', 3.1, CTR.x + 2.75, CY - 1.05, CTR.z));
  group.add(makeLabel('结果序列：+ 绿 / − 红（每 2.4 s 一试验）', '#94a3b8', 3.4, 0, 0.62, 2.6));

  // —— 主面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 860; infoCv.height = 250;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.0, 2.61)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 5.7, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  let chiDeg = 0, Pp = 0, phase = 0, sgn = 1, rDeco = 1, Ntr = 0, Nplus = 0, sumP = 0;
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 860, 250);
    infoCtx.fillStyle = 'rgba(7,11,20,0.86)';
    infoCtx.fillRect(4, 4, 852, 242);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 852, 242);
    infoCtx.textAlign = 'left';
    const ln = (y: number, c: string, s: string, bold = false, sz = 26): void => {
      infoCtx.fillStyle = c; infoCtx.font = `${bold ? 'bold ' : ''}${sz}px "PingFang SC", sans-serif`;
      infoCtx.fillText(s, 22, y);
    };
    ln(40, '#f8fafc', '玻恩规则 P₊=|⟨+â|ψ⟩|²=cos²(χ/2)，P₋=sin²(χ/2)', true);
    ln(78, '#22d3ee', '投影公设：测得 ± → 态矢跳至 ±â 极点（本征态钉死）');
    ln(112, '#a855f7', `退相干 r(t)=e^(−t/τ)：纯度 P=(1+r²)/2，r→0 趋于混态`);
    ln(148, '#fbbf24', `读数：χ=${chiDeg.toFixed(1)}°  P₊=${Pp.toFixed(3)}  试验 N=${Ntr}  N₊=${Nplus}`, true, 24);
    ln(180, '#fbbf24', `实测频率 N₊/N=${Ntr ? (Nplus / Ntr).toFixed(3) : '—'}  量子预测均值 ΣP₊/N=${Ntr ? (sumP / Ntr).toFixed(3) : '—'}`, true, 24);
    ln(212, '#94a3b8', `本试验：结果=${sgn > 0 ? '+' : '−'} 相位${phase < 0.7 ? '=投影' : phase < 1.0 ? '=坍缩' : phase < 2.1 ? '=退相干' : '=再制备'}  r=${rDeco.toFixed(2)}`, false, 23);
    infoTex.needsUpdate = true;
  }

  // —— LCG 随机源（可复现） ——
  let seed = 20261013;
  const rnd = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  const aHat = new THREE.Vector3();
  const vNow = new THREE.Vector3(), tmp = new THREE.Vector3();
  const T = 2.4, TAU = 0.9;
  let lastCycle = -1, outcome = 1;

  function update(t: number, dt: number): void {
    // 测量轴 â：极角 Θ 在 x-y 倾斜平面内扫（方位固定 100°），16 s 往返
    const u16 = (t % 16) / 16;
    const TH = (15 + 150 * (0.5 - 0.5 * Math.cos(u16 * PI2))) * DEG;
    const PHA = 100 * DEG;
    aHat.set(Math.sin(TH) * Math.cos(PHA), Math.cos(TH), Math.sin(TH) * Math.sin(PHA));
    const cosChi = Math.max(-1, Math.min(1, nPsi.dot(aHat)));
    chiDeg = Math.acos(cosChi) / DEG;
    Pp = (1 + cosChi) / 2;   // = cos²(χ/2) 半角恒等式

    // 试验时钟
    const cyc = Math.floor(t / T);
    phase = t - cyc * T;
    if (cyc !== lastCycle) {
      lastCycle = cyc;
      outcome = rnd() < Pp ? 1 : -1;
      Ntr += 1; sumP += Pp; if (outcome > 0) Nplus += 1;
      beadMats[(Ntr - 1) % 40].color.setHex(outcome > 0 ? 0x22c55e : 0xef4444);
    }
    sgn = outcome;
    rDeco = phase < 1.0 ? 1 : Math.exp(-(phase - 1.0) / TAU);

    // 态矢方向 v（分四段）
    let len = R;
    if (phase < 0.7) {                       // 制备：|ψ⟩ 静止
      vNow.copy(nPsi);
    } else if (phase < 1.0) {                // 坍缩跳变：n̂ → outcome·â
      const w = (phase - 0.7) / 0.3;
      vNow.copy(nPsi).lerp(tmp.copy(aHat).multiplyScalar(sgn), Math.min(1, w * w * (3 - 2 * w)));
      vNow.normalize();
      len = R * (1 + 0.1 * Math.sin(w * PI));
    } else if (phase < 2.1) {                // 退相干收缩
      vNow.copy(aHat).multiplyScalar(sgn);
      len = R * rDeco;
    } else {                                  // 再制备回 |ψ⟩
      const w = (phase - 2.1) / 0.3;
      vNow.copy(tmp.copy(aHat).multiplyScalar(sgn)).lerp(nPsi, w * w * (3 - 2 * w)).normalize();
      len = R * (rDeco + (1 - rDeco) * w);
    }
    const tip = tmp.copy(vNow).multiplyScalar(len).add(CTR);
    const pa = psiGeo.attributes['position'].array as Float32Array;
    pa[0] = CTR.x; pa[1] = CTR.y; pa[2] = CTR.z;
    pa[3] = tip.x; pa[4] = tip.y; pa[5] = tip.z;
    psiGeo.attributes['position'].needsUpdate = true;
    psiCone.position.copy(tip).addScaledVector(vNow, 0.12);
    psiCone.quaternion.setFromUnitVectors(UP, vNow);

    // 测量轴直线（过两极）
    const aa = axGeo.attributes['position'].array as Float32Array;
    aa[0] = CTR.x - aHat.x * (R + 0.35); aa[1] = CTR.y - aHat.y * (R + 0.35); aa[2] = CTR.z - aHat.z * (R + 0.35);
    aa[3] = CTR.x + aHat.x * (R + 0.35); aa[4] = CTR.y + aHat.y * (R + 0.35); aa[5] = CTR.z + aHat.z * (R + 0.35);
    axGeo.attributes['position'].needsUpdate = true;
    polePlus.position.set(CTR.x + aHat.x * R, CTR.y + aHat.y * R, CTR.z + aHat.z * R);
    poleMinus.position.set(CTR.x - aHat.x * R, CTR.y - aHat.y * R, CTR.z - aHat.z * R);

    // 投影虚线 + 分量：仅在制备段显示（|ψ⟩ 尖端 → â 轴垂足）
    const showGhost = phase < 0.7;
    const comp = nPsi.dot(aHat) * R;
    const ga = ghostGeo.attributes['position'].array as Float32Array;
    const pr = projGeo.attributes['position'].array as Float32Array;
    const foot = { x: CTR.x + aHat.x * comp, y: CTR.y + aHat.y * comp, z: CTR.z + aHat.z * comp };
    const psiTip = { x: CTR.x + nPsi.x * R, y: CTR.y + nPsi.y * R, z: CTR.z + nPsi.z * R };
    ghostDash.visible = projLine.visible = showGhost;
    if (showGhost) {
      ga[0] = psiTip.x; ga[1] = psiTip.y; ga[2] = psiTip.z;
      ga[3] = foot.x; ga[4] = foot.y; ga[5] = foot.z;
      ghostGeo.attributes['position'].needsUpdate = true;
      ghostDash.computeLineDistances();
      pr[0] = CTR.x; pr[1] = CTR.y; pr[2] = CTR.z;
      pr[3] = foot.x; pr[4] = foot.y; pr[5] = foot.z;
      projGeo.attributes['position'].needsUpdate = true;
    }

    // 坍缩闪光环：跳变段在结果极点膨胀淡出
    if (phase >= 0.7 && phase < 1.0) {
      const w = (phase - 0.7) / 0.3;
      flash.visible = true;
      flash.position.copy(polePlus.position);
      if (sgn < 0) flash.position.copy(poleMinus.position);
      flash.scale.setScalar(0.5 + 2.2 * w);
      flashMat.opacity = 0.9 * (1 - w);
      flash.lookAt(CTR);
    } else flash.visible = false;

    // 退相干段：态矢颜色随 r 变暗（信息泄漏）
    (psiLine.material as import('three').LineBasicMaterial).color.setRGB(0.98, 0.75 * (0.4 + 0.6 * rDeco), 0.14 * (0.4 + 0.6 * rDeco));

    if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
  }

  drawInfo();

  return {
    update,
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
