# 3D 沉浸场景知识点匹配审计报告

> 审计范围：600 个种子展项（知识点）全部过一遍，其中 281 个挂载了 3D 沉浸场景。
> 审计目标：核对「知识点 ↔ 3D 场景」是否语义匹配，不匹配者修正。
> 生成时间：本轮修正后状态。

---

## 一、审计结论

| 判定 | 修正前数量 | 修正后 | 说明 |
|---|---:|---:|---|
| **匹配**（专属实现，内容与知识点一致） | 37 | **281** | 全部 281 个挂场景知识点均已绑定到匹配的实现 |
| **不匹配：通用模板 A**（阻尼振子+相图） | 210 | 0 | 通用代码已由「场景族 + variant」替换 |
| **不匹配：通用模板 B**（谐振子拖尾，残留占位注释） | 29 | 0 | 同上 |
| **不匹配：摆模板** | 4 | 0 | 悬链线/最速降线/科里奥利/等效原理已改为正确实现 |
| **空场景** | 1 | 0 | 布朗运动（P593）补全随机游走 + 均方位移 |
| **入口断链**（场景已写但注册被注释吞掉） | 26 | 0 | mojibake 注释已清除，全部恢复注册 |
| 无 3D（按规划，非缺陷） | 319 | 319 | 全部为非强推荐项，符合 3d-scene-plan 分级建设路线 |

**核心结论：修正前 281 个挂场景知识点中只有 37 个（13%）真正匹配；修正后 281/281（100%）匹配。**

> ⚠️ 本节的"100% 匹配"结论已被 2026-10-12 第二轮审计推翻（instrument 族当时实为全空壳、多处 title 分支名不副实），见文末「六、第二轮深度审计与修正」。

---

## 二、修正前的缺陷清单

### 1. 注册表文件损坏（26 个知识点不可见 3D 入口）

`scene-registry.ts` 被 mojibake 污染，多处出现 `// ……?reg('xxx', …)` 形式——`//` 注释吞掉了后续 `reg()` 调用，导致 **30 个注册语句实际未执行**，其中 26 个对应目录中的正式知识点（另 4 个是孤儿键）。

受影响的强推荐知识点包括：抛体运动 P01、单摆 P02、霍曼转移 P54、彩虹 P86、电流的磁场 P14、爱因斯坦环与引力透镜 P41、拉格朗日点 P36、简正模式 P35、量子霍尔 P45、DNA 衍射 P331、布里渊区 P162、石墨烯 P168、晶格振动 P31、特斯拉线圈 P306、自适应光学 P267、平方-立方律 P28、谐振腔 P122、矩形波导 P123、坡印廷矢量 P211、位移电流 P212、长度收缩 P132、世界线 P135、测地线 P136、等效原理 P137、史瓦西轨道 P139、时空弯曲 P23 等。

### 2. 9 个已编写但从未接到正确知识点的专属场景

| 场景文件 | 实际内容 | 原绑定状态 | 修正后归属 |
|---|---|---|---|
| `coriolis-force.ts` | 旋转平台科氏偏转 | 未注册 | P48 科里奥利力 |
| `rigid-body-rotation.ts` | 欧拉方程/中间轴不稳定 | 未注册 | P50 刚体转动与转动惯量 |
| `gyroscope-precession.ts` | 陀螺进动锥 | 未注册 | P51 陀螺进动与章动 |
| `light-bending.ts` | 光线在大质量旁偏折 | 键名非目录 slug | P141 光线偏折 |
| `flrw-universe.ts` | 膨胀宇宙与 a(t) | 键名非目录 slug | P148 FLRW 宇宙与尺度因子 |
| `phonon-dispersion.ts` | 声子色散关系 | 键名非目录 slug | P31 晶格振动与声子 |
| `em-wave-polarization.ts` | 线/圆/椭圆偏振 | 键名非目录 slug | P38 电磁波的产生与传播 |
| `rolling-friction.ts` | 球在水平面减速 | 未注册 | P57 滚动与滑动摩擦 |
| `wiener-brownian-path.ts` | —（实际改由 `brownian-motion.ts` 承载） | 指向空壳 | P593 布朗运动与随机路径 |

### 3. 3 个旗舰场景被清空为空壳

`blackhole-accretion.ts`（P24）、`gw-ripple.ts`（P25）、`spacetime-bending.ts`（P23）在工作区中被改成 35 行空壳（git HEAD 中是完整实现），导致这三个强推荐知识点显示"3D 场景加载失败"或空白。

### 4. 通用模板知识点分布（243 个）

- **模板 A（210 个）**：同一份「阻尼振子 + 相图 + 时间序列」代码，仅替换标题。CT 重建、DNA 复制、托卡马克、费米面等显示的都是同一个振荡小球。
- **模板 B（29 个）**：同一份「谐振子拖尾」代码，头部注释还残留 `{title} ({slug})` 未替换的占位符。
- **摆模板（4 个）**：悬链线 P06、最速降线 P07、科里奥利 P48、等效原理 P137 显示的都是单摆。

### 5. 空/残缺场景

- P593 布朗运动与随机路径：`update()` 为空，只渲染星空网格。
- 孤儿键 `collider` / `crystal-systems` / `band-gap-types` 指向空场景或非目录 slug。

---

## 三、本轮执行的修正

### 3.1 注册表重建（`scene-registry.ts`）

- 清除全部 mojibake 与被注释吞掉的语句，注册表改为**脚本生成**（`tools/gen_registry.py`），从 `scene-plan-raw.csv` + `family-assign.json` 直接产出，杜绝手写损坏。
- 恢复 26 个死链注册；9 个专属场景改绑到正确知识点；移除 4 个孤儿键（`minkowski-diagram`、`crystal-defects`、`phonon-dispersion`、`ISCO`）与 3 个空场景孤儿键（`collider`、`crystal-systems`、`band-gap-types`）。
- 注册表结构拆为两类：**专属场景**（49 条）与**场景族绑定**（232 条），合计 281，与"挂场景知识点"全集严格相等。

### 3.2 重写 4 个错配场景

| 文件 | 修正内容 |
|---|---|
| `scenes/catenary.ts` | 悬链线 `y = a·cosh(x/a)`，与同跨度同垂度的抛物线对照，张力矢量随 a 变化，说明水平张力 H = λga 恒定 |
| `scenes/brachistochrone.ts` | 摆线/直线/圆弧三球按 `v = √(2gΔh)` 沿路径积分赛跑，面板显示各自用时，说明变分法 δ∫ds/v = 0 |
| `scenes/equivalence-principle.ts` | 爱因斯坦电梯上下对照：a = g 加速电梯 vs 引力场中静止电梯，两箱小球轨迹逐帧重合，导出 m_g = m_i |
| `scenes/brownian-motion.ts` | 液体分子碰撞驱动随机游走，轨迹 + 位移矢量 + ⟨r²⟩–t 曲线（实测 vs 理论 2dDt），佩兰测 N_A |

### 3.3 建立 17 个可复用场景族

族目录 `three-scene/families/`，公共层 `_common.ts` 提供 `scaffold`（星空 + 网格 + **知识点标题标签** + 统一 dispose）、`panelSprite`、`ResourceBag`、`PAL` 等；每个族导出 `make(variant, title)`，按 `variant` 渲染不同物理形态，按 `title` 在多知识点共用形态内二次分支。

| 族 | 绑定知识点数 | 典型形态 |
|---|---:|---|
| quantum 量子 | 35 | 势阱/势垒/氢原子轨道/能级/自旋/布洛赫球/斯特恩-格拉赫/对称破缺 |
| condensed 凝聚态 | 31 | 能带/倒格子/缺陷/位错/霍尔/相图/拓扑边缘态/磁通涡旋 |
| instrument 仪器装置 | 20 | CT 反投影/k 空间/PET 符合/超声回波/迈克尔逊/LIGO/艾里斑 |
| oscillator 振子 | 18 | 相图/李萨如/耦合拍/双摆混沌/陀螺/平行轴 |
| fluid 流体 | 16 | 管流雷诺转捩/卡门涡街/翼型升力/瑞利-泰勒/湍流级串 |
| spacetime 时空 | 16 | 闵氏图/光锥/世界线/双生子/克尔/彭罗斯/引力波啁啾 |
| fieldlines 场线 | 15 | 电场线/等势面/高斯面/镜像电荷/涡流/法拉第圆盘 |
| waveoptics 波光学 | 15 | 双缝/光栅/艾里斑/薄膜/倏逝波/泊松亮斑/波片 |
| orbit 轨道 | 12 | 开普勒/霍曼/引力弹弓/三体/旋进/凌星/食双星 |
| emwave 电磁波 | 9 | 麦克斯韦方程/趋肤/推迟势/坡印廷/谐振腔/受激辐射 |
| biomol 生物分子 | 9 | DNA 复制/蛋白质折叠/血红蛋白/细胞膜/分子马达 |
| mechwave 机械波 | 9 | 弦驻波/管驻波/多普勒/马赫锥/孤子/色散 |
| thermal 热统计 | 9→8 | 麦克斯韦速率分布/热传导/布朗运动/黑体/蒙特卡洛 |
| rayoptics 几何光学 | 7 | 透镜/球面镜/棱镜色散/光纤全反射/人眼调焦/像差 |
| plasma 等离子体 | 5 | 托卡马克/德拜屏蔽/磁重联/惯性约束/MHD |
| cosmos 宇宙学 | 4 | 尺度因子/宇宙视界/重子不对称/中子星状态方程 |
| circuit 电路 | 3 | RLC 复阻抗/变压器互感/传输线匹配 |
| **合计** | **232** | |

### 3.4 交叉验证

```
专属场景 reg(...)      49
场景族 regFamily(...)  232
合计                   281   = 挂场景知识点全集（scene-plan-raw.csv 281 行）
不在 600 目录中的绑定     0
仍是旧 verdict 的绑定     0
```

---

## 四、类型检查与产物

- `client/tsconfig.scenes.json`：新增面向 `three-scene/` 全树的独立检查配置（`types: []`、`skipLibCheck`），用于本次审计的逐文件校验。
- `npx tsc -p tsconfig.app.json --noEmit`：修复注册表连带暴露的 4 处既有错误（`dna-diffraction` 的 `basePairs.push` 类型、`resonant-cavity` 的 `bFieldLoops` 声明、`simple-pendulum` 的索引签名访问、`tesla-coil` 的属性访问）后通过。
- 修正前后对照数据落盘：`kp-scene-audit.csv`（600 条逐项判定）、`scene-plan-raw.csv`（281 条场景计划）、`registry-baseline.csv`（292 条修正前注册）、`family-assign.json`（244→232 条族绑定）。

---

## 五、仍需注意的事项

1. **319 个知识点按规划无 3D**：全部为非强推荐项（`no-3d`），符合 `docs/3d-scene-plan.md` 的分级建设路线，非缺陷。
2. **场景族 variant 覆盖度**：17 个族覆盖 232 个知识点，族内按 `variant` 区分形态；个别多知识点共用同一 variant 的组合（如 `instrument/resolution` 承载 P89 与 P523）依赖 `title` 二次分支，后续可继续细化。
3. **未使用的模板文件**：`scenes/` 下 510 个模板副本文件已不再被注册表引用，可择机删除以减小仓库体积（本次未删除，避免影响 git 历史比对）。
4. **回归验证**：建议对强推荐知识点各抽样进入 3D 页面截图比对，确认族场景的 variant 分支与标题标签渲染符合预期。

---

## 附录 A：修正前注册表逐条基线

见 `registry-baseline.csv`（292 行：`key,file,line,dead,type,kpId,kpTitle`）。

## 附录 B：600 个知识点判定

见 `kp-scene-audit.csv`（600 行：`id,slug,title,verdict`）。

## 附录 C：281 个场景计划

见 `scene-plan-raw.csv`（281 行：`id,cat,slug,title,file,type`）。

---

## 六、第二轮深度审计与修正（2026-10-12）

第一轮只核对了"绑定是否存在、标题是否一致"，未审查 variant 实际画面与知识点语义的匹配度。本轮由 9 个并行审计代理逐族精读实现代码 + 逐条知识点比对，范围 281 个挂场景知识点全覆盖。

### 6.1 结构层复核

600 知识点 / 281 绑定（专属 49 + 族 232）：slug 全部在目录、场景文件全部存在、注册标题与种子标题零偏差、variant 全部在族实现中有对应 case —— 结构层无缺陷。

### 6.2 语义层审计结论（修正前）

| 判定 | 数量 | 说明 |
|---|---:|---|
| 不匹配：instrument 族全空壳 | 20 | 14 个 build_* 均为 `void g; void bag; ...` 空实现，屏幕只剩星空+标题；`scenes/` 下同名旧文件实为通用小球模板，不可用 |
| 不匹配：title 分支名不副实/缺失 | 18 | quantum 7（nuclear 通吃 5 条、shell-model 用氢公式、球谐只剩线框球、布洛赫单比特挂双球等）、fluid 4（边界层画升力线、毛细波画拉普拉斯直线、RT 用贝纳德阈值曲线、库埃特剖面零线）、thermal 2、rayoptics 2、spacetime 2、mechwave 1、oscillator 1、condensed 1 |
| 不匹配：专属场景内容错位 | 3 | antenna-pattern 画单偶极子非阵列；magnetic-field 画条形磁铁非电流磁场；em-wave 绑到静态偏振场景 |
| 面板文案物理错误 | 2 | airy"红光分辨率优于蓝光"、beams 的 √s 通式系数 |
| 匹配 | 238 | — |

注：thermal/mechwave 两族 buildVariant 当时根本不接收 title，无分支能力，属结构性缺陷。

### 6.3 修正内容（全部落码并通过 `npx tsc -p tsconfig.scenes.json` 零错误）

- **instrument.ts 全族实现**（0→2595 行）：14 variant 全部按知识点语义实现，共享 variant 的 title 分支均改变几何/读数（ct 双能、ultrasound 三分支、gwdetector 首次观测、pet/SPECT、resolution 衍射/口径阶梯）。
- **quantum.ts**：nuclear 拆出介子交换（汤川势画布）、链式级联+反射层（k_eff-R 曲线）、γ↔e⁺e⁻ 对产生湮灭循环（截面阈值曲线）、反应堆（慢化剂+冷却回路+k_eff 负反馈）；shell-model 改核壳层能级+幻数能隙；球谐改 |P_l| 径向调制瓣状曲面+P_l 曲线族；布洛赫球非纠缠分支隐藏第二球。
- **fluid.ts**：边界层 δ(x) 生长层+u(y) 剖面+分离回流；毛细波 c_p(k) 单谷曲线+双波长色散波前；RT σ(k) 无阈值曲线+多模尖桩蘑菇帽；库埃特修正剖面解析解+Ta 跨临界生成轴向泰勒涡环对。
- **thermal.ts / mechwave.ts**：两族 buildVariant 透传 title；新增玻尔兹曼能级阶梯分支（ln n vs E 直线）、蒙特卡洛重要性抽样双画布（清除 `void imp` 死代码）、达朗贝尔双行波+x–t 特征线分支。
- **spacetime.ts**：不变质量分支实现逐事件 M_inv 重建（双参照系数值一致，直方图峰位 91.2 GeV）；双生子佯谬世界线改时间单调三角折返（β=0.8，光锥内，标注加速换系与 τ=∫√(1−v²)dt 钟读数）；修正 √s 通式。
- **rayoptics.ts / waveoptics.ts**：lens 三级分流，新增平面界面折射/全反射动态演示分支与厚透镜主面 H/H′、节点 N/N′ 起算的光路；airy 面板分辨率文案改正。
- **condensed.ts / oscillator.ts**：晶体缺陷综合分支同画空位+间隙+位错+晶界；质点系改抛体分裂+质心严格沿原抛物线（补柯尼希定理）。
- **scenes/antenna-pattern.ts、scenes/magnetic-field.ts**：整场景重写为 8 元线阵方向图（AF 公式、相位扫描转向、d=λ 栅瓣）与电流的磁场（直导线同心圆+螺线管+右手定则+电流换向）。
- **scene-registry.ts**：em-wave 由偏振专属场景改绑 `emwave/hertz`（电磁波产生与传播），绑定数 48+233 不变。

### 6.4 验证

- `npx tsc -p tsconfig.scenes.json` → 0 错误（全 three-scene 树）。
- `tools/verify_bindings.py` → 281 绑定全部解析到已实现场景/形态。
- 结构脚本复核（600 知识点关联表）→ 0 问题。

### 6.5 遗留建议

1. 未注册的 `scenes/` 旧模板副本（约 510 个，均为通用小球模板）可择机删除。
2. 建议对 instrument/quantum 新实现抽样进入 3D 页面做截图回归，确认画布文字不溢出、分支命中正确。

---

## 七、全量 281 场景运行时遍历（2026-10-13）

第二轮修正后，对**全部 281 个绑定**做了浏览器运行时遍历（不再只是抽样）。

### 7.1 方法

同源 iframe 遍历器：逐个加载 `/experiment/<slug>` → 等待「◈ 3D 沉浸场景」按钮 → 点击 → 轮询 `app-scene-host canvas` 出现 → 采集该页 `console.error` / `window.onerror` / `unhandledrejection`。

噪声过滤（既有问题，与场景无关）：`NG0100 VizCanvasComponent`、`/api/v1/admin` 401。

### 7.2 结果

| 指标 | 数值 |
| --- | --- |
| 遍历知识点 | 281 / 281 |
| 3D 画布成功挂载 | **281 / 281（100%）** |
| 运行时错误 | 2 条，涉及 2 个知识点 |

### 7.3 两处异常与处置

1. **`light-deflection`（scenes/light-bending.ts:58）—— 已修复**
   `new THREE.Line(eaGeo, new THREE.ArrowHelper(...))` 把 Object3D 当作 material 传入，渲染器调用 `material.customProgramCacheKey()` 抛 `TypeError`。并发 5 实例下 5/5 复现。改为直接 `group.add(new THREE.ArrowHelper(...))`，并删除无用的 `eaGeo`/`einsteinPts`。修复后并发 8 实例复验全部干净，`tsc` 0 错误。
2. **`crystal-defect`（families/condensed.ts defect 分支）—— 判为环境偶发**
   单帧报 `Cannot read properties of undefined (reading '0')`，但单独复访与并发 4×2 实例复压下均未再复现；`build_defect` 的 `vacIdx=92` 在 `NX*NY=128` 范围内，`iSlots` 索引恒在 0–3，无越界路径。结论：WebGL 上下文耗尽期的连锁报错，非该场景缺陷。

### 7.4 备注

- 遍历器为一次性脚本，注入在页面上下文运行，未落库为仓库文件。
- 该遍历只验证「能否挂载 + 有无运行时异常」，不校验画面语义；语义正确性由第六节的静态审计与抽样截图回归覆盖。

---

## 八、第三轮全量语义审计与修正（2026-10-14）

第二轮覆盖 281 个绑定；此后注册表新增约 100 个专属场景绑定，本轮以**工作区现状 381 个绑定**（专属 148 + 族 233，覆盖 600 知识点目录中的 381 个）为范围重新全量审计。

### 8.1 结构层核对

- 381 绑定全部在 600 目录内、0 孤儿 slug、0 缺失场景文件。
- 遗留：`scenes/` 下约 512 个未引用旧文件；`cosmos:flrw` 为不可达死 variant（复审确认 `cosmos.ts:25 case 'flrw'` 无任何绑定命中）；注册表头注释与实际绑定数不符（均已记录，未清理）。

### 8.2 语义层审计（修正前）

12 个族代理 + 7 个专属批次代理逐条比对知识点 description/concept 与场景实现：

| 判定 | 数量 |
|---|---:|
| MATCH | 231 |
| MINOR（主形态正确、细节偏差） | 126 |
| MISMATCH（核心语义无关/空壳/名不副实/物理错误） | **23** |

### 8.3 MISMATCH 修正（两批共 39 条，全部落码）

**第一批 23 条**（14 族 + 9 专属）：

| 族/类别 | slug | 修复要点 |
|---|---|---|
| quantum | entanglement-swapping / so3-su2-representation / wkb-approximation | 交换纠缠三方协议、SO(3)↔SU(2) 双向表示、WKB 连接公式与透射系数 |
| condensed | hall-effect / hall-effect-carriers / shape-memory-alloy | 霍尔电压与载流子符号、n/p 双载流子、形状记忆超弹性相变 |
| oscillator | pendulum-chaos（改绑 variant `chaos`）/ elastic-collision | 混沌双摆真正进入混沌分支；碰撞改动量守恒联立 |
| spacetime | light-cone | 45° 光锥锥尖几何 |
| fieldlines | electric-field | 等势线族（marching squares）替代假场线 |
| waveoptics | lloyd-mirror | sin²β 半波损失条纹 |
| orbit | nbody-simulation | 真实 O(N²)+Plummer 软化积分 |
| plasma | debye-shielding | 屏蔽力方向反号修正 |
| mechwave | shock-wave | 马赫锥方向与包络角（锥尖落机头、r/d=sin μ） |
| 专属 | adaptive-optics / collision-restitution / damped-oscillation / geodesic / phonon-dispersion / multipole-radiation / poynting-vector / quantum-hall / tesla-coil | Zernike 模式分解闭环；e 与动量守恒联立；三 regime+Q；史瓦西测地线 RK4；双原子链 ω±(k)；电四极角分布；S 沿 +z；ν∝1/B+边缘态+陈数；双 LC 谐振+氖管 |

**复审新发现 16 条**（静态初审漏掉的深层问题，复审后全部修复）：

- 族 3 条：`muscle-contraction`（细丝滑动是死代码 → 细丝随收缩平移并锚定 Z 线）、`helmholtz-modes`（standing-pipe 通用模板顶名 → title 分支+旁支空腔本征值面板）、`vibrating-string`（时间频率非谐波 → ωₙ=n·ω₁）。
- 专属 13 条：`brillouin-zone`（FCC/BCC 边表损坏 → 面环去重推导 36/24 边）、`canonical-transform`（πab 声称守恒实测漂移 1873% → 改正则哈密顿系统，16s 零漂移）、`displacement-current`（∂E/∂t≡0 全装饰 → E 随时间振荡、B 环 ∝ ∂E/∂t）、`frame-dragging`（与 J 无耦合 → 一切拖曳量 ∝ J + LT 进动率读数）、`geodesic-deviation`（ξ 恒定 → ξ(τ) 振荡解与方程读数联动）、`lagrange-points`（日心/质心系混用致 L2/L3/L4 全错 → 统一日心旋转系）、`inclined-plane`（物块穿出斜面+重力不竖直 → 沿斜面参数化+世界系重力箭头）、`ising-model`（Onsager 式 sinh⁴ 应为 sinh⁻⁴，T<Tc 恒 NaN → 修正并画出 M(T)）、`lenz-law`（电流 ∝ +v → −dΦ/dt，过中心换向+读数面板）、`projectile-motion`（45° 结论不可验证 → 角度扫描轨迹族+射程面板）、`rainbow`（颜色角硬编码、入射点不在球面上 → 真 Snell 几何、红 42.1°/紫 40.2°）、`simple-pendulum`（参数写死不可验证 → L 分档扫描+T 实测/理论对照）、`wave-superposition`（无双源干涉 → 双源干涉场+波程差/级数读数）。

### 8.4 物理表述类 MINOR 修正（36 处）

初审 126 条 MINOR 中，凡"面板/画面物理表述错误"者一并修复（内容缺失型暂不补）：

- 第二波 8 处：accretion-disk-temp（光子球 r=3M=1.5r_s）、kerr-black-hole（轴标签 r_ergo/M）、plasma-confinement（th=phi/q+劳森判据）、graphene（双锥顶点相接）、delta-potential（δ 势单束缚态+ψ′ 跃变）、infinite-well（E_n∝n²）、stark-effect（画布标题/横轴 E）、nuclear-force（硬芯）。
- 第三波 28 处：fieldlines 7（gauss-law 通量文案、image-charge 场线穿板、quadrupole 抛物线→双曲线、magnetic-dipole 残留字符+无据自转、electric-potential 半径漂移、faraday-lenz 环不反向、eddy-current 磁铁固定）；orbit 5（tidal-force ΔF 公式 R/r 区分、schwarzschild 测地线方程、eclipsing-binary 两处公式、transfer 椭圆与圆轨道相切+Δv 箭头、gravity-assist 轨迹穿行星）；waveoptics/instrument/mechwave 3（evanescent e^{−κy} 包络+d_p=1/κ、oct-imaging 轴向分辨率公式、doppler 源速亚音速+波前域对齐）；scenes 13（optical-rotation α 读数 100×、coriolis 箭头反向+读数 2×、hohmann 相切、light-bending 净偏折 1.75″+θ_E 标签、gyroscopic 力矩反号、refrigeration-cop 温标混用、resonant-cavity TE₁₀₁+B 环平面、hubble-diagram H0 抖动+超新星转折、waveguide f_c 单位+k 实算、rigid-rotation ω_world=R·ω_body 等）。

### 8.5 修正后全量复审（381/381 落盘）

修复后对全部 381 绑定重新逐条复审并**全部落盘**为 22 份报告 + 汇总：

- `tools/audit3-bindings.csv`（381 行底稿）、`tools/audit3_summary.txt`、生成/校验脚本 `audit3_build.mjs` / `audit3_summarize.mjs` / `audit3_verify.mjs`（校验结论：**ALL REPORTS COMPLETE — 381 entries / 381 bindings**）。
- `tools/audit3-out/`：`fam-*.md` 17 份 + `bespoke-1..5.md` + `summary.md`，逐条格式 `slug | 判定 | 代码位置 | 依据 | 建议`。
- 复审判定：**MATCH 205 / MINOR 150 / MISMATCH 26**。其中 26 条 MISMATCH = 初审报告留存的首轮记录 10 条（已修）+ 复审新发现 16 条（已修），**当前代码 0 MISMATCH 残留**。
- 150 条 MINOR 以内容缺失/展示细节为主（每条附最小修复建议），未逐条落码——留作下一轮待办。

### 8.6 验证

- 类型检查：`node node_modules/typescript/bin/tsc -p tsconfig.scenes.json --noEmit` 与 `-p tsconfig.app.json --noEmit` 均 **0 错误**（PowerShell 执行策略禁 `npx`/`npm`，须 `node` 直调 tsc）。
- 浏览器运行时冒烟：第一波 58 个 slug（23 修复项 + 35 共享分支回归）全部 PASS；本会话对 36 处 MINOR 修复与 16 条新 MISMATCH 修复涉及的 **51 个唯一 slug** 全部 PASS（console 无场景相关错误；过滤既有噪声 NG0100 VizCanvas、未登录 401、/progress touch CORS）。
- 冒烟环境：后端须由当前源码构建（仓库原 `math-beauty-server.exe` 为异仓旧二进制，`GET /experiments` 500）——已 `go build -o phy-server.exe ./cmd/server` 替换，前端 `npm.cmd run dev`（4200）。

### 8.7 遗留建议

1. 150 条 MINOR 按 `tools/audit3-out/summary.md` 逐条建议分批落码（优先"面板承诺与画面不符"类，如 monte-carlo-sampling 估计量未加权、blackbody-lab 普朗克曲线幂次、convection-cell 缺六角胞意象、fresnel-diffraction 遮挡文案与效应相反、lloyd-mirror 反射角不守恒、eclipsing-binary 缺视向速度曲线）。
2. 清理 `scenes/` 下 512 个未引用文件与 `cosmos:flrw` 死 variant、修正注册表头注释。
3. 第八节统计与逐条明细以 `tools/audit3-out/summary.md` 为准（脚本可重算）。

---

## 九、第四轮独立复审与修正（2026-10-14）

第八节结论未经提交前，另起一轮**不采信第八节自述**的全量独立复审：14 个并行审计代理逐条比对 381 绑定的知识点 description/concept 与落码（`_r4_join.py` 生成 `_r4_batches/`，报告落 `_r4_out/batch-01..14.md` + `supplement.md`，底稿脚本可重算）。

### 9.1 判定汇总（修正前）

MATCH 206 / MINOR 151 / **MISMATCH 24**。第八节"0 MISMATCH 残留"不成立：24 条中有 14 条正是第八节声称"已修复"的条目复发或修复不完整（如 selection-rules 的 3j 符号、isco 的 E(r) 曲线公式、lenz/hall 族内符号问题在 condensed 1145 行仍反向）。

### 9.2 审计代理与底稿的双重发现

- **tsc 实测 7 处编译错误、4 个文件**（`adaptive-optics` emissive 属性、`angular-momentum` 重复声明、`blackhole-accretion` 缺资源登记器、`neutrino-observation` `C` 未定义）——证明第八节 8.6"0 错误"结论在当轮修改后未复跑。全部修复。
- **注册表文件名漂移 8 处**：绑定目标 ≠ `scenes/<slug>.ts`。coriolis/flrw/gyroscopic/lattice 四条代理已按实际生效文件正确判定；**light-deflection→light-bending、perrin-experiment→brownian-motion、wiener-brownian-path→brownian-motion** 三条曾被旧审计当作已实现，实际两两共用的旧文件互相对不上知识点语义。已重写三个专属场景并把注册表重绑到同名专属文件。

### 9.3 MISMATCH 修正（24 条全部落码）

- 专属重写：light-deflection（δ=4GM/c²b 全几何）、perrin-experiment（Langevin 系综+MSD 反推 N_A+玻尔兹曼高度分布）、wiener-brownian-path（√(2D·dt) 随机增量+尺度细化不可微面板+MSD 同源）。
- 专属修正：blackhole-accretion（ISCO 标度统一+真 δ^n 多普勒增亮）、isco（E=(1−2/r)/√(1−3/r)+虚线归位+Kerr 闭式标定）、cosmic-ray-observation（首作用 90 g/cm²+Gaisser–H 剖面+X_max 恒在级联内）、dna-diffraction（Cochran 结构因子层线+ tanα=pitch/2πR+真实 B-DNA 参数）、neutrino-observation（C=1+「轴向最早、环等时」文案重推导）、poynting-vector（导线轴向统一+|S| 扫 r 读数）、rigid-body-rotation（ε=0.02 微扰使网球拍翻转真发生+补形状→I/平行轴/门力矩三段）、selection-rules（q=mf−mi，σ± CG² 0.300/0.600 对拍通过）、angular-momentum/adaptive-optics（编译错误）。
- 族分支修正：condensed hall-effect/hall-effect-carriers（洛伦兹符号；e/h 同侧 −z 偏转、同侧积累青/金条）、fieldlines potential-multipole-expansion（方形交错四极 p≡0、远场 1/r³ 实测）、fluid magnus（转轴改沿 z 与 rotation.z 一致、F=−ρUΓŷ、旋向可见）、instrument telescope-diffraction-limit（drawAiry 真正平移双斑、瑞利阈值 sep≥R1）、orbit tidal-force（远端箭头背离中心+侧向压缩半幅箭头）、oscillator double-pendulum-lagrange（严格拉格朗日方程，能量漂移 0.0035%，线性化 ω²=(2∓√2)g/l 验证）与 hamilton-phase-space（阻尼不再误命中哈密顿分支，H 漂移 1e-11%）、quantum rectangular-barrier（sin/sinh 互换改正，E/V₀=0.2→T=1.56e−6）、atomic-levels（+13.6 映射归位+λ=hc/ΔE 巴尔末对拍）、alpha-decay-tunnel（盖莫夫 r 型库仑垒+Geiger–Nuttall log₁₀T–Q 曲线）、de-broglie-wave（去包络+n 1→4 扫描+周长=nλ 环）、emwave stimulated-emission（P_th 由 g=α 求根 0.4964、判据改 g>α、钳制线实现；同分支 laser-threshold 条目一并受益）。

### 9.4 验证

- `node node_modules/typescript/bin/tsc -p tsconfig.scenes.json / -p tsconfig.app.json --noEmit`：0 错误。
- `tools/verify_bindings.py`：381 绑定全部解析（含 3 条重绑）。
- 浏览器运行时冒烟：受本轮修改影响的 **29 个 slug 全部画布挂载、零场景相关错误**（iscan 首轮 6 页后出现的批量 timeout 确认为同源 iframe 并发下 WebGL 上下文耗尽的环境假阴性——整页重载+单并发分批后 29/29 PASS）。
- 各修复代理均留下一次数值验证脚本于 `_scratch/r4fix/<名>/`，报告留档 `_r4_out/`。

### 9.5 遗留

1. 151 条 MINOR 未落码（逐条附最小修复建议在 `_r4_out/batch-*.md`），其中含"面板承诺未画"与展示细节类。
2. 死模板文件（scenes/rigid-rotation、coriolis、gyroscopic、lattice-vibration、flrw-cosmology、perrin-experiment 旧同名覆盖前的 brownian-motion/light-bending 引用文件等）仍待统一清理。
3. 审计底稿 `_r4_join.py` 对 bespoke 文件名的"slug=文件名"假设不可靠，后续审计应直接以注册表导入路径为准。

---

## 十、MINOR 批量修正轮（2026-10-15）

对第九节遗留的 150 条 MINOR（`_r4_out/batch-*.md` 逐条建议）做批量落码轮。

### 10.1 执行方式

- `_r4_minor_batches/*.json` 18 张工作单按"实际生效文件"归组（12 张族文件 + 7 张专属文件组，每单独占文件，零编辑冲突）。
- 19 个修复代理并行，规则同第九节：每条先独立重推导审计依据，误判即 REJECTED 不动码；"面板承诺未画"优先补实现，过重才降级文案；族文件只改命中 variant/title 分支段。

### 10.2 结果（150 条）

- **落码约 141 条**：含 quantum 系（布洛赫球旋进、有限深阱超越方程交点、氢 2p 径向峰、液滴模型五项 SEMF、壳模型幻数标注…）、oscillator 系（受迫共振相频曲线、惯性平行轴扫描、相轨双阱同源积分…）、fluid 系（文丘里同源加速、柯尔莫哥洛夫耗散截止、空化数 σ、涡街 St·U/D 实算…）、instrument 系（干涉阵列反傅里叶成图、PET 弦相对环心+TOF、迈克尔逊 N 计数…）、biomol 系（复制叉、Z 方案阶梯、鞭毛反转…）、专属 48 个文件全部（临界质量 52 kg、虹霓二次内反射、波导 TE10 磁场流线实算、法布里–珀洛谐振腔扫描…）。
- **审计误判 REJECTED 约 6 条**（重推导后保留原实现）：如 pendulum-chaos 的 ODE 指控（现行式即标准等质量双摆，线性化 ω²=(2∓√2)g/l 验证）、type-ii-superconductor 的"非三角格子"、single-slit 的近场示意已如实标注等。
- **已落码复核确认 2 条**：laser-threshold（第九节求根修复）、cosmos/mechwave 8 条（前一代理中断，续办代理逐条复核均已实现且重推导通过）。
- 补充：wavepacket 一条在工作单内被首轮遗漏，10-15 单独补修。

### 10.3 验证

- `tsc -p tsconfig.scenes.json` / `-p tsconfig.app.json`：0 错误（中途 5 个文件出现 17 处 noPropertyAccessFromIndexSignature 与 1 处 `WORLD` 作用域错误，已修）。
- `tools/verify_bindings.py`：381 绑定全部解析。
- **全量 150 页运行时冒烟**：自恢复 iframe 扫描器（每 6 页整页重载规避 WebGL 上下文耗尽），150/150 完成；唯一失败项系扫描器队列把 thin-film-stress 误写为 thin-fill-stress 的 404，单独复访该页画布挂载成功——**实际 150/150 全过、零场景相关错误**。
- 生产打包 `npm run build`：47s 成功。

### 10.4 遗留

1. ~~约 509 个未注册死模板 `scenes/*.ts`~~ **2026-10-15 已全部删除**（含重绑后失去引用的 brownian-motion.ts、light-bending.ts 两个已跟踪孤儿文件）；`cosmos:flrw` 死 variant 已从 cosmos.ts 移除；注册表头注释计数已改（233 族绑定）。清理后 tsc 双配置 0 错误、verify_bindings 381、生产打包成功、cosmos 族 default/nsstar 两形态冒烟通过。
2. wave-superposition 等少数专属文件 dispose 仍走 traverse 而非登记器（仅文案级改动，未越出 MINOR 范围顺手重构）。

---

## 十一、审计中间产物退役（2026-10-15）

历轮审计的全部中间产物已按"结论落文档、证据进历史"原则清理出库与磁盘：

- 删除 `_r4_join.py`、`_r4_out/`（16 份逐条判定报告）、`tools/audit3-bindings.csv` / `audit3-summary.txt` / `audit3-out/` / `audit3_*.mjs`（第三轮底稿与脚本）。
- 删除本轮新增的 68 张审计截图 `client/e2e/screenshots/3d-*.png`（保留仓库原有的 3 张 e2e 基线图）。
- 删除磁盘日志（`_r2*.log`、`_r4*.log`、`backend*.log`、`frontend*.log`）与可再生成的 `client/dist`。
- **以上文件均可在 git 历史提交 e1c1e21 / 513e53d 中找回**；§8–§10 中指向这些路径的叙述为当时事实记录，不再内联修改。文档正文结论与验证链不依赖它们。
