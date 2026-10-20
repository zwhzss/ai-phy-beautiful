import type { SceneContext, SceneInstance } from '../types';
import { scaffold, panelSprite, PAL, ResourceBag } from './_common';

/**
 * 热力学与统计物理族（thermal）：麦克斯韦速率分布 / 一维热传导 / 朗之万与福克-普朗克 /
 * 蒙特卡洛与重要性抽样 / 黑体辐射 / 超流。
 * 由 scene-registry 按 slug+variant 绑定：make(variant, title)。
 * title 一路透传到 buildVariant，用于在同一 variant 下按知识点切换形态：
 *  - mbdist 分支：title 含「玻尔兹曼」→ 离散能级阶梯 + 指数粒子数分布；
 *    否则（麦克斯韦速率分布）→ f(v)-v 三条温度曲线。
 *  - montecarlo：投点区左半均匀 / 右半重要性抽样，画布对比两种抽样的收敛方差。
 */
export function make(variant: string, title: string): (ctx: SceneContext) => SceneInstance {
  return (ctx) => scaffold(ctx, {
    title,
    camera: [0, 3.5, 13],
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
    case 'conduction': return conduction(ctx, g, bag, THREE);
    case 'langevin': return langevin(ctx, g, bag, THREE);
    case 'montecarlo': return montecarlo(ctx, g, bag, THREE, title);
    case 'blackbody': return blackbody(ctx, g, bag, THREE);
    case 'superfluid': return superfluid(ctx, g, bag, THREE);
    case 'mbdist':
    default: return mbdist(ctx, g, bag, THREE, title);
  }
}

/** 画布曲线助手：在右侧立一块可重绘的坐标画布 */
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
  const mesh = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(world, (world * h) / w)),
    bag.mat(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false })),
  );
  mesh.position.set(x, y, 0);
  mesh.renderOrder = 997;
  function frame(title: string, xlabel: string, ylabel: string): CanvasRenderingContext2D {
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(7,11,20,0.85)';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#334155'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, w - 3, h - 3);
    c.strokeStyle = '#475569'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(46, 18); c.lineTo(46, h - 40); c.lineTo(w - 14, h - 40); c.stroke();
    c.fillStyle = '#f8fafc'; c.font = 'bold 18px sans-serif'; c.textAlign = 'center';
    c.fillText(title, w / 2, 26);
    c.fillStyle = '#94a3b8'; c.font = '16px sans-serif';
    c.fillText(xlabel, w / 2, h - 10);
    c.save(); c.translate(16, (h - 22) / 2); c.rotate(-Math.PI / 2);
    c.fillText(ylabel, 0, 0); c.restore();
    c.textAlign = 'left';
    return c;
  }
  return { mesh, c, frame, tex };
}

/**
 * 麦克斯韦速率分布 / 玻尔兹曼分布（同 variant=mbdist，靠 title 分流）：
 *  - title 含「玻尔兹曼」→ 见 boltzmannLadder（离散能级 + 指数粒子数）。
 *  - 否则 → f(v) 随 T 移动，v_p = √(2kT/m) 标记 + 采样粒子；
 *    另附速度空间高斯球 + 厚壳示意（球壳体积 ∝ v² → f(v) ∝ v²e^{−mv²/2k_BT}），
 *    同时服务「推导」知识点（speed-distribution-derivation）。
 */
function mbdist(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
) {
  // 玻尔兹曼分布知识点：改画能级阶梯与指数占据，不走速率分布
  if (title.includes('玻尔兹曼')) {
    return boltzmannLadder(ctx, g, bag, THREE);
  }

  const plot = makePlot(bag, THREE, 360, 320, 4.2, 6.6, 0.8);
  g.add(plot.mesh);

  // 3D 采样粒子在盒内运动
  const NP = 90;
  const p = new Float32Array(NP * 3);
  const v: import('three').Vector3[] = [];
  for (let i = 0; i < NP; i++) {
    p[i * 3] = (Math.random() - 0.5) * 8;
    p[i * 3 + 1] = (Math.random() - 0.5) * 4;
    p[i * 3 + 2] = (Math.random() - 0.5) * 4;
    v.push(new THREE.Vector3(gauss(), gauss(), gauss()));
  }
  const pgeo = bag.geo(new THREE.BufferGeometry());
  pgeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.add(new THREE.Points(pgeo, bag.mat(new THREE.PointsMaterial({
    color: PAL.cyan, size: 0.13, sizeAttenuation: true,
  }))));

  // 盒子
  g.add(new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(8.2, 4.2, 4.2)),
    bag.mat(new THREE.MeshBasicMaterial({ color: 0x334155, wireframe: true, transparent: true, opacity: 0.4 })),
  ));

  // 速度空间示意：各向同性速度分布 → 速度空间点云是高斯球；
  // 速率 v 相同的点落在半径 v 的球壳上，厚 dv 的球壳体积 ∝ 4πv²dv，
  // 壳内点数（∝v²）× 高斯权重 e^{−mv²/2k_BT} 即 f(v) ∝ v²e^{−mv²/2k_BT}
  const shellR = 0.75, shellD = 0.45; // 壳层半径与厚度（示意，速度空间尺度）
  const bulkPts: number[] = []; // 壳外点（暗色）
  const bandPts: number[] = []; // 壳内点（金色）
  for (let i = 0; i < 320; i++) {
    const q = [gauss() * 0.6, gauss() * 0.6, gauss() * 0.6];
    const r = Math.hypot(q[0], q[1], q[2]);
    (r >= shellR && r <= shellR + shellD ? bandPts : bulkPts).push(q[0], q[1], q[2]);
  }
  const velSpace = new THREE.Group();
  velSpace.position.set(-6.3, 1.1, -0.4);
  const addCloud = (nums: number[], size: number, color: number, opacity: number) => {
    const cg = bag.geo(new THREE.BufferGeometry());
    cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nums), 3));
    velSpace.add(new THREE.Points(cg, bag.mat(new THREE.PointsMaterial({
      color, size, sizeAttenuation: true, transparent: true, opacity,
    }))));
  };
  addCloud(bulkPts, 0.07, PAL.slate, 0.85);
  addCloud(bandPts, 0.13, PAL.gold, 1);
  // 壳层：内球面（半透）+ 外球面（线框），两者之间即厚壳 dv
  velSpace.add(new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(shellR, 24, 16)),
    bag.mat(new THREE.MeshBasicMaterial({
      color: PAL.slate, transparent: true, opacity: 0.16, depthWrite: false,
    })),
  ));
  velSpace.add(new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(shellR + shellD, 24, 16)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold, wireframe: true, transparent: true, opacity: 0.3 })),
  ));
  // 半径指示（中心 → 壳外缘，读作 v）
  velSpace.add(new THREE.Line(
    bag.geo(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(shellR + shellD, 0, 0),
    ])),
    bag.mat(new THREE.LineBasicMaterial({ color: PAL.gold })),
  ));
  g.add(velSpace);
  g.add(panelSprite(THREE, bag, [
    { text: '速度空间点云 = 高斯球（各向同性）', color: '#94a3b8' },
    { text: '厚壳 dv 内点数 ∝ 4πv²dv', color: '#fbbf24' },
  ], [-6.3, 3.4, 0], 4.2, 'center'));

  g.add(panelSprite(THREE, bag, [
    { text: 'f(v) = 4πn (m/2πk_BT)^{3/2} v² e^{−mv²/2k_BT}', color: '#f8fafc' },
    { text: '三种平均：v_p = √(2k_BT/m) < v̄ = √(8k_BT/πm) < v_rms = √(3k_BT/m)（三条虚线）', color: '#94a3b8' },
    { text: '温度升高 → 曲线变宽变矮，峰值右移', color: '#fbbf24' },
    { text: '球壳体积 ∝ v² → f(v) ∝ v²e^{−mv²/2k_BT}（速度空间高斯球壳）', color: '#67e8f9' },
  ], [0, 4.4, 0], 7.6, 'center'));

  ctx.camera.position.set(0, 3, 13);
  function gauss(): number {
    let u = 0, w2 = 0;
    while (u === 0) u = Math.random();
    while (w2 === 0) w2 = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w2);
  }
  let lastT = -1;
  return (t: number, dt: number) => {
    const T = 0.35 + 0.85 * (Math.sin(t * 0.22) * 0.5 + 0.5);
    // 速度空间球壳缓慢转动（看出是三维球壳而非圆环）
    velSpace.rotation.y = t * 0.22;
    // 粒子速度按 √T 缩放
    const sp = Math.sqrt(T) * 1.6;
    const arr = pgeo.getAttribute('position') as import('three').BufferAttribute;
    const a = arr.array as Float32Array;
    for (let i = 0; i < NP; i++) {
      a[i * 3] += v[i].x * sp * dt;
      a[i * 3 + 1] += v[i].y * sp * dt;
      a[i * 3 + 2] += v[i].z * sp * dt;
      for (let k = 0; k < 3; k++) {
        const lim = k === 0 ? 4 : 2;
        if (a[i * 3 + k] > lim || a[i * 3 + k] < -lim) v[i].setComponent(k, -v[i].getComponent(k));
      }
    }
    arr.needsUpdate = true;

    const bucket = Math.round(T * 12);
    if (bucket !== lastT) {
      lastT = bucket;
      const c = plot.frame('f(v)', 'v', 'f(v)');
      // 三条温度曲线
      [0.5, T, 1.3].forEach((TT, i) => {
        c.strokeStyle = ['#64748b', '#06b6d4', '#f59e0b'][i];
        c.lineWidth = i === 1 ? 4 : 2;
        c.beginPath();
        for (let j = 1; j <= 140; j++) {
          const vv = (j / 140) * 4;
          // m=k_B=1 的麦克斯韦速率分布：f(v)=4π(1/2πT)^{3/2} v² e^{−mv²/2k_BT}
          // 前置系数 4π/(2π)^{3/2}≈0.7979，指数 −v²/(2T) → 峰恰在 v_p=√(2k_BT/m)
          const f = 0.7979 * vv * vv * Math.exp(-(vv * vv) / (2 * TT)) / (TT * Math.sqrt(TT));
          const px = 46 + (vv / 4) * (plot.c.canvas.width - 62);
          const py = (plot.c.canvas.height - 40) - Math.min(1, f / 1.05) * (plot.c.canvas.height - 70);
          if (j === 1) plot.c.moveTo(px, py); else plot.c.lineTo(px, py);
        }
        plot.c.stroke();
        if (i === 1) {
          // 三种平均速率标记线（m=k_B=1）：v_p=√(2T) < v̄=√(8T/π) < v_rms=√(3T)
          const markV = (vv: number, name: string, dy: number) => {
            const px = 46 + (vv / 4) * (plot.c.canvas.width - 62);
            plot.c.strokeStyle = '#f8fafc'; plot.c.setLineDash([5, 5]);
            plot.c.beginPath(); plot.c.moveTo(px, 18); plot.c.lineTo(px, plot.c.canvas.height - 40); plot.c.stroke();
            plot.c.setLineDash([]);
            plot.c.fillStyle = '#f8fafc'; plot.c.fillText(name, px + 4, 46 + dy);
          };
          markV(Math.sqrt(2 * TT), 'v_p', 0);
          markV(Math.sqrt(8 * TT / Math.PI), 'v̄', 18);
          markV(Math.sqrt(3 * TT), 'v_rms', 36);
        }
      });
      plot.c.fillStyle = '#94a3b8';
      plot.c.fillText('灰:T₀  青:T  橙:T₂', 60, plot.c.canvas.height - 52);
      plot.tex.needsUpdate = true;
    }
  };
}

/**
 * 玻尔兹曼分布（boltzmann-distribution 知识点）：
 * 竖直离散能级阶梯 E_i（6 级），每级沿 +x 挂一根粒子数柱 n_i ∝ g_i·e^{−E_i/k_BT}；
 * k_BT 随时间缓慢摆动，柱高按指数律重排，柱顶连出一条指数包络线；
 * 右侧画布绘 ln(n_i)–E_i 直线（斜率 −1/k_BT），演示"取对数即线性化"。
 * 注：为示意此处取简并度 g_i=1，使 ln(n_i)–E_i 严格成直线；面板仍给一般式。
 */
function boltzmannLadder(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
) {
  const NLEV = 6;                 // 离散能级数（E_i = i，单位 k_BT₀）
  const spacing = 0.82;           // 相邻能级竖直间距
  const xSpine = -1.6;            // 能级阶梯竖轴所在 x
  const yBase = -(NLEV - 1) * spacing * 0.5; // 阶梯竖直居中
  const barScale = 4.2;           // 无量纲占据 → 世界柱长

  // 每级一条水平能级线（竖直面 z=0）
  for (let i = 0; i < NLEV; i++) {
    const y = yBase + i * spacing;
    g.add(new THREE.Line(
      bag.geo(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(xSpine - 2.4, y, 0), new THREE.Vector3(xSpine, y, 0),
      ])),
      bag.mat(new THREE.LineBasicMaterial({ color: 0x64748b })),
    ));
    // 能级左端小点（E 轴刻度感）
    const dot = new THREE.Mesh(
      bag.geo(new THREE.SphereGeometry(0.06, 8, 8)),
      bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold })),
    );
    dot.position.set(xSpine - 2.4, y, 0);
    g.add(dot);
  }
  // 竖直能量轴（E↑）
  g.add(new THREE.Line(
    bag.geo(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(xSpine, yBase - 0.4, 0),
      new THREE.Vector3(xSpine, yBase + (NLEV - 1) * spacing + 0.4, 0),
    ])),
    bag.mat(new THREE.LineBasicMaterial({ color: PAL.slate })),
  ));

  // 粒子数柱：沿 +x 伸出，长度 ∝ n_i，颜色随占据（蓝→橙）
  const bars: import('three').Mesh[] = [];
  const barGeo = bag.geo(new THREE.BoxGeometry(1, 0.16, 0.16));
  for (let i = 0; i < NLEV; i++) {
    const bar = new THREE.Mesh(barGeo, bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan })));
    bar.position.set(xSpine, yBase + i * spacing, 0.5);
    g.add(bar);
    bars.push(bar);
  }

  // 柱顶指数包络曲线（随 k_BT 每帧重连）
  const envPts = new Float32Array(NLEV * 3);
  const envGeo = bag.geo(new THREE.BufferGeometry());
  envGeo.setAttribute('position', new THREE.BufferAttribute(envPts, 3));
  g.add(new THREE.Line(envGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.white }))));

  const plot = makePlot(bag, THREE, 360, 320, 4.2, 6.6, 0.8);
  g.add(plot.mesh);

  g.add(panelSprite(THREE, bag, [
    { text: '玻尔兹曼分布 n_i ∝ g_i·e^{−E_i/k_BT}（示意取 g_i=1）', color: '#f8fafc' },
    { text: 'n_i/n_j = e^{−(E_i−E_j)/k_BT}，k_BT↑ 则高能级越被占据', color: '#94a3b8' },
    { text: '大气标高 p ∝ e^{−mgh/k_BT}；ln n–E 直线斜率 = −1/k_BT', color: '#fbbf24' },
    { text: '熵视角：W = N!/Πnᵢ!（微观状态数），S = k·lnW = −kN·Σpᵢln pᵢ，k_BT↑ 分布趋平 → lnW↑', color: '#67e8f9' },
  ], [0, 4.4, 0], 7.6, 'center'));

  ctx.camera.position.set(0, 2.2, 12);
  let lastK = -1;
  const occ = new Float32Array(NLEV); // 缓存当前占据，供包络与画布复用

  return (t: number) => {
    // k_BT 在 [0.5, 1.4] 缓慢摆动 → 柱高按指数重排
    const kT = 0.5 + 0.9 * (Math.sin(t * 0.45) * 0.5 + 0.5);
    for (let i = 0; i < NLEV; i++) occ[i] = Math.exp(-i / kT); // E_i=i（单位），g_i=1
    for (let i = 0; i < NLEV; i++) {
      const len = 0.15 + occ[i] * barScale;
      bars[i].scale.x = len;
      bars[i].position.x = xSpine + len / 2;
      const o = occ[i];
      const r = Math.round(200 + 55 * o);
      const gg = Math.round(140 + 40 * o);
      const b = Math.round(240 * (1 - 0.72 * o));
      (bars[i].material as import('three').MeshBasicMaterial).color.setRGB(r / 255, gg / 255, b / 255);
      // 包络点落在柱顶 (x=spine+len, y=level)
      envPts[i * 3] = xSpine + len;
      envPts[i * 3 + 1] = yBase + i * spacing;
      envPts[i * 3 + 2] = 0.5;
    }
    (envGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;

    const bucket = Math.round(kT * 40);
    if (bucket !== lastK) {
      lastK = bucket;
      const W = plot.c.canvas.width, H = plot.c.canvas.height;
      const lnMax = (NLEV - 1) / kT; // ln(n) 跨度（0 → −lnMax）
      const c = plot.frame('ln(n) vs E', 'E_i', 'ln(n_i)');
      // 理论直线 ln(n) = −E/k_BT（过原点、斜率 −1/k_BT）
      c.strokeStyle = '#06b6d4'; c.lineWidth = 3; c.beginPath();
      for (let j = 0; j <= NLEV; j++) {
        const ln = -j / kT;
        const px = 46 + (j / (NLEV - 1)) * (W - 62);
        const py = (H - 40) - (ln / -lnMax) * (H - 84);
        if (j === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
      // 实测点（各能级占据取对数）
      c.fillStyle = '#f59e0b';
      for (let i = 0; i < NLEV; i++) {
        const ln = Math.log(Math.max(occ[i], 1e-6));
        const px = 46 + (i / (NLEV - 1)) * (W - 62);
        const py = (H - 40) - (ln / -lnMax) * (H - 84);
        c.beginPath(); c.arc(px, py, 4.5, 0, 7); c.fill();
      }
      c.fillStyle = '#94a3b8'; c.font = '15px sans-serif';
      c.fillText(`斜率 = −1/k_BT = ${(-1 / kT).toFixed(2)}`, 60, H - 58);
      // 熵读数（与柱阵同一组占据数同源）：S/k = −Σ pᵢ ln pᵢ = lnW/N（Stirling）
      const tot = occ.reduce((s2, o) => s2 + o, 0);
      let sEnt = 0;
      for (let i = 0; i < NLEV; i++) {
        const p = occ[i] / tot;
        if (p > 1e-12) sEnt -= p * Math.log(p);
      }
      c.fillStyle = '#67e8f9';
      c.fillText(`S/k = −Σpᵢlnpᵢ = ${sEnt.toFixed(3)}（= lnW/N，k_BT↑→趋平→熵↑）`, 58, 74);
      plot.tex.needsUpdate = true;
    }
  };
}

/** 一维热传导：温度剖面趋向线性，Fourier 定律 */
function conduction(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
) {
  const N = 48;
  const T = new Float32Array(N).fill(0.5);
  T[0] = 1; T[N - 1] = 0; // 两端恒温
  // 用一排变色小球表示温度
  const boxes: import('three').Mesh[] = [];
  for (let i = 0; i < N; i++) {
    const m = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(0.28, 1.6, 0.5)),
      bag.mat(new THREE.MeshStandardMaterial({ color: 0xffffff })),
    );
    m.position.set((i / (N - 1)) * 10 - 5, 0, 0);
    g.add(m);
    boxes.push(m);
  }
  // 热流箭头：热端在 x=−5、冷端在 x=+5，热流沿 +x（指向温度降低方向）
  const flux = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1.5, 0), 1.6, PAL.amber, 0.22, 0.11,
  );
  g.add(flux);

  g.add(panelSprite(THREE, bag, [
    { text: '傅里叶定律 q = −k ∂T/∂x，热流指向温度降低方向', color: '#f8fafc' },
    { text: '∂T/∂t = κ ∂²T/∂x²（κ = k/ρc），两端恒温 → 瞬态含 erfc/级数项', color: '#94a3b8' },
    { text: '长时间后温度剖面 → 线性：T(x) = T_hot + (T_cold−T_hot)x/L', color: '#fbbf24' },
  ], [0, 4.2, 0], 7.6, 'center'));

  ctx.camera.position.set(0, 2.6, 12);
  const kappa = 0.28;
  let step = 0;
  return (t: number) => {
    // 每帧推进若干 FTCS 步
    for (let s = 0; s < 3; s++) {
      const next = Float32Array.from(T);
      for (let i = 1; i < N - 1; i++) next[i] = T[i] + kappa * (T[i + 1] - 2 * T[i] + T[i - 1]);
      T.set(next);
      step++;
    }
    for (let i = 0; i < N; i++) {
      const u = T[i];
      // 冷(蓝) → 热(橙红) 色带
      const r = Math.round(30 + 220 * u);
      const gg = Math.round(60 + 120 * u * (1 - u) * 2);
      const b = Math.round(200 - 170 * u);
      (boxes[i].material as import('three').MeshStandardMaterial).color.setRGB(r / 255, gg / 255, b / 255);
      boxes[i].scale.y = 0.7 + 0.6 * u;
    }
    // 热流随梯度增强（方向恒为 +x：热端在左、冷端在右）
    const grad = Math.abs(T[2] - T[N - 3]);
    flux.setLength(0.5 + grad * 12, 0.22, 0.11);
    flux.setDirection(new THREE.Vector3(1, 0, 0));
  };
}

/** 朗之万方程 + 福克-普朗克：漂移-扩散 → 速度分布趋向 Maxwellian */
function langevin(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
) {
  const plot = makePlot(bag, THREE, 340, 300, 3.9, 6.4, 0.6);
  g.add(plot.mesh);

  const NP = 40;
  const vel: import('three').Vector3[] = [];
  const pos: import('three').Vector3[] = [];
  const geo = bag.geo(new THREE.BufferGeometry());
  const pp = new Float32Array(NP * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  g.add(new THREE.Points(geo, bag.mat(new THREE.PointsMaterial({
    color: PAL.green, size: 0.16, sizeAttenuation: true,
  }))));

  for (let i = 0; i < NP; i++) {
    pos.push(new THREE.Vector3((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 4, 0));
    // 初速度分布故意偏置（非平衡），观察其向 Maxwellian 弛豫
    vel.push(new THREE.Vector3(2.6 + gauss() * 0.3, gauss() * 0.4, 0));
  }
  function gauss(): number {
    let u = 0, w2 = 0;
    while (u === 0) u = Math.random();
    while (w2 === 0) w2 = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w2);
  }

  g.add(panelSprite(THREE, bag, [
    { text: '朗之万方程：m dv/dt = −γmv + F_random(t)', color: '#f8fafc' },
    { text: '漂移−扩散竞争：γv 拉回，随机碰撞加热 → 稳态 Maxwellian', color: '#94a3b8' },
    { text: '福克-普朗克 ∂f/∂t = −v·∂f/∂x + γ∂(vf)/∂v + D∂²f/∂v²', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.6, 'center'));

  ctx.camera.position.set(0, 2.4, 12);
  let frame = 0;
  return (t: number, dt: number) => {
    const gamma = 1.1;
    const D = 0.55;
    const arr = geo.getAttribute('position') as import('three').BufferAttribute;
    const a = arr.array as Float32Array;
    for (let i = 0; i < NP; i++) {
      // dv = −γv dt + √(2D) dW
      vel[i].x += -gamma * vel[i].x * dt + Math.sqrt(2 * D * dt) * gauss();
      vel[i].y += -gamma * vel[i].y * dt + Math.sqrt(2 * D * dt) * gauss();
      pos[i].addScaledVector(vel[i], dt);
      for (const k of ['x', 'y'] as const) {
        const lim = k === 'x' ? 3.5 : 2;
        if (pos[i][k] > lim || pos[i][k] < -lim) vel[i][k] *= -1;
      }
      a[i * 3] = pos[i].x; a[i * 3 + 1] = pos[i].y; a[i * 3 + 2] = 0;
    }
    arr.needsUpdate = true;

    if (frame % 20 === 0) {
      const c = plot.frame('速度分布 f(vₓ)', 'vₓ', 'f');
      // 直方图（实测）
      const B = 22;
      const hist = new Float32Array(B);
      for (let i = 0; i < NP; i++) {
        const b2 = Math.floor(((vel[i].x + 3) / 6) * B);
        if (b2 >= 0 && b2 < B) hist[b2]++;
      }
      const bw = (plot.c.canvas.width - 62) / B;
      for (let b2 = 0; b2 < B; b2++) {
        const hgt = (hist[b2] / NP) * (plot.c.canvas.height - 80);
        plot.c.fillStyle = 'rgba(34,197,94,0.75)';
        plot.c.fillRect(46 + b2 * bw, plot.c.canvas.height - 40 - hgt, bw - 2, hgt);
      }
      // 理论 Maxwellian：该 OU 过程稳态方差 σ²=D/γ，密度 f(v)=e^{−v²/2σ²}/√(2πσ²)
      // 折算成与直方图同口径的"每箱占比"（×箱宽 Δv=6/B），白线才是直方图的收敛目标
      const sig2 = D / gamma; // = 0.5
      const densNorm = (6 / B) / Math.sqrt(2 * Math.PI * sig2);
      plot.c.strokeStyle = '#f8fafc'; plot.c.lineWidth = 3; plot.c.beginPath();
      for (let j = 1; j <= 120; j++) {
        const vv = -3 + (j / 120) * 6;
        const f = densNorm * Math.exp(-(vv * vv) / (2 * sig2)); // 峰高≈0.154，与直方图同尺度
        const px = 46 + ((vv + 3) / 6) * (plot.c.canvas.width - 62);
        const py = (plot.c.canvas.height - 40) - f * (plot.c.canvas.height - 80);
        if (j === 1) plot.c.moveTo(px, py); else plot.c.lineTo(px, py);
      }
      plot.c.stroke();
      plot.c.fillStyle = '#94a3b8'; plot.c.fillText('白线 = Maxwellian 稳态（σ²=D/γ）', 58, 52);
      plot.tex.needsUpdate = true;
    }
    frame++;
    void t;
  };
}

/**
 * 蒙特卡洛与重要性抽样：
 *  - 左半投点区在单位圆内外接方内均匀撒点，估计 π = 4·N_in/N（教学经典，读数 π̂）。
 *  - 右半对同一目标积分 I = ∫₀¹e^{−λx}dx 并排两种抽样：均匀投点（判 y<e^{−λx}，N_hit/N）
 *    与重要性抽样 q(x)∝e^{−λx}（inverse-CDF x=−ln(1−u(1−e^{−λ}))/λ，点贴曲线、按权重 w 上色）。
 *    两曲线同被积函数 → 方差对比成立；误差带用样本实算标准误（无硬编码示意带宽）。
 *    本例 q∝p 恰为零方差理想情形（w≡I_true），面板如实声明。
 *  - MCMC（Metropolis 接受步）未在本形态展开，面板如实标注（承诺降级）。
 */
function montecarlo(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
) {
  void title; // variant='montecarlo' 已唯一对应「重要性抽样」知识点，形态由 variant 决定
  const NP = 700;
  const lam = 3;
  const oneMinusE = 1 - Math.exp(-lam);

  // 左：均匀撒点的 π 估计云
  const pts = new Float32Array(NP * 3);
  const col = new Float32Array(NP * 3);
  const geo = bag.geo(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.add(new THREE.Points(geo, bag.mat(new THREE.PointsMaterial({
    size: 0.075, vertexColors: true, sizeAttenuation: true,
  }))));

  // 单位圆与外接方形（居中于 x=−2.5）
  const circ = new THREE.Mesh(
    bag.geo(new THREE.RingGeometry(1.98, 2.0, 80)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold, side: THREE.DoubleSide })),
  );
  circ.rotation.x = -Math.PI / 2;
  circ.position.set(-2.5, 0.02, 0);
  g.add(circ);
  const sq = new THREE.Mesh(
    bag.geo(new THREE.RingGeometry(2.75, 2.79, 4)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.slate, side: THREE.DoubleSide })),
  );
  sq.rotation.x = -Math.PI / 2;
  sq.rotation.z = Math.PI / 4;
  sq.position.set(-2.5, 0.02, 0);
  g.add(sq);

  // 右：重要性抽样点云（较大点、按权重 w 上色，向峰集中）
  const ipos = new Float32Array(NP * 3);
  const icol = new Float32Array(NP * 3);
  const igeo = bag.geo(new THREE.BufferGeometry());
  igeo.setAttribute('position', new THREE.BufferAttribute(ipos, 3));
  igeo.setAttribute('color', new THREE.BufferAttribute(icol, 3));
  g.add(new THREE.Points(igeo, bag.mat(new THREE.PointsMaterial({
    size: 0.16, vertexColors: true, sizeAttenuation: true,
  }))));
  // 投点区边框（示意 [0,1]×[0,1] 抽样域）
  g.add(new THREE.Line(
    bag.geo(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0.4, 0.02, -1.2), new THREE.Vector3(2.8, 0.02, -1.2),
      new THREE.Vector3(2.8, 0.02, 1.2), new THREE.Vector3(0.4, 0.02, 1.2),
      new THREE.Vector3(0.4, 0.02, -1.2),
    ])),
    bag.mat(new THREE.LineBasicMaterial({ color: PAL.slate })),
  ));
  // 同一积分 I 的均匀投点云（x→世界 X，散点值 y→世界 Z，命中判据 y<e^{−λx}）
  const uIpos = new Float32Array(NP * 3);
  const uIcol = new Float32Array(NP * 3);
  for (let i = 0; i < NP; i++) { uIpos[i * 3 + 1] = -9; }   // 未揭示的点先藏到地下
  const uIgeo = bag.geo(new THREE.BufferGeometry());
  uIgeo.setAttribute('position', new THREE.BufferAttribute(uIpos, 3));
  uIgeo.setAttribute('color', new THREE.BufferAttribute(uIcol, 3));
  g.add(new THREE.Points(uIgeo, bag.mat(new THREE.PointsMaterial({
    size: 0.06, vertexColors: true, sizeAttenuation: true,
  }))));
  // 目标曲线 y = e^{−λx}（投点区第二轴 = 函数值；重要性点贴在此曲线上）
  const curvePts: import('three').Vector3[] = [];
  for (let i = 0; i <= 48; i++) {
    const x = i / 48;
    curvePts.push(new THREE.Vector3(0.4 + 2.4 * x, 0.05, -1.2 + 2.4 * Math.exp(-lam * x)));
  }
  g.add(new THREE.Line(
    bag.geo(new THREE.BufferGeometry().setFromPoints(curvePts)),
    bag.mat(new THREE.LineBasicMaterial({ color: PAL.gold })),
  ));

  const plot = makePlot(bag, THREE, 360, 300, 4.2, 6.8, 0.9);
  g.add(plot.mesh);

  // 预生成：均匀点（π 判别）+ 同一积分 I 的均匀投点 + 重要性点（inverse-CDF，含被积值/权重）
  const uni: { x: number; y: number }[] = [];
  const uniI: { x: number; y: number; hit: boolean }[] = [];
  const imp: { x: number; f: number; w: number }[] = [];
  for (let i = 0; i < NP; i++) {
    uni.push({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 });
    const ux = Math.random(), uy = Math.random();
    uniI.push({ x: ux, y: uy, hit: uy < Math.exp(-lam * ux) });   // 均匀估计 I：判 y<e^{−λx}
    const u = Math.random();
    const x = -(1 / lam) * Math.log(1 - u * oneMinusE); // q(x)∝e^{−λx} 的逆 CDF 抽样
    const f = Math.exp(-lam * x);                        // 目标密度 p(x)=e^{−λx}
    imp.push({ x, f, w: f / (lam * Math.exp(-lam * x) / oneMinusE) }); // w=p/q（自归一化前）
  }

  g.add(panelSprite(THREE, bag, [
    { text: '蒙特卡洛：左＝投点估 π = 4·N_in/N（误差 ∝ 1/√N，读数 π̂ 在画布标题）', color: '#f8fafc' },
    { text: '右＝同一积分 I=∫₀¹e^{−λx}dx 两种抽样：灰/绿小点=均匀投点(判 y<e^{−λx})，金点=重要性(贴曲线)', color: '#94a3b8' },
    { text: '重要性 q∝e^{−λx}：w=p/q≡I_true（理想 q∝p）→ 零方差，橙曲线水平', color: '#fbbf24' },
    { text: '画布端头竖线 = 样本实算标准误 ±σ̂（青：√(p̂(1−p̂)/N)，橙≈0）→ 同被积函数方差对比', color: '#67e8f9' },
    { text: '马尔可夫链蒙特卡洛（MCMC/Metropolis）本形态未展开——聚焦方差对比（如实降级）', color: '#22c55e' },
  ], [0, 4.4, 0], 7.6, 'center'));

  ctx.camera.position.set(0, 7.5, 12.5);

  const I_true = oneMinusE / lam; // ∫₀¹ e^{−λx}dx 真值
  let maxW = 1e-6;
  for (const p of imp) maxW = Math.max(maxW, Math.abs(p.w));
  let shown = 0;
  const histU: number[] = []; // 均匀投点对同一 I 的估计 N_hit/N
  const histI: number[] = []; // 重要性抽样对同一 I 的估计（同被积函数 → 方差可比）
  let lastB = -1;

  return (t: number, dt: number) => {
    shown = Math.min(NP, 40 + Math.floor(t * 90));
    const a = (geo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    const cc = (geo.getAttribute('color') as import('three').BufferAttribute).array as Float32Array;
    const ia = (igeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    const ic = (igeo.getAttribute('color') as import('three').BufferAttribute).array as Float32Array;
    const ua = (uIgeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    const uc = (uIgeo.getAttribute('color') as import('three').BufferAttribute).array as Float32Array;

    let inside = 0;
    let ninU = 0, sumImpW = 0, sumW2 = 0;
    for (let i = 0; i < shown; i++) {
      // 左：均匀 π 判别
      const P = uni[i];
      a[i * 3] = P.x * 2 - 2.5;
      a[i * 3 + 1] = 0.06;
      a[i * 3 + 2] = P.y * 2;
      const inC = P.x * P.x + P.y * P.y <= 1;
      if (inC) inside++;
      cc[i * 3] = inC ? 0.15 : 0.7;
      cc[i * 3 + 1] = inC ? 0.85 : 0.35;
      cc[i * 3 + 2] = 0.4;
      // 右·均匀投点（估同一个 I）：(x,y)∈[0,1]²，命中 y<e^{−λx}（绿）/未中（灰）
      const U = uniI[i];
      ua[i * 3] = 0.4 + 2.4 * U.x;
      ua[i * 3 + 1] = 0.04;
      ua[i * 3 + 2] = -1.2 + 2.4 * U.y;
      uc[i * 3] = U.hit ? 0.13 : 0.45;
      uc[i * 3 + 1] = U.hit ? 0.78 : 0.5;
      uc[i * 3 + 2] = U.hit ? 0.45 : 0.56;
      if (U.hit) ninU++;
      // 右·重要性点：贴目标曲线 z=e^{−λx}（向峰 x=0 集中），按 w 上色、w 大者抬升
      const Q = imp[i];
      ia[i * 3] = 0.4 + 2.4 * Q.x;
      ia[i * 3 + 1] = 0.06 + 0.5 * (Math.abs(Q.w) / maxW);
      ia[i * 3 + 2] = -1.2 + 2.4 * Q.f;
      const wn = Math.min(1, Math.abs(Q.w) / maxW);
      ic[i * 3] = 0.2 + 0.75 * wn;
      ic[i * 3 + 1] = 0.7 * (1 - wn) + 0.25;
      ic[i * 3 + 2] = 0.9 * (1 - wn) + 0.1;
      // IS 估计量 Î = (1/N)·Σ f(x_i)/q(x_i)：必须带上权重 w=f/q，
      // 只累加 f 会收敛到 E_q[f]=(1+e^{−λ})/2≈0.525 而非真值
      sumImpW += Q.w;
      sumW2 += Q.w * Q.w;
    }
    // 尚未揭示的均匀投点藏到地下
    for (let i = shown; i < NP; i++) { ua[i * 3 + 1] = -9; }
    (geo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    (geo.getAttribute('color') as import('three').BufferAttribute).needsUpdate = true;
    (igeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    (igeo.getAttribute('color') as import('three').BufferAttribute).needsUpdate = true;
    (uIgeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    (uIgeo.getAttribute('color') as import('three').BufferAttribute).needsUpdate = true;

    const n = Math.max(1, shown);
    const piU = (4 * inside) / n;          // 左半 π 读数（仅标题展示，不再与 I 混画）
    const estU = ninU / n;                 // 均匀估计 I：真值直出，无 clamp 削平散布
    const sU = Math.sqrt(Math.max(0, estU * (1 - estU)) / n);   // 伯努利样本标准误（实算）
    const estI = sumImpW / n;
    const varW = Math.max(0, sumW2 / n - estI * estI);
    const sI = n > 1 ? Math.sqrt(varW / (n - 1)) : 0;           // 重要性样本标准误（w≡I_true → ≈0）
    histU.push(estU); histI.push(estI);
    if (histU.length > 200) { histU.shift(); histI.shift(); }

    // 5Hz 重绘
    const bucket = Math.floor(t * 5);
    if (bucket !== lastB) {
      lastB = bucket;
      const W = plot.c.canvas.width, H = plot.c.canvas.height;
      const bandTxt = sI < 1e-6 ? '≈0' : sI.toFixed(4);
      const c = plot.frame(
        `π̂=${piU.toFixed(3)} · N=${shown} · 均匀±${sU.toFixed(3)} 重要性±${bandTxt}`,
        '样本数 N', '估计值 Î（同一 I）',
      );
      // 值域 [0.1,0.6]：两条曲线都收敛到 I_true≈0.317 附近
      const yOf = (v: number) => (H - 40) - ((v - 0.1) / 0.5) * (H - 90);
      // 真值参考线（唯一积分量 → 两曲线散布直接可比）
      c.strokeStyle = '#f8fafc'; c.setLineDash([5, 5]); c.lineWidth = 2;
      const yy = yOf(I_true);
      c.beginPath(); c.moveTo(46, yy); c.lineTo(W - 14, yy); c.stroke();
      c.setLineDash([]);
      const xEnd = 46 + ((Math.max(1, histU.length) - 1) / 199) * (W - 62);
      // 均匀收敛曲线（青，摆动大）+ 端头 ±sU 误差棒
      c.strokeStyle = '#06b6d4'; c.lineWidth = 3; c.beginPath();
      histU.forEach((v, i) => {
        const px = 46 + (i / 199) * (W - 62);
        const py = yOf(v);
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      });
      c.stroke();
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(xEnd, yOf(Math.min(0.6, estU + sU))); c.lineTo(xEnd, yOf(Math.max(0.1, estU - sU))); c.stroke();
      // 重要性收敛曲线（橙，零方差理想 → 水平）+ 端头 ±sI（tick）
      c.fillStyle = 'rgba(245,158,11,0.16)';
      c.fillRect(46, yOf(estI) - 3, W - 62, 6);
      c.strokeStyle = '#f59e0b'; c.lineWidth = 3; c.beginPath();
      histI.forEach((v, i) => {
        const px = 46 + (i / 199) * (W - 62);
        const py = yOf(v);
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      });
      c.stroke();
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(xEnd, yOf(Math.min(0.6, estI + sI))); c.lineTo(xEnd, yOf(Math.max(0.1, estI - sI))); c.stroke();
      c.fillStyle = '#94a3b8'; c.font = '15px sans-serif';
      c.fillText('青=均匀投点 Î=N_hit/N（同被积函数，散布大）', 58, 52);
      c.fillText('橙=重要性 Î=(1/N)Σw（w≡I_true → 零方差水平线）', 58, 70);
      c.fillText('白虚线=I 真值；端头竖线=样本实算 ±σ̂', 58, 88);
      plot.tex.needsUpdate = true;
    }
  };
}

/** 黑体辐射：Planck vs Rayleigh–Jeans，Wien 位移 */
function blackbody(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
) {
  const plot = makePlot(bag, THREE, 400, 320, 4.8, 0, 1.0);
  g.add(plot.mesh);

  // 发光球体（温度变色）
  const ball = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(1.1, 32, 24)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1 })),
  );
  ball.position.set(0, -3.0, 0);
  g.add(ball);
  const shell = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(1.9, 24, 16)),
    bag.mat(new THREE.MeshBasicMaterial({ color: 0x94a3b8, wireframe: true, transparent: true, opacity: 0.3 })),
  );
  shell.position.copy(ball.position);
  g.add(shell);

  g.add(panelSprite(THREE, bag, [
    { text: '普朗克定律 B_ν = 2hν³/c² · 1/(e^{hν/k_BT}−1)', color: '#f8fafc' },
    { text: '按波长 B_λ = 2hc²/λ⁵ · 1/(e^{hc/λk_BT}−1)（∝λ⁻⁵）', color: '#f8fafc' },
    { text: '瑞利-金斯（经典）B_λ = 2ck_BT/λ⁴ → λ→0 发散（紫外灾难）', color: '#94a3b8' },
    { text: '维恩位移 λ_max T = 2.898×10⁻³ m·K；纵轴为对数（lg B_λ/B_peak）', color: '#fbbf24' },
  ], [0, 4.6, 0], 7.8, 'center'));

  ctx.camera.position.set(0, 0.5, 12);
  let lastT = -1;
  return (t: number) => {
    const T = 3000 + 5200 * (Math.sin(t * 0.2) * 0.5 + 0.5); // 3000–8200 K
    // 颜色随温度（黑体色）
    const u = (T - 3000) / 5200;
    const r = 1, gr = 0.35 + 0.55 * u, b = 0.1 + 0.75 * u * u;
    (ball.material as import('three').MeshStandardMaterial).emissive.setRGB(r, gr, b);
    (ball.material as import('three').MeshStandardMaterial).color.setRGB(r, gr, b);

    const bucket = Math.round(T / 250);
    if (bucket !== lastT) {
      lastT = bucket;
      // 纵轴取对数（lg B_λ/B_peak）：普朗克与瑞利-金斯共用同一归一，
      // 两线量级差（紫外灾难）与普朗克峰位才能同框呈现
      const c = plot.frame(`${Math.round(T)} K`, 'λ (nm)（200–1400）', 'lg B_λ/B_peak');
      const W = plot.c.canvas.width, H = plot.c.canvas.height;
      const hcOvK = 1.4388e-2; // hc/k_B [m·K]
      const LAM_MIN = 200, LAM_MAX = 1400, NS = 160; // nm
      const LG_LO = -5.5, LG_HI = 4.5;               // lg(B/B_peak) 纵轴跨度
      const lams: number[] = [];
      const lgP: number[] = [], lgW: number[] = [], lgRJ: number[] = [];
      let peak = 0;
      for (let i = 0; i < NS; i++) {
        const lam = LAM_MIN + (i / (NS - 1)) * (LAM_MAX - LAM_MIN); // nm
        const l = lam * 1e-9;
        const x = hcOvK / (l * T);                    // hc/λk_BT
        const A = (2 * 6.626e-34 * 8.988e16) / l ** 5; // 2hc²/λ⁵
        const B = A / (Math.exp(x) - 1);               // 普朗克 B_λ ∝ λ⁻⁵/(e^x−1)
        lams.push(lam);
        lgP.push(B);
        lgW.push(A * Math.exp(-x));                            // 维恩近似 B ∝ λ⁻⁵e^{−x}
        lgRJ.push((2 * 2.998e8 * 1.381e-23 * T) / l ** 4);    // 瑞利-金斯 B_λ=2ck_BT/λ⁴
        if (B > peak) peak = B;
      }
      const xOf = (lam: number) => 46 + ((lam - LAM_MIN) / (LAM_MAX - LAM_MIN)) * (W - 62);
      const yOf = (lgRel: number) =>
        (H - 40) - ((lgRel - LG_LO) / (LG_HI - LG_LO)) * (H - 80);
      const draw = (lgs: number[], color: string, width: number, dashed = false) => {
        plot.c.strokeStyle = color; plot.c.lineWidth = width;
        plot.c.setLineDash(dashed ? [6, 5] : []);
        plot.c.beginPath();
        lgs.forEach((B, i) => {
          const px = xOf(lams[i]);
          const py = yOf(Math.min(LG_HI, Math.max(LG_LO, Math.log10(B / peak))));
          if (i === 0) plot.c.moveTo(px, py); else plot.c.lineTo(px, py);
        });
        plot.c.stroke();
        plot.c.setLineDash([]);
      };
      // 数量级刻度（右缘，避开左上角冲出的 RJ 线）+ 峰值参考线 lg=0
      c.font = '13px sans-serif'; c.fillStyle = '#64748b'; c.textAlign = 'right';
      for (const lg of [4, -4]) c.fillText(lg === 4 ? '10⁴' : '10⁻⁴', W - 18, yOf(lg) + 4);
      c.textAlign = 'left';
      c.strokeStyle = 'rgba(148,163,184,0.35)'; c.setLineDash([3, 6]); c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(46, yOf(0)); c.lineTo(W - 14, yOf(0)); c.stroke();
      c.setLineDash([]);
      draw(lgP, '#f59e0b', 4);         // 普朗克：峰恰落在 Wien 虚线上
      draw(lgRJ, '#64748b', 2.4);      // 瑞利-金斯（经典）：短波冲出画布顶端
      draw(lgW, '#22c55e', 2, true);   // 维恩近似（短波与普朗克重合、长波偏低）
      c.fillStyle = '#64748b'; c.fillText('RJ：短波发散（紫外灾难）', 206, 62);
      // Wien 峰
      const lamMax = 2.898e6 / T; // nm
      const px = xOf(lamMax);
      plot.c.strokeStyle = '#f8fafc'; plot.c.setLineDash([5, 5]);
      plot.c.beginPath(); plot.c.moveTo(px, 18); plot.c.lineTo(px, H - 40); plot.c.stroke();
      plot.c.setLineDash([]);
      plot.c.fillStyle = '#f8fafc'; plot.c.fillText(`λ_max=${Math.round(lamMax)}nm`, px + 6, 46);
      c.font = '15px sans-serif';
      plot.c.fillStyle = '#f59e0b'; plot.c.fillText('— Planck', 52, H - 52);
      plot.c.fillStyle = '#22c55e'; plot.c.fillText('— Wien 近似', 130, H - 52);
      plot.c.fillStyle = '#64748b'; plot.c.fillText('— Rayleigh–Jeans', 230, H - 52);
      plot.tex.needsUpdate = true;
    }
  };
}

/** 超流：Rollin 膜爬壁 + 量子化涡旋 + 无黏性转子 */
function superfluid(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
) {
  // 杯子
  const cup = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(2.4, 2.2, 3.2, 40, 1, true)),
    bag.mat(new THREE.MeshStandardMaterial({
      color: 0x94a3b8, transparent: true, opacity: 0.22, side: THREE.DoubleSide,
    })),
  );
  g.add(cup);
  // 液面
  const surface = new THREE.Mesh(
    bag.geo(new THREE.CircleGeometry(2.35, 40)),
    bag.mat(new THREE.MeshStandardMaterial({
      color: 0x67e8f9, transparent: true, opacity: 0.55,
    })),
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = 0.2;
  g.add(surface);
  // 杯底
  const base = new THREE.Mesh(
    bag.geo(new THREE.CircleGeometry(2.2, 40)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x334155 })),
  );
  base.rotation.x = -Math.PI / 2;
  base.position.y = -1.6;
  g.add(base);

  // Rollin 膜：沿内壁上爬、越过杯沿后在壁外成膜的薄膜（细圆柱，高度由超流份额驱动）
  const film = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(2.36, 2.36, 3.2, 40, 1, true)),
    bag.mat(new THREE.MeshBasicMaterial({
      color: PAL.cyan, transparent: true, opacity: 0.4, side: THREE.DoubleSide,
    })),
  );
  g.add(film);
  // 杯沿外的外壁膜（爬出杯沿后在外侧成流）
  const outerFilm = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(2.45, 2.45, 2.6, 40, 1, true)),
    bag.mat(new THREE.MeshBasicMaterial({
      color: PAL.cyan, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
    })),
  );
  outerFilm.position.set(0, 0.3, 0);
  g.add(outerFilm);
  // 底缘微缝（穿缝泄漏通道）+ 缝下滴落液滴
  const chAng = 0.6;
  const chX = 2.3 * Math.cos(chAng), chZ = 2.3 * Math.sin(chAng);
  const channel = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 10)),
    bag.mat(new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.7 })),
  );
  channel.position.set(chX, -1.75, chZ);
  g.add(channel);
  const drip = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.1, 10, 8)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.9 })),
  );
  drip.position.set(chX, -2.2, chZ);
  g.add(drip);

  // 量子化涡旋（竖直螺旋线）
  const vortices: import('three').Line[] = [];
  for (let v = 0; v < 3; v++) {
    const pts: import('three').Vector3[] = [];
    const off = (v / 3) * Math.PI * 2;
    for (let i = 0; i <= 100; i++) {
      const u = i / 100;
      const th = off + u * 12;
      const r = 0.5 + 0.12 * u;
      pts.push(new THREE.Vector3(r * Math.cos(th), -1.5 + u * 3.0, r * Math.sin(th)));
    }
    const l = new THREE.Line(
      bag.geo(new THREE.BufferGeometry().setFromPoints(pts)),
      bag.mat(new THREE.LineBasicMaterial({ color: PAL.violet, transparent: true, opacity: 0.85 })),
    );
    g.add(l);
    vortices.push(l);
  }
  // 量子化涡旋标注：Γ = n·h/m₄（⁴He 原子质量 6.6465×10⁻²⁷ kg → h/m₄ ≈ 9.97×10⁻⁸ m²/s）
  const G1 = 6.62607e-34 / 6.6465e-27;
  const vortexLabels: import('three').Sprite[] = [];
  vortices.forEach((_v, i) => {
    const n = i + 1;
    const sp = panelSprite(THREE, bag, [
      { text: `涡旋 n=${n}：Γ = n·h/m₄ ≈ ${(n * G1).toExponential(2)} m²/s`, color: '#8b5cf6' },
    ], [4.6, 1.5 - i * 0.9, 0], 4.6, 'left');
    g.add(sp);
    vortexLabels.push(sp);
  });
  // λ 点温度计画布：T(t) 往复穿越 2.17 K，两流体模型 ρ_s/ρ（教学示意近似 1−(T/Tλ)⁴）
  const term = makePlot(bag, THREE, 320, 220, 3.4, -5.6, 1.2);
  g.add(term.mesh);
  const TL = 2.17;
  const fsOf = (TT: number): number => (TT < TL ? Math.max(0, 1 - Math.pow(TT / TL, 4)) : 0);
  function drawTherm(T: number, fs: number): void {
    const W = term.c.canvas.width, H = term.c.canvas.height;
    const c = term.frame(`T = ${T.toFixed(2)} K · ρ_s/ρ = ${fs.toFixed(2)}`, 'T (K)', 'ρ_s/ρ');
    const xOf = (TT: number) => 46 + ((TT - 1.4) / 1.4) * (W - 62);   // T 1.4–2.8 K
    const yOf = (v: number) => (H - 40) - v * (H - 90);               // ρ_s/ρ 0–1
    c.strokeStyle = '#ef4444'; c.setLineDash([5, 4]); c.lineWidth = 2;
    c.beginPath(); c.moveTo(xOf(TL), 30); c.lineTo(xOf(TL), H - 40); c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#ef4444'; c.font = '13px sans-serif';
    c.fillText('λ=2.17K', xOf(TL) - 18, 42);
    c.strokeStyle = '#06b6d4'; c.lineWidth = 3; c.beginPath();
    for (let j = 0; j <= 70; j++) {
      const TT = 1.4 + (j / 70) * 1.4;
      if (j === 0) c.moveTo(xOf(TT), yOf(fsOf(TT))); else c.lineTo(xOf(TT), yOf(fsOf(TT)));
    }
    c.stroke();
    c.fillStyle = '#fbbf24';
    c.beginPath(); c.arc(xOf(T), yOf(fs), 5, 0, 7); c.fill();
    c.fillStyle = '#94a3b8'; c.font = '13px sans-serif';
    c.fillText(T < TL ? '超流相（量化涡旋/膜存在）' : '正常相（无量化涡旋）', 60, 60);
    c.fillText('ρ_s/ρ≈1−(T/Tλ)⁴ 示意', 60, H - 58);
    term.tex.needsUpdate = true;
  }
  drawTherm(2.1, fsOf(2.1));

  // 无黏性转子（在超流中持续转动的叶轮）
  const rotor = new THREE.Group();
  rotor.position.y = -0.6;
  g.add(rotor);
  const bladeGeo = bag.geo(new THREE.BoxGeometry(0.08, 0.7, 1.6));
  const bladeMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, metalness: 0.5, roughness: 0.4 }));
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(bladeGeo, bladeMat);
    b.rotation.y = (i / 4) * Math.PI * 2;
    rotor.add(b);
  }

  g.add(panelSprite(THREE, bag, [
    { text: '超流 He-II：黏度 η → 0，可无摩擦爬壁（Rollin 膜）', color: '#f8fafc' },
    { text: '量子化涡旋：环量 Γ = ∮v·dl = n·h/m₄ ≈ n×10⁻⁷ m²/s（标签见右）', color: '#94a3b8' },
    { text: '叶轮在超流中转动几乎不受阻（无耗散）', color: '#fbbf24' },
    { text: 'λ 点 2.17 K（左温度计）：T>λ 正常相无量化涡旋；T<λ 两流体 ρ=ρ_s+ρ_n', color: '#ef4444' },
    { text: '膜爬过杯沿→外壁成膜，并经底缘微缝成滴漏出（穿缝，示意）', color: '#67e8f9' },
  ], [0, 4.6, 0], 7.8, 'center'));

  ctx.camera.position.set(0, 2.5, 12);
  let lastB = -1;
  return (t: number, dt: number) => {
    // 温度在 1.5–2.7 K 往复，穿越 λ 点；两相占比由温度计同源计算
    const T = 2.1 + 0.6 * Math.sin(t * 0.35);
    const fs = fsOf(T);   // 超流份额 ρ_s/ρ（示意近似）
    // Rollin 膜：超流份额决定上爬高度（越过杯沿 y=1.6 后外壁成膜）
    film.scale.y = 1 + 0.55 * fs;
    film.position.y = 0.88 * fs;
    (film.material as import('three').MeshBasicMaterial).opacity = 0.12 + 0.32 * fs;
    (outerFilm.material as import('three').MeshBasicMaterial).opacity = 0.34 * fs;
    outerFilm.visible = fs > 0.03;
    // 穿缝滴漏（超流相才漏）
    drip.visible = fs > 0.05;
    channel.visible = fs > 0.05;
    const fall = (t * 0.5) % 1;
    drip.position.y = -2.2 - fall * 1.1;
    // 量子化涡旋仅存在于超流相：不透明度 ∝ ρ_s/ρ
    vortices.forEach((v, i) => {
      v.rotation.y = t * (0.5 + i * 0.2);
      (v.material as import('three').LineBasicMaterial).opacity = 0.08 + 0.8 * fs;
    });
    vortexLabels.forEach((sp) => {
      (sp.material as import('three').SpriteMaterial).opacity = fs > 0.05 ? 1 : 0.12;
    });
    // 液面轻微波动（仅超流膜持续时）
    surface.scale.setScalar(1 + 0.015 * Math.sin(t * 1.7) * fs);
    // 转子持续加速（无黏性阻力；正常相有黏滞 → 增速随 fs 走）
    rotor.rotation.y += dt * (0.6 + 3.4 * fs + 0.8 * fs * Math.sin(t * 0.3));
    // 温度计 5Hz 重绘
    const bucket = Math.floor(t * 5);
    if (bucket !== lastB) {
      lastB = bucket;
      drawTherm(T, fs);
    }
  };
}
