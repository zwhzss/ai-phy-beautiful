import type { SceneContext, SceneInstance } from '../types';
/** 分支点与多值函数（P562）：w = √z = √r·e^{iφ/2}，φ 取遍 [0,4π) 得到两张叶黏合成的黎曼面。
 *  画面高度取 Im w = √r·sin(φ/2)：第一叶（φ∈[0,2π)）在上、第二叶在下，绕分支点 z=0 螺旋相连。
 *  动点沿 |z|=ρ(t) 圆周连续绕行（20s 走完 4π = 两圈）：一圈后 arg w 增 π ⇒ w→−w 落到另一叶，
 *  两圈才回到原叶原点——这正是"多值性 = 定义域需展开成曲面"的几何化。
 *  顶点色 = arg w 的色相（标准 domain coloring 相位轮）；割线（φ=0 射线）是两叶缝合边，
 *  第一叶周期性"掀开"（演示位移，非真实几何）露出下层。√z 与 ln z 共享同一分支点结构。 */
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
  const RS = 1.05;                    // 半径世界缩放
  const AMP = 1.5;                    // Im w 高度放大
  const NR = 12, NP = 132;            // 叶面网格（NP 覆盖 φ∈[0,4π]）
  let lift = 0;                       // 掀叶演示量

  const surfGeo = geo(new THREE.BufferGeometry());
  const nV = (NR + 1) * (NP + 1);
  const surfPos = new Float32Array(nV * 3);
  const surfCol = new Float32Array(nV * 3);
  surfGeo.setAttribute('position', new THREE.BufferAttribute(surfPos, 3));
  surfGeo.setAttribute('color', new THREE.BufferAttribute(surfCol, 3));
  {
    const idx: number[] = [];
    for (let i = 0; i < NR; i++) for (let j = 0; j < NP; j++) {
      const a = i * (NP + 1) + j, b = a + 1, c = a + NP + 1, e = c + 1;
      idx.push(a, b, c, b, e, c);
    }
    surfGeo.setIndex(idx);
  }
  const surfMesh = new THREE.Mesh(surfGeo, mat(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.62, side: THREE.DoubleSide })));
  const wireMesh = new THREE.Mesh(surfGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.09, side: THREE.DoubleSide })));
  surfMesh.position.y = 1.6; wireMesh.position.y = 1.6;
  group.add(surfMesh, wireMesh);

  const tmpCol = new THREE.Color();
  function sheetY(r: number, ph: number): number {
    return AMP * Math.sqrt(r) * Math.sin(ph / 2) + (ph < TWO_PI ? lift : 0);
  }
  function updateSurface(): void {
    let v = 0;
    for (let i = 0; i <= NR; i++) {
      const r = 0.22 + (3.9 - 0.22) * (i / NR);
      for (let j = 0; j <= NP; j++) {
        const ph = (j / NP) * 4 * Math.PI;
        const wArg = ph / 2;                         // arg w ∈ [0, 2π)
        surfPos[v * 3] = r * Math.cos(ph) * RS;
        surfPos[v * 3 + 1] = sheetY(r, ph);
        surfPos[v * 3 + 2] = r * Math.sin(ph) * RS;
        tmpCol.setHSL(((wArg % TWO_PI) / TWO_PI + 1) % 1, 0.85, 0.34 + 0.42 * Math.min(1, Math.sqrt(r) / 2));
        surfCol[v * 3] = tmpCol.r; surfCol[v * 3 + 1] = tmpCol.g; surfCol[v * 3 + 2] = tmpCol.b;
        v++;
      }
    }
    surfGeo.attributes['position'].needsUpdate = true;
    surfGeo.attributes['color'].needsUpdate = true;
  }

  // —— 分支点与割线（缝合边）——
  const bp = new THREE.Mesh(geo(new THREE.SphereGeometry(0.1, 12, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xef4444 })));
  bp.position.y = 1.6; group.add(bp);
  const cutGeo = geo(new THREE.BufferGeometry());
  const cutPos = new Float32Array(10 * 3);
  cutGeo.setAttribute('position', new THREE.BufferAttribute(cutPos, 3));
  const cutLine = new THREE.Line(cutGeo, mat(new THREE.LineDashedMaterial({ color: 0xef4444, dashSize: 0.14, gapSize: 0.09 })));
  cutLine.position.y = 1.6; group.add(cutLine);
  function updateCut(): void {
    for (let i = 0; i < 10; i++) {
      const r = 0.15 + (3.9 / 9) * i;
      cutPos[i * 3] = r * RS; cutPos[i * 3 + 1] = 0.02; cutPos[i * 3 + 2] = 0;
    }
    cutGeo.attributes['position'].needsUpdate = true;
    cutLine.computeLineDistances();
  }
  // 两叶沿割线的缝合边（第一叶 φ→0⁺、第二叶 φ→4π⁻，各 9 段线段）
  const seamGeo = geo(new THREE.BufferGeometry());
  const seamPos = new Float32Array(2 * 9 * 2 * 3);
  seamGeo.setAttribute('position', new THREE.BufferAttribute(seamPos, 3));
  const seam = new THREE.LineSegments(seamGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.8 })));
  seam.position.y = 1.6; group.add(seam);
  function updateSeam(): void {
    let k = 0;
    for (let s = 0; s < 2; s++) {
      const ph = s === 0 ? 0.02 : 4 * Math.PI - 0.02;
      for (let i = 0; i < 9; i++) {
        const r0 = 0.15 + (3.9 / 9) * i, r1 = 0.15 + (3.9 / 9) * (i + 1);
        seamPos[k * 3] = r0 * Math.cos(ph) * RS; seamPos[k * 3 + 1] = sheetY(r0, ph); seamPos[k * 3 + 2] = r0 * Math.sin(ph) * RS; k++;
        seamPos[k * 3] = r1 * Math.cos(ph) * RS; seamPos[k * 3 + 1] = sheetY(r1, ph); seamPos[k * 3 + 2] = r1 * Math.sin(ph) * RS; k++;
      }
    }
    seamGeo.attributes['position'].needsUpdate = true;
  }

  // —— 动点 + 轨迹 + z 矢量 ——
  const mover = new THREE.Mesh(geo(new THREE.SphereGeometry(0.11, 14, 14)), mat(new THREE.MeshBasicMaterial({ color: 0x22c55e })));
  group.add(mover);
  const TRAIL = 420;
  const trailGeo = geo(new THREE.BufferGeometry());
  const trailPos = new Float32Array(TRAIL * 3);
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setDrawRange(0, 0);
  group.add(new THREE.Line(trailGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85 }))));
  const zVecGeo = geo(new THREE.BufferGeometry());
  zVecGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const zVec = new THREE.Line(zVecGeo, mat(new THREE.LineBasicMaterial({ color: 0xf472b6 })));
  zVec.position.y = 1.6; group.add(zVec);
  const baseRingGeo = geo(new THREE.RingGeometry(0.02, 3.9 * RS, 64));
  const baseRing = new THREE.Mesh(baseRingGeo, mat(new THREE.MeshBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.18, side: THREE.DoubleSide })));
  baseRing.rotation.x = -Math.PI / 2; baseRing.position.y = 1.61; group.add(baseRing);

  // —— z 平面投影：影点（同一 z 的两叶 ⇔ 一个投影点两个函数值）+ 叶间竖直连线 + 相位轮针 ——
  const shadow = new THREE.Mesh(geo(new THREE.SphereGeometry(0.09, 12, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  group.add(shadow);
  const connGeo = geo(new THREE.BufferGeometry());
  connGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  group.add(new THREE.Line(connGeo, mat(new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.6 }))));
  const dialGeo = geo(new THREE.BufferGeometry());
  dialGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  dialGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array([0.13, 0.77, 0.37, 0.13, 0.77, 0.37, 0.98, 0.75, 0.14, 0.94, 0.27, 0.27]), 3));
  group.add(new THREE.LineSegments(dialGeo, mat(new THREE.LineBasicMaterial({ vertexColors: true }))));
  const dialRGeo = geo(new THREE.RingGeometry(0.94, 1.0, 48));
  const dialRing = new THREE.Mesh(dialRGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.4, side: THREE.DoubleSide })));
  dialRing.rotation.x = -Math.PI / 2; dialRing.position.set(0, 0.16, 3.4); group.add(dialRing);
  const labDial = makeLabel('相位轮：绿针 arg z，金红针 arg w（速率差 2 倍）', '#22c55e', 4.4);
  labDial.position.set(0, 0.62, 3.4); group.add(labDial);

  function makeLabel(text: string, color: string, scale = 3.4): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 28px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  const labS1 = makeLabel('第一叶（Im √z > 0）', '#22d3ee'); labS1.position.set(-2.6, 4.2, 0); group.add(labS1);
  const labS2 = makeLabel('第二叶（Im √z < 0，绕行一圈后到达）', '#a855f7', 4.6); labS2.position.set(2.2, 0.2, 0); group.add(labS2);
  const labBp = makeLabel('分支点 z=0：绕它一周 w→−w', '#ef4444', 3.8); labBp.position.set(0, -0.9, 0); group.add(labBp);

  // —— 面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 840; infoCv.height = 288;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.2, 3.16)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 6.0, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  let phiP = 0, rhoP = 3, imW = 0, loopsDone = 0;
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 840, 288);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 832, 280);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 832, 280);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText('w = √z = √r·e^{iφ/2}：φ 与 φ+2π 给同一 z、相差一个 w→−w', 22, 40);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '24px "PingFang SC", sans-serif';
    infoCtx.fillText('绕分支点一周：arg w 增 π（w 反号，落到另一叶）；两周增 2π 才复原', 22, 78);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('割线 = 两叶的缝合边（约定可任选）；ln z = ln r + iφ 同构：φ→φ+2π ⇒ ln z 差 +2πi', 22, 112);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：arg z=${((phiP % TWO_PI) * 57.2958).toFixed(0)}° 累计 φ=${(phiP * 57.2958).toFixed(0)}°  arg w=${((phiP / 2) * 57.2958).toFixed(0)}°  Im w=${imW.toFixed(2)}  已完成 ${(loopsDone).toFixed(1)} 圈`, 22, 152);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText(`顶点色相 = arg w（相位轮）；|z|=ρ=${rhoP.toFixed(1)}（动点在 z 平面的投影半径），两叶沿割线连续，掀叶仅为演示`, 22, 196);
    infoCtx.fillText('若只在看 z 平面：路径闭合、函数值却不闭合 ⇒ 必须把定义域展开成双叶曲面', 22, 230);
    infoCtx.fillText(`影点（底面）：|z| 相同时 z 平面针转快、arg w 针转慢一半（2:1 缠绕）`, 22, 262);
    infoTex.needsUpdate = true;
  }

  let trailN = 0, lastStamp = -1, lastCycle = -1;
  updateSurface(); updateCut(); updateSeam(); drawInfo();

  return {
    update(t, dt) {
      // 周期 20s 走完 4π（两圈）；半径 13s 呼吸；16s 掀一次上层
      const cyc = Math.floor(t / 20);
      phiP = ((t % 20) / 20) * 4 * Math.PI;
      rhoP = 2.5 + 1.1 * Math.sin(TWO_PI * ((t % 13) / 13));
      loopsDone = phiP / TWO_PI;
      lift = 0.8 * Math.max(0, Math.sin(Math.PI * ((t % 16) / 16)));
      updateSurface(); updateCut(); updateSeam();

      const x = rhoP * Math.cos(phiP) * RS, zc = rhoP * Math.sin(phiP) * RS;
      const y = sheetY(rhoP, phiP);
      mover.position.set(x, y + 1.6, zc);
      imW = Math.sqrt(rhoP) * Math.sin(phiP / 2);

      const zArr = zVecGeo.attributes['position'].array as Float32Array;
      zArr[0] = 0; zArr[1] = 0; zArr[2] = 0; zArr[3] = x; zArr[4] = y; zArr[5] = zc;
      zVecGeo.attributes['position'].needsUpdate = true;

      // 投影影点 + 叶间连线 + 相位轮双针（arg z 与 arg w，速率 2:1）
      shadow.position.set(x, 0.06, zc);
      const cn = connGeo.attributes['position'].array as Float32Array;
      cn[0] = x; cn[1] = 0.06; cn[2] = zc; cn[3] = x; cn[4] = y + 1.6; cn[5] = zc;
      connGeo.attributes['position'].needsUpdate = true;
      const dl = dialGeo.attributes['position'].array as Float32Array;
      const dz = phiP % TWO_PI, dw = (phiP / 2) % TWO_PI;
      dl[0] = 0; dl[1] = 0.17; dl[2] = 0; dl[3] = Math.cos(dz) * 0.92; dl[4] = 0.17; dl[5] = Math.sin(dz) * 0.92;
      dl[6] = 0; dl[7] = 0.19; dl[8] = 0; dl[9] = Math.cos(dw) * 0.78; dl[10] = 0.19; dl[11] = Math.sin(dw) * 0.78;
      dialGeo.attributes['position'].needsUpdate = true;

      // 轨迹：每 0.05s 记一点，线性填充，20s 周期首重开
      if (cyc !== lastCycle) { lastCycle = cyc; trailN = 0; lastStamp = -1; trailGeo.setDrawRange(0, 0); }
      if (Math.floor(t * 20) !== lastStamp && trailN < TRAIL) {
        lastStamp = Math.floor(t * 20);
        trailPos[trailN * 3] = x; trailPos[trailN * 3 + 1] = y + 1.6; trailPos[trailN * 3 + 2] = zc;
        trailN++;
        trailGeo.setDrawRange(0, trailN);
      }
      trailGeo.attributes['position'].needsUpdate = true;
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
