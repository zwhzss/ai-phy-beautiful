import type { SceneContext, SceneInstance } from '../types';
/**
 * 纳维–斯托克斯方程（P186）—— 主控方程：
 *   ρ(∂u/∂t + u·∇u) = −∇p + μ∇²u + f ，不可压约束 ∇·u = 0（ν = μ/ρ）
 *   涡量形式  Dω/Dt = (ω·∇)u + ν∇²ω —— 非线性对流项造出涡街与湍流，黏性项扩散涡量
 * 画面为圆柱绕流：自变量 ν（即 Re = U·D/ν）在 18 s 内做对数扫描，尾流依次经历
 *   对称驻定（Re<47，回流泡 L_b/D = 0.12·Re）→ 卡门涡街（St = 0.198√(1−19.65/Re)，l = 0.8D/St，h/l = 0.281）
 *   → 三维失稳破碎为湍流（耗散尺度 η = D·Re^(−3/4)，Kolmogorov）
 * 涡核半径按 Lamb–Oseen 黏性扩散 a(t) = √(a₀²+4νt) 真实增长，Γ 随之稀释。
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
  const fract = (x: number): number => x - Math.floor(x);

  // —— 流动参数（模拟单位；无量纲关系取真实值）——
  const D = 0.7;                 // 圆柱直径
  const R = D / 2;
  const U = 2.0;                 // 来流速度固定，靠改变 ν 扫 Re
  const NU_HI = U * D / 5;       // Re = 5
  const NU_LO = U * D / 2000;    // Re = 2000
  const RE_CR = 47;              // 尾流周期性失稳临界 Re
  const RE_TURB = 900;           // 三维失稳 → 湍流尾流
  const XC = -3.6;               // 圆柱轴心 x
  const X_END = 4.4;
  const Y_MID = 2.0, SPAN = 3.2;
  const CYCLE = 18;
  const GAMMA0 = 0.13 * U * D;   // 单个脱落涡的环量量级
  const A0 = 0.09 * D;           // 初始涡核半径
  let nu = NU_HI;
  let re = 5;

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

  // —— 圆柱（轴沿展向 y）+ 来流箭头 ——
  const cyl = new THREE.Mesh(
    geo(new THREE.CylinderGeometry(R, R, SPAN, 24)),
    mat(new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.6, roughness: 0.35 })),
  );
  cyl.position.set(XC, Y_MID, 0);
  group.add(cyl);
  {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([XC - 2.0, Y_MID + 1.85, 0, XC - 1.0, Y_MID + 1.85, 0]), 3));
    group.add(new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color: 0x94a3b8 }))));
    const head = new THREE.Mesh(geo(new THREE.ConeGeometry(0.08, 0.22, 10)), mat(new THREE.MeshBasicMaterial({ color: 0x94a3b8 })));
    head.position.set(XC - 0.88, Y_MID + 1.85, 0);
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0));
    group.add(head);
  }

  // —— 涡管池：每条 = 沿展向 NQ 站 × 破碎片，位置数组同时驱动折线与发光点 ——
  const NQ = 15, NFRAG = 3, NTUBES = 14;
  interface Tube {
    active: boolean; base: boolean; x: number; z: number; s: number; tau: number; gamma: number;
    pts: import('three').Points; line: import('three').Line;
    pGeo: import('three').BufferGeometry; arr: Float32Array;
    pMat: import('three').PointsMaterial; lMat: import('three').LineBasicMaterial;
  }
  const tubes: Tube[] = [];
  for (let i = 0; i < NTUBES; i++) {
    const arr = new Float32Array(NQ * NFRAG * 3);
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const pMat = mat(new THREE.PointsMaterial({ color: 0x22d3ee, size: 0.1, sizeAttenuation: true, transparent: true, opacity: 0.8 }));
    const lMat = mat(new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.3 }));
    const pts = new THREE.Points(g, pMat);
    const line = new THREE.Line(g, lMat);
    group.add(pts, line);
    tubes.push({ active: false, base: false, x: 0, z: 0, s: 1, tau: 0, gamma: 0, pts, line, pGeo: g, arr, pMat, lMat });
  }
  function freeTube(): Tube | null {
    for (const v of tubes) if (!v.active) return v;
    return null;
  }

  // —— 示踪粒子：由速度场 u(x,z) 拉格朗日平流 ——
  const NP = 620;
  const pPos = new Float32Array(NP * 3);
  const pCol = new Float32Array(NP * 3);
  const pGeo = geo(new THREE.BufferGeometry());
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  group.add(new THREE.Points(pGeo, mat(new THREE.PointsMaterial({ size: 0.05, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.9 }))));
  const px = new Float32Array(NP), pz = new Float32Array(NP);
  for (let i = 0; i < NP; i++) {
    px[i] = XC - 2 + Math.random() * (X_END - XC + 2);
    pz[i] = (Math.random() - 0.5) * 5.0;
    pPos[i * 3 + 1] = (Math.random() - 0.5) * 3.0;
  }

  // —— 速度场：均匀流 + 偶极子（无黏绕流）+ 尾流亏损 + 各涡的 Lamb–Oseen 诱导速度 ——
  interface Swirl { x: number; z: number; s: number; a: number; g: number }
  const vs: Swirl[] = [];
  const vout = { x: 0, z: 0 };
  function uAt(x: number, z: number, out: { x: number; z: number }): void {
    const rx = x - XC;
    const r2 = rx * rx + z * z;
    if (r2 > R * R) {
      const c = (R * R) / (r2 * r2);
      out.x = U * (1 - c * (rx * rx - z * z));
      out.z = U * (-2 * c * rx * z);
    } else {
      out.x = 0; out.z = 0;
    }
    if (rx > 0) {
      const dw = R + 0.55 * D * Math.sqrt(Math.max(0.05, rx) / D);
      const def = 0.8 * Math.exp(-(z * z) / (dw * dw)) * (1 - Math.exp(-rx / (2.2 * D)));
      out.x *= 1 - def;
    }
    for (let k = 0; k < vs.length; k++) {
      const v = vs[k];
      const dx = x - v.x, dz = z - v.z;
      const r = Math.max(1e-3, Math.hypot(dx, dz));
      const ut = (v.g / (TWO_PI * r)) * (1 - Math.exp(-(r * r) / (v.a * v.a)));
      out.x -= v.s * ut * (dz / r);
      out.z += v.s * ut * (dx / r);
    }
  }

  // —— 标签 + 信息面板 ——
  function makeLabel(text: string, color: string, scale = 3.6): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  const lb1 = makeLabel('圆柱绕流：涡管沿展向 y，平面 ω = ω_y ≠ 0', '#94a3b8', 4.6); lb1.position.set(0.3, 4.25, 0);
  const lb2 = makeLabel('ν 大 → 涡量被黏性抹平：对称驻定', '#a855f7', 4.4); lb2.position.set(-3.3, 0.3, 2.0);
  const lb3 = makeLabel('ν 小 → 涡街脱落 → 湍流破碎', '#22d3ee', 4.4); lb3.position.set(3.3, 0.3, 2.0);
  group.add(lb1, lb2, lb3);

  const infoCv = document.createElement('canvas');
  infoCv.width = 800; infoCv.height = 252;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(8.8, 2.77)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 5.6, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  const st = { s: 0, f: 0, l: 0, h: 0, a: 0, cd: 0, eta: 0, lb: 0, regime: '' };

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 800, 252);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 792, 244);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3;
    infoCtx.strokeRect(4, 4, 792, 244);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 28px "PingFang SC", sans-serif';
    infoCtx.fillText('Navier–Stokes  ρ(∂u/∂t + u·∇u) = −∇p + μ∇²u + f', 22, 40);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '25px "PingFang SC", sans-serif';
    infoCtx.fillText('涡量输运 Dω/Dt = (ω·∇)u + ν∇²ω，Re = U·D/ν = 对流项/黏性项', 22, 78);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('Lamb–Oseen 涡核扩散 a(t)=√(a₀²+4νt)，St = 0.198√(1−19.65/Re)', 22, 112);
    infoCtx.fillStyle = '#34d399';
    infoCtx.fillText('回流泡 L_b/D≈0.12·Re（驻定区，Re<47）；涡街 l=0.8D/St、h/l=0.281；Cd=1+10Re^(−0.6)', 22, 146);
    infoCtx.fillStyle = '#f472b6';
    infoCtx.fillText('Re≈47 起脱落；Re≈190 三维失稳（Mode A），Re≳10³ 尾流全湍流，η = D·Re^(−3/4)', 22, 180);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：Re=${re.toFixed(0)}  ν=${nu.toFixed(4)}  ${st.regime}`, 22, 212,
    );
    infoCtx.fillText(
      `St=${st.s.toFixed(3)} f=${st.f.toFixed(2)}Hz l=${st.l.toFixed(2)} a=${st.a.toFixed(2)} Cd=${st.cd.toFixed(2)} η=${st.eta.toFixed(3)}`, 22, 240,
    );
    infoTex.needsUpdate = true;
  }
  drawInfo();

  let shedTimer = 0;
  let shedSide = 1;

  return {
    update(t, dt) {
      // 自变量：ν 对数扫描（Re = 5 → 2000 → 5）
      const ph = (t % CYCLE) / CYCLE;
      const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
      nu = NU_HI * Math.pow(NU_LO / NU_HI, tri);
      re = U * D / nu;

      const shedding = re > RE_CR;
      st.s = shedding ? 0.198 * Math.sqrt(Math.max(0, 1 - 19.65 / re)) : 0;
      st.f = shedding ? (st.s * U) / D : 0;
      st.l = shedding ? (0.8 * U) / st.f : 0;
      st.h = 0.281 * st.l;
      // 回流泡长度：驻定低 Re 律 L_b/D=0.12·Re（文件头自述，Re<47）保证非负；
      // 取 max 与近区拟合 0.26(1−46/Re) 融合，避免 Re<46 时拟合式转负把涡推到柱面
      st.lb = Math.min(6 * D, Math.max(0.12 * re, 0.26 * (1 - 46 / Math.max(re, 10))) * D);
      st.cd = 1 + 10 * Math.pow(Math.max(re, 0.4), -0.6);
      st.eta = D * Math.pow(Math.max(re, 1), -0.75);
      st.a = Math.sqrt(A0 * A0 + 4 * nu * 0.8);
      st.regime = !shedding ? '对称驻定尾流（回流泡）' : re < 190 ? '卡门涡街：周期性脱落' : re < 1000 ? '三维失稳（Mode A）' : '尾流全湍流';

      const turb = Math.max(0, Math.min(1, (re - RE_TURB) / (2000 - RE_TURB)));
      const showBubble = !shedding || re < RE_CR * 1.5;

      // —— 驻定回流泡：柱后一对反向涡，长度由经验式 L_b = 0.12·Re·D 给出 ——
      const bx = XC + R + st.lb * 0.5;
      const bz = Math.max(0.14, st.lb * 0.3);
      const bg = 0.22 * U * D;
      const bubA = Math.sqrt(A0 * A0 + 4 * nu * 0.3);
      for (let k = 0; k < 2; k++) {
        const v = tubes[k];
        v.active = showBubble;
        v.base = true;
        v.x = bx; v.z = k === 0 ? bz : -bz;
        v.s = k === 0 ? -1 : 1;
        v.gamma = bg; v.tau = 0.3;
      }

      // —— 脱落：半周期发一条涡管，上下排交替（间距自然等于 l = 0.8U/f） ——
      if (shedding) {
        const Th = 0.5 / st.f;
        shedTimer += dt;
        let guard = 0;
        while (shedTimer >= Th && guard++ < 3) {
          shedTimer -= Th;
          const tv = freeTube();
          if (tv) {
            tv.active = true; tv.base = false; tv.tau = 0;
            tv.x = XC + R + 0.15 * D;
            tv.z = shedSide * 0.14 * st.l;
            tv.s = shedSide;
            tv.gamma = GAMMA0 * (0.75 + 0.25 * Math.sin(tv.x * 3.1));
            shedSide = -shedSide;
          }
        }
      } else {
        shedTimer = 0;
      }
      for (let i = 2; i < NTUBES; i++) {
        const v = tubes[i];
        if (!v.active) continue;
        v.tau += dt;
        v.x += 0.8 * U * dt;
        if (v.x > X_END + 0.3 || v.tau > 16) v.active = false;
      }

      // —— 涡量清单（供速度场叠加）——
      vs.length = 0;
      for (const v of tubes) {
        if (!v.active || v.gamma <= 0) continue;
        const a = Math.sqrt(A0 * A0 + 4 * nu * v.tau);
        const g = (v.gamma / (1 + 0.35 * (a / A0) * (a / A0))) * Math.exp(-0.05 * v.tau);
        vs.push({ x: v.x, z: v.z, s: v.s, a: Math.max(a, A0), g });
      }

      // —— 涡管几何：展向蛇形扰动（波长 ∝ Re^(−3/4)）+ 高 Re 破碎成子片 ——
      const lam = Math.max(0.45, 0.55 * SPAN * Math.pow(Math.max(re, RE_TURB) / RE_TURB, -0.75));
      const fragAmp = Math.min(0.5 * D, 40 * st.eta);   // η 放大 40× 才看得见
      for (let i = 0; i < NTUBES; i++) {
        const v = tubes[i];
        if (!v.active || v.gamma <= 0) { v.pts.visible = false; v.line.visible = false; continue; }
        v.pts.visible = true; v.line.visible = true;
        const a = Math.max(A0, Math.sqrt(A0 * A0 + 4 * nu * v.tau));
        const strength = Math.min(1, v.gamma / GAMMA0) * Math.exp(-0.05 * v.tau);
        const frag = turb > 0.03 ? NFRAG : 1;
        let n = 0;
        for (let q = 0; q < NQ && n < NQ * NFRAG; q++) {
          const y = Y_MID - SPAN / 2 + (SPAN * q) / (NQ - 1);
          const amp = (0.015 + 0.55 * turb) * Math.min(1, 0.1 + v.tau * 0.4) * D;
          const meX = amp * Math.sin((TWO_PI * y) / lam + v.x * 1.4 + v.s * 2.0);
          const meZ = amp * Math.cos((TWO_PI * y) / (lam * 0.83) + v.x * 1.1);
          for (let f = 0; f < frag && n < NQ * NFRAG; f++) {
            const h1 = fract(Math.sin(q * 127.1 + i * 311.7 + f * 74.7) * 43758.5453) * 2 - 1;
            const h2 = fract(Math.sin(q * 269.5 + i * 183.3 + f * 246.1) * 24634.6345) * 2 - 1;
            const rr = a * (f === 0 ? 1 : 0.45);
            const ang = q * 0.9 + f * 2.09 + i * 0.7 + v.tau * 1.3;
            v.arr[n * 3] = v.x + meX + rr * Math.cos(ang) + h1 * fragAmp * turb;
            v.arr[n * 3 + 1] = y + h2 * a * 0.4 * turb;
            v.arr[n * 3 + 2] = v.z + meZ + rr * Math.sin(ang) + h2 * fragAmp * turb;
            n++;
          }
        }
        v.pGeo.setDrawRange(0, n);   // 未写满的尾部不入图（同一 geometry 驱动折线与点，越界点会把折线拉到 y=−9999）
        v.pGeo.attributes['position'].needsUpdate = true;
        const col = new THREE.Color(v.s > 0 ? 0x22d3ee : 0xa855f7).lerp(new THREE.Color(0x1e293b), 1 - strength);
        v.pMat.color.copy(col);
        v.lMat.color.copy(col);
        v.pMat.size = Math.max(0.045, Math.min(0.42, a * 1.15));
        v.pMat.opacity = 0.3 + 0.6 * strength;
        v.lMat.opacity = 0.12 + 0.28 * strength;
      }

      // —— 粒子平流（2 子步）+ 按局部速度着色 ——
      const sub = 2;
      const h = Math.min(dt, 0.033) / sub;
      for (let i = 0; i < NP; i++) {
        for (let s2 = 0; s2 < sub; s2++) {
          uAt(px[i], pz[i], vout);
          px[i] += vout.x * h;
          pz[i] += vout.z * h;
        }
        const rx = px[i] - XC;
        if (rx * rx + pz[i] * pz[i] < R * R * 1.05 || px[i] > X_END || Math.abs(pz[i]) > 2.6 || !isFinite(px[i])) {
          px[i] = XC - 2 - Math.random() * 0.5;
          pz[i] = (Math.random() - 0.5) * 4.4;
        }
        uAt(px[i], pz[i], vout);
        const sp = Math.min(1.4, Math.hypot(vout.x, vout.z) / U);
        const back = vout.x < 0 ? 1 : 0;
        const i3 = i * 3;
        pPos[i3] = px[i];
        pPos[i3 + 2] = pz[i];
        pCol[i3] = 0.08 + 0.5 * sp + 0.75 * back;
        pCol[i3 + 1] = 0.3 + 0.6 * sp - 0.1 * back;
        pCol[i3 + 2] = 0.92;
      }
      pGeo.attributes['position'].needsUpdate = true;
      pGeo.attributes['color'].needsUpdate = true;

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
