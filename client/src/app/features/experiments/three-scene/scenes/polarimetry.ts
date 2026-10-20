import type { SceneContext, SceneInstance } from '../types';
/**
 * 天体偏振观测（P289）：磁尘定向产生线偏振 → 等离子体屏法拉第旋转 → 检偏器扫描 → Stokes 参量与 λ⁴ 消偏振。
 * 主控方程：
 *   ① 检偏（Malus 定律，部分偏振推广）：I(θ) = ½I₀[1 + P·cos2(θ−θ₀)]；全偏振极限即 I₀cos²(θ−θ₀)
 *      偏振度 P = (I_max − I_min)/(I_max + I_min)
 *   ② Stokes 参量：Q = I·P·cos2θ₀，U = I·P·sin2θ₀，V = 0（纯线偏振）；θ₀ = ½·atan2(U,Q)
 *   ③ 法拉第旋转：Δθ = RM·λ²，RM = 0.81∫n_e B_∥ dl [rad/m²]（n_e: cm⁻³, B_∥: μG, dl: pc）⇒ (Q,U) 在 Stokes 面转过 2Δθ
 *   ④ 束内 RM 涨落 ⇒ 差旋消偏振 P_meas = P₀·exp(−2λ⁴σ_RM²)；尘埃几何 P₀ = P_max·sinγ（γ = B 与视线夹角），E ∥ B 的天球投影
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
  const XAX = new THREE.Vector3(1, 0, 0), YAX = new THREE.Vector3(0, 1, 0), ZAX = new THREE.Vector3(0, 0, 1);

  // ---- 星空背景 + 网格 ----
  const starGeo = geo(new THREE.BufferGeometry());
  {
    const p = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      p[i * 3] = (Math.random() - 0.5) * 220;
      p[i * 3 + 1] = (Math.random() - 0.5) * 220;
      p[i * 3 + 2] = (Math.random() - 0.5) * 220;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  }
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry); mat(grid.material as unknown as { dispose(): void });
  grid.position.set(-0.5, -4.0, -0.8);
  group.add(grid);

  // ============ 真实物理量 ============
  const N_E = 0.2;            // cm⁻³ 电离屏电子密度
  const B_MU = 8.0;           // μG 屏内磁场强度
  const L_PC = 120;           // pc 电离屏厚度
  const SIG_RM = 22;          // rad/m² 束内 RM 涨落（差旋消偏振）
  const RM0 = 0.81 * N_E * B_MU * L_PC;   // = 155.5 rad/m²（γ=0 时 B_∥ = B）
  const P_MAX = 0.12;         // 尘埃磁定向的本征偏振度
  const PSI = 0.55;           // rad：B 在天球投影的方向角（固定）

  let lam = 0.06;             // m：观测波长（扫描自变量 1，16 s 对数周期 3→18 cm）
  let gamma = 0.8;            // rad：B 与视线夹角（扫描自变量 2，12 s 周期 3°→60°）
  let thetaAna = 0;           // rad：检偏器透振轴（仪器扫描）
  let rm = 0, dTheta = 0, sigmaRot = 0, dep = 0, pInt = 0, pMeas = 0, thetaE = 0;
  let stQ = 0, stU = 0, iMeas = 0, iMax = 0, iMin = 0;

  function computeState(): void {
    rm = RM0 * Math.cos(gamma);            // B_∥ = B·cosγ
    dTheta = rm * lam * lam;               // Δθ = RM λ²
    sigmaRot = SIG_RM * lam * lam;         // 束内旋转弥散
    dep = Math.exp(-2 * Math.pow(lam, 4) * SIG_RM * SIG_RM);
    pInt = P_MAX * Math.sin(gamma);        // 投影几何：B ⊥ 视线时偏振最强
    pMeas = pInt * dep;
    thetaE = PSI + dTheta;                 // E 矢量 ∥ B 的天球投影，再被法拉第旋过 Δθ
    stQ = pMeas * Math.cos(2 * thetaE);
    stU = pMeas * Math.sin(2 * thetaE);
    iMeas = 0.5 * (1 + pMeas * Math.cos(2 * (thetaAna - thetaE)));
    iMax = 0.5 * (1 + pMeas);
    iMin = 0.5 * (1 - pMeas);
  }

  // ============ 共用箭头几何（沿 +x 的双向箭头，位于 x–y 面） ============
  const arrowGeo = geo(new THREE.BufferGeometry());
  {
    const v: number[] = [];
    const seg = (a: number[], b: number[]): void => { v.push(a[0], a[1], a[2], b[0], b[1], b[2]); };
    seg([-1, 0, 0], [1, 0, 0]);
    seg([1, 0, 0], [0.8, 0.13, 0]); seg([1, 0, 0], [0.8, -0.13, 0]);
    seg([-1, 0, 0], [-0.8, 0.13, 0]); seg([-1, 0, 0], [-0.8, -0.13, 0]);
    arrowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
  }
  const mkArrow = (color: number, parent: import('three').Object3D): import('three').LineSegments => {
    const a = new THREE.LineSegments(arrowGeo, mat(new THREE.LineBasicMaterial({ color, transparent: true, depthTest: false })));
    a.renderOrder = 900;
    parent.add(a);
    return a;
  };

  // ============ 光路（沿 +z 为视线方向） ============
  const PATH_X = -3.4, CLOUD_Y = 0.45;
  const Z_SRC = -5.2, Z_CLOUD = -2.2, Z_SCREEN = 0.3, Z_ANA = 2.5, Z_DET = 3.5;

  // 背景源星
  const srcCv = document.createElement('canvas');
  srcCv.width = 128; srcCv.height = 128;
  {
    const c = srcCv.getContext('2d')!;
    const g = c.createRadialGradient(64, 64, 2, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(203,225,255,0.55)');
    g.addColorStop(1, 'rgba(203,225,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  }
  const src = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(srcCv)), transparent: true })));
  src.scale.setScalar(1.9);
  src.position.set(PATH_X, CLOUD_Y, Z_SRC);
  group.add(src);

  // 光束（视线路径）
  const beam = new THREE.Mesh(
    geo(new THREE.CylinderGeometry(0.42, 0.42, 8.6, 16, 1, true)),
    mat(new THREE.MeshBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.14, side: THREE.DoubleSide })),
  );
  beam.rotation.x = Math.PI / 2;
  beam.position.set(PATH_X, CLOUD_Y, (Z_SRC + Z_DET) / 2);
  group.add(beam);

  // ---- 尘埃云：包围盒 + 定向颗粒 + 磁力线 ----
  const cloud = new THREE.Group();
  cloud.position.set(PATH_X, CLOUD_Y, Z_CLOUD);
  group.add(cloud);
  const cloudBox = new THREE.Mesh(
    geo(new THREE.BoxGeometry(3.4, 2.3, 2.4)),
    mat(new THREE.MeshStandardMaterial({ color: 0x334155, transparent: true, opacity: 0.16, roughness: 1 })),
  );
  cloud.add(cloudBox);
  const boxEdge = new THREE.LineSegments(
    geo(new THREE.EdgesGeometry(cloudBox.geometry as import('three').BufferGeometry)),
    mat(new THREE.LineBasicMaterial({ color: 0x475569 })),
  );
  cloud.add(boxEdge);

  const grainGeo = geo(new THREE.CylinderGeometry(0.026, 0.026, 0.185, 5));
  const grainMat = mat(new THREE.MeshStandardMaterial({ color: 0xcbb88a, roughness: 0.85, emissive: 0x2a2418, emissiveIntensity: 0.6 }));
  const grains: import('three').Mesh[] = [];
  const phi: number[] = [];
  {
    const N = 240;
    for (let i = 0; i < N; i++) {
      const m = new THREE.Mesh(grainGeo, grainMat);
      m.position.set(
        (Math.random() - 0.5) * 3.1,
        (Math.random() - 0.5) * 2.05,
        (Math.random() - 0.5) * 2.15,
      );
      m.scale.setScalar(0.7 + Math.random() * 0.7);
      phi.push(Math.random() * TWO_PI);          // 绕 B 的随机方位（长轴仍 ⟂ B）
      cloud.add(m);
      grains.push(m);
    }
  }
  // 磁力线（随 B 取向整体旋转）
  const fieldGrp = new THREE.Group();
  cloud.add(fieldGrp);
  {
    const flGeo = geo(new THREE.BufferGeometry());
    const fv: number[] = [];
    for (const [ox, oy] of [[-1.1, 0.6], [0.1, 0.62], [1.05, -0.1], [-0.45, -0.72], [0.7, -0.68]]) {
      fv.push(ox, oy, -1.05, ox, oy, 1.05);
    }
    flGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(fv), 3));
    fieldGrp.add(new THREE.LineSegments(flGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.75 }))));
    const headGeo = geo(new THREE.ConeGeometry(0.075, 0.24, 8));
    for (const [ox, oy] of [[-1.1, 0.6], [0.1, 0.62], [1.05, -0.1], [-0.45, -0.72], [0.7, -0.68]]) {
      const cone = new THREE.Mesh(headGeo, mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
      cone.position.set(ox, oy, 0.2);
      cone.rotation.x = Math.PI / 2;      // 锥轴 y → z（沿 +z，即 γ=0 时的 B 方向）
      fieldGrp.add(cone);
    }
  }

  // ---- 法拉第旋转屏 ----
  const screen = new THREE.Mesh(
    geo(new THREE.BoxGeometry(2.9, 2.3, 0.5)),
    mat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.13, roughness: 0.9, emissive: 0x0e5f6e, emissiveIntensity: 0.9 })),
  );
  screen.position.set(PATH_X, CLOUD_Y, Z_SCREEN);
  group.add(screen);

  // ---- 检偏器（线栅偏振片） ----
  const ana = new THREE.Group();
  ana.position.set(PATH_X, CLOUD_Y, Z_ANA);
  group.add(ana);
  const anaDisc = new THREE.Mesh(
    geo(new THREE.CylinderGeometry(1.05, 1.05, 0.07, 40)),
    mat(new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.5, transparent: true, opacity: 0.55 })),
  );
  anaDisc.rotation.x = Math.PI / 2;      // 盘面法线 → z（视线）
  ana.add(anaDisc);
  // 透振轴标记（沿局部 +x）
  {
    const axGeo = geo(new THREE.BufferGeometry());
    axGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1.05, 0, 0.06, 1.05, 0, 0.06]), 3));
    ana.add(new THREE.Line(axGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e }))));
    // 线栅：金属丝 ⟂ 透振轴（物理上线栅偏振片透射 E ∥ 栅线垂直方向）
    const wireGeo = geo(new THREE.BufferGeometry());
    const wv: number[] = [];
    for (let k = -3; k <= 3; k++) {
      const x = k * 0.26;
      const half = Math.sqrt(Math.max(0, 1.0 - x * x));
      wv.push(x, -half, 0.06, x, half, 0.06);
    }
    wireGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(wv), 3));
    ana.add(new THREE.LineSegments(wireGeo, mat(new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.65 }))));
  }

  // ---- 探测器 ----
  const detMat = mat(new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x22d3ee, emissiveIntensity: 0.2, roughness: 0.4, metalness: 0.3 }));
  const detector = new THREE.Mesh(geo(new THREE.BoxGeometry(1.1, 1.1, 0.28)), detMat);
  detector.position.set(PATH_X, CLOUD_Y, Z_DET);
  group.add(detector);

  // 光路上的偏振 E 矢量箭头
  const arrSrc = mkArrow(0xf8fafc, group);       // 源：非偏振（两正交等幅臂）
  arrSrc.position.set(PATH_X, CLOUD_Y, -4.1);
  const arrSrc2 = mkArrow(0x94a3b8, group);
  arrSrc2.position.copy(arrSrc.position);
  const arrPre = mkArrow(0xfbbf24, group);       // 出云：∥ B⊥ 投影
  arrPre.position.set(PATH_X, CLOUD_Y, -0.75);
  const arrPost = mkArrow(0xa855f7, group);      // 过屏：旋过 Δθ = RMλ²
  arrPost.position.set(PATH_X, CLOUD_Y, 1.25);
  const arrOut = mkArrow(0x22c55e, group);       // 过检偏器：投影幅 ∝ |cos(θ_a−θ₀)|
  arrOut.position.set(PATH_X, CLOUD_Y, 3.05);

  // ============ 天空偏振矢量图 ============
  const MAP_X = 2.95, MAP_Y = 1.75, MAP_Z = -0.8;
  const mapGrp = new THREE.Group();
  mapGrp.position.set(MAP_X, MAP_Y, MAP_Z);
  group.add(mapGrp);
  {
    const bg = new THREE.Mesh(geo(new THREE.PlaneGeometry(5.0, 2.9)), mat(new THREE.MeshBasicMaterial({ color: 0x0b1220, transparent: true, opacity: 0.55 })));
    mapGrp.add(bg);
    const fr = new THREE.LineSegments(geo(new THREE.EdgesGeometry(new THREE.PlaneGeometry(5.0, 2.9))), mat(new THREE.LineBasicMaterial({ color: 0x334155 })));
    mapGrp.add(fr);
  }
  const CEL_X = 8, CEL_Y = 5;
  const cellArrows: import('three').LineSegments[] = [];
  const cellW: number[] = [];
  {
    const am = mat(new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, depthTest: false }));
    for (let i = 0; i < CEL_X; i++) {
      for (let j = 0; j < CEL_Y; j++) {
        const a = new THREE.LineSegments(arrowGeo, am);
        a.renderOrder = 901;
        a.position.set(-2.2 + i * 0.63, -1.16 + j * 0.58, 0.02);
        a.scale.setScalar(0.24);
        mapGrp.add(a);
        cellArrows.push(a);
        cellW.push(2 * Math.sin((i + 1) * 12.9898 + (j + 1) * 78.233));   // 固定伪随机 [-1,1]
      }
    }
  }
  const netArrow = mkArrow(0xef4444, mapGrp);      // 净偏振（束平均）矢量
  netArrow.position.set(0, 0, 0.06);

  // ============ 极坐标检偏曲线 + Stokes Q–U 面 ============
  const plotCv = document.createElement('canvas');
  plotCv.width = 900; plotCv.height = 380;
  const plotCtx = plotCv.getContext('2d')!;
  const plotTex = tex(new THREE.CanvasTexture(plotCv));
  const plotPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(5.0, 2.11)),
    mat(new THREE.MeshBasicMaterial({ map: plotTex, transparent: true, depthTest: false })),
  );
  plotPlane.renderOrder = 998;
  plotPlane.position.set(MAP_X, -2.05, MAP_Z);
  group.add(plotPlane);

  function drawPlot(): void {
    plotCtx.clearRect(0, 0, 900, 380);
    plotCtx.fillStyle = 'rgba(7,11,20,0.82)';
    plotCtx.fillRect(0, 0, 900, 380);
    plotCtx.strokeStyle = '#334155'; plotCtx.lineWidth = 3; plotCtx.strokeRect(2, 2, 896, 376);

    // ---- 左：I(θ) 检偏玫瑰（半径 ∝ 归一化强度） ----
    const cx = 200, cy = 190, R = 150;
    plotCtx.strokeStyle = '#475569'; plotCtx.lineWidth = 1.5;
    plotCtx.beginPath(); plotCtx.arc(cx, cy, R, 0, TWO_PI); plotCtx.stroke();
    plotCtx.beginPath(); plotCtx.arc(cx, cy, R * 0.5, 0, TWO_PI); plotCtx.stroke();
    plotCtx.beginPath(); plotCtx.moveTo(cx - R, cy); plotCtx.lineTo(cx + R, cy); plotCtx.moveTo(cx, cy - R); plotCtx.lineTo(cx, cy + R); plotCtx.stroke();
    plotCtx.strokeStyle = '#22c55e'; plotCtx.lineWidth = 3.5;
    plotCtx.beginPath();
    for (let k = 0; k <= 180; k++) {
      const th = (k / 180) * Math.PI;
      const rr = R * 0.5 * (1 + pMeas * Math.cos(2 * (th - thetaE)));
      const x = cx + rr * Math.cos(th), y = cy - rr * Math.sin(th);
      if (k === 0) plotCtx.moveTo(x, y); else plotCtx.lineTo(x, y);
    }
    plotCtx.closePath(); plotCtx.stroke();
    plotCtx.strokeStyle = '#f8fafc'; plotCtx.lineWidth = 3;
    plotCtx.beginPath(); plotCtx.moveTo(cx, cy);
    plotCtx.lineTo(cx + R * Math.cos(thetaAna), cy - R * Math.sin(thetaAna)); plotCtx.stroke();
    const rmk = R * 0.5 * (1 + pMeas * Math.cos(2 * (thetaAna - thetaE)));
    plotCtx.fillStyle = '#fbbf24';
    plotCtx.beginPath(); plotCtx.arc(cx + rmk * Math.cos(thetaAna), cy - rmk * Math.sin(thetaAna), 7, 0, TWO_PI); plotCtx.fill();
    plotCtx.fillStyle = '#94a3b8'; plotCtx.font = '20px "PingFang SC", sans-serif';
    plotCtx.fillText('检偏曲线 I(θ)=½I₀[1+Pcos2(θ−θ₀)]', 24, 26);
    plotCtx.fillStyle = '#22c55e';
    plotCtx.fillText(`θ_a=${(thetaAna * DEG).toFixed(0)}°  I/I₀=${iMeas.toFixed(3)}`, 24, 358);

    // ---- 右：Stokes Q–U 面（法拉第旋转 = 2Δθ 的刚体转动） ----
    const qx = 620, qy = 190, QR = 132;
    plotCtx.strokeStyle = '#475569'; plotCtx.lineWidth = 1.5;
    plotCtx.beginPath(); plotCtx.moveTo(qx - QR, qy); plotCtx.lineTo(qx + QR, qy);
    plotCtx.moveTo(qx, qy - QR); plotCtx.lineTo(qx, qy + QR); plotCtx.stroke();
    plotCtx.setLineDash([7, 7]);
    plotCtx.beginPath(); plotCtx.arc(qx, qy, QR * 0.92, 0, TWO_PI); plotCtx.stroke();
    plotCtx.setLineDash([]);
    const sc = (QR * 0.92) / P_MAX;
    // 本征（未旋转）矢量
    plotCtx.strokeStyle = '#fbbf24'; plotCtx.lineWidth = 3;
    plotCtx.beginPath(); plotCtx.moveTo(qx, qy);
    plotCtx.lineTo(qx + pInt * Math.cos(2 * PSI) * sc, qy - pInt * Math.sin(2 * PSI) * sc); plotCtx.stroke();
    // 旋转弧
    plotCtx.strokeStyle = 'rgba(168,85,247,0.75)'; plotCtx.lineWidth = 2.5;
    plotCtx.beginPath();
    plotCtx.arc(qx, qy, QR * 0.5, -2 * PSI, -2 * PSI - 2 * dTheta, true);
    plotCtx.stroke();
    // 实测 (Q,U)
    plotCtx.strokeStyle = '#a855f7'; plotCtx.lineWidth = 4;
    plotCtx.beginPath(); plotCtx.moveTo(qx, qy);
    plotCtx.lineTo(qx + stQ * sc, qy - stU * sc); plotCtx.stroke();
    plotCtx.fillStyle = '#f472b6';
    plotCtx.beginPath(); plotCtx.arc(qx + stQ * sc, qy - stU * sc, 7, 0, TWO_PI); plotCtx.fill();
    plotCtx.fillStyle = '#94a3b8'; plotCtx.font = '20px "PingFang SC", sans-serif';
    plotCtx.fillText('Stokes Q–U 面（角 = 2θ₀，长度 = I·P）', 424, 26);
    plotCtx.fillStyle = '#fbbf24'; plotCtx.fillText('Q', qx + QR - 16, qy - 8);
    plotCtx.fillStyle = '#a855f7';
    plotCtx.fillText(`(Q,U)=(${stQ.toFixed(4)}, ${stU.toFixed(4)})  转过 2Δθ=${(2 * dTheta * DEG).toFixed(0)}°`, 424, 358);
    plotTex.needsUpdate = true;
  }

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
  makeLabel('磁尘云：长轴 ⟂ B，消光偏振 E ∥ B⊥', '#fbbf24', 4.4, PATH_X, CLOUD_Y + 1.75, Z_CLOUD);
  makeLabel('法拉第屏 n_e、B_∥ ⇒ Δθ = RMλ²', '#22d3ee', 3.6, PATH_X, CLOUD_Y - 1.55, Z_SCREEN);
  makeLabel('检偏器 θ_a 扫描', '#22c55e', 2.6, PATH_X, CLOUD_Y - 1.55, Z_ANA);
  makeLabel('光度计', '#94a3b8', 1.8, PATH_X - 0.1, CLOUD_Y + 1.0, Z_DET);
  makeLabel('天空偏振矢量图（λ 越大越旋得乱 ⇒ 消偏振）', '#f472b6', 5.2, MAP_X, MAP_Y + 1.85, MAP_Z);

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
  infoPlane.position.set(0, 5.4, 0);
  group.add(infoPlane);

  const ln = (y: number, color: string, text: string, bold = false, size = 26): void => {
    infoCtx.fillStyle = color;
    infoCtx.font = `${bold ? 'bold ' : ''}${size}px "PingFang SC", sans-serif`;
    infoCtx.fillText(text, 22, y);
  };
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 900, 300);
    infoCtx.fillStyle = 'rgba(7,11,20,0.86)';
    infoCtx.fillRect(4, 4, 892, 292);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 892, 292);
    infoCtx.textAlign = 'left';

    ln(40, '#f8fafc', '天体偏振观测 —— 磁尘定向 · Malus 定律 · Stokes 参量 · 法拉第旋转', true);
    ln(76, '#22d3ee', `I(θ) = ½I₀[1 + P·cos2(θ−θ₀)] ⇒ I_max=${iMax.toFixed(4)}, I_min=${iMin.toFixed(4)}, P=(I_max−I_min)/(I_max+I_min)=${(pMeas * 100).toFixed(2)}%`);
    ln(108, '#a855f7', `Q = IPcos2θ₀ = ${stQ.toFixed(4)}  U = IPsin2θ₀ = ${stU.toFixed(4)}  V=0  ⇒ θ₀ = ½atan2(U,Q) = ${(((Math.atan2(stU, stQ) / 2) * DEG + 360) % 180).toFixed(1)}°`);
    ln(140, '#fbbf24', `RM = 0.81·n_e·B_∥·L = 0.81×${N_E}×${(B_MU * Math.cos(gamma)).toFixed(2)}×${L_PC} = ${rm.toFixed(1)} rad/m² ⇒ Δθ = RMλ² = ${(dTheta * DEG).toFixed(1)}°`);
    ln(172, '#22c55e', `差旋消偏振 P = P₀·e^{−2λ⁴σ_RM²}：P₀ = ${(pInt * 100).toFixed(2)}% → 因子 ${dep.toFixed(3)}；束内旋转弥散 σ_θ = λ²σ_RM = ${(sigmaRot * DEG).toFixed(0)}°`);

    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：λ=${(lam * 100).toFixed(1)} cm  γ(B,视线)=${(gamma * DEG).toFixed(0)}°  θ_a=${(thetaAna * DEG).toFixed(0)}°  I/I₀=${iMeas.toFixed(3)}  旋过 ${(dTheta / Math.PI).toFixed(2)} 半圈`,
      22, 212,
    );
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '21px "PingFang SC", sans-serif';
    infoCtx.fillText(
      dTheta > Math.PI
        ? 'nλ 二义：Δθ 超过半圈 ⇒ θ₀ 与 Δθ 相差 nπ 无法单波长区分，须多波长测 2θ₀ 对 λ² 拟合斜率 = 2RM。颗粒尺寸/云尺度为示意，波长、RM、λ²与 λ⁴ 律为真实量级。'
        : '短波长端 Δθ ≪ 1 且几乎不消偏振（λ²、λ⁴ 双重定标）；γ→0（B 沿视线）时 P→0：偏振只记录垂直于视线的磁场。',
      22, 262,
    );
    infoTex.needsUpdate = true;
  }

  // ============ 初始化 ============
  computeState();
  drawInfo();
  drawPlot();

  const bV = new THREE.Vector3();
  const uV = new THREE.Vector3();
  const vV = new THREE.Vector3();
  const aV = new THREE.Vector3();
  const qTmp = new THREE.Quaternion();
  function updateGrainField(): void {
    bV.set(Math.sin(gamma) * Math.cos(PSI), Math.sin(gamma) * Math.sin(PSI), Math.cos(gamma));
    const ref = Math.abs(bV.z) < 0.9 ? ZAX : YAX;
    uV.copy(ref).addScaledVector(bV, -ref.dot(bV)).normalize();
    vV.crossVectors(bV, uV).normalize();
    for (let i = 0; i < grains.length; i++) {
      aV.copy(uV).multiplyScalar(Math.cos(phi[i])).addScaledVector(vV, Math.sin(phi[i]));
      grains[i].quaternion.setFromUnitVectors(YAX, aV);   // 圆柱轴(局部 y) → 颗粒长轴 ⟂ B
    }
    fieldGrp.quaternion.setFromUnitVectors(ZAX, bV);
  }

  let frame = 0;
  return {
    update(t, dt) {
      // 自变量 1：波长 λ 在 3→18 cm 间对数扫描，周期 16 s
      const ph = 0.5 - 0.5 * Math.cos(((t % 16) / 16) * TWO_PI);
      lam = Math.pow(10, Math.log10(0.03) + ph * (Math.log10(0.18) - Math.log10(0.03)));
      // 自变量 2：磁场与视线夹角 γ 在 3°→60° 扫描，周期 12 s
      gamma = 0.05 + 0.99 * (1 - Math.cos(((t % 12) / 12) * TWO_PI)) / 2;
      // 仪器扫描：检偏器连续旋转
      thetaAna += dt * 0.75;
      if (thetaAna > TWO_PI) thetaAna -= TWO_PI;

      computeState();
      frame++;
      if (frame % 2 === 0) updateGrainField();

      // E 矢量箭头：源（非偏振，画十字两臂）→ 出云 → 过屏 → 过检偏器
      arrSrc.rotation.z = 0.6 * t;             // 非偏振：振动方向快速随机变化
      arrSrc.scale.set(0.6, 0.6, 1);
      arrSrc2.rotation.z = 0.6 * t + Math.PI / 2;
      arrSrc2.scale.set(0.6, 0.6, 1);
      arrPre.rotation.z = PSI;
      arrPre.scale.set(0.62, 0.62, 1);
      arrPost.rotation.z = thetaE;
      arrPost.scale.set(0.62, 0.62, 1);
      const proj = Math.abs(Math.cos(thetaAna - thetaE));
      arrOut.rotation.z = thetaAna;
      arrOut.scale.set(0.12 + 0.78 * proj, 0.5, 1);
      (arrOut.material as import('three').LineBasicMaterial).opacity = 0.35 + 0.65 * proj;

      // 探测器读数：亮度 ∝ I(θ_a)；屏的电离感随消偏振强度变亮
      detMat.emissiveIntensity = 0.12 + 2.6 * iMeas;
      (screen.material as import('three').MeshStandardMaterial).opacity = 0.1 + 0.16 * dep;

      // 矢量图：每个单元被独立旋过 λ²σ_RM 的弥散 ⇒ 净矢量变短
      for (let i = 0; i < cellArrows.length; i++) {
        cellArrows[i].rotation.z = thetaE + cellW[i] * sigmaRot;
        cellArrows[i].scale.set(0.24, 0.24, 1);
      }
      netArrow.rotation.z = thetaE;
      netArrow.scale.setScalar(0.35 + 7.5 * pMeas);

      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) {
        drawInfo();
        drawPlot();
      }
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
