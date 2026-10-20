import type { SceneContext, SceneInstance } from '../types';
/**
 * 透镜制作者公式（P207）—— 主控方程：
 *   1/f = (n−1)[ 1/R₁ − 1/R₂ + (n−1)d/(n·R₁·R₂) ]     （厚透镜：材料 n × 形状(1/R₁−1/R₂) × 厚度修正）
 *   形状因子 X = (R₂+R₁)/(R₂−R₁)，等功率参数化 R₁ = 2(n−1)f/(1+X)，R₂ = 2(n−1)f/(X−1)  ⇒ 改变 X 不动 f，只改球差
 *   消色差双合：P = P₁+P₂ 且 P₁/V₁ = −P₂/V₂（阿贝数 V = (n−1)/(n_F−n_C)）
 * 透镜母线由球面真实矢高 x(y)=c−sgn(R)√(R²−y²) 生成；光线用矢量 Snell 逐面追迹（C/d/F 三色、多级孔径），
 * 所以 EFL、BFL、主平面 H′、球差 ΔSA、纵向色差 Δf_FC 全是追迹结果。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [];
  const mats: { dispose(): void }[] = [];
  const texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  const TWO_PI = Math.PI * 2;
  const SC = 15.5;              // world 单位 / 米
  const X0 = -0.035;            // 第一面顶点（米）
  const CYCLE = 18;
  const F_TARGET = 0.15;        // 阶段①固定的目标焦距

  // —— 真实玻璃 ——
  const V_CROWN = 64.2, V_FLINT = 36.4;
  const CROWN_N = 1.5168, FLINT_N = 1.6200;
  /** 由 d 线与 V 数拆出 C/F 线折射率（BK7：n_F−n_C = 0.00805） */
  function glass(nD: number, V: number): number[] {
    const dn = (nD - 1) / V;
    return [nD - 0.31 * dn, nD, nD + 0.69 * dn];   // [C, d, F]
  }
  const vOfN = (n: number): number => Math.max(30, 64.2 - 130 * (n - 1.5168));

  // —— 当前系统 ——
  interface Surf { R: number; cx: number }
  let surfs: Surf[] = [];
  let nsC: number[] = [], nsD: number[] = [], nsF: number[] = [];
  let pairs: { f: number; b: number; col: number }[] = [];
  let yA = 0.052;

  const surfaceX = (s: Surf, y: number): number =>
    s.cx - Math.sign(s.R) * Math.sqrt(Math.max(0, s.R * s.R - y * y));

  function setSinglet(R1: number, R2: number, thk: number, nD: number, V: number): void {
    surfs = [{ R: R1, cx: X0 + R1 }, { R: R2, cx: X0 + thk + R2 }];
    const g = glass(nD, V);
    nsC = [g[0], 1]; nsD = [g[1], 1]; nsF = [g[2], 1];
    pairs = [{ f: 0, b: 1, col: 0xa8d8ff }];
  }
  function setDoublet(P: number, thkA: number, thkB: number): void {
    const p1 = (P * V_CROWN) / (V_CROWN - V_FLINT);
    const p2 = P - p1;
    const rA = (2 * (CROWN_N - 1)) / p1;
    const R1 = rA, R2 = -rA;
    const R3 = 1 / (1 / R2 - p2 / (FLINT_N - 1));
    const v2 = X0 + thkA, v3 = v2 + thkB;
    surfs = [{ R: R1, cx: X0 + R1 }, { R: R2, cx: v2 + R2 }, { R: R3, cx: v3 + R3 }];
    const gc = glass(CROWN_N, V_CROWN), gf = glass(FLINT_N, V_FLINT);
    nsC = [gc[0], gf[0], 1]; nsD = [gc[1], gf[1], 1]; nsF = [gc[2], gf[2], 1];
    pairs = [{ f: 0, b: 1, col: 0xa8d8ff }, { f: 1, b: 2, col: 0xffcf8f }];
  }

  // —— 追迹 ——
  const MAXPTS = 6;
  const scratch = new Float32Array(MAXPTS * 2);
  function traceRay(h0: number, ns: number[]): { n: number; xF: number; xH: number } {
    let px = X0 - 0.09, py = h0, dx = 1, dy = 0, nBefore = 1, n = 0;
    scratch[0] = px; scratch[1] = py; n = 1;
    for (let i = 0; i < surfs.length; i++) {
      const s = surfs[i];
      const nAfter = ns[i];
      const rr = Math.abs(s.R);
      const ox = px - s.cx, oy = py;
      const b = ox * dx + oy * dy;
      const c = ox * ox + oy * oy - rr * rr;
      const disc = b * b - c;
      if (disc <= 1e-12) return { n: 0, xF: NaN, xH: NaN };
      const sq = Math.sqrt(disc);
      let hit = -1, hx = 0, hy = 0;
      for (const s2 of [-b - sq, -b + sq]) {
        if (s2 < 1e-5) continue;
        const qx = px + dx * s2, qy = py + dy * s2;
        if (Math.abs(qy) <= yA * 1.015 && n < MAXPTS) { hit = s2; hx = qx; hy = qy; break; }
      }
      if (hit < 0) return { n: 0, xF: NaN, xH: NaN };
      let nx = (hx - s.cx) / rr, ny = hy / rr;
      const eta = nBefore / nAfter;
      let ci = -(dx * nx + dy * ny);
      if (ci < 0) { nx = -nx; ny = -ny; ci = -ci; }
      const kk = 1 - eta * eta * (1 - ci * ci);
      if (kk < 0) return { n: 0, xF: NaN, xH: NaN };
      const ct = Math.sqrt(kk);
      dx = eta * dx + (eta * ci - ct) * nx;
      dy = eta * dy + (eta * ci - ct) * ny;
      const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      px = hx; py = hy; nBefore = nAfter;
      scratch[n * 2] = px; scratch[n * 2 + 1] = py; n++;
    }
    // 出射光线 r(τ)=(px,py)+τ(dx,dy)：与轴交点 = F′；反延到入射高度 h₀ = 主平面 H′
    const okD = Math.abs(dy) > 1e-6;
    const xF = okD ? px + dx * (-py / dy) : Infinity;
    const xH = okD ? px + dx * ((h0 - py) / dy) : Infinity;
    if (n < MAXPTS) {
      const goFwd = Number.isFinite(xF) && xF > px + 0.02;
      const xEnd = goFwd ? xF + 0.008 : px + 0.14;
      scratch[n * 2] = xEnd; scratch[n * 2 + 1] = py + dy * ((xEnd - px) / (dx || 1e-6)); n++;
    }
    return { n, xF, xH };
  }

  // —— 星野 / 地面 / 光轴 ——
  const starGeo = geo(new THREE.BufferGeometry());
  const starPos = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 200;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);
  {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-4.6, 0, 0, 4.6, 0, 0]), 3));
    group.add(new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.85 }))));
  }

  // —— 透镜实体（回转面，位置逐帧由矢高公式重算）——
  const NY = 7, NP = 30, SEG = 5;
  interface Body { g: import('three').BufferGeometry; pos: Float32Array; m: import('three').MeshPhysicalMaterial; mesh: import('three').Mesh }
  const bodies: Body[] = [];
  for (let k = 0; k < 2; k++) {
    const pos = new Float32Array((NY + 1) * NP * 2 * 3);
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const vi = (i: number, j: number, s: number): number => (i * NP + ((j % NP) + NP) % NP) * 2 + s;
    const idx: number[] = [];
    for (let i = 0; i < NY; i++) {
      for (let j = 0; j < NP; j++) {
        idx.push(vi(i, j, 0), vi(i + 1, j, 0), vi(i + 1, j + 1, 0));
        idx.push(vi(i, j, 0), vi(i + 1, j + 1, 0), vi(i, j + 1, 0));
        idx.push(vi(i, j, 1), vi(i, j + 1, 1), vi(i + 1, j + 1, 1));
        idx.push(vi(i, j, 1), vi(i + 1, j + 1, 1), vi(i + 1, j, 1));
      }
    }
    for (let j = 0; j < NP; j++) {
      idx.push(vi(NY, j, 0), vi(NY, j, 1), vi(NY, j + 1, 1));
      idx.push(vi(NY, j, 0), vi(NY, j + 1, 1), vi(NY, j + 1, 0));
    }
    g.setIndex(idx);
    const m = mat(new THREE.MeshPhysicalMaterial({
      color: 0xa8d8ff, metalness: 0.05, roughness: 0.1, transparent: true, opacity: 0.4,
      side: THREE.DoubleSide, clearcoat: 0.5,
    }));
    const mesh = new THREE.Mesh(g, m);
    mesh.visible = k === 0;
    group.add(mesh);
    bodies.push({ g, pos, m, mesh });
  }
  function updateBody(b: Body, pair: { f: number; b: number }): void {
    const sf = surfs[pair.f], sb = surfs[pair.b];
    let v = 0;
    for (let i = 0; i <= NY; i++) {
      const y = yA * (i / NY);
      const xf = surfaceX(sf, y), xb = surfaceX(sb, y);
      for (let j = 0; j < NP; j++) {
        const phi = TWO_PI * (j / NP);
        const cy = y * Math.cos(phi), cz = y * Math.sin(phi);
        b.pos[v * 3] = xf * SC; b.pos[v * 3 + 1] = cy * SC; b.pos[v * 3 + 2] = cz * SC; v++;
        b.pos[v * 3] = xb * SC; b.pos[v * 3 + 1] = cy * SC; b.pos[v * 3 + 2] = cz * SC; v++;
      }
    }
    b.g.attributes['position'].needsUpdate = true;
    b.g.computeVertexNormals();
  }

  // —— 三色平行光束（孔径分数固定，实际高度随 yA 走）——
  interface RaySet { g: import('three').BufferGeometry; pos: Float32Array; line: import('three').LineSegments }
  const NR = 7;
  const FRACS: number[] = [];
  for (let i = 0; i < NR; i++) FRACS.push((0.18 + 0.82 * (i / (NR - 1))) * (i % 2 === 0 ? 1 : -1));
  const rayH: number[] = FRACS.map(() => 0);
  function refreshHeights(): void {
    for (let i = 0; i < NR; i++) rayH[i] = FRACS[i] * yA;
  }
  function makeRays(color: number): RaySet {
    const pos = new Float32Array(NR * SEG * 2 * 3);
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const line = new THREE.LineSegments(g, mat(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.78 })));
    group.add(line);
    return { g, pos, line };
  }
  const setD = makeRays(0xfbbf24);   // d 光 589nm（主）
  const setF = makeRays(0x60a5fa);   // F 光 486nm（蓝）
  const setC = makeRays(0xf87171);   // C 光 656nm（红）

  function drawSet(rs: RaySet, ns: number[], ys: number): { xF: number[]; xH: number[] } {
    const xF: number[] = [], xH: number[] = [];
    for (let i = 0; i < NR; i++) {
      const r = traceRay(rayH[i], ns);
      xF.push(r.xF); xH.push(r.xH);
      const base = i * SEG * 6;
      if (r.n < 3) { rs.pos.fill(0, base, base + SEG * 6); continue; }
      for (let s = 0; s < SEG; s++) {
        const o = base + s * 6;
        const a = Math.min(s, r.n - 1), b = Math.min(s + 1, r.n - 1);
        rs.pos[o] = scratch[a * 2] * SC; rs.pos[o + 1] = scratch[a * 2 + 1] * SC + ys; rs.pos[o + 2] = 0;
        rs.pos[o + 3] = scratch[b * 2] * SC; rs.pos[o + 4] = scratch[b * 2 + 1] * SC + ys; rs.pos[o + 5] = 0;
      }
    }
    rs.g.attributes['position'].needsUpdate = true;
    return { xF, xH };
  }

  // —— 焦点/主平面/色差标尺 ——
  const dotGeo = geo(new THREE.SphereGeometry(0.05, 12, 12));
  const fDot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.075, 16, 16)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  const fDotC = new THREE.Mesh(dotGeo, mat(new THREE.MeshBasicMaterial({ color: 0xf87171 })));
  const fDotF = new THREE.Mesh(dotGeo, mat(new THREE.MeshBasicMaterial({ color: 0x60a5fa })));
  const bandGeo = geo(new THREE.PlaneGeometry(0.012, 1.3));
  const hMark = new THREE.Mesh(bandGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.8, side: THREE.DoubleSide })));
  const fPlane = new THREE.Mesh(bandGeo, mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.4, side: THREE.DoubleSide })));
  group.add(fDot, fDotC, fDotF, hMark, fPlane);
  const CA_Y = -1.15, CA_MAG = 25;
  const tickGeo = geo(new THREE.PlaneGeometry(0.01, 0.26));
  const tickD = new THREE.Mesh(tickGeo, mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  const tickC = new THREE.Mesh(tickGeo, mat(new THREE.MeshBasicMaterial({ color: 0xf87171 })));
  const tickF = new THREE.Mesh(tickGeo, mat(new THREE.MeshBasicMaterial({ color: 0x60a5fa })));
  group.add(tickD, tickC, tickF);
  const caBaseGeo = geo(new THREE.BufferGeometry());
  caBaseGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-4.4, CA_Y, 0, 4.4, CA_Y, 0]), 3));
  group.add(new THREE.Line(caBaseGeo, mat(new THREE.LineBasicMaterial({ color: 0x334155 }))));

  // —— ΔSA–X 曲线（阶段①扫描时累积）——
  const PLOT_X0 = 1.15, PLOT_W = 2.6, PLOT_Y0 = 1.65, PLOT_H = 1.05;
  const NCU = 44;
  const cuPos = new Float32Array(NCU * 3);
  const cuGeo = geo(new THREE.BufferGeometry());
  cuGeo.setAttribute('position', new THREE.BufferAttribute(cuPos, 3));
  cuGeo.setDrawRange(0, 0);
  group.add(new THREE.Line(cuGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e }))));
  {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([PLOT_X0, PLOT_Y0, 0, PLOT_X0 + PLOT_W, PLOT_Y0, 0, PLOT_X0, PLOT_Y0, 0, PLOT_X0, PLOT_Y0 + PLOT_H, 0]), 3));
    group.add(new THREE.LineSegments(g, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));
  }
  const cuDot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.05, 12, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })));
  group.add(cuDot);
  let cuCount = 0, cuActive = -1;

  // —— 标签 ——
  function makeLabel(text: string, color: string, scale = 3.2): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  const lbLens = makeLabel('母线 = 球面矢高', '#94a3b8', 2.6); lbLens.position.set(-0.2, 1.15, 0);
  const lbF = makeLabel("追迹后焦点 F′", '#fbbf24', 2.6);
  const lbH = makeLabel("主平面 H′", '#22d3ee', 2.2);
  const lbCA = makeLabel('纵向色差标尺 Δf×25（红 C／黄 d／蓝 F）', '#f8fafc', 4.0); lbCA.position.set(-2.0, CA_Y - 0.38, 0);
  const lbPlot = makeLabel('球差 ΔSA 随形状因子 X', '#22c55e', 3.2); lbPlot.position.set(PLOT_X0 + PLOT_W / 2, PLOT_Y0 + PLOT_H + 0.28, 0);
  group.add(lbLens, lbF, lbH, lbCA, lbPlot);

  // —— 信息面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 800; infoCv.height = 252;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(8.8, 2.77)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 3.15, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  const rd = {
    mode: '', r1: 0.155, r2: -0.155, n: CROWN_N, thk: 0.03, v: V_CROWN, x: 0,
    fAn: F_TARGET, fTr: F_TARGET, bfl: 0, sa: 0, ca: 0, p1: 0, p2: 0,
  };
  const mm = (v: number): string => (v * 1000).toFixed(1);
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 800, 252);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 792, 244);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3;
    infoCtx.strokeRect(4, 4, 792, 244);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 27px "PingFang SC", sans-serif';
    infoCtx.fillText('透镜制作者公式：焦距 = 材料 × 形状（＋厚度修正）', 22, 38);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '24px "PingFang SC", sans-serif';
    infoCtx.fillText('1/f = (n−1)[1/R₁ − 1/R₂ + (n−1)d/(n R₁R₂)]', 22, 70);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText(`此刻 R₁=${rd.r1.toFixed(3)}m  R₂=${rd.r2.toFixed(3)}m  n_d=${rd.n.toFixed(4)}  V=${rd.v.toFixed(1)}  d=${mm(rd.thk)}mm  X=${rd.x.toFixed(2)}`, 22, 100);
    infoCtx.fillStyle = '#34d399';
    infoCtx.fillText(`公式 f=${rd.fAn.toFixed(4)}m ↔ 追迹 f′=${Number.isFinite(rd.fTr) ? rd.fTr.toFixed(4) : '∞'}m  BFL=${Number.isFinite(rd.bfl) ? mm(rd.bfl) : '—'}mm`, 22, 130);
    infoCtx.fillStyle = '#f472b6';
    infoCtx.fillText(`球差 ΔSA(边缘−近轴)=${mm(rd.sa)}mm    纵向色差 Δf(C−F)=${mm(rd.ca)}mm`, 22, 160);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 23px "PingFang SC", sans-serif';
    const ach = rd.p1 !== 0 ? `  P₁=${rd.p1.toFixed(1)}, P₂=${rd.p2.toFixed(1)} m⁻¹` : '';
    infoCtx.fillText(`读数：${rd.mode}${ach}`, 22, 192);
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '23px "PingFang SC", sans-serif';
    infoCtx.fillText('红 C 656nm／黄 d 589nm／蓝 F 486nm；f′=x_F′−x_H′ 由追迹光线定主平面', 22, 224);
    infoTex.needsUpdate = true;
  }

  setSinglet(0.155, -0.155, 0.03, CROWN_N, V_CROWN);
  drawInfo();

  let smoothN = CROWN_N;
  let smoothX = -0.3;
  let dblP = 0;
  let cuLastT = -1;

  return {
    update(t, dt) {
      const ph = t % CYCLE;
      const k = Math.min(1, dt * 4.5);
      let mode = 0;
      let R1 = 0.155, R2 = -0.155, thk = 0.03, nD = CROWN_N, V = V_CROWN;

      if (ph < 7) {
        // ① 等功率改形状：X 从 −0.30 扫到 +0.85，f 不变、球差大幅变化
        mode = 0;
        rd.mode = '① 扫形状因子 X（f 不变，看球差极小值）';
        smoothX += ((-0.3 + 1.15 * (ph / 7)) - smoothX) * k;
        smoothN += (CROWN_N - smoothN) * k;
        const X = smoothX, nn = smoothN;
        const kk = 2 * (nn - 1) * F_TARGET;
        R1 = kk / (1 + X);
        R2 = kk / (X - 1);
        nD = nn; V = vOfN(nn);
        yA = 0.052;
        if (cuActive !== 0) { cuActive = 0; cuCount = 0; cuLastT = -1; cuGeo.setDrawRange(0, 0); }
      } else if (ph < 12) {
        // ② 形状（曲率）不动，只改材料：n_d 1.50 → 1.78 ⇒ 光焦度 ∝ (n−1) 增大、焦距缩短、色差恶化
        mode = 0;
        rd.mode = '② 扫材料 n_d（R₁、R₂ 不动 ⇒ f 缩短）';
        smoothX += (0.45 - smoothX) * k;
        const target = 1.50 + 0.28 * ((ph - 7) / 5);
        smoothN += (target - smoothN) * k;
        const kk = 2 * (CROWN_N - 1) * F_TARGET;   // 曲率按 n=CROWN_N 定死，此处只换 n ⇒ f 真的随材料变
        R1 = kk / (1 + smoothX);
        R2 = kk / (smoothX - 1);
        nD = smoothN; V = vOfN(smoothN);
        yA = 0.052;
        cuActive = 0;
      } else {
        mode = 1;
        rd.mode = '③ 消色差双合透镜（冕＋火石）';
        smoothN += (CROWN_N - smoothN) * k;
        yA = 0.034;
        cuActive = 1;
      }

      if (mode === 1) {
        dblP = 1 / 0.215;
        setDoublet(dblP, 0.020, 0.007);
        rd.p1 = dblP * V_CROWN / (V_CROWN - V_FLINT);
        rd.p2 = -dblP * V_FLINT / (V_CROWN - V_FLINT);
        rd.r1 = surfs[0].R; rd.r2 = surfs[2].R; rd.n = FLINT_N; rd.v = V_FLINT; rd.thk = 0.027; rd.x = 0;
        rd.fAn = 1 / dblP;
      } else {
        setSinglet(R1, R2, thk, nD, V);
        dblP = 0; rd.p1 = 0; rd.p2 = 0;
        rd.r1 = R1; rd.r2 = R2; rd.n = nD; rd.v = V; rd.thk = thk; rd.x = smoothX;
        rd.fAn = 1 / ((nD - 1) * (1 / R1 - 1 / R2 + ((nD - 1) * thk) / (nD * R1 * R2)));
      }

      for (let i = 0; i < bodies.length; i++) {
        if (i < pairs.length) {
          bodies[i].mesh.visible = true;
          bodies[i].m.color.setHex(pairs[i].col);
          updateBody(bodies[i], pairs[i]);
        } else bodies[i].mesh.visible = false;
      }
      refreshHeights();

      const sD = drawSet(setD, nsD, 0);
      const sF = drawSet(setF, nsF, 0);
      const sC = drawSet(setC, nsC, 0);

      const vBack = surfaceX(surfs[surfs.length - 1], 0);
      const xpar = sD.xF[0], xmar = sD.xF[sD.xF.length - 1];
      const Hpar = sD.xH[0];
      const ok = Number.isFinite(xpar) && Number.isFinite(xmar) && Math.abs(xpar * SC) < 4.5;
      rd.fTr = ok ? xpar - Hpar : NaN;
      rd.bfl = ok ? xpar - vBack : NaN;
      rd.sa = ok ? xmar - xpar : 0;
      const cLast = sC.xF[sC.xF.length - 1], fLast = sF.xF[sF.xF.length - 1];
      rd.ca = Number.isFinite(cLast) && Number.isFinite(fLast) ? cLast - fLast : 0;

      fDot.visible = fPlane.visible = lbF.visible = hMark.visible = lbH.visible = ok;
      if (ok) {
        fDot.position.set(xpar * SC, 0, 0);
        fPlane.position.set(xpar * SC, 0, 0);
        fPlane.rotation.set(0, 0, Math.PI / 2);
        lbF.position.set(xpar * SC, -0.42, 0);
        hMark.position.set(Hpar * SC, 0, 0);
        hMark.rotation.set(0, 0, 0);
        lbH.position.set(Hpar * SC, 0.85, 0);
      }
      // 真实位置的色差焦点（几乎重合，靠 ×25 标尺看清）
      const showC = Number.isFinite(cLast) && Math.abs(cLast * SC) < 4.6;
      const showF = Number.isFinite(fLast) && Math.abs(fLast * SC) < 4.6;
      fDotC.visible = showC; fDotF.visible = showF;
      if (showC) fDotC.position.set(cLast * SC, 0.14, 0);
      if (showF) fDotF.position.set(fLast * SC, -0.14, 0);
      tickD.visible = ok; tickC.visible = ok; tickF.visible = ok;
      if (ok) {
        const x0 = xpar * SC;
        tickD.position.set(x0, CA_Y, 0);
        tickC.position.set(Math.min(4.5, x0 + (cLast - xpar) * SC * CA_MAG), CA_Y, 0);
        tickF.position.set(Math.max(-4.5, x0 + (fLast - xpar) * SC * CA_MAG), CA_Y, 0);
      }

      // ΔSA–X 曲线：阶段①每 0.18 s 采一个点（与画面同一追迹结果）
      if (cuActive === 0 && ok) {
        const frac = Math.max(0, Math.min(1, (smoothX + 0.3) / 1.15));
        const xs = PLOT_X0 + PLOT_W * frac;
        const saMag = Math.min(0.08, Math.abs(rd.sa));
        const ys = PLOT_Y0 + PLOT_H * (saMag / 0.08);
        if (t - cuLastT > 0.18 && cuCount < NCU) {
          cuLastT = t;
          cuPos[cuCount * 3] = xs; cuPos[cuCount * 3 + 1] = ys; cuPos[cuCount * 3 + 2] = 0;
          cuCount++;
          cuGeo.attributes['position'].needsUpdate = true;
        }
        cuGeo.setDrawRange(0, cuCount);
        cuDot.position.set(xs, ys, 0);
        cuDot.visible = true;
      } else {
        cuDot.visible = false;
      }

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
