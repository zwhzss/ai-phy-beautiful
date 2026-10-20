import type { SceneContext, SceneInstance } from '../types';
/**
 * 红外天文观测（P279）：分子云育婴室的尘埃消光曲线 + 大气窗口 + JWST 式遮阳罩冷焦面。
 * 主控方程：
 *   ① 尘埃消光 τ(λ) = τ_V·(λ/0.55μm)^{−β}（β≈1.8），透射率 e^{−τ}
 *   ② 尘埃热辐射 B_λ(T)，维恩位移 λ_max = 2898/T μm（20 K → 145 μm）
 *   ③ 望远镜自身背景抑制比 = exp[ (hc/λk)(1/T_cold − 1/T_hot) ]（冷却越深、越短波受益越大）
 *   ④ 地球大气透过率 = Π[1 − a_j·exp(−(λ−λ_j)²/2σ_j²)]（H₂O 1.4/1.85/2.7μm、CO₂ 4.27/15μm、O₃ 9.6μm）
 *   ⑤ 星际分子谱线：大气带为吸收（蓝线），原星云发射线为 H₂ 纯转动 2.1/17.0μm（绿虚线），共同构成"分子谱线"
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

  const starField = geo(new THREE.BufferGeometry());
  {
    const p = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      p[i * 3] = (Math.random() - 0.5) * 200;
      p[i * 3 + 1] = (Math.random() - 0.5) * 200;
      p[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    starField.setAttribute('position', new THREE.BufferAttribute(p, 3));
  }
  group.add(new THREE.Points(starField, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);
  grid.position.y = -3.4;

  // ============ 物理常数与模型 ============
  const TAU_V = 8.0;            // 云中心 V band（0.55μm）谱光学深度
  const B_IX = 1.8;             // 消光幂律指数
  const H_P = 6.62607015e-34, C_L = 2.99792458e8, K_B = 1.380649e-23;
  const LAM_LO = 0.4, LAM_HI = 30;   // μm（对数轴）
  const lgLo = Math.log10(LAM_LO), lgSpan = Math.log10(LAM_HI) - lgLo;

  const tauOf = (lamUm: number): number => TAU_V * Math.pow(lamUm / 0.55, -B_IX);
  const planckN = (lamUm: number, T: number): number => {
    const l = lamUm * 1e-6;
    return 1 / (Math.pow(l, 5) * (Math.exp((H_P * C_L) / (l * K_B * T)) - 1));
  };
  // 大气带：中心 μm、半宽、深度
  const TEL_BANDS: { c: number; s: number; a: number }[] = [
    { c: 0.76, s: 0.05, a: 0.9 },
    { c: 1.4, s: 0.09, a: 0.98 },
    { c: 1.85, s: 0.1, a: 0.95 },
    { c: 2.7, s: 0.4, a: 0.99 },
    { c: 4.27, s: 0.3, a: 0.99 },
    { c: 6.3, s: 1.1, a: 0.98 },
    { c: 9.6, s: 0.7, a: 0.6 },
    { c: 15, s: 2.6, a: 1.0 },
    { c: 21, s: 4, a: 1.0 },
  ];
  function telluric(lamUm: number): number {
    let f = 0.97;
    for (const b of TEL_BANDS) {
      const d = lamUm - b.c;
      f *= 1 - b.a * Math.exp(-(d * d) / (2 * b.s * b.s));
    }
    return Math.max(0, f);
  }

  let lam = 0.55;                 // 当前观测波长（扫描量）
  let tauNow = TAU_V, dustT = 0, atmT = 0, supLog = 0;

  // ============ 左：分子云体积（消光随波段变化） ============
  const CLOUD_CX = -2.3, CLOUD_CY = 0.35;
  const N_P = 420;
  const cloudGeo = geo(new THREE.BufferGeometry());
  const cPos = new Float32Array(N_P * 3);
  const cCol = new Float32Array(N_P * 3);
  const cFrac = new Float32Array(N_P);     // 该颗粒贡献的光深比例
  for (let i = 0; i < N_P; i++) {
    // 扁球 + 纤维扰动
    const u = Math.random() * TWO_PI, v = Math.acos(2 * Math.random() - 1), rr = Math.cbrt(Math.random());
    const x = 1.75 * rr * Math.sin(v) * Math.cos(u);
    const y = 0.85 * rr * Math.sin(v) * Math.sin(u);
    const z = 1.15 * rr * Math.cos(v);
    const twist = 0.35 * Math.sin(2.4 * x + 1.1 * z);
    cPos[i * 3] = CLOUD_CX + x;
    cPos[i * 3 + 1] = CLOUD_CY + y + twist;
    cPos[i * 3 + 2] = z;
    cFrac[i] = 0.25 + 0.75 * (1 - rr) * (0.6 + 0.4 * Math.random());
  }
  cloudGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
  cloudGeo.setAttribute('color', new THREE.BufferAttribute(cCol, 3));
  const cloudMat = mat(new THREE.PointsMaterial({ size: 0.13, vertexColors: true, transparent: true, opacity: 0.9, sizeAttenuation: true }));
  group.add(new THREE.Points(cloudGeo, cloudMat));

  function updateCloud(): void {
    const tl = tauOf(lam);
    // 单位波段亮度归一（真实 IR 图像也做拉伸）
    const scatN = Math.exp(-tl);
    const thN = (1 - Math.exp(-tl)) * planckN(lam, 20) / planckN(20, 20);
    const thWarm = (1 - Math.exp(-tl * 0.35)) * planckN(lam, 150) / planckN(5, 150);
    for (let i = 0; i < N_P; i++) {
      const t_i = tl * cFrac[i];
      const tr = Math.exp(-t_i);
      const scat = tr * scatN * 1.6;
      const emit = Math.min(1.2, thN * (0.5 + cFrac[i]) + thWarm * cFrac[i] * 0.9);
      // 散射星光偏蓝（尘埃散射前向/蓝色），热辐射偏红橙
      cCol[i * 3] = 0.32 * scat + emit * 1.0;
      cCol[i * 3 + 1] = 0.5 * scat + emit * 0.45;
      cCol[i * 3 + 2] = 0.95 * scat + emit * 0.12;
      const k = Math.min(1.6, scat + emit);
      cCol[i * 3] *= k; cCol[i * 3 + 1] *= k; cCol[i * 3 + 2] *= k;
    }
    cloudGeo.attributes['color'].needsUpdate = true;
  }

  // 嵌入式原星（云内 6 个 + 云后背景星）：可见性 ∝ e^{−τ·路径比例}
  const glowCv = document.createElement('canvas');
  glowCv.width = 128; glowCv.height = 128;
  {
    const c = glowCv.getContext('2d')!;
    const g = c.createRadialGradient(64, 64, 2, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,0.98)');
    g.addColorStop(0.3, 'rgba(255,214,140,0.6)');
    g.addColorStop(1, 'rgba(255,140,60,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  }
  const glowTex = tex(new THREE.CanvasTexture(glowCv));
  const PROTOS: { pos: import('three').Vector3; frac: number; name: string }[] = [
    { pos: new THREE.Vector3(CLOUD_CX - 0.7, CLOUD_CY + 0.15, 0.5), frac: 0.55, name: '原星 1' },
    { pos: new THREE.Vector3(CLOUD_CX + 0.55, CLOUD_CY - 0.25, -0.35), frac: 0.75, name: '原星 2' },
    { pos: new THREE.Vector3(CLOUD_CX + 0.1, CLOUD_CY + 0.35, 0.75), frac: 0.4, name: '原星 3' },
    { pos: new THREE.Vector3(CLOUD_CX - 0.35, CLOUD_CY - 0.4, -0.6), frac: 0.85, name: '原星 4' },
    { pos: new THREE.Vector3(CLOUD_CX + 1.0, CLOUD_CY + 0.2, 0.1), frac: 0.3, name: '原星 5' },
    { pos: new THREE.Vector3(CLOUD_CX - 1.1, CLOUD_CY - 0.1, -0.2), frac: 0.9, name: '原星 6' },
  ];
  const protoSprites: import('three').Sprite[] = [];
  const protoMats: import('three').SpriteMaterial[] = [];
  PROTOS.forEach((p, idx) => {
    const m = mat(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthTest: false }));
    const s = new THREE.Sprite(m);
    s.position.copy(p.pos);
    s.scale.setScalar(0.5 + 0.12 * (idx % 3));
    group.add(s);
    protoSprites.push(s);
    protoMats.push(m);
  });
  // 云后背景星与前景照明星
  const bgStarMat = mat(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0 }));
  const bgStar = new THREE.Sprite(bgStarMat);
  bgStar.position.set(CLOUD_CX - 0.2, CLOUD_CY + 0.05, -3.2);
  bgStar.scale.setScalar(0.9);
  group.add(bgStar);
  const illStar = new THREE.Mesh(geo(new THREE.SphereGeometry(0.18, 16, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xdbeafe })));
  illStar.position.set(CLOUD_CX + 2.6, CLOUD_CY + 1.6, 1.2);
  group.add(illStar);

  let visibleProtos = 0;
  function updateSources(): void {
    const tl = tauOf(lam);
    visibleProtos = 0;
    PROTOS.forEach((p, i) => {
      const tr = Math.exp(-tl * p.frac);
      protoMats[i].opacity = Math.min(1, tr * 1.3);
      if (tr > 0.12) visibleProtos++;
      protoSprites[i].scale.setScalar((0.5 + 0.1 * (i % 3)) * (1 + 0.08 * Math.sin(t0 + i)));
    });
    bgStarMat.opacity = Math.min(1, Math.exp(-tl) * 1.3);
  }
  let t0 = 0;

  // ============ 右上：透过率曲线（尘埃 + 大气），横轴为 log λ ============
  const PLT_X0 = 1.15, PLT_X1 = 4.45, PLT_Y0 = 0.85, PLT_Y1 = 3.5;
  const px = (l: number): number => PLT_X0 + ((Math.log10(l) - lgLo) / lgSpan) * (PLT_X1 - PLT_X0);
  const py = (f: number): number => PLT_Y0 + Math.max(0, Math.min(1, f)) * (PLT_Y1 - PLT_Y0);
  {
    const axisGeo = geo(new THREE.BufferGeometry());
    const pts: number[] = [PLT_X0, PLT_Y0, 0, PLT_X1, PLT_Y0, 0, PLT_X0, PLT_Y0, 0, PLT_X0, PLT_Y1 + 0.25, 0];
    for (const l of [0.4, 1, 2, 5, 10, 30]) pts.push(px(l), PLT_Y0 - 0.08, 0, px(l), PLT_Y0, 0);
    axisGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    group.add(new THREE.LineSegments(axisGeo, mat(new THREE.LineBasicMaterial({ color: 0x64748b }))));
  }
  const dustCurveGeo = geo(new THREE.BufferGeometry());
  const atmCurveGeo = geo(new THREE.BufferGeometry());
  {
    const N = 200;
    const d = new Float32Array((N + 1) * 3), a = new Float32Array((N + 1) * 3);
    for (let i = 0; i <= N; i++) {
      const l = Math.pow(10, lgLo + (lgSpan * i) / N);
      d[i * 3] = px(l); d[i * 3 + 1] = py(Math.exp(-tauOf(l))); d[i * 3 + 2] = 0;
      a[i * 3] = px(l); a[i * 3 + 1] = py(telluric(l)); a[i * 3 + 2] = 0;
    }
    dustCurveGeo.setAttribute('position', new THREE.BufferAttribute(d, 3));
    atmCurveGeo.setAttribute('position', new THREE.BufferAttribute(a, 3));
  }
  group.add(new THREE.Line(dustCurveGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 }))));
  group.add(new THREE.Line(atmCurveGeo, mat(new THREE.LineBasicMaterial({ color: 0x60a5fa }))));
  // 当前波段游标
  const cursorGeo = geo(new THREE.BufferGeometry());
  cursorGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  group.add(new THREE.Line(cursorGeo, mat(new THREE.LineBasicMaterial({ color: 0xf472b6 }))));
  const bandDot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.075, 12, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })));
  group.add(bandDot);
  const bandDot2 = new THREE.Mesh(geo(new THREE.SphereGeometry(0.075, 12, 12)), mat(new THREE.MeshBasicMaterial({ color: 0x60a5fa })));
  group.add(bandDot2);

  // ============ 右下：五层遮阳罩 + 冷焦面（红外观测的必要条件） ============
  const astro = new THREE.Group();
  astro.position.set(2.5, -2.05, 0);
  group.add(astro);
  const mirror = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.52, 0.52, 0.07, 18)), mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.25 })));
  astro.add(mirror);
  const segGeo = geo(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 6));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TWO_PI;
    const sg = new THREE.Mesh(segGeo, mat(new THREE.MeshStandardMaterial({ color: 0xfde68a, metalness: 0.9, roughness: 0.2 })));
    sg.position.set(0.34 * Math.cos(a), 0.34 * Math.sin(a), 0.02);
    astro.add(sg);
  }
  const layerMats: import('three').MeshBasicMaterial[] = [];
  for (let i = 0; i < 5; i++) {
    const sh = new THREE.Shape();
    const w = 1.1 - i * 0.04, h = 0.44 - i * 0.02;
    sh.moveTo(0, h); sh.lineTo(w, 0); sh.lineTo(0, -h); sh.lineTo(-w, 0); sh.closePath();
    const m = mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    const q = new THREE.Mesh(geo(new THREE.ShapeGeometry(sh)), m);
    q.position.set(0, -0.72 - i * 0.13, 0);
    q.rotation.x = -0.22;
    astro.add(q);
    layerMats.push(m);
  }
  const detMat = mat(new THREE.MeshStandardMaterial({ color: 0x60a5fa, metalness: 0.3, roughness: 0.5, emissive: 0x1d4ed8, emissiveIntensity: 0.6 }));
  const detBox = new THREE.Mesh(geo(new THREE.BoxGeometry(0.22, 0.18, 0.22)), detMat);
  detBox.position.set(0, 0.34, 0.16);
  astro.add(detBox);

  // ============ 标签 ============
  function makeLabel(text: string, color: string, scale = 3.4): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 25px "PingFang SC", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  const lblCloud = makeLabel('分子云育婴室：τ_V = 8（V 波段光学深）', '#94a3b8', 4.2);
  lblCloud.position.set(CLOUD_CX, CLOUD_CY + 1.75, 0);
  group.add(lblCloud);
  const lblDust = makeLabel('金线 = 云透射 e^{−τ(λ)}', '#fbbf24', 3.2);
  lblDust.position.set(2.0, 3.85, 0);
  group.add(lblDust);
  const lblAtm = makeLabel('蓝线 = 大气窗口（H₂O/CO₂ 吸收）', '#60a5fa', 3.6);
  lblAtm.position.set(3.6, 1.4, 0);
  group.add(lblAtm);
  const lblShield = makeLabel('五层遮阳罩被动降到 40 K，焦面再主动制冷到 6 K', '#a855f7', 4.4);
  lblShield.position.set(2.5, -3.35, 0);
  group.add(lblShield);

  // ============ 星际分子发射线（恒星育婴室）：兑现 concept"分子谱线" ============
  // 大气带是"吸收"，原星/分子云的观测特征则是其"发射线"。标 H₂ 纯转动跃迁线（恒星形成诊断线）。
  const EM_LINES: { lam: number }[] = [
    { lam: 2.12 },   // 近红外 K 波段 H₂ S(1) 1-0：部分透过大气窗，地基/空间皆可测
    { lam: 17.03 },  // 中红外 H₂ S(1) 0-0：落在 CO₂ 15μm 大气带内 ⇒ 只能从空间望远镜观测
  ];
  const emGeo = geo(new THREE.BufferGeometry());
  {
    const pts: number[] = [];
    for (const e of EM_LINES) pts.push(px(e.lam), PLT_Y0, 0.02, px(e.lam), PLT_Y1, 0.02);
    emGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  }
  const emLines = new THREE.LineSegments(emGeo, mat(new THREE.LineDashedMaterial({ color: 0x22c55e, dashSize: 0.06, gapSize: 0.05 })));
  emLines.computeLineDistances(); // 使虚线材质生效
  group.add(emLines);
  for (const e of EM_LINES) {
    const dot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.06, 10, 8)), mat(new THREE.MeshBasicMaterial({ color: 0x22c55e })));
    dot.position.set(px(e.lam), PLT_Y1, 0.02);
    group.add(dot);
  }
  const lblEm = makeLabel('绿虚线 = 星际 H₂ 分子发射线(2.1/17.0μm)：能透大气者地基可见，被带吸收者需空间望远镜', '#22c55e', 4.6);
  lblEm.position.set(2.8, 0.2, 0);
  group.add(lblEm);

  // ============ 面板 ============
  const infoCv = document.createElement('canvas');
  infoCv.width = 900; infoCv.height = 296;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.4, 3.09)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 5.4, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  const ln = (y: number, color: string, text: string, bold = false, size = 26): void => {
    infoCtx.fillStyle = color;
    infoCtx.font = `${bold ? 'bold ' : ''}${size}px "PingFang SC", sans-serif`;
    infoCtx.fillText(text, 22, y);
  };
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 900, 296);
    infoCtx.fillStyle = 'rgba(7,11,20,0.86)';
    infoCtx.fillRect(4, 4, 892, 288);
    infoCtx.strokeStyle = '#334155';
    infoCtx.lineWidth = 3;
    infoCtx.strokeRect(4, 4, 892, 288);
    infoCtx.textAlign = 'left';

    ln(40, '#f8fafc', '红外天文观测 —— 尘埃消光、热背景与空间红外观测', true);
    ln(78, '#fbbf24', `τ(λ) = τ_V(λ/0.55μm)^{−1.8} ⇒ 云透射 e^{−τ} = ${(dustT * 100).toFixed(1)}%（${lam < 1 ? '可见/近红外：尘埃不透明' : lam < 5 ? '近红外：开始透视' : '中红外：几乎全透'}）`);
    ln(112, '#22c55e', `维恩 λ_max = 2898/T μm ⇒ 20 K 冷尘峰在 ${(2898 / 20).toFixed(0)} μm，150 K 暖尘在 ${(2898 / 150).toFixed(0)} μm（原星周包层）`);
    ln(146, '#60a5fa', `大气透过率 = ${((atmT) * 100).toFixed(1)}%${atmT < 0.05 ? ' ⇒ 该波段只能从空间/平流层气球观测' : atmT < 0.6 ? ' ⇒ 需极高极干台址' : ' ⇒ 地面可行'}`);
    ln(180, '#a855f7', `背景抑制 exp[(hc/λk)(1/6K − 1/293K)] = 10^{${supLog.toFixed(0)}}（6.7μm 处焦面必须深冷）`);

    infoCtx.fillStyle = '#f472b6';
    infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：λ = ${lam.toFixed(2)} μm  τ = ${tauNow.toFixed(lam < 2 ? 2 : 3)}  云内可见原星 ${visibleProtos}/6  背景星 ${bgStarMat.opacity > 0.1 ? '可见' : '完全掩埋'}`,
      22, 222,
    );
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '20px "PingFang SC", sans-serif';
    infoCtx.fillText('吸收：蓝线大气带 H₂O/CO₂/O₃ 谱（高斯包络示意）；发射：绿虚线星际 H₂ 分子谱线（恒星育婴室）', 22, 258);
    infoCtx.fillText('分子谱线 = 吸收带 + 发射线：消光定律 τ∝λ⁻¹·⁸ 让红外透视尘埃，发射线示踪原星周气体', 22, 282);
    infoTex.needsUpdate = true;
  }

  function computeState(): void {
    tauNow = tauOf(lam);
    dustT = Math.exp(-tauNow);
    atmT = telluric(lam);
    // 6.7 μm（星际 PAH/甲烷带）处的背景抑制倍数（对数）
    const l = Math.max(lam, 1.2) * 1e-6;
    supLog = ((H_P * C_L) / (l * K_B)) * (1 / 6 - 1 / 293) / Math.LN10;
    updateCloud();
    updateSources();
    // 遮阳罩层温标：热侧 330 K 经 5 层被动辐射屏蔽降到 ~40 K（JWST 实测冷端极限），颜色沿层递减
    const T_HOT = 330, T_COLD = 40;                       // K：热端受晒面 / 被动 MLI 冷端
    const RATIO = Math.pow(T_COLD / T_HOT, 1 / 5);         // 层间 σT⁴ 辐射换热 ⇒ 每层近似固定温比
    for (let i = 0; i < 5; i++) {
      const T = T_HOT * Math.pow(RATIO, i + 1);
      const x = Math.max(0, Math.min(1, (Math.log10(T) - Math.log10(T_COLD)) / (Math.log10(T_HOT) - Math.log10(T_COLD))));
      layerMats[i].color.setRGB(0.29 + 0.71 * x, 0.36 + 0.39 * (1 - x), 0.98 * (1 - x) + 0.15);
    }
    detMat.emissiveIntensity = 0.4 + 0.4 * (1 - Math.min(1, tauNow / 8));
    // 游标
    const cp = cursorGeo.attributes['position'].array as Float32Array;
    cp[0] = px(lam); cp[1] = PLT_Y0 - 0.3; cp[2] = 0;
    cp[3] = px(lam); cp[4] = PLT_Y1 + 0.15; cp[5] = 0;
    cursorGeo.attributes['position'].needsUpdate = true;
    bandDot.position.set(px(lam), py(dustT), 0.01);
    bandDot2.position.set(px(lam), py(atmT), 0.01);
  }

  computeState();
  drawInfo();

  return {
    update(t, dt) {
      t0 = t;
      // 观测波长在 0.4–30 μm 对数扫描，周期 16 s（往复）
      const ph = 0.5 - 0.5 * Math.cos(((t % 16) / 16) * TWO_PI);
      lam = Math.pow(10, lgLo + ph * lgSpan);
      computeState();
      cloudMat.size = 0.1 + 0.06 * (1 - Math.min(1, tauNow / TAU_V));
      const band = ((t * 0.6) % 1);
      mirror.rotation.y = Math.sin(t * 0.4) * 0.25;
      detBox.position.z = 0.16 + 0.02 * Math.sin(t * 3 + band);

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
