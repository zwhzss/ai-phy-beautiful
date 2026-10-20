import type { SceneContext, SceneInstance } from '../types';
/**
 * 引力透镜时间延迟（P287）：点质量+外剪切透镜的多像、放大率与 Fermat 时延。
 * 主控方程：透镜方程 β = θ − θ_E²·θ̂/|θ|² − γ(θx,−θy)（牛顿多始点 Newton 解像点位置）；
 * 放大率 μ = 1/det(∂β/∂θ)；Fermat 势 ϕ(θ)=½|θ−β|²−ψ(θ)，ψ=θ_E²ln|θ|+½γ(θx²−θy²)，
 * Δt = (1+z_l)·D_l·D_s/(c·D_ls)·Δϕ̂ ⇒ 1″²×1Gpc ≈ 28 天（哈勃常数几何直测）。
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
  const starPos = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 400;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 400;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 400;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // —— 天球平面：世界 (y, z) ↔ 透镜平面坐标 (x1, x2)，单位 = θ_E ——
  const SKYX = -3.6;          // 平面所在世界 x
  const WU = 1.35;            // 1 θ_E 的世界尺寸
  const TH_E = 1.0;           // 爱因斯坦半径（θ_E 单位）
  const GAMMA = 0.38;         // 外剪切 ⇒ 四像构型
  const D_AN = 28;            // (1+z)D_lD_s/D_ls ≈ 1 Gpc ⇒ 1″² ↔ 28 天

  // 真实源位置（θ_E 单位）随时间扫描
  let betaX = 0.25, betaY = 0.1;

  // 透镜方程与 Jacobian
  function alpha(x: number, y: number): [number, number] {
    const r2 = x * x + y * y;
    const c = r2 > 1e-9 ? TH_E * TH_E / r2 : 1e9;
    return [c * x + GAMMA * x, c * y - GAMMA * y];
  }
  function betaOf(x: number, y: number): [number, number] {
    const a = alpha(x, y);
    return [x - a[0], y - a[1]];
  }
  function jac(x: number, y: number): number {
    const r2 = x * x + y * y, r4 = r2 * r2;
    const e = TH_E * TH_E;
    const A11 = 1 - e * (y * y - x * x) / r4 - GAMMA;
    const A12 = e * 2 * x * y / r4;
    const A21 = A12;
    const A22 = 1 - e * (x * x - y * y) / r4 + GAMMA;
    return A11 * A22 - A12 * A21;
  }
  // 势与 Fermat 时延（θ_E 单位）
  function fermat(x: number, y: number): number {
    const r2 = Math.max(x * x + y * y, 1e-9);
    const [bx, by] = [betaX, betaY];
    return 0.5 * ((x - bx) * (x - bx) + (y - by) * (y - by)) - TH_E * TH_E * 0.5 * Math.log(r2) - 0.5 * GAMMA * (x * x - y * y);
  }

  // Newton 多始点求像
  interface Img { x: number; y: number; mu: number; tau: number }
  function solveImages(): Img[] {
    const starts: [number, number][] = [
      [1.4, 0.2], [-1.4, -0.2], [0.2, 1.4], [-0.2, -1.4],
      [2.2, 2.2], [-2.2, 2.2], [2.2, -2.2], [-2.2, -2.2],
      [0.6, 0.6], [-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6],
    ];
    const out: Img[] = [];
    for (const [sx, sy] of starts) {
      let x = sx, y = sy, ok = false;
      for (let it = 0; it < 50; it++) {
        const r2 = x * x + y * y;
        if (r2 < 0.02) break;
        const [bbx, bby] = betaOf(x, y);
        const fx = bbx - betaX, fy = bby - betaY;
        if (Math.hypot(fx, fy) < 1e-9) { ok = true; break; }
        // J = ∂β/∂θ
        const r4 = r2 * r2, e = TH_E * TH_E;
        const J11 = 1 - e * (y * y - x * x) / r4 - GAMMA;
        const J12 = e * 2 * x * y / r4;
        const J21 = J12;
        const J22 = 1 - e * (x * x - y * y) / r4 + GAMMA;
        const det = J11 * J22 - J12 * J21;
        if (Math.abs(det) < 1e-8) break;
        const dx = (J22 * fx - J12 * fy) / det;
        const dy = (-J21 * fx + J11 * fy) / det;
        x -= dx; y -= dy;
        if (!isFinite(x) || !isFinite(y)) break;
        if (Math.abs(dx) < 1e-11 && Math.abs(dy) < 1e-11) { ok = true; break; }
      }
      if (!ok || Math.abs(x) > 8 || Math.abs(y) > 8) continue;
      const [fbx, fby] = betaOf(x, y);
      if (Math.hypot(fbx - betaX, fby - betaY) > 1e-6) continue;
      let dup = false;
      for (const o of out) if (Math.hypot(o.x - x, o.y - y) < 0.02) { dup = true; break; }
      if (dup) continue;
      const det = jac(x, y);
      out.push({ x, y, mu: 1 / det, tau: fermat(x, y) });
    }
    return out;
  }

  // —— 平面背景与爱因斯坦环 ——
  {
    const board = new THREE.Mesh(geo(new THREE.PlaneGeometry(9, 9)), mat(new THREE.MeshBasicMaterial({ color: 0x0b1220, transparent: true, opacity: 0.5, side: THREE.DoubleSide })));
    board.rotation.y = Math.PI / 2;
    board.position.x = SKYX - 0.02;
    group.add(board);
    const pts: import('three').Vector3[] = [];
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      pts.push(new THREE.Vector3(SKYX, Math.cos(a) * TH_E * WU, Math.sin(a) * TH_E * WU));
    }
    group.add(new THREE.Line(geo(new THREE.BufferGeometry().setFromPoints(pts)), mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));
  }

  // 透镜星系核
  const lensGal = new THREE.Mesh(geo(new THREE.SphereGeometry(0.24, 16, 16)), mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 0.9 })));
  lensGal.position.set(SKYX + 0.1, 0, 0);
  group.add(lensGal);
  // 背景类星体源
  const srcMark = new THREE.Mesh(geo(new THREE.SphereGeometry(0.12, 12, 12)), mat(new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.4, transparent: true, opacity: 0.55 })));
  srcMark.position.set(SKYX + 0.1, 0, 0);
  group.add(srcMark);

  // 像点池（4 个：球+光晕）
  const imgPool: {
    dot: import('three').Mesh<import('three').BufferGeometry, import('three').MeshStandardMaterial>;
    glow: import('three').Mesh;
  }[] = [];
  const dotGeo = geo(new THREE.SphereGeometry(0.1, 14, 12));
  const glowGeo = geo(new THREE.SphereGeometry(0.2, 14, 12));
  for (let i = 0; i < 4; i++) {
    const dot = new THREE.Mesh(dotGeo, mat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 1.6 })));
    const glow = new THREE.Mesh(glowGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.14, depthWrite: false })));
    group.add(dot, glow);
    imgPool.push({ dot, glow });
  }
  // 光路（每条 8 段折点：源→透镜像位置→观测者）
  const PATH_N = 4;
  const paths: { line: import('three').Line, pos: Float32Array }[] = [];
  for (let i = 0; i < PATH_N; i++) {
    const g = geo(new THREE.BufferGeometry());
    const pos = new Float32Array(4 * 3); // 源(真)→像→观测者：3 点足够，加 1 备用
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const l = new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.4 })));
    group.add(l);
    paths.push({ line: l, pos });
  }

  // 脉冲前锋小球（每像一颗，相位按 Δt 偏移）
  const runners: import('three').Mesh[] = [];
  const runGeo = geo(new THREE.SphereGeometry(0.07, 10, 10));
  for (let i = 0; i < PATH_N; i++) {
    const m = new THREE.Mesh(runGeo, mat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0xffffff, emissiveIntensity: 1.8 })));
    group.add(m);
    runners.push(m);
  }

  function makeLabel(text: string, color: string, scale = 3.0): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(scale, scale / 8, 1);
    s.renderOrder = 998;
    return s;
  }
  const lLens = makeLabel('前景星系（质量势）', '#fbbf24', 2.8); lLens.position.set(SKYX + 0.2, 0.9, 0); group.add(lLens);
  const lSrc = makeLabel('类星体（背光）', '#ef4444', 2.4); lSrc.position.set(SKYX + 0.2, -0.85, 0); group.add(lSrc);
  const lObs = makeLabel('地球观测者', '#22c55e', 2.6); lObs.position.set(4.4, 0.8, 0); group.add(lObs);
  const obsPos = new THREE.Vector3(4.6, 0, 0);
  const obsMark = new THREE.Mesh(geo(new THREE.SphereGeometry(0.14, 12, 12)), mat(new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.8 })));
  obsMark.position.copy(obsPos);
  group.add(obsMark);

  const infoCv = document.createElement('canvas');
  infoCv.width = 512; infoCv.height = 256;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const info = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  info.scale.set(7.4, 3.7, 1);
  info.position.set(0.4, 4.2, 0);
  info.renderOrder = 999;
  group.add(info);

  let nImg = 0, maxDt = 0, u = 0;

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 512, 256);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)';
    infoCtx.fillRect(3, 3, 506, 250);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3;
    infoCtx.strokeRect(3, 3, 506, 250);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText('强引力透镜 · 时间延迟', 14, 36);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '21px "PingFang SC", sans-serif';
    infoCtx.fillText('β=θ−θ_E²θ̂/θ²−γ(θx,−θy) ⇒ 多像', 14, 72);
    infoCtx.fillText('Δt=D_∞·Δϕ̂/c，ϕ̂=½|θ−β|²−ψ(θ)', 14, 100);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('μ=1/det(∂β/∂θ)：像亮暗由 Jacobian 定', 14, 128);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 20px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数: u=β/θ_E=${u.toFixed(3)}  像数 ${nImg}（γ=0.38）`, 14, 162);
    infoCtx.fillText(`最大时延 Δt=${maxDt.toFixed(1)} 天 (D_∞~28d/″²)`, 14, 192);
    infoCtx.fillText('SN Refsdal 型：测 Δt ⇒ 几何定 H₀', 14, 226);
    infoTex.needsUpdate = true;
  }

  function relDays(t1: number, t0: number): number {
    // ϕ̂ 以 θ_E² 单位；1″²×1Gpc/c≈28d；θ_E≈1″ ⇒ Δt[d]=28·Δϕ̂·(θ_E[″])²
    return D_AN * (t1 - t0);
  }

  function refresh(): void {
    const imgs = solveImages();
    nImg = imgs.length;
    u = Math.hypot(betaX, betaY);
    if (imgs.length) {
      const tau0 = Math.min(...imgs.map((im) => im.tau));
      maxDt = relDays(Math.max(...imgs.map((im) => im.tau)), tau0);
    } else maxDt = 0;
    srcMark.position.set(SKYX + 0.1, betaY * WU, betaX * WU);
    for (let i = 0; i < 4; i++) {
      const show = i < imgs.length;
      imgPool[i].dot.visible = imgPool[i].glow.visible = show;
      paths[i].line.visible = show;
      runners[i].visible = show;
      if (!show) continue;
      const im = imgs[i];
      const wy = im.y * WU, wz = im.x * WU;
      const P = new THREE.Vector3(SKYX, wy, wz);
      imgPool[i].dot.position.copy(P);
      imgPool[i].glow.position.copy(P);
      const size = Math.min(2.4, Math.sqrt(Math.abs(im.mu)) * 0.9);
      imgPool[i].dot.scale.setScalar(0.5 + size * 0.4);
      imgPool[i].glow.scale.setScalar(0.6 + size * 0.7);
      const mc = im.mu < 0;
      imgPool[i].dot.material.emissive.setHex(mc ? 0xf472b6 : 0x22d3ee);
      imgPool[i].dot.material.color.setHex(mc ? 0xf472b6 : 0x22d3ee);
      const pp = paths[i].pos;
      pp[0] = SKYX + 0.1; pp[1] = betaY * WU; pp[2] = betaX * WU;
      pp[3] = SKYX; pp[4] = wy; pp[5] = wz;
      pp[6] = obsPos.x; pp[7] = obsPos.y; pp[8] = obsPos.z;
      pp[9] = obsPos.x; pp[10] = obsPos.y; pp[11] = obsPos.z;
      paths[i].line.geometry.attributes['position'].needsUpdate = true;
    }
    return;
  }

  drawInfo();

  return {
    update(t, dt) {
      // 18 s 周期：源位置绕透镜像旋转并扫描对准度 u=β/θ_E：0.08→0.6（θ_E 单位）
      const cyc = (t % 18) / 18;
      const tri = 0.5 - 0.5 * Math.cos(Math.PI * 2 * cyc);
      const betaR = 0.08 + tri * 0.52;
      const ang = t * 0.34;
      betaX = betaR * Math.cos(ang);
      betaY = betaR * Math.sin(ang);        // 圆轨道：不压扁，否则 u=|β|/θ_E 与真实对准度不符
      refresh();

      // 脉冲前锋按各像 Fermat 时延错峰出发（周期 3 s，相位差 ∝ Δt/maxDt）
      const imgs = solveImages();
      if (imgs.length) {
        const tau0 = Math.min(...imgs.map((im) => im.tau));
        const span = Math.max(1e-6, Math.max(...imgs.map((im) => im.tau)) - tau0);
        for (let i = 0; i < imgs.length; i++) {
          const off = (imgs[i].tau - tau0) / span;
          const f = ((t / 3 - off) % 1 + 1) % 1;
          const im = imgs[i];
          const A = new THREE.Vector3(SKYX + 0.1, betaY * WU, betaX * WU);
          const B = new THREE.Vector3(SKYX, im.y * WU, im.x * WU);
          const P = f < 0.55 ? A.clone().lerp(B, f / 0.55) : B.clone().lerp(obsPos, (f - 0.55) / 0.45);
          runners[i].position.copy(P);
          runners[i].visible = true;
        }
      }
      for (let i = imgs.length; i < PATH_N; i++) runners[i].visible = false;

      lensGal.scale.setScalar(1 + 0.06 * Math.sin(t * 2));
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
      void dt;
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
