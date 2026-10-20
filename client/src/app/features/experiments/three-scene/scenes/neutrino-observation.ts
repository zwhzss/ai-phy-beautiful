import type { SceneContext, SceneInstance } from '../types';
/**
 * 中微子天文学（P276）：冰/水中切伦科夫光锥与 PMT 球壳阵列的事例重建。
 * 主控方程：cosθ_c = 1/(nβ)（n=1.31，阈值 β_th=1/n=0.763，θ_c(β→1)=arccos(1/1.31)=40.2°）；
 * PMT 命中时刻采用 t_i = t₀ + (D − n·β·p̂_i·û)/c 形式：t_i 随 p̂_i·û 单调，最早命中在 p̂·û≈1 的前轴向；
 * 锥面与球壳交线（命中环）是等时线——环上各 PMT 命中时刻相同（t=nD/c）且光最集（最亮），但并非最早。
 * 由命中时刻分布反演重建方向 û 与 β；重建阈值 β_th=1/n 与发光阈值一致。
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

  // —— 探测器体积：1 wu = 25 m ⇒ D=5 wu ≙ 125 m（IceCube 半规模）——
  const N_ICE = 1.31;
  const D_SPHERE = 4.0;          // PMT 球壳半径（wu）
  const VOL_M = 100;             // 球壳对应 100 m ⇒ 归一化延迟系数
  const OMEGA = 1.15;            // 事例重演角速度（rad/s，展示）
  const TWO_PI = Math.PI * 2;
  const C = 1;                   // 光速（展示自然单位 c=1：距离 wu ≙ 光行时，delays 随后按 maxT 归一）

  // 透明冰体球
  const vol = new THREE.Mesh(geo(new THREE.SphereGeometry(D_SPHERE + 0.35, 36, 28)), mat(new THREE.MeshBasicMaterial({ color: 0x1e3a5f, transparent: true, opacity: 0.08, side: THREE.BackSide })));
  group.add(vol);

  // —— PMT 球壳：Fibonacci 布站 126 只 ——
  const NPMT = 126;
  const pmtGeo = geo(new THREE.SphereGeometry(0.07, 8, 8));
  const pmtMat = mat(new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x22d3ee, emissiveIntensity: 0 }));
  const pmtMesh = new THREE.InstancedMesh(pmtGeo, pmtMat, NPMT);
  group.add(pmtMesh);
  const pDir: import('three').Vector3[] = [], pPos: import('three').Vector3[] = [];
  {
    const off = 2 / NPMT, inc = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < NPMT; i++) {
      const y = i * off - 1 + off / 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y)), th = i * inc;
      const d = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
      pDir.push(d);
      pPos.push(d.clone().multiplyScalar(D_SPHERE));
    }
  }

  // —— 事例几何：束方向 û（固定于局部帧），中微子从 −û∞ 飞来至作用点 v₀ ——
  const frame = new THREE.Group();
  frame.rotation.set(0.5, 0.62, 0.28); // 让事例轴相对世界轴倾斜
  group.add(frame);
  const U = new THREE.Vector3(0, 1, 0.28).normalize(); // 局部束方向
  const V0 = new THREE.Vector3(0.15, -0.55, 0);        // 相互作用顶点（近球心）
  const NU_LEN = 7.5;

  // 中微子入射线（−U 方向进入 V0）
  {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      V0.x - U.x * NU_LEN, V0.y - U.y * NU_LEN, V0.z - U.z * NU_LEN,
      V0.x, V0.y, V0.z,
    ]), 3));
    const nuLine = new THREE.Line(g, mat(new THREE.LineDashedMaterial({ color: 0xf472b6, dashSize: 0.2, gapSize: 0.16, transparent: true, opacity: 0.85 })));
    nuLine.computeLineDistances();
    frame.add(nuLine);
  }

  // μ 子径迹（随 phase 延伸）
  const trackGeo = geo(new THREE.BufferGeometry());
  trackGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const track = new THREE.Line(trackGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e })));
  frame.add(track);

  // 切伦科夫锥（顶点 V0，轴 U，半顶角 θ_c：单位底圆锥）
  const coneGeo = geo(new THREE.ConeGeometry(1, 1, 40, 1, true));
  const coneMat = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }));
  const cone = new THREE.Mesh(coneGeo, coneMat);
  frame.add(cone);
  const UPY = new THREE.Vector3(0, 1, 0);

  // 锥面与球壳交线（亮环，实时计算）
  const ringGeo = geo(new THREE.BufferGeometry());
  const RING_N = 96;
  const ringPos = new Float32Array((RING_N + 1) * 3);
  ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPos, 3));
  frame.add(new THREE.Line(ringGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 }))));

  // 顶点标记
  const vtx = new THREE.Mesh(geo(new THREE.SphereGeometry(0.12, 12, 12)), mat(new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xf472b6, emissiveIntensity: 1.5 })));
  vtx.position.copy(V0);
  frame.add(vtx);

  function makeLabel(text: string, color: string, scale = 3.2): import('three').Sprite {
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
  const lNu = makeLabel('中微子 ν（几乎不作用，直穿地球）', '#f472b6', 4.4);
  lNu.position.set(-2.6, -2.6, 0.4); group.add(lNu);
  const lRing = makeLabel('PMT 命中环 = 锥面 ∩ 球壳', '#fbbf24', 3.6);
  lRing.position.set(2.4, 3.0, 0); group.add(lRing);

  const infoCv = document.createElement('canvas');
  infoCv.width = 512; infoCv.height = 256;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const info = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  info.scale.set(7.4, 3.7, 1);
  info.position.set(0, 5.6, 0);
  info.renderOrder = 999;
  group.add(info);

  let beta = 0.95, theta = 0.66, dtSpan = 100, earliestHit = 0;

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 512, 256);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)';
    infoCtx.fillRect(3, 3, 506, 250);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3;
    infoCtx.strokeRect(3, 3, 506, 250);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText('冰立方型中微子望远镜', 14, 36);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '21px "PingFang SC", sans-serif';
    infoCtx.fillText('cosθ_c = 1/(nβ)   n_冰=1.31  β_th=1/n', 14, 72);
    infoCtx.fillText('t_i∝(D−1.31β·p̂_i·û)/c：轴向最早、环等时', 14, 100);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('β→1 极限 θ_c=40.2°；命中时刻反解 û、β', 14, 128);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 20px "PingFang SC", sans-serif';
    if (theta < 0) {
      infoCtx.fillText(`读数: β=${beta.toFixed(3)} < β_th=0.763 ⇒ 无切伦科夫光！`, 14, 162);
      infoCtx.fillText('（径迹不可见 —— 阈值以下不发光）', 14, 192);
    } else {
      infoCtx.fillText(`读数: β=${beta.toFixed(3)} θ_c=${(theta * 57.2958).toFixed(1)}°`, 14, 162);
      infoCtx.fillText(`命中时延跨度≈${dtSpan.toFixed(0)} ns  首闪相位=${earliestHit.toFixed(2)}周期`, 14, 192);
    }
    infoTex.needsUpdate = true;
  }
  drawInfo();

  const dummy = new THREE.Object3D();

  return {
    update(t, dt) {
      // 16 s 周期：μ 子速度 β 从 0.68（亚阈值）扫到 1.0 —— 锥在 β_th=0.763 处突然出现并张到 40.2°
      const cyc = (t % 16) / 16;
      const phase = (t * OMEGA) % 1;       // 事例重演相位
      beta = 0.68 + (1.0 - 0.68) * (0.5 - 0.5 * Math.cos(TWO_PI * cyc));
      const cth = 1 / (N_ICE * beta);
      theta = cth >= 1 ? -1 : Math.acos(cth);

      // PMT 命中时刻（wu/c 单位）：t_i = (D − nβ·p̂_i·û)/C，减去最早命中（最早命中在 p̂·û 最大的轴向 PMT）
      const k = N_ICE * beta;
      const delays = new Float32Array(NPMT);
      let maxDot = -2;
      for (let i = 0; i < NPMT; i++) {
        const dot = pDir[i].dot(U);
        if (dot > maxDot) maxDot = dot;
      }
      const t0 = (D_SPHERE - k * maxDot) / C;  // 最早命中（轴向）作时间零点
      let maxT = 0;
      for (let i = 0; i < NPMT; i++) {
        const raw = (D_SPHERE - k * pDir[i].dot(U)) / C - t0;
        delays[i] = raw;
        if (raw > maxT) maxT = raw;
      }
      const norm = maxT > 1e-6 ? maxT : 1;
      dtSpan = Math.round(maxT * 25 * 1e9 / 3e8); // 1 wu = 25 m ⇒ ns
      earliestHit = 0;

      // 径迹延伸
      const len = Math.min(1, phase * 1.7);
      const ta = trackGeo.attributes['position'] as import('three').BufferAttribute;
      const tp = ta.array as Float32Array;
      tp[0] = V0.x; tp[1] = V0.y; tp[2] = V0.z;
      tp[3] = V0.x + U.x * 3.3 * len; tp[4] = V0.y + U.y * 3.3 * len; tp[5] = V0.z + U.z * 3.3 * len;
      ta.needsUpdate = true;

      // 锥：沿 U 展开，半顶角 θ_c
      const visible = theta > 0.02;
      cone.visible = visible;
      track.visible = true;
      ringGeo.setDrawRange(0, visible ? RING_N + 1 : 0);
      if (visible) {
        const h = 2.7;
        cone.position.copy(V0).addScaledVector(U, h / 2);
        cone.quaternion.setFromUnitVectors(UPY, U);
        cone.scale.set(h * Math.tan(theta), h, h * Math.tan(theta));
        coneMat.opacity = 0.22 * (1 - Math.pow(phase, 1.6));
        // 命中环：cosθ·U + sinθ·(cosφ e₁ + sinφ e₂) 方向与球壳交点
        const e1 = new THREE.Vector3().crossVectors(U, Math.abs(U.y) < 0.9 ? UPY : new THREE.Vector3(1, 0, 0)).normalize();
        const e2 = new THREE.Vector3().crossVectors(U, e1);
        const ct = Math.cos(theta), st = Math.sin(theta);
        for (let j = 0; j <= RING_N; j++) {
          const a = (j / RING_N) * TWO_PI;
          const dir = new THREE.Vector3()
            .addScaledVector(U, ct)
            .addScaledVector(e1, st * Math.cos(a))
            .addScaledVector(e2, st * Math.sin(a));
          ringPos[j * 3] = V0.x + dir.x * (D_SPHERE - 0.45);
          ringPos[j * 3 + 1] = V0.y + dir.y * (D_SPHERE - 0.45);
          ringPos[j * 3 + 2] = V0.z + dir.z * (D_SPHERE - 0.45);
        }
        ringGeo.attributes['position'].needsUpdate = true;
      }

      // PMT 闪烁：命中窗 [dl, dl+0.11]（dl = 归一化时延×win）
      const win = 0.34;
      for (let i = 0; i < NPMT; i++) {
        const dl = (delays[i] / norm) * win;
        const on = visible && phase >= dl && phase < dl + 0.11;
        if (on && earliestHit === 0) earliestHit = dl / win;
        dummy.position.copy(pPos[i]);
        dummy.scale.setScalar(on ? 2.3 : 1);
        dummy.updateMatrix();
        pmtMesh.setMatrixAt(i, dummy.matrix);
      }
      pmtMesh.instanceMatrix.needsUpdate = true;
      if (pmtMesh.instanceColor) pmtMesh.instanceColor.needsUpdate = true;

      vtx.scale.setScalar(1 + 0.6 * Math.max(0, 1 - phase * 5));
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
