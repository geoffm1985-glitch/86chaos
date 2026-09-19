'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
process.env.HELP_ASSISTANT_DISABLE_AI = 'true';
const { _test } = require('./help-assistant.js');

test('Ask 86 validates model article and deep-link IDs against customer registries', () => {
  const result = _test.validateModelResponse({
    answer: 'Use Schedule Builder.',
    sourceArticleIds: ['schedule-builder-find', 'fake-internal'],
    suggestedDeepLinkIds: ['schedule-builder', 'system-admin-danger'],
    confidence: 0.9
  }, { sourceArticleIds: [], suggestedDeepLinkIds: [] });
  assert.deepEqual(result.sourceArticleIds, ['schedule-builder-find']);
  assert.deepEqual(result.suggestedDeepLinkIds, ['schedule-builder']);
});

test('Ask 86 bounded history and question length controls work', async () => {
  const hist = Array.from({ length: 12 }, (_, i) => ({ role: 'user', text: `turn ${i}` }));
  assert.equal(_test.boundedHistory(hist).length, 6);
  const tooLong = await _test.answerHelpQuestion({ question: 'x'.repeat(1300), history: hist });
  assert.equal(tooLong.ok, false);
  assert.equal(tooLong.code, 'question-too-long');
});

test('Ask 86 deterministic fallback answers from approved customer Help', async () => {
  const result = await _test.answerHelpQuestion({ question: 'Why is my app icon gray?' });
  assert.equal(result.ok, true);
  assert.equal(result.fallback, true);
  assert.ok(result.sourceArticleIds.includes('app-icon-gray'));
  assert.ok(!/Firebase|Firestore|System Administrator tools|Ghost Mode/i.test(result.answer));
});

test('Ask 86 rate limit is bounded per key', () => {
  _test.buckets.clear();
  let ok = true;
  for (let i = 0; i < 12; i++) ok = _test.checkRateLimit('rate-user', 1000);
  assert.equal(ok, true);
  assert.equal(_test.checkRateLimit('rate-user', 1000), false);
});
