import type { SceneContext, SceneInstance } from '../types';
/**
 * 骨骼与胶原复合力学（P343）—— 主控方程组：
 *   复合固相模量（Voigt/Reuss 界限）  E_V = f·E_HA+(1−f)·E_coll，E_R = 1/(f/E_HA+(1−f)/E_coll)
 *   Wolff 应力适配（杆件重塑）        r_target ∝ r₀·(0.3 + 3.2·s)，  s = (n̂·d̂)²  (轴向应力 ∝ 主应力方向投影²)
 *   松质骨泡沫标度（Gibson–Ashby）    E_foam/E_s = 0.2·(ρ_foam/ρ_s)²，  ρ_foam/ρ_s ∝ ⟨(r/r₀)²⟩
 * 载荷主方向 n̂ 绕竖直轴旋转（18 s 一周），骨小梁随局部应力 (n̂·d̂)² 逐帧增粗/削薄，
 * 相对密度 ρ_foam 与有效模量 E_foam、杆件半径与配色全部由同一 s 值驱动；胶原三螺旋为有机相基元。
 */
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
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  grid.position.y = -3.4; group.add(grid);

  // —— 复合物性常数 ——
  const E_HA = 110, E_coll = 2;      // GPa：磷灰石 / 胶原
  const fMin = 0.6;                   // 矿物体积分数
  const E_V = fMin * E_HA + (1 - fMin) * E_coll;
  const E_R = 1 / (fMin / E_HA + (1 - fMin) / E_coll);
  const E_s = 0.5 * (E_V + E_R);      // 取中间值近似固相模量

  // —— 骨小梁网络：随机节点 + 近邻连线 ——
  const rng = (seed: number) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };
  const rand = rng(20261013);
  const nodes: import('three').Vector3[] = [];
  for (let i = 0; i < 34; i++) {
    nodes.push(new THREE.Vector3((rand() - 0.5) * 5.5, (rand() - 0.5) * 5.0, (rand() - 0.5) * 5.5));
  }
  const edgeSeen = new Set<string>();
  const edges: { a: import('three').Vector3; b: import('three').Vector3; d: import('three').Vector3 }[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const dist = nodes.map((n, j) => ({ j, l: n.distanceTo(nodes[i]) })).filter((o) => o.j !== i).sort((p, q) => p.l - q.l);
    for (let k = 0; k < 3 && k < dist.length; k++) {
      const j = dist[k].j;
      if (dist[k].l > 3.4) continue;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (edgeSeen.has(key)) continue;
      edgeSeen.add(key);
      edges.push({ a: nodes[i], b: nodes[j], d: nodes[j].clone().sub(nodes[i]).normalize() });
    }
  }

  const R0 = 0.07;
  const UP = new THREE.Vector3(0, 1, 0);
  const strutGeo = geo(new THREE.CylinderGeometry(1, 1, 1, 10, 1, false));
  type Strut = { mesh: import('three').Mesh; mat: import('three').MeshStandardMaterial; dir: import('three').Vector3; len: number; mid: import('three').Vector3; r: number };
  const struts: Strut[] = [];
  for (const e of edges) {
    const m = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, metalness: 0.1, roughness: 0.6, emissive: 0x000000 });
    mat(m);
    const mesh = new THREE.Mesh(strutGeo, m);
    const mid = e.a.clone().add(e.b).multiplyScalar(0.5);
    mesh.position.copy(mid);
    mesh.quaternion.setFromUnitVectors(UP, e.d);
    group.add(mesh);
    struts.push({ mesh, mat: m, dir: e.d, len: e.a.distanceTo(e.b), mid, r: R0 });
  }
  // 节点小球
  const nodeGeo = geo(new THREE.SphereGeometry(0.1, 10, 10));
  const nodeMat = mat(new THREE.MeshStandardMaterial({ color: 0xcbfbf4, roughness: 0.4 }));
  nodes.forEach((n) => { const s = new THREE.Mesh(nodeGeo, nodeMat); s.position.copy(n); group.add(s); });

  // —— 主应力载荷箭头 ——
  const loadMat = mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
  const loadLineGeo = geo(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 3, 0)]));
  const loadLine = new THREE.Line(loadLineGeo, loadMat);
  group.add(loadLine);
  const loadTip = new THREE.Mesh(geo(new THREE.ConeGeometry(0.19, 0.5, 12)), loadMat);
  group.add(loadTip);
  const loadPos = loadLineGeo.attributes['position'] as import('three').BufferAttribute;

  // —— 胶原三螺旋 + 磷灰石板层（有机相基元） ——
  const helixGroup = new THREE.Group(); helixGroup.position.set(-4.4, -2.4, 0); group.add(helixGroup);
  const ptsForPhase = (phase: number) => {
    const p: import('three').Vector3[] = [];
    for (let i = 0; i <= 60; i++) {
      const u = i / 60, a = u * Math.PI * 2 * 1.6 + phase;
      p.push(new THREE.Vector3(Math.cos(a) * 0.28, u * 2.4 - 1.2, Math.sin(a) * 0.28));
    }
    return p;
  };
  const collMat = mat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, roughness: 0.5 }));
  [0, (Math.PI * 2) / 3, (4 * Math.PI) / 3].forEach((ph) => {
    const curve = new THREE.CatmullRomCurve3(ptsForPhase(ph));
    const tg = geo(new THREE.TubeGeometry(curve, 60, 0.06, 6, false));
    helixGroup.add(new THREE.Mesh(tg, collMat));
  });
  const plateGeo = geo(new THREE.BoxGeometry(0.34, 0.05, 0.14));
  const plateMat = mat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 }));
  for (let i = 0; i < 8; i++) {
    const pl = new THREE.Mesh(plateGeo, plateMat);
    const u = (i + 0.5) / 8, a = u * Math.PI * 2 * 1.6;
    pl.position.set(Math.cos(a) * 0.28, u * 2.4 - 1.2, Math.sin(a) * 0.28);
    pl.rotation.y = a;
    helixGroup.add(pl);
  }

  // —— 标签 ——
  function makeLabel(text: string, color: string, scale = 3.4): import('three').Sprite {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 25px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1); return s;
  }
  const lat = makeLabel('骨小梁网络（Wolff 应力适配）', '#e7e5e4', 4.4); lat.position.set(0, 3.4, 0); group.add(lat);
  const lh = makeLabel('胶原三螺旋+磷灰石板层', '#22d3ee', 4.0); lh.position.set(-4.4, -0.4, 0); group.add(lh);
  const lload = makeLabel('主应力方向 n̂', '#fbbf24', 2.6); lload.position.set(1.4, 3.6, 0); group.add(lload);

  // —— 信息面板 ——
  const infoCv = document.createElement('canvas'); infoCv.width = 860; infoCv.height = 300;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoSprite = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  infoSprite.position.set(0, 5.9, 0); infoSprite.scale.set(9.8, 3.4, 1); infoSprite.renderOrder = 999;
  group.add(infoSprite);

  let nDir = new THREE.Vector3(0, 1, 0), dens = 0.15, Eff = E_s * 0.2 * dens * dens, meanR = R0, maxS = 0;

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 860, 300);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(4, 4, 852, 292);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 852, 292);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 25px "PingFang SC", sans-serif';
    infoCtx.fillText('骨与胶原复合力学 — Wolff 定律 + Gibson–Ashby 泡沫标度', 20, 38);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText(`固相 E_V=⟨Voigt⟩=${E_V.toFixed(0)} GPa, E_R=⟨Reuss⟩=${E_R.toFixed(1)} GPa → E_s≈${E_s.toFixed(0)} GPa`, 20, 74);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('杆件应力 s=(n̂·d̂)² ⇒ r∝0.3+3.2·s；相对密度 ρ*∝⟨(r/r₀)²⟩', 20, 108);
    infoCtx.fillStyle = '#f472b6';
    infoCtx.fillText(`E*/E_s = 0.2·(ρ*/ρ_s)² → 有效模量随骨小梁增粗急剧上升`, 20, 142);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 23px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：n̂ = (${nDir.x.toFixed(2)},${nDir.y.toFixed(2)},${nDir.z.toFixed(2)})  ρ*/ρ_s = ${dens.toFixed(2)}  E* = ${Eff.toFixed(1)} GPa`, 20, 184);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText(`⟨r⟩ = ${meanR.toFixed(3)} (r₀=${R0})   最大轴向应力 s = ${maxS.toFixed(2)}`, 20, 220);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  return {
    update(t, dt) {
      const cycle = t % 18;
      const th = (cycle / 18) * Math.PI * 2;
      nDir = new THREE.Vector3(Math.sin(th), Math.cos(th), 0.25 * Math.sin(th * 0.5)).normalize();

      // 主应力方向更新箭头
      (loadPos.array as Float32Array)[3] = nDir.x * 3;
      (loadPos.array as Float32Array)[4] = nDir.y * 3;
      (loadPos.array as Float32Array)[5] = nDir.z * 3;
      loadPos.needsUpdate = true;
      loadTip.position.copy(nDir.clone().multiplyScalar(3.25));
      loadTip.quaternion.setFromUnitVectors(UP, nDir);

      let sumSq = 0, sumR = 0; maxS = 0;
      for (const st of struts) {
        const s = Math.pow(nDir.dot(st.dir), 2);
        if (s > maxS) maxS = s;
        const target = R0 * (0.3 + 3.2 * s);
        st.r += (target - st.r) * Math.min(1, dt * 1.6);    // 重塑速率有限 → 可见“逐帧增粗/削薄”
        st.mesh.scale.set(st.r, st.len, st.r);
        sumSq += (st.r / R0) * (st.r / R0);
        sumR += st.r;
        // 应力配色：高应力红、低应力冷灰
        const k = Math.min(1, s / 0.7);
        st.mat.emissive.setRGB(0.55 * k, 0.08 * k, 0.02 * k);
        st.mat.emissiveIntensity = 0.6 + 1.4 * k;
      }
      dens = Math.min(0.6, 0.15 * (sumSq / struts.length));
      meanR = sumR / struts.length;
      Eff = E_s * 0.2 * dens * dens;
      helixGroup.rotation.y = t * 0.4;

      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
      scene.remove(helixGroup);
    },
  };
}
