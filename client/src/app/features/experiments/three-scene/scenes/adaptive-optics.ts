import type { SceneContext, SceneInstance } from '../types';
/** 自适应光学（P267）：波前畸变与校正。
 * 真实闭环：湍流相位 → 子孔径斜率（倾斜探测） → Zernike 模式重建 → 促动器推挽 → 残差。
 * Zernike 谱读数、促动器高度、校正后残差三者共用同一组重建系数，随机数不再充当读数。 */

/** Zernike 模式表（Noll 序，去掉活塞项：斜率传感器测不到 piston），[径向阶 n, 方位阶 m]。 */
const Z_MODES: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [1, -1],                             // 倾斜 tip / tilt（倾斜探测）
  [2, 0], [2, -2], [2, 2],                     // 离焦、像散
  [3, -1], [3, 1], [3, -3], [3, 3],            // 彗差、三叶
  [4, 0], [4, 2], [4, -2], [4, 4], [4, -4],    // 球差、高阶像散
];

function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

/** Zernike 径向多项式 R_n^m(r) */
function radialPoly(n: number, m: number, r: number): number {
  const am = Math.abs(m);
  let sum = 0;
  for (let s = 0; s <= (n - am) / 2; s++) {
    const c = factorial(n - s) /
      (factorial(s) * factorial((n + am) / 2 - s) * factorial((n - am) / 2 - s));
    sum += (s % 2 === 0 ? c : -c) * Math.pow(r, n - 2 * s);
  }
  return sum;
}

/** 单位光瞳上正交归一的 Zernike 模式；r 已归一化到 1，瞳外钳制在 r=1。 */
function zernike(mode: readonly [number, number], r: number, theta: number): number {
  const n = mode[0];
  const m = mode[1];
  const R = radialPoly(n, m, r > 1 ? 1 : r);
  if (m === 0) return Math.sqrt(n + 1) * R;
  const norm = Math.sqrt(2 * (n + 1));
  return m > 0 ? norm * R * Math.cos(m * theta) : norm * R * Math.sin(-m * theta);
}

/** 小矩阵求逆（高斯-约当 + 行主元），用于斜率重建的法方程 G·a = b。 */
function invertMatrix(mat: number[][]): number[][] {
  const n = mat.length;
  const a = mat.map((row, i) => row.concat(row.map((_, k) => (i === k ? 1 : 0))));
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[piv][col])) piv = r;
    const tmp = a[col]; a[col] = a[piv]; a[piv] = tmp;
    const d = a[col][col];
    for (let k = col; k < 2 * n; k++) a[col][k] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = a[r][col];
      if (f === 0) continue;
      for (let k = col; k < 2 * n; k++) a[r][k] -= f * a[col][k];
    }
  }
  return a.map((row) => row.slice(n));
}

/** 面板读数：全部来自真实的模式分解 / 残差积分，不含随机数。 */
interface AoPanel {
  coeffs: number[];      // 重建出的 Zernike 系数
  residualRms: number;   // 校正后残差 RMS (rad)
  openRms: number;       // 开环湍流 RMS (rad)
  strehl: number;        // Strehl ≈ exp(−σ²)
  bandwidth: number;     // 闭环带宽 (Hz)
  loopGain: number;      // 0 = 开环，1 = 闭环锁定
}

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
  group.add(new THREE.GridHelper(20, 20, 0x334155, 0x1e293b));

  // ===== 导星点源 + 子孔径倾斜传感器网格示意 =====
  const guideStar = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffee88 })
  );
  guideStar.position.set(0, 3, 8); // 光路前端
  group.add(guideStar);
  // 子孔径网格（波前传感器）
  const subApertureGrid = new THREE.Group();
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(i * 0.8, j * 0.8, -1.5),
          new THREE.Vector3((i + 1) * 0.8, j * 0.8, -1.5),
        ]),
        new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.4 })
      );
      subApertureGrid.add(line);
      const line2 = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(i * 0.8, j * 0.8, -1.5),
          new THREE.Vector3(i * 0.8, (j + 1) * 0.8, -1.5),
        ]),
        new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.4 })
      );
      subApertureGrid.add(line2);
    }
  }
  group.add(subApertureGrid);

  // Wavefront distortion mesh
  const wfSize = 64;
  const wfGeo = new THREE.PlaneGeometry(4, 4, wfSize, wfSize);
  const wfMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    wireframe: true,
    transparent: true,
    opacity: 0.7,
    vertexColors: true
  });
  const wavefront = new THREE.Mesh(wfGeo, wfMat);
  wavefront.position.z = -2;
  group.add(wavefront);

  // Corrected wavefront
  const corrGeo = new THREE.PlaneGeometry(4, 4, wfSize, wfSize);
  const corrMat = new THREE.MeshBasicMaterial({
    color: 0x4ade80,
    wireframe: true,
    transparent: true,
    opacity: 0.7,
    vertexColors: true
  });
  const correctedWF = new THREE.Mesh(corrGeo, corrMat);
  correctedWF.position.z = 2;
  group.add(correctedWF);

  // Deformable mirror representation (actuator grid)
  const actuatorCount = 7;
  const actuatorSpacing = 0.5;
  const actuators: import("three").Mesh[] = [];
  const actuatorGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8);
  const actuatorMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });

  for (let i = 0; i < actuatorCount; i++) {
    for (let j = 0; j < actuatorCount; j++) {
      const actuator = new THREE.Mesh(actuatorGeo, actuatorMat.clone());
      actuator.position.set(
        (i - (actuatorCount-1)/2) * actuatorSpacing,
        (j - (actuatorCount-1)/2) * actuatorSpacing,
        0
      );
      group.add(actuator);
      actuators.push(actuator);
    }
  }

  // --- 光瞳与 Zernike 基底（r 归一化到 1；光瞳半径取 1.5，正好是促动器床 ±1.5 的内切圆）---
  const modeCount = Z_MODES.length;
  const apertureR = 1.5;
  const step = 4 / wfSize;                 // 顶点间距
  const dA = step * step;                  // 面积元
  const stride = wfSize + 1;
  const vPos = wfGeo.attributes['position'];
  const vCount = vPos.count;
  const inPupil = new Uint8Array(vCount);
  const basis = new Float32Array(vCount * modeCount);
  for (let i = 0; i < vCount; i++) {
    const x = vPos.getX(i);
    const y = vPos.getY(i);
    const r = Math.hypot(x, y) / apertureR;
    const th = Math.atan2(y, x);
    inPupil[i] = r <= 1 ? 1 : 0;
    for (let j = 0; j < modeCount; j++) basis[i * modeCount + j] = zernike(Z_MODES[j], r, th);
  }

  // 瞳外没有光：用顶点色压暗，让"校正发生在光瞳内"在画面上直接可见
  for (const geo of [wfGeo, corrGeo]) {
    const colors = new Float32Array(vCount * 3);
    for (let i = 0; i < vCount; i++) {
      const shade = inPupil[i] ? 1 : 0.16;
      colors[i * 3] = shade;
      colors[i * 3 + 1] = shade;
      colors[i * 3 + 2] = shade;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  // --- 波前传感器：子孔径（Shack-Hartmann）取样点 + 各模式在子孔径处的局部斜率 ---
  const subIdx: number[] = [];
  for (let iy = 2; iy <= wfSize - 2; iy += 2) {
    for (let ix = 2; ix <= wfSize - 2; ix += 2) {
      const c = iy * stride + ix;
      if (Math.hypot(vPos.getX(c), vPos.getY(c)) / apertureR <= 0.95) subIdx.push(c);
    }
  }
  const subCount = subIdx.length;
  const subDX = new Float32Array(subCount * modeCount);
  const subDY = new Float32Array(subCount * modeCount);
  for (let s = 0; s < subCount; s++) {
    const c = subIdx[s];
    for (let j = 0; j < modeCount; j++) {
      subDX[s * modeCount + j] = (basis[(c + 1) * modeCount + j] - basis[(c - 1) * modeCount + j]) / (2 * step);
      subDY[s * modeCount + j] = (basis[(c + stride) * modeCount + j] - basis[(c - stride) * modeCount + j]) / (2 * step);
    }
  }

  // --- 模式重建：法方程 G[j][k] = Σ (∂xZj ∂xZk + ∂yZj ∂yZk) dA，几何不变故预先求逆 ---
  const gram: number[][] = [];
  for (let j = 0; j < modeCount; j++) gram.push(new Array<number>(modeCount).fill(0));
  for (let s = 0; s < subCount; s++) {
    for (let j = 0; j < modeCount; j++) {
      const dxj = subDX[s * modeCount + j];
      const dyj = subDY[s * modeCount + j];
      for (let k = 0; k < modeCount; k++) {
        gram[j][k] += (dxj * subDX[s * modeCount + k] + dyj * subDY[s * modeCount + k]) * dA;
      }
    }
  }
  const gramInv = invertMatrix(gram);

  // --- 促动器位置上的 Zernike 基底（促动器高度 = Σ a_j Z_j(x_i, y_i)）---
  const actBasis = new Float32Array(actuators.length * modeCount);
  for (let idx = 0; idx < actuators.length; idx++) {
    const p = actuators[idx].position;
    const r = Math.hypot(p.x, p.y) / apertureR;
    const th = Math.atan2(p.y, p.x);
    for (let j = 0; j < modeCount; j++) actBasis[idx * modeCount + j] = zernike(Z_MODES[j], r, th);
  }

  // --- 闭环状态 ---
  const LOOP_BW = 25;      // 闭环带宽 (Hz)
  const LOCK_AT = 0.6;     // 首次闭环时刻 (s)
  const LOCK_IN = 1.0;     // 闭环建立时长 (s)
  const phase = new Float32Array(vCount);          // 波前传感器看到的相位
  const zRecon = new Array<number>(modeCount).fill(0);  // 模式重建系数（唯一数据源）
  const zRaw = new Array<number>(modeCount).fill(0);
  const rhs = new Array<number>(modeCount).fill(0);

  // Zernike polynomial coefficients display
  const graphCanvas = document.createElement('canvas');
  graphCanvas.width = 512;
  graphCanvas.height = 384;
  const gctx = graphCanvas.getContext('2d')!;

  function drawZernikeSpectrum(p: AoPanel) {
    gctx.fillStyle = '#0f172a';
    gctx.fillRect(0, 0, 512, 384);

    // 链路：导星 → 斜率传感 → 模式重建 → 促动器
    gctx.fillStyle = '#4ade80';
    gctx.font = '15px monospace';
    gctx.fillText('导星 → 斜率传感 → 模式重建 → 促动器', 14, 20);

    // 闭环状态
    gctx.fillStyle = p.loopGain >= 0.999 ? '#4ade80' : '#fbbf24';
    gctx.fillText(p.loopGain >= 0.999 ? '[闭环] 已锁定' : (p.loopGain > 0 ? '[闭环] 建立中…' : '[开环] 镜面平坦'), 340, 20);

    // 图表坐标（零线居中，正负模式都可见）
    const x0 = 60, x1 = 490, yTop = 40, yZero = 160, yBottom = 280;
    const fullScale = 0.3;                       // 满量程 ±0.3 rad
    gctx.strokeStyle = '#475569';
    gctx.lineWidth = 2;
    gctx.beginPath();
    gctx.moveTo(x0, yTop);
    gctx.lineTo(x0, yBottom);
    gctx.lineTo(x1, yBottom);
    gctx.stroke();
    gctx.lineWidth = 1;
    gctx.beginPath();
    gctx.moveTo(x0, yZero);
    gctx.lineTo(x1, yZero);
    gctx.stroke();

    gctx.fillStyle = '#94a3b8';
    gctx.font = '13px monospace';
    gctx.fillText('Zernike mode', x0, 312);
    gctx.fillText(`量程 ±${fullScale.toFixed(2)} rad`, 350, 312);
    gctx.save();
    gctx.translate(16, 170);
    gctx.rotate(-Math.PI/2);
    gctx.fillText('幅度 (rad)', 0, 0);
    gctx.restore();

    const coeffs = p.coeffs;
    const barWidth = (x1 - x0) / coeffs.length;
    for (let i = 0; i < coeffs.length; i++) {
      const val = coeffs[i];
      const px = x0 + i * barWidth;
      const h = Math.max(-1, Math.min(1, val / fullScale)) * (yZero - yTop);
      gctx.fillStyle = val > 0 ? '#f472b6' : '#38bdf8';
      gctx.fillRect(px + 2, h >= 0 ? yZero - h : yZero, barWidth - 4, Math.abs(h));
      gctx.fillStyle = '#e2e8f0';
      gctx.font = '10px monospace';
      gctx.fillText(`Z${i+1}`, px + 2, yBottom + 14);
    }

    // 读数：残差 RMS / Strehl / 开环 RMS（由真实积分得到）
    gctx.font = '15px monospace';
    gctx.fillStyle = '#e2e8f0';
    gctx.fillText(`残差 RMS ${p.residualRms.toFixed(3)} rad`, 14, 340);
    gctx.fillStyle = '#38bdf8';
    gctx.fillText(`Strehl ${p.strehl.toFixed(3)}`, 214, 340);
    gctx.fillStyle = '#94a3b8';
    gctx.fillText(`开环 ${p.openRms.toFixed(3)} rad`, 340, 340);

    const drop = p.openRms > 1e-6 ? Math.max(0, 1 - p.residualRms / p.openRms) : 0;
    gctx.font = '13px monospace';
    gctx.fillStyle = '#94a3b8';
    gctx.fillText(`波前传感 ${modeCount} 阶重建 | 闭环带宽 ${p.bandwidth} Hz | 促动器 ${actuators.length} | 残差降低 ${(drop * 100).toFixed(0)}%`, 14, 364);
  }

  drawZernikeSpectrum({ coeffs: zRecon, residualRms: 0, openRms: 0, strehl: 1, bandwidth: LOOP_BW, loopGain: 0 });
  const graphTex = new THREE.CanvasTexture(graphCanvas);
  const graphGeo = new THREE.PlaneGeometry(6, 4.5);
  const graphMat = new THREE.MeshBasicMaterial({ map: graphTex });
  const graphMesh = new THREE.Mesh(graphGeo, graphMat);
  graphMesh.position.set(0, -3.5, -3);
  group.add(graphMesh);

  let time = 0;
  return {
    update(t, dt) {
      time = t;
      const dtc = Math.min(Math.max(dt, 0.001), 0.1);

      // 1) 湍流相位场（同一份数据既画波前，也送进波前传感器）
      const corrPos = corrGeo.attributes['position'];
      for (let i = 0; i < vPos.count; i++) {
        const x = vPos.getX(i);
        const y = vPos.getY(i);
        // Simulated atmospheric turbulence (Kolmogorov-like)
        const distorted = Math.sin(x * 3 + t) * Math.cos(y * 2.5 + t * 0.7) * 0.4 +
          Math.sin(x * 5 - t * 1.3) * Math.sin(y * 4 + t * 0.5) * 0.2 +
          Math.cos(x * 1.5 + y * 2 + t * 0.3) * 0.3;
        vPos.setZ(i, distorted);
        phase[i] = distorted;
      }
      vPos.needsUpdate = true;

      // 2) 波前传感：子孔径倾斜测量（导星像斑位移 ∝ 局部斜率）
      for (let j = 0; j < modeCount; j++) rhs[j] = 0;
      for (let s = 0; s < subCount; s++) {
        const c = subIdx[s];
        const sx = (phase[c + 1] - phase[c - 1]) / (2 * step);
        const sy = (phase[c + stride] - phase[c - stride]) / (2 * step);
        for (let j = 0; j < modeCount; j++) {
          rhs[j] += (sx * subDX[s * modeCount + j] + sy * subDY[s * modeCount + j]) * dA;
        }
      }

      // 3) 模式重建：a = G⁻¹ b（最小二乘把斜率拟合回 Zernike 系数）
      for (let j = 0; j < modeCount; j++) {
        let acc = 0;
        for (let k = 0; k < modeCount; k++) acc += gramInv[j][k] * rhs[k];
        zRaw[j] = acc;
      }

      // 4) 一阶伺服滤波（等效闭环带宽，毫秒级环路延迟）
      const alpha = 1 - Math.exp(-2 * Math.PI * LOOP_BW * dtc);
      for (let j = 0; j < modeCount; j++) zRecon[j] += (zRaw[j] - zRecon[j]) * alpha;

      // 5) 闭环状态：0.6 s 后开始闭环，1.0 s 内建立锁定
      const loopGain = time <= LOCK_AT ? 0 : Math.min(1, (time - LOCK_AT) / LOCK_IN);

      // 6) 镜面 = Σ a_j Z_j（与谱读数、促动器同一组系数），残差 = 湍流 − 镜面
      let sumOpen = 0, sumRes = 0, area = 0;
      for (let i = 0; i < vCount; i++) {
        let mirror = 0;
        for (let j = 0; j < modeCount; j++) mirror += zRecon[j] * basis[i * modeCount + j];
        mirror *= loopGain;
        const residual = phase[i] - mirror;
        corrPos.setZ(i, residual);
        if (inPupil[i]) {
          sumOpen += phase[i] * phase[i] * dA;
          sumRes += residual * residual * dA;
          area += dA;
        }
      }
      corrPos.needsUpdate = true;
      const rmsOpen = area > 0 ? Math.sqrt(sumOpen / area) : 0;
      const rmsRes = area > 0 ? Math.sqrt(sumRes / area) : 0;
      const strehl = Math.exp(-rmsRes * rmsRes);

      // 7) 促动器推挽：高度直接由同一组重建系数求和得到
      actuators.forEach((actuator, idx) => {
        let targetHeight = 0;
        for (let j = 0; j < modeCount; j++) targetHeight += zRecon[j] * actBasis[idx * modeCount + j];
        targetHeight *= loopGain;
        actuator.position.z += (targetHeight - actuator.position.z) * 0.1;
        actuator.scale.y = 1 + Math.abs(targetHeight) * 2;
      });

      // 8) Zernike 谱读数（真实分解结果）
      drawZernikeSpectrum({
        coeffs: zRecon,
        residualRms: rmsRes,
        openRms: rmsOpen,
        strehl,
        bandwidth: LOOP_BW,
        loopGain
      });
      graphTex.needsUpdate = true;

      // Rotate view slightly
      group.rotation.y = Math.sin(t * 0.1) * 0.15;
    },
    dispose() {
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
          (obj as any).geometry?.dispose();
          const mat = (obj as any).material;
          if (Array.isArray(mat)) mat.forEach((m: any) => m.dispose());
          else if (mat) mat.dispose();
        }
      });
      starGeo.dispose(); starMat.dispose();
      graphTex.dispose();
    }
  };
}
