import { defineViz, num, str, VizFrame, VizParams } from '../types';
import { registerViz } from '../registry';
import { C, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** 由操作符求值（四则运算）。 */
function apply(a: number, b: number, op: string): number {
  switch (op) {
    case '-': return a - b;
    case '×':
    case '*': return a * b;
    case '÷':
    case '/': return b === 0 ? 0 : a / b;
    default: return a + b;
  }
}

/** 一行小方块（用于把数字画成"可数的量"）。 */
function blockRow(f: VizFrame, x: number, y: number, count: number, color: string, size = 24, max = 20): void {
  const n = Math.min(count, max);
  for (let i = 0; i < n; i++) {
    poly(f, [[x + i * (size + 4), y], [x + i * (size + 4) + size, y], [x + i * (size + 4) + size, y + size], [x + i * (size + 4), y + size]], {
      fill: color,
      close: true,
    });
  }
}

/** 判断素数缓存（小规模实验足够）。 */
function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}

/** 质因数分解。 */
function factorize(n: number): number[] {
  const out: number[] = [];
  let x = n;
  for (let p = 2; p * p <= x; p++) {
    while (x % p === 0) {
      out.push(p);
      x /= p;
    }
  }
  if (x > 1) out.push(x);
  return out;
}

/** 真因子（不含自身的因子）之和。 */
function properDivisors(n: number): number[] {
  if (n < 2) return [];
  const out: number[] = [1];
  for (let i = 2; i * i <= n; i++) {
    if (n % i === 0) {
      out.push(i);
      if (i !== n / i) out.push(n / i);
    }
  }
  return out.sort((a, b) => a - b);
}

/** 罗马数字（支持 1~3999）。 */
function toRoman(n: number): string {
  const table: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let x = Math.max(1, Math.min(3999, Math.floor(n)));
  let out = '';
  for (const [v, s] of table) {
    while (x >= v) {
      out += s;
      x -= v;
    }
  }
  return out;
}

/** 数字的各位数字。 */
function digits(n: number): number[] {
  return String(Math.abs(Math.floor(n))).split('').map(Number);
}

/** Collatz 轨迹。 */
function collatzPath(n: number): number[] {
  const path: number[] = [n];
  let x = n;
  while (x !== 1 && path.length < 400) {
    x = x % 2 === 0 ? x / 2 : 3 * x + 1;
    path.push(x);
  }
  return path;
}

/** 快乐数字迭代链（并给出是否快乐）。 */
function happyPath(n: number): { path: number[]; happy: boolean } {
  const path: number[] = [n];
  const seen = new Set<number>([n]);
  let x = n;
  while (x !== 1) {
    x = digits(x).reduce((a, b) => a + b * b, 0);
    if (seen.has(x)) return { path, happy: false };
    seen.add(x);
    path.push(x);
    if (path.length > 60) break;
  }
  if (x === 1) path.push(1);
  return { path, happy: x === 1 };
}

/** 把数字重排为最大数-最小数，返回下一步（Kaprekar）。 */
function kaprekarStep(x: number, width: number): { next: number; hi: number; lo: number } {
  const s = String(x).padStart(width, '0').split('');
  const hi = Number([...s].sort((a, b) => Number(b) - Number(a)).join(''));
  const lo = Number([...s].sort((a, b) => Number(a) - Number(b)).join(''));
  return { next: hi - lo, hi, lo };
}

/** B01 四则运算可视化。 */
const basicArithmetic = defineViz({
  slug: 'basic-arithmetic',
  title: '四则运算可视化',
  params: {
    a: { type: 'range', min: 1, max: 20, default: 5, label: '第一个数 a' },
    b: { type: 'range', min: 1, max: 20, default: 3, label: '第二个数 b' },
    operation: { type: 'select', options: ['+', '-', '×', '÷'], default: '+', label: '运算' },
  },
  draw: (f) => {
    const { ctx, w, h, params } = f;
    const a = Math.round(num(params, 'a', 5));
    const b = Math.round(num(params, 'b', 3));
    const op = str(params, 'operation', '+');
    const res = apply(a, b, op);

    text(f, `${a} ${op} ${b} = ${Math.round(res * 100) / 100}`, w / 2, 70, {
      align: 'center',
      font: 'bold 30px "Segoe UI", system-ui, sans-serif',
      color: C.fg,
    });

    const size = Math.max(14, Math.min(26, (w - 120) / (a + b + 2)));
    const startX = Math.max(20, (w - (a + b + 1) * (size + 4)) / 2);
    const y = h / 2 - size / 2;
    blockRow(f, startX, y, a, C.accent, size);
    text(f, op, startX + a * (size + 4) - size * 0.1, y + size * 0.7, { color: C.warm, font: `bold ${size}px sans-serif` });
    blockRow(f, startX + (a + 1) * (size + 4), y, b, C.hot, size);

    // 结果条：把"和/差/积/商"画成等长色带
    const barY = h - 90;
    const unit = 22;
    if (op === '+' || op === '-') {
      const total = op === '+' ? a + b : Math.max(0, a - b);
      blockRow(f, startX, barY, total, C.green, size);
      text(f, op === '+' ? '合并后的数量' : '剩余的差', startX, barY - 8, { color: C.dim });
    } else {
      text(f, op === '×' ? `重复 ${a} 行、每行 ${b} 个小块：总数 ${a * b}` : `把 ${a} 平均分成 ${b} 份：每份 ${Math.round(res * 100) / 100}`, 24, barY + 16, { color: C.dim });
      if (op === '×') {
        for (let r = 0; r < Math.min(a, 8); r++) {
          blockRow(f, 24, barY + 30 + r * (size * 0.7), b, C.green, size * 0.6, 20);
        }
      }
    }
    heading(f, '加减乘除的几何意义');
    footnotes(f, ['加法 = 合并数量，减法 = 取走数量', '乘法 = 矩形阵列，除法 = 平均分配']);
  },
});

/** B02 分数可视化。 */
const fractions = defineViz({
  slug: 'fractions',
  title: '分数可视化',
  params: {
    numerator: { type: 'range', min: 1, max: 12, default: 3, label: '分子' },
    denominator: { type: 'range', min: 2, max: 12, default: 4, label: '分母' },
  },
  draw: (f) => {
    const { ctx, w, h, params } = f;
    const den = Math.max(2, Math.round(num(params, 'denominator', 4)));
    const numv = Math.max(1, Math.round(num(params, 'numerator', 3)));
    const filled = Math.min(numv, den);
    const cx = w * 0.34;
    const cy = h / 2;
    const r = Math.min(h * 0.32, w * 0.18);

    // 饼图
    for (let i = 0; i < den; i++) {
      const a0 = (i / den) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / den) * Math.PI * 2 - Math.PI / 2;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = i < filled ? C.accent : C.panel;
      ctx.fill();
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    text(f, `${numv}/${den}`, cx, cy + 8, { align: 'center', font: 'bold 22px sans-serif' });
    text(f, '饼图：整体被等分成 ' + den + ' 份', cx, cy + r + 26, { align: 'center', color: C.dim });

    // 分数条
    const barX = w * 0.6;
    const barW = w * 0.32;
    const barH = 34;
    const by = cy - barH / 2;
    for (let i = 0; i < den; i++) {
      poly(f, [[barX + (i * barW) / den, by], [barX + ((i + 1) * barW) / den, by], [barX + ((i + 1) * barW) / den, by + barH], [barX + (i * barW) / den, by + barH]], {
        fill: i < filled ? C.accent : C.panel,
        stroke: C.bg,
        lw: 2,
        close: true,
      });
    }
    text(f, '分数条：数轴上 0 到 1 的一段', barX, by - 14, { color: C.dim });
    text(f, `小数 ≈ ${(numv / den).toFixed(4)}`, barX, by + barH + 26, { color: C.green });
    text(f, `百分数 ≈ ${((numv / den) * 100).toFixed(2)}%`, barX, by + barH + 48, { color: C.warm });
    heading(f, '分数的本质：整体中的若干等份');
  },
});

/** B03 奇偶数探索。 */
const evenOdd = defineViz({
  slug: 'even-odd',
  title: '奇偶数探索',
  params: {
    n: { type: 'range', min: 1, max: 60, default: 17, label: '数字 n' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.max(1, Math.round(num(params, 'n', 17)));
    const even = n % 2 === 0;
    const size = 16;
    const perRow = Math.max(1, Math.floor((w - 60) / (size * 2 + 6)));
    const rows = Math.ceil(n / perRow);
    const startX = 30;
    const startY = 70;

    for (let i = 0; i < n; i += 2) {
      const pair = Math.floor(i / 2);
      const r = Math.floor(pair / perRow);
      const c = pair % perRow;
      const x = startX + c * (size * 2 + 6);
      const y = startY + r * (size + 6);
      dot(f, x, y + size / 2, size / 2, C.accent);
      if (i + 1 < n) dot(f, x + size + 6, y + size / 2, size / 2, C.accent);
    }
    if (!even) {
      const pair = Math.floor(n / 2);
      const r = Math.floor(pair / perRow);
      const c = pair % perRow;
      dot(f, startX + c * (size * 2 + 6), startY + r * (size + 6) + size / 2, size / 2, C.hot);
      text(f, '落单的一个', startX + c * (size * 2 + 6) + size + 12, startY + r * (size + 6) + size / 2 + 5, { color: C.hot });
    }
    text(f, `${n} 是${even ? '偶数：正好两两配对' : '奇数：两两配对后还剩 1 个'}`, 30, h - 40, {
      color: even ? C.green : C.hot,
      font: 'bold 16px "Segoe UI", system-ui, sans-serif',
    });
    text(f, `n mod 2 = ${n % 2}     n² mod 2 = ${(n * n) % 2}`, 30, h - 18, { color: C.dim });
    heading(f, '奇偶性：能不能两两配对');
  },
});

/** B04 绝对值与距离。 */
const absoluteValue = defineViz({
  slug: 'absolute-value',
  title: '绝对值与距离',
  params: {
    a: { type: 'range', min: -10, max: 10, default: -6, label: '点 a' },
    b: { type: 'range', min: -10, max: 10, default: 4, label: '点 b' },
  },
  draw: (f) => {
    const { ctx, w, h, params } = f;
    const a = num(params, 'a', -6);
    const b = num(params, 'b', 4);
    const v = view(f, { xMin: -11, xMax: 11, yMin: -3, yMax: 3, inset: 40 });
    const y0 = v.sy(0);

    seg(f, v.sx(-11), y0, v.sx(11), y0, C.dim, 2);
    for (let x = -10; x <= 10; x++) {
      seg(f, v.sx(x), y0 - 6, v.sx(x), y0 + 6, C.dim, 1);
      if (x % 2 === 0) text(f, String(x), v.sx(x), y0 + 22, { align: 'center', color: C.dim, font: '11px sans-serif' });
    }
    dot(f, v.sx(a), y0, 6, C.hot);
    dot(f, v.sx(b), y0, 6, C.cool);
    text(f, `a=${a}`, v.sx(a), y0 - 16, { align: 'center', color: C.hot });
    text(f, `b=${b}`, v.sx(b), y0 - 16, { align: 'center', color: C.cool });

    // 距离弧
    ctx.save();
    ctx.strokeStyle = C.green;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(v.sx(a), y0 - 42);
    ctx.lineTo(v.sx(b), y0 - 42);
    ctx.stroke();
    ctx.restore();
    text(f, `|a - b| = |${a} - ${b}| = ${Math.abs(a - b)}`, (v.sx(a) + v.sx(b)) / 2, y0 - 52, { align: 'center', color: C.green });
    text(f, `|a| = ${Math.abs(a)}    |b| = ${Math.abs(b)}`, 24, h - 40, { color: C.fg });
    text(f, '绝对值 = 到原点的距离；|a-b| = 两点之间的距离', 24, h - 18, { color: C.dim });
    heading(f, '绝对值就是距离');
  },
});

/** B05 罗马数字。 */
const romanNumerals = defineViz({
  slug: 'roman-numerals',
  title: '罗马数字',
  params: {
    n: { type: 'number', min: 1, max: 3999, default: 1987, label: '十进制数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.max(1, Math.min(3999, Math.round(num(params, 'n', 1987))));
    const roman = toRoman(n);
    text(f, String(n), w / 2, 80, { align: 'center', font: 'bold 34px "Segoe UI", system-ui, sans-serif', color: C.fg });
    text(f, '=', w / 2, 112, { align: 'center', color: C.dim });
    text(f, roman, w / 2, 160, { align: 'center', font: 'bold 34px "Times New Roman", serif', color: C.warm });

    // 符号计数
    const counts: Array<[string, number]> = [];
    for (const s of ['M', 'D', 'C', 'L', 'X', 'V', 'I']) {
      const c = roman.split('').filter((ch) => ch === s).length;
      if (c > 0) counts.push([s, c]);
    }
    const cw = Math.min(90, (w - 80) / Math.max(1, counts.length));
    counts.forEach(([s, c], i) => {
      const x = 40 + i * (cw + 10);
      const barH = c * 22;
      poly(f, [[x, h - 90 - barH], [x + cw, h - 90 - barH], [x + cw, h - 90], [x, h - 90]], { fill: C.accent, close: true });
      text(f, `${s}×${c}`, x + cw / 2, h - 100 - barH, { align: 'center', color: C.fg });
      text(f, s, x + cw / 2, h - 70, { align: 'center', font: 'bold 18px "Times New Roman", serif', color: C.dim });
    });
    heading(f, '罗马数字：加减组合的记数系统');
    footnotes(f, ['I=1 V=5 X=10 L=50 C=100 D=500 M=1000', '小符号在大符号左侧表示减去（如 IV = 4）']);
  },
});

/** B06 进制转换。 */
const numberBases = defineViz({
  slug: 'number-bases',
  title: '进制转换',
  params: {
    n: { type: 'number', min: 0, max: 4095, default: 2024, label: '十进制数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.max(0, Math.min(4095, Math.round(num(params, 'n', 2024))));
    const rows: Array<[string, string]> = [
      ['二进制 (2)', n.toString(2)],
      ['八进制 (8)', n.toString(8)],
      ['十进制 (10)', n.toString(10)],
      ['十六进制 (16)', n.toString(16).toUpperCase()],
    ];
    const top = 60;
    rows.forEach(([label, val], i) => {
      const y = top + i * 52;
      text(f, label, 30, y + 24, { color: C.dim, font: '15px "Segoe UI", system-ui, sans-serif' });
      text(f, val, 200, y + 24, { color: C.accent, font: 'bold 20px Consolas, monospace' });
    });

    // 二进制位展开
    const bits = n.toString(2).padStart(12, '0').split('');
    const bw = Math.min(38, (w - 80) / bits.length);
    text(f, '每一位的权重（2 的幂）', 30, h - 120, { color: C.dim });
    bits.forEach((bit, i) => {
      const x = 30 + i * (bw + 4);
      const y = h - 100;
      const on = bit === '1';
      poly(f, [[x, y], [x + bw, y], [x + bw, y + bw], [x, y + bw]], { fill: on ? C.accent : C.panel, close: true });
      text(f, bit, x + bw / 2, y + bw / 2 + 6, { align: 'center', color: on ? '#fff' : C.dim, font: 'bold 16px monospace' });
      text(f, String(Math.pow(2, bits.length - 1 - i)), x + bw / 2, y + bw + 16, { align: 'center', color: C.dim, font: '10px sans-serif' });
    });
    heading(f, '同一个数的不同写法');
    footnotes(f, ['二进制每一位代表一个 2 的幂，1 表示"取这一位"']);
  },
});

/** B07 时钟角度。 */
const clockAngles = defineViz({
  slug: 'clock-angles',
  title: '时钟角度',
  params: {
    hour: { type: 'range', min: 1, max: 12, default: 3, label: '小时' },
    minute: { type: 'range', min: 0, max: 59, default: 30, label: '分钟' },
  },
  draw: (f) => {
    const { ctx, w, h, params } = f;
    const hour = Math.round(num(params, 'hour', 3));
    const minute = Math.round(num(params, 'minute', 30));
    const cx = w / 2;
    const cy = h / 2 + 10;
    const r = Math.min(w, h) * 0.34;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#22303f';
    ctx.fill();
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const x1 = cx + Math.cos(a) * (r - 12);
      const y1 = cy + Math.sin(a) * (r - 12);
      const x2 = cx + Math.cos(a) * r;
      const y2 = cy + Math.sin(a) * r;
      seg(f, x1, y1, x2, y2, C.dim, 3);
      text(f, String(i === 0 ? 12 : i), cx + Math.cos(a) * (r - 30), cy + Math.sin(a) * (r - 30) + 5, { align: 'center', color: C.fg });
    }

    const hourAngle = ((hour % 12) / 12 + minute / 720) * Math.PI * 2 - Math.PI / 2;
    const minAngle = (minute / 60) * Math.PI * 2 - Math.PI / 2;
    seg(f, cx, cy, cx + Math.cos(hourAngle) * r * 0.5, cy + Math.sin(hourAngle) * r * 0.5, C.warm, 6);
    seg(f, cx, cy, cx + Math.cos(minAngle) * r * 0.78, cy + Math.sin(minAngle) * r * 0.78, C.cool, 4);
    dot(f, cx, cy, 5, C.fg);

    const angleHour = (hour % 12) * 30 + minute * 0.5;
    const angleMin = minute * 6;
    let diff = Math.abs(angleHour - angleMin) % 360;
    if (diff > 180) diff = 360 - diff;
    text(f, `${hour}:${String(minute).padStart(2, '0')}`, cx, cy + r + 40, { align: 'center', color: C.fg, font: 'bold 20px monospace' });
    text(f, `时针 ${angleHour.toFixed(1)}°  分针 ${angleMin.toFixed(1)}°  夹角 ${diff.toFixed(1)}°`, 20, h - 18, { color: C.green });
    heading(f, '时钟角度：圆周 360° 的分割');
  },
});

/** B08 数字根。 */
const digitalRoot = defineViz({
  slug: 'digital-root',
  title: '数字根',
  params: {
    n: { type: 'number', min: 1, max: 999999, default: 9875, label: '数字' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.max(1, Math.round(num(params, 'n', 9875)));
    let cur = n;
    const chain: number[] = [cur];
    const sums: string[] = [];
    while (cur >= 10) {
      const d = digits(cur);
      sums.push(`${cur} → ${d.join(' + ')} = ${d.reduce((a, b) => a + b, 0)}`);
      cur = d.reduce((a, b) => a + b, 0);
      chain.push(cur);
    }
    const root = cur;

    sums.forEach((s, i) => {
      text(f, s, 30, 70 + i * 26, { color: i % 2 === 0 ? C.fg : C.dim, font: '15px Consolas, monospace' });
    });
    const y = 70 + sums.length * 26 + 40;
    text(f, `数字根 = ${root}`, 30, y, { color: C.green, font: 'bold 26px "Segoe UI", system-ui, sans-serif' });
    text(f, `${n} mod 9 = ${n % 9 === 0 ? 9 : n % 9}  （弃九法的依据）`, 30, y + 30, { color: C.cool });
    text(f, `${n} - ${digits(n).reduce((a, b) => a + b, 0)} = ${n - digits(n).reduce((a, b) => a + b, 0)} 能被 9 整除`, 30, y + 56, { color: C.dim });

    // 数字根循环图
    const cx = w * 0.72;
    const cy = h / 2 - 10;
    const rr = Math.min(w, h) * 0.2;
    for (let i = 1; i <= 9; i++) {
      const a = (i / 9) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * rr;
      const yy = cy + Math.sin(a) * rr;
      const active = i === root;
      dot(f, x, yy, active ? 16 : 11, active ? C.green : C.panel);
      text(f, String(i), x, yy + 5, { align: 'center', color: active ? '#fff' : C.dim, font: 'bold 13px sans-serif' });
    }
    text(f, '数字根 1~9 的循环', cx, cy + rr + 40, { align: 'center', color: C.dim });
    heading(f, '数字根：反复求各位之和');
  },
});

/** B09 素数计数函数。 */
const primeCounting = defineViz({
  slug: 'prime-counting',
  title: '素数计数函数',
  params: {
    n: { type: 'range', min: 10, max: 1000, default: 100, label: '上限 n' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.max(10, Math.round(num(params, 'n', 100)));
    const cols = Math.max(8, Math.floor((w - 40) / 18));
    const cell = (w - 40) / cols - 2;
    let count = 0;
    const countY: number[] = [];
    for (let i = 2; i <= n; i++) {
      const p = isPrime(i);
      if (p) count++;
      countY.push(count);
      const idx = i - 2;
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      const y = 46 + r * (cell + 3);
      if (y + cell > h - 60) break;
      poly(f, [[20 + c * (cell + 2), y], [20 + c * (cell + 2) + cell, y], [20 + c * (cell + 2) + cell, y + cell], [20 + c * (cell + 2), y + cell]], {
        fill: p ? C.accent : C.panel,
        close: true,
      });
    }
    const approx = n / Math.log(n);
    const actual = countY[countY.length - 1] ?? 0;
    text(f, `π(${n}) = ${actual}      近似 n/ln n = ${approx.toFixed(1)}`, 20, h - 32, { color: C.fg, font: '15px "Segoe UI", system-ui, sans-serif' });
    text(f, `误差 ${(actual - approx).toFixed(1)}（素数定理：π(x) ~ x/ln x）`, 20, h - 12, { color: C.dim });
    heading(f, '素数分布：蓝色为素数');
  },
});

/** B10 素因数分解。 */
const primeFactorization = defineViz({
  slug: 'prime-factorization',
  title: '素因数分解',
  params: {
    n: { type: 'number', min: 2, max: 10000, default: 360, label: '待分解的数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.max(2, Math.round(num(params, 'n', 360)));
    const fts = factorize(n);
    const grouped: Array<[number, number]> = [];
    for (const p of fts) {
      const last = grouped[grouped.length - 1];
      if (last && last[0] === p) last[1]++;
      else grouped.push([p, 1]);
    }
    text(f, `${n} = ${grouped.map(([p, c]) => (c > 1 ? `${p}^${c}` : `${p}`)).join(' × ')}`, w / 2, 70, {
      align: 'center',
      font: 'bold 26px "Segoe UI", system-ui, sans-serif',
      color: C.fg,
    });

    // 逐步除法过程
    let cur = n;
    const steps: string[] = [];
    for (const p of fts) {
      steps.push(`${cur} ÷ ${p} = ${cur / p}`);
      cur = cur / p;
      if (steps.length > 12) break;
    }
    steps.forEach((s, i) => text(f, s, 30, 120 + i * 22, { color: C.dim, font: '14px Consolas, monospace' }));

    // 质因数条形（每个因子一个方块）
    const size = Math.max(12, Math.min(30, (w - 80) / Math.max(1, fts.length) - 6));
    fts.forEach((p, i) => {
      const x = 30 + i * (size + 6);
      const y = h - 70 - size;
      const hue = (p * 47) % 360;
      poly(f, [[x, y], [x + size, y], [x + size, y + size], [x, y + size]], { fill: `hsl(${hue}, 60%, 55%)`, close: true });
      text(f, String(p), x + size / 2, y + size / 2 + 5, { align: 'center', color: '#fff', font: `bold ${Math.max(10, size * 0.45)}px sans-serif` });
    });
    text(f, `共 ${fts.length} 个质因数（算术基本定理：分解唯一）`, 30, h - 24, { color: C.green });
    heading(f, '素因数分解：拆到不能再拆');
  },
});

/** B11 Collatz 猜想。 */
const collatz = defineViz({
  slug: 'collatz',
  title: 'Collatz 猜想',
  params: {
    n: { type: 'range', min: 1, max: 200, default: 27, label: '起始值' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.max(1, Math.round(num(params, 'n', 27)));
    const path = collatzPath(n);
    const v = view(f, { xMin: 0, xMax: Math.max(10, path.length - 1), yMin: 0, yMax: Math.max(...path) * 1.05, inset: 36 });
    grid(f, v, { divisions: 6, ticks: true });
    const pts: Array<[number, number]> = path.map((y, i) => [v.sx(i), v.sy(y)]);
    poly(f, pts, { stroke: C.accent, lw: 2 });
    dot(f, pts[0][0], pts[0][1], 4, C.green);
    dot(f, pts[pts.length - 1][0], pts[pts.length - 1][1], 4, C.hot);
    const peak = Math.max(...path);
    text(f, `起始 ${n}：${path.length} 步到达 1，峰值 ${peak}`, 30, h - 34, { color: C.fg });
    text(f, '偶数折半，奇数乘 3 加 1 —— 是否所有正整数都会落到 1？（未解之谜）', 30, h - 14, { color: C.warm });
    heading(f, 'Collatz 3n+1 轨迹');
  },
});

/** B12 快乐数字。 */
const happyNumbers = defineViz({
  slug: 'happy-numbers',
  title: '快乐数字',
  params: {
    n: { type: 'range', min: 1, max: 500, default: 19, label: '数字 n' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.max(1, Math.round(num(params, 'n', 19)));
    const { path, happy } = happyPath(n);

    // 迭代链
    const cw = 74;
    const perRow = Math.max(1, Math.floor((w - 60) / cw));
    path.slice(0, 24).forEach((v, i) => {
      const r = Math.floor(i / perRow);
      const c = i % perRow;
      const x = 30 + c * cw;
      const y = 70 + r * 62;
      const isLast = i === path.length - 1 || i === 23;
      dot(f, x + 22, y + 18, 20, isLast ? (happy ? C.green : C.hot) : C.panel);
      text(f, String(v), x + 22, y + 24, { align: 'center', color: C.fg, font: '13px Consolas, monospace' });
      if (c < perRow - 1 && i < 23) {
        text(f, '→', x + 52, y + 24, { color: C.dim, font: '16px sans-serif' });
      }
    });
    text(f, happy ? `${n} 是快乐数字：迭代最终收敛到 1` : `${n} 不是快乐数字：陷入循环 ${path.slice(-4).join(' → ')}`, 30, h - 34, {
      color: happy ? C.green : C.hot,
      font: 'bold 15px "Segoe UI", system-ui, sans-serif',
    });
    text(f, '规则：把各位数字平方相加，重复直到 1 或出现循环', 30, h - 14, { color: C.dim });
    heading(f, '快乐数字迭代链');
  },
});

/** B13 Kaprekar 常数。 */
const kaprekar = defineViz({
  slug: 'kaprekar',
  title: 'Kaprekar 常数',
  params: {
    n: { type: 'number', min: 100, max: 9999, default: 3524, label: '四位数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    let x = Math.max(100, Math.min(9999, Math.round(num(params, 'n', 3524))));
    const width = String(x).length === 3 ? 3 : 4;
    const target = width === 3 ? 495 : 6174;
    const chain: Array<[number, number, number, number]> = [];
    for (let i = 0; i < 12 && x !== target; i++) {
      const s = kaprekarStep(x, width);
      chain.push([x, s.hi, s.lo, s.next]);
      x = s.next;
    }

    const startY = 62;
    text(f, `降序数 - 升序数 = 下一个数（目标是 ${target}）`, 30, startY, { color: C.dim });
    chain.forEach(([from, hi, lo, next], i) => {
      const y = startY + 30 + i * 30;
      text(f, `${String(hi).padStart(width, '0')} - ${String(lo).padStart(width, '0')} = ${String(next).padStart(width, '0')}`, 30, y, {
        color: next === target ? C.green : C.fg,
        font: '15px Consolas, monospace',
      });
    });
    if (chain.length === 0) {
      text(f, `${String(x).padStart(width, '0')} 已经是 Kaprekar 常数`, 30, startY + 30, { color: C.green });
    }
    const reached = x === target;
    text(f, reached ? `${chain.length} 步到达 ${target}` : `迭代 ${chain.length} 次后仍未到达（检查输入是否各位不全相同）`, 30, h - 22, {
      color: reached ? C.green : C.warm,
    });
    heading(f, 'Kaprekar 常数：数字重排的力量');
  },
});

/** B14 卢卡斯数列。 */
const lucasNumbers = defineViz({
  slug: 'lucas-numbers',
  title: '卢卡斯数列',
  params: {
    n: { type: 'range', min: 4, max: 24, default: 12, label: '项数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.max(4, Math.round(num(params, 'n', 12)));
    const lucas: number[] = [2, 1];
    const fib: number[] = [0, 1];
    for (let i = 2; i < n; i++) {
      lucas.push(lucas[i - 1] + lucas[i - 2]);
      fib.push(fib[i - 1] + fib[i - 2]);
    }
    const maxV = Math.max(...lucas, ...fib);
    const v = view(f, { xMin: 0, xMax: n - 1, yMin: 0, yMax: maxV * 1.1, inset: 36, insetRight: 60 });
    grid(f, v, { divisions: 6, ticks: true });
    poly(f, lucas.map((y, i) => [v.sx(i), v.sy(y)] as [number, number]), { stroke: C.warm, lw: 2 });
    lucas.forEach((y, i) => dot(f, v.sx(i), v.sy(y), 3, C.warm));
    poly(f, fib.map((y, i) => [v.sx(i), v.sy(y)] as [number, number]), { stroke: C.cool, lw: 2, dash: [5, 4] });
    text(f, `L(n) = L(n-1) + L(n-2)，L(0)=2, L(1)=1`, 30, h - 54, { color: C.warm });
    text(f, `L(n) = F(n-1) + F(n+1)`, 30, h - 34, { color: C.cool });
    text(f, `第 ${n} 项：${lucas[n - 1]}    第 ${n} 项斐波那契：${fib[n - 1]}`, 30, h - 14, { color: C.dim });
    heading(f, '卢卡斯数列（实线）与斐波那契数列（虚线）');
  },
});

/** B15 完美数。 */
const perfectNumbers = defineViz({
  slug: 'perfect-numbers',
  title: '完美数',
  params: {
    limit: { type: 'range', min: 100, max: 10000, default: 1000, label: '搜索上限' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const limit = Math.max(100, Math.round(num(params, 'limit', 1000)));
    const found: number[] = [];
    for (let i = 2; i <= limit && found.length < 4; i++) {
      const divs = properDivisors(i);
      const sum = divs.reduce((a, b) => a + b, 0);
      if (sum === i) found.push(i);
    }
    const top = found.length;
    text(f, `${limit} 以内的完美数（真因子之和 = 自身）`, 30, 66, { color: C.dim });
    if (top === 0) {
      text(f, '未找到（试试把上限调大）', 30, 110, { color: C.warm });
    }
    const target = top > 0 ? found[top - 1] : 6;
    const divs = properDivisors(target);
    const cw = Math.min(64, (w - 80) / Math.max(1, divs.length) - 4);
    divs.forEach((d, i) => {
      const x = 30 + i * (cw + 4);
      const bh = Math.min(120, (d / target) * h * 0.45);
      poly(f, [[x, h - 110 - bh], [x + cw, h - 110 - bh], [x + cw, h - 110], [x, h - 110]], { fill: C.accent, close: true });
      text(f, String(d), x + cw / 2, h - 116 - bh, { align: 'center', color: C.fg, font: '12px monospace' });
    });
    const sum = divs.reduce((a, b) => a + b, 0);
    text(f, `${found.length > 0 ? found.join(', ') : '-'}`, 30, h - 78, { color: C.green, font: 'bold 18px "Segoe UI", system-ui, sans-serif' });
    text(f, `${target} 的真因子 ${divs.join(' + ')} = ${sum} = ${target}`, 30, h - 50, { color: C.fg });
    text(f, '欧几里得公式：若 2^p - 1 为素数，则 2^(p-1)(2^p - 1) 是完美数', 30, h - 22, { color: C.dim });
    heading(f, '完美数：真因子之和等于自身');
  },
});

registerViz(
  basicArithmetic,
  fractions,
  evenOdd,
  absoluteValue,
  romanNumerals,
  numberBases,
  clockAngles,
  digitalRoot,
  primeCounting,
  primeFactorization,
  collatz,
  happyNumbers,
  kaprekar,
  lucasNumbers,
  perfectNumbers,
);
