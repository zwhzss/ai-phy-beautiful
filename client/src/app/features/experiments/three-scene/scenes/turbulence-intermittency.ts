import type { SceneContext, SceneInstance } from '../types';
/**
 * 湍流级联与间歇性（P417）：Kolmogorov 1941 能量级串 + She–Lévé 涡丝修正。
 * 真实介质：水运动粘度 ν=1.5×10⁻⁵ m²/s，外尺度 L=1 m，扫描 Re=uL/ν ∈ [10²,10⁶]（u：1.5 mm/s→15 m/s）。
 *   ε=u³/L，η=(ν³/ε)^{1/4}=L·Re^{−3/4}，τ_η=(ν/ε)^{1/2}，u_η=(νη)^{1/4}=(εη)^{1/3}，级联层数 d=log₂(L/η)=0.75·log₂Re。
 *   K41：阶均速度 δu_ℓ=(εℓ)^{1/3}（ζₙ=n/3，标度不变）；间歇性：耗散区体积占比 (η/L)²=Re^{−3/2}
 *   （Re=6.67×10⁴ ⇒ 5.8×10⁻⁸：耗散不是均匀“汤”，而是细丝）。
 *   She–Lévé（余维 2 涡丝）ζₙ=n/9+(2/3)(1−(2/3)^{n/3})；对数正态 ζₙ=n/3−μn(n−1)/2，μ=0.02。
 * 画面：中央二叉级联树（ℓ 逐代减半、涡转向角速率 ω_ℓ=(ε/ℓ²)^{1/3} 按对数压缩时间显示），
 *   能量通量 ε 沿树下行脉冲；左下地面 ln–ln 图：δu_ℓ 的 K41（蓝）与 SL（紫）直线（斜率 1/3 vs ζ₁=0.20），
 *   随 Re 扫描右端延伸到当前 η；ζ₂=2/9+(2/3)(1−(2/3)^{2/3})=0.380、ζ₃=5/9=0.556（SL）与 K41 n/3 族并列；
 *   Taylor 微标度 λ_T=√(15νu²/ε) 与 Re_λ=uλ_T/ν（<40 ⇒ 级联未成熟）标于谱上。
 *   350 个示踪微团按尺度着色绕转，触达 η 时闪红（耗散事件）。
 * 数值核对（_scratch/agentC/turb.mjs）：Re=6.67e4：η=0.241mm，u_η=0.062m/s，τ_η=3.87ms，d=12.02，
 *   ζ₃：K41=1.000 / SL=0.556 / lnN=0.940；SL/K41 在耗散尺度 ≈0.48–0.57。
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
  { const p = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) { p[i * 3] = (Math.random() - 0.5) * 400; p[i * 3 + 1] = (Math.random() - 0.5) * 400; p[i * 3 + 2] = (Math.random() - 0.5) * 400; }
    starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3)); }
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // —— 物理常数与标度 ——
  const NU = 1.5e-5, LEN = 1.0;                    // ν, L
  const Z1_SL = 1 / 9 + (2 / 3) * (1 - Math.pow(2 / 3, 1 / 3));   // SL 一阶指数 ≈0.195
  const WT = 3.1;                                   // 世界单位/米（树尺度）
  const ROOTY = 4.15, MAXG = 12;

  // —— 树数据：节点=父边；符号与相位固定 ——
  const NODES = (1 << (MAXG + 1)) - 1;              // 8191
  const parent = new Int32Array(NODES);
  const sgn = new Float32Array(NODES);
  const ph = new Float32Array(NODES);
  const genOf = new Uint8Array(NODES);
  const genStart = new Int32Array(MAXG + 2);        // 每代首节点索引
  { let s = 31337; const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let idx = 1;
    for (let g = 1; g <= MAXG; g++) { genStart[g] = idx;
      for (let c = 0; c < (1 << g); c++, idx++) {
        parent[idx] = Math.floor((idx - 1) / 2);
        sgn[idx] = rnd() < 0.5 ? -1 : 1;
        ph[idx] = rnd() * TWO_PI; genOf[idx] = g;
      } }
    genStart[MAXG + 1] = idx; }
  const edgeGeo = geo(new THREE.BufferGeometry());
  const edgePos = new Float32Array((NODES - 1) * 6);
  const edgeCol = new Float32Array((NODES - 1) * 6);
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePos, 3));
  edgeGeo.setAttribute('color', new THREE.BufferAttribute(edgeCol, 3));
  edgeGeo.setDrawRange(0, 0);
  const tree = new THREE.LineSegments(edgeGeo, mat(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 })));
  group.add(tree);
  // 各代基础色（紫→青→琥珀→玫红）
  const GC: [number, number, number][] = [];
  { const c = new THREE.Color();
    for (let g = 0; g <= MAXG; g++) { const s0 = g / MAXG;
      c.setHSL(0.75 - 0.72 * s0, 0.8, 0.55); GC.push([c.r, c.g, c.b]); } }
  // 节点屏幕坐标缓存
  const nx = new Float32Array(NODES), ny = new Float32Array(NODES);
  const dispLen = new Float32Array(MAXG + 1);
  for (let g = 1; g <= MAXG; g++) dispLen[g] = WT * Math.pow(2, -g) * 0.62;

  // —— 示踪微团 ——
  const NTR = 350;
  const trGeo = geo(new THREE.BufferGeometry());
  const trPos = new Float32Array(NTR * 3), trCol = new Float32Array(NTR * 3);
  trGeo.setAttribute('position', new THREE.BufferAttribute(trPos, 3));
  trGeo.setAttribute('color', new THREE.BufferAttribute(trCol, 3));
  group.add(new THREE.Points(trGeo, mat(new THREE.PointsMaterial({ vertexColors: true, size: 0.06, transparent: true, opacity: 0.85 }))));
  const tro = new Float32Array(NTR), trth = new Float32Array(NTR), trph = new Float32Array(NTR), trz = new Float32Array(NTR);
  { let s = 81912; const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < NTR; i++) { tro[i] = 0.06 + 0.94 * rnd(); trth[i] = rnd() * TWO_PI; trph[i] = rnd() * TWO_PI; trz[i] = (rnd() - 0.5) * 1.4; } }

  // —— 地面 ln–ln 谱图：S_n(ℓ)∝ℓ^{ζₙ} 族（n=1,2,3）：K41 ζ=n/3（蓝系）vs SL（紫系）斜率下弯 ——
  const SX0 = -4.15, SX1 = -0.95, SZ0 = -2.45, SZ1 = -1.25, SH = 0.66;
  const ZKS = [1 / 3, 2 / 3, 1.0];
  const ZSS = [Z1_SL, 2 / 9 + (2 / 3) * (1 - Math.pow(2 / 3, 2 / 3)), 1 / 3 + 2 / 9];
  const ZEX = [ZKS[0], ZKS[1], ZKS[2], ZSS[0], ZSS[1], ZSS[2]];
  const ZEX_MAX = Math.max(...ZEX);                                 // 归一斜率：六条线在同框内全部保持非常数
  const specGeos: import('three').BufferGeometry[] = [], specPos: Float32Array[] = [];
  { const specCols = [0x3b82f6, 0x60a5fa, 0x93c5fd, 0xa855f7, 0xc084fc, 0xd8b4fe];
    for (let n = 0; n < 6; n++) {
      const g = geo(new THREE.BufferGeometry()); const p = new Float32Array(33 * 3);
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      group.add(new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color: specCols[n] }))));
      specGeos.push(g); specPos.push(p);
    } }
  const etaDotGeo = geo(new THREE.SphereGeometry(0.07, 10, 8));
  const etaDot = new THREE.Mesh(etaDotGeo, mat(new THREE.MeshBasicMaterial({ color: 0xf43f5e })));
  group.add(etaDot);
  const tDotGeo = geo(new THREE.SphereGeometry(0.06, 10, 8));
  const tDot = new THREE.Mesh(tDotGeo, mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  group.add(tDot);
  { const g = geo(new THREE.BufferGeometry()); const p: number[] = [];
    p.push(SX0, 0.03, SZ0, SX1, 0.03, SZ0, SX0, 0.03, SZ0, SX0, 0.03, SZ1 + 0.55);
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
  makeLabel('能量级串：大涡生小涡，ℓ 逐代减半，ε 恒流通贯惯性区', '#c4b5fd', 4.6, 1.6, 4.45, 0);
  makeLabel('ln S_n 斜率族（纵=ζₙ/ζ₃ᵐᵃˣ·x）：蓝=K41 n/3，紫=SL 下弯；琥珀点=λ_T', '#94a3b8', 4.2, -2.55, 0.5, -1.9);
  makeLabel('末端闪红 = 进入耗散尺度 η（体积占比 Re^{−3/2}）', '#f472b6', 3.9, 1.9, 0.62, 1.4);

  const infoCv = document.createElement('canvas'); infoCv.width = 664; infoCv.height = 262;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const info = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  info.scale.set(6.64, 2.62, 1); info.position.set(-0.4, 3.05, 1.2); info.renderOrder = 999;
  group.add(info);

  const rd = { Re: 100, u: 0.0015, eps: 0, eta: 0.99, tauEta: 0, uEta: 0, d: 0, G: 1, frac: 0, lamT: 0.1, ReL: 0 };
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 664, 262);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(3, 3, 658, 256);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(3, 3, 658, 256);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 23px "PingFang SC", sans-serif';
    infoCtx.fillText('湍流间歇性：能流 ε 级联，末端进入粘性耗散', 12, 27);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '18px "PingFang SC", sans-serif';
    infoCtx.fillText('η=(ν³/ε)^(1/4)=L·Re^(−3/4)，δu=(εℓ)^(1/3) [K41]，ζₙ=n/3；SL 涡丝 ζₙ=n/9+(2/3)(1−(2/3)^(n/3))', 12, 52);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('对数正态 ζₙ=n/3−μn(n−1)/2 (μ=0.02)；耗散区体积占比 (η/L)²=Re^{−3/2} ⇒ 间歇 = 细丝化', 12, 76);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 19px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：Re=${rd.Re.toExponential(2)}  u=${rd.u.toFixed(rd.u < 0.01 ? 4 : 2)}m/s  ε=${rd.eps.toExponential(2)}m²/s³`, 12, 104);
    infoCtx.fillText(`η=${(rd.eta * 1e3).toFixed(rd.eta > 0.002 ? 2 : 4)}mm  u_η=${rd.uEta.toFixed(3)}m/s  τ_η=${(rd.tauEta * 1e3).toFixed(2)}ms  层数 d=${rd.d.toFixed(1)}`, 12, 128);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '17px "PingFang SC", sans-serif';
    infoCtx.fillText(`(η/L)²=${rd.frac.toExponential(1)}⇒耗散细丝化；Re_λ=${rd.ReL.toFixed(0)}（λ_T=${(rd.lamT * 1e2).toFixed(1)}cm，${rd.ReL < 40 ? 'Re_λ<40：级联未成熟' : '充分湍流'})`, 12, 152);
    infoCtx.fillStyle = '#22c55e'; infoCtx.font = '16px "PingFang SC", sans-serif';
    infoCtx.fillText('核对(Re=6.67e4)：η=0.241mm u_η=0.062 τ_η=3.87ms d=12.02 (5.8e−8)', 12, 180);
    infoCtx.fillText('ζ₃：K41=1.000，SL=0.556，lnN=0.940 ⇒ 二阶结构函数比 SL/K41≈0.48–0.57', 12, 204);
    infoCtx.fillText(`树显示代际 G=${rd.G}（ω_ℓ=(ε/ℓ²)^(1/3)，演示时间按 2^{0.35g} 压缩）`, 12, 228);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  const CYCLE = 18;
  return {
    update(t, dt) {
      const u0 = (t % CYCLE) / CYCLE;
      const tri = u0 < 0.5 ? u0 * 2 : 2 - u0 * 2;                 // 0→1→0 三角波
      const Re = 1e2 * Math.pow(1e4, tri);
      const u = Re * NU / LEN, eps = u * u * u / LEN;
      const eta = Math.pow(NU * NU * NU / eps, 0.25);
      const tauEta = Math.sqrt(NU / eps), uEta = Math.pow(eps * eta, 1 / 3);
      const d = Math.log2(LEN / eta);
      const G = Math.max(1, Math.min(MAXG, Math.floor(d)));
      rd.Re = Re; rd.u = u; rd.eps = eps; rd.eta = eta; rd.tauEta = tauEta; rd.uEta = uEta; rd.d = d; rd.G = G; rd.frac = (eta / LEN) * (eta / LEN);
      // —— 树：逐代 ω_g=(ε/ℓ_g²)^{1/3}，显示频率压缩 2^{0.35g} ——
      nx[0] = 0; ny[0] = ROOTY;
      for (let g = 1; g <= MAXG; g++) {
        // 真实 ω_g=(ε/ℓ_g²)^{1/3}∝2^{2g/3}；显示按外尺度周期对数压缩 2^{0.35g}
        const wVis = 0.25 * Math.pow(2, 0.35 * g);
        const ag = 0.24 + 0.5 * g / MAXG;
        for (let i = genStart[g]; i < genStart[g + 1]; i++) {
          const a = sgn[i] * ag * (0.6 + 0.4 * Math.sin(wVis * t + ph[i]));
          const p = parent[i];
          nx[i] = nx[p] + Math.sin(a) * dispLen[g];
          ny[i] = ny[p] - Math.cos(a) * dispLen[g];
        }
      }
      // 边位置 + 通量脉冲颜色（沿代际下行的波包）
      const prog = ((t * 8) % (G + 3)) - 1.5;
      let vi = 0;
      const upto = genStart[G + 1];
      for (let i = 1; i < upto; i++) {
        const p = parent[i], g = genOf[i];
        edgePos[vi] = nx[p]; edgePos[vi + 1] = ny[p]; edgePos[vi + 2] = 0;
        edgePos[vi + 3] = nx[i]; edgePos[vi + 4] = ny[i]; edgePos[vi + 5] = 0;
        const base = GC[g], pulse = Math.exp(-(prog - g) * (prog - g) * 0.5);
        const m0 = 0.35 + 0.65 * pulse, m1 = 0.35 + 0.65 * Math.exp(-(prog - g + 1) * (prog - g + 1) * 0.5);
        edgeCol[vi] = base[0] * m0; edgeCol[vi + 1] = base[1] * m0; edgeCol[vi + 2] = base[2] * m0;
        edgeCol[vi + 3] = base[0] * m1; edgeCol[vi + 4] = base[1] * m1; edgeCol[vi + 5] = base[2] * m1;
        vi += 6;
      }
      edgeGeo.attributes['position'].needsUpdate = true;
      edgeGeo.attributes['color'].needsUpdate = true;
      edgeGeo.setDrawRange(0, vi / 3);
      // —— 示踪微团：尺度 ℓ_i=L·2^{−o_i·d}，角速率 ω=(ε/ℓ²)^{1/3} 压缩 ——
      for (let i = 0; i < NTR; i++) {
        const o = tro[i] * d, ell = LEN * Math.pow(2, -o);
        const wShow = 0.25 * Math.pow(2, 0.35 * o);
        const th = trth[i] + wShow * t;
        const rr = 0.45 + WT * ell * 0.275;
        trPos[i * 3] = 2.0 + Math.cos(th) * rr * 0.5;
        trPos[i * 3 + 1] = ROOTY - 0.3 - o * (ROOTY - 0.75) / Math.max(d, 1) * 0.92;
        trPos[i * 3 + 2] = trz[i] + Math.sin(th) * rr * 0.35;
        const near = o > d - 0.7;
        const cS = GC[Math.min(MAXG, Math.floor(o / d * MAXG))];
        const fl = near ? 0.6 + 0.4 * Math.abs(Math.sin(t * 9 + trph[i])) : 1;
        trCol[i * 3] = near ? 0.96 * fl : cS[0] * 0.7;
        trCol[i * 3 + 1] = near ? 0.25 * fl : cS[1] * 0.7;
        trCol[i * 3 + 2] = near ? 0.37 * fl : cS[2] * 0.8;
      }
      trGeo.attributes['position'].needsUpdate = true;
      trGeo.attributes['color'].needsUpdate = true;
      // —— 地面谱图：x=ln(L/ℓ)/ln(L/η)∈[0,1]，六条 S_n 线（K41/SL 各 n=1,2,3）竖直堆叠 ——
      for (let n = 0; n < 6; n++) {
        const ex = ZEX[n], zz = SZ0 + 0.06 + n * 0.062, p = specPos[n];
        for (let k = 0; k < 33; k++) {
          const s0 = k / 32;
          const yv = (ex / ZEX_MAX) * s0 * SH;                      // ln S_n 斜率族：斜率∝ζₙ（K41 下 lnuE=(1/3)ln(L/η)）
          p[k * 3] = SX0 + s0 * (SX1 - SX0); p[k * 3 + 1] = 0.04 + yv; p[k * 3 + 2] = zz;
        }
        specGeos[n].attributes['position'].needsUpdate = true;
      }
      etaDot.position.set(SX1, 0.04 + 0.04, SZ0 + 0.19);
      // Taylor 微标度 λ_T=√(15νu²/ε)（琥珀点落在 K41-ζ₁ 线上）与 Re_λ=uλ_T/ν
      const lamT = Math.sqrt(15 * NU * u * u / eps), ReL = u * lamT / NU;
      rd.lamT = lamT; rd.ReL = ReL;
      const lnT = Math.log(LEN / lamT), sT = lnT / Math.log(LEN / eta);
      tDot.position.set(SX0 + sT * (SX1 - SX0), 0.04 + (ZKS[0] / ZEX_MAX) * sT * SH, SZ0 + 0.06);
      tDot.visible = sT >= 0 && sT <= 1;
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
    },
    dispose() {
      geos.forEach((x) => x.dispose()); mats.forEach((x) => x.dispose()); texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
