import type { SceneContext, SceneInstance } from '../types';
/**
 * 点的复合运动（P436）—— 主控方程（动参考系速度/加速度合成定理）：
 *   速度  v_a = v_e + v_r          （绝对 = 牵连 + 相对）
 *   牵连  v_e = ω × r  （动系上与动点重合之点的速度）
 *   加速度 a_a = a_e + a_r + a_c   ，  科氏加速度 a_c = 2 ω × v_r
 *   本例 ω=ω·ŷ（竖直转轴）⊥ 滑槽内 v_r（水平径向）⇒ |a_c| = 2ω·v_r，方向水平切向
 * 水平转盘点上一根径向滑槽，质点沿槽外滑。三速度矢量 + 科氏/向心加速度在三维同时拉出，
 * 用 THREE.Vector3.cross 真实叉乘计算，扫描自变量：转动角速度 ω（0.5→4.0 rad/s，周期 16 s）。
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
  grid.position.y = -1.9; group.add(grid);

  const MAXR = 3.2, DISC_Y = -0.4;
  let omega = 2.0, phi = 0, rSlide = 0.6;
  const VR = 0.55;                 // 沿槽相对滑速（世界单位/s）
  const TWO_PI = Math.PI * 2;

  // —— 转盘（旋转体）+ 转轴 + 滑槽 ——
  const disc = new THREE.Group(); group.add(disc);
  const discMesh = new THREE.Mesh(
    geo(new THREE.CylinderGeometry(MAXR, MAXR, 0.12, 48)),
    mat(new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.3, roughness: 0.7, transparent: true, opacity: 0.6 })),
  );
  disc.add(discMesh);
  const slotGeo = geo(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.09, 0), new THREE.Vector3(MAXR, 0.09, 0)]));
  disc.add(new THREE.Line(slotGeo, mat(new THREE.LineBasicMaterial({ color: 0x22c55e }))));
  // 转盘刻度（随转可见 ω）
  const tickGeo = geo(new THREE.BufferGeometry());
  const TICKS = 12;
  tickGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TICKS * 6), 3));
  disc.add(new THREE.LineSegments(tickGeo, mat(new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.5 }))));
  const ta = tickGeo.attributes['position'].array as Float32Array;
  for (let i = 0; i < TICKS; i++) {
    const a = (i / TICKS) * TWO_PI;
    ta[i * 6] = Math.cos(a) * MAXR * 0.92; ta[i * 6 + 2] = Math.sin(a) * MAXR * 0.92; ta[i * 6 + 1] = 0.09;
    ta[i * 6 + 3] = Math.cos(a) * MAXR; ta[i * 6 + 4] = 0.09; ta[i * 6 + 5] = Math.sin(a) * MAXR;
  }

  // 转轴（竖直 ω 矢量箭头）
  const axisGeo = geo(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(0, 2.0, 0)]));
  group.add(new THREE.Line(axisGeo, mat(new THREE.LineBasicMaterial({ color: 0xa855f7 }))));
  const shaftGeo = geo(new THREE.CylinderGeometry(0.045, 0.045, 1, 6));
  const headGeo = geo(new THREE.ConeGeometry(0.13, 0.32, 10));
  const omegaHead = new THREE.Mesh(headGeo, mat(new THREE.MeshBasicMaterial({ color: 0xa855f7 })));
  omegaHead.position.set(0, 2.2, 0); group.add(omegaHead);

  // 动点
  const point = new THREE.Mesh(geo(new THREE.SphereGeometry(0.2, 16, 12)), mat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0x22d3ee, emissiveIntensity: 0.5 })));
  group.add(point);

  // 矢量集合
  type Arrow = { s: import('three').Mesh; h: import('three').Mesh; m: import('three').MeshBasicMaterial };
  function mkArrow(colr: number): Arrow {
    const m = mat(new THREE.MeshBasicMaterial({ color: colr }));
    const s = new THREE.Mesh(shaftGeo, m);
    const h = new THREE.Mesh(headGeo, m);
    group.add(s, h);
    return { s, h, m };
  }
  const aVe = mkArrow(0x22d3ee);    // 牵连
  const aVr = mkArrow(0x22c55e);    // 相对
  const aVa = mkArrow(0xf472b6);    // 绝对
  const aC = mkArrow(0xfbbf24);     // 科氏加速度
  const aN = mkArrow(0xf97316);     // 向心(牵连法向)
  // 平行四边形虚线（v_e+v_r 合成 v_a）
  const dashMat = mat(new THREE.LineBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.4 }));
  const dashGeo1 = geo(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]));
  const dashGeo2 = geo(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]));
  const dash1 = new THREE.Line(dashGeo1, dashMat);
  const dash2 = new THREE.Line(dashGeo2, dashMat);
  group.add(dash1, dash2);

  const UP = new THREE.Vector3(0, 1, 0);
  function setArrow(a: Arrow, base: import('three').Vector3, dir: import('three').Vector3, len: number): void {
    if (len < 0.05) { a.s.visible = a.h.visible = false; return; }
    a.s.visible = a.h.visible = true;
    const d = dir.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, d);
    a.s.quaternion.copy(q); a.s.scale.set(1, len, 1); a.s.position.copy(base).addScaledVector(d, len / 2);
    a.h.quaternion.copy(q); a.h.position.copy(base).addScaledVector(d, len + 0.16);
  }
  function setDash(g: import('three').BufferGeometry, p1: import('three').Vector3, p2: import('three').Vector3): void {
    const arr = g.attributes['position'].array as Float32Array;
    arr[0] = p1.x; arr[1] = p1.y; arr[2] = p1.z; arr[3] = p2.x; arr[4] = p2.y; arr[5] = p2.z;
    g.attributes['position'].needsUpdate = true;
  }

  function makeLabel(text: string, color: string, scale = 3): import('three').Sprite {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 23px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1); return s;
  }
  const lW = makeLabel('ω（竖直转轴）', '#a855f7', 2.6); lW.position.set(0.6, 2.3, 0); group.add(lW);
  const lC = makeLabel('科氏 a_c=2ω×v_r', '#fbbf24', 3); group.add(lC);

  // —— 信息面板 ——
  const infoCv = document.createElement('canvas'); infoCv.width = 880; infoCv.height = 300;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoSprite = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  infoSprite.position.set(0, 5.4, 0); infoSprite.scale.set(10, 3.4, 1); infoSprite.renderOrder = 999;
  group.add(infoSprite);

  let vE = 0, vA = 0, aCc = 0;
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 880, 300);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(4, 4, 872, 292);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 872, 292);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 24px "PingFang SC", sans-serif';
    infoCtx.fillText('点的复合运动 — 速度/加速度合成定理', 20, 36);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '22px "PingFang SC", sans-serif';
    infoCtx.fillText('v_a = v_e + v_r    a_a = a_e + a_r + a_c    a_c = 2ω×v_r', 20, 72);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('牵连 v_e=ω×r（切向）；相对 v_r 沿滑槽（径向）；二者垂直 ⇒ |v_a|=√(v_e²+v_r²)', 20, 106);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.fillText('科氏加速度垂直于转轴与相对速度：ω⊥v_r ⇒ |a_c|=2ω·v_r，方向沿切向', 20, 140);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 22px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：ω=${omega.toFixed(2)} r/s  r=${rSlide.toFixed(2)}  v_r=${VR.toFixed(2)}  |v_e|=${vE.toFixed(2)}  |v_a|=${vA.toFixed(2)}  |a_c|=${aCc.toFixed(2)}`, 20, 184);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '21px "PingFang SC", sans-serif';
    infoCtx.fillText('扫描 ω：牵连与科氏矢量随 ω 增长；平行四边形演示 v_e⊕v_r=v_a', 20, 222);
    infoTex.needsUpdate = true;
  }
  drawInfo();

  return {
    update(t, dt) {
      omega = 0.5 + ((t % 16) / 16) * 3.5;
      phi += omega * dt;                        // 视觉转速 = 物理 ω（无缩放，矢量与画面同源）
      rSlide += VR * dt;                        // 沿槽外滑（视觉滑速 = 读数 v_r）
      if (rSlide > MAXR) rSlide = 0.5;
      disc.rotation.y = phi;                    // +φ 绕 +y 转 ⇒ 可见角速度 ω_vec = +ω·ŷ（与轴向箭头一致）

      // 真实矢量（世界系）
      const ur = new THREE.Vector3(Math.cos(phi), 0, -Math.sin(phi)); // 与可见滑槽方向一致
      const rVec = ur.clone().multiplyScalar(rSlide);
      const wVec = new THREE.Vector3(0, omega, 0);
      const pPos = new THREE.Vector3(rVec.x, DISC_Y + 0.22, rVec.z);
      point.position.copy(pPos);

      const v_e = wVec.clone().cross(rVec);                     // ω × r
      const v_r = ur.clone().multiplyScalar(VR);                // 沿槽径向
      const v_a = v_e.clone().add(v_r);
      const a_c = wVec.clone().cross(v_r).multiplyScalar(2);    // 2ω×v_r（切向，与可见转动同向）
      const a_n = wVec.clone().cross(v_e);                      // ω×(ω×r) 向心

      const vs = 0.42, as = 0.18;
      setArrow(aVe, pPos, v_e, v_e.length() * vs);
      setArrow(aVr, pPos, v_r, v_r.length() * vs);
      setArrow(aVa, pPos, v_a, v_a.length() * vs);
      setArrow(aC, pPos, a_c, a_c.length() * as);
      setArrow(aN, pPos, a_n, a_n.length() * as);
      // 平行四边形：v_e 末端→v_a 末端 平行于 v_r；v_r 末端→v_a 末端 平行于 v_e
      const pe = pPos.clone().add(v_e.clone().multiplyScalar(vs));
      const pr = pPos.clone().add(v_r.clone().multiplyScalar(vs));
      const pa = pPos.clone().add(v_a.clone().multiplyScalar(vs));
      setDash(dashGeo1, pe, pa);
      setDash(dashGeo2, pr, pa);

      vE = v_e.length(); vA = v_a.length(); aCc = a_c.length();
      (aC.m as import('three').MeshBasicMaterial);
      lC.position.copy(pPos.clone().add(a_c.clone().normalize().multiplyScalar(a_c.length() * as + 0.6)));

      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
      scene.remove(disc);
    },
  };
}
