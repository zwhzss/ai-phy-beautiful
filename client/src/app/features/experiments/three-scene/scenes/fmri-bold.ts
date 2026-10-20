import type { SceneContext, SceneInstance } from '../types';
/** fMRI BOLD 信号（P351）：神经活动 → 血流动力学响应函数（HRF）→ T2* 加权信号变化。
 *  HRF 用峰值归一双伽马：g(τ,n)=(τ/n)ⁿ·e^{n−τ}，h(τ)=g(τ,5)−0.25·g(τ,11)
 *  ——扫描 τ∈[0,18]s 得峰≈0.98@4.9s、负后下冲≈−0.17@12.7s（代码实际求值）。
 *  BOLD 物理：ΔS/S=−TE·ΔR2*，TE=40ms，模型 R2*(τ)=20−h(τ) s⁻¹ ⇒ 峰值信号 +4.0%。
 *  左：大脑伪体+激活灶（透明度∝h）+供血动脉（半径脉动∝1+0.12h，血流微球提速）；
 *  中：HRF 曲线墙与刺激 block（0–6s）+ 箱形神经输入 n(t) + TR=1s 含噪体素序列（白点，hash 高斯噪声）；
 *  下：失相位等色扇（展宽×6 示意）+ 合矢量（长度∝e^{−TE·R2*} 真值）。 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [];
  const mats: { dispose(): void }[] = [];
  const texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  const starGeo = geo(new THREE.BufferGeometry());
  const starPos = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 200;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  const TWO_PI = Math.PI * 2;
  const TE = 0.04, R2REST = 20, R2D = 1.0;          // s⁻¹；ΔS/S=−TE·ΔR2*
  const g = (t: number, n: number): number => t <= 0 ? 0 : Math.pow(t / n, n) * Math.exp(n - t);
  const hrf = (t: number): number => g(t, 5) - 0.25 * g(t, 11);
  const dS = (h: number): number => Math.exp(-TE * (R2REST - R2D * h)) / Math.exp(-TE * R2REST) - 1;

  // —— 大脑伪体 + 激活灶 + 供血动脉 ——
  const BRAIN = new THREE.Vector3(-2.7, 2.6, 0);
  const brainGeo = geo(new THREE.SphereGeometry(1.45, 26, 20));
  group.add(new THREE.Mesh(brainGeo, mat(new THREE.MeshBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.32 }))));
  { const b = new THREE.Mesh(brainGeo, mat(new THREE.MeshBasicMaterial({ color: 0x94a3b8, wireframe: true, transparent: true, opacity: 0.16 })));
    b.position.copy(BRAIN); group.add(b); }
  const blobDir = new THREE.Vector3(-0.42, 0.78, 0.46).normalize();
  const blob = new THREE.Mesh(geo(new THREE.SphereGeometry(0.3, 14, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.2 })));
  blob.position.copy(BRAIN).addScaledVector(blobDir, 1.32); group.add(blob);
  const blobHalo = new THREE.Mesh(geo(new THREE.SphereGeometry(0.52, 14, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.08 })));
  blobHalo.position.copy(blob.position); group.add(blobHalo);
  // 皮层激活斑环：12 枚沿灶周球面分布，半径 ∝ h×权重（神经血管耦合的空间扩展示意）
  const PATCH = 12;
  const patchGeo = geo(new THREE.SphereGeometry(0.085, 8, 8));
  const patchMesh = new THREE.InstancedMesh(patchGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.8 })), PATCH);
  group.add(patchMesh);
  const pdum = new THREE.Object3D();
  const patchW: number[] = [];
  const patchT: import('three').Vector3[] = [];
  {
    const t1 = new THREE.Vector3(0, 1, 0).cross(blobDir).normalize();
    const t2 = blobDir.clone().cross(t1).normalize();
    for (let i = 0; i < PATCH; i++) {
      const a = (i / PATCH) * TWO_PI, rr = 0.34 + 0.16 * ((i * 7) % 3);
      patchT.push(t1.clone().multiplyScalar(Math.cos(a) * rr).addScaledVector(t2, Math.sin(a) * rr));
      patchW.push(0.45 + 0.55 * (((i * 13) % 7) / 7));
    }
  }
  const fireDot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.09, 10, 10)), mat(new THREE.MeshBasicMaterial({ color: 0xfef08a })));
  fireDot.position.copy(blob.position).add(new THREE.Vector3(0, 0.75, 0)); group.add(fireDot);
  const vGeo = geo(new THREE.CylinderGeometry(0.055, 0.075, 1.15, 8));
  const vessel = new THREE.Mesh(vGeo, mat(new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.75 })));
  vessel.position.set(BRAIN.x - 0.15, 1.02, 0.3); vessel.rotation.z = 0.22; group.add(vessel);
  const flowGeo = geo(new THREE.SphereGeometry(0.045, 8, 8));
  const flowMat = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
  const flows: import('three').Mesh[] = [];
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(flowGeo, flowMat); group.add(m); flows.push(m); }

  // —— HRF 曲线墙 ——
  const XT = (tau: number): number => 0.15 + 3.05 * (tau / 18);
  const HY = (h: number): number => 2.65 + 1.45 * h;
  const baseGeo = geo(new THREE.BufferGeometry());
  baseGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([XT(0), HY(0), 0, XT(18), HY(0), 0]), 3));
  group.add(new THREE.Line(baseGeo, mat(new THREE.LineBasicMaterial({ color: 0x334155 }))));
  const hrfGeo = geo(new THREE.BufferGeometry());
  { const pos = new Float32Array(241 * 3);
    for (let i = 0; i <= 240; i++) { const tau = (i / 240) * 18; pos[i * 3] = XT(tau); pos[i * 3 + 1] = HY(hrf(tau)); pos[i * 3 + 2] = 0; }
    hrfGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); }
  group.add(new THREE.Line(hrfGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee }))));
  const stimGeo = geo(new THREE.BufferGeometry());
  stimGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([XT(0), 0.55, 0, XT(6), 0.55, 0]), 3));
  group.add(new THREE.Line(stimGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e, linewidth: 2 }))));
  // 神经输入 n(t)：block 设计箱形脉冲（HRF 线性系统激励，卷积核即上方曲线）
  const boxGeo = geo(new THREE.BufferGeometry());
  boxGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    XT(0), 0.08, 0, XT(0), 0.38, 0, XT(6), 0.38, 0, XT(6), 0.08, 0, XT(0), 0.08, 0,
  ]), 3));
  group.add(new THREE.Line(boxGeo, mat(new THREE.LineBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.75 }))));
  { const s2 = makeLabel('神经输入 n(t)（箱形 block）', '#fbbf24', 2.6); s2.position.set(0.9, 0.38, 0); group.add(s2); }
  const curGeo = geo(new THREE.BufferGeometry());
  curGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  group.add(new THREE.Line(curGeo, mat(new THREE.LineBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.6 }))));
  const hMark = new THREE.Mesh(geo(new THREE.SphereGeometry(0.095, 10, 10)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  group.add(hMark);
  // 体素时间序列：TR=1s 采样 + 高斯噪声（hash），叠加在 HRF 上 ⇒ 单体素噪声、需多 trial 平均
  const NTR = 16;
  const trGeo = geo(new THREE.SphereGeometry(0.05, 6, 6));
  const trMesh = new THREE.InstancedMesh(trGeo, mat(new THREE.MeshBasicMaterial({ color: 0xf8fafc })), NTR);
  group.add(trMesh);
  const tdum = new THREE.Object3D();
  const hash1 = (i: number): number => { const s = Math.sin(i * 91.7 + 47.3) * 24631.27; return s - Math.floor(s); };
  const gauss1 = (i: number): number => { const u1 = Math.max(1e-9, hash1(i)), u2 = hash1(i + 500); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(TWO_PI * u2); };
  for (let i = 0; i < NTR; i++) {
    tdum.position.set(XT(i + 0.5), HY(hrf(i + 0.5)) + 0.11 * gauss1(i), 0.06);
    tdum.scale.setScalar(1); tdum.updateMatrix(); trMesh.setMatrixAt(i, tdum.matrix);
  }
  trMesh.instanceMatrix.needsUpdate = true;

  function makeLabel(text: string, color: string, scale = 2.4): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    s.position.set(0, 99, 0);
    return s;
  }
  const labels: [string, string, number, number, number][] = [
    ['运动皮层激活灶 ∝h(τ)', '#f472b6', BRAIN.x, BRAIN.y + 2.15, 2.8],
    ['h(τ)=g(τ,5)−0.25g(τ,11)', '#22d3ee', 1.85, 4.55, 3.0],
    ['block 刺激 0–6s（指叩任务）', '#22c55e', 1.2, 0.2, 2.4],
    ['白点=体素序列 TR=1s+噪声', '#f8fafc', 2.35, 1.3, 2.6],
    ['τ/s →', '#94a3b8', 3.35, 2.28, 1.8],
  ];
  labels.forEach(([tx, col, x, y, sc]) => { const s = makeLabel(tx, col, sc); s.position.set(x, y, 0); group.add(s); });

  // —— 失相位等色扇 + 合矢量 ——
  const FC = new THREE.Vector3(0.62, 0.72, 0);
  const NFAN = 48;
  const gauss = (i: number): number => { const u1 = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1; const u2 = ((Math.sin(i * 78.233) * 12543.7891) % 1 + 1) % 1; return Math.sqrt(-2 * Math.log(Math.max(1e-9, u1))) * Math.cos(TWO_PI * u2); };
  const fanGeo = geo(new THREE.BufferGeometry());
  fanGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NFAN * 6), 3));
  group.add(new THREE.LineSegments(fanGeo, mat(new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.65 }))));
  const resGeo = geo(new THREE.BufferGeometry());
  resGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  group.add(new THREE.Line(resGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 }))));
  { const s0 = makeLabel('等色扇（展宽×6 示意）', '#94a3b8', 2.4); s0.position.set(FC.x, FC.y - 0.95, 0); group.add(s0); }
  { const s1 = makeLabel('金色=合矢量∝e⁻ᵀᴱ·ᴿ²*', '#fbbf24', 2.6); s1.position.set(FC.x + 2.6, FC.y + 0.5, 0); group.add(s1); }

  // —— 面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 840; infoCv.height = 300;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(9.2, 3.3)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 6.4, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  let tau = 0, curH = 0;
  let peakH = 0, peakT = 0, minH = 0, minT = 0;
  for (let i = 0; i <= 360; i++) { const tt = i / 20, hv = hrf(tt); if (hv > peakH) { peakH = hv; peakT = tt; } if (hv < minH) { minH = hv; minT = tt; } }
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 840, 300);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 832, 292);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 832, 292);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText(`BOLD：ΔS/S=−TE·ΔR2*｜TE=40ms，R2*(τ)=20−h(τ) ⇒ 峰 ${(100 * dS(peakH)).toFixed(1)}%`, 22, 40);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '24px "PingFang SC", sans-serif';
    infoCtx.fillText(`HRF 峰 ${peakH.toFixed(2)}@${peakT.toFixed(0)}s，下冲 ${minH.toFixed(2)}@${minT.toFixed(0)}s → ΔS/S=${(100 * dS(minH)).toFixed(2)}%`, 22, 78);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('去氧血红蛋白(顺磁)↓ ⇒ 场均匀性↑ ⇒ R2*↓ ⇒ T2* 信号↑', 22, 112);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：τ=${tau.toFixed(1)}s h=${curH.toFixed(3)} ⇒ ΔS/S=${(100 * dS(curH)).toFixed(2)}%`, 22, 152);
    infoCtx.fillText(`R2*=${(R2REST - R2D * curH).toFixed(2)} s⁻¹｜信号 S/S₀=${Math.exp(TE * R2D * curH).toFixed(3)}`, 22, 186);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('血流微球提速=CBF 响应；动脉半径脉动∝1+0.12h（血容量）', 22, 226);
    infoCtx.fillText(`对比度=e^{TE·|ΔR2*|}−1：TE=40ms→${(100 * (Math.exp(TE) - 1)).toFixed(1)}%、60ms→${(100 * (Math.exp(0.06) - 1)).toFixed(1)}%（长 TE 提对比）`, 22, 258);
    infoTex.needsUpdate = true;
  }

  const fanArr = fanGeo.attributes['position'].array as Float32Array;
  const resArr = resGeo.attributes['position'].array as Float32Array;
  drawInfo();

  return {
    update(t, dt) {
      // 扫描：刺激锁定时间 τ，16s 周期（block 0–6s）
      tau = t % 16;
      curH = hrf(tau);
      const flow = Math.max(0, curH);

      blob.material.opacity = 0.18 + 0.6 * flow;
      blobHalo.material.opacity = 0.05 + 0.3 * flow;
      const vs = 1 + 0.12 * curH;
      vessel.scale.set(vs, 1, vs);
      // 皮层斑：半径 ∝ h(τ)·wᵢ；神经点火球仅在 block 内高频闪烁
      for (let i = 0; i < PATCH; i++) {
        pdum.position.copy(BRAIN).addScaledVector(blobDir, 1.42).addScaledVector(patchT[i], 1.0).add(new THREE.Vector3(0, 0.1 * Math.sin(TWO_PI * t * 0.4 + i), 0));
        pdum.scale.setScalar(0.4 + 1.5 * Math.max(0, curH) * patchW[i]);
        pdum.rotation.set(0, 0, 0); pdum.updateMatrix();
        patchMesh.setMatrixAt(i, pdum.matrix);
      }
      patchMesh.instanceMatrix.needsUpdate = true;
      const inBlock = tau < 6;
      fireDot.visible = inBlock;
      fireDot.scale.setScalar(0.5 + 0.8 * (Math.sin(TWO_PI * t * 6) > 0 ? 1 : 0.2));
      flows.forEach((m, i) => {
        const ph = (t * (0.32 + 0.55 * flow) + i / 6) % 1;
        m.position.set(vessel.position.x - 0.12 * (1 - ph) + ph * 0.28, 0.25 + ph * 1.5, 0.3);
      });

      hMark.position.set(XT(tau), HY(curH), 0.02);
      const ca = curGeo.attributes['position'].array as Float32Array;
      ca[0] = XT(tau); ca[1] = HY(0); ca[2] = 0.01;
      ca[3] = XT(tau); ca[4] = HY(curH); ca[5] = 0.01;
      curGeo.attributes['position'].needsUpdate = true;

      // 等色扇：展宽 σ=sqrt(2·TE·R2*)×6 示意；合矢量长度 = e^{−TE·R2*} 真值
      const r2 = R2REST - R2D * curH;
      const sig = 6 * Math.sqrt(2 * TE * r2);
      for (let i = 0; i < NFAN; i++) {
        const ang = gauss(i) * sig;
        fanArr[i * 6] = FC.x; fanArr[i * 6 + 1] = FC.y; fanArr[i * 6 + 2] = 0;
        fanArr[i * 6 + 3] = FC.x + 0.62 * Math.cos(ang); fanArr[i * 6 + 4] = FC.y + 0.62 * Math.sin(ang); fanArr[i * 6 + 5] = 0;
      }
      fanGeo.attributes['position'].needsUpdate = true;
      const L = 1.55 * Math.exp(-TE * r2) / Math.exp(-TE * R2REST);
      resArr[0] = FC.x; resArr[1] = FC.y; resArr[2] = 0.01;
      resArr[3] = FC.x + L; resArr[4] = FC.y; resArr[5] = 0.01;
      resGeo.attributes['position'].needsUpdate = true;

      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
