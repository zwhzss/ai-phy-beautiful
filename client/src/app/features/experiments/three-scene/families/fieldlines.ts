import type { SceneContext, SceneInstance } from '../types';
import { scaffold, panelSprite, PAL, ResourceBag } from './_common';

/**
 * 场与场线族（fieldlines）：P97 静电平衡与尖端放电 / P438 电介质的极化 /
 * P483 电偶极子的电场与势 · P13 电场线与电势（dipole 二次分支） /
 * P98 电荷分布与库仑扭秤 / P304 涡流与电磁阻尼 · P482 法拉第定律与楞次方向（eddy 二次分支） /
 * P302 法拉第圆盘发电机 / P481 柱对称高斯定理 · P92 高斯定律（gauss 二次分支） /
 * P95 镜像电荷 / P441 磁偶极与磁矩 / P484 电势的多极展开 / P93 电势与等势面 / P96 四极场。
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
    case 'conductor': return build_conductor(g, bag, THREE, title);
    case 'dielectric': return build_dielectric(g, bag, THREE, title);
    case 'dipole': return build_dipole(g, bag, THREE, title);
    case 'distribution': return build_distribution(g, bag, THREE, title);
    case 'eddy': return build_eddy(g, bag, THREE, title);
    case 'fardisk': return build_fardisk(g, bag, THREE, title);
    case 'gauss': return build_gauss(g, bag, THREE, title);
    case 'imagecharge': return build_imagecharge(g, bag, THREE, title);
    case 'magdipole': return build_magdipole(g, bag, THREE, title);
    case 'multipole': return build_multipole(g, bag, THREE, title);
    case 'potential': return build_potential(g, bag, THREE, title);
    case 'quadrupole': return build_quadrupole(g, bag, THREE, title);
    default: return build_conductor(g, bag, THREE, title);
  }
}

/** 通用：从给定电荷组数值积分出电场线（RK2）；stopY 给定时场线在 y = stopY 平面处截断（如导体表面） */
function integrateLines(
  THREE: typeof import('three'),
  charges: { x: number; y: number; z: number; q: number }[],
  starts: import('three').Vector3[],
  maxStep: number,
  limit: number,
  stopY?: number,
): import('three').Vector3[][] {
  const field = (p: import('three').Vector3): import('three').Vector3 => {
    const out = new THREE.Vector3();
    for (const c of charges) {
      const dx = p.x - c.x, dy = p.y - c.y, dz = p.z - c.z;
      const r2 = dx * dx + dy * dy + dz * dz + 0.06;
      const r = Math.sqrt(r2);
      out.x += (c.q * dx) / (r2 * r);
      out.y += (c.q * dy) / (r2 * r);
      out.z += (c.q * dz) / (r2 * r);
    }
    return out;
  };
  const lines: import('three').Vector3[][] = [];
  for (const s of starts) {
    const pts: import('three').Vector3[] = [s.clone()];
    let p = s.clone();
    for (let i = 0; i < limit; i++) {
      const prev = p.clone();
      const f1 = field(p);
      if (f1.lengthSq() < 1e-9) break;
      const mid = p.clone().addScaledVector(f1, maxStep * 0.5);
      const f2 = field(mid);
      if (f2.lengthSq() < 1e-9) break;
      p = p.clone().addScaledVector(f2, maxStep);
      // 截断于给定平面（只保留该平面一侧的场）
      if (stopY !== undefined && p.y < stopY) {
        const k = (prev.y - stopY) / (prev.y - p.y);
        pts.push(new THREE.Vector3(prev.x + (p.x - prev.x) * k, stopY, prev.z + (p.z - prev.z) * k));
        break;
      }
      pts.push(p.clone());
      // 靠近任一电荷即停止
      let stop = false;
      for (const c of charges) {
        const d = Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z);
        if (d < 0.28 || Math.abs(p.x) > 9 || Math.abs(p.y) > 7 || Math.abs(p.z) > 7) { stop = true; break; }
      }
      if (stop) break;
    }
    if (pts.length > 4) lines.push(pts);
  }
  return lines;
}

/** 通用：把多条场线加入组（登记 geo/mat） */
function addLines(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  lines: import('three').Vector3[][],
  color: number,
  opacity = 0.85,
): import('three').Line[] {
  return lines.map((pts) => {
    const l = new THREE.Line(
      bag.geo(new THREE.BufferGeometry().setFromPoints(pts)),
      bag.mat(new THREE.LineBasicMaterial({ color, transparent: true, opacity })),
    );
    g.add(l);
    return l;
  });
}

/** 通用：在 x–y 平面上数值求等值线 φ(x,y)=c（marching squares），返回成对线段端点 */
function equipotSegments(
  THREE: typeof import('three'),
  phi: (x: number, y: number) => number,
  c: number,
  x0: number, x1: number, y0: number, y1: number,
  nx: number, ny: number,
): import('three').Vector3[] {
  const dx = (x1 - x0) / nx, dy = (y1 - y0) / ny;
  const f = (i: number, j: number): number => phi(x0 + i * dx, y0 + j * dy) - c;
  const lerp = (a: number, b: number, fa: number, fb: number): number => {
    const d = fa - fb;
    return a + (b - a) * (Math.abs(d) < 1e-12 ? 0.5 : fa / d);
  };
  const segs: import('three').Vector3[] = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const xa = x0 + i * dx, xb = xa + dx;
      const ya = y0 + j * dy, yb = ya + dy;
      const fa = f(i, j), fb = f(i + 1, j), fc = f(i + 1, j + 1), fd = f(i, j + 1);
      const hits: import('three').Vector3[] = [];
      if (fa * fb < 0) hits.push(new THREE.Vector3(lerp(xa, xb, fa, fb), ya, 0));   // 下边
      if (fb * fc < 0) hits.push(new THREE.Vector3(xb, lerp(ya, yb, fb, fc), 0));   // 右边
      if (fd * fc < 0) hits.push(new THREE.Vector3(lerp(xa, xb, fd, fc), yb, 0));   // 上边
      if (fa * fd < 0) hits.push(new THREE.Vector3(xa, lerp(ya, yb, fa, fd), 0));   // 左边
      if (hits.length === 2) segs.push(hits[0], hits[1]);
      else if (hits.length === 4) segs.push(hits[0], hits[1], hits[2], hits[3]);    // 鞍点歧义：两两相连
    }
  }
  return segs;
}

/** 电荷球 */
function chargeBall(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  x: number, y: number, z: number, r: number, positive: boolean,
): import('three').Mesh {
  const col = positive ? 0xef4444 : 0x3b82f6;
  const m = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(r, 24, 18)),
    bag.mat(new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.55, roughness: 0.4 })),
  );
  m.position.set(x, y, z);
  g.add(m);
  const sign = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(r * 0.9, r * 0.18, r * 0.18)),
    bag.mat(new THREE.MeshBasicMaterial({ color: 0xffffff })),
  );
  sign.position.set(x, y, z + r * 0.9);
  g.add(sign);
  if (!positive) {
    const sign2 = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(r * 0.18, r * 0.9, r * 0.18)),
      bag.mat(new THREE.MeshBasicMaterial({ color: 0xffffff })),
    );
    sign2.position.set(x, y, z + r * 0.9);
    g.add(sign2);
  }
  return m;
}

/** P97 静电平衡与尖端放电：导体表面场线垂直 + 尖端曲率大 → 电场密集放电 */
function build_conductor(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 导体：一端尖锐（曲率半径小）
  const body = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(1.5, 1.5, 4.4, 40)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.35 })),
  );
  body.rotation.z = Math.PI / 2;
  body.position.set(-1.8, -1.2, 0);
  g.add(body);
  const tip = new THREE.Mesh(
    bag.geo(new THREE.ConeGeometry(1.5, 3.0, 40)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.35 })),
  );
  tip.rotation.z = -Math.PI / 2;
  tip.position.set(1.9, -1.2, 0);
  g.add(tip);
  // 平端面（对照）
  const flatEnd = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(1.5, 1.5, 0.18, 40)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6, roughness: 0.4 })),
  );
  flatEnd.rotation.z = Math.PI / 2;
  flatEnd.position.set(-4.1, -1.2, 0);
  g.add(flatEnd);

  // 场线：从尖端（密）与平端（疏）发出，垂直于导体表面
  const starts: import('three').Vector3[] = [];
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2;
    starts.push(new THREE.Vector3(3.45, -1.2 + Math.cos(ang) * 0.34, Math.sin(ang) * 0.34));
  }
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    starts.push(new THREE.Vector3(-4.2, -1.2 + Math.cos(ang) * 1.1, Math.sin(ang) * 1.1));
  }
  const charges = [
    { x: 3.4, y: -1.2, z: 0, q: 1.0 },
    { x: -4.1, y: -1.2, z: 0, q: -1.0 },
  ];
  // 尖端场线更密：在尖端附近多加几条
  const lines = integrateLines(THREE, charges, starts, 0.18, 120);
  addLines(g, bag, THREE, lines, PAL.cyan, 0.8);
  // 尖端放电火花（脉冲）
  const spark = new THREE.Mesh(
    bag.geo(new THREE.ConeGeometry(0.1, 1.4, 8)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.9 })),
  );
  spark.rotation.z = -Math.PI / 2;
  spark.position.set(4.6, -1.2, 0);
  g.add(spark);

  g.add(panelSprite(THREE, bag, [
    { text: '静电平衡：导体内 E = 0，表面 E ⊥ 面（等势体）', color: '#f8fafc' },
    { text: '电荷聚集在曲率大处：尖端 σ = ε₀E 远大于平端 → 尖端放电', color: '#94a3b8' },
    { text: '读数：尖端场线密度 ≈ 平端数倍；避雷针利用此原理引雷入地', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.4, 'center'));

  return (t: number) => {
    const s = 0.6 + 0.6 * (Math.sin(t * 6) * 0.5 + 0.5);
    spark.scale.set(1, 0.5 + s, 1);
    (spark.material as import('three').MeshBasicMaterial).opacity = 0.25 + 0.65 * ((Math.sin(t * 9) + 1) / 2);
    body.rotation.x = 0;
  };
}

/** P438 电介质的极化：外场中分子取向 → 束缚电荷 → 内部场削弱 */
function build_dielectric(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 外加均匀电场（箭头）
  const fieldArrows: import('three').ArrowHelper[] = [];
  for (let i = 0; i < 4; i++) {
    const a = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(-6.0, -1.6 + i * 1.1, 0), 2.4, PAL.slate, 0.2, 0.1,
    );
    g.add(a);
    fieldArrows.push(a);
  }
  // 电介质板
  const slab = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(4.6, 4.2, 0.7)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.22, roughness: 0.5 })),
  );
  slab.position.set(0.6, -0.4, 0);
  g.add(slab);
  // 极化分子（偶极子棒：+红 −蓝）
  const molGeo = bag.geo(new THREE.BoxGeometry(0.7, 0.14, 0.14));
  const plusMat = bag.mat(new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.3 }));
  const minusMat = bag.mat(new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x1d4ed8, emissiveIntensity: 0.3 }));
  const mols: import('three').Group[] = [];
  for (let i = 0; i < 26; i++) {
    const row = Math.floor(i / 7);
    const col = i % 7;
    const mg = new THREE.Group();
    const plus = new THREE.Mesh(molGeo, plusMat);
    const minus = new THREE.Mesh(molGeo, minusMat);
    plus.position.x = 0.35;
    minus.position.x = -0.35;
    mg.add(plus); mg.add(minus);
    mg.position.set(-1.0 + col * 0.55, 1.0 - row * 0.7, 0.45);
    mg.userData['ph'] = Math.random() * 6.28;
    g.add(mg);
    mols.push(mg);
  }
  // 束缚面电荷
  const qPlus = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.16, 4.2, 0.72)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.5, transparent: true, opacity: 0.8 })),
  );
  qPlus.position.set(2.9, -0.4, 0);
  g.add(qPlus);
  const qMinus = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.16, 4.2, 0.72)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x1d4ed8, emissiveIntensity: 0.5, transparent: true, opacity: 0.8 })),
  );
  qMinus.position.set(-1.7, -0.4, 0);
  g.add(qMinus);

  g.add(panelSprite(THREE, bag, [
    { text: '极化强度 P = Nμcosθ（取向） + αε₀E（位移），D = ε₀E + P', color: '#f8fafc' },
    { text: '介质内出现束缚面电荷 → 附加场反向削弱：E = E₀/(1+χₑ)', color: '#94a3b8' },
    { text: '读数：相对介电常数 εᵣ = 1+χₑ，εᵣ 越大内部场越弱', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.4, 'center'));

  let ang = 0;
  return (t: number, dt: number) => {
    // 分子随外场方向轻微摆动（热运动 + 取向）
    ang = Math.sin(t * 1.2) * 0.12;
    mols.forEach((m, i) => {
      const jitter = Math.sin(t * 3 + (m.userData['ph'] as number)) * 0.16;
      m.rotation.z = ang + jitter;
      m.rotation.x = Math.sin(t * 2 + i) * 0.1;
    });
    // 外场箭头呼吸
    fieldArrows.forEach((a) => {
      a.setLength(2.4 + 0.4 * Math.sin(t * 2), 0.2, 0.1);
    });
    void dt;
  };
}

/** P483 电偶极子的电场与势 / P13 电场线与电势（二次分支） */
function build_dipole(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const potential = title.includes('电场线与电势');
  // 正负电荷
  chargeBall(g, bag, THREE, 0, 1.3, 0, 0.42, true);
  chargeBall(g, bag, THREE, 0, -1.3, 0, 0.42, false);

  // 偶极场线（从 + 出发、终止于 −）
  const starts: import('three').Vector3[] = [];
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    starts.push(new THREE.Vector3(Math.cos(ang) * 0.55, 1.3 + Math.sin(ang) * 0.55, 0));
  }
  const charges = [
    { x: 0, y: 1.3, z: 0, q: 1.0 },
    { x: 0, y: -1.3, z: 0, q: -1.0 },
  ];
  const lines = integrateLines(THREE, charges, starts, 0.16, 140);
  addLines(g, bag, THREE, lines, PAL.cyan, 0.8);

  // 等势线（仅"电场线与电势"知识点显示）：按真实电势 φ = kq/r₊ + kq/r₋ 求 φ=c 等值线
  const phi = (x: number, y: number): number =>
    1 / Math.hypot(x, y - 1.3) - 1 / Math.hypot(x, y + 1.3);
  const probePos = new THREE.Vector3(1.3, 2.0, 0);   // 试探电荷 q₀ 所在点（取在一条等势线上）
  const phiProbe = phi(probePos.x, probePos.y);
  const equipMats: { m: import('three').Material; base: number }[] = [];
  let probe: import('three').Mesh | null = null;
  let forceArrow: import('three').ArrowHelper | null = null;
  if (potential) {
    // φ = ±n·φ(q₀)（等 Δφ）的真实等势线：红 φ>0（近 +q），蓝 φ<0（近 −q）
    for (const n of [1, 2, 3]) {
      for (const s of [1, -1]) {
        const pts = equipotSegments(THREE, phi, s * n * phiProbe, -3.2, 3.2, -3.3, 3.3, 96, 99);
        if (pts.length < 2) continue;
        const m = bag.mat(new THREE.LineBasicMaterial({
          color: s > 0 ? PAL.red : PAL.blue, transparent: true, opacity: 0.6,
        }));
        g.add(new THREE.LineSegments(bag.geo(new THREE.BufferGeometry().setFromPoints(pts)), m));
        equipMats.push({ m, base: 0.6 });
      }
    }
    // 零势面（中垂面 φ = 0）
    const plane = new THREE.Mesh(
      bag.geo(new THREE.RingGeometry(1.6, 3.6, 64)),
      bag.mat(new THREE.MeshBasicMaterial({ color: PAL.green, transparent: true, opacity: 0.28, side: THREE.DoubleSide })),
    );
    plane.rotation.x = -Math.PI / 2;
    g.add(plane);
    equipMats.push({ m: plane.material, base: 0.28 });
    // 单个点电荷：辐射场线 + 同心等势圆（φ = kq/r → 等势线是同心圆）
    const lone = new THREE.Vector3(-3.6, -2.3, 0);
    chargeBall(g, bag, THREE, lone.x, lone.y, 0, 0.3, true);
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0);
      const m = bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.7 }));
      g.add(new THREE.Line(bag.geo(new THREE.BufferGeometry().setFromPoints([
        lone.clone().addScaledVector(dir, 0.38),
        lone.clone().addScaledVector(dir, 1.05),
      ])), m));
      equipMats.push({ m, base: 0.7 });
    }
    for (const r of [0.58, 0.95]) {
      const ring: import('three').Vector3[] = [];
      for (let k = 0; k <= 48; k++) {
        const a = (k / 48) * Math.PI * 2;
        ring.push(new THREE.Vector3(lone.x + Math.cos(a) * r, lone.y + Math.sin(a) * r, 0));
      }
      const m = bag.mat(new THREE.LineBasicMaterial({ color: PAL.red, transparent: true, opacity: 0.6 }));
      g.add(new THREE.Line(bag.geo(new THREE.BufferGeometry().setFromPoints(ring)), m));
      equipMats.push({ m, base: 0.6 });
    }
    // 试探电荷 q₀（绿球）与其受力 F = q₀E（沿该点场强，⊥ 等势线）
    probe = new THREE.Mesh(
      bag.geo(new THREE.SphereGeometry(0.18, 16, 12)),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.green, emissive: 0x15803d, emissiveIntensity: 0.6 })),
    );
    probe.position.copy(probePos);
    g.add(probe);
    const eField = new THREE.Vector3();
    for (const c of charges) {
      const d = probePos.clone().sub(new THREE.Vector3(c.x, c.y, c.z));
      eField.addScaledVector(d, c.q / Math.pow(d.lengthSq(), 1.5));
    }
    forceArrow = new THREE.ArrowHelper(eField.normalize(), probePos, 1.5, PAL.gold, 0.2, 0.1);
    g.add(forceArrow);
  }
  // 电偶极矩箭头 p = qd
  const pArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1.3, 0), 2.6, PAL.gold, 0.22, 0.11,
  );
  g.add(pArrow);

  const phiTxt = (phiProbe >= 0 ? '+' : '') + phiProbe.toFixed(2);
  g.add(panelSprite(THREE, bag, potential ? [
    { text: '电场线 ⊥ 等势线（E = −∇φ）：左下角为单个点电荷的同心等势圆', color: '#f8fafc' },
    { text: '偶极势 φ = kq(1/r₊ − 1/r₋)：红 φ>0、蓝 φ<0，中垂面 φ = 0（绿面）', color: '#94a3b8' },
    { text: `读数：等势线越密 → |E| 越强；绿球 q₀ 受 F = q₀E ⊥ 等势线（φ = ${phiTxt}）`, color: '#fbbf24' },
  ] : [
    { text: '电偶极矩 p = qd（金箭头），远场 E ∝ p/r³', color: '#f8fafc' },
    { text: '轴线上 E = 2kp/r³，中垂面上 E = kp/r³（方向相反）', color: '#94a3b8' },
    { text: '偶极势 φ = kp·cosθ/r²（∝ 1/r²，比场衰减慢一档）', color: '#06b6d4' },
    { text: '势能 U = −p·E：偶极子在电场中倾向于转向对齐', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.4, 'center'));

  // 仅"电偶极子的电场与势"分支：沿轴线 φ(r)∝1/r² 与 E(r)∝1/r³ 的衰减对比曲线
  if (!potential) {
    const cv = document.createElement('canvas');
    cv.width = 380; cv.height = 260;
    const c = cv.getContext('2d')!;
    c.fillStyle = 'rgba(7,11,20,0.78)';
    c.fillRect(0, 0, 380, 260);
    c.strokeStyle = 'rgba(71,85,105,0.9)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(48, 20); c.lineTo(48, 214); c.lineTo(356, 214); c.stroke();
    c.fillStyle = '#94a3b8'; c.font = '18px sans-serif';
    c.fillText('r（沿轴线）', 230, 240);
    c.fillText('幅值', 16, 34);
    // φ ∝ 1/r²（青）与 E ∝ 1/r³（金），归一化到 r=r₀
    const r0 = 1.0, N = 60;
    const sx = (r: number) => 48 + ((r - r0) / 3.0) * 308;
    c.strokeStyle = '#06b6d4'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= N; i++) {
      const r = r0 + (i / N) * 3.0;
      const v = (r0 * r0) / (r * r);
      const y = 214 - v * 174;
      if (i === 0) c.moveTo(sx(r), y); else c.lineTo(sx(r), y);
    }
    c.stroke();
    c.strokeStyle = '#fbbf24'; c.beginPath();
    for (let i = 0; i <= N; i++) {
      const r = r0 + (i / N) * 3.0;
      const v = (r0 * r0 * r0) / (r * r * r);
      const y = 214 - v * 174;
      if (i === 0) c.moveTo(sx(r), y); else c.lineTo(sx(r), y);
    }
    c.stroke();
    c.fillStyle = '#06b6d4'; c.font = 'bold 19px sans-serif';
    c.fillText('φ ∝ 1/r²（势）', 176, 60);
    c.fillStyle = '#fbbf24';
    c.fillText('E ∝ 1/r³（场）', 176, 88);
    const decayTex = bag.tex(new THREE.CanvasTexture(cv));
    decayTex.needsUpdate = true;
    const decayPlot = new THREE.Mesh(
      bag.geo(new THREE.PlaneGeometry(3.7, 2.53)),
      bag.mat(new THREE.MeshBasicMaterial({ map: decayTex, transparent: true, depthTest: false })),
    );
    decayPlot.position.set(5.2, 1.4, 0);
    decayPlot.renderOrder = 997;
    g.add(decayPlot);
  }

  return (t: number, dt: number) => {
    pArrow.setLength(2.6 + 0.25 * Math.sin(t * 1.5), 0.22, 0.11);
    equipMats.forEach((e, i) => {
      e.m.opacity = e.base * (0.6 + 0.4 * Math.sin(t * 1.6 + i * 0.7));
    });
    if (probe && forceArrow) {
      probe.scale.setScalar(1 + 0.15 * Math.sin(t * 3));
      forceArrow.setLength(1.5 + 0.2 * Math.sin(t * 2), 0.2, 0.1);
    }
    void dt;
  };
}

/** P98 电荷分布与库仑扭秤：扭丝 + 电荷分布 → 静电计偏转 */
function build_distribution(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 库仑扭秤：悬丝 + 水平臂 + 两小球
  const wire = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.03, 0.03, 4.6, 8)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.slate })),
  );
  wire.position.y = 3.0;
  g.add(wire);
  const armGroup = new THREE.Group();
  armGroup.position.y = 0.7;
  g.add(armGroup);
  const arm = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(4.2, 0.1, 0.16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.5, roughness: 0.4 })),
  );
  armGroup.add(arm);
  const ballL = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.3, 20, 14)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.4 })),
  );
  ballL.position.x = -2.1;
  armGroup.add(ballL);
  const ballR = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.3, 20, 14)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.4 })),
  );
  ballR.position.x = 2.1;
  armGroup.add(ballR);
  // 固定带电小球：与本族色约定一致（红=+、蓝=−），红-红 = 同性相斥 → 扭转
  const fixed = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.3, 20, 14)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.5 })),
  );
  fixed.position.set(3.3, 0.7, 0.9);
  g.add(fixed);
  // 反光镜 + 刻度盘（读数）
  const dial = new THREE.Mesh(
    bag.geo(new THREE.RingGeometry(1.8, 2.0, 72, 1, 0, Math.PI)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.slate, side: THREE.DoubleSide })),
  );
  dial.position.set(0, -2.6, 0);
  g.add(dial);
  const needle = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(1.7, 0.06, 0.1)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold })),
  );
  needle.position.set(0, -2.6, 0.1);
  g.add(needle);
  // 电荷分布（导体球壳 + 内电荷 → 电荷聚集表面）
  const shell = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(1.2, 36, 24)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5, roughness: 0.4, transparent: true, opacity: 0.35 })),
  );
  shell.position.set(-5.0, -1.6, 0);
  g.add(shell);
  const surfQ: import('three').Mesh[] = [];
  const qGeo = bag.geo(new THREE.SphereGeometry(0.1, 10, 8));
  const qMat = bag.mat(new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  for (let i = 0; i < 40; i++) {
    const ph = Math.acos(2 * Math.random() - 1);
    const th = Math.random() * Math.PI * 2;
    const m = new THREE.Mesh(qGeo, qMat);
    m.position.set(
      -5.0 + 1.2 * Math.sin(ph) * Math.cos(th),
      -1.6 + 1.2 * Math.cos(ph),
      1.2 * Math.sin(ph) * Math.sin(th),
    );
    g.add(m);
    surfQ.push(m);
  }
  // 空腔内小电荷（静电屏蔽/电荷守恒示意：内腔电荷沿内壁迁移至外表面，壳外场不变）
  const cavityQ = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.16, 12, 10)),
    bag.mat(new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true })),
  );
  cavityQ.position.set(-5.0, -1.6, 0);
  g.add(cavityQ);

  g.add(panelSprite(THREE, bag, [
    { text: '库仑定律 F = kq₁q₂/r²（扭秤测得指数 2，1785）', color: '#f8fafc' },
    { text: '同色相斥：固定球与臂端球同为红(+q)（本族色约定 红=+、蓝=−）', color: '#94a3b8' },
    { text: '读数：扭角 θ ∝ F ∝ 1/d²，d 为固定球与臂端实时距离（1.4–2.8）', color: '#fbbf24' },
    { text: '静电屏蔽与守恒：空腔内小电荷迁至外表面（红点皆在壳面），总量不变', color: '#22c55e' },
  ], [0, 4.6, 0], 8.4, 'center'));

  return (t: number, dt: number) => {
    // 固定球沿 x 缓慢往复：与 ballR(x=2.1) 的距离 dx∈[1.2,2.6]（另有 z 偏移 0.9）
    const dx = 1.9 + 0.7 * Math.sin(t * 0.7);
    const d2 = dx * dx + 0.9 * 0.9;                  // d² = dx²+dz²（与几何同源）
    const F = 1 / d2;                                // F ∝ kq₁q₂/d²（q 固定 → 只随 d 变）
    const fMax = 1 / (1.2 * 1.2 + 0.81), fMin = 1 / (2.6 * 2.6 + 0.81);
    const target = 0.12 + 0.48 * (F - fMin) / (fMax - fMin);   // θ ∝ F：越近扭角越大
    fixed.position.set(2.1 + dx, 0.7, 0.9);
    // 扭秤：朝 F 决定的平衡角回弹（阻尼趋近 + 残余微振荡），不再与电荷位置脱钩
    const tau = target - armGroup.rotation.y;
    armGroup.rotation.y += (tau * 12 - armGroup.rotation.y * 2.5) * dt + Math.sin(t * 3.0) * 0.06 * dt;
    needle.rotation.z = armGroup.rotation.y * 1.6;
    // 表面电荷缓慢重排（趋肤）
    surfQ.forEach((m, i) => {
      const a = t * 0.4 + i;
      m.scale.setScalar(1 + 0.25 * Math.sin(a));
    });
    shell.rotation.y += dt * 0.2;
    // 空腔内电荷示意：向内壁漂移后被输运到外表面（近壳面时淡出 → 电荷只余表面）
    const cyc = (t * 0.25) % 2;
    const rr = cyc < 1 ? cyc * 1.0 : (2 - cyc) * 1.0;
    cavityQ.position.set(-5.0 + rr * 0.95, -1.6, 0);
    (cavityQ.material as import('three').MeshBasicMaterial).opacity = rr > 0.92 ? 0.15 : 0.9;
    void title;
  };
}

/** P304 涡流与电磁阻尼 / P482 法拉第定律与楞次方向（二次分支） */
function build_eddy(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const lenz = title.includes('楞次') || title.includes('法拉第定律');
  // 磁铁（N-S）
  const magnet = new THREE.Group();
  g.add(magnet);
  const nPole = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.5, 0.5, 1.4, 24)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 })),
  );
  nPole.position.y = 0.9;
  magnet.add(nPole);
  const sPole = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.5, 0.5, 1.4, 24)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.45 })),
  );
  sPole.position.y = -0.9;
  magnet.add(sPole);
  magnet.position.set(-1.0, 1.6, 0);
  // 导体板（涡流盘）
  const plate = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(3.6, 0.24, 3.0)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.35 })),
  );
  plate.position.set(-1.0, -1.6, 0);
  g.add(plate);
  // 涡流环（同心闭合环，感应电流）
  const eddyRings: import('three').Line[] = [];
  const ringBeads: import('three').Mesh[] = [];
  const beadGeo = bag.geo(new THREE.SphereGeometry(0.09, 10, 8));
  const beadMat = bag.mat(new THREE.MeshBasicMaterial({ color: 0x22c55e }));
  for (let i = 0; i < 4; i++) {
    const r = 0.5 + i * 0.42;
    const pts: import('three').Vector3[] = [];
    for (let k = 0; k <= 72; k++) {
      const a = (k / 72) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    const l = new THREE.Line(
      bag.geo(new THREE.BufferGeometry().setFromPoints(pts)),
      bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.9 })),
    );
    l.position.set(-1.0, -1.42, 0);
    g.add(l);
    eddyRings.push(l);
    // 方向珠：沿环公转，转向随感应电流方向（curDir）反向 → 让"环电流反转"可见
    const bead = new THREE.Mesh(beadGeo, beadMat);
    bead.userData['r'] = r;
    bead.position.set(-1.0 + r, -1.42, 0);
    g.add(bead);
    ringBeads.push(bead);
  }
  // 感应电流方向箭头（楞次：阻碍相对运动）
  const eddyArrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1.0, -1.3, 1.7), 1.6, PAL.green, 0.2, 0.1,
  );
  g.add(eddyArrow);
  // 铜管 + 缓落磁铁（阻尼分支专属）：磁铁在铜管里慢慢落 —— 涡流制动力 ∝ 速度 → 收尾速度
  const tube = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.55, 0.55, 4.6, 28, 1, true)),
    bag.mat(new THREE.MeshStandardMaterial({
      color: 0xf97316, metalness: 0.7, roughness: 0.35, transparent: true, opacity: 0.22,
      side: THREE.DoubleSide,
    })),
  );
  tube.position.set(-5.4, 0.2, 0);
  const fallMag = new THREE.Group();
  const fN = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.36, 0.36, 0.62, 20)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 })),
  );
  fN.position.y = 0.31;
  fallMag.add(fN);
  const fS = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.36, 0.36, 0.62, 20)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.45 })),
  );
  fS.position.y = -0.31;
  fallMag.add(fS);
  fallMag.position.set(-5.4, 2.2, 0);
  if (!lenz) { g.add(tube); g.add(fallMag); }   // 只在"涡流与电磁阻尼"分支显示（楞次分支画面归磁铁-铜板）
  // 阻尼摆（导体板在磁场中摆动 → 能量耗散）
  const pendArm = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.08, 3.4, 0.08)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.slate })),
  );
  pendArm.position.set(3.4, 0.4, 0);
  g.add(pendArm);
  const pendBob = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(1.1, 0.2, 1.0)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.4 })),
  );
  pendBob.position.set(3.4, -1.4, 0);
  g.add(pendBob);
  // 摆片下方的固定磁铁：铜摆片掠过气隙 → 涡流阻尼（摆动衰减有因可循）
  const pGap = new THREE.Group();
  const pN = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.26, 0.26, 0.56, 18)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 })),
  );
  pN.position.y = 0.3;
  pGap.add(pN);
  const pS = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.26, 0.26, 0.56, 18)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.45 })),
  );
  pS.position.y = -0.3;
  pGap.add(pS);
  pGap.position.set(3.4, -2.3, 0);
  g.add(pGap);

  g.add(panelSprite(THREE, bag, lenz ? [
    { text: '法拉第定律 ε = −dΦ_B/dt（负号即楞次定律：感应电流阻碍变化）', color: '#f8fafc' },
    { text: '磁铁靠近 → Φ↑ → 感应磁场反向 → 排斥；远离 → 吸引', color: '#94a3b8' },
    { text: '正方向约定：面元法向按右手螺旋定，−dΦ/dt 定 ε 正向；Φ(x) 在固定环心上方最大', color: '#06b6d4' },
    { text: '读数：青/橙环 = 感应电流方向，由 dΦ/dt=Φ′(x)·v 定——靠近/越过环心/折返时反号', color: '#22c55e' },
  ] : [
    { text: '涡流：块状导体中感应出闭合电流环，焦耳热 P = ε²/R', color: '#f8fafc' },
    { text: '电磁阻尼：安培力反向阻碍运动 → 摆幅指数衰减；磁铁在铜管中匀速缓落（终端速度）', color: '#94a3b8' },
    { text: '读数：磁铁越贴近铜板（气隙越小）涡流越强；摆片掠过磁铁气隙被阻尼', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.4, 'center'));

  let swing = 1.1;
  let curDir = 1;   // 感应电流方向符号（楞次：随磁铁速度反向）
  return (t: number, dt: number) => {
    if (lenz) {
      // 磁铁在"固定于板心的环"上方水平往复：Φ(x)≈Φ₀e^{−k(mx−ringX)²} 在环心处取极大
      const ringX = -1.0;
      const mx = ringX + Math.sin(t * 1.6) * 2.4;
      magnet.position.set(mx, 1.6, 0);
      magnet.rotation.z = 0;
      // 感应电流方向由 dΦ/dt = Φ′(x)·v 定：sign(−dΦ/dt) = sign((mx−ringX)·v)
      // → 磁铁靠近固定环（Φ↑）与远离（Φ↓）时反号；越过环心/折返处均反转
      const v = Math.cos(t * 1.6);   // ∝ d(mx)/dt
      curDir = (mx - ringX) * v >= 0 ? 1 : -1;
      // 安培力阻碍相对运动：靠近→排斥、远离→吸引，恒有 F ∝ −v
      const fv = v >= 0 ? -1 : 1;
      eddyArrow.setDirection(new THREE.Vector3(fv, 0, 0));
      eddyArrow.setLength(1.4, 0.2, 0.1);
      eddyArrow.position.set(mx - 0.8, -1.3, 1.7);
      // 环固定在板上（不跟磁铁平移）：eddyRings.position.x 保持初始 −1.0
    } else {
      // 磁铁在铜板上方扫过并起伏靠近/远离 → 涡流强弱按磁铁-板实时距离计算
      const mx = -1.0 + Math.sin(t * 0.9) * 2.6;
      const my = 1.6 - 0.9 * (0.5 + 0.5 * Math.sin(t * 0.7));
      magnet.position.set(mx, my, 0);
      const gap = my - 0.12;   // 磁铁下端（my − 1.6）到板面（y = −1.48）的气隙
      const near = Math.exp(-((mx + 1.0) ** 2) / 6 - (gap * gap) / 2);
      eddyArrow.position.set(mx - 0.8, -1.3, 1.7);
      eddyRings.forEach((r, i) => {
        r.position.x = mx;
        const m = r.material as import('three').LineBasicMaterial;
        m.opacity = 0.12 + 0.75 * near * (0.6 + 0.4 * Math.sin(t * 4 + i));
      });
      // 铜管中的磁铁匀速缓落（涡流制动力 ∝ 速度 → 收尾速度，非自由落体），落底后循环
      const fallSpan = 4.0;
      const fallY = 2.2 - ((t * 0.55) % fallSpan);
      fallMag.position.y = fallY;
      const vRel = 0.55;   // 收尾速度（恒定 → 制动力与重力平衡）
      eddyArrow.setLength(1.0 + vRel * 0.8, 0.2, 0.1);
    }
    // 涡流环脉动（电流交变）；楞次分支：环颜色随感应电流方向切换（反向）
    let beadPhase = 0;
    eddyRings.forEach((r, i) => {
      const m = r.material as import('three').LineBasicMaterial;
      if (lenz) {
        m.opacity = 0.35 + 0.6 * Math.abs(Math.cos(t * 2 + i * 0.6));
        m.color.setHex(curDir >= 0 ? PAL.cyan : 0xf59e0b);
      }
      r.scale.setScalar(1 + 0.03 * Math.sin(t * 3 + i));
    });
    // 方向珠沿环公转，角速度符号 = 感应电流方向（lenz 随磁铁反向；eddy 恒定）
    beadPhase = (lenz ? curDir : 1) * t * 2.2;
    ringBeads.forEach((b, i) => {
      const r = b.userData['r'] as number;
      const a = beadPhase + i * 0.5;
      const cx = eddyRings[i].position.x;
      b.position.set(cx + Math.cos(a) * r, -1.42, Math.sin(a) * r);
      b.scale.setScalar(lenz ? 0.9 + 0.4 * Math.abs(curDir) : 1);
      (b.material as import('three').MeshBasicMaterial).color.setHex(
        lenz && curDir < 0 ? 0xf59e0b : 0x22c55e,
      );
    });
    // 阻尼摆（在阻尼模式下摆幅衰减；楞次模式下持续摆动）
    const gamma = lenz ? 0.05 : 0.5;
    swing *= Math.exp(-gamma * dt);
    if (swing < 0.08) swing = lenz ? 1.1 : 1.1;
    pendArm.rotation.z = swing * Math.sin(t * 2.6);
    pendBob.rotation.z = pendArm.rotation.z;
  };
}

/** P302 法拉第圆盘发电机：旋转铜盘 + 径向电流 + ε = ½BL²ω */
function build_fardisk(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 铜盘
  const disk = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(2.6, 2.6, 0.16, 56)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.75, roughness: 0.3 })),
  );
  disk.position.y = -1.0;
  g.add(disk);
  // 边缘电刷 + 中心电刷
  const brushEdge = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.3, 0.6, 0.3)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.slate, metalness: 0.6, roughness: 0.4 })),
  );
  brushEdge.position.set(2.6, -0.6, 0);
  g.add(brushEdge);
  const brushCenter = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.14, 0.14, 1.2, 14)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.slate, metalness: 0.6, roughness: 0.4 })),
  );
  brushCenter.position.set(0, -0.4, 0);
  g.add(brushCenter);
  // 磁场（竖直向上，箭头）
  const fieldArrows: import('three').ArrowHelper[] = [];
  for (let i = 0; i < 5; i++) {
    const a = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.cos((i / 5) * 6.28) * 1.7, -2.6, Math.sin((i / 5) * 6.28) * 1.7), 1.4, PAL.blue, 0.18, 0.09,
    );
    g.add(a);
    fieldArrows.push(a);
  }
  // 径向电流（盘内从中心 → 边缘，v×B 驱动）
  const radial: import('three').Line[] = [];
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const l = new THREE.Line(
      bag.geo(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -1.0, 0),
        new THREE.Vector3(Math.cos(ang) * 2.5, -1.0, Math.sin(ang) * 2.5),
      ])),
      bag.mat(new THREE.LineBasicMaterial({ color: PAL.green, transparent: true, opacity: 0.8 })),
    );
    g.add(l);
    radial.push(l);
  }
  // 外接回路（灯泡）
  const bulb = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.34, 20, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xfde68a, emissive: 0xf59e0b, emissiveIntensity: 0.4, transparent: true, opacity: 0.9 })),
  );
  bulb.position.set(4.4, 0.4, 0);
  g.add(bulb);
  const wirePts: import('three').Vector3[] = [
    new THREE.Vector3(2.6, -0.4, 0),
    new THREE.Vector3(4.4, -0.4, 0),
    new THREE.Vector3(4.4, 0.7, 0),
    new THREE.Vector3(0, 0.7, 0),
    new THREE.Vector3(0, 0.4, 0),
  ];
  g.add(new THREE.Line(
    bag.geo(new THREE.BufferGeometry().setFromPoints(wirePts)),
    bag.mat(new THREE.LineBasicMaterial({ color: 0x64748b })),
  ));
  // 旋转手柄
  const handle = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.16, 1.4, 0.16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.slate })),
  );
  handle.position.set(1.6, -0.2, 0);
  g.add(handle);

  g.add(panelSprite(THREE, bag, [
    { text: '法拉第圆盘：ε = ½BL²ω（盘上各段动生电动势串联）', color: '#f8fafc' },
    { text: '自由电子受 v×B 沿径向漂移 → 中心与边缘形成电势差', color: '#94a3b8' },
    { text: '读数：ω 越大 ε 越大；电流方向由 v×B 定（右手定则）', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.4, 'center'));

  return (t: number, dt: number) => {
    const omega = 3.0 + 1.6 * (Math.sin(t * 0.5) * 0.5 + 0.5);
    disk.rotation.y += dt * omega;
    handle.rotation.y = disk.rotation.y;
    handle.position.x = Math.cos(disk.rotation.y) * 1.6;
    handle.position.z = Math.sin(disk.rotation.y) * 1.6;
    // 径向电流线随盘转动
    radial.forEach((l) => { l.rotation.y = disk.rotation.y; });
    // 灯泡亮度 ∝ ε = ½BL²ω
    const eps = omega * 0.35;
    (bulb.material as import('three').MeshStandardMaterial).emissiveIntensity = 0.3 + eps * 1.4;
    fieldArrows.forEach((a) => a.setLength(1.2 + 0.25 * Math.sin(t * 2), 0.18, 0.09));
    void title;
  };
}

/** P481 柱对称高斯定理 / P92 高斯定律（二次分支） */
function build_gauss(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const cylinder = title.includes('柱') || title.includes('柱对称');
  // 中心线电荷（柱）或点电荷（球）
  if (cylinder) {
    const rod = new THREE.Mesh(
      bag.geo(new THREE.CylinderGeometry(0.18, 0.18, 5.6, 24)),
      bag.mat(new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.5 })),
    );
    g.add(rod);
    // 高斯柱面（半径可调）
    const gaussCyl = new THREE.Mesh(
      bag.geo(new THREE.CylinderGeometry(1.9, 1.9, 5.2, 40, 1, true)),
      bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.3, side: THREE.DoubleSide, wireframe: true })),
    );
    g.add(gaussCyl);
    // 径向场线（柱对称 → 沿径向均匀放射）
    const radials: import('three').Line[] = [];
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      const l = new THREE.Line(
        bag.geo(new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(Math.cos(ang) * 0.3, 0, Math.sin(ang) * 0.3),
          new THREE.Vector3(Math.cos(ang) * 3.4, 0, Math.sin(ang) * 3.4),
        ])),
        bag.mat(new THREE.LineBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.8 })),
      );
      g.add(l);
      radials.push(l);
    }
    // E 箭头（从高斯面指向外）
    const eArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(1.9, 2.0, 0), 1.4, PAL.green, 0.2, 0.1,
    );
    g.add(eArrow);
    g.add(panelSprite(THREE, bag, [
      { text: '柱对称高斯面：∮E·dA = E·2πrh = λh/ε₀ → E = λ/(2πε₀r)', color: '#f8fafc' },
      { text: 'E ∝ 1/r（与线电荷密度 λ 有关，与高度无关）', color: '#94a3b8' },
      { text: '读数：高斯柱侧面通量 Φ = E·S = λh/ε₀（上下底通量为 0）', color: '#fbbf24' },
    ], [0, 4.6, 0], 8.4, 'center'));
    return (t: number, dt: number) => {
      gaussCyl.rotation.y += dt * 0.2;
      radials.forEach((l, i) => {
        const m = l.material as import('three').LineBasicMaterial;
        m.opacity = 0.5 + 0.4 * Math.sin(t * 3 + i * 0.4);
      });
      eArrow.setLength(1.4 + 0.3 * Math.sin(t * 2), 0.2, 0.1);
      void t;
    };
  }
  // 球对称高斯定律（P92）
  const pointCharge = chargeBall(g, bag, THREE, 0, 0, 0, 0.4, true);
  const gaussSphere = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(2.4, 40, 28)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.22, wireframe: true })),
  );
  g.add(gaussSphere);
  // 径向场线
  const starts: import('three').Vector3[] = [];
  for (let i = 0; i < 24; i++) {
    const ph = Math.acos(1 - 2 * (i + 0.5) / 24);
    const th = Math.PI * (1 + Math.sqrt(5)) * i;
    starts.push(new THREE.Vector3(
      Math.sin(ph) * Math.cos(th) * 0.55,
      Math.cos(ph) * 0.55,
      Math.sin(ph) * Math.sin(th) * 0.55,
    ));
  }
  const lines = integrateLines(THREE, [{ x: 0, y: 0, z: 0, q: 1 }], starts, 0.2, 90);
  addLines(g, bag, THREE, lines, PAL.gold, 0.7);
  // 通量箭头
  const fluxArrows: import('three').ArrowHelper[] = [];
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    const a = new THREE.ArrowHelper(dir, dir.clone().multiplyScalar(2.4), 1.3, PAL.green, 0.2, 0.1);
    g.add(a);
    fluxArrows.push(a);
  }
  g.add(panelSprite(THREE, bag, [
    { text: '高斯定律 ∮E·dA = Q_enc/ε₀（仅与包围电荷有关）', color: '#f8fafc' },
    { text: '球对称 → E·4πr² = q/ε₀ → E = q/(4πε₀r²)（库仑平方反比）', color: '#94a3b8' },
    { text: '读数：外部电荷对净通量贡献为 0；总通量只由内部电荷决定、与半径 r 无关', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.4, 'center'));
  return (t: number, dt: number) => {
    gaussSphere.rotation.y += dt * 0.15;
    (pointCharge.material as import('three').MeshStandardMaterial).emissiveIntensity = 0.4 + 0.3 * Math.sin(t * 3);
    fluxArrows.forEach((a, i) => a.setLength(1.1 + 0.3 * Math.sin(t * 2 + i), 0.2, 0.1));
  };
}

/** P95 镜像电荷：导体平面 + 点电荷 + 镜像电荷 → 表面感应电荷与场 */
function build_imagecharge(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 接地导体：画成半空间实体（顶面 y = -1.4 即镜像面，向下延伸），像电荷位于导体内部
  const surfaceY = -1.4;
  const plane = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(9.0, 3.6, 5.4)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.35, transparent: true, opacity: 0.42 })),
  );
  plane.position.y = surfaceY - 1.8;
  g.add(plane);
  // 真实点电荷（+q，用 Group 承载以便连同 ± 标记一起移动）
  const realG = new THREE.Group();
  g.add(realG);
  chargeBall(realG, bag, THREE, -1.6, 1.4, 0, 0.4, true);
  // 镜像电荷（−q，导体内部、关于上表面对称；半透明表示它是虚构电荷）
  const imageG = new THREE.Group();
  g.add(imageG);
  const image = chargeBall(imageG, bag, THREE, -1.6, surfaceY - (1.4 - surfaceY), 0, 0.4, false);
  const imageMat = image.material as import('three').MeshStandardMaterial;
  imageMat.transparent = true;
  imageMat.opacity = 0.6;
  // 场线（只存在于导体外，终止于导体表面且 ⊥ 表面）
  const starts: import('three').Vector3[] = [];
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2;
    starts.push(new THREE.Vector3(-1.6 + Math.cos(ang) * 0.55, 1.4 + Math.sin(ang) * 0.55, 0));
  }
  const charges = [
    { x: -1.6, y: 1.4, z: 0, q: 1.0 },
    { x: -1.6, y: -4.2, z: 0, q: -1.0 },
  ];
  // 共用一份材质：重建时只新建/释放 geometry
  const lineMat = bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.8 }));
  let lineObjs: import('three').Line[] = [];
  let acc = 0;
  const rebuild = () => {
    lineObjs.forEach((l) => {
      g.remove(l);
      l.geometry.dispose();
    });
    lineObjs = integrateLines(THREE, charges, starts, 0.16, 140, surfaceY).map((pts) => {
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat);
      g.add(l);
      return l;
    });
  };
  rebuild();
  // 感应电荷（导体表面）
  const indQ: import('three').Mesh[] = [];
  const qGeo = bag.geo(new THREE.SphereGeometry(0.12, 10, 8));
  const qMat = bag.mat(new THREE.MeshBasicMaterial({ color: 0x3b82f6 }));
  for (let i = 0; i < 22; i++) {
    const m = new THREE.Mesh(qGeo, qMat);
    m.position.set(-1.6 + (Math.random() - 0.5) * 4.4, -1.28, (Math.random() - 0.5) * 3.6);
    g.add(m);
    indQ.push(m);
  }
  // 垂直标记（场线 ⊥ 导体面）
  const perpMark = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(1.4, 0.06, 0.06)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold })),
  );
  perpMark.position.set(-1.6, -1.34, 1.4);
  g.add(perpMark);

  g.add(panelSprite(THREE, bag, [
    { text: '镜像法：以 −q 于导体内部对称位置替代导体，使表面恰为等势面', color: '#f8fafc' },
    { text: '像电荷为虚构（不计入真实电荷），上半空间场线止于表面且 ⊥ 表面', color: '#94a3b8' },
    { text: '读数：吸引 F = kq²/(2d)²；感应电荷集中在 q 正下方（青点）', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.4, 'center'));

  return (t: number, dt: number) => {
    // 真实电荷上下移动 → 像电荷按镜像同步跟随（关于 y = surfaceY 对称）
    const y = 1.4 + 0.4 * Math.sin(t * 1.1);
    realG.position.y = y - 1.4;
    imageG.position.y = 1.4 - y;                 // = −(y − 1.4)，精确镜像
    charges[0].y = y;
    charges[1].y = 2 * surfaceY - y;
    indQ.forEach((m, i) => {
      const near = Math.exp(-((m.position.x - (-1.6)) ** 2) / 3.2);
      m.scale.setScalar(0.4 + near * 1.4 * (0.7 + 0.3 * Math.sin(t * 4 + i)));
    });
    // 场线随电荷位置节流重建（每 ~0.08 s）
    acc += dt;
    if (acc > 0.08) {
      acc = 0;
      rebuild();
    }
    perpMark.rotation.y = Math.sin(t * 0.6) * 0.1;
  };
}

/** P441 磁偶极与磁矩：环形电流 + 磁场线 + 磁矩箭头 */
function build_magdipole(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 载流圆环
  const ring = new THREE.Mesh(
    bag.geo(new THREE.TorusGeometry(1.8, 0.09, 12, 72)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.6, roughness: 0.35 })),
  );
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  // 磁矩箭头 m（沿轴）
  const mArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1.6, 0), 3.2, PAL.gold, 0.26, 0.13,
  );
  g.add(mArrow);
  // 磁场线（从 N 出 S 入的闭合环）
  const fieldLines: import('three').Line[] = [];
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const pts: import('three').Vector3[] = [];
    for (let k = 0; k <= 60; k++) {
      const u = k / 60;
      const th = u * Math.PI * 2;
      const R = 2.4 + Math.abs(Math.cos(th)) * 0.6;
      const y = Math.sin(th) * (2.6 + (i % 3) * 0.6);
      const r = R * Math.abs(Math.cos(th)) + 0.4;
      pts.push(new THREE.Vector3(Math.cos(ang) * r * Math.sign(Math.cos(th) || 1), y, Math.sin(ang) * r * Math.sign(Math.cos(th) || 1)));
    }
    const l = new THREE.Line(
      bag.geo(new THREE.BufferGeometry().setFromPoints(pts)),
      bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.75 })),
    );
    g.add(l);
    fieldLines.push(l);
  }
  // 电流方向小箭头（沿环）。手性约定：m = ½∮ r×dl，r=(Rcosφ,0,Rsinφ)、dl∝(sinφ,0,−cosφ)
  // → r×dl ∝ +ŷ，与金箭头 mArrow(+y) 一致（"方向由右手螺旋定"在画面内自洽）
  const iArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, -1), new THREE.Vector3(1.8, 0, 0), 0.6, PAL.red, 0.14, 0.07,
  );
  g.add(iArrow);

  // 右侧：外均匀磁场 B（竖直）+ 受 m×B 力矩进动的磁矩（演示"能量与力矩 / 进动、磁势能"）
  const extB = new THREE.Group();
  extB.position.set(5.6, -0.4, 0);
  g.add(extB);
  const bArrows: import('three').ArrowHelper[] = [];
  for (let i = 0; i < 3; i++) {
    const a = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1.0 + i * 1.0, -1.8, 0), 3.2, PAL.blue, 0.18, 0.09,
    );
    extB.add(a);
    bArrows.push(a);
  }
  // 进动的磁矩箭头（初始偏离 B 轴，因 τ = m×B 绕 B 进动）
  const precArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0.6, 0.8, 0).normalize(), new THREE.Vector3(0, -0.4, 0), 2.4, PAL.gold, 0.22, 0.11,
  );
  extB.add(precArrow);
  // 进动圆锥顶点（磁矩尖端轨迹参考点）
  const precTip = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.1, 10, 8)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold })),
  );
  extB.add(precTip);
  // 能量读数条：U = −m·B = −mB·cosθ（越低越稳定，θ=0 对齐最低）
  const uBar = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.5, 1.0, 0.5)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold })),
  );
  uBar.position.set(1.7, -1.8, 0);
  extB.add(uBar);

  g.add(panelSprite(THREE, bag, [
    { text: '磁矩 m = IA（面积矢量，方向由右手螺旋定），B 轴上 = μ₀m/2πz³', color: '#f8fafc' },
    { text: '磁偶极远场 B ∝ 1/r³，与电偶极远场 E ∝ 1/r³ 形式相同（类比）', color: '#94a3b8' },
    { text: '力矩 τ = m×B ⊥ m → 磁矩绕 B 进动（右）；势能 U = −m·B·cosθ，条越低越稳', color: '#fbbf24' },
    { text: '指南针原理：磁矩趋向与地磁场对齐；U 最小在 θ=0（对齐），最大在 θ=180°', color: '#22c55e' },
  ], [0, 4.6, 0], 8.4, 'center'));

  return (t: number, dt: number) => {
    ring.rotation.z += dt * 0.5;
    // 稳恒电流的磁场是静场：磁感线形状固定、不自转，只做亮度脉动
    fieldLines.forEach((l, i) => {
      const m = l.material as import('three').LineBasicMaterial;
      m.opacity = 0.5 + 0.3 * Math.sin(t * 2 + i * 0.7);
    });
    const ph = t * 3;
    iArrow.position.set(Math.cos(ph) * 1.8, 0, Math.sin(ph) * 1.8);
    // 逆行切向（−d r/dφ）→ 环流绕行使 ½∮r×dl 沿 +y，与 mArrow 同向（右手螺旋）
    iArrow.setDirection(new THREE.Vector3(Math.sin(ph), 0, -Math.cos(ph)));
    mArrow.setLength(3.0 + 0.3 * Math.sin(t * 1.4), 0.26, 0.13);
    // 磁矩绕外场 B 进动：θ 极角缓慢章动，方位角 φ 匀速 → τ = m×B 使 m 绕 B 旋转
    const theta = 0.9 + 0.5 * Math.sin(t * 0.8);
    const phi = t * 2.0;
    const mDir = new THREE.Vector3(
      Math.sin(theta) * Math.cos(phi),
      Math.cos(theta),
      Math.sin(theta) * Math.sin(phi),
    ).normalize();
    precArrow.setDirection(mDir);
    precArrow.setLength(2.2, 0.22, 0.11);
    precTip.position.set(mDir.x * 2.2, -0.4 + mDir.y * 2.2, mDir.z * 2.2);
    // 能量读数条：U = −m·B = −mB·cosθ（对齐 θ=0 最低，反平行 θ=180° 最高）
    const uNorm = (1 - Math.cos(theta)) / 2;   // 0（对齐）→ 1（反平行）
    uBar.scale.y = 0.15 + uNorm * 1.5;
    uBar.position.y = -1.8 + (uBar.scale.y * 1.0) / 2;
    (uBar.material as import('three').MeshBasicMaterial).color.setHex(
      Math.cos(theta) >= 0 ? 0x22c55e : 0xef4444,
    );
    bArrows.forEach((a, i) => a.setLength(3.0 + 0.2 * Math.sin(t * 2 + i), 0.18, 0.09));
  };
}

/** P484 电势的多极展开：单极/偶极/四极项逐级叠加 */
function build_multipole(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 四枚电荷：标准四极排布（方形交错，同 build_quadrupole），经重推导 Σq=0 且 p=Σqᵢrᵢ=0
  const setA = chargeBall(g, bag, THREE, 2.4, 2.4, 0, 0.36, true);
  const setB = chargeBall(g, bag, THREE, -2.4, -2.4, 0, 0.36, true);
  const setC = chargeBall(g, bag, THREE, -2.4, 2.4, 0, 0.36, false);
  const setD = chargeBall(g, bag, THREE, 2.4, -2.4, 0, 0.36, false);

  // —— 逐级展开：把同一源拆成 单极 → +偶极 → +四极 三组线，按 t 循环叠加 ——
  // 单极项：Σq 的等效点电荷（此源 Σq=0，故用一个淡参考球示意"若 Σq≠0 的 1/r 径向场"）
  const monoStarts: import('three').Vector3[] = [];
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2;
    monoStarts.push(new THREE.Vector3(Math.cos(ang) * 0.45, Math.sin(ang) * 0.45, 0));
  }
  const monoLines = addLines(
    g, bag, THREE,
    integrateLines(THREE, [{ x: 0, y: 0, z: 0, q: 1.0 }], monoStarts, 0.18, 70),
    PAL.gold, 0.75,
  );
  // 偶极项参考形：±q 沿 x 轴的 1/r² 偶极场线（仅示意该项形状；本源 p=Σqᵢrᵢ=0，偶极项实际消失，无自身方向可对照）
  const dipStarts: import('three').Vector3[] = [];
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    dipStarts.push(new THREE.Vector3(-1.1 + Math.cos(ang) * 0.4, Math.sin(ang) * 0.4, 0));
  }
  const dipLines = addLines(
    g, bag, THREE,
    integrateLines(THREE, [
      { x: -1.1, y: 0, z: 0, q: 1.0 },
      { x: 1.1, y: 0, z: 0, q: -1.0 },
    ], dipStarts, 0.16, 110),
    PAL.cyan, 0.75,
  );
  // 四极项：实际四电荷源 = 方形交错标准四极（Σq=0、p=0、Q≠0 → 远场由四极项主导，φ∝1/r³）
  const quadStarts: import('three').Vector3[] = [];
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    // 场线自对角两正电荷 (2.4,2.4)、(−2.4,−2.4) 发出，汇入对角两负电荷
    quadStarts.push(new THREE.Vector3(2.4 + Math.cos(ang) * 0.5, 2.4 + Math.sin(ang) * 0.5, 0));
    quadStarts.push(new THREE.Vector3(-2.4 + Math.cos(ang) * 0.5, -2.4 + Math.sin(ang) * 0.5, 0));
  }
  const quadCharges = [
    { x: 2.4, y: 2.4, z: 0, q: 1.0 },
    { x: -2.4, y: -2.4, z: 0, q: 1.0 },
    { x: -2.4, y: 2.4, z: 0, q: -1.0 },
    { x: 2.4, y: -2.4, z: 0, q: -1.0 },
  ];
  const quadLines = addLines(
    g, bag, THREE,
    integrateLines(THREE, quadCharges, quadStarts, 0.16, 130),
    PAL.green, 0.75,
  );

  // 近/远两个 φ 探针点 + 读数（近处各阶都显著；远处只剩衰减最慢的存活项——本源为四极项 1/r³）
  const shell = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(2.0, 32, 20)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.slate, transparent: true, opacity: 0.14, wireframe: true })),
  );
  g.add(shell);
  const nearPt = new THREE.Vector3(2.4, 1.6, 0);
  const farPt = new THREE.Vector3(6.4, 3.4, 0);
  const phiOf = (p: import('three').Vector3): number => {
    let s = 0;
    for (const c of quadCharges) {
      s += c.q / Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z);
    }
    return s;
  };
  // 动态读数画布：φ(近)、φ(远) + 当前叠加阶数
  const readCv = document.createElement('canvas');
  readCv.width = 420; readCv.height = 150;
  const rc = readCv.getContext('2d')!;
  const readTex = bag.tex(new THREE.CanvasTexture(readCv));
  const readLabel = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(4.0, 1.43)),
    bag.mat(new THREE.MeshBasicMaterial({ map: readTex, transparent: true, depthTest: false })),
  );
  readLabel.position.set(5.4, -2.4, 0);
  readLabel.renderOrder = 997;
  g.add(readLabel);

  // 电势项标签（单极/偶极/四极）
  const labelCv = document.createElement('canvas');
  labelCv.width = 560; labelCv.height = 260;
  const lc = labelCv.getContext('2d')!;
  lc.fillStyle = 'rgba(7,11,20,0.82)';
  lc.fillRect(0, 0, 560, 260);
  lc.fillStyle = '#f8fafc'; lc.font = 'bold 26px sans-serif';
  lc.fillText('多极展开 φ(r) = kq/r + k p·r̂/r²', 24, 44);
  lc.fillStyle = '#94a3b8'; lc.font = '22px sans-serif';
  lc.fillText('+ (1/3) k ΣQᵢ(3cos²θ−1)/r³ + …', 24, 84);
  lc.fillStyle = '#f59e0b';
  lc.fillText('① 单极项 ∝ 1/r（金=径向参考形；本源 Σq=0 → 消失）', 24, 132);
  lc.fillStyle = '#06b6d4';
  lc.fillText('② 偶极项 ∝ 1/r²（青=参考形；本源 p=0 → 消失）', 24, 172);
  lc.fillStyle = '#22c55e';
  lc.fillText('③ 四极项 ∝ 1/r³（绿=真实源场线，Q≠0 主导远场）', 24, 212);
  const labelTex = bag.tex(new THREE.CanvasTexture(labelCv));
  const label = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(5.0, 2.32)),
    bag.mat(new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, depthTest: false })),
  );
  label.position.set(4.6, 3.4, 0);
  label.renderOrder = 997;
  g.add(label);

  g.add(panelSprite(THREE, bag, [
    { text: '多极展开：φ = 单极(1/r) + 偶极(p·r̂/r²) + 四极(/r³) + …', color: '#f8fafc' },
    { text: '把复杂源逐级拆成可算的壳：本源 Σq=0 且 p=0 而 Q≠0 → 单极、偶极项皆消失，四极项主导远场（φ∝1/r³）', color: '#94a3b8' },
    { text: '读数：随叠加阶数升高（金→青→绿）逐层剥离，近处 φ 变化大；远处只剩四极项（金/青为参考形）', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.4, 'center'));

  const setMats = (set: import('three').Line[], op: number) =>
    set.forEach((l) => { (l.material as import('three').LineBasicMaterial).opacity = op; });

  return (t: number, dt: number) => {
    // 阶数循环：0 单极 → 1 +偶极 → 2 +四极（每阶 ~2.2 s）
    const stage = Math.floor((t % 6.6) / 2.2);   // 0,1,2
    setMats(monoLines, 0.7);   // 单极项始终作为基准层
    setMats(dipLines, stage >= 1 ? 0.72 : 0.0);
    setMats(quadLines, stage >= 2 ? 0.72 : 0.0);
    // 壳半径随阶数变化（拆得越细，有效"壳"越贴近源）
    const shellR = [3.0, 2.2, 1.5][stage];
    shell.scale.setScalar(shellR / 2.0);
    (shell.material as import('three').MeshBasicMaterial).color.setHex(
      [PAL.gold, PAL.cyan, PAL.green][stage],
    );
    // φ 读数（近/远），体现"四极项 φ∝1/r³，远处数值迅速变小"
    const phiNear = phiOf(nearPt);
    const phiFar = phiOf(farPt);
    rc.clearRect(0, 0, 420, 150);
    rc.fillStyle = 'rgba(7,11,20,0.8)'; rc.fillRect(0, 0, 420, 150);
    rc.font = 'bold 24px sans-serif'; rc.fillStyle = '#f8fafc';
    rc.fillText(['① 单极', '② +偶极', '③ +四极'][stage], 20, 36);
    rc.font = '22px sans-serif'; rc.fillStyle = '#fbbf24';
    rc.fillText(`φ(近 r≈2.9) = ${phiNear.toFixed(2)}`, 20, 78);
    rc.fillStyle = '#94a3b8';
    rc.fillText(`φ(远 r≈7.3) = ${phiFar.toFixed(3)}`, 20, 118);
    readTex.needsUpdate = true;
    // 两对同号电荷沿各自对角线反向呼吸：反演对称保持 Σq=0、p≡0，只让四极矩强度振荡
    const amp = 0.3 * Math.sin(t * 0.9);
    setA.position.set(2.4 + amp, 2.4 + amp, 0);
    setB.position.set(-2.4 - amp, -2.4 - amp, 0);
    setC.position.set(-2.4 + amp, 2.4 - amp, 0);
    setD.position.set(2.4 - amp, -2.4 + amp, 0);
    setA.rotation.y += dt;
    setB.rotation.y -= dt;
  };
}

/** P93 电势与等势面：点电荷等势面 + 电场线 + 势能谷 */
function build_potential(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const q = chargeBall(g, bag, THREE, 0, 0, 0, 0.42, true);
  // 等势球壳（同心）
  const shells: import('three').Mesh[] = [];
  for (let k = 1; k <= 4; k++) {
    const r = 0.9 + k * 0.85;
    const s = new THREE.Mesh(
      bag.geo(new THREE.SphereGeometry(r, 40, 26)),
      bag.mat(new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.55 - k * 0.1, 0.7, 0.55).getHex(),
        transparent: true, opacity: 0.16, wireframe: k % 2 === 0, side: THREE.DoubleSide,
      })),
    );
    g.add(s);
    shells.push(s);
  }
  // 电场线（垂直于等势面）
  const starts: import('three').Vector3[] = [];
  for (let i = 0; i < 20; i++) {
    const ph = Math.acos(1 - 2 * (i + 0.5) / 20);
    const th = Math.PI * (1 + Math.sqrt(5)) * i;
    starts.push(new THREE.Vector3(
      Math.sin(ph) * Math.cos(th) * 0.6, Math.cos(ph) * 0.6, Math.sin(ph) * Math.sin(th) * 0.6,
    ));
  }
  const lines = integrateLines(THREE, [{ x: 0, y: 0, z: 0, q: 1 }], starts, 0.2, 80);
  addLines(g, bag, THREE, lines, PAL.gold, 0.7);
  // 探测电荷（沿等势面移动，势能不变）
  const probe = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.2, 16, 12)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.green, emissive: 0x15803d, emissiveIntensity: 0.6 })),
  );
  g.add(probe);

  g.add(panelSprite(THREE, bag, [
    { text: '电势 φ = kq/r，等势面与电场线处处正交（E = −∇φ）', color: '#f8fafc' },
    { text: '沿等势面移动电荷不做功：W = qΔφ = 0', color: '#94a3b8' },
    { text: '读数：ΔV = kq(1/r₁ − 1/r₂)；同心球面 = 等势面', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.4, 'center'));

  return (t: number, dt: number) => {
    shells.forEach((s, i) => {
      const m = s.material as import('three').MeshBasicMaterial;
      m.opacity = 0.1 + 0.1 * (0.5 + 0.5 * Math.sin(t * 1.5 + i));
      s.rotation.y += dt * (0.1 + i * 0.05);
    });
    // 探测电荷沿固定半径球面运动（r 恒定 → 始终落在 r = 2.6 的等势壳上，W = qΔφ = 0）
    const ph = t * 1.3;
    const th = 1.0 + 0.5 * Math.sin(t * 0.7);
    const r = 2.6;
    probe.position.set(
      r * Math.sin(th) * Math.cos(ph),
      r * Math.cos(th),
      r * Math.sin(th) * Math.sin(ph),
    );
    (q.material as import('three').MeshStandardMaterial).emissiveIntensity = 0.45 + 0.3 * Math.sin(t * 2);
    void title;
  };
}

/** P96 四极场：四电荷排布 + 双曲场线 */
function build_quadrupole(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 四个电荷（±交替）
  const qs = [
    chargeBall(g, bag, THREE, 2.4, 2.4, 0, 0.4, true),
    chargeBall(g, bag, THREE, -2.4, -2.4, 0, 0.4, true),
    chargeBall(g, bag, THREE, -2.4, 2.4, 0, 0.4, false),
    chargeBall(g, bag, THREE, 2.4, -2.4, 0, 0.4, false),
  ];
  // 场线
  const starts: import('three').Vector3[] = [];
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    starts.push(new THREE.Vector3(2.4 + Math.cos(ang) * 0.55, 2.4 + Math.sin(ang) * 0.55, 0));
    starts.push(new THREE.Vector3(-2.4 + Math.cos(ang) * 0.55, -2.4 + Math.sin(ang) * 0.55, 0));
  }
  const charges = [
    { x: 2.4, y: 2.4, z: 0, q: 1.0 },
    { x: -2.4, y: -2.4, z: 0, q: 1.0 },
    { x: -2.4, y: 2.4, z: 0, q: -1.0 },
    { x: 2.4, y: -2.4, z: 0, q: -1.0 },
  ];
  const lines = integrateLines(THREE, charges, starts, 0.14, 150);
  addLines(g, bag, THREE, lines, PAL.cyan, 0.75);
  // 双曲参考曲线（真双曲线 x² − y² = ±c，渐近线为 y = ±x）：本组电荷的场线恰为此族，等势线则是 xy = c 型
  const hyper: import('three').Line[] = [];
  for (let k = 1; k <= 3; k++) {
    const c = k * 2.0;
    for (const axis of ['x', 'y'] as const) {
      for (const sx of [1, -1]) {
        const pts: import('three').Vector3[] = [];
        for (let i = 0; i <= 60; i++) {
          const u = -3 + (i / 60) * 6;
          // x² − y² = c（sx < 0 为左支）；axis='y' 时画共轭族 y² − x² = c（上下两支）
          const w = sx * Math.sqrt(c + u * u);
          pts.push(axis === 'x' ? new THREE.Vector3(w, u, 0) : new THREE.Vector3(u, w, 0));
        }
        const l = new THREE.Line(
          bag.geo(new THREE.BufferGeometry().setFromPoints(pts)),
          bag.mat(new THREE.LineBasicMaterial({ color: PAL.amber, transparent: true, opacity: 0.5 })),
        );
        g.add(l);
        hyper.push(l);
      }
    }
  }

  // 四极聚焦透镜：一束带电粒子沿 z 轴穿过 → 水平对角会聚、竖直对角发散（交变梯度聚焦）
  const beam: import('three').Mesh[] = [];
  const beamGeo = bag.geo(new THREE.SphereGeometry(0.07, 8, 6));
  const beamMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold }));
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(beamGeo, beamMat);
    m.userData['lane'] = i % 2 === 0 ? 'focus' : 'defocus';   // 会聚 / 发散道
    m.userData['seed'] = Math.random() * 6.28;
    g.add(m);
    beam.push(m);
  }

  g.add(panelSprite(THREE, bag, [
    { text: '四极场：两对等量异号电荷；等势线 xy = c，场线为双曲 x² − y² = ±c（渐近线 ±45°）', color: '#f8fafc' },
    { text: '中心场强为 0，沿两对角线方向场强最大；四极矩 Q = Σqᵢ(3xᵢyᵢ)', color: '#94a3b8' },
    { text: '四极聚焦：金粒束沿对角穿过，一会聚一发散（散焦道）→ 粒子加速器交变梯度聚焦', color: '#06b6d4' },
    { text: '读数：势 ∝ 1/r³、场 ∝ 1/r⁴（比偶极快）；两四极子作用力 ∝ 1/r⁶（六次方衰减）', color: '#fbbf24' },
  ], [0, 4.6, 0], 8.4, 'center'));

  return (t: number, dt: number) => {
    // 四电荷成对反向微移 → 四极矩振荡
    const amp = 0.4 * Math.sin(t * 0.9);
    qs[0].position.set(2.4 + amp, 2.4 + amp, 0);
    qs[1].position.set(-2.4 + amp, -2.4 + amp, 0);
    qs[2].position.set(-2.4 - amp, 2.4 - amp, 0);
    qs[3].position.set(2.4 - amp, -2.4 - amp, 0);
    hyper.forEach((l, i) => {
      const m = l.material as import('three').LineBasicMaterial;
      m.opacity = 0.3 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2 + i));
      l.rotation.z = Math.sin(t * 0.4) * 0.1;
    });
    // 粒子束沿 z 穿过四极场：横向位置按"会聚/发散道"演化（会聚道束腰、发散道张开）
    beam.forEach((b, i) => {
      const lane = b.userData['lane'] as string;
      const seed = b.userData['seed'] as number;
      const s = ((t * 0.55 + seed) % 1);            // 0→1 沿束前进
      const z = -3.2 + s * 6.4;
      const ang = (i / beam.length) * Math.PI * 2;
      if (lane === 'focus') {
        // 会聚道：入口宽 → 中心束腰 → 出口（沿 x 压缩 y）
        const w = 0.3 + 1.1 * Math.abs(s - 0.5) * 2;
        b.position.set(Math.cos(ang) * 1.4, Math.sin(ang) * 0.3 * w, z);
      } else {
        // 发散道：入口窄 → 中心张开（沿 y 发散）
        const w = 0.3 + 1.1 * Math.abs(s - 0.5) * 2;
        b.position.set(Math.cos(ang) * 0.3, Math.sin(ang) * 1.4 * (1.6 - w), z);
      }
      b.scale.setScalar(0.7 + 0.4 * Math.sin(t * 6 + i));
    });
    void dt;
  };
}
