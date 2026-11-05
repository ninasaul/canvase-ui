[English](README.md) · **简体中文**

# Canvase

开源 AI 媒体工作流画布。用节点图编排图片、视频、文本生成，在本地运行 DAG，并把媒体存进你自己的 S3 兼容存储桶。

认证使用 [Better Auth](https://www.better-auth.com/)（邮箱 + 密码）。画布与媒体元数据通过 Prisma 存在 PostgreSQL 中。

## 主要特性

- React Flow 可视化画布编辑器，支持图片 / 视频 / 文本 / 音频节点
- 自带网关：OpenAI 兼容 Base URL + 模型列表（BYOK 配置，支持无限个自定义网关）
- 同源 `/v1` 代理可注入服务端 `GENERATION_API_KEY` —— 密钥不会存到浏览器
- 媒体库走浏览器 **presigned PUT** 直传 R2 / S3 / MinIO
- 画布封面与列表预览；BullMQ worker（sharp / ffmpeg）异步生成 WebP 缩略图
- **Connect Agent**：作用域令牌 + HTTP 工具网关 + `@canvase/mcp`（stdio），可接入 Codex 等 MCP 宿主，支持改图与服务端 `canvas_run`
- i18n（中 / 英）、主题切换、画布偏好

## 技术栈

| 层 | 选型 |
| --- | --- |
| 应用 | Next.js 16、React 19、Tailwind CSS 4 |
| 认证 | Better Auth |
| 数据 | Prisma 7、PostgreSQL |
| 队列 | BullMQ + Redis（缩略图 worker） |
| 存储 | AWS SDK → S3 兼容对象存储 |

## 环境要求

- Node.js 20+ 与 [pnpm](https://pnpm.io/) 11
- PostgreSQL 16+
- Redis 7+（缩略图 worker 需要）
- 可选：`PATH` 中的 `ffmpeg`（或指定 `FFMPEG_PATH`）用于视频封面

## 快速开始

```bash
cp .env.example .env
# 编辑 DATABASE_URL、BETTER_AUTH_SECRET，以及可选的 S3_*/GENERATION_* 变量

# 只启动 Postgres（Redis 请本地安装，见 REDIS_URL）
docker compose up -d

# 如有需要，让 DATABASE_URL 与 compose 对齐，例如
# postgresql://canvase:canvase@localhost:5432/canvase?schema=public

pnpm install
pnpm db:migrate
pnpm dev
```

打开 [http://localhost:3917](http://localhost:3917)，注册后新建画布。

`pnpm dev` 会启动**全部服务**：Next.js 服务（端口 3917）与素材缩略图 worker，日志分别带 `[app]` / `[worker]` 前缀。缩略图需要 Redis 运行中（`REDIS_URL`，默认 `redis://127.0.0.1:6379/1`）；Redis 未启动时应用仍可运行，启动器会打印警告。

只想启动其中一个？

```bash
pnpm dev:app      # 仅 Next.js
pnpm dev:worker   # 仅缩略图 worker
```

## 配置

见 [`.env.example`](.env.example)。重要变量：

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串 |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | 认证密钥与公开访问地址 |
| `NEXT_PUBLIC_APP_URL` | 公开来源（CORS 白名单、链接拼接） |
| `GENERATION_BASE_URL` | 默认 OpenAI 兼容网关（用户可在 UI 覆盖） |
| `GENERATION_API_KEY` | 可选的 `/v1` 代理服务端 Bearer |
| `S3_*` | 兜底对象存储（用户在 **设置 → 存储** 中的配置优先于环境变量） |
| `STORAGE_SECRET` | 加密用户保存的 S3 / 生成密钥（默认取 `BETTER_AUTH_SECRET`） |
| `REDIS_URL` | 缩略图 worker 的 BullMQ 连接 |
| `FFMPEG_PATH` | 可选的 ffmpeg 路径 |

### 生成 / 模型

在画布 **模型设置** UI 中配置网关与模型（Base URL、BYOK 配置的加密 API Key、拉取模型 / 手动填写）。生成时浏览器不会把厂商密钥直接发给第三方：请求统一走本应用的 `/v1` 代理。

### 对象存储

上传流程是 **presign → 浏览器 PUT → complete**。凭证只留在服务端（加密的用户配置或环境变量）。

存储桶 **CORS** 必须允许来自应用来源的 `PUT`（通常还需要 `GET` / `HEAD`），例如 `http://localhost:3917`。缺少 CORS 时，即使服务端凭证正确，前端也会报网络 / CORS 上传错误。

示例：

```bash
# Cloudflare R2（endpoint 只填账号域名；bucket 单独配置）
S3_ENDPOINT="https://<accountid>.r2.cloudflarestorage.com"
S3_REGION="auto"
S3_BUCKET="canvase-media"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
S3_PUBLIC_BASE_URL="https://cdn.example.com"
S3_FORCE_PATH_STYLE="true"

# MinIO（本地）
S3_ENDPOINT="http://127.0.0.1:9000"
S3_REGION="us-east-1"
S3_BUCKET="canvase-media"
S3_ACCESS_KEY_ID="minioadmin"
S3_SECRET_ACCESS_KEY="minioadmin"
S3_PUBLIC_BASE_URL="http://127.0.0.1:9000/canvase-media"
S3_FORCE_PATH_STYLE="true"

# AWS S3
S3_ENDPOINT="https://s3.ap-southeast-1.amazonaws.com"
S3_REGION="ap-southeast-1"
S3_BUCKET="canvase-media"
S3_ACCESS_KEY_ID="AKIA..."
S3_SECRET_ACCESS_KEY="..."
S3_PUBLIC_BASE_URL="https://canvase-media.s3.ap-southeast-1.amazonaws.com"
S3_FORCE_PATH_STYLE="false"
```

### 缩略图

素材被标记为 `ready` 后，API 会向 Redis 队列（`asset-thumbnails`）投递任务。worker 会：

1. 下载公开对象（或用 ffmpeg 抓取视频帧）
2. 用 sharp 编码 WebP（最长边 480）
3. 上传 `{assetId}-thumbnail.webp` 并更新 `MediaAsset.thumbnailUrl` / 体积字段

画布封面（`purpose=canvas_thumbnail`）会被 worker 跳过。缩略图存在前，UI 回退到原始 `url`。

编辑器图片节点优先使用 `node.data.thumbnailUrl`，其次 `url`。加载画布时（以及 MCP 读取工具中），若存在 `assetId` / `assetIds` 却缺少 `thumbnailUrl`，会从 `MediaAsset` 补全。agent 执行 `canvas_run` 后，服务端在素材已有缩略图时写入 `thumbnailUrl`，否则投递生成任务。

## 认证

使用 Better Auth 的邮箱 + 密码登录。表单在提交时校验（邮箱格式、至少 8 位），显示字段级错误，把上游信息映射成本地化文案，并保留 `?next=` 目标，使深链在登录后仍能到达（只接受同源路径）。

服务端：密码限制 8–128 位，会话 30 天并在每日刷新，凭证接口限流（每分钟 10 次登录、每 5 分钟 5 次注册）。用户未选择前，主题跟随系统。

## Connect Agent（MCP）

Agent 可通过作用域令牌编辑并运行单个画布。

1. 打开画布 → **Connect Agent**
2. 签发令牌（默认作用域：`canvas:read`、`canvas:edit`、`canvas:run`）
3. 把 MCP 配置片段复制到 Codex 或其他 MCP 宿主
4. cwd 保持在仓库根目录（或对 `packages/canvase-mcp` 使用绝对路径）

| 组成部分 | 作用 |
| --- | --- |
| Agent 令牌 | 绑定单个画布 + 作用域；只显示一次；可吊销 |
| 工具网关 | `/api/agent/tools`（以及 `/api/agent/tools/[toolName]`） |
| `@canvase/mcp` | stdio MCP 服务；把工具调用转发到网关 |
| 运行 | 服务端 DAG：`canvas_run` / 状态 / 取消；编辑器轮询活动运行以显示节点覆盖层 |
| 分组 | `canvas_group_nodes` / `canvas_ungroup`；节点摘要包含 `parentId` 与分组 `childIds` |
| 参数 | `canvas_generation_options` 列出模型允许的取值；`canvas_update_node` 合并 `data.params` |

Agent 对话轮次会在服务端持久化（`canvas_chat_message`，追加写入，每个画布保留最近 400 条），因此历史可跨刷新与设备保留。消息带 `sessionId`：**新对话**开启全新模型上下文，而更早的会话仍以分隔线形式显示在同一时间线中。编辑器保留本地缓存用于即时渲染；服务端历史可用时以服务端为准。`GET/DELETE /api/canvases/[id]/chat` 用于读取或清空。

### Agent 审批

读取与普通编辑工具自动执行（可撤销）。会花钱或批量删除的工具不行：`canvas_run` 与超过 5 个 id 的 `canvas_delete_nodes` 会阻塞该轮，并通过对话流发出 `approval_request`。浏览器通过 `POST /api/agent/approvals/[id]` 回复 `allow_once`、`allow_session`（该会话 30 分钟授权）或 `deny`；拒绝会作为工具结果回给模型，使其可以提出更小的步骤。待审批请求与会话授权通过 Redis 共享（`canvase:approval:<id>` + `canvase:approval:decision` 发布订阅频道），因此任意实例都能处理运行在其他实例上的轮次。没有 `REDIS_URL` 时两者都退化为进程内状态，仅适用于单实例。

### 记忆压缩

长对话采用折叠而非截断：当一条轮次的记录超出窗口时，客户端把最旧的一段发给 `POST /api/agent/summarize`，模型写出密集摘要，结果存入 `canvas_chat_summary`（`coveredThrough` 记录它覆盖到的时间点，因此历史被裁剪或清空也不会错位）。后续轮次发送该摘要 + 最近的尾部，而不是全部历史，摘要可跨刷新与设备保留。第二次压缩时，旧摘要会折入新摘要，切片之间不会丢失内容。

### 大画布

大图仍保持可交互（已在 164 节点 / 203 条边的画布上验证）：

- 边的流动动画上限为 80 条 —— 每条动画边每帧都会重绘
- 细节分级：缩放低于 35% 时节点媒体不再挂载，文本以静态预览呈现；边角色标签仅在 50% 以上缩放时挂载。两者都在手势结束后切换，而不是逐帧
- 节点组件通过缓存索引查找节点，而不是 `nodes.find`（每次更新 O(n²) → O(n)），视口派生状态在手势结束时才更新
- 每个节点都是绘制/布局隔离边界，视口层被提升为独立合成层，因此拖拽与平移走合成而非重绘整张图

该画布实测：空闲慢帧 9 → 0，节点拖拽平均 27.9ms → 8.4ms，平移 19.9ms → 8.5ms。

### 运行卡片与历史预算

agent 触发的 `canvas_run` 会在记录中渲染为实时卡片（模式、`done/total`、失败数、取消），每两秒轮询 `GET /api/canvases/[id]/runs/[runId]` 直到运行结束。发给模型的历史按字符数（`MAX_API_HISTORY_CHARS`，120k）而非仅按消息数截断：工具备注截断到 420 字符，最旧的轮次折叠成 `[earlier conversation omitted]` 提示，而最近六条消息始终保持原样。

### 中途引导（Steering）

轮次流式输出期间输入框仍可编辑：发送按钮变为 **Steer**，消息进入队列而不是开启新轮次。该指令会在 agent 下一步之前以 `[mid-turn instruction from the user] …` 折入对话（并在轮次结束前再应用一次，因此最后一次流式输出期间到达的引导也能得到回应）。接口为 `POST /api/agent/steer`；`409` 表示当前没有任何流式输出，客户端会回退为普通消息。排队指令会持久化到记录中，历史因而保持真实。

### 画布上下文

每轮对话都携带编辑器传来的 `context { version, selection, focusNodeId, visibleNodeIds }`。服务端会从数据库重建一份简短的画布摘要（标题、版本、节点/分组数量、失败项、分组、用户选择、焦点节点、视口内 id、版本漂移）并注入系统提示词，因此 agent 无需仅仅为了获知节点 id 而调用 `canvas_get`。输入框会把当前选择显示为可移除的 chip，指向某节点的工具调用会让该节点在画布上闪烁并平移入视野。

编辑工具使用乐观并发（`expectedVersion` 来自 `canvas_get`）。细节、工具清单与排错见 [`packages/canvase-mcp/README.md`](packages/canvase-mcp/README.md)。

## Agent 技能（Skills）

Skills 是 agent 按需加载的可复用指令包（渐进式披露）：提示词中只放 `name` + `description`，全文通过工具拉取。

```
skills/
  canvas-graph-workflow/
    SKILL.md                    # YAML frontmatter + 指令正文
    references/example.md       # 可选资源，按需读取
```

`SKILL.md` frontmatter：

```markdown
---
name: canvas-graph-workflow
description: How to compose, edit and run Canvase canvas graphs safely.
tags: canvas, graph
---
```

| 组成部分 | 作用 |
| --- | --- |
| 发现 | `skills_list` → `{ id, name, description, tags }` |
| 加载 | `skills_read({ name })` → 正文 + 同级 `files`；`skills_read({ name, file })` 读取资源 |
| 提示词 | 目录会追加到画布 agent 的系统提示词；对话与 MCP 共用同一批工具 |
| 作用域 | 只读；任何拥有 `canvas:read` 的调用方都可使用 |
| 位置 | 默认 `./skills`，可用 `CANVASE_SKILLS_DIR` 覆盖 |

目录名必须匹配 `^[a-z0-9][a-z0-9._-]*$`。读取被限制在技能目录内（不允许 `..`、不允许绝对路径、仅文本文件、单文件 256 KB）。调用会记录在 `canvas_command_log`。内置 4 个技能（`canvas-graph-workflow`、`storyboard-from-script`、`character-sheet`、`image-to-video`）；可在 **设置 → 内置技能** 中浏览，或在输入框输入 `/` 选择并直接执行。放入一个含 `SKILL.md` 的文件夹即可，无需重启（5 秒缓存）。

## 脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` / `pnpm dev:all` | 一条命令启动 Next.js（3917）**+** 缩略图 worker |
| `pnpm dev:app` / `pnpm dev:worker` | 只启动开发栈的一侧 |
| `pnpm build` / `pnpm start` | 生产构建与服务 |
| `pnpm lint` | ESLint |
| `pnpm db:migrate` | 创建 / 应用 Prisma 迁移 |
| `pnpm db:studio` | Prisma Studio |
| `pnpm worker` / `pnpm worker:dev` | 素材缩略图 worker（需要 Redis） |
| `pnpm --filter @canvase/mcp start` | stdio MCP 服务（需 `CANVASE_*` 环境变量，见该包 README） |

## 这个仓库是什么

一个自托管的画布前端，外加一个小型 BFF。它刻意设计为单租户部署：

- 网关与模型目录按用户在画布中配置；也可通过环境变量注入共享的 `GENERATION_API_KEY`
- 存储是用户级或环境级 S3/R2
- 缩略图由单个本地 BullMQ worker 生成，而不是 worker 集群

## 许可

除非仓库另有说明，否则为私有 / 未授权。
