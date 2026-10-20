import type { SceneContext, SceneInstance } from '../types';
/**
 * 磁粒子成像 MPI（P361）：直接测纳米磁粉的非线性响应——不看背景的新模态。
 * 均匀交变驱动场 μ0H_drive=12mT·sin(ωt) 叠加线性选择场 B_sel=G·x；只有总场≈0 的
 * 「场自由平面」FFP: x(t)=−μ0H_drive/G 处的粒子才反复穿越 Langevin 曲线的陡段，
 * 发出高次谐波；远处粒子被偏置场钉在饱和段，dM/dt≈0 ⇒ 信号天然定域（无需反转梯度）。
 *   Langevin：M(B)=Ms·L(ξ)，L=cothξ−1/ξ，ξ=m·B/(kBT)，m=Ms·πd³/6。
 *   接收电压 s(t) ∝ dM/dt = χ(B)·dB_drive/dt，χ=Ms·L'(ξ)·dξ/dB，L'=1/ξ²−1/sinh²ξ（L'(0)=1/3）。
 *   单颗粒（FFP 穿过处）只含奇次谐波（L 奇⇒半波对称）：数值谱 A1:A3:A5:A7=74.4:19.9:4.5:0.9%，
 *   即 A3/A1=26.7%=非线性指纹；而把整个视野的颗粒直接相加会几乎对消成纯余弦
 *   （∫χdx ∝ 窗口两端 ΔL，饱和后近似恒定）⇒ MPI 的定位靠 FFP 的时间编码，不靠谐波总量。
 * 扫描（18s 乒乓）：G 从 90→520 mT/m。代价曲线：FOV=2·μ0H0/G 变窄（267→46mm），
 *   瞬时灵敏度峰半高宽 = 2·B_half/G 同步变窄（B_half=8.65mT 即 ξ=2.08 处 χ 降到 χ(0)/2
 *   ⇒ 192→33mm）⇒ 分辨率↑、视野↓；视野内 χ>0.1χ(0) 的活跃层占比 100%→27%。
 *   演示时钟：驱动 15kHz ÷1.5×10⁴ ⇒ 显示周期 1.0s；s 整体∝ω 而谐波相对幅值与 ω 无关
 *   （χ 只依赖 B），故谱形真实。1 WU = 100 mm。
 * 数值核对（_scratch/mpi-check2.mjs）：m=1.029e-18A·m²，ξ/mT=0.2405，kBT/m=4.158mT，
 *   ξ(12mT)=2.89⇒M/Ms=66.0%，χ(0)=3.848e4A/(m·mT)，FWHM 数值=193.6/116.8/69.2/33.6mm。
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

  // ============ 物理常数（SI）============
  const KB = 1.380649e-23, TEMPERATURE = 310;                          // K（体温）
  const MS = 480e3;                                                     // A/m 磁铁矿饱和磁化
  const D_CORE = 16e-9;                                                 // m 单畴核粒径
  const VOL = PI / 6 * Math.pow(D_CORE, 3);                             // m³
  const MOM = MS * VOL;                                                 // A·m² 颗粒磁矩
  const XI_PER_MT = MOM * 1e-3 / (KB * TEMPERATURE);                    // ξ = XI_PER_MT·B[mT]
  const H0 = 12;                                                        // mT 驱动场幅 μ0H_drive
  const F_DRIVE = 15e3, CLOCK = 1.5e4;                                  // Hz；显示压缩 ⇒ 周期 1.0s
  const W_DISP = TWO_PI * F_DRIVE / CLOCK;
  const X_ED = 1.6;                                                     // WU 半视野 ⇒ 160mm
  const mmOf = (wu: number) => wu * 100;                                // WU → mm
  const wuOf = (mm: number) => mm / 100;

  const lOf = (xi: number) => { const a = Math.abs(xi); if (a < 1e-4) return xi / 3; const co = a > 20 ? 1 : 1 / Math.tanh(a); return Math.sign(xi) * (co - 1 / a); };
  const lpOf = (xi: number) => { const a = Math.abs(xi); if (a < 0.02) return 1 / 3 - a * a / 15; const sh = Math.sinh(a); return 1 / (a * a) - 1 / (sh * sh); };
  const chiOf = (bMT: number) => MS * lpOf(XI_PER_MT * bMT) * XI_PER_MT;   // A/(m·mT)
  const CH0 = MS * XI_PER_MT / 3;                                           // χ(0)

  // ============ 粒子云（InstancedMesh，亮度=|dM/dt|）============
  const NP = 900;
  const pGeo = geo(new THREE.SphereGeometry(1, 8, 6));
  const pMat = mat(new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x22d3ee, emissiveIntensity: 1 }));
  const drops = new THREE.InstancedMesh(pGeo, pMat, NP);
  const px: number[] = [], py: number[] = [], pz: number[] = [];
  { let s = 20260; const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < NP; i++) { px.push((rnd() * 2 - 1) * (X_ED - 0.05)); py.push(0.45 + rnd() * 1.9); pz.push((rnd() * 2 - 1) * 0.95); } }
  drops.frustumCulled = false;
  group.add(drops);

  // ============ 场箭头阵：上下两排沿 x 的总场 ============
  const NA = 21;
  const shaftGeo = geo(new THREE.CylinderGeometry(0.018, 0.018, 1, 6));
  const headGeo = geo(new THREE.ConeGeometry(0.06, 0.17, 8));
  const fMatPos = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
  const fMatNeg = mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 }));
  const arrows: { g: import('three').Group; m: import('three').MeshBasicMaterial }[] = [];
  const AY = [2.72, 0.16];
  for (let r = 0; r < 2; r++) for (let i = 0; i < NA; i++) {
    const g = new THREE.Group();
    const sm = r === 0 ? fMatPos : fMatNeg;
    const sh = new THREE.Mesh(shaftGeo, sm); sh.rotation.z = PI / 2;
    const hd = new THREE.Mesh(headGeo, sm); hd.rotation.z = -PI / 2;
    g.add(sh, hd); g.position.set(-X_ED + 2 * X_ED * i / (NA - 1), AY[r], 1.35);
    group.add(g); arrows.push({ g, m: sm });
  }

  // ============ 场自由平面（FFP）============
  const ffGeo = geo(new THREE.PlaneGeometry(2.1, 2.9));
  const ffMat = mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }));
  const ffPlane = new THREE.Mesh(ffGeo, ffMat); ffPlane.rotation.y = PI / 2; ffPlane.position.set(0, 1.6, 0); group.add(ffPlane);
  const ffEdge = new THREE.Line(geo(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -1.45, 0), new THREE.Vector3(0, 1.45, 0)])),
    mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 })));
  ffEdge.rotation.y = PI / 2; ffEdge.position.set(0, 1.6, 0); group.add(ffEdge);

  // ============ 瞬时灵敏度剖面 S(x)=χ(B(x,t))·|dB/dt|（逐帧随 FFP 扫过视野）============
  const NX = 81;
  const psfPos = new Float32Array(NX * 3), psf = new Float64Array(NX);
  const psfGeo = geo(new THREE.BufferGeometry());
  psfGeo.setAttribute('position', new THREE.BufferAttribute(psfPos, 3));
  const PSF_Y0 = -1.15, PSF_H = 1.05;
  group.add(new THREE.Line(psfGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e }))));
  { const g = geo(new THREE.BufferGeometry()); const p: number[] = [];
    p.push(-X_ED, PSF_Y0, 0, X_ED, PSF_Y0, 0, -X_ED, PSF_Y0, 0, -X_ED, PSF_Y0 + PSF_H + 0.1, 0);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3));
    group.add(new THREE.LineSegments(g, mat(new THREE.LineBasicMaterial({ color: 0x334155 })))); }

  // ============ Langevin M(B)  inset + 工作点 ============
  const LB_X0 = 2.35, LB_X1 = 4.45, LB_Y0 = 0.35, LB_H = 1.75, LB_B = 30;    // 横轴 ±30 mT
  const NLB = 121;
  const lyOf = (bMT: number) => LB_Y0 + LB_H * 0.5 + lOf(XI_PER_MT * bMT) / 0.9 * LB_H * 0.46;
  const lbGeo = geo(new THREE.BufferGeometry()); const lbPos = new Float32Array(NLB * 3);
  lbGeo.setAttribute('position', new THREE.BufferAttribute(lbPos, 3));
  group.add(new THREE.Line(lbGeo, mat(new THREE.LineBasicMaterial({ color: 0xa855f7 }))));
  const dotGeo = geo(new THREE.SphereGeometry(0.055, 10, 8));
  const wDots: import('three').Mesh[] = [];
  const wMat = mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
  for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(dotGeo, wMat); group.add(m); wDots.push(m); }
  { const g = geo(new THREE.BufferGeometry()); const p: number[] = [];
    p.push(LB_X0, LB_Y0, 0, LB_X1, LB_Y0, 0, (LB_X0 + LB_X1) / 2, LB_Y0 - 0.08, 0, (LB_X0 + LB_X1) / 2, LB_Y0 + LB_H + 0.12, 0);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3));
    group.add(new THREE.LineSegments(g, mat(new THREE.LineBasicMaterial({ color: 0x334155 })))); }

  // ============ 接收信号 s(φ) 波形 + 谐波谱 ============
  const SW_X0 = -4.5, SW_X1 = -2.1, SW_Y0 = 0.45, SW_H = 1.9;
  const NS = 128;
  const sig = new Float64Array(NS), sumSig = new Float64Array(NS);
  const swGeo = geo(new THREE.BufferGeometry()); const swPos = new Float32Array(NS * 3);
  swGeo.setAttribute('position', new THREE.BufferAttribute(swPos, 3));
  group.add(new THREE.Line(swGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 }))));
  const swDot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.07, 10, 8)), mat(new THREE.MeshBasicMaterial({ color: 0xffffff })));
  group.add(swDot);
  const driveGeo = geo(new THREE.BufferGeometry()); const drivePos = new Float32Array(NS * 3);
  driveGeo.setAttribute('position', new THREE.BufferAttribute(drivePos, 3));
  group.add(new THREE.Line(driveGeo, mat(new THREE.LineBasicMaterial({ color: 0x64748b }))));

  const NH = 6, HARM = [1, 3, 5, 7, 9, 11];
  const barGeo = geo(new THREE.BoxGeometry(1, 1, 1));
  const barMat = mat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0e7490, emissiveIntensity: 0.7, roughness: 0.4 }));
  const bars: import('three').Mesh[] = [];
  const SP_X0 = -4.5, SP_Y0 = -2.35, SP_H = 0.95;
  for (let i = 0; i < NH; i++) {
    const b = new THREE.Mesh(barGeo, barMat);
    b.position.set(SP_X0 + 0.35 + i * 0.42, SP_Y0, 0);
    b.scale.set(0.26, 0.001, 0.12); group.add(b); bars.push(b);
  }
  const specVals = new Float64Array(NH);

  function makeLabel(text: string, color: string, scale: number, x: number, y: number, z: number): void {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 25px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(scale, scale / 8, 1); s.position.set(x, y, z); s.renderOrder = 998; group.add(s);
  }
  makeLabel('驱动场(均匀,交变) ⊕ 选择场(线性梯度) ⇒ 仅 FFP 处总场=0', '#fbbf24', 4.5, 0, 3.35, 0.4);
  makeLabel('瞬时灵敏度 S(x)=χ(B)·|dB/dt|：峰半高宽=2B½/G=分辨率', '#22c55e', 3.4, 0, -2.02, 0.1);
  makeLabel('Langevin M(B)：陡段只在 B≈0', '#a855f7', 2.9, (LB_X0 + LB_X1) / 2, LB_Y0 + LB_H + 0.28, 0.1);
  makeLabel('黄线=FFP 处单颗粒 dM/dt(奇谐波) 灰线=全视野和', '#fbbf24', 3.4, (SW_X0 + SW_X1) / 2, SW_Y0 + SW_H + 0.3, 0.1);
  makeLabel('谐波谱 A(n)/A(1)', '#22d3ee', 2.2, SP_X0 + 1.3, SP_Y0 + SP_H + 0.22, 0.1);

  const infoCv = document.createElement('canvas'); infoCv.width = 664; infoCv.height = 264;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const info = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  info.scale.set(6.64, 2.64, 1); info.position.set(-0.3, 4.55, 0.4); info.renderOrder = 999;
  group.add(info);

  const rd = { G: 90, fov: 0, fwhm: 0, peak: 0, xi: 0, mm: 0, s31: 0, sig: 0, xffp: 0, lit: 0 };

  // —— χ 的半高场宽与 1/10 高场宽（数值求根，一次算好；决定分辨率与活跃层）——
  let B_HALF = 0, B_TEN = 0;
  for (let b = 0; b < 60; b += 0.0005) { if (!B_HALF && chiOf(b) < CH0 / 2) B_HALF = b; if (!B_TEN && chiOf(b) < CH0 / 10) B_TEN = b; }

  // —— 重算当前梯度下的分辨率、单颗粒波形、谐波谱 ——
  function recompute(): void {
    const G = rd.G;
    rd.fwhm = 2 * B_HALF / G * 1000;                       // mm：瞬时灵敏度峰半高宽
    rd.lit = Math.min(1, 2 * B_TEN / G * 1000 / (2 * X_ED * 1000));   // 视野内 χ>0.1χ(0) 占比

    // 探针颗粒（位于 FFP 穿过的中心平面 x=0）：s(φ)=χ(H0 sinφ)·cosφ
    let amp = 0;
    for (let j = 0; j < NS; j++) {
      const ph = TWO_PI * j / NS;
      sig[j] = chiOf(H0 * Math.sin(ph)) * Math.cos(ph);
      if (Math.abs(sig[j]) > amp) amp = Math.abs(sig[j]);
    }
    // 全视野求和（对比：几乎对消成纯余弦）
    let ampS = 0;
    for (let j = 0; j < NS; j++) {
      const ph = TWO_PI * j / NS;
      let integ = 0;
      for (let i = 0; i < NX; i++) integ += chiOf(H0 * Math.sin(ph) + G * mmOf(-X_ED + 2 * X_ED * i / (NX - 1)) / 1000);
      const v = Math.cos(ph) * integ / NX;
      sumSig[j] = v; if (Math.abs(v) > ampS) ampS = Math.abs(v);
    }
    for (let j = 0; j < NS; j++) {
      swPos[j * 3] = SW_X0 + (SW_X1 - SW_X0) * j / (NS - 1);
      swPos[j * 3 + 1] = SW_Y0 + SW_H * 0.5 + sig[j] / amp * SW_H * 0.44;
      swPos[j * 3 + 2] = 0.02;
      drivePos[j * 3] = SW_X0 + (SW_X1 - SW_X0) * j / (NS - 1);
      drivePos[j * 3 + 1] = SW_Y0 + SW_H * 0.5 + sumSig[j] / ampS * SW_H * 0.44;
      drivePos[j * 3 + 2] = 0.01;
    }
    swGeo.attributes['position'].needsUpdate = true;
    driveGeo.attributes['position'].needsUpdate = true;

    // DFT 取奇次谐波幅值（相对波形峰值归一）
    for (let h = 0; h < NH; h++) {
      const n = HARM[h]; let a = 0, bq = 0;
      for (let j = 0; j < NS; j++) { const ang = TWO_PI * n * j / NS; a += sig[j] * Math.cos(ang); bq += sig[j] * Math.sin(ang); }
      specVals[h] = 2 / NS * Math.hypot(a, bq) / amp;
    }
    for (let h = 0; h < NH; h++) { const bh = Math.max(0.002, specVals[h] * SP_H); bars[h].scale.y = bh; bars[h].position.y = SP_Y0 + bh / 2; }
    rd.s31 = specVals[1] / Math.max(1e-9, specVals[0]);
    rd.sig = amp;
    rd.xi = XI_PER_MT * H0;
    rd.mm = lOf(rd.xi);
  }

  // —— 逐帧：瞬时灵敏度剖面 S(x)=χ(B(x,t))·|dB/dt|，峰随 FFP 扫过 ——
  function drawPsf(G: number, sp: number, cp: number): void {
    let mx = 0;
    for (let i = 0; i < NX; i++) {
      psf[i] = Math.abs(chiOf(H0 * sp + G * mmOf(-X_ED + 2 * X_ED * i / (NX - 1)) / 1000) * cp) / CH0;
      if (psf[i] > mx) mx = psf[i];
    }
    for (let i = 0; i < NX; i++) {
      psfPos[i * 3] = -X_ED + 2 * X_ED * i / (NX - 1);
      psfPos[i * 3 + 1] = PSF_Y0 + psf[i] * PSF_H;
      psfPos[i * 3 + 2] = 0.02;
    }
    psfGeo.attributes['position'].needsUpdate = true;
    rd.peak = mx;
  }

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 664, 264);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(3, 3, 658, 258);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(3, 3, 658, 258);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 23px "PingFang SC", sans-serif';
    infoCtx.fillText('磁粒子成像：非线性磁化本身就是信标——组织背景完全静默', 12, 27);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '18px "PingFang SC", sans-serif';
    infoCtx.fillText('M(B)=Ms·L(ξ), ξ=mB/kBT, m=Ms·πd³/6；χ=Ms·L′(ξ)·dξ/dB 只在 |B|≲kBT/m 处大', 12, 52);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('单颗粒 s=χ(B)·dB/dt 只含奇次谐波；全视野求和却几乎对消成纯余弦', 12, 76);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 19px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：G=${rd.G.toFixed(0)}mT/m  μ0H_drive=${H0}mT  ξ(峰)=${rd.xi.toFixed(2)}  M/Ms=${(rd.mm * 100).toFixed(1)}%`, 12, 104);
    infoCtx.fillText(`  FOV=2μ0H0/G=${rd.fov.toFixed(0)}mm  灵敏度FWHM=2B½/G=${rd.fwhm.toFixed(1)}mm  视野内 χ>0.1χ(0) 占比=${(rd.lit * 100).toFixed(0)}%`, 12, 128);
    infoCtx.fillStyle = '#22c55e'; infoCtx.font = '18px "PingFang SC", sans-serif';
    infoCtx.fillText(`单颗粒谱 A(3)/A(1)=${(rd.s31 * 100).toFixed(1)}%  A(5)/A(1)=${(specVals[2] / specVals[0] * 100).toFixed(1)}%  B½(χ降到χ0/2)=${B_HALF.toFixed(2)}mT(ξ=${(XI_PER_MT * B_HALF).toFixed(2)})`, 12, 152);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '17px "PingFang SC", sans-serif';
    infoCtx.fillText(`分辨率↔视野权衡：G↑ ⇒ FWHM≈${(rd.fwhm).toFixed(1)}mm 缩小，但 FOV 从 267mm 砍到 ${(rd.fov).toFixed(0)}mm`, 12, 176);
    infoCtx.fillText(`颗粒：d=${(D_CORE * 1e9).toFixed(0)}nm, Ms=${(MS / 1e3).toFixed(0)}kA/m ⇒ m=${MOM.toExponential(2)}A·m², kBT/m=${(1 / XI_PER_MT).toFixed(1)}mT`, 12, 200);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '16px "PingFang SC", sans-serif';
    infoCtx.fillText(`核对：ξ(12mT)=${rd.xi.toFixed(2)}⇒M/Ms=${(rd.mm * 100).toFixed(1)}%  χ(0)=${CH0.toExponential(3)}A/(m·mT)  FWHM(G=90/520)=192/33mm`, 12, 228);
    infoTex.needsUpdate = true;
  }

  recompute(); drawInfo();

  const mtx = new THREE.Matrix4(), vP = new THREE.Vector3(), vS = new THREE.Vector3(), q = new THREE.Quaternion(0, 0, 0, 1);
  const CYCLE = 18, G_LO = 90, G_HI = 520;
  return {
    update(t, dt) {
      const u = (t % CYCLE) / CYCLE;
      const tri = u < 0.5 ? u / 0.5 : (1 - u) / 0.5;
      const G = G_LO * Math.pow(G_HI / G_LO, tri);
      rd.G = G; rd.fov = 2 * H0 / G * 1000;

      const ph = W_DISP * t;
      const sp = Math.sin(ph), cp = Math.cos(ph);
      const xffp = wuOf(-H0 * sp / G * 1000);
      const xc = Math.max(-X_ED - 0.4, Math.min(X_ED + 0.4, xffp));
      ffPlane.position.x = xc; ffEdge.position.x = xc;
      const inView = Math.abs(xffp) <= X_ED;
      ffMat.opacity = inView ? 0.24 : 0.05;

      // 粒子：亮度 = |dM/dt| = χ(B)·|dB/dt| / (χ(0)·|dB/dt|)
      for (let i = 0; i < NP; i++) {
        const b = H0 * sp + G * mmOf(px[i]) / 1000;
        const g = Math.abs(chiOf(b) / CH0) * Math.abs(cp);
        vP.set(px[i], py[i], pz[i]);
        const sc = 0.026 * (1 + 0.5 * Math.min(1, g));
        vS.set(sc, sc, sc);
        mtx.compose(vP, q, vS); drops.setMatrixAt(i, mtx);
      }
      drops.instanceMatrix.needsUpdate = true;
      pMat.emissiveIntensity = 0.15 + Math.min(1.6, Math.abs(cp) * 1.5);

      // 场箭头：长度∝|B|，颜色随符号；|B|→0 处消失 ⇒ 肉眼看见 FFP
      for (let r = 0; r < 2; r++) for (let i = 0; i < NA; i++) {
        const a = arrows[r * NA + i];
        const b = H0 * sp + G * mmOf(-X_ED + 2 * X_ED * i / (NA - 1)) / 1000;
        const L = Math.min(0.34, Math.abs(b) / 60 * 0.34);
        const sgn = b > 0 ? 1 : -1;
        a.g.children[0].scale.set(1, Math.max(0.001, L), 1);
        a.g.children[0].position.x = sgn * L / 2;
        a.g.children[1].position.x = sgn * (L + 0.085);
        a.g.children[1].rotation.z = b > 0 ? -PI / 2 : PI / 2;
        a.g.children[1].visible = L > 0.02;
        a.m.color.setHex(Math.abs(b) < 1.2 ? 0xfbbf24 : (r === 0 ? 0x22d3ee : 0xf472b6));
      }

      // 瞬时灵敏度剖面：峰随驱动相位扫过视野，与黄色 FFP 平面同步
      drawPsf(G, sp, cp);

      // Langevin 曲线 + 沿视野的工作点
      for (let i = 0; i < NLB; i++) {
        const b = -LB_B + 2 * LB_B * i / (NLB - 1);
        lbPos[i * 3] = LB_X0 + (LB_X1 - LB_X0) * i / (NLB - 1);
        lbPos[i * 3 + 1] = lyOf(b);
        lbPos[i * 3 + 2] = 0.02;
      }
      lbGeo.attributes['position'].needsUpdate = true;
      for (let i = 0; i < wDots.length; i++) {
        const b = H0 * sp + G * mmOf(-X_ED + 2 * X_ED * i / (wDots.length - 1)) / 1000;
        wDots[i].position.set(LB_X0 + (LB_X1 - LB_X0) * (Math.max(-LB_B, Math.min(LB_B, b)) + LB_B) / (2 * LB_B), lyOf(b), 0.06);
        const near = Math.abs(b) < 6;
        wDots[i].scale.setScalar(near ? 1.5 : 0.7);
      }

      // 波形上的相位游标
      const j0 = Math.floor(((ph % TWO_PI) + TWO_PI) % TWO_PI / TWO_PI * NS) % NS;
      const ampS = Math.max(1e-12, rd.sig);
      swDot.position.set(SW_X0 + (SW_X1 - SW_X0) * j0 / (NS - 1), SW_Y0 + SW_H * 0.5 + sig[j0] / ampS * SW_H * 0.44, 0.06);

      // 5 Hz 门控：点扩散/波形/谐波谱与面板在同一趟 recompute() 里更新 ⇒ 曲线与读数永远同源
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) { recompute(); drawInfo(); }
    },
    dispose() {
      geos.forEach((x) => x.dispose()); mats.forEach((x) => x.dispose()); texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
