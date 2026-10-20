import type { SceneContext, SceneInstance } from '../types';
/**
 * 简正模式与耦合振子（P35）：N 个质量块由相邻弹簧连接、两端固定于壁（fixed–fixed 链）。
 *   边界条件 u_{-1}=u_N=0 ⇒ 本征模形 φ_m(i)=sin(mπ(i+1)/(N+1))，m=1..N
 *   色散/本征频率 ω_m = 2√(k/m)·sin(mπ/(2(N+1)))  —— 与振型同源于同一固定端边界
 *   任意小振动是简正模的叠加：u_i(t)=Σ_m a_m φ_m(i)cos(ω_m t) —— 概念「模态叠加」
 * 画面按序轮播各单阶模式，末尾演示 m2+m3 叠加的一般运动（两模频差产生拍）。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  const starGeo = geo(new THREE.BufferGeometry());
  const starPts: import('three').Vector3[] = [];
  for (let i = 0; i < 500; i++) starPts.push(new THREE.Vector3((Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200));
  starGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(starPts.flatMap((v) => [v.x, v.y, v.z])), 3));
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  const grid = new THREE.GridHelper(20, 20, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  grid.position.y = -3;
  group.add(grid);

  const N = 6;
  const spacing = 1.2;
  const baseX = Array.from({ length: N }, (_, i) => (i - (N - 1) / 2) * spacing);
  const wallX = ((N + 1) / 2) * spacing; // 两固定壁 x=±wallX

  // —— 本征频率与振型（固定端链，同源于边界条件 u_{-1}=u_N=0）——
  const omega = new Array<number>(N + 1).fill(0);
  for (let m = 1; m <= N; m++) omega[m] = 2 * Math.sin(m * Math.PI / (2 * (N + 1)));
  const phi = (m: number, i: number): number => Math.sin((m * Math.PI * (i + 1)) / (N + 1));

  // 质量块
  const massGeo = geo(new THREE.SphereGeometry(0.25, 16, 16));
  const masses: import('three').Mesh[] = [];
  for (let i = 0; i < N; i++) {
    const mesh = new THREE.Mesh(massGeo, mat(new THREE.MeshBasicMaterial({ color: 0x38bdf8 })));
    mesh.position.set(baseX[i], 0, 0);
    group.add(mesh);
    masses.push(mesh);
  }

  // 固定壁（两端）
  const wallGeo = geo(new THREE.BoxGeometry(0.2, 2.6, 1.6));
  const wallMat = mat(new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.4 }));
  for (const s of [-1, 1]) { const w = new THREE.Mesh(wallGeo, wallMat); w.position.set(s * wallX, 0, 0); group.add(w); }

  // 弹簧（相邻连线：壁-块-…-块-壁，共 N+1 段，端点接壁处 y 恒为 0）
  const springMat = mat(new THREE.LineBasicMaterial({ color: 0x94a3b8 }));
  const springs: import('three').Line[] = [];
  for (let s = 0; s <= N; s++) {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(g, springMat);
    group.add(line);
    springs.push(line);
  }
  // 弹簧两端：s=0 壁(-wallX,0)→块0；s=N 块(N-1)→壁(wallX,0)；否则块 s-1→块 s
  const springEnd = (s: number): [number[], number[]] => {
    const left: number[] = s === 0 ? [-wallX, 0, 0] : [masses[s - 1].position.x, masses[s - 1].position.y, 0];
    const right: number[] = s === N ? [wallX, 0, 0] : [masses[s].position.x, masses[s].position.y, 0];
    return [left, right];
  };
  function syncSprings(): void {
    for (let s = 0; s <= N; s++) {
      const [l, r] = springEnd(s);
      const a = springs[s].geometry.attributes['position'] as import('three').BufferAttribute;
      a.setXYZ(0, l[0], l[1], l[2]);
      a.setXYZ(1, r[0], r[1], r[2]);
      a.needsUpdate = true;
    }
  }

  // —— 频率谱图（固定端 ω_m）——
  const graphCanvas = document.createElement('canvas');
  graphCanvas.width = 512; graphCanvas.height = 384;
  const gctx = graphCanvas.getContext('2d')!;
  function drawModeSpectrum(active: number, isSuper: boolean): void {
    gctx.fillStyle = '#0f172a';
    gctx.fillRect(0, 0, 512, 384);
    gctx.strokeStyle = '#475569'; gctx.lineWidth = 2;
    gctx.beginPath(); gctx.moveTo(60, 30); gctx.lineTo(60, 340); gctx.lineTo(490, 340); gctx.stroke();
    gctx.fillStyle = '#94a3b8'; gctx.font = '14px monospace';
    gctx.fillText('模数 m', 220, 370);
    gctx.save(); gctx.translate(15, 210); gctx.rotate(-Math.PI / 2); gctx.fillText('ω (√(k/m) 单位)', 0, 0); gctx.restore();
    gctx.fillText('固定端链 ω_m=2sin(mπ/2(N+1))', 78, 24);
    for (let n = 1; n <= N; n++) {
      const w = omega[n];
      const px = 60 + (n / (N + 1)) * 430;
      const py = 340 - w * 150;
      const on = (isSuper && (n === 2 || n === 3)) || (!isSuper && n === active);
      gctx.strokeStyle = on ? '#fbbf24' : '#38bdf8';
      gctx.lineWidth = on ? 4 : 3;
      gctx.beginPath(); gctx.moveTo(px, 340); gctx.lineTo(px, py); gctx.stroke();
      gctx.fillStyle = on ? '#fbbf24' : '#f472b6';
      gctx.beginPath(); gctx.arc(px, py, 6, 0, Math.PI * 2); gctx.fill();
      gctx.fillStyle = '#e2e8f0'; gctx.font = '12px monospace';
      gctx.fillText(`m=${n}`, px - 10, 360);
      gctx.fillText(`${w.toFixed(2)}`, px - 12, py - 10);
    }
  }

  const graphTex = tex(new THREE.CanvasTexture(graphCanvas));
  const graphMesh = new THREE.Mesh(geo(new THREE.PlaneGeometry(6, 4.5)), mat(new THREE.MeshBasicMaterial({ map: graphTex })));
  graphMesh.position.set(0, 0, -5);
  group.add(graphMesh);

  // —— 5Hz 读数面板（公式 + 当前模式/频率/周期）——
  const CW = 720, CH = 200;
  const infoCv = document.createElement('canvas'); infoCv.width = CW; infoCv.height = CH;
  const ic = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const panel = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  panel.scale.set(7.2, 7.2 * CH / CW, 1); panel.position.set(0, 4.3, 0); panel.renderOrder = 999;
  group.add(panel);
  const rd = { m: 1, super: false };
  function drawInfo(): void {
    ic.clearRect(0, 0, CW, CH);
    ic.fillStyle = 'rgba(7,11,20,0.86)'; ic.fillRect(2, 2, CW - 4, CH - 4);
    ic.strokeStyle = '#334155'; ic.lineWidth = 3; ic.strokeRect(2, 2, CW - 4, CH - 4);
    ic.textAlign = 'left';
    ic.fillStyle = '#f8fafc'; ic.font = 'bold 24px "PingFang SC", sans-serif';
    ic.fillText('简正模式（固定端链 N=6）', 18, 32);
    ic.fillStyle = '#22d3ee'; ic.font = '21px "PingFang SC", sans-serif';
    ic.fillText('ω_m = 2√(k/m)·sin(mπ/2(N+1))   φ_m(i)=sin(mπ(i+1)/(N+1))', 18, 66);
    ic.fillStyle = '#a855f7';
    ic.fillText('一般运动 = 各简正模叠加  u_i(t)=Σ a_m·φ_m(i)·cos(ω_m t)', 18, 98);
    ic.fillStyle = '#fbbf24'; ic.font = 'bold 24px "PingFang SC", sans-serif';
    if (rd.super) {
      ic.fillText(`读数：模态叠加 m=2+3   ω₂=${omega[2].toFixed(3)}  ω₃=${omega[3].toFixed(3)}   拍频 Δω=${(omega[3] - omega[2]).toFixed(3)}`, 18, 138);
    } else {
      ic.fillText(`读数：第 ${rd.m} 阶模  ω=${omega[rd.m].toFixed(3)}  周期 T=2π/ω=${(2 * Math.PI / omega[rd.m]).toFixed(2)} s`, 18, 138);
    }
    ic.fillStyle = '#94a3b8'; ic.font = '20px "PingFang SC", sans-serif';
    ic.fillText('两端固定 ⇒ 无 m=0 平动模；最高模 m=N 存在（区别于自由端链）', 18, 176);
    infoTex.needsUpdate = true;
  }

  // —— 激励系数（单模或叠加），逐帧写入质量块位移 ——
  const a = new Array<number>(N + 1).fill(0);
  const SLOT = 3, SLOTS = N + 1;

  drawModeSpectrum(1, false); drawInfo(); syncSprings();

  return {
    update(t, dt) {
      const cyc = ((t % (SLOT * SLOTS)) + SLOT * SLOTS) % (SLOT * SLOTS);
      const slot = Math.floor(cyc / SLOT);
      a.fill(0);
      if (slot < N) { a[slot + 1] = 1; rd.super = false; rd.m = slot + 1; }
      else { a[2] = 0.85; a[3] = 0.5; rd.super = true; }

      for (let i = 0; i < N; i++) {
        let y = 0;
        for (let m = 1; m <= N; m++) if (a[m] !== 0) y += a[m] * phi(m, i) * Math.cos(omega[m] * t);
        masses[i].position.set(baseX[i], y * 1.35, 0);
      }
      syncSprings();

      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) { drawModeSpectrum(rd.m, rd.super); drawInfo(); }
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
