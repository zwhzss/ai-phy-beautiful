import type { SceneContext, SceneInstance } from '../types';
/**
 * 马兰戈尼效应（P192）—— 主控方程（等溶质毛细 Marangoni 应力 vs 重力排液，node 复核）：
 *   表面张力    γ(c)=γ_w−|dγ/dc|·c（稀乙醇线性近似）；γ_w=72.8、γ_e=22.3 mN/m（293K 实测）
 *               ⇒ |dγ/dc|=50.5 mN/m（按两端点线性）；12%vol 酒 γ=66.7 mN/m（实测 ~60，线性近似略高）
 *   界面切应力  膜顶乙醇蒸发亏损 Δc ⇒ Δγ=|dγ/dc|Δc，沿爬升高度 H=8mm 线性铺开
 *               τ_s=Δγ/H［Pa=N/m²］——界面切应力的量纲正确写法
 *   膜速（竖直膜 Stokes 平行流精确解）  U=τ_s·d/μ − ρg d²/(2μ)（前项界面拖曳↑、后项重力排液↓）
 *     d=30µm、μ=1.2mPa·s、ρ=960 ⇒ 排液项 ρgd²/2μ=3.53mm/s（与 Δc 无关的常数底）
 *     复核 Δc=0.05：τ_s=0.0505·0.05/0.008=0.3156Pa ⇒ 界面项 7.89mm/s ⇒ U=+4.36mm/s↑
 *           Δc=0.0224 ⇒ U=0（临界）；Δc=0 ⇒ U=−3.53mm/s↓（只剩排液）✓
 *     临界亏损 Δc*=ρgdH/(2|dγ/dc|)=0.0224——挂杯"活/死"的分界，落在扫描区间内 ✓
 *   Marangoni 数 Ma_s=Δγ·d/(μD)（D=1e-9m²/s）：Δc=0.05 ⇒ 6.3×10⁴ ≫ 线性临界 79.6 ⇒ 界面流必然 ✓
 *     热毛细对照（文献给挂杯常引的量级）Ma_T=|dγ/dT|ΔT·L/(μα)，γ_T=0.17mN/(m·K)、ΔT=2K、L=H
 *     ⇒ Ma_T=1.9×10⁴：已超过线性临界 79.6 约 240×（文献常引的 10²–10⁴ 是起算带，挂杯显然远在带上）
 *   回落泪珠     排液律按 3 倍膜厚：U_f=ρg(3d)²/(2μ)=9×3.53=31.8mm/s↓（比爬升快一个量级——泪是掉下来的）
 *   毛细长度     l_c=√(γ/ρg)=2.66mm 设定泪滴尺度（实测挂杯泪 1–3mm ✓，画面按真实比例）
 *   扫描自变量：膜顶乙醇亏损 Δc 在 16s 内 0↔0.05 往复。Δγ、τ_s、U、膜鼓包厚、色场（红=低γ→青=高γ）、
 *   液滴爬升/回落速度、箭头指向与长度、U(Δc) 光标、面板每一行数字全部来自同一个 Δc。
 *   标尺：竖直膜区高 H=8mm ⇔ 画面 2.8wu（1wu⇔2.86mm）；真实膜厚 30µm 太薄，鼓包示意放大；动画慢放 ×0.35。
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

  // —— SI 真实参数 ——
  const GW = 72.8e-3, SLOPE = 50.5e-3, C0 = 0.12, DCMAX = 0.05;
  const HF = 8e-3, DF = 30e-6, MU = 1.2e-3, RHO = 960, GRAV = 9.81, DIFF = 1e-9;
  const GT = 0.17e-3, ALPHA = 1.19e-7, DT_T = 2, MACRIT = 79.6;
  const UDRAIN = RHO * GRAV * DF * DF / (2 * MU);                 // 3.53e-3 m/s
  const DFALL = 3 * DF;                                          // 显示假设：泪滴把局部膜厚增至 3×（真实为 Cox–Vignes 滴落问题）
  const UFALL = RHO * GRAV * DFALL * DFALL / (2 * MU);            // 31.8e-3 m/s
  const DCSTAR = RHO * GRAV * DF * HF / (2 * SLOPE);              // 0.0224（τ*=ρgd/2，μ 相消）
  const MAT_T = GT * DT_T * HF / (MU * ALPHA);                    // 1.9e4
  const LCM = Math.sqrt((GW - SLOPE * C0) / (RHO * GRAV));        // 2.66mm（用酒液 γ）
  const UMAR_MAX = SLOPE * DCMAX * DF / (MU * HF);                // 7.89e-3 m/s
  const UPL = UMAR_MAX - UDRAIN, ULOW = -UDRAIN;                  // 纵轴上下界
  const gammaOf = (c: number) => GW - SLOPE * c;
  const tauOf = (dc: number) => SLOPE * dc / HF;                  // Pa
  const uOf = (dc: number) => tauOf(dc) * DF / MU - UDRAIN;       // m/s，正＝爬升
  const maOf = (dc: number) => SLOPE * dc * DF / (MU * DIFF);

  const CY = 16, SLOW = 0.35;

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

  // —— 杯壁扇形壳 + 酒池 + 弯月爬升环 ——
  const CX = -1.55, CZ = 0.45, RG = 2.15;
  const TA0 = 40 * PI / 180, TAL = 110 * PI / 180;
  const glass = new THREE.Mesh(
    geo(new THREE.CylinderGeometry(RG, RG * 0.86, 4.15, 30, 1, true, TA0, TAL)),
    mat(new THREE.MeshBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false })),
  );
  glass.position.set(CX, 2.0, CZ);
  group.add(glass);
  const wine = new THREE.Mesh(
    geo(new THREE.CylinderGeometry(RG * 0.9, RG * 0.78, 1.05, 30, 1, false, TA0, TAL)),
    mat(new THREE.MeshStandardMaterial({ color: 0x9f1239, transparent: true, opacity: 0.72, roughness: 0.22, metalness: 0.05, side: THREE.DoubleSide })),
  );
  wine.position.set(CX, 0.5, CZ);
  group.add(wine);
  const meniscus = new THREE.Mesh(
    geo(new THREE.TorusGeometry(RG * 0.9 - 0.06, 0.05, 8, 26, TAL)),
    mat(new THREE.MeshBasicMaterial({ color: 0xfda4af, transparent: true, opacity: 0.7 })),
  );
  meniscus.rotation.x = -PI / 2; meniscus.rotation.z = -TA0;
  meniscus.position.set(CX, 1.03, CZ);
  group.add(meniscus);

  // —— 酒膜：自定义环带网格，径向偏移＝局部膜厚，顶点色＝局部 γ ——
  const SEG = 26, RING = 40, Y0 = 1.06, Y1 = 3.86;
  const WSC = (Y1 - Y0) / HF;                                     // 世界/m（高度方向）
  const DV = 0.30;                                                // 膜鼓包显示幅度（30µm 的示意放大）
  const NV = (SEG + 1) * (RING + 1);
  const fGeo = geo(new THREE.BufferGeometry());
  const fPos = new Float32Array(NV * 3), fCol = new Float32Array(NV * 3);
  const fIdx = new Uint16Array(SEG * RING * 6);
  {
    let k = 0;
    for (let j = 0; j < RING; j++) for (let i = 0; i < SEG; i++) {
      const a = j * (SEG + 1) + i, b = a + 1, c = a + SEG + 1, d = c + 1;
      fIdx[k++] = a; fIdx[k++] = c; fIdx[k++] = b; fIdx[k++] = b; fIdx[k++] = c; fIdx[k++] = d;
    }
  }
  fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  fGeo.setAttribute('color', new THREE.BufferAttribute(fCol, 3));
  fGeo.setIndex(new THREE.BufferAttribute(fIdx, 1));
  const film = new THREE.Mesh(fGeo, mat(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.68, side: THREE.DoubleSide, depthWrite: false })));
  film.frustumCulled = false;
  group.add(film);
  const RI = RG * 0.885;                                          // 膜贴在壁内侧的世界半径

  // —— 挂杯泪珠：爬升→杯口→回落（回落速度用 3× 膜厚的排液律近似，非滴落动力学）——
  const ND = 7;
  const drops = new THREE.InstancedMesh(
    geo(new THREE.SphereGeometry(1, 14, 11)),
    mat(new THREE.MeshStandardMaterial({ color: 0xfb7185, transparent: true, opacity: 0.9, roughness: 0.1, metalness: 0.06 })),
    ND,
  );
  drops.frustumCulled = false;
  group.add(drops);
  const dTh = new Float32Array(ND), dY = new Float32Array(ND), dR = new Float32Array(ND);
  const dFall = new Uint8Array(ND);
  for (let j = 0; j < ND; j++) {
    dTh[j] = TA0 + TAL * (0.10 + 0.80 * (j / (ND - 1)));
    dY[j] = Y0 + (Y1 - Y0) * (0.08 + 0.84 * ((j * 0.37) % 1));
    dR[j] = (1.0 + 1.4 * ((j * 0.53) % 1)) * 1e-3;               // 实测挂杯泪 1–3mm
    dFall[j] = j % 3 === 1 ? 1 : 0;
  }
  const mtx = new THREE.Matrix4(), vP = new THREE.Vector3(), vS = new THREE.Vector3(), q = new THREE.Quaternion(0, 0, 0, 1);

  // —— 界面切应力箭头（指向 γ 增大方向）——
  const arrowMat = mat(new THREE.MeshBasicMaterial({ color: 0xfde047 }));
  const shaftG = geo(new THREE.CylinderGeometry(0.028, 0.028, 1, 6));
  const headG = geo(new THREE.ConeGeometry(0.085, 0.22, 9));
  const arrows: import('three').Group[] = [];
  for (let j = 0; j < 4; j++) {
    const gg = new THREE.Group();
    const sh = new THREE.Mesh(shaftG, arrowMat); sh.position.y = 0.42;
    const hd = new THREE.Mesh(headG, arrowMat); hd.position.y = 0.95;
    gg.add(sh, hd); group.add(gg); arrows.push(gg);
  }

  // —— 右侧 U(Δc) 图（竖直面：横轴 Δc、纵轴 U）——
  const PX0 = 1.55, PX1 = 4.35, PY0 = 0.95, PY1 = 3.35, PZ = 1.30;
  const xOf = (dc: number) => PX0 + (PX1 - PX0) * dc / DCMAX;
  const yOf = (u: number) => PY0 + (u - ULOW) / (UPL - ULOW) * (PY1 - PY0) * 0.86 + (PY1 - PY0) * 0.07;
  const NU = 80;
  const uGeo = geo(new THREE.BufferGeometry());
  {
    const p = new Float32Array(NU * 3);
    for (let i = 0; i < NU; i++) {
      const dc = DCMAX * i / (NU - 1);
      p[i * 3] = xOf(dc); p[i * 3 + 1] = yOf(uOf(dc)); p[i * 3 + 2] = PZ;
    }
    uGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    uGeo.setDrawRange(0, NU);
  }
  group.add(new THREE.Line(uGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee }))));
  const axGeo = geo(new THREE.BufferGeometry());
  axGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    PX0, yOf(0), PZ, PX1, yOf(0), PZ,                         // U=0（爬/排持平）
    xOf(DCSTAR), PY0 - 0.12, PZ, xOf(DCSTAR), PY1 + 0.12, PZ, // Δc* 临界
    PX0, PY0 - 0.12, PZ, PX0, PY1 + 0.12, PZ,                 // 纵轴
  ]), 3));
  axGeo.setDrawRange(0, 6);
  group.add(new THREE.LineSegments(axGeo, mat(new THREE.LineBasicMaterial({ color: 0x64748b }))));
  const uDot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.085, 14, 11)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  uDot.position.z = PZ + 0.04; group.add(uDot);

  // —— 标签 ——
  function makeLabel(text: string, color: string, x: number, y: number, z: number, wu = 3.0): void {
    const cv = document.createElement('canvas');
    cv.width = 768; cv.height = 64;
    const c2 = cv.getContext('2d')!;
    c2.fillStyle = color; c2.font = 'bold 27px "PingFang SC", sans-serif';
    c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText(text, 384, 32);
    const sp = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    sp.scale.set(wu, wu / 12, 1); sp.position.set(x, y, z); group.add(sp);
  }
  makeLabel('乙醇在膜里蒸发 → 杯口处 γ 更高 → 液体自己沿壁往上爬（挂杯）', '#fcd34d', -0.9, 4.18, 1.5, 6.4);
  makeLabel('青＝高 γ（乙醇少）红＝低 γ（乙醇多）；鼓包＝局部膜厚示意', '#a5f3fc', -1.5, 0.44, 2.5, 5.2);
  makeLabel('U(Δc)＝τ_sd/μ − ρgd²/2μ：越过 Δc* 才爬得过重力', '#d8b4fe', (PX0 + PX1) / 2, PY1 + 0.36, PZ, 4.8);

  // —— 面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 880; infoCv.height = 274;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  infoPlane.scale.set(9.6, 9.6 * 274 / 880, 1);
  infoPlane.position.set(0, 4.72, 0); infoPlane.renderOrder = 999;
  group.add(infoPlane);

  const rd = { dc: 0, gt: 0, dgam: 0, tau: 0, u: 0, um: 0, ma: 0, nc: 0, nf: 0, bulge: 0 };
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 880, 274);
    infoCtx.fillStyle = 'rgba(7,11,20,0.84)'; infoCtx.fillRect(4, 4, 872, 266);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 872, 266);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText('挂杯主因：浓度梯度（溶质 Marangoni）；热毛细为对照', 22, 34);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('γ=γ_w−|dγ/dc|c　τ=Δγ/H　U=τd/μ−ρgd²/2μ　Ma=Δγd/(μD)', 22, 64);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText(`酒 12%vol：γ=66.7mN/m（水 72.8／乙醇 22.3）；H=8mm d=30µm μ=1.2mPa·s`, 22, 92);
    infoCtx.fillStyle = '#22c55e';
    infoCtx.fillText(`排液底 ρgd²/2μ=${(UDRAIN * 1e3).toFixed(2)}mm/s↓　Δc*=${DCSTAR.toFixed(4)}　Ma_T(ΔT=2K)=${(MAT_T / 1e4).toFixed(1)}×10⁴＞79.6`, 22, 120);
    infoCtx.fillStyle = rd.u > 0 ? '#f472b6' : '#ef4444';
    infoCtx.fillText(rd.u > 0
      ? `挂杯活着：膜以 ${(rd.u * 1e3).toFixed(2)}mm/s 爬壁，泪珠在杯口积聚后以 ${(UFALL * 1e3).toFixed(1)}mm/s 回落（回落按 3× 局部膜厚的排液律，显示假设）`
      : `Δc＜Δc*：界面拖曳压不过重力排液，整层膜只往下走——看不见泪`, 22, 148);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 22px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：Δc=${rd.dc.toFixed(4)}（体积分数）　γ_顶=${(rd.gt * 1e3).toFixed(2)}mN/m　Δγ=${(rd.dgam * 1e3).toFixed(2)}mN/m`, 22, 180);
    infoCtx.fillText(`　　　τ=${(rd.tau * 1e3).toFixed(1)}mPa　界面项=${(rd.um * 1e3).toFixed(2)}mm/s　U=${rd.u >= 0 ? '+' : '−'}${(Math.abs(rd.u) * 1e3).toFixed(2)}mm/s　Ma=${(rd.ma / 1e3).toFixed(1)}×10³`, 22, 208);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '20px "PingFang SC", sans-serif';
    infoCtx.fillText(`标尺：1wu⇔${(HF / (Y1 - Y0) * 1e3).toFixed(2)}mm；膜厚鼓包示意 ${rd.bulge.toFixed(2)}wu；爬升 ${rd.nc} 颗／回落 ${rd.nf} 颗；l_c=${(LCM * 1e3).toFixed(2)}mm 定泪滴尺度`, 22, 240);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  return {
    update(t, dt) {
      const ph = (t % CY) / CY;
      const s = 0.5 - 0.5 * Math.cos(TWO_PI * ph);
      const dc = DCMAX * s;                                       // 自变量：膜顶乙醇亏损
      const dgam = SLOPE * dc, tau = tauOf(dc), u = uOf(dc), ma = maOf(dc);
      const gt = gammaOf(C0 - dc);
      const climb = Math.abs(u) / Math.max(UPL, -ULOW);

      // 膜：局部亏损随高度累积 → 局部 γ → 颜色；局部膜厚 → 径向鼓包
      let bulgeTop = 0;
      for (let j = 0; j <= RING; j++) {
        const fy = j / RING;
        const local = dc * Math.pow(fy, 1.3);
        const gk = local / DCMAX;
        const th = DV * (0.08 + 0.92 * climb) * (0.30 + 0.70 * fy * fy);
        if (j === RING) bulgeTop = th;
        const y = Y0 + (Y1 - Y0) * fy;
        const rr = RI + th;
        for (let i = 0; i <= SEG; i++) {
          const a2 = TA0 + TAL * i / SEG, vi = j * (SEG + 1) + i;
          fPos[vi * 3] = CX + rr * Math.sin(a2);
          fPos[vi * 3 + 1] = y;
          fPos[vi * 3 + 2] = CZ + rr * Math.cos(a2);
          fCol[vi * 3] = 0.98 - 0.85 * gk;
          fCol[vi * 3 + 1] = 0.30 + 0.53 * gk;
          fCol[vi * 3 + 2] = 0.28 + 0.71 * gk;
        }
      }
      fGeo.attributes['position'].needsUpdate = true;
      fGeo.attributes['color'].needsUpdate = true;
      fGeo.computeVertexNormals();

      // 泪珠：爬升速度＝U（可负），到杯口转回落（速度＝ρg(3d)²/2μ）
      let nc = 0, nf = 0;
      for (let j = 0; j < ND; j++) {
        if (dFall[j]) {
          dY[j] -= UFALL * WSC * SLOW * dt;
          if (dY[j] <= Y0) { dY[j] = Y1; dFall[j] = 0; }
          nf++;
        } else {
          dY[j] += u * WSC * SLOW * dt;
          if (dY[j] >= Y1) { dY[j] = Y1; if (u > 0) dFall[j] = 1; }
          else if (dY[j] < Y0) dY[j] = Y0;
          nc++;
        }
        const rr = RI + DV * 0.55;
        vP.set(CX + rr * Math.sin(dTh[j]), dY[j], CZ + rr * Math.cos(dTh[j]));
        const spd = dFall[j] ? UFALL : Math.abs(u);
        const es = 1 + Math.min(1.8, spd / (30e-3)) * 0.9;       // 速度快→被拉长（液滴拖尾）
        const rw = Math.max(0.05, dR[j] * WSC);
        vS.set(rw, rw * es, rw);
        mtx.compose(vP, q, vS); drops.setMatrixAt(j, mtx);
      }
      drops.instanceMatrix.needsUpdate = true;

      // 箭头：长度∝|U|，指向 γ 增大方向（U>0 向上）
      for (let j = 0; j < 4; j++) {
        const a2 = TA0 + TAL * (0.18 + 0.21 * j);
        const rr = RI + DV * 1.45;
        const gg = arrows[j];
        gg.position.set(CX + rr * Math.sin(a2), Y0 + 0.5 + (j % 2) * 1.2, CZ + rr * Math.cos(a2));
        gg.rotation.z = u > 0 ? 0 : PI;
        gg.scale.setScalar(0.22 + 1.4 * climb);
      }
      arrowMat.color.setHex(u > 0 ? 0xfde047 : 0xef4444);

      uDot.position.set(xOf(dc), yOf(u), PZ + 0.04);

      rd.dc = dc; rd.gt = gt; rd.dgam = dgam; rd.tau = tau; rd.u = u;
      rd.um = tau * DF / MU; rd.ma = ma; rd.nc = u > 0 ? nc : 0; rd.nf = nf; rd.bulge = bulgeTop;
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
