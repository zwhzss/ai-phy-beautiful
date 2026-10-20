import type { SceneContext, SceneInstance } from '../types';
/**
 * 薄膜应力与界面（P389）—— 主控方程（热失配 + 起皱后屈曲 + 界面能释放率，node 复核）：
 *   体系：a-Si 薄膜（E=140GPa, ν=0.25, α=3.5e-6/K, h=100nm）在 PDMS 基体
 *   （E=1.8MPa, ν=0.46, α=760e-6/K）上加热 —— 基体想胀得更多 ⇒ 膜受双轴压
 *   热应力   σ = E_f·Δα·ΔT/(1−ν_f)；ε = Δα·ΔT（Δα=7.565e-4/K）
 *   起皱临界 ε_c = ¼[3E̅_s/E̅_f]^(2/3) = 0.032%（E̅=E/(1−ν²)）⇒ ΔT*≈0.42K
 *   波长     λ = 2πh[E̅_f/(3E̅_s)]^(1/3) = 17.6µm —— a-Si/PDMS 实测形貌同量级 ✓
 *   后屈曲幅 A/h = √(ε/ε_c − 1)（Hutchinson 幅律，画面按此爬升）
 *   剥离     G = Z·h·E̅_f·ε²（Z=3.2(1−ν_f)=2.4）与黏附功 Γ=0.2J/m² 拉锯
 *            ⇒ ε_d=√(Γ/(Z h E̅))=0.236%（ΔT≈3.1K）；皱↔脱过渡标度 (Γ/E̅h)^(2/3)=0.056%
 *   复核：ΔT=6K 时 ε=0.454%、σ=E_f ε/(1−ν_f)=847MPa（双轴、σ_zz=0）、G=0.738J/m²>Γ ⇒ 鼓泡剥离 ✓
 *   扫描自变量：ΔT（16s 内 0→8K 往返）。膜面高度场 y=A·sin(2πx/λ)（示意压缩比）、
 *   剥离盘半径、色场 σ、背面 G(ε)–Γ 曲线光标点全部同源。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  // —— SI ——
  const EF = 140e9, NF = 0.25, ALF = 3.5e-6, ES = 1.8e6, NS = 0.46, ALS = 760e-6;
  const H = 100e-9, GAMMA = 0.2;
  const EB_F = EF / (1 - NF * NF), EB_S = ES / (1 - NS * NS);
  const DA = ALS - ALF;                                          // 7.565e-4 1/K
  const EC = 0.25 * Math.pow(3 * EB_S / EB_F, 2 / 3);            // 0.032%
  const LAM = 2 * Math.PI * H * Math.pow(EB_F / (3 * EB_S), 1 / 3); // 17.6 µm
  const Z0 = 3.2 * (1 - NF);
  const ED = Math.sqrt(GAMMA / (Z0 * H * EB_F));                 // 0.236%
  const Gof = (eps: number) => Z0 * H * EB_F * eps * eps;        // J/m²
  const Uv = (eps: number) => 0.5 * EB_F * eps * eps;            // 应变能密度 J/m³
  const LAM_DISP = 0.6;                                          // 画面波长（示意压缩）
  const HT_DISP = 0.10;                                          // 画面膜厚基准

  // —— 星野 + 网格 ——
  {
    const g = geo(new THREE.BufferGeometry());
    const p = new Float32Array(1500);
    for (let i = 0; i < 500; i++) { p[i * 3] = (Math.random() - 0.5) * 200; p[i * 3 + 1] = (Math.random() - 0.5) * 200; p[i * 3 + 2] = (Math.random() - 0.5) * 200; }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    group.add(new THREE.Points(g, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }))));
  }
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // —— 基体块 ——
  const sub = new THREE.Mesh(geo(new THREE.BoxGeometry(7.2, 1.5, 3.4)), mat(new THREE.MeshStandardMaterial({ color: 0xf472b6, transparent: true, opacity: 0.30, metalness: 0.1, roughness: 0.75, depthWrite: false })));
  sub.position.set(-0.4, 0.75, 0);
  group.add(sub);

  // —— 薄膜：顶面高度场网格（100×28），随 ΔT 起皱/鼓泡 ——
  const FX = 7.2, FZ = 3.4, NX = 120, NZ = 30, FY = 1.62;
  const LAMRulerX0 = 0.15, LAMRulerLen = 0.6;                     // 前沿标尺：波峰 local x=λ_disp/4 起一整周期
  const filmGeo = geo(new THREE.PlaneGeometry(FX, FZ, NX, NZ));
  const filmPos = filmGeo.attributes['position'] as import('three').BufferAttribute;
  const filmCol = new THREE.BufferAttribute(new Float32Array(filmPos.count * 3), 3);
  filmGeo.setAttribute('color', filmCol);
  const film = new THREE.Mesh(filmGeo, mat(new THREE.MeshStandardMaterial({ color: 0x9ae6ff, vertexColors: true, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide })));
  film.rotation.x = -Math.PI / 2;
  film.position.set(-0.4, FY, 0);
  group.add(film);

  // —— 剥离鼓泡盘（界面脱开区显示）——
  const bubGeo = geo(new THREE.CircleGeometry(1, 40));
  const bubMat = mat(new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  const bub = new THREE.Mesh(bubGeo, bubMat);
  bub.rotation.x = -Math.PI / 2;
  bub.position.set(0.6, FY - 0.06, -0.3);
  group.add(bub);

  // —— 画面波长 λ 标尺（膜前沿一整个正弦周期）——
  {
    const xA = -0.4 + LAMRulerX0, xB = xA + LAMRulerLen;
    const g4 = geo(new THREE.BufferGeometry());
    const yy = FY + 0.19;
    g4.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      xA, yy, 1.86, xB, yy, 1.86,
      xA, yy - 0.06, 1.86, xA, yy + 0.06, 1.86,
      xB, yy - 0.06, 1.86, xB, yy + 0.06, 1.86,
    ]), 3));
    const lm = mat(new THREE.LineDashedMaterial({ color: 0xfbbf24, dashSize: 0.07, gapSize: 0.05 }));
    const l4 = new THREE.LineSegments(g4, lm); l4.computeLineDistances(); group.add(l4);
    const c9 = document.createElement('canvas'); c9.width = 512; c9.height = 64;
    const x9 = c9.getContext('2d')!;
    x9.fillStyle = '#fde68a'; x9.font = 'bold 27px "PingFang SC", sans-serif'; x9.textAlign = 'center'; x9.textBaseline = 'middle';
    x9.fillText(`λ=2πh[E̅f/3E̅s]^⅓=${(LAM * 1e6).toFixed(1)}µm（实算；画面 λ/h=${(LAM_DISP / HT_DISP).toFixed(0)} 对真值 ${(LAM / H).toFixed(0)} 压缩示意）`, 256, 32);
    const sp9 = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(c9)), transparent: true })));
    sp9.scale.set(3.6, 0.45, 1); sp9.position.set((xA + xB) / 2, FY + 0.42, 1.9); group.add(sp9);
  }
  // —— ε_d 阈值交点标记（G 曲线穿 Γ 线之处）——
  const GSC = Gof(ED * 2.4) / GAMMA;                               // 纵轴满量程（ε 扫到 2.4ε_d ⇒ G/Γ=(2.4)²）
  const gyOf = (gv: number): number => 0.45 + (gv / GAMMA) * (1.75 / GSC);
  const edMark = new THREE.Mesh(geo(new THREE.SphereGeometry(0.07, 12, 10)), mat(new THREE.MeshBasicMaterial({ color: 0x22c55e })));
  edMark.position.set(2.1 + (1 / 2.4) * 2.3, gyOf(GAMMA), -2.3);
  group.add(edMark);

  // —— 左侧纵切剖面线：与顶面高度场共用 profY（同一 amp/delam 驱动）——
  const NS2 = 91;
  const secGeo = geo(new THREE.BufferGeometry());
  const secPos = new Float32Array(NS2 * 3);
  for (let i = 0; i < NS2; i++) { secPos[i * 3] = -4.55 + (i / (NS2 - 1)) * 2.3; secPos[i * 3 + 1] = 0.6; secPos[i * 3 + 2] = 2.35; }
  secGeo.setAttribute('position', new THREE.BufferAttribute(secPos, 3));
  group.add(new THREE.Line(secGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee }))));
  {
    const g5 = geo(new THREE.BufferGeometry());
    g5.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-4.55, 0.6, 2.35, -2.25, 0.6, 2.35]), 3));
    const lm2 = mat(new THREE.LineDashedMaterial({ color: 0x475569, dashSize: 0.12, gapSize: 0.08 }));
    const l5 = new THREE.Line(g5, lm2); l5.computeLineDistances(); group.add(l5);   // 平坦膜基准线
    const c8 = document.createElement('canvas'); c8.width = 512; c8.height = 64;
    const x8 = c8.getContext('2d')!;
    x8.fillStyle = '#67e8f9'; x8.font = 'bold 27px "PingFang SC", sans-serif'; x8.textAlign = 'center'; x8.textBaseline = 'middle';
    x8.fillText('纵切剖面 y(x)=A·sin(2πx/λ)(1−bl)+鼓泡', 256, 32);
    const sp8 = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(c8)), transparent: true })));
    sp8.scale.set(3.4, 0.42, 1); sp8.position.set(-3.4, 2.02, 2.35); group.add(sp8);
  }

  // —— 背面 G(ε) vs Γ 竞争图 ——
  const NG = 70;
  const gGeo = geo(new THREE.BufferGeometry());
  {
    const p = new Float32Array(NG * 3);
    for (let i = 0; i < NG; i++) {
      const eps = (ED * 2.4) * i / (NG - 1);
      p[i * 3] = 2.1 + (eps / (ED * 2.4)) * 2.3;
      p[i * 3 + 1] = gyOf(Gof(eps));
      p[i * 3 + 2] = -2.3;
    }
    gGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  }
  group.add(new THREE.Line(gGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee }))));
  const refGeo = geo(new THREE.BufferGeometry());
  refGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([2.1, gyOf(GAMMA), -2.3, 4.4, gyOf(GAMMA), -2.3, 2.1 + (EC / (ED * 2.4)) * 2.3, 0.45, -2.3, 2.1 + (EC / (ED * 2.4)) * 2.3, 2.2, -2.3, 4.4, 0.45, -2.3, 2.1, 0.45, -2.3]), 3));
  group.add(new THREE.LineSegments(refGeo, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));
  const gDot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.08, 12, 10)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  gDot.position.z = -2.3; group.add(gDot);

  // —— 温度箭头（加热源）——
  const heatMat = mat(new THREE.MeshBasicMaterial({ color: 0xf97316 }));
  const hShaft = geo(new THREE.CylinderGeometry(0.035, 0.035, 1, 6));
  const hHead = geo(new THREE.ConeGeometry(0.09, 0.2, 8));
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(hShaft, heatMat); s.position.set(-2.6 + i * 1.5, -0.5 + 0.0, 0); s.scale.y = 0.8; group.add(s);
    const hd = new THREE.Mesh(hHead, heatMat); hd.position.set(-2.6 + i * 1.5, 0.05, 0); group.add(hd);
  }

  // —— 标签 ——
  function makeLabel(text: string, color: string, x: number, y: number, z: number, wu = 3.0): void {
    const c2 = document.createElement('canvas'); c2.width = 512; c2.height = 64;
    const c3 = c2.getContext('2d')!;
    c3.fillStyle = color; c3.font = 'bold 27px "PingFang SC", sans-serif'; c3.textAlign = 'center'; c3.textBaseline = 'middle';
    c3.fillText(text, 256, 32);
    const sp = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(c2)), transparent: true })));
    sp.scale.set(wu, wu / 8, 1); sp.position.set(x, y, z); group.add(sp);
  }
  makeLabel('PDMS 基体（ν 大、α 大）／ a-Si 膜 100nm（示意比例：λ/h 压缩显示）', '#f9a8d4', -0.4, 2.35, 1.9, 5.4);
  makeLabel('青=G(ε)=Z h E̅ε²，金线=Γ，交点=剥离阈值 ε_d', '#67e8f9', 3.25, 2.45, -2.3, 4.4);

  // —— 面板 ——
  const cv = document.createElement('canvas'); cv.width = 780; cv.height = 250;
  const cc = cv.getContext('2d')!;
  const ct = tex(new THREE.CanvasTexture(cv));
  const panel = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: ct, transparent: true, depthTest: false })));
  panel.scale.set(7.6, 7.6 * 250 / 780, 1); panel.position.set(0, 3.75, 0.4); panel.renderOrder = 998;
  group.add(panel);
  const S = { dT: 0, eps: 0, sig: 0, a: 0, g: 0, delam: 0, u: 0 };
  function draw(): void {
    cc.clearRect(0, 0, 780, 250);
    cc.fillStyle = 'rgba(7,11,20,0.84)'; cc.fillRect(3, 3, 774, 244);
    cc.strokeStyle = '#334155'; cc.lineWidth = 3; cc.strokeRect(3, 3, 774, 244);
    cc.textAlign = 'left';
    cc.fillStyle = '#f8fafc'; cc.font = 'bold 25px "PingFang SC", sans-serif';
    cc.fillText('薄膜应力：起皱还是剥离，看能量谁赢', 18, 34);
    cc.fillStyle = '#22d3ee'; cc.font = '22px "PingFang SC", sans-serif';
    cc.fillText('σ=E_f Δα ΔT/(1−ν_f)；ε_c=¼[3E̅s/E̅f]^⅔=0.032%；λ=2πh[E̅f/3E̅s]^⅓', 18, 64);
    cc.fillText(`λ=${(LAM * 1e6).toFixed(1)}µm（100nm 膜/软基体实测 ✓；画面 λ/h 压缩至 1/${(((LAM / H) / (LAM_DISP / HT_DISP)).toFixed(0))}）`, 18, 90);
    cc.fillStyle = '#a855f7';
    cc.fillText('G=Z h E̅ ε² vs Γ：先到 ε_c 起皱，过 ε_d 则鼓泡剥离', 18, 118);
    cc.fillStyle = '#22c55e';
    cc.fillText(`皱↔脱过渡标度 ε ∝ (Γ/E̅h)^⅔=${(Math.pow(GAMMA / (EB_F * H), 2 / 3) * 100).toFixed(3)}%`, 18, 144);
    cc.fillStyle = '#fbbf24'; cc.font = 'bold 21px "PingFang SC", sans-serif';
    cc.fillText(`读数：ΔT=${S.dT.toFixed(2)}K  ε=${(S.eps * 100).toFixed(3)}%  σ=${(S.sig / 1e6).toFixed(0)}MPa（压）`, 18, 176);
    cc.fillText(`A/h=${S.a.toFixed(2)}（√(ε/ε_c−1)）  G=${S.g.toFixed(3)}J/m² ${S.g > GAMMA ? '>Γ 剥离' : '<Γ 完好'}  弹性能 u=${(S.u / 1e6).toFixed(2)}MJ/m³`, 18, 202);
    cc.fillText(S.eps < EC ? '状态：弹性平坦膜（ε<ε_c）' : S.delam > 0.05 ? '状态：鼓泡剥离（界面脱开扩展中）' : '状态：周期褶皱（正弦垄）', 18, 228);
    ct.needsUpdate = true;
  }

  const profY = (x: number, z: number, amp: number, delam: number): number => {
    const wr = Math.sin((2 * Math.PI * x) / LAM_DISP);
    const bx = x - 1.0, bz = z - 0.3;
    const rr = Math.sqrt(bx * bx + bz * bz);
    const rb = 0.25 + 1.55 * delam;
    const bl = delam > 0 ? Math.max(0, 1 - (rr / rb) * (rr / rb)) : 0;
    return amp * wr * (1 - bl) + bl * (0.28 + 0.5 * delam);      // 鼓泡区内褶皱被抹平
  };
  function setDT(dT: number): void {
    const eps = DA * dT;
    // 双轴等距拉伸、σ_zz=0（膜自由面）⇒ ε = σ(1−ν_f)/E_f ⇒ σ = E_f·ε/(1−ν_f)（与面板公式行同源）
    const sig = (EF / (1 - NF)) * eps;
    const g = Gof(eps);
    const astr = eps > EC ? Math.sqrt(eps / EC - 1) : 0;
    const amp = Math.min(0.34, HT_DISP * Math.min(3.4, astr));        // A/h 幅律直绘：ε<ε_c 时 amp=0（平坦）
    const delam = eps > ED ? Math.min(1, Math.sqrt((eps - ED) / (ED * 1.8))) : 0;
    S.dT = dT; S.eps = eps; S.sig = sig; S.a = astr; S.g = g; S.delam = delam; S.u = Uv(eps);
    for (let v = 0; v < filmPos.count; v++) {
      const x = filmPos.getX(v), z = filmPos.getY(v);            // plane local (x, z→y-local)
      const wr = Math.sin((2 * Math.PI * x) / LAM_DISP);
      const y = profY(x, z, amp, delam);
      filmPos.setXYZ(v, x, z, y);                                // local z = world y (after rot −90°)
      const eLoc = Math.abs(wr) * amp / Math.max(1e-6, HT_DISP);
      const bump = y - amp * wr;
      const tint = Math.max(0, Math.min(1, (eps / (ED * 1.6)) * 0.55 + 0.3 * eLoc * (eps > EC ? 1 : 0) + (bump > 0.05 ? 0.35 : 0)));
      filmCol.setXYZ(v, 0.15 + 0.8 * tint, 0.55 * (1 - tint * 0.8), 0.95 * (1 - tint) + 0.15 * tint);
    }
    filmPos.needsUpdate = true;
    filmCol.needsUpdate = true;
    filmGeo.computeVertexNormals();
    for (let i = 0; i < NS2; i++) {                              // 剖面线与顶面同源：沿 z=0 切
      const lx = -FX / 2 + (i / (NS2 - 1)) * FX;
      secPos[i * 3 + 1] = 0.6 + profY(lx, 0, amp, delam) * 2.2;
    }
    secGeo.attributes['position'].needsUpdate = true;
    bub.scale.setScalar(delam > 0 ? 0.25 + 1.55 * delam : 0.0001);
    bubMat.opacity = 0.25 + 0.4 * delam;
    gDot.position.set(2.1 + Math.min(2.3, (eps / (ED * 2.4)) * 2.3), gyOf(g), -2.3);
  }
  setDT(0);

  return {
    update(t, dt) {
      const PER = 16;
      const ph = (t % PER) / PER;
      const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
      const dT = 8.5 * tri;
      setDT(dT);
      heatMat.color.setRGB(0.97, 0.45 - 0.25 * tri, 0.09);
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) draw();
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
