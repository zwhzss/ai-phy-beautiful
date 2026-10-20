import type { SceneContext, SceneInstance } from '../types';
import {
  scaffold, lineFrom, mesh, panelSprite, titleSprite, PAL, ResourceBag,
} from './_common';

/**
 * 机械波族（mechwave）：弦驻波 / 管驻波 / 多普勒 / 马赫锥 / 孤子 / 色散。
 * 由 scene-registry 按 slug+variant 绑定：make(variant, title)。
 * title 一路透传到 buildVariant，用于同 variant 下按知识点切换形态：
 *  - string 分支：title 含「达朗贝尔/行波/波动方程」→ 两列相向高斯脉冲 + 合成线 + 特征线网格；
 *    否则（振动弦与驻波）→ 三条谐波驻波 y=A·sin(nπx/L)cos(ωt)。
 *  - pipe 分支：title 含「亥姆霍兹」→ 主管驻波 + 旁支亥姆霍兹共振器 + 模式密度梳/腔 Q 线宽画布；
 *    否则（驻波管/管乐器）→ 开管（全谐波）与闭管（仅奇次）两条声压曲线上下对照。
 *  - doppler 分支：title 含「声波」→ 亚音速源（M≈0.55）波面压缩直观图；
 *    否则（多普勒效应）→ 源速扫过 M=1，加固定接收器的 v_los/f′/雷达双程读数与 M>1 的波面公切线（马赫锥）。
 */
export function make(variant: string, title: string): (ctx: SceneContext) => SceneInstance {
  return (ctx) => scaffold(ctx, {
    title,
    camera: [0, 4.5, 14],
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
    case 'pipe': return pipe(g, bag, THREE, title);
    case 'doppler': return doppler(g, bag, THREE, title);
    case 'shock': return shock(g, bag, THREE);
    case 'soliton': return soliton(g, bag, THREE);
    case 'dispersion': return dispersion(g, bag, THREE);
    case 'string':
    default: return stringWave(g, bag, THREE, title);
  }
}

/**
 * 振动弦与驻波（P11 / P550）/ 波动方程的达朗贝尔解（同 variant=string，靠 title 分流）：
 *  - title 含「达朗贝尔 / 行波 / 波动方程」→ 见 dalembert（两列相向脉冲 + 特征线网格）。
 *  - 否则 → 三条谐波驻波同时演示。
 */
function stringWave(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
) {
  // 达朗贝尔解知识点：改画行波叠加与特征线，不走驻波
  if (title.includes('达朗贝尔') || title.includes('行波') || title.includes('波动方程')) {
    return dalembert(g, bag, THREE);
  }

  const L = 10, N = 160;
  const modes = [1, 2, 3];
  const colors = [PAL.amber, PAL.cyan, PAL.green];
  const lines: import('three').Line[] = [];
  const geos: import('three').BufferGeometry[] = [];

  modes.forEach((n, i) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
    bag.geo(geo);
    geos.push(geo);
    const mat = bag.mat(new THREE.LineBasicMaterial({ color: colors[i] }));
    const ln = new THREE.Line(geo, mat);
    ln.position.y = 1.6 - i * 1.6;
    g.add(ln);
    lines.push(ln);
  });

  // 两端固定点标记
  const pinGeo = bag.geo(new THREE.SphereGeometry(0.12, 12, 12));
  const pinMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.slate }));
  [-L / 2, L / 2].forEach((x) => {
    [-1.6, 0, 1.6].forEach((y) => {
      const p = new THREE.Mesh(pinGeo, pinMat);
      p.position.set(x, y, 0);
      g.add(p);
    });
  });

  g.add(panelSprite(THREE, bag, [
    { text: '驻波：y = A sin(nπx/L) cos(ωt)', color: '#f8fafc' },
    { text: 'n=1 基频 · n=2,3 谐频（腹点增多）', color: '#94a3b8' },
    { text: '两端为波节，节间距离 λ/2', color: '#94a3b8' },
  ], [0, 4.0, 0], 7.2, 'center'));

  return (t: number) => {
    modes.forEach((n, i) => {
      const arr = (geos[i].getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
      const A = 0.75 - i * 0.12;
      for (let k = 0; k <= N; k++) {
        const x = (k / N) * L - L / 2;
        arr[k * 3] = x;
        arr[k * 3 + 1] = A * Math.sin((n * Math.PI * (x + L / 2)) / L) * Math.cos(t * 1.05 * n);
        arr[k * 3 + 2] = 0;
      }
      (geos[i].getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
      void lines;
    });
  };
}

/**
 * 波动方程的达朗贝尔解（wave-dalembert-solution 知识点）：
 * 沿 x 轴的弦上画两列相向传播的高斯脉冲 f(x−ct)（右行，暖色）与 g(x+ct)（左行，冷色），
 * 再叠加第三条白色合成线 y=f+g（两脉冲相遇时瞬时加倍，之后各自保持常形）；
 * 下方附一张 x–t 平面特征线示意（x±ct=const 两族斜线），
 * 加一个沿 x−ct=0 走的金色小球，直观呈现"沿特征线保持常形"。
 * 教学近似：域 [−L/2,L/2] 采用周期性回绕以让脉冲多次相遇；忽略端点反射的细节。
 */
function dalembert(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
) {
  const L = 14, N = 240;
  const c = 2.0;     // 波速（无量纲示意）
  const sigma = 0.9; // 高斯脉冲宽度
  const A = 0.85;    // 振幅

  // 便捷：生成一条固定槽位（z）的折线并登记
  const mkLine = (color: number, z: number) => {
    const geo = bag.geo(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
    const mat = bag.mat(new THREE.LineBasicMaterial({ color }));
    const line = new THREE.Line(geo, mat);
    line.position.z = z;
    g.add(line);
    return geo;
  };
  const geoF = mkLine(PAL.amber, -1.6);  // 右行 f(x−ct) 槽（暖）
  const geoSum = mkLine(PAL.white, 0);   // 合成 y=f+g（白）
  const geoG = mkLine(PAL.cyan, 1.6);    // 左行 g(x+ct) 槽（冷）

  // 弦端点标记
  const pinGeo = bag.geo(new THREE.SphereGeometry(0.14, 10, 10));
  const pinMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.slate }));
  [-L / 2, L / 2].forEach((x) => {
    const p = new THREE.Mesh(pinGeo, pinMat);
    p.position.set(x, 0, 0);
    g.add(p);
  });

  // x–t 平面：两族特征线示意（x−ct=C  ↗ ；x+ct=C  ↖ ）
  const charY = -3.0, charT = 1.4;   // 示意中心 y 与半高
  const slope = (c * 2 * charT) / (L / 2); // 让一帧内 dx/dt 与图幅比例匹配
  const segs: number[] = [];
  for (let k = -3; k <= 3; k++) {
    const x0 = (k / 3) * (L / 2);
    segs.push(x0, charY - charT, 0, x0 + slope * charT * 2, charY + charT, 0); // x−ct=C ↗
    segs.push(x0, charY - charT, 0, x0 - slope * charT * 2, charY + charT, 0); // x+ct=C ↖
  }
  // 底/顶水平线（t=0 与 t=T 边界）
  segs.push(-L / 2, charY - charT, 0, L / 2, charY - charT, 0);
  segs.push(-L / 2, charY + charT, 0, L / 2, charY + charT, 0);
  // 左右竖线（x 边界）
  segs.push(-L / 2, charY - charT, 0, -L / 2, charY + charT, 0);
  segs.push(L / 2, charY - charT, 0, L / 2, charY + charT, 0);
  const charGeo = bag.geo(new THREE.BufferGeometry());
  charGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs), 3));
  const charMesh = new THREE.LineSegments(
    charGeo,
    bag.mat(new THREE.LineBasicMaterial({ color: PAL.violet, transparent: true, opacity: 0.6 })),
  );
  charMesh.position.z = -2.6;
  g.add(charMesh);

  // 沿一条特征线（x−ct=0）运动的小金球 —— 示意"常形沿特征线传播"
  const markerGeo = bag.geo(new THREE.SphereGeometry(0.16, 12, 12));
  const markerMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold }));
  const marker = new THREE.Mesh(markerGeo, markerMat);
  marker.position.z = -2.6;
  g.add(marker);

  // 特征线示意标题（小型面板）
  g.add(panelSprite(THREE, bag, [
    { text: 'x–t 平面示意：两族斜线即 x−ct=C（↗）与 x+ct=C（↖）', color: '#a78bfa' },
  ], [0, charY - 2.0, -2.6], 6.6, 'center'));

  g.add(panelSprite(THREE, bag, [
    { text: '达朗贝尔解 y(x,t) = f(x−ct) + g(x+ct)', color: '#f8fafc' },
    { text: '暖色 f：右行；冷色 g：左行；白色：叠加 y=f+g', color: '#fbbf24' },
    { text: '两脉冲相遇瞬时加倍，之后各自保持常形（线性叠加原理）', color: '#94a3b8' },
    { text: '沿特征线 x±ct=const 保持常形；f,g 由 u(x,0)、u_t(x,0) 分解得到', color: '#67e8f9' },
  ], [0, 4.2, 0], 7.8, 'center'));

  // 域 [−L/2, L/2] 上的周期回绕（示意：脉冲穿出即从另一侧回来）
  const wrap = (x: number) => {
    const h = L / 2;
    return (((x + h) % L) + L) % L - h;
  };

  return (t: number) => {
    const aF = (geoF.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    const aS = (geoSum.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    const aG = (geoG.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    // 两脉冲峰分别沿 +x / −x 匀速移动；初始对称偏左/偏右，便于观察相遇
    const x1 = wrap(-L / 4 + c * t); // f(x−ct) 峰，起始偏左，右行
    const x2 = wrap(L / 4 - c * t);  // g(x+ct) 峰，起始偏右，左行
    for (let k = 0; k <= N; k++) {
      const x = (k / N) * L - L / 2;
      const dF = x - x1, dG = x - x2;
      // 考虑周期回绕：把距离折回主区间，避免脉冲"消失"
      const ddF = Math.abs(dF) > L / 2 ? (dF - Math.sign(dF) * L) : dF;
      const ddG = Math.abs(dG) > L / 2 ? (dG - Math.sign(dG) * L) : dG;
      const yF = A * Math.exp(-(ddF * ddF) / (2 * sigma * sigma));
      const yG = A * Math.exp(-(ddG * ddG) / (2 * sigma * sigma));
      aF[k * 3] = x; aF[k * 3 + 1] = yF; aF[k * 3 + 2] = 0;
      aG[k * 3] = x; aG[k * 3 + 1] = yG; aG[k * 3 + 2] = 0;
      aS[k * 3] = x; aS[k * 3 + 1] = yF + yG; aS[k * 3 + 2] = 0;
    }
    (geoF.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    (geoSum.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    (geoG.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    // 小金球沿一条特征线（过原点、斜率 dx/dt=+c）在示意框内匀速上下往返
    const u = (t * 0.5) % 1; // 0..1 循环
    const dy = (u - 0.5) * 2 * charT; // y 相对中心
    marker.position.y = charY + dy;
    marker.position.x = slope * dy;   // 落在 x−ct=0 的示意斜线上
  };
}

/**
 * 驻波与管乐器（P58，standing-pipe）/ 亥姆霍兹方程与本征模（P548，helmholtz-modes）：
 * 按 title 分流 ——
 *  · 含「亥姆霍兹」：主管驻波 + 旁支亥姆霍兹共振器（开口沿管滑动、耦合拉动本征频率），
 *    右侧画布给出 concept 承诺的两项：**模式密度**（主管本征模梳，间隔 Δf=1/ρ）与
 *    **腔 Q 值**（洛伦兹响应线宽 Δω=γ，Q=ω₀/γ）；两者用的 ω(n)、γ、ω₀ 就是驱动腔体呼吸的那一组。
 *  · 否则（驻波管/管乐器）：上下两条管对照 —— 开管两端声压波节、全谐波列 fₙ=nv/2L；
 *    闭管闭端波腹+开端波节、仅奇次谐波 f_m=(2m−1)v/4L。金点逐帧在画出的曲线上求根而得（必在线上）。
 */
function pipe(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
) {
  const helmholtz = title.includes('亥姆霍兹');
  const L = 11, N = 180;
  const W1 = 2.4;              // 开管基频角频率（= πv/L 的场景取值）
  const GAMMA = 0.35;          // 旁支开口辐射损耗（阻尼率）→ Q = ω₀/γ ≈ 7–10
  const DRIVE = GAMMA / 2;     // 受迫项增益：稳态腔幅 = coupling（低损耗下）
  const modeOmega = (n: number) => (helmholtz ? 2 + n * 1.4 : n * W1); // 主管各模角频率（驱动与读数同源）
  const zO = helmholtz ? 0 : -1.55;   // 非亥姆霍兹：开管退到后景，前景留给闭管
  const zC = 1.55;                     // 闭管对照所在深度
  const RW = helmholtz ? 1.5 : 1.12;   // 管壁半径
  const AW = helmholtz ? 0.95 : 0.8;   // 声压曲线显示幅度（双管时收窄以免出管壁）
  // 管壁
  const wallGeo = bag.geo(new THREE.CylinderGeometry(RW, RW, L, 32, 1, true));
  const wallMat = bag.mat(new THREE.MeshStandardMaterial({
    color: 0x334155, transparent: true, opacity: 0.25, side: THREE.DoubleSide,
  }));
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.rotation.z = Math.PI / 2;
  wall.position.set(0, 1.4, zO);
  g.add(wall);

  const traceGeo = bag.geo(new THREE.BufferGeometry());
  traceGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const trace = new THREE.Line(traceGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.cyan })));
  trace.position.set(0, 1.4, zO);
  g.add(trace);

  // 波节标记：
  //  · 亥姆霍兹支 —— 主管 pₙ=sin(nπu) 各阶模的解析零点（u=k/n），保持原实现；
  //  · 驻波管支 —— 金点改为**逐帧在当前画出的曲线上求根**（含回绕端点），点必在线上（读数与几何同源）。
  const nodeGeo = bag.geo(new THREE.SphereGeometry(0.09, 10, 10));
  const nodeMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold }));
  const nodes: import('three').Mesh[] = [];
  if (helmholtz) {
    for (let n = 1; n <= 3; n++) {
      for (let k = 0; k <= n; k++) {
        const u = k / n;
        const m = new THREE.Mesh(nodeGeo, nodeMat);
        m.position.set(u * L - L / 2, 1.4, zO);
        g.add(m);
        nodes.push(m);
      }
    }
  }
  const MAXNODE = 8;
  const poolOpen: import('three').Mesh[] = [];
  const poolClosed: import('three').Mesh[] = [];
  if (!helmholtz) {
    for (let i = 0; i < MAXNODE; i++) {
      const a = new THREE.Mesh(nodeGeo, nodeMat);
      a.position.set(0, 1.4, zO);
      a.visible = false;
      g.add(a);
      poolOpen.push(a);
      const b = new THREE.Mesh(nodeGeo, nodeMat);
      b.position.set(0, 1.4, zC);
      b.visible = false;
      g.add(b);
      poolClosed.push(b);
    }
  }
  /** 在画出的采样折线上找 y=0 的穿越点（含采样点恰为零、含管端），返回去重后的场景 x 列表 */
  const findRoots = (arr: Float32Array): number[] => {
    const out: number[] = [];
    const push = (x: number): void => {
      if (out.length === 0 || Math.abs(out[out.length - 1] - x) > 1e-3) out.push(x);
    };
    for (let k = 0; k < N && out.length < MAXNODE; k++) {
      const ya = arr[k * 3 + 1], yb = arr[(k + 1) * 3 + 1];
      const xa = arr[k * 3], xb = arr[(k + 1) * 3];
      if (Math.abs(ya) < 1e-7) { push(xa); continue; }
      if (ya * yb <= 0 && Math.abs(ya - yb) > 1e-12) push(xa + ((xb - xa) * ya) / (ya - yb));
    }
    return out;
  };
  /** 把求得的零点位置贴到金点上（多出的隐藏） */
  const placeRoots = (pool: import('three').Mesh[], xs: number[], t: number): void => {
    pool.forEach((m, i) => {
      const on = i < xs.length;
      m.visible = on;
      if (on) {
        m.position.x = xs[i];
        m.scale.setScalar(1 + 0.25 * Math.sin(t * 3 + i));
      }
    });
  };

  // —— 闭管对照（仅 standing-pipe）：闭端 x=−L/2，p_m=cos((2m−1)πξ/2)，仅奇次谐波 ——
  let cTraceGeo: import('three').BufferGeometry | null = null;
  if (!helmholtz) {
    const cWall = new THREE.Mesh(
      bag.geo(new THREE.CylinderGeometry(RW, RW, L, 32, 1, true)),
      bag.mat(new THREE.MeshStandardMaterial({
        color: 0x334155, transparent: true, opacity: 0.25, side: THREE.DoubleSide,
      })),
    );
    cWall.rotation.z = Math.PI / 2;
    cWall.position.set(0, 1.4, zC);
    g.add(cWall);
    // 闭端盖板（实心：位移节点 / 声压腹点）
    const cCap = new THREE.Mesh(
      bag.geo(new THREE.CircleGeometry(RW, 28)),
      bag.mat(new THREE.MeshBasicMaterial({ color: PAL.slate, transparent: true, opacity: 0.55, side: THREE.DoubleSide })),
    );
    cCap.rotation.y = Math.PI / 2;
    cCap.position.set(-L / 2, 1.4, zC);
    g.add(cCap);
    cTraceGeo = bag.geo(new THREE.BufferGeometry());
    cTraceGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
    const cTrace = new THREE.Line(cTraceGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.amber })));
    cTrace.position.set(0, 1.4, zC);
    g.add(cTrace);
  }

  // —— 亥姆霍兹：模式密度梳 + 洛伦兹线宽（Q）画布。γ、ω(n)、ω₀ 全部复用驱动腔体的那一组 ——
  const drawHQ = helmholtz
    ? (() => {
      const cv = document.createElement('canvas');
      cv.width = 320; cv.height = 320;
      const cc = cv.getContext('2d')!;
      const tx = bag.tex(new THREE.CanvasTexture(cv));
      const pl = new THREE.Mesh(
        bag.geo(new THREE.PlaneGeometry(3.6, 3.6)),
        bag.mat(new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthTest: false })),
      );
      pl.position.set(7.6, 1.4, 0);
      pl.renderOrder = 997;
      g.add(pl);
      return (w0: number, amp: number): void => {
        cc.clearRect(0, 0, 320, 320);
        cc.fillStyle = 'rgba(7,11,20,0.85)'; cc.fillRect(0, 0, 320, 320);
        cc.strokeStyle = '#334155'; cc.lineWidth = 3; cc.strokeRect(1.5, 1.5, 317, 317);
        cc.font = '15px sans-serif'; cc.textAlign = 'left';
        // 上：本征模梳（模式密度 ρ=1/Δf，间距取主管实际使用的 ωₙ）
        cc.fillStyle = '#94a3b8'; cc.fillText('模式密度：本征模梳 fₙ=ωₙ/2π', 16, 26);
        cc.strokeStyle = '#475569'; cc.beginPath(); cc.moveTo(20, 96); cc.lineTo(300, 96); cc.stroke();
        for (let n = 1; n <= 9; n++) {
          const f = modeOmega(n) / (2 * Math.PI);
          const px = 20 + (f / 1.2) * 280;
          if (px > 300) break;
          cc.strokeStyle = '#22d3ee'; cc.lineWidth = 2;
          cc.beginPath(); cc.moveTo(px, 96); cc.lineTo(px, 44); cc.stroke();
        }
        const dF = (modeOmega(2) - modeOmega(1)) / (2 * Math.PI);
        cc.fillStyle = '#67e8f9';
        cc.fillText(`Δf=${dF.toFixed(3)} Hz ⇒ 模式密度 ρ=1/Δf=${(1 / dF).toFixed(2)} 模/Hz`, 20, 116);
        // 下：受迫阻尼响应曲线（与腔体 dA/dt=drive−(γ/2)A 同一组参数）
        cc.fillStyle = '#94a3b8'; cc.fillText('腔 Q：受迫响应曲线 + 实测半高宽', 16, 148);
        cc.strokeStyle = '#475569'; cc.beginPath(); cc.moveTo(20, 292); cc.lineTo(300, 292); cc.stroke();
        const wLo = 0.2, wHi = 6.6;
        const pxOf = (w: number) => 20 + ((w - wLo) / (wHi - wLo)) * 280;
        // 归一化响应 |A(ω)|/|A(ω₀)|：ω₀ 恰为当前开口耦合拉出来的本征频率
        const norm = GAMMA * w0; // ω=ω₀ 处的分母 = γω₀ → 峰值归一为 1
        const resp = (w: number) => norm / Math.sqrt((w0 * w0 - w * w) ** 2 + (GAMMA * w) ** 2);
        cc.strokeStyle = '#f59e0b'; cc.lineWidth = 3; cc.beginPath();
        for (let i = 0; i <= 160; i++) {
          const w = wLo + (i / 160) * (wHi - wLo);
          const py = 292 - Math.min(1.6, resp(w)) * 82;
          if (i === 0) cc.moveTo(pxOf(w), py); else cc.lineTo(pxOf(w), py);
        }
        cc.stroke();
        // 半高宽取**功率降一半**处（|A|=峰值/√2）——这才是 Q=ω₀/Δω 的常规定义，低损耗下 Δω→γ
        let wl = w0, wr = w0;
        for (let i = 0; i <= 640; i++) {
          const w = wLo + (i / 640) * (wHi - wLo);
          if (resp(w) >= Math.SQRT1_2) { wl = w; break; }
        }
        for (let i = 640; i >= 0; i--) {
          const w = wLo + (i / 640) * (wHi - wLo);
          if (resp(w) >= Math.SQRT1_2) { wr = w; break; }
        }
        const dW = Math.max(1e-3, wr - wl);
        cc.strokeStyle = '#fbbf24'; cc.lineWidth = 2; cc.setLineDash([5, 4]);
        cc.beginPath(); cc.moveTo(pxOf(w0), 292); cc.lineTo(pxOf(w0), 160); cc.stroke();
        cc.beginPath(); cc.moveTo(pxOf(wl), 234); cc.lineTo(pxOf(wr), 234); cc.stroke();
        cc.setLineDash([]);
        cc.fillStyle = '#fbbf24';
        cc.fillText(`ω₀=${w0.toFixed(2)}（开口耦合拉动本征频率）`, 20, 166);
        cc.fillText(`半高宽(功率½)Δω=${dW.toFixed(2)}（γ=${GAMMA.toFixed(2)}）→ Q=ω₀/Δω=${(w0 / dW).toFixed(2)}`, 20, 184);
        cc.fillText(`腔幅 |A|=${amp.toFixed(2)}（dA/dt=耦合−(γ/2)A）`, 20, 202);
        tx.needsUpdate = true;
      };
    })()
    : null;

  // 亥姆霍兹本征模：主管道（腔体/波导）+ 旁支空腔（亥姆霍兹共振器），开口沿管滑动
  let branch: import('three').Group | null = null;
  let hCavity: import('three').Mesh | null = null;
  if (helmholtz) {
    branch = new THREE.Group();
    g.add(branch);
    // 颈管（开口颈部）
    const neck = new THREE.Mesh(
      bag.geo(new THREE.CylinderGeometry(0.22, 0.22, 1.3, 16, 1, true)),
      bag.mat(new THREE.MeshStandardMaterial({
        color: 0x334155, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
      })),
    );
    neck.rotation.x = Math.PI / 2;
    neck.position.z = 2.05; // 从管壁（r=1.5）向 +z 伸出
    branch.add(neck);
    // 旁支空腔（闭端口袋）
    hCavity = new THREE.Mesh(
      bag.geo(new THREE.SphereGeometry(0.85, 20, 16)),
      bag.mat(new THREE.MeshStandardMaterial({
        color: PAL.violet, transparent: true, opacity: 0.35,
      })),
    );
    hCavity.position.z = 3.4;
    branch.add(hCavity);
    // 开口标记（金环）
    const mouth = new THREE.Mesh(
      bag.geo(new THREE.TorusGeometry(0.26, 0.05, 8, 24)),
      bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold })),
    );
    mouth.position.z = 1.45;
    branch.add(mouth);
    branch.position.y = 1.4;
  }

  g.add(panelSprite(THREE, bag, helmholtz ? [
    { text: '亥姆霍兹方程 ∇²ψ + k²ψ = 0：边界条件 → 离散本征值 kₙ', color: '#f8fafc' },
    { text: '腔体/波导/口袋的共振频率 fₙ = kvₙ/2π（本征值问题）', color: '#94a3b8' },
    { text: '旁支空腔开口移近声压波腹 → 耦合强 → 系统 fₙ 偏移更大', color: '#fbbf24' },
    { text: '模式密度 ρ=1/Δf（右图梳齿，Δf 取主管实际模间隔）；腔 Q=ω₀/Δω（右图实测半高宽）', color: '#67e8f9' },
    { text: '腔体做阻尼受迫振动 dA/dt=驱动−(γ/2)A：γ=0.35 → Q≈7，建立/衰减快慢就是 Q', color: '#94a3b8' },
  ] : [
    { text: `开管（后，青线）：两端声压波节，fₙ=nv/2L → ω=${modeOmega(1).toFixed(1)},${modeOmega(2).toFixed(1)},${modeOmega(3).toFixed(1)}`, color: '#f8fafc' },
    { text: `闭管（前，橙线）：闭端腹+开端节，f_m=(2m−1)v/4L → ω=${(W1 / 2).toFixed(1)},${(1.5 * W1).toFixed(1)},${(2.5 * W1).toFixed(1)}（仅奇次）`, color: '#f59e0b' },
    { text: `对照：同一 L、同一 v，闭管基频是开管的一半（${(W1 / 2).toFixed(1)} vs ${W1.toFixed(1)}）`, color: '#94a3b8' },
    { text: '金点=两条线**当前时刻**的声压零点（逐帧在画出的采样点上求根，点必在线上）', color: '#fbbf24' },
    { text: '长笛按孔改的正是有效管长 L → f₁=nv/2L 随之改变（音高）', color: '#94a3b8' },
  ], [0, 4.0, 0], 7.6, 'center'));

  let cavAmp = 0;   // 亥姆霍兹腔的包络幅值（阻尼受迫积分而来）
  let cavPhase = 0;
  let lastHq = -1;

  return (t: number, dt = 0.02) => {
    const step = Math.min(0.05, Math.max(0.001, dt));
    const arr = (traceGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    for (let k = 0; k <= N; k++) {
      const u = k / N;
      const x = u * L - L / 2;
      let amp = 0;
      for (let n = 1; n <= 3; n++) {
        amp += (1 / n) * Math.sin(n * Math.PI * u) * Math.cos(t * modeOmega(n));
      }
      arr[k * 3] = x;
      arr[k * 3 + 1] = AW * amp;
      arr[k * 3 + 2] = 0;
    }
    (traceGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    nodes.forEach((m, i) => { m.scale.setScalar(1 + 0.25 * Math.sin(t * 3 + i)); });
    // 驻波管支：把金点放到当前曲线实测的零点上（开管两端恒为零 → 自动出现在管口）
    if (poolOpen.length > 0) placeRoots(poolOpen, findRoots(arr), t);

    // 闭管声压：p(ξ,t)=Σ_m (1/m)cos((2m−1)πξ/2)cos(ω_m t)，ω_m=(2m−1)·ω₁/2 → 仅奇次谐波
    if (cTraceGeo) {
      const ca = (cTraceGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
      for (let k = 0; k <= N; k++) {
        const xi = k / N;
        let amp = 0;
        for (let mm = 1; mm <= 3; mm++) {
          const ord = 2 * mm - 1;
          amp += (1 / mm) * Math.cos(ord * Math.PI * xi / 2) * Math.cos(t * (ord * W1 / 2));
        }
        ca[k * 3] = xi * L - L / 2;
        ca[k * 3 + 1] = AW * amp;
        ca[k * 3 + 2] = 0;
      }
      (cTraceGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
      if (poolClosed.length > 0) placeRoots(poolClosed, findRoots(ca), t);
    }

    if (branch && hCavity) {
      // 开口沿主管缓慢滑动：n=1 模声压包络 sin(π(x+L/2)/L) 决定耦合强度
      const xo = 3.0 * Math.sin(t * 0.3);
      branch.position.x = xo;
      const coupling = Math.abs(Math.sin((Math.PI * (xo + L / 2)) / L));
      // 耦合越强，系统本征频率被拉动越大（教学示意）；腔体做阻尼受迫振动
      const w0 = 2.4 + 1.1 * coupling;
      cavPhase += w0 * step;
      cavAmp += (DRIVE * coupling - 0.5 * GAMMA * cavAmp) * step; // dA/dt = drive − (γ/2)A
      cavAmp = Math.max(0, Math.min(1.6, cavAmp));
      hCavity.scale.setScalar(1 + 0.3 * cavAmp * Math.sin(cavPhase));
      if (drawHQ && Math.floor(t * 5) !== lastHq) { lastHq = Math.floor(t * 5); drawHQ(w0, cavAmp); }
    }
  };
}

/**
 * 声波多普勒效应（P61，doppler-wave）/ 多普勒效应（P325，doppler-effect）——同 variant=doppler，靠 title 分流：
 *  · 「声波多普勒效应」：亚音速源（M≈0.55）波面压缩/拉伸的直观图像（保持原实现）。
 *  · 「多普勒效应」：源速在 M=0.5→1.5 之间扫描，固定接收器按视线方向速度算 f′=f·c/(c−v_los)，
 *    并给出雷达双程回波 (c+v_r)/(c−v_r)（concept 的"雷达测速"）；M>1 时沿 sin μ=1/M 的公切线
 *    画出波面包络即马赫锥（concept 的"马赫锥"）。读数板 5Hz，数字与波前几何同源于 X(t)。
 */
function doppler(
  g: import('three').Group,
  bag: ResourceBag,
  THREE: typeof import('three'),
  title: string,
) {
  const radar = !title.includes('声波');
  const RINGS = 9;
  const LIVE = 3;              // 一个波前的寿命 = 发射周期（相邻波前的时间间隔）
  const CW = 6.5 / LIVE;       // 波速 c：寿命内半径由 0.3 涨到 6.8（与原实现一致）
  const SPAN = 14;             // 源活动区间宽度
  const VC = radar ? 2.2 : 1.2;    // 源速均值（声波支 = 原实现的恒定 1.2）
  const VS = radar ? 1.15 : 0;     // 源速扫描幅度 → v ∈ [1.05, 3.35] ⇒ M ∈ [0.48, 1.54]
  const WS = (2 * Math.PI) / 26;   // 速度扫描角频率（26 s 一循环）
  // 源轨迹 X(t)=∫₀ᵗ v dt′ 的闭式；波前出生点与源位置都由它给出（读数与几何同源）
  const path = (tau: number) => VC * tau - (VS / WS) * (Math.cos(WS * tau) - 1);
  const vOf = (tau: number) => VC + VS * Math.sin(WS * tau);
  const fold = (x: number) => ((x % SPAN) + SPAN) % SPAN - SPAN / 2;

  const rings: import('three').Mesh[] = [];
  const ringGeo = bag.geo(new THREE.RingGeometry(0.96, 1.0, 64));
  const srcGeo = bag.geo(new THREE.SphereGeometry(0.3, 18, 18));
  const srcMat = bag.mat(new THREE.MeshStandardMaterial({ color: PAL.amber, emissive: 0xb45309, emissiveIntensity: 0.5 }));
  const src = new THREE.Mesh(srcGeo, srcMat);
  g.add(src);

  for (let i = 0; i < RINGS; i++) {
    const mat = bag.mat(new THREE.MeshBasicMaterial({
      color: PAL.cyan, transparent: true, opacity: 0.7, side: THREE.DoubleSide,
    }));
    const r = new THREE.Mesh(ringGeo, mat);
    r.rotation.x = -Math.PI / 2;
    r.position.y = -0.4;
    g.add(r);
    rings.push(r);
  }

  const srcTraceGeo = bag.geo(new THREE.BufferGeometry());
  srcTraceGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(160 * 3), 3));
  const trace = new THREE.Line(srcTraceGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.slate, transparent: true, opacity: 0.6 })));
  trace.position.y = -0.4;
  g.add(trace);
  let traceHead = 0;

  // —— 仅多普勒效应（P325）支：接收器 + 频移条 + 马赫锥包络线 + 5Hz 读数板 ——
  const RX = new THREE.Vector3(0, -0.4, 6.4);
  const receiver = new THREE.Mesh(
    bag.geo(new THREE.ConeGeometry(0.42, 0.9, 18)),
    bag.mat(new THREE.MeshStandardMaterial({ color: PAL.violet, emissive: 0x6d28d9, emissiveIntensity: 0.5 })),
  );
  receiver.rotation.x = Math.PI / 2;
  receiver.position.copy(RX);
  receiver.visible = radar;
  g.add(receiver);
  const barGeo = bag.geo(new THREE.BoxGeometry(0.18, 1, 0.18));
  const bar = new THREE.Mesh(barGeo, bag.mat(new THREE.MeshBasicMaterial({ color: PAL.green })));
  bar.position.set(RX.x - 1.4, RX.y - 0.5 + 0.5, RX.z);
  bar.visible = radar;
  g.add(bar);
  const coneSegGeo = bag.geo(new THREE.BufferGeometry());
  coneSegGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4 * 3), 3));
  const coneEnv = new THREE.LineSegments(
    coneSegGeo,
    bag.mat(new THREE.LineBasicMaterial({ color: PAL.red, transparent: true, opacity: 0.9 })),
  );
  coneEnv.position.y = -0.4;
  coneEnv.visible = false;
  g.add(coneEnv);

  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const c2 = cv.getContext('2d')!;
  const tex = bag.tex(new THREE.CanvasTexture(cv));
  const hud = new THREE.Sprite(bag.mat(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })));
  hud.scale.set(7.2, 7.2 * (128 / 512), 1);
  hud.position.set(0, 1.0, 7.4);
  hud.renderOrder = 998;
  hud.visible = radar;
  g.add(hud);
  const drawHud = (m: number, vr: number, fOne: number, fEcho: number, mu: number, hasTan: boolean): void => {
    c2.clearRect(0, 0, 512, 128);
    c2.fillStyle = 'rgba(7,11,20,0.74)';
    c2.fillRect(4, 4, 504, 120);
    c2.strokeStyle = 'rgba(51,65,85,0.9)'; c2.lineWidth = 3;
    c2.strokeRect(4, 4, 504, 120);
    c2.font = '27px "PingFang SC", "Microsoft YaHei", sans-serif';
    c2.textBaseline = 'middle';
    c2.fillStyle = '#fbbf24';
    c2.fillText(`读数：M=${m.toFixed(2)}  v_los=${vr.toFixed(2)} → f′/f=${fOne.toFixed(3)}`, 14, 36);
    c2.fillStyle = '#67e8f9';
    c2.fillText(
      hasTan
        ? `雷达双程 f回/f=${fEcho.toFixed(3)}   马赫锥 μ(实测切线)=${mu.toFixed(1)}°（asin(1/M)=${((Math.asin(Math.min(1, 1 / m)) * 180) / Math.PI).toFixed(1)}°）`
        : `雷达双程 f回/f=${fEcho.toFixed(3)}   ${m > 1 ? '源刚越出波前，公切线尚未形成' : '亚音速：无激波锥'}`,
      14, 84,
    );
    tex.needsUpdate = true;
  };

  g.add(panelSprite(THREE, bag, radar ? [
    { text: 'f′ = f·c/(c − v_los)：v_los 取源速在"源→接收器"视线上的分量', color: '#f8fafc' },
    { text: '雷达测速是双程：f回/f = (c+v_r)/(c−v_r) ≈ 1 + 2v_r/c', color: '#94a3b8' },
    { text: '源速在 M=0.48–1.55 间扫描；M>1 后过源点作最老波前的切线 → 即马赫锥（sin μ=R/Δx→1/M）', color: '#fbbf24' },
    { text: '绿条高度 ∝ f′/f（接收器处音调），读数板与波前出生点同源于 X(t)', color: '#22c55e' },
  ] : [
    { text: 'f′ = f·v /(v ∓ v_s)：靠近变密（音调高）', color: '#f8fafc' },
    { text: '波面间距 = 相邻周期内源前进距离', color: '#94a3b8' },
    { text: `本例 M = v/c ≈ ${(VC / CW).toFixed(2)} < 1（亚音速）；M > 1 波面叠加成激波`, color: '#94a3b8' },
  ], [0, 4.0, 0], 7.4, 'center'));

  let lastHud = -1;
  return (t: number) => {
    const x = fold(path(t));
    src.position.set(x, 0, 0);
    const arr = (srcTraceGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    arr[traceHead * 3] = x; arr[traceHead * 3 + 1] = 0; arr[traceHead * 3 + 2] = 0;
    traceHead = (traceHead + 1) % 160;
    (srcTraceGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;

    let maxAge = 0;
    rings.forEach((r, i) => {
      const age = ((t + (i / RINGS) * LIVE) % LIVE) / LIVE; // 0..1
      if (age > maxAge) maxAge = age;
      const rad = 0.3 + age * 6.5;
      // 波前出生坐标：与源同一轨迹映射 X(t)（含回绕处理）
      const bx = fold(path(t - age * LIVE));
      r.position.x = bx;
      r.scale.setScalar(rad);
      (r.material as import('three').MeshBasicMaterial).opacity = 0.75 * (1 - age);
    });

    if (radar) {
      // 视线方向上的源速分量（接近为正）→ 单程频移与雷达双程回波
      const los = RX.clone().sub(new THREE.Vector3(x, -0.4, 0));
      const dist = Math.max(0.5, los.length());
      const v = vOf(t);
      const vr = v * (los.x / dist); // 视线方向接近为正（源朝接收器走 → 频移变高）
      const fOne = CW / Math.max(0.05, CW - vr);
      const fEcho = (CW + vr) / Math.max(0.05, CW - vr); // 雷达双程：接近 >1、远离 <1
      bar.scale.set(1, Math.min(4, fOne), 1);
      bar.position.y = -0.9 + bar.scale.y * 0.5;
      (bar.material as import('three').MeshBasicMaterial).color.setHex(vr > 0 ? PAL.green : PAL.red);
      // M>1：马赫锥是波面族的公切线。角度不抄 asin(1/M)，而是从画面里最老的那枚波前量出来：
      // sin μ = R/|Δx|（R=该波前半径、Δx=源现在与它出生点的距离），与环严格相切；
      // 源还没越出最老波前（R ≥ |Δx|）时没有切线 → 锥不出现，正是 M 刚过 1 的物理。
      const tauOld = Math.max(1e-4, maxAge) * LIVE;
      const radOld = 0.3 + CW * tauOld;
      const dOld = Math.abs(path(t) - path(t - tauOld));
      const ratio = radOld / dOld;
      const hasTan = ratio < 0.998;
      const mu = hasTan ? Math.asin(ratio) : Math.PI / 2;
      if (hasTan) {
        const len = 9;
        const cAttr = coneSegGeo.getAttribute('position') as import('three').BufferAttribute;
        const carr = cAttr.array as Float32Array;
        carr[0] = 0; carr[1] = 0; carr[2] = 0;
        carr[3] = -Math.cos(mu) * len; carr[4] = 0; carr[5] = Math.sin(mu) * len;
        carr[6] = 0; carr[7] = 0; carr[8] = 0;
        carr[9] = -Math.cos(mu) * len; carr[10] = 0; carr[11] = -Math.sin(mu) * len;
        cAttr.needsUpdate = true;
        coneEnv.visible = true;
        coneEnv.position.x = x;
      } else {
        coneEnv.visible = false;
      }
      const hb = Math.floor(t * 5); // 读数板 5Hz
      if (hb !== lastHud) {
        lastHud = hb;
        drawHud(v / CW, vr, fOne, fEcho, (mu * 180) / Math.PI, hasTan);
      }
    }
  };
}

/** 激波与马赫锥（P62）：锥尖在机头、朝来流上游展开；波面盘=历史发射点的球面波，公共切面即马赫锥 */
function shock(g: import('three').Group, bag: ResourceBag, THREE: typeof import('three')) {
  const M = 2.2;
  const half = Math.asin(1 / M); // 马赫角 μ = asin(1/M)
  const v = 2;                   // 飞行器速度（源路径 x(t) = -6 + 2t，每周期回绕）
  const cyc = 6;                 // 一个飞行周期（沿 [-6, 6] 飞行一次）
  const cs = v / M;              // 声速 c：sin μ = v/c = 1/M → 波面包络角恰为 μ
  const R = 5.0, h = R / Math.tan(half); // 锥底半径与锥高（半顶角 = μ）
  const cone = bag.mat(new THREE.MeshBasicMaterial({
    color: PAL.red, transparent: true, opacity: 0.3, side: THREE.DoubleSide, wireframe: true,
  }));
  const coneGeo = bag.geo(new THREE.ConeGeometry(R, h, 48, 1, true));
  const c = new THREE.Mesh(coneGeo, cone);
  c.rotation.z = -Math.PI / 2;   // 锥尖朝 +x（来流上游 / 飞行方向）
  c.position.y = 1.4;
  g.add(c);

  // 波面盘：每个盘是一次历史发射（t_e 时刻）的球面波波前
  const DISCS = 6;
  const discs: import('three').Mesh[] = [];
  const dGeo = bag.geo(new THREE.CircleGeometry(1, 48));
  for (let i = 0; i < DISCS; i++) {
    const m = new THREE.Mesh(dGeo, bag.mat(new THREE.MeshBasicMaterial({
      color: PAL.cyan, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
    })));
    m.rotation.y = Math.PI / 2;
    m.position.y = 1.4;
    g.add(m);
    discs.push(m);
  }
  const noseGeo = bag.geo(new THREE.ConeGeometry(0.35, 1.2, 16));
  const nose = new THREE.Mesh(noseGeo, bag.mat(new THREE.MeshStandardMaterial({ color: PAL.amber })));
  nose.rotation.z = -Math.PI / 2;
  nose.position.y = 1.4;
  g.add(nose);

  g.add(panelSprite(THREE, bag, [
    { text: '马赫锥：sin μ = 1/M，M = v/v_sound', color: '#f8fafc' },
    { text: `当前 M = ${M.toFixed(1)}，半顶角 μ = ${(half * 180 / Math.PI).toFixed(1)}°`, color: '#fbbf24' },
    { text: '锥面=所有波面的公共切面（盘心=发射点，半径=c·Δt）→ 冲击波', color: '#94a3b8' },
  ], [0, 4.0, 0], 7.4, 'center'));

  return (t: number) => {
    const tRel = t % cyc;                 // 本周期内时刻（源每周期从 x=-6 重新出发）
    const noseX = -6 + v * tRel;          // 源（机头）位置 x(t) = -6 + 2t
    nose.position.x = noseX;
    c.position.x = noseX - h / 2;         // 锥尖落在机头，锥体向后（-x）展开
    const fade = Math.min(1, (cyc - tRel) / 0.8); // 周期末整组淡出，循环重启不突兀
    (c.material as import('three').MeshBasicMaterial).opacity = 0.3 * fade;
    discs.forEach((d, i) => {
      const te = i * (cyc / DISCS);       // 发射时刻 t_e（周期内均匀分布）
      if (tRel < te) { d.visible = false; return; } // 尚未发射
      d.visible = true;
      const age = tRel - te;              // Δt = t − t_e
      d.position.x = -6 + v * te;         // 盘心 = 发射点（源的历史位置）
      d.scale.setScalar(cs * age);        // 半径 = c·(t − t_e)
      (d.material as import('three').MeshBasicMaterial).opacity = 0.45 * (1 - age / cyc) * fade;
    });
  };
}

/** 孤子（P63）：恒形传播的非线性波 */
function soliton(g: import('three').Group, bag: ResourceBag, THREE: typeof import('three')) {
  const N = 220, L = 14;
  const geo = bag.geo(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const line = new THREE.Line(geo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.violet })));
  line.position.y = 1.4;
  g.add(line);

  // 对照：线性色散波（会散开）
  const geo2 = bag.geo(new THREE.BufferGeometry());
  geo2.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const line2 = new THREE.Line(geo2, bag.mat(new THREE.LineBasicMaterial({ color: PAL.slate, transparent: true, opacity: 0.75 })));
  line2.position.y = -0.6;
  g.add(line2);

  g.add(panelSprite(THREE, bag, [
    { text: '孤子 u = A sech²(k(x−ct))：色散与非线性平衡', color: '#f8fafc' },
    { text: '紫线：孤子（波形不扩散）', color: '#a78bfa' },
    { text: '灰线：线性波包（逐渐展宽）', color: '#94a3b8' },
  ], [0, 4.0, 0], 7.6, 'center'));

  return (t: number) => {
    const a = geo.getAttribute('position') as import('three').BufferAttribute;
    const b = geo2.getAttribute('position') as import('three').BufferAttribute;
    const arrA = a.array as Float32Array;
    const arrB = b.array as Float32Array;
    const c = 2.2;
    const x0 = ((t * c) % (L + 4)) - (L + 4) / 2;
    for (let k = 0; k <= N; k++) {
      const x = (k / N) * L - L / 2;
      arrA[k * 3] = x;
      const s = (x - x0) / 1.1;
      arrA[k * 3 + 1] = 1.6 / Math.cosh(s) ** 2;
      arrA[k * 3 + 2] = 0;
      // 线性对照：同中心的几个频率叠加 → 展宽
      arrB[k * 3] = x;
      let y = 0;
      for (let n = 1; n <= 5; n++) {
        y += (1 / n) * Math.cos(2 * Math.PI * n * (x - x0 * (1 + 0.06 * n)) / 4);
      }
      arrB[k * 3 + 1] = 0.42 * y * Math.exp(-(((x - x0) / 3.4) ** 2));
      arrB[k * 3 + 2] = 0;
    }
    a.needsUpdate = true;
    b.needsUpdate = true;
  };
}

/**
 * 波的色散（P65）：ω(k) 非线性 → 相速 v_p=ω/k 与群速 v_g=dω/dk 分离。
 * 三条成分各带一个随自身群速平移的高斯窗（这才是"波包"本体）；
 * 粉线为解析包络 A(x,t)=|Σ exp(i(k_i x−ω_i t))·窗|，金线为合成波 A·cos(相位)，
 * 两枚金球标出实测 RMS 半宽 —— 成分群速不同 → 波包随时间展宽（面板承诺的图像）。
 * ω(k) 取穿过三组 (k,ω) 数据的二次插值，群速为该插值的解析导数，读数与几何严格同源。
 * 教学近似：域 [−L/2,L/2] 周期回绕，循环末窗宽复位。
 */
function dispersion(g: import('three').Group, bag: ResourceBag, THREE: typeof import('three')) {
  const N = 260, L = 15;
  const comps = [
    { k: 1.0, w: 1.6, color: PAL.cyan },
    { k: 1.6, w: 3.6, color: PAL.green },
    { k: 2.4, w: 6.6, color: PAL.amber },
  ];
  // Lagrange 二次插值 ω(k) = A + B·k + C·k²（严格穿过三点）与其导数 v_g = B + 2C·k
  const ks = comps.map((c) => c.k);
  const ws = comps.map((c) => c.w);
  const d0 = (ks[0] - ks[1]) * (ks[0] - ks[2]);
  const d1 = (ks[1] - ks[0]) * (ks[1] - ks[2]);
  const d2 = (ks[2] - ks[0]) * (ks[2] - ks[1]);
  const Cm = ws[0] / d0 + ws[1] / d1 + ws[2] / d2;
  const Bm = -((ws[0] * (ks[1] + ks[2])) / d0 + (ws[1] * (ks[0] + ks[2])) / d1 + (ws[2] * (ks[0] + ks[1])) / d2);
  const Am = ws[0] - Bm * ks[0] - Cm * ks[0] * ks[0];
  const omegaOf = (k: number) => Am + Bm * k + Cm * k * k;
  const vgOf = (k: number) => Bm + 2 * Cm * k;

  const SIG0 = 1.9;   // 每个成分自身的波包半宽（场景单位）
  const TC = 10;      // 展宽循环周期（秒）
  const SPAN = L;     // 共动坐标回绕跨度（波包中心始终留在画面内）
  const X0 = -SPAN / 4; // 出发中心
  const fold = (v: number) => ((v % SPAN) + SPAN) % SPAN - SPAN / 2;

  const geos: import('three').BufferGeometry[] = [];
  const lines: import('three').Line[] = [];
  comps.forEach((c) => {
    const geo = bag.geo(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
    geos.push(geo);
    const ln = new THREE.Line(geo, bag.mat(new THREE.LineBasicMaterial({ color: c.color })));
    ln.position.y = 1.8;
    g.add(ln);
    lines.push(ln);
  });
  const envGeo = bag.geo(new THREE.BufferGeometry());
  envGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const env = new THREE.Line(envGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.pink, transparent: true, opacity: 0.9 })));
  env.position.y = -0.9;
  g.add(env);
  const sumGeo = bag.geo(new THREE.BufferGeometry());
  sumGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const sumLine = new THREE.Line(sumGeo, bag.mat(new THREE.LineBasicMaterial({ color: PAL.white, transparent: true, opacity: 0.9 })));
  sumLine.position.y = -0.9;
  g.add(sumLine);

  // 实测 RMS 半宽的两个标记球（画在包络线上，宽度由几何量出来，不是公式抄来的）
  const beadGeo = bag.geo(new THREE.SphereGeometry(0.16, 12, 12));
  const beadMat = bag.mat(new THREE.MeshBasicMaterial({ color: PAL.gold }));
  const beadL = new THREE.Mesh(beadGeo, beadMat);
  const beadR = new THREE.Mesh(beadGeo, beadMat);
  beadL.position.y = -0.9; beadR.position.y = -0.9;
  g.add(beadL); g.add(beadR);

  // 5Hz 读数板：群速 / 相速 / 实测半宽，全部取自上面同一批函数
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const c2 = cv.getContext('2d')!;
  const tex = bag.tex(new THREE.CanvasTexture(cv));
  const hud = new THREE.Sprite(bag.mat(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })));
  hud.scale.set(7.0, 7.0 * (128 / 512), 1);
  hud.position.set(0, -3.5, 0);
  hud.renderOrder = 998;
  g.add(hud);
  const drawHud = (vg: number[], vp: number[], sig: number, xbar: number): void => {
    c2.clearRect(0, 0, 512, 128);
    c2.fillStyle = 'rgba(7,11,20,0.74)';
    c2.fillRect(4, 4, 504, 120);
    c2.strokeStyle = 'rgba(51,65,85,0.9)'; c2.lineWidth = 3;
    c2.strokeRect(4, 4, 504, 120);
    c2.font = '27px "PingFang SC", "Microsoft YaHei", sans-serif';
    c2.textBaseline = 'middle';
    c2.fillStyle = '#fbbf24';
    c2.fillText(`v_g=dω/dk: ${vg.map((x) => x.toFixed(2)).join(' / ')}（ω/k: ${vp.map((x) => x.toFixed(2)).join(' / ')}）`, 14, 38);
    c2.fillStyle = '#94a3b8';
    c2.fillText(`包络质心 x̄=${xbar.toFixed(2)}，实测 RMS 半宽 σ=${sig.toFixed(2)}（单窗参考 σ₀/2=${(SIG0 / 2).toFixed(2)}）`, 14, 84);
    tex.needsUpdate = true;
  };

  g.add(panelSprite(THREE, bag, [
    { text: '色散：ω(k) 非线性 → v_g = dω/dk ≠ v_p = ω/k', color: '#f8fafc' },
    { text: `三条成分窗各按自身 v_g=${vgOf(ks[0]).toFixed(2)}、${vgOf(ks[1]).toFixed(2)}、${vgOf(ks[2]).toFixed(2)} 平移`, color: '#94a3b8' },
    { text: '粉线：解析包络 A(x,t)；白线：合成波 A·cosφ（载波跑在 v_p 上）', color: '#f472b6' },
    { text: '群速不同 → 成分窗互相跑开 → 包络随时间展宽（金球=实测半宽）', color: '#94a3b8' },
    { text: 'ω(k) 为穿过三组 (k,ω) 的二次插值；波包整体按平均群速回绕平移（教学近似）', color: '#67e8f9' },
  ], [0, 4.0, 0], 7.6, 'center'));
  void lines;

  const vbar = (vgOf(ks[0]) + vgOf(ks[1]) + vgOf(ks[2])) / 3; // 共动帧速度 = 三成分群速的平均
  let lastHud = -1;

  return (t: number) => {
    const tau = t % TC;
    const envArr = (envGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    const sumArr = (sumGeo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
    // 波包共动帧中心以平均群速 v̄_g 平移（超出画面即回绕），
    // 成分窗相对帧心的偏移 = (v_g,i − v̄_g)·τ → "包络展宽"完全由色散关系给出的群速差驱动，
    // 不是额外贴上去的宽度公式；载波相位用世界坐标 x = ξ + xg 计算，因而按 v_p = ω/k 跑。
    const xg = fold(X0 + vbar * tau);
    const off = comps.map((c) => (vgOf(c.k) - vbar) * tau);
    geos.forEach((geo, i) => {
      const c = comps[i];
      const arr = (geo.getAttribute('position') as import('three').BufferAttribute).array as Float32Array;
      for (let j = 0; j <= N; j++) {
        const xi = (j / N) * L - L / 2;         // 共动（波包参考系）坐标
        const d = xi - off[i];
        arr[j * 3] = xi;
        arr[j * 3 + 1] = 0.55 * Math.sin(c.k * (xi + xg) - c.w * t) * Math.exp(-((d / SIG0) ** 2));
        arr[j * 3 + 2] = 0;
      }
      (geo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
      lines[i].position.x = xg;                  // 整条线随共动帧平移
    });
    // 包络 = 三成分复振幅之和的模；合成波 = 其实部；再统计 A² 加权矩得实测质心与半宽
    let s0 = 0, s1 = 0, s2 = 0;
    for (let j = 0; j <= N; j++) {
      const xi = (j / N) * L - L / 2;
      let re = 0, im = 0;
      comps.forEach((c, i) => {
        const gw = 0.55 * Math.exp(-(((xi - off[i]) / SIG0) ** 2));
        const ph = c.k * (xi + xg) - c.w * t;
        re += gw * Math.cos(ph);
        im += gw * Math.sin(ph);
      });
      const A = Math.hypot(re, im);
      envArr[j * 3] = xi; envArr[j * 3 + 1] = A; envArr[j * 3 + 2] = 0;
      sumArr[j * 3] = xi; sumArr[j * 3 + 1] = 0.9 * re; sumArr[j * 3 + 2] = 0;
      const w = A * A;
      s0 += w; s1 += w * xi; s2 += w * xi * xi;
    }
    (envGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    (sumGeo.getAttribute('position') as import('three').BufferAttribute).needsUpdate = true;
    env.position.x = xg;
    sumLine.position.x = xg;
    const xbar = s0 > 1e-9 ? s1 / s0 : 0;
    const sig = s0 > 1e-9 ? Math.sqrt(Math.max(0, s2 / s0 - xbar * xbar)) : 0;
    beadL.position.x = xg + xbar - sig;
    beadR.position.x = xg + xbar + sig;
    const hb = Math.floor(t * 5); // 读数板 5Hz
    if (hb !== lastHud) {
      lastHud = hb;
      drawHud(comps.map((c) => vgOf(c.k)), comps.map((c) => omegaOf(c.k) / c.k), sig, xg + xbar);
    }
    void mesh;
    void titleSprite;
  };
}
