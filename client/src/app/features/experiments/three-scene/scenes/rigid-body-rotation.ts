import type { SceneContext, SceneInstance } from '../types';

/**
 * 刚体转动与转动惯量（P50）。左舞台＝欧拉方程/网球拍定理，右舞台＝形状→I、平行轴、力矩臂三段轮播。
 *
 * —— 左舞台：欧拉方程（无外力矩自由转动）——
 *   I₁ω̇₁=(I₂−I₃)ω₂ω₃，I₂ω̇₂=(I₃−I₁)ω₃ω₁，I₃ω̇₃=(I₁−I₂)ω₁ω₂
 *   长方体边 (a,b,c)=(2.0,1.2,0.6)m、m=1.0kg ⇒ I₁=m(b²+c²)/12=0.150，I₂=m(a²+c²)/12=0.363，I₃=m(a²+b²)/12=0.453
 *   网球拍定理：绕最大/最小主轴稳定；绕中间主轴指数发散 σ=Ω·√((I₃−I₂)(I₂−I₁)/(I₁I₃))=1.59 s⁻¹
 *   初值必须带横向微扰 ω₀=Ω(1,ε,ε)、ε=0.02，翻转才会真发生：ε=0 时右端恒 0，中间轴也不翻转、三条轴画面同貌。
 *   数值：RK4 子步（h≤6ms）。一次性积分核对 _scratch/r4fix/rigid/euler-check.mjs：
 *     绕 I₁ 最大偏离 3.4°（稳定）；绕 I₂ 于 4.49s 越过 89°、最大偏离 168°（翻转）；绕 I₃ 3.3°（稳定）；ΔE~8e-15、ΔL~4e-15；
 *     ε=0 对照组三轴偏离均为 0（复现旧 bug）。
 *   姿态：积分出的 (wx,wy,wz) 是体（主轴）系分量 ω_body，ω_world=R·ω_body 后再绕 ω_world 转 |ω|·h。
 *
 * —— 右舞台：三段轮播（每段 12s，周期 36s）——
 *   ① 同力矩比形状：τ=0.80N·m、m=1.0kg、L=2.0m、R=1.0m
 *      细杆(端轴) I=mL²/3=1.333→α=0.60；圆盘(对称轴) I=mR²/2=0.500→α=1.60；球壳 I=2mR²/3=0.667→α=1.20 rad/s²
 *      每 6s 一轮：从静止推 4.5s（ω=αt、θ=½αt²）→ 撤力矩滑行 1.5s（ω 守恒）→ 重置
 *   ② 平行轴定理：细杆 I=I_cm+md²，I_cm=mL²/12=0.3333；转轴逐档 d=0→0.50→1.00（d=L/2 时 I=mL²/3=1.3333，与①的端轴细杆同一个数）
 *      同 τ=0.25N·m、同推击 2.2s ⇒ 解析 θ=½(τ/I)t²=1.815/1.038/0.454 rad；画面逐步积分实测 1.83/1.05/0.47rad=105°/60°/27°（残影射线对比）
 *   ③ 门绕铰链：I_door=(1/3)mW²=2.560（m=3.0kg、W=1.60m）；F=10.0N 恒定、推击 Δt=0.80s
 *      τ=F·d ⇒ d=0.30/0.70/1.10/1.50m → α=1.172/2.734/4.297/5.859 rad/s² → θ=21.5°/50.1°/78.8°/107.4°（远铰省力）
 *   面板读数与几何同源：转角=½αt²、条高=ω、弧长=θ，全部由同一状态量算出，不另写一套数。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  // —— 资源登记 ——
  const geos: { dispose(): void }[] = [];
  const mats: { dispose(): void }[] = [];
  const texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  type Grp = import('three').Group;
  type Mesh = import('three').Mesh;
  type Attr = import('three').BufferAttribute;
  const UPV = new THREE.Vector3(0, 1, 0);
  const TMPV = new THREE.Vector3();
  const TMPQ = new THREE.Quaternion();
  const DEG = 180 / Math.PI;

  // ═══════════ 物理常量（几何与面板共用同一批数） ═══════════
  const M_BOX = 1.0, A_LEN = 2.0, B_LEN = 1.2, C_LEN = 0.6;
  const IP = [
    (M_BOX * (B_LEN * B_LEN + C_LEN * C_LEN)) / 12, // I₁ 最小（绕最长边 a=x）
    (M_BOX * (A_LEN * A_LEN + C_LEN * C_LEN)) / 12, // I₂ 中间
    (M_BOX * (A_LEN * A_LEN + B_LEN * B_LEN)) / 12, // I₃ 最大
  ];
  const OMEGA0 = 3.0;      // 主轴初角速度 rad/s
  const EPS = 0.02;        // 横向微扰 —— 翻转的开关（ε=0 则永不翻转）
  const AXIS_T = 6.0;      // 每条轴的窗口（RK4 核对：中间轴 4.49s 越 89°）
  const AXIS_NAMES = ['I₁ 最小主轴 (x·红)', 'I₂ 中间主轴 (y·绿)', 'I₃ 最大主轴 (z·蓝)'];
  const AXIS_CSS = ['#ef4444', '#22c55e', '#3b82f6'];
  const SIGMA = OMEGA0 * Math.sqrt(((IP[2] - IP[1]) * (IP[1] - IP[0])) / (IP[0] * IP[2]));
  const T_GROW = Math.log(1 / EPS) / SIGMA;

  const M_KG = 1.0, L_ROD = 2.0, RAD = 1.0;
  const I_ROD_END = (M_KG * L_ROD * L_ROD) / 3;
  const I_DISK = (M_KG * RAD * RAD) / 2;
  const I_SHELL = (2 / 3) * M_KG * RAD * RAD;
  const TAU1 = 0.8, RUN1 = 6.0, PUSH1 = 4.5, BAR_MAX = 8.0, BAR_H = 1.4;

  const I_ROD_CM = (M_KG * L_ROD * L_ROD) / 12;
  const D_HALF = L_ROD / 2;
  const I_END_FROM_PAR = I_ROD_CM + M_KG * D_HALF * D_HALF; // = mL²/3，与①同数
  const D_STEPS = [0, 0.5, 1.0];
  const TAU2 = 0.25, PER2 = 4.0, SLIDE2 = 0.8, PUSH2 = 2.2;

  const M_DOOR = 3.0, W_DOOR = 1.6, H_DOOR = 2.2;
  const I_DOOR = (M_DOOR * W_DOOR * W_DOOR) / 3;
  const F_PUSH = 10.0, DT_PUSH = 0.8;
  const D_DOOR = [0.3, 0.7, 1.1, 1.5];
  const PER3 = 3.0;
  const STEP_CSS = ['#60a5fa', '#fbbf24', '#f472b6', '#22c55e'];

  // ═══════════ 画布面板工具 ═══════════
  type Live = { c: CanvasRenderingContext2D; t: import('three').CanvasTexture; mesh: Mesh; w: number; h: number };
  function makeLive(ww: number, wh: number, cw: number, ch: number): Live {
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const c = cv.getContext('2d')!;
    const t = tex(new THREE.CanvasTexture(cv));
    const mesh = new THREE.Mesh(
      geo(new THREE.PlaneGeometry(ww, wh)),
      mat(new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false })),
    );
    mesh.renderOrder = 999;
    return { c, t, mesh, w: cw, h: ch };
  }
  function panelBg(l: Live): void {
    const c = l.c;
    c.clearRect(0, 0, l.w, l.h);
    c.fillStyle = 'rgba(7,11,20,0.86)';
    c.fillRect(0, 0, l.w, l.h);
    c.strokeStyle = '#334155';
    c.lineWidth = 4;
    c.strokeRect(4, 4, l.w - 8, l.h - 8);
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
  }
  function txt(l: Live, s: string, x: number, y: number, color: string, px: number, bold = false): void {
    l.c.fillStyle = color;
    l.c.font = (bold ? 'bold ' : '') + px + 'px "PingFang SC", monospace, sans-serif';
    l.c.fillText(s, x, y);
  }
  function makeLabel(text: string, color: string, worldW: number): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 30px "PingFang SC", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const sp = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    sp.scale.set(worldW, (worldW * 64) / 512, 1);
    return sp;
  }
  // 直线箭头：两点缓冲 + 锥尖
  function setArrow(attr: Attr, tip: Mesh, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, len: number): void {
    const a = attr.array as Float32Array;
    const dl = Math.hypot(dx, dy, dz) || 1;
    const ux = dx / dl, uy = dy / dl, uz = dz / dl;
    a[0] = ox; a[1] = oy; a[2] = oz;
    a[3] = ox + ux * len; a[4] = oy + uy * len; a[5] = oz + uz * len;
    attr.needsUpdate = true;
    tip.position.set(ox + ux * (len - 0.15), oy + uy * (len - 0.15), oz + uz * (len - 0.15));
    tip.quaternion.setFromUnitVectors(UPV, TMPV.set(ux, uy, uz));
  }
  function makeArrow(color: number, parent: Grp): { attr: Attr; tip: Mesh } {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    parent.add(new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color }))));
    const tip = new THREE.Mesh(geo(new THREE.ConeGeometry(0.08, 0.32, 12)), mat(new THREE.MeshBasicMaterial({ color })));
    parent.add(tip);
    return { attr: g.attributes['position'] as Attr, tip };
  }
  // 圆心在 (cx,yy,0)、从 +x 扫到 theta 的水平弧
  function setArc(attr: Attr, rr: number, yy: number, cx: number, seg: number, theta: number): void {
    const a = attr.array as Float32Array;
    const total = Math.max(0, Math.min(Math.PI * 2, Math.abs(theta)));
    for (let j = 0; j <= seg; j++) {
      const ang = (total * j) / seg;
      a[j * 3] = cx + rr * Math.cos(ang);
      a[j * 3 + 1] = yy;
      a[j * 3 + 2] = rr * Math.sin(ang);
    }
    attr.needsUpdate = true;
  }
  function makeArc(color: number, rr: number, yy: number, cx: number, seg: number, parent: Grp): Attr {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((seg + 1) * 3), 3));
    g.setDrawRange(0, seg + 1);
    parent.add(new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color }))));
    return g.attributes['position'] as Attr;
  }
  function makeCircle(color: number, rr: number, yy: number, cx: number, parent: Grp, op = 0.25): void {
    const seg = 64;
    const g = geo(new THREE.BufferGeometry());
    const p = new Float32Array((seg + 1) * 3);
    for (let j = 0; j <= seg; j++) {
      const ang = ((Math.PI * 2) * j) / seg;
      p[j * 3] = cx + rr * Math.cos(ang); p[j * 3 + 1] = yy; p[j * 3 + 2] = rr * Math.sin(ang);
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    parent.add(new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color, transparent: true, opacity: op }))));
  }
  function setRay(attr: Attr, rr: number, yy: number, theta: number): void {
    const a = attr.array as Float32Array;
    a[0] = 0; a[1] = yy; a[2] = 0;
    a[3] = rr * Math.cos(theta); a[4] = yy; a[5] = rr * Math.sin(theta);
    attr.needsUpdate = true;
  }

  // ═══════════ 星野 / 地面栅格 ═══════════
  const starGeo = geo(new THREE.BufferGeometry());
  const starPos = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 200;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starPoints = new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true })));
  group.add(starPoints);
  const gridH = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  gridH.position.y = -3.4;
  geo(gridH.geometry);
  (Array.isArray(gridH.material) ? gridH.material : [gridH.material]).forEach((m) => mat(m));
  group.add(gridH);

  // ═══════════ 左舞台：欧拉方程 / 网球拍定理 ═══════════
  const rigA = new THREE.Group();
  rigA.position.set(-5.2, 1.15, 0);
  group.add(rigA);

  const boxGeo = geo(new THREE.BoxGeometry(A_LEN, B_LEN, C_LEN));
  const boxMat = mat(new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.2, metalness: 0.3, roughness: 0.4 }));
  const box = new THREE.Mesh(boxGeo, boxMat);
  rigA.add(box);
  const cornerMesh = new THREE.Mesh(geo(new THREE.SphereGeometry(0.11, 12, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })));
  rigA.add(cornerMesh);

  // 三条主轴指示（红=I₁ 最小、绿=I₂ 中间、蓝=I₃ 最大）
  const AXIS_SPAN = 1.75;
  const axGeoX = geo(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-AXIS_SPAN, 0, 0), new THREE.Vector3(AXIS_SPAN, 0, 0)]));
  const axGeoY = geo(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -AXIS_SPAN, 0), new THREE.Vector3(0, AXIS_SPAN, 0)]));
  const axGeoZ = geo(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -AXIS_SPAN), new THREE.Vector3(0, 0, AXIS_SPAN)]));
  const matAxX = mat(new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.8 }));
  const matAxY = mat(new THREE.LineBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.8 }));
  const matAxZ = mat(new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.8 }));
  rigA.add(new THREE.Line(axGeoX, matAxX), new THREE.Line(axGeoY, matAxY), new THREE.Line(axGeoZ, matAxZ));

  const TRAIL_N = 300;
  const trailGeo = geo(new THREE.BufferGeometry());
  const trailPos = new Float32Array(TRAIL_N * 3);
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setDrawRange(0, 0);
  rigA.add(new THREE.Points(trailGeo, mat(new THREE.PointsMaterial({ color: 0xf472b6, size: 0.06, transparent: true, opacity: 0.55 }))));
  let trailHead = 0;

  const wArrow = makeArrow(0xfbbf24, rigA);
  // 体心 ω 矢量 + 角点轨迹之外，再加一张"偏离角 vs 时间"实测曲线
  const CH_X0 = -1.5, CH_X1 = 1.5, CH_Y0 = -2.75, CH_Y1 = -0.95, CH_Z = 1.9;
  const chartGeo = geo(new THREE.BufferGeometry());
  const chartPos = new Float32Array(160 * 3);
  chartGeo.setAttribute('position', new THREE.BufferAttribute(chartPos, 3));
  chartGeo.setDrawRange(0, 0);
  rigA.add(new THREE.Line(chartGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 }))));
  let chartN = 0;
  const chartFrameGeo = geo(new THREE.BufferGeometry());
  {
    const pts: number[] = [];
    const push = (ax: number, ay: number, bx: number, by: number): void => { pts.push(ax, ay, CH_Z, bx, by, CH_Z); };
    push(CH_X0, CH_Y0, CH_X1, CH_Y0);
    push(CH_X1, CH_Y0, CH_X1, CH_Y1);
    push(CH_X1, CH_Y1, CH_X0, CH_Y1);
    push(CH_X0, CH_Y1, CH_X0, CH_Y0);
    const yMid = CH_Y0 + (CH_Y1 - CH_Y0) * 0.5;   // 90° 参考线
    push(CH_X0, yMid, CH_X1, yMid);
    chartFrameGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  }
  rigA.add(new THREE.LineSegments(chartFrameGeo, mat(new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.9 }))));
  const lblChart0 = makeLabel('偏离角 0°', '#64748b', 1.5);
  lblChart0.position.set(CH_X0 - 0.75, CH_Y0, CH_Z);
  const lblChart180 = makeLabel('180°（翻转）', '#f472b6', 1.9);
  lblChart180.position.set(CH_X0 - 0.95, CH_Y1, CH_Z);
  const lblChartT = makeLabel(`一条轴窗口 ${AXIS_T}s`, '#64748b', 2.2);
  lblChartT.position.set(0, CH_Y0 - 0.35, CH_Z);
  rigA.add(lblChart0, lblChart180, lblChartT);

  const panelA = makeLive(7.2, 3.6, 720, 360);
  panelA.mesh.position.set(-5.2, 4.95, 0);
  group.add(panelA.mesh);

  // —— 欧拉积分状态 ——
  const wBody = [0, 0, 0];
  const w0Dir = new THREE.Vector3(1, 0, 0);
  let axisIdx = -1, axisT = 0;
  let devNow = 0, devMax = 0, flipAt = -1, omegaAbs = 0;
  let seriesFrame = 0;
  let clock = 0;

  const k1 = [0, 0, 0], k2 = [0, 0, 0], k3 = [0, 0, 0], k4 = [0, 0, 0], tv = [0, 0, 0];
  function accel(src: number[], out: number[]): void {
    out[0] = ((IP[1] - IP[2]) * src[1] * src[2]) / IP[0];
    out[1] = ((IP[2] - IP[0]) * src[2] * src[0]) / IP[1];
    out[2] = ((IP[0] - IP[1]) * src[0] * src[1]) / IP[2];
  }
  function rk4(w: number[], h: number): void {
    accel(w, k1);
    for (let i = 0; i < 3; i++) tv[i] = w[i] + 0.5 * h * k1[i];
    accel(tv, k2);
    for (let i = 0; i < 3; i++) tv[i] = w[i] + 0.5 * h * k2[i];
    accel(tv, k3);
    for (let i = 0; i < 3; i++) tv[i] = w[i] + h * k3[i];
    accel(tv, k4);
    for (let i = 0; i < 3; i++) w[i] += (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  }
  function setAxis(ax: number): void {
    axisIdx = ax;
    axisT = 0;
    devNow = 0; devMax = 0; flipAt = -1;
    chartN = 0;
    trailHead = 0;
    trailGeo.setDrawRange(0, 0);
    chartGeo.setDrawRange(0, 0);
    // 微扰初值：ω₀ = Ω·(1,ε,ε) 取被驱动轴为主分量
    for (let i = 0; i < 3; i++) wBody[i] = EPS * OMEGA0;
    wBody[ax] = OMEGA0;
    w0Dir.set(EPS * OMEGA0, EPS * OMEGA0, EPS * OMEGA0);
    w0Dir.setComponent(ax, OMEGA0);
    w0Dir.normalize();
    box.quaternion.identity();
  }
  function updateEuler(dt: number): void {
    const axNow = Math.floor(clock / AXIS_T) % 3;
    if (axNow !== axisIdx) setAxis(axNow);
    const n = Math.max(1, Math.ceil(dt / 0.006));
    const h = dt / n;
    for (let s = 0; s < n; s++) {
      rk4(wBody, h);
      const wm = Math.hypot(wBody[0], wBody[1], wBody[2]);
      if (wm > 1e-9) {
        TMPV.set(wBody[0], wBody[1], wBody[2]).applyQuaternion(box.quaternion);
        box.quaternion.premultiply(TMPQ.setFromAxisAngle(TMPV.divideScalar(wm), wm * h));
      }
    }
    axisT += dt;
    TMPV.set(wBody[0], wBody[1], wBody[2]);
    omegaAbs = TMPV.length() || 1;
    devNow = Math.acos(Math.max(-1, Math.min(1, TMPV.dot(w0Dir) / omegaAbs))) * DEG;
    if (devNow > devMax) devMax = devNow;
    if (flipAt < 0 && devNow > 90) flipAt = axisT;
    // 实测曲线：偏离角 vs 窗口时间
    seriesFrame++;
    if (seriesFrame % 3 === 0 && chartN < 160) {
      const cp = chartGeo.attributes['position'] as Attr;
      const ca = cp.array as Float32Array;
      ca[chartN * 3] = CH_X0 + (CH_X1 - CH_X0) * Math.min(1, axisT / AXIS_T);
      ca[chartN * 3 + 1] = CH_Y0 + (CH_Y1 - CH_Y0) * (Math.min(180, devNow) / 180);
      ca[chartN * 3 + 2] = CH_Z;
      chartN++;
      cp.needsUpdate = true;
      chartGeo.setDrawRange(0, chartN);
    }
    // ω 矢量（世界系）
    TMPV.set(wBody[0], wBody[1], wBody[2]).applyQuaternion(box.quaternion);
    setArrow(wArrow.attr, wArrow.tip, 0, 0, 0, TMPV.x, TMPV.y, TMPV.z, 1.5);
    // 角点轨迹
    TMPV.set(A_LEN / 2, B_LEN / 2, C_LEN / 2).applyQuaternion(box.quaternion);
    const tp = trailGeo.attributes['position'] as Attr;
    const arr = tp.array as Float32Array;
    const idx = (trailHead % TRAIL_N) * 3;
    arr[idx] = TMPV.x; arr[idx + 1] = TMPV.y; arr[idx + 2] = TMPV.z;
    tp.needsUpdate = true;
    trailHead++;
    trailGeo.setDrawRange(0, Math.min(TRAIL_N, trailHead));
    cornerMesh.position.copy(TMPV);
  }

  // ═══════════ 右舞台 ①：同力矩下 形状→I→α ═══════════
  const rigT = new THREE.Group();
  rigT.position.set(5.4, 1.15, 0);
  group.add(rigT);
  const trioGrp = new THREE.Group();
  rigT.add(trioGrp);
  const axisShaftGeo = geo(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -1.6, 0), new THREE.Vector3(0, 1.5, 0)]));
  const barGeo = geo(new THREE.CylinderGeometry(0.1, 0.1, 1, 10));
  barGeo.translate(0, 0.5, 0);
  const spokeGeo = geo(new THREE.BufferGeometry());
  {
    const p = new Float32Array(6 * 3);
    for (let k = 0; k < 3; k++) {
      const ang = (k * Math.PI) / 3;
      const ux = Math.cos(ang) * RAD * 0.96, uz = Math.sin(ang) * RAD * 0.96;
      p[k * 6] = ux; p[k * 6 + 1] = 0.08; p[k * 6 + 2] = uz;
      p[k * 6 + 3] = -ux; p[k * 6 + 4] = 0.08; p[k * 6 + 5] = -uz;
    }
    spokeGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  }

  type Body = {
    name: string; iVal: number; iFormula: string; tipR: number; x0: number; arcR: number;
    pivot: Grp; bar: Mesh; arcAttr: Attr; arrow: { attr: Attr; tip: Mesh };
    alpha: number; fTan: number; omega: number; theta: number;
  };
  const bodies: Body[] = [];
  function makeBody(
    name: string, iFormula: string, iVal: number, tipR: number, x0: number, arcR: number,
    color: number, build: (p: Grp) => void,
  ): Body {
    const pivot = new THREE.Group();
    pivot.position.set(x0, 0, 0);
    trioGrp.add(pivot);
    pivot.add(new THREE.Line(axisShaftGeo, mat(new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.85 }))));
    build(pivot);
    // 非旋转系里的读数件（条高=ω、弧=θ）
    const bar = new THREE.Mesh(barGeo, mat(new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35 })));
    bar.position.set(x0 + 1.3, -1.9, 0);
    bar.scale.y = 0.001;
    trioGrp.add(bar);
    makeCircle(color, arcR, -0.85, x0, trioGrp, 0.22);
    const arcAttr = makeArc(color, arcR, -0.85, x0, 28, trioGrp);
    const arrow = makeArrow(0x22d3ee, pivot);
    const lb = makeLabel(name, '#cbd5e1', 2.8);
    lb.position.set(x0, 1.85, 0);
    trioGrp.add(lb);
    return { name, iVal, iFormula, tipR, x0, arcR, pivot, bar, arcAttr, arrow, alpha: TAU1 / iVal, fTan: TAU1 / tipR, omega: 0, theta: 0 };
  }
  bodies.push(makeBody('细杆 I=mL²/3', 'mL²/3', I_ROD_END, L_ROD, -3.6, 1.15, 0xfbbf24, (p) => {
    const rod = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.075, 0.075, L_ROD, 12)), mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.35, roughness: 0.45 })));
    rod.rotation.z = -Math.PI / 2;   // 杆轴 → +x
    rod.position.x = L_ROD / 2;       // 一端落在转轴上 ⇒ 端轴细杆 I=mL²/3
    p.add(rod);
    const tipDot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.1, 10, 10)), mat(new THREE.MeshBasicMaterial({ color: 0xfde68a })));
    tipDot.position.set(L_ROD, 0, 0);
    p.add(tipDot);
  }));
  bodies.push(makeBody('圆盘 I=mR²/2', 'mR²/2', I_DISK, RAD, 0, 0.85, 0x22d3ee, (p) => {
    const disk = new THREE.Mesh(geo(new THREE.CylinderGeometry(RAD, RAD, 0.13, 40)), mat(new THREE.MeshStandardMaterial({ color: 0x0e7490, metalness: 0.3, roughness: 0.5 })));
    p.add(disk);
    p.add(new THREE.LineSegments(spokeGeo, mat(new THREE.LineBasicMaterial({ color: 0x67e8f9 }))));
  }));
  bodies.push(makeBody('球壳 I=2mR²/3', '2mR²/3', I_SHELL, RAD, 3.6, 0.85, 0xa855f7, (p) => {
    const sphGeo = geo(new THREE.SphereGeometry(RAD, 24, 16));
    p.add(new THREE.Mesh(sphGeo, mat(new THREE.MeshStandardMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.55, side: THREE.DoubleSide }))));
    p.add(new THREE.Mesh(sphGeo, mat(new THREE.MeshBasicMaterial({ color: 0xd8b4fe, wireframe: true, transparent: true, opacity: 0.3 }))));
    // 子午环：默认在 XY 面（含竖直转轴）⇒ 绕 Y 转时看得见
    p.add(new THREE.Mesh(geo(new THREE.TorusGeometry(RAD + 0.015, 0.022, 8, 44)), mat(new THREE.MeshBasicMaterial({ color: 0xa855f7 }))));
  }));
  const barBaseGeo = geo(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-5.1, -1.91, 0), new THREE.Vector3(5.6, -1.91, 0)]));
  trioGrp.add(new THREE.Line(barBaseGeo, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));
  const barLbl = makeLabel('条高 = 实时 ω (rad/s)，弧 = 转角 θ', '#94a3b8', 4.4);
  barLbl.position.set(0.3, -2.45, 0);
  trioGrp.add(barLbl);
  const lblTrio = makeLive(6.9, 1.5, 1000, 218);
  lblTrio.mesh.position.set(5.4, -2.75, 0);
  group.add(lblTrio.mesh);

  // ═══════════ 右舞台 ②：平行轴定理 I=I_cm+md² ═══════════
  const parGrp = new THREE.Group();
  parGrp.position.set(-0.9, 1.15, 0);
  rigT.add(parGrp);
  const parPivot = new THREE.Group();
  parGrp.add(parPivot);
  const parRod = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.075, 0.075, L_ROD, 12)), mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.35, roughness: 0.45 })));
  parRod.rotation.z = -Math.PI / 2;
  parPivot.add(parRod);
  const cmMesh = new THREE.Mesh(geo(new THREE.SphereGeometry(0.12, 12, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })));
  parPivot.add(cmMesh);
  const parArmGeo = geo(new THREE.BufferGeometry());
  parArmGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  parPivot.add(new THREE.Line(parArmGeo, mat(new THREE.LineBasicMaterial({ color: 0xf472b6 }))));
  const parAxisGeo = geo(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -1.6, 0), new THREE.Vector3(0, 1.5, 0)]));
  parGrp.add(new THREE.Line(parAxisGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee }))));
  const parArrow = makeArrow(0x22d3ee, parPivot);
  const parBar = new THREE.Mesh(barGeo, mat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.35 })));
  parBar.position.set(2.1, -1.9, 0);
  parBar.scale.y = 0.001;
  parGrp.add(parBar);
  makeCircle(0xfbbf24, 1.7, -0.85, 0, parGrp, 0.2);
  const parArcAttr = makeArc(0xfbbf24, 1.7, -0.85, 0, 32, parGrp);
  const ghostPar: Attr[] = [];
  for (let i = 0; i < D_STEPS.length; i++) {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    parGrp.add(new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color: [0x60a5fa, 0xfbbf24, 0x22c55e][i], transparent: true, opacity: 0.65 }))));
    ghostPar.push(g.attributes['position'] as Attr);
    setRay(g.attributes['position'] as Attr, 1.5, 1.35, 0);
  }
  const parLbls = [
    makeLabel('青线=转轴', '#22d3ee', 1.8),
    makeLabel('粉点=质心 C', '#f472b6', 1.9),
    makeLabel('虚线射线=各档推完 2.2s 的定格转角', '#94a3b8', 4.6),
  ];
  parLbls[0].position.set(-0.7, 1.6, 0);
  parLbls[1].position.set(0.9, 0.55, 0);
  parLbls[2].position.set(0.4, 1.85, 0);
  parGrp.add(parLbls[0], parLbls[1], parLbls[2]);
  const lblPar = makeLive(6.9, 1.5, 1000, 218);
  lblPar.mesh.position.set(0.6, -2.75, 0);
  group.add(lblPar.mesh);

  let p2Prev = -1, p2D = 0, p2Omega = 0, p2Theta = 0;
  const p2Achieved = [0, 0, 0];

  // ═══════════ 右舞台 ③：门 τ=F·d（推边缘省力） ═══════════
  const doorGrp = new THREE.Group();
  doorGrp.position.set(-1.3, 1.15, 0);
  rigT.add(doorGrp);
  const hingeMesh = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.07, 0.07, 3.0, 12)), mat(new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6, roughness: 0.4 })));
  doorGrp.add(hingeMesh);
  const doorPivot = new THREE.Group();
  doorGrp.add(doorPivot);
  const doorMesh = new THREE.Mesh(geo(new THREE.BoxGeometry(W_DOOR, H_DOOR, 0.09)), mat(new THREE.MeshStandardMaterial({ color: 0xb45309, emissive: 0x7c2d12, emissiveIntensity: 0.15, metalness: 0.2, roughness: 0.6 })));
  doorMesh.position.set(W_DOOR / 2, 0, 0);
  doorPivot.add(doorMesh);
  const knobMesh = new THREE.Mesh(geo(new THREE.SphereGeometry(0.1, 10, 10)), mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee })));
  knobMesh.position.set(W_DOOR - 0.16, 0, 0.09);
  doorPivot.add(knobMesh);
  const doorArmGeo = geo(new THREE.BufferGeometry());
  doorArmGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  doorPivot.add(new THREE.Line(doorArmGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee }))));
  const doorArrow = makeArrow(0xf472b6, doorPivot);
  makeCircle(0x94a3b8, 1.2, -1.35, 0, doorGrp, 0.2);
  const doorArcAttr = makeArc(0x22d3ee, 1.2, -1.35, 0, 40, doorGrp);
  const ghostDoor: Attr[] = [];
  for (let i = 0; i < D_DOOR.length; i++) {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    doorGrp.add(new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color: [0x60a5fa, 0xfbbf24, 0xf472b6, 0x22c55e][i], transparent: true, opacity: 0.75 }))));
    ghostDoor.push(g.attributes['position'] as Attr);
    setRay(g.attributes['position'] as Attr, W_DOOR + 0.2, 1.3, 0);
  }
  const doorLbls = [
    makeLabel('铰链（转轴）', '#94a3b8', 1.9),
    makeLabel('粉箭头=推力 F（长度恒定）', '#f472b6', 3.6),
    makeLabel('青线=力臂 d，弧/射线=转角', '#22d3ee', 3.8),
  ];
  doorLbls[0].position.set(0, 1.75, 0);
  doorLbls[1].position.set(1.2, 0.95, 0.4);
  doorLbls[2].position.set(0.7, -0.6, 0);
  doorGrp.add(doorLbls[0], doorLbls[1], doorLbls[2]);
  const lblDoor = makeLive(6.9, 1.5, 1000, 218);
  lblDoor.mesh.position.set(0.6, -2.75, 0);
  group.add(lblDoor.mesh);

  const panelB = makeLive(7.2, 3.6, 720, 360);
  panelB.mesh.position.set(5.4, 4.95, 0);
  group.add(panelB.mesh);

  const doorAngleNow = (): number => {
    const seg = Math.min(D_DOOR.length - 1, Math.floor(((clock % 36) - 24) / PER3));
    const lt = (clock % 36) - 24 - seg * PER3;
    const alpha = (F_PUSH * D_DOOR[seg]) / I_DOOR;
    const tEnd = Math.min(lt, DT_PUSH);
    return 0.5 * alpha * tEnd * tEnd;
  };

  // ═══════════ 右舞台推进 ═══════════
  let lastActShown = -1;
  function updateStage(dt: number): void {
    const cyc = clock % 36;
    const act = Math.floor(cyc / 12);
    const local = cyc - act * 12;
    trioGrp.visible = act === 0;
    parGrp.visible = act === 1;
    doorGrp.visible = act === 2;
    lblTrio.mesh.visible = act === 0;
    lblPar.mesh.visible = act === 1;
    lblDoor.mesh.visible = act === 2;
    if (act !== lastActShown) {
      lastActShown = act;
      p2Prev = -1; p2Omega = 0; p2Theta = 0; p2D = 0;
      for (let i = 0; i < p2Achieved.length; i++) p2Achieved[i] = 0;
      for (const g of ghostPar) setRay(g, 1.5, 1.35, 0);
      for (const g of ghostDoor) setRay(g, W_DOOR + 0.2, 1.3, 0);
    }

    if (act === 0) {
      const runT = local % RUN1;
      const tPush = Math.min(runT, PUSH1);
      for (const b of bodies) {
        b.omega = b.alpha * tPush;
        b.theta = 0.5 * b.alpha * tPush * tPush + b.alpha * PUSH1 * Math.max(0, runT - PUSH1);
        b.pivot.rotation.y = b.theta;
        b.bar.scale.y = Math.max(0.001, (b.omega / BAR_MAX) * BAR_H);
        setArc(b.arcAttr, b.arcR, -0.85, b.x0, 28, b.theta);
        setArrow(b.arrow.attr, b.arrow.tip, b.tipR, 0.32, 0, 0, 0, 1, 0.4 + b.fTan * 0.7);
      }
      return;
    }

    if (act === 1) {
      const seg = Math.min(D_STEPS.length - 1, Math.floor(local / PER2));
      const lt = local - seg * PER2;
      if (seg !== p2Prev) {
        p2Prev = seg;
        p2Omega = 0;
        p2Theta = 0;
      }
      if (lt < SLIDE2) p2D += (D_STEPS[seg] - p2D) * Math.min(1, dt * 5); // 转轴滑到本档（此间不施力矩）
      else p2D = D_STEPS[seg];
      const aNow = TAU2 / (I_ROD_CM + M_KG * p2D * p2D);
      const pushing = lt >= SLIDE2 && lt < SLIDE2 + PUSH2;
      if (pushing) {
        p2Omega += aNow * dt;
        p2Theta += p2Omega * dt;
      } else if (lt >= SLIDE2 + PUSH2) {
        p2Achieved[seg] = p2Theta;                            // 本档推击结束：定格
      }
      parPivot.rotation.y = p2Theta;
      parRod.position.x = p2D;                                // 杆心（质心）离轴 d
      cmMesh.position.set(p2D, 0, 0);
      const aa = parArmGeo.attributes['position'] as Attr;
      const av = aa.array as Float32Array;
      av[0] = 0; av[1] = 0.72; av[2] = 0;
      av[3] = p2D; av[4] = 0.72; av[5] = 0;
      aa.needsUpdate = true;
      setArrow(parArrow.attr, parArrow.tip, p2D + 0.85, 0.35, 0, 0, 0, 1, pushing ? 0.95 : 0.25);
      parBar.scale.y = Math.max(0.001, (p2Omega / BAR_MAX) * BAR_H);
      setArc(parArcAttr, 1.7, -0.85, 0, 32, p2Theta);
      for (let i = 0; i < ghostPar.length; i++) if (p2Achieved[i] > 0) setRay(ghostPar[i], 1.5, 1.35, p2Achieved[i]);
      return;
    }

    const seg = Math.min(D_DOOR.length - 1, Math.floor(local / PER3));
    const lt = local - seg * PER3;
    const d = D_DOOR[seg];
    const alpha = (F_PUSH * d) / I_DOOR;
    const tEnd = Math.min(lt, DT_PUSH);
    const th = 0.5 * alpha * tEnd * tEnd;                     // 推击 Δt 内 θ=½(τ/I)Δt²
    doorPivot.rotation.y = -th;                               // 朝观察者一侧开
    const da = doorArmGeo.attributes['position'] as Attr;
    const dv = da.array as Float32Array;
    dv[0] = 0; dv[1] = 0.3; dv[2] = 0;
    dv[3] = d; dv[4] = 0.3; dv[5] = 0;
    da.needsUpdate = true;
    setArrow(doorArrow.attr, doorArrow.tip, d, 0.3, 0, 0, 0, 1, 0.3 + F_PUSH * 0.055);  // 等长 ⇒ 同力
    setArc(doorArcAttr, 1.2, -1.35, 0, 40, th);
    for (let i = 0; i <= seg; i++) {
      const thI = i < seg ? 0.5 * ((F_PUSH * D_DOOR[i]) / I_DOOR) * DT_PUSH * DT_PUSH : th;
      setRay(ghostDoor[i], W_DOOR + 0.2, 1.3, thI);
    }
  }

  // ═══════════ 面板绘制（5Hz） ═══════════
  function drawPanelA(): void {
    panelBg(panelA);
    const ai = Math.max(0, axisIdx);
    txt(panelA, '① 欧拉方程 · 网球拍定理（无外力矩自由转动）', 20, 40, '#f8fafc', 26, true);
    txt(panelA, 'I₁ω̇₁=(I₂−I₃)ω₂ω₃   I₂ω̇₂=(I₃−I₁)ω₃ω₁   I₃ω̇₃=(I₁−I₂)ω₁ω₂', 20, 76, '#22d3ee', 20);
    txt(panelA, `a=${A_LEN.toFixed(1)} b=${B_LEN.toFixed(1)} c=${C_LEN.toFixed(1)} m=${M_BOX.toFixed(1)}kg ⇒ I₁=${IP[0].toFixed(3)} I₂=${IP[1].toFixed(3)} I₃=${IP[2].toFixed(3)}`, 20, 106, '#94a3b8', 20);
    txt(panelA, `绕中间轴的扰动增长率 σ=Ω√((I₃−I₂)(I₂−I₁)/(I₁I₃))=${SIGMA.toFixed(2)} s⁻¹`, 20, 136, '#a855f7', 20);
    txt(panelA, `ε=${EPS} 放大到 Ω 需 ln(1/ε)/σ=${T_GROW.toFixed(2)}s ⇒ ${AXIS_T}s 窗口内必翻转`, 20, 164, '#a855f7', 20);
    txt(panelA, `当前：绕 ${AXIS_NAMES[ai]}   |ω|=${omegaAbs.toFixed(2)} rad/s（近守恒）`, 20, 196, AXIS_CSS[ai], 21);
    txt(panelA, `初值 ω₀=Ω·(1,ε,ε)，ε=${EPS}；若 ε=0 则右端恒 0，三轴画面同貌、永不翻转`, 20, 224, '#94a3b8', 20);
    const verdict = axisIdx === 1
      ? (flipAt >= 0 ? `第 ${flipAt.toFixed(2)}s 越过 90° → 翻转（网球拍定理）` : '窗口内尚未越 90°')
      : (devMax < 15 ? '偏离有界不增长 → 稳定' : `偏离 ${devMax.toFixed(0)}°`);
    txt(panelA, `读数：本窗口实测最大偏离 ${devMax.toFixed(1)}°`, 20, 268, '#fbbf24', 23, true);
    txt(panelA, `判定：${verdict}`, 20, 302, '#fbbf24', 23, true);
    txt(panelA, '下方黄曲线=实测 ω 与初始轴夹角（对照 90° 参考线）', 20, 336, '#f472b6', 19);
    panelA.t.needsUpdate = true;
  }

  function drawPanelB(): void {
    const act = Math.floor((clock % 36) / 12);
    panelBg(panelB);
    if (act === 0) {
      txt(panelB, '② 转动惯量由形状决定：I = Σmᵢrᵢ²', 20, 40, '#f8fafc', 27, true);
      txt(panelB, `细杆(端轴) I=mL²/3=${I_ROD_END.toFixed(3)}`, 20, 78, '#fbbf24', 22);
      txt(panelB, `圆盘(对称轴) I=mR²/2=${I_DISK.toFixed(3)}    球壳 I=2mR²/3=${I_SHELL.toFixed(3)}`, 20, 108, '#22d3ee', 22);
      txt(panelB, 'α = τ/I ⇒ 同质量、同力矩，质量离轴越远越难转起来', 20, 142, '#a855f7', 22);
      txt(panelB, `τ=${TAU1.toFixed(2)}N·m 相同；切向力 F=τ/r：杆 r=${L_ROD.toFixed(1)}m→${(TAU1 / L_ROD).toFixed(2)}N，盘/壳 r=${RAD.toFixed(1)}m→${TAU1.toFixed(2)}N`, 20, 172, '#94a3b8', 19);
      txt(panelB, `每轮从静止推 ${PUSH1}s（θ=½αt²）→ 撤力矩滑行 ${RUN1 - PUSH1}s（ω 守恒）→ 重置`, 20, 200, '#94a3b8', 19);
      const css = ['#fbbf24', '#22d3ee', '#a855f7'];
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        txt(panelB, `读数：${b.name}  α=${b.alpha.toFixed(2)} rad/s²  ω=${b.omega.toFixed(2)}  θ=${b.theta.toFixed(2)}rad=${(b.theta * DEG).toFixed(0)}°`, 20, 244 + i * 36, css[i], 22, true);
      }
    } else if (act === 1) {
      txt(panelB, '③ 平行轴定理：I = I_cm + m·d²', 20, 40, '#f8fafc', 27, true);
      txt(panelB, `细杆过质心 I_cm = mL²/12 = ${I_ROD_CM.toFixed(4)}（m=${M_KG.toFixed(1)}kg, L=${L_ROD.toFixed(1)}m）`, 20, 80, '#22d3ee', 22);
      txt(panelB, `轴移到端点 d=L/2=${D_HALF.toFixed(2)}m → I=${I_END_FROM_PAR.toFixed(4)} = mL²/3=${I_ROD_END.toFixed(4)}`, 20, 112, '#a855f7', 22);
      txt(panelB, '与②的"细杆端轴"是同一个数：平移轴只多一个 md² 项', 20, 146, '#94a3b8', 22);
      txt(panelB, `同 τ=${TAU2.toFixed(2)}N·m、同推击 ${PUSH2}s ⇒ θ=½(τ/I)t²；射线=各档定格转角`, 20, 178, '#94a3b8', 20);
      const iNow = I_ROD_CM + M_KG * p2D * p2D;
      txt(panelB, `读数：d=${p2D.toFixed(2)}m  md²=${(M_KG * p2D * p2D).toFixed(4)}  I=${iNow.toFixed(4)}  α=${(TAU2 / iNow).toFixed(3)} rad/s²`, 20, 228, '#fbbf24', 21, true);
      txt(panelB, `      ω=${p2Omega.toFixed(2)} rad/s  θ=${p2Theta.toFixed(3)} rad=${(p2Theta * DEG).toFixed(0)}°`, 20, 262, '#fbbf24', 21, true);
      txt(panelB, `对比：d=0→${(p2Achieved[0] * DEG).toFixed(0)}°  d=0.50→${(p2Achieved[1] * DEG).toFixed(0)}°  d=1.00→${(p2Achieved[2] * DEG).toFixed(0)}°`, 20, 300, '#f472b6', 21);
    } else {
      txt(panelB, '④ 力矩 τ = F·d（门绕铰链：推边缘省力）', 20, 40, '#f8fafc', 27, true);
      txt(panelB, `门（薄板绕边轴）I_door=(1/3)mW²=${I_DOOR.toFixed(3)}（m=${M_DOOR.toFixed(1)}kg, W=${W_DOOR.toFixed(2)}m）`, 20, 80, '#22d3ee', 22);
      txt(panelB, `F=${F_PUSH.toFixed(1)}N 恒定（箭头等长），只有力臂 d 在变 ⇒ τ=F·d`, 20, 112, '#a855f7', 22);
      txt(panelB, `同 Δt=${DT_PUSH}s 推击 ⇒ θ=½(τ/I)Δt² ∝ d；射线=各档达成角`, 20, 146, '#94a3b8', 21);
      txt(panelB, '近铰 d 小 ⇒ τ 小，几乎推不开；推在边缘 d≈W 最省力', 20, 178, '#f472b6', 21);
      const seg = Math.min(D_DOOR.length - 1, Math.floor(((clock % 36) - 24) / PER3));
      const tau = F_PUSH * D_DOOR[seg];
      txt(panelB, `读数：d=${D_DOOR[seg].toFixed(2)}m → τ=${tau.toFixed(2)}N·m → α=${(tau / I_DOOR).toFixed(3)}rad/s²`, 20, 230, '#fbbf24', 21, true);
      txt(panelB, `      θ=${(doorAngleNow() * DEG).toFixed(1)}°（本档 ${DT_PUSH}s 推击末值）`, 20, 264, '#fbbf24', 21, true);
      const cmp = D_DOOR.map((d) => `${d.toFixed(2)}m:${(0.5 * ((F_PUSH * d) / I_DOOR) * DT_PUSH * DT_PUSH * DEG).toFixed(0)}°`).join('  ');
      txt(panelB, `四档对照 ${cmp}`, 20, 302, STEP_CSS[seg], 21);
    }
    panelB.t.needsUpdate = true;
  }

  function drawActLabel(): void {
    const act = Math.floor((clock % 36) / 12);
    if (act === 0) {
      panelBg(lblTrio);
      const rows: [string, string][] = [
        [`细杆 m=1.0kg L=2.0m 轴在端点：I=mL²/3=${I_ROD_END.toFixed(3)}`, '#fbbf24'],
        [`圆盘 m=1.0kg R=1.0m 轴=对称轴：I=mR²/2=${I_DISK.toFixed(3)}   球壳：I=2mR²/3=${I_SHELL.toFixed(3)}`, '#22d3ee'],
        [`同 τ=${TAU1.toFixed(2)}N·m ⇒ α=τ/I = ${bodies[0].alpha.toFixed(2)} / ${bodies[1].alpha.toFixed(2)} / ${bodies[2].alpha.toFixed(2)} rad/s²`, '#a855f7'],
        [`实时 ω = ${bodies[0].omega.toFixed(2)} / ${bodies[1].omega.toFixed(2)} / ${bodies[2].omega.toFixed(2)} rad/s（细杆最慢：质量离轴最远）`, '#f8fafc'],
      ];
      for (let i = 0; i < rows.length; i++) txt(lblTrio, rows[i][0], 16, 40 + i * 46, rows[i][1], 27, i === 2);
      lblTrio.t.needsUpdate = true;
    } else if (act === 1) {
      panelBg(lblPar);
      const iNow = I_ROD_CM + M_KG * p2D * p2D;
      const rows: [string, string][] = [
        [`转轴离质心 d=${p2D.toFixed(2)}m（青线），粉点=质心，粉线=量出的 d`, '#f8fafc'],
        [`I = I_cm + m·d² = ${I_ROD_CM.toFixed(4)} + ${M_KG.toFixed(1)}×${(p2D * p2D).toFixed(4)} = ${iNow.toFixed(4)}`, '#22d3ee'],
        [`α = τ/I = ${TAU2.toFixed(2)}/${iNow.toFixed(4)} = ${(TAU2 / iNow).toFixed(3)} rad/s²（同 τ，轴越偏越难转）`, '#a855f7'],
        [`各档 ${PUSH2}s 推完定格：${(p2Achieved[0] * DEG).toFixed(0)}° / ${(p2Achieved[1] * DEG).toFixed(0)}° / ${(p2Achieved[2] * DEG).toFixed(0)}°`, '#fbbf24'],
      ];
      for (let i = 0; i < rows.length; i++) txt(lblPar, rows[i][0], 16, 40 + i * 46, rows[i][1], 27, i === 2);
      lblPar.t.needsUpdate = true;
    } else {
      panelBg(lblDoor);
      const seg = Math.min(D_DOOR.length - 1, Math.floor(((clock % 36) - 24) / PER3));
      for (let i = 0; i < D_DOOR.length; i++) {
        const alpha = (F_PUSH * D_DOOR[i]) / I_DOOR;
        const thI = 0.5 * alpha * DT_PUSH * DT_PUSH * DEG;
        txt(lblDoor, `推在 d=${D_DOOR[i].toFixed(2)}m：τ=F·d=${(F_PUSH * D_DOOR[i]).toFixed(1)}N·m  α=${alpha.toFixed(2)}  ${DT_PUSH}s 开 ${thI.toFixed(0)}°${i === seg ? '  ◀当前' : ''}`, 14, 36 + i * 40, STEP_CSS[i], 24, i === seg);
      }
      txt(lblDoor, `F=${F_PUSH.toFixed(0)}N 不变、门 I=(1/3)mW²=${I_DOOR.toFixed(2)} 不变 —— 只有 d 决定开门快慢`, 14, 196, '#f8fafc', 24);
      lblDoor.t.needsUpdate = true;
    }
  }

  ctx.camera.position.set(1.6, 7.0, 19.5);
  ctx.camera.lookAt(1.6, 1.2, 0);

  let lastTick = -1;
  setAxis(0);
  updateStage(0.016);
  drawPanelA();
  drawPanelB();
  drawActLabel();

  return {
    update(t, dt) {
      const step = Math.max(0.001, Math.min(0.05, dt || 0.016));
      clock += step;
      updateEuler(step);
      updateStage(step);
      const tick = Math.floor(clock * 5);
      if (tick !== lastTick) {
        lastTick = tick;
        drawPanelA();
        drawPanelB();
        drawActLabel();
      }
      starPoints.rotation.y = t * 0.004;
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
