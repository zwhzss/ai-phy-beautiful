/**
 * 可视化模块入口。
 *
 * 导入本模块即完成 catalog 下全部实验渲染器的注册，随后可用
 * getViz(slug) / vizInstance(slug, params) 取用。
 */
import './catalog';

export * from './types';
export * from './registry';
export * from './canvas';
