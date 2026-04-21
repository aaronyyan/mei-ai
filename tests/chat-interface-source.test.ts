import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(
  join(process.cwd(), 'components/chat-interface.tsx'),
  'utf8',
);

test('chat interface uses a ChatGPT-like shell structure', () => {
  assert.match(source, /hidden w-\[280px\] shrink-0 lg:block/);
  assert.match(
    source,
    /fixed inset-0 z-40 transition-opacity duration-300 ease-\[cubic-bezier\(0\.22,1,0\.36,1\)\] lg:hidden/,
  );
  assert.match(source, /className="flex min-w-0 flex-1"/);
  assert.match(source, /aria-label="更多操作"/);
  assert.match(source, /删除对话/);
});

test('chat interface keeps a compact ChatGPT-like composer', () => {
  assert.match(source, /CHAT_UI_COPY\.loadingLabel/);
  assert.match(
    source,
    /rounded-\[32px\] border bg-white\/96 p-3 shadow-\[0_18px_60px_rgba\(23,23,23,0\.10\)\] backdrop-blur/,
  );
  assert.match(source, /inline-flex h-11 w-11 items-center justify-center rounded-full text-white/);
  assert.match(
    source,
    /bg-\[linear-gradient\(to_top,rgba\(247,247,243,1\),rgba\(247,247,243,0\)\)\]/,
  );
});

test('chat interface prioritizes text-first assistant messages', () => {
  assert.match(source, /max-w-\[85%\] rounded-\[28px\]/);
  assert.match(source, /const AssistantBubble = memo\(function AssistantBubble/);
  assert.doesNotMatch(source, /boxShadow: "0 18px 46px/);
});
