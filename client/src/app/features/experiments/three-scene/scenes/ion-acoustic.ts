import type { SceneContext, SceneInstance } from '../types';
/**
 * 离子声波与 Landau 阻尼（P248）：等离子体里的"声波"——离子惯性 + 电子热压静电恢复。
 * 色散（一阶流体严格）：ω_r = k·C_s/√(1+k²λ_D²)，C_s=√(k_B T_e/m_i)，λ_D=√(ε₀T_e/n e²)。
 *   H⁺、T_e=3eV ⇒ C_s=16.95km/s；n=10¹⁵m⁻³ ⇒ λ_D=407µm。kλ_D=0.1 ⇒ ω=4.14 Mrad/s（周期 1.52µs）。
 * 碰撞无阻尼（Landau 1946 解析，kλ_D≪1、T_e≫T_i）：γ/ω=−√(π/8)·√(m_e/m_i)·(1+T_i/T_e)^{−3/2}。
 *   H⁺、m_e/m_i=1/1836：T_e/T_i=4→−1.05e-2；=10→−1.27e-2；=60→−1.43e-2。
 *   数值核对（_scratch/agentC/ionac.mjs，O'Neil 三极点积分）：kλ_D=0.1、T_e/T_i=10 时解色散方程
 *   得 γ/ω=−1.185e-2（残差|ε|=2e-11），与教科书公式差 6.6%——即有限 kλ_D 修正量级。
 * 传播包的"空间阻尼"：A(x)=A₀e^{−γx/v_g}，v_g=dω/dk=C_s/(1+k²λ_D²)^{3/2}；
 *   γ/ω=1.27e-2、kλ_D=0.15 ⇒ 衰减 1/e 需 ~12.3 个波长（画面链长 8.6WU = 14 个显示波长，可见包络收紧）。
 * 波动参考系相空间（地板图）：势阱捕获粒子桶， separatrix u=±2√M·cos(ψ/2)（u=(v−vφ)/C_s，
 *   M=eφ₀/k_BT_e 马赫数）：桶半高 Δv/2=C_s√M ⇒ Δv=2C_s√M=7.58km/s=0.45C_s（M=0.05）；
 *   小振幅弹跳频率 ω_b=k·C_s√M=1.40 Mrad/s（M=0.05，kλ_D=0.15：波频 6.18 Mrad/s 的 23%）。
 * 演示映射：链长 8.6WU=0.244m（比例 35.2WU/m，kλ_D 仅控制显示波长 λd=0.09/(kλ_D)WU）；
 *   相位速度显示 vφ₀=0.55WU/s（真实 vφ=C_s/√(1+k²λ_D²)，色散 flattening 可见）。
 * 扫描（18s）：A 段 T_e/T_i:4→60（γ/ω 收紧、包络变陡，λ_D 只随 T_e 不变）；
 *   B 段 kλ_D:0.05→0.4（波长缩短、相速降 7%、空间阻尼 12.5λ→10.8λ）；C 段 M:0.005→0.06（桶胀大、弹跳变慢）。
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

  // —— SI：H⁺ 等离子体，T_e=3eV，n=1e15 m⁻³ ——
  const E_CH = 1.602176634e-19, EPS0 = 8.8541878128e-12, ME = 9.1093837015e-31, MI = 1.67262192369e-27;
  const TE_J = 3 * E_CH;
  const CS = Math.sqrt(TE_J / MI);                                   // 16965 m/s
  const NDEN = 1e15;
  const LAMD = Math.sqrt(EPS0 * TE_J / (NDEN * E_CH * E_CH));        // 4.07e-4 m
  const SQ_ME_MI = Math.sqrt(ME / MI);
  const gamOfW = (tiTe: number) => -Math.sqrt(PI / 8) * SQ_ME_MI * Math.pow(1 + tiTe, -1.5);
  // 显示映射：链 8.6WU ↔ 0.244m ⇒ 35.2 WU/m（与 kλ_D 无关：λd∝1/kλ_D 同步真实 λ）
  const XL0 = -4.3, XL1 = 4.3, XLEN = XL1 - XL0;
  const MX = 0.09 / (TWO_PI * LAMD);                                 // WU per meter
  const VPHI0 = 0.55;                                                 // 显示相速基值 WU/s（∝真实 vφ）

  // —— 离子链（纵向位移 ξ=−Ξcosψ ⇒ 压缩峰与 φ 同相，行波自洽）——
  const NI = 900;
  const ionGeo = geo(new THREE.BufferGeometry());
  const ionPos = new Float32Array(NI * 3);
  const xg = new Float64Array(NI), yj = new Float32Array(NI), zj = new Float32Array(NI);
  { let s = 77113; const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < NI; i++) { xg[i] = XL0 + XLEN * i / (NI - 1); yj[i] = ((i % 3) - 1) * 0.15 + (rnd() - 0.5) * 0.06; zj[i] = (rnd() - 0.5) * 0.5; } }
  ionGeo.setAttribute('position', new THREE.BufferAttribute(ionPos, 3));
  group.add(new THREE.Points(ionGeo, mat(new THREE.PointsMaterial({ color: 0x8b5cf6, size: 0.058 }))));
  // 电子背景： Boltzmann 跟随 δn_e∝eφ/T_e——位移略小于离子 ⇒ 层间电荷分离提供 E 场
  const elGeo = geo(new THREE.BufferGeometry());
  const elPos = new Float32Array(NI * 3);
  const ezo = new Float32Array(NI);
  { let s = 20261; const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < NI; i++) ezo[i] = (rnd() - 0.5) * 0.62; }
  elGeo.setAttribute('position', new THREE.BufferAttribute(elPos, 3));
  group.add(new THREE.Points(elGeo, mat(new THREE.PointsMaterial({ color: 0x22d3ee, size: 0.032, transparent: true, opacity: 0.55 }))));

  // —— φ(x,t) 曲线 + 空间阻尼包络（虚线，需 computeLineDistances）——
  const NP = 161;
  const potGeo = geo(new THREE.BufferGeometry()); const potPos = new Float32Array(NP * 3);
  potGeo.setAttribute('position', new THREE.BufferAttribute(potPos, 3));
  group.add(new THREE.Line(potGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 }))));
  const envMat = mat(new THREE.LineDashedMaterial({ color: 0x64748b, dashSize: 0.14, gapSize: 0.1 }));
  const envGeos: import('three').BufferGeometry[] = [], envPos: Float32Array[] = [], envLines: import('three').Object3D[] = [];
  for (let b = 0; b < 2; b++) {
    const g = geo(new THREE.BufferGeometry()); const p = new Float32Array(82 * 3);
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const ln = new THREE.Line(g, envMat); group.add(ln);
    envGeos.push(g); envPos.push(p); envLines.push(ln);
  }
  // —— 纵向电场箭头（E=−∂φ/∂x∝cosψ·包络；颜色随符号）——
  const NAV = 15;
  const arrGeo = geo(new THREE.BufferGeometry());
  const arrPos = new Float32Array(NAV * 6), arrCol = new Float32Array(NAV * 6);
  arrGeo.setAttribute('position', new THREE.BufferAttribute(arrPos, 3));
  arrGeo.setAttribute('color', new THREE.BufferAttribute(arrCol, 3));
  group.add(new THREE.LineSegments(arrGeo, mat(new THREE.LineBasicMaterial({ vertexColors: true }))));

  // —— 地板相空间图：波动系 (ψ, u=(v−vφ)/C_s)，捕获桶 + separatrix + 弹跳点 ——
  const FPY = 0.045, SX = 3.3 / PI, SZ = 2.0, UMAX = 0.55;
  const boxGeo = geo(new THREE.BufferGeometry());
  {
    const p: number[] = [];
    const P = (q: number, u: number) => p.push(q * SX, FPY, (u / UMAX) * SZ);
    P(-PI, 0); P(PI, 0);                                   // u=0 轴
    P(-PI, -UMAX); P(-PI, UMAX); P(PI, -UMAX); P(PI, UMAX);  // 边界
    for (let g = 1; g <= 3; g++) { P(-PI, g * 0.15); P(PI, g * 0.15); P(-PI, -g * 0.15); P(PI, -g * 0.15); }
    for (const q of [-PI / 2, 0, PI / 2]) { P(q, -UMAX); P(q, UMAX); }
    boxGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3)); }
  group.add(new THREE.LineSegments(boxGeo, mat(new THREE.LineBasicMaterial({ color: 0x334155 }))));
  const sepGeo = geo(new THREE.BufferGeometry()); const sepPos = new Float32Array(2 * 81 * 3);
  sepGeo.setAttribute('position', new THREE.BufferAttribute(sepPos, 3));
  group.add(new THREE.Line(sepGeo, mat(new THREE.LineBasicMaterial({ color: 0xf43f5e }))));
  const orbMat = mat(new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8 }));
  const ORB_S = [0.4, 0.7, 0.92];
  const orbGeos: import('three').BufferGeometry[] = [], orbPos: Float32Array[] = [];
  for (let o = 0; o < 3; o++) {
    const g = geo(new THREE.BufferGeometry()); const p = new Float32Array(61 * 3);
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    group.add(new THREE.Line(g, orbMat));
    orbGeos.push(g); orbPos.push(p);
  }
  const passMat = mat(new THREE.LineBasicMaterial({ color: 0x94a3b8 }));
  const passGeos: import('three').BufferGeometry[] = [], passPos: Float32Array[] = [];
  for (let b = 0; b < 2; b++) {
    const g = geo(new THREE.BufferGeometry()); const p = new Float32Array(41 * 3);
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    group.add(new THREE.Line(g, passMat));
    passGeos.push(g); passPos.push(p);
  }
  const NDOT = 8;
  const dotGeo = geo(new THREE.BufferGeometry()); const dotPos = new Float32Array(NDOT * 3);
  dotGeo.setAttribute('position', new THREE.BufferAttribute(dotPos, 3));
  group.add(new THREE.Points(dotGeo, mat(new THREE.PointsMaterial({ color: 0xfbbf24, size: 0.09 }))));

  function makeLabel(text: string, color: string, scale: number, x: number, y: number, z: number): void {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(scale, scale / 8, 1); s.position.set(x, y, z); s.renderOrder = 998; group.add(s);
  }
  makeLabel('离子声波：离子惯性 + 电子热压静电恢复 —— 等离子体的"声音"', '#c4b5fd', 4.6, 0, 4.6, 0.3);
  makeLabel('空间阻尼包络 A(x)=A₀e^(−γx/v_g)：γ/ω 定每波长衰减', '#94a3b8', 3.6, 0, 1.05, 0);
  makeLabel('波动系相空间：捕获桶 u=±2√M·cos(ψ/2)，弹跳 ω_b=kC_s√M', '#f472b6', 3.9, 0, -0.55, -2.3);

  const infoCv = document.createElement('canvas'); infoCv.width = 664; infoCv.height = 264;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const info = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  info.scale.set(6.64, 2.64, 1); info.position.set(-0.3, 5.9, 0.4); info.renderOrder = 999;
  group.add(info);

  const rd = { tiTe: 10, kl: 0.15, M: 0.02, wReal: 0, gw: 0, vg: 0, lamDw: 0.6, wDisp: 0, wbReal: 0, LdLam: 0, dvKm: 0 };
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 664, 264);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(3, 3, 658, 258);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(3, 3, 658, 258);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 23px "PingFang SC", sans-serif';
    infoCtx.fillText('离子声波：ω_r=kC_s/√(1+k²λ_D²)，相速≈C_s', 12, 27);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '18px "PingFang SC", sans-serif';
    infoCtx.fillText(`C_s=√(k_BT_e/m_i)=${(CS / 1e3).toFixed(2)}km/s（H⁺,T_e=3eV） λ_D=${(LAMD * 1e6).toFixed(0)}µm（n=1e15）`, 12, 52);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('Landau 阻尼 γ/ω=−√(π/8)√(m_e/m_i)(1+T_i/T_e)^(−3/2)：共振交换能量，非碰撞！', 12, 76);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 19px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：T_e/T_i=${rd.tiTe.toFixed(1)}  kλ_D=${rd.kl.toFixed(3)}  M=${rd.M.toFixed(3)}`, 12, 104);
    infoCtx.fillText(`  ω_r=${(rd.wReal / 1e6).toFixed(2)}Mrad/s  T=${(TWO_PI / rd.wReal * 1e6).toFixed(2)}µs  γ/ω=${rd.gw.toExponential(2)}`, 12, 128);
    infoCtx.fillText(`  空间阻尼：衰减1/e ≈ ${rd.LdLam.toFixed(1)} 个波长（v_g=${(rd.vg / 1e3).toFixed(2)}km/s）`, 12, 152);
    infoCtx.fillStyle = '#f472b6';
    infoCtx.fillText(`  桶：Δv=2C_s√M=${rd.dvKm.toFixed(2)}km/s=${(rd.dvKm / (CS / 1e3)).toFixed(2)}C_s  ω_b=${(rd.wbReal / 1e6).toFixed(2)}Mrad/s`, 12, 176);
    infoCtx.fillStyle = '#22c55e'; infoCtx.font = '16px "PingFang SC", sans-serif';
    infoCtx.fillText('数值核对：kλ_D=0.1,T_e/T_i=10 三极点积分 γ/ω=−1.185e-2（|ε|=2e-11）', 12, 200);
    infoCtx.fillText(`  vs 教科书 −1.268e-2（差 6.6%=有限kλ_D修正）。ω_b/ω=√M·√(1+k²λ_D²)`, 12, 222);
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.fillText(`映射：链8.6WU=0.244m(35.2WU/m) 显示相速${VPHI0}WU/s∝真实vφ=${(CS * Math.sqrt(1 / (1 + rd.kl * rd.kl)) / 1e3).toFixed(2)}km/s`, 12, 246);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  const CYCLE = 18, A0 = 0.34, PHI_Y = 3.6, ARR_Y = 1.15;
  let wAcc = 0, prevU = 1, thetaAcc = 0;
  return {
    update(t, dt) {
      const dts = Math.min(dt, 0.05);
      const u = (t % CYCLE) / CYCLE;
      if (u < prevU) { thetaAcc = 0; }   // 新循环：桶内相位复位
      prevU = u;
      let tiTe = 10, kl = 0.15, Mc = 0.02;
      if (u < 0.4) { tiTe = 4 + 56 * (u / 0.4); }
      else if (u < 0.7) { kl = 0.05 + 0.35 * ((u - 0.4) / 0.3); }
      else { Mc = 0.005 + 0.055 * ((u - 0.7) / 0.3); }
      // —— 真实量（面板与几何共用同一变量）——
      const kReal = kl / LAMD;
      const dis = Math.sqrt(1 + kl * kl);
      const wReal = kReal * CS / dis;
      const gw = gamOfW(1 / tiTe);
      const gamAbs = Math.abs(gw) * wReal;
      const vg = CS / Math.pow(dis, 3);
      const decayWU = gamAbs / vg / MX;                      // 每显示 WU 衰减率
      const LdLam = vg / gamAbs / (TWO_PI / kReal);        // 衰减长度（波长数）
      // —— 显示映射：λd 与真实 λ 同比，相速 ∝ 真实 vφ（色散变平可见）——
      const lamDw = 0.09 / kl;
      const kDisp = TWO_PI / lamDw;
      const vphiD = VPHI0 / dis;
      const wDisp = kDisp * vphiD;
      wAcc += wDisp * dts;
      rd.tiTe = tiTe; rd.kl = kl; rd.M = Mc; rd.wReal = wReal; rd.gw = gw; rd.vg = vg;
      rd.lamDw = lamDw; rd.wDisp = wDisp; rd.LdLam = LdLam;
      rd.wbReal = kReal * CS * Math.sqrt(Mc);
      rd.dvKm = 2 * CS * Math.sqrt(Mc) / 1e3;
      // 离子 + 电子：ξ=−Ξcosψ ⇒ δn∝sinψ∝φ（行波压缩与势同相，准中性）
      for (let i = 0; i < NI; i++) {
        const psi = kDisp * xg[i] - wAcc;
        const env = Math.exp(-decayWU * (xg[i] - XL0));
        const xi = -A0 * env * Math.cos(psi);
        ionPos[i * 3] = xg[i] + xi; ionPos[i * 3 + 1] = 2.45 + yj[i]; ionPos[i * 3 + 2] = zj[i];
        elPos[i * 3] = xg[i] + 0.78 * xi; elPos[i * 3 + 1] = 2.45 + yj[i]; elPos[i * 3 + 2] = ezo[i];
      }
      ionGeo.attributes['position'].needsUpdate = true;
      elGeo.attributes['position'].needsUpdate = true;
      // φ 曲线（幅值 ∝ 包络；显示幅度固定，密度调制才是真信号）
      for (let i = 0; i < NP; i++) {
        const x = XL0 + XLEN * i / (NP - 1);
        const psi = kDisp * x - wAcc;
        const env = Math.exp(-decayWU * (x - XL0));
        potPos[i * 3] = x; potPos[i * 3 + 1] = PHI_Y - 0.62 * env * Math.sin(psi); potPos[i * 3 + 2] = 0;
      }
      potGeo.attributes['position'].needsUpdate = true;
      // 包络虚线：±0.62·e^(−decay·x)（上下两条独立折线）
      for (let i = 0; i < 82; i++) {
        const x = XL0 + XLEN * i / 81;
        const e6 = 0.62 * Math.exp(-decayWU * (x - XL0));
        envPos[0][i * 3] = x; envPos[0][i * 3 + 1] = PHI_Y + e6; envPos[0][i * 3 + 2] = 0;
        envPos[1][i * 3] = x; envPos[1][i * 3 + 1] = PHI_Y - e6; envPos[1][i * 3 + 2] = 0;
      }
      for (let b = 0; b < 2; b++) {
        envGeos[b].attributes['position'].needsUpdate = true;
        (envLines[b] as import('three').Line).computeLineDistances();
      }
      // E 箭头：E=−∂φ/∂x∝cosψ·env（有符号长度 + 颜色随方向）
      for (let a = 0; a < NAV; a++) {
        const x = XL0 + 0.3 + (XLEN - 0.6) * a / (NAV - 1);
        const psi = kDisp * x - wAcc;
        const Le = 0.36 * Math.cos(psi) * Math.exp(-decayWU * (x - XL0));
        arrPos[a * 6] = x - Le / 2; arrPos[a * 6 + 1] = ARR_Y; arrPos[a * 6 + 2] = 0;
        arrPos[a * 6 + 3] = x + Le / 2; arrPos[a * 6 + 4] = ARR_Y; arrPos[a * 6 + 5] = 0;
        const up = Le >= 0;
        for (let v = 0; v < 2; v++) {
          arrCol[a * 6 + v * 3] = up ? 0.957 : 0.231; arrCol[a * 6 + v * 3 + 1] = up ? 0.247 : 0.51; arrCol[a * 6 + v * 3 + 2] = up ? 0.369 : 0.965;
        }
      }
      arrGeo.attributes['position'].needsUpdate = true;
      arrGeo.attributes['color'].needsUpdate = true;
      // —— 地板相空间：separatrix u=±2√M cos(ψ/2)（下半支反序→闭合桶）、内轨道、过路轨道、弹跳点 ——
      const H = 2 * Math.sqrt(Mc);
      const cZ = (uu: number) => (uu / UMAX) * SZ;
      for (let i = 0; i < 81; i++) {
        const psi = -PI + TWO_PI * i / 80;
        const uu = H * Math.cos(psi / 2);
        sepPos[i * 3] = psi * SX; sepPos[i * 3 + 1] = FPY; sepPos[i * 3 + 2] = cZ(uu);
        const psi2 = PI - TWO_PI * i / 80;
        sepPos[(81 + i) * 3] = psi2 * SX; sepPos[(81 + i) * 3 + 1] = FPY; sepPos[(81 + i) * 3 + 2] = cZ(-uu);
      }
      sepGeo.attributes['position'].needsUpdate = true;
      for (let o = 0; o < 3; o++) {
        const s = ORB_S[o], p = orbPos[o];
        for (let i = 0; i < 61; i++) {
          const th = TWO_PI * i / 60;
          p[i * 3] = PI * 0.88 * s * Math.cos(th) * SX;
          p[i * 3 + 1] = FPY;
          p[i * 3 + 2] = cZ(H * s * Math.sin(th));
        }
        orbGeos[o].attributes['position'].needsUpdate = true;
      }
      for (let b = 0; b < 2; b++) {
        const sgn = b === 0 ? 1 : -1, p = passPos[b];
        for (let i = 0; i < 41; i++) {
          const psi = -PI + TWO_PI * i / 40;
          const uu = H + 0.1 + 0.06 * Math.cos(psi);       // 越过桶顶的通行轨道（轻微起伏）
          p[i * 3] = psi * SX; p[i * 3 + 1] = FPY; p[i * 3 + 2] = sgn * cZ(uu);
        }
        passGeos[b].attributes['position'].needsUpdate = true;
      }
      // 弹跳：ω_b(显示)=kDisp·vphiD·√M/√(1+…) ⇒ 取 ω_b_disp=ω_disp·√M（真实比 ω_b/ω=√M/√(1+kλ²)）
      thetaAcc += wDisp * Math.sqrt(Mc) * dts;
      for (let d = 0; d < NDOT; d++) {
        const s = ORB_S[d % 3];
        const th = thetaAcc + (d / NDOT) * TWO_PI;
        dotPos[d * 3] = PI * 0.88 * s * Math.cos(th) * SX;
        dotPos[d * 3 + 1] = FPY + 0.05;
        dotPos[d * 3 + 2] = cZ(H * s * Math.sin(th));
      }
      dotGeo.attributes['position'].needsUpdate = true;
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
    },
    dispose() {
      geos.forEach((x) => x.dispose()); mats.forEach((x) => x.dispose()); texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
