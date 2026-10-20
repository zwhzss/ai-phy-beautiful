import type { SceneContext, SceneInstance } from '../types';
/**
 * 安培环路定理的应用（P440）：三条右手闭合场带（长直导线 / 螺绕环 / 充电电容器间隙）+ 可选套的嵌套安培环路。
 * 面板与几何同源：每个环路的 ∮B·dl 都由同一组真实三维采样点做矢量线积分算出（不是套公式抄数）。
 *   ① 长直导线 B = μ0I/(2πr)·(ŵ×r̂)，环路若套住导线 ⇒ ∮B·dl = μ0I（与环路形状、倾角、半径无关）
 *   ② 螺绕环（N 匝、电流 I）：管内 B = μ0NI/(2πρ)，管外 B = 0 ⇒ 同轴环 ∮=μ0NI，绕管截面的环 ∮=0
 *   ③ 位移电流修正：平行板充电时导线穿过的面 I_enc=I，鼓出的面穿过间隙 ⇒ 必须补 ε0·dΦ_E/dt = I_d，
 *      间隙内 B = μ0I·r/(2πR_p²)（r<R_p），r=R_p 处与管外连续；本场景对同一环路两种曲面分别求和并对照
 *   ④ 单位换算：1 世界单位 = 10 cm；采样点用真实米制坐标代入以上公式
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  const MU0 = 4 * Math.PI * 1e-7, S = 0.1, TWO_PI = Math.PI * 2;   // S：世界单位 → 米
  const I_WIRE = 12, N_TOR = 200, I_TOR = 2, R_PLATE = 0.05;        // 12 A 直导线、200 匝螺绕环通 2 A、极板半径 5 cm
  const W_X = -2.6, T_X = 2.45, T_R = 0.85, T_A = 0.3;              // 导线/螺绕环位置与环径（世界单位）

  // ===== 星野 + 网格 =====
  const starGeo = geo(new THREE.BufferGeometry());
  {
    const q = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) { q[i * 3] = (Math.random() - 0.5) * 200; q[i * 3 + 1] = (Math.random() - 0.5) * 200; q[i * 3 + 2] = (Math.random() - 0.5) * 200; }
    starGeo.setAttribute('position', new THREE.BufferAttribute(q, 3));
  }
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  grid.position.y = -3.35;
  group.add(grid);

  // ===== 真实磁场（输入世界坐标，内部换算成米；返回 T 矢量） =====
  const v3 = (x: number, y: number, z: number): import('three').Vector3 => new THREE.Vector3(x, y, z);
  function bWire(p: import('three').Vector3, I: number): import('three').Vector3 {
    const dx = (p.x - W_X) * S, dz = p.z * S;                // 导线沿 y 轴
    const r2 = dx * dx + dz * dz;
    if (r2 < 1e-10) return v3(0, 0, 0);
    const k = (MU0 * I) / (TWO_PI * r2);                     // B = μ0I/(2πr²)·(ŷ×r)，大小 μ0I/(2πr)
    return v3(k * dz, 0, -k * dx);
  }
  function bToroid(p: import('three').Vector3, I: number): import('three').Vector3 {
    const dx = (p.x - T_X) * S, dz = p.z * S, yy = (p.y - 0.55) * S;
    const rho = Math.hypot(dx, dz);
    if (rho < 1e-10) return v3(0, 0, 0);
    const inTube = (rho - T_R * S) ** 2 + yy * yy < (T_A * S) ** 2;   // 是否落在绕组管内
    if (!inTube) return v3(0, 0, 0);
    const k = (MU0 * N_TOR * I) / (TWO_PI * rho);
    return v3((k * dz) / rho, 0, (-k * dx) / rho);
  }
  function bCap(p: import('three').Vector3, I: number): import('three').Vector3 {
    const dx = p.x * S, dz = p.z * S;                        // 电容器轴：竖直 y，位于世界 (0,−2.55,0)
    const r = Math.hypot(dx, dz);
    if (r < 1e-10) return v3(0, 0, 0);
    const k = r < R_PLATE ? (MU0 * I * r) / (TWO_PI * R_PLATE * R_PLATE) : (MU0 * I) / (TWO_PI * r);
    return v3((k * dz) / r, 0, (-k * dx) / r);
  }
  /** 环路上 160 个采样点的矢量线积分 ∮B·dl（世界坐标 ×S ⇒ 米制，返回 T·m） */
  function integrate(pts: import('three').Vector3[], B: (p: import('three').Vector3) => import('three').Vector3): { sum: number, run: number[] } {
    let sum = 0;
    const run: number[] = [0];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const mid = v3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      const dl = v3((b.x - a.x) * S, (b.y - a.y) * S, (b.z - a.z) * S);
      sum += B(mid).dot(dl);
      run.push(sum);
    }
    return { sum, run };
  }
  function circlePts(cx: number, cy: number, cz: number, r: number, tilt: number, n: number, plane: 'h' | 'v'): import('three').Vector3[] {
    const out: import('three').Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TWO_PI, c = Math.cos(a) * r, s = Math.sin(a) * r;
      let x = c, y = 0, z = -s;                              // h：水平环（xz 面），取右手绕 +y 的正向
      if (plane === 'v') { x = c; y = s; z = 0; }            // v：含轴线的竖直环 ⇒ 绕管截面环
      const ct = Math.cos(tilt), st = Math.sin(tilt);        // 绕 x 轴倾角（验证与形状无关）
      out.push(v3(cx + x, cy + y * ct - z * st, cz + y * st + z * ct));
    }
    return out;
  }

  // ===== 导线：铜柱 + 三层右手场带（环带 + 箭头） =====
  const wireMesh = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.055, 0.055, 5.6, 12)), mat(new THREE.MeshStandardMaterial({ color: 0xc9762b, metalness: 0.85, roughness: 0.3, emissive: 0xfbbf24, emissiveIntensity: 0.15 })));
  wireMesh.position.set(W_X, 0.2, 0);
  group.add(wireMesh);
  const ribbonMat = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  const ribGeo = geo(new THREE.TorusGeometry(1, 0.012, 4, 72));
  const ribs: { m: import('three').Mesh, base: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(ribGeo, ribbonMat);
    m.rotation.x = Math.PI / 2; m.position.set(W_X, 1.5 - i * 1.5, 0);
    group.add(m); ribs.push({ m, base: i });
  }
  const coneGeo = geo(new THREE.ConeGeometry(0.07, 0.26, 8));
  const coneMat = mat(new THREE.MeshBasicMaterial({ color: 0x22c55e }));
  const YH = new THREE.Vector3(0, 1, 0);
  const cones: import('three').Mesh[] = [];
  for (let i = 0; i < 18; i++) { const c = new THREE.Mesh(coneGeo, coneMat); group.add(c); cones.push(c); }
  const XH = new THREE.Vector3(1, 0, 0);

  // ===== 安培环路池：3 个嵌套圆环（导线）+ 1 个不套导线 + 螺绕环内/外/截面 =====
  const NS = 160;
  interface Loop {
    kind: 'wire' | 'wireOut' | 'torIn' | 'torOut' | 'torPoly' | 'cap';
    mesh: import('three').Line; trail: import('three').BufferGeometry; trailPos: Float32Array;
    rW: number; tilt: number; mark: import('three').Mesh; sum: number; run: number[]; label: string;
  }
  const loopMat = (color: number): import('three').MeshBasicMaterial => mat(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
  function makeLoop(kind: Loop['kind'], color: number, label: string): Loop {
    const g = geo(new THREE.BufferGeometry());
    const pos = new Float32Array(NS * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setDrawRange(0, 0);
    const mesh = new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color, transparent: true })));
    group.add(mesh);
    const tg = geo(new THREE.BufferGeometry());
    const tpos = new Float32Array(NS * 3);
    tg.setAttribute('position', new THREE.BufferAttribute(tpos, 3));
    tg.setDrawRange(0, 0);
    group.add(new THREE.Line(tg, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24, linewidth: 2 }))));
    const mark = new THREE.Mesh(geo(new THREE.SphereGeometry(0.075, 10, 10)), mat(new THREE.MeshBasicMaterial({ color: 0xf8fafc })));
    group.add(mark);
    return { kind, mesh, trail: tg, trailPos: tpos, rW: 0.5, tilt: 0, mark, sum: 0, run: [0], label };
  }
  const L1 = makeLoop('wire', 0x22d3ee, '环路①（小）');
  const L2 = makeLoop('wire', 0xa855f7, '环路②（2 倍径）');
  const L3 = makeLoop('wire', 0xf472b6, '环路③（4 倍径 + 倾角）');
  const L0 = makeLoop('wireOut', 0x94a3b8, '环路⊘（不套导线）');
  const LT = makeLoop('torIn', 0x22c55e, '螺绕环内同轴环');
  const LO = makeLoop('torOut', 0x94a3b8, '螺绕环外同轴环');
  const LP = makeLoop('torPoly', 0xef4444, '绕管截面环');
  const LC = makeLoop('cap', 0xfbbf24, '间隙内环路 r<R_p');
  const LOOPS = [L1, L2, L3, L0, LT, LO, LP, LC];

  // ===== 螺绕环本体 + 绕组 =====
  const torMat = mat(new THREE.MeshStandardMaterial({ color: 0x6b7a8f, metalness: 0.6, roughness: 0.5, transparent: true, opacity: 0.32 }));
  const tor = new THREE.Mesh(geo(new THREE.TorusGeometry(T_R, T_A, 16, 44)), torMat);
  tor.rotation.x = Math.PI / 2; tor.position.set(T_X, 0.55, 0);
  group.add(tor);
  {
    const pts: number[] = [];
    const M = 2400;
    for (let i = 0; i <= M; i++) {
      const u = (i / M) * TWO_PI, v = u * N_TOR / 2;
      const rr = T_R + T_A * Math.cos(v) * 1.02;
      pts.push((T_X + rr * Math.cos(u)) * S * 10, 0.55 + T_A * Math.sin(v) * 1.02, rr * Math.sin(u) * S * 10);
    }
    const wg = geo(new THREE.BufferGeometry());
    wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    wg.setDrawRange(0, M + 1);
    group.add(new THREE.Line(wg, mat(new THREE.LineBasicMaterial({ color: 0xc9762b, transparent: true, opacity: 0.85 }))));
  }
  // 管内环向箭头
  const torArrows: import('three').Mesh[] = [];
  for (let i = 0; i < 12; i++) { const a = new THREE.Mesh(coneGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22c55e }))); group.add(a); torArrows.push(a); }

  // ===== 电容器（间隙 E 场 + 极板） =====
  const plateGeo = geo(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 24));   // R_p=5 cm（1 世界单位=10 cm）
  const plateMat = mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.35 }));
  const plates: import('three').Mesh[] = [];
  for (const sgn of [-1, 1]) {
    const p = new THREE.Mesh(plateGeo, plateMat);
    p.position.set(0, -2.55 + sgn * 0.26, 0);
    group.add(p); plates.push(p);
  }
  const eArrowGeo = geo(new THREE.ConeGeometry(0.05, 0.36, 8));
  const eMat = mat(new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.85 }));
  const eArrows: import('three').Mesh[] = [];
  for (let i = 0; i < 9; i++) { const a = new THREE.Mesh(eArrowGeo, eMat); group.add(a); eArrows.push(a); }

  // ===== 标签 =====
  function label(text: string, color: string, x: number, y: number, z: number, w = 2.4): void {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 24px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(w, w / 8, 1); s.position.set(x, y, z); s.renderOrder = 997;
    group.add(s);
  }
  label('长直导线 I=12 A（沿 +y）', '#fbbf24', W_X, 3.3, 0, 2.6);
  label('右手闭合场带 B=μ0I/2πr', '#22d3ee', W_X, -2.9, 0, 2.5);
  label('螺绕环 N=200 匝 I=2 A', '#c9762b', T_X, 2.5, 0, 2.3);
  label('管内 B=μ0NI/2πρ 管外 B=0', '#22c55e', T_X, -0.9, 0, 2.5);
  label('充电电容器：I_d=ε0·dΦE/dt', '#f472b6', 0.05, -3.5, 0.2, 2.9);

  // ===== 面板 =====
  const CW = 900, CH = 300;
  const infoCv = document.createElement('canvas'); infoCv.width = CW; infoCv.height = CH;
  const ic = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const panel = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  panel.scale.set(8.8, (8.8 * CH) / CW, 1); panel.position.set(0, 5.15, 0); panel.renderOrder = 999;
  group.add(panel);
  const est = (s2: string, px: number): number => { let e = 0; for (const ch of s2) e += ch.charCodeAt(0) > 0x2e7f ? px : px * 0.56; return e; };
  const put = (y: number, color: string, text: string, size = 24, bold = false): void => {
    let s = size;
    while (est(text, s) > CW - 44 && s > 11) s -= 1;
    ic.fillStyle = color; ic.font = `${bold ? 'bold ' : ''}${s}px "PingFang SC", sans-serif`;
    ic.fillText(text, 20, y);
  };
  let Iw = I_WIRE, It = I_TOR, sel = 0, prog = 0, rBase = 0.03, rc = 0.03;
  const fT = (x: number): string => (x * 1e6).toFixed(2);
  function drawInfo(): void {
    ic.clearRect(0, 0, CW, CH);
    ic.fillStyle = 'rgba(7,11,20,0.86)'; ic.fillRect(2, 2, CW - 4, CH - 4);
    ic.strokeStyle = '#334155'; ic.lineWidth = 3; ic.strokeRect(2, 2, CW - 4, CH - 4);
    ic.textAlign = 'left';
    put(30, '#f8fafc', '∮B·dl = μ0·I_enc（右手定则取号；只由穿过的电流决定）', 25, true);
    put(60, '#22d3ee', `长直导线 B=μ0I/(2πr)：μ0I=${fT(MU0 * Iw)} μT·m。环路①②③半径 ${rBase * 1000 | 0}/${(rBase * 2e3) | 0}/${(rBase * 4e3) | 0} mm`);
    put(87, '#a855f7', `实测线积分（160 点矢量求和）：∮①=${fT(L1.sum)} ∮②=${fT(L2.sum)} ∮③=${fT(L3.sum)} μT·m ⇒ 三者相等且=μ0I`);
    put(114, '#94a3b8', `不套导线的环路⊘：∮=${fT(L0.sum)} μT·m（≈0，验证 I_enc=0 时环量为零，与环路大小无关）`);
    put(141, '#22c55e', `螺绕环：管内环 ∮=${fT(LT.sum)} 对比 μ0NI=${fT(MU0 * N_TOR * It)} μT·m；管外环 ∮=${fT(LO.sum)}；截面环 ∮=${fT(LP.sum)}（均≈0）`);
    put(168, '#fbbf24', `管内 B(ρ) 采样：ρ=${((LT.rW * S * 1000)).toFixed(0)} mm ⇒ B=${(LT.sum / (TWO_PI * LT.rW * S) * 1e3).toFixed(3)} mT`);
    put(197, '#f472b6', `位移电流：环路④ r=${(rc * 1000).toFixed(0)} mm < R_p=50 mm ⇒ ∮=${fT(LC.sum)} μT·m = μ0·I_d（穿过极板间的曲面，I_d=I·(r/R_p)²）`);
    put(224, '#22d3ee', `同一环路若改取穿过导线的曲面 ⇒ I_enc=I；改取鼓出曲面穿过间隙 ⇒ I_enc=0，必须补 ε0·dΦE/dt 才自洽（麦克斯韦修正）`);
    put(258, '#fbbf24', `读数：I(t)=${Iw.toFixed(2)} A  选中 ${LOOPS[sel].label}  积分进度 ${(prog * 100).toFixed(0)}%  累积 ∫B·dl=${fT(prog === 0 ? 0 : LOOPS[sel].run[Math.min(NS - 1, Math.floor(prog * NS))])} μT·m`, 22, true);
    put(286, '#94a3b8', `交替电流周期 16 s（I=I0·sin），环路半径扫描 16 s，选取轮换 12 s（4 s/个）`, 22);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  const tmp = new THREE.Vector3();
  return {
    update(t, dt) {
      // 自变量：① 电流 I（16 s 交变）② 环路半径 r（16 s 扫 25→45 mm）③ 环路选取（12 s 轮换 8 个）④ 倾角（0→35°）
      Iw = I_WIRE * Math.sin((t % 16) / 16 * TWO_PI);
      It = I_TOR * Math.sin((t % 16) / 16 * TWO_PI + 1.1);
      rBase = 0.025 + 0.02 * (0.5 - 0.5 * Math.cos((t % 16) / 16 * TWO_PI));
      const tilt = (0.5 - 0.5 * Math.cos((t % 16) / 16 * TWO_PI)) * 0.61;
      sel = Math.floor(((t % 12) / 12) * LOOPS.length) % LOOPS.length;
      prog = ((t % 4) / 4);
      rc = 0.015 + 0.03 * (0.5 - 0.5 * Math.cos((t % 16) / 16 * TWO_PI));

      // 场带：半径随 rBase 呼吸，箭头沿切向、方向随 I 反号
      for (let i = 0; i < ribs.length; i++) {
        const rr = rBase * 10 * (1 + i * 1.0);
        ribs[i].m.scale.set(rr, rr, 1);
        (ribs[i].m.material as import('three').MeshBasicMaterial).opacity = 0.12 + 0.3 * Math.min(1, Math.abs(Iw) / I_WIRE);
      }
      for (let i = 0; i < cones.length; i++) {
        const ring = i % 3, a = (Math.floor(i / 3) / 6) * TWO_PI + t * 0.35;
        const rr = rBase * 10 * (1 + ring * 1.0);
        const px = W_X + rr * Math.cos(a), pz = rr * Math.sin(a), py = 1.5 - ring * 1.5;
        cones[i].position.set(px, py, pz);
        tmp.set(Math.sin(a) * Math.sign(Iw || 1), 0, -Math.cos(a) * Math.sign(Iw || 1)).normalize();
        cones[i].quaternion.setFromUnitVectors(YH, tmp);
        const sc = 0.5 + 1.6 * Math.min(1, (MU0 * Math.abs(Iw)) / (TWO_PI * rBase * (1 + ring)) / 4e-4);
        cones[i].scale.setScalar(sc);
      }
      // 环路几何 + 真实线积分
      const set: Record<string, { cx: number, cy: number, cz: number, rW: number, tilt: number, plane: 'h' | 'v' }> = {
        wire: { cx: W_X, cy: 0.2, cz: 0, rW: rBase / S, tilt, plane: 'h' },
        wireOut: { cx: W_X + 1.95, cy: 0.2, cz: 0, rW: 0.34, tilt: 0, plane: 'h' },
        torIn: { cx: T_X, cy: 0.55, cz: 0, rW: T_R - T_A * 0.45, tilt: 0, plane: 'h' },
        torOut: { cx: T_X, cy: 0.55, cz: 0, rW: T_R + T_A + 0.34, tilt: 0, plane: 'h' },
        torPoly: { cx: T_X + T_R, cy: 0.55, cz: 0, rW: T_A * 1.5, tilt: 0, plane: 'v' },
        cap: { cx: 0, cy: -2.55, cz: 0, rW: rc / S, tilt: 0, plane: 'h' },
      };
      const field: Record<string, (p: import('three').Vector3) => import('three').Vector3> = {
        wire: (p) => bWire(p, Iw), wireOut: (p) => bWire(p, Iw),
        torIn: (p) => bToroid(p, It), torOut: (p) => bToroid(p, It), torPoly: (p) => bToroid(p, It),
        cap: (p) => bCap(p, Iw),
      };
      for (let i = 0; i < LOOPS.length; i++) {
        const lp = LOOPS[i], c = set[lp.kind];
        const pts = circlePts(c.cx, c.cy, c.cz, c.rW, c.tilt, NS, c.plane);
        lp.rW = c.rW;
        for (let k = 0; k < NS; k++) lp.mesh.geometry.attributes['position'].setXYZ(k, pts[k].x, pts[k].y, pts[k].z);
        lp.mesh.geometry.attributes['position'].needsUpdate = true;
        lp.mesh.geometry.setDrawRange(0, NS);
        (lp.mesh.material as import('three').LineBasicMaterial).opacity = i === sel ? 0.95 : 0.3;
        const res = integrate(pts, field[lp.kind]);
        lp.sum = res.sum; lp.run = res.run;
        if (i === sel) {
          const upto = Math.max(2, Math.floor(prog * NS));
          for (let k = 0; k < upto; k++) lp.trail.attributes['position'].setXYZ(k, pts[k].x, pts[k].y, pts[k].z);
          lp.trail.attributes['position'].needsUpdate = true;
          lp.trail.setDrawRange(0, upto);
          const mk = pts[Math.min(NS - 1, upto - 1)];
          lp.mark.position.set(mk.x, mk.y, mk.z);
          lp.mark.visible = true;
        } else { lp.trail.setDrawRange(0, 0); lp.mark.visible = false; }
      }
      // 螺绕环管内箭头：环向、强度 ∝ μ0NI/2πρ
      for (let i = 0; i < torArrows.length; i++) {
        const a = (i / torArrows.length) * TWO_PI + t * 0.2;
        torArrows[i].position.set(T_X + T_R * Math.cos(a), 0.55, T_R * Math.sin(a));
        tmp.set(Math.sin(a) * Math.sign(It || 1), 0, -Math.cos(a) * Math.sign(It || 1)).normalize();
        torArrows[i].quaternion.setFromUnitVectors(YH, tmp);
        torArrows[i].scale.setScalar(0.5 + 1.3 * Math.min(1, Math.abs(It) / I_TOR));
      }
      torMat.opacity = 0.2 + 0.25 * Math.min(1, Math.abs(It) / I_TOR);
      // 电容器：极板带电辉光 + E 箭头随 ∫I dt 增长（I_d = ε0·dΦE/dt = I ⇒ 环量与导线电流一致）
      const Qn = 1 - Math.cos((t % 16) / 16 * TWO_PI);            // 归一化极板电荷（∝∫I dt）
      plateMat.emissive.setHex(Iw >= 0 ? 0x22d3ee : 0xa855f7);
      plateMat.emissiveIntensity = 0.1 + 0.5 * Math.abs(Iw) / I_WIRE;
      for (let i = 0; i < eArrows.length; i++) {
        const gx = ((i % 3) - 1) * 0.3, gz = (Math.floor(i / 3) - 1) * 0.3;
        eArrows[i].position.set(gx, -2.55, gz);
        eArrows[i].rotation.set(0, 0, Iw >= 0 ? 0 : Math.PI);
        eArrows[i].scale.setScalar(0.4 + 1.1 * Qn * Math.min(1, 0.2 + Math.abs(Iw) / I_WIRE));
      }
      eMat.opacity = 0.25 + 0.6 * Qn;
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
