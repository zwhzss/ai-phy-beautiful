import type { SceneContext, SceneInstance } from '../types';
/** 量子霍尔效应（P45）：ν ∝ 1/B 的朗道能级填充 + 手性边缘态 ⇒ 霍尔电阻精确量子化且拓扑保护。 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const starGeo = new THREE.BufferGeometry();
  const starPts: import('three').Vector3[] = [];
  for (let i = 0; i < 500; i++) starPts.push(new THREE.Vector3((Math.random()-0.5)*200,(Math.random()-0.5)*200,(Math.random()-0.5)*200));
  starGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(starPts.flatMap(v=>[v.x,v.y,v.z])),3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true });
  group.add(new THREE.Points(starGeo, starMat));
  const grid = new THREE.GridHelper(20, 20, 0x334155, 0x1e293b);
  grid.position.y = -3.6;
  group.add(grid);

  // Landau levels visualization
  const numLevels = 8;
  const levelSpacing = 1.0;
  const levels: import("three").Mesh[] = [];

  for (let i = 0; i < numLevels; i++) {
    const y = (i - numLevels/2) * levelSpacing;
    const ringGeo = new THREE.TorusGeometry(2 + i * 0.3, 0.05, 8, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x818cf8 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = y;
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    levels.push(ring);
  }

  // Fermi level indicator（随 B 移动：固定 n_s 下 ν ∝ 1/B，E_F 在朗道能级间移动）
  const fermiGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-5, 0, 0),
    new THREE.Vector3(5, 0, 0)
  ]);
  const fermiMat = new THREE.LineBasicMaterial({ color: 0xf472b6 });
  const fermiLine = new THREE.Line(fermiGeo, fermiMat);
  group.add(fermiLine);

  // —— 填充因子与霍尔电阻 ——
  const B_REF = 8; // ν = 1（第一个平台）对应的磁场 (T)
  // ν = n_s·h/(eB) ∝ 1/B；钳制 ν ≥ 0.5 防止 round(ν)=0 发散
  function nuOf(B: number): number {
    return Math.max(0.5, B_REF / Math.max(B, 0.2));
  }
  // 平台上 R_xy = 1/n 精确量子化；过渡区回到经典线性 R_xy ∝ B
  function hallRxy(B: number): { R: number; trans: number } {
    const nu = nuOf(B);
    const n = Math.max(1, Math.round(nu));
    const d = nu - n;
    const ad = Math.min(1, Math.abs(d) / 0.5);
    const w = ad * ad * (3 - 2 * ad); // smoothstep：平台内 w≈0，过渡区 w→1
    return { R: 1 / (n + d * w), trans: w }; // 单位 h/e²
  }

  // Hall plateau graph
  const graphCanvas = document.createElement('canvas');
  graphCanvas.width = 512;
  graphCanvas.height = 384;
  const gctx = graphCanvas.getContext('2d')!;

  function drawHallPlateau(B_field: number) {
    gctx.fillStyle = '#0f172a';
    gctx.fillRect(0, 0, 512, 384);

    // Axes
    gctx.strokeStyle = '#475569';
    gctx.lineWidth = 2;
    gctx.beginPath();
    gctx.moveTo(60, 30);
    gctx.lineTo(60, 340);
    gctx.lineTo(490, 340);
    gctx.stroke();

    // Labels
    gctx.fillStyle = '#94a3b8';
    gctx.font = '14px monospace';
    gctx.fillText('B (T)', 460, 370);
    gctx.save();
    gctx.translate(15, 200);
    gctx.rotate(-Math.PI/2);
    gctx.fillText('R_xy (h/e²)', 0, 0);
    gctx.restore();

    const yOf = (R: number) => 340 - (R / 1.2) * 280;
    const steps = 300;

    // 理想样品：R_xy 随 B 上升的量子化阶梯（平台在整数 ν 处）
    gctx.strokeStyle = '#38bdf8';
    gctx.lineWidth = 3;
    gctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = 60 + (i / steps) * 430;
      const B = (i / steps) * 10;
      const y = yOf(hallRxy(B).R);
      if (i === 0) gctx.moveTo(x, y);
      else gctx.lineTo(x, y);
    }
    gctx.stroke();

    // 含杂质（无序）样品：仅在过渡区抖动，平台上与理想曲线重合 ⇒ 拓扑保护
    gctx.strokeStyle = '#f472b6';
    gctx.lineWidth = 2;
    gctx.setLineDash([5, 5]);
    gctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = 60 + (i / steps) * 430;
      const B = (i / steps) * 10;
      const { R, trans } = hallRxy(B);
      const y = yOf(R + 0.06 * Math.sin(B * 7.3) * trans);
      if (i === 0) gctx.moveTo(x, y);
      else gctx.lineTo(x, y);
    }
    gctx.stroke();
    gctx.setLineDash([]);

    // 平台标记（B = B_REF/ν 处，R_xy = 1/ν）
    gctx.fillStyle = '#fbbf24';
    gctx.font = '13px monospace';
    for (const n of [1, 2, 3, 4]) {
      const x = 60 + ((B_REF / n) / 10) * 430;
      gctx.beginPath();
      gctx.arc(x, yOf(1 / n), 5, 0, Math.PI * 2);
      gctx.fill();
      gctx.fillText(`ν=${n}`, x + 8, yOf(1 / n) - 8);
    }

    // 图例
    gctx.fillStyle = '#38bdf8';
    gctx.fillText('— 理想样品', 300, 50);
    gctx.fillStyle = '#f472b6';
    gctx.fillText('-- 含杂质（无序）', 300, 70);
    gctx.fillStyle = '#94a3b8';
    gctx.fillText('两线在平台上重合 ⇒ 拓扑保护', 70, 366);

    // Current B marker
    const Bx = 60 + (B_field / 10) * 430;
    gctx.strokeStyle = '#fbbf24';
    gctx.lineWidth = 1;
    gctx.setLineDash([4, 4]);
    gctx.beginPath();
    gctx.moveTo(Bx, 30);
    gctx.lineTo(Bx, 340);
    gctx.stroke();
    gctx.setLineDash([]);
  }

  drawHallPlateau(3.0);
  const graphTex = new THREE.CanvasTexture(graphCanvas);
  const graphGeo = new THREE.PlaneGeometry(6, 4.5);
  const graphMat = new THREE.MeshBasicMaterial({ map: graphTex });
  const graphMesh = new THREE.Mesh(graphGeo, graphMat);
  graphMesh.position.set(0, 0, -5);
  group.add(graphMesh);

  // —— 2DEG 样品与手性边缘态 ——
  const sampleW = 6, sampleD = 3.6;
  const sampleY = -2.8, flowY = -2.7;
  const sampleGeo = new THREE.BoxGeometry(sampleW, 0.08, sampleD);
  const sampleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.2, roughness: 0.8, transparent: true, opacity: 0.9 });
  const sample = new THREE.Mesh(sampleGeo, sampleMat);
  sample.position.y = sampleY;
  group.add(sample);
  const borderGeo = new THREE.EdgesGeometry(sampleGeo);
  const borderMat = new THREE.LineBasicMaterial({ color: 0x38bdf8 });
  const border = new THREE.LineSegments(borderGeo, borderMat);
  border.position.y = sampleY;
  group.add(border);

  // 样品内杂质（无序中心）—— 边缘态绕其而过，不发生 backscatter
  const impGeo = new THREE.SphereGeometry(0.1, 10, 10);
  const impMat = new THREE.MeshStandardMaterial({ color: 0xef4444 });
  for (let i = 0; i < 6; i++) {
    const imp = new THREE.Mesh(impGeo, impMat);
    imp.position.set((Math.random() - 0.5) * (sampleW - 1), flowY, (Math.random() - 0.5) * (sampleD - 1));
    group.add(imp);
  }

  // 边缘态流线：沿样品边界单向（手性）流动
  const hw = sampleW / 2, hd = sampleD / 2;
  const edgePerim = 4 * (hw + hd);
  const tmpV = new THREE.Vector3();
  function edgePos(s: number, out: import('three').Vector3) {
    const u = ((s % edgePerim) + edgePerim) % edgePerim;
    const w = 2 * hw, h = 2 * hd;
    if (u < w) out.set(-hw + u, 0, -hd);
    else if (u < w + h) out.set(hw, 0, -hd + (u - w));
    else if (u < 2 * w + h) out.set(hw - (u - w - h), 0, hd);
    else out.set(-hw, 0, hd - (u - 2 * w - h));
  }
  const dotGeo = new THREE.SphereGeometry(0.09, 10, 10);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
  const edgeDots: import('three').Mesh[] = [];
  const dotCount = 24;
  for (let i = 0; i < dotCount; i++) {
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.y = flowY;
    group.add(dot);
    edgeDots.push(dot);
  }
  // 四边各一个方向箭头，指示手性（单向）
  const edgeArrowDirs: import('three').Vector3[] = [
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, -1),
  ];
  const edgeArrowBases: import('three').Vector3[] = [
    new THREE.Vector3(0, flowY, -hd), new THREE.Vector3(hw, flowY, 0),
    new THREE.Vector3(0, flowY, hd), new THREE.Vector3(-hw, flowY, 0),
  ];
  for (let i = 0; i < 4; i++) {
    group.add(new THREE.ArrowHelper(edgeArrowDirs[i], edgeArrowBases[i], 0.9, 0x34d399, 0.25, 0.15));
  }

  // 标签
  function makeLabel(text: string, color: string, cw = 256): import("three").Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = 64;
    const c = canvas.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 30px "PingFang SC", sans-serif';
    c.textAlign = 'center';
    c.fillText(text, cw / 2, 42);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set((cw / 256) * 3, (cw / 256) * 0.75, 1);
    return sprite;
  }
  const labelEdge = makeLabel('手性边缘态（单向）', '#34d399', 384);
  labelEdge.position.set(-5.0, -2.1, 0);
  group.add(labelEdge);
  const labelBulk = makeLabel('朗道能级（体态绝缘）', '#818cf8', 384);
  labelBulk.position.set(0, 4.2, 0);
  group.add(labelBulk);

  // —— 信息面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 860; infoCv.height = 330;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = new THREE.CanvasTexture(infoCv);
  const infoSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false }));
  infoSprite.position.set(0, 6.4, 0);
  infoSprite.scale.set(8.6, 3.3, 1);
  infoSprite.renderOrder = 999;
  group.add(infoSprite);

  function drawInfo(B: number, nu: number, nFill: number, R: number) {
    infoCtx.clearRect(0, 0, 860, 330);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)';
    infoCtx.fillRect(4, 4, 852, 322);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 852, 322);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 28px "PingFang SC", sans-serif';
    infoCtx.fillText('量子霍尔效应：朗道能级 + 边缘态 ⇒ 霍尔电阻精确量子化', 22, 46);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '25px "PingFang SC", sans-serif';
    infoCtx.fillText('ν = n_s·h/(eB) ∝ 1/B            R_xy = h/(νe²)（平台 = h/e² 的整数分之一）', 22, 92);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('陈数 C = ν（整数）⇒ 拓扑保护：杂质/几何扰动不改变平台高度', 22, 136);
    infoCtx.fillStyle = '#34d399';
    infoCtx.fillText('体态：朗道能级离散、回旋运动被冻结（绝缘）', 22, 180);
    infoCtx.fillText('边界：手性边缘态单向导电，杂质无法 backscatter ⇒ 平台依旧量子化', 22, 222);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    infoCtx.fillText(`当前 B = ${B.toFixed(2)} T → ν = ${nu.toFixed(2)}，填充 ${nFill} 个朗道能级，C = ${Math.round(nu)}`, 22, 268);
    infoCtx.fillStyle = '#f59e0b'; infoCtx.font = '23px "PingFang SC", sans-serif';
    infoCtx.fillText(`R_xy = ${R.toFixed(3)} h/e² = ${(R * 25812.8).toFixed(0)} Ω`, 22, 308);
    infoTex.needsUpdate = true;
  }
  {
    const nu = nuOf(3.0);
    drawInfo(3.0, nu, Math.min(numLevels, Math.max(1, Math.ceil(nu))), hallRxy(3.0).R);
  }

  // Electron orbits (cyclotron motion)
  const orbits: import("three").Line[] = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const r = 0.8 + Math.random() * 0.5;
    const pts: import('three').Vector3[] = [];
    for (let j = 0; j <= 64; j++) {
      const a = (j / 64) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    const orbitGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const orbitMat = new THREE.LineBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.5 });
    const orbit = new THREE.Line(orbitGeo, orbitMat);
    orbit.position.set(
      (Math.random() - 0.5) * 4,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2
    );
    group.add(orbit);
    orbits.push(orbit);
  }

  let B_field = 3.0;
  return {
    update(t, dt) {
      B_field = 3.0 + Math.sin(t * 0.5) * 2.0; // 1 ~ 5 T
      const { R } = hallRxy(B_field);
      drawHallPlateau(B_field);

      // 朗道能级：B 增大 → 简并度 ∝ B 上升 → 固定 n_s 下 E_F 在能级间移动
      const nu = nuOf(B_field);
      const nFill = Math.min(numLevels, Math.max(1, Math.ceil(nu)));
      fermiLine.position.y = (Math.min(numLevels, Math.max(0.5, nu)) - numLevels / 2 - 0.5) * levelSpacing;
      levels.forEach((level, i) => {
        const mat = level.material as import('three').MeshBasicMaterial;
        mat.color.setHex(i < nFill ? 0x6ee7b7 : 0x475569); // 已填充能级点亮
        const pulse = 1 + 0.05 * Math.sin(t * 2 + i);
        level.scale.set(pulse, pulse, pulse);
      });

      drawInfo(B_field, nu, nFill, R);
      graphTex.needsUpdate = true;

      // 手性边缘态沿样品边界单向流动
      for (let i = 0; i < edgeDots.length; i++) {
        edgePos(t * 1.3 + (i * edgePerim) / edgeDots.length, tmpV);
        edgeDots[i].position.set(tmpV.x, flowY, tmpV.z);
      }

      // Animate orbits
      orbits.forEach((orbit, idx) => {
        orbit.rotation.y += dt * (1.5 + idx * 0.1);
        orbit.position.y = Math.sin(t + idx) * 0.3;
      });
    },
    dispose() {
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points || obj instanceof THREE.Sprite) {
          (obj as any).geometry?.dispose();
          const mat = (obj as any).material;
          if (Array.isArray(mat)) mat.forEach((m: any) => { m.map?.dispose(); m.dispose(); });
          else if (mat) { mat.map?.dispose(); mat.dispose(); }
        }
      });
      starGeo.dispose(); starMat.dispose();
      graphTex.dispose();
      infoTex.dispose();
    }
  };
}
