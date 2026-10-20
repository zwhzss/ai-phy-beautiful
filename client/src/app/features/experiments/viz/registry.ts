import {
  VizDefinition,
  VizInstance,
  VizParamSpec,
  VizParams,
} from './types';

/**
 * 可视化注册表：slug -> VizDefinition。
 * catalog/ 下的模块在导入时调用 registerViz 完成注册。
 */
const registry = new Map<string, VizDefinition>();

/** 注册一个或多个可视化定义；同名 slug 后者覆盖前者。 */
export function registerViz(...defs: VizDefinition[]): void {
  for (const def of defs) {
    registry.set(def.slug, def);
  }
}

/** 取得某个实验的可视化定义（未实现时返回 undefined）。 */
export function getViz(slug: string): VizDefinition | undefined {
  return registry.get(slug);
}

/** 该实验是否已有专属可视化（false 时组件回退到通用占位图）。 */
export function hasViz(slug: string): boolean {
  return registry.has(slug);
}

/** 该实验声明的参数控件；未声明时返回空对象。 */
export function vizSchema(slug: string): Record<string, VizParamSpec> {
  return getViz(slug)?.params ?? {};
}

/** 由参数控件声明推导默认参数值。 */
export function vizDefaultParams(slug: string): VizParams {
  const schema = vizSchema(slug);
  const out: VizParams = {};
  for (const key of Object.keys(schema)) {
    const spec = schema[key];
    out[key] = spec?.default ?? 1;
  }
  return out;
}

/** 合并默认值与外部参数（外部优先），创建渲染实例。 */
export function vizInstance(slug: string, params: VizParams): VizInstance | undefined {
  const def = getViz(slug);
  if (!def) return undefined;

  const merged: VizParams = { ...vizDefaultParams(slug), ...params };
  if (def.create) {
    return def.create(merged);
  }
  if (def.draw) {
    const draw = def.draw;
    return { draw: (frame) => draw({ ...frame, params: merged }) };
  }
  return undefined;
}

/** 已注册的全部 slug（用于覆盖率统计与自检）。 */
export function vizSlugs(): string[] {
  return [...registry.keys()].sort();
}

/** 已注册数量。 */
export function vizCount(): number {
  return registry.size;
}
