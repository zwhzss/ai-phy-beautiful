# 物理之美教育软件

仓库地址：<https://github.com/zwhzss/ai-phy-beautiful>

物理之美教育软件 —— 以"真实为锚、尺度为线"的交互式物理可视化教育系统：
真实素材建立信任，尺度穿越串联认知，2D 解释结构，3D 建立直觉，定律驱动的仿真揭示规律，标注清楚的未知保留敬畏。
系统覆盖**从通识到科研·学术级（难度六级）的物理知识全谱**，并重点呈现
**改变人类历史进程的定律、公式、重大发明与对应物理学家**（里程碑 + 年代时间线主线）。

> 本项目由前身系统重构而来：基础设施（Go + Angular + Wails）复用，
> 知识体系、教学形态与渲染引擎按物理之美需求重建，重构路线见《架构设计.md》§十。

## 项目结构

```
ai-phy-beautiful/
├── server/                  # Go + Gin + GORM + SQLite 后端
│   └── cmd/                 # server / tts-gen / audio-pack / audioaudit / assets-pack / firstrun ...
├── client/                  # Angular 17+ 前端
├── desktop/                 # Wails v2 桌面壳
│   └── assets/              # 随安装包分发的归档（构建生成，不入库）
├── tools/                   # 归档审计等运维脚本
├── docs/                    # 文档
├── 需求.txt                  # 原始内容策划需求（输入）
├── 需求规格.md               # 补充修正后的系统需求
├── 架构设计.md               # 物理之美系统架构设计（本系统正式架构）
└── 架构设计-原系统.md       # 原系统架构（参考）
```

## 文档

- [需求规格.md](./需求规格.md) —— 由《需求.txt》补充修正的系统需求（FR/NFR/质量红线）
- [架构设计.md](./架构设计.md) —— 物理之美系统架构设计（四层渲染、尺度轴、数据模型、迁移计划）
- [架构设计-原系统.md](./架构设计-原系统.md) —— 原系统架构（参考）
- [docs/实验制作规范.md](./docs/实验制作规范.md) —— 一个实验由什么构成、渲染器怎么写
- [docs/问题与修复记录.md](./docs/问题与修复记录.md) —— 已出现问题的现象、根因与修正方案（改 AI 内容/图形/语音相关代码前先看它）
- [docs/API设计.md](./docs/API设计.md) —— 接口约定
- [docs/部署指南.md](./docs/部署指南.md) —— 构建与部署

## 技术栈

- **后端**: Go 1.21 + Gin + GORM + SQLite
- **前端**: Angular 17 + TypeScript + KaTeX（重构中新增 Three.js 3D 层与仿真核心，见架构设计 §三）
- **桌面**: Wails v2 + WebView2 + NSIS

## 快速开始

### 后端（Go）

```bash
cd server
go mod download
go run ./cmd/server
# 服务启动于 http://localhost:8080
```

### 前端（Angular）

```bash
cd client
npm install
npm run dev
# 应用运行于 http://localhost:4200
```

### 桌面端打包（含讲解音频与素材）

```powershell
# 一键：生成并校验音频/素材归档 → 前端 → 后端 → 桌面端 → NSIS 安装包
.\build-release.bat
```

安装包内置两组归档，首次启动自动解压到 `%APPDATA%\phy-beauty`（无需联网、无需手工导入）：

| 归档 | 内容 | 解压位置 |
|---|---|---|
| `narrations-audio.zip` | 600 个展项 + 120 个里程碑的双音色讲解音频（10122 个文件，约 430 MB；其中 9962 个是新装库真正引用的） | `audio\<id>\<voice>\*.mp3`、`audio\ms<id>\<voice>\*.mp3` |
| `phy-assets.zip` | 素材资产（图片 / 数据集） | `assets\image\*`、`assets\dataset\*` |

> 归档内带 `manifest.json` 逐文件记录落盘目录：有 21 个 slug 既是展项又是里程碑，
> 只靠 slug 反查 id 会把里程碑音频写进展项目录。详见 [docs/部署指南.md](./docs/部署指南.md) §4.2。

> ⚠️ **清理约定（勿删）**：音频源目录 `server/data/audio/`（约 452 MB，TTS 批量合成，重生成代价高）
> 与打包归档 `desktop/assets/narrations-audio.zip` 是安装包随附资产，任何仓库/磁盘清理都必须保留；
> 两者均被 `.gitignore` 排除、只存在于磁盘。`build-release.ps1` 从音频源重新生成归档并校验安装包实际携带。

> **目标机器无需联网**：安装包默认内置约 204 MB 的 WebView2 离线运行库（体积 402 MB → 约 605 MB），
> 断网机器也能装；`-SkipOfflineWebView2` 可出在线版。代码签名走 `-SignPfx` / `PHY_SIGN_THUMBPRINT`，
> 默认不签。占用明细与前提见 [docs/部署指南.md](./docs/部署指南.md) §4.3.2。

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/experiments | 实验列表（分页、筛选） |
| GET | /api/v1/experiments/:slug | 实验详情 |
| GET | /api/v1/experiments/search?q= | 搜索实验 |
| GET | /api/v1/narrations/:id | 讲解稿件 |
| GET | /api/v1/narrations/:id/:line/audio | 音频路径 |
| POST | /api/v1/auth/register | 注册 |
| POST | /api/v1/auth/login | 登录 |
| GET | /api/v1/progress | 学习进度 |
| PUT | /api/v1/progress/:id | 更新进度 |
| GET | /api/v1/bookmarks | 收藏列表 |
| POST | /api/v1/bookmarks/:id | 添加收藏 |
| DELETE | /api/v1/bookmarks/:id | 取消收藏 |

> 物理之美新增接口（themes / scale / milestones / figures / assets / 审核工作流）见《架构设计.md》§八。

## 开发计划

详见 [架构设计.md](./架构设计.md) §十（迁移计划）与 §十四（开发计划概要）。

- 全量约 600 个物理展项，难度六级（通识 → 中学 → 本科基础 → 本科高年级 → 研究生 → 科研·学术级），10 大板块；MVP 一期约 168 个
- 重点主线：约 120 个历史里程碑（定律 ~40 / 公式 ~30 / 发明 ~30 / 关键实验 ~20）+ 约 150 位物理学家，年代时间线呈现（MVP 先行 50 个核心里程碑）
- 每个展项与核心里程碑配有云希（男声）+ 晓晓（女声）双版本语音讲解
- 内容生产执行"脚本 → 科学顾问审核 → 发布"状态机，五级确定性标签强制标注

本项目仅供个人学习、研究使用，商用需另行获得授权。
