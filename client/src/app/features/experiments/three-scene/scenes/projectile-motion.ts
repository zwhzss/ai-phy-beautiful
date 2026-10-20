import type { SceneContext, SceneInstance } from '../types';
/** 抛体运动（P01）：含空气阻力的弹道轨迹。
 *  ① 无阻力：R = v₀²·sin2θ/g，最大高度 H_max = v₀²·sin²θ/(2g)
 *  ② 有阻力：dv/dt = −g ŷ − k·|v|·v（二次阻力，数值积分，k=0.05）
 *  画面：抛射角 θ 在 16 s 内 20°→80° 周期扫描——主轨迹（虚线=无阻尼、实线=有阻尼）、
 *  发射方向指示、落点环与峰顶标记（紫点+紫竖线=H_max）全部随 θ 原位重算重画；
 *  侧视角度族 30/45/60/75°（无阻力）保持静态对照，45°★ 最远；面板按 5Hz 输出同源读数。 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const starGeo = new THREE.BufferGeometry();
  const starPts: import('three').Vector3[] = [];
  for (let i = 0; i < 500; i++) starPts.push(new THREE.Vector3((Math.random()-0.5)*200,(Math.random()-0.5)*200,(Math.random()-0.5)*200));
  starGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(starPts.flatMap(v=>[v.x,v.y,v.z])),3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true });
  group.add(new THREE.Points(starGeo, starMat));
  group.add(new THREE.GridHelper(20, 20, 0x334155, 0x1e293b));

  // Launch parameters（θ 为扫描自变量；v₀、g、k 固定）
  const v0 = 20;
  const g = 9.8;
  const dragCoeff = 0.05;
  let thetaDeg = 60;
  const MAXPTS = 320;

  // 数值弹道：积分结果原位写入预分配 Float32Array（世界尺度 ×2），返回点数与峰顶索引
  function fillTrajectory(angleRad: number, withDrag: boolean, pos: Float32Array): { n: number; apex: number } {
    let x = 0, y = 0, z = 0;
    let vx = v0 * Math.cos(angleRad) * Math.cos(30 * Math.PI / 180);
    let vy = v0 * Math.sin(angleRad);
    let vz = v0 * Math.cos(angleRad) * Math.sin(30 * Math.PI / 180);
    const dt = 0.02;
    let n = 0, apex = 0;
    for (let t = 0; t < 6 && n < MAXPTS; t += dt) {
      pos[n * 3] = x * 2; pos[n * 3 + 1] = y * 2; pos[n * 3 + 2] = z * 2;
      if (pos[n * 3 + 1] > pos[apex * 3 + 1]) apex = n;
      n++;
      if (withDrag) {
        const speed = Math.sqrt(vx*vx + vy*vy + vz*vz);
        vx -= dragCoeff * speed * vx * dt;
        vy -= (g + dragCoeff * speed * vy) * dt;
        vz -= dragCoeff * speed * vz * dt;
      } else {
        vy -= g * dt;
      }
      x += vx * dt;
      y += vy * dt;
      z += vz * dt;
      if (y < 0 && t > 0) break;
    }
    return { n, apex };
  }

  // No-drag trajectory (dashed, white)——随 θ 原位重画
  const noDragPos = new Float32Array(MAXPTS * 3);
  const noDragGeo = new THREE.BufferGeometry();
  noDragGeo.setAttribute('position', new THREE.BufferAttribute(noDragPos, 3));
  const noDragMat = new THREE.LineDashedMaterial({ color: 0x94a3b8, gapSize: 0.3 });
  const noDragLine = new THREE.Line(noDragGeo, noDragMat);
  group.add(noDragLine);

  // With-drag trajectory (solid, orange)
  const dragPos = new Float32Array(MAXPTS * 3);
  const withDragGeo = new THREE.BufferGeometry();
  withDragGeo.setAttribute('position', new THREE.BufferAttribute(dragPos, 3));
  const withDragMat = new THREE.LineBasicMaterial({ color: 0xfb923c });
  const withDragLine = new THREE.Line(withDragGeo, withDragMat);
  group.add(withDragLine);

  // Projectile sphere
  const ballGeo = new THREE.SphereGeometry(0.3, 16, 16);
  const ballMat = new THREE.MeshBasicMaterial({ color: 0xf472b6 });
  const ball = new THREE.Mesh(ballGeo, ballMat);
  group.add(ball);

  // Launch angle indicator（随 θ 原位更新）
  const angleGeo = new THREE.BufferGeometry();
  angleGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const angleMat = new THREE.LineBasicMaterial({ color: 0x4ade80 });
  group.add(new THREE.Line(angleGeo, angleMat));

  // Ground marker（落点环，随 θ 原位更新）
  const markerGeo = new THREE.RingGeometry(0.15, 0.25, 16);
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide });
  const landingMarker = new THREE.Mesh(markerGeo, markerMat);
  landingMarker.rotation.x = -Math.PI / 2;
  group.add(landingMarker);

  // 峰顶标记：紫点=抛物线顶点、紫竖线=H_max（高度由无阻力数值曲线给出）
  const apexDot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshBasicMaterial({ color: 0xa855f7 }));
  group.add(apexDot);
  const hLineGeo = new THREE.BufferGeometry();
  hLineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const hLine = new THREE.Line(hLineGeo, new THREE.LineBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.75 }));
  group.add(hLine);

  // —— 最佳抛射角：同 v₀ 下的角度扫描轨迹族（无阻力，x–y 平面侧视）——
  const familyScale = 0.2;
  const familyAngles = [30, 45, 60, 75];
  function rangeNoDrag(deg: number): number {
    return (v0 * v0 * Math.sin(2 * deg * Math.PI / 180)) / g; // R = v₀²sin2θ/g
  }
  const maxRange = rangeNoDrag(45);
  familyAngles.forEach((deg) => {
    const rad = deg * Math.PI / 180;
    const tf = (2 * v0 * Math.sin(rad)) / g;
    const pts: import('three').Vector3[] = [];
    const steps = 90;
    for (let i = 0; i <= steps; i++) {
      const tt = (i / steps) * tf;
      const xx = v0 * Math.cos(rad) * tt;
      const yy = v0 * Math.sin(rad) * tt - 0.5 * g * tt * tt;
      pts.push(new THREE.Vector3(xx * familyScale, yy * familyScale, 0));
    }
    const isBest = deg === 45;
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: isBest ? 0x4ade80 : 0x64748b,
      transparent: true,
      opacity: isBest ? 1 : 0.6,
    });
    group.add(new THREE.Line(geo, mat));
    // 落点标记
    const dotGeo = new THREE.SphereGeometry(0.12, 10, 10);
    const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: isBest ? 0x4ade80 : 0x94a3b8 }));
    dot.position.set(rangeNoDrag(deg) * familyScale, 0.05, 0);
    group.add(dot);
  });

  // “45° 最远” 标签
  function makeLabel(text: string, color: string): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 30px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 128, 32);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
    s.scale.set(3, 0.75, 1);
    return s;
  }
  const bestLabel = makeLabel('45° 最远', '#4ade80');
  bestLabel.position.set(maxRange * familyScale + 0.6, 1.4, 0);
  group.add(bestLabel);

  // —— 信息面板（θ 扫描动态读数：R / H_max / 有阻力射程，5Hz 刷新）——
  const panelCanvas = document.createElement('canvas');
  panelCanvas.width = 460;
  panelCanvas.height = 262;
  const panelCtx = panelCanvas.getContext('2d')!;
  const panelTex = new THREE.CanvasTexture(panelCanvas);
  const panelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(5.98, 3.4),
    new THREE.MeshBasicMaterial({ map: panelTex, transparent: true }),
  );
  panelMesh.position.set(0, 5.6, 0);
  group.add(panelMesh);

  let noDragN = 0, dragN = 0, rDragM = 0, rNoM = 0, hMaxM = 0;
  function rebuild(): void {
    const rad = thetaDeg * Math.PI / 180;
    const nd = fillTrajectory(rad, false, noDragPos);
    noDragN = nd.n;
    noDragGeo.attributes['position'].needsUpdate = true;
    noDragGeo.setDrawRange(0, noDragN);
    noDragLine.computeLineDistances();
    const dr = fillTrajectory(rad, true, dragPos);
    dragN = dr.n;
    withDragGeo.attributes['position'].needsUpdate = true;
    withDragGeo.setDrawRange(0, dragN);
    const li = (dragN - 1) * 3;
    landingMarker.position.set(dragPos[li], 0.01, dragPos[li + 2]);
    rDragM = Math.hypot(dragPos[li], dragPos[li + 2]) / 2;
    rNoM = (v0 * v0 * Math.sin(2 * rad)) / g;                        // R = v₀²·sin2θ/g
    hMaxM = (v0 * v0 * Math.sin(rad) * Math.sin(rad)) / (2 * g);     // H_max = v₀²sin²θ/(2g)
    const ai = nd.apex * 3;
    apexDot.position.set(noDragPos[ai], noDragPos[ai + 1], noDragPos[ai + 2]);
    const hp = hLineGeo.attributes['position'].array as Float32Array;
    hp[0] = apexDot.position.x; hp[1] = 0.02; hp[2] = apexDot.position.z;
    hp[3] = apexDot.position.x; hp[4] = apexDot.position.y; hp[5] = apexDot.position.z;
    hLineGeo.attributes['position'].needsUpdate = true;
    const ap = angleGeo.attributes['position'].array as Float32Array;
    ap[3] = 2 * Math.cos(rad) * Math.cos(30 * Math.PI / 180);
    ap[4] = 2 * Math.sin(rad);
    ap[5] = 2 * Math.cos(rad) * Math.sin(30 * Math.PI / 180);
    angleGeo.attributes['position'].needsUpdate = true;
  }

  function drawPanel() {
    panelCtx.fillStyle = 'rgba(7,11,20,0.9)';
    panelCtx.fillRect(0, 0, 460, 262);
    panelCtx.textAlign = 'left';
    panelCtx.fillStyle = '#f8fafc';
    panelCtx.font = 'bold 17px monospace';
    panelCtx.fillText('抛体运动 — θ=20°→80° 周期扫描', 14, 26);
    panelCtx.fillStyle = '#7dd3fc';
    panelCtx.font = '15px monospace';
    panelCtx.fillText(`v₀ = ${v0.toFixed(1)} m/s   g = ${g.toFixed(1)} m/s²   θ = ${thetaDeg.toFixed(1)}°`, 14, 52);
    panelCtx.fillStyle = '#a855f7';
    panelCtx.fillText('R = v₀²·sin2θ/g    H_max = v₀²·sin²θ/(2g)', 14, 78);
    panelCtx.fillStyle = '#e2e8f0';
    panelCtx.fillText(
      `θ=30°:${rangeNoDrag(30).toFixed(1)}  45°:${rangeNoDrag(45).toFixed(1)}★  60°:${rangeNoDrag(60).toFixed(1)}  75°:${rangeNoDrag(75).toFixed(1)} m`,
      14, 104);
    panelCtx.fillStyle = '#4ade80';
    panelCtx.fillText('θ=45° 时 sin2θ=1 ⇒ 射程最大（R(30°)=R(60°)）', 14, 130);
    panelCtx.fillStyle = '#fbbf24';
    panelCtx.font = 'bold 16px monospace';
    panelCtx.fillText(`读数：R无阻尼=${rNoM.toFixed(1)} m  H_max=${hMaxM.toFixed(1)} m`, 14, 158);
    panelCtx.fillStyle = '#fb923c';
    panelCtx.font = '15px monospace';
    panelCtx.fillText(`有阻力：R≈${rDragM.toFixed(1)} m < 无阻力 ${rNoM.toFixed(1)} m（k=0.05）`, 14, 184);
    panelCtx.fillStyle = '#94a3b8';
    panelCtx.font = '11px sans-serif';
    panelCtx.fillText('紫点=当前 θ 抛物线峰顶，紫竖线=H_max；灰虚线=无阻尼、橙实线=有阻力', 14, 206);
    panelCtx.fillText('绿色轨迹 = 45°（射程最远）；灰线 = 30/60/75°（无阻力角度族，侧视）', 14, 224);
    panelTex.needsUpdate = true;
  }
  rebuild();
  drawPanel();

  let lastDeg = -1;
  return {
    update(t, dt) {
      const ph = (t % 16) / 16;
      thetaDeg = 20 + 60 * (0.5 - 0.5 * Math.cos(2 * Math.PI * ph));   // 20→80→20° 扫描
      if (Math.round(thetaDeg) !== lastDeg) { lastDeg = Math.round(thetaDeg); rebuild(); }
      const progress = (Math.sin(t * 0.8) * 0.5 + 0.5) * dragN;
      const idx = Math.min(Math.max(Math.floor(progress), 0), dragN - 1);
      ball.position.set(dragPos[idx * 3], dragPos[idx * 3 + 1] + 0.3, dragPos[idx * 3 + 2]);
      group.rotation.y = Math.sin(t * 0.15) * 0.2;
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawPanel();
    },
    dispose() {
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
          (obj as any).geometry?.dispose();
          const mat = (obj as any).material;
          if (Array.isArray(mat)) mat.forEach((m: any) => m.dispose());
          else if (mat) mat.dispose();
        }
      });
      starGeo.dispose(); starMat.dispose();
      panelTex.dispose();
    }
  };
}
