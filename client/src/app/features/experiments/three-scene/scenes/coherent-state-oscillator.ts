import type { SceneContext, SceneInstance } from '../types';
/** 谐振子的相干态（P509）：主控方程（ħ=m=ω=1）
 *  ① 期望值严格走经典轨道：q₀(t)=a·cos t、p₀(t)=−a·sin t；E=(p₀²+q₀²)/2=a²/2 恒定，
 *     但势能/动能期望交换：⟨V⟩=q₀²/2、⟨T⟩=p₀²/2（右壁标记沿抛物面 V(q)=q²/2 上下滑）
 *  ② 相干态 Wigner 团 = 半径 Δq=Δp=1/√2 的圆：绕轨道刚体转动、永不展宽 ⇒ Δq·Δp=ħ/2 恒等
 *  ③ 挤压态对比：椭圆主轴 e^{±r}/√2（面积 πσ₁σ₂=πħ/2 不变）随 t 旋转，
 *     投影宽度 Δq(t)=√[½(cosh2r−sinh2r·cos2t)] ≥1/√2 周期性变形（"呼吸"）——两种球/椭球并排同轨道
 *  画面：(q,p) 水平相空间里并排两个轨道：左=相干态绿球（圆误差圈），右=挤压态粉椭球（旋转椭圆误差线）；
 *  后墙画谐振子势能抛物面 V(q)=q²/2 与滑动能点；侧柱显示瞬时 ⟨V⟩、⟨T⟩，顶部虚线 = 恒定的 E。
 *  自变量：轨道振幅 a 在 16 s 内 0.8→3.2 扫描（n̄=E=a²/2 随之变化）。 */
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

  const PI2 = Math.PI * 2, SIG = 1 / Math.SQRT2;
  const SW = 0.62;                        // 相空间单位 → 世界
  const BASEY = -0.35, WELLZ = -3.1;
  const O1 = new THREE.Vector3(-1.9, BASEY, 0.5), O2 = new THREE.Vector3(1.9, BASEY, 0.5);
  const YHAT = new THREE.Vector3(0, 1, 0);
  const R_SQ = 0.7;                       // 挤压幅度 r

  // —— 势能抛物面 curtain：V(q)=q²/2，沿 ẑ 挤出 ——
  const QW = 41;
  const wellGeo = geo(new THREE.BufferGeometry());
  {
    const pos = new Float32Array((QW + 1) * 2 * 3), col = new Float32Array((QW + 1) * 2 * 3);
    const ix: number[] = [];
    for (let i = 0; i < QW; i++) {
      const a0 = i * 2;
      ix.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2);
    }
    for (let i = 0; i <= QW; i++) {
      const q = -3.4 + (6.8 * i) / QW;
      const V = (q * q) / 2;
      const y = BASEY + 0.15 + V * 0.5;
      const f = Math.min(1, V / 5);
      for (const zz of [WELLZ - 0.5, WELLZ + 0.5]) {
        const v = i * 2 + (zz < WELLZ ? 0 : 1);
        pos[v * 3] = q * SW; pos[v * 3 + 1] = y; pos[v * 3 + 2] = zz;
        col[v * 3] = 0.12 + 0.45 * f; col[v * 3 + 1] = 0.3 + 0.5 * (1 - f); col[v * 3 + 2] = 0.7;
      }
    }
    wellGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    wellGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    wellGeo.setIndex(ix);
  }
  group.add(new THREE.Mesh(wellGeo, mat(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, side: THREE.DoubleSide }))));
  const wallDot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.08, 12, 10)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  group.add(wallDot);

  // —— 能量柱（⟨V⟩、⟨T⟩、E 虚线） ——
  const barGeo = geo(new THREE.BoxGeometry(0.14, 1, 0.14));
  const vBar = new THREE.Mesh(barGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.9 })));
  vBar.position.set(-4.35, BASEY, WELLZ + 0.1);
  group.add(vBar);
  const tBar = new THREE.Mesh(barGeo, mat(new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.9 })));
  tBar.position.set(-4.05, BASEY, WELLZ + 0.1);
  group.add(tBar);
  const eH = geo(new THREE.BufferGeometry());
  eH.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
  const eHLine = new THREE.Line(eH, mat(new THREE.LineDashedMaterial({ color: 0x22c55e, dashSize: 0.1, gapSize: 0.08 })));
  group.add(eHLine);

  // —— 相干球 + 误差圆 ——
  const ball = new THREE.Mesh(geo(new THREE.SphereGeometry(SIG * SW, 22, 18)), mat(new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.4 })));
  group.add(ball);
  const circU = geo(new THREE.BufferGeometry());
  {
    const cp = new Float32Array(65 * 3);
    for (let k = 0; k <= 64; k++) { const a = (k / 64) * PI2; cp[k * 3] = Math.cos(a); cp[k * 3 + 1] = 0; cp[k * 3 + 2] = Math.sin(a); }
    circU.setAttribute('position', new THREE.BufferAttribute(cp, 3));
  }
  const errCirc = new THREE.Line(circU, mat(new THREE.LineBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.85 })));
  group.add(errCirc);
  const orb1 = new THREE.Line(circU, mat(new THREE.LineBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.6 })));
  group.add(orb1);

  // —— 挤压椭球 + 旋转椭圆误差线 ——
  const sqz = new THREE.Mesh(geo(new THREE.SphereGeometry(1, 22, 18)), mat(new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.32 })));
  group.add(sqz);
  const NE = 97;
  const ellGeo = geo(new THREE.BufferGeometry());
  ellGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NE * 3), 3));
  const ellLine = new THREE.Line(ellGeo, mat(new THREE.LineBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.9 })));
  group.add(ellLine);
  const orb2 = new THREE.Line(circU, mat(new THREE.LineBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.45 })));
  group.add(orb2);

  // —— 连接两轨道的期望值投影垂线（q₀ 到势壁） ——
  const dropGeo = geo(new THREE.BufferGeometry());
  dropGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
  group.add(new THREE.Line(dropGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.6 }))));

  // —— 相干态误差十字：±Δq、±Δp 定长（不展宽的直接示证） ——
  const crossGeo = geo(new THREE.BufferGeometry());
  crossGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4 * 3), 3));
  const cross = new THREE.LineSegments(crossGeo, mat(new THREE.LineBasicMaterial({ color: 0x86efac })));
  group.add(cross);
  // —— 挤压态主轴十字：e^{−r}/√2 与 e^{+r}/√2 随椭圆旋转（面积守恒可视化） ——
  const prinGeo = geo(new THREE.BufferGeometry());
  prinGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4 * 3), 3));
  const prin = new THREE.LineSegments(prinGeo, mat(new THREE.LineBasicMaterial({ color: 0xf9a8d4 })));
  group.add(prin);

  function makeLabel(text: string, color: string, scale: number, pos: import('three').Vector3): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    s.position.copy(pos);
    return s;
  }
  group.add(makeLabel('相干态：不展宽', '#22c55e', 3.0, new THREE.Vector3(O1.x, 1.55, O1.z)));
  group.add(makeLabel('挤压态：周期变形', '#f472b6', 3.0, new THREE.Vector3(O2.x, 1.55, O2.z)));
  group.add(makeLabel('V(q)=q²/2', '#94a3b8', 2.2, new THREE.Vector3(2.6, BASEY + 2.6, WELLZ)));

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

  let a = 2, Em = 2, q0 = 0, p0 = 0, Vm = 0, Tm = 0, dqS = SIG, dpS = SIG, sqP = SIG * SIG;
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
    ln(40, '#f8fafc', 'a|α⟩=α|α⟩：⟨q⟩、⟨p⟩ 精确复刻经典轨道', true);
    ln(78, '#22d3ee', 'q₀=a cos t, p₀=−a sin t; E=a²/2=⟨V⟩+⟨T⟩ 恒定');
    ln(112, '#a855f7', '挤压态 Δq(t)=√[½(cosh2r−sinh2r cos2t)]，面积不变');
    ln(148, '#fbbf24', `读数：a=${a.toFixed(2)} E=${Em.toFixed(2)} n̄=${Em.toFixed(2)}  ⟨q⟩=${q0.toFixed(2)} ⟨p⟩=${p0.toFixed(2)}`, true, 23);
    ln(180, '#fbbf24', `⟨V⟩=${Vm.toFixed(2)} ⟨T⟩=${Tm.toFixed(2)}（和=E）  相干 ΔqΔp=${(SIG * SIG).toFixed(3)}=ħ/2  挤压 Δq=${dqS.toFixed(3)} Δp=${dpS.toFixed(3)}`, false, 23);
    ln(212, '#94a3b8', `r=${R_SQ.toFixed(2)}：主轴 e^±r/√2，σ₁σ₂=${sqP.toFixed(3)}=ħ/2 恒（面积守恒，投影做 2ω 呼吸）`, false, 22);
    infoTex.needsUpdate = true;
  }

  function update(t: number, dt: number): void {
    const u = (t % 16) / 16;
    a = 0.8 + 2.4 * (0.5 - 0.5 * Math.cos(u * PI2));
    Em = (a * a) / 2;
    q0 = a * Math.cos(t); p0 = -a * Math.sin(t);
    Vm = (q0 * q0) / 2; Tm = (p0 * p0) / 2;
    // 相干球：刚体绕圈
    ball.position.set(O1.x + q0 * SW, BASEY + 0.42, O1.z + p0 * SW);
    errCirc.position.copy(ball.position); errCirc.position.y = BASEY + 0.03;
    errCirc.scale.setScalar(SIG * SW);
    orb1.position.set(O1.x, BASEY + 0.02, O1.z); orb1.scale.setScalar(a * SW);
    // 挤压椭球：同相位轨道，协方差椭圆绕 t 旋转
    sqz.position.set(O2.x + q0 * SW, BASEY + 0.42, O2.z + p0 * SW);
    const s1 = SIG * Math.exp(-R_SQ), s2 = SIG * Math.exp(R_SQ);
    sqz.scale.set(s1 * SW, 0.9, s2 * SW);
    sqz.quaternion.setFromAxisAngle(YHAT, -t);
    orb2.position.set(O2.x, BASEY + 0.02, O2.z); orb2.scale.setScalar(a * SW);
    // 误差椭圆线（与 sqz 同一组 σ）
    const ea = ellGeo.attributes['position'].array as Float32Array;
    const rot = -t;
    for (let k = 0; k < NE - 1; k++) {
      const th = (k / (NE - 1)) * PI2;
      const ex = s1 * Math.cos(th), ez = s2 * Math.sin(th);
      ea[k * 3] = sqz.position.x + (ex * Math.cos(rot) + ez * Math.sin(rot)) * SW;
      ea[k * 3 + 1] = BASEY + 0.03;
      ea[k * 3 + 2] = sqz.position.z + (-ex * Math.sin(rot) + ez * Math.cos(rot)) * SW;
    }
    ea[(NE - 1) * 3] = ea[0]; ea[(NE - 1) * 3 + 1] = BASEY + 0.03; ea[(NE - 1) * 3 + 2] = ea[2];
    ellGeo.attributes['position'].needsUpdate = true;
    // 误差十字：相干态定长、挤压态主轴随椭圆转（σ₁σ₂=ħ/2 恒）
    const byy = BASEY + 0.03;
    const cs = crossGeo.attributes['position'].array as Float32Array;
    cs[0] = ball.position.x - SIG * SW; cs[1] = byy; cs[2] = ball.position.z;
    cs[3] = ball.position.x + SIG * SW; cs[4] = byy; cs[5] = ball.position.z;
    cs[6] = ball.position.x; cs[7] = byy; cs[8] = ball.position.z - SIG * SW;
    cs[9] = ball.position.x; cs[10] = byy; cs[11] = ball.position.z + SIG * SW;
    crossGeo.attributes['position'].needsUpdate = true;
    const pv = prinGeo.attributes['position'].array as Float32Array;
    const a1x = Math.cos(rot), a1z = -Math.sin(rot), a2x = Math.sin(rot), a2z = Math.cos(rot);
    pv[0] = sqz.position.x - s1 * SW * a1x; pv[1] = byy; pv[2] = sqz.position.z - s1 * SW * a1z;
    pv[3] = sqz.position.x + s1 * SW * a1x; pv[4] = byy; pv[5] = sqz.position.z + s1 * SW * a1z;
    pv[6] = sqz.position.x - s2 * SW * a2x; pv[7] = byy; pv[8] = sqz.position.z - s2 * SW * a2z;
    pv[9] = sqz.position.x + s2 * SW * a2x; pv[10] = byy; pv[11] = sqz.position.z + s2 * SW * a2z;
    prinGeo.attributes['position'].needsUpdate = true;
    sqP = s1 * s2;
    dqS = Math.sqrt(0.5 * (Math.cosh(2 * R_SQ) - Math.sinh(2 * R_SQ) * Math.cos(2 * t)));
    dpS = Math.sqrt(0.5 * (Math.cosh(2 * R_SQ) + Math.sinh(2 * R_SQ) * Math.cos(2 * t)));
    // 势壁滑点 + 垂线 + 能量柱
    wallDot.position.set(q0 * SW, BASEY + 0.15 + Vm * 0.5, WELLZ);
    const dr = dropGeo.attributes['position'].array as Float32Array;
    dr[0] = q0 * SW; dr[1] = BASEY + 0.15 + Vm * 0.5; dr[2] = WELLZ;
    dr[3] = ball.position.x; dr[4] = BASEY; dr[5] = ball.position.z;
    dropGeo.attributes['position'].needsUpdate = true;
    vBar.scale.y = Math.max(0.001, Vm * 0.5); vBar.position.y = BASEY + (Vm * 0.5) / 2;
    tBar.scale.y = Math.max(0.001, Tm * 0.5); tBar.position.y = BASEY + (Tm * 0.5) / 2;
    const eh = eH.attributes['position'].array as Float32Array;
    eh[1] = BASEY + Em * 0.5; eh[4] = BASEY + Em * 0.5;
    eH.attributes['position'].needsUpdate = true;
    eHLine.computeLineDistances();
    if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
  }

  a = 2; Em = 2; q0 = 2; p0 = 0;
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
