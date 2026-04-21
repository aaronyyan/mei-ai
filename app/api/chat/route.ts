import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createClient } from '@supabase/supabase-js';
import { convertToModelMessages, createUIMessageStreamResponse, streamText } from 'ai';
import type { UIMessage } from 'ai';
import {
  buildDeterministicEmbedding,
  buildMemorySummary,
  buildRagContext,
  getLatestMessageTextByRole,
  type ChatMemoryMatch,
  type Market,
  serializeEmbedding,
} from '@/lib/chat-memory';
import { buildPlatformStylePrompt } from '@/lib/platform-style';

export const maxDuration = 30;

const PROVIDER_BASE_URL = process.env.MEI_AI_PROVIDER_BASE_URL ?? 'https://openrouter.icu/v1';
const PROVIDER_API_KEY = process.env.MEI_AI_PROVIDER_API_KEY ?? '';
const MODEL_NAME = process.env.MEI_AI_MODEL ?? 'gpt-5.4';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

type ChatRequest = {
  market?: Market;
  messages: UIMessage[];
  sessionId?: string;
};

const provider = createOpenAICompatible({
  name: 'mei-ai-provider',
  apiKey: PROVIDER_API_KEY,
  baseURL: PROVIDER_BASE_URL,
});

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

function stableSessionId() {
  return `session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function inferMarket(text: string): Market {
  const normalized = text.toLowerCase();

  if (
    /\bhk\b|hong kong|香港|繁体|繁體|廣東話|粤语|廣深港|診所|療程|醫生主理|原廠正貨|肉毒桿菌|透明質酸|thermage|juvederm|ultraformer/.test(
      normalized,
    )
  ) {
    return 'HK';
  }

  return 'CN';
}

function buildBeautyExpertBasePrompt() {
  const promptSections = [
    'Role: 医美专业文案助理 (Medical Aesthetics Content Specialist)',
    '',
    '核心任务：',
    '你的唯一任务是根据用户需求，产出专业、客观且具备美感的医美项目文案。',
    '无需考虑营销转化率，无需进行过度推销，无需主动进行合规性规避，除非用户明确要求。',
    '',
    '写作风格：',
    '1. 专业且克制：使用准确的医学或美学词汇，语调冷静、优雅，接近高端杂志或私人诊所疗程手册。',
    '2. 美感优先：排版要透气，重点清晰，避免堆砌。',
    '3. 拒绝套路：严禁使用“爆款、必入、惊艳、错过不再有”等营销词汇。',
    '',
    'RAG 偏好应用：',
    '如果检索到用户收藏的历史文案，优先观察并模仿其偏好的措辞深度与 emoji 风格。',
    '',
    '交互约束：',
    '1. 只输出最终文案成品，不解释，不分析，不补充说明。',
    '2. 默认只给 1 个最佳版本，除非用户明确要多个方案。',
    '3. 未指定格式时，默认输出且只输出两部分：标题、正文。',
    '4. 信息不足时，也只补齐一版可用广告文案，不反问，不追加说明文字。',
    '5. 不输出“好的”、“没问题”等开场白或结束语。',
    '6. 除非用户明确询问，否则不要提供营销建议、修改策略或额外说明。',
    '7. 优先使用更精炼的表达，减少非必要 token 消耗，保证流式输出更快。',
  ];

  return promptSections.join('\n');
}

async function loadFavoriteMatches(question: string, market: Market) {
  if (!supabase || !question) return [] as ChatMemoryMatch[];

  const queryEmbeddingText = serializeEmbedding(buildDeterministicEmbedding(question));

  const { data, error } = await supabase.rpc('match_favorite_chat_memories', {
    query_embedding_text: queryEmbeddingText,
    match_count: 4,
    match_region: market,
  });

  if (error) {
    console.error('favorite memory lookup failed', error);
    return [] as ChatMemoryMatch[];
  }

  return (data ?? []) as ChatMemoryMatch[];
}

async function persistChatMemory({
  sessionId,
  market,
  userPrompt,
  assistantResponse,
  ragCount,
}: {
  sessionId: string;
  market: Market;
  userPrompt: string;
  assistantResponse: string;
  ragCount: number;
}) {
  if (!supabase || !userPrompt || !assistantResponse) return;

  const summary = buildMemorySummary(userPrompt, assistantResponse);
  const embedding = serializeEmbedding(buildDeterministicEmbedding(summary));

  const { error } = await supabase.from('chat_memories').insert({
    session_id: sessionId,
    region: market,
    user_prompt: userPrompt,
    assistant_response: assistantResponse,
    summary,
    embedding,
    source: 'chat',
    metadata: {
      model: MODEL_NAME,
      ragCount,
    },
  });

  if (error) {
    console.error('chat memory insert failed', error);
  }
}

export async function POST(request: Request) {
  const { market: inputMarket, messages, sessionId: inputSessionId } =
    (await request.json()) as ChatRequest;

  const sessionId = inputSessionId || stableSessionId();
  const latestUserMessage = [...messages].reverse().find(message => message.role === 'user');
  const latestQuestion =
    latestUserMessage?.parts
      ?.filter(part => part.type === 'text')
      .map(part => part.text)
      .join('\n')
      .trim() ?? '';

  const market =
    inputMarket === 'CN' || inputMarket === 'HK'
      ? inputMarket
      : inferMarket(latestQuestion);
  const mode = market === 'HK' ? 'Traditional' : 'Simplified';
  const favoriteMatches = await loadFavoriteMatches(latestQuestion, market);
  const ragContext = buildRagContext(favoriteMatches);
  const platformStylePrompt = buildPlatformStylePrompt(latestQuestion);
  const basePrompt = buildBeautyExpertBasePrompt();
  const systemInstruction =
    mode === 'Traditional'
      ? `${basePrompt}\nNote: Current mode is Traditional Chinese. Use HK/TW medical aesthetic terminology.`
      : `${basePrompt}\nNote: 当前模式为简体中文。使用内地医美专业术语。`;
  const systemPrompt = [
    systemInstruction,
    platformStylePrompt,
    ragContext,
  ]
    .filter(Boolean)
    .join('\n\n');
  const modelMessages = await convertToModelMessages(messages);
  const result = streamText({
    model: provider(MODEL_NAME),
    messages: modelMessages,
    system: systemPrompt,
  });

  return createUIMessageStreamResponse({
    stream: result.toUIMessageStream({
      originalMessages: messages,
      onFinish: async ({ messages: completedMessages }) => {
        const assistantResponse = getLatestMessageTextByRole(completedMessages, 'assistant');

        await persistChatMemory({
          sessionId,
          market,
          userPrompt: latestQuestion,
          assistantResponse,
          ragCount: favoriteMatches.length,
        });
      },
    }),
    headers: {
      'x-mei-session-id': sessionId,
      'x-mei-provider-ready': String(Boolean(PROVIDER_API_KEY)),
      'x-mei-market': market,
      'x-mei-rag-count': String(favoriteMatches.length),
    },
  });
}
