import type { SceneContext, SceneInstance } from '../types';
import { scaffold, panelSprite, PAL, ResourceBag } from './_common';

/**
 * 宇宙学族（cosmos）：弗里德曼膨胀 / FLRW 尺度因子与曲率 / 中子星状态方程。
 * 由 scene-registry 按 slug+variant 绑定：make(variant, title)。
 */
export function make(variant: string, title: string): (ctx: SceneContext) => SceneInstance {
  return (ctx) => scaffold(ctx, {
    title,
    camera: [0, 4, 15],
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
    case 'nsstar': return nsstar(ctx, g, bag, THREE);
    case 'default':
    default: return friedmann(ctx, g, bag, THREE, title);
  }
}

/** 弗里德曼膨胀：共动网格随 a(t) 扩张，星系退行 v = H₀d */
function friedmann(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
) {
  const inflation = title.includes('暴胀');
  const horizon = title.includes('视界');
  const asym = title.includes('重子') || title.includes('不对称');

  // 共动网格：随 a(t) 缩放
  const grid = new THREE.GridHelper(10, 10, 0x475569, 0x1e293b);
  g.add(grid);
  const grid2 = new THREE.GridHelper(10, 10, 0x475569, 0x1e293b);
  grid2.rotation.x = Math.PI / 2;
  g.add(grid2);

  // 星系点（共动坐标固定，随 a 拉开）
  const NG = 60;
  const com: import('three').Vector3[] = [];
  const dots: import('three').Mesh[] = [];
  const dotGeo = bag.geo(new THREE.SphereGeometry(0.12, 10, 10));
  const dotMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: 0xb45309, emissiveIntensity: 0.4 }));
  for (let i = 0; i < NG; i++) {
    const c = new THREE.Vector3(
      (Math.random() - 0.5) * 8,
      (Math.random() - 0.5) * 3,
      (Math.random() - 0.5) * 8,
    );
    com.push(c);
    const m = new THREE.Mesh(dotGeo, dotMat);
    m.position.copy(c);
    g.add(m);
    dots.push(m);
  }

  // 中央观测者
  const obs = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.22, 16, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, emissive: 0x0891b2, emissiveIntensity: 0.6 })),
  );
  g.add(obs);

  // 退行箭头（取一个代表星系）
  const arrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0), com[0], 2, PAL.red, 0.25, 0.12,
  );
  g.add(arrow);

  // 视界球
  const horizonMesh = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(1, 32, 20)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.violet, wireframe: true, transparent: true, opacity: 0.3 })),
  );
  horizonMesh.visible = horizon;
  g.add(horizonMesh);

  // 原初量子涨落点阵（仅暴胀支显示）：共动坐标固定、尺度随 a 拉伸，
  // 每点的红蓝差即密度对比 δρ/ρ（示意），用来表达 concept 承诺的"原初涨落被暴胀拉出"
  const NFL = 200;
  const comF = new Float32Array(NFL * 3);
  const flucArr = new Float32Array(NFL * 3);
  const flucCol = new Float32Array(NFL * 3);
  for (let i = 0; i < NFL; i++) {
    const cx = (Math.random() - 0.5) * 7;
    const cy = (Math.random() - 0.5) * 2.6;
    const cz = (Math.random() - 0.5) * 7;
    comF[i * 3] = cx; comF[i * 3 + 1] = cy; comF[i * 3 + 2] = cz;
    const d = Math.random() - 0.5; // 密度对比
    flucCol[i * 3] = 0.5 + 0.5 * d;
    flucCol[i * 3 + 1] = 0.62 - 0.3 * Math.abs(d);
    flucCol[i * 3 + 2] = 0.5 - 0.5 * d;
  }
  const flucGeo = bag.geo(new THREE.BufferGeometry());
  flucGeo.setAttribute('position', new THREE.BufferAttribute(flucArr, 3));
  flucGeo.setAttribute('color', new THREE.BufferAttribute(flucCol, 3));
  const flucMat = bag.mat(new THREE.PointsMaterial({
    size: 0.1, vertexColors: true, transparent: true, opacity: 0.85,
  }));
  const fluc = new THREE.Points(flucGeo, flucMat);
  fluc.visible = inflation;
  g.add(fluc);

  // 事件视界对比球（仅视界支显示）：半径 = a(t)·∫_t^∞ dt′/a(t′)，与粒子视界球同源积分
  const evtMesh = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(1, 32, 20)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.amber, wireframe: true, transparent: true, opacity: 0.24 })),
  );
  evtMesh.visible = horizon;
  g.add(evtMesh);

  // 重子不对称：正反粒子对湮灭后残留
  const baryons: import('three').Mesh[] = [];
  const anti: import('three').Mesh[] = [];
  const bGeo = bag.geo(new THREE.SphereGeometry(0.1, 8, 8));
  const bMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.green }));
  const aMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.red }));
  for (let i = 0; i < 24; i++) {
    const b = new THREE.Mesh(bGeo, bMat);
    const a = new THREE.Mesh(bGeo, aMat);
    b.position.set((Math.random() - 0.5) * 6, 2 + Math.random() * 1.5, (Math.random() - 0.5) * 6);
    a.position.copy(b.position);
    g.add(b); g.add(a);
    baryons.push(b); anti.push(a);
  }

  // CP 破坏的几何表达（仅 asym 支）：一对严格镜像的手征螺旋 + 镜面
  // 物质侧（右手）与反物质侧（左手）各有一个小球沿自身螺旋爬升，
  // 速率差 ε_CP 即 CP 破缺 —— 同样的镜像过程进行得不一样快，才可能留下净重子数（画面为放大示意）
  const EPS_CP = 0.25;
  const HELIX_TURNS = 1.5;
  const helixPoint = (hand: number, s: number): import('three').Vector3 => new THREE.Vector3(
    Math.cos(hand * s * Math.PI * 2 * HELIX_TURNS) * 0.45,
    s * 1.6 - 0.8,
    Math.sin(hand * s * Math.PI * 2 * HELIX_TURNS) * 0.45,
  );
  const cpRig = new THREE.Group();
  cpRig.position.set(0, 0.9, 3.4);
  g.add(cpRig);
  const mkHelix = (hand: number, color: number): import('three').Line => {
    const pts: import('three').Vector3[] = [];
    for (let i = 0; i <= 60; i++) pts.push(helixPoint(hand, i / 60));
    const geo = bag.geo(new THREE.BufferGeometry().setFromPoints(pts));
    return new THREE.Line(geo, bag.mat(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })));
  };
  const helixM = mkHelix(1, PAL.green);
  helixM.position.x = -1.5;
  const helixA = mkHelix(-1, PAL.red);
  helixA.position.x = 1.5;
  const beadGeo = bag.geo(new THREE.SphereGeometry(0.13, 12, 12));
  const beadM = new THREE.Mesh(beadGeo, bag.mat(new THREE.MeshBasicMaterial({ color: PAL.green })));
  beadM.position.x = -1.5;
  const beadA = new THREE.Mesh(beadGeo, bag.mat(new THREE.MeshBasicMaterial({ color: PAL.red })));
  beadA.position.x = 1.5;
  cpRig.add(helixM); cpRig.add(helixA); cpRig.add(beadM); cpRig.add(beadA);
  const mirror = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(1.4, 2.2)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.slate, transparent: true, opacity: 0.16, side: THREE.DoubleSide })),
  );
  mirror.rotation.y = Math.PI / 2;
  cpRig.add(mirror);
  const showCp = asym;
  [helixM, helixA, beadM, beadA, mirror].forEach((o) => { o.visible = showCp; });

  // 视界支的 5Hz 读数板：d_H、d_E 数字与两球半径来自同一次数值积分（同源）
  const hudCv = document.createElement('canvas');
  hudCv.width = 512; hudCv.height = 112;
  const hudCtx = hudCv.getContext('2d')!;
  const hudTex = bag.tex(new THREE.CanvasTexture(hudCv));
  const hud = new THREE.Sprite(bag.mat(new THREE.SpriteMaterial({ map: hudTex, transparent: true, depthTest: false })));
  hud.scale.set(6.8, 6.8 * (112 / 512), 1);
  hud.position.set(0, -3.6, 0);
  hud.renderOrder = 998;
  hud.visible = horizon;
  g.add(hud);
  const drawHud = (a: number, dH: number, dE: number): void => {
    hudCtx.clearRect(0, 0, 512, 112);
    hudCtx.fillStyle = 'rgba(7,11,20,0.74)';
    hudCtx.fillRect(4, 4, 504, 104);
    hudCtx.strokeStyle = 'rgba(51,65,85,0.9)'; hudCtx.lineWidth = 3;
    hudCtx.strokeRect(4, 4, 504, 104);
    hudCtx.font = '27px "PingFang SC", "Microsoft YaHei", sans-serif';
    hudCtx.textBaseline = 'middle';
    hudCtx.fillStyle = '#fbbf24';
    hudCtx.fillText(`读数：a=${a.toFixed(2)}  d_H=${dH.toFixed(2)}（紫）  d_E=${dE.toFixed(2)}（橙）`, 18, 38);
    hudCtx.fillStyle = '#94a3b8';
    hudCtx.fillText('半径 = c·a(t)∫dt′/a(t′) 梯形积分实算（画面光速 c=1 单位/秒，循环示意）', 18, 80);
    hudTex.needsUpdate = true;
  };

  g.add(panelSprite(THREE, bag, inflation ? [
    { text: '暴胀：a(t) ∝ e^{Ht}，10⁻³⁶ s 内膨胀 e⁶⁰ 倍', color: '#f8fafc' },
    { text: '解决视界问题（各处温度相同）与平坦性问题', color: '#94a3b8' },
    { text: '暴胀后重加热，物质–辐射主导时代开始', color: '#94a3b8' },
    { text: '彩点＝原初量子涨落，间距与团块尺度随 a 一同拉伸', color: '#f472b6' },
    { text: '指数膨胀按周期循环播放（一个循环＝一段 e-折叠，示意）', color: '#67e8f9' },
  ] : horizon ? [
    { text: '粒子视界 d_H = a(t)∫dt′/a(t′)：可接收信号的范围（紫球）', color: '#f8fafc' },
    { text: '事件视界 d_E = a(t)∫dt′/a(t′)：今后任何时刻都能收到信号的范围（橙球）', color: '#fbbf24' },
    { text: '共动距离固定，固有距离随 a(t) 增长', color: '#94a3b8' },
    { text: '橙球外的星系随 a 增长被推出事件视界 → 永远失联', color: '#a78bfa' },
    { text: '两球半径均由上述积分按周期循环数值算出（教学近似：未来积分截断于 u+6）', color: '#67e8f9' },
  ] : asym ? [
    { text: '重子不对称：n_B/n_γ ≈ 6×10⁻¹⁰', color: '#f8fafc' },
    { text: 'CP 破缺 + 重子数不守恒 + 偏离热平衡（Sakharov 条件）', color: '#94a3b8' },
    { text: '湮灭后残留 1/10⁹ 的物质，反物质几乎耗尽', color: '#22c55e' },
    { text: '镜面对两侧手征螺旋：物质右手 / 反物质左手，爬升速率差 ε_CP=0.25', color: '#f472b6' },
    { text: '手征与残留比例均为放大示意（真实残留约十亿分之一）', color: '#94a3b8' },
  ] : [
    { text: '弗里德曼方程 (ȧ/a)² = 8πGρ/3 − kc²/a²', color: '#f8fafc' },
    { text: '哈勃定律 v = H₀d：星系退行速度与距离成正比', color: '#94a3b8' },
    { text: '物质主导 a ∝ t^{2/3}；暗能量主导 a ∝ e^{Ht}', color: '#94a3b8' },
  ], [0, 4.0, 0], 7.4, 'center'));

  ctx.camera.position.set(0, 5, 16);
  let lastCycle = -1;
  let lastHud = -1;
  let dH = 0;
  let dE = 0;

  // a(u)：辐射/物质主导幂律 + 暗能量指数尾巴（视界支的积分被积函数）
  const aLaw = (x: number) => 0.35 + 1.9 * Math.pow(x + 0.35, 2 / 3) + 0.25 * (Math.exp(x) - 1);
  const invA = (x: number) => 1 / aLaw(x);
  // 梯形积分：∫du/a(u)，共动视界 = 该积分 / AU（dt = du/AU）
  const trapz = (from: number, to: number, n: number): number => {
    if (to <= from) return 0;
    const h = (to - from) / n;
    let s = 0.5 * (invA(from) + invA(to));
    for (let i = 1; i < n; i++) s += invA(from + i * h);
    return s * h;
  };
  const AU = 0.18;      // u = AU·t（场景秒）
  const C_SCENE = 1.0;  // 画面光速：1 场景单位/场景秒，把 ∫dt/a 换算成场景长度
  const R_MAX = 9.5;    // 球半径显示上限
  const CYC = 5.8;      // 暴胀/视界支的循环周期（秒）
  const U_INF = 0.46;   // 暴胀循环末 u：a = e^{2.2·0.46} ≈ 2.73（不触发 3.2 钳制）
  const U_HOR = 1.04;   // 视界循环末 u：a ≈ 3.19（恰好不到钳制值，全程都在膨胀）

  return (t: number) => {
    // a(t)：暴胀支与视界支把 u 按周期取模循环播放 → 指数/加速膨胀动画持续可见、不再冻结；
    // 默认支与 asym 支沿用原来的单调 a(t)（未命中分支行为不变）
    const u = inflation
      ? (t % CYC) / CYC * U_INF
      : horizon
        ? (t % CYC) / CYC * U_HOR
        : t * AU;
    const a = inflation ? Math.exp(u * 2.2) : aLaw(u);
    const aC = Math.min(a, 3.2);

    grid.scale.setScalar(aC);
    grid2.scale.setScalar(aC);

    // 原初涨落：共动点阵随 a 拉开，涨落团块的表征尺度也随之变大
    if (inflation) {
      for (let i = 0; i < NFL; i++) {
        flucArr[i * 3] = comF[i * 3] * aC;
        flucArr[i * 3 + 1] = comF[i * 3 + 1] * aC;
        flucArr[i * 3 + 2] = comF[i * 3 + 2] * aC;
      }
      (flucGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
      flucMat.size = 0.022 + 0.032 * aC;
    }

    // 星系按共动坐标 * a 排布
    let refD = 0;
    dots.forEach((m, i) => {
      m.position.copy(com[i]).multiplyScalar(aC);
      if (i === 0) refD = m.position.length();
    });
    obs.position.set(0, 0, 0);

    // 退行箭头 v = H d
    const d = refD;
    const v = 0.55 * d;
    arrow.position.copy(dots[0].position);
    arrow.setLength(Math.min(3, 0.4 + v * 0.5), 0.25, 0.12);
    arrow.setDirection(dots[0].position.clone().normalize());

    if (horizon) {
      // 面板承诺的积分实算：d_H = c·a∫₀ᵗ dt′/a，d_E = c·a∫ₜ^∞ dt′/a（尾部截断于 u+6，误差 <1%）
      const hb = Math.floor(t * 5); // 读数与球半径按 5Hz 刷同一批数值
      if (hb !== lastHud) {
        lastHud = hb;
        const chiH = trapz(0, u, 160) / AU;
        const chiE = trapz(u, u + 6, 240) / AU;
        dH = C_SCENE * aC * chiH;
        dE = C_SCENE * aC * chiE;
        horizonMesh.scale.setScalar(Math.min(R_MAX, Math.max(0.05, dH)));
        evtMesh.scale.setScalar(Math.min(R_MAX, Math.max(0.05, dE)));
        drawHud(aC, Math.min(R_MAX, dH), Math.min(R_MAX, dE));
      }
    }

    if (asym) {
      // CP 破坏示意：镜面对两侧的手征镜像过程以不同速率进行（Γ ≠ Γ̄），
      // 物质侧小球爬得快 → 每一轮湮灭后留下的净物质更多
      const sM = (t * 0.34) % 1;
      const sA = (t * 0.34 * (1 - EPS_CP)) % 1;
      beadM.position.copy(helixPoint(1, sM)); beadM.position.x -= 1.5;
      beadA.position.copy(helixPoint(-1, sA)); beadA.position.x += 1.5;
      // 湮灭动画：成对消失，绿球（物质）按 1:10⁹ 残留 —— 视觉上保留少量
      const cyc = Math.floor(t * 0.5) % 3;
      if (cyc !== lastCycle) {
        lastCycle = cyc;
        baryons.forEach((b, i) => {
          const keep = i % 12 === 0; // 残留比例（示意）
          b.visible = keep || cyc === 0;
          anti[i].visible = !keep && cyc === 0;
        });
      }
      anti.forEach((a2, i) => {
        a2.position.lerp(baryons[i].position, 0.04);
      });
    }
  };
}

/** 中子星：TOV 质量–半径关系 + 内部层级 */
function nsstar(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
) {
  // 分层球壳：外层 crust / 内核 core / 中心超子核
  const layers = [
    { r: 1.6, col: 0x334155, op: 0.55, name: '外壳（核晶格 + 电子）' },
    { r: 1.15, col: 0x0891b2, op: 0.6, name: '内壳（中子富集核）' },
    { r: 0.7, col: 0xf59e0b, op: 0.7, name: '核芯（中子超流 + 质子超导）' },
    { r: 0.32, col: 0xf472b6, op: 0.85, name: '可能的夸克核' },
  ];
  const layerMeshes: import('three').Mesh[] = [];
  layers.forEach((L) => {
    const m = new THREE.Mesh(
      bag.geo(new THREE.SphereGeometry(L.r, 36, 24)),
      bag.mat(new THREE.MeshStandardMaterial({
        color: L.col, transparent: true, opacity: L.op, roughness: 0.5, metalness: 0.2,
      })),
    );
    g.add(m);
    layerMeshes.push(m);
  });

  // 快速自转轴
  const axisGeo = bag.geo(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -2.4, 0), new THREE.Vector3(0, 2.4, 0),
  ]));
  g.add(new THREE.Line(axisGeo, bag.mat(new THREE.LineDashedMaterial({ color: PAL.slate, gapSize: 0.2, dashSize: 0.25 }))));

  // 磁层偶极场线（脉冲星束）
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const pts: import('three').Vector3[] = [];
    for (let s = 0; s <= 24; s++) {
      const u = s / 24;
      const r = 1.7 + u * 2.6;
      const bend = Math.sin(u * Math.PI) * 1.4;
      pts.push(new THREE.Vector3(
        Math.cos(ang) * (r - bend) * 0.5,
        Math.sign(Math.cos(ang)) * (1.6 + u * 2.2),
        Math.sin(ang) * (r - bend) * 0.5,
      ));
    }
    const l = new THREE.Line(
      bag.geo(new THREE.BufferGeometry().setFromPoints(pts)),
      bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.55 })),
    );
    g.add(l);
  }

  // —— M–R 关系：曲线、M_TOV 白点、质量游标、潮汐读数全部来自同一个 rOf(m)（几何与读数同源）——
  const M_TOV = 2.2;                                        // 极限质量（TOV 上限）
  const rOf = (m: number) => 12.6 - 0.9 * m * m + 0.12 * m * m * m; // R/m（km），随质量单调收缩
  const K2 = 0.08;                                          // 典型二阶潮汐 Love 数
  const compactness = (m: number) => 1.4766 * m / rOf(m);   // C = GM/(Rc²)，1.4766 km/M☉
  const lambdaOf = (m: number) => (2 / 3) * K2 / Math.pow(compactness(m), 5); // Λ = (2/3)k₂C⁻⁵

  const cv = document.createElement('canvas');
  cv.width = 320; cv.height = 320;
  const c2 = cv.getContext('2d')!;
  const tex = bag.tex(new THREE.CanvasTexture(cv));
  const plot = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(3.6, 3.6)),
    bag.mat(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false })),
  );
  plot.position.set(-7.4, 1.2, 0);
  plot.renderOrder = 997;
  g.add(plot);

  const PX = (m: number) => 48 + (m / 2.5) * 250;
  // R 轴取 6–14 km 区间（曲线在这段里，避免全挤在顶端）
  const PY = (r: number) => 276 - ((r - 6) / 8) * 250;
  function drawMR(mNow: number): void {
    c2.fillStyle = 'rgba(7,11,20,0.85)'; c2.fillRect(0, 0, 320, 320);
    c2.strokeStyle = '#334155'; c2.lineWidth = 3; c2.strokeRect(1.5, 1.5, 317, 317);
    c2.strokeStyle = '#475569'; c2.lineWidth = 2; c2.beginPath();
    c2.moveTo(48, 20); c2.lineTo(48, 276); c2.lineTo(304, 276); c2.stroke();
    c2.fillStyle = '#94a3b8'; c2.font = '18px sans-serif'; c2.textAlign = 'center';
    c2.fillText('M / M☉', 176, 304); c2.fillText('R / km', 22, 40);
    c2.font = '14px sans-serif';
    [0, 1, 2].forEach((m) => c2.fillText(String(m), PX(m), 294));
    c2.textAlign = 'right';
    [6, 10, 14].forEach((r) => c2.fillText(String(r), 44, PY(r) + 5));
    // TOV 曲线：只画到 M_TOV（更大质量直接坍缩为黑洞）
    c2.strokeStyle = '#f59e0b'; c2.lineWidth = 3; c2.beginPath();
    for (let i = 0; i <= 100; i++) {
      const m = 0.3 + (i / 100) * (M_TOV - 0.3);
      if (i === 0) c2.moveTo(PX(m), PY(rOf(m))); else c2.lineTo(PX(m), PY(rOf(m)));
    }
    c2.stroke();
    // M_TOV 白点 = 曲线端点本身，坐标由 rOf 算出（必定落在曲线上）
    c2.fillStyle = '#f8fafc'; c2.beginPath(); c2.arc(PX(M_TOV), PY(rOf(M_TOV)), 6, 0, 7); c2.fill();
    // 质量游标 + 引导虚线（与星体半径、潮汐读数同一 m）
    c2.strokeStyle = '#06b6d4'; c2.lineWidth = 2; c2.setLineDash([6, 5]);
    c2.beginPath(); c2.moveTo(PX(mNow), 276); c2.lineTo(PX(mNow), PY(rOf(mNow))); c2.stroke();
    c2.beginPath(); c2.moveTo(48, PY(rOf(mNow))); c2.lineTo(PX(mNow), PY(rOf(mNow))); c2.stroke();
    c2.setLineDash([]);
    c2.fillStyle = '#67e8f9'; c2.beginPath(); c2.arc(PX(mNow), PY(rOf(mNow)), 5, 0, 7); c2.fill();
    c2.textAlign = 'left'; c2.font = '16px sans-serif';
    c2.fillStyle = '#f8fafc';
    c2.fillText(`M_TOV=${M_TOV.toFixed(1)} M☉, R=${rOf(M_TOV).toFixed(1)} km`, 62, PY(rOf(M_TOV)) - 10);
    c2.fillStyle = '#67e8f9';
    c2.fillText(`游标 M=${mNow.toFixed(2)} M☉ → R=${rOf(mNow).toFixed(1)} km`, 56, 200);
    c2.fillText(`C=GM/Rc²=${compactness(mNow).toFixed(3)}`, 56, 224);
    c2.fillText(`Λ=(2/3)k₂C⁻⁵=${lambdaOf(mNow).toFixed(0)}（k₂=${K2}）`, 56, 248);
    tex.needsUpdate = true;
  }

  // 潮汐形变（双星中的 Love 数椭率，画面按 TIDAL_AMP 放大）：伴星 + 长轴指向伴星的形变外壳
  const TIDAL_AMP = 60;
  const outer = layerMeshes[0]; // 最外壳层：潮汐椭率只作用在它上面，长轴始终指向伴星
  const companion = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.5, 24, 18)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0x334155, emissiveIntensity: 0.4 })),
  );
  g.add(companion);
  const tidePtsGeo = bag.geo(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0),
  ]));
  const tideAxis = new THREE.Line(
    tidePtsGeo,
    bag.mat(new THREE.LineBasicMaterial({ color: PAL.pink, transparent: true, opacity: 0.8 })),
  );
  g.add(tideAxis);

  g.add(panelSprite(THREE, bag, [
    { text: 'TOV 方程：dP/dr = −G(M+4πr³P/c²)(ρ+P/c²)/(r²(1−2GM/rc²))', color: '#f8fafc' },
    { text: `ρ ≈ ρ_核 ≈ 2.8×10¹⁷ kg/m³；曲线 R(M) 给出 R(1.4)=${rOf(1.4).toFixed(1)} km、R(M_TOV)=${rOf(M_TOV).toFixed(1)} km`, color: '#94a3b8' },
    { text: '中子简并压支撑；超过 M_TOV 即坍缩为黑洞', color: '#fbbf24' },
    { text: '潮汐形变：椭率 ∝ k₂(R/a)³（放大 60 倍示意），长轴指向伴星', color: '#f472b6' },
    { text: '无量纲形变度 Λ=(2/3)k₂C⁻⁵ 随质量游标刷新（左图读数，5Hz）', color: '#67e8f9' },
  ], [0, 4.0, 0], 7.8, 'center'));

  ctx.camera.position.set(0, 3, 14);
  let lastDraw = -1;
  return (t: number) => {
    g.rotation.y = t * 0.12;
    // 质量在 0.6–2.2 M☉ 间缓慢扫描：星体半径、潮汐读数与曲线游标共用同一个 m
    const mNow = 1.4 - 0.8 * Math.cos(t * 0.35);
    const base = rOf(mNow) / 12.6;                 // 半径随质量收缩（与 M–R 曲线同源）
    const sep = 4.6 + 1.4 * Math.sin(t * 0.5);     // 双星间距 a（场景单位）
    companion.position.set(sep, 0, 0);
    tideAxis.scale.set(sep, 1, 1);
    // 潮汐椭率 ε = k₂(R/a)³：R 用当前质量的星体半径（与曲线同源），画面放大 60 倍
    const strain = Math.min(0.55, K2 * Math.pow((1.6 * base) / sep, 3) * TIDAL_AMP);
    // 整体半径随质量收缩（与 M–R 曲线同源）；只有外壳带潮汐椭率
    outer.scale.set(base * (1 + strain), base * (1 - strain / 2), base * (1 - strain / 2));
    layerMeshes.slice(1).forEach((m) => { m.scale.setScalar(base); });
    // 画布读数限帧 ~5Hz
    if (Math.floor(t * 5) !== lastDraw) { lastDraw = Math.floor(t * 5); drawMR(mNow); }
  };
}
