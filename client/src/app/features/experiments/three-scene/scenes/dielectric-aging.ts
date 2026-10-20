import type { SceneContext, SceneInstance } from '../types';
/**
 * 介电老化与绝缘击穿（P396）—— 主控方程（电树指数生长 + 空腔场增强，node 复核）：
 *   XLPE 板（εr≈2.3）厚 d=1mm，上下电极加电压 V：平均场 E₀=V/d
 *   树通道等效导体尖端：剩余间隙分压 ⇒ 尖端场 E_tip = V/(d−L) = E₀·β，β=d/(d−L)
 *   生长速率（实验普遍规律，速率对 E 呈指数）：v = v₀·exp[(E_tip−E_ref)/E_c]
 *     锚点：v₀=1nm/s @E_ref=5MV/m(=5kV/mm 树引发阈)，E_c=2MV/m；上限 3×10⁵nm/s（流注）
 *   复核（node）：E=5→1nm/s；10→12nm/s；18→665nm/s；V=15kV 时 L=0.8d ⇒ β=5 ⇒
 *     E_tip=75MV/m ⇒ v 触顶 ⇒“最后跳跃”贯通 —— 与电树晚期暴走一致 ✓
 *   空腔局放：串联分压 E_cav≈εr·E₀（2.3 倍），超过气隙强度 3kV/mm ⇒ 每脉冲 ~pC 蚀刻
 *   寿命规律：t_b ∝ 1/v(E) ⇒ lg t_b 对 E 线性下降（加速老化定律）
 *   扫描自变量：V=6→24kV（16s 往返）。树尖生长步速/分叉率/β/脉冲计数/击穿复位全同源；
 *   画面时间加速 ×800（面板注明），1wu ⇔ 1/3 mm。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  // —— 物理 ——
  const D_MM = 1.0, WU_PER_MM = 3;
  const D_W = D_MM * WU_PER_MM;
  const E_REF = 5e6, E_C = 2e6, V_CAP = 3e5;                   // nm/s 上限
  const ER = 2.3, E_GAP = 3e6;                                    // 空腔 εr 与气隙击穿场 3kV/mm
  const INCEP = 0.1;                                             // wu：树从电极内侧 0.1 处起生 ⇒ 真实间隙＝D_W−INCEP−L
  const ACC = 800;                                              // 画面时间加速
  const beta = (L: number) => D_W / Math.max(0.03, D_W - INCEP - L);
  const vOf = (V: number, L: number): number => {               // nm/s（实测口径；V 为 kV）
    const Et = V * 1e3 / (D_MM * 1e-3) * beta(L) / 1e6;          // 尖端场 MV/m（kV/mm ≡ MV/m）
    return Math.min(V_CAP, Math.exp((Et - E_REF / 1e6) / (E_C / 1e6))); // v₀=1nm/s@5MV/m，+2MV/m ⇒ ×e
  };

  // —— 星野 + 网格 ——
  {
    const g = geo(new THREE.BufferGeometry());
    const p = new Float32Array(1500);
    for (let i = 0; i < 500; i++) { p[i * 3] = (Math.random() - 0.5) * 200; p[i * 3 + 1] = (Math.random() - 0.5) * 200; p[i * 3 + 2] = (Math.random() - 0.5) * 200; }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    group.add(new THREE.Points(g, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }))));
  }
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // —— 介质板 + 电极 ——
  const slab = new THREE.Mesh(geo(new THREE.BoxGeometry(4.6, D_W, 4.6)), mat(new THREE.MeshStandardMaterial({ color: 0x1e3a8a, transparent: true, opacity: 0.22, roughness: 0.9, depthWrite: false })));
  slab.position.set(0, 2.2, 0);
  group.add(slab);
  const elGeo = geo(new THREE.BoxGeometry(5.2, 0.22, 5.2));
  const elMat = mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.25 }));
  const elTop = new THREE.Mesh(elGeo, elMat); elTop.position.set(0, 2.2 + D_W / 2 + 0.12, 0); group.add(elTop);
  const elBot = new THREE.Mesh(elGeo, elMat); elBot.position.set(0, 2.2 - D_W / 2 - 0.12, 0); group.add(elBot);
  // 引发缺陷（阴极微凸）
  const defect = new THREE.Mesh(geo(new THREE.ConeGeometry(0.08, 0.2, 8)), elMat);
  defect.position.set(-0.6, 2.2 + D_W / 2 - 0.02, 0.4); defect.rotation.x = Math.PI;
  group.add(defect);

  // —— 电树：折线段累积 ——
  const MAXSEG = 5200;
  const treeGeo = geo(new THREE.BufferGeometry());
  const treePos = new Float32Array(MAXSEG * 6);
  treeGeo.setAttribute('position', new THREE.BufferAttribute(treePos, 3));
  treeGeo.setDrawRange(0, 0);
  const treeMat = mat(new THREE.LineBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.85 }));
  group.add(new THREE.LineSegments(treeGeo, treeMat));

  interface Tip { x: number; y: number; z: number; dx: number; dy: number; dz: number; alive: boolean; depth: number }
  let tips: Tip[] = [];
  let nSeg = 0, pulses = 0, bridged = false, flash = 0, lMax = 0, frac = 0;
  let sd = 20261013;
  const rnd = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff; };
  function resetTree(): void {
    tips = [{ x: -0.6, y: 2.2 + D_W / 2 - 0.1, z: 0.4, dx: (rnd() - 0.5) * 0.3, dy: -1, dz: (rnd() - 0.5) * 0.3, alive: true, depth: 0 }];
    nSeg = 0; lMax = 0; bridged = false;
    treeGeo.setDrawRange(0, 0);
  }
  resetTree();
  const TOP_Y = 2.2 + D_W / 2 - 0.1, BOT_Y = 2.2 - D_W / 2;

  // —— 尖端放电光点池 ——
  const NBL = 26;
  const blGeo = geo(new THREE.SphereGeometry(0.055, 8, 6));
  const blMat = mat(new THREE.MeshBasicMaterial({ color: 0xfef3c7, transparent: true, opacity: 0.95 }));
  const blinks = new THREE.InstancedMesh(blGeo, blMat, NBL);
  group.add(blinks);
  // —— 埋入气隙（空腔）——
  const NC = 10;
  const cavGeo = geo(new THREE.SphereGeometry(0.1, 10, 8));
  const cavMat = mat(new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.25 }));
  const cavs: import('three').Mesh[] = [];
  for (let i = 0; i < NC; i++) {
    const m = new THREE.Mesh(cavGeo, cavMat);
    m.position.set(-2 + rnd() * 4, 2.2 + (rnd() - 0.5) * D_W * 0.7, -2 + rnd() * 4);
    group.add(m); cavs.push(m);
  }
  // —— 贯穿辉光柱 ——
  const brGeo = geo(new THREE.CylinderGeometry(0.06, 0.06, D_W + 0.4, 8));
  const brMat = mat(new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0 }));
  const bridge = new THREE.Mesh(brGeo, brMat);
  bridge.position.set(-0.6, 2.2, 0.4);
  group.add(bridge);

  // —— 树长标尺（板侧、mm 分度）+ 当前最深尖端追踪线 ——
  {
    const dg = geo(new THREE.BufferGeometry());
    const p: number[] = [];
    for (let k = 0; k <= 4; k++) {
      const y = 2.2 + D_W / 2 - (k / 4) * D_W;
      p.push(2.35, y, 2.35, 2.52, y, 2.35);
    }
    p.push(2.35, 2.2 + D_W / 2, 2.35, 2.35, 2.2 - D_W / 2, 2.35);
    dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3));
    group.add(new THREE.LineSegments(dg, mat(new THREE.LineBasicMaterial({ color: 0x94a3b8 }))));
  }
  const dmPos = new Float32Array([2.28, 2.2, 2.35, 2.6, 2.2, 2.35]);
  const dmGeo = geo(new THREE.BufferGeometry());
  dmGeo.setAttribute('position', new THREE.BufferAttribute(dmPos, 3));
  const dmLine = new THREE.Line(dmGeo, mat(new THREE.LineDashedMaterial({ color: 0xfbbf24, dashSize: 0.06, gapSize: 0.04 })));
  dmLine.computeLineDistances(); group.add(dmLine);

  // —— 标签 ——
  function makeLabel(text: string, color: string, x: number, y: number, z: number, wu = 3.0): void {
    const c2 = document.createElement('canvas'); c2.width = 512; c2.height = 64;
    const c3 = c2.getContext('2d')!;
    c3.fillStyle = color; c3.font = 'bold 27px "PingFang SC", sans-serif'; c3.textAlign = 'center'; c3.textBaseline = 'middle';
    c3.fillText(text, 256, 32);
    const sp = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(c2)), transparent: true })));
    sp.scale.set(wu, wu / 8, 1); sp.position.set(x, y, z); group.add(sp);
  }
  makeLabel('电树从阴极缺陷引发：紫=碳化通道（导电）', '#d8b4fe', 0, 4.0, 2.6, 4.2);
  makeLabel('蓝小球=埋入气隙：E_cav≈εr·E₀ 超 3kV/mm ⇒ 局放', '#7dd3fc', -1.9, 1.1, 2.9, 4.6);

  // —— 面板 ——
  const cv = document.createElement('canvas'); cv.width = 780; cv.height = 250;
  const cc = cv.getContext('2d')!;
  const ct = tex(new THREE.CanvasTexture(cv));
  const panel = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: ct, transparent: true, depthTest: false })));
  panel.scale.set(7.6, 7.6 * 250 / 780, 1); panel.position.set(0, 4.75, 0); panel.renderOrder = 998;
  group.add(panel);
  const S = { V: 6, E0: 0, beta: 1, Et: 0, v: 0, tb: 0, br: 0, ecav: 0 };
  function draw(): void {
    cc.clearRect(0, 0, 780, 250);
    cc.fillStyle = 'rgba(7,11,20,0.84)'; cc.fillRect(3, 3, 774, 244);
    cc.strokeStyle = '#334155'; cc.lineWidth = 3; cc.strokeRect(3, 3, 774, 244);
    cc.textAlign = 'left';
    cc.fillStyle = '#f8fafc'; cc.font = 'bold 25px "PingFang SC", sans-serif';
    cc.fillText('电树：绝缘体内部慢燃烧的导电闪电', 18, 34);
    cc.fillStyle = '#22d3ee'; cc.font = '22px "PingFang SC", sans-serif';
    cc.fillText('v=v₀·e^((E_tip−E_ref)/E_c)，E_tip=V/(d−L)=β·E₀，β=d/(d−L)', 18, 64);
    cc.fillStyle = '#a855f7';
    cc.fillText('空腔场 =εr·E₀（串联分压），超气隙强度 ⇒ pC 级局放持续蚀刻', 18, 92);
    cc.fillStyle = '#22c55e';
    cc.fillText(`寿命 lg t_b ∝ −(E_tip)/E_c ⇒ 加速老化：场强+2MV/m，寿命÷e≈÷2.7`, 18, 118);
    cc.fillStyle = '#fbbf24'; cc.font = 'bold 21px "PingFang SC", sans-serif';
    cc.fillText(`读数：V=${S.V.toFixed(1)}kV  E₀=${(S.E0 / 1e6).toFixed(1)}MV/m  β=${S.beta.toFixed(2)}  E_tip=${(S.Et / 1e6).toFixed(1)}MV/m  空腔场 εr·E₀=${(S.ecav / 1e6).toFixed(2)}MV/m（>${(E_GAP / 1e6).toFixed(0)} 才放电信号）`, 18, 150);
    cc.fillText(`生长速率 v=${S.v < 1000 ? S.v.toFixed(1) + 'nm/s' : (S.v / 1000).toFixed(2) + 'µm/s'}（t_b≈${(S.tb < 1e4 ? S.tb.toFixed(0) + 's' : (S.tb / 3600).toFixed(1) + 'h')}）  树长=${(S.br * D_MM).toFixed(3)}mm`, 18, 176);
    cc.fillText(`局放脉冲 ${pulses} 次  画面时间×${ACC}  1wu⇔1/3mm`, 18, 202);
    cc.fillStyle = flash > 0 ? '#ef4444' : '#fbbf24';
    cc.fillText(flash > 0 ? '⚡ 通道贯通两电极 —— 击穿放电！（复位重老化）' : S.Et > 15e6 ? '接近暴走：最后跳跃随时发生' : '缓慢老化：通道在分叉延伸', 18, 228);
    ct.needsUpdate = true;
  }

  const mtx = new THREE.Matrix4(), vp = new THREE.Vector3(), vs = new THREE.Vector3(), qq = new THREE.Quaternion();
  const DS = 0.045;                                              // 每生长子步（wu）=15µm=1.5e4nm
  function stepOnce(V: number): void {
    for (const tp of tips) {
      if (!tp.alive || nSeg >= MAXSEG - 2) continue;
      const L = TOP_Y - tp.y;
      const v = vOf(V, L);                                       // nm/s（本尖端局部场）
      const o = nSeg * 6;
      treePos[o] = tp.x; treePos[o + 1] = tp.y; treePos[o + 2] = tp.z;
      const jit = 0.55 + 0.5 * Math.min(2, v / 200);             // 速率越大抖动越大（ branching 前兆）
      let nx = tp.dx + (rnd() - 0.5) * jit, ny = tp.dy - 0.25 * rnd(), nz = tp.dz + (rnd() - 0.5) * jit;
      const nl = Math.max(1e-6, Math.hypot(nx, ny, nz));
      nx /= nl; ny /= nl; nz /= nl;
      tp.x += nx * DS; tp.y = Math.min(tp.y + ny * DS, TOP_Y); tp.z += nz * DS;
      tp.dx = nx * 0.8 + tp.dx * 0.2; tp.dy = ny; tp.dz = nz * 0.8 + tp.dz * 0.2;
      treePos[o + 3] = tp.x; treePos[o + 4] = tp.y; treePos[o + 5] = tp.z;
      nSeg++;
      pulses += rnd() < 0.25 ? 1 : 0;                            // 每步 ~pC 级局放脉冲
      if (tp.y <= BOT_Y + 0.05) { bridged = true; flash = 1.2; }
      if (tips.length < 22 && tp.depth < 4 && rnd() < 0.05 + 0.12 * Math.min(1, v / 1500) && nSeg < MAXSEG - 40) {
        const sgn = rnd() > 0.5 ? 1 : -1;
        tips.push({ x: tp.x, y: tp.y, z: tp.z, dx: tp.dx + sgn * 0.6, dy: tp.dy, dz: tp.dz - sgn * 0.35, alive: true, depth: tp.depth + 1 });
        tp.depth += 1;
      }
    }
    treeGeo.attributes['position'].needsUpdate = true;
    treeGeo.setDrawRange(0, nSeg * 2);
    lMax = Math.max(0, ...tips.map((tp) => TOP_Y - tp.y));
  }

  return {
    update(t, dt) {
      const PER = 16;
      const ph = (t % PER) / PER;
      const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
      const V = 6 + 19 * tri;
      if (flash > 0) {
        flash -= dt;
        brMat.opacity = Math.max(0, flash);
        if (flash <= 0) { resetTree(); pulses = 0; brMat.opacity = 0; }
      } else if (!bridged) {
        const v = vOf(V, lMax);                                   // nm/s（最大树长处）
        frac += (v * ACC * dt) / 1.5e4;                           // 子步 15µm=1.5e4 nm
        let guard = 0;
        while (frac >= 1 && guard++ < 400) { frac -= 1; stepOnce(V); }
      }
      // 尖端光点
      let bi = 0;
      for (const tp of tips) {
        if (!tp.alive || bi >= NBL) continue;
        vp.set(tp.x, tp.y, tp.z);
        const s = 0.7 + (Math.sin(t * 17 + bi) * 0.4 + 0.4);
        vs.set(s, s, s); qq.identity(); mtx.compose(vp, qq, vs);
        blinks.setMatrixAt(bi++, mtx);
      }
      blinks.count = bi; blinks.instanceMatrix.needsUpdate = true;
      const e0 = V * 1e3 / (D_MM * 1e-3);                         // 平均场 V/m（V kV ÷ 1mm）
      S.V = V; S.E0 = e0;
      S.beta = D_MM / Math.max(0.01, (D_W - INCEP - lMax) / WU_PER_MM); // β=d/(d−INCEP−L)，与画出的尖端间隙同源
      S.Et = e0 * S.beta;
      S.v = vOf(V, lMax);                                         // nm/s
      S.tb = Math.max(0.01, (D_W - INCEP - lMax) / WU_PER_MM) * 1e6 / Math.max(0.001, S.v); // 剩余间隙÷当前速率
      S.ecav = ER * e0;                                          // 空腔串联分压场 εr·E₀
      S.br = Math.min(1, lMax / D_W);
      const yTip = TOP_Y - lMax;
      dmPos[1] = yTip; dmPos[4] = yTip;
      dmGeo.attributes['position'].needsUpdate = true;
      const flashOn = S.ecav > E_GAP;                          // εr·E₀ 超气隙强度才放电
      cavs.forEach((m, i) => { (m.material as import('three').MeshBasicMaterial).opacity = 0.12 + 0.5 * ((Math.sin(t * (3 + i) + i * 2.1) > 0.7) && flashOn ? 1 : 0); });
      elMat.emissive && elMat.emissive.setRGB(0.2 * tri, 0.16 * tri, 0);
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) draw();
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
