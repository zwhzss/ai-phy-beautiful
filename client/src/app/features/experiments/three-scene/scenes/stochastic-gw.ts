import type { SceneContext, SceneInstance } from '../types';
/** 随机引力波背景（P234）：PTA 用毫秒脉冲星—地球连线作银河系臂长探测 nHz 背景。
 *  两脉冲星计时残差的相关只依赖角距 Θ，广义相对论张量模给出精确闭式 Hellings–Downs 函数
 *  Γ(Θ) = 1 − κ/2 + 3κ·ln κ，κ = (1−cosΘ)/2（本场景直接用它生成"橙瓣"相关面与面板读数）。
 *  指纹核对：Γ(0°)=1、Γ(90°)=−0.29（负瓣 50°–120°，单极/偶极关联无法伪造）、Γ(180°)=+0.5 —— 四极特征。
 *  背景谱指数（Ω_gw=(2π²/3H₀²)f²h_c²）：星表背景 SMBHB 给 h_c∝f^{−2/3} ⇒ Ω∝f^{2/3}；
 *  原初暴胀背景在 nHz/PTA 频段近似平坦 Ω∝f⁰ —— 两者不可混标。
 *  Θ(t) 以 16s 从 5° 扫到 175°：B 星沿大圆移动，相关面实时重算；天球缓转。
 *  残差小球的纵向抖动来自合成四极应变场 rᵢ = A·p̂ᵢᵀQ(t)p̂ᵢ（可视化用；理论相关 = HD 闭式）。 */
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

  const TWO_PI = Math.PI * 2;
  const CTR = new THREE.Vector3(0, 3.15, 0);
  const R_SKY = 4.15;
  const sky = new THREE.Group();
  sky.position.copy(CTR);
  group.add(sky);

  const A_HF = 2.4e-15;               // 特征应变幅 @ f=1/yr
  const F_YR = 1 / 3.156e7;           // 1/yr (Hz)
  const H0 = 2.2e-18;                 // s^-1

  // HD 精确闭式
  const hd = (th: number): number => {
    const k = (1 - Math.cos(th)) / 2;
    return k <= 1e-12 ? 1 : 1 - k / 2 + 3 * k * Math.log(k);
  };

  // —— 天球网格与地球 ——
  const skyWire = new THREE.Mesh(geo(new THREE.SphereGeometry(R_SKY, 28, 18)), mat(new THREE.MeshBasicMaterial({ color: 0x1e3a5f, wireframe: true, transparent: true, opacity: 0.22 })));
  sky.add(skyWire);
  const earth = new THREE.Mesh(geo(new THREE.SphereGeometry(0.24, 16, 16)), mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee })));
  sky.add(earth);

  // —— 脉冲星：16 颗随机 + 参考星 A（北极方向）+ 扫描星 B ——
  const hash = (i: number, j: number): number => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const NPUL = 16;
  const dirs: import('three').Vector3[] = [];
  for (let i = 0; i < NPUL; i++) {
    const z = 2 * hash(i, 3) - 1;
    const r = Math.sqrt(1 - z * z), a = hash(i, 7) * TWO_PI;
    dirs.push(new THREE.Vector3(r * Math.cos(a), z, r * Math.sin(a)));
  }
  const pGeo = geo(new THREE.SphereGeometry(0.09, 10, 10));
  const pMat = mat(new THREE.MeshBasicMaterial({ color: 0x22c55e }));
  const pulMesh = new THREE.InstancedMesh(pGeo, pMat, NPUL);
  const dummy = new THREE.Object3D();
  dirs.forEach((d, i) => {
    dummy.position.copy(d).multiplyScalar(R_SKY); dummy.updateMatrix();
    pulMesh.setMatrixAt(i, dummy.matrix);
  });
  pulMesh.instanceMatrix.needsUpdate = true;
  sky.add(pulMesh);

  const losGeo = geo(new THREE.BufferGeometry());
  const losPos = new Float32Array(NPUL * 6);
  {
    let m = 0;
    dirs.forEach((d) => {
      losPos[m++] = 0; losPos[m++] = 0; losPos[m++] = 0;
      losPos[m++] = d.x * R_SKY; losPos[m++] = d.y * R_SKY; losPos[m++] = d.z * R_SKY;
    });
  }
  losGeo.setAttribute('position', new THREE.BufferAttribute(losPos, 3));
  sky.add(new THREE.LineSegments(losGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.35 }))));

  // 残差小球：每颗脉冲星一个沿视线抖动的黄点
  const resGeo = geo(new THREE.SphereGeometry(0.06, 8, 8));
  const resMat = mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
  const resMesh = new THREE.InstancedMesh(resGeo, resMat, NPUL);
  sky.add(resMesh);

  // —— 合成四极应变场 Q(t)（3 个独立振荡的无迹对称张量叠加，固定伪随机系数）——
  const modes: number[][] = [];
  for (let q = 0; q < 3; q++) {
    const h = hash(q, 11), g = hash(q, 12), k = hash(q, 13);
    const m00 = h - 0.5, m11 = -(m00) + 0.2 * (g - 0.5), m22 = -m00 - m11;
    modes.push([m00, g - 0.5, k - 0.5, m11, k - 0.3, m22, 0.7 + q * 0.9]);
  }
  function qField(t: number, p: import('three').Vector3): number {
    let s = 0;
    for (const m of modes) {
      const w = m[6];
      const Q00 = m[0] * Math.cos(w * t * 0.5), Q01 = m[1] * Math.cos(w * t * 0.37 + 1), Q02 = m[2] * Math.sin(w * t * 0.41);
      const Q11 = m[3] * Math.sin(w * t * 0.5 + 2), Q12 = m[4] * Math.cos(w * t * 0.6), Q22 = m[5] * Math.sin(w * t * 0.33);
      s += p.x * p.x * Q00 + 2 * p.x * p.y * Q01 + 2 * p.x * p.z * Q02 + p.y * p.y * Q11 + 2 * p.y * p.z * Q12 + p.z * p.z * Q22;
    }
    return s;
  }

  // —— A/B 双星（粗大连线 + 小球）与橙瓣相关面 ——
  const dirA = new THREE.Vector3(0, 1, 0);
  const starA = new THREE.Mesh(geo(new THREE.SphereGeometry(0.15, 12, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })));
  starA.position.copy(dirA).multiplyScalar(R_SKY); sky.add(starA);
  const starB = new THREE.Mesh(starA.geometry, mat(new THREE.MeshBasicMaterial({ color: 0xa855f7 })));
  sky.add(starB);
  const abGeo = geo(new THREE.BufferGeometry());
  abGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  sky.add(new THREE.Line(abGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.8 }))));

  const PET_R = 1.55, PN1 = 26, PN2 = 44;
  const petGeo = geo(new THREE.BufferGeometry());
  const petPos = new Float32Array((PN1 + 1) * (PN2 + 1) * 3);
  const petCol = new Float32Array((PN1 + 1) * (PN2 + 1) * 3);
  petGeo.setAttribute('position', new THREE.BufferAttribute(petPos, 3));
  petGeo.setAttribute('color', new THREE.BufferAttribute(petCol, 3));
  {
    const idx: number[] = [];
    for (let i = 0; i < PN1; i++) for (let j = 0; j < PN2; j++) {
      const a = i * (PN2 + 1) + j, b = a + 1, c = a + PN2 + 1, e = c + 1;
      idx.push(a, b, c, b, e, c);
    }
    petGeo.setIndex(idx);
  }
  const petMesh = new THREE.Mesh(petGeo, mat(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, side: THREE.DoubleSide })));
  sky.add(petMesh);
  function updatePetal(thetaB: number): void {
    // 以 A（+y）为极轴：纬度 = Θ'，半径调制 = 1+0.45Γ(Θ')；色 = Γ 值（正橙红，负紫）
    let v = 0;
    for (let i = 0; i <= PN1; i++) {
      const th = Math.PI * (i / PN1);
      const g = hd(th);
      const r = PET_R * (1 + 0.45 * g);
      const colR = g >= 0 ? 0.6 + 0.4 * g : 0.35 + 0.2 * (-g);
      const colG = g >= 0 ? 0.42 + 0.2 * g : 0.2;
      const colB = g >= 0 ? 0.12 : 0.4 + 0.45 * (-g);
      for (let j = 0; j <= PN2; j++) {
        const ph = (j / PN2) * TWO_PI;
        petPos[v * 3] = r * Math.sin(th) * Math.cos(ph);
        petPos[v * 3 + 1] = r * Math.cos(th);
        petPos[v * 3 + 2] = r * Math.sin(th) * Math.sin(ph);
        petCol[v * 3] = colR; petCol[v * 3 + 1] = colG; petCol[v * 3 + 2] = colB;
        v++;
      }
    }
    petGeo.attributes['position'].needsUpdate = true;
    petGeo.attributes['color'].needsUpdate = true;
    // B 星放在 Θ 处
    const d = new THREE.Vector3(Math.sin(thetaB), Math.cos(thetaB), 0);
    starB.position.copy(d).multiplyScalar(R_SKY);
    const a = abGeo.attributes['position'].array as Float32Array;
    a[0] = starA.position.x; a[1] = starA.position.y; a[2] = starA.position.z;
    a[3] = starB.position.x; a[4] = starB.position.y; a[5] = starB.position.z;
    abGeo.attributes['position'].needsUpdate = true;
  }

  // —— 面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 840; infoCv.height = 300;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.2, 3.3)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 6.6, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  let theta = 0.5, gVal = 1, omegaGw = 0, emaCorr = 0, rA = 0, rB = 0;
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 840, 300);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 832, 292);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 832, 292);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText('Hellings–Downs（张量模精确闭式）：Γ(Θ)=1−κ/2+3κ·lnκ, κ=(1−cosΘ)/2', 22, 40);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '24px "PingFang SC", sans-serif';
    infoCtx.fillText('四极指纹：Γ(0°)=1、Γ(90°)=−0.29、Γ(180°)=+0.5；负瓣 50°–120° 不可被单极/偶极伪造', 22, 78);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText(`Ω_gw=(2π²/3H₀²)f²A²(f/f_yr)^(-⅔)〔SMBHB 幂律〕：A=${A_HF.toExponential(1)} ⇒ Ω(1/yr)=${omegaGw.toExponential(1)}`, 22, 112);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：角距 Θ=${(theta * 57.2958).toFixed(0)}°  Γ(Θ)=${gVal.toFixed(3)}  r_A=${rA.toFixed(2)} r_B=${rB.toFixed(2)}`, 22, 152);
    infoCtx.fillText(`瞬时残差相关(EMA)=${emaCorr.toFixed(2)}——橙瓣面 = Γ(Θ′) 全向分布`, 22, 186);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('PTA：毫秒脉冲星=银河钟；nHz 背景拉缩日—星基线 ⇒ 计时残差；', 22, 222);
    infoCtx.fillText('星表背景(SMBHB) h_c∝f^{-2/3} ⇒ Ω∝f^{2/3}；原初暴胀背景在 PTA 频段近似平坦 Ω∝f⁰', 22, 252);
    infoTex.needsUpdate = true;
  }

  omegaGw = (2 * Math.PI * Math.PI / (3 * H0 * H0)) * F_YR * F_YR * A_HF * A_HF;
  updatePetal(theta); drawInfo();

  // —— 前景参考墙：HD 曲线 Γ(Θ)（闭式采样）+ 三行残差时序（星A/星B/随机星，滚动缓冲）——
  const WALLZ = 4.55;
  const hx2 = (th: number): number => -4.4 + 4.2 * (th / Math.PI);
  const gy2 = (g: number): number => 0.55 + 1.55 * (g + 0.35) / 1.4;
  const hdGeo = geo(new THREE.BufferGeometry());
  {
    const pos = new Float32Array(146 * 3);
    for (let i = 0; i <= 145; i++) { const th = (i / 145) * Math.PI; pos[i * 3] = hx2(th); pos[i * 3 + 1] = gy2(hd(th)); pos[i * 3 + 2] = WALLZ; }
    hdGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  }
  group.add(new THREE.Line(hdGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 }))));
  const hdZero = geo(new THREE.BufferGeometry());
  hdZero.setAttribute('position', new THREE.BufferAttribute(new Float32Array([hx2(0), gy2(0), WALLZ, hx2(Math.PI), gy2(0), WALLZ]), 3));
  group.add(new THREE.Line(hdZero, mat(new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.5 }))));
  const hdDot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.1, 10, 10)), mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })));
  group.add(hdDot);
  {
    const lb = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(makeCurveCanvas())), transparent: true })));
    function makeCurveCanvas(): HTMLCanvasElement {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
      const c = cv.getContext('2d')!; c.fillStyle = '#fbbf24'; c.font = 'bold 26px "PingFang SC", sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('HD 曲线：极小 −0.304 @ Θ≈82.5°', 256, 32);
      return cv;
    }
    lb.scale.set(3.4, 3.4 / 8, 1); lb.position.set(-2.3, 2.35, WALLZ); group.add(lb);
  }
  const RS = 110, RDT = 0.13;
  const rBufs = [new Float32Array(RS), new Float32Array(RS), new Float32Array(RS)];
  let rHead = 0, rFilled = 0, rStamp = 0;
  const stripGeos: import('three').BufferGeometry[] = [];
  for (let s = 0; s < 3; s++) {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RS * 3), 3));
    g.setDrawRange(0, 0);
    group.add(new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color: s === 0 ? 0xf472b6 : s === 1 ? 0xa855f7 : 0x22c55e, transparent: true, opacity: 0.9 })))
    );
    stripGeos.push(g);
  }
  {
    const lb2 = new THREE.Sprite(mat(new THREE.SpriteMaterial({ transparent: true })));
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!; c.fillStyle = '#94a3b8'; c.font = 'bold 25px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('残差时序：A(粉) B(紫) 随机星(绿)', 256, 32);
    lb2.material.map = tex(new THREE.CanvasTexture(cv));
    lb2.scale.set(3.6, 3.6 / 8, 1); lb2.position.set(2.4, 2.2, WALLZ); group.add(lb2);
  }
  function pushResiduals(t: number, thNow: number): void {
    rBufs[0][rHead] = qField(t, dirA);
    rBufs[1][rHead] = qField(t, new THREE.Vector3(Math.sin(thNow), Math.cos(thNow), 0));
    rBufs[2][rHead] = qField(t, dirs[3]);
    rHead = (rHead + 1) % RS;
    if (rFilled < RS) rFilled++;
    for (let s = 0; s < 3; s++) {
      const pos = stripGeos[s].attributes['position'].array as Float32Array;
      const baseY = 1.72 - s * 0.55;
      for (let i = 0; i < rFilled; i++) {
        const j = (rHead - rFilled + i + RS) % RS;
        pos[i * 3] = 0.35 + 4.1 * (i / (RS - 1)); pos[i * 3 + 1] = baseY + 0.2 * rBufs[s][j]; pos[i * 3 + 2] = WALLZ;
      }
      stripGeos[s].setDrawRange(0, rFilled);
      stripGeos[s].attributes['position'].needsUpdate = true;
    }
  }

  return {
    update(t, dt) {
      // 扫描角距 Θ：5°→175°→5°（16s 周期）；天球缓转
      theta = (5 + 170 * (0.5 - 0.5 * Math.cos(TWO_PI * ((t % 16) / 16)))) * Math.PI / 180;
      gVal = hd(theta);
      updatePetal(theta);
      sky.rotation.y = 0.12 * t;

      // 残差抖动（合成四极场，可视化）
      const dirB = new THREE.Vector3(Math.sin(theta), Math.cos(theta), 0);
      rA = qField(t, dirA) * 0.55;
      for (let i = 0; i < NPUL; i++) {
        const p = dirs[i];
        const r = qField(t, p) * 0.55;
        dummy.position.copy(p).multiplyScalar(R_SKY - 0.9 + r);
        dummy.scale.setScalar(1); dummy.updateMatrix();
        resMesh.setMatrixAt(i, dummy.matrix);
      }
      rB = qField(t, dirB) * 0.55;
      resMesh.instanceMatrix.needsUpdate = true;
      emaCorr += (rA * rB - emaCorr) * Math.min(1, dt * 0.8);
      // 前景墙：HD 曲线标记随 Θ 滑动；残差缓冲每 0.13s 压入一采样
      hdDot.position.set(hx2(theta), gy2(gVal), WALLZ);
      if (t - rStamp >= RDT) { rStamp = t; pushResiduals(t, theta); }
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
