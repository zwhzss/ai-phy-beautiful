import type { SceneContext, SceneInstance } from '../types';
/** ISCO（P140）：最内层稳定圆轨道演示。
 *
 * 单位约定：
 *  - 3D 主体以 Rs=2M 为场景单位（Rs=1 ⇒ 黑洞半径 0.5=M，ISCO=3Rs=6M）。
 *  - 能量面板横轴 r 以 M 计，ISCO 虚线归位 r=6M。
 */

// 圆轨道比能量（Schwarzschild，r 以 M 计）：E=(1−2/r)/√(1−3/r)。
// r=6M 处取极小 0.943（ISCO 判据），r→∞ 从下方趋于 1，r→3M+（光子球）发散。
const orbE = (r: number): number => (1 - 2 / r) / Math.sqrt(1 - 3 / r);
const E_ISCO = orbE(6); // ≈0.943，面板读数与曲线同源均出自此函数

// Kerr 顺行 ISCO 闭式（Bardeen-Press-Teukolsky 1972）：
// Z1=1+(1−a²)^⅓[(1+a)^⅓+(1−a)^⅓]，Z2=√(3a²+Z1²)，r=3+Z2−√((3−Z1)(3+Z1+2Z2))
const iscoKerr = (a: number): number => {
  const z1 = 1 + Math.cbrt(1 - a * a) * (Math.cbrt(1 + a) + Math.cbrt(1 - a));
  const z2 = Math.sqrt(3 * a * a + z1 * z1);
  return 3 + z2 - Math.sqrt((3 - z1) * (3 + z1 + 2 * z2));
};

export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  // 资源登记器（bespoke-scene-spec §2）
  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  const starGeo = geo(new THREE.BufferGeometry());
  const starPts: import('three').Vector3[] = [];
  for (let i = 0; i < 500; i++) starPts.push(new THREE.Vector3((Math.random()-0.5)*200,(Math.random()-0.5)*200,(Math.random()-0.5)*200));
  starGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(starPts.flatMap(v=>[v.x,v.y,v.z])),3));
  const starMat = mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }));
  group.add(new THREE.Points(starGeo, starMat));

  const grid = new THREE.GridHelper(20, 20, 0x334155, 0x1e293b);
  geo(grid.geometry); mat(grid.material);
  group.add(grid);

  // Black hole
  const bhGeo = geo(new THREE.SphereGeometry(0.5, 32, 16));
  const bhMat = mat(new THREE.MeshBasicMaterial({ color: 0x000000 }));
  group.add(new THREE.Mesh(bhGeo, bhMat));

  // ISCO radius: 场景单位 Rs=1，故 ISCO=3Rs=6M（稳定圆轨道内边界）
  const ISCO_R = 3.0;

  const circleLine = (radius: number, material: import('three').Material): import('three').Line => {
    const pts: import('three').Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const theta = (i / 128) * 2 * Math.PI;
      pts.push(new THREE.Vector3(radius * Math.cos(theta), 0, radius * Math.sin(theta)));
    }
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts.flatMap(v=>[v.x,v.y,v.z])),3));
    return new THREE.Line(g, material);
  };

  // ISCO 界线（6M）
  group.add(circleLine(ISCO_R, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24, linewidth: 2 }))));

  // 吸积盘内缘（ISCO 处发光环）
  const diskGeo = geo(new THREE.RingGeometry(ISCO_R * 0.95, ISCO_R * 1.05, 64));
  const diskMat = mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
  const disk = new THREE.Mesh(diskGeo, diskMat);
  disk.rotation.x = -Math.PI / 2;
  group.add(disk);

  // 稳定轨道（ISCO 之外：4..10 Rs = 8M..20M > 6M）
  const stableRadii = [4.0, 5.0, 6.0, 8.0, 10.0];
  stableRadii.forEach((r, idx) => {
    group.add(circleLine(r, mat(new THREE.LineBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.5 - idx * 0.06 }))));
  });

  // 不稳定轨道（3M<r<6M，即 1.5Rs..3Rs 之间）
  const unstableRadii = [2.5, 2.8];
  unstableRadii.forEach((r) => {
    group.add(circleLine(r, mat(new THREE.LineBasicMaterial({ color: 0xfb7185, transparent: true, opacity: 0.6 }))));
  });

  // ISCO 上的粒子
  const partGeo = geo(new THREE.SphereGeometry(0.1, 12, 8));
  const partMat = mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
  const particle = new THREE.Mesh(partGeo, partMat);
  group.add(particle);

  // 从内不稳定轨道螺旋坠落的粒子
  const spiralPartGeo = geo(new THREE.SphereGeometry(0.07, 8, 6));
  const spiralPartMat = mat(new THREE.MeshBasicMaterial({ color: 0xfb7185 }));
  const spiralParticle = new THREE.Mesh(spiralPartGeo, spiralPartMat);
  group.add(spiralParticle);

  // Sprite 文字标签
  const mkLabel = (text: string, x: number, z: number, color: string) => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 48;
    const g2 = c.getContext('2d')!;
    g2.fillStyle = color;
    g2.font = 'bold 20px sans-serif';
    g2.textAlign = 'center';
    g2.fillText(text, 128, 32);
    const t = tex(new THREE.CanvasTexture(c));
    const sm = mat(new THREE.SpriteMaterial({ map: t, transparent: true }));
    const sprite = new THREE.Sprite(sm);
    sprite.position.set(x, 0.5, z);
    sprite.scale.set(1.8, 0.34, 1);
    group.add(sprite);
  };

  mkLabel('ISCO (r=6M)', ISCO_R + 0.5, 0, '#fbbf24');
  mkLabel('Stable', 7, 0.3, '#4ade80');
  mkLabel('Unstable', 2.5, 0.3, '#fb7185');

  // 能量面板：E(r)=(1−2/r)/√(1−3/r) 与 Ω=√(M/r³)，横轴 r 以 M 计
  const panelCanvas = document.createElement('canvas');
  panelCanvas.width = 512;
  panelCanvas.height = 384;
  const pctx = panelCanvas.getContext('2d')!;

  // 绘图区映射：r∈[1,12]M → x；E∈[0.92,1.04] → y
  const px = (r: number) => 70 + (r - 1) * (418 / 11);
  const pyE = (e: number) => 300 - ((e - 0.92) / 0.12) * 230;

  function drawPanel() {
    pctx.fillStyle = '#0f172a';
    pctx.fillRect(0, 0, 512, 384);

    pctx.fillStyle = '#e2e8f0';
    pctx.font = 'bold 24px "PingFang SC", sans-serif';
    pctx.textAlign = 'center';
    pctx.fillText('圆轨道比能量 E(r)=(1−2/r)/√(1−3/r)  (r 以 M 计)', 256, 32);

    // 坐标轴
    pctx.strokeStyle = '#334155';
    pctx.lineWidth = 1;
    pctx.beginPath();
    pctx.moveTo(70, 300); pctx.lineTo(488, 300);
    pctx.moveTo(70, 70); pctx.lineTo(70, 300);
    pctx.stroke();
    pctx.fillStyle = '#94a3b8';
    pctx.font = '18px "PingFang SC", sans-serif';
    pctx.textAlign = 'center';
    for (const r of [3, 6, 9, 12]) {
      pctx.beginPath(); pctx.moveTo(px(r), 296); pctx.lineTo(px(r), 304); pctx.stroke();
      pctx.fillText(`${r}M`, px(r), 320);
    }

    // E=1 参考线（无穷远静止粒子，未束缚阈值）
    pctx.strokeStyle = '#64748b';
    pctx.setLineDash([3, 4]);
    pctx.beginPath(); pctx.moveTo(70, pyE(1)); pctx.lineTo(488, pyE(1)); pctx.stroke();
    pctx.setLineDash([]);
    pctx.fillStyle = '#64748b';
    pctx.textAlign = 'right';
    pctx.fillText('E=1（未束缚）', 486, pyE(1) - 6);

    // Ω=√(M/r³) 曲线（青色，自有纵标度，r>3M 才有类时圆轨道）
    pctx.strokeStyle = '#38bdf8';
    pctx.lineWidth = 2;
    pctx.beginPath();
    for (let r = 3.05; r <= 12; r += 0.05) {
      const omega = Math.sqrt(1 / (r ** 3));       // 单位 M=1
      const y = 300 - (omega / 0.2) * 230;
      if (r === 3.05) pctx.moveTo(px(r), y); else pctx.lineTo(px(r), y);
    }
    pctx.stroke();
    pctx.fillStyle = '#38bdf8';
    pctx.textAlign = 'left';
    pctx.fillText('Ω = √(M/r³)', 78, 84);

    // E(r) 曲线（紫色，orbE 同源；r→3M+ 发散处按绘图区裁剪）
    pctx.strokeStyle = '#a78bfa';
    pctx.lineWidth = 3;
    pctx.beginPath();
    let started = false;
    for (let r = 3.05; r <= 12; r += 0.05) {
      const E = orbE(r);
      const y = pyE(E);
      if (y < 55) { started = false; continue; }  // 裁剪到绘图区顶之上
      if (!started) { pctx.moveTo(px(r), y); started = true; } else pctx.lineTo(px(r), y);
    }
    pctx.stroke();
    pctx.fillStyle = '#a78bfa';
    pctx.fillText('E(r)：r=6M 极小，r→∞ 从下方趋于 1', 150, 300 - 8);

    // ISCO 虚线归位 r=6M
    pctx.strokeStyle = '#fbbf24';
    pctx.lineWidth = 2;
    pctx.setLineDash([6, 5]);
    pctx.beginPath(); pctx.moveTo(px(6), 60); pctx.lineTo(px(6), 300); pctx.stroke();
    pctx.setLineDash([]);
    pctx.fillStyle = '#fbbf24';
    pctx.textAlign = 'center';
    pctx.font = 'bold 18px "PingFang SC", sans-serif';
    pctx.fillText('ISCO r=6M', px(6), 66);

    // E(6M) 极小点（与曲线同源：同用 orbE）
    pctx.beginPath();
    pctx.arc(px(6), pyE(E_ISCO), 5, 0, Math.PI * 2);
    pctx.fillStyle = '#fbbf24';
    pctx.fill();
    pctx.textAlign = 'right';
    pctx.fillText(`极小点 E(6M)=${E_ISCO.toFixed(3)}`, px(6) - 10, pyE(E_ISCO) + 20);

    // 黄色读数行（同源变量）
    pctx.fillStyle = '#fbbf24';
    pctx.font = 'bold 20px "PingFang SC", sans-serif';
    pctx.textAlign = 'left';
    pctx.fillText(`读数：E(6M)=${E_ISCO.toFixed(3)}，束缚能 1−E=${((1 - E_ISCO) * 100).toFixed(1)}%（吸积效率）`, 24, 348);

    // Kerr 自旋标定（concept 承诺项；Bardeen 1972 闭式同源计算，本 3D 主体取 a=0）
    pctx.fillStyle = '#94a3b8';
    pctx.font = '18px "PingFang SC", sans-serif';
    pctx.fillText(
      `Kerr 顺行 ISCO（Bardeen 1972）：a=0→${iscoKerr(0).toFixed(1)}M, a=0.5→${iscoKerr(0.5).toFixed(2)}M, a=0.9→${iscoKerr(0.9).toFixed(2)}M, a→1→${iscoKerr(1).toFixed(0)}M（3D 主体：a=0）`,
      24, 374
    );
  }

  drawPanel();
  const panelTex = tex(new THREE.CanvasTexture(panelCanvas));
  const panelMat = mat(new THREE.SpriteMaterial({ map: panelTex, transparent: true }));
  const panelSprite = new THREE.Sprite(panelMat);
  panelSprite.position.set(-8, 2, 0);
  panelSprite.scale.set(2.5, 1.875, 1);
  group.add(panelSprite);

  let animT = 0;
  return {
    update(_t, dt) {
      animT += dt;
      // ISCO 轨道粒子
      const iscoTheta = animT * 0.5;
      particle.position.set(ISCO_R * Math.cos(iscoTheta), 0, ISCO_R * Math.sin(iscoTheta));

      // 不稳定轨道粒子螺旋坠落
      const spiralR = 2.8 - (animT % 4) * 0.15;
      const spiralTheta = animT * 0.8;
      if (spiralR > 0.6) {
        spiralParticle.position.set(spiralR * Math.cos(spiralTheta), 0, spiralR * Math.sin(spiralTheta));
      } else {
        // 回到初始不稳定轨道半径
        spiralParticle.position.set(2.8 * Math.cos(animT * 0.8), 0, 2.8 * Math.sin(animT * 0.8));
      }
    },
    dispose() {
      scene.remove(group);
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      texs.forEach((t) => t.dispose());
      geos.length = 0; mats.length = 0; texs.length = 0;
    }
  };
}
