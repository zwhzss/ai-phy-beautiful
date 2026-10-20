import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import {
  C,
  PALETTE,
  bars,
  curve,
  dot,
  footnotes,
  grid,
  heading,
  poly,
  seg,
  text,
  view,
} from '../canvas';

/** 离散傅里叶变换（返回幅值）。 */
function dftAmplitude(signal: number[]): number[] {
  const N = signal.length;
  const out: number[] = [];
  for (let k = 0; k < Math.floor(N / 2); k++) {
    let re = 0;
    let im = 0;
    for (let n = 0; n < N; n++) {
      const ang = (-2 * Math.PI * k * n) / N;
      re += signal[n] * Math.cos(ang);
      im += signal[n] * Math.sin(ang);
    }
    out.push(Math.hypot(re, im) / (N / 2));
  }
  return out;
}

/** A52 傅里叶变换深化。 */
const fourier = defineViz({
  slug: 'fourier',
  title: '傅里叶变换深化',
  params: {
    f1: { type: 'range', min: 1, max: 8, default: 3, label: '频率 f₁' },
    f2: { type: 'range', min: 1, max: 8, default: 7, label: '频率 f₂' },
    a2: { type: 'range', min: 0, max: 1, default: 0.5, step: 0.05, label: '第二分量幅度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const f1 = num(params, 'f1', 3);
    const f2 = num(params, 'f2', 7);
    const a2 = num(params, 'a2', 0.5);
    const N = 256;
    const signal: number[] = [];
    for (let i = 0; i < N; i++) {
      signal.push(Math.sin((2 * Math.PI * f1 * i) / N) + a2 * Math.sin((2 * Math.PI * f2 * i) / N));
    }
    const spec = dftAmplitude(signal);
    const top = 56;
    const plotH = (h - 175) / 2;
    const slot = (w - 80) / N;

    // 时域
    const tPts: Array<[number, number]> = signal.map((s, i) => [40 + i * slot, top + plotH / 2 - s * plotH * 0.4]);
    poly(f, tPts, { stroke: C.accent, lw: 1.4 });
    text(f, '时域（两个正弦叠加）', 44, top - 8, { color: C.accent, font: '12px sans-serif' });

    // 频域
    const baseY = top + plotH + 46;
    const maxSpec = Math.max(...spec);
    spec.forEach((s, k) => {
      const x = 40 + k * ((w - 80) / spec.length);
      const bh = (s / maxSpec) * plotH;
      f.ctx.save();
      f.ctx.fillStyle = s > maxSpec * 0.3 ? C.warm : `${C.dim}88`;
      f.ctx.fillRect(x, baseY + plotH - bh, Math.max(1, (w - 80) / spec.length - 1), bh);
      f.ctx.restore();
    });
    seg(f, 40, baseY + plotH, w - 40, baseY + plotH, C.dim, 1);
    text(f, '频域（DFT 幅值）：两个尖峰对应两个频率分量', 44, baseY - 8, { color: C.warm, font: '12px sans-serif' });
    [f1, f2].forEach((freq) => {
      const x = 40 + freq * ((w - 80) / spec.length);
      text(f, `f=${freq}`, x, baseY + plotH + 16, { align: 'center', color: C.warm, font: '11px sans-serif' });
    });

    footnotes(f, [
      `信号 = sin(2π·${f1}·t) + ${a2}·sin(2π·${f2}·t)：频谱在 f = ${f1} 与 f = ${f2} 处各有一个尖峰`,
      '傅里叶变换把信号从"时间轴"搬到"频率轴"：时域混在一起的成分，频域里泾渭分明',
      '这是 MP3、JPEG、5G 的共同基础：先变换到频域，再按重要性取舍处理',
    ]);
    heading(f, '傅里叶变换：时域 ↔ 频域');
  },
});

/** A53 傅里叶级数深化。 */
const fourierSeries = defineViz({
  slug: 'fourier-series',
  title: '傅里叶级数深化',
  params: {
    wave: { type: 'select', options: ['方波', '锯齿波', '三角波'], default: '方波', label: '目标波形' },
    terms: { type: 'range', min: 1, max: 25, default: 5, label: '谐波项数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const wave = str(params, 'wave', '方波');
    const terms = Math.round(num(params, 'terms', 5));
    const v = view(f, { xMin: 0, xMax: 2, yMin: -1.4, yMax: 1.4, inset: 42 });
    grid(f, v, { divisions: 4, ticks: true });

    const partial = (x: number): number => {
      let sum = 0;
      for (let n = 1; n <= terms; n++) {
        const k = 2 * n - 1;
        if (wave === '方波') sum += (4 / (Math.PI * k)) * Math.sin(2 * Math.PI * k * x);
        else if (wave === '锯齿波') sum += ((2 / Math.PI) * Math.pow(-1, n + 1) * Math.sin(2 * Math.PI * n * x)) / n;
        else sum += ((8 / (Math.PI * Math.PI)) * Math.pow(-1, (n - 1) / 2) * Math.sin(2 * Math.PI * n * x)) / (n * n);
      }
      return sum;
    };
    const target = (x: number): number => {
      const t = x % 1;
      if (wave === '方波') return t < 0.5 ? 1 : -1;
      if (wave === '锯齿波') return 2 * t - 1;
      return 4 * Math.abs(t - 0.5) - 1;
    };
    curve(f, v, target, { color: `${C.dim}99`, lw: 1.4, dash: [5, 4], samples: 600 });
    curve(f, v, partial, { color: C.accent, lw: 2.4, samples: 800 });

    // 各项谐波
    for (let n = 1; n <= Math.min(terms, 6); n++) {
      const k = 2 * n - 1;
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 200; i++) {
        const x = (i / 200) * 2;
        const y = wave === '方波' ? (4 / (Math.PI * k)) * Math.sin(2 * Math.PI * k * x) : ((2 / Math.PI) * Math.pow(-1, n + 1) * Math.sin(2 * Math.PI * n * x)) / n;
        pts.push([v.sx(x), v.sy(y)]);
      }
      poly(f, pts, { stroke: `${PALETTE[n % PALETTE.length]}55`, lw: 1 });
    }

    footnotes(f, [
      `${wave}的前 ${terms} 项傅里叶级数（蓝）与原波形（灰虚线）；浅色曲线是各次谐波`,
      wave === '方波' ? '方波只含奇次谐波，幅度按 1/n 衰减（吉布斯现象在跳变处留下过冲）' : wave === '锯齿波' ? '锯齿波含全部谐波，幅度按 1/n 衰减' : '三角波含奇次谐波，幅度按 1/n² 衰减（因此更"光滑"、收敛更快）',
      '连续性与收敛速度相关：波形越光滑，高频分量衰减越快（三角波比方波快得多）',
    ]);
    heading(f, `傅里叶级数逼近：${wave}`);
  },
});

/** A54 傅里叶绘图。 */
const fourierDrawing = defineViz({
  slug: 'fourier-drawing',
  title: '傅里叶绘图',
  params: {
    circles: { type: 'range', min: 1, max: 14, default: 6, label: '圆周数量' },
    shape: { type: 'select', options: ['方波轮廓', '三角轮廓'], default: '方波轮廓', label: '目标形状' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const count = Math.round(num(params, 'circles', 6));
    const shape = str(params, 'shape', '方波轮廓');
    // 用傅里叶级数逼近一个闭合轮廓：方波轮廓的傅里叶系数
    const coeffs: Array<{ freq: number; amp: number; phase: number }> = [];
    for (let n = 1; n <= count; n++) {
      const k = 2 * n - 1;
      if (shape === '方波轮廓') coeffs.push({ freq: k, amp: 4 / (Math.PI * k), phase: 0 });
      else coeffs.push({ freq: k, amp: (8 / (Math.PI * Math.PI)) * Math.pow(-1, (n - 1) / 2) / (k * k), phase: 0 });
    }
    const cx = w * 0.36;
    const cy = h / 2;
    const scale = Math.min(w, h) * 0.2;

    let x = cx;
    let y = cy;
    // 旋转的圆周（epicycle）
    coeffs.forEach((c, i) => {
      const radius = Math.abs(c.amp) * scale * 2;
      const nextX = x + radius * Math.cos(c.freq * 0.6 + c.phase);
      const nextY = y - radius * Math.sin(c.freq * 0.6 + c.phase);
      f.ctx.save();
      f.ctx.beginPath();
      f.ctx.arc(x, y, radius, 0, Math.PI * 2);
      f.ctx.strokeStyle = `${PALETTE[i % PALETTE.length]}66`;
      f.ctx.lineWidth = 1;
      f.ctx.stroke();
      f.ctx.restore();
      seg(f, x, y, nextX, nextY, `${PALETTE[i % PALETTE.length]}cc`, 1.4);
      x = nextX;
      y = nextY;
    });
    dot(f, x, y, 4, C.warm);

    // 右侧：叠加 500 个时刻得到轨迹
    const trail: Array<[number, number]> = [];
    for (let t = 0; t < 500; t++) {
      let px = 0;
      let py = 0;
      const tt = (t / 500) * Math.PI * 2 * 2;
      coeffs.forEach((c) => {
        px += c.amp * Math.cos(c.freq * tt + c.phase);
        py += c.amp * Math.sin(c.freq * tt + c.phase);
      });
      trail.push([w * 0.72 + px * scale * 2, cy - py * scale * 2]);
    }
    poly(f, trail, { stroke: C.accent, lw: 1.8 });

    footnotes(f, [
      `${count} 个旋转圆周叠加（左），圆心依次相连；端点走出的轨迹（右）`,
      '每个圆周是一次谐波：半径 = 该谐波的幅度，转速 = 频率 —— 这就是"用圆画出任意图形"',
      '3Blue1Brown 用这个动画讲解傅里叶级数；理论上用足够多的圆可以画出任意闭合曲线',
    ]);
    heading(f, '傅里叶绘图：用旋转圆画图');
  },
});

/** A55 快速傅里叶变换。 */
const fft = defineViz({
  slug: 'fft',
  title: '快速傅里叶变换',
  params: {
    n: { type: 'range', min: 4, max: 12, default: 8, label: 'log₂(N)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const logN = Math.round(num(params, 'n', 8));
    const N = Math.pow(2, logN);
    const direct = N * N;
    const fftOps = (N / 2) * logN;

    // 蝶形图（前 3 层示意）
    const levels = Math.min(logN, 5);
    const nodesAt = (lvl: number): number => Math.pow(2, lvl);
    const colX = (lvl: number): number => 60 + (lvl / levels) * (w - 140);
    const yOf = (idx: number, lvl: number): number => {
      const cnt = nodesAt(lvl);
      return 60 + ((idx + 0.5) / cnt) * (h - 175);
    };
    for (let lvl = 0; lvl < levels; lvl++) {
      const cnt = nodesAt(lvl);
      const nextCnt = nodesAt(lvl + 1);
      for (let i = 0; i < cnt; i++) {
        for (let j = 0; j < 2; j++) {
          const target = i * 2 + j;
          if (target >= nextCnt) continue;
          seg(f, colX(lvl), yOf(i, lvl), colX(lvl + 1), yOf(target, lvl + 1), 'rgba(102,126,234,0.55)', 1.2);
        }
      }
      for (let i = 0; i < cnt; i++) dot(f, colX(lvl), yOf(i, lvl), 4, C.accent);
    }
    for (let i = 0; i < nodesAt(levels); i++) dot(f, colX(levels), yOf(i, levels), 4, C.warm);
    text(f, '蝶形结构：每层把规模减半', 60, 46, { color: C.accent, font: '12px sans-serif' });

    footnotes(f, [
      `N = 2^${logN} = ${N} 点：直接 DFT 需要 N² = ${direct} 次复数乘法，FFT 只需 (N/2)log₂N = ${fftOps} 次`,
      `加速倍数 ${(direct / fftOps).toFixed(1)}× —— N 越大优势越明显（N = 10⁶ 时约快 5 万倍）`,
      'FFT 的关键是"分治 + 旋转因子的对称性"：把 N 点 DFT 拆成两个 N/2 点 DFT 再合并（蝶形运算）',
    ]);
    heading(f, '快速傅里叶变换：O(N²) → O(N log N)');
  },
});

/** A56 混叠现象。 */
const aliasing = defineViz({
  slug: 'aliasing',
  title: '混叠现象',
  params: {
    trueFreq: { type: 'range', min: 1, max: 12, default: 9, step: 0.5, label: '真实频率 f' },
    sampleRate: { type: 'range', min: 2, max: 20, default: 8, label: '采样率 f_s' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const trueFreq = num(params, 'trueFreq', 9);
    const sampleRate = num(params, 'sampleRate', 8);
    // 混叠频率：f_alias = |f - round(f/fs)·fs|
    const aliasFreq = Math.abs(trueFreq - Math.round(trueFreq / sampleRate) * sampleRate);
    const nyquist = sampleRate / 2;

    const v = view(f, { xMin: 0, xMax: 1, yMin: -1.4, yMax: 1.4, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });
    // 真实信号
    curve(f, v, (x) => Math.sin(2 * Math.PI * trueFreq * x), { color: C.dim, lw: 1.4, dash: [5, 4] });
    // 采样点
    const sampleCount = Math.max(2, Math.round(sampleRate));
    const samples: Array<[number, number]> = [];
    for (let i = 0; i <= sampleCount; i++) {
      const x = i / sampleCount;
      samples.push([x, Math.sin(2 * Math.PI * trueFreq * x)]);
    }
    // 重建信号（按混叠频率）
    curve(f, v, (x) => Math.sin(2 * Math.PI * aliasFreq * x + (samples[0] ? 0 : 0)), { color: C.hot, lw: 2, dash: [4, 3] });
    poly(f, samples.map(([x, y]) => [v.sx(x), v.sy(y)] as [number, number]), { stroke: C.accent, lw: 2 });
    samples.forEach(([x, y]) => dot(f, v.sx(x), v.sy(y), 4.5, C.warm));

    footnotes(f, [
      `真实频率 ${trueFreq}，采样率 f_s = ${sampleRate}（奈奎斯特频率 = ${nyquist}）`,
      trueFreq > nyquist
        ? `发生混叠！重建出的频率是 ${aliasFreq}（与真实频率完全不同）—— 采样太慢无法分辨高频`
        : `未发生混叠：f < f_s/2，采样足够快，可以无损重建`,
      '车轮"倒转"、电影里桨叶不转 —— 都是混叠的日常表现；抗混叠要在采样前先做低通滤波',
    ]);
    heading(f, '混叠：采样不足的代价');
  },
});

/** A57 自相关函数。 */
const autocorrelation = defineViz({
  slug: 'autocorrelation',
  title: '自相关函数',
  params: {
    freq: { type: 'range', min: 1, max: 10, default: 5, label: '信号频率' },
    noise: { type: 'range', min: 0, max: 1, default: 0.3, step: 0.05, label: '噪声强度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const freq = num(params, 'freq', 5);
    const noise = num(params, 'noise', 0.3);
    const N = 256;
    const signal: number[] = [];
    let seed = 12345;
    const rand = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648 - 0.5;
    };
    for (let i = 0; i < N; i++) signal.push(Math.sin((2 * Math.PI * freq * i) / N) + rand() * noise);

    // 自相关 R(τ) = Σ s(i)s(i+τ)
    const R: number[] = [];
    for (let tau = 0; tau < Math.floor(N / 2); tau++) {
      let sum = 0;
      for (let i = 0; i + tau < N; i++) sum += signal[i] * signal[i + tau];
      R.push(sum / (N - tau));
    }
    const top = 56;
    const plotH = (h - 175) / 2;
    const slot = (w - 80) / N;
    const sPts: Array<[number, number]> = signal.map((s, i) => [40 + i * slot, top + plotH / 2 - s * plotH * 0.4]);
    poly(f, sPts, { stroke: `${C.dim}aa`, lw: 1 });
    text(f, '原始信号（正弦 + 噪声）', 44, top - 8, { color: C.dim, font: '12px sans-serif' });

    const rBase = top + plotH + 46;
    const maxR = Math.max(...R.map(Math.abs));
    const rPts: Array<[number, number]> = R.map((r, tau) => [40 + tau * ((w - 80) / R.length), rBase + plotH / 2 - (r / maxR) * plotH * 0.45]);
    poly(f, rPts, { stroke: C.accent, lw: 2 });
    seg(f, 40, rBase + plotH / 2, w - 40, rBase + plotH / 2, C.dim, 1);
    // 标记延迟 = 周期的峰
    const period = N / freq;
    for (let k = 1; k * period < R.length; k++) {
      const x = 40 + k * period * ((w - 80) / R.length);
      seg(f, x, rBase + 10, x, rBase + plotH - 10, `${C.warm}88`, 1.2);
    }
    text(f, '自相关函数：延迟为周期的整数倍处出现峰值（橙线）', 44, rBase - 8, { color: C.accent, font: '12px sans-serif' });

    footnotes(f, [
      `信号频率 ${freq}（周期 ${period.toFixed(1)} 个采样点），噪声强度 ${noise}`,
      '自相关把信号与自身平移后相乘求和：周期性信号在延迟 = 周期处出现峰，噪声则迅速衰减为 0',
      '自相关用于"从噪声中提取周期"（如脉冲星信号）、基频估计、以及卷积神经网络的数学基础',
    ]);
    heading(f, '自相关函数：从噪声中找周期');
  },
});

/** A58 卷积定理。 */
const convolution = defineViz({
  slug: 'convolution',
  title: '卷积定理',
  params: {
    kernel: { type: 'select', options: ['均值滤波', '高斯核', '锐化核'], default: '高斯核', label: '卷积核' },
    width: { type: 'range', min: 1, max: 9, default: 5, label: '核宽度' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kernelType = str(params, 'kernel', '高斯核');
    const width = Math.round(num(params, 'width', 5));
    const N = 200;
    // 原信号：阶跃 + 噪声（模拟图像边缘）
    let seed = 999;
    const rand = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648 - 0.5;
    };
    const signal: number[] = [];
    for (let i = 0; i < N; i++) {
      const base = i < N / 2 ? 0 : 1;
      signal.push(base + rand() * 0.25);
    }
    // 卷积核
    const size = width * 2 + 1;
    const kernel: number[] = [];
    if (kernelType === '均值滤波') for (let i = 0; i < size; i++) kernel.push(1 / size);
    else if (kernelType === '锐化核') {
      for (let i = 0; i < size; i++) kernel.push(i === width ? 2 : -1 / (size - 1));
    } else {
      const sigma = Math.max(0.5, width / 2);
      let sum = 0;
      for (let i = -width; i <= width; i++) {
        const val = Math.exp(-(i * i) / (2 * sigma * sigma));
        kernel.push(val);
        sum += val;
      }
      for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;
    }
    const output: number[] = [];
    for (let i = 0; i < N; i++) {
      let sum = 0;
      for (let k = -width; k <= width; k++) {
        const idx = Math.min(N - 1, Math.max(0, i + k));
        sum += signal[idx] * kernel[k + width];
      }
      output.push(sum);
    }

    const top = 56;
    const plotH = (h - 175) / 2;
    const slot = (w - 80) / N;
    poly(f, signal.map((s, i) => [40 + i * slot, top + plotH / 2 - (s - 0.5) * plotH * 0.8] as [number, number]), { stroke: `${C.dim}aa`, lw: 1 });
    text(f, '原始信号（带噪声的阶跃边缘）', 44, top - 8, { color: C.dim, font: '12px sans-serif' });
    const base2 = top + plotH + 46;
    poly(f, output.map((s, i) => [40 + i * slot, base2 + plotH / 2 - (s - 0.5) * plotH * 0.8] as [number, number]), { stroke: C.accent, lw: 2 });
    text(f, `卷积后（${kernelType}，核宽 ${size}）`, 44, base2 - 8, { color: C.accent, font: '12px sans-serif' });

    footnotes(f, [
      `一维卷积（图像里就是"滑动窗口加权求和"）：y[i] = Σ s[i+k]·h[k]`,
      kernelType === '均值滤波' ? '均值滤波把噪声抹平，但边缘也变模糊' : kernelType === '高斯核' ? '高斯核平滑噪声且保持单调边缘（比均值滤波更自然）' : '锐化核增强边缘对比度（中心为正、周围为负）',
      '卷积定理：时域卷积 = 频域相乘。CNN 的卷积层、图像滤波、音频混响都是这个运算',
    ]);
    heading(f, '卷积：滑动窗口加权求和');
  },
});

/** A59 奈奎斯特采样。 */
const nyquistSampling = defineViz({
  slug: 'nyquist-sampling',
  title: '奈奎斯特采样',
  params: {
    signalFreq: { type: 'range', min: 1, max: 6, default: 3, label: '信号最高频率' },
    ratio: { type: 'range', min: 1, max: 6, default: 2.2, step: 0.1, label: '采样率/信号频率' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const signalFreq = num(params, 'signalFreq', 3);
    const ratio = num(params, 'ratio', 2.2);
    const sampleRate = signalFreq * ratio;
    const ok = ratio >= 2;

    const v = view(f, { xMin: 0, xMax: 1, yMin: -1.5, yMax: 1.5, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });
    const signal = (x: number): number => Math.sin(2 * Math.PI * signalFreq * x);
    curve(f, v, signal, { color: C.dim, lw: 1.6, dash: [5, 4] });

    // 采样点与重建
    const sampleCount = Math.max(2, Math.round(sampleRate));
    const samples: Array<[number, number]> = [];
    for (let i = 0; i <= sampleCount; i++) {
      const x = i / sampleCount;
      samples.push([x, signal(x)]);
    }
    for (const [x, y] of samples) {
      seg(f, v.sx(x), v.sy(0), v.sx(x), v.sy(y), `${C.warm}55`, 1);
      dot(f, v.sx(x), v.sy(y), 4, C.warm);
    }
    poly(f, samples.map(([x, y]) => [v.sx(x), v.sy(y)] as [number, number]), { stroke: C.accent, lw: 2 });

    footnotes(f, [
      `信号频率 ${signalFreq}，采样率 ${sampleRate.toFixed(2)}（比值 ${ratio.toFixed(1)}）`,
      ok ? '比值 ≥ 2：满足奈奎斯特条件，采样点能唯一确定原信号（重建曲线与原信号重合）' : '比值 < 2：采样点不足，重建曲线与原信号完全不同（混叠）',
      '奈奎斯特-香农采样定理：采样率必须大于信号最高频率的 2 倍，否则无法无损重建（CD 用 44.1 kHz 采样 20 kHz 音频）',
    ]);
    heading(f, '奈奎斯特采样定理');
  },
});

/** A60 窗函数。 */
const windowing = defineViz({
  slug: 'windowing',
  title: '窗函数',
  params: {
    win: { type: 'select', options: ['矩形窗', '汉宁窗', '汉明窗', '布莱克曼窗'], default: '汉宁窗', label: '窗函数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const win = str(params, 'win', '汉宁窗');
    const N = 128;
    const winFn = (n: number): number => {
      const t = (2 * Math.PI * n) / (N - 1);
      if (win === '汉宁窗') return 0.5 * (1 - Math.cos(t));
      if (win === '汉明窗') return 0.54 - 0.46 * Math.cos(t);
      if (win === '布莱克曼窗') return 0.42 - 0.5 * Math.cos(t) + 0.08 * Math.cos(2 * t);
      return 1;
    };
    // 加窗后的信号（正弦）
    const signal: number[] = [];
    for (let n = 0; n < N; n++) signal.push(Math.sin((2 * Math.PI * 8 * n) / N) * winFn(n));
    const spec = dftAmplitude(signal);

    const top = 56;
    const plotH = (h - 175) / 2;
    const slot = (w - 80) / N;
    poly(f, signal.map((s, i) => [40 + i * slot, top + plotH / 2 - s * plotH * 0.45] as [number, number]), { stroke: C.accent, lw: 1.4 });
    // 窗包络
    poly(f, Array.from({ length: N }, (_, i) => [40 + i * slot, top + plotH / 2 - winFn(i) * plotH * 0.45] as [number, number]), { stroke: `${C.warm}aa`, lw: 1.2, dash: [4, 3] });
    text(f, `${win}（橙色虚线是窗包络）`, 44, top - 8, { color: C.accent, font: '12px sans-serif' });

    const base2 = top + plotH + 46;
    const maxSpec = Math.max(...spec);
    const bw = (w - 80) / spec.length;
    spec.forEach((s, k) => {
      const x = 40 + k * bw;
      const bh = (s / maxSpec) * plotH;
      f.ctx.save();
      f.ctx.fillStyle = k === 8 ? C.hot : `${C.dim}99`;
      f.ctx.fillRect(x, base2 + plotH - bh, Math.max(1, bw - 1), bh);
      f.ctx.restore();
    });
    seg(f, 40, base2 + plotH, w - 40, base2 + plotH, C.dim, 1);
    text(f, '频谱：主瓣宽度与旁瓣电平决定"泄漏"程度', 44, base2 - 8, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      `${win}：主瓣较宽但旁瓣低，能抑制"频谱泄漏"`,
      win === '矩形窗' ? '矩形窗主瓣最窄（频率分辨率最高）但旁瓣最高（-13 dB），泄漏最严重' : win === '布莱克曼窗' ? '布莱克曼窗旁瓣最低（-58 dB）但主瓣最宽 —— 分辨率与泄漏的权衡' : '汉宁/汉明窗是常用的折中：主瓣适中、旁瓣约 -31 dB / -41 dB',
      '做 FFT 前必须加窗：直接截断等于乘矩形窗，会在频谱里引入虚假的旁瓣',
    ]);
    heading(f, '窗函数：抑制频谱泄漏');
  },
});

/** A61 信号处理入门。 */
const signalProcessing = defineViz({
  slug: 'signal-processing',
  title: '信号处理入门',
  params: {
    cutoff: { type: 'range', min: 0.05, max: 0.5, default: 0.2, step: 0.01, label: '截止频率' },
    filter: { type: 'select', options: ['低通', '高通'], default: '低通', label: '滤波器' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const cutoff = num(params, 'cutoff', 0.2);
    const kind = str(params, 'filter', '低通');
    const N = 256;
    // 混合信号：低频 + 高频
    const signal: number[] = [];
    for (let i = 0; i < N; i++) {
      signal.push(Math.sin((2 * Math.PI * 2 * i) / N) + 0.6 * Math.sin((2 * Math.PI * 30 * i) / N));
    }
    const spectrum = dftAmplitude(signal);
    // 频域理想滤波
    const filtered = spectrum.map((amp, k) => {
      const pass = kind === '低通' ? k / spectrum.length <= cutoff : k / spectrum.length >= cutoff;
      return pass ? amp : 0;
    });
    // 逆变换重建（用前若干谐波近似）
    const rebuilt: number[] = [];
    for (let i = 0; i < N; i++) {
      let sum = 0;
      for (let k = 0; k < filtered.length; k++) {
        sum += filtered[k] * Math.cos((2 * Math.PI * k * i) / N);
      }
      rebuilt.push(sum / filtered.length);
    }

    const top = 56;
    const plotH = (h - 180) / 3;
    const slot = (w - 80) / N;
    poly(f, signal.map((s, i) => [40 + i * slot, top + plotH / 2 - s * plotH * 0.4] as [number, number]), { stroke: `${C.dim}cc`, lw: 1 });
    text(f, '原始信号（低频 + 高频叠加）', 44, top - 8, { color: C.dim, font: '12px sans-serif' });

    const mid = top + plotH + 34;
    const maxSpec = Math.max(...spectrum);
    spectrum.forEach((s, k) => {
      const x = 40 + k * ((w - 80) / spectrum.length);
      const pass = kind === '低通' ? k / spectrum.length <= cutoff : k / spectrum.length >= cutoff;
      const bh = (s / maxSpec) * plotH;
      f.ctx.save();
      f.ctx.fillStyle = pass ? C.green : 'rgba(160,174,192,0.35)';
      f.ctx.fillRect(x, mid + plotH - bh, Math.max(1, (w - 80) / spectrum.length - 1), bh);
      f.ctx.restore();
    });
    seg(f, 40, mid + plotH, w - 40, mid + plotH, C.dim, 1);
    text(f, `${kind}滤波器（绿色为保留的频率）`, 44, mid - 8, { color: C.green, font: '12px sans-serif' });

    const base3 = mid + plotH + 34;
    poly(f, rebuilt.map((s, i) => [40 + i * slot, base3 + plotH / 2 - s * plotH * 1.2] as [number, number]), { stroke: C.warm, lw: 1.6 });
    text(f, '滤波后重建的信号', 44, base3 - 8, { color: C.warm, font: '12px sans-serif' });

    footnotes(f, [
      `截止频率 ${(cutoff * 100).toFixed(0)}%（归一化）：${kind}保留${kind === '低通' ? '低频' : '高频'}、滤掉另一部分`,
      kind === '低通' ? '低通滤波后的曲线只剩平滑的低频振荡（高频噪声被去掉）' : '高通滤波后只剩高频细节（低频趋势被去掉）',
      '频域滤波 = 频谱乘以滤波器响应；理想滤波器会有"振铃"，实际用巴特沃斯、切比雪夫等平滑响应',
    ]);
    heading(f, `信号处理：${kind}滤波`);
  },
});

registerViz(
  fourier,
  fourierSeries,
  fourierDrawing,
  fft,
  aliasing,
  autocorrelation,
  convolution,
  nyquistSampling,
  windowing,
  signalProcessing,
);
