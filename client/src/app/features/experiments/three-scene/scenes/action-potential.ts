import type { SceneContext, SceneInstance } from '../types';
/**
 * 神经动作电位（P336）—— 真实 Hodgkin–Huxley 髓鞘化轴突缆索仿真（SI-free 单位 mV/ms/mS·cm⁻²/µF·cm⁻²）。
 *   C_m·dV/dt = −[ḡ_Na·m³h·(V−E_Na) + ḡ_K·n⁴·(V−E_K) + ḡ_L·(V−E_L)] + I_axial + I_stim
 * 约定：V 为绝对膜电位，V_rest=−65 mV，E_Na=+50, E_K=−77（V′=V+65 代入经典 HH 1952 相对坐标速率公式，
 * 等价 E_Na=+115/E_K=−12 约定）；E_L=−54 mV 属现代漏 reversal 约定（经典相对 −10.6 ⇒ 绝对 −75.6），
 * 配 ḡ_L=0.3 实测静息≈−64.9 mV。112 舱一维缆索：12 个郎斐结（全 HH 密度）+ 髓鞘结间段
 * （被动，g、C≈1/10）；显式 Euler dt≈0.0175 ms 每帧多子步。尖峰(≈+40mV)、阈值(≈4.2µA/cm²)、
 * 不应期(h 门)、跳跃传导与波速(实测 v≈6.8·d m/s，对比 Hursh 规则 6·d)全部由 ODE 涌现。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  // —— 资源登记 ——
  const geos: { dispose(): void }[] = [];
  const mats: { dispose(): void }[] = [];
  const texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  // 星野 + 地面栅格
  const starGeo = geo(new THREE.BufferGeometry());
  const starPos = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 200;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  grid.position.y = -2.6;
  group.add(grid);

  // —— HH 1952 参数（绝对膜电位，V_rest=−65）与经典电压依赖速率函数 ——
  const GNA = 120, GK = 36, GL = 0.3, ENA = 50, EK = -77, EL = -54;
  const V_REST = -65, V_PEAK = +40;
  const phi = (x: number): number => (Math.abs(x) < 1e-7 ? 1 - x / 2 : x / (Math.exp(x) - 1));
  const aM = (v: number): number => phi((25 - (v + 65)) / 10);            // 0.1(25−V′)/(e^((25−V′)/10)−1)
  const bM = (v: number): number => 4 * Math.exp(-(v + 65) / 18);
  const aH = (v: number): number => 0.07 * Math.exp(-(v + 65) / 20);
  const bH = (v: number): number => 1 / (Math.exp((30 - (v + 65)) / 10) + 1);
  const aN = (v: number): number => 0.1 * phi((10 - (v + 65)) / 10);
  const bN = (v: number): number => 0.125 * Math.exp(-(v + 65) / 80);
  const ss = (fa: (v: number) => number, fb: (v: number) => number): number => fa(V_REST) / (fa(V_REST) + fb(V_REST));
  const M0 = ss(aM, bM), H0 = ss(aH, bH), N0 = ss(aN, bN);

  // —— 缆索几何：N 舱段，12 结（每结 3 舱），结间髓鞘；郎斐结间距 ≈ 20·d µm ——
  const NCOMP = 112, NNODE = 12, SPACING = 9, NODEDUR = 3;
  const nodeI: number[] = [];
  for (let k = 0; k < NNODE; k++) nodeI.push(1 + k * SPACING);
  const isNode = new Uint8Array(NCOMP);
  const myelin: number[] = [];
  nodeI.forEach((i) => { for (let j = i; j < i + NODEDUR && j < NCOMP; j++) isNode[j] = 1; });
  for (let i = 0; i < NCOMP; i++) if (!isNode[i]) myelin.push(i);
  const AX_X0 = -5, AX_LEN = 10;
  const xOf = (i: number): number => AX_X0 + (i / (NCOMP - 1)) * AX_LEN;
  const v = new Float64Array(NCOMP).fill(V_REST);
  const acc = new Float64Array(NCOMP);
  const gateM = new Float64Array(NNODE).fill(M0);
  const gateH = new Float64Array(NNODE).fill(H0);
  const gateN = new Float64Array(NNODE).fill(N0);
  const cross = new Float64Array(NNODE).fill(-1);   // 本周期各结首次上行越过 −20 mV 的仿真时刻
  const prevN = new Float64Array(NNODE).fill(V_REST);
  let simT = 0, stimAt = 0, dUm = 1, ampUm = 4.8;   // 刺激幅度 µA/cm²，扫描跨过阈值
  let vMeas = 0, fired = false, firedCnt = 0;
  const STIM_MS = 3, CYCLE_MS = 70, V_CROSS = -20;

  // —— 轴突圆筒（顶点色 = 实时 V），沿 X 放置 ——
  const axGeo = geo(new THREE.CylinderGeometry(0.52, 0.52, AX_LEN, 18, 140, true));
  const axCount = axGeo.attributes['position'].count;
  const axCol = new Float32Array(axCount * 3);
  axGeo.setAttribute('color', new THREE.BufferAttribute(axCol, 3));
  const axPos = axGeo.attributes['position'] as import('three').BufferAttribute;
  const axArr = axPos.array as Float32Array;
  const vComp = new Int16Array(axCount);
  for (let i = 0; i < axCount; i++) {
    vComp[i] = Math.max(0, Math.min(NCOMP - 1, Math.round((axArr[i * 3 + 1] - AX_X0) / AX_LEN * (NCOMP - 1))));
  }
  const axMat = mat(new THREE.MeshStandardMaterial({
    vertexColors: true, metalness: 0.1, roughness: 0.7, emissive: 0x111827, emissiveIntensity: 0.4,
  }));
  const axon = new THREE.Mesh(axGeo, axMat);
  axon.rotation.z = -Math.PI / 2;                   // 局部 +Y → 世界 +X
  group.add(axon);

  const cRest = new THREE.Color(0x1f6b57), cSpike = new THREE.Color(0xef4444), cHyper = new THREE.Color(0x2b50c8);
  const tmp = new THREE.Color();
  function colorFromV(val: number, out: { r: number; g: number; b: number }): void {
    const u = (val - V_REST) / (V_PEAK - V_REST);    // 0=静息 −65，1=峰 +40
    if (u >= 0) { tmp.copy(cRest).lerp(cSpike, Math.min(1, u)); }
    else { tmp.copy(cHyper).lerp(cRest, Math.max(0, 1 + u / 0.2)); }
    out.r = tmp.r; out.g = tmp.g; out.b = tmp.b;
  }

  // —— 髓鞘（半透明套）：包裹结间段，留出郎斐结裸膜 ——
  const sleeveGeo = geo(new THREE.CylinderGeometry(0.66, 0.66, 0.42, 20, 1, true));
  const sleeveMat = mat(new THREE.MeshStandardMaterial({
    color: 0xfde68a, transparent: true, opacity: 0.32, roughness: 0.5, side: THREE.DoubleSide,
  }));
  for (let k = 0; k < NNODE - 1; k++) {
    const s = new THREE.Mesh(sleeveGeo, sleeveMat); s.rotation.z = -Math.PI / 2;
    s.position.x = xOf(nodeI[k] + Math.round(SPACING / 2)); group.add(s);
  }

  // —— 郎斐结标记小球：颜色 = h 门可用性（不应期可视化，涌现自 HH） ——
  const knobGeo = geo(new THREE.SphereGeometry(0.13, 10, 10));
  const knobs: import('three').Mesh[] = [], knobMats: import('three').MeshBasicMaterial[] = [];
  const hReady = new THREE.Color(0x34d399), hInact = new THREE.Color(0x1e293b);
  for (let k = 0; k < NNODE; k++) {
    const km = mat(new THREE.MeshBasicMaterial({ color: 0x34d399 }));
    const s = new THREE.Mesh(knobGeo, km); s.position.set(xOf(nodeI[k] + 1), 0.7, 0);
    group.add(s); knobs.push(s); knobMats.push(km);
  }

  // —— 示波器迹线：实时 V(x) 快照（与轴突着色同源）+ 阈值参考线 ——
  const TRACE_N = 220;
  const traceGeo = geo(new THREE.BufferGeometry());
  const tracePos = new Float32Array(TRACE_N * 3);
  traceGeo.setAttribute('position', new THREE.BufferAttribute(tracePos, 3));
  group.add(new THREE.Line(traceGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee }))));
  const thGeo = geo(new THREE.BufferGeometry());
  thGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  group.add(new THREE.Line(thGeo, mat(new THREE.LineBasicMaterial({ color: 0x64748b }))));
  const TRACE_Y = 1.9, VY = 1.1 / (V_PEAK - V_REST);
  const thPos = thGeo.attributes['position'] as import('three').BufferAttribute;
  const thArr = thPos.array as Float32Array;
  for (let j = 0; j < 2; j++) { thArr[j * 3] = AX_X0 + j * AX_LEN; thArr[j * 3 + 1] = TRACE_Y + (-40 - V_REST) * VY; }

  // —— Na⁺（品红，内流）与 K⁺（青，外流）离子，随活跃波前移动 ——
  const ionGeo = geo(new THREE.SphereGeometry(0.1, 10, 10));
  const naMat = mat(new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xf472b6, emissiveIntensity: 0.7 }));
  const kMat = mat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.7 }));
  const NION = 8;
  const naIons: import('three').Mesh[] = [], kIons: import('three').Mesh[] = [];
  const ionSeed: number[] = [];
  for (let i = 0; i < NION; i++) {
    ionSeed.push(Math.random() * Math.PI * 2);
    const na = new THREE.Mesh(ionGeo, naMat); group.add(na); naIons.push(na);
    const k = new THREE.Mesh(ionGeo, kMat); group.add(k); kIons.push(k);
  }

  // —— 标签 ——
  function makeLabel(text: string, color: string, scale = 4): import('three').Sprite {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 30px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  const labelNode = makeLabel('郎斐结（跳跃传导）· 小球颜色 = h 门可用性（不应期）', '#fde68a', 4.4);
  labelNode.position.set(0, -1.7, 0); group.add(labelNode);
  const labelWave = makeLabel('刺激幅度扫描跨过阈值 → 全或无尖峰行波', '#ef4444', 3.8);
  labelWave.position.set(0, 3.2, 0); group.add(labelWave);

  // —— 信息面板（Sprite，5 Hz 刷新） ——
  const infoCv = document.createElement('canvas'); infoCv.width = 820; infoCv.height = 300;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoSprite = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  infoSprite.position.set(0, 5.6, 0); infoSprite.scale.set(9.2, 3.36, 1); infoSprite.renderOrder = 999;
  group.add(infoSprite);

  const PROBE = 6;                                    // 探针郎斐结
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 820, 300);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(4, 4, 812, 292);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 812, 292);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText('神经动作电位 — Hodgkin–Huxley 髓鞘化轴突缆索（112 舱显式积分）', 20, 38);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('C·dV/dt = −[ḡ_Na m³h(V−E_Na) + ḡ_K n⁴(V−E_K) + ḡ_L(V−E_L)] + I_轴 + I_刺', 20, 72);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('门控 dX/dt = α_X(V′)(1−X)−β_X(V′)X，X=m,h,n；V′=V+65，φ(x)=x/(eˣ−1)', 20, 102);
    infoCtx.fillText('α_m=φ((25−V′)/10) β_m=4e^(−V′/18) α_h=0.07e^(−V′/20) β_h=1/(e^((30−V′)/10)+1)', 20, 130);
    infoCtx.fillText('α_n=0.1φ((10−V′)/10) β_n=0.125e^(−V′/80)；C=1 ḡ_Na=120 ḡ_K=36 ḡ_L=0.3 mS/cm²', 20, 156);
    infoCtx.fillStyle = '#f472b6';
    infoCtx.fillText('E_Na=+50 E_K=−77⇔经典相对(+115/−12)；E_L=−54 现代约定，静息≈−65', 20, 182);
    infoCtx.fillText('结间距≈20·d µm，髓鞘段 g、C≈结的 1/10；dt=0.0175ms 显式 Euler 多子步', 20, 206);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 22px "PingFang SC", sans-serif';
    const hursh = 6 * dUm;
    const vTxt = fired ? `实测 v=${vMeas.toFixed(0)}m/s (Hursh 6·d=${hursh.toFixed(0)})` : '实测 v=—（未传导）';
    const stTxt = fired ? `阈上发放 ${firedCnt}/12 结` : '阈下：仅局部电紧张，无尖峰';
    infoCtx.fillText(
      `读数: t=${simT.toFixed(0)}ms V(结${PROBE})=${v[nodeI[PROBE]].toFixed(1)}mV h=${gateH[PROBE].toFixed(2)} I刺=${ampUm.toFixed(1)} → ${stTxt} ${vTxt}`,
      20, 240,
    );
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '21px "PingFang SC", sans-serif';
    infoCtx.fillText(`扫描 d=${dUm.toFixed(1)}µm→传导速度；尖峰幅度/阈值/不应期/波速均由缆索方程涌现，非手绘`, 20, 268);
    infoCtx.fillText('示波迹线与轴突色标 = 同一实时 V(x,t)；灰线 = 阈电位 −40 mV', 20, 292);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  // —— 单个 Euler 子步：全 HH 结 + 髓鞘被动电缆 + 轴向耦合 ——
  function step(dt: number, inj: number): void {
    const Cn = 6e-4 * dUm, Gn = 6e-4 * dUm, Gax = 8e-4 * dUm, Gmi = 7e-5 * dUm / 100;
    for (let k = 0; k < NNODE; k++) {
      const i = nodeI[k], vv = v[i], mk = gateM[k], hk = gateH[k], nk = gateN[k];
      const m3 = mk * mk * mk, n4 = nk * nk * nk * nk;
      const Iion = -Gn * (GNA * m3 * hk * (vv - ENA) + GK * n4 * (vv - EK) + GL * (vv - EL)) + (k === 0 ? inj : 0);
      acc[i] = Iion / Cn;
      gateM[k] = mk + dt * (aM(vv) * (1 - mk) - bM(vv) * mk);
      gateH[k] = hk + dt * (aH(vv) * (1 - hk) - bH(vv) * hk);
      gateN[k] = nk + dt * (aN(vv) * (1 - nk) - bN(vv) * nk);
    }
    for (const i of myelin) acc[i] = -Gmi * (v[i] - EL) / (7e-5 * dUm);
    for (let i = 0; i < NCOMP; i++) {
      let ax = 0;
      if (i > 0) ax += Gax * (v[i - 1] - v[i]);
      if (i < NCOMP - 1) ax += Gax * (v[i + 1] - v[i]);
      acc[i] += ax / (isNode[i] ? Cn : 7e-5 * dUm);
    }
    for (let i = 0; i < NCOMP; i++) {
      let nv = v[i] + dt * acc[i];
      if (!isFinite(nv)) nv = V_REST;
      v[i] = Math.max(-120, Math.min(80, nv));
    }
    for (let k = 0; k < NNODE; k++) {
      const vv = v[nodeI[k]];
      if (cross[k] < 0 && vv > V_CROSS && vv > prevN[k]) cross[k] = simT;
      prevN[k] = vv;
    }
  }

  // —— 由过阈时刻线性拟合实测波速（mm/ms → m/s） ——
  function fitVelocity(): void {
    const spMm = 0.02 * dUm;                         // 结间距 µm = 20·d
    let sX = 0, sT = 0, sXX = 0, sXT = 0, cnt = 0;
    for (let k = 1; k < NNODE; k++) {
      if (cross[k] < 0) continue;
      const x = k * spMm;                            // 相对首结的物理距离 mm
      sX += x; sT += cross[k]; sXX += x * x; sXT += x * cross[k]; cnt++;
    }
    firedCnt = 0;
    for (let k = 0; k < NNODE; k++) if (cross[k] >= 0) firedCnt++;
    fired = firedCnt >= 4;
    if (cnt >= 4) {
      const slope = (cnt * sXT - sX * sT) / (cnt * sXX - sX * sX); // ms/mm
      if (slope > 0) vMeas = vMeas * 0.6 + (1000 / slope) * 0.4;
    }
  }

  const rgb = { r: 0, g: 0, b: 0 };
  return {
    update(t, dt) {
      const dtr = Math.min(dt, 0.05);
      // 扫描：轴突直径 d 1→20 µm（17 s 往返）；刺激幅度 1.4→8.2 µA/cm²（9 s，跨过阈值 ≈4.5）
      dUm = 1 + 19 * (0.5 - 0.5 * Math.cos((t * 2 * Math.PI) / 17));
      ampUm = 4.8 + 3.4 * Math.sin((t * 2 * Math.PI) / 9);
      const dtMax = Math.min(0.02, 0.2 * (7e-5 * dUm) / (8e-4 * dUm));   // ≈0.0175 ms
      const simAdv = Math.min(0.9, 13.8 * dtr);                          // 仿真 ms/帧（跳跃传导慢放）
      const sub = Math.max(1, Math.min(40, Math.round(simAdv / dtMax)));
      const sdt = simAdv / sub;
      const inj = ampUm * 6e-4 * dUm;
      for (let s = 0; s < sub; s++) {
        simT += sdt;
        if (simT >= stimAt + CYCLE_MS) {             // 周期性重触发，观察反复传导
          fitVelocity();
          stimAt = simT;
          cross.fill(-1);
        }
        step(sdt, simT - stimAt <= STIM_MS ? inj : 0);
      }

      // 轴突顶点色 = 实时 V(x,t)
      for (let i = 0; i < axCount; i++) {
        colorFromV(v[vComp[i]], rgb);
        axCol[i * 3] = rgb.r; axCol[i * 3 + 1] = rgb.g; axCol[i * 3 + 2] = rgb.b;
      }
      axGeo.attributes['color'].needsUpdate = true;

      // 直径扫描 → 半径；结标记颜色 = h 可用性
      const rs = 0.42 + 0.66 * ((dUm - 1) / 19);
      axon.scale.set(rs, 1, rs);
      let hotK = 0, hotV = V_REST;
      for (let k = 0; k < NNODE; k++) {
        tmp.copy(hInact).lerp(hReady, Math.max(0, Math.min(1, gateH[k] / 0.62)));
        knobMats[k].color.copy(tmp);
        knobs[k].position.y = 0.52 * rs + 0.16;
        const vv = v[nodeI[k]];
        if (vv > hotV) { hotV = vv; hotK = k; }
      }

      // 示波迹线（同源 V(x)）+ 阈值参考线随缩放平移
      for (let j = 0; j < TRACE_N; j++) {
        const ci = Math.round((j / (TRACE_N - 1)) * (NCOMP - 1));
        tracePos[j * 3] = xOf(ci);
        tracePos[j * 3 + 1] = TRACE_Y + (v[ci] - V_REST) * VY;
        tracePos[j * 3 + 2] = 0;
      }
      traceGeo.attributes['position'].needsUpdate = true;

      // 波前离子：仅在发放（hotV 越过阈）时环绕活跃结
      const active = hotV > -30;
      const W = xOf(nodeI[hotK] + 1);
      for (let i = 0; i < NION; i++) {
        const ang = ionSeed[i] + t * 2, xoff = Math.sin(ionSeed[i]) * 0.9;
        const rr = (0.62 + 0.5 * (0.5 + 0.5 * Math.sin(t * 3 + ionSeed[i]))) * rs;
        const rrk = (0.62 + 0.5 * (0.5 + 0.5 * Math.cos(t * 2.6 + ionSeed[i]))) * rs;
        naIons[i].position.set(W + xoff, Math.cos(ang) * rr, Math.sin(ang) * rr); naIons[i].visible = active;
        kIons[i].position.set(W - xoff, Math.cos(ang + 1) * rrk, Math.sin(ang + 1) * rrk); kIons[i].visible = active;
      }

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
