import type { SceneContext, SceneInstance } from '../types';
/**
 * 脉冲星观测（P274）：倾斜磁轴的中子星灯塔效应 + 射电色散。
 * 主控方程：偶极磁力线 r = L·sin²θ（磁轴偏离自转轴 χ=45°）；
 * 磁层光速半径 R_L = cP/2π，极冠束张角 ρ ≈ √(2R_NS/R_L)（rad）；
 * 色散延迟 Δt = 4.15 ms × DM × (ν_lo⁻² − ν_hi⁻²)（DM=10 pc·cm⁻³，0.3 vs 1.4 GHz），低频脉冲滞后 Δφ = 2πΔt/P 扫过视线。
 */
export function create(ctx: SceneContext): SceneInstance {
  const { THREE, scene } = ctx;
  const group = new THREE.Group();
  scene.add(group);

  const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
  const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
  const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
  const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };

  const starGeo = geo(new THREE.BufferGeometry());
  const starPos = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 400;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 400;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 400;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  group.add(new THREE.Points(starGeo, mat(new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true }))));
  const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
  geo(grid.geometry);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => mat(m));
  group.add(grid);

  // —— 参数（归一化：R_NS = 0.5 wu ≙ 10 km ⇒ 1 wu = 20 km = 2e4 m）——
  const R_NS = 0.5;
  const WU_M = 2e4;
  const C_MS = 3e8;
  const CHI = Math.PI / 4;         // 磁倾角
  const OBS_AZ = Math.PI / 2;      // 观察者方位角（绕自转轴）
  const DM = 10;                   // 色散量 pc·cm⁻³

  const spin = new THREE.Group();  // 随自转（世界 Y 轴）旋转
  group.add(spin);
  const tilt = new THREE.Group();  // 绕 z 转 −χ：局部 +y = 磁轴
  tilt.rotation.z = -CHI;
  spin.add(tilt);

  // 中子星与自转轴
  const ns = new THREE.Mesh(geo(new THREE.SphereGeometry(R_NS, 24, 20)), mat(new THREE.MeshStandardMaterial({ color: 0x93c5fd, emissive: 0x1e40af, emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.4 })));
  group.add(ns);
  {
    const axGeo = geo(new THREE.BufferGeometry());
    axGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, -1.6, 0, 0, 1.85, 0]), 3));
    const ax = new THREE.Line(axGeo, mat(new THREE.LineBasicMaterial({ color: 0x64748b })));
    group.add(ax);
    const eq = new THREE.Mesh(geo(new THREE.RingGeometry(1.28, 1.34, 64)), mat(new THREE.MeshBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.6, side: THREE.DoubleSide })));
    eq.rotation.x = -Math.PI / 2;
    group.add(eq);
  }

  // —— 偶极磁力线族：局部磁坐标 r = L·sin²θ，6 条子午线 ——
  const lineMat = mat(new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.35 }));
  for (const L of [1.05, 1.5, 2.0]) {
    for (let m = 0; m < 6; m++) {
      const phi = (m / 6) * Math.PI;
      const pts: import('three').Vector3[] = [];
      for (let i = 0; i <= 56; i++) {
        const th = 0.05 + (Math.PI - 0.1) * (i / 56);
        const r = L * Math.sin(th) * Math.sin(th);
        pts.push(new THREE.Vector3(r * Math.sin(th) * Math.cos(phi), r * Math.cos(th), r * Math.sin(th) * Math.sin(phi)));
      }
      tilt.add(new THREE.Line(geo(new THREE.BufferGeometry().setFromPoints(pts)), lineMat));
    }
  }

  // 磁轴线
  {
    const mAx = geo(new THREE.BufferGeometry());
    mAx.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, -2.35, 0, 0, 2.35, 0]), 3));
    tilt.add(new THREE.Line(mAx, mat(new THREE.LineBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.7 }))));
  }

  // —— 双向锥形束：单位锥（h=2.9，底半径 1）沿局部 ±y，scale.xz = tan ρ 实现张角 ——
  const BEAM_H = 2.9;
  const beamGeoN = geo(new THREE.ConeGeometry(1, BEAM_H, 28, 1, true)); beamGeoN.translate(0, BEAM_H / 2 + 0.18, 0);
  const beamGeoS = geo(new THREE.ConeGeometry(1, BEAM_H, 28, 1, true)); beamGeoS.translate(0, -BEAM_H / 2 - 0.18, 0);
  const beamMatN = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.17, side: THREE.DoubleSide, depthWrite: false }));
  const beamMatS = mat(new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.17, side: THREE.DoubleSide, depthWrite: false }));
  const beamN = new THREE.Mesh(beamGeoN, beamMatN);
  const beamS = new THREE.Mesh(beamGeoS, beamMatS);
  tilt.add(beamN, beamS);

  // —— 观察者（地球）——
  const obs = new THREE.Mesh(geo(new THREE.SphereGeometry(0.16, 12, 12)), mat(new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.7 })));
  obs.position.set(Math.cos(OBS_AZ) * 4.2, 0, Math.sin(OBS_AZ) * 4.2);
  group.add(obs);
  {
    const lv = geo(new THREE.BufferGeometry());
    lv.setAttribute('position', new THREE.BufferAttribute(new Float32Array([obs.position.x, 0, obs.position.z, 0.6, 0, 0.6]), 3));
    group.add(new THREE.Line(lv, mat(new THREE.LineBasicMaterial({ color: 0x334155 }))));
  }

  // —— 脉冲剖面滚动带 ——
  const HIST = 128;
  const histCv = document.createElement('canvas');
  histCv.width = 512; histCv.height = 128;
  const histCtx = histCv.getContext('2d')!;
  const histTex = tex(new THREE.CanvasTexture(histCv));
  const hist = new THREE.Mesh(geo(new THREE.PlaneGeometry(5.2, 1.3)), mat(new THREE.MeshBasicMaterial({ map: histTex, transparent: true })));
  hist.position.set(0, 3.0, 1.4);
  hist.rotation.x = -Math.PI / 3.2;
  group.add(hist);
  const profHi = new Float32Array(HIST);
  const profLo = new Float32Array(HIST);

  function drawHist(): void {
    histCtx.clearRect(0, 0, 512, 128);
    histCtx.fillStyle = 'rgba(7,11,20,0.8)';
    histCtx.fillRect(0, 0, 512, 128);
    for (let i = 0; i < HIST; i++) {
      const x = (i / HIST) * 512;
      histCtx.fillStyle = '#22d3ee';
      histCtx.fillRect(x, 62 - profHi[i] * 58, 3, profHi[i] * 58);
      histCtx.fillStyle = '#f472b6';
      histCtx.fillRect(x, 124 - profLo[i] * 40, 3, profLo[i] * 40);
    }
    histTex.needsUpdate = true;
  }

  function makeLabel(text: string, color: string, scale = 3.0): import('three').Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.font = 'bold 27px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true, depthTest: false })));
    s.scale.set(scale, scale / 8, 1);
    s.renderOrder = 998;
    return s;
  }
  const lObs = makeLabel('观察者（地球）', '#22c55e', 2.6);
  lObs.position.set(obs.position.x, 0.85, obs.position.z);
  group.add(lObs);
  const lBand = makeLabel('上带 1.4 GHz · 下带 0.3 GHz（色散滞后）', '#f472b6', 4.4);
  lBand.position.set(0, 3.9, 1.7);
  group.add(lBand);

  const infoCv = document.createElement('canvas');
  infoCv.width = 512; infoCv.height = 256;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const info = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  info.scale.set(7.4, 3.7, 1);
  info.position.set(0, 5.5, 0);
  info.renderOrder = 999;
  group.add(info);

  let P = 0.5, rho = 0.4, dtDisp = 0, pulseOn = false;

  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 512, 256);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)';
    infoCtx.fillRect(3, 3, 506, 250);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3;
    infoCtx.strokeRect(3, 3, 506, 250);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc';
    infoCtx.font = 'bold 26px "PingFang SC", sans-serif';
    infoCtx.fillText('脉冲星 · 灯塔与色散', 14, 36);
    infoCtx.fillStyle = '#22d3ee';
    infoCtx.font = '21px "PingFang SC", sans-serif';
    infoCtx.fillText('磁力线 r=L·sin²θ（偶极，磁轴倾 χ=45°）', 14, 72);
    infoCtx.fillText('束张角 ρ≈√(2R_NS/R_L)，R_L=cP/2π', 14, 100);
    infoCtx.fillStyle = '#a855f7';
    infoCtx.fillText('Δt=4.15ms·DM·(ν_lo⁻²−ν_hi⁻²)，DM=10', 14, 128);
    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = 'bold 20px "PingFang SC", sans-serif';
    const RLw = (C_MS * P / (2 * Math.PI)) / WU_M;
    infoCtx.fillText(`读数: P=${P.toFixed(2)}s f=${(1 / P).toFixed(1)}Hz ρ=${((rho / 25) * 57.3).toFixed(2)}°(画面×25)`, 14, 162);
    infoCtx.fillText(`R_L=${RLw.toFixed(1)}wu(${(RLw * 20).toFixed(0)}km) Δt=${dtDisp.toFixed(2)}s=${(dtDisp / P).toFixed(2)}个周期`, 14, 192);
    infoCtx.fillStyle = pulseOn ? '#ef4444' : '#94a3b8';
    infoCtx.fillText(pulseOn ? '束扫过视线 —— 脉冲到达！' : '束未触及视线', 14, 226);
    infoTex.needsUpdate = true;
  }

  drawHist();
  drawInfo();

  return {
    update(t, dt) {
      // 18 s 周期：自转周期 P 从 0.12 s 扫到 1.4 s ⇒ 束变宽、色散滞后的周期分数缩短
      const cyc = (t % 18) / 18;
      P = 0.12 + (1.4 - 0.12) * (0.5 - 0.5 * Math.cos(Math.PI * 2 * cyc));
      const RL = C_MS * P / (2 * Math.PI);              // m（光速半径）
      rho = Math.min(1.05, Math.sqrt(2e4 / RL) * 25);   // ρ=√(2R_NS/R_L)，R_NS=10 km；画面 ×25 夸大（面板注明）
      const tanR = Math.tan(rho);
      beamN.scale.set(tanR, 1, tanR);
      beamS.scale.set(tanR, 1, tanR);

      dtDisp = 4.15e-3 * DM * (1 / (0.3 * 0.3) - 1 / (1.4 * 1.4)); // s
      const lagCycles = Math.min(0.45, dtDisp / P);
      const dPsi = 2 * Math.PI * lagCycles;

      const spinA = t * 1.05;
      spin.rotation.y = spinA;
      const phi = spinA - OBS_AZ;
      const pulseWidth = 0.10 + 0.06 * (rho / 0.5);

      function sample(off: number): number {
        let d = phi - off;
        d = ((d % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        if (d > Math.PI) d -= Math.PI * 2;
        return Math.exp(-0.5 * Math.pow(d / (pulseWidth / 2.355), 2));
      }
      profHi.copyWithin(0, 1); profLo.copyWithin(0, 1);
      profHi[HIST - 1] = sample(0);
      profLo[HIST - 1] = sample(dPsi);
      pulseOn = profHi[HIST - 1] > 0.5;
      obs.scale.setScalar(pulseOn ? 2.1 : 1);
      beamMatN.opacity = 0.14 + 0.1 * Math.sin(t * 6);
      drawHist();

      ns.material.emissiveIntensity = 0.7 + 0.3 * Math.sin(t * 9);
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
