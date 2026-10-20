import type { SceneContext, SceneInstance } from '../types';
/** 贝塞尔函数与圆柱问题（P538）：主控方程
 *  ① 圆膜（半径 a）波动方程分离变量 ⇒ 本征模 w(r,θ,t) = J_n(j_{n,m}·r/a)·cos(nθ)·sin(ω t)，ω ∝ j_{n,m}
 *     J_n 用升幂级数 J_n(x)=Σ(−1)^k(x/2)^{2k+n}/(k!(k+n)!) 现算，零点 j_{n,m} 用二分法从现算函数求根得到
 *     （非抄表：2.4048/5.5201/3.8317… 均为运行期算出）节圆数 = m−1，节直径数 = n
 *  ② 光纤标量 HE11 模：芯内 E=J_0(u·r/a)，包层 E=J_0(u)·K_0(w·r/a)/K_0(w)（倏逝），u²+w²=V²，
 *     本征方程 u·J₁(u)/J₀(u) = w·K₁(w)/K₀(w)；V 数随 16 s 周期扫描，约束半径 ∝ 1/w
 *  ③ 第二类贝塞尔（Neumann）函数 Y_n：DLMF 10.8.1 升幂级数现算，与 J_n 同轴叠画作奇异性对照
 *     （Y_0(x)≈(2/π)(ln(x/2)+γ)→−∞，物理选有界的 J；此对数剖面同时是二维径向圆盘散热 ∇²T=0 ⇒ T(r)=A·ln r+B，q∝1/r）
 *  画面：左侧鼓面按当前模态 (n,m) 三维起伏（节线染暗），前方同步画出径向截面 J_n 波形与零点刻度，
 *  并叠画 Y_n 对照（原点塌陷）；再左下画圆盘散热 T(r)=A·ln r+B 对数剖面（色深∝q∝1/r）；
 *  右侧光纤芯层剖面：J₀ 主瓣 + K₀ 倏逝尾随 V 收紧/鼓包。 */
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

  const PI2 = Math.PI * 2;
  // —— 现算 J_n 与零点 ——
  const FAC: number[] = [1];
  for (let i = 1; i <= 200; i++) FAC.push(FAC[i - 1] * i);
  function Jn(n: number, x: number): number {
    if (x === 0) return n === 0 ? 1 : 0;
    let sum = 0;
    for (let k = 0; k < 90; k++) {
      const term = (k % 2 ? -1 : 1) * Math.pow(x / 2, 2 * k + n) / (FAC[k] * FAC[k + n]);
      sum += term;
      if (Math.abs(term) < 1e-16 * (Math.abs(sum) + 1e-30) && k > n + x) break;
    }
    return sum;
  }
  const ZEROS: Record<string, number> = {};
  function zeroOf(n: number, m: number): number {
    const key = `${n},${m}`;
    if (ZEROS[key] !== undefined) return ZEROS[key];
    let prev = Jn(n, 1e-4), prevX = 1e-4, cnt = 0, ans = NaN;
    for (let x = 0.01; x < 40; x += 0.01) {
      const f = Jn(n, x);
      if (prev * f < 0) {
        cnt++;
        if (cnt === m) {
          let lo = prevX, hi = x;
          for (let i = 0; i < 60; i++) { const md = (lo + hi) / 2; if (Jn(n, lo) * Jn(n, md) < 0) hi = md; else lo = md; }
          ans = (lo + hi) / 2;
          break;
        }
      }
      prev = f; prevX = x;
    }
    ZEROS[key] = ans;
    return ans;
  }
  for (let n = 0; n <= 3; n++) for (let m = 1; m <= 3; m++) zeroOf(n, m);

  // —— K0（运行期剖面用）与 K1（建表用积分） ——
  const GAM = 0.5772156649015329;
  function I0s(x: number): number { let s = 0; for (let k = 0; k < 40; k++) { const u = (Math.pow(x / 2, k) / FAC[k]) ** 2; s += u; if (u < 1e-16 * s && k > 3) break; } return s; }
  function K0(x: number): number {
    if (x > 8) { const v = 1 / x; return Math.exp(-x) / Math.sqrt(x) * (1 - v / 8 + 9 * v * v / 128 - 225 * v ** 3 / 2304); }
    const t = x / 2; let s = 0, H = 0;
    for (let k = 1; k < 70; k++) { H += 1 / k; const u = H * Math.pow(t * t, k) / (FAC[k] * FAC[k]); s += u; if (u < 1e-16 * s && k > 4) break; }
    return -(Math.log(t) + GAM) * I0s(x) + s;
  }
  function K1(x: number): number {
    const Tmax = Math.acosh(40 / Math.max(x, 1e-3)), N = 600, h = Tmax / N;
    let acc = 0;
    for (let i = 0; i <= N; i++) { const c = Math.cosh(i * h); acc += (i === 0 || i === N ? 1 : i % 2 ? 4 : 2) * Math.exp(-x * c) * c; }
    return acc * h / 3;
  }

  // —— 第二类贝塞尔函数 Y_n（Neumann 函数，DLMF 10.8.1 升幂级数 + 有限主项）——
  // 小宗点 Y_0(x)≈(2/π)(ln(x/2)+γ)：对数发散，恰等于二维稳态圆盘散热 T(r)=A·ln r+B 的对数剖面。
  const Hn = (m: number): number => { let s = 0; for (let i = 1; i <= m; i++) s += 1 / i; return s; };
  function Yn(n: number, x: number): number {
    if (x <= 1e-3) return -1e3;                          // 原点发散，返回大负值供绘图钳位
    const logP = (2 / Math.PI) * Math.log(x / 2) * Jn(n, x);
    let mid = 0;
    for (let k = 0; k <= n - 1; k++) mid += FAC[n - k - 1] / FAC[k] * Math.pow(x / 2, 2 * k - n);
    let s = 0;
    for (let k = 0; k < 60; k++) {
      const term = (k % 2 ? -1 : 1) * (-2 * GAM + Hn(k) + Hn(n + k)) / (FAC[k] * FAC[n + k]) * Math.pow(x / 2, n + 2 * k);
      s += term;
      if (Math.abs(term) < 1e-15 * (Math.abs(s) + 1e-30) && k > n) break;
    }
    return logP - mid / Math.PI - s / Math.PI;
  }

  // —— 光纤 u(V) 表（启动时逐点解本征方程） ——
  const VT: number[] = [], UOFT: number[] = [];
  const J01 = zeroOf(0, 1);
  for (let i = 0; i <= 64; i++) {
    const V = 1 + (4 * i) / 64;
    const f = (u: number): number => { const w = Math.sqrt(Math.max(1e-6, V * V - u * u)); return u * Jn(1, u) / Jn(0, u) - w * K1(w) / K0(w); };
    let lo = 0.001, hi = J01 - 0.0005;
    const fhi = f(hi);
    for (let k = 0; k < 46; k++) { const md = (lo + hi) / 2; if ((f(md) > 0) === (fhi > 0)) hi = md; else lo = md; }
    VT.push(V); UOFT.push((lo + hi) / 2);
  }
  void VT;
  function uOfV(V: number): number {
    const q = Math.max(0, Math.min(63, (V - 1) / (4 / 64)));
    const i = Math.floor(q), w = Math.min(q - i, 1);
    return UOFT[i] * (1 - w) + UOFT[i + 1] * w;
  }

  // ============ 鼓面（极坐标索引网格） ============
  const DC = new THREE.Vector3(-1.5, 0.85, 0), A_DRUM = 2.0, AMP = 0.42;
  const NR = 44, NS = 60;
  const drumGeo = geo(new THREE.BufferGeometry());
  const dvCount = (NR + 1) * (NS + 1);
  const dPos = new Float32Array(dvCount * 3), dCol = new Float32Array(dvCount * 3);
  drumGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  drumGeo.setAttribute('color', new THREE.BufferAttribute(dCol, 3));
  const idx: number[] = [];
  for (let i = 0; i < NR; i++) for (let j = 0; j < NS; j++) {
    const a0 = i * (NS + 1) + j, b0 = a0 + NS + 1;
    idx.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1);
  }
  drumGeo.setIndex(idx);
  const drum = new THREE.Mesh(drumGeo, mat(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.94 })));
  group.add(drum);
  const rimGeo = geo(new THREE.BufferGeometry());
  {
    const rp = new Float32Array((NS + 1) * 3);
    for (let j = 0; j <= NS; j++) {
      const th = (j / NS) * PI2;
      rp[j * 3] = DC.x + A_DRUM * Math.cos(th); rp[j * 3 + 1] = DC.y; rp[j * 3 + 2] = DC.z + A_DRUM * Math.sin(th);
    }
    rimGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  }
  group.add(new THREE.Line(rimGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.8 }))));
  // 节圆（单位圆 × 缩放，最多 2 个）与节直径（最多 3 条）
  const circGeoU = geo(new THREE.BufferGeometry());
  {
    const cp = new Float32Array(65 * 3);
    for (let j = 0; j <= 64; j++) { const th = (j / 64) * PI2; cp[j * 3] = Math.cos(th); cp[j * 3 + 1] = 0; cp[j * 3 + 2] = Math.sin(th); }
    circGeoU.setAttribute('position', new THREE.BufferAttribute(cp, 3));
  }
  const nodeCirc: import('three').Line[] = [];
  for (let k = 0; k < 2; k++) {
    const lc = new THREE.Line(circGeoU, mat(new THREE.LineBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.95 })));
    group.add(lc); nodeCirc.push(lc);
  }
  const diaGeo = geo(new THREE.BufferGeometry());
  diaGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * 3), 3));
  const diaLine = new THREE.LineSegments(diaGeo, mat(new THREE.LineBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.95 })));
  group.add(diaLine);

  // ============ 径向截面 J_n 波形（鼓面前方） ============
  const RW = 160;
  const radGeo = geo(new THREE.BufferGeometry());
  radGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((RW + 1) * 3), 3));
  radGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array((RW + 1) * 3), 3));
  group.add(new THREE.Line(radGeo, mat(new THREE.LineBasicMaterial({ vertexColors: true }))));
  // —— Y_n（第二类）对照曲线：同轴叠画，展示原点发散 vs J_n 有界 ——
  const radYGeo = geo(new THREE.BufferGeometry());
  radYGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((RW + 1) * 3), 3));
  group.add(new THREE.Line(radYGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.9 }))));
  const rAxis = geo(new THREE.BufferGeometry());
  rAxis.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
  group.add(new THREE.Line(rAxis, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));
  const RX0 = -3.6, RX1 = 0.7, RY = 3.6, RZ = 1.9;

  // ============ 圆盘散热 T(r)=A·ln r+B 剖面（对数曲线，Y₀ 原点同形） ============
  const HTN = 60;
  const heatGeo = geo(new THREE.BufferGeometry());
  heatGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((HTN + 1) * 3), 3));
  heatGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array((HTN + 1) * 3), 3));
  group.add(new THREE.Line(heatGeo, mat(new THREE.LineBasicMaterial({ vertexColors: true }))));
  const heatAxis = geo(new THREE.BufferGeometry());
  heatAxis.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
  group.add(new THREE.Line(heatAxis, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));
  const HX0 = -4.3, HX1 = -2.5, HY = 0.75, HZ = 2.25;   // 散热剖面世界框（左侧空白区）


  // ============ 光纤剖面（右侧） ============
  const FC = new THREE.Vector3(3.15, -0.1, 2.1), FA = 0.55;      // 芯半径世界 = r/a 1
  const coreBand = new THREE.Mesh(geo(new THREE.PlaneGeometry(FA * 2, 1.7)), mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.12, side: THREE.DoubleSide })));
  coreBand.position.copy(FC).add(new THREE.Vector3(0, 0.62, -0.01));
  group.add(coreBand);
  const fibGeo = geo(new THREE.BufferGeometry());
  fibGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((121 + 1) * 3), 3));
  fibGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array((121 + 1) * 3), 3));
  group.add(new THREE.Line(fibGeo, mat(new THREE.LineBasicMaterial({ vertexColors: true }))));
  const fibAxis = geo(new THREE.BufferGeometry());
  fibAxis.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
  group.add(new THREE.Line(fibAxis, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));

  function makeLabel(text: string, color: string, scale: number, pos: import('three').Vector3): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 26px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    s.position.copy(pos);
    return s;
  }
  group.add(makeLabel('圆鼓面模 (n,m)', '#fbbf24', 2.8, new THREE.Vector3(DC.x, DC.y + 1.35, DC.z - 1.0)));
  group.add(makeLabel('径向截面 J_n(j·r/a)', '#22d3ee', 3.0, new THREE.Vector3((RX0 + RX1) / 2, RY + 0.55, RZ)));
  group.add(makeLabel('对照 Y_n：原点 → −∞', '#fbbf24', 2.8, new THREE.Vector3((RX0 + RX1) / 2, RY - 2.35, RZ)));
  group.add(makeLabel('圆盘散热 T(r)=A·ln r+B', '#f472b6', 3.2, new THREE.Vector3((HX0 + HX1) / 2, HY + 1.35, HZ)));
  group.add(makeLabel('光纤 HE11：J₀芯内 / K₀倏逝', '#f472b6', 3.4, new THREE.Vector3(FC.x, FC.y + 1.75, FC.z)));

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

  const MODES: [number, number][] = [[0, 1], [0, 2], [1, 1], [2, 1], [2, 2], [1, 2], [3, 1], [0, 3]];
  let nn = 0, mm = 0, jv = J01, Vnum = 2, uf = 1, wf = 1;
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 860, 250);
    infoCtx.fillStyle = 'rgba(7,11,20,0.86)';
    infoCtx.fillRect(4, 4, 852, 242);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 852, 242);
    infoCtx.textAlign = 'left';
    const ln = (y: number, c: string, s: string, bold = false, sz = 26): void => {
      infoCtx.fillStyle = c; infoCtx.font = `${bold ? 'bold ' : ''}${sz}px "PingFang SC", sans-serif`;
      infoCtx.fillText(s, 22, y);
    };
    ln(40, '#f8fafc', '圆膜本征模 w = J_n(j_{n,m}·r/a)·cos nθ·sin ωt，ω ∝ j_{n,m}', true);
    ln(78, '#22d3ee', `零点现算：j₀₁=${zeroOf(0, 1).toFixed(4)} j₀₂=${zeroOf(0, 2).toFixed(4)} j₁₁=${zeroOf(1, 1).toFixed(4)}`);
    ln(112, '#a855f7', '光纤标量本征方程 u·J₁/J₀ = w·K₁/K₀，u²+w²=V²');
    ln(148, '#fbbf24', `读数：模态 (n,m)=(${nn},${mm}) j=${jv.toFixed(3)} 节圆=${mm - 1} 节直径=${nn} f/f₀=${(jv / J01).toFixed(2)}`, true, 24);
    ln(180, '#fbbf24', `光纤：V=${Vnum.toFixed(2)} u=${uf.toFixed(3)} w=${wf.toFixed(3)} 倏逝深度=(1/w)a=${(1 / Math.max(0.05, wf)).toFixed(2)}`, false, 24);
    ln(212, '#fbbf24', `对照曲线(金)：J_${nn}(0)=${nn === 0 ? '1' : '0'} 有界，而 Y_${nn} 在原点 → −∞（第二解，物理弃）`, false, 23);
ln(238, '#f472b6', `圆盘散热 T(r)=A·ln r+B：∇²T=0 二维径向解，q∝1/r → 近轴心/边缘热流比 ≈${(1 / 0.06).toFixed(0)}×`, false, 22);
    infoTex.needsUpdate = true;
  }

  function updateDrum(t: number): void {
    const omega = (jv / J01) * 2.1;
    const osc = Math.sin(omega * t);
    const Jrow: number[] = [];
    for (let i = 0; i <= NR; i++) Jrow.push(Jn(nn, jv * (i / NR)));
    let v = 0;
    for (let i = 0; i <= NR; i++) {
      const r = (i / NR) * A_DRUM;
      const jv0 = Jrow[i];
      for (let k = 0; k <= NS; k++) {
        const th = (k / NS) * PI2;
        const cs = Math.cos(nn * th);
        const w = AMP * osc * jv0 * cs;
        dPos[v * 3] = DC.x + r * Math.cos(th);
        dPos[v * 3 + 1] = DC.y + w;
        dPos[v * 3 + 2] = DC.z + r * Math.sin(th);
        const s = Math.abs(jv0 * cs);
        const nodal = s < 0.06 ? 1 : 0;
        dCol[v * 3] = nodal ? 0.06 : 0.15 + 0.72 * s;
        dCol[v * 3 + 1] = nodal ? 0.08 : 0.5 + 0.4 * s;
        dCol[v * 3 + 2] = nodal ? 0.1 : 0.75 + 0.2 * s;
        v++;
      }
    }
    drumGeo.attributes['position'].needsUpdate = true;
    drumGeo.attributes['color'].needsUpdate = true;
    // 节圆
    for (let k = 0; k < 2; k++) {
      const show = k < mm - 1;
      nodeCirc[k].visible = show;
      if (show) {
        const rk = (zeroOf(nn, k + 1) / jv) * A_DRUM;
        nodeCirc[k].scale.set(rk, 1, rk);
        nodeCirc[k].position.set(DC.x, DC.y + 0.005, DC.z);
      }
    }
    // 节直径
    const dArr = diaGeo.attributes['position'].array as Float32Array;
    let d = 0;
    for (let k = 0; k < nn; k++) {
      const th = ((2 * k + 1) / (2 * nn)) * Math.PI;
      dArr[d++] = DC.x - A_DRUM * Math.cos(th); dArr[d++] = DC.y + 0.006; dArr[d++] = DC.z - A_DRUM * Math.sin(th);
      dArr[d++] = DC.x + A_DRUM * Math.cos(th); dArr[d++] = DC.y + 0.006; dArr[d++] = DC.z + A_DRUM * Math.sin(th);
    }
    diaGeo.attributes['position'].needsUpdate = true;
    diaGeo.setDrawRange(0, 2 * nn);
  }

  function updateRadial(t: number): void {
    const osc = Math.sin((jv / J01) * 2.1 * t);
    const a = radGeo.attributes['position'].array as Float32Array;
    const c = radGeo.attributes['color'].array as Float32Array;
    for (let k = 0; k <= RW; k++) {
      const u = k / RW, x = u * jv;
      const yv = Jn(nn, x);
      a[k * 3] = RX0 + (RX1 - RX0) * u;
      a[k * 3 + 1] = RY + 0.75 * yv * (0.55 + 0.45 * Math.abs(osc));
      a[k * 3 + 2] = RZ;
      const s = Math.abs(yv);
      c[k * 3] = 0.2 + 0.55 * (1 - s); c[k * 3 + 1] = 0.55 + 0.4 * s; c[k * 3 + 2] = 0.9;
    }
    radGeo.attributes['position'].needsUpdate = true;
    radGeo.attributes['color'].needsUpdate = true;
    const ax = rAxis.attributes['position'].array as Float32Array;
    ax[0] = RX0; ax[1] = RY; ax[2] = RZ; ax[3] = RX1; ax[4] = RY; ax[5] = RZ;
    rAxis.attributes['position'].needsUpdate = true;

    // Y_n 对照：同横轴、前置 z 平面；纵轴压缩并对原点发散钳位，可见向 −∞ 塌陷
    const ya = radYGeo.attributes['position'].array as Float32Array;
    const YLO = -2.4, YHI = 1.8;                    // 显示带（Y_n 超出即截断，表观 −∞）
    for (let k = 0; k <= RW; k++) {
      const u = k / RW, x = u * jv;
      let yv = Yn(nn, x);
      if (!isFinite(yv)) yv = YLO;
      yv = Math.max(YLO, Math.min(YHI, yv));
      ya[k * 3] = RX0 + (RX1 - RX0) * u;
      ya[k * 3 + 1] = RY - 1.5 + 0.6 * yv;
      ya[k * 3 + 2] = RZ + 0.6;
    }
    radYGeo.attributes['position'].needsUpdate = true;
  }

  function updateHeat(): void {
    // 二维径向稳态热传导 ∇²T=0 ⇒ T(r)=A·ln r+B；归一化剖面 τ(r)=ln r / ln(1/r₀) 与 Y₀ 原点同形
    const a = heatGeo.attributes['position'].array as Float32Array;
    const c = heatGeo.attributes['color'].array as Float32Array;
    const r0 = 0.06;                                 // 内边界（近轴心）
    for (let k = 0; k <= HTN; k++) {
      const u = k / HTN;
      const r = r0 + (1 - r0) * u;                   // r∈[r0,1]
      const tau = Math.log(r) / Math.log(r0);        // r0→0, 1→1（对数剖面）
      a[k * 3] = HX0 + (HX1 - HX0) * u;
      a[k * 3 + 1] = HY + tau * 1.0;
      a[k * 3 + 2] = HZ;
      const q = 1 / Math.max(r, r0);                 // 热流 q∝1/r（越靠轴心越大）
      const s = Math.min(1, (q - 1) / 15);
      c[k * 3] = 0.95; c[k * 3 + 1] = 0.45 - 0.25 * s; c[k * 3 + 2] = 0.62 - 0.35 * s;
    }
    heatGeo.attributes['position'].needsUpdate = true;
    heatGeo.attributes['color'].needsUpdate = true;
    const ax = heatAxis.attributes['position'].array as Float32Array;
    ax[0] = HX0; ax[1] = HY; ax[2] = HZ; ax[3] = HX1; ax[4] = HY; ax[5] = HZ;
    heatAxis.attributes['position'].needsUpdate = true;
  }

  function updateFiber(): void {
    uf = uOfV(Vnum);
    wf = Math.sqrt(Math.max(1e-4, Vnum * Vnum - uf * uf));
    const j0u = Jn(0, uf);
    const a = fibGeo.attributes['position'].array as Float32Array;
    const c = fibGeo.attributes['color'].array as Float32Array;
    const M = 121;
    for (let k = 0; k <= M; k++) {
      const s = -3 + (6 * k) / M;                 // r/a
      let e: number, inn: boolean;
      if (Math.abs(s) <= 1) { e = Jn(0, uf * Math.abs(s)) / j0u; inn = true; }
      else { e = K0(wf * Math.abs(s)) / K0(wf); inn = false; }
      a[k * 3] = FC.x + s * FA * 1.08;
      a[k * 3 + 1] = FC.y + 0.62 + 0.6 * e;
      a[k * 3 + 2] = FC.z;
      c[k * 3] = inn ? 0.13 : 0.96; c[k * 3 + 1] = inn ? 0.83 : 0.45; c[k * 3 + 2] = inn ? 0.93 : 0.71;
    }
    fibGeo.attributes['position'].needsUpdate = true;
    fibGeo.attributes['color'].needsUpdate = true;
    const ax = fibAxis.attributes['position'].array as Float32Array;
    ax[0] = FC.x - 3 * FA * 1.08; ax[1] = FC.y + 0.62; ax[2] = FC.z;
    ax[3] = FC.x + 3 * FA * 1.08; ax[4] = FC.y + 0.62; ax[5] = FC.z;
    fibAxis.attributes['position'].needsUpdate = true;
  }

  function update(t: number, dt: number): void {
    const u = (t % 16) / 16;
    const mi = Math.floor(u * 8) % 8;
    nn = MODES[mi][0]; mm = MODES[mi][1];
    jv = zeroOf(nn, mm);
    Vnum = 1.2 + 3.6 * (0.5 - 0.5 * Math.cos(u * PI2));
    updateDrum(t);
    updateRadial(t);
    updateHeat();
    updateFiber();
    if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
  }

  nn = 2; mm = 1; jv = zeroOf(2, 1); Vnum = 2.4;
  updateDrum(0); updateRadial(0); updateHeat(); updateFiber(); drawInfo();

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
