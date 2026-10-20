import type { SceneContext, SceneInstance } from '../types';
/**
 * 球坐标分离与角动量（P545）：主控方程 ∇²Φ=0 分离 ⇒ 角向本征值问题 ∇²_Ω Y = −l(l+1)Y，
 *   Y_l^m(θ,φ) = N_lm·P_l^m(cosθ)·e^{imφ}，l=0,1,2…，m=−l…+l。
 *   P_l^m 由三项递推解析算出：(l−m)P_l^m = (2l−1)cosθ·P_{l−1}^m − (l+m−1)P_{l−2}^m，
 *   种子 P_0^0=1、P_m^m = −(2m−1)√(1−x²)·P_{m−1}^{m−1}（Condon–Shortley 相位）。
 *   画面画实 tesseral 组合 S_lm ∝ P_l^m(cosθ)·cos(mφ) 的隆起面 r = R₀ + A·Ŝ_lm：
 *   波瓣归一化到 |Ŝ|≤1 后着色与位移，故节线（S=0，白线）恰为锥面 l−m 个 + 过极经线 m 个，总数 = l。
 *   单值性(φ 周期 2π)与有界性(θ=0,π)迫使 l、m 取整数 ⇒ |L|=√(l(l+1))ħ、L_z=mħ 是边界条件的后果。
 */
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

  const NP = 128, NT = 65;                 // φ 段 × θ 环
  const NVX = (NP + 1) * NT;
  const sGeo = geo(new THREE.BufferGeometry());
  const pos = new Float32Array(NVX * 3);
  const col = new Float32Array(NVX * 3);
  const sph = new Float32Array(NVX * 2);   // 缓存 (cosθ, φ) 避免两次全表重算
  sGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  {
    const idx: number[] = [];
    for (let j = 0; j < NT - 1; j++) {
      for (let i = 0; i < NP; i++) {
        const a = j * (NP + 1) + i, b = a + 1, c = a + (NP + 1), d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    sGeo.setIndex(idx);
  }
  const surf = new THREE.Mesh(sGeo, mat(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, metalness: 0.25, roughness: 0.45 })));
  surf.position.y = 2.15;
  group.add(surf);

  const R0 = 0.55, AMP = 0.5;              // 骨架球半径 / 最大隆起（世界单位）；R₀>AMP ⇒ r 恒正，负瓣向内压而非翻过原点

  // —— 缔合勒让德 P_l^m(x)，纯递推、无查表 ——
  function plm(l: number, m: number, x: number): number {
    if (m > l) return 0;
    const s = Math.sqrt(Math.max(0, 1 - x * x));
    let pmm = 1;
    for (let i = 1; i <= m; i++) pmm *= -(2 * i - 1) * s;
    if (l === m) return pmm;
    let pPrev = pmm;
    let pCur = x * (2 * m + 1) * pmm;
    if (l === m + 1) return pCur;
    for (let ll = m + 2; ll <= l; ll++) {
      const nxt = ((2 * ll - 1) * x * pCur - (ll + m - 1) * pPrev) / (ll - m);
      pPrev = pCur;
      pCur = nxt;
    }
    return pCur;
  }

  let lNow = 0, mNow = 0;

  function rebuild(): void {
    // 第一遍：求 |S| 的最大值，用于把位移与着色都归一化到同一标度
    let mx = 1e-9;
    let vi = 0;
    for (let j = 0; j < NT; j++) {
      const th = (Math.PI * j) / (NT - 1);
      const ct = Math.cos(th), st = Math.sin(th);
      const p = plm(lNow, mNow, ct);
      for (let i = 0; i <= NP; i++) {
        const ph = (2 * Math.PI * i) / NP;
        const S = mNow === 0 ? p : p * Math.cos(mNow * ph);
        sph[vi * 2] = S;
        sph[vi * 2 + 1] = st;
        if (Math.abs(S) > mx) mx = Math.abs(S);
        vi++;
      }
    }
    // 第二遍：r = R₀ + A·S/mx，并按 S/mx 的正负着色，|S|<阈值 处描节线
    vi = 0;
    for (let j = 0; j < NT; j++) {
      const th = (Math.PI * j) / (NT - 1);
      const ct = Math.cos(th);
      for (let i = 0; i <= NP; i++) {
        const ph = (2 * Math.PI * i) / NP;
        const S = sph[vi * 2] / mx;
        const st = sph[vi * 2 + 1];
        const r = R0 + AMP * S;
        pos[vi * 3] = r * st * Math.cos(ph);
        pos[vi * 3 + 1] = r * ct;
        pos[vi * 3 + 2] = r * st * Math.sin(ph);
        const a = Math.abs(S);
        if (a < 0.07) {
          col[vi * 3] = 0.97; col[vi * 3 + 1] = 0.97; col[vi * 3 + 2] = 0.98;   // 节线
        } else if (S > 0) {
          col[vi * 3] = 0.16 + 0.62 * a; col[vi * 3 + 1] = 0.36 + 0.34 * a; col[vi * 3 + 2] = 0.92 - 0.42 * a;
        } else {
          col[vi * 3] = 0.86 * a + 0.12; col[vi * 3 + 1] = 0.24 + 0.3 * a; col[vi * 3 + 2] = 0.5 - 0.12 * a;
        }
        vi++;
      }
    }
    sGeo.attributes['position'].needsUpdate = true;
    sGeo.attributes['color'].needsUpdate = true;
  }

  // —— 极轴与赤道参考圈 ——
  const axisGeo = geo(new THREE.BufferGeometry());
  axisGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, -2.55, 0, 0, 2.55, 0]), 3));
  group.add(new THREE.Line(axisGeo, mat(new THREE.LineBasicMaterial({ color: 0x64748b }))));
  const eqPts: number[] = [];
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * 2 * Math.PI;
    eqPts.push(Math.cos(a) * 2.05, 2.15, Math.sin(a) * 2.05);
  }
  const eqGeo = geo(new THREE.BufferGeometry());
  eqGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(eqPts), 3));
  group.add(new THREE.Line(eqGeo, mat(new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.7 }))));

  // —— 面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 860; infoCv.height = 262;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.4, 2.86)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 6.2, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 860, 262);
    infoCtx.fillStyle = 'rgba(7,11,20,0.84)'; infoCtx.fillRect(4, 4, 852, 254);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 852, 254);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 27px "PingFang SC", sans-serif';
    infoCtx.fillText('球坐标分离：Y_lm 是拉普拉斯角向算符的本征函数', 22, 38);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '24px "PingFang SC", sans-serif';
    infoCtx.fillText('∇²_Ω Y = −l(l+1)Y，  Y_lm = N·P_l^m(cosθ)·e^{imφ}', 22, 72);
    infoCtx.fillText('递推 (l−m)P_l^m = (2l−1)cosθ·P_{l−1}^m − (l+m−1)P_{l−2}^m（本面实算）', 22, 100);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('单值(φ→φ+2π) + 有界(θ=0,π) ⇒ l、m 只能取整数：量子化来自边界条件，不是额外假设', 22, 134);
    infoCtx.fillStyle = '#f472b6';
    infoCtx.fillText(`节面总数 = l：锥面 ${lNow - mNow} 个（赤道方向起伏）+ 过极经线 ${mNow} 组 ⇒ 子午瓣 ${lNow - mNow} + 方位瓣 ${2 * mNow}`, 22, 166);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    const Lmag = Math.sqrt(lNow * (lNow + 1));
    const kind = mNow === 0 ? 'zonal 带' : mNow === lNow ? 'sectorial 环' : 'tesseral 棋盘';
    infoCtx.fillText(
      `读数：l=${lNow}  m=${mNow}（${kind}）  本征值 −l(l+1)=${(-lNow * (lNow + 1)).toFixed(0)}  |L|=√(l(l+1))ħ=${Lmag.toFixed(2)}ħ  L_z=mħ=${mNow}ħ  最大隆起=归一 A·S/max|S|=${AMP.toFixed(2)}`,
      22, 202,
    );
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('白色线 = S=0 节面；暖/冷 = S>0 / S<0。l 由 0→4、m 由 0→l 逐个扫描 15 个模式', 22, 236);
    infoTex.needsUpdate = true;
  }

  rebuild();
  drawInfo();

  const TABLE: number[][] = [];
  for (let l = 0; l <= 4; l++) for (let m = 0; m <= l; m++) TABLE.push([l, m]);
  let lastSlot = -1;

  return {
    update(t, dt) {
      // 扫描自变量：模式指标 (l,m) —— 每 7 s 换一个，105 s 走完 15 个；整个球面按同一递推重建
      const slot = Math.min(TABLE.length - 1, Math.floor((t % (TABLE.length * 7)) / 7));
      if (slot !== lastSlot) {
        lastSlot = slot;
        lNow = TABLE[slot][0];
        mNow = TABLE[slot][1];
        rebuild();
      }
      surf.rotation.y += dt * 0.42;                 // 慢转展示 φ 向瓣数
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
