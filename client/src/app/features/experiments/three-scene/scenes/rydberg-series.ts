import type { SceneContext, SceneInstance } from '../types';
/** 里德伯原子（P156）：主控方程 E_n = −Ry/n²（Ry=13.6 eV）、⟨r⟩ ≈ a₀n²、玻尔对应轨道周期 T_n = 2πn³·t_au。
 *  能级梯 y_n ∝ (1−1/n²) 向电离极限收敛；电子波包沿 r∝n² 的类开普勒圆轨道运行、角速度 ∝ n⁻³；
 *  加电场后线性斯塔克效应 E(n,k) = −Ry/n² + (3/2)·F·n·k（物理 |k| ≤ n−1；画面取 k=−4…+4 共 9 条）
 *  给出等间距斯塔克阶梯，间距 ∝ F·n 并按真实 ΔE=(3/2)F_au·n·27.2114 eV 计算后纵向放大 3×10⁵ 绘制。 */
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
  const LX = -3.1;                    // 能级梯所在 x
  const Y0 = -2.3, YSPAN = 4.6;       // 基态→电离极限的纵向跨度
  const EV_PER_WU = 13.6 / YSPAN;     // 能级梯纵向标度：1 eV ⇔ YSPAN/13.6 世界单位
  // 线性斯塔克：ΔE(n,k) = (3/2)·F_au·n·k，F_au = F[V/m]/5.1422×10¹¹，1 a.u. 能量 = 27.2114 eV
  const FAU_VPM = 5.1422e11, EH_EV = 27.2114, EV_GHz = 2.417989e14 / 1e9;
  const STARK_GAIN = 3e5;          // 阶梯纵向放大（真实间距 ~10⁻⁵ eV，按比例画不可见；面板注明）
  const starkKEv = (fVcm: number, n: number): number => 1.5 * ((fVcm * 100) / FAU_VPM) * n * EH_EV;
  const yOf = (n: number): number => Y0 + YSPAN * (1 - 1 / (n * n)); // E_n=−Ry/n² 映射（n=1 在底，n→∞ 到顶）

  // —— 能级梯：n=1..48 的线段（x=LX 平面内沿 z 方向短线），颜色标 n ——
  const NL = 48;
  const lvlGeo = geo(new THREE.BufferGeometry());
  const lvlPos = new Float32Array(NL * 2 * 3);
  const lvlCol = new Float32Array(NL * 2 * 3);
  lvlGeo.setAttribute('position', new THREE.BufferAttribute(lvlPos, 3));
  lvlGeo.setAttribute('color', new THREE.BufferAttribute(lvlCol, 3));
  group.add(new THREE.LineSegments(lvlGeo, mat(new THREE.LineBasicMaterial({ vertexColors: true }))));
  function drawLevels(nActive: number): void {
    for (let i = 0; i < NL; i++) {
      const n = i + 1;
      const y = yOf(n);
      const halfW = n === Math.round(nActive) ? 1.1 : 0.55;
      lvlPos[i * 6] = LX; lvlPos[i * 6 + 1] = y; lvlPos[i * 6 + 2] = -halfW;
      lvlPos[i * 6 + 3] = LX; lvlPos[i * 6 + 4] = y; lvlPos[i * 6 + 5] = halfW;
      const hot = n === Math.round(nActive) ? 1 : 0;
      const c = hot ? [0.13, 0.83, 0.93] : [0.42, 0.48, 0.6];
      lvlCol[i * 6] = c[0]; lvlCol[i * 6 + 1] = c[1]; lvlCol[i * 6 + 2] = c[2];
      lvlCol[i * 6 + 3] = c[0]; lvlCol[i * 6 + 4] = c[1]; lvlCol[i * 6 + 5] = c[2];
    }
    lvlGeo.attributes['position'].needsUpdate = true;
    lvlGeo.attributes['color'].needsUpdate = true;
  }
  // 电离极限（n→∞，E=0）
  const limGeo = geo(new THREE.BufferGeometry());
  limGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([LX - 0.6, yOf(1) + YSPAN, -1.4, LX + 0.6, yOf(1) + YSPAN, -1.4]), 3));
  group.add(new THREE.Line(limGeo, mat(new THREE.LineDashedMaterial({ color: 0xef4444 }))));

  // —— 离子实与电子波包 ——
  const core = new THREE.Mesh(geo(new THREE.SphereGeometry(0.16, 14, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  group.add(core);
  const NP = 160;
  const wpGeo = geo(new THREE.BufferGeometry());
  const wpPos = new Float32Array(NP * 3);
  const seed = new Float32Array(NP * 3);
  for (let i = 0; i < NP; i++) {
    // 高斯环：角向扩散 + 径向/纵向抖动
    seed[i * 3] = TWO_PI * (i / NP) + (Math.random() - 0.5) * 0.7;       // 相位
    seed[i * 3 + 1] = (Math.random() - 0.5) * 0.16;                       // 径向偏移比例
    seed[i * 3 + 2] = (Math.random() - 0.5) * 0.10;                       // z 向厚度
  }
  wpGeo.setAttribute('position', new THREE.BufferAttribute(wpPos, 3));
  group.add(new THREE.Points(wpGeo, mat(new THREE.PointsMaterial({ color: 0x22c55e, size: 0.09, transparent: true, opacity: 0.85 }))));

  // 轨道圆环（当前 n）
  const orbGeo = geo(new THREE.BufferGeometry());
  const orbPos = new Float32Array(97 * 3);
  orbGeo.setAttribute('position', new THREE.BufferAttribute(orbPos, 3));
  group.add(new THREE.Line(orbGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.4 }))));

  // —— 斯塔克阶梯（电场半周期出现）——
  const NK = 9;
  const stGeo = geo(new THREE.BufferGeometry());
  const stPos = new Float32Array(NK * 2 * 3);
  stGeo.setAttribute('position', new THREE.BufferAttribute(stPos, 3));
  group.add(new THREE.LineSegments(stGeo, mat(new THREE.LineBasicMaterial({ color: 0xf472b6 }))));

  const R_NORM = 4.3;   // n=100 时轨道半径的世界坐标
  const corePos = new THREE.Vector3(0.9, 0.6, 0);
  core.position.copy(corePos);

  function makeLabel(text: string, color: string, scale = 3.2): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 28px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  const lbLim = makeLabel('电离极限 E=0（n→∞ 收敛）', '#ef4444', 3.4);
  lbLim.position.set(LX, yOf(1) + YSPAN + 0.42, -1.1);
  group.add(lbLim);
  const lbOrb = makeLabel('离子实 + 外层波包（r ∝ n²）', '#94a3b8', 3.4);
  lbOrb.position.set(corePos.x, corePos.y - 2.6, 0);
  group.add(lbOrb);

  // —— 面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 800; infoCv.height = 236;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(8.8, 2.6)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 5.7, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  let nNow = 60, fVcm = 0, orbitDegPerS = 0, starkGHz = 0;

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 800, 236);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 792, 228);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 792, 228);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 29px "PingFang SC", sans-serif';
    infoCtx.fillText('里德伯原子：标度律与电离极限收敛', 22, 42);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '27px "PingFang SC", sans-serif';
    infoCtx.fillText('E_n = −13.6/n² eV，⟨r⟩ ≈ a₀n²，T_n = 2πn³·(2.42×10⁻¹⁷ s)', 22, 82);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText(`半周期加电场：ΔE = (3/2)F·n·k ⇒ 等距斯塔克阶梯，间距 ∝ F·n（${NK} 条支项，纵向放大 3×10⁵ 显示）`, 22, 122);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 27px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：n = ${nNow.toFixed(0)}  E = ${(-13.6 / (nNow * nNow)).toFixed(4)} eV  r = ${(0.0529 * nNow * nNow / 1000).toFixed(2)} μm  T = ${(2 * Math.PI * Math.pow(nNow, 3) * 2.42e-17 * 1e12).toFixed(0)} ps  F = ${fVcm.toFixed(2)} V/cm  阶梯间距 ${starkGHz.toFixed(2)} GHz(纵向放大×3e5)`,
      22, 170,
    );
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '24px "PingFang SC", sans-serif';
    infoCtx.fillText('轨道角速度 ∝ n⁻³：n 越大电子越"经典"、转得越慢', 22, 208);
    infoTex.needsUpdate = true;
  }

  drawLevels(60);
  drawInfo();

  return {
    update(t, dt) {
      // 扫描主量子数 n：25→100，16s 周期；后半段叠加电场
      const ph = (t % 16) / 16;
      nNow = 25 + 75 * (0.5 - 0.5 * Math.cos(TWO_PI * ph));
      const starkOn = ph > 0.5;
      fVcm = starkOn ? 5 * Math.min(1, (ph - 0.5) * 8) : Math.max(0, 5 * (1 - ph * 8));

      const rn = R_NORM * (nNow * nNow) / 10000;          // r ∝ n²，n=100 → 4.3
      const omega = TWO_PI / (2.4 * Math.pow(nNow / 30, 3)); // T ∝ n³（画面时间压缩）
      orbitDegPerS = (omega * 57.2958);

      // 波包绕离子实
      for (let i = 0; i < NP; i++) {
        const a = seed[i * 3] + omega * t;
        const rr = rn * (1 + seed[i * 3 + 1]);
        wpPos[i * 3] = corePos.x + rr * Math.cos(a);
        wpPos[i * 3 + 1] = corePos.y + rr * Math.sin(a);
        wpPos[i * 3 + 2] = corePos.z + seed[i * 3 + 2] * rn;
      }
      wpGeo.attributes['position'].needsUpdate = true;
      for (let i = 0; i < 97; i++) {
        const a = (i / 96) * TWO_PI;
        orbPos[i * 3] = corePos.x + rn * Math.cos(a);
        orbPos[i * 3 + 1] = corePos.y + rn * Math.sin(a);
        orbPos[i * 3 + 2] = corePos.z;
      }
      orbGeo.attributes['position'].needsUpdate = true;

      // 斯塔克阶梯：E(n,k) = −Ry/n² + (3/2)F n k，k=−(NK−1)/2..+(NK−1)/2，间距 ∝ F·n
      const yN = yOf(nNow);
      const gapEv = starkKEv(fVcm, nNow);                 // 相邻 k 能级间距（eV，真实量级 ~10⁻⁶）
      starkGHz = gapEv * EV_GHz;                          // 与 stepPx 同源的间距，换算成 GHz
      const stepPx = (gapEv / EV_PER_WU) * STARK_GAIN;    // 纵向放大 STARK_GAIN 倍后画到画面（∝ F·n）
      for (let i = 0; i < NK; i++) {
        const k = i - (NK - 1) / 2;
        const y = yN + k * stepPx;
        stPos[i * 6] = 2.9; stPos[i * 6 + 1] = y; stPos[i * 6 + 2] = -0.5;
        stPos[i * 6 + 3] = 2.9; stPos[i * 6 + 4] = y; stPos[i * 6 + 5] = 0.5;
      }
      stGeo.attributes['position'].needsUpdate = true;
      stGeo.setDrawRange(0, starkOn ? NK * 2 : 0);

      drawLevels(nNow);
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
