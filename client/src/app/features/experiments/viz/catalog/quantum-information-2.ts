import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** 不可克隆定理。 */
const noCloning = defineViz({
  slug: 'no-cloning', title: '量子不可克隆', animated: true,
  params: {
    demo: { type: 'select', options: ['克隆机佯谬', '经典 vs 量子复制'], default: '克隆机佯谬', label: '演示' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const classic = String((params as Record<string, unknown>)['demo'] ?? '').includes('经典');
    clear(f);
    if (classic) {
      // 经典复制：比特可复制
      const y = h * 0.34;
      text(f, '经典：|0⟩ → |0⟩|0⟩　（合法复制）', w * 0.1, y, { color: C.green, font: '15px serif' });
      text(f, '量子：U|ψ⟩|0⟩ = |ψ⟩|ψ⟩ 要求 ⟨m|ψ⟩*⟨m|ψ⟩=⟨ψ|ψ⟩ 对所有 ψ 成立 — 不可能', w * 0.1, y + 54, { color: C.hot, font: '14px serif' });
      // 线性性演示（叠加态复制导致纠缠）
      const y2 = h * 0.66;
      const alpha = Math.cos(f.t * 0.7), beta = Math.sin(f.t * 0.7);
      text(f, `输入叠加态 α=${alpha.toFixed(2)}|0⟩+β=${beta.toFixed(2)}|1⟩`, w * 0.1, y2, { color: C.cyan, font: '14px sans-serif' });
      text(f, '输出会把两体纠缠起来：|ψ⟩|ψ⟩ ≠ α²|00⟩+β²|11⟩（系数错位）', w * 0.1, y2 + 40, { color: C.warm, font: '13px sans-serif' });
      text(f, '复制未知量子态在数学上无解——不是技术难，是不允许', w * 0.1, y2 + 84, { color: C.cyan, font: '13px sans-serif' } as any);
    } else {
      // 克隆机佯谬（交换两态）
      const x0 = w * 0.2, y0 = h * 0.4;
      poly(f, [[x0, y0 - 60], [x0 + 130, y0 - 60], [x0 + 130, y0 + 60], [x0, y0 + 60]],
        { stroke: C.warm, lw: 2.4, fill: 'rgba(237,137,54,0.14)' } as any);
      text(f, '克隆机 U', x0 + 26, y0 + 6, { color: C.warm, font: '14px sans-serif' });
      // 输入输出线
      seg(f, x0 - 130, y0 - 24, x0, y0 - 24, C.cool, 2.4);
      text(f, '|ψ⟩ + |0⟩', x0 - 116, y0 - 34, { color: C.cool, font: '13px sans-serif' });
      for (const dy of [-24, 24]) {
        seg(f, x0 + 130, y0 + dy, x0 + 260, y0 + dy, C.green, 2.4);
      }
      text(f, '|ψ⟩|ψ⟩', x0 + 270, y0 - 20, { color: C.green, font: '13px sans-serif' });
      // 佯谬：交换输入也会'克隆'
      text(f, '若把 |ψ⟩ 与 |0⟩ 换成两任意态输入，同一 U 会声称 |a⟩|b⟩→|b⟩|a⟩ 的一致性 —', 40, h * 0.68, { color: C.cyan, font: '13px sans-serif' });
      text(f, '当 a≠b 时与“输出两份同态”直接矛盾——幺正性禁止克隆机存在', 40, h * 0.68 + 38, { color: C.hot, font: '13px sans-serif' });
      const blink = 0.6 + 0.4 * Math.sin(f.t * 4);
      text(f, '✗', x0 + 56, y0 - 66, { color: `rgba(255,80,80,${blink})`, font: '30px sans-serif' });
    }

    footnotes(f, [
      '不可克隆定理（Wootters-Zurek-Dieks 1982）：幺正演化+未知态=不可复制',
      '它同时是量子密钥分发的安全保障（窃听无法无痕复制）与量子纠错的约束',
      '对比鲜明：经典比特随便复印，量子态一次性的保密性由此而生',
    ]);
    heading(f, '不可克隆定理：量子态的防伪水印');
  },
});
registerViz(noCloning);

/** 纠缠交换。 */
const entanglementSwapping = defineViz({
  slug: 'entanglement-swapping', title: '纠缠交换', animated: true,
  params: {
    stage: { type: 'range', min: 0, max: 3, default: 0, step: 1, label: '过程阶段' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const stage = Math.round(num(params, 'stage', 0));
    clear(f);
    const y = h * 0.44;
    const xs = [w * 0.14, w * 0.38, w * 0.62, w * 0.86];
    const labels = ['A', 'B', 'C', 'D'];
    // 四个站点
    for (let i = 0; i < 4; i++) {
      dot(f, xs[i], y, 13, i % 2 === 0 ? C.cool : C.warm);
      text(f, labels[i], xs[i] - 5, y + 5, { color: '#fff', font: '13px sans-serif' });
      text(f, labels[i], xs[i] - 5, y + 40, { color: C.dim, font: '11px sans-serif' });
    }
    // 阶段 0：制备 AB 与 CD 两对纠缠
    if (stage >= 0) {
      const pulse = 0.6 + 0.4 * Math.sin(f.t * 3);
      seg(f, xs[0], y, xs[1], y, `rgba(66,153,225,${pulse})`, 3.4);
      seg(f, xs[2], y, xs[3], y, `rgba(237,137,54,${pulse})`, 3.4);
      text(f, '纠缠源 1', (xs[0] + xs[1]) / 2 - 30, y - 24, { color: C.cool, font: '11px sans-serif' });
      text(f, '纠缠源 2', (xs[2] + xs[3]) / 2 - 30, y - 24, { color: C.warm, font: '11px sans-serif' });
    }
    // 阶段 1-2：BC 联合 Bell 测量
    if (stage >= 1) {
      const mx = (xs[1] + xs[2]) / 2;
      poly(f, [[xs[1] + 18, y - 30], [xs[2] - 18, y - 30], [xs[2] - 18, y + 30], [xs[1] + 18, y + 30]],
        { stroke: C.green, lw: 2.4, fill: 'rgba(16,185,129,0.16)' } as any);
      text(f, 'Bell 测量（B,C）', mx - 46, y + 5, { color: C.green, font: '12px sans-serif' });
      // 经典信道通知
      if (stage >= 2) {
        const tx = ((f.t * 0.7) % 1);
        dot(f, xs[1] + (xs[0] - xs[1]) * tx, y + 60, 5, C.hot);
        dot(f, xs[2] + (xs[3] - xs[2]) * tx, y + 60, 5, C.hot);
        text(f, '经典消息（2 bit）→ A 与 D 做对应幺正修正', w * 0.3, y + 90, { color: C.hot, font: '12px sans-serif' });
      }
    }
    // 阶段 3：AD 纠缠
    if (stage >= 3) {
      const glow = 0.6 + 0.4 * Math.sin(f.t * 4);
      const arc: [number, number][] = [];
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        arc.push([xs[0] + t * (xs[3] - xs[0]), y - 60 - Math.sin(t * Math.PI) * 70]);
      }
      poly(f, arc, { stroke: `rgba(146,84,222,${glow})`, lw: 3.4 });
      text(f, 'A,D 纠缠（从未谋面）——纠缠被“交换”过来了', w * 0.28, y - 150, { color: '#9254de', font: "14px sans-serif" });
    }
    text(f, '量子中继的核心：把短程纠缠“接长”成远距离纠缠', 30, 44, { color: C.cyan, font: "14px sans-serif" });

    footnotes(f, [
      '纠缠交换（Zukowski 1993）：对两个中间粒子做 Bell 测量，两端粒子瞬时纠缠',
      '它与隐形传态是同一枚硬币的两面——都靠 Bell 测量+经典通信完成',
      '量子中继站用它克服光纤损耗：洲际量子网络的工程蓝图',
    ]);
    heading(f, '纠缠交换：让陌生粒子建立联系');
  },
});
registerViz(entanglementSwapping);

/** 超密编码。 */
const superdenseCoding = defineViz({
  slug: 'superdense-coding', title: '超密编码', animated: true,
  params: {
    bit: { type: 'range', min: 0, max: 3, default: 1, step: 1, label: '要发送的 2 bit（0-3）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const b = Math.round(num(params, 'bit', 1));
    const ops = ['I（不动）', 'X（翻转）', 'iY', 'Z（相位）'];
    clear(f);
    const y = h * 0.42;
    const alice = w * 0.16, bob = w * 0.84;
    dot(f, alice, y, 14, C.cool);
    text(f, 'Alice', alice - 22, y + 44, { color: C.cool, font: '13px sans-serif' });
    dot(f, bob, y, 14, C.warm);
    text(f, 'Bob', bob - 16, y + 44, { color: C.warm, font: '13px sans-serif' });
    // 纠缠对（Bell 态）
    const glow = 0.6 + 0.4 * Math.sin(f.t * 3);
    const bell: [number, number][] = [];
    for (let i = 0; i <= 50; i++) {
      const t = i / 50;
      bell.push([alice + t * (bob - alice), y - 40 - Math.sin(t * Math.PI * 2 + f.t * 2) * 22]);
    }
    poly(f, bell, { stroke: `rgba(146,84,222,${glow})`, lw: 3 });
    text(f, '共享 Bell 对 |Φ⁺⟩ = (|00⟩+|11⟩)/√2', w * 0.5 - 130, y - 84, { color: '#9254de', font: '13px sans-serif' });
    // Alice 的操作
    const opX = alice + 70;
    poly(f, [[opX, y + 40], [opX + 150, y + 40], [opX + 150, y + 86], [opX, y + 86]],
      { stroke: C.cool, lw: 2, fill: 'rgba(66,153,225,0.14)' } as any);
    text(f, `Alice 对手里的半对施 ${ops[b]} → 发送 1 qubit`, opX + 8, y + 68, { color: C.cool, font: '13px sans-serif' });
    // Bob 的测量
    const bx = bob - 210;
    poly(f, [[bx, y + 40], [bx + 180, y + 40], [bx + 180, y + 86], [bx, y + 86]],
      { stroke: C.warm, lw: 2, fill: 'rgba(237,137,54,0.14)' } as any);
    const bellOut = ['|Φ⁺⟩', '|Ψ⁺⟩', '|Ψ⁻⟩', '|Φ⁻⟩'][b];
    text(f, `Bell 基测量 → ${bellOut} → 读出 ${b.toString(2).padStart(2, '0')}`, bx + 8, y + 68, { color: C.warm, font: '13px sans-serif' });
    text(f, '1 个量子比特的旅行，带回 2 个经典比特——超越经典容量', 30, 44, { color: C.cyan, font: "14px sans-serif" });

    footnotes(f, [
      "超密编码（Bennett-Wiesner 1992）：纠缠是'预付费'的通信资源——先共享、后编码",
      '它与隐形传态互为时间反演：一个送经典比特换量子信息，一个送量子比特换经典信息',
      '演示了量子信道容量超越经典信道——量子信息论的第一批定量优势',
    ]);
    heading(f, '超密编码：一克量子比特带两克信息');
  },
});
registerViz(superdenseCoding);

/** 量子纠错。 */
const quantumErrorCorrect = defineViz({
  slug: 'quantum-error-correct', title: '量子纠错码', animated: true,
  params: {
    kind: { type: 'select', options: ['三比特比特翻转码', '表面码（示意）'], default: '三比特比特翻转码', label: '码型' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const surface = String((params as Record<string, unknown>)['kind'] ?? '').includes('表面');
    clear(f);
    if (!surface) {
      // 三比特码
      const y = h * 0.4;
      const xs = [w * 0.2, w * 0.5, w * 0.8];
      for (let i = 0; i < 3; i++) {
        const flipped = i === 1 && (f.t % 5) > 2.5;
        dot(f, xs[i], y, 17, flipped ? C.hot : C.cool);
        text(f, flipped ? '1' : '0', xs[i] - 5, y + 6, { color: '#fff', font: '15px sans-serif' });
        text(f, `q${i + 1}`, xs[i] - 10, y + 40, { color: C.dim, font: '11px sans-serif' });
      }
      // 稳定子测量（Z1Z2、Z2Z3）
      for (let k = 0; k < 2; k++) {
        const mx = (xs[k] + xs[k + 1]) / 2;
        seg(f, xs[k], y - 26, xs[k + 1], y - 26, `${C.green}aa`, 2.4);
        text(f, `Z${k + 1}Z${k + 2}=${((f.t % 5) > 2.5 && k === 0) ? '−1' : '+1'}`, mx - 40, y - 36, { color: C.green, font: '12px sans-serif' });
      }
      text(f, '综合征 = (−1,+1)：错误定位在 q2——只纠错、不测态（信息无损）', 30, 44, { color: C.cyan, font: "14px sans-serif" });
      text(f, '量子纠错的难点：测量会坍缩——用稳定子间接诊断', 30, h - 34, { color: C.warm, font: "12px sans-serif" });
    } else {
      // 表面码示意（格点）
      const cell = 40;
      const n = 6;
      const ox = w / 2 - (n * cell) / 2, oy = h / 2 - (n * cell) / 2 + 10;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const x = ox + i * cell + cell / 2, y = oy + j * cell + cell / 2;
          const isData = (i + j) % 2 === 0;
          const hasError = (i === 2 && j === 3 && (f.t % 6) > 4) || (i === 3 && j === 3 && (f.t % 6) > 4);
          dot(f, x, y, isData ? 9 : 6, hasError ? C.hot : isData ? C.cool : C.green);
        }
      }
      // 异常链（错误链两端）
      text(f, '数据比特（蓝）+ 稳定子（绿）：缺陷出现在错误链两端', 30, 44, { color: C.cyan, font: "14px sans-serif" });
      text(f, '表面码阈值 ~1%：每 1000 物理比特保 1 逻辑比特——容错量子计算的现实路径', 30, h - 34, { color: C.warm, font: "12px sans-serif" });
    }

    footnotes(f, [
      '量子纠错（Shor 1995、Steane 1996）：把逻辑比特冗余编码到多物理比特',
      '核心思想是综合征测量：诊断错误而不坍缩量子态——间接读取的艺术',
      '表面码连接数少、阈值高——当前超导量子处理器的主流方案',
    ]);
    heading(f, '量子纠错：不偷看地抓住错误');
  },
});
registerViz(quantumErrorCorrect);

/** 退相干。 */
const decoherence = defineViz({
  slug: 'decoherence', title: '退相干', animated: true,
  params: {
    T2: { type: 'range', min: 0.5, max: 6, default: 2, step: 0.1, label: '相干时间 T₂（相对）' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const T2 = num(params, 'T2', 2);
    clear(f);
    const x0 = 64, y0 = h - 56, y1 = 64;
    const vv = view(f, { xMin: 0, xMax: 8, yMin: -1.1, yMax: 1.3, inset: 50 });
    grid(f, vv, { divisions: 4, ticks: true });
    seg(f, vv.sx(0), vv.sy(0), vv.sx(8), vv.sy(0), C.grid, 1.3);
    // 相干振荡 × 包络衰减
    const pts: [number, number][] = [];
    const env: [number, number][] = [];
    for (let i = 0; i <= 400; i++) {
      const t = (i / 400) * 8;
      const decay = Math.exp(-t / T2);
      pts.push([vv.sx(t), vv.sy(decay * Math.cos(t * 3.6))]);
      env.push([vv.sx(t), vv.sy(decay)]);
    }
    poly(f, pts, { stroke: C.accent, lw: 2 });
    poly(f, env, { stroke: `${C.warm}aa`, lw: 1.6, dash: [6, 4] } as any);
    // 当前相位
    const tNow = (f.t * 1.2) % 8;
    dot(f, vv.sx(tNow), vv.sy(Math.exp(-tNow / T2) * Math.cos(tNow * 3.6)), 7, C.warm);
    // 环境示意
    text(f, '环境不断“测量”系统——相位信息泄漏进环境自由度（约化密度矩阵非对角衰减）', 30, 44, { color: C.cyan, font: "14px sans-serif" });
    text(f, `T₂=${T2.toFixed(1)}：相干性指数消失 → 干涉对比度归零 → 量子优势蒸发`, 30, 68, { color: C.warm, font: "12px sans-serif" });
    void y1;

    footnotes(f, [
      '退相干把量子叠加在微秒级变成经典混合——量子与经典的边界由此划出',
      'T₁（能量弛豫）与 T₂（相位退相干）是量子比特的两大生命指标：T₂≤2T₁',
      '动态解耦、纠错与材料纯化都在与退相干赛跑——容错量子计算的全部工程动机',
    ]);
    heading(f, '退相干：环境偷走量子性的过程');
  },
});
registerViz(decoherence);
