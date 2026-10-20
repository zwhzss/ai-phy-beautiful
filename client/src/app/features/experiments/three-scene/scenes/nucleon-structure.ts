import type { SceneContext, SceneInstance } from '../types';
/** 核子结构与夸克（P170）：质子 = 三个价夸克(uud) + 胶子交换 + 海夸克对涨落；高能电子深度非弹性散射
 *  打出部分子 ⇒ 沿锥面张开的强子喷注（锥半角 ∝ Λ_jet/E 收窄）+ 质子碎片向后反冲。
 *  部分子分布用 DGLAP 趋势的参数化模型（小 x 胶子/海夸克随 lnQ² 上升、大 x 价夸克下降）：
 *  val=x^{½}(1−x)^{3+2.2ℓ}(1−0.55ℓx)、sea=x^{−(0.15+0.35ℓ)}(1−x)⁷、glu=x^{−(0.3+0.45ℓ)}(1−x)^{5−2ℓ}，
 *  ℓ=ln(Q²/4)/ln250∈[0,1]，Q² 以 16s 在 4→1000 GeV² 对数扫描——演化墙即这三条公式的曲面。
 *  核对锚点：ΣQ=2·⅔−⅓=+1（电荷）；组成夸克磁矩 μu=1.852、μd=−0.972 ⇒ μp=(4μu−μd)/3=2.793、μn=(4μd−μu)/3=−1.913（实验值！比 −1.46）。 */
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
  const PC = new THREE.Vector3(-2.6, 2.9, 0);   // 质子中心
  let q2 = 40, xv = 0.05;

  // —— 质子壳 ——
  const shell = new THREE.Mesh(geo(new THREE.SphereGeometry(1.15, 24, 18)), mat(new THREE.MeshBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.2 })));
  shell.position.copy(PC); group.add(shell);
  const shellWire = new THREE.Mesh(shell.geometry, mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.12 })));
  shellWire.position.copy(PC); group.add(shellWire);

  // —— 三价夸克 + 胶子弹簧 ——
  const qGeo = geo(new THREE.SphereGeometry(0.11, 10, 10));
  const uMat = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
  const dMat = mat(new THREE.MeshBasicMaterial({ color: 0xa855f7 }));
  const quarks = [new THREE.Mesh(qGeo, uMat), new THREE.Mesh(qGeo, uMat), new THREE.Mesh(qGeo, dMat)];
  quarks.forEach((m) => group.add(m));
  const qPhase = [0, 2.1, 4.2];
  const springMat = mat(new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.7 }));
  const springs: import('three').BufferGeometry[] = [];
  for (let k = 0; k < 3; k++) {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18 * 3), 3));
    group.add(new THREE.Line(g, springMat));
    springs.push(g);
  }
  function drawSpring(g: import('three').BufferGeometry, a: import('three').Vector3, b: import('three').Vector3, t: number, seed: number): void {
    const arr = g.attributes['position'].array as Float32Array;
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length(); dir.normalize();
    const perp = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
    for (let i = 0; i < 18; i++) {
      const u = i / 17;
      const wig = Math.sin(u * Math.PI * 6 + t * 5 + seed) * 0.07 * Math.sin(Math.PI * u);
      arr[i * 3] = a.x + dir.x * len * u + perp.x * wig;
      arr[i * 3 + 1] = a.y + dir.y * len * u + perp.y * wig;
      arr[i * 3 + 2] = a.z + dir.z * len * u + perp.z * wig;
    }
    g.attributes['position'].needsUpdate = true;
  }

  // —— 海夸克对（涨落）——
  const NSEA = 7;
  const seaGeo = geo(new THREE.SphereGeometry(0.045, 6, 6));
  const seaMatA = mat(new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.8 }));
  const seaMatB = mat(new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.8 }));
  const seaQ: import('three').Mesh[] = [];
  for (let i = 0; i < NSEA; i++) {
    const a = new THREE.Mesh(seaGeo, seaMatA), b = new THREE.Mesh(seaGeo, seaMatB);
    group.add(a, b); seaQ.push(a, b);
  }

  // —— DIS：入射电子 / 散射电子 / 强子喷注 / 碎片 ——
  const eInGeo = geo(new THREE.BufferGeometry());
  eInGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0.9, 2.2, 0, PC.x + 1.0, PC.y + 0.15, 0]), 3));
  group.add(new THREE.Line(eInGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 }))));
  const eOutGeo = geo(new THREE.BufferGeometry());
  eOutGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  group.add(new THREE.Line(eOutGeo, mat(new THREE.LineBasicMaterial({ color: 0xfef08a }))));
  const vtxDot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.07, 10, 10)), mat(new THREE.MeshBasicMaterial({ color: 0xffffff })));
  vtxDot.position.set(PC.x + 1.0, PC.y + 0.15, 0); group.add(vtxDot);
  const NJET = 11;
  const jetGeo = geo(new THREE.BufferGeometry());
  const jetPos = new Float32Array(NJET * 6);
  jetGeo.setAttribute('position', new THREE.BufferAttribute(jetPos, 3));
  const jetMat = mat(new THREE.LineBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.9 }));
  group.add(new THREE.LineSegments(jetGeo, jetMat));
  const remnantGeo = geo(new THREE.BufferGeometry());
  remnantGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  group.add(new THREE.Line(remnantGeo, mat(new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.7 }))));
  const remnantBall = new THREE.Mesh(geo(new THREE.SphereGeometry(0.16, 10, 10)), mat(new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.6 })));
  group.add(remnantBall);

  // —— PDF 演化墙（x–lnQ² 曲面，三种部分子三层）——
  const lq = (Q2: number): number => Math.log(Q2 / 4) / Math.log(250);
  const fVal = (x: number, Q2: number): number => { const l = Math.min(1, Math.max(0, lq(Q2))); return Math.sqrt(x) * Math.pow(1 - x, 3 + 2.2 * l) * (1 - 0.55 * l * x); };
  const fSea = (x: number, Q2: number): number => { const l = Math.min(1, Math.max(0, lq(Q2))); return Math.pow(x, -(0.15 + 0.35 * l)) * Math.pow(1 - x, 7) * 0.3; };
  const fGlu = (x: number, Q2: number): number => { const l = Math.min(1, Math.max(0, lq(Q2))); return Math.pow(x, -(0.3 + 0.45 * l)) * Math.pow(1 - x, 5 - 2 * l) * 0.08; };
  const WALL = 2.75;                       // 墙中心
  const NX = 34, NQ = 22;
  function makeSheet(hf: (x: number, Q2: number) => number, hcap: number, color: number, zo: number): import('three').Mesh {
    const g = geo(new THREE.BufferGeometry());
    const pos = new Float32Array((NX + 1) * (NQ + 1) * 3);
    const idx: number[] = [];
    for (let i = 0; i <= NX; i++) {
      const x = 0.004 + (0.6 - 0.004) * (i / NX);
      for (let j = 0; j <= NQ; j++) {
        const Q2 = 4 * Math.pow(250, j / NQ);
        const v = i * (NQ + 1) + j;
        const XW = WALL - 2.0 + 4.0 * (Math.log10(x / 0.004) / Math.log10(0.6 / 0.004));
        pos[v * 3] = XW;
        pos[v * 3 + 1] = 1.15 + 2.3 * Math.min(1, hf(x, Q2) / hcap);
        pos[v * 3 + 2] = zo + 1.5 * (j / NQ);
      }
    }
    for (let i = 0; i < NX; i++) for (let j = 0; j < NQ; j++) {
      const a = i * (NQ + 1) + j, b = a + 1, c = a + NQ + 1, e = c + 1;
      idx.push(a, b, c, b, e, c);
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, mat(new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.55, side: THREE.DoubleSide })));
    group.add(m);
    return m;
  }
  // 每面按其公式在墙上的真实最大值做显示归一（非物理量、纯比例常数），使小 x 上升/大 x 压低的演化不被 min(1,·) 削平：
  // 墙上实际峰值 fGlu_max≈4.97、fSea_max≈4.61、fVal_max≈0.238。
  makeSheet(fGlu, 5.0, 0x22d3ee, -0.05);
  makeSheet(fSea, 4.65, 0xfbbf24, 0.55);
  makeSheet(fVal, 0.24, 0x22c55e, 1.15);
  // 当前 Q² 切片竖线（与扫描同源）
  const sliceGeo = geo(new THREE.BufferGeometry());
  sliceGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  group.add(new THREE.Line(sliceGeo, mat(new THREE.LineBasicMaterial({ color: 0xef4444 }))));

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
  const lbGlu = makeLabel('胶子 g(x,Q²)：小 x 陡升', '#22d3ee', 3.2); lbGlu.position.set(WALL - 1.5, 4.05, -0.05); group.add(lbGlu);
  const lbVal = makeLabel('价夸克：大 x 压低', '#22c55e', 2.8); lbVal.position.set(WALL + 1.6, 4.05, 1.15); group.add(lbVal);
  const lbAxis = makeLabel('横轴 log x →　纵轴 f　深度 ln Q² →', '#94a3b8', 3.4); lbAxis.position.set(WALL, 0.62, 0.9); group.add(lbAxis);

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

  let gluRatio = 1, valFall = 1, jetName = '价夸克';
  const mu = 1.852, md = -0.972;
  const mup = (4 * mu - md) / 3, mun = (4 * md - mu) / 3;
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 840, 300);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 832, 292);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 832, 292);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText('F₂(x,Q²)=Σe_q²·x·q(x,Q²)：电子撞出点状部分子 ⇒ 标度破坏由 DGLAP 演化', 22, 40);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '24px "PingFang SC", sans-serif';
    infoCtx.fillText(`电荷核对 ΣQ=2·⅔−⅓=+1；μp=(4μ_u−μ_d)/3=${mup.toFixed(3)}（实 2.793）、μn=${mun.toFixed(3)}（实 −1.913）`, 22, 78);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('喷注：被击部分子碎裂成锥内强子，锥半角∝1/E；剩余夸克成靶碎片反冲', 22, 112);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：Q²=${q2.toFixed(0)} GeV²  x_bj=${xv.toFixed(2)} ⇒ 击中了${jetName}`, 22, 152);
    infoCtx.fillText(`g(0.01,Q²)/g(0.01,4)=${gluRatio.toFixed(1)}↑  v(0.45,Q²)/v(0.45,4)=${valFall.toFixed(2)}↓`, 22, 186);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('胶子裂变 g→qq̄ 使小 x 海夸克增殖；大 x 价夸克把动量让给软胶子', 22, 226);
    infoTex.needsUpdate = true;
  }

  function pickEvent(cycle: number): void {
    const h = (n: number): number => { const s = Math.sin(n * 269.5 + 183.7) * 43758.5453; return s - Math.floor(s); };
    xv = 0.01 + 0.5 * h(cycle * 3 + 1);
    jetName = xv > 0.25 ? '价夸克' : h(cycle * 3 + 2) > 0.5 ? '海夸克' : '胶子';
  }
  pickEvent(0);

  // 喷注方向（沿入射电子动量偏折后前向）
  const jetDir = new THREE.Vector3(0.9, 0.35, 0.15).normalize();
  const hash2 = (i: number, j: number): number => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };

  drawInfo();

  return {
    update(t, dt) {
      // 扫描 Q²：4→1000 GeV²，16s 对数余弦
      const u = 0.5 - 0.5 * Math.cos(TWO_PI * ((t % 16) / 16));
      q2 = 4 * Math.pow(250, u);
      gluRatio = fGlu(0.01, q2) / fGlu(0.01, 4);
      valFall = fVal(0.45, q2) / fVal(0.45, 4);

      // 价夸克轨道 + 胶子弹簧
      quarks.forEach((m, i) => {
        const w = 0.8 + 0.2 * i;
        m.position.set(
          PC.x + 0.62 * Math.cos(w * t * 0.7 + qPhase[i]),
          PC.y + 0.5 * Math.sin(w * t * 0.9 + qPhase[i] * 1.3),
          PC.z + 0.6 * Math.sin(w * t * 0.6 + qPhase[i]),
        );
      });
      drawSpring(springs[0], quarks[0].position, quarks[1].position, t, 0);
      drawSpring(springs[1], quarks[1].position, quarks[2].position, t, 2);
      drawSpring(springs[2], quarks[2].position, quarks[0].position, t, 4);

      // 海夸克对：涨落（生命周期 ~ 依 Q²：Q² 越高越活跃）
      const seaAct = 0.4 + 0.6 * lq(q2);
      for (let i = 0; i < NSEA; i++) {
        const a = seaQ[i * 2], b = seaQ[i * 2 + 1];
        const ph = (t * seaAct + hash2(i, 5) * 7) % 6;
        const alive = ph < 3;
        const sep = 0.5 * Math.sin((ph / 3) * Math.PI);
        const ang = hash2(i, 9) * TWO_PI, r0 = 0.75 * hash2(i, 13);
        const px = PC.x + r0 * Math.cos(ang), py = PC.y + r0 * Math.sin(ang) * 0.8, pz = PC.z + 0.4 * Math.sin(ang * 2);
        a.visible = alive; b.visible = alive;
        a.position.set(px - sep, py, pz); b.position.set(px + sep, py, pz);
      }

      // DIS 事件周期 8s
      const cycle = Math.floor(t / 8);
      pickEvent(cycle);
      const age = t - cycle * 8;
      const grow = Math.min(1, age / 1.1);
      const strike = new THREE.Vector3(PC.x + 1.0, PC.y + 0.15, 0);
      const eAng = 0.5 + 0.6 * lq(q2);                 // Q² 越大散射角越大
      const eo = new THREE.Vector3(Math.cos(eAng), Math.sin(eAng), 0.15).normalize();
      const eArr = eOutGeo.attributes['position'].array as Float32Array;
      eArr[0] = strike.x; eArr[1] = strike.y; eArr[2] = strike.z;
      eArr[3] = strike.x + eo.x * 2.1 * grow; eArr[4] = strike.y + eo.y * 2.1 * grow; eArr[5] = strike.z + eo.z * 2.1 * grow;
      eOutGeo.attributes['position'].needsUpdate = true;
      // 喷注锥：半角 ∝ Λ_jet/E 收窄（微扰碎裂：固定横动量 kT∼Λ_jet ⇒ θ≈Λ_jet/E；Ejet=(1−x)·40GeV）
      const Ejet = (1 - xv) * 40;
      const LAMJET = 3.5;                             // 显示标定 Λ_jet（GeV）：E=19.6→0.179rad、E=39.6→0.088rad
      const cone = Math.max(0.08, LAMJET / Ejet);
      const jLen = 1.2 + Ejet * 0.03;
      const basis = new THREE.Vector3(0, 0, 1).cross(jetDir).normalize();
      const b2 = jetDir.clone().cross(basis).normalize();
      for (let i = 0; i < NJET; i++) {
        const a1 = hash2(i, 21) * TWO_PI, tilt = cone * (0.3 + 0.7 * hash2(i, 22));
        const d = jetDir.clone().multiplyScalar(Math.cos(tilt))
          .addScaledVector(basis, Math.sin(tilt) * Math.cos(a1))
          .addScaledVector(b2, Math.sin(tilt) * Math.sin(a1)).normalize();
        const L = jLen * (0.65 + 0.35 * hash2(i, 23)) * grow;
        jetPos[i * 6] = strike.x; jetPos[i * 6 + 1] = strike.y; jetPos[i * 6 + 2] = strike.z;
        jetPos[i * 6 + 3] = strike.x + d.x * L; jetPos[i * 6 + 4] = strike.y + d.y * L; jetPos[i * 6 + 5] = strike.z + d.z * L;
      }
      jetGeo.attributes['position'].needsUpdate = true;
      jetMat.color.setHex(jetName === '价夸克' ? 0x22c55e : jetName === '海夸克' ? 0x22d3ee : 0xa855f7);
      // 碎片反冲
      const rArr = remnantGeo.attributes['position'].array as Float32Array;
      const rdir = new THREE.Vector3(-0.85, -0.25, -0.1).normalize();
      rArr[0] = strike.x; rArr[1] = strike.y; rArr[2] = strike.z;
      rArr[3] = strike.x + rdir.x * 1.6 * grow; rArr[4] = strike.y + rdir.y * 1.6 * grow; rArr[5] = strike.z + rdir.z * 1.6 * grow;
      remnantGeo.attributes['position'].needsUpdate = true;
      remnantBall.position.set(strike.x + rdir.x * 1.6 * grow, strike.y + rdir.y * 1.6 * grow, strike.z + rdir.z * 1.6 * grow);

      // 当前 Q² 切片标记线（墙上）
      const zq = -0.05 + 1.5 * (Math.log(q2 / 4) / Math.log(250));
      const sArr = sliceGeo.attributes['position'].array as Float32Array;
      sArr[0] = WALL - 2.0; sArr[1] = 1.1; sArr[2] = zq;
      sArr[3] = WALL + 2.0; sArr[4] = 1.1; sArr[5] = zq;
      sliceGeo.attributes['position'].needsUpdate = true;

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
