import type { SceneContext, SceneInstance } from '../types';
/** Reciprocal Lattice（P161）：倒格子与衍射。
 *  ① 定义：b_i·a_j = 2π δ_ij；SC（立方 a=1.5）⇒ 倒格子仍为同向 SC，|b| = 2π/a = 4.19（同一长度标尺画出），
 *     第一布里渊区为边长 2π/a 的立方（图中橙色线框）。
 *  ② 衍射（劳厄条件）：k' − k = G（⇔ Bragg 2d·sinθ = λ）⇒ 衍射斑就是倒格点的"像"。
 *     演示：入射波矢 k=2π/λ 沿 +z 穿过晶体（倒格子原点 Γ），后距 D 的屏上零层劳厄斑位置
 *     r = D·G/√(k²−|G|²)（G 即画面中真实倒格点矢量）；λ 在 16s 内 0.42→1.26 扫描，
 *     短波看到 21 个斑（±(210) 环），λ 增大逐级"熄灭"高阶环 ⇒ 屏上仅剩中心斑。 */
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

  // Real-space lattice (left side) — simple cubic
  const a = 1.5;
  const realOrigin = new THREE.Vector3(-5, 0, 0);

  // Basis vectors a1, a2, a3
  const a1 = new THREE.Vector3(a, 0, 0);
  const a2 = new THREE.Vector3(0, a, 0);
  const a3 = new THREE.Vector3(0, 0, a);

  const arrowMatA = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), realOrigin, a * 1.2, '#ef4444');
  group.add(arrowMatA);
  const arrowMatB = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), realOrigin, a * 1.2, '#22c55e');
  group.add(arrowMatB);
  const arrowMatC = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), realOrigin, a * 1.2, '#3b82f6');
  group.add(arrowMatC);

  // Real lattice points
  const realDotGeo = new THREE.SphereGeometry(0.1, 8, 8);
  const realDotMat = new THREE.MeshStandardMaterial({ color: 0xef4444 });
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      for (let k = -2; k <= 2; k++) {
        const dot = new THREE.Mesh(realDotGeo, realDotMat);
        dot.position.set(realOrigin.x + i * a, realOrigin.y + j * a, realOrigin.z + k * a);
        group.add(dot);
      }
    }
  }

  // Real-space unit cell edges
  const cellEdges: import('three').Vector3[] = [
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(a, 0, 0),
    new THREE.Vector3(a, 0, 0), new THREE.Vector3(a, a, 0),
    new THREE.Vector3(a, a, 0), new THREE.Vector3(0, a, 0),
    new THREE.Vector3(0, a, 0), new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, a),
    new THREE.Vector3(a, 0, 0), new THREE.Vector3(a, 0, a),
    new THREE.Vector3(a, a, 0), new THREE.Vector3(a, a, a),
    new THREE.Vector3(0, a, 0), new THREE.Vector3(0, a, a),
    new THREE.Vector3(0, 0, a), new THREE.Vector3(a, 0, a),
    new THREE.Vector3(a, 0, a), new THREE.Vector3(a, a, a),
    new THREE.Vector3(a, a, a), new THREE.Vector3(0, a, a),
    new THREE.Vector3(0, a, a), new THREE.Vector3(0, 0, a),
  ];
  const cellGeo = new THREE.BufferGeometry().setFromPoints(cellEdges.map(p => p.clone().add(realOrigin)));
  group.add(new THREE.LineSegments(cellGeo, new THREE.LineBasicMaterial({ color: 0x94a3b8 })));

  // Reciprocal lattice (right side)
  const b = 2 * Math.PI / a;
  const recipOrigin = new THREE.Vector3(5, 0, 0);

  // Basis vectors b1, b2, b3
  const b1Arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), recipOrigin, b * 0.8, '#ef4444');
  group.add(b1Arrow);
  const b2Arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), recipOrigin, b * 0.8, '#22c55e');
  group.add(b2Arrow);
  const b3Arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), recipOrigin, b * 0.8, '#3b82f6');
  group.add(b3Arrow);

  // Reciprocal lattice points
  const recipDotGeo = new THREE.SphereGeometry(0.12, 8, 8);
  const recipDotMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x1d4ed8, emissiveIntensity: 0.4 });
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      for (let k = -2; k <= 2; k++) {
        const dot = new THREE.Mesh(recipDotGeo, recipDotMat);
        dot.position.set(recipOrigin.x + i * b, recipOrigin.y + j * b, recipOrigin.z + k * b);
        group.add(dot);
      }
    }
  }

  // Brillouin zone (Wigner-Seitz cell) for reciprocal lattice — cube for SC
  const bzGeo = new THREE.BoxGeometry(b, b, b);
  const bzMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, wireframe: true, transparent: true, opacity: 0.4 });
  const bz = new THREE.Mesh(bzGeo, bzMat);
  bz.position.copy(recipOrigin);
  group.add(bz);

  // Connecting line between origins
  const connGeo = new THREE.BufferGeometry().setFromPoints([realOrigin, recipOrigin]);
  group.add(new THREE.Line(connGeo, new THREE.LineBasicMaterial({ color: 0x94a3b8 })));

  // —— 衍射演示：零层劳厄斑屏（斑位 r = D·G/√(k²−|G|²)，G 为画面中真实倒格点；随 λ 扫描生灭）——
  const TWO_PI = Math.PI * 2;
  const DSCR = 6, SCREEN_HALF = 5.8;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(SCREEN_HALF * 2 + 0.4, SCREEN_HALF * 2 + 0.4),
    new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  );
  screen.position.set(recipOrigin.x, recipOrigin.y, DSCR);
  group.add(screen);
  group.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(recipOrigin.x, recipOrigin.y, -6.4), DSCR + 6.2, 0xf8fafc, 0.55, 0.3));
  const spotGeo = new THREE.SphereGeometry(0.17, 10, 8);
  const spotMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
  const spots: import('three').Mesh[] = [];
  for (let q = 0; q < 25; q++) { const m = new THREE.Mesh(spotGeo, spotMat); m.visible = false; group.add(m); spots.push(m); }
  const centreSpot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
  centreSpot.position.set(recipOrigin.x, recipOrigin.y, DSCR - 0.05);
  group.add(centreSpot);

  let lam = 0.42, kMag = 2 * Math.PI / 0.42, nSp = 1, hiSq = 0;
  function stepDiffraction(t: number): void {
    lam = 0.84 - 0.42 * Math.cos(TWO_PI * ((t % 16) / 16));    // λ∈[0.42,1.26]（与 a=1.5 同单位）
    kMag = 2 * Math.PI / lam;
    let q = 0; hiSq = 0;
    for (let hh = -2; hh <= 2; hh++) for (let kk = -2; kk <= 2; kk++) {
      const gx = hh * b, gy = kk * b, G2 = gx * gx + gy * gy;
      if (G2 >= kMag * kMag) continue;
      const tt = DSCR / Math.sqrt(kMag * kMag - G2);
      if (Math.sqrt(G2) * tt > SCREEN_HALF) continue;
      const m = spots[q++];
      m.visible = true;
      m.position.set(recipOrigin.x + gx * tt, recipOrigin.y + gy * tt, DSCR - 0.05);
      hiSq = Math.max(hiSq, hh * hh + kk * kk);
    }
    for (let r = q; r < spots.length; r++) spots[r].visible = false;
    nSp = q + 1;   // 屏上斑数（含中心直接束斑）
  }
  stepDiffraction(0);

  // —— 标签 ——
  function mkLabel(text: string, color: string, px: number, py: number, pz: number, scale = 3.4): void {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
    s.scale.set(scale, scale / 8, 1); s.position.set(px, py, pz);
    group.add(s);
  }
  mkLabel('实空间 SC：a = 1.5', '#ef4444', realOrigin.x, 9.6, 0);
  mkLabel('倒空间 SC：b = 2π/a = 4.19（橙框=第一布里渊区）', '#3b82f6', recipOrigin.x, 9.6, 0);
  mkLabel('衍射屏：零层劳厄斑（λ 扫描）', '#22d3ee', recipOrigin.x, SCREEN_HALF + 1.1, DSCR);

  // —— 信息面板（5Hz 读数）——
  const infoCv = document.createElement('canvas');
  infoCv.width = 880; infoCv.height = 264;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = new THREE.CanvasTexture(infoCv);
  const infoPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(8.8, 2.64),
    new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false }),
  );
  infoPlane.position.set(0, 11.6, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);
  const sq = (x: number): number => Math.sqrt(x);
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 880, 264);
    infoCtx.fillStyle = 'rgba(7,11,20,0.86)';
    infoCtx.fillRect(4, 4, 872, 256);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 872, 256);
    infoCtx.textAlign = 'left';
    const ln = (y: number, col: string, s: string, bold = false, sz = 26): void => {
      infoCtx.fillStyle = col; infoCtx.font = `${bold ? 'bold ' : ''}${sz}px "PingFang SC", sans-serif`;
      infoCtx.fillText(s, 22, y);
    };
    ln(40, '#f8fafc', '倒格子定义：b_i·a_j = 2πδ_ij；SC ⇒ 倒格子同向 SC，|b| = 2π/a', true);
    ln(76, '#22d3ee', '衍射（劳厄条件）：k′−k = G ⇔ Bragg 2d·sinθ = λ ⇒ 衍射斑 = 倒格点的像');
    ln(110, '#a855f7', '零层屏斑位 r = D·G/√(k²−|G|²)，k = 2π/λ ⇒ 斑距 ∝ λ；|G|→k 时斑飞出屏');
    ln(146, '#fbbf24', `读数：a=1.50 b=2π/a=${b.toFixed(2)} 第一BZ边=${b.toFixed(2)}(=2π/a) d100=1.50 d110=${(a / sq(2)).toFixed(2)}`, true, 24);
    ln(178, '#fbbf24', `λ=${lam.toFixed(2)} |k|=${kMag.toFixed(2)}=2π/λ 屏上斑 N=${nSp} 最外环 h²+k²=${hiSq}`, true, 24);
    ln(212, '#94a3b8', '左：实格子(红，a 基矢箭头)｜右：倒格子(蓝，b 基矢)+布里渊区(橙)', false, 22);
    ln(240, '#94a3b8', '白箭头=入射波矢 k；金斑=Γ 直接束斑；青斑=满足劳厄条件的 (hk0) 零层斑', false, 21);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  let tAnim = 0;
  return {
    update(t, dt) {
      tAnim += dt;
      // Subtle pulse on reciprocal points
      recipDotMat.emissiveIntensity = 0.3 + Math.sin(tAnim * 2) * 0.15;
      // λ 扫描驱动劳厄斑生灭 + 5Hz 面板读数
      stepDiffraction(tAnim);
      centreSpot.scale.setScalar(1 + 0.25 * Math.sin(tAnim * 3));
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
    },
    dispose() {
      group.traverse((obj) => {
        if (obj instanceof THREE.Sprite) {
          const sm = (obj as any).material;
          sm.map?.dispose(); sm.dispose();
        }
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
          (obj as any).geometry?.dispose();
          const mat = (obj as any).material;
          if (Array.isArray(mat)) mat.forEach((m: any) => m.dispose());
          else if(mat) mat.dispose();
        }
      });
      starGeo.dispose(); starMat.dispose();
    }
  };
}
