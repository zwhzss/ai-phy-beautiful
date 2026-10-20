import type { SceneContext, SceneInstance } from '../types';

/**
 * 阻尼振动（P05）：弹簧-质量系统，欠/临界/过阻尼三种 regime 对比。
 * 物理：x'' + 2βx' + ω₀²x = 0；ζ = β/ω₀（阻尼比）：<1 欠阻尼、=1 临界、>1 过阻尼。
 * 欠阻尼幅值包络 A(t)=A₀e^{−βt}，总能量包络 E(t)=E₀e^{−2βt}；品质因数 Q = ω₀/(2β)。
 * 相空间为螺旋收敛于原点；质量块/相图演示欠阻尼，顶部曲线并列三条 regime。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const L0 = 3.0; // 弹簧原长
  const k = 4.0; // 劲度系数
  const m = 1.0; // 质量
  const omega0 = Math.sqrt(k / m);
  const dt = 0.016;
  const cycleLen = 15; // 演示周期（s）：t % cycleLen 周期性重置

  // —— 三种阻尼 regime（β 为振幅衰减率 1/s；ζ = β/ω₀ 为阻尼比）——
  const regimes = [
    { beta: 0.4, color: '#38bdf8', name: '欠阻尼', crit: 'ζ<1' },
    { beta: omega0, color: '#f59e0b', name: '临界阻尼', crit: 'ζ=1' },
    { beta: 3.0, color: '#f472b6', name: '过阻尼', crit: 'ζ>1' },
  ];
  const states = regimes.map(() => ({ x: 2.0, v: 0 }));
  const traces: number[][] = regimes.map(() => []);

  // 主演示（质量块与能量条）取欠阻尼
  const liveBeta = regimes[0].beta;
  const zeta = liveBeta / omega0;
  const qFactor = omega0 / (2 * liveBeta);

  // —— 弹簧（螺旋线）——
  function makeSpring(endY: number): import("three").Line {
    const pts: import('three').Vector3[] = [];
    const turns = 12;
    const coils = 20;
    for (let i = 0; i <= coils; i++) {
      const t = i / coils;
      const y = endY * t;
      const r = 0.3 * (1 - 0.3 * t); // 弹簧半径渐变
      const angle = t * turns * 2 * Math.PI;
      pts.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0x94a3b8 });
    return new THREE.Line(geo, mat);
  }

  const springTop = makeSpring(-L0);
  springTop.position.y = 0;
  group.add(springTop);

  // —— 固定端 ——
  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.2, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.5 }),
  );
  ceiling.position.y = 0;
  group.add(ceiling);

  // —— 质量块 ——
  const block = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.8, 0.8),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.3, metalness: 0.3, roughness: 0.4 }),
  );
  group.add(block);

  // —— 平衡位置标记 ——
  const eqMarker = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, L0 + 0.8, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.4 }),
  );
  eqMarker.position.y = -(L0 + 0.4);
  group.add(eqMarker);

  // —— 相空间小图（右侧，主质量块=欠阻尼）——
  const phaseCanvas = document.createElement('canvas');
  phaseCanvas.width = 160;
  phaseCanvas.height = 160;
  const phaseCtx = phaseCanvas.getContext('2d')!;
  const phaseTex = new THREE.CanvasTexture(phaseCanvas);
  const phaseGeo = new THREE.PlaneGeometry(2.4, 2.4);
  const phaseMat = new THREE.MeshBasicMaterial({ map: phaseTex, transparent: true });
  const phasePlot = new THREE.Mesh(phaseGeo, phaseMat);
  phasePlot.position.set(6, -1, 0);
  group.add(phasePlot);

  const phaseHistory: { x: number; v: number }[] = [];

  // —— 能量条（左侧）——
  const barCanvas = document.createElement('canvas');
  barCanvas.width = 80;
  barCanvas.height = 256;
  const barCtx = barCanvas.getContext('2d')!;
  const barTex = new THREE.CanvasTexture(barCanvas);
  const barGeo = new THREE.PlaneGeometry(0.8, 2.6);
  const barMat = new THREE.MeshBasicMaterial({ map: barTex, transparent: true });
  const energyBar = new THREE.Mesh(barGeo, barMat);
  energyBar.position.set(-6, 0, 0);
  group.add(energyBar);

  // —— x(t) 三 regime 对比曲线（顶部面板）——
  const curCanvas = document.createElement('canvas');
  curCanvas.width = 320;
  curCanvas.height = 130;
  const curCtx = curCanvas.getContext('2d')!;
  const curTex = new THREE.CanvasTexture(curCanvas);
  const curGeo = new THREE.PlaneGeometry(5.4, (5.4 * curCanvas.height) / curCanvas.width);
  const curMat = new THREE.MeshBasicMaterial({ map: curTex, transparent: true });
  const curPlot = new THREE.Mesh(curGeo, curMat);
  curPlot.position.set(0, 2.45, 0);
  group.add(curPlot);

  // —— 信息面板（左上方：方程、判据、Q、包络）——
  const infoCanvas = document.createElement('canvas');
  infoCanvas.width = 300;
  infoCanvas.height = 150;
  const infoCtx = infoCanvas.getContext('2d')!;
  const infoTex = new THREE.CanvasTexture(infoCanvas);
  const infoGeo = new THREE.PlaneGeometry(3.6, 1.8);
  const infoMat = new THREE.MeshBasicMaterial({ map: infoTex, transparent: true });
  const infoPlot = new THREE.Mesh(infoGeo, infoMat);
  infoPlot.position.set(-6.0, 2.45, 0);
  group.add(infoPlot);

  // —— 地面网格 ——
  const gridHelper = new THREE.GridHelper(20, 20, 0x1e293b, 0x0f172a);
  gridHelper.position.y = -(L0 + 1.5);
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

  ctx.camera.position.set(0, -L0 / 2, 10);

  let lastCycle = -1;
  return {
    update(t) {
      // 周期性重置（t % cycleLen），避免 15 s 后质量块永久冻结
      const cycle = Math.floor(t / cycleLen);
      const tLocal = t - cycle * cycleLen;
      if (cycle !== lastCycle) {
        for (const st of states) { st.x = 2.0; st.v = 0; }
        for (const tr of traces) tr.length = 0;
        phaseHistory.length = 0;
        lastCycle = cycle;
      }

      // 数值积分（Verlet-like）：三条 regime 同步积分
      for (let i = 0; i < regimes.length; i++) {
        const st = states[i];
        const a = -omega0 * omega0 * st.x - 2 * regimes[i].beta * st.v;
        st.v += a * dt;
        st.x += st.v * dt;
        traces[i].push(st.x);
      }
      const x = states[0].x;
      const v = states[0].v;

      // 更新质量块位置
      block.position.y = -(L0 + 0.4) + x;

      // 更新弹簧（压缩/拉伸）
      group.remove(springTop);
      const newSpring = makeSpring(-(L0 - x));
      group.add(newSpring);

      // 相空间绘制
      phaseHistory.push({ x, v });
      if (phaseHistory.length > 500) phaseHistory.shift();
      phaseCtx.fillStyle = 'rgba(7,11,20,0.1)';
      phaseCtx.fillRect(0, 0, 160, 160);
      phaseCtx.strokeStyle = '#1e293b';
      phaseCtx.lineWidth = 1;
      phaseCtx.beginPath();
      phaseCtx.moveTo(80, 0); phaseCtx.lineTo(80, 160);
      phaseCtx.moveTo(0, 80); phaseCtx.lineTo(160, 80);
      phaseCtx.stroke();
      phaseCtx.fillStyle = '#94a3b8';
      phaseCtx.font = '8px sans-serif';
      phaseCtx.fillText('θ', 130, 12);
      phaseCtx.fillText('ω', 5, 10);
      phaseCtx.strokeStyle = '#f472b6';
      phaseCtx.lineWidth = 1.5;
      phaseCtx.beginPath();
      for (let i = 0; i < phaseHistory.length; i++) {
        const px = 80 + phaseHistory[i].x * 25;
        const py = 80 - phaseHistory[i].v * 8;
        if (i === 0) phaseCtx.moveTo(px, py);
        else phaseCtx.lineTo(px, py);
      }
      phaseCtx.stroke();
      phaseTex.needsUpdate = true;

      // —— x(t) 三 regime 曲线 + 欠阻尼包络 ——
      curCtx.fillStyle = 'rgba(7,11,20,0.92)';
      curCtx.fillRect(0, 0, 320, 130);
      const midY = 68, amp = 22; // x=0 基线与 px/单位
      curCtx.strokeStyle = '#1e293b';
      curCtx.lineWidth = 1;
      curCtx.beginPath(); curCtx.moveTo(0, midY); curCtx.lineTo(320, midY); curCtx.stroke();
      // 幅值包络 ±A₀e^{−βt}（虚线）
      curCtx.strokeStyle = '#475569';
      curCtx.setLineDash([3, 3]);
      for (const sgn of [1, -1]) {
        curCtx.beginPath();
        for (let px = 0; px <= 320; px += 4) {
          const env = sgn * 2.0 * Math.exp(-liveBeta * ((px / 320) * cycleLen)) * amp;
          if (px === 0) curCtx.moveTo(px, midY - env);
          else curCtx.lineTo(px, midY - env);
        }
        curCtx.stroke();
      }
      curCtx.setLineDash([]);
      // 三条轨迹
      for (let i = 0; i < regimes.length; i++) {
        curCtx.strokeStyle = regimes[i].color;
        curCtx.lineWidth = 1.5;
        curCtx.beginPath();
        const tr = traces[i];
        for (let j = 0; j < tr.length; j++) {
          const px = ((j * dt) / cycleLen) * 320;
          const py = midY - tr[j] * amp;
          if (j === 0) curCtx.moveTo(px, py);
          else curCtx.lineTo(px, py);
        }
        curCtx.stroke();
      }
      // 图例与坐标
      curCtx.font = '10px monospace';
      for (let i = 0; i < regimes.length; i++) {
        curCtx.fillStyle = regimes[i].color;
        curCtx.fillText(`${regimes[i].name} β=${regimes[i].beta.toFixed(1)} ${regimes[i].crit}`, 10 + i * 104, 14);
      }
      curCtx.fillStyle = '#94a3b8';
      curCtx.fillText('虚线:包络 A₀e^{−βt}', 10, 124);
      curCtx.fillText('x(t)', 292, midY - 8);
      curCtx.fillText('t/s →', 288, 124);
      curTex.needsUpdate = true;

      // —— 信息面板 ——
      infoCtx.fillStyle = 'rgba(7,11,20,0.9)';
      infoCtx.fillRect(0, 0, 300, 150);
      infoCtx.font = '11px monospace';
      infoCtx.fillStyle = '#f8fafc';
      infoCtx.fillText("x'' + 2βx' + ω₀²x = 0", 12, 22);
      infoCtx.fillStyle = '#94a3b8';
      infoCtx.fillText(`ω₀ = √(k/m) = ${omega0.toFixed(2)} rad/s`, 12, 42);
      infoCtx.fillStyle = '#38bdf8';
      infoCtx.fillText('判据 ζ = β/ω₀：<1 欠  =1 临  >1 过', 12, 62);
      infoCtx.fillStyle = '#f59e0b';
      infoCtx.fillText(`Q = ω₀/(2β) = ${qFactor.toFixed(2)}`, 12, 82);
      infoCtx.fillStyle = '#94a3b8';
      infoCtx.fillText('包络 A=A₀e^{−βt}  E=E₀e^{−2βt}', 12, 102);
      infoCtx.fillStyle = '#38bdf8';
      infoCtx.fillText(`β=${liveBeta.toFixed(2)}/s ζ=${zeta.toFixed(2)} → 欠阻尼`, 12, 122);
      infoCtx.fillStyle = '#64748b';
      infoCtx.fillText('质量块/相图=欠阻尼；曲线含三 regime', 12, 140);
      infoTex.needsUpdate = true;

      // 能量条绘制
      const KE = 0.5 * m * v * v;
      const PE = 0.5 * k * x * x;
      const ETotal = KE + PE;
      barCtx.fillStyle = '#0f172a';
      barCtx.fillRect(0, 0, 80, 256);
      const keH = Math.min(240, (KE / (ETotal + 0.001)) * 240);
      barCtx.fillStyle = '#22c55e';
      barCtx.fillRect(8, 248 - keH, 24, keH);
      const peH = Math.min(240, (PE / (ETotal + 0.001)) * 240);
      barCtx.fillStyle = '#3b82f6';
      barCtx.fillRect(48, 248 - peH, 24, peH);
      // 总能量理论包络（灰色底）：E(t) = E₀e^{−2βt}，与周期重置同步（用 tLocal）
      const eDecay = Math.exp(-2 * liveBeta * tLocal);
      barCtx.fillStyle = '#1e293b';
      barCtx.fillRect(8, 248 - 240 * eDecay, 64, 240 * eDecay);
      barCtx.fillStyle = '#94a3b8';
      barCtx.font = '8px sans-serif';
      barCtx.fillText('KE', 10, 252);
      barCtx.fillText('PE', 50, 252);
      barTex.needsUpdate = true;

      stars.rotation.y = t * 0.004;
    },
    dispose() {
      [starGeo].forEach((g) => g.dispose());
      stars.material.dispose();
      phaseGeo.dispose();
      phaseMat.map?.dispose();
      phaseMat.dispose();
      barGeo.dispose();
      barTex.dispose();
      barMat.dispose();
      curGeo.dispose();
      curTex.dispose();
      curMat.dispose();
      infoGeo.dispose();
      infoTex.dispose();
      infoMat.dispose();
      ceiling.geometry?.dispose();
      ceiling.material.dispose();
      block.geometry?.dispose();
      block.material.dispose();
      eqMarker.geometry?.dispose();
      eqMarker.material.dispose();
      scene.remove(group);
      scene.remove(stars);
    },
  };
}
