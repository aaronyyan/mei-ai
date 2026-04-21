import type { UIMessage } from 'ai';

export type Market = 'CN' | 'HK';

export type ChatMemoryMatch = {
  id: string;
  session_id: string;
  region: string;
  user_prompt: string;
  assistant_response: string;
  summary: string;
  similarity: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const EMBEDDING_DIMENSION = 256;

function normalizeEmbeddingSource(text: string) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function hashToken(token: string) {
  let hash = 2166136261;

  for (const char of token) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function collectEmbeddingTokens(text: string) {
  const normalized = normalizeEmbeddingSource(text);
  const tokens = new Set<string>();

  if (!normalized) return [];

  const words = normalized.match(/[a-z0-9]+/g) ?? [];

  for (const word of words) {
    tokens.add(`w:${word}`);

    if (word.length <= 3) continue;

    for (let index = 0; index <= word.length - 3; index += 1) {
      tokens.add(`g:${word.slice(index, index + 3)}`);
    }
  }

  const compactChars = Array.from(normalized.replace(/\s+/g, ''));

  for (let index = 0; index < compactChars.length; index += 1) {
    const currentChar = compactChars[index];
    tokens.add(`c:${currentChar}`);

    const nextChar = compactChars[index + 1];
    if (nextChar) {
      tokens.add(`b:${currentChar}${nextChar}`);
    }
  }

  return [...tokens];
}

export function buildDeterministicEmbedding(text: string) {
  const embedding = new Array<number>(EMBEDDING_DIMENSION).fill(0);
  const tokens = collectEmbeddingTokens(text);

  if (tokens.length === 0) {
    return embedding;
  }

  for (const token of tokens) {
    const hash = hashToken(token);
    const index = hash % EMBEDDING_DIMENSION;
    const sign = (hash & 1) === 0 ? 1 : -1;
    embedding[index] += sign;
  }

  const magnitude = Math.hypot(...embedding);

  if (magnitude === 0) {
    return embedding;
  }

  return embedding.map(value => Number((value / magnitude).toFixed(6)));
}

export function serializeEmbedding(embedding: number[]) {
  return `[${embedding.join(',')}]`;
}

export function getMessageText(message: UIMessage) {
  return message.parts
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('\n')
    .trim();
}

export function getLatestMessageTextByRole(messages: UIMessage[], role: UIMessage['role']) {
  const message = [...messages].reverse().find(candidate => candidate.role === role);
  return message ? getMessageText(message) : '';
}

export function buildMemorySummary(userPrompt: string, assistantResponse: string) {
  const summary = `用户问题：${userPrompt.trim()}\n回复文案：${assistantResponse.trim()}`.trim();
  return summary.slice(0, 1500);
}

export function buildRagContext(matches: ChatMemoryMatch[]) {
  if (matches.length === 0) return '';

  return [
    '以下是可参考的收藏问答样本，只用于补充风格与表达方式，不要逐字照抄：',
    ...matches.map((match, index) =>
      [
        `样本 ${index + 1}：`,
        `用户需求：${match.user_prompt}`,
        `参考文案：${match.assistant_response}`,
      ].join('\n'),
    ),
  ].join('\n\n');
}
