import type { SceneContext, SceneInstance } from '../types';
/** 旋光与偏振面旋转（P314）：主控方程
 *  ① 线偏振 = 左/右旋圆偏振叠加，介质中相位常数 k_R≠k_L ⇒ 偏振面转角 α(x) = (k_L−k_R)·x/2
 *  ② 毕奥定律 α = [α]·l·c（糖液 [α]_D = +52.7°·mL/(g·dm)，l=2 dm；c 须以 g/mL 代入，
 *     而面板 c 以 g/100mL 显示 ⇒ 计算用 α = [α]·l·c/100）
 *  ③ 马吕斯：末梢检偏器透光 I = cos²(β_a − α)；消光条件 β_a = α + 90° ⇒ 糖量计由 β_a 反读 c = α/([α]l)
 *  画面：线偏振 E 矢量沿糖液管轴线行进时其方向逐段旋转 —— 三维中螺旋前进的合成波（青），
 *  叠加 R（粉）/L（绿）两列圆偏振分量以展示“相位错位累积”；管末两块小屏：固定 90° 交叉检偏器（未补偿，亮）
 *  与自动跟转 90°+α 的补偿检偏器（消光，暗），亮度均由同一 α 计算。浓度 c 在 16 s 内 0→20 g/100mL 扫描
 *  （糖量计实测量级：α = 52.7×2×20/100 ≈ 21°，刻度盘转角清晰可见）。
 *  ④ 法拉第旋光对照（管上方小段）：θ_F = V·B·l（TGG V≈32°/(T·m)@633nm，l=0.1 m，B 0→2 T 且每半程反向）；
 *     非互易 —— B 反向则转角反向，与自然旋光（只由介质手性决定、与 B 无关）相区别。 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

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
  group.add(grid);

  const DEG = 180 / Math.PI, PI2 = Math.PI * 2;
  const SPEC = 52.7;            // [α]_D 葡萄糖，°·mL/(g·dm)
  const LEN_DM = 2.0;           // 管长 l = 2 dm
  const X0 = -2.6, X1 = 2.6, L = X1 - X0;
  const AMP = 0.42;             // E 振幅（世界单位）

  // —— 糖液管 ——
  const tubeGeo = geo(new THREE.CylinderGeometry(0.62, 0.62, L, 30, 1, true));
  const tube = new THREE.Mesh(tubeGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.09, side: THREE.DoubleSide })));
  tube.rotation.z = Math.PI / 2;
  tube.position.set(0, 0.4, 0);
  group.add(tube);
  const tubeEdge = new THREE.Mesh(tubeGeo, mat(new THREE.MeshBasicMaterial({ color: 0x64748b, wireframe: true, transparent: true, opacity: 0.14 })));
  tubeEdge.rotation.z = Math.PI / 2;
  tubeEdge.position.copy(tube.position);
  group.add(tubeEdge);

  function curve(color: number, n: number, op: number, lw = 0): { g: import('three').BufferGeometry; m: import('three').LineBasicMaterial } {
    void lw;
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const m = mat(new THREE.LineBasicMaterial({ color, transparent: true, opacity: op }));
    group.add(new THREE.Line(g, m));
    return { g, m };
  }
  const N = 97;
  const cMain = curve(0x22d3ee, N, 1);           // 合成线偏振 E 波
  const cR = curve(0xf472b6, N, 0.55);           // R 圆分量
  const cL = curve(0x22c55e, N, 0.55);           // L 圆分量
  const spine = curve(0x334155, 2, 0.6);         // 管轴线
  function setPts(pl: { g: import('three').BufferGeometry }, pts: import('three').Vector3[]): void {
    const arr = pl.g.attributes['position'].array as Float32Array;
    pts.forEach((p, i) => { arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z; });
    pl.g.attributes['position'].needsUpdate = true;
    pl.g.setDrawRange(0, pts.length);
  }

  // —— 起偏器 / 检偏器圆盘 + 透光轴条 ——
  const discGeo = geo(new THREE.CircleGeometry(0.72, 42));
  function setLinePts(line: import('three').Line, pts: import('three').Vector3[]): void {
    const g = line.geometry as import('three').BufferGeometry;
    const arr = g.attributes['position'].array as Float32Array;
    pts.forEach((p, i) => { arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z; });
    g.attributes['position'].needsUpdate = true;
    g.setDrawRange(0, pts.length);
  }
  function polarizer(x: number, zOff: number, col: number): { disc: import('three').Mesh; axis: import('three').Line; ring: import('three').Mesh } {
    const disc = new THREE.Mesh(discGeo, mat(new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.13, side: THREE.DoubleSide })));
    disc.position.set(x, 0.4, zOff);
    disc.rotation.y = Math.PI / 2;
    group.add(disc);
    const ring = new THREE.Mesh(geo(new THREE.RingGeometry(0.72, 0.8, 42)), mat(new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, side: THREE.DoubleSide })));
    ring.position.copy(disc.position); ring.rotation.y = Math.PI / 2;
    group.add(ring);
    const ag = geo(new THREE.BufferGeometry());
    ag.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
    const axis = new THREE.Line(ag, mat(new THREE.LineBasicMaterial({ color: 0xf8fafc })));
    group.add(axis);
    return { disc, axis, ring };
  }
  const polIn = polarizer(X0 - 0.25, 0, 0x22d3ee);
  const polFix = polarizer(X1 + 0.35, -1.0, 0xfbbf24);   // 固定交叉（90°）：未补偿屏
  const polComp = polarizer(X1 + 0.35, 1.0, 0xa855f7);   // 自动补偿（90°+α）：消光屏

  // 屏（小发光方片）
  const scrGeo = geo(new THREE.PlaneGeometry(1.1, 1.1));
  const scrFix = new THREE.Mesh(scrGeo, mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.2, side: THREE.DoubleSide })));
  scrFix.position.set(X1 + 0.95, 0.4, -1.0); scrFix.rotation.y = Math.PI / 2;
  group.add(scrFix);
  const scrComp = new THREE.Mesh(scrGeo, mat(new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.2, side: THREE.DoubleSide })));
  scrComp.position.set(X1 + 0.95, 0.4, 1.0); scrComp.rotation.y = Math.PI / 2;
  group.add(scrComp);

  // 行进波包（沿管飞的亮点，演示 E 方向逐段旋转）
  const puck = new THREE.Mesh(geo(new THREE.SphereGeometry(0.08, 12, 10)), mat(new THREE.MeshBasicMaterial({ color: 0xf8fafc })));
  group.add(puck);
  const puckVec = curve(0xfef3c7, 2, 0.95);

  function makeLabel(text: string, color: string, scale: number, pos: import('three').Vector3): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    s.position.copy(pos);
    return s;
  }
  group.add(makeLabel('起偏器（竖直 0°）', '#22d3ee', 3.0, new THREE.Vector3(X0 - 0.3, 1.75, 0)));
  group.add(makeLabel('糖液管 l=2 dm', '#94a3b8', 3.0, new THREE.Vector3(0, 1.6, -0.9)));
  group.add(makeLabel('固定 90°：亮（未补偿）', '#fbbf24', 3.2, new THREE.Vector3(X1 + 0.9, -0.9, -1.0)));
  group.add(makeLabel('跟转 90°+α：消光', '#a855f7', 3.2, new THREE.Vector3(X1 + 0.9, -0.9, 1.0)));

  // —— 转角刻度盘（管末，沿轴线看 E 的落点方向） ——
  const dialGeo = geo(new THREE.BufferGeometry());
  {
    const pts: number[] = [];
    for (let k = 0; k <= 64; k++) {
      const a = (k / 64) * PI2;
      pts.push(X1 + 0.12, 0.4 + 0.9 * Math.cos(a), 0.9 * Math.sin(a));
    }
    dialGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  }
  group.add(new THREE.Line(dialGeo, mat(new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.6 }))));
  const dialHand = curve(0xf8fafc, 2, 1);

  // —— 法拉第旋光对照小段（管上方）：θ_F = V·B·l，B 反向 ⇒ 转角反向（非互易） ——
  const VERDET = 32;                 // TGG Verdet 常数 ~32 °/(T·m) @633 nm
  const FLEN = 0.1;                  // 磁光晶体长度 (m)
  const FX0 = -1.0, FX1 = 1.0, FY = 2.75;
  const farBlock = new THREE.Mesh(geo(new THREE.BoxGeometry(FX1 - FX0, 0.44, 0.44)),
    mat(new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.15 })));
  farBlock.position.set(0, FY, 0);
  group.add(farBlock);
  const bArrow = curve(0x22c55e, 2, 0.95);
  const bCone = new THREE.Mesh(geo(new THREE.ConeGeometry(0.08, 0.26, 10)), mat(new THREE.MeshBasicMaterial({ color: 0x22c55e })));
  group.add(bCone);
  const farDialGeo = geo(new THREE.BufferGeometry());
  {
    const pts: number[] = [];
    for (let k = 0; k <= 48; k++) {
      const a = (k / 48) * PI2;
      pts.push(FX1 + 0.35, FY + 0.55 * Math.cos(a), 0.55 * Math.sin(a));
    }
    farDialGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  }
  group.add(new THREE.Line(farDialGeo, mat(new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.6 }))));
  const farIn = curve(0xf8fafc, 2, 0.7);   // 入射竖直偏振参考
  setPts(farIn, [new THREE.Vector3(FX1 + 0.35, FY, 0), new THREE.Vector3(FX1 + 0.35, FY + 0.55, 0)]);
  const farHand = curve(0x22c55e, 2, 1);   // 出射转角指针（放大 5×显示）
  group.add(makeLabel('法拉第旋光对照 θ_F=V·B·l（B 反向⇒旋向反向，非互易）', '#22c55e', 4.0, new THREE.Vector3(0, FY + 1.0, 0)));

  // —— 主面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 860; infoCv.height = 330;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.0, 3.45)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 5.9, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  let c = 0, alphaDeg = 0, iFix = 0, iComp = 0, bFar = 0, thetaFDeg = 0;

  // —— R/L 圆分量相位标记（管中点）：葡萄糖中 v_L≠v_R，夹角随 α 累积 ——
  const mR = new THREE.Mesh(geo(new THREE.SphereGeometry(0.075, 10, 8)), mat(new THREE.MeshBasicMaterial({ color: 0xf87171 })));
  const mL = new THREE.Mesh(geo(new THREE.SphereGeometry(0.075, 10, 8)), mat(new THREE.MeshBasicMaterial({ color: 0x818cf8 })));
  group.add(mR, mL);

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 860, 330);
    infoCtx.fillStyle = 'rgba(7,11,20,0.86)';
    infoCtx.fillRect(4, 4, 852, 322);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 852, 322);
    infoCtx.textAlign = 'left';
    const ln = (y: number, col: string, s: string, bold = false, sz = 26): void => {
      infoCtx.fillStyle = col; infoCtx.font = `${bold ? 'bold ' : ''}${sz}px "PingFang SC", sans-serif`;
      infoCtx.fillText(s, 22, y);
    };
    ln(40, '#f8fafc', '旋光：α = [α]·l·c/100（c:g/100mL，[α]:°·mL/(g·dm)）', true);
    ln(76, '#22d3ee', 'R/L 圆分量相位错位累积：α(x) = (k_L−k_R)·x/2');
    ln(110, '#a855f7', '消光条件：检偏器转到 β_a = 90°+α（糖量计反读浓度）');
    ln(146, '#fbbf24', `读数：c=${c.toFixed(2)} g/100mL  α=${alphaDeg.toFixed(2)}°  补偿角=${(90 + alphaDeg).toFixed(1)}°`, true, 24);
    ln(176, '#fbbf24', `未补偿屏 I=cos²(90°−α)=${iFix.toFixed(3)}  补偿屏 I=${iComp.toFixed(4)}（消光）`, false, 24);
    ln(208, '#22c55e', `法拉第对照：θ_F=V·B·l=${thetaFDeg.toFixed(1)}°（V=32°/(T·m)，B=${Math.abs(bFar).toFixed(2)} T${bFar < 0 ? '，B 已反向 ⇒ θ_F<0' : ''}，l=0.1 m）`, false, 22);
    ln(236, '#22c55e', '自然旋光与 B 无关且互易；法拉第旋光由 B 决定、非互易（往返转角相加不抵消）', false, 20);
    ln(264, '#94a3b8', `[α]_D(葡萄糖)=+52.7°·mL/(g·dm)，右旋 ⇒ 正 α`, false, 22);
    ln(290, '#94a3b8', `圆双折射相位差 Δφ=2α=${(2 * alphaDeg).toFixed(1)}°：红=R、蓝=L 分量（管中点）`, false, 19);
    ln(314, '#94a3b8', '注：R/L 分解为示意近似（相位偏置非精确正交）；法拉第刻度盘转角放大 5× 显示', false, 17);
    infoTex.needsUpdate = true;
  }

  function solve(tt: number): void {
    const phiEnd = alphaDeg / DEG;
    setPts(spine, [new THREE.Vector3(X0, 0.4, 0), new THREE.Vector3(X1, 0.4, 0)]);
    const main: import('three').Vector3[] = [], hr: import('three').Vector3[] = [], hl: import('three').Vector3[] = [];
    for (let k = 0; k < N; k++) {
      const u = k / (N - 1), x = X0 + u * L;
      const phi = phiEnd * u;                          // 偏振面角 α(x)
      const osc = Math.cos(PI2 * (3 * u) - tt * 2.6);  // 可见光周期载波（时间演化）
      const dirY = Math.cos(phi), dirZ = Math.sin(phi);
      main.push(new THREE.Vector3(x, 0.4 + AMP * osc * dirY, AMP * osc * dirZ));
      const ps = PI2 * (3 * u) - tt * 2.6;
      const b = PI2 * 0.42;                            // R/L 相对半张角（示意叠加基）
      hr.push(new THREE.Vector3(x, 0.4 + AMP * 0.6 * Math.cos(ps + b + phi), AMP * 0.6 * Math.sin(ps + b + phi)));
      hl.push(new THREE.Vector3(x, 0.4 + AMP * 0.6 * Math.cos(-ps + b + phi), AMP * 0.6 * Math.sin(-ps + b + phi)));
    }
    setPts(cMain, main); setPts(cR, hr); setPts(cL, hl);
    // 起偏器轴：竖直 ŷ
    setLinePts(polIn.axis, [new THREE.Vector3(X0 - 0.25, 0.4 - 0.62, 0), new THREE.Vector3(X0 - 0.25, 0.4 + 0.62, 0)]);
    // 固定 90° 检偏轴（ẑ 方向）
    setLinePts(polFix.axis, [new THREE.Vector3(X1 + 0.35, 0.4, -0.62), new THREE.Vector3(X1 + 0.35, 0.4, 0.62)]);
    // 补偿检偏轴 β_a = 90°+α：方向 = cos(90+α)ŷ+sin(90+α)ẑ
    const ba = (90 + alphaDeg) / DEG;
    setLinePts(polComp.axis, [
      new THREE.Vector3(X1 + 0.35, 0.4 - 0.62 * Math.cos(ba), -0.62 * Math.sin(ba)),
      new THREE.Vector3(X1 + 0.35, 0.4 + 0.62 * Math.cos(ba), 0.62 * Math.sin(ba)),
    ]);
    iFix = Math.cos(Math.PI / 2 - phiEnd) ** 2;
    iComp = Math.cos(ba - phiEnd) ** 2 * 1e-4;
    (scrFix.material as import('three').MeshBasicMaterial).opacity = 0.08 + 0.85 * iFix;
    (scrComp.material as import('three').MeshBasicMaterial).opacity = 0.05 + 0.9 * iComp;
    // 刻度盘指针 = 管末 E 方向角 α
    const hy = 0.4 + 0.9 * Math.cos(phiEnd), hz = 0.9 * Math.sin(phiEnd);
    setPts(dialHand, [new THREE.Vector3(X1 + 0.12, 0.4, 0), new THREE.Vector3(X1 + 0.12, hy, hz)]);
    // 行进波包
    const u = (tt * 0.45) % 1, x = X0 + u * L, phi = phiEnd * u;
    const dir = new THREE.Vector3(0, Math.cos(phi), Math.sin(phi));
    puck.position.set(x, 0.4, 0).addScaledVector(dir, AMP * 0.9 * Math.cos(PI2 * 3 * u - tt * 2.6));
    setPts(puckVec, [puck.position.clone().addScaledVector(dir, -0.3), puck.position.clone().addScaledVector(dir, 0.3)]);
    // R/L 标记：管中点处两圆分量夹角（示意基，张开量随 α 单调增）
    const kMid = Math.floor((N - 1) * 0.5);
    mR.position.copy(hr[kMid]);
    mL.position.copy(hl[kMid]);
    // 法拉第对照：B 幅值 0→2 T 余弦扫描，每 16 s 反向一次（非互易演示）
    const bMag = 2 * (0.5 - 0.5 * Math.cos((tt % 16) / 16 * PI2));
    bFar = tt % 32 < 16 ? bMag : -bMag;
    thetaFDeg = VERDET * bFar * FLEN;
    const sgn = bFar >= 0 ? 1 : -1;
    const ay = FY - 0.52;
    setPts(bArrow, [new THREE.Vector3(-sgn * (FX1 + 0.15), ay, 0), new THREE.Vector3(sgn * (FX1 + 0.02), ay, 0)]);
    bCone.position.set(sgn * (FX1 + 0.15), ay, 0);
    bCone.rotation.z = -sgn * Math.PI / 2;
    const phiF = (thetaFDeg / DEG) * 5;  // 显示放大 5×（面板已注明）
    setPts(farHand, [
      new THREE.Vector3(FX1 + 0.35, FY, 0),
      new THREE.Vector3(FX1 + 0.35, FY + 0.55 * Math.cos(phiF), 0.55 * Math.sin(phiF)),
    ]);
  }

  function update(t: number, dt: number): void {
    c = 20 * (0.5 - 0.5 * Math.cos((t % 16) / 16 * 2 * Math.PI));   // 0→20 g/100mL，糖量计实测量级
    alphaDeg = SPEC * LEN_DM * c / 100;   // c 为 g/100mL，[α] 要求 g/mL ⇒ 除以 100
    solve(t);
    if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
  }

  alphaDeg = SPEC * LEN_DM * 10 / 100; c = 10;
  solve(0);
  drawInfo();

  return {
    update,
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
