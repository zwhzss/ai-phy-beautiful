# 专属 3D 场景实现规范（bespoke scenes/*.ts）

> 适用于 `client/src/app/features/experiments/three-scene/scenes/<slug>.ts`。
> 家族场景（`families/`）见 `fam-spec.md`。质量基准参照 `scenes/antenna-pattern.ts`、`scenes/magnetic-field.ts`。

## 1. 契约

```ts
import type { SceneContext, SceneInstance } from '../types';
export function create(ctx: SceneContext): SceneInstance { ... }
```

`ctx = { THREE, scene, camera, renderer, width, height }`；返回 `{ update(t, dt), dispose() }`。
宿主（`scene-host.component.ts`）已提供 rAF 循环、ResizeObserver、OrbitControls、基础光照与相机——**场景文件不要碰相机、不要加光源、不要自己起渲染循环**。

## 2. 资源登记（强制）

每个场景自建四个闭包登记器，`dispose()` 统一释放并 `scene.remove(group)`：

```ts
const geos: { dispose(): void }[] = [], mats: { dispose(): void }[] = [], texs: { dispose(): void }[] = [];
const geo = <T extends { dispose(): void }>(g: T): T => { geos.push(g); return g; };
const mat = <T extends { dispose(): void }>(m: T): T => { mats.push(m); return m; };
const tex = <T extends { dispose(): void }>(x: T): T => { texs.push(x); return x; };
```

所有 `new THREE.XxxGeometry()` 必须过 `geo(...)`，所有 `new THREE.XxxMaterial()` 必须过 `mat(...)`，所有 `CanvasTexture` 必须过 `tex(...)`。`GridHelper` 的 geometry 与 material 也要登记。

**绝对不要**把 `Object3D`（如 `ArrowHelper`）当作 material 传给 `new THREE.Mesh/Line`——会在渲染器 `getParameters` 里抛 `material.customProgramCacheKey is not a function`。

## 3. 画面必须表达该知识点的真实物理

这是上一轮审计的最大教训：20 个 instrument 知识点绑到了只画"中心球 + 环绕小球"的通用模板，语义完全错位。硬性要求：

- **几何由公式驱动**。写出该知识点的核心关系式，用 JS 实现，让参数变化真实改变几何（如 `antenna-pattern.ts` 的 `AF(ψ)=sin(Nψ/2)/sin(ψ/2)` 直接生成方向图曲面顶点）。查表/近似常数可以，但曲线形状必须来自计算。
- **`update(t, dt)` 必须扫描自变量**，让"结论随条件改变"看得见：周期建议 12–20s，扫过能体现物理转折的区间（如 `d` 从 0.5λ 推到 λ 以露出栅瓣）。
- **数值自洽**：面板上显示的数字必须与画面几何同源（同一个变量算出来的），不能各写一套。
- **量级正确**：涉及真实常数时用归一化单位，但比例关系不能错（超光速的几何、方向反了的矢量都算错）。

## 4. 读数面板

用 `CanvasTexture` + `Sprite` 画一块信息板，固定三段式：

1. 白色：核心公式（含变量定义）
2. 青色/紫色：一条推论或量级估计
3. `#fbbf24` 黄色「读数：」行：随动画刷新的实时数值

`update` 里按 **5Hz** 重绘（`if (Math.floor(t*5) !== Math.floor((t-dt)*5)) drawInfo();`），不要每帧重绘。画布建议 `512×256` 起，`font` 用 `27px "PingFang SC", sans-serif`，中文直接写。

## 5. 脚手架

- 星野：500 点 `Points`，范围 ±200，白色 `size: 0.3`
- 地面：`new THREE.GridHelper(24, 24, 0x334155, 0x1e293b)`
- 主体放在 `const group = new THREE.Group(); scene.add(group);` 里，世界尺度控制在 ±5 内以便 OrbitControls 默认距离观察
- 配色沿用：青 `0x22d3ee`、绿 `0x22c55e`、紫 `0xa855f7`、粉 `0xf472b6`、金 `0xfbbf24`、红 `0xef4444`、slate 文字 `#94a3b8`

## 6. 注册

由统一负责人在 `scene-registry.ts` 追加，实现代理**不要改注册表**（避免并发写冲突）：

```ts
reg('<slug>', () => import('./scenes/<file>'));
```

## 7. 自检

```bash
cd client && npx tsc -p tsconfig.scenes.json --noEmit
```

必须 0 错误。运行时验证由统一负责人用 iframe 遍历器批量跑（进页面 → 点「◈ 3D 沉浸场景」→ 检查 `app-scene-host canvas` 挂载 + 捕获 console 错误）。
