import type { SceneContext, SceneInstance } from '../types';
import { scaffold, panelSprite, PAL, ResourceBag } from './_common';

/**
 * 波动光学族（waveoptics）：P75 艾里斑与分辨极限 /
 * P10 双缝干涉 · P526 空间相干性与缝宽（double-slit 二次分支） /
 * P83 倏逝波 / P570 多维傅里叶变换与衍射 / P445 菲涅耳衍射与半波带 /
 * P76 衍射光栅 · P447 光栅分辨本领与缺级（grating 二次分支） /
 * P313 菲涅耳双面镜 · P312 劳埃德镜实验（lloyd 二次分支） / P82 泊松亮斑 /
 * P522 四分之一波片与椭圆偏振 / P74 单缝衍射 · P520 单缝夫琅禾费衍射（single-slit 二次分支） /
 * P78 薄膜干涉。由 scene-registry 按 slug+variant 绑定：make(variant, title)。
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
    case 'airy': return build_airy(g, bag, THREE, title);
    case 'double-slit': return build_double_slit(g, bag, THREE, title);
    case 'evanescent': return build_evanescent(g, bag, THREE, title);
    case 'fourier': return build_fourier(g, bag, THREE, title);
    case 'fresnel': return build_fresnel(g, bag, THREE, title);
    case 'grating': return build_grating(g, bag, THREE, title);
    case 'lloyd': return build_lloyd(g, bag, THREE, title);
    case 'poisson': return build_poisson(g, bag, THREE, title);
    case 'polarization': return build_polarization(g, bag, THREE, title);
    case 'single-slit': return build_single_slit(g, bag, THREE, title);
    case 'thinfilm': return build_thinfilm(g, bag, THREE, title);
    default: return build_airy(g, bag, THREE, title);
  }
}

/** 画布助手（右侧可重绘强度曲线） */
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

/** 屏幕上的干涉/衍射条纹（可重绘的彩色竖条） */
function makeFringe(
  bag: ResourceBag,
  THREE: typeof import('three'),
  w: number,
  h: number,
  world: number,
  x: number,
  y: number,
  z: number,
) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!;
  const tex = bag.tex(new THREE.CanvasTexture(cv));
  const m = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(world, (world * h) / w)),
    bag.mat(new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })),
  );
  m.position.set(x, y, z);
  return { mesh: m, c, tex };
}

/** P75 艾里斑与分辨极限：圆孔衍射 + 瑞利判据（两源对照） */
function build_airy(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 望远镜口径（圆孔）
  const tube = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(1.6, 1.6, 2.4, 40, 1, true)),
    bag.mat(new THREE.MeshStandardMaterial({
      color: 0x475569, metalness: 0.5, roughness: 0.5, side: THREE.DoubleSide,
    })),
  );
  tube.rotation.z = Math.PI / 2;
  tube.position.set(-5.4, 0, 0);
  g.add(tube);
  const aperture = new THREE.Mesh(
    bag.geo(new THREE.RingGeometry(1.4, 1.6, 48)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.slate, side: THREE.DoubleSide })),
  );
  aperture.rotation.y = Math.PI / 2;
  aperture.position.set(-4.2, 0, 0);
  g.add(aperture);
  // 艾里斑屏幕（点扩散函数：中央亮斑 + 次级环）
  const screen = makeFringe(bag, THREE, 360, 360, 4.4, 5.4, 0.4, 0);
  g.add(screen.mesh);
  function drawAiry(sep: number): void {
    const W = 360, H = 360;
    const img = screen.c.createImageData(W, H);
    const cx = W / 2, cy = H / 2;
    const R = 62; // 第一暗环半径
    const a1 = 1.22 * Math.PI;
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const dx = px - cx, dy = py - cy;
        let I = 0;
        // 两个点源（相距 sep，沿 x 方向）
        for (const ox of [-sep / 2, sep / 2]) {
          const r = Math.hypot(dx - ox, dy) / R;
          const u = a1 * r;
          const air = r < 1e-6 ? 1 : (2 * (j1(u) / u)) ** 2;
          I += air;
        }
        I = Math.min(1, I * 0.6);
        const idx = (py * W + px) * 4;
        // 暖色亮斑
        img.data[idx] = Math.round(255 * Math.min(1, I * 1.3));
        img.data[idx + 1] = Math.round(220 * Math.pow(I, 0.7));
        img.data[idx + 2] = Math.round(140 * Math.pow(I, 0.5));
        img.data[idx + 3] = 255;
      }
    }
    screen.c.putImageData(img, 0, 0);
    // 标注
    screen.c.strokeStyle = '#334155'; screen.c.lineWidth = 4;
    screen.c.strokeRect(2, 2, W - 4, H - 4);
    screen.c.fillStyle = '#f8fafc'; screen.c.font = '17px sans-serif';
    screen.c.fillText(`θ_min = 1.22 λ/D`, 18, 30);
    screen.c.fillStyle = sep > 70 ? '#22c55e' : '#ef4444';
    screen.c.fillText(sep > 70 ? '可分辨（瑞利判据满足）' : '不可分辨（两斑重叠）', 18, H - 18);
    screen.tex.needsUpdate = true;
  }
  // Bessel J1 近似（用于艾里斑强度）
  function j1(x: number): number {
    // 分段有理近似（Abramowitz–Stegun 9.4.4 简化）
    const ax = Math.abs(x);
    if (ax < 8) {
      const y = x * x;
      // A&S 9.4.4 有理近似（括号已配平）
      const num = x * (72362614232.0 + y * (-7895059235.0 + y * (242396853.1 + y * (-2972611.439 + y * (15704.48260 + y * (-30.16036606))))));
      const den = 144725228442.0 + y * (2300535178.0 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))));
      return num / den;
    }
    return Math.sqrt(0.636619772 / ax) * Math.cos(ax - 2.356194491) * (1 + 0.0785398163 / ax);
  }
  drawAiry(40);

  g.add(panelSprite(THREE, bag, [
    { text: '艾里斑：圆孔衍射 I(θ) = [2J₁(ka sinθ)/(ka sinθ)]²', color: '#f8fafc' },
    { text: '瑞利判据：两斑中心恰落于对方第一暗环 → θ_min = 1.22λ/D', color: '#94a3b8' },
    { text: '读数：口径 D 越大 θ_min 越小；蓝光(λ小)分辨率优于红光(λ大)', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.4, 'center'));

  return (t: number, dt: number) => {
    // 两源间距缓慢变化 → 可分辨/不可分辨切换
    const sep = 46 + 44 * (Math.sin(t * 0.5) * 0.5 + 0.5);
    if (Math.floor(t * 10) % 3 === 0) drawAiry(sep);
    tube.rotation.x += dt * 0.2;
    aperture.rotation.z += dt * 0.2;
  };
}

/** P10 双缝干涉 / P526 空间相干性与缝宽（二次分支） */
function build_double_slit(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const coherence = title.includes('空间相干') || title.includes('缝宽');
  // 单色光源
  const lamp = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.4, 20, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xfde68a, emissive: 0xf59e0b, emissiveIntensity: 1.0 })),
  );
  lamp.position.set(-7.6, 0, 0);
  g.add(lamp);
  // 双缝屏：上下两块挡板（内沿 ±0.7）+ 中间挡条；挡条半高 hm 决定两缝中心距 d = hm + 0.7
  const screenX = -2.6;
  for (const dy of [-1.0, 1.0]) {
    const bar = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(0.22, 1.4, 0.6)),
      bag.mat(new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.4, roughness: 0.5 })),
    );
    bar.position.set(screenX, dy * 1.4, 0);
    g.add(bar);
  }
  const midBar = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.22, 0.8, 0.6)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.4, roughness: 0.5 })),
  );
  midBar.position.set(screenX, 0, 0);
  g.add(midBar);
  // 源缝挡板（相干性模式：上下两块挡板形成宽度可变的单缝，缝宽 a 在 3D 中可见变化）
  const slitBars: import('three').Mesh[] = [];
  for (const s of [-1, 1]) {
    const bar = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(0.18, 1.6, 0.6)),
      bag.mat(new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.4, roughness: 0.5 })),
    );
    bar.position.set(-5.4, s * 1.0, 0);
    bar.visible = coherence; // 普通双缝模式不画源缝
    g.add(bar);
    slitBars.push(bar);
  }
  // 从两缝发出的子波（球面波前）
  const fronts: import('three').Mesh[] = [];
  const frontGeo = bag.geo(new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0.7, Math.PI - 1.4));
  for (const sy of [-0.5, 0.5]) {
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(
        frontGeo,
        bag.mat(new THREE.MeshBasicMaterial({
          color: PAL.cyan, transparent: true, opacity: 0.35, wireframe: true, side: THREE.DoubleSide,
        })),
      );
      m.position.set(screenX, sy, 0);
      g.add(m);
      fronts.push(m);
      (m.userData as Record<string, unknown>)['seed'] = i * 0.6;
      (m.userData as Record<string, unknown>)['sy'] = sy;
    }
  }
  // 接收屏（干涉条纹）
  const fringe = makeFringe(bag, THREE, 512, 300, 5.6, 6.2, 0, 0);
  g.add(fringe.mesh);
  function drawFringe(a: number, visibility: number, d: number): void {
    const W = 512, H = 300;
    fringe.c.clearRect(0, 0, W, H);
    fringe.c.fillStyle = '#0b1220';
    fringe.c.fillRect(0, 0, W, H);
    const lam = 0.09;  // 波长（固定）
    for (let px = 0; px < W; px++) {
      const X = ((px - W / 2) / W) * 6.0;
      const beta = (Math.PI * d * X) / (4.6 * lam);
      const single = a; // 单缝衍射包络（受缝宽影响）
      const sincArg = (X / (a * 1.6)) * 2;
      const sincVal = Math.abs(sincArg) < 1e-6 ? 1 : Math.abs(Math.sin(Math.PI * sincArg) / (Math.PI * sincArg));
      const env = coherence ? sincVal ** 2 : 1;
      const I = env * Math.cos(beta) ** 2;
      const shown = 0.18 + visibility * 0.82 * I;
      const v = Math.round(255 * Math.min(1, shown));
      const rr = Math.round(v * 0.55 + 40);
      const gg = Math.round(v * 0.85 + 20);
      const bb = Math.round(v * 1.0);
      fringe.c.fillStyle = `rgb(${Math.min(255, rr)},${Math.min(255, gg)},${Math.min(255, bb)})`;
      fringe.c.fillRect(px, H * (1 - shown) * 0.9, 1, H);
    }
    fringe.c.fillStyle = '#f8fafc'; fringe.c.font = '17px sans-serif';
    fringe.c.fillText(
      coherence
        ? `缝宽 a = ${a.toFixed(2)} → 可见度 V = ${visibility.toFixed(2)}`
        : `I = I₀cos²(πd sinθ/λ)，d = ${d.toFixed(2)}`,
      16, 26,
    );
    fringe.c.fillStyle = '#94a3b8';
    fringe.c.fillText('亮纹间距 Δy = λD/d（d ↓ → Δy ↑）', 16, H - 16);
    fringe.tex.needsUpdate = true;
  }
  // 让 d 随时间微调，使条纹间距 Δy=λD/d 可见地变化
  let dBase = 0.9;
  drawFringe(1.2, 1, dBase);

  g.add(panelSprite(THREE, bag, coherence ? [
    { text: '空间相干性：缝宽 a 增大 → 源视角扩展 → 条纹可见度下降', color: '#f8fafc' },
    { text: '可见度 V ≈ |sinc(πaθ/λ)|，a 大到一定程度条纹完全消失', color: '#94a3b8' },
    { text: '读数：相干宽度 θ_c ≈ λ/a（先加单缝再张双缝）', color: '#fbbf24' },
  ] : [
    { text: '双缝干涉：I = 4I₀cos²(πd sinθ/λ)（相位差 δ = 2πd sinθ/λ）', color: '#f8fafc' },
    { text: '亮纹条件 d sinθ = mλ，间距 Δy = λD/d', color: '#94a3b8' },
    { text: '读数：红光条纹比蓝光宽；换缝距 d 条纹密度反比变化', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.4, 'center'));

  return (t: number, dt: number) => {
    // 缝宽随时间变化（相干性演示）；相干性模式下可见度随之变化
    const a = 0.6 + 1.6 * (Math.sin(t * 0.6) * 0.5 + 0.5);
    const vis = Math.abs(a * 1.1);
    const sincV = Math.abs(vis) < 1e-6 ? 1 : Math.abs(Math.sin(Math.PI * vis) / (Math.PI * vis));
    const visibility = coherence ? Math.max(0, sincV) : 1;
    // 缝距 d 缓慢变化（普通模式）→ Δy = λD/d 在画布与 3D 中同时可见地变化
    const d = coherence ? 0.9 : 0.75 + 0.4 * (Math.sin(t * 0.4) * 0.5 + 0.5);
    if (Math.floor(t * 12) % 3 === 0) drawFringe(a, visibility, d);
    // 双缝几何随 d 联动：中间挡条高度 → 缝中心距 d；子波源间距同步
    midBar.scale.y = (d - 0.7) / 0.4;
    // 源缝宽度随 a 变化（3D 中可见）
    slitBars.forEach((b, i) => { b.position.y = (i ? 1 : -1) * (a / 2 + 0.8); });
    // 子波波前扩散
    fronts.forEach((m) => {
      const seed = (m.userData as Record<string, number>)['seed'];
      const sy = (m.userData as Record<string, number>)['sy'];
      const age = ((t * 1.1 + seed) % 3) / 3;
      const r = 0.3 + age * 6.4;
      m.scale.setScalar(r);
      m.position.set(screenX + r * 0.15, sy * d, 0); // 子波源间距 = d
      (m.material as import('three').MeshBasicMaterial).opacity = 0.4 * (1 - age);
    });
    lamp.scale.setScalar(1 + 0.1 * Math.sin(t * 6));
    void dt;
  };
}

/** P83 倏逝波：全反射界面 → 界面以下指数衰减的非传播波 */
function build_evanescent(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 两种介质分界面（y = 0）
  const dense = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(12, 3.0, 5.0)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x1d4ed8, transparent: true, opacity: 0.3, roughness: 0.4 })),
  );
  dense.position.set(0, -1.5, 0);
  g.add(dense);
  const rare = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(12, 3.0, 5.0)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.14, roughness: 0.4 })),
  );
  rare.position.set(0, 1.5, 0);
  g.add(rare);
  // 入射波（在下层介质中斜射向界面）
  const N = 200;
  const incGeo = bag.geo(new THREE.BufferGeometry());
  incGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const incident = new THREE.Line(incGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.gold })));
  g.add(incident);
  // 反射波
  const refGeo = bag.geo(new THREE.BufferGeometry());
  refGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const reflected = new THREE.Line(refGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.green, transparent: true, opacity: 1 })));
  g.add(reflected);
  // 倏逝波（界面上方）：界面处沿 x 传播，幅值随 y 指数衰减（不向 y 输运能量）
  const evaGeo = bag.geo(new THREE.BufferGeometry());
  evaGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const evanescent = new THREE.Line(evaGeo, bag.mat(new THREE.LineBasicMaterial({
    color: PAL.pink, transparent: true, opacity: 0.95,
  })));
  g.add(evanescent);
  // E(y) 剖面：沿 x = 0 的竖直切面，x 坐标即场值（振幅沿 y 指数衰减）
  const profGeo = bag.geo(new THREE.BufferGeometry());
  profGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const profile = new THREE.Line(profGeo, bag.mat(new THREE.LineBasicMaterial({
    color: PAL.pink, transparent: true, opacity: 0.9,
  })));
  g.add(profile);
  // 衰减包络（虚线）：±A(y) = ±A₀e^{−κy}
  const envGeo = bag.geo(new THREE.BufferGeometry());
  envGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const envUp = new THREE.Line(envGeo, bag.mat(new THREE.LineDashedMaterial({
    color: PAL.pink, gapSize: 0.3, dashSize: 0.3, transparent: true, opacity: 0.7,
  })));
  g.add(envUp);
  const envDownGeo = bag.geo(new THREE.BufferGeometry());
  envDownGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const envDown = new THREE.Line(envDownGeo, bag.mat(new THREE.LineDashedMaterial({
    color: PAL.pink, gapSize: 0.3, dashSize: 0.3, transparent: true, opacity: 0.7,
  })));
  g.add(envDown);
  // 界面线
  g.add(new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(12, 0.05, 5.0)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.white, transparent: true, opacity: 0.5 })),
  ));

  g.add(panelSprite(THREE, bag, [
    { text: '全反射时 θ_i > θ_c = arcsin(n₂/n₁)，折射波消失、净能流为 0', color: '#f8fafc' },
    { text: '倏逝波 E = E₀e^{−κy}·e^{i(kx−ωt)}，穿透深度 d_p = 1/κ 随 θ_i 变（读数见右）', color: '#94a3b8' },
    { text: '受抑全反射 FTIR：上棱镜逼近至 d_p 量级，倏逝场耦合为透射光、反射率下降', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.4, 'center'));

  // —— FTIR 演示：界面上方（稀介质侧，倏逝场所在）可逼近的第二块密介质棱镜 ——
  const prism = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(9, 1.7, 4.4)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x1d4ed8, transparent: true, opacity: 0.32, roughness: 0.4 })),
  );
  prism.position.set(0.5, 2.55, 0); // 底面 y = gap（每帧更新：center = gap + 0.85）
  g.add(prism);
  // 耦合进棱镜的透射光（能量泄漏），幅值 ∝ 倏逝场在间隙处的 e^{−κ·gap}
  const trGeo = bag.geo(new THREE.BufferGeometry());
  trGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
  const trans = new THREE.Line(trGeo, bag.mat(new THREE.LineBasicMaterial({
    color: PAL.green, transparent: true, opacity: 0,
  })));
  g.add(trans);

  // 5Hz 动态读数：θ_i、κ、d_p=1/κ、间隙 gap、耦合透过率 T（均与画面几何同源）
  const rcv = document.createElement('canvas');
  rcv.width = 320; rcv.height = 214;
  const rc = rcv.getContext('2d')!;
  const rtex = bag.tex(new THREE.CanvasTexture(rcv));
  const rmesh = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(3.7, 2.47)),
    bag.mat(new THREE.MeshBasicMaterial({ map: rtex, transparent: true, depthTest: false })),
  );
  rmesh.position.set(7.0, -1.4, 0);
  rmesh.renderOrder = 997;
  g.add(rmesh);
  const n1 = 1.5, n2 = 1.0, k0 = 3.0;
  const thetaC = Math.asin(n2 / n1);
  function drawReadout(deg: number, kappa: number, dp: number, gap: number, T: number): void {
    const W = 320, H = 214;
    rc.clearRect(0, 0, W, H);
    rc.fillStyle = 'rgba(7,11,20,0.85)'; rc.fillRect(0, 0, W, H);
    rc.strokeStyle = '#334155'; rc.lineWidth = 3; rc.strokeRect(1.5, 1.5, W - 3, H - 3);
    rc.textAlign = 'left'; rc.font = 'bold 19px sans-serif';
    rc.fillStyle = '#f8fafc'; rc.fillText('倏逝场 / FTIR 读数', 12, 30);
    rc.font = '18px sans-serif';
    rc.fillStyle = '#94a3b8';
    rc.fillText(`θ_i = ${deg.toFixed(1)}°   θ_c = ${(thetaC * 57.2958).toFixed(1)}°`, 12, 64);
    rc.fillStyle = '#f472b6';
    rc.fillText(`κ = ${kappa.toFixed(2)}   d_p = 1/κ = ${dp.toFixed(2)}`, 12, 96);
    rc.fillStyle = '#94a3b8';
    rc.fillText(`d_p/λ = ${(dp * k0 / (2 * Math.PI)).toFixed(2)} λ`, 12, 124);
    rc.fillText(`间隙 gap = ${gap.toFixed(2)}`, 12, 152);
    rc.fillStyle = T > 0.05 ? '#22c55e' : '#64748b';
    rc.fillText(`耦合透过率 T = ${(100 * T).toFixed(1)}%`, 12, 184);
    rtex.needsUpdate = true;
  }

  const kx = 2.2, w = 5.0;
  const yBase = 0.15; // 界面波所在高度（界面 y=0 稍上方）
  const yTop = 2.6;   // 剖面顶端（稀介质内部）
  const amp0 = 1.1;   // 界面处（y = 0）场幅
  let lastRO = -1;
  return (t: number) => {
    // θ_i 缓慢扫描（始终 > θ_c，保持全反射）；κ、d_p、光线几何、剖面衰减全部由 θ_i 驱动
    const theta = (61 + 13 * Math.sin(t * 0.5)) * Math.PI / 180; // 48° ~ 74°
    const s1 = n1 * Math.sin(theta);
    const kappa = k0 * Math.sqrt(Math.max(1e-4, s1 * s1 - n2 * n2));
    const dp = 1 / kappa;
    // 上棱镜逼近：间隙 gap 往复扫描（0.6 ~ 2.7）
    const gap = 1.65 + 1.05 * Math.sin(t * 0.4 + 1.0);
    prism.position.y = gap + 0.85;
    // 倏逝耦合透过率 ∝ e^{−2κ·gap}（间隙内的倏逝场到达棱镜底面并耦合）
    const coupling = Math.min(1, Math.exp(-2 * kappa * Math.max(0, gap)));
    const rayOp = Math.min(1, coupling * 3);
    (trans.material as import('three').LineBasicMaterial).opacity = rayOp;
    trans.visible = coupling > 0.02;
    // 能量守恒：透射增强则反射减弱（"全反射打开一条缝"）
    (reflected.material as import('three').LineBasicMaterial).opacity = 1 - 0.8 * coupling;
    // 透射光方向：进入 n₁ 棱镜，θ_t = θ_i（同介质），沿 (sinθ, cosθ) 上射
    const tLen = 2.4;
    const tarr = (trGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    tarr[0] = 0.5; tarr[1] = gap; tarr[2] = 0;
    tarr[3] = 0.5 + tLen * Math.sin(theta); tarr[4] = gap + tLen * Math.cos(theta); tarr[5] = 0;
    (trGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;

    const iarr = (incGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    const rarr = (refGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    const earr = (evaGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    const parr = (profGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    const uarr = (envGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    const darr = (envDownGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    const Lr = 3.0;
    const yProf = Math.min(yTop, gap);
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      // 入射：自左下密介质斜射向原点，方向 (sinθ, cosθ)（随 θ_i 变）
      iarr[i * 3] = -Lr * Math.sin(theta) * (1 - u);
      iarr[i * 3 + 1] = -Lr * Math.cos(theta) * (1 - u);
      iarr[i * 3 + 2] = 0;
      // 反射：自原点斜向右下，方向 (sinθ, −cosθ)，与入射关于法线严格镜对称
      rarr[i * 3] = Lr * Math.sin(theta) * u;
      rarr[i * 3 + 1] = -Lr * Math.cos(theta) * u;
      rarr[i * 3 + 2] = 0;
      // 界面处的倏逝波：沿 x 传播，幅值 A(yBase) = A₀e^{−κ·yBase}
      const x = -5.5 + u * 11;
      const ampBase = amp0 * Math.exp(-kappa * yBase);
      earr[i * 3] = x;
      earr[i * 3 + 1] = yBase + ampBase * Math.sin(kx * x - w * t);
      earr[i * 3 + 2] = 0;
      // E(y) 剖面：x 坐标即场值，振幅沿 y 指数衰减（随 θ_i 的 κ 收窄/展宽）
      const y = yBase + u * (yProf - yBase);
      const amp = amp0 * Math.exp(-kappa * y);
      parr[i * 3] = amp * Math.sin(-w * t);
      parr[i * 3 + 1] = y;
      parr[i * 3 + 2] = 0;
      // 包络：±A(y) = ±A₀e^{−κy}（随 y 收窄，虚线）
      uarr[i * 3] = amp;
      uarr[i * 3 + 1] = y;
      uarr[i * 3 + 2] = 0;
      darr[i * 3] = -amp;
      darr[i * 3 + 1] = y;
      darr[i * 3 + 2] = 0;
    }
    (incGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    (refGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    (evaGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    (profGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    (envGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    (envDownGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    envUp.computeLineDistances();
    envDown.computeLineDistances();
    // 倏逝波的相位沿界面推进
    (evanescent.material as import('three').LineBasicMaterial).opacity = 0.6 + 0.4 * Math.sin(t * 3);
    // 读数行以 5Hz 刷新
    const roTick = Math.floor(t * 5);
    if (roTick !== lastRO) {
      lastRO = roTick;
      drawReadout(theta * 180 / Math.PI, kappa, dp, gap, coupling);
    }
  };
}

/** P570 多维傅里叶变换与衍射：孔径 F(u,v) ↔ 场分布 f(x,y)（夫琅禾费 = 孔径的傅里叶变换） */
function build_fourier(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 孔径平面（可切换形状：圆孔 / 方孔 / 双孔）
  const aper = makeFringe(bag, THREE, 256, 256, 3.2, -5.4, 1.6, 0);
  g.add(aper.mesh);
  // 衍射图样平面（傅里叶变换模方）
  const spec = makeFringe(bag, THREE, 320, 320, 4.0, 5.4, 1.6, 0);
  g.add(spec.mesh);
  // 光路箭头
  const beam = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(-3.6, 1.6, 0), 6.6, PAL.gold, 0.22, 0.11,
  );
  g.add(beam);
  // 中间傅里叶面（透镜）
  const lens = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(1.6, 32, 24)),
    bag.mat(new THREE.MeshStandardMaterial({
      color: 0xbae6fd, transparent: true, opacity: 0.3, roughness: 0.1, metalness: 0.1,
    })),
  );
  lens.scale.set(0.18, 1, 1);
  lens.position.set(0, 1.6, 0);
  g.add(lens);

  function drawAperture(kind: number): void {
    const W = 256;
    aper.c.fillStyle = '#050a14';
    aper.c.fillRect(0, 0, W, W);
    aper.c.fillStyle = '#fbbf24';
    const cx = W / 2, cy = W / 2;
    if (kind === 0) {
      aper.c.beginPath(); aper.c.arc(cx, cy, 42, 0, 7); aper.c.fill();
    } else if (kind === 1) {
      aper.c.fillRect(cx - 40, cy - 40, 80, 80);
    } else {
      aper.c.fillRect(cx - 60, cy - 12, 36, 24);
      aper.c.fillRect(cx + 24, cy - 12, 36, 24);
    }
    aper.c.strokeStyle = '#334155'; aper.c.lineWidth = 4;
    aper.c.strokeRect(2, 2, W - 4, W - 4);
    aper.c.fillStyle = '#f8fafc'; aper.c.font = '17px sans-serif';
    aper.c.fillText(['圆孔', '方孔', '双孔'][kind], 14, 28);
    aper.tex.needsUpdate = true;
  }
  function drawSpectrum(kind: number): void {
    const W = 320, H = 320;
    const img = spec.c.createImageData(W, H);
    const cx = W / 2, cy = H / 2;
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const u = (px - cx) / 26;
        const v = (py - cy) / 26;
        let F = 1;
        if (kind === 0) {
          const r = Math.hypot(u, v);
          F = r < 1e-6 ? 1 : (2 * (besselJ1(2.0 * r) / (2.0 * r))) ** 2; // Airy
        } else if (kind === 1) {
          const fx = Math.abs(u) < 1e-6 ? 1 : Math.abs(Math.sin(Math.PI * u) / (Math.PI * u));
          const fy = Math.abs(v) < 1e-6 ? 1 : Math.abs(Math.sin(Math.PI * v) / (Math.PI * v));
          F = (fx * fy) ** 2; // sinc² 二维
        } else {
          // 双孔：单孔径 sinc² 包络 × 沿孔间距方向(u)的 cos² 干涉调制（孔沿 u 排布，条纹法向亦沿 u）
          const sep = 3.2; // 孔心间距（u 单位，px cx±42 → 84/26）
          const eu = Math.abs(u) < 1e-6 ? 1 : Math.abs(Math.sin(Math.PI * u * 1.2) / (Math.PI * u * 1.2));
          const ev = Math.abs(v) < 1e-6 ? 1 : Math.abs(Math.sin(Math.PI * v * 1.6) / (Math.PI * v * 1.6));
          F = (eu * ev) ** 2 * Math.cos(Math.PI * sep * u) ** 2;
        }
        F = Math.pow(Math.min(1, F), 0.45);
        const idx = (py * W + px) * 4;
        img.data[idx] = Math.round(80 * F + 10);
        img.data[idx + 1] = Math.round(200 * F + 14);
        img.data[idx + 2] = Math.round(255 * F + 26);
        img.data[idx + 3] = 255;
      }
    }
    spec.c.putImageData(img, 0, 0);
    spec.c.strokeStyle = '#334155'; spec.c.lineWidth = 4;
    spec.c.strokeRect(2, 2, W - 4, H - 4);
    spec.c.fillStyle = '#f8fafc'; spec.c.font = '17px sans-serif';
    spec.c.fillText('|F(u,v)|²', 14, 28);
    spec.c.fillStyle = '#94a3b8';
    spec.c.fillText('夫琅禾费衍射 ∝ 孔径的傅里叶变换', 14, H - 16);
    spec.tex.needsUpdate = true;
  }
  function besselJ1(x: number): number {
    const ax = Math.abs(x);
    if (ax < 8) {
      const y = x * x;
      // A&S 9.4.4 有理近似（括号已配平）
      const num = x * (72362614232.0 + y * (-7895059235.0 + y * (242396853.1 + y * (-2972611.439 + y * (15704.48260 + y * (-30.16036606))))));
      const den = 144725228442.0 + y * (2300535178.0 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))));
      return num / den;
    }
    return Math.sqrt(0.636619772 / ax) * Math.cos(ax - 2.356194491);
  }
  drawAperture(0);
  drawSpectrum(0);

  g.add(panelSprite(THREE, bag, [
    { text: '夫琅禾费衍射场 U(u,v) ∝ ∬ f(x,y)e^{−i2π(ux+vy)}dxdy（孔径的傅里叶变换）', color: '#f8fafc' },
    { text: '圆孔 → 艾里斑；方孔 → sinc²；双孔 → 双缝调制沿孔间距方向 u（逐一对比）', color: '#94a3b8' },
    { text: '成像即卷积：像 = 物 ⊗ 点扩散函数（频谱面滤波实现），|F(u,v)|² 定系统传递', color: '#a78bfa' },
    { text: '读数：孔径越小，频谱越展宽（倒易关系 ΔxΔu ≈ 1）', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.6, 'center'));

  let lastKind = -1;
  return (t: number) => {
    const kind = Math.floor((t * 0.35) % 3);
    if (kind !== lastKind) {
      lastKind = kind;
      drawAperture(kind);
      drawSpectrum(kind);
    }
    // 傅里叶面上的光束汇聚
    lens.scale.x = 0.18 + 0.05 * Math.sin(t * 2);
    beam.setLength(6.6, 0.22, 0.11);
  };
}

/** P445 菲涅耳衍射与半波带：波前分割成半波带（环形带） */
function build_fresnel(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 点光源
  const src = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.3, 20, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xfde68a, emissive: 0xf59e0b, emissiveIntensity: 1.0 })),
  );
  src.position.set(-6.4, 0, 0);
  g.add(src);
  // 观察屏
  const screen = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.2, 5.2, 5.2)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.4, roughness: 0.6 })),
  );
  screen.position.set(6.2, 0, 0);
  g.add(screen);
  // 半波带（同心环带，交替遮挡/透明 → 振幅相消相长）
  const zones: import('three').Mesh[] = [];
  const zoneGroup = new THREE.Group();
  zoneGroup.position.set(0.4, 0, 0);
  zoneGroup.rotation.y = Math.PI / 2;
  g.add(zoneGroup);
  for (let n = 1; n <= 8; n++) {
    const rOut = Math.sqrt(n) * 0.62;
    const rIn = Math.sqrt(n - 1) * 0.62;
    const ring = new THREE.Mesh(
      bag.geo(new THREE.RingGeometry(rIn, rOut, 64)),
      bag.mat(new THREE.MeshBasicMaterial({
        color: n % 2 ? PAL.cyan : PAL.amber,
        transparent: true, opacity: n % 2 ? 0.6 : 0.45, side: THREE.DoubleSide,
      })),
    );
    zoneGroup.add(ring);
    zones.push(ring);
  }
  // 中心亮斑：亮度 ∝ 各开放带的合振幅（相间开放 → 同相叠加 → 中心更亮）
  const spotMat = bag.mat(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
  const spot = new THREE.Mesh(bag.geo(new THREE.CircleGeometry(0.26, 32)), spotMat);
  spot.position.set(0, 0, 0.02); // 沿环带法向微偏，避免与环带共面闪面
  zoneGroup.add(spot);
  // 从波前到观察点的光线（多条，示意光程差）
  const rays: import('three').Line[] = [];
  for (let n = 1; n <= 8; n++) {
    const r = Math.sqrt(n - 0.5) * 0.62;
    const l = new THREE.Line(
      bag.geo(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-6.2, 0, 0),
        new THREE.Vector3(0.4, r, 0),
        new THREE.Vector3(6.2, 0, 0),
      ])),
      bag.mat(new THREE.LineBasicMaterial({ color: n % 2 ? PAL.cyan : PAL.amber, transparent: true, opacity: 0.6 })),
    );
    g.add(l);
    rays.push(l);
  }
  // 振幅矢量合成（相量图，右侧画布）
  const plot = makeCanvas(bag, THREE, 400, 320, 4.6, 5.6, -3.2);
  g.add(plot.mesh);
  function drawPhasors(openParity: number): void {
    // openParity：0 = 全部开放；1 = 只开放奇数带；2 = 只开放偶数带（相间开放 = 波带片原理）
    const c = plot.frame('半波带振幅矢量合成', '', '');
    const W = 400, H = 320;
    const cx = W / 2, cy = H / 2 + 20;
    let x = cx, y = cy;
    let amp = 0;
    const openZones: number[] = [];
    for (let n = 1; n <= 8; n++) {
      if (openParity === 0 || (openParity === 1 ? n % 2 === 1 : n % 2 === 0)) openZones.push(n);
    }
    c.strokeStyle = '#06b6d4'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(x, y);
    for (const n of openZones) {
      // 第 n 带相对第 1 带相位差 (n−1)π；只留相间带时各矢量同向 → 相长叠加
      const ang = (n - 1) * Math.PI + 0.16;
      const len = 58 / Math.sqrt(n);
      x += len * Math.cos(ang);
      y += len * Math.sin(ang);
      amp += (n % 2 ? 1 : -1) / Math.sqrt(n);
      c.lineTo(x, y);
    }
    c.stroke();
    c.strokeStyle = '#475569'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(x, y); c.stroke();
    const label = openParity === 0 ? '全部开放' : openParity === 1 ? '只开放奇数带' : '只开放偶数带';
    c.fillStyle = '#f8fafc'; c.font = '17px sans-serif';
    c.fillText(`${label} → 合成振幅 ≈ ${Math.abs(amp).toFixed(2)}`, 22, 34);
    c.fillStyle = '#94a3b8'; c.font = '15px sans-serif';
    c.fillText('相邻带光程差 λ/2 → 相位差 π → 交替相消', 22, H - 44);
    c.fillStyle = '#fbbf24';
    c.fillText('相间开放（波带片）：同相叠加，中心更亮', 22, H - 20);
    plot.tex.needsUpdate = true;
  }
  drawPhasors(0);

  g.add(panelSprite(THREE, bag, [
    { text: '菲涅耳衍射：波前按 rₙ = √(nλR + (nλ/2)²) 分成半波带', color: '#f8fafc' },
    { text: '相邻半波带光程差 λ/2 → 相位差 π，贡献交替增减', color: '#94a3b8' },
    { text: '读数：只开放相间半波带 → 同相叠加，中心变亮（菲涅耳波带片）', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.4, 'center'));

  // 相间遮挡动画：全部开放 → 只开奇数带 → 只开偶数带，中心亮斑随合振幅变化
  let lastPhase = -1;
  return (t: number) => {
    const phase = Math.floor(t * 0.7) % 3;
    if (phase !== lastPhase) {
      lastPhase = phase;
      drawPhasors(phase);
    }
    let amp = 0;
    zones.forEach((z, i) => {
      const n = i + 1;
      const open = phase === 0 || (phase === 1 ? n % 2 === 1 : n % 2 === 0);
      z.visible = open;
      if (open) amp += (n % 2 ? 1 : -1) / Math.sqrt(n);
      const m = z.material as import('three').MeshBasicMaterial;
      m.opacity = 0.3 + 0.4 * Math.sin(t * 3 + i);
    });
    // 中心亮斑亮度 ∝ |合振幅|：相间开放 ≈ 2× 全部开放
    const bright = Math.min(1, Math.abs(amp) / 2.4);
    spotMat.opacity = 0.12 + 0.78 * bright;
    spotMat.color.setRGB(0.25 + 0.75 * bright, 0.35 + 0.55 * bright, 0.45 + 0.15 * bright);
    zoneGroup.rotation.z += 0.01;
    src.scale.setScalar(1 + 0.12 * Math.sin(t * 5));
    void rays;
  };
}

/** P76 衍射光栅 / P447 光栅分辨本领与缺级（二次分支） */
function build_grating(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const resolving = title.includes('分辨本领') || title.includes('缺级');
  // 光栅（多缝）
  const NG = 14;
  const gratings: import('three').Mesh[] = [];
  const barGeo = bag.geo(new THREE.BoxGeometry(0.2, 0.5, 0.5));
  const barMat = bag.mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5, roughness: 0.4 }));
  for (let i = 0; i < NG; i++) {
    const m = new THREE.Mesh(barGeo, barMat);
    m.position.set(-2.4, -1.4 + i * 0.21, 0);
    g.add(m);
    gratings.push(m);
  }
  // 入射平面波
  const incLines: import('three').Line[] = [];
  for (let i = 0; i < 6; i++) {
    const z = -2 + i * 0.8;
    const l = new THREE.Line(
      bag.geo(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-7.0, 1.2, z), new THREE.Vector3(-2.4, 1.2, z),
      ])),
      bag.mat(new THREE.LineBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.7 })),
    );
    g.add(l);
    incLines.push(l);
  }
  // 屏幕（衍射条纹）
  const fringe = makeFringe(bag, THREE, 560, 320, 6.4, 5.6, 0.6, 0);
  g.add(fringe.mesh);
  function drawGrating(Nslits: number, d: number): void {
    const W = 560, H = 320;
    fringe.c.fillStyle = '#050a14';
    fringe.c.fillRect(0, 0, W, H);
    const lam = 0.08;
    for (let px = 0; px < W; px++) {
      const X = ((px - W / 2) / W) * 6.4;
      // 单缝包络
      const alpha = (Math.PI * 0.12 * X) / (5.0 * lam);
      const env = Math.abs(Math.sin(alpha) / (alpha || 1e-6)) ** 2;
      // 光栅因子（多缝干涉）
      const beta = (Math.PI * d * X) / (5.0 * lam);
      const gDen = Math.sin(beta) || 1e-6;
      const gNum = Math.sin(Nslits * beta);
      const gl = Nslits * Math.abs(gNum / gDen) ** 2 / (Nslits * Nslits);
      let I = env * gl;
      if (resolving) {
        // 缺级（常在，与 N 无关）：a = d/2 → 单缝包络零点恰落在偶数级上
        const alpha2 = (Math.PI * (d / 2) * X) / (5.0 * lam);
        I *= Math.abs(Math.sin(alpha2) / (alpha2 || 1e-6)) ** 2;
      }
      I = Math.min(1, I);
      const v = Math.round(255 * Math.pow(I, 0.55));
      fringe.c.fillStyle = `rgb(${Math.round(v * 1.0)},${Math.round(v * 0.82)},${Math.round(v * 0.45)})`;
      fringe.c.fillRect(px, H * (1 - I) * 0.86, 1, H);
    }
    if (resolving) {
      // 双线分辨对照：λ（金色）与 λ+Δλ（青色）两条谱线，N 增大 → 主极大变锐 → 逐渐分开
      const lam2 = lam * 1.06;
      fringe.c.strokeStyle = '#22d3ee'; fringe.c.lineWidth = 2;
      fringe.c.beginPath();
      for (let px = 0; px < W; px++) {
        const X = ((px - W / 2) / W) * 6.4;
        const alpha = (Math.PI * 0.12 * X) / (5.0 * lam2);
        const env = Math.abs(Math.sin(alpha) / (alpha || 1e-6)) ** 2;
        const beta = (Math.PI * d * X) / (5.0 * lam2);
        const gDen = Math.sin(beta) || 1e-6;
        const gl = Nslits * Math.abs(Math.sin(Nslits * beta) / gDen) ** 2 / (Nslits * Nslits);
        const alpha2 = (Math.PI * (d / 2) * X) / (5.0 * lam2);
        const env2 = Math.abs(Math.sin(alpha2) / (alpha2 || 1e-6)) ** 2;
        const I2 = Math.min(1, env * gl * env2);
        const yy = H * (1 - I2) * 0.86;
        if (px === 0) fringe.c.moveTo(px, yy); else fringe.c.lineTo(px, yy);
      }
      fringe.c.stroke();
    }
    fringe.c.fillStyle = '#f8fafc'; fringe.c.font = '17px sans-serif';
    fringe.c.fillText(`N = ${Nslits} 缝  d = ${d.toFixed(2)}`, 16, 28);
    fringe.c.fillStyle = resolving ? '#22d3ee' : '#94a3b8';
    fringe.c.fillText(
      resolving ? 'a = d/2 → 第 2、4…级缺级；青色 = λ+Δλ 双线（N 大才分得开）'
        : '光栅方程 d sinθ = mλ',
      16, H - 16,
    );
    fringe.tex.needsUpdate = true;
  }
  drawGrating(NG, 1.5);

  g.add(panelSprite(THREE, bag, resolving ? [
    { text: '分辨本领 R = λ/Δλ = mN：N 越大主极大越锐，双线（λ 与 λ+Δλ）越易分开', color: '#f8fafc' },
    { text: '缺级：d/a = 整数 → 单缝暗纹恰落在某些光栅级上（a = d/2 → 偶数级消失）', color: '#94a3b8' },
    { text: '读数：缺级常在、与 N 无关；N ↑ → 青色双线逐渐分离（R = mN ↑）', color: '#fbbf24' },
  ] : [
    { text: '光栅方程 d sinθ = mλ（m = 0, ±1, ±2…）', color: '#f8fafc' },
    { text: 'N 越大主极大越锐（半宽 ∝ 1/N），条纹更亮更窄', color: '#94a3b8' },
    { text: '读数：相邻主极大间有 N−1 个极小、N−2 个次极大', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.4, 'center'));

  let lastFrame = -1;
  return (t: number) => {
    const N = resolving ? Math.max(4, Math.round(8 + 8 * (Math.sin(t * 0.5) * 0.5 + 0.5))) : NG;
    const fr = Math.floor(t * 10);
    if (fr !== lastFrame) {
      lastFrame = fr;
      drawGrating(N, 1.5);
      // 光栅条数量随 N 变化（隐藏多余条）
      gratings.forEach((m, i) => { m.visible = i < N; });
    }
    incLines.forEach((l, i) => {
      const m = l.material as import('three').LineBasicMaterial;
      m.opacity = 0.4 + 0.4 * Math.sin(t * 4 + i);
    });
  };
}

/** P313 菲涅耳双面镜 / P312 劳埃德镜实验（二次分支） */
function build_lloyd(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const lloyd = title.includes('劳埃德');
  // 光源
  const src = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.3, 20, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xfde68a, emissive: 0xf59e0b, emissiveIntensity: 1.0 })),
  );
  src.position.set(-6.2, lloyd ? 1.4 : 1.0, 0);
  g.add(src);
  // 镜面（劳埃德：单个平面镜，延伸到屏；菲涅耳双面镜：两面小角度相交的镜子）
  const OX = -0.4, OY = -1.4;      // 两镜交线截面点（菲涅耳）/ 镜面高度（劳埃德）
  const SCREEN_X = 6.2;
  const h = src.position.y - OY;   // 源到镜面高度（劳埃德虚源在镜下 2h 处）
  const mirrorMat = bag.mat(new THREE.MeshStandardMaterial({
    color: 0xcbd5e1, metalness: 0.8, roughness: 0.15, side: THREE.DoubleSide,
  }));
  const mirrors: import('three').Mesh[] = [];
  let beta = 0.05; // 菲涅耳：镜面与水平面的倾角（两镜夹角 α = 2β，动画实时更新）
  if (lloyd) {
    const m = new THREE.Mesh(bag.geo(new THREE.PlaneGeometry(10.0, 3.4)), mirrorMat);
    m.rotation.set(-Math.PI / 2 + 0.001, 0, 0);
    m.position.set(1.1, OY, 0); // 从 x = -3.9 延伸到 x = 6.1（与屏接触）
    g.add(m);
    mirrors.push(m);
  } else {
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(bag.geo(new THREE.PlaneGeometry(5.2, 3.4)), mirrorMat);
      m.position.set(OX, OY, 0); // 倾角每帧由 rotateOnWorldAxis 设定（图面内张开 α）
      g.add(m);
      mirrors.push(m);
    }
  }
  // 反射几何：源关于"过 O、与水平面成 θ 角"镜面的镜像（镜面对称 → 入射角 = 反射角）
  function reflectImage(th: number): [number, number] {
    const dx = src.position.x - OX, dy = src.position.y - OY;
    const sn = Math.sin(th), cs = Math.cos(th);
    const c = -sn * dx + cs * dy; // 源到镜面的法向距离
    return [src.position.x + 2 * c * sn, src.position.y - 2 * c * cs];
  }
  // 屏上落点 → 镜面反射点：虚源到落点的连线与镜面的交点（等价于镜面对称光路）
  function reflectPointOn(th: number, img: [number, number], px: number, py: number): [number, number] {
    const tn = Math.tan(th);
    const t = (OY + tn * (img[0] - OX) - img[1]) / ((py - img[1]) - tn * (px - img[0]));
    return [img[0] + t * (px - img[0]), img[1] + t * (py - img[1])];
  }
  // 光束下边界：过镜面靠屏一端的反射光线打在屏上的高度（两束重叠带的最低点由它决定）
  function beamFloor(img: [number, number], th: number): number {
    const ex = 2.2, ey = OY + Math.tan(th) * (ex - OX);
    return ey + ((ey - img[1]) / (ex - img[0])) * (SCREEN_X - ex);
  }
  // 虚光源（实源的镜像）：劳埃德 1 个；菲涅耳双面镜 2 个
  const virtuals: import('three').Mesh[] = [];
  for (let i = 0; i < (lloyd ? 1 : 2); i++) {
    const v = new THREE.Mesh(
      bag.geo(new THREE.SphereGeometry(0.26, 18, 14)),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, emissive: 0x0891b2, emissiveIntensity: 0.7, transparent: true, opacity: 0.75 })),
    );
    g.add(v);
    virtuals.push(v);
  }
  // 光路：劳埃德 = 直达光 + 一束反射光（掠入射）；菲涅耳 = 两束反射光（直达光被镜面遮断）
  function makeRay(color: number, n: number): import('three').Line {
    const pts: import('three').Vector3[] = [];
    for (let i = 0; i < n; i++) pts.push(new THREE.Vector3());
    const l = new THREE.Line(
      bag.geo(new THREE.BufferGeometry().setFromPoints(pts)),
      bag.mat(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })),
    );
    g.add(l);
    return l;
  }
  function setRay(l: import('three').Line, pts: number[][]): void {
    const attr = l.geometry.getAttribute('position') as import('three').BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < pts.length; i++) {
      arr[i * 3] = pts[i][0]; arr[i * 3 + 1] = pts[i][1]; arr[i * 3 + 2] = pts[i][2];
    }
    attr.needsUpdate = true;
  }
  const directRay = makeRay(PAL.gold, 2);
  const reflRayA = makeRay(PAL.cyan, 3);
  const reflRayB = makeRay(PAL.gold, 3);
  if (!lloyd) directRay.visible = false; else reflRayB.visible = false;
  // 劳埃德：直达光与反射光分别落在接触线上下（重叠带内），反射点由虚源→落点连线与镜面求交
  const lloydImg = reflectImage(0);
  const lloydM = reflectPointOn(0, lloydImg, SCREEN_X, -0.55);
  // 菲涅耳：两束反射光的屏上落点（均在两束重叠带内）
  const fresnelP: [number, number][] = [[SCREEN_X, 3.0], [SCREEN_X, 0.4]];
  if (lloyd) {
    virtuals[0].position.set(lloydImg[0], lloydImg[1], 0);
    setRay(directRay, [[src.position.x, src.position.y, 0], [SCREEN_X, 0.55, 0]]);
    setRay(reflRayA, [[src.position.x, src.position.y, 0], [lloydM[0], lloydM[1], 0], [SCREEN_X, -0.55, 0]]);
  }
  // 观察屏 + 条纹（劳埃德：画布中心 = 镜面延长线 y=-1.4 → β=0 零程差点就是接触线；
  // 菲涅耳：画布中心对齐两束反射光的重叠带）
  const CY = lloyd ? OY : 1.4;
  const screen = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.2, 4.4, 4.4)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.4, roughness: 0.6 })),
  );
  screen.position.set(SCREEN_X, CY, 0);
  g.add(screen);
  const fringe = makeFringe(bag, THREE, 300, 380, 3.4, 6.4, CY, 0);
  g.add(fringe.mesh);
  // anim：菲涅耳双面镜 = 两虚源附加相位差 Δφ；劳埃德镜 = 源高微调量（等效源间距 d 微调）
  // bandLo：干涉带下沿（以画布中心为 0 的 Y），其下只有单束光或阴影
  function drawFringe2(anim: number, bandLo: number, d: number): void {
    const W = 300, H = 380;
    fringe.c.fillStyle = '#050a14';
    fringe.c.fillRect(0, 0, W, H);
    const lam = 0.09; // 示意波长
    const D = 12.4;   // 源到屏距离
    for (let py = 0; py < H; py++) {
      const Y = ((H / 2 - py) / H) * 4.4; // 以条纹中心（镜面延长线/接触线）为 0
      let I;
      if (Y < bandLo) {
        // 劳埃德：镜面以下既无直达光也无反射光（阴影）；菲涅耳：此高度未被两束重叠覆盖
        I = lloyd ? 0.02 : 0.10;
      } else {
        const b2 = (Math.PI * d * Y) / (D * lam);
        // 半波损失：劳埃德反射支附加 π → I = sin²β（β=0 接触线恒为暗纹）
        // 菲涅耳双面镜两束均反射、无相位突变 → I = cos²(β+Δφ)
        I = lloyd ? Math.sin(b2) ** 2 : Math.cos(b2 + anim) ** 2;
      }
      const v = Math.round(255 * Math.pow(I, 0.6));
      fringe.c.fillStyle = `rgb(${Math.round(v * 0.7)},${Math.round(v * 0.85)},${Math.round(v)})`;
      fringe.c.fillRect(0, py, W, 1);
    }
    fringe.c.fillStyle = '#f8fafc'; fringe.c.font = '15px sans-serif';
    if (lloyd) {
      fringe.c.fillText('劳埃德镜：掠入射，反射光有 π 相位突变', 14, 26);
      fringe.c.fillStyle = '#fbbf24';
      fringe.c.fillText('Y = 0（镜面接触线）为暗纹 → 半波损失', 14, H - 44);
      fringe.c.fillStyle = '#94a3b8';
      fringe.c.fillText(`虚源间距 d = 2h = ${(2 * h).toFixed(1)}，Δy = λD/d`, 14, H - 22);
    } else {
      fringe.c.fillText('菲涅耳双面镜：两束反射光干涉（无直达光）', 14, 26);
      fringe.c.fillStyle = '#fbbf24';
      fringe.c.fillText(`夹角 α = ${(2 * beta).toFixed(3)} rad → 虚源间距 d = ${d.toFixed(2)}`, 14, H - 44);
      fringe.c.fillStyle = '#94a3b8';
      fringe.c.fillText('α ↓ → d ↓ → 条纹间距 Δy = λD/d ↑', 14, H - 22);
    }
    fringe.tex.needsUpdate = true;
  }
  // 菲涅耳：随夹角 α = 2β 实时更新虚源、两束反射光路与干涉带下沿
  function fresnelUpdate(): { bandLo: number; d: number } {
    const sA = reflectImage(beta), sB = reflectImage(-beta);
    virtuals[0].position.set(sA[0], sA[1], 0);
    virtuals[1].position.set(sB[0], sB[1], 0);
    const mA = reflectPointOn(beta, sA, fresnelP[0][0], fresnelP[0][1]);
    const mB = reflectPointOn(-beta, sB, fresnelP[1][0], fresnelP[1][1]);
    setRay(reflRayA, [[src.position.x, src.position.y, 0], [mA[0], mA[1], 0], [fresnelP[0][0], fresnelP[0][1], 0]]);
    setRay(reflRayB, [[src.position.x, src.position.y, 0], [mB[0], mB[1], 0], [fresnelP[1][0], fresnelP[1][1], 0]]);
    // 镜面姿态：绕 z 轴各倾 ±β（两镜交线处张角 α = 2β）
    const axis = new THREE.Vector3(0, 0, 1);
    mirrors.forEach((m, i) => {
      m.rotation.set(-Math.PI / 2, 0, 0);
      m.rotateOnWorldAxis(axis, (i ? 1 : -1) * beta);
    });
    // 干涉带下沿 = 两条"过镜面靠屏端"的下边界光线中较高者；d = 两虚源间距（≈ 2α·s）
    const bandLo = Math.max(beamFloor(sA, beta), beamFloor(sB, -beta)) - CY;
    const d = Math.hypot(sA[0] - sB[0], sA[1] - sB[1]);
    return { bandLo, d };
  }
  if (lloyd) drawFringe2(0, 0, 2 * h);
  else {
    const gm = fresnelUpdate();
    drawFringe2(0, gm.bandLo, gm.d);
  }

  g.add(panelSprite(THREE, bag, lloyd ? [
    { text: '劳埃德镜：掠入射下直达光 + 镜面反射光干涉（入射角 = 反射角）', color: '#f8fafc' },
    { text: '反射光存在半波损失 π（光密介质反射）→ 镜边处为暗纹', color: '#94a3b8' },
    { text: '读数：等效相干源为镜下虚源，间距 d = 2h，Δy = λD/d', color: '#fbbf24' },
  ] : [
    { text: '菲涅耳双面镜：两镜夹角 α 极小，两束反射光视为两虚光源', color: '#f8fafc' },
    { text: '两虚源间距 d ≈ 2α·s（s 为源到镜交线距离）', color: '#94a3b8' },
    { text: '读数：α ↓ → d ↓ → 条纹间距 Δy = λD/d ↑（画布实时联动）', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.4, 'center'));

  let lastFrame = -1;
  return (t: number) => {
    const fr = Math.floor(t * 8);
    if (fr !== lastFrame) {
      lastFrame = fr;
      if (lloyd) {
        // 源高微调 → 等效源间距 d 微变，条纹缓慢变化（接触线暗纹不动）
        drawFringe2(Math.sin(t * 0.7), 0, 2 * h + 0.18 * Math.sin(t * 0.7));
      } else {
        beta = 0.05 + 0.012 * Math.sin(t * 0.7); // 两镜夹角缓慢变化
        const gm = fresnelUpdate();
        drawFringe2(0.35 * Math.sin(t * 0.7), gm.bandLo, gm.d);
      }
    }
    src.scale.setScalar(1 + 0.1 * Math.sin(t * 5));
    virtuals.forEach((v, i) => v.scale.setScalar(1 + 0.15 * Math.sin(t * 3 + i)));
  };
}

/** P82 泊松亮斑：圆盘衍射阴影中心出现亮斑 */
function build_poisson(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 点光源
  const src = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.3, 20, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xfde68a, emissive: 0xf59e0b, emissiveIntensity: 1.0 })),
  );
  src.position.set(-6.6, 0, 0);
  g.add(src);
  // 不透明圆盘（障碍物）
  const disk = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(1.5, 1.5, 0.16, 56)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 })),
  );
  disk.rotation.z = Math.PI / 2;
  disk.position.set(-1.4, 0, 0);
  g.add(disk);
  // 阴影屏上的衍射图样（菲涅耳衍射：影子中心亮斑）
  const screen = makeFringe(bag, THREE, 420, 420, 5.2, 5.4, 0, 0);
  g.add(screen.mesh);
  function drawShadow(Rdisk: number): void {
    const W = 420, H = 420;
    const img = screen.c.createImageData(W, H);
    const cx = W / 2, cy = H / 2;
    const R = 96; // 圆盘几何投影半径
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const x = (px - cx), y = (py - cy);
        const r = Math.hypot(x, y);
        // 菲涅耳近似：几何阴影内 = 中心亮斑（振幅 ~2）；阴影外 = 波纹
        let I;
        const u = r / R;
        if (r < R) {
          // 影子中心亮斑：I(0) = 4（相对背景 1），随 r 衰减
          const jitter = Math.cos(u * 7.5) * 0.14;
          I = Math.max(0, 0.12 + 1.7 * Math.max(0, 1 - u * 1.05) ** 1.6 + jitter * (1 - u));
          if (u < 0.12) I = Math.max(I, 2.0); // 泊松亮斑
        } else {
          // 影子外的菲涅耳波纹
          const amp = Math.cos(u * 5.4 + Rdisk) * 0.5 + 0.5;
          I = 0.72 + 0.3 * amp * Math.max(0, 1 - (u - 1) * 0.28);
        }
        I = Math.max(0, Math.min(2.2, I));
        const idx = (py * W + px) * 4;
        const n = Math.min(1, I / 1.6);
        img.data[idx] = Math.round(255 * n);
        img.data[idx + 1] = Math.round(215 * n);
        img.data[idx + 2] = Math.round(150 * n);
        img.data[idx + 3] = 255;
      }
    }
    screen.c.putImageData(img, 0, 0);
    screen.c.strokeStyle = '#334155'; screen.c.lineWidth = 4;
    screen.c.strokeRect(2, 2, W - 4, H - 4);
    screen.c.fillStyle = '#f8fafc'; screen.c.font = '18px sans-serif';
    screen.c.fillText('泊松亮斑：几何阴影中心的亮斑', 16, 30);
    screen.c.fillStyle = '#fbbf24';
    screen.c.fillText('I(0)/I_背景 = 4（理论值；图为教学近似手工设峰）', 16, H - 18);
    screen.tex.needsUpdate = true;
  }
  drawShadow(0);

  g.add(panelSprite(THREE, bag, [
    { text: '泊松亮斑：圆盘衍射的几何阴影中心出现亮斑（1818 年泊松"归谬"）', color: '#f8fafc' },
    { text: '菲涅耳理论预言中心振幅 = 2×自由波（强度 4 倍背景）→ 实验证实', color: '#94a3b8' },
    { text: '读数：影内亮斑半径 ≈ 0.12×圆盘投影半径（教学近似示意）；盘越小亮斑越明显', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.6, 'center'));

  let lastFrame = -1;
  return (t: number, dt: number) => {
    const fr = Math.floor(t * 6);
    if (fr !== lastFrame) { lastFrame = fr; drawShadow(Math.sin(t * 0.8)); }
    // 圆盘微动（波长变化效果等价）
    disk.rotation.x += dt * 0.4;
    src.scale.setScalar(1 + 0.1 * Math.sin(t * 6));
  };
}

/** P522 四分之一波片与椭圆偏振：线偏振 → 快慢轴 → 椭圆/圆偏振 */
function build_polarization(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 起偏器（线偏振）
  const polarizer = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(2.0, 2.0, 0.14, 56)),
    bag.mat(new THREE.MeshStandardMaterial({
      color: PAL.cyan, metalness: 0.4, roughness: 0.4, transparent: true, opacity: 0.5,
    })),
  );
  polarizer.rotation.z = Math.PI / 2;
  polarizer.position.set(-4.6, 0, 0);
  g.add(polarizer);
  // 起偏栅格线（示意透振方向）
  for (let i = -4; i <= 4; i++) {
    const l = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(0.04, 3.6, 0.04)),
      bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.7 })),
    );
    l.position.set(-4.5, 0, i * 0.42);
    g.add(l);
  }
  // 1/4 波片（快慢轴示意）
  const qwp = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.14, 4.2, 4.2)),
    bag.mat(new THREE.MeshStandardMaterial({
      color: 0xc4b5fd, metalness: 0.3, roughness: 0.3, transparent: true, opacity: 0.45,
    })),
  );
  qwp.position.set(-0.6, 0, 0);
  g.add(qwp);
  // 快轴 / 慢轴（与入射偏振 y 成 45° 起始，随波片绕传播轴 x 转动）
  const R2 = Math.SQRT1_2;
  const fastAxis = new THREE.ArrowHelper(
    new THREE.Vector3(0, R2, R2), new THREE.Vector3(-0.6, -1.9, 0), 3.8, PAL.gold, 0.22, 0.11,
  );
  const slowAxis = new THREE.ArrowHelper(
    new THREE.Vector3(0, -R2, R2), new THREE.Vector3(-0.6, -1.9, 0), 3.8, PAL.pink, 0.22, 0.11,
  );
  g.add(fastAxis); g.add(slowAxis);
  // 椭圆偏振轨迹（出射端的电矢量端点轨迹）
  const N = 240;
  const trajGeo = bag.geo(new THREE.BufferGeometry());
  trajGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const traj = new THREE.Line(trajGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.violet, transparent: true, opacity: 0.95 })));
  traj.position.set(4.6, 0, 0);
  g.add(traj);
  // 入射线偏振波（沿 y 方向振荡）
  const incGeo = bag.geo(new THREE.BufferGeometry());
  incGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const incWave = new THREE.Line(incGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.gold })));
  g.add(incWave);
  // 出射波（两个正交分量合成）
  const outY = bag.geo(new THREE.BufferGeometry());
  outY.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const outWaveY = new THREE.Line(outY, bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.85 })));
  g.add(outWaveY);
  const outZ = bag.geo(new THREE.BufferGeometry());
  outZ.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const outWaveZ = new THREE.Line(outZ, bag.mat(new THREE.LineBasicMaterial({ color: PAL.pink, transparent: true, opacity: 0.85 })));
  g.add(outWaveZ);
  // 检偏器（出射端匀速转动）：圆偏振 → 透射亮度不变；椭圆偏振 → 一周两明两暗
  const analyzer = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(1.6, 1.6, 0.12, 56)),
    bag.mat(new THREE.MeshStandardMaterial({
      color: PAL.pink, metalness: 0.4, roughness: 0.4, transparent: true, opacity: 0.4,
    })),
  );
  analyzer.rotation.z = Math.PI / 2;
  analyzer.position.set(2.5, 0, 0);
  g.add(analyzer);
  const anaAxis = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(2.5, -1.5, 0), 3.0, PAL.pink, 0.18, 0.1,
  );
  g.add(anaAxis);
  // 检偏后光强指示（亮度 ∝ 透射强度）
  const anaDotMat = bag.mat(new THREE.MeshStandardMaterial({ color: 0xfde68a, emissive: 0xf59e0b, emissiveIntensity: 1.2 }));
  const anaDot = new THREE.Mesh(bag.geo(new THREE.SphereGeometry(0.26, 20, 16)), anaDotMat);
  anaDot.position.set(3.5, 0, 0);
  g.add(anaDot);

  g.add(panelSprite(THREE, bag, [
    { text: '1/4 波片：起偏方向（y）与快轴成 45° → 快慢轴等幅、δ = π/2 → 出射圆偏振', color: '#f8fafc' },
    { text: '夹角非 45° 时两轴不等幅 → 椭圆偏振；χ = 0°/90°（偏振∥快轴）时偏振态不变', color: '#94a3b8' },
    { text: '读数：δ = 2πΔnd/λ；转动检偏器：圆偏振亮度不变，椭圆一周两明两暗', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.4, 'center'));

  const k = 2.4, w = 5.2;
  return (t: number) => {
    // 波片快轴与入射偏振（y）的夹角 χ：绕传播轴缓慢摆动，45° 时出射为圆偏振
    const chi = Math.PI / 4 + 0.55 * Math.sin(t * 0.5);
    const cf = Math.cos(chi), sf = Math.sin(chi);
    const delta = Math.PI / 2; // 波片引入的相位差
    // 入射线偏振（沿 y）
    const iarr = (incGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    const oarr = (outY.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    const zarr = (outZ.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    const tarr = (trajGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const x = -7 + u * 6.4;
      iarr[i * 3] = x;
      iarr[i * 3 + 1] = 1.4 * Math.cos(k * x - w * t);
      iarr[i * 3 + 2] = 0;
      // 出射：沿快/慢轴分解（χ=45° 两轴等幅 → 圆偏振；χ=0/90° 只有快/慢轴分量 → 偏振态不变）
      const x2 = -0.6 + u * 5.4;
      const ph = k * x2 - w * t;
      const Ef = cf * Math.cos(ph);
      const Es = -sf * Math.cos(ph - delta);
      const Ey = Ef * cf - Es * sf;
      const Ez = Ef * sf + Es * cf;
      oarr[i * 3] = x2;
      oarr[i * 3 + 1] = 1.4 * Ey;
      oarr[i * 3 + 2] = 0;
      zarr[i * 3] = x2;
      zarr[i * 3 + 1] = 1.4 * Ez * 0.6;
      zarr[i * 3 + 2] = 1.4 * Ez;
      // 轨迹（出射端 E 矢量端点：y-z 平面；χ=45° 时为圆）
      const ps = u * Math.PI * 2;
      const Pfs = cf * Math.cos(ps), Pss = -sf * Math.cos(ps - delta);
      tarr[i * 3] = 0; // x 由 traj.position(4.6) 给出 → 轨迹正好在出射端
      tarr[i * 3 + 1] = 1.4 * (Pfs * cf - Pss * sf);
      tarr[i * 3 + 2] = 1.4 * (Pfs * sf + Pss * cf);
    }
    (incGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    (outY.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    (outZ.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    (trajGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    // 波片姿态：快/慢轴箭头跟随旋转；χ=45° → 圆偏振，其余 → 椭圆偏振
    qwp.rotation.x = chi;
    fastAxis.setDirection(new THREE.Vector3(0, cf, sf));
    fastAxis.setLength(3.8, 0.22, 0.11);
    slowAxis.setDirection(new THREE.Vector3(0, -sf, cf));
    slowAxis.setLength(3.8, 0.22, 0.11);
    // 检偏器匀速转动 + 透射光强 ⟨(E·â)²⟩：圆偏振恒定，椭圆偏振两明两暗
    const gam = t * 0.9;
    analyzer.rotation.x = gam;
    anaAxis.setDirection(new THREE.Vector3(0, Math.cos(gam), Math.sin(gam)));
    anaAxis.setLength(3.0, 0.18, 0.1);
    let Ia = 0;
    for (let j = 0; j < 48; j++) {
      const ps = (j / 48) * Math.PI * 2;
      const Pfs = cf * Math.cos(ps), Pss = -sf * Math.cos(ps - delta);
      const ea = (Pfs * cf - Pss * sf) * Math.cos(gam) + (Pfs * sf + Pss * cf) * Math.sin(gam);
      Ia += ea * ea;
    }
    Ia /= 48;
    anaDotMat.emissiveIntensity = 0.2 + 3.5 * Ia;
    anaDot.scale.setScalar(0.8 + 1.4 * Ia);
  };
}

/** P74 单缝衍射 / P520 单缝夫琅禾费衍射（二次分支） */
function build_single_slit(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const fraunhofer = title.includes('夫琅禾费');
  // 平行光入射
  const beamArrows: import('three').ArrowHelper[] = [];
  for (let i = 0; i < 5; i++) {
    const y = -1.6 + i * 0.8;
    const a = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(-7.4, y, 0), 2.4, PAL.gold, 0.2, 0.1,
    );
    g.add(a);
    beamArrows.push(a);
  }
  // 单缝屏（两块挡板留一缝）
  const slitX = -4.4;
  const top = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.2, 3.4, 1.4)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.4, roughness: 0.5 })),
  );
  top.position.set(slitX, 2.4, 0);
  g.add(top);
  const bottom = top.clone();
  bottom.position.y = -2.4;
  g.add(bottom);
  // 可变缝宽（下挡板移动）
  const slitW = 0.6;
  void slitW;
  // 透镜（仅夫琅禾费分支：会聚到焦屏；菲涅耳近场"无透屏"，不画透镜）
  const lens = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(2.6, 36, 24)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.28, roughness: 0.1 })),
  );
  lens.scale.set(0.14, 1, 1);
  lens.position.set(0.6, 0, 0);
  lens.visible = fraunhofer;
  g.add(lens);
  // 衍射波前（球面波，菲涅耳模式下明显弯曲）
  const fronts: import('three').Mesh[] = [];
  const frontGeo = bag.geo(new THREE.SphereGeometry(1, 26, 18, 0, Math.PI * 2, 0.8, Math.PI - 1.6));
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(
      frontGeo,
      bag.mat(new THREE.MeshBasicMaterial({
        color: PAL.cyan, transparent: true, opacity: 0.3, wireframe: true, side: THREE.DoubleSide,
      })),
    );
    m.position.set(slitX, 0, 0);
    g.add(m);
    fronts.push(m);
    (m.userData as Record<string, number>)['seed'] = i * 0.7;
  }
  // 屏幕条纹
  const fringe = makeFringe(bag, THREE, 480, 340, 5.4, 5.8, 0, 0);
  g.add(fringe.mesh);
  function drawSlit(a: number): void {
    const W = 480, H = 340;
    fringe.c.fillStyle = '#050a14';
    fringe.c.fillRect(0, 0, W, H);
    const lam = 0.1;
    for (let px = 0; px < W; px++) {
      const X = ((px - W / 2) / W) * 5.4;
      const alpha = (Math.PI * a * X) / (5.0 * lam);
      const I = Math.abs(Math.sin(alpha) / (alpha || 1e-6)) ** 2;
      const v = Math.round(255 * Math.pow(Math.min(1, I), 0.55));
      fringe.c.fillStyle = `rgb(${Math.round(v * 0.62)},${Math.round(v * 0.82)},${Math.round(v)})`;
      fringe.c.fillRect(px, H * (1 - I) * 0.85, 1, H);
    }
    fringe.c.fillStyle = '#f8fafc'; fringe.c.font = '17px sans-serif';
    fringe.c.fillText(fraunhofer ? 'I = I₀[sinβ/β]²，β = πa sinθ/λ' : '近场示意：强度仍用远场 sinc² 近似', 16, 28);
    fringe.c.fillStyle = '#fbbf24';
    fringe.c.fillText(
      fraunhofer ? `缝宽 a = ${a.toFixed(2)}，极小条件 a sinθ = mλ` : `缝宽 a = ${a.toFixed(2)}（近场示意极小 ≈ a sinθ = mλ）`,
      16, H - 44,
    );
    fringe.c.fillStyle = '#94a3b8';
    fringe.c.fillText(fraunhofer ? '透镜把平行衍射光会聚到焦屏（远场）' : '无透屏：菲涅耳数 N_F = a²/λL 较大', 16, H - 20);
    fringe.tex.needsUpdate = true;
  }
  drawSlit(0.9);

  g.add(panelSprite(THREE, bag, fraunhofer ? [
    { text: '单缝夫琅禾费衍射：I(θ) = I₀[sin(πa sinθ/λ)/(πa sinθ/λ)]²', color: '#f8fafc' },
    { text: '主极大宽 = 2λD/a（次极大宽为其一半），缝越窄中央越宽', color: '#94a3b8' },
    { text: '读数：极小条件 a sinθ = mλ；能量 ~85% 集中在中央主极大', color: '#fbbf24' },
  ] : [
    { text: '单缝衍射：波前上各子波相干叠加（惠更斯–菲涅耳原理）', color: '#f8fafc' },
    { text: '半宽内光程差 ≤ λ/2 → 相消于极小 a sinθ = mλ', color: '#94a3b8' },
    { text: '读数：中央亮纹最亮最宽，两侧次极大强度迅速衰减', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.4, 'center'));

  let lastFrame = -1;
  return (t: number, dt: number) => {
    // 缝宽缓慢变化 → 条纹展宽/收窄
    const a = 0.6 + 1.4 * (Math.sin(t * 0.5) * 0.5 + 0.5);
    const fr = Math.floor(t * 8);
    if (fr !== lastFrame) { lastFrame = fr; drawSlit(a); }
    // 下挡板随缝宽移动（改变开口）
    top.position.y = 0.3 + a / 2 + 1.4;
    bottom.position.y = -(0.3 + a / 2 + 1.4);
    // 衍射波前（菲涅耳模式弯曲更明显）
    fronts.forEach((m) => {
      const seed = (m.userData as Record<string, number>)['seed'];
      const age = ((t * 1.0 + seed) % 3) / 3;
      const r = 0.4 + age * (fraunhofer ? 4.2 : 6.0);
      m.scale.setScalar(r);
      m.position.set(slitX + r * (fraunhofer ? 0.1 : 0.3), 0, 0);
      (m.material as import('three').MeshBasicMaterial).opacity = 0.35 * (1 - age);
    });
    lens.scale.x = 0.14 + 0.04 * Math.sin(t * 2);
    beamArrows.forEach((a2, i) => a2.setLength(2.4 + 0.3 * Math.sin(t * 4 + i), 0.2, 0.1));
    void dt;
  };
}

/** P78 薄膜干涉：等厚干涉条纹 + 膜厚变化（增透/增反） */
function build_thinfilm(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 基底 + 薄膜（楔形，厚度沿 x 变化）
  const substrate = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(8.4, 0.7, 5.4)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.5, roughness: 0.5 })),
  );
  substrate.position.set(-1.4, -2.2, 0);
  g.add(substrate);
  // 楔形膜（上表面倾斜）
  const filmGeo = bag.geo(new THREE.BufferGeometry());
  const verts = new Float32Array([
    -5.6, -1.85, -2.7, 2.8, -1.85, -2.7, 2.8, -1.3, -2.7,
    -5.6, -1.85, -2.7, 2.8, -1.3, -2.7, -5.6, -1.3, -2.7,
    -5.6, -1.85, 2.7, 2.8, -1.3, 2.7, 2.8, -1.85, 2.7,
    -5.6, -1.85, 2.7, -5.6, -1.3, 2.7, 2.8, -1.3, 2.7,
    -5.6, -1.85, -2.7, -5.6, -1.85, 2.7, 2.8, -1.85, 2.7,
    -5.6, -1.85, 2.7, 2.8, -1.85, 2.7, 2.8, -1.3, 2.7,
    -5.6, -1.85, -2.7, 2.8, -1.3, -2.7, -5.6, -1.3, -2.7,
    -5.6, -1.85, -2.7, 2.8, -1.85, 2.7, 2.8, -1.3, 2.7,
  ]);
  filmGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  filmGeo.computeVertexNormals();
  const film = new THREE.Mesh(
    filmGeo,
    bag.mat(new THREE.MeshStandardMaterial({
      color: 0x7dd3fc, metalness: 0.2, roughness: 0.15, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
    })),
  );
  g.add(film);
  // 入射光（斜入射）与两条反射光（上表面 / 下表面）
  const incident = new THREE.Line(
    bag.geo(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-5.0, 3.4, 0), new THREE.Vector3(-2.0, -1.6, 0),
    ])),
    bag.mat(new THREE.LineBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.9 })),
  );
  g.add(incident);
  const refl1 = new THREE.Line(
    bag.geo(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-2.0, -1.6, 0), new THREE.Vector3(0.8, 3.4, 0),
    ])),
    bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.9 })),
  );
  g.add(refl1);
  const refl2 = new THREE.Line(
    bag.geo(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-2.0, -1.9, 0), new THREE.Vector3(0.4, 3.4, 0),
    ])),
    bag.mat(new THREE.LineBasicMaterial({ color: PAL.pink, transparent: true, opacity: 0.9 })),
  );
  g.add(refl2);
  // 干涉条纹屏（等厚条纹：条纹平行于等厚线）
  const fringe = makeFringe(bag, THREE, 540, 300, 6.0, 5.4, 2.2, 0);
  g.add(fringe.mesh);
  function drawFilm(n: number, hl: number): void {
    const W = 540, H = 300;
    const img = fringe.c.createImageData(W, H);
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const x = (px / W) * 8.4;
        // 楔形厚度随 x 线性 + 少量起伏
        const d = 0.05 + (x / 8.4) * 0.9 + 0.06 * Math.sin((py / H) * 3);
        const delta = (4 * Math.PI * n * d) / hl + Math.PI; // 半波损失 π
        const I = Math.cos(delta / 2) ** 2;
        const idx = (py * W + px) * 4;
        img.data[idx] = Math.round(255 * (0.2 + 0.8 * I));
        img.data[idx + 1] = Math.round(180 + 75 * I);
        img.data[idx + 2] = Math.round(90 + 140 * I);
        img.data[idx + 3] = 255;
      }
    }
    fringe.c.putImageData(img, 0, 0);
    fringe.c.fillStyle = '#0b1220'; fringe.c.fillRect(0, 0, W, 44);
    fringe.c.fillStyle = '#f8fafc'; fringe.c.font = '17px sans-serif';
    fringe.c.fillText('等厚干涉：2nd cosθ = (m+½)λ（上表面半波损失 +π，正入射 cosθ=1）', 16, 28);
    fringe.c.fillStyle = '#94a3b8'; fringe.c.fillText('楔角越大 → 条纹越密', 16, H - 14);
    fringe.tex.needsUpdate = true;
  }
  drawFilm(1.38, 0.55);

  g.add(panelSprite(THREE, bag, [
    { text: '薄膜干涉：计入上表面半波损失 +π → 反射亮纹 2n·d·cosθ = (m+½)λ（正入射 cosθ=1）', color: '#f8fafc' },
    { text: '光密膜在光疏基底上：n 膜 > n 基 → 下表面反射无 π，上表面有 π', color: '#94a3b8' },
    { text: '读数：等厚条纹平行于等厚线；增透膜 d = λ/4n（反射相消）', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.6, 'center'));

  let lastFrame = -1;
  return (t: number, dt: number) => {
    // 膜折射率/厚度缓慢变化 → 条纹移动
    const n = 1.38 + 0.25 * Math.sin(t * 0.6);
    const hl = 0.55 + 0.1 * Math.sin(t * 0.4);
    const fr = Math.floor(t * 8);
    if (fr !== lastFrame) { lastFrame = fr; drawFilm(n, hl); }
    // 光线闪烁
    [incident, refl1, refl2].forEach((l, i) => {
      const m = l.material as import('three').LineBasicMaterial;
      m.opacity = 0.5 + 0.5 * Math.abs(Math.sin(t * 5 + i));
    });
    film.position.y = 0.03 * Math.sin(t * 1.2);
    void dt;
  };
}
