import type { SceneContext, SceneInstance } from '../types';
/**
 * 高分子玻璃化转变（P382）—— 主控方程（自由体积理论，PS 锚点，SI 直算，node 已复核）：
 *   自由体积      f(T) = f_g + Δα·(T−Tg)  (T≥Tg)；f(T) = f_g + α_g(T−Tg)  (T<Tg，冻结不再膨胀)
 *                 f_g=0.025；总比膨胀 α_l=6.8×10⁻⁴、玻璃态 α_g=2.0×10⁻⁴ K⁻¹ ⇒ 自由体积膨胀 Δα=α_l−α_g=4.8×10⁻⁴
 *   Doolittle     η(T) = η_g·exp[B(1/f − 1/f_g)]，B=1
 *   ⇒ WLF 恒等    log₁₀a_T = −(B/2.303 f_g)(T−Tg)/(f_g/Δα + T−Tg) = −C₁(T−Tg)/(C₂+T−Tg)
 *                 代入数字：C₁=1/(2.303×0.025)=17.37，C₂=0.025/4.8×10⁻⁴=52.1 K —— 与"通用 WLF 常数"17.44/51.6 吻合
 *                 （Δα 一支与 Doolittle 逐点恒等，画面直接算 1/f 而非套用闭合式）
 *   比容          V(T)=V_g[1+α(T−Tg)] —— 斜率在 Tg 处突变 Δα（画面 V–T 折线显示该拐点）
 *   逐段冻结      Tg 是 τ=100 s 的定义点（η_g=10⁴·10⁹ Pa·s）；各 CRR 的 Tg 有 ΔT_g=6 K 分布
 *                 φ_frozen = Φ((Tg−T)/ΔT_g)（正态分布函数）⇒ 降温时链段"逐段"失去活动性
 * 复核（node）：T−Tg=+80K ⇒ log a_T=−10.52（η=3.0×10² Pa·s，黏流）；+50K ⇒ −8.51（η=3.1×10⁴）；
 *       0 ⇒ 0（η=10¹³ Pa·s＝Tg 定义点）；−20K ⇒ +3.31（η=2.0×10¹⁶，玻璃态支用 α_g ⇒ 比 WLF 闭合式发散更快）；
 *       −48.5K ⇒ +11（η=10²⁴，实验不可测）；φ_frozen(−20K)=99.1%。
 * 画面：10 条三维缠结链（顶点色随冻结逐段由青转灰，活动段按 1/a_T 摆幅蠕动＝reptation 抖动）
 * ＋自由体积空腔（数量∝f、半径∝f^⅓，穿 Tg 时同步塌缩）＋左侧 V–T 折线（Tg 拐点）与 log η 曲线。
 * 扫描自变量：温度 T 在 18 s 内 Tg+80 K ↔ Tg−70 K 往复（穿过 Tg 三次转折全可见）。
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

  // —— 物理常数 ——
  const TG = 373;                    // K（聚苯乙烯 Tg≈100 ℃）
  const FG = 0.025, ALF = 6.8e-4, ALG = 2.0e-4, BB = 1;
  const ALPHA_F = ALF - ALG;          // Δα = 4.8e-4
  const C1 = BB / (2.303 * FG);       // 17.44
  const C2 = FG / ALPHA_F;            // 52.1 K
  const ETA_G = 1e13;                 // Pa·s（Tg 定义点）
  const DTG = 6;                      // K CRR 的 Tg 分布宽度
  const fOf = (dT: number) => dT >= 0 ? FG + ALPHA_F * dT : Math.max(0.006, FG + ALG * dT);
  const logAT = (dT: number) => {
    const f = fOf(dT);
    return (BB / 2.303) * (1 / f - 1 / FG);      // >0 表示变慢（低温支用实际 f，故发散更快）
  };
  const vOf = (dT: number) => 1 + (dT >= 0 ? ALF * dT : ALG * dT);
  function erf(x: number): number {
    const s = x < 0 ? -1 : 1, z = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * z);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284497331) * t + 0.254829592) * t * Math.exp(-z * z);
    return s * y;
  }
  const phiFrozen = (dT: number) => 0.5 * (1 + erf(-dT / (DTG * Math.SQRT2)));   // Φ((Tg−T)/ΔT_g)

  const T_HI = TG + 80, T_LO = TG - 70, CY = 18;

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

  // —— 缠结链骨架 ——
  let seed = 20240917;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const NCH = 10, NSE = 26;
  const chainBase: Float32Array[] = [], chainPhase: Float32Array[] = [], chainFreeze: Float32Array[] = [];
  for (let c = 0; c < NCH; c++) {
    const b = new Float32Array((NSE + 1) * 3), ph = new Float32Array(NSE + 1), fz = new Float32Array(NSE + 1);
    let x = (rnd() - 0.5) * 3.6, y = 0.5 + rnd() * 2.1, z = (rnd() - 0.5) * 3.0;
    for (let s = 0; s <= NSE; s++) {
      b[s * 3] = x; b[s * 3 + 1] = y; b[s * 3 + 2] = z;
      ph[s] = rnd() * TWO_PI;
      fz[s] = (rnd() - 0.5) * 2;                     // 该链段的局部 Tg 偏移（∝ΔT_g）
      const a = rnd() * TWO_PI, e = (rnd() - 0.5) * 1.1;
      x += 0.2 * Math.cos(a) * Math.cos(e); y += 0.2 * Math.sin(e); z += 0.2 * Math.sin(a) * Math.cos(e);
    }
    chainBase.push(b); chainPhase.push(ph); chainFreeze.push(fz);
  }
  const chainGeo: import('three').BufferGeometry[] = [], chainMat: import('three').MeshBasicMaterial[] = [];
  const cPosA = new Float32Array((NSE + 1) * 3), cColA = new Float32Array((NSE + 1) * 3);
  for (let c = 0; c < NCH; c++) {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(cPosA.slice(0), 3));
    g.setAttribute('color', new THREE.BufferAttribute(cColA.slice(0), 3));
    const m = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, vertexColors: true, transparent: true, opacity: 0.95 }));
    chainGeo.push(g); chainMat.push(m);
    group.add(new THREE.Line(g, m));
  }
  // 链节球（主链原子）：合并为一次 InstancedMesh
  const beadGeo = geo(new THREE.SphereGeometry(0.052, 8, 6));
  const beadMat = mat(new THREE.MeshStandardMaterial({ color: 0x93c5fd, metalness: 0.3, roughness: 0.5 }));
  const beads = new THREE.InstancedMesh(beadGeo, beadMat, NCH * (NSE + 1));
  beads.frustumCulled = false;
  group.add(beads);

  // —— 自由体积空腔 ——
  const NCAV = 90;
  const cavGeo = geo(new THREE.SphereGeometry(1, 10, 8));
  const cavMat = mat(new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xdb2777, emissiveIntensity: 0.45, transparent: true, opacity: 0.34, depthWrite: false }));
  const cav = new THREE.InstancedMesh(cavGeo, cavMat, NCAV);
  cav.frustumCulled = false;
  const cavPos = new Float32Array(NCAV * 3);
  for (let i = 0; i < NCAV; i++) { cavPos[i * 3] = (rnd() - 0.5) * 4.2; cavPos[i * 3 + 1] = 0.4 + rnd() * 2.4; cavPos[i * 3 + 2] = (rnd() - 0.5) * 3.4; }
  group.add(cav);

  // —— 左侧 V–T 与 log η–T 双曲线（竖直面 z=PZ，x=T，y=值）——
  const PX0 = -3.1, PX1 = -0.3, PY0 = 0.3, PY1 = 2.6, PZ = -2.4;
  const NT = 160;
  const vGeo = geo(new THREE.BufferGeometry());
  vGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NT * 3), 3));
  group.add(new THREE.Line(vGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e }))));
  const eGeo = geo(new THREE.BufferGeometry());
  eGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NT * 3), 3));
  group.add(new THREE.Line(eGeo, mat(new THREE.LineBasicMaterial({ color: 0xa855f7 }))));
  const frGeo = geo(new THREE.BufferGeometry());
  frGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    PX0, PY0, PZ, PX1, PY0, PZ, PX0, PY0, PZ, PX0, PY1, PZ,
    // Tg 竖线
    PX0 + (PX1 - PX0) * (TG - T_LO) / (T_HI - T_LO), PY0, PZ,
    PX0 + (PX1 - PX0) * (TG - T_LO) / (T_HI - T_LO), PY1, PZ,
  ]), 3));
  group.add(new THREE.LineSegments(frGeo, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));
  const vMk = new THREE.Mesh(geo(new THREE.SphereGeometry(0.075, 12, 10)), mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })));
  group.add(vMk);

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
  const lb1 = makeLabel('缠结链：顶点色＝该链段的冻结状态（青＝活动，灰＝玻璃态）', '#67e8f9', 5.8); lb1.position.set(0.4, 3.02, 0.6);
  const lb2 = makeLabel('粉球＝自由体积空腔，数∝f、径∝f^⅓ ⇒ 穿 Tg 时塌缩', '#f9a8d4', 5.6); lb2.position.set(0.6, 0.42, 1.9);
  const lb3 = makeLabel('比容折线（绿）在 Tg 处斜率突变 Δα；η 曲线（紫）发散', '#86efac', 5.2); lb3.position.set((PX0 + PX1) / 2, PY1 + 0.4, PZ);
  group.add(lb1, lb2, lb3);

  // —— 面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 880; infoCv.height = 274;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.6, 2.99)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 4.62, 0); infoPlane.renderOrder = 999;
  group.add(infoPlane);

  const rd = { T: TG, dT: 80, f: 0, lat: 0, phi: 0, mob: 1, v: 1, cav: NCAV };
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 880, 274);
    infoCtx.fillStyle = 'rgba(7,11,20,0.84)'; infoCtx.fillRect(4, 4, 872, 266);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 872, 266);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 27px "PingFang SC", sans-serif';
    infoCtx.fillText('玻璃化转变：不是相变，是自由体积用完的时间竞赛', 22, 36);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '23px "PingFang SC", sans-serif';
    infoCtx.fillText('f=f_g+Δα(T−Tg)　Doolittle lnη∝B/f ⇒ log a_T=−C₁(T−Tg)/(C₂+T−Tg)（WLF）', 22, 68);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText(`同一代入给出通用常数：C₁=B/(2.303f_g)=${C1.toFixed(2)}，C₂=f_g/Δα=${C2.toFixed(1)} K（文献 17.44/51.6）`, 22, 96);
    infoCtx.fillStyle = '#22c55e';
    infoCtx.fillText(`逐段冻结：φ=Φ((Tg−T)/ΔT_g)，ΔT_g=${DTG}K（CRR 分布）；Tg≡τ=100 s 的定义点，η_g=10¹³ Pa·s`, 22, 124);
    infoCtx.fillStyle = rd.dT < 0 ? '#ef4444' : '#f472b6';
    infoCtx.fillText(rd.dT < -DTG
      ? `玻璃态：${(rd.phi * 100).toFixed(0)}% 链段已冻结，摆幅=0 —— 受冲即脆断（脆韧转变）`
      : rd.dT > DTG ? '高弹/黏流态：链段协同蠕动，reptation 主导，可大形变' : '过渡区：冻结前沿沿链推进，模量陡降三个量级', 22, 152);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 23px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：T=${rd.T.toFixed(1)} K（T−Tg=${rd.dT >= 0 ? '+' : ''}${rd.dT.toFixed(1)}K）  f=${rd.f.toFixed(4)}  V/V_g=${rd.v.toFixed(4)}`, 22, 184);
    infoCtx.fillText(`log₁₀a_T=${rd.lat >= 0 ? '+' : ''}${rd.lat.toFixed(2)} ⇒ η=${rd.lat > 11 ? '≥10²⁴ Pa·s（玻璃态·实验不可测）' : `${(ETA_G * Math.pow(10, rd.lat)).toExponential(1)} Pa·s`}`, 22, 212);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '21px "PingFang SC", sans-serif';
    infoCtx.fillText(`链段摆幅 A=A₀·min(1,1/a_T)=${(rd.mob * 100).toFixed(1)}%　φ_frozen=${(rd.phi * 100).toFixed(0)}%　空腔 ${(rd.cav ?? 0).toFixed(0)}/${NCAV} 个`, 22, 244);
    infoTex.needsUpdate = true;
  }
  rd.cav = NCAV;
  drawInfo();

  const mtx = new THREE.Matrix4(), vP = new THREE.Vector3(), vS = new THREE.Vector3(), q = new THREE.Quaternion(0, 0, 0, 1);
  const cAct = new THREE.Color(0x22d3ee), cFrz = new THREE.Color(0x64748b), cTmp = new THREE.Color();

  return {
    update(t, dt) {
      const ph = (t % CY) / CY;
      const T = (T_HI + T_LO) / 2 + ((T_HI - T_LO) / 2) * Math.cos(TWO_PI * ph);
      const dT = T - TG;
      const f = fOf(dT), lat = logAT(dT), at = Math.pow(10, lat);
      const mob = Math.min(1, 1 / Math.max(1, at));
      const phi = phiFrozen(dT);
      const vv = vOf(dT);
      const amp = 0.17 * mob;

      // 链：活动段按 1/a_T 摆幅蠕动（reptation 抖动 + 沿轮廓漂移），冻结段定格
      let nb = 0;
      for (let c = 0; c < NCH; c++) {
        const b = chainBase[c], pp = chainPhase[c], ff = chainFreeze[c];
        const pos = chainGeo[c].attributes['position'].array as Float32Array;
        const col = chainGeo[c].attributes['color'].array as Float32Array;
        const drift = 0.14 * mob * Math.sin(TWO_PI * (t / 9) + c);
        for (let s = 0; s <= NSE; s++) {
          const localPhi = Math.max(0, Math.min(1, 0.5 * (1 + erf((-dT - ff[s] * DTG) / (DTG * Math.SQRT2)))));
          const a = amp * (1 - localPhi);
          pos[s * 3] = b[s * 3] + a * Math.sin(t * 2.1 + pp[s]) + drift * (s / NSE - 0.5);
          pos[s * 3 + 1] = b[s * 3 + 1] + a * Math.cos(t * 1.7 + pp[s] * 1.3);
          pos[s * 3 + 2] = b[s * 3 + 2] + a * Math.sin(t * 2.6 + pp[s] * 0.7);
          const fv = Math.max(0, Math.min(1, localPhi * 0.35 + phi * 0.65));
          cTmp.copy(cAct).lerp(cFrz, fv);
          col[s * 3] = cTmp.r; col[s * 3 + 1] = cTmp.g; col[s * 3 + 2] = cTmp.b;
          vP.set(pos[s * 3], pos[s * 3 + 1], pos[s * 3 + 2]); vS.setScalar(0.9 + 0.5 * (1 - fv));
          mtx.compose(vP, q, vS); beads.setMatrixAt(nb++, mtx);
        }
        chainGeo[c].attributes['position'].needsUpdate = true;
        chainGeo[c].attributes['color'].needsUpdate = true;
      }
      beads.count = nb; beads.instanceMatrix.needsUpdate = true;
      beadMat.color.setHex(dT < 0 ? 0x94a3b8 : 0x93c5fd);

      // 自由体积空腔：数∝f/f_g，半径∝(f/f_g)^⅓；整体比容 ∝ V^⅓
      const fr = f / FG;
      const nCav = Math.max(3, Math.min(NCAV, Math.round(NCAV * Math.min(1.15, fr) * 0.72)));
      const rr = 0.055 * Math.pow(fr, 1 / 3);
      const pack = Math.pow(vv, 1 / 3);
      for (let i = 0; i < nCav; i++) {
        vP.set(cavPos[i * 3] * pack, (cavPos[i * 3 + 1] - 1.4) * pack + 1.4, cavPos[i * 3 + 2] * pack);
        vS.setScalar(rr); mtx.compose(vP, q, vS); cav.setMatrixAt(i, mtx);
      }
      cav.count = nCav; cav.instanceMatrix.needsUpdate = true;
      cavMat.opacity = 0.14 + 0.34 * Math.min(1, fr - 0.5);

      // 曲线 V(T) 与 log a_T(T)
      {
        const vp = vGeo.attributes['position'].array as Float32Array;
        const ep = eGeo.attributes['position'].array as Float32Array;
        const vspan = 6.5e-2, lo = -13, hi = 23;
        const yV = (vv: number) => PY0 + (PY1 - PY0) * (0.52 + 0.46 * (vv - 1) / vspan);
        for (let i = 0; i < NT; i++) {
          const Tv = T_LO + (T_HI - T_LO) * i / (NT - 1);
          const x = PX0 + (PX1 - PX0) * i / (NT - 1);
          vp[i * 3] = x; vp[i * 3 + 1] = yV(vOf(Tv - TG)); vp[i * 3 + 2] = PZ;
          ep[i * 3] = x; ep[i * 3 + 1] = PY0 + (PY1 - PY0) * 0.44 * (logAT(Tv - TG) - lo) / (hi - lo); ep[i * 3 + 2] = PZ;
        }
        vGeo.attributes['position'].needsUpdate = true; vGeo.setDrawRange(0, NT);
        eGeo.attributes['position'].needsUpdate = true; eGeo.setDrawRange(0, NT);
        vMk.position.set(PX0 + (PX1 - PX0) * (T - T_LO) / (T_HI - T_LO), yV(vv), PZ);
      }

      rd.T = T; rd.dT = dT; rd.f = f; rd.lat = lat; rd.phi = phi; rd.mob = mob; rd.v = vv; rd.cav = nCav;
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
