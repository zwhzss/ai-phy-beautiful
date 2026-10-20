import type { SceneContext, SceneInstance } from '../types';
/**
 * 膜电位与离子通道（P335）—— 主控方程：Goldman–Hodgkin–Katz 电压方程
 *   V_m = (RT/F)·ln( (P_K[K]ₒ+P_Na[Na]ₒ+P_Cl[Cl]ᵢ) / (P_K[K]ᵢ+P_Na[Na]ᵢ+P_Cl[Cl]ₒ) )
 * 单种离子的能斯特电位 E_ion=(RT/zF)·ln([ion]ₒ/[ion]ᵢ)。静息 −70 mV 由浓度梯度与
 * “K⁺ 通透远大于 Na⁺”的选择性通透撑起。扫描自变量 P_Na/P_K，V_m 随之偏倚、
 * 膜两侧电荷分离的强度、Na⁺ 内流量与面板读数全部由同一 GHK 计算生成。跨膜电场 E 箭头方向取真实
 * E 场（由 + 侧指向 − 侧，静息外+内− ⇒ 指向胞内），长度 ∝|Vm|；钠钾泵演示 3Na⁺出/2K⁺入 离子循环。
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
  grid.position.y = -3.2; group.add(grid);

  // —— 真实浓度 (mM) 与 37℃ 常数 RT/F = 26.7 mV ——
  const RTF = 26.7;
  const K_in = 140, K_out = 5, Na_in = 12, Na_out = 145, Cl_in = 4, Cl_out = 120;
  const P_K = 1, P_Cl = 0.45;
  const E_K = RTF * Math.log(K_out / K_in);     // ≈ −89 mV
  const E_Na = RTF * Math.log(Na_out / Na_in);  // ≈ +66 mV

  function ghk(pNa: number): number {
    const num = P_K * K_out + pNa * Na_out + P_Cl * Cl_in;
    const den = P_K * K_in + pNa * Na_in + P_Cl * Cl_out;
    return RTF * Math.log(num / den);
  }

  // —— 脂质双分子层：疏水核心薄板 + 两层极性头（Points，随电荷变色） ——
  const core = new THREE.Mesh(
    geo(new THREE.BoxGeometry(6, 0.42, 4)),
    mat(new THREE.MeshStandardMaterial({ color: 0x3f3f2e, roughness: 0.9 })),
  );
  group.add(core);

  const GX = 11, GZ = 8;
  const headsTopPos = new Float32Array(GX * GZ * 3);
  const headsBotPos = new Float32Array(GX * GZ * 3);
  const headsTopCol = new Float32Array(GX * GZ * 3);
  const headsBotCol = new Float32Array(GX * GZ * 3);
  {
    let v = 0;
    for (let i = 0; i < GX; i++) {
      for (let j = 0; j < GZ; j++) {
        const x = -2.75 + (i / (GX - 1)) * 5.5;
        const z = -1.75 + (j / (GZ - 1)) * 3.5;
        headsTopPos[v * 3] = x; headsTopPos[v * 3 + 1] = 0.55; headsTopPos[v * 3 + 2] = z;
        headsBotPos[v * 3] = x; headsBotPos[v * 3 + 1] = -0.55; headsBotPos[v * 3 + 2] = z;
        v++;
      }
    }
  }
  const topGeo = geo(new THREE.BufferGeometry());
  topGeo.setAttribute('position', new THREE.BufferAttribute(headsTopPos, 3));
  topGeo.setAttribute('color', new THREE.BufferAttribute(headsTopCol, 3));
  const botGeo = geo(new THREE.BufferGeometry());
  botGeo.setAttribute('position', new THREE.BufferAttribute(headsBotPos, 3));
  botGeo.setAttribute('color', new THREE.BufferAttribute(headsBotCol, 3));
  const headPMat = mat(new THREE.PointsMaterial({ size: 0.42, vertexColors: true }));
  group.add(new THREE.Points(topGeo, headPMat), new THREE.Points(botGeo, headPMat));

  // 疏水尾部：把两层头逐列配成线段
  const tailGeo = geo(new THREE.BufferGeometry());
  tailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(GX * GZ * 6), 3));
  const tp = tailGeo.attributes['position'].array as Float32Array;
  for (let k = 0; k < GX * GZ; k++) {
    tp[k * 6] = headsTopPos[k * 3]; tp[k * 6 + 1] = 0.4; tp[k * 6 + 2] = headsTopPos[k * 3 + 2];
    tp[k * 6 + 3] = headsBotPos[k * 3]; tp[k * 6 + 4] = -0.4; tp[k * 6 + 5] = headsBotPos[k * 3 + 2];
  }
  group.add(new THREE.LineSegments(tailGeo, mat(new THREE.LineBasicMaterial({ color: 0x6b7280, transparent: true, opacity: 0.4 }))));

  // —— 通道蛋白（K 选择性孔 = 青；非选择性 Na 孔 = 品红）与 Na⁺/K⁺-ATPase 泵 ——
  function channel(px: number, colr: number): import('three').Group {
    const g = new THREE.Group(); g.position.set(px, 0, 0);
    const pore = new THREE.Mesh(
      geo(new THREE.CylinderGeometry(0.28, 0.28, 1.4, 14, 1, true)),
      mat(new THREE.MeshStandardMaterial({ color: colr, transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 0.5 })),
    );
    const rimTop = new THREE.Mesh(geo(new THREE.TorusGeometry(0.32, 0.09, 8, 20)), mat(new THREE.MeshStandardMaterial({ color: colr, roughness: 0.4 })));
    rimTop.rotation.x = Math.PI / 2; rimTop.position.y = 0.7;
    const rimBot = rimTop.clone(); rimBot.position.y = -0.7;
    g.add(pore, rimTop, rimBot);
    group.add(g);
    return g;
  }
  const kChannel = channel(-1.6, 0x22d3ee);
  const naChannel = channel(1.4, 0xf472b6);
  const pumpGroup = new THREE.Group(); pumpGroup.position.set(0, 0, 1.6); group.add(pumpGroup);
  const pump = new THREE.Mesh(
    geo(new THREE.BoxGeometry(0.7, 1.5, 0.7)),
    mat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.4, emissive: 0x7a5a00, emissiveIntensity: 0.3 })),
  );
  pumpGroup.add(pump);
  // —— 泵转运离子（3Na⁺出 / 2K⁺入）：沿 y 穿过泵体循环，与标签一一对应 ——
  const pumpNaMat = mat(new THREE.MeshBasicMaterial({ color: 0xf472b6 }));
  const pumpKMat = mat(new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
  const pumpIonGeo = geo(new THREE.SphereGeometry(0.1, 8, 8));
  const pumpNa: import('three').Mesh[] = [];  // 3 个 Na⁺：内→外（−y→+y）
  const pumpK: import('three').Mesh[] = [];   // 2 个 K⁺：外→内（+y→−y）
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(pumpIonGeo, pumpNaMat); pumpGroup.add(m); pumpNa.push(m); }
  for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(pumpIonGeo, pumpKMat); pumpGroup.add(m); pumpK.push(m); }

  // —— 穿膜离子：Na⁺ 内流(∝p)、K⁺ 外流(固定) ——
  const ionGeo = geo(new THREE.SphereGeometry(0.11, 10, 10));
  const naIonMat = mat(new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xf472b6, emissiveIntensity: 0.7 }));
  const kIonMat = mat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.7 }));
  const NA_N = 10, K_N = 8;
  const naIons: import('three').Mesh[] = [], kIons: import('three').Mesh[] = [];
  const naSeed: number[] = [], kSeed: number[] = [];
  for (let i = 0; i < NA_N; i++) { const m = new THREE.Mesh(ionGeo, naIonMat); m.visible = false; group.add(m); naIons.push(m); naSeed.push(Math.random()); }
  for (let i = 0; i < K_N; i++) { const m = new THREE.Mesh(ionGeo, kIonMat); group.add(m); kIons.push(m); kSeed.push(Math.random()); }

  // —— 跨膜电场 E 矢量（大箭头，长度 ∝ |V_m|，方向由 + 侧指向 − 侧） ——
  const upFieldGeo = geo(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(3.4, 0, -1.3), new THREE.Vector3(3.4, 1, -1.3)]));
  const fieldArrowMat = mat(new THREE.MeshBasicMaterial({ color: 0xa855f7 }));
  const fieldLine = new THREE.Line(upFieldGeo, mat(new THREE.LineBasicMaterial({ color: 0xa855f7 })));
  group.add(fieldLine);
  const fieldTip = new THREE.Mesh(geo(new THREE.ConeGeometry(0.16, 0.4, 12)), fieldArrowMat);
  group.add(fieldTip);
  const UP = new THREE.Vector3(0, 1, 0);

  function makeLabel(text: string, color: string, scale = 3.4): import('three').Sprite {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d')!;
    c.fillStyle = color; c.font = 'bold 28px "PingFang SC", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 32);
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex(new THREE.CanvasTexture(cv)), transparent: true })));
    s.scale.set(scale, scale / 8, 1); return s;
  }
  const lt = makeLabel('细胞外 (ₒ)  ·  正电荷堆积', '#f87171', 3.6); lt.position.set(0, 1.7, 0); group.add(lt);
  const lb = makeLabel('细胞内 (ᵢ)  ·  负电荷', '#60a5fa', 3.6); lb.position.set(0, -1.7, 0); group.add(lb);
  const lk = makeLabel('K⁺ 通道', '#22d3ee', 2.2); lk.position.set(-1.6, -1.1, 0); group.add(lk);
  const lna = makeLabel('Na⁺ 通道', '#f472b6', 2.2); lna.position.set(1.4, 1.2, 0); group.add(lna);
  const lp = makeLabel('Na⁺/K⁺-ATPase 泵 (3Na⁺出/2K⁺入)', '#fbbf24', 4); lp.position.set(0, 1.9, 1.6); group.add(lp);
  const lfield = makeLabel('跨膜电场 E（+ → −）∝|Vm|', '#c084fc', 3.4); lfield.position.set(4.2, 0, -1.3); group.add(lfield);

  // —— 信息面板 ——
  const infoCv = document.createElement('canvas'); infoCv.width = 820; infoCv.height = 268;
  const infoCtx = infoCv.getContext('2d')!;
  const infoTex = tex(new THREE.CanvasTexture(infoCv));
  const infoSprite = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: infoTex, transparent: true, depthTest: false })));
  infoSprite.position.set(0, 5.2, 0); infoSprite.scale.set(9.2, 3.0, 1); infoSprite.renderOrder = 999;
  group.add(infoSprite);

  let pNa = 0.04, Vm = ghk(pNa);

  function drawHeads(): void {
    const inten = Math.min(1, Math.abs(Vm) / 90);
    // 膜外为正(暖)、膜内为负(冷)；|V_m| 越大着色越饱和
    const pr = 0.55 + 0.45 * inten, pg = 0.25, pb = 0.2;
    const cr = 0.2, cg = 0.3, cb = 0.55 + 0.45 * inten;
    for (let k = 0; k < GX * GZ; k++) {
      headsTopCol[k * 3] = pr; headsTopCol[k * 3 + 1] = pg; headsTopCol[k * 3 + 2] = pb;
      headsBotCol[k * 3] = cr; headsBotCol[k * 3 + 1] = cg; headsBotCol[k * 3 + 2] = cb;
    }
    topGeo.attributes['color'].needsUpdate = true;
    botGeo.attributes['color'].needsUpdate = true;
  }
  function drawInfo(): void {
    infoCtx.clearRect(0, 0, 820, 268);
    infoCtx.fillStyle = 'rgba(7,11,20,0.85)'; infoCtx.fillRect(4, 4, 812, 260);
    infoCtx.strokeStyle = '#334155'; infoCtx.lineWidth = 3; infoCtx.strokeRect(4, 4, 812, 260);
    infoCtx.textAlign = 'left';
    infoCtx.fillStyle = '#f8fafc'; infoCtx.font = 'bold 27px "PingFang SC", sans-serif';
    infoCtx.fillText('膜电位与离子通道 — Goldman–Hodgkin–Katz 电压方程', 20, 40);
    infoCtx.fillStyle = '#22d3ee'; infoCtx.font = '24px "PingFang SC", sans-serif';
    infoCtx.fillText('V_m=(RT/F)·ln((P_K[K]ₒ+P_Na[Na]ₒ+P_Cl[Cl]ᵢ)/(P_K[K]ᵢ+P_Na[Na]ᵢ+P_Cl[Cl]ₒ))', 20, 82);
    infoCtx.fillStyle = '#a855f7'; infoCtx.font = '24px "PingFang SC", sans-serif';
    infoCtx.fillText(`E_K = ${E_K.toFixed(0)} mV   E_Na = ${E_Na.toFixed(0)} mV   （37℃，RT/F = 26.7 mV）`, 20, 120);
    infoCtx.fillStyle = '#f472b6';
    infoCtx.fillText('P_Na/P_K 越大 ⇒ V_m 越偏向 E_Na（去极化方向）；静息 P_Na≪P_K ⇒ ≈ −70 mV', 20, 158);
    infoCtx.fillStyle = '#fbbf24'; infoCtx.font = 'bold 25px "PingFang SC", sans-serif';
    infoCtx.fillText(`读数：P_Na/P_K = ${pNa.toFixed(3)}   V_m = ${Vm.toFixed(1)} mV   Na⁺内流 = ${(pNa * 10).toFixed(1)} 相对`, 20, 200);
    infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '23px "PingFang SC", sans-serif';
    infoCtx.fillText('扫描 Na⁺ 通透度 P_Na：膜两侧电荷着色、电位箭头长度与读数同源', 20, 240);
    infoTex.needsUpdate = true;
  }
  drawHeads(); drawInfo();

  return {
    update(t, dt) {
      const cycle = t % 16;
      const frac = cycle / 16;
      pNa = 0.02 + frac * frac * 0.98;      // 0.02 → 1.0（加速扫描）
      Vm = ghk(pNa);
      drawHeads();

      // Na⁺ 内流通道：越开（pNa 大）穿越离子越多、越快
      const naActive = Math.round(pNa * NA_N);
      for (let i = 0; i < NA_N; i++) {
        if (i < naActive) {
          naIons[i].visible = true;
          const u = ((t * (0.35 + 0.35 * pNa) + naSeed[i]) % 1);
          naIons[i].position.set(1.4 + (naSeed[i] - 0.5) * 0.2, 1.4 - u * 2.8, (naSeed[i] - 0.5) * 0.3);
        } else naIons[i].visible = false;
      }
      // K⁺ 外流（通透恒高）
      for (let i = 0; i < K_N; i++) {
        const u = ((t * 0.4 + kSeed[i]) % 1);
        kIons[i].position.set(-1.6 + (kSeed[i] - 0.5) * 0.25, -1.4 + u * 2.8, (kSeed[i] - 0.5) * 0.3);
      }
      // 泵周期性收缩 + 3Na⁺出(内→外)/2K⁺入(外→内) 离子循环（与标签对应）
      pump.scale.y = 1 + 0.14 * Math.sin(t * 2.2);
      {
        const cyc = (t * 0.35) % 1;                       // 一个转运周期
        // 3 个 Na⁺ 由膜内(-y)向膜外(+y)穿过泵
        for (let i = 0; i < 3; i++) {
          const u = (cyc + i / 3) % 1;
          pumpNa[i].position.set(-0.2 + i * 0.2, -1.15 + u * 2.3, 0);
          pumpNa[i].visible = true;
        }
        // 2 个 K⁺ 由膜外(+y)向膜内(-y)穿过泵
        for (let i = 0; i < 2; i++) {
          const u = (cyc + i / 2) % 1;
          pumpK[i].position.set(-0.12 + i * 0.24, 1.15 - u * 2.3, 0);
          pumpK[i].visible = true;
        }
      }
      // 跨膜电场 E 矢量：由 + 指向 −（静息外+内− ⇒ 指向 −y；Vm>0 去极化反转 ⇒ +y），长度 ∝ |Vm|
      const mag = 0.3 + Math.min(1.8, Math.abs(Vm) / 45);
      const edir = Vm < 0 ? -1 : 1;                       // E 的真实方向（沿 y）
      fieldTip.position.set(3.4, edir * (mag + 0.2), -1.3);
      fieldTip.quaternion.setFromUnitVectors(UP, edir < 0 ? UP.clone().negate() : UP);
      const fa = upFieldGeo.attributes['position'] as import('three').BufferAttribute;
      fa.array[1] = 0; fa.array[4] = edir * mag;
      upFieldGeo.attributes['position'].needsUpdate = true;

      if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) drawInfo();
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      texs.forEach((x) => x.dispose());
      scene.remove(group);
      scene.remove(pumpGroup);
    },
  };
}
