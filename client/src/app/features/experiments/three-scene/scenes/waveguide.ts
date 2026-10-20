import type { SceneContext, SceneInstance } from '../types';
/**
 * 波导（P123）：矩形波导 TE₁₀ 主模的传播与截止。空间标度真实（1 单位 = 1 m）：a = 2 m、b = 1 m、长 L = 8 m。
 *   截止频率  f_c = c/(2a) = 75 MHz（空气填充 ε_r=μ_r=1）；k_c = 2πf_c/c = π/a = 1.5708 rad/m
 *   色散关系  k = √(ω²/c² − k_c²) = k_c·√(r²−1)，r = f/f_c（r>1 传播）；导波波长 λ_g = 2π/k
 *   截止以下  α = √(k_c² − ω²/c²) = k_c·√(1−r²)，场按 e^{−α(z−z_in)} 衰减 ⇒ 穿透深度 δ = 1/α
 *             （r=0.5 ⇒ δ=0.74m；r→1⁻ ⇒ δ→∞；r>1 ⇒ 无衰减、能量沿 +z 输运）
 *   群速/相速 v_g = c·√(1−(f_c/f)²)（携能速度，<c）、v_ph = ω/k = c²/v_g（>c，不携信息）
 *   模式场    E_y ∝ sin(πx/a)（E 面半正弦，宽壁中央最大、两侧壁为零）；
 *             由 ∇×E = −∂B/∂t 实得 B_x ∝ sin(πx/a)·cos(kz−ωt)、B_z ∝ cos(πx/a)·sin(kz−ωt)
 *             ⇒ H 只有 x、z 分量，回线闭合于纵面 x–z（横截面 x–y 内没有 H 线），
 *             其等值线是 stream function ψ = sin u·sin w = C（u=πx/a, w=kz−ωt）的眼形环，
 *             随相位以 Ω_d/k 沿 +z 平移，间距 = λ_g/2（本场景据此逐点生成，见 pushHLoop）。
 *   扫描自变量：r 以 16s 在 0.5 → 2.0 之间往返 —— 跨过 f_c：E 面波长、H 环出现/消失、
 *   穿透深度包络、输运箭头长度全部由实算 k、α 驱动；面板 5Hz 同源刷新。
 *   时间轴说明：真实 ω≈10⁸ rad/s 无法逐帧显示，故相位里的时间项统一慢放为显示角频率
 *   Ω_d = 2.6 rad/s（空间标度保持真实，故 λ_g、δ 的标注即真实米数）。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  // —— 星野 + 网格 ——
  {
    const g = geo(new THREE.BufferGeometry());
    const p = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) { p[i * 3] = (Math.random() - 0.5) * 200; p[i * 3 + 1] = (Math.random() - 0.5) * 200; p[i * 3 + 2] = (Math.random() - 0.5) * 200; }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    group.add(new THREE.Points(g, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  }
  const grid = new THREE.GridHelper(20, 20, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // —— 物理常数（SI）与真实空间标度 ——
  const A_W = 2.0, B_W = 1.0, L = 8.0;              // 宽 a、高 b、长 L（m）= 画面单位
  const Z0 = -L / 2;
  const C0 = 3e8;
  const FC = C0 / (2 * A_W);                        // 75 MHz
  const KC = (2 * Math.PI * FC) / C0;               // = π/a = 1.5708 rad/m
  const TWO_PI = Math.PI * 2;
  const OM_D = 2.6;                                 // 显示角频率 rad/s（时间慢放）

  // —— 管壁 ——
  const wallMat = mat(new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.4, roughness: 0.6, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
  const wideGeo = geo(new THREE.BoxGeometry(A_W, 0.05, L));
  const sideGeo = geo(new THREE.BoxGeometry(0.05, B_W, L));
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(wideGeo, wallMat); w.position.set(0, s * B_W / 2, 0); group.add(w);
    const e = new THREE.Mesh(sideGeo, wallMat); e.position.set(s * A_W / 2, 0, 0); group.add(e);
  }
  const boxTmp = new THREE.BoxGeometry(A_W, B_W, L);
  const wireGeo = geo(new THREE.EdgesGeometry(boxTmp));
  boxTmp.dispose();
  group.add(new THREE.LineSegments(wireGeo, mat(new THREE.LineBasicMaterial({ color: 0x64748b }))));

  // —— 输入激励端面 ——
  {
    const gp = geo(new THREE.PlaneGeometry(A_W, B_W));
    const mIn = mat(new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    const pl = new THREE.Mesh(gp, mIn);
    pl.position.set(0, 0, Z0); pl.rotation.y = Math.PI / 2;
    group.add(pl);
  }

  // —— E 面：E_y ∝ sin(πx/a) 的半正弦脊面（沿 z 按 cos(kz−Ω_d t) / e^{−αz} 调制）——
  const SEGZ = 72, SEGX = 18;
  const eGeo = geo(new THREE.BufferGeometry());
  const ePos = new Float32Array((SEGZ + 1) * (SEGX + 1) * 3);
  const eCol = new Float32Array((SEGZ + 1) * (SEGX + 1) * 3);
  eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
  eGeo.setAttribute('color', new THREE.BufferAttribute(eCol, 3));
  {
    const idx: number[] = [];
    for (let iz = 0; iz < SEGZ; iz++) {
      for (let ix = 0; ix < SEGX; ix++) {
        const a0 = iz * (SEGX + 1) + ix, b0 = a0 + 1, c0 = a0 + SEGX + 1, d0 = c0 + 1;
        idx.push(a0, b0, c0, b0, d0, c0);
      }
    }
    eGeo.setIndex(idx);
  }
  const eMesh = new THREE.Mesh(eGeo, mat(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.72, side: THREE.DoubleSide })));
  group.add(eMesh);

  // —— H 环（纵面 x–z 内的 ψ=sin u·sin w=C 眼形闭合回线）——
  const HC = [0.15, 0.6];             // 两条嵌套等值线常数
  const HLY = [-0.36, 0, 0.36];       // 三层（TE₁₀ 的 H 与 y 无关 ⇒ 沿高方向平移同形）
  const HPT = 16;                     // 每支采样点数
  const hGeo = geo(new THREE.BufferGeometry());
  const hPos = new Float32Array(5200 * 3);
  hGeo.setAttribute('position', new THREE.BufferAttribute(hPos, 3));
  const hMat = mat(new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.85 }));
  group.add(new THREE.LineSegments(hGeo, hMat));
  let hv = 0;                                        // 当前写入顶点数
  const ZIN0 = Z0 + 0.03, ZIN1 = Z0 + L - 0.03;      // 回线只画在管腔内
  function hLoop(yc: number, cs: number, zBase: number, kk: number): void {
    // 一个半周期内的闭合眼形环：w'∈[w1, π−w1]，支 A 取 u=asin(cs/sin w')，支 B 取镜像 u=π−u、w=π−w'
    if (cs > 0.985) return;
    const w1 = Math.asin(cs);
    const span = Math.PI - 2 * w1;
    if (hv + HPT * 4 * 3 > hPos.length) return;
    const uA: number[] = [], wA: number[] = [];
    for (let j = 0; j <= HPT; j++) {
      const w = w1 + (j / HPT) * span;
      wA.push(w);
      uA.push(Math.asin(Math.min(1, cs / Math.sin(w))));
    }
    const pt = (mirror: boolean, j: number): number[] => {
      const u = mirror ? Math.PI - uA[j] : uA[j];
      const w = mirror ? Math.PI - wA[j] : wA[j];
      return [(u / Math.PI - 0.5) * A_W, zBase + w / kk];
    };
    const chain = (mirror: boolean): void => {
      for (let j = 0; j < HPT; j++) {
        const i0 = mirror ? HPT - j : j, i1 = mirror ? HPT - j - 1 : j + 1;
        const p0 = pt(mirror, i0), p1 = pt(mirror, i1);
        if (p0[1] < ZIN0 || p0[1] > ZIN1 || p1[1] < ZIN0 || p1[1] > ZIN1) continue;   // 近截止 λ_g 大于管长 ⇒ 出界段舍去
        hPos[hv++] = p0[0]; hPos[hv++] = yc; hPos[hv++] = p0[1];
        hPos[hv++] = p1[0]; hPos[hv++] = yc; hPos[hv++] = p1[1];
      }
    };
    chain(false);
    chain(true);
  }

  // —— 截止衰减包络 ±e^{−α(z−z_in)}（实算 α 驱动，非装饰尾段）——
  const DEN = 64;
  const dGeo = geo(new THREE.BufferGeometry());
  const dPos = new Float32Array(DEN * 4 * 3);
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  group.add(new THREE.LineSegments(dGeo, mat(new THREE.LineBasicMaterial({ color: 0x8b5cf6 }))));
  const dMark = new THREE.Mesh(geo(new THREE.SphereGeometry(0.11, 12, 12)), mat(new THREE.MeshBasicMaterial({ color: 0x8b5cf6 })));
  group.add(dMark);

  // —— λ_g 标尺（管顶一条真实米数的跨距）——
  const rGeo = geo(new THREE.BufferGeometry());
  const rPos = new Float32Array(12 * 3);
  rGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
  group.add(new THREE.LineSegments(rGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 }))));

  // —— 输运箭头（长度 = v_g/c，截止时为 0）与全反射箭头 ——
  const shaftGeo = geo(new THREE.CylinderGeometry(0.05, 0.05, 1, 8));
  const headGeo = geo(new THREE.ConeGeometry(0.13, 0.3, 10));
  const fwdMat = mat(new THREE.MeshBasicMaterial({ color: 0x22c55e }));
  const fwd = new THREE.Group();
  {
    const s = new THREE.Mesh(shaftGeo, fwdMat); s.rotation.x = Math.PI / 2; s.scale.y = 0.001; fwd.add(s);
    const h = new THREE.Mesh(headGeo, fwdMat); h.rotation.x = Math.PI / 2; fwd.add(h);
    fwd.userData = { s, h };
  }
  fwd.position.set(0, -0.78, -2.2);
  group.add(fwd);
  const refMat = mat(new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.9 }));
  const ref = new THREE.Group();
  {
    const s = new THREE.Mesh(shaftGeo, refMat); s.rotation.x = -Math.PI / 2; s.scale.y = 0.001; ref.add(s);
    const h = new THREE.Mesh(headGeo, refMat); h.rotation.x = -Math.PI / 2; ref.add(h);
    ref.userData = { s, h };
  }
  ref.position.set(0, -1.3, 0.6);
  group.add(ref);

  // —— 静态标签 ——
  function makeLabel(text: string, color: string, x: number, y: number, z: number, wu = 3.4): void {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const sp = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    sp.scale.set(wu, wu / 8, 1); sp.position.set(x, y, z); sp.renderOrder = 997;
    group.add(sp);
  }
  makeLabel('TE₁₀：E_y∝sin(πx/a)（E 面半正弦）', '#fca5a5', 0, 1.15, 0, 4.0);
  makeLabel('a = 2.0 m ⇒ f_c = c/(2a) = 75 MHz', '#94a3b8', 0, -1.05, 0, 3.8);
  makeLabel('输入激励（幅值固定）', '#86efac', 0, 0.05, Z0 - 0.75, 2.6);
  makeLabel('绿箭头长 = v_g/c（输运功率）', '#86efac', 0, -1.15, -0.5, 3.2);
  makeLabel('红箭头 = 截止时能量全反射回来', '#fca5a5', 0, -1.68, -1.6, 3.4);

  // —— 动态标签（5Hz 与面板同源重绘）——
  const liveCv = document.createElement('canvas'); liveCv.width = 512; liveCv.height = 64;
  const liveCtx = liveCv.getContext('2d')!;
  const liveTex = tex(new THREE.CanvasTexture(liveCv));
  const liveSp = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: liveTex, transparent: true, depthTest: false })));
  liveSp.scale.set(4.2, 4.2 / 8, 1); liveSp.position.set(0, 1.62, 0); liveSp.renderOrder = 998;
  group.add(liveSp);
  function drawLive(txt: string, color: string): void {
    liveCtx.clearRect(0, 0, 512, 64);
    liveCtx.fillStyle = color; liveCtx.font = 'bold 27px "PingFang SC", sans-serif';
    liveCtx.textAlign = 'center'; liveCtx.textBaseline = 'middle'; liveCtx.fillText(txt, 256, 32);
    liveTex.needsUpdate = true;
  }

  // —— 面板 ——
  const cv = document.createElement('canvas'); cv.width = 820; cv.height = 300;
  const cc = cv.getContext('2d')!;
  const ct = tex(new THREE.CanvasTexture(cv));
  const panel = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: ct, transparent: true, depthTest: false })));
  panel.scale.set(8.6, 8.6 * 300 / 820, 1); panel.position.set(0, 4.3, 0); panel.renderOrder = 999;
  group.add(panel);

  const S = { r: 1.5, fMHz: 112.5, k: 1.756, lamG: 3.58, al: 0, dlt: 0, vg: 0.745, prop: true };
  const CAP = 40;                                          // 贴近截止时 λ_g、δ 发散：如实标注为 →∞
  const lamTxt = (): string => (!S.prop ? '—（无行波）' : S.lamG > CAP ? '→∞（贴近截止）' : `${S.lamG.toFixed(2)} m`);
  const dltTxt = (): string => (S.prop ? '—（不衰减）' : S.dlt > CAP ? '→∞（贴近截止）' : `${S.dlt.toFixed(2)} m`);
  function drawPanel(): void {
    cc.clearRect(0, 0, 820, 300);
    cc.fillStyle = 'rgba(7,11,20,0.85)'; cc.fillRect(3, 3, 814, 294);
    cc.strokeStyle = '#334155'; cc.lineWidth = 3; cc.strokeRect(3, 3, 814, 294);
    cc.textAlign = 'left';
    cc.fillStyle = '#f8fafc'; cc.font = 'bold 25px "PingFang SC", sans-serif';
    cc.fillText('矩形波导 TE₁₀：能不能传，只看色散关系 k=√(ω²/c²−k_c²)', 16, 34);
    cc.fillStyle = '#22d3ee'; cc.font = '22px "PingFang SC", sans-serif';
    cc.fillText('f_c=c/(2a)=75MHz（a=2m）；k_c=π/a=1.571rad/m；r=f/f_c', 16, 64);
    cc.fillText('r>1：k=k_c√(r²−1)，λ_g=2π/k，v_g=c√(1−1/r²)<c', 16, 90);
    cc.fillStyle = '#a855f7';
    cc.fillText('r<1：α=k_c√(1−r²)，场按 e^{−αz} 衰减 ⇒ δ=1/α，无行波、全反射', 16, 116);
    cc.fillStyle = '#fbbf24'; cc.font = 'bold 21px "PingFang SC", sans-serif';
    cc.fillText(`读数：r=${S.r.toFixed(2)}  f=${S.fMHz.toFixed(1)}MHz  k=${S.k.toFixed(3)}rad/m  λ_g=${lamTxt()}`, 16, 150);
    cc.fillText(`α=${S.al.toFixed(3)}rad/m  δ=${dltTxt()}  v_g/c=${S.vg.toFixed(3)}  输运功率∝v_g/c`, 16, 178);
    cc.fillStyle = S.prop ? '#22c55e' : '#ef4444'; cc.font = 'bold 22px "PingFang SC", sans-serif';
    cc.fillText(S.prop ? '状态：传播（H 环沿 +z 平移，间距 λ_g/2；管顶金尺=一个 λ_g）' : '状态：截止（场只在入口穿透 δ 后归零 ⇒ 低于 f_c 一律被拒）', 16, 208);
    cc.fillStyle = '#94a3b8'; cc.font = '20px "PingFang SC", sans-serif';
    cc.fillText('H 线：ψ=sin u·sin w=C 的眼形闭合回线，位于纵面 x–z（横截面无 H 线）；u=πx/a, w=kz−ωt', 16, 238);
    cc.fillText('时间慢放为 Ω_d=2.6rad/s；空间 1 单位=1m，故 λ_g、δ 标注即真实米数。v_ph=ω/k>c 不携信息', 16, 268);
    ct.needsUpdate = true;
  }

  let tau = 0;
  return {
    update(t, dt) {
      // 扫描 r = f/f_c：0.5 → 2.0 → 0.5（16s 往返），跨过截止
      const ph = (t % 16) / 16;
      const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
      const r = 0.5 + 1.5 * tri;
      tau = t;

      const om = (TWO_PI * r * FC) / C0;                    // rad/m（真实 ω/c）
      const dsc = om * om - KC * KC;                        // k²（可为负 = 截止）
      const k = dsc > 0 ? Math.sqrt(dsc) : 0;
      const al = dsc < 0 ? Math.sqrt(-dsc) : 0;
      const prop = r >= 1;
      const lamG = k > 1e-6 ? TWO_PI / k : 999;
      const dlt = al > 1e-6 ? 1 / al : 999;
      const vg = prop ? Math.sqrt(Math.max(0, 1 - 1 / (r * r))) : 0;
      S.r = r; S.fMHz = (r * FC) / 1e6; S.k = k; S.lamG = lamG; S.al = al; S.dlt = dlt; S.vg = vg; S.prop = prop;

      // —— E 面：sin(πx/a) × 传播/衰减包络 ——
      let vi = 0;
      for (let iz = 0; iz <= SEGZ; iz++) {
        const z = Z0 + (iz / SEGZ) * L;
        const env = prop ? 1 : Math.exp(-al * (z - Z0));
        const osc = prop ? Math.cos(k * z - OM_D * tau) : Math.cos(OM_D * tau);
        const amp = env * osc;
        for (let ix = 0; ix <= SEGX; ix++) {
          const x = -A_W / 2 + (ix / SEGX) * A_W;
          const shp = Math.sin((Math.PI * (x + A_W / 2)) / A_W);
          const y = shp * (B_W / 2) * 0.92 * amp;
          ePos[vi * 3] = x; ePos[vi * 3 + 1] = y; ePos[vi * 3 + 2] = z;
          const a = Math.abs(y) / ((B_W / 2) * 0.92);
          eCol[vi * 3] = 0.25 + 0.75 * a; eCol[vi * 3 + 1] = 0.18 * (1 - a) + 0.12; eCol[vi * 3 + 2] = 0.3 * (1 - a);
          vi++;
        }
      }
      eGeo.attributes['position'].needsUpdate = true;
      eGeo.attributes['color'].needsUpdate = true;

      // —— H 环：仅在传播区存在，间距 λ_g/2、随相位沿 +z 平移 ——
      hv = 0;
      if (prop && k > 1e-4) {
        const phase = OM_D * tau;
        let mLo = Math.floor((k * Z0 - phase) / Math.PI) - 1;
        const mHi = Math.ceil((k * (Z0 + L) - phase) / Math.PI) + 1;
        if (mHi - mLo > 13) mLo = mHi - 13;                   // 高频时限制回线数量
        for (const yc of HLY) {
          for (const cs of HC) {
            for (let m = mLo; m <= mHi; m++) hLoop(yc, cs, (m * Math.PI + phase) / k, k);
          }
        }
      }
      hGeo.attributes['position'].needsUpdate = true;
      hGeo.setDrawRange(0, hv / 3);
      hMat.opacity = prop ? 0.35 + 0.55 * Math.min(1, vg) : 0;

      // —— 截止衰减包络 ±e^{−α(z−z_in)}（实算 α 驱动）+ δ 穿透深度标记 ——
      {
        let q = 0;
        if (!prop) {
          let zp = Z0, up = 0, dn = 0;
          for (let i = 0; i < DEN; i++) {
            const z = Z0 + (i / (DEN - 1)) * L;
            const e = Math.exp(-al * (z - Z0)) * (B_W / 2) * 0.92 * Math.abs(Math.cos(OM_D * tau));
            if (i > 0) {
              dPos[q * 3] = 0; dPos[q * 3 + 1] = up; dPos[q * 3 + 2] = zp; q++;
              dPos[q * 3] = 0; dPos[q * 3 + 1] = e; dPos[q * 3 + 2] = z; q++;
              dPos[q * 3] = 0; dPos[q * 3 + 1] = dn; dPos[q * 3 + 2] = zp; q++;
              dPos[q * 3] = 0; dPos[q * 3 + 1] = -e; dPos[q * 3 + 2] = z; q++;
            }
            zp = z; up = e; dn = -e;
          }
        }
        dGeo.attributes['position'].needsUpdate = true;
        dGeo.setDrawRange(0, prop ? 0 : q);
        dMark.visible = !prop;
        if (!prop) dMark.position.set(0, 0, Math.min(Z0 + L - 0.05, Z0 + dlt));
      }

      // —— λ_g 标尺（管顶，真实米数跨距）——
      {
        let q = 0;
        if (prop && lamG < L * 1.05) {
          const z1 = Z0 + 0.6, z2 = z1 + lamG;
          const yy = B_W / 2 + 0.28;
          const put = (x: number, y: number, z: number): void => { rPos[q * 3] = x; rPos[q * 3 + 1] = y; rPos[q * 3 + 2] = z; q++; };
          put(-0.15, yy, z1); put(0.15, yy, z1);
          put(-0.15, yy, z2); put(0.15, yy, z2);
          put(0, yy - 0.1, z1); put(0, yy + 0.1, z1);
          put(0, yy - 0.1, z2); put(0, yy + 0.1, z2);
          put(0, yy, z1); put(0, yy, z2);
        }
        rGeo.attributes['position'].needsUpdate = true;
        rGeo.setDrawRange(0, q);
      }

      // —— 输运/全反射箭头（长度 = v_g/c；截止时能量全反射回来）——
      {
        const fs = fwd.userData as { s: import('three').Mesh; h: import('three').Mesh };
        const len = 0.2 + 3.4 * vg;
        fs.s.scale.y = len; fs.s.position.z = len / 2;
        fs.h.position.z = len + 0.15;
        fwd.visible = prop;
        const rs = ref.userData as { s: import('three').Mesh; h: import('three').Mesh };
        const rl = prop ? 0.001 : 0.4 + 2.4 * (1 - Math.min(1, al / KC));   // 越近截止反射越深
        rs.s.scale.y = rl; rs.s.position.z = -rl / 2;
        rs.h.position.z = -rl - 0.15;
        ref.visible = !prop;
      }

      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) {
        drawPanel();
        drawLive(
          prop ? `传播：λ_g = ${lamTxt()}，v_g/c = ${vg.toFixed(2)}` : `截止：δ = 1/α = ${dltTxt()}（穿透后归零，无行波）`,
          prop ? '#fde68a' : '#fca5a5',
        );
      }
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
