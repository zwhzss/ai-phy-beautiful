import type { SceneContext, SceneInstance } from '../types';
/**
 * 射电望远镜（P265）：抛物面把平行波面汇聚到馈源，方向图与系统温度随口径/波长/仰角实时变化。
 * 主控方程：
 *   ① 抛物面 z = ρ²/(4f)（平行于轴的射线必过焦点 (0,f,0)）
 *   ② 均匀圆口径方向图 F(θ) = |2J₁(u)/u|²，u = π(D/λ)·sinθ ⇒ 第一零极小 θ₁ = 1.22λ/D
 *   ③ 增益 G = 4πA_e/λ² = η(πD/λ)²，A_e = ηπD²/4
 *   ④ 辐射计方程 SEFD = 2kT_sys/A_e，ΔS_min = SEFD/√(2·Δν·τ)，T_sys = T_sky+T_rx+T_gnd·F(el)（地平方向与电轴夹角即仰角）
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

  const TWO_PI = Math.PI * 2;
  const DEG = 180 / Math.PI;

  const starGeo = geo(new THREE.BufferGeometry());
  const starPos = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 200;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));

  // 地面：射电宁静区栅格（拾取地面干扰时染红）
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  const gridMats: import('three').Material[] = Array.isArray(grid.material) ? grid.material : [grid.material];
  gridMats.forEach((m) => mat(m));
  group.add(grid);

  // ============ 真实参数（1 GHz 波段的小型射电天线，量级真实） ============
  const LAMBDA = 0.3;             // m（ν = c/λ = 1.00 GHz）
  const FD = 0.4;                 // 焦比 f/D
  const ETA = 0.56;               // 口径效率（含溢出损耗）
  const K_B = 1.380649e-23;       // J/K
  const T_SKY = 4, T_RX = 20, T_GND = 290; // K
  const BW = 1.0e8, TAU = 10;     // Hz, s

  let dishD = 3.0;                // 口径 D（m，扫描量）
  let elev = 60;                  // 仰角 el（deg，扫描量）
  let thetaNull = 0, gainDbi = 0, areaEff = 0, sideLobe = 0, tSys = 0, sefd = 0, dSmin = 0;

  // 一阶贝塞尔 J₁：小参量用幂级数，大参量用渐近式
  function besselJ1(x: number): number {
    const ax = Math.abs(x);
    if (ax < 12) {
      let term = x / 2, sum = term;
      for (let k = 1; k <= 40; k++) {
        term *= -(x * x) / (4 * k * (k + 1));
        sum += term;
        if (Math.abs(term) <= 1e-17 * Math.abs(sum)) break;
      }
      return sum;
    }
    return Math.sign(ax) * Math.sqrt(2 / (Math.PI * ax)) * Math.cos(ax - 2.3561944902);
  }
  // 电压方向图 |2J₁(u)/u|（u→0 时 →1）
  function vPattern(theta: number): number {
    const u = Math.PI * (dishD / LAMBDA) * Math.sin(theta);
    if (u < 1e-4) return 1;
    return (2 * besselJ1(u)) / u;
  }

  // ============ 望远镜整体（局部 +y = 波束电轴） ============
  const mount = new THREE.Group();
  mount.position.set(-0.4, 0.55, 0);
  group.add(mount);
  const dish = new THREE.Group();        // 随仰角倾斜
  mount.add(dish);

  // 抛物面：环 × 扇区参数曲面（口径归一化绘制，scale 反映 D 变化）
  const RINGS = 14, SECT = 44;
  const dishGeo = geo(new THREE.BufferGeometry());
  const dishPos = new Float32Array((RINGS + 1) * (SECT + 1) * 3);
  dishGeo.setAttribute('position', new THREE.BufferAttribute(dishPos, 3));
  {
    const idx: number[] = [];
    for (let i = 0; i < RINGS; i++) {
      for (let j = 0; j < SECT; j++) {
        const a = i * (SECT + 1) + j, b = a + 1, c = a + SECT + 1, e = c + 1;
        idx.push(a, b, c, b, e, c);
      }
    }
    dishGeo.setIndex(idx);
  }
  const dishWire = new THREE.Mesh(dishGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.5, side: THREE.DoubleSide })));
  const dishSkin = new THREE.Mesh(dishGeo, mat(new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.55, roughness: 0.45, side: THREE.DoubleSide, transparent: true, opacity: 0.55 })));
  dish.add(dishWire, dishSkin);
  const A_UNIT = 1.0;                    // 归一化 rim 半径
  function updateDish(): void {
    const f = FD * A_UNIT;               // 归一化焦距
    let v = 0;
    for (let i = 0; i <= RINGS; i++) {
      const rho = (A_UNIT * i) / RINGS;
      const y = (rho * rho) / (4 * f);
      for (let j = 0; j <= SECT; j++) {
        const a = (j / SECT) * TWO_PI;
        dishPos[v * 3] = rho * Math.cos(a);
        dishPos[v * 3 + 1] = y;
        dishPos[v * 3 + 2] = rho * Math.sin(a);
        v++;
      }
    }
    dishGeo.attributes['position'].needsUpdate = true;
    const s = 0.34 + 0.5 * (dishD / 7);  // 口径 1.5–7 m 映射到 0.45–0.84 unit
    dish.scale.setScalar(s);
    feed.position.set(0, FD * A_UNIT, 0);   // 焦点（局部坐标，与 scale 无关）
    feed.scale.setScalar(1 / s);            // 抵消父级缩放，保持馈源实际尺寸
    legs.forEach((lg, k) => {
      const a = (k / 3) * TWO_PI + Math.PI / 6;
      const f = FD * A_UNIT;
      const base = new THREE.Vector3(A_UNIT * Math.cos(a), (A_UNIT * A_UNIT) / (4 * f), A_UNIT * Math.sin(a));
      const tip = new THREE.Vector3(0, f, 0);
      orientBar(lg, base, tip);
    });
  }
  // 把单位高圆柱对齐到两点连线
  const UPV = new THREE.Vector3(0, 1, 0);
  function orientBar(mesh: import('three').Mesh, from: import('three').Vector3, to: import('three').Vector3): void {
    const d = to.clone().sub(from);
    const len = d.length();
    mesh.position.copy(from).addScaledVector(d, 0.5);
    mesh.quaternion.setFromUnitVectors(UPV, d.clone().normalize());
    mesh.scale.set(1, len, 1);
  }
  // 馈源喇叭 + 支腿
  const feed = new THREE.Mesh(geo(new THREE.ConeGeometry(0.11, 0.26, 12, 1, true)), mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide })));
  feed.rotation.x = Math.PI;             // 喇叭口朝下对准抛物面
  dish.add(feed);
  const legMat = mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.4 }));
  const legGeo = geo(new THREE.CylinderGeometry(0.016, 0.016, 1, 5));
  const legs: import('three').Mesh[] = [];
  for (let k = 0; k < 3; k++) {
    const lg = new THREE.Mesh(legGeo, legMat);
    dish.add(lg);
    legs.push(lg);
  }
  // 座架（俯仰轴 + 方位柱）
  const altArm = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 8)), mat(new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.5 })));
  altArm.rotation.z = Math.PI / 2;
  mount.add(altArm);
  const pier = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.16, 0.24, 0.62, 12)), mat(new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.4, roughness: 0.6 })));
  pier.position.set(0, -0.45, 0);
  group.add(pier);
  group.position.y = 0.5;

  // 入射平行波 → 抛物面 → 焦点（局部坐标，随口径缩放）
  const RAY_N = 10;
  const rayGeo = geo(new THREE.BufferGeometry());
  rayGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAY_N * 2 * 2 * 3), 3));
  const rayMat = mat(new THREE.LineBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.75 }));
  const rays = new THREE.LineSegments(rayGeo, rayMat);
  dish.add(rays);
  const waveGeo = geo(new THREE.BufferGeometry());
  waveGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAY_N * 2 * 3), 3));
  const waveMat = mat(new THREE.LineBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.55 }));
  dish.add(new THREE.LineSegments(waveGeo, waveMat));
  function updateRays(phase: number): void {
    const a = rayGeo.attributes['position'].array as Float32Array;
    const f = FD * A_UNIT;
    let v = 0;
    const put = (x: number, y: number, z: number): void => { a[v * 3] = x; a[v * 3 + 1] = y; a[v * 3 + 2] = z; v++; };
    for (let k = 0; k < RAY_N; k++) {
      const ang = (k / RAY_N) * TWO_PI + 0.2;
      const rho = A_UNIT * (0.28 + 0.68 * ((k % 4) / 3));
      const x = rho * Math.cos(ang), z = rho * Math.sin(ang);
      const y = (rho * rho) / (4 * f);
      put(x, 1.55 + phase, z); put(x, y, z);      // 入射（平行于轴）
      put(x, y, z); put(0, f, 0);                 // 反射汇聚到焦点
    }
    rayGeo.attributes['position'].needsUpdate = true;
    // 入射波面：等相位平面（垂直于轴）随相位下移
    const w = waveGeo.attributes['position'].array as Float32Array;
    for (let k = 0; k < RAY_N; k++) {
      const ang = (k / RAY_N) * TWO_PI;
      const yy = 1.55 - ((phase * 2.2) % 1.4);
      w[k * 6] = A_UNIT * 1.3 * Math.cos(ang); w[k * 6 + 1] = yy; w[k * 6 + 2] = A_UNIT * 1.3 * Math.sin(ang);
      w[k * 6 + 3] = A_UNIT * 1.3 * Math.cos(ang + Math.PI / RAY_N); w[k * 6 + 4] = yy; w[k * 6 + 5] = A_UNIT * 1.3 * Math.sin(ang + Math.PI / RAY_N);
    }
    waveGeo.attributes['position'].needsUpdate = true;
  }

  // ============ 三维方向图曲面（绕电轴旋转的艾里图样） ============
  const R_PAT = 3.1;
  const TH_N = 60, PH_N = 40;
  const patGeo = geo(new THREE.BufferGeometry());
  const patPos = new Float32Array((TH_N + 1) * (PH_N + 1) * 3);
  patGeo.setAttribute('position', new THREE.BufferAttribute(patPos, 3));
  {
    const idx: number[] = [];
    for (let i = 0; i < TH_N; i++) {
      for (let j = 0; j < PH_N; j++) {
        const a = i * (PH_N + 1) + j, b = a + 1, c = a + PH_N + 1, e = c + 1;
        idx.push(a, b, c, b, e, c);
      }
    }
    patGeo.setIndex(idx);
  }
  // 方向图挂在 mount 下的独立组：不随抛物面的绘制缩放而变形
  const patGroup = new THREE.Group();
  mount.add(patGroup);
  const patWire = new THREE.Mesh(patGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.34, side: THREE.DoubleSide })));
  const patSolid = new THREE.Mesh(patGeo, mat(new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.09, side: THREE.DoubleSide })));
  patGroup.add(patWire, patSolid);
  function updatePattern(): void {
    let v = 0;
    for (let i = 0; i <= TH_N; i++) {
      const th = (i / TH_N) * Math.PI;
      const vpa = Math.abs(vPattern(th));
      const r = R_PAT * vpa;                    // 幅度方向图（|2J₁/u|）
      const sinT = Math.sin(th), cosT = Math.cos(th);
      for (let j = 0; j <= PH_N; j++) {
        const a = (j / PH_N) * TWO_PI;
        patPos[v * 3] = r * sinT * Math.cos(a);
        patPos[v * 3 + 1] = r * cosT;            // 局部 +y 为电轴
        patPos[v * 3 + 2] = r * sinT * Math.sin(a);
        v++;
      }
    }
    patGeo.attributes['position'].needsUpdate = true;
  }

  // 主瓣指向 + 地平线拾取标记（世界坐标）
  const boreGeo = geo(new THREE.BufferGeometry());
  boreGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const boreLine = new THREE.Line(boreGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 })));
  group.add(boreLine);
  const pickGeo = geo(new THREE.RingGeometry(0.55, 0.95, 40));
  const pickMat = mat(new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.2, side: THREE.DoubleSide }));
  const pickDisc = new THREE.Mesh(pickGeo, pickMat);
  pickDisc.rotation.x = -Math.PI / 2;
  group.add(pickDisc);
  const UP = new THREE.Vector3(0, 1, 0);

  // ============ 标签 ============
  function makeLabel(text: string, color: string, scale = 3.6): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 26px "PingFang SC", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  const lblFeed = makeLabel('平行波面 → 抛物面 → 馈源焦点', '#22c55e', 3.9);
  lblFeed.position.set(-2.6, 3.3, 0);
  group.add(lblFeed);
  const lblPat = makeLabel('三维方向图 |2J₁(u)/u|：主瓣＋同心旁瓣', '#22d3ee', 4.4);
  lblPat.position.set(2.9, 3.4, 0);
  group.add(lblPat);
  const lblGnd = makeLabel('低仰角：旁瓣拾取地面 290 K 热辐射/RFI', '#ef4444', 4.6);
  lblGnd.position.set(3.6, 0.15, -3.4);
  group.add(lblGnd);

  // ============ 面板 ============
  const infoCv = document.createElement('canvas');
  infoCv.width = 900; infoCv.height = 300;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.4, 3.13)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 6.9, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);
  const ln = (y: number, color: string, text: string, bold = false, size = 26): void => {
    infoCtx.fillStyle = color;
    infoCtx.font = `${bold ? 'bold ' : ''}${size}px "PingFang SC", sans-serif`;
    infoCtx.fillText(text, 22, y);
  };
  function computePhysics(): void {
    thetaNull = 1.22 * LAMBDA / dishD;                      // rad
    areaEff = (ETA * Math.PI * dishD * dishD) / 4;
    const gLin = (4 * Math.PI * areaEff) / (LAMBDA * LAMBDA);
    gainDbi = 10 * Math.log10(gLin);
    const thG = elev / DEG;                               // 电轴与地平方向的夹角 = 仰角本身（指向 +x 地平，电轴 (cos el, sin el)）
    sideLobe = Math.pow(vPattern(thG), 2);                  // 该方向的功率旁瓣电平
    tSys = T_SKY + T_RX + T_GND * sideLobe;
    sefd = (2 * K_B * tSys) / areaEff / 1e-26;              // Jy
    dSmin = sefd / Math.sqrt(2 * BW * TAU);
  }
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 900, 300);
    infoCtx.fillStyle = 'rgba(7,11,20,0.86)';
    infoCtx.fillRect(4, 4, 892, 292);
    infoCtx.strokeStyle = '#334155';
    infoCtx.lineWidth = 3;
    infoCtx.strokeRect(4, 4, 892, 292);
    infoCtx.textAlign = 'left';

    ln(40, '#f8fafc', '射电望远镜 —— 抛物面聚集与衍射极限波束', true);
    ln(78, '#22d3ee', `θ₁ = 1.22λ/D = ${thetaNull.toFixed(4)} rad = ${(thetaNull * DEG).toFixed(2)}°   （半高宽 ≈ 1.02λ/D = ${(1.02 * LAMBDA / dishD * DEG).toFixed(2)}°）`);
    ln(112, '#22c55e', `F(θ)=|2J₁(u)/u|²，u = π(D/λ)sinθ；D/λ = ${(dishD / LAMBDA).toFixed(1)}，λ = ${(LAMBDA * 1e2).toFixed(0)} cm（ν = ${(0.29979 / LAMBDA).toFixed(2)} GHz）`);
    ln(146, '#a855f7', `A_e = ηπD²/4 = ${areaEff.toFixed(1)} m²，G = 4πA_e/λ² = ${gainDbi.toFixed(1)} dBi（口径越大/波长越短 ⇒ 波束越窄、增益越高）`);
    ln(180, '#f472b6', `地平方向旁瓣电平 F(el) = ${(10 * Math.log10(Math.max(sideLobe, 1e-12))).toFixed(1)} dB ⇒ T_sys = ${(tSys).toFixed(0)} K`);
    ln(214, '#94a3b8', `SEFD = 2kT_sys/A_e = ${sefd >= 1000 ? (sefd / 1000).toFixed(1) + ' kJy' : sefd.toFixed(0) + ' Jy'}，ΔS = SEFD/√(2Δντ) = ${dSmin >= 1000 ? (dSmin / 1000).toFixed(2) + ' kJy' : dSmin.toFixed(1) + ' Jy'}`, false, 24);

    infoCtx.fillStyle = sideLobe > 0.004 ? '#ef4444' : '#fbbf24';
    infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：D = ${dishD.toFixed(2)} m   el = ${elev.toFixed(0)}°   θ₁ = ${(thetaNull * DEG).toFixed(2)}°   地面拾取 ${sideLobe > 0.004 ? '严重！需宁静区/垂直观测' : '可忽略'}`,
      22, 252,
    );
    infoCtx.fillStyle = '#64748b';
    infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('（口径 1.5–7 m 为真实小天线；大型射电阵 D/λ~10³，此处旁瓣环数按比例压缩绘制）', 22, 282);
    infoTex.needsUpdate = true;
  }

  updateDish();
  computePhysics();
  updatePattern();
  updateRays(0);
  drawInfo();

  return {
    update(t, dt) {
      // 仰角 12 s 往复（90°→4°）；口径 16 s 往复（1.5 m→7 m）
      elev = 47 + 43 * Math.cos((t % 12) / 12 * TWO_PI);
      dishD = 4.25 - 2.75 * Math.cos((t % 16) / 16 * TWO_PI);

      updateDish();
      computePhysics();
      updatePattern();
      updateRays((t * 0.35) % 1);

      // 倾斜：局部 +y（电轴）转到仰角 el
      const tilt = (elev - 90) / DEG;
      dish.rotation.z = tilt;
      patGroup.rotation.z = tilt;

      // 世界系电轴方向与地平拾取环
      const el = elev / DEG;
      const dir = new THREE.Vector3(Math.cos(el), Math.sin(el), 0);
      const bp = boreGeo.attributes['position'] as import('three').BufferAttribute;
      const ba = bp.array as Float32Array;
      ba[0] = group.position.x + 0; ba[1] = group.position.y + 0.55; ba[2] = 0;
      ba[3] = ba[0] + dir.x * 5.2; ba[4] = ba[1] + dir.y * 5.2; ba[5] = 0;
      bp.needsUpdate = true;

      // 拾取区：地平方向上被旁瓣照亮的环形地面
      const gndR = 3.4 + 2.6 * (90 - elev) / 86;
      pickDisc.position.set(group.position.x + gndR, 0.02, 0);
      pickDisc.scale.setScalar(0.6 + 2.4 * Math.min(1, sideLobe * 200));
      pickMat.opacity = Math.min(0.55, 0.04 + sideLobe * 90);
      const gm = gridMats[0] as import('three').LineBasicMaterial;
      if (gm.color) gm.color.setHex(sideLobe > 0.004 ? 0x7f2c2c : 0x334155);

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
