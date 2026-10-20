import type { SceneContext, SceneInstance } from '../types';
/** 布儒斯特角与偏振（P521）：主控方程 菲涅尔公式（电介质，μ 近似相等）
 *  r_s = (n₁cosθᵢ−n₂cosθₜ)/(n₁cosθᵢ+n₂cosθₜ)，r_p = (n₂cosθᵢ−n₁cosθₜ)/(n₂cosθᵢ+n₁cosθₜ)，R=|r|²
 *  Snell：n₁sinθᵢ = n₂sinθₜ ⇒ θᵢ+θₜ=90° 时 r_p 分子 = 0 ⇒ R_p=0（布儒斯特角 tanθ_B = n₂/n₁）
 *  画面：入射角 5°→85° 连扫，反射光按 s/p 双分量画（θ_B 处 p 分量的粉色线彻底消失 → 反射纯 s 偏振）；
 *  检偏片绕反射光束连续旋转，马吕斯定律 I = R_s·cos²β + R_p·sin²β 决定透射光斑亮度（θ_B 后转 90° 必全灭）。
 *  右侧菲涅尔曲线面板 R_s(θᵢ)/R_p(θᵢ) 由同一套公式逐点算出，游标与几何同源。 */
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

  const DEG = 180 / Math.PI;
  const N1 = 1.0, N2 = 1.52;                       // 空气 → 冕玻璃
  const TH_B = Math.atan(N2 / N1);                 // 56.66°

  // —— 玻璃板（界面 = y0 平面） ——
  const slabGeo = geo(new THREE.BoxGeometry(8.4, 1.4, 4.4));
  const slab = new THREE.Mesh(slabGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.1 })));
  slab.position.set(0, -0.7, 0);
  group.add(slab);
  const ifaceGeo = geo(new THREE.PlaneGeometry(8.4, 4.4));
  const iface = new THREE.Mesh(ifaceGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.16, side: THREE.DoubleSide })));
  iface.rotation.x = -Math.PI / 2;
  iface.position.y = 0.001;
  group.add(iface);

  // 法线（虚线，需 computeLineDistances）
  const normGeo = geo(new THREE.BufferGeometry());
  normGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, -1.9, 0, 0, 3.2, 0]), 3));
  const normLine = new THREE.Line(normGeo, mat(new THREE.LineDashedMaterial({ color: 0x94a3b8, dashSize: 0.16, gapSize: 0.12, transparent: true, opacity: 0.75 })));
  normLine.computeLineDistances();
  group.add(normLine);

  function ray(color: number, n: number): { g: import('three').BufferGeometry; m: import('three').LineBasicMaterial } {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const m = mat(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }));
    group.add(new THREE.Line(g, m));
    return { g, m };
  }
  function setPts(pl: { g: import('three').BufferGeometry }, pts: import('three').Vector3[]): void {
    const arr = pl.g.attributes['position'].array as Float32Array;
    pts.forEach((p, i) => { arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z; });
    pl.g.attributes['position'].needsUpdate = true;
    pl.g.setDrawRange(0, pts.length);
  }
  const rIn = ray(0xf8fafc, 2);
  const rRs = ray(0x22d3ee, 2);    // 反射 s 分量
  const rRp = ray(0xf472b6, 2);    // 反射 p 分量
  const rT = ray(0xfbbf24, 2);     // 折射
  const aS = ray(0x22c55e, 2);     // 入射光 s 振动箭头（沿 ẑ）
  const aP = ray(0xef4444, 2);     // 入射光 p 振动箭头（入射面内）
  const arc90 = ray(0xa855f7, 25); // 反射↔折射 夹角弧

  // —— 检偏片（绕反射光束旋转的偏振片 + 背后光斑） ——
  const anaGeo = geo(new THREE.CircleGeometry(0.52, 40));
  const anaMat = mat(new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
  const ana = new THREE.Mesh(anaGeo, anaMat);
  group.add(ana);
  const anaAxis = ray(0xf8fafc, 2);
  const anaRing = geo(new THREE.RingGeometry(0.52, 0.58, 40));
  const anaEdge = new THREE.Mesh(anaRing, mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.7, side: THREE.DoubleSide })));
  group.add(anaEdge);

  const spotCv = document.createElement('canvas');
  spotCv.width = 128; spotCv.height = 128;
  {
    const c = spotCv.getContext('2d')!;
    const grad = c.createRadialGradient(64, 64, 2, 64, 64, 60);
    grad.addColorStop(0, 'rgba(251,191,36,0.95)');
    grad.addColorStop(0.5, 'rgba(251,191,36,0.32)');
    grad.addColorStop(1, 'rgba(251,191,36,0)');
    c.fillStyle = grad; c.fillRect(0, 0, 128, 128);
  }
  const spotTex = tex(new THREE.CanvasTexture(spotCv));
  const spot = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: spotTex, transparent: true, depthWrite: false })));
  group.add(spot);

  function makeLabel(text: string, color: string, scale = 3.2, pos?: import('three').Vector3): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    if (pos) s.position.copy(pos);
    return s;
  }
  group.add(makeLabel('玻璃 n₂=1.52', '#22d3ee', 2.6, new THREE.Vector3(-3.2, -0.8, 1.6)));
  group.add(makeLabel('检偏片（转动验起偏方向）', '#94a3b8', 3.4, new THREE.Vector3(1.6, 3.05, 0)));
  group.add(makeLabel('菲涅尔 R_s / R_p', '#f472b6', 3.0, new THREE.Vector3(4.4, 2.35, 0)));

  // —— 菲涅尔曲线小面板（逐点用同一公式计算） ——
  const frCv = document.createElement('canvas');
  frCv.width = 512; frCv.height = 320;
  const frCtx = frCv.getContext('2d')!;
  const frTex = tex(new THREE.CanvasTexture(frCv));
  const frPlane = new THREE.Mesh(geo(new THREE.PlaneGeometry(3.1, 1.94)), mat(new THREE.MeshBasicMaterial({ map: frTex, transparent: true })));
  frPlane.position.set(4.42, 0.95, 0.4);
  group.add(frPlane);
  const FR = (th: number): [number, number] => {
    const st = Math.asin(Math.min(0.999, (N1 * Math.sin(th)) / N2));
    const rs = (N1 * Math.cos(th) - N2 * Math.cos(st)) / (N1 * Math.cos(th) + N2 * Math.cos(st));
    const rp = (N2 * Math.cos(th) - N1 * Math.cos(st)) / (N2 * Math.cos(th) + N1 * Math.cos(st));
    return [rs * rs, rp * rp];
  };
  function drawFresnel(thi: number): void {
    frCtx.clearRect(0, 0, 512, 320);
    frCtx.fillStyle = 'rgba(7,11,20,0.85)'; frCtx.fillRect(0, 0, 512, 320);
    frCtx.strokeStyle = '#334155'; frCtx.lineWidth = 2; frCtx.strokeRect(3, 3, 506, 314);
    const X = (d: number): number => 48 + (d / 85) * 440, Y = (R: number): number => 288 - R * 240;
    frCtx.fillStyle = '#94a3b8'; frCtx.font = '20px "PingFang SC", sans-serif';
    frCtx.fillText('R', 18, 40); frCtx.fillText('θᵢ/°', 240, 312);
    for (const d of [0, 20, 40, 56.66, 80]) {
      frCtx.strokeStyle = d === 56.66 ? '#a855f7' : '#1e293b'; frCtx.lineWidth = d === 56.66 ? 2 : 1;
      frCtx.beginPath(); frCtx.moveTo(X(d), 24); frCtx.lineTo(X(d), 288); frCtx.stroke();
      if (d > 0) frCtx.fillText(d.toFixed(0), X(d) - 10, 302);
    }
    for (let pass = 0; pass < 2; pass++) {
      frCtx.strokeStyle = pass === 0 ? '#22d3ee' : '#f472b6'; frCtx.lineWidth = 3;
      frCtx.beginPath();
      for (let d = 0; d <= 85; d += 1) {
        const R = FR(d / DEG)[pass === 0 ? 0 : 1];
        if (d === 0) frCtx.moveTo(X(d), Y(R)); else frCtx.lineTo(X(d), Y(R));
      }
      frCtx.stroke();
    }
    frCtx.fillStyle = '#22d3ee'; frCtx.fillText('R_s', 110, 60);
    frCtx.fillStyle = '#f472b6'; frCtx.fillText('R_p → 0（θ_B）', 300, 262);
    const mx = X(thi * DEG);
    frCtx.strokeStyle = '#fbbf24'; frCtx.lineWidth = 2;
    frCtx.beginPath(); frCtx.moveTo(mx, 24); frCtx.lineTo(mx, 288); frCtx.stroke();
    const [rs0, rp0] = FR(thi);
    frCtx.fillStyle = '#22d3ee'; frCtx.beginPath(); frCtx.arc(mx, Y(rs0), 5, 0, 7); frCtx.fill();
    frCtx.fillStyle = '#f472b6'; frCtx.beginPath(); frCtx.arc(mx, Y(rp0), 5, 0, 7); frCtx.fill();
    frTex.needsUpdate = true;
  }

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

  let thi = 0, tht = 0, Rs = 0, Rp = 0, beta = 0, IAna = 0, angRT = 90;
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
    ln(40, '#f8fafc', '布儒斯特定律：tan θ_B = n₂/n₁ —— 反射 p 分量为零', true);
    ln(78, '#22d3ee', 'R_s=|r_s|², R_p=|r_p|²（菲涅尔）；θᵢ+θₜ=90° ⇒ r_p=0');
    ln(112, '#a855f7', `θ_B = arctan(1.52/1) = ${(TH_B * DEG).toFixed(2)}°；此时反射光为纯 s 偏振`);
    ln(146, '#22c55e', `马吕斯定律：检偏片透射 I = R_s·cos²β + R_p·sin²β`);
    ln(182, '#fbbf24', `读数：θᵢ=${(thi * DEG).toFixed(1)}° θₜ=${(tht * DEG).toFixed(1)}° 夹角=${angRT.toFixed(1)}° R_s=${Rs.toFixed(4)} R_p=${Rp.toFixed(5)}`, true, 24);
    ln(212, '#fbbf24', `检偏片 β=${(beta * DEG).toFixed(0)}° 透射光斑 I=${IAna.toFixed(4)} 起偏度 ρ=${((Rs - Rp) / Math.max(1e-9, Rs + Rp)).toFixed(3)}`, false, 24);
    infoTex.needsUpdate = true;
  }

  function solve(thiNow: number): void {
    thi = thiNow;
    tht = Math.asin((N1 * Math.sin(thi)) / N2);
    [Rs, Rp] = FR(thi);
    const P = new THREE.Vector3(0, 0, 0);
    const dIn = new THREE.Vector3(Math.sin(thi), -Math.cos(thi), 0);
    const dR = new THREE.Vector3(Math.sin(thi), Math.cos(thi), 0);
    const dT = new THREE.Vector3(Math.sin(tht), -Math.cos(tht), 0);
    setPts(rIn, [P.clone().addScaledVector(dIn, -3.0), P]);
    setPts(rRs, [P, P.clone().addScaledVector(dR, 2.6)]);
    setPts(rRp, [P.clone().add(new THREE.Vector3(0, 0, 0.05)), P.clone().addScaledVector(dR, 2.6).add(new THREE.Vector3(0, 0, 0.05))]);
    setPts(rT, [P, P.clone().addScaledVector(dT, 2.4)]);
    rRs.m.opacity = 0.25 + 0.7 * Math.sqrt(Rs);
    rRp.m.opacity = 0.95 * Math.sqrt(Rp) + 0.02;
    rT.m.opacity = 0.3 + 0.65 * Math.sqrt(Math.max(0, 1 - (Rs + Rp) / 2));
    // 入射光 45° 线偏振 → s（ẑ）与 p（入射面内 ⊥dIn）等幅箭头
    const pHat = new THREE.Vector3(-dIn.y, dIn.x, 0);
    const b0 = P.clone().addScaledVector(dIn, -2.2);
    setPts(aS, [b0.clone().addScaledVector(new THREE.Vector3(0, 0, -0.4), 1), b0.clone().add(new THREE.Vector3(0, 0, 0.4))]);
    setPts(aP, [b0.clone().addScaledVector(pHat, -0.4), b0.clone().addScaledVector(pHat, 0.4)]);
    // 反射⊥折射 夹角弧（θ_B 处恰为 90°）
    angRT = Math.acos(Math.max(-1, Math.min(1, dR.dot(dT)))) * DEG;
    const arcPts: import('three').Vector3[] = [];
    for (let k = 0; k <= 24; k++) {
      const u = k / 24;
      const v = dR.clone().multiplyScalar(1 - u).addScaledVector(dT, u).normalize().multiplyScalar(0.62);
      arcPts.push(v);
    }
    setPts(arc90, arcPts);
    // 检偏片置于反射光束 2.0 处，轴向量 u = cosβ·ẑ + sinβ·p̃_R（p̃_R 在片面内）
    const A = P.clone().addScaledVector(dR, 2.0);
    ana.position.copy(A);
    ana.lookAt(A.clone().addScaledVector(dR, 1));
    anaEdge.position.copy(A).addScaledVector(dR, 0.005);
    anaEdge.quaternion.copy(ana.quaternion);
    const pHatR = new THREE.Vector3(dR.y, -dR.x, 0);
    const axis = new THREE.Vector3(0, 0, Math.cos(beta)).addScaledVector(pHatR, Math.sin(beta));
    setPts(anaAxis, [A.clone().addScaledVector(axis, -0.45), A.clone().addScaledVector(axis, 0.45)]);
    IAna = Rs * Math.cos(beta) ** 2 + Rp * Math.sin(beta) ** 2;
    spot.position.copy(A).addScaledVector(dR, 0.25);
    spot.scale.setScalar(0.25 + 2.2 * Math.sqrt(IAna));
    (spot.material as import('three').SpriteMaterial).opacity = Math.min(1, 0.06 + 3 * IAna);
  }

  function update(t: number, dt: number): void {
    const th = (85 / DEG) * (0.5 - 0.5 * Math.cos((t % 16) / 16 * 2 * Math.PI));
    beta = ((t * 24 / DEG) % 180) / DEG;   // 检偏片匀速自转
    solve(th);
    if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) { drawInfo(); drawFresnel(thi); }
  }

  solve(TH_B);
  drawInfo();
  drawFresnel(TH_B);

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
