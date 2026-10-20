import type { SceneContext, SceneInstance } from '../types';
import { scaffold, panelSprite, PAL, ResourceBag } from './_common';

/**
 * 轨道与引力族（orbit）：P294 食双星测质量 / P53 引力弹弓 / P232 双致密天体旋进 /
 * P17 开普勒轨道 / P55 完全失重与轨道运动 / P19 N 体模拟与星系并合 /
 * P435 引力势与逃逸速度 / P139 史瓦西轨道与进动 / P18 三体问题 /
 * P52 潮汐力 / P474 变轨与宇宙速度 / P281 凌星法搜寻系外行星。
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
    case 'eclipsebinary': return build_eclipsebinary(g, bag, THREE, title);
    case 'flyby': return build_flyby(g, bag, THREE, title);
    case 'inspiral': return build_inspiral(g, bag, THREE, title);
    case 'kepler': return build_kepler(g, bag, THREE, title);
    case 'lorbit': return build_lorbit(g, bag, THREE, title);
    case 'nbody': return build_nbody(g, bag, THREE, title);
    case 'potential-well': return build_potential_well(g, bag, THREE, title);
    case 'schwarzschild': return build_schwarzschild(g, bag, THREE, title);
    case 'threebody': return build_threebody(g, bag, THREE, title);
    case 'tidal': return build_tidal(g, bag, THREE, title);
    case 'transfer': return build_transfer(g, bag, THREE, title);
    case 'transit': return build_transit(g, bag, THREE, title);
    default: return build_eclipsebinary(g, bag, THREE, title);
  }
}

/** 画布助手：右侧可重绘坐标图 */
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
  function frame(title2: string, xl: string, yl: string): CanvasRenderingContext2D {
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(7,11,20,0.85)';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#334155'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, w - 3, h - 3);
    c.strokeStyle = '#475569'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(50, 22); c.lineTo(50, h - 42); c.lineTo(w - 16, h - 42); c.stroke();
    c.fillStyle = '#f8fafc'; c.font = 'bold 18px sans-serif'; c.textAlign = 'center';
    c.fillText(title2, w / 2, 24);
    c.fillStyle = '#94a3b8'; c.font = '15px sans-serif';
    c.fillText(xl, w / 2, h - 12);
    c.save(); c.translate(18, (h - 30) / 2); c.rotate(-Math.PI / 2);
    c.fillText(yl, 0, 0); c.restore();
    c.textAlign = 'left';
    return c;
  }
  return { mesh: m, c, frame, tex };
}

/** P294 食双星测质量：双星互绕 + 光变曲线（主食/次食深度不同）+ 视向速度曲线联立 */
function build_eclipsebinary(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 轨道要素：质量不同 → 各自绕质心的轨道半径与视速度振幅 K 不同
  const m1 = 1.6, m2 = 0.9, M = m1 + m2;
  const a = 3.4;
  const a1 = a * (m2 / M);        // 主星（星1）绕质心轨道半径
  const a2 = a * (m1 / M);        // 次星（星2）绕质心轨道半径
  const ySq = 0.35;               // 轨道在 y 方向的投影压缩（透视示意）
  const zAmp = 2.0;               // 轨道 z 方向总振幅（按 aᵢ 分配 → 质心恒在原点）
  // 星体半径与面亮度：损失光度 = 遮挡面积 × 背星面亮度 → 几何因子区分主/次食深度
  const R1 = 1.25, R2 = 0.85;
  const B1 = 1.0, B2 = 0.55;
  const F_TOT = Math.PI * (R1 * R1 * B1 + R2 * R2 * B2);
  // 双星（质量不同 → 半径与颜色不同）
  const starA = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(R1, 30, 22)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xf59e0b, emissiveIntensity: 0.9 })),
  );
  const starB = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(R2, 26, 18)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x93c5fd, emissive: 0x3b82f6, emissiveIntensity: 0.7 })),
  );
  g.add(starA); g.add(starB);
  // 质心标记
  const cm = new THREE.Mesh(
    bag.geo(new THREE.OctahedronGeometry(0.16, 0)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.green })),
  );
  g.add(cm);
  // 双星各自的轨道椭圆：按真实运动参数绘制（含 ±z 摆动 → 恒星始终落在轨道线上）
  const orbitOf = (ai: number, sgn: number, col: number): void => {
    const pts: import('three').Vector3[] = [];
    for (let i = 0; i <= 160; i++) {
      const ph = (i / 160) * Math.PI * 2;
      pts.push(new THREE.Vector3(
        Math.cos(ph) * ai * sgn,
        Math.sin(ph) * ySq * ai * sgn,
        Math.sin(ph) * ((zAmp * ai) / a) * sgn,
      ));
    }
    g.add(new THREE.Line(
      bag.geo(new THREE.BufferGeometry().setFromPoints(pts)),
      bag.mat(new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.55 })),
    ));
  };
  orbitOf(a1, 1, 0xf59e0b);
  orbitOf(a2, -1, 0x3b82f6);

  // ---- 食几何（光变与动画共用）：投影圆盘重叠面积 × 背星面亮度 = 系统损失光度
  const lensArea = (r1: number, r2: number, d: number): number => {
    if (d >= r1 + r2) return 0;
    if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2;
    const t1 = Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1));
    const t2 = Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
    return r1 * r1 * (t1 - Math.sin(t1) * Math.cos(t1)) + r2 * r2 * (t2 - Math.sin(t2) * Math.cos(t2));
  };
  /** 相位 φ 处的食几何：观察者在 +z → z 大者在前；背星被遮 → 系统变暗 */
  const eclipseGeom = (phi: number): { loss: number; covered: number; backIsA: boolean } => {
    const sx = Math.cos(phi), sy = Math.sin(phi);
    const d = Math.hypot(sx * (a1 + a2), sy * ySq * (a1 + a2));
    const backIsA = sy <= 0;                 // 星1 的 z = +sinφ·…：sinφ>0 时星1 在前 → 星2 被挡
    const rFront = backIsA ? R2 : R1;
    const rBack = backIsA ? R1 : R2;
    const area = lensArea(rFront, rBack, d);
    const bBack = backIsA ? B1 : B2;
    return {
      loss: (area * bBack) / F_TOT,
      covered: Math.min(1, area / (Math.PI * rBack * rBack)),
      backIsA,
    };
  };
  const D_SEC = eclipseGeom(Math.PI / 2).loss;     // 次食（星1 在前挡星2）→ 浅谷
  const D_PRI = eclipseGeom(Math.PI * 1.5).loss;   // 主食（星2 在前挡星1）→ 深谷

  // 光变曲线（观察者在 +z 方向 → 食发生在 φ = π/2、3π/2，即图上相位 0.5、1.5）
  const plot = makeCanvas(bag, THREE, 420, 260, 5.0, 6.4, -3.4);
  g.add(plot.mesh);
  function drawLC(phase: number): void {
    const c = plot.frame('光变曲线 L(t)', '轨道相位 φ', '相对流量');
    const W = 420, H = 260;
    const y0 = H - 44;
    const yTop = 30;
    const yBase = yTop + (y0 - yTop) * 0.15;
    const dip = (ph: number, center: number, w2: number, depth: number) => {
      const d = Math.abs(((ph - center + 0.5) % 1) - 0.5);
      return d < w2 ? depth * (1 - (d / w2) ** 2) : 0;
    };
    c.strokeStyle = '#f59e0b'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 300; i++) {
      const ph = (i / 300) * 2;
      // 两谷等时宽（同一对星体、同一相对速度），深度由几何因子（面亮度）区分
      const d = dip(ph, 0.5, 0.12, D_SEC) + dip(ph, 1.5, 0.12, D_PRI);
      const px = 50 + (i / 300) * (W - 70);
      const py = yBase + (d / D_PRI) * (y0 - yBase) * 0.92;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    // 当前相位指针
    const cx2 = 50 + ((phase % 2) / 2) * (W - 70);
    c.strokeStyle = '#22c55e'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(cx2, yTop); c.lineTo(cx2, y0); c.stroke();
    c.fillStyle = '#f8fafc'; c.font = '15px sans-serif';
    c.fillText('深谷 = 主食 · 浅谷 = 次食（几何因子不同）', 58, 44);
    c.fillStyle = '#94a3b8';
    c.fillText(`两谷深度比 = 面亮度比 B₂/B₁ = ${(D_SEC / D_PRI).toFixed(2)}`, 58, 66);
    c.fillStyle = '#22c55e';
    const now = eclipseGeom(phase * Math.PI);
    c.fillText(`相位 ${(((phase % 2) + 2) % 2).toFixed(2)}   F/F₀ = ${(1 - now.loss).toFixed(3)}`, 58, 88);
    plot.tex.needsUpdate = true;
  }
  drawLC(0);

  // 视向速度曲线：与光变共用同一相位轴 →「食变 + 视向速度」联立测质量
  const rv = makeCanvas(bag, THREE, 420, 260, 5.0, 6.4, -0.05);
  g.add(rv.mesh);
  function drawRV(phase: number): void {
    const c = rv.frame('视向速度 v_r(t)（与光变同相位轴）', '轨道相位 φ', '视向速度');
    const W = 420, H = 260;
    const yMid = (22 + (H - 42)) / 2;
    const halfH = (H - 42 - 22) / 2;
    const k2 = halfH * 0.55;                 // 次星速度振幅 K₂
    const k1 = k2 * (a1 / a2);               // 主星速度振幅 K₁（K₁/K₂ = a₁/a₂ = m₂/m₁ = q）
    const curve = (k: number, sgn: number): void => {
      c.beginPath();
      for (let i = 0; i <= 300; i++) {
        const ph = (i / 300) * 2;
        const px = 50 + (i / 300) * (W - 70);
        const py = yMid - sgn * k * Math.cos(ph * Math.PI);
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
    };
    // 食甚竖虚线（相位 0.5、1.5 = 光变两谷）：两星 v_r 在此恰过零
    c.strokeStyle = '#475569'; c.lineWidth = 2; c.setLineDash([6, 6]);
    for (const half of [0.5, 1.5]) {
      const px = 50 + (half / 2) * (W - 70);
      c.beginPath(); c.moveTo(px, 22); c.lineTo(px, H - 42); c.stroke();
    }
    c.setLineDash([]);
    c.lineWidth = 3;
    c.strokeStyle = '#f59e0b'; curve(k1, 1);    // 主星 v_r
    c.strokeStyle = '#3b82f6'; curve(k2, -1);   // 次星 v_r（反相 180°）
    // 相位指针（与光变曲线同一映射 → 两图逐帧时间对齐）
    const cx2 = 50 + ((phase % 2) / 2) * (W - 70);
    c.strokeStyle = '#22c55e'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(cx2, 22); c.lineTo(cx2, H - 42); c.stroke();
    c.fillStyle = '#fbbf24'; c.font = '15px sans-serif';
    c.fillText(`K₂/K₁ = a₂/a₁ = m₁/m₂ = ${(a2 / a1).toFixed(2)}`, 58, 44);
    c.fillStyle = '#94a3b8';
    c.fillText('食甚（虚线）处 v_r 过零 → 与光变联立', 58, 66);
    c.fillText('橙 = 星1、蓝 = 星2 的视向速度', 58, H - 58);
    rv.tex.needsUpdate = true;
  }
  drawRV(0);

  g.add(panelSprite(THREE, bag, [
    { text: '食双星：开普勒第三定律 a³/T² = G(M₁+M₂)/(4π²)', color: '#f8fafc' },
    { text: '光变深度给出半径比 R₂/R₁，视速度曲线给出速度振幅', color: '#94a3b8' },
    { text: 'M₁ = (1+q)²·K₂³·P/(2πG)，q = K₁/K₂ → 可测绝对质量', color: '#fbbf24' },
    { text: '视向速度与光变联立：食甚处 v_r 过零、冲点处 |v_r| 最大', color: '#22c55e' },
  ], [0, 4.6, 0], 8.2, 'center'));

  return (t: number, dt: number) => {
    const n = Math.sqrt(M / (a * a * a)) * 0.9;
    const ph = t * n;
    // 绕质心运动：与上面两条轨道线同一组参数 → 恒星始终落在轨道线上，质心恒在原点
    starA.position.set(Math.cos(ph) * a1, Math.sin(ph) * ySq * a1, Math.sin(ph) * ((zAmp * a1) / a));
    starB.position.set(-Math.cos(ph) * a2, -Math.sin(ph) * ySq * a2, -Math.sin(ph) * ((zAmp * a2) / a));
    cm.position.set(0, 0, 0);
    // 光度随食变化：只有被遮挡的背星变暗，深度由遮挡几何（面积 × 面亮度）给出
    const geom = eclipseGeom(ph);
    const dimA = geom.backIsA ? geom.covered : 0;
    const dimB = geom.backIsA ? 0 : geom.covered;
    (starA.material as import('three').MeshStandardMaterial).emissiveIntensity = 0.9 * (1 - dimA);
    (starB.material as import('three').MeshStandardMaterial).emissiveIntensity = 0.7 * (1 - dimB);
    const frame = Math.floor(t * 8);
    if (frame % 2 === 0) { drawLC(ph / Math.PI); drawRV(ph / Math.PI); }
    void dt;
  };
}

/** P53 引力弹弓：探测器掠过行星，速度矢量偏转（能量转移） */
function build_flyby(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 行星（沿其公转轨道环运动，切向速度即 v_p）
  const planet = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(1.6, 32, 24)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x15803d, emissiveIntensity: 0.35, roughness: 0.6 })),
  );
  planet.position.set(1.6, 0, 0);
  g.add(planet);
  // 行星公转轨道：水平面内的椭圆环，右端点恰为掠过点 (1.6, 0, 0)
  // → 行星始终在环上公转，Δv ≈ 2v_p·sin(θ/2) 中的 v_p 在画面上有了来源
  const ORB_CX = -1.8;   // 轨道中心 x（右端点 = ORB_CX + ORB_A = 1.6）
  const ORB_A = 3.4;     // x 方向半轴
  const ORB_B = 2.4;     // z 方向半轴（透视下近似正圆）
  const ORB_T = 80;      // 公转周期（s）
  const orbPts: import('three').Vector3[] = [];
  for (let i = 0; i <= 120; i++) {
    const ph = (i / 120) * Math.PI * 2;
    orbPts.push(new THREE.Vector3(ORB_CX + Math.cos(ph) * ORB_A, 0, Math.sin(ph) * ORB_B));
  }
  g.add(new THREE.Line(
    bag.geo(new THREE.BufferGeometry().setFromPoints(orbPts)),
    bag.mat(new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.7 })),
  ));
  // 行星速度矢量 v_p（沿轨道切向，起点外推到行星表面之外）
  const vpArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(1.6, 0, 1.45), 1.6, PAL.green, 0.2, 0.1,
  );
  g.add(vpArrow);
  // 探测器（轨迹为双曲线）
  const probe = new THREE.Mesh(
    bag.geo(new THREE.ConeGeometry(0.24, 0.7, 14)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: 0xb45309, emissiveIntensity: 0.6 })),
  );
  g.add(probe);
  // 轨迹
  const trailGeo = bag.geo(new THREE.BufferGeometry());
  trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(400 * 3), 3));
  const trail = new THREE.Line(trailGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.85 })));
  g.add(trail);
  // 掠过轨迹（引力弹弓）：s = 相对掠过点（行星当前 x）的横坐标；
  // 入射渐近水平 y = 2.9、出射渐近斜率 −0.5 → 偏转角 θ = atan(0.5) ≈ 26.6°；
  // 弯曲中心跟随行星 → 轨迹始终在行星处偏折（近点距行星中心 2.4 > 半径 1.6，不穿行）
  const PATH_BASE = 2.9;   // 入射基准高度（低于面板下缘）
  const PATH_K = 0.5;      // 出射渐近线斜率
  const PATH_W = 2.0;      // 弯曲过渡半宽
  const pathY = (s: number): number =>
    PATH_BASE - (PATH_K * (s + Math.sqrt(s * s + PATH_W * PATH_W))) / 2;
  const pathSlope = (s: number): number =>
    (-PATH_K * (1 + s / Math.sqrt(s * s + PATH_W * PATH_W))) / 2;
  // 等弧长参数化：预计算弧长表 → 掠过速度 |v| 沿路径恒定（行星系 |v| 不变有画面支撑）
  const S_MIN = -14, S_MAX = 16, ARC_N = 600;
  const arcS: number[] = [S_MIN];
  const arcL: number[] = [0];
  {
    let L = 0, ps = S_MIN, py = pathY(S_MIN);
    for (let i = 1; i <= ARC_N; i++) {
      const s = S_MIN + ((S_MAX - S_MIN) * i) / ARC_N;
      const y = pathY(s);
      L += Math.hypot(s - ps, y - py);
      arcS.push(s); arcL.push(L);
      ps = s; py = y;
    }
  }
  const ARC_LEN = arcL[ARC_N];
  const sAt = (len: number): number => {
    let lo = 0, hi = ARC_N;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (arcL[mid] <= len) lo = mid; else hi = mid; }
    const seg = arcL[hi] - arcL[lo] || 1;
    return arcS[lo] + ((arcS[hi] - arcS[lo]) * (len - arcL[lo])) / seg;
  };
  // 速度箭头（相对掠过点固定，随行星平移）：灰 = v_in、橙 = v_out（方向 = 该处真实切向）
  const IN_S = -6.5, OUT_S = 7.0, VLEN = 2.4;
  const dirIn = new THREE.Vector3(1, pathSlope(IN_S), 0).normalize();
  const dirOut = new THREE.Vector3(1, pathSlope(OUT_S), 0).normalize();
  // 行星系弹性散射 |v_in|=|v_out| → 两支箭头必须等长（VLEN），否则与读数行矛盾
  const vIn = new THREE.ArrowHelper(dirIn, new THREE.Vector3(), VLEN, PAL.slate, 0.22, 0.11);
  const vOut = new THREE.ArrowHelper(dirOut, new THREE.Vector3(), VLEN, PAL.amber, 0.22, 0.11);
  // 矢量三角形（都自 v_out 尾部出发）：灰虚影 = v_in、红 = Δv = v_out − v_in
  const ghostIn = new THREE.ArrowHelper(dirIn, new THREE.Vector3(), VLEN, 0x475569, 0.22, 0.11);
  const dvDir = dirOut.clone().multiplyScalar(VLEN).sub(dirIn.clone().multiplyScalar(VLEN));
  const dvLen = dvDir.length();   // = 2·VLEN·sin(θ/2) ≈ 0.46·VLEN（θ = 26.6°）
  dvDir.normalize();
  const dvArrow = new THREE.ArrowHelper(dvDir, new THREE.Vector3(), dvLen, PAL.red, 0.2, 0.1);
  g.add(vIn); g.add(vOut); g.add(ghostIn); g.add(dvArrow);

  g.add(panelSprite(THREE, bag, [
    { text: '引力弹弓：在行星参考系中弹性散射，|v| 不变但方向偏转', color: '#f8fafc' },
    { text: '日心系能量可增可减：Δv ≈ 2v_p·sin(θ/2)，绿箭头 = 行星速度 v_p（沿轨道环）', color: '#94a3b8' },
    { text: '灰 = v_in、橙 = v_out（同起点）、红 = Δv = v_out − v_in（θ ≈ 26.6°）', color: '#fbbf24' },
    { text: '读数：行星系 |v_out| − |v_in| = 0；日心系 ≈ 2v_p·sin(θ/2) ≈ 0.46·v_p', color: '#22c55e' },
  ], [0, 4.6, 0], 8.2, 'center'));

  const hist: number[] = [];
  let lastLoop = -1;
  return (t: number, dt: number) => {
    // 行星沿轨道环公转（t=0 恰在掠过点），v_p = 环上切向速度
    const ang = ((t % ORB_T) / ORB_T) * Math.PI * 2;
    planet.position.set(ORB_CX + Math.cos(ang) * ORB_A, 0, Math.sin(ang) * ORB_B);
    planet.rotation.y += dt * 0.5;
    const vpDir = new THREE.Vector3(-Math.sin(ang) * ORB_A, 0, Math.cos(ang) * ORB_B).normalize();
    vpArrow.position.copy(planet.position).addScaledVector(vpDir, 1.45);
    vpArrow.setDirection(vpDir);
    // 弯曲中心 = 行星当前 x → 探测器永远在行星处被偏折
    const bendX = planet.position.x;
    // 掠过路径：等弧长驱动（u ∈ [−0.3, 1.3] → 弧长 0→ARC_LEN，|v| 恒定）
    const RATE = 0.27;
    const u = ((t * RATE) % 1.6) - 0.3;
    const loop = Math.floor((t * RATE) / 1.6);
    if (loop !== lastLoop) { lastLoop = loop; hist.length = 0; }   // 每轮清空：不画首尾跳变连线
    const s = sAt(((u + 0.3) / 1.6) * ARC_LEN);
    const x = bendX + s;
    const y = pathY(s);
    probe.position.set(x, y, 0);
    // 朝向速度方向（沿轨迹切向）
    probe.rotation.z = Math.atan2(pathSlope(s), 1) - Math.PI / 2;
    hist.push(x, y);
    if (hist.length > 800) hist.splice(0, 2);
    const arr = (trailGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    for (let i = 0; i < 400; i++) {
      const k = i * 2;
      arr[i * 3] = hist[k] ?? x;
      arr[i * 3 + 1] = hist[k + 1] ?? y;
      arr[i * 3 + 2] = 0;
    }
    (trailGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    // 三支箭头贴合轨迹：入射/出射切向 + Δv 矢量差（随掠过点平移）
    vIn.position.set(bendX + IN_S, pathY(IN_S), 0);
    const outTail = new THREE.Vector3(bendX + OUT_S, pathY(OUT_S), 0);
    vOut.position.copy(outTail);
    ghostIn.position.copy(outTail);
    dvArrow.position.copy(outTail).addScaledVector(dirIn, VLEN);
    vOut.setLength(VLEN, 0.22, 0.11);
    vIn.setLength(VLEN, 0.22, 0.11);
    dvArrow.setLength(dvLen, 0.2, 0.1);
  };
}

/** P232 双致密天体旋进：螺旋收缩 + 引力波频率上升（啁啾） */
function build_inspiral(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const bhA = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.55, 24, 18)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x1e293b, emissiveIntensity: 1.2 })),
  );
  const bhB = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.4, 22, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x334155, emissiveIntensity: 1.2 })),
  );
  g.add(bhA); g.add(bhB);
  // 吸积盘/轨道螺旋
  const spiralGeo = bag.geo(new THREE.BufferGeometry());
  spiralGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(600 * 3), 3));
  const spiral = new THREE.Line(spiralGeo, bag.mat(new THREE.LineBasicMaterial({
    color: PAL.amber, transparent: true, opacity: 0.75,
  })));
  g.add(spiral);
  // 并合瞬间的抛射增亮（千新星教学示意）：质心系（原点）处的蓝金闪焰，膨胀+淡出
  const ejecta = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(1.0, 24, 18)),
    bag.mat(new THREE.MeshBasicMaterial({
      color: 0xa5b4fc, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    })),
  );
  g.add(ejecta);
  let flashT = 10;   // >4 表示未触发；并合时刻置 0 重新播放
  // 轨道收缩律（教学标度）：da/dt = −k/a³（∝a^{−3}，由 dE/dt∝a^{−5} 与 E∝−1/a 导出；
  // Peters 完整式含 μ、M 质量因子，此处并入演示常数 k，越近收缩越快）
  const K_DECAY = 4.6;   // 演示常数：并合周期 T=(a₀⁴−a_m⁴)/4k ≈ 20 s
  const A_MERGE = 1.6;   // 并合触发的间距（演示）
  let phase = 0;
  let a = 4.4;
  let lastF = -1;
  let lastDraw = -1;
  // 引力波波形（右侧画布）
  const plot = makeCanvas(bag, THREE, 440, 260, 5.4, 5.4, -3.6);
  g.add(plot.mesh);
  function drawGW(f: number, amp: number): void {
    const c = plot.frame('引力波应变 h(t)（啁啾）', '时间 t', 'h');
    const W = 440, H = 260;
    c.strokeStyle = '#06b6d4'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 380; i++) {
      const x = (i / 380) * 10;
      const env = Math.min(1, 0.12 + x * 0.13);
      const ph = x * x * 1.6;
      const y = Math.sin(ph) * env * 68;
      const px = 50 + (i / 380) * (W - 70);
      const py = H / 2 - y;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    c.strokeStyle = '#475569'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(50, H / 2); c.lineTo(W - 16, H / 2); c.stroke();
    c.fillStyle = '#f8fafc'; c.font = '15px sans-serif';
    c.fillText(`f = ${f.toFixed(2)} × f₀   h ∝ (G M ω/c²)^(2/3)`, 58, 44);
    c.fillStyle = '#94a3b8';
    c.fillText('频率与振幅同时上升 → 合并前啁啾', 58, 66);
    // 收缩律与并合剩余时间：与落码同一 K_DECAY/A_MERGE、同一 a → 读数与几何同源
    const dadt = K_DECAY / Math.pow(Math.max(A_MERGE, a), 3);
    const tCoal = (Math.pow(a, 4) - Math.pow(A_MERGE, 4)) / (4 * K_DECAY);
    c.fillStyle = '#22c55e';
    c.fillText(`a = ${a.toFixed(2)}   |da/dt| = k/a³ = ${dadt.toFixed(3)}/s`, 58, 88);
    c.fillText(`并合剩余 t ≈ (a₀⁴−a_m⁴)/4k = ${tCoal.toFixed(1)} s`, 58, 110);
    plot.tex.needsUpdate = true;
  }
  drawGW(1, 1);

  g.add(panelSprite(THREE, bag, [
    { text: '轨道能量以引力波形式辐射：dE/dt = −(32/5) G⁴(m₁m₂)²M/(c⁵a⁵)', color: '#f8fafc' },
    { text: 'a 减小 → ω 增大（f ∝ a^{−3/2}），并合前出现频率啁啾', color: '#94a3b8' },
    { text: '并合时间 t ≈ (5/256)·c⁵a₀⁴/(G³m₁m₂M)（数亿年 → 数秒）', color: '#fbbf24' },
    { text: '演示近似：da/dt=−k/a³（GR ∝a⁻³ 标度，质量因子并入 k）；并合蓝金闪焰=千新星抛射增亮示意', color: '#22c55e' },
  ], [0, 4.6, 0], 8.4, 'center'));

  return (_t: number, dt: number) => {
    a -= dt * (K_DECAY / Math.pow(Math.max(A_MERGE, a), 3));
    if (a < A_MERGE) { a = 4.4; phase = 0; flashT = 0; } // 并合 → 触发抛射增亮，循环演示
    const w = Math.pow(a, -1.5) * 4.2;
    phase += w * dt;
    const r = a;
    bhA.position.set(Math.cos(phase) * r * 0.4, Math.sin(phase) * r * 0.25, Math.sin(phase) * r * 0.4);
    bhB.position.set(-Math.cos(phase) * r * 0.6, -Math.sin(phase) * r * 0.375, -Math.sin(phase) * r * 0.6);
    bhA.rotation.y += dt * 4;
    bhB.rotation.y -= dt * 5;
    // 螺旋轨迹
    const arr = (spiralGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    for (let i = 0; i < 600; i++) {
      const k = phase - (599 - i) * 0.045;
      const rr = Math.max(1.4, r + (599 - i) * 0.006);
      arr[i * 3] = Math.cos(k) * rr * 0.6;
      arr[i * 3 + 1] = Math.sin(k) * rr * 0.4;
      arr[i * 3 + 2] = Math.sin(k) * rr * 0.5;
    }
    (spiralGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    // 并合抛射增亮（千新星示意）：闪焰膨胀 + 淡出，约 4 s 播放完毕
    flashT += dt;
    if (flashT < 4) {
      ejecta.visible = true;
      ejecta.scale.setScalar(0.35 + 1.2 * flashT);
      (ejecta.material as import('three').MeshBasicMaterial).opacity = 0.85 * (1 - flashT / 4) ** 2;
    } else {
      ejecta.visible = false;
    }
    // 画布读数限帧 ~5 Hz（并合后 w 桶变化极快，须与时间桶同刷）
    const rb = Math.floor(_t * 5);
    const fBucket = Math.round(w * 6);
    if (fBucket !== lastF || rb !== lastDraw) { lastF = fBucket; lastDraw = rb; drawGW(w, 1); }
  };
}

/** P17 开普勒轨道：椭圆 + 面积定律（等时间扫过等面积）+ 改变 e/a 与周期—半径对照 */
function build_kepler(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const A0 = 4.2;                       // 参考半长轴（T₀ = 2π√(A0³/GM) 的标度）
  let a = A0;                           // 半长轴：缓慢扫描 → 轨道与 T 读数同步更新
  let e = 0.45;                         // 偏心率：缓慢扫描 → 观察椭圆形状变化
  let b = a * Math.sqrt(1 - e * e);
  // 椭圆轨道（e/a 变化时逐帧重绘，中心在 −a·e）
  const ORB_N = 240;
  const orbGeo = bag.geo(new THREE.BufferGeometry());
  const orbAttr = new THREE.BufferAttribute(new Float32Array((ORB_N + 1) * 3), 3);
  orbGeo.setAttribute('position', orbAttr);
  const orbPos = orbAttr.array as Float32Array;
  g.add(new THREE.Line(orbGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan }))));
  function syncOrbit(): void {
    for (let i = 0; i <= ORB_N; i++) {
      const ph = (i / ORB_N) * Math.PI * 2;
      orbPos[i * 3] = Math.cos(ph) * a - a * e;
      orbPos[i * 3 + 1] = 0;
      orbPos[i * 3 + 2] = Math.sin(ph) * b;
    }
    orbAttr.needsUpdate = true;
  }
  syncOrbit();
  // 恒星位于焦点：椭圆中心在 −a·e、焦点在原点 → 近星距 a(1−e)、远星距 a(1+e)
  const star = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.7, 28, 20)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xf59e0b, emissiveIntensity: 1.1 })),
  );
  star.position.set(0, 0, 0);
  g.add(star);
  // 行星
  const planet = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.3, 20, 14)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.blue, roughness: 0.5 })),
  );
  g.add(planet);
  // 面积扫掠扇形：缓冲区 120 顶点 = 前一扇形(60) + 当前扇形(60) → 两个等时扇形同屏对照
  const sweepGeo = bag.geo(new THREE.BufferGeometry());
  const sweepAttr = new THREE.BufferAttribute(new Float32Array(120 * 3), 3);
  sweepGeo.setAttribute('position', sweepAttr);
  const sweepArr = sweepAttr.array as Float32Array;
  const sweep = new THREE.Mesh(
    sweepGeo,
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.amber, transparent: true, opacity: 0.3, side: THREE.DoubleSide })),
  );
  g.add(sweep);
  // 近日点/远日点标记（随 a、e 移动）
  const peri = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.14, 12, 10)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.green })),
  );
  g.add(peri);
  const apo = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.14, 12, 10)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.red })),
  );
  g.add(apo);

  // 读数画布：a、e 实时值 + 周期—半径曲线 T ∝ a^{3/2} + 两个等时扇形面积
  const read = makeCanvas(bag, THREE, 400, 250, 4.8, 6.2, -3.2);
  g.add(read.mesh);
  let area1 = 0, area2 = 0;
  function drawRead(): void {
    const c = read.frame('读数：改变 a/e → 周期与面积速度', '半长轴 a', 'T / T₀');
    const W = 400, H = 250;
    const x0 = 50, x1 = W - 16, yTop = 96, y1 = H - 42;
    const aMin = 3.6, aMax = 4.8;
    const tOf = (av: number): number => Math.pow(av / A0, 1.5);   // T/T₀ = (a/A0)^{3/2}
    const t0 = tOf(aMin), t1 = tOf(aMax);
    const pxOf = (av: number): number => x0 + ((av - aMin) / (aMax - aMin)) * (x1 - x0);
    const pyOf = (tv: number): number => y1 - ((tv - t0) / (t1 - t0)) * (y1 - yTop);
    c.strokeStyle = '#06b6d4'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 60; i++) {
      const av = aMin + ((aMax - aMin) * i) / 60;
      const px = pxOf(av), py = pyOf(tOf(av));
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    // 当前 (a, T) 读点
    const cx = pxOf(Math.min(aMax, Math.max(aMin, a)));
    const cy = pyOf(tOf(a));
    c.fillStyle = '#22c55e';
    c.beginPath(); c.arc(cx, cy, 6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f8fafc'; c.font = '15px sans-serif';
    c.fillText(`a = ${a.toFixed(2)}   e = ${e.toFixed(2)}   T/T₀ = ${tOf(a).toFixed(3)}`, 58, 44);
    c.fillStyle = '#94a3b8';
    c.fillText('绿点沿 T ∝ a^{3/2} 移动（开普勒第三定律）', 58, 66);
    c.fillStyle = '#fbbf24';
    c.fillText(`等时扇形面积 A₁ = ${area1.toFixed(2)}、A₂ = ${area2.toFixed(2)}`, 58, 88);
    read.tex.needsUpdate = true;
  }
  drawRead();

  g.add(panelSprite(THREE, bag, [
    { text: '开普勒第二定律：dA/dt = L/2m = 常量（等时间扫等面积）', color: '#f8fafc' },
    { text: '近星点（绿）速度快，远星点（红）速度慢：r²θ̇ = 常量', color: '#94a3b8' },
    { text: '改变 e 看椭圆、改变 a 看周期：T = 2π√(a³/GM) ∝ a^{3/2}（绿点读数）', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.2, 'center'));

  const sun = star.position;
  let ang = 0;
  let lastSweep = 0;
  let lastRead = -1;
  let curE0 = 0, curE1 = 0, prvE0 = 0, prvE1 = 0;
  // 扇形条带（顶点中心/弧交替），并按 A = ½ab[ΔE − e·Δ(sinE)] 计算绕焦点的真实面积
  const writeSector = (base: number, e0: number, e1: number): void => {
    const steps = 60;
    for (let i = 0; i < steps; i++) {
      const ph = e0 + (e1 - e0) * (i / (steps - 1));
      const xx = Math.cos(ph) * a - a * e;
      const zz = Math.sin(ph) * b;
      const onArc = i % 2;
      sweepArr[(base + i) * 3] = sun.x + (xx - sun.x) * onArc;
      sweepArr[(base + i) * 3 + 1] = 0;
      sweepArr[(base + i) * 3 + 2] = sun.z + (zz - sun.z) * onArc;
    }
  };
  const sectorArea = (e0: number, e1: number): number =>
    0.5 * a * b * ((e1 - e0) - e * (Math.sin(e1) - Math.sin(e0)));

  return (t: number, dt: number) => {
    // 缓扫偏心率与半长轴 → 同步重绘轨道、近日/远日点与 T 读数
    e = 0.40 + 0.20 * Math.sin(t * 0.16);
    a = A0 + 0.60 * Math.sin(t * 0.11 + 1);
    b = a * Math.sqrt(1 - e * e);
    syncOrbit();
    peri.position.set(a * (1 - e), 0, 0);
    apo.position.set(-a * (1 + e), 0, 0);
    // 开普勒运动：dE/dt = C/(1 − e·cosE)（开普勒方程）→ 面积速度 dA/dt = ½ab·dE/dt·(1−e·cosE) 恒定
    const adot = 0.62 / (1 - e * Math.cos(ang));
    ang += adot * dt;
    planet.position.set(Math.cos(ang) * a - a * e, 0, Math.sin(ang) * b);
    // 每 ~0.6 秒推进一格：保留最近两个等时扇形 → 同屏比较“等时间扫过等面积”
    if (Math.abs(t - lastSweep) > 0.6) {
      lastSweep = t;
      prvE0 = curE0; prvE1 = curE1;
      curE0 = curE1; curE1 = ang;
      writeSector(0, prvE0, prvE1);
      writeSector(60, curE0, curE1);
      sweepAttr.needsUpdate = true;
      area1 = sectorArea(prvE0, prvE1);
      area2 = sectorArea(curE0, curE1);
    }
    const rb = Math.floor(t * 8);
    if (rb !== lastRead) { lastRead = rb; drawRead(); }
    star.rotation.y += dt * 0.4;
  };
}

/** P55 完全失重与轨道运动：舱内自由漂浮 + 轨道上质点做自由落体 */
function build_lorbit(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 地球
  const earth = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(3.0, 40, 28)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.7 })),
  );
  earth.position.y = -2.4;
  g.add(earth);
  // 轨道圆（半径随时间缓变 → 逐帧重画，与读数共用同一 rU；球体为示意压缩）
  const orbGeo = bag.geo(new THREE.BufferGeometry());
  const orbAttr = new THREE.BufferAttribute(new Float32Array(161 * 3), 3);
  orbGeo.setAttribute('position', orbAttr);
  const orbit = new THREE.Line(
    orbGeo,
    bag.mat(new THREE.LineBasicMaterial({ color: PAL.slate, transparent: true, opacity: 0.7 })),
  );
  g.add(orbit);
  function syncOrbit(rU: number): void {
    const oa = orbAttr.array as Float32Array;
    for (let i = 0; i <= 160; i++) {
      const ph2 = (i / 160) * Math.PI * 2;
      oa[i * 3] = Math.cos(ph2) * rU;
      oa[i * 3 + 1] = -2.4 + Math.sin(ph2) * rU * (1.4 / 6.4);
      oa[i * 3 + 2] = Math.sin(ph2) * rU * 0.55;
    }
    orbAttr.needsUpdate = true;
  }
  // 航天器（舱内自由漂浮的物体）
  const craft = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(1.6, 1.0, 1.0)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.slate, metalness: 0.5, roughness: 0.4 })),
  );
  g.add(craft);
  // 舱内自由漂浮的小球（相对舱静止/匀速 → 完全失重）
  const floats: import('three').Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(
      bag.geo(new THREE.SphereGeometry(0.14, 12, 10)),
      bag.mat(new THREE.MeshStandardMaterial({ color: [PAL.gold, PAL.cyan, PAL.pink, PAL.green, PAL.violet][i], roughness: 0.4 })),
    );
    g.add(m);
    floats.push(m);
  }
  // 重力箭头（始终指向地心）
  const grav = new THREE.ArrowHelper(
    new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 3.4, 0), 2.4, PAL.slate, 0.2, 0.1,
  );
  g.add(grav);

  g.add(panelSprite(THREE, bag, [
    { text: '轨道运动 = 持续自由落体：GMm/r² = mv²/r → v = √(GM/r)', color: '#f8fafc' },
    { text: '舱内物体与飞船具有相同 a = GM/r²，故相对静止（完全失重）', color: '#94a3b8' },
    { text: '读数：右图 v、a_n=g(r)、T 由当前轨道半径现算（400 km 高度 → 8.7 m/s²，仍非零）', color: '#fbbf24' },
    { text: '动画角速度 ω_vis = √(GM/r³)×慢放系数（同源于读数行）；球体半径为示意压缩', color: '#22c55e' },
  ], [0, 4.6, 0], 8.4, 'center'));

  // 真实地球标度（读数用）：画面单位 rU ↔ 地心距 rU·K_UNIT km，基准 6.4 单位 ↔ 400 km 高度
  const GM_KM = 398600.435;                    // km³/s²
  const R_KM = 6371;                           // 地球半径 km
  const K_UNIT = (R_KM + 400) / 6.4;           // km/画面单位（与基准轨道几何同源）
  const wReal = (rKm: number): number => Math.sqrt(GM_KM / (rKm * rKm * rKm)); // rad/s（开普勒圆轨道）
  const S_SLOW = 0.5 / wReal(R_KM + 400);      // 慢放系数：基准处动画 ω=0.5 → 约 441×
  const read = makeCanvas(bag, THREE, 400, 250, 4.8, 6.2, -3.4);
  g.add(read.mesh);
  // 首帧种子值（避免第 0 帧读数显示 0）：与 t=0 时闭包内同一组公式
  let rUnits = 6.7;
  let altKm = rUnits * K_UNIT;
  let vKms = wReal(altKm) * altKm;
  let gNow = GM_KM * 1e9 / (altKm * altKm * 1e6);
  let tMin = (2 * Math.PI / wReal(altKm)) / 60;
  function drawRead(): void {
    const c = read.frame('读数：v、a_n 随半径刷新（同源）', '轨道高度 h', 'g = GM/r²');
    c.fillStyle = '#f8fafc'; c.font = '15px sans-serif';
    c.fillText(`r = ${rUnits.toFixed(2)} 单位 ↔ ${altKm.toFixed(0)} km（高度 ${(altKm - R_KM).toFixed(0)} km）`, 58, 44);
    c.fillStyle = '#22c55e';
    c.fillText(`v = √(GM/r) = ${vKms.toFixed(2)} km/s`, 58, 66);
    c.fillText(`a_n = GM/r² = g = ${gNow.toFixed(2)} m/s²（≠0！）`, 58, 88);
    c.fillStyle = '#fbbf24';
    c.fillText(`T = 2π√(r³/GM) = ${tMin.toFixed(1)} min，动画慢放 ≈ ${S_SLOW.toFixed(0)}×`, 58, 110);
    read.tex.needsUpdate = true;
  }
  drawRead();

  let ph = 0;
  let lastRead = -1;
  const drift = floats.map((_, i) => ({
    x: (Math.random() - 0.5) * 0.6,
    y: (Math.random() - 0.5) * 0.5,
    z: (Math.random() - 0.5) * 0.4,
    vx: (Math.random() - 0.5) * 0.08,
    vy: (Math.random() - 0.5) * 0.08,
    vz: (Math.random() - 0.5) * 0.06,
    ph: i,
  }));
  return (t: number, dt: number) => {
    // 轨道半径缓变 → 线、舱位置、读数全部共用同一 rUnits（同源）
    rUnits = 6.7 + 0.5 * Math.sin(t * 0.13);
    const rKm = rUnits * K_UNIT;
    const wR = wReal(rKm);
    altKm = rKm;
    vKms = wR * rKm;                                  // km/s
    gNow = GM_KM * 1e9 / (rKm * rKm * 1e6);          // m/s²
    tMin = (2 * Math.PI / wR) / 60;                   // min
    syncOrbit(rUnits);
    // 动画角速度 = 真实 ω 按同一慢放系数缩放（r 低 → 转得快，开普勒标度可见）
    ph += S_SLOW * wR * dt;
    const cx = Math.cos(ph) * rUnits;
    const cy = -2.4 + Math.sin(ph) * rUnits * (1.4 / 6.4);
    const cz = Math.sin(ph) * rUnits * 0.55;
    craft.position.set(cx, cy, cz);
    craft.rotation.z = ph;
    // 重力箭头指向地心
    const dir = new THREE.Vector3(0, -2.4, 0).sub(craft.position).normalize();
    grav.setDirection(dir);
    grav.position.copy(craft.position).addScaledVector(dir, -1.4);
    grav.setLength(2.0, 0.2, 0.1);
    // 舱内漂浮物：相对舱做微小匀速漂移，碰到舱壁反弹（模拟无重力）
    floats.forEach((m, i) => {
      const d = drift[i];
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      if (Math.abs(d.x) > 0.6) d.vx *= -1;
      if (Math.abs(d.y) > 0.4) d.vy *= -1;
      if (Math.abs(d.z) > 0.35) d.vz *= -1;
      m.position.set(cx + d.x, cy + d.y, cz + d.z);
      m.rotation.x += dt * (1 + d.ph);
    });
    earth.rotation.y += dt * 0.15;
    orbit.rotation.y = Math.sin(t * 0.02) * 0.05;
    // 读数 ~5 Hz 刷新
    const rb = Math.floor(t * 5);
    if (rb !== lastRead) { lastRead = rb; drawRead(); }
  };
}

/** P19 N 体模拟与星系并合：两个星系盘在自引力下并合（O(N²) 真实积分 + 引力软化） */
function build_nbody(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // ---- N 体系统：2 个大质量核（核球）+ 两盘恒星，Plummer 软化的 O(N²) 直接求和
  const NS = 55;              // 每个星系盘的恒星数
  const NP = NS * 2;          // 恒星总数
  const N = NP + 2;           // 总体数（≤ 120 → 每步 ~6×10³ 对，保帧率）
  const G = 1.0;
  const EPS2 = 0.64;          // 软化 ε = 0.8
  const MC = 16;              // 星系核（核球）质量
  const MS = 0.12;            // 单颗恒星质量
  const SEP0 = 10;            // 初始双核间距
  const VAPP = 0.5;           // 初始相向速度
  const VIMP = 0.3;           // 初始横向速度（有限碰撞参数 → 并合带角动量）
  const TIME = 0.6;           // 演化慢放（便于观察）
  const HSTEP = 0.02;         // 积分步长（代码时间）
  const RC_MERGE = 1.2;       // 双核并合判据半径

  const px = new Float64Array(N), py = new Float64Array(N), pz = new Float64Array(N);
  const vx = new Float64Array(N), vy = new Float64Array(N), vz = new Float64Array(N);
  const ax = new Float64Array(N), ay = new Float64Array(N), az = new Float64Array(N);
  const mass = new Float64Array(N);
  // 恒星初始极坐标（重置时复现同一批盘）
  const sr = new Float64Array(NP), sa = new Float64Array(NP);
  for (let i = 0; i < NP; i++) {
    const gal = i < NS ? 0 : 1;
    const r = 0.3 + Math.pow(Math.random(), 0.7) * 2.4;
    const arm = gal === 0 ? 0 : Math.PI;
    sr[i] = r;
    sa[i] = arm + r * 1.6 + Math.random() * 0.9;
  }
  // 恒星点云（颜色区分两个星系）
  const pos = bag.geo(new THREE.BufferGeometry());
  pos.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  const colors = bag.geo(new THREE.BufferGeometry());
  colors.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  const col = colors.getAttribute('color') as import('three').BufferAttribute;
  const carr = col.array as Float32Array;
  const stars = new THREE.Points(pos, bag.mat(new THREE.PointsMaterial({
    size: 0.18, vertexColors: true, sizeAttenuation: true,
  })));
  g.add(stars);
  for (let i = 0; i < NP; i++) {
    const gal = i < NS ? 0 : 1;
    carr[i * 3] = gal === 0 ? 1.0 : 0.45;
    carr[i * 3 + 1] = gal === 0 ? 0.75 : 0.75;
    carr[i * 3 + 2] = gal === 0 ? 0.35 : 1.0;
  }
  col.needsUpdate = true;
  // 星系核（核球，质量占主导；并合后隐藏伴核）
  const cores: import('three').Mesh[] = [];
  for (let k = 0; k < 2; k++) {
    const c2 = new THREE.Mesh(
      bag.geo(new THREE.SphereGeometry(0.42, 22, 16)),
      bag.mat(new THREE.MeshStandardMaterial({ color: 0xfff7ed, emissive: 0xfde68a, emissiveIntensity: 0.8 })),
    );
    c2.position.set(k === 0 ? -SEP0 / 2 : SEP0 / 2, 0, 0);
    g.add(c2);
    cores.push(c2);
  }

  let merged = 0;
  let mergeAt = 0;
  let sysT = 0;
  function setup(): void {
    for (let k = 0; k < 2; k++) {
      const cx0 = k === 0 ? -SEP0 / 2 : SEP0 / 2;
      const bvx = k === 0 ? VAPP : -VAPP;
      const bvz = k === 0 ? -VIMP : VIMP;
      for (let s = 0; s < NS; s++) {
        const i = k * NS + s;
        const r = sr[i], ang = sa[i];
        px[i] = cx0 + Math.cos(ang) * r;
        py[i] = Math.random() * 0.3 - 0.15;   // 薄盘小厚度
        pz[i] = Math.sin(ang) * r;
        // 含软化的点质量圆轨道速度（两盘同向旋转 → 迎面遭遇拉出长潮汐尾）
        const v = 1.05 * Math.sqrt(G * MC * r * r / Math.pow(r * r + EPS2, 1.5));
        vx[i] = bvx - Math.sin(ang) * v;
        vy[i] = 0;
        vz[i] = bvz + Math.cos(ang) * v;
        mass[i] = MS;
      }
      mass[NP + k] = MC;
      px[NP + k] = cx0; py[NP + k] = 0; pz[NP + k] = 0;
      vx[NP + k] = bvx; vy[NP + k] = 0; vz[NP + k] = bvz;
    }
    merged = 0;
    cores[1].scale.setScalar(1);
  }
  setup();

  // O(N²) 加速度：aᵢ = −GΣⱼ mⱼ(rᵢ−rⱼ)/(|rᵢ−rⱼ|²+ε²)^{3/2}
  function accel(): void {
    ax.fill(0); ay.fill(0); az.fill(0);
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = px[j] - px[i], dy = py[j] - py[i], dz = pz[j] - pz[i];
        const r2 = dx * dx + dy * dy + dz * dz + EPS2;   // Plummer 软化
        const inv = 1 / (r2 * Math.sqrt(r2));            // (r²+ε²)^(−3/2)
        const fj = G * inv * mass[j], fi = G * inv * mass[i];
        ax[i] += fj * dx; ay[i] += fj * dy; az[i] += fj * dz;
        ax[j] -= fi * dx; ay[j] -= fi * dy; az[j] -= fi * dz;
      }
    }
  }
  // 半隐式（辛）欧拉：先更新速度再更新位置，轨道长期稳定
  function step(h: number): void {
    accel();
    for (let i = 0; i < N; i++) {
      vx[i] += ax[i] * h; vy[i] += ay[i] * h; vz[i] += az[i] * h;
      px[i] += vx[i] * h; py[i] += vy[i] * h; pz[i] += vz[i] * h;
    }
  }

  g.add(panelSprite(THREE, bag, [
    { text: 'N 体：Fᵢ = −GΣⱼ mᵢmⱼ(rᵢ−rⱼ)/(|rᵢ−rⱼ|²+ε²)^{3/2}，O(N²) 直接求和', color: '#f8fafc' },
    { text: '自引力真积分（ε 软化）：差分引力把外盘拉成方向性潮汐尾', color: '#94a3b8' },
    { text: '读数：右图双核距离 r(t) ↓，动力学摩擦使并合时标 ≈ 10 s', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.4, 'center'));

  // 读数：双核距离 r(t)（虚线 = 并合判据 r_c）
  const plot = makeCanvas(bag, THREE, 420, 250, 5.2, 6.4, -3.5);
  g.add(plot.mesh);
  const sepHist: number[] = [];
  function drawSep(sep: number): void {
    const c = plot.frame('双核距离 r(t)', '时间 t', 'r');
    const W = 420, H = 250;
    const y0 = H - 44, yTop = 30;
    sepHist.push(sep);
    if (sepHist.length > 240) sepHist.shift();
    c.strokeStyle = '#fbbf24'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i < sepHist.length; i++) {
      const kx = 52 + (i / 239) * (W - 70);
      const ky = y0 - Math.min(1, sepHist[i] / SEP0) * (y0 - yTop);
      if (i === 0) c.moveTo(kx, ky); else c.lineTo(kx, ky);
    }
    c.stroke();
    c.strokeStyle = '#475569'; c.lineWidth = 2; c.setLineDash([6, 6]);
    const ym = y0 - (RC_MERGE / SEP0) * (y0 - yTop);
    c.beginPath(); c.moveTo(52, ym); c.lineTo(W - 18, ym); c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#94a3b8'; c.font = '15px sans-serif';
    c.fillText(`r = ${sep.toFixed(2)}（虚线 = 并合判据 r_c）`, 60, 56);
    c.fillText(`N = ${N}，O(N²) 每步 ${N * (N - 1) / 2} 对`, 60, 78);
    c.fillStyle = '#fbbf24';
    c.fillText(merged ? `已并合：t_merge = ${mergeAt.toFixed(1)}` : '双核相向运动中…', 60, 100);
    plot.tex.needsUpdate = true;
  }

  let acc = 0;
  let lastFrame = -1;
  return (_t: number, dt: number) => {
    const dtr = Math.min(dt, 0.05) * TIME;
    sysT += dtr; acc += dtr;
    let guard = 0;
    while (acc >= HSTEP && guard++ < 10) { step(HSTEP); acc -= HSTEP; }
    const ci0 = NP, ci1 = NP + 1;
    let sep = Math.hypot(px[ci1] - px[ci0], py[ci1] - py[ci0], pz[ci1] - pz[ci0]);
    if (!merged && sep < RC_MERGE) {
      // 双核足够接近 → 并合成单一并合核（质心系，质量相加）
      const mt = mass[ci0] + mass[ci1];
      px[ci0] = (px[ci0] * mass[ci0] + px[ci1] * mass[ci1]) / mt;
      py[ci0] = (py[ci0] * mass[ci0] + py[ci1] * mass[ci1]) / mt;
      pz[ci0] = (pz[ci0] * mass[ci0] + pz[ci1] * mass[ci1]) / mt;
      vx[ci0] = (vx[ci0] * mass[ci0] + vx[ci1] * mass[ci1]) / mt;
      vy[ci0] = (vy[ci0] * mass[ci0] + vy[ci1] * mass[ci1]) / mt;
      vz[ci0] = (vz[ci0] * mass[ci0] + vz[ci1] * mass[ci1]) / mt;
      mass[ci0] = mt; mass[ci1] = 0;   // 伴核降为无质量示踪粒子并隐藏
      merged = 1; mergeAt = sysT;
      sep = 0;
    } else if (merged && sysT - mergeAt > 10) {
      setup();   // 并合核松弛一段时间后重置，循环演示
      sep = SEP0;
      sepHist.length = 0;
    }
    // 渲染：恒星与双核位置全部来自真实积分
    const arr = (pos.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    for (let i = 0; i < NP; i++) {
      arr[i * 3] = px[i]; arr[i * 3 + 1] = py[i]; arr[i * 3 + 2] = pz[i];
    }
    (pos.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    cores[0].position.set(px[ci0], py[ci0], pz[ci0]);
    cores[1].position.set(px[ci1], py[ci1], pz[ci1]);
    cores[1].scale.setScalar(merged ? 0 : 1);
    cores[0].rotation.y += dt * 0.5;
    cores[1].rotation.y -= dt * 0.5;
    const fr = Math.floor(sysT * 8);
    if (fr !== lastFrame) { lastFrame = fr; drawSep(sep); }
  };
}

/** P435 引力势与逃逸速度：势阱网格 + 逃逸粒子 */
function build_potential_well(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 势阱网格（球面向中心凹陷）
  const wellGeo = bag.geo(new THREE.PlaneGeometry(14, 14, 48, 48));
  const well = new THREE.Mesh(
    wellGeo,
    bag.mat(new THREE.MeshBasicMaterial({ color: 0x475569, wireframe: true, transparent: true, opacity: 0.55 })),
  );
  well.rotation.x = -Math.PI / 2;
  well.position.y = -1.5;
  g.add(well);
  // 中心质量
  const core = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.6, 26, 18)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xf59e0b, emissiveIntensity: 1.0 })),
  );
  core.position.y = -1.5;
  g.add(core);
  // 逃逸轨迹（E>0：以略高于 v_esc 的速率径向出发 → 减速趋近渐近速度）
  const escGeo = bag.geo(new THREE.BufferGeometry());
  escGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(300 * 3), 3));
  const esc = new THREE.Line(escGeo, bag.mat(new THREE.LineBasicMaterial({
    color: PAL.green, transparent: true, opacity: 0.9,
  })));
  g.add(esc);
  // 束缚轨迹（E<0：低于 v_esc → 上行减速、回落回井底，与逃逸线同势同积分）
  const capGeo = bag.geo(new THREE.BufferGeometry());
  capGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(300 * 3), 3));
  const cap = new THREE.Line(capGeo, bag.mat(new THREE.LineBasicMaterial({
    color: PAL.cyan, transparent: true, opacity: 0.9,
  })));
  g.add(cap);

  g.add(panelSprite(THREE, bag, [
    { text: '引力势能 U(r) = −GMm/r，逃逸速度 v_esc = √(2GM/r)', color: '#f8fafc' },
    { text: 'E = ½mv² + U ≥ 0 → 减速逃逸趋近渐近速度；E < 0 → 上行后回落（束缚）', color: '#94a3b8' },
    { text: '读数：地球 v_esc = 11.2 km/s；E = 0 恰好逃逸（抛物线）', color: '#fbbf24' },
    { text: '两条轨迹由井面同一软核势 −GM/(s+r) 数值积分（教学近似，非硬编码示意线）', color: '#22c55e' },
  ], [0, 4.6, 0], 8.4, 'center'));

  // 网格顶点凹陷
  const wpos = wellGeo.getAttribute('position') as import('three').BufferAttribute;
  const warr = wpos.array as Float32Array;
  const orig = Float32Array.from(warr);
  // 与井面同势的一维径向能量积分：Φ(r) = −GM/(s+r)（与网格凹陷 z = −GM/(s+r) 同式，GM = depth·s）
  const SOFT_S = 3.4;          // 软核半径 s（与网格凹陷公式同参数）
  const R0 = 0.8;              // 出发半径（核面 r=0.6 之外）
  const GM0 = 2.6 * SOFT_S;    // 初帧深度（t=0 时 depth=2.6）→ 与井面几何同一 GM
  const phi = (gm: number, r: number): number => -gm / (SOFT_S + r);
  const dphi = (gm: number, r: number): number => gm / Math.pow(SOFT_S + r, 2); // |dΦ/dr|（指向 −r̂）
  // 绿线：E = +0.03·GM > 0 → 略高于 v_esc，减速逃逸；r>6 重新出发
  let escR = R0;
  let escV = Math.sqrt(2 * (0.03 * GM0 - phi(GM0, R0)));
  // 青线：E < 0 → 以 0.72·v_esc 沿 −x 侧向外上抛，减速至转折点再回落
  let capR = R0;
  let capV = 0.72 * Math.sqrt(2 * (0 - phi(GM0, R0)));
  const hist: number[] = [];
  const hist2: number[] = [];
  return (t: number, dt: number) => {
    // 势阱深度随时间脉动（GM 与两条轨迹积分同源）
    const depth = 2.6 + 0.4 * Math.sin(t * 0.8);
    const gm = depth * SOFT_S;
    for (let i = 0; i < warr.length; i += 3) {
      const x = orig[i], y = orig[i + 1];
      const r = Math.max(0.4, Math.hypot(x, y));
      warr[i + 2] = -gm / (SOFT_S + r); // 软核势阱 −GM/(s+r)：与轨迹同势（教学近似，非严格 −1/r）
    }
    wpos.needsUpdate = true;

    // 一维径向方程 ½v²+Φ(r)=E 半隐式积分（dt 限幅保证稳定）
    const h = Math.min(dt, 0.05);
    escV -= dphi(gm, escR) * h;
    escR += escV * h;
    if (escR > 6.0 || escR < R0 * 0.9) {           // 逸出井口（或异常回落到心）→ 重新加速出发
      escR = R0;
      escV = Math.sqrt(2 * (0.03 * gm - phi(gm, R0)));
      hist.length = 0;
    }
    hist.push(escR);
    if (hist.length > 300) hist.shift();
    const ea = (escGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    for (let i = 0; i < 300; i++) {
      const r = hist[i] ?? escR;
      ea[i * 3] = r;                                  // 逃逸线在 +x 侧
      ea[i * 3 + 1] = -1.5 + phi(gm, r);              // 与井面凹陷同高（读数为势阱剖面）
      ea[i * 3 + 2] = 1.2;
    }
    (escGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;

    // 束缚线：上行减速 → 转折点回落 → 回到出发半径后再次上抛（E<0 循环）
    capV -= dphi(gm, capR) * h;
    capR += capV * h;
    if (capV < 0 && capR <= R0) {
      capR = R0;
      capV = 0.72 * Math.sqrt(2 * (0 - phi(gm, R0)));
      hist2.length = 0;
    }
    hist2.push(capR);
    if (hist2.length > 300) hist2.shift();
    const ba = (capGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    for (let i = 0; i < 300; i++) {
      const r = hist2[i] ?? capR;
      ba[i * 3] = -r;                                 // 束缚线在 −x 侧，与逃逸线对照
      ba[i * 3 + 1] = -1.5 + phi(gm, r);              // 同样贴合井面凹陷剖面
      ba[i * 3 + 2] = 1.2;
    }
    (capGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    core.rotation.y += dt * 0.4;
  };
}

/** P139 史瓦西轨道与进动：椭圆 + 近星点进动 */
function build_schwarzschild(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 中心黑洞（事件视界 + 光子球）
  const bh = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.75, 32, 24)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1 })),
  );
  g.add(bh);
  const photonRing = new THREE.Mesh(
    bag.geo(new THREE.TorusGeometry(1.1, 0.04, 8, 72)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.9 })),
  );
  photonRing.rotation.x = Math.PI / 2;
  g.add(photonRing);
  // 进动椭圆（逐帧旋转 → 近星点进动）
  const orbGroup = new THREE.Group();
  g.add(orbGroup);
  const a = 4.4, e = 0.5;
  const b = a * Math.sqrt(1 - e * e);
  const pts: import('three').Vector3[] = [];
  for (let i = 0; i <= 240; i++) {
    const ph = (i / 240) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(ph) * a - a * e, 0, Math.sin(ph) * b));
  }
  orbGroup.add(new THREE.Line(
    bag.geo(new THREE.BufferGeometry().setFromPoints(pts)),
    bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan })),
  ));
  const star2 = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.3, 20, 14)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.pink, roughness: 0.4 })),
  );
  orbGroup.add(star2);
  // 进动轨迹（玫瑰线，长期演化）
  const traceGeo = bag.geo(new THREE.BufferGeometry());
  traceGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(600 * 3), 3));
  const trace = new THREE.Line(traceGeo, bag.mat(new THREE.LineBasicMaterial({
    color: PAL.violet, transparent: true, opacity: 0.8,
  })));
  g.add(trace);

  g.add(panelSprite(THREE, bag, [
    { text: '史瓦西测地线：(dr/dτ)² + (1−r_s/r)(1 + L²/r²) = E²（r_s = 2GM/c²）', color: '#f8fafc' },
    { text: '相对论修正使近星点每圈进动 Δφ = 6πGM/(c²a(1−e²))', color: '#94a3b8' },
    { text: '水星近日点进动 43″/世纪；强场中进动更显著（紫线玫瑰形）', color: '#fbbf24' },
    { text: '注意：进动率按演示放大（非真实比例），放大倍数见右图实时读数', color: '#22c55e' },
  ], [0, 4.6, 0], 8.6, 'center'));

  // 进动率读数：由本画面同一步进规则实测周期 T，放大倍数 = PREC_RATE·T / Δφ_GR(a,e)
  const PREC_RATE = 0.14;            // rad/s —— 演示放大值（真实时标进动肉眼不可见）
  const read = makeCanvas(bag, THREE, 420, 250, 5.0, 6.2, -3.4);
  g.add(read.mesh);
  // 教学定标：把画面半长轴 a=4.4 记作 0.088 AU，按面板同一史瓦西公式现算真实每圈进动
  const aAU = a * 0.02;
  const dphiGr = 6 * Math.PI * 1.3271244e20 / (299792458 * 299792458 * aAU * 1.495978707e11 * (1 - e * e));
  let phNext = Math.PI * 2, lastWrapT = -1, Tmeas = 0;
  let lastRead = -1;
  function drawRead(): void {
    const c = read.frame('进动率读数（与画面同源实测）', '轨道周期 T', 'Δφ/圈');
    c.fillStyle = '#f8fafc'; c.font = '15px sans-serif';
    c.fillText('史瓦西：Δφ = 6πGM/(c²a(1−e²))', 58, 44);
    if (Tmeas > 0) {
      const precPer = PREC_RATE * Tmeas;
      c.fillStyle = '#22c55e';
      c.fillText(`实测 T = ${Tmeas.toFixed(2)} s → 演示进动 ${(precPer.toFixed(3))} rad/圈`, 58, 66);
      c.fillText(`同标度真实值 Δφ ≈ ${dphiGr.toExponential(2)} rad/圈`, 58, 88);
      c.fillStyle = '#fbbf24';
      c.fillText(`视觉放大 ≈ ${(precPer / dphiGr).toExponential(1)}×（教学演示）`, 58, 110);
    } else {
      c.fillStyle = '#94a3b8';
      c.fillText('第一圈计时中…（周期由 pḣ∝1/r² 步进规则实测）', 58, 66);
    }
    read.tex.needsUpdate = true;
  }
  drawRead();

  let ph = 0;
  const traceHist: number[] = [];
  return (_t: number, dt: number) => {
    const r = a * (1 - e * e) / (1 + e * Math.cos(ph));
    ph += dt * (2.4 / Math.max(1.6, r * r / 4));
    // 进动：轨道整体缓慢转动（演示放大）
    const prec = _t * PREC_RATE;
    // 实测轨道周期（ph 每跨过 2π 记录一次）→ 读数与几何同源
    if (ph >= phNext) {
      phNext += Math.PI * 2;
      if (lastWrapT >= 0) Tmeas = _t - lastWrapT;
      lastWrapT = _t;
    }
    orbGroup.rotation.y = prec;
    star2.position.set(Math.cos(ph) * a - a * e, 0, Math.sin(ph) * b);
    // 记录轨迹（世界坐标，含进动）
    const lx = Math.cos(ph) * a - a * e;
    const lz = Math.sin(ph) * b;
    const wx = lx * Math.cos(prec) - lz * Math.sin(prec);
    const wz = lx * Math.sin(prec) + lz * Math.cos(prec);
    traceHist.push(wx, wz);
    if (traceHist.length > 1200) traceHist.splice(0, 2);
    const arr = (traceGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    for (let i = 0; i < 600; i++) {
      arr[i * 3] = traceHist[i * 2] ?? wx;
      arr[i * 3 + 1] = 0;
      arr[i * 3 + 2] = traceHist[i * 2 + 1] ?? wz;
    }
    (traceGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    const rb = Math.floor(_t * 5);
    if (rb !== lastRead) { lastRead = rb; drawRead(); }
    bh.rotation.y += dt * 0.3;
    photonRing.rotation.z += dt * 1.4;
  };
}

/** P18 三体问题：三体互相绕转的混沌运动 */
function build_threebody(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const cols = [PAL.amber, PAL.cyan, PAL.pink];
  const bodies = cols.map((c) => {
    const m = new THREE.Mesh(
      bag.geo(new THREE.SphereGeometry(0.4, 22, 16)),
      bag.mat(new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, roughness: 0.4 })),
    );
    g.add(m);
    return m;
  });
  // 轨迹（实线 = 初值系统）
  const trails = cols.map((c) => {
    const geo = bag.geo(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(300 * 3), 3));
    const l = new THREE.Line(geo, bag.mat(new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.8 })));
    g.add(l);
    return geo;
  });
  // 平行系统的轨迹（虚线 = 初值偏移 10⁻⁴ 的第二套演化 → 敏感依赖可同屏对照）
  const trails2 = cols.map(() => {
    const geo = bag.geo(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(300 * 3), 3));
    const l = new THREE.Line(geo, bag.mat(new THREE.LineDashedMaterial({
      color: 0xcbd5e1, transparent: true, opacity: 0.8, dashSize: 0.35, gapSize: 0.28,
    })));
    g.add(l);
    return l;
  });
  // 质心
  const cm = new THREE.Mesh(
    bag.geo(new THREE.OctahedronGeometry(0.18, 0)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.green })),
  );
  g.add(cm);

  g.add(panelSprite(THREE, bag, [
    { text: '三体问题：无解析通解（庞加莱），对初值指数敏感', color: '#f8fafc' },
    { text: '数值积分：aᵢ = −GΣ_{j≠i} mⱼ(rᵢ−rⱼ)/|rᵢ−rⱼ|³', color: '#94a3b8' },
    { text: '常见结局：弹射一个体 + 两体成双（逃逸/并合）', color: '#fbbf24' },
    { text: '虚线 = 初值偏移 10⁻⁴ 的平行系统：d(t) 指数分离（右图）→ 混沌', color: '#22c55e' },
  ], [0, 4.6, 0], 8.4, 'center'));

  // 读数画布：两系统的分离度 d(t)（对数轴）→ 分离度指数增长
  const read = makeCanvas(bag, THREE, 400, 250, 4.8, 6.2, -3.2);
  g.add(read.mesh);
  const D0 = 1e-4;
  const dHist: number[] = [];
  const D_MIN = -4, D_MAX = 1;
  function drawSep(d: number, tt: number): void {
    const c = read.frame('分离度 d(t)：两系统仅差 10⁻⁴', '时间 t', 'log₁₀ d');
    const W = 400, H = 250;
    const x0 = 50, x1 = W - 16, yTop = 22, y1 = H - 42;
    const pyOf = (v: number): number => y1 - ((v - D_MIN) / (D_MAX - D_MIN)) * (y1 - yTop);
    dHist.push(Math.log10(Math.max(1e-6, d)));
    if (dHist.length > 320) dHist.shift();
    // 初始分离基准线 d₀ = 1e-4
    c.strokeStyle = '#475569'; c.lineWidth = 2; c.setLineDash([6, 6]);
    c.beginPath(); c.moveTo(x0, pyOf(Math.log10(D0))); c.lineTo(x1, pyOf(Math.log10(D0))); c.stroke();
    c.setLineDash([]);
    // d(t)：指数增长 → 对数轴上近似直线
    c.strokeStyle = '#22c55e'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i < dHist.length; i++) {
      const px = x0 + (i / 319) * (x1 - x0);
      const py = pyOf(dHist[i]);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    c.fillStyle = '#f8fafc'; c.font = '15px sans-serif';
    c.fillText(`d₀ = 10⁻⁴（虚线），当前 d = ${d.toExponential(1)}`, 58, 44);
    c.fillStyle = '#94a3b8';
    c.fillText(`λ ≈ ln(d/d₀)/t = ${(Math.log(Math.max(d, D0) / D0) / Math.max(1e-6, tt)).toFixed(2)} s⁻¹`, 58, 66);
    c.fillStyle = '#fbbf24';
    c.fillText('指数分离 = 对初条件的敏感依赖', 58, 88);
    read.tex.needsUpdate = true;
  }
  drawSep(D0, 1);

  // 初始状态（非平衡，确保混沌）；平行系统 = 第一体 x 偏移 1e-4
  type Body3 = { x: number; y: number; vx: number; vy: number; m: number };
  const mkState = (dx0: number): Body3[] => [
    { x: -3.2 + dx0, y: 0, vx: 0, vy: -1.1, m: 1.0 },
    { x: 3.2, y: 0, vx: 0, vy: 1.1, m: 1.0 },
    { x: 0, y: 2.6, vx: 1.3, vy: 0, m: 1.0 },
  ];
  const st = mkState(0);
  const st2 = mkState(1e-4);
  const hist: number[][] = [[], [], []];
  const hist2: number[][] = [[], [], []];
  let acc = 0;
  const step = (s: Body3[], h: number) => {
    const ax = [0, 0, 0], ay = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (i === j) continue;
        const dx = s[i].x - s[j].x, dy = s[i].y - s[j].y;
        const r3 = Math.pow(dx * dx + dy * dy + 0.4, 1.5);
        ax[i] -= s[j].m * dx / r3;
        ay[i] -= s[j].m * dy / r3;
      }
      s[i].vx += ax[i] * h;
      s[i].vy += ay[i] * h;
      s[i].x += s[i].vx * h;
      s[i].y += s[i].vy * h;
    }
  };
  let lastSep = -1;

  return (_t: number, dt: number) => {
    acc += Math.min(dt, 0.05);
    const h = 1 / 400;
    let guard = 0;
    while (acc >= h && guard++ < 120) { step(st, h); step(st2, h); acc -= h; }
    let cx = 0, cy = 0, M = 0;
    let dMax = 0;
    st.forEach((s, i) => {
      const s2 = st2[i];
      bodies[i].position.set(s.x, s.y, Math.sin(s.x * 0.3) * 0.6);
      cx += s.x * s.m; cy += s.y * s.m; M += s.m;
      hist[i].push(s.x, s.y);
      if (hist[i].length > 600) hist[i].splice(0, 2);
      const arr = (trails[i].getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
      for (let k = 0; k < 300; k++) {
        arr[k * 3] = hist[i][k * 2] ?? s.x;
        arr[k * 3 + 1] = hist[i][k * 2 + 1] ?? s.y;
        arr[k * 3 + 2] = 0;
      }
      (trails[i].getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
      // 平行系统（虚线轨迹）
      hist2[i].push(s2.x, s2.y);
      if (hist2[i].length > 600) hist2[i].splice(0, 2);
      const a2 = (trails2[i].geometry.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
      for (let k = 0; k < 300; k++) {
        a2[k * 3] = hist2[i][k * 2] ?? s2.x;
        a2[k * 3 + 1] = hist2[i][k * 2 + 1] ?? s2.y;
        a2[k * 3 + 2] = 0.35;
      }
      (trails2[i].geometry.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
      trails2[i].computeLineDistances();
      // 两系统的最大体间分离度（对应右图 d(t)）
      dMax = Math.max(dMax, Math.hypot(s.x - s2.x, s.y - s2.y));
    });
    cm.position.set(cx / M, cy / M, 0);
    // 分离度读数：限帧刷新（约 8 次/秒）
    const bucket = Math.floor(_t * 8);
    if (bucket !== lastSep) { lastSep = bucket; drawSep(dMax, _t); }
    bodies.forEach((b, i) => { b.rotation.y += dt * (1 + i * 0.4); });
  };
}

/** P52 潮汐力：主星 + 卫星 + 潮汐隆起（沿连线拉伸） */
function build_tidal(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 主星（大）
  const planet = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(2.0, 40, 28)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.6 })),
  );
  g.add(planet);
  // 卫星
  const moon = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.7, 26, 18)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.7 })),
  );
  g.add(moon);
  // 潮汐隆起（椭球壳，沿连线方向拉伸）
  const bulge = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(2.12, 40, 28)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.amber, wireframe: true, transparent: true, opacity: 0.55 })),
  );
  g.add(bulge);
  // 潮汐力箭头（近端拉伸 / 远端拉伸 / 侧面压缩）
  const nearArrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(2.1, 0, 0), 1.4, PAL.red, 0.2, 0.1,
  );
  const farArrow = new THREE.ArrowHelper(
    new THREE.Vector3(-1, 0, 0), new THREE.Vector3(-2.1, 0, 0), 1.4, PAL.red, 0.2, 0.1,
  );
  // 侧向压缩箭头：位于垂直连线两侧，指向行星中心（大小 ≈ 端部拉伸的 1/2）
  const sideArrowA = new THREE.ArrowHelper(
    new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 2.1, 0), 0.7, PAL.cyan, 0.14, 0.07,
  );
  const sideArrowB = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -2.1, 0), 0.7, PAL.cyan, 0.14, 0.07,
  );
  g.add(nearArrow); g.add(farArrow); g.add(sideArrowA); g.add(sideArrowB);
  // 引力连线
  const link = new THREE.Line(
    bag.geo(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])),
    bag.mat(new THREE.LineDashedMaterial({ color: PAL.slate, gapSize: 0.2, dashSize: 0.3 })),
  );
  g.add(link);

  g.add(panelSprite(THREE, bag, [
    { text: '潮汐力 ΔF ≈ 2GM·R·m/r³：R = 天体半径，r = 中心距（R ≠ r）', color: '#f8fafc' },
    { text: '潮汐力 = 引力梯度：近端与远端都被拉离天体自身中心 → 沿连线拉长、侧向压扁', color: '#94a3b8' },
    { text: 'Roche 半径内潮汐超过自聚力 → 天体被撕碎（如潮汐瓦解）', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.4, 'center'));

  let ph = 0;
  return (t: number, dt: number) => {
    ph += dt * 0.7;
    const R = 5.2;
    moon.position.set(Math.cos(ph) * R, Math.sin(ph) * R * 0.35, Math.sin(ph) * R * 0.6);
    // 卫星始终以同一面朝向主星（潮汐锁定）
    moon.rotation.z = Math.atan2(moon.position.y, moon.position.x);
    moon.rotation.y = -ph;
    // 潮汐隆起沿主星-卫星连线拉伸
    bulge.rotation.z = Math.atan2(moon.position.y, moon.position.x);
    const stretch = 1 + 0.1 * (0.5 + 0.5 * Math.sin(t * 0.9));
    bulge.scale.set(1 + 0.06 * stretch, 1 - 0.03 * stretch, 1 - 0.03 * stretch);
    bulge.rotation.z = Math.atan2(moon.position.y, moon.position.x);
    const linkArr = (link.geometry.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    linkArr[0] = 0; linkArr[1] = 0; linkArr[2] = 0;
    linkArr[3] = moon.position.x; linkArr[4] = moon.position.y; linkArr[5] = moon.position.z;
    (link.geometry.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    link.computeLineDistances();
    // 潮汐力箭头随连线方向旋转
    const ang = Math.atan2(moon.position.y, moon.position.x);
    const dir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0);
    nearArrow.setDirection(dir);
    nearArrow.position.set(Math.cos(ang) * 2.1, Math.sin(ang) * 2.1, 0);
    // 远端差动力 a=GM/d³(3(dir·r̂)r̂−r) 在 r̂=−dir 处沿 −dir：背离行星中心向外（远侧也鼓起）
    farArrow.setDirection(dir.clone().negate());
    farArrow.position.set(-Math.cos(ang) * 2.1, -Math.sin(ang) * 2.1, 0);
    // 侧向压缩：r̂=±t（t⊥dir）时 a=−GM/d³·r̂，指向行星中心
    const perp = new THREE.Vector3(-Math.sin(ang), Math.cos(ang), 0);
    sideArrowA.setDirection(perp.clone().negate());
    sideArrowA.position.set(perp.x * 2.1, perp.y * 2.1, 0);
    sideArrowB.setDirection(perp);
    sideArrowB.position.set(-perp.x * 2.1, -perp.y * 2.1, 0);
    const f = 1.0 + 0.35 * Math.sin(t * 0.9);
    nearArrow.setLength(1.3 * f, 0.2, 0.1);
    farArrow.setLength(1.3 * f, 0.2, 0.1);
    sideArrowA.setLength(0.65 * f, 0.14, 0.07);
    sideArrowB.setLength(0.65 * f, 0.14, 0.07);
    planet.rotation.y += dt * 0.2;
  };
}

/** P474 变轨与宇宙速度：地面上抛/环绕/逃逸 + 霍曼转移 */
function build_transfer(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const earth = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(2.0, 36, 26)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.7 })),
  );
  g.add(earth);
  // 圆轨道速度 v = √(GM/r)（绿/青）+ 逃逸抛物线（橙，开放曲线而非圆）
  const orbit = (r: number, col: number, dash: boolean) => {
    const pts: import('three').Vector3[] = [];
    for (let i = 0; i <= 160; i++) {
      const ph = (i / 160) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(ph) * r, 0, Math.sin(ph) * r));
    }
    const l = new THREE.Line(
      bag.geo(new THREE.BufferGeometry().setFromPoints(pts)),
      bag.mat(new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.7 })),
    );
    if (dash) {
      const lm = l.material as import('three').LineBasicMaterial;
      void lm;
    }
    g.add(l);
    return l;
  };
  const r1 = orbit(2.6, PAL.green, false);   // 内圆轨道（第一宇宙速度 v₁）
  const r2 = orbit(4.6, PAL.cyan, false);    // 外圆轨道（霍曼转移远点）
  // 第二/第三宇宙速度 = 逃逸速度 → 抛物线（E = 0，开放不闭合），近点切于内圆 r = 2.6
  const escPts: import('three').Vector3[] = [];
  for (let i = 0; i <= 160; i++) {
    const th = -2.0 + (i / 160) * 4.0;    // |θ| ≤ 2.0：曲线张开、不闭合
    const er = 5.2 / (1 + Math.cos(th));  // 抛物线 r = p/(1+cosθ)，p = 2r_p = 5.2
    escPts.push(new THREE.Vector3(Math.cos(th) * er, 0, Math.sin(th) * er));
  }
  const r3 = new THREE.Line(
    bag.geo(new THREE.BufferGeometry().setFromPoints(escPts)),
    bag.mat(new THREE.LineBasicMaterial({ color: PAL.amber, transparent: true, opacity: 0.7 })),
  );
  g.add(r3);
  // 霍曼转移椭圆：近点 r_p = 2.6（切绿圆）、远点 r_a = 4.6（切青圆）
  // → a = (r_p+r_a)/2 = 3.6，c = a − r_p = 1.0（中心偏移 −1.0），b = √(r_p·r_a) ≈ 3.46
  const hopA = 3.6;
  const hopC = 1.0;
  const hopB = Math.sqrt(2.6 * 4.6);
  const hopPts: import('three').Vector3[] = [];
  for (let i = 0; i <= 160; i++) {
    const ph = (i / 160) * Math.PI;
    hopPts.push(new THREE.Vector3(Math.cos(ph) * hopA - hopC, 0, Math.sin(ph) * hopB));
  }
  const hop = new THREE.Line(
    bag.geo(new THREE.BufferGeometry().setFromPoints(hopPts)),
    bag.mat(new THREE.LineBasicMaterial({ color: PAL.pink, transparent: true, opacity: 0.9 })),
  );
  g.add(hop);
  // 两切点处的 Δv 脉冲箭头（近点加速入转移、远点加速圆化，均沿轨道切向）
  const dvPeri = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(2.6, 0, 0), 1.5, PAL.pink, 0.2, 0.1,
  );
  const dvApo = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, -1), new THREE.Vector3(-4.6, 0, 0), 1.5, PAL.pink, 0.2, 0.1,
  );
  g.add(dvPeri); g.add(dvApo);
  // 探测器（沿转移椭圆运动）
  const probe = new THREE.Mesh(
    bag.geo(new THREE.ConeGeometry(0.2, 0.55, 12)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: 0xb45309, emissiveIntensity: 0.6 })),
  );
  g.add(probe);
  // 速度箭头
  const vArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 1.4, PAL.amber, 0.18, 0.09,
  );
  g.add(vArrow);

  // 能量账本 / Δv 预算：全部由面板同一 GM 标度与 r_p/r_a 几何导出（活力公式同源读数）
  const RP = 2.6, RA = 4.6;              // 内/外圆轨道半径（与画面绿/青线一致）
  const V1K = 7.9;                       // 内圆处第一宇宙速度（km/s，面板值）
  const GMK = V1K * V1K * RP;            // 演示单位：圆轨道 v² = GM/r → GM = v₁²·r_p
  const aT = (RP + RA) / 2;              // 转移椭圆半长轴 = 3.6（= hopA，几何同源）
  const vcP = Math.sqrt(GMK / RP);                          // 7.90 圆轨速（近点处）
  const vcA = Math.sqrt(GMK / RA);                          // 5.94 外圆速（远点处）
  const vP = Math.sqrt(GMK * (2 / RP - 1 / aT));            // 转移椭圆近点速（活力公式）
  const vA = Math.sqrt(GMK * (2 / RA - 1 / aT));            // 转移椭圆远点速
  const dv1 = vP - vcP;                  // = v₁(√(2r_a/(r_p+r_a))−1) 近点加速脉冲
  const dv2 = vcA - vA;                  // 远点圆化脉冲
  // 活力公式画布：r、v 逐帧由探测器几何位置现算 → 读数与画面同源
  const read = makeCanvas(bag, THREE, 400, 260, 4.8, 6.2, -3.4);
  g.add(read.mesh);
  let rNow = RP, vNow = vP;
  function drawRead(): void {
    const c = read.frame('能量账本 · Δv 预算', '转移椭圆 a = (r_p+r_a)/2', 'v (km/s)');
    c.fillStyle = '#f8fafc'; c.font = '15px sans-serif';
    c.fillText('活力公式 v² = GM(2/r − 1/a)', 58, 44);
    c.fillStyle = '#22c55e';
    c.fillText(`当前 r = ${rNow.toFixed(2)} → v = ${vNow.toFixed(2)} km/s`, 58, 66);
    c.fillStyle = '#94a3b8';
    c.fillText(`近点：v_c=${vcP.toFixed(2)} → v_p=${vP.toFixed(2)}，Δv₁=+${dv1.toFixed(2)}`, 58, 88);
    c.fillText(`远点：v_a=${vA.toFixed(2)} → v_c=${vcA.toFixed(2)}，Δv₂=+${dv2.toFixed(2)}`, 58, 110);
    c.fillStyle = '#fbbf24';
    c.fillText(`Δv 预算合计 ≈ ${(dv1 + dv2).toFixed(2)} km/s（两脉冲最省）`, 58, 132);
    // 比轨道能量 ε = −GM/(2a)：账本三行（内圆 / 转移椭圆 / 外圆）
    const e1 = -GMK / (2 * RP), eT = -GMK / (2 * aT), e2 = -GMK / (2 * RA);
    c.fillText(`ε: 内圆 ${e1.toFixed(1)} < 转移 ${eT.toFixed(1)} < 外圆 ${e2.toFixed(1)}`, 58, 154);
    read.tex.needsUpdate = true;
  }
  drawRead();

  g.add(panelSprite(THREE, bag, [
    { text: '第一宇宙速度 v₁ = √(GM/r) = 7.9 km/s（绿/青线均为圆轨道，r = 2.6 / 4.6）', color: '#22c55e' },
    { text: '第二 v₂ = √2·v₁ = 11.2、第三 v₃ = 16.7 km/s 是逃逸 → 橙线为抛物线（开放，非圆）', color: '#94a3b8' },
    { text: '霍曼转移：近点 r=2.6 / 远点 r=4.6 各点一次火，Δv 最省（粉线切于两圆，粉箭头 = Δv 脉冲）', color: '#f472b6' },
    { text: '右图能量账本：活力公式与 Δv 预算由同一 GM=v₁²r_p 与 r_p/r_a 几何现算', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.6, 'center'));

  // 面板可见性：三轨道都显示
  r1.visible = true; r2.visible = true; r3.visible = true;
  let ang = 0;
  let lastRead = -1;
  return (t: number, dt: number) => {
    // 探测器沿霍曼转移椭圆运动（近点快、远点慢）
    const rr = Math.hypot(Math.cos(ang) * hopA - hopC, Math.sin(ang) * hopB);
    ang += dt * (3.0 / Math.max(3.0, rr * rr / 6));
    if (ang > Math.PI * 2) ang -= Math.PI * 2;
    const px = Math.cos(ang) * hopA - hopC;
    const pz = Math.sin(ang) * hopB;
    probe.position.set(px, 0, pz);
    probe.rotation.y = Math.atan2(pz, px) + Math.PI / 2;
    // 速度箭头（切向）
    const tx = -Math.sin(ang) * hopA;
    const tz = Math.cos(ang) * hopB;
    vArrow.position.set(px, 0, pz);
    vArrow.setDirection(new THREE.Vector3(tx, 0, tz).normalize());
    // 活力公式现算：r = 到焦点（地心）距离 → v = √(GM(2/r−1/a))，箭头长度与右图读数同源
    rNow = Math.max(RP, Math.min(RA, Math.hypot(px, pz)));
    vNow = Math.sqrt(GMK * (2 / rNow - 1 / aT));
    vArrow.setLength(Math.min(2.6, 0.35 + vNow * 0.14), 0.18, 0.09);
    // 能量账本读数 ~5 Hz 刷新
    const rb = Math.floor(t * 5);
    if (rb !== lastRead) { lastRead = rb; drawRead(); }
    earth.rotation.y += dt * 0.3;
  };
}

/** P281 凌星法搜寻系外行星：恒星 + 掠过 + 光变谷 */
function build_transit(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 恒星
  const star = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(2.4, 40, 28)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xf59e0b, emissiveIntensity: 1.0, roughness: 0.6 })),
  );
  g.add(star);
  // 行星（掠过恒星盘面前方）
  const planet = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.42, 24, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 })),
  );
  g.add(planet);
  // 光变曲线：画一个完整周期，凌星中心在相位 0.5（与动画行星过盘时刻一致）
  const plot = makeCanvas(bag, THREE, 440, 260, 5.4, 6.2, -3.6);
  g.add(plot.mesh);
  // 凌星剖面 dipAt(ph)：相位归一化到 [0,1)（安全取模），返回 0(无凌)…1(全凌)
  // 曲线取样与动画中恒星变暗共用同一函数 → 曲线谷与过盘时刻严格对齐
  function dipAt(ph: number): number {
    const p = ((ph % 1) + 1) % 1;
    const d = Math.abs(p - 0.5);
    if (d >= 0.11) return 0;
    // 平底 + 陡峭出入（U 形）
    const u = d / 0.11;
    return u > 0.82 ? Math.pow((1 - u) / 0.18, 2) : 1;
  }
  function drawLC(phase: number): void {
    const c = plot.frame('凌星光变（亮度 vs 相位）', '相位 φ', '相对流量');
    const W = 440, H = 260;
    const yTop = 44, yBot = H - 52;
    c.strokeStyle = '#f59e0b'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 340; i++) {
      const x = i / 340; // 相位 0…1（一个周期）
      const px = 50 + x * (W - 70);
      const py = yTop + dipAt(x) * (yBot - yTop) * 0.55;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    const cx2 = 50 + (((phase % 1) + 1) % 1) * (W - 70);
    c.strokeStyle = '#22c55e'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(cx2, yTop - 14); c.lineTo(cx2, yBot); c.stroke();
    c.fillStyle = '#f8fafc'; c.font = '15px sans-serif';
    c.fillText('谷深 δ = (R_p/R★)²', 58, 44);
    c.fillStyle = '#94a3b8';
    c.fillText('谷宽 = 凌星持续时间，周期 = 行星公转周期', 58, 66);
    c.fillText(`相位 ${(((phase % 1) + 1) % 1).toFixed(2)}`, 58, 88);
    plot.tex.needsUpdate = true;
  }
  drawLC(0.5);

  g.add(panelSprite(THREE, bag, [
    { text: '凌星法：行星掠过恒星盘面 → 亮度下降 δ = (R_p/R★)²', color: '#f8fafc' },
    { text: '光变谷给出半径 R_p、周期 P（开普勒第三定律 → 轨道半长径）', color: '#94a3b8' },
    { text: '读数：地球凌太阳 δ ≈ 8.4×10⁻⁵（84 ppm），需 ppm 级测光', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.6, 'center'));

  let lastPhase = -1;
  return (t: number, dt: number) => {
    const period = 7.0;
    const phase = (t % period) / period;
    // 行星沿 x 方向掠过（凌星在 phase = 0.5：行星过盘中心，与曲线谷对齐）
    const x = -5.5 + phase * 11;
    planet.position.set(x, 0.4, 2.6);
    // 恒星变暗：与曲线共用 dipAt → 画面与读数同步
    const occ = dipAt(phase);
    (star.material as import('three').MeshStandardMaterial).emissiveIntensity = 1.0 - 0.35 * occ;
    const bucket = Math.round(phase * 40);
    if (bucket !== lastPhase) { lastPhase = bucket; drawLC(phase); }
    star.rotation.y += dt * 0.2;
  };
}
