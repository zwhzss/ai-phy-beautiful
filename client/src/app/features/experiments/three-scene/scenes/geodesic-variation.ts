import type { SceneContext, SceneInstance } from '../types';
/** 测地线方程与变分（P578）：主控方程 δ∫√(g_{μν}ẋ^μẋ^ν)dλ = 0 ⇒ ẍ^μ + Γ^μ_{αβ}ẋ^αẋ^β = 0。
 *  引力势阱曲面 z = −A·e^{−r²/w²}：(1) 一束"光线"用投影法积分测地线方程（加速度只剩法向 = 克氏项），
 *  向阱底弯折、在阱边缘聚焦；(2) 一条两端固定的初始折线沿弧长泛函的负梯度 δL/δx 逐帧松弛，
 *  自动收敛为测地线；坐标意义下的直线（灰色）比较显示它并不是最短路径。 */
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
  const W2 = 1.5 * 1.5;            // 势阱宽度 w²
  const EXT = 3.4;                 // 曲面半宽
  const SN = 48;                   // 曲面网格边数
  let A = 1.2;                     // 阱深（扫描变量）

  const h = (x: number, y: number): number => -A * Math.exp(-(x * x + y * y) / W2);
  // ∇h = −2h/w²·(x,y)（h<0 时向外上斜）
  const grad = (x: number, y: number): [number, number] => { const c = (-2 / W2) * h(x, y); return [c * x, c * y]; };

  // —— 势能曲面（顶点色 = |∇h|，蓝→红） ——
  const surfGeo = geo(new THREE.BufferGeometry());
  const surfPos = new Float32Array((SN + 1) * (SN + 1) * 3);
  const surfCol = new Float32Array((SN + 1) * (SN + 1) * 3);
  surfGeo.setAttribute('position', new THREE.BufferAttribute(surfPos, 3));
  surfGeo.setAttribute('color', new THREE.BufferAttribute(surfCol, 3));
  {
    const idx: number[] = [];
    for (let i = 0; i < SN; i++) {
      for (let j = 0; j < SN; j++) {
        const a = i * (SN + 1) + j, b = a + 1, c = a + SN + 1, e = c + 1;
        idx.push(a, b, c, b, e, c);
      }
    }
    surfGeo.setIndex(idx);
  }
  const surfSolid = new THREE.Mesh(surfGeo, mat(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.42, side: THREE.DoubleSide })));
  const surfWire = new THREE.Mesh(surfGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.14, side: THREE.DoubleSide })));
  group.add(surfSolid, surfWire);

  function updateSurface(): void {
    let v = 0;
    for (let i = 0; i <= SN; i++) {
      const y = -EXT + (2 * EXT * i) / SN;
      for (let j = 0; j <= SN; j++) {
        const x = -EXT + (2 * EXT * j) / SN;
        const z = h(x, y);
        surfPos[v * 3] = x; surfPos[v * 3 + 1] = z; surfPos[v * 3 + 2] = y;
        const gg = grad(x, y);
        const gmag = Math.hypot(gg[0], gg[1]);
        const tt = Math.min(1, gmag / 1.1);
        surfCol[v * 3] = tt; surfCol[v * 3 + 1] = 0.25; surfCol[v * 3 + 2] = 1 - tt;
        v++;
      }
    }
    surfGeo.attributes['position'].needsUpdate = true;
    surfGeo.attributes['color'].needsUpdate = true;
  }

  // —— 测地线束：投影法积分（每步去掉法向加速度 = Γ 修正） ——
  const NRAY = 9, NSTEP = 300, DS = 0.024;
  const rayGeos: import('three').BufferGeometry[] = [];
  const rayPos: Float32Array[] = [];
  const rayMat = mat(new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.9 }));
  for (let k = 0; k < NRAY; k++) {
    const g = geo(new THREE.BufferGeometry());
    const arr = new Float32Array((NSTEP + 1) * 3);
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    g.setDrawRange(0, 2);
    group.add(new THREE.Line(g, rayMat));
    rayGeos.push(g); rayPos.push(arr);
  }
  let outerBendDeg = 0;
  function integrateRays(): void {
    const sy = h(-EXT + 0.1, 0);
    for (let k = 0; k < NRAY; k++) {
      const a0 = -0.5 + (k / (NRAY - 1));                 // 出射角 ±0.5 rad
      let px = -EXT + 0.1, py = 0, pz = sy;
      const gx0 = grad(px, py);
      let vx = Math.cos(a0), vy = Math.sin(a0), vz = vx * gx0[0] + vy * gx0[1];
      const arr = rayPos[k];
      arr[0] = px; arr[1] = pz; arr[2] = py;
      let n = 1;
      for (let s = 1; s <= NSTEP; s++) {
        px += vx * DS; py += vy * DS;
        if (px > EXT || px < -EXT || py > EXT || py < -EXT) break;
        pz = h(px, py);
        const g = grad(px, py);
        // 单位法向 n̂ = (−gx,−gy,1)/√(1+g²)；去掉 v 的法向分量（保持切向与仿射参数）
        const nn = 1 / Math.sqrt(1 + g[0] * g[0] + g[1] * g[1]);
        const vn = (-g[0] * vx - g[1] * vy + vz) * nn;
        vx -= vn * (-g[0]) * nn; vy -= vn * (-g[1]) * nn; vz -= vn * nn;
        const vl = Math.hypot(vx, vy, vz);
        vx /= vl; vy /= vl; vz /= vl;
        arr[n * 3] = px; arr[n * 3 + 1] = pz; arr[n * 3 + 2] = py;
        n++;
      }
      rayGeos[k].setDrawRange(0, n);
      rayGeos[k].attributes['position'].needsUpdate = true;
      if (k === NRAY - 1) outerBendDeg = Math.atan2(vy, vx) * 57.2958 - a0 * 57.2958;
    }
  }

  // —— 变分松弛：固定两端折线沿 δL/δx 梯度下降 ——
  const KP = 57;
  const relaxGeo = geo(new THREE.BufferGeometry());
  const relaxArr = new Float32Array(KP * 3);
  relaxGeo.setAttribute('position', new THREE.BufferAttribute(relaxArr, 3));
  group.add(new THREE.Line(relaxGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e }))));
  const rpX = new Float32Array(KP), rpY = new Float32Array(KP);
  const straightGeo = geo(new THREE.BufferGeometry());
  const straightArr = new Float32Array(KP * 3);
  straightGeo.setAttribute('position', new THREE.BufferAttribute(straightArr, 3));
  group.add(new THREE.Line(straightGeo, mat(new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.55 }))));

  let L0 = 0;        // 本周期初始（wavy）长度
  let Lnow = 0;      // 当前松弛折线长度（与画面同源）
  let Lstraight = 0; // 坐标直线（灰色）长度
  let byT = 0;       // 动目标端点 y（第二个扫描自变量）

  function seedPath(): void {
    const ay = 1.6, by = byT;
    for (let i = 0; i < KP; i++) {
      const u = i / (KP - 1);
      const x = -3.1 + 6.2 * u;
      const y = ay + (by - ay) * u;
      // 初始为"坐标直线 + 正弦扰动"：变分要把这个 wiggle 抹平并横向滑进阱的斜面
      const wig = 0.55 * Math.sin(TWO_PI * u * 3) * Math.sin(Math.PI * u);
      rpX[i] = x; rpY[i] = y + wig;
    }
    L0 = pathLen();
  }
  function pathLen(): number {
    let L = 0;
    for (let i = 0; i < KP; i++) {
      const z = h(rpX[i], rpY[i]);
      relaxArr[i * 3] = rpX[i]; relaxArr[i * 3 + 1] = z; relaxArr[i * 3 + 2] = rpY[i];
      if (i > 0) {
        const z0 = h(rpX[i - 1], rpY[i - 1]);
        L += Math.hypot(rpX[i] - rpX[i - 1], z - z0, rpY[i] - rpY[i - 1]);
      }
    }
    relaxGeo.attributes['position'].needsUpdate = true;
    return L;
  }
  function relaxStep(): void {
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < KP - 1; i++) {
        const d1 = Math.hypot(rpX[i] - rpX[i - 1], rpY[i] - rpY[i - 1]) + 1e-9;
        const d2 = Math.hypot(rpX[i + 1] - rpX[i], rpY[i + 1] - rpY[i]) + 1e-9;
        const gx = (rpX[i] - rpX[i - 1]) / d1 - (rpX[i + 1] - rpX[i]) / d2;
        const gy = (rpY[i] - rpY[i - 1]) / d1 - (rpY[i + 1] - rpY[i]) / d2;
        rpX[i] -= 0.22 * gx; rpY[i] -= 0.22 * gy;
      }
    }
  }
  function drawStraight(): void {
    const ay = 1.6, by = byT;
    let Ls = 0;
    let pxx = 0, pyy = 0, pzz = 0;
    for (let i = 0; i < KP; i++) {
      const u = i / (KP - 1);
      const x = -3.1 + 6.2 * u, y = ay + (by - ay) * u;
      const z = h(x, y);
      if (i > 0) Ls += Math.hypot(x - pxx, z - pzz, y - pyy);
      pxx = x; pyy = y; pzz = z;
      straightArr[i * 3] = x; straightArr[i * 3 + 1] = z; straightArr[i * 3 + 2] = y;
    }
    straightGeo.attributes['position'].needsUpdate = true;
    Lstraight = Ls;
  }

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

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 800, 236);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 792, 228);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 792, 228);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 30px "PingFang SC", sans-serif';
    infoCtx.fillText('测地线 = 长度泛函的驻点 —— 势阱曲面 z = −A·e^(−r²/w²)', 22, 44);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '27px "PingFang SC", sans-serif';
    infoCtx.fillText('δ∫√(g_{μν}ẋᵘẋᵛ)dλ = 0  ⇒  ẍᵘ + Γᵘ_{αβ} ẋᵅẋᵝ = 0', 22, 84);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('光线束向阱底弯折（引力透镜类比）；绿色折线沿 δL/δxᵢ 松弛 → 测地线', 22, 124);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 27px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：A = ${A.toFixed(2)}  外缘光线偏折 ${outerBendDeg.toFixed(1)}°  L₀ = ${L0.toFixed(2)} → 测地线 L = ${Lnow.toFixed(2)} < 坐标直线 ${Lstraight.toFixed(2)}`,
      22, 172,
    );
    infoTex.needsUpdate = true;
  }

  updateSurface();
  integrateRays();
  byT = 0;
  seedPath();
  Lnow = pathLen();
  drawStraight();
  drawInfo();

  let prevCycle = -1;

  return {
    update(t, dt) {
      // 扫描阱深 A（16s）与目标端点 y（11s）
      A = 0.4 + 1.8 * (0.5 - 0.5 * Math.cos(TWO_PI * ((t % 16) / 16)));
      byT = 1.5 * Math.sin(TWO_PI * ((t % 11) / 11));
      const cyc = Math.floor(t / 16);
      if (cyc !== prevCycle) { prevCycle = cyc; seedPath(); }

      updateSurface();
      integrateRays();
      relaxStep();
      Lnow = pathLen();
      drawStraight();
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
