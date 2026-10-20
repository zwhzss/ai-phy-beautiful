import type { SceneContext, SceneInstance } from '../types';
/**
 * DNA 双螺旋与 X 射线衍射（P331）：Cochran 螺旋衍射理论 —— 富兰克林 Photo 51 的
 * 层线与 X 形交叉斑由螺旋结构因子真实生成。
 *
 * 真实 B-DNA 参数：螺距 pitch = 3.4 nm（每圈一个重复）、10 bp/圈（每碱基 rise = 0.34 nm）、
 * 螺旋半径 R ≈ 1.0 nm（纤维直径 2 nm）。
 *
 * 核心公式（Cochran 1953，连续螺旋近似）：
 *   层线位置  ζ_n = n / pitch          ⇒ 子午线方向间距 ∝ 1/pitch
 *   层线强度  I_n(s) ∝ J_n²(2π·R·s)    ⇒ 每条层线上的斑点包络由贝塞尔函数决定
 *   X 半开角  tan α = pitch / (2π·R)   （n 大时 J_n² 峰值轨迹 s ≈ n/(2πR) 对 ζ_n = n/pitch
 *              作图，斜率即 pitch/(2πR)；它就是螺旋倾角本身——"从交叉斑纹读出螺距"）
 *
 * 教学简化（面板声明）：连续单螺旋 + 双链仅以相位差 π 近似，忽略反平行碱基对细节、
 * 溶剂散射与结晶畴尺寸；衍射图只依赖 (pitch, R)，**不随时间演化**（纤维旋转平均下
 * 静止样品给出静止衍射图；螺旋绕自身轴匀速自转不改变衍射图，故二者独立动画合法）。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  // —— 资源登记器 ——
  const geos: { dispose(): void }[] = [];
  const mats: { dispose(): void }[] = [];
  const texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  const TWO_PI = Math.PI * 2;

  // —— 物理参数（唯一真源；面板读数与全部几何都读这两个变量）——
  const BP_PER_TURN = 10;      // bp/圈（教学值，B-DNA 实际 10.4–10.5）
  const H_NM = 5.0;            // 展示窗口高度（nm）；世界尺度 1 单位 = 1 nm
  const RM = 170;              // 衍射屏像素 / nm^-1（倒空间比例尺）
  let pitchNm = 3.4;           // 螺距（nm）
  let radiusNm = 1.0;          // 螺旋半径（nm）

  // —— 星野 + 地面栅格（脚手架）——
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
  grid.position.y = -3.4;
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // —— DNA 双螺旋几何（由 pitchNm / radiusNm 驱动，绕自身轴自转不改变衍射图）——
  const helixGroup = new THREE.Group();
  group.add(helixGroup);

  const SEG = 260;
  const s1Arr = new Float32Array((SEG + 1) * 3);
  const s2Arr = new Float32Array((SEG + 1) * 3);
  const s1Geo = geo(new THREE.BufferGeometry());
  const s2Geo = geo(new THREE.BufferGeometry());
  s1Geo.setAttribute('position', new THREE.BufferAttribute(s1Arr, 3));
  s2Geo.setAttribute('position', new THREE.BufferAttribute(s2Arr, 3));
  helixGroup.add(new THREE.Line(s1Geo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee }))));
  helixGroup.add(new THREE.Line(s2Geo, mat(new THREE.LineBasicMaterial({ color: 0xa855f7 }))));

  const RUNG_MAX = 30;         // pitch=2nm 时 5nm 窗口内 25 个 bp
  const rungArr = new Float32Array(RUNG_MAX * 2 * 3);
  const rungGeo = geo(new THREE.BufferGeometry());
  rungGeo.setAttribute('position', new THREE.BufferAttribute(rungArr, 3));
  const rungLines = new THREE.LineSegments(rungGeo, mat(new THREE.LineBasicMaterial({ color: 0xf472b6 })));
  helixGroup.add(rungLines);

  function recomputeHelix(): void {
    const turns = H_NM / pitchNm;                    // 窗口内可见圈数
    for (let i = 0; i <= SEG; i++) {
      const f = i / SEG;
      const ang = TWO_PI * turns * f;
      const y = (f - 0.5) * H_NM;
      s1Arr[i * 3] = Math.cos(ang) * radiusNm; s1Arr[i * 3 + 1] = y; s1Arr[i * 3 + 2] = Math.sin(ang) * radiusNm;
      const a2 = ang + Math.PI;
      s2Arr[i * 3] = Math.cos(a2) * radiusNm; s2Arr[i * 3 + 1] = y; s2Arr[i * 3 + 2] = Math.sin(a2) * radiusNm;
    }
    s1Geo.attributes['position'].needsUpdate = true;
    s2Geo.attributes['position'].needsUpdate = true;
    // 碱基对横档：每 rise = pitch/BP_PER_TURN 一条，端点严格落在两链上（同一公式）
    const rise = pitchNm / BP_PER_TURN;
    const nR = Math.min(RUNG_MAX, Math.floor(H_NM / rise));
    for (let k = 0; k < nR; k++) {
      const y = -H_NM / 2 + (k + 0.5) * rise;
      const th = TWO_PI * (y + H_NM / 2) / pitchNm;
      rungArr[k * 6] = Math.cos(th) * radiusNm; rungArr[k * 6 + 1] = y; rungArr[k * 6 + 2] = Math.sin(th) * radiusNm;
      const th2 = th + Math.PI;
      rungArr[k * 6 + 3] = Math.cos(th2) * radiusNm; rungArr[k * 6 + 4] = y; rungArr[k * 6 + 5] = Math.sin(th2) * radiusNm;
    }
    rungGeo.setDrawRange(0, nR * 2);
    rungGeo.attributes['position'].needsUpdate = true;
  }

  // —— 贝塞尔函数（Cochran 结构因子的核心）：J_n(x) = (1/π)∫₀^π cos(n·u − x·sin u)du ——
  const NQ = 96;
  function besselJ(order: number, x: number): number {
    let sum = 0;
    for (let k = 0; k < NQ; k++) {
      const u = ((k + 0.5) / NQ) * Math.PI;
      sum += Math.cos(order * u - x * Math.sin(u));
    }
    return sum / NQ;
  }

  // —— 衍射屏：强度图 I(x,y) = Σ_n J_n²(2πR·|s_x|)·Gauss(ζ − n/pitch)，不含任何 time 项 ——
  const SC = 640;
  const CX = SC / 2;
  const screenCv = document.createElement('canvas');
  screenCv.width = SC; screenCv.height = SC;
  const sctx = screenCv.getContext('2d')!;
  const screenImg = sctx.createImageData(SC, SC);
  {
    const d = screenImg.data;
    for (let i = 0; i < SC * SC; i++) d[i * 4 + 3] = 255;   // alpha 常置 255
  }
  const L_MAX = 9;
  const j2 = new Float64Array((L_MAX + 1) * SC);            // j2[n][x] 表

  function drawPattern(): void {
    const d = screenImg.data;
    for (let i = 0; i < SC * SC; i++) {
      const p = i * 4;
      d[p] = 15; d[p + 1] = 23; d[p + 2] = 42;
    }
    const zetaMax = (CX - 8) / RM;
    const L = Math.max(1, Math.min(L_MAX, Math.floor(pitchNm * zetaMax)));
    const SIG = 2.6;                                        // 层线倒空间宽度（nm^-1）→ 像素
    // 结构因子表：J_n²(2πR·s) × 原子形状因子包络 × 高层线衰减
    for (let n = 0; n <= L; n++) {
      const decay = Math.exp(-n / 6);
      const row = n * SC;
      for (let x = 0; x < SC; x++) {
        const s = Math.abs(x - CX) / RM;
        const jv = besselJ(n, TWO_PI * radiusNm * s);
        const env = Math.exp(-(s / 1.05) * (s / 1.05));
        j2[row + x] = jv * jv * env * decay;
      }
    }
    // 逐层线铺设高斯展开的斑点带：层线位置 ζ_n = n/pitch ⇒ 屏幕间距 ∝ 1/pitch
    for (let n = -L; n <= L; n++) {
      const zeta = n / pitchNm;
      const yc = CX + zeta * RM;
      const an = Math.abs(n);
      for (let row = Math.max(0, Math.floor(yc - 5)); row <= Math.min(SC - 1, Math.ceil(yc + 5)); row++) {
        const g = Math.exp(-0.5 * ((row - yc) / SIG) * ((row - yc) / SIG));
        const base = row * SC;
        const src = an * SC;
        for (let x = 0; x < SC; x++) {
          const I = j2[src + x] * g;
          if (I < 0.004) continue;
          const p = (base + x) * 4;
          d[p] = Math.min(255, d[p] + I * 260);
          d[p + 1] = Math.min(255, d[p + 1] + I * 240);
          d[p + 2] = Math.min(255, d[p + 2] + I * 300);
        }
      }
    }
    sctx.putImageData(screenImg, 0, 0);

    // 中心直射光斑
    const gg = sctx.createRadialGradient(CX, CX, 0, CX, CX, 22);
    gg.addColorStop(0, 'rgba(255,255,255,0.9)');
    gg.addColorStop(0.5, 'rgba(200,220,255,0.25)');
    gg.addColorStop(1, 'rgba(200,220,255,0)');
    sctx.fillStyle = gg;
    sctx.fillRect(CX - 24, CX - 24, 48, 48);

    // X 半开角导引线：tan α = pitch/(2πR)，与层线贝塞尔峰值轨迹同源
    const alpha = Math.atan(pitchNm / (TWO_PI * radiusNm));
    const LARM = 300;
    const dx = Math.sin(alpha) * LARM, dy = Math.cos(alpha) * LARM;
    sctx.setLineDash([7, 6]);
    sctx.strokeStyle = 'rgba(251,191,36,0.42)';
    sctx.lineWidth = 1.5;
    for (const [sx, sy] of [[dx, -dy], [-dx, -dy], [dx, dy], [-dx, dy]] as const) {
      sctx.beginPath(); sctx.moveTo(CX, CX); sctx.lineTo(CX + sx, CX + sy); sctx.stroke();
    }
    // 子午线参考 + α 弧与标注（读数与公式同一变量 alpha）
    sctx.strokeStyle = 'rgba(148,163,184,0.35)';
    sctx.beginPath(); sctx.moveTo(CX, CX); sctx.lineTo(CX, CX - LARM); sctx.stroke();
    sctx.setLineDash([]);
    sctx.strokeStyle = 'rgba(251,191,36,0.8)';
    sctx.lineWidth = 2;
    sctx.beginPath(); sctx.arc(CX, CX, 110, -Math.PI / 2, -Math.PI / 2 + alpha); sctx.stroke();
    sctx.fillStyle = '#fbbf24';
    sctx.font = 'bold 17px monospace';
    sctx.fillText(`α=${(alpha * 57.2958).toFixed(1)}°`, CX + 128 * Math.sin(alpha / 2) + 6, CX - 128 * Math.cos(alpha / 2));
    // 层线指数标注
    sctx.fillStyle = 'rgba(148,163,184,0.9)';
    sctx.font = '13px monospace';
    for (let n = 1; n <= L; n++) {
      const yp = CX + (n / pitchNm) * RM;
      if (yp < SC - 12) sctx.fillText(`n=${n}`, 8, yp + 4);
      const ym = CX - (n / pitchNm) * RM;
      if (ym > 16) sctx.fillText(`n=-${n}`, SC - 52, ym + 4);
    }
    sctx.fillStyle = '#94a3b8';
    sctx.font = '14px monospace';
    sctx.fillText('衍射图 = f(pitch, R)，不随时间演化', 20, 26);
    sctx.fillStyle = '#22d3ee';
    sctx.fillText('ζ_n=n/pitch  I_n∝J_n²(2πR·s)', 20, SC - 18);
  }

  // —— 屏 / 入射束 / 源 ——
  const screenGeo = geo(new THREE.PlaneGeometry(6.8, 6.8));
  const screenTex = tex(new THREE.CanvasTexture(screenCv));
  const screen = new THREE.Mesh(screenGeo, mat(new THREE.MeshBasicMaterial({ map: screenTex, side: THREE.DoubleSide })));
  screen.position.set(0, 0.2, -4.5);
  group.add(screen);

  const beamGeo = geo(new THREE.BufferGeometry());
  beamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 6, 0, 0, -4.4]), 3));
  group.add(new THREE.Line(beamGeo, mat(new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.7 }))));
  const srcGeo = geo(new THREE.ConeGeometry(0.28, 0.7, 14));
  const srcMesh = new THREE.Mesh(srcGeo, mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  srcMesh.position.set(0, 0, 6.2);
  srcMesh.rotation.x = -Math.PI / 2;
  group.add(srcMesh);

  // —— 读数面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 900; infoCv.height = 340;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9, 3.4)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 4.7, -2);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  let phaseLabel = '';
  function drawInfo(): void {
    const alpha = Math.atan(pitchNm / (TWO_PI * radiusNm));
    const alphaDeg = alpha * 57.2958;
    infoCtx.clearRect(0, 0, 900, 340);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)';
    infoCtx.fillRect(4, 4, 892, 332);
    infoCtx.strokeStyle = '#334155';
    infoCtx.lineWidth = 3;
    infoCtx.strokeRect(4, 4, 892, 332);
    infoCtx.textAlign = 'left';

    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 30px "PingFang SC", sans-serif';
    infoCtx.fillText('DNA 纤维衍射 · Cochran 螺旋结构因子', 20, 44);

    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '24px "PingFang SC", sans-serif';
    infoCtx.fillText('层线 ζ_n = n/pitch（间距 ∝ 1/pitch），强度 I_n(s) ∝ J_n²(2πR·s)', 20, 86);

    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText(`X 半开角 = 螺旋倾角 α：tan α = pitch/(2πR) ⇒ α = ${alphaDeg.toFixed(1)}°`, 20, 124);

    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText(`真实 B-DNA：pitch=3.4nm，10bp/圈 ⇒ rise/bp = ${(pitchNm / BP_PER_TURN).toFixed(2)}nm`, 20, 162);

    infoCtx.fillStyle = '#f472b6';
    infoCtx.fillText('教学简化：连续单螺旋（双链仅相位差 π），忽略反平行碱基对/溶剂散射；', 20, 198);
    infoCtx.fillText('静止样品衍射图恒定，不随时间闪烁（绕轴自转不改变化纤图）。', 20, 228);

    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：pitch = ${pitchNm.toFixed(2)} nm   R = ${radiusNm.toFixed(2)} nm   α = ${alphaDeg.toFixed(1)}°`, 20, 272);
    infoCtx.font = 'bold 22px "PingFang SC", sans-serif';
    infoCtx.fillText(`层线间距 = 1/pitch = ${(1 / pitchNm).toFixed(3)} nm⁻¹  ·  ${phaseLabel}`, 20, 306);
    infoTex.needsUpdate = true;
  }

  recomputeHelix();
  drawPattern();
  drawInfo();

  function smooth(a: number, b: number, u: number): number {
    const s = u * u * (3 - 2 * u);
    return a + (b - a) * s;
  }

  return {
    update(time, dt) {
      // —— 自变量扫描（16s 周期）：pitch 与 R 先后扫过，读数/几何/衍射图全部同源 ——
      const cyc = time % 16;
      if (cyc < 6) {
        pitchNm = 2.0 + 2.0 * (cyc / 6); radiusNm = 1.0;
        phaseLabel = '扫描 pitch 2.0→4.0 nm';
      } else if (cyc < 8) {
        pitchNm = smooth(4.0, 3.4, (cyc - 6) / 2); radiusNm = 1.0;
        phaseLabel = '定回 B-DNA pitch=3.4';
      } else if (cyc < 10) {
        pitchNm = 3.4; radiusNm = smooth(1.0, 1.35, (cyc - 8) / 2);
        phaseLabel = '扫描 R 1.0→1.35 nm';
      } else if (cyc < 12) {
        pitchNm = 3.4; radiusNm = smooth(1.35, 0.7, (cyc - 10) / 2);
        phaseLabel = '扫描 R 1.35→0.7 nm';
      } else if (cyc < 14) {
        pitchNm = 3.4; radiusNm = smooth(0.7, 1.0, (cyc - 12) / 2);
        phaseLabel = '定回 R = 1.0 nm';
      } else {
        pitchNm = 3.4; radiusNm = 1.0;
        phaseLabel = 'B-DNA 基准 (Photo 51)';
      }

      recomputeHelix();
      // 螺旋绕自身轴匀速自转：纤维旋转平均下衍射图不变（有意与衍射解耦）
      helixGroup.rotation.y = time * 0.35;

      // 5Hz 重绘衍射图与面板（图案只随受控参数变化，绝不随时间单独演化）
      if (Math.floor(time * 5) !== Math.floor((time - dt) * 5)) {
        drawPattern();
        screenTex.needsUpdate = true;
        drawInfo();
      }
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
