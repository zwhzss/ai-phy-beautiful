import type { SceneContext, SceneInstance } from '../types';
/**
 * 磁滞回线与磁化曲线（P492）：软磁（硅钢）与硬磁（淬火高碳钢）两条 B–H 曲线同屏对比。
 * 同一个畴系综模型驱动两种材料，只差钉扎场分布与可逆系数：
 *   ① 全场 B = μ0(H + M)
 *   ② M = (1−c)·Mirr + c·Man，Mirr = Ms·Σ pk/n（pk 为该畴翻转进度 = 畴壁位置），Man = Ms·L(H/a)，L=coth x−1/x
 *   ③ 不可逆（畴壁脱钉）：|H| 越过开关场 Xk 后该畴开始翻过去，Xk 对数均匀分布 ⇒ 中位数即矫顽力量级
 *   ④ 畴壁黏滞 dpk/dt = μw·(|H|/Xk − 1)·sign：软磁壁可动 ⇒ 先可逆弯曲（窄回线）；硬磁壁强钉扎 ⇒ 场足够大才整块跳变（宽回线）
 *   ⑤ 磁滞损耗 w = ∮H dB [J/m³]/周（格林公式：闭合一周的有符号累积恰为回线包围面积）⇒ P = f·w
 *   ⑥ 最大磁能积 (BH)max = max(B·μ0H)（硬磁品质因数）
 * 扫描自变量：H（0→Hmax 初始磁化 6 s；随后 ±Hmax 交变，16 s 一周）+ 幅度包络（20 s，0.30→1.00 ⇒ minor loop→主回线）。
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
  const lan = (x: number): number => (Math.abs(x) < 1e-6 ? x / 3 : 1 / Math.tanh(x) - 1 / x);

  /** n 个 180° 条状畴的系综；mob=0 表示瞬时跳变（强钉扎），mob>0 表示黏滞畴壁 */
  interface Core {
    Ms: number; a: number; c: number; hMax: number; xi: Float64Array; pk: Float64Array; mob: number; n: number;
    step(H: number, dt: number): { M: number; B: number; nFlip: number };
  }
  function makeCore(Ms: number, a: number, c: number, n: number, xiMed: number, lnW: number, hMax: number, mob: number): Core {
    const xi = new Float64Array(n), pk = new Float64Array(n).fill(-1);
    for (let k = 0; k < n; k++) xi[k] = xiMed * Math.exp(lnW * ((k + 0.5) / n - 0.5));
    return {
      Ms, a, c, hMax, xi, pk, mob, n,
      step(H: number, dt: number) {
        let acc = 0, nf = 0;
        for (let k = 0; k < n; k++) {
          if (Math.abs(H) >= xi[k]) {
            const tgt = H > 0 ? 1 : -1;
            if (mob === 0) pk[k] = tgt;
            else pk[k] += Math.sign(tgt - pk[k]) * Math.min(Math.abs(tgt - pk[k]), mob * (Math.abs(H) / xi[k] - 1) * dt);
          }
          acc += pk[k] / n; if (pk[k] > 0) nf++;
        }
        const M = (1 - c) * Ms * acc + c * Ms * lan(H / a);
        return { M, B: MU0 * (H + M), nFlip: nf };
      },
    };
  }
  // 参数由 _scratch/agentA/hloop.mjs 校核（同一算法跑出的收敛主回线）：
  //   软 硅钢        Br=1.709 T  Hc=31 A/m   w=∮H dB=367 J/m³ ⇒ 2.40 W/kg@50 Hz（解析 4μ0(1−c)Ms⟨X⟩=320）
  //   硬 淬火高碳钢  Br=1.240 T  Hc=91 kA/m  w=398.5 kJ/m³  (BH)max=20.4 kJ/m³（文献 10~40 kJ/m³）
  //   损耗比 硬/软=1.1×10³、Hc 比=2.9×10³ ⇒ 与教科书「软磁窄、硬磁宽」一致
  const SOFT = makeCore(1.7e6, 55, 0.2, 9, 26, 4, 2000, 400);
  const HARD = makeCore(1.05e6, 2e4, 0.06, 7, 90000, 3, 300000, 0);
  const DT_EQ = 16 / (2 * 900);                       // 参考回线：与画面 16 s 一周等价的每步时长
  const demag = (core: Core): void => { for (let k = 0; k < core.n; k++) core.pk[k] = k % 2 ? 1 : -1; };

  interface Ref { Br: number; Hc: number; W: number; bh: number; }
  function converge(core: Core): Ref {
    const n = 900, dH = (2 * core.hMax) / n;
    let Br = 0, Hc = 0, W = 0, bh = 0;
    for (let cyc = 0; cyc < 4; cyc++) {
      demag(core);
      let Hprev = 0, Bprev = 0, first = true, signed = 0;
      for (const dir of [1, -1]) {
        let H = dir > 0 ? -core.hMax : core.hMax;
        for (let i = 0; i < n; i++) {
          const r = core.step(H, DT_EQ);
          if (!first && cyc === 3) {
            signed += ((H + Hprev) / 2) * (r.B - Bprev);                  // ∮H dB（对 B 取增量 ⇒ 闭周=包围面积）
            if (r.B > 0 && H < 0) bh = Math.max(bh, r.B * -H);             // (BH)max 只取第二象限退磁曲线
            if (Math.abs(H) <= dH && Math.abs(r.B) > Br) Br = Math.abs(r.B);
            if (dir > 0 && Bprev < 0 && r.B >= 0 && H > 0) Hc = H;         // 上升支 B 过零 ⇒ 矫顽力
          }
          Hprev = H; Bprev = r.B; first = false;
          H += dir * dH;
        }
      }
      W = Math.abs(signed);
    }
    return { Br, Hc, W, bh };
  }
  const REFS = converge(SOFT), REFH = converge(HARD);

  // 初始磁化曲线（退磁态单调 H: 0→Hmax，拟静态）
  function initialCurve(core: Core): number[] {
    demag(core);
    const out: number[] = [], n = 200, dt = 6 / n;
    for (let i = 0; i <= n; i++) out.push(core.step((i / n) * core.hMax, dt).B / (MU0 * core.Ms * 1.02));
    return out;
  }
  const IMC_S = initialCurve(SOFT), IMC_H = initialCurve(HARD);

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
  grid.position.y = -3.2;
  group.add(grid);

  // ===== 两个「试样 + 曲线」单元 =====
  const PH = 1.55, PB = 1.35, NP = 900;
  interface Unit {
    core: Core; ref: Ref; bMax: number;
    cols: import('three').Mesh[]; colMats: import('three').MeshStandardMaterial[]; walls: import('three').Mesh[];
    coilMat: import('three').MeshStandardMaterial;
    loopGeo: import('three').BufferGeometry; loopPos: Float32Array; loopCol: Float32Array;
    fanGeo: import('three').BufferGeometry; fanPos: Float32Array; fanMat: import('three').MeshBasicMaterial;
    mark: import('three').Mesh; bodyMat: import('three').MeshStandardMaterial;
    bufH: number[]; bufB: number[]; wRun: number; wCycle: number; last: [number, number] | null;
    Hnow: number; Bnow: number; Mnow: number; nFlip: number;
  }
  function makeUnit(x: number, core: Core, ref: Ref, imc: number[], color: number): Unit {
    const plot = new THREE.Group(); plot.position.set(x, 1.0, 0); group.add(plot);
    const axGeo = geo(new THREE.BufferGeometry());
    axGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-PH, 0, 0, PH, 0, 0, 0, -PB, 0, 0, PB, 0]), 3));
    plot.add(new THREE.LineSegments(axGeo, mat(new THREE.LineBasicMaterial({ color: 0x64748b }))));
    const tk = geo(new THREE.BufferGeometry());
    {
      const v: number[] = [];
      for (let i = -4; i <= 4; i++) if (i) v.push((i * PH) / 4, -0.05, 0, (i * PH) / 4, 0.05, 0);
      for (let i = -3; i <= 3; i++) if (i) v.push(-0.05, (i * PB) / 3, 0, 0.05, (i * PB) / 3, 0);
      tk.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
      tk.setDrawRange(0, v.length / 3);
    }
    plot.add(new THREE.LineSegments(tk, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));
    // 初始磁化曲线（单值 M(H)）
    const imcGeo = geo(new THREE.BufferGeometry());
    const imcPos = new Float32Array(imc.length * 2 * 3);
    const L = imc.length;
    for (let i = 0; i < L; i++) {
      const fr = (L - 1 - i) / (L - 1);               // 负半支：自 −Hmax 升到 0
      imcPos[i * 3] = -fr * PH * 0.98; imcPos[i * 3 + 1] = -imc[L - 1 - i] * PB * 0.98; imcPos[i * 3 + 2] = -0.01;
      const fr2 = i / (L - 1);                        // 正半支：自 0 升到 +Hmax
      imcPos[(L + i) * 3] = fr2 * PH * 0.98; imcPos[(L + i) * 3 + 1] = imc[i] * PB * 0.98; imcPos[(L + i) * 3 + 2] = -0.01;
    }
    imcGeo.setAttribute('position', new THREE.BufferAttribute(imcPos, 3));
    imcGeo.setDrawRange(0, L * 2);
    plot.add(new THREE.Line(imcGeo, mat(new THREE.LineBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.5 }))));

    const loopGeo = geo(new THREE.BufferGeometry());
    const loopPos = new Float32Array(NP * 3), loopCol = new Float32Array(NP * 3);
    loopGeo.setAttribute('position', new THREE.BufferAttribute(loopPos, 3));
    loopGeo.setAttribute('color', new THREE.BufferAttribute(loopCol, 3));
    loopGeo.setDrawRange(0, 0);
    plot.add(new THREE.Line(loopGeo, mat(new THREE.LineBasicMaterial({ vertexColors: true }))));
    const fanGeo = geo(new THREE.BufferGeometry());
    const fanPos = new Float32Array((NP + 1) * 3);
    fanGeo.setAttribute('position', new THREE.BufferAttribute(fanPos, 3));
    fanGeo.setDrawRange(0, 0);
    const fanMat = mat(new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.15, side: THREE.DoubleSide }));
    plot.add(new THREE.Mesh(fanGeo, fanMat));
    const mark = new THREE.Mesh(geo(new THREE.SphereGeometry(0.085, 12, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
    plot.add(mark);

    // 试样：条状畴 + 畴壁 + 磁化线圈 + 发热外壳
    const body = new THREE.Group(); body.position.set(x, -1.9, 0); group.add(body);
    const n = core.n, WS = 2.3, HS = 0.78, DS = 0.72;
    const boxGeo = geo(new THREE.BoxGeometry(1, 1, 1));
    const cols: import('three').Mesh[] = [], colMats: import('three').MeshStandardMaterial[] = [];
    for (let k = 0; k < n; k++) {
      const m = mat(new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.45, emissive: color, emissiveIntensity: 0.2 }));
      const c = new THREE.Mesh(boxGeo, m); body.add(c); cols.push(c); colMats.push(m);
    }
    const wallGeo = geo(new THREE.BoxGeometry(0.028, HS * 1.02, DS * 1.02));
    const walls: import('three').Mesh[] = [];
    for (let k = 0; k <= n; k++) {
      const w = new THREE.Mesh(wallGeo, mat(new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.8 })));
      body.add(w); walls.push(w);
    }
    const coilMat = mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.4, emissive: 0x22d3ee, emissiveIntensity: 0.1 }));
    const coilGeo = geo(new THREE.TorusGeometry(0.72, 0.045, 6, 22));
    for (let k = 0; k < 4; k++) {
      const r = new THREE.Mesh(coilGeo, coilMat);
      r.rotation.y = Math.PI / 2; r.position.set(-0.85 + k * 0.57, 0, 0);
      body.add(r);
    }
    const bodyMat = mat(new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.25, roughness: 0.85, transparent: true, opacity: 0.38 }));
    body.add(new THREE.Mesh(geo(new THREE.BoxGeometry(WS + 0.07, HS + 0.07, DS + 0.07)), bodyMat));
    return {
      core, ref, bMax: MU0 * core.Ms * 1.02, cols, colMats, walls, coilMat,
      loopGeo, loopPos, loopCol, fanGeo, fanPos, fanMat, mark, bodyMat,
      bufH: [], bufB: [], wRun: 0, wCycle: 0, last: null, Hnow: 0, Bnow: 0, Mnow: 0, nFlip: 0,
    };
  }
  const US = makeUnit(-2.5, SOFT, REFS, IMC_S, 0x22c55e);
  const UH = makeUnit(2.5, HARD, REFH, IMC_H, 0xa855f7);

  const C_UP = new THREE.Color(0x22d3ee), C_DN = new THREE.Color(0xfbbf24), C_HOT = new THREE.Color(0xef4444);
  function draw(u: Unit, flash: number): void {
    const n = Math.min(NP, u.bufH.length);
    let ch = 0, cb = 0;
    for (let i = u.bufH.length - n; i < u.bufH.length; i++) { ch += u.bufH[i]; cb += u.bufB[i]; }
    u.fanPos[0] = (ch / n / u.core.hMax) * PH * 0.98;
    u.fanPos[1] = (cb / n / u.bMax) * PB * 0.98;
    u.fanPos[2] = 0;
    for (let i = 0; i < n; i++) {
      const idx = u.bufH.length - n + i;
      const px = (u.bufH[idx] / u.core.hMax) * PH * 0.98, py = (u.bufB[idx] / u.bMax) * PB * 0.98;
      u.loopPos[i * 3] = px; u.loopPos[i * 3 + 1] = py; u.loopPos[i * 3 + 2] = 0;
      const age = i / n;
      u.loopCol[i * 3] = 0.15 + 0.8 * age; u.loopCol[i * 3 + 1] = 0.82 - 0.25 * age; u.loopCol[i * 3 + 2] = 0.94;
      u.fanPos[(i + 1) * 3] = px; u.fanPos[(i + 1) * 3 + 1] = py; u.fanPos[(i + 1) * 3 + 2] = 0;
    }
    u.loopGeo.attributes['position'].needsUpdate = true;
    u.loopGeo.attributes['color'].needsUpdate = true;
    u.loopGeo.setDrawRange(0, n);
    u.fanGeo.attributes['position'].needsUpdate = true;
    u.fanGeo.setDrawRange(0, n + 1);
    u.fanMat.opacity = 0.05 + 0.42 * flash;
    u.mark.position.set((u.Hnow / u.core.hMax) * PH * 0.98, (u.Bnow / u.bMax) * PB * 0.98, 0.02);
  }

  // ===== 标签 =====
  function label(text: string, color: string, x: number, y: number, w = 2.6): void {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 24px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(w, w / 8, 1); s.position.set(x, y, 0); s.renderOrder = 997;
    group.add(s);
  }
  label('软磁 硅钢片：畴壁易动 ⇒ 窄回线', '#22c55e', -2.5, 3.05, 3.0);
  label('硬磁 淬火高碳钢：畴壁强钉扎 ⇒ 宽回线', '#a855f7', 2.5, 3.05, 3.2);
  label(`H 轴 ±${SOFT.hMax} A/m`, '#94a3b8', -2.5, -3.0, 1.9);
  label(`H 轴 ±${(HARD.hMax / 1000).toFixed(0)} kA/m`, '#94a3b8', 2.5, -3.0, 1.9);
  label('白线 = 初始磁化曲线（硬磁逐级跳变/Barkhausen 台阶）', '#f8fafc', 0, -3.6, 5.2);

  // ===== 面板 =====
  const CW = 900, CH = 300;
  const infoCv = document.createElement('canvas'); infoCv.width = CW; infoCv.height = CH;
  const ic = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const panel = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  panel.scale.set(8.8, (8.8 * CH) / CW, 1); panel.position.set(0, 5.05, 0); panel.renderOrder = 999;
  group.add(panel);
  const est = (s2: string, px: number): number => { let e = 0; for (const ch of s2) e += ch.charCodeAt(0) > 0x2e7f ? px : px * 0.56; return e; };
  const put = (y: number, color: string, text: string, size = 24, bold = false): void => {
    let s = size;
    while (est(text, s) > CW - 44 && s > 11) s -= 1;
    ic.fillStyle = color; ic.font = `${bold ? 'bold ' : ''}${s}px "PingFang SC", sans-serif`;
    ic.fillText(text, 20, y);
  };
  let envFrac = 1, mode = '';
  function drawInfo(): void {
    ic.clearRect(0, 0, CW, CH);
    ic.fillStyle = 'rgba(7,11,20,0.86)'; ic.fillRect(2, 2, CW - 4, CH - 4);
    ic.strokeStyle = '#334155'; ic.lineWidth = 3; ic.strokeRect(2, 2, CW - 4, CH - 4);
    ic.textAlign = 'left';
    put(30, '#f8fafc', 'B=μ0(H+M)，M=(1−c)MsΣpk/n + c·Ms·L(H/a)', 25, true);
    put(60, '#22d3ee', `软 硅钢：Br=${REFS.Br.toFixed(2)} T  Hc=${REFS.Hc.toFixed(0)} A/m  回线面积=${REFS.W.toFixed(0)} J/m³`);
    put(87, '#a855f7', `硬 淬火钢：Br=${REFH.Br.toFixed(2)} T  Hc=${(REFH.Hc / 1000).toFixed(1)} kA/m  回线面积=${(REFH.W / 1000).toFixed(1)} kJ/m³`);
    put(114, '#22c55e', `损耗比 硬/软=${(REFH.W / Math.max(1, REFS.W)).toFixed(0)}×，Hc 比=${(REFH.Hc / Math.max(1, REFS.Hc)).toFixed(0)}× ⇒ 软磁作铁芯、硬磁作永磁体`);
    put(141, '#f472b6', `最大磁能积 (BH)max：软=${(REFS.bh / 1000).toFixed(2)} kJ/m³  硬=${(REFH.bh / 1000).toFixed(1)} kJ/m³`);
    put(168, '#22d3ee', `幅度包络=${(envFrac * 100).toFixed(0)}%（20 s 扫）：包络低于开关场 ⇒ 畴壁只弹性弯曲 ⇒ minor loop 变窄、发热减弱`);
    put(200, '#fbbf24', `读数：H软=${US.Hnow.toFixed(0)} A/m  B软=${US.Bnow.toFixed(3)} T  已翻畴 ${US.nFlip}/${SOFT.n}  本周 w=${US.wCycle.toFixed(0)} J/m³`, 23, true);
    put(229, '#fbbf24', `读数：H硬=${(UH.Hnow / 1000).toFixed(1)} kA/m  B硬=${UH.Bnow.toFixed(3)} T  已翻畴 ${UH.nFlip}/${HARD.n}  本周 w=${(UH.wCycle / 1000).toFixed(1)} kJ/m³`, 23, true);
    put(262, '#94a3b8', `${mode}；∮H dB 有符号累积 软=${US.wRun.toFixed(0)} J/m³（闭合时=面积）`, 22);
    infoTex.needsUpdate = true;
  }
  demag(SOFT); demag(HARD);
  drawInfo();

  let phasePrev = 0, phPrev = 0;
  function reset(u: Unit): void { u.bufH.length = 0; u.bufB.length = 0; u.wRun = 0; u.wCycle = 0; u.last = null; }
  function feed(u: Unit, H: number, dt: number): void {
    const r = u.core.step(H, dt);
    u.Hnow = H; u.Bnow = r.B; u.Mnow = r.M; u.nFlip = r.nFlip;
    if (u.last) u.wRun += ((H + u.last[0]) / 2) * (r.B - u.last[1]);   // ∮H dB 有符号累积
    u.last = [H, r.B];
    u.bufH.push(H); u.bufB.push(r.B);
    if (u.bufH.length > NP * 2) { u.bufH.splice(0, u.bufH.length - NP); u.bufB.splice(0, u.bufB.length - NP); }
  }
  function setStrip(u: Unit): void {
    const n = u.core.n, pk = u.core.pk, WS = 2.3, HS = 0.78, DS = 0.72;
    let tot = 0; const wts: number[] = [];
    for (let k = 0; k < n; k++) { const w0 = 0.5 + 0.5 * Math.abs(pk[k]); wts.push(w0); tot += w0; }
    let x = -WS / 2;
    for (let k = 0; k < n; k++) {
      const wk = (WS * wts[k]) / tot;
      u.cols[k].scale.set(wk * 0.93, HS, DS);
      u.cols[k].position.set(x + wk / 2, 0, 0);
      u.walls[k].position.set(x, 0, 0);
      u.colMats[k].emissiveIntensity = 0.1 + 0.6 * Math.abs(pk[k]);
      u.colMats[k].color.setRGB(0.06, 0.09, 0.12).lerp(pk[k] > 0 ? C_UP : C_DN, 0.15 + 0.75 * Math.abs(pk[k]));
      x += wk;
    }
    u.walls[n].position.set(WS / 2, 0, 0);
  }

  return {
    update(t, dt) {
      const dts = Math.min(0.05, dt);
      const T = t % 36;
      const phase = T < 6 ? 1 : 2;
      let Hs: number, Hh: number;
      if (phase !== phasePrev) {
        phasePrev = phase;
        phPrev = 0;
        reset(US); reset(UH);
        if (phase === 1) { demag(SOFT); demag(HARD); }      // 回到退磁态：多畴 50/50 ⇒ M≈0
      }
      if (phase === 1) {
        mode = '阶段一：初始磁化曲线 0→Hmax（6 s 单调升）';
        const fr = T / 6;
        Hs = fr * SOFT.hMax; Hh = fr * HARD.hMax;
      } else {
        mode = '阶段二：交变磁化 16 s 一周';
        const env = 0.30 + 0.70 * (0.5 - 0.5 * Math.cos(((t % 20) / 20) * TWO_PI));
        envFrac = env;
        const ph = (((T - 6) % 16) / 16) * TWO_PI;
        if (ph < phPrev) { US.wCycle = Math.abs(US.wRun); UH.wCycle = Math.abs(UH.wRun); reset(US); reset(UH); }
        phPrev = ph;
        Hs = env * SOFT.hMax * Math.cos(ph);
        Hh = env * HARD.hMax * Math.cos(ph);
      }
      feed(US, Hs, dts);
      feed(UH, Hh, dts);
      setStrip(US); setStrip(UH);
      const glow = (u: Unit, ref: Ref) => Math.min(1, u.wCycle / Math.max(1, ref.W));
      const fl = 0.5 + 0.5 * Math.sin(t * (2.4 + 3 * glow(UH, REFH)));
      const g1 = glow(US, REFS), g2 = glow(UH, REFH);
      US.bodyMat.color.setRGB(0.1, 0.13, 0.16).lerp(C_HOT, 0.7 * g1 * fl);
      UH.bodyMat.color.setRGB(0.1, 0.1, 0.14).lerp(C_HOT, 0.9 * g2 * fl);
      US.coilMat.emissiveIntensity = 0.1 + 1.1 * Math.min(1, Math.abs(US.Hnow) / 600);
      UH.coilMat.emissiveIntensity = 0.1 + 1.1 * Math.min(1, Math.abs(UH.Hnow) / 90000);
      draw(US, fl * g1);
      draw(UH, fl * g2);
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
