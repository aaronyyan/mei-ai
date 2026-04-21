# 轻量 RAG

- 每轮问答写入 `chat_memories`
- 只有 `is_favorite = true` 的记录参与召回
- 按 `region` 过滤样本
- 当前向量方案是本地 deterministic embedding
- 用途是风格复用，不是知识库问答
