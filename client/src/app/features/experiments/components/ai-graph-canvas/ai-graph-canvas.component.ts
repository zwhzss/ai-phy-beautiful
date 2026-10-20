import {
  AfterViewChecked,
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  signal,
} from '@angular/core';
import { C, circle, dot, equalView, grid, poly, seg, text } from '../../viz/canvas';
import type { View } from '../../viz/canvas';
import { drawAxes3, renderSurface } from '../../viz/surface3d';
import type { VizFrame } from '../../viz/types';
import {
  detectAnimate,
  motionState,
  normalizeAnimatePlan,
  normalizeExpression,
  timeValue,
  usesTimeVar,
} from '../../viz/time-animation';
import type { AnimateConfig, AnimatePlan, ExprFn, MotionElement } from '../../viz/time-animation';

/**
 * 坐标值：可以是数字，也可以是表达式字符串。
 *
 * 字符串允许三种写法：`"$参数名"`（参数联动）、`"cos(t)"` / `"sin(t)"`（时间联动，
 * 图元随时间运动）、以及 `"$num_a / 2 - 0.5"` 这类算式。
 */
export type Coord = number | string;

/** 单个图元。字段值可为数字，或以 "$参数名" / 含 t 的表达式引用。 */
export interface GraphElement extends Partial<MotionElement> {
  type: string;
  from?: [Coord, Coord];
  to?: [Coord, Coord];
  points?: Array<[Coord, Coord]>;
  at?: [Coord, Coord];
  center?: [Coord, Coord];
  w?: number | string;
  h?: number | string;
  r?: number | string;
  fn?: string;
  fromX?: number | string;
  toX?: number | string;
  samples?: number | string;
  closed?: boolean;
  text?: string;
  label?: string;
  size?: number | string;
  /** sequence 图元专用：points=散点（默认）/ bars=柱状 / line=折线 */
  mode?: 'points' | 'bars' | 'line' | string;
  /** sequence 图元的项号范围（from/to 的别名，两个都支持） */
  nFrom?: number | string;
  nTo?: number | string;
  color?: string;
  fill?: string;
  /** 线宽：数字，或 "$参数名" / 算式（走 numeric 求值，见 fieldNum）。 */
  width?: number | string;
  /** 虚线：true=默认虚线；也接受 [实线, 间隔] 数组（兼容模型常见的写法）。 */
  dash?: boolean | number[];
  /** pie 图元专用：分子（填充扇区数），支持 "$参数名" 引用。 */
  numerator?: number | string;
  /** pie 图元专用：分母（总扇区数），支持 "$参数名" 引用。 */
  denominator?: number | string;
  /** pie 图元专用：空白扇区填充色，默认用面板色。 */
  emptyFill?: string;
}

export interface GraphSpec {
  kind?: string;
  axes?: { x?: [number, number]; y?: [number, number] };
  elements?: GraphElement[];
  /** 动画配置（period / tRange / pingpong / enabled）。 */
  animate?: AnimateConfig;
  surface?: {
    fn?: string;
    range?: [number, number];
    resolution?: number;
    palette?: string;
  };
}

/** 3D 曲面的旋转动画帧率。 */
const FRAME_MS = 40;

// ---------------------------------------------------------------------------
// 表达式规整（fixUnaryPow / aliasFreeVar / normalizeExpression）已抽到
// viz/time-animation.ts：一是那里的纯函数可以单测，二是本组件要额外注入
// 时间变量 t，规整逻辑与动画判定放在一起更不易失配。
// ---------------------------------------------------------------------------

/**
 * AI 图形渲染器：把 AI 返回的 graph JSON 画成 2D 图形、3D 曲面或**随时间演化的动画**。
 *
 * 复用项目既有绘图工具（viz/canvas.ts 的 view/seg/poly/circle/text 与 surface3d 的 renderSurface），
 * 支持两类联动：
 *   - 参数联动：图元尺寸与表达式里可直接引用 param-panel 的参数名，参数变化即重绘；
 *   - 时间联动：表达式里可直接写时间变量 t（秒），图元 motion 用参数方程画轨迹与动点，
 *     渲染器逐帧重绘 —— 这是"像内置单摆那样动起来"的关键。
 */
@Component({
  selector: 'app-ai-graph-canvas',
  standalone: true,
  template: `
    <div class="cv-wrap">
      <canvas #cv [width]="width" [height]="height"></canvas>
      <div class="anim-bar" [class.on]="animated()">
        <button type="button" class="anim-btn" (click)="togglePause()" [title]="paused() ? '继续播放' : '暂停'">
          {{ paused() ? '▶ 播放' : '⏸ 暂停' }}
        </button>
        <span class="anim-time">t = {{ timeLabel() }} s</span>
        <button type="button" class="anim-btn" (click)="replay()" title="从头播放">⟲ 重播</button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; background: #1a202c; border-radius: 10px; overflow: hidden; }
    .cv-wrap { position: relative; }
    canvas { display: block; width: 100%; height: auto; }
    /* 用 class 控制显隐而不是 *ngIf：少一层结构指令依赖，组件在任意宿主里都能直接用 */
    .anim-bar {
      display: none;
      position: absolute; right: 10px; bottom: 10px; align-items: center; gap: 0.4rem;
      padding: 0.25rem 0.45rem; border-radius: 8px; background: rgba(26,32,44,0.78);
      border: 1px solid rgba(226,232,240,0.18); font-size: 0.72rem; color: #cbd5e0;
    }
    .anim-bar.on { display: flex; }
    .anim-btn {
      padding: 0.15rem 0.45rem; border-radius: 6px; border: 1px solid rgba(226,232,240,0.25);
      background: rgba(102,126,234,0.22); color: #e2e8f0; cursor: pointer; font-size: 0.72rem;
    }
    .anim-btn:hover { background: rgba(102,126,234,0.4); }
    .anim-time { font-family: Consolas, monospace; color: #90cdf4; min-width: 74px; text-align: center; }
  `],
})
export class AiGraphCanvasComponent implements AfterViewInit, AfterViewChecked, OnChanges, OnDestroy {
  @Input() graph: GraphSpec | string | null = null;
  @Input() params: Record<string, unknown> = {};
  @Input() width = 800;
  @Input() height = 520;
  /**
   * 动画开关：null=按 graph 内容自动判定（默认），false=强制静态，true=强制动画。
   */
  @Input() animate: boolean | null = null;

  // 不用 { static: true }：首次 ngOnChanges 时视图尚未创建，查询根本拿不到元素
  @ViewChild('cv') cv?: ElementRef<HTMLCanvasElement>;

  private timer: ReturnType<typeof setInterval> | null = null;
  private angle = 0.6;
  /**
   * 有渲染需求、但画布还没挂到 DOM 上时置位，由 ngAfterViewChecked 每轮重试。
   *
   * 与数学项目的 graph-scheduler 同一思路：父级 *ngIf 刚展开 / 数据异步到达时，
   * 「渲染时机早于 DOM 挂载」是常态，不能赌一次 setTimeout 就了事。
   */
  private pendingRender = false;
  /** 防止 ngAfterViewChecked 每轮变更检测都触发重绘：只在 pendingRender 为 true 时尝试一次。 */
  private pendingRenderAttempted = false;

  /** 2D 动画的 requestAnimationFrame 句柄。 */
  private raf: number | null = null;
  /**
   * 是否在播放动画（模板据此显示播放/暂停条）。
   *
   * 用信号而不是普通字段：动画状态是在 ngOnChanges / ngAfterViewChecked 的渲染里改的，
   * 普通字段会撞上 ExpressionChangedAfterItHasBeenCheckedError（NG0100），
   * 信号则允许在变更检测过程中更新。
   */
  readonly animated = signal(false);
  /** 是否由用户暂停（暂停时保持画面与相位）。 */
  readonly paused = signal(false);
  /** 当前时间变量 t 的显示值。 */
  readonly timeLabel = signal('0.0');
  /** 帧循环用：上一帧时间戳（毫秒）与累计已播放时长（秒）。 */
  private lastFrameMs = 0;
  private elapsed = 0;
  /** 暂停时保留的相位：恢复播放从它继续。 */
  private pausedElapsed = 0;

  ngAfterViewInit(): void {
    this.render();
  }

  /** 画布尚未挂载时重试（每轮变更检测只做一个布尔判断，无额外开销）。 */
  ngAfterViewChecked(): void {
    if (this.pendingRender && !this.pendingRenderAttempted) {
      this.pendingRenderAttempted = true;
      this.render();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['graph'] || changes['params'] || changes['width'] || changes['height'] || changes['animate']) {
      this.render();
    }
  }

  ngOnDestroy(): void {
    this.stopAnimation();
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.pendingRender = false;
    this.pendingRenderAttempted = false;
  }

  /** 解析 graph（兼容字符串与对象），并绘制；需要时间演化时自动进入逐帧播放。 */
  private render(): void {
    const canvas = this.cv?.nativeElement;
    // 组件可能刚被 *ngIf 展开：元素尚未创建或还未连接进文档。
    // 这时记下待渲染，交给 ngAfterViewChecked 重试，避免整块画布永远空白。
    if (!canvas || !canvas.isConnected) {
      this.pendingRender = true;
      this.pendingRenderAttempted = false;
      return;
    }
    this.pendingRender = false;
    this.pendingRenderAttempted = false;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 任何一次重绘都要先停掉旧的定时器与帧循环，否则参数一拖就会有多个循环同时画
    this.stopAnimation();
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    const spec = this.normalize(this.graph);
    const f: VizFrame = { ctx, w: this.width, h: this.height, params: this.params, t: 0 };

    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, this.width, this.height);

    if (!spec) {
      this.animated.set(false);
      this.hint(ctx, '该实验暂无 AI 图形数据');
      return;
    }

    if (spec.kind === '3d' && spec.surface) {
      this.animated.set(false); // 3D 由下面的定时器持续旋转，不需要时间轴控件
      this.render3D(f, spec, 0);
      return;
    }
    this.render2D(f, spec);
  }

  // ---------------------------------------------------------------- 2D

  private render2D(f: VizFrame, spec: GraphSpec): void {
    const [x0, x1] = spec.axes?.x ?? [-5, 5];
    const [y0, y1] = spec.axes?.y ?? [-5, 5];
    let v: View;
    try {
      // 等比视图：axes 给出的范围完整可见，且 x/y 单位长度完全相等，图形不变形。
      // 以前直接用 view()，x、y 各自拉伸铺满画布：800×520 上画 [-1.5,1.5]² 时
      // y 方向的单位长度只有 x 的 58%，圆会被压成椭圆、角度失真 —— 看起来就是"图形被压扁"。
      // equalView 会以范围中心为中心、按画布比例向外扩展较短的一边
      //（而不是裁掉数据），因此图形不变形、较短方向仍填满画布，多余方向留白。
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      v = equalView(f, cx, cy, Math.abs(x1 - x0) / 2 || 0.5, 46, Math.abs(y1 - y0) / 2 || 0.5);
    } catch {
      this.animated.set(false);
      this.hint(f.ctx as CanvasRenderingContext2D, '图形范围无效（axes 配置有误）');
      return;
    }

    // force 来自 @Input() animate：null 表示按内容自动判定（默认），
    // 这样"模型没写 t 的静态图"不会被误判成动画。
    const plan = normalizeAnimatePlan(spec.animate, this.animate);
    const enabled = detectAnimate(spec, plan);

    const paint = (elapsed: number): void => {
      (f.ctx as CanvasRenderingContext2D).clearRect(0, 0, f.w, f.h);
      (f.ctx as CanvasRenderingContext2D).fillStyle = C.bg;
      (f.ctx as CanvasRenderingContext2D).fillRect(0, 0, f.w, f.h);
      grid(f, v, { divisions: 6, ticks: true });
      for (const el of spec.elements ?? []) {
        try {
          this.drawElement(f, v, el, elapsed, plan);
        } catch {
          /* 单个图元出错不影响其它图元 */
        }
      }
    };

    if (enabled) {
      this.startAnimation(plan, paint);
      return;
    }

    // 静态图：t 取周期起点，一次画完即可
    this.animated.set(false);
    this.paused.set(false);
    this.timeLabel.set('0.0');
    this.elapsed = 0;
    this.pausedElapsed = 0;
    paint(0);
  }

  // ---------------------------------------------------------------- 动画

  /** 启动逐帧播放：每帧把已播放时长换算成时间变量 t 再整幅重绘。 */
  private startAnimation(plan: AnimatePlan, paint: (elapsed: number) => void): void {
    this.animated.set(true);
    this.paused.set(false);
    this.elapsed = 0;
    this.pausedElapsed = 0;
    this.lastFrameMs = 0;
    this.timeLabel.set(timeValue(0, plan).toFixed(1));
    paint(0);

    const step = (ms: number): void => {
      this.raf = requestAnimationFrame(step);
      if (this.paused()) {
        this.lastFrameMs = ms;
        return;
      }
      if (this.lastFrameMs) {
        // 上限 0.25s：切到后台再切回来时 dt 会很大，直接跳一大步看着像卡住
        this.elapsed += Math.min(0.25, Math.max(0, (ms - this.lastFrameMs) / 1000));
      }
      this.lastFrameMs = ms;
      const t = timeValue(this.elapsed, plan);
      this.timeLabel.set(t.toFixed(1));
      paint(this.elapsed);
    };
    this.raf = requestAnimationFrame(step);
  }

  /** 停止帧循环（不改变 animated 标记，由调用方决定界面状态）。 */
  private stopAnimation(): void {
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
    this.lastFrameMs = 0;
  }

  /** 播放 / 暂停。 */
  togglePause(): void {
    if (!this.animated()) return;
    if (this.paused()) {
      this.paused.set(false);
      this.lastFrameMs = 0; // 丢掉暂停期间的时间差，恢复时不跳帧
      return;
    }
    this.paused.set(true);
    this.pausedElapsed = this.elapsed;
  }

  /** 从头播放（相位归零）。 */
  replay(): void {
    if (!this.animated()) return;
    this.elapsed = 0;
    this.pausedElapsed = 0;
    this.lastFrameMs = 0;
    this.paused.set(false);
  }

  /** 供测试与外部读取的当前相位（秒）。 */
  get elapsedSeconds(): number {
    return this.paused() ? this.pausedElapsed : this.elapsed;
  }

  /**
   * 取「样式/结构类标量字段」：线宽、点径、采样数、3D 分辨率、曲面范围…
   *
   * 这些字段以前是 `el.width ?? 2` 直接用原始值，模型写 `"width": "$num_w"` 时
   * canvas 会**静默忽略**（线宽/半径落到默认值，画面上看不出任何差别，也没有提示）。
   * 现在统一走 numeric()：数字原样返回，`$参数名` 与算式都会求值。
   *
   * 这条与后端 `graphInteractiveFields` 的判据是一体两面：服务端把"非展示字段"一律算作
   * 图形联动，那这些字段就必须真的能解析参数 —— 否则会出现"报了已联动、拖了却不变"。
   *
   * @param positive 只接受正数（线宽/点径/采样数 ≤ 0 等于画不出来，退回默认值更合理）
   */
  private fieldNum(v: unknown, fallback: number, elapsed = 0, positive = false): number {
    if (v === undefined || v === null || v === '') return fallback;
    const n = this.numeric(v, elapsed);
    if (!Number.isFinite(n)) return fallback;
    if (positive && n <= 0) return fallback;
    return n;
  }

  private drawElement(f: VizFrame, v: View, el: GraphElement, elapsed = 0, plan?: AnimatePlan): void {
    const n = (x: unknown): number => this.numeric(x, elapsed);
    const p = (pt?: [Coord, Coord]): [number, number] => [n(pt?.[0]), n(pt?.[1])];

    switch (el.type) {
      case 'line': {
        const a = p(el.from);
        const b = p(el.to);
        // 注意：viz/canvas.ts 的 seg() 是**位置参数** (f, x1, y1, x2, y2, color, lw)，
        // 不是选项对象。以前这里传的是对象（还带 `as never` 骗过类型检查），
        // 于是颜色/线宽全部落到默认值 —— 在深色画布上表现为"模型指定的颜色没生效"。
        seg(
          f,
          v.sx(a[0]),
          v.sy(a[1]),
          v.sx(b[0]),
          v.sy(b[1]),
          el.color ?? C.accent,
          this.fieldNum(el.width, 2, elapsed, true),
          el.dash ? (Array.isArray(el.dash) ? el.dash : [6, 4]) : undefined,
        );
        break;
      }
      case 'polyline':
      case 'polygon': {
        const pts = (el.points ?? []).map((q) => [v.sx(n(q[0])), v.sy(n(q[1]))] as [number, number]);
        if (pts.length < 2) break;
        poly(f, pts, {
          stroke: el.color ?? C.accent,
          lw: this.fieldNum(el.width, 2, elapsed, true),
          fill: el.fill,
          close: el.closed ?? el.type === 'polygon',
        });
        break;
      }
      case 'rect': {
        const at = p(el.at);
        const w = n(el.w);
        const h = n(el.h);
        poly(
          f,
          [
            [v.sx(at[0]), v.sy(at[1])],
            [v.sx(at[0] + w), v.sy(at[1])],
            [v.sx(at[0] + w), v.sy(at[1] + h)],
            [v.sx(at[0]), v.sy(at[1] + h)],
          ],
          { fill: el.fill ?? 'rgba(102,126,234,0.25)', stroke: el.color ?? C.accent, lw: this.fieldNum(el.width, 1.6, elapsed, true), close: true },
        );
        // 模型常给 rect 写 label —— 画在矩形正上方居中，避免"写了却没显示"。
        if (el.label) {
          this.clampedText(f, this.interpolate(el.label), v.sx(at[0] + w / 2), v.sy(at[1] + h) - 8, {
            color: C.fg,
            font: '12px system-ui',
            align: 'center',
          });
        }
        break;
      }
      case 'circle': {
        const c = p(el.center);
        circle(f, v.sx(c[0]), v.sy(c[1]), Math.abs(v.sx(c[0] + n(el.r)) - v.sx(c[0])), {
          stroke: el.color ?? C.accent,
          fill: el.fill,
          lw: this.fieldNum(el.width, 2, elapsed, true),
        });
        break;
      }
      case 'pie': {
        // 饼图：将圆等分成 denominator 份，填充前 numerator 份。
        // 支持 "$参数名" 引用，参数变化时自动重绘。
        const c = p(el.center);
        const cx = v.sx(c[0]);
        const cy = v.sy(c[1]);
        const r = Math.abs(v.sx(c[0] + n(el.r)) - v.sx(c[0]));
        const den = Math.max(2, Math.round(n(el.denominator ?? 4)));
        const num = Math.max(0, Math.min(Math.round(n(el.numerator ?? 3)), den));
        const fillClr = el.fill ?? C.accent;
        const emptyClr = el.emptyFill ?? C.panel;
        const strokeClr = el.color ?? C.bg;
        const lw = this.fieldNum(el.width, 2, elapsed, true);
        for (let i = 0; i < den; i++) {
          const a0 = (i / den) * Math.PI * 2 - Math.PI / 2;
          const a1 = ((i + 1) / den) * Math.PI * 2 - Math.PI / 2;
          f.ctx.save();
          f.ctx.beginPath();
          f.ctx.moveTo(cx, cy);
          f.ctx.arc(cx, cy, Math.max(0.1, r), a0, a1);
          f.ctx.closePath();
          f.ctx.fillStyle = i < num ? fillClr : emptyClr;
          f.ctx.fill();
          f.ctx.strokeStyle = strokeClr;
          f.ctx.lineWidth = lw;
          f.ctx.stroke();
          f.ctx.restore();
        }
        // 在饼图中心显示分数文字
        if (el.label) {
          this.clampedText(f, this.interpolate(el.label), cx, cy + 4, {
            color: el.color ?? C.fg,
            font: `${Math.max(12, Math.round(r * 0.35))}px system-ui`,
            align: 'center',
          });
        }
        break;
      }
      case 'curve': {
        const fn = this.compile(el.fn ?? '0', elapsed);
        // 横轴范围兼容多种写法：fromX/toX（推荐）、数字 "from": 0、数组 [0]、"$参数名"
        const a = this.scalar(el.fromX ?? el.at ?? el.from, -3, elapsed);
        const b = this.scalar(el.toX ?? el.to, 3, elapsed);
        // 采样数也可能来自参数（"$num_dense"），加个上限防止参数把曲线画成卡顿。
        const samples = Math.max(2, Math.min(2000, Math.round(this.fieldNum(el.samples, 240, elapsed, true))));
        const pts: Array<[number, number]> = [];
        for (let i = 0; i <= samples; i++) {
          const x = a + ((b - a) * i) / samples;
          const y = fn(x, 0);
          if (Number.isFinite(y)) pts.push([v.sx(x), v.sy(y)]);
        }
        if (pts.length > 1) {
          poly(f, pts, { stroke: el.color ?? C.accent2, lw: this.fieldNum(el.width, 2.2, elapsed, true) });
        }
        break;
      }
      case 'sequence': {
        // 数列专用图元：对通项 fn 在项号 [from, to] 上逐项求值，画成散点 / 柱状 / 折线。
        // 数列（等差、等比、斐波那契…）没法用静态点列表达，模型以前会写空 "points": [] 导致空白。
        const fn = this.compile(el.fn ?? '0', elapsed);
        const from = Math.round(this.scalar(el.fromX ?? el.from ?? el.nFrom, 1, elapsed));
        const to = Math.round(this.scalar(el.toX ?? el.to ?? el.nTo, 10, elapsed));
        const color = el.color ?? C.accent;
        const mode = el.mode ?? 'points';
        const count = to - from + 1;
        if (count <= 0 || count > 400) break; // 防止参数把项数放大到画不动

        const seqPts: Array<[number, number]> = [];
        for (let n = from; n <= to; n++) {
          const y = fn(n, 0);
          if (Number.isFinite(y)) seqPts.push([n, y]);
        }
        if (seqPts.length === 0) break;

        if (mode === 'line') {
          poly(f, seqPts.map(([x, y]) => [v.sx(x), v.sy(y)] as [number, number]), {
            stroke: color,
            lw: this.fieldNum(el.width, 2, elapsed, true),
          });
        } else if (mode === 'bars') {
          const barW = Math.max(2, Math.abs(v.sx(from + 0.5) - v.sx(from)) * 0.9);
          const zeroY = v.sy(0);
          for (const [x, y] of seqPts) {
            const cx = v.sx(x);
            const yVal = v.sy(y);
            poly(
              f,
              [
                [cx - barW / 2, zeroY],
                [cx + barW / 2, zeroY],
                [cx + barW / 2, yVal],
                [cx - barW / 2, yVal],
              ],
              { fill: el.fill ?? color, stroke: color, lw: 1, close: true },
            );
          }
        } else {
          for (const [x, y] of seqPts) {
            dot(f, v.sx(x), v.sy(y), this.fieldNum(el.size, 4.5, elapsed, true), color);
          }
        }
        // 数列名称：画在图元上方，方便对照
        if (el.label) {
          const first = seqPts[0];
          this.clampedText(f, this.interpolate(el.label), v.sx(first[0]), v.sy(first[1]) - 12, {
            color,
            font: '12px system-ui',
            align: 'center',
          });
        }
        break;
      }
      case 'point': {
        const at = p(el.at);
        const px = v.sx(at[0]);
        const py = v.sy(at[1]);
        dot(f, px, py, this.fieldNum(el.size, 5, elapsed, true), el.color ?? C.warm);
        if (el.label) {
          const label = this.interpolate(el.label);
          // 优先画在点的右侧；右边放不下就换到左侧（再由 clampedText 收进画布），
          // 否则靠近右边界或左边界的数据点标注会被画布裁掉。
          const ctx = f.ctx as CanvasRenderingContext2D;
          ctx.save();
          ctx.font = '12px system-ui';
          const width = ctx.measureText(label).width;
          ctx.restore();
          const toRight = px + 10 + width <= f.w - 6;
          this.clampedText(f, label, toRight ? px + 10 : px - 10, py - 8, {
            color: C.fg,
            font: '12px system-ui',
            align: toRight ? 'left' : 'right',
          });
        }
        break;
      }
      case 'text': {
        const at = p(el.at);
        this.clampedText(f, this.interpolate(el.text ?? el.label ?? ''), v.sx(at[0]), v.sy(at[1]), {
          color: this.ensureVisibleColor(el.color),
          font: `${this.fieldNum(el.size, 14, elapsed, true)}px system-ui`,
          align: 'center',
        });
        break;
      }
      case 'motion': {
        // 参数方程动图：x(s)、y(s) 画出轨迹，再把 s 随时间扫过 —— 画出运动的点与拖尾。
        // 这是"像内置单摆那样"的主体：轨道曲线 + 小球 + 摆杆/半径线等辅助线由模型另配 line 图元，
        // 那些 line 的端点写成含 t 的表达式即可与这里同步（例如 "to": ["sin(t)", "-cos(t)"]）。
        const state = motionState(
          el,
          elapsed,
          plan ?? normalizeAnimatePlan(undefined),
          (expr) => this.compile(expr, elapsed, true),
          // span / sFrom / sTo / trail / samples 也支持 "$参数名"：
          // 这些字段的类型本来就是 number | string，以前被 Number() 硬转成默认值。
          (v, fallback) => this.fieldNum(v, fallback, elapsed),
        );
        if (state.curve.length > 1) {
          poly(
            f,
            state.curve.map(([x, y]) => [v.sx(x), v.sy(y)] as [number, number]),
            { stroke: el.color ?? C.accent, lw: this.fieldNum(el.width, 2, elapsed, true) },
          );
        }
        if (state.trail.length > 1) {
          const trailColor = el.fill ?? 'rgba(246,173,85,0.55)';
          for (let i = 1; i < state.trail.length; i++) {
            const [ax, ay] = state.trail[i - 1];
            const [bx, by] = state.trail[i];
            // 越靠近动点越实：用逐段透明度做出拖尾渐隐
            const alpha = Math.round((0.15 + (0.75 * i) / state.trail.length) * 100) / 100;
            // seg() 是位置参数：(f, x1, y1, x2, y2, color, lw)
            seg(f, v.sx(ax), v.sy(ay), v.sx(bx), v.sy(by), this.withAlpha(trailColor, alpha), this.fieldNum(el.size, 3, elapsed, true));
          }
        }
        if (state.point) {
          dot(f, v.sx(state.point[0]), v.sy(state.point[1]), this.fieldNum(el.size, 6, elapsed, true), el.color ?? C.warm);
          if (el.label) {
            this.clampedText(f, this.interpolate(el.label, elapsed), v.sx(state.point[0]) + 12, v.sy(state.point[1]) - 10, {
              color: C.fg,
              font: '12px system-ui',
              align: 'left',
            });
          }
        }
        break;
      }
      default:
        break;
    }
  }

  // ---------------------------------------------------------------- 3D

  private render3D(f: VizFrame, spec: GraphSpec, elapsed = 0): void {
    const surf = spec.surface!;
    const fn = this.compile(surf.fn ?? '0', elapsed);
    const res = Math.max(8, Math.min(64, Math.round(this.fieldNum(surf.resolution, 36, elapsed, true))));
    const rawRange = Array.isArray(surf.range) ? surf.range : [-3, 3];
    const range: [number, number] = [
      this.fieldNum(rawRange[0], -3, elapsed),
      this.fieldNum(rawRange[1], 3, elapsed),
    ];

    // 曲面表达式里也能含时间变量 t（行进波、脉动曲面）：3D 本来就按帧重绘，
    // 只要把已播放时长喂给 compile，形态就会随时间演化。
    const startMs = Date.now();
    const paint = () => {
      (f.ctx as CanvasRenderingContext2D).clearRect(0, 0, f.w, f.h);
      (f.ctx as CanvasRenderingContext2D).fillStyle = C.bg;
      (f.ctx as CanvasRenderingContext2D).fillRect(0, 0, f.w, f.h);
      const scale = Math.min(f.w, f.h) * 0.10;
      const cx = f.w / 2;
      const cy = f.h / 2 + 30;
      drawAxes3(f, this.angle, 0.75, scale, cx, cy, 1.5);
      // renderSurface 的 fn 接收 (u, v) 并返回三维点 [x, y, z]；
      // 这里把 AI 给的标量表达式 z = f(x, y) 包装成曲面函数。
      const surfer = usesTimeVar(surf.fn)
        ? this.compile(surf.fn ?? '0', elapsed + (Date.now() - startMs) / 1000)
        : fn;
      const surfFn = (u: number, v: number): [number, number, number] => [u, v, surfer(u, v)];
      renderSurface(
        f,
        surfFn,
        {
          uMin: range[0],
          uMax: range[1],
          vMin: range[0],
          vMax: range[1],
          uSteps: res,
          vSteps: res,
          scale,
          ay: this.angle,
          ax: 0.75,
          hue: (u: number, v: number) => ((u + v) * 26 + 210) % 360,
          faceAlpha: 0.85,
          wire: true,
        },
        cx,
        cy,
      );
      text(f, `z = ${surf.fn ?? ''}`, 24, 30, { color: C.warm, font: 'bold 15px "Times New Roman", serif' });
    };

    paint();
    this.timer = setInterval(() => {
      this.angle += 0.012;
      paint();
    }, FRAME_MS);
  }

  // ---------------------------------------------------------------- 工具

  /**
   * 预处理 GRAPH JSON 中数组值里的未引用标识符（来自同类项目经验）。
   *
   * AI 常生成形如 `[-1.2*A, 1.2*A]` 的非法 JSON —— A 是物理量参数名，没加引号，
   * JSON.parse 会报 "Expected ',' or ']' after array element"。
   * 这里把 `数字*标识符` / `数字/标识符` 模式转为带引号的字符串，
   * 使 JSON.parse 通过；后续 evalExpression 会把此类字符串当作表达式求值。
   *
   * 只处理数组上下文（[ ... ]），避免误改对象值里的合法字符串。
   */
  private preprocessUnquotedIdExpr(jsonStr: string): string {
    // 匹配数组内：数字后紧跟 * 或 / 再跟标识符，且标识符前后是逗号/括号/边界
    // 例：-1.2*A → "-1.2*A"，0.5/B → "0.5/B"
    return jsonStr.replace(/(\d(?:\.\d+)?)\s*([*/])\s*([A-Za-z_]\w*)(?=[\],\]\}]|$)/g, (_, num, op, id) => {
      return `"${num}${op}${id}"`;
    });
  }

  /** 把 AI 返回的 graph 规整为对象；无法解析时返回 null。 */
  private normalize(g: GraphSpec | string | null): GraphSpec | null {
    if (!g) return null;
    if (typeof g === 'string') {
      try {
        return JSON.parse(g) as GraphSpec;
      } catch {
        // AI 常在数组值里写未引用的标识符（如 [-1.2*A, 1.2*A]），预处理后重试
        const repaired = this.preprocessUnquotedIdExpr(g);
        if (repaired !== g) {
          try {
            return JSON.parse(repaired) as GraphSpec;
          } catch {
            // 仍失败则返回 null，由渲染器显示"暂无图形数据"
            return null;
          }
        }
        return null;
      }
    }
    return g;
  }

  /**
   * 取数字字段：数字直接用；"$参数名" 取参数值；"$参数名 / 2 - 0.5" 这类算式也会求值。
   *
   * 模型经常在坐标里直接写算术（例如 "at": ["$num_a / 2 - 0.5", "-0.8"]）。
   * 以前只认数字或纯 "$参数名"，算式会被当成 0，导致图元全堆到原点附近。
   */
  private numeric(v: unknown, elapsed = 0): number {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v !== 'string') return 0;
    const s = v.trim();
    if (s === '') return 0;

    if (s.startsWith('$')) {
      const expr = s.slice(1).trim();
      const pv = this.params?.[expr];
      if (pv !== undefined && pv !== null) {
        const num = typeof pv === 'number' ? pv : Number(pv);
        if (Number.isFinite(num)) return num;
      }
      // "$num_a / 2" 这类算式：交给表达式求值（参数名与时间变量 t 以形参注入）
      return this.evalExpression(expr, elapsed);
    }

    const num = Number(s);
    if (Number.isFinite(num)) return num;
    return this.evalExpression(s, elapsed);
  }

  /** 用表达式引擎求值（参数名与时间变量 t 注入为形参）；失败返回 0。 */
  private evalExpression(expr: string, elapsed = 0): number {
    const fn = this.compile(expr, elapsed);
    const out = fn(0, 0);
    return Number.isFinite(out) ? out : 0;
  }

  /** 取标量：数组取第一个元素；数字/字符串走 numeric（支持 "$参数名"）；其它用兜底值。 */
  private scalar(v: unknown, fallback: number, elapsed = 0): number {
    if (Array.isArray(v)) {
      return v.length > 0 ? this.numeric(v[0], elapsed) : fallback;
    }
    if (v === undefined || v === null) {
      return fallback;
    }
    if (typeof v === 'number' || typeof v === 'string') {
      return this.numeric(v, elapsed);
    }
    return fallback;
  }

  /**
   * 把标注/文字里的 "$参数名" 替换成当前参数值，并可写 ${表达式}（表达式里能用时间变量 t）。
   *
   * 模型很自然会把参数值写在 point 的 label 或 text 的 text 里（例如 "$num_a"、"和 = $num_a + $num_b"），
   * 以前这里是死文本，参数拖了文字不变 —— 现在会实时替换（未定义的参数名原样保留）。
   * 动画图上还常要显示瞬时量（速度、角度、时间），所以额外支持 ${表达式}：
   *   "label": "θ = ${(theta*180/pi).toFixed(0)}°" 这类写法不做支持，
   *   但 "label": "θ = ${theta}°"、"a = ${-w^2*x}" 会被求值替换。
   */
  private interpolate(s: string, elapsed = 0): string {
    if (!s || !s.includes('$')) {
      return s;
    }
    let out = s;
    if (out.includes('${')) {
      out = out.replace(/\$\{([^}]*)\}/g, (raw, expr: string) => {
        const val = this.evalExpression(expr.trim(), elapsed);
        return Number.isFinite(val) ? String(Math.round(val * 1000) / 1000) : raw;
      });
    }
    return out.replace(/\$([A-Za-z_]\w*)/g, (raw, name: string) => {
      if (name === 't') return String(Math.round(elapsed * 10) / 10);
      const pv = this.params?.[name];
      if (pv === undefined || pv === null) {
        return raw;
      }
      const num = typeof pv === 'number' ? pv : Number(pv);
      if (Number.isFinite(num)) {
        return String(Math.round(num * 1000) / 1000);
      }
      return String(pv);
    });
  }

  /**
   * 编译表达式为 (x, y) => number 的函数。
   *
   * 动画支持：额外注入时间变量 t（秒）。这样 curve.fn 可以写 "2*sin(3*x - 2*t)"
   * 画出行进波，图元的坐标字段也可以写 "$t"、"sin(t)" 让图元随时间运动。
   *
   * 安全约束：先做字符白名单校验，再把数学函数名映射为 Math.xxx 前缀
   * （ES module 是严格模式，不能用 with(Math)）；参数以形参注入，不会访问全局作用域。
   *
   * @param elapsed 当前时间变量 t 的取值（秒）
   * @param keepTime true 时不做「单字母自由变量改名成 x」的兜底（motion 图元的自变量是 s，不是 x）
   */
  private compile(expr: string, elapsed = 0, keepTime = false): ExprFn {
    const raw = normalizeExpression(expr);
    if (!/^[\w+\-*/^().,\s]*$/.test(raw)) return () => NaN;

    const mapped = raw
      .replace(/\b(PI|E|LN2|LN10|SQRT2)\b/g, 'Math.$1')
      .replace(/\b(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|exp|log|log2|log10|sqrt|cbrt|abs|sign|floor|ceil|round|trunc|min|max|pow|hypot)\b/g, 'Math.$1')
      .replace(/Math\.Math\./g, 'Math.');

    const names: string[] = [];
    const values: number[] = [];
    for (const [k, v] of Object.entries(this.params ?? {})) {
      if (!/^[A-Za-z_]\w*$/.test(k)) continue;
      if (mapped.includes(k)) {
        const num = typeof v === 'number' ? v : Number(v);
        names.push(k);
        values.push(Number.isFinite(num) ? num : 0);
      }
    }

    try {
      // 形参顺序固定为 (x, y, t, s, ...参数名)：
      //   x / y   —— 函数图象的自变量与纵向偏移（既有约定）
      //   t       —— 时间变量（秒），动画逐帧变化
      //   s       —— 参数方程的自变量，等价于 x（motion 图元写 s，曲线写 x，二者都能用）
      // 参数名里若恰好有 t / s，会因重复形参报错，这里跳过保留名避免整条表达式失效。
      const reserved = new Set(['x', 'y', 't', 's']);
      const argNames: string[] = [];
      const argValues: number[] = [];
      for (let i = 0; i < names.length; i++) {
        if (reserved.has(names[i])) continue;
        argNames.push(names[i]);
        argValues.push(values[i]);
      }
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const f = new Function('x', 'y', 't', 's', ...argNames, `"use strict"; return (${mapped});`) as (
        x: number,
        y: number,
        t: number,
        s: number,
        ...rest: number[]
      ) => number;
      return (x: number, y = 0) => {
        try {
          const out = Number(f(x, y, elapsed, x, ...argValues));
          return Number.isFinite(out) ? out : NaN;
        } catch {
          return NaN;
        }
      };
    } catch {
      return () => NaN;
    }
  }

  /** 给颜色叠一层透明度（拖尾渐隐用）：支持 #rrggbb 与 rgba()/rgb()。 */
  private withAlpha(color: string, alpha: number): string {
    const a = Math.max(0, Math.min(1, alpha));
    const hex = color.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
    if (hex) {
      const [r, g, b] = [hex[1], hex[2], hex[3]].map((h) => parseInt(h, 16));
      return `rgba(${r},${g},${b},${a})`;
    }
    const rgb = color.match(/^rgba?\(([^)]+)\)$/);
    if (rgb) {
      const parts = rgb[1].split(',').map((p) => p.trim());
      if (parts.length >= 3) return `rgba(${parts[0]},${parts[1]},${parts[2]},${a})`;
    }
    return color;
  }

  /**
   * 检测颜色亮度，背景太暗时自动切换为亮色，避免文字不可见。
   *
   * AI 常给 text 元素写深色（如 #2d3748），在深色画布上几乎看不见。
   * 这里用相对亮度公式判断：低于阈值时替换为前景色。
   */
  private ensureVisibleColor(raw: string | undefined): string {
    if (!raw) return C.fg;
    const m = raw.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
    if (!m) return raw; // 非 hex 颜色（如 rgba）原样返回
    const r = parseInt(m[1], 16);
    const g = parseInt(m[2], 16);
    const b = parseInt(m[3], 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum < 0.4 ? C.fg : raw;
  }

  /**
   * 画文字，并把整段文字收进画布内。
   *
   * 模型给的坐标经常贴着边界（例如 "at": [-1.4, 1.3]），按中心对齐画出去会有一半落在
   * 画布外 —— 学生看到的画面就是"左边的内容被挡住"。这里先按实际字号量出文本宽度：
   * 超出左边就改成左对齐贴左边、超出右边就改成右对齐贴右边；实在比画布还长的文本
   * 交给 fillText 的 maxWidth 横向压缩，保证一定完整可见。
   */
  private clampedText(
    f: VizFrame,
    s: string,
    cx: number,
    cy: number,
    o: { color?: string; font?: string; align?: CanvasTextAlign; baseline?: CanvasTextBaseline },
  ): void {
    if (!s) return;
    const font = o.font ?? '14px system-ui';
    const ctx = f.ctx as CanvasRenderingContext2D;
    ctx.save();
    ctx.font = font;
    const width = ctx.measureText(s).width;
    ctx.restore();

    const pad = 6;
    let align: CanvasTextAlign = o.align ?? 'center';
    let x = cx;
    const left = align === 'center' ? cx - width / 2 : align === 'right' ? cx - width : cx;
    if (left < pad) {
      align = 'left';
      x = pad;
    } else if (left + width > f.w - pad) {
      align = 'right';
      x = f.w - pad;
    }
    // 纵向也要收进画布，否则贴边的说明文字会只露出半行
    const y = Math.min(Math.max(cy, 16), f.h - 4);
    text(f, s, x, y, {
      color: o.color,
      font,
      align,
      baseline: o.baseline,
      maxWidth: Math.max(40, f.w - pad * 2),
    });
  }

  private hint(ctx: CanvasRenderingContext2D, msg: string): void {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = C.dim;
    ctx.font = '15px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(msg, this.width / 2, this.height / 2);
    ctx.textAlign = 'start';
  }
}
