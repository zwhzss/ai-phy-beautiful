import type { SceneContext, SceneInstance } from '../types';
/**
 * 共振特斯拉线圈（P306）—— 两回路调到同频，靠互感把能量"跳"过去，隔空点亮氖管：
 *   初级回路 L₁C₁：火花隙放电给出驱动频率 f₁（本场景随时间缓慢扫描 ±10%）
 *   次级回路 L₂C₂：固有频率 f₂ = 1/√(L₂C₂)（固定 300 kHz），品质因数 Q 决定放大与峰宽
 *   谐振响应（教学近似）A(f) = 1/√((1−(f/f₂)²)² + (f/(f₂Q))²)，归一化后 A(f₂) = 1
 *   次级电流 I₂ ∝ Q·M·I₁·ω / |…|：f₁ → f₂ 时 I₂ 按 Q 放大 → 顶端场强/电弧增强 → 点亮氖管
 *   要点：互感 M（初/次级无导线相连）、谐振（f₁ = f₂，峰宽 Δf ≈ f₂/Q）、高频高压（ε = −L·dI/dt）
 */
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

  // Base platform
  const baseGeo = new THREE.CylinderGeometry(3, 3.5, 0.3, 32);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.1, roughness: 0.8 });
  group.add(new THREE.Mesh(baseGeo, baseMat));

  // Primary coil (bottom toroid)
  const primaryGeo = new THREE.TorusGeometry(1.2, 0.15, 16, 32);
  const primaryMat = new THREE.MeshStandardMaterial({ color: 0x92400e, emissive: 0x78350f, emissiveIntensity: 0.2 });
  const primaryCoil = new THREE.Mesh(primaryGeo, primaryMat);
  primaryCoil.position.y = 0.5;
  group.add(primaryCoil);

  // Secondary coil (tall solenoid)
  const coilTurns = 40;
  const coilRadius = 0.8;
  const coilHeight = 6;
  // 匝间发光材质（收集起来按次级电流 I₂ 调制）
  const turnMats: import('three').MeshStandardMaterial[] = [];
  for (let i = 0; i < coilTurns; i++) {
    const t = i / coilTurns;
    const angle = t * Math.PI * 12;
    const y = 0.5 + t * coilHeight;
    const x = Math.cos(angle) * coilRadius;
    const z = Math.sin(angle) * coilRadius;
    const turnGeo = new THREE.TorusGeometry(coilRadius, 0.04, 8, 32);
    const turnMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.15 });
    turnMats.push(turnMat);
    const turn = new THREE.Mesh(turnGeo, turnMat);
    turn.position.set(x, y, z);
    turn.rotation.y = angle;
    group.add(turn);
  }

  // Top load (toroid)
  const topLoadGeo = new THREE.TorusGeometry(1.0, 0.25, 16, 32);
  const topLoadMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.3, roughness: 0.5 });
  const topLoad = new THREE.Mesh(topLoadGeo, topLoadMat);
  topLoad.position.y = coilHeight + 0.5;
  group.add(topLoad);

  // Spark arcs from top load
  const arcCount = 8;
  const arcs: import('three').Line[] = [];
  const arcMats: import('three').LineBasicMaterial[] = [];
  for (let i = 0; i < arcCount; i++) {
    const arcPts: import('three').Vector3[] = [];
    const baseAngle = (i / arcCount) * Math.PI * 2;
    arcPts.push(new THREE.Vector3(Math.cos(baseAngle) * 1.0, coilHeight + 0.5, Math.sin(baseAngle) * 1.0));
    for (let j = 1; j <= 8; j++) {
      const t = j / 8;
      arcPts.push(new THREE.Vector3(
        Math.cos(baseAngle) * (1.0 + t * 2.5) + (Math.random() - 0.5) * 0.5,
        coilHeight + 0.5 - t * 3.0,
        Math.sin(baseAngle) * (1.0 + t * 2.5) + (Math.random() - 0.5) * 0.5
      ));
    }
    const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPts);
    const arcMat = new THREE.LineBasicMaterial({ color: 0xa5f3fc, transparent: true, opacity: 1 });
    arcMats.push(arcMat);
    const arc = new THREE.Line(arcGeo, arcMat);
    group.add(arc);
    arcs.push(arc);
  }

  // Glow sphere at top
  const glowGeo = new THREE.SphereGeometry(1.5, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.08 });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.y = coilHeight - 0.5;
  group.add(glow);

  // 顶端场强随次级电流增强（顶载/分布电容 C₂）
  topLoadMat.emissive = new THREE.Color(0x7dd3fc);
  topLoadMat.emissiveIntensity = 0;

  // —— 谐振参数：两条 LC 回路调到同频 ——
  const F2 = 300;            // 次级固有频率 f₂（kHz）：f₂ = 1/√(L₂C₂)
  const Q = 40;              // 次级回路品质因数 Q：谐振放大倍数、峰宽 Δf ≈ f₂/Q
  const SWEEP_T = 14;        // 驱动频率 f₁ 扫描周期（s）
  const SWEEP_A = 0.10;      // 扫描幅度（±10% 失谐）
  /** 归一化谐振响应 A(f) = [1/√((1−(f/f₂)²)²+(f/(f₂Q))²)] / Q，f = f₂ 时 A = 1（未归一峰值 ≈ Q） */
  const resp = (f: number): number => {
    const r = f / F2;
    return 1 / (Q * Math.sqrt((1 - r * r) * (1 - r * r) + (r / Q) * (r / Q)));
  };
  let f1 = F2, amp = 0, detune = 0;   // 每帧刷新的读数（面板与标签共用）

  // —— 文字标签 helper ——
  const texs: import('three').Texture[] = [];
  function makeLabel(text: string, color: string, scale = 3): import('three').Sprite {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 24px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const map = new THREE.CanvasTexture(cv); texs.push(map);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true }));
    s.scale.set(scale, scale / 8, 1); return s;
  }
  /** 可变读数标签：f₁ 随扫描变化，低频重绘 */
  function makeDynLabel(text: string, color: string, scale = 3) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    const map = new THREE.CanvasTexture(cv); texs.push(map);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true }));
    s.scale.set(scale, scale / 8, 1);
    const setText = (t: string): void => {
      c.clearRect(0, 0, 512, 64);
      c.fillStyle = color; c.font = 'bold 24px "PingFang SC", sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, 256, 32);
      map.needsUpdate = true;
    };
    setText(text);
    return { sprite: s, setText };
  }

  // —— 初/次级两条 LC 回路示意（左侧）——
  const LC_X0 = -8.6, LC_X1 = -4.4, LC_GAP = 0.26;
  const LC_CX = (LC_X0 + LC_X1) / 2;
  /** 矩形回路导线（顶边中央留出电容间隙） */
  function loopLine(y0: number, y1: number, color: number): import('three').Line {
    const pts = [
      new THREE.Vector3(LC_CX + LC_GAP, y1, 0),
      new THREE.Vector3(LC_X1, y1, 0),
      new THREE.Vector3(LC_X1, y0, 0),
      new THREE.Vector3(LC_X0, y0, 0),
      new THREE.Vector3(LC_X0, y1, 0),
      new THREE.Vector3(LC_CX - LC_GAP, y1, 0),
    ];
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color }));
    group.add(l); return l;
  }
  /** 电容符号：顶边间隙处两块极板 */
  function capPlates(y1: number, color: number): void {
    [-1, 1].forEach((sgn) => {
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(LC_CX + sgn * LC_GAP * 0.45, y1 - 0.24, 0),
        new THREE.Vector3(LC_CX + sgn * LC_GAP * 0.45, y1 + 0.24, 0),
      ]);
      group.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color })));
    });
  }
  // 初级回路 L₁C₁（驱动回路：火花隙放电给出 f₁）
  loopLine(3.6, 4.9, 0xf59e0b); capPlates(4.9, 0xf59e0b);
  // 次级回路 L₂C₂（顶载即分布电容 C₂：固有频率 f₂ 固定）
  loopLine(5.5, 6.8, 0x22d3ee); capPlates(6.8, 0x22d3ee);
  const gapSpark = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xfef3c7, transparent: true, opacity: 0.9 }));
  gapSpark.position.set(LC_X0, 4.25, 0); group.add(gapSpark);
  const lPri = makeLabel('初级回路 L₁C₁（驱动）', '#f59e0b', 3.4);
  lPri.position.set(LC_CX, 4.40, 0); group.add(lPri);
  const f1Label = makeDynLabel(`f₁ = ${F2.toFixed(1)} kHz`, '#fde68a', 3.0);
  f1Label.sprite.position.set(LC_CX, 3.85, 0); group.add(f1Label.sprite);
  const lSec = makeLabel('次级回路 L₂C₂（固有）', '#22d3ee', 3.4);
  lSec.position.set(LC_CX, 6.30, 0); group.add(lSec);
  const f2Label = makeLabel(`f₂ = ${F2.toFixed(1)} kHz`, '#a5f3fc', 3.0);
  f2Label.position.set(LC_CX, 5.78, 0); group.add(f2Label);

  // —— 谐振响应曲线（右侧）：I₂/I₂max 随 f₁/f₂ 变化 ——
  const plotX = 6.6, plotBaseY = 1.4, plotW = 4.4, plotH = 3.4;
  const FSPAN = 0.12, PLOT_N = 200;   // 横轴 f₁/f₂ ∈ [1 ± 0.12]
  const curvePos = new Float32Array(PLOT_N * 3);
  for (let i = 0; i < PLOT_N; i++) {
    const r = 1 - FSPAN + (i / (PLOT_N - 1)) * 2 * FSPAN;
    curvePos[i * 3] = plotX + ((r - 1) / FSPAN) * (plotW / 2);
    curvePos[i * 3 + 1] = plotBaseY + resp(r * F2) * plotH;
    curvePos[i * 3 + 2] = 0;
  }
  const curveGeo = new THREE.BufferGeometry();
  curveGeo.setAttribute('position', new THREE.BufferAttribute(curvePos, 3));
  group.add(new THREE.Line(curveGeo, new THREE.LineBasicMaterial({ color: 0x22d3ee })));
  // 坐标轴
  const axisGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(plotX - plotW / 2, plotBaseY, 0), new THREE.Vector3(plotX + plotW / 2, plotBaseY, 0),
    new THREE.Vector3(plotX - plotW / 2, plotBaseY, 0), new THREE.Vector3(plotX - plotW / 2, plotBaseY + plotH, 0),
  ]);
  group.add(new THREE.Line(axisGeo, new THREE.LineBasicMaterial({ color: 0x475569 })));
  // f₁ = f₂ 共振参考线
  const resLineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(plotX, plotBaseY, 0), new THREE.Vector3(plotX, plotBaseY + plotH, 0),
  ]);
  group.add(new THREE.Line(resLineGeo, new THREE.LineBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.5 })));
  // 当前 f₁ 标记
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
  group.add(marker);
  const lPlot = makeLabel('谐振响应 I₂ ∝ Q·M·ω·I₁', '#22d3ee', 4.2);
  lPlot.position.set(plotX, plotBaseY - 0.5, 0); group.add(lPlot);

  // —— 氖管（远离线圈，谐振时隔空点亮）——
  const NEON_X = 9.8, NEON_CY = 3.1;   // 管心位置
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 2.3, 8),
    new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.4, roughness: 0.7 }));
  stand.position.set(NEON_X, 1.15, 0); group.add(stand);
  const neonMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, emissive: 0xff7a45, emissiveIntensity: 0, roughness: 0.4 });
  const neon = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.6, 14), neonMat);
  neon.position.set(NEON_X, NEON_CY, 0); group.add(neon);
  const capGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.12, 14);
  [-0.85, 0.85].forEach((dy) => {
    const cap = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.4 }));
    cap.position.set(NEON_X, NEON_CY + dy, 0); group.add(cap);
  });
  const neonGlow = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0 }));
  neonGlow.position.set(NEON_X, NEON_CY, 0); group.add(neonGlow);
  const lNeon = makeLabel('氖管（隔空点亮）', '#fb923c', 3.6);
  lNeon.position.set(NEON_X, 1.7, 0); group.add(lNeon);

  // —— 耦合场：互感能量从顶端"跳"向氖管（强度随谐振响应）——
  const fieldMats: import('three').LineBasicMaterial[] = [];
  for (let k = 0; k < 3; k++) {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(1.2, 6.4, 0),
      new THREE.Vector3(5.4 + k * 0.5, 8.6 - k * 0.5, (k - 1) * 0.6),
      new THREE.Vector3(NEON_X - 0.4, NEON_CY, 0),
    );
    const m = new THREE.LineBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.05 });
    fieldMats.push(m);
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)), m));
  }

  // —— 信息面板（中文）——
  const infoCv = document.createElement('canvas'); infoCv.width = 1000; infoCv.height = 330;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = new THREE.CanvasTexture(infoCv); texs.push(infoTex);
  const infoSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false }));
  infoSprite.position.set(-5.6, 1.75, 0); infoSprite.scale.set(8.4, 2.8, 1); infoSprite.renderOrder = 999;
  group.add(infoSprite);

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 1000, 330);
    infoCtx.fillStyle = 'rgba(7,11,20,0.88)'; infoCtx.fillRect(4, 4, 992, 322);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 992, 322);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 25px "PingFang SC", sans-serif';
    infoCtx.fillText('共振特斯拉线圈 — 两回路同频谐振，隔空点亮氖管', 20, 40);
    infoCtx.font = '21px "PingFang SC", sans-serif';
    infoCtx.fillStyle = '#f59e0b';
    infoCtx.fillText(`初级 L₁C₁ 驱动频率 f₁ = ${f1.toFixed(1)} kHz（火花隙放电，缓慢扫描 ±10%）`, 20, 80);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.fillText(`次级 L₂C₂ 固有频率 f₂ = ${F2.toFixed(1)} kHz = 1/√(L₂C₂)（固定）　Q = ${Q}`, 20, 116);
    infoCtx.fillStyle = '#f472b6';
    infoCtx.fillText(`失谐 Δf/f = ${(detune * 100).toFixed(2)}%　响应 A = 1/√((1−(f/f₂)²)²+(f/(f₂Q))²) = ${(amp * Q).toFixed(1)}`, 20, 152);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('I₂ ∝ Q·M·I₁·ω / |…|：f₁ → f₂ 时次级电流按 Q 放大，顶端场强与电弧随之增强', 20, 188);
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.fillText('互感 M：初/次级无导线相连，能量靠互感"跳"过去（无线输电的雏形）', 20, 224);
    infoCtx.fillText('谐振：f₁ = f₂ 时能量传输最有效，峰宽 Δf ≈ f₂/Q　高频高压：ε = −L·dI/dt', 20, 260);
    const ok = amp > 0.25;
    infoCtx.fillStyle = ok ? '#22c55e' : '#ef4444'; infoCtx.font = 'bold 22px "PingFang SC", sans-serif';
    infoCtx.fillText(`状态：${ok ? '谐振 ✓ 氖管被隔空点亮' : '失谐 → 氖管熄灭'}　I₂/I₂max = ${(amp * 100).toFixed(0)}%`, 20, 300);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  let tAnim = 0;
  return {
    update(t, dt) {
      tAnim += dt;
      // 驱动频率 f₁ 缓慢扫描，次级固有频率 f₂ 固定 → 失谐 Δf/f 与谐振响应
      f1 = F2 * (1 + SWEEP_A * Math.sin((t / SWEEP_T) * Math.PI * 2));
      detune = (f1 - F2) / F2;
      amp = resp(f1);                       // 归一化次级电流 I₂/I₂max（共振峰 ≈ Q）
      // Animate arcs（电弧长度与亮度随 I₂ 增强）
      const reach = 0.7 + 2.2 * amp;
      for (let i = 0; i < arcs.length; i++) {
        const positions = arcs[i].geometry.attributes['position'];
        const baseAngle = (i / arcCount) * Math.PI * 2;
        for (let j = 1; j <= 8; j++) {
          const k = j / 8;
          positions.setXYZ(j,
            Math.cos(baseAngle) * (1.0 + k * reach) + (Math.sin(k * 10 + tAnim * 8) * 0.4),
            coilHeight + 0.5 - k * (0.9 + 2.4 * amp) + (Math.cos(k * 7 + tAnim * 6) * 0.2),
            Math.sin(baseAngle) * (1.0 + k * reach) + (Math.cos(k * 9 + tAnim * 7) * 0.4)
          );
        }
        positions.needsUpdate = true;
        arcMats[i].opacity = 0.12 + 0.88 * amp;
      }
      // Pulse glow（顶端场强随谐振响应增强）
      glowMat.opacity = 0.04 + Math.sin(tAnim * 12) * 0.03 + 0.55 * amp;
      glow.scale.setScalar(0.7 + 0.5 * amp + Math.sin(tAnim * 15) * 0.1);
      topLoadMat.emissiveIntensity = 0.05 + 1.3 * amp;
      // 次级线圈匝间发光随 I₂ 起伏
      for (let i = 0; i < turnMats.length; i++) {
        turnMats[i].emissiveIntensity = 0.15 + 1.4 * amp * (0.75 + 0.25 * Math.sin(tAnim * 10 - i * 0.3));
      }
      // 火花隙放电闪烁（视觉频率随 f₁ 变化）
      (gapSpark.material as import('three').MeshBasicMaterial).opacity =
        0.2 + 0.8 * Math.pow(Math.abs(Math.sin(tAnim * 18 * (f1 / F2))), 6);
      // 氖管：谐振（I₂ 足够大）时被高频场隔空点亮，失谐则熄灭
      const lit = amp > 0.25;
      const neonI = Math.min(1, amp * 1.6) * (0.85 + 0.15 * Math.sin(tAnim * 40));
      neonMat.emissiveIntensity = lit ? neonI * 2.4 : 0;
      neonMat.color.setHex(lit ? 0xffb27a : 0x7f1d1d);
      (neonGlow.material as import('three').MeshBasicMaterial).opacity = lit ? neonI * 0.55 : 0;
      neonGlow.scale.setScalar(0.7 + neonI * 0.6);
      // 耦合场（互感）强度随谐振响应
      for (let i = 0; i < fieldMats.length; i++) fieldMats[i].opacity = 0.05 + 0.45 * amp;
      // 谐振曲线上的当前 f₁ 标记
      marker.position.set(plotX + ((f1 / F2 - 1) / FSPAN) * (plotW / 2), plotBaseY + amp * plotH, 0.05);
      // 读数与面板 5 Hz 刷新
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) {
        f1Label.setText(`f₁ = ${f1.toFixed(1)} kHz`);
        drawInfo();
      }
    },
    dispose() {
      group.traverse((obj) => {
        if (obj instanceof THREE.Sprite) {
          // Sprite 复用共享几何体，只释放材质（纹理另由 texs 释放）
          (obj as any).material?.dispose();
          return;
        }
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
          (obj as any).geometry?.dispose();
          const mat = (obj as any).material;
          if (Array.isArray(mat)) mat.forEach((m: any) => m.dispose());
          else if(mat) mat.dispose();
        }
      });
      texs.forEach((x) => x.dispose());
      starGeo.dispose(); starMat.dispose();
      scene.remove(group);
    }
  };
}

