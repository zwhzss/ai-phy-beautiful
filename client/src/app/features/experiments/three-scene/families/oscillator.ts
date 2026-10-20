import type { SceneContext, SceneInstance } from '../types';
import { scaffold, panelSprite, PAL, ResourceBag } from './_common';

/**
 * 振动与力学族（oscillator）：
 * P477 拉格朗日方程解双摆 / P479 耦合振子的能量拍 /
 * P300 转椅与角动量守恒 · P298 弹道摆 · P04 动量守恒与弹性碰撞 · P296 傅科摆 ·
 * P433 质点系与质心运动定理 · P56 混沌双摆 · P03 弹簧振子与相图（default 二次分支） /
 * P469 受迫振动与共振峰 · P64 受迫振动与共振（forced 二次分支） / P480 陀螺进动与章动 /
 * P468 振动合成与李萨如图形 / P478 哈密顿方程与相空间 · P542 极限环与分岔 · P541 相平面与稳定性分析（phasespace 二次分支） /
 * P472 角动量守恒的综合应用 · P471 转动惯量与平行轴定理（rotation 二次分支）。
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
    case 'chaos': return build_chaos(g, bag, THREE, title);
    case 'coupled': return build_coupled(g, bag, THREE, title);
    case 'default': return build_default(g, bag, THREE, title);
    case 'forced': return build_forced(g, bag, THREE, title);
    case 'gyro': return build_gyro(g, bag, THREE, title);
    case 'lissajous': return build_lissajous(g, bag, THREE, title);
    case 'phasespace': return build_phasespace(g, bag, THREE, title);
    case 'rotation': return build_rotation(g, bag, THREE, title);
    default: return build_chaos(g, bag, THREE, title);
  }
}

/** 双摆状态（Lagrange 方程 → 二阶 ODE，半隐式积分） */
interface PendState { a1: number; a2: number; w1: number; w2: number }

function pendStep(p: PendState, h: number): void {
  const gm = 9.81;
  const d = p.a2 - p.a1;
  const s = Math.sin(d), c = Math.cos(d);
  const den = 2 - c * c;
  if (Math.abs(den) < 1e-6) return;
  // 等质量等长双摆的拉格朗日方程（标准形式，s=sin(θ₂−θ₁), c=cos(θ₂−θ₁)）：
  // 已对 Wikipedia 标准式互验一致；竖直悬挂平衡线性化两模均振荡，ω² = (2∓√2)g/l
  const acc1 = (
    p.w1 * p.w1 * s * c + p.w2 * p.w2 * s - 2 * gm * Math.sin(p.a1) + gm * Math.sin(p.a2) * c
  ) / den;
  const acc2 = (
    -2 * p.w1 * p.w1 * s - p.w2 * p.w2 * s * c + 2 * gm * Math.sin(p.a1) * c - 2 * gm * Math.sin(p.a2)
  ) / den;
  p.w1 += acc1 * h;
  p.w2 += acc2 * h;
  p.a1 += p.w1 * h;
  p.a2 += p.w2 * h;
}

/** P477 拉格朗日方程解双摆 / P56 混沌双摆：两组微差初值 → 轨迹发散 */
function build_chaos(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const lagrange = title.includes('拉格朗日');
  // 二次分支：拉格朗日 → 方程叙事；混沌双摆 → 轨迹发散 + 李雅普诺夫/初值敏感读数
  const chaos = !lagrange;
  const pA: PendState = { a1: 2.0, a2: 2.2, w1: 0, w2: 0 };
  const pB: PendState = { a1: 2.0, a2: 2.2015, w1: 0, w2: 0 }; // 微差初值 → 混沌发散
  const pivot = new THREE.Vector3(-4.8, 2.6, 0);
  const TRAIL = 220;

  /** 由双摆状态求两段杆端点：支点 → 关节球 → 第二球 */
  const arms = (p: PendState) => {
    const x1 = pivot.x + Math.sin(p.a1) * 2.0;
    const y1 = pivot.y - Math.cos(p.a1) * 2.0;
    return { x1, y1, x2: x1 + Math.sin(p.a2) * 2.0, y2: y1 - Math.cos(p.a2) * 2.0 };
  };
  // 两组初值在 t=0 时第二球的间距（分离度基准 Δ₀）
  const q0 = arms(pA), q1 = arms(pB);
  const d0 = Math.max(1e-6, Math.hypot(q1.x2 - q0.x2, q1.y2 - q0.y2));

  const mkSet = (col: number, dashed: boolean) => {
    const rodGeo = bag.geo(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
    ]));
    const rod = new THREE.Line(
      rodGeo,
      bag.mat(new THREE.LineBasicMaterial({ color: col, transparent: dashed, opacity: dashed ? 0.6 : 1 })),
    );
    g.add(rod);
    const tGeo = bag.geo(new THREE.BufferGeometry());
    tGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
    const trail = new THREE.Line(tGeo, bag.mat(new THREE.LineBasicMaterial({
      color: col, transparent: true, opacity: dashed ? 0.4 : 0.9,
    })));
    g.add(trail);
    const bob1 = new THREE.Mesh(
      bag.geo(new THREE.SphereGeometry(0.26, 16, 12)),
      bag.mat(new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.3 })),
    );
    const bob2 = new THREE.Mesh(
      bag.geo(new THREE.SphereGeometry(0.32, 18, 14)),
      bag.mat(new THREE.MeshStandardMaterial({
        color: col, emissive: col, emissiveIntensity: dashed ? 0.3 : 0.6,
        transparent: dashed, opacity: dashed ? 0.75 : 1,
      })),
    );
    g.add(bob1); g.add(bob2);
    return { rod, tGeo, bob1, bob2, hist: [] as { x: number; y: number }[] };
  };
  const setA = mkSet(PAL.amber, false);
  const setB = mkSet(PAL.cyan, true);
  const pivotMesh = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.13, 12, 10)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.white })),
  );
  pivotMesh.position.copy(pivot);
  g.add(pivotMesh);

  g.add(panelSprite(THREE, bag, lagrange ? [
    { text: 'L = T − V，d/dt(∂L/∂q̇) − ∂L/∂q = 0（广义坐标 θ₁, θ₂）', color: '#f8fafc' },
    { text: 'M(θ)θ̈ + C(θ,θ̇) + G(θ) = 0：质量矩阵随 θ₁−θ₂ 耦合变化', color: '#94a3b8' },
    { text: '青色与橙色仅差 0.0015 rad 初值，轨迹迅速分开', color: '#06b6d4' },
  ] : [
    { text: '混沌双摆：两组解仅差 0.0015 rad 初值，轨迹指数发散（λ > 0）', color: '#f8fafc' },
    { text: '分离度 Δ(t) = Δ₀·e^{λt}，李雅普诺夫指数 λ > 0 → 长期不可预测', color: '#94a3b8' },
    { text: '对初值极敏感：橙 = 基准解，青 = 微扰解（右下为实时读数）', color: '#f59e0b' },
  ], [0, 4.6, 0], 8.0, 'center'));

  // P56 混沌读数画布：两组解的分离度 Δ(t) + 有限时李雅普诺夫指数估计（拉格朗日分支不显示）
  const rdcv = document.createElement('canvas');
  rdcv.width = 360; rdcv.height = 280;
  const rdc = rdcv.getContext('2d')!;
  const rdtex = bag.tex(new THREE.CanvasTexture(rdcv));
  const rdPlane = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(4.6, 4.6 * 280 / 360)),
    bag.mat(new THREE.MeshBasicMaterial({ map: rdtex, transparent: true, depthTest: false })),
  );
  rdPlane.position.set(5.0, 1.05, 0);
  rdPlane.renderOrder = 997;
  rdPlane.visible = chaos;
  g.add(rdPlane);

  function drawChaos(tt: number, d: number, lam: number): void {
    const W = 360, H = 280;
    rdc.clearRect(0, 0, W, H);
    rdc.fillStyle = 'rgba(7,11,20,0.88)'; rdc.fillRect(0, 0, W, H);
    rdc.strokeStyle = '#334155'; rdc.lineWidth = 3; rdc.strokeRect(1.5, 1.5, W - 3, H - 3);
    rdc.textAlign = 'left';
    rdc.font = '16px sans-serif'; rdc.fillStyle = '#94a3b8';
    rdc.fillText('初值差 Δθ₂(0) = 0.0015 rad', 22, 32);
    rdc.font = 'bold 22px sans-serif'; rdc.fillStyle = '#f8fafc';
    rdc.fillText(`t = ${tt.toFixed(1)} s   Δ₀ = ${d0.toFixed(4)}`, 22, 66);
    rdc.font = '20px sans-serif'; rdc.fillStyle = '#f59e0b';
    rdc.fillText(`Δ(t) = ${d < 0.01 ? d.toExponential(1) : d.toFixed(3)}`, 22, 100);
    rdc.font = '18px sans-serif'; rdc.fillStyle = '#06b6d4';
    rdc.fillText(`Δ/Δ₀ = ${(d / d0 < 1e4 ? (d / d0).toFixed(1) : (d / d0).toExponential(1))} 倍`, 22, 134);
    rdc.fillStyle = '#22c55e';
    rdc.fillText(lam > 0 ? `λ ≈ ln(Δ/Δ₀)/t = ${lam.toFixed(2)} > 0` : 'λ ≈ ln(Δ/Δ₀)/t = —（积累中）', 22, 168);
    rdc.font = '17px sans-serif'; rdc.fillStyle = '#f472b6';
    rdc.fillText('λ > 0 ⇒ 指数发散、初值极敏感', 22, 204);
    rdc.fillStyle = '#94a3b8';
    rdc.fillText('短期可预测，长期不可预测', 22, 234);
    rdc.font = '14px sans-serif'; rdc.fillStyle = '#64748b';
    rdc.fillText('（有限时李雅普诺夫估计，Δ 饱和后取峰值）', 22, 264);
    rdtex.needsUpdate = true;
  }

  let acc = 0;
  let simT = 0;
  let lamMax = 0;
  let lastFrame = -1;
  const apply = (p: PendState, s: typeof setA) => {
    const q = arms(p);
    const arr = (s.rod.geometry.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    arr[0] = pivot.x; arr[1] = pivot.y; arr[2] = 0;
    arr[3] = q.x1; arr[4] = q.y1; arr[5] = 0;
    arr[6] = q.x2; arr[7] = q.y2; arr[8] = 0;
    (s.rod.geometry.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    s.bob1.position.set(q.x1, q.y1, 0);
    s.bob2.position.set(q.x2, q.y2, 0);
    s.hist.push({ x: q.x2, y: q.y2 });
    if (s.hist.length > TRAIL) s.hist.shift();
    const tarr = (s.tGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    for (let k = 0; k < TRAIL; k++) {
      const e = s.hist[k];
      tarr[k * 3] = e ? e.x : q.x2;
      tarr[k * 3 + 1] = e ? e.y : q.y2;
      tarr[k * 3 + 2] = -0.5;
    }
    (s.tGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
  };

  return (_t: number, dt: number) => {
    const step = Math.min(dt, 0.05);
    acc += step;
    simT += step;              // 与积分同步的仿真时长（李雅普诺夫估计用）
    const h = 1 / 240;
    let guard = 0;
    while (acc >= h && guard++ < 60) {
      pendStep(pA, h);
      pendStep(pB, h);
      acc -= h;
    }
    apply(pA, setA);
    apply(pB, setB);
    if (chaos) {
      // 分离度 Δ(t) = 两组解第二球间距；有限时李雅普诺夫指数 λ ≈ ln(Δ/Δ₀)/t（取峰值）
      const ha = setA.hist[setA.hist.length - 1];
      const hb = setB.hist[setB.hist.length - 1];
      const d = ha && hb ? Math.hypot(ha.x - hb.x, ha.y - hb.y) : d0;
      if (simT > 2.0 && d > d0) lamMax = Math.max(lamMax, Math.log(d / d0) / simT);
      const fr = Math.floor(simT * 8);
      if (fr !== lastFrame) { lastFrame = fr; drawChaos(simT, d, lamMax); }
    }
  };
}

/** P479 耦合振子的能量拍：两摆经弱弹簧耦合，能量周期性交换 */
function build_coupled(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const x0 = [-2.8, 2.8];
  const bobs: import('three').Mesh[] = [];
  const arms: import('three').Line[] = [];
  for (let i = 0; i < 2; i++) {
    const armGeo = bag.geo(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]));
    const arm = new THREE.Line(armGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.slate })));
    g.add(arm); arms.push(arm);
    const bob = new THREE.Mesh(
      bag.geo(new THREE.SphereGeometry(0.42, 20, 16)),
      bag.mat(new THREE.MeshStandardMaterial({
        color: i ? PAL.cyan : PAL.amber, roughness: 0.4,
        emissive: i ? PAL.cyan : PAL.amber, emissiveIntensity: 0.2,
      })),
    );
    g.add(bob); bobs.push(bob);
  }
  // 支点横梁
  const bar = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(9.0, 0.18, 0.3)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x475569 })),
  );
  bar.position.set(0, 3.4, 0);
  g.add(bar);
  // 耦合弹簧（两球之间的锯齿线）
  const springGeo = bag.geo(new THREE.BufferGeometry());
  springGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(72 * 3), 3));
  const spring = new THREE.Line(springGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.pink })));
  g.add(spring);
  // 能量柱：可视化 E₁ / E₂ 交换
  const eBars: import('three').Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const b = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(0.8, 1, 0.5)),
      bag.mat(new THREE.MeshStandardMaterial({
        color: i ? PAL.cyan : PAL.amber, emissive: i ? PAL.cyan : PAL.amber, emissiveIntensity: 0.3,
      })),
    );
    b.position.set(-6.4 + i * 1.5, -3.4, 0);
    g.add(b); eBars.push(b);
  }

  const L = 3.4;
  const w2 = 6.2, k = 1.15;
  // 简正模频率：由本族自己的耦合方程直接推得，与动画/读数同源
  //   对称模 a=b → ω² = ω₀²(=w2)；反对称模 a=−b → ω² = ω₀² + 2κ(=w2+2k)
  const wSym = Math.sqrt(w2);
  const wAnti = Math.sqrt(w2 + 2 * k);
  const dW = wAnti - wSym;
  g.add(panelSprite(THREE, bag, [
    { text: '耦合振子：ẍ₁ + ω₀²x₁ = κ(x₂−x₁)，ẍ₂ + ω₀²x₂ = κ(x₁−x₂)', color: '#f8fafc' },
    { text: '简正模 ω_对称² = ω₀²、ω_反对称² = ω₀² + 2κ（Δω = ω_反 − ω_对）', color: '#94a3b8' },
    { text: `拍频读数：Δω = √(ω₀²+2κ)−ω₀ = ${dW.toFixed(2)} rad/s，弱耦合近似 κ/ω₀ ≈ ${(k / wSym).toFixed(2)}`, color: '#06b6d4' },
    { text: `能量在两摆间周期回授，T_beat = 2π/Δω = ${(2 * Math.PI / dW).toFixed(1)} s（下方双柱 = E₁,E₂）`, color: '#fbbf24' },
  ], [0, 4.6, 0], 8.0, 'center'));

  let a = 1.15, b = 0, va = 0, vb = 0;
  let acc = 0;
  return (_t: number, dt: number) => {
    acc += Math.min(dt, 0.05);
    const h = 1 / 480;
    let guard = 0;
    while (acc >= h && guard++ < 120) {
      const aa = -w2 * a - k * (a - b);
      const bb = -w2 * b - k * (b - a);
      va += aa * h; vb += bb * h;
      a += va * h; b += vb * h;
      acc -= h;
    }
    for (let i = 0; i < 2; i++) {
      const ang = i ? b : a;
      const px = x0[i];
      const bx = px + Math.sin(ang) * L;
      const by = 3.4 - Math.cos(ang) * L;
      bobs[i].position.set(bx, by, 0);
      const arr = (arms[i].geometry.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
      arr[0] = px; arr[1] = 3.4; arr[2] = 0;
      arr[3] = bx; arr[4] = by; arr[5] = 0;
      (arms[i].geometry.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
      const v = i ? vb : va;
      const q = i ? b : a;
      const E = 0.5 * v * v + 0.5 * w2 * q * q;
      eBars[i].scale.y = Math.max(0.2, Math.min(5.0, E * 2.4));
      eBars[i].position.y = -4.6 + eBars[i].scale.y / 2;
    }
    // 耦合弹簧锯齿
    const sarr = (springGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    const A = bobs[0].position, B = bobs[1].position;
    for (let i = 0; i < 72; i++) {
      const u = i / 71;
      sarr[i * 3] = A.x + (B.x - A.x) * u;
      sarr[i * 3 + 1] = A.y + (B.y - A.y) * u + Math.sin(u * Math.PI * 14) * 0.24 * Math.sin(u * Math.PI);
      sarr[i * 3 + 2] = 0;
    }
    (springGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
  };
}

/** P300 转椅 · P298 弹道摆 · P04 弹性碰撞 · P296 傅科摆 · P433 质心 · P56 双摆 · P03 弹簧振子与相图 */
function build_default(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const chair = title.includes('转椅');
  const ballistic = title.includes('弹道摆');
  const collide = title.includes('碰撞');
  const foucault = title.includes('傅科');
  // 质点系与质心运动定理：命中"质心"或"质点系"（P433）
  const com = title.includes('质心') || title.includes('质点系');
  const doubleP = title.includes('双摆');
  // P03 弹簧振子与相图：显式识别（也作为未命中其它关键词时的默认形态）
  const spring = title.includes('弹簧振子') || title.includes('相图');
  const eq = spring || (!chair && !ballistic && !collide && !foucault && !com && !doubleP);
  const any3D = chair || ballistic || collide || foucault || com || doubleP || eq;

  // ---------- P03 弹簧振子 + 相图 ----------
  const springGeo = bag.geo(new THREE.BufferGeometry());
  springGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(140 * 3), 3));
  const springLine = new THREE.Line(springGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan })));
  g.add(springLine);
  const block = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(1.0, 1.0, 1.0)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.amber, roughness: 0.4 })),
  );
  g.add(block);
  const wall = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.3, 3.0, 1.1)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x475569 })),
  );
  wall.position.set(-5.6, 1.0, 0);
  g.add(wall);
  const cv = document.createElement('canvas');
  cv.width = 300; cv.height = 300;
  const c2 = cv.getContext('2d')!;
  const tex = bag.tex(new THREE.CanvasTexture(cv));
  const plot = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(3.8, 3.8)),
    bag.mat(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false })),
  );
  plot.position.set(6.4, 0.4, 0);
  plot.renderOrder = 997;
  g.add(plot);

  // ---------- P03 x(t) 位移-时间曲线画布（description 承诺"位移-时间曲线，观察阻尼对振幅的影响"） ----------
  const xtCv = document.createElement('canvas');
  xtCv.width = 340; xtCv.height = 200;
  const xtC = xtCv.getContext('2d')!;
  const xtTex = bag.tex(new THREE.CanvasTexture(xtCv));
  const xtPlane = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(4.0, 2.4)),
    bag.mat(new THREE.MeshBasicMaterial({ map: xtTex, transparent: true, depthTest: false })),
  );
  xtPlane.position.set(-4.4, -3.0, 0);
  xtPlane.renderOrder = 997;
  g.add(xtPlane);

  // ---------- P296 傅科摆 ----------
  const pivot = new THREE.Vector3(0, 4.2, 0);
  const bob = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.34, 20, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, roughness: 0.35 })),
  );
  g.add(bob);
  const cordGeo = bag.geo(new THREE.BufferGeometry());
  // 双摆需要 3 个顶点（支点 → 关节 → 第二球），傅科摆只需 2 个，避免越界写入
  cordGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((doubleP ? 3 : 2) * 3), 3));
  const cord = new THREE.Line(cordGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.slate })));
  g.add(cord);
  const groundRing = new THREE.Mesh(
    bag.geo(new THREE.RingGeometry(3.2, 3.27, 96)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.slate, side: THREE.DoubleSide })),
  );
  groundRing.rotation.x = -Math.PI / 2;
  groundRing.position.y = -1.6;
  g.add(groundRing);
  // 摆动平面标记（傅科摆：平面在惯性系中不动）
  const planeBlade = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(6.4, 0.05, 0.14)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.8 })),
  );
  planeBlade.position.y = -1.5;
  g.add(planeBlade);

  // ---------- P04 弹性碰撞 / P298 弹道摆 ----------
  const ball1 = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.45, 20, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, roughness: 0.4 })),
  );
  const ball2 = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.45, 20, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.pink, roughness: 0.4 })),
  );
  g.add(ball1); g.add(ball2);
  const rail = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(14, 0.12, 0.9)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x475569 })),
  );
  rail.position.y = -1.7;
  g.add(rail);
  const bpCordGeo = bag.geo(new THREE.BufferGeometry());
  bpCordGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
  const bpCord = new THREE.Line(bpCordGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.amber })));
  g.add(bpCord);
  const bpBob = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.5, 20, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.green, roughness: 0.45 })),
  );
  g.add(bpBob);

  // ---------- P300 转椅 ----------
  const chairGroup = new THREE.Group();
  g.add(chairGroup);
  const seat = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(1.1, 1.1, 0.3, 26)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.violet })),
  );
  seat.position.y = -1.4;
  chairGroup.add(seat);
  const pole = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.16, 0.16, 2.6, 14)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x64748b })),
  );
  chairGroup.add(pole);
  const armBar = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.16, 0.16, 3.6, 14)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, roughness: 0.4 })),
  );
  armBar.rotation.z = Math.PI / 2;
  armBar.position.y = 0.4;
  chairGroup.add(armBar);
  const weights: import('three').Mesh[] = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(
      bag.geo(new THREE.SphereGeometry(0.3, 16, 12)),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.amber })),
    );
    w.position.set(s * 1.6, 0.4, 0);
    chairGroup.add(w);
    weights.push(w);
  }

  // ---------- P433 质心 ----------
  const cmStar = new THREE.Mesh(
    bag.geo(new THREE.OctahedronGeometry(0.3, 0)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.green })),
  );
  g.add(cmStar);
  const cmPathGeo = bag.geo(new THREE.BufferGeometry());
  cmPathGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(200 * 3), 3));
  const cmLine = new THREE.Line(cmPathGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.green })));
  g.add(cmLine);

  // 二次分支：P03 弹簧振子与相图（sin 弹簧曲线） / 其余力学知识点（3D 演示）
  g.add(panelSprite(THREE, bag, eq ? [
    { text: '弹簧振子：ẍ + ω₀²x = 0，ω₀ = √(k/m)，T = 2π/ω₀', color: '#f8fafc' },
    { text: '相图 (x, v) 为同心椭圆：E = ½mv² + ½kx² 守恒', color: '#94a3b8' },
    { text: '阻尼时椭线内卷 → 稳定焦点；橙点为当前状态', color: '#06b6d4' },
  ] : chair ? [
    { text: '转椅：手臂收回 → 转动惯量 I = Σmᵢrᵢ² 减小', color: '#f8fafc' },
    { text: '合外力矩为零 ⇒ L = Iω 守恒，I↓ 则 ω↑', color: '#94a3b8' },
    { text: '读数：ω 与 1/I 成正比；动能增加来自人体做功', color: '#fbbf24' },
  ] : ballistic ? [
    { text: '弹道摆：mv = (M+m)V（完全非弹性），再由 ½(M+m)V² = (M+m)gh', color: '#f8fafc' },
    { text: '解得子弹速度 v = (M+m)/m·√(2gh) = (1 + M/m)√(2gh)', color: '#94a3b8' },
    { text: '碰撞段动量守恒，摆升段机械能守恒（两段拼接；碰后动能仅保留 m/(M+m)）', color: '#22c55e' },
  ] : collide ? [
    { text: '弹性碰撞：m₁v₁ + m₂v₂ = m₁v₁′ + m₂v₂′（m₁=1、m₂=2、v₂=0）', color: '#f8fafc' },
    { text: '一维弹性碰撞解析解：v₁′=(m₁−m₂)v₁/(m₁+m₂)，v₂′=2m₁v₁/(m₁+m₂)', color: '#94a3b8' },
    { text: 'm₁ 推进到与 m₂ 相切才碰撞；Σp、ΣE_k 碰撞前后严格不变（右侧读数）', color: '#22c55e' },
  ] : foucault ? [
    { text: '傅科摆：摆动平面在惯性空间保持，地面在其下转动', color: '#f8fafc' },
    { text: '偏转角速率 Ω = ω_地 sinφ，周期 T = 23.9 h / sinφ', color: '#94a3b8' },
    { text: '北极 φ = 90°：24 h 转一周；赤道 φ = 0° 不偏转', color: '#fbbf24' },
  ] : com ? [
    { text: '质心运动定理：M·a_cm = ΣF_外（内力不改变质心）', color: '#f8fafc' },
    { text: '炮弹沿抛物线飞行、中途分裂，两碎片各走偏离曲线，绿星质心仍严格沿原抛物线', color: '#22c55e' },
    { text: '柯尼希定理：K = K_质心 + K_相对（总动能 = 随质心平动 + 相对质心运动）', color: '#94a3b8' },
    { text: '读数：蓝/粉球 = 两碎片，绿星 = 质心，仅受外力（示意）', color: '#fbbf24' },
  ] : doubleP ? [
    { text: '双摆自由度 2：L = T − V，坐标 (θ₁, θ₂)', color: '#f8fafc' },
    { text: '上下两段耦合摆动，能量在两段之间反复交换', color: '#94a3b8' },
    { text: '简化示意：严格混沌与初值敏感见「混沌双摆」（P56，chaos 分支）', color: '#f472b6' },
  ] : [
    { text: '弹簧振子：ẍ + ω₀²x = 0，ω₀ = √(k/m)，T = 2π/ω₀', color: '#f8fafc' },
    { text: '相图 (x, v) 为同心椭圆：E = ½mv² + ½kx² 守恒', color: '#94a3b8' },
    { text: '阻尼时椭线内卷 → 稳定焦点；橙点为当前状态', color: '#06b6d4' },
  ], [0, 4.6, 0], 8.0, 'center'));
  // 隐藏与当前知识点无关的对象
  springLine.visible = eq;
  block.visible = eq;
  wall.visible = eq;
  plot.visible = eq;
  xtPlane.visible = eq;
  bob.visible = foucault || doubleP;
  cord.visible = foucault || doubleP;
  groundRing.visible = foucault;
  planeBlade.visible = foucault;
  ball1.visible = collide || ballistic || com;
  ball2.visible = collide || com;
  rail.visible = collide;
  bpCord.visible = ballistic;
  bpBob.visible = ballistic;
  chairGroup.visible = chair;
  cmStar.visible = com;
  cmLine.visible = com;
  void any3D;

  let cmPhase = 0;
  let lastFrame = -1;
  let lastBalFrame = -1;

  // P03 弹簧振子受控阻尼状态：ω₀、初幅 X0 固定 → 弹簧/方块几何与原版同源；β 每周期扫描 0→0.4
  const springW0 = 2.4, springX0 = 1.6;
  let ox = springX0, ov = 0, oBeta = 0, oAcc = 0, oCycle = 0;
  const ohist: number[] = [];
  const xth: number[] = [];

  function drawPhase(x: number, v: number, w0: number, beta: number): void {
    const W = 300;
    c2.clearRect(0, 0, W, W);
    c2.fillStyle = 'rgba(7,11,20,0.88)'; c2.fillRect(0, 0, W, W);
    c2.strokeStyle = '#334155'; c2.lineWidth = 3; c2.strokeRect(1.5, 1.5, W - 3, W - 3);
    c2.strokeStyle = '#475569'; c2.lineWidth = 2;
    c2.beginPath();
    c2.moveTo(34, W / 2); c2.lineTo(W - 16, W / 2);
    c2.moveTo(W / 2, 22); c2.lineTo(W / 2, W - 34);
    c2.stroke();
    c2.fillStyle = '#94a3b8'; c2.font = '17px sans-serif'; c2.textAlign = 'center';
    c2.fillText('x', W - 26, W / 2 - 8);
    c2.fillText('v', W / 2 + 20, 34);
    // 无阻尼参考椭圆（E 守恒满幅，虚线淡显）
    c2.strokeStyle = 'rgba(6,182,212,0.4)'; c2.lineWidth = 2; c2.setLineDash([5, 5]);
    c2.beginPath();
    for (let i = 0; i <= 160; i++) {
      const ph = (i / 160) * Math.PI * 2;
      const px = W / 2 + Math.cos(ph) * 110;
      const py = W / 2 - Math.sin(ph) * 92;
      if (i === 0) c2.moveTo(px, py); else c2.lineTo(px, py);
    }
    c2.stroke(); c2.setLineDash([]);
    // 记录并绘制实时相轨：无阻尼为闭合椭圆，阻尼时逐圈内卷 → 稳定焦点
    const pxn = W / 2 + (x / 1.6) * 110;
    const pyn = W / 2 + (v / (1.6 * w0)) * 92;
    ohist.push(pxn, pyn);
    if (ohist.length > 1000) ohist.splice(0, ohist.length - 1000);
    c2.strokeStyle = '#06b6d4'; c2.lineWidth = 3; c2.beginPath();
    for (let i = 0; i < ohist.length; i += 2) {
      if (i === 0) c2.moveTo(ohist[i], ohist[i + 1]); else c2.lineTo(ohist[i], ohist[i + 1]);
    }
    c2.stroke();
    // 当前状态点
    c2.fillStyle = '#f59e0b';
    c2.beginPath();
    c2.arc(pxn, pyn, 8, 0, 7);
    c2.fill();
    c2.textAlign = 'left'; c2.font = '15px sans-serif'; c2.fillStyle = '#f8fafc';
    c2.fillText(`ω₀ = ${w0.toFixed(1)} rad/s   β = ${beta.toFixed(2)}`, 36, W - 52);
    c2.fillText(beta > 0.05 ? '阻尼：相轨内卷 → 稳定焦点（振幅 ∝ e^{-βt}）' : '无阻尼：闭合椭圆，E = ½mv² + ½kx² 守恒', 36, W - 30);
    tex.needsUpdate = true;
  }

  // x(t) 位移-时间曲线：读取最近 ~7 s 的 (t, x) 历史；阻尼扫描时可见振幅包络逐周期衰减
  function drawXt(tnow: number): void {
    const W = 340, H = 200, WIN = 7;
    xtC.clearRect(0, 0, W, H);
    xtC.fillStyle = 'rgba(7,11,20,0.88)'; xtC.fillRect(0, 0, W, H);
    xtC.strokeStyle = '#334155'; xtC.lineWidth = 3; xtC.strokeRect(1.5, 1.5, W - 3, H - 3);
    xtC.strokeStyle = '#475569'; xtC.lineWidth = 2;
    xtC.beginPath(); xtC.moveTo(22, H / 2); xtC.lineTo(W - 14, H / 2); xtC.stroke();
    xtC.fillStyle = '#94a3b8'; xtC.font = '15px sans-serif'; xtC.textAlign = 'left';
    xtC.fillText('位移 x(t)', 26, 24); xtC.textAlign = 'right'; xtC.fillText('t（右端为当前）', W - 16, H - 12);
    xtC.strokeStyle = '#f59e0b'; xtC.lineWidth = 2.5; xtC.beginPath();
    const n = xth.length / 2;
    let started = false;
    for (let i = 0; i < n; i++) {
      const ta = xth[i * 2], xa = xth[i * 2 + 1];
      const u = (ta - (tnow - WIN)) / WIN;
      if (u < 0) continue;
      const px = 22 + u * (W - 36);
      const py = H / 2 - (xa / springX0) * ((H - 44) / 2);
      if (!started) { xtC.moveTo(px, py); started = true; } else xtC.lineTo(px, py);
    }
    xtC.stroke();
    xtTex.needsUpdate = true;
  }

  // ---------- P298 弹道摆：实时 h / V / 能量损失读数（完全非弹性碰撞核心） ----------
  // 数值与摆的几何严格同源：V=mv/(M+m) → h=V²/2g → 摆幅 thMax=L(1−cosθ)，动画摆角即取 thMax（无人为阻尼）
  const gB = 9.81, Lb = 3.2, mb = 0.01, Mb = 1.99, vb = 200;
  const Vb = mb * vb / (Mb + mb);
  const hb = Vb * Vb / (2 * gB);
  const thMax = Math.acos(1 - hb / Lb);
  const balCv = document.createElement('canvas');
  balCv.width = 380; balCv.height = 300;
  const balC2 = balCv.getContext('2d')!;
  const balTex = bag.tex(new THREE.CanvasTexture(balCv));
  const balPlane = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(4.4, 4.4 * 300 / 380)),
    bag.mat(new THREE.MeshBasicMaterial({ map: balTex, transparent: true, depthTest: false })),
  );
  balPlane.position.set(5.4, 0.5, 0);
  balPlane.renderOrder = 997;
  g.add(balPlane);
  function drawBalistic(curH: number): void {
    const W = 380, H = 300;
    balC2.clearRect(0, 0, W, H);
    balC2.fillStyle = 'rgba(7,11,20,0.88)'; balC2.fillRect(0, 0, W, H);
    balC2.strokeStyle = '#334155'; balC2.lineWidth = 3; balC2.strokeRect(1.5, 1.5, W - 3, H - 3);
    balC2.textAlign = 'left';
    balC2.font = '16px sans-serif'; balC2.fillStyle = '#94a3b8';
    balC2.fillText('弹道摆（完全非弹性碰撞）', 22, 32);
    balC2.fillText('子弹 m=0.01kg · 摆锤 M=1.99kg · 摆长 L=3.2m', 22, 60);
    balC2.font = '18px sans-serif'; balC2.fillStyle = '#f59e0b';
    balC2.fillText(`碰后共速 V = mv/(M+m) = ${Vb.toFixed(2)} m/s`, 22, 96);
    balC2.fillStyle = '#f8fafc';
    balC2.fillText(`摆升最大高度 h_max = V²/2g = ${hb.toFixed(3)} m`, 22, 128);
    balC2.fillStyle = '#06b6d4';
    balC2.fillText(`实时高度 h = L(1−cosθ) = ${curH.toFixed(3)} m`, 22, 160);
    balC2.fillStyle = '#22c55e';
    balC2.fillText(`反解子弹速 v=(1+M/m)√(2gh) = ${((1 + Mb / mb) * Math.sqrt(2 * gB * hb)).toFixed(1)} m/s`, 22, 192);
    balC2.fillStyle = '#fbbf24';
    balC2.fillText(`保留动能 E′/E = m/(M+m) = ${(mb / (Mb + mb) * 100).toFixed(1)}%`, 22, 234);
    balC2.fillStyle = '#ef4444';
    balC2.fillText(`碰撞损失 ΔE/E = M/(M+m) = ${(Mb / (Mb + mb) * 100).toFixed(1)}%`, 22, 266);
    balTex.needsUpdate = true;
  }

  // ---------- P04 弹性碰撞：一维弹性碰撞解析解（m₁ 追上静止的 m₂） ----------
  const m1 = 1.0, m2 = 2.0;                                  // 两球质量
  const u1 = 2.4, u2 = 0;                                    // 碰前速度（m₂ 静止）
  const v1 = ((m1 - m2) * u1 + 2 * m2 * u2) / (m1 + m2);     // -0.8：解析解
  const v2 = ((m2 - m1) * u2 + 2 * m1 * u1) / (m1 + m2);     // +1.6：解析解
  const pBefore = m1 * u1 + m2 * u2;
  const pAfter = m1 * v1 + m2 * v2;
  const eBefore = 0.5 * m1 * u1 * u1 + 0.5 * m2 * u2 * u2;
  const eAfter = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
  const x2c = 2.4;                                           // m₂ 静止时球心
  const x1c = x2c - 0.9;                                     // 相切（间距 = R₁+R₂ = 0.9）时 m₁ 球心
  const phA = 2.5, phB = 1.5, phC = 2.0;                     // 接近 / 碰后 / 复位 三段时长
  const colT = phA + phB + phC;
  const x1Start = x1c - u1 * phA;                            // 起点球心
  const xEnd1 = x1c + v1 * phB;                              // 碰后段末 m₁ 球心
  const xEnd2 = x2c + v2 * phB;                              // 碰后段末 m₂ 球心
  // 相切瞬间的接触闪光
  const colRingMat = bag.mat(new THREE.MeshBasicMaterial({
    color: PAL.gold, transparent: true, opacity: 0, depthTest: false, side: THREE.DoubleSide,
  }));
  const colRing = new THREE.Mesh(bag.geo(new THREE.RingGeometry(0.5, 0.6, 40)), colRingMat);
  colRing.position.set(x1c + 0.45, -1.1, 0);                 // 两球切点
  colRing.renderOrder = 996;
  colRing.visible = false;
  g.add(colRing);
  // Σp / ΣE_k 前后对照读数画布
  const colCv = document.createElement('canvas');
  colCv.width = 380; colCv.height = 280;
  const colC2 = colCv.getContext('2d')!;
  const colTex = bag.tex(new THREE.CanvasTexture(colCv));
  const colPlane = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(4.6, 4.6 * 280 / 380)),
    bag.mat(new THREE.MeshBasicMaterial({ map: colTex, transparent: true, depthTest: false })),
  );
  colPlane.position.set(5.1, 1.15, 0);
  colPlane.renderOrder = 997;
  colPlane.visible = collide;
  g.add(colPlane);

  let lastColFrame = -1;
  function drawCollide(ph: number, va: number, vb: number): void {
    const W = 380, H = 280;
    colC2.clearRect(0, 0, W, H);
    colC2.fillStyle = 'rgba(7,11,20,0.88)'; colC2.fillRect(0, 0, W, H);
    colC2.strokeStyle = '#334155'; colC2.lineWidth = 3; colC2.strokeRect(1.5, 1.5, W - 3, H - 3);
    colC2.textAlign = 'left';
    colC2.font = '16px sans-serif'; colC2.fillStyle = '#94a3b8';
    colC2.fillText('m₁ = 1.0 kg（青球）  m₂ = 2.0 kg（粉球）', 22, 32);
    colC2.font = 'bold 20px sans-serif'; colC2.fillStyle = '#f8fafc';
    colC2.fillText(ph === 0 ? '阶段①：m₁ 匀速接近（m₂ 静止）'
      : ph === 1 ? '阶段②：相切碰撞 → 解析解换速'
      : '阶段③：复位（非物理，仅回起点）', 22, 66);
    colC2.font = '19px sans-serif';
    colC2.fillStyle = '#06b6d4';
    colC2.fillText(`v₁ = ${va >= 0 ? '+' : ''}${va.toFixed(2)}   v₂ = ${vb >= 0 ? '+' : ''}${vb.toFixed(2)}  (m/s)`, 22, 100);
    if (ph === 2) {
      colC2.fillStyle = '#64748b';
      colC2.fillText('Σp = ——（复位段不计）', 22, 134);
      colC2.fillText('ΣEk = ——', 22, 168);
    } else {
      colC2.fillStyle = '#fbbf24';
      colC2.fillText(`Σp = ${(m1 * va + m2 * vb).toFixed(2)}`, 22, 134);
      colC2.fillText(`ΣEk = ${(0.5 * m1 * va * va + 0.5 * m2 * vb * vb).toFixed(2)}`, 22, 168);
    }
    colC2.font = '17px sans-serif'; colC2.fillStyle = '#94a3b8';
    colC2.fillText(`碰前 Σp = ${pBefore.toFixed(2)}   ΣEk = ${eBefore.toFixed(2)}`, 22, 204);
    colC2.fillStyle = '#22c55e';
    colC2.fillText(`碰后 Σp = ${pAfter.toFixed(2)}   ΣEk = ${eAfter.toFixed(2)}`, 22, 236);
    colC2.font = '15px sans-serif'; colC2.fillStyle = '#fbbf24';
    colC2.fillText('Σp 与 ΣEk 碰撞前后严格不变 ✓', 22, 266);
    colTex.needsUpdate = true;
  }

  return (t: number, dt: number) => {
    if (eq) {
      // 每 16 s 复位到无阻尼满幅初值，并在本周期内把阻尼 β 由 0 缓升至 0.4（演示阻尼对振幅的影响）
      const cyc = Math.floor(t / 16);
      if (cyc !== oCycle) { oCycle = cyc; ox = springX0; ov = 0; oAcc = 0; ohist.length = 0; xth.length = 0; }
      oBeta = 0.4 * ((t - cyc * 16) / 16);
      // 半隐式积分 ẍ + 2βẋ + ω₀²x = 0（固定步长 1/360）；ω₀、X0 与原版同源 → 弹簧/方块几何不变
      oAcc += Math.min(dt, 0.05);
      const hh = 1 / 360;
      let guard = 0;
      while (oAcc >= hh && guard++ < 60) {
        const acc = -2 * oBeta * ov - springW0 * springW0 * ox;
        ov += acc * hh;
        ox += ov * hh;
        oAcc -= hh;
      }
      const x = ox, v = ov;
      const arr = (springGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
      for (let i = 0; i < 140; i++) {
        const u = i / 139;
        arr[i * 3] = -5.4 + u * (x - 0.5 + 5.4);
        arr[i * 3 + 1] = 1.0 + Math.sin(u * Math.PI * 20) * 0.3 * Math.sin(u * Math.PI);
        arr[i * 3 + 2] = 0;
      }
      (springGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
      block.position.set(x, 1.0, 0);
      xth.push(t, x);
      if (xth.length > 1400) xth.splice(0, xth.length - 1400);
      const fr = Math.floor(t * 10);
      if (fr !== lastFrame) { lastFrame = fr; drawPhase(x, v, springW0, oBeta); drawXt(t); }
    }
    if (foucault || doubleP) {
      const L = 4.4;
      if (doubleP) {
        // 简化混沌双摆：上下两段不规则摆动
        const a1 = 1.5 * Math.sin(t * 1.9);
        const a2 = 1.5 * Math.sin(t * 2.7 + 1.3) + 0.5 * Math.sin(t * 0.7);
        const x1 = Math.sin(a1) * 1.9;
        const y1 = pivot.y - Math.cos(a1) * 1.9;
        const x2 = x1 + Math.sin(a1 + a2) * 1.9;
        const y2 = y1 - Math.cos(a1 + a2) * 1.9;
        const arr = (cordGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
        arr[0] = 0; arr[1] = pivot.y; arr[2] = 0;
        arr[3] = x1; arr[4] = y1; arr[5] = 0;
        arr[6] = x2; arr[7] = y2; arr[8] = 0;
        (cordGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
        bob.position.set(x2, y2, 0);
      } else {
        const sw = 0.5 * Math.cos(2.0 * t);
        const rot = t * 0.5; // 摆动平面相对地面的偏转（北半球）
        const bx = Math.sin(rot) * Math.sin(sw) * L;
        const bz = Math.cos(rot) * Math.sin(sw) * L;
        const by = pivot.y - Math.cos(sw) * L;
        bob.position.set(bx, by, bz);
        const arr = (cordGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
        arr[0] = 0; arr[1] = pivot.y; arr[2] = 0;
        arr[3] = bx; arr[4] = by; arr[5] = bz;
        (cordGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
        planeBlade.rotation.y = rot;
        planeBlade.scale.x = 1;
      }
    }
    if (com) {
      // P433 质点系与质心运动定理：炮弹沿抛物线飞行 → 中途分裂成两碎片 →
      // 绿星质心严格沿"原抛物线"匀速前进（等质量、等大反向内力 ⇒ 质心不受影响，教学示意）
      cmPhase += Math.min(dt, 0.05);
      const gm = 2.6;              // 竖直重力加速度（示意单位）
      const vx = 3.8;             // 水平匀速（示意单位）
      const x0 = -5.6, y0 = -1.6, vy0 = 3.6; // 抛射起点与初速竖直分量（顶点压低，避开上方标题/面板）
      const Tpar = (2 * vy0) / gm; // 完整抛体飞行周期
      if (cmPhase > Tpar) cmPhase -= Tpar; // 循环复位
      const tSplit = 0.9;          // 分裂时刻（上升段、尚未到顶）
      // 质心（=未分裂炮弹）严格沿抛物线：水平匀速 + 竖直重力
      const cx = x0 + vx * cmPhase;
      const cy = y0 + vy0 * cmPhase - 0.5 * gm * cmPhase * cmPhase;
      cmStar.position.set(cx, cy, 0);
      cmStar.visible = true;
      // 绿线 = 质心应走的整条"原抛物线"参考轨迹（静态）
      const ca = (cmPathGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
      for (let i = 0; i < 200; i++) {
        const tt = (i / 199) * Tpar;
        ca[i * 3] = x0 + vx * tt;
        ca[i * 3 + 1] = y0 + vy0 * tt - 0.5 * gm * tt * tt;
        ca[i * 3 + 2] = 0;
      }
      (cmPathGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
      if (cmPhase < tSplit) {
        // 分裂前：仅一枚炮弹（蓝球）沿抛物线飞行，粉球隐藏
        ball1.position.set(cx, cy, 0);
        ball1.visible = true;
        ball2.visible = false;
      } else {
        // 分裂后：内力给两碎片等大反向速度增量 ±du（等质量 ⇒ 质心仍走原抛物线）
        const ts = cmPhase - tSplit;
        const scx = x0 + vx * tSplit;
        const scy = y0 + vy0 * tSplit - 0.5 * gm * tSplit * tSplit;
        const svy = vy0 - gm * tSplit;
        const du = 1.5;           // 内力造成的相对速度增量（示意）
        ball1.visible = true;
        ball2.visible = true;
        ball1.position.set(scx + vx * ts, scy + (svy + du) * ts - 0.5 * gm * ts * ts, 0);
        ball2.position.set(scx + vx * ts, scy + (svy - du) * ts - 0.5 * gm * ts * ts, 0);
      }
    }
    if (collide) {
      // ① m₁ 匀速推进到与 m₂ 相切（球心距 = R₁+R₂）→ ② 切点处按一维弹性碰撞解析解换速
      //    → ③ 复位：①② 两段 Σp、ΣE_k 严格不变
      const tt = t % colT;
      let x1: number, x2: number;
      let va: number, vb: number;
      let ph: number;
      if (tt < phA) {
        ph = 0; va = u1; vb = u2;
        x1 = x1Start + u1 * tt;
        x2 = x2c;
      } else if (tt < phA + phB) {
        ph = 1; va = v1; vb = v2;
        const s = tt - phA;
        x1 = x1c + v1 * s;
        x2 = x2c + v2 * s;
      } else {
        ph = 2;
        const w = (tt - phA - phB) / phC;
        x1 = xEnd1 + (x1Start - xEnd1) * w;
        x2 = xEnd2 + (x2c - xEnd2) * w;
        va = (x1Start - xEnd1) / phC;
        vb = (x2c - xEnd2) / phC;
      }
      ball1.position.set(x1, -1.1, 0);
      ball2.position.set(x2, -1.1, 0);
      // 相切瞬间的接触闪光（扩散 0.5 s 后淡出）
      const age = tt - phA;
      const flash = age >= 0 && age < 0.5;
      colRing.visible = flash;
      if (flash) {
        const k = age / 0.5;
        colRing.scale.setScalar(0.4 + 1.8 * k);
        colRingMat.opacity = 0.9 * (1 - k);
      }
      const fr = Math.floor(t * 8);
      if (fr !== lastColFrame) { lastColFrame = fr; drawCollide(ph, va, vb); }
    }
    if (ballistic) {
      const T = 4.6;
      const u = (t % T) / T;
      const pivot2 = new THREE.Vector3(-1.0, 2.6, 0);
      const bobBottomY = pivot2.y - Lb;   // 静止摆锤底 = 子弹击中点
      let bx = 0, by = 0, angle = 0;
      ball1.visible = true;
      if (u < 0.3) {
        // 飞行段：子弹水平匀速飞向静止摆锤
        bx = -6.4 + (u / 0.3) * 5.4;
        by = bobBottomY;
        ball1.position.set(bx, by, 0);
        bpBob.position.set(pivot2.x, bobBottomY, 0);
      } else {
        // 完全非弹性碰撞后二者一体随摆升起；摆升段机械能守恒 → 无阻尼（去掉原 exp 衰减）
        const tt = (u - 0.3) * T;
        angle = thMax * Math.sin(Math.sqrt(gB / Lb) * tt);
        bx = pivot2.x + Math.sin(angle) * Lb;
        by = pivot2.y - Math.cos(angle) * Lb;
        bpBob.position.set(bx, by, 0);
        // 子弹嵌入摆锤、沿摆绳切向拖于后侧随摆共动（不再直接 hidden）
        const embed = 0.3;
        ball1.position.set(bx - Math.cos(angle) * embed, by - Math.sin(angle) * embed, 0);
      }
      const arr = (bpCordGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
      arr[0] = pivot2.x; arr[1] = pivot2.y; arr[2] = 0;
      arr[3] = bpBob.position.x; arr[4] = bpBob.position.y; arr[5] = 0;
      (bpCordGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
      const curH = Lb * (1 - Math.cos(angle));
      const fr = Math.floor(t * 6);
      if (fr !== lastBalFrame) { lastBalFrame = fr; drawBalistic(curH); }
    }
    if (chair) {
      // 手臂收回/伸出 → I 变化 → ω 反向变化（L 守恒）
      const cycle = (t % 10) / 10;
      const r = cycle < 0.5 ? 1.7 - (cycle / 0.5) * 1.0 : 0.7 + ((cycle - 0.5) / 0.5) * 1.0;
      weights[0].position.x = -r;
      weights[1].position.x = r;
      const I = 1.2 + r * r * 1.4;
      const omega = 8.0 / I;
      chairGroup.rotation.y += dt * omega;
      seat.rotation.y = chairGroup.rotation.y;
    }
    void t;
  };
}

/** P469 受迫振动与共振峰 / P64 受迫振动与共振：扫频 → 共振曲线 */
function build_forced(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const peak = title.includes('共振峰');
  // P64 受迫振动与共振（无"峰"字）与 P469 共振峰共享本实现：峰越尖 Q 越大
  const sharp = peak;
  void sharp;
  const wall = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.3, 3.2, 1.1)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x475569 })),
  );
  wall.position.set(-5.6, 1.2, 0);
  g.add(wall);
  const mass = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(1.0, 1.0, 1.0)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.amber, roughness: 0.4 })),
  );
  g.add(mass);
  const coilGeo = bag.geo(new THREE.BufferGeometry());
  coilGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(150 * 3), 3));
  const coil = new THREE.Line(coilGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan })));
  g.add(coil);
  const driver = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.42, 0.42, 1.1, 20)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.pink, roughness: 0.4 })),
  );
  driver.rotation.z = Math.PI / 2;
  g.add(driver);
  // 驱动力方向箭头
  const forceArrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(-5.0, 2.6, 0), 1.4, PAL.pink, 0.22, 0.11,
  );
  g.add(forceArrow);

  // 共振曲线画布
  const cv = document.createElement('canvas');
  cv.width = 340; cv.height = 300;
  const c2 = cv.getContext('2d')!;
  const tex = bag.tex(new THREE.CanvasTexture(cv));
  const plot = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(4.2, 3.7)),
    bag.mat(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false })),
  );
  plot.position.set(6.6, 1.8, 0);
  plot.renderOrder = 997;
  g.add(plot);

  // 相频响应画布：φ(ω) = arctan(2βω/(ω₀²−ω²))，落实 concept 承诺的"相位翻转 0→π/2→π"
  const phCv = document.createElement('canvas');
  phCv.width = 340; phCv.height = 190;
  const phC2 = phCv.getContext('2d')!;
  const phTex = bag.tex(new THREE.CanvasTexture(phCv));
  const phPlane = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(4.2, 2.35)),
    bag.mat(new THREE.MeshBasicMaterial({ map: phTex, transparent: true, depthTest: false })),
  );
  phPlane.position.set(6.6, -1.7, 0);
  phPlane.renderOrder = 997;
  g.add(phPlane);

  // 二次分支：P469 强调"共振峰"的峰形/Q；P64 强调共振现象本身与相位、功率
  g.add(panelSprite(THREE, bag, peak ? [
    { text: '受迫振动稳态 x = X₀cos(ωt−φ)，X₀ = F₀/[m√((ω₀²−ω²)²+4β²ω²)]', color: '#f8fafc' },
    { text: '共振峰 ω_r = √(ω₀²−2β²)，峰高 X_max ≈ F₀/(2mβω₀)', color: '#94a3b8' },
    { text: 'Q = ω₀/(2β) 决定峰宽 Δω ≈ ω₀/Q：高 Q → 尖锐共振峰', color: '#fbbf24' },
    { text: '相频 φ(ω) = arctan(2βω/(ω₀²−ω²))：过共振 φ 由 0 快速翻转到 π（见下画布）', color: '#22c55e' },
  ] : [
    { text: '受迫振动与共振：mẍ + 2mβẋ + kx = F₀cos(ωt)', color: '#f8fafc' },
    { text: 'ω ≈ ω₀ 时振幅最大（共振；阻尼小时，严格峰值 ω_r = √(ω₀²−2β²)）', color: '#94a3b8' },
    { text: '相位滞后 φ 从 0 → π/2 → π；共振时驱动力与速度同相，P = F₀v₀/2 达最大', color: '#22c55e' },
    { text: '相频曲线与实时 φ 读数见下图（φ = arctan(2βω/(ω₀²−ω²))）', color: '#06b6d4' },
  ].concat(sharp ? [{ text: '扫描越慢、Q 越高 → 共振峰越尖锐（半高宽 Δω = ω₀/Q）', color: '#fbbf24' }] : []), [0, 4.6, 0], 8.0, 'center'));

  const w0 = 3.0;
  const beta = 0.26;
  let x = 0, v = 0;
  let acc = 0;
  let lastBucket = -1;
  let lastPhBucket = -1;
  let phiCur = Math.PI / 2;   // 当前相位差 φ（初值 ω=ω₀ → π/2）
  function drawRes(wd: number): void {
    const W = 340, H = 300;
    c2.clearRect(0, 0, W, H);
    c2.fillStyle = 'rgba(7,11,20,0.88)'; c2.fillRect(0, 0, W, H);
    c2.strokeStyle = '#334155'; c2.lineWidth = 3; c2.strokeRect(1.5, 1.5, W - 3, H - 3);
    c2.strokeStyle = '#475569'; c2.lineWidth = 2;
    c2.beginPath(); c2.moveTo(46, 20); c2.lineTo(46, H - 42); c2.lineTo(W - 14, H - 42); c2.stroke();
    c2.fillStyle = '#94a3b8'; c2.font = '16px sans-serif'; c2.textAlign = 'center';
    c2.fillText('振幅 X(ω)', 28, 34); c2.fillText('驱动频率 ω', W / 2, H - 12);
    [0.1, 0.26, 0.6].forEach((bb, i) => {
      c2.strokeStyle = ['#64748b', '#f59e0b', '#06b6d4'][i];
      c2.lineWidth = i === 1 ? 4 : 2;
      c2.beginPath();
      for (let k = 0; k <= 150; k++) {
        const w = 0.3 + (k / 150) * 4.7;
        const X = 1 / Math.sqrt((w0 * w0 - w * w) ** 2 + 4 * bb * bb * w * w);
        const px = 46 + ((w - 0.3) / 4.7) * (W - 64);
        const py = (H - 42) - Math.min(1, X / 4.2) * (H - 74);
        if (k === 0) c2.moveTo(px, py); else c2.lineTo(px, py);
      }
      c2.stroke();
      c2.fillStyle = ['#64748b', '#f59e0b', '#06b6d4'][i];
      c2.fillText(`β=${bb}`, 58 + i * 84, 52);
    });
    const px = 46 + ((wd - 0.3) / 4.7) * (W - 64);
    c2.strokeStyle = '#f8fafc'; c2.setLineDash([5, 5]);
    c2.beginPath(); c2.moveTo(px, 20); c2.lineTo(px, H - 42); c2.stroke();
    c2.setLineDash([]);
    c2.fillStyle = '#f8fafc'; c2.fillText(`ω=${wd.toFixed(2)}`, Math.min(W - 52, px + 44), 82);
    c2.textAlign = 'left'; c2.font = '15px sans-serif';
    c2.fillText(`ω₀=${w0.toFixed(1)}  ω_r=${Math.sqrt(Math.max(0, w0 * w0 - 2 * beta * beta)).toFixed(2)}`, 50, H - 58);
    tex.needsUpdate = true;
  }
  drawRes(w0);

  // 相频曲线：φ(ω) 由 0（ω≪ω₀，力与位移同相）连续升至 π/2（ω=ω₀）再趋 π（ω≫ω₀，反相）
  //   用 φ = atan2(2βω, ω₀²−ω²) 取主值 [0,π]，避免 arctan 在 ω=ω₀ 处的 ±π/2 跳变
  function drawPhase(wd: number, phi: number): void {
    const W = 340, H = 190;
    phC2.clearRect(0, 0, W, H);
    phC2.fillStyle = 'rgba(7,11,20,0.88)'; phC2.fillRect(0, 0, W, H);
    phC2.strokeStyle = '#334155'; phC2.lineWidth = 3; phC2.strokeRect(1.5, 1.5, W - 3, H - 3);
    phC2.strokeStyle = '#475569'; phC2.lineWidth = 2;
    phC2.beginPath(); phC2.moveTo(46, 24); phC2.lineTo(46, H - 36); phC2.lineTo(W - 14, H - 36); phC2.stroke();
    phC2.fillStyle = '#94a3b8'; phC2.font = '15px sans-serif'; phC2.textAlign = 'center';
    phC2.fillText('相位差 φ', 28, 40); phC2.fillText('驱动频率 ω', W / 2, H - 10);
    phC2.textAlign = 'left'; phC2.font = '13px sans-serif';
    phC2.fillText('π', 30, 30); phC2.fillText('π/2', 24, (24 + H - 36) / 2 + 4); phC2.fillText('0', 36, H - 33);
    phC2.strokeStyle = '#22c55e'; phC2.lineWidth = 3; phC2.beginPath();
    for (let k = 0; k <= 150; k++) {
      const w = 0.3 + (k / 150) * 4.7;
      const phiW = Math.atan2(2 * beta * w, w0 * w0 - w * w);
      const px = 46 + ((w - 0.3) / 4.7) * (W - 64);
      const py = (H - 36) - (phiW / Math.PI) * (H - 60);
      if (k === 0) phC2.moveTo(px, py); else phC2.lineTo(px, py);
    }
    phC2.stroke();
    const px2 = 46 + ((wd - 0.3) / 4.7) * (W - 64);
    const py2 = (H - 36) - (phi / Math.PI) * (H - 60);
    phC2.strokeStyle = '#f8fafc'; phC2.setLineDash([5, 5]);
    phC2.beginPath(); phC2.moveTo(px2, 24); phC2.lineTo(px2, H - 36); phC2.stroke();
    phC2.setLineDash([]);
    phC2.fillStyle = '#f8fafc'; phC2.beginPath(); phC2.arc(px2, py2, 5, 0, 7); phC2.fill();
    phC2.textAlign = 'left'; phC2.font = '15px sans-serif'; phC2.fillStyle = '#22c55e';
    phC2.fillText(`ω=${wd.toFixed(2)}  φ=${phi.toFixed(2)} rad (${(phi * 180 / Math.PI).toFixed(0)}°)`, 50, 46);
    phTex.needsUpdate = true;
  }
  drawPhase(w0, phiCur);

  return (t: number, dt: number) => {
    // 驱动频率缓慢扫过共振区
    const wd = 1.2 + 3.0 * (Math.sin(t * 0.25) * 0.5 + 0.5);
    const F = 7.0;
    acc += Math.min(dt, 0.05);
    const h = 1 / 600;
    let guard = 0;
    while (acc >= h && guard++ < 160) {
      const a = F * Math.cos(wd * t) - 2 * beta * v - w0 * w0 * x;
      v += a * h;
      x += v * h;
      acc -= h;
    }
    const px = x + 1.0;
    mass.position.set(px, 1.2, 0);
    driver.position.set(px + 1.6, 1.2, 0);
    const arr = (coilGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    for (let i = 0; i < 150; i++) {
      const u = i / 149;
      arr[i * 3] = -5.4 + u * (px - 0.5 + 5.4);
      arr[i * 3 + 1] = 1.2 + Math.sin(u * Math.PI * 22) * 0.32 * Math.sin(u * Math.PI);
      arr[i * 3 + 2] = 0;
    }
    (coilGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    // 驱动力箭头：长度∝力大小、方向随力符号翻转（ω>ω₀ 相位差越过 π/2 → 力与位移反相）
    const driveF = Math.cos(wd * t);
    forceArrow.setDirection(new THREE.Vector3(driveF >= 0 ? 1 : -1, 0, 0));
    forceArrow.setLength(0.6 + 1.4 * Math.abs(driveF), 0.22, 0.11);
    // 与位移 x = X₀cos(ωt−φ) 同源的稳态相位差 φ(ω) = atan2(2βω, ω₀²−ω²) ∈ [0,π]
    phiCur = Math.atan2(2 * beta * wd, w0 * w0 - wd * wd);
    const bucket = Math.round(wd * 14);
    if (bucket !== lastBucket) { lastBucket = bucket; drawRes(wd); }
    const phBucket = Math.round(wd * 10);
    if (phBucket !== lastPhBucket) { lastPhBucket = phBucket; drawPhase(wd, phiCur); }
  };
}

/** P480 陀螺进动与章动 */
function build_gyro(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const stand = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.24, 0.6, 0.6, 20)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.4, roughness: 0.6 })),
  );
  stand.position.set(0, -3.0, 0);
  g.add(stand);
  // 陀螺本体（局部坐标系）
  const gyro = new THREE.Group();
  gyro.position.set(0, -0.8, 0);
  g.add(gyro);
  const disc = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(1.3, 1.3, 0.34, 44)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, metalness: 0.55, roughness: 0.3 })),
  );
  gyro.add(disc);
  // 自转标记（观察高速自转）
  const spinMark = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(1.2, 0.12, 0.14)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, emissive: 0xb91c1c, emissiveIntensity: 0.4 })),
  );
  spinMark.position.y = 0.2;
  gyro.add(spinMark);
  const shaft = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.09, 0.09, 4.4, 12)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.slate })),
  );
  gyro.add(shaft);
  // 重力箭头
  const grav = new THREE.ArrowHelper(
    new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 2.2, 0), 1.8, PAL.slate, 0.2, 0.1,
  );
  g.add(grav);
  // 进动圆
  const precRing = new THREE.Mesh(
    bag.geo(new THREE.TorusGeometry(2.3, 0.03, 6, 84)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.75 })),
  );
  precRing.rotation.x = Math.PI / 2;
  precRing.position.y = 1.6;
  g.add(precRing);
  // 轴尖章动轨迹
  const nutGeo = bag.geo(new THREE.BufferGeometry());
  nutGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(320 * 3), 3));
  const nutLine = new THREE.Line(nutGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.pink })));
  g.add(nutLine);

  g.add(panelSprite(THREE, bag, [
    { text: '进动角速度 Ω = Mgl/(I₃ω₃) = mgr/(I₃ω₃)，重力矩 ⊥ 自转角动量', color: '#f8fafc' },
    { text: '章动：轴在进动圆上的小幅上下振荡（粉线 = 轴尖轨迹）', color: '#94a3b8' },
    { text: '盘 I = ½MR²；自转越快 → 进动越慢（Ω ∝ 1/ω）', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.0, 'center'));

  let spinAng = 0;   // 自转累计角
  let psi = 0;       // 进动累计角（由 Ω 积分而来）
  const TRAIL = 320;
  const hist: number[] = [];   // 轴尖世界坐标轨迹缓冲 (x,y,z)
  return (t: number, dt: number) => {
    const step = Math.min(dt, 0.05);
    // 自转速率缓变（26·[0.2,1.8]）→ 演示面板所述 Ω ∝ 1/ω：自转越快进动越慢
    const spinSpeed = 26 * (1 + 0.8 * Math.sin(t * 0.2));
    const omegaPrec = 0.8 * 26 / spinSpeed;   // 基准 spin=26 时 Ω=0.8，且与自转严格反比
    spinAng += step * spinSpeed;
    psi += step * omegaPrec;
    const nut = 0.14 * Math.sin(t * 3.0); // 章动
    const tilt = 0.5 + nut;               // 倾角 θ
    gyro.rotation.set(0, 0, 0);
    gyro.rotation.y = psi;
    gyro.rotation.z = tilt;
    disc.rotation.y = spinAng;
    spinMark.rotation.y = spinAng;
    // 轴尖（局部 +Y 半长 2.2）世界坐标 = gyro 位置 + 同序欧拉旋转，与刚体完全同源
    const tip = new THREE.Vector3(0, 2.2, 0);
    tip.applyEuler(new THREE.Euler(0, psi, tilt));
    tip.add(gyro.position);
    hist.push(tip.x, tip.y, tip.z);
    while (hist.length > TRAIL * 3) hist.splice(0, 3);
    const arr = (nutGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    const n = hist.length / 3;
    for (let i = 0; i < TRAIL; i++) {
      const j = (i < n ? i : n - 1) * 3;
      arr[i * 3] = hist[j];
      arr[i * 3 + 1] = hist[j + 1];
      arr[i * 3 + 2] = hist[j + 2];
    }
    (nutGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    precRing.scale.setScalar(Math.sin(tilt));
  };
}

/** P468 振动合成与李萨如图形 */
function build_lissajous(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const N = 420;
  const geo = bag.geo(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const curve = new THREE.Line(geo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan })));
  g.add(curve);
  // 参考方框
  const frame = new THREE.Line(
    bag.geo(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-3.2, -2.6, 0), new THREE.Vector3(3.2, -2.6, 0),
      new THREE.Vector3(3.2, 2.6, 0), new THREE.Vector3(-3.2, 2.6, 0),
      new THREE.Vector3(-3.2, -2.6, 0),
    ])),
    bag.mat(new THREE.LineBasicMaterial({ color: 0x334155 })),
  );
  g.add(frame);
  // 两个正交谐振子的振子标尺
  const knobX = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.9, 0.16, 0.3)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.amber, emissive: 0xb45309, emissiveIntensity: 0.3 })),
  );
  g.add(knobX);
  const knobY = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.16, 0.9, 0.3)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.pink, emissive: 0xbe185d, emissiveIntensity: 0.3 })),
  );
  g.add(knobY);
  const dotX = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.16, 12, 10)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold })),
  );
  g.add(dotX);
  const dotY = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.16, 12, 10)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.pink })),
  );
  g.add(dotY);
  const dotMain = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.2, 14, 12)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.white })),
  );
  g.add(dotMain);

  const two = title.includes('李萨如');
  g.add(panelSprite(THREE, bag, [
    { text: 'x = A₁sin(ω₁t+δ₁)，y = A₂sin(ω₂t+δ₂) → 李萨如图形', color: '#f8fafc' },
    { text: '图形身份由频率比 ωₓ:ω_ʏ 与相位差 δ 共同决定；实时读出于下方画布', color: '#94a3b8' },
    { text: '1:1 且 δ=0 退化为直线、δ=π/2 为椭圆/圆；δ≠0 时开口方向随 δ 变化', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.0, 'center'));

  const wx = 1.0;   // x 方向固定基频；改变比率即改 wy（见组合表）
  // 组合表：循环切换频率比与相位差 → 落实 concept「身份由比值与相位决定」（相位/频率比判图）
  const combos = [
    { wy: 1.0, delta: 0 },
    { wy: 1.0, delta: Math.PI / 2 },
    { wy: 1.0, delta: Math.PI / 4 },
    { wy: two ? 2.0 : 1.5, delta: 0.6 },
    { wy: 1.5, delta: 0 },
  ];
  const comboT = 5;
  // 实时读出的当前频率比与相位差（判图参数）
  const cvW = document.createElement('canvas');
  cvW.width = 340; cvW.height = 96;
  const c2W = cvW.getContext('2d')!;
  const texW = bag.tex(new THREE.CanvasTexture(cvW));
  const planeW = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(4.4, 1.24)),
    bag.mat(new THREE.MeshBasicMaterial({ map: texW, transparent: true, depthTest: false })),
  );
  planeW.position.set(4.6, -3.6, 0);
  planeW.renderOrder = 997;
  g.add(planeW);
  let lastFrame = -1;
  return (t: number) => {
    const seg = Math.floor(t / comboT) % combos.length;
    const c = combos[seg];
    const wy = c.wy;
    // 段内相位缓慢扫描（δ 连续变化）→ 整条图形平滑变形；换段则切换频率比
    const delta = c.delta + (t % comboT) * 0.4;
    const x = 2.6 * Math.sin(wx * t);
    const y = 2.1 * Math.sin(wy * t + delta);
    const arr = (geo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    for (let i = 0; i <= N; i++) {
      const tt = t - (N - i) * 0.018;
      arr[i * 3] = 2.6 * Math.sin(wx * tt);
      arr[i * 3 + 1] = 2.1 * Math.sin(wy * tt + delta);
      arr[i * 3 + 2] = -0.4;
    }
    (geo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    dotMain.position.set(x, y, 0);
    dotX.position.set(x, -2.6, 0);
    dotY.position.set(-3.2, y, 0);
    knobX.position.set(x, -2.9, 0);
    knobY.position.set(-3.5, y, 0);
    const fr = Math.floor(t * 5);
    if (fr !== lastFrame) {
      lastFrame = fr;
      const ra = Math.round(wx * 100) / 100, rb = Math.round(wy * 100) / 100;
      const g1 = (a: number, b: number): number => b === 0 ? a : g1(b, a % b);
      const g0 = g1(Math.round(ra * 10), Math.round(rb * 10)) / 10 || 1;
      c2W.clearRect(0, 0, 340, 96);
      c2W.fillStyle = 'rgba(7,11,20,0.85)'; c2W.fillRect(0, 0, 340, 96);
      c2W.strokeStyle = '#334155'; c2W.lineWidth = 3; c2W.strokeRect(1.5, 1.5, 337, 93);
      c2W.textAlign = 'left'; c2W.font = '20px sans-serif'; c2W.fillStyle = '#f8fafc';
      c2W.fillText(`频率比 ωₓ:ω_ʏ = ${ra / g0}:${rb / g0}`, 16, 34);
      c2W.fillStyle = '#fbbf24';
      c2W.fillText(`相位差 δ = ${delta.toFixed(2)} rad (${(delta * 180 / Math.PI).toFixed(0)}°)`, 16, 68);
      texW.needsUpdate = true;
    }
  };
}

/** P478 哈密顿方程与相空间 / P542 极限环与分岔 / P541 相平面与稳定性分析 */
function build_phasespace(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const limitCycle = title.includes('极限环') || title.includes('分岔');
  const stability = title.includes('稳定性') || title.includes('相平面');
  // P478 哈密顿方程与相空间：显式识别（默认形态，亦为未命中其它关键词时的回退）
  const hamilton = title.includes('哈密顿') || (!limitCycle && !stability);

  // 相平面画布
  const cv = document.createElement('canvas');
  cv.width = 360; cv.height = 360;
  const c2 = cv.getContext('2d')!;
  const tex = bag.tex(new THREE.CanvasTexture(cv));
  const plot = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(6.4, 6.4)),
    bag.mat(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false })),
  );
  plot.position.set(-4.8, 0.6, 0);
  plot.renderOrder = 997;
  g.add(plot);

  // 3D 相空间曲线（x, v, t 推进）—— 哈密顿流
  const flowGeo = bag.geo(new THREE.BufferGeometry());
  flowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(260 * 3), 3));
  const flowLine = new THREE.Line(flowGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan })));
  g.add(flowLine);
  // 相流粒子（多个起点）
  const NP = 14;
  const pGeo = bag.geo(new THREE.BufferGeometry());
  pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  const points = new THREE.Points(
    pGeo,
    bag.mat(new THREE.PointsMaterial({ color: PAL.gold, size: 0.24, sizeAttenuation: true })),
  );
  g.add(points);
  const states: { x: number; v: number }[] = [];
  if (stability) {
    // 双阱动力学分型演示：左/右势阱极小各一簇 → 闭合轨道（中心），原点鞍点附近一簇 → 分离（不稳定）
    const wells = [{ q: -0.7071 }, { q: 0.7071 }, { q: 0.02 }];
    for (let i = 0; i < NP; i++) {
      const st0 = wells[i % wells.length];
      const th = (i / NP) * Math.PI * 2;
      const rr = 0.2 + (i % 3) * 0.06;
      states.push({ x: st0.q + Math.cos(th) * rr, v: Math.sin(th) * rr * 0.8 });
    }
  } else {
    for (let i = 0; i < NP; i++) {
      const th = (i / NP) * Math.PI * 2;
      states.push({ x: 1.8 * Math.cos(th), v: 1.8 * Math.sin(th) });
    }
  }

  // 二次分支：P478 哈密顿（相流+椭圆轨道） / P542 极限环与分岔 / P541 相平面与稳定性
  g.add(panelSprite(THREE, bag, limitCycle ? [
    { text: '极限环：非线性系统存在孤立闭轨（范德波尔：ẍ−μ(1−x²)ẋ+x=0）', color: '#f8fafc' },
    { text: 'Hopf 分岔：参数过临界值时稳定焦点失稳 → 长出极限环', color: '#94a3b8' },
    { text: '环上振幅自持：能量输入与耗散在一周内平衡', color: '#fbbf24' },
    { text: '本演示令阻尼系数 μ 随时间缓慢扫过零（亚/超临界霍普夫，见画布实时 μ 与振幅）', color: '#22c55e' },
  ] : stability ? [
    { text: '相平面 (q, q̇)：不动点由 q̇ = 0 与 q̈ = 0 同时确定', color: '#f8fafc' },
    { text: 'Jacobian 特征值：Re(λ)<0 稳定（焦点/结点），异号 → 鞍点', color: '#94a3b8' },
    { text: '势 U(q) 极小 → 稳定；极大 → 不稳定（下图为双阱 U = q⁴−q²）', color: '#22c55e' },
    { text: '相流按 q̈=−U′(q)=2q−4q³ 积分（与双阱图同源）：绿心=中心稳定、红点=原点鞍点', color: '#06b6d4' },
  ] : [
    { text: '哈密顿方程 q̇ = ∂H/∂p，ṗ = −∂H/∂q', color: '#f8fafc' },
    { text: '刘维尔定理：相空间体积守恒，流不收缩也不发散', color: '#94a3b8' },
    { text: '谐振子 H = p²/2m + ½mω²q² → (q,p) 平面上同心椭圆', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.0, 'center'));

  // 谐振子公频：哈密顿精确流 (q̇=v, v̇=−ω²q) 与阻尼分支共用同一 ω（H 读数与椭圆轨道同源）
  const w = 2.0;
  let muNow = 0;   // 极限环分支当前阻尼系数 μ（随时间扫描，供画布读数）

  function drawPhase(q: number, v: number): void {
    const W = 360;
    c2.clearRect(0, 0, W, W);
    c2.fillStyle = 'rgba(7,11,20,0.88)'; c2.fillRect(0, 0, W, W);
    c2.strokeStyle = '#334155'; c2.lineWidth = 3; c2.strokeRect(1.5, 1.5, W - 3, W - 3);
    c2.strokeStyle = '#475569'; c2.lineWidth = 2;
    c2.beginPath();
    c2.moveTo(38, W / 2); c2.lineTo(W - 16, W / 2);
    c2.moveTo(W / 2, 24); c2.lineTo(W / 2, W - 34);
    c2.stroke();
    c2.fillStyle = '#94a3b8'; c2.font = '17px sans-serif'; c2.textAlign = 'center';
    c2.fillText('q', W - 24, W / 2 - 8);
    c2.fillText('p / q̇', W / 2 + 34, 36);
    const cx = W / 2, cy = W / 2, R = 128;
    if (limitCycle) {
      // 极限环
      c2.strokeStyle = '#f59e0b'; c2.lineWidth = 5; c2.beginPath();
      for (let i = 0; i <= 160; i++) {
        const ph = (i / 160) * Math.PI * 2;
        const px = cx + Math.cos(ph) * R * 0.7;
        const py = cy + Math.sin(ph) * R * 0.7;
        if (i === 0) c2.moveTo(px, py); else c2.lineTo(px, py);
      }
      c2.stroke();
      // 内部螺旋外扩至环
      c2.strokeStyle = '#06b6d4'; c2.lineWidth = 3; c2.beginPath();
      for (let i = 0; i <= 200; i++) {
        const u = i / 200;
        const r = R * (0.16 + 0.54 * u);
        const ph = u * Math.PI * 4.5;
        const px = cx + Math.cos(ph) * r * 0.7;
        const py = cy + Math.sin(ph) * r * 0.7;
        if (i === 0) c2.moveTo(px, py); else c2.lineTo(px, py);
      }
      c2.stroke();
      // 外部螺旋收缩至环
      c2.strokeStyle = '#22c55e'; c2.lineWidth = 3; c2.beginPath();
      for (let i = 0; i <= 200; i++) {
        const u = i / 200;
        const r = R * (1.36 - 0.66 * u);
        const ph = u * Math.PI * 4.5 + 1.4;
        const px = cx + Math.cos(ph) * r * 0.7;
        const py = cy + Math.sin(ph) * r * 0.7;
        if (i === 0) c2.moveTo(px, py); else c2.lineTo(px, py);
      }
      c2.stroke();
      c2.textAlign = 'left'; c2.font = '16px sans-serif';
      c2.fillStyle = '#f59e0b'; c2.fillText('橙 = 极限环（孤立闭轨）', 44, W - 82);
      c2.fillStyle = '#06b6d4'; c2.fillText('青 = 环内螺旋外扩', 44, W - 58);
      c2.fillStyle = '#22c55e'; c2.fillText('绿 = 环外螺旋收缩', 44, W - 34);
      c2.fillStyle = '#94a3b8'; c2.fillText(`实时 μ = ${muNow.toFixed(2)}（${muNow > 0 ? '正阻尼→螺旋内收' : '负阻尼→自激外扩'}）  r = √(q²+q̇²) = ${Math.hypot(q, v).toFixed(2)}`, 44, 52);
    } else if (stability) {
      // 双阱势
      c2.strokeStyle = '#22c55e'; c2.lineWidth = 4; c2.beginPath();
      for (let i = 0; i <= 150; i++) {
        const qq = -1.8 + (i / 150) * 3.6;
        const U = qq * qq * qq * qq - qq * qq;
        const px = cx + qq * 62;
        const py = W - 44 - (U + 0.4) * 62;
        if (i === 0) c2.moveTo(px, py); else c2.lineTo(px, py);
      }
      c2.stroke();
      // 鞍点附近的流形
      c2.strokeStyle = '#f472b6'; c2.lineWidth = 3;
      for (let s = 0; s < 4; s++) {
        c2.beginPath();
        for (let i = 0; i <= 70; i++) {
          const u = -1.7 + (i / 70) * 3.4;
          const sx = (s < 2 ? 1 : -1) * u;
          const sy = (s % 2 ? 1 : -1) * Math.tanh(u * 1.7);
          const px = cx + sx * 62;
          const py = cy - sy * 62;
          if (i === 0) c2.moveTo(px, py); else c2.lineTo(px, py);
        }
        c2.stroke();
      }
      // 不动点标注：中心（±1/√2, 0 势阱极小，稳定）与鞍点（原点势极大，不稳定）
      const fp: { qq: number; col: string; lb: string }[] = [
        { qq: -0.7071, col: '#22c55e', lb: '中心' },
        { qq: 0.7071, col: '#22c55e', lb: '中心' },
        { qq: 0, col: '#ef4444', lb: '鞍点' },
      ];
      fp.forEach((f) => {
        c2.fillStyle = f.col; c2.beginPath();
        c2.arc(cx + f.qq * 62, cy, 6, 0, 7); c2.fill();
        c2.font = '13px sans-serif'; c2.textAlign = 'center'; c2.fillText(f.lb, cx + f.qq * 62, cy - 11);
      });
      c2.textAlign = 'left'; c2.font = '16px sans-serif';
      c2.fillStyle = '#22c55e'; c2.fillText('绿 = 双阱极小 q=±1/√2 → 中心（闭轨稳定）', 44, W - 78);
      c2.fillStyle = '#ef4444'; c2.fillText('红 = 原点势极大 → 鞍点（不稳定）', 44, W - 56);
      c2.fillStyle = '#f472b6'; c2.fillText('粉 = 鞍点分离线', 44, W - 34);
      const Ew = 0.5 * v * v + q * q * q * q - q * q;
      c2.fillStyle = '#94a3b8'; c2.fillText(`当前 (q,q̇)=(${q.toFixed(2)}, ${v.toFixed(2)})  E=½q̇²+U=${Ew.toFixed(2)}`, 44, 52);
    } else {
      // 哈密顿谐振子：同心椭圆 v² + ω²q² = 2H（轴比 1:ω，与粒子精确流和 H 读数同源）
      const sc = R / 1.8; // 相平面标尺：q=1.8 ↔ 像素半径 R（v 方向按 1/ω 压缩）
      [0.35, 0.68, 1.0].forEach((rr, i) => {
        c2.strokeStyle = ['#64748b', '#06b6d4', '#f59e0b'][i];
        c2.lineWidth = i === 2 ? 4 : 2;
        c2.beginPath();
        for (let k = 0; k <= 150; k++) {
          const ph = (k / 150) * Math.PI * 2;
          const px = cx + Math.cos(ph) * R * rr;
          const py = cy - Math.sin(ph) * (R * rr) / w;
          if (k === 0) c2.moveTo(px, py); else c2.lineTo(px, py);
        }
        c2.stroke();
        // 流向标记（沿切线的小箭头点，落在椭圆上）
        const ph2 = 0.8 + i * 1.1;
        c2.fillStyle = '#f8fafc';
        c2.beginPath();
        c2.arc(cx + Math.cos(ph2) * R * rr, cy - Math.sin(ph2) * (R * rr) / w, 6, 0, 7);
        c2.fill();
      });
      // 当前能量轨道：由实时 (q,v) 反算半轴；H 守恒 → 闭轨，粒子金点始终走在其上（不收缩）
      const aq = Math.sqrt(q * q + (v * v) / (w * w)) * sc;
      c2.strokeStyle = '#fbbf24';
      c2.lineWidth = 2;
      c2.beginPath();
      c2.ellipse(cx, cy, aq, aq / w, 0, 0, Math.PI * 2);
      c2.stroke();
      c2.fillStyle = '#fbbf24';
      c2.beginPath();
      c2.arc(cx + q * sc, cy - (v * sc) / w, 5, 0, 7);
      c2.fill();
      c2.textAlign = 'left'; c2.font = '16px sans-serif';
      c2.fillStyle = '#f59e0b'; c2.fillText('橙 = 当前能量轨道 v²+ω²q²=2H（轴比 1:ω）', 44, W - 60);
      c2.fillStyle = '#06b6d4'; c2.fillText('点 = 相流方向 (∂H/∂p, −∂H/∂q)，金点随粒子走', 44, W - 36);
      c2.fillStyle = '#94a3b8'; c2.fillText(`H ≈ ${(v * v + w * w * q * q) / 2.0}`, 44, 52);
    }
    tex.needsUpdate = true;
  }
  drawPhase(1.2, 0.6);

  let lastFrame = -1;
  return (t: number, dt: number) => {
    const step = Math.min(dt, 0.05);
    const arr = (pGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    // 极限环分支：阻尼系数 μ 随时间缓慢扫过零 → 亚/超临界霍普夫分岔（μ=0 为临界）
    const muScan = limitCycle ? -0.35 + 1.15 * (0.5 + 0.5 * Math.sin(t * 0.15)) : 0;
    muNow = muScan;
    states.forEach((s, i) => {
      if (hamilton) {
        // 哈密顿分支：谐振子哈密顿流 q̇=∂H/∂p=v, ṗ=−∂H/∂q=−ω²q 的精确旋转映射，
        // v²+ω²q² 与相面积严格守恒（刘维尔定理：不收缩不发散），与画布椭圆/H 读数同源
        const ch = Math.cos(w * step), sh = Math.sin(w * step);
        const nx = s.x * ch + (s.v / w) * sh;
        s.v = -s.x * w * sh + s.v * ch;
        s.x = nx;
      } else if (limitCycle) {
        // 范德波尔型阻尼（系数 μ 随时间扫描过零）：μ<0 环内自激外扩、μ>0 环外收缩至孤立闭轨
        const r2 = s.x * s.x + s.v * s.v;
        const dv = -w * w * s.x + (muScan - r2) * 0.9 * s.v;
        s.v += dv * step;
        s.x += s.v * step;
      } else {
        // 稳定性分支：双阱势流 q̈=−U′(q)=2q−4q³（原点鞍点、±1/√2 中心），与所画双阱相图同源
        const dv = 2 * s.x - 4 * s.x * s.x * s.x;
        s.v += dv * step;
        s.x += s.v * step;
      }
      arr[i * 3] = s.x;
      arr[i * 3 + 1] = s.v;
      arr[i * 3 + 2] = 1.6;
    });
    (pGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;

    // 3D 相空间螺旋
    const tarr = (flowGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    const rr = (limitCycle || hamilton) ? 1.6 : 2.0;
    for (let i = 0; i < 260; i++) {
      const tt = t - (259 - i) * 0.03;
      tarr[i * 3] = rr * Math.cos(tt * 1.1) + 4.6;
      tarr[i * 3 + 1] = rr * Math.sin(tt * 1.1) * 0.8 + 0.6;
      tarr[i * 3 + 2] = -2.4 + (i / 260) * 4.8;
    }
    (flowGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;

    const fr = Math.floor(t * 8);
    if (fr !== lastFrame) { lastFrame = fr; drawPhase(states[0].x, states[0].v); }
    void hamilton;
  };
}

/** P472 角动量守恒的综合应用 / P471 转动惯量与平行轴定理 */
function build_rotation(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const parallel = title.includes('平行轴') || title.includes('转动惯量');
  // P472 角动量守恒的综合应用：显式识别（默认形态，亦为未命中时的回退）
  const angMom = title.includes('角动量守恒') || title.includes('综合应用') || !parallel;
  // 转台
  const disk = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(3.4, 3.4, 0.26, 60)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.3, roughness: 0.6 })),
  );
  disk.position.y = -1.6;
  g.add(disk);
  const hub = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.28, 0.28, 2.2, 20)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.slate })),
  );
  hub.position.y = -0.6;
  g.add(hub);
  // 径向杆 + 可移动质量块
  const rods: import('three').Mesh[] = [];
  const sliders: import('three').Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const rod = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(5.6, 0.14, 0.24)),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.slate })),
    );
    rod.position.y = -1.4;
    rod.rotation.y = (i / 4) * Math.PI * 2;
    g.add(rod);
    rods.push(rod);
    const m = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(0.6, 0.6, 0.6)),
      bag.mat(new THREE.MeshStandardMaterial({
        color: i % 2 ? PAL.cyan : PAL.amber, roughness: 0.4,
      })),
    );
    m.position.y = -1.1;
    g.add(m);
    sliders.push(m);
  }
  // 平行轴示意：偏移轴（虚线，几何置 x=0，用 position.x 表示与质心轴间距 d）与质心轴
  const offsetAxis = new THREE.Line(
    bag.geo(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -2.6, 0), new THREE.Vector3(0, 2.0, 0),
    ])),
    bag.mat(new THREE.LineDashedMaterial({ color: PAL.pink, gapSize: 0.2, dashSize: 0.3 })),
  );
  offsetAxis.computeLineDistances();
  offsetAxis.position.x = 2.6;
  g.add(offsetAxis);
  const cmAxis = new THREE.Line(
    bag.geo(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -2.6, 0), new THREE.Vector3(0, 2.6, 0),
    ])),
    bag.mat(new THREE.LineDashedMaterial({ color: PAL.green, gapSize: 0.2, dashSize: 0.3 })),
  );
  cmAxis.computeLineDistances();
  g.add(cmAxis);
  const cmMark = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.16, 12, 10)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.green })),
  );
  cmMark.position.set(2.6, 1.9, 0);
  g.add(cmMark);
  // 角动量箭头（沿轴）
  const LArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1.4, 0), 3.4, PAL.violet, 0.3, 0.14,
  );
  g.add(LArrow);

  // 二次分支：P471 转动惯量与平行轴定理 / P472 角动量守恒的综合应用
  g.add(panelSprite(THREE, bag, parallel ? [
    { text: '平行轴定理：I = I_cm + Md²（过质心轴 + 平移项）', color: '#f8fafc' },
    { text: '细杆绕中心 ₁⁄₁₂ML²，绕端点 ⅓ML²，差值恰为 M(L/2)²', color: '#94a3b8' },
    { text: '转盘 I_cm = ½MR²；偏移轴（粉）间距 d 随时间扫描 → I = I_cm + Md² 实时刷新', color: '#f472b6' },
    { text: '同扭矩 τ 下 α = τ/I：d↑ → I↑ → α↓（右侧读数与双轴间距 d 同源）', color: '#fbbf24' },
  ] : [
    { text: '角动量 L = Iω 守恒（合外力矩 Στ = 0）', color: '#f8fafc' },
    { text: 'I = Σmᵢrᵢ²：质量块外移 → I↑ → ω↓（紫箭头 L 不变）', color: '#94a3b8' },
    { text: '三个主惯量 I₁=I₂<I₃ 时绕 I₃ 轴转动稳定（网球拍定理）', color: '#22c55e' },
  ].concat(parallel ? [] : [{ text: '读数：L = Iω = 常量；ω 随质量块外移而下降', color: '#a78bfa' }]), [0, 4.6, 0], 8.0, 'center'));

  offsetAxis.visible = parallel;
  cmAxis.visible = parallel;
  cmMark.visible = parallel;

  // 平行轴分支：以转盘作刚体，恒定扭矩 τ 驱动，扫描偏移轴间距 d 并实时读出 I = I_cm + Md²（与双轴间距同源）
  const diskM = 2.0, diskR = 3.4;                 // 转盘质量、半径（diskR = CylinderGeometry 半径）
  const IcmDisk = 0.5 * diskM * diskR * diskR;    // 绕中心(质心)轴 I_cm = ½MR²
  const tauDrive = 24.0;                          // 恒定驱动力矩（示意单位）
  const parCv = document.createElement('canvas');
  parCv.width = 360; parCv.height = 240;
  const parC2 = parCv.getContext('2d')!;
  const parTex = bag.tex(new THREE.CanvasTexture(parCv));
  const parPlane = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(4.0, 2.67)),
    bag.mat(new THREE.MeshBasicMaterial({ map: parTex, transparent: true, depthTest: false })),
  );
  parPlane.position.set(6.3, 0.9, 0);
  parPlane.renderOrder = 997;
  parPlane.visible = parallel;
  g.add(parPlane);
  function drawPar(d: number, I: number, alpha: number, omega: number): void {
    const W = 360, H = 240;
    parC2.clearRect(0, 0, W, H);
    parC2.fillStyle = 'rgba(7,11,20,0.88)'; parC2.fillRect(0, 0, W, H);
    parC2.strokeStyle = '#334155'; parC2.lineWidth = 3; parC2.strokeRect(1.5, 1.5, W - 3, H - 3);
    parC2.textAlign = 'left';
    parC2.font = '15px sans-serif'; parC2.fillStyle = '#94a3b8';
    parC2.fillText('转盘 M=2kg·R=3.4m  I_cm=½MR²', 20, 30);
    parC2.font = '17px sans-serif'; parC2.fillStyle = '#f8fafc';
    parC2.fillText(`I_cm = ${IcmDisk.toFixed(2)} kg·m²`, 20, 62);
    parC2.fillStyle = '#f472b6';
    parC2.fillText(`偏移轴间距 d = ${d.toFixed(2)} m`, 20, 92);
    parC2.fillStyle = '#06b6d4';
    parC2.fillText(`Md² = ${(diskM * d * d).toFixed(2)} kg·m²`, 20, 122);
    parC2.fillStyle = '#fbbf24';
    parC2.fillText(`I = I_cm + Md² = ${I.toFixed(2)} kg·m²`, 20, 158);
    parC2.fillStyle = '#22c55e';
    parC2.fillText(`τ=${tauDrive.toFixed(0)} 恒定  α=τ/I=${alpha.toFixed(2)}`, 20, 190);
    parC2.fillText(`ω∝1/I 响应=${omega.toFixed(2)} rad/s`, 20, 216);
    parTex.needsUpdate = true;
  }
  let lastParFrame = -1;

  const Ltot = 7.0; // 角动量（守恒量）
  let spin = 0;
  return (t: number, dt: number) => {
    const step = Math.min(dt, 0.05);
    if (parallel) {
      // 平行轴分支：扫描偏移轴间距 d → I = I_cm + Md² 实时刷新；恒定扭矩 τ 下响应速率 ∝ α = τ/I（d↑→变慢）
      const d = 0.5 + 2.1 * (0.5 + 0.5 * Math.sin(t * 0.6));   // d ∈ [0.5, 2.6]
      offsetAxis.position.x = d;
      cmMark.position.x = d;
      const I = IcmDisk + diskM * d * d;             // Md² 项与偏移轴(粉)/质心轴(绿)间距 d 严格同源
      const alpha = tauDrive / I;                    // 同扭矩 τ 下 α = τ/I 随 I↑ 变小
      const omega = alpha * 0.5;                     // 演示缩放：外移使转动响应变慢
      spin += step * omega;
      disk.rotation.y = spin;
      hub.rotation.y = spin;
      rods.forEach((rod, i) => { rod.rotation.y = (i / 4) * Math.PI * 2 + spin; });
      sliders.forEach((m, i) => {
        const base = (i / 4) * Math.PI * 2 + spin;
        m.position.set(Math.cos(base) * 1.6, -1.1, Math.sin(base) * 1.6);
        m.rotation.y = spin;
      });
      const fr = Math.floor(t * 5);
      if (fr !== lastParFrame) { lastParFrame = fr; drawPar(d, I, alpha, omega); }
    } else {
      // 角动量守恒分支（P472）：质量块外移 → I↑ → ω↓，L = Iω 守恒（原逐帧逻辑，未改动）
      const shift = 1.1 + 1.3 * (Math.sin(t * 0.5) * 0.5 + 0.5);
      let I = 1.0;
      sliders.forEach((m, i) => {
        const r = shift * (i % 2 === 0 ? 1.0 : 1.45);
        const ang = (i / 4) * Math.PI * 2;
        m.position.x = Math.cos(ang) * r;
        m.position.z = Math.sin(ang) * r;
        m.position.y = -1.1;
        I += 1.2 * r * r + 0.3;
      });
      const omega = (Ltot / I) * 1.8;
      spin += dt * omega;
      disk.rotation.y = spin;
      hub.rotation.y = spin;
      rods.forEach((rod, i) => { rod.rotation.y = (i / 4) * Math.PI * 2 + spin; });
      // 质量块随杆转动
      sliders.forEach((m, i) => {
        const r = Math.hypot(m.position.x, m.position.z);
        const base = (i / 4) * Math.PI * 2 + spin;
        m.position.x = Math.cos(base) * r;
        m.position.z = Math.sin(base) * r;
        m.rotation.y = spin;
      });
      // 紫箭头代表守恒量 L → 保持构造长度恒定（ω 变化由转台转速呈现，避免图示与"紫箭头 L 不变"自相矛盾）
    }
    void angMom;
    void t;
  };
}
