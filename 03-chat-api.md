# Chat API

`POST /api/chat`

流程：

1. 取最后一条用户消息
2. 自动判断 `CN` / `HK`
3. 生成查询向量
4. 调 `match_favorite_chat_memories`
5. 拼装 prompt
6. `streamText` 流式返回
7. `onFinish` 写回 `chat_memories`

降级：

- RPC 失败：无 RAG 继续
- 入库失败：只记日志，不拦回答
