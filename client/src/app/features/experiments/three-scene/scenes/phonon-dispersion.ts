import type { SceneContext, SceneInstance } from '../types';
/**
 * 晶格振动与声子（P31）：一维双原子链的色散关系 ω±(k)，声学支与光学支。
 *
 * 标准解（最近邻弹簧 K、原胞内两原子质量 M > m、晶格常数 a = 1）：
 *   ω±²(k) = K(1/M + 1/m) ± K√[ (1/M + 1/m)² − 4sin²(ka/2)/(M·m) ]
 * 声学支 ω−(0) = 0（长波极限 ω ≈ cₛ|k|，即晶格声波），k = π/a 处 ω− = √(2K/M)（只剩重原子动）；
 * 光学支 ω+(0) = √(2K(M+m)/(Mm)) = √(2K/μ)（M ≫ m 时 → √(2K/m)），两亚晶格反相，
 * k = π/a 处 ω+ = √(2K/m)（只剩轻原子动）。两支在边界张开频率禁带 Δ = √(2K/m) − √(2K/M)。
 *
 * 画面：左侧 ω–k 曲线（含禁带阴影与随 k 扫描的游标）＋右侧一维双原子链行波动画
 * （原子位移按本征矢量精确计算：V/U = K(1+e^{ika})/(2K − mω²)），信息面板给公式与读数。
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

  // ===== 物理：一维双原子链 =====
  const K = 1;   // 弹簧常数
  const M = 4;   // 重原子质量（大球）
  const m = 1;   // 轻原子质量（小球）
  const A = 1;   // 晶格常数（归一化）

  /** ω±²(k)：标准双原子链色散，optical=false 为声学支 ω− */
  function omega2(k: number, optical: boolean): number {
    const s = 1 / M + 1 / m;
    const disc = s * s - (4 * Math.sin((k * A) / 2) * Math.sin((k * A) / 2)) / (M * m);
    const root = K * Math.sqrt(Math.max(0, disc));
    return K * s + (optical ? root : -root);
  }
  const omega = (k: number, optical: boolean) => Math.sqrt(omega2(k, optical));

  const W_OPT0 = Math.sqrt((2 * K * (M + m)) / (M * m)); // ω+(0) = √(2K/μ)（M≫m 时 → √(2K/m)）
  const W_OPT_PI = Math.sqrt((2 * K) / m);   // ω+(π/a) = √(2K/m)
  const W_AC_PI = Math.sqrt((2 * K) / M);    // ω−(π/a) = √(2K/M)
  const GAP = W_OPT_PI - W_AC_PI;            // 能隙

  // ===== 版面：左侧色散图，右侧双原子链 =====
  const PX = 2.6;   // k 轴半宽（对应 k = ±π/a）
  const SY = 1.9;   // ω → y 缩放
  const PLX = -4.0; // 图心 x
  const PLY = -0.6; // ω = 0 基线 y
  const HALF_H = 3.2; // ω 轴高度

  // —— 色散曲线（k ∈ [−π/a, π/a]，第一布里渊区） ——
  const NP = 240;
  const acPos = new Float32Array((NP + 1) * 3);
  const opPos = new Float32Array((NP + 1) * 3);
  for (let i = 0; i <= NP; i++) {
    const k = ((i / NP) * 2 - 1) * Math.PI;
    const x = PLX + (k / Math.PI) * PX;
    acPos[i * 3] = x; acPos[i * 3 + 1] = PLY + omega(k, false) * SY; acPos[i * 3 + 2] = 0;
    opPos[i * 3] = x; opPos[i * 3 + 1] = PLY + omega(k, true) * SY; opPos[i * 3 + 2] = 0;
  }
  const acGeo = geo(new THREE.BufferGeometry());
  acGeo.setAttribute('position', new THREE.BufferAttribute(acPos, 3));
  const opGeo = geo(new THREE.BufferGeometry());
  opGeo.setAttribute('position', new THREE.BufferAttribute(opPos, 3));
  const acMat = mat(new THREE.LineBasicMaterial({ color: 0x38bdf8 }));
  const opMat = mat(new THREE.LineBasicMaterial({ color: 0xfb923c }));
  group.add(new THREE.Line(acGeo, acMat), new THREE.Line(opGeo, opMat));

  // —— 坐标轴与布里渊区边界 ——
  const axisMat = mat(new THREE.MeshBasicMaterial({ color: 0x94a3b8 }));
  const kAxis = new THREE.Mesh(geo(new THREE.BoxGeometry(PX * 2 + 0.5, 0.05, 0.05)), axisMat);
  kAxis.position.set(PLX, PLY, 0);
  group.add(kAxis);
  const wAxis = new THREE.Mesh(geo(new THREE.BoxGeometry(0.05, HALF_H, 0.05)), axisMat);
  wAxis.position.set(PLX, PLY + HALF_H / 2, 0);
  group.add(wAxis);

  const bzMat = mat(new THREE.MeshBasicMaterial({ color: 0x64748b }));
  for (const s of [-1, 1]) {
    const bz = new THREE.Mesh(geo(new THREE.BoxGeometry(0.03, HALF_H - 0.4, 0.03)), bzMat);
    bz.position.set(PLX + s * PX, PLY + (HALF_H - 0.4) / 2, 0);
    group.add(bz);
  }

  // —— 能隙（禁带）阴影与上下边界 ——
  const gapH = (W_OPT_PI - W_AC_PI) * SY;
  const gapMesh = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(PX * 2, gapH)),
    mat(new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false })),
  );
  gapMesh.position.set(PLX, PLY + ((W_OPT_PI + W_AC_PI) / 2) * SY, 0);
  group.add(gapMesh);
  const edgeMat = mat(new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.55 }));
  for (const wv of [W_AC_PI, W_OPT_PI]) {
    const ln = new THREE.Mesh(geo(new THREE.BoxGeometry(PX * 2, 0.025, 0.025)), edgeMat);
    ln.position.set(PLX, PLY + wv * SY, 0);
    group.add(ln);
  }

  // —— 图例 ——
  const legend = (y: number, color: import('three').LineBasicMaterial): import('three').Line => {
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([PLX - PX + 0.05, y, 0, PLX - PX + 0.55, y, 0]), 3));
    const l = new THREE.Line(g, color);
    group.add(l);
    return l;
  };
  legend(PLY + 3.45, acMat);
  legend(PLY + 3.2, opMat);

  // —— 游标（当前 k）与曲线上的标记点 ——
  const cursorMat = mat(new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.4 }));
  const cursor = new THREE.Mesh(geo(new THREE.BoxGeometry(0.03, HALF_H - 0.2, 0.03)), cursorMat);
  cursor.position.set(PLX, PLY + (HALF_H - 0.2) / 2, 0);
  group.add(cursor);
  const dotGeo = geo(new THREE.SphereGeometry(0.09, 12, 10));
  const dotA = new THREE.Mesh(dotGeo, mat(new THREE.MeshBasicMaterial({ color: 0x38bdf8 })));
  const dotO = new THREE.Mesh(dotGeo, mat(new THREE.MeshBasicMaterial({ color: 0xfb923c })));
  group.add(dotA, dotO);

  // ===== 一维双原子链动画 =====
  const CELLS = 7;
  const NAT = CELLS * 2;         // 交替质量的原子数
  const SP = 0.4;                // 相邻原子间距（= a/2）
  const CHX = 3.2;               // 链中心 x
  const CHY = 0.4;               // 链平衡位置 y
  const AMP = 0.55;              // 位移振幅显示上限
  const TIME_SCALE = 1.15;       // 时间降速（面板注明）

  const baseX: number[] = [];
  const heavyGeo = geo(new THREE.SphereGeometry(0.24, 20, 16));
  const lightGeo = geo(new THREE.SphereGeometry(0.15, 16, 12));
  const heavyMat = mat(new THREE.MeshStandardMaterial({ color: 0xa855f7, metalness: 0.25, roughness: 0.5, emissive: 0x6d28d9, emissiveIntensity: 0.35 }));
  const lightMat = mat(new THREE.MeshStandardMaterial({ color: 0x22c55e, metalness: 0.25, roughness: 0.5, emissive: 0x15803d, emissiveIntensity: 0.35 }));
  const atoms: import('three').Mesh[] = [];
  for (let j = 0; j < NAT; j++) {
    const bx = CHX + (j - (NAT - 1) / 2) * SP;
    baseX.push(bx);
    const heavy = j % 2 === 0;
    const s = new THREE.Mesh(heavy ? heavyGeo : lightGeo, heavy ? heavyMat : lightMat);
    s.position.set(bx, CHY, 0);
    group.add(s);
    atoms.push(s);
  }

  // 弹簧：相邻原子间的一条折线（z 向 zigzag，像弹簧）
  const SEG = 10, ZAG = 0.11;
  const sprGeo = geo(new THREE.BufferGeometry());
  const sprPos = new Float32Array((NAT - 1) * SEG * 2 * 3);
  sprGeo.setAttribute('position', new THREE.BufferAttribute(sprPos, 3));
  const spring = new THREE.LineSegments(sprGeo, mat(new THREE.LineBasicMaterial({ color: 0x64748b })));
  group.add(spring);

  /** 本征矢量：V/U = K(1+e^{ika})/(2K − mω²)（U=重原子、V=轻原子位移），返回显示振幅与相位 */
  function eigenvector(k: number, optical: boolean): { aU: number; aV: number; phV: number } {
    const w2 = omega2(k, optical);
    const den = 2 * K - m * w2;
    const numRe = K * (1 + Math.cos(k * A));
    const numIm = K * Math.sin(k * A);
    if (Math.abs(den) < 1e-6) return { aU: 0, aV: AMP, phV: 0 }; // 轻原子独自振动（光学支边界）
    const aV = Math.hypot(numRe, numIm) / Math.abs(den);
    const phV = Math.atan2(numIm / den, numRe / den);
    const sc = AMP / Math.max(1, aV);
    return { aU: sc, aV: sc * aV, phV };
  }

  // —— 文字标签（Sprite；几何体为 three 内部共享，不释放）——
  function makeLabel(text: string, color: string, scale = 4.2): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 26px "PingFang SC", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const t = tex(new THREE.CanvasTexture(cv));
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: t, transparent: true })));
    s.scale.set(scale, scale / 8, 1);
    return s;
  }
  const lblTitle = makeLabel('ω–k 色散（第一布里渊区 −π/a … π/a）', '#94a3b8', 5.0);
  lblTitle.position.set(PLX, PLY + 4.0, 0);
  group.add(lblTitle);
  const lblAc = makeLabel('声学支 ω−', '#38bdf8', 2.4);
  lblAc.position.set(PLX - PX + 1.6, PLY + 3.45, 0);
  group.add(lblAc);
  const lblOp = makeLabel('光学支 ω+', '#fb923c', 2.4);
  lblOp.position.set(PLX - PX + 1.6, PLY + 3.18, 0);
  group.add(lblOp);
  const lblGap = makeLabel('频率禁带（能隙）Δω', '#f87171', 2.8);
  lblGap.position.set(PLX, PLY + ((W_OPT_PI + W_AC_PI) / 2) * SY, 0);
  group.add(lblGap);
  const lblKL = makeLabel('−π/a', '#94a3b8', 1.2);
  lblKL.position.set(PLX - PX, PLY - 0.32, 0);
  group.add(lblKL);
  const lblG = makeLabel('Γ', '#94a3b8', 0.6);
  lblG.position.set(PLX, PLY - 0.32, 0);
  group.add(lblG);
  const lblKR = makeLabel('π/a', '#94a3b8', 1.2);
  lblKR.position.set(PLX + PX, PLY - 0.32, 0);
  group.add(lblKR);
  const lblChain = makeLabel('一维双原子链（M=4 紫球，m=1 绿球）', '#c4b5fd', 5.0);
  lblChain.position.set(CHX, 2.35, 0);
  group.add(lblChain);

  // —— 信息面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 900; infoCv.height = 280;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(10, 3.111)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 5.9, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  ctx.camera.position.set(0, 3.0, 12.5);
  ctx.camera.lookAt(0, 1.8, 0);

  function drawInfo(kSel: number, opt: boolean, vg: number, ratio: number, phDeg: number): void {
    const c = infoCtx;
    c.clearRect(0, 0, 900, 280);
    c.fillStyle = 'rgba(7,11,20,0.82)';
    c.fillRect(4, 4, 892, 272);
    c.strokeStyle = '#334155';
    c.lineWidth = 3;
    c.strokeRect(4, 4, 892, 272);
    c.textAlign = 'left';

    c.fillStyle = '#f8fafc';
    c.font = 'bold 26px "PingFang SC", sans-serif';
    c.fillText('一维双原子链的色散关系 ω±(k)：声学支（蓝）· 光学支（橙）', 20, 40);

    c.font = '20px "PingFang SC", sans-serif';
    c.fillStyle = '#38bdf8';
    c.fillText('ω±²(k) = K(1/M+1/m) ± K√[(1/M+1/m)² − 4sin²(ka/2)/(M·m)]', 20, 74);

    c.fillStyle = '#94a3b8';
    c.fillText(`声学支 ω−：ω−(0)=0，长波 ω≈cₛ|k| 即声波；k=π/a 处 ω−=√(2K/M)=${W_AC_PI.toFixed(2)}（重原子动）`, 20, 108);

    c.fillStyle = '#fb923c';
    c.fillText(`光学支 ω+：两亚晶格反相，ω+(0)=√(2K/μ)=${W_OPT0.toFixed(2)} → M≫m 时即 √(2K/m)；边界处 ω+=√(2K/m)=${W_OPT_PI.toFixed(2)}`, 20, 142);

    c.fillStyle = '#a855f7';
    c.fillText(`k=π/a 处两支张开 → 阴影=频率禁带 Δ=${GAP.toFixed(2)}（√K单位），带内无格波解；质量比越大能隙越大`, 20, 176);

    c.fillStyle = '#64748b';
    c.font = '17px "PingFang SC", sans-serif';
    c.fillText('K=1 · M=4 · m=1 · a=1；k 自动扫描 0→π/a→0，每 10 s 换一支；链上位移按本征矢量精确计算（时间降速）', 20, 206);

    c.fillStyle = '#f472b6';
    c.font = 'bold 21px "PingFang SC", sans-serif';
    c.fillText(
      `当前：${opt ? '光学支' : '声学支'}  k=${(kSel / Math.PI).toFixed(2)}π/a  ω=${omega(kSel, opt).toFixed(3)}  v_g=dω/dk=${vg.toFixed(2)}  ` +
      `亚晶格振幅比 ${Number.isFinite(ratio) ? ratio.toFixed(2) : '∞'} · 相位差 ${phDeg.toFixed(0)}°`,
      20, 248,
    );
    infoTex.needsUpdate = true;
  }

  const CYCLE = 10; // 每支的演示时长（s）
  let lastPanel = -1;
  drawInfo(0, false, 0, 1, 0);

  return {
    update(t, dt) {
      // k 自动扫描（三角波 0 → π/a → 0），每个周期切换所演示的支
      const s = (t % CYCLE) / CYCLE;
      const kSel = Math.PI * (s < 0.5 ? 2 * s : 2 * (1 - s));
      const opt = Math.floor(t / CYCLE) % 2 === 1;

      const eig = eigenvector(kSel, opt);
      const w = omega(kSel, opt);
      const osc = w * t * TIME_SCALE;

      // 原子位移：重原子 u = aU·cos(kx − ωt)，轻原子 u = aV·cos(kx − ωt + φ)
      for (let j = 0; j < NAT; j++) {
        const kd = kSel * (j / 2);
        const heavy = j % 2 === 0;
        const u = heavy ? eig.aU * Math.cos(kd - osc) : eig.aV * Math.cos(kd - osc + eig.phV);
        atoms[j].position.set(baseX[j], CHY + u, 0);
      }

      // 弹簧折线随原子更新
      const arr = sprGeo.attributes['position'] as import('three').BufferAttribute;
      const fa = arr.array as Float32Array;
      let v = 0;
      for (let j = 0; j < NAT - 1; j++) {
        const a = atoms[j].position, b = atoms[j + 1].position;
        for (let sg = 0; sg < SEG; sg++) {
          for (const f of [sg / SEG, (sg + 1) / SEG]) {
            const zz = f === 0 || f === 1 ? 0 : (Math.round(f * SEG) % 2 ? ZAG : -ZAG);
            fa[v++] = a.x + (b.x - a.x) * f;
            fa[v++] = a.y + (b.y - a.y) * f;
            fa[v++] = zz;
          }
        }
      }
      arr.needsUpdate = true;

      // 游标与曲线标记点
      const cx = PLX + (kSel / Math.PI) * PX;
      cursor.position.x = cx;
      dotA.position.set(cx, PLY + omega(kSel, false) * SY, 0);
      dotO.position.set(cx, PLY + omega(kSel, true) * SY, 0);
      dotA.scale.setScalar(opt ? 0.8 : 1.7);
      dotO.scale.setScalar(opt ? 1.7 : 0.8);

      // 面板按 5 Hz 刷新
      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5) || lastPanel !== (opt ? 1 : 0)) {
        lastPanel = opt ? 1 : 0;
        const h = 0.01;
        const vg = (omega(kSel + h, opt) - omega(Math.max(0, kSel - h), opt)) / (kSel + h - Math.max(0, kSel - h));
        drawInfo(kSel, opt, vg, eig.aV / Math.max(eig.aU, 1e-9), (Math.abs(eig.phV) * 180) / Math.PI);
      }
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
    },
  };
}
