import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveThreadTitle, getMessagesSignature } from '../lib/chat-threads.ts';

test('deriveThreadTitle prefers the generated title in assistant output', () => {
  const title = deriveThreadTitle([
    {
      id: 'user-1',
      role: 'user',
      parts: [{ type: 'text', text: '给我一条玻尿酸广告文案' }],
    },
    {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: '标题：自然轮廓感，刚刚好\n\n正文：更立体，也更自然。',
        },
      ],
    },
  ]);

  assert.equal(title, '自然轮廓感，刚刚好');
});

test('deriveThreadTitle falls back to the first user message before assistant reply exists', () => {
  const title = deriveThreadTitle([
    {
      id: 'user-1',
      role: 'user',
      parts: [{ type: 'text', text: '给我一条玻尿酸广告文案' }],
    },
  ]);

  assert.equal(title, '给我一条玻尿酸广告文案');
});

test('getMessagesSignature changes when assistant text is filled later', () => {
  const messages = [
    {
      id: 'user-1',
      role: 'user',
      parts: [{ type: 'text', text: '给我一条玻尿酸广告文案' }],
    },
    {
      id: 'assistant-1',
      role: 'assistant',
      parts: [] as Array<{ type: 'text'; text: string }>,
    },
  ];

  const before = getMessagesSignature(messages as never);
  messages[1].parts.push({ type: 'text', text: '标题：玻尿酸自然填充' });
  const after = getMessagesSignature(messages as never);

  assert.notEqual(before, after);
});
