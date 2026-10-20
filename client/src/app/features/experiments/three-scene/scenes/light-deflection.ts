import type { SceneContext, SceneInstance } from '../types';

/**
 * 光线偏折 🟢（P141）：星光引力偏折 / 1919 爱丁顿日全食远征 —— 验证广义相对论。
 *
 * 物理核心：大质量体（太阳 M☉）使掠过它的星光弯向自身，渐近偏折角
 *   δ_GR(b) = 4GM☉/(c²·b) = 1.75″·(R☉/b)，牛顿（光的微粒说，Soldner 1801）仅半值 δ_N = ½δ_GR。
 * 重推导（见自检脚本，node 运行）：
 *   4GM☉/(c²R☉) = 4·6.6743e-11·1.98892e30 / (299792458²·6.957e8) = 8.4920e-6 rad = 1.7516″，
 *   牛顿半值 0.8758″；1919 实测 ≈1.6–1.98″，支持 GR。
 *   自检脚本：_scratch/r4fix/lightdefl/check.mjs（输出 δ、单调性 θ_vis∝1/b、近日点≥R☉、放大 ~2×10⁴）。
 *
 * 画面几何（场景单位 1 = R☉，全部由上式驱动、与面板读数同源）：
 *   太阳在日-观测者轴一端，观测者（1919 远征）在 x=D_OBS=5.8 处；冲击参数 b∈[1.15,2.4] 周期扫描。
 *   入射渐近直线（斜率≈0）→ 近日点前双曲型弯折 y(x)=C−x·tanβ+(δv/2)(x−√(x²+w²))（斜率 0→−δv）
 *   → 出射段恰好进入观测者眼睛。画面弯折率 δv=K_VIS/b（K_VIS=0.19 rad·R☉，为真实 δ 的等比放大 ~2×10⁴）。
 *   观测者处反向延长出射切线 = 表观视线（青，外移 θ_vis=atan(−y′(D))−atan(−y′(X0))≈δv）；
 *   平行于入射渐近线的视线 = 真实位置（灰，夜里星图所定）；半角视线 = 牛顿 ½δ 表观点（粉）。
 *   小 b（掠日边缘）恒星真实位置藏在日面眩光内、只有日全食+偏折才“看见”，正是爱丁顿实验逻辑。
 *   b 圆环（绿）标示冲击参数；δ(b)=1.7516″/b 曲线画布与画面共用同一 δv(b)、同一 b(t)。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  // —— 资源登记，dispose 时统一释放 ——
  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  // ================= 物理常数与画面常量 =================
  const G = 6.6743e-11, M_SUN = 1.98892e30, C_LIGHT = 299792458, R_SUN_M = 6.957e8;
  const RAD2ARC = 206264.806;
  const DELTA_LIMB = (4 * G * M_SUN) / (C_LIGHT * C_LIGHT * R_SUN_M) * RAD2ARC; // ≈1.7516″（b=R☉）
  const D_OBS = 5.8, K_VIS = 0.19, B_MIN = 1.15, B_MAX = 2.4, X0 = -4.6, R_MARK = 8.6, SEG = 200;

  // ================= 星野与地面栅格（脚手架） =================
  const starGeo = geo(new THREE.BufferGeometry());
  {
    const p = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      p[i * 3] = (Math.random() - 0.5) * 200;
      p[i * 3 + 1] = (Math.random() - 0.5) * 200;
      p[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  }
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  grid.position.y = -3;
  group.add(grid);

  // ================= 太阳（大质量引力透镜）=================
  const sun = new THREE.Mesh(geo(new THREE.SphereGeometry(1, 32, 24)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  group.add(sun);
  const corona = new THREE.Mesh(
    geo(new THREE.SphereGeometry(1.16, 32, 24)),
    mat(new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.22 })),
  );
  group.add(corona);

  // ================= 观测者（1919 爱丁顿远征）=================
  const observer = new THREE.Mesh(geo(new THREE.SphereGeometry(0.17, 16, 16)), mat(new THREE.MeshBasicMaterial({ color: 0x60a5fa })));
  group.add(observer);

  // ================= 偏折光线（双曲型弯折，逐帧重算）=================
  const rayGeo = geo(new THREE.BufferGeometry());
  const rayPos = new Float32Array((SEG + 1) * 3);
  rayGeo.setAttribute('position', new THREE.BufferAttribute(rayPos, 3));
  const rayLine = new THREE.Line(rayGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 })));
  group.add(rayLine);

  // 入射平行光箭束（恒星来的直线光，3 支）
  const arrowMat = mat(new THREE.LineBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.6 }));
  const arrowGeoArr = [0, 1, 2].map(() => {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    return g;
  });
  arrowGeoArr.forEach((g) => group.add(new THREE.Line(g, arrowMat)));
  const coneGeo = geo(new THREE.ConeGeometry(0.07, 0.22, 10));
  const coneMat = mat(new THREE.MeshBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.7 }));
  const cones = [0, 1, 2].map(() => { const c = new THREE.Mesh(coneGeo, coneMat); group.add(c); return c; });

  // 冲击参数 b：圆环 + 原点→近日点径向标线
  const CIRCLE = 96;
  const circGeo = geo(new THREE.BufferGeometry());
  circGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((CIRCLE + 1) * 3), 3));
  const circLine = new THREE.Line(circGeo, mat(new THREE.LineDashedMaterial({ color: 0x22c55e, dashSize: 0.16, gapSize: 0.12, transparent: true, opacity: 0.8 })));
  group.add(circLine);
  const radGeo = geo(new THREE.BufferGeometry());
  radGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const radLine = new THREE.Line(radGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e })));
  group.add(radLine);

  // ================= 三条视线（观测者反向延长）=================
  const dash = (color: number, op: number) =>
    mat(new THREE.LineDashedMaterial({ color, dashSize: 0.24, gapSize: 0.16, transparent: true, opacity: op }));
  const sightGeos = [0, 1, 2].map(() => {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    return g;
  });
  const matsSight = [dash(0x22d3ee, 0.9), dash(0x94a3b8, 0.75), dash(0xf472b6, 0.8)];
  const sights = sightGeos.map((g, i) => { const l = new THREE.Line(g, matsSight[i]); group.add(l); return l; });

  // 恒星（光源，位于入射直线段端）+ 表观/真实/牛顿 位置标记
  const starMesh = new THREE.Mesh(geo(new THREE.SphereGeometry(0.2, 16, 16)), mat(new THREE.MeshBasicMaterial({ color: 0xfef3c7 })));
  group.add(starMesh);
  const appMesh = new THREE.Mesh(geo(new THREE.SphereGeometry(0.18, 16, 16)), mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.9 })));
  group.add(appMesh);
  const trueMesh = new THREE.Mesh(geo(new THREE.SphereGeometry(0.13, 12, 12)), mat(new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.7 })));
  group.add(trueMesh);
  const newtMesh = new THREE.Mesh(geo(new THREE.SphereGeometry(0.13, 12, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.85 })));
  group.add(newtMesh);
  // 光子动画小球（沿偏折路径奔向观测者）
  const photon = new THREE.Mesh(geo(new THREE.SphereGeometry(0.1, 12, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xffffff })));
  group.add(photon);

  // ================= 文字标签（Sprite）=================
  function makeLabel(text: string, color: string, scale = 4.0): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 28px "PingFang SC", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const t = tex(new THREE.CanvasTexture(cv));
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: t, transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    group.add(s);
    return s;
  }
  const labelSun = makeLabel('太阳 M☉（引力透镜）', '#fbbf24', 3.6);
  labelSun.position.set(0, -1.75, 0);
  const labelObs = makeLabel('观测者·日全食（爱丁顿 1919）', '#60a5fa', 3.8);
  const labelIn = makeLabel('恒星入射星光（直线）', '#fde68a', 3.2);
  const labelApp = makeLabel('表观位置（外移 δ_GR）', '#22d3ee', 3.4);
  const labelTrue = makeLabel('真实位置（夜间星图）', '#94a3b8', 3.2);
  const labelNewt = makeLabel('牛顿 ½δ 表观点', '#f472b6', 2.8);
  const labelB = makeLabel('b：冲击参数', '#22c55e', 2.6);

  // ================= 读数面板（800×240 画布）=================
  const infoCv = document.createElement('canvas');
  infoCv.width = 800; infoCv.height = 240;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(8.8, 2.64)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 5.9, 3.2);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  // ================= δ(b) 曲线画布（与画面共用同一 b(t)、δ(b)）=================
  const chartCv = document.createElement('canvas');
  chartCv.width = 400; chartCv.height = 300;
  const chartCtx = chartCv.getContext('2d')!;
  const chartTex = tex(new THREE.CanvasTexture(chartCv));
  const chartPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(3.6, 2.7)),
    mat(new THREE.MeshBasicMaterial({ map: chartTex, transparent: true })),
  );
  chartPlane.position.set(3.6, -1.4, 3.0);
  group.add(chartPlane);

  // ================= 公式驱动的几何求解（面板与画面同源）=================
  interface Geom {
    b: number; dv: number; w: number; Cc: number; tb: number;
    y: (x: number) => number; m: (x: number) => number;
    eApp: number; eTrue: number; eNewt: number; thetaVis: number;
    deltaArc: number; amp: number;
  }
  function geom(b: number): Geom {
    const dv = K_VIS / b;                                   // 画面弯折率（真实 δ 的等比放大）
    const w = 0.85 * b;                                     // 弯折过渡宽度
    const beta = Math.asin(b / D_OBS);                      // 表观视线掠日高度角
    const tb = Math.tan(beta), Cc = D_OBS * tb;
    const y = (x: number) => Cc - x * tb + (dv / 2) * (x - Math.hypot(x, w));
    const m = (x: number) => -tb + (dv / 2) * (1 - x / Math.hypot(x, w));
    const eApp = Math.atan(-m(D_OBS));                      // 观测者处出射切线反向仰角（表观）
    const eTrue = Math.atan(-m(X0));                        // 入射渐近方向仰角（真实位置）
    const eNewt = (eApp + eTrue) / 2;                       // 牛顿半值
    const thetaVis = eApp - eTrue;                          // 画面偏折角（≈δv，单调 ~1/b）
    const deltaArc = DELTA_LIMB / b;                        // 真实 δ_GR（角秒），与 δv 同一 b
    const amp = thetaVis / ((deltaArc / RAD2ARC));          // 示意放大倍数（无量纲角之比）
    return { b, dv, w, Cc, tb, y, m, eApp, eTrue, eNewt, thetaVis, deltaArc, amp };
  }
  const UPV = new THREE.Vector3(0, 1, 0);

  function updateAll(g: Geom): void {
    // 1) 偏折路径：x 从 X0（恒星侧）到 D_OBS（观测者）
    let minD = Infinity, tx = 0, ty = 0;
    for (let i = 0; i <= SEG; i++) {
      const x = X0 + ((D_OBS - X0) * i) / SEG;
      const yy = g.y(x);
      rayPos[i * 3] = x; rayPos[i * 3 + 1] = yy; rayPos[i * 3 + 2] = 0;
      const d = Math.hypot(x, yy);
      if (d < minD && x > -1 && x < 2) { minD = d; tx = x; ty = yy; }
    }
    rayGeo.attributes['position'].needsUpdate = true;

    // 2) 观测者与入射箭束（沿 X0 处切线反向延伸）
    const yE = g.y(D_OBS);
    observer.position.set(D_OBS, yE, 0);
    labelObs.position.set(D_OBS - 0.35, yE - 0.75, 0);
    const mIn = g.m(X0);
    const nrmIn = Math.hypot(1, mIn);
    for (let k = 0; k < 3; k++) {
      const back = 0.5 + 0.62 * k;                          // 三支箭依次更靠外
      const zz = (k - 1) * 0.75;
      const sx = X0 - back, sy = g.y(X0) - back * mIn;
      const ex = sx + 1.15, ey = sy + 1.15 * mIn;
      const a = arrowGeoArr[k].attributes['position'] as import('three').BufferAttribute;
      const arr = a.array as Float32Array;
      arr[0] = sx; arr[1] = sy; arr[2] = zz;
      arr[3] = ex; arr[4] = ey; arr[5] = zz;
      a.needsUpdate = true;
      cones[k].position.set(ex, ey, zz);
      cones[k].quaternion.setFromUnitVectors(UPV, new THREE.Vector3(1 / nrmIn, mIn / nrmIn, 0));
    }
    labelIn.position.set(X0 - 1.7, g.y(X0) + 0.62, 0);
    starMesh.position.set(X0 - 1.05, g.y(X0) - 1.05 * mIn, 0);

    // 3) 冲击参数圆环（半径 b）+ 原点→近日点标线
    const ca = circGeo.attributes['position'] as import('three').BufferAttribute;
    const carr = ca.array as Float32Array;
    for (let i = 0; i <= CIRCLE; i++) {
      const a = (i / CIRCLE) * Math.PI * 2;
      carr[i * 3] = g.b * Math.cos(a); carr[i * 3 + 1] = g.b * Math.sin(a); carr[i * 3 + 2] = 0;
    }
    ca.needsUpdate = true;
    circLine.computeLineDistances();
    const ra = radGeo.attributes['position'] as import('three').BufferAttribute;
    const rarr = ra.array as Float32Array;
    rarr[0] = 0; rarr[1] = 0; rarr[3] = tx; rarr[4] = ty;
    ra.needsUpdate = true;
    labelB.position.set(tx * 0.45 - 0.55, ty * 0.55 + 0.28, 0);

    // 4) 三条视线（自观测者反向延长 R_MARK）与三个位置标记
    const setSight = (idx: number, el: number) => {
      const px = D_OBS - R_MARK * Math.cos(el);
      const py = yE + R_MARK * Math.sin(el);
      const a = sightGeos[idx].attributes['position'] as import('three').BufferAttribute;
      const arr = a.array as Float32Array;
      arr[0] = D_OBS; arr[1] = yE; arr[2] = 0;
      arr[3] = px; arr[4] = py; arr[5] = 0;
      a.needsUpdate = true;
      sights[idx].computeLineDistances();
      return { x: px, y: py };
    };
    const A = setSight(0, g.eApp);   appMesh.position.set(A.x, A.y, 0);
    const S = setSight(1, g.eTrue);  trueMesh.position.set(S.x, S.y, 0);
    const N = setSight(2, g.eNewt);  newtMesh.position.set(N.x, N.y, 0);
    labelApp.position.set(A.x - 0.15, A.y + 0.45, 0);
    labelTrue.position.set(S.x - 0.1, S.y - 0.5, 0);
    labelNewt.position.set(N.x + 0.55, N.y + 0.42, 0);
  }

  // ================= 面板与曲线绘制（5Hz）=================
  function drawInfo(g: Geom): void {
    infoCtx.clearRect(0, 0, 800, 240);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 792, 232);
    infoCtx.strokeStyle = '#334155';
    infoCtx.lineWidth = 3;
    infoCtx.strokeRect(4, 4, 792, 232);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 29px "PingFang SC", sans-serif';
    infoCtx.fillText('星光引力偏折 —— 1919 爱丁顿日全食远征检验广义相对论', 22, 44);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '27px "PingFang SC", sans-serif';
    infoCtx.fillText('δ = 4GM☉/(c²b) = ' + DELTA_LIMB.toFixed(3) + '″·(R☉/b)　掠日边缘 b≈R☉ 偏折最大', 22, 86);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('牛顿(Soldner)仅半值 ½δ —— 1919 实测支持 GR，验证时空弯曲', 22, 126);
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.fillText('恒星真实位置没入日面眩光，弯向太阳的光线使其“外移”可见', 22, 166);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 27px "PingFang SC", sans-serif';
    infoCtx.fillText(
      '读数：b=' + g.b.toFixed(2) + 'R☉ δ_GR=' + g.deltaArc.toFixed(3) + '″ δ_N=' + (g.deltaArc / 2).toFixed(3) +
      '″ 画面角=' + ((g.thetaVis * 180) / Math.PI).toFixed(1) + '° 放大' + (g.amp / 1e4).toFixed(1) + '万倍',
      22, 208,
    );
    infoTex.needsUpdate = true;

    // δ(b) 曲线（同一 δ(b)、同一 b(t)）
    const cw = 400, ch = 300, mL = 54, mB = 36, mT = 34, mR = 14;
    const B0 = 1.0, B1 = 2.6, D0 = 0, D1 = 1.9;
    const px = (b: number) => mL + ((b - B0) / (B1 - B0)) * (cw - mL - mR);
    const py = (d: number) => ch - mB - ((d - D0) / (D1 - D0)) * (ch - mB - mT);
    chartCtx.fillStyle = 'rgba(7,11,20,0.85)';
    chartCtx.fillRect(0, 0, cw, ch);
    chartCtx.strokeStyle = '#334155'; chartCtx.lineWidth = 2;
    chartCtx.strokeRect(2, 2, cw - 4, ch - 4);
    chartCtx.fillStyle = '#f8fafc'; chartCtx.font = 'bold 20px "PingFang SC", sans-serif';
    chartCtx.fillText('δ(b) = 1.75″·(R☉/b)', 16, 26);
    chartCtx.strokeStyle = '#1e293b'; chartCtx.lineWidth = 1;
    for (let b = 1.5; b <= 2.5; b += 0.5) {
      chartCtx.beginPath(); chartCtx.moveTo(px(b), mT); chartCtx.lineTo(px(b), ch - mB); chartCtx.stroke();
    }
    chartCtx.strokeStyle = '#64748b';
    chartCtx.beginPath(); chartCtx.moveTo(mL, ch - mB); chartCtx.lineTo(cw - mR, ch - mB);
    chartCtx.moveTo(mL, mT); chartCtx.lineTo(mL, ch - mB); chartCtx.stroke();
    chartCtx.fillStyle = '#94a3b8'; chartCtx.font = '16px "PingFang SC", sans-serif';
    chartCtx.fillText('b / R☉', cw - 70, ch - 12);
    chartCtx.fillText('δ / ″', 8, mT - 8);
    for (let i = 0; i <= 4; i++) {
      const b = B0 + (i / 4) * (B1 - B0);
      chartCtx.fillText(b.toFixed(1), px(b) - 12, ch - mB + 18);
    }
    for (const d of [0.5, 1.0, 1.5]) chartCtx.fillText(d.toFixed(1), 16, py(d) + 5);
    const curve = (half: boolean, color: string) => {
      chartCtx.strokeStyle = color; chartCtx.lineWidth = 3;
      chartCtx.beginPath();
      for (let i = 0; i <= 64; i++) {
        const b = B0 + (i / 64) * (B1 - B0);
        const d = (DELTA_LIMB / b) * (half ? 0.5 : 1);
        i === 0 ? chartCtx.moveTo(px(b), py(d)) : chartCtx.lineTo(px(b), py(d));
      }
      chartCtx.stroke();
    };
    curve(false, '#22d3ee');
    curve(true, '#f472b6');
    chartCtx.fillStyle = '#22d3ee'; chartCtx.fillText('GR', px(2.35), py(1.15));
    chartCtx.fillStyle = '#f472b6'; chartCtx.fillText('牛顿½', px(2.2), py(0.62));
    // 当前 b 游标（与画面同一 b）
    chartCtx.strokeStyle = 'rgba(251,191,36,0.6)'; chartCtx.lineWidth = 2;
    chartCtx.beginPath(); chartCtx.moveTo(px(g.b), mT); chartCtx.lineTo(px(g.b), ch - mB); chartCtx.stroke();
    chartCtx.fillStyle = '#fbbf24';
    chartCtx.beginPath(); chartCtx.arc(px(g.b), py(g.deltaArc), 6, 0, Math.PI * 2); chartCtx.fill();
    chartCtx.beginPath(); chartCtx.arc(px(g.b), py(g.deltaArc / 2), 4, 0, Math.PI * 2); chartCtx.fill();
    chartTex.needsUpdate = true;
  }

  // 初始化一帧几何 + 面板
  let cur = geom(B_MIN);
  updateAll(cur);
  drawInfo(cur);

  return {
    update(t, dt) {
      // 自变量扫描：b 从掠日边缘 1.15R☉ 推到 2.4R☉ 再返回，周期 16s
      const cyc = (t % 16) / 16;
      const b = B_MIN + (B_MAX - B_MIN) * (0.5 - 0.5 * Math.cos(cyc * Math.PI * 2));
      cur = geom(b);
      updateAll(cur);

      // 光子沿偏折路径奔向观测者（约 3.6s 一粒）
      const p = (t % 3.6) / 3.6;
      const idx = Math.min(SEG, Math.floor(p * SEG));
      photon.position.set(rayPos[idx * 3], rayPos[idx * 3 + 1], 0);

      // 面板/曲线 5Hz 重绘（与画面同一 geom(b)）
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo(cur);
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
