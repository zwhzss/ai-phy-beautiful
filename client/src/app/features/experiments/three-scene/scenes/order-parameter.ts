import type { SceneContext, SceneInstance } from '../types';
/**
 * 序参量与对称自发破缺（P216）：朗道势 V(ψ)=a(T)|ψ|²+c|ψ|⁴，a(T)=α(T−Tc)。
 * 势面按当前 T 逐帧重算（旋转曲面 z=V(r)，r=|ψ|）：T>Tc 为碗（唯一极小 r=0，对称相）；
 * T<Tc 时 a<0，极小移到环 r₀=√(−a/2c)=v·√(1−T/Tc) ⇒ 序参量按平均场指数 β=1/2 升起。
 * 小球从帽顶（r=0，不稳定平衡）被热涨落触发，沿势面滚到简并环上某方位角 θ₀ —— 连续对称性
 * 被"自发"选定。旁侧 5×5 磁矩格：每个随机初始取向的箭头向 m̂(θ₀) 混合（blend 权重=|ψ|/v），
 * 直观"微观混乱→宏观同向"。扫描自变量：T/Tc 由 1.5 降到 0.15（17 s 一轮），θ₀ 每轮换方向。
 * 地面左：V(r) 剖线（与势面同帧同 a(T)，黄点=球实况）；地面右：冷却历史点云 (T/Tc,|ψ|)，
 *   对照虚线 √(1−T/Tc) 理论分支；χ̄∝1/|T−Tc| 软化柱演示临界软模（T→Tc 发散）。
 * 单位：展示用归一化朗道单位（α、c 见代码），β_mean-field=1/2，3D 伊辛实测 β≈0.326（面板注明）。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  const PI = Math.PI, TWO_PI = PI * 2;
  // 星野 + 地面
  const starGeo = geo(new THREE.BufferGeometry());
  { const p = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) { p[i * 3] = (Math.random() - 0.5) * 200; p[i * 3 + 1] = (Math.random() - 0.5) * 200; p[i * 3 + 2] = (Math.random() - 0.5) * 200; }
    starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3)); }
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // —— 朗道参数（展示单位）——
  const ALPHA = 0.018, C4 = 0.0045, ZS = 16;      // a(T)=−ALPHA(1−T/Tc)；V=a r²+C4 r⁴（ZS=纯显示竖尺度：帽边 V(rEdge,1.5)·ZS=2.99 ⇒ 势面留在 ±5 内）
  const Tc = 1.0, CYCLE = 17;
  const rEdge = 2.35;
  const aOf = (T: number) => ALPHA * (T - Tc);
  const vOf = (a: number) => (a < 0 ? Math.sqrt(-a / (2 * C4)) : 0);   // r₀=√(−a/2c) ∝ (1−T/Tc)^{1/2}
  const vMax = vOf(-ALPHA);                                            // T=0 时 r₀
  const Vs = (r: number, a: number) => (a * r * r + C4 * r * r * r * r) * ZS;

  // —— 势面网格（逐帧按 T 重写高度）——
  const NR = 30, NT = 64;
  const rr = new Float32Array(NR);
  for (let i = 0; i < NR; i++) rr[i] = rEdge * i / (NR - 1);
  const hGeo = geo(new THREE.BufferGeometry());
  const hPos = new Float32Array(NR * (NT + 1) * 3);
  const hIdx: number[] = [];
  for (let i = 0; i < NR - 1; i++) for (let j = 0; j < NT; j++) {
    const a = i * (NT + 1) + j, b = a + 1, c = a + NT + 1, d = c + 1;
    hIdx.push(a, c, b, b, c, d);
  }
  hGeo.setAttribute('position', new THREE.BufferAttribute(hPos, 3));
  hGeo.setIndex(hIdx);
  const hat = new THREE.Mesh(hGeo, mat(new THREE.MeshStandardMaterial({ color: 0x7c3aed, emissive: 0x2e1065, emissiveIntensity: 0.35, transparent: true, opacity: 0.5, side: THREE.DoubleSide, roughness: 0.55 })));
  hat.position.set(-1.4, 1.1, 0);
  group.add(hat);
  const writeHat = (T: number): void => {
    const a = aOf(T);
    let k = 0;
    for (let i = 0; i < NR; i++) {
      const r = rr[i], z = Vs(r, a);
      for (let j = 0; j <= NT; j++) {
        const th = TWO_PI * j / NT;
        hPos[k] = r * Math.cos(th); hPos[k + 1] = z; hPos[k + 2] = r * Math.sin(th);
        k += 3;
      }
    }
    hGeo.attributes['position'].needsUpdate = true;
    hGeo.computeVertexNormals();
  };
  writeHat(1.5);

  // 简并真空环（半径 r₀(T) 的水平圆，仅 T<Tc 显示）
  const vacGeo = geo(new THREE.BufferGeometry());
  { const p = new Float32Array((NT + 1) * 3);
    for (let j = 0; j <= NT; j++) { const th = TWO_PI * j / NT; p[j * 3] = Math.cos(th); p[j * 3 + 2] = Math.sin(th); }
    vacGeo.setAttribute('position', new THREE.BufferAttribute(p, 3)); }
  const vacRing = new THREE.Line(vacGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.9 })));
  hat.add(vacRing);

  // 小球：径向动力学 m r̈ = −V′(r) − γ ṙ（θ 冻结在选定方向）
  const ball = new THREE.Mesh(geo(new THREE.SphereGeometry(0.12, 18, 14)), mat(new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x7f1d1d, emissiveIntensity: 0.6 })));
  group.add(ball);
  let rb = 0.02, theta0 = 0.7;
  let nSeed = 20261013;                               // 定种 LCG：刷新可复现，涨落只在方向上随机
  const nRnd = (): number => { nSeed = (nSeed * 1664525 + 1013904223) >>> 0; return nSeed / 4294967296 - 0.5; };

  // —— 磁矩箭头阵：5×5，混乱→同向 ——
  const L = 5, spacing = 0.42;
  const shaftGeo = geo(new THREE.CylinderGeometry(0.022, 0.022, 0.34, 6));
  const headGeo = geo(new THREE.ConeGeometry(0.055, 0.13, 8));
  const arrowMat = mat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0e7490, emissiveIntensity: 0.5 }));
  const spins: { g: import('three').Group; rd: number[]; base: number[] }[] = [];
  { let sd = 777; const r2 = () => (sd = (sd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const plat = new THREE.Mesh(geo(new THREE.BoxGeometry(L * spacing + 0.3, 0.08, L * spacing + 0.3)), mat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 })));
    plat.position.set(2.7, -0.04, 0.2); group.add(plat);
    for (let i = 0; i < L; i++) for (let j = 0; j < L; j++) {
      const g = new THREE.Group();
      const sh = new THREE.Mesh(shaftGeo, arrowMat); sh.position.y = 0.17;
      const hd = new THREE.Mesh(headGeo, arrowMat); hd.position.y = 0.4;
      g.add(sh, hd);
      const ang1 = r2() * TWO_PI, ang2 = Math.acos(2 * r2() - 1);
      g.position.set(2.7 + (i - (L - 1) / 2) * spacing, 0.05, 0.2 + (j - (L - 1) / 2) * spacing);
      group.add(g);
      spins.push({ g, rd: [Math.sin(ang2) * Math.cos(ang1), Math.abs(Math.cos(ang2)), Math.sin(ang2) * Math.sin(ang1)], base: g.position.toArray() });
    } }
  const UPV = new THREE.Vector3(0, 1, 0), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();

  // —— 地面剖线 V(r)（与势面同帧同 a(T)）+ 黄点标当前球位；右后 χ̄∝1/|T−Tc| 软化指示柱 ——
  const NP2 = 97;
  const profGeo = geo(new THREE.BufferGeometry()); const profPos = new Float32Array(NP2 * 3);
  profGeo.setAttribute('position', new THREE.BufferAttribute(profPos, 3));
  group.add(new THREE.Line(profGeo, mat(new THREE.LineBasicMaterial({ color: 0x4ade80 }))));
  const PRX0 = -4.55, PRDX = 2.5, PRY0 = 0.16, PRZ = -3.05, PRYS = 1.5, VREF = Vs(rEdge, aOf(1.5));   // 剖线满量程=帽边高度（与势面同源）
  const mapY = (vv: number) => PRY0 + Math.max(-0.1, Math.min(2.3, vv / VREF * PRYS));
  const pdot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.07, 10, 8)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  pdot.position.set(PRX0, mapY(0), PRZ); group.add(pdot);
  const chiBar = new THREE.Mesh(geo(new THREE.BoxGeometry(0.17, 1, 0.17)), mat(new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0x831843, emissiveIntensity: 0.5 })));
  group.add(chiBar);

  // —— 地面历史轨迹云：冷却过程逐帧记录 (T/Tc, |ψ|)，路径应贴合 √(1−T/Tc) 分支 ——
  const HIST = 260;
  const histGeo = geo(new THREE.BufferGeometry());
  const histPos = new Float32Array(HIST * 3);
  histGeo.setAttribute('position', new THREE.BufferAttribute(histPos, 3));
  histGeo.setDrawRange(0, 0);
  group.add(new THREE.Points(histGeo, mat(new THREE.PointsMaterial({ color: 0xc084fc, size: 0.052 }))));
  const THX0 = 1.05, THDX = 2.6, THZ = -2.55, THZS = 1.85;   // T/Tc→x（0..1.5 映射），|ψ|/v→−z
  let histFill = 0, histTick = 0;
  const thMapX = (tt: number) => THX0 + THDX * tt / 1.5;
  const thMapZ = (f: number) => THZ - THZS * Math.min(1, f);
  // 理论分支参考线（同一映射，供点云对照）
  const brGeo = geo(new THREE.BufferGeometry());
  { const p = new Float32Array(61 * 3);
    for (let i = 0; i < 61; i++) { const tt = 1.5 * i / 60; p[i * 3] = thMapX(tt); p[i * 3 + 1] = 0.1; p[i * 3 + 2] = thMapZ(tt < 1 ? Math.sqrt(1 - tt) : 0); }
    brGeo.setAttribute('position', new THREE.BufferAttribute(p, 3)); }
  const brLine = new THREE.Line(brGeo, mat(new THREE.LineDashedMaterial({ color: 0x64748b, dashSize: 0.12, gapSize: 0.09 })));
  group.add(brLine);
  brLine.computeLineDistances();
  // 温度计柱：高 ∝ T/Tc（与 χ̄ 柱并排）
  const therm = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.06, 0.06, 1, 8)), mat(new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 })));
  group.add(therm);

  // —— 标签 ——
  function makeLabel(text: string, color: string, scale = 3.2): import('three').Sprite {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(scale, scale / 8, 1); s.renderOrder = 998; return s;
  }
  const lb1 = makeLabel('朗道势面 z=V(|ψ|;T)：冷却中帽→碗', '#c4b5fd', 4.0); lb1.position.set(-1.4, 3.6, 0);
  const lb2 = makeLabel('简并真空环：θ₀ 由涨落自选 ⇒ 对称破缺', '#fbbf24', 4.4); lb2.position.set(-1.4, 0.35, 1.9);
  const lb3 = makeLabel('磁矩阵：blend 权重 = |ψ|/v', '#22d3ee', 3.6); lb3.position.set(2.7, 2.3, 0.2);
  const lb4 = makeLabel('地面剖线 V(r)：帽⇄双阱（黄点=球实况）', '#4ade80', 4.2); lb4.position.set(-3.3, 1.95, PRZ);
  const lb5 = makeLabel('紫柱 χ̄∝1/|T−Tc| · 蓝柱 T/Tc', '#f472b6', 3.2); lb5.position.set(4.3, 1.9, -0.2);
  group.add(lb1, lb2, lb3, lb4, lb5);

  // —— 读数面板（5 Hz 重绘）——
  const infoCv = document.createElement('canvas'); infoCv.width = 640; infoCv.height = 288;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const info = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  info.scale.set(7.2, 3.24, 1); info.position.set(0.4, 4.7, 0); info.renderOrder = 999;
  group.add(info);

  const rd = { T: 1.5, a: 0, r0: 0, psi: 0, beta: 0.5, theta0: 0, cyc: 0, inv: 0 };
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 640, 288);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(3, 3, 634, 282);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(3, 3, 634, 282);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    infoCtx.fillText('序参量：对称自发破缺（朗道理论）', 14, 30);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '19px "PingFang SC", sans-serif';
    infoCtx.fillText('V(ψ)=a(T)|ψ|²+c|ψ|⁴, a=α(T−Tc)；a<0 ⇒ 极小 r₀=√(−a/2c)', 14, 56);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('|ψ₀|/v=(1−T/Tc)^β, β=1/2(平均场)；3D伊辛 β≈0.326', 14, 80);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '17px "PingFang SC", sans-serif';
    infoCtx.fillText('帽顶 r=0 在 T<Tc 失稳：任意方位角 θ₀ 等价 ⇒ 简并真空环 S¹', 14, 104);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 20px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：T/Tc=${rd.T.toFixed(3)}  a=${rd.a >= 0 ? '+' : ''}${rd.a.toFixed(4)}  r₀=${rd.r0.toFixed(3)}`, 14, 132);
    infoCtx.fillText(`|ψ|=${rd.psi.toFixed(3)}（球实位）  (1−T/Tc)^½=${rd.beta.toFixed(3)}  θ₀=${(rd.theta0 * 180 / PI).toFixed(0)}°`, 14, 158);
    infoCtx.fillText(`第 ${rd.cyc} 轮 θ₀ 重选；软模指标 χ̂=1/|T−Tc|=${rd.inv.toFixed(1)}（T→Tc 发散）`, 14, 184);
    infoCtx.fillText(`地面点云=(T/Tc,|ψ|) 冷却轨迹，虚线=√(1−T/Tc) 理论分支`, 14, 210);
    // —— 右下水印小图：|ψ|(T/Tc) 理论曲线 + 当前点 ——
    const gx = 14, gy = 282, gw = 300, gh = -56;
    infoCtx.strokeStyle = '#334155'; infoCtx.beginPath(); infoCtx.moveTo(gx, gy); infoCtx.lineTo(gx + gw, gy); infoCtx.stroke();
    infoCtx.strokeStyle = '#22d3ee'; infoCtx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const x = gx + gw * i / 40, tt = 1.5 * i / 40;
      const yy = gy + gh * (tt < 1 ? Math.sqrt(1 - tt) : 0);
      if (i === 0) infoCtx.moveTo(x, yy); else infoCtx.lineTo(x, yy);
    }
    infoCtx.stroke();
    const px = gx + gw * rd.T / 1.5, py = gy + gh * rd.psi / vMax;
    infoCtx.fillStyle = '#ef4444'; infoCtx.beginPath(); infoCtx.arc(px, py, 4, 0, TWO_PI); infoCtx.fill();
    infoCtx.fillStyle = '#64748b'; infoCtx.font = '13px "PingFang SC", sans-serif';
    infoCtx.fillText('|ψ| vs T/Tc', gx + 2, gy - 8);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  return {
    update(t, dt) {
      const u = (t % CYCLE) / CYCLE;
      const T = Tc * (1.5 - 1.35 * u);
      const a = aOf(T), r0 = vOf(a);
      // 每轮换破缺方向并回置小球
      const cyc = Math.floor(t / CYCLE);
      if (cyc !== rd.cyc) { rd.cyc = cyc; theta0 = 0.7 + cyc * 2.39996; rb = 0.02; histFill = 0; histGeo.setDrawRange(0, 0); }
      writeHat(T);
      // 径向弛豫：TDGL 过阻尼 ṙ=−ΓV′(r)+ξ(t)（Γ=150，ξ=定种热涨落）
      // 帽顶 r=0 在 T<Tc 失稳后只能靠涨落种子被放大——纯耗散版里 rb 被 Math.max(0,·) 钉死在 0（V′(0)=0），破缺永不发生
      const dts = Math.min(dt, 0.05);
      const dVdr = 2 * a * rb + 4 * C4 * rb * rb * rb;
      rb = Math.max(0, rb - dVdr * 150 * dts + 0.04 * Math.sqrt(dts) * 2 * nRnd());
      ball.position.set(hat.position.x + rb * Math.cos(theta0), hat.position.y + Vs(rb, a) + 0.12, hat.position.z + rb * Math.sin(theta0));
      vacRing.scale.set(r0 > 1e-3 ? r0 : 0.0001, 1, r0 > 1e-3 ? r0 : 0.0001);
      vacRing.position.y = Vs(r0, a) + 0.015;
      vacRing.visible = a < 0;
      // 磁矩：f=|ψ|/vMax 向 m̂(θ₀)（水平，破缺方位）混合
      const f = Math.min(1, rb / vMax);
      const mhat = tmpA.set(Math.cos(theta0), 0, Math.sin(theta0));
      for (const s of spins) {
        tmpB.set(s.rd[0] * (1 - f) + mhat.x * f, s.rd[1] * (1 - f) + mhat.y * f + 0.001, s.rd[2] * (1 - f) + mhat.z * f).normalize();
        s.g.quaternion.setFromUnitVectors(UPV, tmpB);
      }
      rd.T = T; rd.a = a; rd.r0 = r0; rd.psi = rb; rd.beta = T < Tc ? Math.sqrt(Math.max(0, 1 - T / Tc)) : 0; rd.theta0 = theta0;
      // 地面剖线（同帧同 a(T)）+ 球位黄点 + χ̄ 软化柱：与势面共用同一 T
      for (let i = 0; i < NP2; i++) {
        const rv = rEdge * i / (NP2 - 1);
        profPos[i * 3] = PRX0 + PRDX * i / (NP2 - 1);
        profPos[i * 3 + 1] = mapY(Vs(rv, a));
        profPos[i * 3 + 2] = PRZ;
      }
      profGeo.attributes['position'].needsUpdate = true;
      pdot.position.set(PRX0 + PRDX * Math.min(1, rb / rEdge), mapY(Vs(rb, a)), PRZ);
      rd.inv = 1 / (Math.abs(T - Tc) + 0.012);
      const chiH = 0.16 + 1.5 * Math.min(1, 0.085 * rd.inv);
      chiBar.scale.y = chiH; chiBar.position.set(4.3, chiH / 2 + 0.02, -1.2);
      // 历史点云：每 4 帧记一点（T 单调下降 ⇒ 线性追加，循环复位清空）；温度计柱同步收缩
      histTick = (histTick + 1) % 4;
      if (histTick === 0 && histFill < HIST) {
        histPos[histFill * 3] = thMapX(T / Tc); histPos[histFill * 3 + 1] = 0.13; histPos[histFill * 3 + 2] = thMapZ(rb / vMax);
        histFill++; histGeo.setDrawRange(0, histFill);
        histGeo.attributes['position'].needsUpdate = true;
      }
      const thH = 0.25 + 1.45 * (T / 1.5);
      therm.scale.y = thH; therm.position.set(4.3, thH / 2 + 0.02, 0.8);
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
    },
    dispose() {
      geos.forEach((x) => x.dispose()); mats.forEach((x) => x.dispose()); texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
