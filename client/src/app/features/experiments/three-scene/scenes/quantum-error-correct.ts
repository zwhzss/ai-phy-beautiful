import type { SceneContext, SceneInstance } from '../types';
/** 表面码量子纠错（P239）：d=5 旋转表面码 —— 25 个数据比特（青）+ 24 个稳定子测量比特
 *  （X 型紫、Z 型绿，内部 16 + 边界 8；边界约定：左右 X、上下 Z）。每 2.2s 一轮纠错循环：
 *  按错误率 p 独立抽样位翻转（X 错误）；位翻转与 X 稳定子对易、使相邻 **Z 稳定子** 奇偶翻转 ⇒ 金色探测事件
 *  （相位翻转则触发 X 稳定子）；贪心最近邻最小权配对（粉线），落单者连向 Z 边界（上下边，红线）。
 *  扫描 p∈[0.1%,10%]（16s 对数余弦）。演示模型：阈值 p_th≈1%（纯门错误演示值），
 *  饱和化 P_L=c/(1+c)，c=0.02(p/p_th)³（d=5 一阶 ∝p³，指数 ⌊(d+1)/2⌋=3，恒 ≤1）；
 *  一阶近似 ⟨探测事件⟩≈p·N_Z（N_Z=数据—Z 连接数，由几何实际计数）。 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [];
  const mats: { dispose(): void }[] = [];
  const texs: { dispose(): void }[] = [];
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

  const TWO_PI = Math.PI * 2;
  const D = 5, A = 0.55, LC = new THREE.Vector3(-2.15, 2.7, 0);
  const px = (i: number): number => LC.x + (i - (D - 1) / 2) * A;
  const py = (j: number): number => LC.y + (j - (D - 1) / 2) * A;

  // —— 数据比特 25 ——
  const dataGeo = geo(new THREE.SphereGeometry(0.12, 12, 10));
  const dataMesh = new THREE.InstancedMesh(dataGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee })), D * D);
  { const dm = new THREE.Object3D();
    for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) {
      dm.position.set(px(i), py(j), 0); dm.scale.setScalar(1); dm.updateMatrix();
      dataMesh.setMatrixAt(i * D + j, dm.matrix);
    } }
  dataMesh.instanceMatrix.needsUpdate = true;
  group.add(dataMesh);

  // —— 辅助比特：内部 16（(i+j) 偶为 X）+ 边界 8（左右 X、上下 Z）——
  type Anc = { x: number; y: number; isX: boolean; nb: number[] };
  const ancs: Anc[] = [];
  const dIdx = (i: number, j: number): number => i * D + j;
  for (let i = 0; i < D - 1; i++) for (let j = 0; j < D - 1; j++) {
    const cx = px(i) + A / 2, cy = py(j) + A / 2;
    ancs.push({ x: cx, y: cy, isX: (i + j) % 2 === 0, nb: [dIdx(i, j), dIdx(i + 1, j), dIdx(i, j + 1), dIdx(i + 1, j + 1)] });
  }
  const bo = A * 0.72;
  for (const s of [-1, 1]) {
    for (const m of [0, 2]) {
      const xx = s < 0 ? px(0) - bo : px(D - 1) + bo;
      ancs.push({ x: xx, y: (py(m) + py(m + 1)) / 2, isX: true, nb: [dIdx(s < 0 ? 0 : D - 1, m), dIdx(s < 0 ? 0 : D - 1, m + 1)] });
      const yy = s < 0 ? py(0) - bo : py(D - 1) + bo;
      ancs.push({ x: (px(m) + px(m + 1)) / 2, y: yy, isX: false, nb: [dIdx(m, s < 0 ? 0 : D - 1), dIdx(m + 1, s < 0 ? 0 : D - 1)] });
    }
  }
  let NBZ = 0;
  ancs.forEach((an) => { if (!an.isX) NBZ += an.nb.length; });   // 数据—Z 连接数（位翻转由 Z 稳定子探测）
  const ancGeo = geo(new THREE.OctahedronGeometry(0.09));
  const ancX = new THREE.InstancedMesh(ancGeo, mat(new THREE.MeshBasicMaterial({ color: 0xa855f7 })), 12);
  const ancZ = new THREE.InstancedMesh(ancGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22c55e })), 12);
  { const dm = new THREE.Object3D(); let nx = 0, nz = 0;
    ancs.forEach((an) => { dm.position.set(an.x, an.y, 0); dm.scale.setScalar(1); dm.updateMatrix();
      if (an.isX) ancX.setMatrixAt(nx++, dm.matrix); else ancZ.setMatrixAt(nz++, dm.matrix); }); }
  ancX.instanceMatrix.needsUpdate = true; ancZ.instanceMatrix.needsUpdate = true;
  group.add(ancX, ancZ);

  // —— 稳定子—数据连接线（静态灰）——
  const bondPos = new Float32Array(ancs.reduce((s, an) => s + an.nb.length, 0) * 6);
  let bk = 0;
  ancs.forEach((an) => an.nb.forEach((q) => {
    const i = Math.floor(q / D), j = q % D;
    bondPos[bk * 6] = an.x; bondPos[bk * 6 + 1] = an.y; bondPos[bk * 6 + 2] = 0;
    bondPos[bk * 6 + 3] = px(i); bondPos[bk * 6 + 4] = py(j); bondPos[bk * 6 + 5] = 0;
    bk++;
  }));
  const bondGeo = geo(new THREE.BufferGeometry());
  bondGeo.setAttribute('position', new THREE.BufferAttribute(bondPos, 3));
  group.add(new THREE.LineSegments(bondGeo, mat(new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.8 }))));

  // —— 动态层：错误闪红（数据位）、金色探测（Z 位）、粉匹配线、红边界线 ——
  const errGeo = geo(new THREE.SphereGeometry(0.16, 10, 10));
  const errMesh = new THREE.InstancedMesh(errGeo, mat(new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.85 })), D * D);
  group.add(errMesh);
  const synGeo = geo(new THREE.SphereGeometry(0.145, 10, 10));
  const synMesh = new THREE.InstancedMesh(synGeo, mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })), 12);
  group.add(synMesh);
  const matchGeo = geo(new THREE.BufferGeometry());
  matchGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 6), 3));
  matchGeo.setDrawRange(0, 0);
  group.add(new THREE.LineSegments(matchGeo, mat(new THREE.LineBasicMaterial({ color: 0xf472b6 }))));
  const blineGeo = geo(new THREE.BufferGeometry());
  blineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 6), 3));
  blineGeo.setDrawRange(0, 0);
  group.add(new THREE.LineSegments(blineGeo, mat(new THREE.LineBasicMaterial({ color: 0xef4444 }))));

  // —— P_L 曲线墙：x=log p ∈[0.1%,10%]，y=log P_L，P_L=c/(1+c)、c=0.02(p/p_th)³，p_th=1% ——
  const PLM = (p: number): number => { const c = 0.02 * Math.pow(p / 0.01, 3); return c / (1 + c); };
  const WX = (u: number): number => 1.2 + 3.0 * u;                 // u: 0→1 对应 p=0.001→0.1
  const WY = (P: number): number => 0.85 + 2.6 * (Math.log10(Math.min(1, Math.max(1e-6, P))) + 6) / 6;
  const curveGeo = geo(new THREE.BufferGeometry());
  { const pos = new Float32Array(121 * 3);
    for (let i = 0; i <= 120; i++) { const u = i / 120, p = 0.001 * Math.pow(100, u);
      pos[i * 3] = WX(u); pos[i * 3 + 1] = WY(PLM(p)); pos[i * 3 + 2] = 0; }
    curveGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); }
  group.add(new THREE.Line(curveGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e }))));
  const thGeo = geo(new THREE.BufferGeometry());
  thGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([WX(0.5), 0.6, 0, WX(0.5), 3.8, 0]), 3));
  const thLine = new THREE.Line(thGeo, mat(new THREE.LineDashedMaterial({ color: 0xef4444, dashSize: 0.12, gapSize: 0.08 })));
  thLine.computeLineDistances();
  group.add(thLine);
  const markGeo = geo(new THREE.SphereGeometry(0.09, 10, 10));
  const wMark = new THREE.Mesh(markGeo, mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  group.add(wMark);
  const hGeo = geo(new THREE.BufferGeometry());
  hGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  group.add(new THREE.Line(hGeo, mat(new THREE.LineBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.55 }))));

  function makeLabel(text: string, color: string, scale = 2.4): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  const zAncs = ancs.filter((k) => !k.isX);
  function addLabel(text: string, color: string, x: number, y: number, scale: number): void {
    const lb = makeLabel(text, color, scale);
    lb.position.set(x, y, 0);
    group.add(lb);
  }
  addLabel('d=5 旋转表面码', '#22d3ee', LC.x, LC.y + 1.85, 2.8);
  addLabel('X 稳定子(紫) Z 稳定子(绿)', '#94a3b8', LC.x, LC.y - 1.95, 2.6);
  addLabel('P_L=c/(1+c)，c=0.02(p/p_th)³', '#22c55e', 2.7, 3.95, 3.0);
  addLabel('横轴 log p　纵轴 log P_L', '#94a3b8', 2.7, 0.55, 2.6);

  // —— 面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 840; infoCv.height = 300;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.2, 3.3)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 6.4, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  let curP = 0.001, curPL = 2e-5, nErr = 0, nSyn = 0, totSyn = 0, rounds = 1, nBdry = 0;
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 840, 300);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 832, 292);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 832, 292);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText(`表面码 d=5：25 数据 + 24 稳定子比特｜Z 连接数 N=${NBZ}`, 22, 40);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '24px "PingFang SC", sans-serif';
    infoCtx.fillText('位翻转(X 错误)⇒相邻 Z 稳定子(绿)奇偶翻转＝探测事件；相位翻转⇒X 稳定子', 22, 78);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('解码：对探测事件做最小权配对（粉线）；落单者连上下 Z 边界（红）⇒ 链横跨即错', 22, 112);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：p=${(curP * 100).toFixed(2)}% 本轮错误 ${nErr}｜探测 ${nSyn}（预期 ${(curP * NBZ).toFixed(2)}）`, 22, 152);
    infoCtx.fillText(`累计均值 ${(totSyn / rounds).toFixed(2)}/轮｜边界线 ${nBdry}｜P_L 饱和模型 ${curPL < 1e-4 ? curPL.toExponential(1) : curPL.toFixed(4)}（p_th≈1%）`, 22, 186);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('p<p_th 纠错随 d 指数增益；p>p_th 探测洪涌、匹配失序（阈值演示值）', 22, 226);
    infoTex.needsUpdate = true;
  }

  const dm = new THREE.Object3D();
  const errs = new Uint8Array(D * D);
  function runRound(t: number): void {
    // 抽样错误
    nErr = 0;
    for (let q = 0; q < D * D; q++) {
      errs[q] = Math.random() < curP ? 1 : 0;
      if (errs[q]) nErr++;
      const i = Math.floor(q / D), j = q % D;
      dm.position.set(px(i), py(j), 0); dm.scale.setScalar(errs[q] ? 1 : 0.0001);
      dm.rotation.set(0, 0, 0); dm.updateMatrix(); errMesh.setMatrixAt(q, dm.matrix);
    }
    errMesh.instanceMatrix.needsUpdate = true;
    // 计算 Z 稳定子奇偶（位翻转＝X 错误，与 Z 稳定子反对易 ⇒ 触发绿色探测器）
    const syns: number[] = [];
    let nx = 0;
    ancs.forEach((an) => {
      if (an.isX) return;
      let par = 0;
      an.nb.forEach((q) => { par += errs[q]; });
      const on = par % 2 === 1;
      if (on) syns.push(nx);
      dm.position.set(an.x, an.y, 0.02); dm.scale.setScalar(on ? 1 : 0.0001);
      dm.updateMatrix(); synMesh.setMatrixAt(nx, dm.matrix);
      nx++;
    });
    synMesh.instanceMatrix.needsUpdate = true;
    nSyn = syns.length; totSyn += syns.length; rounds = Math.max(1, Math.floor(t / 2.2));
    // 贪心最近邻匹配
    const cand: { a: number; b: number; d: number }[] = [];
    for (let x = 0; x < syns.length; x++) for (let y = x + 1; y < syns.length; y++) {
      const aa = zAncs[syns[x]], bb = zAncs[syns[y]];
      cand.push({ a: syns[x], b: syns[y], d: (aa.x - bb.x) ** 2 + (aa.y - bb.y) ** 2 });
    }
    cand.sort((m, n) => m.d - n.d);
    const used = new Set<number>();
    const mp = matchGeo.attributes['position'].array as Float32Array;
    let mi = 0;
    for (const c of cand) {
      if (used.has(c.a) || used.has(c.b)) continue;
      used.add(c.a); used.add(c.b);
      mp[mi * 6] = zAncs[c.a].x; mp[mi * 6 + 1] = zAncs[c.a].y; mp[mi * 6 + 2] = 0.03;
      mp[mi * 6 + 3] = zAncs[c.b].x; mp[mi * 6 + 4] = zAncs[c.b].y; mp[mi * 6 + 5] = 0.03;
      mi++;
    }
    matchGeo.setDrawRange(0, mi * 2);
    matchGeo.attributes['position'].needsUpdate = true;
    // 落单 ⇒ 连最近的上下 Z 边界（Z 弦边界在上下边）
    const bp = blineGeo.attributes['position'].array as Float32Array;
    let bi = 0;
    for (const s of syns) {
      if (used.has(s)) continue;
      const an = zAncs[s];
      const ex: [number, number] = [an.x, an.y + Math.sign(an.y - LC.y) * (2.5 * A + bo)];
      bp[bi * 6] = an.x; bp[bi * 6 + 1] = an.y; bp[bi * 6 + 2] = 0.03;
      bp[bi * 6 + 3] = ex[0]; bp[bi * 6 + 4] = ex[1]; bp[bi * 6 + 5] = 0.03;
      bi++;
    }
    nBdry = bi;
    blineGeo.setDrawRange(0, bi * 2);
    blineGeo.attributes['position'].needsUpdate = true;
  }

  let lastR = -1;
  drawInfo();

  return {
    update(t, dt) {
      // 扫描错误率 p：0.1%→10%→0.1%，16s 对数余弦
      const u = 0.5 - 0.5 * Math.cos(TWO_PI * ((t % 16) / 16));
      curP = 0.001 * Math.pow(100, u);
      curPL = PLM(curP);
      wMark.position.set(WX(u), WY(curPL), 0);
      const ha = hGeo.attributes['position'].array as Float32Array;
      ha[0] = 1.2; ha[1] = WY(curPL); ha[2] = 0;
      ha[3] = WX(u); ha[4] = WY(curPL); ha[5] = 0;
      hGeo.attributes['position'].needsUpdate = true;

      const r = Math.floor(t / 2.2);
      if (r !== lastR) { lastR = r; runRound(t); }

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
