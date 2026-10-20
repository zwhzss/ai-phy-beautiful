import type { SceneContext, SceneInstance } from '../types';
/**
 * X 射线天文观测（P278）：Wolter-I 掠射嵌套镜筒（钱德拉型），逐层切锥精确追迹。
 * 主控方程：全外反射临界角 θ_c ≈ 2.0°/E[keV]；嵌套判据：擦角 α = r/(2f) ≤ θ_c（α 取外层缘最大值）；
 * 第一射：平行光在抛物段切锥（斜率 α）上反射，会聚角 θ₁ = r_b/f 指向虚焦 F1；
 * 第二射：双曲段切锥斜率 (θ₁+θ₂)/2，折向公共实焦 F2（θ₂ = r_h/(F2−x_h)），全程子午面内解析计算。
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

  // —— 光机（1 wu ≙ 1.2 m：焦距 f=8 wu≈9.6 m、层长 1.9 m、顶点距 3.4 m ⇒ 钱德拉量级，纵向真实比例）——
  const SHELLS = 6;
  const F1X = 8.0;                  // 虚焦（抛物面焦距 f）
  const DETX = 9.0;                 // 实焦面 F2（双曲段略减会聚 ⇒ 焦后移）
  const PAR_X1 = 1.6;               // 抛物段末端（段长 1.6 wu ≈ 1.9 m）
  const HYP_X0 = 2.9, HYP_X1 = 4.5; // 双曲段（顶点距 2.9−1.6≈1.3 wu）
  const R_MAX = 1.15, R_MIN = 0.34;
  const shellR: number[] = [], shellAlpha: number[] = [];
  for (let i = 0; i < SHELLS; i++) {
    const r = R_MIN + (R_MAX - R_MIN) * (i / (SHELLS - 1));
    shellR.push(r);
    shellAlpha.push(r / (2 * F1X)); // α = r/(2f)：内层 1.22°…外层 4.12°
  }

  // —— 子午面追迹（小角近似 tanθ≈θ）——
  interface Ray2D { rb: number; xb: number; th1: number; xh: number; rh: number; th2: number; slope2: number }
  function traceShell(r0: number): Ray2D {
    const s1 = r0 / (2 * F1X);                    // 抛物段切线斜率（=擦角 α）
    const xb = PAR_X1;                            // 代表光线在抛物段末缘反射
    const rb = r0 - s1 * xb;
    const th1 = rb / (F1X - xb);                  // 第一射后会聚角（指向 F1）
    const xh = HYP_X0 + 0.8;                      // 二次反射取双曲段中点（构造交点）
    const rh = rb - th1 * (xh - xb);
    const th2 = rh / (DETX - xh);                 // 第二射后会聚角（指向 F2）
    const slope2 = 0.5 * (th1 + th2);             // 双曲段切锥斜率 =(θ₁+θ₂)/2
    return { rb, xb, th1, xh, rh, th2, slope2 };
  }

  // —— 镜壳网格（C 形开口切锥）——
  const shellMeshes: { parMat: import('three').MeshStandardMaterial, hypMat: import('three').MeshStandardMaterial }[] = [];
  const ARC_START = 0.35, ARC_LEN = Math.PI * 1.55;
  for (let s = 0; s < SHELLS; s++) {
    const r0 = shellR[s];
    const ray = traceShell(r0);
    const s1 = r0 / (2 * F1X);
    const rParEnd = r0 - s1 * PAR_X1;
    const parMat = mat(new THREE.MeshStandardMaterial({ color: 0x7dd3fc, metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide, transparent: true }));
    const par = new THREE.Mesh(geo(new THREE.CylinderGeometry(rParEnd, r0, PAR_X1, 40, 1, true, ARC_START, ARC_LEN)), parMat);
    par.rotation.z = -Math.PI / 2;
    par.position.x = PAR_X1 / 2;
    group.add(par);
    const rH0 = ray.rh + ray.slope2 * (ray.xh - HYP_X0);
    const rH1 = ray.rh - ray.slope2 * (HYP_X1 - ray.xh);
    const hypMat = mat(new THREE.MeshStandardMaterial({ color: 0x93c5fd, metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide, transparent: true }));
    const hyp = new THREE.Mesh(geo(new THREE.CylinderGeometry(Math.max(rH1, 0.05), Math.max(rH0, 0.06), HYP_X1 - HYP_X0, 40, 1, true, ARC_START, ARC_LEN)), hypMat);
    hyp.rotation.z = -Math.PI / 2;
    hyp.position.x = (HYP_X0 + HYP_X1) / 2;
    group.add(hyp);
    shellMeshes.push({ parMat, hypMat });
  }

  // 背骨与端环
  {
    const spine = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.045, 0.045, DETX + 0.6, 8)), mat(new THREE.MeshStandardMaterial({ color: 0x334155 })));
    spine.rotation.z = Math.PI / 2;
    spine.position.x = (DETX + 0.6) / 2 - 0.3;
    group.add(spine);
    for (const xx of [0, DETX]) {
      const ring = new THREE.Mesh(geo(new THREE.TorusGeometry(R_MAX + 0.08, 0.02, 8, 36)), mat(new THREE.MeshStandardMaterial({ color: 0x475569 })));
      ring.rotation.y = Math.PI / 2;
      ring.position.x = xx;
      group.add(ring);
    }
  }

  // 焦面与焦点斑
  const focalPlane = new THREE.Mesh(geo(new THREE.CircleGeometry(0.75, 40)), mat(new THREE.MeshBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.72, side: THREE.DoubleSide })));
  focalPlane.rotation.y = -Math.PI / 2;
  focalPlane.position.x = DETX + 0.02;
  group.add(focalPlane);
  const fSpot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.085, 12, 12)), mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 1.6 })));
  fSpot.position.set(DETX + 0.02, 0, 0);
  group.add(fSpot);

  // —— 光线：每层一条折线（4 段行进动画）——
  const RAYCOL = [0xa78bfa, 0x22d3ee, 0xf472b6, 0x34d399, 0xfbbf24, 0x93c5fd];
  const AZ = [-0.55, -0.12, 0.3, 0.72, 1.25, 1.95];
  const rayData: { pts: import('three').Vector3[], live: boolean }[] = [];
  const segs: { line: import('three').Line, g: import('three').BufferGeometry, pos: Float32Array }[] = [];
  for (let s = 0; s < SHELLS; s++) {
    const ray = traceShell(shellR[s]);
    const ca = Math.cos(AZ[s]), sa = Math.sin(AZ[s]);
    const v = (x: number, r: number): import('three').Vector3 => new THREE.Vector3(x, r * ca, r * sa);
    rayData.push({
      pts: [v(-1.3, ray.rb), v(ray.xb, ray.rb), v(ray.xh, ray.rh), v(DETX + 0.02, 0.004)],
      live: true,
    });
    for (let k = 0; k < 4; k++) {
      const g = geo(new THREE.BufferGeometry());
      const pos = new Float32Array(6);
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const l = new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color: RAYCOL[s], transparent: true, opacity: 0.85 })));
      group.add(l);
      segs.push({ line: l, g, pos });
    }
  }

  let thc = 0.1, eKeV = 0.3, active = SHELLS;

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
  const lPar = makeLabel('掠射抛物面段（第一射）', '#7dd3fc', 3.2); lPar.position.set(0.8, 1.5, 0); group.add(lPar);
  const lHyp = makeLabel('掠射双曲面段（第二射）', '#93c5fd', 3.2); lHyp.position.set(3.7, 1.5, 0); group.add(lHyp);
  const lIn = makeLabel('X 射线平行入射', '#c4b5fd', 2.8); lIn.position.set(-1.2, 0.75, 0); group.add(lIn);
  const lDet = makeLabel('焦面探测器', '#fbbf24', 2.4); lDet.position.set(DETX + 0.1, -0.85, 0); group.add(lDet);

  const infoCv = document.createElement('canvas');
  infoCv.width = 512; infoCv.height = 256;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const info = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  info.scale.set(7.4, 3.7, 1);
  info.position.set(4.5, 3.2, 0);
  info.renderOrder = 999;
  group.add(info);

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 512, 256);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)';
    infoCtx.fillRect(3, 3, 506, 250);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3;
    infoCtx.strokeRect(3, 3, 506, 250);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText('Wolter-I 掠射嵌套镜', 14, 36);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '21px "PingFang SC", sans-serif';
    infoCtx.fillText('θ_c≈2.0°/E[keV]（全外反射临界角）', 14, 72);
    infoCtx.fillText('嵌套判据：擦角 α=r/(2f) ≤ θ_c', 14, 100);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('两次掠射折向公共焦：直筒、无色差', 14, 128);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 20px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数: E=${eKeV.toFixed(2)}keV θ_c=${(thc * 57.2958).toFixed(2)}°`, 14, 162);
    infoCtx.fillText(`反射层 ${active}/${SHELLS}  α₁=${(shellAlpha[0] * 57.2958).toFixed(2)}° α₆=${(shellAlpha[SHELLS - 1] * 57.2958).toFixed(2)}°`, 14, 192);
    infoCtx.fillText('E↑⇒θ_c↓⇒可反射层数减少（硬 X 截止）', 14, 226);
    infoTex.needsUpdate = true;
  }

  function gateShells(): void {
    active = 0;
    for (let s = 0; s < SHELLS; s++) {
      const live = shellAlpha[s] <= thc;
      if (live) active++;
      rayData[s].live = live;
      for (const mm of [shellMeshes[s].parMat, shellMeshes[s].hypMat]) {
        mm.color.setHex(live ? 0x7dd3fc : 0x475569);
        mm.emissive.setHex(live ? 0x0b3a55 : 0x0f172a);
        mm.emissiveIntensity = live ? 0.5 : 0.1;
        mm.opacity = live ? 0.95 : 0.35;
      }
    }
  }

  gateShells();
  drawInfo();

  return {
    update(t, dt) {
      // 15 s 周期：E 在 0.2–10 keV 往返（log 域）——θ_c∝1/E，外层逐层熄灭
      const cyc = (t % 15) / 15;
      const tri = 0.5 - 0.5 * Math.cos(Math.PI * 2 * cyc);
      eKeV = Math.pow(10, Math.log10(0.2) + tri * (Math.log10(10) - Math.log10(0.2)));
      thc = (2.0 * Math.PI / 180) / eKeV;
      gateShells();

      // 光子行进动画（三段反射路径 + 会聚）
      const head = (t * 0.85) % 1.2;
      const tot = [0.3, 0.28, 0.26, 0.32];
      let acc = 0;
      const frag: number[] = [];
      for (let k = 0; k < 4; k++) {
        frag.push(Math.max(0, Math.min(1, (head - acc) / tot[k])));
        acc += tot[k];
      }
      for (let s = 0; s < SHELLS; s++) {
        const rd = rayData[s];
        for (let k = 0; k < 4; k++) {
          const seg = segs[s * 4 + k];
          const A = rd.pts[k];
          const B = k < 3 ? rd.pts[k + 1] : rd.pts[3];
          const f = frag[k];
          seg.pos[0] = A.x; seg.pos[1] = A.y; seg.pos[2] = A.z;
          seg.pos[3] = A.x + (B.x - A.x) * f;
          seg.pos[4] = A.y + (B.y - A.y) * f;
          seg.pos[5] = A.z + (B.z - A.z) * f;
          seg.g.attributes['position'].needsUpdate = true;
          seg.line.visible = rd.live && f > 0.001;
        }
      }
      fSpot.visible = active > 0 && head > 0.92;
      fSpot.scale.setScalar(0.5 + 1.2 * (active / SHELLS));
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
