import type { SceneContext, SceneInstance } from '../types';

/**
 * 单摆（P02）：Simple pendulum, angle vs time, phase space.
 * 物理：θ'' = -(g/L)sinθ；相空间为闭合轨道（小角度近似为椭圆）。
 * 分档扫描覆盖 description 承诺的两个自变量：前 3 档摆长 L=1→2→4 m（g=9.81，T∝√L），
 * 后 3 档同 L=2 m 换重力 g=1.62(月)→3.71(火)→9.81(地)（T∝1/√g）。
 * 面板同步给出 T=2π√(L/g) 理论值、过零计时实测周期，以及 θ₀=5°/30° 大角修正参考读数（小角等时性验证）。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  // —— 物理参数（L、g 双分档扫描：验证 T=2π√(L/g) 与小角等时性） ——
  interface Stage { L: number; g: number; tag: string }
  const STAGES: Stage[] = [
    { L: 1.0, g: 9.81, tag: 'L扫描·短' },
    { L: 2.0, g: 9.81, tag: 'L扫描·中' },
    { L: 4.0, g: 9.81, tag: 'L扫描·长' },
    { L: 2.0, g: 1.62, tag: 'g扫描·月球' },
    { L: 2.0, g: 3.71, tag: 'g扫描·火星' },
    { L: 2.0, g: 9.81, tag: 'g扫描·地球' },
  ];
  let g = STAGES[0].g;             // 当前重力加速度（随档位扫描）
  let L = STAGES[0].L;             // 当前摆长
  let segLen = 10;                 // 当前档持续时长（≥2.2 个理论周期，保证过零计时可测）
  const SEG0 = 10;                 // 档时长下限 (s)
  let stepIdx = 0;
  const theta0 = Math.PI / 3;      // 初始角度 (60°)
  const beta = 0.05;               // 阻尼系数（可选）
  const dt = 0.016;

  let theta = theta0;
  let omega = 0;
  let segT = 0;                    // 当前档位已用时间
  let prevTheta = theta;           // 过零检测用
  let lastCross = -1;              // 上次 θ 正向过零时刻（档内）
  let measT = -1;                  // 实测周期（过零计时，档内两正向过零之差）

  // —— 悬挂点 ——
  const pivotGeo = new THREE.SphereGeometry(0.15, 16, 16);
  const pivotMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.3 });
  const pivot = new THREE.Mesh(pivotGeo, pivotMat);
  pivot.position.y = 0;
  group.add(pivot);

  // —— 支架 ——
  const supportGeo = new THREE.BoxGeometry(2, 0.15, 0.15);
  const supportMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.5 });
  const support = new THREE.Mesh(supportGeo, supportMat);
  support.position.y = 0.075;
  group.add(support);

  // —— 摆杆（单位长度，缩放适配扫描中的 L） ——
  const rodGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 8);
  const rodMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.3 });
  const rod = new THREE.Mesh(rodGeo, rodMat);
  rod.scale.y = L;
  group.add(rod);

  // —— 摆球 ——
  const ballGeo = new THREE.SphereGeometry(0.25, 32, 32);
  const ballMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.2,
    metalness: 0.4,
    roughness: 0.3,
  });
  const ball = new THREE.Mesh(ballGeo, ballMat);
  group.add(ball);

  // —— 轨迹点云 ——
  const trailN = 300;
  const trailPos = new Float32Array(trailN * 3);
  const trailColors = new Float32Array(trailN * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
  const trailMat = new THREE.PointsMaterial({ size: 0.06, vertexColors: true, sizeAttenuation: true });
  const trail = new THREE.Points(trailGeo, trailMat);
  group.add(trail);

  const trailHistory: { x: number; y: number }[] = [];

  // —— 平衡线（虚线，按最大摆长构建，随 L 缩放） ——
  const LMAX = 4.0;
  const eqPts: import('three').Vector3[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    eqPts.push(new THREE.Vector3(0, -t * LMAX, 0));
  }
  const eqGeo = new THREE.BufferGeometry().setFromPoints(eqPts);
  const eqMat = new THREE.LineDashedMaterial({ color: 0x475569, dashSize: 0.1, gapSize: 0.05, transparent: true, opacity: 0.6 });
  const eqLine = new THREE.Line(eqGeo, eqMat);
  eqLine.computeLineDistances();
  eqLine.scale.y = L / LMAX;
  group.add(eqLine);

  // —— 相空间图（右侧）——
  const phaseCanvas = document.createElement('canvas');
  phaseCanvas.width = 160;
  phaseCanvas.height = 160;
  const phaseCtx = phaseCanvas.getContext('2d')!;
  const phaseTex = new THREE.CanvasTexture(phaseCanvas);
  const phaseGeo = new THREE.PlaneGeometry(2.4, 2.4);
  const phaseMat = new THREE.MeshBasicMaterial({ map: phaseTex, transparent: true });
  const phasePlot = new THREE.Mesh(phaseGeo, phaseMat);
  phasePlot.position.set(6, -2, 0);
  group.add(phasePlot);

  const phaseHistory: { θ: number; ω: number }[] = [];

  // —— 角度-时间图（左侧）——
  const angCanvas = document.createElement('canvas');
  angCanvas.width = 160;
  angCanvas.height = 160;
  const angCtx = angCanvas.getContext('2d')!;
  const angTex = new THREE.CanvasTexture(angCanvas);
  const angGeo = new THREE.PlaneGeometry(2.4, 2.4);
  const angMat = new THREE.MeshBasicMaterial({ map: angTex, transparent: true });
  const angPlot = new THREE.Mesh(angGeo, angMat);
  angPlot.position.set(-6, -2, 0);
  group.add(angPlot);

  const angleHistory: number[] = [];

  // —— 地面网格 ——
  const gridHelper = new THREE.GridHelper(20, 20, 0x1e293b, 0x0f172a);
  gridHelper.position.y = -(LMAX + 0.5);
  group.add(gridHelper);

  // —— 背景星点 ——
  const starN = 500;
  const starPos = new Float32Array(starN * 3);
  for (let i = 0; i < starN; i++) {
    const r = 20 + Math.random() * 40;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    starPos[i * 3 + 1] = r * Math.cos(ph);
    starPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xc7d2fe, size: 0.2, sizeAttenuation: true }));
  scene.add(stars);

  // —— 光源 ——
  const ambient = new THREE.AmbientLight(0x404060, 0.6);
  group.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(5, 10, 7);
  group.add(dirLight);

  ctx.camera.position.set(0, -2, 10);

  // —— 信息面板（Sprite，4 Hz 刷新；中文文案与场景风格一致） ——
  const infoCv = document.createElement('canvas'); infoCv.width = 860; infoCv.height = 300;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = new THREE.CanvasTexture(infoCv);
  const infoMat = new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false });
  const infoSprite = new THREE.Sprite(infoMat);
  infoSprite.position.set(0, 3.35, 0); infoSprite.scale.set(9.4, 3.3, 1); infoSprite.renderOrder = 999;
  group.add(infoSprite);

  // 大角修正：T ≈ T₀(1 + θ₀²/16)，用于给出 θ₀=5°/30° 参考读数（小角等时性）
  const corr = (th: number): number => 1 + (th * th) / 16;
  const refT5 = (Lx: number): number => 2 * Math.PI * Math.sqrt(Lx / g) * corr(5 * Math.PI / 180);
  const refT30 = (Lx: number): number => 2 * Math.PI * Math.sqrt(Lx / g) * corr(30 * Math.PI / 180);

  let lastPanelT = -1;
  function drawPanel(): void {
    const T0 = 2 * Math.PI * Math.sqrt(L / g);           // 小角理论周期 T₀=2π√(L/g)
    const wCur = Math.sqrt(g / L);                        // 当前角频率 ω=√(g/L)
    infoCtx.clearRect(0, 0, 860, 300);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(4, 4, 852, 292);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 852, 292);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText('单摆（P02）— L 与 g 双分档扫描：验证 T = 2π√(L/g)', 20, 40);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('θ″ = −(g/L)·sinθ；小角(θ≪1)时 T₀ = 2π√(L/g)，与质量、振幅无关（等时性）', 20, 76);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('大角修正 T ≈ T₀(1+θ₀²/16)：θ₀ 越大周期越长，小角下几乎不变', 20, 106);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 22px "PingFang SC", sans-serif';
    const nxt = STAGES[(stepIdx + 1) % STAGES.length];
    infoCtx.fillText(
      `扫描档位 ${stepIdx + 1}/${STAGES.length}（${STAGES[stepIdx].tag}）：L = ${L.toFixed(1)} m，g = ${g.toFixed(2)} m/s²`,
      20, 142,
    );
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：ω = √(g/L) = ${wCur.toFixed(3)} rad/s   T理论(小角) = ${T0.toFixed(3)} s   ` +
      `T实测(过零计时) = ${measT > 0 ? measT.toFixed(3) + ' s' : '—'}`,
      20, 178,
    );
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '21px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `同 L 参考读数（大角修正）：θ₀=5° → T≈${refT5(L).toFixed(3)} s；θ₀=30° → T≈${refT30(L).toFixed(3)} s（小角下两者几乎相等 ⇒ 等时性）`,
      20, 212,
    );
    infoCtx.fillText(
      `当前 θ₀=60°：T≈T₀·${corr(theta0).toFixed(3)} = ${(T0 * corr(theta0)).toFixed(3)} s；下一档 L=${nxt.L.toFixed(1)}m g=${nxt.g.toFixed(2)}（${nxt.tag}）`,
      20, 244,
    );
    infoCtx.fillStyle = '#64748b'; infoCtx.font = '19px "PingFang SC", sans-serif';
    infoCtx.fillText('实测周期 = 相邻两次 θ 正向过零的时间差；前 3 档 T∝√L，后 3 档同 L 换 g（月1.62/火3.71/地9.81）⇒ T∝1/√g', 20, 274);
    infoTex.needsUpdate = true;
  }
  drawPanel();

  return {
    update(t) {
      // —— L/g 双分档扫描：每档 2.2 倍理论周期（≥10s），换档时复位摆角与测量 ——
      segT += dt;
      if (segT >= segLen) {
        segT = 0;
        stepIdx = (stepIdx + 1) % STAGES.length;
        L = STAGES[stepIdx].L;
        g = STAGES[stepIdx].g;
        segLen = Math.max(SEG0, 2.2 * 2 * Math.PI * Math.sqrt(L / g));
        rod.scale.y = L;          // 摆杆随 L 伸缩
        eqLine.scale.y = L / LMAX;
        theta = theta0; omega = 0; prevTheta = theta;
        lastCross = -1; measT = -1;
        phaseHistory.length = 0; angleHistory.length = 0; trailHistory.length = 0;
      }

      // 数值积分（RK4简化版：半隐式欧拉）；ω = √(g/L) 随档位同步
      const alpha = -(g / L) * Math.sin(theta) - beta * omega;
      omega += alpha * dt;
      theta += omega * dt;

      // 实测周期：相邻两次 θ 正向过零的时间差
      if (prevTheta < 0 && theta >= 0) {
        if (lastCross >= 0) measT = segT - lastCross;
        lastCross = segT;
      }
      prevTheta = theta;

      // 摆球位置
      const bx = L * Math.sin(theta);
      const by = -L * Math.cos(theta);
      ball.position.set(bx, by, 0);

      // 摆杆旋转
      rod.position.set(bx / 2, by / 2, 0);
      rod.rotation.z = theta;

      // 轨迹
      trailHistory.push({ x: bx, y: by });
      if (trailHistory.length > trailN) trailHistory.shift();
      const posAttr = trailGeo.attributes['position'];
      const colAttr = trailGeo.attributes['color'];
      for (let i = 0; i < trailN; i++) {
        if (i < trailHistory.length) {
          posAttr.setXYZ(i, trailHistory[i].x, trailHistory[i].y, 0);
          const fade = i / trailHistory.length;
          colAttr.setXYZ(i, 0.96 * fade, 0.58 * fade, 0.04);
        } else {
          posAttr.setXYZ(i, 0, -L - 1, 0);
          colAttr.setXYZ(i, 0, 0, 0);
        }
      }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;

      // 相空间绘制
      phaseHistory.push({ θ: theta, ω: omega });
      if (phaseHistory.length > 600) phaseHistory.shift();
      phaseCtx.fillStyle = 'rgba(7,11,20,0.08)';
      phaseCtx.fillRect(0, 0, 160, 160);
      phaseCtx.strokeStyle = '#1e293b';
      phaseCtx.lineWidth = 1;
      phaseCtx.beginPath();
      phaseCtx.moveTo(80, 0); phaseCtx.lineTo(80, 160);
      phaseCtx.moveTo(0, 80); phaseCtx.lineTo(160, 80);
      phaseCtx.stroke();
      phaseCtx.fillStyle = '#94a3b8';
      phaseCtx.font = '8px sans-serif';
      phaseCtx.fillText('θ', 140, 12);
      phaseCtx.fillText('ω', 5, 10);
      phaseCtx.strokeStyle = '#f472b6';
      phaseCtx.lineWidth = 1.5;
      phaseCtx.beginPath();
      for (let i = 0; i < phaseHistory.length; i++) {
        const px = 80 + phaseHistory[i].θ * 40;
        const py = 80 - phaseHistory[i].ω * 8;
        if (i === 0) phaseCtx.moveTo(px, py);
        else phaseCtx.lineTo(px, py);
      }
      phaseCtx.stroke();
      phaseTex.needsUpdate = true;

      // 角度-时间图
      angleHistory.push(theta);
      if (angleHistory.length > 600) angleHistory.shift();
      angCtx.fillStyle = 'rgba(7,11,20,0.08)';
      angCtx.fillRect(0, 0, 160, 160);
      angCtx.strokeStyle = '#1e293b';
      angCtx.lineWidth = 1;
      angCtx.beginPath();
      angCtx.moveTo(0, 80); angCtx.lineTo(160, 80);
      angCtx.stroke();
      angCtx.fillStyle = '#94a3b8';
      angCtx.font = '8px sans-serif';
      angCtx.fillText('θ', 140, 12);
      angCtx.fillText('t', 5, 155);
      angCtx.strokeStyle = '#60a5fa';
      angCtx.lineWidth = 1.5;
      angCtx.beginPath();
      for (let i = 0; i < angleHistory.length; i++) {
        const px = (i / 600) * 160;
        const py = 80 - angleHistory[i] * 40;
        if (i === 0) angCtx.moveTo(px, py);
        else angCtx.lineTo(px, py);
      }
      angCtx.stroke();
      angTex.needsUpdate = true;

      // 信息面板 4 Hz 刷新
      if (t - lastPanelT >= 0.25) { lastPanelT = t; drawPanel(); }

      stars.rotation.y = t * 0.004;
    },
    dispose() {
      [starGeo, trailGeo, phaseGeo, angGeo].forEach((g) => g.dispose());
      stars.material.dispose();
      trailMat.dispose();
      phaseMat.map?.dispose();
      phaseMat.dispose();
      angMat.map?.dispose();
      angMat.dispose();
      ball.geometry?.dispose();
      ball.material.dispose();
      rod.geometry?.dispose();
      rod.material.dispose();
      pivot.geometry?.dispose();
      pivot.material.dispose();
      support.geometry?.dispose();
      support.material.dispose();
      eqGeo.dispose();
      eqMat.dispose();
      infoTex.dispose();
      infoMat.dispose();
      scene.remove(group);
      scene.remove(stars);
    },
  };
}
