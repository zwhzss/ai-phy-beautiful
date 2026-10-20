import type { SceneContext, SceneInstance } from '../types';
/**
 * Geodesic deviation（P150）：邻近测地线的相对加速度 D²ξᵃ/dτ² = −Rᵃ_{bcd} uᵇ ξᶜ uᵈ ≡ −K·ξ。
 * 潮汐双向结构（面条化）：径向 K<0 ⇒ D²ξ/dτ²>0 拉伸（绿↑），横向 K>0 ⇒ D²ξ/dτ²<0 挤压（红↓）。
 * 主体两条测地线间距 ξ(τ)=ξ₀(1+ε sin ωτ)，ξ̈=−ξ₀εω² sin ωτ；右侧下落物体展示同一曲率张量的径向/横向反向分量。
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

  // Central mass creating tidal field
  const massGeo = new THREE.SphereGeometry(0.5, 32, 16);
  const massMat = new THREE.MeshBasicMaterial({ color: 0x7c3aed });
  group.add(new THREE.Mesh(massGeo, massMat));

  // Two nearby geodesics：间距 ξ(τ) = ξ₀(1 + ε·sin ωτ) 随固有时振荡（测地偏离方程的弹簧解）
  const numPoints = 200;
  const XI0 = 0.8; // 初始间距
  const EPS = 0.45; // 振荡幅度
  const OM = 1.1; // 振荡角频率
  const g1Arr = new Float32Array((numPoints + 1) * 3);
  const g2Arr = new Float32Array((numPoints + 1) * 3);

  // 按当前间距 ξ 重写两条世界线（z = ±ξ/2，近中心质量处被潮汐弯曲）
  function writeGeodesics(xi: number): void {
    for (let i = 0; i <= numPoints; i++) {
      const tt = (i / numPoints) * 4 - 2;
      const x = -1.5 + tt * 0.5;
      const z = xi / 2;
      const r = Math.sqrt(x * x + z * z);
      const defl = 0.3 / Math.max(r, 0.5);
      g1Arr[i * 3] = x; g1Arr[i * 3 + 1] = -defl * 0.3; g1Arr[i * 3 + 2] = z;
      g2Arr[i * 3] = x; g2Arr[i * 3 + 1] = defl * 0.3; g2Arr[i * 3 + 2] = -z;
    }
  }
  writeGeodesics(XI0);

  const g1Geo = new THREE.BufferGeometry();
  g1Geo.setAttribute('position', new THREE.BufferAttribute(g1Arr, 3));
  const g2Geo = new THREE.BufferGeometry();
  g2Geo.setAttribute('position', new THREE.BufferAttribute(g2Arr, 3));

  group.add(new THREE.Line(g1Geo, new THREE.LineBasicMaterial({ color: 0x38bdf8 })));
  group.add(new THREE.Line(g2Geo, new THREE.LineBasicMaterial({ color: 0xfb923c })));

  // Separation vector (changes over time)
  const sepLineGeo = new THREE.BufferGeometry();
  sepLineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0, 0,0,1]), 3));
  const sepLineMat = new THREE.LineBasicMaterial({ color: 0x4ade80 });
  const sepLine = new THREE.Line(sepLineGeo, sepLineMat);
  group.add(sepLine);

  // Test particles on each geodesic
  const p1Geo = new THREE.SphereGeometry(0.1, 12, 8);
  const p1Mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const p1 = new THREE.Mesh(p1Geo, p1Mat);
  group.add(p1);

  const p2Geo = new THREE.SphereGeometry(0.1, 12, 8);
  const p2Mat = new THREE.MeshBasicMaterial({ color: 0xfb923c });
  const p2 = new THREE.Mesh(p2Geo, p2Mat);
  group.add(p2);

  // Tidal force arrows（方向 ⇔ D²ξ/dτ² 符号，长度 ∝ |D²ξ/dτ²|，在 update 中驱动）
  const tidalArrow1 = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1.5, 0, XI0/2), 0.5, 0xf472b6);
  group.add(tidalArrow1);
  const tidalArrow2 = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1.5, 0, -XI0/2), 0.5, 0xf472b6);
  group.add(tidalArrow2);

  // —— 面条化（spaghettification）：中心质量附近自由下落物体的双向潮汐结构 ——
  // 径向(沿质量连线)拉伸、横向挤压：D²ξ/dτ² 径向 >0(发散↑)、横向 <0(会聚↓)，这是"面条化"的物理内核。
  const NOODLE_X = 1.7; // 代表物体位于质量 +x 侧，径向即 x 方向
  const noodleGeo = new THREE.SphereGeometry(0.16, 16, 12);
  const noodleMat = new THREE.MeshBasicMaterial({ color: 0x4ade80, wireframe: true });
  const noodle = new THREE.Mesh(noodleGeo, noodleMat);
  noodle.position.set(NOODLE_X, 0, 0);
  noodle.scale.set(1.9, 0.7, 0.7); // 沿径向(x)拉长、横向(z)压扁 → 面条形状
  group.add(noodle);
  // 径向拉伸箭头（绿色，两端相离）：远端背离质量(+x)、近端朝质量(−x)
  const stretch1 = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(NOODLE_X + 0.24, 0, 0), 0.55, 0x4ade80, 0.16, 0.1);
  const stretch2 = new THREE.ArrowHelper(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(NOODLE_X - 0.24, 0, 0), 0.55, 0x4ade80, 0.16, 0.1);
  // 横向挤压箭头（红色，相向）：上/下两面向中面收拢
  const squeeze1 = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(NOODLE_X, 0, 0.62), 0.5, 0xef4444, 0.16, 0.1);
  const squeeze2 = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(NOODLE_X, 0, -0.62), 0.5, 0xef4444, 0.16, 0.1);
  group.add(stretch1, stretch2, squeeze1, squeeze2);

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
    sprite.scale.set(2.4, 0.4, 1);
    group.add(sprite);
  };

  mkLabel('Geodesic Deviation: ∇_u ∇_u ξ^a = -R^a_{bcd} u^b ξ^c u^d', 0, 2.5, 0, '#94a3b8');
  mkLabel('ξ (separation)', 0, -1.8, 0, '#4ade80');

  // —— 面板：测地偏离方程 + ξ / D²ξ/dτ² 实时读数 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 1024; infoCv.height = 252;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = new THREE.CanvasTexture(infoCv);
  const infoPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 2.46),
    new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false }),
  );
  infoPlane.position.set(0, 4.35, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  function drawInfo(xi: number, acc: number): void {
    infoCtx.clearRect(0, 0, 1024, 252);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 1016, 244);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 1016, 244);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 30px "PingFang SC", sans-serif';
    infoCtx.fillText('测地偏离方程：D²ξ/dτ² = −R^a_bcd u^b ξ^c u^d ≡ −K·ξ（潮汐力）', 22, 44);
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '25px "PingFang SC", sans-serif';
    infoCtx.fillText(`振荡解：ξ(τ) = ξ₀(1 + ε sin ωτ)，ξ₀ = ${XI0}，ε = ${EPS}，ω = ${OM} ⇒ 会聚/发散交替`, 22, 84);
    const kEff = xi > 1e-4 ? -acc / xi : 0;
    infoCtx.fillStyle = '#4ade80';
    infoCtx.fillText(`读数：ξ = ${xi.toFixed(2)}   D²ξ/dτ² = ${acc.toFixed(2)}   K_eff = ${kEff.toFixed(2)}`, 22, 122);
    infoCtx.fillStyle = '#f472b6';
    infoCtx.fillText('粉色潮汐箭头 ⇔ D²ξ/dτ² 方向：指向内 = 会聚（ξ↓），指向外 = 发散（ξ↑）', 22, 160);
    infoCtx.fillStyle = '#4ade80';
    infoCtx.fillText('面条化（右侧下落物体）：径向拉伸（绿↑ D²ξ/dτ²>0）＋ 横向挤压（红↓ D²ξ/dτ²<0）', 22, 198);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('同一曲率张量的两个分量：径向与横向符号相反 ⇒ 物体被拉成"面条"', 22, 234);
    infoTex.needsUpdate = true;
  }
  drawInfo(XI0, 0);

  let animT = 0;
  return {
    update(t, dt) {
      animT += dt;
      const progress = (Math.sin(animT * 0.3) + 1) / 2;
      const idx = Math.floor(progress * numPoints);

      // 间距振荡 ξ(τ) = ξ₀(1 + ε sin ωτ)；两条世界线随 ξ(τ) 重画
      const xi = XI0 * (1 + EPS * Math.sin(OM * animT));
      writeGeodesics(xi);
      g1Geo.attributes['position'].needsUpdate = true;
      g2Geo.attributes['position'].needsUpdate = true;

      // Update particle positions
      p1.position.set(g1Arr[idx * 3], g1Arr[idx * 3 + 1], g1Arr[idx * 3 + 2]);
      p2.position.set(g2Arr[idx * 3], g2Arr[idx * 3 + 1], g2Arr[idx * 3 + 2]);

      // Update separation vector ξ（真实随 τ 振荡）
      const sepVec = new THREE.Vector3().subVectors(p2.position, p1.position);
      sepLine.position.copy(p1.position);
      sepLineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0, sepVec.x,sepVec.y,sepVec.z]), 3));
      sepLineGeo.attributes['position'].needsUpdate = true;

      // 潮汐加速度 D²ξ/dτ² = −ξ₀εω²·sin ωτ：方向随变号，长度 ∝ |D²ξ/dτ²|
      const acc = -XI0 * EPS * OM * OM * Math.sin(OM * animT);
      const accSign = acc >= 0 ? 1 : -1;
      tidalArrow1.position.set(-1.5, 0, xi / 2);
      tidalArrow2.position.set(-1.5, 0, -xi / 2);
      tidalArrow1.setDirection(new THREE.Vector3(0, 0, accSign)); // +ξ/2 处：ξ↑ ⇔ 指向外
      tidalArrow2.setDirection(new THREE.Vector3(0, 0, -accSign));
      const arrowScale = Math.min(0.2 + 2.2 * Math.abs(acc) / (XI0 * EPS * OM * OM), 1.2);
      tidalArrow1.setLength(arrowScale, arrowScale * 0.3);
      tidalArrow2.setLength(arrowScale, arrowScale * 0.3);

      // 面板 5Hz 刷新
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo(xi, acc);
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
