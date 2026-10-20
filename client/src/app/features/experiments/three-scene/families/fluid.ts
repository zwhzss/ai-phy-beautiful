import type { SceneContext, SceneInstance } from '../types';
import { scaffold, panelSprite, lineFrom, PAL, ResourceBag } from './_common';

/**
 * 流体力学族（fluid）：翼型与边界层 / 空化 / 库埃特流 / 斯托克斯阻力 /
 * 液滴与表面张力 / 瑞利-贝纳德与瑞利-泰勒 / 马格努斯 / 泊肃叶与雷诺转捩 /
 * 湍流级串 / 伯努利与文丘里 / 卡门涡街。
 * 由 scene-registry 按 slug+variant 绑定：make(variant, title)。
 */
export function make(variant: string, title: string): (ctx: SceneContext) => SceneInstance {
  return (ctx) => scaffold(ctx, {
    title,
    camera: [0, 4, 14],
    build: (g, bag) => buildVariant(g, bag, ctx, variant, title),
  });
}

function buildVariant(
  g: import('three').Group,
  bag: ResourceBag,
  ctx: SceneContext,
  variant: string,
  title: string,
): (t: number, dt: number) => void {
  const { THREE } = ctx;
  switch (variant) {
    case 'airfoil': return build_airfoil(g, bag, THREE, title);
    case 'cavitation': return build_cavitation(g, bag, THREE, title);
    case 'couette': return build_couette(g, bag, THREE, title);
    case 'drag': return build_drag(g, bag, THREE, title);
    case 'droplet': return build_droplet(g, bag, THREE, title);
    case 'instability': return build_instability(g, bag, THREE, title);
    case 'magnus': return build_magnus(g, bag, THREE, title);
    case 'pipeflow': return build_pipeflow(g, bag, THREE, title);
    case 'turbulence': return build_turbulence(g, bag, THREE, title);
    case 'venturi': return build_venturi(g, bag, THREE, title);
    case 'vortexstreet': return build_vortexstreet(g, bag, THREE, title);
    default: return build_airfoil(g, bag, THREE, title);
  }
}

/** 便捷：可重绘曲线画布 */
function makePlot(
  bag: ResourceBag,
  THREE: typeof import('three'),
  w: number,
  h: number,
  world: number,
  x: number,
  y: number,
) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!;
  const tex = bag.tex(new THREE.CanvasTexture(cv));
  const m = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(world, (world * h) / w)),
    bag.mat(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false })),
  );
  m.position.set(x, y, 0);
  m.renderOrder = 997;
  function frame(titleTxt: string, xlabel: string, ylabel: string): CanvasRenderingContext2D {
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(7,11,20,0.85)';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#334155'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, w - 3, h - 3);
    c.strokeStyle = '#475569'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(46, 18); c.lineTo(46, h - 40); c.lineTo(w - 14, h - 40); c.stroke();
    c.fillStyle = '#f8fafc'; c.font = 'bold 18px sans-serif'; c.textAlign = 'center';
    c.fillText(titleTxt, w / 2, 26);
    c.fillStyle = '#94a3b8'; c.font = '16px sans-serif';
    c.fillText(xlabel, w / 2, h - 10);
    c.save(); c.translate(16, (h - 22) / 2); c.rotate(-Math.PI / 2);
    c.fillText(ylabel, 0, 0); c.restore();
    c.textAlign = 'left';
    return c;
  }
  return { mesh: m, c, frame, tex };
}

/** P70 边界层（平板 + 生长薄层分支）, P69 升力曲线与攻角（原分支保持） */
function build_airfoil(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const lift = title.includes('升力') || title.includes('攻角');
  // 边界层知识点：不再画 C_L-α 曲线与升力箭头，改画平板贴层 + u(y) 剖面 + δ(x) 曲线
  if (!lift) return boundaryLayerScene(g, bag, THREE);
  // —— 升力分支（保持原形态）——
  // 翼型（NACA 简化截面，用拉伸的椭圆近似）
  const foil = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(1, 24, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.slate, roughness: 0.5, metalness: 0.3 })),
  );
  foil.scale.set(2.6, 0.5, 1.0);
  g.add(foil);
  // 气流线（绕翼型）
  const streamGeo: import('three').BufferGeometry[] = [];
  for (let i = -3; i <= 3; i++) {
    const geo = bag.geo(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(81 * 3), 3));
    const l = new THREE.Line(geo, bag.mat(new THREE.LineBasicMaterial({
      color: i === 0 ? PAL.cyan : PAL.slate, transparent: true, opacity: i === 0 ? 0.9 : 0.5,
    })));
    g.add(l);
    streamGeo.push(geo);
  }
  // 升力箭头
  const liftArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1.4, 0), 2.0, PAL.red, 0.24, 0.12,
  );
  g.add(liftArrow);
  // 失速分离区：α > α_stall(15°) 时在翼型上表面后缘画红色紊乱分离线
  const A_STALL = 15; // 失速角（°），与 panel / 画布标注、C_L 曲线阈值统一
  const SEP = 14;
  const sepGeo = bag.geo(new THREE.BufferGeometry());
  sepGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SEP * 3), 3));
  const sepLine = new THREE.Line(sepGeo, bag.mat(new THREE.LineBasicMaterial({
    color: PAL.red, transparent: true, opacity: 0.9,
  })));
  sepLine.visible = false;
  g.add(sepLine);
  const sepArr = (sepGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  const plot = makePlot(bag, THREE, 360, 320, 4.2, 6.6, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '升力曲线：C_L = 2π sin(α + α₀)（薄翼理论，小攻角）', color: '#f8fafc' },
    { text: 'α 超过失速角 ~15° → 边界层分离 → 升力骤降', color: '#94a3b8' },
    { text: '读数：红线 = C_L 曲线，青线 = 绕翼气流，失速时翼面红抖线 = 分离区', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  // C_L(α)：线性段斜率 0.11/° ≈ 2π/rad，α > α_stall 后指数跌落（在 α_stall 处连续）
  const clOf = (a: number) => (a < A_STALL
    ? 0.11 * a
    : Math.max(0.4, 0.11 * A_STALL * Math.exp(-(a - A_STALL) / 5)));
  const drawCurve = (alpha: number) => {
    const c = plot.frame('升力曲线 C_L(α)', 'α (°)', 'C_L');
    const W = 360, H = 320;
    // 失速角竖线
    c.strokeStyle = '#64748b'; c.setLineDash([5, 4]); c.lineWidth = 2;
    const sx = 46 + ((A_STALL + 4) / 24) * (W - 62);
    c.beginPath(); c.moveTo(sx, 30); c.lineTo(sx, H - 40); c.stroke();
    c.setLineDash([]);
    c.strokeStyle = '#ef4444'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 80; i++) {
      const a = -4 + (i / 80) * 24;
      const cl = clOf(a);
      const px = 46 + ((a + 4) / 24) * (W - 62);
      const py = (H - 40) - (cl / 2) * (H - 70);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    const a = alpha;
    const cl = clOf(a);
    const px = 46 + ((a + 4) / 24) * (W - 62);
    const py = (H - 40) - (cl / 2) * (H - 70);
    c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(px, py, 7, 0, 7); c.fill();
    c.fillStyle = '#94a3b8'; c.fillText(`峰值≈失速角 ${A_STALL}°`, 56, 56);
    plot.tex.needsUpdate = true;
  };
  drawCurve(8);
  return (t: number, dt: number) => {
    void dt;
    const alpha = 4 + 16 * (Math.sin(t * 0.4) * 0.5 + 0.5); // 4°–20°：游标穿过峰值进入失速下降段
    foil.rotation.z = (alpha * Math.PI) / 180;
    // 失速成因：α > α_stall 时上表面后缘出现分离（红色紊乱线），与 C_L 跌落同步
    sepLine.visible = alpha > A_STALL;
    if (sepLine.visible) {
      const ar = (alpha * Math.PI) / 180;
      for (let k = 0; k < SEP; k++) {
        const u = k / (SEP - 1);
        const xl = 0.2 + u * 2.1; // 翼型弦向后缘段（局部坐标）
        const yl = 0.5 * Math.sqrt(Math.max(0, 1 - (xl / 2.6) ** 2)) + 0.1 + u * 0.3
          + 0.09 * u * Math.sin(t * 9 + u * 7); // 分离区紊乱
        sepArr[k * 3] = xl * Math.cos(ar) - yl * Math.sin(ar);
        sepArr[k * 3 + 1] = xl * Math.sin(ar) + yl * Math.cos(ar);
        sepArr[k * 3 + 2] = 0;
      }
      (sepGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    }
    streamGeo.forEach((geo, i) => {
      const arr = (geo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
      const y0 = (i - 3) * 0.7;
      for (let k = 0; k <= 80; k++) {
        const x = (k / 80) * 14 - 7;
        const near = Math.exp(-(x * x) / 8);
        const deflect = near * (y0 >= 0 ? 0.6 : -0.6) * (1.4 - Math.abs(y0) * 0.3);
        arr[k * 3] = x;
        arr[k * 3 + 1] = y0 + deflect + 0.06 * Math.sin(t * 4 + k * 0.3 + i);
        arr[k * 3 + 2] = 0;
      }
      (geo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    });
    // 升力箭头长度按 C_L(α) 归一化：随升力线性升，越过失速角(15°)后随 C_L 骤降而缩短
    // （原 1.2+2.4·sin(α) 在 4°–20° 单调变长，与同帧 C_L 跌落、分离抖线结论相反）
    liftArrow.setLength(0.8 + 1.8 * (clOf(alpha) / 1.65), 0.24, 0.12);
    drawCurve(alpha);
  };
}

/**
 * 边界层场景（教学示意）：
 *  - 沿平板贴一条生长薄层 δ(x)=5x/√Re_x（色带；转捩位置后湍流段更陡加厚）
 *  - 取 4 个站位画壁面法向速度剖面 u(y)：层流 Blasius 型 / 湍流 1/7 次幂更饱满 / 分离点回流
 *  - 画布 δ(x)∝√x（层流/湍流两段），读数说明 δ 与 x、Re_x 关系并标分离点
 */
function boundaryLayerScene(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
): (t: number, dt: number) => void {
  const plateLen = 8;
  // 平板（零攻角，上表面即无滑移壁面 y=0；前缘 x=0，世界坐标 X = x − plateLen/2）
  const plate = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(plateLen, 0.18, 0.8)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.slate, roughness: 0.5, metalness: 0.3 })),
  );
  plate.position.set(0, -0.09, 0);
  g.add(plate);
  // 来流线（平直近似，仅微波动：边界层分支无升力弯折）
  const streamGeo: import('three').BufferGeometry[] = [];
  for (let i = 1; i <= 4; i++) {
    const geo = bag.geo(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(81 * 3), 3));
    const l = new THREE.Line(geo, bag.mat(new THREE.LineBasicMaterial({
      color: PAL.slate, transparent: true, opacity: 0.5,
    })));
    g.add(l);
    streamGeo.push(geo);
  }
  // 边界层色带：底边贴壁、顶边 y=δ(x)，青=层流段 / 金=湍流段（转捩后变陡）
  const NX = 64;
  const bandGeo = bag.geo(new THREE.BufferGeometry());
  const bandPos = new Float32Array((NX + 1) * 2 * 3);
  const bandCol = new Float32Array((NX + 1) * 2 * 3);
  bandGeo.setAttribute('position', new THREE.BufferAttribute(bandPos, 3));
  bandGeo.setAttribute('color', new THREE.BufferAttribute(bandCol, 3));
  const bandIdx: number[] = [];
  for (let i = 0; i < NX; i++) {
    const a = i * 2;
    bandIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  bandGeo.setIndex(bandIdx);
  const band = new THREE.Mesh(bandGeo, bag.mat(new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.6, side: THREE.DoubleSide,
  })));
  band.position.z = 0.42;
  g.add(band);
  // 转捩 / 分离站位与厚度公式（教学近似：层流 δ∝√x，湍流 δ∝x^{4/5} 更快加厚）
  const xTr = 4.6;
  const xSep = 6.9;
  const dLam = (x: number) => 0.42 * Math.sqrt(Math.max(x, 0.05));
  const dAll = (x: number) => (x <= xTr ? dLam(x) : dLam(xTr) * Math.pow(x / xTr, 0.8));
  // 速度剖面形状：层流 Blasius 型多项式近似；湍流 1/7 次幂更饱满
  const lamProfile = (eta: number) => 1.5 * eta - 0.5 * eta * eta * eta;
  const turbProfile = (eta: number) => Math.pow(Math.min(1, eta), 1 / 7);
  // 4 个站位的 u(y) 剖面线（第 4 站在分离点附近，近壁回流 u<0）
  const stations = [
    { x: 1.4, turb: false, sep: false, color: PAL.cyan },
    { x: 3.2, turb: false, sep: false, color: PAL.cyan },
    { x: 5.2, turb: true, sep: false, color: PAL.gold },
    { x: 6.9, turb: false, sep: true, color: PAL.red },
  ];
  const stationLines = stations.map((st) => {
    const geo = bag.geo(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(21 * 3), 3));
    const ln = new THREE.Line(geo, bag.mat(new THREE.LineBasicMaterial({ color: st.color })));
    g.add(ln);
    return geo;
  });
  // 分离点附近回流箭头（贴壁、指向上游）
  const backFlow = [6.55, 7.2].map((x) => {
    const a = new THREE.ArrowHelper(
      new THREE.Vector3(-1, 0.12, 0), new THREE.Vector3(x - plateLen / 2, 0.16, 0.42),
      0.7, PAL.red, 0.16, 0.08,
    );
    g.add(a);
    return a;
  });
  const plot = makePlot(bag, THREE, 360, 320, 4.2, 6.6, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '边界层：δ(x) = 5x/√Re_x → 层流段 δ∝√x；转捩后湍流 δ∝x^{4/5} 更快加厚', color: '#f8fafc' },
    { text: '逆压梯度使近壁流体减速 → 分离点（回流 u<0）→ 形状阻力骤增', color: '#94a3b8' },
    { text: '读数：色带 = 边界层（青/金），竖线 = 站位 u(y) 剖面，红箭头 = 回流（示意）', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawDelta = (xs: number) => {
    const c = plot.frame('边界层厚度 δ(x)', 'x（自前缘）', 'δ');
    const W = 360, H = 320;
    const px = (x: number) => 46 + (x / plateLen) * (W - 62);
    const py = (d: number) => (H - 40) - (d / 1.6) * (H - 70);
    // 层流段：δ∝√x（青）
    c.strokeStyle = '#06b6d4'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 40; i++) {
      const x = (i / 40) * xTr;
      if (i === 0) c.moveTo(px(x), py(dLam(x))); else c.lineTo(px(x), py(dLam(x)));
    }
    c.stroke();
    // 湍流段：转捩后变陡加厚（金）
    c.strokeStyle = '#fbbf24'; c.beginPath();
    for (let i = 0; i <= 40; i++) {
      const x = xTr + (i / 40) * (plateLen - xTr);
      if (i === 0) c.moveTo(px(x), py(dAll(x))); else c.lineTo(px(x), py(dAll(x)));
    }
    c.stroke();
    // 转捩与分离位置虚线
    c.strokeStyle = '#64748b'; c.setLineDash([5, 4]); c.lineWidth = 2;
    c.beginPath(); c.moveTo(px(xTr), 24); c.lineTo(px(xTr), H - 40); c.stroke();
    c.beginPath(); c.moveTo(px(xSep), 24); c.lineTo(px(xSep), H - 40); c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#06b6d4'; c.fillText('层流 δ∝√x', 58, 52);
    c.fillStyle = '#fbbf24'; c.fillText('湍流更快', px(xTr) + 8, 52);
    c.fillStyle = '#94a3b8'; c.fillText('转捩', px(xTr) - 62, 68);
    c.fillStyle = '#ef4444'; c.fillText('分离', px(xSep) - 24, 68);
    // 游标：沿 x 扫过，读数 δ 与 Re_x 关系——δ 直接取画布曲线/色带同源的 dAll(xs)，
    // 不再用与几何系数(0.42√x)不同的 5x/√(60x+1)(≈0.65√x)，避免同一帧数值与色带厚度差约 1.5 倍
    const d = dAll(xs);
    c.fillStyle = '#f472b6'; c.beginPath(); c.arc(px(xs), py(d), 7, 0, 7); c.fill();
    c.fillStyle = '#f8fafc'; c.fillText(
      `x=${xs.toFixed(1)}  δ=${d.toFixed(2)}（=色带厚度）  Re_x∝x ⇒ δ∝√x`,
      60, H - 56,
    );
    plot.tex.needsUpdate = true;
  };
  drawDelta(2);
  return (t: number) => {
    const growth = 0.8 + 0.2 * Math.sin(t * 0.7); // 薄层缓慢"生长"（示意）
    // 更新色带几何与颜色（壁面暗 → 外缘亮，表示 u 由 0 增至 U）
    for (let i = 0; i <= NX; i++) {
      const x = (i / NX) * plateLen;
      const d = dAll(x) * growth;
      const X = x - plateLen / 2;
      bandPos[i * 6] = X; bandPos[i * 6 + 1] = 0.015; bandPos[i * 6 + 2] = 0;
      bandPos[i * 6 + 3] = X; bandPos[i * 6 + 4] = d; bandPos[i * 6 + 5] = 0;
      const turb = x > xTr;
      const r0 = turb ? 0.98 : 0.02, g0 = turb ? 0.75 : 0.71, b0 = turb ? 0.14 : 0.83;
      bandCol[i * 6] = r0 * 0.4; bandCol[i * 6 + 1] = g0 * 0.4; bandCol[i * 6 + 2] = b0 * 0.4;
      bandCol[i * 6 + 3] = r0; bandCol[i * 6 + 4] = g0; bandCol[i * 6 + 5] = b0;
    }
    (bandGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    (bandGeo.getAttribute('color') as import('three').BufferAttribute).needsUpdate = true;
    // 更新站位速度剖面 u(y)
    stations.forEach((st, si) => {
      const geo = stationLines[si];
      const arr = (geo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
      const d = dAll(st.x) * growth;
      for (let k = 0; k <= 20; k++) {
        const eta = k / 20; // η = y/δ
        const y = eta * d * 1.3;
        // 分离站：叠近壁回流项，壁面处 u<0（剖面出现反弯点）
        const u = st.sep
          ? lamProfile(eta) - 0.6 * Math.pow(1 - eta, 2)
          : st.turb ? turbProfile(eta) : lamProfile(eta);
        arr[k * 3] = st.x - plateLen / 2 + u * 0.9;
        arr[k * 3 + 1] = 0.02 + y;
        arr[k * 3 + 2] = 0.42;
      }
      (geo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    });
    // 来流线微波动（无绕翼偏折）
    streamGeo.forEach((geo, i) => {
      const arr = (geo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
      const y0 = 0.55 + i * 0.65;
      for (let k = 0; k <= 80; k++) {
        const x = (k / 80) * 14 - 7;
        arr[k * 3] = x;
        arr[k * 3 + 1] = y0 + 0.04 * Math.sin(t * 3 + k * 0.35 + i * 1.7);
        arr[k * 3 + 2] = 0.42;
      }
      (geo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    });
    // 回流箭头随分离强度脉动
    backFlow.forEach((a, i) => a.setLength(0.5 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.2 + i)), 0.16, 0.08));
    drawDelta(((t * 0.9) % plateLen));
  };
}

/** P73 空化 */
function build_cavitation(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title;
  // 螺旋桨/泵叶轮：桨轴沿 +x，与来流方向及气泡迁移方向一致（叶盘在 y–z 平面内绕 x 自旋）
  const OMEGA = 4;      // 角速度（rad/s），绕 +x（=来流）
  const R_TIP = 2.4;    // 叶尖半径
  const P_MIN = 0.2;    // 压力谷最小值（图上，p∞=1 基准）
  const P_V = 0.35;     // 汽化压
  const prop = new THREE.Group();
  g.add(prop);
  const hub = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 20)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.slate, metalness: 0.6, roughness: 0.4 })),
  );
  hub.rotation.z = Math.PI / 2; // 毂轴沿 x（来流方向）
  prop.add(hub);
  for (let i = 0; i < 3; i++) {
    const phi = (i / 3) * Math.PI * 2;
    const b = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(0.18, 2.2, 0.72)), // 薄沿 x、长轴 local y 径向、弦沿 z
      bag.mat(new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.5, roughness: 0.4 })),
    );
    b.position.set(0, Math.cos(phi) * 1.3, Math.sin(phi) * 1.3); // 外移到环隙中部半径
    b.rotation.x = phi;   // 绕自旋轴(x)布相位，使长轴指向该方位
    b.rotation.y = 0.35;  // 桨距（迎流角）
    prop.add(b);
  }
  // 来流箭头：标定 +x 方向（与桨轴、气泡迁移一致）
  g.add(new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(-6.4, 0, 0), 3.0, PAL.slate, 0.32, 0.16,
  ));
  g.add(new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(3.4, 0, 0), 2.0, PAL.slate, 0.3, 0.15,
  ));
  // 空化气泡：叶尖（y–z 平面内半径 R_TIP）生成 → 沿 +x 迁移 → 末端收缩溃灭
  const NB = 36;
  const bubbles: import('three').Mesh[] = [];
  for (let i = 0; i < NB; i++) {
    const m = new THREE.Mesh(
      bag.geo(new THREE.SphereGeometry(0.14, 10, 8)),
      bag.mat(new THREE.MeshStandardMaterial({
        color: PAL.cyan, transparent: true, opacity: 0.85, roughness: 0.2,
      })),
    );
    g.add(m);
    bubbles.push(m);
  }
  // 压力曲线（低于汽化压 → 空化）
  const plot = makePlot(bag, THREE, 360, 320, 4.2, 6.6, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '空化：桨轴沿来流(+x)，叶尖低压谷 p_min < p_v（汽化压）→ 气泡生成并向下游迁移', color: '#f8fafc' },
    { text: '空化数 σ = (p∞−p_v)/(½ρv²_tip)；σ 越小越易空化，溃灭产生微射流/冲击波（空蚀、噪声）', color: '#94a3b8' },
    { text: '读数：青球=气泡(叶尖→沿+x溃灭)，灰箭头=来流，金游标=叶背压力谷，σ 见画布', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawP = (xLow: number) => {
    const c = plot.frame('压力分布 p(x)', 'x（→ 下游 = 来流方向）', 'p');
    const W = 360, H = 320;
    c.strokeStyle = '#f59e0b'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 80; i++) {
      const x = (i / 80) * 14 - 7;
      const pp = 1 - (1 - P_MIN) * Math.exp(-((x - xLow) ** 2) / 3); // 谷深 = 1 − p_min（与 P_MIN 同源）
      const px = 46 + ((x + 7) / 14) * (W - 62);
      const py = (H - 40) - pp * (H - 70);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    const pvY = (H - 40) - P_V * (H - 70);
    c.strokeStyle = '#ef4444'; c.setLineDash([5, 5]); c.lineWidth = 2;
    c.beginPath(); c.moveTo(46, pvY); c.lineTo(W - 14, pvY); c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#ef4444'; c.fillText('p_v 汽化压', 60, pvY - 8);
    // 游标停在压力谷：p_min < p_v ⇒ 该处发生空化
    const cpx = 46 + ((xLow + 7) / 14) * (W - 62);
    const cpy = (H - 40) - P_MIN * (H - 70);
    c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(cpx, cpy, 7, 0, 7); c.fill();
    c.fillStyle = '#ef4444'; c.fillText('p谷 < p_v', Math.max(56, Math.min(W - 120, cpx - 34)), cpy + 24);
    // 空化数 σ 读数：由压力谷 p_min 与汽化压 p_v 同源算出（图上 ½ρv²_tip = 谷深 = 1 − p_min）
    const sigma = (1 - P_V) / (1 - P_MIN);
    c.fillStyle = '#f8fafc';
    c.fillText(`σ=(p∞−p_v)/(½ρv²)=(1−${P_V})/(1−${P_MIN})≈${sigma.toFixed(2)}`, 58, 58);
    c.fillStyle = '#94a3b8';
    c.fillText(`v_tip=ω·r≈${(OMEGA * R_TIP).toFixed(1)}（ω=${OMEGA}, r=${R_TIP}）`, 58, 80);
    plot.tex.needsUpdate = true;
  };
  drawP(2.4);
  return (t: number, dt: number) => {
    void dt;
    prop.rotation.x = t * OMEGA; // 叶轮绕桨轴(+x，=来流方向)自旋，叶尖相位与气泡/压力谷同步
    // 气泡：叶尖（y–z 圆）产生 → 沿 +x 迁移 → cyc>0.7 收缩溃灭
    bubbles.forEach((m, i) => {
      const cyc = ((t * 0.7 + i / NB) % 1);
      const a = (i / NB) * Math.PI * 2 + t * OMEGA; // 叶尖相位 → 螺旋尾迹
      const col = cyc > 0.7 ? Math.max(0, 1 - (cyc - 0.7) / 0.3) : 1; // 溃灭收缩因子
      m.visible = col > 0.02;
      if (!m.visible) return;
      m.position.set(
        cyc * 3.6,                                                   // 沿 +x（来流）向下游迁移
        Math.cos(a) * R_TIP + 0.1 * Math.sin(a * 2 + cyc * 5),       // 叶尖圆 + 轻微湍动
        Math.sin(a) * R_TIP,
      );
      m.scale.setScalar(col);
      (m.material as import('three').MeshStandardMaterial).opacity = 0.85 * Math.min(1, col * 1.3);
    });
    drawP(Math.cos(t * OMEGA) * 2.4 + 1.6); // 压力谷与叶尖扫过相位联动
  };
}

/** P190 泰勒-库埃特流：内筒转/外筒静止的正确周向剖面 + 超临界泰勒涡环链 */
// 泰勒涡对数的迟滞记忆（防止 Ta 在临界附近往复时环数频繁抖动）
let lastPairs = 0;
function build_couette(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title;
  // 几何与运动参数：内筒旋转（ω_i）、外筒静止——原剖面误用"外筒转"解且被 clamp 成零线
  const ri = 1.6, ro = 3.2, omi = 2.0, LEN = 4.4;
  const vOf = (r: number) => omi * ri * (ro / r - r / ro) / (ro / ri - ri / ro); // v_θ(r_i)=ω_i r_i, v_θ(r_o)=0
  const vMax = omi * ri; // 归一化基准
  // Taylor 数口径：Ta = (Ω_i R_i d/ν)²·(d/R_i)（d = 环隙宽度），刚性边界 Ta_c ≈ 1708
  // ⇔ 临界间隙 Reynolds 数 Re_gap = Ω_i R_i d/ν ≈ 41.3（此处 d/R_i = 1，故 41.3² ≈ 1708）
  const TA_C = 1708;
  const taOf = (reGap: number) => reGap * reGap * ((ro - ri) / ri);
  // 同心圆筒（内筒旋转）
  const inner = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(1.6, 1.6, 4.4, 40, 1, true)),
    bag.mat(new THREE.MeshStandardMaterial({
      color: PAL.cyan, transparent: true, opacity: 0.5, side: THREE.DoubleSide, roughness: 0.4,
    })),
  );
  g.add(inner);
  const outer = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(3.2, 3.2, 4.4, 40, 1, true)),
    bag.mat(new THREE.MeshStandardMaterial({
      color: 0x475569, transparent: true, opacity: 0.35, side: THREE.DoubleSide, roughness: 0.5,
    })),
  );
  g.add(outer);
  // 速度剖面（正确的内筒转解析解，随半径单调衰减、无负值截断）
  const N = 60;
  const profileGeo = bag.geo(new THREE.BufferGeometry());
  profileGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const profile = new THREE.Line(profileGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.gold })));
  g.add(profile);
  const pa = (profileGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  // 流体微团（周向差速 + 超临界后叠加沿轴向往复环流 → 涡串）
  const NP = 30;
  const pg = bag.geo(new THREE.BufferGeometry());
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  g.add(new THREE.Points(pg, bag.mat(new THREE.PointsMaterial({ color: PAL.pink, size: 0.16, sizeAttenuation: true }))));
  const parr = (pg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  // 泰勒涡环池：最多 4 对（8 环），沿轴向排布、转向交替；亚临界时全部隐藏（示意）
  const cells: import('three').Mesh[] = [];
  for (let j = 0; j < 8; j++) {
    const m = new THREE.Mesh(
      bag.geo(new THREE.TorusGeometry(2.4, 0.5, 10, 36)),
      bag.mat(new THREE.MeshBasicMaterial({
        color: j % 2 ? PAL.cyan : PAL.violet, transparent: true, opacity: 0.3,
      })),
    );
    m.rotation.x = Math.PI / 2; // 环轴沿筒轴（y），位于环隙中部半径
    m.visible = false;
    g.add(m);
    cells.push(m);
  }
  const plot = makePlot(bag, THREE, 340, 300, 3.8, 6.8, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '泰勒-库埃特流：内筒转、外筒静，v_θ(r)=ω_i r_i·(r_o/r−r/r_o)/(r_o/r_i−r_i/r_o)', color: '#f8fafc' },
    { text: '本场景约定 Ta=(Ω_iR_i d/ν)²·(d/R_i)=Re_gap²·(d/R_i)，Ta_c≈1708 ⇔ 临界 Re_gap≈41.3', color: '#94a3b8' },
    { text: '注：与常见 Taylor 数 Ta=4Ω²R³d/ν² 差因子 4（纯约定，故临界 Re 他处约 20.7）', color: '#64748b' },
    { text: '读数：内筒（青）旋转，金线 = v_θ(r)，粉点径向速度符号区分相邻胞反向环流，环=涡对', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawProfile = (Ta: number, pairs: number) => {
    const c = plot.frame('速度剖面 v_θ(r)', 'r', 'v_θ');
    const W = 340, H = 300;
    // 周向剖面：v_θ = ω_i r_i(r_o/r − r/r_o)/(r_o/r_i − r_i/r_o)，不再出现负值 clamp
    c.strokeStyle = '#fbbf24'; c.lineWidth = 3; c.beginPath();
    for (let i = 1; i <= 60; i++) {
      const r = 1.6 + (i / 60) * 1.6;
      const vn = vOf(r) / vMax; // 0..1 自然单调，无需 clamp
      const px = 46 + ((i / 60)) * (W - 62);
      const py = (H - 40) - vn * (H - 70);
      if (i === 1) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    // 边界标注：内筒壁 v=ω_i r_i，外筒壁 v=0（无滑移）
    c.fillStyle = '#06b6d4'; c.fillText('内筒壁 ω_i r_i', 50, 52);
    c.fillStyle = '#94a3b8'; c.fillText('外筒壁 = 0', W - 120, H - 60);
    // 第二行：Ta 扫过临界 + 涡对数 N=⌈L/λc⌉
    c.fillStyle = '#f8fafc';
    c.fillText(`Ta ≈ ${Ta.toFixed(0)}（Ta_c ≈ 1708：${Ta > TA_C ? '超临界' : '亚临界'}）`, 50, 74);
    c.fillStyle = Ta > TA_C ? '#a78bfa' : '#64748b';
    c.fillText(Ta > TA_C ? `涡对数 N = ⌈L/λc⌉ = ${pairs}` : '涡对数 N = 0（纯周向 Couette 流）', 50, 96);
    plot.tex.needsUpdate = true;
  };
  drawProfile(taOf(20), 0);
  return (t: number, dt: number) => {
    inner.rotation.y = t * omi;
    // 间隙 Reynolds 数 Re_gap 随时间扫过临界值 41.3（教学示意）→ Ta = Re_gap²·(d/R_i)
    const reGap = 20 + 62 * (Math.sin(t * 0.16) * 0.5 + 0.5);
    const Ta = taOf(reGap);
    const sup = Math.max(0, Ta / TA_C - 1); // 超临界程度
    // 涡对数 N=⌈L/λc⌉：轴向波长随超临界程度略缩（教学近似），并做迟滞防抖动
    const lc = Math.max(1.1, (ro - ri) * 2 / (1 + 1.2 * sup));
    const pairs = Ta > TA_C ? Math.max(lastPairs, Math.min(4, Math.ceil(LEN / lc))) : 0;
    lastPairs = Ta > TA_C ? Math.min(4, Math.ceil(LEN / lc)) : 0;
    // 涡环显隐与布局：2×pairs 个环沿轴向排布、转向交替、缓慢滚动
    const nCells = pairs * 2;
    const cellH = nCells > 0 ? 4.4 / nCells : 4.4;
    const flat = Math.min(0.9, cellH / 1.2); // 密集链时沿筒轴压扁管截面，避免涡环互相穿插
    cells.forEach((m, j) => {
      const on = j < nCells;
      m.visible = on;
      if (!on) return;
      m.position.y = -2.2 + (j + 0.5) * cellH;
      // 相邻涡环转向交替：用绕自身轴的摆动相位相反来示意（环本身轴对称）
      m.rotation.z = (j % 2 ? 1 : -1) * 0.22 * Math.sin(t * 1.4 + j);
      const pulse = 1 + 0.04 * Math.sin(t * 2 + j);
      m.scale.set(pulse, pulse, flat);
    });
    // 微团：内快外慢差速周向 + 超临界时按涡对做沿轴向往复环流
    for (let i = 0; i < NP; i++) {
      const rBase = 1.8 + (i / NP) * 1.2;
      const w = omi * ri / rBase; // 近似角速度随半径衰减
      const a = t * w + (i / NP) * Math.PI * 4;
      let rr = rBase;
      let y: number;
      if (nCells > 0) {
        const ci = i % nCells;
        const yc = -2.2 + (ci + 0.5) * cellH;
        const dir = ci % 2 === 0 ? 1 : -1; // 相邻涡环环流反向
        const phi = t * 2.2 * dir + i * 0.7;
        const amp = Math.min(0.8, 0.25 + sup * 0.5);
        // 径向振荡限制在环隙 (ri, ro) 内，避免穿透筒壁
        rr = Math.min(ro - 0.1, Math.max(ri + 0.1, rBase + 0.42 * amp * Math.cos(phi)));
        y = yc + (cellH * 0.45) * amp * Math.sin(phi);
      } else {
        y = ((i % 5) / 5 - 0.5) * 4.0; // 亚临界：轴向基本不动
      }
      parr[i * 3] = Math.cos(a) * rr;
      parr[i * 3 + 1] = y;
      parr[i * 3 + 2] = Math.sin(a) * rr;
    }
    (pg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    // 3D 速度剖面线（金线）：x=−5.5+v̂*2.8，r 由内向外
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const r = 1.6 + u * 1.6;
      const v = vOf(r) / vMax;
      pa[i * 3] = -5.5 + v * 2.8;
      pa[i * 3 + 1] = -2.4 + u * 4.4;
      pa[i * 3 + 2] = 3.6;
    }
    (profileGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    drawProfile(Ta, pairs);
    void dt;
  };
}

/** P189 斯托克斯阻力 */
function build_drag(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title;
  // 球体（在流体中下落）
  const ball = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.8, 24, 18)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, metalness: 0.5, roughness: 0.4 })),
  );
  g.add(ball);
  // 阻力/重力/浮力箭头
  const gravity = new THREE.ArrowHelper(
    new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 0), 2.4, PAL.red, 0.22, 0.11,
  );
  const dragF = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 1.6, PAL.cyan, 0.22, 0.11,
  );
  g.add(gravity); g.add(dragF);
  // 低 Re（Stokes）绕球流线：前后对称、无尾迹——Re ≪ 1 时没有涡脱落
  // ψ = ½U sin²θ(r² − a³/r) = ½Ub² → 每个 θ 解 r³ − (b²/sin²θ)r − a³ = 0 的唯一正根（b > a）
  const A_B = 0.8; // 球半径
  const rootOf = (q: number): number => {
    let lo = Math.max(A_B, Math.sqrt(q / 3));
    let hi = Math.sqrt(q + A_B * A_B);
    for (let i = 0; i < 40; i++) { // 二分：f(lo) < 0 < f(hi)
      const mid = (lo + hi) / 2;
      if (mid * mid * mid - q * mid - A_B * A_B * A_B > 0) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  };
  const flowGroup = new THREE.Group();
  g.add(flowGroup);
  for (const b of [-2.6, -1.6, -1.0, 1.0, 1.6, 2.6]) {
    const pts: import('three').Vector3[] = [];
    const sgn = b < 0 ? -1 : 1;
    for (let k = 0; k <= 60; k++) {
      const th = 0.05 + (k / 60) * (Math.PI - 0.1);
      const r = rootOf((b * b) / (Math.sin(th) * Math.sin(th)));
      pts.push(new THREE.Vector3(
        sgn * r * Math.sin(th),
        Math.max(-3.8, Math.min(3.8, r * Math.cos(th))),
        0,
      ));
    }
    flowGroup.add(lineFrom(THREE, bag, pts, PAL.slate, false));
  }
  const plot = makePlot(bag, THREE, 340, 300, 3.8, 6.8, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '斯托克斯阻力：F_d = 6πηrv（低 Re 层流，Re ≪ 1）', color: '#f8fafc' },
    { text: '终端速度 v_t = 2r²(ρ_p−ρ_f)g/(9η)（油滴法测 η）', color: '#94a3b8' },
    { text: '读数：金球加速趋 v_t，红 = 重力，青 = 阻力，灰线 = 绕球流线（前后对称）', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawV = (v: number, tt: number) => {
    const c = plot.frame('v(t) 趋向终端速度', 't', 'v');
    const W = 340, H = 300;
    c.strokeStyle = '#22c55e'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 80; i++) {
      const tt = (i / 80) * 6;
      const vv = 1 - Math.exp(-tt / 1.4);
      const px = 46 + (tt / 6) * (W - 62);
      const py = (H - 40) - vv * (H - 70);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    const vv = Math.min(1, v);
    const px = 46 + ((tt % 6) / 6) * (W - 62);
    const py = (H - 40) - vv * (H - 70);
    c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(px, py, 7, 0, 7); c.fill();
    c.fillStyle = '#94a3b8'; c.fillText('渐近 = v_t（阻力=重力−浮力）', 50, 56);
    plot.tex.needsUpdate = true;
    void v;
  };
  drawV(0.5, 0);
  return (t: number, dt: number) => {
    void dt;
    // 统一动力学：v(t) = v_t(1 − e^{−t/τ})，位移由 ∫v dt′ 积分得到——
    // 球从静止加速、趋近终端速度（与画布曲线、青色阻力箭头同一来源）
    const TC = 6; // 与 v(t) 画布横轴一致的下落周期
    const tau = t % TC;
    const v = 1 - Math.exp(-tau / 1.4);
    const s = tau - 1.4 * (1 - Math.exp(-tau / 1.4));         // ∫₀^τ v dt′
    const sEnd = TC - 1.4 * (1 - Math.exp(-TC / 1.4));         // ∫₀^TC v dt′
    const y = 3.2 - 6.4 * (s / sEnd);
    ball.position.y = y;
    flowGroup.position.y = y; // 定常绕流：流线组随球
    gravity.position.y = y;
    gravity.setLength(2.4, 0.22, 0.11);
    dragF.position.y = y;
    dragF.setLength(0.6 + v * 1.6, 0.22, 0.11);
    drawV(v, t);
  };
}

/** P191 毛细波与表面张力（色散分支重画）, P193 液滴与表面张力测量（原分支保持） */
function build_droplet(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const capillary = title.includes('毛细');
  // 液面
  const surface = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(10, 6, 40, 24)),
    bag.mat(new THREE.MeshStandardMaterial({
      color: PAL.cyan, transparent: true, opacity: 0.5, side: THREE.DoubleSide, roughness: 0.3,
    })),
  );
  surface.rotation.x = -Math.PI / 2;
  g.add(surface);
  const surfArr = (surface.geometry.getAttribute('position') as import('three').BufferAttribute);
  // 液滴（毛细分支 = 点扰源；液滴分支 = 振荡变形主体）
  const drop = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.8, 24, 18)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.blue, roughness: 0.2, metalness: 0.1 })),
  );
  drop.position.y = 0.6;
  g.add(drop);
  const plot = makePlot(bag, THREE, 340, 300, 3.8, 6.8, 0.8);
  g.add(plot.mesh);

  if (capillary) {
    // —— 毛细波分支：色散关系 c_p(k)=√(γk/ρ+g/k)，两组波长不同的波前同震源扩散 ——
    g.add(panelSprite(THREE, bag, [
      { text: '毛细波色散：ω² = (γk³ + gk)/ρ → 相速度 c_p(k) = √(γk/ρ + g/k)', color: '#f8fafc' },
      { text: '短波（cm 级）表面张力主导 c_p∝√k 跑得快；长波重力主导 c_p∝1/√k 慢', color: '#94a3b8' },
      { text: '读数：金密环 = 短波（快），紫疏环 = 长波（慢），环间距 ∝ 波长（示意）', color: '#fbbf24' },
    ], [0, 4.4, 0], 7.8, 'center'));
    // 环状波前池：短波 8 环（间距小、扩散快）、长波 5 环（间距大、扩散慢）
    const mkRings = (count: number, color: number): import('three').Mesh[] => {
      const arr: import('three').Mesh[] = [];
      for (let i = 0; i < count; i++) {
        const m = new THREE.Mesh(
          bag.geo(new THREE.RingGeometry(0.92, 1.0, 64)),
          bag.mat(new THREE.MeshBasicMaterial({
            color, side: THREE.DoubleSide, transparent: true, opacity: 0.8,
          })),
        );
        m.rotation.x = -Math.PI / 2;
        m.position.y = 0.06;
        g.add(m);
        arr.push(m);
      }
      return arr;
    };
    const shortRings = mkRings(8, PAL.gold);
    const longRings = mkRings(5, PAL.violet);
    const LAM_S = 0.55, CSP_S = 2.1; // 短波：波长小、相速大（张力主导段）
    const LAM_L = 1.7, CSP_L = 0.75; // 长波：波长大、相速小（重力主导段）
    const RMAX = 4.6;
    // 画布：c_p(k) 单谷曲线（无量纲 γ/ρ=1、g=1，教学示意）
    const drawCap = (kDot: number) => {
      const c = plot.frame('毛细波相速度 c_p(k)', 'k（→ 短波）', 'c_p');
      const W = 340, H = 300;
      const cp = (k: number) => Math.sqrt(k + 1 / k);
      const px = (k: number) => 46 + ((k - 0.2) / 3.6) * (W - 62);
      const py = (v: number) => (H - 40) - ((v - 1.1) / 1.35) * (H - 70);
      // 重力主导段（k<1，∝1/√k，蓝）
      c.strokeStyle = '#60a5fa'; c.lineWidth = 3; c.beginPath();
      for (let i = 0; i <= 24; i++) {
        const k = 0.2 + (i / 24) * 0.8;
        if (i === 0) c.moveTo(px(k), py(cp(k))); else c.lineTo(px(k), py(cp(k)));
      }
      c.stroke();
      // 表面张力主导段（k>1，∝√k，金）
      c.strokeStyle = '#f59e0b'; c.beginPath();
      for (let i = 0; i <= 40; i++) {
        const k = 1 + (i / 40) * 2.8;
        if (i === 0) c.moveTo(px(k), py(cp(k))); else c.lineTo(px(k), py(cp(k)));
      }
      c.stroke();
      // 极小点 k*=√(ρg/γ)：c_min=(4γg/ρ)^{1/4} ≈ 0.23 m/s ≈ 23 cm/s（水，λ*=2π/k*≈1.7 cm）
      c.strokeStyle = '#94a3b8'; c.setLineDash([5, 4]); c.lineWidth = 2;
      c.beginPath(); c.moveTo(px(1), 26); c.lineTo(px(1), H - 40); c.stroke();
      c.setLineDash([]);
      c.fillStyle = '#94a3b8'; c.fillText('重力段 ∝1/√k', 54, 52);
      c.fillStyle = '#f59e0b'; c.fillText('张力段 ∝√k', W - 132, 52);
      c.fillStyle = '#f8fafc'; c.fillText('极小 ≈23 cm/s（k*，水）', px(1) - 54, 74);
      const kd = Math.min(3.8, Math.max(0.2, kDot));
      c.fillStyle = '#f472b6'; c.beginPath(); c.arc(px(kd), py(cp(kd)), 7, 0, 7); c.fill();
      plot.tex.needsUpdate = true;
    };
    drawCap(1);
    return (t: number) => {
      // 液面：同一震源出发的两组色散波列（短波振得快、跑得远）
      const pos = surfArr.array as Float32Array;
      for (let i = 0; i < pos.length; i += 3) {
        const d = Math.hypot(pos[i], pos[i + 1]);
        const env = Math.exp(-d / 4.5);
        pos[i + 2] = env * (
          0.14 * Math.sin(d * 4.6 - t * 6.4)   // 短波：ω=k·c_p 大（张力主导）
          + 0.18 * Math.sin(d * 1.15 - t * 1.1) // 长波：慢（重力主导）
        );
      }
      surfArr.needsUpdate = true;
      // 液滴作为扰动源轻微起伏
      drop.position.y = 0.6 + 0.08 * Math.sin(t * 4);
      drop.scale.setScalar(1 + 0.05 * Math.sin(t * 4));
      // 环前扩散：环间距=波长，环速=相速 → 短波环快而密、长波环慢而疏
      shortRings.forEach((m, i) => {
        const r = (t * CSP_S + i * LAM_S) % RMAX;
        m.scale.setScalar(Math.max(0.02, r));
        (m.material as import('three').MeshBasicMaterial).opacity = 0.8 * (1 - r / RMAX);
      });
      longRings.forEach((m, i) => {
        const r = (t * CSP_L + i * LAM_L) % RMAX;
        m.scale.setScalar(Math.max(0.02, r));
        (m.material as import('three').MeshBasicMaterial).opacity = 0.8 * (1 - r / RMAX);
      });
      drawCap(0.2 + (t * 0.45) % 3.6);
    };
  }

  // —— 液滴与表面张力分支（保持原形态）——
  // 同心圆环（从扰动处扩散）
  const rings: import('three').Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(
      bag.geo(new THREE.RingGeometry(0.9, 1.0, 60)),
      bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.05;
    g.add(m);
    rings.push(m);
  }
  // 针尖挂滴（悬滴法的载体）：针尖 + 挂在其下的液滴，随时间轻微呼吸
  const needle = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 12)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.slate, metalness: 0.6, roughness: 0.4 })),
  );
  needle.position.set(0, 2.3, 0);
  g.add(needle);
  // 概念补充小插图：毛细上升 + 弯月面 + 接触角（Jurin 定律 h = 2γcosθ/(ρgr)）
  const capInset = new THREE.Group();
  capInset.position.set(-6.4, 2.2, 0);
  capInset.scale.setScalar(0.6);
  g.add(capInset);
  // 槽中自由液面
  capInset.add(lineFrom(THREE, bag, [new THREE.Vector3(-1.4, 0, 0), new THREE.Vector3(1.4, 0, 0)], PAL.cyan, false));
  // 竖直开口毛细管
  const capTube = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.16, 0.16, 2.4, 16, 1, true)),
    bag.mat(new THREE.MeshStandardMaterial({
      color: PAL.slate, transparent: true, opacity: 0.35, side: THREE.DoubleSide, roughness: 0.5,
    })),
  );
  capTube.position.set(0, 1.0, 0);
  capInset.add(capTube);
  // 管内上升液柱（Jurin 高度 h）
  const capCol = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.12, 0.12, 1.0, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.blue, transparent: true, opacity: 0.6, roughness: 0.3 })),
  );
  capCol.position.set(0, 0.5, 0);
  capInset.add(capCol);
  // 凹弯月面（向上弯的弧示意）
  capInset.add(lineFrom(THREE, bag, [
    new THREE.Vector3(-0.12, 1.0, 0), new THREE.Vector3(0, 0.88, 0), new THREE.Vector3(0.12, 1.0, 0),
  ], PAL.cyan, false));
  // 接触角 θ：管壁竖线 + 液面切线（金楔）
  capInset.add(lineFrom(THREE, bag, [
    new THREE.Vector3(0.12, 1.28, 0), new THREE.Vector3(0.12, 1.0, 0), new THREE.Vector3(-0.02, 0.9, 0),
  ], PAL.gold, false));
  // h 标尺（虚线，从槽面到管内液面）
  capInset.add(lineFrom(THREE, bag, [
    new THREE.Vector3(-1.0, 0, 0), new THREE.Vector3(-1.0, 1.0, 0),
  ], PAL.gold, true));
  g.add(panelSprite(THREE, bag, [
    { text: '毛细上升：h = 2γcosθ/(ρgr)（Jurin）', color: '#f8fafc' },
    { text: 'θ<90° 凹液面上升；θ>90°（玻璃上水银）下降', color: '#94a3b8' },
    { text: '蓝柱=管内升液 h，青弧=凹弯月面，金楔=接触角 θ，金虚线=h 标尺', color: '#fbbf24' },
  ], [-6.4, 4.7, 0], 4.6, 'center'));
  g.add(panelSprite(THREE, bag, [
    { text: '液滴与表面张力：Δp = γ(1/R₁ + 1/R₂)（Young–Laplace 一般式）', color: '#f8fafc' },
    { text: '球形液滴 R₁=R₂=R ⇒ Δp = 2γ/R；悬滴法由挂滴轮廓拟合 γ', color: '#94a3b8' },
    { text: '读数：青针+蓝挂滴，右图 Δp–1/R 直线斜率=2γ（由 γ 生成），左上=毛细/接触角', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const GAMMA = 0.072; // N/m：水 20 ℃ 的表面张力（画布斜率由它生成）
  const drawGamma = (R: number) => {
    const c = plot.frame('Δp vs 1/R', '1/R（mm⁻¹）', 'Δp（Pa）');
    const W = 340, H = 300;
    const XMAX = 0.4;                                  // 1/R 轴上限（mm⁻¹）
    const pOf = (invR: number) => 2 * GAMMA * 1000 * invR;  // Δp = 2γ/R（斜率 2γ，由 γ 生成，非像素硬画）
    const PMAX = pOf(XMAX);
    const px = (invR: number) => 46 + (invR / XMAX) * (W - 62);
    const py = (dp: number) => (H - 40) - (dp / PMAX) * (H - 70);
    // 直线就是函数本身 Δp(1/R) = 2γ·(1/R)
    c.strokeStyle = '#f59e0b'; c.lineWidth = 3; c.beginPath();
    c.moveTo(px(0), py(pOf(0))); c.lineTo(px(XMAX), py(pOf(XMAX))); c.stroke();
    const Rmm = R * 4;                                 // 示意刻度：R → mm
    const invR = 1 / Rmm;
    const dp = pOf(invR);                             // = 2γ/Rmm·1000 = 2γ/R（Pa），与游标共线
    c.fillStyle = '#06b6d4'; c.beginPath(); c.arc(px(invR), py(dp), 7, 0, 7); c.fill();
    c.fillStyle = '#94a3b8'; c.fillText('Δp = 2γ/R（直线斜率 = 2γ）', 56, 56);
    c.fillStyle = '#fbbf24'; c.fillText(`拟合斜率 ⇒ γ ≈ ${GAMMA} N/m`, 56, 82);
    c.fillStyle = '#e2e8f0';
    c.fillText(`R ≈ ${Rmm.toFixed(1)} mm → Δp ≈ ${dp.toFixed(0)} Pa`, 56, 106);
    plot.tex.needsUpdate = true;
  };
  drawGamma(1.0);
  return (t: number) => {
    // 液面正弦波动
    const pos = surfArr.array as Float32Array;
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i];
      const y = pos[i + 1];
      pos[i + 2] = 0.15 * Math.sin(x * 1.5 - t * 3) * Math.cos(y * 1.2 + t * 2);
    }
    surfArr.needsUpdate = true;
    // 挂滴：针尖下的轴对称挂滴（近似）随时间轻微呼吸——表面张力使其恢复形状
    const osc = Math.sin(t * 3) * 0.1;
    drop.scale.set(1 + osc * 0.7, 1.18 - osc, 1 + osc * 0.7);
    drop.position.y = 1.3 + 0.04 * Math.sin(t * 2);
    // 波环扩散（等速，非色散示意）
    rings.forEach((m, i) => {
      const cyc = ((t * 0.6 + i / rings.length) % 1);
      const r = 0.4 + cyc * 4.2;
      m.scale.setScalar(r);
      (m.material as import('three').MeshBasicMaterial).opacity = 0.7 * (1 - cyc);
    });
    const R = 0.7 + 0.5 * (Math.sin(t * 0.5) * 0.5 + 0.5);
    drawGamma(R);
  };
}

/** P72 瑞利-贝纳德对流胞, P71 瑞利-泰勒不稳定性（rt 分支重画：无阈值 σ(k) + 多模尖桩/气泡） */
function build_instability(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const rt = title.includes('泰勒');
  // 上下边界（RT：重流体红在上、轻流体蓝在下；贝纳德：热红下、冷蓝上）
  const bottom = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(9, 0.3, 6)),
    bag.mat(new THREE.MeshStandardMaterial({ color: rt ? 0x1d4ed8 : 0xdc2626, roughness: 0.6 })),
  );
  bottom.position.y = -2.4;
  g.add(bottom);
  const top = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(9, 0.3, 6)),
    bag.mat(new THREE.MeshStandardMaterial({ color: rt ? 0xdc2626 : 0x1d4ed8, roughness: 0.6 })),
  );
  top.position.y = 2.4;
  g.add(top);
  // 界面扰动线（两分支共用的界面载体）
  const N = 120;
  const ig = bag.geo(new THREE.BufferGeometry());
  ig.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const iface = new THREE.Line(ig, bag.mat(new THREE.LineBasicMaterial({ color: PAL.pink })));
  g.add(iface);
  const ia = (ig.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  const plot = makePlot(bag, THREE, 360, 320, 4.2, 6.6, 0.8);
  g.add(plot.mesh);

  if (rt) {
    // —— 瑞利-泰勒分支：界面无阈值增长，多模叠加 + 指尖卷曲（示意） ——
    g.add(panelSprite(THREE, bag, [
      { text: '瑞利-泰勒：重流体压在轻流体上，界面无阈值——几乎全部 k 都失稳（指数增长）', color: '#f8fafc' },
      { text: 'σ(k) = √(A·g·k − γk³/ρ̄)，A 为 Atwood 数；过大 k 由表面张力截止', color: '#94a3b8' },
      { text: '读数：粉线 = 多模界面，红球 = 下沉尖桩，蓝球+环 = 上冲气泡/蘑菇帽（示意）', color: '#fbbf24' },
    ], [0, 4.4, 0], 7.8, 'center'));
    // 下沉尖桩（重流体手指 + 端部红球）与上冲气泡（轻流体蓝球 + 蘑菇帽环）
    const spikeXs = [-2.7, 0.3, 3.0];
    const bubXs = [-1.2, 1.8];
    const spikeBalls = spikeXs.map((x) => {
      const m = new THREE.Mesh(
        bag.geo(new THREE.SphereGeometry(0.34, 18, 14)),
        bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, roughness: 0.5 })),
      );
      m.position.set(x, 0, 0);
      g.add(m);
      return m;
    });
    const bubBalls = bubXs.map((x) => {
      const m = new THREE.Mesh(
        bag.geo(new THREE.SphereGeometry(0.4, 18, 14)),
        bag.mat(new THREE.MeshStandardMaterial({ color: PAL.blue, roughness: 0.5 })),
      );
      m.position.set(x, 0, 0);
      g.add(m);
      return m;
    });
    // 蘑菇帽：气泡顶部的环（卷曲边缘示意）
    const caps = bubXs.map((x) => {
      const m = new THREE.Mesh(
        bag.geo(new THREE.TorusGeometry(0.5, 0.08, 8, 32)),
        bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.85 })),
      );
      m.position.set(x, 0.3, 0);
      g.add(m);
      return m;
    });
    // 配对箭头：重流体下沉（红、向下）+ 轻流体上冲（青、向上）；撤掉共用环流箭头
    const downArrows = spikeXs.map((x) => {
      const a = new THREE.ArrowHelper(
        new THREE.Vector3(0, -1, 0), new THREE.Vector3(x, -0.5, 0.6), 1.2, PAL.red, 0.18, 0.09,
      );
      g.add(a);
      return a;
    });
    const upArrows = bubXs.map((x) => {
      const a = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, 0.6, 0.6), 1.2, PAL.cyan, 0.18, 0.09,
      );
      g.add(a);
      return a;
    });
    // 画布：σ(k) 单峰曲线（无量纲 A=0.55、g=1、γ/ρ̄=0.09，教学示意）
    const drawSigma = (kDot: number) => {
      const c = plot.frame('RT 增长率 σ(k)', 'k（波数 →）', 'σ');
      const W = 360, H = 320;
      const A = 0.55;
      const sig = (k: number) => {
        const s2 = A * k - 0.09 * k * k * k; // σ² = Agk − γk³/ρ̄
        return s2 > 0 ? Math.sqrt(s2) : 0;
      };
      const px = (k: number) => 46 + (k / 3) * (W - 62);
      const py = (s: number) => (H - 40) - (s / 0.8) * (H - 70);
      c.strokeStyle = '#ef4444'; c.lineWidth = 3; c.beginPath();
      for (let i = 0; i <= 90; i++) {
        const k = 0.02 + (i / 90) * 2.98;
        if (i === 0) c.moveTo(px(k), py(sig(k))); else c.lineTo(px(k), py(sig(k)));
      }
      c.stroke();
      // 表面张力截止波数 k_c（右侧短波稳定区）
      const kc = Math.cbrt(A / 0.09);
      c.strokeStyle = '#64748b'; c.setLineDash([5, 4]); c.lineWidth = 2;
      c.beginPath(); c.moveTo(px(kc), 26); c.lineTo(px(kc), H - 40); c.stroke();
      c.setLineDash([]);
      c.fillStyle = '#94a3b8'; c.fillText(`A=(ρ₂−ρ₁)/(ρ₂+ρ₁)≈${A}`, 52, 56);
      c.fillText('无阈值：k→0 即失稳', 52, 80);
      c.fillText('k_c 后短波稳定', px(kc) + 6, 100);
      // 最不稳定波数 k*（峰）与游标
      const kstar = Math.sqrt(A / (3 * 0.09));
      c.fillStyle = '#f8fafc'; c.fillText('λ_m 最不稳定', px(kstar) - 30, py(sig(kstar)) - 12);
      const kd = Math.min(3, Math.max(0.02, kDot));
      c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(px(kd), py(sig(kd)), 7, 0, 7); c.fill();
      plot.tex.needsUpdate = true;
    };
    drawSigma(1.2);
    return (t: number) => {
      const cycle = (t % 14) / 14;
      const growth = Math.min(1, 0.1 + cycle * 1.35); // 扰动指数增长截断（示意）
      // 多模叠加界面 + 折线尖桩/气泡（指尖卷曲的教学近似）
      for (let i = 0; i <= N; i++) {
        const x = (i / N) * 9 - 4.5;
        let eta = (
          Math.sin(x * 1.4) * 0.32 + Math.sin(x * 2.7 + 1.3) * 0.18 + Math.sin(x * 4.1 + 2.2) * 0.09
        ) * growth;
        for (let j = 0; j < spikeXs.length; j++) {
          const d = Math.abs(x - spikeXs[j]);
          if (d < 0.55) eta -= (1 - d / 0.55) * growth * 1.9; // 下沉尖桩
        }
        for (let j = 0; j < bubXs.length; j++) {
          const d = Math.abs(x - bubXs[j]);
          if (d < 0.7) eta += (1 - d / 0.7) * growth * 1.5; // 上冲气泡
        }
        ia[i * 3] = x;
        ia[i * 3 + 1] = eta;
        ia[i * 3 + 2] = 0;
      }
      (ig.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
      // 尖桩端球随深度增长
      spikeBalls.forEach((m, j) => {
        m.position.y = -growth * 1.9 - 0.1 + Math.sin(t * 1.5 + j) * 0.05;
        m.scale.setScalar(0.6 + growth * 0.8);
      });
      // 气泡上升 + 蘑菇帽张开
      bubBalls.forEach((m, j) => {
        m.position.y = growth * 1.5 + 0.1;
        m.scale.setScalar(0.6 + growth * 0.7);
        const cap = caps[j];
        cap.position.y = growth * 1.5 + 0.35;
        cap.scale.setScalar(0.5 + growth * 0.9);
        (cap.material as import('three').MeshBasicMaterial).opacity = 0.85 * growth;
      });
      downArrows.forEach((a, j) => {
        a.setLength(0.5 + growth * 1.3, 0.18, 0.09);
        a.position.y = -0.5 - growth * 0.6 + Math.sin(t * 1.5 + j) * 0.05;
      });
      upArrows.forEach((a, j) => {
        a.setLength(0.5 + growth * 1.3, 0.18, 0.09);
        a.position.y = 0.6 + growth * 0.6 + Math.sin(t * 1.5 + j) * 0.05;
      });
      drawSigma(0.02 + (t * 0.45) % 2.98);
    };
  }

  // —— 贝纳德对流胞分支（保持原形态；画布阈值顺手对齐 Ra_c≈1708）——
  // 对流胞（环形箭头示意）
  const cells: import('three').ArrowHelper[] = [];
  for (let i = -2; i <= 2; i++) {
    const a1 = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0), new THREE.Vector3(i * 1.8 - 0.6, -1.8, 0), 1.4, PAL.cyan, 0.16, 0.08,
    );
    const a2 = new THREE.ArrowHelper(
      new THREE.Vector3(0, -1, 0), new THREE.Vector3(i * 1.8 + 0.6, 1.8, 0), 1.4, PAL.gold, 0.16, 0.08,
    );
    g.add(a1); g.add(a2);
    cells.push(a1, a2);
  }
  // 六角对流胞阵列（俯视 2D 蜂窝线框，瑞利-贝纳德的核心意象）：右上插图，
  // Ra > Ra_c 时逐格点亮，胞内画反向滚动的环流箭头（相邻胞转向相反）
  const hexGroup = new THREE.Group();
  hexGroup.position.set(6.6, 4.0, 0);
  hexGroup.rotation.x = -0.3; // 轻微倾斜，读作"俯视平面"
  g.add(hexGroup);
  const HEX_R = 0.3;                    // 六角胞外接圆半径
  const HEX_DX = Math.sqrt(3) * HEX_R;  // 尖顶六角列距
  const HEX_DY = 1.5 * HEX_R;           // 尖顶六角行距
  const hexCells: { x: number; y: number; sense: number }[] = [];
  for (let row = -2; row <= 2; row++) {
    for (let col = -2; col <= 2; col++) {
      hexCells.push({
        x: col * HEX_DX + (row % 2 !== 0 ? HEX_DX / 2 : 0),
        y: row * HEX_DY,
        sense: (row + col) % 2 === 0 ? 1 : -1, // 相邻胞环流反向
      });
    }
  }
  const hexPos: number[] = [];
  for (const cell of hexCells) {
    for (let k = 0; k < 6; k++) {
      const a0 = Math.PI / 2 + (k * Math.PI) / 3;
      const a1 = Math.PI / 2 + ((k + 1) * Math.PI) / 3;
      hexPos.push(
        cell.x + HEX_R * Math.cos(a0), cell.y + HEX_R * Math.sin(a0), 0,
        cell.x + HEX_R * Math.cos(a1), cell.y + HEX_R * Math.sin(a1), 0,
      );
    }
  }
  const hexGeo = bag.geo(new THREE.BufferGeometry());
  hexGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(hexPos), 3));
  const hexMat = bag.mat(new THREE.LineBasicMaterial({
    color: PAL.cyan, transparent: true, opacity: 0.35,
  }));
  hexGroup.add(new THREE.LineSegments(hexGeo, hexMat));
  const hexArrows = hexCells.map((cell) => {
    const a = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(cell.x, cell.y, 0.03),
      0.2, PAL.gold, 0.08, 0.045,
    );
    a.visible = false;
    hexGroup.add(a);
    return a;
  });
  g.add(panelSprite(THREE, bag, [
    { text: '俯视：六角对流胞阵列', color: '#fbbf24' },
  ], [6.6, 5.5, 0], 3.6, 'center'));
  g.add(panelSprite(THREE, bag, [
    { text: '瑞利-贝纳德对流：Ra = gβΔTL³/(νκ) > Ra_c ≈ 1708 → 对流胞', color: '#f8fafc' },
    { text: '下热上冷，浮力克服黏性/扩散 → 六角对流胞滚动', color: '#94a3b8' },
    { text: '读数：青/金箭头 = 截面升降环流，右上 = 俯视六角胞阵列，红/蓝 = 热/冷边界', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawRa = (Ra: number) => {
    const c = plot.frame('稳定性分岔 σ(Ra)', 'Ra', 'σ');
    const W = 360, H = 320;
    const RaC = 1708; // 临界瑞利数（刚性边界）
    const px = (r: number) => 46 + (r / 4000) * (W - 62);
    const sigma = (r: number) => (r > RaC ? Math.sqrt((r - RaC) / RaC) * 0.7 : 0);
    const py = (s: number) => (H - 40) - (s / 1.1) * (H - 70);
    // 阈值分岔曲线：Ra<Ra_c 完全稳定，Ra>Ra_c σ∝√(Ra−Ra_c)
    c.strokeStyle = '#22c55e'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 80; i++) {
      const r = (i / 80) * 4000;
      if (i === 0) c.moveTo(px(r), py(sigma(r))); else c.lineTo(px(r), py(sigma(r)));
    }
    c.stroke();
    // 阈值虚线
    c.strokeStyle = '#94a3b8'; c.setLineDash([5, 4]); c.lineWidth = 2;
    c.beginPath(); c.moveTo(px(RaC), 26); c.lineTo(px(RaC), H - 40); c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#94a3b8'; c.fillText('Ra_c≈1708：左稳/右失稳', px(RaC) + 6, 56);
    const pxx = px(Math.min(4000, Ra));
    c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(pxx, py(sigma(Ra)), 7, 0, 7); c.fill();
    plot.tex.needsUpdate = true;
    void Ra;
  };
  drawRa(2200);
  return (t: number) => {
    cells.forEach((a, i) => {
      const dir = i % 2 === 0 ? 1 : -1;
      a.setDirection(new THREE.Vector3(Math.sin(t * 1.2 + i) * 0.3, dir, 0).normalize());
      a.setLength(1.2 + 0.3 * Math.sin(t * 1.6 + i), 0.16, 0.08);
    });
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * 9 - 4.5;
      // 贝纳德分支：界面仅轻微起伏（对流胞由箭头示意）
      const mode = Math.sin(x * 2.4) * 0.3 + 0.15 * Math.sin(x * 6 + t * 2);
      ia[i * 3] = x;
      ia[i * 3 + 1] = mode;
      ia[i * 3 + 2] = 0;
    }
    (ig.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    const Ra = 1708 + 600 * (Math.sin(t * 0.3) * 0.5 + 0.5);
    // 六角胞阵列：Ra 超临界时逐格点亮，胞内反向滚动的环流箭头
    const glow = Ra > 1708 ? Math.min(1, Math.sqrt((Ra - 1708) / 1708)) : 0;
    hexMat.opacity = 0.25 + 0.65 * glow;
    hexCells.forEach((cell, i) => {
      const a = hexArrows[i];
      a.visible = glow > 0;
      if (!a.visible) return;
      const phi = cell.sense * t * 2 + i * 0.8; // 胞内滚动（相邻胞反向）
      const rr = HEX_R * 0.45;
      a.position.set(cell.x + rr * Math.cos(phi), cell.y + rr * Math.sin(phi), 0.03);
      a.setDirection(new THREE.Vector3(
        -Math.sin(phi) * cell.sense, Math.cos(phi) * cell.sense, 0,
      ));
      a.setLength(0.2, 0.08, 0.045);
    });
    drawRa(Ra);
  };
}

/** P68 马格努斯效应 */
function build_magnus(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title;
  // 旋转球（网球/乒乓球）：由 rotation.z 绕 z 轴（垂直于纸面流场平面）自转
  const ball = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(1.0, 28, 20)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.green, roughness: 0.5 })),
  );
  g.add(ball);
  // 经线环 + 表面斑点：使旋向（rotation.z 的符号）肉眼可见
  const ring = new THREE.Mesh(
    bag.geo(new THREE.TorusGeometry(1.01, 0.035, 10, 40)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.white, roughness: 0.4 })),
  );
  ring.rotation.y = Math.PI / 2; // 过两极（z±）的大圆，随球绕 z 转过，正面可见摆动
  ball.add(ring);
  const spotGeo = bag.geo(new THREE.SphereGeometry(0.15, 12, 10));
  const spotMat = bag.mat(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 }));
  for (let i = 0; i < 3; i++) {
    const th = (i * 2 * Math.PI) / 3; // 赤道（xy 面）上均布三颗暗斑，随自转沿球面绕行
    const s = new THREE.Mesh(spotGeo, spotMat);
    s.position.set(Math.cos(th), Math.sin(th), 0);
    ball.add(s);
  }
  // 旋转轴标记：沿 z，与 ball.rotation.z 的自转轴一致（指向纸外，金短线）
  const axis = lineFrom(THREE, bag, [
    new THREE.Vector3(0, 0, -1.5), new THREE.Vector3(0, 0, 1.5),
  ], PAL.gold, true);
  g.add(axis);
  // ω 弧箭头：在流场平面（xy）内绕球一周，扫过方向 = 旋向
  const NARC = 26;
  const arcGeo = bag.geo(new THREE.BufferGeometry());
  arcGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((NARC + 1) * 3), 3));
  g.add(new THREE.Line(arcGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.gold }))));
  const arcArr = (arcGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  const wHead = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(1.45, 0, 0), 0.3, PAL.gold, 0.2, 0.12,
  );
  g.add(wHead);
  // 来流线：随 ω 做上下不对称偏折——旋转带动与来流同向的一侧流速更高（流线贴近球），
  // 对侧被推开；下游尾流整体偏向慢侧（反作用 = 侧向力指向快侧）
  const NSL = 72;
  const flowGeo: import('three').BufferGeometry[] = [];
  for (let i = -2; i <= 2; i++) {
    const geo = bag.geo(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((NSL + 1) * 3), 3));
    const l = new THREE.Line(geo, bag.mat(new THREE.LineBasicMaterial({
      color: PAL.slate, transparent: true, opacity: 0.65,
    })));
    g.add(l);
    flowGeo.push(geo);
  }
  // 升力 F = ρU∞×Γ：来流 U∞=+x̂、Γ∥ω∥+ẑ ⇒ x̂×ẑ = −ŷ，恒同时垂直来流与自旋轴
  const lift = new THREE.ArrowHelper(
    new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, -1.6, 0), 2.4, PAL.red, 0.24, 0.12,
  );
  g.add(lift);
  // 侧向轨迹（弯曲）
  const N = 80;
  const tg = bag.geo(new THREE.BufferGeometry());
  tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const traj = new THREE.Line(tg, bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan })));
  g.add(traj);
  const ta = (tg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  const plot = makePlot(bag, THREE, 340, 300, 3.8, 6.8, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '马格努斯效应：F = ρU∞×Γ ⊥ 来流(+x̂) 与自旋轴(ω∥+ẑ，金线沿 z)', color: '#f8fafc' },
    { text: 'ω>0：顶面逆着来流为慢侧高压、底面顺流为快侧低压 ⇒ 合力指 −ŷ（香蕉球、上旋球原理）', color: '#94a3b8' },
    { text: '读数：金短线=转轴(∥z 朝纸外)，金弧=ω 旋向，红箭头=侧向力，青线=弯曲轨迹（随 ω 号反转）', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawF = (omega: number) => {
    const c = plot.frame('侧向力竖直分量 F_y vs ω', 'ω', 'F_y');
    const W = 340, H = 300;
    const px = (w: number) => 46 + ((w + 3) / 6) * (W - 62); // ω ∈ [−3, 3]
    const py = (f: number) => (H / 2) - (f / 3) * (H / 2 - 50);
    c.strokeStyle = '#475569'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(46, H / 2); c.lineTo(W - 14, H / 2); c.stroke();
    // F = ρU∞×Γ（来流 +x̂、ω∥+ẑ）⇒ F_y = −kω：直线过零、斜率为负
    c.strokeStyle = '#ef4444'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(px(-3), py(3)); c.lineTo(px(3), py(-3)); c.stroke();
    const w = Math.max(-3, Math.min(3, omega));
    c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(px(w), py(-w), 7, 0, 7); c.fill();
    c.fillStyle = '#94a3b8'; c.fillText('F_y = −kω（大小 ∝ |ω|，方向随旋向反转）', 50, 42);
    c.fillStyle = '#f8fafc'; c.fillText(`ω = ${omega.toFixed(2)}`, 50, H - 56);
    plot.tex.needsUpdate = true;
  };
  drawF(2);
  return (t: number, dt: number) => {
    const omega = 1.5 * Math.sin(t * 0.4); // 跨零振荡：旋向可反转
    ball.rotation.z += omega * dt;
    ball.position.x = Math.sin(t * 0.5) * 2.4;
    ball.position.y = 0.35 * Math.sin(t * 0.8);
    const sgn = omega >= 0 ? 1 : -1;
    const bx = ball.position.x, by = ball.position.y;
    // 转轴金线与 ω 弧随球平移；弧的扫过方向 = 旋向（sgn）
    axis.position.set(bx, by, 0);
    const TH0 = 0.9; // 弧起始角
    for (let k = 0; k <= NARC; k++) {
      const th = TH0 + sgn * (k / NARC) * 2.2;
      arcArr[k * 3] = bx + 1.45 * Math.cos(th);
      arcArr[k * 3 + 1] = by + 1.45 * Math.sin(th);
      arcArr[k * 3 + 2] = 0;
    }
    (arcGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    const thE = TH0 + sgn * 2.2;
    wHead.position.set(bx + 1.45 * Math.cos(thE), by + 1.45 * Math.sin(thE), 0);
    wHead.setDirection(new THREE.Vector3(-sgn * Math.sin(thE), sgn * Math.cos(thE), 0));
    // 升力 F = ρU∞×Γ：来流 +x̂、ω∥+ẑ ⇒ ω>0 时 F∥−ŷ（指向快侧低压），大小 ∝ |ω|
    const llen = 0.2 + Math.abs(omega) * 1.1;
    lift.setDirection(new THREE.Vector3(0, -sgn, 0));
    lift.setLength(llen, 0.24, 0.12);
    lift.position.set(bx, by - sgn * 1.1, 0); // 尾端贴在球面（沿力方向一侧）
    // 来流线：快侧贴球、慢侧外推 + 下游尾流偏向慢侧；最后沿球面推开避免穿模
    const nrm = Math.min(1, Math.abs(omega) / 1.5);
    const R_SAFE = 1.18;
    flowGeo.forEach((geo, i) => {
      const y0 = (i - 2) * 0.9;
      const fast = (y0 > 0) !== (sgn > 0);   // 快侧：ω>0 时顶面表面速度 −x̂ 逆着来流（慢侧），底面顺流为快侧
      const arr = (geo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
      for (let k = 0; k <= NSL; k++) {
        const x = (k / NSL) * 13 - 6.5;
        const near = Math.exp(-((x - bx) ** 2) / 6);
        const sy = y0 === 0 ? 0 : y0 > 0 ? 1 : -1;
        let yy = y0 + near * 0.42 * nrm * (fast ? -sy : sy);          // 球附近不对称偏折
        yy += (sgn > 0 ? 1 : -1) * 0.5 * nrm
          * Math.min(1, Math.max(0, (x - bx - 0.4) / 2.2));           // 下游尾流偏向慢侧（ω>0 时慢侧在上方）
        const dx = x - bx;
        const hMax = Math.sqrt(Math.max(0, R_SAFE * R_SAFE - dx * dx));
        const dyy = yy - by;
        if (Math.abs(dyy) < hMax) { // 沿球面推开，保证流线不进入球体
          const side = dyy !== 0 ? Math.sign(dyy) : sy !== 0 ? sy : -sgn;
          yy = by + side * hMax;
        }
        arr[k * 3] = x;
        arr[k * 3 + 1] = yy;
        arr[k * 3 + 2] = 0;
      }
      (geo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    });
    // 弯曲轨迹：向受力方向（−sgn·ŷ）弯曲，曲率随 ω 反向（香蕉球方向随旋向反转）
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * 13 - 6.5;
      const bend = -omega * 0.18 * (x * x) / 12;
      ta[i * 3] = x;
      ta[i * 3 + 1] = bend + 0.6;
      ta[i * 3 + 2] = 0;
    }
    (tg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    drawF(omega);
  };
}

/** P67 泊肃叶流, P187 雷诺转捩 */
function build_pipeflow(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const transition = title.includes('雷诺') || title.includes('转捩');
  // 管道
  const pipe = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(1.8, 1.8, 10, 40, 1, true)),
    bag.mat(new THREE.MeshStandardMaterial({
      color: 0x475569, transparent: true, opacity: 0.3, side: THREE.DoubleSide, roughness: 0.5,
    })),
  );
  pipe.rotation.z = Math.PI / 2;
  g.add(pipe);
  // 速度剖面（抛物线 vs 湍流平坦）
  const N = 40;
  const pg = bag.geo(new THREE.BufferGeometry());
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const profile = new THREE.Line(pg, bag.mat(new THREE.LineBasicMaterial({ color: PAL.gold })));
  g.add(profile);
  const pa = (pg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  // 流体微团
  const NP = 40;
  const mg = bag.geo(new THREE.BufferGeometry());
  mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  g.add(new THREE.Points(mg, bag.mat(new THREE.PointsMaterial({ color: PAL.cyan, size: 0.16, sizeAttenuation: true }))));
  const ma = (mg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  const plot = makePlot(bag, THREE, 360, 320, 4.2, 6.6, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, transition ? [
    { text: '雷诺转捩：Re = ρuD/μ；Re < 2300 层流，2300–4000 转捩，> 4000 湍流', color: '#f8fafc' },
    { text: '剖面由抛物线（层流）渐变平坦（湍流），阻力 ∝ u^{1.75…2}', color: '#94a3b8' },
    { text: '读数：金线 = 速度剖面，青点 = 微团，紫线 = 染色线（1883 Reynolds）', color: '#fbbf24' },
  ] : [
    { text: '泊肃叶流：u(r) = (Δp/4μL)(R² − r²)，Q = πR⁴Δp/(8μL)', color: '#f8fafc' },
    { text: '抛物线速度剖面：轴心最快、壁面无滑移为零', color: '#94a3b8' },
    { text: '读数：金线=抛物线剖面，青点=层流微团，画布随 R 扫描显示 Q∝R⁴（四次方律）', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  // 转捩度 tr ∈ [0,1]：Re<2300 层流、>4000 完全湍流、其间渐变（与 panel 三段口径一致）
  const trOf = (Re: number) => (transition ? Math.min(1, Math.max(0, (Re - 2300) / 1700)) : 0);
  // 速度剖面：层流抛物线与湍流 1/7 次幂按 tr 混合
  const uProf = (r: number, tr: number) => {
    const lam = 1 - r * r;
    const turb = Math.pow(1 - Math.abs(r), 1 / 7);
    return lam + (turb - lam) * tr;
  };
  // 染色线（1883 Reynolds 染色实验）：层流保持直线 → 转捩摆动增幅 → 湍流破碎
  const ND = 96;
  const dg = bag.geo(new THREE.BufferGeometry());
  dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ND * 3), 3));
  const dye = new THREE.Line(dg, bag.mat(new THREE.LineBasicMaterial({
    color: PAL.violet, transparent: true, opacity: 0.9,
  })));
  g.add(dye);
  const da = (dg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  const drawProfile = (Re: number, tr: number, Rf: number) => {
    const c = plot.frame('速度剖面 u(r)', 'r/R', 'u/u_max');
    const W = 360, H = 320;
    c.strokeStyle = tr >= 1 ? '#f472b6' : tr > 0 ? '#a78bfa' : '#f59e0b';
    c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 60; i++) {
      const r = (i / 60) * 2 - 1;
      const u = uProf(r, tr);
      const px = 46 + ((r + 1) / 2) * (W - 62);
      const py = (H - 40) - u * (H - 70);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    c.fillStyle = '#94a3b8';
    c.fillText(
      tr <= 0 ? `Re=${Re.toFixed(0)}：层流（抛物线）`
        : tr >= 1 ? `Re=${Re.toFixed(0)}：湍流（平坦）`
          : `Re=${Re.toFixed(0)}：转捩区（层流/湍流混合）`,
      48, 56,
    );
    c.fillStyle = '#64748b';
    c.fillText('层流 <2300 | 转捩 2300–4000 | 湍流 >4000', 48, 80);
    // 泊肃叶分支：补 Q∝R⁴ 的实时读数——与画面缩放的半径 Rf 同源（不再是纯文本承诺）
    if (!transition) {
      const qrel = Rf * Rf * Rf * Rf;                 // Q/Q₀ = (R/R₀)⁴
      c.fillStyle = '#fbbf24';
      c.fillText(`半径 R = ${Rf.toFixed(2)}（相对基准）`, 48, 104);
      c.fillStyle = '#f8fafc';
      c.fillText(`Q = πR⁴·Δp/(8μL) ⇒ Q/Q₀ = R⁴ = ${qrel.toFixed(2)}`, 48, 126);
      const bar = (W - 74) * Math.min(1, qrel / 1.6);  // 通量条长度 ∝ Q ∝ R⁴
      c.fillStyle = '#22c55e'; c.fillRect(48, 140, bar, 14);
      c.fillStyle = '#94a3b8';
      c.fillText('R → 2R 时 Q → 16Q₀（四次方律）', 48, 176);
    }
    plot.tex.needsUpdate = true;
  };
  drawProfile(1000, 0, 0.8);
  return (t: number, dt: number) => {
    void dt;
    const Re = transition ? 800 + 3400 * (Math.sin(t * 0.25) * 0.5 + 0.5) : 1000;
    const tr = trOf(Re);
    // 泊肃叶分支让管半径缓慢扫描（示意），使 Q∝R⁴ 与几何同步；转捩分支 Rf 恒为 1（画面不变）
    const Rf = transition ? 1 : 0.6 + 0.5 * (Math.sin(t * 0.3) * 0.5 + 0.5);
    pipe.scale.set(1, Rf, Rf);                        // 半径沿 y/z（管轴已绕 z 转到 x），长度不变
    for (let i = 0; i <= N; i++) {
      const r = (i / N) * 2 - 1;
      const u = uProf(r, tr);
      pa[i * 3] = -5.4 + u * 3.2;
      pa[i * 3 + 1] = r * 1.7 * Rf;
      pa[i * 3 + 2] = 3.4;
    }
    (pg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    // 染色线：层流笔直 → 转捩下游摆动增幅 → 湍流高频破碎
    for (let k = 0; k < ND; k++) {
      const u = k / (ND - 1);
      const x = -5 + u * 10;
      const amp = tr * (0.08 + 0.92 * u); // 沿下游增长
      da[k * 3] = x;
      da[k * 3 + 1] = amp * 0.42 * Math.sin(x * 2.2 + t * 6)
        + tr * 0.14 * u * Math.sin(x * 11 - t * 9);
      da[k * 3 + 2] = amp * 0.3 * Math.sin(x * 3.4 - t * 7);
    }
    (dg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    // 微团：层流有序、转捩起脉动（强度 ∝ tr）；泊肃叶分支随半径扫描缩放
    for (let i = 0; i < NP; i++) {
      const r = Math.sin(i * 2.4) * 1.5;
      const u = uProf(r / 1.7, tr);
      const jitter = tr * Math.sin(t * 8 + i * 1.7) * 0.5;
      ma[i * 3] = ((t * u * 3 + i * 0.7) % 12) - 6;
      ma[i * 3 + 1] = r * Rf + jitter * 0.3;
      ma[i * 3 + 2] = tr * Math.cos(t * 7 + i) * 0.5;
    }
    (mg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    drawProfile(Re, tr, Rf);
  };
}

/** P188 湍流级串 */
function build_turbulence(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title;
  // 涡（大涡 → 小涡，级串）
  const vortices: { m: import('three').Mesh; w: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const r = 2.6 - i * 0.32;
    const m = new THREE.Mesh(
      bag.geo(new THREE.TorusGeometry(r, 0.06 + i * 0.01, 8, 50)),
      bag.mat(new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.55 - i * 0.06, 0.8, 0.55).getHex(),
        transparent: true, opacity: 0.75,
      })),
    );
    m.rotation.x = Math.PI / 2 + (i % 2 ? 0.3 : -0.3);
    g.add(m);
    vortices.push({ m, w: 0.8 + i * 0.5 });
  }
  // 能谱（k^{-5/3}）
  const plot = makePlot(bag, THREE, 380, 340, 4.4, 6.6, 0.8);
  g.add(plot.mesh);
  // 脉动粒子
  const NP = 80;
  const pg = bag.geo(new THREE.BufferGeometry());
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  g.add(new THREE.Points(pg, bag.mat(new THREE.PointsMaterial({
    color: PAL.cyan, size: 0.14, sizeAttenuation: true,
  }))));
  const pa = (pg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  g.add(panelSprite(THREE, bag, [
    { text: '湍流级串：大涡 → 依次破碎 → 小涡（能量逐级传递，ε 越大破碎越快）', color: '#f8fafc' },
    { text: '惯性子区能谱 E(k) = C ε^{2/3} k^{-5/3}（Kolmogorov）+ 高 k 耗散截止 k_d', color: '#94a3b8' },
    { text: '读数：环 = 涡（内小外大），青点 = 脉动微团，右侧能谱含 −5/3 直线与 k_d 截止', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  // 无量纲参数（教学）：NUD 决定耗散截止位置，BETAK 决定截止陡度；k_d=(1/ν)^{3/4}·ε^{1/4}
  const NUD = 0.015, BETAK = 0.2, LMAX = 1.8, LMIN = -5.0;
  const drawSpectrum = (eps: number) => {
    const c = plot.frame('能谱 E(k)（log-log）', 'k（log）', 'E(k)（log）');
    const W = 380, H = 340;
    const kd = (1 / NUD) ** 0.75 * eps ** 0.25;              // 耗散截止波数（随 ε^{1/4}）
    const px = (lk: number) => 46 + (lk / 2.6) * (W - 62);   // log10 k ∈ [0, 2.6]
    const py = (lE: number) => (H - 40) - ((lE - LMIN) / (LMAX - LMIN)) * (H - 70);
    c.strokeStyle = '#f59e0b'; c.lineWidth = 4; c.beginPath();
    let started = false;
    for (let i = 1; i <= 80; i++) {
      const lk = (i / 80) * 2.6;
      const kk = 10 ** lk;
      const cut = Math.exp(-BETAK * (kk / kd) ** (4 / 3));   // 耗散范围因子 exp(−βk^{4/3})
      // E ∝ ε^{2/3}·k^{−5/3}·cut → log10；级距随 ε^{2/3} 平移（与 ε 读数同源），高 k 段被 cut 压低
      const lE = (2 / 3) * Math.log10(eps) + (-5 / 3) * lk + 1.2 + Math.log10(Math.max(cut, 1e-12));
      const y = py(lE);
      if (y > H - 40) break;                                 // 跌出耗散截止以下即止（可见 knee）
      if (!started) { c.moveTo(px(lk), y); started = true; } else c.lineTo(px(lk), y);
    }
    c.stroke();
    // 耗散截止 k_d 竖标（补上此前缺失的"耗散尺度"）
    const lkD = Math.log10(kd);
    if (lkD <= 2.6) {
      c.strokeStyle = '#64748b'; c.setLineDash([5, 4]); c.lineWidth = 2;
      c.beginPath(); c.moveTo(px(lkD), 30); c.lineTo(px(lkD), H - 40); c.stroke();
      c.setLineDash([]);
      c.fillStyle = '#94a3b8'; c.fillText('k_d 耗散截止', px(lkD) - 44, 46);
    }
    c.fillStyle = '#f8fafc'; c.fillText('斜率 −5/3（惯性子区）', 56, 56);
    c.fillStyle = '#94a3b8'; c.fillText('高 k：耗散截止 ∝ exp(−βk^{4/3})', 56, 78);
    c.fillStyle = '#fbbf24'; c.fillText(`ε ≈ ${eps.toFixed(2)} ⇒ 谱级距 ∝ ε^{2/3}、k_d ∝ ε^{1/4}`, 56, 100);
    plot.tex.needsUpdate = true;
  };
  drawSpectrum(1.2);
  return (t: number, dt: number) => {
    void dt;
    const eps = 1.0 + 0.6 * Math.sin(t * 0.3);   // 唯一驱动：既移谱线，又控涡破碎速率（同源）
    const spin = 0.6 + 0.4 * eps;                // ε 越大能量级串/破碎越快
    const breakup = 0.05 * (0.5 + eps);
    vortices.forEach((v, i) => {
      v.m.rotation.z = t * v.w * (i % 2 ? 1 : -1) * spin;
      v.m.scale.setScalar(1 + breakup * Math.sin(t * (2 + eps) + i));
    });
    const jp = 0.12 * (0.5 + eps * 0.5);         // 脉动强度随 ε
    for (let i = 0; i < NP; i++) {
      const a = t * (0.5 + (i % 7) * 0.2) * spin + i;
      const r = 0.6 + (i % 7) * 0.34;
      pa[i * 3] = Math.cos(a) * r + Math.sin(t * 5 + i) * jp;
      pa[i * 3 + 1] = Math.sin(t * 0.8 + i) * 1.6;
      pa[i * 3 + 2] = Math.sin(a) * r + Math.cos(t * 6 + i) * jp;
    }
    (pg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    drawSpectrum(eps);
  };
}

/** P437 伯努利方程, P66 文丘里管 */
function build_venturi(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const bernoulli = title.includes('伯努利');
  // 文丘里管（粗-细-粗）
  const seg1 = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(1.6, 1.6, 4, 32, 1, true)),
    bag.mat(new THREE.MeshStandardMaterial({
      color: 0x475569, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
    })),
  );
  seg1.rotation.z = Math.PI / 2;
  seg1.position.x = -4;
  g.add(seg1);
  const throat = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.8, 0.8, 3, 32, 1, true)),
    bag.mat(new THREE.MeshStandardMaterial({
      color: PAL.amber, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
    })),
  );
  throat.rotation.z = Math.PI / 2;
  g.add(throat);
  const seg3 = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(1.6, 1.6, 4, 32, 1, true)),
    bag.mat(new THREE.MeshStandardMaterial({
      color: 0x475569, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
    })),
  );
  seg3.rotation.z = Math.PI / 2;
  seg3.position.x = 4;
  g.add(seg3);
  // 流速粒子
  const NP = 50;
  const pg = bag.geo(new THREE.BufferGeometry());
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  g.add(new THREE.Points(pg, bag.mat(new THREE.PointsMaterial({ color: PAL.cyan, size: 0.15, sizeAttenuation: true }))));
  const pa = (pg.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  // 管截面（与几何同参数）：粗管半径 SEG_R、喉部 THR_R → 面积比 A1/A2=(SEG_R/THR_R)²
  const SEG_R = 1.6, THR_R = 0.8;
  const AREA_RATIO = (SEG_R / THR_R) ** 2;   // = 4，连续性/Δp 均由此实算，不再硬编码
  // 局部管半径（粗-细-粗，含锥形过渡段），用于把显示位置与局部速度绑定到同一 x
  const localRadius = (x: number) => {
    const ax = Math.abs(x);
    if (ax <= 1.5) return THR_R;
    if (ax >= 2.0) return SEG_R;
    return THR_R + ((ax - 1.5) / 0.5) * (SEG_R - THR_R);
  };
  // 微团状态：轴向位置 flowX（唯一决定显示位置与局部速度）、归一化半径占比、方位角
  const flowX = new Float32Array(NP);
  for (let i = 0; i < NP; i++) flowX[i] = -7 + (i / NP) * 14;
  const frac = (i: number) => 0.12 + 0.78 * Math.abs(Math.sin(i * 12.9898));
  const azim = (i: number) => i * 2.39996323;
  // 压力计（细管处压差）
  const manometer = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 12)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.red })),
  );
  manometer.position.set(0, 2.6, 0);
  g.add(manometer);
  const plot = makePlot(bag, THREE, 360, 320, 4.2, 6.6, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, bernoulli ? [
    { text: '伯努利方程：p + ½ρv² + ρgh = 常数（等高度 ⇒ p + ½ρv² = 常数）', color: '#f8fafc' },
    { text: '适用前提：定常 · 无黏 · 沿同一条流线；快处压强小 ⇒ 升力/文丘里/喷雾', color: '#94a3b8' },
    { text: `读数：微团喉部按 A₁/A₂=${AREA_RATIO} 加速，红柱=喉部静压 p₂，Δp=½ρv₁²[(A₁/A₂)²−1] 实算`, color: '#fbbf24' },
  ] : [
    { text: '文丘里管：A₁v₁ = A₂v₂（连续性），p₁ + ½ρv₁² = p₂ + ½ρv₂²', color: '#f8fafc' },
    { text: '喉部截面小 → v₂ 大 → p₂ 小，压差 Δp 可测流量', color: '#94a3b8' },
    { text: '读数：橙段 = 喉部（加速区），青点 = 微团，红柱 = 压差', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  // 半密度系数（图上 ½ρ）：p = 1 − K·v²，与 p+½ρv²=常数（p∞=1）一致
  const KHALF = 0.33;
  const pOf = (v: number) => Math.max(0, 1 - KHALF * v * v);
  // 上游（粗管）速度由单一时间驱动给出，喉部速度 = v₁·A₁/A₂（连续性），全部同源
  const v1Of = (t: number) => 0.32 + 0.12 * (Math.sin(t * 0.5) * 0.5 + 0.5);
  const drawPV = (vT: number) => {
    const c = plot.frame(bernoulli ? '伯努利：p + ½ρv² = 常数' : '文丘里：p 与 v 关系', 'v', 'p');
    const W = 360, H = 320;
    c.strokeStyle = '#22c55e'; c.lineWidth = 3; c.beginPath();
    for (let i = 1; i <= 60; i++) {
      const v = (i / 60) * 3;
      const px = 46 + (v / 3) * (W - 62);
      const py = (H - 40) - pOf(v) * (H - 70);
      if (i === 1) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    const v1 = vT / AREA_RATIO;              // 连续性 v₂ = v₁·A₁/A₂ 反解上游速度
    const pT = pOf(vT), p1 = pOf(v1);
    const dP = KHALF * (vT * vT - v1 * v1);  // Δp = ½ρ(v₂²−v₁²) = ½ρv₁²[(A₁/A₂)²−1]
    const pxT = 46 + (vT / 3) * (W - 62), pyT = (H - 40) - pT * (H - 70);
    const px1 = 46 + (v1 / 3) * (W - 62), py1 = (H - 40) - p1 * (H - 70);
    // Δp 竖标 + 上游/喉部两点（同源游标）
    c.strokeStyle = '#fbbf24'; c.lineWidth = 2; c.beginPath();
    c.moveTo(px1, py1); c.lineTo(px1, pyT); c.stroke();
    c.fillStyle = '#60a5fa'; c.beginPath(); c.arc(px1, py1, 6, 0, 7); c.fill();
    c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(pxT, pyT, 7, 0, 7); c.fill();
    c.fillStyle = '#94a3b8';
    c.fillText(`v₁=${v1.toFixed(2)} p₁=${p1.toFixed(2)}`, 54, 56);
    c.fillText(`v₂=${vT.toFixed(2)} p₂=${pT.toFixed(2)}`, 54, 78);
    c.fillStyle = '#f8fafc';
    c.fillText(`Δp = ½ρ(v₂²−v₁²) ≈ ${dP.toFixed(3)}（A₁/A₂=${AREA_RATIO}）`, 54, 100);
    plot.tex.needsUpdate = true;
  };
  drawPV(v1Of(0) * AREA_RATIO);
  return (t: number, dt: number) => {
    // 微团按局部轴向速度 u(x)=Q/A(x)=v₁·(SEG_R/r(x))² 迁移：同一 x 决定显示位置与速度，
    // 喉部 r 小 → u 大 → 真正加速（连续性/通量守恒），横向散布半径也按局部管径缩放
    const v1 = v1Of(t);
    const dts = Math.min(dt, 0.05);          // 防首帧/后台卡顿的大 dt 造成跳变
    for (let i = 0; i < NP; i++) {
      const x = flowX[i];
      const r = localRadius(x);
      const u = v1 * (SEG_R / r) ** 2;      // u(x)=Q/A(x)，与几何截面同源
      let nx = x + u * dts * 1.7;           // 观察时间缩放
      while (nx > 7) nx -= 14;              // 循环（保持通量）
      flowX[i] = nx;
      const rr = frac(i) * r;               // 该微团所在半径（贴壁随管收缩/扩张）
      const az = azim(i);
      pa[i * 3] = nx;
      pa[i * 3 + 1] = rr * Math.cos(az);
      pa[i * 3 + 2] = rr * Math.sin(az);
    }
    (pg.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    // 压差计液柱 = 喉部静压 p₂（与画布游标、粒子加速同一驱动，彻底同源）
    const vT = v1 * AREA_RATIO;
    const pT = pOf(vT);
    const gH = 0.35 + pT;
    manometer.scale.y = gH;
    manometer.position.y = 2.6 - (1 - gH) * 1.2;
    drawPV(vT);
    void bernoulli;
  };
}

/** P37 卡门涡街 */
function build_vortexstreet(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title;
  // 圆柱（钝体）
  const cyl = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.9, 0.9, 3.4, 32)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.slate, roughness: 0.5, metalness: 0.4 })),
  );
  cyl.rotation.x = Math.PI / 2;
  g.add(cyl);
  // 交替脱落的涡（两排反相）；环默认在 xy 平面（轴沿 z），绕 z 自旋即展向涡量（与圆柱同轴）
  const NV = 6;
  const U = 3.2, D = 1.8, ST = 0.2;   // 来流速度、圆柱直径、斯特劳哈尔数（亚临界）
  const FREQ = ST * U / D;            // 脱落频率 f = St·U/D（≈0.36）
  const LAM = U / FREQ;               // 同排涡环间距 λ = U/f（两排错位 λ/2）
  const vortices: import('three').Mesh[] = [];
  for (let i = 0; i < NV * 2; i++) {
    const m = new THREE.Mesh(
      bag.geo(new THREE.TorusGeometry(0.5, 0.09, 8, 40)),
      bag.mat(new THREE.MeshBasicMaterial({
        color: i % 2 ? PAL.cyan : PAL.pink, transparent: true, opacity: 0.8,
      })),
    );
    g.add(m);
    vortices.push(m);
  }
  // 来流箭头
  const flow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(-6.4, 2.6, 0), 2.4, PAL.slate, 0.2, 0.1,
  );
  g.add(flow);
  const plot = makePlot(bag, THREE, 360, 320, 4.2, 6.6, 0.8);
  g.add(plot.mesh);
  g.add(panelSprite(THREE, bag, [
    { text: '卡门涡街：圆柱交替脱落涡，St = fD/U ≈ 0.2（亚临界 Re）', color: '#f8fafc' },
    { text: '涡脱落引起横向周期力 → 桥梁/烟囱振动（共振风险）', color: '#94a3b8' },
    { text: '读数：青/粉环 = 交替脱落的涡，右侧为升力振荡曲线', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));
  const drawLift = (tau: number) => {
    const c = plot.frame('升力 F_L(t)（脱落频率调制）', 't/T（T=1/f）', 'F_L');
    const W = 360, H = 320;
    c.strokeStyle = '#f472b6'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 120; i++) {
      const tt = (i / 120) * Math.PI * 4;   // 两个脱落周期
      const F = Math.sin(tt);
      const px = 46 + (i / 120) * (W - 62);
      const py = (H / 2) - F * (H / 2 - 50);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    // 游标按脱落频率推进：相位 = 2π·f·t
    const ph = (tau * FREQ * Math.PI * 2) % (Math.PI * 4);
    const px = 46 + (ph / (Math.PI * 4)) * (W - 62);
    const py = (H / 2) - Math.sin(ph) * (H / 2 - 50);
    c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(px, py, 7, 0, 7); c.fill();
    c.fillStyle = '#94a3b8'; c.fillText('交替反相 → 横向振荡', 52, 56);
    // 实时脱落频率 f 与环间距 λ（均由 St·U/D 同源算出，并与画面环距对应）
    c.fillStyle = '#f8fafc';
    c.fillText(`f = St·U/D = ${ST}·${U.toFixed(1)}/${D.toFixed(1)} ≈ ${FREQ.toFixed(2)}`, 52, H - 96);
    c.fillText(`λ = U/f ≈ ${LAM.toFixed(1)}（同排环间距，两排错位 λ/2）`, 52, H - 72);
    c.fillText(`T = 1/f ≈ ${(1 / FREQ).toFixed(2)} s`, 52, H - 48);
    plot.tex.needsUpdate = true;
  };
  drawLift(0);
  return (t: number, dt: number) => {
    void dt;
    // 涡以流速 U 向下游迁移，每经一个脱落周期 1/f 释放一环 → 同排间距恰为 λ=U/f
    for (let i = 0; i < NV * 2; i++) {
      const top = i % 2 === 0;
      const idx = Math.floor(i / 2);
      const cyc = ((t * FREQ + idx / NV) % 1);
      const x = 1.4 + cyc * LAM;
      const y = (top ? 1 : -1) * (0.7 + cyc * 0.8);
      vortices[i].position.set(x, y, 0);
      (vortices[i].material as import('three').MeshBasicMaterial).opacity = 0.8 * (1 - cyc * 0.7);
      // 涡轴沿 z（展向，与圆柱同轴），绕 z 自转 = 涡量方向；上下排转向相反
      vortices[i].rotation.z = t * (top ? 1.6 : -1.6);
      vortices[i].scale.setScalar(0.6 + cyc * 0.9);
    }
    drawLift(t);
  };
}
