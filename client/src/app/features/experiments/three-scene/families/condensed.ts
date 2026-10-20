import type { SceneContext, SceneInstance } from '../types';
import { scaffold, panelSprite, lineFrom, mesh, PAL, ResourceBag } from './_common';

/**
 * 凝聚态族（condensed）：能带与掺杂 / 布拉格衍射 / 复合材料 / 晶体生长 / 缺陷与位错 /
 * 扩散与菲克定律 / 费米面 / 铁电压电 / 薄膜外延 / 疲劳断裂 / 霍尔效应 / 迈斯纳效应 /
 * 相图与相变 / 等离激元 / PN 结 / 橡胶熵弹性 / 准晶五重对称 / 拓扑与任意子 / 磁通涡旋。
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
    case 'band': return build_band(g, bag, THREE, title);
    case 'bragg': return build_bragg(g, bag, THREE, title);
    case 'composite': return build_composite(g, bag, THREE, title);
    case 'crystalgrowth': return build_crystalgrowth(g, bag, THREE, title);
    case 'defect': return build_defect(g, bag, THREE, title);
    case 'diffusion': return build_diffusion(g, bag, THREE, title);
    case 'fermi': return build_fermi(g, bag, THREE, title);
    case 'ferro': return build_ferro(g, bag, THREE, title);
    case 'film': return build_film(g, bag, THREE, title);
    case 'fracture': return build_fracture(g, bag, THREE, title);
    case 'hall': return build_hall(g, bag, THREE, title);
    case 'meissner': return build_meissner(g, bag, THREE, title);
    case 'phase': return build_phase(g, bag, THREE, title);
    case 'plasmon': return build_plasmon(g, bag, THREE, title);
    case 'pn': return build_pn(g, bag, THREE, title);
    case 'polymer': return build_polymer(g, bag, THREE, title);
    case 'quasicrystal': return build_quasicrystal(g, bag, THREE, title);
    case 'topo': return build_topo(g, bag, THREE, title);
    case 'vortex': return build_vortex(g, bag, THREE, title);
    default: return build_band(g, bag, THREE, title);
  }
}

/** 便捷：可重绘画布面板（右侧坐标图） */
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

/** P32 能带的形成, P166 掺杂与半导体, P168 石墨烯与狄拉克锥, P167 量子阱, P163 紧束缚与能带 */
function build_band(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const graphene = title.includes('石墨烯');
  const doping = title.includes('掺杂');
  const well = title.includes('量子阱');
  const tight = title.includes('紧束缚');

  const plot = makePlot(bag, THREE, 380, 320, 4.4, 6.6, 0.6);
  g.add(plot.mesh);

  if (graphene) {
    // 石墨烯：蜂窝晶格 + 六角布里渊区 K 点狄拉克锥
    const lat = bag.geo(new THREE.CylinderGeometry(0.13, 0.13, 0.26, 10));
    const matA = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, roughness: 0.5 }));
    const matB = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.pink, roughness: 0.5 }));
    const a = 1.0;
    const sites: import('three').Vector3[] = [];
    for (let i = -3; i <= 3; i++) {
      for (let j = -3; j <= 3; j++) {
        const bx = i * a * 1.5;
        const bz = j * a * Math.sqrt(3) + (i % 2 ? a * Math.sqrt(3) / 2 : 0);
        if (Math.hypot(bx, bz) > 3.4) continue;
        sites.push(new THREE.Vector3(bx, 0, bz));
        sites.push(new THREE.Vector3(bx + a * 0.5, 0, bz + a * Math.sqrt(3) / 2));
      }
    }
    sites.forEach((p, i) => {
      const m = new THREE.Mesh(lat, i % 2 ? matA : matB);
      m.position.copy(p);
      g.add(m);
    });
    // 狄拉克锥（K 点线性色散）：上锥 rotation.z=π（锥尖朝下）、下锥不旋转（锥尖朝上）→ 两锥顶点相接
    const cone1 = new THREE.Mesh(
      bag.geo(new THREE.ConeGeometry(1.1, 1.6, 24, 1, true)),
      bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold, wireframe: true, transparent: true, opacity: 0.7 })),
    );
    cone1.rotation.z = Math.PI;
    cone1.position.set(-6.4, 2.4, 0);
    g.add(cone1);
    const cone2 = cone1.clone();
    cone2.rotation.z = 0;
    cone2.position.set(-6.4, 0.8, 0);
    g.add(cone2);
    // 每帧重绘 E(k) 线性色散
    g.add(panelSprite(THREE, bag, [
      { text: '石墨烯：E(k) = ±ℏv_F|k|，K/K′ 点为狄拉克锥（线性色散）', color: '#f8fafc' },
      { text: 'v_F ≈ 10⁶ m/s，有效质量 m* = 0 → 无质量 Dirac 费米子', color: '#94a3b8' },
      { text: '蜂窝晶格 = 六角布拉维格子 + 两原子基元 → 原点处两支重合', color: '#fbbf24' },
    ], [0, 4.4, 0], 7.8, 'center'));
    return (t: number) => {
      g.rotation.y = t * 0.12;
      const c = plot.frame('石墨烯狄拉克锥 E(k)', 'k', 'E');
      c.strokeStyle = '#fbbf24'; c.lineWidth = 3; c.beginPath();
      const W = 380, H = 320;
      for (let i = 0; i <= 100; i++) {
        const k = (i / 100) * 2 - 1;
        const E = k;
        const px = 46 + ((k + 1) / 2) * (W - 62);
        const py = (H / 2) - E * (H / 2 - 60);
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
      c.beginPath();
      for (let i = 0; i <= 100; i++) {
        const k = (i / 100) * 2 - 1;
        const E = -k;
        const px = 46 + ((k + 1) / 2) * (W - 62);
        const py = (H / 2) - E * (H / 2 - 60);
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
      c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(W / 2, H / 2, 6, 0, 7); c.fill();
      c.fillStyle = '#94a3b8'; c.fillText('K 点：E = ±ℏv_F k', 80, 60);
      plot.tex.needsUpdate = true;
    };
  }

  if (doping) {
    // 掺杂：本征半导体 + 施主/受主能级 + 费米移动
    const slab = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(7, 3.4, 2.4)),
      bag.mat(new THREE.MeshStandardMaterial({ color: 0x1e293b, transparent: true, opacity: 0.6, roughness: 0.6 })),
    );
    g.add(slab);
    const donorGeo = bag.geo(new THREE.SphereGeometry(0.2, 14, 12));
    const dMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.green, emissive: 0x15803d, emissiveIntensity: 0.7 }));
    const aMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.pink, emissive: 0xbe185d, emissiveIntensity: 0.7 }));
    const dopants: import('three').Mesh[] = [];
    for (let i = 0; i < 22; i++) {
      const m = new THREE.Mesh(donorGeo, i % 2 ? dMat : aMat);
      m.position.set((Math.random() - 0.5) * 6.4, (Math.random() - 0.5) * 2.8, (Math.random() - 0.5) * 2);
      g.add(m);
      dopants.push(m);
    }
    // 导带 / 价带 条带
    const cb = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(8, 0.5, 0.4)),
      bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.85 })),
    );
    cb.position.set(0, 2.4, 1.6);
    g.add(cb);
    const vb = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(8, 0.5, 0.4)),
      bag.mat(new THREE.MeshBasicMaterial({ color: PAL.violet, transparent: true, opacity: 0.85 })),
    );
    vb.position.set(0, -2.4, 1.6);
    g.add(vb);
    // 带隙内分立能级：施主 E_D（近导带，绿）/ 受主 E_A（近价带，粉），亮度·宽度 ∝ 对应掺杂数
    const eD = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(8, 0.12, 0.42)),
      bag.mat(new THREE.MeshBasicMaterial({ color: PAL.green, transparent: true, opacity: 0.9 })),
    );
    eD.position.set(0, 1.62, 1.6);
    g.add(eD);
    const eA = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(8, 0.12, 0.42)),
      bag.mat(new THREE.MeshBasicMaterial({ color: PAL.pink, transparent: true, opacity: 0.9 })),
    );
    eA.position.set(0, -1.62, 1.6);
    g.add(eA);
    // 费米能级 E_F（金虚线）：位置由画面中施主/受主原子数同源计算，n 型向导带、p 型向价带移动
    const efLine = lineFrom(THREE, bag, [
      new THREE.Vector3(-4.1, 0, 0), new THREE.Vector3(4.1, 0, 0),
    ], PAL.gold, true);
    efLine.position.set(0, 0, 1.75);
    g.add(efLine);
    g.add(panelSprite(THREE, bag, [
      { text: '掺杂：施主能级 E_D 靠近导带，受主 E_A 靠近价带', color: '#f8fafc' },
      { text: 'n 型：E_F 向导带移动；p 型：E_F 向价带移动（金虚线 = E_F）', color: '#94a3b8' },
      { text: '电中性条件 n + N_A⁻ = p + N_D⁺（绿=施主，粉=受主）', color: '#fbbf24' },
      { text: '读数：右图 E_F/E_D/E_A 位置与原子计数同源，随 N_D/N_A 交替扫描', color: '#22c55e' },
    ], [0, 4.4, 0], 7.8, 'center'));
    let lastBand = -1;
    return (t: number) => {
      g.rotation.y = t * 0.1;
      // 掺杂类型缓慢循环：施主数 ↔ 受主数（画面 dopant 材质 = 计数同源）
      const donors = Math.round(11 + 11 * Math.sin(t * 0.35));
      const acceptors = 22 - donors;
      dopants.forEach((m, i) => {
        m.material = i < donors ? dMat : aMat;
        m.scale.setScalar(1 + 0.25 * Math.sin(t * 2 + i));
      });
      // E_F 位置 = (N_D − N_A)/N_tot 映射到带隙内（n 型 → 向导带）
      const yEF = ((donors - acceptors) / 22) * 1.95;
      efLine.position.y = yEF;
      const fd = donors / 22, fa = acceptors / 22;
      eD.scale.x = 0.25 + 0.75 * fd;
      (eD.material as import('three').MeshBasicMaterial).opacity = 0.2 + 0.75 * fd;
      eA.scale.x = 0.25 + 0.75 * fa;
      (eA.material as import('three').MeshBasicMaterial).opacity = 0.2 + 0.75 * fa;
      // 右侧能带示意图（5Hz 刷新，读数与上面几何同源）
      const bucket = Math.round(t * 5);
      if (bucket !== lastBand) {
        lastBand = bucket;
        const c = plot.frame('能带示意（E_F 随掺杂移动）', 'x', 'E');
        const W = 380, H = 320;
        const yOf = (E: number) => (H - 40) - ((E + 3) / 6) * (H - 70);
        c.fillStyle = 'rgba(6,182,212,0.55)'; c.fillRect(46, yOf(2.65), W - 60, yOf(2.15) - yOf(2.65));
        c.fillStyle = 'rgba(139,92,246,0.55)'; c.fillRect(46, yOf(-2.15), W - 60, yOf(-2.65) - yOf(-2.15));
        c.fillStyle = '#94a3b8'; c.fillText('导带', W - 92, yOf(2.65) - 6);
        c.fillText('价带', W - 92, yOf(-2.15) + 18);
        c.strokeStyle = '#22c55e'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(46, yOf(1.62)); c.lineTo(46 + fd * (W - 62), yOf(1.62)); c.stroke();
        c.strokeStyle = '#f472b6';
        c.beginPath(); c.moveTo(46, yOf(-1.62)); c.lineTo(46 + fa * (W - 62), yOf(-1.62)); c.stroke();
        c.strokeStyle = '#fbbf24'; c.lineWidth = 3; c.setLineDash([6, 5]);
        c.beginPath(); c.moveTo(46, yOf(yEF)); c.lineTo(W - 14, yOf(yEF)); c.stroke();
        c.setLineDash([]);
        c.fillStyle = '#fbbf24'; c.fillText(`E_F = ${yEF.toFixed(2)}`, W - 150, yOf(yEF) - 8);
        c.fillStyle = '#22c55e'; c.fillText('E_D', 52, yOf(1.62) - 8);
        c.fillStyle = '#f472b6'; c.fillText('E_A', 52, yOf(-1.62) + 20);
        c.fillStyle = '#f8fafc'; c.font = '15px sans-serif';
        c.fillText(`N_D = ${donors}  N_A = ${acceptors}（${donors >= acceptors ? 'n 型' : 'p 型'}）`, 56, 56);
        plot.tex.needsUpdate = true;
      }
    };
  }

  if (well) {
    // 量子阱：有限深势阱中的束缚能级与波函数
    const wellW = 7;
    const wellD = 2.2;
    const left = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(2.2, 5, 1.6)),
      bag.mat(new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 })),
    );
    left.position.x = -(wellW / 2 + 1.1);
    g.add(left);
    const right = left.clone();
    right.position.x = wellW / 2 + 1.1;
    g.add(right);
    const levels = [0.18, 0.62, 1.32];
    const levelMeshes: import('three').Mesh[] = [];
    levels.forEach((u) => {
      const l = new THREE.Mesh(
        bag.geo(new THREE.BoxGeometry(wellW, 0.08, 0.5)),
        bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold })),
      );
      l.position.set(0, -wellD / 2 + u * wellD, 0.9);
      g.add(l);
      levelMeshes.push(l);
    });
    // 波函数 ψ₁(x)
    const N = 140;
    const geo = bag.geo(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
    const psi = new THREE.Line(geo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan })));
    g.add(psi);
    g.add(panelSprite(THREE, bag, [
      { text: '量子阱：E_n = ℏ²π²n²/(2m*L²)（无限深近似），L 越小能级间距越大', color: '#f8fafc' },
      { text: '有限深时波函数渗入垒区：k tan(kL/2) = κ', color: '#94a3b8' },
      { text: '金线 = 分立能级，青线 = 基态波函数 ψ₁(x)', color: '#fbbf24' },
    ], [0, 4.4, 0], 7.8, 'center'));
    return (t: number) => {
      const arr = geo.getAttribute('position') as import('three').BufferAttribute;
      const a = arr.array as Float32Array;
      for (let i = 0; i <= N; i++) {
        const x = (i / N) * wellW - wellW / 2;
        const u = x / (wellW / 2);
        const psiV = Math.sin(((u + 1) / 2) * Math.PI) * Math.cos(t * 1.6);
        a[i * 3] = x;
        a[i * 3 + 1] = psiV * 1.4;
        a[i * 3 + 2] = 1.2;
      }
      arr.needsUpdate = true;
      levelMeshes.forEach((m, i) => { m.scale.x = 1 + 0.04 * Math.sin(t * 2 + i); });
      g.rotation.y = 0.12 * Math.sin(t * 0.3);
    };
  }

  // 默认：能带形成（紧束缚）— 原子能级 → N 重简并 → 能带
  const NAT = 8;
  const atoms: import('three').Mesh[] = [];
  const atomGeo = bag.geo(new THREE.SphereGeometry(0.34, 18, 14));
  const atomMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, emissive: 0x0891b2, emissiveIntensity: 0.4 }));
  for (let i = 0; i < NAT; i++) {
    const m = new THREE.Mesh(atomGeo, atomMat);
    m.position.set((i - NAT / 2 + 0.5) * 1.1, -2.4, 0);
    g.add(m);
    atoms.push(m);
  }
  // 从原子能级分列成能带（左右两个示意条带）
  const bandMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.8 }));
  const bandTop = new THREE.Mesh(bag.geo(new THREE.BoxGeometry(6, 1.0, 0.4)), bandMat);
  bandTop.position.set(0, 2.0, 0);
  g.add(bandTop);
  const bandBot = new THREE.Mesh(bag.geo(new THREE.BoxGeometry(6, 1.0, 0.4)), bandMat);
  bandBot.position.set(0, -0.4, 0);
  g.add(bandBot);
  // 紧束缚色散 E(k) = ε₀ − 2t cos(ka)
  const lineGeo = bag.geo(new THREE.BufferGeometry());
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(121 * 3), 3));
  const dispersion = new THREE.Line(lineGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.green })));
  dispersion.position.set(0, 3.6, 0);
  g.add(dispersion);
  g.add(panelSprite(THREE, bag, [
    { text: tight ? '紧束缚：E(k) = ε₀ − 2t cos(ka)，带宽 W = 4t' : '能带形成：N 个原子能级 → N 条分裂 → 准连续能带', color: '#f8fafc' },
    { text: '交叠积分 t 越大，能带越宽；带隙来自周期势的 Bragg 反射', color: '#94a3b8' },
    { text: '读数：原子间距 a = 1.1（示意），带宽随 t 周期调制', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  return (t: number) => {
    // 原子振动 & 能带开合
    atoms.forEach((m, i) => { m.position.y = -2.4 + 0.12 * Math.sin(t * 2 + i * 0.6); });
    const squeeze = 1 + 0.15 * Math.sin(t * 0.6);
    bandTop.scale.x = squeeze; bandBot.scale.x = squeeze;
    const arr = lineGeo.getAttribute('position') as import('three').BufferAttribute;
    const a = arr.array as Float32Array;
    for (let i = 0; i <= 120; i++) {
      const k = (i / 120) * Math.PI * 2 - Math.PI;
      const E = -2 * Math.cos(k);
      a[i * 3] = k * 1.9;
      a[i * 3 + 1] = E * 0.7;
      a[i * 3 + 2] = 0;
    }
    arr.needsUpdate = true;
    void tight;
  };
}

/** P524 布拉格衍射与晶格分析 */
function build_bragg(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 晶面（三层原子）
  const layerY = [-1.4, 0, 1.4];
  const atomGeo = bag.geo(new THREE.SphereGeometry(0.26, 16, 12));
  const atomMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.slate, roughness: 0.5, metalness: 0.3 }));
  layerY.forEach((y) => {
    for (let i = -5; i <= 5; i++) {
      const m = new THREE.Mesh(atomGeo, atomMat);
      m.position.set(i * 1.15, y, 0);
      g.add(m);
    }
  });
  // 入射与反射光线（动画相位）
  const mkRay = (col: number) => {
    const rayGeo = bag.geo(new THREE.BufferGeometry());
    rayGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60 * 3), 3));
    const l = new THREE.Line(rayGeo, bag.mat(new THREE.LineBasicMaterial({ color: col })));
    g.add(l);
    return rayGeo;
  };
  const rayIn = mkRay(PAL.cyan);
  const rayOut = mkRay(PAL.amber);
  // 衍射斑点（屏幕）
  const screen = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(0.2, 6.5)),
    bag.mat(new THREE.MeshBasicMaterial({ color: 0x1e293b, side: THREE.DoubleSide })),
  );
  screen.position.set(7.4, 1.2, 0);
  g.add(screen);
  const spotGeo = bag.geo(new THREE.SphereGeometry(0.18, 12, 10));
  const spots: import('three').Mesh[] = [];
  // 每个斑点对应一级布拉格反射 n=1,2,3，各自独立材质以便按 θ 逐一亮度调制
  [-2.0, 0, 2.0].forEach((y) => {
    const m = new THREE.Mesh(spotGeo, bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold })));
    m.position.set(7.3, 1.2 + y, 0.1);
    g.add(m);
    spots.push(m);
  });
  const d = 1.4, lam = 0.7; // 层间距 / 波长（教学单位）：nλ=2d sinθ 命中的级次才会亮
  g.add(panelSprite(THREE, bag, [
    { text: '布拉格定律：2d sinθ = nλ（n = 1, 2, …）', color: '#f8fafc' },
    { text: '相邻晶面反射波的光程差为波长整数倍时相干加强', color: '#94a3b8' },
    { text: `d = ${d.toFixed(2)}, λ = ${lam.toFixed(2)}（示意单位）：斑点亮度 = 该级干涉因子 F_n(θ)，扫描 θ 依次点亮`, color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  return (t: number) => {
    const theta = 0.2 + 0.5 * (Math.sin(t * 0.4) * 0.5 + 0.5);
    const px = 7.4;
    // 入射线：左上 → 第 1 层中心
    const ia = rayIn.getAttribute('position') as import('three').BufferAttribute;
    const iaA = ia.array as Float32Array;
    iaA[0] = -7; iaA[1] = 1.4 + Math.tan(theta) * 7; iaA[2] = 0;
    iaA[3] = 0; iaA[4] = 0; iaA[5] = 0;
    ia.needsUpdate = true;
    // 反射线：中心 → 右上屏幕
    const oa = rayOut.getAttribute('position') as import('three').BufferAttribute;
    const oaA = oa.array as Float32Array;
    oaA[0] = 0; oaA[1] = 0; oaA[2] = 0;
    oaA[3] = px; oaA[4] = Math.tan(theta) * px; oaA[5] = 0;
    oa.needsUpdate = true;
    // 斑点亮度由当前 θ 的各级布拉格干涉因子驱动（教学近似：高斯峰形，峰宽 ~λ/6）
    const sinT = Math.sin(theta);
    spots.forEach((s, i) => {
      const detune = (2 * d * sinT - (i + 1) * lam) / lam;
      const Fn = Math.exp(-18 * detune * detune);
      s.scale.setScalar(0.4 + 1.2 * Fn);
      (s.material as import('three').MeshBasicMaterial).color.setRGB(
        0.28 + 0.7 * Fn, 0.33 + 0.42 * Fn, 0.41 - 0.27 * Fn,
      );
    });
    g.rotation.y = 0.15 * Math.sin(t * 0.3);
  };
}

/** P381 纤维增强复合材料 */
function build_composite(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 基体（半透明块）
  const matrix = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(8.4, 4.6, 3.4)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x334155, transparent: true, opacity: 0.35, roughness: 0.8 })),
  );
  g.add(matrix);
  // 纤维（沿 x 方向的圆柱束）
  const NF = 9;
  const fiberGeo = bag.geo(new THREE.CylinderGeometry(0.16, 0.16, 8, 12));
  const fiberMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, metalness: 0.6, roughness: 0.4 }));
  const fibers: import('three').Mesh[] = [];
  for (let i = 0; i < NF; i++) {
    const m = new THREE.Mesh(fiberGeo, fiberMat);
    m.rotation.z = Math.PI / 2;
    m.position.set(0, -1.8 + i * 0.45, (i % 3 - 1) * 0.9);
    g.add(m);
    fibers.push(m);
  }
  // 外加载荷箭头（沿纤维方向）
  const load = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(-5.4, 2.6, 0), 2, PAL.red, 0.24, 0.12,
  );
  g.add(load);
  // 混合律曲线
  const plot = makePlot(bag, THREE, 340, 300, 3.8, 6.8, 0.6);
  g.add(plot.mesh);
  const vf = 0.55;
  g.add(panelSprite(THREE, bag, [
    { text: '混合律：E_c = V_f E_f + (1−V_f) E_m（纵向）', color: '#f8fafc' },
    { text: '纤维承担主要载荷，基体传递剪切并防止裂纹扩展', color: '#94a3b8' },
    { text: `当前 V_f = ${vf.toFixed(2)}（示意），E_c 随 V_f 线性上升`, color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  let last = -1;
  return (t: number) => {
    g.rotation.y = t * 0.15;
    const F = 1 + 0.6 * Math.sin(t * 0.9);
    load.setLength(1.4 + F * 0.6, 0.24, 0.12);
    fibers.forEach((m, i) => { m.scale.x = 1 + 0.02 * F * Math.sin(t * 3 + i); });
    const bucket = Math.round(F * 6);
    if (bucket !== last) {
      last = bucket;
      const c = plot.frame('混合律 E_c(V_f)', 'V_f', 'E_c');
      const W = 340, H = 300;
      c.strokeStyle = '#f59e0b'; c.lineWidth = 3; c.beginPath();
      for (let i = 0; i <= 60; i++) {
        const v = i / 60;
        const E = 3 + v * 12; // 纵向混合律示意
        const px = 46 + v * (W - 62);
        const py = (H - 40) - (E / 16) * (H - 70);
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
      c.fillStyle = '#f59e0b'; c.beginPath();
      const px = 46 + vf * (W - 62);
      const py = (H - 40) - ((3 + vf * 12) / 16) * (H - 70);
      c.arc(px, py, 7, 0, 7); c.fill();
      c.fillStyle = '#94a3b8'; c.fillText('白点 = 当前 V_f', 60, 60);
      plot.tex.needsUpdate = true;
    }
  };
}

/** P375 退火与再结晶, P368 晶体生长与区域提纯 */
function build_crystalgrowth(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const zone = title.includes('提纯');
  const latGeo = bag.geo(new THREE.BoxGeometry(0.44, 0.44, 0.44));
  const goodMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, roughness: 0.5 }));
  const badMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, roughness: 0.6 }));
  const NX = 14, NY = 8;
  const cells: import('three').Mesh[] = [];
  const dirty: boolean[] = [];
  for (let i = 0; i < NX * NY; i++) {
    const m = new THREE.Mesh(latGeo, goodMat);
    m.position.set((i % NX - NX / 2 + 0.5) * 0.55, (Math.floor(i / NX) - NY / 2 + 0.5) * 0.55, 0);
    g.add(m);
    cells.push(m);
    dirty.push(Math.random() < 0.3);
  }
  // 初始杂质分布快照：熔区每完成一次扫过即复位，演示"多道 zone pass"
  const dirty0 = dirty.slice();
  const impTotal = Math.max(1, dirty0.filter(Boolean).length);
  // 区域提纯：被熔区向末端推走的杂质在锭尾富集（红柱高度 = 已推送杂质数，与面板"末端富集"同源）
  const pile = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.5, NY * 0.55, 0.5)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, emissive: 0x7f1d1d, emissiveIntensity: 0.5, roughness: 0.6 })),
  );
  pile.position.set(NX * 0.56 / 2 + 0.42, 0, 0);
  pile.scale.y = 0.05;
  pile.visible = false;
  g.add(pile);
  // 区熔提纯：移动的熔区（发光条）
  const melt = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.7, NY * 0.55, 0.7)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.65 })),
  );
  g.add(melt);
  // 晶锭衬底
  const ingot = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(NX * 0.56, NY * 0.56, 0.6)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x1e293b, transparent: true, opacity: 0.5 })),
  );
  ingot.position.z = -0.5;
  g.add(ingot);
  g.add(panelSprite(THREE, bag, zone ? [
    { text: '区域提纯：杂质在固/液两相的分配系数 k = C_s/C_l < 1', color: '#f8fafc' },
    { text: '移动熔区反复扫过，杂质被"推"向末端富集（橙=熔区，红柱=被推走的杂质累积量）', color: '#94a3b8' },
    { text: 'C_s(x) = k C_0 (1−x)^{k−1}：末端富集、主体提纯', color: '#fbbf24' },
  ] : [
    { text: '退火：冷加工储能 → 回复（位错重排）→ 再结晶（新晶粒成核长大）', color: '#f8fafc' },
    { text: 'T_退火 ≈ 0.4–0.6 T_m（同素异构金属），晶粒尺寸 ∝ 1/√(形核率×时间)', color: '#94a3b8' },
    { text: '读数：红格 = 畸变/杂质晶粒，随退火逐渐被青色再结晶晶粒吞并', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  let head = -8;
  let prevHead = 99;
  let impPushed = 0;
  return (t: number) => {
    if (zone) {
      const span = NX * 0.56 + 2;
      head = ((t * 1.4) % span) - NX * 0.56 / 2 - 1;
      if (head < prevHead) {
        // 熔区回到起点：复位杂质分布，开始下一道提纯
        for (let i = 0; i < dirty.length; i++) dirty[i] = dirty0[i];
        impPushed = 0;
        pile.visible = false;
      }
      prevHead = head;
      melt.position.x = head;
      melt.visible = true;
      cells.forEach((m, i) => {
        const x = (i % NX - NX / 2 + 0.5) * 0.55;
        const behind = x < head;
        if (behind) {
          if (dirty[i]) { dirty[i] = false; impPushed++; } // 杂质被熔区带走 → 计入末端富集
          m.material = goodMat;
        } else {
          m.material = dirty[i] ? badMat : goodMat; // 前方未熔区仍含红杂质晶粒
        }
        m.scale.setScalar(1 + (behind ? 0.1 : 0) * Math.sin(t * 4 + i));
      });
      if (impPushed > 0) {
        pile.visible = true;
        pile.scale.y = 0.05 + 0.95 * Math.min(1, impPushed / impTotal);
      }
    } else {
      // 退火：畸变晶粒按位置逐次被再结晶晶粒替换
      const prog = (Math.sin(t * 0.25) * 0.5 + 0.5);
      cells.forEach((m, i) => {
        const x = (i % NX - NX / 2 + 0.5) * 0.55;
        const recryst = x < -4 + prog * 9;
        m.material = recryst ? goodMat : (dirty[i] ? badMat : goodMat);
        m.scale.setScalar(1 + 0.06 * Math.sin(t * 3 + i * 0.5));
      });
      melt.visible = false;
    }
    g.rotation.y = 0.18 * Math.sin(t * 0.35);
  };
}

/** P165 晶体缺陷, P369 位错与塑性滑移, P374 空位与间隙扩散 */
function build_defect(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const dislocation = title.includes('位错');
  const vacancy = title.includes('空位');
  const NX = 16, NY = 8;
  const nodeGeo = bag.geo(new THREE.SphereGeometry(0.2, 12, 10));
  const nodeMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, roughness: 0.5 }));
  const nodes: import('three').Mesh[] = [];
  const base: import('three').Vector3[] = [];
  for (let i = 0; i < NX * NY; i++) {
    const ix = i % NX, iy = Math.floor(i / NX);
    const m = new THREE.Mesh(nodeGeo, nodeMat);
    m.position.set((ix - NX / 2 + 0.5) * 0.58, (iy - NY / 2 + 0.5) * 0.58, 0);
    g.add(m);
    nodes.push(m);
    base.push(m.position.clone());
  }
  // 间隙原子 / 空位标记
  const inter = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.16, 12, 10)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: 0xb45309, emissiveIntensity: 0.7 })),
  );
  g.add(inter);
  const vacMark = new THREE.Mesh(
    bag.geo(new THREE.RingGeometry(0.2, 0.28, 20)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.red, side: THREE.DoubleSide })),
  );
  g.add(vacMark);
  g.add(panelSprite(THREE, bag, dislocation ? [
    { text: '刃型位错：柏氏矢量 b，滑移使位错线扫过晶体产生台阶', color: '#f8fafc' },
    { text: '临界分切应力 τ_c = Gb/L（Hall–Petch：晶粒越细强度越高）', color: '#94a3b8' },
    { text: '塑性滑移 = 位错逐列运动，而非整层原子同时切动', color: '#fbbf24' },
  ] : vacancy ? [
    { text: '空位浓度 n_v/N ≈ exp(−E_f/k_BT)（Schottky 缺陷）', color: '#f8fafc' },
    { text: '间隙原子使晶格局部畸变，扩散以跳跃机制进行', color: '#94a3b8' },
    { text: '读数：红环 = 空位（最近邻原子跳入即迁移），金球 = 间隙原子逐位跳跃', color: '#fbbf24' },
    { text: '右图：n_v/N = exp(−E_f/k_BT)，E_f ≈ 1.17 eV (Si)，T 于 300–1500 K 扫描', color: '#22c55e' },
  ] : [
    { text: '晶体缺陷三类：点缺陷（空位/间隙）、线缺陷（位错）、面缺陷（晶界）', color: '#f8fafc' },
    { text: '缺陷破坏周期势的平移对称性 → 引入带隙内的局域态', color: '#94a3b8' },
    { text: '读数：红环=空位·金球=间隙(格间跳动)·上方错排带=刃型位错·左右晶粒差~15°=倾斜晶界', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  // vacancy 分支专用：平衡浓度读数面板（5Hz）+ 空位随机行走状态（格点坐标）
  const vacPlot = vacancy ? makePlot(bag, THREE, 340, 300, 3.6, 6.7, 0.9) : null;
  if (vacPlot) g.add(vacPlot.mesh);
  let lastVac = -1;
  let vx = 7, vy = 3, vdx = 1, vdy = 0, prevHop = -1;
  return (t: number, dt: number) => {
    if (dislocation) {
      // 位错核心沿滑移方向推进，上半部分晶格相对下半部分错排半个 b
      const u = (Math.sin(t * 0.35) * 0.5 + 0.5);
      const coreX = -4 + u * 8;
      nodes.forEach((m, i) => {
        const b = base[i];
        const top = b.y > 0;
        const slip = top ? Math.min(0.6, Math.max(0, (b.x - coreX) * 0.1)) : 0;
        m.position.x = b.x + slip + 0.03 * Math.sin(t * 3 + i);
        m.position.y = b.y + 0.03 * Math.cos(t * 3 + i * 0.7);
        m.position.z = 0;
        // 位错核心附近晶格畸变
        const d = Math.hypot(b.x - coreX, b.y);
        if (d < 1.4) m.position.y += 0.3 * Math.exp(-d * d) * Math.sin(t * 4);
      });
      vacMark.visible = false;
      inter.position.set(coreX, 0, 0.4);
    } else if (vacancy) {
      // 空位扩散机制：最近邻原子跳入空位 → 空位迁移到该原子原格位（离散跳跃，每 1.6 s 一步）
      const HOP = 1.6;
      const hop = Math.floor(t / HOP);
      if (hop !== prevHop) {
        if (prevHop >= 0) { vx += vdx; vy += vdy; } // 上一跳已落地：空位改位于跳走原子的格点
        prevHop = hop;
        // 确定性伪随机选最近邻方向（限制在网格内部，保证始终有合法方向）
        const r = Math.abs(Math.sin((hop + 1) * 12.9898) * 43758.5453) % 1;
        const dirs: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
        const k0 = Math.floor(r * 4) % 4;
        for (let k = 0; k < 4; k++) {
          const cand = dirs[(k0 + k) % 4];
          const nx = vx + cand[0], ny = vy + cand[1];
          if (nx >= 1 && nx <= NX - 2 && ny >= 1 && ny <= NY - 2) { vdx = cand[0]; vdy = cand[1]; break; }
        }
      }
      const f = (t / HOP) % 1;
      const slide = f < 0.55 ? 0 : Math.min(1, (f - 0.55) / 0.4); // 前段停留（等待热激活），后段跳位
      const w = slide * slide * (3 - 2 * slide);
      const vIdx = vx + vy * NX, sIdx = vx + vdx + (vy + vdy) * NX;
      nodes.forEach((m, i) => {
        m.position.x = base[i].x + 0.03 * Math.sin(t * 4 + i);
        m.position.y = base[i].y + 0.03 * Math.cos(t * 4 + i);
        m.position.z = 0;
        m.visible = i !== vIdx; // 空位所在格点原子缺失
      });
      // 跳位过程：邻位原子 sIdx 平移到空位 vIdx（环随空位格点联动显隐；停留段保留热振动）
      const sm = nodes[sIdx];
      sm.position.set(
        base[sIdx].x + (base[vIdx].x - base[sIdx].x) * w + 0.03 * Math.sin(t * 4 + sIdx) * (1 - w),
        base[sIdx].y + (base[vIdx].y - base[sIdx].y) * w + 0.03 * Math.cos(t * 4 + sIdx) * (1 - w),
        0.35,
      );
      vacMark.position.set(base[vIdx].x, base[vIdx].y, 0.3);
      vacMark.visible = true;
      // 间隙原子：在格间隙位之间逐位跳跃（与综合缺陷分支同一 iSlots 离散跳表）
      const iSlots: [number, number][] = [[0.58, 0], [1.16, 0.58], [1.74, 0], [1.16, -0.58]];
      const seq = t * 1.4;
      const kk = ((Math.floor(seq) % 4) + 4) % 4;
      const kn = (kk + 1) % 4;
      let ff = seq - Math.floor(seq);
      ff = ff < 0.5 ? 0 : (ff - 0.5) / 0.5;
      ff = ff * ff * (3 - 2 * ff);
      const s0 = iSlots[kk], s1 = iSlots[kn];
      inter.position.set(s0[0] + (s1[0] - s0[0]) * ff, s0[1] + (s1[1] - s0[1]) * ff, 0.4);
      inter.visible = true;
      // 平衡浓度曲线读数（5Hz，n_v/N = exp(−E_f/k_BT)，E_f=1.17 eV）
      if (vacPlot) {
        const bucket = Math.round(t * 5);
        if (bucket !== lastVac) {
          lastVac = bucket;
          const T = 300 + 1200 * (0.5 + 0.5 * Math.sin(t * 0.25));
          const kBT = 8.617333262e-5 * T;
          const nn = Math.exp(-1.17 / kBT);
          const lg = Math.log10(nn);
          const c = vacPlot.frame('空位平衡浓度', 'T (K)', 'lg(n_v/N)');
          const W = 340, H = 300;
          const pxT = (TT: number) => 46 + ((TT - 300) / 1200) * (W - 62);
          const pyL = (L: number) => (H - 40) - ((L + 20.5) / 19) * (H - 70);
          c.strokeStyle = '#06b6d4'; c.lineWidth = 3; c.beginPath();
          for (let i = 0; i <= 80; i++) {
            const TT = 300 + (i / 80) * 1200;
            const L = -1.17 / (8.617333262e-5 * TT) / Math.LN10;
            if (i === 0) c.moveTo(pxT(TT), pyL(L)); else c.lineTo(pxT(TT), pyL(L));
          }
          c.stroke();
          c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(pxT(T), pyL(lg), 7, 0, 7); c.fill();
          c.fillStyle = '#94a3b8'; c.font = '14px sans-serif';
          c.fillText('E_f ≈ 1.17 eV (Si)', 56, 56);
          c.fillStyle = '#f8fafc'; c.fillText(`T = ${T.toFixed(0)} K`, 56, 76);
          c.fillStyle = '#fbbf24'; c.fillText(`n_v/N = ${nn.toExponential(1)}`, 56, 96);
          c.fillStyle = '#94a3b8'; c.fillText(`跳频 ≈ ${(1 / HOP).toFixed(2)} 步/s（示意）`, 56, 116);
          vacPlot.tex.needsUpdate = true;
        }
      }
    } else {
      // 综合"晶体缺陷"（教学示意）：同一晶格同时呈现三类缺陷 + 晶界
      //  ① 点缺陷——空位（红环标记缺失格点）+ 间隙原子（金球格间跳动）
      //  ② 线缺陷——刃型位错：滑移面上方、核心右侧约 5 列晶格局部错排（多余半原子面）
      //  ③ 面缺陷——倾斜晶界：左右两块晶粒各绕 z 轴反向旋转 ≈7.5°（合计 ~15° 取向差）
      const tilt = 0.131;   // 单侧晶粒取向 ≈7.5°（2× ≈ 15°，倾斜晶界示意）
      const coreX = -2.2;   // 刃型位错核心横坐标（左晶粒内）
      const vacIdx = 92;    // 空位所在格点索引（右晶粒内部，避开位错与晶界）
      const caR = Math.cos(tilt), saR = Math.sin(tilt);
      const caL = Math.cos(-tilt), saL = Math.sin(-tilt);
      nodes.forEach((m, i) => {
        const b = base[i];
        const right = b.x >= 0;
        // ③ 倾斜晶界：按原始 x 归属左右晶粒，各自绕原点旋转 ±tilt
        const cc = right ? caR : caL;
        const ss = right ? saR : saL;
        let px = b.x * cc - b.y * ss;
        let py = b.x * ss + b.y * cc;
        // 晶界核心列（|x|<0.35）额外无序扰动，形成失配过渡区
        if (Math.abs(b.x) < 0.35) {
          px += 0.07 * Math.sin(i * 2.1 + t * 2.0);
          py += 0.07 * Math.cos(i * 1.7 + t * 1.6);
        }
        // ② 刃型位错：多余半原子面终止于 coreX，滑移面(y>0)上方约 5 列局部错排（≈b/2 示意）
        const relTop = px - coreX;
        if (py > 0 && relTop > 0 && relTop < 2.9) {
          px += 0.5 * Math.sin((relTop / 2.9) * Math.PI);
        }
        // 热振动微扰
        px += 0.03 * Math.sin(t * 3 + i * 0.5);
        py += 0.03 * Math.cos(t * 3 + i * 0.7);
        m.position.set(px, py, 0);
        // ① 空位：该格点原子缺失（隐藏原子），红环标记其位置
        m.visible = i !== vacIdx;
        if (i === vacIdx) vacMark.position.set(px, py, 0.3);
      });
      vacMark.visible = true;
      // ① 间隙原子：一枚离开格位的原子，在右晶粒的格间隙位之间逐位跳动（Frenkel 型示意）
      const iSlots: [number, number][] = [[1.16, 0.58], [1.74, 1.16], [2.32, 0.58], [1.74, 0.0]];
      const seq = t * 1.4;
      const k = Math.floor(seq) % 4;
      const kn = (k + 1) % 4;
      let f = seq - Math.floor(seq);
      f = f < 0.5 ? 0 : (f - 0.5) / 0.5;   // 前半段停留、后半段跳跃
      f = f * f * (3 - 2 * f);               // smoothstep 缓动
      const s0 = iSlots[k], s1 = iSlots[kn];
      const lx = s0[0] + (s1[0] - s0[0]) * f;
      const ly = s0[1] + (s1[1] - s0[1]) * f;
      // 间隙位随右晶粒一起旋转，保持在晶格间隙中
      inter.position.set(lx * caR - ly * saR, lx * saR + ly * caR, 0.4);
      inter.visible = true;
    }
    void dt;
  };
}

/** P373 扩散与菲克定律 */
function build_diffusion(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const N = 40;
  const colGeo = bag.geo(new THREE.BoxGeometry(0.4, 2.4, 0.6));
  const cols: import('three').Mesh[] = [];
  const C = new Float32Array(N).fill(0);
  C[0] = 1;
  for (let i = 0; i < N; i++) {
    const m = new THREE.Mesh(colGeo, bag.mat(new THREE.MeshStandardMaterial({ color: 0xffffff })));
    m.position.set((i - N / 2 + 0.5) * 0.5, -1.4, 0);
    g.add(m);
    cols.push(m);
  }
  // 扩散粒子（随机行走）
  const NP = 60;
  const pg = bag.geo(new THREE.BufferGeometry());
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  g.add(new THREE.Points(pg, bag.mat(new THREE.PointsMaterial({ color: PAL.green, size: 0.14, sizeAttenuation: true }))));
  const plot = makePlot(bag, THREE, 340, 300, 3.8, 6.8, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '菲克第一定律 J = −D ∂C/∂x（稳态扩散通量）', color: '#f8fafc' },
    { text: '菲克第二定律 ∂C/∂t = D ∂²C/∂x²，源扩散解 C ∝ erfc(x/2√(Dt))', color: '#94a3b8' },
    { text: '读数：青色柱 = 浓度剖面 C(x,t)，绿点 = 随机行走粒子', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const pos = pg.getAttribute('position') as import('three').BufferAttribute;
  const pa = pos.array as Float32Array;
  for (let i = 0; i < NP; i++) {
    pa[i * 3] = (Math.random() - 0.5) * 9;
    pa[i * 3 + 1] = 1.8 + Math.random() * 1.4;
    pa[i * 3 + 2] = (Math.random() - 0.5) * 1.4;
  }
  let last = -1;
  return (t: number, dt: number) => {
    // FTCS 推进浓度场
    const D = 0.22;
    const next = Float32Array.from(C);
    for (let i = 1; i < N - 1; i++) next[i] = C[i] + D * (C[i + 1] - 2 * C[i] + C[i - 1]);
    next[0] = 1; // 恒定源
    C.set(next);
    for (let i = 0; i < N; i++) {
      const c = Math.max(0, Math.min(1, C[i]));
      (cols[i].material as import('three').MeshStandardMaterial).color.setRGB(0.15 + 0.75 * c, 0.55 + 0.4 * c, 0.9 - 0.5 * c);
      cols[i].scale.y = 0.25 + c * 1.6;
    }
    // 粒子随机行走
    for (let i = 0; i < NP; i++) {
      pa[i * 3] += (Math.random() - 0.5) * 1.6 * dt * 8;
      pa[i * 3 + 1] += (Math.random() - 0.5) * 1.2 * dt * 8;
      if (pa[i * 3] > 5 || pa[i * 3] < -5) pa[i * 3] *= -0.98;
      if (pa[i * 3 + 1] > 3.4 || pa[i * 3 + 1] < -0.2) pa[i * 3 + 1] = 1.8;
    }
    pos.needsUpdate = true;
    const bucket = Math.round(t * 4);
    if (bucket !== last) {
      last = bucket;
      const c = plot.frame('C(x,t)', 'x', 'C');
      const W = 340, H = 300;
      c.strokeStyle = '#06b6d4'; c.lineWidth = 3; c.beginPath();
      for (let i = 0; i < N; i++) {
        const px = 46 + (i / (N - 1)) * (W - 62);
        const py = (H - 40) - Math.min(1, C[i]) * (H - 70);
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
      c.fillStyle = '#94a3b8'; c.fillText('恒定源 C(0)=1', 60, 60);
      plot.tex.needsUpdate = true;
    }
    void t;
  };
}

/** P164 费米面 */
function build_fermi(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 布里渊区（立方盒）
  const bz = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(7, 7, 7)),
    bag.mat(new THREE.MeshBasicMaterial({ color: 0x475569, wireframe: true, transparent: true, opacity: 0.5 })),
  );
  g.add(bz);
  // 自由电子费米球
  const sphere = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(2.6, 36, 24)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, transparent: true, opacity: 0.35, roughness: 0.4 })),
  );
  g.add(sphere);
  // 费米面上的态（点云）
  const NP = 260;
  const pg = bag.geo(new THREE.BufferGeometry());
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  g.add(new THREE.Points(pg, bag.mat(new THREE.PointsMaterial({ color: PAL.gold, size: 0.14, sizeAttenuation: true }))));
  const parr = (pg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  for (let i = 0; i < NP; i++) {
    const u = Math.random() * Math.PI * 2;
    const v = Math.acos(2 * Math.random() - 1);
    parr[i * 3] = 2.6 * Math.sin(v) * Math.cos(u);
    parr[i * 3 + 1] = 2.6 * Math.cos(v);
    parr[i * 3 + 2] = 2.6 * Math.sin(v) * Math.sin(u);
  }
  const plot = makePlot(bag, THREE, 340, 300, 3.8, 6.8, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '费米面：k_F = (3π²n)^{1/3}，E_F = ℏ²k_F²/2m', color: '#f8fafc' },
    { text: '金属输运、比热、磁振荡（dHvA）都由费米面附近态决定', color: '#94a3b8' },
    { text: '读数：青球 = 自由电子费米面，金点 = 费米面上的量子态', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawDOS = (fill: number) => {
    const c = plot.frame('态密度 g(E)', 'E', 'g(E)');
    const W = 340, H = 300;
    c.strokeStyle = '#22c55e'; c.lineWidth = 3; c.beginPath();
    for (let i = 1; i <= 80; i++) {
      const E = (i / 80) * 3;
      const gE = Math.sqrt(Math.max(0, E));
      const px = 46 + (E / 3) * (W - 62);
      const py = (H - 40) - gE * (H - 70) / Math.sqrt(3);
      if (i === 1) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    const fx = 46 + (fill * 3 / 3) * (W - 62);
    c.strokeStyle = '#fbbf24'; c.setLineDash([5, 5]); c.lineWidth = 2;
    c.beginPath(); c.moveTo(fx, 18); c.lineTo(fx, H - 40); c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#fbbf24'; c.fillText('E_F', fx + 6, 56);
    plot.tex.needsUpdate = true;
  };
  drawDOS(0.55);
  return (t: number) => {
    g.rotation.y = t * 0.2;
    const wob = 1 + 0.05 * Math.sin(t * 1.4);
    sphere.scale.setScalar(wob);
    drawDOS(0.55 + 0.1 * Math.sin(t * 0.4));
    void title;
  };
}

/** P395 压电与铁电材料 */
function build_ferro(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 压电晶体片
  const slab = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(6.4, 0.7, 3.4)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, roughness: 0.4, metalness: 0.3 })),
  );
  g.add(slab);
  // 电极
  const topE = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(6.4, 0.1, 3.4)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, metalness: 0.7, roughness: 0.3 })),
  );
  topE.position.y = 0.45;
  g.add(topE);
  // 电偶极子（可翻转）
  const dipoles: import('three').Mesh[] = [];
  const dipGeo = bag.geo(new THREE.ConeGeometry(0.16, 0.5, 10));
  const dipMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.pink }));
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(dipGeo, dipMat);
    m.position.set((i % 6 - 2.5) * 0.9, 1.4, (Math.floor(i / 6) - 0.5) * 1.2);
    g.add(m);
    dipoles.push(m);
  }
  // 外加电场箭头
  const field = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(3.6, 1.0, 0), 1.4, PAL.red, 0.22, 0.11,
  );
  g.add(field);
  const plot = makePlot(bag, THREE, 340, 300, 3.8, -6.8, 0.8);
  g.add(plot.mesh);
  const piezo = title.includes('压电');
  g.add(panelSprite(THREE, bag, piezo ? [
    { text: '压电效应：S = s^E T + d E，D = d T + ε^T E（线性本构）', color: '#f8fafc' },
    { text: '应力 → 极化 → 表面电荷（石英、PZT 传感器）', color: '#94a3b8' },
    { text: '逆压电：加电场 → 形变，d₃₃ ≈ 300–600 pC/N（PZT）', color: '#fbbf24' },
  ] : [
    { text: '铁电体：P–E 迟滞回线，剩余极化 P_r 与矫顽场 E_c', color: '#f8fafc' },
    { text: '畴结构：相邻偶极子自发取向一致，电场下畴壁移动', color: '#94a3b8' },
    { text: '读数：粉色锥 = 电畴方向，随外场 E 翻转', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  // 铁电迟滞模型（教学近似）：P(u) = tanh(2.4·(sin u − c·cos u))，E = sin u。
  // 90° 正交滞后项 c·cos u 使上/下扫支分离 → 回线打开：剩化 P_r = ±tanh(2.4c)，矫顽场 E_c = ±c/√(1+c²)
  const cLag = 0.32;
  const pOf = (u: number) => Math.tanh(2.4 * (Math.sin(u) - cLag * Math.cos(u)));
  const drawHyst = (E: number, P: number) => {
    const c = plot.frame('P–E 迟滞（真实回线）', 'E', 'P');
    const W = 340, H = 300;
    c.strokeStyle = '#f472b6'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 120; i++) {
      const u = (i / 120) * Math.PI * 2;
      const ee = Math.sin(u);
      const pp = pOf(u);
      const px = 46 + ((ee + 1.3) / 2.6) * (W - 62);
      const py = (H - 40) - ((pp + 1.3) / 2.6) * (H - 70);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    // 剩化 / 矫顽读数（与曲线同一公式，同源）
    const pr = Math.tanh(2.4 * cLag);
    const ec = cLag / Math.sqrt(1 + cLag * cLag);
    c.strokeStyle = '#94a3b8'; c.lineWidth = 2; c.setLineDash([4, 4]);
    [pr, -pr].forEach((p) => {
      const py = (H - 40) - ((p + 1.3) / 2.6) * (H - 70);
      c.beginPath(); c.moveTo(46, py); c.lineTo(46 + ((0 + 1.3) / 2.6) * (W - 62), py); c.stroke();
    });
    c.setLineDash([]);
    c.fillStyle = '#94a3b8'; c.font = '14px sans-serif';
    c.fillText(`P_r = ±${pr.toFixed(2)} (E=0)`, 56, 56);
    c.fillText(`E_c = ±${ec.toFixed(2)} (P=0)`, 56, 76);
    const px = 46 + ((E + 1.3) / 2.6) * (W - 62);
    const py = (H - 40) - ((P + 1.3) / 2.6) * (H - 70);
    c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(px, py, 7, 0, 7); c.fill();
    plot.tex.needsUpdate = true;
  };
  drawHyst(0, pOf(0));
  return (t: number, dt: number) => {
    const u = t * 0.8;
    const Efield = Math.sin(u);
    // 极化含滞后（与回线公式同源）：畴翻转跟随 P 过零（发生在矫顽场 E_c 处，而非 E=0）
    const P = pOf(u);
    dipoles.forEach((m, i) => {
      const flip = Math.sign(P || 1);
      m.rotation.x = flip > 0 ? 0 : Math.PI;
      m.scale.y = 1 + 0.15 * Math.abs(P);
    });
    field.setDirection(new THREE.Vector3(0, Efield >= 0 ? 1 : -1, 0));
    field.setLength(0.8 + Math.abs(Efield) * 1.0, 0.22, 0.11);
    slab.scale.y = 1 + 0.08 * Math.abs(Efield);
    drawHyst(Efield, P);
    void dt;
  };
}

/** P388 薄膜沉积与外延 */
function build_film(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 衬底
  const sub = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(8, 0.7, 4)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 })),
  );
  g.add(sub);
  // 已沉积薄膜（层数渐增）
  const layers: import('three').Mesh[] = [];
  const layerMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, roughness: 0.4, metalness: 0.3, transparent: true, opacity: 0.85 }));
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(bag.geo(new THREE.BoxGeometry(8, 0.16, 4)), layerMat);
    m.position.y = 0.45 + i * 0.17;
    m.visible = i < 2;
    g.add(m);
    layers.push(m);
  }
  // 沉积原子（从上方落下）
  const NA = 40;
  const ag = bag.geo(new THREE.BufferGeometry());
  ag.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NA * 3), 3));
  g.add(new THREE.Points(ag, bag.mat(new THREE.PointsMaterial({ color: PAL.gold, size: 0.16, sizeAttenuation: true }))));
  const aa = (ag.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  const seed = new Float32Array(NA);
  for (let i = 0; i < NA; i++) {
    seed[i] = Math.random();
    aa[i * 3] = (Math.random() - 0.5) * 7.6;
    aa[i * 3 + 1] = 4 + Math.random() * 3;
    aa[i * 3 + 2] = (Math.random() - 0.5) * 3.6;
  }
  g.add(panelSprite(THREE, bag, [
    { text: '薄膜外延：晶格匹配 Δa/a < 1% → 层状（Frank–van der Merwe）生长', color: '#f8fafc' },
    { text: '失配大 → 岛状（Volmer–Weber）生长；应变能积累到临界厚度产生失配位错', color: '#94a3b8' },
    { text: '读数：金点 = 沉积原子，青层 = 已长成薄膜（逐层堆叠）', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const agAttr = ag.getAttribute('position') as import('three').BufferAttribute;
  return (t: number, dt: number) => {
    for (let i = 0; i < NA; i++) {
      aa[i * 3 + 1] -= dt * (1.4 + seed[i] * 1.4);
      if (aa[i * 3 + 1] < 0.9) {
        aa[i * 3 + 1] = 4 + Math.random() * 3;
        aa[i * 3] = (Math.random() - 0.5) * 7.6;
        aa[i * 3 + 2] = (Math.random() - 0.5) * 3.6;
      }
    }
    agAttr.needsUpdate = true;
    const grown = Math.min(5, 2 + Math.floor((t * 0.4) % 5));
    layers.forEach((m, i) => { m.visible = i < grown; });
    g.rotation.y = 0.15 * Math.sin(t * 0.3);
  };
}

/** P379 疲劳与裂纹扩展 */
function build_fracture(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 试样（带缺口）
  const bar = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(9, 2.4, 1.2)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.6, metalness: 0.3 })),
  );
  g.add(bar);
  // 裂纹（沿 x 扩展的折线）
  const crackGeo = bag.geo(new THREE.BufferGeometry());
  crackGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(80 * 3), 3));
  const crack = new THREE.Line(crackGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.red })));
  crack.position.set(0, 0, 0.62);
  g.add(crack);
  // 裂纹尖端塑性区
  const tip = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.3, 16, 12)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.amber, emissive: 0xb45309, emissiveIntensity: 0.8 })),
  );
  g.add(tip);
  // 应力循环箭头
  const load1 = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-3.6, 1.6, 0), 1.2, PAL.cyan, 0.2, 0.1);
  const load2 = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(3.6, -1.6, 0), 1.2, PAL.cyan, 0.2, 0.1);
  g.add(load1); g.add(load2);
  const plot = makePlot(bag, THREE, 340, 300, 3.8, 6.8, 0.8);
  g.add(plot.mesh);
  // S–N 面板（Basquin 关系 σ_a(2N_f)^b = σ_f'）：补齐 description 承诺的 S–N 曲线
  const snPlot = makePlot(bag, THREE, 320, 300, 3.6, -6.6, 0.8);
  g.add(snPlot.mesh);
  const dSig = 18;      // 应力范围 Δσ（教学单位）
  const mPar = 3;       // Paris 指数 m
  const cPar = 1e-9;    // Paris 系数 C
  const sigA = 320;     // 名义应力幅（MPa，教学值）
  const bBasq = -0.09;  // Basquin 指数 b
  const dKof = (a: number) => dSig * Math.sqrt(Math.PI * a); // ΔK = Δσ√(πa)，Y=1 中心裂纹
  g.add(panelSprite(THREE, bag, [
    { text: 'Paris 公式：da/dN = C(ΔK)^m，ΔK = Δσ√(πa)（Y=1，C=10⁻⁹, m=3，教学单位）', color: '#f8fafc' },
    { text: '疲劳三阶段：萌生 → 稳态扩展 → 失稳断裂；S–N 寿命由 Basquin σ_a(2N_f)^b = 常数估计', color: '#94a3b8' },
    { text: '读数：红折线 = 裂纹前缘，橙球 = 尖端塑性区；右图 lg-log Paris 线上的金点 = 当前 (ΔK, da/dN)', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawParis = (a: number) => {
    // 真对数坐标 lg(da/dN)–lgΔK：Paris 区为直线，不再钳零
    const c = plot.frame('Paris 律 lg(da/dN)–lgΔK', 'lg ΔK', 'lg(da/dN)');
    const W = 340, H = 300;
    const x0 = Math.log10(dKof(0.4)) - 0.05, x1 = Math.log10(dKof(4.4)) + 0.05;
    const y0 = Math.log10(cPar) + mPar * x0, y1 = Math.log10(cPar) + mPar * x1;
    const px = (lx: number) => 46 + ((lx - x0) / (x1 - x0)) * (W - 62);
    const py = (ly: number) => (H - 40) - ((ly - y0) / (y1 - y0)) * (H - 70);
    c.strokeStyle = '#ef4444'; c.lineWidth = 3; c.beginPath();
    c.moveTo(px(x0), py(y0)); c.lineTo(px(x1), py(y1)); c.stroke();
    const lk = Math.log10(dKof(a));
    const ly = Math.log10(cPar) + mPar * lk;
    c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(px(lk), py(ly), 7, 0, 7); c.fill();
    c.fillStyle = '#94a3b8'; c.font = '14px sans-serif';
    c.fillText(`ΔK = ${dKof(a).toFixed(1)}, da/dN = ${(cPar * Math.pow(dKof(a), mPar)).toExponential(1)}`, 56, 96);
    plot.tex.needsUpdate = true;
  };
  const drawSN = (Nfail: number, N: number) => {
    const c = snPlot.frame('S–N 曲线（Basquin）', 'lg N_f', 'σ_a (MPa)');
    const W = 320, H = 300;
    const X0 = 3, X1 = 10, Y0 = 150, Y1 = 400;
    const px = (lx: number) => 46 + ((lx - X0) / (X1 - X0)) * (W - 62);
    const py = (s: number) => (H - 40) - ((s - Y0) / (Y1 - Y0)) * (H - 70);
    c.strokeStyle = '#06b6d4'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 60; i++) {
      const lx = X0 + (i / 60) * (X1 - X0);
      const s = sigA * Math.pow(2 * Math.pow(10, lx), bBasq);
      if (i === 0) c.moveTo(px(lx), py(s)); else c.lineTo(px(lx), py(s));
    }
    c.stroke();
    const lf = Math.log10(Math.max(1e3, Math.min(1e10, Nfail)));
    c.fillStyle = '#fbbf24'; c.beginPath();
    c.arc(px(lf), py(sigA * Math.pow(2 * Math.max(1e3, Math.min(1e10, Nfail)), bBasq)), 7, 0, 7); c.fill();
    c.fillStyle = '#94a3b8'; c.font = '14px sans-serif';
    c.fillText(`σ_a = ${sigA} MPa, b = ${bBasq}`, 56, 56);
    c.fillText(`N = ${Math.round(N)} → N_f ≈ ${Nfail.toExponential(1)}`, 56, 76);
    snPlot.tex.needsUpdate = true;
  };
  drawParis(1); drawSN(1e5, 1e4);
  const ca = crackGeo.getAttribute('position') as import('three').BufferAttribute;
  const carr = ca.array as Float32Array;
  let lastP = -1;
  return (t: number, dt: number) => {
    const N = 600 * (0.5 + 0.5 * Math.sin(t * 0.18) + 0.5); // 循环数示意
    const a = Math.min(4.4, 0.4 + Math.log10(1 + N) * 1.1);
    for (let i = 0; i < 80; i++) {
      const u = i / 79;
      const x = -4.5 + u * a;
      carr[i * 3] = x;
      carr[i * 3 + 1] = 0.18 * Math.sin(u * 9) * u;
      carr[i * 3 + 2] = 0;
    }
    ca.needsUpdate = true;
    tip.position.set(-4.5 + a, 0.18 * Math.sin((a / 4.4) * 9), 0.62);
    tip.scale.setScalar(1 + 0.3 * Math.sin(t * 6));
    const stress = Math.sin(t * 3);
    load1.setLength(0.8 + stress * 0.4, 0.2, 0.1);
    load2.setLength(0.8 + stress * 0.4, 0.2, 0.1);
    // 读数 5Hz 刷新（与裂纹几何 a、循环数 N 同源）
    const bucket = Math.round(t * 5);
    if (bucket !== lastP) {
      lastP = bucket;
      // 剩余寿命估算：N_f ≈ a/(da/dN)（当前裂纹长除以当前扩展速率）
      const dadN = cPar * Math.pow(dKof(a), mPar);
      drawParis(a);
      drawSN(a / dadN, N);
    }
    void dt;
  };
}

/** P33 霍尔效应, P532 霍尔效应与载流子判型 */
function build_hall(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const carriers = title.includes('载流子') || title.includes('判型');
  // 样品（薄片）
  const slab = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(7, 0.4, 3.2)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.4 })),
  );
  g.add(slab);
  // 磁场 B（竖直，穿入样品）
  for (let i = 0; i < 3; i++) {
    g.add(new THREE.ArrowHelper(
      new THREE.Vector3(0, -1, 0), new THREE.Vector3((i - 1) * 2.2, 2.6, 0), 1.8, PAL.violet, 0.2, 0.1,
    ));
  }
  // 载流子：B 箭头沿 −y（竖直穿入样品），电子（青）沿 −x 漂移，F=−e(v×B) 指向 −z，偏向 −z 侧壁；
  // 判型图再加空穴（粉），沿 +x 漂移，F=+e(v×B) 同样指向 −z——与电子同侧偏转，仅积累电荷符号不同
  const NP = 40;
  const makeCarriers = (color: number) => {
    const cg = bag.geo(new THREE.BufferGeometry());
    cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
    const pts = new THREE.Points(cg, bag.mat(new THREE.PointsMaterial({
      color, size: 0.18, sizeAttenuation: true,
    })));
    g.add(pts);
    const arr = (cg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    for (let i = 0; i < NP; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 6.4;
      arr[i * 3 + 1] = 0.3;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 2.6;
    }
    return { cg, arr };
  };
  const elec = makeCarriers(PAL.cyan);
  const hole = carriers ? makeCarriers(PAL.pink) : null;
  // 侧壁电荷积累密度条：载流子偏向 −z 侧，该侧积累条高度随积累量增长
  // n 型（电子）在 −z 侧积累负电荷（青）；判型图另示 p 型（空穴）同侧积累正电荷（金）
  const barGeo = bag.geo(new THREE.BoxGeometry(6.2, 1, 0.1));
  barGeo.translate(0, 0.5, 0); // 以底边为原点，向上生长
  const makeBar = (color: number, emissive: number, z: number) => {
    const b = new THREE.Mesh(barGeo, bag.mat(new THREE.MeshStandardMaterial({
      color, emissive, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.2,
    })));
    b.position.set(0, 0.2, z); // 贴在样品侧壁外侧（slab 顶面 y=0.2）
    g.add(b);
    return b;
  };
  // 电子偏向 −z：n 型负积累条在 −z 侧，对侧（+z）感生正电荷条
  const barNeg = makeBar(PAL.cyan, 0x0e7490, -1.62);
  const barPos = makeBar(PAL.gold, 0xb45309, carriers ? -1.62 : 1.62);
  // 判型图：电子与空穴同侧（−z）偏转，青/金两条并列于同一侧壁表示"同侧积累、符号相反"
  const barSX = carriers ? 0.5 : 1;
  if (carriers) {
    barNeg.position.x = -1.55; // 青条（电子积累，负）占该壁半幅
    barPos.position.x = 1.55;  // 金条（空穴积累，正）占另半幅
  }
  // 霍尔电压表计（样品侧面电极）
  const probe = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.3, 0.7, 0.3)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, metalness: 0.6, roughness: 0.4 })),
  );
  probe.position.set(0, 0, 1.8);
  g.add(probe);
  const probe2 = probe.clone();
  probe2.position.z = -1.8;
  g.add(probe2);
  const plot = makePlot(bag, THREE, 340, 300, 3.8, 6.8, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, carriers ? [
    { text: '载流子判型：青=电子（n 型），粉=空穴（p 型）', color: '#f8fafc' },
    { text: 'R_H=E_y/(j_x B_z)：n 型 −1/(ne)，p 型 +1/(pe)', color: '#94a3b8' },
    { text: '读数：两者同侧（−z）偏转，青/金条=同侧积累的负/正电荷，V_H 符号 ∝ 1/q', color: '#fbbf24' },
  ] : [
    { text: '霍尔效应：侧面电荷积累 → 横向电场 E_y（V_H=IB/nqd）', color: '#f8fafc' },
    { text: 'R_H=E_y/(j_x B_z) = −1/(ne)（电子，n 型）', color: '#94a3b8' },
    { text: '读数：青点=电子单向偏向 −z 侧壁，青/金条=该侧负电荷/对侧正电荷', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawRH = (B: number) => {
    const c = plot.frame('V_H vs B', 'B', 'V_H');
    const W = 340, H = 300;
    c.strokeStyle = '#475569'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(46, H / 2); c.lineTo(W - 14, H / 2); c.stroke();
    // 斜率线：sgn=−1 → R_H<0（n 型），sgn=+1 → R_H>0（p 型）
    const line = (sgn: number, color: string) => {
      c.strokeStyle = color; c.lineWidth = 3; c.beginPath();
      c.moveTo(46, H / 2);
      c.lineTo(W - 14, H / 2 - sgn * (H / 2 - 40) * 0.85);
      c.stroke();
      const px = 46 + (B / 2) * (W - 62);
      c.fillStyle = color; c.beginPath();
      c.arc(px, H / 2 - sgn * (H / 2 - 40) * 0.85 * (B / 2), 7, 0, 7); c.fill();
    };
    c.font = '15px sans-serif'; c.textAlign = 'left';
    if (carriers) {
      line(-1, '#06b6d4'); // 电子：R_H = −1/(ne) → 斜率<0
      line(1, '#f472b6');  // 空穴：R_H = +1/(pe) → 斜率>0
      c.fillStyle = '#06b6d4'; c.fillText('n 型 −1/(ne)：斜率<0', 58, 56);
      c.fillStyle = '#f472b6'; c.fillText('p 型 +1/(pe)：斜率>0', 58, 80);
    } else {
      line(-1, '#06b6d4'); // 单一电子载流子：R_H<0
      c.fillStyle = '#94a3b8'; c.fillText('n 型（电子）R_H<0：斜率<0', 58, 56);
    }
    plot.tex.needsUpdate = true;
  };
  drawRH(1);
  return (t: number, dt: number) => {
    const B = 1 + 0.8 * Math.sin(t * 0.5);
    // 单组载流子推进：漂移 + 沿同一方向偏向侧壁（去掉 Math.sign(z) 的两侧对称散开）
    const adv = (cs: { cg: import('three').BufferGeometry; arr: Float32Array }, drift: number, wall: number) => {
      for (let i = 0; i < NP; i++) {
        cs.arr[i * 3] += drift * dt * 2.4;
        if (cs.arr[i * 3] > 3.4) cs.arr[i * 3] = -3.4;
        if (cs.arr[i * 3] < -3.4) cs.arr[i * 3] = 3.4;
        // Lorentz 力使载流子整体偏向同一侧壁，抵达后贴壁堆积
        cs.arr[i * 3 + 2] += wall * 0.3 * B * dt;
        if (cs.arr[i * 3 + 2] > 1.5) cs.arr[i * 3 + 2] = 1.5;
        if (cs.arr[i * 3 + 2] < -1.5) cs.arr[i * 3 + 2] = -1.5;
      }
      (cs.cg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    };
    adv(elec, -1, -1);            // 电子：沿 −x 漂移，F=−e(v×B) 沿 −z，偏向 −z 侧壁
    if (hole) adv(hole, 1, -1);  // 空穴：沿 +x 漂移，F=+e(v×B) 亦沿 −z——与电子同侧偏转（判型原理）
    // 侧壁电荷积累量随 |B| 增减 → 密度条高度变化（判型图保留半幅分割）
    const acc = (0.15 + 0.85 * Math.abs(B) / 1.8) * 1.1;
    barNeg.scale.set(barSX, acc, 1);
    barPos.scale.set(barSX, acc, 1);
    probe.scale.setScalar(1 + 0.2 * Math.abs(Math.sin(t * 2)));
    probe2.scale.setScalar(1 + 0.2 * Math.abs(Math.sin(t * 2 + Math.PI)));
    drawRH(Math.max(0, B));
  };
}

/** P329 迈斯纳效应实验 */
function build_meissner(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 超导体（立方块）
  const sc = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(3.4, 2.0, 3.4)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, roughness: 0.3, metalness: 0.5, emissive: 0x0e7490, emissiveIntensity: 0.35 })),
  );
  sc.position.y = -1.6;
  g.add(sc);
  // 永磁体（悬浮在其上方）
  const magnet = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.9, 0.9, 0.7, 24)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, metalness: 0.6, roughness: 0.4 })),
  );
  magnet.position.y = 1.4;
  g.add(magnet);
  // 磁力线（被排挤到超导体外侧）
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const pts: import('three').Vector3[] = [];
    for (let s = 0; s <= 40; s++) {
      const u = s / 40;
      const y = 2.0 - u * 4.4;
      const r = 1.2 + Math.sin(u * Math.PI) * 2.4;
      pts.push(new THREE.Vector3(Math.cos(ang) * r, y, Math.sin(ang) * r));
    }
    g.add(new THREE.Line(
      bag.geo(new THREE.BufferGeometry().setFromPoints(pts)),
      bag.mat(new THREE.LineBasicMaterial({ color: PAL.violet, transparent: true, opacity: 0.7 })),
    ));
  }
  // 感应表面电流环
  const cur = new THREE.Mesh(
    bag.geo(new THREE.TorusGeometry(1.7, 0.07, 8, 40)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold })),
  );
  cur.rotation.x = Math.PI / 2;
  cur.position.y = -0.6;
  g.add(cur);
  g.add(panelSprite(THREE, bag, [
    { text: '迈斯纳效应：超导体内部 B = 0（完全抗磁性），χ = −1', color: '#f8fafc' },
    { text: '表面屏蔽电流产生的磁场抵消外场 → 磁通被排出', color: '#94a3b8' },
    { text: '读数：紫线 = 被排挤的磁力线，金环 = 感应屏蔽电流，磁体稳定悬浮', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  return (t: number) => {
    // 磁体稳定悬浮（抗磁悬浮示意）
    magnet.position.y = 1.4 + 0.25 * Math.sin(t * 1.3);
    magnet.rotation.y = t * 0.5;
    sc.scale.y = 1 + 0.03 * Math.sin(t * 2);
    cur.rotation.z = t * 0.6;
    g.rotation.y = t * 0.12;
  };
}

/** P376 马氏体相变, P365 二元相图与吉布斯自由能, P377 形状记忆合金 */
function build_phase(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const diagram = title.includes('相图');
  const memory = title.includes('形状记忆');

  if (diagram) {
    // 二元相图（画布）：液相线/固相线 + 共晶点
    const plot = makePlot(bag, THREE, 400, 340, 4.6, 0, 0.8);
    g.add(plot.mesh);
    // G-x 自由能曲线（两条抛物线）
    const gPlot = makePlot(bag, THREE, 340, 300, 3.8, 6.6, 0.8);
    g.add(gPlot.mesh);
    // 两相组织示意（左：晶粒，右：层片）
    const grainGeo = bag.geo(new THREE.IcosahedronGeometry(0.5, 1));
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(grainGeo, bag.mat(new THREE.MeshStandardMaterial({ color: i % 2 ? PAL.cyan : PAL.amber, roughness: 0.5 })));
      m.position.set(-6 + (i % 5) * 0.9, -2.4 + Math.floor(i / 5) * 0.9, 0);
      g.add(m);
    }
    g.add(panelSprite(THREE, bag, [
      { text: '二元相图：G = H − TS，平衡相使总自由能最小（公切线）', color: '#f8fafc' },
      { text: '液相线以上全液，固相线以下全固，之间为两相区（杠杆规则）', color: '#94a3b8' },
      { text: '读数：共晶点 E：L → α + β（恒温转变）', color: '#fbbf24' },
    ], [0, 4.4, 0], 7.8, 'center'));
    return (t: number) => {
      g.rotation.y = 0.1 * Math.sin(t * 0.3);
      const c = plot.frame('T–x 二元相图', 'x_B', 'T');
      const W = 400, H = 340;
      // 液相线
      c.strokeStyle = '#f59e0b'; c.lineWidth = 3; c.beginPath();
      for (let i = 0; i <= 60; i++) {
        const x = i / 60;
        const T = 0.85 - 0.3 * Math.sin(Math.PI * x) - 0.1 * x;
        const px = 46 + x * (W - 62);
        const py = 40 + (1 - T) * (H - 80);
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
      // 固相线
      c.strokeStyle = '#06b6d4'; c.beginPath();
      for (let i = 0; i <= 60; i++) {
        const x = i / 60;
        const T = 0.6 - 0.35 * Math.sin(Math.PI * x * 0.9) - 0.05 * x;
        const px = 46 + x * (W - 62);
        const py = 40 + (1 - T) * (H - 80);
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
      c.fillStyle = '#f8fafc'; c.fillText('橙=液相线  青=固相线', 58, 60);
      plot.tex.needsUpdate = true;
      // G-x 曲线
      const gc = gPlot.frame('G(x) 自由能', 'x', 'G');
      const GW = 340, GH = 300;
      gc.strokeStyle = '#22c55e'; gc.lineWidth = 3; gc.beginPath();
      for (let i = 0; i <= 60; i++) {
        const x = i / 60;
        const G = Math.pow(x - 0.35, 2) * 1.6 + 0.1;
        const px = 46 + x * (GW - 62);
        const py = (GH - 40) - G * (GH - 80) / 2;
        if (i === 0) gc.moveTo(px, py); else gc.lineTo(px, py);
      }
      gc.stroke();
      gc.strokeStyle = '#f472b6'; gc.beginPath();
      for (let i = 0; i <= 60; i++) {
        const x = i / 60;
        const G = Math.pow(x - 0.65, 2) * 1.6 + 0.14;
        const px = 46 + x * (GW - 62);
        const py = (GH - 40) - G * (GH - 80) / 2;
        if (i === 0) gc.moveTo(px, py); else gc.lineTo(px, py);
      }
      gc.stroke();
      gc.strokeStyle = '#fbbf24'; gc.setLineDash([5, 5]); gc.lineWidth = 2;
      gc.beginPath(); gc.moveTo(46, GH - 40 - 1.05 * (GH - 80) / 2); gc.lineTo(GW - 14, GH - 40 - 1.05 * (GH - 80) / 2); gc.stroke();
      gc.setLineDash([]);
      gc.fillStyle = '#fbbf24'; gc.fillText('公切线', 60, 70);
      gPlot.tex.needsUpdate = true;
    };
  }

  if (memory) {
    // 形状记忆合金：一条可弯曲的丝带 —— 低温外力掰弯（马氏体孪晶变形）→
    // 升温越过 As/Af 发生逆转变、曲率回零恢复原状 → 冷却后再可形变
    const CYC = 14;          // 一个「掰弯 → 加热回直 → 冷却」周期（秒）
    const T_LO = 24, T_HI = 120; // 低温 / 加热峰值（°C）
    const AS = 60, AF = 80;      // 逆转变开始 / 完成温度（°C）
    const LEN = 5.2, WID = 0.62, SEG = 72, BASE_Y = 0.3, K_MAX = 0.23;
    const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
    // 温度循环：0~3.5 低温 → 3.5~11 升温 → 11~14 降温
    const tempAt = (s: number) => {
      if (s < 3.5) return T_LO;
      if (s < 11) return T_LO + ((s - 3.5) / 7.5) * (T_HI - T_LO);
      return T_HI - ((s - 11) / 3) * (T_HI - T_LO);
    };
    // 曲率：低温被外力掰弯；升温跨 As→Af 时回直；冷却段保持原状
    const bendAt = (s: number, T: number) => {
      if (s < 3) { const u = s / 3; return u * u * (3 - 2 * u); } // 外力掰弯 0→1
      if (s >= 11) return 0;
      if (T <= AS) return 1;
      if (T >= AF) return 0;
      return 1 - (T - AS) / (AF - AS);
    };
    // 丝带：按弧长积分中心线（曲率 κ·s），逐帧重建顶点
    const ribbonGeo = bag.geo(new THREE.PlaneGeometry(LEN, WID, SEG, 1));
    const basePos = Float32Array.from(
      (ribbonGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array,
    );
    const ribbonMat = bag.mat(new THREE.MeshStandardMaterial({
      color: PAL.cyan, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide,
      emissive: 0x0e7490, emissiveIntensity: 0.25,
    }));
    const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    g.add(ribbon);
    const cx = new Float64Array(SEG + 1);
    const cy = new Float64Array(SEG + 1);
    const nx = new Float64Array(SEG + 1);
    const ny = new Float64Array(SEG + 1);
    const shape = (bend: number) => {
      const ds = LEN / SEG;
      const k = bend * K_MAX;
      let x = -LEN / 2, y = BASE_Y, phi = 0;
      for (let i = 0; i <= SEG; i++) {
        cx[i] = x; cy[i] = y; nx[i] = -Math.sin(phi); ny[i] = Math.cos(phi);
        x += Math.cos(phi) * ds; y += Math.sin(phi) * ds; phi += k * ds;
      }
    };
    const applyShape = () => {
      const pos = ribbonGeo.getAttribute('position') as import('three').BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const u = basePos[i] / LEN + 0.5; // 0..1 沿丝带长度
        const f = u * SEG;
        const i0 = Math.min(SEG, Math.floor(f));
        const i1 = Math.min(SEG, i0 + 1);
        const w = f - i0;
        const sx = nx[i0] + (nx[i1] - nx[i0]) * w;
        const sy = ny[i0] + (ny[i1] - ny[i0]) * w;
        const off = basePos[i + 1]; // ±WID/2 横向偏移
        arr[i] = (cx[i0] + (cx[i1] - cx[i0]) * w) + sx * off;
        arr[i + 1] = (cy[i0] + (cy[i1] - cy[i0]) * w) + sy * off;
        arr[i + 2] = 0;
      }
      pos.needsUpdate = true;
      ribbonGeo.computeBoundingSphere();
    };
    // 左端夹持（形变的施力端）
    const clampBox = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(0.44, 1.0, 0.9)),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, metalness: 0.6, roughness: 0.4 })),
    );
    clampBox.position.set(-LEN / 2 - 0.1, BASE_Y, 0);
    g.add(clampBox);
    // 原始直态基准线（恢复目标）
    g.add(lineFrom(THREE, bag, [
      new THREE.Vector3(-LEN / 2, BASE_Y, 0.1),
      new THREE.Vector3(LEN / 2, BASE_Y, 0.1),
    ], PAL.slate, true));
    // 外力箭头（掰弯阶段指向自由端）
    const force = new THREE.ArrowHelper(
      new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 0), 1.2, PAL.red, 0.28, 0.16,
    );
    g.add(force);
    bag.trackTree(force);
    // 加热器（升温阶段发光）
    const heaterMat = bag.mat(new THREE.MeshBasicMaterial({
      color: PAL.red, transparent: true, opacity: 0.08,
    }));
    const heater = new THREE.Mesh(bag.geo(new THREE.BoxGeometry(4.0, 0.22, 1.0)), heaterMat);
    heater.position.set(0.2, -0.18, 0);
    g.add(heater);
    // 温度曲线画布（As/Af 温标）
    const plot = makePlot(bag, THREE, 340, 300, 4.0, 6.4, 1.5);
    g.add(plot.mesh);
    g.add(panelSprite(THREE, bag, [
      { text: '形状记忆 = 马氏体变体择优取向 + 升温逆转变', color: '#f8fafc' },
      { text: '低温掰弯（孪晶变形）→ 升温 As=60°C、Af=80°C 回直', color: '#94a3b8' },
      { text: '读数：红箭头=外力，红板=加热；过 Af 回直，冷却后再变形', color: '#fbbf24' },
    ], [0, 4.4, 0], 7.8, 'center'));
    const stateAt = (s: number, T: number) => {
      if (s < 3) return '外力掰弯：马氏体孪晶变形';
      if (s < 3.5) return '卸载保形：低温马氏体稳定';
      if (s >= 11) return '冷却中：A→M 自协调，仍为直态';
      if (T >= AF) return '升温 >Af：回直完成（M→A）';
      if (T > AS) return '升温 As→Af：曲率回零中';
      return '升温中：尚未达 As';
    };
    const drawT = (tau: number, T: number, state: string) => {
      const c = plot.frame('T 升降温与 As/Af', 't（周期）', 'T (°C)');
      const W = 340, H = 300;
      const yOf = (Tc: number) => (H - 40) - (Tc / 160) * (H - 80);
      // As / Af 温标线
      c.strokeStyle = '#fbbf24'; c.lineWidth = 2; c.setLineDash([5, 5]);
      c.beginPath(); c.moveTo(46, yOf(AF)); c.lineTo(W - 14, yOf(AF)); c.stroke();
      c.beginPath(); c.moveTo(46, yOf(AS)); c.lineTo(W - 14, yOf(AS)); c.stroke();
      c.setLineDash([]);
      c.fillStyle = '#fbbf24'; c.font = '15px sans-serif'; c.textAlign = 'left';
      c.fillText(`Af = ${AF}°C`, 54, yOf(AF) - 6);
      c.fillText(`As = ${AS}°C`, 54, yOf(AS) - 6);
      // 整个周期的温度曲线
      c.strokeStyle = '#f472b6'; c.lineWidth = 3; c.beginPath();
      for (let i = 0; i <= 100; i++) {
        const s = (i / 100) * CYC;
        const px = 46 + (s / CYC) * (W - 62);
        const py = yOf(tempAt(s));
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
      // 当前温度标记 + 状态读数
      c.fillStyle = '#f8fafc';
      c.beginPath(); c.arc(46 + (tau / CYC) * (W - 62), yOf(T), 8, 0, 7); c.fill();
      c.font = 'bold 17px sans-serif'; c.fillText(`T = ${T.toFixed(0)} °C`, 56, 56);
      c.fillStyle = '#94a3b8'; c.font = '15px sans-serif'; c.fillText(state, 56, 80);
      plot.tex.needsUpdate = true;
    };
    // 马氏体（低温，青）→ 奥氏体（高温，橙）的相变配色
    const colM = new THREE.Color(PAL.cyan), colA = new THREE.Color(PAL.amber);
    const emM = new THREE.Color(0x0e7490), emA = new THREE.Color(0xb45309);
    return (t: number, dt: number) => {
      const tau = t % CYC;
      const T = tempAt(tau);
      shape(bendAt(tau, T));
      applyShape();
      const aust = clamp01((T - AS) / (AF - AS));
      ribbonMat.color.lerpColors(colM, colA, aust);
      ribbonMat.emissive.lerpColors(emM, emA, aust);
      ribbonMat.emissiveIntensity = 0.2 + 0.55 * aust;
      // 外力只在掰弯阶段出现，作用在自由端
      force.visible = tau < 3;
      force.position.set(cx[SEG] + 0.15, cy[SEG] + 1.35, 0.5);
      force.scale.setScalar(0.85 + 0.25 * Math.sin(t * 5));
      // 加热器只在升温阶段发光
      const heating = tau >= 3.5 && tau < 11;
      heaterMat.opacity = heating ? 0.4 + 0.22 * Math.sin(t * 6) : 0.08;
      g.rotation.y = 0.12 * Math.sin(t * 0.35);
      drawT(tau, T, stateAt(tau, T));
      void dt;
    };
  }

  // 马氏体相变：层片组织 + 可逆相变动画
  const variants: import('three').Mesh[] = [];
  const vMatA = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, roughness: 0.5 }));
  const vMatB = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.pink, roughness: 0.5 }));
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(bag.geo(new THREE.BoxGeometry(0.7, 3.4, 1.6)), vMatA);
    m.position.set((i - 8) * 0.75, 0, 0);
    m.rotation.z = (i % 2 ? 1 : -1) * 0.25;
    g.add(m);
    variants.push(m);
  }
  g.add(panelSprite(THREE, bag, [
    { text: '马氏体相变：无扩散、切变型（钢中 fcc→bct），表面浮凸', color: '#f8fafc' },
    { text: 'K–S 取向关系：{111}_γ ∥ {110}_α，惯习面 ≈ {225}', color: '#94a3b8' },
    { text: '读数：片层取向交替（孪晶），相变前沿往复扫过', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  return (t: number, dt: number) => {
    const u = Math.sin(t * 0.5) * 0.5 + 0.5;
    variants.forEach((m, i) => {
      const on = u > (i / 16);
      m.material = on ? vMatB : vMatA;
      m.rotation.z = (i % 2 ? 1 : -1) * (0.15 + 0.3 * u);
      m.scale.y = 1 + 0.06 * Math.sin(t * 3 + i);
    });
    g.rotation.y = 0.15 * Math.sin(t * 0.35);
    void dt;
  };
}

/** P390 纳米颗粒与等离激元 */
function build_plasmon(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 金属纳米颗粒
  const np = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(1.5, 40, 28)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, metalness: 0.8, roughness: 0.25 })),
  );
  g.add(np);
  // 表面等离激元振荡（电子云位移）
  const cloud = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(1.7, 32, 22)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.4 })),
  );
  g.add(cloud);
  // 入射光（偏振方向）
  const pol = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-5, 2.6, 0), 2.2, PAL.red, 0.24, 0.12);
  g.add(pol);
  // 散射/吸收截面谱
  const plot = makePlot(bag, THREE, 360, 320, 4.2, 6.6, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '局域表面等离激元 LSPR：入射场驱动电子云集体振荡', color: '#f8fafc' },
    { text: 'Mie 共振条件 Re ε(ω) = −2ε_m，共振时消光截面极大', color: '#94a3b8' },
    { text: '读数：青色电子云相对核位移（偶极振荡），粒径/介质改变峰位', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawSpec = (lam: number) => {
    const c = plot.frame('消光谱 σ_ext', 'λ (nm)', 'σ');
    const W = 360, H = 320;
    c.strokeStyle = '#fbbf24'; c.lineWidth = 3; c.beginPath();
    for (let i = 1; i <= 120; i++) {
      const l = 400 + (i / 120) * 400;
      const x = (l - lam) / 70;
      const s = Math.exp(-x * x);
      const px = 46 + ((l - 400) / 400) * (W - 62);
      const py = (H - 40) - s * (H - 70);
      if (i === 1) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    const px = 46 + ((lam - 400) / 400) * (W - 62);
    c.strokeStyle = '#f8fafc'; c.setLineDash([5, 5]); c.lineWidth = 2;
    c.beginPath(); c.moveTo(px, 18); c.lineTo(px, H - 40); c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#f8fafc'; c.fillText(`λ_max≈${Math.round(lam)}nm`, px + 6, 56);
    plot.tex.needsUpdate = true;
  };
  drawSpec(530);
  return (t: number, dt: number) => {
    // 电子云偶极振荡
    const osc = Math.sin(t * 3.2);
    cloud.position.x = osc * 0.5;
    cloud.scale.set(1 + 0.06 * osc, 1 - 0.04 * osc, 1 - 0.04 * osc);
    np.scale.setScalar(1 + 0.03 * Math.sin(t * 3.2 + 1));
    pol.setDirection(new THREE.Vector3(Math.cos(t * 0.8), Math.sin(t * 0.8), 0));
    const lam = 520 + 60 * Math.sin(t * 0.3);
    drawSpec(lam);
    void dt;
  };
}

/** P464 半导体 PN 结 */
function build_pn(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // n 型 / p 型 区
  const nRegion = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(4, 3.4, 2.6)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x1d4ed8, transparent: true, opacity: 0.6, roughness: 0.6 })),
  );
  nRegion.position.x = -2.2;
  g.add(nRegion);
  const pRegion = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(4, 3.4, 2.6)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xbe185d, transparent: true, opacity: 0.6, roughness: 0.6 })),
  );
  pRegion.position.x = 2.2;
  g.add(pRegion);
  // 空间电荷区（耗尽层）
  const dep = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(1.4, 3.6, 2.8)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.35 })),
  );
  g.add(dep);
  // 载流子（电子/空穴）
  const NP = 30;
  const eg = bag.geo(new THREE.BufferGeometry());
  eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  const elec = new THREE.Points(eg, bag.mat(new THREE.PointsMaterial({ color: PAL.cyan, size: 0.17, sizeAttenuation: true })));
  g.add(elec);
  const hg = bag.geo(new THREE.BufferGeometry());
  hg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  const hole = new THREE.Points(hg, bag.mat(new THREE.PointsMaterial({ color: PAL.pink, size: 0.17, sizeAttenuation: true })));
  g.add(hole);
  const ea = (eg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  const ha = (hg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  for (let i = 0; i < NP; i++) {
    ea[i * 3] = -3.8 + Math.random() * 3.2; ea[i * 3 + 1] = (Math.random() - 0.5) * 3; ea[i * 3 + 2] = (Math.random() - 0.5) * 2.4;
    ha[i * 3] = 0.6 + Math.random() * 3.2; ha[i * 3 + 1] = (Math.random() - 0.5) * 3; ha[i * 3 + 2] = (Math.random() - 0.5) * 2.4;
  }
  const plot = makePlot(bag, THREE, 340, 300, 3.8, 6.8, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: 'PN 结：内建电场 V_bi = (kT/q) ln(N_A N_D / n_i²)', color: '#f8fafc' },
    { text: '正偏 → 势垒降低 → 扩散电流指数增大；反偏 → 耗尽层加宽', color: '#94a3b8' },
    { text: '读数：青点 = 电子（n 区），粉点 = 空穴（p 区），金带 = 耗尽层', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawIV = (V: number) => {
    const c = plot.frame('I–V 特性', 'V', 'I');
    const W = 340, H = 300;
    c.strokeStyle = '#475569'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(46, H - 60); c.lineTo(W - 14, H - 60); c.stroke();
    c.beginPath(); c.moveTo(140, 18); c.lineTo(140, H - 40); c.stroke();
    c.strokeStyle = '#22c55e'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 100; i++) {
      const vv = (i / 100) * 1.2;
      const I = vv < 0.4 ? 0 : Math.min(1.4, (Math.exp((vv - 0.4) * 6) - 1) / 6);
      const px = 46 + (vv / 1.2) * (W - 62);
      const py = (H - 60) - I * (H - 100) / 1.6;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    const I = V < 0.4 ? 0 : Math.min(1.4, (Math.exp((V - 0.4) * 6) - 1) / 6);
    const px = 46 + (V / 1.2) * (W - 62);
    const py = (H - 60) - I * (H - 100) / 1.6;
    c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(px, py, 7, 0, 7); c.fill();
    plot.tex.needsUpdate = true;
  };
  drawIV(0.6);
  return (t: number, dt: number) => {
    const V = 0.2 + 1.0 * (Math.sin(t * 0.4) * 0.5 + 0.5);
    // 正偏：耗尽层变窄
    const width = 1.6 - 0.8 * Math.min(1, V);
    dep.scale.x = width / 1.4;
    // 载流子扩散过结
    for (let i = 0; i < NP; i++) {
      ea[i * 3] += dt * 1.6 * Math.min(1, V);
      if (ea[i * 3] > 1.2) ea[i * 3] = -3.8;
      ha[i * 3] -= dt * 1.6 * Math.min(1, V);
      if (ha[i * 3] < -1.2) ha[i * 3] = 3.8;
    }
    (eg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    (hg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    drawIV(V);
  };
}

/** P383 橡胶弹性与熵弹簧 */
function build_polymer(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 高分子链（随机行走折线）
  const N = 160;
  const geo = bag.geo(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const chain = new THREE.Line(geo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan })));
  g.add(chain);
  // 交联点（节点）
  const nodes: import('three').Mesh[] = [];
  const nodeGeo = bag.geo(new THREE.SphereGeometry(0.16, 12, 10));
  const nodeMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.amber, emissive: 0xb45309, emissiveIntensity: 0.5 }));
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(nodeGeo, nodeMat);
    g.add(m);
    nodes.push(m);
  }
  // 拉伸箭头
  const pull = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(4.6, 1.8, 0), 1.6, PAL.red, 0.22, 0.11);
  g.add(pull);
  g.add(panelSprite(THREE, bag, [
    { text: '橡胶弹性：F = (ρRT/M_c)(λ − 1/λ²)（熵弹性，非内能）', color: '#f8fafc' },
    { text: '拉伸使链构象数 Ω 减少 → ΔS < 0 → 回复力（熵弹簧）', color: '#94a3b8' },
    { text: '读数：青线 = 高分子链，金点 = 交联点，拉伸往复循环', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const arr = geo.getAttribute('position') as import('three').BufferAttribute;
  const aa = arr.array as Float32Array;
  // 固定随机行走种子
  const walk: import('three').Vector3[] = [];
  let px = 0, py = 0, pz = 0;
  for (let i = 0; i <= N; i++) {
    walk.push(new THREE.Vector3(px, py, pz));
    px += (Math.random() - 0.5) * 0.9;
    py += (Math.random() - 0.5) * 0.9;
    pz += (Math.random() - 0.5) * 0.6;
  }
  return (t: number, dt: number) => {
    const stretch = 1 + 1.4 * (Math.sin(t * 0.6) * 0.5 + 0.5);
    for (let i = 0; i <= N; i++) {
      aa[i * 3] = walk[i].x * stretch;
      aa[i * 3 + 1] = walk[i].y * (1 / Math.sqrt(stretch)) + 0.2 * Math.sin(t * 2 + i * 0.2);
      aa[i * 3 + 2] = walk[i].z;
    }
    arr.needsUpdate = true;
    nodes.forEach((m, i) => {
      const idx = Math.floor((i + 1) * N / 5);
      m.position.set(walk[idx].x * stretch, walk[idx].y / Math.sqrt(stretch), walk[idx].z);
    });
    pull.setLength(0.8 + stretch * 0.5, 0.22, 0.11);
    void dt;
  };
}

/** P386 准晶与五重对称 */
function build_quasicrystal(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // Penrose P2 两种拼块（罗宾逊三角沿腰拼接，边长 长:短 = τ = (1+√5)/2）
  // 风筝 = 两黄金三角(36-72-72)：尖 72°（原点，两长边）、尾 144°、翼 72°；顶点逆时针 → 法线朝外
  const kiteShape = new THREE.Shape();
  kiteShape.moveTo(0, 0);
  kiteShape.lineTo(-1.309, 0.951);
  kiteShape.lineTo(-1.618, 0);
  kiteShape.lineTo(-1.309, -0.951);
  kiteShape.closePath();
  const kiteGeo = bag.geo(new THREE.ExtrudeGeometry(kiteShape, { depth: 0.12, bevelEnabled: false }));
  // 镖 = 两黄金钝角三角(108-36-36)：尖 72°、翼 36°、凹口内反射角 216°（凹口点回缩到 −x=−1 处）
  // 顶点顺时针 → 三角化法线反向， ExtrudeGeometry 对凹四边形正常
  const dartShape = new THREE.Shape();
  dartShape.moveTo(0, 0);
  dartShape.lineTo(-1.309, -0.951);
  dartShape.lineTo(-1, 0);
  dartShape.lineTo(-1.309, 0.951);
  dartShape.closePath();
  const dartGeo = bag.geo(new THREE.ExtrudeGeometry(dartShape, { depth: 0.12, bevelEnabled: false }));
  const matA = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, roughness: 0.5, transparent: true, opacity: 0.9 }));
  const matB = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.pink, roughness: 0.5, transparent: true, opacity: 0.9 }));
  // 十重旋转排布（五重对称的二维投影示意，砖尖朝外）：风筝/镖逐环交替
  for (let ring = 1; ring <= 4; ring++) {
    const n = ring * 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = ring * 1.15;
      const m = new THREE.Mesh((ring + i) % 2 ? kiteGeo : dartGeo, (ring + i) % 2 ? matA : matB);
      m.position.set(Math.cos(a) * r, Math.sin(a) * r, -0.2 * ring);
      m.rotation.z = a;
      m.scale.setScalar(0.9 - ring * 0.12);
      g.add(m);
    }
  }
  // 五重对称轴（虚线）
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.add(lineFrom(THREE, bag, [
      new THREE.Vector3(0, 0, 0.4),
      new THREE.Vector3(Math.cos(a) * 5, Math.sin(a) * 5, 0.4),
    ], PAL.gold, true));
  }
  g.add(panelSprite(THREE, bag, [
    { text: '准晶：衍射呈五重/十重对称，长程有序但非周期平移对称', color: '#f8fafc' },
    { text: 'Penrose P2 两砖：风筝（尖 72°/尾 144°）与镖（凹口 216°），边长比 = τ = (1+√5)/2', color: '#94a3b8' },
    { text: '读数：金虚线 = 五重对称轴，青 = 风筝，粉 = 镖（十重环排布为教学简化）', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  return (t: number) => {
    g.rotation.z = t * 0.2;
    g.rotation.x = 0.3 * Math.sin(t * 0.4);
  };
}

/** P242 任意子与统计, P241 陈绝缘体与陈数, P244 边缘态与体边对应 */
function build_topo(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const chern = title.includes('陈');
  const edge = title.includes('边缘');
  const anyon = title.includes('任意子');

  if (anyon) {
    // 任意子交换：两个粒子绕行半圈，波函数获得相位
    const p1 = new THREE.Mesh(
      bag.geo(new THREE.SphereGeometry(0.4, 20, 16)),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, emissive: 0x0891b2, emissiveIntensity: 0.6 })),
    );
    const p2 = new THREE.Mesh(
      bag.geo(new THREE.SphereGeometry(0.4, 20, 16)),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.pink, emissive: 0xbe185d, emissiveIntensity: 0.6 })),
    );
    g.add(p1); g.add(p2);
    // 交换轨迹（半圆）
    const arcGeo = bag.geo(new THREE.BufferGeometry());
    arcGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(81 * 3), 3));
    const arc = new THREE.Line(arcGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.gold })));
    g.add(arc);
    const aarr = (arcGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    for (let i = 0; i <= 80; i++) {
      const u = (i / 80) * Math.PI;
      aarr[i * 3] = Math.cos(u) * 2.2;
      aarr[i * 3 + 1] = Math.sin(u) * 2.2;
      aarr[i * 3 + 2] = 0;
    }
    // 辫状图（世界线编织示意）：x 坐标 vs 交换进度，两线一次交叉 = 一次交换（辫群生成元 σ₁）
    const braidPlot = makePlot(bag, THREE, 340, 300, 3.8, 6.6, 0.8);
    g.add(braidPlot.mesh);
    g.add(panelSprite(THREE, bag, [
      { text: '任意子统计：交换两个粒子，波函数获得相位 θ（2D）', color: '#f8fafc' },
      { text: 'e^{iθ}：θ=0 玻色子，θ=π 费米子，其余为任意子（分数统计）', color: '#94a3b8' },
      { text: '读数：金弧 = 交换路径；右图世界线一次编织 = 一次交换，θ_ex 实时累积（示例 θ_α=π/3）', color: '#fbbf24' },
      { text: '教学近似：仅演示阿贝尔分数统计；非阿贝尔任意子需简并多准粒子空间，本图未画出', color: '#94a3b8' },
    ], [0, 4.4, 0], 7.8, 'center'));
    let lastB = -1;
    return (t: number) => {
      const u = (t * 0.35) % 1;
      const a1 = u * Math.PI;
      const a2 = a1 + Math.PI;
      p1.position.set(Math.cos(a1) * 2.2, Math.sin(a1) * 2.2, 0);
      p2.position.set(Math.cos(a2) * 2.2, Math.sin(a2) * 2.2, 0);
      g.rotation.z = t * 0.15;
      // 辫状图读数（5Hz，与粒子位置同一参数 u）
      const bucket = Math.round(t * 5);
      if (bucket !== lastB) {
        lastB = bucket;
        const thA = Math.PI / 3; // 示例分数统计相位（θ = π/3 任意子）
        const thEx = u * thA;
        const c = braidPlot.frame('辫状图：世界线编织', '交换进度 u', 'x');
        const W = 340, H = 300;
        const px = (uu: number) => 46 + uu * (W - 62);
        const py = (x: number) => (H - 40) - ((x + 1) / 2) * (H - 70);
        c.strokeStyle = '#06b6d4'; c.lineWidth = 3; c.beginPath();
        for (let i = 0; i <= 60; i++) {
          const uu = i / 60;
          const xv = Math.cos(uu * Math.PI); // 粒子 1 的 x/2.2
          if (i === 0) c.moveTo(px(uu), py(xv)); else c.lineTo(px(uu), py(xv));
        }
        c.stroke();
        c.strokeStyle = '#f472b6'; c.beginPath();
        for (let i = 0; i <= 60; i++) {
          const uu = i / 60;
          const xv = Math.cos(uu * Math.PI + Math.PI); // 粒子 2 = 反相 → u=0.5 处交叉一次
          if (i === 0) c.moveTo(px(uu), py(xv)); else c.lineTo(px(uu), py(xv));
        }
        c.stroke();
        c.strokeStyle = '#fbbf24'; c.lineWidth = 2; c.setLineDash([5, 5]);
        c.beginPath(); c.moveTo(px(u), 18); c.lineTo(px(u), H - 40); c.stroke();
        c.setLineDash([]);
        c.fillStyle = '#f8fafc'; c.beginPath();
        c.arc(px(u), py(Math.cos(a1)), 6, 0, 7); c.fill();
        c.arc(px(u), py(Math.cos(a2)), 6, 0, 7); c.fill();
        c.fillStyle = '#94a3b8'; c.font = '15px sans-serif';
        c.fillText('交叉 = 一次交换（辫群 σ₁）', 56, 96);
        c.fillStyle = '#fbbf24'; c.font = 'bold 16px sans-serif';
        c.fillText(`θ_ex = ${(thEx / Math.PI).toFixed(2)}π`, 56, 56);
        c.fillStyle = '#f8fafc'; c.font = '15px sans-serif';
        c.fillText(`e^{iθ_ex} = ${Math.cos(thEx).toFixed(2)} + ${Math.sin(thEx).toFixed(2)}i`, 170, 56);
        braidPlot.tex.needsUpdate = true;
      }
    };
  }

  // 陈绝缘体 / 边缘态：格点 + 手征边缘态
  const N = 10;
  const nodeGeo = bag.geo(new THREE.SphereGeometry(0.2, 12, 10));
  const innerMat = bag.mat(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 }));
  const edgeMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, emissive: 0x0891b2, emissiveIntensity: 0.7 }));
  const edgeNodes: import('three').Mesh[] = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const isEdge = i === 0 || j === 0 || i === N - 1 || j === N - 1;
      const m = new THREE.Mesh(nodeGeo, isEdge ? edgeMat : innerMat);
      m.position.set((i - N / 2 + 0.5) * 0.62, (j - N / 2 + 0.5) * 0.62, 0);
      g.add(m);
      if (isEdge) edgeNodes.push(m);
    }
  }
  // 手征边缘态粒子（沿边界顺时针流动）
  const edgeTraceGeo = bag.geo(new THREE.BufferGeometry());
  edgeTraceGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(121 * 3), 3));
  const trace = new THREE.Line(edgeTraceGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.gold })));
  g.add(trace);
  const tarr = (edgeTraceGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  g.add(panelSprite(THREE, bag, edge ? [
    { text: '体边对应：体态有带隙，边界上必存在无能隙的边缘态', color: '#f8fafc' },
    { text: '手征边缘态：单向传播（时间反演破缺），背散射被抑制', color: '#94a3b8' },
    { text: '读数：青点 = 边缘格点，金线 = 手征边缘态传播路径', color: '#fbbf24' },
  ] : chern ? [
    { text: '陈绝缘体：陈数 C = (1/2π)∫_BZ F(k) d²k ∈ ℤ（TKNN 不变量）', color: '#f8fafc' },
    { text: '霍尔电导 σ_xy = C e²/h（量子化），C ≠ 0 拓扑非平庸', color: '#94a3b8' },
    { text: '读数：青点 = 边缘态格点，金线 = 手征边缘通道', color: '#fbbf24' },
  ] : [
    { text: '拓扑序：陈数 C 为整数，体态带隙保护边界导电通道', color: '#f8fafc' },
    { text: 'K 奇异点 → 陈数跳变（拓扑相变发生在带隙闭合处）', color: '#94a3b8' },
    { text: '读数：青点 = 边缘格点，金线 = 边缘态环流', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  return (t: number, dt: number) => {
    const R = N * 0.62 / 2 + 0.3;
    const s = (t * 0.6) % 4; // 0..4 沿四条边
    const seg = Math.floor(s);
    const u = s - seg;
    let ex = 0, ey = 0;
    if (seg === 0) { ex = -R + u * 2 * R; ey = R; }
    else if (seg === 1) { ex = R; ey = R - u * 2 * R; }
    else if (seg === 2) { ex = R - u * 2 * R; ey = -R; }
    else { ex = -R; ey = -R + u * 2 * R; }
    // 轨迹
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const ss = ((t * 0.6 - (steps - i) * 0.01) % 4 + 4) % 4;
      const sseg = Math.floor(ss);
      const su = ss - sseg;
      let x = 0, y = 0;
      if (sseg === 0) { x = -R + su * 2 * R; y = R; }
      else if (sseg === 1) { x = R; y = R - su * 2 * R; }
      else if (sseg === 2) { x = R - su * 2 * R; y = -R; }
      else { x = -R; y = -R + su * 2 * R; }
      tarr[i * 3] = x; tarr[i * 3 + 1] = y; tarr[i * 3 + 2] = 0.3;
    }
    (edgeTraceGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    edgeNodes.forEach((m, i) => {
      const d = Math.hypot(m.position.x - ex, m.position.y - ey);
      m.scale.setScalar(1 + 0.6 * Math.exp(-d * d * 4));
    });
    void dt; void edge;
  };
}

/** P385 第二类超导与磁通涡旋 */
function build_vortex(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  // 超导平板
  const slab = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(9, 0.4, 9)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x1e293b, transparent: true, opacity: 0.55, roughness: 0.5 })),
  );
  g.add(slab);
  // Abrikosov 磁通涡旋三角格子：六角晶格常数 a0，半径 ≤ 2a0 → 1+6+12 = 19 个格点
  const a0 = 1.55;
  const sites: { x: number; z: number; pin: boolean }[] = [];
  for (let q = -2; q <= 2; q++) {
    for (let r = -2; r <= 2; r++) {
      if (Math.abs(q + r) > 2) continue;
      sites.push({ x: a0 * (q + r / 2), z: a0 * (r * Math.sqrt(3) / 2), pin: false });
    }
  }
  // 钉扎中心：取内圈（半径 a0）等角间隔的 3 个格点，被钉涡旋锚定不随 B 移动
  const ring1 = sites
    .map((s, i) => ({ i, d: Math.hypot(s.x, s.z), ang: Math.atan2(s.z, s.x) }))
    .filter((e) => Math.abs(e.d - a0) < 0.1)
    .sort((a, b) => a.ang - b.ang);
  [0, 2, 4].forEach((k) => { if (ring1[k]) sites[ring1[k].i].pin = true; });
  // 激活次序：钉扎位点优先（最低场即成核），其余按半径升序 → B 增大涡旋"增密"
  const order = sites.map((s, i) => i).sort((ia, ib) => {
    const A = sites[ia], B2 = sites[ib];
    if (A.pin !== B2.pin) return A.pin ? -1 : 1;
    return Math.hypot(A.x, A.z) - Math.hypot(B2.x, B2.z);
  });
  const rank: number[] = new Array(sites.length);
  order.forEach((si, k) => { rank[si] = k; });
  const coreGeo = bag.geo(new THREE.CylinderGeometry(0.16, 0.16, 1.6, 14));
  const coreMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan }));
  const ringGeo = bag.geo(new THREE.TorusGeometry(0.55, 0.05, 8, 30));
  const ringMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold }));
  const pinGeo = bag.geo(new THREE.SphereGeometry(0.22, 12, 10));
  const pinMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, emissive: 0x991b1b, emissiveIntensity: 0.6, roughness: 0.5 }));
  const vort: { core: import('three').Mesh; ring: import('three').Mesh; x: number; z: number; pin: boolean; ph: number }[] = [];
  sites.forEach((s) => {
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.set(s.x, 0.2, s.z);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(s.x, 0.3, s.z);
    core.visible = false; ring.visible = false;
    g.add(core); g.add(ring);
    if (s.pin) {
      const p = new THREE.Mesh(pinGeo, pinMat);
      p.position.set(s.x, 0.06, s.z);
      g.add(p);
    }
    vort.push({ core, ring, x: s.x, z: s.z, pin: s.pin, ph: (s.x * 3.7 + s.z * 1.9) % 6 });
  });
  // 外磁场箭头
  for (let i = 0; i < 4; i++) {
    g.add(new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0), new THREE.Vector3((i - 1.5) * 2.4, 2.6, -3.4), 1.6, PAL.violet, 0.2, 0.1,
    ));
  }
  g.add(panelSprite(THREE, bag, [
    { text: '第二类超导：H_{c1} < B < H_{c2} 时磁通以量子化涡旋穿透', color: '#f8fafc' },
    { text: '每个涡旋携带磁通量子 Φ₀ = h/2e ≈ 2.07×10⁻¹⁵ Wb', color: '#94a3b8' },
    { text: '读数：青柱/金环 = 涡旋正常核与屏蔽环流，三角格子随 B 增密；红点 = 钉扎中心，其涡旋锚定不动', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  return (t: number, dt: number) => {
    // 磁场缓慢增强 → 涡旋按激活次序在三角格点上成核增密；未钉扎涡旋随 B 呼吸微摆，钉扎涡旋锚定
    const B = 0.5 + 0.5 * Math.sin(t * 0.3);
    const nActive = Math.round(sites.length * B);
    vort.forEach((v, i) => {
      const on = rank[i] < nActive;
      v.core.visible = on; v.ring.visible = on;
      if (!on) return;
      if (v.pin) {
        v.core.position.set(v.x, 0.2, v.z);
        v.ring.position.set(v.x, 0.3, v.z);
        v.ring.scale.setScalar(1);
      } else {
        const wob = 0.12 * Math.sin(t * 1.2 + v.ph);
        const pull = 0.9 + 0.1 * B;
        v.core.position.set(v.x * pull + wob, 0.2, v.z * pull - wob * 0.7);
        v.ring.position.set(v.x * pull + wob, 0.3, v.z * pull - wob * 0.7);
        v.ring.scale.setScalar(0.7 + B * 0.6);
      }
    });
    g.rotation.y = t * 0.1;
    void dt;
  };
}
