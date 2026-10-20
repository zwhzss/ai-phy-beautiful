import type { SceneContext, SceneInstance } from '../types';
/**
 * 景深（P88）—— 主控方程（薄透镜 + 相似三角形，全部解析可算）：
 *   共轭  1/s + 1/s′ = 1/f                       ⇒ s′ = f·s/(s−f)
 *   弥散圆  c_geom = A·|s′_i − s′|/s′_i ，A = f/(2N)（光圈半径）
 *   界限量程  D_near = f²s/(f² + N·c·(s−f))，D_far = f²s/(f² − N·c·(s−f))，
 *            超焦距 H = f²/(N·c) + f（s→H 时 D_far→∞）
 * 画面：物点光锥过光圈边缘汇聚到各自的像点，在像面留下弥散圆；
 * 扫描自变量为光圈数 N 与对焦距离 s，清晰壳体（D_near–D_far）随两者实时伸缩。
 * 轴向按真实尺度（4.4 world/m），径向放大 9× 才画得出光锥（共轭关系只依赖轴向）；
 * 右下角对比图按 log₁₀(ρ/(c/2)) 画柱高，青线即容许界 ρ=c/2，
 * 但 D_near/D_far/H/ρ 全部由上式同一批变量算出，面板读数与几何严格同源。
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
  // —— 真实相机参数（米）——
  const F = 0.05;                  // 50 mm
  const C_ACC = 0.000024;          // 容许弥散圆 0.024 mm
  const SC = 4.4;                  // world / m（轴向）
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

  // 光轴
  {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-4.2, 0, 0, 1.2, 0, 0]), 3));
    group.add(new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.9 }))));
  }

  // —— 物点（沿轴向分布，高度交替上下，便于看光锥）——
  const NO = 8;
  const DIST = [0.11, 0.155, 0.21, 0.28, 0.37, 0.48, 0.63, 0.84];
  const HOBJ = DIST.map((_, i) => (i % 2 === 0 ? 1 : -1) * 0.022);
  const objMat: import('three').MeshStandardMaterial[] = [];
  const objMesh: import('three').Mesh[] = [];
  const oGeo = geo(new THREE.SphereGeometry(0.055, 14, 14));
  for (let i = 0; i < NO; i++) {
    const m = mat(new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.35, roughness: 0.5 }));
    const s = new THREE.Mesh(oGeo, m);
    group.add(s);
    objMesh.push(s); objMat.push(m);
  }

  // —— 镜头：镜筒 + 可变光圈（孔径环，真实半径 A = f/2N）——
  const barrelGeo = geo(new THREE.CylinderGeometry(0.115, 0.115, 0.1, 20));
  const barrel = new THREE.Mesh(barrelGeo, mat(new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.7, roughness: 0.4 })));
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0, 0, 0);
  group.add(barrel);
  const AP_SEG = 40;
  const apGeo = geo(new THREE.BufferGeometry());
  const apPos = new Float32Array((AP_SEG + 1) * 3);
  apGeo.setAttribute('position', new THREE.BufferAttribute(apPos, 3));
  group.add(new THREE.Line(apGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee }))));
  const bladeGeo = geo(new THREE.BufferGeometry());
  const NBLADE = 8;
  bladeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NBLADE * 6), 3));
  group.add(new THREE.Line(bladeGeo, mat(new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.85 }))));

  // —— 像面（传感器）——
  const sensor = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(0.34, 0.34)),
    mat(new THREE.MeshBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.16, side: THREE.DoubleSide })),
  );
  sensor.rotation.y = Math.PI / 2;
  group.add(sensor);
  const focusBand = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(0.008, 1.5)),
    mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.8, side: THREE.DoubleSide })),
  );
  group.add(focusBand);

  // —— 光锥线段：每个物点 7 段（上缘、下缘各三段 + 主光线）——
  const SEG_PER = 7;
  const coneGeo = geo(new THREE.BufferGeometry());
  const conePos = new Float32Array(NO * SEG_PER * 2 * 3);
  coneGeo.setAttribute('position', new THREE.BufferAttribute(conePos, 3));
  group.add(new THREE.LineSegments(coneGeo, mat(new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.55 }))));

  // —— 像面弥散圆（放大 BLUR_MAG）——
  const DISK_SEG = 20;
  const diskGeo = geo(new THREE.BufferGeometry());
  const diskPos = new Float32Array(NO * DISK_SEG * 2 * 3);
  diskGeo.setAttribute('position', new THREE.BufferAttribute(diskPos, 3));
  group.add(new THREE.LineSegments(diskGeo, mat(new THREE.LineBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.85 }))));

  // —— 清晰壳体（D_near–D_far 区间 + 两面边界墙）——
  const shellGeo = geo(new THREE.BufferGeometry());
  const shellPos = new Float32Array(4 * 3);
  shellGeo.setAttribute('position', new THREE.BufferAttribute(shellPos, 3));
  shellGeo.setIndex([0, 1, 2, 2, 1, 3]);
  const shellMat = mat(new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
  group.add(new THREE.Mesh(shellGeo, shellMat));
  const wallGeo = geo(new THREE.BufferGeometry());
  const wallPos = new Float32Array(2 * 4 * 3);
  wallGeo.setAttribute('position', new THREE.BufferAttribute(wallPos, 3));
  wallGeo.setIndex([0, 1, 2, 2, 1, 3, 4, 5, 6, 6, 5, 7]);
  group.add(new THREE.Mesh(wallGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.5, side: THREE.DoubleSide }))));

  // —— 右下角对比图：log 尺度柱状图，柱高 = log₁₀(ρ / (c/2))，青线 = 容许界 ——
  const IY0 = 0.06, IX = 2.0, IZ = 1.0;
  const BAR_H = 0.6, BAR_W = 0.13;
  const CRIT_H = BAR_H * 0.4;                      // log10(1)=0 处即 ρ = c/2
  const insetGeo = geo(new THREE.BufferGeometry());
  const insetPos = new Float32Array(NO * 4 * 3);
  const insetCol = new Float32Array(NO * 4 * 3);
  insetGeo.setAttribute('position', new THREE.BufferAttribute(insetPos, 3));
  insetGeo.setAttribute('color', new THREE.BufferAttribute(insetCol, 3));
  group.add(new THREE.LineSegments(insetGeo, mat(new THREE.LineBasicMaterial({ vertexColors: true }))));
  const critGeo = geo(new THREE.BufferGeometry());
  critGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([IX - 1.6, IY0 + CRIT_H, IZ, IX + 1.6, IY0 + CRIT_H, IZ]), 3));
  group.add(new THREE.Line(critGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee }))));
  const insetBase = geo(new THREE.BufferGeometry());
  insetBase.setAttribute('position', new THREE.BufferAttribute(new Float32Array([IX - 1.6, IY0, IZ, IX + 1.6, IY0, IZ]), 3));
  group.add(new THREE.Line(insetBase, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));

  // —— 标签 ——
  function makeLabel(text: string, color: string, scale = 3.0): import('three').Sprite {
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
  const lbLens = makeLabel('镜头 50mm：光圈 A=f/(2N)', '#22d3ee', 3.4); lbLens.position.set(0, 0.62, 0);
  const lbSensor = makeLabel('像面（对焦在 s′）', '#0ea5e9', 2.6);
  const lbShell = makeLabel('清晰区间 D_near … D_far', '#22c55e', 3.4);
  const lbInset = makeLabel('弥散圆柱高 = log₁₀[ρ/(c/2)]，青线=容许界', '#fbbf24', 3.6);
  lbInset.position.set(IX, IY0 + BAR_H + 0.2, IZ);
  const lbObj = makeLabel('物点列（沿轴向）', '#94a3b8', 3.0); lbObj.position.set(-2.6, 0.5, 0);
  group.add(lbLens, lbSensor, lbShell, lbInset, lbObj);

  // —— 信息面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 800; infoCv.height = 252;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(8.8, 2.77)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 2.35, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  const rd = { N: 1.4, s: 0.3, dn: 0, df: 0, dof: 0, hf: 0, vp: 0, worst: 0, sharpCnt: 0 };
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 800, 252);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 792, 244);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3;
    infoCtx.strokeRect(4, 4, 792, 244);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 27px "PingFang SC", sans-serif';
    infoCtx.fillText('景深：弥散圆 c 决定清晰界限', 22, 36);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '24px "PingFang SC", sans-serif';
    infoCtx.fillText('1/s + 1/s′ = 1/f，  c_geom = A·|s′_i − s′|/s′_i，A = f/(2N)', 22, 68);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('D_n = f²s/(f²+N·c·(s−f))，D_f = f²s/(f²−N·c·(s−f))', 22, 98);
    infoCtx.fillStyle = '#34d399';
    infoCtx.fillText(`光圈缩到 f/${rd.N.toFixed(1)}：A=${(F / (2 * rd.N) * 1000).toFixed(2)}mm → 锥顶角变小 → 壳体加厚`, 22, 128);
    infoCtx.fillStyle = '#f472b6';
    infoCtx.fillText(`距离越远景深越大：ΔD ≈ 2 s²·N·c/f²（随 s² 增长，随 f² 衰减）`, 22, 158);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 23px "PingFang SC", sans-serif';
    const dfTxt = rd.df > 30 ? '→∞（全景深）' : (rd.df * 100).toFixed(1) + 'cm';
    infoCtx.fillText(
      `读数：对焦 s=${(rd.s * 1000).toFixed(0)}mm s′=${(rd.vp * 1000).toFixed(2)}mm  清晰 ${(rd.dn * 100).toFixed(1)}cm–${dfTxt}（厚 ${(rd.dof < 30 ? (rd.dof * 100).toFixed(1) + 'cm' : '∞')}）`, 22, 190,
    );
    infoCtx.fillText(
      `超焦距 H=${rd.hf < 50 ? (rd.hf * 100).toFixed(0) + 'cm' : (rd.hf / 1000).toFixed(2) + 'km'}  最大弥散圆=${(rd.worst * 1000).toFixed(3)}mm（容许 ${(C_ACC * 1000).toFixed(3)}mm）  合焦物点 ${rd.sharpCnt}/${NO}`, 22, 222,
    );
    infoTex.needsUpdate = true;
  }
  drawInfo();

  let nSmooth = 1.4;
  let sSmooth = 0.3;

  // 轴向用 SC，径向（高度）另用较大的 RH 放大 —— 共轭关系只依赖轴向，
  // 径向放大不改变任何公式结论（真实镜头 36mm 光圈 vs 20mm 物点距，同一尺度画不出光锥）。
  const RH = SC * 9;

  return {
    update(t, dt) {
      const ph = (t % CYCLE) / CYCLE;
      // 自变量①：光圈数 N 在 1.4→16 之间往复（对数）
      const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
      const nTarget = 1.4 * Math.pow(16 / 1.4, tri);
      nSmooth += (nTarget - nSmooth) * Math.min(1, dt * 3);
      // 自变量②：对焦距离 s 在 0.15→0.6 m 往复
      const sTarget = 0.15 + 0.45 * (0.5 - 0.5 * Math.cos(TWO_PI * ph));
      sSmooth += (sTarget - sSmooth) * Math.min(1, dt * 3);
      const N = nSmooth, s = sSmooth;
      const A = F / (2 * N);
      const vp = (F * s) / (s - F);                 // 对焦像距

      // 光圈环（真实半径 A）+ 叶片
      for (let i = 0; i <= AP_SEG; i++) {
        const a = TWO_PI * (i / AP_SEG);
        apPos[i * 3] = 0.02; apPos[i * 3 + 1] = A * RH * Math.cos(a); apPos[i * 3 + 2] = A * RH * Math.sin(a);
      }
      apGeo.attributes['position'].needsUpdate = true;
      {
        const b = bladeGeo.attributes['position'].array as Float32Array;
        const rr = A * RH;
        for (let i = 0; i < NBLADE; i++) {
          const a0 = TWO_PI * (i / NBLADE), a1 = TWO_PI * ((i + 0.42) / NBLADE);
          b[i * 6] = 0.02; b[i * 6 + 1] = Math.cos(a0) * rr * 1.45; b[i * 6 + 2] = Math.sin(a0) * rr * 1.45;
          b[i * 6 + 3] = 0.02; b[i * 6 + 4] = Math.cos(a1) * rr; b[i * 6 + 5] = Math.sin(a1) * rr;
        }
        bladeGeo.attributes['position'].needsUpdate = true;
      }

      // 景深壳（解析式）
      const dn = (F * F * s) / (F * F + N * C_ACC * (s - F));
      const dfDen = F * F - N * C_ACC * (s - F);
      const df = dfDen > 0 ? (F * F * s) / dfDen : Infinity;
      const hf = (F * F) / (N * C_ACC) + F;
      rd.N = N; rd.s = s; rd.dn = dn; rd.df = df; rd.dof = df - dn; rd.hf = hf; rd.vp = vp;
      const xNear = -dn * SC, xFar = -Math.min(df, 4.0 / SC) * SC;
      const SH = 0.42;
      {
        const p = shellGeo.attributes['position'].array as Float32Array;
        p[0] = xNear; p[1] = -SH; p[2] = 0;
        p[3] = xNear; p[4] = SH; p[5] = 0;
        p[6] = xFar; p[7] = -SH; p[8] = 0;
        p[9] = xFar; p[10] = SH; p[11] = 0;
        shellGeo.attributes['position'].needsUpdate = true;
        shellMat.opacity = 0.12 + 0.3 * Math.min(1, (df - dn) * 3);
        const w = wallGeo.attributes['position'].array as Float32Array;
        for (let k = 0; k < 2; k++) {
          const xx = k === 0 ? xNear : xFar;
          const o = k * 12;
          w[o] = xx; w[o + 1] = -SH; w[o + 2] = -0.3;
          w[o + 3] = xx; w[o + 4] = SH; w[o + 5] = -0.3;
          w[o + 6] = xx; w[o + 7] = -SH; w[o + 8] = 0.3;
          w[o + 9] = xx; w[o + 10] = SH; w[o + 11] = 0.3;
        }
        wallGeo.attributes['position'].needsUpdate = true;
      }
      lbShell.position.set((xNear + xFar) / 2, SH + 0.2, 0);
      lbShell.visible = df < 40;

      // 对焦面与像面
      focusBand.position.set(-s * SC, 0, 0);
      sensor.position.set(vp * SC, 0, 0);
      lbSensor.position.set(vp * SC + 0.1, -0.5, 0);

      // 物点 + 光锥 + 像面弥散圆 + 对比图
      let worst = 0, sharp = 0;
      const cp = coneGeo.attributes['position'].array as Float32Array;
      const dp = diskGeo.attributes['position'].array as Float32Array;
      for (let i = 0; i < NO; i++) {
        const si = DIST[i], yi = HOBJ[i];
        const v_i = (F * si) / (si - F);
        const hi = -(v_i * yi) / si;                        // 倒像高度
        const rho = A * Math.abs(vp - v_i) / v_i;           // 真实弥散圆半径
        const ox = -si * SC, oy = yi * RH;
        objMesh[i].position.set(ox, oy, 0);
        const inFocus = rho <= C_ACC / 2;                   // 判据：半径 ≤ c/2（c 为容许直径）
        if (inFocus) sharp++;
        worst = Math.max(worst, rho);
        const bad = Math.min(1, rho / (4 * C_ACC));
        objMat[i].color.setHex(inFocus ? 0x22c55e : (bad > 0.55 ? 0xef4444 : 0xfbbf24));
        objMat[i].emissive.copy(objMat[i].color);
        objMesh[i].scale.setScalar(inFocus ? 1.2 : 0.8 + 0.3 * bad);
        objMat[i].emissiveIntensity = inFocus ? 0.6 : 0.25;

        // 像面上两条边缘光线的交点高度（真实几何，径向放大 RH）
        const yTop = (A + (hi - A) * (vp / v_i)) * RH;
        const yBot = (-A + (hi + A) * (vp / v_i)) * RH;
        const base = i * SEG_PER * 6;
        const put = (seg: number, ax: number, ay: number, bx: number, by: number): void => {
          const o = base + seg * 6;
          cp[o] = ax; cp[o + 1] = ay; cp[o + 2] = 0;
          cp[o + 3] = bx; cp[o + 4] = by; cp[o + 5] = 0;
        };
        const imx = v_i * SC, sx = vp * SC, ih = hi * RH;
        put(0, ox, oy, 0, A * RH);
        put(1, 0, A * RH, imx, ih);
        put(2, imx, ih, sx, yTop);
        put(3, ox, oy, 0, -A * RH);
        put(4, 0, -A * RH, imx, ih);
        put(5, imx, ih, sx, yBot);
        put(6, ox, oy, sx, -(vp / si) * yi * RH);           // 主光线（过光心不折）

        // 像面弥散圆：就画在两条边缘光线与像面的交点之间（同一几何，无需另标放大）
        const rr = Math.max(0.006, Math.abs(yTop - yBot) / 2);
        const cy = (yTop + yBot) / 2;
        for (let k = 0; k < DISK_SEG; k++) {
          const a0 = TWO_PI * (k / DISK_SEG), a1 = TWO_PI * ((k + 1) / DISK_SEG);
          const o = i * DISK_SEG * 6 + k * 6;
          dp[o] = sx; dp[o + 1] = cy + rr * Math.cos(a0); dp[o + 2] = rr * Math.sin(a0);
          dp[o + 3] = sx; dp[o + 4] = cy + rr * Math.cos(a1); dp[o + 5] = rr * Math.sin(a1);
        }

        // 对比图：柱高 = log₁₀(ρ/(c/2))，容许界在 CRIT_H 处（同一 rho 变量）
        const cx = IX - 1.4 + (2.8 * i) / (NO - 1);
        const lvl = Math.log10(Math.max(1e-3, rho / (C_ACC / 2)));   // −3 … +4
        const bh = Math.max(0.004, Math.min(BAR_H, ((lvl + 2) / 5) * BAR_H));
        const cR = inFocus ? 0.13 : 0.98, cG = inFocus ? 0.77 : (bad > 0.55 ? 0.27 : 0.75), cB = inFocus ? 0.37 : (bad > 0.55 ? 0.27 : 0.14);
        const io = i * 12;
        insetPos[io] = cx; insetPos[io + 1] = IY0; insetPos[io + 2] = IZ;
        insetPos[io + 3] = cx; insetPos[io + 4] = IY0 + bh; insetPos[io + 5] = IZ;
        insetPos[io + 6] = cx - BAR_W; insetPos[io + 7] = IY0 + bh; insetPos[io + 8] = IZ;
        insetPos[io + 9] = cx + BAR_W; insetPos[io + 10] = IY0 + bh; insetPos[io + 11] = IZ;
        for (let k = 0; k < 4; k++) {
          insetCol[io + k * 3] = cR; insetCol[io + k * 3 + 1] = cG; insetCol[io + k * 3 + 2] = cB;
        }
      }
      coneGeo.attributes['position'].needsUpdate = true;
      diskGeo.attributes['position'].needsUpdate = true;
      insetGeo.attributes['position'].needsUpdate = true;
      insetGeo.attributes['color'].needsUpdate = true;
      rd.worst = worst; rd.sharpCnt = sharp;

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
