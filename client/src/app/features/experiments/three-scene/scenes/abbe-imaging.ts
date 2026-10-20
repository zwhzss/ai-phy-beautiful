import type { SceneContext, SceneInstance } from '../types';
/** 阿贝成像与空间频率（P446）：主控方程 方栅第 m 级平面波会聚于频谱面 x_m = m·λf₁/Λ，
 *  谱点亮度 |c_m| = |sin(mπ/2)|·2/(mπ)（占空比 50% 方栅的傅里叶系数）；
 *  像面复振幅 U(x′) = Σ_{|m|≤M} c_m·e^{i2πm x′/Λ}（M 由光阑半径 a 判定），像条纹与对比度直接由该和式计算。 */
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

  // —— 4f 系统沿 z：物 −7.5，L1 −4，频谱面 0，L2 +4，像 +7.5（f₁=f₂=3.5） ——
  const Z_OBJ = -7.5, Z_FT = 0, Z_IMG = 7.5, PY = 1.35;
  const MORD = 4;      // 显示 0,±1,±2,±3,±4 级
  const XM = 0.42;     // 一级频谱点间距（场景单位，= λf₁/Λ 的映射）
  const NP = 4.5;      // 物面栅周期数（Λ = 5.2/NP 个世界单位）

  const axGeo = geo(new THREE.BufferGeometry());
  axGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, PY, Z_OBJ - 0.4, 0, PY, Z_IMG + 0.4]), 3));
  group.add(new THREE.Line(axGeo, mat(new THREE.LineBasicMaterial({ color: 0x475569 }))));

  function addPlaneWire(z: number, w: number, h2: number, color: number): void {
    const p = new THREE.Mesh(
      geo(new THREE.PlaneGeometry(w, h2)),
      mat(new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.3, side: THREE.DoubleSide })),
    );
    p.position.set(0, PY, z);
    group.add(p);
  }
  addPlaneWire(Z_OBJ, 5.2, 1.5, 0x22c55e);
  addPlaneWire(Z_FT, 3.8, 2.6, 0x22d3ee);
  addPlaneWire(Z_IMG, 5.2, 1.5, 0xf472b6);

  const lensGeo = geo(new THREE.CylinderGeometry(1.6, 1.6, 0.14, 32));
  const lensMat = mat(new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.5 }));
  [Z_FT - 3.5, Z_FT + 3.5].forEach((z) => {
    const l = new THREE.Mesh(lensGeo, lensMat);
    l.rotation.x = Math.PI / 2;
    l.position.set(0, PY, z);
    group.add(l);
  });

  function makeLabel(text: string, color: string, scale = 2.8): import('three').Sprite {
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
  const lbO = makeLabel('物面：方栅 Λ', '#22c55e'); lbO.position.set(0, PY + 1.2, Z_OBJ); group.add(lbO);
  const lbF = makeLabel('频谱面：x_m = m·λf₁/Λ', '#22d3ee', 3.2); lbF.position.set(0, PY + 1.7, Z_FT); group.add(lbF);
  const lbI = makeLabel('像面：各级干涉合成', '#f472b6', 3.2); lbI.position.set(0, PY + 1.2, Z_IMG); group.add(lbI);

  // —— 物面纹理（条纹）与像面纹理（按 Σc_m 逐列计算） ——
  const objCv = document.createElement('canvas');
  objCv.width = 256; objCv.height = 16;
  const objCtx = objCv.getContext('2d')!;
  objCtx.fillStyle = '#22c55e'; objCtx.fillRect(0, 0, 128, 16);
  objCtx.fillStyle = '#06213a'; objCtx.fillRect(128, 0, 128, 16);
  const objTex = tex(new THREE.CanvasTexture(objCv));
  objTex.wrapS = THREE.RepeatWrapping;
  objTex.repeat.set(NP, 1);
  const objPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(5.2, 1.2)),
    mat(new THREE.MeshBasicMaterial({ map: objTex })),
  );
  objPlane.position.set(0, PY, Z_OBJ + 0.03);
  group.add(objPlane);

  const cm = (m: number): number => (m === 0 ? 0.5 : ((2 / (m * Math.PI)) * Math.sin((m * Math.PI) / 2)));

  const imgCv = document.createElement('canvas');
  imgCv.width = 256; imgCv.height = 24;
  const imgCtx = imgCv.getContext('2d')!;
  const imgTex = tex(new THREE.CanvasTexture(imgCv));
  const imgPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(5.2, 1.2)),
    mat(new THREE.MeshBasicMaterial({ map: imgTex })),
  );
  imgPlane.position.set(0, PY, Z_IMG - 0.03);
  group.add(imgPlane);

  let vDisp = 0; // 像面对比度（与像面纹理由同一和式）
  function drawImage(M: number): void {
    let mn = Infinity, mx = -Infinity;
    const inten = new Float32Array(256);
    for (let px = 0; px < 256; px++) {
      const x = px / 256; // 屏幕上 NP 个周期
      let re = cm(0), im = 0;
      for (let m = 1; m <= M; m++) {
        const w = 2 * Math.PI * m * NP * x;
        re += cm(m) * Math.cos(w);
        im += cm(m) * Math.sin(w);
      }
      inten[px] = re * re + im * im;
      if (inten[px] < mn) mn = inten[px];
      if (inten[px] > mx) mx = inten[px];
    }
    vDisp = mx > mn ? (mx - mn) / (mx + mn) : 0;
    const norm = Math.max(1e-6, mx);
    for (let px = 0; px < 256; px++) {
      const I = inten[px] / norm;
      imgCtx.fillStyle = `rgb(${Math.round(30 + 220 * I)},${Math.round(140 * I + 30)},${Math.round(200 * I + 40)})`;
      imgCtx.fillRect(px, 0, 1, 24);
    }
    imgTex.needsUpdate = true;
  }

  // —— 衍射光线：物点 → 频谱亮点 → 像点（4f 放大率 −1；被滤除的级只画前半段） ——
  const rayGeo: import('three').BufferGeometry[] = [];
  const rayMat = mat(new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.5 }));
  for (let m = -MORD; m <= MORD; m++) {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 3), 3));
    const xf = m * XM;
    const arr = g.attributes['position'].array as Float32Array;
    arr[0] = 0; arr[1] = PY; arr[2] = Z_OBJ;
    arr[3] = xf; arr[4] = PY; arr[5] = Z_FT;
    arr[6] = -xf; arr[7] = PY; arr[8] = Z_IMG;
    g.attributes['position'].needsUpdate = true;
    group.add(new THREE.Line(g, rayMat));
    rayGeo.push(g);
  }

  // —— 频谱亮点（大小 ∝ |c_m|） ——
  const spotGeo = geo(new THREE.SphereGeometry(0.1, 10, 10));
  const spots: import('three').Mesh[] = [];
  const spotMats: import('three').MeshBasicMaterial[] = [];
  for (let m = -MORD; m <= MORD; m++) {
    const sm = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.95 }));
    const sp = new THREE.Mesh(spotGeo, sm);
    sp.position.set(m * XM, PY, Z_FT);
    sp.scale.setScalar(0.45 + 2.4 * Math.abs(cm(m)));
    group.add(sp);
    spots.push(sp); spotMats.push(sm);
  }

  // —— 可变光阑圆 ——
  const aperGeo = geo(new THREE.BufferGeometry());
  const aperArr = new Float32Array(65 * 3);
  aperGeo.setAttribute('position', new THREE.BufferAttribute(aperArr, 3));
  group.add(new THREE.Line(aperGeo, mat(new THREE.LineBasicMaterial({ color: 0xa855f7 }))));

  // —— 面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 800; infoCv.height = 236;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(8.8, 2.6)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 5.6, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  let aperR = 0.5, mPass = 1, fc = 0.02, lastM = -1;
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 800, 236);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 792, 228);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 792, 228);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 29px "PingFang SC", sans-serif';
    infoCtx.fillText('阿贝成像 = 两步：衍射分频（频谱面）+ 干涉合成（像面）', 22, 42);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '27px "PingFang SC", sans-serif';
    infoCtx.fillText('x_m = m·λf₁/Λ，|c_m| = |sin(mπ/2)|·2/(mπ)，Λ = 10 μm，λ = 0.55 μm', 22, 82);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText(`截止频率 f_c = a/(λf₁) = ${fc.toFixed(3)} μm⁻¹，物频 1/Λ = 0.10 μm⁻¹`, 22, 122);
    infoCtx.fillStyle = mPass === 0 ? '#ef4444' : '#fbbf24';
    infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：光阑 a = ${(aperR * 6.55).toFixed(1)} mm  过 ${2 * mPass + 1} 个亮点（M=${mPass}）  像对比度 V = ${vDisp.toFixed(2)} ${mPass === 0 ? '— 高频全滤：一片均匀' : mPass === 1 ? '— 只剩基频：正弦纹' : '— 谐波回归：方栅逼近'}`,
      22, 168,
    );
    infoTex.needsUpdate = true;
  }
  drawImage(1);
  drawInfo();

  return {
    update(t, dt) {
      // 扫描光阑半径 a：0→1.85→0，周期 16s
      const ph = (t % 16) / 16;
      aperR = 1.85 * (0.5 - 0.5 * Math.cos(2 * Math.PI * ph));
      mPass = Math.floor(aperR / XM + 1e-6);
      // 场景↔物理标定：XM=0.42 world ↔ 0.1 μm⁻¹ ⇒ 1 world = 6.55 mm（λf₁ = 27.5 mm·μm）
      fc = aperR / XM / 10;
      for (let i = 0; i < rayGeo.length; i++) {
        const m = i - MORD;
        const pass = Math.abs(m * XM) <= aperR + 1e-6;
        rayGeo[i].setDrawRange(0, pass ? 3 : 2);
        spotMats[i].color.setHex(pass ? 0x22d3ee : 0xef4444);
        spotMats[i].opacity = pass ? 0.95 : 0.4;
      }
      for (let j = 0; j <= 64; j++) {
        const a = (j / 64) * 2 * Math.PI;
        aperArr[j * 3] = aperR * Math.cos(a);
        aperArr[j * 3 + 1] = PY + aperR * Math.sin(a);
        aperArr[j * 3 + 2] = Z_FT;
      }
      aperGeo.attributes['position'].needsUpdate = true;
      if (mPass !== lastM) { lastM = mPass; drawImage(mPass); } // 条纹只在通级数变化时重算
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
