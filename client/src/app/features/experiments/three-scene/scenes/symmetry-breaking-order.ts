import type { SceneContext, SceneInstance } from '../types';
/**
 * 对称性破缺与简并真空（P600）：连续简并谷底 + Goldstone 软模（与 P216 区分：不画冷却/磁矩，
 * 聚焦真空流形 S¹ 的切向零模）。
 * 势（展示单位）：V(r,θ)=λ(r²−v²)²−λv⁴ − ε·r·cos(θ−φ)，λ=0.009, v=1 ⇒ 谷底 r≡1 圆环简并。
 * ε=0：切向严格平坦（Goldstone 模式 ω_t=0，无质量）；ε→0⁺ 微扰把球从鞍顶 r=0 推向 φ 方向，
 * 破缺方向被"选"。加一维倾斜项 ε（显式对称破缺，如外场）后切向模软化：
 *   径向（Higgs 型）：ω_r=√(V_rr/m)=√(8λv²/m)=√0.08 ≈ 0.283（不随 ε 变）
 *   切向（Goldstone 型）：ω_t=√(ε/(m·r₀)) ∝ √ε → 0（ε→0 即软模/零模）
 * 扫描自变量：ε 在 18 s 内 0→2.5e-3→0 往复；每半轮球从鞍顶重放，φ 按黄金角轮换 ——
 * 演示"每次破缺选不同真空"。球的极坐标运动用半隐式欧拉积分（含微摩擦），轨迹尾迹画在帽内。
 * 附加：地板绕数 1 涡旋（θ 绕心一周变化 2π，拓扑保护）其 Goldstone 涟漪振幅 ∝1/(1+ε/ε₀)；
 *   红锥=显式破缺倾斜方位 φ（每轮黄金角重选，与球落点同 φ）。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  const PI = Math.PI, TWO_PI = PI * 2;
  const starGeo = geo(new THREE.BufferGeometry());
  { const p = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) { p[i * 3] = (Math.random() - 0.5) * 200; p[i * 3 + 1] = (Math.random() - 0.5) * 200; p[i * 3 + 2] = (Math.random() - 0.5) * 200; }
    starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3)); }
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // —— 势面 ——
  const LAM = 0.009, V0 = 1, ZS = 110, rEdge = 1.78, CYCLE = 18;
  const Vfun = (r: number, th: number, eps: number, phi: number): number =>
    (LAM * (r * r - V0 * V0) * (r * r - V0 * V0) - LAM * V0 ** 4 - eps * r * Math.cos(th - phi)) * ZS;

  const NR = 30, NT = 72;
  const hGeo = geo(new THREE.BufferGeometry());
  const hPos = new Float32Array(NR * (NT + 1) * 3);
  const hCol = new Float32Array(NR * (NT + 1) * 3);
  const hIdx: number[] = [];
  for (let i = 0; i < NR - 1; i++) for (let j = 0; j < NT; j++) {
    const a = i * (NT + 1) + j, b = a + 1, c = a + NT + 1, d = c + 1;
    hIdx.push(a, c, b, b, c, d);
  }
  hGeo.setAttribute('position', new THREE.BufferAttribute(hPos, 3));
  hGeo.setAttribute('color', new THREE.BufferAttribute(hCol, 3));
  hGeo.setIndex(hIdx);
  const hatMat = mat(new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 0.5 }));
  const hat = new THREE.Mesh(hGeo, hatMat);
  hat.position.set(-0.6, 1.05, 0);
  group.add(hat);

  const cc = new THREE.Color();
  const writeHat = (eps: number, phi: number): void => {
    let k = 0, kc = 0;
    for (let i = 0; i < NR; i++) {
      const r = rEdge * i / (NR - 1);
      for (let j = 0; j <= NT; j++) {
        const th = TWO_PI * j / NT, z = Vfun(r, th, eps, phi);
        hPos[k] = r * Math.cos(th); hPos[k + 1] = z; hPos[k + 2] = r * Math.sin(th); k += 3;
        // 低势紫、高势青蓝；谷底线突出金色
        const g01 = z / ZS;
        cc.setHSL(0.75 - 0.3 * Math.min(1, Math.max(0, (g01 + 0.01) * 4)), 0.7, 0.34 + 0.3 * Math.min(1, Math.max(0, g01 * 6 + 0.5)));
        if (Math.abs(r - V0) < 0.035 && eps < 0.0015) { cc.setRGB(1, 0.78, 0.24); }
        hCol[kc] = cc.r; hCol[kc + 1] = cc.g; hCol[kc + 2] = cc.b; kc += 3;
      }
    }
    hGeo.attributes['position'].needsUpdate = true;
    hGeo.attributes['color'].needsUpdate = true;
    hGeo.computeVertexNormals();
  };

  // 谷底线（简并真空流形 S¹）
  const degGeo = geo(new THREE.BufferGeometry());
  { const p = new Float32Array((NT + 1) * 3);
    for (let j = 0; j <= NT; j++) { const th = TWO_PI * j / NT; p[j * 3] = V0 * Math.cos(th); p[j * 3 + 2] = V0 * Math.sin(th); }
    degGeo.setAttribute('position', new THREE.BufferAttribute(p, 3)); }
  const degLine = new THREE.Line(degGeo, mat(new THREE.LineBasicMaterial({ color: 0xfbbf24 })));
  degLine.position.y = -LAM * V0 ** 4 * ZS + 0.008;
  hat.add(degLine);

  // 球 + 尾迹（环形缓冲 ring → 每帧拷入线性显示缓冲 trPos）
  const ball = new THREE.Mesh(geo(new THREE.SphereGeometry(0.1, 16, 12)), mat(new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0x831843, emissiveIntensity: 0.8 })));
  group.add(ball);
  const TRAIL = 360;
  const ring = new Float32Array(TRAIL * 3);
  const trGeo = geo(new THREE.BufferGeometry());
  const trPos = new Float32Array(TRAIL * 3);
  trGeo.setAttribute('position', new THREE.BufferAttribute(trPos, 3));
  trGeo.setDrawRange(0, 0);
  group.add(new THREE.Line(trGeo, mat(new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85 }))));
  let trHead = 0, trFill = 0;

  // 序参量矢量（帽心 → 球，沿被选中的破缺方向）
  const shaftGeo = geo(new THREE.CylinderGeometry(0.02, 0.02, 1, 6));
  const headGeo = geo(new THREE.ConeGeometry(0.06, 0.15, 8));
  const vecMat = mat(new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x14532d, emissiveIntensity: 0.7 }));
  const psiVec = new THREE.Group();
  { const sh = new THREE.Mesh(shaftGeo, vecMat); sh.position.y = 0.5;
    const hd = new THREE.Mesh(headGeo, vecMat); hd.position.y = 1.06;
    psiVec.add(sh, hd); }
  group.add(psiVec);
  const UPV = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3();

  // —— 地板涡旋：绕数 1 的相位织构（箭头沿切向，绕心一周 θ 变化 2π ⇒ 拓扑非平庸）——
  //    Goldstone 涟漪振幅 ∝1/(1+ε/ε₀)：ε→0 切向变形零代价（软模自由），显式破缺给其上质并压制。
  const vShaft = geo(new THREE.CylinderGeometry(0.024, 0.024, 0.3, 6));
  const vHead = geo(new THREE.ConeGeometry(0.06, 0.13, 8));
  const vMat = mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0x78350f, emissiveIntensity: 0.5 }));
  const vxG = new THREE.Group(); vxG.position.set(2.75, 0.05, 2.5); group.add(vxG);
  const vArrows: { g: import('three').Group; az: number; rad: number }[] = [];
  { const RINGS = [0.95, 1.6, 2.25];
    for (let ri = 0; ri < RINGS.length; ri++) for (let j = 0; j < 9; j++) {
      const az = TWO_PI * j / 9 + ri * 0.24;
      const sh = new THREE.Mesh(vShaft, vMat); sh.position.y = 0.15;
      const hd = new THREE.Mesh(vHead, vMat); hd.position.y = 0.36;
      const g = new THREE.Group(); g.add(sh, hd);
      g.position.set(RINGS[ri] * Math.cos(az), 0, RINGS[ri] * Math.sin(az));
      vxG.add(g); vArrows.push({ g, az, rad: RINGS[ri] });
    } }
  const vTmp = new THREE.Vector3();
  // ε 方向标记：显式破缺项 −ε·r·cos(θ−φ) 的倾斜方位 φ（黄金角每轮换 ⇒ 指向被推往的真空）
  const epsMark = new THREE.Group();
  { const hd = new THREE.Mesh(geo(new THREE.ConeGeometry(0.09, 0.2, 10)), mat(new THREE.MeshBasicMaterial({ color: 0xf43f5e })));
    hd.position.y = 0.1; epsMark.add(hd); }
  group.add(epsMark);

  function makeLabel(text: string, color: string, scale = 3.4): import('three').Sprite {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(scale, scale / 8, 1); s.renderOrder = 998; return s;
  }
  const la = makeLabel('简并真空环 S¹：ε=0 时环上每一点都是基态', '#fbbf24', 4.6); la.position.set(-0.6, -0.05, 1.9);
  const lb = makeLabel('切向轻推 = Goldstone 软模（零能成本）', '#22d3ee', 4.2); lb.position.set(-0.6, 2.7, -1.6);
  const lc = makeLabel('ψ 矢量指向被选中的破缺方向', '#4ade80', 3.8); lc.position.set(1.4, 1.6, 0);
  const ldk = makeLabel('绕数 1 涡旋：Goldstone 涟漪 ∝1/(1+ε/ε₀)', '#fbbf24', 4.2); ldk.position.set(2.75, 1.15, 2.5);
  const le = makeLabel('红色锥=显式破缺倾斜方位 φ', '#f43f5e', 3.4); le.position.set(-0.6, 3.35, -1.9);
  group.add(la, lb, lc, ldk, le);

  const infoCv = document.createElement('canvas'); infoCv.width = 640; infoCv.height = 248;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const info = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  info.scale.set(7.2, 2.79, 1); info.position.set(0.6, 4.9, 0); info.renderOrder = 999;
  group.add(info);

  // —— 球的极坐标动力学状态 ——
  let r = 0.03, vr = 0, th = 0, vt = 0, phi = 0.9, cycSeen = -1;
  const rd = { eps: 0, wR: Math.sqrt(8 * LAM * V0 * V0), wT: 0, th0: 0, rad: 0, rip: 0.42 };

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 640, 248);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(3, 3, 634, 242);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(3, 3, 634, 242);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    infoCtx.fillText('连续简并谷底与 Goldstone 软模', 14, 30);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '19px "PingFang SC", sans-serif';
    infoCtx.fillText('V=λ(r²−v²)²−λv⁴−ε·r·cos(θ−φ)，m=1（展示单位）', 14, 56);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('ω_r=√(8λv²)（径向 Higgs 模，恒定）  ω_t=√(ε/r₀)∝√ε→0（软模）', 14, 80);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '17px "PingFang SC", sans-serif';
    infoCtx.fillText('ε→0⁺：任意微扰选定 φ ⇒ 帽子对称塌陷为单谷；切向余能≈0', 14, 104);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 20px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：ε=${rd.eps.toExponential(2)}  |ψ|=r=${rd.rad.toFixed(3)}  θ₀=${(rd.th0 * 180 / PI).toFixed(0)}°`, 14, 132);
    infoCtx.fillText(`ω_r=${rd.wR.toFixed(3)}  ω_t=${rd.wT.toFixed(3)}  ω_t/ω_r=${(rd.wT / rd.wR).toFixed(3)} ⇒ 切向近自由`, 14, 158);
    infoCtx.fillText(`涡旋涟漪振幅=${rd.rip.toFixed(3)}（绕数 1 拓扑保护）`, 14, 184);
    // 右下小图：ω_r、ω_t vs ε
    const gx = 330, gy = 232, gw = 292, gh = -92;
    infoCtx.strokeStyle = '#334155'; infoCtx.beginPath(); infoCtx.moveTo(gx, gy); infoCtx.lineTo(gx + gw, gy); infoCtx.stroke();
    infoCtx.strokeStyle = '#22c55e'; infoCtx.beginPath();
    infoCtx.moveTo(gx, gy + gh * (rd.wR / 0.30)); infoCtx.lineTo(gx + gw, gy + gh * (rd.wR / 0.30)); infoCtx.stroke();
    infoCtx.strokeStyle = '#f472b6'; infoCtx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const ee = 2.5e-3 * i / 40, wt = Math.sqrt(ee / V0);
      const x = gx + gw * i / 40, y = gy + gh * (wt / 0.30);
      if (i === 0) infoCtx.moveTo(x, y); else infoCtx.lineTo(x, y);
    }
    infoCtx.stroke();
    const mx = gx + gw * (rd.eps / 2.5e-3), my = gy + gh * (rd.wT / 0.30);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.beginPath(); infoCtx.arc(mx, my, 4, 0, TWO_PI); infoCtx.fill();
    infoCtx.fillStyle = '#64748b'; infoCtx.font = '13px "PingFang SC", sans-serif';
    infoCtx.fillText('ω vs ε：绿=ω_r 恒，粉=ω_t∝√ε', gx + 4, gy + 12);
    infoTex.needsUpdate = true;
  }
  writeHat(0, phi); drawInfo();

  return {
    update(t, dt) {
      const u = (t % CYCLE) / CYCLE;
      const eps = 2.5e-3 * (u < 0.5 ? u * 2 : 2 - u * 2);           // 0→εmax→0
      const cyc = Math.floor(t / CYCLE);
      if (cyc !== cycSeen) {
        cycSeen = cyc; phi += 2.39996;                               // 每轮换破缺方位
        r = 0.03; vr = 0; th = phi + PI * (cyc % 2 ? 0.5 : -0.45); vt = 0;
        trHead = 0; trFill = 0; trGeo.setDrawRange(0, 0);
      }
      writeHat(eps, phi);
      // 涡旋切向基准 θ=方位+π/2（绕数 1）叠加 Goldstone 涟漪：振幅随 ε 增大被压制（软模上质）
      const ripA = 0.42 / (1 + eps / 8e-4);
      for (const s of vArrows) {
        const tilt = s.az + PI / 2 + ripA * Math.sin(3 * s.az + 1.4 * t + s.rad * 0.8);
        vTmp.set(Math.cos(tilt), 0, Math.sin(tilt));
        s.g.quaternion.setFromUnitVectors(UPV, vTmp);
      }
      // ε 倾斜方位 φ：锥体在势面上方水平指向 φ 方向
      epsMark.position.set(hat.position.x + 2.05 * Math.cos(phi), hat.position.y + 1.75, hat.position.z + 2.05 * Math.sin(phi));
      tmp.set(Math.cos(phi), 0, Math.sin(phi));
      epsMark.quaternion.setFromUnitVectors(UPV, tmp);
      // 半隐式欧拉：r̈=−∂V/∂r−γṙ；θ̈=−(1/r)∂V/∂θ−(2ṙθ̇/r)−γ_t θ̇（切向摩擦极小 ⇒ 软模长存）
      const h = Math.min(dt, 0.04);
      const dVdr = (4 * LAM * r * (r * r - V0 * V0) - eps * Math.cos(th - phi)) * ZS;
      const dVdt = (eps * r * Math.sin(th - phi)) * ZS;
      vr += (-dVdr - 2.0 * vr) * h; r = Math.max(0.005, r + vr * h);
      vt += (-dVdt / (r * r) - 2 * vr * vt / r - 0.05 * vt) * h; th += vt * h;
      const z = Vfun(r, th, eps, phi);
      ball.position.set(hat.position.x + r * Math.cos(th), hat.position.y + z + 0.1, hat.position.z + r * Math.sin(th));
      // 尾迹环形写入 → 线性拷贝
      ring[trHead * 3] = ball.position.x; ring[trHead * 3 + 1] = ball.position.y - 0.09; ring[trHead * 3 + 2] = ball.position.z;
      trHead = (trHead + 1) % TRAIL; trFill = Math.min(TRAIL, trFill + 1);
      for (let i = 0; i < trFill; i++) {
        const src = (trHead - trFill + i + TRAIL) % TRAIL;
        trPos[i * 3] = ring[src * 3]; trPos[i * 3 + 1] = ring[src * 3 + 1]; trPos[i * 3 + 2] = ring[src * 3 + 2];
      }
      trGeo.attributes['position'].needsUpdate = true;
      trGeo.setDrawRange(0, trFill);
      // 序参量矢量：谷底中心出发，指向当前破缺方位
      tmp.set(Math.cos(th), 0, Math.sin(th));
      psiVec.position.set(hat.position.x, hat.position.y - LAM * ZS + 0.16, hat.position.z);
      psiVec.quaternion.setFromUnitVectors(UPV, tmp);
      psiVec.scale.setScalar(Math.min(1.5, r));
      rd.eps = eps; rd.wT = Math.sqrt(Math.max(eps, 1e-12) / Math.max(V0, r)); rd.th0 = th; rd.rad = r; rd.rip = ripA;
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
    },
    dispose() {
      geos.forEach((x) => x.dispose()); mats.forEach((x) => x.dispose()); texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
