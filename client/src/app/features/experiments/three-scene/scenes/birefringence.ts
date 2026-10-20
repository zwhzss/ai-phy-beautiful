import type { SceneContext, SceneInstance } from '../types';
/** 双折射（P80）：主控方程 单轴晶折射率椭球 1/n_e²(θ) = cos²θ/n_o² + sin²θ/n_e²（θ 为波法线与光轴夹角），
 *  o 光走 Snell（n_o 常数），e 光波法线满足 sinθ₁ = n_e(θ_w)·sinθ₂ 并对椭球面法线求能流方向
 *  ŝ ∝ D̂ − n²(D̂·k̂)k̂ ⇒ 离散角 α。方解石 n_o=1.658、n_e=1.486（负单轴）。画面：一束入射光在晶体内劈成两条，
 *  出射后平行分开，分距 δ 由两条折射角之差算出；右侧折射率椭球随当前波法线切出长短轴。 */
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

  const NO = 1.658, NE = 1.486;      // 方解石主折射率（真实值）
  const TH = 1.6;                     // 晶体厚度（世界单位，= 8 mm）
  const TOP = TH / 2, BOT = -TH / 2;
  // 入射面 = x–y 平面；上表面法线 = ŷ
  const caxis = new THREE.Vector3(Math.sin(0.62), 0, Math.cos(0.62)).normalize(); // 光轴（晶体学 c 轴）

  // —— 晶体（半透明菱面体近似：斜切的盒） ——
  const crysGeo = geo(new THREE.BoxGeometry(2.9, TH, 2.4));
  const crys = new THREE.Mesh(crysGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.1 })));
  group.add(crys);
  const cw = new THREE.Mesh(crysGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.34 })));
  group.add(cw);
  // 光轴线（贯穿晶体并伸出）
  const cGeo = geo(new THREE.BufferGeometry());
  cGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -3.2 * caxis.x, -3.2 * caxis.y, -3.2 * caxis.z, 3.2 * caxis.x, 3.2 * caxis.y, 3.2 * caxis.z,
  ]), 3));
  group.add(new THREE.Line(cGeo, mat(new THREE.LineBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.8 }))));

  function ray(color: number, width = 2): { g: import('three').BufferGeometry; m: import('three').LineBasicMaterial } {
    void width;
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4 * 3), 3));
    const m = mat(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }));
    group.add(new THREE.Line(g, m));
    return { g, m };
  }
  const rIn = ray(0xf8fafc), rO = ray(0x22d3ee), rE = ray(0xf472b6);
  function setPolyline(pl: { g: import('three').BufferGeometry }, pts: import('three').Vector3[]): void {
    const arr = pl.g.attributes['position'].array as Float32Array;
    pts.forEach((p, i) => { arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z; });
    pl.g.attributes['position'].needsUpdate = true;
    pl.g.setDrawRange(0, Math.min(4, pts.length));
  }

  // —— 折射率椭球（右侧）：o 球（圆）+ e 椭球截面（三根主截面线） ——
  const ELL = new THREE.Vector3(3.6, 1.0, 0);
  const SC = 0.72;                    // n → 世界长度
  const circGeo = geo(new THREE.BufferGeometry());
  const circArr = new Float32Array(65 * 3);
  for (let j = 0; j <= 64; j++) {
    const a = (j / 64) * Math.PI * 2;
    circArr[j * 3] = ELL.x + NO * SC * Math.cos(a);
    circArr[j * 3 + 1] = ELL.y + NO * SC * Math.sin(a);
    circArr[j * 3 + 2] = ELL.z;
  }
  circGeo.setAttribute('position', new THREE.BufferAttribute(circArr, 3));
  group.add(new THREE.Line(circGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.7 }))));
  const ellGeo = geo(new THREE.BufferGeometry());
  const ellArr = new Float32Array(65 * 3);
  ellGeo.setAttribute('position', new THREE.BufferAttribute(ellArr, 3));
  group.add(new THREE.Line(ellGeo, mat(new THREE.LineBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.7 }))));
  // 椭球绕光轴转 −? ：截面椭圆主轴在含光轴平面内；这里画"k̂⊥ 平面截椭球"的主轴简化：长短轴 = n_o 与 n_e(θ_w)
  const kLine = ray(0xfbbf24), dLine = ray(0x22c55e), sLine = ray(0xef4444);

  // —— 物理/几何求解 ——
  const nOfWaveNormal = (tw: number): number => {
    const s = Math.sin(tw), cs = Math.cos(tw);
    return (NO * NE) / Math.sqrt(NO * NO * s * s + NE * NE * cs * cs);
  };
  // 波法线 Snell：sinθ₁ = n_e(θ_w(θ₂))·sinθ₂，θ_w = ∠(k̂₂, 光轴)
  function solveEAngle(th1: number): number {
    let lo = 0, hi = Math.min(th1, 1.0);
    const f = (t2: number): number => {
      const k2 = new THREE.Vector3(Math.sin(t2), -Math.cos(t2), 0);
      const tw = Math.acos(Math.max(-1, Math.min(1, k2.dot(caxis))));
      return Math.sin(th1) - nOfWaveNormal(tw) * Math.sin(t2);
    };
    // 求根：t2 ∈ (0, θ₁)：f(0)=sinθ₁>0；增大 t2 → n·sin 上升 → f 变负
    if (f(hi) > 0) { lo = hi; hi = Math.min(Math.PI / 2 - 0.01, th1 + 0.6); }
    for (let it = 0; it < 40; it++) {
      const mid = 0.5 * (lo + hi);
      if (f(mid) > 0) lo = mid; else hi = mid;
    }
    return 0.5 * (lo + hi);
  }
  function eRayDir(khat: import('three').Vector3): { s: import('three').Vector3; D: import('three').Vector3; nD: number; alpha: number } {
    const m = new THREE.Vector3().crossVectors(khat, caxis);
    if (m.lengthSq() < 1e-8) return { s: khat.clone(), D: new THREE.Vector3(1, 0, 0), nD: NE, alpha: 0 };
    // e 光 D̂：位于 k̂–光轴平面且 ⟂k̂
    const D = new THREE.Vector3().crossVectors(m, khat).normalize();
    // 折射率椭球沿 D̂ 的半径 = e 光位相折射指数：nD = 1/√(ΣD̂ᵢ²/nᵢ²)
    const nD = 1 / Math.sqrt((D.x * D.x + D.y * D.y) / (NO * NO) + (D.z * D.z) / (NE * NE));
    // E ∝ (Dx/no², Dy/no², Dz/ne²)；ŝ ∥ E×H ∥ k̂|E|²−E(E·k̂)（椭球面法线方向 = 能流）
    const Ev = new THREE.Vector3(D.x / (NO * NO), D.y / (NO * NO), D.z / (NE * NE));
    const s = new THREE.Vector3().addScaledVector(khat, Ev.lengthSq()).addScaledVector(Ev, -Ev.dot(khat)).normalize();
    return { s, D, nD, alpha: Math.acos(Math.max(-1, Math.min(1, s.dot(khat)))) };
  }

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
  group.add(Object.assign(makeLabel('o 光（n_o=1.658）', '#22d3ee'), { position: new THREE.Vector3(-1.4, -2.1, 0) }));
  group.add(Object.assign(makeLabel('e 光（n_e(θ) 各向异性）', '#f472b6', 3.6), { position: new THREE.Vector3(1.5, -2.1, 0) }));
  group.add(Object.assign(makeLabel('光轴 c（负单轴）', '#a855f7'), { position: new THREE.Vector3(-3.0, 2.6, 1.4) }));
  group.add(Object.assign(makeLabel('折射率椭球', '#94a3b8'), { position: new THREE.Vector3(ELL.x, ELL.y + 2.0, 0) }));

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

  let th1 = 0, thO = 0, thE = 0, alphaDeg = 0, sepMM = 0, nEff = NE;

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 800, 236);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 792, 228);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 792, 228);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 29px "PingFang SC", sans-serif';
    infoCtx.fillText('双折射：方解石劈开一束光（负单轴 n_o=1.658, n_e=1.486）', 22, 42);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '26px "PingFang SC", sans-serif';
    infoCtx.fillText('1/n_e²(θ) = cos²θ/n_o² + sin²θ/n_e²；ŝ ∥ E×H，E ∝ (D_x/n_o², D_y/n_o², D_z/n_e²)', 22, 82);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('两出射光束方向仍平行于入射光，但横向已分开 —— 液晶像素靠双折射调制偏振态', 22, 122);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 25px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：θ₁=${(th1 * 57.2958).toFixed(1)}°  θ_o=${(thO * 57.2958).toFixed(1)}°  θ_e(k̂)=${(thE * 57.2958).toFixed(1)}°  α=${alphaDeg.toFixed(1)}°  n_e(θ)=${nEff.toFixed(3)}  分离 δ=${sepMM.toFixed(2)} mm（板厚 8 mm）`,
      22, 168,
    );
    infoTex.needsUpdate = true;
  }

  function solveAll(): void {
    // 入射：与上表面法线 ŷ 成 θ₁，入射点 P=(0.35, TOP, 0)
    const P = new THREE.Vector3(0.35, TOP, 0);
    const dIn = new THREE.Vector3(Math.sin(th1), -Math.cos(th1), 0);
    const S = P.clone().addScaledVector(dIn, -2.6);
    // o 光
    thO = Math.asin(Math.min(1, Math.sin(th1) / NO));
    const dO = new THREE.Vector3(Math.sin(thO), -Math.cos(thO), 0);
    const tO = (TOP - BOT) / Math.cos(thO);
    const QO = P.clone().addScaledVector(dO, tO);
    // e 光：波法线 k̂ 由各向异性 Snell 求根；能流 ŝ 由椭球法线（离散角 α）
    thE = solveEAngle(th1);
    const kE = new THREE.Vector3(Math.sin(thE), -Math.cos(thE), 0);
    const e = eRayDir(kE);
    nEff = e.nD;
    alphaDeg = e.alpha * 57.2958;
    const tE = TH / Math.max(1e-3, Math.abs(e.s.y)); // 能流穿过板厚
    const QE = P.clone().addScaledVector(e.s, tE);
    // 出射（平行板 ⇒ 出射方向回到 dIn）
    const eLen = 2.4;
    setPolyline(rIn, [S, P, P, P]);
    setPolyline(rO, [P, QO, QO.clone().addScaledVector(dIn, eLen), QO.clone().addScaledVector(dIn, eLen)]);
    setPolyline(rE, [P, QE, QE.clone().addScaledVector(dIn, eLen), QE.clone().addScaledVector(dIn, eLen)]);
    sepMM = QO.distanceTo(QE) * (8 / TH); // 1 世界单位 = 1 mm（板厚 8 mm）
    // 椭球截面：椭圆半长轴 = n_o（⊥k̂–c 面内）与 n_e(θ_w)（面内）
    const tw = Math.acos(Math.max(-1, Math.min(1, kE.dot(caxis))));
    const nEw = nOfWaveNormal(tw);
    const inPlane = new THREE.Vector3(-kE.y, kE.x, 0); // 截面椭圆长轴方向（画面近似）
    for (let j = 0; j <= 64; j++) {
      const a = (j / 64) * Math.PI * 2;
      const vx = NO * SC * Math.cos(a) * inPlane.x - nEw * SC * Math.sin(a) * kE.x;
      const vy = NO * SC * Math.cos(a) * inPlane.y - nEw * SC * Math.sin(a) * kE.y;
      ellArr[j * 3] = ELL.x + vx; ellArr[j * 3 + 1] = ELL.y + vy; ellArr[j * 3 + 2] = ELL.z;
    }
    ellGeo.attributes['position'].needsUpdate = true;
    // 椭球小图上：k̂ 线（黄）、D̂（绿，长度=椭球半径 nD）、ŝ（红）
    setPolyline(kLine, [ELL, ELL.clone().addScaledVector(kE, 1.9), ELL, ELL]);
    setPolyline(dLine, [ELL, ELL.clone().addScaledVector(e.D, e.nD * SC), ELL, ELL]);
    setPolyline(sLine, [ELL, ELL.clone().addScaledVector(e.s, e.nD * SC), ELL, ELL]);
  }

  solveAll();
  drawInfo();

  return {
    update(t, dt) {
      // 扫描入射角 θ₁：0→46°→0，周期 16s
      const ph = (t % 16) / 16;
      th1 = (46 * Math.PI / 180) * (0.5 - 0.5 * Math.cos(2 * Math.PI * ph));
      solveAll();
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
