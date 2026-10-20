import type { SceneContext, SceneInstance } from '../types';
/** 跃迁选择定则（P157）：主控方程
 *  ① 电偶极(E1)：Δl = ±1，Δm = 0, ±1；宇称必须改变 π_i·π_f = (−1)^{li+lf} = −1
 *     —— Δl=0 或 s→s 时偶极矩算符 r̂（奇宇称）在同号宇称态间积分对称抵消 ⇒ 谱线灰
 *  ② 线强度 ∝ |⟨li mi; 1 q | lf mf⟩|²（CG 系数，由 Wigner 3j Racah 公式现算；m 求和规则 mi+q−mf=0 ⇒ q=mf−mi）
 *  ③ 角动量守恒：mi = mf + m_γ，光子带走 1·ħ（m_γ=−q）—— q=0 为 π 线（沿量子化轴看无线），q=∓1 对应 σ± 圆偏振（旋向相反）
 *  ④ 氢原子能级 ΔE = 13.6(1/n_f² − 1/n_i²) eV ⇒ λ = 1239.84/ΔE nm（Balmer 系画在光谱列）
 *  画面：上下两片 |Y_lm|² 轨道花瓣（旋转面，标注 l/m/宇称），跃迁时中部射出带偏振结构的光子波列；
 *  右侧光谱列上允许线点亮（强度∝CG²）、禁戒线灰色打叉。16 s 内切换 8 组跃迁（含 4 组禁戒）。 */
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

  const DEG = 180 / Math.PI; void DEG;
  const PI2 = Math.PI * 2;
  const FAC: number[] = [1];
  for (let i = 1; i <= 30; i++) FAC.push(FAC[i - 1] * i);

  // —— 缔合勒让德（只用到 |P|，绝对值 ⇒ 无 Condon–Shortley 之忧） ——
  function plm(l: number, m: number, x: number): number {
    const s = Math.sqrt(Math.max(0, 1 - x * x));
    if (m === l) { let p = 1; for (let k = 1; k <= l; k++) p *= (2 * k - 1) * s; return p; }
    if (l === m + 1) return x * (2 * m + 1) * plm(m, m, x);
    let prev2 = plm(m, m, x), prev1 = plm(m + 1, m, x);
    for (let ll = m + 2; ll <= l; ll++) {
      const cur = ((2 * ll - 1) * x * prev1 - (ll + m - 1) * prev2) / (ll - m);
      prev2 = prev1; prev1 = cur;
    }
    return prev1;
  }
  // —— Wigner 3j → CG² 强度 ——
  function wigner3j(j1: number, j2: number, j3: number, m1: number, m2: number, m3: number): number {
    if (m1 + m2 + m3 !== 0 || j3 < Math.abs(j1 - j2) || j3 > j1 + j2) return 0;
    if (Math.abs(m1) > j1 || Math.abs(m2) > j2 || Math.abs(m3) > j3) return 0;
    const t0 = (FAC[j1 + j2 - j3] * FAC[j1 - j2 + j3] * FAC[-j1 + j2 + j3]) / FAC[j1 + j2 + j3 + 1];
    const t1 = FAC[j1 + m1] * FAC[j1 - m1] * FAC[j2 + m2] * FAC[j2 - m2] * FAC[j3 + m3] * FAC[j3 - m3];
    let sum = 0;
    const zmin = Math.max(0, j2 - j3 - m1, j1 - j3 + m2);
    const zmax = Math.min(j1 + j2 - j3, j1 - m1, j2 + m2);
    for (let z = zmin; z <= zmax; z++) {
      const den = FAC[z] * FAC[j1 + j2 - j3 - z] * FAC[j1 - m1 - z] * FAC[j2 + m2 - z] * FAC[j3 - j2 + m1 + z] * FAC[j3 - j1 - m2 + z];
      sum += (z % 2 ? -1 : 1) / den;
    }
    return ((j1 - j2 - m3) % 2 ? -1 : 1) * Math.sqrt(t0 * t1) * sum;
  }
  const cg2 = (li: number, mi: number, lf: number, mf: number, q: number): number => {
    const t = wigner3j(li, 1, lf, mi, q, -mf);
    return (2 * lf + 1) * t * t;
  };

  // —— 轨道花瓣：|Y_lm|² 轴对称 ⇒ 剖面绕量子化轴(ŷ)旋转 ——
  function orbSurface(l: number, m: number, color: number): import('three').Mesh {
    const T = 41, P = 36;
    const g = geo(new THREE.BufferGeometry());
    const pos = new Float32Array((T + 1) * (P + 1) * 3), col = new Float32Array((T + 1) * (P + 1) * 3);
    let mx = 0;
    for (let i = 0; i <= T; i++) { const th = (i / T) * Math.PI; const p = Math.abs(plm(l, m, Math.cos(th))); if (p > mx) mx = p; }
    for (let i = 0; i <= T; i++) {
      const th = (i / T) * Math.PI;
      const f = Math.abs(plm(l, m, Math.cos(th))) / (mx || 1);
      const R = 0.12 + 1.05 * f * f;
      const rr = R * Math.sin(th), yy = R * Math.cos(th);
      for (let k = 0; k <= P; k++) {
        const ph = (k / P) * PI2;
        const v = i * (P + 1) + k;
        pos[v * 3] = rr * Math.cos(ph); pos[v * 3 + 1] = yy; pos[v * 3 + 2] = rr * Math.sin(ph);
        const s = f;
        col[v * 3] = ((color >> 16) & 255) / 255 * (0.35 + 0.65 * s);
        col[v * 3 + 1] = ((color >> 8) & 255) / 255 * (0.35 + 0.65 * s);
        col[v * 3 + 2] = (color & 255) / 255 * (0.35 + 0.65 * s);
      }
    }
    const index: number[] = [];
    for (let i = 0; i < T; i++) for (let k = 0; k < P; k++) {
      const a0 = i * (P + 1) + k, b0 = a0 + P + 1;
      index.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1);
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(index);
    const mesh = new THREE.Mesh(g, mat(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false })));
    return mesh;
  }
  const ORBS: Record<string, import('three').Mesh> = {};
  for (const [l, m] of [[0, 0], [1, 0], [1, 1], [2, 0], [2, 1], [2, 2]] as [number, number][]) {
    const col = m === 0 ? 0x22d3ee : m === 1 ? 0xa855f7 : 0xf472b6;
    ORBS[`${l},${m}`] = orbSurface(l, m, col);
    group.add(ORBS[`${l},${m}`]);
    ORBS[`${l},${m}`].visible = false;
  }
  const UP = new THREE.Vector3(-1.15, 2.0, 0), DN = new THREE.Vector3(1.75, -0.55, 0);

  // —— 量子化轴 + 跳迁箭头 ——
  const qAxis = geo(new THREE.BufferGeometry());
  qAxis.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 3.6, 0, 0, -2.2, 0]), 3));
  const qAxisLine = new THREE.Line(qAxis, mat(new THREE.LineDashedMaterial({ color: 0x475569, dashSize: 0.14, gapSize: 0.12, transparent: true, opacity: 0.7 })));
  group.add(qAxisLine);
  const trGeo = geo(new THREE.BufferGeometry());
  trGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
  const trMat = mat(new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.9 }));
  group.add(new THREE.Line(trGeo, trMat));
  // 光子波列
  const PH = 160;
  const phGeo = geo(new THREE.BufferGeometry());
  phGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PH * 3), 3));
  const phMat = mat(new THREE.LineBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.95 }));
  const phLine = new THREE.Line(phGeo, phMat);
  group.add(phLine);
  const phGrayGeo = geo(new THREE.BufferGeometry());
  phGrayGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
  const phGray = new THREE.Line(phGrayGeo, mat(new THREE.LineDashedMaterial({ color: 0x64748b, dashSize: 0.1, gapSize: 0.08, transparent: true, opacity: 0.9 })));
  group.add(phGray);

  // —— 能级梯（左）——
  const lvlGeo = geo(new THREE.BufferGeometry());
  {
    const pts: number[] = [];
    for (const n of [1, 2, 3]) {
      const y = ((-13.6 / (n * n)) / 13.6) * 3.4 + 2.0;
      pts.push(-4.6, y, 0, -3.4, y, 0);
    }
    lvlGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  }
  group.add(new THREE.LineSegments(lvlGeo, mat(new THREE.LineBasicMaterial({ color: 0x94a3b8 }))));
  const lvlArrow = geo(new THREE.BufferGeometry());
  lvlArrow.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
  group.add(new THREE.Line(lvlArrow, mat(new THREE.LineBasicMaterial({ color: 0xef4444 }))));

  // —— 光谱列面板 ——
  const spCv = document.createElement('canvas');
  spCv.width = 256; spCv.height = 420;
  const spCtx = spCv.getContext('2d')!;
  const spTex = tex(new THREE.CanvasTexture(spCv));
  const spPlane = new THREE.Mesh(geo(new THREE.PlaneGeometry(1.35, 2.2)), mat(new THREE.MeshBasicMaterial({ map: spTex, transparent: true })));
  spPlane.position.set(4.5, 1.2, -0.6);
  group.add(spPlane);
  const RYD = 1.09678e-2;                       // nm⁻¹
  const lamOf = (ni: number): number => 1 / (RYD * (1 / 4 - 1 / (ni * ni)));   // Balmer
  function wlColor(nm: number): [number, number, number] {
    if (nm < 440) return [1, (nm - 380) / 60 * 0.2, 0.9];
    if (nm < 500) return [(500 - nm) / 60 * 0.5, (nm - 440) / 60, 1];
    if (nm < 580) return [(nm - 500) / 80, 1, (580 - nm) / 80 * 0.6];
    if (nm < 645) return [1, (645 - nm) / 65, 0.15];
    return [1, 0.1, 0.1];
  }
  function drawSpectrum(cur: { ni: number; nf: number; on: boolean; strength: number }): void {
    spCtx.clearRect(0, 0, 256, 420);
    spCtx.fillStyle = 'rgba(7,11,20,0.88)'; spCtx.fillRect(0, 0, 256, 420);
    spCtx.strokeStyle = '#334155'; spCtx.lineWidth = 2; spCtx.strokeRect(2, 2, 252, 416);
    spCtx.fillStyle = '#94a3b8'; spCtx.font = '18px "PingFang SC", sans-serif';
    spCtx.fillText('Balmer 系（现算 λ）', 40, 26);
    for (const ni of [3, 4, 5, 6, 7]) {
      const nm = lamOf(ni);
      const x = 24 + (nm - 400) / (700 - 400) * 208;
      const isCur = ni === cur.ni && cur.nf === 2;
      const [r, g, b] = wlColor(nm);
      if (isCur && cur.on) {
        spCtx.strokeStyle = `rgba(${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0},${(0.35 + 0.65 * cur.strength / 0.6).toFixed(2)})`;
        spCtx.lineWidth = 4;
      } else if (isCur) {
        spCtx.strokeStyle = 'rgba(100,116,139,0.85)'; spCtx.lineWidth = 2;
      } else { spCtx.strokeStyle = 'rgba(148,163,184,0.3)'; spCtx.lineWidth = 2; }
      spCtx.beginPath(); spCtx.moveTo(x, 60); spCtx.lineTo(x, 330); spCtx.stroke();
      spCtx.fillStyle = isCur ? '#f8fafc' : '#64748b';
      spCtx.font = '16px sans-serif';
      spCtx.save(); spCtx.translate(x - 4, 348); spCtx.rotate(-Math.PI / 2.6);
      spCtx.fillText(`${ni}→2 ${nm.toFixed(0)}nm`, 0, 0); spCtx.restore();
      if (isCur && !cur.on) { spCtx.strokeStyle = '#ef4444'; spCtx.lineWidth = 3; spCtx.beginPath(); spCtx.moveTo(x - 9, 90); spCtx.lineTo(x + 9, 108); spCtx.moveTo(x + 9, 90); spCtx.lineTo(x - 9, 108); spCtx.stroke(); }
    }
    spTex.needsUpdate = true;
  }

  // —— 量子数动态标签（同一面板纹理） ——
  const tagCv = document.createElement('canvas');
  tagCv.width = 512; tagCv.height = 96;
  const tagCtx = tagCv.getContext('2d')!;
  const tagTex = tex(new THREE.CanvasTexture(tagCv));
  const tagPlane = new THREE.Mesh(geo(new THREE.PlaneGeometry(3.6, 0.68)), mat(new THREE.MeshBasicMaterial({ map: tagTex, transparent: true })));
  tagPlane.position.set(0.3, 3.85, 0.5);
  group.add(tagPlane);

  // —— 主面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 860; infoCv.height = 250;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.0, 2.61)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 5.7, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  interface Tr { ni: number; li: number; mi: number; nf: number; lf: number; mf: number }
  const TRANSS: Tr[] = [
    { ni: 3, li: 2, mi: 0, nf: 2, lf: 1, mf: 0 },   // d→p π 允许
    { ni: 3, li: 2, mi: 1, nf: 2, lf: 1, mf: 0 },   // σ+
    { ni: 3, li: 2, mi: 0, nf: 2, lf: 1, mf: 1 },   // σ−
    { ni: 3, li: 1, mi: 0, nf: 2, lf: 1, mf: 0 },   // Δl=0 禁
    { ni: 3, li: 0, mi: 0, nf: 2, lf: 0, mf: 0 },   // s→s 禁
    { ni: 3, li: 2, mi: 0, nf: 2, lf: 0, mf: 0 },   // Δl=2 禁
    { ni: 3, li: 1, mi: 0, nf: 2, lf: 0, mf: 0 },   // p→s 允许
    { ni: 3, li: 2, mi: 2, nf: 2, lf: 1, mf: 1 },   // d→p σ+ 强
  ];
  let curTxt = '', allowTxt = '';
  function drawInfo(cur: Tr, ok: boolean, st: number, q: number, dE: number): void {
    infoCtx.clearRect(0, 0, 860, 250);
    infoCtx.fillStyle = 'rgba(7,11,20,0.86)';
    infoCtx.fillRect(4, 4, 852, 242);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 852, 242);
    infoCtx.textAlign = 'left';
    const ln = (y: number, c: string, s: string, bold = false, sz = 26): void => {
      infoCtx.fillStyle = c; infoCtx.font = `${bold ? 'bold ' : ''}${sz}px "PingFang SC", sans-serif`;
      infoCtx.fillText(s, 22, y);
    };
    ln(40, '#f8fafc', 'E1 选择定则：Δl=±1，Δm=0,±1；宇称必变', true);
    ln(78, '#22d3ee', '强度 ∝ |⟨lᵢmᵢ;1q|l_f m_f⟩|²（3j 现算）');
    ln(112, '#a855f7', 'Δl=0 ⇒ ∫ψ_f* r̂ ψ_i 奇偶对称抵消 ⇒ 谱线灰');
    ln(146, '#22c55e', `氢 ΔE=13.6(1/${cur.nf}²−1/${cur.ni}²)=${dE.toFixed(3)} eV ⇒ λ=${(1239.84 / dE).toFixed(1)} nm`);
    ln(180, '#fbbf24', `读数：${cur.li === 0 ? 's' : cur.li === 1 ? 'p' : 'd'}(m=${cur.mi}) → ${cur.lf === 0 ? 's' : cur.lf === 1 ? 'p' : 'd'}(m=${cur.mf})  Δl=${cur.lf - cur.li} Δm=${q}  CG²=${st.toFixed(3)}`, true, 23);
    ln(212, ok ? '#22c55e' : '#ef4444', ok ? `允许：光子带走 1ħ（m_γ=${-q}），q=${q} ⇒ ${q === 0 ? 'π 线（线偏振）' : `σ${q < 0 ? '+' : '−'} 圆偏振`}` : '禁戒：偶极矩为零，谱线灰（打叉）', false, 23);
    infoTex.needsUpdate = true;
    tagCtx.clearRect(0, 0, 512, 96);
    tagCtx.fillStyle = 'rgba(7,11,20,0.7)'; tagCtx.fillRect(0, 0, 512, 96);
    tagCtx.font = 'bold 30px "PingFang SC", sans-serif';
    tagCtx.fillStyle = '#22d3ee'; tagCtx.fillText(curTxt, 12, 36);
    tagCtx.fillStyle = ok ? '#22c55e' : '#ef4444'; tagCtx.fillText(allowTxt, 12, 78);
    tagTex.needsUpdate = true;
  }

  function applyTr(ti: number, t: number): void {
    const c = TRANSS[ti];
    const q = c.mf - c.mi;                                // 3j m 求和规则 mi+q−mf=0 ⇒ q=mf−mi
    const ok = Math.abs(c.li - c.lf) === 1 && Math.abs(q) <= 1;
    const st = cg2(c.li, c.mi, c.lf, c.mf, q);
    const dE = 13.6 * (1 / (c.nf * c.nf) - 1 / (c.ni * c.ni));
    const nm = 1239.84 / dE;
    curTxt = `上:${c.ni}${'spd'[c.li]} m=${c.mi} π=(-1)^${c.li}  下:${c.nf}${'spd'[c.lf]} m=${c.mf} π=(-1)^${c.lf}`;
    allowTxt = ok ? `允许 Δl=${c.lf - c.li} Δm=${q} 强度 CG²=${st.toFixed(2)}` : `禁戒 Δl=${c.lf - c.li} Δm=${q} CG²=0`;
    const upMesh = ORBS[`${c.li},${Math.min(c.mi, c.li)}`], dnMesh = ORBS[`${c.lf},${Math.min(c.mf, c.lf)}`];
    for (const k in ORBS) ORBS[k].visible = false;
    upMesh.visible = true; dnMesh.visible = true;
    const pulse = 1 + 0.16 * Math.sin(t * 3.4);
    upMesh.position.copy(UP).multiplyScalar(1); upMesh.scale.setScalar(pulse * 1.15);
    dnMesh.position.copy(DN); dnMesh.scale.setScalar(pulse);
    const trArr = trGeo.attributes['position'].array as Float32Array;
    trArr[0] = UP.x + 0.4; trArr[1] = UP.y - 0.7; trArr[2] = 0;
    trArr[3] = DN.x - 0.2; trArr[4] = DN.y + 0.8; trArr[5] = 0;
    trGeo.attributes['position'].needsUpdate = true;
    trMat.color.setHex(ok ? 0xfbbf24 : 0x64748b);
    trMat.opacity = ok ? 0.5 + st : 0.5;
    // 能级梯箭头
    const yN = (n: number): number => ((-13.6 / (n * n)) / 13.6) * 3.4 + 2.0;
    const la = lvlArrow.attributes['position'].array as Float32Array;
    la[0] = -4.0; la[1] = yN(c.ni); la[2] = 0; la[3] = -4.0; la[4] = yN(c.nf); la[5] = 0;
    lvlArrow.attributes['position'].needsUpdate = true;
    // 光子波列
    const mid = new THREE.Vector3().addVectors(UP, DN).multiplyScalar(0.5);
    const dir = new THREE.Vector3(0.15, -0.1, 1).normalize();
    const u1 = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const u2 = new THREE.Vector3().crossVectors(dir, u1).normalize();
    const L = 2.3;
    const pa = phGeo.attributes['position'].array as Float32Array;
    const [r, g, b] = wlColor(Math.min(700, Math.max(400, nm)));
    phMat.color.setRGB(r, g, b);
    if (ok) {
      for (let k = 0; k < PH; k++) {
        const s = (k / (PH - 1)) * L, ks = s * 7.2 - t * 5;
        const a = 0.14 * (0.4 + Math.min(1, st) * 0.8);
        const o1 = q === 0 ? a * Math.sin(ks) : a * Math.cos(ks);
        const o2 = q === 0 ? 0 : a * Math.sin(-q * ks);   // 旋向由光子投影 m_γ=−q 决定
        const p = mid.clone().addScaledVector(dir, s).addScaledVector(u1, o1).addScaledVector(u2, o2);
        pa[k * 3] = p.x; pa[k * 3 + 1] = p.y; pa[k * 3 + 2] = p.z;
      }
      phGeo.attributes['position'].needsUpdate = true;
      phLine.visible = true; phGray.visible = false;
      phGeo.setDrawRange(0, PH);
    } else {
      phLine.visible = false;
      const ga = phGrayGeo.attributes['position'].array as Float32Array;
      ga[0] = mid.x; ga[1] = mid.y; ga[2] = mid.z;
      ga[3] = mid.x + dir.x * L; ga[4] = mid.y + dir.y * L; ga[5] = mid.z + dir.z * L;
      phGrayGeo.attributes['position'].needsUpdate = true;
      phGray.computeLineDistances();
      phGray.visible = true;
    }
    drawSpectrum({ ni: c.ni, nf: c.nf, on: ok, strength: st });
    drawInfo(c, ok, st, q, dE);
  }

  let lastIdx = -1;
  function update(t: number, dt: number): void {
    const u = (t % 16) / 16;
    const ti = Math.floor(u * 8) % 8;
    if (ti !== lastIdx) { lastIdx = ti; applyTr(ti, t); }
    else if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) applyTr(ti, t);  // 5 Hz 刷新动画相位与读数
  }
  qAxisLine.computeLineDistances();

  applyTr(0, 0);

  return {
    update,
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
