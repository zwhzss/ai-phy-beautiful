import type { SceneContext, SceneInstance } from '../types';
/**
 * 掩星观测（P285）：柯伊伯带天体的暗影以切向速度扫过地表，光变时标反演直径与弦长。
 * 主控方程：
 *   ① 菲涅耳尺度 F = √(λd/2)（λ=0.6μm、d=45AU ⇒ 1.42 km），衍射时标 t_F = F/v
 *   ② 几何弦半长 ℓ = √(R² − b²)，全掩时长 Δt = 2ℓ/v ⇒ 反演直径 D=2R 与弦长 2ℓ
 *   ③ 点源衍射光变（条形屏近似）：归一化波带积分 N(u)=(1+i)/2∫_u^∞ e^{iπt²/2}dt，
 *      A = i − N(u₁) + N(u₂)，u_{1,2} = (∓ℓ − x)/F，I = |A|²；掠射用单边 N(−g/F)
 *   ④ 大气掩星：切向光深 τ(h) = τ₀·e^{−h/H}（H 为标高），I_atm = e^{−τ}，h(x) = √(x²+b²) − R
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

  const TWO_PI = Math.PI * 2;

  const starField = geo(new THREE.BufferGeometry());
  {
    const p = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      p[i * 3] = (Math.random() - 0.5) * 200;
      p[i * 3 + 1] = (Math.random() - 0.5) * 200;
      p[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    starField.setAttribute('position', new THREE.BufferAttribute(p, 3));
  }
  group.add(new THREE.Points(starField, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));

  // ============ 真实数值（SI） ============
  const LAM = 0.6e-6;
  const DIST = 45 * 1.495978707e11;      // 45 AU
  const V_T = 25e3;                       // 切向速度 m/s
  const R_EARTH = 6.371e6;
  const H_ATM = 50e3;                     // 大气标高
  const TAU0 = 0.5;                       // 地表处切向光深
  const FRES = Math.sqrt((LAM * DIST) / 2);        // 1.42 km
  const T_FRES = FRES / V_T;                       // 56.8 ms

  let bodyR = 500e3, bPar = 0, chordHalf = 0, durFull = 0, winSpan = 60;

  // ============ 菲涅耳积分 C(u)、S(u)（归一化 C(∞)=S(∞)=1/2） ============
  const factCache: number[] = [1];
  function factorial(n: number): number {
    for (let i = factCache.length; i <= n; i++) factCache.push(factCache[i - 1] * i);
    return factCache[n];
  }
  function fresnelCS(u: number): [number, number] {
    const sgn = u < 0 ? -1 : 1;
    const x = Math.abs(u);
    if (x < 4) {
      // Cornu 级数：C = Σ (−1)^k (π/2)^{2k} x^{4k+1}/((2k)!(4k+1))，S = Σ (−1)^k (π/2)^{2k+1} x^{4k+3}/((2k+1)!(4k+3))
      let cf = 0, sf = 0;
      for (let k = 0; k <= 30; k++) {
        const s = k % 2 === 0 ? 1 : -1;
        const tc = (s * Math.pow(Math.PI / 2, 2 * k) * Math.pow(x, 4 * k + 1)) / (factorial(2 * k) * (4 * k + 1));
        const ts = (s * Math.pow(Math.PI / 2, 2 * k + 1) * Math.pow(x, 4 * k + 3)) / (factorial(2 * k + 1) * (4 * k + 3));
        cf += tc; sf += ts;
        if (Math.abs(tc) + Math.abs(ts) < 1e-18) break;
      }
      return [sgn * cf, sgn * sf];
    }
    // 一阶渐近（x≥4 时绝对误差 <2e-3；级数在 x>4.5 后因交错抵消失效，故此处切换）
    const w = (Math.PI * x * x) / 2;
    return [sgn * (0.5 + Math.sin(w) / (Math.PI * x)), sgn * (0.5 - Math.cos(w) / (Math.PI * x))];
  }
  // N(u) = (1+i)/2 ∫_u^∞ e^{iπt²/2}dt ⇒ Re=(a−b)/2, Im=(a+b)/2, a=0.5−C, b=0.5−S
  function nAmp(u: number): [number, number] {
    const [c, s] = fresnelCS(u);
    const a = 0.5 - c, b = 0.5 - s;
    return [(a - b) / 2, (a + b) / 2];
  }
  // 条形屏（半宽 ℓ）：光线横向坐标 x（沿掩星弦）
  function stripFlux(x: number, ell: number): number {
    const n1 = nAmp((-ell - x) / FRES);
    const n2 = nAmp((ell - x) / FRES);
    const re = -n1[0] + n2[0];
    const im = 1 - n1[1] + n2[1];
    return re * re + im * im;
  }
  // 单边（掠射，间隙 g ≥ 0）
  function edgeFlux(g: number): number {
    const n = nAmp(-g / FRES);
    return n[0] * n[0] + n[1] * n[1];
  }
  function fluxAt(x: number): number {
    if (bPar < bodyR) return stripFlux(x, chordHalf);
    return edgeFlux(Math.sqrt(x * x + bPar * bPar) - bodyR);
  }
  function atmFlux(x: number): number {
    const h = Math.sqrt(x * x + bPar * bPar) - bodyR;
    if (h < 0) return 0;
    return Math.exp(-TAU0 * Math.exp(-h / H_ATM));
  }

  // ============ 左：地球、观测台站、扫过的暗影 ============
  const E_X = -2.75, E_Y = 0.5, E_R = 1.05;      // 1 unit = 6371/1.05 km
  const KM_PER_U = R_EARTH / E_R;
  const earth = new THREE.Mesh(
    geo(new THREE.SphereGeometry(E_R, 34, 24)),
    mat(new THREE.MeshStandardMaterial({ color: 0x2b5f8f, metalness: 0.1, roughness: 0.9, emissive: 0x0b1d30, emissiveIntensity: 0.6 })),
  );
  earth.position.set(E_X, E_Y, 0);
  group.add(earth);
  const atmo = new THREE.Mesh(
    geo(new THREE.SphereGeometry(E_R * 1.05, 30, 20)),
    mat(new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.12, side: THREE.BackSide })),
  );
  atmo.position.copy(earth.position);
  group.add(atmo);

  const STA = new THREE.Vector3(0.32, 0.55, 0.77).normalize().multiplyScalar(E_R).add(new THREE.Vector3(E_X, E_Y, 0));
  const station = new THREE.Mesh(geo(new THREE.ConeGeometry(0.05, 0.14, 10)), mat(new THREE.MeshBasicMaterial({ color: 0x22c55e })));
  station.position.copy(STA);
  {
    const outward = STA.clone().sub(new THREE.Vector3(E_X, E_Y, 0)).normalize();
    station.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outward);
  }
  group.add(station);

  // 影子扫过的大圆路径
  const sHat = STA.clone().sub(new THREE.Vector3(E_X, E_Y, 0)).normalize();
  const tHat = new THREE.Vector3(-sHat.z, 0, sHat.x).normalize();
  const trackGeo = geo(new THREE.BufferGeometry());
  {
    const pts: number[] = [];
    const axis = new THREE.Vector3().crossVectors(sHat, tHat).normalize();
    for (let i = 0; i <= 80; i++) {
      const ang = ((i / 80) - 0.5) * 1.5;
      const p = sHat.clone().applyAxisAngle(axis, ang).multiplyScalar(E_R * 1.008).add(new THREE.Vector3(E_X, E_Y, 0));
      pts.push(p.x, p.y, p.z);
    }
    trackGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  }
  group.add(new THREE.Line(trackGeo, mat(new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.55 }))));

  const shadeGeo = geo(new THREE.CircleGeometry(1, 34));
  const shadeMat = mat(new THREE.MeshBasicMaterial({ color: 0x04060b, transparent: true, opacity: 0.85 }));
  const shade = new THREE.Mesh(shadeGeo, shadeMat);
  group.add(shade);
  const shadeRim = new THREE.Mesh(geo(new THREE.RingGeometry(0.93, 1, 34)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.75, side: THREE.DoubleSide })));
  group.add(shadeRim);
  const umbGeo = geo(new THREE.BufferGeometry());
  umbGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  group.add(new THREE.Line(umbGeo, mat(new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.45 }))));

  // 背景恒星与前方天体剪影
  const glowCv = document.createElement('canvas');
  glowCv.width = 128; glowCv.height = 128;
  {
    const c = glowCv.getContext('2d')!;
    const g = c.createRadialGradient(64, 64, 2, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.35, 'rgba(186,222,255,0.45)');
    g.addColorStop(1, 'rgba(140,190,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  }
  const glowTex = tex(new THREE.CanvasTexture(glowCv));
  const bgStarMat = mat(new THREE.SpriteMaterial({ map: glowTex, transparent: true }));
  const bgStar = new THREE.Sprite(bgStarMat);
  bgStar.position.set(E_X - 0.55, E_Y + 0.95, -3.1);
  bgStar.scale.setScalar(0.8);
  group.add(bgStar);
  const kbo = new THREE.Mesh(geo(new THREE.SphereGeometry(1, 20, 14)), mat(new THREE.MeshStandardMaterial({ color: 0x11161f, metalness: 0.2, roughness: 0.95 })));
  kbo.position.set(E_X - 0.42, E_Y + 0.72, -1.75);
  group.add(kbo);
  const kboRim = new THREE.Mesh(geo(new THREE.RingGeometry(0.97, 1.03, 34)), mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.5, side: THREE.DoubleSide })));
  kboRim.position.copy(kbo.position);
  group.add(kboRim);

  // ============ 中下：弦长几何（天体圆面 + 视线弦） ============
  const IN_X = -0.1, IN_Y = -2.35, IN_R = 0.72;
  {
    const g = geo(new THREE.BufferGeometry());
    const pts: number[] = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * TWO_PI;
      pts.push(IN_X + IN_R * Math.cos(a), IN_Y + IN_R * Math.sin(a), 0);
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    group.add(new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color: 0x64748b }))));
    // 直径刻度
    const g2 = geo(new THREE.BufferGeometry());
    g2.setAttribute('position', new THREE.BufferAttribute(new Float32Array([IN_X - IN_R, IN_Y, 0, IN_X + IN_R, IN_Y, 0, IN_X, IN_Y - IN_R, 0, IN_X, IN_Y + IN_R, 0]), 3));
    group.add(new THREE.LineSegments(g2, mat(new THREE.LineBasicMaterial({ color: 0x334155 }))));
  }
  const chordGeo = geo(new THREE.BufferGeometry());
  chordGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  const chordMat = mat(new THREE.LineBasicMaterial({ color: 0x22d3ee }));
  group.add(new THREE.Line(chordGeo, chordMat));

  // ============ 右：光变曲线 ============
  const LC_X0 = 0.85, LC_X1 = 4.4, LC_Y0 = 0.1, LC_Y1 = 3.0;
  const LC_N = 260;
  const lcGeo = geo(new THREE.BufferGeometry());
  lcGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((LC_N + 1) * 3), 3));
  group.add(new THREE.Line(lcGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e }))));
  const lcAtmGeo = geo(new THREE.BufferGeometry());
  lcAtmGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((LC_N + 1) * 3), 3));
  group.add(new THREE.Line(lcAtmGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.9 }))));
  const lcNowGeo = geo(new THREE.BufferGeometry());
  lcNowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  group.add(new THREE.Line(lcNowGeo, mat(new THREE.LineBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.8 }))));
  const lcDot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.06, 10, 8)), mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })));
  group.add(lcDot);
  {
    const g = geo(new THREE.BufferGeometry());
    const pts: number[] = [LC_X0, LC_Y0, 0, LC_X1, LC_Y0, 0, LC_X0, LC_Y0, 0, LC_X0, LC_Y1 + 0.2, 0];
    for (let i = 0; i <= 4; i++) pts.push(LC_X0, LC_Y0 + ((LC_Y1 - LC_Y0) * i) / 4, 0, LC_X0 + 0.1, LC_Y0 + ((LC_Y1 - LC_Y0) * i) / 4, 0);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    group.add(new THREE.LineSegments(g, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));
  }
  const LC_T_SCENE = 8;   // 曲线窗口用 8 s 播完

  function buildCurves(): void {
    const p1 = lcGeo.attributes['position'].array as Float32Array;
    const p2 = lcAtmGeo.attributes['position'].array as Float32Array;
    for (let i = 0; i <= LC_N; i++) {
      const frac = i / LC_N;
      const x = V_T * ((frac - 0.5) * winSpan);
      const f = Math.max(0, Math.min(1.06, fluxAt(x)));
      const fa = Math.max(0, Math.min(1.06, atmFlux(x)));
      const px = LC_X0 + (LC_X1 - LC_X0) * frac;
      p1[i * 3] = px; p1[i * 3 + 1] = LC_Y0 + f * (LC_Y1 - LC_Y0); p1[i * 3 + 2] = 0;
      p2[i * 3] = px; p2[i * 3 + 1] = LC_Y0 + fa * (LC_Y1 - LC_Y0); p2[i * 3 + 2] = 0.02;
    }
    lcGeo.attributes['position'].needsUpdate = true;
    lcAtmGeo.attributes['position'].needsUpdate = true;
  }

  // ============ 标签 ============
  function makeLabel(text: string, color: string, scale = 3.4): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 25px "PingFang SC", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  const lblEarth = makeLabel('地球（1 unit = 6068 km）+ 观测台站', '#94a3b8', 3.9);
  lblEarth.position.set(E_X, E_Y - 1.5, 0);
  group.add(lblEarth);
  const lblKbo = makeLabel('柯伊伯带天体（45 AU）', '#22d3ee', 2.8);
  lblKbo.position.set(E_X - 1.5, E_Y + 1.35, -1.75);
  group.add(lblKbo);
  const lblChord = makeLabel('弦半长 ℓ = √(R²−b²)', '#22d3ee', 3.0);
  lblChord.position.set(IN_X, IN_Y - 1.1, 0);
  group.add(lblChord);
  const lblLc = makeLabel('光变曲线：绿=裸岩（衍射），黄=大气渐灭', '#22c55e', 4.2);
  lblLc.position.set((LC_X0 + LC_X1) / 2, LC_Y1 + 0.72, 0);
  group.add(lblLc);
  const lblTime = makeLabel('时间 →', '#64748b', 1.8);
  lblTime.position.set(LC_X1 - 0.4, LC_Y0 - 0.35, 0);
  group.add(lblTime);

  // ============ 面板 ============
  const infoCv = document.createElement('canvas');
  infoCv.width = 900; infoCv.height = 300;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.4, 3.13)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 4.85, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  const ln = (y: number, color: string, text: string, bold = false, size = 26): void => {
    infoCtx.fillStyle = color;
    infoCtx.font = `${bold ? 'bold ' : ''}${size}px "PingFang SC", sans-serif`;
    infoCtx.fillText(text, 22, y);
  };
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 900, 300);
    infoCtx.fillStyle = 'rgba(7,11,20,0.86)';
    infoCtx.fillRect(4, 4, 892, 292);
    infoCtx.strokeStyle = '#334155';
    infoCtx.lineWidth = 3;
    infoCtx.strokeRect(4, 4, 892, 292);
    infoCtx.textAlign = 'left';

    ln(40, '#f8fafc', '掩星观测 —— 用影子的时标量出看不见的天体', true);
    ln(78, '#22d3ee', `F = √(λd/2) = ${(FRES / 1000).toFixed(2)} km ⇒ 衍射时标 F/v = ${(T_FRES * 1000).toFixed(1)} ms（λ=0.6μm，d=45AU，v=${V_T / 1000} km/s）`);
    ln(112, '#22c55e', `ℓ = √(R²−b²) = ${(chordHalf / 1000).toFixed(0)} km ⇒ 全掩 Δt = 2ℓ/v = ${durFull.toFixed(2)} s（R≫F，几何段压平）`);
    ln(146, '#a855f7', `反演：D = 2R = ${(2 * bodyR / 1000).toFixed(0)} km，θ = D/d = ${((2 * bodyR / DIST) * 206265).toFixed(4)}″；影斑在地表直径 ≈ ${(2 * bodyR / 1000).toFixed(0)} km`);
    ln(180, '#fbbf24', `大气：τ(h)=τ₀e^{−h/H}，H=${(H_ATM / 1000).toFixed(0)} km ⇒ 消光时标 √(2HR)/v = ${(Math.sqrt(2 * H_ATM * bodyR) / V_T).toFixed(1)} s（远长于裸岩的 ${(T_FRES * 1000).toFixed(0)} ms）`);

    infoCtx.fillStyle = bPar < bodyR ? '#f472b6' : '#ef4444';
    infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：R = ${(bodyR / 1000).toFixed(0)} km  b = ${(bPar / 1000).toFixed(0)} km  ${bPar < bodyR ? `掩星 ${durFull.toFixed(1)} s（中心弦）` : '掠射：只见边缘衍射，无全掩'}`,
      22, 222,
    );
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText(`曲线窗口 ${winSpan.toFixed(1)} s 用 ${LC_T_SCENE} s 播完（时间压缩 ×${(winSpan / LC_T_SCENE).toFixed(1)}）；影斑半径按真实 km 比例绘制`, 22, 264);
    infoTex.needsUpdate = true;
  }

  function computeState(): void {
    chordHalf = bPar < bodyR ? Math.sqrt(bodyR * bodyR - bPar * bPar) : 0;
    durFull = (2 * chordHalf) / V_T;
    winSpan = 2 * Math.max(chordHalf, 5 * FRES) / V_T + 26 * T_FRES;
  }

  computeState();
  buildCurves();
  drawInfo();

  const axisTrack = new THREE.Vector3().crossVectors(sHat, tHat).normalize();
  const center = new THREE.Vector3(E_X, E_Y, 0);

  return {
    update(t, dt) {
      // 天体半径 60→1200 km（16 s 往复）；瞄准距 b 从 0 到 1.05R（12 s 往复）
      bodyR = 6.3e5 + 5.7e5 * Math.sin(((t % 16) / 16) * TWO_PI);
      bPar = 1.05 * bodyR * Math.abs(Math.sin(((t % 12) / 12) * TWO_PI));
      computeState();
      buildCurves();

      // 光变曲线时间轴 → 弦上坐标 x
      const frac = (t % LC_T_SCENE) / LC_T_SCENE;
      const x = V_T * ((frac - 0.5) * winSpan);
      const f = Math.max(0, Math.min(1, fluxAt(x)));

      // 影斑沿大圆滑过台站
      const ang = x / KM_PER_U;
      const p = sHat.clone().applyAxisAngle(axisTrack, Math.max(-1.2, Math.min(1.2, ang)));
      const surf = p.clone().multiplyScalar(E_R * 1.01).add(center);
      const shadeR = Math.max(0.015, bodyR / KM_PER_U);
      shade.position.copy(surf);
      shade.lookAt(center);
      shade.scale.setScalar(shadeR);
      shadeRim.position.copy(surf).addScaledVector(p, 0.006);
      shadeRim.lookAt(center);
      shadeRim.scale.setScalar(shadeR);
      const inShadow = bPar < bodyR;
      shade.visible = inShadow;
      shadeRim.visible = inShadow;

      // 星光/本影连线
      const up = umbGeo.attributes['position'].array as Float32Array;
      up[0] = bgStar.position.x; up[1] = bgStar.position.y; up[2] = bgStar.position.z;
      up[3] = kbo.position.x; up[4] = kbo.position.y; up[5] = kbo.position.z;
      up[6] = surf.x; up[7] = surf.y; up[8] = surf.z;
      up[9] = STA.x; up[10] = STA.y; up[11] = STA.z;
      umbGeo.attributes['position'].needsUpdate = true;
      const kboR = 0.1 + 0.14 * (bodyR / 1.2e6);
      kbo.scale.setScalar(kboR);
      kboRim.scale.setScalar(kboR);
      kboRim.quaternion.copy(ctx.camera.quaternion);

      bgStarMat.opacity = 0.1 + 0.9 * f;
      bgStar.scale.setScalar(0.45 + 0.55 * Math.max(0.08, f));

      // 曲线游标
      const cp = lcNowGeo.attributes['position'].array as Float32Array;
      const fx = LC_X0 + (LC_X1 - LC_X0) * frac;
      cp[0] = fx; cp[1] = LC_Y0; cp[2] = 0.03; cp[3] = fx; cp[4] = LC_Y1 + 0.15; cp[5] = 0.03;
      lcNowGeo.attributes['position'].needsUpdate = true;
      lcDot.position.set(fx, LC_Y0 + f * (LC_Y1 - LC_Y0), 0.05);

      // 弦长示意
      const bU = (bPar / bodyR) * IN_R;
      const ellU = inShadow ? Math.sqrt(Math.max(0, IN_R * IN_R - bU * bU)) : 0;
      const ch = chordGeo.attributes['position'].array as Float32Array;
      ch[0] = IN_X - IN_R * 1.08; ch[1] = IN_Y + bU; ch[2] = 0.01;
      ch[3] = IN_X + IN_R * 1.08; ch[4] = IN_Y + bU; ch[5] = 0.01;
      ch[6] = IN_X - ellU; ch[7] = IN_Y + bU; ch[8] = 0.02;
      ch[9] = IN_X + ellU; ch[10] = IN_Y + bU; ch[11] = 0.02;
      chordGeo.attributes['position'].needsUpdate = true;
      chordMat.color.setHex(inShadow ? 0x22d3ee : 0xef4444);

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
