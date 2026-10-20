import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import {
  C,
  PALETTE,
  bars,
  dot,
  footnotes,
  gaussians,
  grid,
  heading,
  poly,
  rng,
  seg,
  text,
  view,
} from '../canvas';

/** B31 统计入门。 */
const statsBasics = defineViz({
  slug: 'stats-basics',
  title: '统计入门',
  params: {
    n: { type: 'range', min: 20, max: 600, default: 200, label: '样本数' },
    spread: { type: 'range', min: 1, max: 5, default: 2, label: '离散程度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'n', 200));
    const spread = num(params, 'spread', 2);
    const data = gaussians(rng(20240101), n).map((x) => x * spread + 10);
    const sorted = [...data].sort((a, b) => a - b);
    const mean = data.reduce((a, b) => a + b, 0) / n;
    const median = sorted[Math.floor(n / 2)];
    const sd = Math.sqrt(data.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const bins = 22;
    const counts = new Array<number>(bins).fill(0);
    for (const v of data) {
      counts[Math.min(bins - 1, Math.floor(((v - min) / (max - min || 1)) * bins))]++;
    }

    const plotX = 40;
    const plotW = w - 80;
    const plotH = h - 150;
    const baseY = 60 + plotH;
    bars(f, counts, { x: plotX, y: 60, w: plotW, h: plotH, colors: [C.accent] });

    const toX = (v: number) => plotX + ((v - min) / (max - min || 1)) * plotW;
    seg(f, toX(mean), 60, toX(mean), baseY, C.hot, 2);
    seg(f, toX(median), 60, toX(median), baseY, C.yellow, 2);
    seg(f, toX(mean - sd), 60, toX(mean - sd), baseY, C.cool, 1);
    seg(f, toX(mean + sd), 60, toX(mean + sd), baseY, C.cool, 1);

    footnotes(f, [
      `均值 x̄ = ${mean.toFixed(3)}（红线）   中位数 = ${median.toFixed(3)}（黄线）`,
      `标准差 σ = ${sd.toFixed(3)}，蓝色虚线为 x̄ ± σ 区间`,
      `${n} 个正态样本：越靠近均值出现越频繁`,
    ]);
    heading(f, '统计入门：频数分布与集中趋势');
  },
});

/** 用 BigInt 精确生成序列并取首位数字。 */
function firstDigits(kind: string, k: number): number[] {
  const out: number[] = [];
  if (kind === '斐波那契数列') {
    let a = 1n;
    let b = 1n;
    for (let i = 0; i < k; i++) {
      out.push(Number(String(b)[0]));
      const t = a + b;
      a = b;
      b = t;
    }
  } else {
    let v = 1n;
    for (let i = 0; i < k; i++) {
      v *= 2n;
      out.push(Number(String(v)[0]));
    }
  }
  return out.filter((d) => d >= 1 && d <= 9);
}

/** B32 本福德定律。 */
const benfordsLaw = defineViz({
  slug: 'benfords-law',
  title: '本福德定律',
  params: {
    k: { type: 'range', min: 20, max: 600, default: 200, label: '项数' },
    source: { type: 'select', options: ['2 的幂', '斐波那契数列'], default: '2 的幂', label: '数据来源' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const k = Math.round(num(params, 'k', 200));
    const source = str(params, 'source', '2 的幂');
    const digits = firstDigits(source, k);
    const counts = new Array<number>(10).fill(0);
    for (const d of digits) counts[d]++;
    const total = digits.length || 1;

    const plotX = 46;
    const plotW = w - 90;
    const plotH = h - 150;
    const baseY = 60 + plotH;
    const slot = plotW / 9;
    for (let d = 1; d <= 9; d++) {
      const actual = counts[d] / total;
      const theory = Math.log10(1 + 1 / d);
      const x = plotX + (d - 1) * slot;
      const hA = (actual / 0.35) * plotH;
      const hT = (theory / 0.35) * plotH;
      f.ctx.save();
      f.ctx.fillStyle = C.accent;
      f.ctx.fillRect(x + 2, baseY - hA, slot / 2 - 4, hA);
      f.ctx.fillStyle = C.warm;
      f.ctx.fillRect(x + slot / 2, baseY - hT, slot / 2 - 4, hT);
      f.ctx.restore();
      text(f, String(d), x + slot / 2, baseY + 18, { align: 'center', color: C.fg });
      if (slot > 44) {
        text(f, `${(actual * 100).toFixed(0)}%`, x + slot / 4, baseY - hA - 6, { align: 'center', color: C.accent, font: '11px sans-serif' });
        text(f, `${(theory * 100).toFixed(0)}%`, x + (slot * 3) / 4, baseY - hT - 6, { align: 'center', color: C.warm, font: '11px sans-serif' });
      }
    }
    seg(f, plotX, baseY, plotX + plotW, baseY, C.dim, 1);
    footnotes(f, [
      `${source}前 ${k} 项的首位数字分布（蓝）对比理论值 log10(1+1/d)（橙）`,
      '首位为 1 的概率约 30.1%，数字越大越少见 —— 自然与社会数据普遍如此',
    ]);
    heading(f, '本福德定律：首位数字的对数分布');
  },
});

/** B33 蒙提霍尔问题。 */
const montyHall = defineViz({
  slug: 'monty-hall',
  title: '蒙提霍尔问题',
  params: {
    trials: { type: 'range', min: 100, max: 5000, default: 1000, step: 100, label: '模拟次数' },
    carDoor: { type: 'range', min: 0, max: 2, default: 0, label: '车所在门' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const trials = Math.round(num(params, 'trials', 1000));
    const car = Math.round(num(params, 'carDoor', 0));
    const rand = rng(777);
    let stayWins = 0;
    let switchWins = 0;
    for (let i = 0; i < trials; i++) {
      const pick = Math.floor(rand() * 3);
      const candidates = [0, 1, 2].filter((d) => d !== pick && d !== car);
      const opened = candidates[Math.floor(rand() * candidates.length)];
      const switchTo = [0, 1, 2].filter((d) => d !== pick && d !== opened)[0];
      if (pick === car) stayWins++;
      if (switchTo === car) switchWins++;
    }

    const doorW = Math.min(120, w / 5);
    const doorH = doorW * 1.5;
    const y = h / 2 - doorH / 2 - 20;
    for (let d = 0; d < 3; d++) {
      const x = w / 2 - doorW * 1.6 + d * (doorW * 1.1);
      poly(f, [[x, y], [x + doorW, y], [x + doorW, y + doorH], [x, y + doorH]], {
        fill: d === car ? 'rgba(72,187,120,0.25)' : C.panel,
        stroke: d === car ? C.green : C.dim,
        lw: 2,
        close: true,
      });
      text(f, `门 ${d + 1}`, x + doorW / 2, y + doorH / 2 - 6, { align: 'center', color: C.fg });
      if (d === car) text(f, '🚗', x + doorW / 2, y + doorH / 2 + 30, { align: 'center', font: '22px sans-serif' });
    }

    const rows: Array<[string, number, number, string]> = [
      ['坚持原选择', stayWins / trials, 1 / 3, C.cool],
      ['改选另一扇门', switchWins / trials, 2 / 3, C.green],
    ];
    const barTop = h - 96;
    const barW = w - 80;
    rows.forEach(([label, actual, theory, color], i) => {
      const rowY = barTop + i * 38;
      text(f, label, 40, rowY + 19, { color: C.fg });
      const x0 = 170;
      const trackW = Math.min(barW * 0.55, 420);
      poly(f, [[x0, rowY + 4], [x0 + trackW, rowY + 4], [x0 + trackW, rowY + 24], [x0, rowY + 24]], { fill: C.panel, close: true });
      f.ctx.save();
      f.ctx.fillStyle = color;
      f.ctx.fillRect(x0, rowY + 4, trackW * actual, 20);
      f.ctx.restore();
      text(f, `模拟 ${(actual * 100).toFixed(1)}%   理论 ${(theory * 100).toFixed(1)}%`, x0 + trackW + 12, rowY + 19, { color: C.dim });
    });
    footnotes(f, [`模拟 ${trials} 次：主持人打开一扇空门后，改选的中奖率是不改选的两倍`]);
    heading(f, '蒙提霍尔问题：换门还是不换？');
  },
});

/** B48 骰子概率。 */
const diceProbability = defineViz({
  slug: 'dice-probability',
  title: '骰子概率',
  params: {
    dice: { type: 'range', min: 1, max: 3, default: 2, label: '骰子个数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const dice = Math.round(num(params, 'dice', 2));
    const minSum = dice;
    const maxSum = dice * 6;

    // 动态规划枚举每个和的出现方式数
    let dist = [1];
    for (let d = 0; d < dice; d++) {
      const next = new Array<number>(dist.length + 6).fill(0);
      for (let i = 0; i < dist.length; i++) {
        for (let face = 1; face <= 6; face++) next[i + face] += dist[i];
      }
      dist = next;
    }
    const ways = dist.slice(minSum, maxSum + 1);
    const totalWays = ways.reduce((a, b) => a + b, 0);
    const peak = Math.max(...ways);

    const plotX = 40;
    const plotW = w - 80;
    const plotH = h - 150;
    const baseY = 60 + plotH;
    const slot = plotW / ways.length;
    ways.forEach((c, idx) => {
      const p = c / totalWays;
      const bh = p * plotH * 1.7;
      const x = plotX + idx * slot;
      f.ctx.save();
      f.ctx.fillStyle = c === peak ? C.warm : C.accent;
      f.ctx.fillRect(x + 1, baseY - bh, Math.max(1, slot - 2), bh);
      f.ctx.restore();
      text(f, String(minSum + idx), x + slot / 2, baseY + 18, { align: 'center', color: C.fg, font: '12px sans-serif' });
      if (slot > 26) text(f, `${(p * 100).toFixed(0)}%`, x + slot / 2, baseY - bh - 6, { align: 'center', color: C.dim, font: '10px sans-serif' });
    });
    seg(f, plotX, baseY, plotX + plotW, baseY, C.dim, 1);
    footnotes(f, [
      `${dice} 个骰子点数和的分布，共 ${totalWays} 种等可能结果`,
      '中间的和组合方式最多，越靠两端越罕见 —— 正态分布的雏形',
    ]);
    heading(f, '骰子概率：组合计数的古典概型');
  },
});

/** B49 生日悖论。 */
const birthdayParadox = defineViz({
  slug: 'birthday-paradox',
  title: '生日悖论',
  params: {
    people: { type: 'range', min: 2, max: 80, default: 23, label: '人数' },
    days: { type: 'range', min: 30, max: 365, default: 365, label: '一年天数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const people = Math.round(num(params, 'people', 23));
    const days = Math.round(num(params, 'days', 365));
    const prob = (n: number): number => {
      let p = 1;
      for (let i = 0; i < n; i++) p *= 1 - i / days;
      return 1 - p;
    };

    const v = view(f, { xMin: 0, xMax: 80, yMin: 0, yMax: 1, inset: 40 });
    grid(f, v, { divisions: 5, ticks: true });
    const pts: Array<[number, number]> = [];
    for (let n = 2; n <= 80; n++) pts.push([v.sx(n), v.sy(prob(n))]);
    poly(f, pts, { stroke: C.accent, lw: 2.5 });

    const p = prob(people);
    seg(f, v.sx(people), v.sy(0), v.sx(people), v.sy(p), C.warm, 1.5);
    dot(f, v.sx(people), v.sy(p), 5, C.warm);
    text(f, `${people} 人：${(p * 100).toFixed(2)}%`, v.sx(people) + 8, v.sy(p) - 10, { color: C.warm });

    let half = 80;
    for (let n = 2; n <= 80; n++) {
      if (prob(n) >= 0.5) {
        half = n;
        break;
      }
    }
    footnotes(f, [
      `一年 ${days} 天：${half} 人时，至少两人生日相同的概率就超过 50%`,
      '先算"全部人都不同"的概率（连乘），再用 1 减掉它',
    ]);
    heading(f, '生日悖论：反直觉的碰撞概率');
  },
});

/** B50 赌徒破产。 */
const gamblersRuin = defineViz({
  slug: 'gamblers-ruin',
  title: '赌徒破产',
  params: {
    start: { type: 'range', min: 1, max: 20, default: 8, label: '起始资金 i' },
    target: { type: 'range', min: 5, max: 40, default: 20, label: '目标资金 N' },
    winRate: { type: 'range', min: 0.3, max: 0.7, default: 0.5, step: 0.01, label: '每局胜率 p' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const i = Math.round(num(params, 'start', 8));
    const N = Math.max(i + 1, Math.round(num(params, 'target', 20)));
    const p = Math.min(0.99, Math.max(0.01, num(params, 'winRate', 0.5)));
    const q = 1 - p;
    const ratio = q / p;
    const ruin = Math.abs(p - q) < 1e-9
      ? 1 - i / N
      : (Math.pow(ratio, i) - Math.pow(ratio, N)) / (1 - Math.pow(ratio, N));

    const rand = rng(4242);
    const v = view(f, { xMin: 0, xMax: 240, yMin: -1, yMax: N + 1, inset: 34 });
    grid(f, v, { divisions: 5, ticks: true });
    for (let k = 0; k < 6; k++) {
      let money = i;
      const pts: Array<[number, number]> = [[v.sx(0), v.sy(money)]];
      for (let step = 1; step <= 240 && money > 0 && money < N; step++) {
        money += rand() < p ? 1 : -1;
        pts.push([v.sx(step), v.sy(money)]);
      }
      poly(f, pts, { stroke: `${PALETTE[k % PALETTE.length]}bb`, lw: 1.6 });
    }
    seg(f, v.sx(0), v.sy(N), v.sx(240), v.sy(N), C.green, 1.5);
    seg(f, v.sx(0), v.sy(0), v.sx(240), v.sy(0), C.hot, 1.5);
    text(f, '目标线', v.sx(236), v.sy(N) - 8, { color: C.green, align: 'right' });
    text(f, '破产线', v.sx(236), v.sy(0) - 8, { color: C.hot, align: 'right' });

    footnotes(f, [
      `起始 ${i} 元、目标 ${N} 元、每局胜率 p = ${p.toFixed(2)}`,
      `破产概率 = ${(ruin * 100).toFixed(2)}%，赔率 q/p = ${ratio.toFixed(3)}（出现在公式的幂次里）`,
      '赌本有限而对手资金近似无限时，长期看几乎必然破产',
    ]);
    heading(f, '赌徒破产：有限赌本的随机游走');
  },
});

registerViz(
  statsBasics,
  benfordsLaw,
  montyHall,
  diceProbability,
  birthdayParadox,
  gamblersRuin,
);
