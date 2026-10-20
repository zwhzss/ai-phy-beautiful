import type * as THREE from 'three';
import type { SceneContext, SceneInstance } from '../types';

/**
 * 场景族公共工具（families/_common.ts）
 *
 * 所有 `families/<族>.ts` 模块统一导出：
 *   export function make(variant: string, title: string): (ctx: SceneContext) => SceneInstance
 * 即 `make` 返回一个 SceneFactory，由 scene-registry 按 slug 绑定调用。
 *
 * 约定：
 *  - 每个族至少渲染：星空背景 + 地面网格 + 知识点标题标签（titleSprite）
 *  - variant 未命中时回退到该族的 'default' 分支，禁止抛错
 *  - dispose() 必须释放本模块创建的全部 geometry / material / texture
 */

export type SceneFactory = (ctx: SceneContext) => SceneInstance;
export type FamilyMake = (variant: string, title: string) => SceneFactory;

/** 可收集的 GPU 资源，方便统一 dispose */
export class ResourceBag {
  private geos: { dispose(): void }[] = [];
  private mats: { dispose(): void }[] = [];
  private texs: { dispose(): void }[] = [];

  geo<T extends { dispose(): void }>(g: T): T { this.geos.push(g); return g; }
  mat<T extends { dispose(): void }>(m: T): T { this.mats.push(m); return m; }
  tex<T extends { dispose(): void }>(t: T): T { this.texs.push(t); return t; }

  /** 遍历整棵子树，收集并释放 geometry / material / texture */
  trackTree(root: THREE.Object3D): void {
    root.traverse((obj: THREE.Object3D) => {
      const anyObj = obj as unknown as {
        geometry?: { dispose(): void };
        material?: { dispose(): void } | { dispose(): void }[];
      };
      if (anyObj.geometry) this.geo(anyObj.geometry);
      const m = anyObj.material;
      if (Array.isArray(m)) m.forEach((x) => this.mat(x));
      else if (m) this.mat(m);
    });
  }

  dispose(): void {
    this.geos.forEach((g) => g.dispose());
    this.mats.forEach((m) => m.dispose());
    this.texs.forEach((t) => t.dispose());
    this.geos = []; this.mats = []; this.texs = [];
  }
}

/** 星空背景（返回 Points，调用方自行 add 到 scene/group） */
export function makeStars(
  THREE: typeof import('three'),
  bag: ResourceBag,
  count = 500,
  radiusMin = 20,
  radiusMax = 70,
): import('three').Points {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = radiusMin + Math.random() * (radiusMax - radiusMin);
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph);
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const geo = bag.geo(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = bag.mat(new THREE.PointsMaterial({ color: 0xc7d2fe, size: 0.2, sizeAttenuation: true }));
  return new THREE.Points(geo, mat);
}

/** 地面网格 */
export function makeGrid(
  THREE: typeof import('three'),
  bag: ResourceBag,
  y = -0.6,
  size = 24,
  div = 24,
): import('three').GridHelper {
  const g = bag.mat(new THREE.MeshBasicMaterial({ visible: false }));
  void g;
  const grid = new THREE.GridHelper(size, div, 0x334155, 0x1e293b);
  grid.position.y = y;
  bag.trackTree(grid);
  return grid;
}

/** 画布 → 贴图 */
export function canvasTexture(
  THREE: typeof import('three'),
  bag: ResourceBag,
  draw: (c: CanvasRenderingContext2D, w: number, h: number) => void,
  w = 512,
  h = 128,
): import('three').CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!;
  draw(c, w, h);
  const tex = bag.tex(new THREE.CanvasTexture(cv));
  tex.needsUpdate = true;
  return tex;
}

/** 知识点标题标签（billboard 精灵，居中置于场景上方） */
export function titleSprite(
  THREE: typeof import('three'),
  bag: ResourceBag,
  title: string,
  color = '#f8fafc',
  pos: [number, number, number] = [0, 5.2, 0],
  worldW = 8,
): import('three').Sprite {
  const tex = canvasTexture(THREE, bag, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.font = 'bold 56px "PingFang SC", "Microsoft YaHei", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = 'rgba(7,11,20,0.55)';
    const tw = Math.min(w - 20, c.measureText(title).width + 48);
    roundRect(c, (w - tw) / 2, h / 2 - 44, tw, 88, 20);
    c.fill();
    c.fillStyle = color;
    c.fillText(title, w / 2, h / 2 + 2, w - 48);
  }, 1024, 128);
  const mat = bag.mat(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  const sp = new THREE.Sprite(mat);
  const aspect = 1024 / 128;
  sp.scale.set(worldW, worldW / aspect, 1);
  sp.position.set(pos[0], pos[1], pos[2]);
  sp.renderOrder = 999;
  return sp;
}

/** 多行说明标签（用于图例 / 参数读数） */
export function panelSprite(
  THREE: typeof import('three'),
  bag: ResourceBag,
  lines: { text: string; color?: string }[],
  pos: [number, number, number],
  worldW = 5.6,
  align: 'left' | 'center' = 'left',
): import('three').Sprite {
  const w = 640;
  const lineH = 54;
  const h = Math.max(72, lines.length * lineH + 36);
  const tex = canvasTexture(THREE, bag, (c) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(7,11,20,0.72)';
    roundRect(c, 4, 4, w - 8, h - 8, 18);
    c.fill();
    c.strokeStyle = 'rgba(51,65,85,0.9)';
    c.lineWidth = 3;
    roundRect(c, 4, 4, w - 8, h - 8, 18);
    c.stroke();
    c.font = '34px "PingFang SC", "Microsoft YaHei", sans-serif';
    c.textBaseline = 'middle';
    lines.forEach((ln, i) => {
      c.fillStyle = ln.color ?? '#cbd5e1';
      const y = 30 + lineH * i + lineH / 2;
      if (align === 'center') {
        c.textAlign = 'center';
        c.fillText(ln.text, w / 2, y, w - 44);
      } else {
        c.textAlign = 'left';
        c.fillText(ln.text, 26, y, w - 52);
      }
    });
  }, w, h);
  const mat = bag.mat(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  const sp = new THREE.Sprite(mat);
  sp.scale.set(worldW, (worldW * h) / w, 1);
  sp.position.set(pos[0], pos[1], pos[2]);
  sp.renderOrder = 998;
  return sp;
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** 族模块标准样板：公共背景 + 自定义主体 + 标准 dispose */
export function scaffold(
  ctx: SceneContext,
  opts: {
    title: string;
    build: (g: import('three').Group, bag: ResourceBag) => (t: number, dt: number) => void;
    camera?: [number, number, number];
    stars?: number;
  },
): SceneInstance {
  const { THREE, scene } = ctx;
  const bag = new ResourceBag();
  const group = new THREE.Group();
  scene.add(group);

  const stars = makeStars(THREE, bag, opts.stars ?? 500);
  scene.add(stars);
  const grid = makeGrid(THREE, bag);
  group.add(grid);
  group.add(titleSprite(THREE, bag, opts.title));

  const tick = opts.build(group, bag);
  if (opts.camera) ctx.camera.position.set(...opts.camera);

  return {
    update(t, dt) {
      tick(t, dt);
      stars.rotation.y = t * 0.004;
    },
    dispose() {
      bag.dispose();
      scene.remove(group);
      scene.remove(stars);
    },
  };
}

/** 便捷：把若干点组成 Line 并登记 */
export function lineFrom(
  THREE: typeof import('three'),
  bag: ResourceBag,
  pts: import('three').Vector3[],
  color: number,
  dashed = false,
): import('three').Line {
  const geo = bag.geo(new THREE.BufferGeometry().setFromPoints(pts));
  const mat = dashed
    ? bag.mat(new THREE.LineDashedMaterial({ color, gapSize: 0.25, dashSize: 0.35 }))
    : bag.mat(new THREE.LineBasicMaterial({ color }));
  const ln = new THREE.Line(geo, mat);
  if (dashed) ln.computeLineDistances();
  return ln;
}

/** 便捷：圆柱/球体登记 */
export function mesh<T extends import('three').Mesh>(
  bag: ResourceBag,
  m: T,
): T {
  bag.geo(m.geometry);
  const mm = m.material;
  if (Array.isArray(mm)) mm.forEach((x) => bag.mat(x));
  else bag.mat(mm);
  return m;
}

/** variant 回退：未命中返回 fallback */
export function pick<T>(table: Record<string, T>, variant: string, fallback: string): T {
  return table[variant] ?? table[fallback];
}

/** 常用调色 */
export const PAL = {
  amber: 0xf59e0b,
  cyan: 0x06b6d4,
  green: 0x22c55e,
  red: 0xef4444,
  blue: 0x3b82f6,
  pink: 0xf472b6,
  violet: 0x8b5cf6,
  slate: 0x94a3b8,
  gold: 0xfbbf24,
  white: 0xe2e8f0,
};
