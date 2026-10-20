import type { SceneContext, SceneInstance } from '../types';
/** 相干态（P226）：主控方程（ħ=1, m=ω=1 归一化单位）
 *  ① Wigner 函数 W(q,p) = (1/π)e^{−(q−q₀)²−(p−p₀)²}：相空间高斯，宽 Δq=Δp=1/√2 ⇒ ΔqΔp = ħ/2 恒为最小，
 *     且随时间只做刚体转动 q₀=√(2n̄)cos Ωt、p₀=√(2n̄)sin Ωt —— 激光脉冲演化不展宽（与波包扩散对比的核心性质）
 *  ② a|α⟩=α|α⟩，|α|²=n̄：光子数服从泊松分布 P(n)=e^{−n̄}n̄ⁿ/n!（方差 ⟨Δn²⟩=n̄ ⇒ 散粒噪声 Δn=√n̄）
 *  ③ 相对噪声 1/√n̄：n̄↑ 噪声绝对值↑但占比↓ —— 激光器"点灯"过程
 *  画面：相空间 (q,p) 平面上的 Wigner 高斯山包绕原点刚体转动（误差十字随之外推但尺寸恒定 = 不展宽）；
 *  右侧泊松直方图柱高由 P(n) 现算；左后计时屏滚动"逐次测量光子数"，样本由泊松分布反演抽样产生。
 *  自变量：腔内平均光子数 n̄ 在 16 s 内 0→9 扫描（激光爬坡）。 */
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

  const PI2 = Math.PI * 2;
  const S = 0.78;                     // 相空间单位 → 世界
  const SIG = 1 / Math.SQRT2;         // Δq = Δp = 1/√2（ħ=1）
  const BASEY = -0.25;
  const ORG = new THREE.Vector3(-0.9, BASEY, 0);

  // —— 相空间坐标轴 ——
  const axGeo = geo(new THREE.BufferGeometry());
  axGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    ORG.x - 4.2 * S, ORG.y, ORG.z, ORG.x + 4.2 * S, ORG.y, ORG.z,
    ORG.x, ORG.y, ORG.z - 4.2 * S, ORG.x, ORG.y, ORG.z + 4.2 * S,
  ]), 3));
  group.add(new THREE.LineSegments(axGeo, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));
  function makeLabel(text: string, color: string, scale: number, pos: import('three').Vector3): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 34px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 128, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 4, 1);
    s.position.copy(pos);
    return s;
  }
  group.add(makeLabel('q', '#94a3b8', 0.7, new THREE.Vector3(ORG.x + 3.6 * S, BASEY + 0.2, 0)));
  group.add(makeLabel('p', '#94a3b8', 0.7, new THREE.Vector3(ORG.x, BASEY + 0.2, 3.6 * S)));

  // —— Wigner 高斯山包（刚性平移 ⇒ 形状恒不变 = 不展宽） ——
  const WG = 44;                        // 网格
  const wGeo = geo(new THREE.BufferGeometry());
  const wPos = new Float32Array((WG + 1) * (WG + 1) * 3), wCol = new Float32Array((WG + 1) * (WG + 1) * 3);
  const wIdx: number[] = [];
  const QSPAN = 2.6 * SIG;              // 山包自身范围（固定！）
  for (let i = 0; i < WG; i++) for (let j = 0; j < WG; j++) {
    const a0 = i * (WG + 1) + j, b0 = a0 + WG + 1;
    wIdx.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1);
  }
  let wv = 0;
  for (let i = 0; i <= WG; i++) for (let j = 0; j <= WG; j++) {
    const qq = -QSPAN + (2 * QSPAN * i) / WG, pp = -QSPAN + (2 * QSPAN * j) / WG;
    const w = Math.exp(-(qq * qq + pp * pp));      // W∝exp(−(Δq²+Δp²)/(2σ²))，σ=1/√2 ⇒ 指数即 −(Δ²)
    wPos[wv * 3] = qq * S; wPos[wv * 3 + 1] = 1.55 * w; wPos[wv * 3 + 2] = pp * S;
    wCol[wv * 3] = 0.1 + 0.35 * w; wCol[wv * 3 + 1] = 0.55 + 0.4 * w; wCol[wv * 3 + 2] = 0.85 + 0.15 * w;
    wv++;
  }
  wGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
  wGeo.setAttribute('color', new THREE.BufferAttribute(wCol, 3));
  wGeo.setIndex(wIdx);
  const wige = new THREE.Group();
  const wMesh = new THREE.Mesh(wGeo, mat(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.88, side: THREE.DoubleSide, depthWrite: false })));
  wige.add(wMesh);
  // 误差十字：±Δq（x̂）、±Δp（ẑ），长度恒定
  const errGeo = geo(new THREE.BufferGeometry());
  errGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -SIG * S, 1.6, 0, SIG * S, 1.6, 0,
    0, 1.6, -SIG * S, 0, 1.6, SIG * S,
  ]), 3));
  wige.add(new THREE.LineSegments(errGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 }))));
  group.add(wige);

  // —— α 轨道圆 + 游标 ——
  const orbGeo = geo(new THREE.BufferGeometry());
  {
    const cp = new Float32Array(97 * 3);
    for (let k = 0; k <= 96; k++) { const a = (k / 96) * PI2; cp[k * 3] = Math.cos(a); cp[k * 3 + 1] = 0; cp[k * 3 + 2] = Math.sin(a); }
    orbGeo.setAttribute('position', new THREE.BufferAttribute(cp, 3));
  }
  const orb = new THREE.Line(orbGeo, mat(new THREE.LineBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.7 })));
  orb.position.copy(ORG); orb.position.y = BASEY + 0.02;
  group.add(orb);
  const cursor = new THREE.Mesh(geo(new THREE.SphereGeometry(0.07, 12, 10)), mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })));
  group.add(cursor);
  const radiusLine = geo(new THREE.BufferGeometry());
  radiusLine.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
  group.add(new THREE.Line(radiusLine, mat(new THREE.LineBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.8 }))));

  // —— 泊松直方图（16 根柱，柱高 = P(n) 现算） ——
  const HB = 16;
  const barGeo = geo(new THREE.BoxGeometry(0.15, 1, 0.15));
  const bars: import('three').Mesh[] = [];
  const barMats: import('three').MeshBasicMaterial[] = [];
  for (let n = 0; n < HB; n++) {
    const m0 = mat(new THREE.MeshBasicMaterial({ color: n === 0 ? 0xfbbf24 : 0x22d3ee, transparent: true, opacity: 0.85 }));
    const b = new THREE.Mesh(barGeo, m0);
    b.position.set(2.35 + n * 0.17, BASEY, -2.9);
    group.add(b); bars.push(b); barMats.push(m0);
  }
  group.add(makeLabel('P(n) 泊松', '#22d3ee', 1.6, new THREE.Vector3(3.6, 2.1, -2.9)));

  // —— 散粒噪声计数屏 ——
  const shCv = document.createElement('canvas');
  shCv.width = 512; shCv.height = 256;
  const shCtx = shCv.getContext('2d')!;
  const shTex = tex(new THREE.CanvasTexture(shCv));
  const shPlane = new THREE.Mesh(geo(new THREE.PlaneGeometry(3.2, 1.6)), mat(new THREE.MeshBasicMaterial({ map: shTex, transparent: true })));
  shPlane.position.set(-3.5, 2.9, -1.6);
  shPlane.rotation.y = 0.5;
  group.add(shPlane);
  const trace: number[] = [];
  let seed = 12345;
  const rnd = (): number => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  function poisSample(mean: number): number {
    // 反演 CDF 抽样：p₀=e^{−n̄}，递推 p_{n}=p_{n−1}·n̄/n
    const u = rnd();
    let p = Math.exp(-mean), c = p, n = 0;
    while (u > c && n < 60) { n++; p *= mean / n; c += p; }
    return n;
  }
  function drawShot(): void {
    shCtx.clearRect(0, 0, 512, 256);
    shCtx.fillStyle = 'rgba(7,11,20,0.88)'; shCtx.fillRect(0, 0, 512, 256);
    shCtx.strokeStyle = '#334155'; shCtx.lineWidth = 2; shCtx.strokeRect(2, 2, 508, 252);
    const ymax = 11;
    shCtx.strokeStyle = '#a855f7'; shCtx.setLineDash([6, 5]); shCtx.beginPath();
    const ym = 228 - (nbar / ymax) * 195; shCtx.moveTo(16, ym); shCtx.lineTo(500, ym); shCtx.stroke(); shCtx.setLineDash([]);
    shCtx.strokeStyle = '#fbbf24'; shCtx.lineWidth = 2; shCtx.beginPath();
    for (let i = 0; i < trace.length; i++) {
      const x = 16 + (i / 63) * 484, y = 228 - (Math.min(ymax, trace[i]) / ymax) * 195;
      if (i === 0) shCtx.moveTo(x, y); else shCtx.lineTo(x, y);
    }
    shCtx.stroke();
    shCtx.fillStyle = '#94a3b8'; shCtx.font = '20px "PingFang SC", sans-serif';
    shCtx.fillText('逐次光子计数（散粒噪声）', 24, 32);
    shCtx.fillStyle = '#a855f7'; shCtx.fillText(`均值 n̄=${nbar.toFixed(2)}`, 330, 32);
    shTex.needsUpdate = true;
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

  let nbar = 0, alphaAbs = 0, ang = 0, lastSample = 0;
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
    ln(40, '#f8fafc', '相干态：W(q,p)=(1/π)e^{-(Δq²+Δp²)}，a|α⟩=α|α⟩', true);
    ln(78, '#22d3ee', 'Δq=Δp=1/√2 ⇒ ΔqΔp = ħ/2 —— 转动中恒不展宽');
    ln(112, '#a855f7', '光子数泊松：P(n)=e^{−n̄}n̄ⁿ/n!，⟨Δn²⟩=n̄');
    ln(148, '#fbbf24', `读数：n̄=${nbar.toFixed(2)}  |α|=√n̄=${alphaAbs.toFixed(3)}  argα=${((ang * 57.2958) % 360).toFixed(0)}°  轨道半径=√(2n̄)=${Math.sqrt(2 * nbar).toFixed(2)}`, true, 23);
    ln(180, '#fbbf24', `散粒噪声 Δn=√n̄=${Math.sqrt(nbar).toFixed(2)}  相对=1/√n̄=${(nbar > 0.02 ? 100 / Math.sqrt(nbar) : NaN).toFixed(1)}%  本次计数=${lastSample}`, false, 23);
    ln(212, '#94a3b8', '误差十字 = ±Δq、±Δp：山包刚体转动、大小不变（ħ=1 单位）', false, 22);
    infoTex.needsUpdate = true;
  }

  function poissonP(n: number, mean: number): number {
    if (mean <= 1e-9) return n === 0 ? 1 : 0;
    let p = Math.exp(-mean);
    for (let k = 1; k <= n; k++) p *= mean / k;
    return p;
  }
  function update(t: number, dt: number): void {
    const u = (t % 16) / 16;
    nbar = 9 * (0.5 - 0.5 * Math.cos(u * PI2));
    alphaAbs = Math.sqrt(nbar);
    ang = t * 1.05;
    const q0 = Math.sqrt(2 * nbar) * Math.cos(ang), p0 = Math.sqrt(2 * nbar) * Math.sin(ang);
    wige.position.set(ORG.x + q0 * S, BASEY, ORG.z + p0 * S);
    cursor.position.set(ORG.x + q0 * S, BASEY + 0.05, ORG.z + p0 * S);
    orb.scale.setScalar(Math.max(0.001, Math.sqrt(2 * nbar) * S));
    const rl = radiusLine.attributes['position'].array as Float32Array;
    rl[0] = ORG.x; rl[1] = BASEY + 0.03; rl[2] = ORG.z;
    rl[3] = ORG.x + q0 * S; rl[4] = BASEY + 0.03; rl[5] = ORG.z + p0 * S;
    radiusLine.attributes['position'].needsUpdate = true;
    for (let n = 0; n < HB; n++) {
      const p = poissonP(n, nbar);
      bars[n].scale.y = Math.max(0.001, p * 14);
      bars[n].position.y = BASEY + (p * 14) / 2;
    }
    if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) {
      lastSample = poisSample(Math.max(0.02, nbar));
      trace.push(lastSample);
      if (trace.length > 64) trace.shift();
      drawShot();
      drawInfo();
    }
  }

  nbar = 4; alphaAbs = 2;
  drawShot(); drawInfo();

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
