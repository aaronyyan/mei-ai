import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPlatformStylePrompt } from '../lib/platform-style.ts';

test('buildPlatformStylePrompt adds xiaohongshu guidance', () => {
  const prompt = buildPlatformStylePrompt('给我一版小红书风格的医美文案');

  assert.match(prompt, /硬约束/);
  assert.match(prompt, /3-6 个 emoji/);
  assert.match(prompt, /3-6 个短段落/);
  assert.match(prompt, /口语化/);
  assert.match(prompt, /不要像海报主文案/);
});

test('buildPlatformStylePrompt returns empty string for generic prompts', () => {
  assert.equal(buildPlatformStylePrompt('给我一条玻尿酸广告文案'), '');
});
