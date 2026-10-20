/**
 * AI 演示图的「时间维度」支持。
 *
 * 背景：AI 返回的 graph 原本只会画一张静态图，学生看到的永远是一瞬。而物理里绝大多数
 * 主题（振动、波动、圆周运动、碰撞、衰变、轨道…）的本质就是"随时间演化"——
 * 一张静止的图远不如像内置单摆那样动起来直观。
 *
 * 这里的纯函数负责把这份能力交给模型：
 *   - 表达式里可以直接写时间变量 t（秒），渲染器逐帧递增并重绘；
 *   - 数值字段（at / center / from / to / points）也可以引用 $t 或含 t 的算式；
 *   - 图元 motion：参数方程 x(s)、y(s) 画曲线，并把 s 随时间扫过，画出运动的点与拖尾。
 *
 * 抽成独立模块的原因：这些判定与求值必须能在 karma/node 下单测，不依赖 Canvas 与 Angular。
 */

/** motion 图元：参数方程曲线 + 随时间扫过的动点。 */
export interface MotionElement {
  type: string;
  /** x 的参数方程，自变量为 s */
  x?: string;
  /** y 的参数方程，自变量为 s */
  y?: string;
  /** 等价写法：xs / ys（与 x / y 二选一） */
  xs?: string;
  ys?: string;
  /** 参数 s 的定义域，默认 [0,1] */
  sFrom?: number | string;
  sTo?: number | string;
  /** 动点在一个周期内扫过的参数区间，默认整个定义域 */
  span?: [number | string, number | string];
  /** 动点在两端往返扫动（像单摆那样来回摆），默认 false */
  pingpong?: boolean;
  /** 拖尾长度（占扫过区间的比例），0 表示不留拖尾，默认 0.18 */
  trail?: number | string;
  samples?: number | string;
  color?: string;
  fill?: string;
  width?: number | string;
  size?: number | string;
  label?: string;
  /** 虚线段：true=默认虚线；数组=虚线段长与间隔 */
  dash?: boolean | number[];
}

/** 动画配置：graph.animate 的原始内容。 */
export interface AnimateConfig {
  enabled?: boolean;
  /** 一个周期的时长（秒），默认 4 */
  period?: number;
  /** 周期内的时间范围 [tMin, tMax]，默认 [0, period] */
  tRange?: [number, number];
  /** 相位推进：false=线性推进（默认），true=按三角波往返（像单摆那样来回摆） */
  pingpong?: boolean;
}

/** 动画计划：动画侦测与时间映射的全部输入。 */
export interface AnimatePlan {
  /**
   * 外部强制开关：true=强制播放，false=强制静态，null=交由内容判定（默认）。
   *
   * 与 graph.animate.enabled（模型意图）分开：两者混用会让"自动判定"永远短路成 true。
   */
  force: boolean | null;
  period: number;
  tRange: [number, number];
  pingpong: boolean;
}

/** motion 图元在当前时刻的绘制数据（全部为数学坐标）。 */
export interface MotionState {
  /** 参数轨迹 */
  curve: Array<[number, number]>;
  /** 动点当前位置，无法求值时返回 null */
  point: [number, number] | null;
  /** 拖尾点（按时间先后排列） */
  trail: Array<[number, number]>;
}

/**
 * 表达式求值器：渲染器编译出的函数形如 (x, y) => number，
 * 其中 x 同时充当参数方程的自变量 s，因此可以直接当单参函数用。
 */
export type ExprFn = (x: number, y?: number) => number;

const DEFAULT_PERIOD = 4;
const DEFAULT_SAMPLES = 240;
const MAX_TRAIL_POINTS = 90;

/** 先把任意值转成有限数值，非有限时用兜底值。 */
function finite(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** 把值收进 [lo, hi]。 */
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * 表达式/数值字段里是否引用了时间变量 t。
 *
 * 用词边界匹配，避免把 tan / atan / atan2 里的 t 当成时间变量；
 * 数值字段的写法 $t、$t / 2 里的 $ 不是词字符，边界判断依然成立。
 */
export function usesTimeVar(text: unknown): boolean {
  if (typeof text !== 'string' || text.indexOf('t') < 0) return false;
  // 允许 t 后面跟 $（"$t" 这类写法里 t 不在末尾），但仍不允许后接字母/数字/下划线，
  // 否则 t_0 这样的参数名会被误判成时间变量。
  return /(^|[^A-Za-z0-9_])t(?![A-Za-z0-9_$])/.test(text);
}

/** 收集 graph 里所有可能含表达式的字符串（用于动画侦测；导出便于单测）。 */
export function expressionStrings(node: unknown, out: string[], depth = 0): void {
  if (depth > 8 || node === null || node === undefined) return;
  if (typeof node === 'string') {
    out.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) expressionStrings(item, out, depth + 1);
    return;
  }
  if (typeof node !== 'object') return;
  // 这些键下面的**字符串值不是表达式**，一律不进候选：
  //   type    —— 图元种类（"motion" / "point"…），里面的小写 t 不是时间变量；
  //   label/text —— 标注文字，$t 由插值替换处理，不据此触发动画；
  //   axes/range/sFrom/sTo/span/tRange/period/duration —— 坐标范围与参数区间。
  // 少了这层过滤，一张静态图会因为 "type":"point"、axes.x=[0,"t"] 之类被误判成动画图。
  const skipped = /^(type|label|text|axes|range|sFrom|sTo|span|tRange|period|duration)$/i;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (skipped.test(key)) continue;
    expressionStrings(value, out, depth + 1);
  }
}

/** graph 里是否出现了 motion 图元（参数方程动图，必须逐帧播放）。 */
export function hasMotionElement(graph: unknown): boolean {
  if (!graph || typeof graph !== 'object') return false;
  const elements = (graph as { elements?: unknown }).elements;
  if (!Array.isArray(elements)) return false;
  return elements.some(
    (el) => !!el && typeof el === 'object' && String((el as { type?: unknown }).type ?? '').toLowerCase() === 'motion',
  );
}

/** 用户是否在系统里要求「减少动态效果」。 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * 判断这份 graph 是否需要逐帧动画。
 *
 * 优先级：animate.enabled 显式开关 > 内容里的时间痕迹（t / $t / motion 图元）。
 * 显式关闭时绝不自动播放，便于模型给"只需看形状"的图关掉动画。
 * 系统开启「减少动态效果」时默认不动（显式 animate.enabled=true 仍然尊重用户意图）。
 */
/**
 * 判断这份 graph 是否需要逐帧动画。
 *
 * 优先级：外部强制开关（plan.force）> graph.animate.enabled（模型意图）> 内容里的时间痕迹
 * （t / $t / motion 图元）。显式关闭时绝不自动播放，便于模型给"只需看形状"的图关掉动画。
 * 系统开启「减少动态效果」时默认不动（显式要求播放时仍然尊重用户意图）。
 */
export function detectAnimate(graph: unknown, plan: AnimatePlan): boolean {
  if (!graph || typeof graph !== 'object') return false;
  const cfg = (graph as { animate?: AnimateConfig }).animate;
  const reduced = prefersReducedMotion();

  // 外部强制开关优先（用户在界面上手动开/关，或调用方明确指定）
  if (plan.force === false) return false;
  if (plan.force === true) return !reduced;

  // 模型显式声明
  if (cfg && cfg.enabled === false) return false;
  if (cfg && cfg.enabled === true) return !reduced;
  if (reduced) return false;
  if (hasMotionElement(graph)) return true;

  const found: string[] = [];
  expressionStrings((graph as { elements?: unknown }).elements, found);
  expressionStrings((graph as { surface?: unknown }).surface, found);
  return found.some((s) => usesTimeVar(s));
}

/** 把 graph.animate 规整成动画计划（补缺省值、校正范围）；force 缺省为 null（自动判定）。 */
export function normalizeAnimatePlan(cfg: AnimateConfig | undefined, force: boolean | null = null): AnimatePlan {
  const period = clamp(finite(cfg?.period, DEFAULT_PERIOD), 0.2, 600);
  let range: [number, number] = [0, period];
  const raw = cfg?.tRange;
  if (Array.isArray(raw) && raw.length === 2) {
    const lo = Number(raw[0]);
    const hi = Number(raw[1]);
    if (Number.isFinite(lo) && Number.isFinite(hi) && hi > lo) range = [lo, hi];
  }
  return { force, period, tRange: range, pingpong: cfg?.pingpong === true };
}

/** 按周期与相位推进规则，把已播放时长（秒）映射成时间变量 t。 */
export function timeValue(elapsedSec: number, plan: AnimatePlan): number {
  const [lo, hi] = plan.tRange;
  const span = hi - lo;
  if (!(span > 0) || !(plan.period > 0) || !Number.isFinite(elapsedSec)) return lo;
  const phase = ((elapsedSec % plan.period) + plan.period) % plan.period / plan.period; // 0..1
  // pingpong：三角波（0→1→0），像单摆那样往返；否则线性循环推进
  const raw = plan.pingpong ? (phase < 0.5 ? phase * 2 : (1 - phase) * 2) : phase;
  return lo + span * raw;
}

/**
 * 求 motion 图元在当前时刻的状态。
 *
 * 动点在**一个动画周期内**从 span 起点扫到终点（pingpong=true 则到端点后折返），
 * 这样"摆球来回摆"只需一个周期就看得见，与内置单摆的观感一致。
 *
 * @param el      motion 图元
 * @param elapsed 已播放时长（秒，0 = 周期起点）
 * @param plan    动画计划（周期 / 时间范围 / pingpong）
 * @param makeFn  表达式编译器：把字符串编译成 (s) => number（t 已由调用方注入）
 * @param resolve 标量字段求值器（`sFrom`/`sTo`/`span`/`trail`/`samples` 走它）。
 *                `MotionElement` 里这些字段的类型本来就是 `number | string`，
 *                但早期实现用 `Number(v)` 硬转，模型写 "$num_a" 会静默退化成默认值 ——
 *                由调用方注入渲染器的 numeric() 后，$参数名 / 算式都能用。
 *                不传时退化为"只认数字"（纯函数单测与旧调用方不受影响）。
 */
export function motionState(
  el: MotionElement,
  elapsed: number,
  plan: AnimatePlan,
  makeFn: (expr: string) => ExprFn,
  resolve?: (v: unknown, fallback: number) => number,
): MotionState {
  const fx = makeFn(String(el.x ?? el.xs ?? 's'));
  const fy = makeFn(String(el.y ?? el.ys ?? '0'));
  const scalar = (v: unknown, fallback: number): number => (resolve ? resolve(v, fallback) : finite(v, fallback));

  const sFrom = scalar(el.sFrom, 0);
  const sTo = scalar(el.sTo, 1);
  const lo = Math.min(sFrom, sTo);
  const hi = Math.max(sFrom, sTo);
  if (!(hi > lo)) return { curve: [], point: null, trail: [] };

  const samples = Math.max(8, Math.min(1200, Math.round(scalar(el.samples, DEFAULT_SAMPLES))));
  const curve: Array<[number, number]> = [];
  for (let i = 0; i <= samples; i++) {
    const s = lo + ((hi - lo) * i) / samples;
    const x = fx(s);
    const y = fy(s);
    if (Number.isFinite(x) && Number.isFinite(y)) curve.push([x, y]);
  }

  // 动点扫过的参数区间：给了 span 就用 span，否则整个定义域
  let a = lo;
  let b = hi;
  if (Array.isArray(el.span) && el.span.length === 2) {
    const sa = scalar(el.span[0], lo);
    const sb = scalar(el.span[1], hi);
    if (sb > sa) {
      a = sa;
      b = sb;
    }
  }

  // 相位：0..1 表示 s 从 a 扫到 b 的进度（与 timeValue 的推进规则一致）
  const period = plan.period > 0 ? plan.period : DEFAULT_PERIOD;
  const safeElapsed = Number.isFinite(elapsed) ? elapsed : 0;
  const phaseRaw = ((safeElapsed % period) + period) % period / period;
  let phase = phaseRaw;
  const pingpong = el.pingpong === true || plan.pingpong === true;
  if (pingpong) phase = phaseRaw < 0.5 ? phaseRaw * 2 : (1 - phaseRaw) * 2;

  const sAt = (p: number): number => a + (b - a) * p;
  const px = fx(sAt(phase));
  const py = fy(sAt(phase));
  const point: [number, number] | null = Number.isFinite(px) && Number.isFinite(py) ? [px, py] : null;

  // 拖尾：顺着扫动方向往回取若干点（折返时自动反向）
  const trail: Array<[number, number]> = [];
  const trailRatio = clamp(scalar(el.trail, 0.18), 0, 1);
  if (trailRatio > 0) {
    const dir = pingpong && phaseRaw >= 0.5 ? -1 : 1;
    const steps = Math.max(2, Math.round(MAX_TRAIL_POINTS * trailRatio));
    for (let i = 0; i < steps; i++) {
      const p = phase - (dir * trailRatio * i) / steps;
      if (p < 0 || p > 1) break;
      const x = fx(sAt(p));
      const y = fy(sAt(p));
      if (Number.isFinite(x) && Number.isFinite(y)) trail.push([x, y]);
    }
  }

  return { curve, point, trail };
}

// ---------------------------------------------------------------------------
// 表达式规整：以下三个函数移植自同类项目
// （E:\go-project\src\study-math-high-offline\frontend\src\app\shared\render-utils.ts，
//   study-math-middle-offline / study-math-UNI-offline 共用同一套），
// 它们在这些项目里经历过大量 AI 畸形表达式的实战检验。
// ---------------------------------------------------------------------------

/**
 * 修复一元负号紧跟幂运算的语法/语义问题：-x**2 → -(x**2)。
 *
 * JS 语法要求一元负号与 ** 共存时必须加括号（`-x**2` 直接是 SyntaxError），
 * 而数学上 -x² 意为 -(x²)，所以要把整个幂表达式包起来。
 */
export function fixUnaryPow(expr: string): string {
  let out = expr;
  let guard = 0;
  while (guard++ < 30) {
    let changed = false;
    const idxs: number[] = [];
    for (let i = 0; i < out.length - 1; i++) {
      if (out[i] === '*' && out[i + 1] === '*') idxs.push(i);
    }
    for (const pos of idxs) {
      let bEnd = pos;
      while (bEnd > 0 && out[bEnd - 1] === ' ') bEnd--;
      let bStart = bEnd;
      if (bEnd > 0 && out[bEnd - 1] === ')') {
        let d = 0;
        let j = bEnd - 1;
        for (; j >= 0; j--) {
          if (out[j] === ')') d++;
          else if (out[j] === '(') {
            d--;
            if (d === 0) break;
          }
        }
        if (d !== 0) continue;
        bStart = j;
      } else {
        let j = bEnd - 1;
        while (j >= 0 && /[\w$.]/.test(out[j])) j--;
        bStart = j + 1;
        if (bStart === bEnd) continue;
      }
      let m = bStart - 1;
      while (m >= 0 && out[m] === ' ') m--;
      if (m < 0 || out[m] !== '-') continue;
      let b2 = m - 1;
      while (b2 >= 0 && out[b2] === ' ') b2--;
      const prevCh = b2 < 0 ? '' : out[b2];
      if (!(prevCh === '' || '+-*/(,='.indexOf(prevCh) >= 0)) continue;
      let eStart = pos + 2;
      while (eStart < out.length && out[eStart] === ' ') eStart++;
      let eEnd = eStart;
      if (out[eStart] === '(') {
        let d = 0;
        let j = eStart;
        for (; j < out.length; j++) {
          if (out[j] === '(') d++;
          else if (out[j] === ')') {
            d--;
            if (d === 0) break;
          }
        }
        if (d !== 0) continue;
        eEnd = j + 1;
      } else {
        if (out[eStart] === '-' || out[eStart] === '+') eEnd++;
        while (eEnd < out.length && /[\w$.]/.test(out[eEnd])) eEnd++;
      }
      if (eEnd === eStart) continue;
      out = out.substring(0, m) + '-(' + out.substring(bStart, eEnd) + ')' + out.substring(eEnd);
      changed = true;
      break;
    }
    if (!changed) break;
  }
  return out;
}

/**
 * AI 有时用 t / u 等其他字母作自变量（例如 "2*t/(1+t^2)"）：
 * 表达式不含 x、且只有一个自由单字母变量时，把它改名成 x，即可按 f(x) 求值。
 *
 * 注意：动画表达式里 t 已由渲染器注入为时间变量，此处会把 t 排除在"别名候选"之外，
 * 否则一条只用 t 的曲线会被改写成 x，时间维度就丢了。
 */
export function aliasFreeVar(cleaned: string, keep: string[] = ['t']): string {
  if (/\bx\b/.test(cleaned)) return cleaned;
  const vars = new Set<string>();
  const re = /(?:Math\.)?([a-zA-Z][a-zA-Z0-9_]*)/g;
  let mm: RegExpExecArray | null;
  const reserved = new Set(keep.map((k) => k.toLowerCase()));
  while ((mm = re.exec(cleaned))) {
    if (mm[0].startsWith('Math.')) continue;
    const tok = mm[1];
    if (!/^[a-z]$/i.test(tok)) continue;
    if (reserved.has(tok.toLowerCase())) continue;
    vars.add(tok);
  }
  if (vars.size === 1) {
    const v = Array.from(vars)[0];
    return cleaned.replace(new RegExp('\\b' + v + '\\b', 'g'), 'x');
  }
  return cleaned;
}

/**
 * 把模型写的表达式规整成可安全求值的 JS 表达式。
 *
 * 上面几个坑在同类项目里都踩过并留有解药（见本段开头的来源说明）：
 *   - 上标被写成 HTML（<sup>2</sup>）或 Unicode（x²）；
 *   - 数学幂写成 x^2（JS 需要 x**2）；
 *   - 隐式乘法：2x、2(x+1)、3.5sin(x)；
 *   - 一元负号紧跟幂：-x**2 在 JS 里是语法错误，数学上 -x² = -(x²)，必须补括号；
 *   - 用 u 当自变量：只有一个自由变量时别名成 x（t 除外，它是时间变量）。
 */
export function normalizeExpression(expr: string): string {
  let s = String(expr ?? '');
  s = s.replace(/<sup>([^<]*)<\/sup>/gi, '^($1)').replace(/<[^>]+>/g, '');
  s = s.replace(/²/g, '^2').replace(/³/g, '^3');
  s = s.replace(/\^/g, '**');
  // π 与 Unicode 减号：AI 偶尔写进表达式（π 是合法标识符，但注入不了）
  s = s.replace(/π/g, 'pi').replace(/−/g, '-');
  // 隐式乘法：数字后紧跟字母或左括号（2x / 2(x+1) / 3.5sin(x)）
  s = s.replace(/(\d(?:\.\d+)?)\s*(?=[A-Za-z(])/g, '$1*');
  s = fixUnaryPow(s);
  s = aliasFreeVar(s);
  return s;
}

