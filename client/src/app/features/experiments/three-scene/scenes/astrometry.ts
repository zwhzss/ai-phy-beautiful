import type { SceneContext, SceneInstance } from '../types';
/**
 * 天体测量观测（P286）：盖亚式视差椭圆 + 自行 + 视向速度 ⇒ 三维空间速度。
 * 主控方程：θ(") = 1/d(pc) 决定视差椭圆半长轴（短轴 = θ·sinβ_ecl）；
 * 自行 μ["/yr] = v_t/(4.74·d)（4.74 km/s = 1 AU/yr），漂移速率 ∝ μ；
 * 三维速度 V = √(v_t²+v_r²)，速度三角形画在像点处：v_t 沿自行方向、v_r 沿视线。
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

  // —— 参考天球背景板 ——
  const SKY_X = -4.6;
  {
    const gGeo = geo(new THREE.BufferGeometry());
    const gp: number[] = [];
    for (let k = -3; k <= 3; k++) {
      gp.push(SKY_X, k * 1.05, -3.2, SKY_X, k * 1.05, 3.2);
      gp.push(SKY_X, -3.2, k * 1.05, SKY_X, 3.2, k * 1.05);
    }
    gGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(gp), 3));
    group.add(new THREE.LineSegments(gGeo, mat(new THREE.LineBasicMaterial({ color: 0x1e293b }))));
    const board = new THREE.Mesh(geo(new THREE.PlaneGeometry(6.6, 6.6)), mat(new THREE.MeshBasicMaterial({ color: 0x0b1220, transparent: true, opacity: 0.55, side: THREE.DoubleSide })));
    board.rotation.y = Math.PI / 2;
    board.position.x = SKY_X - 0.02;
    group.add(board);
  }

  // —— 太阳与地球轨道 ——
  const ORBIT_R = 1.0;
  {
    const n = 96;
    const op = new Float32Array((n + 1) * 3);
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      op[i * 3] = Math.cos(a) * ORBIT_R; op[i * 3 + 1] = 0; op[i * 3 + 2] = Math.sin(a) * ORBIT_R;
    }
    const og = geo(new THREE.BufferGeometry());
    og.setAttribute('position', new THREE.BufferAttribute(op, 3));
    group.add(new THREE.LineLoop(og, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));
  }
  const sun = new THREE.Mesh(geo(new THREE.SphereGeometry(0.17, 16, 16)), mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 1.4 })));
  group.add(sun);
  const earth = new THREE.Mesh(geo(new THREE.SphereGeometry(0.085, 12, 12)), mat(new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x1d4ed8, emissiveIntensity: 0.6 })));
  group.add(earth);

  // —— 目标星参数 ——
  const AMP1 = 1.15;                        // 1 pc 星椭圆半长轴（展示映射，∝θ=1/d）
  const VT = 60, VR = 45;                   // km/s
  const BETA_ECL = (60 * Math.PI) / 180;
  const YEAR = 6;                           // 秒/年（动画）
  const PM = new THREE.Vector3(0, 0.82, 0.57).normalize(); // 自行方向（板内）
  let dist = 8;

  // 当年视差椭圆、多年摆线轨迹
  const ellGeo = geo(new THREE.BufferGeometry());
  const ellPos = new Float32Array(97 * 3);
  ellGeo.setAttribute('position', new THREE.BufferAttribute(ellPos, 3));
  group.add(new THREE.Line(ellGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.8 }))));
  const trailGeo = geo(new THREE.BufferGeometry());
  const TRAIL_N = 420;
  const trailPos = new Float32Array(TRAIL_N * 3);
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  group.add(new THREE.Line(trailGeo, mat(new THREE.LineBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.55 }))));

  const losGeo = geo(new THREE.BufferGeometry());
  losGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  group.add(new THREE.Line(losGeo, mat(new THREE.LineBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.3 }))));

  const star = new THREE.Mesh(geo(new THREE.SphereGeometry(0.12, 14, 14)), mat(new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xf472b6, emissiveIntensity: 1.1 })));
  group.add(star);
  const image = new THREE.Mesh(geo(new THREE.SphereGeometry(0.09, 12, 12)), mat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 1.4 })));
  group.add(image);

  // 速度三角形（3 段线段：v_t、v_r、合成 V）
  const velGeo = geo(new THREE.BufferGeometry());
  velGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * 3), 3));
  group.add(new THREE.LineSegments(velGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e }))));

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
  const lSky = makeLabel('参考天球（遥远类星体网格）', '#64748b', 3.6); lSky.position.set(SKY_X, 3.85, 0); group.add(lSky);
  const lSun = makeLabel('地球轨道=2 AU 基线', '#94a3b8', 2.8); lSun.position.set(0.6, -0.9, 0); group.add(lSun);

  const infoCv = document.createElement('canvas');
  infoCv.width = 512; infoCv.height = 256;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const info = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  info.scale.set(7.4, 3.7, 1);
  info.position.set(1.4, 4.6, 0);
  info.renderOrder = 999;
  group.add(info);

  let theta = AMP1 / dist, minor = theta * Math.sin(BETA_ECL), muMas = 0, vTot = 0, driftRate = 0;

  function computeVars(): void {
    theta = AMP1 / dist;                      // 半长轴 ∝ θ(")=1/d
    minor = theta * Math.sin(BETA_ECL);       // 短轴 = θ·sinβ_ecl
    muMas = (VT / (4.74 * dist)) * 1e3;       // μ (mas/yr)
    vTot = Math.hypot(VT, VR);
    driftRate = 0.03 * (muMas / 1000);        // 漂移 wu/yr ∝ μ（0.03wu ⇔ 1000mas/yr）
  }
  computeVars();

  // 像点位置函数（时间纯函数，供轨迹重演）
  function imagePos(tt: number, out: import('three').Vector3): void {
    const yearA = ((tt % YEAR) / YEAR) * Math.PI * 2;
    const drift = driftRate * (tt / YEAR);
    const dw = ((drift % 6) + 6) % 6 - 3;
    out.set(SKY_X, minor * Math.cos(yearA) + dw * PM.y, theta * Math.sin(yearA) + dw * PM.z);
  }

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 512, 256);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)';
    infoCtx.fillRect(3, 3, 506, 250);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3;
    infoCtx.strokeRect(3, 3, 506, 250);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText('天体测量：视差+自行+视向速度', 14, 36);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '21px "PingFang SC", sans-serif';
    infoCtx.fillText('θ(")=1/d(pc) 短轴=θ·sinβ_ecl', 14, 72);
    infoCtx.fillText('μ["/yr]=v_t/(4.74·d) V=√(v_t²+v_r²)', 14, 100);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('d↑ ⇒ 椭圆与年漂移双双缩小（∝1/d）', 14, 128);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 20px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数: d=${dist.toFixed(1)}pc θ=${(1e6 / dist).toFixed(0)}mas`, 14, 162);
    infoCtx.fillText(`μ=${(muMas / 1000).toFixed(2)}"/yr 漂移=${driftRate.toFixed(3)}wu/yr`, 14, 192);
    infoCtx.fillText(`v_t=${VT} v_r=${VR} ⇒ V=${vTot.toFixed(1)}km/s`, 14, 226);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  const tmpP = new THREE.Vector3();

  return {
    update(t, dt) {
      // 16 s 周期：d 从 2.5 pc 扫到 20 pc
      const cyc = (t % 16) / 16;
      dist = 2.5 + (20 - 2.5) * (0.5 - 0.5 * Math.cos(Math.PI * 2 * cyc));
      computeVars();

      const yearA = ((t % YEAR) / YEAR) * Math.PI * 2;
      earth.position.set(Math.cos(yearA) * ORBIT_R, 0, Math.sin(yearA) * ORBIT_R);

      imagePos(t, tmpP);
      image.position.copy(tmpP);
      star.position.set(tmpP.x * 0.42, tmpP.y * 0.42, tmpP.z * 0.42);

      // 视线
      const la = losGeo.attributes['position'] as import('three').BufferAttribute;
      const lp = la.array as Float32Array;
      lp[0] = earth.position.x; lp[1] = 0; lp[2] = earth.position.z;
      lp[3] = tmpP.x; lp[4] = tmpP.y; lp[5] = tmpP.z;
      la.needsUpdate = true;

      // 当年椭圆（中心=去掉年项的漂移位置）
      const cy = tmpP.y - minor * Math.cos(yearA);
      const cz = tmpP.z - theta * Math.sin(yearA);
      for (let i = 0; i < 97; i++) {
        const a = (i / 96) * Math.PI * 2;
        ellPos[i * 3] = SKY_X;
        ellPos[i * 3 + 1] = cy + minor * Math.cos(a);
        ellPos[i * 3 + 2] = cz + theta * Math.sin(a);
      }
      ellGeo.attributes['position'].needsUpdate = true;

      // 摆线轨迹：最近 6.4 s（约一年出头）滚动重采样
      for (let j = 0; j < TRAIL_N; j++) {
        imagePos(t - 6.4 + (j / TRAIL_N) * 6.4, tmpP);
        trailPos[j * 3] = SKY_X;
        trailPos[j * 3 + 1] = tmpP.y;
        trailPos[j * 3 + 2] = tmpP.z;
      }
      trailGeo.attributes['position'].needsUpdate = true;

      // 速度三角形：v_t（板内沿 PM）+ v_r（沿视线）+ 合成 V
      const P = image.position;
      const V_SCALE = 0.008;                      // wu per km/s（两臂同一标度 ⇒ 真正的速度三角形）
      const vtLen = V_SCALE * VT;                 // ∝ v_t（与 d 无关；随 d 变的是 μ，见漂移轨迹）
      const vrLen = V_SCALE * VR;                  // ∝ v_r
      const losDir = new THREE.Vector3().subVectors(P, earth.position).normalize();
      const tipT = P.clone().addScaledVector(PM, vtLen);
      const tipR = P.clone().addScaledVector(losDir, vrLen);
      const tipV = tipR.clone().addScaledVector(PM, vtLen); // V = v_r + v_t
      const va = velGeo.attributes['position'] as import('three').BufferAttribute;
      const vv = va.array as Float32Array;
      const seg = [P, tipT, P, tipR, tipR, tipV];
      for (let i = 0; i < 6; i++) {
        vv[i * 3] = seg[i].x; vv[i * 3 + 1] = seg[i].y; vv[i * 3 + 2] = seg[i].z;
      }
      va.needsUpdate = true;

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
