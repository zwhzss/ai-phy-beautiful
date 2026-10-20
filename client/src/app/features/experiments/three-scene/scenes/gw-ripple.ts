import type { SceneContext, SceneInstance } from '../types';

/**
 * 引力波涟漪：双中子星旋进 + 时空网格上的径向波动。
 * 物理：波纹以光速外传、振幅随距离 1/r 衰减；双星轨道因辐射引力波而收缩（旋进）。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  // —— 时空网格（XZ 平面） ——
  const geo = new THREE.PlaneGeometry(60, 60, 90, 90);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes['position'] as import('three').BufferAttribute;
  const grid = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color: 0x4c6ef5, wireframe: true, transparent: true, opacity: 0.4 }),
  );
  group.add(grid);

  // —— 双星 ——
  const starA = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0x9fd1ff, emissive: 0x3a7bd5, emissiveIntensity: 0.8 }),
  );
  const starB = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xd58b3a, emissiveIntensity: 0.8 }),
  );
  group.add(starA, starB);

  // 轨道拖尾（示意引力波携带能量）
  const trailN = 240;
  const trailPos = new Float32Array(trailN * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  const trail = new THREE.Points(trailGeo, new THREE.PointsMaterial({ color: 0x7ad7ff, size: 0.16, transparent: true, opacity: 0.7 }));
  group.add(trail);
  let trailHead = 0;

  const waveCenter = { x: 0, z: 0 };

  // ===== 面板：啁啾波形 h(t) + LIGO L 形双臂干涉仪示意 =====
  const infoCv = document.createElement('canvas'); infoCv.width = 600; infoCv.height = 240;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = new THREE.CanvasTexture(infoCv);
  const panel = new THREE.Sprite(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false }));
  panel.scale.set(7, (7 * 240) / 600, 1); panel.position.set(0, 7, 0); panel.renderOrder = 999;
  group.add(panel);

  function drawInfo(tSec: number): void {
    infoCtx.clearRect(0, 0, 600, 240);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(0, 0, 600, 240);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 2; infoCtx.strokeRect(0, 0, 600, 240);

    // —— 左：啁啾波形 h(t) ——
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 16px "PingFang SC", sans-serif';
    infoCtx.fillText('引力波啁啾信号 h(t)', 18, 26);

    infoCtx.beginPath();
    infoCtx.strokeStyle = '#22d3ee';
    infoCtx.lineWidth = 2;
    const basePathY = 78;
    for (let x = 0; x < 300; x++) {
      const tNorm = x / 300;
      const cycle = tNorm;
      const A = 0.55 + cycle * 0.9;
      const omega = 4 + cycle * 9;
      const phase = omega * tNorm * 10; // 累积相位简化近似
      const h = A * Math.sin(phase);
      const px = 30 + x;
      const py = basePathY - h * 22;
      if (x === 0) infoCtx.moveTo(px, py);
      else infoCtx.lineTo(px, py);
    }
    infoCtx.stroke();
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '11px "PingFang SC", sans-serif';
    infoCtx.fillText('振幅 A、频率 ω 随旋进单调升高 → 并合', 30, 118);

    // —— 右：LIGO L 形双臂干涉仪（真实 LIGO 为两条互相垂直的臂，非四臂 X 形）——
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 14px "PingFang SC", sans-serif';
    infoCtx.fillText('LIGO 双臂干涉仪（L 形）', 380, 26);

    const vx = 420, vy = 190;       // 顶点 = 分束器
    const base = 62;                // 静止臂长（像素）
    // 引力波 + 偏振的四极应变：两臂反相，一臂伸长 s、另一臂缩短 s（同源驱动几何与文字）
    const s = 12 * Math.sin(tSec * 3);
    const armX = base + s;          // 水平 X 臂
    const armY = base - s;          // 竖直 Y 臂（与 X 臂反相）

    // X 臂（水平向右）
    infoCtx.lineWidth = 4;
    infoCtx.strokeStyle = s >= 0 ? '#fbbf24' : '#94a3b8';
    infoCtx.beginPath(); infoCtx.moveTo(vx, vy); infoCtx.lineTo(vx + armX, vy); infoCtx.stroke();
    // Y 臂（竖直向上）
    infoCtx.strokeStyle = s >= 0 ? '#94a3b8' : '#fbbf24';
    infoCtx.beginPath(); infoCtx.moveTo(vx, vy); infoCtx.lineTo(vx, vy - armY); infoCtx.stroke();

    // 端镜 + 分束器
    infoCtx.fillStyle = '#e2e8f0';
    infoCtx.fillRect(vx + armX - 3, vy - 6, 6, 12);
    infoCtx.fillRect(vx - 6, vy - armY - 3, 12, 6);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.beginPath(); infoCtx.arc(vx, vy, 4, 0, Math.PI * 2); infoCtx.fill();

    // 标注文字随 stretch 符号切换（与臂长同源，杜绝固定文字与画面反号）
    infoCtx.font = '12px "PingFang SC", sans-serif';
    infoCtx.fillStyle = s >= 0 ? '#fbbf24' : '#94a3b8';
    infoCtx.fillText('X 臂：' + (s >= 0 ? '拉长' : '缩短'), vx + armX - 46, vy + 20);
    infoCtx.fillStyle = s >= 0 ? '#94a3b8' : '#fbbf24';
    infoCtx.fillText('Y 臂：' + (s >= 0 ? '缩短' : '拉长'), vx - 62, vy - armY + 2);

    infoTex.needsUpdate = true;
  }

  drawInfo(0);

  return {
    update(t, dt) {
      // 旋进轨道：半径随时间缓慢收缩（循环演示）
      const cycle = (t % 14) / 14; // 14 秒一轮
      const sep = 4.2 - cycle * 2.4;
      const w = 1.6 + cycle * 3.2; // 越并合越快
      
      // 相位累积积分 ∫ω dt，避免 ω(t)*t 的非物理相位
      const phase = w * t - (w - 1.6) * t * cycle / 2; // 简化近似累积相位
      
      const ang = phase;
      starA.position.set(sep * Math.cos(ang), 0.35, sep * Math.sin(ang));
      starB.position.set(-sep * Math.cos(ang), -0.35, -sep * Math.sin(ang));

      // 拖尾
      const head = (trailHead * 3) % (trailN * 3);
      trailPos[head] = starA.position.x;
      trailPos[head + 1] = starA.position.y;
      trailPos[head + 2] = starA.position.z;
      trailHead++;
      (trailGeo.attributes['position'] as import('three').BufferAttribute).needsUpdate = true;

      // 网格波纹：径向行波，振幅 1/r，随双星频率调制
      const A0 = 0.55 + cycle * 0.9;
      const k = 1.35;
      const omega = 4 + cycle * 9;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const r = Math.sqrt((x - waveCenter.x) ** 2 + (z - waveCenter.z) ** 2);
        const fall = 1 / (1 + r * 0.35);
        pos.setY(i, (A0 * fall) * Math.sin(k * r - phase) * Math.exp(-r * 0.03));
      }
      (pos as unknown as { needsUpdate: boolean }).needsUpdate = true;

      // 更新面板（5Hz：几何与标注文字同源于 s，避免高频重绘与反号）
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo(t);
      
      group.rotation.y = t * 0.04;
    },
    dispose() {
      [geo, trailGeo].forEach((g) => g.dispose());
      [grid, starA, starB, trail].forEach((m) => {
        const mat = (m as import('three').Mesh).material as import('three').Material | import('three').Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      scene.remove(group);
    },
  };
}
