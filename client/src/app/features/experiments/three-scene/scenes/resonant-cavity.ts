import type { SceneContext, SceneInstance } from '../types';
/**
 * 谐振腔与驻波模式（P122）：矩形腔 TE₁₀ₚ 模，腔长扫描 + 去耦衰减演示。
 * 主控方程：f_mnp=(c/2)·√((m/a)²+(n/b)²+(p/d)²)；TE₁₀₁=(c/2)√((1/a)²+(1/d)²)=62.5MHz（a=3m,d=4m）。
 * 截止：p→0 极限 f_c=(c/2)(m/a)=50MHz——纵截面场不再变化，无法在 z 向驻留；f²=f_c²+(pc/2d)²。
 * 场结构：E_y∝sin(πx/a)·sin(pπz′/d)·cosωt（导体壁切向 E=0 ⇒ z′=0,d 节点），B∝sinωt 与 E 相差 90°（能量在 E/B 间换振）。
 * Q 值：去耦后振幅 A(τ)=e^{−ωτ/(2Q)}，能量 e^{−ωτ/Q}；演示取 Q=6（时间轴缩放，真实无氧腔 Q~10⁴ 衰减远超可见窗口）。
 * 扫描：12s 内 d∈[3.6,4.5]m 连续扫，p 每 6s 在 1↔2 间切换（TE₁₀₁↔TE₁₀₂ 节线数与 f 同帧改变）；后 6s 冻结几何、A 按 Q 衰减。
 * 画面：E 为从轴线出发的有向红线段（cosωt 变号⇒整束翻转），B 为蓝色水平环（|sinωt|·A 呼吸），面板 5Hz 读数与几何同源。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  // 星野 + 栅格
  const starGeo = geo(new THREE.BufferGeometry());
  { const p = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) { p[i * 3] = (Math.random() - 0.5) * 200; p[i * 3 + 1] = (Math.random() - 0.5) * 200; p[i * 3 + 2] = (Math.random() - 0.5) * 200; }
    starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3)); }
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  const grid = new THREE.GridHelper(20, 20, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // —— 腔体尺寸（米）：a 固定，d 为扫描自变量 ——
  const A_X = 3.0, B_Y = 2.0, D0 = 4.0;
  const C0 = 3e8;
  const F_C = (C0 / 2) * (1 / A_X); // TE10 截止 = 50MHz

  // 导体壁（线框 + 半透明壳；几何按 D0 建，运行时 scale.z=d/D0 实现长度扫描）
  const wallMat = mat(new THREE.MeshBasicMaterial({ color: 0x475569, wireframe: true, transparent: true, opacity: 0.3 }));
  const cavity = new THREE.Mesh(geo(new THREE.BoxGeometry(A_X, B_Y, D0)), wallMat);
  const shell = new THREE.Mesh(geo(new THREE.BoxGeometry(A_X, B_Y, D0)),
    mat(new THREE.MeshStandardMaterial({ color: 0x1e293b, transparent: true, opacity: 0.08, side: THREE.DoubleSide })));
  group.add(cavity, shell);

  // —— E 场：有向红线段（轴上 y=0 起点，尖端 y=s·cosωt·A ⇒ 正负半周翻转）——
  const Z_ST = 10, X_COL = [A_X / 4, -A_X / 4];
  const nSeg = Z_ST * X_COL.length;
  const eGeo = geo(new THREE.BufferGeometry());
  const ePos = new Float32Array(nSeg * 2 * 3);
  eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
  group.add(new THREE.LineSegments(eGeo, mat(new THREE.LineBasicMaterial({ color: 0xef4444 }))));
  // E 矢量尖端小球（红/蓝区分当前半周朝向）
  const tipGeo = geo(new THREE.SphereGeometry(0.055, 8, 8));
  const tipMat = mat(new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  const tips: import('three').Mesh[] = [];
  for (let i = 0; i < nSeg; i++) { const m = new THREE.Mesh(tipGeo, tipMat); group.add(m); tips.push(m); }

  // —— B 场：x–z 平面水平环，半径 ∝ |cos(pπz′/d)·sinωt|·A（与 E 相差 90°）——
  const bLoops: import('three').Line[] = [];
  { const nLoop = 4, loopSegs = 32;
    for (let i = 0; i < nLoop; i++) {
      const g = geo(new THREE.BufferGeometry());
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((loopSegs + 1) * 3), 3));
      const l = new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color: 0x3b82f6 })));
      group.add(l); bLoops.push(l);
    } }

  // —— 静态标签 ——
  function makeLabel(text: string, color: string): import('three').Sprite {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 28px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.fillText(text, 128, 42);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(3.5, 0.875, 1); s.renderOrder = 998; return s;
  }
  const labelE = makeLabel('E 有向线段 (∝cosωt)', '#ef4444'); labelE.position.set(-A_X / 2 - 1.8, 1.3, 0); group.add(labelE);
  const labelB = makeLabel('B 环 (∝sinωt)', '#3b82f6'); labelB.position.set(A_X / 2 + 1.8, -1.3, 0); group.add(labelB);

  // —— 读数面板（512×256，三段式，5Hz）——
  const infoCv = document.createElement('canvas'); infoCv.width = 512; infoCv.height = 256;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const info = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  info.scale.set(7.2, 3.6, 1); info.position.set(0, 3.2, 0); info.renderOrder = 999;
  group.add(info);

  const OMEGA = 2 * Math.PI * 2; // 视觉 2Hz（真实 62.5MHz，时间轴缩放 ~3×10⁷）
  const QD = 6;                  // 演示 Q（缩放）
  const CYCLE = 18, SCAN = 12;   // 前 12s 模式/腔长扫描，后 6s 去耦衰减
  const st = { d: D0, p: 1, amp: 1, tau: 0, f: 0, decay: false };

  function calcState(t: number): void {
    const tc = t % CYCLE;
    if (tc < SCAN) {
      st.decay = false; st.amp = 1; st.tau = 0;
      const u = tc / SCAN;
      st.d = 3.6 + 0.9 * (0.5 - 0.5 * Math.cos(2 * Math.PI * u)); // 3.6→4.5m
      st.p = tc < 6 ? 1 : 2;                                      // TE₁₀₁ ↔ TE₁₀₂
    } else {
      st.decay = true; st.p = 1; st.d = 3.6;                      // 冻结几何（扫描末态）
      st.tau = tc - SCAN;
      st.amp = Math.exp(-(OMEGA * st.tau) / (2 * QD));            // A=e^{−ωτ/2Q}
    }
    st.f = (C0 / 2) * Math.sqrt((1 / A_X) ** 2 + (st.p / st.d) ** 2);
  }

  function drawFields(t: number): void {
    const { d, p, amp } = st;
    const sZ = cavity.scale; sZ.z = d / D0; shell.scale.z = d / D0;
    const cosT = Math.cos(OMEGA * t) * amp;
    const sinT = Math.sin(OMEGA * t) * amp;
    let vi = 0;
    for (let iz = 0; iz < Z_ST; iz++) {
      const z = -d / 2 + ((iz + 0.5) / Z_ST) * d;
      const zp = z + d / 2;
      const patZ = Math.sin((p * Math.PI * zp) / d);
      for (const x of X_COL) {
        const v = 0.85 * Math.sin((Math.PI * x) / A_X) * patZ * cosT;
        ePos[vi * 6] = x; ePos[vi * 6 + 1] = 0; ePos[vi * 6 + 2] = z;
        ePos[vi * 6 + 3] = x; ePos[vi * 6 + 4] = v; ePos[vi * 6 + 5] = z;
        tips[vi].position.set(x, v, z);
        tips[vi].visible = Math.abs(v) > 0.05;
        vi++;
      }
    }
    eGeo.attributes['position'].needsUpdate = true;
    tipMat.color.setHex(cosT >= 0 ? 0xef4444 : 0xf9a8a4);
    const loopSegs = 32;
    for (let i = 0; i < bLoops.length; i++) {
      const z = -d / 2 + ((i + 0.5) / bLoops.length) * d;
      const zp = z + d / 2;
      const r = 0.5 * Math.abs(Math.cos((p * Math.PI * zp) / d) * sinT);
      const arr = (bLoops[i].geometry.attributes['position'] as import('three').BufferAttribute).array as Float32Array;
      for (let j = 0; j <= loopSegs; j++) {
        const ang = (j / loopSegs) * Math.PI * 2;
        arr[j * 3] = (A_X / 2 - 0.3) * Math.cos(ang);
        arr[j * 3 + 1] = 0;
        arr[j * 3 + 2] = z + r * Math.sin(ang);
      }
      bLoops[i].geometry.attributes['position'].needsUpdate = true;
    }
    wallMat.opacity = 0.25 + 0.12 * amp * Math.abs(cosT);
  }

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 512, 256);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(3, 3, 506, 250);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(3, 3, 506, 250);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 25px "PingFang SC", sans-serif';
    infoCtx.fillText('矩形腔 TE₁₀ₚ：模式·截止·Q 衰减', 14, 34);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '20px "PingFang SC", sans-serif';
    infoCtx.fillText('f=(c/2)·√((1/a)²+(p/d)²)，f²=f_c²+(pc/2d)²', 14, 66);
    infoCtx.fillText('截止 f_c=(c/2a)：p=0 极限，z 向不能驻留', 14, 92);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('E∝cosωt（线段变向）↔ B∝sinωt 相差 90°', 14, 118);
    infoCtx.fillText('去耦后 A(τ)=e^(−ωτ/2Q)，能量∝A²（时间缩放）', 14, 144);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 19px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数: TE₁₀${st.p} d=${st.d.toFixed(2)}m f=${(st.f / 1e6).toFixed(1)}MHz`, 14, 176);
    infoCtx.fillText(`f−f_c=${(st.f / 1e6 - F_C / 1e6).toFixed(1)}MHz Q=${QD}(演示)`, 14, 202);
    infoCtx.fillText(st.decay ? `衰减中: τ=${st.tau.toFixed(1)}s A=${(st.amp * 100).toFixed(1)}%` : `扫描中: d 3.6→4.5m，p 每6s 换 1↔2`, 14, 228);
    infoTex.needsUpdate = true;
  }

  calcState(0); drawFields(0); drawInfo();

  return {
    update(t, dt) {
      calcState(t);
      drawFields(t);
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
