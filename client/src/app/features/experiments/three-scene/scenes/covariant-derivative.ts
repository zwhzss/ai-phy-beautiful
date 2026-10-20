import type { SceneContext, SceneInstance } from '../types';
/** 协变导数与平行输运（P574）：主控方程 D V^μ/dλ = dV^μ/dλ + Γ^μ_{αβ} V^α dx^β/dλ = 0。
 *  单位球面上沿纬圈平行输运一个切矢量：克氏项修正在切空间里可见；回原点方向偏转（和乐角）
 *  精确等于闭曲线围住的 ∫∫K·dA = 2π(1−cosθ₀)（Gauss–Bonnet）。纬圈输运有闭式解 dψ/dλ = −cosθ₀。 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  // —— 资源登记 ——
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
  const R = 2.2;                      // 球半径（世界单位）
  const NSEG = 72;                    // 纬圈分辨率

  // —— 球面 ——
  const sphere = new THREE.Mesh(
    geo(new THREE.SphereGeometry(R, 36, 24)),
    mat(new THREE.MeshBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.16 })),
  );
  sphere.position.y = 1.2;
  const wire = new THREE.Mesh(
    sphere.geometry,
    mat(new THREE.MeshBasicMaterial({ color: 0x1e3a5f, wireframe: true, transparent: true, opacity: 0.34 })),
  );
  wire.position.copy(sphere.position);
  group.add(sphere, wire);

  // —— 纬圈路径（θ₀ 改变时重算） ——
  const loopGeo = geo(new THREE.BufferGeometry());
  const loopPos = new Float32Array((NSEG + 1) * 3);
  loopGeo.setAttribute('position', new THREE.BufferAttribute(loopPos, 3));
  group.add(new THREE.Line(loopGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee }))));

  // —— 矢量箭头：Line(6 floats) + 共享锥头 ——
  const coneGeo = geo(new THREE.ConeGeometry(0.09, 0.26, 10));
  const UP = new THREE.Vector3(0, 1, 0);
  function makeArrow(color: number): { line: import('three').Line; tip: import('three').Mesh; attr: import('three').BufferAttribute } {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const m = mat(new THREE.LineBasicMaterial({ color }));
    const line = new THREE.Line(g, m);
    const tip = new THREE.Mesh(coneGeo, mat(new THREE.MeshBasicMaterial({ color })));
    group.add(line, tip);
    return { line, tip, attr: g.attributes['position'] as import('three').BufferAttribute };
  }
  function setArrow(a: ReturnType<typeof makeArrow>, base: import('three').Vector3, dir: import('three').Vector3, len: number): void {
    const arr = a.attr.array as Float32Array;
    arr[0] = base.x; arr[1] = base.y; arr[2] = base.z;
    arr[3] = base.x + dir.x * len; arr[4] = base.y + dir.y * len; arr[5] = base.z + dir.z * len;
    a.attr.needsUpdate = true;
    a.tip.position.set(base.x + dir.x * (len + 0.1), base.y + dir.y * (len + 0.1), base.z + dir.z * (len + 0.1));
    a.tip.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
    const vis = len > 0.02;
    a.line.visible = vis; a.tip.visible = vis;
  }
  const arrowV = makeArrow(0x22c55e);   // 平行输运的 V（绿）
  const arrowT = makeArrow(0x22d3ee);   // 局部切标架 e_φ（青）
  const arrowM = makeArrow(0xa855f7);   // 局部切标架 e_θ（紫）
  const arrowV0 = makeArrow(0xef4444);  // 初始方向参照（红，固定在出发点）

  // —— 移动点的切平面贴片（克氏项修正发生的地方） ——
  const discGeo = geo(new THREE.CircleGeometry(0.62, 28));
  const disc = new THREE.Mesh(discGeo, mat(new THREE.MeshBasicMaterial({
    color: 0x22d3ee, transparent: true, opacity: 0.14, side: THREE.DoubleSide,
  })));
  group.add(disc);

  // —— 标签 ——
  function makeLabel(text: string, color: string, scale = 3.8): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 30px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  const labelTip = makeLabel('绕行一周：V 与初始方向（红）的夹角 = 围住的曲面面积', '#f472b6', 5.2);
  labelTip.position.set(0, -1.5, 0);
  group.add(labelTip);

  // —— 面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 800; infoCv.height = 262;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(8.8, 2.88)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 5.7, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  // 状态（与几何同源）
  let theta0 = 0.5;         // 纬线圈极角
  let lam = 0;              // 环路相位 0..2π
  let holonomyDeg = 0;

  const pNow = new THREE.Vector3();
  const Tvec = new THREE.Vector3();
  const Mvec = new THREE.Vector3();
  const Vvec = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 800, 262);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 792, 254);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 792, 254);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 30px "PingFang SC", sans-serif';
    infoCtx.fillText('协变导数与平行输运 —— 球面 K=1/R²，纬圈闭环的和乐角', 22, 44);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '27px "PingFang SC", sans-serif';
    infoCtx.fillText('DVᵘ/dλ = dVᵘ/dλ + Γᵘ_{αβ} Vᵅ dxᵝ/dλ = 0（减去克氏项才是"导数"）', 22, 84);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('纬圈闭式解 dψ/dλ = −cosθ₀ ⇒ 回原点转角 = ∫∫K·dA = 2π(1−cosθ₀)', 22, 124);
    infoCtx.fillStyle = theta0 > 1.0 ? '#fbbf24' : '#94a3b8';
    infoCtx.font = 'bold 27px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：θ₀ = ${(theta0 * 57.2958).toFixed(1)}°  环路相位 λ = ${(lam * 57.2958).toFixed(0)}°  相对标架角 ψ = ${(Math.atan2(Vvec.dot(Mvec), Vvec.dot(Tvec)) * 57.2958).toFixed(0)}°  和乐角 = ${holonomyDeg.toFixed(0)}°`,
      22, 172,
    );
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '27px "PingFang SC", sans-serif';
    infoCtx.fillText('θ₀=60° 时整圈矢头恰好翻转 180°', 22, 210);
    infoCtx.font = '24px "PingFang SC", sans-serif';
    infoCtx.fillText('赤道（θ₀=90°）为测地线：cosθ₀=0 ⇒ ψ 不变，V 三维方向不转，和乐角 ≡ 0°', 22, 244);
    infoTex.needsUpdate = true;
  }

  drawInfo();

  return {
    update(t, dt) {
      // 扫描纬线圈极角 θ₀：15°→85°→15°，周期 16s
      const ph = (t % 16) / 16;
      theta0 = (0.262 + (1.484 - 0.262) * (0.5 - 0.5 * Math.cos(TWO_PI * ph)));
      const sT = Math.sin(theta0), cT = Math.cos(theta0);

      // 环路相位：6s 走一圈
      lam = ((t % 6) / 6) * TWO_PI;

      // 纬圈路径
      for (let i = 0; i <= NSEG; i++) {
        const a = (i / NSEG) * TWO_PI;
        loopPos[i * 3] = R * sT * Math.cos(a);
        loopPos[i * 3 + 1] = 1.2 + R * cT;
        loopPos[i * 3 + 2] = R * sT * Math.sin(a);
      }
      loopGeo.attributes['position'].needsUpdate = true;

      // 当前点与局部标架
      const cl = Math.cos(lam), sl = Math.sin(lam);
      pNow.set(R * sT * cl, 1.2 + R * cT, R * sT * sl);
      Tvec.set(-sl, 0, cl);                                    // 东向
      Mvec.set(-cT * cl, sT, -cT * sl);                        // 北向
      // 闭式平行输运：ψ(λ) = ψ₀ − λ·cosθ₀，ψ₀ = π/2（出发时 V 指向北）
      const psi = Math.PI / 2 - lam * cT;
      Vvec.set(0, 0, 0)
        .addScaledVector(Tvec, Math.cos(psi))
        .addScaledVector(Mvec, Math.sin(psi))
        .normalize();
      holonomyDeg = 360 * (1 - cT);                             // 绕行整圈后的偏转角（=面积）

      // 切空间贴片
      tmp.copy(pNow).setY(pNow.y - 1.2).normalize();            // 球面法向（相对球心）
      disc.position.copy(pNow).addScaledVector(tmp, 0.015);
      disc.quaternion.setFromUnitVectors(UP, tmp);

      setArrow(arrowV, pNow, Vvec, 0.95);
      setArrow(arrowT, pNow, Tvec, 0.55);
      setArrow(arrowM, pNow, Mvec, 0.55);
      const p0 = new THREE.Vector3(R * sT, 1.2 + R * cT, 0);
      const m0 = new THREE.Vector3(-cT, sT, 0);
      setArrow(arrowV0, p0, m0, 0.95);

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
