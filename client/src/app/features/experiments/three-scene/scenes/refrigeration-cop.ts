import type { SceneContext, SceneInstance } from '../types';
/**
 * 制冷循环与制冷系数（P499）：蒸气压缩式制冷机（压缩机—冷凝器—节流阀—蒸发器闭环）。
 * 工质模型（R134a 量级，Clausius-Clapeyron + 常潜热）：
 *   p_sat(T)=p_top·exp[(L/R)(1/T_c−1/T)]，L=215 kJ/kg，R=83.1 J/kg·K，cp=1.0、c_l=1.3 kJ/kg·K
 *   压缩功 w=cp·T_e[(p_c/p_e)^(R/cp)−1]（等熵），制冷量 q_e=h₁−h₄=L−c_l(T_c−T_e)，
 *   节流等焓 ⇒ 出口干度 x₄=c_l(T_c−T_e)/L，COP=q_e/w，逆卡诺上确界 COP_C=T_e/(T_c−T_e)，
 *   热泵 COP'=COP+1（热量被逆向搬运：Q_h=Q_c+W）。
 * 画面：三维管路内 40 个工质微团按 (T,p,相) 着色（蓝=低温液态，红=高温过热气，青=蒸发两相），
 * 旁边 p-h 图上循环环路随 T_e(扫描 243→288 K) 整体形变，红点与管内微团同参数 u 同步行走。
 * 数值核对：T_e=−10°C/T_c=40°C ⇒ p 比 4.8、w≈37 kJ/kg、COP≈4.1（实际 R134a 约 3.7，比 0.78）。
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
  const starGeo = geo(new THREE.BufferGeometry());
  { const p = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) { p[i * 3] = (Math.random() - 0.5) * 200; p[i * 3 + 1] = (Math.random() - 0.5) * 200; p[i * 3 + 2] = (Math.random() - 0.5) * 200; }
    starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3)); }
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // —— 工质热力学（全部由 Te 驱动）——
  const L = 215e3, Rg = 83.1, cp = 1000, cl = 1300, Tcond = 313.15, pTop = 4.285e5;
  const psat = (T: number) => pTop * Math.exp((L / Rg) * (1 / Tcond - 1 / T));
  const CYCLE = 16;
  const cycOf = (Te: number) => {
    const pe = psat(Te), ratio = pTop / pe;
    const T2 = Te * Math.pow(ratio, Rg / cp);
    const w = cp * (T2 - Te), qe = L - cl * (Tcond - Te);
    return { pe, ratio, T2, w, qe, x4: cl * (Tcond - Te) / L, cop: qe / w, carn: Te / (Tcond - Te) };
  };
  // 状态沿循环参数 u∈[0,1)：蒸发[0,.3)→压缩[.3,.45)→冷凝[.45,.8)→节流[.8,.88)→回流[.88,1)
  const stateAt = (u: number, k: ReturnType<typeof cycOf>, Te: number) => {
    const hl = cl * (Te - 243.15), h3 = cl * (Tcond - 243.15);
    if (u < 0.3) { const s = u / 0.3; return { T: Te, p: k.pe, h: h3 + s * k.qe, x: k.x4 + s * (1 - k.x4), ph: 1 }; }
    if (u < 0.45) { const s = (u - 0.3) / 0.15; return { T: Te + (k.T2 - Te) * s, p: k.pe * Math.pow(k.ratio, s), h: hl + L + k.w * s, x: 1, ph: 2 }; }
    if (u < 0.8) { const s = (u - 0.45) / 0.35; const hd = hl + L + k.w; const h = hd - s * (hd - h3);
      const s1 = (hd - h3 - L) / (hd - h3); const sh = s < s1 ? 1 - s / s1 : 0;
      return { T: Tcond + (k.T2 - Tcond) * sh, p: pTop, h, x: (h - h3) / L, ph: sh > 0 ? 2 : s < 0.98 ? 1 : 0 }; }
    if (u < 0.88) { const s = (u - 0.8) / 0.08; return { T: Tcond - (Tcond - Te) * s, p: pTop * Math.pow(1 / k.ratio, s), h: h3, x: k.x4 * s + (1 - s), ph: 3 }; }
    return { T: Te, p: k.pe * (1 + 0.02 * u), h: h3, x: k.x4, ph: 0 };
  };

  // —— 闭合管路：按 u 采样 240 点的空间路径 ——
  const NODES: [number, number, number][] = [];
  const pathPt = (u: number, out: [number, number, number]): void => {
    // 布局：蒸发器(左,x=-3.2)、压缩机(下中,-0.9)、冷凝器(上,+1.7)、节流阀(右,+0.6)，均 y=0 平面绕行
    const evapC = [-3.1, 0, 0.35], compC = [-0.55, 0, -1.5], condC = [-1.7, 0, 1.55], thrC = [0.15, 0, 0.35];
    if (u < 0.3) { const s = u / 0.3; out[0] = evapC[0]; out[1] = 0; out[2] = evapC[2] + (s - 0.5) * 1.5; return; }
    if (u < 0.45) { const s = (u - 0.3) / 0.15; out[0] = evapC[0] + (compC[0] - evapC[0]) * s + 0.5 * Math.sin(s * PI) * 0.2; out[1] = 0; out[2] = evapC[2] + (compC[2] - evapC[2]) * s; return; }
    if (u < 0.8) { const s = (u - 0.45) / 0.35; out[0] = compC[0] + (thrC[0] - compC[0]) * s; out[1] = 0; out[2] = compC[2] + (condC[2] - compC[2]) * Math.min(1, s * 2.2); if (s > 0.45 && s < 0.75) { out[2] = condC[2]; out[0] = condC[0] + (thrC[0] - condC[0]) * (s - 0.45) / 0.30; } return; }
    if (u < 0.88) { const s = (u - 0.8) / 0.08; out[0] = thrC[0] + (evapC[0] + 0.7 - thrC[0]) * s; out[1] = 0; out[2] = thrC[2] + (evapC[2] - 0.72 - thrC[2]) * s; return; }
    const s = (u - 0.88) / 0.12; out[0] = evapC[0] + 0.7 - 0.7 * s; out[1] = 0; out[2] = evapC[2] - 0.72 + (0.72 - 0.05) * s * 0; out[2] = evapC[2] + (1 - s) * 0.68 - 0.68 * 0 + (s * 0.02); return;
  };
  const NP = 240;
  const pts: import('three').Vector3[] = [];
  { const o: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < NP; i++) { pathPt(i / NP, o); pts.push(new THREE.Vector3(o[0], o[1] + 0.15, o[2])); } }
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.35);
  const pipeGeo = geo(new THREE.TubeGeometry(curve, 200, 0.062, 8, true));
  group.add(new THREE.Mesh(pipeGeo, mat(new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.55, roughness: 0.4, transparent: true, opacity: 0.55 }))));

  // —— 四大部件 ——
  const partMat = mat(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.35 }));
  const evap = new THREE.Mesh(geo(new THREE.BoxGeometry(0.5, 0.75, 1.55)), partMat); evap.position.set(-3.1, 0.15, 0.35); group.add(evap);
  const cond = new THREE.Mesh(geo(new THREE.BoxGeometry(1.7, 0.7, 0.5)), partMat); cond.position.set(-1.3, 0.15, 1.55); group.add(cond);
  const finsGeo = geo(new THREE.BufferGeometry());
  { const p: number[] = [];
    for (let i = 0; i < 9; i++) { const x = -2.05 + i * 0.21; p.push(x, 0.5, 1.55, x, 1.0, 1.55); }
    finsGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3)); }
  group.add(new THREE.LineSegments(finsGeo, mat(new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.75 }))));
  const comp = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.32, 0.32, 0.6, 16)), partMat); comp.rotation.x = PI / 2; comp.position.set(-0.55, 0.15, -1.5); group.add(comp);
  const thrA = new THREE.Mesh(geo(new THREE.ConeGeometry(0.16, 0.26, 10)), mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5 })));
  thrA.rotation.z = PI / 2; thrA.position.set(0.05, 0.15, 0.35); group.add(thrA);
  const thrB = new THREE.Mesh(geo(new THREE.ConeGeometry(0.16, 0.26, 10)), thrA.material as import('three').MeshStandardMaterial);
  thrB.rotation.z = -PI / 2; thrB.position.set(0.28, 0.15, 0.35); group.add(thrB);

  // 热量被"逆向搬运"：蒸发器吸热箭头（上入）、冷凝器排热箭头（上出）、压缩机功箭头
  const arrowGeo = geo(new THREE.ConeGeometry(0.09, 0.24, 10));
  const coldMat = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
  const hotMat = mat(new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  const workMat = mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
  const shaftGeo2 = geo(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6));
  const aQc1 = new THREE.Mesh(shaftGeo2, coldMat); aQc1.position.set(-3.1, -0.75, 0.35); group.add(aQc1);
  const aQc2 = new THREE.Mesh(arrowGeo, coldMat); aQc2.position.set(-3.1, -0.42, 0.35); group.add(aQc2);
  const aQh1 = new THREE.Mesh(shaftGeo2, hotMat); aQh1.position.set(-1.3, 1.28, 1.55); group.add(aQh1);
  const aQh2 = new THREE.Mesh(arrowGeo, hotMat); aQh2.position.set(-1.3, 1.62, 1.55); group.add(aQh2);
  const aW1 = new THREE.Mesh(shaftGeo2, workMat); aW1.position.set(-0.55, -0.62, -1.85); group.add(aW1);
  const aW2 = new THREE.Mesh(arrowGeo, workMat); aW2.position.set(-0.55, -0.28, -1.85); group.add(aW2);

  // —— 工质微团 ——
  const NPRT = 40;
  const pGeo = geo(new THREE.SphereGeometry(0.075, 8, 6));
  const parts: { m: import('three').Mesh; mt: import('three').MeshBasicMaterial }[] = [];
  for (let i = 0; i < NPRT; i++) {
    const mt = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
    const m = new THREE.Mesh(pGeo, mt);
    group.add(m); parts.push({ m, mt });
  }
  const cTmp = new THREE.Color();
  const paint = (mt: import('three').MeshBasicMaterial, st: ReturnType<typeof stateAt>, Tlo: number, Thi: number): void => {
    const tt = Math.max(0, Math.min(1, (st.T - Tlo) / (Thi - Tlo)));
    const hue = 0.64 - 0.62 * tt;                       // 蓝(冷)→红(热)：温度
    const light = st.ph === 0 ? 0.34 : st.ph === 2 ? 0.62 : st.ph === 3 ? 0.45 : 0.5;  // 液暗/气亮
    cTmp.setHSL(hue, 0.85, light);
    mt.color.copy(cTmp);
  };

  // —— p-h 图（地面，右侧）——
  const HX = (h: number) => 1.55 + (h / 300) * 3.0;                       // kJ/kg → x（数据区 0→300）
  const PX = (p: number) => 3.35 - (Math.log10(12 / p) / Math.log10(12 / 0.2)) * 2.2;  // bar(对数)→z：0.2→12 bar
  const chartGeo = geo(new THREE.BufferGeometry());
  const chartPos = new Float32Array((2 * 34 + 10) * 3);
  chartGeo.setAttribute('position', new THREE.BufferAttribute(chartPos, 3));
  group.add(new THREE.Line(chartGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.9 }))));
  { const g = geo(new THREE.BufferGeometry()); const p: number[] = [];
    const corners: [number, number][] = [[HX(0), PX(0.2)], [HX(300), PX(0.2)], [HX(300), PX(12)], [HX(0), PX(12)]];
    for (let i = 0; i < 4; i++) { const a = corners[i], b = corners[(i + 1) % 4]; p.push(a[0], 0.02, a[1], b[0], 0.02, b[1]); }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3));
    group.add(new THREE.LineSegments(g, mat(new THREE.LineBasicMaterial({ color: 0x475569 })))); }
  const loopGeo = geo(new THREE.BufferGeometry());
  const loopPos = new Float32Array(221 * 3);
  loopGeo.setAttribute('position', new THREE.BufferAttribute(loopPos, 3));
  group.add(new THREE.Line(loopGeo, mat(new THREE.LineBasicMaterial({ color: 0xa855f7 }))));
  const dotGeo = geo(new THREE.SphereGeometry(0.075, 10, 8));
  const dot = new THREE.Mesh(dotGeo, mat(new THREE.MeshBasicMaterial({ color: 0xef4444 })));
  group.add(dot);

  function makeLabel(text: string, color: string, scale = 3.2): import('three').Sprite {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(scale, scale / 8, 1); s.renderOrder = 998; return s;
  }
  const l1 = makeLabel('蒸发器（冷库吸热 Q_c）', '#22d3ee', 3.4); l1.position.set(-3.1, 1.05, 0.35);
  const l2 = makeLabel('冷凝器（向室外排热 Q_h）', '#ef4444', 3.6); l2.position.set(-1.3, 2.0, 1.55);
  const l3 = makeLabel('压缩机（输入功 W）', '#fbbf24', 3.2); l3.position.set(-0.55, -1.15, -1.5);
  const l4 = makeLabel('节流阀（等焓膨胀）', '#94a3b8', 3.2); l4.position.set(0.15, 0.85, 0.35);
  const l5 = makeLabel('p–h 图：环路随 T_e 形变，红点与管内微团同步', '#c4b5fd', 4.6); l5.position.set(3.05, 0.9, 2.2);
  group.add(l1, l2, l3, l4, l5);

  const infoCv = document.createElement('canvas'); infoCv.width = 640; infoCv.height = 256;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const info = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  info.scale.set(7.2, 2.88, 1); info.position.set(-0.6, 3.7, 0); info.renderOrder = 999;
  group.add(info);

  const rd = { Te: 243, k: cycOf(243), u: 0 };
  function drawInfo(): void {
    const k = rd.k, Te = rd.Te;
    infoCtx.clearRect(0, 0, 640, 256);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(3, 3, 634, 250);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(3, 3, 634, 250);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    infoCtx.fillText('制冷循环：热量被逆向搬运（功换热流方向）', 14, 30);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '19px "PingFang SC", sans-serif';
    infoCtx.fillText('COP=Q_c/W=q_e/w；逆卡诺 COP_C=T_e/(T_c−T_e)；热泵 COP′=COP+1', 14, 56);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText(`Clausius-Clapeyron p∝exp(−L/RT)：p_c/p_e=${k.ratio.toFixed(1)}，w=cp·T_e[(p_c/p_e)^{R/cp}−1]=${(k.w / 1e3).toFixed(1)}kJ/kg`, 14, 80);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '17px "PingFang SC", sans-serif';
    infoCtx.fillText(`q_e=L−c_l(T_c−T_e)=(h₁−h₄)=${(k.qe / 1e3).toFixed(0)}kJ/kg；节流等焓 ⇒ 出口干度 x₄=${k.x4.toFixed(2)}`, 14, 104);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 20px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：T_e=${Te.toFixed(1)}K(${(Te - 273.15).toFixed(1)}°C)  p_e=${(k.pe / 1e5).toFixed(2)}bar`, 14, 132);
    infoCtx.fillText(`COP=${k.cop.toFixed(2)} vs 逆卡诺 ${k.carn.toFixed(2)}（二法则效率 ${(100 * k.cop / k.carn).toFixed(0)}%）  热泵 COP′=${(k.cop + 1).toFixed(2)}`, 14, 158);
    infoCtx.fillText(`Q_h=Q_c+W ⇒ 房间得热 ${(k.qe / 1e3 + k.w / 1e3).toFixed(0)}kJ/kg·每kg工质`, 14, 184);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = '17px "PingFang SC", sans-serif';
    infoCtx.fillText(`T₂(排气)=${k.T2.toFixed(1)}K(${(k.T2 - 273.15).toFixed(1)}°C)  T_c=${Tcond.toFixed(1)}K(${(Tcond - 273.15).toFixed(1)}°C)  （计算用 K）`, 14, 236);
    infoCtx.fillStyle = '#22c55e'; infoCtx.font = '16px "PingFang SC", sans-serif';
    infoCtx.fillText(`T_e 扫描 ${Te.toFixed(0)}→288K（${(Te - 273.15).toFixed(0)}→15°C）：蒸发温度越低 COP 越低（管路+环路同步收缩）`, 14, 210);
    infoTex.needsUpdate = true;
  }

  // 饱和穹顶（静态，T 233→343 K）
  {
    let vi = 0;
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < 34; i++) {
        const T = 243.15 + (343 - 243.15) * i / 33;
        const hl = cl * (T - 243.15) / 1e3, hv = (hl * 1e3 + L) / 1e3;
        const h = side === 0 ? hl : hv;
        chartPos[vi] = HX(h); chartPos[vi + 1] = 0.03; chartPos[vi + 2] = PX(psat(T) / 1e5);
        vi += 3;
      }
      if (side === 0) { chartPos[vi] = NaN; chartPos[vi + 1] = NaN; chartPos[vi + 2] = NaN; vi += 3; }
    }
    // p-h 图上标注饱和压力轴刻度（4 条水平短线）
    for (const pb of [0.5, 1, 2, 5, 10]) {
      chartPos[vi] = HX(0); chartPos[vi + 1] = 0.03; chartPos[vi + 2] = PX(pb); vi += 3;
      chartPos[vi] = HX(15); chartPos[vi + 1] = 0.03; chartPos[vi + 2] = PX(pb); vi += 3;
    }
    chartGeo.attributes['position'].needsUpdate = true;
  }
  drawInfo();

  return {
    update(t, dt) {
      const u0 = (t % CYCLE) / CYCLE;
      const Te = 243.15 + 45 * u0;
      rd.Te = Te; rd.k = cycOf(Te);
      const k = rd.k;
      // 循环环路（221 点）
      for (let i = 0; i <= 220; i++) {
        const st = stateAt((i / 220) % 1, k, Te);
        loopPos[i * 3] = HX(st.h / 1e3); loopPos[i * 3 + 1] = 0.045; loopPos[i * 3 + 2] = PX(st.p / 1e5);
      }
      loopGeo.attributes['position'].needsUpdate = true;
      // 微团流动：周期 8s 一圈
      const flow = (t / 8) % 1;
      const Thi = k.T2 + 6;
      for (let i = 0; i < NPRT; i++) {
        const uu = (flow + i / NPRT) % 1;
        const st = stateAt(uu, k, Te);
        const o: [number, number, number] = [0, 0, 0];
        pathPt(uu, o);
        parts[i].m.position.set(o[0], 0.15 + (st.ph === 1 ? 0.05 * Math.sin(t * 3 + i) : 0), o[2]);
        paint(parts[i].mt, st, 243, Thi);
        parts[i].m.scale.setScalar(st.ph === 1 || st.ph === 2 ? 0.9 + 0.5 * Math.min(1, st.x) : 0.8);
      }
      // 红点与"当前演示状态"同步：取第一个微团
      const st0 = stateAt(flow, k, Te);
      rd.u = flow;
      dot.position.set(HX(st0.h / 1e3), 0.08, PX(st0.p / 1e5));
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
    },
    dispose() {
      geos.forEach((x) => x.dispose()); mats.forEach((x) => x.dispose()); texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
