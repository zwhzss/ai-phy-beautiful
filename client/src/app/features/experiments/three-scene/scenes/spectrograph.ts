import type { SceneContext, SceneInstance } from '../types';
/**
 * 观测光谱仪（P291）：入射狭缝 → 准直镜 → 平面衍射光栅 → 相机 → 焦面 CCD；演示级次重叠（自由光谱范围）与狭缝—分辨率—吞吐量权衡。
 * 主控方程：
 *   ① 光栅方程（矢量形式，与图中每一条光线同源）：s = T·û + mλ/d，v̂ = s·T + √(1−s²)·N   ⇔   mλ = d(sinα + sinβ)
 *   ② 角色散 dθ/dλ = m/(d·cosβ)，线色散 dx/dλ = f_cam·dθ/dλ
 *   ③ 焦面位置只取决于乘积 mλ ⇒ 级次重叠（FSR = λ/m）：m=1 的 λ 与 m=2 的 λ/2、m=3 的 λ/3 严格同位
 *   ④ 狭缝像宽 = w·(f_cam/f_col)·(cosα/cosβ)（anamor 放大）；Δλ = √(Δλ_slit² + Δλ_pix² + (λ/(m·N_ill))²)，势分辨 R = m·N_ill
 *   ⑤ 有效刻线 N_ill = min(光束直径/|cos i|, 坯料长度)/d（掠入射把投影拉长，超出坯料即被裁切）
 *   ⑥ 调谐：相机静止在 θ_n0 的中心光轴上，光栅转 Δ ⇒ 衍射束在实验室系转 Δ·(1+cosα/cosβ)，线心在焦面上平移 f_cam·Δ·(1+cosα/cosβ)
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

  const TWO_PI = Math.PI * 2, DEG = 180 / Math.PI, RAD = Math.PI / 180;
  type P2 = { x: number, y: number };

  // ============ 真实仪器参数（等比缩放：1 unit = 120 mm） ============
  const MM_PER_U = 120;
  const D_NM = 3333.333;              // d = 1/300 mm（300 线/mm 紫外阶梯光栅前身型）
  const F_COL_MM = 132, F_CAM_MM = 144;
  const F_COL_U = F_COL_MM / MM_PER_U;   // 1.1
  const F_CAM_U = F_CAM_MM / MM_PER_U;   // 1.2
  const BEAM_HALF_U = 0.28;              // 准直光束半径 = 33.6 mm 半口径（f/4）
  const BLANK_U = 1.75;                  // 光栅坯料沿色散方向的长度（210 mm，需容下掠入射投影）
  const D_MM = D_NM / 1e6;               // 0.003333 mm = 300 线/mm
  let nIll = 0;                          // 有效照明刻线数 = min(投影长度, 坯料)/d，随转角变化
  const PIX_UM = 15, N_PIX = 4096;
  const CCD_H_MM = (N_PIX * PIX_UM) / 2000;   // 半宽 30.7 mm（61.4 mm 全幅，e2v 型）
  const CCD_H_U = CCD_H_MM / MM_PER_U;
  const LAM_LO = 250, LAM_HI = 900;          // nm 宽波段 ⇒ 级次重叠的来源
  const EXAG = 300;                          // 狭缝及其像的绘图放大倍数
  const LAM_C = 550;                          // 面板上用作色散/狭缝参考的中心波长

  // ============ bench 布局（x–y = 子午色散面，z = 狭缝长方向） ============
  const SLIT = { x: -2.75, y: -1.25 };
  const V_COL = { x: SLIT.x + F_COL_U, y: SLIT.y };
  const C_COL = { x: V_COL.x - 2 * F_COL_U, y: SLIT.y };
  const R_COL_U = 2 * F_COL_U;
  const GRAT = { x: 1.55, y: -1.25 };
  const THETA_N0 = 110;                       // 光栅法线角（相对 +x）
  const LENS_D_U = 0.35;

  // ============ 扫描自变量 ============
  let thetaN = THETA_N0;                  // 光栅转角（16 s 周期，±6°）= 调谐
  let slitUm = 25;                        // 狭缝宽（12 s 周期，10→120 μm）

  let Nv: P2 = { x: 0, y: 0 }, Tv: P2 = { x: 0, y: 0 };
  let M0: P2 = { x: 0.5117, y: 0.8594 }, Eh: P2 = { x: -0.8594, y: 0.5117 };
  let LENS = { x: 0, y: 0 }, CCD_C = { x: 0, y: 0 };
  const dot = (a: P2, b: P2): number => a.x * b.x + a.y * b.y;

  /** 光栅方程（矢量）：入射方向 û(tilt)、级次 m、波长 nm → 衍射单位方向 */
  function dirOf(m: number, lam: number, tilt: number): P2 | null {
    const ux = Math.cos(tilt), uy = Math.sin(tilt);
    const s = Tv.x * ux + Tv.y * uy + (m * lam) / D_NM;
    if (Math.abs(s) > 0.998) return null;
    const c = Math.sqrt(1 - s * s);
    return { x: s * Tv.x + c * Nv.x, y: s * Tv.y + c * Nv.y };
  }
  /** 薄透镜：与光轴夹 ψ 的平行光会聚到 h = f·tanψ（沿 ê） */
  function hOf(m: number, lam: number, tilt: number): number | null {
    const v = dirOf(m, lam, tilt);
    if (!v) return null;
    const den = dot(v, M0);
    if (den < 0.12) return null;
    return F_CAM_U * (dot(v, Eh) / den);
  }
  /** 反演：焦面位置 h → 乘积 mλ（nm） */
  function prodOfH(h: number): number {
    const psi = Math.atan(h / F_CAM_U);
    const vx = Math.cos(psi) * M0.x + Math.sin(psi) * Eh.x;
    const vy = Math.cos(psi) * M0.y + Math.sin(psi) * Eh.y;
    const a0 = Tv.x;                          // 名义入射（û = +x̂）的 T·û
    return D_NM * ((vx * Tv.x + vy * Tv.y) - a0);
  }
  function lamOf(m: number, h: number): number | null {
    const lam = prodOfH(h) / m;
    return lam >= LAM_LO && lam <= LAM_HI ? lam : null;
  }
  function setGrating(deg: number): void {
    const th = deg * RAD;
    Nv = { x: Math.cos(th), y: Math.sin(th) };
    Tv = { x: -Math.sin(th), y: Math.cos(th) };
  }
  // 相机（透镜 + CCD）钉死在 θ_n = THETA_N0 的中心光轴上 ⇒ 转动光栅是真正的"调谐"：
  // 衍射光束带着整个波段在静止的焦面上平移，转过 6° 就把线心推到 CCD 边缘之外。
  setGrating(THETA_N0);
  {
    const v0 = dirOf(1, LAM_C, 0);
    if (v0) M0 = v0;
    Eh = { x: -M0.y, y: M0.x };
    LENS = { x: GRAT.x + LENS_D_U * M0.x, y: GRAT.y + LENS_D_U * M0.y };
    CCD_C = { x: LENS.x + F_CAM_U * M0.x, y: LENS.y + F_CAM_U * M0.y };
  }

  // ============ 仪表导出量 ============
  let dispRadPerNm = 0, dispUmPerNm = 0, slitImgUm = 0, dLamSlit = 0, dLamPix = 0, dLamTot = 0;
  let reselU = 0, anamor = 0, alphaDeg = 0, betaDeg = 0, m1OnCcd = 0, ovFrac = 0, tuneMmPerDeg = 0;
  let hitOnCcd = 0, hitTotal = 0;
  let hCurMm = 0, footMm = 0, blankTrunc = false;

  function computeState(): void {
    setGrating(thetaN);
    // 掠入射把光束在光栅面上拉成 直径/|cos i| 的投影；投影超出坯料就被裁切（照明刻线数随之封顶）
    const cosI = Math.max(0.05, Math.abs(dot({ x: 1, y: 0 }, Nv)));
    footMm = (2 * BEAM_HALF_U * MM_PER_U) / cosI;
    blankTrunc = footMm > BLANK_U * MM_PER_U;
    nIll = Math.min(footMm, BLANK_U * MM_PER_U) / D_MM;
    const ha = hOf(1, LAM_C - 1, 0), hb = hOf(1, LAM_C + 1, 0);
    dispRadPerNm = ha !== null && hb !== null ? Math.abs(hb - ha) / 2 / F_CAM_U : 0;
    dispUmPerNm = dispRadPerNm * F_CAM_MM * 1000;
    dLamPix = dispUmPerNm > 0 ? (2 * PIX_UM) / dispUmPerNm : 0;
    const dw = ((slitUm / 1000 / MM_PER_U) * EXAG) / (2 * F_COL_U);
    const h0 = hOf(1, LAM_C, 0), hp = hOf(1, LAM_C, dw);
    reselU = h0 !== null && hp !== null ? Math.abs(hp - h0) : 0;
    const dhTrueU = (2 * reselU) / EXAG;
    slitImgUm = dhTrueU * MM_PER_U * 1000;
    dLamSlit = dispUmPerNm > 0 ? slitImgUm / dispUmPerNm : 0;
    dLamTot = Math.sqrt(dLamSlit * dLamSlit + dLamPix * dLamPix + Math.pow(LAM_C / nIll, 2));
    {
      const u: P2 = { x: 1, y: 0 };
      alphaDeg = Math.acos(Math.min(1, Math.abs(dot(u, Nv)))) * DEG;
      const v = dirOf(1, LAM_C, 0);
      if (v) betaDeg = Math.acos(Math.min(1, Math.abs(dot(v, Nv)))) * DEG;
    }
    // anamor 放大 = cosα/cosβ；狭缝像理论值 = w·(f_cam/f_col)·(cosα/cosβ)
    anamor = Math.cos(alphaDeg * RAD) / Math.max(0.05, Math.cos(betaDeg * RAD));
    // 调谐速率 = 光栅转过 ±0.5° 时线心在静止焦面上的真实位移（有限差分，含 (1+cosα/cosβ) 的法线转动项）
    setGrating(thetaN + 0.5);
    const hUp = hOf(1, LAM_C, 0);
    setGrating(thetaN - 0.5);
    const hDn = hOf(1, LAM_C, 0);
    setGrating(thetaN);
    const hCtr = hOf(1, LAM_C, 0);
    tuneMmPerDeg = hUp !== null && hDn !== null ? (hUp - hDn) * MM_PER_U : 0;
    hCurMm = hCtr !== null ? hCtr * MM_PER_U : 0;
    let inside = 0;
    for (let i = 0; i <= 100; i++) {
      const lam = LAM_LO + (i / 100) * (LAM_HI - LAM_LO);
      const h = hOf(1, lam, 0);
      if (h !== null && Math.abs(h) <= CCD_H_U) inside++;
    }
    m1OnCcd = inside / 101;
    let ov = 0;
    for (let i = 0; i <= 200; i++) {
      const h = (i / 200 - 0.5) * 2 * CCD_H_U;
      let c = 0;
      for (const m of [1, 2, 3]) if (lamOf(m, h) !== null) c++;
      if (c >= 2) ov++;
    }
    ovFrac = ov / 201;
  }

  // ============ 星空 + 网格 ============
  const starGeo = geo(new THREE.BufferGeometry());
  {
    const p = new Float32Array(460 * 3);
    for (let i = 0; i < 460; i++) {
      p[i * 3] = (Math.random() - 0.5) * 220;
      p[i * 3 + 1] = (Math.random() - 0.5) * 220;
      p[i * 3 + 2] = (Math.random() - 0.5) * 220;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  }
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry); mat(grid.material as unknown as { dispose(): void });
  grid.position.set(0.2, -3.4, 0);
  group.add(grid);

  // ============ 入射狭缝（刀口沿 z，缝宽沿 y = 色散方向） ============
  const slitGrp = new THREE.Group();
  slitGrp.position.set(SLIT.x, SLIT.y, 0);
  group.add(slitGrp);
  const jawGeo = geo(new THREE.BoxGeometry(0.14, 0.5, 0.6));
  const jawMat = mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.75, roughness: 0.35 }));
  const jawUp = new THREE.Mesh(jawGeo, jawMat);
  const jawDn = new THREE.Mesh(jawGeo, jawMat);
  slitGrp.add(jawUp, jawDn);

  // ============ 准直镜（球面弧） ============
  {
    const pts: import('three').Vector3[] = [];
    for (let i = 0; i <= 26; i++) {
      const a = -0.52 + (i / 26) * 1.04;
      pts.push(new THREE.Vector3(C_COL.x + R_COL_U * Math.cos(a), C_COL.y + R_COL_U * Math.sin(a), 0));
    }
    const mirror = new THREE.Mesh(
      geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 26, 0.07, 8, false)),
      mat(new THREE.MeshStandardMaterial({ color: 0xb9c7db, metalness: 0.85, roughness: 0.22 })),
    );
    group.add(mirror);
  }
  // 入射锥（狭缝 → 准直镜边缘）
  {
    const cg = geo(new THREE.BufferGeometry());
    const cv: number[] = [];
    for (const a of [-0.5, -0.25, 0, 0.25, 0.5]) {
      cv.push(SLIT.x, SLIT.y, 0, C_COL.x + R_COL_U * Math.cos(a), C_COL.y + R_COL_U * Math.sin(a), 0);
    }
    cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cv), 3));
    group.add(new THREE.LineSegments(cg, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.35 }))));
  }

  // ============ 光栅 ============
  const grating = new THREE.Group();
  grating.position.set(GRAT.x, GRAT.y, 0);
  group.add(grating);
  grating.add(new THREE.Mesh(
    geo(new THREE.BoxGeometry(BLANK_U, 0.07, 0.62)),
    mat(new THREE.MeshStandardMaterial({ color: 0x7dd3fc, metalness: 0.9, roughness: 0.25, transparent: true, opacity: 0.72 })),
  ));
  {
    const gg = geo(new THREE.BufferGeometry());
    const gv: number[] = [];
    for (let k = -24; k <= 24; k++) {
      const x = (k / 24) * (BLANK_U / 2) * 0.98;
      gv.push(x, 0.04, -0.3, x, 0.04, 0.3);
    }
    gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(gv), 3));
    grating.add(new THREE.LineSegments(gg, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.7 }))));
  }
  {
    const nm = new THREE.Mesh(
      geo(new THREE.CylinderGeometry(0.012, 0.012, 0.8, 6)),
      mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })),
    );
    nm.position.set(0, 0.42, 0);
    grating.add(nm);
  }

  // ============ 相机透镜 ============
  const lens = new THREE.Mesh(
    geo(new THREE.CylinderGeometry(1.0, 1.0, 0.055, 30)),
    mat(new THREE.MeshStandardMaterial({ color: 0x93c5fd, metalness: 0.25, roughness: 0.12, transparent: true, opacity: 0.3 })),
  );
  group.add(lens);

  // ============ 焦面：CCD + 延长线 ============
  const ccd = new THREE.Mesh(
    geo(new THREE.BoxGeometry(0.06, 2 * CCD_H_U, 2 * CCD_H_U)),
    mat(new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.4, roughness: 0.5, emissive: 0x0b1220, emissiveIntensity: 1 })),
  );
  group.add(ccd);
  const detCv = document.createElement('canvas');
  detCv.width = 512; detCv.height = 96;
  const detCtx = detCv.getContext('2d')!;
  const detTex = tex(new THREE.CanvasTexture(detCv));
  const ccdFace = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(2 * CCD_H_U, 2 * CCD_H_U)),
    mat(new THREE.MeshBasicMaterial({ map: detTex, side: THREE.DoubleSide })),
  );
  group.add(ccdFace);
  const extGeo = geo(new THREE.BufferGeometry());
  extGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  group.add(new THREE.Line(extGeo, mat(new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.45 }))));

  // ============ 光线追迹绘制 ============
  const LAMS = [250, 279.7, 313, 334.3, 374.5, 400, 486.1, 500.7, 550, 589, 656.3, 700, 760, 850, 900];
  const LINES_NM = [250, 279.7, 313, 334.3, 374.5, 486.1, 500.7, 550, 589, 656.3, 700, 900];
  const ORDERS = [1, 2, 3];
  const TILTS = [-1, 0, 1];
  const MAXSEG = LAMS.length * ORDERS.length * TILTS.length * 3 + 8;
  const rayGeo = geo(new THREE.BufferGeometry());
  rayGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXSEG * 6), 3));
  rayGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAXSEG * 6), 3));
  group.add(new THREE.LineSegments(rayGeo, mat(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8 }))));

  const NDOT = LAMS.length * ORDERS.length;
  const dotGeo = geo(new THREE.BufferGeometry());
  dotGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NDOT * 3), 3));
  dotGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NDOT * 3), 3));
  group.add(new THREE.Points(dotGeo, mat(new THREE.PointsMaterial({ vertexColors: true, size: 0.1, sizeAttenuation: true }))));

  function lamColor(lam: number): [number, number, number] {
    if (lam < 400) return [0.66, 0.45, 1.0];
    if (lam < 440) return [0.35, 0.28, 1.0];
    if (lam < 490) return [0.12, 0.5, 1.0];
    if (lam < 560) return [0.15, 0.95, 0.5];
    if (lam < 590) return [0.98, 0.86, 0.15];
    if (lam < 630) return [0.98, 0.45, 0.1];
    if (lam < 700) return [0.9, 0.12, 0.18];
    return [0.55, 0.08, 0.12];
  }

  function updateRays(): void {
    const pos = rayGeo.attributes['position'].array as Float32Array;
    const col = rayGeo.attributes['color'].array as Float32Array;
    const dpos = dotGeo.attributes['position'].array as Float32Array;
    const dcol = dotGeo.attributes['color'].array as Float32Array;
    const dwBase = ((slitUm / 1000 / MM_PER_U) * EXAG) / (2 * F_COL_U);
    let seg = 0, di = 0;
    hitOnCcd = 0; hitTotal = 0;
    for (const m of ORDERS) {
      const tint = m === 1 ? 1 : m === 2 ? 0.78 : 0.58;
      for (const lam of LAMS) {
        const c = lamColor(lam);
        for (const sgn of TILTS) {
          const tilt = sgn * dwBase;
          const v = dirOf(m, lam, tilt);
          const h = hOf(m, lam, tilt);
          if (!v || h === null) continue;
          hitTotal++;
          if (Math.abs(h) <= CCD_H_U) hitOnCcd++;
          // 狭缝 → 准直镜（入射点由该子光束的倾角决定）
          const yHit = SLIT.y + tilt * F_COL_U;
          const dy = yHit - C_COL.y;
          const xHit = C_COL.x + Math.sqrt(Math.max(0.0001, R_COL_U * R_COL_U - dy * dy));
          // 准直镜 → 光栅（平行 +x，与光栅面直线求交）
          const useL = Math.abs(Tv.y) > 1e-3 ? (yHit - GRAT.y) / Tv.y : 0;
          const gp = { x: GRAT.x + Tv.x * useL, y: GRAT.y + Tv.y * useL };
          // 光栅 → 透镜平面（法线 M0）→ 焦面点
          const den = dot(v, M0);
          if (Math.abs(den) < 0.12) continue;
          const tt = -dot({ x: gp.x - LENS.x, y: gp.y - LENS.y }, M0) / den;
          const lp = { x: gp.x + v.x * tt, y: gp.y + v.y * tt };
          const fp = { x: CCD_C.x + h * Eh.x, y: CCD_C.y + h * Eh.y };
          const put = (a: P2, b: P2): void => {
            if (seg >= MAXSEG) return;
            pos[seg * 6] = a.x; pos[seg * 6 + 1] = a.y; pos[seg * 6 + 2] = 0;
            pos[seg * 6 + 3] = b.x; pos[seg * 6 + 4] = b.y; pos[seg * 6 + 5] = 0;
            for (let k = 0; k < 2; k++) {
              col[seg * 6 + k * 3] = c[0] * tint;
              col[seg * 6 + k * 3 + 1] = c[1] * tint;
              col[seg * 6 + k * 3 + 2] = c[2] * tint;
            }
            seg++;
          };
          put({ x: SLIT.x + 0.07, y: SLIT.y }, { x: xHit, y: yHit });
          put({ x: xHit, y: yHit }, gp);
          put(lp, fp);
          if (sgn === 0 && di < NDOT) {
            dpos[di * 3] = fp.x; dpos[di * 3 + 1] = fp.y; dpos[di * 3 + 2] = 0;
            dcol[di * 3] = c[0]; dcol[di * 3 + 1] = c[1]; dcol[di * 3 + 2] = c[2];
            di++;
          }
        }
      }
    }
    for (let i = seg; i < MAXSEG; i++) for (let k = 0; k < 6; k++) pos[i * 6 + k] = 0;
    for (let i = di; i < NDOT; i++) { dpos[i * 3] = 0; dpos[i * 3 + 1] = -999; dpos[i * 3 + 2] = 0; }
    rayGeo.attributes['position'].needsUpdate = true;
    rayGeo.attributes['color'].needsUpdate = true;
    rayGeo.setDrawRange(0, seg * 2);
    dotGeo.attributes['position'].needsUpdate = true;
    dotGeo.attributes['color'].needsUpdate = true;
    dotGeo.setDrawRange(0, di);
  }

  // ============ 方位与姿态 ============
  function placeOptics(): void {
    grating.rotation.z = (thetaN - 90) * RAD;
    lens.position.set(LENS.x, LENS.y, 0);
    lens.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(M0.x, M0.y, 0));
    ccd.position.set(CCD_C.x, CCD_C.y, 0);
    const bb = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(M0.x, M0.y, 0),
      new THREE.Vector3(Eh.x, Eh.y, 0),
      new THREE.Vector3(0, 0, 1),
    );
    ccd.quaternion.setFromRotationMatrix(bb);
    ccdFace.position.set(CCD_C.x - M0.x * 0.04, CCD_C.y - M0.y * 0.04, 0);
    const bf = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(Eh.x, Eh.y, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(M0.x, M0.y, 0),
    );
    ccdFace.quaternion.setFromRotationMatrix(bf);
    const ep = extGeo.attributes['position'].array as Float32Array;
    ep[0] = CCD_C.x - Eh.x * 1.55; ep[1] = CCD_C.y - Eh.y * 1.55; ep[2] = 0;
    ep[3] = CCD_C.x + Eh.x * 1.55; ep[4] = CCD_C.y + Eh.y * 1.55; ep[5] = 0;
    extGeo.attributes['position'].needsUpdate = true;
    const gapU = Math.max(0.006, (slitUm / 1000 / MM_PER_U) * EXAG);
    jawUp.position.set(0, 0.25 + gapU / 2, 0);
    jawDn.position.set(0, -0.25 - gapU / 2, 0);
  }

  // ============ CCD 像素图（与光线追迹同源） ============
  function drawDetector(): void {
    detCtx.clearRect(0, 0, 512, 96);
    detCtx.fillStyle = '#0b1220';
    detCtx.fillRect(0, 0, 512, 96);
    const sigNm = Math.max(dLamTot, 0.03);
    for (let i = 0; i < 512; i++) {
      const h = (i / 511 - 0.5) * 2 * CCD_H_U;
      let flux = 0, ord = 0;
      for (const m of ORDERS) {
        const lam = lamOf(m, h);
        if (lam === null) continue;
        ord++;
        let f = 0.22 * Math.exp(-Math.pow((m - 2) * 0.5, 2)) * (1 + 0.5 * Math.sin((lam - LAM_LO) / 42));
        for (const l0 of LINES_NM) {
          f += 0.42 * Math.exp(-Math.pow((lam - l0) / sigNm, 2));
        }
        flux += f;
      }
      if (ord === 0) {
        detCtx.fillStyle = 'rgba(15,23,42,1)';
      } else if (ord >= 2) {
        detCtx.fillStyle = `rgba(244,114,182,${Math.min(1, 0.3 + 0.5 * flux).toFixed(3)})`;
      } else {
        const c = lamColor(prodOfH(h));
        const b = Math.min(1, 0.12 + 1.1 * flux);
        detCtx.fillStyle = `rgba(${Math.round(c[0] * 255 * b + 12)},${Math.round(c[1] * 255 * b + 14)},${Math.round(c[2] * 255 * b + 24)},1)`;
      }
      detCtx.fillRect(i, 0, 1, 96);
    }
    detTex.needsUpdate = true;
  }

  // ============ 数据图（flux vs 像元，分级次） ============
  const plotCv = document.createElement('canvas');
  plotCv.width = 900; plotCv.height = 380;
  const plotCtx = plotCv.getContext('2d')!;
  const plotTex = tex(new THREE.CanvasTexture(plotCv));
  const plotPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(5.0, 2.11)),
    mat(new THREE.MeshBasicMaterial({ map: plotTex, transparent: true, depthTest: false })),
  );
  plotPlane.renderOrder = 998;
  plotPlane.position.set(3.05, 2.25, -0.2);
  group.add(plotPlane);

  const COLM: Record<number, string> = { 1: '#22d3ee', 2: '#a855f7', 3: '#22c55e' };
  function drawPlot(): void {
    plotCtx.clearRect(0, 0, 900, 380);
    plotCtx.fillStyle = 'rgba(7,11,20,0.84)';
    plotCtx.fillRect(0, 0, 900, 380);
    plotCtx.strokeStyle = '#334155'; plotCtx.lineWidth = 3; plotCtx.strokeRect(2, 2, 896, 376);
    const X0 = 34, X1 = 866, Y0 = 236, Y1 = 46;
    const px = (h: number): number => X0 + (h / (2 * CCD_H_U) + 0.5) * (X1 - X0);
    const sigNm = Math.max(dLamTot, 0.03);
    // 级次覆盖区
    for (const m of ORDERS) {
      const a = hOf(m, LAM_LO, 0), b = hOf(m, LAM_HI, 0);
      if (a === null || b === null) continue;
      const xa = Math.max(X0, px(Math.min(a, b))), xb = Math.min(X1, px(Math.max(a, b)));
      if (xb <= xa) continue;
      plotCtx.fillStyle = 'rgba(148,163,184,0.16)';
      plotCtx.fillRect(xa, Y1 - 2, xb - xa, Y0 - Y1 + 2);
      plotCtx.fillStyle = COLM[m];
      plotCtx.font = 'bold 20px "PingFang SC", sans-serif';
      plotCtx.fillText(`m=${m}`, (xa + xb) / 2 - 16, Y1 - 8);
    }
    plotCtx.strokeStyle = '#475569'; plotCtx.lineWidth = 1.5;
    plotCtx.beginPath(); plotCtx.moveTo(X0, Y0); plotCtx.lineTo(X1, Y0); plotCtx.stroke();
    for (const m of ORDERS) {
      plotCtx.strokeStyle = COLM[m]; plotCtx.lineWidth = 2.4;
      plotCtx.beginPath();
      let started = false;
      for (let i = 0; i <= 820; i++) {
        const h = (i / 820 - 0.5) * 2 * CCD_H_U;
        const lam = lamOf(m, h);
        if (lam === null) { started = false; continue; }
        let f = 0.2 * Math.exp(-Math.pow((m - 2) * 0.5, 2));
        for (const l0 of LINES_NM) f += 0.4 * Math.exp(-Math.pow((lam - l0) / sigNm, 2));
        const y = Y0 - Math.min(1, f / 1.5) * (Y0 - Y1);
        if (!started) { plotCtx.moveTo(px(h), y); started = true; } else plotCtx.lineTo(px(h), y);
      }
      plotCtx.stroke();
    }
    // CCD 边界 + 分辨元
    plotCtx.strokeStyle = '#f8fafc'; plotCtx.lineWidth = 2;
    plotCtx.beginPath();
    plotCtx.moveTo(px(-CCD_H_U), Y1 - 4); plotCtx.lineTo(px(-CCD_H_U), Y0 + 10);
    plotCtx.moveTo(px(CCD_H_U), Y1 - 4); plotCtx.lineTo(px(CCD_H_U), Y0 + 10);
    plotCtx.stroke();
    const h0 = hOf(1, LAM_C, 0) ?? 0;
    plotCtx.strokeStyle = '#fbbf24'; plotCtx.lineWidth = 3.5;
    plotCtx.beginPath();
    plotCtx.moveTo(px(h0 - reselU), Y0 + 30); plotCtx.lineTo(px(h0 + reselU), Y0 + 30);
    plotCtx.moveTo(px(h0 - reselU), Y0 + 22); plotCtx.lineTo(px(h0 - reselU), Y0 + 38);
    plotCtx.moveTo(px(h0 + reselU), Y0 + 22); plotCtx.lineTo(px(h0 + reselU), Y0 + 38);
    plotCtx.stroke();
    plotCtx.font = '20px "PingFang SC", sans-serif';
    plotCtx.fillStyle = '#fbbf24';
    plotCtx.fillText(`狭缝像（绘出 ×${EXAG}）`, px(h0) - 52, Y0 + 58);
    plotCtx.fillStyle = '#f8fafc';
    plotCtx.fillText(`白框 = CCD ±${CCD_H_MM.toFixed(1)} mm`, X0 + 4, Y0 + 58);
    plotCtx.fillStyle = '#f472b6';
    plotCtx.textAlign = 'right';
    plotCtx.fillText(`重叠像元 ${(ovFrac * 100).toFixed(0)}%`, X1, Y0 + 58);
    plotCtx.textAlign = 'left';
    plotCtx.fillStyle = '#94a3b8';
    plotCtx.fillText(`横轴 = 焦面位置（乘积 mλ 单值）；Δλ_inst = ${dLamTot.toFixed(3)} nm ⇒ R = ${(LAM_C / dLamTot).toFixed(0)}`, X0, Y0 + 92);
    plotCtx.fillStyle = '#f8fafc'; plotCtx.font = 'bold 22px "PingFang SC", sans-serif';
    plotCtx.fillText('焦面数据：各级谱线在同一位置叠压（自由光谱范围 λ/m）', X0, 26);
    plotTex.needsUpdate = true;
  }

  // ============ 标签 ============
  function makeLabel(text: string, color: string, w: number, x: number, y: number, z: number): void {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 25px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(w, w / 8, 1);
    s.position.set(x, y, z);
    group.add(s);
  }
  makeLabel('入射狭缝 w（扫描）', '#fbbf24', 2.7, SLIT.x - 0.15, SLIT.y - 0.95, 0);
  makeLabel('准直镜 R=264 mm', '#94a3b8', 2.4, C_COL.x - 0.35, SLIT.y + 1.45, 0);
  makeLabel('衍射光栅 300 线/mm', '#22d3ee', 2.9, GRAT.x - 0.5, GRAT.y - 0.95, 0);
  makeLabel('相机 f=144 mm', '#93c5fd', 2.2, LENS.x + 1.0, LENS.y + 0.15, 0);
  makeLabel('焦面 CCD 4096×4096', '#f8fafc', 2.4, CCD_C.x - 1.05, CCD_C.y + 0.85, 0);

  // ============ 顶部面板 ============
  const infoCv = document.createElement('canvas');
  infoCv.width = 900; infoCv.height = 300;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.6, 3.2)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.renderOrder = 999;
  infoPlane.position.set(-2.1, 5.45, 0);
  group.add(infoPlane);

  const ln = (y: number, color: string, text: string, bold = false, size = 25): void => {
    infoCtx.fillStyle = color;
    infoCtx.font = `${bold ? 'bold ' : ''}${size}px "PingFang SC", sans-serif`;
    infoCtx.fillText(text, 20, y);
  };
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 900, 300);
    infoCtx.fillStyle = 'rgba(7,11,20,0.86)';
    infoCtx.fillRect(4, 4, 892, 292);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 892, 292);
    infoCtx.textAlign = 'left';

    ln(38, '#f8fafc', '观测光谱仪 —— mλ = d(sinα+sinβ)、dθ/dλ = m/(d·cosβ)、FSR = λ/m', true, 26);
    ln(70, '#22d3ee', `α=${alphaDeg.toFixed(1)}° β=${betaDeg.toFixed(1)}° ⇒ dθ/dλ=${dispRadPerNm.toFixed(5)} rad/nm ⇒ 线色散 ${dispUmPerNm.toFixed(1)} μm/nm ⇒ ${dLamPix.toFixed(3)} nm/2px`);
    ln(100, '#a855f7', `同一位置 = 同一 mλ：m=2 的 ${(LAM_C / 2).toFixed(0)} nm 与 m=1 的 ${LAM_C} nm 严格重合 ⇒ 重叠像元 ${(ovFrac * 100).toFixed(0)}%（需滤光片或交叉色散）`);
    ln(130, '#22c55e', `狭缝像 = w·(f_cam/f_col)·(cosα/cosβ) = ${slitUm.toFixed(0)}×1.091×${anamor.toFixed(2)} = ${slitImgUm.toFixed(1)} μm ⇒ Δλ_slit = ${dLamSlit.toFixed(3)} nm`);
    ln(160, '#fbbf24', `照明投影 直径/|cos i| = ${footMm.toFixed(0)} mm，坯料 ${(BLANK_U * MM_PER_U).toFixed(0)} mm${blankTrunc ? ' ⇒ 投影被裁切' : ' ⇒ 容得下'} ⇒ N=${nIll.toFixed(0)} 条，R=m·N=${nIll.toFixed(0)}/${(2 * nIll).toFixed(0)}/${(3 * nIll).toFixed(0)}`);
    ln(188, '#94a3b8', `实测 Δλ = ${dLamTot.toFixed(3)} nm ⇒ R = ${(LAM_C / dLamTot).toFixed(0)}；势分辨 ${(LAM_C / (LAM_C / nIll)).toFixed(0)} 远大于此 ⇒ 本仪器受狭缝而非光栅孔径限制`, false, 22);

    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 25px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：θ_n=${thetaN.toFixed(2)}°  w=${slitUm.toFixed(0)} μm  吞吐∝w²=${Math.pow(slitUm / 25, 2).toFixed(2)}×  调谐：线心平移 ${hCurMm.toFixed(1)} mm（每转 1° = ${tuneMmPerDeg.toFixed(2)} mm）`,
      20, 214,
    );
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '21px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `真实等比缩放 1 unit = ${MM_PER_U} mm：d=${(D_NM / 1000).toFixed(3)} μm、f_coll=${F_COL_MM} mm、f_cam=${F_CAM_MM} mm、CCD ${N_PIX}²×${PIX_UM} μm = ±${CCD_H_MM.toFixed(1)} mm。`,
      20, 246,
    );
    infoCtx.fillText(
      `狭缝与其像按 ×${EXAG} 放大绘制（真实仅 ${((slitUm / 1000 / MM_PER_U)).toFixed(4)} unit）；${(m1OnCcd * 100).toFixed(0)}% 的 1 级波段落在探测器上。`,
      20, 278,
    );
    infoTex.needsUpdate = true;
  }

  computeState();
  placeOptics();
  updateRays();
  drawDetector();
  drawPlot();
  drawInfo();

  let frame = 0;
  return {
    update(t, dt) {
      // 自变量 1：光栅转角 ±6°，周期 16 s（调谐通过带）
      thetaN = THETA_N0 + 6 * Math.sin(((t % 16) / 16) * TWO_PI);
      // 自变量 2：狭缝宽度 10→120 μm，周期 12 s（分辨率 vs 吞吐量）
      slitUm = 65 - 55 * Math.cos(((t % 12) / 12) * TWO_PI);
      computeState();
      frame++;
      if (frame % 2 === 0) {
        placeOptics();
        updateRays();
      }
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) {
        drawInfo();
        drawPlot();
        drawDetector();
      }
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
