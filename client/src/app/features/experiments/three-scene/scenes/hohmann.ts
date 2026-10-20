import type { SceneContext, SceneInstance } from '../types';
/**
 * Hohmann Transfer（P54）：地球→火星最低能耗轨道转移，两次点火椭圆。
 * 核心公式（vis-viva + 开普勒第三定律）：
 *   圆轨速度 v_c = √(GM/r)；转移椭圆近日/远日速度 v = √(GM(2/r − 1/a))，a=(rA+rB)/2
 *   Δv₁ = v_trans(近日) − v_c(rA)，Δv₂ = v_c(rB) − v_trans(远日)（GM=1·AU 单位下 ×29.78 km/s）
 *   转移耗时（半周期）= ½·√(a³) 年；飞行器真近点角 ν 由开普勒方程 E−e·sinE=M 求解（近日快、远日慢）
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

  // Central star
  const sunGeo = new THREE.SphereGeometry(0.6, 32, 32);
  const sunMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 1.0 });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  group.add(sun);

  // 天文学实值：地球 rA=1.00 AU、火星 rB=1.524 AU；场景显示单位 = AU × AU_SCALE
  // GM=1·AU 归一单位下 1 速度单位 = √(GM_sun/1AU) = 地球公转速度 ≈ 29.78 km/s
  const rA_AU = 1.0, rB_AU = 1.524;
  const AU_SCALE = 3;
  const V_KMS = 29.78;
  const aTransAU = (rA_AU + rB_AU) / 2;

  // Inner orbit (planet A)
  const rA = rA_AU * AU_SCALE; // = 3（构图保持内轨半径为 3）
  const orbitAGeo = new THREE.BufferGeometry();
  const orbitAPts: import('three').Vector3[] = [];
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    orbitAPts.push(new THREE.Vector3(Math.cos(a) * rA, 0, Math.sin(a) * rA));
  }
  orbitAGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(orbitAPts.flatMap(v=>[v.x,v.y,v.z])),3));
  group.add(new THREE.Line(orbitAGeo, new THREE.LineBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.6 })));

  // Outer orbit (planet B = 火星)：半径 rB（场景单位）= 1.524 AU × AU_SCALE ≈ 4.57
  const rB = rB_AU * AU_SCALE;
  const orbitBGeo = new THREE.BufferGeometry();
  const orbitBPts: import('three').Vector3[] = [];
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    orbitBPts.push(new THREE.Vector3(Math.cos(a) * rB, 0, Math.sin(a) * rB));
  }
  orbitBGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(orbitBPts.flatMap(v=>[v.x,v.y,v.z])),3));
  group.add(new THREE.Line(orbitBGeo, new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.6 })));

  // Hohmann transfer ellipse（焦点在原点即太阳处，故不再整体平移；近日/远日距 = rA/rB）
  const aTrans = (rA + rB) / 2;
  const eTrans = (rB - rA) / (rB + rA);
  const bTrans = Math.sqrt(rA * rB);
  const transferGeo = new THREE.BufferGeometry();
  const transferPts: import('three').Vector3[] = [];
  for (let i = 0; i <= 256; i++) {
    const theta = (i / 256) * Math.PI * 2;
    const r = aTrans * (1 - eTrans * eTrans) / (1 + eTrans * Math.cos(theta));
    transferPts.push(new THREE.Vector3(r * Math.cos(theta), 0, r * Math.sin(theta)));
  }
  transferGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(transferPts.flatMap(v=>[v.x,v.y,v.z])),3));
  group.add(new THREE.Line(transferGeo, new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 2 })));

  // Planet A sphere
  const planetAGeo = new THREE.SphereGeometry(0.2, 16, 16);
  const planetAMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.3 });
  const planetA = new THREE.Mesh(planetAGeo, planetAMat);
  group.add(planetA);

  // Planet B sphere
  const planetBGeo = new THREE.SphereGeometry(0.25, 16, 16);
  const planetBMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x1d4ed8, emissiveIntensity: 0.3 });
  const planetB = new THREE.Mesh(planetBGeo, planetBMat);
  group.add(planetB);

  // Spacecraft on transfer orbit
  const scGeo = new THREE.SphereGeometry(0.12, 12, 12);
  const scMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.5 });
  const spacecraft = new THREE.Mesh(scGeo, scMat);
  group.add(spacecraft);

  // Transfer phase arrows
  const arrow1 = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(rA, 0, 0), 0.8, '#22c55e');
  group.add(arrow1);
  const arrow2 = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-rB, 0, 0), 0.8, '#3b82f6');
  group.add(arrow2);

  // Info panel for Δv and orbital elements
  const infoCv = document.createElement('canvas');
  infoCv.width = 320;
  infoCv.height = 160;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = new THREE.CanvasTexture(infoCv);
  const infoGeo = new THREE.PlaneGeometry(4, 2);
  const infoMat = new THREE.MeshBasicMaterial({ map: infoTex, transparent: true });
  const infoPlane = new THREE.Mesh(infoGeo, infoMat);
  infoPlane.position.set(-5, 3, 0);
  group.add(infoPlane);

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 320, 160);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)';
    infoCtx.fillRect(0, 0, 320, 160);
    infoCtx.strokeStyle = '#334155';
    infoCtx.lineWidth = 2;
    infoCtx.strokeRect(0, 0, 320, 160);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 16px "PingFang SC", sans-serif';
    infoCtx.fillText('Hohmann转移轨道', 15, 25);
    infoCtx.fillStyle = '#22c55e';
    infoCtx.font = '14px "PingFang SC", sans-serif';
    infoCtx.fillText(`内轨 rA = ${rA_AU.toFixed(2)} AU（地球）`, 15, 48);
    infoCtx.fillStyle = '#3b82f6';
    infoCtx.fillText(`外轨 rB = ${rB_AU.toFixed(3)} AU（火星）`, 15, 68);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 14px "PingFang SC", sans-serif';
    // vis-viva：GM=1·AU 归一单位下 v_c=√(1/r)，转移椭圆近/远日 v=√(2rB/(rA(rA+rB))) 等；×29.78 km/s
    const vA = Math.sqrt(1 / rA_AU);
    const vB = Math.sqrt(1 / rB_AU);
    const vTransA = Math.sqrt(2 * rB_AU / (rA_AU * (rA_AU + rB_AU)));
    const vTransB = Math.sqrt(2 * rA_AU / (rB_AU * (rA_AU + rB_AU)));
    const dv1 = (vTransA - vA) * V_KMS;
    const dv2 = (vB - vTransB) * V_KMS;
    infoCtx.fillText(`Δv₁ = ${dv1.toFixed(2)} km/s (内轨→转移)`, 15, 90);
    infoCtx.fillText(`Δv₂ = ${dv2.toFixed(2)} km/s (转移→外轨)`, 15, 110);
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '12px "PingFang SC", sans-serif';
    infoCtx.fillText(`转移椭圆: a=${aTransAU.toFixed(3)} AU, e=${eTrans.toFixed(3)}`, 15, 135);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  // Two ignition (Δv) burns: periapsis (tangent to inner orbit) & apoapsis (tangent to outer orbit)
  const burnTex: import('three').Texture[] = [];
  const burnMats: import('three').SpriteMaterial[] = [];
  function addBurnMark(text: string, x: number): void {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c2 = cv.getContext('2d')!;
    c2.fillStyle = '#fca5a5';
    c2.font = 'bold 30px "PingFang SC", sans-serif';
    c2.textAlign = 'center'; c2.textBaseline = 'middle';
    c2.fillText(text, 256, 32);
    const tm = new THREE.CanvasTexture(cv);
    const sm = new THREE.SpriteMaterial({ map: tm, transparent: true });
    burnTex.push(tm); burnMats.push(sm);
    const s = new THREE.Sprite(sm);
    s.scale.set(3.0, 3.0 * 64 / 512, 1);
    s.position.set(x, 0.9, 0);
    group.add(s);
  }
  addBurnMark('点火 Δv1（近日点）', rA);
  addBurnMark('点火 Δv2（远日点）', -rB);

  let tAnim = 0;
  // 开普勒方程 E - e·sinE = M（牛顿迭代），真近点角 ν 由 E 导出，飞行器按面积定律加速
  function solveTrueAnomaly(M: number, e: number): number {
    let E = M;
    for (let k = 0; k < 6; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  }
  const TRANSFER_SEC = 6; // 转移段（近日→远日，半周期）动画时长
  const DWELL_SEC = 2;    // 到达火星后停泊时长，随后循环重置
  return {
    update(t, dt) {
      tAnim += dt;
      const speedA = 1.0;
      const speedB = Math.sqrt(Math.pow(rA / rB, 3));
      const angleA = tAnim * speedA;
      const angleB = tAnim * speedB;
      planetA.position.set(Math.cos(angleA) * rA, 0, Math.sin(angleA) * rA);
      planetB.position.set(Math.cos(angleB) * rB, 0, Math.sin(angleB) * rB);

      // Spacecraft：沿转移椭圆做开普勒运动，近日点(ν=0)→远日点(ν=π)，到点后停泊再循环
      const cycle = TRANSFER_SEC + DWELL_SEC;
      const tc = tAnim % cycle;
      if (tc <= TRANSFER_SEC) {
        const M = (tc / TRANSFER_SEC) * Math.PI; // 平近点角均匀推进（= 面积定律）
        const nu = solveTrueAnomaly(M, eTrans);
        const rT = aTrans * (1 - eTrans * eTrans) / (1 + eTrans * Math.cos(nu));
        spacecraft.position.set(rT * Math.cos(nu), 0, rT * Math.sin(nu));
      } else {
        // 停在远日点（-rB,0,0），与转移终点连续，不再跳变到 +rB
        spacecraft.position.set(-rB, 0, 0);
      }
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
      starGeo.dispose(); starMat.dispose();
      burnTex.forEach((x) => x.dispose());
      burnMats.forEach((m) => m.dispose());
    }
  };
}
