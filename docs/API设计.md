# API 设计

> 对应实现：`server/internal/router/router.go`、`server/internal/handler/`
> 所有接口前缀 `/api/v1`，统一响应包装：`{ "code": 0, "message": "...", "data": ... }`，`code = 0` 表示成功（非 0 见 HTTP 状态码与 `message`）。

## 一、认证

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/auth/register` | 注册。Body：`{username, email, password}`（用户名 3–50 字符，密码 ≥ 6 位） |
| POST | `/auth/login` | 登录。Body：`{username, password}`，返回 `{id, username, email, role, token}` |
| GET | `/auth/me` | 当前用户信息（需登录） |

认证方式：`Authorization: Bearer <token>`（JWT，默认有效期 `720h`，见 `config.yaml → jwt.expiration`）。

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

## 二、实验与分类（公开）

| 方法 | 路径 | 参数 | 说明 |
|---|---|---|---|
| GET | `/experiments` | `page`(默认 1) `pageSize`(默认 20) `category_id` `difficulty` | 分页列表，支持分类与年级筛选 |
| GET | `/experiments/search` | `q` `page` | 按标题/描述/slug 搜索 |
| GET | `/experiments/:slug` | — | 实验详情（含分类、公式、历史、应用、参数 schema） |
| GET | `/experiments/:slug/narrations` | — | 讲解稿件（按小节分组，音频地址已补全为绝对地址） |
| GET | `/categories` | — | 全部分类（按 `order_index` 排序） |
| GET | `/categories/:category_slug/experiments` | — | 某分类下的实验 |

`difficulty` 取值：`basic`(小学) / `intro`(初中) / `intermediate`(高中) / `advanced`(大学) / `professional`(研究生)。

## 三、讲解（公开）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/narrations/:experiment_id` | 该实验的讲解行列表 |
| GET | `/narrations/:experiment_id/:line_id/audio` | 指定音色的音频地址（`voice` 参数，默认 `yunxi`） |

音频静态资源：`/audio/<experiment_id>/<voice>/<line_id>.mp3`（由 `r.Static("/audio", audio_dir)` 提供）。

## 四、学习进度与收藏（需登录）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/progress` | 当前用户全部进度（含预加载的 `experiment` 关联，可直接显示标题/分类） |
| GET | `/progress/:experiment_id` | 单个实验进度 |
| PUT | `/progress/:experiment_id` | 更新进度，Body：`{line_index, duration_sec, completed}`；`completed` 只允许 `false → true`，不会被后续更新打回 |
| POST | `/progress/:experiment_id/touch` | 记录一次学习访问（进入实验即计入「已学习」，幂等且不清除完成状态） |
| GET | `/bookmarks` | 收藏列表（同样预加载 `experiment` 关联） |
| POST | `/bookmarks/:experiment_id` | 添加收藏 |
| DELETE | `/bookmarks/:experiment_id` | 取消收藏 |
| GET | `/bookmarks/:experiment_id/exists` | 是否已收藏 |

## 五、管理接口（需管理员 `role = admin`）

### 概览与数据

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/admin/stats` | 统计：实验/分类/用户/讲解数、内容状态分布、各难度数量、双音色音频条数 |
| GET | `/admin/content/overview` | 内容生产概览（状态、音频条数、可用音色、Edge TTS 可用性） |
| GET | `/admin/content/estimate` | 批量生成成本估算 |
| POST | `/admin/seed-experiments` | 从内置种子数据填充/更新实验与分类（幂等） |

### 实验维护

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/admin/experiments` | 后台列表（`page` `pageSize` `difficulty` `content_status` `category_id` `q`） |
| POST | `/admin/experiments` | 新建实验 |
| POST | `/admin/experiments/bulk-import` | 批量导入实验 |
| PUT | `/admin/experiments/:id` | 更新实验（标题/概念/难度/描述等） |
| DELETE | `/admin/experiments/:id` | 删除实验（连带讲解） |
| GET | `/admin/categories` | 分类列表 |
| POST | `/admin/categories` | 新建分类 |

### AI 内容生成

| 方法 | 路径 | Body | 说明 |
|---|---|---|---|
| POST | `/admin/experiments/:id/generate` | — | 为单个实验生成教学内容（图文/公式/历史/应用/讲解稿件/参数） |
| POST | `/admin/experiments/generate-batch` | `{difficulty, limit, include_ready}` | 批量生成 |

### 讲解稿件与语音合成

| 方法 | 路径 | Body | 说明 |
|---|---|---|---|
| GET | `/admin/experiments/:id/narrations` | — | 该实验讲解行 |
| POST | `/admin/experiments/:id/narrations` | `{replace, lines:[{section_id, section_title, line_id, text}]}` | 导入稿件 |
| PUT | `/admin/narrations/:line_id` | `{text, section_id}` | 修改某句 |
| DELETE | `/admin/narrations/:line_id` | — | 删除某句 |
| POST | `/admin/experiments/:id/narrations/synthesize` | `{voices:["yunxi","xiaoxiao"], force}` | 单个实验语音合成 |
| POST | `/admin/narrations/synthesize-batch` | `{voice, limit, force}` | 批量语音合成 |

### 大模型配置（需求 5）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/admin/ai-models` | 模型列表（`type` 可选过滤），API Key 以掩码返回 |
| POST | `/admin/ai-models` | 新增。Body：`{name, model_type, provider, base_url, api_key, model_name, voice, region, extra_config}` |
| PUT | `/admin/ai-models/:id` | 编辑（`api_key` 留空表示不修改） |
| DELETE | `/admin/ai-models/:id` | 删除 |
| POST | `/admin/ai-models/:id/activate` | 激活（**同类型只能激活一个**，自动停用其他） |
| POST | `/admin/ai-models/:id/test` | 测试连接 |
| GET | `/admin/ai-models/stats` | 各类型数量、当前激活项、内置 Edge TTS 可用性 |

`model_type`：`llm` / `tts` / `asr` / `image`。
`provider`：`openai` / `azure` / `edge`（TTS 免密钥内置）/ `ollama` / `custom`。

## 六、错误码

| HTTP | 含义 |
|---|---|
| 400 | 参数或业务校验失败（`message` 为中文提示） |
| 401 | 未登录或 token 失效 |
| 403 | 权限不足（需要管理员） |
| 404 | 资源不存在 |
| 500 | 服务端异常 |
