import type { SceneContext, SceneInstance } from '../types';
/**
 * 直流电动机（P119）—— 主控方程：
 *   安培力偶力矩  τ_em = N·B·I_a·A·|cos α|（矩形线圈，α 为线圈法向 ν̂ 与 B 的夹角；换向器每半圈翻一次电流符号 ⇒ 力矩恒号）
 *   电枢回路      I_a = (V − ε_back)/R_a，  ε_back = k_e·ω
 *   机械方程      J·dω/dt = τ_em − B_v·ω − τ_L  ⇒ 稳态机械特性 ω = V/k_e − [R_a/(k_e·k_t)]·τ_L
 * τ_L 为扫描自变量；α 与 ω 由上式逐步积分（α 乘视觉降速系数，面板仍给真实转速）。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  // —— 资源登记，dispose 时统一释放 ——
  const geos: { dispose(): void }[] = [];
  const mats: { dispose(): void }[] = [];
  const texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  const TWO_PI = Math.PI * 2;
  const UP = new THREE.Vector3(0, 1, 0);

  // —— 电机参数（SI）——
  const N_T = 1, B_FLUX = 0.8, COIL_L = 0.9, COIL_W = 0.42;
  const COIL_A = COIL_L * COIL_W;              // A = L·w
  const K_T = N_T * B_FLUX * COIL_A;           // τ_em = k_t·I_a
  const K_E = K_T;                             // SI 下 k_e = k_t
  const V_A = 12, R_A = 0.75, J_ROTOR = 0.0015, B_VISC = 0.00015;
  const W0 = V_A / K_E;                        // 理想空载转速
  const I_STALL = V_A / R_A;
  const T_STALL = K_T * I_STALL;               // 堵转转矩
  const SLOPE = R_A / (K_E * K_T);             // 机械特性下垂
  const ALPHA_VIS = 0.018;                     // 视觉降速
  const AXIS_Y = 1.75;
  const CYCLE = 16;

  // 星野 + 地面
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

  // —— 工具：箭头 / 折线 / 标签 ——
  const headGeo = geo(new THREE.ConeGeometry(0.078, 0.21, 10));
  interface Arrow { line: import('three').Line; head: import('three').Mesh; }
  function makeArrow(m: import('three').Material): Arrow {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(g, m);
    const head = new THREE.Mesh(headGeo, m);
    group.add(line, head);
    return { line, head };
  }
  function setArrow(a: Arrow, px: number, py: number, pz: number, dx: number, dy: number, dz: number, len: number): void {
    const attr = a.line.geometry.attributes['position'] as import('three').BufferAttribute;
    const arr = attr.array as Float32Array;
    arr[0] = px; arr[1] = py; arr[2] = pz;
    arr[3] = px + dx * len; arr[4] = py + dy * len; arr[5] = pz + dz * len;
    attr.needsUpdate = true;
    a.head.position.set(px + dx * (len + 0.105), py + dy * (len + 0.105), pz + dz * (len + 0.105));
    a.head.quaternion.setFromUnitVectors(UP, new THREE.Vector3(dx, dy, dz));
  }
  function polyLine(pts: import('three').Vector3[], m: import('three').Material): import('three').Line {
    return new THREE.Line(geo(new THREE.BufferGeometry().setFromPoints(pts)), m);
  }
  function makeLabel(text: string, color: string, scale = 3.6): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 28px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  /** 折线上的等弧长取点 */
  function arcTable(pts: import('three').Vector3[]): { cum: number[]; total: number } {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    return { cum, total: cum[cum.length - 1] };
  }
  function pointOn(pts: import('three').Vector3[], tab: { cum: number[]; total: number }, s: number, out: import('three').Vector3): void {
    const d = ((s % tab.total) + tab.total) % tab.total;
    let i = 1;
    while (i < tab.cum.length - 1 && tab.cum[i] < d) i++;
    const f = (d - tab.cum[i - 1]) / Math.max(1e-6, tab.cum[i] - tab.cum[i - 1]);
    out.copy(pts[i - 1]).lerp(pts[i], f);
  }

  // —— 定子磁极（N 在 −x，气隙 B 沿 +x）——
  const poleGeo = geo(new THREE.BoxGeometry(1.1, 2.4, 2.4));
  const poleN = new THREE.Mesh(poleGeo, mat(new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 })));
  const poleS = new THREE.Mesh(poleGeo, mat(new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.6 })));
  poleN.position.set(-1.95, AXIS_Y, 0);
  poleS.position.set(1.95, AXIS_Y, 0);
  group.add(poleN, poleS);
  const labN = makeLabel('N', '#ef4444', 1.1); labN.position.set(-1.28, AXIS_Y + 1.6, 0);
  const labS = makeLabel('S', '#3b82f6', 1.1); labS.position.set(1.28, AXIS_Y + 1.6, 0);
  group.add(labN, labS);

  const fieldMat = mat(new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 }));
  const fieldArrows: Arrow[] = [];
  for (let i = 0; i < 4; i++) fieldArrows.push(makeArrow(fieldMat));
  const FIELD_Y = [AXIS_Y - 0.78, AXIS_Y - 0.26, AXIS_Y + 0.26, AXIS_Y + 0.78];

  // —— 电枢线圈（5 点闭合矩形，逐帧由 α 重算顶点）——
  const wireGeo = geo(new THREE.BufferGeometry());
  const wirePos = new Float32Array(5 * 3);
  wireGeo.setAttribute('position', new THREE.BufferAttribute(wirePos, 3));
  group.add(new THREE.Line(wireGeo, mat(new THREE.LineBasicMaterial({ color: 0xf59e0b }))));
  const shaft = new THREE.Mesh(
    geo(new THREE.CylinderGeometry(0.075, 0.075, 2.6, 10)),
    mat(new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.8, roughness: 0.3 })),
  );
  shaft.position.set(0, AXIS_Y, 0);
  group.add(shaft);

  // —— 换向器两半铜环（split 面与线圈平面共面 ⇒ 恰在中性面翻流）——
  const halfGeo = geo(new THREE.CylinderGeometry(0.3, 0.3, 0.34, 18, 1, false, 0, Math.PI));
  const segMatA = mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.75, roughness: 0.35 }));
  const segMatB = mat(new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.75, roughness: 0.35 }));
  const segA = new THREE.Mesh(halfGeo, segMatA);
  const segB = new THREE.Mesh(halfGeo, segMatB);
  const COMM_Y = AXIS_Y - 0.66;
  segA.position.set(0, COMM_Y, 0);
  segB.position.set(0, COMM_Y, 0);
  group.add(segA, segB);
  const brushGeo = geo(new THREE.BoxGeometry(0.15, 0.34, 0.2));
  const brushMat = mat(new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 }));
  const brushP = new THREE.Mesh(brushGeo, brushMat); brushP.position.set(0, COMM_Y, 0.44);
  const brushM = new THREE.Mesh(brushGeo, brushMat); brushM.position.set(0, COMM_Y, -0.44);
  group.add(brushP, brushM);

  // —— 外电路（直流电源 V_a、电枢电阻 R_a）——
  const circuitMat = mat(new THREE.LineBasicMaterial({ color: 0x64748b }));
  const extPts = [
    new THREE.Vector3(0, COMM_Y, 0.44), new THREE.Vector3(0, 0.4, 0.6),
    new THREE.Vector3(0, 0.4, 1.9), new THREE.Vector3(0.34, 0.4, 2.2),
    new THREE.Vector3(0.34, 0.4, 2.6), new THREE.Vector3(-0.34, 0.4, 2.6),
    new THREE.Vector3(-0.34, 0.4, 2.2), new THREE.Vector3(0, 0.4, 1.9),
    new THREE.Vector3(0, 0.4, 0.6), new THREE.Vector3(0, COMM_Y, -0.44),
  ];
  group.add(polyLine(extPts, circuitMat));
  const batt = new THREE.Mesh(
    geo(new THREE.BoxGeometry(0.72, 0.3, 0.16)),
    mat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0e7490, roughness: 0.5 })),
  );
  batt.position.set(0, 0.4, 2.6);
  group.add(batt);

  // 载流子：电枢（换向，方向随 comm）与外电路（单向 DC）
  const carGeo = geo(new THREE.SphereGeometry(0.06, 8, 8));
  const armCarMat = mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
  const extCarMat = mat(new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
  const armCars: import('three').Mesh[] = [];
  const extCars: import('three').Mesh[] = [];
  for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(carGeo, armCarMat); group.add(c); armCars.push(c); }
  for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(carGeo, extCarMat); group.add(c); extCars.push(c); }
  const extTab = arcTable(extPts);

  // —— 矢量箭头 ——
  const forceMatA = mat(new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 1 }));
  const forceMatB = mat(new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 1 }));
  const fArrowA = makeArrow(forceMatA);
  const fArrowB = makeArrow(forceMatB);
  const torqueArrow = makeArrow(mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })));
  const emfArrow = makeArrow(mat(new THREE.MeshBasicMaterial({ color: 0xa855f7 })));

  // —— 稳态机械特性图 ω(τ) ——
  const CX0 = -3.75, CW = 2.9, CY0 = 0.5, CH = 2.6, CZ = 2.35;
  const axMat = mat(new THREE.LineBasicMaterial({ color: 0x475569 }));
  {
    const gh = geo(new THREE.BufferGeometry());
    gh.setAttribute('position', new THREE.BufferAttribute(new Float32Array([CX0, CY0, CZ, CX0 + CW, CY0, CZ]), 3));
    group.add(new THREE.Line(gh, axMat));
    const gv = geo(new THREE.BufferGeometry());
    gv.setAttribute('position', new THREE.BufferAttribute(new Float32Array([CX0, CY0, CZ, CX0, CY0 + CH, CZ]), 3));
    group.add(new THREE.Line(gv, axMat));
  }
  const charGeo = geo(new THREE.BufferGeometry());
  charGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  group.add(new THREE.Line(charGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee }))));
  const opDot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.1, 12, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })));
  const loadDot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.07, 10, 10)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  group.add(opDot, loadDot);
  const charLab = makeLabel('机械特性 ω = V/k_e − (R_a/k_ak_t)·τ_L', '#22d3ee', 4.2);
  charLab.position.set(CX0 + CW / 2, CY0 + CH + 0.42, CZ);
  group.add(charLab);

  // —— 标签 ——
  const l1 = makeLabel('磁极气隙：B 沿 +x，F = I·L×B', '#94a3b8', 4.4); l1.position.set(0, AXIS_Y + 2.3, 0);
  const l2 = makeLabel('换向器每半圈翻流 → 力矩恒号', '#fbbf24', 4.2); l2.position.set(0, COMM_Y - 0.72, 0);
  const l3 = makeLabel('反电动势 ε_back = k_e·ω', '#a855f7', 3.4); l3.position.set(0.9, 1.15, 2.35);
  group.add(l1, l2, l3);

  // —— 信息面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 800; infoCv.height = 250;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(8.8, 2.75)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 5.4, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  // —— 动力学状态 ——
  let alpha = 0.4;
  let omega = 30;
  let iA = 0;
  let comm = 1;
  let armS = 0;
  let extS = 0;

  function drawInfo(tauL: number, tauEm: number): void {
    infoCtx.clearRect(0, 0, 800, 250);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 792, 242);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3;
    infoCtx.strokeRect(4, 4, 792, 242);

    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 29px "PingFang SC", sans-serif';
    infoCtx.fillText('直流电动机  安培力偶 + 换向器 + 反电动势', 22, 42);

    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '26px "PingFang SC", sans-serif';
    infoCtx.fillText('τ_em = N·B·I_a·A·|cos α| = k_t·I_a，A = L·w = ' + COIL_A.toFixed(3) + ' m²，k_t = ' + K_T.toFixed(4), 22, 82);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('I_a = (V − k_e·ω)/R_a（V=' + V_A + 'V，R_a=' + R_A + 'Ω）→ 转速越高电流越小', 22, 118);
    infoCtx.fillStyle = '#34d399';
    infoCtx.fillText('稳态 ω = ' + W0.toFixed(0) + ' − ' + SLOPE.toFixed(1) + '·τ_L rad/s（空载 ' + ((W0 * 60) / TWO_PI).toFixed(0) + ' rpm，堵转 τ=' + T_STALL.toFixed(2) + ' N·m）', 22, 154);
    infoCtx.fillStyle = '#f472b6';
    infoCtx.fillText('J·dω/dt = τ_em − B_v·ω − τ_L；单线圈转矩脉动 ⟨|cos α|⟩ = 2/π ⇒ 实际用多槽电枢', 22, 190);

    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 25px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：τ_L=${tauL.toFixed(2)}N·m  I_a=${iA.toFixed(2)}A  ε_back=${(K_E * omega).toFixed(2)}V  τ_em=${tauEm.toFixed(2)}N·m  n=${((omega * 60) / TWO_PI).toFixed(0)}rpm`,
      22, 226,
    );
    infoTex.needsUpdate = true;
  }
  drawInfo(0, 0);

  const tmp = new THREE.Vector3();

  return {
    update(t, dt) {
      // 自变量：负载转矩 τ_L 在 16 s 内从 0 扫到接近堵转再回来
      const cyc = (t % CYCLE) / CYCLE;
      const tauL = T_STALL * 0.95 * (0.5 - 0.5 * Math.cos(TWO_PI * cyc));

      // 换向：α 过中性面（cos α = 0）时翻转电枢电流符号
      const commNew = Math.cos(alpha) >= 0 ? 1 : -1;
      if (commNew !== comm) {
        comm = commNew;
        segMatA.color.setHex(comm > 0 ? 0xfbbf24 : 0xb45309);
        segMatB.color.setHex(comm > 0 ? 0xb45309 : 0xfbbf24);
      }

      // 电路 + 机械：半隐式欧拉
      iA = Math.max(0, (V_A - K_E * omega) / R_A);
      const tauEm = K_T * iA;
      omega = Math.max(0, Math.min(W0 * 1.02, omega + ((tauEm - B_VISC * omega - tauL) / J_ROTOR) * Math.min(dt, 0.02)));
      alpha = (alpha + omega * ALPHA_VIS * dt) % TWO_PI;

      // 线圈顶点：ν̂ = (cos α, 0, sin α)
      const nux = Math.cos(alpha), nuz = Math.sin(alpha);
      const hw = COIL_W / 2, hl = COIL_L / 2;
      const ax = nux * hw, az = nuz * hw;
      const coil = [
        new THREE.Vector3(ax, AXIS_Y + hl, az),
        new THREE.Vector3(ax, AXIS_Y - hl, az),
        new THREE.Vector3(-ax, AXIS_Y - hl, -az),
        new THREE.Vector3(-ax, AXIS_Y + hl, -az),
        new THREE.Vector3(ax, AXIS_Y + hl, az),
      ];
      for (let i = 0; i < 5; i++) {
        wirePos[i * 3] = coil[i].x; wirePos[i * 3 + 1] = coil[i].y; wirePos[i * 3 + 2] = coil[i].z;
      }
      wireGeo.attributes['position'].needsUpdate = true;

      // 两长边安培力：|F| = I·L·B（恒定），方向 ∓ẑ·comm；力臂决定力矩
      const fLen = 0.26 + 1.1 * (iA / I_STALL);
      setArrow(fArrowA, ax, AXIS_Y, az, 0, 0, -comm, fLen);
      setArrow(fArrowB, -ax, AXIS_Y, -az, 0, 0, comm, fLen);
      const vis = 0.3 + 0.7 * Math.min(1, iA / I_STALL);
      forceMatA.opacity = vis; forceMatB.opacity = vis;

      // 力矩矢量（沿转轴）与反电动势箭头
      setArrow(torqueArrow, 0, AXIS_Y + 0.85, 0, 0, 1, 0, 0.35 + 1.9 * (tauEm / T_STALL));
      setArrow(emfArrow, 0.75, 0.55, 2.2, 0, 1, 0, -0.25 - 1.0 * (K_E * omega / V_A));

      // 气隙场线（电枢反应：电流越大端部越密）
      fieldMat.opacity = 0.3 + 0.35 * Math.min(1, iA / I_STALL);
      for (let i = 0; i < 4; i++) setArrow(fieldArrows[i], -1.25, FIELD_Y[i], 0, 1, 0, 0, 2.5);

      // 换向器随转子转：半环圆心方向取 (sin α,0,−cos α) ⟂ 线圈边方向 ⇒ split 面恰含线圈平面，
      // 电刷过缝的条件 (sinα,0,−cosα)·ẑ=0 ⇒ cos α=0，正是上面的翻流时刻（中性面）。
      segA.rotation.y = -alpha + Math.PI / 2;
      segB.rotation.y = -alpha + Math.PI / 2 + Math.PI;

      // 载流子动画：电枢绕行方向随 comm 翻转，外电路恒向
      const speed = 0.03 + 0.55 * (iA / I_STALL);
      armS += comm * speed * dt * 2;
      extS += speed * dt * 2;
      const per = 2 * (COIL_L + COIL_W);
      for (let i = 0; i < 6; i++) {
        const d = (((armS + (i / 6) * per) % per) + per) % per;
        const e = d % (per / 2);
        // 前半：沿 +ν̂ 那一边从 +hl 走到 −hl；后半：沿 −ν̂ 那一边从 −hl 走回 +hl
        if (d < per / 2) {
          const y = AXIS_Y + hl - Math.min(COIL_L, d);
          tmp.set(ax, y, az);
        } else {
          const y = AXIS_Y - hl + Math.min(COIL_L, d - per / 2);
          tmp.set(-ax, y, -az);
        }
        void e;
        armCars[i].position.copy(tmp);
      }
      for (let i = 0; i < 6; i++) {
        pointOn(extPts, extTab, extS + (i / 6) * extTab.total, tmp);
        extCars[i].position.copy(tmp);
      }

      // 机械特性（公式画的直线）+ 工作点
      const cha = charGeo.attributes['position'].array as Float32Array;
      cha[0] = CX0; cha[1] = CY0 + CH * ((W0 - SLOPE * 0) / W0); cha[2] = CZ;
      cha[3] = CX0 + CW; cha[4] = CY0 + CH * Math.max(0, (W0 - SLOPE * T_STALL) / W0); cha[5] = CZ;
      charGeo.attributes['position'].needsUpdate = true;
      const xf = CX0 + CW * Math.min(1, tauL / T_STALL);
      opDot.position.set(xf, CY0 + CH * Math.min(1, omega / W0), CZ);
      loadDot.position.set(xf, CY0, CZ);

      // 面板按 5 Hz 刷新
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo(tauL, tauEm);
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
