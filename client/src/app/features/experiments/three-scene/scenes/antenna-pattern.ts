import type { SceneContext, SceneInstance } from '../types';
/** 天线方向图（P124）：天线阵列方向图 —— 8 元均匀线阵的阵列因子、波束转向与栅瓣。 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  // —— 资源登记，dispose 时统一释放 ——
  const geos: { dispose(): void }[] = [];
  const mats: { dispose(): void }[] = [];
  const texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  // 星野与地面栅格
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

  // —— 阵列模型：N 元沿 x 轴等间距，阵元为沿 y 的半波偶极子 ——
  const N = 8;
  const TWO_PI = Math.PI * 2;
  const R_MAX = 3.6;          // 方向图最大半径（|AF|/N=1 时）
  const TH = 48, PH = 72;     // 极角/方位角分辨率
  let dOverLambda = 0.5;      // 阵元间距 d（以 λ 为单位，λ 归一化）
  let beta = 0;               // 相邻阵元馈电相位差 β（rad）
  let beamPhi = Math.PI / 2;  // 主瓣方位角 φ₀（自阵轴 +x 起算）
  let grating = false;         // 当前是否出现栅瓣

  // 归一化阵列因子 |AF(ψ)|/N，ψ = k·d·cosθ_axis + β
  function afNorm(cosAxis: number): number {
    const psi = TWO_PI * dOverLambda * cosAxis + beta;
    const s2 = Math.sin(psi / 2);
    if (Math.abs(s2) < 1e-7) return 1; // ψ→0 极限：|AF|→N
    return Math.abs(Math.sin((N * psi) / 2) / (N * s2));
  }

  // —— 3D 方向图曲面：r = R_MAX·sinθ（阵元因子）×|AF|/N ——
  const radGeo = geo(new THREE.BufferGeometry());
  const radPos = new Float32Array((TH + 1) * (PH + 1) * 3);
  radGeo.setAttribute('position', new THREE.BufferAttribute(radPos, 3));
  {
    const idx: number[] = [];
    for (let i = 0; i < TH; i++) {
      for (let j = 0; j < PH; j++) {
        const a = i * (PH + 1) + j, b = a + 1, c = a + PH + 1, e = c + 1;
        idx.push(a, b, c, b, e, c);
      }
    }
    radGeo.setIndex(idx);
  }
  const radWire = new THREE.Mesh(radGeo, mat(new THREE.MeshBasicMaterial({
    color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.32, side: THREE.DoubleSide,
  })));
  const radSolid = new THREE.Mesh(radGeo, mat(new THREE.MeshBasicMaterial({
    color: 0x22c55e, transparent: true, opacity: 0.1, side: THREE.DoubleSide,
  })));
  group.add(radWire, radSolid);

  function updatePattern(): void {
    let v = 0;
    for (let i = 0; i <= TH; i++) {
      const theta = (i / TH) * Math.PI;         // 极角：自偶极子轴 +y 起算
      const sinT = Math.sin(theta), cosT = Math.cos(theta);
      for (let j = 0; j <= PH; j++) {
        const phi = (j / PH) * TWO_PI;          // 方位角：自阵轴 +x 起算
        const cosAxis = sinT * Math.cos(phi);   // 观测方向与阵轴夹角的余弦
        const r = R_MAX * sinT * afNorm(cosAxis);
        radPos[v * 3] = r * cosAxis;            // x
        radPos[v * 3 + 1] = r * cosT;           // y
        radPos[v * 3 + 2] = r * sinT * Math.sin(phi); // z
        v++;
      }
    }
    radGeo.attributes['position'].needsUpdate = true;
  }

  // —— 水平面（余割方面）2D 切片：r = R2·|AF|/N ——
  const CUT_SEGS = 180;
  const cutGeo = geo(new THREE.BufferGeometry());
  const cutPos = new Float32Array((CUT_SEGS + 1) * 3);
  cutGeo.setAttribute('position', new THREE.BufferAttribute(cutPos, 3));
  const CUT_Y = -1.9, R2 = 2.5;
  group.add(new THREE.Line(cutGeo, mat(new THREE.LineBasicMaterial({ color: 0xf59e0b }))));
  function updateCut(): void {
    for (let j = 0; j <= CUT_SEGS; j++) {
      const phi = (j / CUT_SEGS) * TWO_PI;
      const r = R2 * afNorm(Math.cos(phi));
      cutPos[j * 3] = r * Math.cos(phi);
      cutPos[j * 3 + 1] = CUT_Y;
      cutPos[j * 3 + 2] = r * Math.sin(phi);
    }
    cutGeo.attributes['position'].needsUpdate = true;
  }

  // —— 8 个辐射单元（沿 y 的短棒 + 馈电球）——
  const WORLD_SP = 0.95; // d=1λ 时阵元间距的世界坐标尺度
  const rodGeo = geo(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8));
  const feedGeo = geo(new THREE.SphereGeometry(0.12, 12, 12));
  const rods: import('three').Mesh[] = [];
  const feeds: import('three').Mesh[] = [];
  const feedMats: import('three').MeshStandardMaterial[] = [];
  for (let i = 0; i < N; i++) {
    const rodMat = mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.35 }));
    const rod = new THREE.Mesh(rodGeo, rodMat);
    group.add(rod);
    rods.push(rod);
    const feedMat = mat(new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.5 }));
    const feed = new THREE.Mesh(feedGeo, feedMat);
    group.add(feed);
    feeds.push(feed);
    feedMats.push(feedMat);
  }
  const railGeo = geo(new THREE.BufferGeometry());
  railGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const rail = new THREE.Line(railGeo, mat(new THREE.LineBasicMaterial({ color: 0x475569 })));
  group.add(rail);

  // —— 主瓣指向箭头（水平面内）——
  const beamGeo = geo(new THREE.BufferGeometry());
  beamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const beamLine = new THREE.Line(beamGeo, mat(new THREE.LineBasicMaterial({ color: 0xf472b6 })));
  group.add(beamLine);
  const beamTip = new THREE.Mesh(geo(new THREE.ConeGeometry(0.16, 0.45, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })));
  group.add(beamTip);
  const UP = new THREE.Vector3(0, 1, 0);

  // —— 文字标签（Sprite；几何体为 three 内部共享，不释放）——
  function makeLabel(text: string, color: string, scale = 4.2): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 30px "PingFang SC", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const t = tex(new THREE.CanvasTexture(cv));
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: t, transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  const labelArr = makeLabel('8 元均匀线阵（阵轴 x）', '#94a3b8');
  labelArr.position.set(0, 2.1, 0);
  group.add(labelArr);
  const labelCut = makeLabel('水平面切片 ∝ |AF(ψ)|', '#f59e0b', 3.4);
  labelCut.position.set(0, CUT_Y - 1.1, 0);
  group.add(labelCut);

  // —— 信息面板（画布平面，始终朝向相机平面近似）——
  const infoCv = document.createElement('canvas');
  infoCv.width = 800; infoCv.height = 240;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(8.8, 2.64)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 5.6, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  ctx.camera.position.set(3.2, 4.4, 13);
  ctx.camera.lookAt(0, 0.6, 0);

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 800, 240);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 792, 232);
    infoCtx.strokeStyle = '#334155';
    infoCtx.lineWidth = 3;
    infoCtx.strokeRect(4, 4, 792, 232);

    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 30px "PingFang SC", sans-serif';
    infoCtx.fillText('天线阵列方向图  N=8 均匀线阵（阵元因子 sinθ × 阵列因子 AF）', 22, 44);

    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '27px "PingFang SC", sans-serif';
    infoCtx.fillText('AF(ψ) = sin(Nψ/2)/sin(ψ/2)，ψ = k·d·cosφ + β，k = 2π/λ', 22, 86);

    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('主瓣宽度 Δθ₀.₅ ≈ 0.886·λ/(N·d) = ' + ((0.886 / (N * dOverLambda)) * 57.2958).toFixed(1) + '°', 22, 126);

    infoCtx.fillStyle = '#f472b6';
    infoCtx.fillText('波束转向靠相位梯度 β（非移动天线）：ψ=0 ⇒ cosφ₀ = −β/(kd)', 22, 166);

    infoCtx.fillStyle = grating ? '#ef4444' : '#94a3b8';
    infoCtx.font = 'bold 27px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：β = ${((beta * 180) / Math.PI).toFixed(0)}°   d = ${dOverLambda.toFixed(2)}λ   主瓣 φ₀ = ${((beamPhi * 180) / Math.PI).toFixed(0)}°   栅瓣：${grating ? '出现！(d=λ)' : '无'}`,
      22, 208,
    );
    infoTex.needsUpdate = true;
  }

  updatePattern();
  updateCut();
  drawInfo();

  return {
    update(t, dt) {
      // 相位差 β 循环扫描（+π→−π）；周期后段把 d 推到 λ 演示栅瓣
      const cycle = t % 18;
      const dTarget = cycle < 12 ? 0.5 : 1.0;
      dOverLambda += (dTarget - dOverLambda) * Math.min(1, dt * 2.5);
      const sweep = cycle < 12 ? cycle / 6 : (cycle - 12) / 6; // 每 6s 一次 β 扫描
      beta = Math.PI - TWO_PI * Math.min(1, sweep);

      const kd = TWO_PI * dOverLambda;
      const cosPhi0 = Math.max(-1, Math.min(1, -beta / kd));
      beamPhi = Math.acos(cosPhi0);
      // 存在 ψ=±2π 的可行解 ⇒ 出现栅瓣（d≥λ 时几乎总有）
      grating = Math.abs(beta) >= TWO_PI - kd - 1e-9 && dOverLambda > 0.7;

      updatePattern();
      updateCut();

      // 阵元位置与馈电相位动画
      const ws = dOverLambda * WORLD_SP;
      const rp = railGeo.attributes['position'] as import('three').BufferAttribute;
      const ra = rp.array as Float32Array;
      ra[0] = -((N - 1) / 2) * ws; ra[3] = ((N - 1) / 2) * ws;
      rp.needsUpdate = true;
      for (let i = 0; i < N; i++) {
        const x = ((N - 1) / 2 - i) * ws; // 越靠 +x 相位越滞后
        rods[i].position.set(x, 0.65, 0);
        feeds[i].position.set(x, 0.06, 0);
        const phase = i * beta;
        const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.cos(t * 6 - phase));
        feedMats[i].emissiveIntensity = pulse;
        const hue = (((-phase / TWO_PI) % 1) + 1) % 1;
        feedMats[i].color.setHSL(hue, 0.75, 0.55);
        feedMats[i].emissive.setHSL(hue, 0.75, 0.45);
      }

      // 主瓣箭头
      const bdir = new THREE.Vector3(Math.cos(beamPhi), 0, Math.sin(beamPhi));
      const bp = beamGeo.attributes['position'] as import('three').BufferAttribute;
      const ba = bp.array as Float32Array;
      const len = R_MAX * 1.08;
      ba[3] = bdir.x * len; ba[4] = 0; ba[5] = bdir.z * len;
      bp.needsUpdate = true;
      beamTip.position.set(bdir.x * len, 0, bdir.z * len);
      beamTip.quaternion.setFromUnitVectors(UP, bdir);

      // 面板按 5Hz 刷新
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
