import type { SceneContext, SceneInstance } from '../types';
/**
 * 重整化群与标度不变（P217）：实空间 RG（Kadanoff 块自旋）在 2D Ising 模型上的现场演示。
 * 微观：L=64 周期方格热浴蒙特卡洛（两子格更新，精确细致平衡），β=1/T，ΔE=2 s_i Σ s_nn。
 * 粗粒化：R 变换把 b×b 块平均成块自旋 m_b=⟨s⟩_block，观测量 R(b)=√⟨m_b²⟩（不减均值）。
 * 标度理论：lnR 对 lnb 斜率 = −y_m，y_m=(d−2+η)/2；2D Ising 精确 Tc=2/ln(1+√2)=2.2690、ν=1、η=1/4
 *   ⇒ 临界斜率 −1/8；高温无序（独立自旋）R=1/b ⇒ 斜率 −d/2=−1（高斯不动点）；
 *   低温有序 m_b→自发磁化 ⇒ 斜率 →0（低温不动点）。
 * 流方程（线性化）：t'=t·b^{1/ν}（2D：每 b=2 步翻倍；3D ν≈0.630→×3.00；平均场 ν=1/2→×4 超临界），
 *   u'=u·b^{−ω}（3D ω≈0.83→×0.563，无关算子流向不动点）。
 * 画面：五块竖屏并排显示 b=1,2,4,8,16 的块自旋场（红 m=+1 / 蓝 m=−1，点径随 b 放大），
 *   地面图表实时绘制 lnR(b) 测量点与最小二乘拟合线，及三条理论参考线（0、−1/8、−1）。
 * 数值核对（离线同代码）：T=1.8 斜率 −0.018；T=Tc −0.142（理论 −0.125）；T=2.8 −0.488；T=10 −0.908（R(b)=1/b）。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  const PI = Math.PI;
  const starGeo = geo(new THREE.BufferGeometry());
  { const p = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) { p[i * 3] = (Math.random() - 0.5) * 400; p[i * 3 + 1] = (Math.random() - 0.5) * 400; p[i * 3 + 2] = (Math.random() - 0.5) * 400; }
    starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3)); }
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // —— Ising 蒙特卡洛（与离线校验脚本同一算法）——
  const L = 64, TC = 2 / Math.log(1 + Math.SQRT2); // 2.2690...
  const sp = new Int8Array(L * L);
  let rs = 987654321;
  const rnd = () => { rs = (rs + 0x6D2B79F5) | 0; let t = Math.imul(rs ^ (rs >>> 15), 1 | rs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < L * L; i++) sp[i] = rnd() < 0.5 ? 1 : -1;
  const sweeps = (T: number, n: number) => {
    const beta = 1 / T;
    for (let sw = 0; sw < n; sw++) for (let sub = 0; sub < 2; sub++) for (let idx = sub; idx < L * L; idx += 2) {
      const i = (idx / L) | 0, j = idx % L;
      const nb = sp[((i + 1) % L) * L + j] + sp[((i - 1 + L) % L) * L + j] + sp[i * L + ((j + 1) % L)] + sp[i * L + ((j - 1 + L) % L)];
      const dE = 2 * sp[idx] * nb;
      if (dE <= 0 || rnd() < Math.exp(-beta * dE)) sp[idx] = -sp[idx];
    }
  };
  const BS = [1, 2, 4, 8, 16];
  const mSq = new Float64Array(5);   // 各尺度 Σm_b²（本帧）
  const nBlk = new Int32Array(5);
  // stages 在下方竖屏创建；blockAll 仅在 update 期被调用
  const blockAll = () => {
    mSq.fill(0);
    for (let k = 0; k < 5; k++) {
      const b = BS[k], M = L / b, col = stages[k].col;
      let q = 0;
      for (let i = 0; i < M; i++) for (let j = 0; j < M; j++) {
        let t = 0;
        for (let di = 0; di < b; di++) for (let dj = 0; dj < b; dj++) t += sp[((i * b + di) % L) * L + ((j * b + dj) % L)];
        const v = t / (b * b); mSq[k] += v * v;
        col[q] = 0.5 + 0.5 * v; col[q + 1] = 0.5 - 0.28 * Math.abs(v); col[q + 2] = 0.5 - 0.5 * v;
        q += 3;
      }
      nBlk[k] = M * M;
      stages[k].g.attributes['color'].needsUpdate = true;
    }
  };
  // —— 时间窗内 lnR 累积（拟合斜率用 b=1,2,4,8）——
  // 只统计 |T−锚|<T_TOL 的帧：T 随 18s 正弦连续扫描，漂移出窗即清零重新累积，
  // 保证「实测斜率」拟合的是当前温度，与当帧 lnR 测量点同源。
  const acc = new Float64Array(4); let accN = 0;
  let tAnchor = NaN;
  const T_TOL = 0.07;
  const clearAcc = () => { acc.fill(0); accN = 0; };
  const fitSlope = () => {
    if (accN < 8) return NaN;
    let sx = 0, sy = 0, sxx = 0, sxy = 0; const n = 4;
    for (let k = 0; k < 4; k++) { const x = Math.log(BS[k]); sx += x; sy += acc[k] / accN; sxx += x * x; sxy += x * acc[k] / accN; }
    return (n * sxy - sx * sy) / (n * sxx - sx * sx);
  };

  // —— 五块竖屏：每块 Points，vertexColors 每帧重写 ——
  const STG_W = 1.62, STG_GAP = 1.98, Y0 = 1.62;
  const stages: { pts: import('three').Points; pos: Float32Array; col: Float32Array; g: import('three').BufferGeometry; m: import('three').PointsMaterial; n: number; b: number }[] = [];
  for (let k = 0; k < 5; k++) {
    const b = BS[k], M = L / b, n = M * M;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const cx = -4 + k * STG_GAP;
    for (let i = 0; i < M; i++) for (let j = 0; j < M; j++) {
      const o = (i * M + j) * 3;
      pos[o] = cx + ((j + 0.5) / M - 0.5) * STG_W; pos[o + 1] = Y0 + ((M - 1 - i + 0.5) / M - 0.5) * STG_W; pos[o + 2] = 0;
      col[o] = 1; col[o + 1] = 1; col[o + 2] = 1;
    }
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mm = mat(new THREE.PointsMaterial({ vertexColors: true, size: 0.028 * b + 0.014, transparent: true, opacity: 1 }));
    const pts = new THREE.Points(g, mm);
    g.setDrawRange(0, 0);
    group.add(pts);
    stages.push({ pts, pos, col, g, m: mm, n, b });
  }
  // 屏框 + 级间箭头（粗粒化方向）
  const frameGeo = geo(new THREE.BufferGeometry());
  { const p: number[] = [];
    for (let k = 0; k < 5; k++) { const cx = -4 + k * STG_GAP, h = STG_W / 2 + 0.07;
      p.push(cx - h, Y0 - h, 0, cx + h, Y0 - h, 0, cx + h, Y0 - h, 0, cx + h, Y0 + h, 0, cx + h, Y0 + h, 0, cx - h, Y0 + h, 0, cx - h, Y0 + h, 0, cx - h, Y0 - h, 0); }
    for (let k = 0; k < 4; k++) { const xa = -4 + k * STG_GAP + STG_W / 2 + 0.1, xb = xa + 0.42; p.push(xa, Y0, 0, xb, Y0, 0); }
    frameGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3)); }
  group.add(new THREE.LineSegments(frameGeo, mat(new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.8 }))));
  const arwGeo = geo(new THREE.ConeGeometry(0.075, 0.17, 8));
  const arwMat = mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
  const arws: import('three').Mesh[] = [];
  for (let k = 0; k < 4; k++) { const a = new THREE.Mesh(arwGeo, arwMat); a.rotation.z = -PI / 2; a.position.set(-4 + k * STG_GAP + STG_W / 2 + 0.42, Y0, 0); group.add(a); arws.push(a); }

  // —— 地面测量图：lnR(b) 点列 + 拟合线 + 理论参考线 ——
  const CH = { x0: -2.55, x1: 2.55, z0: -2.5, z1: -1.0, lnbMax: Math.log(16), lnRLo: -1.25, lnRHi: 0.12 };
  const cX = (lnb: number) => CH.x0 + (lnb / CH.lnbMax) * (CH.x1 - CH.x0);
  const cZ = (lnr: number) => CH.z0 + (Math.max(CH.lnRLo, Math.min(CH.lnRHi, lnr)) - CH.lnRLo) / (CH.lnRHi - CH.lnRLo) * (CH.z1 - CH.z0);
  const refGeo = geo(new THREE.BufferGeometry());
  { const p: number[] = [];
    // 坐标轴
    p.push(cX(0), 0.02, CH.z0, cX(0), 0.02, CH.z1, CH.x0, 0.02, cZ(0), CH.x1, 0.02, cZ(0));
    // 三条理论线：斜率 0 / −1/8 / −1（lnR = slope·ln b，画到 b=16）
    const push = (slope: number) => { let prev: [number, number] | null = null;
      for (let i = 0; i <= 4; i++) { const lnb = Math.log(2) * i; const lnr = slope * lnb;
        if (lnr < CH.lnRLo - 0.02) break;
        if (prev) p.push(cX(prev[0]), 0.021, cZ(prev[1]), cX(lnb), 0.021, cZ(lnr));
        prev = [lnb, lnr]; } };
    push(0); push(-0.125); push(-1);
    refGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3)); }
  group.add(new THREE.LineSegments(refGeo, mat(new THREE.LineBasicMaterial({ color: 0x64748b }))));
  const measGeo = geo(new THREE.BufferGeometry());
  const measPos = new Float32Array((3 * 4) * 3);      // 3 段折线（4 个测量点）
  measGeo.setAttribute('position', new THREE.BufferAttribute(measPos, 3));
  const measLine = new THREE.Line(measGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee })));
  measLine.geometry.setDrawRange(0, 0);
  group.add(measLine);
  const dotsGeo = geo(new THREE.BufferGeometry());
  const dotsPos = new Float32Array(4 * 3);
  dotsGeo.setAttribute('position', new THREE.BufferAttribute(dotsPos, 3));
  const dots = new THREE.Points(dotsGeo, mat(new THREE.PointsMaterial({ color: 0xa855f7, size: 0.09 })));
  dots.geometry.setDrawRange(0, 0);
  group.add(dots);
  const fitGeo = geo(new THREE.BufferGeometry());
  fitGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
  group.add(new THREE.Line(fitGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 }))));

  function makeLabel(text: string, color: string, scale = 3.2): import('three').Sprite {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(scale, scale / 8, 1); s.renderOrder = 998; return s;
  }
  BS.forEach((b, k) => { const s = makeLabel(`b = ${b}`, k === 2 ? '#fbbf24' : '#94a3b8', 1.7); s.position.set(-4 + k * STG_GAP, 2.72, 0); group.add(s); });
  const ln0 = makeLabel('R 变换（Kadanoff 块自旋）：b×b 块平均 ⇒ 尺度逐级翻倍，界面逐级“模糊”', '#c4b5fd', 5.2); ln0.position.set(-0.5, 0.62, 1.1);
  const ln1 = makeLabel('地面图：lnR(b) 拟合斜率 −y_m（理论 −1/8 @临界）', '#22d3ee', 3.9); ln1.position.set(0, 0.42, -1.9);
  group.add(ln0, ln1);

  const infoCv = document.createElement('canvas'); infoCv.width = 660; infoCv.height = 264;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const info = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  info.scale.set(6.6, 2.64, 1); info.position.set(0, 3.86, 0); info.renderOrder = 999;
  group.add(info);

  const CYCLE = 18;
  const rd = { T: 2.3, t: 0.01, slope: NaN, lnRs: [0, 0, 0, 0, 0] as number[] };
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 660, 264);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(3, 3, 654, 258);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(3, 3, 654, 258);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 23px "PingFang SC", sans-serif';
    infoCtx.fillText('重整化群：变换 R 作用多次，看系统在哪两个不动点之间流动', 12, 28);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '18px "PingFang SC", sans-serif';
    infoCtx.fillText('m_b=⟨s⟩_block，R(b)=√⟨m_b²⟩ ~ b^(−y_m)，y_m=(d−2+η)/2', 12, 54);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('2D Ising 精确：Tc=2/ln(1+√2)=2.2690，ν=1，η=1/4 ⇒ y_m=1/8；流 t′=t·b^(1/ν)，u′=u·b^(−ω)', 12, 78);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 19px "PingFang SC", sans-serif';
    const sl = Number.isNaN(rd.slope) ? '─' : rd.slope.toFixed(3);
    infoCtx.fillText(`读数：T=${rd.T.toFixed(3)}  t=(T−Tc)/Tc=${rd.t.toFixed(3)}  实测斜率=${sl}`, 12, 106);
    const reg = rd.t > 0.04 ? '高温侧：R(b) 快塌 → 高斯不动点（斜率→−d/2=−1）' : rd.t < -0.04 ? '低温侧：m_b 不塌缩 → 有序不动点（斜率→0）' : '临界邻域：幂律 b^(−1/8)，标度不变——RG 的固定点';
    infoCtx.fillText(`  ${reg}`, 12, 130);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '17px "PingFang SC", sans-serif';
    infoCtx.fillText(`lnR(b)= ${rd.lnRs.map((x) => x.toFixed(2)).join('  ')}`, 12, 156);
    infoCtx.fillText(`b=1,2,4,8,16；t′=t·2^(1/ν)：|t| 每步×2 → 远离 Tc（不稳定不动点），ξ′=ξ/b`, 12, 180);
    infoCtx.fillStyle = '#22c55e'; infoCtx.font = '16px "PingFang SC", sans-serif';
    infoCtx.fillText('无关算子 u′=u·b^(−ω)（3D：×0.563/步）衰减 → 普适性只由少数相关方向决定', 12, 206);
    infoCtx.fillText('参考离线实测：T=1.8→−0.018, Tc→−0.142(理论−0.125), 2.8→−0.488, T=10→−0.908', 12, 230);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  return {
    update(t, dt) {
      const u = (t % CYCLE) / CYCLE;
      const T = 2.31 + 0.53 * Math.cos(TWO(u));
      rd.T = T; rd.t = (T - TC) / TC;
      // 蒙特卡洛：温度连续变化，系综随之在两个不动点之间漂移
      sweeps(T, 2);
      blockAll(); // 同时写出五屏颜色与 mSq
      if (Number.isNaN(tAnchor) || Math.abs(T - tAnchor) > T_TOL) { tAnchor = T; clearAcc(); } // T 漂移出窗 ⇒ 只重采当前 T 附近帧
      for (let k = 0; k < 4; k++) { rd.lnRs[k] = Math.log(Math.max(1e-9, Math.sqrt(mSq[k] / nBlk[k]))); acc[k] += rd.lnRs[k]; }
      rd.lnRs[4] = Math.log(Math.max(1e-9, Math.sqrt(mSq[4] / nBlk[4])));
      accN++;
      rd.slope = fitSlope();
      for (let k = 0; k < 5; k++) {
        const st = stages[k];
        // 入场：逐级揭示（drawRange 纪律），~7s 后全量
        const reveal = Math.max(0, Math.min(st.n, Math.floor((t - 0.6 - k * 1.1) * st.n / 2.2)));
        st.g.setDrawRange(0, reveal);
      }
      // 高亮巡屏：每 3.6s 停一级（点径 ×1.5 呼吸）
      const hi = Math.floor((t % 18) / 3.6);
      for (let k = 0; k < 5; k++) {
        const st = stages[k], bs0 = 0.028 * st.b + 0.014;
        const target = bs0 * (k === hi ? 1.5 : 1);
        st.m.size = st.m.size + (target - st.m.size) * Math.min(1, dt * 5);
      }
      for (let k = 0; k < 4; k++) arws[k].scale.setScalar(1 + 0.35 * Math.sin(t * 4 - k * 0.9));
      // 地面测量图
      let prev: [number, number] | null = null; let vi = 0; let any = false;
      for (let k = 0; k < 4; k++) {
        const lnb = Math.log(BS[k]), lnr = rd.lnRs[k];
        dotsPos[k * 3] = cX(lnb); dotsPos[k * 3 + 1] = 0.05; dotsPos[k * 3 + 2] = cZ(lnr);
        if (prev) { measPos[vi] = cX(prev[0]); measPos[vi + 1] = 0.04; measPos[vi + 2] = cZ(prev[1]); vi += 3;
          measPos[vi] = cX(lnb); measPos[vi + 1] = 0.04; measPos[vi + 2] = cZ(lnr); vi += 3; any = true; }
        prev = [lnb, lnr];
      }
      measGeo.attributes['position'].needsUpdate = true;
      measGeo.setDrawRange(0, any ? vi / 3 : 0);
      dotsGeo.attributes['position'].needsUpdate = true;
      dotsGeo.setDrawRange(0, any ? 4 : 0); // 测量点=当帧实算，与 acc 清零解耦（斜率窗重建时不闪断）
      if (!Number.isNaN(rd.slope)) {
        const fp = fitGeo.attributes['position'] as import('three').BufferAttribute;
        fp.setXYZ(0, cX(0), 0.045, cZ(0));
        fp.setXYZ(1, cX(CH.lnbMax), 0.045, cZ(rd.slope * CH.lnbMax));
        fp.needsUpdate = true;
      }
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
    },
    dispose() {
      geos.forEach((x) => x.dispose()); mats.forEach((x) => x.dispose()); texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
const TWO = (u: number) => u * Math.PI * 2;
