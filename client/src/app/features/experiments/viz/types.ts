/**
 * 可视化渲染器基础类型。
 *
 * 设计目标（对齐 架构设计.md 第八节「可视化架构」）：
 * - 每个实验通过 slug 注册一个 VizDefinition，组件按注册表分发，避免巨型 switch。
 * - 渲染器分两类：无状态的 `draw`（参数变化才重绘）与有状态的 `create`（逐帧动画、需要跨帧状态）。
 * - 参数默认值与控件描述内联在定义里，因此即使数据库 params_schema 为空，参数面板也有内容。
 */

/** 可视化参数（键值对，值类型由参数控件决定）。 */
export interface VizParams {
  [key: string]: any;
}

/** 一次绘制所需的全部上下文。 */
export interface VizFrame {
  ctx: CanvasRenderingContext2D;
  /** 逻辑宽度（CSS 像素，已处理高分屏缩放）。 */
  w: number;
  /** 逻辑高度（CSS 像素）。 */
  h: number;
  /** 当前参数（已合并默认值）。 */
  params: VizParams;
  /** 动画时间（秒）；静态渲染器可忽略。 */
  t: number;
}

export type VizDraw = (frame: VizFrame) => void;

/** 渲染实例：由 create() 产出，内部可持有跨帧状态。 */
export interface VizInstance {
  draw(frame: VizFrame): void;
}

export type VizFactory = (params: VizParams) => VizInstance;

/** 参数控件描述，与 param-panel 组件的 ParamConfig 兼容。 */
export interface VizParamSpec {
  type: 'range' | 'select' | 'number';
  min?: number;
  max?: number;
  step?: number;
  default?: number | string;
  options?: string[];
  label?: string;
}

/** 一个实验的可视化定义。`draw` 与 `create` 至少提供一个（create 优先）。 */
export interface VizDefinition {
  /** 实验 slug，与 experiments.slug 一致。 */
  slug: string;
  /** 实验标题，用于占位与调试显示。 */
  title: string;
  /** true 表示需要逐帧动画（会持续 requestAnimationFrame）；默认 false。 */
  animated?: boolean;
  /** 参数控件声明；默认值同时作为渲染初值。 */
  params?: Record<string, VizParamSpec>;
  /** 无状态渲染函数。 */
  draw?: VizDraw;
  /** 有状态渲染工厂（动画类实验使用）。 */
  create?: VizFactory;
}

/** 定义一个可视化（仅用于类型推断，返回原对象）。 */
export function defineViz(def: VizDefinition): VizDefinition {
  return def;
}

/** 读取数值参数（缺失时用 fallback），避免 index signature 的括号访问噪音。 */
export function num(params: VizParams, key: string, fallback: number): number {
  const v = params[key];
  if (v === undefined || v === null || v === '') return fallback;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** 读取字符串参数（用于 select 类型控件）。 */
export function str(params: VizParams, key: string, fallback: string): string {
  const v = params[key];
  return v === undefined || v === null ? fallback : String(v);
}

/** 读取布尔参数。 */
export function bool(params: VizParams, key: string, fallback: boolean): boolean {
  const v = params[key];
  if (v === undefined || v === null || v === '') return fallback;
  if (typeof v === 'boolean') return v;
  return String(v) === 'true' || String(v) === '1';
}
