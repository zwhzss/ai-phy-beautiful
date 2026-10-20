import type { SceneContext, SceneInstance } from '../types';
/**
 * 刚体平面运动（P434）—— 主控方程：平面运动的速度合成与瞬心
 *   v_P = v_C + ω × r_P        （轮心平动 ⊕ 绕心转动逐点叠加）
 *   纯滚动  v_C = ω·R  ⇒  接触点(瞬心 I)速度 = 0， I 的轨迹即地面线（固定瞬心）
 *   轮缘任意点（相对接触角 φ）速度大小 = 2ωR·sin(φ/2)，方向 v = ωR(1−cosφ, −sinφ)（ω∥−ẑ）
 *   动能分解  T = ½m v_C² + ½I_C ω²， I_C=½mR²（均质盘）⇒ 平动:转动 = 2:1
 * 扫描自变量：角速度 ω（0.6→3.0 rad/s，周期 16 s）；速度场箭头长度、轮心/顶点数值、
 * 摆线轨迹与面板读数全部由同一 ω、v_C=ωR 计算。
 */
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
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  grid.position.y = -1.5; group.add(grid);

  const R = 1.4, GY = -1.5;
  const CX0 = -3;
  let alpha = 0;            // 滚动角
  let omega = 1.2;

  // —— 轮：外缘环 + 轮毂 + 辐条 ——
  const wheel = new THREE.Group(); group.add(wheel);
  const rim = new THREE.Mesh(geo(new THREE.TorusGeometry(R, 0.09, 12, 48)), mat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5, roughness: 0.4 })));
  wheel.add(rim);
  const hub = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 16)), mat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.6, roughness: 0.3 })));
  hub.rotation.x = Math.PI / 2; wheel.add(hub);
  const spokeMat = mat(new THREE.LineBasicMaterial({ color: 0x64748b }));
  const spokeGeo = geo(new THREE.BufferGeometry());
  const SPOKES = 6;
  spokeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPOKES * 6), 3));
  wheel.add(new THREE.LineSegments(spokeGeo, spokeMat));

  // —— 速度场箭头（12 个固定空间角 φ 采样）——
  const FIELD_N = 12;
  const shaftGeo = geo(new THREE.CylinderGeometry(0.03, 0.03, 1, 6));
  const headGeo = geo(new THREE.ConeGeometry(0.1, 0.26, 8));
  const UPY = new THREE.Vector3(0, 1, 0);
  const fieldArrows: { shaft: import('three').Mesh; head: import('three').Mesh; mat: import('three').MeshBasicMaterial }[] = [];
  for (let i = 0; i < FIELD_N; i++) {
    const m = mat(new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    const shaft = new THREE.Mesh(shaftGeo, m);
    const head = new THREE.Mesh(headGeo, m);
    group.add(shaft, head);
    fieldArrows.push({ shaft, head, mat: m });
  }

  // —— 轮心速度矢量（绿）+ 顶点速度（品红，2v_C）——
  const centerVecMat = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
  const centerShaft = new THREE.Mesh(shaftGeo, centerVecMat);
  const centerHead = new THREE.Mesh(headGeo, centerVecMat);
  group.add(centerShaft, centerHead);

  // —— 摆线轨迹（一个材质点的绝对路径）——
  const CYC_N = 320;
  const cycGeo = geo(new THREE.BufferGeometry());
  const cycPos = new Float32Array(CYC_N * 3);
  cycGeo.setAttribute('position', new THREE.BufferAttribute(cycPos, 3));
  group.add(new THREE.Line(cycGeo, mat(new THREE.LineBasicMaterial({ color: 0xf472b6 }))));
  const cycMarker = new THREE.Mesh(geo(new THREE.SphereGeometry(0.14, 12, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 })));
  group.add(cycMarker);

  // —— 瞬心（接触点）标记 + 其轨迹（地面线）——
  const icMarker = new THREE.Mesh(geo(new THREE.SphereGeometry(0.18, 14, 14)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  group.add(icMarker);
  const icTraceGeo = geo(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(CX0 - 1, GY + 0.02, 0), new THREE.Vector3(3.2, GY + 0.02, 0)]));
  group.add(new THREE.Line(icTraceGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.6 }))));

  function makeLabel(text: string, color: string, scale = 3): import('three').Sprite {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 24px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1); return s;
  }
  const lIC = makeLabel('瞬心 I：v=0', '#fbbf24', 2.6); lIC.position.set(CX0, GY - 0.55, 0); group.add(lIC);
  const lTop = makeLabel('轮顶 v=2ωR', '#f472b6', 2.4); group.add(lTop);

  // —— 信息面板 ——
  const infoCv = document.createElement('canvas'); infoCv.width = 880; infoCv.height = 300;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoSprite = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  infoSprite.position.set(0, 4.2, 0); infoSprite.scale.set(10, 3.4, 1); infoSprite.renderOrder = 999;
  group.add(infoSprite);

  let vC = 0;
  function drawInfo(): void {
    vC = omega * R;
    infoCtx.clearRect(0, 0, 880, 300);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(4, 4, 872, 292);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 872, 292);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 25px "PingFang SC", sans-serif';
    infoCtx.fillText('刚体平面运动 — 平动 ⊕ 转动 叠加 & 瞬心', 20, 38);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('v_P = v_C + ω×r_P    纯滚动 v_C=ωR ⇒ 接触点(瞬心) v_I = 0', 20, 74);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('轮缘速度 |v|=2ωR·sin(φ/2)（φ=相对接触角）；顶=2ωR、侧=√2·ωR', 20, 108);
    infoCtx.fillStyle = '#22c55e';
    infoCtx.fillText('动能 T=½mv_C²+½(½mR²)ω² ⇒ 平动:转动 = 2:1（均质盘，与 ω 无关）', 20, 142);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 23px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：ω = ${omega.toFixed(2)} rad/s   v_C = ${vC.toFixed(2)}   v_顶 = ${(2 * vC).toFixed(2)}   v_I = 0.00 m/s`, 20, 186);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '21px "PingFang SC", sans-serif';
    infoCtx.fillText('摆线为轮缘一点的绝对轨迹；绿色箭头=空间速度场（定常）', 20, 224);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  function setArrow(shaft: import('three').Mesh, head: import('three').Mesh, base: import('three').Vector3, dir: import('three').Vector3, len: number, colr: number): void {
    const m = shaft.material as import('three').MeshBasicMaterial;
    m.color.setHex(colr);
    (head.material as import('three').MeshBasicMaterial).color.setHex(colr);
    if (len < 0.05) { shaft.visible = head.visible = false; return; }
    shaft.visible = head.visible = true;
    const d = dir.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(UPY, d);
    shaft.quaternion.copy(q); shaft.scale.set(1, len, 1);
    shaft.position.copy(base).addScaledVector(d, len / 2);
    head.quaternion.copy(q); head.position.copy(base).addScaledVector(d, len + 0.13);
  }

  const cycBuf: number[][] = [];

  return {
    update(t, dt) {
      omega = 0.6 + ((t % 16) / 16) * 2.4;
      vC = omega * R;
      const view = 0.32;                       // 视觉时间缩放（真实 v_C 用于读数）
      alpha += omega * view * dt;
      const cx = CX0 + R * alpha;
      const rollX = ((cx - (CX0 - 1)) % 8.2) + (CX0 - 1);   // 回绕
      const cy = GY + R;

      wheel.position.set(rollX, cy, 0);
      wheel.rotation.z = -alpha;               // 顺时针（向 +x 滚）
      // 辐条
      const sp = spokeGeo.attributes['position'].array as Float32Array;
      for (let i = 0; i < SPOKES; i++) {
        const a = alpha + (i / SPOKES) * Math.PI;
        sp[i * 6] = 0; sp[i * 6 + 1] = 0; sp[i * 6 + 2] = 0;
        sp[i * 6 + 3] = Math.cos(a) * R * (i % 2 === 0 ? 1 : -1);
        sp[i * 6 + 4] = Math.sin(a) * R * (i % 2 === 0 ? 1 : -1);
        sp[i * 6 + 5] = 0;
      }
      spokeGeo.attributes['position'].needsUpdate = true;

      // 速度场：在滚动后的空间位置（用当前轮心）叠加 ω×r
      const scaleLen = 0.7;
      for (let i = 0; i < FIELD_N; i++) {
        const phi = (i / FIELD_N) * Math.PI * 2;         // 相对接触角
        const rel = new THREE.Vector3(Math.sin(phi) * R, -Math.cos(phi) * R, 0);
        const base = new THREE.Vector3(rollX, cy, 0).add(rel);
        // v = ωR(1−cosφ, −sinφ)  （ω 指向 −ẑ：向 +x 顺时针滚，见文件头推导）
        const vdir = new THREE.Vector3(1 - Math.cos(phi), -Math.sin(phi), 0);
        const vmag = 2 * vC * Math.sin(phi / 2);
        setArrow(fieldArrows[i].shaft, fieldArrows[i].head, base, vdir, vmag * scaleLen, vmag < 0.03 ? 0xfbbf24 : 0x22c55e);
      }

      // 轮心速度矢量
      setArrow(centerShaft, centerHead, new THREE.Vector3(rollX, cy, 0), new THREE.Vector3(1, 0, 0), vC * scaleLen, 0x22d3ee);

      // 摆线（材质点绝对轨迹）：x=R(α−sinα)，y=R(1−cosα)
      const px = rollX + R * (-Math.sin(alpha));           // 相对中心 (−R sinα, −R cosα)
      const py = cy - R * Math.cos(alpha);
      cycBuf.push([px, py, 0]);
      if (cycBuf.length > CYC_N) cycBuf.shift();
      for (let i = 0; i < CYC_N; i++) {
        const idx = i - (CYC_N - cycBuf.length);
        if (idx >= 0 && idx < cycBuf.length) { cycPos[i * 3] = cycBuf[idx][0]; cycPos[i * 3 + 1] = cycBuf[idx][1]; cycPos[i * 3 + 2] = 0; }
        else { cycPos[i * 3] = px; cycPos[i * 3 + 1] = py; cycPos[i * 3 + 2] = 0; }
      }
      cycGeo.attributes['position'].needsUpdate = true;
      cycMarker.position.set(px, py, 0);
      lTop.position.set(px, py + 0.5, 0);

      // 瞬心：接触点 (rollX, GY)，速度 0
      icMarker.position.set(rollX, GY, 0);
      lIC.position.set(rollX, GY - 0.55, 0);

      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
      scene.remove(wheel);
    },
  };
}
