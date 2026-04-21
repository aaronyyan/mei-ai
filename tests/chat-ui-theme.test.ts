import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHAT_UI_COPY,
  CHAT_UI_THEME,
  buildThreadMetaLabel,
} from '../lib/chat-ui-theme.ts';

test('chat ui theme uses neutral ChatGPT-like tokens', () => {
  assert.equal(CHAT_UI_THEME.appBackground, '#f7f7f3');
  assert.equal(CHAT_UI_THEME.mainSurface, '#fcfcf9');
  assert.equal(CHAT_UI_THEME.sidebarSurface, '#efeee8');
  assert.equal(CHAT_UI_THEME.sidebarBorder, '#dfddd3');
  assert.equal(CHAT_UI_THEME.border, '#dcd9cf');
  assert.equal(CHAT_UI_THEME.textPrimary, '#171717');
  assert.equal(CHAT_UI_THEME.textSecondary, '#57534e');
  assert.equal(CHAT_UI_THEME.textOnDark, '#ffffff');
  assert.equal(CHAT_UI_THEME.accent, '#171717');
  assert.equal(CHAT_UI_THEME.accentHover, '#2a2a2a');
  assert.equal(CHAT_UI_THEME.accentSoft, '#eceae1');
});

test('chat ui copy stays minimal and neutral', () => {
  assert.equal(CHAT_UI_COPY.appName, 'Mei AI');
  assert.equal(CHAT_UI_COPY.composerPlaceholder, '给 Mei AI 发送消息');
  assert.equal(CHAT_UI_COPY.sendLabel, '发送');
  assert.equal(CHAT_UI_COPY.loadingLabel, '正在思考');
});

test('buildThreadMetaLabel returns Today for same-day chats', () => {
  const now = new Date('2026-04-21T09:00:00+08:00').getTime();
  const sameDay = new Date('2026-04-21T21:30:00+08:00').getTime();

  assert.equal(buildThreadMetaLabel(sameDay, now), '今天');
});

test('buildThreadMetaLabel formats non-today chats as month/day', () => {
  const now = new Date('2026-04-21T09:00:00+08:00').getTime();
  const previousDay = new Date('2026-04-18T21:30:00+08:00').getTime();

  assert.equal(buildThreadMetaLabel(previousDay, now), '4月18日');
});
