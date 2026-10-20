import type { SceneContext, SceneInstance } from '../types';
/**
 * 金属玻璃（P387）—— 主控方程（JMAI 等温转变 + 连续冷却，Zr 基 BMG 实参数，node 已复核）：
 *   鼻尖动力学    t_s(T) = t_min·exp[((T−T_n)/W_n)²]，t_min=250 s，T_n=800 K，W_n=170 K
 *                 （Tl=1100 K，Tg=650 K ⇒ T_n≈0.73Tl，符合"鼻尖在 0.6–0.8Tl"经验）
 *   连续冷却      线性路径 T(t)=Tl−R·t ⇒ 累计破坏度 p(R)=∫_{Tg}^{Tl} dT/(R·t_s(T)) = I/R
 *                 I=∫dT/t_s=1.070 K/s（高斯积分实算）
 *   Johnson–Mehl  X = 1 − exp(−pⁿ)，n=1（ site saturation 近似）⇒ X=0.01（玻璃形成判据）时
 *                 R_c = I/0.0101 = 106 K/s —— 与 Zr 基 BMG 的临界冷却速率（~100 K/s，可铸 mm 厚）同量级 ✓
 *                 R=0.1 K/s ⇒ X=99.998%（炉冷＝全晶态）；R=1 K/s ⇒ X=65.7%；R=1e5 ⇒ X=1.07×10⁻⁵（非晶）
 *   结构/能量     非晶比容 +2%（ΔV/V=0.02 ⇒ 线性膨胀 (1.02)^⅓）；STZ 密度 ∝ 自由体积
 *   Argon 屈服    σ_y ≈ 0.02·μ（μ=96 GPa ⇒ 1.92 GPa，是同质晶态的 3–5 倍，且无位错可动）
 * 画面：同一熔体的两条命运——原子从"有序晶格位"到"密堆无序位"按结晶度 X 连续插值；
 * 非晶块被切开（前半 z>0 隐藏，露出截面）看内部自由体积空洞与剪切转变区（STZ）团簇；
 * 右侧 TTT 图（C 曲线＋鼻尖＋禁入区）上叠一条由当前冷却速率 R 决定的直线路径，是否切进 C 曲线一目了然。
 * 扫描自变量：冷却速率 R 在 18 s 内 0.1↔10⁵ K/s 对数往复；X、路径线、原子位置、空洞数全部同源。
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

  // —— 动力学参数 ——
  const TL = 1100, TG = 650, TN = 800, WN = 170, TMIN = 250, NJMA = 1, XCRIT = 0.01;
  const tsOf = (T: number) => TMIN * Math.exp(Math.pow((T - TN) / WN, 2));
  // I = ∫_{Tg}^{Tl} dT/t_s(T)（Simpson 实算，供临界冷却速率与面板用）
  let IV = 0;
  {
    const n = 400, h = (TL - TG) / n;
    for (let i = 0; i <= n; i++) {
      const w = i === 0 || i === n ? 1 : (i % 2 === 1 ? 4 : 2);
      IV += w / tsOf(TG + i * h);
    }
    IV *= h / 3;
  }
  const RC = IV / (-Math.log(1 - XCRIT));                    // ≈106 K/s
  const pOf = (R: number) => IV / R;
  const xOf = (R: number) => 1 - Math.exp(-Math.pow(pOf(R), NJMA));
  const MU = 96e9, SY_GLASS = 0.02 * MU, DVV = 0.02;

  const R_MIN = 0.1, R_MAX = 1e5, CY = 18;

  // —— 星野 + 地面 ——
  {
    const g = geo(new THREE.BufferGeometry());
    const p = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      p[i * 3] = (Math.random() - 0.5) * 200; p[i * 3 + 1] = (Math.random() - 0.5) * 200; p[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    group.add(new THREE.Points(g, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  }
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // —— 原子：BCC 晶格位 + 无序（密堆抖动）位；切开前半 ——
  const LA = 0.52;                        // world 晶格常数（1wu ⇔ 0.36/0.52 = 0.692 nm ⇒ 面板给真实值）
  const NM = 8;                           // 每边单胞数（8³×2 = 1024 原子，切半后 ~512）
  const CX = -(NM * LA) / 2 - 0.55, CY0 = 1.62, CZ = 0;
  const lat: number[] = [];
  for (let i = 0; i < NM; i++) for (let j = 0; j < NM; j++) for (let k = 0; k < NM; k++) {
    for (const off of [[0, 0, 0], [0.5, 0.5, 0.5]]) {
      lat.push(CX + (i + off[0]) * LA, CY0 + (j + off[1]) * LA - (NM * LA) / 2, CZ + (k + off[2]) * LA - (NM * LA) / 2);
    }
  }
  const NTOT = lat.length / 3;
  let sd = 77777;
  const rnd = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff; };
  const jit = new Float32Array(NTOT * 3);
  const AMP = LA * 0.36;
  for (let i = 0; i < NTOT; i++) {
    const a = rnd() * TWO_PI, e = Math.acos(2 * rnd() - 1), r = AMP * (0.55 + 0.85 * rnd());
    jit[i * 3] = r * Math.sin(e) * Math.cos(a); jit[i * 3 + 1] = r * Math.cos(e); jit[i * 3 + 2] = r * Math.sin(e) * Math.sin(a);
  }
  const atomGeo = geo(new THREE.SphereGeometry(1, 9, 7));
  const crystMat = mat(new THREE.MeshStandardMaterial({ color: 0x93c5fd, metalness: 0.72, roughness: 0.28 }));
  const meshC = new THREE.InstancedMesh(atomGeo, crystMat, NTOT);
  meshC.frustumCulled = false;
  group.add(meshC);
  const mtx = new THREE.Matrix4(), vP = new THREE.Vector3(), vS = new THREE.Vector3(0.105, 0.105, 0.105), q = new THREE.Quaternion(0, 0, 0, 1);

  // —— 切面（前半 z>0 隐藏，此处画出切割面）——
  const cutGeo = geo(new THREE.PlaneGeometry(NM * LA + 0.3, NM * LA + 0.3));
  const cutMat = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false }));
  const cutPlane = new THREE.Mesh(cutGeo, cutMat);
  cutPlane.position.set(CX + NM * LA / 2 - LA / 2, CY0, 0.02);
  group.add(cutPlane);

  // —— 自由体积空洞 + STZ 团簇（均在非晶区出现）——
  const NCAV = 120;
  const cavGeo = geo(new THREE.SphereGeometry(1, 8, 6));
  const cavMat = mat(new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xdb2777, emissiveIntensity: 0.5, transparent: true, opacity: 0.42, depthWrite: false }));
  const cav = new THREE.InstancedMesh(cavGeo, cavMat, NCAV);
  cav.frustumCulled = false;
  const cavPos = new Float32Array(NCAV * 3);
  for (let i = 0; i < NCAV; i++) {
    cavPos[i * 3] = CX + rnd() * NM * LA; cavPos[i * 3 + 1] = CY0 - NM * LA / 2 + rnd() * NM * LA; cavPos[i * 3 + 2] = -NM * LA / 2 + rnd() * NM * LA * 0.5;
  }
  group.add(cav);
  const NSTZ = 30;
  const stzGeo = geo(new THREE.BoxGeometry(1, 1, 1));
  const stzMat = mat(new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.65, transparent: true, opacity: 0.34, depthWrite: false }));
  const stz = new THREE.InstancedMesh(stzGeo, stzMat, NSTZ);
  stz.frustumCulled = false;
  const stzPos = new Float32Array(NSTZ * 3), stzRot = new Float32Array(NSTZ * 3);
  for (let i = 0; i < NSTZ; i++) {
    stzPos[i * 3] = CX + rnd() * NM * LA; stzPos[i * 3 + 1] = CY0 - NM * LA / 2 + rnd() * NM * LA; stzPos[i * 3 + 2] = -NM * LA / 2 + rnd() * NM * LA * 0.5;
    stzRot[i * 3] = rnd() * PI; stzRot[i * 3 + 1] = rnd() * PI; stzRot[i * 3 + 2] = rnd() * PI;
  }
  group.add(stz);
  const eu = new THREE.Euler();

  // —— TTT 图（竖直面 z=TZ，横轴 log₁₀t，纵轴 T）——
  const TZ = 1.35, TX0 = 2.15, TX1 = 4.65, TY0 = 0.15, TY1 = 3.15;
  const LT0 = -1, LT1 = 4.5;                        // log10 t 轴范围（0.1 s … 3×10⁴ s）
  const xT = (T: number) => TY0 + (TY1 - TY0) * (T - TG) / (TL - TG);
  const xLt = (lt: number) => TX0 + (TX1 - TX0) * (lt - LT0) / (LT1 - LT0);
  const nPts = 90;
  const ttGeo = geo(new THREE.BufferGeometry());
  ttGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nPts * 3), 3));
  group.add(new THREE.Line(ttGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e }))));
  {
    const p = ttGeo.attributes['position'].array as Float32Array;
    for (let i = 0; i < nPts; i++) {
      const T = TG + (TL - TG) * i / (nPts - 1);
      p[i * 3] = xLt(Math.log10(tsOf(T))); p[i * 3 + 1] = xT(T); p[i * 3 + 2] = TZ;
    }
    ttGeo.attributes['position'].needsUpdate = true;
  }
  // 禁入区（C 曲线右侧）
  const zoneGeo = geo(new THREE.BufferGeometry());
  const zIdx: number[] = [], zPos = new Float32Array((nPts * 2) * 3);
  for (let i = 0; i < nPts; i++) {
    const T = TG + (TL - TG) * i / (nPts - 1);
    zPos[i * 3] = xLt(Math.log10(tsOf(T))); zPos[i * 3 + 1] = xT(T); zPos[i * 3 + 2] = TZ;
    zPos[(nPts + i) * 3] = TX1; zPos[(nPts + i) * 3 + 1] = xT(T); zPos[(nPts + i) * 3 + 2] = TZ;
  }
  for (let i = 0; i < nPts - 1; i++) {
    const a = i, b = nPts + i, c = i + 1, d = nPts + i + 1;
    zIdx.push(a, b, c, c, b, d);
  }
  zoneGeo.setAttribute('position', new THREE.BufferAttribute(zPos, 3));
  zoneGeo.setIndex(zIdx);
  zoneGeo.computeVertexNormals();
  group.add(new THREE.Mesh(zoneGeo, mat(new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }))));
  // 坐标框 + Tg/Tl/Tn 参考线
  const frGeo = geo(new THREE.BufferGeometry());
  frGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    TX0, TY0, TZ, TX1, TY0, TZ, TX0, TY0, TZ, TX0, TY1, TZ,
    TX0, xT(TG), TZ, TX1, xT(TG), TZ, TX0, xT(TL), TZ, TX1, xT(TL), TZ,
  ]), 3));
  group.add(new THREE.LineSegments(frGeo, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));
  // 冷却路径线（40 段）
  const NP2 = 60;
  const coGeo = geo(new THREE.BufferGeometry());
  coGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP2 * 3), 3));
  const coMat = mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 }));
  group.add(new THREE.Line(coGeo, coMat));
  const nose = new THREE.Mesh(geo(new THREE.SphereGeometry(0.075, 12, 10)), mat(new THREE.MeshBasicMaterial({ color: 0x22c55e })));
  nose.position.set(xLt(Math.log10(TMIN)), xT(TN), TZ);
  group.add(nose);

  // —— 标签 ——
  function makeLabel(text: string, color: string, sx = 4.6): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 768; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 384, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(sx, sx / 12, 1);
    return s;
  }
  const l1 = makeLabel('切开看内部：金色＝冻住的无序密堆，蓝＝排好的晶格，空洞＝自由体积', '#fcd34d', 6.4); l1.position.set(-1.4, 3.4, 0.4);
  const l2 = makeLabel('TTT 的 C 曲线：路径越靠左＝冷却越快＝逃过鼻尖', '#86efac', 5.2); l2.position.set((TX0 + TX1) / 2, TY1 + 0.34, TZ);
  const l3 = makeLabel('红块＝剪切转变区 STZ（非晶的唯一塑性载体，尺度～nm）', '#fca5a5', 5.4); l3.position.set(-1.2, 0.42, 1.6);
  group.add(l1, l2, l3);

  // —— 面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 880; infoCv.height = 274;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.6, 2.99)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 4.72, 0); infoPlane.renderOrder = 999;
  group.add(infoPlane);

  const rd = { R: 1, X: 0, t: 0, p: 0, cav: 0, stz: 0, glassy: false, dn: 0 };
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 880, 274);
    infoCtx.fillStyle = 'rgba(7,11,20,0.84)'; infoCtx.fillRect(4, 4, 872, 266);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 872, 266);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText('金属玻璃：一场与鼻尖赛跑的冻结', 22, 34);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('t_s(T)=t_min·exp[((T−T_n)/W_n)²]　X=1−exp[−(∫dt/t_s)]　p=I/R，I=∫dT/t_s', 22, 64);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText(`临界冷却速率 R_c=I/0.0101=${RC.toFixed(0)} K/s（Zr 基 BMG 量级，可铸 mm 厚）；Tl=1100K Tg=650K T_n=800K`, 22, 92);
    infoCtx.fillStyle = '#22c55e';
    infoCtx.fillText(`Argon STZ：σ_y≈0.02μ（μ=96GPa ⇒ ${(SY_GLASS / 1e6).toFixed(0)} MPa），比晶态高 3–5 倍；非晶多余体积 ${DVV * 100}%`, 22, 120);
    infoCtx.fillStyle = rd.glassy ? '#f472b6' : '#ef4444';
    infoCtx.fillText(rd.glassy
      ? '非晶态：逃过 C 曲线，无序密堆被冻结，无位错、只有 STZ'
      : (rd.X > 0.995 ? '全晶态：路径横穿 C 曲线，原子排成有序点阵' : '部分晶化：C 曲线内外各占一半，脆而不均'), 22, 148);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 22px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：R=${rd.R >= 1000 ? rd.R.toExponential(1) : rd.R.toFixed(2)} K/s　t(Tl→Tg)=${rd.t >= 1000 ? (rd.t / 1e3).toFixed(1) + ' ks' : rd.t.toFixed(1) + ' s'}　p=∫dt/t_s=${rd.p < 0.01 ? rd.p.toExponential(2) : rd.p.toFixed(3)}`, 22, 180);
    infoCtx.fillText(`　　　结晶度 X=${rd.X < 0.001 ? rd.X.toExponential(2) : (rd.X * 100).toFixed(2) + '%'}　自由体积空洞 ${rd.cav}/${NCAV}　STZ 团簇 ${rd.stz}/${NSTZ}`, 22, 208);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '20px "PingFang SC", sans-serif';
    infoCtx.fillText(`标尺：画面 1wu ⇔ ${(0.36 / 0.52).toFixed(3)} nm（BCC a=0.36nm 示意）；无序位＝晶格位 + 抖动 ${AMP.toFixed(3)}wu；路径线斜率由当前 R 决定`, 22, 240);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  return {
    update(t, dt) {
      const ph = (t % CY) / CY;
      const s = 0.5 - 0.5 * Math.cos(TWO_PI * ph);
      const R = R_MIN * Math.pow(R_MAX / R_MIN, s);              // 自变量：冷却速率
      const X = xOf(R), p = pOf(R);
      const tCool = (TL - TG) / R;
      const lin = Math.pow(1 + DVV, 1 / 3);
      rd.glassy = X < 0.01;

      // 原子位置：晶格位 ←→ 无序密堆位，按结晶度 X 连续插值；前半（z>0）隐藏＝切开视观
      let nc = 0;
      for (let i = 0; i < NTOT; i++) {
        const lz = lat[i * 3 + 2];
        if (lz > 0.02) continue;
        const lx = lat[i * 3], ly = lat[i * 3 + 1];
        const cxv = CX + (lx - CX) * lin, cyv = CY0 + (ly - CY0) * lin;
        const ax = cxv + jit[i * 3], ay = cyv + jit[i * 3 + 1], az = lz * lin + jit[i * 3 + 2];
        const w = 1 - X;                                          // 非晶权重：X=1 全晶态 → w=0
        vP.set(lx + (ax - lx) * w, ly + (ay - ly) * w, lz + (az - lz) * w);
        q.set(0, 0, 0, 1); vS.setScalar(0.105);
        mtx.compose(vP, q, vS); meshC.setMatrixAt(nc++, mtx);
      }
      meshC.count = nc;
      meshC.instanceMatrix.needsUpdate = true;
      crystMat.color.setRGB(0.58 + 0.405 * (1 - X), 0.78 - 0.031 * (1 - X), 0.99 - 0.849 * (1 - X));

      // 空洞与 STZ：数量 ∝ 非晶分数
      const nCav = Math.round(NCAV * (1 - X));
      for (let i = 0; i < nCav; i++) {
        vP.set(cavPos[i * 3], cavPos[i * 3 + 1], cavPos[i * 3 + 2]);
        vS.setScalar(0.045 + 0.055 * DVV * 20);
        mtx.compose(vP, q, vS); cav.setMatrixAt(i, mtx);
      }
      cav.count = nCav; cav.instanceMatrix.needsUpdate = true;
      cavMat.opacity = 0.16 + 0.4 * (1 - X);
      const nStz = Math.round(NSTZ * (1 - X));
      for (let i = 0; i < nStz; i++) {
        vP.set(stzPos[i * 3], stzPos[i * 3 + 1], stzPos[i * 3 + 2]);
        eu.set(stzRot[i * 3], stzRot[i * 3 + 1], stzRot[i * 3 + 2]);
        q.setFromEuler(eu); vS.set(0.26, 0.09, 0.14);
        mtx.compose(vP, q, vS); stz.setMatrixAt(i, mtx);
      }
      stz.count = nStz; stz.instanceMatrix.needsUpdate = true;
      stzMat.opacity = 0.12 + 0.34 * (1 - X);

      // 冷却路径线：T=Tl−R·t，画在 (log10 t, T) 轴上
      {
        const pp = coGeo.attributes['position'].array as Float32Array;
        for (let i = 0; i < NP2; i++) {
          const f = i / (NP2 - 1);
          const tt = Math.pow(10, LT0 + (LT1 - LT0) * f);
          const Tv = TL - R * tt;
          pp[i * 3] = xLt(LT0 + (LT1 - LT0) * f);
          pp[i * 3 + 1] = xT(Math.max(TG - 40, Math.min(TL + 8, Tv)));
          pp[i * 3 + 2] = TZ;
        }
        coGeo.attributes['position'].needsUpdate = true;
        coGeo.setDrawRange(0, NP2);
      }
      coMat.color.setHex(X < 0.01 ? 0x22c55e : 0xfbbf24);

      rd.R = R; rd.X = X; rd.t = tCool; rd.p = p; rd.cav = nCav; rd.stz = nStz; rd.dn = DVV * 100;
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
