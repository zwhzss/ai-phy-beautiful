import type { SceneContext, SceneInstance } from '../types';

/**
 * 时空弯曲：质量导致网格凹陷，粒子沿测地线绕行（弱场直观模型）。
 * 物理：可视化广义相对论的"质量告诉时空如何弯曲"，凹陷深度为教学示意（非精确解）。
 * 嵌入剖面（与画面同源）：h(r) = −3.4·M/(0.6 + 0.55r)，径向单调 ⇒ 侧屏 2D 剖面画同一条曲线。
 * 轨道：圆轨道近似 v ∝ √(M/r)（开普勒标度，M 扫描时同步变角速度）。
 * 等效原理：自由落体 r̈ = −dφ/dr，φ(r)=h(r) 形式的势——方程不含物体质量 ⇒ 大中小三球同轨同速下落。
 * 扫描：16s 周期 M∈[0.6,1.45]（质量滑条的自动档）：井变深、轨道变快、下落变急，读数面板 5Hz 同步。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;

  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  // —— 质量 M 为扫描自变量（16s 周期 0.6→1.45）——
  let M = 1;
  const wellDepth = (x: number, z: number): number => {
    const r = Math.sqrt(x * x + z * z);
    return -3.4 * M / (0.6 + r * 0.55); // 教学用凹陷剖面 h(r)=−3.4M/(0.6+0.55r)
  };
  // 落体加速度 r̈ = −dφ/dr（φ∝h 同形；物体质量不入方程 ⇒ 等效原理）
  const accel = (r: number): number => -3.4 * M * 0.55 / ((0.6 + r * 0.55) ** 2);

  // —— 弯曲时空网格 ——
  const planeGeo = geo(new THREE.PlaneGeometry(36, 36, 72, 72));
  planeGeo.rotateX(-Math.PI / 2);
  const pos = planeGeo.attributes['position'] as import('three').BufferAttribute;
  const restY = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) restY[i] = pos.getY(i);
  const wire = new THREE.Mesh(
    planeGeo,
    mat(new THREE.MeshBasicMaterial({ color: 0x5b7cfa, wireframe: true, transparent: true, opacity: 0.55 })),
  );
  group.add(wire);

  // —— 中心质量（半径随 M 微缩放，直观"质量大小"）——
  const mass = new THREE.Mesh(
    geo(new THREE.SphereGeometry(0.85, 32, 32)),
    mat(new THREE.MeshStandardMaterial({ color: 0xf6c344, emissive: 0xb7791f, emissiveIntensity: 0.7, roughness: 0.4 })),
  );
  mass.position.y = -1.5 * 1; // 随 M 在 update 中调整
  group.add(mass);

  // —— 测地线粒子（圆轨道近似，v ∝ √(M/r)）——
  const orbiters: { r: number; ang: number; mesh: import('three').Mesh }[] = [];
  const orbitColors = [0x7ad7ff, 0xff9f68, 0xb6ff7a];
  orbitColors.forEach((c, i) => {
    const r = 4.2 + i * 2.6;
    const m = new THREE.Mesh(
      geo(new THREE.SphereGeometry(0.24, 16, 16)),
      mat(new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.55 })),
    );
    m.position.y = wellDepth(r, 0) + 0.35;
    group.add(m);
    orbiters.push({ r, ang: i * 2.1, mesh: m });
  });

  // 轨道线（贴合凹陷，update 随 M 重写）
  const orbitLines: import('three').Line[] = [];
  orbiters.forEach((o) => {
    const curve = new THREE.EllipseCurve(0, 0, o.r, o.r, 0, Math.PI * 2);
    const pts = curve.getPoints(96).map((p) => new THREE.Vector3(p.x, 0, p.y));
    const lg = geo(new THREE.BufferGeometry().setFromPoints(pts));
    const line = new THREE.Line(lg, mat(new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.8 })));
    group.add(line);
    orbitLines.push(line);
  });

  // —— 等效原理：三个"质量"不同的球沿同一径向直线自由下落 ——
  const DROP_TH = Math.PI * 0.32;
  const fallers: { mesh: import('three').Mesh; labelKg: string; sz: number }[] = [];
  [0.1, 0.18, 0.28].forEach((sz, i) => {
    const fm = new THREE.Mesh(
      geo(new THREE.SphereGeometry(sz, 14, 14)),
      mat(new THREE.MeshStandardMaterial({ color: [0xf472b6, 0x22d3ee, 0xfbbf24][i], emissive: [0xf472b6, 0x22d3ee, 0xfbbf24][i], emissiveIntensity: 0.4 })),
    );
    group.add(fm);
    fallers.push({ mesh: fm, labelKg: ['1kg', '10kg', '100kg'][i], sz });
  });
  // 下落导轨线（同一根直线 ⇒ 同轨）
  {
    const g = geo(new THREE.BufferGeometry());
    const p: number[] = [];
    for (let i = 0; i <= 24; i++) {
      const r = 1 + (7.5 - 1) * (i / 24);
      p.push(r * Math.cos(DROP_TH), 0.22, r * Math.sin(DROP_TH));
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3));
    group.add(new THREE.Line(g, mat(new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.5 }))));
  }
  let fr = 7.5, fvr = 0;

  // —— 2D 剖面侧屏：h(r) 曲线（与 wellDepth 同源），标出轨道与落体 ——
  const secCv = document.createElement('canvas'); secCv.width = 256; secCv.height = 160;
  const secCtx = secCv.getContext('2d')!;
  const secTex = tex(new THREE.CanvasTexture(secCv));
  const secScreen = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(7.2, 4.5)),
    mat(new THREE.MeshBasicMaterial({ map: secTex, transparent: true })),
  );
  secScreen.position.set(0, 3.2, -11.5);
  group.add(secScreen);
  const px = (r: number) => 12 + (r / 9) * 232;                 // r 0..9 → x
  const py = (h: number) => 20 + (h / -5.4) * 120;               // h 0..−5.4 → y
  function drawSection(): void {
    secCtx.clearRect(0, 0, 256, 160);
    secCtx.fillStyle = 'rgba(7,11,20,0.85)'; secCtx.fillRect(0, 0, 256, 160);
    secCtx.strokeStyle = '#334155'; secCtx.lineWidth = 1;
    secCtx.beginPath(); secCtx.moveTo(px(0), py(0)); secCtx.lineTo(px(9), py(0)); secCtx.moveTo(px(0), py(0)); secCtx.lineTo(px(0), py(-5.4)); secCtx.stroke();
    secCtx.fillStyle = '#94a3b8'; secCtx.font = '11px "PingFang SC", sans-serif';
    secCtx.fillText('h(r)=−3.4M/(0.6+0.55r)', 60, 14);
    secCtx.fillText('r→', 240, py(0) + 12); secCtx.fillText('2D 剖面：引力=几何', 8, 152);
    secCtx.strokeStyle = '#22d3ee'; secCtx.lineWidth = 2; secCtx.beginPath();
    for (let i = 0; i <= 90; i++) {
      const r = (i / 90) * 9; const h = -3.4 * M / (0.6 + r * 0.55);
      if (i === 0) secCtx.moveTo(px(r), py(h)); else secCtx.lineTo(px(r), py(h));
    }
    secCtx.stroke();
    secCtx.fillStyle = '#f472b6';
    secCtx.beginPath(); secCtx.arc(px(fr), py(-3.4 * M / (0.6 + fr * 0.55)), 4, 0, Math.PI * 2); secCtx.fill();
    secCtx.fillStyle = '#7ad7ff';
    orbiters.forEach((o) => { secCtx.fillRect(px(o.r) - 2, py(-3.4 * M / (0.6 + o.r * 0.55)) - 2, 4, 4); });
    secTex.needsUpdate = true;
  }

  // —— 读数面板（三段式，5Hz）——
  const infoCv = document.createElement('canvas'); infoCv.width = 512; infoCv.height = 256;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const info = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  info.scale.set(7.4, 3.7, 1); info.position.set(0, 6.4, 0); info.renderOrder = 999;
  group.add(info);
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 512, 256);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(3, 3, 506, 250);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(3, 3, 506, 250);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 25px "PingFang SC", sans-serif';
    infoCtx.fillText('引力 = 几何：质量告诉时空如何弯曲', 14, 34);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '20px "PingFang SC", sans-serif';
    infoCtx.fillText('嵌入剖面 h(r)=−3.4M/(0.6+0.55r)（示意，非精确解）', 14, 66);
    infoCtx.fillText('测地线≈圆轨道 v∝√(M/r)；侧屏 2D 剖面与网格同源', 14, 92);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('等效原理：r̈=−dφ/dr 与物体质量无关⇒三球同轨下落', 14, 118);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 19px "PingFang SC", sans-serif';
    const v1 = Math.sqrt(M / orbiters[0].r) * 0.75 / Math.sqrt(0.45);
    infoCtx.fillText(`读数: M=${M.toFixed(2)} 井深 h(2)=${(-3.4 * M / 1.7).toFixed(2)}m`, 14, 152);
    infoCtx.fillText(`内轨 v∝${v1.toFixed(2)}  落体 r=${fr.toFixed(2)}m v_r=${fvr.toFixed(2)}m/s`, 14, 180);
    infoCtx.fillText(fallers.map((f) => `${f.labelKg}@${fr.toFixed(2)}m`).join('  ') + '（同轨同速）', 14, 208);
    infoTex.needsUpdate = true;
  }

  let tPrev = 0;
  return {
    update(t, dt) {
      const h = Math.min(0.05, dt);
      const u = (t % 16) / 16;
      M = 0.6 + 0.85 * (0.5 - 0.5 * Math.cos(2 * Math.PI * u)); // 质量扫描
      // 网格：凹陷随 M + 涟漪
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        const r = Math.sqrt(x * x + z * z);
        const ripple = 0.12 * Math.sin(r * 1.4 - t * 1.6);
        pos.setY(i, restY[i] + wellDepth(x, z) + ripple);
      }
      pos.needsUpdate = true;
      mass.scale.setScalar(0.7 + 0.3 * M);
      mass.position.y = -1.5 * M;
      mass.rotation.y = t * 0.4;
      orbiters.forEach((o, k) => {
        o.ang += (0.75 * Math.sqrt(M) / Math.sqrt(o.r * 0.45)) * h; // v ∝ √(M/r)
        const x = o.r * Math.cos(o.ang), z = o.r * Math.sin(o.ang);
        o.mesh.position.set(x, wellDepth(x, z) + 0.35, z);
        const lp = orbitLines[k].geometry.attributes['position'] as import('three').BufferAttribute;
        for (let i = 0; i < lp.count; i++) lp.setY(i, wellDepth(lp.getX(i), lp.getZ(i)) + 0.05);
        lp.needsUpdate = true;
      });
      // 自由落体（等效原理：三球共用同一 (r, v)，方程不含物体质量）
      fvr += accel(fr) * h;
      fr += fvr * h;
      if (fr < 1.0) { fr = 7.5; fvr = 0; } // 触底复位重落；M 越大井越深，下落全程越短
      fallers.forEach((f) => {
        const fx = fr * Math.cos(DROP_TH), fz = fr * Math.sin(DROP_TH);
        f.mesh.position.set(fx, wellDepth(fx, fz) + f.sz + 0.06, fz);
      });
      group.rotation.y = t * 0.05;
      const t5 = Math.floor(t * 5);
      if (t5 !== Math.floor(tPrev * 5)) { drawSection(); drawInfo(); }
      tPrev = t;
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
