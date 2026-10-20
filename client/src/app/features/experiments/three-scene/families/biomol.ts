import type { SceneContext, SceneInstance } from '../types';
import { scaffold, panelSprite, PAL, ResourceBag } from './_common';

/**
 * 生物物理族（biomol）：DNA 双螺旋与复制 / 蛋白质折叠与结构层次 /
 * 血红蛋白协同结合 / 细胞膜与光合作用 / 分子马达与肌肉收缩。
 * 由 scene-registry 按 slug+variant 绑定：make(variant, title)。
 */
export function make(variant: string, title: string): (ctx: SceneContext) => SceneInstance {
  return (ctx) => scaffold(ctx, {
    title,
    camera: [0, 3, 12],
    build: (g, bag) => buildVariant(g, bag, ctx, variant, title),
  });
}

function buildVariant(
  g: import('three').Group,
  bag: ResourceBag,
  ctx: SceneContext,
  variant: string,
  title: string,
): (t: number, dt: number) => void {
  const { THREE } = ctx;
  switch (variant) {
    case 'folding': return folding(ctx, g, bag, THREE, title);
    case 'hemoglobin': return hemoglobin(ctx, g, bag, THREE);
    case 'membrane': return membrane(ctx, g, bag, THREE, title);
    case 'motor': return motor(ctx, g, bag, THREE, title);
    case 'dna':
    default: return dna(ctx, g, bag, THREE);
  }
}

/** 复制叉单链采样：x 小端为 intact 双螺旋，过叉点后两母链渐行渐开成 Y，臂上互补生成新链 */
function forkPoint(
  THREE: typeof import('three'),
  x: number,
  which: 'A' | 'B' | 'nA' | 'nB',
): import('three').Vector3 {
  const dStart = -1.6, dEnd = 0.4;
  const t = Math.max(0, Math.min(1, (x - dStart) / (dEnd - dStart)));
  const sm = t * t * (3 - 2 * t);
  const r = 1.0 + (0.42 - 1.0) * sm;   // 双螺旋半径 1.0 → 单链小螺旋半径 0.42
  const sep = 1.7 * sm;                 // 两母链中心随分叉渐行渐开
  const a = (x + 5.2) * 1.4;
  const cx = which === 'A' || which === 'nB' ? sep : -sep;
  const ph = which === 'A' || which === 'nA' ? a : a + Math.PI;
  return new THREE.Vector3(x, cx + r * Math.cos(ph), r * Math.sin(ph));
}

/** DNA 复制叉：双螺旋在解旋酶处拆解，两母链分开各带一条互补新链（半保留），聚合酶随生长端推进并校对 */
function dna(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
) {
  const dnaG = new THREE.Group(); // 仅旋转 DNA，不带动面板
  g.add(dnaG);
  const X0 = -5.2, X1 = 5.2, N = 260, armStart = 0.2, forkV = -0.6;

  // 两条母链（全程：双螺旋段 → 分叉后的两条单链臂）
  const mkParent = (which: 'A' | 'B', color: number) => {
    const pts: import('three').Vector3[] = [];
    for (let i = 0; i <= N; i++) pts.push(forkPoint(THREE, X0 + (i / N) * (X1 - X0), which));
    const ln = new THREE.Line(
      bag.geo(new THREE.BufferGeometry().setFromPoints(pts)),
      bag.mat(new THREE.LineBasicMaterial({ color })),
    );
    dnaG.add(ln);
  };
  mkParent('A', PAL.cyan);
  mkParent('B', PAL.pink);

  // 横档：单位高度圆柱，按两端点距离缩放
  const rungGeo = bag.geo(new THREE.CylinderGeometry(0.07, 0.07, 1, 6));
  const addRung = (a: import('three').Vector3, b: import('three').Vector3, col: number) => {
    const m = new THREE.Mesh(rungGeo, bag.mat(new THREE.MeshStandardMaterial({ color: col })));
    m.position.copy(a).add(b).multiplyScalar(0.5);
    const dir = b.clone().sub(a);
    m.scale.y = dir.length();
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    dnaG.add(m);
    return m;
  };
  // 解旋前双螺旋段：母链 A↔B 氢键横档（过叉点后消失=双螺旋拆解）
  const rungCols = [PAL.gold, PAL.green];
  let rc = 0;
  for (let x = X0 + 0.2; x <= -1.6; x += 0.5) {
    addRung(forkPoint(THREE, x, 'A'), forkPoint(THREE, x, 'B'), rungCols[rc++ % 2]);
  }

  // 两条新链（绿色）仅存在于分叉后的两臂上：nB 以母链 A 为模板，nA 以母链 B 为模板
  const mkDaughter = (which: 'nA' | 'nB') => {
    const pts: import('three').Vector3[] = [];
    for (let x = armStart; x <= X1 + 1e-6; x += 0.1) pts.push(forkPoint(THREE, x, which));
    const geo = bag.geo(new THREE.BufferGeometry().setFromPoints(pts));
    const line = new THREE.Line(geo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.green })));
    geo.setDrawRange(0, 0);
    dnaG.add(line);
    return { geo, total: pts.length };
  };
  const dTop = mkDaughter('nB');
  const dBot = mkDaughter('nA');
  // 臂内母链↔新链横档（随新链延伸逐段显现）
  const armRungs: import('three').Mesh[] = [];
  for (let x = armStart + 0.3; x <= X1 - 0.2; x += 0.6) {
    const r1 = addRung(forkPoint(THREE, x, 'A'), forkPoint(THREE, x, 'nB'), PAL.gold);
    const r2 = addRung(forkPoint(THREE, x, 'B'), forkPoint(THREE, x, 'nA'), PAL.pink);
    r1.userData['x'] = x; r2.userData['x'] = x;
    r1.visible = false; r2.visible = false;
    armRungs.push(r1, r2);
  }

  // 解旋酶（叉顶点，持续抖动=解旋）
  const helicase = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.4, 20, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.violet, emissive: 0x7c3aed, emissiveIntensity: 0.6 })),
  );
  helicase.position.set(forkV, 0, 0);
  dnaG.add(helicase);

  // DNA 聚合酶（沿两臂推进到生长端，行使合成+校对）
  const polGeo = bag.geo(new THREE.IcosahedronGeometry(0.28, 1));
  const polTop = new THREE.Mesh(polGeo, bag.mat(new THREE.MeshStandardMaterial({ color: PAL.amber, emissive: 0xb45309, emissiveIntensity: 0.4 })));
  const polBot = new THREE.Mesh(polGeo, bag.mat(new THREE.MeshStandardMaterial({ color: PAL.amber, emissive: 0xb45309, emissiveIntensity: 0.4 })));
  dnaG.add(polTop, polBot);

  g.add(panelSprite(THREE, bag, [
    { text: 'DNA 半保留复制：解旋酶打开双螺旋 → 复制叉呈 Y 形，两母链分开', color: '#f8fafc' },
    { text: '各以一条母链为模板互补配对(A=T·2H、G≡C·3H)合成新链(绿色)', color: '#22c55e' },
    { text: '聚合酶 3′→5′ 外切酶校对：错配碱基即时切除，复制保真度~10⁻⁹', color: '#fbbf24' },
  ], [0, 4.5, 0], 8.2, 'center'));

  ctx.camera.position.set(0, 1.2, 12);
  return (t: number) => {
    dnaG.rotation.y = t * 0.2;               // 立体展示双链解旋
    dnaG.rotation.x = 0.18 * Math.sin(t * 0.3);
    const progress = (t * 0.16) % 1;         // 每 ~6s 一轮延伸
    const revealX = armStart + progress * (X1 - armStart);
    const cnt = Math.max(0, Math.min(dTop.total, Math.floor((revealX - armStart) / 0.1) + 1));
    dTop.geo.setDrawRange(0, cnt);
    dBot.geo.setDrawRange(0, cnt);
    for (const m of armRungs) m.visible = (m.userData['x'] as number) <= revealX;
    helicase.rotation.y = t * 2.4;
    helicase.position.x = forkV + 0.08 * Math.sin(t * 3);
    const px = Math.min(revealX, X1 - 0.05);
    polTop.position.copy(forkPoint(THREE, px, 'nB'));
    polBot.position.copy(forkPoint(THREE, px, 'nA'));
  };
}

/** 蛋白质：α 螺旋 / β 折叠 / 能量漏斗，title 决定展示层次 */
function folding(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
) {
  const hierarchy = title.includes('结构层次');

  // α 螺旋（螺旋管）
  const alphaPts: import('three').Vector3[] = [];
  for (let i = 0; i <= 160; i++) {
    const u = i / 160;
    const th = u * 5.5 * Math.PI * 2;
    alphaPts.push(new THREE.Vector3(
      -2.6 + Math.cos(th) * 0.55,
      -2.2 + u * 4.4,
      Math.sin(th) * 0.55,
    ));
  }
  const alpha = new THREE.Mesh(
    bag.geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(alphaPts), 160, 0.17, 10, false)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, roughness: 0.4 })),
  );
  g.add(alpha);

  // β 折叠（箭头片）
  const beta = new THREE.Group();
  beta.position.set(2.7, 0, 0);
  g.add(beta);
  for (let i = 0; i < 4; i++) {
    const shape = new THREE.Shape();
    shape.moveTo(-0.22, -1.7);
    shape.lineTo(0.22, -1.7);
    shape.lineTo(0.22, 1.3);
    shape.lineTo(0, 1.75);
    shape.lineTo(-0.22, 1.3);
    shape.closePath();
    const m = new THREE.Mesh(
      bag.geo(new THREE.ExtrudeGeometry(shape, { depth: 0.09, bevelEnabled: false })),
      bag.mat(new THREE.MeshStandardMaterial({
        color: i % 2 ? PAL.pink : PAL.amber, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
      })),
    );
    m.position.x = (i - 1.5) * 0.62;
    m.rotation.x = (i % 2 ? 0.06 : -0.06);
    beta.add(m);
  }

  // 折叠漏斗（右侧：同心收缩的环表示能量下降）
  const funnel = new THREE.Group();
  funnel.position.set(0, 0, 0);
  const rings = 7;
  for (let i = 0; i < rings; i++) {
    const r = 3.0 - i * 0.38;
    const m = new THREE.Mesh(
      bag.geo(new THREE.TorusGeometry(r, 0.05, 6, 40)),
      bag.mat(new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.55 - i * 0.06, 0.7, 0.5).getHex(),
        transparent: true, opacity: 0.4,
      })),
    );
    m.rotation.x = Math.PI / 2;
    m.position.y = -2.6 + i * 0.55;
    funnel.add(m);
  }
  funnel.visible = !hierarchy;
  g.add(funnel);
  // 结构层次模式改用右侧四级"画廊"独立几何；非层次模式保留大 α/β 作为二级示例
  alpha.visible = !hierarchy;
  beta.visible = !hierarchy;

  // 在漏斗中滚下的"未折叠链"球
  const bead = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.22, 16, 12)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.green, emissive: 0x15803d, emissiveIntensity: 0.5 })),
  );
  bead.visible = !hierarchy;
  g.add(bead);

  // 能量漏斗粗糙度：两处亚稳局部极小（错折叠陷阱）+ 淀粉样聚集体示意（非层次模式）
  const trapU = [0.42, 0.74];
  if (!hierarchy) {
    const markGeo = bag.geo(new THREE.SphereGeometry(0.16, 10, 8));
    const markMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, emissive: 0x7f1d1d, emissiveIntensity: 0.4 }));
    for (const tu of trapU) {
      const r = 3.0 - tu * 2.4; const y = -2.6 + tu * 3.4;
      // 每个陷阱画成一圈凹陷（亚稳极小所在高度的粗糙"台阶"）
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * Math.PI * 2;
        const mk = new THREE.Mesh(markGeo, markMat);
        mk.position.set(r * Math.cos(ang), y, r * Math.sin(ang));
        funnel.add(mk);
      }
    }
    // 陷入陷阱的错误折叠聚集体（淀粉样纤维团，纠缠小球簇）
    const agg = new THREE.Group();
    const au = 0.74; const ar = 3.0 - au * 2.4;
    agg.position.set(ar + 0.35, -2.6 + au * 3.4, 0);
    const aggGeo = bag.geo(new THREE.SphereGeometry(0.15, 10, 8));
    const aggMat = bag.mat(new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 }));
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Mesh(aggGeo, aggMat);
      s.position.set(0.28 * Math.sin(i * 2.1), 0.24 * Math.cos(i * 1.3), 0.2 * Math.sin(i * 0.9));
      agg.add(s);
    }
    funnel.add(agg);
  }

  // 层次标签 + 四级"画廊"几何（结构层次模式）
  const labels: import('three').Sprite[] = [];
  let quaternary: import('three').Group | null = null;
  if (hierarchy) {
    const labelCols = ['#f8fafc', '#67e8f9', '#fbbf24', '#f472b6'];
    const rowsY = [2.4, 0.8, -0.8, -2.4];
    const bx = 3.0; // 画廊结构列中心
    const beadMats = [
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.white, roughness: 0.5 })),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, roughness: 0.45 })),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.amber, roughness: 0.5 })),
    ];
    const bGeo = bag.geo(new THREE.SphereGeometry(0.16, 12, 10));

    // 一级：氨基酸序列（伸展珠链）
    for (let k = 0; k < 9; k++) {
      const s = new THREE.Mesh(bGeo, beadMats[0]);
      s.position.set(bx - 1.0 + k * 0.25, rowsY[0], 0.4);
      g.add(s);
    }

    // 二级：α 螺旋 + β 折叠小样
    const miniA: import('three').Vector3[] = [];
    for (let i = 0; i <= 60; i++) {
      const u = i / 60; const th = u * 3 * Math.PI * 2;
      miniA.push(new THREE.Vector3(bx - 0.75 + Math.cos(th) * 0.22, rowsY[1] - 0.5 + u * 1.0, 0.4 + Math.sin(th) * 0.22));
    }
    g.add(new THREE.Mesh(
      bag.geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(miniA), 60, 0.09, 8, false)),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, roughness: 0.4 })),
    ));
    for (let i = 0; i < 2; i++) {
      const sh = new THREE.Shape();
      sh.moveTo(-0.12, -0.5); sh.lineTo(0.12, -0.5); sh.lineTo(0.12, 0.35); sh.lineTo(0, 0.55); sh.lineTo(-0.12, 0.35); sh.closePath();
      const p = new THREE.Mesh(
        bag.geo(new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false })),
        bag.mat(new THREE.MeshStandardMaterial({ color: i % 2 ? PAL.pink : PAL.amber, side: THREE.DoubleSide })),
      );
      p.position.set(bx + 0.55 + i * 0.34, rowsY[1], 0.3);
      g.add(p);
    }

    // 三级：收拢的珠链球体（结构域）
    const globPts: import('three').Vector3[] = [];
    for (let k = 0; k <= 26; k++) {
      const a = k * 0.62; const rr = 0.18 + 0.42 * Math.abs(Math.sin(k * 0.5));
      globPts.push(new THREE.Vector3(
        bx + rr * Math.cos(a), rowsY[2] + rr * Math.sin(a) * 0.85, 0.4 + rr * Math.cos(k * 0.7) * 0.5,
      ));
    }
    g.add(new THREE.Mesh(
      bag.geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(globPts), 90, 0.07, 8, false)),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.violet, roughness: 0.45 })),
    ));

    // 四级：2α2β 亚基拼合体（呼吸式装配 → 示意变构）
    quaternary = new THREE.Group();
    quaternary.position.set(bx, rowsY[3], 0.4);
    const subGeo = bag.geo(new THREE.IcosahedronGeometry(0.46, 2));
    const subCols = [PAL.cyan, PAL.cyan, PAL.amber, PAL.amber];
    const subPos = [[-0.42, 0.32, 0], [0.42, 0.32, 0.2], [-0.42, -0.32, -0.2], [0.42, -0.32, 0]];
    subPos.forEach((p, i) => {
      const m = new THREE.Mesh(subGeo, bag.mat(new THREE.MeshStandardMaterial({
        color: subCols[i], transparent: true, opacity: 0.8, roughness: 0.5,
      })));
      m.position.set(p[0], p[1], p[2]);
      quaternary!.add(m);
    });
    g.add(quaternary);

    // 四行标签（左列）+ 引线指向对应结构
    ['一级：氨基酸序列', '二级：α 螺旋 / β 折叠', '三级：球状折叠(结构域)', '四级：亚基组装(变构)'].forEach((txt, i) => {
      const cv = document.createElement('canvas');
      cv.width = 340; cv.height = 56;
      const c = cv.getContext('2d')!;
      c.fillStyle = 'rgba(7,11,20,0.78)'; c.fillRect(0, 0, 340, 56);
      c.fillStyle = labelCols[i];
      c.font = '26px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(txt, 170, 28);
      const tex = bag.tex(new THREE.CanvasTexture(cv));
      const sp = new THREE.Sprite(bag.mat(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })));
      sp.scale.set(3.6, 0.6, 1);
      sp.position.set(-4.6, rowsY[i], 2.0);
      sp.renderOrder = 998;
      g.add(sp);
      labels.push(sp);
      // 引线：标签右缘 → 结构左缘（同高）
      const leader = new THREE.Line(
        bag.geo(new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-2.7, rowsY[i], 2.0), new THREE.Vector3(bx - 1.3, rowsY[i], 0.4),
        ])),
        bag.mat(new THREE.LineBasicMaterial({ color: new THREE.Color(labelCols[i]).getHex() })),
      );
      leader.renderOrder = 997;
      g.add(leader);
    });
  }

  g.add(panelSprite(THREE, bag, hierarchy ? [
    { text: '蛋白质结构层次：一级(序列)→二级(α/β)→三级(球状结构域)→四级(多亚基)', color: '#f8fafc' },
    { text: '二级由主链 C=O···H–N 氢键维持；三级疏水塌缩折叠成结构域(domain)', color: '#94a3b8' },
    { text: '四级亚基协同产生变构(allostery)：配体结合→构象跨亚基传递(如 Hb T→R)', color: '#fbbf24' },
  ] : [
    { text: '折叠能量漏斗：构象熵↓→焓↓，净自由能降低（漏斗粗糙有局部极小）', color: '#f8fafc' },
    { text: '折叠速率 k ∝ e^(−ΔG‡/kT)：陷入亚稳极小需越能垒，耗时骤增', color: '#fbbf24' },
    { text: '错误折叠滞留可聚集成淀粉样纤维（如朊病毒/阿尔茨海默病根源）', color: '#f87171' },
  ], [0, 4.4, 0], 7.8, 'center'));

  ctx.camera.position.set(0, 1.5, 12);
  // 折叠速率读数（5Hz）：du/dt 表征自由下落 vs 被困亚稳极小（越能垒前后速率骤变）
  let rateCv: HTMLCanvasElement | null = null; let rateCtx: CanvasRenderingContext2D | null = null;
  let rateTex: import('three').CanvasTexture | null = null; let lastRate = 0;
  if (!hierarchy) {
    rateCv = document.createElement('canvas');
    rateCv.width = 320; rateCv.height = 56;
    rateCtx = rateCv.getContext('2d')!;
    rateTex = bag.tex(new THREE.CanvasTexture(rateCv));
    const rsp = new THREE.Sprite(bag.mat(new THREE.SpriteMaterial({ map: rateTex, transparent: true, depthTest: false })));
    rsp.scale.set(3.6, 0.63, 1);
    rsp.position.set(-3.2, -2.8, 2.0);
    rsp.renderOrder = 998;
    g.add(rsp);
  }
  const foldState = (ph: number): [number, number, string] => {
    if (ph < 1.9) return [0.42 * ph / 1.9, 0.42 / 1.9, '下落 funnel'];
    if (ph < 3.6) return [0.42, 0, '被困 亚稳极小'];
    if (ph < 5.0) return [0.42 + 0.32 * (ph - 3.6) / 1.4, 0.32 / 1.4, '越过能垒 ↓'];
    if (ph < 6.4) return [0.74, 0, '滞留→淀粉样聚集'];
    if (ph < 7.6) return [0.74 + 0.26 * (ph - 6.4) / 1.2, 0.26 / 1.2, '→天然态 N'];
    return [1.0, 0, '天然态 N（达底）'];
  };
  return (t: number) => {
    if (!hierarchy) {
      const [u, dudt, st] = foldState(t % 8.0);
      const r = 3.0 - u * 2.4;
      const y = -2.6 + u * 3.4;
      // 角度按时间推进：被困(dudt=0)时半径/高度固定 → 球在凹陷内盘旋（局部极小滞留）
      const ang = t * 1.3;
      const wob = dudt === 0 ? 0.05 * Math.sin(t * 7) : 0;
      bead.position.set(r * Math.cos(ang) + wob, y, r * Math.sin(ang) + wob);
      // 5Hz 刷新速率读数
      if (rateCtx && rateTex && t - lastRate > 0.2) {
        lastRate = t;
        rateCtx.clearRect(0, 0, 320, 56);
        rateCtx.fillStyle = 'rgba(7,11,20,0.78)'; rateCtx.fillRect(0, 0, 320, 56);
        rateCtx.font = '22px sans-serif'; rateCtx.textAlign = 'center'; rateCtx.textBaseline = 'middle';
        rateCtx.fillStyle = dudt > 0 ? '#22c55e' : '#f87171';
        rateCtx.fillText(`${st}  k∝e^(−ΔG‡/kT) du/dt=${dudt.toFixed(2)}`, 160, 28);
        rateTex.needsUpdate = true;
      }
    } else if (quaternary) {
      // 四级亚基拼合体的呼吸式装配（示意变构）
      quaternary.rotation.y = t * 0.4;
      quaternary.scale.setScalar(1 + 0.07 * Math.sin(t * 1.6));
    }
    // α 螺旋缓慢自转，展示螺旋性
    alpha.rotation.y = t * 0.35;
    beta.rotation.y = -t * 0.2;
  };
}

/** 血红蛋白：四亚基 T↔R 协同转变 +  sigmoid 结合曲线 */
function hemoglobin(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
) {
  // 四个亚基（2α 2β）
  const subs = [
    { p: new THREE.Vector3(-1.5, -0.4, 0.6), col: PAL.cyan, r: 1.15, kind: 'α' },
    { p: new THREE.Vector3(1.5, 0.4, -0.6), col: PAL.cyan, r: 1.15, kind: 'α' },
    { p: new THREE.Vector3(-1.4, 0.9, -0.8), col: PAL.amber, r: 1.3, kind: 'β' },
    { p: new THREE.Vector3(1.4, -0.9, 0.8), col: PAL.amber, r: 1.3, kind: 'β' },
  ];
  const meshes = subs.map((s) => {
    const m = new THREE.Mesh(
      bag.geo(new THREE.IcosahedronGeometry(s.r, 2)),
      bag.mat(new THREE.MeshStandardMaterial({ color: s.col, transparent: true, opacity: 0.72, roughness: 0.5 })),
    );
    m.position.copy(s.p);
    g.add(m);
    return m;
  });

  // 血红素辅基（Fe²⁺）与 O₂ 结合位点
  const hemes = subs.map((s) => {
    const h = new THREE.Mesh(
      bag.geo(new THREE.SphereGeometry(0.24, 16, 12)),
      bag.mat(new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.6 })),
    );
    h.position.copy(s.p);
    g.add(h);
    // O₂ 小分子（可分离）
    const o2 = new THREE.Mesh(
      bag.geo(new THREE.SphereGeometry(0.16, 12, 10)),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.white, emissive: 0x94a3b8, emissiveIntensity: 0.4 })),
    );
    g.add(o2);
    return { h, o2, base: s.p.clone(), bound: false };
  });

  // sigmoid 结合曲线
  const cv = document.createElement('canvas');
  cv.width = 340; cv.height = 300;
  const c2 = cv.getContext('2d')!;
  const tex = bag.tex(new THREE.CanvasTexture(cv));
  const plot = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(3.9, 3.44)),
    bag.mat(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false })),
  );
  plot.position.set(6.4, 0.4, 0);
  plot.renderOrder = 997;
  g.add(plot);

  function drawCurve(p50: number, sat: number): void {
    const W = 340, H = 300;
    c2.clearRect(0, 0, W, H);
    c2.fillStyle = 'rgba(7,11,20,0.85)'; c2.fillRect(0, 0, W, H);
    c2.strokeStyle = '#334155'; c2.lineWidth = 3; c2.strokeRect(1.5, 1.5, W - 3, H - 3);
    c2.strokeStyle = '#475569'; c2.beginPath();
    c2.moveTo(48, 18); c2.lineTo(48, 258); c2.lineTo(W - 14, 258); c2.stroke();
    c2.fillStyle = '#94a3b8'; c2.font = '16px sans-serif'; c2.textAlign = 'center';
    c2.fillText('Y (饱和度)', 26, 30); c2.fillText('pO₂ (mmHg)', W / 2, H - 10);
    // 参考：双曲线（无协同）
    c2.strokeStyle = '#64748b'; c2.lineWidth = 2; c2.beginPath();
    for (let i = 1; i <= 120; i++) {
      const x = (i / 120) * 100;
      const Y = x / (26 + x);
      const px = 48 + (x / 100) * (W - 64);
      const py = 258 - Y * 236;
      if (i === 1) c2.moveTo(px, py); else c2.lineTo(px, py);
    }
    c2.stroke();
    // Hill 方程（协同）
    c2.strokeStyle = '#f59e0b'; c2.lineWidth = 4; c2.beginPath();
    for (let i = 1; i <= 120; i++) {
      const x = (i / 120) * 100;
      const Y = Math.pow(x, 2.8) / (Math.pow(p50, 2.8) + Math.pow(x, 2.8));
      const px = 48 + (x / 100) * (W - 64);
      const py = 258 - Y * 236;
      if (i === 1) c2.moveTo(px, py); else c2.lineTo(px, py);
    }
    c2.stroke();
    // 当前饱和度游标：纵坐标与 Hill 曲线同源（sat 即 pO₂，取 Y 值落到曲线上）
    const cur = Math.pow(sat, 2.8) / (Math.pow(p50, 2.8) + Math.pow(sat, 2.8));
    c2.fillStyle = '#22c55e';
    c2.beginPath(); c2.arc(48 + (sat / 100) * (W - 64), 258 - cur * 236, 7, 0, 7); c2.fill();
    c2.strokeStyle = '#22c55e'; c2.lineWidth = 2;
    c2.beginPath(); c2.arc(48 + (sat / 100) * (W - 64), 258 - cur * 236, 11, 0, 7); c2.stroke();
    c2.textAlign = 'left'; c2.font = '16px sans-serif';
    c2.fillStyle = '#f59e0b'; c2.fillText('— 协同结合 (Hill n≈2.8)', 60, 52);
    c2.fillStyle = '#64748b'; c2.fillText('— 无协同 (双曲线)', 60, 74);
    c2.fillStyle = '#f8fafc'; c2.fillText(`p₅₀ ≈ ${p50.toFixed(0)} mmHg`, 60, 98);
    c2.fillStyle = '#22c55e'; c2.fillText(`当前 Y ≈ ${(cur * 100).toFixed(0)}%`, 60, 120);
    tex.needsUpdate = true;
  }
  drawCurve(26, 50);

  g.add(panelSprite(THREE, bag, [
    { text: '血红蛋白 2α2β 协同结合：T 态 → R 态', color: '#f8fafc' },
    { text: 'Hill 方程 Y = pO₂ⁿ/(p₅₀ⁿ+pO₂ⁿ)，n ≈ 2.8（强协同）', color: '#94a3b8' },
    { text: 'Bohr 效应：酸性/高 CO₂ 使 p₅₀ 右移，促进 O₂ 释放', color: '#fbbf24' },
  ], [0, 4.6, 0], 7.8, 'center'));

  ctx.camera.position.set(0, 2, 13);
  let lastP = -1;
  return (t: number) => {
    // pO₂ 周期变化，观察 T→R 转变与结合
    const pO2 = 50 * (Math.sin(t * 0.3) * 0.5 + 0.5);
    const Y = Math.pow(pO2, 2.8) / (Math.pow(26, 2.8) + Math.pow(pO2, 2.8));
    // 结合越多 → 亚基间距变化（T→R 构象变化）
    const shift = 0.28 * Y;
    meshes.forEach((m, i) => {
      const s = subs[i];
      const dir = s.p.clone().normalize();
      m.position.copy(s.p).addScaledVector(dir, shift);
      m.rotation.y = t * 0.2 * (i % 2 ? 1 : -1);
    });
    hemes.forEach((h, i) => {
      const dir = subs[i].p.clone().normalize();
      h.h.position.copy(subs[i].p).addScaledVector(dir, shift);
      h.bound = Y > 0.12 * (i + 1);
      // O₂ 结合时贴近血红素，否则向外扩散
      const target = h.h.position.clone().add(new THREE.Vector3(0, h.bound ? 0.3 : 0.9, 0));
      h.o2.position.lerp(target, 0.06);
      (h.o2.material as import('three').MeshStandardMaterial).opacity = 1;
    });
    const bucket = Math.round(pO2 / 4);
    if (bucket !== lastP) { lastP = bucket; drawCurve(26, pO2); }
  };
}

/** 细胞膜（流体镶嵌）/ 光合作用类囊体电子传递 */
function membrane(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
) {
  const photo = title.includes('光合');

  if (photo) {
    // 类囊体膜 + 光系统 + 电子传递链
    const membraneMesh = new THREE.Mesh(
      bag.geo(new THREE.BoxGeometry(11, 0.9, 2.6)),
      bag.mat(new THREE.MeshStandardMaterial({ color: 0x14532d, transparent: true, opacity: 0.6 })),
    );
    g.add(membraneMesh);

    // 光系统 II / 细胞色素 b6f / 光系统 I
    const complexes = [
      { x: -3.6, col: PAL.green, name: 'PS II' },
      { x: 0, col: PAL.amber, name: 'Cyt b₆f' },
      { x: 3.4, col: PAL.green, name: 'PS I' },
    ];
    complexes.forEach((c) => {
      const m = new THREE.Mesh(
        bag.geo(new THREE.BoxGeometry(1.5, 1.9, 1.9)),
        bag.mat(new THREE.MeshStandardMaterial({ color: c.col, roughness: 0.5 })),
      );
      m.position.set(c.x, 0, 0);
      g.add(m);
    });

    // 电子（在复合体间跳跃）
    const eGeo = bag.geo(new THREE.SphereGeometry(0.18, 14, 12));
    const eMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, emissive: 0x0891b2, emissiveIntensity: 1 }));
    const electrons: import('three').Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(eGeo, eMat);
      g.add(m);
      electrons.push(m);
    }

    // ATP 合酶（右端旋转）
    const atp = new THREE.Group();
    atp.position.set(5.4, 0, 0);
    g.add(atp);
    const stalk = new THREE.Mesh(
      bag.geo(new THREE.CylinderGeometry(0.16, 0.16, 2.2, 12)),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.violet })),
    );
    atp.add(stalk);
    const head = new THREE.Mesh(
      bag.geo(new THREE.SphereGeometry(0.65, 18, 14)),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.pink })),
    );
    head.position.y = 1.4;
    atp.add(head);

    // 光子（两次光激发：分别打在 PSII 与 PSI）
    for (const px of [-3.6, 3.4]) {
      for (let i = 0; i < 2; i++) {
        const a = new THREE.ArrowHelper(
          new THREE.Vector3(0.1, -1, 0.1), new THREE.Vector3(px - 0.35 + i * 0.7, 3.5, 0.5), 1.7, PAL.gold, 0.22, 0.12,
        );
        g.add(a);
      }
    }

    // Z 方案氧化还原电位阶梯图（背面示意）：电子升能→降能→再升能→再降能，呈 Z 形
    const ZN: [number, number][] = [[-3.9, -1.2], [-3.6, 1.3], [0, -0.5], [3.4, -0.1], [3.4, 1.8], [4.8, 0.6]];
    const zc = (x: number) => 50 + (x + 3.9) / 8.7 * 350;
    const zy = (y: number) => 150 - y * 70;
    const zcv = document.createElement('canvas');
    zcv.width = 420; zcv.height = 300;
    const zctx = zcv.getContext('2d')!;
    zctx.fillStyle = 'rgba(7,11,20,0.9)'; zctx.fillRect(0, 0, 420, 300);
    zctx.strokeStyle = '#334155'; zctx.lineWidth = 3; zctx.strokeRect(2, 2, 416, 296);
    zctx.strokeStyle = '#475569'; zctx.beginPath(); zctx.moveTo(34, 20); zctx.lineTo(34, 272); zctx.lineTo(410, 272); zctx.stroke();
    zctx.fillStyle = '#94a3b8'; zctx.font = '15px sans-serif'; zctx.textAlign = 'center';
    zctx.save(); zctx.translate(16, 150); zctx.rotate(-Math.PI / 2); zctx.fillText('氧化还原电位 E（升=更高能）', 0, 0); zctx.restore();
    zctx.fillText('电子传递 →', 220, 290);
    // Z 形阶梯折线
    zctx.strokeStyle = '#22d3ee'; zctx.lineWidth = 4; zctx.beginPath();
    ZN.forEach((p, i) => { if (i === 0) zctx.moveTo(zc(p[0]), zy(p[1])); else zctx.lineTo(zc(p[0]), zy(p[1])); });
    zctx.stroke();
    // 节点与标注
    const names = ['H₂O/PSII', 'P680*', 'Cyt b₆f', 'PC/PSI', 'P700*', 'Fd→NADPH'];
    ZN.forEach((p, i) => {
      zctx.fillStyle = (i === 1 || i === 4) ? '#f59e0b' : '#e2e8f0';
      zctx.beginPath(); zctx.arc(zc(p[0]), zy(p[1]), 5, 0, 7); zctx.fill();
      zctx.fillStyle = '#cbd5e1'; zctx.font = '12px sans-serif'; zctx.textAlign = 'center';
      zctx.fillText(names[i], zc(p[0]), zy(p[1]) + (i === 1 || i === 4 ? -12 : 18));
    });
    // 两次 hν 激发箭头（竖直向上）
    zctx.strokeStyle = '#fbbf24'; zctx.fillStyle = '#fbbf24'; zctx.lineWidth = 3;
    for (const [ax, ay] of [[-3.9, -1.2], [3.4, -0.1]] as [number, number][]) {
      zctx.beginPath(); zctx.moveTo(zc(ax) - 20, zy(ay) + 6); zctx.lineTo(zc(ax), zy(ay) - 4); zctx.stroke();
      zctx.fillText('hν', zc(ax) - 26, zy(ay) + 4);
    }
    zctx.fillStyle = '#67e8f9'; zctx.textAlign = 'left'; zctx.font = '13px sans-serif';
    zctx.fillText('量子产率 Φ≈0.1 O₂/光子', 40, 40);
    zctx.fillText('每放 1 O₂ 约需 8–10 光子', 40, 58);
    const zTex = bag.tex(new THREE.CanvasTexture(zcv));
    const zPlane = new THREE.Mesh(
      bag.geo(new THREE.PlaneGeometry(5.0, 3.57)),
      bag.mat(new THREE.MeshBasicMaterial({ map: zTex, transparent: true, depthTest: true, side: THREE.DoubleSide })),
    );
    zPlane.position.set(0.4, 3.0, -1.9);
    g.add(zPlane);

    // 水光解产物：O₂ 逸出 + H⁺ 进入类囊体腔（膜下方）
    const o2pair = new THREE.Group();
    o2pair.position.set(-4.9, -0.7, 0.4);
    g.add(o2pair);
    for (const dx of [-0.17, 0.17]) {
      const s = new THREE.Mesh(
        bag.geo(new THREE.SphereGeometry(0.16, 12, 10)),
        bag.mat(new THREE.MeshStandardMaterial({ color: PAL.red, emissive: 0x991b1b, emissiveIntensity: 0.5 })),
      );
      s.position.x = dx;
      o2pair.add(s);
    }
    const protons: import('three').Mesh[] = [];
    const pGeo = bag.geo(new THREE.SphereGeometry(0.1, 8, 8));
    const pMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: 0xb45309, emissiveIntensity: 0.7 }));
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(pGeo, pMat);
      g.add(m); protons.push(m);
    }

    g.add(panelSprite(THREE, bag, [
      { text: 'Z 方案：PSII 光激发升能 → 经 Cyt b₆f 降能 → PSI 再光激发 → 还原 NADP⁺', color: '#f8fafc' },
      { text: '水光解 2H₂O → O₂↑ + 4H⁺ + 4e⁻；e⁻ 补足 PSII 失电子缺额', color: '#67e8f9' },
      { text: '质子梯度 Δp≈200 mV 驱动 ATP 合酶，每 4 H⁺ 转一圈约 1 ATP', color: '#fbbf24' },
      { text: '量子产率 Φ≈0.1 O₂/光子（每释放 1 O₂ 需 ~8–10 光子，Emerson）', color: '#f472b6' },
    ], [0, 5.4, 0], 8.0, 'center'));

    ctx.camera.position.set(0, 2.6, 13);
    const pathPos = (u: number): [number, number] => {
      const seg = u * 5; const i = Math.min(4, Math.floor(seg)); const f = seg - i;
      const a = ZN[i], b = ZN[i + 1];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    };
    return (t: number) => {
      electrons.forEach((e, i) => {
        const u = ((t * 0.32 + i / 3) % 1);
        // 电子纵向坐标改用 Z 方案阶梯电位：两次光激发处竖直跃升，其余沿链降能
        const [x, y] = pathPos(u);
        e.position.set(x, y, 0.4);
      });
      atp.rotation.y = t * 3.0; // ATP 合酶旋转催化
      // O₂ 逸出上浮 + H⁺ 向下泵入腔内（周期性）
      o2pair.position.y = -0.7 + 0.12 * Math.sin(t * 1.5);
      o2pair.rotation.z = 0.2 * Math.sin(t * 1.2);
      protons.forEach((m, i) => {
        const u = (t * 0.5 + i / 6) % 1;
        m.position.set(-3.9 + 0.4 * Math.sin(u * 6 + i), -0.5 - u * 1.5, 0.3);
      });
    };
  }


  // 磷脂双层（流体镶嵌）
  const NP = 26;
  const heads: import('three').Mesh[] = [];
  const headGeo = bag.geo(new THREE.SphereGeometry(0.2, 12, 10));
  const headMatTop = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan }));
  const headMatBot = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan }));
  const tailGeo = bag.geo(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6));
  const tailMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.slate }));
  const jitter: number[] = [];
  for (let i = 0; i < NP; i++) {
    const x = (i / (NP - 1)) * 11 - 5.5;
    jitter.push(Math.random() * Math.PI * 2);
    for (const s of [1, -1]) {
      const h = new THREE.Mesh(headGeo, s > 0 ? headMatTop : headMatBot);
      h.position.set(x, s * 0.55, 0);
      g.add(h);
      heads.push(h);
      for (const dz of [-0.06, 0.06]) {
        const tl = new THREE.Mesh(tailGeo, tailMat);
        tl.position.set(x, s * 0.28, dz);
        g.add(tl);
      }
    }
  }
  // 膜平面
  const sheet = new THREE.Mesh(
    bag.geo(new THREE.PlaneGeometry(11.4, 3.0)),
    bag.mat(new THREE.MeshBasicMaterial({ color: 0x1e3a5f, transparent: true, opacity: 0.25, side: THREE.DoubleSide })),
  );
  sheet.rotation.x = -Math.PI / 2;
  g.add(sheet);

  // 整合蛋白（在膜中横向扩散）
  const protein = new THREE.Mesh(
    bag.geo(new THREE.CapsuleGeometry(0.42, 1.1, 8, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.pink, roughness: 0.5 })),
  );
  g.add(protein);

  // 选择透过：亲水通道蛋白 + 穿膜水分子 + 被疏水核心阻挡的大分子/离子
  const chanX = -1.8;
  const channel = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.34, 0.34, 1.9, 18, 1, true)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.violet, transparent: true, opacity: 0.85, side: THREE.DoubleSide })),
  );
  channel.position.set(chanX, 0, 0);
  g.add(channel);
  for (const s of [1, -1]) {
    const lip = new THREE.Mesh(
      bag.geo(new THREE.TorusGeometry(0.34, 0.07, 8, 18)),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.violet })),
    );
    lip.rotation.x = Math.PI / 2;
    lip.position.set(chanX, s * 0.95, 0);
    g.add(lip);
  }
  // 沿通道自上而下穿膜的水分子
  const water: import('three').Mesh[] = [];
  const waterGeo = bag.geo(new THREE.SphereGeometry(0.12, 10, 8));
  const waterMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan, emissive: 0x0e7490, emissiveIntensity: 0.6 }));
  const waterPhase: number[] = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(waterGeo, waterMat);
    g.add(m); water.push(m); waterPhase.push(i / 5);
  }
  // 被阻挡的大分子/离子（Na⁺/葡萄糖/氨基酸），只能在膜外侧反弹
  const blocked: import('three').Mesh[] = [];
  const blockCols = [PAL.amber, PAL.pink, PAL.red];
  const blockGeo = bag.geo(new THREE.SphereGeometry(0.27, 12, 10));
  const blockX = [1.1, 2.5, 3.8];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(blockGeo, bag.mat(new THREE.MeshStandardMaterial({ color: blockCols[i], roughness: 0.5 })));
    m.position.set(blockX[i], 1.2, 0);
    g.add(m); blocked.push(m);
  }

  g.add(panelSprite(THREE, bag, [
    { text: '流动镶嵌模型：磷脂双层为二维流体，蛋白侧向扩散', color: '#f8fafc' },
    { text: '选择透过性：水经亲水通道穿膜，大分子/离子被疏水核心阻挡', color: '#67e8f9' },
    { text: '疏水尾相对埋在内侧，亲水头朝向水相（自组装）', color: '#94a3b8' },
    { text: '相变温度 T_c 以上为液晶态；胆固醇调节膜流动性', color: '#fbbf24' },
  ], [0, 4.4, 0], 7.8, 'center'));

  ctx.camera.position.set(0, 3.2, 12);
  return (t: number) => {
    heads.forEach((h, i) => {
      h.position.y = Math.sign(h.position.y) * (0.55 + 0.05 * Math.sin(t * 1.6 + jitter[i]));
    });
    protein.position.set(3.6 * Math.sin(t * 0.32), 0, 0.4 * Math.sin(t * 0.5));
    protein.rotation.z = 0.12 * Math.sin(t * 0.9);
    // 水分子逐一流经通道（上→下周期性穿越）
    water.forEach((m, i) => {
      const u = (t * 0.5 + waterPhase[i]) % 1;
      m.position.set(chanX + 0.05 * Math.sin(u * 10 + i), 1.7 - u * 3.4, 0.05 * Math.cos(u * 8));
    });
    // 大分子/离子撞向膜面即被弹回，始终留在膜外（不能自由穿膜）
    blocked.forEach((m, i) => {
      m.position.y = 0.75 + 0.6 * Math.abs(Math.sin(t * 1.1 + i));
      m.position.x = blockX[i] + 0.25 * Math.sin(t * 0.6 + i);
      m.rotation.y = t * 0.8;
    });
  };
}

/** 分子马达：驱动蛋白行走 / 细菌鞭毛马达 / 肌肉横桥周期 */
function motor(
  ctx: SceneContext,
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
) {
  const flagellar = title.includes('鞭毛');
  const muscle = title.includes('肌肉');

  if (flagellar) {
    // 细菌鞭毛马达：定子 + 转子 + 鞭毛丝
    const statorRing = new THREE.Mesh(
      bag.geo(new THREE.TorusGeometry(1.8, 0.2, 10, 40)),
      bag.mat(new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.5 })),
    );
    statorRing.rotation.x = Math.PI / 2;
    g.add(statorRing);
    // 细胞膜
    const cell = new THREE.Mesh(
      bag.geo(new THREE.CylinderGeometry(3.2, 3.2, 0.7, 40, 1, true)),
      bag.mat(new THREE.MeshStandardMaterial({
        color: 0x14532d, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
      })),
    );
    g.add(cell);
    // 转子（MS 环）
    const rotor = new THREE.Group();
    g.add(rotor);
    const msRing = new THREE.Mesh(
      bag.geo(new THREE.CylinderGeometry(1.1, 1.1, 0.35, 24)),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.gold, metalness: 0.6, roughness: 0.4 })),
    );
    rotor.add(msRing);
    // 十个共轴环亚基
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const p = new THREE.Mesh(
        bag.geo(new THREE.BoxGeometry(0.24, 0.5, 0.24)),
        bag.mat(new THREE.MeshStandardMaterial({ color: PAL.amber })),
      );
      p.position.set(Math.cos(a) * 0.95, 0.1, Math.sin(a) * 0.95);
      rotor.add(p);
    }
    // 鞭毛钩 + 丝（正弦曲线）
    const hookPts: import('three').Vector3[] = [];
    const filamentPts: import('three').Vector3[] = [];
    for (let i = 0; i <= 200; i++) {
      const u = i / 200;
      const y = 0.3 + u * 5.5;
      const bend = Math.min(1, u * 3) * 0.9;
      const ph = u * 9;
      filamentPts.push(new THREE.Vector3(
        bend * Math.cos(ph) * (0.4 + u * 0.8),
        y,
        bend * Math.sin(ph) * (0.4 + u * 0.8),
      ));
      if (i < 24) hookPts.push(new THREE.Vector3(0.2 * Math.sin(u * 4), 0.3 + u * 0.6, 0));
    }
    const filament = new THREE.Line(
      bag.geo(new THREE.BufferGeometry().setFromPoints(filamentPts)),
      bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan })),
    );
    g.add(filament);
    g.add(new THREE.Mesh(
      bag.geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hookPts), 24, 0.12, 8, false)),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.violet })),
    ));

    g.add(panelSprite(THREE, bag, [
      { text: '细菌鞭毛马达：质子/钠离子流驱动，转速可达 10⁵ rpm', color: '#f8fafc' },
      { text: '定子（膜内）不动，转子（MS 环 + 钩 + 丝）旋转', color: '#94a3b8' },
      { text: '每转消耗 ~10³ H⁺；可瞬间反转实现趋化', color: '#fbbf24' },
    ], [0, 5.0, 0], 7.8, 'center'));

    ctx.camera.position.set(0, 4, 12);
    // 倒转状态：每 ~8s 瞬时翻转转向（趋化 run↔tumble）
    let dir = 1; let spin = 0; let lastFlip = 0; let lastStatus = 0;
    // 转向读数牌（5Hz 刷新）
    const statusCv = document.createElement('canvas');
    statusCv.width = 300; statusCv.height = 64;
    const sc = statusCv.getContext('2d')!;
    const statusTex = bag.tex(new THREE.CanvasTexture(statusCv));
    const statusSprite = new THREE.Sprite(bag.mat(new THREE.SpriteMaterial({ map: statusTex, transparent: true, depthTest: false })));
    statusSprite.scale.set(4.0, 0.85, 1);
    statusSprite.position.set(0, 1.1, 1.4);
    statusSprite.renderOrder = 998;
    g.add(statusSprite);
    const drawStatus = (d: number) => {
      sc.clearRect(0, 0, 300, 64);
      sc.fillStyle = 'rgba(7,11,20,0.78)'; sc.fillRect(0, 0, 300, 64);
      sc.strokeStyle = 'rgba(51,65,85,0.9)'; sc.lineWidth = 3; sc.strokeRect(1.5, 1.5, 297, 61);
      sc.font = '25px sans-serif'; sc.textAlign = 'center'; sc.textBaseline = 'middle';
      sc.fillStyle = d > 0 ? '#22c55e' : '#f59e0b';
      sc.fillText(d > 0 ? 'CCW 束丝 → 趋行 run' : 'CW 解丝 → 翻滚 tumble', 150, 34);
      statusTex.needsUpdate = true;
    };
    drawStatus(dir);
    return (t: number, dt: number) => {
      if (t - lastFlip > 8) { lastFlip = t; dir = -dir; } // 瞬时反转
      spin += dt * 14 * dir;
      rotor.rotation.y = spin;
      // 螺旋旋向随转向镜像翻转：z 轴反射即改变手性（CCW 束丝 ↔ CW 解丝）
      filament.scale.z = dir;
      filament.rotation.y = -spin * 0.35;
      filament.rotation.x = 0.1 * Math.sin(t * 2);
      if (t - lastStatus > 0.2) { lastStatus = t; drawStatus(dir); }
    };
  }

  if (muscle) {
    // 肌节：粗丝（肌球蛋白）+ 细丝（肌动蛋白）滑动
    const sarcomere = new THREE.Group();
    g.add(sarcomere);
    // 细丝（肌动蛋白）分左右两半：外端锚定在 Z 线上，收缩时随 Z 线同步向中央滑移
    const thinL = new THREE.Group();
    const thinR = new THREE.Group();
    sarcomere.add(thinL, thinR);
    const halves: { grp: import('three').Group; sign: number }[] = [
      { grp: thinL, sign: -1 }, { grp: thinR, sign: 1 },
    ];
    for (const y of [1.3, -1.3]) {
      for (const h of halves) {
        const l = new THREE.Line(
          bag.geo(new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(h.sign * 4.6, y, 0), new THREE.Vector3(h.sign * 0.9, y, 0),
          ])),
          bag.mat(new THREE.LineBasicMaterial({ color: PAL.green })),
        );
        h.grp.add(l);
        // 横桥结合位点（随细丝一起滑动，直观呈现"丝滑动"）
        for (let i = 2; i <= 7; i++) {
          const s = new THREE.Mesh(
            bag.geo(new THREE.SphereGeometry(0.11, 8, 8)),
            bag.mat(new THREE.MeshBasicMaterial({ color: PAL.cyan })),
          );
          s.position.set(h.sign * i * 0.6, y + (y > 0 ? -0.25 : 0.25), 0);
          h.grp.add(s);
        }
      }
    }
    // 肌球蛋白粗丝（中间束 + 横桥）
    const thick = new THREE.Mesh(
      bag.geo(new THREE.CylinderGeometry(0.16, 0.16, 7.5, 10)),
      bag.mat(new THREE.MeshStandardMaterial({ color: PAL.pink })),
    );
    thick.rotation.z = Math.PI / 2;
    g.add(thick);
    const bridges: import('three').Mesh[] = [];
    const bridgeGeo = bag.geo(new THREE.CapsuleGeometry(0.08, 0.5, 4, 8));
    const bridgeMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.amber }));
    for (let i = -7; i <= 7; i++) {
      for (const s of [1, -1]) {
        const b = new THREE.Mesh(bridgeGeo, bridgeMat);
        b.position.set(i * 0.48, s * 0.5, 0);
        b.rotation.z = s * 0.7;
        g.add(b);
        bridges.push(b);
      }
    }
    // Z 线（保留引用：收缩时内移，并带动细丝外端一起滑）
    const zLines: import('three').Mesh[] = [];
    for (const x of [-4.6, 4.6]) {
      const z = new THREE.Mesh(
        bag.geo(new THREE.BoxGeometry(0.18, 3.6, 0.5)),
        bag.mat(new THREE.MeshStandardMaterial({ color: PAL.white })),
      );
      z.position.x = x;
      g.add(z);
      zLines.push(z);
    }

    g.add(panelSprite(THREE, bag, [
      { text: '横桥周期：ATP 结合 → 肌球蛋白头摆动（功率冲程）→ 拉动细丝向 M 线', color: '#f8fafc' },
      { text: 'Ca²⁺ 与肌钙蛋白结合暴露结合位点，触发收缩', color: '#94a3b8' },
      { text: '细丝向中央滑动 → 肌节缩短（肌丝滑动学说）', color: '#fbbf24' },
    ], [0, 4.4, 0], 7.8, 'center'));

    ctx.camera.position.set(0, 2.6, 13);
    return (t: number) => {
      // 周期性收缩：Z 线内移 short，细丝外端锚在 Z 线上随之向中央滑动（肌丝滑动学说）
      const short = 0.9 * (Math.sin(t * 0.9) * 0.5 + 0.5);
      zLines[0].position.x = -(4.6 - short);
      zLines[1].position.x = 4.6 - short;
      // 细丝整体平移：外端点始终贴住 Z 线，结合位点相对粗丝滑动
      thinL.position.x = short;
      thinR.position.x = -short;
      // 横桥摆动
      bridges.forEach((b, i) => {
        const ph = t * 3 + i * 0.4;
        b.rotation.z = (i % 2 ? 1 : -1) * (0.7 + 0.5 * Math.sin(ph));
        b.position.y = (i % 2 ? 1 : -1) * (0.4 + 0.25 * Math.sin(ph));
      });
    };
  }

  // 默认：驱动蛋白（kinesin）沿微管行走
  // 微管（原丝束）
  const MT_LEN = 11;
  const protofilaments = 13;
  for (let i = 0; i < protofilaments; i++) {
    const a = (i / protofilaments) * Math.PI * 2;
    const l = new THREE.Line(
      bag.geo(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-MT_LEN / 2, Math.cos(a) * 0.55, Math.sin(a) * 0.55),
        new THREE.Vector3(MT_LEN / 2, Math.cos(a) * 0.55, Math.sin(a) * 0.55),
      ])),
      bag.mat(new THREE.LineBasicMaterial({ color: 0x475569 })),
    );
    g.add(l);
  }
  // α/β 微管蛋白二聚体（沿原丝交替排列）
  const dimerGeo = bag.geo(new THREE.SphereGeometry(0.2, 10, 8));
  const dm = bag.mat(new THREE.MeshStandardMaterial({ color: 0x64748b }));
  for (let i = 0; i < 46; i++) {
    const x = -MT_LEN / 2 + (i / 45) * MT_LEN;
    const a = ((i % 13) / 13) * Math.PI * 2;
    const m = new THREE.Mesh(dimerGeo, dm);
    m.position.set(x, Math.cos(a) * 0.55, Math.sin(a) * 0.55);
    g.add(m);
  }

  // 驱动蛋白：两个头部 + 颈部 + 货物
  const kinesin = new THREE.Group();
  g.add(kinesin);
  const neck = new THREE.Mesh(
    bag.geo(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 8)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.pink })),
  );
  neck.position.y = 1.0;
  kinesin.add(neck);
  const cargo = new THREE.Mesh(
    bag.geo(new THREE.SphereGeometry(0.62, 20, 16)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.amber, roughness: 0.5 })),
  );
  cargo.position.y = 1.9;
  kinesin.add(cargo);
  const heads: import('three').Mesh[] = [];
  const headGeo = bag.geo(new THREE.SphereGeometry(0.24, 14, 12));
  const headMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.cyan }));
  for (let i = 0; i < 2; i++) {
    const h = new THREE.Mesh(headGeo, headMat);
    h.position.set(i ? 0.4 : -0.4, 0.35, 0);
    kinesin.add(h);
    heads.push(h);
  }

  g.add(panelSprite(THREE, bag, [
    { text: '驱动蛋白：两头部交替结合微管，"手拉手"式行走', color: '#f8fafc' },
    { text: '每步 8 nm（一个二聚体重复），消耗 1 ATP', color: '#94a3b8' },
    { text: '颈部连接区像柔性铰链，保证两头不同时脱离', color: '#fbbf24' },
  ], [0, 4.2, 0], 7.6, 'center'));

  ctx.camera.position.set(0, 2.8, 12);
  return (t: number) => {
    // 交替步进：整体前进 + 两头前后交替
    const stride = 0.42;
    const stepPhase = t * 1.6;
    kinesin.position.x = -MT_LEN / 2 + ((stepPhase * stride) % (MT_LEN - 1.2)) + 0.6;
    const ahead = Math.floor(stepPhase) % 2;
    heads[0].position.set(ahead === 0 ? 0.42 : -0.3, 0.34, 0);
    heads[1].position.set(ahead === 0 ? -0.3 : 0.42, 0.5, 0);
    // 货物轻微摆动
    cargo.position.x = 0.08 * Math.sin(t * 3.2);
    kinesin.rotation.z = 0.05 * Math.sin(t * 1.6);
  };
}
