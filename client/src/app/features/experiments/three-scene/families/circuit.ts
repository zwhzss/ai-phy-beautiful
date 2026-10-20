import type { SceneContext, SceneInstance } from '../types';
import { scaffold, panelSprite, PAL, ResourceBag } from './_common';

/**
 * 电路族（circuit）：RLC 串联谐振 / 理想变压器互感 / 传输线阻抗匹配。
 * 由 scene-registry 按 slug+variant 绑定：make(variant, title)。
 */
export function make(variant: string, title: string): (ctx: SceneContext) => SceneInstance {
  return (ctx) => scaffold(ctx, {
    title,
    camera: [0, 3.5, 13],
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
    case 'transformer': return transformer(ctx, g, bag, THREE);
    case 'txline': return txline(ctx, g, bag, THREE);
    case 'rlc':
    default: return rlc(ctx, g, bag, THREE);
  }
}

/** 元件：电阻/电感/电容 的示意块 + 标签 */
function chip(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  x: number, y: number, color: number, label: string,
): import('three').Sprite {
  const box = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(1.0, 0.55, 0.5)),
    bag.mat(new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 })),
  );
  box.position.set(x, y, 0);
  g.add(box);
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 64;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#f8fafc'; c.font = 'bold 44px sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(label, 64, 32);
  const tex = bag.tex(new THREE.CanvasTexture(cv));
  const sp = new THREE.Sprite(bag.mat(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })));
  sp.scale.set(1.1, 0.55, 1);
  sp.position.set(x, y + 0.75, 0);
  sp.renderOrder = 998;
  g.add(sp);
  return sp;
}

/** RLC 串联谐振：相量图 + 阻抗三角 + 谐振曲线 */
function rlc(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
) {
  // 回路导线
  const wireGeo = bag.geo(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-4.5, 1.4, 0), new THREE.Vector3(4.5, 1.4, 0),
    new THREE.Vector3(4.5, -1.4, 0), new THREE.Vector3(-4.5, -1.4, 0),
    new THREE.Vector3(-4.5, 1.4, 0),
  ]));
  g.add(new THREE.Line(wireGeo, bag.mat(new THREE.LineBasicMaterial({ color: 0x64748b }))));

  chip(g, bag, THREE, -2.6, 1.4, 0xf59e0b, 'R');
  chip(g, bag, THREE, 0.6, 1.4, 0x06b6d4, 'L');
  chip(g, bag, THREE, 3.6, 1.4, 0xf472b6, 'C');

  // 旋转相量：V_R(同相)、V_L(超前90°)、V_C(滞后90°)
  const phasor = new THREE.Group();
  phasor.position.set(-6.2, -0.6, 0);
  g.add(phasor);
  const mkArrow = (len: number, col: number) => {
    const a = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), len, col, 0.2, 0.1);
    phasor.add(a);
    return a;
  };
  const aR = mkArrow(1.2, PAL.amber);
  const aL = mkArrow(1.5, PAL.cyan);
  const aC = mkArrow(0.9, PAL.pink);
  const aZ = mkArrow(1.6, PAL.white);
  // 参考圆
  const refRing = new THREE.Mesh(
    bag.geo(new THREE.RingGeometry(1.55, 1.6, 64)),
    bag.mat(new THREE.MeshBasicMaterial({ color: 0x334155, side: THREE.DoubleSide })),
  );
  phasor.add(refRing);

  // I(ω) 谐振曲线（右侧画布）
  const cv = document.createElement('canvas');
  cv.width = 320; cv.height = 300;
  const c2 = cv.getContext('2d')!;
  const tex = bag.tex(new THREE.CanvasTexture(cv));
  const plot = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(3.6, 3.375)),
    bag.mat(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false })),
  );
  plot.position.set(6.8, 0.6, 0);
  plot.renderOrder = 997;
  g.add(plot);

  function curveI(Q: number, w: number): number {
    return 1 / Math.sqrt(1 + Q * Q * (w - 1 / w) ** 2);
  }
  function drawRes(qSel: number, wr: number): void {
    const W = 320, H = 300;
    c2.clearRect(0, 0, W, H);
    c2.fillStyle = 'rgba(7,11,20,0.85)'; c2.fillRect(0, 0, W, H);
    c2.strokeStyle = '#334155'; c2.lineWidth = 3; c2.strokeRect(1.5, 1.5, W - 3, H - 3);
    c2.strokeStyle = '#475569'; c2.beginPath();
    c2.moveTo(44, 20); c2.lineTo(44, H - 42); c2.lineTo(W - 16, H - 42); c2.stroke();
    c2.fillStyle = '#94a3b8'; c2.font = '17px sans-serif'; c2.textAlign = 'center';
    c2.fillText('I(ω)', 24, 32); c2.fillText('ω / ω₀', W / 2, H - 12);
    // 三条参考 Q 曲线（暗，作对照）
    const qs = [4, 10, 25];
    qs.forEach((Q, qi) => {
      c2.strokeStyle = '#3f4b5e';
      c2.lineWidth = 2;
      c2.beginPath();
      for (let i = 0; i <= 120; i++) {
        const w = 0.4 + (i / 120) * 2.4;
        const I = curveI(Q, w);
        const px = 44 + ((w - 0.4) / 2.4) * (W - 62);
        const py = (H - 42) - I * (H - 72);
        if (i === 0) c2.moveTo(px, py); else c2.lineTo(px, py);
      }
      c2.stroke();
      c2.fillStyle = '#64748b';
      c2.fillText(`Q=${Q}`, 60 + qi * 80, 44);
    });
    // 当前 Q=qSel 的高亮曲线：随 18s Q 扫描而变尖/钝（qSel 接线到真实驱动）
    c2.strokeStyle = '#f59e0b'; c2.lineWidth = 4;
    c2.beginPath();
    for (let i = 0; i <= 120; i++) {
      const w = 0.4 + (i / 120) * 2.4;
      const I = curveI(qSel, w);
      const px = 44 + ((w - 0.4) / 2.4) * (W - 62);
      const py = (H - 42) - I * (H - 72);
      if (i === 0) c2.moveTo(px, py); else c2.lineTo(px, py);
    }
    c2.stroke();
    // ω₀ 标线
    c2.strokeStyle = '#f8fafc'; c2.setLineDash([5, 5]); c2.lineWidth = 2;
    c2.beginPath(); c2.moveTo(44 + (0.6 / 2.4) * (W - 62), 20); c2.lineTo(44 + (0.6 / 2.4) * (W - 62), H - 42); c2.stroke();
    c2.setLineDash([]);
    c2.fillStyle = '#f8fafc'; c2.fillText('ω₀', 44 + (0.6 / 2.4) * (W - 62) + 16, H - 52);
    // 工作点游标：当前 ω/ω₀=wr 处的 I(wr)（与相量同一 wr 驱动）
    const Iop = curveI(qSel, wr);
    const dotpx = 44 + ((wr - 0.4) / 2.4) * (W - 62);
    const dotpy = (H - 42) - Iop * (H - 72);
    c2.strokeStyle = '#fbbf24'; c2.setLineDash([3, 3]); c2.lineWidth = 1.5;
    c2.beginPath(); c2.moveTo(dotpx, 20); c2.lineTo(dotpx, H - 42); c2.stroke();
    c2.setLineDash([]);
    c2.fillStyle = '#fbbf24';
    c2.beginPath(); c2.arc(dotpx, dotpy, 5, 0, Math.PI * 2); c2.fill();
    c2.font = '15px sans-serif'; c2.textAlign = 'left';
    c2.fillText(`当前 Q=${qSel}`, 150, 70);
    c2.fillText(`ω/ω₀=${wr.toFixed(2)}  I=${Iop.toFixed(2)}`, 150, 90);
    tex.needsUpdate = true;
  }
  drawRes(10, 1.0);

  g.add(panelSprite(THREE, bag, [
    { text: '串联谐振 Z = R + j(ωL − 1/ωC)，ω₀ = 1/√(LC)', color: '#f8fafc' },
    { text: '谐振时 V_L = −V_C 互相抵消，I 达最大 U/R，Q = ω₀L/R', color: '#94a3b8' },
    { text: '相量：V_R 同相 · V_L 超前 90° · V_C 滞后 90°', color: '#fbbf24' },
  ], [0, 4.2, 0], 7.6, 'center'));

  ctx.camera.position.set(0, 3, 13);
  let lastRO = -1;
  return (t: number) => {
    const w = 1.6;
    // Q 扫描（18s）+ 工作频率 wr=ω/ω₀ 绕谐振往复扫描，二者共同驱动相量与曲线
    const qSel = Math.round(4 + 21 * (Math.sin(t * 0.35) * 0.5 + 0.5));
    const wr = 1 + 0.5 * Math.sin(t * 0.6);
    const Xr = qSel * (wr - 1 / wr);          // 带符号净电抗（ω₀ 归一，容性<0/感性>0）
    const Zm = Math.sqrt(1 + Xr * Xr);
    const Iamp = 1 / Zm;                        // 归一化电流幅值
    const VL = Iamp * qSel * wr;                // |V_L|（超前 90°）
    const VC = Iamp * qSel / wr;                // |V_C|（滞后 90°）
    // 相量随时间旋转（固定角速度）
    phasor.rotation.z = -w * t;
    aR.setDirection(new THREE.Vector3(1, 0, 0));
    aL.setDirection(new THREE.Vector3(0, 1, 0));
    aC.setDirection(new THREE.Vector3(0, -1, 0));
    aR.setLength(0.4 + 1.5 * Iamp, 0.18, 0.09);
    aL.setLength(Math.min(2.4, 0.3 + 0.16 * VL), 0.18, 0.09);
    aC.setLength(Math.min(2.4, 0.3 + 0.16 * VC), 0.18, 0.09);
    // 阻抗相量 Z = R + j(ωL − 1/ωC)：用带符号 zy = Xr，可过零从感性(+y)翻到容性(−y)
    aZ.setDirection(new THREE.Vector3(1, Xr, 0).normalize());
    aZ.setLength(Math.min(2.6, 0.8 + 0.14 * Zm), 0.2, 0.1);

    // 谐振曲线以 5Hz 重绘（当前 Q 高亮 + 工作点游标随 wr/qSel 变化）
    const roTick = Math.floor(t * 5);
    if (roTick !== lastRO) { lastRO = roTick; drawRes(qSel, wr); }
  };
}

/** 理想变压器：原/副边绕组 + 铁芯磁通联动 */
function transformer(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
) {
  // 铁芯（矩形框）
  const coreMat = bag.mat(new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7, metalness: 0.4 }));
  const mkCore = (w: number, h: number, t: number, x: number, y: number) => {
    const m = new THREE.Mesh(bag.geo(new THREE.BoxGeometry(w, h, t)), coreMat);
    m.position.set(x, y, 0);
    g.add(m);
  };
  mkCore(5.6, 0.5, 0.6, 0, 1.9);
  mkCore(5.6, 0.5, 0.6, 0, -1.9);
  mkCore(0.5, 3.4, 0.6, -2.55, 0);
  mkCore(0.5, 3.4, 0.6, 2.55, 0);

  // 绕组：原边 N₁ = 9 匝，副边 N₂ = 4 匝（示意匝数比）
  const coil = (cx: number, turns: number, col: number, dir: 1 | -1) => {
    const pts: import('three').Vector3[] = [];
    for (let i = 0; i <= turns * 12; i++) {
      const u = i / (turns * 12);
      const th = u * turns * Math.PI * 2;
      pts.push(new THREE.Vector3(
        cx + 0.75 * Math.cos(th),
        -1.5 + u * 3.0,
        0.75 * Math.sin(th) * dir,
      ));
    }
    const l = new THREE.Line(
      bag.geo(new THREE.BufferGeometry().setFromPoints(pts)),
      bag.mat(new THREE.LineBasicMaterial({ color: col })),
    );
    g.add(l);
    return l;
  };
  coil(-1.35, 9, PAL.amber, 1);
  coil(1.35, 4, PAL.cyan, -1);

  // 磁通（沿铁芯循环的箭头）
  const fluxArrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1.9, 0), 1.2, PAL.violet, 0.22, 0.11,
  );
  g.add(fluxArrow);
  const fluxArrow2 = new THREE.ArrowHelper(
    new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, -1.9, 0), 1.2, PAL.violet, 0.22, 0.11,
  );
  g.add(fluxArrow2);

  // 输入/输出电压 + 电流波形（右侧画布：既变压又变流）
  const cv = document.createElement('canvas');
  cv.width = 340; cv.height = 300;
  const c2 = cv.getContext('2d')!;
  const tex = bag.tex(new THREE.CanvasTexture(cv));
  const plot = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(4.0, (4.0 * 300) / 340)),
    bag.mat(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false })),
  );
  plot.position.set(0, -4.3, 0);
  plot.renderOrder = 997;
  g.add(plot);

  const N1 = 9, N2 = 4;
  function drawWaves(ph: number): void {
    const W = 340, H = 300;
    c2.clearRect(0, 0, W, H);
    c2.fillStyle = 'rgba(7,11,20,0.85)'; c2.fillRect(0, 0, W, H);
    c2.strokeStyle = '#334155'; c2.lineWidth = 3; c2.strokeRect(1.5, 1.5, W - 3, H - 3);
    const draw = (amp: number, col: string, label: string, off: number) => {
      c2.strokeStyle = '#475569'; c2.lineWidth = 1;
      c2.beginPath(); c2.moveTo(36, off); c2.lineTo(W - 14, off); c2.stroke();
      c2.strokeStyle = col; c2.lineWidth = 3; c2.beginPath();
      for (let i = 0; i <= 120; i++) {
        const x = (i / 120) * (W - 56) + 36;
        const y = off - amp * Math.sin((i / 120) * Math.PI * 4 + ph);
        if (i === 0) c2.moveTo(x, y); else c2.lineTo(x, y);
      }
      c2.stroke();
      c2.fillStyle = col; c2.font = '15px sans-serif'; c2.textAlign = 'left';
      c2.fillText(label, 42, off - amp - 5);
    };
    // 电压：V₂ = V₁·N₂/N₁（降压，幅值更小）
    draw(26, '#f59e0b', `V₁ (N₁=${N1})`, 50);
    draw(26 * N2 / N1, '#06b6d4', `V₂ (N₂=${N2})`, 112);
    // 电流：I₂ = I₁·N₁/N₂（升流，幅值更大）——与电压反比，演示"既变压又变流"
    draw(14, '#f472b6', `I₁ (原边)`, 178);
    draw(14 * N1 / N2, '#a78bfa', `I₂ = I₁·N₁/N₂ (副边)`, 240);
    c2.fillStyle = '#f8fafc'; c2.font = '15px sans-serif'; c2.textAlign = 'center';
    c2.fillText(`变压 V₁/V₂ = N₁/N₂ = ${(N1 / N2).toFixed(2)}   变流 I₁/I₂ = N₂/N₁ = ${(N2 / N1).toFixed(2)}`, W / 2, H - 12);
    tex.needsUpdate = true;
  }
  drawWaves(0);

  g.add(panelSprite(THREE, bag, [
    { text: '理想变压器：V₁/V₂ = N₁/N₂，I₁/I₂ = N₂/N₁', color: '#f8fafc' },
    { text: '互感 M = k√(L₁L₂)，铁芯使耦合系数 k → 1', color: '#94a3b8' },
    { text: '磁通 Φ 同时穿过两组绕组，感应电动势 e = −N dΦ/dt', color: '#a78bfa' },
  ], [0, 4.6, 0], 7.6, 'center'));

  ctx.camera.position.set(0, 2.5, 12);
  return (t: number) => {
    const ph = -t * 2.2;
    drawWaves(ph);
    // 磁通沿铁芯循环
    fluxArrow.setDirection(new THREE.Vector3(Math.cos(t * 1.5) >= 0 ? 1 : 1, 0, 0));
    fluxArrow.position.x = ((t * 1.2) % 5) - 2.5;
    fluxArrow2.position.x = 2.5 - ((t * 1.2) % 5);
  };
}

/** 传输线：入射+反射波、VSWR、匹配 vs 失配 */
function txline(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
) {
  const L = 12, N = 260;
  // 两根导线
  for (const y of [0.55, -0.55]) {
    const ln = new THREE.Line(
      bag.geo(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-L / 2, y, 0), new THREE.Vector3(L / 2, y, 0),
      ])),
      bag.mat(new THREE.LineBasicMaterial({ color: 0x64748b })),
    );
    g.add(ln);
  }

  const mkTrace = (col: number, y: number) => {
    const geo = bag.geo(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
    const l = new THREE.Line(geo, bag.mat(new THREE.LineBasicMaterial({ color: col })));
    l.position.y = y;
    g.add(l);
    return geo;
  };
  const geoInc = mkTrace(PAL.cyan, 1.9);   // 入射波
  const geoRef = mkTrace(PAL.pink, 1.9);   // 反射波
  const geoTot = mkTrace(PAL.amber, 0.0);  // 合成驻波

  // 负载（右端）
  const load = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.5, 1.3, 0.5)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, roughness: 0.5 })),
  );
  load.position.set(L / 2, 0, 0);
  g.add(load);
  // 源（左端）
  const src = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.35, 16, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.green, emissive: 0x15803d, emissiveIntensity: 0.5 })),
  );
  src.position.set(-L / 2, 0, 0);
  g.add(src);

  g.add(panelSprite(THREE, bag, [
    { text: '入射 + 反射 = 驻波：VSWR = (1+|Γ|)/(1−|Γ|)', color: '#f8fafc' },
    { text: '匹配 Γ = (Z_L−Z₀)/(Z_L+Z₀) = 0 → 无反射，VSWR = 1', color: '#22c55e' },
    { text: '失配 |Γ| > 0 → 波腹/波节固定，功率不能全部传输', color: '#f472b6' },
  ], [0, 4.4, 0], 7.8, 'center'));

  // 驻波波节/波腹标记：位置由波数 k 决定（与合成波同一 k，波腹波节固定不随 γ/t 移动）
  const k = 1.6;
  const addMark = (x: number, col: number) => {
    const gm = bag.geo(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, -1.35, 0.35), new THREE.Vector3(x, 1.35, 0.35),
    ]));
    g.add(new THREE.Line(gm, bag.mat(new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.6 }))));
  };
  // 波节（合成波包络极小 |1−γ|）：k·x = (n+1/2)π → x=(n+1/2)π/k
  for (let n = 0; ; n++) {
    const xn = (n + 0.5) * Math.PI / k;
    if (xn > L / 2) break;
    addMark(xn, PAL.cyan); addMark(-xn, PAL.cyan);
  }
  // 波腹（合成波包络极大 1+γ）：k·x = nπ → x=nπ/k
  for (let n = 0; ; n++) {
    const xa = n * Math.PI / k;
    if (xa > L / 2) break;
    addMark(xa, PAL.green); if (xa > 0) addMark(-xa, PAL.green);
  }

  // 5Hz 动态读数行：γ=|Γ| 与 VSWR 由画面同一个 gamma 驱动（γ 与画面同源）
  const rcv = document.createElement('canvas');
  rcv.width = 360; rcv.height = 96;
  const rc = rcv.getContext('2d')!;
  const rtex = bag.tex(new THREE.CanvasTexture(rcv));
  const rmesh = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(4.4, 1.17)),
    bag.mat(new THREE.MeshBasicMaterial({ map: rtex, transparent: true, depthTest: false })),
  );
  rmesh.position.set(0, -3.4, 0);
  rmesh.renderOrder = 997;
  g.add(rmesh);
  function drawReadout(gm: number): void {
    rc.clearRect(0, 0, rcv.width, rcv.height);
    rc.fillStyle = 'rgba(7,11,20,0.85)'; rc.fillRect(0, 0, rcv.width, rcv.height);
    rc.strokeStyle = '#334155'; rc.lineWidth = 3; rc.strokeRect(1.5, 1.5, rcv.width - 3, rcv.height - 3);
    const vswr = (1 + gm) / (1 - gm);
    rc.textAlign = 'left'; rc.font = 'bold 20px sans-serif';
    rc.fillStyle = gm < 0.12 ? '#22c55e' : '#f472b6';
    rc.fillText(`|Γ| = γ = ${gm.toFixed(3)}`, 12, 30);
    rc.fillText(`VSWR = ${vswr.toFixed(2)}`, 12, 58);
    rc.fillStyle = '#94a3b8'; rc.font = '15px sans-serif';
    rc.fillText(gm < 0.12 ? '匹配：行波，无驻波' : '失配：驻波比随 γ 升高', 190, 30);
    rc.fillText('青=波节  绿=波腹  间距 = λ/2', 190, 58);
    rtex.needsUpdate = true;
  }
  const gamma0 = 0.31;
  drawReadout(gamma0);

  ctx.camera.position.set(0, 2.6, 13);
  let gamma = gamma0;
  let lastRO = -1;
  return (t: number) => {
    // 失配度缓慢往复变化，演示匹配↔失配
    gamma = 0.62 * (Math.sin(t * 0.28) * 0.5 + 0.5);
    (load.material as import('three').MeshStandardMaterial).color.setHex(
      gamma < 0.12 ? PAL.green : PAL.gold,
    );

    const aInc = geoInc.getAttribute('position') as import('three').BufferAttribute;
    const aRef = geoRef.getAttribute('position') as import('three').BufferAttribute;
    const aTot = geoTot.getAttribute('position') as import('three').BufferAttribute;
    const ai = aInc.array as Float32Array;
    const ar = aRef.array as Float32Array;
    const at = aTot.array as Float32Array;
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * L - L / 2;
      const vi = Math.sin(k * x - 2.2 * t);
      const vr = gamma * Math.sin(k * x + 2.2 * t + Math.PI);
      ai[i * 3] = x; ai[i * 3 + 1] = vi * 0.7; ai[i * 3 + 2] = 0;
      ar[i * 3] = x; ar[i * 3 + 1] = vr * 0.7; ar[i * 3 + 2] = 0;
      at[i * 3] = x; at[i * 3 + 1] = (vi + vr) * 0.7; at[i * 3 + 2] = 0;
    }
    aInc.needsUpdate = true;
    aRef.needsUpdate = true;
    aTot.needsUpdate = true;
    // 读数行以 5Hz 刷新（γ/VSWR 与画面同源）
    const roTick = Math.floor(t * 5);
    if (roTick !== lastRO) { lastRO = roTick; drawReadout(gamma); }
  };
}
