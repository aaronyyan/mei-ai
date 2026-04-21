import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDeterministicEmbedding,
  buildMemorySummary,
  buildRagContext,
  serializeEmbedding,
} from '../lib/chat-memory.ts';

test('buildDeterministicEmbedding is stable and normalized', () => {
  const first = buildDeterministicEmbedding('玻尿酸填充 自然轮廓');
  const second = buildDeterministicEmbedding('玻尿酸填充 自然轮廓');
  const magnitude = Math.hypot(...first);

  assert.equal(first.length, 256);
  assert.deepEqual(first, second);
  assert.ok(Math.abs(magnitude - 1) < 0.00001);
});

test('serializeEmbedding returns pgvector-compatible text', () => {
  assert.equal(serializeEmbedding([0.5, -0.25, 0]), '[0.5,-0.25,0]');
});

test('buildMemorySummary merges prompt and response', () => {
  const summary = buildMemorySummary('想做玻尿酸', '标题：自然立体\n正文：轮廓更顺。');

  assert.match(summary, /用户问题：想做玻尿酸/);
  assert.match(summary, /回复文案：标题：自然立体/);
});

test('buildRagContext formats favorite samples', () => {
  const context = buildRagContext([
    {
      id: '1',
      session_id: 'session-1',
      region: 'CN',
      user_prompt: '想做玻尿酸广告',
      assistant_response: '标题：轮廓自然\n正文：线条更柔和。',
      summary: 'summary',
      similarity: 0.98,
      metadata: null,
      created_at: '2026-04-21T00:00:00Z',
    },
  ]);

  assert.match(context, /收藏问答样本/);
  assert.match(context, /用户需求：想做玻尿酸广告/);
  assert.match(context, /参考文案：标题：轮廓自然/);
});
