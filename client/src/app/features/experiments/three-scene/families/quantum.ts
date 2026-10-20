import type { SceneContext, SceneInstance } from '../types';
import { scaffold, panelSprite, lineFrom, PAL, ResourceBag } from './_common';
import { tag } from './rayoptics';

/**
 * 量子力学族（quantum）：方势垒与隧穿 / 康普顿与电子衍射 / 氢原子波函数与球谐 /
 * 角动量量子化 / 能级与壳层 / 核物理与反应堆 / 量子谐振子 / 布洛赫球 /
 * 拉比振荡 / 拉曼散射 / 自旋与 SU(2) / 斯特恩-格拉赫 / 真空涨落 /
 * 波包与物质波 / 势阱 / 塞曼与斯塔克效应。
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
    case 'barrier': return build_barrier(g, bag, THREE, title);
    case 'compton': return build_compton(g, bag, THREE, title);
    case 'hydrogen': return build_hydrogen(g, bag, THREE, title);
    case 'ladder': return build_ladder(g, bag, THREE, title);
    case 'levels': return build_levels(g, bag, THREE, title);
    case 'nuclear': return build_nuclear(g, bag, THREE, title);
    case 'qho': return build_qho(g, bag, THREE, title);
    case 'qubit': return build_qubit(g, bag, THREE, title);
    case 'rabi': return build_rabi(g, bag, THREE, title);
    case 'raman': return build_raman(g, bag, THREE, title);
    case 'spin': return build_spin(g, bag, THREE, title);
    case 'sterngerlach': return build_sterngerlach(g, bag, THREE, title);
    case 'vacuum': return build_vacuum(g, bag, THREE, title);
    case 'wavepacket': return build_wavepacket(g, bag, THREE, title);
    case 'well': return build_well(g, bag, THREE, title);
    case 'zeeman': return build_zeeman(g, bag, THREE, title);
    default: return build_barrier(g, bag, THREE, title);
  }
}

/** 便捷：可重绘曲线画布 */
function makePlot(
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
  function frame(titleTxt: string, xlabel: string, ylabel: string): CanvasRenderingContext2D {
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(7,11,20,0.85)';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#334155'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, w - 3, h - 3);
    c.strokeStyle = '#475569'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(46, 18); c.lineTo(46, h - 40); c.lineTo(w - 14, h - 40); c.stroke();
    c.fillStyle = '#f8fafc'; c.font = 'bold 18px sans-serif'; c.textAlign = 'center';
    c.fillText(titleTxt, w / 2, 26);
    c.fillStyle = '#94a3b8'; c.font = '16px sans-serif';
    c.fillText(xlabel, w / 2, h - 10);
    c.save(); c.translate(16, (h - 22) / 2); c.rotate(-Math.PI / 2);
    c.fillText(ylabel, 0, 0); c.restore();
    c.textAlign = 'left';
    return c;
  }
  return { mesh: m, c, frame, tex };
}

/** 便捷：正弦波形线（γ 光子示意），可沿任意方向逐帧更新长度/相位 */
function makeWave(
  THREE: typeof import('three'),
  bag: ResourceBag,
  color: number,
): { line: import('three').Line; set: (x0: number, y0: number, dirX: number, dirY: number, len: number, amp: number, phase: number) => void } {
  const N = 64;
  const geo = bag.geo(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const line = new THREE.Line(geo, bag.mat(new THREE.LineBasicMaterial({ color })));
  const arr = (geo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  // 沿 (dirX,dirY) 传播、垂直方向振荡的正弦线（教学示意）
  function set(x0: number, y0: number, dirX: number, dirY: number, len: number, amp: number, phase: number) {
    const px = -dirY, py = dirX;
    for (let i = 0; i <= N; i++) {
      const s = (i / N) * Math.max(0.001, len);
      const w = amp * Math.sin((s / Math.max(0.001, len)) * Math.PI * 8 + phase);
      arr[i * 3] = x0 + dirX * s + px * w;
      arr[i * 3 + 1] = y0 + dirY * s + py * w;
      arr[i * 3 + 2] = 0;
    }
    (geo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
  }
  return { line, set };
}

/** 便捷：可重绘文本标签（billboard 精灵），用于读数 / 状态文字 */
function makeLabel(
  THREE: typeof import('three'),
  bag: ResourceBag,
  text: string,
  worldW: number,
  opts: { color?: string; font?: string; w?: number; h?: number; bg?: boolean } = {},
): { sprite: import('three').Sprite; set: (txt: string, color?: string) => void } {
  const w = opts.w ?? 384;
  const h = opts.h ?? 84;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!;
  const tex = bag.tex(new THREE.CanvasTexture(cv));
  const sp = new THREE.Sprite(bag.mat(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })));
  sp.scale.set(worldW, (worldW * h) / w, 1);
  sp.renderOrder = 999;
  function set(txt: string, color = opts.color ?? '#fbbf24'): void {
    c.clearRect(0, 0, w, h);
    if (opts.bg) {
      c.fillStyle = 'rgba(7,11,20,0.72)';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(51,65,85,0.9)'; c.lineWidth = 3;
      c.strokeRect(2, 2, w - 4, h - 4);
    }
    c.fillStyle = color;
    c.font = opts.font ?? 'bold 44px "PingFang SC", "Microsoft YaHei", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(txt, w / 2, h / 2, w - 14);
    tex.needsUpdate = true;
  }
  set(text);
  return { sprite: sp, set };
}

/** P175 α 衰变与量子隧穿, P508 方势垒透射系数, P109 量子隧穿, P515 WKB 近似 */
function build_barrier(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const alpha = title.includes('α');
  const wkb = title.includes('WKB');
  // 缓变势垒（WKB）：V(x) = V₀ sech²(x/a)；其余分支保持方势垒
  const V0w = 3.0, aW = 1.6, Kw = 2.2;
  const Vw = (x: number) => V0w / Math.cosh(x / aW) ** 2;
  // α 分支（盖莫夫势垒）：核方阱 V=−V₀(r<R) + 库仑尾 V(r)=2(Z−2)e²/(4πε₀r)（U-238 型，教学单位 MeV/fm）
  const Zt = 92, Rt = 9.4, Bt = 2 * (Zt - 2) * 1.44; // Bt：MeV·fm，V(r)=Bt/r
  const PGO = 2 * Math.sqrt(4 * 931.5) / 197.3;      // 2√(2m_αc²)/ħc，fm⁻¹·MeV⁻⁰·⁵
  const gamowG = (Q: number) => {
    const r3 = Bt / Math.max(0.5, Q);
    if (r3 <= Rt) return 0;
    const xi = Rt / r3;
    return PGO * Math.sqrt(Q) * r3 * (Math.acos(Math.sqrt(xi)) - Math.sqrt(xi * (1 - xi)));
  };
  const RMAX = 40; // 画布/几何的 r 显示范围（fm）
  const rToX = (r: number) => -4.2 + (r / RMAX) * 8.4;
  const Vprof = (r: number) => (r < Rt ? -29 : Math.min(Bt / r, 29));
  const yvA = (v: number) => -1.5 + ((v + 29) / 58) * 3.4;
  let ePlane: import('three').Mesh | null = null;
  let aPart: import('three').Mesh | null = null;
  let turns: import('three').Mesh[] = [];
  // 势垒（方势垒示意块 / WKB 缓变势垒山丘 / α 盖莫夫势垒山丘）
  if (wkb) {
    const shape = new THREE.Shape();
    shape.moveTo(-4.2, 0);
    for (let i = 0; i <= 48; i++) {
      const x = -4.2 + (i / 48) * 8.4;
      shape.lineTo(x, Vw(x));
    }
    shape.lineTo(4.2, 0);
    shape.closePath();
    const hill = new THREE.Mesh(
      bag.geo(new THREE.ExtrudeGeometry(shape, { depth: 2.0, bevelEnabled: false })),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, transparent: true, opacity: 0.5, roughness: 0.5 })),
    );
    hill.position.set(0, -1.5, -1.0); // 底面 y=−1.5，峰高 V₀=3（与方势垒同高），沿 z 居中
    g.add(hill);
    // 能量面 E 与两个转折点 x₁、x₂（禁带 [x₁,x₂] 随 E 移动）
    ePlane = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(9.0, 0.05, 2.4)),
      bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.4 })),
    );
    g.add(ePlane);
    turns = [-1, 1].map((s) => {
      const m = new THREE.Mesh(
        bag.geo(new THREE.BoxGeometry(0.1, 1, 1.6)),
        bag.mat(new THREE.MeshBasicMaterial({ color: PAL.green, transparent: true, opacity: 0.85 })),
      );
      m.position.set(s * 1.2, -1.5, 0);
      g.add(m);
      return m;
    });
  } else if (alpha) {
    // 盖莫夫势垒山丘：阱内平底 + r=R 处跃升至库仑脊 + 1/r 长尾
    const shape = new THREE.Shape();
    shape.moveTo(rToX(0), yvA(Vprof(0)));
    for (let i = 1; i <= 60; i++) {
      const r = (i / 60) * RMAX;
      shape.lineTo(rToX(r), yvA(Vprof(r)));
    }
    shape.lineTo(rToX(RMAX), yvA(-29));
    shape.closePath();
    const hill = new THREE.Mesh(
      bag.geo(new THREE.ExtrudeGeometry(shape, { depth: 2.0, bevelEnabled: false })),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, transparent: true, opacity: 0.5, roughness: 0.5 })),
    );
    hill.position.set(0, 0, -1.0);
    g.add(hill);
    // α 粒子（阱内振荡、碰壁隧穿）
    aPart = new THREE.Mesh(
      bag.geo(new THREE.SphereGeometry(0.18, 16, 12)),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: PAL.gold, emissiveIntensity: 0.6 })),
    );
    g.add(aPart);
    // Q_α 能量面（随扫描移动）
    ePlane = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(8.4, 0.05, 2.2)),
      bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.4 })),
    );
    g.add(ePlane);
  } else {
    const barrier = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(2.4, 3.0, 2.0)),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, transparent: true, opacity: 0.5, roughness: 0.5 })),
    );
    g.add(barrier);
  }
  // 入射/透射粒子流（α 分支改用阱内振荡金球，不叠加通用粒子流）
  const NP = 26;
  const pg = bag.geo(new THREE.BufferGeometry());
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  if (!alpha) {
    g.add(new THREE.Points(pg, bag.mat(new THREE.PointsMaterial({ color: PAL.cyan, size: 0.16, sizeAttenuation: true }))));
  }
  const pa = (pg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  for (let i = 0; i < NP; i++) {
    pa[i * 3] = -6 + Math.random() * 12;
    pa[i * 3 + 1] = (Math.random() - 0.5) * 2.2;
    pa[i * 3 + 2] = (Math.random() - 0.5) * 1.6;
  }
  // 波函数（入射 + 指数衰减 + 透射）
  const N = 200;
  const wg = bag.geo(new THREE.BufferGeometry());
  wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const wave = new THREE.Line(wg, bag.mat(new THREE.LineBasicMaterial({ color: PAL.gold })));
  wave.position.y = 2.6;
  g.add(wave);
  const plot = makePlot(
    bag, THREE,
    wkb ? 380 : 360, wkb ? 470 : 320,
    wkb ? 4.4 : 4.2, 6.6, wkb ? 0.2 : 0.8,
  );
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, wkb ? [
    { text: 'WKB：S(E)=∫√(2m(V−E))dx；深隧穿 T≈e^{−2S/ℏ}，含转折点 π/4 连接取 T=1/(1+e^{2S})', color: '#f8fafc' },
    { text: '转折点由 V(x)=E 解出 x₁,₂=±a·acosh√(V₀/E)；示意：禁带/允许区波数用 |E−V|+0.12 正则化', color: '#94a3b8' },
    { text: '读数：金阴影 = 禁带作用量积分区，金面 = 能量 E，绿柱 = 转折点；青点整段穿透率 = T', color: '#fbbf24' },
    { text: '注意：右图下方阶梯是独立谐振子示意（E_n=(n+½)ħω），不是上半 sech² 垒的能级', color: '#64748b' },
  ] : alpha ? [
    { text: 'α 衰变（盖莫夫）：V(r)=核方阱(r<R)+库仑尾 2(Z−2)e²/(4πε₀r)，α 粒子阱内碰壁隧穿', color: '#f8fafc' },
    { text: 'Geiger–Nuttall：log₁₀T = −(2/ħ)∫√(2m_α(V−Q))dr 随 Q_α 剧变（右图，教学级 WKB）', color: '#94a3b8' },
    { text: '读数：金线 = α 波函数，金球 = α 粒子（穿透按 e^{−G/30} 放大示意，真实 T~10⁻¹⁶…10⁻³⁷）', color: '#fbbf24' },
  ] : [
    { text: '方势垒透射：E<V₀：T = 1/[1 + V₀²sinh²(κL)/(4E(V₀−E))]，κ=√(2m(V₀−E))/ħ', color: '#f8fafc' },
    { text: 'E>V₀：T = 1/[1 + V₀²sin²(k₂L)/(4E(E−V₀))]，k₂L=mπ 共振透射 T=1；E≪V₀ 时 T ∝ e^{−2κL}', color: '#94a3b8' },
    { text: '读数：金线 = 波函数（垒右端振幅 √T、左侧入射+√(1−T) 反射驻波），青点整段穿透率 = T(E)', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const wa = (wg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  const KBAR = 8; // κL|_{E=0} = √(2mV₀)·L/ħ（方垒码内常数，垒宽 L = 2.4）
  // 标准式：E<V₀ 用 sinh²(κL)（指数抑制），E>V₀ 用 sin²(k₂L)（共振透射）
  // E=V₀ 处取解析连续极限 T = [1+(κL)²/4]⁻¹（sinh²(κL)/(4e(1−e)) → (κL)²/4），不做 1e-3 截断
  const Tbar = (e: number) => {
    if (Math.abs(e - 1) < 1e-6) return 1 / (1 + (KBAR * KBAR) / 4);
    if (e < 1) {
      const kL = KBAR * Math.sqrt(1 - e);
      return 1 / (1 + (Math.sinh(kL) ** 2) / (4 * e * (1 - e)));
    }
    const kh = KBAR * Math.sqrt(e - 1);
    return 1 / (1 + (Math.sin(kh) ** 2) / (4 * e * (e - 1)));
  };
  let Tflow = 1; // 当前分支的透射系数（粒子流反弹概率与之同源）
  const drawT = (E: number) => {
    const c = plot.frame('透射系数 T(E)', 'E/V₀', 'T');
    const W = 360, H = 320;
    c.strokeStyle = '#06b6d4'; c.lineWidth = 3; c.beginPath();
    for (let i = 1; i <= 120; i++) {
      const e = (i / 120) * 2;
      const T = Tbar(e);
      const px = 46 + (e / 2) * (W - 62);
      const py = (H - 40) - Math.min(1, T) * (H - 70);
      if (i === 1) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    // E=V₀ 处白虚线（与标注同源）
    const px0 = 46 + 0.5 * (W - 62);
    c.strokeStyle = 'rgba(248,250,252,0.55)'; c.lineWidth = 2; c.setLineDash([7, 6]);
    c.beginPath(); c.moveTo(px0, 40); c.lineTo(px0, H - 40); c.stroke();
    c.setLineDash([]);
    // 当前能量金点：落在 T(E) 曲线上（读数与曲线同源）
    const eCur = Math.min(2, Math.max(0.02, E));
    const tCur = Tbar(eCur);
    const px = 46 + (eCur / 2) * (W - 62);
    const pyCur = (H - 40) - Math.min(1, tCur) * (H - 70);
    c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(px, pyCur, 7, 0, 7); c.fill();
    c.fillStyle = '#94a3b8'; c.font = '13px sans-serif'; c.fillText('白虚线为 E=V₀', 60, 56);
    c.fillText(`连续极限 T(E=V₀) = 1/(1+(κL)²/4) = ${(1 / (1 + KBAR * KBAR / 4)).toFixed(3)}`, 60, 74);
    c.fillText(`当前 E/V₀=${eCur.toFixed(3)}  T=${tCur.toExponential(2)}  √T=${Math.sqrt(tCur).toExponential(2)}`, 60, 92);
    plot.tex.needsUpdate = true;
    return tCur;
  };
  // α 分支画布：盖莫夫（Geiger–Nuttall）曲线 log₁₀T–Q_α，读数与曲线同源
  const drawGamow = (Q: number) => {
    const c = plot.frame('盖莫夫曲线 log₁₀T–Q_α', 'Q_α (MeV)', 'log₁₀T');
    const W = 360, H = 320;
    const pxq = (q: number) => 46 + ((q - 3) / 4) * (W - 62);
    const pyg = (l: number) => (H - 40) - ((l + 40) / 28) * (H - 70); // l ∈ [−40, −12]
    c.strokeStyle = '#06b6d4'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 100; i++) {
      const q = 3 + (i / 100) * 4;
      const l = Math.max(-40, -gamowG(q) / Math.LN10);
      if (i === 0) c.moveTo(pxq(q), pyg(l)); else c.lineTo(pxq(q), pyg(l));
    }
    c.stroke();
    const lCur = Math.max(-40, -gamowG(Q) / Math.LN10);
    c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(pxq(Q), pyg(lCur), 7, 0, 7); c.fill();
    c.fillStyle = '#fbbf24'; c.font = '15px sans-serif'; c.textAlign = 'left';
    c.fillText(`Q=${Q.toFixed(2)} MeV  log₁₀T=${lCur.toFixed(1)}  r₃=${(Bt / Q).toFixed(0)} fm`, 58, 56);
    c.fillStyle = '#94a3b8';
    c.fillText('外转折点 r₃=B/Q 随 Q 移动；T 与金球穿透同源于 WKB 作用量', 58, 76);
    plot.tex.needsUpdate = true;
  };
  // WKB：作用量积分 S(E) = ∫√(2m(V−E)) dx（禁带内），透射率 T = exp(−2S/ℏ)
  const wkbAction = (E: number) => {
    const x2 = aW * Math.acosh(Math.sqrt(V0w / Math.max(0.05, E)));
    const n = 120, dx = (2 * x2) / n;
    let s = 0;
    for (let i = 0; i <= n; i++) {
      const x = -x2 + i * dx;
      s += (i === 0 || i === n ? 0.5 : 1) * Math.sqrt(Math.max(0, Vw(x) - E));
    }
    return Kw * s * dx;
  };
  // 平滑（转折点 π/4 连接 / Massey 约定）形式：S ≫ 1 时退化为 e^{−2S}，S → 0（E → V₀）时给出 1/2
  const Twkb = (E: number) => 1 / (1 + Math.exp(2 * wkbAction(E)));
  // WKB 画布：上半 = 缓变垒 + ∫√(2m(V−E))dx 禁带阴影，下半 = 作用量量子化能级阶梯
  const drawWKB = (E: number, T: number) => {
    const c = plot.c;
    const W = 380, H = 470;
    const px = (xw: number) => 46 + ((xw + 4.2) / 8.4) * (W - 62);
    const pyv = (v: number) => 262 - (v / V0w) * 196;
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(7,11,20,0.85)'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#334155'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, W - 3, H - 3);
    c.fillStyle = '#f8fafc'; c.font = 'bold 17px sans-serif'; c.textAlign = 'center';
    c.fillText('缓变垒透射率 T ≈ exp(−(2/ℏ)∫√(2m(V−E)) dx)', W / 2, 24);
    c.strokeStyle = '#475569'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(40, 40); c.lineTo(40, 262); c.lineTo(W - 12, 262); c.stroke();
    // 势垒曲线 V(x) = V₀ sech²(x/a)
    const curve = () => {
      c.beginPath();
      for (let i = 0; i <= 80; i++) {
        const xw = -4.2 + (i / 80) * 8.4;
        const X = px(xw), Y = pyv(Vw(xw));
        if (i === 0) c.moveTo(X, Y); else c.lineTo(X, Y);
      }
    };
    curve(); c.lineTo(px(4.2), 262); c.lineTo(px(-4.2), 262); c.closePath();
    c.fillStyle = 'rgba(239,68,68,0.16)'; c.fill();
    // 禁带阴影：V>E 的区域，即 ∫√(2m(V−E))dx 的积分区间
    const x2w = aW * Math.acosh(Math.sqrt(V0w / Math.max(0.05, E)));
    c.save();
    c.beginPath();
    for (let i = 0; i <= 60; i++) {
      const xw = -x2w + (i / 60) * 2 * x2w;
      c.lineTo(px(xw), pyv(Vw(xw)));
    }
    c.lineTo(px(x2w), pyv(E)); c.lineTo(px(-x2w), pyv(E)); c.closePath();
    c.clip();
    c.strokeStyle = 'rgba(251,191,36,0.8)'; c.lineWidth = 2;
    for (let k = -10; k < 40; k++) {
      c.beginPath(); c.moveTo(40 + k * 14, 264); c.lineTo(40 + k * 14 + 260, 20); c.stroke();
    }
    c.restore();
    curve(); c.strokeStyle = '#ef4444'; c.lineWidth = 3; c.stroke();
    // 能量线 E 与转折点 x₁、x₂
    c.strokeStyle = '#fbbf24'; c.lineWidth = 2.5; c.setLineDash([8, 6]);
    c.beginPath(); c.moveTo(42, pyv(E)); c.lineTo(W - 14, pyv(E)); c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#22c55e'; c.textAlign = 'center';
    c.fillText('x₁', px(-x2w), 282); c.fillText('x₂', px(x2w), 282);
    c.fillStyle = '#fbbf24'; c.textAlign = 'left';
    c.fillText('E', W - 42, pyv(E) - 8);
    c.fillStyle = '#94a3b8'; c.font = '15px sans-serif';
    c.fillText('V₀', px(0) + 10, pyv(V0w) + 4);
    c.fillStyle = '#fbbf24'; c.font = '16px sans-serif'; c.textAlign = 'center';
    c.fillText(`阴影 = ∫√(2m(V−E))dx，T ≈ ${T.toExponential(2)}`, W / 2, 302);
    // —— 下半：独立谐振子示意 —— ℏ≡1、码内 p = Kw√(E−V)，阱 V(u) = 2.6u² ⇒ ½k = 2.6, m = Kw²/2
    //    ∫p dx = (n+½)π 对谐振子给出 E_n = (n+½)ħω，ω = √(k/m) = 2√2.6/Kw（与上半 sech² 垒无关）
    const OWH = (2 * Math.sqrt(2.6)) / Kw;
    c.fillStyle = '#f8fafc'; c.font = 'bold 16px sans-serif';
    c.fillText('下半（独立示意）：∫p dx = (n+½)πℏ ⇒ E_n = (n+½)ħω', W / 2, 330);
    const wy = (v: number) => 448 - (v / 5.4) * 98;
    const uX = (u: number) => W / 2 + u * 104;
    c.strokeStyle = '#64748b'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 60; i++) {
      const u = -1.45 + (i / 60) * 2.9;
      const X = uX(u), Y = wy(2.6 * u * u);
      if (i === 0) c.moveTo(X, Y); else c.lineTo(X, Y);
    }
    c.stroke();
    for (let n = 0; n < 4; n++) {
      const En = OWH * (n + 0.5);
      const u = Math.min(1.45, Math.sqrt(En / 2.6)); // 经典转折点
      const Y = wy(En);
      c.strokeStyle = '#fbbf24'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(uX(-u), Y); c.lineTo(uX(u), Y); c.stroke();
      c.fillStyle = '#fbbf24'; c.font = '14px sans-serif'; c.textAlign = 'left';
      c.fillText(`n=${n}  E=${En.toFixed(2)}`, 8, Y + 4);
    }
    c.fillStyle = '#94a3b8'; c.font = '13px sans-serif'; c.textAlign = 'left';
    c.fillText(`ħω = ${OWH.toFixed(3)}（m = Kw²/2 = ${(Kw * Kw / 2).toFixed(2)}，V = 2.6u² ⇒ ω = √(5.2/m)）`, 10, H - 8);
    plot.tex.needsUpdate = true;
  };
  if (alpha) drawGamow(4.27); else drawT(0.7);
  if (wkb) drawWKB(1.6, Twkb(1.6));
  const pgAttr = pg.getAttribute('position') as import('three').BufferAttribute;
  let x2W = 1.2, TW = 0.2; // WKB 转折点与透射率（每帧刷新）
  let forbidW = 2.4; // 当前分支的禁带宽度（方垒 = 垒宽 2.4，WKB = x₂−x₁）
  let aR = 2.0, aDir = 1, aFly = -1; // α 粒子：阱内位置(fm)、方向、飞行中 r（<0 表示在阱内）
  return (t: number, dt: number) => {
    const E = wkb
      ? 1.0 + 1.7 * (Math.sin(t * 0.4) * 0.5 + 0.5)
      : alpha
        ? 3.5 + 3.5 * (Math.sin(t * 0.3) * 0.5 + 0.5) // Q_α 扫描 3.5→7.0 MeV
        : 0.5 + 0.6 * (Math.sin(t * 0.4) * 0.5 + 0.5);
    if (wkb) {
      // WKB 波函数：垒外振荡、禁带内按 exp(−∫κ dx) 衰减、垒后以 e^{−S}≈√T 振幅恢复
      x2W = aW * Math.acosh(Math.sqrt(V0w / Math.max(0.05, E)));
      TW = Twkb(E);
      Tflow = TW;
      forbidW = 2 * x2W;
      let sAcc = 0, th = 0;
      for (let i = 0; i <= N; i++) {
        const x = (i / N) * 14 - 7;
        if (i > 0) {
          const xm = ((i - 1) / N) * 14 - 7;
          const xm2 = (x + xm) / 2;
          sAcc += Kw * Math.sqrt(Math.max(0, Vw(xm2) - E)) * (x - xm);
          th += Kw * Math.sqrt(Math.abs(E - Vw(xm2)) + 0.12) * (x - xm);
        }
        wa[i * 3] = x;
        wa[i * 3 + 1] = Math.exp(-sAcc) * Math.sin(th - t * 4) * 0.9; // 不再设 0.05 振幅下限（保证衰减真实）
        wa[i * 3 + 2] = 0;
      }
      // 能量面与两个转折点随 E 移动
      if (ePlane) ePlane.position.y = -1.5 + E;
      turns.forEach((m, i) => {
        m.position.x = (i === 0 ? -1 : 1) * x2W;
        m.scale.y = E;
        m.position.y = -1.5 + E / 2;
      });
      drawWKB(E, TW);
    } else if (alpha) {
      // α 分支：阱内驻波 + 禁带 [R,r₃] 内按 e^{−∫κdr}（示意为 e^{−G/30}）衰减 + r₃ 外出射波
      const r3A = Math.min(Bt / E, RMAX);
      const ampA = Math.exp(-gamowG(E) / 30); // 可视化放大的穿透振幅（与 pEsc 同源）
      for (let i = 0; i <= N; i++) {
        const x = (i / N) * 14 - 7;
        const r = ((x + 4.2) / 8.4) * RMAX; // 与势垒山丘同一 r 映射
        let psi: number;
        if (r <= 0) psi = 0;
        else if (r < Rt) psi = 0.9 * Math.sin(Math.PI * (r / Rt) * 2 - t * 2) * 0.8;
        else if (r < r3A) psi = 0.9 * Math.exp(-((gamowG(E) / 30) * ((r - Rt) / Math.max(0.5, r3A - Rt)))) * Math.sin(r * 1.6 - t * 2);
        else psi = 0.9 * ampA * Math.sin(r * 1.6 - t * 4);
        wa[i * 3] = x;
        wa[i * 3 + 1] = psi;
        wa[i * 3 + 2] = 0;
      }
      // α 粒子：阱内匀速往返、碰内垒壁按 e^{−G/30} 概率隧穿飞出（读数与金球同源）
      if (aPart && ePlane) {
        ePlane.position.y = yvA(E);
        const pEsc = Math.exp(-gamowG(E) / 30);
        if (aFly >= 0) {
          aFly += dt * 18; // 隧穿成功后沿库仑尾飞出（fm/s）
          if (aFly >= RMAX) { aFly = -1; aR = 2.0; aDir = 1; }
        } else {
          aR += aDir * dt * 14;
          if (aR <= 0.4) { aR = 0.4; aDir = 1; }
          if (aR >= Rt - 0.3) {
            aR = Rt - 0.3;
            if (Math.random() < pEsc * dt * 3) aFly = Rt - 0.3; else aDir = -1;
          }
        }
        const rr = aFly >= 0 ? aFly : aR;
        aPart.position.set(
          rToX(rr),
          // 阱内贴阱底；隧穿后沿 Q 面飞行（在库仑脊之下 —— 这正是"穿垒"而非"翻垒"）
          aFly >= 0 ? yvA(E) + 0.28 : yvA(-29) + 0.35,
          0,
        );
      }
      drawGamow(E);
    } else {
      // 方势垒波函数：左侧入射 + √(1−T) 反射（近全反射时趋于驻波）→ 垒内 e^{−κx} → 右侧振幅 √T
      const Tk = drawT(E);
      Tflow = Tk;
      forbidW = 2.4;
      const sqT = Math.sqrt(Tk);
      const sqR = Math.sqrt(Math.max(0, 1 - Tk));
      const kapB = (KBAR / 2.4) * Math.sqrt(Math.max(0, 1 - E)); // 与 T(E) 中 κL = KBAR·√(1−e) 同源（垒宽 2.4）
      const k2B = (KBAR / 2.4) * Math.sqrt(Math.max(0, E - 1)); // E>V₀ 时垒内为行波（振荡解）
      const phB = Math.sin(2.2 * 1.2 - t * 4);
      for (let i = 0; i <= N; i++) {
        const x = (i / N) * 14 - 7;
        let psi: number;
        if (x < -1.2) psi = Math.sin(2.2 * x - t * 4) + sqR * Math.sin(2.2 * x + t * 4 + 2 * 2.2 * 1.2);
        else if (x < 1.2) psi = sqT * (E < 1 ? Math.exp(-kapB * (1.2 - x)) : Math.cos(k2B * (1.2 - x))) * phB;
        else psi = sqT * Math.sin(2.2 * x - t * 4);
        wa[i * 3] = x;
        wa[i * 3 + 1] = psi * 0.8;
        wa[i * 3 + 2] = 0;
      }
    }
    (wg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    // 粒子流：部分穿透，部分反射（α 分支用阱内金球演示，不跑通用粒子流）
    if (!alpha) {
      // 每帧存活概率：整段禁带（宽度 forbidW、速度 2.6）累积后正好等于 T(E) ⇒ 青点穿透比例与曲线同源
      const surv = Math.pow(Math.max(Tflow, 1e-40), (2.6 * dt) / Math.max(0.2, forbidW));
      for (let i = 0; i < NP; i++) {
        pa[i * 3] += dt * 2.6;
        if (pa[i * 3] > 7) {
          pa[i * 3] = -7;
          pa[i * 3 + 1] = (Math.random() - 0.5) * 2.2;
        }
        // 进入势垒后按 T(E) 逐帧决定反弹（WKB 用禁带区间 [−x₂,x₂]，方垒用垒宽 2.4）
        if (wkb) {
          if (pa[i * 3] > -x2W && pa[i * 3] < x2W && Math.random() > surv) {
            pa[i * 3] = -x2W - 0.3;
          }
        } else if (pa[i * 3] > -1.2 && pa[i * 3] < 1.2 && Math.random() > surv) {
          pa[i * 3] = -1.4;
        }
      }
      pgAttr.needsUpdate = true;
    }
  };
}

/** P320 康普顿散射实验, P321 电子衍射实验 */
function build_compton(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const electron = title.includes('电子衍射');
  if (electron) {
    // 电子衍射：电子枪 + 晶体靶 + 衍射环
    const gun = new THREE.Mesh(
      bag.geo(new THREE.CylinderGeometry(0.4, 0.4, 1.6, 20)),
      bag.mat(new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.4 })),
    );
    gun.rotation.z = Math.PI / 2;
    gun.position.set(-6.2, 0, 0);
    g.add(gun);
    // 晶格靶
    const latGeo = bag.geo(new THREE.SphereGeometry(0.16, 10, 8));
    const latMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.slate }));
    for (let i = -3; i <= 3; i++) {
      for (let j = -3; j <= 3; j++) {
        const m = new THREE.Mesh(latGeo, latMat);
        m.position.set(0, i * 0.5, j * 0.5);
        g.add(m);
      }
    }
    // 衍射环（屏幕上）：环半径由布拉格条件反算，不再硬编码
    //   2d sinθ = nλ（n=1），环半径 r = L_screen·tanθ，λ = h/√(2me·U) = 1.226/√U nm
    const L_SCREEN = 5.6; // 靶 → 屏幕的场景距离
    const DS = [0.335, 0.203]; // nm：石墨(002) / 镍(111) 晶面间距（教学取值）
    const lamOf = (U: number) => 1.226 / Math.sqrt(U); // nm
    const rOf = (U: number, d: number) => L_SCREEN * Math.tan(Math.asin(Math.min(0.95, lamOf(U) / (2 * d))));
    const rings: import('three').Mesh[] = [];
    DS.forEach(() => {
      const m = new THREE.Mesh(
        bag.geo(new THREE.RingGeometry(0.97, 1.03, 64)), // 单位半径环，缩放即得 r（几何与读数同源）
        bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold, side: THREE.DoubleSide, transparent: true })),
      );
      m.position.set(L_SCREEN, 0, 0);
      m.rotation.y = Math.PI / 2;
      g.add(m);
      rings.push(m);
    });
    // 电子束
    const beam = lineFrom(THREE, bag, [
      new THREE.Vector3(-5.4, 0, 0), new THREE.Vector3(0, 0, 0),
    ], PAL.cyan);
    g.add(beam);
    const ringLab = makeLabel(THREE, bag, 'U = 50 V', 5.4, {
      color: '#fbbf24', bg: true, w: 640, h: 76, font: 'bold 30px "PingFang SC", "Microsoft YaHei", sans-serif',
    });
    ringLab.sprite.position.set(0, -3.3, 0.4);
    g.add(ringLab.sprite);
    g.add(panelSprite(THREE, bag, [
      { text: '电子衍射（Davisson–Germer）：λ = h/p = h/√(2mE)，布拉格条件 2d sinθ = nλ', color: '#f8fafc' },
      { text: '环半径 r = L·tanθ，θ 由当前加速电压的 λ 反算 ⇒ 电压越低（λ 越大）环越大', color: '#94a3b8' },
      { text: '加速电压 50 V 时 λ ≈ 0.174 nm，与晶面间距同量级 → 衍射环', color: '#94a3b8' },
      { text: `读数：金环 = 两级衍射极大（d = ${DS[0]} / ${DS[1]} nm，L=${L_SCREEN}），电压 40→120 V 扫描`, color: '#fbbf24' },
    ], [0, 4.4, 0], 7.8, 'center'));
    let lastRingT = -1;
    return (t: number) => {
      const volt = 40 + 80 * (Math.sin(t * 0.28) * 0.5 + 0.5); // 加速电压扫描 40→120 V
      rings.forEach((m, i) => {
        const r = rOf(volt, DS[i]);
        m.scale.setScalar(r); // 环半径 = 布拉格解，与读数同源（不再叠加额外缩放）
        (m.material as import('three').MeshBasicMaterial).opacity = 0.7 + 0.3 * Math.sin(t * 5 + i);
      });
      if (t - lastRingT > 0.2) {
        lastRingT = t;
        const lm = lamOf(volt);
        ringLab.set(`U=${volt.toFixed(0)} V  λ=${lm.toFixed(3)} nm  r₁=${rOf(volt, DS[0]).toFixed(2)} r₂=${rOf(volt, DS[1]).toFixed(2)}`);
      }
      g.rotation.y = 0.15 * Math.sin(t * 0.3);
    };
  }

  // 康普顿散射：光子与静止电子碰撞，波长偏移
  const photon = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.3, 16, 12)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, emissive: 0xb91c1c, emissiveIntensity: 1 })),
  );
  g.add(photon);
  const electronM = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.4, 18, 14)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, emissive: 0x0891b2, emissiveIntensity: 0.5 })),
  );
  g.add(electronM);
  // 散射后光子/电子轨迹（基线沿入射方向 +x ⇒ rotation.z 直接就是散射角 θ）
  const out1 = lineFrom(THREE, bag, [
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(4.5, 0, 0),
  ], PAL.red);
  // 反冲电子：低能极限 φ = π/2 − θ/2（θ=0 → 侧向 90°，θ=π → 正前 0°）
  const out2 = lineFrom(THREE, bag, [
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(3.4, 0, 0),
  ], PAL.cyan);
  g.add(out1); g.add(out2);
  const plot = makePlot(bag, THREE, 360, 320, 4.2, 6.6, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '康普顿散射：Δλ = λ′ − λ = (h/m_ec)(1 − cosθ)', color: '#f8fafc' },
    { text: '康普顿波长 λ_C = h/m_ec ≈ 0.00243 nm，光子把能量传给电子', color: '#94a3b8' },
    { text: '读数：红 = 散射光子（转过 θ），青 = 反冲电子（φ = π/2 − θ/2，低能极限）', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawDelta = (theta: number) => {
    const c = plot.frame('Δλ vs θ', 'θ (rad)', 'Δλ (λ_C)');
    const W = 360, H = 320;
    c.strokeStyle = '#f472b6'; c.lineWidth = 3; c.beginPath();
    for (let i = 1; i <= 100; i++) {
      const th = (i / 100) * Math.PI;
      const dl = 1 - Math.cos(th);
      const px = 46 + (th / Math.PI) * (W - 62);
      const py = (H - 40) - dl * (H - 70) / 2;
      if (i === 1) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    const dl = 1 - Math.cos(theta);
    const px = 46 + (theta / Math.PI) * (W - 62);
    const py = (H - 40) - dl * (H - 70) / 2;
    c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(px, py, 7, 0, 7); c.fill();
    plot.tex.needsUpdate = true;
  };
  drawDelta(1.0);
  return (t: number) => {
    const theta = (Math.sin(t * 0.5) * 0.5 + 0.5) * Math.PI;
    // 光子轨迹入射段
    photon.position.set(-4.5 + ((t * 3) % 4.5), 0, 0);
    electronM.scale.setScalar(1 + 0.25 * Math.sin(t * 4));
    out1.rotation.z = theta; // θ 即散射角：θ=0 沿入射方向直行、θ=π 完全反打
    out1.visible = ((t * 3) % 4.5) > 4.0;
    out2.rotation.z = theta / 2 - Math.PI / 2; // 反冲电子在入射轴另一侧（横向动量守恒），|φ| = π/2 − θ/2
    out2.visible = out1.visible;
    drawDelta(theta);
  };
}

/** P151 氢原子波函数, P537 勒让德多项式与球谐函数 */
function build_hydrogen(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const harm = title.includes('勒让德') || title.includes('球谐');
  // 勒让德/球谐分支：改画 |Y_l0| 瓣状角向曲面 + P_l(x) 曲线族（画布与形态均不同于氢原子分支）
  if (harm) return build_harmonics(g, bag, THREE);
  // 核
  const nucleus = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.4, 20, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, emissive: 0xb91c1c, emissiveIntensity: 0.8 })),
  );
  g.add(nucleus);
  // 电子云（p 轨道双瓣 / 1s 球形）
  const cloudGeo = bag.geo(new THREE.SphereGeometry(2.6, 36, 24, 0, Math.PI * 2, 0, Math.PI));
  const cloud = new THREE.Mesh(cloudGeo, bag.mat(new THREE.MeshBasicMaterial({
    color: PAL.cyan, wireframe: true, transparent: true, opacity: 0.35,
  })));
  g.add(cloud);
  // p 轨道瓣（两叶）
  const lobeGeo = bag.geo(new THREE.SphereGeometry(1.2, 24, 18));
  const lobeMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.violet, transparent: true, opacity: 0.45 }));
  const lobe1 = new THREE.Mesh(lobeGeo, lobeMat);
  lobe1.position.y = 1.8;
  const lobe2 = new THREE.Mesh(lobeGeo, lobeMat);
  lobe2.position.y = -1.8;
  g.add(lobe1); g.add(lobe2);
  // d 轨道四瓣云（l=2 的 |Y_22| 样式：四叶在屏幕平面内两两相对，与 p 双瓣交替凸显）
  const dMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.pink, transparent: true, opacity: 0.08, depthWrite: false }));
  const dLobes: import('three').Mesh[] = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4].map((a) => {
    const m = new THREE.Mesh(lobeGeo, dMat);
    m.position.set(1.6 * Math.cos(a), 1.6 * Math.sin(a), 0);
    m.rotation.z = a + Math.PI / 2; // 长轴（局部 y）转到瓣的径向方向
    m.scale.set(0.52, 0.8, 0.52);
    g.add(m);
    return m;
  });
  const orbLab = makeLabel(THREE, bag, '2p 双瓣（l=1）', 4.0, {
    color: '#c4b5fd', bg: true, w: 448, h: 76, font: 'bold 30px "PingFang SC", "Microsoft YaHei", sans-serif',
  });
  orbLab.sprite.position.set(0, 2.7, 1.2);
  g.add(orbLab.sprite);
  // 轨道电子
  const e = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.2, 14, 12)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: 0xb45309, emissiveIntensity: 0.9 })),
  );
  g.add(e);
  const plot = makePlot(bag, THREE, 360, 320, 4.2, 6.6, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '氢原子波函数 ψ_nlm = R_nl(r) Y_lm(θ,φ)，E_n = −13.6/n² eV', color: '#f8fafc' },
    { text: '1s 球对称、2p 双瓣哑铃（紫）、d 四瓣云（l=2，粉）→ 角量子数 l 决定形状', color: '#94a3b8' },
    { text: '读数：金点 = 电子，青线框 = 概率云；右图 = 2p 径向概率（峰在 r=4a₀、无节点）', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  // 2p 径向概率密度 P(r)dr ∝ r⁴e^{−r/a₀}dr（n=2,l=1 无径向节点，峰 x=4）
  const pRad = (x: number) => (x ** 4) * Math.exp(-x) / (4 ** 4 * Math.exp(-4));
  const drawRadial = (r: number) => {
    const c = plot.frame('2p 径向概率 P(r) ∝ r⁴e^(−r/a₀)', 'r/a₀', 'P');
    const W = 360, H = 320;
    c.strokeStyle = '#06b6d4'; c.lineWidth = 3; c.beginPath();
    for (let i = 1; i <= 120; i++) {
      const x = (i / 120) * 8;
      const P = pRad(x);
      const px = 46 + (x / 8) * (W - 62);
      const py = (H - 40) - Math.min(1, P) * (H - 70);
      if (i === 1) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    // 峰位标注 r = 4a₀（2p 最概然半径，与曲线同源）
    c.strokeStyle = 'rgba(248,250,252,0.45)'; c.lineWidth = 2; c.setLineDash([6, 5]);
    c.beginPath(); c.moveTo(46 + (4 / 8) * (W - 62), 40); c.lineTo(46 + (4 / 8) * (W - 62), H - 40); c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#94a3b8'; c.font = '13px sans-serif'; c.fillText('峰 r=4a₀（无径向节点）', 46 + (4 / 8) * (W - 62) + 6, 58);
    const P = pRad(r);
    const px = 46 + (r / 8) * (W - 62);
    const py = (H - 40) - Math.min(1, P) * (H - 70);
    c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(px, py, 7, 0, 7); c.fill();
    c.fillText(`r=${r.toFixed(2)}a₀  P=${P.toFixed(3)}`, 60, 78);
    plot.tex.needsUpdate = true;
  };
  drawRadial(2.0);
  let lastOrb = -1;
  return (t: number) => {
    g.rotation.y = t * 0.2;
    cloud.rotation.y = t * 0.4;
    const r = 2.2 + 0.4 * Math.sin(t * 1.4);
    e.position.set(r * Math.cos(t * 2.2), 0.4 * Math.sin(t * 1.6), r * Math.sin(t * 2.2));
    drawRadial(Math.max(0.2, r));
    // p 双瓣 ↔ d 四瓣交替凸显（同一时刻另一组淡出，两种角向形态都真实成形）
    const k = Math.sin(t * 0.5) * 0.5 + 0.5;
    lobeMat.opacity = 0.1 + 0.4 * k;
    dMat.opacity = 0.08 + 0.4 * (1 - k);
    dLobes.forEach((m) => { m.scale.set(0.5 + 0.06 * (1 - k), 0.78 + 0.1 * (1 - k), 0.5); });
    const orb = k >= 0.5 ? 1 : 2;
    if (orb !== lastOrb) {
      lastOrb = orb;
      orbLab.set(orb === 1 ? '2p 双瓣（l=1）' : 'd 四瓣云（l=2）', orb === 1 ? '#c4b5fd' : '#f9a8d4');
    }
  };
}

/** 勒让德/球谐分支：按角向分布 |Y_l0(θ)| 生成瓣状曲面 + P_l(x) 曲线族画布（示意） */
function build_harmonics(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
): (t: number, dt: number) => void {
  // 氢核
  const nucleus = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.4, 20, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, emissive: 0xb91c1c, emissiveIntensity: 0.8 })),
  );
  g.add(nucleus);
  // 参考球面 r = const（细线框，衬托角向起伏）
  const ref = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(2.6, 36, 24)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan, wireframe: true, transparent: true, opacity: 0.12 })),
  );
  g.add(ref);
  // 角向瓣状曲面：单位球顶点按 r = 0.3 + 2.3·|P_l(cosθ)| 径向调制（m = 0）
  //   l=1 → 哑铃（p 轨道）；l=2 → 沿轴两瓣 + 赤道环带（四瓣样式）
  const baseGeo = bag.geo(new THREE.SphereGeometry(1, 48, 32));
  function angularLobes(l: number, color: number): import('three').Mesh {
    const geo = bag.geo(baseGeo.clone());
    const pos = geo.getAttribute('position') as import('three').BufferAttribute;
    const arr = pos.array as Float32Array;
    const pl = (c: number) => (l === 1 ? c : (3 * c * c - 1) / 2);
    for (let i = 0; i < arr.length; i += 3) {
      const r = 0.3 + 2.3 * Math.abs(pl(arr[i + 1])); // 单位球：y = cosθ
      arr[i] *= r; arr[i + 1] *= r; arr[i + 2] *= r;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, bag.mat(new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.45, depthWrite: false,
    })));
    g.add(m);
    return m;
  }
  const y1 = angularLobes(1, PAL.violet); // |Y_10| 哑铃
  const y2 = angularLobes(2, PAL.pink);   // |Y_20| 四瓣
  // 电子（金点）沿参考球面绕行
  const e = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.2, 14, 12)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: 0xb45309, emissiveIntensity: 0.9 })),
  );
  g.add(e);
  const plot = makePlot(bag, THREE, 360, 320, 4.2, 6.6, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '角向分布曲面：r = 0.3 + 2.3·|P_l(cosθ)|（取 m=0，示意）', color: '#f8fafc' },
    { text: 'P_l(x)：l=0 常数 / l=1 直线 x / l=2 (3x²−1)/2 → 瓣状结构', color: '#94a3b8' },
    { text: '读数：紫面 = |Y_10| 哑铃，粉面 = |Y_20| 四瓣，随时序此消彼长', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawPlFamily = (lCur: number) => {
    const c = plot.frame('勒让德多项式 P_l(x)', 'x = cosθ', 'P_l(x)');
    const W = 360, H = 320;
    const cols = ['#64748b', '#a78bfa', '#f472b6'];
    for (let l = 0; l <= 2; l++) {
      c.strokeStyle = cols[l]; c.lineWidth = l === lCur ? 6 : 2.5; c.beginPath();
      for (let i = 0; i <= 100; i++) {
        const x = (i / 100) * 2 - 1;
        const v = l === 0 ? 1 : l === 1 ? x : (3 * x * x - 1) / 2;
        const px = 46 + ((x + 1) / 2) * (W - 62);
        const py = (H - 40) - ((v + 1) / 2) * (H - 70);
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
    }
    c.fillStyle = '#94a3b8'; c.textAlign = 'left';
    c.fillText('灰 l=0 · 紫 l=1 · 粉 l=2（粗线为当前瓣）', 60, 56);
    plot.tex.needsUpdate = true;
  };
  drawPlFamily(1);
  return (t: number) => {
    ref.rotation.y = t * 0.3;
    // l=1 与 l=2 并存、交替凸显（透明度与尺度轮变）
    const k = Math.sin(t * 0.8) * 0.5 + 0.5;
    y1.rotation.y = t * 0.5; y2.rotation.y = t * 0.5;
    (y1.material as import('three').MeshBasicMaterial).opacity = 0.16 + 0.44 * k;
    (y2.material as import('three').MeshBasicMaterial).opacity = 0.16 + 0.44 * (1 - k);
    y1.scale.setScalar(0.92 + 0.1 * k);
    y2.scale.setScalar(0.92 + 0.1 * (1 - k));
    const a = t * 2.2;
    e.position.set(2.6 * Math.cos(a), 0.5 * Math.sin(t * 1.3), 2.6 * Math.sin(a));
    drawPlFamily(k >= 0.5 ? 1 : 2);
  };
}

/** P110 角动量量子化 */
function build_ladder(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 角动量矢量（在锥面上进动，量子化投影 m）
  const LL = 2.6; // |L| 箭头长度（场景单位）
  const TILT = Math.acos(1 / Math.sqrt(6)); // cosθ = m/√(l(l+1))，l=2、m=1 → 65.9°
  const L = new THREE.ArrowHelper(
    new THREE.Vector3(Math.sin(TILT), Math.cos(TILT), 0), new THREE.Vector3(), LL, PAL.cyan, 0.24, 0.12,
  );
  g.add(L);
  // 量子化锥：顶点放在圆心、半顶角严格等于 L 的倾角 ⇒ 底圆就是 L 尖端的进动圆（几何与 m 同源）
  const coneH = LL * Math.cos(TILT), coneR = LL * Math.sin(TILT);
  const cone = new THREE.Mesh(
    bag.geo(new THREE.ConeGeometry(coneR, coneH, 40, 1, true)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.violet, wireframe: true, transparent: true, opacity: 0.4 })),
  );
  cone.position.y = coneH / 2; // 翻转后顶点落到原点
  cone.rotation.x = Math.PI;
  g.add(cone);
  // —— 自旋 1/2 对照（左侧小图）：|S| = √(3/4)ħ，S_z = ±ħ/2 → 两套半顶角 54.7°/125.3° 的锥 ——
  const IX = -5.4; // 对照小图圆心
  const SLT = Math.acos(0.5 / Math.sqrt(0.75)); // cosθ = m/√(s(s+1))，s=1/2、m=±1/2
  const SLEN = 1.5;
  const sH = SLEN * Math.cos(SLT), sR = SLEN * Math.sin(SLT);
  const sArrows = [1, -1].map((s) => {
    const a = new THREE.ArrowHelper(
      new THREE.Vector3(Math.sin(SLT), s * Math.cos(SLT), 0),
      new THREE.Vector3(IX, s * 0.4, 0), SLEN, s > 0 ? PAL.green : PAL.red, 0.18, 0.1,
    );
    g.add(a);
    return a;
  });
  const sCones = [1, -1].map((s) => {
    const c = new THREE.Mesh(
      bag.geo(new THREE.ConeGeometry(sR, sH, 24, 1, true)),
      bag.mat(new THREE.MeshBasicMaterial({ color: PAL.slate, wireframe: true, transparent: true, opacity: 0.3 })),
    );
    // 顶点同样落在箭头尾部：上锥翻转、下锥保持默认朝向
    c.rotation.x = s > 0 ? Math.PI : 0;
    c.position.set(IX, s * (0.4 + sH / 2), 0);
    g.add(c);
    return c;
  });
  g.add(lineFrom(THREE, bag, [
    new THREE.Vector3(IX, -1.6, 0), new THREE.Vector3(IX, 1.6, 0),
  ], PAL.slate, true));
  [1, -1].forEach((s) => {
    const tk = new THREE.Mesh(bag.geo(new THREE.SphereGeometry(0.1, 10, 8)), bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold })));
    tk.position.set(IX, s * (0.4 + sH), 0); // m = ±1/2 的两个分立投影
    g.add(tk);
  });
  const sLab = makeLabel(THREE, bag, 's = 1/2：|S| = √3/2 ħ，S_z = ±ħ/2', 3.9, {
    color: '#94a3b8', bg: true, w: 640, h: 76, font: 'bold 34px "PingFang SC", "Microsoft YaHei", sans-serif',
  });
  sLab.sprite.position.set(IX, -2.3, 0);
  g.add(sLab.sprite);
  // 分立投影刻度
  const ticks: import('three').Mesh[] = [];
  const tickGeo = bag.geo(new THREE.SphereGeometry(0.12, 10, 8));
  const tickMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold }));
  for (let m = -2; m <= 2; m++) {
    const y = m * 0.75;
    const tick = new THREE.Mesh(tickGeo, tickMat);
    tick.position.set(0, y, 0);
    g.add(tick);
    ticks.push(tick);
  }
  // L_z 轴
  g.add(lineFrom(THREE, bag, [
    new THREE.Vector3(0, -3, 0), new THREE.Vector3(0, 3, 0),
  ], PAL.slate, true));
  g.add(panelSprite(THREE, bag, [
    { text: '角动量量子化：|L| = √(l(l+1)) ℏ，L_z = m ℏ（m = −l…l）', color: '#f8fafc' },
    { text: '升/降算符 L±|l,m⟩ = ℏ√(l(l+1)−m(m±1)) |l,m±1⟩（梯子结构）', color: '#94a3b8' },
    { text: '自旋 1/2：|S| = √(3/4)ℏ，S_z = ±ℏ/2 → 只有两套锥（左下小图，金点为两个投影）', color: '#94a3b8' },
    { text: '读数：金点 = 分立 m 投影，青箭头 = L 在半顶角 = cos⁻¹(m/√(l(l+1))) 的锥面上进动', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  return (t: number) => {
    // L 矢量绕 z 轴进动（倾角与锥面同源）
    const ang = t * 1.2;
    L.setDirection(new THREE.Vector3(
      Math.sin(TILT) * Math.cos(ang),
      Math.cos(TILT),
      Math.sin(TILT) * Math.sin(ang),
    ));
    L.setLength(LL, 0.24, 0.12);
    cone.rotation.y = ang;
    // 自旋 1/2 两分支同步进动（上锥 m=+1/2、下锥 m=−1/2）
    const angS = t * 0.9;
    sArrows.forEach((a, i) => {
      const s = i === 0 ? 1 : -1;
      a.setDirection(new THREE.Vector3(
        Math.sin(SLT) * Math.cos(angS),
        s * Math.cos(SLT),
        Math.sin(SLT) * Math.sin(angS),
      ));
      a.setLength(SLEN, 0.18, 0.1);
    });
    sCones.forEach((c) => { c.rotation.y = angS; });
    ticks.forEach((m, i) => { m.scale.setScalar(1 + 0.3 * Math.sin(t * 2 + i)); });
  };
}

/** P20 氢原子能级与跃迁, P173 壳层模型与幻数 */
function build_levels(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const shell = title.includes('壳层') || title.includes('幻数');
  const plot = makePlot(bag, THREE, 380, 340, 4.4, 6.6, 0.8);
  g.add(plot.mesh);
  // 壳层模型分支：核壳层能级阶梯 + 红/青核子逐层填充（区别于氢原子 -13.6/n²）
  if (shell) return build_shellLevels(g, bag, THREE, plot);
  const photons: import('three').Mesh[] = [];
  const phGeo = bag.geo(new THREE.SphereGeometry(0.14, 12, 10));
  const phMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold }));
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(phGeo, phMat);
    g.add(m);
    photons.push(m);
  }
  // i→f 跃迁扫描表（Lyman 紫外 / Balmer 可见 / Paschen 红外）
  const TRANS = [
    { i: 2, f: 1 }, { i: 3, f: 1 }, { i: 3, f: 2 }, { i: 4, f: 2 }, { i: 5, f: 2 }, { i: 4, f: 3 },
  ];
  const dEOf = (tr: { i: number; f: number }) => 13.6 * (1 / (tr.f * tr.f) - 1 / (tr.i * tr.i));
  const lamOf = (tr: { i: number; f: number }) => 1240 / dEOf(tr); // hc ≈ 1240 eV·nm
  const seriesOf = (f: number) => (f === 1 ? 'Lyman·紫外' : f === 2 ? 'Balmer·可见' : 'Paschen·红外');
  g.add(panelSprite(THREE, bag, [
    { text: '氢原子能级 E_n = −13.6/n² eV，跃迁 ΔE = hν = E_i − E_f', color: '#f8fafc' },
    { text: 'Lyman(紫外, n→1)、Balmer(可见, n→2)、Paschen(红外, n→3)', color: '#94a3b8' },
    { text: '读数：金箭头 = 当前 i→f 跃迁，金光子自该跃迁发射，λ = hc/ΔE 与右图同源', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawLevels = (ti: number) => {
    const tr = TRANS[ti];
    const c = plot.frame('氢原子能级与 i→f 跃迁', '能级（下深上浅，n→∞ 趋电离界）', 'E (eV)');
    const W = 380, H = 340;
    // 修正映射：n=1(E=−13.6) 在画布底部，E→0 趋顶部（旧式漏 +13.6 偏置致全谱出画）
    const pyOf = (E: number) => (H - 40) - ((13.6 + E) / 13.6) * (H - 80);
    c.strokeStyle = '#64748b'; c.lineWidth = 2; c.setLineDash([6, 6]);
    c.beginPath(); c.moveTo(56, pyOf(0)); c.lineTo(W - 24, pyOf(0)); c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#94a3b8'; c.textAlign = 'left'; c.font = '14px sans-serif';
    c.fillText('电离界 n→∞', 62, pyOf(0) - 6);
    for (let n = 1; n <= 5; n++) {
      const E = -13.6 / (n * n);
      const py = pyOf(E);
      const on = n === tr.i || n === tr.f;
      c.strokeStyle = on ? '#fbbf24' : '#06b6d4';
      c.lineWidth = on ? 5 : 3;
      c.beginPath(); c.moveTo(120, py); c.lineTo(W - 30, py); c.stroke();
      c.fillStyle = '#f8fafc'; c.textAlign = 'left'; c.font = '15px sans-serif';
      c.fillText(`n=${n}  ${E.toFixed(2)} eV`, 58, py + 4);
    }
    // i→f 跃迁箭头 + ΔE/λ 读数（与金球发射同源）
    const xi = W - 66;
    const yi = pyOf(-13.6 / (tr.i * tr.i));
    const yf = pyOf(-13.6 / (tr.f * tr.f));
    c.strokeStyle = '#fbbf24'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(xi, yi); c.lineTo(xi, yf); c.stroke();
    c.fillStyle = '#fbbf24';
    c.beginPath(); c.moveTo(xi, yf); c.lineTo(xi - 6, yf + 12); c.lineTo(xi + 6, yf + 12); c.closePath(); c.fill();
    c.font = '15px sans-serif'; c.textAlign = 'center';
    c.fillText(`${tr.i}→${tr.f}`, xi, (yi + yf) / 2 - 6);
    c.textAlign = 'left'; c.font = 'bold 16px sans-serif';
    c.fillText(`ΔE=${dEOf(tr).toFixed(2)} eV  λ=hc/ΔE=${lamOf(tr).toFixed(0)} nm（${seriesOf(tr.f)}）`, 58, H - 56);
    plot.tex.needsUpdate = true;
  };
  drawLevels(0);
  return (t: number) => {
    const ti = Math.floor(t * 0.4) % TRANS.length;
    const tr = TRANS[ti];
    const dE = dEOf(tr);
    drawLevels(ti);
    // 金光子自当前 i→f 跃迁方向发射：速度/仰角 ∝ ΔE（与画布高亮同一跃迁）
    photons.forEach((m, i) => {
      const u = ((t * (0.25 + dE / 34) + i / photons.length) % 1);
      m.position.set(4.9 + u * 4.6, 1.2 + (dE / 13.6) * u * 1.8, 0.6);
      m.scale.setScalar(1 + 0.3 * Math.sin(t * 6 + i));
    });
    g.rotation.y = 0.1 * Math.sin(t * 0.3);
  };
}

/** 壳层模型分支：核壳层能级（自旋-轨道双重线劈裂 + 幻数大能隙，教学示意） */
function build_shellLevels(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  plot: ReturnType<typeof makePlot>,
): (t: number, dt: number) => void {
  // 能级表：e 为示意结合能（大 = 深束缚），cap = 2j+1；magic = 填满该级后的累计幻数
  //         sub = 累计满填但**不是**标准幻数的亚壳层 closure（40 = 填满 1f₅/₂）
  const LV: { name: string; cap: number; e: number; magic?: number; sub?: number }[] = [
    { name: '1s₁/₂', cap: 2, e: 4.0, magic: 2 },
    { name: '1p₃/₂', cap: 4, e: 2.95 },
    { name: '1p₁/₂', cap: 2, e: 2.55, magic: 8 },   // 1p 自旋-轨道劈裂双重线
    { name: '1d₅/₂', cap: 6, e: 1.55 },
    { name: '2s₁/₂', cap: 2, e: 1.15 },
    { name: '1d₃/₂', cap: 4, e: 0.75, magic: 20 },  // 1d 双重线（间隔较小）
    { name: '1f₇/₂', cap: 8, e: -0.35, magic: 28 },
    { name: '2p₃/₂', cap: 4, e: -1.15 },
    { name: '2p₁/₂', cap: 2, e: -1.4 },
    { name: '1f₅/₂', cap: 6, e: -1.7, sub: 40 },    // 亚壳层 closure：Σ=40 非标准幻数
    { name: '1g₉/₂', cap: 10, e: -2.05, magic: 50 },
  ];
  const TOTAL = LV.reduce((s, l) => s + l.cap, 0); // = 50（填满至幻数 50）
  const startOf: number[] = [];
  { let acc = 0; LV.forEach((lv) => { startOf.push(acc); acc += lv.cap; }); }
  const yOf = (e: number) => e * 0.62 - 0.2; // 3D 场景纵坐标（能级越深越低）
  // 能级条 + 核子槽位（逐层填充）
  const bars: import('three').Mesh[] = [];
  const slots: { x: number; y: number }[] = [];
  LV.forEach((lv) => {
    const w = lv.cap * 0.55;
    const bar = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(w, 0.09, 0.5)),
      bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.5 })),
    );
    bar.position.set(-2.8 + w / 2, yOf(lv.e), 0);
    g.add(bar);
    bars.push(bar);
    for (let k = 0; k < lv.cap; k++) slots.push({ x: -2.8 + k * 0.55 + 0.27, y: yOf(lv.e) + 0.22 });
  });
  // 核子球池：红/青交替 = 质子/中子（示意）
  const nucGeo = bag.geo(new THREE.SphereGeometry(0.17, 12, 10));
  const pMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, emissive: 0xb91c1c, emissiveIntensity: 0.4 }));
  const nMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan }));
  const balls: import('three').Mesh[] = [];
  for (let i = 0; i < TOTAL; i++) {
    const m = new THREE.Mesh(nucGeo, i % 2 ? pMat : nMat);
    m.position.set(slots[i].x, slots[i].y, 0.3);
    m.visible = false;
    g.add(m);
    balls.push(m);
  }
  // 幻数 → 能级条索引（满填时脉冲加粗）；Σ=40 亚壳 closure 不参与脉冲（非幻数）
  const magicIdx = new Map<number, number>();
  LV.forEach((lv, li) => { if (lv.magic) magicIdx.set(lv.magic, li); });
  g.add(panelSprite(THREE, bag, [
    { text: '壳层模型：核子逐层填能级，累加 2/8/20/28/50 即（标准）幻数 → 大能隙', color: '#f8fafc' },
    { text: '强自旋-轨道耦合 → j = l±1/2 双重线劈裂（如 1p₃/₂ / 1p₁/₂）', color: '#94a3b8' },
    { text: '双幻核（质子、中子同为幻数）：⁴He(2,2)、⁴⁸Ca(20,28)、²⁰⁸Pb(82,126)', color: '#94a3b8' },
    { text: '读数：金条 = 壳层能级，红/青球 = 质子/中子；Σ=40 是亚壳 closure（非幻数）', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawShell = (nFill: number) => {
    const c = plot.frame('核壳层能级阶梯（示意）', '填充核子数', 'E（深 → 浅）');
    const W = 380, H = 340;
    LV.forEach((lv, li) => {
      const py = 58 + ((4.2 - lv.e) / 6.6) * (H - 118);
      const filled = Math.max(0, Math.min(lv.cap, nFill - startOf[li]));
      c.strokeStyle = lv.magic ? '#fbbf24' : lv.sub ? '#f59e0b' : '#06b6d4';
      c.lineWidth = lv.magic ? 5 : lv.sub ? 4 : 3;
      if (lv.sub) c.setLineDash([9, 6]); // 亚壳 closure：虚线，不算幻数
      c.beginPath(); c.moveTo(96, py); c.lineTo(96 + (lv.cap / 10) * (W - 140), py); c.stroke();
      c.setLineDash([]);
      c.fillStyle = '#f8fafc'; c.textAlign = 'left'; c.font = '15px sans-serif';
      c.fillText(`${lv.name}  Σ=${startOf[li] + lv.cap}`, 58, py - 6);
      // 画布同步显示已填核子点（红/青交替）
      for (let k = 0; k < filled; k++) {
        c.fillStyle = k % 2 ? '#ef4444' : '#06b6d4';
        c.beginPath(); c.arc(102 + (k + 0.5) * ((W - 150) / lv.cap), py + 10, 4, 0, 7); c.fill();
      }
      if (lv.magic) {
        c.fillStyle = '#fbbf24'; c.textAlign = 'right'; c.font = 'bold 15px sans-serif';
        c.fillText(`N=${lv.magic} 幻数`, W - 20, py - 5);
        c.textAlign = 'left';
      } else if (lv.sub) {
        c.fillStyle = '#94a3b8'; c.textAlign = 'right'; c.font = '13px sans-serif';
        c.fillText(`N=${lv.sub} 亚壳 closure（非幻数）`, W - 20, py - 5);
        c.textAlign = 'left';
      }
    });
    c.fillStyle = '#94a3b8'; c.textAlign = 'left'; c.font = '13px sans-serif';
    c.fillText('大能隙=幻数 · 双重线=自旋-轨道劈裂 · 双幻核 ⁴⁸Ca/²⁰⁸Pb', 48, H - 52);
    plot.tex.needsUpdate = true;
  };
  drawShell(2);
  let lastFill = -1;
  return (t: number) => {
    const nFill = Math.floor(t * 1.6) % (TOTAL + 8); // 填满 50 后短暂停顿再循环
    if (nFill !== lastFill) {
      lastFill = nFill;
      for (let i = 0; i < TOTAL; i++) {
        const on = i < nFill;
        balls[i].visible = on;
        if (on) balls[i].scale.setScalar(1 + 0.12 * Math.sin(t * 6 + i));
      }
      bars.forEach((b, li) => {
        const filled = nFill > startOf[li];
        (b.material as import('three').MeshBasicMaterial).opacity = filled ? 1 : 0.45;
      });
      drawShell(Math.min(nFill, TOTAL));
    }
    // 满填幻数的瞬间，对应幻数能级条脉冲加粗
    magicIdx.forEach((li, magic) => {
      bars[li].scale.y = Math.abs(nFill - magic) < 1.5 ? 1.8 : 1;
    });
    g.rotation.y = 0.08 * Math.sin(t * 0.3);
  };
}

/** P177 临界质量, P172 液滴模型与裂变垒, P171 核力与介子交换, P179 核反应堆, P459 对产生与吸收 */
function build_nuclear(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const reactor = title.includes('反应堆');
  const critical = title.includes('临界');
  const force = title.includes('核力');
  const pair = title.includes('对产生');
  const drop = title.includes('液滴');
  // 形态/画布/面板各异的专用分支（介子交换、中子级联、γ→e⁺e⁻、反应堆稳态）
  if (force) return build_nuclear_force(g, bag, THREE);
  if (critical) return build_nuclear_critical(g, bag, THREE);
  if (pair) return build_nuclear_pair(g, bag, THREE);
  if (reactor) return build_nuclear_reactor(g, bag, THREE);
  if (drop) { /* 液滴模型走默认核形变动画 */ }

  // 中心核（可变形）
  const nucleus = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(1.6, 36, 26)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.violet, roughness: 0.5, transparent: true, opacity: 0.85 })),
  );
  g.add(nucleus);
  // 核子（质子/中子）
  const NN = 24;
  const nucleonGeo = bag.geo(new THREE.SphereGeometry(0.3, 14, 12));
  const pMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, emissive: 0xb91c1c, emissiveIntensity: 0.3 }));
  const nMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan }));
  const nucleons: import('three').Mesh[] = [];
  for (let i = 0; i < NN; i++) {
    const m = new THREE.Mesh(nucleonGeo, i % 2 ? pMat : nMat);
    const u = Math.random() * Math.PI * 2;
    const v = Math.acos(2 * Math.random() - 1);
    const r = 1.4 * Math.cbrt(Math.random());
    m.position.set(r * Math.sin(v) * Math.cos(u), r * Math.cos(v), r * Math.sin(v) * Math.sin(u));
    g.add(m);
    nucleons.push(m);
  }
  const plot = makePlot(bag, THREE, 360, 320, 4.2, 6.6, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '液滴模型（五项）：B = a_V A − a_S A^{2/3} − a_C Z²/A^{1/3} − a_A(A−2Z)²/A + δ', color: '#f8fafc' },
    { text: '非对称项 a_A(A−2Z)²/A 惩罚中质失衡；裂变垒 = 形变先升过鞍点、库仑能压过表面能后下降', color: '#94a3b8' },
    { text: '读数：紫球 = 核液滴（拉长 = 形变），金点 = 当前形变在垒曲线上的位置（示意）', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  // 裂变垒（教学示意）：E(x) = E_b·u²e^{2(1−u)}，u = x/x_s → x=0 为基态、x_s 为鞍点（垒顶）、之后下降到断裂
  const XS = 0.6, EB = 1.5, XMAX = 1.6;
  const barE = (x: number) => { const u = x / XS; return EB * u * u * Math.exp(2 * (1 - u)); };
  const drawBarrier = (fission: number) => {
    const c = plot.frame('裂变势垒 E(形变 x)', '形变 x（0 = 球形 → 1.6 = 断裂）', 'E');
    const W = 360, H = 320;
    const pxOf = (x: number) => 46 + (x / XMAX) * (W - 62);
    const pyOf = (e: number) => (H - 40) - (e / 1.6) * (H - 70);
    c.strokeStyle = '#f472b6'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 100; i++) {
      const x = (i / 100) * XMAX;
      const px = pxOf(x), py = pyOf(barE(x));
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    // 鞍点（垒顶）竖线与标注
    c.strokeStyle = 'rgba(248,250,252,0.5)'; c.lineWidth = 2; c.setLineDash([6, 5]);
    c.beginPath(); c.moveTo(pxOf(XS), 40); c.lineTo(pxOf(XS), H - 40); c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#94a3b8'; c.font = '13px sans-serif';
    c.fillText(`鞍点 x_s=${XS}（垒高 E_b=${EB}）`, pxOf(XS) + 8, 58);
    c.fillText('越过鞍点后库仑能释放 → 形状能下降至断裂', 60, H - 56);
    // 当前形变读数点（与紫球拉长同源）
    const x = fission * XMAX;
    c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(pxOf(x), pyOf(barE(x)), 7, 0, 7); c.fill();
    plot.tex.needsUpdate = true;
  };
  drawBarrier(0.4);
  return animateDrop(g, nucleons, nucleus, drawBarrier);
}

// 液滴/裂变垒动画（默认分支共享实现）：核子热运动 + 液滴拉长 = 形变，垒曲线金点随形变扫描
function animateDrop(
  g: import('three').Group,
  nucleons: import('three').Mesh[],
  nucleus: import('three').Mesh,
  draw: (x: number) => void,
): (t: number, dt: number) => void {
  return (t: number) => {
    // 核子热运动
    nucleons.forEach((m, i) => {
      m.position.x += Math.sin(t * 2 + i) * 0.004;
      m.position.y += Math.cos(t * 2.4 + i) * 0.004;
      m.position.z += Math.sin(t * 1.8 + i * 0.7) * 0.004;
      const r = m.position.length();
      if (r > 1.5) m.position.multiplyScalar(1.5 / r);
      m.scale.setScalar(1 + 0.15 * Math.sin(t * 5 + i));
    });
    const fission = (Math.sin(t * 0.5) * 0.5 + 0.5);
    nucleus.scale.set(1 + fission * 0.6, 1 - fission * 0.25, 1 - fission * 0.25);
    draw(fission); // 形变 → 垒曲线上的读数点（与紫球拉长同源）
    g.rotation.y = t * 0.12;
  };
}

/** 核力与介子交换分支：p–n 往复靠近，π 介子在两核子间来回传递；画布为汤川势（示意） */
function build_nuclear_force(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
): (t: number, dt: number) => void {
  // 质子（红）与中子（青）沿 x 轴往复靠近/分开
  const nucGeo = bag.geo(new THREE.SphereGeometry(0.7, 24, 18));
  const proton = new THREE.Mesh(nucGeo, bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, emissive: 0xb91c1c, emissiveIntensity: 0.5, roughness: 0.4 })));
  const neutron = new THREE.Mesh(nucGeo, bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, roughness: 0.4 })));
  g.add(proton); g.add(neutron);
  // π 介子（小金球）在两核子间来回飞行 = 交换力图像
  const pion = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.24, 14, 12)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: 0xb45309, emissiveIntensity: 1 })),
  );
  g.add(pion);
  // 交换视线（细柱，随核子间距伸缩，示意虚粒子传递）
  const bond = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.03, 0.03, 1, 6)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.slate, transparent: true, opacity: 0.35 })),
  );
  bond.rotation.z = Math.PI / 2;
  g.add(bond);
  const plot = makePlot(bag, THREE, 360, 320, 4.2, 6.6, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '核力（汤川势）：V(r) = −g²·e^(−μr)/r，μ = m_π c/ℏ', color: '#f8fafc' },
    { text: '力程 ~1.4 fm（π 介子康普顿波长）：交换 π 介子产生短程吸引', color: '#94a3b8' },
    { text: '硬芯：r < 0.5 fm 处核子急剧互相排斥，V(r) 陡升为正、不能再靠近', color: '#f87171' },
    { text: '读数：红/青 = 质子/中子往复，金球 = 来回传递的 π 介子（示意）', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  // 汤川势曲线 + 硬芯（r < 0.5 fm 排斥）：V = −A·e^(−μr)/r（示意单位），标力程 1.4 fm
  const mu = 1 / 1.4;
  const R_CORE = 0.5;
  const yuk = (r: number) => {
    if (r < R_CORE) {
      // 硬芯：r < 0.5 fm 强子互相排斥，V 由吸引陡升为正（r→0.5⁻ 与汤川吸引连续）
      return -0.25 + 0.4 * Math.sqrt((R_CORE - r) / R_CORE);
    }
    return -0.18 * Math.exp(-mu * r) / r;
  };
  const drawYukawa = (rFm: number) => {
    const c = plot.frame('汤川势 V(r)（含硬芯）', 'r (fm)', 'V（示意单位）');
    const W = 360, H = 320;
    const yOf = (v: number) => (H - 40) - ((v + 1.05) / 1.2) * (H - 70);
    // 硬芯区（r < 0.5 fm）：红底 + 分界虚线 + 标注
    const coreX = 46 + (R_CORE / 3) * (W - 62);
    c.fillStyle = 'rgba(239,68,68,0.16)';
    c.fillRect(46, 30, coreX - 46, H - 74);
    c.strokeStyle = '#ef4444'; c.lineWidth = 2; c.setLineDash([5, 4]);
    c.beginPath(); c.moveTo(coreX, 30); c.lineTo(coreX, H - 40); c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#ef4444'; c.font = 'bold 15px sans-serif'; c.textAlign = 'left';
    c.fillText('硬芯 r<0.5 fm（强排斥）', 50, H - 54);
    // V = 0 参考线（虚线）
    c.strokeStyle = '#475569'; c.lineWidth = 2; c.setLineDash([6, 6]);
    c.beginPath(); c.moveTo(46, yOf(0)); c.lineTo(W - 14, yOf(0)); c.stroke();
    // 势曲线
    c.setLineDash([]);
    c.strokeStyle = '#06b6d4'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 120; i++) {
      const r = 0.05 + (i / 120) * 2.95;
      const px = 46 + (r / 3) * (W - 62);
      if (i === 0) c.moveTo(px, yOf(yuk(r))); else c.lineTo(px, yOf(yuk(r)));
    }
    c.stroke();
    // 力程标记 r = 1.4 fm
    c.strokeStyle = '#fbbf24'; c.lineWidth = 2; c.setLineDash([4, 5]);
    c.beginPath(); c.moveTo(46 + (1.4 / 3) * (W - 62), 40); c.lineTo(46 + (1.4 / 3) * (W - 62), H - 40); c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#fbbf24'; c.fillText('力程 ≈ 1.4 fm', 46 + (1.4 / 3) * (W - 62) - 20, 58);
    // 当前间距读数点
    const px = 46 + (Math.min(3, Math.max(0.2, rFm)) / 3) * (W - 62);
    c.fillStyle = '#f472b6'; c.beginPath(); c.arc(px, yOf(yuk(rFm)), 7, 0, 7); c.fill();
    plot.tex.needsUpdate = true;
  };
  drawYukawa(1.8);
  return (t: number) => {
    const sep = 2.4 + 0.9 * Math.sin(t * 1.6); // 核子间距（场景单位）
    proton.position.set(-sep / 2, 0, 0);
    neutron.position.set(sep / 2, 0, 0);
    bond.scale.y = sep;
    // π 介子三角波往返：质子 → 中子 → 质子（往复交换）
    const u = (t * 0.7) % 1;
    const tri = u < 0.5 ? u * 2 : 2 - u * 2;
    pion.position.set(-sep / 2 + tri * sep, 0.18 * Math.sin(tri * Math.PI), 0.35);
    pion.scale.setScalar(1 + 0.2 * Math.sin(t * 8));
    // 场景间距 → 示意 fm 读数（1.8–3.4 → 约 1.0–2.9 fm）
    drawYukawa(0.44 * sep + 0.15);
    g.rotation.y = 0.1 * Math.sin(t * 0.3);
  };
}

/** 临界质量分支：中子撞击铀核 → 裂变放出 2–3 中子 → 反射层弹回再触发（级联循环） */
function build_nuclear_critical(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
): (t: number, dt: number) => void {
  // 铀核（半径随示意尺度 R 胀缩，扫过临界半径）
  const nucleus = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(1.2, 28, 20)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.violet, transparent: true, opacity: 0.9, roughness: 0.45 })),
  );
  g.add(nucleus);
  // 反射层球壳：把逃逸中子弹回堆内 → 减小临界质量
  const reflector = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(4.4, 36, 26)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.green, wireframe: true, transparent: true, opacity: 0.25 })),
  );
  g.add(reflector);
  // 中子池（循环再生：入射 → 裂变出射 → 壁反射 → 再入射）
  interface Neutron { m: import('three').Mesh; vel: import('three').Vector3; on: boolean }
  const nGeo = bag.geo(new THREE.SphereGeometry(0.16, 10, 8));
  const nMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, emissive: 0x0891b2, emissiveIntensity: 0.9 }));
  const pool: Neutron[] = [];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(nGeo, nMat);
    m.visible = false;
    g.add(m);
    pool.push({ m, vel: new THREE.Vector3(), on: false });
  }
  const R_SHELL = 4.4;
  let cooldown = 0;
  // k_eff(R) 示意模型：k = 1.32(1 − e^(−R/1.7))，R* ≈ 2.41 处 k = 1
  const kOf = (R: number) => 1.32 * (1 - Math.exp(-R / 1.7));
  const plot = makePlot(bag, THREE, 360, 320, 4.2, 6.6, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '临界质量：增殖因子 k_eff = 1 的中子产生/损耗平衡', color: '#f8fafc' },
    { text: '²³⁵U 裸球临界质量 M_c ≈ 52 kg（直径 ~17 cm）；加厚反射层可降到 ~15 kg', color: '#94a3b8' },
    { text: '读数：紫球胀缩 = 示意半径 R（k=1 对应 R*），青小球 = 中子级联（示意）', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawKeff = (R: number) => {
    const c = plot.frame('k_eff 随半径/质量上升', 'R（示意单位）', 'k_eff');
    const W = 360, H = 320;
    const pxOf = (R: number) => 46 + (R / 4) * (W - 62);
    const pyOf = (k: number) => (H - 40) - (k / 1.6) * (H - 70);
    // 曲线：亚临界段红色 / 超临界段绿色（分色）
    c.lineWidth = 3;
    let started = false;
    for (let i = 0; i <= 120; i++) {
      const rr = (i / 120) * 4;
      const k = kOf(rr);
      const px = pxOf(rr), py = pyOf(k);
      c.strokeStyle = k >= 1 ? '#22c55e' : '#ef4444';
      if (started) { c.beginPath(); c.moveTo(pxOf(((i - 1) / 120) * 4), pyOf(kOf(((i - 1) / 120) * 4))); c.lineTo(px, py); c.stroke(); }
      started = true;
    }
    // k = 1 临界线（虚线）+ R* 竖线
    c.strokeStyle = '#fbbf24'; c.lineWidth = 2; c.setLineDash([6, 6]);
    c.beginPath(); c.moveTo(46, pyOf(1)); c.lineTo(W - 14, pyOf(1)); c.stroke();
    c.fillStyle = '#fbbf24'; c.fillText('k = 1 临界', 60, pyOf(1) - 8);
    const Rstar = 1.7 * Math.log(1.32 / 0.32);
    c.beginPath(); c.moveTo(pxOf(Rstar), 40); c.lineTo(pxOf(Rstar), H - 40); c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#94a3b8';
    c.fillText('红 = 亚临界(k<1) 绿 = 超临界(k>1)', 96, H - 56);
    // 当前 R 点
    c.fillStyle = '#f8fafc'; c.beginPath(); c.arc(pxOf(R), pyOf(kOf(R)), 7, 0, 7); c.fill();
    plot.tex.needsUpdate = true;
  };
  drawKeff(2.2);
  // 初始入射中子（外部中子源，示意）
  let injectTimer = 0;
  const spawn = (fromR: number, speed: number, outward: boolean) => {
    const n = pool.find((x) => !x.on);
    if (!n) return;
    const dir = new THREE.Vector3(
      Math.random() * 2 - 1, (Math.random() * 2 - 1) * 0.7, Math.random() * 2 - 1,
    ).normalize();
    n.on = true; n.m.visible = true;
    n.m.position.copy(dir).multiplyScalar(fromR);
    n.vel.copy(dir).multiplyScalar(outward ? speed : -speed);
  };
  return (t: number, dt: number) => {
    // 示意半径在亚/超临界之间缓慢扫描；铀核胀缩跟随
    const Rd = 2.1 + 1.1 * (Math.sin(t * 0.3) * 0.5 + 0.5);
    nucleus.scale.setScalar(Rd / 1.2 * 0.85);
    const hitR = 1.2 * nucleus.scale.x + 0.2;
    cooldown -= dt;
    injectTimer -= dt;
    if (injectTimer <= 0 && pool.some((x) => !x.on)) {
      spawn(R_SHELL * 0.98, 2.2, false); // 外部入射中子
      injectTimer = 2.4;
    }
    for (const n of pool) {
      if (!n.on) continue;
      n.m.position.addScaledVector(n.vel, dt);
      const r = n.m.position.length();
      if (r < hitR) {
        // 撞击铀核 → 裂变：消耗该中子，冷却期后放出 2–3 个新中子（级联再生）
        n.on = false; n.m.visible = false;
        if (cooldown <= 0) {
          cooldown = 0.7;
          const nu = 2 + (Math.random() < 0.4 ? 1 : 0);
          for (let i = 0; i < nu; i++) spawn(hitR + 0.05, 2.6, true);
        }
      } else if (r > R_SHELL) {
        // 反射层弹回（镜面反射），继续参与链式
        const norm = n.m.position.clone().normalize();
        n.m.position.copy(norm).multiplyScalar(R_SHELL * 0.995);
        n.vel.reflect(norm).multiplyScalar(0.98);
      }
      n.m.scale.setScalar(1 + 0.25 * Math.sin(t * 9 + n.m.id));
    }
    // 裂变瞬间闪光（冷却期内逐渐消退）
    const flash = Math.max(0, cooldown);
    const nucMat = nucleus.material as import('three').MeshStandardMaterial;
    nucMat.emissive.setHex(PAL.gold);
    nucMat.emissiveIntensity = flash * 1.6;
    reflector.rotation.y = t * 0.15;
    drawKeff(Rd);
    g.rotation.y = 0.1 * Math.sin(t * 0.25);
  };
}

/** 对产生与吸收分支：γ 在核场中转化为 e⁺e⁻ 反向径迹（弱磁场反向弯曲）→ 湮灭 → 双 γ 循环 */
function build_nuclear_pair(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
): (t: number, dt: number) => void {
  // 邻近核（提供库仑场吸收反冲，动量守恒所需）
  const nucleus = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.5, 20, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.violet, emissive: 0x6d28d9, emissiveIntensity: 0.4, roughness: 0.5 })),
  );
  g.add(nucleus);
  // 入射 γ 束（正弦波形线）与湮灭产生的双 γ
  const gamIn = makeWave(THREE, bag, PAL.gold); g.add(gamIn.line);
  const gamUp = makeWave(THREE, bag, PAL.gold); g.add(gamUp.line);
  const gamDn = makeWave(THREE, bag, PAL.gold); g.add(gamDn.line);
  gamUp.line.visible = false; gamDn.line.visible = false;
  // e⁻（青）/ e⁺（红）：绕自身圆周转一周返回产生点 → 会合湮灭（示意）
  const R = 1.3;
  const leptonGeo = bag.geo(new THREE.SphereGeometry(0.22, 14, 12));
  const eMinus = new THREE.Mesh(leptonGeo, bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, emissive: 0x0891b2, emissiveIntensity: 0.9 })));
  const ePlus = new THREE.Mesh(leptonGeo, bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, emissive: 0xb91c1c, emissiveIntensity: 0.9 })));
  g.add(eMinus); g.add(ePlus);
  eMinus.visible = false; ePlus.visible = false;
  // 两条径迹线（反向弯曲，逐步延长）
  const TRN = 64;
  function track(color: number) {
    const geo = bag.geo(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((TRN + 1) * 3), 3));
    const ln = new THREE.Line(geo, bag.mat(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 })));
    g.add(ln);
    return { ln, arr: (geo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array,
      attr: geo.getAttribute('position') as import('three').BufferAttribute };
  }
  const trM = track(PAL.cyan);
  const trP = track(PAL.red);
  const plot = makePlot(bag, THREE, 360, 320, 4.2, 6.6, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '对产生：γ + 核场 → e⁺ + e⁻，阈值 E_γ ≥ 2m_ec² = 1.022 MeV', color: '#f8fafc' },
    { text: '湮灭：e⁺e⁻ 会合 → 双 0.511 MeV γ（反向出射，PET 符合探测）', color: '#94a3b8' },
    { text: '读数：金波线 = γ，红/青 = e⁺/e⁻ 反向径迹（弱磁场示意弯曲，循环演示）', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  // 产生截面 σ(E_γ)：阈值下为 0，超过 1.022 MeV 后快速上升（示意曲线）
  const sigma = (E: number) => (E < 1.022 ? 0 : 0.85 * (1 - Math.exp(-(E - 1.022) * 2.2)));
  const drawSigma = (E: number) => {
    const c = plot.frame('对产生截面 σ(E_γ)', 'E_γ (MeV)', 'σ（示意单位）');
    const W = 360, H = 320;
    const pxOf = (E: number) => 46 + ((E - 0.5) / 3.5) * (W - 62);
    const pyOf = (s: number) => (H - 40) - s * (H - 70);
    c.strokeStyle = '#06b6d4'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 120; i++) {
      const E2 = 0.5 + (i / 120) * 3.5;
      if (i === 0) c.moveTo(pxOf(E2), pyOf(sigma(E2))); else c.lineTo(pxOf(E2), pyOf(sigma(E2)));
    }
    c.stroke();
    // 阈值竖线 1.022 MeV
    c.strokeStyle = '#fbbf24'; c.lineWidth = 2; c.setLineDash([5, 5]);
    c.beginPath(); c.moveTo(pxOf(1.022), 40); c.lineTo(pxOf(1.022), H - 40); c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#fbbf24'; c.fillText('阈值 1.022 MeV', pxOf(1.022) - 30, 58);
    c.fillStyle = '#94a3b8'; c.fillText('阈值下 σ = 0（不能产生对）', 90, H - 56);
    // 当前能量读数点
    c.fillStyle = E < 1.022 ? '#ef4444' : '#22c55e';
    c.beginPath(); c.arc(pxOf(Math.min(4, Math.max(0.5, E))), pyOf(sigma(E)), 7, 0, 7); c.fill();
    plot.tex.needsUpdate = true;
  };
  drawSigma(1.8);
  const T = 7.5; // 循环周期：入射 2s → 旋出 3.5s → 湮灭双 γ 2s
  return (t: number) => {
    const ph = t % T;
    const E = 0.6 + 2.8 * (Math.sin(t * 0.5) * 0.5 + 0.5); // 画布扫描的光子能量
    const below = E < 1.022; // 亚阈值：仅示意图中光子接近，不产生对
    if (ph < 2) {
      // 阶段 0：γ 入射（波形线伸向核）
      const u = ph / 2;
      gamIn.line.visible = true;
      gamIn.set(-5.8, 0, 1, 0, 5.3 * u, 0.28, t * 14);
      eMinus.visible = false; ePlus.visible = false;
      trM.ln.visible = false; trP.ln.visible = false;
      gamUp.line.visible = false; gamDn.line.visible = false;
    } else if (ph < 5.5 && !below) {
      // 阶段 1：核旁转化为 e⁺e⁻，反向圆周径迹（弱磁场示意弯转），绕一圈回到原点
      const u = (ph - 2) / 3.5;
      const a = u * Math.PI * 2;
      gamIn.line.visible = false;
      eMinus.visible = true; ePlus.visible = true;
      // e⁻：+x 出发逆时针弯（圆心 (0, R)）；e⁺：−x 出发镜像（圆心 (0, −R)）
      eMinus.position.set(R * Math.sin(a), R * (1 - Math.cos(a)), 0.1);
      ePlus.position.set(-R * Math.sin(a), -R * (1 - Math.cos(a)), 0.1);
      trM.ln.visible = true; trP.ln.visible = true;
      for (let i = 0; i <= TRN; i++) {
        const aa = (i / TRN) * a;
        trM.arr[i * 3] = R * Math.sin(aa); trM.arr[i * 3 + 1] = R * (1 - Math.cos(aa)); trM.arr[i * 3 + 2] = 0.1;
        trP.arr[i * 3] = -R * Math.sin(aa); trP.arr[i * 3 + 1] = -R * (1 - Math.cos(aa)); trP.arr[i * 3 + 2] = 0.1;
      }
      trM.attr.needsUpdate = true; trP.attr.needsUpdate = true;
    } else if (ph < 7.5 && !below) {
      // 阶段 2：会合湮灭 → 双 γ 沿 ±y 反向飞出
      trM.ln.visible = false; trP.ln.visible = false;
      eMinus.visible = false; ePlus.visible = false;
      gamIn.line.visible = false;
      const u = (ph - 5.5) / 2;
      gamUp.line.visible = true; gamDn.line.visible = true;
      gamUp.set(0, 0, 0, 1, 4.6 * u, 0.24, t * 16);
      gamDn.set(0, 0, 0, -1, 4.6 * u, 0.24, -t * 16);
      nucleus.scale.setScalar(1 + 0.15 * Math.sin(u * Math.PI));
    } else if (below) {
      // 亚阈值：γ 入射后被核场散射离开，不产生对（能量不足演示）
      const u = ((ph - 2) % 3.5) / 3.5;
      gamIn.line.visible = true;
      gamIn.set(-5.8, 0, 1, 0, 5.3, 0.28, t * 14);
      gamUp.line.visible = true; gamDn.line.visible = false;
      gamUp.set(0.2, 0.2, Math.cos(0.9), Math.sin(0.9), 0.4 + u * 4.4, 0.2, t * 12);
    }
    if (below) { eMinus.visible = false; ePlus.visible = false; trM.ln.visible = false; trP.ln.visible = false; }
    drawSigma(E);
    g.rotation.y = 0.1 * Math.sin(t * 0.3);
  };
}

/** 核反应堆分支：堆芯 + 慢化剂层 + 控制棒 + 冷却剂进出环流；画布为 k_eff≈1 稳态读数线 */
function build_nuclear_reactor(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
): (t: number, dt: number) => void {
  // 堆芯（燃料区）
  const core = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(1.5, 32, 24)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.violet, roughness: 0.5, transparent: true, opacity: 0.85 })),
  );
  g.add(core);
  // 慢化剂层（示意：轻水/石墨同心薄壳，把快中子慢化到热能）
  const mod1 = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(2.0, 30, 22)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide })),
  );
  const mod2 = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(2.45, 30, 22)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.slate, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide })),
  );
  g.add(mod1); g.add(mod2);
  // 控制棒（保留原金棒：插入深度调节吸收 → 反应性）
  const rods: import('three').Mesh[] = [];
  const rodGeo = bag.geo(new THREE.CylinderGeometry(0.16, 0.16, 4.4, 12));
  const rodMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold }));
  for (let i = -2; i <= 2; i++) {
    const m = new THREE.Mesh(rodGeo, rodMat);
    m.position.set(i * 1.1, 0, 2.6);
    g.add(m);
    rods.push(m);
  }
  // 冷却剂两条环流管线：左 = 冷剂入口（青），右 = 热剂出口（红/金）
  const loopIn = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.9, 0.9, 0), new THREE.Vector3(-4.8, 2.3, 0), new THREE.Vector3(-6.2, 0, 0),
    new THREE.Vector3(-4.8, -2.3, 0), new THREE.Vector3(-1.9, -0.9, 0), new THREE.Vector3(-3.6, 0, 0.9),
  ], true, 'catmullrom', 0.6);
  const loopOut = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.9, 0.9, 0), new THREE.Vector3(4.8, 2.3, 0), new THREE.Vector3(6.2, 0, 0),
    new THREE.Vector3(4.8, -2.3, 0), new THREE.Vector3(1.9, -0.9, 0), new THREE.Vector3(3.6, 0, 0.9),
  ], true, 'catmullrom', 0.6);
  const pipeIn = new THREE.Mesh(
    bag.geo(new THREE.TubeGeometry(loopIn, 72, 0.11, 8, true)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, transparent: true, opacity: 0.5, roughness: 0.4 })),
  );
  const pipeOut = new THREE.Mesh(
    bag.geo(new THREE.TubeGeometry(loopOut, 72, 0.11, 8, true)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, transparent: true, opacity: 0.5, roughness: 0.4 })),
  );
  g.add(pipeIn); g.add(pipeOut);
  // 管内流动标记（冷 = 青点、热 = 金点沿管线循环移动）
  const flowGeo = bag.geo(new THREE.SphereGeometry(0.14, 10, 8));
  const flowIn = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan }));
  const flowOut = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold }));
  const flowPts: { m: import('three').Mesh; curve: import('three').CatmullRomCurve3; off: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const a = new THREE.Mesh(flowGeo, flowIn); g.add(a); flowPts.push({ m: a, curve: loopIn, off: i / 5 });
    const b = new THREE.Mesh(flowGeo, flowOut); g.add(b); flowPts.push({ m: b, curve: loopOut, off: i / 5 });
  }
  // 堆内中子点（示意通量：金点在慢化层内折返）
  const NP = 10;
  const pg = bag.geo(new THREE.BufferGeometry());
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  g.add(new THREE.Points(pg, bag.mat(new THREE.PointsMaterial({ color: PAL.gold, size: 0.14, sizeAttenuation: true }))));
  const pa = (pg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  const pv: number[] = [];
  for (let i = 0; i < NP; i++) {
    pa[i * 3] = (Math.random() - 0.5) * 3.6;
    pa[i * 3 + 1] = (Math.random() - 0.5) * 3.6;
    pa[i * 3 + 2] = (Math.random() - 0.5) * 3.6;
    pv.push(1.2 + Math.random(), 1.2 + Math.random(), 1.2 + Math.random());
  }
  const plot = makePlot(bag, THREE, 360, 320, 4.2, 6.6, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '反应堆：k_eff ≈ 1 自持链式；慢化剂热化中子，控制棒吸收调节', color: '#f8fafc' },
    { text: '冷却剂带走功率；温度升高 → 反应性下降（负反馈自稳）', color: '#94a3b8' },
    { text: '读数：金棒 = 控制棒，青/灰壳 = 慢化剂层，双管线 = 冷却剂进出（示意）', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  // k_eff 历史滚动读数：启动振荡 → 负反馈收敛到 1
  const hist: number[] = new Array(120).fill(1);
  const drawK = (tt: number) => {
    const c = plot.frame('k_eff(t) 稳态读数（示意）', 't（运行时间）', 'k_eff');
    const W = 360, H = 320;
    const pyOf = (k: number) => (H - 40) - (k / 1.6) * (H - 70);
    // k = 1 目标线（虚线）
    c.strokeStyle = '#fbbf24'; c.lineWidth = 2; c.setLineDash([6, 6]);
    c.beginPath(); c.moveTo(46, pyOf(1)); c.lineTo(W - 14, pyOf(1)); c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#fbbf24'; c.fillText('k = 1（自持临界）', 62, pyOf(1) - 8);
    // 负反馈阻尼振荡收敛读数线
    c.strokeStyle = '#06b6d4'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i < hist.length; i++) {
      const px = 46 + (i / (hist.length - 1)) * (W - 62);
      if (i === 0) c.moveTo(px, pyOf(hist[i])); else c.lineTo(px, pyOf(hist[i]));
    }
    c.stroke();
    const cur = hist[hist.length - 1];
    c.fillStyle = '#f8fafc'; c.beginPath(); c.arc(W - 46, pyOf(cur), 7, 0, 7); c.fill();
    c.fillStyle = '#94a3b8'; c.fillText(`k_eff = ${cur.toFixed(3)}`, 90, H - 56);
    plot.tex.needsUpdate = true;
    void tt;
  };
  drawK(0);
  return (t: number, dt: number) => {
    // 控制棒慢速插拔（调节反应性）
    rods.forEach((m, i) => { m.position.y = Math.sin(t * 0.5 + i * 1.2) * 0.7; });
    // 堆内中子折返（被慢化剂层壳反射）
    for (let i = 0; i < NP; i++) {
      pa[i * 3] += pv[i * 3] * dt;
      pa[i * 3 + 1] += pv[i * 3 + 1] * dt;
      pa[i * 3 + 2] += pv[i * 3 + 2] * dt;
      for (let a = 0; a < 3; a++) {
        if (Math.abs(pa[i * 3 + a]) > 2.3) { pv[i * 3 + a] *= -1; pa[i * 3 + a] = Math.sign(pa[i * 3 + a]) * 2.3; }
      }
    }
    (pg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    // 冷却剂环流
    flowPts.forEach((f) => {
      const u = (t * 0.12 + f.off) % 1;
      const p = f.curve.getPoint(u);
      f.m.position.copy(p);
    });
    mod1.rotation.y = t * 0.2; mod2.rotation.y = -t * 0.14;
    // k_eff 读数：小幅阻尼振荡围绕 1（温度负反馈稳态）
    const k = 1 + 0.05 * Math.exp(-((t % 20) * 0.12)) * Math.sin(t * 1.6) + 0.006 * Math.sin(t * 3.1);
    hist.push(k); hist.shift();
    drawK(t);
    g.rotation.y = 0.1 * Math.sin(t * 0.25);
  };
}

/** P108 量子谐振子 */
function build_qho(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 势能抛物线
  const N = 120;
  const pg = bag.geo(new THREE.BufferGeometry());
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const pot = new THREE.Line(pg, bag.mat(new THREE.LineBasicMaterial({ color: PAL.slate })));
  g.add(pot);
  const pa = (pg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  // 分立能级
  const levels: import('three').Mesh[] = [];
  const lvGeo = bag.geo(new THREE.BoxGeometry(4.4, 0.06, 0.4));
  const lvMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold }));
  for (let n = 0; n < 5; n++) {
    const m = new THREE.Mesh(lvGeo, lvMat);
    m.position.set(0, -2.4 + n * 1.1, 0.6);
    g.add(m);
    levels.push(m);
  }
  // 波函数 |ψ_n|²（基态高斯振荡）
  const wg = bag.geo(new THREE.BufferGeometry());
  wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const wave = new THREE.Line(wg, bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan })));
  g.add(wave);
  const wa = (wg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  // —— 升/湮算符梯子：a† 把 |n⟩ 抬到 |n+1⟩、a 把 |n⟩ 降到 |n−1⟩（左侧上箭头 / 右侧下箭头）——
  const lvY = (n: number) => -2.4 + n * 1.1;
  const upArrows: import('three').Object3D[] = [];
  const dnArrows: import('three').Object3D[] = [];
  for (let n = 0; n < 4; n++) {
    const up = new THREE.ArrowHelper(new THREE.Vector3(0.06, 1, 0), new THREE.Vector3(-3.1, lvY(n) + 0.12, 0.6), 0.86, PAL.gold, 0.2, 0.1);
    const dn = new THREE.ArrowHelper(new THREE.Vector3(-0.06, -1, 0), new THREE.Vector3(3.1, lvY(n + 1) - 0.12, 0.6), 0.86, PAL.cyan, 0.2, 0.1);
    g.add(up); g.add(dn);
    upArrows.push(up); dnArrows.push(dn);
  }
  const ladLab = makeLabel(THREE, bag, 'a†|n⟩ = √(n+1)|n+1⟩', 3.6, {
    color: '#fbbf24', bg: true, w: 560, h: 76, font: 'bold 32px "PingFang SC", "Microsoft YaHei", sans-serif',
  });
  ladLab.sprite.position.set(-3.9, 2.4, 0.6);
  g.add(ladLab.sprite);
  const annLab = makeLabel(THREE, bag, 'a|n⟩ = √n|n−1⟩', 3.2, {
    color: '#67e8f9', bg: true, w: 480, h: 76, font: 'bold 32px "PingFang SC", "Microsoft YaHei", sans-serif',
  });
  annLab.sprite.position.set(3.8, 2.4, 0.6);
  g.add(annLab.sprite);
  // —— 相干态：宽度不变的高斯波包以经典频率在势阱内往复（最接近经典振子的量子态）——
  const N2 = 100;
  const cg = bag.geo(new THREE.BufferGeometry());
  cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N2 + 1) * 3), 3));
  const coh = new THREE.Line(cg, bag.mat(new THREE.LineBasicMaterial({ color: PAL.gold })));
  g.add(coh);
  const ca = (cg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  const COH_Y = -3.5, COH_W = 0.55, COH_A = 0.5;
  // 相干态往复频率取自画的抛物线：V = ½mω²x²（m≡1，½ω² = 0.35）⇒ ω = √0.7 = 0.84
  const COH_OM = Math.sqrt(0.7);
  g.add(panelSprite(THREE, bag, [
    { text: '量子谐振子：E_n = (n + 1/2)ℏω，能级等间距', color: '#f8fafc' },
    { text: '零点能 E_0 = ½ℏω ≠ 0（不确定性原理的直接结果）', color: '#94a3b8' },
    { text: '升/湮算符：a†|n⟩ = √(n+1)|n+1⟩（金上箭头）、a|n⟩ = √n|n−1⟩（青下箭头）', color: '#94a3b8' },
    { text: '读数：灰线 = V(x)=½mω²x²，金条 = 能级，青线 = ψ_2(x,t)，下方金线 = 不扩散相干态', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  let lastLad = -1;
  return (t: number) => {
    // 势能曲线
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * 8 - 4;
      pa[i * 3] = x;
      pa[i * 3 + 1] = -2.4 + 0.35 * x * x;
      pa[i * 3 + 2] = 0;
    }
    (pg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    // 波函数（n=2 态振荡）
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * 8 - 4;
      const psi = Math.exp(-x * x * 0.35) * (1.6 * x * x - 0.6);
      wa[i * 3] = x;
      wa[i * 3 + 1] = 0.8 + psi * 0.9 * Math.cos(t * 1.4);
      wa[i * 3 + 2] = 0.6;
    }
    (wg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    levels.forEach((m, i) => { m.scale.x = 1 + 0.05 * Math.sin(t * 2 + i); });
    // 梯子高亮：当前 n → n+1 的跃迁箭头交替加粗（与金条同步）
    const nLad = Math.floor(t * 0.6) % 4;
    if (nLad !== lastLad) {
      lastLad = nLad;
      upArrows.forEach((a, i) => { a.scale.setScalar(i === nLad ? 1.25 : 0.8); });
      dnArrows.forEach((a, i) => { a.scale.setScalar(i === nLad ? 1.25 : 0.8); });
      ladLab.set(`a†|${nLad}⟩ = √${nLad + 1}|${nLad + 1}⟩`);
      annLab.set(`a|${nLad + 1}⟩ = √${nLad + 1}|${nLad}⟩`);
    }
    // 相干态：中心 x_c = A·sin(ωt)，宽度恒定（不扩散）
    const xc = 2.1 * Math.sin(COH_OM * t);
    for (let i = 0; i <= N2; i++) {
      const x = (i / N2) * 8 - 4;
      ca[i * 3] = x;
      ca[i * 3 + 1] = COH_Y + COH_A * Math.exp(-((x - xc) ** 2) / (2 * COH_W * COH_W));
      ca[i * 3 + 2] = 0.6;
    }
    (cg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
  };
}

/** P29 量子比特与布洛赫球, P237 纠缠交换 */
function build_qubit(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const entangle = title.includes('纠缠');
  // 布洛赫球
  const sphere = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(2.6, 36, 26)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.slate, wireframe: true, transparent: true, opacity: 0.3 })),
  );
  g.add(sphere);
  // 赤道与极轴
  const equator = new THREE.Mesh(
    bag.geo(new THREE.TorusGeometry(2.6, 0.04, 8, 60)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.slate })),
  );
  g.add(equator);
  // 布洛赫球分支：只把赤道环躺平到 xz 面（此前写成 g.add(equator).rotation.x，旋转的是整组，
  // 于是赤道环落进含两极的平面、穿过 |0⟩/|1⟩，与面板"赤道 = 等权叠加"矛盾）
  if (entangle) g.rotation.x = Math.PI / 2; // 纠缠交换分支沿用整组原姿态，画面不变
  else equator.rotation.x = Math.PI / 2;
  const axisY = lineFrom(THREE, bag, [
    new THREE.Vector3(0, -3, 0), new THREE.Vector3(0, 3, 0),
  ], PAL.slate, true);
  const axisX = lineFrom(THREE, bag, [
    new THREE.Vector3(-3, 0, 0), new THREE.Vector3(3, 0, 0),
  ], PAL.slate, true);
  const axisZ = lineFrom(THREE, bag, [
    new THREE.Vector3(0, 0, -3), new THREE.Vector3(0, 0, 3),
  ], PAL.slate, true);
  g.add(axisY); g.add(axisX); g.add(axisZ);
  // 状态矢量
  const state = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 2.6, PAL.cyan, 0.26, 0.13,
  );
  g.add(state);
  // |0⟩ / |1⟩ 极点
  const p0 = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.16, 12, 10)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.green })),
  );
  p0.position.y = 2.6;
  const p1 = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.16, 12, 10)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.red })),
  );
  p1.position.y = -2.6;
  g.add(p0); g.add(p1);
  // 纠缠：第二颗球反向联动
  const sphere2 = sphere.clone();
  sphere2.position.x = 6.4;
  g.add(sphere2);
  const state2 = new THREE.ArrowHelper(
    new THREE.Vector3(0, -1, 0), new THREE.Vector3(6.4, 0, 0), 2.6, PAL.pink, 0.26, 0.13,
  );
  g.add(state2);
  // 单量子比特场景：隐藏第二颗布洛赫球与反向箭头（仅纠缠交换分支显示）
  if (!entangle) {
    sphere2.visible = false;
    state2.visible = false;
  }
  // 纠缠交换面板上移，避免遮挡 4 比特示意
  const panelPos: [number, number, number] = entangle ? [0, 4.4, -4.0] : [0, 4.4, 0];
  // —— 纠缠交换：4 个量子比特（A-B、E-F 各成 Bell 对）+ 中间 E-B Bell 测量 ——
  const qballs: import('three').Mesh[] = [];
  const outcomes: import('three').ArrowHelper[] = [];
  let linkAF: import('three').Line | null = null;
  let bellMat: import('three').MeshStandardMaterial | null = null;
  let readout: ReturnType<typeof makeLabel> | null = null;
  if (entangle) {
    // 布洛赫球相关元素全部隐藏：Bell 态的单比特约化态是混合态，布洛赫矢量长度为 0
    [sphere, equator, axisX, axisY, axisZ, state, p0, p1, sphere2, state2].forEach((o) => { o.visible = false; });
    const QX = [-5.4, -1.9, 1.9, 5.4]; // A、B、E、F（局部 x-z 平面即屏幕平面）
    const QLAB = ['A', 'B', 'E', 'F'];
    QX.forEach((x, i) => {
      const ball = new THREE.Mesh(
        bag.geo(new THREE.SphereGeometry(0.95, 22, 16)),
        bag.mat(new THREE.MeshBasicMaterial({
          color: i < 2 ? PAL.cyan : PAL.pink, wireframe: true, transparent: true, opacity: 0.5,
        })),
      );
      ball.position.set(x, 0, 0);
      g.add(ball);
      qballs.push(ball);
      const lab = makeLabel(THREE, bag, QLAB[i], 0.8, { color: i < 2 ? '#67e8f9' : '#f9a8d4' });
      lab.sprite.position.set(x, 0, 0);
      g.add(lab.sprite);
      // 测量结果读数（金箭头：上/下各一，按 Bell 态反关联点亮）
      const up = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(x, 0, -0.95), 1.1, PAL.gold, 0.32, 0.16);
      const dn = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(x, 0, 0.95), 1.1, PAL.gold, 0.32, 0.16);
      up.visible = false;
      dn.visible = false;
      g.add(up); g.add(dn);
      outcomes.push(up, dn);
    });
    // 已有的两对纠缠：A-B（青）、E-F（粉）
    g.add(lineFrom(THREE, bag, [
      new THREE.Vector3(-4.45, 0, 0), new THREE.Vector3(-2.85, 0, 0),
    ], PAL.cyan, true));
    g.add(lineFrom(THREE, bag, [
      new THREE.Vector3(2.85, 0, 0), new THREE.Vector3(4.45, 0, 0),
    ], PAL.pink, true));
    // 测量之后才建立的 A-F 纠缠（金弧，绕到装置后方连接两端）
    linkAF = lineFrom(THREE, bag, [
      new THREE.Vector3(-5.4, 0, 0),
      new THREE.Vector3(-3.4, -2.0, 0.4),
      new THREE.Vector3(0, -2.8, 0.6),
      new THREE.Vector3(3.4, -2.0, 0.4),
      new THREE.Vector3(5.4, 0, 0),
    ], PAL.gold, true);
    linkAF.visible = false;
    g.add(linkAF);
    // 中间 E、B 的 Bell 态测量（闪烁块 + 标签）
    bellMat = bag.mat(new THREE.MeshStandardMaterial({
      color: PAL.violet, emissive: 0x8b5cf6, emissiveIntensity: 0.3,
      transparent: true, opacity: 0.45, roughness: 0.4,
    }));
    g.add(new THREE.Mesh(bag.geo(new THREE.BoxGeometry(1.7, 1.1, 1.3)), bellMat));
    const bellLab = makeLabel(THREE, bag, 'E·B Bell 测量', 3.0, { color: '#c4b5fd' });
    bellLab.sprite.position.set(0, 0, -1.7);
    g.add(bellLab.sprite);
    readout = makeLabel(THREE, bag, '① A-B、E-F 各成 Bell 对', 8.8, { bg: true, color: '#fbbf24', w: 640, h: 90 });
    readout.sprite.position.set(0, 0, 3.0);
    g.add(readout.sprite);
  }
  g.add(panelSprite(THREE, bag, entangle ? [
    { text: '纠缠交换：A-B、E-F 先各自成 Bell 对，随后对 E、B 做 Bell 测量', color: '#f8fafc' },
    { text: 'E-B Bell 测量 → A-F 纠缠：|Ψ⁻⟩_{AB}⊗|Ψ⁻⟩_{EF} ⟶ |Ψ⁻⟩_{AF}', color: '#94a3b8' },
    { text: '读数：金箭头 = 测量结果（两两反关联），金弧 = A-F 新纠缠；Bell 态布洛赫矢量长 0', color: '#fbbf24' },
  ] : [
    { text: '布洛赫球：|ψ⟩ = cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩', color: '#f8fafc' },
    { text: '北极 |0⟩、南极 |1⟩，赤道（躺平的灰环）为等权叠加（|+⟩, |−⟩）', color: '#94a3b8' },
    { text: '读数：青箭头 = 量子态；末尾 4 s 演示一次离散门 R_x(π/2)：|0⟩ → |+⟩ 落到赤道环', color: '#fbbf24' },
  ], panelPos, 7.8, 'center'));
  // 布洛赫分支的状态读数（5 Hz 刷新，方向直接取自状态箭头 ⇒ 与几何同源）
  let blochLab: ReturnType<typeof makeLabel> | null = null;
  if (!entangle) {
    blochLab = makeLabel(THREE, bag, '|ψ⟩ = cos(θ/2)|0⟩ + e^{iφ}sin(θ/2)|1⟩', 7.0, {
      bg: true, color: '#fbbf24', w: 820, h: 80, font: 'bold 30px "PingFang SC", "Microsoft YaHei", sans-serif',
    });
    blochLab.sprite.position.set(0, -3.6, 0);
    g.add(blochLab.sprite);
  }
  let prevPhase = -1;
  let sign = 1;
  let lastBlochT = -1;
  const dir = new THREE.Vector3();
  return (t: number) => {
    if (entangle) {
      // 三阶段循环：① 两对 Bell 态 → ② E-B Bell 测量闪烁 → ③ A-F 纠缠建立
      const cyc = t % 9;
      const phase = cyc < 3 ? 0 : cyc < 4.6 ? 1 : 2;
      if (phase !== prevPhase) {
        if (phase === 2) sign = Math.random() < 0.5 ? -1 : 1;
        prevPhase = phase;
        // A、E 同向，B、F 反向：四比特读数两两反关联，与四个 Bell 对一致
        outcomes.forEach((a, j) => {
          const want = sign * ((j >> 1) % 2 === 0 ? 1 : -1);
          a.visible = phase === 2 && (j % 2 === 0 ? want > 0 : want < 0);
        });
        if (linkAF) linkAF.visible = phase === 2;
        if (readout) {
          if (phase === 0) readout.set('① A-B、E-F 各成 Bell 对：单比特布洛赫矢量长 0（混合态）', '#fbbf24');
          else if (phase === 1) readout.set('② 对 E、B 做 Bell 态测量（中央闪烁块）', '#fbbf24');
          else readout.set('③ A-F 纠缠建立：σz 读数反关联 ⟨σz^A σz^F⟩ = −1', '#fbbf24');
        }
      }
      g.rotation.y = Math.sin(t * 0.3) * 0.12;
      qballs.forEach((b, i) => { b.rotation.y = t * (0.4 + i * 0.15); });
      if (bellMat) {
        const flash = phase === 1 ? 0.55 + 0.45 * Math.abs(Math.sin(t * 9)) : 0.45;
        bellMat.opacity = flash;
        bellMat.emissiveIntensity = phase === 1 ? 0.6 + 1.4 * Math.abs(Math.sin(t * 9)) : 0.3;
      }
      return;
    }
    // 演示旋转（连续缠绕门）+ 每周期末尾一次显式 90° 绕 x 门（|0⟩ → |+⟩）
    const cyc = t % 12;
    const gating = cyc > 8;
    let ang: number, tilt: number;
    if (gating) {
      ang = 0; // 绕 x 轴的门：φ 固定
      tilt = Math.min(1, (cyc - 8) / 1.4) * (Math.PI / 2); // θ: 0° → 90°（北极落到赤道环）
    } else {
      ang = t * 0.9;
      tilt = Math.sin(t * 0.6) * 0.7;
    }
    dir.set(Math.sin(tilt) * Math.cos(ang), Math.cos(tilt), Math.sin(tilt) * Math.sin(ang));
    state.setDirection(dir);
    state.setLength(2.6, 0.26, 0.13);
    if (blochLab && t - lastBlochT > 0.2) {
      lastBlochT = t;
      const degT = (Math.acos(Math.max(-1, Math.min(1, dir.y))) * 180) / Math.PI;
      let degP = (Math.atan2(dir.z, dir.x) * 180) / Math.PI;
      if (degP < 0) degP += 360;
      blochLab.set(
        gating
          ? `门 R_x(π/2)：|0⟩ → |+⟩=(|0⟩+|1⟩)/√2   θ=${degT.toFixed(0)}° φ=${degP.toFixed(0)}°（赤道=等权叠加）`
          : `θ=${degT.toFixed(0)}° φ=${degP.toFixed(0)}°  →  |ψ⟩=cos(θ/2)|0⟩+e^(${degP.toFixed(0)}°·i)sin(θ/2)|1⟩`,
      );
    }
    g.rotation.y = t * 0.1;
  };
}

/** P519 拉比振荡与两能级系统 */
function build_rabi(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 两能级（上下条带）
  const lower = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(7, 0.4, 1.4)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.violet, transparent: true, opacity: 0.9 })),
  );
  lower.position.y = -1.6;
  g.add(lower);
  const upper = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(7, 0.4, 1.4)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.9 })),
  );
  upper.position.y = 1.6;
  g.add(upper);
  // 在两能级间振荡的粒子
  const p = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.3, 16, 12)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: 0xb45309, emissiveIntensity: 0.9 })),
  );
  g.add(p);
  // 驱动场（振荡箭头）
  const drive = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(3.6, 0, 0), 1.2, PAL.red, 0.2, 0.1,
  );
  g.add(drive);
  const plot = makePlot(bag, THREE, 360, 320, 4.2, 6.6, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '拉比振荡：P_{1←0}(t) = sin²(Ωt/2)，Ω = μE/ℏ', color: '#f8fafc' },
    { text: '两能级系统在驱动场下相干布居转移，周期 T = 2π/Ω', color: '#94a3b8' },
    { text: '读数：金球在两能级间往返，共振时转移概率达 100%', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawP = (P: number, t: number) => {
    const c = plot.frame('布居 P(t)', 't', 'P₁');
    const W = 360, H = 320;
    c.strokeStyle = '#f59e0b'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 120; i++) {
      const tt = (i / 120) * Math.PI * 4;
      const p1 = Math.sin(tt / 2) ** 2;
      const px = 46 + (i / 120) * (W - 62);
      const py = (H - 40) - p1 * (H - 70);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    const px = 46 + ((t * 0.7 % (Math.PI * 4)) / (Math.PI * 4)) * (W - 62);
    const py = (H - 40) - P * (H - 70);
    c.fillStyle = '#06b6d4'; c.beginPath(); c.arc(px, py, 7, 0, 7); c.fill();
    plot.tex.needsUpdate = true;
  };
  drawP(0, 0);
  return (t: number) => {
    const u = Math.sin(t * 0.7 * Math.PI / 2) ** 2; // sin²(Ωt/2)
    p.position.y = -1.6 + u * 3.2;
    p.position.x = Math.sin(t * 2) * 1.2;
    drive.setDirection(new THREE.Vector3(0, Math.cos(t * 4) >= 0 ? 1 : -1, 0));
    drive.setLength(0.8 + 0.5 * Math.abs(Math.cos(t * 4)), 0.2, 0.1);
    drawP(u, t);
  };
}

/** P525 拉曼散射 */
function build_raman(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 分子（振动双原子）
  const a1 = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.5, 20, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, roughness: 0.4 })),
  );
  const a2 = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.5, 20, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.pink, roughness: 0.4 })),
  );
  g.add(a1); g.add(a2);
  // 键
  const bond = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.09, 0.09, 1.4, 10)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.slate })),
  );
  bond.rotation.z = Math.PI / 2;
  g.add(bond);
  // 入射/散射光子（红移与蓝移）
  const inP = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.2, 14, 12)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.red })),
  );
  const stokes = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.2, 14, 12)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold })),
  );
  const anti = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.2, 14, 12)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.violet })),
  );
  g.add(inP); g.add(stokes); g.add(anti);
  const plot = makePlot(bag, THREE, 380, 320, 4.4, 6.6, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '拉曼散射：ν_S = ν_0 − Δν（Stokes）/ ν_AS = ν_0 + Δν（反 Stokes）', color: '#f8fafc' },
    { text: '频率移动对应分子振动能级 ΔE = hΔν（指纹识别）', color: '#94a3b8' },
    { text: '读数：红 = 入射光，金 = Stokes（红移），紫 = 反 Stokes（蓝移）', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawSpec = (shift: number) => {
    const c = plot.frame('拉曼谱', 'Δν (cm⁻¹)', 'I');
    const W = 380, H = 320;
    // 瑞利线
    c.strokeStyle = '#64748b'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(W / 2, 40); c.lineTo(W / 2, H - 40); c.stroke();
    // Stokes / 反 Stokes
    const peaks = [
      { x: W / 2 + 70, col: '#f59e0b', label: 'Stokes' },
      { x: W / 2 - 70, col: '#8b5cf6', label: '反Stokes' },
      { x: W / 2 + 140, col: '#f59e0b', label: '' },
    ];
    peaks.forEach((pk) => {
      c.strokeStyle = pk.col; c.lineWidth = 4; c.beginPath();
      const amp = H - 60;
      c.moveTo(pk.x, H - 40);
      c.lineTo(pk.x, 40 + (H - 80) * 0.35);
      c.stroke();
      c.fillStyle = pk.col; c.textAlign = 'center';
      if (pk.label) c.fillText(pk.label, pk.x, H - 52);
    });
    c.textAlign = 'left';
    c.fillStyle = '#94a3b8'; c.fillText('灰线 = 瑞利散射（ν₀）', 60, 56);
    plot.tex.needsUpdate = true;
    void shift;
  };
  drawSpec(1000);
  return (t: number) => {
    // 分子振动
    const vib = Math.sin(t * 6) * 0.35;
    a1.position.x = -0.9 - vib;
    a2.position.x = 0.9 + vib;
    bond.position.x = 0;
    bond.scale.x = (1.8 + 2 * vib) / 1.4;
    bond.position.y = 0;
    // 光子运动
    const u = (t * 1.2) % 1;
    inP.position.set(-5 + u * 5, 1.8, 0);
    stokes.position.set(2 + ((t * 1.2 + 0.3) % 1) * 4, 1.8 - ((t * 1.2 + 0.3) % 1) * 2.4, 0);
    anti.position.set(2 + ((t * 1.2 + 0.6) % 1) * 4, -1.8 + ((t * 1.2 + 0.6) % 1) * 2.4, 0);
    drawSpec(1000 + 100 * Math.sin(t));
  };
}

/** P511 泡利矩阵与自旋 1/2, P598 SO(3) 与 SU(2) 表示, P111 自旋进动 */
function build_spin(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const su2 = title.includes('SO(3)') || title.includes('SU(2)');
  const precess = title.includes('进动');
  const pauli = !su2 && !precess; // 泡利矩阵与自旋 1/2 分支
  // 自旋箭头
  const spin = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 2.4, PAL.cyan, 0.24, 0.12,
  );
  g.add(spin);
  // 外磁场 B（z 轴）
  const bField = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(-3.6, -2.4, 0), 3.2, PAL.violet, 0.24, 0.12,
  );
  g.add(bField);
  // 进动圆
  const circle = new THREE.Mesh(
    bag.geo(new THREE.TorusGeometry(1.6, 0.05, 8, 60)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold })),
  );
  circle.position.y = 1.6;
  g.add(circle);
  // 泡利矩阵符号板（σ_x, σ_y, σ_z）
  const labels: import('three').Sprite[] = [];
  ['σx', 'σy', 'σz'].forEach((txt, i) => {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = 'rgba(7,11,20,0.75)'; c.fillRect(0, 0, 128, 64);
    c.fillStyle = '#fbbf24'; c.font = 'bold 34px sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(txt, 64, 32);
    const tex = bag.tex(new THREE.CanvasTexture(cv));
    const sp = new THREE.Sprite(bag.mat(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })));
    sp.scale.set(1.4, 0.7, 1);
    sp.position.set((i - 1) * 2.2, -3.4, 1.4);
    sp.renderOrder = 998;
    g.add(sp);
    labels.push(sp);
  });
  // —— SU(2)→SO(3) 双覆盖演示：φ 从 0 连续扫到 4π ——
  const dialArrows: import('three').ArrowHelper[] = [];
  let signLab: ReturnType<typeof makeLabel> | null = null;
  let phiLab: ReturnType<typeof makeLabel> | null = null;
  let lastPositive = true;
  let lastPhiT = -1;
  if (su2) {
    // 进动示意（自旋箭头、B 场、进动圆）由双覆盖演示取代
    spin.visible = false;
    bField.visible = false;
    circle.visible = false;
    [-4.2, 4.2].forEach((x, i) => {
      const color = i === 0 ? PAL.cyan : PAL.violet;
      const ring = new THREE.Mesh(
        bag.geo(new THREE.TorusGeometry(1.4, 0.05, 8, 64)),
        bag.mat(new THREE.MeshBasicMaterial({ color })),
      );
      ring.position.set(x, -1.0, 0);
      g.add(ring);
      // φ = 0 起点刻度（盘顶）
      const tick = new THREE.Mesh(
        bag.geo(new THREE.BoxGeometry(0.12, 0.3, 0.12)),
        bag.mat(new THREE.MeshBasicMaterial({ color: PAL.slate })),
      );
      tick.position.set(x, -0.45, 0);
      g.add(tick);
      const ar = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, -1.0, 0), 1.3, color, 0.3, 0.15,
      );
      g.add(ar);
      dialArrows.push(ar);
      const lab = makeLabel(THREE, bag, i === 0 ? 'SO(3) 方向' : 'SU(2) 旋量', 2.6, {
        color: i === 0 ? '#67e8f9' : '#c4b5fd',
      });
      lab.sprite.position.set(x, -2.7, 0);
      g.add(lab.sprite);
      if (i === 1) {
        // 旋量符号：φ 转过 2π 由 + 变 −，转满 4π 才复原
        signLab = makeLabel(THREE, bag, '+', 0.7, {
          color: '#22c55e', font: 'bold 62px "PingFang SC", "Microsoft YaHei", sans-serif',
        });
        signLab.sprite.position.set(x + 1.55, -0.35, 0);
        g.add(signLab.sprite);
      }
    });
    phiLab = makeLabel(THREE, bag, '旋转角 φ = 0.00π', 3.4, { bg: true, color: '#fbbf24', w: 448, h: 96 });
    phiLab.sprite.position.set(0, 0.9, 0);
    g.add(phiLab.sprite);
  }
  // —— 泡利矩阵分支：布洛赫球（⟨σ⟩ 矢量）+ 依次作用 σ_x/σ_y/σ_z（= 绕对应轴转 π）——
  //    与"自旋进动"分支的画面区分开：这里没有 Larmor 圆锥，而是量子态在布洛赫球上的离散酉变换
  const BR = 1.9, BCY = 0.4;
  let bVec: import('three').ArrowHelper | null = null;
  let pauliLab: ReturnType<typeof makeLabel> | null = null;
  const AXU = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
  const bvStart = new THREE.Vector3(0.5774, 0.5774, 0.5774); // 初始 ⟨σ⟩ = (x,y,z)
  const bvNow = bvStart.clone();
  const perp0 = new THREE.Vector3(), par0 = new THREE.Vector3(), crs0 = new THREE.Vector3();
  const dv = new THREE.Vector3(); // 布洛赫 → 场景方向暂存
  let axNow = AXU[0], lastOp = -1, lastPauliT = -1;
  if (pauli) {
    spin.visible = false; // 进动三件套让位给布洛赫球
    bField.visible = false;
    circle.visible = false;
    const bs = new THREE.Mesh(
      bag.geo(new THREE.SphereGeometry(BR, 28, 20)),
      bag.mat(new THREE.MeshBasicMaterial({ color: PAL.slate, wireframe: true, transparent: true, opacity: 0.22 })),
    );
    bs.position.set(0, BCY, 0);
    g.add(bs);
    // 三条泡利轴（虚线，各自配色），σ 标签移到对应轴端并高亮当前算符
    const axCols = [PAL.red, PAL.green, PAL.slate];
    [[BR + 0.3, 0, 0], [0, 0, BR + 0.3], [0, BR + 0.15, 0]].forEach((p, i) => {
      const end = new THREE.Vector3(p[0], BCY + p[1], p[2]);
      const start = new THREE.Vector3(-p[0], BCY - p[1], -p[2]);
      g.add(lineFrom(THREE, bag, [start, end], axCols[i], true));
      labels[i].position.set(p[0] * 1.22, BCY + p[1] * 1.22 + (i === 2 ? 0.25 : 0), p[2] * 1.22);
    });
    // 北极 |↑⟩ / 南极 |↓⟩（S_z = ±ħ/2 的两个本征态）
    const poleGeo = bag.geo(new THREE.SphereGeometry(0.11, 10, 8));
    [1, -1].forEach((s) => {
      const m = new THREE.Mesh(poleGeo, bag.mat(new THREE.MeshBasicMaterial({ color: s > 0 ? PAL.green : PAL.red })));
      m.position.set(0, BCY + s * BR, 0);
      g.add(m);
    });
    bVec = new THREE.ArrowHelper(bvNow.clone(), new THREE.Vector3(0, BCY, 0), BR, PAL.cyan, 0.22, 0.11);
    g.add(bVec);
    pauliLab = makeLabel(THREE, bag, '泡利矩阵作用演示', 6.4, {
      bg: true, color: '#fbbf24', w: 760, h: 80, font: 'bold 30px "PingFang SC", "Microsoft YaHei", sans-serif',
    });
    pauliLab.sprite.position.set(0, -2.7, 1.0);
    g.add(pauliLab.sprite);
  }
  g.add(panelSprite(THREE, bag, su2 ? [
    { text: 'SU(2)→SO(3) 双覆盖：旋量转 2π 变号、转 4π 复原', color: '#f8fafc' },
    { text: 'SO(3) 方向 2π 复原；SU(2) 旋量按 φ/2 转动，φ=2π 时 e^{iφ/2} = −1', color: '#94a3b8' },
    { text: '读数：左盘 = 方向 φ（周期 2π），右盘 = 旋量 φ/2 与 ± 符号（周期 4π）', color: '#fbbf24' },
  ] : precess ? [
    { text: '自旋进动：dS/dt = γ S×B，Larmor 频率 ω = γB', color: '#f8fafc' },
    { text: '自旋绕外磁场 B（紫箭头）作圆锥进动，S_z 守恒', color: '#94a3b8' },
    { text: '读数：金圈 = 进动轨迹，青箭头 = 瞬时自旋方向', color: '#fbbf24' },
  ] : [
    { text: '泡利矩阵：σ_x,σ_y,σ_z，σ_i² = I，{σ_i,σ_j} = 2δ_ij', color: '#f8fafc' },
    { text: '自旋 1/2：⟨S_z⟩ = ±ℏ/2，n 个自旋构成 2ⁿ 维 Hilbert 空间', color: '#94a3b8' },
    { text: 'σ 作用 = 布洛赫矢量绕对应轴转 π：σ_x 令 (X,Y,Z) → (X,−Y,−Z)，σ_y、σ_z 同理', color: '#94a3b8' },
    { text: '读数：球中青箭头 = ⟨σ⟩，三条虚轴为 σ_x/σ_y/σ_z 轴，标签随当前算符点亮', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  return (t: number) => {
    if (su2) {
      // φ 由 0 扫到 4π：左盘方向转满 2π 复原，右盘旋量转 φ/2、2π 变号、4π 复原
      const phi = (t * 0.8) % (Math.PI * 4);
      dialArrows.forEach((ar, i) => {
        const a = i === 0 ? phi : phi / 2;
        ar.setDirection(new THREE.Vector3(-Math.sin(a), Math.cos(a), 0));
        ar.setLength(1.3, 0.3, 0.15);
      });
      const positive = phi < Math.PI * 2;
      if (signLab && positive !== lastPositive) {
        lastPositive = positive;
        signLab.set(positive ? '+' : '−', positive ? '#22c55e' : '#ef4444');
      }
      if (phiLab && t - lastPhiT > 0.1) {
        lastPhiT = t;
        phiLab.set(`旋转角 φ = ${(phi / Math.PI).toFixed(2)}π`, '#fbbf24');
      }
      return;
    }
    if (pauli && bVec) {
      // 每 2.5 s 依次作用 σ_x → σ_y → σ_z（前 0.8 s 为绕该轴转 π 的过程，之后停在像态上）
      const op = Math.floor(t / 2.5) % 3;
      const u = Math.min(1, (t % 2.5) / 0.8);
      if (op !== lastOp) {
        lastOp = op;
        axNow = AXU[op];
        bvStart.copy(bvNow);
        par0.copy(axNow).multiplyScalar(bvStart.dot(axNow));
        perp0.copy(bvStart).sub(par0);
        crs0.crossVectors(axNow, perp0); // |crs0| = |perp0|（单位轴、彼此正交）
        labels.forEach((s, i) => { s.scale.set(i === op ? 2.0 : 1.2, i === op ? 1.0 : 0.6, 1); });
      }
      const a = u * Math.PI;
      bvNow.copy(par0).addScaledVector(perp0, Math.cos(a)).addScaledVector(crs0, Math.sin(a));
      bVec.setDirection(dv.set(bvNow.x, bvNow.z, bvNow.y).normalize()); // 布洛赫 (X,Y,Z) → 场景 (x, z, y)
      if (pauliLab && t - lastPauliT > 0.2) {
        lastPauliT = t;
        const th = (Math.acos(Math.max(-1, Math.min(1, bvNow.z))) * 180) / Math.PI;
        let ph = (Math.atan2(bvNow.y, bvNow.x) * 180) / Math.PI;
        if (ph < 0) ph += 360;
        pauliLab.set(
          `${['σ_x', 'σ_y', 'σ_z'][op]} 绕轴转 π（${(a * 180 / Math.PI).toFixed(0)}°）⟨σ⟩=(${bvNow.x.toFixed(2)},${bvNow.y.toFixed(2)},${bvNow.z.toFixed(2)}) θ=${th.toFixed(0)}° φ=${ph.toFixed(0)}°`,
        );
      }
      return;
    }
    const ang = t * 1.5;
    const tilt = 0.7;
    spin.setDirection(new THREE.Vector3(
      Math.sin(tilt) * Math.cos(ang),
      Math.cos(tilt),
      Math.sin(tilt) * Math.sin(ang),
    ));
    spin.setLength(2.4, 0.24, 0.12);
    circle.rotation.x = Math.PI / 2 - tilt;
    circle.rotation.y = ang;
    labels.forEach((s, i) => { s.scale.x = 1.4 + 0.15 * Math.sin(t * 3 + i); });
  };
}

/** P319 斯特恩-格拉赫实验 */
function build_sterngerlach(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 铁磁体（尖头磁铁）
  const upper = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(2.2, 1.2, 2.4)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6, roughness: 0.4 })),
  );
  upper.position.set(0, 2.2, 0);
  g.add(upper);
  const lower = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(2.2, 1.2, 2.4)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6, roughness: 0.4 })),
  );
  lower.position.set(0, -2.2, 0);
  g.add(lower);
  // 不均匀磁场（梯度箭头）
  for (let i = -1; i <= 1; i++) {
    g.add(new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0), new THREE.Vector3(i * 0.8, -0.6, 0), 1.2, PAL.violet, 0.16, 0.08,
    ));
  }
  // 原子束 → 分裂为两束
  const beamIn = lineFrom(THREE, bag, [
    new THREE.Vector3(-6.5, 0, 0), new THREE.Vector3(-1.6, 0, 0),
  ], PAL.slate);
  g.add(beamIn);
  const beamUp = lineFrom(THREE, bag, [
    new THREE.Vector3(1.6, 0, 0), new THREE.Vector3(6.4, 2.0, 0),
  ], PAL.cyan);
  const beamDn = lineFrom(THREE, bag, [
    new THREE.Vector3(1.6, 0, 0), new THREE.Vector3(6.4, -2.0, 0),
  ], PAL.pink);
  g.add(beamUp); g.add(beamDn);
  // 屏幕上的两个斑点
  const s1 = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.3, 16, 12)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan })),
  );
  s1.position.set(6.4, 2.0, 0);
  const s2 = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.3, 16, 12)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.pink })),
  );
  s2.position.set(6.4, -2.0, 0);
  g.add(s1); g.add(s2);
  // 飞行粒子
  const NP = 30;
  const pg = bag.geo(new THREE.BufferGeometry());
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  g.add(new THREE.Points(pg, bag.mat(new THREE.PointsMaterial({ color: PAL.gold, size: 0.15, sizeAttenuation: true }))));
  const pa = (pg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  for (let i = 0; i < NP; i++) {
    pa[i * 3] = -6.5 + Math.random() * 13;
    pa[i * 3 + 1] = 0;
    pa[i * 3 + 2] = 0;
  }
  g.add(panelSprite(THREE, bag, [
    { text: '斯特恩-格拉赫：银原子束经非均匀磁场 → 分裂为两束', color: '#f8fafc' },
    { text: '空间量子化：S_z = ±ℏ/2（不是连续分布）→ 自旋 1/2 的证据', color: '#94a3b8' },
    { text: '读数：青/粉 = 上/下自旋分量，束流分裂为离散斑点', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  return (t: number, dt: number) => {
    for (let i = 0; i < NP; i++) {
      pa[i * 3] += dt * 3.0;
      if (pa[i * 3] > -1.6) {
        // 进入磁场后按自旋分裂
        const up = i % 2 === 0;
        pa[i * 3 + 1] += (up ? 1 : -1) * dt * 1.6;
      } else {
        pa[i * 3 + 1] *= 0.9;
      }
      if (pa[i * 3] > 6.4) {
        pa[i * 3] = -6.5;
        pa[i * 3 + 1] = 0;
      }
    }
    (pg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    s1.scale.setScalar(1 + 0.2 * Math.sin(t * 4));
    s2.scale.setScalar(1 + 0.2 * Math.sin(t * 4 + Math.PI));
    g.rotation.y = 0.1 * Math.sin(t * 0.3);
  };
}

/** P253 自发对称破缺, P251 真空涨落 */
function build_vacuum(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const broken = title.includes('破缺');
  // 甜甜圈势（Mexican hat）
  const N = 140;
  const pg = bag.geo(new THREE.BufferGeometry());
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const pot = new THREE.Line(pg, bag.mat(new THREE.LineBasicMaterial({ color: PAL.slate })));
  g.add(pot);
  const pa = (pg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  // 小球在势阱底部滚（对称破缺）
  const bead = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.3, 16, 12)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.pink, emissive: 0xbe185d, emissiveIntensity: 0.7 })),
  );
  g.add(bead);
  // 真空涨落：随机出现的虚粒子对
  const NP = 16;
  const vg = bag.geo(new THREE.BufferGeometry());
  vg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  const vac = new THREE.Points(vg, bag.mat(new THREE.PointsMaterial({
    color: PAL.cyan, size: 0.18, sizeAttenuation: true, transparent: true, opacity: 0.85,
  })));
  g.add(vac);
  const va = (vg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  for (let i = 0; i < NP; i++) {
    va[i * 3] = (Math.random() - 0.5) * 9;
    va[i * 3 + 1] = (Math.random() - 0.5) * 4 + 1.5;
    va[i * 3 + 2] = (Math.random() - 0.5) * 3;
  }
  g.add(panelSprite(THREE, bag, broken ? [
    { text: '自发对称破缺：V(φ) = −μ²|φ|² + λ|φ|⁴，最低点在 |φ| = v ≠ 0', color: '#f8fafc' },
    { text: '势具有对称性但基态不 → 产生 Goldstone 玻色子（相位振动）', color: '#94a3b8' },
    { text: '读数：粉球在环形谷底运动（真空期望值 v），青点 = 虚粒子涨落', color: '#fbbf24' },
  ] : [
    { text: '真空涨落：ΔE·Δt ≥ ℏ/2，虚粒子对瞬时产生并湮灭', color: '#f8fafc' },
    { text: 'Casimir 力、Lamb 位移都是真空涨落的可观测效应', color: '#94a3b8' },
    { text: '读数：青点 = 真空中随机闪现的虚粒子对，粉球 = 势阱试探粒子', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  return (t: number) => {
    // 势曲线（对称破缺时为双阱/环形谷）
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * 8 - 4;
      let V: number;
      if (broken) V = -1.4 * x * x + 0.35 * x * x * x * x + 1.6;
      else V = 0.4 * x * x - 1.4;
      pa[i * 3] = x;
      pa[i * 3 + 1] = V;
      pa[i * 3 + 2] = 0;
    }
    (pg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    if (broken) {
      // 球在环形谷底运动（破缺方向）
      const a = t * 1.4;
      const r = Math.sqrt(1.4 / (2 * 0.35)) * 1.05;
      bead.position.set(r * Math.cos(a), -1.4 * r * r + 0.35 * r ** 4 + 1.6, r * Math.sin(a));
    } else {
      bead.position.set(Math.sin(t * 2) * 1.8, -1.4 + 0.4 * Math.sin(t * 2) ** 2 * 1.8 ** 2, 0);
    }
    // 虚粒子对闪烁
    for (let i = 0; i < NP; i += 2) {
      const on = Math.sin(t * 4 + i) > 0;
      va[i * 3 + 1] += Math.sin(t * 6 + i) * 0.01;
      va[(i + 1) * 3 + 1] -= Math.sin(t * 6 + i) * 0.01;
      if (on && Math.sin(t * 3 + i) > 0.95) {
        va[i * 3] = (Math.random() - 0.5) * 9;
        va[(i + 1) * 3] = va[i * 3];
        va[i * 3 + 1] = (Math.random() - 0.5) * 4 + 1.5;
        va[(i + 1) * 3 + 1] = va[i * 3 + 1] + 0.4;
      }
    }
    (vg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    g.rotation.y = 0.1 * Math.sin(t * 0.3);
    void broken;
  };
}

/** P21 物质波与驻波条件, P112 波包扩散 */
function build_wavepacket(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const standing = title.includes('驻波');
  const N = 240;
  const wg = bag.geo(new THREE.BufferGeometry());
  wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const wave = new THREE.Line(wg, bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan })));
  g.add(wave);
  // 包络（虚线）
  const eg = bag.geo(new THREE.BufferGeometry());
  eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const env = new THREE.Line(eg, bag.mat(new THREE.LineBasicMaterial({
    color: PAL.gold, transparent: true, opacity: 0.7,
  })));
  g.add(env);
  const wa = (wg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  const ea = (eg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  // 驻波分支：n 1→4 扫描、无包络压制的整段驻波 + 去布罗意玻尔环（周长 = nλ₀）
  let rp: Float32Array | null = null;
  let rpAttr: import('three').BufferAttribute | null = null;
  let ringLab: { sprite: import('three').Sprite; set: (txt: string, color?: string) => void } | null = null;
  let nodeLab: { sprite: import('three').Sprite; set: (txt: string, color?: string) => void } | null = null;
  if (standing) {
    wave.position.y = 2.0;
    env.position.y = 2.0;
    // 两端固定柱（驻波节点钉死于 x=±7）
    const postGeo = bag.geo(new THREE.BoxGeometry(0.14, 2.3, 0.5));
    const postMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.green, transparent: true, opacity: 0.85 }));
    [-7, 7].forEach((x) => {
      const m = new THREE.Mesh(postGeo, postMat);
      m.position.set(x, 2.0, 0);
      g.add(m);
    });
    // 玻尔轨道环：半径 rₙ = nλ₀/2π，环上恰容纳 n 个整波（2πr = nλ₀）
    const rg = bag.geo(new THREE.BufferGeometry());
    rp = new Float32Array((N + 1) * 3);
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    rpAttr = rg.getAttribute('position') as import('three').BufferAttribute;
    const ring = new THREE.Line(rg, bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan })));
    g.add(ring);
    ringLab = makeLabel(THREE, bag, '环上驻波：周长 2πr = nλ₀', 4.2, {
      color: '#f8fafc', bg: true, w: 512, h: 72, font: 'bold 34px "PingFang SC", "Microsoft YaHei", sans-serif',
    });
    ringLab.sprite.position.set(4.3, -1.15, 0.6);
    g.add(ringLab.sprite);
    nodeLab = makeLabel(THREE, bag, 'n=1  λ=2L/n=28.0  内节点=0', 4.6, {
      color: '#fbbf24', bg: true, w: 560, h: 72, font: 'bold 34px "PingFang SC", "Microsoft YaHei", sans-serif',
    });
    nodeLab.sprite.position.set(-4.3, -1.15, 0.6);
    g.add(nodeLab.sprite);
  }
  // 波包扩散分支专属：概率密度 |ψ|² 线 + Δx(t) 解析展宽读数（码内 ℏ≡1、m≡1.44）
  const HBAR = 1, MASS = 1.44, K0W = 3.2;
  const OGW = (K0W * K0W * HBAR) / (2 * MASS); // 载波相位频 ω₀ = ℏk₀²/2m（de Broglie：ω=E/ℏ、E=p²/2m）⇒ 相速 ω₀/k₀ = v_g/2
  const VG = (HBAR * K0W) / MASS; // 群速度 v_g = ℏk₀/m = dω/dk|k₀（包络中心平移速度）
  const TAU = (2 * MASS * 1 * 1) / HBAR; // τ = 2mΔx₀²/ℏ（Δx₀ ≡ 1）
  let densAttr: import('three').BufferAttribute | null = null;
  let da: Float32Array | null = null;
  let wpLab: ReturnType<typeof makeLabel> | null = null;
  let lastWpT = -1;
  if (!standing) {
    wave.position.y = 1.3;
    env.position.y = 1.3;
    const dg = bag.geo(new THREE.BufferGeometry());
    dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
    const dens = new THREE.Line(dg, bag.mat(new THREE.LineBasicMaterial({ color: PAL.pink })));
    dens.position.y = -2.6;
    g.add(dens);
    densAttr = dg.getAttribute('position') as import('three').BufferAttribute;
    da = densAttr.array as Float32Array;
    wpLab = makeLabel(THREE, bag, 'Δx(t) 读数', 7.0, {
      bg: true, color: '#fbbf24', w: 820, h: 80, font: 'bold 28px "PingFang SC", "Microsoft YaHei", sans-serif',
    });
    wpLab.sprite.position.set(0, -4.3, 0.8);
    g.add(wpLab.sprite);
  }
  g.add(panelSprite(THREE, bag, standing ? [
    { text: '物质波驻波条件：L = n·λ/2 → λ = 2L/n（De Broglie：λ = h/p），两端固定、不加包络', color: '#f8fafc' },
    { text: '电子在原子中形成驻波 → 分立能级（Bohr：环周长 2πr = nλ，r ∝ n，下方青环）', color: '#94a3b8' },
    { text: '读数：青线 = 驻波 ψ(x)，金线 = 振幅包络 |A(x)|（节点处收零）；绿柱 = 固定端', color: '#fbbf24' },
  ] : [
    { text: '波包扩散：Δx·Δp ≥ ℏ/2，自由粒子波包随时间展宽 Δx(t) = Δx₀√(1 + (ℏt/2mΔx₀²)²)', color: '#f8fafc' },
    { text: '群速度 v_g = ℏk₀/m（包络中心平移）；载波相位 ω₀ = ℏk₀²/2m ⇒ 相速 v_ph = ω₀/k₀ = v_g/2（载波在包络内相对滑行）', color: '#94a3b8' },
    { text: `码内单位 ℏ ≡ 1、m ≡ 1.44、k₀ ≡ 3.2 ⇒ τ = 2mΔx₀²/ℏ = ${TAU.toFixed(2)} s，v_g = ${VG.toFixed(2)}，v_ph = ${(VG / 2).toFixed(2)}（Δx₀ ≡ 1）`, color: '#94a3b8' },
    { text: '读数：青线 = Re ψ（包络×载波），金线 = 包络 |A(x,t)|，粉线 = 概率密度 |ψ|² = 包络²（平滑单峰，变矮变宽、峰 ∝ 1/Δx、面积守恒）', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  let lastNSt = -1;
  return (t: number) => {
    if (standing) {
      // 驻波 n 1→4 扫描：ψ = sin(nπ(x+7)/L)cos(ωt)，两端 x=±7 恒为零；不加高斯包络
      const nSt = 1 + Math.floor(t * 0.25) % 4;
      const osc = Math.cos(t * 3);
      for (let i = 0; i <= N; i++) {
        const x = (i / N) * 14 - 7;
        const shape = Math.sin((nSt * Math.PI * (x + 7)) / 14);
        wa[i * 3] = x;
        wa[i * 3 + 1] = shape * osc * 1.15;
        wa[i * 3 + 2] = 0;
        ea[i * 3] = x;
        ea[i * 3 + 1] = Math.abs(shape) * 1.15; // 金线 = 振幅包络 |A(x)|，节点处收零（与几何同源）
        ea[i * 3 + 2] = 0;
      }
      // 玻尔环：rₙ = nλ₀/2π，环上径向纹波恰 n 个整波（与扫描 n 同步）
      if (rp && rpAttr && ringLab && nodeLab) {
        const lam0 = 2.4;
        const Rb = (nSt * lam0) / (2 * Math.PI);
        for (let i = 0; i <= N; i++) {
          const th = (i / N) * Math.PI * 2;
          const rr = Rb + 0.18 * Math.sin(nSt * th) * osc;
          rp[i * 3] = rr * Math.cos(th);
          rp[i * 3 + 1] = -1.7 + rr * Math.sin(th);
          rp[i * 3 + 2] = 0.8;
        }
        rpAttr.needsUpdate = true;
        if (nSt !== lastNSt) {
          lastNSt = nSt;
          ringLab.set(`环驻波：2πr = ${nSt}λ₀，r = ${Rb.toFixed(2)}`);
          nodeLab.set(`n=${nSt}  λ=2L/n=${(28 / nSt).toFixed(1)}  内节点=${nSt - 1}`);
        }
      }
    } else {
      // 自由高斯波包：Δx(t) = Δx₀√(1+(t/τ)²)（解析扩散律，不再是线性锯齿），中心以群速度 v_g 平移
      const tRec = t % (8 / VG); // 每穿过一次显示区间（8 个单位）重新计时 ⇒ Δx 从 Δx₀ 再长起
      const width = Math.sqrt(1 + (tRec / TAU) ** 2); // Δx(t)（码内 Δx₀ ≡ 1，即密度标准差）
      const center = -4 + VG * tRec; // 包络中心以群速度 v_g = ℏk₀/m 平移
      const normAmp = 1.4 / Math.sqrt(width); // 峰 |ψ| ∝ Δx^(−1/2)（∫|ψ|²dx 守恒 ⇒ 变矮变宽）
      for (let i = 0; i <= N; i++) {
        const x = (i / N) * 14 - 7;
        const d = x - center;
        const envV = Math.exp(-(d * d) / (4 * width * width)); // 振幅包络 |A| = exp(−(x−x_c)²/4Δx²)
        const carrier = Math.sin(K0W * x - OGW * t); // 相位 ω₀ = ℏk₀²/2m ⇒ 相速 v_g/2，载波在包络内滑行
        wa[i * 3] = x;
        wa[i * 3 + 1] = envV * normAmp * carrier;
        wa[i * 3 + 2] = 0;
        ea[i * 3] = x;
        ea[i * 3 + 1] = envV * normAmp;
        ea[i * 3 + 2] = 0;
        if (da) {
          da[i * 3] = x;
          da[i * 3 + 1] = envV * envV * normAmp * normAmp; // 真密度 |ψ|² = |A|² = exp(−(x−x_c)²/2Δx²)（平滑高斯，std ≡ 读数 Δx(t)，= 金线²）
          da[i * 3 + 2] = 0;
        }
      }
      if (densAttr) densAttr.needsUpdate = true;
      if (wpLab && t - lastWpT > 0.2) {
        lastWpT = t;
        wpLab.set(`Δx₀=1.0  t=${tRec.toFixed(2)} s（τ=${TAU.toFixed(2)}）→ Δx(t)=${width.toFixed(2)}  v_g=${VG.toFixed(2)}  v_ph=${(OGW / K0W).toFixed(2)}`);
      }
    }
    (wg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    (eg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
  };
}

/** P507 δ 势的束缚与散射, P506 有限深方势阱, P107 无限深势阱 */
/**
 * 有限深方势阱的束缚态（码内 ℏ²/2m ≡ 1）：
 *   偶宇称  z·tan z = √(z₀²−z²)      奇宇称  −z/tan z = √(z₀²−z²)
 *   z = kL/2，z₀ = (L/2)√V₀；每个交点是一个能级，E = (2z/L)²，κ = √(V₀−E)。
 */
function wellRoots(V0: number, L: number) {
  const z0 = (L / 2) * Math.sqrt(V0);
  const roots: { z: number; even: boolean; E: number; k: number; kap: number }[] = [];
  for (let n = 0; n < 10; n++) {
    const lo = (n * Math.PI) / 2 + 1e-6;
    const hi = Math.min(((n + 1) * Math.PI) / 2 - 1e-6, z0);
    if (hi <= lo) break;
    const f = (z: number) =>
      (n % 2 === 0 ? z * Math.tan(z) : -z / Math.tan(z)) - Math.sqrt(Math.max(0, z0 * z0 - z * z));
    if (f(lo) * f(hi) > 0) continue;
    let a = lo, b = hi, fa = f(a);
    for (let it = 0; it < 80; it++) {
      const mid = (a + b) / 2;
      const fm = f(mid);
      if (fa * fm <= 0) b = mid; else { a = mid; fa = fm; }
    }
    const z = (a + b) / 2;
    const E = (2 * z / L) ** 2;
    roots.push({ z, even: n % 2 === 0, E, k: (2 * z) / L, kap: Math.sqrt(Math.max(0, V0 - E)) });
  }
  return { z0, roots };
}

function build_well(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const delta = title.includes('δ');
  const finite = title.includes('有限深');
  // δ 势（ℏ²/2m ≡ 1）：束缚态衰减率 κ = mg/ℏ² = g/2 ⇒ g = 2κ，束缚能 |E_b| = g²/4 = κ²
  const KAPD = 1.2, GD = 2 * KAPD, E0D = (GD * GD) / 4;
  const Tdel = (E: number) => 1 / (1 + E0D / Math.max(1e-4, E)); // T = 1/[1 + mg²/(2ℏ²E)]
  // 有限深方势阱：阱深 V₀ 与宽度 L 决定 z₀，能级 = 超越方程交点（金条与画布同源）
  const VF = 4.4, LW = 5;
  const WELL = finite ? wellRoots(VF, LW) : null;
  // 势阱几何
  const wellMesh = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(delta ? 0.4 : 5, 3.4, 1.6)),
    bag.mat(new THREE.MeshStandardMaterial({
      color: delta ? PAL.red : PAL.slate, transparent: true, opacity: 0.5, roughness: 0.6,
    })),
  );
  if (!delta) wellMesh.scale.y = 0.7;
  g.add(wellMesh);
  // 分立能级（δ 势仅一条束缚态 → 只画 1 条；无限深势阱按 E_n ∝ n² 排布）
  const levels: import('three').Mesh[] = [];
  const lvGeo = bag.geo(new THREE.BoxGeometry(4.4, 0.07, 0.5));
  const lvMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold }));
  const nLv = delta ? 1 : finite ? (WELL ? WELL.roots.length : 4) : 4;
  // 金条高度：δ 用束缚能级；有限深阱按 E_n 映射到阱箱（阱底 = E 0，阱口 = E V₀）；无限深阱按 n²
  const lvY = (n: number) => (delta
    ? -1.6 + n * 0.8
    : finite
      ? -1.19 + (((WELL && WELL.roots[n - 1]) ? WELL.roots[n - 1].E : 0) / VF) * 2.38
      : -1.05 + ((n * n) / 16) * 2.4);
  for (let n = 1; n <= nLv; n++) {
    const m = new THREE.Mesh(lvGeo, lvMat);
    m.position.set(0, lvY(n), 1.0);
    g.add(m);
    levels.push(m);
  }
  // 无限深势阱：标注能级按 n² 张开（画面与面板「能级 ∝ n²」一致）
  if (!delta && !finite) {
    const eLab = makeLabel(THREE, bag, 'E_n ∝ n²', 2.0, { color: '#fbbf24', bg: true });
    eLab.sprite.position.set(-3.6, 1.5, 1.0);
    g.add(eLab.sprite);
  }
  // δ 势：x=0 处波函数斜率跃变标注（唯一束缚态的折点）
  if (delta) {
    const jumpLab = makeLabel(THREE, bag, 'ψ′(+0) − ψ′(−0) = (2mV₀/ℏ²)ψ(0)', 6.0, {
      color: '#fbbf24', bg: true, w: 768, h: 84, font: 'bold 32px "PingFang SC", "Microsoft YaHei", sans-serif',
    });
    jumpLab.sprite.position.set(0, -2.9, 1.0);
    g.add(jumpLab.sprite);
  }
  // 波函数 ψ_n
  const N = 200;
  const wg = bag.geo(new THREE.BufferGeometry());
  wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const wave = new THREE.Line(wg, bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan })));
  g.add(wave);
  const wa = (wg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  // 画布：δ 势 → T(E) 曲线；有限深阱 → 超越方程交点图（两者各自的分支，位置相同）
  let wPlot: ReturnType<typeof makePlot> | null = null;
  if (delta || finite) {
    wPlot = makePlot(bag, THREE, 340, 280, 4.0, 6.3, -2.6);
    g.add(wPlot.mesh);
  }
  // δ 势透射系数 T(E) = 1/[1 + mg²/(2ℏ²E)] = 1/(1 + κ²/E)：与束缚态衰减率 κ 同一常数，随 E 单调、无共振
  const drawDeltaT = (plot: ReturnType<typeof makePlot>, E: number) => {
    const c = plot.frame('δ 势透射 T(E)', 'E / |E_b|', 'T');
    const W = 340, H = 280;
    c.strokeStyle = '#06b6d4'; c.lineWidth = 3; c.beginPath();
    for (let i = 1; i <= 100; i++) {
      const ee = (i / 100) * 4;
      const T = 1 / (1 + 1 / ee);
      const px = 46 + (ee / 4) * (W - 62);
      const py = (H - 40) - T * (H - 70);
      if (i === 1) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    const ee = Math.min(4, Math.max(0.02, E / E0D));
    const Tc = Tdel(E);
    c.fillStyle = '#fbbf24';
    c.beginPath(); c.arc(46 + (ee / 4) * (W - 62), (H - 40) - Tc * (H - 70), 7, 0, 7); c.fill();
    c.fillStyle = '#94a3b8'; c.font = '13px sans-serif';
    c.fillText(`|E_b| = g²/4 = κ² = ${E0D.toFixed(2)}（κ=${KAPD}）`, 52, 56);
    c.fillText(`E=${E.toFixed(2)} → T=${Tc.toFixed(3)}：单调上升，单 δ 势无共振`, 52, 74);
    plot.tex.needsUpdate = true;
  };
  // 有限深阱：z·tan z（偶）、−z/tan z（奇）与 √(z₀²−z²) 的交点 = 束缚态
  const drawRoots = (plot: ReturnType<typeof makePlot>, nSel: number) => {
    if (!WELL) return;
    const c = plot.frame('束缚态条件：曲线交点 = 能级', 'z = kL/2', 'z·tan z / √(z₀²−z²)');
    const W = 340, H = 280;
    const ZD = WELL.z0 * 1.12;
    const pxOf = (z: number) => 46 + (z / ZD) * (W - 62);
    const pyOf = (v: number) => (H - 40) - ((v + 2) / 10) * (H - 70);
    const branch = (fn: (z: number) => number, from: number, to: number, col: string) => {
      c.strokeStyle = col; c.lineWidth = 3; c.beginPath();
      for (let i = 0; i <= 60; i++) {
        const z = from + (i / 60) * (to - from);
        const v = fn(z);
        const X = pxOf(z), Y = pyOf(Math.max(-2.5, Math.min(8.5, v)));
        if (i === 0) c.moveTo(X, Y); else c.lineTo(X, Y);
      }
      c.stroke();
    };
    for (let n = 0; n < 4; n++) {
      const from = (n * Math.PI) / 2 + 0.02, to = Math.min(((n + 1) * Math.PI) / 2 - 0.02, ZD);
      if (to <= from) break;
      branch(n % 2 === 0 ? (z) => z * Math.tan(z) : (z) => -z / Math.tan(z), from, to, n % 2 === 0 ? '#fbbf24' : '#f472b6');
    }
    branch((z) => Math.sqrt(Math.max(0, WELL.z0 * WELL.z0 - z * z)), 0, WELL.z0, '#06b6d4');
    c.strokeStyle = 'rgba(248,250,252,0.5)'; c.lineWidth = 2; c.setLineDash([6, 5]);
    c.beginPath(); c.moveTo(pxOf(WELL.z0), 40); c.lineTo(pxOf(WELL.z0), H - 40); c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#94a3b8'; c.font = '13px sans-serif';
    c.fillText(`z₀ = (L/2)√V₀ = ${WELL.z0.toFixed(2)}`, pxOf(WELL.z0) - 96, 54);
    WELL.roots.forEach((r, i) => {
      const v = r.even ? r.z * Math.tan(r.z) : -r.z / Math.tan(r.z);
      c.fillStyle = i === nSel - 1 ? '#f8fafc' : '#fbbf24';
      c.beginPath(); c.arc(pxOf(r.z), pyOf(v), i === nSel - 1 ? 9 : 6, 0, 7); c.fill();
      c.fillStyle = '#94a3b8'; c.font = '12px sans-serif';
      c.fillText(`n=${i} E=${r.E.toFixed(2)}`, pxOf(r.z) + 4, pyOf(v) - 6);
    });
    c.fillStyle = '#94a3b8'; c.font = '13px sans-serif';
    c.fillText(`交点数 = 束缚态数 = ${WELL.roots.length}（金 = 偶 z·tan z，粉 = 奇 −z·cot z）`, 50, H - 22);
    plot.tex.needsUpdate = true;
  };
  if (delta) drawDeltaT(wPlot!, 2 * E0D);
  if (finite) drawRoots(wPlot!, 1);
  g.add(panelSprite(THREE, bag, delta ? [
    { text: 'δ 势 V(x) = −g δ(x)：束缚态 E = −mg²/2ℏ²（仅一束缚态，n ≡ 1）', color: '#f8fafc' },
    { text: 'x=0 处斜率跃变：ψ′(+0) − ψ′(−0) = (2mV₀/ℏ²)ψ(0)（波函数在此折返）', color: '#f87171' },
    { text: '散射态透射：T(E) = 1/[1 + mg²/(2ℏ²E)] = 1/(1+κ²/E)，随 E 单调——单 δ 无共振（共振需双 δ）', color: '#94a3b8' },
    { text: '读数：红柱 = δ 势，青线 = 束缚+外行散射波，金条 = 唯一能级；右图金点 = 当前 T(E)', color: '#fbbf24' },
  ] : finite ? [
    { text: '有限深方势阱：偶宇称 k·tan(kL/2) = κ，奇宇称 −k·cot(kL/2) = κ，κ = √(2m(V₀−E))/ℏ', color: '#f8fafc' },
    { text: '波函数渗入阱外（指数尾巴），且在壁 x=±L/2 处值与导数都连续 ⇒ 阱内端点非零', color: '#94a3b8' },
    { text: '束缚态数有限：右图 z·tan z / −z·cot z 与 √(z₀²−z²) 的交点数即能级数', color: '#94a3b8' },
    { text: '读数：青线 = 波函数（偶 cos / 奇 sin，与尾巴连续拼接），金条 = 超越方程解出的能级', color: '#fbbf24' },
  ] : [
    { text: '无限深势阱：E_n = n²π²ℏ²/(2mL²)，ψ_n = √(2/L) sin(nπx/L)', color: '#f8fafc' },
    { text: '能级 ∝ n²：基态非零（零点能），节点数 = n−1', color: '#94a3b8' },
    { text: '读数：青线 = ψ_n(x)，金条按 n² 上疏下密排布，动画切换 n', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  let lastRootN = -1;
  return (t: number) => {
    const n = delta ? 1 : 1 + (Math.floor(t * 0.6) % nLv);
    levels.forEach((m, i) => {
      m.scale.x = i + 1 === n ? 1.15 : 1;
      (m.material as import('three').MeshBasicMaterial).opacity = i + 1 === n ? 1 : 0.5;
    });
    if (delta && wPlot) {
      // 入射能量扫描 |E_b|·[0.15, 3.6]，曲线读数与 T(E) 同源
      const Ed = E0D * (0.15 + 1.75 * (Math.sin(t * 0.4) * 0.5 + 0.5) * 2);
      drawDeltaT(wPlot, Ed);
    }
    if (finite && wPlot && n !== lastRootN) {
      lastRootN = n;
      drawRoots(wPlot, n);
    }
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * 14 - 7;
      let psi: number;
      if (delta) {
        // 唯一束缚态 e^{−κ|x|}（x=0 处有折点 → 斜率跃变）+ 由 δ 散射出的外行波（示意）
        const scat = 0.28 * Math.sin(Math.abs(x) * 2.6 - t * 3.2) * Math.min(1, Math.abs(x) / 1.5);
        psi = Math.exp(-Math.abs(x) * KAPD) * Math.cos(t * 2) + scat;
      } else if (finite) {
        // 有限深阱：阱内偶 cos / 奇 sin（壁处非零），阱外指数尾巴在壁处值与斜率都连续
        const st = WELL ? WELL.roots[n - 1] : { even: true, k: 1, kap: 1, E: 1 };
        const half = LW / 2;
        if (Math.abs(x) < half) {
          psi = st.even ? Math.cos(st.k * x) : Math.sin(st.k * x);
        } else {
          const edge = st.even ? Math.cos(st.k * half) : Math.sin(st.k * half);
          psi = edge * (st.even ? 1 : Math.sign(x)) * Math.exp(-st.kap * (Math.abs(x) - half));
        }
      } else {
        const L = 5;
        psi = Math.abs(x) < L / 2 ? Math.sin((n * Math.PI * (x + L / 2)) / L) : 0;
      }
      wa[i * 3] = x;
      wa[i * 3 + 1] = psi * 1.1;
      wa[i * 3 + 2] = 0.6;
    }
    (wg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
  };
}

/** P154 斯塔克效应, P153 塞曼效应, P533 塞曼效应与能级分裂 */
function build_zeeman(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const stark = title.includes('斯塔克');
  // 能级条（按 m 分裂）
  const nlevels = 3;
  const bars: import('three').Mesh[][] = [];
  const barGeo = bag.geo(new THREE.BoxGeometry(4.6, 0.16, 0.7));
  const barMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold }));
  const splitMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan }));
  for (let i = 0; i < nlevels; i++) {
    const row: import('three').Mesh[] = [];
    for (let k = -1; k <= 1; k++) {
      const m = new THREE.Mesh(barGeo, k === 0 ? barMat : splitMat);
      m.position.set(0, 2.6 - i * 2.0, k * 0.9);
      g.add(m);
      row.push(m);
    }
    bars.push(row);
  }
  // 外场箭头
  const field = new THREE.ArrowHelper(
    stark ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(-5.4, 3.0, 0), 2.0, PAL.red, 0.22, 0.11,
  );
  g.add(field);
  // 跃迁光子
  const photon = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.16, 12, 10)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.pink })),
  );
  g.add(photon);
  const plot = makePlot(bag, THREE, 360, 320, 4.2, 6.6, 0.8);
  g.add(plot.mesh);

  // 谱线区：一条 λ₀ 随 B 拆成三条（Δm=0, ±1），光子分三路射出
  const specCv = document.createElement('canvas');
  specCv.width = 420; specCv.height = 180;
  const specTex = bag.tex(new THREE.CanvasTexture(specCv));
  const specMesh = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(4.2, 1.8)),
    bag.mat(new THREE.MeshBasicMaterial({ map: specTex, transparent: true, depthTest: false })),
  );
  specMesh.position.set(0, -5.2, 0);
  specMesh.renderOrder = 997;
  g.add(specMesh);
  // 三路光子（粉点）
  const photons3 = [0, 1, -1].map((dm) => {
    const p = new THREE.Mesh(
      bag.geo(new THREE.SphereGeometry(0.08, 8, 6)),
      bag.mat(new THREE.MeshBasicMaterial({ color: PAL.pink })),
    );
    g.add(p);
    return { mesh: p, dm };
  });
  // Δm 标签
  const dmLabels = ['Δm=0', 'Δm=+1', 'Δm=−1'];
  const dmTags = dmLabels.map((label) => tag(bag, THREE, label, 0, -5.8, '#f472b6'));
  dmTags.forEach((t) => g.add(t));

  g.add(panelSprite(THREE, bag, stark ? [
    { text: '斯塔克效应：电场下 ΔE = p·E（线性）或 αE²（二次）', color: '#f8fafc' },
    { text: '氢 2p：m=0 两支随电场 E 线性移动 ΔE = ±3eE·a₀，|m|=1 支不移动', color: '#94a3b8' },
    { text: '读数：红箭头 = 外电场，青条 = 劈裂子能级，粉点 = 跃迁光子', color: '#fbbf24' },
  ] : [
    { text: '塞曼效应：ΔE = μ_B g m B，能级按 m = −l…l 劈裂', color: '#f8fafc' },
    { text: '正常塞曼：三线（Δm = 0, ±1）；反常塞曼含自旋 g 因子', color: '#94a3b8' },
    { text: '读数：红箭头 = 外磁场，青条 = 分裂子能级，粉点 = 跃迁光子', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawSplit = (field: number) => {
    const c = plot.frame(stark ? '斯塔克分裂 ΔE ∝ E' : '塞曼分裂', stark ? '电场强度 E' : 'm', 'E');
    const W = 360, H = 320;
    for (let i = 0; i < nlevels; i++) {
      const y0 = 40 + i * 90;
      c.strokeStyle = '#f59e0b'; c.lineWidth = 4;
      c.beginPath();
      c.moveTo(60, y0);
      c.lineTo(W - 30, y0);
      c.stroke();
      for (let k = -1; k <= 1; k++) {
        if (stark && k !== 0) continue; // 线性斯塔克：仅 m=0 两支随 E 移动，|m|=1 支停在金线上
        c.strokeStyle = '#06b6d4'; c.lineWidth = 3;
        c.beginPath();
        if (stark) {
          // 线性斯塔克（氢 2p）：自 E=0 的简并点起直线张开，ΔE = ±p·E 随电场线性增大
          for (const s of [-1, 1]) {
            c.moveTo(60, y0);
            c.lineTo(W - 30, y0 - s * field * 22);
          }
        } else {
          const off = k * field * 22;
          c.moveTo(W / 2, y0 + off);
          c.lineTo(W - 30, y0 + off);
        }
        c.stroke();
      }
    }
    c.fillStyle = '#94a3b8'; c.textAlign = 'left';
    c.fillText(stark ? '2p：ΔE = ±p·E ∝ E（线性）' : 'B 场下 m 分裂', 60, H - 52);
    plot.tex.needsUpdate = true;
  };
  drawSplit(1);
  // 谱线绘制：一条 λ₀ 随 B 拆成三条（Δm=0, ±1）
  const drawSpectrum = (field: number) => {
    const c = specCv.getContext('2d')!;
    const W = 420, H = 180;
    c.fillStyle = 'rgba(7,11,20,0.9)'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#334155'; c.lineWidth = 2; c.strokeRect(2, 2, W - 4, H - 4);
    // 标题
    c.fillStyle = '#f8fafc'; c.font = 'bold 16px "Microsoft YaHei", sans-serif'; c.textAlign = 'center';
    c.fillText('发射谱线（正常塞曼，gL=1）', W / 2, 24);
    // 原始 λ₀ 参考线（虚线）
    const baseX = W / 2;
    c.strokeStyle = '#64748b'; c.setLineDash([4, 4]); c.beginPath();
    c.moveTo(baseX, 36); c.lineTo(baseX, H - 20); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#94a3b8'; c.font = '13px sans-serif';
    c.fillText('λ₀', baseX + 14, 52);
    // B=0 时一条谱线
    const split = stark ? field * 18 : field * 20; // 分裂间距 ∝ B
    const colors = ['#f8fafc', '#ef4444', '#3b82f6']; // 白/红/蓝对应 Δm=0, +1, -1
    for (let i = 0; i < 3; i++) {
      const dx = (i - 1) * split;
      const x = baseX + dx;
      // 谱线（垂直亮线）
      c.strokeStyle = colors[i]; c.lineWidth = 6; c.beginPath();
      c.moveTo(x, 36); c.lineTo(x, H - 20); c.stroke();
      // 辉光效果
      c.strokeStyle = colors[i] + '40'; c.lineWidth = 16; c.beginPath();
      c.moveTo(x, 36); c.lineTo(x, H - 20); c.stroke();
    }
    // Δm 标签
    c.font = 'bold 12px sans-serif';
    c.fillStyle = '#f472b6';
    [-1, 0, 1].forEach((dm, i) => {
      c.fillText(`Δm=${dm > 0 ? '+' : ''}${dm}`, baseX + (i - 1) * split, H - 8);
    });
    // gL=1 标注
    c.fillStyle = '#fbbf24'; c.font = '13px "Microsoft YaHei", sans-serif';
    c.fillText('gL=1', baseX + split + 20, 52);
    specTex.needsUpdate = true;
  };
  drawSpectrum(1);
  return (t: number) => {
    const F = 0.4 + 1.4 * (Math.sin(t * 0.4) * 0.5 + 0.5); // 场强（塞曼 B / 斯塔克 E）
    // 分裂幅度随场强（斯塔克：严格 ∝ E 线性；塞曼：随 B）
    bars.forEach((row) => {
      row.forEach((m) => {
        const k = m.position.z / 0.9;
        m.position.z = k * 0.9 * (stark ? F : 0.6 + F * 0.7);
        m.scale.x = 1 + 0.05 * Math.sin(t * 3);
      });
    });
    field.setLength(1.4 + F * 0.6, 0.22, 0.11);
    // 三路光子动画（Δm=0, +1, -1）
    const split = stark ? F * 18 : F * 20;
    photons3.forEach((ph) => {
      const pu = ((t * 0.6 + ph.dm * 0.3) % 1);
      ph.mesh.position.set(-4 + pu * 8, -5.2, (ph.dm) * split * 0.02);
      ph.mesh.scale.setScalar(1 + 0.4 * Math.sin(t * 8 + ph.dm));
    });
    // Δm 标签跟随谱线位置
    dmTags.forEach((tag, i) => {
      const dx = (i - 1) * split;
      tag.position.x = -4 + dx;
    });
    drawSplit(F);
    drawSpectrum(F);
  };
}
