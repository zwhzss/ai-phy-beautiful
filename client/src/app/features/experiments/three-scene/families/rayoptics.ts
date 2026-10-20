import type { SceneContext, SceneInstance } from '../types';
import { scaffold, panelSprite, PAL, ResourceBag } from './_common';

/**
 * 几何光学族（rayoptics）：透镜成像 / 球面镜 / 棱镜色散 / 光纤全反射 / 人眼调焦 / 像差。
 * 由 scene-registry 按 slug+variant 绑定：make(variant, title)。
 */
export function make(variant: string, title: string): (ctx: SceneContext) => SceneInstance {
  return (ctx) => scaffold(ctx, {
    title,
    camera: [0, 2.5, 13],
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
    case 'mirror': return mirror(ctx, g, bag, THREE);
    case 'prism': return prism(ctx, g, bag, THREE);
    case 'fiber': return fiber(ctx, g, bag, THREE);
    case 'eye': return eye(ctx, g, bag, THREE);
    case 'aberration': return aberration(ctx, g, bag, THREE);
    case 'lens':
    default:
      // title 分支：厚透镜走主面高斯模型；折射/全反射走界面折射主体；其余为薄透镜成像
      if (title.includes('厚透镜')) return lensThick(ctx, g, bag, THREE);
      if (title.includes('折射') || title.includes('全反射')) return lensRefraction(ctx, g, bag, THREE);
      return lens(ctx, g, bag, THREE);
  }
}

/** 画一条折线光线（带箭头头部），支持每帧更新 */
function makeRay(
  bag: ResourceBag,
  THREE: typeof import('three'),
  color: number,
  n: number,
) {
  const geo = bag.geo(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const line = new THREE.Line(geo, bag.mat(new THREE.LineBasicMaterial({ color })));
  const arr = geo.getAttribute('position') as import('three').BufferAttribute;
  return {
    line,
    set(pts: import('three').Vector3[]) {
      for (let i = 0; i < n; i++) {
        const p = pts[Math.min(i, pts.length - 1)];
        arr.setXYZ(i, p.x, p.y, p.z);
      }
      arr.needsUpdate = true;
    },
  };
}

/** 光轴标签 */
export function tag(
  bag: ResourceBag,
  THREE: typeof import('three'),
  text: string,
  x: number,
  y: number,
  color = '#f8fafc',
): import('three').Sprite {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 64;
  const c = cv.getContext('2d')!;
  c.fillStyle = color; c.font = 'bold 46px sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, 64, 32);
  const tex = bag.tex(new THREE.CanvasTexture(cv));
  const sp = new THREE.Sprite(bag.mat(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })));
  sp.scale.set(1.0, 0.5, 1);
  sp.position.set(x, y, 0);
  sp.renderOrder = 998;
  return sp;
}

/** 光轴 */
function axis(
  bag: ResourceBag,
  THREE: typeof import('three'),
  half: number,
): import('three').Line {
  const geo = bag.geo(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-half, 0, 0), new THREE.Vector3(half, 0, 0),
  ]));
  return new THREE.Line(geo, bag.mat(new THREE.LineDashedMaterial({ color: 0x475569, gapSize: 0.22, dashSize: 0.3 })));
}

/** 薄透镜成像：单面 x=0 偏折，三条主光线，1/u+1/v=1/f（折射/全反射与厚透镜主面各有独立 title 分支） */
function lens(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
) {
  const ax = axis(bag, THREE, 7);
  ax.computeLineDistances();
  g.add(ax);

  const f = 2.4;
  // 透镜（双凸剖面）
  const lensShape = new THREE.Shape();
  lensShape.moveTo(0, -1.8);
  lensShape.quadraticCurveTo(0.55, 0, 0, 1.8);
  lensShape.quadraticCurveTo(-0.55, 0, 0, -1.8);
  const lensGeo = bag.geo(new THREE.ExtrudeGeometry(lensShape, { depth: 0.08, bevelEnabled: false }));
  const lensMesh = new THREE.Mesh(lensGeo, bag.mat(new THREE.MeshStandardMaterial({
    color: 0x67e8f9, transparent: true, opacity: 0.4, roughness: 0.2,
  })));
  lensMesh.rotation.y = Math.PI / 2;
  lensMesh.position.x = 0;
  g.add(lensMesh);

  // 焦点 / 2F 标记
  const dotGeo = bag.geo(new THREE.SphereGeometry(0.09, 12, 12));
  const dotMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold }));
  [-f, f, -2 * f, 2 * f].forEach((x, i) => {
    const d = new THREE.Mesh(dotGeo, dotMat);
    d.position.set(x, 0, 0);
    g.add(d);
    g.add(tag(bag, THREE, i < 2 ? 'F' : '2F', x, -0.45, i < 2 ? '#fbbf24' : '#94a3b8'));
  });

  // 物（箭头）
  const objX = -5.0, objH = 1.5;
  const objArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(objX, 0, 0), objH, PAL.amber, 0.22, 0.12,
  );
  g.add(objArrow);
  g.add(tag(bag, THREE, 'u', (objX) / 2, 0.4, '#f59e0b'));

  // 像（箭头）
  const imgArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 0), 1, PAL.pink, 0.22, 0.12,
  );
  g.add(imgArrow);

  // 三条主光线：平行→过F'；过光心不偏折；过F→平行
  const r1 = makeRay(bag, THREE, PAL.cyan, 4);
  const r2 = makeRay(bag, THREE, PAL.green, 4);
  const r3 = makeRay(bag, THREE, PAL.violet, 4);
  g.add(r1.line); g.add(r2.line); g.add(r3.line);

  g.add(panelSprite(THREE, bag, [
    { text: '薄透镜成像：1/u + 1/v = 1/f', color: '#f8fafc' },
    { text: '三条主光线：平行→过 F′ · 过光心不偏 · 过 F→平行', color: '#94a3b8' },
    { text: 'u > 2f 倒立缩小实像；f < u < 2f 倒立放大实像', color: '#fbbf24' },
  ], [0, 4.2, 0], 7.6, 'center'));

  ctx.camera.position.set(0, 1.8, 13);
  return (t: number) => {
    // 物距在 f 与 3f 之间来回扫描，展示实/虚像变化
    const u = f * (1.55 + 1.25 * Math.sin(t * 0.35));
    const objXNow = -u;
    objArrow.position.set(objXNow, 0, 0);
    const v = 1 / (1 / f - 1 / u);
    const m = -v / u;
    // 像位置
    imgArrow.position.set(v, 0, 0);
    imgArrow.setLength(Math.min(3.4, Math.abs(m) * objH), 0.2, 0.11);
    imgArrow.setDirection(new THREE.Vector3(0, m >= 0 ? 1 : -1, 0));

    const yTop = objH;
    // 光线1：物尖 → 平行入射 → 透镜处折射过 F′ → 像点
    r1.set([
      new THREE.Vector3(objXNow, yTop, 0),
      new THREE.Vector3(0, yTop, 0),
      new THREE.Vector3(f, 0, 0),
      new THREE.Vector3(v, m * objH, 0),
    ]);
    // 光线2：过光心
    r2.set([
      new THREE.Vector3(objXNow, yTop, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(v, m * objH, 0),
    ]);
    // 光线3：过 F → 出射平行
    r3.set([
      new THREE.Vector3(objXNow, yTop, 0),
      new THREE.Vector3(-f, 0, 0),
      new THREE.Vector3(0, (yTop / (u - f)) * f, 0),
      new THREE.Vector3(v, m * objH, 0),
    ]);
  };
}

/** 厚透镜与主面：光线改在 H/H′ 主平面处折转，f、u、v 均从对应主面起算（高斯模型，示意） */
function lensThick(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
) {
  const ax = axis(bag, THREE, 7);
  ax.computeLineDistances();
  g.add(ax);

  const f = 2.4;
  // 厚双凸透镜：前主面 H 在左、后主面 H′ 在右，二者均位于透镜内部（分离的主面）
  const xH = -0.35, xHp = 0.35;

  // 透镜体（双凸剖面正对相机：光轴沿 x、孔径沿 y、厚度沿 z 挤出）
  const prof = new THREE.Shape();
  prof.moveTo(0, -1.9);
  prof.quadraticCurveTo(1.3, 0, 0, 1.9);   // 后表面（右凸）
  prof.quadraticCurveTo(-1.3, 0, 0, -1.9); // 前表面（左凸）
  const bodyGeo = bag.geo(new THREE.ExtrudeGeometry(prof, { depth: 0.7, bevelEnabled: false }));
  const body = new THREE.Mesh(bodyGeo, bag.mat(new THREE.MeshStandardMaterial({
    color: 0x67e8f9, transparent: true, opacity: 0.26, roughness: 0.2, side: THREE.DoubleSide,
  })));
  body.position.set(0, 0, -0.35);
  g.add(body);

  // 主平面 H / H′（竖直薄片，光在此折转）
  const planeGeo = bag.geo(new THREE.PlaneGeometry(0.12, 4.4));
  const planeH = new THREE.Mesh(planeGeo, bag.mat(new THREE.MeshBasicMaterial({
    color: PAL.gold, transparent: true, opacity: 0.5, depthTest: false,
  })));
  planeH.position.set(xH, 0, 0.1); planeH.renderOrder = 996; g.add(planeH);
  const planeHp = new THREE.Mesh(planeGeo, bag.mat(new THREE.MeshBasicMaterial({
    color: 0x38bdf8, transparent: true, opacity: 0.5, depthTest: false,
  })));
  planeHp.position.set(xHp, 0, 0.1); planeHp.renderOrder = 996; g.add(planeHp);
  g.add(tag(bag, THREE, 'H', xH, 2.7, '#fbbf24'));
  g.add(tag(bag, THREE, 'H′', xHp, 2.7, '#38bdf8'));

  // 节点 N / N′：透镜处于空气中时 N=H、N′=H′（落在主面与光轴交点）
  const nodeGeo = bag.geo(new THREE.SphereGeometry(0.11, 12, 12));
  const nodeMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.pink }));
  const nodeN = new THREE.Mesh(nodeGeo, nodeMat); nodeN.position.set(xH, 0, 0); g.add(nodeN);
  const nodeNp = new THREE.Mesh(nodeGeo, nodeMat); nodeNp.position.set(xHp, 0, 0); g.add(nodeNp);
  g.add(tag(bag, THREE, 'N(H)', xH - 0.4, -0.62, '#f472b6'));
  g.add(tag(bag, THREE, 'N′(H′)', xHp + 0.45, -0.62, '#f472b6'));

  // 焦点 / 2F：以主面为基准起算（刻度线随主面前移）
  const dotGeo = bag.geo(new THREE.SphereGeometry(0.09, 12, 12));
  const dotMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold }));
  const marks: [number, string][] = [
    [xH - f, 'F'], [xHp + f, 'F′'],
    [xH - 2 * f, '2F'], [xHp + 2 * f, '2F′'],
  ];
  marks.forEach(([x, label]) => {
    const d = new THREE.Mesh(dotGeo, dotMat);
    d.position.set(x, 0, 0);
    g.add(d);
    g.add(tag(bag, THREE, label, x, -0.45, label.startsWith('F') ? '#fbbf24' : '#94a3b8'));
  });

  // 物（箭头）与像（箭头）
  const objH = 1.5;
  const objArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), objH, PAL.amber, 0.22, 0.12,
  );
  g.add(objArrow);
  const imgArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 0), 1, PAL.pink, 0.22, 0.12,
  );
  g.add(imgArrow);
  const uTag = tag(bag, THREE, 'u', 0, 0.55, '#f59e0b'); g.add(uTag); // 物距 u 自 H 起算
  const vTag = tag(bag, THREE, 'v', 0, 0.55, '#f472b6'); g.add(vTag); // 像距 v 自 H′ 起算

  // 三条主光线：均在 H/H′ 处折转（每帧更新）
  const r1 = makeRay(bag, THREE, PAL.cyan, 4);
  const r2 = makeRay(bag, THREE, PAL.green, 4);
  const r3 = makeRay(bag, THREE, PAL.violet, 4);
  g.add(r1.line); g.add(r2.line); g.add(r3.line);

  g.add(panelSprite(THREE, bag, [
    { text: '厚透镜高斯模型：光线在 H→H′ 主平面折转，1/u + 1/v = 1/f', color: '#f8fafc' },
    { text: 'u 自前主面 H 起算、v 自后主面 H′ 起算；空气中 N=H、N′=H′', color: '#94a3b8' },
    { text: '主面间等高平移（示意）：平行光在 H 等高移至 H′ 后再过 F′', color: '#fbbf24' },
  ], [0, 4.4, 0], 8.2, 'center'));

  ctx.camera.position.set(0, 1.8, 13);
  return (t: number) => {
    const u = f * (1.55 + 1.25 * Math.sin(t * 0.35));
    const xo = xH - u;               // 物位置：从前主面 H 起算
    objArrow.position.set(xo, 0, 0);
    const v = 1 / (1 / f - 1 / u);
    const m = -v / u;
    const xi = xHp + v;              // 像位置：从后主面 H′ 起算
    imgArrow.position.set(xi, 0, 0);
    imgArrow.setLength(Math.min(3.4, Math.abs(m) * objH), 0.2, 0.11);
    imgArrow.setDirection(new THREE.Vector3(0, m >= 0 ? 1 : -1, 0));
    uTag.position.set((xo + xH) / 2, 0.55, 0);
    vTag.position.set((xHp + xi) / 2, 0.55, 0);

    const yTop = objH;
    const yi = m * objH;
    // 光线1：平行入射至 H → 等高平移至 H′ → 再过 F′ 抵达像点（体现主面折转）
    r1.set([
      new THREE.Vector3(xo, yTop, 0),
      new THREE.Vector3(xH, yTop, 0),
      new THREE.Vector3(xHp, yTop, 0),
      new THREE.Vector3(xi, yi, 0),
    ]);
    // 光线2：过节点 N → 自 N′ 平行射出（空气中节点角放大率=1）
    r2.set([
      new THREE.Vector3(xo, yTop, 0),
      new THREE.Vector3(xH, 0, 0),
      new THREE.Vector3(xHp, 0, 0),
      new THREE.Vector3(xi, yi, 0),
    ]);
    // 光线3：过前焦点 F 入射至 H → 自 H′ 等高（平行）射出到像点
    r3.set([
      new THREE.Vector3(xo, yTop, 0),
      new THREE.Vector3(xH, yi, 0),
      new THREE.Vector3(xHp, yi, 0),
      new THREE.Vector3(xi, yi, 0),
    ]);
  };
}

/**
 * 折射与全反射（lens 的 title 二次分支）：
 * 画面主体为平面介质界面（n₁>n₂，由光密入光疏）——入射/折射/反射三光线 + 法线 +
 * θ₁、θ₂ 弧线标注；θ₁ 随时间由 0 扫到大于临界角 θ_c，θ₁>θ_c 时折射光消失、反射线高亮（全反射演示，示意）。
 * 角落保留一小幅凸透镜成像示意（呼应“透镜成像”标题），但主体是界面折射/全反射。
 */
function lensRefraction(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
) {
  // 折射率（n₁ 光密在上、n₂ 光疏在下）与临界角
  const n1 = 1.50, n2 = 1.00;
  const thetaC = Math.asin(n2 / n1);

  // 两种介质半平面（上下分界面 y=0）
  const medGeo = bag.geo(new THREE.PlaneGeometry(12, 3.4));
  const med1 = new THREE.Mesh(medGeo, bag.mat(new THREE.MeshBasicMaterial({
    color: 0x1d4ed8, transparent: true, opacity: 0.22, depthTest: false,
  })));
  med1.position.set(0, 1.7, -0.3); med1.renderOrder = 990; g.add(med1);
  const med2 = new THREE.Mesh(medGeo, bag.mat(new THREE.MeshBasicMaterial({
    color: 0x0ea5e9, transparent: true, opacity: 0.10, depthTest: false,
  })));
  med2.position.set(0, -1.7, -0.3); med2.renderOrder = 990; g.add(med2);

  // 界面（水平实线）
  const iface = makeRay(bag, THREE, PAL.white, 2);
  iface.set([new THREE.Vector3(-6, 0, 0), new THREE.Vector3(6, 0, 0)]);
  g.add(iface.line);

  // 法线（竖直虚线）
  const normalGeo = bag.geo(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -3.3, 0), new THREE.Vector3(0, 3.3, 0),
  ]));
  const normal = new THREE.Line(normalGeo, bag.mat(new THREE.LineDashedMaterial({
    color: PAL.slate, gapSize: 0.18, dashSize: 0.24,
  })));
  normal.computeLineDistances();
  g.add(normal);

  // 入射/折射/反射三光线 + 两条角度弧
  const inc = makeRay(bag, THREE, PAL.gold, 2);
  const refr = makeRay(bag, THREE, PAL.cyan, 2);
  const refl = makeRay(bag, THREE, PAL.green, 2);
  const arc1 = makeRay(bag, THREE, PAL.amber, 24);
  const arc2 = makeRay(bag, THREE, PAL.cyan, 24);
  [inc, refr, refl, arc1, arc2].forEach((r) => g.add(r.line));

  // 介质 / 角度标签（θ 标签随光线每帧移动）
  g.add(tag(bag, THREE, 'n₁(光密)', -5.2, 2.8, '#bfdbfe'));
  g.add(tag(bag, THREE, 'n₂(光疏)', -5.2, -2.8, '#a5f3fc'));
  g.add(tag(bag, THREE, '法线', 0.35, 3.25, '#94a3b8'));
  const theta1Lab = tag(bag, THREE, 'θ₁', -1.2, 1.2, '#fbbf24'); g.add(theta1Lab);
  const theta2Lab = tag(bag, THREE, 'θ₂', 1.2, -1.2, '#22d3ee'); g.add(theta2Lab);
  // 全反射高亮标签（仅 θ₁>θ_c 时可见）
  const tirTag = tag(bag, THREE, '全反射！', 3.6, 2.3, '#ef4444'); tirTag.visible = false; g.add(tirTag);

  // 动态读数面板（每若干帧重绘一次）
  const rcv = document.createElement('canvas');
  rcv.width = 340; rcv.height = 176;
  const rc = rcv.getContext('2d')!;
  const rtex = bag.tex(new THREE.CanvasTexture(rcv));
  const readout = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(3.4, 1.76)),
    bag.mat(new THREE.MeshBasicMaterial({ map: rtex, transparent: true, depthTest: false })),
  );
  readout.position.set(4.6, -2.4, 0);
  readout.renderOrder = 997;
  g.add(readout);
  function drawReadout(th1: number, th2: number | null, tir: boolean): void {
    rc.fillStyle = 'rgba(7,11,20,0.85)'; rc.fillRect(0, 0, 340, 176);
    rc.strokeStyle = '#334155'; rc.lineWidth = 3; rc.strokeRect(2, 2, 336, 172);
    rc.textAlign = 'left'; rc.font = 'bold 20px "Microsoft YaHei", sans-serif';
    rc.fillStyle = '#fbbf24'; rc.fillText(`θ₁ = ${(th1 * 180 / Math.PI).toFixed(1)}°`, 16, 30);
    if (tir) {
      rc.fillStyle = '#ef4444'; rc.fillText('θ₁>θ_c → 折射光消失', 16, 60);
    } else {
      rc.fillStyle = '#22d3ee';
      rc.fillText(`θ₂ = ${((th2 as number) * 180 / Math.PI).toFixed(1)}°`, 16, 60);
    }
    rc.fillStyle = '#cbd5e1'; rc.font = '18px "Microsoft YaHei", sans-serif';
    rc.fillText(`n₁sinθ₁ = ${(n1 * Math.sin(th1)).toFixed(3)}`, 16, 94);
    rc.fillText(`n₂sinθ₂ = ${tir ? '— (全反射)' : (n2 * Math.sin(th2 as number)).toFixed(3)}`, 16, 120);
    rc.fillStyle = '#94a3b8'; rc.font = '15px "Microsoft YaHei", sans-serif';
    rc.fillText(`θ_c = arcsin(n₂/n₁) = ${(thetaC * 180 / Math.PI).toFixed(1)}°`, 16, 152);
    rtex.needsUpdate = true;
  }
  drawReadout(0, 0, false);

  // 角落凸透镜成像示意（小图，呼应标题中的“透镜成像”；主体仍为界面折射）
  const miniGeo = bag.geo(new THREE.PlaneGeometry(0.1, 1.5));
  const miniLens = new THREE.Mesh(miniGeo, bag.mat(new THREE.MeshBasicMaterial({
    color: 0x67e8f9, transparent: true, opacity: 0.6, depthTest: false,
  })));
  miniLens.position.set(-4.6, -2.8, 0); miniLens.renderOrder = 996; g.add(miniLens);
  // F/2F 标记（小窗内）
  const miniF = bag.geo(new THREE.SphereGeometry(0.03, 8, 8));
  const miniFMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold }));
  g.add(new THREE.Mesh(miniF, miniFMat).translateX(-4.6 + 0.8).translateY(-2.8));
  g.add(tag(bag, THREE, 'F', -4.6 + 0.8, -2.72, '#fbbf24'));
  const miniObj = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(-5.9, -3.4, 0), 0.55, PAL.amber, 0.12, 0.07,
  );
  g.add(miniObj);
  // 两条会聚光线（动态）
  const miniR1 = makeRay(bag, THREE, PAL.cyan, 3);
  const miniR2 = makeRay(bag, THREE, PAL.green, 2);
  g.add(miniR1.line); g.add(miniR2.line);
  g.add(tag(bag, THREE, '透镜成像示意', -4.4, -1.95, '#64748b'));
  g.add(tag(bag, THREE, '透镜成像示意', -4.4, -1.95, '#64748b'));

  // 知识点面板：斯涅尔定律与临界角
  g.add(panelSprite(THREE, bag, [
    { text: `斯涅尔定律 n₁sinθ₁ = n₂sinθ₂（n₁=${n1} > n₂=${n2}）`, color: '#f8fafc' },
    { text: `临界角 θ_c = arcsin(n₂/n₁) = ${(thetaC * 180 / Math.PI).toFixed(1)}°`, color: '#94a3b8' },
    { text: 'θ₁<θ_c：折射+反射共存；θ₁>θ_c：折射消失、光全反射回 n₁（示意）', color: '#fbbf24' },
  ], [0, 4.3, 0], 8.4, 'center'));

  ctx.camera.position.set(0, 1.2, 13);
  const L = 4.0;
  const ARC = 1.3;
  return (t: number) => {
    // θ₁ 由 0 平滑扫到 1.25·θ_c 再返回，展示从折射到全反射的过程
    const th1 = thetaC * 1.25 * (0.5 - 0.5 * Math.cos(t * 0.55));
    const s2 = (n1 / n2) * Math.sin(th1);
    const tir = s2 > 1;
    const th2 = tir ? null : Math.asin(s2);

    // 入射（左上→O）
    inc.set([new THREE.Vector3(-L * Math.sin(th1), L * Math.cos(th1), 0), new THREE.Vector3(0, 0, 0)]);
    // 反射（O→右上）
    refl.set([new THREE.Vector3(0, 0, 0), new THREE.Vector3(L * Math.sin(th1), L * Math.cos(th1), 0)]);
    // 折射（O→右下），全反射时隐藏
    if (!tir && th2 !== null) {
      refr.line.visible = true;
      refr.set([new THREE.Vector3(0, 0, 0), new THREE.Vector3(L * Math.sin(th2), -L * Math.cos(th2), 0)]);
    } else {
      refr.line.visible = false;
    }
    // 全反射时反射线高亮（变色），否则恢复
    (refl.line.material as import('three').LineBasicMaterial).color.setHex(tir ? PAL.red : PAL.green);
    tirTag.visible = tir;

    // θ₁ 弧：法线上行 (0,ARC) 扫到入射光线方向（左上象限）
    const p1: import('three').Vector3[] = [];
    for (let i = 0; i <= 23; i++) {
      const a = th1 * (i / 23);
      p1.push(new THREE.Vector3(-ARC * Math.sin(a), ARC * Math.cos(a), 0));
    }
    arc1.set(p1);
    theta1Lab.position.set(-1.75 * Math.sin(th1 / 2), 1.75 * Math.cos(th1 / 2), 0);

    // θ₂ 弧：法线下行 (0,-ARC) 扫到折射光线方向（右下象限）
    if (!tir && th2 !== null) {
      arc2.line.visible = true;
      const p2: import('three').Vector3[] = [];
      for (let i = 0; i <= 23; i++) {
        const a = th2 * (i / 23);
        p2.push(new THREE.Vector3(ARC * Math.sin(a), -ARC * Math.cos(a), 0));
      }
      arc2.set(p2);
      theta2Lab.visible = true;
      theta2Lab.position.set(1.75 * Math.sin(th2 / 2), -1.75 * Math.cos(th2 / 2), 0);
    } else {
      arc2.line.visible = false;
      theta2Lab.visible = false;
    }

    // 读数节流重绘
    if (Math.floor(t * 12) % 2 === 0) drawReadout(th1, th2, tir);

    // 角落小窗：凸透镜 u 扫描动画（1/u+1/v=1/f）
    const miniFocal = 1.2;
    const miniU = miniFocal * (1.6 + 1.4 * Math.sin(t * 0.3));
    const miniXO = -5.9 - miniU * 0.3;
    const miniV = 1 / (1 / miniFocal - 1 / miniU);
    const miniM = -miniV / miniU;
    miniObj.position.x = miniXO;
    const miniYTop = 0.55;
    const miniImgY = miniYTop * miniM;
    miniR1.set([
      new THREE.Vector3(miniXO, miniYTop, 0),
      new THREE.Vector3(-4.6, miniYTop, 0),
      new THREE.Vector3(-4.6 + miniFocal, miniImgY * 0.5, 0),
    ]);
    miniR2.set([
      new THREE.Vector3(miniXO, miniYTop, 0),
      new THREE.Vector3(-4.6 + miniFocal, miniImgY * 0.5, 0),
    ]);
  };
}

/** 便捷：画一条静态折线（登记进 bag），用于示意图 */
function lineFromStatic(
  bag: ResourceBag,
  THREE: typeof import('three'),
  color: number,
  pts: import('three').Vector3[],
): import('three').Line {
  const geo = bag.geo(new THREE.BufferGeometry().setFromPoints(pts));
  return new THREE.Line(geo, bag.mat(new THREE.LineBasicMaterial({ color })));
}

/** 球面镜成像：凹面镜，物在 C 外 → 倒立缩小实像 */
function mirror(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
) {
  const R = 5.0, f = R / 2;
  const ax = axis(bag, THREE, 7); ax.computeLineDistances(); g.add(ax);

  // 凹面镜（球壳剖面）
  const arcPts: import('three').Vector3[] = [];
  for (let i = 0; i <= 60; i++) {
    const a = -0.62 + (i / 60) * 1.24;
    arcPts.push(new THREE.Vector3(R * Math.cos(a) - R, R * Math.sin(a), 0));
  }
  const mirrorMesh = new THREE.Mesh(
    bag.geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arcPts), 60, 0.08, 8, false)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.8, roughness: 0.2 })),
  );
  g.add(mirrorMesh);

  const dotGeo = bag.geo(new THREE.SphereGeometry(0.1, 12, 12));
  const dotMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold }));
  [[0, 'P'], [-f, 'F'], [-R, 'C']].forEach(([x, label]) => {
    const d = new THREE.Mesh(dotGeo, dotMat);
    d.position.set(x as number, 0, 0);
    g.add(d);
    g.add(tag(bag, THREE, label as string, x as number, -0.45));
  });

  const objArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 1.3, PAL.amber, 0.22, 0.12,
  );
  objArrow.position.x = -6;
  g.add(objArrow);
  const imgArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 0), 1, PAL.pink, 0.22, 0.12,
  );
  g.add(imgArrow);

  const rA = makeRay(bag, THREE, PAL.cyan, 4);
  const rB = makeRay(bag, THREE, PAL.green, 3);
  g.add(rA.line); g.add(rB.line);

  g.add(panelSprite(THREE, bag, [
    { text: '球面镜：1/u + 1/v = 1/f，f = R/2（凹面镜取正）', color: '#f8fafc' },
    { text: 'u > 2f：倒立缩小实像（位于 F 与 C 之间）', color: '#94a3b8' },
    { text: 'u < f：正立放大虚像（镜后），放大镜原理', color: '#fbbf24' },
  ], [0, 4.2, 0], 7.6, 'center'));

  ctx.camera.position.set(0, 1.8, 13);
  return (t: number) => {
    const u = f * (1.2 + 1.9 * (Math.sin(t * 0.3) * 0.5 + 0.5));
    const objX = -u;
    objArrow.position.x = objX;
    const v = 1 / (1 / f - 1 / u);
    const m = -v / u;
    imgArrow.position.x = -Math.abs(v);
    imgArrow.setLength(Math.min(3.4, Math.abs(m) * 1.3), 0.2, 0.11);
    imgArrow.setDirection(new THREE.Vector3(0, m >= 0 ? 1 : -1, 0));

    // 光线 A：平行 → 过 F → 回射汇聚
    rA.set([
      new THREE.Vector3(objX, 1.3, 0),
      new THREE.Vector3(0, 1.3, 0),
      new THREE.Vector3(-f, 0, 0),
      new THREE.Vector3(-Math.abs(v), m * 1.3, 0),
    ]);
    // 光线 B：过曲率中心 → 原路返回
    rB.set([
      new THREE.Vector3(objX, 1.3, 0),
      new THREE.Vector3(-R * 0.55, 1.3 * 0.55, 0),
      new THREE.Vector3(-Math.abs(v), m * 1.3, 0),
    ]);
  };
}

/** 棱镜色散：白光分解为彩虹，红偏折最小、紫最大 */
function prism(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
) {
  // 棱镜（等边三角柱）
  const tri = new THREE.Shape();
  tri.moveTo(-1.5, -1.1);
  tri.lineTo(1.5, -1.1);
  tri.lineTo(0, 1.5);
  tri.closePath();
  const prismMesh = new THREE.Mesh(
    bag.geo(new THREE.ExtrudeGeometry(tri, { depth: 1.4, bevelEnabled: false })),
    bag.mat(new THREE.MeshStandardMaterial({
      color: 0xa5f3fc, transparent: true, opacity: 0.3, roughness: 0.1, side: THREE.DoubleSide,
    })),
  );
  prismMesh.position.z = -0.7;
  g.add(prismMesh);

  // 入射白光
  const white = makeRay(bag, THREE, 0xffffff, 3);
  g.add(white.line);
  // —— 两界面 Snell 追迹所需截面几何（与挤出三棱柱同坐标；验证脚本 snell.js）——
  const CA_A = 1.497, CA_B = 7400; // Cauchy n = A + B/λ²（λ: nm，示的火石玻璃；n(λ) 曲线与谱线同源）
  const nOf = (lam: number): number => CA_A + CA_B / (lam * lam);
  const TV: [number, number] = [0, 1.5], LV: [number, number] = [-1.5, -1.1], RV: [number, number] = [1.5, -1.1];
  const cen2: [number, number] = [(TV[0] + LV[0] + RV[0]) / 3, (TV[1] + LV[1] + RV[1]) / 3];
  const EDGES: [[number, number], [number, number]][] = [[LV, TV], [TV, RV], [LV, RV]]; // 左面、右面、底面
  const OUTN = EDGES.map(([p, q]) => {
    const ex = q[0] - p[0], ey = q[1] - p[1], l = Math.hypot(ex, ey);
    let n: [number, number] = [ey / l, -ex / l];
    const mid: [number, number] = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (n[0] * (mid[0] - cen2[0]) + n[1] * (mid[1] - cen2[1]) < 0) n = [-n[0], -n[1]];
    return n;
  });
  const hitEdge = (P: [number, number], d: [number, number], i: number): { s: number; pt: [number, number] } | null => {
    const [p0, p1] = EDGES[i];
    const ex = p1[0] - p0[0], ey = p1[1] - p0[1];
    const den = d[0] * ey - d[1] * ex;
    if (Math.abs(den) < 1e-12) return null;
    const wx = p0[0] - P[0], wy = p0[1] - P[1];
    const s = (wx * ey - wy * ex) / den;
    const u = (wx * d[1] - wy * d[0]) / den;
    if (s > 1e-6 && u > 1e-6 && u < 1 - 1e-6) return { s, pt: [P[0] + s * d[0], P[1] + s * d[1]] };
    return null;
  };
  // 2D 向量 Snell：r = n1/n2；返回折射单位方向，sin²θt>1 时 null（全反射）
  const refract = (d: [number, number], nOut: [number, number], r: number): [number, number] | null => {
    let n = nOut;
    let cosi = -(d[0] * n[0] + d[1] * n[1]);
    if (cosi < 0) { n = [-n[0], -n[1]]; cosi = -cosi; }
    const sin2t = r * r * (1 - cosi * cosi);
    if (sin2t > 1) return null;
    const f = r * cosi - Math.sqrt(1 - sin2t);
    return [r * d[0] + f * n[0], r * d[1] + f * n[1]];
  };
  const P1: [number, number] = [(LV[0] + TV[0]) / 2, (LV[1] + TV[1]) / 2]; // 入射点：左面中点
  const EH: [number, number] = [TV[0] - LV[0], TV[1] - LV[1]];
  const El = Math.hypot(EH[0], EH[1]);
  const ET: [number, number] = [EH[0] / El, EH[1] / El]; // 左面切向（L→T）
  const d0of = (th: number): [number, number] => {
    const d: [number, number] = [-OUTN[0][0] * Math.cos(th) + ET[0] * Math.sin(th),
      -OUTN[0][1] * Math.cos(th) + ET[1] * Math.sin(th)];
    const l = Math.hypot(d[0], d[1]);
    return [d[0] / l, d[1] / l];
  };
  // 完整追迹 入→左面折射→下一个界面→出射；返回出射方向与出射点（TIR/脱靶 → null）
  const traceOut = (d0: [number, number], n: number): { d1: [number, number]; d2: [number, number]; P2: [number, number] } | null => {
    const d1 = refract(d0, OUTN[0], 1 / n);
    if (!d1) return null;
    let best: { s: number; pt: [number, number]; i: number } | null = null;
    for (const i of [1, 2, 0]) {
      const h = hitEdge(P1, d1, i);
      if (h && (!best || h.s < best.s)) best = { s: h.s, pt: h.pt, i };
    }
    if (!best) return null;
    const d2 = refract(d1, OUTN[best.i], n);
    if (!d2) return null;
    return { d1, d2, P2: best.pt };
  };
  const devOf = (thDeg: number, n: number): number | null => {
    const d0 = d0of(thDeg * Math.PI / 180);
    const r = traceOut(d0, n);
    if (!r) return null;
    const c = Math.min(1, Math.max(-1, d0[0] * r.d2[0] + d0[1] * r.d2[1]));
    return (Math.acos(c) * 180) / Math.PI;
  };
  // δ_min 数值扫描（与画面追迹同一套函数 → 面板读数同源）
  const dminOf = (n: number): number => {
    let m = 1e9;
    for (let g = 30; g <= 85; g += 0.1) { const d = devOf(g, n); if (d !== null && d < m) m = d; }
    return m;
  };
  // 出射彩虹（7 条）：n 直接取 Cauchy 公式值（与 n(λ) 曲线严格同源）
  const bands = [
    { col: 0xef4444, lam: 700, name: '红' },
    { col: 0xf97316, lam: 620, name: '橙' },
    { col: 0xfbbf24, lam: 580, name: '黄' },
    { col: 0x22c55e, lam: 530, name: '绿' },
    { col: 0x3b82f6, lam: 470, name: '蓝' },
    { col: 0x6366f1, lam: 440, name: '靛' },
    { col: 0x8b5cf6, lam: 400, name: '紫' },
  ].map((b) => ({ ...b, n: nOf(b.lam) }));
  const rays = bands.map((b) => {
    const r = makeRay(bag, THREE, b.col, 3);
    g.add(r.line);
    return r;
  });

  // n(λ) 曲线（Cauchy）画布
  const cv = document.createElement('canvas');
  cv.width = 320; cv.height = 260;
  const c2 = cv.getContext('2d')!;
  const tex = bag.tex(new THREE.CanvasTexture(cv));
  const plot = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(3.6, 2.93)),
    bag.mat(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false })),
  );
  plot.position.set(6.6, -0.6, 0);
  plot.renderOrder = 997;
  g.add(plot);

  c2.fillStyle = 'rgba(7,11,20,0.85)'; c2.fillRect(0, 0, 320, 260);
  c2.strokeStyle = '#334155'; c2.lineWidth = 3; c2.strokeRect(1.5, 1.5, 317, 257);
  c2.strokeStyle = '#475569'; c2.beginPath();
  c2.moveTo(48, 18); c2.lineTo(48, 222); c2.lineTo(304, 222); c2.stroke();
  c2.fillStyle = '#94a3b8'; c2.font = '16px sans-serif'; c2.textAlign = 'center';
  c2.fillText('n(λ)', 26, 30); c2.fillText('λ (nm)', 176, 244);
  // Cauchy: n = A + B/λ²（与谱线 n 同一函数 nOf）
  for (let i = 0; i <= 100; i++) {
    const lam = 400 + (i / 100) * 500;
    const n = nOf(lam);
    const px = 48 + (i / 100) * 252;
    const py = 222 - ((n - 1.50) / 0.05) * 200;
    if (i === 0) c2.beginPath(), c2.moveTo(px, py); else c2.lineTo(px, py);
  }
  c2.strokeStyle = '#f8fafc'; c2.lineWidth = 3; c2.stroke();
  // 标出红/紫（n 值直接来自同一条 Cauchy 曲线）
  [[400, '#8b5cf6', '紫 400nm'], [700, '#ef4444', '红 700nm']].forEach(([lam, col, label]) => {
    const l = lam as number;
    const n = nOf(l);
    const px2 = 48 + ((l - 400) / 500) * 252;
    const py = 222 - ((n - 1.50) / 0.05) * 200;
    c2.fillStyle = col as string;
    c2.beginPath(); c2.arc(px2, py, 6, 0, 7); c2.fill();
    c2.textAlign = 'left'; c2.font = '15px sans-serif';
    c2.fillText(`${label} n=${n.toFixed(3)}`, px2 + 10, py - 6);
    c2.textAlign = 'center';
  });
  c2.fillStyle = '#f8fafc'; c2.font = '16px sans-serif';
  c2.fillText(`n = ${CA_A} + ${CA_B}/λ²（柯西）`, 190, 52);
  tex.needsUpdate = true;

  // δ(θᵢ) 曲线画布：扫描入射角找最小偏向角（曲线值与画面光线同一 devOf）
  const cv2 = document.createElement('canvas');
  cv2.width = 300; cv2.height = 220;
  const c3 = cv2.getContext('2d')!;
  const tex2 = bag.tex(new THREE.CanvasTexture(cv2));
  const plot2 = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(3.3, 2.42)),
    bag.mat(new THREE.MeshBasicMaterial({ map: tex2, transparent: true, depthTest: false })),
  );
  plot2.position.set(6.7, -3.8, 0);
  plot2.renderOrder = 997;
  g.add(plot2);
  const dMinR = dminOf(nOf(700));
  const dMinV = dminOf(nOf(400));
  const drawDelta = (thNow: number): void => {
    c3.fillStyle = 'rgba(7,11,20,0.85)'; c3.fillRect(0, 0, 300, 220);
    c3.strokeStyle = '#475569'; c3.lineWidth = 2;
    c3.beginPath(); c3.moveTo(40, 14); c3.lineTo(40, 186); c3.lineTo(288, 186); c3.stroke();
    c3.fillStyle = '#f8fafc'; c3.font = 'bold 15px sans-serif'; c3.textAlign = 'center';
    c3.fillText('δ(θᵢ) 最小偏向角', 160, 14 + 14);
    c3.fillStyle = '#94a3b8'; c3.font = '13px sans-serif';
    c3.fillText('θᵢ (°)', 160, 212);
    c3.save(); c3.translate(13, 100); c3.rotate(-Math.PI / 2); c3.fillText('δ (°)', 0, 0); c3.restore();
    const xOf = (g: number) => 40 + ((g - 30) / 55) * 248;   // θᵢ 30..85
    const yOf = (dv: number) => 186 - ((dv - 30) / 25) * 166; // δ 30..55
    for (const [lam, col] of [[700, '#ef4444'], [400, '#8b5cf6']] as [number, string][]) {
      c3.strokeStyle = col; c3.lineWidth = 2.5; c3.beginPath();
      let started = false;
      for (let g = 30; g <= 85; g += 1) {
        const dv = devOf(g, nOf(lam));
        if (dv === null) { started = false; continue; }
        if (!started) { c3.moveTo(xOf(g), yOf(dv)); started = true; } else c3.lineTo(xOf(g), yOf(dv));
      }
      c3.stroke();
    }
    // δ_min 点与竖线（当前 θᵢ 游标 → 画面扫描时可见 δ 过谷底）
    c3.fillStyle = '#fbbf24';
    c3.beginPath(); c3.arc(xOf(49), yOf(dMinR), 4, 0, 7); c3.fill();
    c3.beginPath(); c3.arc(xOf(51), yOf(dMinV), 4, 0, 7); c3.fill();
    c3.strokeStyle = '#f8fafc'; c3.setLineDash([4, 4]); c3.lineWidth = 1.5;
    c3.beginPath(); c3.moveTo(xOf(thNow), 20); c3.lineTo(xOf(thNow), 186); c3.stroke();
    c3.setLineDash([]);
    c3.textAlign = 'left'; c3.font = '12px sans-serif'; c3.fillStyle = '#94a3b8';
    c3.fillText(`δm红=${dMinR.toFixed(1)}° δm紫=${dMinV.toFixed(1)}°`, 44, 34);
    tex2.needsUpdate = true;
  };
  drawDelta(58);

  g.add(panelSprite(THREE, bag, [
    { text: '色散：n(λ) 随波长变化 → 各色光折射角不同（谱线 n 与 Cauchy 曲线同源）', color: '#f8fafc' },
    { text: '紫光 n 最大、偏折最多；红光 n 最小、偏折最少（出射面向底面偏折）', color: '#94a3b8' },
    { text: '两界面 Snell 追迹：n₁sinθ₁=n₂sinθ₂，偏向角 δ = θ₁+θ₄−A（A=60°）', color: '#fbbf24' },
    { text: `最小偏向角 n=sin((A+δm)/2)/sin(A/2)：δm 红 ${dMinR.toFixed(1)}°、紫 ${dMinV.toFixed(1)}°（θᵢ 往复扫描过谷底）`, color: '#22c55e' },
  ], [0, 4.0, 0], 7.6, 'center'));

  ctx.camera.position.set(0, 1.2, 12);
  const OUT_LEN = 4.6;
  let lastMark = -1;
  return (t: number, dt: number) => {
    // 入射角 θᵢ 在 38°–78° 之间往复扫描（δ 随 θᵢ 变化并越过 δ_min 谷底）
    const thDeg = 58 + 20 * Math.sin(t * 0.5);
    const d0 = d0of((thDeg * Math.PI) / 180);
    const S: [number, number] = [P1[0] - d0[0] * 5.6, P1[1] - d0[1] * 5.6];
    white.set([
      new THREE.Vector3(S[0], S[1], 0),
      new THREE.Vector3(P1[0], P1[1], 0),
      new THREE.Vector3(P1[0], P1[1], 0),
    ]);
    bands.forEach((b, i) => {
      const r = traceOut(d0, b.n);
      if (!r) { rays[i].line.visible = false; return; }
      rays[i].line.visible = true;
      rays[i].set([
        new THREE.Vector3(P1[0], P1[1], 0),
        new THREE.Vector3(r.P2[0], r.P2[1], 0),
        new THREE.Vector3(r.P2[0] + r.d2[0] * OUT_LEN, r.P2[1] + r.d2[1] * OUT_LEN, 0),
      ]);
    });
    // δ(θᵢ) 游标按 5Hz 重绘
    const bucket = Math.floor(t * 5);
    if (bucket !== lastMark) {
      lastMark = bucket;
      drawDelta(thDeg);
    }
    void dt;
  };
}

/** 光纤：全反射，入射角超过临界角的光线被约束在纤芯内 */
function fiber(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
) {
  const coreN = 1.48, cladN = 1.40;
  const thetaC = Math.asin(cladN / coreN);

  // 纤芯 / 包层
  const core = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(12, 1.0, 1.0)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.28 })),
  );
  g.add(core);
  const clad = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(12, 1.6, 1.6)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x475569, transparent: true, opacity: 0.14 })),
  );
  g.add(clad);

  // 纤芯-包层界面标记
  for (const y of [0.5, -0.5]) {
    const ln = new THREE.Line(
      bag.geo(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-6, y, 0), new THREE.Vector3(6, y, 0),
      ])),
      bag.mat(new THREE.LineDashedMaterial({ color: PAL.gold, gapSize: 0.2, dashSize: 0.28 })),
    );
    ln.computeLineDistances();
    g.add(ln);
  }

  // 多模锯齿折线（模色散）：轴向锥角 a 的光在上下界面入射角 = 90°−a，
  // 全反射要求 90°−a > θ_c → a < 90°−θ_c；取 4 条可行模，路径 L=12/cos(a) 不同 → 出射时刻错开
  const aLimit = (Math.PI / 2 - thetaC) * (180 / Math.PI);   // ≈19.0°
  const modeDegs = [4, 9, 14, 18.5].filter((d) => d < aLimit);
  const modeCols = [PAL.cyan, PAL.green, PAL.gold, PAL.red];
  const zigzag = (a: number): { pts: import('three').Vector3[]; cum: number[]; L: number } => {
    const slope = Math.tan(a);
    const pts: import('three').Vector3[] = [new THREE.Vector3(-6, 0, 0)];
    const cum: number[] = [0];
    let x = -6, y = 0, dir = 1, L = 0;
    for (let i = 0; i < 40 && x < 6; i++) {
      const toB = dir > 0 ? 0.48 - y : y + 0.48;              // 到上/下边界还需的 |Δy|
      let dx = slope > 1e-6 ? toB / slope : 99;
      if (x + dx >= 6) { dx = 6 - x; x = 6; y += dir * dx * slope; }
      else { x += dx; y = dir > 0 ? 0.48 : -0.48; dir = -dir; }
      L += dx / Math.cos(a);
      pts.push(new THREE.Vector3(x, y, 0));
      cum.push(L);
      if (x >= 6) break;
    }
    return { pts, cum, L };
  };
  const modes = modeDegs.map((d, i) => {
    const z = zigzag((d * Math.PI) / 180);
    const ray = makeRay(bag, THREE, modeCols[i], 12);
    ray.set(z.pts);
    g.add(ray.line);
    // 每条模 3 枚脉冲光点（同刻发射、路程不同 → 依次错开出射）
    const dots: import('three').Mesh[] = [];
    const dGeo = bag.geo(new THREE.SphereGeometry(0.09, 10, 8));
    for (let j = 0; j < 3; j++) {
      const dot = new THREE.Mesh(dGeo, bag.mat(new THREE.MeshBasicMaterial({
        color: modeCols[i], transparent: true, opacity: 0.95,
      })));
      g.add(dot);
      dots.push(dot);
    }
    return { ...z, d, dots };
  });
  // 入射端脉动光点（脉冲串发出口）
  const inDot = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.13, 12, 10)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.white, transparent: true, opacity: 0.9 })),
  );
  inDot.position.set(-6.15, 0, 0);
  g.add(inDot);
  const dLmax = modes.length ? modes[modes.length - 1].L - 12 : 0;   // 最高阶模与轴向（≈12）路径差

  // 数值孔径锥
  const naCone = new THREE.Mesh(
    bag.geo(new THREE.ConeGeometry(0.9, 2.2, 24, 1, true)),
    bag.mat(new THREE.MeshBasicMaterial({
      color: PAL.green, wireframe: true, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
    })),
  );
  naCone.position.set(-6, 0, 0);
  naCone.rotation.z = Math.PI / 2;
  g.add(naCone);

  g.add(panelSprite(THREE, bag, [
    { text: '全反射：入射角 θ > θ_c = arcsin(n₂/n₁) 时光全部反射回纤芯', color: '#f8fafc' },
    { text: `n₁=${coreN}、n₂=${cladN} → θ_c = ${(thetaC * 180 / Math.PI).toFixed(1)}°`, color: '#94a3b8' },
    { text: `数值孔径 NA = sin θ_max = √(n₁²−n₂²) = ${Math.sqrt(coreN * coreN - cladN * cladN).toFixed(3)}`, color: '#22c55e' },
    { text: `模色散：可行模 a<${aLimit.toFixed(1)}°，路径 L=12/cos a → 高阶模多走 ΔL=${dLmax.toFixed(2)}（出射错开、脉冲展宽）`, color: '#67e8f9' },
  ], [0, 4.0, 0], 7.8, 'center'));

  ctx.camera.position.set(0, 2.2, 13);
  const SPEED = 4.2;    // 示意群速度（世界单位/s）
  const P_T = 1.6;      // 脉冲串周期（s）
  return (t: number) => {
    const age0 = t % P_T;
    modes.forEach((m) => {
      m.dots.forEach((dot, j) => {
        const s = (age0 + j * P_T) * SPEED;           // 该脉冲已走过的弧长
        const vis = s < m.L;
        dot.visible = vis;
        if (!vis) return;
        let k = 1;
        while (k < m.cum.length && m.cum[k] < s) k++;
        const c0 = m.cum[k - 1], c1 = m.cum[Math.min(k, m.cum.length - 1)];
        const f = c1 > c0 ? (s - c0) / (c1 - c0) : 0;
        const p0 = m.pts[k - 1], p1 = m.pts[Math.min(k, m.pts.length - 1)];
        dot.position.set(p0.x + (p1.x - p0.x) * f, p0.y + (p1.y - p0.y) * f, 0);
      });
    });
    // 入射端脉动（刚发过的脉冲最亮）
    (inDot.material as import('three').MeshBasicMaterial).opacity = 0.9 * (1 - age0 / P_T) + 0.1;
    inDot.scale.setScalar(1 + 0.5 * (1 - age0 / P_T));
  };
}

/** 人眼调焦：睫状肌改变晶状体曲率，近/远物成像在视网膜上 */
function eye(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
) {
  // 眼球外壳
  const globe = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(2.4, 40, 28)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.18, side: THREE.DoubleSide })),
  );
  g.add(globe);
  // 视网膜（后壁）
  const retina = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(2.32, 40, 28, Math.PI * 0.72, Math.PI * 0.56)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xf87171, transparent: true, opacity: 0.5, side: THREE.DoubleSide })),
  );
  retina.rotation.y = -Math.PI / 2;
  g.add(retina);
  // 角膜
  const cornea = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.9, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.5)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.4 })),
  );
  cornea.rotation.z = -Math.PI / 2;
  cornea.position.x = -2.3;
  g.add(cornea);
  // 晶状体（可变形双凸）
  const lensShape = new THREE.Shape();
  lensShape.moveTo(0, -0.75);
  lensShape.quadraticCurveTo(0.5, 0, 0, 0.75);
  lensShape.quadraticCurveTo(-0.5, 0, 0, -0.75);
  const lensGeo = bag.geo(new THREE.ExtrudeGeometry(lensShape, { depth: 0.1, bevelEnabled: false }));
  const lensMesh = new THREE.Mesh(lensGeo, bag.mat(new THREE.MeshStandardMaterial({
    color: 0xfbbf24, transparent: true, opacity: 0.6,
  })));
  lensMesh.rotation.y = Math.PI / 2;
  lensMesh.position.x = -1.5;
  g.add(lensMesh);
  // 睫状肌（环）
  const ciliary = new THREE.Mesh(
    bag.geo(new THREE.TorusGeometry(1.0, 0.14, 8, 32)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xf472b6 })),
  );
  ciliary.rotation.y = Math.PI / 2;
  ciliary.position.x = -1.5;
  g.add(ciliary);

  // 物（远处/近处来回）
  const objArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 1.1, PAL.amber, 0.2, 0.11,
  );
  g.add(objArrow);

  const rayTop = makeRay(bag, THREE, PAL.cyan, 5);
  const rayBot = makeRay(bag, THREE, PAL.green, 5);
  g.add(rayTop.line); g.add(rayBot.line);

  // —— 近视矫正子示意（concept 承诺）：左下角小图，平行光会聚在视网膜前=近视；加凹透镜后落视网膜 ——
  const myopY = -3.55;                       // 小图光轴高度
  g.add(lineFromStatic(bag, THREE, 0x475569, [
    new THREE.Vector3(-6.3, myopY, 0), new THREE.Vector3(-0.6, myopY, 0),
  ]));
  // 近视眼（红）：像成在视网膜前
  const eyeRing: import('three').Vector3[] = [];
  for (let i = 0; i <= 40; i++) {
    const a2 = (i / 40) * Math.PI * 2;
    eyeRing.push(new THREE.Vector3(-2.4 + 0.85 * Math.cos(a2), myopY + 0.85 * Math.sin(a2), 0));
  }
  g.add(lineFromStatic(bag, THREE, PAL.slate, eyeRing));
  g.add(lineFromStatic(bag, THREE, PAL.red, [
    new THREE.Vector3(-6.3, myopY + 0.3, 0), new THREE.Vector3(-3.25, myopY + 0.3, 0), new THREE.Vector3(-1.95, myopY, 0),
  ]));
  g.add(lineFromStatic(bag, THREE, PAL.red, [
    new THREE.Vector3(-6.3, myopY - 0.3, 0), new THREE.Vector3(-3.25, myopY - 0.3, 0), new THREE.Vector3(-1.95, myopY, 0),
  ]));
  g.add(tag(bag, THREE, '近视', -3.9, myopY - 0.75, '#ef4444'));
  // 凹透镜矫正（青）：预发散后像恰好落视网膜（环后缘 x=-1.55）
  g.add(lineFromStatic(bag, THREE, 0x67e8f9, [
    new THREE.Vector3(-5.2, myopY + 0.45, 0), new THREE.Vector3(-5.2, myopY - 0.45, 0),
  ]));
  g.add(lineFromStatic(bag, THREE, 0x67e8f9, [
    new THREE.Vector3(-6.3, myopY + 0.22, 0), new THREE.Vector3(-5.2, myopY + 0.22, 0),
    new THREE.Vector3(-3.25, myopY + 0.32, 0), new THREE.Vector3(-1.55, myopY, 0),
  ]));
  g.add(lineFromStatic(bag, THREE, 0x67e8f9, [
    new THREE.Vector3(-6.3, myopY - 0.22, 0), new THREE.Vector3(-5.2, myopY - 0.22, 0),
    new THREE.Vector3(-3.25, myopY - 0.32, 0), new THREE.Vector3(-1.55, myopY, 0),
  ]));
  g.add(tag(bag, THREE, '凹透镜', -5.2, myopY + 0.75, '#67e8f9'));

  g.add(panelSprite(THREE, bag, [
    { text: '眼睛调焦（睫状肌 → 晶状体曲率）：1/u + 1/v = 1/f，f = uv/(u+v) 与光线同源', color: '#f8fafc' },
    { text: '看远处：睫状肌放松、晶状体变薄、f 变长', color: '#94a3b8' },
    { text: '看近处：睫状肌收缩、晶状体变厚、f 变短（调节）', color: '#fbbf24' },
    { text: '近视矫正（左下示意）：折光过强像落视网膜前 → 凹透镜预发散，像后移回视网膜', color: '#67e8f9' },
  ], [0, 4.0, 0], 7.6, 'center'));

  ctx.camera.position.set(0, 0.8, 11);
  return (t: number) => {
    // 物距在 6.0（远）与 2.2（近）之间往复
    const u = 4.1 + 1.9 * Math.sin(t * 0.35);
    objArrow.position.x = -u;
    // 晶状体厚度随物距变化：近物 → 更厚
    const near = Math.max(0, Math.min(1, (5.6 - u) / 3.2));
    lensMesh.scale.set(1, 1, 1 + near * 0.9);
    (lensMesh.material as import('three').MeshStandardMaterial).opacity = 0.5 + near * 0.25;
    ciliary.scale.setScalar(1 - near * 0.12);

    // 调焦：视网膜位置 v 固定，晶状体 f 由薄透镜公式实时解出（看近 f 变短，与几何同源）
    const v = 2.32; // 像面（视网膜）位置，固定
    const fEye = (u * v) / (u + v);
    const m = -v / u;               // 严格薄透镜横向放大率
    // 光线：物尖 → 角膜 → 晶状体折射 → 严格会聚于视网膜像点 (v, m·h)（去装饰缩放）
    const yTop = 1.1;
    const imgYTop = m * yTop;
    const yBendTop = yTop * (1 - 0.15 / fEye);
    const lerpY = (yb: number, yt: number, x: number): number => {
      const f = (x - (-1.5)) / (v - (-1.5));
      return yb + (yt - yb) * f;
    };
    rayTop.set([
      new THREE.Vector3(-u, yTop, 0),
      new THREE.Vector3(-2.3, yTop * 0.95, 0),
      new THREE.Vector3(-1.5, yBendTop, 0),
      new THREE.Vector3(0.6, lerpY(yBendTop, imgYTop, 0.6), 0),
      new THREE.Vector3(v, imgYTop, 0),
    ]);
    const yBot = -0.35;
    const imgYBot = m * yBot;
    const yBendBot = yBot * (1 - 0.15 / fEye);
    rayBot.set([
      new THREE.Vector3(-u, yBot, 0),
      new THREE.Vector3(-2.3, yBot * 0.95, 0),
      new THREE.Vector3(-1.5, yBendBot, 0),
      new THREE.Vector3(0.6, lerpY(yBendBot, imgYBot, 0.6), 0),
      new THREE.Vector3(v, imgYBot, 0),
    ]);
  };
}

/** 像差：球差（边缘光线聚焦更近）+ 色差（红/蓝焦点分离）+ 双胶合校正 */
function aberration(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
) {
  const ax = axis(bag, THREE, 7); ax.computeLineDistances(); g.add(ax);

  const f = 3.0;
  // 单透镜
  const lensShape = new THREE.Shape();
  lensShape.moveTo(0, -1.9);
  lensShape.quadraticCurveTo(0.6, 0, 0, 1.9);
  lensShape.quadraticCurveTo(-0.6, 0, 0, -1.9);
  const singleLens = new THREE.Mesh(
    bag.geo(new THREE.ExtrudeGeometry(lensShape, { depth: 0.08, bevelEnabled: false })),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.35 })),
  );
  singleLens.rotation.y = Math.PI / 2;
  g.add(singleLens);

  // 三束不同高度的光线（球差）：边缘光线焦距更短
  const heights = [1.7, 1.0, 0.35];
  const sphRays = heights.map((h) => {
    const r = makeRay(bag, THREE, PAL.cyan, 3);
    g.add(r.line);
    return { r, h };
  });

  // 色差：红/蓝光焦点分离
  const redRay = makeRay(bag, THREE, 0xef4444, 3);
  const blueRay = makeRay(bag, THREE, 0x3b82f6, 3);
  g.add(redRay.line); g.add(blueRay.line);

  // 焦点标记
  const fGeo = bag.geo(new THREE.SphereGeometry(0.1, 12, 12));
  const sphFocus = new THREE.Mesh(fGeo, bag.mat(new THREE.MeshBasicMaterial({ color: PAL.white })));
  const redFocus = new THREE.Mesh(fGeo, bag.mat(new THREE.MeshBasicMaterial({ color: 0xef4444 })));
  const blueFocus = new THREE.Mesh(fGeo, bag.mat(new THREE.MeshBasicMaterial({ color: 0x3b82f6 })));
  [sphFocus, redFocus, blueFocus].forEach((m) => g.add(m));

  // 场曲：弯曲像面（不同视场角光束焦点轨迹）
  const fieldPts: import('three').Vector3[] = [];
  for (let i = 0; i <= 40; i++) {
    const y = -1.2 + (i / 40) * 2.4;
    // Petzval 场曲：边缘视场焦点更靠近透镜
    const zShift = -0.15 * (y / 1.2) * (y / 1.2);
    fieldPts.push(new THREE.Vector3(f * 0.85 + zShift, y, 0));
  }
  const fieldCurve = new THREE.Line(
    bag.geo(new THREE.BufferGeometry().setFromPoints(fieldPts)),
    bag.mat(new THREE.LineDashedMaterial({ color: PAL.pink, gapSize: 0.12, dashSize: 0.18 })),
  );
  fieldCurve.computeLineDistances();
  g.add(fieldCurve);
  g.add(tag(bag, THREE, '弯曲像面', f * 0.75, -1.3, '#f472b6'));

  g.add(panelSprite(THREE, bag, [
    { text: '球差：边缘光线比近轴光线聚焦更近，焦点"散开"成弥散斑', color: '#f8fafc' },
    { text: '色差：n(λ) 使蓝光焦距短于红光 → 焦点沿轴分离', color: '#94a3b8' },
    { text: '场曲：不同视场角焦点不在同一平面，需弯曲像面或双胶合校正', color: '#22c55e' },
  ], [0, 4.2, 0], 7.8, 'center'));

  ctx.camera.position.set(0, 1.8, 13);
  return (t: number) => {
    // 球差：边缘光线焦点更靠近透镜
    sphFocus.position.set(f * 0.78, 0, 0);
    redFocus.position.set(f * 0.96, 0, 0);
    blueFocus.position.set(f * 0.85, 0, 0);
    sphRays.forEach(({ r, h }) => {
      const focusX = f * (1 - 0.22 * (h / 1.9) * (h / 1.9));
      r.set([
        new THREE.Vector3(-6, h, 0),
        new THREE.Vector3(0, h, 0),
        new THREE.Vector3(focusX, 0, 0),
        new THREE.Vector3(focusX + 2.2, -h * 0.5, 0),
      ]);
    });
    // 色差光线
    redRay.set([
      new THREE.Vector3(-6, 0.18, 0),
      new THREE.Vector3(0, 0.18, 0),
      new THREE.Vector3(f * 0.96, 0, 0),
    ]);
    blueRay.set([
      new THREE.Vector3(-6, -0.18, 0),
      new THREE.Vector3(0, -0.18, 0),
      new THREE.Vector3(f * 0.85, 0, 0),
    ]);
    // 场曲：弯曲像面微动画（呼吸效果）
    const breathe = 1 + 0.02 * Math.sin(t * 0.5);
    fieldCurve.scale.set(breathe, 1, 1);
  };
}
