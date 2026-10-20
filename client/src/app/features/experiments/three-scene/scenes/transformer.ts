import type { SceneContext, SceneInstance } from '../types';
/**
 * 变压器（P117）：闭合硅钢铁芯 + 一、二次绕组的三维剖视。
 * 主控方程（画面所有几何与面板读数同源）：
 *   ① 电动势方程 E = 4.44·f·N·Φ_m ⇒ Φ_m = U₁/(4.44 f N₁ S)，B_m = Φ_m/S = U₁/(4.44 f N₁ S)
 *   ② 磁路欧姆定律 Φ = N₁·I_m/R_m，磁阻 R_m = l_c/(μ₀μ_r·S) ⇒ I_m = Φ_m·R_m/N₁
 *   ③ 理想变比 U₂ = U₁·N₂/N₁；安匝平衡 N₁I₁ ≈ N₂I₂ ⇒ I₁ = I₂·N₂/N₁（+I_m）
 *   ④ 铁损（Steinmetz + 涡流）P_Fe = [k_h·f·B_m^1.6 + k_e·f²·B_m²]·m_core —— 只随 U₁/f/N₁ 变，与负载无关
 *      铜损 P_Cu = I₁²R₁ + I₂²R₂ —— 随变比（负载电流）变
 * 扫描自变量：f（30→80 Hz，16 s）与 N₂（110→1650 匝，12 s）。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  // —— 星野 + 地面栅格 ——
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
  grid.position.y = -2.6;
  group.add(grid);

  // —— 真实参数（归一化单位：1 世界单位 = 6 cm 铁芯尺寸） ——
  const mu0 = 4 * Math.PI * 1e-7;
  const U1 = 220, N1 = 1100, S = 6.0e-4, lc = 0.45, mur = 6000;   // 一次电压/匝数、铁芯截面 m²、平均磁路长 m、硅钢 μr
  const Rm = lc / (mu0 * mur * S);
  const mCore = lc * S * 7650;                                     // 铁芯质量 kg
  const kh = 6.57e-3, ke = 5.33e-5;                                // 拟合 0.35 mm 冷轧硅钢（1.5 T/50 Hz ≈ 0.93 W/kg）
  const R1 = 0.9, R2r = 4.5, Rth = 25;                             // 一/二次绕组电阻 Ω、热阻 K/W
  const Rload = 110;                                               // 负载电阻 Ω

  let f = 50, N2 = 660;                                            // 扫描自变量
  let Phi = 0, Bm = 0, Im = 0, U2 = 0, I2 = 0, I1 = 0, PFe = 0, PCu = 0, dT = 0;

  function physics(): void {
    Phi = U1 / (4.44 * f * N1);                    // Φ_m = U₁/(4.44 f N₁)（Weber）
    Bm = Phi / S;
    Im = Phi * Rm / N1;
    U2 = U1 * N2 / N1;
    I2 = U2 / Rload;
    I1 = Math.hypot(Im, I2 * N2 / N1);            // 安匝平衡 + 励磁分量（相量近似）
    PFe = (kh * f * Math.pow(Bm, 1.6) + ke * f * f * Bm * Bm) * mCore;
    PCu = I1 * I1 * R1 + I2 * I2 * R2r;
    dT = (PFe + PCu) * Rth;
  }

  // —— 铁芯：闭合矩形框架 + 剖视（上轭前段开窗口，露出内腔与切面叠片纹） ——
  const CORE_Z = 0.6, LEG_W = 0.8, X_LEG = 1.15, Y_YOKE = 0.78, LEG_H = 2.34;
  const coreMat = mat(new THREE.MeshStandardMaterial({ color: 0x6b7a8f, metalness: 0.55, roughness: 0.55, emissive: 0xff5a1f, emissiveIntensity: 0 }));
  const addBox = (w: number, h: number, dp: number, x: number, y: number, z: number, m: import('three').Material): void => {
    const ms = new THREE.Mesh(geo(new THREE.BoxGeometry(w, h, dp)), m);
    ms.position.set(x, y, z);
    group.add(ms);
  };
  addBox(LEG_W, LEG_H, CORE_Z, -X_LEG, 0, 0, coreMat);
  addBox(LEG_W, LEG_H, CORE_Z, X_LEG, 0, 0, coreMat);
  addBox(1.5, LEG_W, CORE_Z, 0, -Y_YOKE, 0, coreMat);                       // 下轭（完整）
  addBox(1.5, LEG_W, CORE_Z * 0.5, 0, Y_YOKE, -0.15, coreMat);               // 上轭后半（剖视保留）
  addBox(0.4, LEG_W, CORE_Z * 0.5, -0.55, Y_YOKE, 0.15, coreMat);            // 上轭前半左段
  addBox(0.4, LEG_W, CORE_Z * 0.5, 0.55, Y_YOKE, 0.15, coreMat);             // 上轭前半右段

  // 叠片纹理（CanvasTexture）贴在两个切面上：证明是硅钢片叠压而非整块铁
  function laminationTex(): import('three').CanvasTexture {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#8494a8'; c.fillRect(0, 0, 128, 128);
    c.strokeStyle = '#3f4c5c'; c.lineWidth = 2;
    for (let i = 0; i < 128; i += 8) { c.beginPath(); c.moveTo(0, i + 1); c.lineTo(128, i + 1); c.stroke(); }
    c.strokeStyle = '#22d3ee'; c.lineWidth = 3; c.strokeRect(1, 1, 126, 126);
    return tex(new THREE.CanvasTexture(cv));
  }
  const cutMat = mat(new THREE.MeshStandardMaterial({ map: laminationTex(), metalness: 0.4, roughness: 0.7 }));
  for (const sx of [-0.35, 0.35]) {
    const face = new THREE.Mesh(geo(new THREE.PlaneGeometry(CORE_Z * 0.5, LEG_W)), cutMat);
    face.position.set(sx, Y_YOKE, 0.15);
    face.rotation.y = sx < 0 ? -Math.PI / 2 : Math.PI / 2;
    group.add(face);
  }

  // —— 绕组：一次（左柱，固定 12 匝铜环）+ 二次（右柱，匝数随 N₂ 出现/消失） ——
  const turnGeo = geo(new THREE.TorusGeometry(0.56, 0.055, 8, 26));
  const primMats: import('three').MeshStandardMaterial[] = [];
  for (let i = 0; i < 12; i++) {
    const m = mat(new THREE.MeshStandardMaterial({ color: 0xc9762b, metalness: 0.8, roughness: 0.35, emissive: 0xc9762b, emissiveIntensity: 0.15 }));
    const t = new THREE.Mesh(turnGeo, m);
    t.rotation.x = Math.PI / 2;
    t.position.set(-X_LEG, -0.55 + i * 0.1, 0);
    group.add(t); primMats.push(m);
  }
  const secPool: { mesh: import('three').Mesh, mat: import('three').MeshStandardMaterial }[] = [];
  for (let i = 0; i < 30; i++) {
    const m = mat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, metalness: 0.6, roughness: 0.4, emissive: 0x22d3ee, emissiveIntensity: 0.2 }));
    const t = new THREE.Mesh(turnGeo, m);
    t.rotation.x = Math.PI / 2;
    t.position.set(X_LEG, -1.05 + i * 0.072, 0);
    group.add(t); secPool.push({ mesh: t, mat: m });
  }

  // —— 交变磁通：沿铁芯中心线闭合矩形路径流动的箭头池 ——
  const PATH_W = 2 * X_LEG, PATH_H = 2 * Y_YOKE, PER = 2 * (PATH_W + PATH_H);
  const pathPoint = (s: number): { p: import('three').Vector3, t: import('three').Vector3 } => {
    let u = ((s % PER) + PER) % PER;
    const x0 = -X_LEG, x1 = X_LEG, y0 = -Y_YOKE, y1 = Y_YOKE;
    // 顺时针（从 +z 看）：下→右柱→上→左柱
    if (u < PATH_W) return { p: new THREE.Vector3(x0 + u, y0, 0.05), t: new THREE.Vector3(1, 0, 0) };
    u -= PATH_W;
    if (u < PATH_H) return { p: new THREE.Vector3(x1, y0 + u, 0.05), t: new THREE.Vector3(0, 1, 0) };
    u -= PATH_H;
    if (u < PATH_W) return { p: new THREE.Vector3(x1 - u, y1, 0.05), t: new THREE.Vector3(-1, 0, 0) };
    u -= PATH_W;
    return { p: new THREE.Vector3(x0, y1 - u, 0.05), t: new THREE.Vector3(0, -1, 0) };
  };
  const NARROW = 30;
  const arrowGeo = geo(new THREE.ConeGeometry(0.085, 0.3, 9));
  const arrowMat = mat(new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.95 }));
  const arrows: import('three').Mesh[] = [];
  for (let i = 0; i < NARROW; i++) {
    const a = new THREE.Mesh(arrowGeo, arrowMat);
    group.add(a); arrows.push(a);
  }
  const AXISY = new THREE.Vector3(0, 1, 0);   // ConeGeometry 的轴是 +Y，必须从 +Y 转到切向
  let flowPos = 0;

  // —— 电压/电流条形指示（左右两侧，高度 ∝ 数值） ——
  function barSet(x: number, color: number): { bar: import('three').Mesh, cap: import('three').Mesh, mat: import('three').MeshStandardMaterial } {
    const m = mat(new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, transparent: true, opacity: 0.92 }));
    const bar = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.12, 0.12, 1, 10)), m);
    const cap = new THREE.Mesh(geo(new THREE.ConeGeometry(0.19, 0.34, 12)), m);
    bar.position.set(x, 0, 1.15); cap.position.set(x, 0, 1.15);
    group.add(bar, cap);
    return { bar, cap, mat: m };
  }
  const vPri = barSet(-2.35, 0xfbbf24);
  const vSec = barSet(2.35, 0xf472b6);
  const iPri = barSet(-2.35, 0x22c55e);
  const iSec = barSet(2.35, 0xa855f7);
  const UP = new THREE.Vector3(0, 1, 0);
  function setBar(b: { bar: import('three').Mesh, cap: import('three').Mesh }, h: number, base: number): void {
    const hh = Math.max(0.02, h);
    b.bar.scale.set(1, hh, 1);
    b.bar.position.y = base + hh / 2;
    b.cap.position.set(b.bar.position.x, base + hh + 0.17, b.bar.position.z);
  }

  function makeLabel(text: string, color: string, w: number, x: number, y: number, z: number): void {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 26px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(w, w / 8, 1); s.position.set(x, y, z); s.renderOrder = 997;
    group.add(s);
  }
  makeLabel('一次绕组 N₁=1100 匝', '#fbbf24', 2.3, -X_LEG, 1.42, 0.75);
  makeLabel('二次绕组 N₂ 匝（随扫描增减）', '#22d3ee', 2.9, X_LEG, 1.42, 0.75);
  makeLabel('闭合铁芯剖视 · 叠片', '#94a3b8', 2.2, 0, -1.62, 0.5);
  makeLabel('交变磁通 Φ 沿铁芯环路（来回流动）', '#22c55e', 3.3, 0, 0.0, 1.75);

  // —— 信息面板（CanvasTexture + Sprite，5 Hz 重绘） ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 512; infoCv.height = 256;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const info = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  info.scale.set(7.6, 3.8, 1); info.position.set(0, 3.55, 0); info.renderOrder = 999;
  group.add(info);

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 512, 256);
    infoCtx.fillStyle = 'rgba(7,11,20,0.86)';
    infoCtx.fillRect(3, 3, 506, 250);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(3, 3, 506, 250);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    infoCtx.fillText('理想变压器 U₁/U₂ = N₁/N₂', 12, 32);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '20px "PingFang SC", sans-serif';
    infoCtx.fillText('E = 4.44·f·N·Φm；Φm = U₁/(4.44 f N₁)', 12, 62);
    infoCtx.fillText('Rm = l_c/(μ₀μr·S)，Im = Φm·Rm/N₁', 12, 86);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('铁损 P=(kh·f·B^1.6+ke·f²B²)·m 只随 f、Bm', 12, 112);
    infoCtx.fillText('变比 ⇒ 电流反比：N₁I₁ ≈ N₂I₂（铜损）', 12, 136);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 19px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：f=${f.toFixed(0)}Hz N₂=${N2.toFixed(0)}匝`, 12, 166);
    infoCtx.fillText(`U₂=${U2.toFixed(1)}V I₂=${I2.toFixed(2)}A I₁=${I1.toFixed(3)}A`, 12, 190);
    infoCtx.fillText(`Φm=${(Phi * 1e3).toFixed(2)}mWb Bm=${Bm.toFixed(2)}T`, 12, 214);
    infoCtx.fillStyle = Bm > 1.7 ? '#ef4444' : '#94a3b8';
    infoCtx.fillText(`铁损${PFe.toFixed(2)}W 铜损${PCu.toFixed(2)}W ΔT${dT.toFixed(0)}K${Bm > 1.7 ? ' 饱和!' : ''}`, 12, 238);
    infoTex.needsUpdate = true;
  }

  physics();
  drawInfo();

  return {
    update(t, dt) {
      // 自变量扫描：频率 30→80 Hz（16 s）、二次匝数 110→1650（12 s）
      f = 55 - 25 * Math.cos((t % 16) / 16 * 2 * Math.PI);
      N2 = 880 - 770 * Math.cos((t % 12) / 12 * 2 * Math.PI);
      physics();

      const w = 2 * Math.PI * f / 60;                    // 展示用角频率（真实 50 Hz 太密，按 1/60 慢放）
      const phiInst = Phi * Math.sin(w * t);
      const dPhiDt = Phi * w * Math.cos(w * t);

      // 磁通箭头：沿环路前进速度 ∝ dΦ/dt（交变 ⇒ 来回流动），亮度 ∝ |Φ|
      flowPos += dPhiDt * 0.055 * dt * 60;
      for (let i = 0; i < NARROW; i++) {
        const s = flowPos + (i / NARROW) * PER;
        const { p, t: tg } = pathPoint(s);
        const a = arrows[i];
        a.position.copy(p);
        a.quaternion.setFromUnitVectors(AXISY, tg);
        const sc = 0.45 + 1.35 * Math.min(1, Math.abs(dPhiDt) / (Phi * w));
        a.scale.set(sc, sc, sc);
      }
      arrowMat.opacity = 0.35 + 0.6 * Math.min(1, Math.abs(phiInst) / Phi);

      // 铁芯发热：稳态温升决定基础辉光，瞬时磁化损耗叠加 2f 脉动
      coreMat.emissiveIntensity = Math.min(1.6, 0.10 + dT / 90) * (0.75 + 0.25 * Math.cos(2 * w * t));

      // 绕组匝数可视化 + 电流发光
      const nSec = Math.max(2, Math.round(N2 / 55));
      for (let i = 0; i < secPool.length; i++) {
        const on = i < nSec;
        secPool[i].mesh.visible = on;
        if (on) secPool[i].mat.emissiveIntensity = 0.15 + 1.6 * Math.abs(I2 / 3) * (0.5 + 0.5 * Math.cos(w * t - i * 0.2));
      }
      for (let i = 0; i < primMats.length; i++) {
        primMats[i].emissiveIntensity = 0.15 + 1.4 * (I1 / 2.2) * (0.5 + 0.5 * Math.cos(w * t - i * 0.2));
      }

      // 电压、电流条：与 physics() 同源
      setBar(vPri, Math.min(2.2, U1 / 220 * 1.1), -2.45);
      setBar(vSec, Math.min(2.2, U2 / 220 * 1.1), -2.45);
      setBar(iPri, Math.min(1.6, I1 * 0.7), -2.45);
      setBar(iSec, Math.min(1.6, I2 * 0.28), -2.45);
      vPri.mat.emissiveIntensity = 0.35; vSec.mat.emissiveIntensity = 0.35;
      iPri.mat.emissiveIntensity = 0.25 + I1 / 2; iSec.mat.emissiveIntensity = 0.25 + I2 / 3;

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
