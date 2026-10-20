import type * as THREE from 'three';

/**
 * 3D 场景统一接口（《架构设计.md》§6.2 L2 沉浸层）。
 * 场景文件由 scene-registry 按 slug 动态 import —— three 只在首次进入 3D 时加载。
 */
export interface SceneContext {
  THREE: typeof THREE;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  /** 场景根容器尺寸（CSS 像素） */
  width: number;
  height: number;
}

export interface SceneInstance {
  /** 每帧调用；t 为秒，dt 为帧间隔秒 */
  update(t: number, dt: number): void;
  /** 释放几何体/材质/纹理等 GPU 资源 */
  dispose(): void;
}

export type SceneFactory = (ctx: SceneContext) => SceneInstance;
export type SceneLoader = () => Promise<{ create: SceneFactory }>;
