import type { SceneContext, SceneInstance } from '../types';
import { scaffold, panelSprite, lineFrom, PAL, ResourceBag } from './_common';
import { tag } from './rayoptics';

/**
 * 相对论时空族（spacetime）：对撞机与相对论碰撞 / 长度收缩 / 黎曼曲率 /
 * 时间膨胀 / 吸积盘温度 / 爱因斯坦环 / 引力波旋进 / 霍金辐射 /
 * 克尔黑洞 / 光锥因果 / 闵可夫斯基时空 / 彭罗斯过程 / 引力红移 /
 * 双生子佯谬 / 世界线与固有时。
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
    case 'beams': return build_beams(g, bag, THREE, title);
    case 'contraction': return build_contraction(g, bag, THREE, title);
    case 'curvature': return build_curvature(g, bag, THREE, title);
    case 'dilation': return build_dilation(g, bag, THREE, title);
    case 'disk': return build_disk(g, bag, THREE, title);
    case 'einsteinring': return build_einsteinring(g, bag, THREE, title);
    case 'gwchirp': return build_gwchirp(g, bag, THREE, title);
    case 'hawking': return build_hawking(g, bag, THREE, title);
    case 'kerr': return build_kerr(g, bag, THREE, title);
    case 'lightcone': return build_lightcone(g, bag, THREE, title);
    case 'minkowski': return build_minkowski(g, bag, THREE, title);
    case 'penrose': return build_penrose(g, bag, THREE, title);
    case 'redshift': return build_redshift(g, bag, THREE, title);
    case 'twins': return build_twins(g, bag, THREE, title);
    case 'worldline': return build_worldline(g, bag, THREE, title);
    default: return build_beams(g, bag, THREE, title);
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

/** P133 对撞机与质心能量, P529 相对论碰撞与不变质量 */
function build_beams(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const invariant = title.includes('不变质量');
  // 对撞管道（环）
  const ring = new THREE.Mesh(
    bag.geo(new THREE.TorusGeometry(4.2, 0.35, 16, 80)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x475569, transparent: true, opacity: 0.5, roughness: 0.5 })),
  );
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  // 对撞点
  const vertex = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.4, 20, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: 0xf59e0b, emissiveIntensity: 1 })),
  );
  g.add(vertex);
  // 两束粒子（相反方向）
  const NB = 40;
  const bg = bag.geo(new THREE.BufferGeometry());
  bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NB * 3), 3));
  g.add(new THREE.Points(bg, bag.mat(new THREE.PointsMaterial({ color: PAL.cyan, size: 0.16, sizeAttenuation: true }))));
  const ba = (bg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  // 碰撞产物（喷注）
  const NJ = 30;
  const jg = bag.geo(new THREE.BufferGeometry());
  jg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NJ * 3), 3));
  g.add(new THREE.Points(jg, bag.mat(new THREE.PointsMaterial({ color: PAL.pink, size: 0.14, sizeAttenuation: true }))));
  const ja = (jg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  const plot = makePlot(bag, THREE, 360, 320, 4.2, 6.6, 0.8);
  g.add(plot.mesh);
  // invariant 分支专用画布：实验室系 vs 质心系双参照读数（右侧留给 M_inv 谱）
  const framePlot = invariant ? makePlot(bag, THREE, 340, 300, 3.8, -6.6, 0.8) : null;
  if (framePlot) g.add(framePlot.mesh);
  g.add(panelSprite(THREE, bag, invariant ? [
    { text: '不变质量重建：M_inv = √((ΣE)² − c²(Σp)²) / c²', color: '#f8fafc' },
    { text: '逐事件累加喷注四动量 → M_inv 谱在共振峰位 M₀ 成峰，峰位与参照系无关', color: '#94a3b8' },
    { text: '读数：左 = 实验室系 / 质心系（E、p 各异，金色 M 相同），右 = M_inv 直方图', color: '#fbbf24' },
  ] : [
    { text: '对撞机质心能量：√s = √(2(E₁E₂ + c²|p₁||p₂|))（对头碰最优）', color: '#f8fafc' },
    { text: '固定靶：√s ≈ √(2m c² E)；对头碰无质量极限 E₁ = E₂ = E → √s = 2E', color: '#94a3b8' },
    { text: '读数：青点 = 反向双束，金球 = 对撞点，粉点 = 产物喷注', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawS = (E: number) => {
    const c = plot.frame('√s vs 束流能量 E', 'E (TeV)', '√s (TeV)');
    const W = 360, H = 320;
    c.strokeStyle = '#06b6d4'; c.lineWidth = 3; c.beginPath();
    for (let i = 1; i <= 60; i++) {
      const e = (i / 60) * 7;
      const s = 2 * e;
      const px = 46 + (e / 7) * (W - 62);
      const py = (H - 40) - (s / 14) * (H - 70);
      if (i === 1) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    const px = 46 + (E / 7) * (W - 62);
    const py = (H - 40) - (2 * E / 14) * (H - 70);
    c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(px, py, 7, 0, 7); c.fill();
    c.fillStyle = '#94a3b8'; c.fillText('蓝线：对头碰 √s = 2E', 60, 56);
    plot.tex.needsUpdate = true;
  };

  // ===== invariant 分支：不变质量重建（colliding-beams 的 √s 图保持原样）=====
  // 物理口径：对每个碰撞事件的喷注逐粒子累加四动量，
  //   M_inv = √((ΣE)² − c²(Σp)²) / c²，取自然单位 c = 1（能量以 GeV 计，故数值上即 √((ΣE)²−|Σp|²)）。
  // 共振态（示意 Z 玻色子 M₀ ≈ 91.2 GeV/c²）衰变：在其质心系末态总动量为零，
  // 于是 M_inv 在 M₀ 附近堆积成峰；把同一事件 boost 到实验室系后 ΣE、|Σp| 都变了，
  // 重建出的 M_inv 仍是同一个数 —— 即"不变质量与参照系无关"。
  const M0 = 91.2;                                // 共振峰位 (GeV/c²)，全程固定
  const PEAK_W = 3.2;                             // 峰宽（探测器分辨率 + 自然宽度）
  const BIN_LO = 60, BIN_HI = 130, NBIN = 20;     // M_inv 直方图横轴范围与分箱数
  const hist = new Float32Array(NBIN);            // 逐事件累加的 M_inv 直方图
  let histMax = 1;                                // 归一化柱高用
  let nEvents = 0;                                // 已重建的事件数
  let mLast = M0, mLab = M0, mCom = M0;           // 本事件重建值（实验室系 / 质心系）
  let eLab = M0, pLab = 0, eCom = M0, bLab = 0.4; // 两系的 ΣE 与 c|Σp|、实验室系 boost β
  // 喷注三动量（质心系，逐事件重写；无质量近似下 E_i = |p_i|）
  const jpx = new Float32Array(NJ);
  const jpy = new Float32Array(NJ);
  const jpz = new Float32Array(NJ);
  // 喷注单位方向（与 3D 可见喷注一一对应，供动画沿动量方向飞出）
  const jdx = new Float32Array(NJ);
  const jdy = new Float32Array(NJ);
  const jdz = new Float32Array(NJ);
  /** 标准正态噪声（Box–Muller），让峰有一定宽度 */
  const gauss = (): number => {
    const r1 = Math.max(1e-9, Math.random());
    const r2 = Math.random();
    return Math.sqrt(-2 * Math.log(r1)) * Math.cos(2 * Math.PI * r2);
  };
  /** 生成一次碰撞事件并按 M_inv 公式逐粒子累加重建 */
  const newEvent = (): void => {
    const M = M0 + PEAK_W * gauss();              // 本事件的共振质量
    // 1) 各喷注随机方向 + 随机动量大小（方向与 3D 喷注几何同构）
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < NJ; i++) {
      const a = (i / NJ) * Math.PI * 2 + Math.random() * 0.5;
      const u = Math.random() * 2 - 1;
      const st = Math.sqrt(Math.max(0, 1 - u * u));
      const q = 0.6 + Math.random() * 0.8;
      jpx[i] = st * Math.cos(a) * q;
      jpy[i] = u * q * 0.8;
      jpz[i] = st * Math.sin(a) * q;
      cx += jpx[i]; cy += jpy[i]; cz += jpz[i];
    }
    // 2) 扣掉整体动量 → 进入质心系（Σp = 0）；再按 k = M/Σ|p| 归一使 ΣE = M 严格成立
    let sAbs = 0;
    for (let i = 0; i < NJ; i++) {
      jpx[i] -= cx / NJ; jpy[i] -= cy / NJ; jpz[i] -= cz / NJ;
      sAbs += Math.hypot(jpx[i], jpy[i], jpz[i]);
    }
    const k = sAbs > 1e-9 ? M / sAbs : 0;
    for (let i = 0; i < NJ; i++) {
      jpx[i] *= k; jpy[i] *= k; jpz[i] *= k;
      // 记录该喷注的飞行方向（模长归一），动画里粉点即沿此方向飞出
      const q = Math.hypot(jpx[i], jpy[i], jpz[i]) || 1e-6;
      jdx[i] = jpx[i] / q; jdy[i] = jpy[i] / q; jdz[i] = jpz[i] / q;
    }
    // 3) 沿束流方向 boost 到实验室系（探测器系），逐粒子累加 ΣE、Σp
    bLab = 0.2 + 0.45 * Math.random();
    const gm = 1 / Math.sqrt(1 - bLab * bLab);
    let le = 0, lx = 0, ly = 0, lz = 0;
    for (let i = 0; i < NJ; i++) {
      const e = Math.hypot(jpx[i], jpy[i], jpz[i]);  // 质心系喷注能量
      le += gm * (e + bLab * jpx[i]);                // 洛伦兹变换后的实验室系能量
      lx += gm * (jpx[i] + bLab * e);                // 实验室系动量（boost 方向）
      ly += jpy[i];
      lz += jpz[i];
    }
    eLab = le; pLab = Math.hypot(lx, ly, lz); eCom = M;
    // 4) 两系各自代入公式重建：金色 M 必须一致（不变量）
    mLab = Math.sqrt(Math.max(0, eLab * eLab - pLab * pLab));
    mCom = Math.sqrt(Math.max(0, eCom * eCom));
    mLast = mLab;
    // 5) 落入直方图，事件数累积后峰形显现
    const bIdx = Math.floor(((mLast - BIN_LO) / (BIN_HI - BIN_LO)) * NBIN);
    if (bIdx >= 0 && bIdx < NBIN) {
      hist[bIdx] += 1;
      if (hist[bIdx] > histMax) histMax = hist[bIdx];
    }
    nEvents += 1;
  };
  /** M_inv 直方图：逐事件累加，金色虚线标出稳定共振峰位 */
  const drawHist = (): void => {
    const c = plot.frame('不变质量谱 M_inv', 'M_inv (GeV/c²)', '事件数');
    const W = 360, H = 320;
    const x0 = 46, x1 = W - 14, yBase = H - 40, yTop = 120; // yTop 之下留给柱子
    const binW = (x1 - x0) / NBIN;
    c.fillStyle = 'rgba(244,114,182,0.8)';
    for (let b = 0; b < NBIN; b++) {
      const hh = (hist[b] / histMax) * (yBase - yTop);
      if (hh > 0) c.fillRect(x0 + b * binW + 1, yBase - hh, binW - 2, hh);
    }
    // 峰位参考线（金色虚线，只画在数据区内）+ 读数
    const px = x0 + ((M0 - BIN_LO) / (BIN_HI - BIN_LO)) * (x1 - x0);
    c.strokeStyle = '#fbbf24'; c.lineWidth = 3; c.setLineDash([6, 5]);
    c.beginPath(); c.moveTo(px, yTop - 4); c.lineTo(px, yBase); c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#fbbf24'; c.font = 'bold 16px sans-serif'; c.textAlign = 'right';
    c.fillText(`峰 M₀ = ${M0.toFixed(1)}`, px - 8, yTop + 12);
    c.textAlign = 'left';
    c.font = 'bold 17px sans-serif';
    c.fillText(`共振峰 M₀ = ${M0.toFixed(1)} GeV/c²（稳定不动）`, x0 + 6, 62);
    c.fillStyle = '#f472b6'; c.font = '16px sans-serif';
    c.fillText(`本事件 M_inv = ${mLast.toFixed(1)} GeV/c²`, x0 + 6, 84);
    c.fillStyle = '#94a3b8';
    c.fillText(`N = ${nEvents} 事件（逐粒子累加 ΣE、Σp）`, x0 + 6, 104);
    plot.tex.needsUpdate = true;
  };
  /** 双参照系读数：实验室系与质心系的 ΣE、c|Σp| 各不相同，金色 M_inv 相同 */
  const drawFrames = (): void => {
    if (!framePlot) return;
    const c = framePlot.frame('实验室系 vs 质心系', '四动量分量（c = 1 单位）', 'GeV');
    // 实验室系：探测器实际测到（末态整体沿束流以 β 前冲）
    c.fillStyle = '#06b6d4'; c.fillRect(56, 48, 10, 52);
    c.font = 'bold 17px sans-serif';
    c.fillText(`实验室系（boost β = ${bLab.toFixed(2)}）`, 76, 62);
    c.font = '16px sans-serif'; c.fillStyle = '#cbd5e1';
    c.fillText(`ΣE = ${eLab.toFixed(1)}`, 76, 86);
    c.fillText(`c|Σp| = ${pLab.toFixed(1)}`, 196, 86);
    // 质心系：末态总动量为零，全部能量都是静质量能
    c.fillStyle = '#8b5cf6'; c.fillRect(56, 116, 10, 52);
    c.font = 'bold 17px sans-serif'; c.fillStyle = '#8b5cf6';
    c.fillText('质心系（Σp = 0）', 76, 130);
    c.font = '16px sans-serif'; c.fillStyle = '#cbd5e1';
    c.fillText(`ΣE = ${eCom.toFixed(1)}`, 76, 154);
    c.fillText('c|Σp| = 0.0', 196, 154);
    // 两系重建的不变质量（金色）—— 唯一与参照系无关的量
    c.font = 'bold 17px sans-serif'; c.fillStyle = '#fbbf24';
    c.fillText(`M_inv(实验室) = ${mLab.toFixed(1)} GeV/c²`, 56, 202);
    c.fillText(`M_inv(质心) = ${mCom.toFixed(1)} GeV/c²`, 56, 228);
    c.font = '15px sans-serif'; c.fillStyle = '#94a3b8';
    c.fillText('E、p 两系各异 → 金色 M 相同（不变量）', 56, 254);
    c.fillText('公式：M_inv = √((ΣE)² − c²(Σp)²) / c²', 56, 274);
    framePlot.tex.needsUpdate = true;
  };
  let lastCyc = 0;
  if (invariant) {
    newEvent();
    drawHist();
    drawFrames();
  } else {
    drawS(6.5);
  }
  return (t: number, dt: number) => {
    // 束流沿环运动
    for (let i = 0; i < NB; i++) {
      const half = i < NB / 2;
      const a = t * (half ? 1.6 : -1.6) + (i / NB) * Math.PI * 2;
      ba[i * 3] = Math.cos(a) * 4.2;
      ba[i * 3 + 1] = 0;
      ba[i * 3 + 2] = Math.sin(a) * 4.2;
    }
    (bg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    // 碰撞喷注（周期性）
    const cyc = (t * 0.7) % 4;
    const burst = cyc < 0.6;
    vertex.scale.setScalar(burst ? 1.8 : 1);
    (vertex.material as import('three').MeshStandardMaterial).emissiveIntensity = burst ? 2.4 : 0.9;
    for (let i = 0; i < NJ; i++) {
      const a = (i / NJ) * Math.PI * 2;
      const p = burst ? (cyc / 0.6) : 1;
      const r = burst ? p * 3.4 : 0;
      if (invariant) {
        // 不变质量分支：粉点沿本事件该喷注的动量方向飞出（画布与几何同源）
        ja[i * 3] = jdx[i] * r;
        ja[i * 3 + 1] = jdy[i] * r;
        ja[i * 3 + 2] = jdz[i] * r;
      } else {
        ja[i * 3] = Math.cos(a) * r;
        ja[i * 3 + 1] = Math.sin(a) * r * (i % 2 ? 0.5 : 1);
        ja[i * 3 + 2] = Math.sin(a * 2) * r * 0.4;
      }
    }
    (jg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    if (invariant) {
      // 每个喷注爆发周期 = 一次新碰撞事件 → 重建一个新的 M_inv 并累进直方图
      if (cyc < lastCyc) newEvent();
      lastCyc = cyc;
      drawHist();
      drawFrames();
    } else {
      drawS(6.5);
    }
  };
}

/** P132 长度收缩 */
function build_contraction(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title;
  // 静止标尺（参考）
  const rest = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(6, 0.4, 0.6)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.slate })),
  );
  rest.position.y = 1.6;
  g.add(rest);
  // 运动标尺（随速度收缩）
  const mover = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(6, 0.4, 0.6)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, emissive: 0x0891b2, emissiveIntensity: 0.5 })),
  );
  mover.position.y = -1.6;
  g.add(mover);
  // 速度箭头
  const vel = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(-4.4, -2.6, 0), 2.0, PAL.red, 0.22, 0.11,
  );
  g.add(vel);
  const plot = makePlot(bag, THREE, 360, 320, 4.2, 6.6, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '长度收缩：L = L₀ √(1 − v²/c²) = L₀/γ（沿运动方向）', color: '#f8fafc' },
    { text: '静止长度 L₀ 最长；v → c 时运动标尺趋于零', color: '#94a3b8' },
    { text: '读数：灰 = 静止参考标尺，青 = 运动标尺（随 β 收缩）', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawGamma = (beta: number) => {
    const c = plot.frame('L/L₀ vs β', 'β = v/c', 'L/L₀');
    const W = 360, H = 320;
    c.strokeStyle = '#22c55e'; c.lineWidth = 3; c.beginPath();
    for (let i = 1; i <= 80; i++) {
      const b = (i / 80) * 0.99;
      const ratio = Math.sqrt(1 - b * b);
      const px = 46 + b * (W - 62);
      const py = (H - 40) - ratio * (H - 70);
      if (i === 1) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    const ratio = Math.sqrt(1 - Math.min(0.999, beta) ** 2);
    const px = 46 + beta * (W - 62);
    const py = (H - 40) - ratio * (H - 70);
    c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(px, py, 7, 0, 7); c.fill();
    c.fillStyle = '#94a3b8'; c.fillText('绿线 = √(1−β²)', 60, 56);
    plot.tex.needsUpdate = true;
  };
  drawGamma(0.6);
  return (t: number, dt: number) => {
    const beta = 0.2 + 0.75 * (Math.sin(t * 0.3) * 0.5 + 0.5);
    mover.scale.x = Math.sqrt(1 - beta * beta);
    mover.position.x = Math.sin(t * 0.6) * 1.5;
    vel.setLength(1.2 + beta * 1.4, 0.22, 0.11);
    drawGamma(beta);
  };
}

/** P575 黎曼曲率张量 */
function build_curvature(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title;
  // 弯曲网格（球面示意曲率）
  const grid = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(3.2, 30, 20, 0, Math.PI * 2, 0, Math.PI / 2)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan, wireframe: true, transparent: true, opacity: 0.5 })),
  );
  grid.rotation.x = Math.PI;
  grid.position.y = 1.0;
  g.add(grid);
  // 平坦参考网格
  const flat = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(6.4, 6.4, 12, 12)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.slate, wireframe: true, transparent: true, opacity: 0.4 })),
  );
  flat.rotation.x = -Math.PI / 2;
  flat.position.set(0, -2.4, 0);
  g.add(flat);
  // 平行移动闭合回路：贴在球面的一条纬线上（球半径 3.2、球心 (0,1,0)，极角 φ=45°）
  const PHI = Math.PI / 4;
  const LR = 3.2 * Math.sin(PHI); // 纬圈半径 ≈2.263 → 圆周各点严格在球面上
  const LY = 1.0 - 3.2 * Math.cos(PHI); // 纬圈高度 ≈ −1.263
  const loop = new THREE.Mesh(
    bag.geo(new THREE.TorusGeometry(LR, 0.07, 8, 40)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold })),
  );
  loop.rotation.x = Math.PI / 2;
  loop.position.y = LY;
  g.add(loop);
  // 平行移动矢量：取球面切矢（纬向 e1 与子午向 e2 的标架旋转，无恒定竖直分量）
  const arrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(LR, LY, 0), 1.2, PAL.red, 0.22, 0.11,
  );
  g.add(arrow);
  // 初始/末态方向标记（同一点比较绕圈前后的指向）
  const cosPhi = Math.cos(PHI);
  const sinPhi = Math.sin(PHI);
  const alphaFull = -cosPhi * Math.PI * 2; // 绕一圈矢量在切平面内相对转过的角
  const e10 = new THREE.Vector3(0, 0, 1); // θ=0 的纬向切矢
  const e20 = new THREE.Vector3(-cosPhi, -sinPhi, 0); // θ=0 的子午向切矢
  const initDir = new THREE.ArrowHelper(
    e10.clone(), new THREE.Vector3(LR, LY + 0.02, 0), 0.6, PAL.cyan, 0.12, 0.07,
  );
  g.add(initDir);
  const finalDir = new THREE.ArrowHelper(
    e10.clone().multiplyScalar(Math.cos(alphaFull)).add(e20.clone().multiplyScalar(Math.sin(alphaFull))).normalize(),
    new THREE.Vector3(LR, LY + 0.02, 0), 0.6, PAL.pink, 0.12, 0.07,
  );
  g.add(finalDir);
  // Δφ 标签：完整回路和乐 = 2π(1−cosφ)（≈1.84 rad ≈105°，正比于回路所围球面面积×曲率）
  const dphiTag = tag(bag, THREE, 'Δφ≈105°', LR + 0.9, LY + 1.0, '#f472b6');
  g.add(dphiTag);
  g.add(panelSprite(THREE, bag, [
    { text: '黎曼曲率张量 R^ρ_{σμν} = ∂_μΓ^ρ_{νσ} − ∂_νΓ^ρ_{μσ} + Γ·Γ − Γ·Γ', color: '#f8fafc' },
    { text: '平行移动矢量绕闭合回路后不复原 → 夹角正比于曲率', color: '#94a3b8' },
    { text: '纬线回路严格在球面上：Δφ = 2π(1 − cos φ) = K·A（和乐，非任意系数）', color: '#93c5fd' },
    { text: '读数：青 = 初态切矢，粉 = 绕一圈末态切矢，金圈 = 纬线回路，灰 = 平坦参考', color: '#fbbf24' },
    { text: '里奇收缩：R = g^{μν}R_{μν}（缩并 Bianchi 恒等式 → ∇^μG_{μν} = 0）', color: '#64748b' },
  ], [0, 4.4, 0], 7.8, 'center'));
  return (t: number, dt: number) => {
    void dt;
    // 矢量沿纬线平行输运：切标架 (e1,e2) 随方位角 θ 移动，矢量相对标架以 cosφ 速率回转
    const theta = t * 0.35; // 沿圈的方位角
    const x = LR * Math.cos(theta);
    const z = LR * Math.sin(theta);
    arrow.position.set(x, LY, z);
    const e1 = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta));
    const e2 = new THREE.Vector3(-cosPhi * Math.cos(theta), -sinPhi, -cosPhi * Math.sin(theta));
    const alpha = -cosPhi * theta;
    const dir = e1.multiplyScalar(Math.cos(alpha)).add(e2.multiplyScalar(Math.sin(alpha))).normalize();
    arrow.setDirection(dir);
    arrow.setLength(1.2, 0.22, 0.11);
    g.rotation.y = 0.12 * Math.sin(t * 0.3);
  };
}

/** P08 时间膨胀与钟慢效应 */
function build_dilation(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title;
  // 静止钟
  const clock1 = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(1.1, 1.1, 0.3, 32)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.slate, metalness: 0.5, roughness: 0.4 })),
  );
  clock1.rotation.x = Math.PI / 2;
  clock1.position.set(-3.4, 1.6, 0);
  g.add(clock1);
  // 运动钟（时间变慢）
  const clock2 = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(1.1, 1.1, 0.3, 32)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, metalness: 0.5, roughness: 0.4 })),
  );
  clock2.rotation.x = Math.PI / 2;
  clock2.position.set(3.4, 1.6, 0);
  g.add(clock2);
  // 指针
  const handGeo = bag.geo(new THREE.BoxGeometry(0.08, 0.8, 0.08));
  const handMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold }));
  const h1 = new THREE.Mesh(handGeo, handMat);
  h1.position.copy(clock1.position); h1.position.z += 0.2;
  const h2 = new THREE.Mesh(handGeo, handMat);
  h2.position.copy(clock2.position); h2.position.z += 0.2;
  g.add(h1); g.add(h2);
  // 运动方向箭头
  const vel = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(-5.4, -1.4, 0), 2.2, PAL.red, 0.24, 0.12,
  );
  g.add(vel);
  const plot = makePlot(bag, THREE, 360, 320, 4.2, 6.6, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '时间膨胀：Δt = γ Δt₀ = Δt₀/√(1 − v²/c²)', color: '#f8fafc' },
    { text: '运动钟走得慢（μ 子寿命延长、GPS 卫星钟修正都由此而来）', color: '#94a3b8' },
    { text: '读数：灰 = 静止钟，青 = 运动钟（指针转速随 β 变慢）', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawGamma = (beta: number) => {
    const c = plot.frame('γ = Δt/Δt₀', 'β = v/c', 'γ');
    const W = 360, H = 320;
    c.strokeStyle = '#f472b6'; c.lineWidth = 3; c.beginPath();
    for (let i = 1; i <= 80; i++) {
      const b = (i / 80) * 0.99;
      const gamma = 1 / Math.sqrt(1 - b * b);
      const px = 46 + b * (W - 62);
      const py = (H - 40) - Math.min(4, gamma) / 4 * (H - 70);
      if (i === 1) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    const gamma = 1 / Math.sqrt(1 - Math.min(0.999, beta) ** 2);
    const px = 46 + beta * (W - 62);
    const py = (H - 40) - Math.min(4, gamma) / 4 * (H - 70);
    c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(px, py, 7, 0, 7); c.fill();
    c.fillStyle = '#94a3b8'; c.fillText(`γ = ${gamma.toFixed(2)}`, 60, 56);
    plot.tex.needsUpdate = true;
  };
  drawGamma(0.6);
  return (t: number, dt: number) => {
    const beta = 0.2 + 0.75 * (Math.sin(t * 0.3) * 0.5 + 0.5);
    const gamma = 1 / Math.sqrt(1 - beta * beta);
    h1.rotation.z = -t * 1.6;
    h2.rotation.z = -(t * 1.6) / gamma;
    vel.setLength(1.4 + beta * 1.4, 0.24, 0.12);
    drawGamma(beta);
  };
}

/** P145 吸积盘温度分布 */
function build_disk(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title;
  // 中心黑洞
  const bh = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(1.1, 32, 24)),
    bag.mat(new THREE.MeshBasicMaterial({ color: 0x000000 })),
  );
  g.add(bh);
  // 吸积盘（多层圆盘，内热外冷）
  const rings: import('three').Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const r = 1.6 + i * 0.55;
    const col = new THREE.Color().setHSL(0.08 - i * 0.01, 0.9, 0.55);
    const m = new THREE.Mesh(
      bag.geo(new THREE.RingGeometry(r - 0.26, r + 0.26, 64)),
      bag.mat(new THREE.MeshBasicMaterial({ color: col.getHex(), side: THREE.DoubleSide, transparent: true, opacity: 0.9 })),
    );
    m.rotation.x = -Math.PI / 2 + 0.35;
    g.add(m);
    rings.push(m);
  }
  // 光子球示意
  const photon = new THREE.Mesh(
    bag.geo(new THREE.TorusGeometry(1.35, 0.06, 8, 60)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold })),
  );
  photon.rotation.x = -Math.PI / 2 + 0.35;
  g.add(photon);
  const plot = makePlot(bag, THREE, 360, 320, 4.2, 6.6, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '吸积盘温度：T(r) ∝ (M_dot/σ r³)^{1/4}（Shakura–Sunyaev）', color: '#f8fafc' },
    { text: '内区温度可达 10⁷ K，发出 X 射线；T ∝ r^{-3/4} 向外降低；内紫外红外：多色黑体叠加', color: '#94a3b8' },
    { text: '读数：盘由内橙热向外红冷，金环 = 光子球（r = 3M = 1.5 r_s）', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawT = (r: number) => {
    const c = plot.frame('T(r) 温度剖面', 'r/r_s', 'T');
    const W = 360, H = 320;
    c.strokeStyle = '#f59e0b'; c.lineWidth = 3; c.beginPath();
    for (let i = 1; i <= 80; i++) {
      const rr = 2 + (i / 80) * 10;
      const T = Math.pow(6 / rr, 0.75);
      const px = 46 + ((rr - 2) / 10) * (W - 62);
      const py = (H - 40) - Math.min(1, T) * (H - 70);
      if (i === 1) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    const T = Math.pow(6 / Math.max(2, r), 0.75);
    const px = 46 + ((Math.max(2, r) - 2) / 10) * (W - 62);
    const py = (H - 40) - Math.min(1, T) * (H - 70);
    c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(px, py, 7, 0, 7); c.fill();
    c.fillStyle = '#94a3b8'; c.fillText('T ∝ r^{-3/4}', 60, 56);
    plot.tex.needsUpdate = true;
  };
  drawT(4);
  return (t: number, dt: number) => {
    rings.forEach((m, i) => { m.rotation.z = t * (1.8 / (1 + i * 0.3)); });
    photon.rotation.z = t * 2.4;
    drawT(3 + 2 * Math.sin(t * 0.4) + 2);
  };
}

/** P41 爱因斯坦环与引力透镜 */
function build_einsteinring(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title;
  // 中心透镜质量
  const lens = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(1.2, 32, 24)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.violet, emissive: 0x7c3aed, emissiveIntensity: 0.6 })),
  );
  g.add(lens);
  // 爱因斯坦环
  const ring = new THREE.Mesh(
    bag.geo(new THREE.TorusGeometry(3.2, 0.1, 10, 80)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold })),
  );
  g.add(ring);
  // 背景源
  const source = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.4, 18, 14)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, emissive: 0x0891b2, emissiveIntensity: 1 })),
  );
  source.position.z = -6;
  g.add(source);
  // 光线弯曲路径
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const pts: import('three').Vector3[] = [];
    for (let s = 0; s <= 60; s++) {
      const u = (s / 60) * 2 - 1;
      const z = u * 7;
      const bend = Math.exp(-(z * z) / 6) * 2.6;
      pts.push(new THREE.Vector3(Math.cos(a) * (1.0 + bend), Math.sin(a) * (1.0 + bend), z));
    }
    g.add(new THREE.Line(
      bag.geo(new THREE.BufferGeometry().setFromPoints(pts)),
      bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.6 })),
    ));
  }
  const plot = makePlot(bag, THREE, 340, 300, 3.8, 6.8, 0.8);
  g.add(plot.mesh);
  // 弱透镜剪切：源平面外的背景星系被切变沿切向拉长（g ∝ θ_E²/D²，幅度教学放大）
  const gals: { m: import('three').Mesh; a: number; d: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.45;
    const d = 4.6 + (i % 3) * 0.85;
    const m = new THREE.Mesh(
      bag.geo(new THREE.CircleGeometry(0.42, 18)),
      bag.mat(new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.5 })),
    );
    m.position.set(Math.cos(a) * d, Math.sin(a) * d, -5.4);
    m.rotation.z = a; // 局部 y 轴 = 切向 → scale.y 拉伸即切向剪
    g.add(m);
    gals.push({ m, a, d });
  }
  g.add(panelSprite(THREE, bag, [
    { text: '爱因斯坦环：θ_E = √(4GM/c² · D_LS/(D_L D_S))', color: '#f8fafc' },
    { text: '背景源、透镜、观测者共线 → 光线绕偏折成环形像', color: '#94a3b8' },
    { text: '弱透镜剪切：远端背景星系被拉成切向弧（g ∝ θ_E²/D²，幅度示意）', color: '#93c5fd' },
    { text: '读数：金环半径 ∝ √M 与 θ_E 曲线同源，青线 = 弯曲光线，紫球 = 透镜质量', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawTheta = (M: number) => {
    const c = plot.frame('θ_E vs 透镜质量 M', 'M/M☉', 'θ_E″');
    const W = 340, H = 300;
    c.strokeStyle = '#fbbf24'; c.lineWidth = 3; c.beginPath();
    for (let i = 1; i <= 60; i++) {
      const m = (i / 60) * 10;
      const th = Math.sqrt(m) * 0.8;
      const px = 46 + (m / 10) * (W - 62);
      const py = (H - 40) - Math.min(3, th) / 3 * (H - 70);
      if (i === 1) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    const th = Math.sqrt(Math.max(0.1, M)) * 0.8;
    const px = 46 + (Math.min(10, M) / 10) * (W - 62);
    const py = (H - 40) - Math.min(3, th) / 3 * (H - 70);
    c.fillStyle = '#06b6d4'; c.beginPath(); c.arc(px, py, 7, 0, 7); c.fill();
    plot.tex.needsUpdate = true;
  };
  drawTheta(4);
  return (t: number, dt: number) => {
    g.rotation.y = t * 0.15;
    const M = 4 + 2 * Math.sin(t * 0.3);
    // 环半径与 θ_E 曲线同源：θ_E ∝ √M，基径取 M=4 时的 3.2
    ring.scale.setScalar(Math.sqrt(M / 4));
    lens.scale.setScalar(1 + 0.04 * Math.sin(t * 2));
    // 弱剪切：切变幅度随 θ_E²/D² 衰减（教学放大系数），远端更接近圆
    for (const gl of gals) {
      const s = 2.2 * (M / 4) / (gl.d * gl.d); // 教学放大：可见椭率 ~10%→5%
      gl.m.scale.set(1 - s, 1 + s, 1);
    }
    drawTheta(M);
  };
}

/** P230 引力波旋进信号 */
function build_gwchirp(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title;
  // 双致密天体（旋进）
  const b1 = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.55, 24, 18)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, emissive: 0x0891b2, emissiveIntensity: 0.7 })),
  );
  const b2 = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.4, 20, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.pink, emissive: 0xbe185d, emissiveIntensity: 0.7 })),
  );
  g.add(b1); g.add(b2);
  // 引力波（横波示意，两条偏振）
  const N = 240;
  const w1g = bag.geo(new THREE.BufferGeometry());
  w1g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const w1 = new THREE.Line(w1g, bag.mat(new THREE.LineBasicMaterial({ color: PAL.gold })));
  w1.position.y = 2.8;
  g.add(w1);
  const w2g = bag.geo(new THREE.BufferGeometry());
  w2g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const w2 = new THREE.Line(w2g, bag.mat(new THREE.LineBasicMaterial({ color: PAL.violet, transparent: true, opacity: 0.75 })));
  w2.position.y = -3.0;
  g.add(w2);
  const w1a = (w1g.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  const w2a = (w2g.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  const plot = makePlot(bag, THREE, 360, 320, 4.2, 6.6, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '引力波旋进：h ∝ (GM/c²r)(v/c)²，频率 f = 2f_orb → chirp', color: '#f8fafc' },
    { text: 'LIGO GW150914：36+29 M☉ 旋进合并，f 从 35 → 250 Hz', color: '#94a3b8' },
    { text: '读数：金/紫 = 两条偏振 h₊/h×，双球旋进半径随时间收缩', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawChirp = (phase: number) => {
    const c = plot.frame('应变 h(t) chirp', 't', 'h');
    const W = 360, H = 320;
    // 含噪数据（灰色）
    c.strokeStyle = '#9ca3af'; c.lineWidth = 1.5; c.beginPath();
    for (let i = 0; i <= 160; i++) {
      const u = i / 160;
      const f = 1 + u * 6;
      const amp = 0.3 + u * 0.7;
      const noise = (Math.random() - 0.5) * 0.15;
      const h = amp * Math.sin(f * u * 24 + phase) + noise;
      const px = 46 + u * (W - 62);
      const py = (H / 2) - h * (H / 2 - 50);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    // 模板曲线（虚线橙色）
    c.setLineDash([4, 3]); c.strokeStyle = '#f59e0b'; c.lineWidth = 2; c.beginPath();
    for (let i = 0; i <= 160; i++) {
      const u = i / 160;
      const f = 1 + u * 6;
      const amp = 0.3 + u * 0.7;
      const h = amp * Math.sin(f * u * 24 + phase);
      const px = 46 + u * (W - 62);
      const py = (H / 2) - h * (H / 2 - 50);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#94a3b8'; c.fillText('灰 = 含噪数据，橙 = 模板滑动相关 → 峰值定位并合时刻', 60, 56);
    plot.tex.needsUpdate = true;
  };
  drawChirp(0);
  return (t: number, dt: number) => {
    const u = (t * 0.16) % 1;
    const r = 3.4 - 2.4 * u;
    const w = 1.2 + 3.5 * u;
    const a = t * w;
    b1.position.set(Math.cos(a) * r * 0.6, 0, Math.sin(a) * r * 0.6);
    b2.position.set(Math.cos(a + Math.PI) * r * 0.6, 0, Math.sin(a + Math.PI) * r * 0.6);
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * 14 - 7;
      const amp = 0.3 + 0.9 * u;
      const arg = x * (1.4 + u * 3.2) - t * (3 + u * 8);
      const env = Math.exp(-(x * x) / 60);
      // 面观(face-on)圆轨道：两偏振 h₊、h× 同幅、相差 π/2（圆偏振），h× 不能是同相缩比副本
      const h1 = amp * Math.sin(arg) * env;
      const h2 = amp * Math.cos(arg) * env; // = sin(arg + π/2)
      w1a[i * 3] = x; w1a[i * 3 + 1] = h1; w1a[i * 3 + 2] = 0;
      w2a[i * 3] = x; w2a[i * 3 + 1] = h2; w2a[i * 3 + 2] = 0;
    }
    (w1g.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    (w2g.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    drawChirp(t * 3);
  };
}

/** P143 霍金辐射 */
function build_hawking(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title;
  // 黑洞
  const bh = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(1.4, 32, 24)),
    bag.mat(new THREE.MeshBasicMaterial({ color: 0x000000 })),
  );
  g.add(bh);
  // 视界
  const horizon = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(1.6, 32, 24)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.violet, wireframe: true, transparent: true, opacity: 0.4 })),
  );
  g.add(horizon);
  // 事件视界外的虚粒子对（一个落入、一个逃逸）
  const NP = 24;
  const pg = bag.geo(new THREE.BufferGeometry());
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  g.add(new THREE.Points(pg, bag.mat(new THREE.PointsMaterial({
    color: PAL.gold, size: 0.16, sizeAttenuation: true,
  }))));
  const pa = (pg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  const plot = makePlot(bag, THREE, 340, 300, 3.8, 6.8, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '霍金辐射：T_H = ℏc³/(8πGMk_B) ∝ 1/M', color: '#f8fafc' },
    { text: '视界外虚粒子对：一个落入、一个逃逸 → 黑洞蒸发', color: '#94a3b8' },
    { text: '读数：金点 = 辐射粒子（随半径向外扩散），黑洞缓慢缩小', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawSpectrum = (T: number) => {
    const c = plot.frame('霍金辐射谱', 'E', 'dN/dE');
    const W = 340, H = 300;
    c.strokeStyle = '#f59e0b'; c.lineWidth = 3; c.beginPath();
    for (let i = 1; i <= 80; i++) {
      const e = 0.2 + (i / 80) * 3;
      const x = e / T;
      const f = x > 40 ? 0 : (x * x) / (Math.exp(x) - 1 || 1);
      const px = 46 + ((e - 0.2) / 3) * (W - 62);
      const py = (H - 40) - Math.min(1, f / 0.5) * (H - 70);
      if (i === 1) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    c.fillStyle = '#94a3b8'; c.fillText('T ∝ 1/M：质量越大辐射越冷', 56, 56);
    plot.tex.needsUpdate = true;
  };
  drawSpectrum(1.0);
  return (t: number, dt: number) => {
    const shrink = 1 - 0.05 * Math.sin(t * 0.2);
    bh.scale.setScalar(shrink);
    horizon.scale.setScalar(shrink);
    for (let i = 0; i < NP; i++) {
      const a = (i / NP) * Math.PI * 2;
      const cyc = ((t * 0.5 + i / NP) % 1);
      const out = i % 2 === 0;
      const r = out ? 1.7 + cyc * 4 : 1.7 - cyc * 1.4;
      pa[i * 3] = Math.cos(a) * r;
      pa[i * 3 + 1] = Math.sin(a) * r * 0.6;
      pa[i * 3 + 2] = Math.sin(a * 2) * r * 0.4;
    }
    (pg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    drawSpectrum(1.0 / shrink);
  };
}

/** P142 克尔黑洞与能层 */
function build_kerr(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title;
  // 事件视界
  const horizon = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(1.3, 32, 24)),
    bag.mat(new THREE.MeshBasicMaterial({ color: 0x000000 })),
  );
  g.add(horizon);
  // 能层（扁球，随转动拉长）
  const ergo = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(2.4, 32, 24)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.violet, wireframe: true, transparent: true, opacity: 0.4 })),
  );
  g.add(ergo);
  // 吸积盘（赤道）
  const disk = new THREE.Mesh(
    bag.geo(new THREE.RingGeometry(2.6, 5.4, 80)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.amber, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })),
  );
  disk.rotation.x = -Math.PI / 2 + 0.3;
  g.add(disk);
  // 拖曳 frame-dragging 箭头
  const drag = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 3.2, 0), 1.6, PAL.cyan, 0.2, 0.1,
  );
  g.add(drag);
  const plot = makePlot(bag, THREE, 340, 300, 3.8, 6.8, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '克尔黑洞：a = J/Mc，转动产生能层（ergosphere）', color: '#f8fafc' },
    { text: '能层内 ds² 时轴类空 → 任何粒子必须随黑洞共转（参考系拖曳）', color: '#94a3b8' },
    { text: '读数：黑球 = 事件视界，紫网 = 能层，金盘 = 吸积盘（差速）', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawErgo = (a: number) => {
    const c = plot.frame('能层半径 vs a', 'θ', 'r_ergo/M');
    const W = 340, H = 300;
    c.strokeStyle = '#8b5cf6'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 60; i++) {
      const th = (i / 60) * Math.PI;
      const r = 1 + Math.sqrt(1 - a * a * Math.cos(th) ** 2);
      const px = 46 + (i / 60) * (W - 62);
      const py = (H - 40) - Math.min(2.5, r) / 2.5 * (H - 70);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    c.fillStyle = '#94a3b8'; c.fillText('赤道处能层最宽', 56, 56);
    plot.tex.needsUpdate = true;
    void a;
  };
  drawErgo(0.9);
  return (t: number, dt: number) => {
    const a = 0.6 + 0.35 * Math.sin(t * 0.3);
    ergo.scale.set(1 + a * 0.3, 1 - a * 0.2, 1 + a * 0.3);
    disk.rotation.z = t * (1.2 + a);
    drag.setLength(1.2 + a * 0.8, 0.2, 0.1);
    g.rotation.y = t * 0.1;
    drawErgo(a);
  };
}

/** P127 光锥与因果结构 */
function build_lightcone(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title;
  // 时空平面（t-x）
  const plane = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(9, 9, 12, 12)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.slate, wireframe: true, transparent: true, opacity: 0.35 })),
  );
  plane.rotation.x = -Math.PI / 2;
  g.add(plane);
  // 上/下光锥：ConeGeometry 锥尖在 +h/2，上锥翻转（rotation.x = π）后锥尖朝下，
  // 再各自平移 ±h/2 → 两锥锥尖都落在事件点 y=0；radius = height → 半顶角 45°
  const coneUp = new THREE.Mesh(
    bag.geo(new THREE.ConeGeometry(3.4, 3.4, 40, 1, true)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan, wireframe: true, transparent: true, opacity: 0.6 })),
  );
  coneUp.rotation.x = Math.PI;
  coneUp.position.y = 1.7;
  g.add(coneUp);
  const coneDn = new THREE.Mesh(
    bag.geo(new THREE.ConeGeometry(3.4, 3.4, 40, 1, true)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.violet, wireframe: true, transparent: true, opacity: 0.6 })),
  );
  coneDn.position.y = -1.7;
  g.add(coneDn);
  // 事件点
  const event = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.28, 16, 12)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: 0xf59e0b, emissiveIntensity: 1 })),
  );
  g.add(event);
  // 类时/类光/类空世界线示意
  const tl = lineFrom(THREE, bag, [
    new THREE.Vector3(0, -4, 0), new THREE.Vector3(1.6, 4, 0),
  ], PAL.green);
  const spacelike = lineFrom(THREE, bag, [
    new THREE.Vector3(-3, 0, 0), new THREE.Vector3(3, 0, 0),
  ], PAL.red, true);
  g.add(tl); g.add(spacelike);
  g.add(panelSprite(THREE, bag, [
    { text: '光锥：ds² = −c²dt² + dx²，光沿 |dx| = c dt → 锥面与时间轴成 45°', color: '#f8fafc' },
    { text: '锥内类时（可因果影响），锥外类空（无因果联系）；锥尖 = 事件点', color: '#94a3b8' },
    { text: '读数：金 = 事件点，青 = 未来光锥，紫 = 过去光锥，绿 = 类时世界线', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  return (t: number, dt: number) => {
    const pulse = 1 + 0.08 * Math.sin(t * 2);
    coneUp.scale.set(pulse, 1, pulse);
    coneDn.scale.set(pulse, 1, pulse);
    // 事件点恒在原点（= 双锥锥尖），只做脉动
    event.scale.setScalar(1 + 0.3 * Math.sin(t * 4));
    g.rotation.y = 0.15 * Math.sin(t * 0.3);
  };
}

/** P134 闵可夫斯基时空 */
function build_minkowski(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title;
  // 时空网格
  const grid = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(9, 9, 12, 12)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.slate, wireframe: true, transparent: true, opacity: 0.4 })),
  );
  grid.rotation.x = -Math.PI / 2;
  g.add(grid);
  // 双曲面（固有间隔不变：s² = c²t² − r² = const）
  const HN = 16, HA = 32;
  const pos = new Float32Array((HN + 1) * (HA + 1) * 3);
  for (let s = 0; s < 2; s++) {
    const off = s * (HN + 1) * (HA + 1);
    for (let i = 0; i <= HN; i++) {
      const r = 0.3 + 2.4 * (i / HN);
      const ct = Math.sqrt(1 + r * r);
      for (let j = 0; j <= HA; j++) {
        const a = (j / HA) * Math.PI * 2;
        const v = off + i * (HA + 1) + j;
        pos[v * 3] = r * Math.cos(a);
        pos[v * 3 + 1] = (s ? -ct : ct) + 1.6;
        pos[v * 3 + 2] = r * Math.sin(a);
      }
    }
  }
  const hypGeo = bag.geo(new THREE.BufferGeometry());
  hypGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const hyper = new THREE.Mesh(hypGeo, bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan, wireframe: true, transparent: true, opacity: 0.4 })));
  g.add(hyper);
  // 世界线（类时）
  const worldline = lineFrom(THREE, bag, [
    new THREE.Vector3(-4, -3, 0), new THREE.Vector3(4, 4, 0),
  ], PAL.gold);
  g.add(worldline);
  // 光锥线
  g.add(lineFrom(THREE, bag, [
    new THREE.Vector3(-4, -4, 0.4), new THREE.Vector3(4, 4, 0.4),
  ], PAL.red, true));
  g.add(lineFrom(THREE, bag, [
    new THREE.Vector3(-4, 4, 0.4), new THREE.Vector3(4, -4, 0.4),
  ], PAL.red, true));
  const plot = makePlot(bag, THREE, 340, 300, 3.8, 6.8, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '闵可夫斯基时空：ds² = −c²dt² + dx² + dy² + dz²（号差 −+++）', color: '#f8fafc' },
    { text: '时空间隔为不变量：所有观测者对 ds² 取值相同', color: '#94a3b8' },
    { text: '读数：金线 = 类时世界线，红虚 = 类光（光锥边界）', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawInvariant = (v: number) => {
    const c = plot.frame('时空间隔 ds²', 'ct', 'x');
    const W = 340, H = 300;
    c.strokeStyle = '#ef4444'; c.setLineDash([5, 5]); c.lineWidth = 2;
    c.beginPath(); c.moveTo(46, H - 40); c.lineTo(W - 14, 40); c.stroke();
    c.beginPath(); c.moveTo(46, 40); c.lineTo(W - 14, H - 40); c.stroke();
    c.setLineDash([]);
    c.strokeStyle = '#fbbf24'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 60; i++) {
      const u = i / 60;
      const x = v * u;
      const px = 46 + u * (W - 62);
      const py = (H - 40) - x * (H - 70);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    c.fillStyle = '#94a3b8'; c.fillText('黄线：类时（类光内）', 56, 56);
    plot.tex.needsUpdate = true;
    void v;
  };
  drawInvariant(0.6);
  return (t: number, dt: number) => {
    g.rotation.y = 0.15 * Math.sin(t * 0.3);
    hyper.rotation.y = t * 0.3;
    const v = 0.3 + 0.5 * (Math.sin(t * 0.4) * 0.5 + 0.5);
    drawInvariant(v);
  };
}

/** P146 彭罗斯过程 */
function build_penrose(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title;
  // 黑洞
  const bh = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(1.3, 32, 24)),
    bag.mat(new THREE.MeshBasicMaterial({ color: 0x000000 })),
  );
  g.add(bh);
  // 能层
  const ergo = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(2.6, 32, 24)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.violet, wireframe: true, transparent: true, opacity: 0.45 })),
  );
  ergo.scale.set(1.2, 1, 1.2);
  g.add(ergo);
  // 能层内的粒子（分裂为两块，一块落入、一块带走更多能量）
  const pIn = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.3, 16, 12)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, emissive: 0x0891b2, emissiveIntensity: 0.7 })),
  );
  const pOut = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.34, 16, 12)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: 0xf59e0b, emissiveIntensity: 0.7 })),
  );
  g.add(pIn); g.add(pOut);
  // 能量箭头
  const eIn = new THREE.ArrowHelper(
    new THREE.Vector3(-1, 0, 0), new THREE.Vector3(2.6, 1.6, 0), 1.4, PAL.cyan, 0.2, 0.1,
  );
  const eOut = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(2.6, -1.6, 0), 2.0, PAL.gold, 0.2, 0.1,
  );
  g.add(eIn); g.add(eOut);
  const plot = makePlot(bag, THREE, 340, 300, 3.8, 6.8, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '彭罗斯过程：在能层内分裂粒子，落入部分带负能量', color: '#f8fafc' },
    { text: '逃逸部分能量 > 初始能量 → 提取黑洞转动动能（E_out > E_in）', color: '#94a3b8' },
    { text: '读数：紫网 = 能层，青/金 = 分裂两块，能量箭头显示增益', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawGain = (gain: number) => {
    const c = plot.frame('能量增益', '过程', 'E');
    const W = 340, H = 300;
    c.strokeStyle = '#06b6d4'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(60, H - 60); c.lineTo(60, 70); c.stroke();
    c.strokeStyle = '#f59e0b'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(W - 80, H - 60); c.lineTo(W - 80, 70 - gain * 30); c.stroke();
    c.fillStyle = '#06b6d4'; c.textAlign = 'center'; c.fillText('E_in', 60, H - 44);
    c.fillStyle = '#f59e0b'; c.fillText('E_out', W - 80, H - 44);
    c.textAlign = 'left';
    c.fillStyle = '#94a3b8'; c.fillText('E_out > E_in（提取转动动能）', 50, 50);
    plot.tex.needsUpdate = true;
  };
  drawGain(1.2);
  return (t: number, dt: number) => {
    const u = (t * 0.5) % 1;
    const inR = 4.4 - u * 2.6;
    pIn.position.set(Math.cos(t) * inR * 0.6, 0.8 * Math.sin(t * 1.3), Math.sin(t) * inR * 0.6);
    pOut.position.set(Math.cos(t + 1) * (2.0 + u * 3.4), -0.6, Math.sin(t + 1) * (2.0 + u * 3.4));
    pIn.scale.setScalar(1 - u * 0.5);
    pOut.scale.setScalar(0.8 + u * 0.5);
    const gain = 0.6 + u * 1.0;
    eOut.setLength(1.2 + gain * 0.8, 0.2, 0.1);
    g.rotation.y = t * 0.12;
    drawGain(gain);
  };
}

/** P138 引力红移 */
function build_redshift(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title;
  // 中心质量（引力源）
  const mass = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(1.6, 32, 24)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.violet, emissive: 0x7c3aed, emissiveIntensity: 0.5 })),
  );
  g.add(mass);
  // 光子从深处逃逸（颜色红移）
  const NP = 16;
  const pg = bag.geo(new THREE.BufferGeometry());
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  const colors = new Float32Array(NP * 3);
  pg.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.add(new THREE.Points(pg, bag.mat(new THREE.PointsMaterial({
    size: 0.2, vertexColors: true, sizeAttenuation: true,
  }))));
  const pa = (pg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  const ca = colors;
  // 波长拉伸示意（波纹）
  const N = 160;
  const wg = bag.geo(new THREE.BufferGeometry());
  wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const wave = new THREE.Line(wg, bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan })));
  wave.position.y = 3.0;
  g.add(wave);
  const wa = (wg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  const plot = makePlot(bag, THREE, 340, 300, 3.8, 6.8, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '引力红移：ν_obs = ν_em √(1 − 2GM/rc²)，光子爬出势阱损失能量', color: '#f8fafc' },
    { text: 'z = Δλ/λ ≈ GM/(rc²)（弱场近似）；Pound–Rebka 实验验证', color: '#94a3b8' },
    { text: '读数：光子由青（高频）变红（低频）向外扩散，波长拉长', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawShift = (rObs: number) => {
    const c = plot.frame('红移 z vs r', 'r/r_s', 'z');
    const W = 340, H = 300;
    // 精确史瓦西红移：1+z = 1/√(1 − r_s/r)（r 以 r_s 为单位，rs=1）
    const zOf = (r: number): number => 1 / Math.sqrt(Math.max(1e-4, 1 - 1 / r)) - 1;
    c.strokeStyle = '#ef4444'; c.lineWidth = 3; c.beginPath();
    for (let i = 1; i <= 60; i++) {
      const r = 1.2 + (i / 60) * 8;
      const zz = zOf(r);
      const px = 46 + ((r - 1.2) / 8) * (W - 62);
      const py = (H - 40) - Math.min(3, zz) / 3 * (H - 70);
      if (i === 1) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    // 读数点直接取 (r, z(r))——保证金点始终落在自身曲线上
    const r0 = Math.max(1.2, Math.min(9.2, rObs));
    const z0 = zOf(r0);
    const px = 46 + ((r0 - 1.2) / 8) * (W - 62);
    const py = (H - 40) - Math.min(3, z0) / 3 * (H - 70);
    c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(px, py, 7, 0, 7); c.fill();
    c.fillStyle = '#f8fafc'; c.fillText(`r = ${r0.toFixed(2)} r_s，z = ${z0.toFixed(2)}`, 56, 78);
    c.fillStyle = '#94a3b8'; c.fillText('越靠近中心红移越大', 56, 56);
    plot.tex.needsUpdate = true;
  };
  drawShift(3.0);
  return (t: number, dt: number) => {
    for (let i = 0; i < NP; i++) {
      const cyc = ((t * 0.4 + i / NP) % 1);
      const r = 1.8 + cyc * 5;
      const a = (i / NP) * Math.PI * 2;
      pa[i * 3] = Math.cos(a + t * 0.3) * r;
      pa[i * 3 + 1] = Math.sin(a * 1.3) * r * 0.5;
      pa[i * 3 + 2] = Math.sin(a + t * 0.3) * r;
      ca[i * 3] = 0.2 + cyc * 0.8;
      ca[i * 3 + 1] = 0.7 - cyc * 0.6;
      ca[i * 3 + 2] = 1 - cyc * 0.8;
    }
    (pg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    (pg.getAttribute('color') as import('three').BufferAttribute).needsUpdate = true;
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * 14 - 7;
      const k = 3.4 / (1 + Math.abs(x) * 0.4);
      wa[i * 3] = x;
      wa[i * 3 + 1] = Math.sin(k * x - t * 4) * 0.7;
      wa[i * 3 + 2] = 0;
    }
    (wg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    // 动画改驱 r（发射半径在 r_s 附近内外摆动），z 由曲线函数同源给出 → 读数点必在曲线上
    const rNow = 1.6 + 3.4 * (Math.sin(t * 0.4) * 0.5 + 0.5);
    drawShift(rNow);
  };
}

/** P129 双生子佯谬 */
function build_twins(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title;
  // ==== 时空图坐标：横轴 x = 位置，纵轴 y = ct（45° 线即光，斜率 dx/d(ct) = β = v/c）====
  const HOME_X = -3.4;                         // 留守者世界线 x = const（青竖线）
  const Y0 = -3.4, Y1 = 3.4;                   // ct 起止：重逢事件落在顶部（时间不倒流）
  const BETA = 0.8;                            // 旅行者每腿速率：两腿斜率 ±β（< 1 保证在光锥内）
  const TAU_RATIO = Math.sqrt(1 - BETA * BETA); // √(1−β²) = 0.60 → 旅行钟只走六成
  const TURN_X = HOME_X + BETA * (0 - Y0);     // 折返顶点 x = −0.68（严格在 45° 光之内）
  const T_HOME = 10;                           // 重逢时留守者的钟读数（年）
  /** 旅行者在时刻 y = ct 的位置：去程/返程对称，但 ct 单调上升，绝无时间倒流 */
  const travelerX = (y: number): number =>
    (y <= 0 ? HOME_X + BETA * (y - Y0) : HOME_X + BETA * (Y1 - y));
  // 两个孪生（一个留下、一个旅行），初始同在出发事件
  const home = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.5, 20, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, emissive: 0x0891b2, emissiveIntensity: 0.6 })),
  );
  home.position.set(HOME_X, Y0, 0);
  g.add(home);
  const traveler = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.5, 20, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.pink, emissive: 0xbe185d, emissiveIntensity: 0.6 })),
  );
  traveler.position.set(HOME_X, Y0, 0);
  g.add(traveler);
  // 世界线：一条竖直（静止），一条三角形折线（往返，ct 单调）
  const wl1 = lineFrom(THREE, bag, [
    new THREE.Vector3(HOME_X, Y0, 0), new THREE.Vector3(HOME_X, Y1, 0),
  ], PAL.cyan);
  g.add(wl1);
  // 45° 光线参考（红虚）：出发事件发出的光，旅行者两腿必须落在它内侧
  g.add(lineFrom(THREE, bag, [
    new THREE.Vector3(HOME_X, Y0, 0), new THREE.Vector3(HOME_X + (Y1 - Y0), Y1, 0),
  ], PAL.red, true));
  const travelGeo = bag.geo(new THREE.BufferGeometry());
  travelGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(81 * 3), 3));
  const wl2 = new THREE.Line(travelGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.pink })));
  g.add(wl2);
  const wa = (travelGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  // 折返顶点记号（金环）：此处旅行者加速换系，离开原惯性系
  const turnMark = new THREE.Mesh(
    bag.geo(new THREE.TorusGeometry(0.36, 0.07, 8, 28)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold })),
  );
  turnMark.position.set(TURN_X, 0, 0);
  g.add(turnMark);
  // 重逢事件记号（绿球）：两钟再次并置比较读数
  const meetMark = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.24, 16, 12)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.green })),
  );
  meetMark.position.set(HOME_X, Y1, 0);
  g.add(meetMark);
  const plot = makePlot(bag, THREE, 340, 300, 3.8, 6.8, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '双生子佯谬：旅行者固有时 τ = ∫√(1−v²/c²) dt 更短', color: '#f8fafc' },
    { text: '同一对外端事件之间，直线（留守）世界线固有时最长 → 折返三角形更短、回家更年轻', color: '#94a3b8' },
    { text: '读数：青竖线 = 留守者（x=const），粉三角 = 旅行者（ct 单调），金环 = 折返加速换系', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  g.add(panelSprite(THREE, bag, [
    { text: '折返顶点：加速换系（非惯性段）', color: '#fbbf24' },
    { text: '绿点：重逢，旅行钟 6.0 年 < 留守钟 10.0 年', color: '#22c55e' },
  ], [1.2, 1.6, 0], 4.6));
  const drawAges = (frac: number) => {
    const c = plot.frame('固有时 τ 对比', '角色', 'τ (年)');
    const H = 300;
    const yBase = H - 40;
    // 左半：时空图缩略（两腿斜率 = β，全程时间单调上升）
    const gx0 = 46, gx1 = 158, gy0 = 72;
    const spanX = 4.2;                        // 缩略横轴覆盖 HOME_X → HOME_X + 4.2
    const mapX = (x: number) => gx0 + ((x - HOME_X) / spanX) * (gx1 - gx0);
    const mapY = (y: number) => yBase - ((y - Y0) / (Y1 - Y0)) * (yBase - gy0);
    // 45° 光（速度上限参考，红色虚线）：两腿必须落在它内侧
    c.strokeStyle = '#ef4444'; c.lineWidth = 2; c.setLineDash([4, 4]);
    c.beginPath(); c.moveTo(mapX(HOME_X), mapY(Y0));
    c.lineTo(mapX(HOME_X + spanX), mapY(Y0 + spanX)); c.stroke();
    c.setLineDash([]);
    c.strokeStyle = '#06b6d4'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(mapX(HOME_X), mapY(Y0)); c.lineTo(mapX(HOME_X), mapY(Y1)); c.stroke();
    c.strokeStyle = '#f472b6'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(mapX(HOME_X), mapY(Y0)); c.lineTo(mapX(TURN_X), mapY(0));
    c.lineTo(mapX(HOME_X), mapY(Y1)); c.stroke();
    // 当前 ct 切片上的两个钟（同高 → 同一坐标时刻）
    const curY = Y0 + frac * (Y1 - Y0);
    c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(mapX(travelerX(curY)), mapY(curY), 5, 0, 7); c.fill();
    c.fillStyle = '#22c55e'; c.beginPath(); c.arc(mapX(HOME_X), mapY(curY), 4, 0, 7); c.fill();
    // 右半：钟读数柱，按 τ = ∫√(1−β²) dt 积分（匀速段即同比缩放）
    const homeTau = T_HOME * frac;
    const travelTau = homeTau * TAU_RATIO;
    c.fillStyle = '#06b6d4'; c.fillRect(196, yBase - homeTau * 18, 52, homeTau * 18);
    c.fillStyle = '#f472b6'; c.fillRect(264, yBase - travelTau * 18, 52, travelTau * 18);
    c.fillStyle = '#f8fafc'; c.textAlign = 'center'; c.font = '16px sans-serif';
    c.fillText('留守 τ', 222, H - 22);
    c.fillText('旅行 τ', 290, H - 22);
    c.textAlign = 'left';
    c.fillStyle = '#06b6d4'; c.fillText(`${homeTau.toFixed(1)} 年`, 186, yBase - homeTau * 18 - 8);
    c.fillStyle = '#f472b6'; c.fillText(`${travelTau.toFixed(1)} 年`, 254, yBase - travelTau * 18 - 8);
    c.fillStyle = '#fbbf24'; c.font = 'bold 16px sans-serif';
    c.fillText(`两腿 β = ${BETA.toFixed(2)} → τ旅/τ留 = √(1−β²) = ${TAU_RATIO.toFixed(2)}`, 50, 58);
    plot.tex.needsUpdate = true;
  };
  drawAges(0);
  return (t: number, dt: number) => {
    // 沿坐标时间 ct 匀速推进（u: 0 → 1 一整趟往返）→ 时间单调，重逢点回到顶部
    const u = (t * 0.22) % 1;
    const y = Y0 + u * (Y1 - Y0);
    traveler.position.set(travelerX(y), y, 0);
    home.position.set(HOME_X, y, 0);
    turnMark.rotation.z = t * 1.8;   // 金环自转，标记非惯性的折返点
    // 三角形折返世界线：按 ct 单调采样 81 点，两腿斜率恒为 ±β
    for (let i = 0; i <= 80; i++) {
      const yy = Y0 + (i / 80) * (Y1 - Y0);
      wa[i * 3] = travelerX(yy);
      wa[i * 3 + 1] = yy;
      wa[i * 3 + 2] = 0;
    }
    (travelGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    drawAges(u);
  };
}

/** P135 世界线与固有时 */
function build_worldline(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title;
  // 时空网格背景
  const grid = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(9, 9, 12, 12)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.slate, wireframe: true, transparent: true, opacity: 0.35 })),
  );
  grid.rotation.x = -Math.PI / 2;
  g.add(grid);
  // 三条世界线：静止（竖直）、匀速（斜直线）、加速（曲线）
  const wlStatic = lineFrom(THREE, bag, [
    new THREE.Vector3(-3, -4, 0), new THREE.Vector3(-3, 4, 0),
  ], PAL.cyan);
  const wlConst = lineFrom(THREE, bag, [
    new THREE.Vector3(0, -4, 0), new THREE.Vector3(3.6, 4, 0),
  ], PAL.gold);
  g.add(wlStatic); g.add(wlConst);
  const accGeo = bag.geo(new THREE.BufferGeometry());
  accGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(81 * 3), 3));
  const wlAcc = new THREE.Line(accGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.pink })));
  g.add(wlAcc);
  const aa = (accGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  // 运动粒子（沿曲线）
  const probe = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.3, 16, 12)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: 0xf59e0b, emissiveIntensity: 0.9 })),
  );
  g.add(probe);
  const plot = makePlot(bag, THREE, 340, 300, 3.8, 6.8, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '固有时：dτ = √(1 − v²/c²) dt（沿世界线积分）', color: '#f8fafc' },
    { text: '静止（竖直）、匀速（直线）、加速（曲线）世界线的固有时各不同', color: '#94a3b8' },
    { text: '读数：青 = 静止，金 = 匀速，粉 = 加速（曲率越大固有时越短）', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawTau = (v: number) => {
    const c = plot.frame('dτ/dt vs v', 'v/c', 'dτ/dt');
    const W = 340, H = 300;
    c.strokeStyle = '#22c55e'; c.lineWidth = 3; c.beginPath();
    for (let i = 1; i <= 80; i++) {
      const b = (i / 80) * 0.99;
      const ratio = Math.sqrt(1 - b * b);
      const px = 46 + b * (W - 62);
      const py = (H - 40) - ratio * (H - 70);
      if (i === 1) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    const ratio = Math.sqrt(1 - Math.min(0.999, v) ** 2);
    const px = 46 + v * (W - 62);
    const py = (H - 40) - ratio * (H - 70);
    c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(px, py, 7, 0, 7); c.fill();
    c.fillStyle = '#94a3b8'; c.fillText('dτ = dt·√(1−β²)', 56, 56);
    plot.tex.needsUpdate = true;
    void v;
  };
  drawTau(0.6);
  return (t: number, dt: number) => {
    for (let i = 0; i <= 80; i++) {
      const u = (i / 80) * 2 - 1;
      aa[i * 3] = 3.0 + Math.sin(u * 2.2) * 1.4;
      aa[i * 3 + 1] = u * 4;
      aa[i * 3 + 2] = 0;
    }
    (accGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    const u = Math.sin(t * 0.5);
    probe.position.set(3.0 + Math.sin(u * 2.2) * 1.4, u * 4, 0);
    // β 与画布曲线同源：x=3+1.4sin(2.2u)、ct=4u → dx/d(ct)=1.4·2.2/4·cos(2.2u)=0.77cos(2.2u)
    const v = Math.abs(Math.cos(u * 2.2)) * ((1.4 * 2.2) / 4);
    drawTau(v);
    g.rotation.y = 0.1 * Math.sin(t * 0.3);
  };
}
