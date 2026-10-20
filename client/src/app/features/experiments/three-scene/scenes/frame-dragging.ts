import type { SceneContext, SceneInstance } from '../types';
/** Frame dragging（P147）：Lense-Thirring 效应，旋转质量拖拽时空。 */
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

  // Central rotating mass
  const massGeo = new THREE.SphereGeometry(0.6, 32, 16);
  const massMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const mass = new THREE.Mesh(massGeo, massMat);
  group.add(mass);

  // Meridional + latitude grid lines：几何按当前拖曳角逐点重写，扭转 ∝ 自转角动量 J
  type GridLine = { geo: import('three').BufferGeometry; arr: Float32Array; par: Float32Array };
  const gridLines: GridLine[] = [];
  const TWIST_K = 0.6; // 每单位 J 的最大扭转系数
  // par 每点存 [sinφ, cosφ, r, θ₀, φ]；拖曳扭转角 = φ·TWIST_K·J
  function addGridLine(par: number[], color: number, opacity: number): void {
    const n = par.length / 5;
    const arr = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    gridLines.push({ geo: g, arr, par: new Float32Array(par) });
    group.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity })));
  }

  // Meridional grid lines (showing spacetime drag)
  for (let i = 0; i < 12; i++) {
    const theta = (i / 12) * 2 * Math.PI;
    const par: number[] = [];
    for (let j = 0; j <= 64; j++) {
      const phi = (j / 64) * Math.PI;
      const r = 2.0 + 0.5 * Math.sin(phi);
      par.push(Math.sin(phi), Math.cos(phi), r, theta, phi);
    }
    addGridLine(par, 0x64748b, 0.4);
  }

  // Concentric latitude circles (twisted by frame dragging)
  for (let i = 1; i < 6; i++) {
    const phi = (i / 6) * Math.PI;
    const r = 2.0 + 0.5 * Math.sin(phi);
    const par: number[] = [];
    for (let j = 0; j <= 128; j++) {
      const theta = (j / 128) * 2 * Math.PI;
      par.push(Math.sin(phi), Math.cos(phi), r, theta, phi);
    }
    addGridLine(par, 0x94a3b8, 0.3);
  }

  // 按当前 J 重写全部网格点：J = 0 时扭转为零（Schwarzschild 极限）
  function applyDrag(jn: number): void {
    for (const gl of gridLines) {
      const par = gl.par;
      for (let k = 0; k < par.length / 5; k++) {
        const sPh = par[k * 5], cPh = par[k * 5 + 1], r = par[k * 5 + 2], th0 = par[k * 5 + 3], phi = par[k * 5 + 4];
        const th = th0 + phi * TWIST_K * jn;
        gl.arr[k * 3] = r * sPh * Math.cos(th);
        gl.arr[k * 3 + 1] = r * cPh;
        gl.arr[k * 3 + 2] = r * sPh * Math.sin(th);
      }
      gl.geo.attributes['position'].needsUpdate = true;
    }
  }
  applyDrag(0);

  // Orbiting test particle (precessing due to frame dragging)
  const partGeo = new THREE.SphereGeometry(0.1, 12, 8);
  const partMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
  const particle = new THREE.Mesh(partGeo, partMat);
  group.add(particle);

  // Precession cone visualization
  const conePts: import('three').Vector3[] = [];
  for (let i = 0; i <= 64; i++) {
    const theta = (i / 64) * 2 * Math.PI;
    conePts.push(new THREE.Vector3(2.5 * Math.cos(theta), 1.5, 2.5 * Math.sin(theta)));
  }
  const coneGeo = new THREE.BufferGeometry();
  coneGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(conePts.flatMap(v=>[v.x,v.y,v.z])),3));
  group.add(new THREE.Line(coneGeo, new THREE.LineBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.5 })));

  // Angular momentum arrow
  const arrowDir = new THREE.Vector3(0, 1, 0);
  const arrowOrigin = new THREE.Vector3(0, 0, 0);
  const angularArrow = new THREE.ArrowHelper(arrowDir, arrowOrigin, 2.5, 0x4ade80);
  group.add(angularArrow);

  // 进动陀螺：自转轴绕 J（+y）以 ∝ J 的速率进动，显示拖曳进动方向
  const GYRO_TILT = Math.PI / 6;
  const gyroOrigin = new THREE.Vector3(3.4, -1.2, 0);
  const gyroArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), gyroOrigin, 1.3, 0xf472b6, 0.35, 0.25);
  group.add(gyroArrow);
  // 陀螺轴尖扫出的进动锥（锥角 = GYRO_TILT）
  const gyroRingPts: import('three').Vector3[] = [];
  for (let i = 0; i <= 48; i++) {
    const ph = (i / 48) * 2 * Math.PI;
    gyroRingPts.push(new THREE.Vector3(
      gyroOrigin.x + 1.3 * Math.sin(GYRO_TILT) * Math.cos(ph),
      gyroOrigin.y + 1.3 * Math.cos(GYRO_TILT),
      gyroOrigin.z + 1.3 * Math.sin(GYRO_TILT) * Math.sin(ph),
    ));
  }
  const gyroRingGeo = new THREE.BufferGeometry();
  gyroRingGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(gyroRingPts.flatMap(v=>[v.x,v.y,v.z])),3));
  group.add(new THREE.Line(gyroRingGeo, new THREE.LineBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.5 })));

  // Labels
  const mkLabel = (text: string, x: number, y: number, z: number, color: string) => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 48;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 32);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, y, z);
    sprite.scale.set(2.0, 0.38, 1);
    group.add(sprite);
  };

  mkLabel('拖曳进动 ∝ J', 0, -2.5, 0, '#94a3b8');
  mkLabel('J', 0, 2.8, 0, '#4ade80');
  mkLabel('陀螺进动 ∝ J', 3.4, -2.6, 0, '#f472b6');

  // —— 面板：Lense-Thirring 进动率公式 + 实时读数 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 1024; infoCv.height = 200;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = new THREE.CanvasTexture(infoCv);
  const infoPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 1.95),
    new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false }),
  );
  infoPlane.position.set(0, 4.4, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  function drawInfo(jn: number): void {
    infoCtx.clearRect(0, 0, 1024, 200);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 1016, 192);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 1016, 192);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 30px "PingFang SC", sans-serif';
    infoCtx.fillText('Lense-Thirring 拖曳进动率：ω ≈ 2GJ/(c²r³)（∝ 自转角动量 J）', 22, 46);
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '27px "PingFang SC", sans-serif';
    infoCtx.fillText('J = 0：网格无扭转、无进动（Schwarzschild 极限）；J ↑：拖曳、轨道与陀螺进动同步加速', 22, 90);
    infoCtx.fillStyle = '#4ade80';
    infoCtx.fillText(`读数：J/J_max = ${jn.toFixed(2)}   ω ∝ J → ${(2.4 * jn).toFixed(2)} rad/s（标度）`, 22, 134);
    infoCtx.fillStyle = '#fb923c';
    infoCtx.fillText(`网格最大扭转角 = ${(Math.PI * TWIST_K * jn).toFixed(2)} rad   陀螺进动 ${(1.8 * jn).toFixed(2)} rad/s   轨道进动 ${(1.2 * jn).toFixed(2)} rad/s`, 22, 176);
    infoTex.needsUpdate = true;
  }
  drawInfo(0);

  let animT = 0, precPhase = 0, gyroPhi = 0;
  return {
    update(t, dt) {
      animT += dt;
      // J 扫描动画：0 → J_max → 0（周期 16 s）；所有拖曳量均 ∝ J
      const jn = 0.5 - 0.5 * Math.cos((2 * Math.PI * animT) / 16);
      applyDrag(jn);

      // Central mass 自转角速度 ∝ J
      mass.rotation.y += dt * 2.2 * jn;
      // 角动量箭头长度 ∝ J
      angularArrow.setLength(0.1 + 2.6 * jn, 0.45, 0.3);

      // Precessing orbit：进动率 ∝ J（累积相位避免跳变）
      precPhase += dt * 1.2 * jn;
      const baseTheta = animT * 0.4;
      const r = 2.5;
      particle.position.set(
        r * Math.cos(baseTheta + precPhase),
        1.5 * Math.sin(baseTheta * 0.5),
        r * Math.sin(baseTheta + precPhase)
      );

      // 进动陀螺：轴以 ∝ J 的速率绕 J（+y）进动
      gyroPhi += dt * 1.8 * jn;
      gyroArrow.setDirection(new THREE.Vector3(
        Math.sin(GYRO_TILT) * Math.cos(gyroPhi),
        Math.cos(GYRO_TILT),
        Math.sin(GYRO_TILT) * Math.sin(gyroPhi),
      ));

      // 面板 5Hz 刷新
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo(jn);
    },
    dispose() {
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
          (obj as any).geometry?.dispose();
          const mat = (obj as any).material;
          if (Array.isArray(mat)) mat.forEach((m: any) => m.dispose());
          else if(mat) mat.dispose();
        }
      });
      starGeo.dispose(); starMat.dispose(); infoTex.dispose();
    }
  };
}
