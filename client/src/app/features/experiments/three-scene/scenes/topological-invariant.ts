import type { SceneContext, SceneInstance } from '../types';
/** 拓扑不变量（P243）：主控方程 Gauss–Bonnet ∫∫K·dA + Σθ_cone = 2πχ，χ = 2−2g。
 *  旋转面族（轮廓圆：r = d + cos v，z = sin v，截断 r≥0）绕轴扫成：
 *  d<a 球（带两个锥尖）、d=a  horn 颈缩（奇点，"捅破"瞬间）、d>a 环面。
 *  K = cos v/(a·r) 逐顶点解析计算并着色，∫KdA = 4π·sin v₀（v₀=min(π, arccos(−d/a))）数值求和；
 *  连续形变下积分平滑变化，颈缩瞬间亏格 0→1、χ 2→0 整数跳变。
 *  量化保护（与陈数同构）：同一积分给出拓扑整数 N = (∫∫K·dA + Σθ_锥尖)/2π = χ = 2−2g ∈ ℤ，
 *  画面左侧阶梯按此 N 实算落点（连续形变只在同一级上滑动积分值、N 不变；颈缩瞬间才整级跳）；
 *  陈数是同一族"闭空间上曲率面积分 = 整数"：C = (1/2π)∮_BZ Ω_Berri·d²k ∈ ℤ。 */
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
  const A_UNIT = 1.0, RS = 2.0;      // 轮廓圆半径 a（单位）与世界尺度
  const NU = 72, NV = 33;            // 周向 /  meridional 分辨率

  const sGeo = geo(new THREE.BufferGeometry());
  const pos = new Float32Array((NU + 1) * (NV + 1) * 3);
  const col = new Float32Array((NU + 1) * (NV + 1) * 3);
  sGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  {
    const idx: number[] = [];
    for (let i = 0; i < NU; i++) {
      for (let j = 0; j < NV; j++) {
        const a = i * (NV + 1) + j, b = a + 1, cc = a + (NV + 1), e = cc + 1;
        idx.push(a, b, cc, b, e, cc);
      }
    }
    sGeo.setIndex(idx);
  }
  const solid = new THREE.Mesh(sGeo, mat(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.92 })));
  solid.position.y = 1.9;
  solid.rotation.x = Math.PI / 2;    // 旋转轴（数学 z 轴）指向上方
  group.add(solid);

  // —— 状态（面板与几何同源） ——
  let dOverA = 0.5, v0 = 2.09, intK = 0, deficit = 0, chi = 2, pinched = false;
  let nCalc = 2, nInt = 2;   // 量子化读数 N=(∫KdA+Σθ_锥)/2π（连续实算值 + 取整整数）

  function morph(da: number): void {
    dOverA = da;
    v0 = da >= 1 ? Math.PI : Math.acos(-da);
    let sum = 0;
    let vi = 0;
    for (let i = 0; i <= NU; i++) {
      const u = (i / NU) * TWO_PI;
      const cu = Math.cos(u), su = Math.sin(u);
      for (let j = 0; j <= NV; j++) {
        const v = -v0 + (2 * v0 * j) / NV;
        const rr = dOverA + A_UNIT * Math.cos(v); // ≥0（数值截断）
        const R = Math.max(rr, 1e-4) * RS;
        pos[vi * 3] = R * cu;
        pos[vi * 3 + 1] = A_UNIT * Math.sin(v) * RS;
        pos[vi * 3 + 2] = R * su;
        const K = Math.cos(v) / (A_UNIT * Math.max(rr, 0.05)); // 单位曲面 K=a⁻¹cos v / r
        const kk = Math.max(-2.2, Math.min(2.2, K));
        if (kk > 0) { col[vi * 3] = 0.13 + 0.2 * kk; col[vi * 3 + 1] = 0.35 + 0.45 * kk; col[vi * 3 + 2] = 0.95; }
        else { col[vi * 3] = 0.93; col[vi * 3 + 1] = 0.25 + 0.2 * (-kk); col[vi * 3 + 2] = 0.25; }
        vi++;
      }
    }
    // ∫K dA：dA = (a·dv)·(r·du)，K·dA = cos v dv du → 逐环带数值和（与 K 图样同源）
    sum = 0;
    const du = TWO_PI / NU, dvv = (2 * v0) / NV;
    for (let j = 0; j < NV; j++) {
      const vm = -v0 + (j + 0.5) * dvv;
      sum += Math.cos(vm) * dvv;
    }
    intK = TWO_PI * sum; // = 4π sin v₀（数值）
    deficit = dOverA < 1 ? 4 * Math.PI - intK : 0; // 球支：锥尖缺口补足到 2πχ=4π
    chi = dOverA < 1 ? 2 : 0;
    nCalc = (intK + deficit) / TWO_PI;            // 与上面同一积分实算的拓扑整数
    nInt = Math.round(nCalc);
    pinched = Math.abs(dOverA - 1) < 0.055;
    sGeo.attributes['position'].needsUpdate = true;
    sGeo.attributes['color'].needsUpdate = true;
  }

  // —— 量子化阶梯：N=(∫∫K·dA+Σθ_锥)/2π 的整数能级；金点由同一积分实算，只跳不滑 ——
  const LGX = -4.25, LGY = 0.55, LGDY = 1.05, LGT = 0.4;
  const lGeo = geo(new THREE.BufferGeometry());
  {
    const p: number[] = [];
    p.push(LGX, LGY - 0.22, 0, LGX, LGY + 2 * LGDY + 0.3, 0);                       // 纵轴
    for (let n = 0; n <= 2; n++) p.push(LGX - LGT, LGY + n * LGDY, 0, LGX + LGT, LGY + n * LGDY, 0);  // 能级刻度
    lGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3));
  }
  group.add(new THREE.LineSegments(lGeo, mat(new THREE.LineBasicMaterial({ color: 0x64748b }))));
  const nDot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.11, 12, 12)), mat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
  nDot.position.set(LGX, LGY + nCalc * LGDY, 0.15);
  group.add(nDot);
  function ladderLabel(text: string, x: number, y: number, color: string, w: number): void {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 28px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(w, w / 8, 1); s.position.set(x, y, 0.2); s.renderOrder = 997;
    group.add(s);
  }
  ladderLabel('N=2', LGX + 0.75, LGY + 2 * LGDY, '#94a3b8', 1.1);
  ladderLabel('N=1', LGX + 0.75, LGY + LGDY, '#475569', 1.1);
  ladderLabel('N=0', LGX + 0.75, LGY, '#94a3b8', 1.1);
  ladderLabel('量子化：N=(∫KdA+Σθ)/2π=χ', LGX + 0.25, LGY + 2 * LGDY + 0.62, '#a855f7', 3.0);
  ladderLabel('陈数同构：C=(1/2π)∮_BZ Ω·d²k∈ℤ', LGX + 0.25, LGY + 2 * LGDY + 1.12, '#c4b5fd', 3.0);

  const pinchMat = mat(new THREE.SpriteMaterial({ transparent: true, opacity: 0 }));
  const pinch = new THREE.Sprite(pinchMat);
  {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const cc = cv.getContext('2d')!;
    cc.fillStyle = '#ef4444';
    cc.font = 'bold 30px "PingFang SC", sans-serif';
    cc.textAlign = 'center'; cc.textBaseline = 'middle';
    cc.fillText('颈缩！亏格跳变 g: 0→1，χ: 2→0', 256, 32);
    pinchMat.map = tex(new THREE.CanvasTexture(cv));
  }
  pinch.scale.set(5.0, 0.62, 1);
  pinch.position.set(0, -0.6, 0);
  group.add(pinch);

  // —— 面板 ——
  const infoCv = document.createElement('canvas');
  infoCv.width = 800; infoCv.height = 300;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoPlane = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(8.8, 3.3)),
    mat(new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, depthTest: false })),
  );
  infoPlane.position.set(0, 6.1, 0);
  infoPlane.renderOrder = 999;
  group.add(infoPlane);

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 800, 300);
    infoCtx.fillStyle = 'rgba(7,11,20,0.82)';
    infoCtx.fillRect(4, 4, 792, 292);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 792, 292);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 29px "PingFang SC", sans-serif';
    infoCtx.fillText('拓扑不变量：Gauss–Bonnet 与整数跳变', 22, 42);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '27px "PingFang SC", sans-serif';
    infoCtx.fillText('∫∫K·dA + Σθ_锥尖 = 2πχ，χ = 2−2g（K = k₁k₂ = cos v/(a·r)）', 22, 82);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('怎么揉都不变：连续形变只重排曲率；捅破（颈缩）才让整数跳', 22, 122);
    infoCtx.fillStyle = pinched ? '#ef4444' : '#fbbf24';
    infoCtx.font = 'bold 25px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `读数：d/a = ${dOverA.toFixed(2)}  v₀ = ${(v0 * 57.2958).toFixed(0)}°  光滑∫KdA = ${intK.toFixed(2)} = 4π·sin v₀  锥尖缺口 = ${deficit.toFixed(2)}  χ = ${chi}${pinched ? ' ← 奇点！' : ''}`,
      22, 170,
    );
    infoCtx.fillStyle = pinched ? '#ef4444' : '#22c55e';
    infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    infoCtx.fillText(
      `量子化读数：N = (∫KdA + Σθ_锥)/2π = ${nCalc.toFixed(3)} → 取整 ${nInt} = χ = 2−2g（金点在左侧阶梯上）`,
      22, 206,
    );
    infoCtx.fillStyle = '#c4b5fd';
    infoCtx.font = '23px "PingFang SC", sans-serif';
    infoCtx.fillText('同构：陈数 C=(1/2π)∮_BZ Ω_Berry·d²k ∈ ℤ —— 闭空间上"曲率面积分=整数"的量化保护', 22, 240);
    infoCtx.fillStyle = '#94a3b8';
    infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('连续形变只让 ∫KdA 重排、N 锁在能级上；颈缩（捅破）瞬间 N 整级跳 2→0', 22, 272);
    infoTex.needsUpdate = true;
  }

  morph(0.5);
  nDot.position.set(LGX, LGY + nCalc * LGDY, 0.15);
  drawInfo();

  return {
    update(t, dt) {
      // 扫描 d/a：0 → 1.35 → 0（16s），穿过 1 即"捅破"
      const ph = (t % 16) / 16;
      const da = 1.35 * (0.5 - 0.5 * Math.cos(TWO_PI * ph));
      morph(da);
      nDot.position.set(LGX, LGY + nCalc * LGDY, 0.15);   // 金点由同一积分驱动：整级跳，不滑
      pinchMat.opacity = pinched ? 0.6 + 0.4 * Math.sin(t * 12) : 0;
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
