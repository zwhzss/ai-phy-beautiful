import type { SceneContext, SceneInstance } from '../types';
/**
 * 成分过冷与凝固（P367）—— 主控方程（稀溶质稳态 BPS + Gibbs–Thomson，SI 直算）：
 *   溶质边界层  C_L(x) = C₀[1 + ((1−k)/k)·e^{−Vx/D}]      （C_L(0)=C₀/k，C_L(∞)=C₀）
 *   液相线      T_L(x) = T_m + m·C_L(x)， 实际温度 T(x) = T_i + G·x，T_i = T_m + m·C₀/k
 *   成分过冷    ΔT(x) = T_L(x) − T(x) > 0 的区间即过冷区
 *   失稳判据    G/V ≥ (G/V)_cr = −m·C₀(1−k)/(k·D)     ⇔ ΔT'(0) ≥ 0 ⇔ 界面前无过冷
 *   胞/枝晶间距 λ_c = 2π√(Γ/(|m|·G_C))，G_C = V·C₀(1−k)/(k·D)（毛细＋溶质梯度竞争）
 *   二次臂      λ₂ = Λ₀·G^{−1/2}（经验律，Λ₀ 由 Al–Cu 标定）
 *   顶端形状    Ivantsov 抛物面 r²(z)=2ρz+z²，ρ = Γ/ΔT_max（Gibbs–Thomson 一致）
 * 画面：凝固界面（六角胞状起伏，波长=λ_c）→ 主臂抛物面 + 沿 ⟨100⟩ 晶轴的二次臂
 * （间距=λ₂，随固相反流被带回并粗化）；前方三层溶质等值面按 BPS 反演定位；
 * 上方图表画 T_L(x) 与 T(x) 两条真曲线，其缺口即成分过冷区。
 * 扫描自变量：生长速度 V=10→3000 µm/s（对数往复，周期 16 s）与温度梯度 G=3e3→1e6 K/m
 * （对数往复，周期 24 s）→ G/V 反复跨过临界值，平面/胞状/枝晶三种形态自动切换。
 * 长度尺度：纵向按扩散长度 D/V 归一（1.5 world ↔ D/V），故 λ_c、λ₂、ρ、过冷区深度
 * 全部按同一 LM 换算，真实微米值在面板读出；固相反流速度为显示量。
 */
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

  const PI = Math.PI, TWO_PI = PI * 2;
  // —— Al–Cu 稀溶质合金参数（真实量级）——
  const M_LIQ = -2.6;                 // 液相线斜率 K/wt%
  const C0 = 0.5;                     // 名义成分 wt%
  const K0 = 0.14;                    // 平衡分配系数
  const DL = 3.0e-9;                  // 液相扩散系数 m²/s
  const GAM = 2.6e-7;                 // Gibbs–Thomson 系数 K·m
  const T_MELT = 933.2;               // 纯铝熔点 K
  const LAM2 = 1.27e-2;               // λ₂ = LAM2·G^{-1/2}（标定于 G=1e5→40µm）
  const V_MIN = 1.0e-5, V_MAX = 3.0e-3;
  const G_MIN = 3.0e3, G_MAX = 1.0e6;
  const CY_V = 16, CY_G = 24;
  const CRIT = -M_LIQ * C0 * (1 - K0) / (K0 * DL);     // (G/V)_cr = 2.66e9 K·s/m²
  const CIQ = C0 / K0, TIQ = T_MELT + M_LIQ * CIQ;     // 界面液相成分与温度

  // 星野 + 地面
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

  // 生长方向轴（+x = 液相侧）
  {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-3.6, 0, 0, 4.4, 0, 0]), 3));
    group.add(new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.9 }))));
  }

  // 固相块 + 反流切片
  const solidMat = mat(new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.65, roughness: 0.45, transparent: true, opacity: 0.34 }));
  const solidMesh = new THREE.Mesh(geo(new THREE.BoxGeometry(3.6, 3.4, 3.4)), solidMat);
  solidMesh.position.set(-1.8, 0, 0);
  group.add(solidMesh);
  const sliceGeo = geo(new THREE.PlaneGeometry(3.3, 3.3));
  const sliceMat = mat(new THREE.MeshBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
  const slices: import('three').Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(sliceGeo, sliceMat);
    s.rotation.y = PI / 2;
    group.add(s); slices.push(s);
  }

  // —— 凝固界面（胞状起伏）——
  const FG = 33, FW = 4.4;
  const fGeo = geo(new THREE.BufferGeometry());
  const fPos = new Float32Array(FG * FG * 3);
  const fIdx: number[] = [];
  for (let i = 0; i < FG - 1; i++) {
    for (let j = 0; j < FG - 1; j++) {
      const a = i * FG + j, b = a + 1, c = a + FG, d = c + 1;
      fIdx.push(a, c, b, b, c, d);
    }
  }
  fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  fGeo.setIndex(fIdx);
  const fMat = mat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0e7490, emissiveIntensity: 0.5, transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 0.4 }));
  const fMesh = new THREE.Mesh(fGeo, fMat);
  group.add(fMesh);

  // —— 三层溶质等值面（BPS 反演）——
  const ISO = [1.5, 2.0, 3.0];
  const IG = 17;
  const isoIdx: number[] = [];
  for (let i = 0; i < IG - 1; i++) {
    for (let j = 0; j < IG - 1; j++) {
      const a = i * IG + j, b = a + 1, c = a + IG, d = c + 1;
      isoIdx.push(a, c, b, b, c, d);
    }
  }
  const isoGeo: import('three').BufferGeometry[] = [];
  const isoPos: Float32Array[] = [];
  const isoMesh: import('three').Mesh[] = [];
  const isoMat: import('three').MeshBasicMaterial[] = [];
  for (let s = 0; s < 3; s++) {
    const g = geo(new THREE.BufferGeometry());
    const p = new Float32Array(IG * IG * 3);
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setIndex(isoIdx);
    const m = mat(new THREE.MeshBasicMaterial({ color: [0xa855f7, 0x8b5cf6, 0x6d28d9][s], transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }));
    const mesh = new THREE.Mesh(g, m);
    group.add(mesh);
    isoGeo.push(g); isoPos.push(p); isoMesh.push(mesh); isoMat.push(m);
  }

  // —— 枝晶：Ivantsov 抛物面主臂 + 二次臂 ——
  const TZ = 26, TP = 25;
  const dGeo = geo(new THREE.BufferGeometry());
  const dPos = new Float32Array(TZ * TP * 3);
  const dIdx: number[] = [];
  for (let i = 0; i < TZ - 1; i++) {
    for (let j = 0; j < TP - 1; j++) {
      const a = i * TP + j, b = a + 1, c = a + TP, d = c + 1;
      dIdx.push(a, c, b, b, c, d);
    }
  }
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  dGeo.setIndex(dIdx);
  const dMesh = new THREE.Mesh(dGeo, mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0x92400e, emissiveIntensity: 0.45, roughness: 0.35, metalness: 0.4 })));
  group.add(dMesh);
  const armGeo = geo(new THREE.CylinderGeometry(1, 0.35, 1, 7));
  const armMat = mat(new THREE.MeshStandardMaterial({ color: 0xfde68a, emissive: 0x7c2d12, emissiveIntensity: 0.3, roughness: 0.4 }));
  const NARM = 6, NDIR = 4;
  const arms: import('three').Mesh[] = [];
  for (let i = 0; i < NARM * NDIR; i++) {
    const a = new THREE.Mesh(armGeo, armMat);
    group.add(a); arms.push(a);
  }

  // —— 图表：T_L(x) 与 T(x) 及过冷区 ——
  const CT = 81, CZW = -2.75, CY0 = 0.35, K_T = 0.15;      // world / K
  const tlGeo = geo(new THREE.BufferGeometry());
  const tlPos = new Float32Array(CT * 3);
  tlGeo.setAttribute('position', new THREE.BufferAttribute(tlPos, 3));
  group.add(new THREE.Line(tlGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee }))));
  const ttGeo = geo(new THREE.BufferGeometry());
  const ttPos = new Float32Array(CT * 3);
  ttGeo.setAttribute('position', new THREE.BufferAttribute(ttPos, 3));
  group.add(new THREE.Line(ttGeo, mat(new THREE.LineBasicMaterial({ color: 0xef4444 }))));
  const ucGeo = geo(new THREE.BufferGeometry());
  const ucPos = new Float32Array((CT - 1) * 12);
  ucGeo.setAttribute('position', new THREE.BufferAttribute(ucPos, 3));
  ucGeo.setIndex(Array.from({ length: CT - 1 }, (_, i) => [4 * i, 4 * i + 1, 4 * i + 2, 4 * i + 2, 4 * i + 1, 4 * i + 3]).flat());
  const ucMat = mat(new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  group.add(new THREE.Mesh(ucGeo, ucMat));
  const cX = new Float32Array(CT), cY = new Float32Array(CT), cH = new Float32Array(CT);
  {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      0, CY0, CZW, 4.35, CY0, CZW,
      0, CY0, CZW, 0, CY0 + 1.7, CZW,
    ]), 3));
    group.add(new THREE.LineSegments(g, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));
  }

  // —— 标签 ——
  function makeLabel(text: string, color: string, scale = 3.0): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  const lbSolid = makeLabel('固相（以 V 反流）⟨100⟩ 生长方向', '#94a3b8', 3.6); lbSolid.position.set(-2.4, 2.0, 0);
  const lbInt = makeLabel('凝固界面：胞间距 λ_c=2π√(Γ/|m·G_C|)', '#67e8f9', 4.2); lbInt.position.set(-0.4, -1.95, 0.6);
  const lbIso = makeLabel('溶质等值面 C_L=1.5/2/3 C₀（BPS 反演）', '#c084fc', 4.4); lbIso.position.set(2.2, -1.9, 1.4);
  const lbArm = makeLabel('二次臂 λ₂=Λ₀G^(−1/2)，沿⟨100⟩晶轴', '#fcd34d', 4.2); lbArm.position.set(1.0, 1.9, 1.6);
  const lbChart = makeLabel('上：T_L(C_L(x)) 下：T=T_i+Gx —— 缺口=成分过冷区', '#60a5fa', 4.6); lbChart.position.set(2.2, CY0 + 1.95, CZW);
  const lbCrit = makeLabel('平面 ↔ 胞 ↔ 枝晶 由 G/V 是否跨过临界值决定', '#f472b6', 4.4); lbCrit.position.set(0.4, -2.3, -1.2);
  group.add(lbSolid, lbInt, lbIso, lbArm, lbChart, lbCrit);

  // —— 信息面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 800; infoCv.height = 264;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(7.4, 2.44)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 3.42, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  const rd = { V: 1e-4, G: 1e5, ratio: 0.04, dTm: 0, xm: 0, zone: 0, lamC: 0, lam2: 0, rho: 0, LD: 0, amp: 0, st: '' };
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 800, 264);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 792, 256);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3;
    infoCtx.strokeRect(4, 4, 792, 256);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 25px "PingFang SC", sans-serif';
    infoCtx.fillText('成分过冷：溶质富集让平界面长出枝晶', 20, 32);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('C_L=C₀[1+((1−k)/k)e^(−Vx/D)]，T_L=T_m+m·C_L，T=T_i+G·x', 20, 60);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('失稳判据 G/V ≥ (G/V)_cr=−mC₀(1−k)/(kD)=2.66e9 K·s/m²', 20, 86);
    infoCtx.fillStyle = '#34d399';
    infoCtx.fillText(`λ_c=2π√(Γ/|m·G_C|)∝V^(−1/2) 只由速度定；λ₂=Λ₀G^(−1/2) 只由梯度定`, 20, 112);
    infoCtx.fillStyle = '#f472b6';
    infoCtx.fillText(`当前形貌：${rd.st}　（判据与曲线两条路径一致：ratio<1 ⇔ ΔT_max>0）`, 20, 138);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 21px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：V=${(rd.V * 1e6).toFixed(0)}µm/s  G=${rd.G.toExponential(1)}K/m  G/V=(${(rd.G / rd.V).toExponential(2)})=${rd.ratio.toFixed(3)}×临界`, 20, 166,
    );
    infoCtx.fillText(
      `ΔT_max=${rd.dTm.toFixed(2)}K @x=${(rd.xm * 1e6).toFixed(1)}µm  过冷区深 ${(rd.zone * 1e6).toFixed(0)}µm  D/V=${(rd.LD * 1e6).toFixed(1)}µm`, 20, 192,
    );
    infoCtx.fillText(
      `λ_c=${(rd.lamC * 1e6).toFixed(2)}µm  λ₂=${(rd.lam2 * 1e6).toFixed(0)}µm  ρ=Γ/ΔT=${(rd.rho * 1e6).toFixed(3)}µm  胞幅≈${(rd.amp * 1e6).toFixed(1)}µm`, 20, 218,
    );
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '20px "PingFang SC", sans-serif';
    infoCtx.fillText('材料：Al–0.5wt%Cu，m=−2.6K/wt%，k=0.14，D=3e-9m²/s，Γ=2.6e-7K·m，T_m=933.2K', 20, 246);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  // —— 场函数（真式）——
  const cAt = (x: number, V: number) => C0 * (1 + ((1 - K0) / K0) * Math.exp(-(V * x) / DL));
  const tLAt = (x: number, V: number) => T_MELT + M_LIQ * cAt(x, V);
  // 六角胞模态之和（Mullins–Sekerka 最不稳定波矢的三个等价方向）
  function hexMod(y: number, z: number, kk: number): number {
    return (Math.cos(kk * y) + Math.cos(kk * (y * 0.5 + 0.8660254 * z)) + Math.cos(kk * (y * 0.5 - 0.8660254 * z))) / 3;
  }

  return {
    update(t, dt) {
      const pv = (t % CY_V) / CY_V, pg = (t % CY_G) / CY_G;
      const tv = 0.5 - 0.5 * Math.cos(TWO_PI * pv);
      const tg = 0.5 - 0.5 * Math.cos(TWO_PI * pg + 1.1);
      const V = V_MIN * Math.pow(V_MAX / V_MIN, tv);
      const G = G_MIN * Math.pow(G_MAX / G_MIN, tg);
      const LD = DL / V;                     // 扩散长度
      const LM = 1.5 / LD;                   // world / m
      const ratio = (G / V) / CRIT;

      // ΔT(x) 扫描：最大值位置、过冷区深度
      const dT = (x: number) => tLAt(x, V) - (TIQ + G * x);
      let dTm = 0, xm = 0, zone = 0;
      for (let i = 0; i <= 400; i++) {
        const x = 6 * LD * i / 400;
        const d = dT(x);
        if (d > dTm) { dTm = d; xm = x; }
        if (d > 0) zone = x;
      }
      const GC = V * C0 * (1 - K0) / (K0 * DL);
      const lamC = 2 * PI * Math.sqrt(GAM / (Math.abs(M_LIQ) * GC));
      const lam2 = LAM2 / Math.sqrt(G);
      const rho = dTm > 1e-4 ? GAM / dTm : 0;
      const destabil = Math.max(0, 1 - ratio);
      const ampW = 0.25 * lamC * LM * Math.sqrt(destabil);      // 饱和胞幅（示意），λ_c 为真式
      const dendritic = destabil > 0.62 && dTm > 0.05;
      rd.st = ratio >= 1 ? '平面界面（稳定，无成分过冷）' : (dendritic ? '树枝晶（深度过冷，胞尖加速生长）' : '胞状界面（成分过冷，规则六角胞）');

      // 界面起伏
      const kk = TWO_PI / Math.max(lamC * LM, 6 * FW / (FG - 1));   // 每胞至少 6 格采样：λ_c 在低速端小于网格步距时按显示下限画，真实值见面板读数
      {
        let v = 0;
        for (let i = 0; i < FG; i++) {
          const yy = -FW / 2 + FW * i / (FG - 1);
          for (let j = 0; j < FG; j++) {
            const zz = -FW / 2 + FW * j / (FG - 1);
            fPos[v] = ampW * hexMod(yy, zz, kk); fPos[v + 1] = yy; fPos[v + 2] = zz;
            v += 3;
          }
        }
        fGeo.attributes['position'].needsUpdate = true;
        fGeo.computeVertexNormals();
      }
      fMat.emissiveIntensity = 0.25 + 0.55 * destabil;

      // 溶质等值面
      for (let s = 0; s < 3; s++) {
        const ct = ISO[s] * C0;
        const arg = (ct / C0 - 1) * K0 / (1 - K0);
        const xs = -LD * Math.log(Math.min(0.999, arg));
        const decay = Math.exp(-(xs / LD)) * 0.6;
        let v = 0;
        for (let i = 0; i < IG; i++) {
          const yy = -FW / 2 + FW * i / (IG - 1);
          for (let j = 0; j < IG; j++) {
            const zz = -FW / 2 + FW * j / (IG - 1);
            isoPos[s][v] = xs * LM + ampW * decay * hexMod(yy, zz, kk);
            isoPos[s][v + 1] = yy; isoPos[s][v + 2] = zz;
            v += 3;
          }
        }
        isoGeo[s].attributes['position'].needsUpdate = true;
        isoMat[s].opacity = 0.05 + 0.16 * destabil;
      }

      // 主臂：r²(z)=2ρz+z²（Ivantsov 抛物面），沿 +x
      const tipX = ampW * (1 + 0.15 * Math.sin(TWO_PI * t / 3.7));
      const zmaxW = dendritic ? 1.35 : 0.0;
      {
        let v = 0;
        const zmax = zmaxW / LM;
        for (let i = 0; i < TZ; i++) {
          const z = zmax * i / (TZ - 1);
          const r = Math.sqrt(Math.max(0, 2 * rho * z + z * z)) * LM;
          const xw = tipX + z * LM;
          for (let j = 0; j < TP; j++) {
            const a = TWO_PI * (j / (TP - 1));
            dPos[v] = xw; dPos[v + 1] = r * Math.cos(a); dPos[v + 2] = r * Math.sin(a);
            v += 3;
          }
        }
        dGeo.attributes['position'].needsUpdate = true;
        dMesh.visible = dendritic && rho > 0;
      }

      // 二次臂：间距 λ₂，沿 ⟨100⟩ 晶轴自干杆侧向长出；离顶端越远（越老）越长＝粗化
      const lam2W = lam2 * LM;
      const na = Math.max(1, Math.min(NARM, Math.floor(1.3 / Math.max(0.08, lam2W))));
      const flow = (t * 0.42) % lam2W;
      for (let d = 0; d < NDIR; d++) {
        for (let i = 0; i < NARM; i++) {
          const mesh = arms[i * NDIR + d];
          if (i >= na || !dendritic) { mesh.visible = false; continue; }
          mesh.visible = true;
          const s = i * lam2W + flow;                    // world，距干端的距离
          const xw = tipX + zmaxW - s;
          const age = s / Math.max(1e-4, na * lam2W);
          const len = (0.10 + 0.62 * age) * (0.45 + 0.55 * destabil);
          const zmet = Math.max(0, (xw - tipX) / LM);    // 该处干杆对应的 z（米）
          const rr = Math.sqrt(Math.max(0, 2 * rho * zmet + zmet * zmet)) * LM + 0.02;
          mesh.scale.set(len * 0.055, len, len * 0.055);
          mesh.rotation.set(d < 2 ? 0 : PI / 2, 0, 0);
          const off = rr + len / 2;
          mesh.position.set(xw, d === 0 ? off : (d === 1 ? -off : 0), d === 2 ? off : (d === 3 ? -off : 0));
        }
      }

      // 固相反流切片
      for (let i = 0; i < slices.length; i++) {
        slices[i].position.x = -0.4 - ((i * 0.72 + t * 0.42 * destabil) % 3.2);
      }

      // 图表：T_L(x) 红线 T(x)，蓝带只覆盖 ΔT=T_L−T>0 的成分过冷区
      {
        for (let i = 0; i < CT; i++) {
          const x = 6 * LD * i / (CT - 1);
          const xw = Math.min(4.35, x * LM);
          const a = tLAt(x, V), b = TIQ + G * x;
          const ya = CY0 + (a - TIQ) * K_T, yb = CY0 + (b - TIQ) * K_T;
          tlPos[i * 3] = xw; tlPos[i * 3 + 1] = ya; tlPos[i * 3 + 2] = CZW;
          ttPos[i * 3] = xw; ttPos[i * 3 + 1] = yb; ttPos[i * 3 + 2] = CZW;
          cX[i] = xw; cY[i] = yb; cH[i] = Math.max(0, ya - yb);
        }
        for (let i = 0; i < CT - 1; i++) {
          const o = i * 12;
          ucPos[o] = cX[i]; ucPos[o + 1] = cY[i] + cH[i]; ucPos[o + 2] = CZW;
          ucPos[o + 3] = cX[i]; ucPos[o + 4] = cY[i]; ucPos[o + 5] = CZW;
          ucPos[o + 6] = cX[i + 1]; ucPos[o + 7] = cY[i + 1] + cH[i + 1]; ucPos[o + 8] = CZW;
          ucPos[o + 9] = cX[i + 1]; ucPos[o + 10] = cY[i + 1]; ucPos[o + 11] = CZW;
        }
        tlGeo.attributes['position'].needsUpdate = true;
        ttGeo.attributes['position'].needsUpdate = true;
        ucGeo.attributes['position'].needsUpdate = true;
        ucMat.opacity = 0.15 + 0.45 * destabil;
      }

      rd.V = V; rd.G = G; rd.ratio = ratio; rd.dTm = dTm; rd.xm = xm; rd.zone = zone;
      rd.lamC = lamC; rd.lam2 = lam2; rd.rho = rho; rd.LD = LD; rd.amp = ampW / LM;

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
