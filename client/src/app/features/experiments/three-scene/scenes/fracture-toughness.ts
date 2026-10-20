import type { SceneContext, SceneInstance } from '../types';
/**
 * 断裂韧性（P380）—— 主控方程（中心穿透裂纹宽板，I 型，SI 直算，node 已复核）：
 *   应力强度因子  K_I = Y·σ·√(π a)，Y=1（无限板中心裂纹，a＝半长）
 *   尖端应力场    σ_yy(r,θ) = K_I/√(2πr)·cos²(θ/2)·[1+sin(θ/2)·sin(3θ/2)]  ← r→0 按 1/√r 发散
 *   塑性区        r_p(θ) = (1/2π)(K_I/σ_ys)²·cos²(θ/2)（平面应力）；平面应变取 /3 ⇒ 画面球冠
 *   能量释放率    G = K_I²/E′，E′=E/(1−ν²)；Griffith 阻力 G_c = K_IC²/E′
 *   失稳判据      G ≥ G_c ⇔ K_I ≥ K_IC ⇔ a ≥ a_c = (1/π)(K_IC/σ)²
 * 真实锚点：调质钢 σ=250MPa，σ_ys=345MPa，E=205GPa，ν=0.3，K_IC=80 MPa·m½
 *   ⇒ a_c=32.6mm，G_c=28.4 kJ/m²（＝2(γ_s+γ_p)，塑性功 γ_p≈14 kJ/m² ≫ 玻璃表面能）
 *   a=0.2/10/32.6mm ⇒ K_I=6.3/44.3/80.0 MPa·m½，r_p=(1/6π)(K/σ_ys)²=17.5/876/2853 µm（平面应变，画面按板宽自适应放大）
 *   脆韧对照：玻璃 K_IC=0.77 ⇒ G_c=8.5 J/m²≈2γ_s（γ_s≈4.2 J/m²，Griffith 原始量级）；
 *             Al₂O₃ K_IC=4 ⇒ G_c=42 J/m²。同一载荷下能量阻力差三个数量级＝脆/韧之别。
 * 画面：板面 σ_yy 顶点色场（蓝→绿→黄→红，按 σ_yy/σ_ys 归一，r→0 截断显示）＋黑色预制裂纹
 * ＋裂纹尖端球冠塑性区（半径＝实算 r_p，画面放大 ×40，面板注明）＋G 与 G_c 能量拉锯柱＋K_I–a 曲线。
 * 扫描自变量：裂纹半长 a 由 0.2mm 稳态开到 a_c（前 80% 周期），其后失稳加速冲向 45mm
 * （板半宽 50mm，尖端与塑性区球冠均严格留在板内，见下方边距限幅）。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };
  const PI = Math.PI, TWO_PI = PI * 2;

  const SIGA = 250e6, SYS = 345e6, E = 205e9, NU = 0.3, KIC = 80e6;
  const EP = E / (1 - NU * NU);
  const GC = KIC * KIC / EP;                             // 28.4 kJ/m²
  const AC = (1 / PI) * (KIC / SIGA) * (KIC / SIGA);     // 32.6 mm
  const GI = (a: number) => SIGA * Math.sqrt(PI * a);
  const GRA = (a: number) => GI(a) * GI(a) / EP;
  const RP = (a: number) => (1 / (2 * PI)) * Math.pow(GI(a) / SYS, 2) / 3;   // 平面应变

  // —— 显示比例：板半宽 50 mm ⇒ 2.4 world（1wu=20.83 mm），裂纹 a 同比例 ——
  const HALFWM = 50, SCW = 2.4 / (HALFWM * 1e-3);
  const PZMAG = 40;                                      // 塑性区画面放大倍数
  const A_MIN = 0.2e-3, A_RUN = 45e-3, RAMP_END = 0.8, CY = 18;   // A_RUN<HALFWM：running crack 不越板缘

  // —— 星野 + 地面 ——
  {
    const g = geo(new THREE.BufferGeometry());
    const p = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      p[i * 3] = (Math.random() - 0.5) * 200; p[i * 3 + 1] = (Math.random() - 0.5) * 200; p[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    group.add(new THREE.Points(g, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  }
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // —— 板：厚度背板 + σ_yy 顶点色场网格（x–y 平面，中心 y=CY0）——
  const CY0 = 1.72;
  const thick = new THREE.Mesh(
    geo(new THREE.BoxGeometry(4.86, 3.26, 0.2)),
    mat(new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.4, roughness: 0.7 })),
  );
  thick.position.set(0, CY0, -0.11);
  group.add(thick);
  const MX = 72, MY = 48, NV = MX * MY;
  const plateGeo = geo(new THREE.PlaneGeometry(4.8, 3.2, MX - 1, MY - 1));
  const colArr = new Float32Array(NV * 3);
  plateGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  const plate = new THREE.Mesh(plateGeo, mat(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  plate.position.set(0, CY0, 0.02);
  group.add(plate);
  const vtx = plateGeo.attributes['position'].array as Float32Array;

  // —— 预制裂纹（黑色狭缝，两个尖端）——
  const crack = new THREE.Mesh(geo(new THREE.BoxGeometry(1, 0.026, 0.34)), mat(new THREE.MeshBasicMaterial({ color: 0x000000 })));
  crack.position.set(0, CY0, 0.045);
  group.add(crack);

  // —— 加载箭头 ——
  const shGeo = geo(new THREE.CylinderGeometry(0.026, 0.026, 1, 8));
  const hdGeo = geo(new THREE.ConeGeometry(0.075, 0.17, 10));
  const arrMat = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
  const PT = CY0 + 1.6, PB = CY0 - 1.6;
  for (const sx of [-2.0, -1.0, 0, 1.0, 2.0]) {
    const s = new THREE.Mesh(shGeo, arrMat); s.scale.y = 0.5; s.position.set(sx, PT + 0.3, 0);
    const h = new THREE.Mesh(hdGeo, arrMat); h.position.set(sx, PT + 0.63, 0);
    const sb = new THREE.Mesh(shGeo, arrMat); sb.scale.y = 0.5; sb.position.set(sx, PB - 0.3, 0);
    const hb = new THREE.Mesh(hdGeo, arrMat); hb.rotation.x = PI; hb.position.set(sx, PB - 0.63, 0);
    group.add(s, h, sb, hb);
  }

  // —— 尖端塑性区球冠（半球，平口贴裂纹面）——
  const domeGeo = geo(new THREE.SphereGeometry(1, 26, 16, 0, TWO_PI, 0, PI / 2));
  const domeMat = mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xf59e0b, emissiveIntensity: 0.7, transparent: true, opacity: 0.55, depthWrite: false }));
  const domeR = new THREE.Mesh(domeGeo, domeMat); domeR.rotation.z = -PI / 2;
  const domeL = new THREE.Mesh(domeGeo, domeMat); domeL.rotation.z = PI / 2;
  group.add(domeR, domeL);

  // —— 能量拉锯柱 G vs G_c ——
  const barGeo = geo(new THREE.BoxGeometry(0.42, 1, 0.42));
  const gMat = mat(new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x15803d, emissiveIntensity: 0.5 }));
  const gcMat = mat(new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x6d28d9, emissiveIntensity: 0.5, transparent: true, opacity: 0.55 }));
  const gBar = new THREE.Mesh(barGeo, gMat); gBar.position.set(-3.5, 0.5, 1.7);
  const gcBar = new THREE.Mesh(barGeo, gcMat); gcBar.position.set(-2.9, 0.5, 1.7);
  const gScale = 12000;                                   // 12 kJ/m² ⇒ 1 world 高
  gcBar.scale.y = GC / gScale; gcBar.position.y = gcBar.scale.y / 2;
  group.add(gBar, gcBar);

  // —— K_I–a 曲线（竖直面 z=KZ）——
  const KX0 = 1.4, KX1 = 4.05, KY0 = 0.12, KY1 = 2.45, KZ = 2.35;
  const KMAX = 100e6, AMAXW = 0.036, NK = 120;
  const kcGeo = geo(new THREE.BufferGeometry());
  kcGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NK * 3), 3));
  group.add(new THREE.Line(kcGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e }))));
  const kICy = KY0 + (KY1 - KY0) * KIC / KMAX;
  const kaxGeo = geo(new THREE.BufferGeometry());
  kaxGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    KX0, KY0, KZ, KX1, KY0, KZ, KX0, KY0, KZ, KX0, KY1, KZ, KX0, kICy, KZ, KX1, kICy, KZ,
  ]), 3));
  group.add(new THREE.LineSegments(kaxGeo, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));
  const kmk = new THREE.Mesh(geo(new THREE.SphereGeometry(0.09, 12, 10)), mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })));
  group.add(kmk);

  // —— 标签 ——
  function makeLabel(text: string, color: string, sx = 4.6): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 768; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 384, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(sx, sx / 12, 1);
    return s;
  }
  const lb1 = makeLabel('σ_yy=K/√(2πr)·cos²(θ/2)[1+sin(θ/2)sin(3θ/2)] —— 1/√r 发散', '#67e8f9', 6.0); lb1.position.set(0, CY0 + 1.62, 0.25);
  const lb2 = makeLabel('球冠＝平面应变塑性区 r_p=(1/6π)(K/σ_ys)²（画面 ×40）', '#fcd34d', 5.0); lb2.position.set(1.25, CY0 - 0.62, 0.75);
  const lb3 = makeLabel('G（绿柱）追 Griffith 阻力 G_c（紫柱）：G≥G_c 即失稳', '#86efac', 5.0); lb3.position.set(-3.2, 1.9, 1.7);
  const lb4 = makeLabel('K_I–a 曲线撞上 K_IC=80 水平线', '#a5f3fc', 4.4); lb4.position.set((KX0 + KX1) / 2, KY1 + 0.28, KZ);
  group.add(lb1, lb2, lb3, lb4);

  // —— 面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 880; infoCv.height = 274;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.6, 2.99)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 4.62, 0); infoPlane.renderOrder = 999;
  group.add(infoPlane);

  const rd = { a: 0, k: 0, g: 0, rp: 0, safe: 0, unstable: false, peak: 0, mag: 1 };
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 880, 274);
    infoCtx.fillStyle = 'rgba(7,11,20,0.84)'; infoCtx.fillRect(4, 4, 872, 266);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 872, 266);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 27px "PingFang SC", sans-serif';
    infoCtx.fillText('断裂韧性：裂纹尖端的信息量比裂纹长度更说了算', 22, 36);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '23px "PingFang SC", sans-serif';
    infoCtx.fillText('K_I = Y·σ√(πa)，Y=1 ⇒ σ_yy = K_I/√(2πr)·cos²(θ/2)[1+sin(θ/2)sin(3θ/2)]', 22, 68);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('G = K_I²/E′，E′=E/(1−ν²)；阻力 G_c=K_IC²/E′；失稳 a≥a_c=(K_IC/σ)²/π', 22, 96);
    infoCtx.fillStyle = '#22c55e';
    infoCtx.fillText(`脆韧对照：玻璃 K_IC=0.77 ⇒ G_c=8.5 J/m²≈2γ_s；Al₂O₃ 4 ⇒ 42；钢 80 ⇒ ${(GC / 1e3).toFixed(1)} kJ/m²`, 22, 124);
    infoCtx.fillStyle = rd.unstable ? '#ef4444' : '#f472b6';
    infoCtx.fillText(rd.unstable
      ? `失稳扩展！a=${(rd.a * 1e3).toFixed(1)}mm 已越过 a_c=${(AC * 1e3).toFixed(1)}mm —— 剩余寿命归零`
      : `稳态：裕度 K_I/K_IC=${rd.safe.toFixed(3)}，裂纹仍可停在 a_c 之下（r_p 内已屈服）`, 22, 152);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 23px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：a=${(rd.a * 1e3).toFixed(2)} mm　K_I=${rd.k >= 10 ? rd.k.toFixed(1) : rd.k.toFixed(2)} MPa·m½　G=${rd.g >= 1e3 ? (rd.g / 1e3).toFixed(2) + ' kJ/m²' : rd.g.toFixed(1) + ' J/m²'}`, 22, 184);
    infoCtx.fillText(`r_p=${rd.rp >= 1e-4 ? (rd.rp * 1e3).toFixed(3) + ' mm' : (rd.rp * 1e6).toFixed(1) + ' µm'}　尖端 σ_yy/σ_ys=${rd.peak.toFixed(1)}（截断 2.6，真实 r→0 发散）`, 22, 212);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '21px "PingFang SC", sans-serif';
    infoCtx.fillText(`标尺：1wu=${(1e3 / SCW).toFixed(2)} mm；塑性区放大 ×${rd.mag.toFixed(0)}（自动限幅，上限 ${PZMAG}）；σ=250 σ_ys=345 MPa K_IC=80 E=205GPa ν=0.3`, 22, 244);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  // —— 色标 ——
  const cLow = new THREE.Color(0x1e3a8a), cMid = new THREE.Color(0x22c55e), cHi = new THREE.Color(0xfbbf24), cTop = new THREE.Color(0xef4444);
  const tmpC = new THREE.Color();
  function ramp(v: number, out: import('three').Color): void {
    const x = Math.max(0, Math.min(1, v));
    if (x < 0.4) out.copy(cLow).lerp(cMid, x / 0.4);
    else if (x < 0.72) out.copy(cMid).lerp(cHi, (x - 0.4) / 0.32);
    else out.copy(cHi).lerp(cTop, (x - 0.72) / 0.28);
  }
  let unstableT = -1;

  return {
    update(t, dt) {
      const ph = (t % CY) / CY;
      // 自变量：裂纹半长 a —— 稳态线性开到 a_c，其后失稳加速
      let a: number, unstable: boolean;
      if (ph < RAMP_END) {
        a = A_MIN + (AC - A_MIN) * (ph / RAMP_END);
        unstable = false; unstableT = -1;
      } else {
        const s = (ph - RAMP_END) / (1 - RAMP_END);
        a = AC + (A_RUN - AC) * s * s;
        unstable = true;
        if (unstableT < 0) unstableT = t;
      }
      const K = GI(a) / 1e6, G = GRA(a);
      const flash = unstable ? Math.max(0, 1 - (t - unstableT) / 1.4) : 0;
      const aW = a * SCW;
      const rpRaw = RP(a) * SCW;                            // 塑性区真实画面半径（wu）
      const capW = Math.min(0.55, HALFWM * 1e-3 * SCW - 0.08 - aW);   // 限幅：尖端球冠不越板缘（留 0.08wu）
      const mag = Math.min(PZMAG, capW / Math.max(rpRaw, 1e-4));
      const rpW = rpRaw * mag;

      crack.scale.x = 2 * aW;
      domeR.position.set(aW, CY0, 0.05); domeL.position.set(-aW, CY0, 0.05);
      const ds = Math.max(0.03, rpW);
      domeR.scale.set(ds, ds, ds * 0.92); domeL.scale.set(ds, ds, ds * 0.92);
      domeMat.opacity = 0.34 + 0.34 * Math.min(1, G / GC) + flash * 0.25;

      // 应力色场（Williams 近场，双尖端取大者）
      const KPa = GI(a), capR = 0.02;
      let peak = 0;
      for (let i = 0; i < NV; i++) {
        const x = vtx[i * 3], y = vtx[i * 3 + 1];
        if (Math.abs(y) < 0.024 && Math.abs(x) < aW) { colArr[i * 3] = 0.015; colArr[i * 3 + 1] = 0.015; colArr[i * 3 + 2] = 0.02; continue; }
        const dx = x - aW, r = Math.max(capR, Math.hypot(dx, y)) / SCW, th = Math.atan2(y, dx);
        const f1 = Math.pow(Math.cos(th / 2), 2) * (1 + Math.sin(th / 2) * Math.sin(1.5 * th)) / Math.sqrt(r);
        const dx2 = x + aW, r2 = Math.max(capR, Math.hypot(dx2, y)) / SCW, th2 = Math.atan2(y, dx2);
        const f2 = Math.pow(Math.cos(th2 / 2), 2) * (1 + Math.sin(th2 / 2) * Math.sin(1.5 * th2)) / Math.sqrt(r2);
        const sOver = (KPa / Math.sqrt(TWO_PI)) * Math.max(f1, f2) / SYS;
        if (sOver > peak) peak = sOver;
        ramp(sOver / 2.6, tmpC);
        const b = 1 - 0.3 * Math.min(1, Math.abs(x) / 2.4);
        colArr[i * 3] = tmpC.r * b; colArr[i * 3 + 1] = tmpC.g * b; colArr[i * 3 + 2] = tmpC.b * b;
      }
      plateGeo.attributes['color'].needsUpdate = true;
      rd.peak = peak;

      // 能量柱
      gBar.scale.y = Math.max(0.01, G / gScale); gBar.position.y = gBar.scale.y / 2;
      gcMat.opacity = 0.4 + 0.3 * (1 - Math.min(1, G / GC));
      gMat.emissiveIntensity = 0.4 + 1.2 * Math.min(1, G / GC) + flash * 2;

      // K–a 曲线
      {
        const p = kcGeo.attributes['position'].array as Float32Array;
        for (let i = 0; i < NK; i++) {
          const f = i / (NK - 1);
          p[i * 3] = KX0 + (KX1 - KX0) * f;
          p[i * 3 + 1] = KY0 + (KY1 - KY0) * Math.min(1, GI(f * AMAXW) / KMAX);
          p[i * 3 + 2] = KZ;
        }
        kcGeo.attributes['position'].needsUpdate = true;
        kcGeo.setDrawRange(0, NK);
      }
      kmk.position.set(KX0 + (KX1 - KX0) * Math.min(1, a / AMAXW), KY0 + (KY1 - KY0) * Math.min(1, K * 1e6 / KMAX), KZ);

      rd.a = a; rd.k = K; rd.g = G; rd.rp = RP(a); rd.safe = K * 1e6 / KIC; rd.unstable = unstable; rd.mag = mag;
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
