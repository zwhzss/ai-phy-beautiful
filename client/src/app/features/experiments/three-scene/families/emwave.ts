import type { SceneContext, SceneInstance } from '../types';
import { scaffold, panelSprite, PAL, ResourceBag } from './_common';

/**
 * 电磁波族（emwave）：P225 激光谐振腔与纵模 / P324 赫兹电磁波实验 ·
 * P38 电磁波的产生与传播（hertz 二次分支：平面波正交 E⊥B 推进示意）/
 * P527 激光原理与振荡阈值 · P43 受激辐射与激光原理（lasing 二次分支） /
 * P489 位移电流与全电流定律 · P210 麦克斯韦方程组（maxwell 二次分支） /
 * P490 坡印廷矢量与电磁能流 / P213 推迟势与电磁因果 / P121 趋肤效应。
 * 由 scene-registry 按 slug+variant 绑定：make(variant, title)。
 */
export function make(variant: string, title: string): (ctx: SceneContext) => SceneInstance {
  return (ctx) => scaffold(ctx, {
    title,
    camera: [0, 4, 14],
    build: (g, bag) => buildVariant(g, bag, ctx, variant, title),
  });
}

function buildVariant(
  g: import('three').Group,
  bag: ResourceBag,
  ctx: SceneContext,
  variant: string,
  title: string,
): (t: number, dt: number) => void {
  const { THREE } = ctx;
  switch (variant) {
    case 'cavity': return build_cavity(g, bag, THREE, title);
    case 'hertz': return build_hertz(g, bag, THREE, title);
    case 'lasing': return build_lasing(g, bag, THREE, title);
    case 'maxwell': return build_maxwell(g, bag, THREE, title);
    case 'poynting': return build_poynting(g, bag, THREE, title);
    case 'retarded': return build_retarded(g, bag, THREE, title);
    case 'skin': return build_skin(g, bag, THREE, title);
    default: return build_cavity(g, bag, THREE, title);
  }
}

/** 画布助手（右侧可重绘曲线） */
function makeCanvas(
  bag: ResourceBag,
  THREE: typeof import('three'),
  w: number,
  h: number,
  world: number,
  x: number,
  y: number,
) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!;
  const tex = bag.tex(new THREE.CanvasTexture(cv));
  const m = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(world, (world * h) / w)),
    bag.mat(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false })),
  );
  m.position.set(x, y, 0);
  m.renderOrder = 997;
  function frame(t2: string, xl: string, yl: string): CanvasRenderingContext2D {
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(7,11,20,0.85)';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#334155'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, w - 3, h - 3);
    c.strokeStyle = '#475569'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(50, 24); c.lineTo(50, h - 42); c.lineTo(w - 16, h - 42); c.stroke();
    c.fillStyle = '#f8fafc'; c.font = 'bold 18px sans-serif'; c.textAlign = 'center';
    c.fillText(t2, w / 2, 26);
    c.fillStyle = '#94a3b8'; c.font = '15px sans-serif';
    c.fillText(xl, w / 2, h - 12);
    c.save(); c.translate(18, (h - 30) / 2); c.rotate(-Math.PI / 2);
    c.fillText(yl, 0, 0); c.restore();
    c.textAlign = 'left';
    return c;
  }
  return { mesh: m, c, frame, tex };
}

/** P225 激光谐振腔与纵模：两镜 + 驻波 + 纵模梳（Δν = c/2L） */
function build_cavity(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 腔长 L（两面镜）
  const L = 10.0;
  const mkMirror = (x: number, r: number) => {
    const m = new THREE.Mesh(
      bag.geo(new THREE.CylinderGeometry(r, r, 0.16, 40)),
      bag.mat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.15 })),
    );
    m.rotation.z = Math.PI / 2;
    m.position.set(x, 0, 0);
    g.add(m);
    return m;
  };
  mkMirror(-L / 2, 1.5);
  const outMirror = mkMirror(L / 2, 1.5);
  // 腔轴（示意）
  g.add(new THREE.Line(
    bag.geo(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-L / 2 - 1.2, 0, 0), new THREE.Vector3(L / 2 + 1.4, 0, 0),
    ])),
    bag.mat(new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.6 })),
  ));
  // 驻波（腔内 |E| 包络 + 瞬时波形）
  const N = 360;
  const standGeo = bag.geo(new THREE.BufferGeometry());
  standGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const standing = new THREE.Line(standGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan })));
  standing.position.y = 1.9;
  g.add(standing);
  const envGeo = bag.geo(new THREE.BufferGeometry());
  envGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const envelope = new THREE.Line(envGeo, bag.mat(new THREE.LineBasicMaterial({
    color: PAL.amber, transparent: true, opacity: 0.85,
  })));
  envelope.position.y = 1.9;
  g.add(envelope);
  // 波节标记：|sin(kx)| 的零点间隔 = λ/2 = L/q（k=qπ/L，与驻波几何同源）
  const q = 20; // 纵模序数
  const nodeGeo = bag.geo(new THREE.SphereGeometry(0.07, 10, 8));
  const nodeMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.pink }));
  const nodes: import('three').Mesh[] = [];
  for (let i = 0; i <= q; i++) {
    const x = -L / 2 + (i / q) * L; // x_i = −L/2 + i·L/q，全部严格落在波节
    const m = new THREE.Mesh(nodeGeo, nodeMat);
    m.position.set(x, 1.9, 0);
    g.add(m);
    nodes.push(m);
  }
  // 输出镜出射光束
  const beamGeo = bag.geo(new THREE.BufferGeometry());
  beamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60 * 3), 3));
  const beam = new THREE.Line(beamGeo, bag.mat(new THREE.LineBasicMaterial({
    color: PAL.red, transparent: true, opacity: 0.9,
  })));
  g.add(beam);

  // 纵模梳画布
  const plot = makeCanvas(bag, THREE, 420, 260, 5.2, 5.6, -3.6);
  g.add(plot.mesh);
  function drawModes(): void {
    const c = plot.frame('纵模梳 I(ν)', '频率 ν', '增益/损耗');
    const W = 420, H = 260;
    // 增益曲线
    c.strokeStyle = '#22c55e'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 140; i++) {
      const u = (i / 140) * 2 - 1;
      const I = Math.exp(-u * u * 2.6);
      const px = 50 + (i / 140) * (W - 70);
      const py = (H - 44) - I * (H - 84);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    // 损耗线
    c.strokeStyle = '#ef4444'; c.setLineDash([6, 6]); c.lineWidth = 2;
    const lossY = (H - 44) - 0.42 * (H - 84);
    c.beginPath(); c.moveTo(50, lossY); c.lineTo(W - 16, lossY); c.stroke();
    c.setLineDash([]);
    // 纵模（等间隔 Δν = c/2L）
    for (let k = -4; k <= 4; k++) {
      const u = k * 0.22;
      const px = 50 + ((u + 1) / 2) * (W - 70);
      const gain = Math.exp(-u * u * 2.6);
      if (gain < 0.42) continue;
      const py = (H - 44) - gain * (H - 84);
      c.strokeStyle = '#f59e0b'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(px, H - 44); c.lineTo(px, py); c.stroke();
      c.fillStyle = '#f59e0b';
      c.beginPath(); c.arc(px, py, 4, 0, 7); c.fill();
    }
    c.fillStyle = '#f8fafc'; c.font = '15px sans-serif';
    c.fillText('橙 = 纵模 ν_q = qc/2L（等间隔 Δν = c/2L）', 56, 46);
    c.fillStyle = '#22c55e';
    c.fillText('绿 = 增益曲线 · 红虚线 = 损耗阈值', 56, 70);
    plot.tex.needsUpdate = true;
  }
  drawModes();

  g.add(panelSprite(THREE, bag, [
    { text: '驻波条件 2L = qλ → 纵模 ν_q = qc/2L，q 为整数', color: '#f8fafc' },
    { text: '相邻纵模间隔 Δν = c/2L（L 越长模越密）', color: '#94a3b8' },
    { text: '读数：只有落在增益 > 损耗 的纵模才能振荡（橙线）', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.4, 'center'));

  return (t: number) => {
    const lam = (2 * L) / q; // q 已上提至波节标记处（波节间隔 λ/2 = L/q）
    const k = (2 * Math.PI) / lam;
    const w = 6.0;
    const arr = (standGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    const earr = (envGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const x = -L / 2 + u * L;
      const env = Math.abs(Math.sin(k * x)); // 驻波包络（节点固定）
      arr[i * 3] = x;
      arr[i * 3 + 1] = env * Math.cos(w * t) * 0.7;
      arr[i * 3 + 2] = 0;
      earr[i * 3] = x;
      earr[i * 3 + 1] = env * 0.75;
      earr[i * 3 + 2] = 0;
    }
    (standGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    (envGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    nodes.forEach((n, i) => n.scale.setScalar(1 + 0.3 * Math.sin(t * 4 + i)));
    // 输出光束（脉冲式出射）
    const barr = (beamGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    const pulse = (t * 1.5) % 3;
    for (let i = 0; i < 60; i++) {
      const u = i / 59;
      barr[i * 3] = L / 2 + u * 3.0;
      barr[i * 3 + 1] = Math.sin(u * 10 - pulse * 8) * 0.25;
      barr[i * 3 + 2] = 0;
    }
    (beamGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    (beam.material as import('three').LineBasicMaterial).opacity = 0.35 + 0.6 * Math.max(0, Math.sin(t * 4));
    outMirror.rotation.x = t * 0.2;
  };
}

/** P324 赫兹电磁波实验：偶极振子 + 辐射波面 + 火花隙接收 */
function build_hertz(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 发射偶极子（两球 + 火花隙）
  const txTop = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.4, 22, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, metalness: 0.6, roughness: 0.3 })),
  );
  txTop.position.set(-5.4, 1.4, 0);
  g.add(txTop);
  const txBot = txTop.clone();
  txBot.position.set(-5.4, -1.4, 0);
  g.add(txBot);
  // 导线
  g.add(new THREE.Line(
    bag.geo(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-5.4, 1.4, 0), new THREE.Vector3(-5.4, 3.2, 0),
      new THREE.Vector3(-3.0, 3.2, 0),
    ])),
    bag.mat(new THREE.LineBasicMaterial({ color: 0x64748b })),
  ));
  g.add(new THREE.Line(
    bag.geo(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-5.4, -1.4, 0), new THREE.Vector3(-5.4, -3.2, 0),
      new THREE.Vector3(-3.0, -3.2, 0),
    ])),
    bag.mat(new THREE.LineBasicMaterial({ color: 0x64748b })),
  ));
  // 火花隙电弧
  const arc = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.95 })),
  );
  arc.position.set(-5.4, 0, 0);
  g.add(arc);

  // 辐射波面（球壳，随时间膨胀）
  const waves: import('three').Mesh[] = [];
  const waveGeo = bag.geo(new THREE.SphereGeometry(1, 32, 20, 0, Math.PI * 2, 0.6, Math.PI - 1.2));
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(
      waveGeo,
      bag.mat(new THREE.MeshBasicMaterial({
        color: PAL.cyan, transparent: true, opacity: 0.4, wireframe: true, side: THREE.DoubleSide,
      })),
    );
    m.position.set(-5.4, 0, 0);
    g.add(m);
    waves.push(m);
  }
  // 接收偶极子（环形天线 + 火花隙）
  const rxRing = new THREE.Mesh(
    bag.geo(new THREE.TorusGeometry(1.2, 0.06, 10, 48)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.35 })),
  );
  rxRing.position.set(5.0, 0, 0);
  rxRing.rotation.y = Math.PI / 2;
  g.add(rxRing);
  const rxBolt = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.red, transparent: true, opacity: 0.9 })),
  );
  rxBolt.position.set(5.0, 1.2, 0);
  g.add(rxBolt);

  const isGen = title.includes('产生'); // em-wave「电磁波的产生与传播」专属分支（fam-spec 规则 4）
  // ── em-wave 分支：平面波正交分量 E∥y、B∥z、k/S∥+x（E×B 恒沿传播方向）
  const PW_M = 140;
  let eWaveGeo: import('three').BufferGeometry | null = null;
  let bWaveGeo: import('three').BufferGeometry | null = null;
  let arrowE: import('three').ArrowHelper | null = null;
  let arrowB: import('three').ArrowHelper | null = null;
  let arrowS: import('three').ArrowHelper | null = null;
  if (isGen) {
    eWaveGeo = bag.geo(new THREE.BufferGeometry());
    eWaveGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((PW_M + 1) * 3), 3));
    g.add(new THREE.Line(eWaveGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.red }))));
    bWaveGeo = bag.geo(new THREE.BufferGeometry());
    bWaveGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((PW_M + 1) * 3), 3));
    g.add(new THREE.Line(bWaveGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.violet }))));
    arrowE = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -2.8, 0), 1.2, PAL.red, 0.2, 0.1);
    arrowB = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -2.8, 0), 1.2, PAL.violet, 0.2, 0.1);
    arrowS = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -2.55, 0), 1.2, PAL.gold, 0.2, 0.1);
    g.add(arrowE); g.add(arrowB); g.add(arrowS);
  }
  // ── 赫兹实验分支：导体反射墙 + 驻波画布（赫兹用反射驻波测波长）
  let standPlot: ReturnType<typeof makeCanvas> | null = null;
  const WALL_X = 9.6;
  if (!isGen) {
    const wall = new THREE.Mesh(
      bag.geo(new THREE.PlaneGeometry(6.4, 6.4)),
      bag.mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide })),
    );
    wall.rotation.y = -Math.PI / 2; // 法线朝 −x，正对入射波
    wall.position.set(WALL_X, 0, 0);
    g.add(wall);
    standPlot = makeCanvas(bag, THREE, 380, 210, 4.9, 0.2, -3.5);
    g.add(standPlot.mesh);
  }

  g.add(panelSprite(THREE, bag, isGen ? [
    { text: '波动方程：∇²E = μ₀ε₀ ∂²E/∂t² → c = 1/√(μ₀ε₀) ≈ 3×10⁸ m/s', color: '#f8fafc' },
    { text: '变化的 E 生 B（法拉第），变化的 B 生 E（位移电流）→ 波自我推进', color: '#94a3b8' },
    { text: '读数：下方平面波 E ⊥ B ⊥ 传播方向且同相，S = E×B/μ₀ 恒沿 +x（示意波速）', color: '#fbbf24' },
  ] : [
    { text: '赫兹实验（1887）：LC 振荡 → 偶极子辐射电磁波，c ≈ 3×10⁸ m/s', color: '#f8fafc' },
    { text: '波面以 c 膨胀（横波 E⊥B），射向导体墙反射 → 入射+反射叠加成驻波', color: '#94a3b8' },
    { text: '读数：波面半径到达接收环距（≈10.4）的瞬时火花最强（共振 f_rx = f_tx）', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.4, 'center'));

  // 驻波参量：波峰间距 = 相邻波面间距 = 波速×发射周期 = 1.96 单位（与上方波面动画同源）
  const SW_LAM = 1.96;
  const SW_K = (2 * Math.PI) / SW_LAM;
  let lastSw = -1; // 驻波画布 5Hz 限流重绘（fam-spec 规范）
  return (t: number, dt: number) => {
    const w = 9.0;
    const osc = Math.sin(w * t);
    // 发射端火花随振荡闪
    (arc.material as import('three').MeshBasicMaterial).opacity = Math.abs(osc) > 0.85 ? 1 : 0.15;
    arc.scale.y = 0.6 + 0.5 * Math.abs(osc);
    // 波面膨胀（增速使波前到达时刻与接收环距离 10.4 对齐，见下方火花）
    waves.forEach((m, i) => {
      const age = ((t * 0.6 + (i / 5) * 3.0) % 3.0) / 3.0;
      const r = 0.6 + age * 9.8;
      m.scale.setScalar(r);
      (m.material as import('three').MeshBasicMaterial).opacity = 0.45 * (1 - 0.78 * age);
    });
    // 接收端感应火花：峰值时刻 arrival=2.9 ↔ 波面半径 0.6+9.8×(2.9/3)≈10.07 ≈ 环距
    const arrival = (t * 0.6) % 3.0;
    const strength = Math.max(0, 1 - Math.abs(arrival - 2.9) * 4);
    (rxBolt.material as import('three').MeshBasicMaterial).opacity = 0.15 + 0.85 * strength * Math.abs(Math.sin(w * t));
    rxBolt.scale.y = 0.5 + strength;
    rxRing.rotation.z += dt * 0.6;
    // 电场方向往复
    txTop.position.y = 1.4 + 0.18 * osc;
    txBot.position.y = -1.4 - 0.18 * osc;
    if (isGen && eWaveGeo && bWaveGeo && arrowE && arrowB && arrowS) {
      // 平面行波（教学示意速度 v=ω/k=2）：E、B 同相，正交于 k
      const kk = 1.1, www = 2.2, A = 0.95;
      const earr = (eWaveGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
      const barr = (bWaveGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
      for (let i = 0; i <= PW_M; i++) {
        const x = -6.5 + (i / PW_M) * 13;
        const v = A * Math.cos(kk * x - www * t);
        earr[i * 3] = x; earr[i * 3 + 1] = -2.8 + v; earr[i * 3 + 2] = 0;
        barr[i * 3] = x; barr[i * 3 + 1] = -2.8; barr[i * 3 + 2] = v;
      }
      (eWaveGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
      (bWaveGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
      const c0 = Math.cos(-www * t); // x=0 处相位
      arrowE.setDirection(new THREE.Vector3(0, c0 >= 0 ? 1 : -1, 0));
      arrowE.setLength(0.3 + 0.9 * Math.abs(c0), 0.2, 0.1);
      arrowB.setDirection(new THREE.Vector3(0, 0, c0 >= 0 ? 1 : -1));
      arrowB.setLength(0.3 + 0.9 * Math.abs(c0), 0.2, 0.1);
      arrowS.setLength(0.4 + 1.0 * c0 * c0, 0.2, 0.1); // S ∝ cos² ≥ 0，恒沿 +x
    }
    if (standPlot && Math.floor(t * 5) !== lastSw) {
      lastSw = Math.floor(t * 5);
      // 驻波 E(x,t) = 2A·sin(k(x_w−x))·sin(ωt)：导体壁 E=0，波节间隔 λ/2（示意）
      const c = standPlot.frame('反射驻波（叠加成波节）', 'x（源→墙）', 'E');
      const W = 380, H = 210;
      const xMin = -5.4, xMax = WALL_X;
      const pxOf = (x: number) => 50 + ((x - xMin) / (xMax - xMin)) * (W - 66);
      const yc = (H - 40 + 52) / 2, AS = (H - 40 - 52) / 2 / 2.1;
      c.strokeStyle = '#475569'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(50, yc); c.lineTo(W - 16, yc); c.stroke();
      // 包络 ±2A|sin(k(x_w−x))|
      c.strokeStyle = '#f59e0b'; c.lineWidth = 2;
      for (const sgn of [1, -1]) {
        c.beginPath();
        for (let i = 0; i <= 100; i++) {
          const x = xMin + (i / 100) * (xMax - xMin);
          const y = yc + sgn * 2 * Math.abs(Math.sin(SW_K * (xMax - x))) * AS;
          if (i === 0) c.moveTo(pxOf(x), y); else c.lineTo(pxOf(x), y);
        }
        c.stroke();
      }
      // 瞬时驻波
      const sT = Math.sin(w * t);
      c.strokeStyle = '#06b6d4'; c.lineWidth = 2.5; c.beginPath();
      for (let i = 0; i <= 120; i++) {
        const x = xMin + (i / 120) * (xMax - xMin);
        const y = yc - 2 * Math.sin(SW_K * (xMax - x)) * sT * AS;
        if (i === 0) c.moveTo(pxOf(x), y); else c.lineTo(pxOf(x), y);
      }
      c.stroke();
      // 波节标记（x = x_w − m·λ/2）
      c.fillStyle = '#f472b6';
      for (let m = 0; m * (SW_LAM / 2) <= xMax - xMin; m++) {
        c.fillRect(pxOf(xMax - m * (SW_LAM / 2)) - 1, yc - 4, 2, 8);
      }
      c.fillStyle = '#94a3b8'; c.font = '13px sans-serif';
      c.fillText('粉刻线=波节(λ/2 间隔) 橙=包络 青=瞬时；赫兹由波节间距测 λ→算 c', 56, 42);
      standPlot.tex.needsUpdate = true;
    }
  };
}

/** P527 激光原理与振荡阈值 / P43 受激辐射与激光原理（二次分支） */
function build_lasing(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const threshold = title.includes('振荡阈值') || title.includes('阈值');
  // 三能级示意（泵浦 → 上能级 → 激光跃迁 → 下能级）
  const levels: { y: number; label: string; col: number }[] = [
    { y: 3.4, label: '泵浦上能级 E₃（寿命短，快速弛豫）', col: PAL.pink },
    { y: 1.6, label: '亚稳态 E₂（自发辐射寿命长，可积累）', col: PAL.cyan },
    { y: -1.6, label: '基态 E₁', col: PAL.slate },
  ];
  const levelBars: import('three').Mesh[] = [];
  levels.forEach((lv) => {
    const m = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(7.4, 0.14, 0.5)),
      bag.mat(new THREE.MeshStandardMaterial({ color: lv.col, emissive: lv.col, emissiveIntensity: 0.35 })),
    );
    m.position.set(-3.2, lv.y, 0);
    g.add(m);
    levelBars.push(m);
  });
  // 粒子（电子）在能级间跃迁
  const eGeo = bag.geo(new THREE.SphereGeometry(0.2, 14, 12));
  const eMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: 0xf59e0b, emissiveIntensity: 0.7 }));
  const electrons: import('three').Mesh[] = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(eGeo, eMat);
    g.add(m);
    electrons.push(m);
  }
  // 泵浦箭头（向上）
  const pump = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.6, -2.6, 0), 6.4, PAL.pink, 0.24, 0.12,
  );
  g.add(pump);
  // 受激辐射（一个光子进来 → 两个同相光子出去）
  const stimIn = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(3.4, 0.9, 0), 1.6, PAL.green, 0.2, 0.1,
  );
  g.add(stimIn);
  const stimOut: import('three').ArrowHelper[] = [];
  for (const dy of [0.6, 1.2]) {
    const a = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(5.4, dy, 0), 2.4, PAL.gold, 0.2, 0.1,
    );
    g.add(a);
    stimOut.push(a);
  }

  // ── 增益/损耗模型：曲线、阈值求根、逐帧判据同源（避免硬编码阈值与本图画线脱钩）
  const GAIN_MAX = 1.15;  // 小信号（未饱和）增益峰值
  const GAIN_K = 1.6;     // 增益随泵浦的响应陡度
  const P_ONSET = 0.3;    // 增益起始泵浦（开始出现粒子数反转）
  const LOSS = 0.35;      // 腔总损耗 α（腔内损耗 + 输出耦合）
  const gainOf = (p: number): number => GAIN_MAX * Math.tanh(Math.max(0, p - P_ONSET) * GAIN_K);
  // 阈值泵浦 P_th 由 g(P)=α 数值求根：g 在 [P_ONSET,1.6] 单调，g(0.30)=0<α、g(1.60)=1.11>α，二分收敛。
  // 解析校核 P_th = P_ONSET + atanh(α/GAIN_MAX)/GAIN_K = 0.4964（α/GAIN_MAX = 0.304 < 1，交点存在）
  const P_TH = (() => {
    let lo = P_ONSET, hi = 1.6;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (gainOf(mid) > LOSS) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  })();
  // 阈值以上受激辐射消耗反转粒子 ⇒ 实际增益被钳制在 g=α；激光输出近似 ∝(P−P_th)（示意斜率 OUT_K）
  const gainClamped = (p: number): number => Math.min(gainOf(p), LOSS);
  const OUT_K = 0.6;
  const outOf = (p: number): number => Math.max(0, (p - P_TH) * OUT_K);

  // 增益/损耗画布（纵轴上限 1.3 > g 峰值 1.15，曲线全幅入框不越标题区）
  const plot = makeCanvas(bag, THREE, 420, 260, 5.2, 5.6, -3.6);
  g.add(plot.mesh);
  const W = 420, H = 260;
  const Y_TOP = 26, Y_BOT = H - 44;
  const Y_MAX = 1.3;
  const yOf = (v: number): number => Y_BOT - (v / Y_MAX) * (Y_BOT - Y_TOP);
  const xOf = (p: number): number => 50 + (p / 1.6) * (W - 70);
  function drawGain(P: number): void {
    const c = plot.frame('增益 g 与 损耗 α：阈值由 g=α 求根', '泵浦功率 P（0–1.6）', 'g、α（0–1.3 覆盖 g 全幅）');
    // 纵轴刻度，说明归一坐标范围
    c.font = '11px sans-serif'; c.textAlign = 'right';
    for (const v of [0, 0.5, 1.0]) {
      const gy = yOf(v);
      c.strokeStyle = '#1e293b'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(50, gy); c.lineTo(W - 16, gy); c.stroke();
      c.fillStyle = '#64748b'; c.fillText(v.toFixed(1), 46, gy + 4);
    }
    c.textAlign = 'left';
    // 损耗线 α
    c.strokeStyle = '#ef4444'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(50, yOf(LOSS)); c.lineTo(W - 16, yOf(LOSS)); c.stroke();
    // 小信号增益 g₀(P)（绿虚线，无受激辐射消耗时的增益）
    c.strokeStyle = '#22c55e'; c.lineWidth = 2; c.setLineDash([6, 5]); c.beginPath();
    for (let i = 0; i <= 140; i++) {
      const p = (i / 140) * 1.6;
      const px = xOf(p), py = yOf(gainOf(p));
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke(); c.setLineDash([]);
    // 实际增益：P<P_th 沿 g₀（绿实线）；P>P_th 钳在 α（绿虚段压在红损耗线上）
    c.strokeStyle = '#22c55e'; c.lineWidth = 4; c.beginPath();
    for (let i = 0; i <= 60; i++) {
      const p = (i / 60) * P_TH;
      const px = xOf(p), py = yOf(gainOf(p));
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    c.setLineDash([7, 5]); c.beginPath();
    c.moveTo(xOf(P_TH), yOf(LOSS)); c.lineTo(W - 16, yOf(LOSS)); c.stroke(); c.setLineDash([]);
    // 激光输出：阈值下为零，阈值上线性上升
    c.strokeStyle = '#f59e0b'; c.lineWidth = 3; c.beginPath();
    c.moveTo(xOf(P_TH), yOf(0)); c.lineTo(xOf(1.6), yOf(outOf(1.6))); c.stroke();
    // g=α 交点与其竖线（把阈值读数与曲线绑定）
    const tx = xOf(P_TH);
    c.strokeStyle = '#e2e8f0'; c.lineWidth = 2; c.setLineDash([3, 4]);
    c.beginPath(); c.moveTo(tx, yOf(LOSS)); c.lineTo(tx, Y_BOT); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#f8fafc'; c.beginPath(); c.arc(tx, yOf(LOSS), 4, 0, Math.PI * 2); c.fill();
    // 当前泵浦竖线 + 实际增益/输出读数点
    const cx = xOf(P);
    c.strokeStyle = '#38bdf8'; c.lineWidth = 2; c.setLineDash([5, 5]);
    c.beginPath(); c.moveTo(cx, Y_TOP); c.lineTo(cx, Y_BOT); c.stroke(); c.setLineDash([]);
    const g0Now = gainOf(P);
    c.fillStyle = '#4ade80'; c.beginPath(); c.arc(cx, yOf(gainClamped(P)), 4.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f59e0b'; c.beginPath(); c.arc(cx, yOf(outOf(P)), 3.5, 0, Math.PI * 2); c.fill();
    // 读数（判据用 g₀(P) 与 α 比较，阈值取求根值 P_TH）
    c.fillStyle = '#f8fafc'; c.font = '15px sans-serif';
    c.fillText(`P = ${P.toFixed(2)}　g₀(P) = ${g0Now.toFixed(3)}　α = ${LOSS.toFixed(2)}`, 56, 46);
    c.fillStyle = g0Now > LOSS ? '#22c55e' : '#ef4444';
    c.fillText(g0Now > LOSS ? 'g₀>α：已激射，增益钳于 α' : 'g₀<α：未达阈值，仅荧光', 56, 68);
    c.fillStyle = '#cbd5e1'; c.font = '12px sans-serif';
    c.fillText(`P_th = ${P_TH.toFixed(4)}（由 g₀=α 求根）`, 56, 88);
    // 线内标注
    c.fillStyle = '#ef4444'; c.fillText('损耗 α = 0.35', 56, yOf(LOSS) - 6);
    c.fillStyle = '#86efac'; c.fillText('小信号 g₀', 300, 92);
    c.textAlign = 'right';
    c.fillStyle = '#22c55e'; c.fillText('实际增益被钳于 g = α', W - 20, yOf(LOSS) + 30);
    c.fillStyle = '#f59e0b'; c.fillText('激光输出（示意 ∝ P−P_th）', W - 20, yOf(outOf(1.6)) - 8);
    c.textAlign = 'left';
    plot.tex.needsUpdate = true;
  }
  drawGain(0.9);

  g.add(panelSprite(THREE, bag, threshold ? [
    { text: '激光振荡条件：g(ν) ≥ α_总（腔损耗 + 输出耦合）→ 阈值泵浦', color: '#f8fafc' },
    { text: '阈值以上增益被钳制在 g = α（受激辐射消耗反转粒子）', color: '#94a3b8' },
    { text: '读数：P < P_th 只有荧光；P > P_th 才有相干激光输出', color: '#fbbf24' },
  ] : [
    { text: '受激辐射：入射光子诱导高能级电子跃迁，产生同频同相光子', color: '#f8fafc' },
    { text: '爱因斯坦关系 B₁₂ = B₂₁，受激吸收与受激辐射概率相等', color: '#94a3b8' },
    { text: '粒子数反转 n₂ > n₁ 才有净放大：ΔN > 0（泵浦维持）', color: '#22c55e' },
  ], [0, 4.6, 0], 8.4, 'center'));

  let lastP = -1;
  return (t: number, dt: number) => {
    // 泵浦功率周期变化
    const P = 0.15 + 1.2 * (Math.sin(t * 0.45) * 0.5 + 0.5);
    // 激射判据与画布同源：小信号增益超过损耗才振荡（阈值 P_th 由 g=α 求根，非硬编码 0.3）
    const aboveTh = gainOf(P) > LOSS;
    // 电子在能级间循环：E1 --泵浦--> E3 --弛豫--> E2 --受激辐射--> E1
    electrons.forEach((e, i) => {
      const ph = ((t * 0.5 + i / electrons.length) % 1);
      let y: number;
      const lx = -3.2 + ((i % 6) - 2.5) * 1.1;
      if (ph < 0.3) {          // 泵浦到 E3
        y = -1.6 + (ph / 0.3) * 5.0;
      } else if (ph < 0.5) {   // 弛豫到 E2
        y = 3.4 - ((ph - 0.3) / 0.2) * 1.8;
      } else if (ph < 0.85) {  // 停留在 E2（亚稳态积累）
        y = 1.6;
      } else {                 // 受激辐射跃迁到 E1
        y = 1.6 - ((ph - 0.85) / 0.15) * 3.2;
      }
      e.position.set(lx, y, 0.4);
      const onE2 = ph >= 0.5 && ph < 0.85;
      e.scale.setScalar(aboveTh && onE2 ? 1.25 : 1);
    });
    // 泵浦箭头强度
    pump.setLength(5.6 + 1.2 * P, 0.24, 0.12);
    // 受激辐射箭头（g>α 才有的净放大，阈值以上更明显）
    const active = aboveTh;
    stimIn.setLength(active ? 1.8 : 1.2, 0.2, 0.1);
    stimOut.forEach((a, i) => {
      a.setLength(active ? 2.6 : 1.4, 0.2, 0.1);
      (a as unknown as { visible: boolean }).visible = active || i === 0;
    });
    const bucket = Math.round(P * 24);
    if (bucket !== lastP) { lastP = bucket; drawGain(P); }
    void dt;
    void threshold;
  };
}

/** P489 位移电流与全电流定律 / P210 麦克斯韦方程组（二次分支） */
function build_maxwell(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const displacement = title.includes('位移电流') || title.includes('全电流');
  const isMaxwell = title.includes('麦克斯韦') || title.includes('方程组');
  // 平行板电容器（充电中）
  const plateGeo = bag.geo(new THREE.CylinderGeometry(2.4, 2.4, 0.16, 48));
  const plateMat = bag.mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.3 }));
  const plateA = new THREE.Mesh(plateGeo, plateMat);
  plateA.position.set(0, 1.4, 0);
  g.add(plateA);
  const plateB = new THREE.Mesh(plateGeo, plateMat);
  plateB.position.set(0, -1.4, 0);
  g.add(plateB);
  // 导线 + 电流箭头
  const wirePts: import('three').Vector3[] = [
    new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(3.6, 1.4, 0),
    new THREE.Vector3(3.6, -1.4, 0), new THREE.Vector3(0, -1.4, 0),
  ];
  g.add(new THREE.Line(
    bag.geo(new THREE.BufferGeometry().setFromPoints(wirePts)),
    bag.mat(new THREE.LineBasicMaterial({ color: 0x64748b })),
  ));
  const conduction = new THREE.ArrowHelper(
    new THREE.Vector3(0, -1, 0), new THREE.Vector3(3.6, 1.0, 0.1), 2.0, PAL.amber, 0.22, 0.11,
  );
  g.add(conduction);
  // 位移电流（板间，dE/dt 方向）
  const displace = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1.0, 0), 2.0, PAL.cyan, 0.22, 0.11,
  );
  g.add(displace);
  // 板间电场线（随时间变化）
  const eLines: import('three').Line[] = [];
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * Math.PI * 2;
    const r = 1.9 * Math.sqrt((i + 0.5) / 7);
    const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
    const l = new THREE.Line(
      bag.geo(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, -1.3, z), new THREE.Vector3(x, 1.3, z),
      ])),
      bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.75 })),
    );
    g.add(l);
    eLines.push(l);
  }
  // 位移电流密度环（板间涡旋磁场）
  const bRings: import('three').Line[] = [];
  for (const y of [-0.7, 0, 0.7]) {
    const pts: import('three').Vector3[] = [];
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * 2.9, y, Math.sin(a) * 2.9));
    }
    const l = new THREE.Line(
      bag.geo(new THREE.BufferGeometry().setFromPoints(pts)),
      bag.mat(new THREE.LineBasicMaterial({ color: PAL.violet, transparent: true, opacity: 0.7 })),
    );
    g.add(l);
    bRings.push(l);
  }

  // 麦克斯韦方程组面板（仅"麦克斯韦方程组"知识点）
  if (isMaxwell) {
    const eqCv = document.createElement('canvas');
    eqCv.width = 560; eqCv.height = 340;
    const ec = eqCv.getContext('2d')!;
    ec.fillStyle = 'rgba(7,11,20,0.85)'; ec.fillRect(0, 0, 560, 340);
    ec.strokeStyle = '#334155'; ec.lineWidth = 3; ec.strokeRect(2, 2, 556, 336);
    ec.fillStyle = '#f8fafc'; ec.font = 'bold 26px sans-serif';
    ec.fillText('麦克斯韦方程组', 24, 44);
    ec.font = '23px sans-serif';
    ec.fillStyle = '#f59e0b';
    ec.fillText('① ∇·E = ρ/ε₀        （高斯定律）', 24, 96);
    ec.fillStyle = '#06b6d4';
    ec.fillText('② ∇·B = 0           （无磁单极）', 24, 148);
    ec.fillStyle = '#f472b6';
    ec.fillText('③ ∇×E = −∂B/∂t     （法拉第定律）', 24, 200);
    ec.fillStyle = '#22c55e';
    ec.fillText('④ ∇×B = μ₀J + μ₀ε₀∂E/∂t', 24, 252);
    ec.fillStyle = '#94a3b8'; ec.font = '20px sans-serif';
    ec.fillText('最后一项 μ₀ε₀∂E/∂t 即位移电流', 24, 300);
    const eqTex = bag.tex(new THREE.CanvasTexture(eqCv));
    const eqPlane = new THREE.Mesh(
      bag.geo(new THREE.PlaneGeometry(5.4, 3.28)),
      bag.mat(new THREE.MeshBasicMaterial({ map: eqTex, transparent: true, depthTest: false })),
    );
    eqPlane.position.set(5.6, 2.4, 0);
    eqPlane.renderOrder = 997;
    g.add(eqPlane);
  }

  g.add(panelSprite(THREE, bag, displacement ? [
    { text: '全电流定律：∇×B = μ₀(J_传导 + J_位移)，J_位移 = ε₀∂E/∂t', color: '#f8fafc' },
    { text: '板间无传导电流，但 E 随时间变化 → 位移电流补上缺口', color: '#94a3b8' },
    { text: '读数：连续性 ∇·J = −∂ρ/∂t 得以满足（安培–麦克斯韦）', color: '#fbbf24' },
  ] : [
    { text: '麦克斯韦方程组：① ∇·E = ρ/ε₀  ② ∇·B = 0', color: '#f8fafc' },
    { text: '③ ∇×E = −∂B/∂t  ④ ∇×B = μ₀J + μ₀ε₀∂E/∂t', color: '#94a3b8' },
    { text: '由 ③④ 消去源可得波动方程 → 电磁波 c = 1/√(μ₀ε₀)', color: '#22c55e' },
  ], [0, 4.6, 0], 8.6, 'center'));

  return (t: number, dt: number) => {
    // 电容充电振荡（LC 振荡）→ E(t) 正弦
    const E = Math.sin(t * 2.4);
    // 电场线透明度 ∝ E
    eLines.forEach((l, i) => {
      const m = l.material as import('three').LineBasicMaterial;
      m.opacity = 0.3 + 0.55 * Math.abs(E) * (0.7 + 0.3 * Math.sin(t * 3 + i));
    });
    // 位移电流方向随 dE/dt 反向
    const dEdt = Math.cos(t * 2.4);
    displace.setDirection(new THREE.Vector3(0, dEdt >= 0 ? 1 : -1, 0));
    displace.setLength(1.4 + 1.2 * Math.abs(dEdt), 0.22, 0.11);
    // 传导电流方向与位移电流连续
    conduction.setDirection(new THREE.Vector3(0, dEdt >= 0 ? -1 : 1, 0));
    conduction.setLength(1.6 + 0.9 * Math.abs(dEdt), 0.22, 0.11);
    // 环形磁场（B 绕电流）
    bRings.forEach((l, i) => {
      l.rotation.y = t * (0.7 + i * 0.2);
      const m = l.material as import('three').LineBasicMaterial;
      m.opacity = 0.3 + 0.5 * Math.abs(dEdt);
    });
    // 板上电荷（正/负）
    plateA.rotation.y += dt * 0.3;
    plateB.rotation.y -= dt * 0.3;
  };
}

/** P490 坡印廷矢量与电磁能流 */
function build_poynting(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 传播方向（+z）
  const axis = new THREE.Line(
    bag.geo(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, -6), new THREE.Vector3(0, 0, 6),
    ])),
    bag.mat(new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.6 })),
  );
  g.add(axis);
  // E 场（x 方向）与 B 场（y 方向）正弦曲线
  const N = 300;
  const eGeo = bag.geo(new THREE.BufferGeometry());
  eGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const eLine = new THREE.Line(eGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.red })));
  g.add(eLine);
  const bGeo = bag.geo(new THREE.BufferGeometry());
  bGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const bLine = new THREE.Line(bGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.blue })));
  g.add(bLine);
  // S = E×H 箭头（沿 +z，多个采样点）
  const sArrows: import('three').ArrowHelper[] = [];
  for (let i = 0; i < 7; i++) {
    const z = -5 + i * 1.7;
    const a = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, z), 1.2, PAL.gold, 0.18, 0.09,
    );
    g.add(a);
    sArrows.push(a);
  }
  // 波包包络
  const envGeo = bag.geo(new THREE.BufferGeometry());
  envGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const env = new THREE.Line(envGeo, bag.mat(new THREE.LineBasicMaterial({
    color: PAL.green, transparent: true, opacity: 0.75,
  })));
  g.add(env);

  // 三维与画布共用同一组波数/角频率：画布行波相速 = ω/k，与三维严格同步
  const k = 2.0, w = 4.0;
  // 能流密度曲线
  const plot = makeCanvas(bag, THREE, 420, 240, 5.2, 5.4, -4.0);
  g.add(plot.mesh);
  function drawS(z0: number, phase: number): void {
    const c = plot.frame('S(z) = E×H（能流密度）', '位置 z', '|S|');
    const W = 420, H = 240;
    c.strokeStyle = '#fbbf24'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 320; i++) {
      const z = -6 + (i / 320) * 12;
      const amp = Math.exp(-((z - z0) ** 2) / 9);
      const S = amp * Math.abs(Math.sin(k * z - w * phase)) ** 2;
      const px = 50 + (i / 320) * (W - 70);
      const py = (H - 42) - S * (H - 74);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    c.strokeStyle = '#94a3b8'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(50, H - 42); c.lineTo(W - 16, H - 42); c.stroke();
    c.fillStyle = '#f8fafc'; c.font = '15px sans-serif';
    c.fillText('能流方向 = E×B（右手螺旋），恒为传播方向', 56, 44);
    c.fillStyle = '#94a3b8';
    c.fillText('⟨S⟩ = ½E₀H₀ = I/(面积)（时间平均）', 56, 68);
    plot.tex.needsUpdate = true;
  }
  drawS(0, 0);

  g.add(panelSprite(THREE, bag, [
    { text: '坡印廷矢量 S = E×H（W/m²），方向即能量传播方向', color: '#f8fafc' },
    { text: '平均能流 ⟨S⟩ = ½Re(E×H*)，平面波 = I = ½ε₀cE₀²', color: '#94a3b8' },
    { text: '坡印廷定理（场能守恒）：∂u/∂t + ∇·S = −J·E（本图为源区，J=0）', color: '#93c5fd' },
    { text: '读数：E、B、S 三者两两垂直；S ∝ E₀²（光强 ∝ 振幅平方）', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.6, 'center'));

  let lastFrame = -1;
  return (t: number, dt: number) => {
    const earr = (eGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    const barr = (bGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    const envArr = (envGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    for (let i = 0; i <= N; i++) {
      const z = -6 + (i / N) * 12;
      const amp = Math.exp(-((z - 0) ** 2) / 9);
      const ph = k * z - w * t;
      earr[i * 3] = amp * Math.cos(ph) * 2.2;   // E 沿 x
      earr[i * 3 + 1] = 0;
      earr[i * 3 + 2] = z;
      barr[i * 3] = 0;
      barr[i * 3 + 1] = amp * Math.cos(ph) * 2.2; // B 沿 y（与 E 同相）
      barr[i * 3 + 2] = z;
      envArr[i * 3] = amp * 2.2;
      envArr[i * 3 + 1] = 0;
      envArr[i * 3 + 2] = z;
    }
    (eGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    (bGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    (envGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    // S 箭头长度 ∝ |E×B|
    sArrows.forEach((a, i) => {
      const z = -5 + i * 1.7;
      const amp = Math.exp(-(z * z) / 9);
      const S = amp * Math.abs(Math.cos(k * z - w * t)) ** 2;
      a.setLength(0.4 + S * 2.4, 0.18, 0.09);
    });
    const fr = Math.floor(t * 8);
    if (fr !== lastFrame) { lastFrame = fr; drawS(0, t); }
    void dt;
  };
}

/** P213 推迟势与电磁因果：源运动 → 场以 c 传播（推迟时间 t−r/c） */
function build_retarded(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 源电荷（振荡）
  const src = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.4, 22, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.6 })),
  );
  g.add(src);
  // 推迟波面（每个波面按发出时刻的位置定心）
  const shells: { mesh: import('three').Mesh; birth: number; bx: number; by: number }[] = [];
  const shellGeo = bag.geo(new THREE.SphereGeometry(1, 28, 18));
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(
      shellGeo,
      bag.mat(new THREE.MeshBasicMaterial({
        color: PAL.cyan, transparent: true, opacity: 0.4, wireframe: true, side: THREE.DoubleSide,
      })),
    );
    g.add(m);
    shells.push({ mesh: m, birth: -i * 0.8, bx: 0, by: 0 });
  }
  // 观察者（远处探测点）
  const obs = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.3, 18, 14)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.green, emissive: 0x15803d, emissiveIntensity: 0.6 })),
  );
  obs.position.set(6.6, 0, 0);
  g.add(obs);
  // 推迟时间标注线（r 线段）
  const rLine = new THREE.Line(
    bag.geo(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])),
    bag.mat(new THREE.LineDashedMaterial({ color: PAL.gold, gapSize: 0.25, dashSize: 0.3 })),
  );
  g.add(rLine);
  // 观察者接收到的历史信号（右侧画布）
  const plot = makeCanvas(bag, THREE, 400, 240, 5.0, -5.4, -4.0);
  g.add(plot.mesh);
  function drawRecv(travel: number): void {
    const c = plot.frame('观察点收到的 φ_ret(t)', '时间 t', 'φ');
    const W = 400, H = 240;
    c.strokeStyle = '#06b6d4'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 300; i++) {
      const x = (i / 300) * 10;
      const y = Math.sin((x - travel) * 4.2) * Math.exp(-Math.abs(x - travel) * 0.06) * 74;
      const px = 50 + (i / 300) * (W - 70);
      const py = H / 2 - y;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    c.strokeStyle = '#475569'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(50, H / 2); c.lineTo(W - 16, H / 2); c.stroke();
    c.fillStyle = '#f8fafc'; c.font = '15px sans-serif';
    c.fillText(`φ_ret(r,t) = q(t − r/c)/4πε₀r`, 56, 44);
    c.fillStyle = '#94a3b8';
    c.fillText(`r/c ≈ ${(travel).toFixed(2)}（信号尚未/刚刚抵达）`, 56, 68);
    plot.tex.needsUpdate = true;
  }
  drawRecv(0);

  g.add(panelSprite(THREE, bag, [
    { text: '推迟势：φ(r,t) = q(t−r/c)/(4πε₀r)，场不是瞬时建立', color: '#f8fafc' },
    { text: '因果性：观察者只"看到" r/c 之前的源状态（光锥内）', color: '#94a3b8' },
    { text: '读数：波面中心 = 源在发出时刻的位置（不随源移动）', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.4, 'center'));

  const c0 = 3.2; // 归一化光速
  let clock = 0;
  let spawnAcc = 0;
  let lastFrame = -1;
  return (t: number, dt: number) => {
    clock += dt;
    const sx = 1.4 * Math.sin(clock * 1.3);
    const sy = 1.1 * Math.cos(clock * 0.9);
    src.position.set(sx, sy, 0);
    // 每隔固定间隔发射一个波面（记录出生时的源位置）
    spawnAcc += dt;
    if (spawnAcc > 0.8) {
      spawnAcc = 0;
      shells.push(shells.shift()!);
      const s = shells[shells.length - 1];
      s.birth = clock;
      s.bx = sx; s.by = sy;
    }
    // 波面膨胀（中心固定在出生位置）
    shells.forEach((s) => {
      const age = clock - s.birth;
      const r = Math.max(0.05, age * c0);
      s.mesh.position.set(s.bx, s.by, 0);
      s.mesh.scale.setScalar(r);
      (s.mesh.material as import('three').MeshBasicMaterial).opacity = 0.45 * Math.max(0, 1 - age / 5);
    });
    // r 线（源 → 观察者）
    const rarr = (rLine.geometry.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    rarr[0] = sx; rarr[1] = sy; rarr[2] = 0;
    rarr[3] = obs.position.x; rarr[4] = obs.position.y; rarr[5] = obs.position.z;
    (rLine.geometry.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    rLine.computeLineDistances();
    // 推迟时间 r/c
    const rr = Math.hypot(obs.position.x - sx, obs.position.y - sy);
    const travel = rr / c0;
    const fr = Math.floor(t * 8);
    if (fr !== lastFrame) { lastFrame = fr; drawRecv(travel); }
    // 观察者闪烁（收到信号时）
    (obs.material as import('three').MeshStandardMaterial).emissiveIntensity = 0.3 + 0.6 * Math.abs(Math.sin(t * 3 - travel));
    obs.scale.setScalar(1 + 0.2 * Math.sin(t * 3 - travel * 2));
  };
}

/** P121 趋肤效应：导体截面电流密度指数衰减 δ = √(2/ωμσ) */
function build_skin(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 导体（半无限大块，x 方向深入）
  const block = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(7.0, 3.4, 3.4)),
    bag.mat(new THREE.MeshStandardMaterial({
      color: 0x94a3b8, metalness: 0.6, roughness: 0.4, transparent: true, opacity: 0.3,
    })),
  );
  block.position.set(1.4, -1.4, 0);
  g.add(block);
  // 表面（左侧面 x = -2.1）
  const surfaceMark = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(3.4, 3.4)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.25, side: THREE.DoubleSide })),
  );
  surfaceMark.rotation.y = Math.PI / 2;
  surfaceMark.position.set(-2.1, -1.4, 0);
  g.add(surfaceMark);
  // 电流密度分布（随深度指数衰减）：用一排变色柱表示 J(x)
  const NJ = 40;
  const jBars: import('three').Mesh[] = [];
  for (let i = 0; i < NJ; i++) {
    const m = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(0.14, 1, 0.5)),
      bag.mat(new THREE.MeshBasicMaterial({ color: PAL.amber })),
    );
    const x = -2.1 + (i / (NJ - 1)) * 6.9;
    m.position.set(x, 0.9, 0);
    g.add(m);
    jBars.push(m);
  }
  // 趋肤深度标记 δ
  const deltaMark = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.06, 2.4, 0.1)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.red })),
  );
  g.add(deltaMark);
  const deltaLabel = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(1.6, 0.06, 0.1)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.red })),
  );
  g.add(deltaLabel);
  // 交变电流箭头（表面）
  const acArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(-3.4, -1.4, 1.9), 1.8, PAL.green, 0.2, 0.1,
  );
  g.add(acArrow);

  // J(x) 曲线画布
  const plot = makeCanvas(bag, THREE, 420, 260, 5.2, 5.4, 3.4);
  g.add(plot.mesh);
  function drawJ(delta: number): void {
    const c = plot.frame('J(x) = J₀e^{−x/δ}', '深度 x', 'J');
    const W = 420, H = 260;
    c.strokeStyle = '#f59e0b'; c.lineWidth = 4; c.beginPath();
    for (let i = 0; i <= 300; i++) {
      const x = (i / 300) * 6;
      const J = Math.exp(-x / delta);
      const px = 50 + (i / 300) * (W - 70);
      const py = (H - 44) - J * (H - 84);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    // δ 标记（1/e ≈ 0.37）
    const dpx = 50 + (delta / 6) * (W - 70);
    const dpy = (H - 44) - Math.exp(-1) * (H - 84);
    c.strokeStyle = '#ef4444'; c.setLineDash([5, 5]); c.lineWidth = 2;
    c.beginPath(); c.moveTo(dpx, H - 44); c.lineTo(dpx, dpy); c.lineTo(50, dpy); c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#ef4444'; c.fillText('δ = 1/e 深度', dpx + 8, dpy - 8);
    c.fillStyle = '#f8fafc'; c.font = '15px sans-serif';
    c.fillText(`δ = √(2/ωμσ) = ${delta.toFixed(2)}`, 56, 46);
    c.fillStyle = '#94a3b8';
    c.fillText('频率越高 → δ 越小 → 电流越集中于表面', 56, 70);
    plot.tex.needsUpdate = true;
  }
  drawJ(1.0);

  g.add(panelSprite(THREE, bag, [
    { text: '趋肤效应：J(x) = J₀e^{−x/δ}，趋肤深度 δ = √(2/ωμσ)', color: '#f8fafc' },
    { text: '高频时电流只在表面薄层流动 → 交流电阻增大、内电感下降', color: '#94a3b8' },
    { text: '读数：δ ∝ 1/√f；铜 50 Hz ≈ 9.2 mm，1 MHz ≈ 66 μm', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.6, 'center'));

  let lastBucket = -1;
  return (t: number, dt: number) => {
    // 频率随时间变化 → δ 变化
    const f = 0.4 + 2.6 * (Math.sin(t * 0.35) * 0.5 + 0.5);
    const delta = 2.4 / Math.sqrt(f * 6);
    // J 柱高度 ∝ e^{−x/δ}
    jBars.forEach((b, i) => {
      const x = (i / (NJ - 1)) * 6.9;
      const J = Math.exp(-x / delta);
      b.scale.y = Math.max(0.04, J * 2.6);
      b.position.y = 0.9 - b.scale.y / 2;
      const m = b.material as import('three').MeshBasicMaterial;
      m.color.setRGB(0.96 * J + 0.1, 0.62 * J + 0.1, 0.05 * J + 0.15);
    });
    // δ 标记位置
    deltaMark.position.set(-2.1 + delta, 1.9, 0);
    deltaLabel.position.set(-2.1 + delta, 3.2, 0);
    // 交变电流箭头
    acArrow.setDirection(new THREE.Vector3(0, Math.cos(t * f * 6) >= 0 ? 1 : -1, 0));
    acArrow.setLength(1.4 + 0.6 * Math.abs(Math.cos(t * f * 6)), 0.2, 0.1);
    const bucket = Math.round(f * 20);
    if (bucket !== lastBucket) { lastBucket = bucket; drawJ(delta); }
    void dt;
  };
}
