# Mei AI

Mei AI 是一个面向医美内容团队的文案工作台。  
它的重点不是通用对话，而是稳定生成医美项目文案，并逐步贴近团队自己的表达习惯。

## 当前能力

- 根据用户输入生成医美文案
- 默认输出 `标题 + 正文`
- 自动判断内地或香港市场语境
- 通过“满意 / 不满意”沉淀收藏问答
- 只从收藏样本中做轻量 RAG 召回
- 支持线程保存、删除与本地恢复

## 技术栈

- Next.js App Router
- Vercel AI SDK
- OpenAI-compatible provider
- Supabase
- pgvector

## 本地启动

```bash
cd /Users/yanlixing/document/mei-ai
pnpm install
pnpm dev
```

打开：

```bash
http://localhost:3000
```

## 环境变量

项目默认读取：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `MEI_AI_PROVIDER_BASE_URL`
- `MEI_AI_PROVIDER_API_KEY`
- `MEI_AI_MODEL`

仓库里已经有：

- `.env.example`
- `.env.local`

## 数据库初始化

在 Supabase SQL Editor 里执行：

```sql
supabase/schema.sql
```

这会创建：

- `chat_memories`
- `match_favorite_chat_memories`
- 相关索引和 RLS 策略

## 当前数据链路

1. 用户发送问题
2. 服务端自动判断内地或香港市场
3. 从 favorite 样本里召回相似问答
4. 拼装 system prompt 并流式输出
5. 回答完成后写入 `chat_memories`
6. 用户点“满意”后，该条记录进入收藏样本池

## 关于 RAG

当前 RAG 不是知识库问答，更像风格样本库。

它主要解决的是：

- 文案节奏一致
- 措辞更贴近团队偏好
- 小红书、朋友圈、项目说明等风格更稳定

现在使用的是本地 deterministic embedding，用来先跑通链路。后续如果要升级，只需要替换 embedding 生成逻辑和向量维度，不需要重做 UI。

## 开发说明

### 为什么 `build` 用 `.next-build`

项目里已经把开发和构建产物隔离开：

- `pnpm dev` 使用 `.next`
- `pnpm build` 使用 `.next-build`

这样做是为了避免本地开着 `next dev` 的同时跑构建校验，导致开发产物被污染，出现 webpack / manifest 类错误。

### 常用命令

```bash
pnpm dev
pnpm test
pnpm run typecheck
pnpm run build
```

## 相关文档

- [00-project-overview.md](./00-project-overview.md)
- [01-regional-toggle.md](./01-regional-toggle.md)
- [02-rag-memory.md](./02-rag-memory.md)
- [03-chat-api.md](./03-chat-api.md)
- [04-chat-ui.md](./04-chat-ui.md)
- [DESIGN.md](./DESIGN.md)
- [AI_UI_PROMPT.md](./AI_UI_PROMPT.md)

## 图示文件

`diagram/` 目录下保留了两张当前仍可参考的图：

- `architecture-analysis.svg`
- `rag-flow.svg`

它们对应的 png 预览在 `diagram/png/`。
