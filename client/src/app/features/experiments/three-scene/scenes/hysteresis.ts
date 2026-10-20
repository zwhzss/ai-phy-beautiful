import type { SceneContext, SceneInstance } from '../types';
/**
 * 磁滞回线（P120）：铁磁体内磁畴逐块翻转 + 畴壁迁移，同步在 B–H 空间描绘一星期回线；回线面积以发热辉光闪烁。
 * 主控方程（畴态与曲线同源，全部由同一组变量算出）：
 *   ① 畴翻转（不可逆、有矫顽场分布）：第 k 个 180° 磁畴的开关场 Xi 服从对数均匀分布，H 越过 +Xi 置“↑”，越过 −Xi 置“↓”
 *   ② 不可逆磁化 Mirr = Ms·Σ fk·ak（ak=2pk−1 为该畴的翻转进度 ⇒ 畴体积分数直接由畴壁位置给出）
 *   ③ 可逆（畴壁弹性弯曲 + 磁化转动）：Man = Ms·L(H/a)，L(x)=coth x−1/x（朗之万），M = (1−c)·Mirr + c·Man
 *   ④ 全场：B = μ0(H + M)；回线面积 w = ∮H dB [J/m³] ⇒ 功率密度 P = f·w，比损耗 P/ρ [W/kg]
 *   ⑤ 畴壁迁移（磁粘滞，按场强步进）：|H|>Xi 后该畴在 ~0.15·Xi 的场宽内扫过 ⇒ 回线与帧率无关；
 *      |H|<Xi 的畴被钉扎不动（这正是剩磁的来源），幅度包络 Hamax 低于多数 Xi 时只剩狭小的 minor loop
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  const MU0 = 4 * Math.PI * 1e-7, TWO_PI = Math.PI * 2;
  // ===== 材料参数（硅钢量级：本文件预卷收敛主回线给出 Br/Hc/面积，见下方 pre-roll，与画面逐帧同一套积分） =====
  const MS = 1.7e6, A_LAT = 55, C_REV = 0.2, NCOL = 9, LN_W = 4, XI_MED = 26;
  const H_MAX = 2000, F_CYC = 1 / 6, T_CYC = 1 / F_CYC, RHO = 7650;
  const FLIP_H = 0.15;                                // 翻转场宽 = FLIP_H·Xi（准静态畴壁迁移）
  const H_STEP = 0.5;                                 // 积分器最大场步长 [A/m]：画面与预卷都用它 ⇒ 面积、Br、Hc 与帧率无关
  const XI: number[] = [];
  for (let k = 0; k < NCOL; k++) XI.push(XI_MED * Math.exp(LN_W * ((k + 0.5) / NCOL - 0.5)));
  const p = new Float64Array(NCOL).fill(-1);          // 各畴翻转进度 ∈[−1,1]
  const fr = new Float64Array(NCOL).fill(1 / NCOL);   // 体积分数

  const lan = (x: number): number => (Math.abs(x) < 1e-6 ? x / 3 : 1 / Math.tanh(x) - 1 / x);
  let Hnow = -H_MAX, Mirr = 0, Mtot = 0, Ban = 0, nFlip = 0, envFrac = 1, envCi = -1;
  // 磁粘滞积分：给定当前场 H 与本步场增量 dH，推进各畴翻转进度（画面与预卷共用同一函数 ⇒ 常数自洽）
  function stepDomains(st: Float64Array, H: number, dH: number): void {
    const tgt = H > 0 ? 1 : -1;
    for (let k = 0; k < NCOL; k++) {
      if (Math.abs(H) <= XI[k]) continue;             // 未越过开关场：畴壁被钉扎
      const move = Math.abs(dH) / (FLIP_H * Math.max(1, XI[k]));
      const rem = Math.abs(tgt - st[k]);
      st[k] += Math.sign(tgt - st[k]) * Math.min(rem, move);
    }
  }
  const bOf = (H: number, st: Float64Array): number => {
    let acc = 0; for (let k = 0; k < NCOL; k++) acc += fr[k] * st[k];
    return MU0 * (H + (1 - C_REV) * MS * acc + C_REV * MS * lan(H / A_LAT));
  };
  function magnetics(): void {
    let acc = 0, nf = 0;
    for (let k = 0; k < NCOL; k++) { acc += fr[k] * p[k]; if (p[k] > 0) nf++; }
    Mirr = MS * acc;                                 // Σfk = 1
    const Man = MS * lan(Hnow / A_LAT);
    Mtot = (1 - C_REV) * Mirr + C_REV * Man;
    Ban = MU0 * (Hnow + Mtot);
    nFlip = nf;
  }
  // 参考（收敛）主回线与材料常数：同一驱动、同一积分器预卷数周
  let Br = 0, Hc = 0, W_REF = 0;
  {
    const NST = Math.ceil(TWO_PI * H_MAX / H_STEP);   // ≈25k 步/圈，最大场步长 = 画面同一上限；预卷 ~10 ms
    const q = new Float64Array(NCOL).fill(-1);
    let area = 0, hPrev = 0, bPrev = 0, brI = 0, hcI = 0;
    for (let cyc = 0; cyc < 3; cyc++) {
      for (let i = 0; i <= NST; i++) {
        const ph = TWO_PI * i / NST, H = H_MAX * Math.sin(ph), dH = i === 0 ? 0 : H - hPrev;
        stepDomains(q, H, dH);
        const B = bOf(H, q);
        if (cyc === 2 && i > 0) {
          area += (hPrev + H) / 2 * (B - bPrev);
          if (hPrev > 0 && H <= 0) brI = bPrev - hPrev * (B - bPrev) / (H - hPrev);        // 降支过 H=0 ⇒ 剩磁
          if (bPrev > 0 && B <= 0 && H < 0) hcI = hPrev - bPrev * (H - hPrev) / (B - bPrev); // 降支过 B=0 ⇒ 矫顽力
        }
        hPrev = H; bPrev = B;
      }
    }
    Br = brI; Hc = -hcI; W_REF = Math.abs(area);
  }
  Br = Br > 0 ? Br : 1.71; Hc = Hc > 0 ? Hc : 24;

  // ===== 星野 + 网格 =====
  const starGeo = geo(new THREE.BufferGeometry());
  {
    const q = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) { q[i * 3] = (Math.random() - 0.5) * 200; q[i * 3 + 1] = (Math.random() - 0.5) * 200; q[i * 3 + 2] = (Math.random() - 0.5) * 200; }
    starGeo.setAttribute('position', new THREE.BufferAttribute(q, 3));
  }
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  grid.position.y = -3.3;
  group.add(grid);

  // ===== 左侧：试样（沿 x 的 180° 条状畴，畴壁位置 = 体积分数） =====
  const spec = new THREE.Group();
  spec.position.set(-2.95, 0.35, 0);
  group.add(spec);
  const W_SPEC = 2.5, H_SPEC = 1.7, D_SPEC = 0.95;
  const colGeo = geo(new THREE.BoxGeometry(1, 1, 1));
  const cols: import('three').Mesh[] = [], colMats: import('three').MeshStandardMaterial[] = [];
  const wallGeo = geo(new THREE.BoxGeometry(0.03, H_SPEC, D_SPEC));
  const walls: import('three').Mesh[] = [];
  for (let k = 0; k < NCOL; k++) {
    const m = mat(new THREE.MeshStandardMaterial({ color: 0xa855f7, metalness: 0.35, roughness: 0.5, emissive: 0x4c1d95, emissiveIntensity: 0.4 }));
    const c = new THREE.Mesh(colGeo, m); spec.add(c); cols.push(c); colMats.push(m);
  }
  for (let k = 0; k <= NCOL; k++) {
    const w = new THREE.Mesh(wallGeo, mat(new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.85 })));
    spec.add(w); walls.push(w);
  }
  const axGeo = geo(new THREE.ConeGeometry(0.11, 0.34, 8));
  const axMat = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
  const axes: import('three').Mesh[] = [];
  for (let k = 0; k < NCOL; k++) { const a = new THREE.Mesh(axGeo, axMat); spec.add(a); axes.push(a); }
  const shell = new THREE.Mesh(geo(new THREE.BoxGeometry(W_SPEC + 0.06, H_SPEC + 0.06, D_SPEC + 0.06)), mat(new THREE.MeshBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.35, side: THREE.BackSide })));
  spec.add(shell);
  // 外场线圈（示意通电螺线管，轴线沿 x）
  const yokeGeo = geo(new THREE.TorusGeometry(1.35, 0.055, 6, 26));
  const yokeMat = mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.4, emissive: 0x1e293b, emissiveIntensity: 0.2 }));
  const yokes: import('three').Mesh[] = [];
  for (let k = 0; k < 5; k++) {
    const y = new THREE.Mesh(yokeGeo, yokeMat);
    y.rotation.y = Math.PI / 2; y.position.x = -1.5 + k * 0.75;
    spec.add(y); yokes.push(y);
  }

  // ===== 右侧：B–H 平面（回线轨迹 + 面积辉光） =====
  const plot = new THREE.Group();
  plot.position.set(2.35, 0.5, 0);
  group.add(plot);
  const PH = 2.1, PB = 1.85;                            // 半轴长（世界单位）
  const axisGeo = geo(new THREE.BufferGeometry());
  axisGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -PH, 0, 0, PH, 0, 0, -PH, 0, 0, -PH, 0, 0, 0, -PB, 0, 0, PB, 0,
  ]), 3));
  plot.add(new THREE.LineSegments(axisGeo, mat(new THREE.LineBasicMaterial({ color: 0x64748b }))));
  const tickGeo = geo(new THREE.BufferGeometry());
  {
    const v: number[] = [];
    for (let i = -4; i <= 4; i++) { if (i === 0) continue; v.push(i * PH / 4, -0.06, 0, i * PH / 4, 0.06, 0); }
    for (let i = -3; i <= 3; i++) { if (i === 0) continue; v.push(-0.07, i * PB / 3, 0, 0.07, i * PB / 3, 0); }
    tickGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
    tickGeo.setDrawRange(0, v.length / 3);
  }
  plot.add(new THREE.LineSegments(tickGeo, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));

  const NP = 1000;
  const loopGeo = geo(new THREE.BufferGeometry());
  const loopPos = new Float32Array(NP * 3);
  const loopCol = new Float32Array(NP * 3);
  loopGeo.setAttribute('position', new THREE.BufferAttribute(loopPos, 3));
  loopGeo.setAttribute('color', new THREE.BufferAttribute(loopCol, 3));
  loopGeo.setDrawRange(0, 0);
  plot.add(new THREE.Line(loopGeo, mat(new THREE.LineBasicMaterial({ vertexColors: true }))));
  // 面积填充：以回线质心做扇形（闭合后即为回线包围区）
  const fanGeo = geo(new THREE.BufferGeometry());
  const fanPos = new Float32Array((NP + 1) * 3);
  fanGeo.setAttribute('position', new THREE.BufferAttribute(fanPos, 3));
  { const idx: number[] = []; for (let i = 0; i < NP - 1; i++) idx.push(0, i + 1, i + 2); fanGeo.setIndex(idx); }   // 三角扇：未索引会画成 (c,p0,p1),(p2,p3,p4)… 的弦线
  fanGeo.setDrawRange(0, 0);
  const fanMat = mat(new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.2, side: THREE.DoubleSide }));
  plot.add(new THREE.Mesh(fanGeo, fanMat));
  const markMat = mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
  const mark = new THREE.Mesh(geo(new THREE.SphereGeometry(0.09, 12, 12)), markMat);
  plot.add(mark);
  const trailMat = mat(new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.6 }));
  const trail = new THREE.Mesh(geo(new THREE.SphereGeometry(0.06, 10, 10)), trailMat);
  plot.add(trail);

  const bufH: number[] = [], bufB: number[] = [];
  function toXY(h: number, b: number): [number, number] {
    return [(h / H_MAX) * PH * 0.98, (b / (MU0 * MS * 1.02)) * PB * 0.98];
  }
  function redrawLoop(flash: number): void {
    const n = Math.min(NP, bufH.length);
    let ch = 0, cb = 0;
    for (let i = bufH.length - n; i < bufH.length; i++) { ch += bufH[i]; cb += bufB[i]; }
    ch /= n; cb /= n;
    const [cx, cy] = toXY(ch, cb);
    fanPos[0] = cx; fanPos[1] = cy; fanPos[2] = 0;
    for (let i = 0; i < n; i++) {
      const idx = bufH.length - n + i;
      const [x, y] = toXY(bufH[idx], bufB[idx]);
      loopPos[i * 3] = x; loopPos[i * 3 + 1] = y; loopPos[i * 3 + 2] = 0;
      const age = i / n;
      loopCol[i * 3] = 0.13 + 0.75 * age; loopCol[i * 3 + 1] = 0.83 * (0.35 + 0.65 * age); loopCol[i * 3 + 2] = 0.93;
      fanPos[(i + 1) * 3] = x; fanPos[(i + 1) * 3 + 1] = y; fanPos[(i + 1) * 3 + 2] = 0;
    }
    loopGeo.attributes['position'].needsUpdate = true;
    loopGeo.attributes['color'].needsUpdate = true;
    loopGeo.setDrawRange(0, n);
    fanGeo.attributes['position'].needsUpdate = true;
    fanGeo.setDrawRange(0, Math.max(0, (n - 1) * 3));
    fanMat.opacity = 0.1 + 0.42 * flash;
  }

  // ===== 标签 =====
  function label(text: string, color: string, x: number, y: number, z: number, w = 2.4): void {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 25px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(w, w / 8, 1); s.position.set(x, y, z); group.add(s);
  }
  label('180° 磁畴条 + 畴壁（壁位=体积分数）', '#94a3b8', -2.95, -1.55, 0, 3.5);
  label('B–H 回线（一周/6 s）', '#22d3ee', 2.35, 2.55, 0, 2.6);
  label('H', '#f8fafc', 2.35 + PH + 0.16, 0.5, 0, 0.5);
  label('B', '#f8fafc', 2.35, 0.5 + PB + 0.16, 0, 0.5);

  // ===== 面板 =====
  const CW = 900, CH = 300;
  const infoCv = document.createElement('canvas'); infoCv.width = CW; infoCv.height = CH;
  const ic = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const panel = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  panel.scale.set(8.8, 8.8 * CH / CW, 1); panel.position.set(0, 4.95, 0); panel.renderOrder = 999;
  group.add(panel);
  const est = (t2: string, s: number): number => { let e = 0; for (const ch of t2) e += ch.charCodeAt(0) > 0x2e7f ? s : s * 0.56; return e; };
  const put = (y: number, color: string, text: string, size = 25, bold = false): void => {
    let s = size;
    while (est(text, s) > CW - 46 && s > 12) s -= 1;
    ic.fillStyle = color; ic.font = `${bold ? 'bold ' : ''}${s}px "PingFang SC", sans-serif`;
    ic.fillText(text, 22, y);
  };
  let wCycle = 0, wRun = 0;
  function drawInfo(): void {
    ic.clearRect(0, 0, CW, CH);
    ic.fillStyle = 'rgba(7,11,20,0.86)'; ic.fillRect(2, 2, CW - 4, CH - 4);
    ic.strokeStyle = '#334155'; ic.lineWidth = 3; ic.strokeRect(2, 2, CW - 4, CH - 4);
    ic.textAlign = 'left';
    const nBelow = XI.filter((x) => x <= envFrac * H_MAX).length;
    put(36, '#f8fafc', '磁滞：B=μ0(H+M)，M=(1−c)·Mirr+c·Ms·L(H/a)，L=coth x−1/x', 26, true);
    put(70, '#22d3ee', `畴开关场对数均匀分布 Xi=${XI[0].toFixed(0)}…${XI[NCOL - 1].toFixed(0)} A/m；H 越过 ±Xi 时畴壁扫过该畴（不可逆）`);
    put(100, '#a855f7', `材料常数（同一模型收敛主回线）：Br=${Br.toFixed(2)} T  Hc=${Hc.toFixed(0)} A/m  μ0Ms=${(MU0 * MS).toFixed(2)} T`);
    put(130, '#22c55e', `本圈 ∮H dB=${wCycle.toFixed(0)} J/m³ ⇒ P=f·w=${(F_CYC * wCycle).toFixed(1)} W/m³=${(F_CYC * wCycle / RHO * 1000).toFixed(2)} mW/kg（画面 ${T_CYC.toFixed(0)} s 一圈）`);
    put(160, '#f472b6', `幅度包络 Hamax=${(envFrac * H_MAX).toFixed(0)} A/m（每圈一档、10 圈一巡）：仅 ${nBelow}/${NCOL} 个畴的 Xi 被越过 ⇒ 其余畴壁钉扎，minor loop 面积急剧缩小`);
    put(190, '#94a3b8', `参考主回线面积=${W_REF.toFixed(0)} J/m³（硅钢实测约 300~700 J/m³，50 Hz ⇒ 2~4 W/kg）`);
    put(224, '#fbbf24', `读数：H=${Hnow.toFixed(0)} A/m  B=${Ban.toFixed(3)} T  M=${(Mtot / 1e6).toFixed(3)}×10⁶ A/m  已翻转畴 ${nFlip}/${NCOL}`, 25, true);
    put(262, '#fbbf24', `读数：不可逆 (1−c)Mirr=${((1 - C_REV) * Mirr / 1e6).toFixed(3)}×10⁶  可逆 cMan=${(C_REV * MS * lan(Hnow / A_LAT) / 1e6).toFixed(3)}×10⁶ A/m`, 24);
    infoTex.needsUpdate = true;
  }
  magnetics();
  drawInfo();

  let prevH = 0, prevB = bOf(0, p), phU = 0, first = true;
  wCycle = W_REF;                                     // 画面第一圈从 −Br 起恰好走完整个主回线，其面积即预卷值
  return {
    update(t, dt) {
      // 自变量：驱动场 H = Hamax·sin(φ)，φ 单调展开；幅度包络每圈取一档（10 圈一巡：主回线 → 狭小 minor loop → 主回线）
      // —— 包络在一个驱动周期内恒定，画出的回线才真正闭合，∮H dB 才等于回线包围面积
      const step = Math.min(dt, 0.05), dph = TWO_PI * step / T_CYC;
      let Hamax = H_MAX * envFrac;
      const NSUB = Math.max(8, Math.min(600, Math.ceil(Hamax * dph / H_STEP)));   // 帧内按场步长细分 ⇒ 与预卷同一分辨率
      const dphs = dph / NSUB;
      for (let j = 0; j < NSUB; j++) {
        phU += dphs;
        const ci = Math.floor(phU / TWO_PI);
        if (ci !== envCi) {
          if (!first) { wCycle = Math.abs(wRun); wRun = 0; bufH.length = 0; bufB.length = 0; }
          envCi = ci;
          envFrac = 0.02 + 0.98 * (0.5 + 0.5 * Math.cos((ci % 10) / 10 * TWO_PI));
          Hamax = H_MAX * envFrac;
          first = false;
        }
        const H = Hamax * Math.sin(phU);
        stepDomains(p, H, H - prevH);
        const B = bOf(H, p);
        wRun += ((prevH + H) / 2) * (B - prevB);
        prevH = H; prevB = B;
      }
      Hnow = prevH;
      magnetics();
      const ph = phU % TWO_PI;
      bufH.push(Hnow); bufB.push(Ban);
      if (bufH.length > NP * 2) { bufH.splice(0, bufH.length - NP); bufB.splice(0, bufB.length - NP); }
      // 试样绘制：畴宽 = 0.55+0.45|ak|（壁迁移），颜色/箭头 = 符号
      let tot = 0;
      const wts: number[] = [];
      for (let k = 0; k < NCOL; k++) { const w0 = 0.55 + 0.45 * Math.abs(p[k]); wts.push(w0); tot += w0; }
      let x = -W_SPEC / 2;
      for (let k = 0; k < NCOL; k++) {
        const wk = W_SPEC * wts[k] / tot;
        cols[k].scale.set(wk * 0.94, H_SPEC, D_SPEC);
        cols[k].position.set(x + wk / 2, 0, 0);
        walls[k].position.set(x, 0, 0);
        const al = Math.abs(p[k]);
        colMats[k].color.setHSL(p[k] > 0 ? 0.78 : 0.52, 0.62, 0.32 + 0.28 * al);
        colMats[k].emissiveIntensity = 0.15 + 0.5 * al;
        axes[k].position.set(x + wk / 2, 0, 0);
        axes[k].rotation.z = p[k] > 0 ? -Math.PI / 2 : Math.PI / 2;
        axes[k].scale.setScalar(0.5 + 0.6 * al);
        x += wk;
      }
      walls[NCOL].position.set(W_SPEC / 2, 0, 0);
      const pul = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(ph));
      yokeMat.emissiveIntensity = 0.15 + 0.8 * pul * Math.min(1, Math.abs(Hnow) / 600);
      // 回线与面积辉光（闪烁频率 ∝ 面积/损耗）
      const flash = 0.5 + 0.5 * Math.sin(t * (2.2 + 6 * Math.min(1, wCycle / 700)));
      redrawLoop(flash * Math.min(1, wCycle / 320));
      const [mx, my] = toXY(Hnow, Ban);
      mark.position.set(mx, my, 0.02);
      markMat.color.setHex(Math.abs(Hnow) > 900 ? 0xfbbf24 : 0xf472b6);
      { const ay = toXY(Hnow, MU0 * (Hnow + MS * lan(Hnow / A_LAT)))[1]; trail.position.set((Hnow / H_MAX) * PH * 0.98, ay, -0.03); }
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
