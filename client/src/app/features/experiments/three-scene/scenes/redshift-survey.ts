import type { SceneContext, SceneInstance } from '../types';
/**
 * 星系红移巡天（P272）：宇宙网点云 + 重子声波（BAO）标准尺的“实测”演示。
 * 主控方程：低红移哈勃流 r = c·z/H0（H0=70 km/s/Mpc ⇒ r[Mpc]=4283·z，本玩具体积 z 展示 ×6 压缩）。
 * BAO 不再伪造峰：先给点云注入一个真实的、平移不变的近声波标度成分（各向振荡配对核），
 * 再用 ξ(r)=DD/RR−1 对同一窗口做真实估计；扫描样本量 N，让 ~10% 的声峰随统计量增长从噪声中浮现。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  const bkgGeo = geo(new THREE.BufferGeometry());
  const bkgPos = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    bkgPos[i * 3] = (Math.random() - 0.5) * 400;
    bkgPos[i * 3 + 1] = (Math.random() - 0.5) * 400;
    bkgPos[i * 3 + 2] = (Math.random() - 0.5) * 400;
  }
  bkgGeo.setAttribute('position', new THREE.BufferAttribute(bkgPos, 3));
  group.add(new THREE.Points(bkgGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // —— 宇宙学换算（1 世界单位 = 100 Mpc 共动）——
  const H0 = 70, C_KMS = 299792.458;
  const MPW = 100;                       // Mpc / 世界单位
  const RD = 150;                        // 声波视界 r_d ≈ 150 Mpc（BAO 标准尺）
  const RS = RD / MPW;                   // 世界单位 1.5
  const WSCALE = 6;                      // z 展示压缩系数（面板注明）
  const N_MAX = 1600, N_MIN = 120;
  const NB = 14, R_BIN = 20;             // ξ(r) 直方图：0…280 Mpc，每 bin 20 Mpc（受性能预算约束）
  const peakBin = Math.floor(RD / R_BIN);

  let seed = 20261013;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const gxyz = new Float32Array(N_MAX * 3);
  const gz = new Float32Array(N_MAX);
  let n = 0;
  const addGal = (x: number, y: number, z: number): void => {
    if (n >= N_MAX) return;
    gxyz[n * 3] = x; gxyz[n * 3 + 1] = y; gxyz[n * 3 + 2] = z;
    const rMpc = Math.hypot(x, y, z) * MPW;                    // 哈勃流：r = c z/H0 ⇒ z = H0·r/c
    const pec = (rnd() - 0.5) * 2 * 330;                       // 330 km/s 本动速度 ⇒ z 散布
    gz[n] = Math.max(0.002, ((H0 * rMpc + pec) / C_KMS) * WSCALE);
    n++;
  };

  // —— 1) 宇宙网（视觉：节点 + 短纤维；仅在小尺度上成团，令大尺度本底 ξ≈0）——
  const nf = 7;
  const NODES: number[][] = [];
  for (let i = 0; i < nf; i++) NODES.push([(rnd() - 0.5) * 6.4, (rnd() - 0.5) * 5, (rnd() - 0.5) * 6.4]);
  const WEB = 110;
  for (const nd of NODES)
    for (let k = 0; k < 26 && n < WEB; k++)
      addGal(nd[0] + (rnd() - 0.5) * 0.24, nd[1] + (rnd() - 0.5) * 0.24, nd[2] + (rnd() - 0.5) * 0.24);
  for (let i = 0; i < nf; i++)
    for (let j = i + 1; j < nf; j++) {
      const d = Math.hypot(NODES[i][0] - NODES[j][0], NODES[i][1] - NODES[j][1], NODES[i][2] - NODES[j][2]);
      if (d > 1.8) continue;
      const seg = Math.floor(d * 10);
      for (let k = 0; k < seg && n < WEB; k++) {
        const tt = k / seg;
        const gx = NODES[i][0] + (NODES[j][0] - NODES[i][0]) * tt;
        const gy = NODES[i][1] + (NODES[j][1] - NODES[i][1]) * tt;
        const gz2 = NODES[i][2] + (NODES[j][2] - NODES[i][2]) * tt;
        const s1 = (rnd() + rnd() + rnd() - 1.5) * 0.18, s2 = (rnd() + rnd() + rnd() - 1.5) * 0.18;
        addGal(gx + s1, gy + s2, gz2 + s1 * 0.6 - s2 * 0.3);
      }
    }

  // —— 2) 注入真实近声波标度：平移不变的成对核，奖励 n·r_d 间距、抑制 (n+½)·r_d ——
  //    对每个新候选星系按“与已置星系的核势能之和”做接受/拒绝（拒绝采样，非重排），
  //    因此 ξ(r) 在 r_d 及其倍数处“真正振荡”，而非强行凑出点对。
  const DMAX = 5 * RS, KSTEP = 0.02, KST = Math.ceil(DMAX / KSTEP) + 1;
  const gauss = (d: number, c: number, w: number): number => { const x = (d - c) / w; return Math.exp(-0.5 * x * x); };
  const KT = new Float32Array(KST);
  { const W = 0.1, PK = 1.4, TR = 1.0;
    for (let k = 0; k < KST; k++) {
      const d = k * KSTEP;
      const a1 = PK * (gauss(d, RS, W) + 0.5 * gauss(d, 2 * RS, W) + 0.28 * gauss(d, 3 * RS, W));
      const a2 = TR * (gauss(d, 0.5 * RS, W) + 0.7 * gauss(d, 1.5 * RS, W) + 0.5 * gauss(d, 2.5 * RS, W));
      KT[k] = a1 - a2;
    } }
  const KACC = 7, TRIES = 5;
  while (n < N_MAX) {
    let bx = 0, by = 0, bz = 0, bestSc = -1e9, got = false;
    for (let t = 0; t < TRIES; t++) {
      const x = (rnd() - 0.5) * 9, y = (rnd() - 0.5) * 7.6, z = (rnd() - 0.5) * 9;
      let sc = 0;
      for (let j = 0; j < n; j++) {
        const dx = gxyz[j * 3] - x, dy = gxyz[j * 3 + 1] - y, dz = gxyz[j * 3 + 2] - z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < DMAX) sc += KT[(d / KSTEP) | 0];
      }
      const norm = sc / Math.max(1, n);
      let pacc = 0.5 + KACC * norm; if (pacc < 0.02) pacc = 0.02; else if (pacc > 0.98) pacc = 0.98;
      if (rnd() < pacc) { bx = x; by = y; bz = z; got = true; break; }
      if (sc > bestSc) { bestSc = sc; bx = x; by = y; bz = z; }
    }
    void got; addGal(bx, by, bz);
  }

  // —— 打乱整表：前 N 个即全表的一个均匀随机子集，子样本随 N 增长含固定比例的声波成分 ——
  { let s = 90210; const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let i = N_MAX - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1)); if (i === j) continue;
      for (let c = 0; c < 3; c++) { const t = gxyz[i * 3 + c]; gxyz[i * 3 + c] = gxyz[j * 3 + c]; gxyz[j * 3 + c] = t; }
      const tg = gz[i]; gz[i] = gz[j]; gz[j] = tg;
    } }

  // —— 3) 真·两点相关：ξ(r)=DD/RR−1。DD 只在实际显示的 N 上算；RR 为同窗口均匀随机本底 ——
  const MAXW = (NB * R_BIN) / MPW, MAXW2 = MAXW * MAXW, RBINW = R_BIN / MPW;
  const makeHist = (maxN: number) => {
    const sx = new Float32Array(maxN), sy = new Float32Array(maxN), sz = new Float32Array(maxN);
    const ax = new Float32Array(maxN), ay = new Float32Array(maxN), az = new Float32Array(maxN);
    const idx = new Int32Array(maxN);
    return (C: Float32Array, N: number, out: Int32Array): void => {
      out.fill(0);
      for (let i = 0; i < N; i++) { sx[i] = C[i * 3]; sy[i] = C[i * 3 + 1]; sz[i] = C[i * 3 + 2]; idx[i] = i; }
      idx.subarray(0, N).sort((a, b) => sx[a] - sx[b]);
      for (let i = 0; i < N; i++) { const k = idx[i]; ax[i] = sx[k]; ay[i] = sy[k]; az[i] = sz[k]; }
      for (let i = 0; i < N; i++) {
        const xi = ax[i], yi = ay[i], zi = az[i];
        for (let k = i + 1; k < N; k++) {
          const dx = ax[k] - xi; if (dx > MAXW) break;                     // 按 x 排序后早断，成本随 N 缩放
          const dy = ay[k] - yi; if (dy > MAXW || dy < -MAXW) continue;
          const dz = az[k] - zi; if (dz > MAXW || dz < -MAXW) continue;
          const dsq = dx * dx + dy * dy + dz * dz; if (dsq > MAXW2) continue;
          const b = (Math.floor(Math.sqrt(dsq) / RBINW)) | 0; if (b < NB) out[b]++;
        }
      }
    };
  };
  const RND_MAX = 3000;
  let rs = 5150; const rr = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff; };
  const rpos = new Float32Array(RND_MAX * 3);
  for (let i = 0; i < RND_MAX; i++) { rpos[i * 3] = (rr() - 0.5) * 9; rpos[i * 3 + 1] = (rr() - 0.5) * 7.6; rpos[i * 3 + 2] = (rr() - 0.5) * 9; }
  const ddHist = makeHist(N_MAX), rrHist = makeHist(RND_MAX);
  const rrFull = new Int32Array(NB);
  rrHist(rpos, RND_MAX, rrFull);                                            // 同窗口随机本底，仅一次
  const dd = new Int32Array(NB), xiArr = new Float64Array(NB), sigArr = new Float64Array(NB);
  let curN = 0, peakXi = 0, peakSig = 1, lastRe = -1;
  const recompute = (N: number): void => {
    curN = N; ddHist(gxyz, N, dd);
    const scale = (N * (N - 1)) / (RND_MAX * (RND_MAX - 1));
    for (let b = 0; b < NB; b++) {
      const rrB = rrFull[b] * scale;
      const xi = rrB > 0 ? dd[b] / rrB - 1 : 0;
      xiArr[b] = xi; sigArr[b] = dd[b] > 0 ? (1 + xi) / Math.sqrt(dd[b]) : 9; // σ_ξ=(1+ξ)/√n_pairs
    }
    peakXi = xiArr[peakBin]; peakSig = sigArr[peakBin];
  };
  recompute(N_MIN);

  // —— 点云：颜色 = 红移（紫→红）——
  const galGeo = geo(new THREE.BufferGeometry());
  galGeo.setAttribute('position', new THREE.BufferAttribute(gxyz, 3));
  const colArr = new Float32Array(n * 3);
  const colAttr = new THREE.BufferAttribute(colArr, 3);
  galGeo.setAttribute('color', colAttr);
  const cloudMat = mat(new THREE.PointsMaterial({ size: 0.085, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.95 }));
  group.add(new THREE.Points(galGeo, cloudMat));
  for (let i = 0; i < n; i++) {
    const h = 0.78 - 0.76 * Math.min(1, gz[i] / 0.62);
    const c = new THREE.Color().setHSL(h, 0.8, 0.62);
    colArr[i * 3] = c.r; colArr[i * 3 + 1] = c.g; colArr[i * 3 + 2] = c.b;
  }
  colAttr.needsUpdate = true;

  const refIdx = 0;
  const refMark = new THREE.Mesh(geo(new THREE.SphereGeometry(0.16, 14, 14)), mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 1.5 })));
  group.add(refMark);
  const shell = new THREE.Mesh(geo(new THREE.SphereGeometry(RS, 32, 24)), mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.07 })));
  group.add(shell);
  const slice = new THREE.Mesh(geo(new THREE.PlaneGeometry(9.2, 7.8)), mat(new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.1, side: THREE.DoubleSide })));
  slice.rotation.y = Math.PI / 2;
  group.add(slice);

  function makeLabel(text: string, color: string, scale = 3.4): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(scale, scale / 8, 1); s.renderOrder = 998;
    return s;
  }
  const lShell = makeLabel('BAO 标准尺 r_d≈150 Mpc', '#22d3ee', 4.2);
  lShell.position.set(gxyz[refIdx * 3], gxyz[refIdx * 3 + 1] + RS + 0.5, gxyz[refIdx * 3 + 2]);
  group.add(lShell);
  const lSlice = makeLabel('红移切片推进 →', '#a855f7', 3.0);
  group.add(lSlice);

  const infoCv = document.createElement('canvas');
  infoCv.width = 512; infoCv.height = 320;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const info = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  info.scale.set(7.4, 4.63, 1); info.position.set(0, 5.4, 0); info.renderOrder = 999;
  group.add(info);

  refMark.position.set(gxyz[refIdx * 3], gxyz[refIdx * 3 + 1], gxyz[refIdx * 3 + 2]);
  shell.position.copy(refMark.position);

  let zSlice = 0.05, nslice = 0, ncum = 0, ideal = false;

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 512, 320);
    infoCtx.fillStyle = 'rgba(7,11,20,0.86)'; infoCtx.fillRect(3, 3, 506, 314);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(3, 3, 506, 314);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 25px "PingFang SC", sans-serif';
    infoCtx.fillText('星系红移巡天 · 宇宙网 · BAO', 14, 34);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '19px "PingFang SC", sans-serif';
    infoCtx.fillText('哈勃流 r=c·z/H0：H0=70 ⇒ c/H0=4283 Mpc/z（z ×6 压缩）', 14, 60);
    infoCtx.fillText('BAO 实测 ξ(r)=DD/RR−1，标准尺 r_d=150 Mpc', 14, 84);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('声峰仅约10%幅度，须大样本方从噪声浮现', 14, 108);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '15px "PingFang SC", sans-serif';
    infoCtx.fillText('玩具体积 900×760×900 Mpc；小尺度成团 ξ≫1，超出本图纵轴量程', 14, 128);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 20px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数: 样本 N=${curN}  片 z=${zSlice.toFixed(3)}  r=${(zSlice / WSCALE * C_KMS / H0).toFixed(0)} Mpc`, 14, 156);
    infoCtx.fillText(`N(片内)=${nslice}  N(z<${zSlice.toFixed(2)})=${ncum}/${curN}${ideal ? '  [理想·大样本极限]' : ''}`, 14, 180);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = 'bold 19px "PingFang SC", sans-serif';
    const signif = peakXi / peakSig;
    infoCtx.fillText(`ξ(r_d)=${peakXi >= 0 ? '+' : ''}${peakXi.toFixed(3)} ±${peakSig.toFixed(3)} ⇒ 显著 ${Math.abs(signif).toFixed(1)}σ`, 14, 204);
    // —— 真 ξ(r) 折/柱：纵轴 ξ，围绕 0 衰减振荡，带随 N 收缩的误差棒，红框高亮 r_d bin ——
    const bx = 14, bw = 484 / NB, yz = 258, yUp = 226, yDn = 286, spanUp = 0.30, spanDn = 0.22;
    infoCtx.strokeStyle = '#1e293b'; infoCtx.beginPath(); infoCtx.moveTo(bx, yz); infoCtx.lineTo(bx + 484, yz); infoCtx.stroke();
    for (let b = 0; b < NB; b++) {
      if (dd[b] === 0) continue;                          // 无对的 bin：本征未测，留空（诚实）
      const v = xiArr[b], cl = Math.max(-spanDn, Math.min(spanUp, v));
      const off = cl >= 0 ? (cl / spanUp) * (yz - yUp) : (cl / spanDn) * (yDn - yz); // 有符号像素高（正=向上）
      const cx = bx + b * bw + bw / 2;
      infoCtx.fillStyle = b === peakBin ? '#ef4444' : (v < 0 ? '#0ea5e9' : '#334155');
      infoCtx.fillRect(bx + b * bw + 1.5, yz - Math.max(off, 0), bw - 3, Math.abs(off) + 1);
      if (!ideal) {                                     // 误差棒 ±σ_ξ：N 越大越短
        const e = Math.min(30, (sigArr[b] / spanUp) * (yz - yUp));
        infoCtx.strokeStyle = '#94a3b8'; infoCtx.lineWidth = 1.2;
        infoCtx.beginPath(); infoCtx.moveTo(cx, yz - off - e); infoCtx.lineTo(cx, yz - off + e); infoCtx.stroke();
      }
    }
    infoCtx.fillStyle = '#64748b'; infoCtx.font = '12px "PingFang SC", sans-serif';
    infoCtx.fillText('ξ=0', bx + 3, yz + 12);
    infoCtx.fillStyle = '#ef4444'; infoCtx.font = '13px "PingFang SC", sans-serif';
    infoCtx.fillText(`r_d ${(peakBin * R_BIN).toFixed(0)}Mpc`, bx + peakBin * bw - 14, yDn + 14);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '12px "PingFang SC", sans-serif';
    infoCtx.fillText('横轴 r = 0…280 Mpc，每格 20 Mpc', 14, yDn + 30);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  return {
    update(t, dt) {
      // —— 哈勃流半边（公式驱动，保留）：切片沿 +x 推进，z 由 r 反算 ——
      const zs = 0.5 + 0.5 * Math.sin((Math.PI * 2 * t) / 16);
      const sx = -4.6 + zs * 9.2;
      slice.position.set(sx, 0, 0);
      lSlice.position.set(sx, 4.2, 0);
      zSlice = (H0 * Math.abs(sx) * MPW / C_KMS) * WSCALE;
      // —— 扫描巡天规模 N：12 s 内由 N_MIN 增至 N_MAX，其后 dwell 为理想·大样本 ——
      const u = (t % 12) / 12;
      ideal = u >= 0.82;
      const wantN = ideal ? N_MAX : Math.round(N_MIN + (N_MAX - N_MIN) * (u / 0.82));
      // —— 性能闸：仅当 N 实际改变且距上次 ≥0.4s 才重算 O(N²) 全对直方图 ——
      if (wantN !== curN && t - lastRe >= 0.4) { recompute(wantN); lastRe = t; }
      galGeo.setDrawRange(0, curN);
      // —— 用同一数组持续更新哈勃流读数（子样本内）——
      let cnt = 0, cum = 0;
      for (let i = 0; i < curN; i++) { if (Math.abs(gxyz[i * 3] - sx) < 0.22) cnt++; if (gz[i] <= zSlice) cum++; }
      nslice = cnt; ncum = cum;
      cloudMat.opacity = 0.85 + 0.1 * Math.sin(t * 2.2);
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
