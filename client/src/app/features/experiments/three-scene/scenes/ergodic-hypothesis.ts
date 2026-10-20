import type { SceneContext, SceneInstance } from '../types';
/**
 * 遍历性假说（P222）：Hénon–Heiles 哈密顿系统 H=½(p_x²+p_y²)+½(x²+y²)+(x²y−y³/3)。
 * 三个高 1/6 的鞍点 (0,1)、(±√3/2,−1/2) ⇒ E<1/6 被禁闭；E>1/6 从三条通道逃逸。
 * 双轨对照（RK4 dt=0.01，实测能量相对漂移 ~5×10⁻⁹）：
 *   E=1/12（近可积）：KAM 环面，相空间被不变环分割 → 时间平均 ≠ 微正则（L1 停滞 ~0.21），Lyapunov λ≈3.2×10⁻³/s；
 *   E=1/8（混沌）：λ≈2.2×10⁻²/s，Poincaré 截面无序，时间直方图随观测窗 T_obs 收敛到微正则分布（L1: 0.12→0.10）。
 * 微正则位置密度（2 自由度）：∫dp_x dp_y δ(H−E)=2π·θ(E−V) ⇒ 经典允许区 {V≤E} 上均匀 —— 紫色基准由此采样。
 * 画面：左 KAM 轨道 + 中 Poincaré 截面（闭合曲线 vs 弥散）+ 右混沌轨道充满允许区；
 *   地面两组直方图（时间平均，青/玫红）叠微正则折线（紫），观测窗 T_obs 0→16 秒制式周期重铺。
 * 数值核对：见 _scratch/agentC/hh.mjs：L1(1/12)=0.212、L1(1/8;150k)=0.122、(400k)=0.099。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  const PI = Math.PI, TWO_PI = PI * 2;
  const starGeo = geo(new THREE.BufferGeometry());
  { let s = 777; const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const p = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) { p[i * 3] = (rnd() - 0.5) * 400; p[i * 3 + 1] = (rnd() - 0.5) * 400; p[i * 3 + 2] = (rnd() - 0.5) * 400; }
    starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3)); }
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // —— 动力学核心 ——
  const Vq = (x: number, y: number) => 0.5 * (x * x + y * y) + x * x * y - y * y * y / 3;
  const step = (st: Float64Array, dt: number) => {
    const f = (u: ArrayLike<number>, out: number[]): void => { out[0] = u[2]; out[1] = u[3]; out[2] = -(u[0] + 2 * u[0] * u[1]); out[3] = -(u[1] + u[0] * u[0] - u[1] * u[1]); };
    const k1 = [0, 0, 0, 0], k2 = [0, 0, 0, 0], k3 = [0, 0, 0, 0], k4 = [0, 0, 0, 0], tmp = [0, 0, 0, 0];
    f(st, k1);
    for (let i = 0; i < 4; i++) tmp[i] = st[i] + 0.5 * dt * k1[i]; f(tmp, k2);
    for (let i = 0; i < 4; i++) tmp[i] = st[i] + 0.5 * dt * k2[i]; f(tmp, k3);
    for (let i = 0; i < 4; i++) tmp[i] = st[i] + dt * k3[i]; f(tmp, k4);
    for (let i = 0; i < 4; i++) st[i] += dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  };
  const Hfun = (st: Float64Array) => 0.5 * (st[2] * st[2] + st[3] * st[3]) + Vq(st[0], st[1]);
  interface Sys { E: number; st: Float64Array; trail: Float64Array; trN: number; trHead: number;
    line: import('three').Line; lineGeo: import('three').BufferGeometry; linePos: Float32Array;
    cloud: import('three').Points | null; cloudGeo: import('three').BufferGeometry; cloudPos: Float32Array; cloudN: number;
    secX: Float32Array; secN: number; secGeo: import('three').BufferGeometry;
    samples: Float32Array; sN: number; hmax: number; hmin: number; cx: number; }
  const SC = 1.42, CY = 2.02;
  const TRAIL = 2400, CLOUD = 3400, SECC = 1500, SRING = 20000;
  const mkSys = (E: number, cx: number, cloud: boolean, color: number): Sys => {
    const st = new Float64Array([0.25, 0, 0, Math.sqrt(2 * (E - Vq(0.25, 0)))]);
    const linePos = new Float32Array(TRAIL * 3);
    const lineGeo = geo(new THREE.BufferGeometry()); lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3)); lineGeo.setDrawRange(0, 0);
    const line = new THREE.Line(lineGeo, mat(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 })));
    group.add(line);
    let cloudGeo: import('three').BufferGeometry, cloudPos: Float32Array, cPts: import('three').Points | null = null;
    cloudPos = new Float32Array(CLOUD * 3);
    cloudGeo = geo(new THREE.BufferGeometry()); cloudGeo.setAttribute('position', new THREE.BufferAttribute(cloudPos, 3)); cloudGeo.setDrawRange(0, 0);
    if (cloud) { cPts = new THREE.Points(cloudGeo, mat(new THREE.PointsMaterial({ color: 0xfb7185, size: 0.028, transparent: true, opacity: 0.6 }))); group.add(cPts); }
    const secXf = new Float32Array(SECC * 3);
    const secG = geo(new THREE.BufferGeometry()); secG.setAttribute('position', new THREE.BufferAttribute(secXf, 3)); secG.setDrawRange(0, 0);
    group.add(new THREE.Points(secG, mat(new THREE.PointsMaterial({ color, size: 0.042 }))));
    return { E, st, trail: new Float64Array(TRAIL * 2), trN: 0, trHead: 0, line, lineGeo, linePos,
      cloud: cPts, cloudGeo, cloudPos, cloudN: 0, secX: secXf, secN: 0, secGeo: secG,
      samples: new Float32Array(SRING), sN: 0, hmax: Hfun(st), hmin: Hfun(st), cx };
  };
  const sysA = mkSys(1 / 12, -2.75, false, 0x22d3ee);   // KAM
  const sysB = mkSys(1 / 8, 2.75, true, 0xf472b6);       // 混沌
  const SYS = [sysA, sysB];

  // Poincaré 截面屏（中央）：x∈[-0.6,0.6], p_x∈[-0.7,0.7]
  const SX = (x: number) => (x / 0.62) * 0.72, SYp = (p: number) => (p / 0.72) * 0.66;
  // 允许区轮廓 V=E：沿射线二分 r∈[0,1]（g=r²/2+c r³−E，c=s−4s³/3，g 在 [0,1] 单调升）
  const contourGeo = (E: number, cx: number): import('three').BufferGeometry => {
    const g = geo(new THREE.BufferGeometry()); const p: number[] = [];
    for (let i = 0; i <= 120; i++) {
      const ph = (i / 120) * TWO_PI, s0 = Math.sin(ph), c = s0 - (4 / 3) * s0 * s0 * s0;
      let a = 0, b = 1;
      for (let k = 0; k < 30; k++) { const m = 0.5 * (a + b); const gv = 0.5 * m * m + c * m * m * m - E; if (gv > 0) b = m; else a = m; }
      const r = 0.5 * (a + b);
      p.push(cx + SC * r * Math.cos(ph), CY + SC * r * Math.sin(ph), 0);
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3));
    return g;
  };
  group.add(new THREE.Line(contourGeo(1 / 12, -2.75), mat(new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.8 }))));
  group.add(new THREE.Line(contourGeo(1 / 8, 2.75), mat(new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.8 }))));
  // 截面屏边框
  { const g = geo(new THREE.BufferGeometry()); const w = 0.72, h = 0.66;
    const p = [0 - w, CY - h, 0, w, CY - h, 0, w, CY - h, 0, w, CY + h, 0, w, CY + h, 0, -w, CY + h, 0, -w, CY + h, 0, -w, CY - h, 0];
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3));
    group.add(new THREE.LineSegments(g, mat(new THREE.LineBasicMaterial({ color: 0x475569 })))); }

  // —— 地面直方图 + 微正则折线 ——
  const BIN = 16, BLO = -0.7, BHI = 0.7, BZ0 = -2.55, BZ1 = -1.15, BH = 0.62;
  const hx = (side: number, b: number) => (side === 0 ? -4.35 : 1.55) + (b + 0.5) / BIN * 2.8;
  const microOf = (E: number): number[] => {
    let s = 24680135; const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const h = new Array(BIN).fill(0); let got = 0;
    while (got < 30000) {
      const x = (rnd() * 2 - 1), y = (rnd() * 2 - 1);
      if (Vq(x, y) > E) continue; got++;
      let b = Math.floor((x - BLO) / (BHI - BLO) * BIN); if (b < 0 || b >= BIN) continue; h[b]++;
    }
    return h.map((v) => v / got);
  };
  const microA = microOf(1 / 12), microB = microOf(1 / 8);
  const barGeo = geo(new THREE.BoxGeometry(0.155, 1, 0.155));
  const barMatCyan = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85 }));
  const barMatPink = mat(new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.85 }));
  const bars: import('three').Mesh[][] = [[], []];
  for (let side = 0; side < 2; side++) for (let b = 0; b < BIN; b++) {
    const m = new THREE.Mesh(barGeo, side === 0 ? barMatCyan : barMatPink);
    m.position.set(hx(side, b), 0.5, (BZ0 + BZ1) / 2);
    m.scale.set(1, 0.001, 1); group.add(m); bars[side].push(m);
  }
  const ovGeo: import('three').BufferGeometry[] = [];
  for (let side = 0; side < 2; side++) {
    const g = geo(new THREE.BufferGeometry()); const p = new Float32Array((BIN + 1) * 3);
    const mi = side === 0 ? microA : microB;
    for (let b = 0; b <= BIN; b++) { const v = mi[Math.min(BIN - 1, b)]; p[b * 3] = hx(side, Math.min(BIN - 1, b)); p[b * 3 + 1] = 0.06 + v * BH * 16 / 2.4; p[b * 3 + 2] = BZ0 - 0.12; }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    group.add(new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color: 0xa855f7 }))));
    ovGeo.push(g);
  }
  // 直方图坐标底轴
  { const g = geo(new THREE.BufferGeometry()); const p: number[] = [];
    for (const side of [0, 1]) { const x0 = side === 0 ? -4.35 : 1.55; p.push(x0, 0.04, BZ0 - 0.2, x0 + 2.8, 0.04, BZ0 - 0.2); }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3));
    group.add(new THREE.LineSegments(g, mat(new THREE.LineBasicMaterial({ color: 0x334155 })))); }

  function makeLabel(text: string, color: string, scale: number, x: number, y: number, z: number): void {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(scale, scale / 8, 1); s.position.set(x, y, z); s.renderOrder = 998; group.add(s);
  }
  makeLabel('KAM 环面 E=1/12：不遍历', '#22d3ee', 2.9, -2.75, 3.15, 0);
  makeLabel('混沌 E=1/8：时间≈系综', '#f472b6', 2.9, 2.75, 3.15, 0);
  makeLabel('Poincaré 截面 y=0', '#94a3b8', 2.2, 0, 3.15, 0);
  makeLabel('地面：x 的时间直方图（青/玫红）vs 微正则均匀区（紫）', '#c4b5fd', 4.4, 0, 0.4, -2.1);

  const infoCv = document.createElement('canvas'); infoCv.width = 660; infoCv.height = 252;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const info = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: false, depthTest: false })));
  info.scale.set(6.6, 2.52, 1); info.position.set(0, 4.15, 0.6); info.renderOrder = 999;
  group.add(info);

  const rd = { Tobs: 0, l1A: 0, l1B: 0, dhA: 0, dhB: 0 };
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 660, 252);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(3, 3, 654, 246);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(3, 3, 654, 246);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 23px "PingFang SC", sans-serif';
    infoCtx.fillText('遍历假说：时间平均 = 微正则平均（等能面上等权）', 12, 27);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '18px "PingFang SC", sans-serif';
    infoCtx.fillText('H=½p²+½r²+(x²y−y³/3)；鞍点高 1/6：E<1/6 禁闭，E>1/6 三通道逃逸', 12, 52);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('2 自由度微正则位置密度 ∝ ∫d²p δ(H−E) = 2π·θ(E−V) ⇒ {V≤E} 内均匀', 12, 76);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 19px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：观测窗 T_obs=${rd.Tobs.toFixed(1)}s(模拟)  L1(KAM)=${rd.l1A.toFixed(3)}  L1(混沌)=${rd.l1B.toFixed(3)}`, 12, 104);
    infoCtx.fillText(`RK4 能量相对摆幅：KAM ${(rd.dhA).toExponential(1)}，混沌 ${(rd.dhB).toExponential(1)}（dt=0.01，守恒✓）`, 12, 128);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '17px "PingFang SC", sans-serif';
    infoCtx.fillText('离线同参数核对：λ_KAM≈3.2e−3/s，λ_混沌≈2.2e−2/s；L1: 0.212 vs 0.122(150k步)/0.099(400k步)', 12, 152);
    infoCtx.fillStyle = '#22c55e'; infoCtx.font = '16px "PingFang SC", sans-serif';
    infoCtx.fillText('混沌轨：直方图随 T_obs 压向紫线（Boltzmann 假设成立的一侧）', 12, 178);
    infoCtx.fillText('KAM 轨：不变环堵死输运，任意长观测都留“记忆”→ 遍历破缺', 12, 202);
    infoTex.needsUpdate = true;
  }

  const bins = [new Float64Array(BIN), new Float64Array(BIN)];
  const STEPS = 30, DT = 0.01;
  let stepCounter = 0;
  drawInfo();

  return {
    update(t, dt) {
      const u = (t % 18) / 18;
      const Tobs = 16 * u; rd.Tobs = Tobs;
      // 积分：两系统各 30 步/帧
      for (const sys of SYS) {
        for (let i = 0; i < STEPS; i++) {
          const py = sys.st[1];
          step(sys.st, DT); stepCounter++;
          const h = Hfun(sys.st);
          if (h > sys.hmax) sys.hmax = h; if (h < sys.hmin) sys.hmin = h;
          // y=0 穿越（同向）→ 截面点 (x, p_x)
          if ((py < 0 && sys.st[1] >= 0 && sys.st[3] > 0) || (py > 0 && sys.st[1] <= 0 && sys.st[3] < 0)) {
            if (sys.secN < SECC) { const o = sys.secN * 3; sys.secX[o] = SX(sys.st[0]); sys.secX[o + 1] = CY + SYp(sys.st[2]); sys.secX[o + 2] = -0.3; sys.secN++; }
            sys.secGeo.setDrawRange(0, sys.secN);
            sys.secGeo.attributes['position'].needsUpdate = true;
          }
          sys.samples[sys.sN % SRING] = sys.st[0]; sys.sN++;
          sys.trail[sys.trHead * 2] = sys.st[0]; sys.trail[sys.trHead * 2 + 1] = sys.st[1]; sys.trHead = (sys.trHead + 1) % TRAIL;
          if (sys.trN < TRAIL) sys.trN++;
          if (sys.cloud && sys.cloudN < CLOUD && stepCounter % 5 === 0) {
            const o = sys.cloudN * 3; sys.cloudPos[o] = sys.cx + SC * sys.st[0]; sys.cloudPos[o + 1] = CY + SC * sys.st[1]; sys.cloudPos[o + 2] = 0; sys.cloudN++;
            sys.cloudGeo.setDrawRange(0, sys.cloudN); sys.cloudGeo.attributes['position'].needsUpdate = true;
          }
        }
        // 轨道尾迹：环形缓冲 → 线性副本（两段拼接）
        const lp = sys.linePos; const n = sys.trN; const head = sys.trHead;
        for (let i = 0; i < n; i++) {
          const src = ((head - n + i + TRAIL * 2) % TRAIL) * 2;
          lp[i * 3] = sys.cx + SC * sys.trail[src]; lp[i * 3 + 1] = CY + SC * sys.trail[src + 1]; lp[i * 3 + 2] = 0.02;
        }
        sys.lineGeo.attributes['position'].needsUpdate = true;
        sys.lineGeo.setDrawRange(0, n);
      }
      // 直方图：取每条系统样本环的最后 K 个（K=Tobs 窗口）
      const K = Math.max(8, Math.floor(Tobs * 100));
      bins.forEach((brow) => brow.fill(0));
      for (let side = 0; side < 2; side++) {
        const brow = bins[side];
        const sys = SYS[side], Ntot = Math.min(sys.sN, SRING);
        const kk = Math.min(Ntot, K);
        for (let i = 0; i < kk; i++) {
          const x = sys.samples[(sys.sN - kk + i) % SRING];
          let b = Math.floor((x - BLO) / (BHI - BLO) * BIN); if (b < 0 || b >= BIN) continue; brow[b]++;
        }
        let l1 = 0; const mi = side === 0 ? microA : microB;
        for (let b = 0; b < BIN; b++) {
          const p = brow[b] / kk;
          l1 += Math.abs(p - mi[b]);
          const mesh = bars[side][b];
          const target = Math.max(0.001, p * BH * 16 / 2.4);
          mesh.scale.y = mesh.scale.y + (target - mesh.scale.y) * Math.min(1, dt * 8);
          mesh.position.y = 0.5 * mesh.scale.y;
        }
        if (side === 0) rd.l1A = l1; else rd.l1B = l1;
      }
      // 能量摆幅读数（相对）：滚动清零
      rd.dhA = (sysA.hmax - sysA.hmin) / sysA.E; rd.dhB = (sysB.hmax - sysB.hmin) / sysB.E;
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
      if (stepCounter % 6000 < STEPS) { sysA.hmax = Hfun(sysA.st); sysA.hmin = sysA.hmax; sysB.hmax = Hfun(sysB.st); sysB.hmin = sysB.hmax; }
    },
    dispose() {
      geos.forEach((x) => x.dispose()); mats.forEach((x) => x.dispose()); texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
