import type { SceneContext, SceneInstance } from '../types';
import { scaffold, panelSprite, lineFrom, PAL, ResourceBag } from './_common';

/**
 * instrument族（instrument）：观测/医学成像仪器族。
 * 覆盖知识点（编号与 scene-registry 绑定一致）：
 *  P81 迈克尔逊干涉仪(michelson) / P235 激光干涉引力波探测器(gwdetector 默认分支) /
 *  P266 干涉阵与综合孔径(array) / P273 微波背景辐射观测(cmb) /
 *  P275 首次引力波观测(gwdetector '首次'分支) / P283 太阳观测(sun) /
 *  P284 日冕观测(corona) / P316 相位衬度显微(phasecontrast) /
 *  P348 X 射线衰减成像(xray) / P349 CT 反投影重建(ct 默认分支) /
 *  P350 MRI 与 k 空间(mri) / P352 PET 正电子发射断层(pet 默认分支) /
 *  P353 SPECT 单光子成像(pet 'SPECT'分支) / P354 超声回波成像(ultrasound 默认分支) /
 *  P355 多普勒超声(ultrasound '多普勒'分支) / P356 高强度聚焦超声 HIFU(ultrasound '聚焦'分支) /
 *  P357 光学相干断层 OCT(oct) / P360 双能 CT 与能谱成像(ct '双能'分支) /
 *  P523 望远镜的衍射极限(resolution '衍射'分支) / P89 望远镜的分辨极限(resolution 默认分支)。
 * 由 scene-registry 按 slug+variant 绑定：make(variant, title)。
 * 所有尺度/亮度为教学示意（经视觉放大，面板已注明）。
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
    case 'array': return build_array(g, bag, THREE, title);
    case 'cmb': return build_cmb(g, bag, THREE, title);
    case 'corona': return build_corona(g, bag, THREE, title);
    case 'ct': return build_ct(g, bag, THREE, title);
    case 'gwdetector': return build_gwdetector(g, bag, THREE, title);
    case 'michelson': return build_michelson(g, bag, THREE, title);
    case 'mri': return build_mri(g, bag, THREE, title);
    case 'oct': return build_oct(g, bag, THREE, title);
    case 'pet': return build_pet(g, bag, THREE, title);
    case 'phasecontrast': return build_phasecontrast(g, bag, THREE, title);
    case 'resolution': return build_resolution(g, bag, THREE, title);
    case 'sun': return build_sun(g, bag, THREE, title);
    case 'ultrasound': return build_ultrasound(g, bag, THREE, title);
    case 'xray': return build_xray(g, bag, THREE, title);
    default: return build_array(g, bag, THREE, title);
  }
}

/* ============================ 族内本地工具 ============================ */

type V3 = import('three').Vector3;

/** 可重绘的画布平面（图像/曲线共用）；重绘后置 tex.needsUpdate=true */
function makeCanvasPlane(
  bag: ResourceBag,
  THREE: typeof import('three'),
  w: number,
  h: number,
  world: number,
  pos: [number, number, number],
): { m: import('three').Mesh; c: CanvasRenderingContext2D; tex: import('three').CanvasTexture } {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!;
  const tex = bag.tex(new THREE.CanvasTexture(cv));
  const m = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(world, (world * h) / w)),
    bag.mat(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false })),
  );
  m.position.set(pos[0], pos[1], pos[2]);
  m.renderOrder = 997;
  return { m, c, tex };
}

/** 带坐标框/轴标签的画布（thermal 黑体谱同款画法） */
function makePlot(
  bag: ResourceBag,
  THREE: typeof import('three'),
  w: number,
  h: number,
  world: number,
  pos: [number, number, number],
) {
  const p = makeCanvasPlane(bag, THREE, w, h, world, pos);
  function frame(ftitle: string, xlabel: string, ylabel: string): CanvasRenderingContext2D {
    const c = p.c;
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(7,11,20,0.85)'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#334155'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, w - 3, h - 3);
    c.strokeStyle = '#475569'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(46, 18); c.lineTo(46, h - 40); c.lineTo(w - 14, h - 40); c.stroke();
    c.fillStyle = '#f8fafc'; c.font = 'bold 18px sans-serif'; c.textAlign = 'center';
    c.fillText(ftitle, w / 2, 26, w - 30);
    c.fillStyle = '#94a3b8'; c.font = '16px sans-serif';
    c.fillText(xlabel, w / 2, h - 10);
    c.save(); c.translate(16, (h - 22) / 2); c.rotate(-Math.PI / 2); c.fillText(ylabel, 0, 0); c.restore();
    c.textAlign = 'left';
    return c;
  }
  return { m: p.m, c: p.c, tex: p.tex, W: w, H: h, frame };
}

/** 两点式动态线（每帧可改端点） */
function dynLine(
  THREE: typeof import('three'),
  bag: ResourceBag,
  color: number,
  a: V3,
  b: V3,
  opacity = 0.85,
): { m: import('three').Line; set: (p1: V3, p2: V3) => void } {
  const geo = bag.geo(new THREE.BufferGeometry().setFromPoints([a, b]));
  const mat = bag.mat(new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  const m = new THREE.Line(geo, mat);
  const attr = geo.getAttribute('position') as import('three').BufferAttribute;
  return {
    m,
    set(p1: V3, p2: V3) {
      attr.setXYZ(0, p1.x, p1.y, p1.z);
      attr.setXYZ(1, p2.x, p2.y, p2.z);
      attr.needsUpdate = true;
    },
  };
}

/** 第一类贝塞尔 J1（艾里斑/圆盘可见度），A&S 有理近似 */
function besselJ1(x: number): number {
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    const num = x * (72362614232.0 + y * (-7895059235.0 + y * (242396853.1 + y * (-2972611.439 + y * (15704.48260 + y * (-30.16036606))))));
    const den = 144725228442.0 + y * (2300535178.0 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))));
    return num / den;
  }
  return Math.sqrt(0.636619772 / ax) * Math.cos(ax - 2.356194491) * (1 + 0.0785398163 / ax);
}

/** 正弦叠加伪值噪声（CMB 涨落图 / 太阳米粒组织，示意） */
function fbm2(x: number, y: number): number {
  let v = 0, amp = 0.5, fx = 1, fy = 1;
  for (let o = 0; o < 5; o++) {
    v += amp * Math.sin(fx * x * 1.7 + o * 3.1 + Math.cos(fy * y * 2.3 + o * 1.7) * 1.4);
    amp *= 0.55; fx *= 2.1; fy *= 1.9;
  }
  return v;
}

/** P273 微波背景辐射观测：2.725K 黑体谱 + 天球温度涨落图 */
function build_cmb(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title; // 单知识点 variant，无二次分支
  // —— 天球：ΔT/T≈1e-5 温度涨落图（红=偏热，蓝=偏冷，±200μK 示意）——
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 256;
  const cc = cv.getContext('2d')!;
  const img = cc.createImageData(512, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 512; x++) {
      const raw = fbm2(x * 0.045, y * 0.045) + 0.5 * fbm2(x * 0.11 + 40, y * 0.11);
      const v = Math.max(-1, Math.min(1, raw * 0.7));
      const k = Math.abs(v);
      const idx = (y * 512 + x) * 4;
      img.data[idx] = Math.round(v > 0 ? 36 + 195 * k : 30 + 40 * k);
      img.data[idx + 1] = Math.round(38 + 45 * k);
      img.data[idx + 2] = Math.round(v < 0 ? 40 + 200 * k : 44 + 55 * k);
      img.data[idx + 3] = 255;
    }
  }
  cc.putImageData(img, 0, 0);
  cc.fillStyle = 'rgba(248,250,252,0.92)'; cc.font = '22px sans-serif';
  cc.fillText('ΔT/T ≈ 1e-5（±200 μK，示意）', 14, 30);
  const skyTex = bag.tex(new THREE.CanvasTexture(cv));
  skyTex.wrapS = THREE.RepeatWrapping;
  const sky = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(2.9, 48, 32)),
    bag.mat(new THREE.MeshBasicMaterial({ map: skyTex })),
  );
  sky.position.set(-2.6, 1.0, 0);
  g.add(sky);

  // —— 扫描环（卫星巡天大圆，示意）——
  const scanRing = new THREE.Mesh(
    bag.geo(new THREE.RingGeometry(3.0, 3.1, 72)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.35, side: THREE.DoubleSide })),
  );
  scanRing.position.copy(sky.position);
  g.add(scanRing);

  // —— 观测卫星（箱体 + 太阳翼 + 喇叭天线）——
  const sat = new THREE.Group();
  g.add(sat);
  const body = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.5, 0.4, 0.5)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.slate, metalness: 0.6, roughness: 0.4 })),
  );
  sat.add(body);
  for (const s of [1, -1]) {
    const wing = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(1.1, 0.04, 0.42)),
      bag.mat(new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.4, roughness: 0.5 })),
    );
    wing.position.x = s * 0.85;
    sat.add(wing);
  }
  const horn = new THREE.Mesh(
    bag.geo(new THREE.ConeGeometry(0.22, 0.45, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold })),
  );
  horn.position.y = -0.4; horn.rotation.x = Math.PI;
  sat.add(horn);

  // —— 右侧：FIRAS 黑体谱画布（2.725K，实测点偏离 <50ppm）——
  const plot = makePlot(bag, THREE, 360, 300, 4.0, [6.1, 1.1, 0]);
  g.add(plot.m);
  const h0 = 6.626e-34, k0 = 1.381e-23, T0 = 2.725;
  function planck(nuGHz: number): number {
    const nu = nuGHz * 1e9;
    const x = h0 * nu / (k0 * T0);
    return nuGHz * nuGHz * nuGHz / (Math.exp(x) - 1); // ∝ B_ν（同 T 下形状）
  }
  const pk = planck(160.2);
  function drawSpectrum(nuScan: number): void {
    const c = plot.frame(`ν = ${nuScan.toFixed(0)} GHz 扫描`, 'ν (GHz)', 'B_ν (arb)');
    const W = plot.W, H = plot.H;
    c.strokeStyle = '#f59e0b'; c.lineWidth = 4; c.beginPath();
    for (let i = 1; i <= 160; i++) {
      const nu = (i / 160) * 400;
      const py = (H - 44) - (planck(nu) / pk) * (H - 84);
      const px = 46 + (nu / 400) * (W - 62);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    // FIRAS 实测点（几乎完全落在曲线上）
    for (let nu = 30; nu <= 380; nu += 35) {
      const py = (H - 44) - (planck(nu) / pk) * (H - 84);
      const px = 46 + (nu / 400) * (W - 62);
      c.fillStyle = '#f8fafc';
      c.fillRect(px - 2.5, py - 2.5, 5, 5);
    }
    // 维恩峰
    const pxm = 46 + (160.2 / 400) * (W - 62);
    c.strokeStyle = '#f8fafc'; c.setLineDash([5, 5]); c.lineWidth = 2;
    c.beginPath(); c.moveTo(pxm, 18); c.lineTo(pxm, H - 40); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#94a3b8'; c.font = '15px sans-serif';
    c.fillText('ν_max≈160GHz (维恩)', pxm + 5, 44);
    c.fillText('白点=FIRAS实测(偏差<50ppm)', 60, H - 52);
    // 当前扫描指针
    c.fillStyle = '#06b6d4';
    const pys = (H - 44) - (planck(nuScan) / pk) * (H - 84);
    c.beginPath(); c.arc(46 + (nuScan / 400) * (W - 62), pys, 6, 0, 7); c.fill();
    plot.tex.needsUpdate = true;
  }
  drawSpectrum(160);

  g.add(panelSprite(THREE, bag, [
    { text: 'T_CMB = 2.725 K：FIRAS 实测近乎理想黑体（偏离 <50 ppm）', color: '#f8fafc' },
    { text: '谱峰 ν_max ≈ 160 GHz（维恩位移定律）', color: '#94a3b8' },
    { text: '天球温度涨落 ΔT/T ≈ 1e-5：红=偏热 蓝=偏冷（±200μK 示意）', color: '#fbbf24' },
  ], [0, 4.5, 0], 7.8, 'center'));

  let lastB = -1;
  return (t: number, dt: number) => {
    void dt;
    sky.rotation.y = t * 0.05;
    skyTex.offset.x = t * 0.004;
    scanRing.rotation.x = 0.5 + 0.35 * Math.sin(t * 0.13);
    scanRing.rotation.y = t * 0.2;
    sat.position.set(
      sky.position.x + 4.0 * Math.cos(t * 0.3),
      sky.position.y + 0.9 * Math.sin(t * 0.22),
      4.0 * Math.sin(t * 0.3),
    );
    sat.rotation.y = -t * 0.3;
    const b = Math.floor(t * 10);
    if (b !== lastB) {
      lastB = b;
      drawSpectrum(60 + 300 * (0.5 + 0.5 * Math.sin(t * 0.45)));
    }
  };
}

/** P284 日冕观测：挡光盘/遮星盘 + 衍射抑制 + 日冕/日珥对比 */
function build_corona(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title; // 单知识点 variant，无二次分支
  // —— 左侧太阳（光球：比日冕亮 ~10⁶ 倍）——
  const sunPos = new THREE.Vector3(-5.4, 0.9, 0);
  const sun = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(1.35, 32, 24)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffd54a, emissiveIntensity: 1.2 })),
  );
  sun.position.copy(sunPos);
  g.add(sun);
  // 日珥（红粉色弧环，贴日面边缘）
  const prom = new THREE.Mesh(
    bag.geo(new THREE.TorusGeometry(0.42, 0.07, 8, 24, Math.PI)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, emissive: 0xef4444, emissiveIntensity: 0.8 })),
  );
  prom.position.set(sunPos.x + 0.9, sunPos.y - 1.05, 0.2);
  prom.rotation.z = -0.7;
  g.add(prom);

  // —— 日冕仪镜筒：遮星盘(occulter) + 场阑(field stop) ——
  const tube = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.55, 0.55, 4.6, 28, 1, true)),
    bag.mat(new THREE.MeshStandardMaterial({
      color: 0x334155, metalness: 0.5, roughness: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 0.55,
    })),
  );
  tube.rotation.z = Math.PI / 2;
  tube.position.set(0.3, 0.9, 0);
  g.add(tube);
  const occulter = new THREE.Mesh(
    bag.geo(new THREE.CircleGeometry(0.34, 32)),
    bag.mat(new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide })),
  );
  occulter.rotation.y = Math.PI / 2;
  occulter.position.set(-1.1, 0.9, 0);
  g.add(occulter);
  const fieldStop = new THREE.Mesh(
    bag.geo(new THREE.RingGeometry(0.06, 0.5, 32)),
    bag.mat(new THREE.MeshBasicMaterial({ color: 0x0a0f1c, side: THREE.DoubleSide })),
  );
  fieldStop.rotation.y = Math.PI / 2;
  fieldStop.position.set(1.6, 0.9, 0);
  g.add(fieldStop);
  // 掠射光线（太阳→遮星盘边缘，遮挡成功/泄漏的直观演示）
  const rayA = dynLine(THREE, bag, PAL.gold, sunPos, occulter.position.clone(), 0.7);
  const rayB = dynLine(THREE, bag, PAL.gold, sunPos.clone().setY(sunPos.y + 1.35), occulter.position.clone().setY(occulter.position.y + 0.34), 0.7);
  g.add(rayA.m); g.add(rayB.m);

  // —— 探测器画布：日冕仪像（上）vs 直接成像眩光（下）——
  const det = makeCanvasPlane(bag, THREE, 300, 300, 3.1, [6.0, 2.6, 0]);
  g.add(det.m);
  const raw = makeCanvasPlane(bag, THREE, 300, 300, 3.1, [6.0, -1.6, 0]);
  g.add(raw.m);
  function drawDet(off: number, spin: number): void {
    const c = det.c, W = 300, H = 300, cx = 150, cy = 150;
    c.fillStyle = '#050810'; c.fillRect(0, 0, W, H);
    // 日冕：径向亮度 ~ r^-2 快速衰减（同心弧叠加）
    for (let rr = 46; rr < 145; rr += 2) {
      const a = Math.min(0.85, 420 / (rr * rr) * 9);
      c.strokeStyle = `rgba(255,224,150,${a.toFixed(3)})`;
      c.lineWidth = 2;
      c.beginPath(); c.arc(cx, cy, rr + 1.5 * Math.sin(rr * 0.35 + spin), 0, Math.PI * 2); c.stroke();
    }
    // 冕流（旋转的亮带，示意）
    for (let k = 0; k < 3; k++) {
      const a0 = spin * 0.4 + (k / 3) * Math.PI * 2;
      c.strokeStyle = 'rgba(255,240,200,0.28)'; c.lineWidth = 7;
      c.beginPath(); c.moveTo(cx + 50 * Math.cos(a0), cy + 50 * Math.sin(a0));
      c.lineTo(cx + 142 * Math.cos(a0 + 0.12), cy + 142 * Math.sin(a0 + 0.12)); c.stroke();
    }
    // 遮星盘本影（对齐良好→全黑；失准→贝利珠串漏光 + 衍射环）
    c.fillStyle = '#000000';
    c.beginPath(); c.arc(cx, cy - off * 90, 42, 0, Math.PI * 2); c.fill();
    const err = Math.abs(off);
    if (err > 0.28) {
      // 边缘泄漏呈珠串：遮星盘/月缘不是光滑圆，山谷处逐点漏光（=贝利珠）
      const beads = 3;
      for (let j = 0; j < beads; j++) {
        const f = (j - (beads - 1) / 2) * 0.52; // 沿漏光侧边缘展开
        const ang = (off > 0 ? Math.PI / 2 : -Math.PI / 2) + f;
        const bx = cx + 42 * Math.cos(ang) * 0.98;
        const by = cy - off * 90 + 42 * Math.sin(ang) * 0.98;
        const br = 3.4 + 3.6 * err;
        const bg = c.createRadialGradient(bx, by, 0.4, bx, by, br);
        bg.addColorStop(0, `rgba(255,252,235,${Math.min(1, 0.35 + err).toFixed(3)})`);
        bg.addColorStop(1, 'rgba(255,246,200,0)');
        c.fillStyle = bg;
        c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2); c.fill();
      }
      // 珠串间的细缝（弱，表示尚未连成完整月牙）
      c.strokeStyle = `rgba(255,246,200,${(err * 0.35).toFixed(3)})`;
      c.lineWidth = 1.6;
      c.beginPath();
      c.arc(cx, cy - off * 90, 42, off > 0 ? 0.35 : Math.PI + 0.35, off > 0 ? Math.PI - 0.35 : Math.PI * 2 - 0.35);
      c.stroke();
      for (let k = 1; k <= 5; k++) {
        c.strokeStyle = `rgba(226,232,240,${(err * 0.5 / k).toFixed(3)})`;
        c.lineWidth = 2;
        c.beginPath(); c.arc(cx, cy, 30 * k, 0, Math.PI * 2); c.stroke();
      }
    }
    // 暗弱日珥（边缘粉红弧，仅日冕仪可见）
    c.strokeStyle = 'rgba(244,114,182,0.9)'; c.lineWidth = 3;
    c.beginPath(); c.arc(cx - 30, cy + 40, 16, Math.PI * 0.9, Math.PI * 1.9); c.stroke();
    c.fillStyle = '#94a3b8'; c.font = '15px sans-serif';
    c.fillText('日冕仪像：日冕+暗弱日珥', 12, 24);
    c.fillStyle = err > 0.28 ? '#ef4444' : '#22c55e';
    c.fillText(
      err > 0.28 ? '失准：边缘逐点漏光（贝利珠串）+衍射环' : '对齐良好：衍射被场阑抑制',
      12, H - 14,
    );
    det.tex.needsUpdate = true;
  }
  function drawRaw(): void {
    const c = raw.c, W = 300, H = 300, cx = 150, cy = 150;
    c.fillStyle = '#050810'; c.fillRect(0, 0, W, H);
    // 无日冕仪：眩光+衍射环淹没暗日冕
    const gr = c.createRadialGradient(cx, cy, 10, cx, cy, 150);
    gr.addColorStop(0, 'rgba(255,255,235,1)');
    gr.addColorStop(0.25, 'rgba(255,230,150,0.9)');
    gr.addColorStop(0.7, 'rgba(255,220,150,0.18)');
    gr.addColorStop(1, 'rgba(255,220,150,0.02)');
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
    for (let k = 1; k <= 6; k++) {
      c.strokeStyle = `rgba(250,250,250,${0.4 / k})`; c.lineWidth = 3;
      c.beginPath(); c.arc(cx, cy, 20 * k + 12, 0, Math.PI * 2); c.stroke();
    }
    c.fillStyle = '#0f172a'; c.font = '15px sans-serif';
    c.fillText('直接成像：眩光+衍射环，日冕不可见', 12, H - 14);
    raw.tex.needsUpdate = true;
  }
  drawRaw(); drawDet(0, 0);

  g.add(panelSprite(THREE, bag, [
    { text: '遮星盘挡住光球（亮 ~10⁶ 倍）；日冕仅 ~10⁻⁶ B☉', color: '#f8fafc' },
    { text: '衍射抑制：遮星盘+场阑+消杂光阑，边缘掠射光被拦（示意）', color: '#94a3b8' },
    { text: '读数：遮星盘对齐→衍射环消失，暗弱日珥（粉）才可见', color: '#fbbf24' },
    { text: '日食≈天然遮星盘：月缘山地漏光成贝利珠串（失准相位即此形态）', color: '#22c55e' },
  ], [0, 4.6, 0], 7.8, 'center'));

  let lastB = -1;
  return (t: number, dt: number) => {
    void dt;
    // 遮星盘缓慢漂移 → 演示对齐/失准
    const off = Math.sin(t * 0.5);
    occulter.position.y = 0.9 + off * 0.12;
    rayA.set(sunPos, occulter.position.clone());
    rayB.set(sunPos.clone().setY(sunPos.y + 1.35), occulter.position.clone().setY(occulter.position.y + 0.34));
    (prom.material as import('three').MeshStandardMaterial).emissiveIntensity = 0.7 + 0.3 * Math.sin(t * 1.4);
    const b = Math.floor(t * 6);
    if (b !== lastB) { lastB = b; drawDet(off, t); }
  };
}

/** P349 CT 反投影重建 / P360 双能 CT：title.includes('双能') 二次分支 */
function build_ct(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const dual = title.includes('双能');
  // 模体三根插棒（默认：骨/气/软组织；双能：水/骨/碘造影剂）
  const rods = dual ? [
    { x: -0.9, y: 0.5, r: 0.5, mu: 0.55, col: 0x1e3a8a },  // 水（蓝）
    { x: 0.85, y: -0.55, r: 0.4, mu: 1.9, col: 0xca8a04 },  // 骨（黄）
    { x: 0.15, y: 1.0, r: 0.34, mu: 2.4, col: 0xdc2626 },   // 碘（红，K 边见曲线）
  ] : [
    { x: -0.9, y: 0.5, r: 0.5, mu: 1.9, col: 0xe2e8f0 },    // 骨（白）
    { x: 0.85, y: -0.55, r: 0.38, mu: 0.15, col: 0x1d4ed8 }, // 气（深蓝）
    { x: 0.15, y: 1.0, r: 0.45, mu: 1.0, col: PAL.pink },   // 软组织（粉）
  ];
  // —— 旋转机架：源 + 扇形束 + 对面探测器弧 ——
  const gantry = new THREE.Group();
  gantry.position.set(dual ? -2.4 : 0, dual ? 1.0 : 0.9, 0);
  g.add(gantry);
  const ring = new THREE.Mesh(
    bag.geo(new THREE.TorusGeometry(3.3, 0.26, 12, 48)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.4 })),
  );
  gantry.add(ring);
  const srcGeo = bag.geo(new THREE.BoxGeometry(0.55, 0.55, 0.4));
  const source = new THREE.Mesh(srcGeo, bag.mat(new THREE.MeshStandardMaterial({ color: PAL.white, emissive: 0xf8fafc, emissiveIntensity: 0.9 })));
  source.position.set(0, 3.3, 0);
  gantry.add(source);
  let srcHi: import('three').Mesh | null = null;
  let srcLo: import('three').Mesh | null = null;
  if (dual) {
    // 双能：高/低压两个焦点交替出光（分支改变几何）
    source.visible = false;
    srcHi = new THREE.Mesh(srcGeo, bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, emissive: 0xef4444, emissiveIntensity: 1 })));
    srcHi.position.set(-0.35, 3.3, 0);
    srcLo = new THREE.Mesh(srcGeo, bag.mat(new THREE.MeshStandardMaterial({ color: PAL.blue, emissive: 0x3b82f6, emissiveIntensity: 1 })));
    srcLo.position.set(0.35, 3.3, 0);
    gantry.add(srcHi); gantry.add(srcLo);
  }
  const detBar = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(2.6, 0.3, 0.4)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, emissive: 0x0e7490, emissiveIntensity: 0.4 })),
  );
  detBar.position.set(0, -3.35, 0);
  gantry.add(detBar);
  for (const u of [-2, -1, 0, 1, 2]) {
    gantry.add(lineFrom(THREE, bag, [new THREE.Vector3(0, 3.15, 0), new THREE.Vector3(u, -3.15, 0)], dual ? 0xa5b4fc : 0xe2e8f0, true));
  }
  // 模体（静止）：半透明圆柱 + 插棒
  const phantomPos = new THREE.Vector3(gantry.position.x, gantry.position.y, 0);
  const phantom = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(2.4, 2.4, 3.2, 36, 1, true)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x64748b, transparent: true, opacity: 0.16, side: THREE.DoubleSide })),
  );
  phantom.rotation.x = Math.PI / 2;
  phantom.position.copy(phantomPos);
  g.add(phantom);
  for (const rod of rods) {
    const m = new THREE.Mesh(
      bag.geo(new THREE.CylinderGeometry(rod.r, rod.r, 3.3, 20)),
      bag.mat(new THREE.MeshStandardMaterial({ color: rod.col, transparent: true, opacity: 0.85 })),
    );
    m.rotation.x = Math.PI / 2;
    m.position.set(phantomPos.x + rod.x, phantomPos.y + rod.y, 0);
    g.add(m);
  }

  if (!dual) {
    // —— 默认分支：反投影累积画布（沿每条射线方向逐条涂抹）——
    const recon = makeCanvasPlane(bag, THREE, 320, 320, 3.5, [6.1, 1.0, 0]);
    g.add(recon.m);
    const c = recon.c;
    c.fillStyle = 'rgba(7,11,20,0.9)'; c.fillRect(0, 0, 320, 320);
    c.strokeStyle = '#334155'; c.lineWidth = 3; c.strokeRect(2, 2, 316, 316);
    let accPhi = 0;
    let done = false;
    let holdT = 0;
    function strip(phi: number): void {
      const k = 150 / 3.2;
      c.save();
      c.translate(160, 160);
      c.rotate(phi);
      for (let ui = -12; ui <= 12; ui++) {
        const u = ui * 0.26;
        let p = 0;
        for (const rod of rods) {
          const dper = rod.x * -Math.sin(phi) + rod.y * Math.cos(phi) - u;
          const inside = rod.r * rod.r - dper * dper;
          if (inside > 0) p += rod.mu * 2 * Math.sqrt(inside);
        }
        if (p <= 0.001) continue;
        c.strokeStyle = `rgba(226,232,240,${Math.min(0.05, p * 0.0055).toFixed(4)})`;
        c.lineWidth = 5;
        c.beginPath();
        c.moveTo(-k * 3.2, u * k);
        c.lineTo(k * 3.2, u * k);
        c.stroke();
      }
      c.restore();
    }
    function drawTruth(): void {
      const k = 150 / 3.2;
      c.fillStyle = 'rgba(7,11,20,0.9)'; c.fillRect(0, 0, 320, 320);
      c.strokeStyle = '#334155'; c.lineWidth = 3; c.strokeRect(2, 2, 316, 316);
      c.fillStyle = 'rgba(100,116,139,0.45)';
      c.beginPath(); c.arc(160, 160, 2.4 * k, 0, Math.PI * 2); c.fill();
      for (const rod of rods) {
        c.fillStyle = `#${new THREE.Color(rod.col).getHexString()}`;
        c.beginPath(); c.arc(160 + rod.x * k, 160 - rod.y * k, rod.r * k, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = '#22c55e'; c.font = '15px sans-serif';
      c.fillText('重建完成：对比真值模体', 14, 24);
      recon.tex.needsUpdate = true;
    }
    g.add(panelSprite(THREE, bag, [
      { text: 'I = I₀·e^{−∫μdl}：投影 p(φ,r)，反投影=沿射线涂抹累积', color: '#f8fafc' },
      { text: '滤波反投影(FBP)修正 1/|r| 星状伪影；此处为朴素反投影（示意）', color: '#94a3b8' },
      { text: '读数：机架旋转 0→180° 累积重建，末帧与真值模体对照', color: '#fbbf24' },
    ], [0, 4.6, 0], 7.8, 'center'));
    let lastB = -1;
    return (t: number, dt: number) => {
      gantry.rotation.z += dt * 0.6;
      const phi = (t * 0.6) % Math.PI;
      if (!done) {
        while (accPhi < phi) { accPhi += 0.05; strip(accPhi); }
        if (accPhi >= Math.PI - 0.05) { done = true; drawTruth(); }
      } else {
        holdT += dt;
        if (holdT > 4) {
          holdT = 0; done = false; accPhi = 0;
          c.fillStyle = 'rgba(7,11,20,0.9)'; c.fillRect(0, 0, 320, 320);
          c.strokeStyle = '#334155'; c.lineWidth = 3; c.strokeRect(2, 2, 316, 316);
        }
      }
      if (!done) {
        const b = Math.floor(t * 5);
        if (b !== lastB) {
          lastB = b;
          c.fillStyle = 'rgba(7,11,20,0.86)'; c.fillRect(4, 4, 312, 26);
          c.fillStyle = '#94a3b8'; c.font = '15px sans-serif';
          c.fillText(`φ = ${Math.round(phi * 57.3)}° 反投影累积中…`, 12, 22);
          recon.tex.needsUpdate = true;
        }
      }
    };
  }

  // —— 双能分支：μ(E) 曲线 + Z_eff 伪彩分离 + 虚拟单能读数 ——
  const mat = makeCanvasPlane(bag, THREE, 300, 300, 3.0, [5.4, 2.7, 0]);
  g.add(mat.m);
  const curve = makePlot(bag, THREE, 340, 260, 3.4, [5.4, -0.9, 0]);
  g.add(curve.m);
  const muW = (e: number): number => 0.16 * Math.pow(60 / e, 2.6) + 0.2;
  const muB = (e: number): number => 0.95 * Math.pow(60 / e, 2.6) + 0.22;
  const muI = (e: number): number => (e < 33.2 ? 0.5 : 2.1) * Math.pow(60 / e, 2.9) + 0.22; // 碘 K 边 33keV
  function drawMat(eKe: number): void {
    const c = mat.c;
    c.fillStyle = 'rgba(7,11,20,0.9)'; c.fillRect(0, 0, 300, 300);
    c.strokeStyle = '#334155'; c.lineWidth = 3; c.strokeRect(2, 2, 296, 296);
    c.fillStyle = 'rgba(30,58,138,0.55)';
    c.beginPath(); c.arc(150, 150, 112, 0, Math.PI * 2); c.fill();
    // 分解结果伪彩（骨=黄，碘=红）；噪声幅度随能量升高 → 高 keV 分离不确定度大
    const noise = 0.5 + (eKe - 60) / 120;
    c.fillStyle = '#facc15';
    c.beginPath(); c.arc(150 + rods[1].x * 112 / 2.4, 150 - rods[1].y * 112 / 2.4, rods[1].r * 112 / 2.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ef4444';
    c.beginPath(); c.arc(150 + rods[2].x * 112 / 2.4, 150 - rods[2].y * 112 / 2.4, rods[2].r * 112 / 2.4, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.random() * 110;
      c.fillStyle = `rgba(248,250,252,${(Math.random() * 0.06 * noise).toFixed(3)})`;
      c.fillRect(150 + rr * Math.cos(a), 150 + rr * Math.sin(a), 3, 3);
    }
    c.fillStyle = '#f8fafc'; c.font = '15px sans-serif';
    c.fillText('Z_eff 物质分离伪彩', 14, 24);
    c.fillStyle = '#facc15'; c.fillText('骨', 14, 285);
    c.fillStyle = '#ef4444'; c.fillText('碘', 52, 285);
    c.fillStyle = '#60a5fa'; c.fillText('水', 90, 285);
    mat.tex.needsUpdate = true;
  }
  function drawCurve(eKe: number): void {
    const c = curve.frame(`虚拟单能 ${eKe.toFixed(0)} keV`, 'E (keV)', 'μ (cm⁻¹)');
    const W = curve.W, H = curve.H;
    const plotCurve = (fn: (e: number) => number, col: string): void => {
      c.strokeStyle = col; c.lineWidth = 3; c.beginPath();
      for (let i = 1; i <= 120; i++) {
        const e = 20 + (i / 120) * 120;
        const px = 46 + ((e - 20) / 120) * (W - 62);
        const py = (H - 44) - Math.min(1, fn(e) / 2.6) * (H - 84);
        if (i === 1) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
    };
    plotCurve(muB, '#facc15');
    plotCurve(muI, '#ef4444');
    plotCurve(muW, '#60a5fa');
    const px = 46 + ((eKe - 20) / 120) * (W - 62);
    c.strokeStyle = '#f8fafc'; c.setLineDash([5, 4]); c.lineWidth = 2;
    c.beginPath(); c.moveTo(px, 18); c.lineTo(px, H - 40); c.stroke(); c.setLineDash([]);
    const huB = 1000 * (muB(eKe) - muW(eKe)) / (muB(70) - muW(70));
    const huI = 1400 * (muI(eKe) - muW(eKe)) / (muI(70) - muW(70));
    c.fillStyle = '#94a3b8'; c.font = '14px sans-serif';
    c.fillText(`骨 ${huB.toFixed(0)}HU 碘 ${huI.toFixed(0)}HU`, px + 6, 60);
    curve.tex.needsUpdate = true;
  }
  drawMat(80); drawCurve(80);
  g.add(panelSprite(THREE, bag, [
    { text: 'μ_eff(E) = ρ_m·μ_m(E) + ρ_b·μ_b(E)（两基物质分解）', color: '#f8fafc' },
    { text: '光电∝Z³/E³：低能骨/碘对比高；碘 K 边 33keV 处突变', color: '#94a3b8' },
    { text: '读数：虚拟单能 keV 扫描→骨/碘 HU 变化；伪彩=Z_eff 分离（示意）', color: '#fbbf24' },
  ], [0, 4.6, 0], 7.8, 'center'));
  let lastB = -1;
  return (t: number, dt: number) => {
    gantry.rotation.z += dt * 0.5;
    const eKe = 80 + 55 * Math.sin(t * 0.3);
    if (srcHi && srcLo) {
      const hi = Math.sin(t * 2.2) > 0;
      (srcHi.material as import('three').MeshStandardMaterial).emissiveIntensity = hi ? 1.2 : 0.06;
      (srcLo.material as import('three').MeshStandardMaterial).emissiveIntensity = hi ? 0.06 : 1.2;
    }
    const b = Math.floor(t * 4);
    if (b !== lastB) { lastB = b; drawMat(eKe); drawCurve(eKe); }
  };
}
/** P355 多普勒超声 / P356 HIFU / P354 回波成像：title 三分支 */
function build_ultrasound(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const doppler = title.includes('多普勒');
  const hifu = title.includes('聚焦') || title.includes('HIFU');
  // 共有：半透明组织块
  const tissue = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(7.6, 3.9, 3.0)),
    bag.mat(new THREE.MeshStandardMaterial({ color: doppler ? 0x7c2d12 : 0x9d174d, transparent: true, opacity: 0.14 })),
  );
  tissue.position.set(-0.4, 0.4, 0);
  g.add(tissue);

  if (doppler) {
    // —— 血管 + 血流粒子（红蓝编码）+ 斜置探头 + 频谱画布 ——
    const vessel = new THREE.Mesh(
      bag.geo(new THREE.CylinderGeometry(0.5, 0.5, 7.4, 24, 1, true)),
      bag.mat(new THREE.MeshStandardMaterial({ color: 0xb91c1c, transparent: true, opacity: 0.3, side: THREE.DoubleSide })),
    );
    vessel.rotation.z = Math.PI / 2;
    vessel.position.set(-0.4, -0.3, 0);
    g.add(vessel);
    const N = 110;
    const pp = new Float32Array(N * 3);
    const pc = new Float32Array(N * 3);
    const off = new Float32Array(N); // 血管内相对高度 [-0.42,0.42]
    for (let i = 0; i < N; i++) {
      pp[i * 3] = -4 + Math.random() * 7.2;
      off[i] = (Math.random() * 2 - 1) * 0.42;
      pp[i * 3 + 1] = -0.3 + off[i];
      pp[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    const cgeo = bag.geo(new THREE.BufferGeometry());
    cgeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    cgeo.setAttribute('color', new THREE.BufferAttribute(pc, 3));
    g.add(new THREE.Points(cgeo, bag.mat(new THREE.PointsMaterial({ size: 0.12, vertexColors: true, sizeAttenuation: true }))));
    const probe = new THREE.Group();
    const pbody = new THREE.Mesh(
      bag.geo(new THREE.CapsuleGeometry(0.34, 1.3, 6, 14)),
      bag.mat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 })),
    );
    probe.add(pbody);
    const face = new THREE.Mesh(
      bag.geo(new THREE.CylinderGeometry(0.33, 0.33, 0.1, 18)),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, emissive: 0x06b6d4, emissiveIntensity: 0.6 })),
    );
    face.position.y = -1.0;
    probe.add(face);
    g.add(probe);
    const beam = dynLine(THREE, bag, PAL.cyan, new THREE.Vector3(), new THREE.Vector3(), 0.7);
    g.add(beam.m);
    // 取样容积（sample gate）：声束与血管交汇处的金框，只采这一小段的速度
    const gateGeo = bag.geo(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.42, 0.42, 0.9)));
    const gateMat = bag.mat(new THREE.LineBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.9 }));
    const gate = new THREE.LineSegments(gateGeo, gateMat);
    g.add(gate);
    const spec = makePlot(bag, THREE, 340, 280, 3.7, [5.9, 1.2, 0]);
    g.add(spec.m);
    const hist = new Float32Array(140);
    let hi = 0;
    // cosθ 由声束与血流轴（+x，朝向探头为正）的实际夹角算出，不再硬编码 45°
    let cosT = Math.abs(2.0 / Math.hypot(2.0, 2.05, 0.65));
    function drawSpec(): void {
      const c = spec.frame('多普勒频谱', 't', 'f_d (kHz)');
      const W = spec.W, H = spec.H;
      for (let i = 0; i < 140; i++) {
        const v = hist[(hi + i) % 140];
        const fd = 2 * 5e6 * v * cosT / 1540 / 1000; // → kHz（粒子速度 × 一次 cosθ）
        const px = 46 + (i / 140) * (W - 62);
        const mag = Math.min(1, Math.abs(fd) / 5);
        const py = H / 2 - Math.sign(fd) * mag * (H / 2 - 50);
        c.fillStyle = fd > 0 ? 'rgba(239,68,68,0.8)' : 'rgba(59,130,246,0.8)';
        c.fillRect(px, Math.min(py, H / 2), 2, Math.max(2, Math.abs(H / 2 - py)));
      }
      c.strokeStyle = '#475569'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(46, H / 2); c.lineTo(W - 14, H / 2); c.stroke();
      const vpk = hist[(hi + 139) % 140]; // 最近一次采样（带符号：负=舒张期逆流）
      c.fillStyle = '#94a3b8'; c.font = '14px sans-serif';
      c.fillText(`θ = ${(Math.acos(cosT) * 180 / Math.PI).toFixed(0)}° cosθ = ${cosT.toFixed(3)}`, 54, 34);
      c.fillText(`f_d = 2fv·cosθ/c ≈ ${(2 * 5e6 * vpk * cosT / 1540 / 1000).toFixed(1)} kHz`, 54, H - 30);
      c.fillText('上=朝向探头(红) 下=远离(蓝) 金框=取样容积', 54, H - 48);
      spec.tex.needsUpdate = true;
    }
    g.add(panelSprite(THREE, bag, [
      { text: 'f_d = 2·f₀·v·cosθ/c（往返多普勒）；θ→90° 测不到血流', color: '#f8fafc' },
      { text: '彩色编码：朝向探头=红，远离=蓝（BfR）；层流抛物面剖面，舒张期可逆流', color: '#94a3b8' },
      { text: '读数：f₀=5MHz c=1540m/s，θ 由声束几何给出（≈47°）；金框=取样容积', color: '#fbbf24' },
    ], [0, 4.6, 0], 7.8, 'center'));
    let lastB = -1;
    return (t: number, dt: number) => {
      // 搏动血流：舒张早期短暂为负 → 粒子反向 + 频谱蓝移
      const vT = 0.5 * (1.15 * Math.sin(t * 2.4) + 0.25);
      const arr = cgeo.getAttribute('position') as import('three').BufferAttribute;
      const col = cgeo.getAttribute('color') as import('three').BufferAttribute;
      const pa = arr.array as Float32Array;
      const ca = col.array as Float32Array;
      for (let i = 0; i < N; i++) {
        const profile = 1 - (off[i] / 0.42) ** 2; // 抛物面速度剖面
        pa[i * 3] += vT * profile * 1.7 * dt;
        if (pa[i * 3] > 3.3) pa[i * 3] = -4;
        if (pa[i * 3] < -4) pa[i * 3] = 3.3;
        const shift = vT * profile;
        if (shift > 0.03) { ca[i * 3] = 0.92; ca[i * 3 + 1] = 0.25; ca[i * 3 + 2] = 0.25; }
        else if (shift < -0.03) { ca[i * 3] = 0.23; ca[i * 3 + 1] = 0.5; ca[i * 3 + 2] = 0.95; }
        else { ca[i * 3] = 0.45; ca[i * 3 + 1] = 0.5; ca[i * 3 + 2] = 0.55; }
      }
      arr.needsUpdate = true; col.needsUpdate = true;
      // 探头沿血管摆动采样（声束与血流轴夹角由几何给出）
      const sx = 1.7 * Math.sin(t * 0.5);
      probe.position.set(sx + 1.9, 2.3, 0.8);
      probe.lookAt(sx - 0.4, -0.3, 0);
      probe.rotateX(Math.PI / 2);
      const bA = new THREE.Vector3(sx + 1.6, 1.75, 0.65);
      const bB = new THREE.Vector3(sx - 0.4, -0.3, 0);
      beam.set(bA, bB);
      const bdir = bB.clone().sub(bA).normalize();
      cosT = Math.abs(bdir.x); // 血流沿 ±x：声束与血流轴夹角的余弦，与画面同源
      gate.position.copy(bB);
      gate.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), bdir);
      hist[hi] = vT; hi = (hi + 1) % 140;
      const b = Math.floor(t * 8);
      if (b !== lastB) { lastB = b; drawSpec(); }
    };
  }

  if (hifu) {
    // —— 曲面阵列换能器 + 汇聚波前 + 焦点热斑 + 温升剂量曲线 ——
    const F = new THREE.Vector3(0.4, 0.2, 0);
    const els: import('three').Mesh[] = [];
    for (let i = 0; i < 9; i++) {
      const a = Math.PI - (i - 4) * 0.24; // 左侧凹弧阵列（几何聚焦）
      const e = new THREE.Mesh(
        bag.geo(new THREE.BoxGeometry(0.42, 0.42, 1.1)),
        bag.mat(new THREE.MeshStandardMaterial({ color: PAL.amber, emissive: 0xf59e0b, emissiveIntensity: 0.3 })),
      );
      e.position.set(F.x + 3.5 * Math.cos(a), F.y + 3.5 * Math.sin(a), 0);
      e.lookAt(F);
      g.add(e);
      els.push(e);
    }
    const fronts: import('three').Mesh[] = [];
    for (let k = 0; k < 4; k++) {
      const fr = new THREE.Mesh(
        bag.geo(new THREE.RingGeometry(0.96, 1.0, 40, 1, Math.PI * 1.15, Math.PI * 0.7)),
        bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.4, side: THREE.DoubleSide })),
      );
      fr.position.copy(F);
      g.add(fr);
      fronts.push(fr);
    }
    const spot = new THREE.Mesh(
      bag.geo(new THREE.SphereGeometry(0.16, 16, 12)),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, emissive: 0xef4444, emissiveIntensity: 1 })),
    );
    spot.position.copy(F);
    g.add(spot);
    const heat = makeCanvasPlane(bag, THREE, 160, 160, 1.9, [-4.4, 2.6, 1.2]);
    g.add(heat.m);
    function drawHeat(T: number): void {
      const c = heat.c;
      c.clearRect(0, 0, 160, 160);
      const u = Math.max(0, Math.min(1, (T - 37) / 50));
      const gr = c.createRadialGradient(80, 80, 2, 80, 80, 78);
      gr.addColorStop(0, `rgba(${Math.round(200 + 55 * u)},${Math.round(140 - 110 * u)},30,${(0.25 + 0.7 * u).toFixed(2)})`);
      gr.addColorStop(0.5, `rgba(239,68,68,${(0.25 * u).toFixed(2)})`);
      gr.addColorStop(1, 'rgba(59,130,246,0)');
      c.fillStyle = gr; c.fillRect(0, 0, 160, 160);
      c.fillStyle = '#f8fafc'; c.font = '16px sans-serif'; c.textAlign = 'center';
      c.fillText(`焦点 ${T.toFixed(0)}°C`, 80, 20);
      heat.tex.needsUpdate = true;
    }
    drawHeat(37);
    const tp = makePlot(bag, THREE, 330, 260, 3.6, [5.9, 1.3, 0]);
    g.add(tp.m);
    const thist = new Float32Array(150);
    let ti2 = 0;
    function drawT(): void {
      const c = tp.frame(`焦点 T=${Temp.toFixed(0)}°C ${sonOn ? '辐照中' : '间歇'}`, 't', 'T (°C)');
      const W = tp.W, H = tp.H;
      const yT = (H - 44) - (65 - 30) / 60 * (H - 84);
      c.strokeStyle = '#22c55e'; c.setLineDash([5, 4]); c.lineWidth = 2;
      c.beginPath(); c.moveTo(46, yT); c.lineTo(W - 14, yT); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#22c55e'; c.font = '14px sans-serif';
      c.fillText('65°C 凝固性坏死阈值', 54, yT - 8);
      c.strokeStyle = '#f59e0b'; c.lineWidth = 3; c.beginPath();
      for (let i = 0; i < 150; i++) {
        const T = thist[(ti2 + i) % 150];
        const px = 46 + (i / 150) * (W - 62);
        const py = (H - 44) - (T - 30) / 60 * (H - 84);
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
      tp.tex.needsUpdate = true;
    }
    g.add(panelSprite(THREE, bag, [
      { text: '几何聚焦/相位阵：体外超声汇聚焦点，声强 ∝ N²（叠加）', color: '#f8fafc' },
      { text: '焦点 65–85°C 持续数秒 → 凝固性坏死；声路径剂量低不损伤', color: '#94a3b8' },
      { text: '读数：声辐照占空比通断，温升曲线对照 65°C 阈值（示意）', color: '#fbbf24' },
    ], [0, 4.6, 0], 7.8, 'center'));
    let Temp = 37;
    let sonOn = true;
    let lastB = -1;
    return (t: number, dt: number) => {
      sonOn = Math.sin(t * 0.28) > 0;
      Temp += ((sonOn ? 82 : 37) - Temp) * dt * (sonOn ? 0.32 : 0.08);
      thist[ti2] = Temp; ti2 = (ti2 + 1) % 150;
      (spot.material as import('three').MeshStandardMaterial).emissiveIntensity = 0.4 + Math.max(0, (Temp - 42) / 30) * 1.6;
      spot.scale.setScalar(1 + Math.max(0, (Temp - 50) / 60) * 1.6);
      els.forEach((e, i) => {
        (e.material as import('three').MeshStandardMaterial).emissiveIntensity = sonOn ? 0.5 + 0.5 * Math.sin(t * 6 + i) : 0.05;
      });
      fronts.forEach((fr, k) => {
        const u = ((t * 0.45 + k * 0.25) % 1);
        fr.scale.setScalar(Math.max(0.05, 3.5 * (1 - u)));
        (fr.material as import('three').MeshBasicMaterial).opacity = 0.42 * u * (sonOn ? 1 : 0.15);
      });
      const b = Math.floor(t * 6);
      if (b !== lastB) { lastB = b; drawHeat(Temp); drawT(); }
    };
  }

  // —— 默认：回波成像（压电探头脉冲 + 声阻抗界面回波 + A 型时延）——
  const layers = [
    { y: 1.8, h: 0.95, col: 0xfbbf24 },  // 脂肪 Z≈0.9
    { y: 0.55, h: 1.2, col: 0xdc2626 },  // 肌肉 Z≈1.7
    { y: -1.2, h: 1.0, col: 0x475569 },  // 骨   Z≈3.5
  ];
  for (const L of layers) {
    const m = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(7.2, L.h, 2.8)),
      bag.mat(new THREE.MeshStandardMaterial({ color: L.col, transparent: true, opacity: 0.24 })),
    );
    m.position.set(-0.4, L.y, 0);
    g.add(m);
  }
  const iface = [2.28, -0.05, -1.7]; // 三个界面深度（世界 y）
  const probeY = 2.9;
  const probe2 = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(1.4, 0.5, 1.0)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x1e293b })),
  );
  probe2.position.set(-0.4, probeY + 0.35, 0);
  g.add(probe2);
  const piezo = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.5, 0.5, 0.14, 20)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.green, emissive: 0x22c55e, emissiveIntensity: 0.6 })),
  );
  piezo.position.set(-0.4, probeY, 0);
  g.add(piezo);
  const pktGeo = bag.geo(new THREE.CylinderGeometry(0.62, 0.62, 0.12, 22));
  const pkt = [0, 1, 2, 3].map(() => {
    const m = new THREE.Mesh(pktGeo, bag.mat(new THREE.MeshBasicMaterial({ color: PAL.green, transparent: true, opacity: 0.55 })));
    g.add(m);
    return m;
  });
  const amps = [1.0, 0.1, 0.12, 0.3]; // 发射脉冲 + 各界面回波幅度（R=((Z₂−Z₁)/(Z₂+Z₁))²）
  const amode = makePlot(bag, THREE, 330, 260, 3.6, [5.9, 1.3, 0]);
  g.add(amode.m);
  function drawA(u: number): void {
    const c = amode.frame(`d = c·t/2 ≈ ${(u * 55).toFixed(0)} mm`, '深度（时延）', '幅度');
    const W = amode.W, H = amode.H;
    c.strokeStyle = '#22c55e'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 150; i++) {
      const x = i / 150; // 归一化深度
      let a = 0;
      for (let k = 0; k < 4; k++) {
        const xd = k === 0 ? 0.03 : (probeY - iface[k - 1]) / 5.6 * 0.5 + 0.03;
        a += amps[k] * Math.exp(-((x - xd) ** 2) / 0.0015);
      }
      const px = 46 + x * (W - 62);
      const py = (H - 44) - Math.min(1, a) * (H - 84);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    const cx2 = 46 + u * 0.7 * (W - 62);
    c.strokeStyle = '#f8fafc'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(cx2, 18); c.lineTo(cx2, H - 40); c.stroke();
    c.fillStyle = '#94a3b8'; c.font = '14px sans-serif';
    c.fillText('脂肪/肌肉弱界面 骨强界面+声影', 60, H - 30);
    amode.tex.needsUpdate = true;
  }
  drawA(0);
  g.add(panelSprite(THREE, bag, [
    { text: 'Z = ρ·v（声阻抗 MRayl）；R = ((Z₂−Z₁)/(Z₂+Z₁))² 界面部分反射', color: '#f8fafc' },
    { text: 'A 型显示：回波幅度 vs 时延，深度 d = c·t/2（c=1540 m/s）', color: '#94a3b8' },
    { text: '压电晶体电↔声互换；骨表面强回声、后方衰减声影（示意）', color: '#fbbf24' },
  ], [0, 4.6, 0], 7.8, 'center'));
  let lastB = -1;
  return (t: number, dt: number) => {
    void dt;
    const T0 = 1.8;
    const u = (t / T0) % 1;
    const depth = probeY + 2.7; // 传播总深度
    (piezo.material as import('three').MeshStandardMaterial).emissiveIntensity = u < 0.05 ? 1.4 : 0.4;
    // 主脉冲下行；各界面部分反射 → 等速上行回波包
    pkt[0].visible = u < 0.58;
    pkt[0].position.set(-0.4, probeY - (u / 0.55) * depth, 0);
    for (let k = 1; k <= 3; k++) {
      const dInt = probeY - iface[k - 1];
      const uOn = 0.55 * dInt / depth;   // 到达界面时刻
      const dur = uOn;                   // 等速返回耗时
      const vis = u > uOn && u < uOn + dur + 0.02;
      pkt[k].visible = vis;
      if (vis) {
        const up = Math.min(1, (u - uOn) / dur);
        pkt[k].position.set(-0.4, iface[k - 1] + up * dInt, 0);
        (pkt[k].material as import('three').MeshBasicMaterial).opacity = 0.15 + amps[k] * 0.9;
        pkt[k].scale.setScalar(0.6 + amps[k] * 1.8);
      }
    }
    const b = Math.floor(t * 10);
    if (b !== lastB) { lastB = b; drawA(u); }
  };
}
/** P235 激光干涉引力波探测器 / P275 首次引力波观测：title 二次分支 */
function build_gwdetector(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const obs = title.includes('首次') || title.includes('观测') || title.includes('150914');

  if (!obs) {
    // —— 默认：L 形双臂 + FP 折叠腔 + 悬挂隔振 + 暗端口读数 ——
    const baseY = 0.9;
    const bs = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(0.45, 0.45, 0.45)),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, transparent: true, opacity: 0.55 })),
    );
    bs.position.set(0, baseY, 0);
    g.add(bs);
    const armGeoX = bag.geo(new THREE.CylinderGeometry(0.2, 0.2, 5.2, 18, 1, true));
    const armGeoZ = bag.geo(new THREE.CylinderGeometry(0.2, 0.2, 5.2, 18, 1, true));
    const armMat = bag.mat(new THREE.MeshStandardMaterial({
      color: 0x64748b, metalness: 0.4, roughness: 0.4, transparent: true, opacity: 0.4, side: THREE.DoubleSide,
    }));
    const armX = new THREE.Mesh(armGeoX, armMat);
    armX.rotation.z = Math.PI / 2;
    armX.position.set(2.7, baseY, 0);
    g.add(armX);
    const armZ = new THREE.Mesh(armGeoZ, armMat);
    armZ.rotation.x = Math.PI / 2;
    armZ.position.set(0, baseY, 2.7);
    g.add(armZ);
    const endGeo = bag.geo(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 26));
    const mkMass = (col: number): import('three').Mesh => new THREE.Mesh(
      endGeo, bag.mat(new THREE.MeshStandardMaterial({ color: col, metalness: 0.7, roughness: 0.3 })),
    );
    const mx = mkMass(PAL.slate);
    mx.rotation.z = Math.PI / 2;
    mx.position.set(5.4, baseY, 0);
    g.add(mx);
    const mz = mkMass(PAL.slate);
    mz.rotation.x = Math.PI / 2;
    mz.position.set(0, baseY, 5.4);
    g.add(mz);
    // Fabry–Pérot 输入镜（折叠腔，紫色小镜）
    const imGeo = bag.geo(new THREE.CylinderGeometry(0.3, 0.3, 0.16, 20));
    const imMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.violet, emissive: 0x7c3aed, emissiveIntensity: 0.4 }));
    const imX = new THREE.Mesh(imGeo, imMat);
    imX.rotation.z = Math.PI / 2; imX.position.set(1.0, baseY, 0);
    const imZ = new THREE.Mesh(imGeo, imMat);
    imZ.rotation.x = Math.PI / 2; imZ.position.set(0, baseY, 1.0);
    g.add(imX); g.add(imZ);
    // 悬挂四联摆（隔振示意：吊点 + 悬线）
    for (const m2 of [mx, mz]) {
      const top = new THREE.Mesh(
        bag.geo(new THREE.BoxGeometry(0.8, 0.5, 0.8)),
        bag.mat(new THREE.MeshStandardMaterial({ color: 0x334155 })),
      );
      top.position.set(m2.position.x, 3.6, m2.position.z);
      g.add(top);
      for (const dx of [-0.25, 0.25]) {
        g.add(lineFrom(THREE, bag, [
          new THREE.Vector3(m2.position.x + dx, 3.35, m2.position.z),
          new THREE.Vector3(m2.position.x + dx * 0.4, baseY + 0.3, m2.position.z),
        ], PAL.slate));
      }
    }
    // 激光器 + 输出端口
    const laser = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(1.0, 0.3, 0.3)),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, emissive: 0xef4444, emissiveIntensity: 0.7 })),
    );
    laser.position.set(-2.2, baseY, -2.2);
    laser.lookAt(bs.position);
    g.add(laser);
    g.add(lineFrom(THREE, bag, [new THREE.Vector3(-1.7, baseY, -1.7), bs.position], PAL.red, true));
    const pd = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(0.4, 0.4, 0.4)),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.green, emissive: 0x16a34a, emissiveIntensity: 0.5 })),
    );
    pd.position.set(1.8, baseY, 1.8);
    g.add(pd);
    g.add(lineFrom(THREE, bag, [bs.position.clone(), new THREE.Vector3(1.6, baseY, 1.6)], PAL.white, true));
    // 臂内光子点（示意光来回）
    const phGeo = bag.geo(new THREE.SphereGeometry(0.09, 10, 8));
    const phMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.red }));
    const phX = new THREE.Mesh(phGeo, phMat); g.add(phX);
    const phZ = new THREE.Mesh(phGeo, phMat); g.add(phZ);
    // 引力波源（双黑洞并合，天空一处）+ 掠过的波前环
    const gwC = new THREE.Vector3(-2.2, 4.6, 1.5);
    const bh1 = new THREE.Mesh(bag.geo(new THREE.SphereGeometry(0.28, 16, 12)), bag.mat(new THREE.MeshBasicMaterial({ color: 0x000000 })));
    const bh2 = new THREE.Mesh(bag.geo(new THREE.SphereGeometry(0.22, 14, 10)), bag.mat(new THREE.MeshBasicMaterial({ color: 0x000000 })));
    bh1.position.copy(gwC); bh2.position.copy(gwC);
    g.add(bh1); g.add(bh2);
    const wave = new THREE.Mesh(
      bag.geo(new THREE.RingGeometry(0.9, 1.0, 48)),
      bag.mat(new THREE.MeshBasicMaterial({ color: PAL.violet, transparent: true, opacity: 0.5, side: THREE.DoubleSide })),
    );
    wave.position.copy(gwC);
    g.add(wave);
    // 暗端口输出示波画布
    const out = makePlot(bag, THREE, 330, 240, 3.5, [6.0, 1.4, 0]);
    g.add(out.m);
    const ohist = new Float32Array(150);
    let oi = 0;
    function drawOut(): void {
      const c = out.frame('暗端口输出 P(t)', 't', 'P');
      const W = out.W, H = out.H;
      c.strokeStyle = '#22c55e'; c.lineWidth = 3; c.beginPath();
      for (let i = 0; i < 150; i++) {
        const v = ohist[(oi + i) % 150];
        const px = 46 + (i / 150) * (W - 62);
        const py = (H - 44) - (H - 84) * (0.08 + v * 0.86);
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
      c.fillStyle = '#94a3b8'; c.font = '14px sans-serif';
      c.fillText('ΔL/L = h ~ 1e-21（视觉放大）', 60, H - 30);
      out.tex.needsUpdate = true;
    }
    g.add(panelSprite(THREE, bag, [
      { text: 'h = ΔL/L ~ 1e-21：4 km 臂 → ΔL ~ 4×10⁻¹⁸ m（放大示意）', color: '#f8fafc' },
      { text: 'Fabry–Pérot 折叠腔增程 ~×280；四联摆悬挂隔振', color: '#94a3b8' },
      { text: '读数：波前掠过时臂长反向伸缩，暗端口功率爆发', color: '#fbbf24' },
    ], [0, 4.6, 0], 7.8, 'center'));
    const mx0 = mx.position.clone(); const mz0 = mz.position.clone();
    let lastB = -1;
    return (t: number, dt: number) => {
      // GW 波包以 ~7s 周期掠过装置
      const u = (t * 0.14) % 1;
      const env = Math.max(0, Math.sin(Math.PI * u)) ** 6;
      const h = env * 0.9 * Math.sin(t * 7);
      mx.position.x = mx0.x + 0.16 * h;
      mz.position.z = mz0.z - 0.16 * h;
      wave.scale.setScalar(0.5 + u * 6.5);
      wave.rotation.x = 0.4; wave.rotation.y = t * 0.3;
      (wave.material as import('three').MeshBasicMaterial).opacity = 0.55 * Math.max(0, 1 - u * 1.3);
      const a = t * 2.6;
      bh1.position.set(gwC.x + 0.5 * Math.cos(a), gwC.y, gwC.z + 0.5 * Math.sin(a));
      bh2.position.set(gwC.x - 0.5 * Math.cos(a), gwC.y, gwC.z - 0.5 * Math.sin(a));
      const fx = (t * 1.8) % 1;
      phX.position.set(fx < 0.5 ? -0.2 + fx * 2 * 5.6 : 5.4 - (fx - 0.5) * 2 * 5.6, baseY, 0);
      phZ.position.set(0, baseY, fx < 0.5 ? -0.2 + fx * 2 * 5.6 : 5.4 - (fx - 0.5) * 2 * 5.6);
      const phi = 6 * t + 9 * h;
      ohist[oi] = 0.5 * (1 + Math.cos(phi)) * (0.25 + 0.75 * (0.2 + env));
      oi = (oi + 1) % 150;
      const b = Math.floor(t * 10);
      if (b !== lastB) { lastB = b; drawOut(); }
    };
  }

  // —— '首次'分支：旋进-合并-铃欠 h(t) chirp + 匹配滤波 SNR + 双黑洞动画 ——
  const piv = new THREE.Vector3(-3.4, 1.0, 0);
  const b1 = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.55, 24, 18)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x020617, emissive: 0x0891b2, emissiveIntensity: 0.5 })),
  );
  const b2 = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.42, 20, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x020617, emissive: 0xbe185d, emissiveIntensity: 0.5 })),
  );
  g.add(b1); g.add(b2);
  const merged = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.8, 26, 20)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x020617, emissive: 0x8b5cf6, emissiveIntensity: 0.6 })),
  );
  merged.position.copy(piv);
  merged.visible = false;
  g.add(merged);
  const rd = new THREE.Mesh(
    bag.geo(new THREE.RingGeometry(1.0, 1.12, 40)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.violet, transparent: true, opacity: 0.5, side: THREE.DoubleSide })),
  );
  rd.position.copy(piv);
  rd.visible = false;
  g.add(rd);
  const chirp = makePlot(bag, THREE, 420, 300, 4.6, [4.8, 0.9, 0]);
  g.add(chirp.m);
  function hAt(u: number): number {
    if (u < 0.9) {
      const ph = 2 * Math.PI * (5 * u + 22 * u * u * u);
      return (0.1 + 0.9 * Math.pow(u, 1.2)) * Math.sin(ph);
    }
    const td = u - 0.9;
    return 0.95 * Math.exp(-td * 22) * Math.cos(td * 120); // 铃欠阻尼振荡
  }
  function drawChirp(uNow: number): void {
    const c = chirp.frame(`匹配滤波 SNR ≈ ${(24 * Math.sqrt(Math.max(0.02, uNow / 0.92))).toFixed(1)}`, 't (s)', 'h (×10⁻²¹)');
    const W = chirp.W, H = chirp.H;
    const trace = (fn: (u: number) => number, col: string, wid: number, du: number): void => {
      c.strokeStyle = col; c.lineWidth = wid; c.beginPath();
      for (let i = 0; i <= 200; i++) {
        const u = Math.min(1, i / 200 + du);
        const px = 46 + (i / 200) * (W - 62);
        const py = H / 2 - fn(u) * (H / 2 - 52);
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
    };
    trace(hAt, '#06b6d4', 3, 0);                 // H1
    trace((u) => hAt(Math.max(0, u - 0.03)), '#ef4444', 2, 0); // L1（延迟 ~7ms 示意）
    c.strokeStyle = 'rgba(248,250,252,0.5)'; c.lineWidth = 1.5; c.setLineDash([6, 4]);
    c.beginPath();
    for (let i = 0; i <= 200; i++) {
      const u = i / 200;
      const px = 46 + (u) * (W - 62);
      const py = H / 2 - hAt(u) * (H / 2 - 52) * 0.98;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke(); c.setLineDash([]);
    const px = 46 + uNow * (W - 62);
    c.strokeStyle = '#f8fafc'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(px, 18); c.lineTo(px, H - 40); c.stroke();
    c.fillStyle = '#94a3b8'; c.font = '13px sans-serif';
    c.fillText('青=Hanford 红=Livingston 白虚线=模板', 54, 36);
    if (uNow > 0.9) c.fillText('合并→铃欠', Math.min(px + 6, W - 90), 60);
    chirp.tex.needsUpdate = true;
  }
  drawChirp(0);
  g.add(panelSprite(THREE, bag, [
    { text: 'GW150914：36+29 M☉ 并合，f 35→250 Hz，峰值 h≈1e-21', color: '#f8fafc' },
    { text: '匹配滤波：波形与模板相关 → SNR≈24；双台符合时延 ~7 ms', color: '#94a3b8' },
    { text: '读数：旋进—合并—铃欠 h(t)，白线=叠加模板（示意放大）', color: '#fbbf24' },
  ], [0, 4.6, 0], 7.8, 'center'));
  let lastB = -1;
  return (t: number, dt: number) => {
    void dt;
    const u = (t * 0.1) % 1;
    const sep = 2.6 * Math.pow(1 - Math.min(1, u / 0.9), 0.6) + 0.12;
    const om = 1.5 + 14 * Math.pow(Math.min(1, u / 0.9), 2.5);
    const a = t * om;
    const mergedNow = u >= 0.9;
    b1.visible = !mergedNow; b2.visible = !mergedNow;
    merged.visible = mergedNow; rd.visible = mergedNow;
    if (!mergedNow) {
      b1.position.set(piv.x + sep * Math.cos(a), piv.y + sep * 0.25 * Math.sin(a), sep * Math.sin(a));
      b2.position.set(piv.x - sep * Math.cos(a), piv.y - sep * 0.25 * Math.sin(a), -sep * Math.sin(a));
    } else {
      (merged.material as import('three').MeshStandardMaterial).emissiveIntensity = 0.6 + 0.6 * Math.exp(-(u - 0.9) * 14);
      rd.scale.setScalar(0.4 + (u - 0.9) * 10);
      (rd.material as import('three').MeshBasicMaterial).opacity = 0.6 * Math.max(0, 1 - (u - 0.9) * 6);
    }
    const b = Math.floor(t * 8);
    if (b !== lastB) { lastB = b; drawChirp(u); }
  };
}

/** P266 干涉阵与综合孔径：多天线基线 + uv 覆盖 + 可见度函数 */
function build_array(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title; // 单知识点 variant，无二次分支
  const srcPos = new THREE.Vector3(4.0, 6.2, -4.5);
  const src = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.3, 16, 12)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: 0xfbbf24, emissiveIntensity: 1 })),
  );
  src.position.copy(srcPos);
  g.add(src);
  // 七台抛物面天线（帽形碗 + 馈源），沿 E–W 基线排布
  const dishPos = [
    new THREE.Vector3(-6.2, -0.3, 0.4), new THREE.Vector3(-4.2, -0.3, -0.5),
    new THREE.Vector3(-2.1, -0.3, 0.6), new THREE.Vector3(0.0, -0.3, -0.4),
    new THREE.Vector3(2.0, -0.3, 0.5), new THREE.Vector3(4.1, -0.3, -0.6),
    new THREE.Vector3(6.2, -0.3, 0.3),
  ];
  const dishes: { grp: import('three').Group; bowl: import('three').Mesh; feed: import('three').Mesh }[] = [];
  const bowlGeo = bag.geo(new THREE.SphereGeometry(0.95, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.42));
  const bowlMat = bag.mat(new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.4, roughness: 0.5, side: THREE.DoubleSide }));
  const mastGeo = bag.geo(new THREE.CylinderGeometry(0.08, 0.12, 1.5, 10));
  const mastMat = bag.mat(new THREE.MeshStandardMaterial({ color: 0x475569 }));
  const feedGeo = bag.geo(new THREE.SphereGeometry(0.12, 10, 8));
  const feedMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan }));
  for (const p of dishPos) {
    const grp = new THREE.Group();
    grp.position.copy(p);
    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.y = 0.9;
    grp.add(mast);
    const bowl = new THREE.Mesh(bowlGeo, bowlMat);
    bowl.position.y = 1.7;
    grp.add(bowl);
    const feed = new THREE.Mesh(feedGeo, feedMat);
    grp.add(feed);
    g.add(grp);
    dishes.push({ grp, bowl, feed });
  }
  // 长基线（虚线连接成对天线）
  const pairs = [[0, 6], [1, 5], [2, 4]];
  const bcols = [PAL.red, PAL.green, PAL.blue];
  for (let k = 0; k < pairs.length; k++) {
    const [i, j] = pairs[k];
    g.add(lineFrom(THREE, bag, [
      dishPos[i].clone().setY(0.1), dishPos[j].clone().setY(0.1),
    ], bcols[k], true));
  }
  // 信号流线（源→每台天线，点线示意）
  for (const d of dishes) {
    g.add(lineFrom(THREE, bag, [srcPos, d.bowl.position.clone().add(d.grp.position)], 0x64748b, true));
  }
  // uv 覆盖画布（地球自转合成：基线端点在 uv 面画椭圆）
  const uv = makeCanvasPlane(bag, THREE, 300, 300, 3.2, [5.7, 2.9, 0]);
  g.add(uv.m);
  // 可见度函数画布：V(b)=|2J1(πbθ/λ)/(πbθ/λ)|（uniform 圆盘源）
  const vis = makePlot(bag, THREE, 340, 260, 3.6, [5.7, -1.2, 0]);
  g.add(vis.m);
  // 合成图像画布：对已填 uv 点做反离散傅里叶（IDA 脏图）
  const img = makeCanvasPlane(bag, THREE, 160, 160, 2.3, [-5.6, -1.9, 0]);
  g.add(img.m);
  // 尺度约定（三块画布同源）：LAM = 场景单位/λ；uv 图 1.4 px/λ；图像半视场 FOV
  const LAM = 0.2;
  const UV_PX = 1.4;
  const FOV = 0.1;
  const BL = pairs.map(([i, j]) => dishPos[j].distanceTo(dishPos[i]) / LAM); // 三条长基线 (λ)
  const B_AX = Math.ceil(Math.max(...BL) / 4) * 4;
  // 源赤纬决定 uv 椭圆短长比：E–W 基线 u=b·cosH, v=b·sinH·sinδ → 比 = |sinδ|（不再硬编码）
  const srcDir = srcPos.clone().normalize();
  const uvAx = Math.abs(srcDir.y);
  const BCOL = ['#ef4444', '#22c55e', '#3b82f6'];
  const MAXS = 96;
  const uS: number[] = [];
  const vS: number[] = [];
  const lastEa = [-99, -99, -99];
  const dotV = (b: number, thetaS: number): number => {
    const x = Math.PI * b * thetaS;
    return x < 1e-4 ? 1 : Math.abs(2 * besselJ1(x) / x);
  };
  function drawUv(t: number): void {
    const c = uv.c;
    c.fillStyle = 'rgba(7,11,20,0.88)'; c.fillRect(0, 0, 300, 300);
    c.strokeStyle = '#334155'; c.lineWidth = 3; c.strokeRect(2, 2, 296, 296);
    c.strokeStyle = '#475569'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(150, 12); c.lineTo(150, 288); c.moveTo(12, 150); c.lineTo(288, 150); c.stroke();
    for (let k = 0; k < 3; k++) {
      const a = BL[k] * UV_PX; // 长半轴 = 基线长（与天线几何同源）
      c.strokeStyle = BCOL[k];
      c.globalAlpha = 0.45; c.lineWidth = 1.6;
      c.beginPath(); c.ellipse(150, 150, a, a * uvAx, 0, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 1;
      const ea = t * 0.22 + k * 0.7;
      const uu = BL[k] * Math.cos(ea);
      const vv = BL[k] * Math.sin(ea) * uvAx;
      if (ea - lastEa[k] > 0.2) { // 累积 uv 采样供成图（FIFO）
        lastEa[k] = ea;
        uS.push(uu); vS.push(vv);
        if (uS.length > MAXS) { uS.shift(); vS.shift(); }
      }
      c.fillStyle = BCOL[k];
      c.beginPath(); c.arc(150 + uu * UV_PX, 150 + vv * UV_PX, 5, 0, 7); c.fill();
    }
    c.fillStyle = '#94a3b8'; c.font = '15px sans-serif';
    c.fillText('uv 覆盖（地球自转合成）', 16, 24);
    c.fillStyle = '#fbbf24'; c.font = '13px sans-serif';
    c.fillText(`δ = ${(Math.asin(uvAx) * 180 / Math.PI).toFixed(0)}° → 短长比 |sinδ| = ${uvAx.toFixed(2)}`, 16, 288);
    c.fillText(`uv 点 ${uS.length}`, 232, 24);
    uv.tex.needsUpdate = true;
  }
  function drawImg(thetaS: number): void {
    const c = img.c, W = 160, H = 160, step = 2, W2 = W / step;
    const n = uS.length;
    const amp = new Float32Array(n);
    for (let s = 0; s < n; s++) {
      const x = Math.PI * Math.hypot(uS[s], vS[s]) * thetaS; // 有符号可见度（圆盘源）
      amp[s] = x < 1e-4 ? 1 : 2 * besselJ1(x) / x;
    }
    // 反离散傅里叶（IDA）：cos(2π(ul+vm)) 拆成 u、v 两向查表，代价 ~n 次乘加/像素
    const A = new Float32Array(n * W2); const B = new Float32Array(n * W2);
    const C = new Float32Array(n * W2); const D = new Float32Array(n * W2);
    for (let j = 0; j < W2; j++) {
      const lAng = ((j * step + step / 2 - W / 2) / (W / 2)) * FOV;
      const mAng = ((j * step + step / 2 - H / 2) / (H / 2)) * FOV;
      for (let s = 0; s < n; s++) {
        const o = s * W2;
        A[o + j] = amp[s] * Math.cos(2 * Math.PI * uS[s] * lAng);
        B[o + j] = amp[s] * Math.sin(2 * Math.PI * uS[s] * lAng);
        C[o + j] = Math.cos(2 * Math.PI * vS[s] * mAng);
        D[o + j] = Math.sin(2 * Math.PI * vS[s] * mAng);
      }
    }
    const buf = new Float32Array(W2 * W2);
    let vmin = Infinity; let vmax = -Infinity; let qi = 0;
    for (let iy = 0; iy < W2; iy++) {
      for (let ix = 0; ix < W2; ix++) {
        let acc = 0;
        for (let s = 0; s < n; s++) {
          const o = s * W2;
          acc += A[o + ix] * C[o + iy] - B[o + ix] * D[o + iy];
        }
        buf[qi++] = acc;
        if (acc < vmin) vmin = acc;
        if (acc > vmax) vmax = acc;
      }
    }
    const im = c.createImageData(W, H);
    const rng = Math.max(1e-6, vmax - vmin);
    qi = 0;
    for (let py = 0; py < H; py += step) {
      for (let px = 0; px < W; px += step) {
        const g = Math.round(255 * Math.pow(Math.max(0, Math.min(1, (buf[qi++] - vmin) / rng)), 0.4));
        for (let dy = 0; dy < step; dy++) {
          for (let dx = 0; dx < step; dx++) {
            const idx = ((py + dy) * W + px + dx) * 4;
            im.data[idx] = g; im.data[idx + 1] = g; im.data[idx + 2] = Math.min(255, g + 40); im.data[idx + 3] = 255;
          }
        }
      }
    }
    c.putImageData(im, 0, 0);
    c.strokeStyle = 'rgba(248,250,252,0.85)'; c.lineWidth = 1.5; c.setLineDash([4, 3]);
    c.beginPath(); c.arc(W / 2, H / 2, (thetaS / 2 / FOV) * (W / 2), 0, Math.PI * 2); c.stroke();
    c.setLineDash([]);
    c.strokeStyle = '#334155'; c.lineWidth = 3; c.strokeRect(2, 2, W - 4, H - 4);
    c.fillStyle = '#f8fafc'; c.font = '13px sans-serif';
    c.fillText('合成图像：uv 反傅里叶（IDA）', 8, 16);
    c.fillStyle = '#94a3b8'; c.font = '11px sans-serif';
    c.fillText('虚圆=真源径；旁瓣=欠采样脏波束', 8, H - 8);
    img.tex.needsUpdate = true;
  }
  function drawVis(thetaS: number): void {
    const c = vis.frame(`θ_s = ${(thetaS * 1000).toFixed(1)} mas 源径`, '基线 b (λ)', '|V(b)|');
    const W = vis.W, H = vis.H;
    c.strokeStyle = '#06b6d4'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 200; i++) {
      const b = (i / 200) * B_AX;
      const px = 46 + (b / B_AX) * (W - 62);
      const py = (H - 44) - dotV(b, thetaS) * (H - 84);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    const b1n = 1.22 / thetaS; // 第一零点对应基线
    if (b1n <= B_AX) {
      const px = 46 + (b1n / B_AX) * (W - 62);
      c.strokeStyle = '#f8fafc'; c.setLineDash([5, 4]); c.lineWidth = 2;
      c.beginPath(); c.moveTo(px, 18); c.lineTo(px, H - 40); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#f8fafc'; c.font = '13px sans-serif';
      c.fillText('圆盘第一零点 b=1.22λ/θs', px - 92, 34);
    }
    // 三条实测长基线（与 uv 画布同一基线长度）在该可见度曲线上的取样点
    for (let k = 0; k < 3; k++) {
      const px = 46 + (BL[k] / B_AX) * (W - 62);
      const py = (H - 44) - dotV(BL[k], thetaS) * (H - 84);
      c.fillStyle = BCOL[k];
      c.beginPath(); c.arc(px, py, 4.5, 0, 7); c.fill();
      c.fillStyle = '#94a3b8'; c.font = '12px sans-serif';
      c.fillText(`b${k + 1}=${BL[k].toFixed(0)}λ`, px - 16, py - 9);
    }
    vis.tex.needsUpdate = true;
  }
  drawUv(0); drawVis(0.05); drawImg(0.05);
  g.add(panelSprite(THREE, bag, [
    { text: '综合孔径：N 台天线 → N(N−1)/2 条基线，逐基线测可见度 V(u,v)', color: '#f8fafc' },
    { text: 'Van Cittert–Zernike：V 为天空亮度分布的傅里叶变换', color: '#94a3b8' },
    { text: 'θ_min ≈ λ/B_max：最长基线定分辨率；自转补 uv（椭圆比 = |sinδ|）', color: '#fbbf24' },
    { text: '成图：对已填 uv 点反傅里叶 → 合成像（左下，旁瓣即欠采样）', color: '#22c55e' },
  ], [0, 4.6, 0], 7.8, 'center'));
  let lastB = -1;
  return (t: number, dt: number) => {
    void dt;
    // 所有天线指向源（馈源沿碗轴）
    for (const d of dishes) {
      const dir = srcPos.clone().sub(d.bowl.position.clone().add(d.grp.position)).normalize();
      d.bowl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      d.feed.position.copy(d.bowl.position).addScaledVector(dir, 0.55);
    }
    src.scale.setScalar(1 + 0.1 * Math.sin(t * 2));
    const b = Math.floor(t * 5);
    if (b !== lastB) {
      lastB = b;
      const th = 0.045 + 0.015 * Math.sin(t * 0.2);
      drawUv(t); drawVis(th); drawImg(th); // 同一 θ_s 驱动曲线与合成像
    }
  };
}

/** P81 迈克尔逊干涉仪：分束镜 + 移动镜 + 等倾圆条纹 */
function build_michelson(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title; // 单知识点 variant，无二次分支
  const axY = 1.0;
  // 分束镜（45° 半反半透）
  const bsPlate = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(1.7, 1.7, 0.06)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, transparent: true, opacity: 0.3, side: THREE.DoubleSide })),
  );
  bsPlate.position.set(0, axY, 0);
  bsPlate.rotation.y = Math.PI / 4;
  g.add(bsPlate);
  // 补偿板（示意）
  const comp = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(1.7, 1.7, 0.05)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.white, transparent: true, opacity: 0.14, side: THREE.DoubleSide })),
  );
  comp.position.set(-0.32, axY, 0.32);
  comp.rotation.y = Math.PI / 4;
  g.add(comp);
  // M1 固定反射镜（+x 臂）
  const mirGeo = bag.geo(new THREE.CylinderGeometry(0.8, 0.8, 0.14, 28));
  const mirMat = bag.mat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.15 }));
  const m1 = new THREE.Mesh(mirGeo, mirMat);
  m1.rotation.z = Math.PI / 2;
  m1.position.set(3.6, axY, 0);
  g.add(m1);
  // M2 移动反射镜（+z 臂，沿导轨平移）
  const m2 = new THREE.Mesh(mirGeo, mirMat);
  m2.rotation.x = Math.PI / 2;
  m2.position.set(0, axY, 3.4);
  g.add(m2);
  const rail = lineFrom(THREE, bag, [new THREE.Vector3(0, axY - 0.9, 1.2), new THREE.Vector3(0, axY - 0.9, 4.4)], PAL.slate);
  g.add(rail);
  const knob = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.18, 0.18, 0.6, 14)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, metalness: 0.6 })),
  );
  knob.rotation.x = Math.PI / 2;
  knob.position.set(0.45, axY - 0.9, 4.7);
  g.add(knob);
  // He-Ne 激光管（-x 入射）+ 观察屏方向（-z 输出）
  const tube = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.16, 0.16, 1.9, 14)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, emissive: 0xb91c1c, emissiveIntensity: 0.7 })),
  );
  tube.rotation.z = Math.PI / 2;
  tube.position.set(-4.3, axY, 0.64);
  g.add(tube);
  // 光路（静态段 + 动态 M2 段）
  g.add(lineFrom(THREE, bag, [new THREE.Vector3(-3.3, axY, 0.64), new THREE.Vector3(0, axY, 0)], PAL.red, true));
  g.add(lineFrom(THREE, bag, [new THREE.Vector3(0, axY, 0), m1.position.clone()], PAL.red, true));
  const armZ = dynLine(THREE, bag, PAL.red, new THREE.Vector3(0, axY, 0), m2.position.clone(), 0.85);
  g.add(armZ.m);
  const scrP = new THREE.Vector3(0.4, axY + 0.1, -3.6);
  g.add(lineFrom(THREE, bag, [new THREE.Vector3(0, axY, 0), scrP], PAL.red, true));
  // 等倾圆条纹观察屏
  const scr = makeCanvasPlane(bag, THREE, 300, 300, 3.2, [scrP.x + 2.2, axY + 1.5, scrP.z - 0.6]);
  g.add(scr.m);
  // 屏上圆环：半径 ∝ sqrt(k + p)，p 为 2Δx/λ 的小数部分 → Δx 增大时条纹自中心涌出
  const lam = 0.55; // 示意波长（米制场景放大）
  function drawFringes(deltX: number, dir: number): number {
    const c = scr.c;
    c.fillStyle = '#050810'; c.fillRect(0, 0, 300, 300);
    const mOrd = 2 * deltX / lam;
    const p = mOrd - Math.floor(mOrd);
    for (let k = 0; k < 11; k++) {
      const rad = 13.5 * Math.sqrt(k + p);
      if (rad > 146) break;
      c.strokeStyle = k % 2 === 0 ? 'rgba(248,113,113,0.95)' : 'rgba(120,20,20,0.75)';
      c.lineWidth = 5;
      c.beginPath(); c.arc(150, 150, rad, 0, Math.PI * 2); c.stroke();
    }
    // 中心斑点随 p 明暗
    const I0 = Math.cos(Math.PI * p) ** 2;
    c.fillStyle = `rgba(255,220,220,${(0.15 + 0.85 * I0).toFixed(2)})`;
    c.beginPath(); c.arc(150, 150, 9, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#334155'; c.lineWidth = 3; c.strokeRect(2, 2, 296, 296);
    c.fillStyle = '#f8fafc'; c.font = '16px sans-serif';
    const nFringe = Math.abs(Math.round(mOrd)); // 条纹计数 N = |2Δx/λ|（与 Δx 同源）
    c.fillText(`Δx = ${(deltX / lam).toFixed(2)} λ   N = |2Δx/λ| = ${nFringe}`, 14, 26);
    c.fillStyle = '#fbbf24'; c.font = '14px sans-serif';
    c.fillText(dir > 0 ? 'M2 远离：条纹自中心涌出（冒出）' : 'M2 靠近：条纹向中心陷入（内吞）', 14, 46);
    c.fillStyle = '#94a3b8'; c.font = '14px sans-serif';
    c.fillText('等倾圆环：Δx 每变 λ/2 涌出/内吞一条', 14, 288);
    scr.tex.needsUpdate = true;
    return nFringe;
  }
  drawFringes(0.4, 1);
  // 光子点沿两臂往返
  const phGeo = bag.geo(new THREE.SphereGeometry(0.08, 8, 8));
  const phMat = bag.mat(new THREE.MeshBasicMaterial({ color: 0xfca5a5 }));
  const ph1 = new THREE.Mesh(phGeo, phMat); g.add(ph1);
  const ph2 = new THREE.Mesh(phGeo, phMat); g.add(ph2);
  g.add(panelSprite(THREE, bag, [
    { text: 'Δ = 2·Δx·cosθ：中心条纹级次 m = 2Δx/λ', color: '#f8fafc' },
    { text: 'M2 每移动 λ/2，圆环涌出（或内吞）一条条纹', color: '#94a3b8' },
    { text: '读数：屏上 Δx(λ) 与条纹计数 N = 2Δx/λ（示意）', color: '#fbbf24' },
  ], [0, 4.6, 0], 7.8, 'center'));
  let lastB = -1;
  return (t: number, dt: number) => {
    void dt;
    const z2 = 2.6 + 0.9 * Math.sin(t * 0.45);
    m2.position.z = z2;
    armZ.set(new THREE.Vector3(0, axY, 0), m2.position.clone());
    const dX = z2 - 2.6;
    const b = Math.floor(t * 6);
    if (b !== lastB) {
      lastB = b;
      // M2 运动方向：d(z2)/dt 的符号（与导轨几何同源）
      drawFringes(dX, Math.cos(t * 0.45) > 0 ? 1 : -1);
      (scr.m.material as import('three').MeshBasicMaterial).opacity = 1;
    }
    knob.rotation.y = t * 1.2;
    const fx = (t * 1.5) % 1;
    const go = fx < 0.5 ? fx * 2 : (1 - fx) * 2;
    ph1.position.set(go * 3.4, axY, 0);
    ph2.position.set(0, axY, go * (z2 - 0.2));
  };
}
/** P350 MRI 与 k 空间：自旋进动 + 逐行填充 k 空间 → 渐进傅里叶成像 */
function build_mri(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title; // 单知识点 variant，无二次分支
  const C = new THREE.Vector3(-1.6, 1.0, 0);
  // 主磁体（环形机架）+ B₀ 方向
  const housing = new THREE.Mesh(
    bag.geo(new THREE.TorusGeometry(2.9, 0.55, 14, 44)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.35 })),
  );
  housing.position.copy(C);
  g.add(housing);
  const bore = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(2.35, 2.35, 1.4, 40, 1, true)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x1e293b, transparent: true, opacity: 0.35, side: THREE.DoubleSide })),
  );
  bore.rotation.x = Math.PI / 2;
  bore.position.copy(C);
  g.add(bore);
  for (const dx of [-1.2, 0, 1.2]) {
    g.add(lineFrom(THREE, bag, [
      new THREE.Vector3(C.x + dx, C.y - 2.4, C.z), new THREE.Vector3(C.x + dx, C.y + 2.6, C.z),
    ], PAL.gold, true));
  }
  // 体素：透明立方内的 ¹H 自旋箭头（绕 B₀=↑ 拉莫尔进动）
  const voxel = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(1.5, 1.5, 1.5)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, transparent: true, opacity: 0.12 })),
  );
  voxel.position.copy(C);
  g.add(voxel);
  const spins: import('three').ArrowHelper[] = [];
  for (let i = 0; i < 6; i++) {
    const a = new THREE.ArrowHelper(
      new THREE.Vector3(1, 1, 0).normalize(), new THREE.Vector3(C.x, C.y, C.z), 0.8,
      [0x06b6d4, 0x22c55e, 0xf59e0b][i % 3], 0.2, 0.12,
    );
    g.add(a);
    spins.push(a);
  }
  // FID/回波感应电压曲线（体素前方，随读出窗衰减）
  const N = 160;
  const fidGeo = bag.geo(new THREE.BufferGeometry());
  fidGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const fid = new THREE.Line(fidGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.green })));
  fid.position.set(C.x, C.y - 2.9, 1.2);
  g.add(fid);
  // —— 幻影图（离屏 96×96，头部断面示意：脑椭圆+脑室+高亮病灶）——
  const ph = document.createElement('canvas');
  ph.width = 96; ph.height = 96;
  const pc = ph.getContext('2d')!;
  pc.fillStyle = '#050810'; pc.fillRect(0, 0, 96, 96);
  const brain = pc.createRadialGradient(48, 48, 6, 48, 48, 40);
  brain.addColorStop(0, 'rgba(226,232,240,0.95)');
  brain.addColorStop(0.8, 'rgba(148,163,184,0.8)');
  brain.addColorStop(1, 'rgba(71,85,105,0.2)');
  pc.fillStyle = brain;
  pc.beginPath(); pc.ellipse(48, 48, 40, 33, 0, 0, Math.PI * 2); pc.fill();
  pc.fillStyle = 'rgba(15,23,42,0.9)'; // 脑室（低信号）
  pc.beginPath(); pc.ellipse(38, 46, 7, 12, 0.4, 0, Math.PI * 2); pc.fill();
  pc.beginPath(); pc.ellipse(58, 52, 6, 10, -0.4, 0, Math.PI * 2); pc.fill();
  pc.fillStyle = 'rgba(251,191,36,0.95)'; // 病灶（高信号）
  pc.beginPath(); pc.arc(66, 36, 6, 0, Math.PI * 2); pc.fill();
  const phTex = bag.tex(new THREE.CanvasTexture(ph));
  // 渐进成像画布（低通→全通：图像=F⁻¹[k 空间] 的示意）
  const imgP = makeCanvasPlane(bag, THREE, 300, 300, 3.0, [5.2, -1.5, 0]);
  g.add(imgP.m);
  const tcv = document.createElement('canvas');
  tcv.width = 300; tcv.height = 300;
  const tc2 = tcv.getContext('2d')!;
  // k 空间画布（幅度谱，逐行填充）
  const kP = makeCanvasPlane(bag, THREE, 300, 300, 3.0, [5.2, 2.4, 0]);
  g.add(kP.m);
  const NL = 26; // 相位编码行数
  function kMag(kx: number, ky: number): number {
    const g1 = Math.exp(-(kx * kx + ky * ky) / 95);
    const g2 = 0.5 * Math.exp(-((kx - 6) * (kx - 6) + ky * ky) / 20);
    const g3 = 0.32 * Math.exp(-((kx + 5) * (kx + 5) + (ky - 4) * (ky - 4)) / 14);
    return Math.min(1, g1 + g2 + g3);
  }
  function drawK(lineF: number, sweep: number): void {
    const c = kP.c;
    c.fillStyle = 'rgba(7,11,20,0.92)'; c.fillRect(0, 0, 300, 300);
    c.strokeStyle = '#334155'; c.lineWidth = 3; c.strokeRect(2, 2, 296, 296);
    const step = 280 / NL;
    for (let iy = 0; iy < NL; iy++) {
      const ky = iy - NL / 2 + 0.5;
      for (let ix = 0; ix < NL; ix++) {
        const kx = ix - NL / 2 + 0.5;
        let filled = iy < lineF;
        if (iy === Math.floor(lineF)) filled = ix / NL <= sweep;
        if (!filled) continue;
        const m = kMag(kx, ky);
        c.fillStyle = `rgba(${Math.round(60 + 190 * m)},${Math.round(140 + 110 * m)},250,${(0.25 + 0.75 * m).toFixed(2)})`;
        const r = 1.2 + 3.6 * m;
        c.fillRect(10 + ix * step + step / 2 - r / 2, 10 + iy * step + step / 2 - r / 2, r, r);
      }
    }
    if (lineF < NL) {
      c.strokeStyle = '#f8fafc';
      c.beginPath(); c.moveTo(10, 10 + lineF * step); c.lineTo(290, 10 + lineF * step); c.stroke();
    }
    c.fillStyle = '#94a3b8'; c.font = '15px sans-serif';
    c.fillText(`k 空间：k_y 行 ${Math.min(NL, Math.floor(lineF) + 1)}/${NL}`, 14, 24);
    kP.tex.needsUpdate = true;
  }
  function drawImg(p: number): void {
    const c = imgP.c;
    c.fillStyle = '#050810'; c.fillRect(0, 0, 300, 300);
    const q = Math.max(0.05, p);
    tc2.clearRect(0, 0, 300, 300);
    tc2.imageSmoothingEnabled = true;
    tc2.drawImage(ph, 0, 0, 96, 96, 0, 0, 300 * q, 300 * q);
    c.imageSmoothingEnabled = true;
    c.drawImage(tcv, 0, 0, 300 * q, 300 * q, 0, 0, 300, 300);
    c.strokeStyle = '#334155'; c.lineWidth = 3; c.strokeRect(2, 2, 296, 296);
    c.fillStyle = '#22c55e'; c.font = '15px sans-serif';
    c.fillText(p >= 0.999 ? '傅里叶成像完成' : `重建中：低通 ${Math.round(p * 100)}%`, 14, 24);
    imgP.tex.needsUpdate = true;
  }
  drawK(0, 0); drawImg(0);
  g.add(panelSprite(THREE, bag, [
    { text: 'ω₀ = γB₀；γ/2π = 42.58 MHz/T（¹H，进动视觉加速）', color: '#f8fafc' },
    { text: 'Gx 频率编码读出回波，Gy 相位编码逐步改变 → 逐行填 k 空间', color: '#94a3b8' },
    { text: '图像 = F⁻¹[k空间]：中心=低空间频(对比) 边缘=细节（渐进示意）', color: '#fbbf24' },
  ], [0, 4.6, 0], 7.8, 'center'));
  const fa = (fidGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
  let lastB = -1;
  return (t: number, dt: number) => {
    void dt;
    // 自旋绕 B₀(↑) 进动
    spins.forEach((a, i) => {
      const ph2 = t * 5 + i * 1.05;
      const tilt = 1.05; // 与 B₀ 夹角
      a.position.set(C.x + 0.32 * Math.cos(i * 2.4), C.y - 0.3 + (i % 3) * 0.3, C.z + 0.32 * Math.sin(i * 2.4));
      a.setDirection(new THREE.Vector3(Math.sin(tilt) * Math.cos(ph2), Math.cos(tilt), Math.sin(tilt) * Math.sin(ph2)));
    });
    housing.rotation.z = t * 0.05;
    // 填充周期 8s：中心行优先→逐行（简化：自顶向下）
    const cyc = (t * 0.125) % 1;
    const lineF = cyc * NL;
    const sweep = lineF - Math.floor(lineF);
    const p = Math.min(1, cyc * 1.15);
    drawK(lineF, sweep);
    // FID：读出窗内衰减正弦
    const fidA = Math.exp(-((sweep * 3) % 2)) * (cyc < 0.98 ? 1 : 0);
    for (let i = 0; i < N; i++) {
      const x = i / (N - 1);
      fa[i * 3] = (x - 0.5) * 6;
      fa[i * 3 + 1] = fidA * Math.exp(-x * 2.4) * Math.sin(x * 46 - t * 6) * 0.8;
      fa[i * 3 + 2] = 0;
    }
    (fidGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    const b = Math.floor(t * 6);
    if (b !== lastB) { lastB = b; drawImg(p); }
  };
}

/** P357 光学相干断层 OCT：参考臂扫描 + 低相干门 + 视网膜 B-scan */
function build_oct(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title; // 单知识点 variant，无二次分支
  const axY = 2.3;
  const bsPos = new THREE.Vector3(-1.0, axY, 0);
  // 超辐射 SLD 光源
  const sld = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(1.1, 0.35, 0.35)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.amber, emissive: 0xd97706, emissiveIntensity: 0.8 })),
  );
  sld.position.set(-4.6, axY, -1.6);
  g.add(sld);
  g.add(lineFrom(THREE, bag, [new THREE.Vector3(-4.0, axY, -1.35), bsPos], PAL.amber, true));
  // 分束镜
  const plate = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(1.1, 1.1, 0.05)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, transparent: true, opacity: 0.3, side: THREE.DoubleSide })),
  );
  plate.position.copy(bsPos);
  plate.rotation.y = Math.PI / 4;
  g.add(plate);
  // 参考臂：横向导轨上的扫描镜
  const refMirror = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 22)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.15 })),
  );
  refMirror.rotation.z = Math.PI / 2;
  g.add(refMirror);
  const refRail = lineFrom(THREE, bag, [new THREE.Vector3(-5.0, axY - 0.6, 0), new THREE.Vector3(-2.0, axY - 0.6, 0)], PAL.slate);
  g.add(refRail);
  const refArm = dynLine(THREE, bag, PAL.amber, bsPos.clone(), new THREE.Vector3(-3.4, axY, 0), 0.8);
  g.add(refArm.m);
  // 样品臂：低倍物镜 + 视网膜分层模体
  const lens = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.55, 20, 14)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0xbfdbfe, transparent: true, opacity: 0.35 })),
  );
  lens.scale.set(0.4, 1, 1);
  lens.position.set(bsPos.x + 1.6, axY - 1.0, 0);
  g.add(lens);
  const retinaC = new THREE.Vector3(bsPos.x + 1.6, -0.6, 0);
  const layerCols = [0xf8fafc, 0xfbbf24, 0x94a3b8, 0x6d28d9, 0xef4444];
  const layerY = [0.55, 0.15, -0.25, -0.62, -1.0]; // 各层中心
  const layerD = [0.34, 0.32, 0.3, 0.26, 0.4];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(3.6, layerD[i], 1.8)),
      bag.mat(new THREE.MeshStandardMaterial({ color: layerCols[i], transparent: true, opacity: 0.4 })),
    );
    m.position.set(retinaC.x, retinaC.y + layerY[i], retinaC.z);
    g.add(m);
  }
  const sampPt = new THREE.Vector3(retinaC.x, axY - 1.6, 0);
  const sampArm = dynLine(THREE, bag, PAL.amber, bsPos.clone(), sampPt, 0.8);
  g.add(sampArm.m);
  g.add(lineFrom(THREE, bag, [bsPos.clone(), new THREE.Vector3(-1.0, axY - 1.6, 0)], PAL.amber, true));
  // 相干门指示：BS 处光晕脉冲（门与样品深度匹配时闪烁）
  const gate = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.3, 16, 12)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.green, transparent: true, opacity: 0.2 })),
  );
  gate.position.copy(bsPos);
  g.add(gate);
  // —— A-scan 画布：随参考臂门深扫描，界面峰按门包络点亮 ——
  const ascan = makePlot(bag, THREE, 330, 220, 3.5, [5.6, 2.6, 0]);
  g.add(ascan.m);
  const depths = [0.35, 0.72, 1.05, 1.38, 1.72]; // 五层界面深度（示意 mm）
  const refl = [0.9, 0.5, 0.7, 0.6, 0.85];
  function drawA(gateD: number): void {
    const c = ascan.frame(`相干门 g = ${(gateD * 1000).toFixed(0)} μm`, '深度 (mm)', 'I');
    const W = ascan.W, H = ascan.H;
    c.strokeStyle = '#22c55e'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 160; i++) {
      const d = (i / 160) * 2.2;
      let a = 0;
      for (let k = 0; k < 5; k++) {
        a += refl[k] * Math.exp(-((d - depths[k]) ** 2) / 0.004) * Math.exp(-((d - gateD) ** 2) / 0.02);
      }
      const px = 46 + (d / 2.2) * (W - 62);
      const py = (H - 40) - Math.min(1, a) * (H - 76);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    c.strokeStyle = '#f8fafc'; c.setLineDash([5, 4]); c.lineWidth = 2;
    const gxp = 46 + (gateD / 2.2) * (W - 62);
    c.beginPath(); c.moveTo(gxp, 18); c.lineTo(gxp, H - 40); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#94a3b8'; c.font = '13px sans-serif';
    c.fillText('低相干门 l_c≈数μm：仅匹配深度干涉', 56, H - 28);
    ascan.tex.needsUpdate = true;
  }
  // —— B-scan 画布：横向逐点扫描累积分层断层像 ——
  const bscan = makeCanvasPlane(bag, THREE, 320, 240, 3.5, [5.6, -0.6, 0]);
  g.add(bscan.m);
  const bc = bscan.c;
  bc.fillStyle = '#050810'; bc.fillRect(0, 0, 320, 240);
  let prevCol = 0;
  function scanColumn(col: number, gateD: number): void {
    for (let i = 0; i < 5; i++) {
      const yTop = 26 + (depths0(i) * 190);
      const yBot = 26 + (depths0(i + 1) * 190);
      const wob = 5 * Math.sin(col * 0.05 + i * 1.7) + fbm2(col * 0.08, i * 3) * 4;
      bc.fillStyle = `#${new THREE.Color(layerCols[i]).getHexString()}`;
      bc.globalAlpha = 0.75;
      bc.fillRect(col, yTop + wob, 2, yBot - yTop);
      bc.globalAlpha = 1;
      // 门深落在该层 → 亮点（A-scan 峰写入）
      const midD = (depths0(i) + depths0(i + 1)) / 2 * 0.85;
      if (Math.abs(midD - gateD) < 0.05) {
        bc.fillStyle = 'rgba(255,255,255,0.9)';
        bc.fillRect(col, yTop + wob, 2, 3);
      }
    }
    // 散斑噪声
    for (let s = 0; s < 4; s++) {
      bc.fillStyle = `rgba(255,255,255,${(Math.random() * 0.08).toFixed(2)})`;
      bc.fillRect(col + Math.random() * 2, 30 + Math.random() * 190, 1, 1);
    }
    bscan.tex.needsUpdate = true;
  }
  function depths0(i: number): number {
    return i <= 0 ? 0.06 : i >= 6 ? 1.0 : (depths[i - 1] ?? 2.0) / 2.2;
  }
  drawA(0.5);
  g.add(panelSprite(THREE, bag, [
    { text: '低相干门控：l_c≈λ₀²/Δλ 数 μm，仅参考/样品光程匹配处干涉', color: '#f8fafc' },
    { text: '轴向分辨率 δz ≈ 0.44·λ₀²/(n·Δλ) = 0.44·λ₀·l_c/n（组织内 3–5 μm）', color: '#94a3b8' },
    { text: '读数：A 扫逐深峰值 → 横向扫描堆叠出视网膜 B-scan', color: '#fbbf24' },
  ], [0, 4.6, 0], 7.8, 'center'));
  let lastB = -1;
  return (t: number, dt: number) => {
    void dt;
    // 参考臂门深扫描（慢）+ 样品光束横向扫描（快）
    const gateD = 0.2 + 1.8 * (0.5 + 0.5 * Math.sin(t * 0.35));
    refMirror.position.set(-5.0 + (gateD / 2.0) * 3.0, axY, 0);
    refArm.set(bsPos.clone(), refMirror.position.clone());
    const sx = Math.sin(t * 2.1);
    sampPt.x = retinaC.x + sx * 1.6;
    sampArm.set(bsPos.clone(), sampPt.clone());
    (gate.material as import('three').MeshBasicMaterial).opacity = 0.15 + 0.5 * Math.max(0, Math.sin(t * 3.4)) * Math.exp(-((gateD % 0.35)));
    const col = Math.floor(((t * 0.5) % 1) * 320);
    if (col < prevCol) { bc.fillStyle = '#050810'; bc.fillRect(0, 0, 320, 240); }
    for (let c2 = prevCol; c2 < col; c2 += 2) scanColumn(c2, gateD);
    prevCol = col;
    const b = Math.floor(t * 8);
    if (b !== lastB) { lastB = b; drawA(gateD); }
  };
}
/** P352 PET 正电子发射断层 / P353 SPECT 单光子成像：title 二次分支 */
function build_pet(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const spect = title.includes('SPECT') || title.includes('单光子') || title.includes('准直');
  const C = new THREE.Vector3(-1.4, 1.0, 0);
  // 患者断层体模（轴向沿 z，面向相机）
  const body = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(2.3, 2.3, 3.4, 36, 1, true)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.14, side: THREE.DoubleSide })),
  );
  body.rotation.x = Math.PI / 2;
  body.position.copy(C);
  g.add(body);

  if (!spect) {
    // —— PET：16 块探测器环 + β⁺ 湮灭双 511keV 背对光子 + 符合 LOR ——
    const R = 3.1;
    const blocks: import('three').Mesh[] = [];
    const blkGeo = bag.geo(new THREE.BoxGeometry(0.55, 1.7, 0.85));
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const m = new THREE.Mesh(blkGeo, bag.mat(new THREE.MeshStandardMaterial({
        color: 0x0e7490, emissive: 0x06b6d4, emissiveIntensity: 0.08,
      })));
      m.position.set(C.x + R * Math.cos(a), C.y + R * Math.sin(a), 0);
      m.rotation.z = a;
      g.add(m);
      blocks.push(m);
    }
    // 热点（FDG 浓聚区）：引导衰变事件采样（均为相对环心 C 的偏移，落在体模内）
    const hot = [
      new THREE.Vector3(0.9, 0.7, 0), new THREE.Vector3(-0.8, 0.2, 0), new THREE.Vector3(0.2, -1.1, 0),
    ];
    const NS = 5;
    const slots: { p: V3; n: V3; a: V3; b: V3; proj: number }[] = [];
    for (let i = 0; i < NS; i++) {
      const useHot = i < 3;
      const p = C.clone().add(useHot
        ? hot[i].clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, 0))
        : new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 0));
      const an = Math.random() * Math.PI * 2;
      const n = new THREE.Vector3(Math.cos(an), Math.sin(an), 0);
      // 弦端点（探测器环交点）：对环心 C 的相对量 q = p − C 求弦；半弦从垂足起算
      const q = p.clone().sub(C);
      const proj = q.dot(n);
      const dper = Math.sqrt(Math.max(0.01, q.lengthSq() - proj * proj));
      const half = Math.sqrt(Math.max(0.1, R * R - dper * dper));
      slots.push({
        p, n, proj,
        a: p.clone().addScaledVector(n, half - proj),
        b: p.clone().addScaledVector(n, -(half + proj)),
      });
    }
    const phGeo = bag.geo(new THREE.SphereGeometry(0.13, 10, 8));
    const flashGeo = bag.geo(new THREE.SphereGeometry(0.2, 10, 8));
    const lorLines: import('three').Line[] = [];
    const lorSet: { set: (a: V3, b: V3) => void }[] = [];
    for (let i = 0; i < NS; i++) {
      const dl = dynLine(THREE, bag, PAL.gold, slots[i].a, slots[i].b, 0.9);
      dl.m.visible = false;
      g.add(dl.m);
      lorLines.push(dl.m);
      lorSet.push(dl);
    }
    const photons: import('three').Mesh[][] = [];
    const flashes: import('three').Mesh[] = [];
    for (let i = 0; i < NS; i++) {
      const pa = new THREE.Mesh(phGeo, bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan })));
      const pb = new THREE.Mesh(phGeo, bag.mat(new THREE.MeshBasicMaterial({ color: PAL.violet })));
      const fl = new THREE.Mesh(flashGeo, bag.mat(new THREE.MeshBasicMaterial({ color: PAL.green, transparent: true, opacity: 0.9 })));
      g.add(pa); g.add(pb); g.add(fl);
      photons.push([pa, pb]);
      flashes.push(fl);
    }
    // 符合活动图（断面，累积热点）
    const act = makeCanvasPlane(bag, THREE, 300, 300, 3.2, [5.3, 1.2, 0]);
    g.add(act.m);
    const blobs: { x: number; y: number; born: number }[] = [];
    // TOF 读数：当前显示 LOR 的湮灭点沿弦偏离中量 proj → Δt = 2·proj/c，Δx = c·Δt/2 = proj
    let tofProj = 0;
    const cmPerUnit = 20 / R; // 视场半径 R ↔ 20 cm（头部 FOV 示意）
    function drawAct(now: number): void {
      const c = act.c;
      c.fillStyle = 'rgba(7,11,20,0.92)'; c.fillRect(0, 0, 300, 300);
      c.strokeStyle = '#334155'; c.lineWidth = 3; c.strokeRect(2, 2, 296, 296);
      c.strokeStyle = 'rgba(148,163,184,0.4)';
      c.beginPath(); c.arc(150, 150, 110, 0, Math.PI * 2); c.stroke();
      for (const bl of blobs) {
        const age = now - bl.born;
        if (age < 0 || age > 6) continue;
        const al = Math.max(0, 1 - age / 6);
        const gr = c.createRadialGradient(bl.x, bl.y, 1, bl.x, bl.y, 16);
        gr.addColorStop(0, `rgba(251,191,36,${(0.9 * al).toFixed(2)})`);
        gr.addColorStop(1, 'rgba(239,68,68,0)');
        c.fillStyle = gr;
        c.beginPath(); c.arc(bl.x, bl.y, 16, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = '#94a3b8'; c.font = '15px sans-serif';
      c.fillText('符合断面活度图（FDG 代谢热点）', 14, 24);
      const dtPs = 2 * Math.abs(tofProj) * cmPerUnit * 33.3; // 33.3 ps/cm = 1/c
      c.fillStyle = '#fbbf24';
      c.fillText(`TOF：Δt = 2Δx/c = ${dtPs.toFixed(0)} ps → Δx = cΔt/2 = ${(Math.abs(tofProj) * cmPerUnit).toFixed(1)} cm`, 14, 288);
      act.tex.needsUpdate = true;
    }
    g.add(panelSprite(THREE, bag, [
      { text: 'β⁺ 湮灭：e⁺+e⁻ → 2γ（各 511 keV，近 180° 背对出射）', color: '#f8fafc' },
      { text: '符合计数（Δt~ns 双命中）→ 一条响应线 LOR，无需准直器', color: '#94a3b8' },
      { text: '读数：金线=符合 LOR；活度图热点=高代谢区（示意）', color: '#fbbf24' },
      { text: 'TOF 定位：Δx = c·Δt/2（300 ps → 4.5 cm），随当前 LOR 同源', color: '#22c55e' },
    ], [0, 4.6, 0], 7.8, 'center'));
    let lastB = -1;
    return (t: number, dt: number) => {
      void dt;
      for (let i = 0; i < NS; i++) {
        const u = ((t * 0.25) + i * 0.2) % 1;
        const s = slots[i];
        const dist = u * R * 1.05;
        photons[i][0].position.copy(s.p).addScaledVector(s.n, dist);
        photons[i][1].position.copy(s.p).addScaledVector(s.n, -dist);
        const alive = u < 0.95;
        photons[i][0].visible = alive;
        photons[i][1].visible = alive;
        flashes[i].position.copy(s.p);
        flashes[i].visible = u < 0.1;
        lorSet[i].set(s.a, s.b);
        lorLines[i].visible = u > 0.8 && u < 0.95;
        if (lorLines[i].visible) tofProj = s.proj; // TOF 读数与当前 LOR 几何同源
        // 命中块闪烁
        const ia = Math.round(Math.atan2(s.a.y - C.y, s.a.x - C.x) / (Math.PI * 2) * 16 + 16) % 16;
        const ib = Math.round(Math.atan2(s.b.y - C.y, s.b.x - C.x) / (Math.PI * 2) * 16 + 16) % 16;
        const hit = u > 0.75 && u < 0.9;
        (blocks[ia].material as import('three').MeshStandardMaterial).emissiveIntensity = hit ? 1.2 : 0.08;
        (blocks[ib].material as import('three').MeshStandardMaterial).emissiveIntensity = hit ? 1.2 : 0.08;
      }
      const b = Math.floor(t * 4);
      if (b !== lastB) {
        lastB = b;
        // 每 bucket 依概率在热点处记录一次符合事件
        if (blobs.length < 40) {
          const hk = hot[Math.floor(Math.random() * 3)];
          const jx = Math.random() < 0.75 ? hk : new THREE.Vector3((Math.random() - 0.5) * 3.6, (Math.random() - 0.5) * 3.6, 0);
          blobs.push({ x: 150 + jx.x * 48, y: 150 - jx.y * 48, born: t });
        } else {
          blobs.shift();
        }
      }
      drawAct(t);
    };
  }

  // —— SPECT：铅栅准直器 + NaI 闪烁相机单头 180° 旋转投影 ——
  const head = new THREE.Group();
  g.add(head);
  const collim = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.55, 3.0, 3.0)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.6, roughness: 0.4 })),
  );
  collim.position.set(3.5, 0, 0);
  head.add(collim);
  // 准直器孔道刻面（画布贴图：平行铅隔条）
  const holeCv = document.createElement('canvas');
  holeCv.width = 128; holeCv.height = 128;
  const hc = holeCv.getContext('2d')!;
  hc.fillStyle = '#0b1220'; hc.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 8; i++) {
    hc.fillStyle = '#38bdf8';
    hc.fillRect(6 + i * 16, 6, 5, 116);
  }
  const holeTex = bag.tex(new THREE.CanvasTexture(holeCv));
  const holeFace = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(2.7, 2.7)),
    bag.mat(new THREE.MeshBasicMaterial({ map: holeTex })),
  );
  holeFace.position.set(3.22, 0, 0);
  holeFace.rotation.y = -Math.PI / 2;
  head.add(holeFace);
  const nai = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.4, 3.0, 3.0)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, emissive: 0x0891b2, emissiveIntensity: 0.3, transparent: true, opacity: 0.6 })),
  );
  nai.position.set(4.15, 0, 0);
  head.add(nai);
  const pmt = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.5, 2.6, 2.6)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x475569 })),
  );
  pmt.position.set(4.65, 0, 0);
  head.add(pmt);
  head.position.copy(C);
  // 示踪剂源（99mTc）
  const tracer = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.34, 16, 12)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.green, emissive: 0x22c55e, emissiveIntensity: 0.9 })),
  );
  tracer.position.set(C.x + 0.9, C.y + 0.5, C.z);
  g.add(tracer);
  // 光子：池 10 个（6 通过孔道 / 4 被铅条吸收）
  const pGeo = bag.geo(new THREE.SphereGeometry(0.09, 8, 8));
  const pMatPass = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan }));
  const pMatStop = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.red }));
  const sparks: import('three').Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(pGeo, i < 6 ? pMatPass : pMatStop);
    head.add(m);
    sparks.push(m);
  }
  // 平面投影累积画布
  const proj = makeCanvasPlane(bag, THREE, 300, 300, 3.2, [5.4, 1.2, -1.5]);
  g.add(proj.m);
  const hits: { x: number; y: number; born: number }[] = [];
  function drawProj(now: number, ang: number): void {
    const c = proj.c;
    c.fillStyle = 'rgba(7,11,20,0.92)'; c.fillRect(0, 0, 300, 300);
    c.strokeStyle = '#334155'; c.lineWidth = 3; c.strokeRect(2, 2, 296, 296);
    for (const h2 of hits) {
      const age = now - h2.born;
      if (age > 8) continue;
      const al = Math.max(0.05, 1 - age / 8);
      c.fillStyle = `rgba(56,189,248,${al.toFixed(2)})`;
      c.beginPath(); c.arc(h2.x, h2.y, 6, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = '#94a3b8'; c.font = '15px sans-serif';
    c.fillText(`准直平面投影 θ=${(ang * 57.3).toFixed(0)}°`, 14, 24);
    c.fillText('灵敏度~10⁻⁴：多数 γ 被铅隔条吸收', 14, 288);
    proj.tex.needsUpdate = true;
  }
  g.add(panelSprite(THREE, bag, [
    { text: '铅栅准直器：仅近轴向 γ 通过孔道（换空间定位，灵敏度骤降）', color: '#f8fafc' },
    { text: 'NaI(Tl) 闪烁体 + PMT 阵列定位；单头 180° 旋转采集投影', color: '#94a3b8' },
    { text: '读数：红点=被吸收 γ，青点=命中闪烁体并累积投影（示意）', color: '#fbbf24' },
  ], [0, 4.6, 0], 7.8, 'center'));
  let lastB = -1;
  return (t: number, dt: number) => {
    void dt;
    const ang = Math.PI * (0.5 + 0.5 * Math.sin(t * 0.1)); // 单头往返 0→180°
    head.rotation.z = ang;
    const u = (t * 0.55) % 1;
    for (let i = 0; i < 10; i++) {
      const ui = (u + i * 0.1) % 1;
      const pass = i < 6;
      const local = tracer.position.clone().sub(C).applyAxisAngle(new THREE.Vector3(0, 0, 1), -ang);
      const xEnd = pass ? 4.0 : 3.15 + (i % 3) * 0.12;
      const x = local.x + (xEnd - local.x) * ui;
      const jit = pass ? 0 : ((i * 37) % 10) / 10 - 0.5;
      sparks[i].position.set(x, local.y + (local.y > 0 ? 0.2 : -0.2) * ui + jit * 0.4, local.z * 0.3);
      sparks[i].visible = ui < 0.95;
    }
    const b = Math.floor(t * 5);
    if (b !== lastB) {
      lastB = b;
      if (hits.length > 60) hits.shift();
      const local = tracer.position.clone().sub(C).applyAxisAngle(new THREE.Vector3(0, 0, 1), -ang);
      hits.push({ x: 150 + local.y * 40 + (Math.random() - 0.5) * 20, y: 150 - local.x * 30 + (Math.random() - 0.5) * 20, born: t });
    }
    drawProj(t, ang);
  };
}

/** P316 相位衬度显微：泽尼克相板（π/2 中心环）+ 明场/相差对照 */
function build_phasecontrast(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title; // 单知识点 variant，无二次分支
  const axY = 1.1;
  const mkLens = (x: number, r: number): import('three').Mesh => {
    const m = new THREE.Mesh(
      bag.geo(new THREE.SphereGeometry(r, 22, 16)),
      bag.mat(new THREE.MeshStandardMaterial({ color: 0xbfdbfe, transparent: true, opacity: 0.4 })),
    );
    m.scale.set(0.28, 1, 1);
    m.position.set(x, axY, 0);
    g.add(m);
    return m;
  };
  mkLens(-4.4, 0.62); // 聚光镜
  const obj = mkLens(-1.2, 0.7); // 物镜
  mkLens(2.9, 0.6);  // 投影镜
  // 标本：玻璃片 + 近乎透明的相位细胞（仅引入相位延迟）
  const slide = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.12, 1.5, 1.2)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.white, transparent: true, opacity: 0.16 })),
  );
  slide.position.set(-2.9, axY, 0);
  g.add(slide);
  const cellMat = bag.mat(new THREE.MeshStandardMaterial({ color: 0xd1fae5, transparent: true, opacity: 0.1 }));
  const CELL_R = 0.34;
  const cellGeo = bag.geo(new THREE.IcosahedronGeometry(CELL_R, 2));
  const cellA = new THREE.Mesh(cellGeo, cellMat);
  cellA.scale.set(1.35, 0.75, 0.6);
  cellA.position.set(-2.72, axY + 0.18, 0.1);
  g.add(cellA);
  const cellB = new THREE.Mesh(cellGeo, cellMat);
  cellB.scale.set(0.9, 0.6, 0.5);
  cellB.position.set(-2.72, axY - 0.35, -0.15);
  g.add(cellB);
  // 泽尼克相位板：后焦面圆盘 + 金环（未散射光在此被衰减+相移 π/2）
  const plate = new THREE.Mesh(
    bag.geo(new THREE.CircleGeometry(0.95, 36)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x64748b, transparent: true, opacity: 0.18, side: THREE.DoubleSide })),
  );
  plate.position.set(0.9, axY, 0);
  g.add(plate);
  const pring = new THREE.Mesh(
    bag.geo(new THREE.TorusGeometry(0.16, 0.05, 10, 28)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: 0xd97706, emissiveIntensity: 0.8 })),
  );
  pring.position.copy(plate.position);
  g.add(pring);
  // 相机筒
  const cam = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.9, 0.7, 0.7)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x1e293b })),
  );
  cam.position.set(4.4, axY, 0);
  g.add(cam);
  // 光路：直射光（穿金环，过板后变暗）与散射光环（绕过金环）
  g.add(lineFrom(THREE, bag, [new THREE.Vector3(-5.1, axY - 0.5, 0), new THREE.Vector3(-4.4, axY, 0)], PAL.gold, true));
  const direct = dynLine(THREE, bag, PAL.white, new THREE.Vector3(-4.4, axY, 0), new THREE.Vector3(4.4, axY, 0), 0.7);
  g.add(direct.m);
  const scattered: import('three').Line[] = [];
  for (const dy of [-0.5, -0.25, 0.25, 0.5]) {
    const ln = dynLine(THREE, bag, PAL.cyan, new THREE.Vector3(-2.72, axY + 0.1, 0), new THREE.Vector3(4.4, axY + dy * 0.6, 0), 0.5);
    g.add(ln.m);
    scattered.push(ln.m);
  }
  // 光子上行脉冲（沿直射光路）
  const phGeo = bag.geo(new THREE.SphereGeometry(0.07, 8, 8));
  const phMat = bag.mat(new THREE.MeshBasicMaterial({ color: 0xfef3c7 }));
  const pulse = new THREE.Mesh(phGeo, phMat);
  g.add(pulse);
  // 对照画布：上=明场（几乎看不见），下=相差（暗核亮晕）
  const bf = makeCanvasPlane(bag, THREE, 300, 220, 3.2, [5.5, 3.0, 0]);
  g.add(bf.m);
  const pc2 = makeCanvasPlane(bag, THREE, 300, 220, 3.2, [5.5, 0.2, 0]);
  g.add(pc2.m);
  function drawViews(wob: number, phiA: number, phiB: number): void {
    // 明场：均匀浅灰背景 + α≈5% 细胞轮廓（透明难见）
    const c1 = bf.c;
    c1.fillStyle = '#cbd5e1'; c1.fillRect(0, 0, 300, 220);
    c1.strokeStyle = 'rgba(148,163,184,0.25)'; c1.lineWidth = 2;
    c1.beginPath(); c1.ellipse(120, 95 + wob, 46, 26, 0, 0, Math.PI * 2); c1.stroke();
    c1.fillStyle = 'rgba(100,116,139,0.12)';
    c1.beginPath(); c1.ellipse(120, 95 + wob, 42, 22, 0, 0, Math.PI * 2); c1.fill();
    c1.beginPath(); c1.ellipse(205, 150, 28, 16, 0, 0, Math.PI * 2); c1.fill();
    c1.fillStyle = '#0f172a'; c1.font = '15px sans-serif';
    c1.fillText('明场：透明细胞几乎不可见', 12, 22);
    bf.tex.needsUpdate = true;
    // 相差：相板把直射光移 π/2 并衰减 t → 样品内 I ∝ a²(t−φ)²（暗核）；溢出区相加 → 亮晕
    const tAmp = 0.1; // 金环振幅透过率（强度衰减 90%）
    const I0 = tAmp * tAmp; // 背景（无样品）强度 ∝ a²t²
    const c2 = pc2.c;
    c2.fillStyle = '#1e293b'; c2.fillRect(0, 0, 300, 220);
    const cells: readonly [number, number, number, number, number][] = [
      [120, 95 + wob, 46, 26, phiA], [205, 150, 28, 16, phiB],
    ];
    const ratios: number[] = [];
    for (const [cx, cy, rx, ry, phi] of cells) {
      const iCore = ((tAmp - phi) ** 2) / I0; // φ>0（更厚/折射率更大）→ 变暗
      const iHalo = ((tAmp + 0.35 * phi) ** 2) / I0; // 晕：散射光溢出区同相相加
      const coreA = Math.max(0, Math.min(0.95, 1 - iCore));
      const haloA = Math.max(0, Math.min(0.9, (iHalo - 1) * 0.55));
      const gr = c2.createRadialGradient(cx, cy, 4, cx, cy, rx + 14);
      gr.addColorStop(0, `rgba(15,23,42,${coreA.toFixed(2)})`);
      gr.addColorStop(0.7, `rgba(15,23,42,${(coreA * 0.8).toFixed(2)})`);
      gr.addColorStop(0.86, `rgba(248,250,252,${(0.28 + haloA).toFixed(2)})`);
      gr.addColorStop(1, 'rgba(248,250,252,0)');
      c2.fillStyle = gr;
      c2.beginPath(); c2.ellipse(cx, cy, rx + 14, ry + 10, 0, 0, Math.PI * 2); c2.fill();
      ratios.push(iCore, iHalo);
    }
    c2.fillStyle = '#f8fafc'; c2.font = '15px sans-serif';
    c2.fillText('相差：衬度由 φ 算出（暗核亮晕）', 12, 22);
    c2.fillStyle = '#fbbf24'; c2.font = '13px sans-serif';
    c2.fillText(
      `φ=${phiA.toFixed(3)}/${phiB.toFixed(3)} → I/I₀ 核 ${ratios[0].toFixed(2)}/${ratios[2].toFixed(2)} 晕 ${ratios[1].toFixed(2)}/${ratios[3].toFixed(2)}`,
      12, 208,
    );
    pc2.tex.needsUpdate = true;
  }
  // φ = 2π·Δn·h/λ：h 取细胞沿光轴（x）的实际厚度，故画面衬度与几何同源
  const K_PHI = (2 * Math.PI * 0.004) / 0.55;
  const phiOf = (mesh: import('three').Mesh): number => K_PHI * (2 * CELL_R * mesh.scale.x);
  drawViews(0, phiOf(cellA), phiOf(cellB));
  g.add(panelSprite(THREE, bag, [
    { text: '泽尼克相板：聚焦点金环衰减直射光 90% 并相移 π/2', color: '#f8fafc' },
    { text: '叠加 I=|i·t·a+s|²，弱相位物 s≈−i·a·φ → I≈a²t²−2a²tφ（φ 线性转强度）', color: '#94a3b8' },
    { text: '对照：上=明场（透明难见） 下=相差（衬度由 φ 算出，暗核亮晕）', color: '#fbbf24' },
  ], [0, 4.6, 0], 7.8, 'center'));
  let lastB = -1;
  return (t: number, dt: number) => {
    void dt;
    const wob = 3 * Math.sin(t * 0.9);
    cellA.position.y = axY + 0.18 + 0.04 * Math.sin(t * 0.9);
    cellB.scale.setScalar(0.9 + 0.08 * Math.sin(t * 1.3));
    (pring.material as import('three').MeshStandardMaterial).emissiveIntensity = 0.6 + 0.5 * Math.abs(Math.sin(t * 1.8));
    // 直射光过相板后变暗：把直射线分成两段透明度示意
    const px = ((t * 2.4) % 1) * 8.8 - 4.4;
    pulse.position.set(px, axY, 0);
    (pulse.material as import('three').MeshBasicMaterial).color.setHex(px > 0.9 ? 0x64748b : 0xfef3c7);
    scattered.forEach((ln, i) => {
      (ln.material as import('three').LineBasicMaterial).opacity = 0.35 + 0.25 * Math.sin(t * 2 + i);
    });
    obj.rotation.y = t * 0.2;
    const b = Math.floor(t * 5);
    if (b !== lastB) { lastB = b; drawViews(wob, phiOf(cellA), phiOf(cellB)); }
  };
}
/** P523 望远镜的衍射极限 / P89 望远镜的分辨极限：title 二次分支 */
function build_resolution(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  const diffr = title.includes('衍射');
  // 镜筒（共享）
  const tube = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(1.5, 1.5, 2.6, 34, 1, true)),
    bag.mat(new THREE.MeshStandardMaterial({
      color: 0x475569, metalness: 0.5, roughness: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 0.7,
    })),
  );
  tube.rotation.z = Math.PI / 2;
  tube.position.set(-4.8, 1.1, 0);
  g.add(tube);
  const ap = new THREE.Mesh(
    bag.geo(new THREE.RingGeometry(1.34, 1.5, 40)),
    bag.mat(new THREE.MeshBasicMaterial({ color: PAL.slate, side: THREE.DoubleSide })),
  );
  ap.rotation.y = Math.PI / 2;
  ap.position.set(-3.5, 1.1, 0);
  g.add(ap);

  if (diffr) {
    // —— 衍射分支：艾里斑像素级渲染 + 双点源瑞利判据可分辨切换 ——
    const airy = makeCanvasPlane(bag, THREE, 300, 300, 3.5, [5.5, 1.2, 0]);
    g.add(airy.m);
    // 远处双星（间距随时间摆动，与画布同步）
    const starGeo = bag.geo(new THREE.SphereGeometry(0.09, 8, 8));
    const starMat = bag.mat(new THREE.MeshBasicMaterial({ color: 0xfff7d6 }));
    const st1 = new THREE.Mesh(starGeo, starMat);
    const st2 = new THREE.Mesh(starGeo, starMat);
    g.add(st1); g.add(st2);
    const R1 = 58; // 第一暗环半径(px)
    const a1 = 1.22 * Math.PI;
    function drawAiry(sep: number): void {
      const W = 300, H = 300;
      const img = airy.c.createImageData(W, H);
      const cx = W / 2, cy = H / 2;
      for (let py = 0; py < H; py += 2) {
        for (let px = 0; px < W; px += 2) {
          let I = 0;
          for (const ox of [-sep / 2, sep / 2]) {
            // 双斑以 cx±ox 为中心平移叠加（ox 必须进入像素坐标，否则扫描 sep 画面不分离）
            const r = Math.hypot(px - (cx + ox), py - cy) / R1;
            const u = a1 * r;
            I += r < 1e-4 ? 1 : (2 * besselJ1(u) / u) ** 2;
          }
          I = Math.min(1, I * 0.62);
          for (let dy = 0; dy < 2; dy++) {
            for (let dx = 0; dx < 2; dx++) {
              const idx = ((py + dy) * W + px + dx) * 4;
              img.data[idx] = Math.round(255 * Math.min(1, I * 1.3));
              img.data[idx + 1] = Math.round(220 * Math.pow(I, 0.7));
              img.data[idx + 2] = Math.round(140 * Math.pow(I, 0.5));
              img.data[idx + 3] = 255;
            }
          }
        }
      }
      airy.c.putImageData(img, 0, 0);
      airy.c.strokeStyle = '#334155'; airy.c.lineWidth = 4;
      airy.c.strokeRect(2, 2, W - 4, H - 4);
      airy.c.fillStyle = '#f8fafc'; airy.c.font = '17px sans-serif';
      airy.c.fillText('θ_min = 1.22 λ/D', 16, 30);
      // 瑞利判据：双斑中心间距 = 第一暗环半径 R1（J1 首零点 u=3.8317=1.22π，r=1 ↔ 58px）
      airy.c.fillStyle = sep >= R1 ? '#22c55e' : '#ef4444';
      airy.c.fillText(sep >= R1 ? '可分辨（≥瑞利判据）' : '不可分辨（两斑合一）', 16, H - 16);
      airy.tex.needsUpdate = true;
    }
    drawAiry(40);
    g.add(panelSprite(THREE, bag, [
      { text: '瑞利判据：一源艾里斑峰恰落另一源第一暗环 → θ_min = 1.22λ/D', color: '#f8fafc' },
      { text: 'D=2.5 m, λ=550 nm → θ_min ≈ 0.057″（角距放大示意）', color: '#94a3b8' },
      { text: '读数：双源间距扫描，绿=可分辨 红=不可分辨', color: '#fbbf24' },
    ], [0, 4.6, 0], 7.8, 'center'));
    let lastSep = -1;
    return (t: number, dt: number) => {
      void dt;
      const sep = 18 + 100 * (0.5 + 0.5 * Math.sin(t * 0.3));
      const wSep = 0.14 + sep * 0.006;
      st1.position.set(2.2 - wSep, 3.7, -4.2);
      st2.position.set(2.2 + wSep, 3.7, -4.2);
      const tw = 1 + 0.15 * Math.sin(t * 7);
      st1.scale.setScalar(tw); st2.scale.setScalar(tw);
      const bucket = Math.round(sep / 3);
      if (bucket !== lastSep) { lastSep = bucket; drawAiry(sep); }
    };
  }

  // —— 默认（分辨极限）分支：口径阶梯对比，D 越大艾里斑越小 ——
  const Ds = [0.5, 1, 2, 4];
  const scopes: import('three').Mesh[] = [];
  const lenses: import('three').Mesh[] = [];
  const lGeoA = bag.geo(new THREE.CylinderGeometry(0.32, 0.32, 2.2, 22, 1, true));
  for (let i = 0; i < 4; i++) {
    const grp = new THREE.Group();
    grp.position.set(-6.1 + i * 2.1, -0.35, -1.4);
    g.add(grp);
    const pillar = new THREE.Mesh(
      bag.geo(new THREE.CylinderGeometry(0.12, 0.16, 0.9, 12)),
      bag.mat(new THREE.MeshStandardMaterial({ color: 0x334155 })),
    );
    pillar.position.y = 0.45;
    grp.add(pillar);
    const rr = 0.26 + Ds[i] * 0.2;
    const tb = new THREE.Mesh(lGeoA.clone(), bag.mat(new THREE.MeshStandardMaterial({
      color: 0x64748b, metalness: 0.5, roughness: 0.45, side: THREE.DoubleSide, transparent: true, opacity: 0.8,
    })));
    tb.scale.set(rr / 0.32, 1, rr / 0.32);
    tb.rotation.z = 0.5;
    tb.position.y = 1.6;
    grp.add(tb);
    bag.geo(tb.geometry);
    const lens = new THREE.Mesh(
      bag.geo(new THREE.CircleGeometry(rr * 0.92, 26)),
      bag.mat(new THREE.MeshStandardMaterial({ color: 0x7dd3fc, emissive: 0x0ea5e9, emissiveIntensity: 0.2 })),
    );
    lens.position.set(tb.position.x - Math.sin(0.5) * 1.1, tb.position.y + Math.cos(0.5) * 1.1, tb.position.z);
    lens.rotation.z = 0.5;
    lens.rotation.x = -Math.PI / 2 + 0.0;
    grp.add(lens);
    scopes.push(tb); lenses.push(lens);
  }
  const cmp = makeCanvasPlane(bag, THREE, 420, 300, 4.0, [5.0, 1.7, 0]);
  g.add(cmp.m);
  // 角标尺：θ = 1.22λ/D = 0.138/D″ → 斑半径(px) = PX_PER_ARCSEC·θ，即 13.5/D（严格 ∝1/D）
  const PX_PER_ARCSEC = 97.8;
  const THETA_SEE = 0.5; // 视宁度角宽（arcsec，示意）：与口径无关
  function drawCmp(hi: number, tw: number, see: number): void {
    const c = cmp.c;
    c.fillStyle = 'rgba(7,11,20,0.9)'; c.fillRect(0, 0, 420, 300);
    c.strokeStyle = '#334155'; c.lineWidth = 3; c.strokeRect(2, 2, 416, 296);
    const seePx = Math.max(2, PX_PER_ARCSEC * THETA_SEE * see); // 残余大气晕 = 0.5″×resid（与 AO 面板同源）
    for (let i = 0; i < 4; i++) {
      const cx0 = 60 + i * 100, cy0 = 140;
      const r0 = (0.138 / Ds[i]) * PX_PER_ARCSEC; // 艾里斑第一暗环半径 ∝ 1.22λ/D
      if (i === hi) {
        c.strokeStyle = 'rgba(251,191,36,0.9)'; c.lineWidth = 3;
        c.strokeRect(cx0 - 46, 34, 92, 210);
      }
      // 未校正（或校正不彻底）的视宁度晕：同一角标尺，故四列同宽——大口径被大气抹平
      const gs = c.createRadialGradient(cx0, cy0, 2, cx0, cy0, seePx);
      gs.addColorStop(0, `rgba(180,200,255,${(0.2 * see).toFixed(2)})`);
      gs.addColorStop(1, 'rgba(180,200,255,0)');
      c.fillStyle = gs;
      c.beginPath(); c.arc(cx0, cy0, seePx, 0, Math.PI * 2); c.fill();
      const gr = c.createRadialGradient(cx0, cy0, 1, cx0, cy0, r0 * 1.1);
      gr.addColorStop(0, `rgba(255,250,230,${(0.95 * tw).toFixed(2)})`);
      gr.addColorStop(0.7, 'rgba(255,240,200,0.35)');
      gr.addColorStop(1, 'rgba(255,240,200,0)');
      c.fillStyle = gr;
      c.beginPath(); c.arc(cx0, cy0, r0 * 1.1, 0, Math.PI * 2); c.fill();
      // 亮环峰位于第一暗环半径的 1.34 / 2.19 / 3.03 倍（Airy 强度极大值）
      for (const [k, f] of [[1, 1.34], [2, 2.19], [3, 3.03]] as const) {
        c.strokeStyle = `rgba(226,232,240,${0.28 / k})`;
        c.lineWidth = 2;
        c.beginPath(); c.arc(cx0, cy0, r0 * f, 0, Math.PI * 2); c.stroke();
      }
      c.fillStyle = '#f8fafc'; c.font = '15px sans-serif'; c.textAlign = 'center';
      c.fillText(`D=${Ds[i]} m`, cx0, 262);
      c.fillStyle = '#94a3b8';
      c.fillText(`θ≈${(0.138 / Ds[i]).toFixed(3)}″`, cx0, 282);
      c.textAlign = 'left';
    }
    c.fillStyle = '#f8fafc'; c.font = '15px sans-serif';
    c.fillText('像面艾里斑对照：斑半径严格 ∝ 1.22λ/D（同一角标尺）', 16, 24);
    cmp.tex.needsUpdate = true;
  }
  drawCmp(0, 1, 0.5);
  // —— 自适应光学示意（AO）：畸变波前 → 变形镜分段校正 → 残余波前（与像面晕同源）——
  const ao = makeCanvasPlane(bag, THREE, 340, 190, 3.4, [4.7, -1.7, 0]);
  g.add(ao.m);
  function drawAO(corr: number, resid: number): void {
    const c = ao.c;
    c.fillStyle = 'rgba(7,11,20,0.9)'; c.fillRect(0, 0, 340, 190);
    c.strokeStyle = '#334155'; c.lineWidth = 2; c.strokeRect(1.5, 1.5, 337, 187);
    c.fillStyle = '#f8fafc'; c.font = 'bold 16px sans-serif'; c.textAlign = 'center';
    c.fillText('自适应光学：畸变波前 → 变形镜 → 校平', 170, 24);
    c.textAlign = 'left';
    const A = 13; // 大气畸变幅度（px，示意）
    // 入射畸变波前（竖线摆动）
    c.strokeStyle = 'rgba(251,191,24,0.9)'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 20; i++) {
      const y = 46 + i * 6.4;
      const x = 62 + A * Math.sin(y * 0.085 + 0.6) * Math.sin(y * 0.031);
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();
    // 变形镜：分段反向凸出（补偿 -corr·畸变）
    for (let s = 0; s < 7; s++) {
      const y = 50 + s * 18;
      const off = -corr * A * Math.sin(y * 0.085 + 0.6) * Math.sin(y * 0.031);
      c.fillStyle = 'rgba(148,163,184,0.85)';
      c.fillRect(150 + off, y, 9, 15);
    }
    c.fillStyle = '#94a3b8'; c.font = '13px sans-serif';
    c.fillText('变形镜', 140, 182);
    // 出射残余波前（校正度越高越平）
    c.strokeStyle = 'rgba(34,197,94,0.95)'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 20; i++) {
      const y = 46 + i * 6.4;
      const x = 252 + A * resid * Math.sin(y * 0.085 + 0.6) * Math.sin(y * 0.031);
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();
    c.fillStyle = '#fbbf24'; c.font = '13px sans-serif';
    c.fillText(`校正 ${(corr * 100).toFixed(0)}%`, 40, 40);
    c.fillText(`残余 ${(THETA_SEE * resid).toFixed(2)}″`, 240, 40);
    ao.tex.needsUpdate = true;
  }
  drawAO(0.5, 0.5);
  g.add(panelSprite(THREE, bag, [
    { text: 'θ_min = 1.22λ/D：口径 D 越大，艾里斑越小、分辨本领越高', color: '#f8fafc' },
    { text: 'λ=550nm：D=0.5/1/2/4 m → θ≈0.28″/0.14″/0.07″/0.035″', color: '#94a3b8' },
    { text: '地面受视宁度 ~0.5″ 限制；自适应光学（右下）校平波前才达衍射极限', color: '#fbbf24' },
  ], [0, 4.6, 0], 7.8, 'center'));
  let lastB = -1;
  return (t: number, dt: number) => {
    void dt;
    const hi = Math.floor(t * 0.5) % 4;
    lenses.forEach((l, i) => {
      (l.material as import('three').MeshStandardMaterial).emissiveIntensity = i === hi ? 0.9 : 0.15;
    });
    // AO 校正度与大气残余：同一 resid 驱动像面晕与出射波前（读数/几何同源）
    const corr = 0.5 + 0.5 * Math.sin(t * 0.35);
    const resid = (0.75 + 0.25 * Math.sin(t * 2.3)) * (1 - 0.85 * corr);
    const b = Math.floor(t * 6);
    if (b !== lastB) {
      lastB = b;
      drawCmp(hi, 0.85 + 0.15 * Math.sin(t * 5), resid);
      drawAO(corr, resid);
    }
  };
}

/** P283 太阳观测：黑子/谱斑 + 耀斑环 + 磁图面板 */
function build_sun(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title; // 单知识点 variant，无二次分支
  const sunGrp = new THREE.Group();
  sunGrp.position.set(-2.2, 1.4, 0);
  g.add(sunGrp);
  // 光球纹理：米粒组织 + 黑子对 + 谱斑亮区
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 256;
  const cc = cv.getContext('2d')!;
  const img = cc.createImageData(512, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 512; x++) {
      const gran = 0.72 + 0.28 * (0.5 + 0.5 * fbm2(x * 0.09, y * 0.09));
      const idx = (y * 512 + x) * 4;
      img.data[idx] = Math.round(255 * gran);
      img.data[idx + 1] = Math.round(175 * gran);
      img.data[idx + 2] = Math.round(60 * gran);
      img.data[idx + 3] = 255;
    }
  }
  cc.putImageData(img, 0, 0);
  // 黑子对（本影黑+半影褐）
  function spot(x0: number, y0: number, s: number): void {
    cc.fillStyle = 'rgba(120,53,15,0.75)';
    cc.beginPath(); cc.ellipse(x0, y0, 26 * s, 15 * s, 0.2, 0, Math.PI * 2); cc.fill();
    cc.fillStyle = 'rgba(10,10,14,0.95)';
    cc.beginPath(); cc.ellipse(x0, y0, 13 * s, 8 * s, 0.2, 0, Math.PI * 2); cc.fill();
  }
  spot(190, 120, 1); spot(232, 132, 0.7);
  spot(392, 96, 0.8); spot(424, 104, 0.55);
  // 谱斑（黑子周围的亮区）
  cc.fillStyle = 'rgba(255,246,200,0.35)';
  cc.beginPath(); cc.ellipse(210, 118, 52, 26, 0.2, 0, Math.PI * 2); cc.fill();
  cc.beginPath(); cc.ellipse(408, 100, 40, 20, 0.2, 0, Math.PI * 2); cc.fill();
  const sunTex = bag.tex(new THREE.CanvasTexture(cv));
  sunTex.wrapS = THREE.RepeatWrapping;
  const sun = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(2.4, 44, 30)),
    bag.mat(new THREE.MeshBasicMaterial({ map: sunTex })),
  );
  sunGrp.add(sun);
  // 耀斑环（磁拱：三个日面倾斜环，周期增亮）
  const loops: import('three').Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const lp = new THREE.Mesh(
      bag.geo(new THREE.TorusGeometry(0.55 + i * 0.18, 0.05, 8, 26, Math.PI)),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.pink, emissive: 0xf472b6, emissiveIntensity: 0.4 })),
    );
    const az = 1.2 + i * 0.55;
    lp.position.set(Math.cos(az) * 2.3, Math.sin(az) * 0.6 + 0.9, Math.sin(az) * 2.3);
    lp.rotation.z = -az;
    lp.rotation.y = 0.4 * i;
    sunGrp.add(lp);
    loops.push(lp);
  }
  // 临边放大示意环（日冕底环，注明非日冕仪场景）
  const limb = new THREE.Mesh(
    bag.geo(new THREE.RingGeometry(2.44, 2.62, 48)),
    bag.mat(new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0.18, side: THREE.DoubleSide })),
  );
  sunGrp.add(limb);
  // 磁图面板：± 极性双极区 + 磁力线
  const mag = makePlot(bag, THREE, 330, 260, 3.6, [5.4, 1.4, 0]);
  g.add(mag.m);
  function drawMag(t: number): void {
    const c = mag.frame('纵场磁图 ±0.15 T（红+ 蓝−）', '视直径', 'B');
    const W = mag.W, H = mag.H;
    const cx0 = W * 0.42, cy0 = H * 0.52;
    const patch = (px: number, py: number, col: string) => {
      const gr = c.createRadialGradient(px, py, 2, px, py, 40);
      gr.addColorStop(0, col);
      gr.addColorStop(1, 'rgba(7,11,20,0)');
      c.fillStyle = gr;
      c.beginPath(); c.arc(px, py, 40, 0, Math.PI * 2); c.fill();
    };
    patch(cx0 - 34, cy0, 'rgba(239,68,68,0.85)');
    patch(cx0 + 34, cy0 + 8, 'rgba(59,130,246,0.85)');
    patch(W * 0.75, cy0 - 24, 'rgba(239,68,68,0.5)');
    patch(W * 0.82, cy0 + 14, 'rgba(59,130,246,0.5)');
    // 磁力线拱（随时间流动）
    c.strokeStyle = 'rgba(248,250,252,0.5)'; c.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      c.setLineDash([6, 8]); c.lineDashOffset = -t * 14 - k * 3;
      c.beginPath();
      c.arc(cx0, cy0 + 8, 26 + k * 12, Math.PI * 1.05, Math.PI * 1.95);
      c.stroke();
    }
    c.setLineDash([]);
    c.fillStyle = '#94a3b8'; c.font = '14px sans-serif';
    c.fillText('黑子=强磁场抑制对流 → 4000K 偏暗', 54, H - 30);
    mag.tex.needsUpdate = true;
  }
  drawMag(0);
  // 全日面光晕
  const halo = new THREE.Mesh(
    bag.geo(new THREE.CircleGeometry(2.9, 40)),
    bag.mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.1 })),
  );
  halo.position.set(-2.2, 1.4, -2.5);
  g.add(halo);
  g.add(panelSprite(THREE, bag, [
    { text: '黑子：磁通量管(0.1–0.4 T)抑制对流，T≈4000K < 光球5800K', color: '#f8fafc' },
    { text: '耀斑环：磁重联释放能量；谱斑与磁网络共位（Hα/磁图）', color: '#94a3b8' },
    { text: '读数：磁图红+蓝−双极区，耀斑环周期性增亮（示意）', color: '#fbbf24' },
  ], [0, 4.6, 0], 7.8, 'center'));
  let lastB = -1;
  return (t: number, dt: number) => {
    void dt;
    sunGrp.rotation.y = t * 0.05; // 较差自转示意（整体）
    sunTex.offset.x = t * 0.002;
    loops.forEach((lp, i) => {
      const fl = Math.max(0, Math.sin(t * 0.7 + i * 2.1)) ** 8;
      (lp.material as import('three').MeshStandardMaterial).emissiveIntensity = 0.3 + fl * 2.2;
      lp.scale.setScalar(1 + fl * 0.5);
    });
    (halo.material as import('three').MeshBasicMaterial).opacity = 0.08 + 0.05 * Math.sin(t * 0.8);
    const b = Math.floor(t * 5);
    if (b !== lastB) { lastB = b; drawMag(t); }
  };
}

/** P348 X 射线衰减成像：锥束 + 阶梯模体 + I=I0·e^(−μx) 灰度对照 */
function build_xray(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
): (t: number, dt: number) => void {
  void title; // 单知识点 variant，无二次分支
  const srcPos = new THREE.Vector3(-6.2, 1.1, 0);
  // 球管（阴极靶）
  const housing = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(1.2, 0.8, 0.8)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6 })),
  );
  housing.position.set(srcPos.x - 0.8, srcPos.y, srcPos.z);
  g.add(housing);
  const focal = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.16, 12, 10)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: 0xfbbf24, emissiveIntensity: 1 })),
  );
  focal.position.copy(srcPos);
  g.add(focal);
  // 阶梯模体：三列（空气 / 软组织 / 软组织+骨），沿束路径
  const cols = [
    { name: '气', z: -1.1, mats: [{ x0: -1.2, len: 1.8, mu: 0.0002, col: 0x1d4ed8, op: 0.05 }] },
    { name: '软组织', z: 0, mats: [{ x0: -0.6, len: 2.0, mu: 0.2, col: 0xdb2777, op: 0.3 }] },
    { name: '骨', z: 1.1, mats: [
      { x0: 1.8, len: 1.1, mu: 0.2, col: 0xdb2777, op: 0.3 },
      { x0: 2.1, len: 0.7, mu: 1.1, col: 0xf1f5f9, op: 0.95 },
    ] },
  ];
  for (const col of cols) {
    for (const mm of col.mats) {
      const m = new THREE.Mesh(
        bag.geo(new THREE.BoxGeometry(mm.len, 2.2, 0.85)),
        bag.mat(new THREE.MeshStandardMaterial({ color: mm.col, transparent: true, opacity: mm.op })),
      );
      m.position.set(mm.x0 + mm.len / 2, 1.1, col.z);
      g.add(m);
    }
  }
  // 探测器板
  const det = new THREE.Mesh(
    bag.geo(new THREE.BoxGeometry(0.25, 2.6, 3.4)),
    bag.mat(new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x1e293b, emissiveIntensity: 0.4 })),
  );
  det.position.set(3.7, 1.1, 0);
  g.add(det);
  // 锥束边界 + 三条中心线
  for (const edge of [1.2, -1.2]) {
    g.add(lineFrom(THREE, bag, [srcPos, new THREE.Vector3(3.7, 1.1 + edge, 0)], PAL.white, true));
  }
  const beamLines = cols.map((col) => {
    const ln = lineFrom(THREE, bag, [srcPos, new THREE.Vector3(3.6, 1.1, col.z)], PAL.cyan);
    g.add(ln);
    return ln;
  });
  void beamLines;
  // 光子点（穿骨后变暗变小 = 强度衰减示意）
  const pGeo = bag.geo(new THREE.SphereGeometry(0.08, 8, 8));
  const pMat = bag.mat(new THREE.MeshBasicMaterial({ color: 0xfef9c3 }));
  const dots = cols.map(() => {
    const m = new THREE.Mesh(pGeo, pMat);
    g.add(m);
    return m;
  });
  // 投影灰度画布 + 指数衰减曲线画布
  const proj = makeCanvasPlane(bag, THREE, 320, 220, 3.4, [5.7, 2.8, 0]);
  g.add(proj.m);
  const curve = makePlot(bag, THREE, 320, 240, 3.4, [5.7, -0.6, 0]);
  g.add(curve.m);
  const muBone = (kv: number): number => 66 / kv; // cm⁻¹ 量级示意（60kV→1.1, 120kV→0.55）
  function trans(kV: number, kind: number): number {
    if (kind === 0) return Math.exp(-0.0002 * 1.8);
    if (kind === 1) return Math.exp(-0.2 * 2.0);
    return Math.exp(-(0.2 * 1.1 + muBone(kV) * 0.7));
  }
  function drawProj(kV: number): void {
    const c = proj.c;
    c.fillStyle = '#050810'; c.fillRect(0, 0, 320, 220);
    c.strokeStyle = '#334155'; c.lineWidth = 3; c.strokeRect(2, 2, 316, 216);
    const names = ['空气', '软组织', '软组织+骨'];
    for (let i = 0; i < 3; i++) {
      const I = trans(kV, i);
      const g0 = Math.round(40 + 215 * I);
      c.fillStyle = `rgb(${g0},${g0},${g0})`;
      c.fillRect(20, 22 + i * 60, 200, 48);
      c.fillStyle = '#0f172a'; c.font = '15px sans-serif';
      c.fillText(`${names[i]}  I/I₀=${I.toFixed(2)}`, 26, 50 + i * 60);
    }
    c.fillStyle = '#94a3b8'; c.font = '14px sans-serif';
    c.fillText(`kV=${kV.toFixed(0)}  越亮=穿透越多`, 20, 214);
    proj.tex.needsUpdate = true;
  }
  function drawCurve(kV: number): void {
    const c = curve.frame(`指数衰减 kV=${kV.toFixed(0)}`, '厚度 x (cm)', 'I/I₀');
    const W = curve.W, H = curve.H;
    const tr = (mu: number, col: string): void => {
      c.strokeStyle = col; c.lineWidth = 3; c.beginPath();
      for (let i = 0; i <= 120; i++) {
        const x = (i / 120) * 6;
        const px = 46 + (x / 6) * (W - 62);
        const py = (H - 44) - Math.exp(-mu * x) * (H - 84);
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
    };
    tr(muBone(kV), '#e2e8f0');
    tr(0.2, '#f472b6');
    tr(0.0002, '#60a5fa');
    c.fillStyle = '#94a3b8'; c.font = '13px sans-serif';
    c.fillText('I = I₀·e^{−μx}', 60, 40);
    c.fillText('白=骨 粉=软组织 蓝=空气', 60, H - 30);
    curve.tex.needsUpdate = true;
  }
  drawProj(90); drawCurve(90);
  g.add(panelSprite(THREE, bag, [
    { text: 'I = I₀·e^{−μx}：μ 依赖能量与 Z，骨低能时光电占优、对比强', color: '#f8fafc' },
    { text: '阶梯模体：同一 I₀ 下灰阶 ∝ ln(I/I₀)（空气亮、骨暗）', color: '#94a3b8' },
    { text: '读数：kV 60→120 扫描，骨对比度随 μ_骨↓ 而下降（示意）', color: '#fbbf24' },
  ], [0, 4.6, 0], 7.8, 'center'));
  let lastB = -1;
  return (t: number, dt: number) => {
    void dt;
    const kV = 90 + 30 * Math.sin(t * 0.25);
    (focal.material as import('three').MeshStandardMaterial).emissiveIntensity = 0.7 + 0.3 * Math.abs(Math.sin(t * 9));
    for (let i = 0; i < 3; i++) {
      const u = ((t * 0.55) + i * 0.33) % 1;
      const x = srcPos.x + u * (3.6 - srcPos.x);
      const inBone = i === 2 && x > 2.1 && x < 2.8;
      dots[i].position.set(x, 1.1, cols[i].z);
      dots[i].scale.setScalar(inBone ? 0.45 : 1);
      dots[i].visible = u < 0.97;
    }
    const b = Math.floor(t * 4);
    if (b !== lastB) { lastB = b; drawProj(kV); drawCurve(kV); }
  };
}
