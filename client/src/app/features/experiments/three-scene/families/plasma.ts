import type { SceneContext, SceneInstance } from '../types';
import { scaffold, panelSprite, PAL, ResourceBag } from './_common';

/**
 * 等离子体族（plasma）：托卡马克磁约束 / 德拜屏蔽 / 磁流体动力学 / 磁重联 / 惯性约束聚变。
 * 由 scene-registry 按 slug+variant 绑定：make(variant, title)。
 */
export function make(variant: string, title: string): (ctx: SceneContext) => SceneInstance {
  return (ctx) => scaffold(ctx, {
    title,
    camera: [0, 4, 14],
    build: (g, bag) => buildVariant(g, bag, ctx, variant),
  });
}

function buildVariant(
  g: import('three').Group,
  bag: ResourceBag,
  ctx: SceneContext,
  variant: string,
): (t: number, dt: number) => void {
  const { THREE } = ctx;
  switch (variant) {
    case 'debye': return debye(ctx, g, bag, THREE);
    case 'mhd': return mhd(ctx, g, bag, THREE);
    case 'reconnection': return reconnection(ctx, g, bag, THREE);
    case 'icf': return icf(ctx, g, bag, THREE);
    case 'tokamak':
    default: return tokamak(ctx, g, bag, THREE);
  }
}

/** 托卡马克：环形真空室 + 环向/极向场线圈 + 螺旋磁力线 + 等离子体环 */
function tokamak(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
) {
  const R0 = 4.2, r0 = 1.35;

  // 环形真空室（半透明）
  const vessel = new THREE.Mesh(
    bag.geo(new THREE.TorusGeometry(R0, r0, 20, 72)),
    bag.mat(new THREE.MeshStandardMaterial({
      color: 0x1e293b, transparent: true, opacity: 0.28, side: THREE.DoubleSide,
    })),
  );
  vessel.rotation.x = Math.PI / 2;
  g.add(vessel);

  // 等离子体环（发光）
  const plasma = new THREE.Mesh(
    bag.geo(new THREE.TorusGeometry(R0, r0 * 0.62, 16, 96)),
    bag.mat(new THREE.MeshStandardMaterial({
      color: 0x67e8f9, emissive: 0x0891b2, emissiveIntensity: 0.9,
      transparent: true, opacity: 0.75,
    })),
  );
  plasma.rotation.x = Math.PI / 2;
  g.add(plasma);

  // 环向场线圈（TF coils）
  const tfMat = bag.mat(new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5, metalness: 0.5 }));
  const tfGeo = bag.geo(new THREE.TorusGeometry(r0 + 0.75, 0.11, 8, 40));
  const NTF = 16;
  for (let i = 0; i < NTF; i++) {
    const a = (i / NTF) * Math.PI * 2;
    const m = new THREE.Mesh(tfGeo, tfMat);
    m.position.set(R0 * Math.cos(a), 0, R0 * Math.sin(a));
    // D 形线圈平面垂直于环向
    m.rotation.y = -a;
    m.rotation.x = Math.PI / 2;
    g.add(m);
  }

  // 极向场线圈（PF coils，水平环绕）
  const pfGeo = bag.geo(new THREE.TorusGeometry(R0, 0.09, 8, 72));
  const pfMat = bag.mat(new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.5, metalness: 0.4 }));
  [-2.1, -1.05, 1.05, 2.1].forEach((y) => {
    const m = new THREE.Mesh(pfGeo, pfMat);
    m.position.y = y;
    m.rotation.x = Math.PI / 2;
    const s = 1 - Math.abs(y) * 0.06;
    m.scale.setScalar(s);
    g.add(m);
  });

  // 螺旋磁力线（环向 + 极向合成）
  const q = 3.0; // 安全因子 q = (r B_φ)/(R B_θ)
  for (let n = 0; n < 5; n++) {
    const pts: import('three').Vector3[] = [];
    const off = (n / 5) * Math.PI * 2;
    for (let i = 0; i <= 400; i++) {
      const phi = (i / 400) * Math.PI * 2 * 2; // 2 个环向周
      const th = phi / q + off; // q = 3：每 3 个环向周才绕 1 个极向周（th = φ/q）
      const rr = r0 * 0.62;
      const R = R0 + rr * Math.cos(th);
      pts.push(new THREE.Vector3(R * Math.cos(phi), rr * Math.sin(th), R * Math.sin(phi)));
    }
    const l = new THREE.Line(
      bag.geo(new THREE.BufferGeometry().setFromPoints(pts)),
      bag.mat(new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.7 })),
    );
    g.add(l);
  }

  g.add(panelSprite(THREE, bag, [
    { text: '托卡马克：B = B_φ(环向) + B_θ(极向) → 螺旋磁力线', color: '#f8fafc' },
    { text: '安全因子 q(r) = rB_φ/(RB_θ)，q > 2 抑制扭曲模不稳定性', color: '#94a3b8' },
    { text: '点火须满足劳森判据（三重积）：nTτ ≳ 3×10²¹ s·m⁻³', color: '#94a3b8' },
    { text: '橙=环向场线圈 · 紫=极向场线圈 · 金=螺旋磁力线', color: '#fbbf24' },
  ], [0, 5.0, 0], 7.8, 'center'));

  ctx.camera.position.set(0, 7.5, 12);
  return (t: number) => {
    g.rotation.y = t * 0.12;
    const pulse = 0.8 + 0.25 * Math.sin(t * 3);
    (plasma.material as import('three').MeshStandardMaterial).emissiveIntensity = pulse;
  };
}

/** 德拜屏蔽：试验电荷被热电子云屏蔽，势 e^{−r/λ_D}/r */
function debye(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
) {
  // 中心正试验电荷（吸引电子、排斥离子 → 形成屏蔽层）
  const testQ = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.35, 20, 20)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, emissive: 0xb91c1c, emissiveIntensity: 0.8 })),
  );
  g.add(testQ);

  // 德拜球
  const debyeR = 2.6;
  const sphere = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(debyeR, 32, 20)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan, wireframe: true, transparent: true, opacity: 0.25 })),
  );
  g.add(sphere);

  // 热电子（负）与离子（正）随机运动，向中心重排
  const NP = 120;
  const pos: import('three').Vector3[] = [];
  const vel: import('three').Vector3[] = [];
  const signs: number[] = [];
  const geo = bag.geo(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  const colors = new Float32Array(NP * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  for (let i = 0; i < NP; i++) {
    const p = new THREE.Vector3(
      (Math.random() - 0.5) * 11,
      (Math.random() - 0.5) * 7,
      (Math.random() - 0.5) * 8,
    );
    pos.push(p);
    vel.push(new THREE.Vector3(
      (Math.random() - 0.5) * 1.6,
      (Math.random() - 0.5) * 1.6,
      (Math.random() - 0.5) * 1.6,
    ));
    const isE = i % 3 !== 0; // 电子占 2/3（示意）
    signs.push(isE ? -1 : 1);
    colors[i * 3] = isE ? 0.2 : 0.4;
    colors[i * 3 + 1] = isE ? 0.7 : 0.5;
    colors[i * 3 + 2] = isE ? 1.0 : 0.9;
  }
  const pts = new THREE.Points(geo, bag.mat(new THREE.PointsMaterial({
    size: 0.16, vertexColors: true, sizeAttenuation: true,
  })));
  g.add(pts);

  // 未屏蔽 vs 屏蔽势曲线（右侧）
  const cv = document.createElement('canvas');
  cv.width = 320; cv.height = 300;
  const c2 = cv.getContext('2d')!;
  const tex = bag.tex(new THREE.CanvasTexture(cv));
  const plot = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(3.5, 3.28)),
    bag.mat(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false })),
  );
  plot.position.set(7.2, 1.0, 0);
  plot.renderOrder = 997;
  g.add(plot);

  c2.fillStyle = 'rgba(7,11,20,0.85)'; c2.fillRect(0, 0, 320, 300);
  c2.strokeStyle = '#334155'; c2.lineWidth = 3; c2.strokeRect(1.5, 1.5, 317, 297);
  c2.strokeStyle = '#475569'; c2.beginPath();
  c2.moveTo(44, 18); c2.lineTo(44, 262); c2.lineTo(304, 262); c2.stroke();
  c2.fillStyle = '#94a3b8'; c2.font = '17px sans-serif'; c2.textAlign = 'center';
  c2.fillText('V(r)', 24, 32); c2.fillText('r', 300, 284);
  const draw = (col: string, fn: (r: number) => number, lw: number, dash: number[]) => {
    c2.strokeStyle = col; c2.lineWidth = lw; c2.setLineDash(dash); c2.beginPath();
    for (let i = 1; i <= 120; i++) {
      const r = (i / 120) * 5;
      const v = fn(r);
      const px = 44 + (r / 5) * 256;
      const py = 262 - Math.min(1, v / 1.6) * 236;
      if (i === 1) c2.moveTo(px, py); else c2.lineTo(px, py);
    }
    c2.stroke(); c2.setLineDash([]);
  };
  draw('#f59e0b', (r) => 1 / (r + 0.35), 2.6, [6, 5]);   // 未屏蔽 1/r
  draw('#06b6d4', (r) => Math.exp(-r / 1.4) / (r + 0.35), 3.4, []); // 屏蔽后
  c2.textAlign = 'left'; c2.font = '16px sans-serif';
  c2.fillStyle = '#f59e0b'; c2.fillText('— 未屏蔽 1/r', 168, 56);
  c2.fillStyle = '#06b6d4'; c2.fillText('— 屏蔽 e^{−r/λ_D}/r', 168, 80);
  tex.needsUpdate = true;

  g.add(panelSprite(THREE, bag, [
    { text: '德拜长度 λ_D = √(ε₀k_BT / n e²)', color: '#f8fafc' },
    { text: 'r ≪ λ_D：看到裸电荷；r ≫ λ_D：势被热电子云屏蔽', color: '#94a3b8' },
    { text: '球内为德拜球，等离子体在其中近似电中性', color: '#06b6d4' },
  ], [0, 4.4, 0], 7.6, 'center'));

  ctx.camera.position.set(0, 3.5, 13);
  return (t: number, dt: number) => {
    const arr = geo.getAttribute('position') as import('three').BufferAttribute;
    const a = arr.array as Float32Array;
    for (let i = 0; i < NP; i++) {
      // 电子（signs=-1）被正试验电荷吸引 → 向内漂移聚拢；正离子（signs=+1）被排斥向外
      const r = pos[i].length() || 1e-4;
      const pull = signs[i] * 1.5 / (r * r + 0.6);
      vel[i].addScaledVector(pos[i].clone().multiplyScalar(pull / r), dt);
      // 随机热运动
      vel[i].x += (Math.random() - 0.5) * 1.4 * dt * 8;
      vel[i].y += (Math.random() - 0.5) * 1.4 * dt * 8;
      vel[i].z += (Math.random() - 0.5) * 1.4 * dt * 8;
      vel[i].multiplyScalar(0.985);
      pos[i].addScaledVector(vel[i], dt);
      // 边界
      for (const ax of ['x', 'y', 'z'] as const) {
        const lim = ax === 'y' ? 3.4 : ax === 'x' ? 5.4 : 4;
        if (pos[i][ax] > lim || pos[i][ax] < -lim) vel[i][ax] *= -1;
      }
      a[i * 3] = pos[i].x; a[i * 3 + 1] = pos[i].y; a[i * 3 + 2] = pos[i].z;
    }
    arr.needsUpdate = true;
    sphere.scale.setScalar(1 + 0.04 * Math.sin(t * 2));
  };
}

/**
 * MHD：导电流体团穿过磁场产生 J×B 反馈 + 磁冻结线束 + 沿 B 传播的阿尔文波。
 * 同源驱动：x(t)=3.4·sin(0.6t)，阻尼力、冻结线束形变、波列角频率 ω 全部取同一 0.6 rad/s。
 */
function mhd(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
) {
  const omega = 0.6; // rad/s：阻尼演示与阿尔文波共用同一驱动频率

  // 背景磁场（均匀 B，沿 z）
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 5; j++) {
      const x = (i - 3) * 1.7;
      const y = (j - 2) * 1.5;
      const a = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1), new THREE.Vector3(x, y, -2.4), 1.2,
        0x475569, 0.14, 0.07,
      );
      bag.trackTree(a);
      g.add(a);
    }
  }

  // 导电流体团（可变形球）
  const blob = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.9, 24, 18)),
    bag.mat(new THREE.MeshStandardMaterial({
      color: PAL.cyan, emissive: 0x0891b2, emissiveIntensity: 0.5,
      transparent: true, opacity: 0.8,
    })),
  );
  g.add(blob);

  // 感应电流环（J）
  const jRing = new THREE.Mesh(
    bag.geo(new THREE.TorusGeometry(1.0, 0.05, 8, 40)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.amber })),
  );
  g.add(jRing);

  // J×B 作用力箭头
  const force = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1.6, PAL.red, 0.24, 0.12,
  );
  bag.trackTree(force);
  g.add(force);

  // —— 磁冻结演示：一小束磁力线网格随流体团位移/形变（Rm≫1，磁场被流体携带） ——
  // 横截面 3×3 网格偏移；形变与流体团同源：横向偏移 ×1/√s（管截面 A∝1/s），
  // 沿 z 拉伸 ×s；理想冻结 ⇒ 磁通守恒 B·A=const → B/B₀ = s(t)
  const BPTS = 24;
  const bundleMat = bag.mat(new THREE.LineBasicMaterial({
    color: 0x67e8f9, transparent: true, opacity: 0.85,
  }));
  const bundleLines: import('three').Line[] = [];
  const offs: [number, number][] = [[0, 0], [0.62, 0], [-0.62, 0], [0, 0.62], [0, -0.62]];
  offs.forEach(([ox, oy]) => {
    const geo = bag.geo(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BPTS * 3), 3));
    const ln = new THREE.Line(geo, bundleMat);
    ln.userData['ox'] = ox; ln.userData['oy'] = oy;
    g.add(ln);
    bundleLines.push(ln);
  });

  // —— 阿尔文波：横向扰动 δx(z,t)=A·sin(ωt−kz) 沿 B(=z) 传播，ω 与驱动同源 ——
  const kWave = 2 * Math.PI / 3.2; // 画面波长 λ_scene=3.2 单位 → k≈1.96
  const waveAmp = 0.85;
  const waveY = -2.5;
  const WPTS = 96;
  const waveGeo = bag.geo(new THREE.BufferGeometry());
  waveGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WPTS * 3), 3));
  const waveLine = new THREE.Line(
    waveGeo,
    bag.mat(new THREE.LineBasicMaterial({ color: PAL.green })),
  );
  g.add(waveLine);

  // 平衡位置参考虚线（静止），对比出横向位移
  const restLine = new THREE.Line(
    bag.geo(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, waveY, -7), new THREE.Vector3(0, waveY, 2),
    ])),
    bag.mat(new THREE.LineDashedMaterial({
      color: 0x475569, dashSize: 0.3, gapSize: 0.24, transparent: true, opacity: 0.8,
    })),
  );
  restLine.computeLineDistances();
  g.add(restLine);

  // 横向速度标记（∂δx/∂t ∝ cos(ωt−kz)）与传播方向箭头（+z，沿 B）
  const wMarks: import('three').ArrowHelper[] = [];
  for (let i = 0; i < 7; i++) {
    const a = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.6, PAL.green, 0.18, 0.09,
    );
    wMarks.push(a);
    bag.trackTree(a);
  }
  wMarks.forEach((a) => g.add(a));
  const propArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, waveY + 1.05, 1.1), 1.3,
    0x67e8f9, 0.3, 0.15,
  );
  bag.trackTree(propArrow);
  g.add(propArrow);

  // —— 5Hz 实时读数（公式与画面同源，v_A=B/√(μ₀ρ) 标定写在读数里） ——
  const MU0 = 4e-7 * Math.PI;
  const B0 = 0.05;            // T：背景场 50 mT 标定
  const ND = 1e20;            // m⁻³：氘离子数密度
  const MD = 3.344e-27;       // kg：D⁺ 质量（2.014 u）
  const vA = B0 / Math.sqrt(MU0 * ND * MD);          // ≈ 7.7e4 m/s
  const lamPhys = vA * (2 * Math.PI / omega);        // = v_A·T_wave ≈ 8.1e5 m
  const unitM = lamPhys / 3.2;                       // 画面比例尺：1 单位 ≈ 2.5e5 m
  const cv = document.createElement('canvas');
  cv.width = 560; cv.height = 336;
  const c2 = cv.getContext('2d')!;
  const rTex = bag.tex(new THREE.CanvasTexture(cv));
  const readout = new THREE.Sprite(
    bag.mat(new THREE.SpriteMaterial({ map: rTex, transparent: true, depthTest: false })),
  );
  const RW = 6.2;
  readout.scale.set(RW, (RW * cv.height) / cv.width, 1);
  readout.position.set(6.2, 0.2, -2.6);
  readout.renderOrder = 997;
  g.add(readout);

  const drawReadout = (x: number, sq: number, vSign: number) => {
    c2.clearRect(0, 0, cv.width, cv.height);
    c2.fillStyle = 'rgba(7,11,20,0.8)';
    c2.fillRect(0, 0, cv.width, cv.height);
    c2.strokeStyle = '#334155'; c2.lineWidth = 3;
    c2.strokeRect(2, 2, cv.width - 4, cv.height - 4);
    const rows: [string, string][] = [
      ['MHD 读数（5Hz，驱动 ω=0.6 同源）', '#f8fafc'],
      [`x = 3.4·sin(0.6t) = ${x.toFixed(2)} 单位`, '#e2e8f0'],
      [`J×B 力 = ${vSign > 0 ? '+' : '−'}x̂ = −sign(v)·x̂（磁阻尼）`, '#f87171'],
      [`磁冻结：B/B₀ = s = ${sq.toFixed(2)}（管截面 A∝1/s，Φ=B·A 守恒）`, '#67e8f9'],
      [`阿尔文波：ω=0.6，k=2π/3.2=${kWave.toFixed(2)}，v_ph=ω/k=${(omega / kWave).toFixed(2)} 单位/s`, '#4ade80'],
      [`v_A = B/√(μ₀ρ) = ${(vA / 1e4).toFixed(1)}×10⁴ m/s（B=50 mT，n=10²⁰ m⁻³ D⁺）`, '#4ade80'],
      [`画面 v_ph×比例尺 = v_A 自洽；1 单位 ≈ ${(unitM / 1e5).toFixed(1)}×10⁵ m`, '#94a3b8'],
      [`λ_phys = v_A·2π/ω ≈ ${(lamPhys / 1e5).toFixed(1)}×10⁵ m（电离层尺度阿尔文波）`, '#94a3b8'],
    ];
    c2.font = '22px "PingFang SC", "Microsoft YaHei", sans-serif';
    c2.textBaseline = 'middle';
    c2.textAlign = 'left';
    rows.forEach(([txt, col], i) => {
      c2.fillStyle = col;
      c2.fillText(txt, 20, 32 + i * 38, cv.width - 40);
    });
    rTex.needsUpdate = true;
  };
  drawReadout(0, 1, -1);

  g.add(panelSprite(THREE, bag, [
    { text: 'MHD：∂B/∂t = ∇×(v×B) + η∇²B（感应方程）', color: '#f8fafc' },
    { text: '导电流体横穿 B → 感应电流 J → J×B 阻碍相对运动', color: '#94a3b8' },
    { text: '磁雷诺数 Rm = μ₀σvL ≫ 1 时磁场被流体"冻结"携带', color: '#fbbf24' },
    { text: '青线束=冻结磁绳：随流体团同位移、同形变，B∝s(t)', color: '#67e8f9' },
    { text: '绿色波列=阿尔文波：横向扰动沿 B 传播，v_A = B/√(μ₀ρ)（ω 与驱动同源）', color: '#22c55e' },
  ], [0, 4.6, 0], 7.8, 'center'));

  // 侧移机位：B 沿 z（深度轴），斜视角让冻结线束与沿 B 传播的波列可读
  ctx.camera.position.set(4.5, 3.5, 11.3);
  let lastB5 = -1;
  return (t: number) => {
    const x = 3.4 * Math.sin(omega * t);
    blob.position.set(x, 0, 0);
    // 磁压使流体团沿场向拉长、垂直方向压扁
    const squash = 1 + 0.35 * Math.abs(Math.cos(omega * t));
    blob.scale.set(1 / Math.sqrt(squash), 1 / Math.sqrt(squash), squash);
    jRing.position.copy(blob.position);
    jRing.rotation.y = Math.PI / 2;
    jRing.scale.setScalar(1 + 0.1 * Math.sin(t * 2));
    // J×B 力与运动方向相反（磁阻尼）
    const vSign = Math.cos(omega * t) >= 0 ? -1 : 1;
    force.position.copy(blob.position);
    force.setDirection(new THREE.Vector3(vSign, 0, 0));
    force.setLength(0.8 + 0.8 * Math.abs(Math.cos(omega * t)), 0.24, 0.12);

    // 冻结线束：与流体团同位移 x(t)、同形变 s(t)；亮度随 B∝s 增强
    const inv = 1 / Math.sqrt(squash);
    const half = 2.6 * squash;
    bundleLines.forEach((ln) => {
      const arr = ln.geometry.getAttribute('position') as import('three').BufferAttribute;
      const a = arr.array as Float32Array;
      const bx = x + (ln.userData['ox'] as number) * inv;
      const by = (ln.userData['oy'] as number) * inv;
      for (let i = 0; i < BPTS; i++) {
        a[i * 3] = bx;
        a[i * 3 + 1] = by;
        a[i * 3 + 2] = -half + (2 * half) * i / (BPTS - 1);
      }
      arr.needsUpdate = true;
    });
    bundleMat.opacity = 0.55 + 0.4 * (squash - 1) / 0.35;

    // 阿尔文波列：δx(z,t)=A·sin(ωt−kz) 沿 +z（=B 向）传播，ω 与流体团驱动同源
    const wArr = waveGeo.getAttribute('position') as import('three').BufferAttribute;
    const wa = wArr.array as Float32Array;
    for (let i = 0; i < WPTS; i++) {
      const z = -7 + 9 * i / (WPTS - 1);
      wa[i * 3] = waveAmp * Math.sin(omega * t - kWave * z);
      wa[i * 3 + 1] = waveY;
      wa[i * 3 + 2] = z;
    }
    wArr.needsUpdate = true;

    // 横向速度标记：δv_x = ∂δx/∂t = Aω·cos(ωt−kz)（±x̂ 向，长度 ∝|cos|）
    wMarks.forEach((ar, i) => {
      const z = -6 + i * 1.3;
      const ph = omega * t - kWave * z;
      ar.position.set(waveAmp * Math.sin(ph), waveY, z);
      const c = Math.cos(ph);
      ar.setDirection(new THREE.Vector3(c >= 0 ? 1 : -1, 0, 0));
      ar.setLength(0.3 + 0.5 * Math.abs(c), 0.18, 0.09);
    });

    const b5 = Math.floor(t * 5);
    if (b5 !== lastB5) {
      lastB5 = b5;
      drawReadout(x, squash, vSign);
    }
  };
}

/** 磁重联：反平行磁力线合并成 X 点，形成外流喷射 */
function reconnection(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
) {
  // 反平行场线（上：+x，下：−x）
  const lines: { line: import('three').Line; y0: number; sign: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const y0 = 0.8 + i * 0.75;
    for (const s of [1, -1]) {
      const geo = bag.geo(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60 * 3), 3));
      const l = new THREE.Line(geo, bag.mat(new THREE.LineBasicMaterial({
        color: s > 0 ? PAL.cyan : PAL.violet, transparent: true, opacity: 0.8,
      })));
      l.position.y = s * y0;
      g.add(l);
      lines.push({ line: l, y0: s * y0, sign: s });
    }
  }

  // X 点标记
  const xpoint = new THREE.Mesh(
    bag.geo(new THREE.OctahedronGeometry(0.32)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, emissive: 0xb91c1c, emissiveIntensity: 0.9 })),
  );
  g.add(xpoint);

  // 外流喷射粒子
  const NJ = 60;
  const jp = new Float32Array(NJ * 3);
  const jgeo = bag.geo(new THREE.BufferGeometry());
  jgeo.setAttribute('position', new THREE.BufferAttribute(jp, 3));
  const jets = new THREE.Points(jgeo, bag.mat(new THREE.PointsMaterial({
    color: PAL.gold, size: 0.17, sizeAttenuation: true,
  })));
  g.add(jets);
  const jphase: number[] = [];
  for (let i = 0; i < NJ; i++) jphase.push(Math.random());

  g.add(panelSprite(THREE, bag, [
    { text: '磁重联：广义欧姆定律 E+v×B=ηJ，反平行场线在扩散区失去冻结、断开重接', color: '#f8fafc' },
    { text: '磁能 → 等离子体动能：形成 X 点与双向高速外流', color: '#94a3b8' },
    { text: '太阳耀斑、磁层亚暴、托卡马克撕裂模的共同机制', color: '#fbbf24' },
  ], [0, 4.6, 0], 7.8, 'center'));

  ctx.camera.position.set(0, 1.2, 13);
  return (t: number, dt: number) => {
    // 入流：场线向中平面靠拢；重联时中间段"断开"并回弹
    const u = (Math.sin(t * 0.7) * 0.5 + 0.5);
    lines.forEach(({ line }) => {
      const arr = line.geometry.getAttribute('position') as import('three').BufferAttribute;
      const a = arr.array as Float32Array;
      const s = Math.sign(line.position.y) || 1;
      for (let i = 0; i < 60; i++) {
        const x = (i / 59) * 14 - 7;
        // 入流使中段凹陷，重联区回弹形成双弧
        const dip = Math.exp(-(x * x) / 4);
        const y = s * (1 - u) * 0.4 * dip * -1 + s * (u * 1.3) * dip + s * Math.abs(x) * 0.06;
        a[i * 3] = x;
        a[i * 3 + 1] = y;
        a[i * 3 + 2] = 0;
      }
      arr.needsUpdate = true;
    });

    xpoint.scale.setScalar(0.7 + 0.6 * u);
    (xpoint.material as import('three').MeshStandardMaterial).emissiveIntensity = 0.4 + u;

    // 外流粒子从 X 点沿 ±x 喷出
    const ja = jgeo.getAttribute('position') as import('three').BufferAttribute;
    const jarr = ja.array as Float32Array;
    for (let i = 0; i < NJ; i++) {
      jphase[i] += dt * 0.55 * u;
      if (jphase[i] > 1) jphase[i] -= 1;
      const dir = i % 2 === 0 ? 1 : -1;
      const p = jphase[i];
      jarr[i * 3] = dir * p * 6.5;
      jarr[i * 3 + 1] = (Math.random() - 0.5) * 0.0 + Math.sin(p * 6 + i) * 0.28;
      jarr[i * 3 + 2] = 0;
    }
    ja.needsUpdate = true;
  };
}

/** 惯性约束聚变：多束激光对称内爆靶丸，中心热点点火 */
function icf(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
) {
  // 靶丸分层
  const shell = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(1.5, 40, 28)),
    bag.mat(new THREE.MeshStandardMaterial({
      color: 0x94a3b8, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
    })),
  );
  g.add(shell);
  // 热点（中心燃料）
  const hotspot = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.45, 24, 18)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: 0xf59e0b, emissiveIntensity: 1.0 })),
  );
  g.add(hotspot);

  // 激光束（12 束对称入射）
  const beams: import('three').ArrowHelper[] = [];
  const dirs: import('three').Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < 12; i++) {
    const y = 1 - (i / 11) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = golden * i;
    const d = new THREE.Vector3(r * Math.cos(th), y, r * Math.sin(th));
    dirs.push(d);
    const a = new THREE.ArrowHelper(
      d.clone().negate(), d.clone().multiplyScalar(6.5), 4.2, 0xef4444, 0.3, 0.14,
    );
    g.add(a);
    beams.push(a);
  }

  // 烧蚀外喷（blowoff）粒子
  const NB = 90;
  const bp = new Float32Array(NB * 3);
  const bgeo = bag.geo(new THREE.BufferGeometry());
  bgeo.setAttribute('position', new THREE.BufferAttribute(bp, 3));
  const blow = new THREE.Points(bgeo, bag.mat(new THREE.PointsMaterial({
    color: PAL.pink, size: 0.14, sizeAttenuation: true, transparent: true, opacity: 0.85,
  })));
  g.add(blow);
  const bdir: import('three').Vector3[] = [];
  for (let i = 0; i < NB; i++) bdir.push(dirs[i % 12].clone());
  const bphase: number[] = [];
  for (let i = 0; i < NB; i++) bphase.push(Math.random());

  g.add(panelSprite(THREE, bag, [
    { text: 'ICF：多束激光对称烧蚀 → 靶丸内爆（≈10⁷ m/s）', color: '#f8fafc' },
    { text: '中心热点达到 ρR ≳ 0.3 g/cm²、T ≈ 5 keV → 点火', color: '#94a3b8' },
    { text: '动量守恒：外喷（粉色）带走动量，主体向心聚爆', color: '#f472b6' },
  ], [0, 4.8, 0], 7.8, 'center'));

  ctx.camera.position.set(0, 3.5, 13);
  return (t: number, dt: number) => {
    const cyc = (t * 0.5) % 3; // 0..3 内爆周期
    let scale = 1;
    if (cyc < 1.8) scale = 1 - 0.72 * (cyc / 1.8);          // 内爆压缩
    else if (cyc < 2.1) scale = 0.28 + (cyc - 1.8) * 9;      // 点火反弹
    else scale = Math.max(0.55, 2.55 - (cyc - 2.1) * 1.6);   // 膨胀
    shell.scale.setScalar(scale);
    const hot = cyc >= 1.75 && cyc < 2.4;
    hotspot.scale.setScalar(hot ? 1 + 2.2 * Math.sin(((cyc - 1.75) / 0.65) * Math.PI) : 0.55);
    (hotspot.material as import('three').MeshStandardMaterial).emissiveIntensity = hot ? 2.4 : 0.7;
    // 激光束在压缩期增强
    beams.forEach((b) => b.setLength(cyc < 1.8 ? 4.2 : 0.4, 0.3, 0.14));

    // 烧蚀外喷
    const ba = bgeo.getAttribute('position') as import('three').BufferAttribute;
    const barr = ba.array as Float32Array;
    for (let i = 0; i < NB; i++) {
      if (cyc < 1.8) {
        bphase[i] += dt * 0.5;
        if (bphase[i] > 1) bphase[i] -= 1;
        const r = 1.5 * scale + bphase[i] * 3.4;
        barr[i * 3] = bdir[i].x * r;
        barr[i * 3 + 1] = bdir[i].y * r;
        barr[i * 3 + 2] = bdir[i].z * r;
      } else {
        barr[i * 3] *= 0.94; barr[i * 3 + 1] *= 0.94; barr[i * 3 + 2] *= 0.94;
      }
    }
    ba.needsUpdate = true;
  };
}
