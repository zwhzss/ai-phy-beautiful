import type { SceneContext, SceneInstance } from '../types';
/**
 * 原子钟（P326）—— 主控方程：铯-133 基态超精细跃迁定义一秒，及拉姆齐分离振荡场干涉条纹
 *   ν_Cs = ΔE/h = 9 192 631 770 Hz（SI 定义值）   ⇒  1 s = 9 192 631 770 个该辐射周期
 *   拉姆齐条纹  P(F=4) = ½·(1 + cos(2π·δ·T))   （δ=失谐 Hz，T=两次穿腔的自由演化时间）
 *   条纹间隔 Δδ = 1/T；误差判别式 ε = −½·sin(2π·δ·T) 在 δ=0 过零 → 锁定钟频
 *   品质因数 Q = ν₀/Δν = ν₀·T ~ 3.7×10⁹（T=0.4 s）；六束激光对冷 µK，竖直上抛使其两次穿同一微波腔
 * 扫描微波失谐 δ（±3.5 Hz，周期 16 s）：条纹曲线、锁定标记、误差判别式与面板读数同源。
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

  // —— 常数 ——
  const NU0 = 9192631770;          // Hz（SI 定义的 Cs-133 超精细跃迁频率）
  const T_RAMSEY = 0.4;            // s 自由演化（≈ 1/T=2.5 Hz 条纹间隔）
  const DMAX = 3.5;                // 扫描失谐范围 Hz

  const MOT_X = -3.2, MOT_Y = -1.9, CAV_Y = -0.5;

  // —— 真空腔（喷泉管）——
  const tube = new THREE.Mesh(
    geo(new THREE.CylinderGeometry(0.9, 0.9, 5.4, 24, 1, true)),
    mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.14, roughness: 0.5, side: THREE.DoubleSide })),
  );
  tube.position.set(MOT_X, MOT_Y + 2.4, 0); group.add(tube);

  // —— 微波腔（横置金属罐，上下开孔供原子两次穿过）——
  const cavity = new THREE.Mesh(
    geo(new THREE.CylinderGeometry(1.15, 1.15, 0.8, 24)),
    mat(new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.7, roughness: 0.3 })),
  );
  cavity.position.set(MOT_X, CAV_Y, 0); group.add(cavity);

  // —— 六束对激光（三正交对，汇聚于 MOT 点）——
  const beamGeo = geo(new THREE.CylinderGeometry(0.05, 0.05, 3.0, 8));
  const beamMat = mat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.8, transparent: true, opacity: 0.85 }));
  const beamDir = [
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
  ];
  const Y_AXIS = new THREE.Vector3(0, 1, 0);
  beamDir.forEach((d) => {
    const b = new THREE.Mesh(beamGeo, beamMat);
    b.quaternion.setFromUnitVectors(Y_AXIS, d);
    b.position.set(MOT_X + d.x * 1.6, MOT_Y + d.y * 1.6, d.z * 1.6);
    group.add(b);
  });
  // MOT 冷原子团
  const motGlow = new THREE.Mesh(geo(new THREE.SphereGeometry(0.35, 18, 14)), mat(new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.8 })));
  motGlow.position.set(MOT_X, MOT_Y, 0); group.add(motGlow);

  // —— 上抛原子云（喷泉弹道穿腔两次）——
  const atomGeo = geo(new THREE.SphereGeometry(0.09, 8, 8));
  const atomMat = mat(new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.6 }));
  const ATOM_N = 14;
  const atoms: { m: import('three').Mesh; seed: number }[] = [];
  for (let i = 0; i < ATOM_N; i++) { const m = new THREE.Mesh(atomGeo, atomMat); group.add(m); atoms.push({ m, seed: (i / ATOM_N) }); }

  // —— 拉姆齐条纹曲线面板（右侧竖直面）——
  const plotX = 3.4, plotBaseY = -2.2, plotW = 3.4, plotH = 3.4;
  const PLOT_N = 220;
  const fringeGeo = geo(new THREE.BufferGeometry());
  const fringePos = new Float32Array(PLOT_N * 3);
  fringeGeo.setAttribute('position', new THREE.BufferAttribute(fringePos, 3));
  group.add(new THREE.Line(fringeGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee }))));
  const errGeo = geo(new THREE.BufferGeometry());
  const errPos = new Float32Array(PLOT_N * 3);
  errGeo.setAttribute('position', new THREE.BufferAttribute(errPos, 3));
  group.add(new THREE.Line(errGeo, mat(new THREE.LineBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.8 }))));
  // 坐标轴
  const axesGeo = geo(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(plotX - plotW / 2, plotBaseY, 0), new THREE.Vector3(plotX + plotW / 2, plotBaseY, 0),
    new THREE.Vector3(plotX - plotW / 2, plotBaseY, 0), new THREE.Vector3(plotX - plotW / 2, plotBaseY + plotH, 0),
  ]));
  group.add(new THREE.Line(axesGeo, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));
  // 当前 δ 标记
  const marker = new THREE.Mesh(geo(new THREE.SphereGeometry(0.15, 12, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  group.add(marker);

  const fringe = (d: number) => 0.5 * (1 + Math.cos(2 * Math.PI * d * T_RAMSEY));

  // —— 标签 ——
  function makeLabel(text: string, color: string, scale = 3): import('three').Sprite {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 24px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1); return s;
  }
  const lLas = makeLabel('六束激光对冷 (µK)', '#22d3ee', 3); lLas.position.set(MOT_X, MOT_Y - 1.2, 0); group.add(lLas);
  const lCav = makeLabel('微波腔（分离振荡场）', '#f59e0b', 3.4); lCav.position.set(MOT_X, CAV_Y + 1.1, 0); group.add(lCav);
  const lPlot = makeLabel('拉姆齐条纹 P(δ)', '#22d3ee', 2.8); lPlot.position.set(plotX, plotBaseY + plotH + 0.5, 0); group.add(lPlot);

  // —— 信息面板 ——
  const infoCv = document.createElement('canvas'); infoCv.width = 880; infoCv.height = 300;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoSprite = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  infoSprite.position.set(0, 7.4, 0); infoSprite.scale.set(10, 3.4, 1); infoSprite.renderOrder = 999;
  group.add(infoSprite);

  let delta = 0, P = 1, errSig = 0;
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 880, 300);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(4, 4, 872, 292);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 872, 292);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    infoCtx.fillText('铯喷泉原子钟 — 拉姆齐分离振荡场干涉（时间的量子化）', 20, 36);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('ν_Cs = ΔE/h = 9 192 631 770 Hz（SI 定义）   ⇒   1 秒 = 该跃迁辐射 9.192631770×10⁹ 周期', 20, 72);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText(`Ramsey P=½(1+cos(2π·δ·T))  条纹间隔=1/T=${(1 / T_RAMSEY).toFixed(1)} Hz  Q=ν₀/Δν≈${(NU0 * T_RAMSEY).toExponential(1)}`, 20, 106);
    infoCtx.fillStyle = '#f472b6';
    infoCtx.fillText('误差判别式 ε=−½·sin(2π·δ·T)：δ=0 处 ε=0 → 伺服锁定钟频（六束激光先冷至 µK，再上抛）', 20, 140);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 23px "PingFang SC", sans-serif';
    const lockTxt = Math.abs(delta) < 0.08 ? '已锁定 ✓（δ≈0，P=1）' : '未锁定：伺服修正中';
    infoCtx.fillText(`读数：δ = ${delta.toFixed(2)} Hz   实测 ν = ${(NU0 + delta).toExponential(10)} Hz   P = ${P.toFixed(2)}   ε = ${errSig.toFixed(2)}`, 20, 182);
    infoCtx.fillStyle = lockTxt.startsWith('已') ? '#22c55e' : '#ef4444'; infoCtx.font = 'bold 22px "PingFang SC", sans-serif';
    infoCtx.fillText(`状态：${lockTxt}`, 20, 222);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  return {
    update(t, dt) {
      // 扫描失谐 δ（±DMAX，周期 16 s）
      const cycle = (t % 16) / 16;
      delta = Math.sin(cycle * Math.PI * 2) * DMAX;
      P = fringe(delta);
      errSig = -0.5 * Math.sin(2 * Math.PI * delta * T_RAMSEY);

      // 更新条纹曲线（静态形状，一次算好即可，这里保持与 δ 轴一致）
      for (let i = 0; i < PLOT_N; i++) {
        const d = -DMAX + (i / (PLOT_N - 1)) * 2 * DMAX;
        const x = plotX - plotW / 2 + (i / (PLOT_N - 1)) * plotW;
        fringePos[i * 3] = x; fringePos[i * 3 + 1] = plotBaseY + fringe(d) * plotH; fringePos[i * 3 + 2] = 0;
        errPos[i * 3] = x; errPos[i * 3 + 1] = plotBaseY + (0.5 - 0.5 * Math.sin(2 * Math.PI * d * T_RAMSEY)) * plotH; errPos[i * 3 + 2] = 0;
      }
      fringeGeo.attributes['position'].needsUpdate = true;
      errGeo.attributes['position'].needsUpdate = true;

      // 标记随 δ
      const mx = plotX - plotW / 2 + ((delta + DMAX) / (2 * DMAX)) * plotW;
      marker.position.set(mx, plotBaseY + P * plotH, 0.05);

      // 原子云竖直上抛穿腔两次（弹道）
      const g = 3.0;                     // 视觉重力
      for (let i = 0; i < ATOM_N; i++) {
        const ph = ((t * 0.28 + atoms[i].seed) % 1);
        const yy = MOT_Y + (2.4 * ph - 0.4 * g * ph * ph);      // 抛物线
        const spread = 0.25;
        atoms[i].m.position.set(MOT_X + Math.cos(atoms[i].seed * 40) * spread, yy, Math.sin(atoms[i].seed * 40) * spread);
        const inCav = Math.abs(yy - CAV_Y) < 0.5;
        atomMat.emissiveIntensity = 0.4 + (inCav ? 0.9 : 0);
      }
      // MOT 呼吸 + 腔随失谐发光（共振时微波吸收最强）
      (motGlow.material as import('three').MeshBasicMaterial).opacity = 0.5 + 0.4 * Math.sin(t * 3);
      (cavity.material as import('three').MeshStandardMaterial).emissive = new THREE.Color(0x000000);
      cavity.scale.setScalar(1 + 0.02 * P);

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
