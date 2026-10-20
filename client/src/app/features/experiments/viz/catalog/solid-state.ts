import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** P31 晶格振动与声子：一维双原子链色散关系。 */
const latticeVibration = defineViz({
  slug: 'lattice-vibration',
  title: '晶格振动与声子',
  animated: true,
  params: {
    branch: { type: 'select', options: ['声学支', '光学支'], default: '声学支', label: '支' },
    ratio: { type: 'range', min: 1, max: 5, default: 2, step: 0.5, label: '质量比 M/m' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const branch = str(params, 'branch', '声学支');
    const ratio = num(params, 'ratio', 2); // M/m
    const acoustic = branch === '声学支';

    clear(f);
    // 左：一维双原子链振动
    const chainY = h * 0.26;
    const n = 6;
    const spacing = Math.min(46, (w * 0.42) / n);
    const x0 = 40;
    const t = f.t * 2.4;
    const k = Math.PI / (n * spacing); // 波矢（示意）
    const nodes: { x: number; heavy: boolean }[] = [];
    for (let i = 0; i < n * 2; i++) {
      nodes.push({ x: x0 + i * (spacing / 2), heavy: i % 2 === 0 });
    }
    // 弹簧线
    const springPts: [number, number][] = nodes.map((nd) => {
      const phase = Math.sin(k * nd.x - t) * (acoustic ? (nd.heavy ? 9 : -9) : (nd.heavy ? 9 : 9));
      return [nd.x, chainY + phase];
    });
    poly(f, springPts, { stroke: `${C.dim}aa`, lw: 1.4 });
    // 原子（大=重 M、小=m）
    springPts.forEach((p, i) => {
      const heavy = i % 2 === 0;
      dot(f, p[0], p[1], heavy ? 10 : 7, heavy ? C.cool : C.warm);
    });
    text(f, `${acoustic ? '声学支：同相位摆动（长波=整体起伏）' : '光学支：反相位摆动（异号离子相向）'}`, 30, chainY - 46, { color: C.accent, font: '12px sans-serif' });

    // 右：色散曲线 ω±(q)
    const rx0 = w * 0.5, rx1 = w - 30, ry0 = h - 56, ry1 = h * 0.46;
    const qx = Math.PI; // 归一化布里渊边界 q·a=π
    const sx = (q: number) => rx0 + (q / qx) * (rx1 - rx0);
    const M = ratio, m = 1, K = 1;
    const wOf = (q: number, sign: 1 | -1): number => {
      const s = K * (1 / M + 1 / m);
      const disc = s * s - (4 * K * Math.sin((q * Math.PI) / (2 * qx)) ** 2) / (M * m) * K;
      const val = s + sign * Math.sqrt(Math.max(disc, 0));
      return Math.sqrt(Math.max(val, 0));
    };
    let wMax = 0;
    for (let i = 0; i <= 60; i++) wMax = Math.max(wMax, wOf((i / 60) * qx, 1));
    const sy = (om: number) => ry0 - (om / (wMax * 1.1)) * (ry0 - ry1);
    // 轴
    seg(f, rx0, ry0, rx1, ry0, C.grid, 1.3);
    seg(f, rx0, ry0, rx0, ry1, C.grid, 1.3);
    for (const [sign, color, label] of [[-1, C.cool, '声学支 ω-'], [1, C.warm, '光学支 ω+']] as [1 | -1, string, string][]) {
      const pts: [number, number][] = [];
      for (let i = 1; i <= 120; i++) {
        const q = (i / 120) * qx;
        pts.push([sx(q), sy(wOf(q, sign))]);
      }
      const active = (sign === -1) === acoustic;
      poly(f, pts, { stroke: active ? color : `${color}44`, lw: active ? 2.6 : 1.3 });
      text(f, label, rx1 - 4, sy(wOf(qx * 0.96, sign)) + (sign === 1 ? -6 : 14), { align: 'right', color: active ? color : `${color}66`, font: '11px sans-serif' });
    }
    // 带隙
    const wTopLow = wOf(qx, -1), wTopHigh = wOf(qx, 1);
    seg(f, sx(qx) - 6, sy(wTopLow), sx(qx) - 6, sy(wTopHigh), C.green, 2.4);
    text(f, '声子禁带', sx(qx) - 12, (sy(wTopLow) + sy(wTopHigh)) / 2, { align: 'right', color: C.green, font: '11px sans-serif' });
    text(f, 'q·a → π（布里渊区边界）', rx1 - 4, ry0 + 18, { align: 'right', color: C.dim, font: '11px sans-serif' });
    text(f, 'ω', rx0 + 6, ry1 - 6, { color: C.dim, font: '12px sans-serif' });

    footnotes(f, [
      `质量比 M/m = ${ratio}：双原子链色散 ω² = K(1/M+1/m) ± K√[(1/M+1/m)² − 4sin²(qa/2)/(Mm)]`,
      '声学支长波极限 → 声速（q→0 线性）；光学支描述异号离子反相振动，与红外光强烈耦合',
      "量子化后即'声子'：固体比热（德拜模型）、热导与超导配对机制全部由它承载",
    ]);
    heading(f, '晶格振动：色散关系与声子');
  },
});
registerViz(latticeVibration);

/** P32 能带的形成：近自由电子模型。 */
const bandStructure = defineViz({
  slug: 'band-structure',
  title: '能带的形成',
  params: {
    a: { type: 'range', min: 2, max: 8, default: 4, step: 0.5, label: '晶格常数 a (Å)' },
    U: { type: 'range', min: 0.2, max: 6, default: 2.5, step: 0.1, label: '周期势强度 U (eV)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', 4);
    const U = num(params, 'U', 2.5);
    // 近自由电子：E(k)=k²（原子单位化）+ 布里渊边界 ±π/a 处开隙 U
    const kMax = Math.PI / a * 2;
    const E = (k: number): number => {
      const kBZ = Math.PI / a;
      const kk = Math.abs(k);
      // 在边界附近把上下支推开
      const edge = Math.abs(kk - kBZ);
      const base = kk * kk * (a * a) / (Math.PI * Math.PI); // 归一化抛物线
      const shift = edge < 0.35 ? (U / 2) * (1 - edge / 0.35) : 0;
      // 判定所在支：抛物线段序号
      const segIdx = Math.floor((kk + kBZ) / (2 * kBZ));
      return base + (segIdx % 2 === 0 ? -shift : shift);
    };

    const v = view(f, { xMin: -kMax, xMax: kMax, yMin: -1, yMax: E(kMax) * 1.15, inset: 48 });
    grid(f, v, { divisions: 5, ticks: true });
    // 布里渊边界线
    for (const kb of [-Math.PI / a, Math.PI / a]) {
      seg(f, v.sx(kb), v.sy(v.yMin), v.sx(kb), v.sy(v.yMax), `${C.warm}99`, 1.2, );
      text(f, '±π/a', v.sx(kb) + 4, v.sy(v.yMax) + 14, { color: C.warm, font: '11px sans-serif' });
    }
    // 能带曲线（分段绘制避免跨界跳变）
    for (const sign of [-1, 1]) {
      let prev: [number, number] | null = null;
      for (let i = 0; i <= 300; i++) {
        const k = sign * (i / 300) * kMax;
        const pt: [number, number] = [v.sx(k), v.sy(E(k))];
        if (prev && Math.abs(pt[1] - prev[1]) > h * 0.5) {
          prev = pt;
          continue; // 跨带隙跳变处断开
        }
        if (prev) seg(f, prev[0], prev[1], pt[0], pt[1], C.accent, 2.2);
        prev = pt;
      }
    }
    // 带隙标注
    const gapTop = E(Math.PI / a - 0.001);
    const gapBot = E(Math.PI / a + 0.001);
    text(f, `带隙 E_g ≈ ${Math.max(0, gapBot - gapTop).toFixed(2)} eV`, v.sx(Math.PI / a) + 10, v.sy((gapTop + gapBot) / 2), { color: C.green, font: '12px sans-serif' });
    text(f, '导带', v.sx(0), v.sy(E(0)) - 14, { align: 'center', color: C.accent, font: '11px sans-serif' });
    text(f, 'E(k)', v.sx(v.xMin) + 8, v.sy(v.yMax) + 14, { color: C.dim, font: '12px sans-serif' });
    text(f, 'k', v.sx(v.xMax) - 4, v.sy(0) + 4, { align: 'right', color: C.dim, font: '12px sans-serif' });

    footnotes(f, [
      `a = ${a} Å、U = ${U} eV：周期势在布里渊边界把抛物线'撕开'，间隙大小约正比于势强度 U`,
      '满带+小带隙=半导体（Si 1.1eV）、满带+大带隙=绝缘体、带未满=金属 —— 三种材料的区别只有带隙',
      '布洛赫定理：周期势中的电子态是调制平面波；能带理论是晶体管、LED 与所有半导体器件的第一性原理',
    ]);
    heading(f, '能带的形成：从能级到带隙');
  },
});
registerViz(bandStructure);

/** P33 霍尔效应：载流子偏转与霍尔电压。 */
const hallEffect = defineViz({
  slug: 'hall-effect',
  title: '霍尔效应',
  animated: true,
  params: {
    carrier: { type: 'select', options: ['电子（n 型）', '空穴（p 型）'], default: '电子（n 型）', label: '载流子' },
    B: { type: 'range', min: -5, max: 5, default: 2, step: 0.5, label: '磁场 B (T，负号反向)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const carrier = str(params, 'carrier', '电子（n 型）');
    const B = num(params, 'B', 2);
    const isElectron = carrier.startsWith('电子');
    const Bdir = Math.sign(B) || 1;

    clear(f);
    // 样品（矩形薄片俯视）
    const cw = Math.min(w * 0.62, 520), ch = Math.min(h * 0.4, 210);
    const cx = w / 2 - 20, cy = h / 2 + 10;
    const x0 = cx - cw / 2, y0 = cy - ch / 2;
    poly(f, [[x0, y0], [x0 + cw, y0], [x0 + cw, y0 + ch], [x0, y0 + ch]], {
      stroke: C.cool, lw: 2, fill: 'rgba(66,153,225,0.08)',
    } as any);
    text(f, '半导体薄片（电流 →）', x0, y0 - 12, { color: C.cool, font: '12px sans-serif' });

    // 载流子流（洛伦兹力偏转）
    const velSign = isElectron ? -1 : 1;   // 电子漂移与电流反向
    const forceSign = -velSign * Bdir;     // F = qv×B：电子 q<0
    const laneN = 5;
    for (let i = 0; i < laneN; i++) {
      const yBase = y0 + ch * ((i + 0.5) / laneN);
      const phase = ((f.t * 0.6 + i * 0.21) % 1);
      const px = x0 + 14 + phase * (cw - 28);
      const drift = forceSign * Bdir * Math.abs(B) * 22 * Math.sin(Math.PI * phase);
      const py = yBase + drift * (yBase < cy ? 1 : -1) * 0.4 + (forceSign > 0 ? -1 : 1) * (Math.abs(B) * 10 * phase);
      dot(f, px, Math.min(Math.max(py, y0 + 6), y0 + ch - 6), 6, isElectron ? C.accent : C.warm);
    }
    // 电荷积累标注
    const hallTop = forceSign > 0;
    text(f, hallTop ? (isElectron ? '上缘积累 (−)' : '上缘积累 (+)') : (isElectron ? '下缘积累 (−)' : '下缘积累 (+)'),
      x0 + cw + 12, hallTop ? y0 + 16 : y0 + ch - 8, { color: C.hot, font: '12px sans-serif' });
    // 霍尔电压表
    seg(f, x0 + cw, y0, x0 + cw + 46, y0, C.dim, 1.4);
    seg(f, x0 + cw, y0 + ch, x0 + cw + 46, y0 + ch, C.dim, 1.4);
    poly(f, [[x0 + cw + 46, y0 + 4], [x0 + cw + 74, y0 + 18], [x0 + cw + 46, y0 + 32], [x0 + cw + 46, y0 + 4]], { stroke: C.green, lw: 2 } as any);
    text(f, hallTop ? '+ V_H' : '− V_H', x0 + cw + 46, y0 + ch / 2, { color: C.green, font: '12px sans-serif' });
    // B 场符号（⊙/⊗）
    text(f, Bdir > 0 ? '⊙ B 出纸面' : '⊗ B 入纸面', 40, 44, { color: C.cyan, font: '13px sans-serif' });
    text(f, `B = ${B} T　载流子：${carrier}`, 40, 66, { color: C.dim, font: '12px sans-serif' });

    footnotes(f, [
      `霍尔电压 V_H = IB/(nqt)：极性由载流子符号决定 —— 当前${isElectron ? '电子' : '空穴'}积累在${hallTop ? '上' : '下'}缘`,
      '这是判别 n 型/p 型半导体的标准实验；霍尔系数 R_H = 1/(nq) 直接给出载流子浓度',
      '量子极限下 (ν=1,2,…) 霍尔电阻量子化为 R_K/ν（R_K≈25812.8Ω），成为电阻基准——2022 年 Frank/Wilczek 分数量子霍尔效应诺奖',
    ]);
    heading(f, '霍尔效应：磁场中的横向电压');
  },
});
registerViz(hallEffect);
