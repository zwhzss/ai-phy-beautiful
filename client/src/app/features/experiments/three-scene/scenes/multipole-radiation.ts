import type { SceneContext, SceneInstance } from '../types';
/**
 * 多极辐射（P214）：多极展开的等级秩序 —— 偶极最强、四极次之。
 *
 * 三个方向图同屏对照（半径 ∝ 辐射振幅，强度 ∝ 半径²，故图中半径比 = (ka) 的幂次）：
 *   电偶极 E1：dI/dΩ ∝ sin²θ（环形双瓣）
 *   电四极 E2（线性四极子）：dI/dΩ ∝ sin²θ·cos²θ（四瓣，θ=45° 最强；m=0 另一常用形式为 (3cos²θ−1)²）
 *   磁偶极 M1：dI/dΩ ∝ sin²θ（形状同电偶极，强度与电四极同阶 ≈ (ka)²·E1）
 * ka = 2πa/λ 循环扫描，四极/磁偶极花瓣按 ka 相对偶极缩小 —— 直观展示 λ/a 的幂次压制；
 * 辐射反作用：ω∝ka、反冲功率 P∝ω⁴∝ka⁴ —— 电偶极源的稳态振荡幅度按 1/(1+8(ka/0.6)⁴) 被辐射阻尼
 *   压低（ka 越大衰减越强），红色反冲箭头 F∝ω²ṗ 与面板读数同源；
 * 该等级秩序对电磁辐射与引力辐射共用（引力辐射因质心动量守恒无偶极项，最低阶即四极）。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  // —— 资源登记，dispose 时统一释放 ——
  const geos: { dispose(): void }[] = [];
  const mats: { dispose(): void }[] = [];
  const texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  // 星野与地面栅格
  const starPos = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 200;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 200;
  }
  const starGeo = geo(new THREE.BufferGeometry());
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((mm) => mat(mm));
  group.add(grid);

  const R0 = 2.2;                       // 电偶极花瓣最大半径
  const CX_DIP = -5, CX_QUAD = 0, CX_M = 5; // 三个方向图中心 x

  // ===== 方向图曲面：r = R·f(θ)（θ 自 +y 偶极轴起算）=====
  const TH = 40, PH = 64, TWO_PI = Math.PI * 2;
  const lobeIndices: number[] = [];
  for (let i = 0; i < TH; i++) {
    for (let j = 0; j < PH; j++) {
      const a = i * (PH + 1) + j, b = a + 1, c = a + PH + 1, e = c + 1;
      lobeIndices.push(a, b, c, b, e, c);
    }
  }

  /** 生成一个方向图网格（位置数组每帧按 ka 重算） */
  function makeLobe(cx: number, color: number, f: (theta: number) => number): { mesh: import('three').Mesh; pos: Float32Array; geo: import('three').BufferGeometry } {
    const g = geo(new THREE.BufferGeometry());
    const pos = new Float32Array((TH + 1) * (PH + 1) * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(lobeIndices);
    const mesh = new THREE.Mesh(g, mat(new THREE.MeshBasicMaterial({
      color, wireframe: true, transparent: true, opacity: 0.6, side: THREE.DoubleSide,
    })));
    mesh.position.set(cx, 0, 0);
    group.add(mesh);
    return { mesh, pos, geo: g };
  }

  const fillLobe = (lobe: { pos: Float32Array; geo: import('three').BufferGeometry }, R: number, f: (theta: number) => number): void => {
    let v = 0;
    for (let i = 0; i <= TH; i++) {
      const theta = (i / TH) * Math.PI;
      const r = R * f(theta);
      const st = Math.sin(theta), ct = Math.cos(theta);
      for (let j = 0; j <= PH; j++) {
        const phi = (j / PH) * TWO_PI;
        lobe.pos[v++] = r * st * Math.cos(phi);
        lobe.pos[v++] = r * ct;
        lobe.pos[v++] = r * st * Math.sin(phi);
      }
    }
    lobe.geo.attributes['position'].needsUpdate = true;
  };

  // 电偶极 E1：sin²θ；电四极 E2（线性）：sin²θcos²θ → 振幅 |sinθcosθ|（除以峰值 1/2 归一）；磁偶极 M1：sin²θ
  const fDip = (th: number) => Math.sin(th);
  const fQuad = (th: number) => Math.abs(2 * Math.sin(th) * Math.cos(th));
  const lobeDip = makeLobe(CX_DIP, 0x22c55e, fDip);
  const lobeQuad = makeLobe(CX_QUAD, 0xf59e0b, fQuad);
  const lobeM = makeLobe(CX_M, 0x3b82f6, fDip);

  // ===== 辐射源 =====
  // 电偶极：一对正负电荷沿 y 振荡（偶极矩 p 振荡）
  const chargeGeo = geo(new THREE.SphereGeometry(0.19, 16, 16));
  const posChargeMat = mat(new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  const negChargeMat = mat(new THREE.MeshBasicMaterial({ color: 0x3b82f6 }));
  const posCharge = new THREE.Mesh(chargeGeo, posChargeMat);
  const negCharge = new THREE.Mesh(chargeGeo, negChargeMat);
  posCharge.position.set(CX_DIP, 0.5, 0);
  negCharge.position.set(CX_DIP, -0.5, 0);
  group.add(posCharge, negCharge);
  const dipoleArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(CX_DIP, 0, 0), 1.1, 0xf59e0b, 0.28, 0.14);
  group.add(dipoleArrow);
  // 辐射反作用（radiation reaction）：振荡偶极向外辐射能量，反冲力 ∝ ω⁴（P=Γω⁴/c³ 型阻尼），
  // 以红色反冲箭头 + 源振幅被压低的形式呈现。
  const recoilArrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(CX_DIP, 0, 0), 0.4, 0xef4444, 0.2, 0.1);
  group.add(recoilArrow);
  // 辐射阻尼因子（ω∝ka ⇒ 反冲功率 ∝ω⁴∝ka⁴；持续驱动下稳态振幅被压低 1/(1+β·ka⁴)）——update 与面板同源
  const KA_MAX = 0.6;
  const radAmp = (ka: number): number => 1 / (1 + 8 * Math.pow(ka / KA_MAX, 4));

  // 电四极：四个电荷沿 y 排成 + − − +（净偶极矩恒为 0，四极矩振荡）
  const quadCharges: { mesh: import('three').Mesh; sign: 1 | -1; kind: 'out' | 'in' }[] = [];
  const qSmallGeo = geo(new THREE.SphereGeometry(0.14, 14, 12));
  for (const sgn of [1, -1] as const) {
    const outer = new THREE.Mesh(qSmallGeo, posChargeMat);
    const inner = new THREE.Mesh(qSmallGeo, negChargeMat);
    outer.position.set(CX_QUAD, sgn * 0.85, 0);
    inner.position.set(CX_QUAD, sgn * 0.35, 0);
    group.add(outer, inner);
    quadCharges.push({ mesh: outer, sign: sgn, kind: 'out' }, { mesh: inner, sign: sgn, kind: 'in' });
  }
  const quadArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(CX_QUAD, 0, 0), 0.6, 0xf59e0b, 0.2, 0.1);
  group.add(quadArrow);

  // 磁偶极：电流环 + 磁矩箭头
  const loopGeo = geo(new THREE.TorusGeometry(0.45, 0.06, 8, 32));
  const loopMat = mat(new THREE.MeshStandardMaterial({ color: 0xa855f7, metalness: 0.3, roughness: 0.6 }));
  const loop = new THREE.Mesh(loopGeo, loopMat);
  loop.position.set(CX_M, 0, 0);
  group.add(loop);
  const magArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(CX_M, 0, 0), 1.0, 0x22d3ee, 0.26, 0.13);
  group.add(magArrow);

  // ===== 文字标签（Sprite；几何体为 three 内部共享，不释放）=====
  function makeLabel(text: string, color: string, scale = 3.6): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 28px "PingFang SC", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const t = tex(new THREE.CanvasTexture(cv));
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: t, transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  const labelE = makeLabel('电偶极 E1  I ∝ sin²θ', '#22c55e', 4.2);
  labelE.position.set(CX_DIP, 2.95, 0);
  const labelQ = makeLabel('电四极 E2  I ∝ sin²θcos²θ', '#f59e0b', 4.4);
  labelQ.position.set(CX_QUAD, 2.95, 0);
  const labelM = makeLabel('磁偶极 M1  I ∝ sin²θ', '#3b82f6', 4.2);
  labelM.position.set(CX_M, 2.95, 0);
  group.add(labelE, labelQ, labelM);

  // ===== 信息面板 =====
  const infoCv = document.createElement('canvas');
  infoCv.width = 900; infoCv.height = 360;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(10, 4)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 6.3, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  ctx.camera.position.set(0, 3.2, 15.5);
  ctx.camera.lookAt(0, 1.4, 0);

  function drawInfo(ka: number): void {
    const c = infoCtx;
    const q2 = ka * ka, q4 = q2 * q2;
    c.clearRect(0, 0, 900, 360);
    c.fillStyle = 'rgba(7,11,20,0.82)';
    c.fillRect(4, 4, 892, 352);
    c.strokeStyle = '#334155';
    c.lineWidth = 3;
    c.strokeRect(4, 4, 892, 352);
    c.textAlign = 'left';

    c.fillStyle = '#f8fafc';
    c.font = 'bold 26px "PingFang SC", sans-serif';
    c.fillText('多极辐射的等级秩序：偶极最强、四极次之（电磁与引力辐射共用）', 20, 40);

    c.font = '21px "PingFang SC", sans-serif';
    c.fillStyle = '#22c55e';
    c.fillText('电偶极 E1：dI/dΩ ∝ sin²θ（双瓣，⊥电偶极矩轴最强）—— 多极展开最低阶、远场最强项', 20, 76);

    c.fillStyle = '#f59e0b';
    c.fillText('电四极 E2（线性四极子）：dI/dΩ ∝ sin²θ·cos²θ（四瓣，θ=45° 最强）；m=0 另一形式 (3cos²θ−1)²', 20, 110);

    c.fillStyle = '#3b82f6';
    c.fillText('磁偶极 M1：dI/dΩ ∝ sin²θ（形状同电偶极）；强度 M1 ≈ E2 ≈ (ka)²·E1 —— 与电四极同阶', 20, 144);

    c.fillStyle = '#a855f7';
    c.fillText('等级秩序：E1 ≫ {M1, E2} ≫ {M2, E3} ≫ … 每升一级强度 ×(ka)²=(2πa/λ)²，即弱一个 λ/a 幂次', 20, 178);

    c.fillStyle = '#94a3b8';
    c.fillText('引力辐射同理：质心/动量守恒 ⇒ 无电/磁偶极项，最低阶即质量四极，故天体引力波极弱', 20, 212);

    // 强度等级条形图：I_E1 : I_E2 : I_更高阶 = 1 : (ka)² : (ka)⁴
    const barX = 300, barMax = 400, barY = 236, barH = 18, gapY = 6;
    const bars: [string, number, string][] = [
      ['E1 电偶极', 1, '#22c55e'],
      ['E2 电四极', q2, '#f59e0b'],
      ['E3/M2 更高阶', q4, '#94a3b8'],
    ];
    bars.forEach(([name, val, color], i) => {
      const y = barY + i * (barH + gapY);
      c.fillStyle = '#64748b';
      c.font = '17px "PingFang SC", sans-serif';
      c.textAlign = 'right';
      c.fillText(name, barX - 10, y + barH - 4);
      c.textAlign = 'left';
      c.fillStyle = 'rgba(148,163,184,0.15)';
      c.fillRect(barX, y, barMax, barH);
      c.fillStyle = color;
      c.fillRect(barX, y, Math.max(2, barMax * val), barH);
      c.fillStyle = '#e2e8f0';
      c.fillText(`×${val < 0.01 ? val.toExponential(1) : val.toFixed(3)}`, barX + barMax + 10, y + barH - 4);
    });

    c.fillStyle = '#f472b6';
    c.font = 'bold 21px "PingFang SC", sans-serif';
    c.fillText(
      `当前 ka=2πa/λ=${ka.toFixed(2)}：I_quad/I_dip≈(ka)²=${q2.toFixed(3)}，I_高阶/I_dip≈(ka)⁴=${q4.toFixed(4)}`,
      20, 302,
    );
    c.fillStyle = '#64748b';
    c.font = '16px "PingFang SC", sans-serif';
    c.fillText('（图中花瓣半径 ∝ 辐射振幅，强度 ∝ 半径²；四极/磁偶极花瓣按 ka 相对偶极缩小）', 20, 282);
    c.fillStyle = '#ef4444';
    c.font = '18px "PingFang SC", sans-serif';
    c.fillText(
      `辐射反作用：ω∝ka ⇒ P_rad∝ω⁴∝ka⁴；阻尼使偶极稳态振幅衰减到 ${radAmp(ka).toFixed(2)}（红箭头=反冲力 F∝ω²ṗ）`,
      20, 340,
    );
    infoTex.needsUpdate = true;
  }

  drawInfo(0.15);

  return {
    update(t, dt) {
      // ka = 2πa/λ 在 0.15 → 0.6 间往复扫描（周期 12 s），直观显示多极层级随 ka 的压制
      const ka = 0.15 + 0.45 * (0.5 - 0.5 * Math.cos((t / 12) * TWO_PI));

      // 半径 ∝ 振幅：E1 为基准 1，M1 与 E2 同阶 ∝ ka
      fillLobe(lobeDip, R0, fDip);
      fillLobe(lobeQuad, R0 * ka, fQuad);
      fillLobe(lobeM, R0 * ka * 0.95, fDip);
      lobeDip.mesh.rotation.y = t * 0.3;
      lobeQuad.mesh.rotation.y = t * 0.3;
      lobeM.mesh.rotation.y = t * 0.3;

      // 电偶极：电荷对振荡；辐射反作用随 ka⁴ 增强 ⇒ 稳态振荡幅度被压低（辐射阻尼），并给出反冲箭头
      const rAmp = radAmp(ka);                          // 辐射阻尼压低后的相对振幅
      const oscAmp = 0.3 * rAmp;                        // 无辐射反作用时为 0.3
      const swing = Math.sin(t * 3);
      const vel = Math.cos(t * 3);                       // 电荷振荡速度 ∝ cos
      const osc = 0.5 + oscAmp * swing;
      posCharge.position.y = osc;
      negCharge.position.y = -osc;
      dipoleArrow.setLength(osc * 2.0, 0.28, 0.14);
      const pulse = 1.0 + 0.12 * Math.sin(t * 3);
      posCharge.scale.setScalar(pulse);
      negCharge.scale.setScalar(pulse);
      // 辐射反冲为阻尼力：方向与电荷速度相反，大小 ∝ ω³·|v|（∝(ka)³|v|，随 ka↑ 迅速增强）
      const recoil = Math.abs(vel) * (0.15 + 0.85 * (1 - rAmp));
      recoilArrow.setDirection(new THREE.Vector3(0, vel >= 0 ? -1 : 1, 0));
      recoilArrow.setLength(0.15 + recoil * 1.6, 0.2, 0.1);

      // 电四极：+Q 在外、−Q 在内反向振荡，净偶极矩恒为 0，四极矩振荡
      const d0 = 0.6, qa = 0.22 * Math.sin(t * 3);
      for (const q of quadCharges) {
        const d = q.kind === 'out' ? d0 + qa : d0 - qa;
        q.mesh.position.y = q.sign * d;
        q.mesh.scale.setScalar(1.0 + 0.1 * Math.sin(t * 3 + (q.kind === 'out' ? 0 : Math.PI)));
      }
      quadArrow.setLength(0.35 + 0.25 * Math.abs(Math.sin(t * 3)), 0.2, 0.1);

      // 磁偶极：电流环绕磁矩轴旋转
      loop.rotation.x = t * 0.5;

      // 面板按 5 Hz 刷新
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo(ka);
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
