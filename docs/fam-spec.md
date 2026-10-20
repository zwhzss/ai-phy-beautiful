# 3D 场景族实现规格（供重写缺失族使用）

## 背景

`client/src/app/features/experiments/three-scene/families/` 下 17 个族文件中，有 10 个此前从未落盘，
`scene-registry.ts` 已按 281 条绑定生成并通过 `tools/verify_bindings.py`，其中 147 条绑定依赖这 10 个族。
现在每个缺失族已生成骨架（`make` + `buildVariant` + 每个 variant 一个 `build_*` 空实现），
任务是把每个 `build_*` 从空壳改成**与该知识点语义匹配**的真 3D 实现。

## 族契约（必须遵守）

```ts
export function make(variant: string, title: string): (ctx: SceneContext) => SceneInstance
```

- `make` 已由骨架生成，**不要改签名**。
- 每个 `build_*(g, bag, THREE, title)` 返回 `(t: number, dt: number) => void`（每帧调用，t 秒）。
- 公共层 `_common.ts` 提供：`scaffold`（星空+网格+标题标签，由 make 调用）、
  `panelSprite(THREE, bag, lines, pos, worldW, align)`（知识面板）、`lineFrom`、`mesh`、
  `canvasTexture`、`titleSprite`、`PAL`（配色）、`ResourceBag`（`bag.geo/mat/tex` 登记，自动 dispose）。
- **所有 geometry/material 必须经 `bag.geo()` / `bag.mat()` 登记**，否则 dispose 泄漏。
- 不要 `scene.add(...)`（scaffold 已建 group）；只往 `g`（Group）里加。
- `title` 是知识点标题，必须在实现里被使用：至少按 `title.includes('关键词')` 做二次分支，
  让同一 variant 承载多个知识点时形态仍然贴合各自标题（参考 `families/biomol.ts:137`、`cosmos.ts:39`）。

## 质量要求（审计口径）

1. **匹配**：画面主体必须直接表达该知识点的物理图像，不能是通用振子/占位；
   面板至少 3 行：核心公式、关键结论、一条读数或对照说明。
2. **教学级近似**可接受，但要在面板注明"示意/教学近似"。
3. 每个 variant 至少 60 行有效实现（含动画循环），禁止 `void` 空壳。
4. 共用同一 variant 的多个知识点，必须靠 `title` 分支区分（形态/读数/公式至少一项不同）。
5. 中文注释、UTF-8 无 BOM、LF 换行；文件顶部 doc 注释列出该族覆盖的知识点编号。

## 参考实现（同目录下已存在的 7 个族，风格对齐）

- `thermal.ts`（曲线面板 makePlot + 粒子分布）
- `mechwave.ts`（行/环几何 + 面板）
- `circuit.ts`（元件示意 + 相量/波形画布）
- `biomol.ts`（title 二次分支范例）
- `rayoptics.ts`（光线几何）、`plasma.ts`（磁面/粒子）、`cosmos.ts`（网格膨胀 + title 分支）

## 待实现族与 variant 清单（10 族 / 125 形态 / 147 绑定）

### oscillator（8 variant，18 绑定）
| variant | 知识点 |
|---|---|
| chaos | P477 拉格朗日方程解双摆 |
| coupled | P479 耦合振子的能量拍 |
| default | P300 转椅与角动量守恒, P298 弹道摆, P04 动量守恒与弹性碰撞, P296 傅科摆, P433 质点系与质心运动定理, P56 混沌双摆, P03 弹簧振子与相图 |
| forced | P469 受迫振动与共振峰, P64 受迫振动与共振 |
| gyro | P480 陀螺进动与章动 |
| lissajous | P468 振动合成与李萨如图形 |
| phasespace | P478 哈密顿方程与相空间, P542 极限环与分岔, P541 相平面与稳定性分析 |
| rotation | P472 角动量守恒的综合应用, P471 转动惯量与平行轴定理 |

### orbit（12 variant，12 绑定）
| variant | 知识点 |
|---|---|
| eclipsebinary | P294 食双星测质量 |
| flyby | P53 引力弹弓 |
| inspiral | P232 双致密天体旋进 |
| kepler | P17 开普勒轨道 |
| lorbit | P55 完全失重与轨道运动 |
| nbody | P19 N 体模拟与星系并合 |
| potential-well | P435 引力势与逃逸速度 |
| schwarzschild | P139 史瓦西轨道与进动 |
| threebody | P18 三体问题 |
| tidal | P52 潮汐力 |
| transfer | P474 变轨与宇宙速度 |
| transit | P281 凌星法搜寻系外行星 |

### fieldlines（12 variant，15 绑定）
conductor P97 / dielectric P438 / dipole P483,P13 / distribution P98 / eddy P304,P482 /
fardisk P302 / gauss P481,P92 / imagecharge P95 / magdipole P441 / multipole P484 /
potential P93 / quadrupole P96

### emwave（7 variant，9 绑定）
cavity P225 / hertz P324 / lasing P527,P43 / maxwell P489,P210 / poynting P490 /
retarded P213 / skin P121

### waveoptics（11 variant，15 绑定）
airy P75 / double-slit P10,P526 / evanescent P83 / fourier P570 / fresnel P445 /
grating P76,P447 / lloyd P313,P312 / poisson P82 / polarization P522 /
single-slit P74,P520 / thinfilm P78

### condensed（19 variant，31 绑定）
band P32,P166,P168,P167,P163 / bragg P524 / composite P381 / crystalgrowth P375,P368 /
defect P165,P369,P374 / diffusion P373 / fermi P164 / ferro P395 / film P388 /
fracture P379 / hall P33,P532 / meissner P329 / phase P376,P365,P377 / plasmon P390 /
pn P464 / polymer P383 / quasicrystal P386 / topo P242,P241,P244 / vortex P385

### quantum（16 variant，35 绑定）
barrier P175,P508,P109,P515 / compton P320,P321 / hydrogen P151,P537 / ladder P110 /
levels P20,P173 / nuclear P177,P172,P171,P179,P459 / qho P108 / qubit P29,P237 /
rabi P519 / raman P525 / spin P511,P598,P111 / sterngerlach P319 / vacuum P253,P251 /
wavepacket P21,P112 / well P507,P506,P107 / zeeman P154,P153,P533

### spacetime（15 variant，16 绑定）
beams P133,P529 / contraction P132 / curvature P575 / dilation P08 / disk P145 /
einsteinring P41 / gwchirp P230 / hawking P143 / kerr P142 / lightcone P127 /
minkowski P134 / penrose P146 / redshift P138 / twins P129 / worldline P135

### fluid（11 variant，16 绑定）
airfoil P70,P69 / cavitation P73 / couette P190 / drag P189 / droplet P191,P193 /
instability P72,P71 / magnus P68 / pipeflow P67,P187 / turbulence P188 /
venturi P437,P66 / vortexstreet P37

### instrument（14 variant，20 绑定）
array P266 / cmb P273 / corona P284 / ct P349,P360 / gwdetector P235,P275 /
michelson P81 / mri P350 / oct P357 / pet P352,P353 / phasecontrast P316 /
resolution P523,P89 / sun P283 / ultrasound P355,P356,P354 / xray P348

## 验收命令

```
node client/node_modules/typescript/bin/tsc -p client/tsconfig.scenes.json --noEmit   # 必须 0 error
python tools/verify_bindings.py                                                        # OK: all bindings resolve
```
