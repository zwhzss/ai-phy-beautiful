import type { SceneContext, SceneInstance } from '../types';
/**
 * LC 谐振（P115）：电容板间电场与螺线管内磁场反相脉动，能量在两个元件体积间来回流动；相空间 (q, i) 描出闭合环/内旋。
 * 主控方程：
 *   ① 固有频率 ω₀ = 1/√(LC)，f₀ = ω₀/2π（L 由长直螺线管公式 L = μ₀N²πr²/ℓ、C 由平行板 C = ε₀A/d + 介质部分插入 C = C₀[1+x(ε_r−1)] 直接算出）
 *   ② 能量交换：E_C = q²/(2C) = ½CV₀²x₁²，E_L = ½Li²，E_C + E_L = 常量（无阻尼）；i = ω₀Q₀sin ⇒ 相位差 90°
 *   ③ 串联阻尼：q'' + (R/L)q' + (1/LC)q = 0 ⇒ 品质因数 Q = ω₀L/R，衰减 e^{−δt}（δ = R/2L = ω₀/2Q），临界 R_crit = 2√(L/C)
 *   ④ 选频带宽 Δf = f₀/Q；相空间轨迹 (x₁, v/Ω₀)：无阻尼=圆，欠阻尼=内旋螺线，过阻尼=不闭合
 * 时间压缩：真实周期 8.7–21.5 ns → 屏上 1.5–3.7 s，压缩比 ×1.7×10⁸（面板标注）；同屏 1 unit = 20 mm。
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

  const TWO_PI = Math.PI * 2, DEG = 180 / Math.PI;

  // ============ 由绘制尺寸直接算出的真实元件值（1 unit = 20 mm） ============
  const MM_PER_U = 20;
  const EPS0 = 8.8541878128e-12, MU0 = 4 * Math.PI * 1e-7;
  const PLATE_H_U = 1.9, PLATE_Z_U = 1.5, GAP_U = 0.9;
  const PLATE_AREA_M2 = (PLATE_H_U * MM_PER_U / 1000) * (PLATE_Z_U * MM_PER_U / 1000);
  const GAP_M = GAP_U * MM_PER_U / 1000;
  const C_AIR = EPS0 * PLATE_AREA_M2 / GAP_M;            // F
  const ER = 6.0;                                         // 介质板相对介电常数
  const COIL_R_U = 0.7, COIL_LEN_U = 2.2, COIL_N = 14;
  const COIL_R_M = COIL_R_U * MM_PER_U / 1000, COIL_LEN_M = COIL_LEN_U * MM_PER_U / 1000;
  const L_H = MU0 * COIL_N * COIL_N * Math.PI * COIL_R_M * COIL_R_M / COIL_LEN_M;   // H
  const V0 = 10;                                          // 每周期初始充电电压 V
  const T_SCENE_MIN = 1.5;                                // 最小电容时的屏上周期 s
  const TC = T_SCENE_MIN / (TWO_PI * Math.sqrt(L_H * C_AIR));   // 时间压缩倍数

  // ============ 扫描自变量 ============
  let insFrac = 0.4;          // 介质插入比例 x（16 s 周期 0→1）⇒ 调 C ⇒ 调 ω₀
  let rOhm = 400;             // 串联总损耗电阻 Ω（12 s 周期 200→2200）⇒ 调 Q

  let cF = C_AIR, omega0 = 0, omegaD = 0, dampA = 0, qFactor = 0, rCrit = 0;
  let q0 = 0, eStart = 0;
  function computeParams(): void {
    cF = C_AIR * (1 + insFrac * (ER - 1));
    omega0 = 1 / Math.sqrt(L_H * cF);
    dampA = rOhm / (L_H * TC);                    // 压缩时间中的阻尼系数 (R/L)/TC
    omegaD = omega0 / TC;                          // 压缩固有角频率（数值积分给出 ω_d）
    qFactor = omega0 * L_H / rOhm;
    rCrit = 2 * Math.sqrt(L_H / cF);
    q0 = cF * V0;                                  // 初始电荷 = C·V₀
    eStart = 0.5 * cF * V0 * V0;
  }
  computeParams();

  // 状态：x1 = q/Q0, v = dx1/ds（屏上时间导数）
  let x1 = 1, vel = 0;
  let cycleStart = 0, phaseT = 0;

  // ============ 背景 ============
  const starGeo = geo(new THREE.BufferGeometry());
  {
    const p = new Float32Array(460 * 3);
    for (let i = 0; i < 460; i++) {
      p[i * 3] = (Math.random() - 0.5) * 220;
      p[i * 3 + 1] = (Math.random() - 0.5) * 220;
      p[i * 3 + 2] = (Math.random() - 0.5) * 220;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  }
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry); mat(grid.material as unknown as { dispose(): void });
  grid.position.set(0, -2.9, 0);
  group.add(grid);

  // ============ 平行板电容器 ============
  const CAP_X = -4.6, CY = 0.3;
  const plateGeo = geo(new THREE.BoxGeometry(0.1, PLATE_H_U, PLATE_Z_U));
  const plateMatL = mat(new THREE.MeshStandardMaterial({ color: 0x9fb4d0, metalness: 0.8, roughness: 0.3, emissive: 0x22d3ee, emissiveIntensity: 0 }));
  const plateMatR = mat(new THREE.MeshStandardMaterial({ color: 0x9fb4d0, metalness: 0.8, roughness: 0.3, emissive: 0xef4444, emissiveIntensity: 0 }));
  const plateL = new THREE.Mesh(plateGeo, plateMatL);
  const plateR = new THREE.Mesh(plateGeo, plateMatR);
  plateL.position.set(CAP_X - GAP_U / 2, CY, 0);
  plateR.position.set(CAP_X + GAP_U / 2, CY, 0);
  group.add(plateL, plateR);
  // 介质板（部分插入）
  const dMat = mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.42, roughness: 0.9 }));
  const dielec = new THREE.Mesh(geo(new THREE.BoxGeometry(GAP_U * 0.86, PLATE_H_U * 0.9, PLATE_Z_U * 0.95)), dMat);
  group.add(dielec);
  // 激励脉冲（每 8 s 把电容重新充到 V₀）
  const flashMat = mat(new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0 }));
  const flashBall = new THREE.Mesh(geo(new THREE.SphereGeometry(1, 16, 12)), flashMat);
  flashBall.position.set(CAP_X, CY + 1.55, 0);
  group.add(flashBall);

  // ============ 螺线管 ============
  const COIL_X0 = -2.2, COIL_X1 = 0.0;
  {
    const pts: import('three').Vector3[] = [];
    const SAMPLES = 480;
    for (let i = 0; i <= SAMPLES; i++) {
      const k = i / SAMPLES;
      const a = TWO_PI * COIL_N * k;
      pts.push(new THREE.Vector3(COIL_X0 + COIL_LEN_U * k, CY + COIL_R_U * Math.cos(a), COIL_R_U * Math.sin(a)));
    }
    const coil = new THREE.Mesh(
      geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 460, 0.032, 6, false)),
      mat(new THREE.MeshStandardMaterial({ color: 0xf0b060, metalness: 0.85, roughness: 0.35 })),
    );
    group.add(coil);
  }

  // ============ 回路导线 + 电流点 ============
  const WIRE: [number, number][] = [
    [CAP_X + GAP_U / 2, CY + 0.95], [COIL_X0 + 0.1, CY + 1.05], [COIL_X0, CY + COIL_R_U],
  ];
  const WIRE2: [number, number][] = [
    [COIL_X1, CY + COIL_R_U], [COIL_X1 + 0.62, CY + COIL_R_U], [COIL_X1 + 0.62, -2.15],
    [CAP_X - 1.05, -2.15], [CAP_X - 1.05, CY - 0.95], [CAP_X - GAP_U / 2, CY - 0.95],
  ];
  // 单条折线：导线 1 →（螺线管跨度）→ 导线 2，用电流点沿其漂移
  const PATH: [number, number][] = WIRE.concat(WIRE2);
  const SEG_LEN: number[] = [];
  let PATH_TOTAL = 0;
  {
    for (let i = 0; i < PATH.length - 1; i++) {
      const dl = Math.hypot(PATH[i + 1][0] - PATH[i][0], PATH[i + 1][1] - PATH[i][1]);
      SEG_LEN.push(dl);
      PATH_TOTAL += dl;
    }
    const drawSeg = (list: [number, number][]): void => {
      const g = geo(new THREE.BufferGeometry());
      const v: number[] = [];
      for (let i = 0; i < list.length - 1; i++) v.push(list[i][0], list[i][1], 0, list[i + 1][0], list[i + 1][1], 0);
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
      group.add(new THREE.LineSegments(g, mat(new THREE.LineBasicMaterial({ color: 0x64748b }))));
    };
    drawSeg(WIRE);
    drawSeg(WIRE2);
    drawSeg([[COIL_X0, CY + COIL_R_U], [COIL_X1, CY + COIL_R_U]]);   // 线圈跨度（示意）
  }
  function pathPoint(uPos: number): [number, number] {
    let d = ((uPos % PATH_TOTAL) + PATH_TOTAL) % PATH_TOTAL;
    for (let i = 0; i < SEG_LEN.length; i++) {
      if (d <= SEG_LEN[i] || i === SEG_LEN.length - 1) {
        const a = PATH[i], b = PATH[i + 1] ?? PATH[i];
        const f = SEG_LEN[i] > 1e-6 ? Math.min(1, d / SEG_LEN[i]) : 0;
        return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      }
      d -= SEG_LEN[i];
    }
    return PATH[PATH.length - 1];
  }
  const DOT_N = 26;
  const dotGeo = geo(new THREE.BufferGeometry());
  dotGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DOT_N * 3), 3));
  group.add(new THREE.Points(dotGeo, mat(new THREE.PointsMaterial({ color: 0x22c55e, size: 0.13 }))));

  // ============ 场箭头（E 与 B） ============
  const shaftGeo = geo(new THREE.CylinderGeometry(0.021, 0.021, 1, 6));
  const headGeo = geo(new THREE.ConeGeometry(0.075, 0.2, 8));
  type FArrow = { g: import('three').Group, shaft: import('three').Mesh, head: import('three').Mesh, m: import('three').MeshStandardMaterial };
  function makeFArrow(color: number): FArrow {
    const g = new THREE.Group();
    const m = mat(new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.1, roughness: 0.6 }));
    const shaft = new THREE.Mesh(shaftGeo, m);
    const head = new THREE.Mesh(headGeo, m);
    shaft.rotation.z = -Math.PI / 2;      // 局部轴 y → x
    head.rotation.z = -Math.PI / 2;
    g.add(shaft, head);
    group.add(g);
    return { g, shaft, head, m };
  }
  /** E/B 箭头：局部 +x 指向，长度 ∝ |幅值|，符号翻转方向 */
  const eArrows: FArrow[] = [];
  {
    const off = [[-0.55, 0], [0.55, 0], [-0.55, 0.5], [0.55, 0.5], [-0.55, -0.5], [0.55, -0.5]];
    for (const [dy, dz] of off) {
      const a = makeFArrow(0x22d3ee);
      a.g.position.set(CAP_X, CY + dy * 0.75, dz);
      eArrows.push(a);
      eArrows[eArrows.length - 1].g.userData['dy'] = dy * 0.75;
      eArrows[eArrows.length - 1].g.userData['dz'] = dz;
    }
  }
  const bArrows: FArrow[] = [];
  for (const fx of [0.28, 0.5, 0.72]) {
    const a = makeFArrow(0xfbbf24);
    a.g.userData['fx'] = fx;
    bArrows.push(a);
  }

  // ============ 能量柱 ============
  const BAR_X = 1.55, BAR_BASE = -2.2, BAR_H = 2.3;
  const barEC = new THREE.Mesh(geo(new THREE.BoxGeometry(0.42, 1, 0.42)), mat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0e7490, emissiveIntensity: 1 })));
  const barEL = new THREE.Mesh(geo(new THREE.BoxGeometry(0.42, 1, 0.42)), mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0x92600c, emissiveIntensity: 1 })));
  barEC.geometry.translate(0, 0.5, 0);
  barEL.geometry.translate(0, 0.5, 0);
  group.add(barEC, barEL);
  const totGeo = geo(new THREE.BufferGeometry());
  totGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  group.add(new THREE.Line(totGeo, mat(new THREE.LineBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.75 }))));

  // ============ 相空间 (q, i) ============
  const PS_X = 5.35, PS_Y = 0.15, PS_R = 1.45;
  {
    const ag = geo(new THREE.BufferGeometry());
    ag.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      PS_X - PS_R * 1.28, PS_Y, 0, PS_X + PS_R * 1.28, PS_Y, 0,
      PS_X, PS_Y - PS_R * 1.28, 0, PS_X, PS_Y + PS_R * 1.28, 0,
    ]), 3));
    group.add(new THREE.LineSegments(ag, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));
    const rg = geo(new THREE.BufferGeometry());
    const rv: number[] = [];
    for (let i = 0; i < 64; i++) {
      const a0 = (i / 64) * TWO_PI, a1 = ((i + 1) / 64) * TWO_PI;
      rv.push(PS_X + Math.cos(a0) * PS_R, PS_Y + Math.sin(a0) * PS_R, 0);
      rv.push(PS_X + Math.cos(a1) * PS_R, PS_Y + Math.sin(a1) * PS_R, 0);
    }
    rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rv), 3));
    group.add(new THREE.LineSegments(rg, mat(new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.8 }))));
  }
  const TRAIL = 520;
  const trailGeo = geo(new THREE.BufferGeometry());
  trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 6), 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL * 6), 3));
  group.add(new THREE.LineSegments(trailGeo, mat(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 }))));
  const psDot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.085, 14, 10)), mat(new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xf472b6, emissiveIntensity: 1.4 })));
  group.add(psDot);
  const trail: number[] = [];

  // ============ 标签 ============
  function makeLabel(text: string, color: string, w: number, x: number, y: number, z: number): void {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 25px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(w, w / 8, 1);
    s.position.set(x, y, z);
    group.add(s);
  }
  makeLabel('电容 C = ε₀A/d·[1+x(ε_r−1)]', '#22d3ee', 3.5, CAP_X, CY + 1.55, 0);
  makeLabel('电感 L = μ₀N²πr²/ℓ', '#fbbf24', 2.9, (COIL_X0 + COIL_X1) / 2, CY + 1.35, 0);
  makeLabel('电场 E ∝ q', '#22d3ee', 1.9, CAP_X, CY - 1.5, 0);
  makeLabel('磁场 B ∝ i', '#fbbf24', 1.9, (COIL_X0 + COIL_X1) / 2, CY - 1.15, 0);
  makeLabel('能量交换', '#f472b6', 2.0, BAR_X + 0.25, BAR_BASE + BAR_H + 0.42, 0);
  makeLabel('相空间 (q, i)：守恒 ⇒ 闭合环', '#f8fafc', 3.2, PS_X, PS_Y + PS_R + 0.55, 0);

  // ============ 顶部面板 ============
  const infoCv = document.createElement('canvas');
  infoCv.width = 900; infoCv.height = 300;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.6, 3.2)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.renderOrder = 999;
  infoPlane.position.set(-0.9, 5.45, 0);
  group.add(infoPlane);

  let eC = 0, eL = 0, iTrue = 0, periods = 0;
  const ln = (y: number, color: string, text: string, bold = false, size = 25): void => {
    infoCtx.fillStyle = color;
    infoCtx.font = `${bold ? 'bold ' : ''}${size}px "PingFang SC", sans-serif`;
    infoCtx.fillText(text, 20, y);
  };
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 900, 300);
    infoCtx.fillStyle = 'rgba(7,11,20,0.86)';
    infoCtx.fillRect(4, 4, 892, 292);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 892, 292);
    infoCtx.textAlign = 'left';

    ln(38, '#f8fafc', 'LC 谐振 —— ω₀ = 1/√(LC)，Q = ω₀L/R，Δf = f₀/Q', true, 26);
    ln(70, '#22d3ee', `几何→参数：C = ${(cF * 1e12).toFixed(2)} pF（插入 x=${insFrac.toFixed(2)}，ε_r=${ER}）、L = ${(L_H * 1e6).toFixed(2)} μH ⇒ f₀ = ω₀/2π = ${(omega0 / TWO_PI / 1e6).toFixed(1)} MHz、T = ${(TWO_PI / omega0 * 1e9).toFixed(1)} ns`);
    ln(100, '#a855f7', `能量：E_C = q²/2C = ${(eC * 1e12).toFixed(2)} pJ、E_L = ½Li² = ${(eL * 1e12).toFixed(2)} pJ、合计 ${(1e12 * (eC + eL)).toFixed(2)} pJ（E₀ = ${(1e12 * eStart).toFixed(2)} pJ）；q 与 i 相位差 90°`);
    ln(130, '#22c55e', `阻尼：δ = R/2L = ${(rOhm / (2 * L_H) / 1e6).toFixed(1)}×10⁶ s⁻¹、Q = ω₀L/R = ${qFactor.toFixed(1)}、每周期衰减 e^{−2π/Q} = ${Math.exp(-TWO_PI / Math.max(0.2, qFactor)).toFixed(3)}、带宽 Δf = f₀/Q = ${(omega0 / TWO_PI / qFactor / 1e6).toFixed(2)} MHz`);
    ln(160, '#fbbf24', `临界阻尼 R_crit = 2√(L/C) = ${(rCrit / 1000).toFixed(3)} kΩ ⇒ 当前 R=${rOhm.toFixed(0)} Ω ${rOhm < rCrit ? '（欠阻尼：振荡）' : rOhm > rCrit * 1.02 ? '（过阻尼：无振荡，电荷单调泄放）' : '（临界：最快不越过零）'}`);

    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 25px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：q = ${(1e12 * q0 * x1).toFixed(2)} pC  i = ${(iTrue * 1000).toFixed(1)} mA  V_C = ${(V0 * x1).toFixed(2)} V  本周期已振荡 ${periods.toFixed(1)} 次`,
      20, 202,
    );
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '21px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `时间压缩 ×${(TC / 1e6).toFixed(1)}M（真实 ${((TWO_PI / omega0) * 1e9).toFixed(1)} ns → 屏上 ${(TWO_PI / omegaD).toFixed(2)} s）；绘图比例 1 unit = ${MM_PER_U} mm：极板 ${(PLATE_H_U * MM_PER_U).toFixed(0)}×${(PLATE_Z_U * MM_PER_U).toFixed(0)} mm、间隙 ${GAP_M * 1000} mm、线圈 r=${(COIL_R_M * 1000).toFixed(0)} mm ℓ=${(COIL_LEN_M * 1000).toFixed(0)} mm N=${COIL_N}。`,
      20, 246,
    );
    infoCtx.fillText(
      '每 8 s 重新充电至 10 V（激励脉冲）；介质插入越多 ⇒ C 越大 ⇒ f₀ 越低，同时 R_crit 上升 ⇒ 同一电阻下更早进入过阻尼。',
      20, 278,
    );
    infoTex.needsUpdate = true;
  }

  // ============ 每帧 ============
  const CYCLE = 8;
  let flash = 0;
  function step(dt: number): void {
    const sub = 6;
    const h = dt / sub;
    for (let k = 0; k < sub; k++) {
      const acc = -dampA * vel - omegaD * omegaD * x1;
      vel += acc * h;
      x1 += vel * h;
    }
    if (!isFinite(x1)) { x1 = 0; vel = 0; }
  }

  function updateVisuals(): void {
    iTrue = TC * q0 * vel;
    eC = 0.5 * cF * V0 * V0 * x1 * x1;
    eL = 0.5 * L_H * iTrue * iTrue;
    // 极板电荷着色（+ 左 / − 右，随符号翻转）
    const a1 = Math.min(1, Math.abs(x1));
    const sgn = x1 >= 0 ? 1 : -1;
    plateMatL.emissiveIntensity = 0.15 + 1.5 * a1;
    plateMatR.emissiveIntensity = 0.15 + 1.5 * a1;
    plateMatL.color.setHex(sgn > 0 ? 0x9fb4d0 : 0xd09fae);
    plateMatR.color.setHex(sgn > 0 ? 0x9fb4d0 : 0x9fc4d0);
    // 介质板位置（部分插入）
    const dz = PLATE_Z_U * 0.95 * Math.max(0.02, insFrac);
    dielec.scale.set(1, 1, Math.max(0.02, insFrac));
    dielec.position.set(CAP_X, CY, -PLATE_Z_U * 0.95 / 2 + dz / 2);
    // 激励脉冲闪光
    flashMat.opacity = 0.85 * flash;
    flashBall.scale.setScalar(0.12 + 0.9 * flash);
    // E 箭头
    const eLen = 0.62 * a1;
    for (const a of eArrows) {
      a.g.position.set(CAP_X, CY + (a.g.userData['dy'] as number), a.g.userData['dz'] as number);
      a.g.rotation.z = sgn > 0 ? 0 : Math.PI;
      a.shaft.scale.set(1, Math.max(0.02, eLen), 1);
      a.head.position.set(Math.max(0.02, eLen) / 2 + 0.1, 0, 0);
      a.g.visible = a1 > 0.02;
    }
    // B 箭头
    const iN = Math.min(1, Math.abs(vel) / Math.max(1e-6, omegaD));
    const bsgn = vel >= 0 ? 1 : -1;
    for (const a of bArrows) {
      const fx = a.g.userData['fx'] as number;
      a.g.position.set(COIL_X0 + COIL_LEN_U * fx, CY, 0);
      a.g.rotation.z = bsgn > 0 ? 0 : Math.PI;
      a.shaft.scale.set(1, Math.max(0.02, 1.5 * iN), 1);
      a.head.position.set(Math.max(0.02, 1.5 * iN) / 2 + 0.1, 0, 0);
      a.g.visible = iN > 0.02;
    }
    // 电流点沿回路漂移
    const dp = (iTrue >= 0 ? 1 : -1) * Math.min(1, Math.abs(iTrue) / Math.max(1e-9, q0 * omega0)) * 0.9;
    const pos = dotGeo.attributes['position'].array as Float32Array;
    for (let i = 0; i < DOT_N; i++) {
      const base = (i / DOT_N) * PATH_TOTAL;
      const p = pathPoint(base + phaseT * dp * 2.2);
      pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = 0;
    }
    dotGeo.attributes['position'].needsUpdate = true;
    // 能量柱
    const norm = Math.max(1e-30, eStart);
    barEC.position.set(BAR_X, BAR_BASE, 0);
    barEC.scale.set(1, Math.max(0.001, BAR_H * (eC / norm)), 1);
    barEL.position.set(BAR_X + 0.62, BAR_BASE, 0);
    barEL.scale.set(1, Math.max(0.001, BAR_H * (eL / norm)), 1);
    const tp = totGeo.attributes['position'].array as Float32Array;
    const ty = BAR_BASE + BAR_H * ((eC + eL) / norm);
    tp[0] = BAR_X - 0.35; tp[1] = ty; tp[2] = 0;
    tp[3] = BAR_X + 1.0; tp[4] = ty; tp[5] = 0;
    totGeo.attributes['position'].needsUpdate = true;
    // 相空间轨迹
    trail.push(x1, vel / Math.max(1e-9, omegaD));
    if (trail.length > TRAIL * 2) trail.splice(0, trail.length - TRAIL * 2);
    const n = Math.floor(trail.length / 2);
    const ta = trailGeo.attributes['position'].array as Float32Array;
    const ca = trailGeo.attributes['color'].array as Float32Array;
    for (let i = 0; i < TRAIL; i++) {
      if (i < n - 1) {
        const x0 = PS_X + trail[i * 2] * PS_R, y0 = PS_Y + trail[i * 2 + 1] * PS_R;
        const x1b = PS_X + trail[(i + 1) * 2] * PS_R, y1b = PS_Y + trail[(i + 1) * 2 + 1] * PS_R;
        ta[i * 6] = x0; ta[i * 6 + 1] = y0; ta[i * 6 + 2] = 0;
        ta[i * 6 + 3] = x1b; ta[i * 6 + 4] = y1b; ta[i * 6 + 5] = 0;
        const f = i / Math.max(1, n - 1);
        ca[i * 6] = 0.13; ca[i * 6 + 1] = 0.62 * f + 0.1; ca[i * 6 + 2] = 0.87 * f + 0.2;
        ca[i * 6 + 3] = 0.13; ca[i * 6 + 4] = 0.62 * f + 0.1; ca[i * 6 + 5] = 0.87 * f + 0.2;
      } else {
        for (let k = 0; k < 6; k++) ta[i * 6 + k] = k === 1 ? -999 : 0;
      }
    }
    trailGeo.attributes['position'].needsUpdate = true;
    trailGeo.attributes['color'].needsUpdate = true;
    psDot.position.set(PS_X + x1 * PS_R, PS_Y + (vel / Math.max(1e-9, omegaD)) * PS_R, 0);
  }

  updateVisuals();
  drawInfo();

  return {
    update(t, dt) {
      // 自变量 1：介质插入比例 x（改变 C ⇒ ω₀），周期 16 s
      insFrac = 0.5 - 0.5 * Math.cos(((t % 16) / 16) * TWO_PI);
      // 自变量 2：串联损耗电阻 R（改变 Q），周期 12 s
      rOhm = 200 + 1000 * (1 - Math.cos(((t % 12) / 12) * TWO_PI));
      computeParams();

      // 每 CYCLE 秒重新激励（充电至 V0）
      const cyc = Math.floor(t / CYCLE);
      if (cyc * CYCLE !== cycleStart) {
        cycleStart = cyc * CYCLE;
        x1 = 1; vel = 0;
        flash = 1;
      }
      step(dt);
      phaseT += dt;
      periods = (t - cycleStart) * omegaD / TWO_PI;
      flash = Math.max(0, flash - dt * 1.6);

      updateVisuals();
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
