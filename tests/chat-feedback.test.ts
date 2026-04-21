import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveFeedbackValue } from '../lib/chat-feedback.ts';

test('resolveFeedbackValue selects a new feedback choice', () => {
  assert.equal(resolveFeedbackValue(null, 'up'), 'up');
  assert.equal(resolveFeedbackValue(undefined, 'down'), 'down');
});

test('resolveFeedbackValue toggles off when clicking the same choice again', () => {
  assert.equal(resolveFeedbackValue('up', 'up'), null);
  assert.equal(resolveFeedbackValue('down', 'down'), null);
});

test('resolveFeedbackValue switches between choices', () => {
  assert.equal(resolveFeedbackValue('up', 'down'), 'down');
  assert.equal(resolveFeedbackValue('down', 'up'), 'up');
});
