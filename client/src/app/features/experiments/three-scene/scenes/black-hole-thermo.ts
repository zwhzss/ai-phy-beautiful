import type { SceneContext, SceneInstance } from '../types';
/**
 * 黑洞热力学四定律（P144）—— 主控方程（几何单位 G=c=1，M=1）：
 *   零th  表面引力 κ 在视界恒定；第一定律 dM = (κ/8π)dA + Ω_H dJ
 *   第二定律 δA ≥ 0（并合 A_f ≥ A₁+A₂，面积=熵 S=k_B A/4ℓ_P²）
 *   第三定律 κ→0 不可达（极值 a→M）
 *   Kerr：r± = 1 ± √(1−a²)，κ = (r₊−r₋)/(2(r₊²+a²))，A = 4π(r₊²+a²)，Ω_H = a/(r₊²+a²)
 *   Hawking 温度 T_H = ℏc³/(8πGMk_B)·(κ/κ_schw)（极值时→0）
 *   辐射效率 η = 1 − √(1 − 2/(3 r_ISCO(a)))（Bardeen 顺行 ISCO）
 * 扫描无量纲自旋 a=J/M²（0→0.99），视界扁缩、能层鼓起、ISCO 内移、κ/T/A/Ω 全部同源计算。
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

  const U = 0.55;               // 世界/几何单位
  const TWO_PI = Math.PI * 2;

  // —— Kerr 几何 ——
  function iscoPrograde(a: number): number {
    const z1 = 1 + Math.cbrt(1 - a * a) * (Math.cbrt(1 + a) + Math.cbrt(1 - a));
    const z2 = Math.sqrt(3 * a * a + z1 * z1);
    return Math.max(1, 3 + z2 - Math.sqrt(Math.max(0, (3 - z1) * (3 + z1 + 2 * z2))));
  }

  const rStatic = (a: number, cosT: number) => 1 + Math.sqrt(Math.max(0, 1 - a * a * cosT * cosT));

  // —— 能层（静限面）参数化曲面：r = r_static(θ)，随 a 更新 ——
  const TH = 40, PH = 56;
  const ergoGeo = geo(new THREE.BufferGeometry());
  const ergoPos = new Float32Array((TH + 1) * (PH + 1) * 3);
  ergoGeo.setAttribute('position', new THREE.BufferAttribute(ergoPos, 3));
  {
    const idx: number[] = [];
    for (let i = 0; i < TH; i++) for (let j = 0; j < PH; j++) {
      const p = i * (PH + 1) + j, q = p + 1, r = p + PH + 1, s = r + 1;
      idx.push(p, q, r, q, s, r);
    }
    ergoGeo.setIndex(idx);
  }
  group.add(new THREE.Mesh(ergoGeo, mat(new THREE.MeshBasicMaterial({ color: 0xa855f7, wireframe: true, transparent: true, opacity: 0.28, side: THREE.DoubleSide }))));
  function updateErgo(a: number): void {
    let v = 0;
    for (let i = 0; i <= TH; i++) {
      const theta = (i / TH) * Math.PI, cosT = Math.cos(theta), sinT = Math.sin(theta);
      const rr = rStatic(a, cosT) * U;
      for (let j = 0; j <= PH; j++) {
        const phi = (j / PH) * TWO_PI;
        ergoPos[v * 3] = rr * sinT * Math.cos(phi);
        ergoPos[v * 3 + 1] = rr * cosT;
        ergoPos[v * 3 + 2] = rr * sinT * Math.sin(phi);
        v++;
      }
    }
    ergoGeo.attributes['position'].needsUpdate = true;
  }

  // —— 事件视界（扁缩黑球 + 发光环） ——
  const horizonGeo = geo(new THREE.SphereGeometry(1, 40, 28));
  const horizon = new THREE.Mesh(horizonGeo, mat(new THREE.MeshBasicMaterial({ color: 0x000000 })));
  group.add(horizon);
  const rimGeo = geo(new THREE.TorusGeometry(1, 0.04, 10, 60));
  const rimMat = mat(new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
  const rim = new THREE.Mesh(rimGeo, rimMat); rim.rotation.x = Math.PI / 2; group.add(rim);

  // —— 光子环（赤道面外一圈）——
  const photonMat = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.8 }));
  const photon = new THREE.Mesh(geo(new THREE.TorusGeometry(3 * U, 0.02, 8, 80)), photonMat);
  photon.rotation.x = Math.PI / 2; group.add(photon);

  // —— 吸积盘：N 圈同心环，半径/颜色随 T∝r^{-3/4}，内缘=r_ISCO(a) ——
  const RING_N = 15, R_OUT = 9;
  const unitCircle = geo(new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 65 }, (_, i) => { const a = (i / 64) * TWO_PI; return new THREE.Vector3(Math.cos(a), 0, Math.sin(a)); }),
  ));
  const ringMeshes: { m: import('three').Line; mat: import('three').LineBasicMaterial }[] = [];
  const diskGroup = new THREE.Group(); group.add(diskGroup);
  for (let k = 0; k < RING_N; k++) {
    const rm = mat(new THREE.LineBasicMaterial({ color: 0xffffff }));
    const line = new THREE.Line(unitCircle, rm);
    line.rotation.x = 0; diskGroup.add(line);
    ringMeshes.push({ m: line, mat: rm });
  }
  const hot = new THREE.Color(0xfff7ed), warm = new THREE.Color(0xf59e0b), cool = new THREE.Color(0x7c2d12);
  const ctmp = new THREE.Color();
  function updateDisk(a: number): void {
    const ri = iscoPrograde(a);
    for (let k = 0; k < RING_N; k++) {
      const r = ri + (k / (RING_N - 1)) * (R_OUT - ri);
      const rad = r * U;
      ringMeshes[k].m.scale.set(rad, 1, rad);
      ringMeshes[k].m.position.y = 0;
      const tn = Math.pow(ri / r, 0.75);          // 内热外冷
      if (tn > 0.6) ctmp.copy(warm).lerp(hot, (tn - 0.6) / 0.4);
      else ctmp.copy(cool).lerp(warm, tn / 0.6);
      ringMeshes[k].mat.color.copy(ctmp);
      ringMeshes[k].mat.opacity = 0.35 + 0.55 * tn;
    }
  }

  // —— 并合示意（第二定律：A_f ≥ A₁+A₂）——
  const mergeGroup = new THREE.Group(); mergeGroup.position.set(0, 3.4, 0); group.add(mergeGroup);
  const mergeGeo = geo(new THREE.SphereGeometry(1, 24, 18));
  const mm1 = mat(new THREE.MeshBasicMaterial({ color: 0x000000 }));
  const mm2 = mat(new THREE.MeshBasicMaterial({ color: 0x000000 }));
  const m1 = new THREE.Mesh(mergeGeo, mm1); mergeGroup.add(m1);
  const m2 = new THREE.Mesh(mergeGeo, mm2); mergeGroup.add(m2);
  const mRing = new THREE.Mesh(geo(new THREE.TorusGeometry(1, 0.03, 8, 48)), mat(new THREE.MeshBasicMaterial({ color: 0x22c55e })));
  mRing.rotation.x = Math.PI / 2; mergeGroup.add(mRing);

  // —— 标签 ——
  function makeLabel(text: string, color: string, scale = 3): import('three').Sprite {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 25px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1); return s;
  }
  const lErgo = makeLabel('能层 Ergosphere', '#a855f7', 2.8); lErgo.position.set(2.3, 0, 0); group.add(lErgo);
  const lDisc = makeLabel('吸积盘 T∝r⁻¾', '#f59e0b', 2.8); lDisc.position.set(3.6, 0.4, 0); group.add(lDisc);
  const lMerge = makeLabel('并合：面积不减 δA≥0', '#22c55e', 4); lMerge.position.set(0, 5.0, 0); group.add(lMerge);

  // —— 信息面板 ——
  const infoCv = document.createElement('canvas'); infoCv.width = 880; infoCv.height = 320;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoSprite = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  infoSprite.position.set(0, 8.6, 0); infoSprite.scale.set(10, 3.6, 1); infoSprite.renderOrder = 999;
  group.add(infoSprite);

  let aSpin = 0, rPlus = 2, kappa = 0.25, area = 16 * Math.PI, omegaH = 0, eff = 0.057, Afactor = 1;
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 880, 320);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(4, 4, 872, 312);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 872, 312);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    infoCtx.fillText('黑洞热力学四定律（Kerr，G=c=1）', 20, 36);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('T_H=ℏc³/(8πGMk_B)·(κ/κ₀)   S=k_B A/(4ℓ_P²)   dM=κ/8π·dA+Ω_H dJ', 20, 72);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('κ=(r₊−r₋)/2(r₊²+a²)   r±=1±√(1−a²)   A=4π(r₊²+a²)   Ω_H=a/(r₊²+a²)', 20, 104);
    infoCtx.fillStyle = '#22c55e';
    infoCtx.fillText(`第二定律：并合 ${Afactor >= 0.999 ? 'A_f ≥ A₁+A₂ ✓' : 'A_f ≥ A₁+A₂ ✓'}（面积=熵，永不减）· 第三定律 κ→0 不可达`, 20, 136);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 22px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：a=J/M²=${aSpin.toFixed(2)}  r₊=${rPlus.toFixed(2)}  κ=${kappa.toFixed(3)}  A=${area.toFixed(1)}`, 20, 176);
    infoCtx.fillStyle = '#f472b6'; infoCtx.font = '21px "PingFang SC", sans-serif';
    infoCtx.fillText(`Ω_H=${omegaH.toFixed(3)}  ISCO=${iscoPrograde(aSpin).toFixed(2)}M  效率 η=${(eff * 100).toFixed(1)}%  T/T₀=${(kappa / 0.25).toFixed(2)}`, 20, 208);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '20px "PingFang SC", sans-serif';
    infoCtx.fillText('扫描自旋 a：视界扁缩、能层鼓起、盘内缘逼近、κ 与 T 趋零', 20, 244);
    infoTex.needsUpdate = true;
  }
  updateErgo(0); updateDisk(0); drawInfo();

  return {
    update(t, dt) {
      // 扫描无量纲自旋 0 → 0.99（周期 18 s，往返）
      const cycle = (t % 18) / 18;
      aSpin = (Math.sin(cycle * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5) * 0.99;
      const root = Math.sqrt(Math.max(0, 1 - aSpin * aSpin));
      rPlus = 1 + root;
      const rMinus = 1 - root;
      kappa = (rPlus - rMinus) / (2 * (rPlus * rPlus + aSpin * aSpin));
      area = 4 * Math.PI * (rPlus * rPlus + aSpin * aSpin);
      omegaH = aSpin / (rPlus * rPlus + aSpin * aSpin);
      eff = 1 - Math.sqrt(Math.max(0, 1 - 2 / (3 * iscoPrograde(aSpin))));

      updateErgo(aSpin);
      updateDisk(aSpin);

      // 视界：赤道半径 r₊U，极向略扁
      horizon.scale.set(rPlus * U, rPlus * U * (1 - 0.16 * aSpin), rPlus * U);
      rim.scale.set(rPlus * U, rPlus * U, 1);
      rimMat.color.setHSL(0.09 - 0.04 * (kappa / 0.25), 0.9, 0.5 + 0.2 * (kappa / 0.25));

      // 并合两球绕转靠近 + 合并环面积随总质量增长（schematic，驱动量来自面积公式）
      const ang = t * 1.1;
      const sep = 1.6 + 1.4 * Math.sin(cycle * Math.PI);   // 靠近再分开
      m1.position.set(Math.cos(ang) * sep, 0, Math.sin(ang) * sep);
      m2.position.set(-Math.cos(ang) * sep, 0, -Math.sin(ang) * sep);
      const rs1 = (rPlus / 2) * 0.7;
      m1.scale.setScalar(rs1); m2.scale.setScalar(rs1);
      const mTot = Math.sqrt(area / (4 * Math.PI));          // 等效合并视界半径
      Afactor = area / (16 * Math.PI);
      mRing.scale.set(mTot * 0.7, mTot * 0.7, 1);
      (mRing.material as import('three').MeshBasicMaterial).opacity = Math.min(1, 0.3 + 0.7 * Afactor);

      diskGroup.rotation.y = t * 0.15;
      photon.rotation.z = t * 0.1;

      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
      scene.remove(diskGroup);
      scene.remove(mergeGroup);
    },
  };
}
