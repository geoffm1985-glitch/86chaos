'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const help = require('../src/core/customerHelpKnowledge.cjs');

test('customer Help corpus validates with no internal-content violations', () => {
  const result = help.validateCustomerHelpCorpus();
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.errors.length, 0);
  assert.ok(result.counts.articles >= 50);
  assert.ok(result.counts.coveragePercent >= 95);
});

test('customer Help deep links all resolve to registered destinations', () => {
  const result = help.validateDeepLinks();
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.ok(result.total >= 20);
});

test('natural customer questions return useful top articles', () => {
  const cases = [
    ['why aren\'t my schedules publishing', 'schedule-publish'],
    ['employee can\'t see schedule', 'schedule-visibility'],
    ['how do I request off', 'request-off-how'],
    ['can\'t clock in', 'clock-in-help'],
    ['where is schedule builder', 'schedule-builder-find'],
    ['invoice didnt scan', 'invoice-scan-failed'],
    ['how do i install the app', 'install-app'],
    ['app icon is gray', 'app-icon-gray'],
    ['86voice cant hear me', 'voice-not-hearing'],
    ['where is back office', 'back-office-use']
  ];
  for (const [question, expected] of cases) {
    const [top] = help.searchCustomerHelp(question, { limit: 3 });
    assert.ok(top, question);
    assert.equal(top.id, expected, `${question} -> ${top.id}`);
  }
});

test('direct answer card is grounded in customer articles', () => {
  const answer = help.makeDeterministicHelpAnswer('Why aren\'t my schedules publishing?');
  assert.equal(answer.ok, true);
  assert.ok(answer.answer.includes('Schedules usually stay unpublished'));
  assert.ok(answer.sourceArticleIds.includes('schedule-publish'));
  assert.ok(answer.suggestedDeepLinkIds.includes('schedule-builder'));
});

test('coverage matrix has no customer-facing primary route with zero coverage', () => {
  const coverage = help.buildCustomerHelpCoverage();
  assert.ok(coverage.length >= 20);
  assert.deepEqual(coverage.filter(row => row.mappedArticleIds.length === 0), []);
});

test('customer Help version and Custom Shift questions are current for 16.0.147', () => {
  assert.equal(help.CUSTOMER_HELP_VERSION, '16.0.147');
  const result = help.validateCustomerHelpCorpus();
  assert.equal(result.ok, true, result.errors.join('\n'));
  const [top] = help.searchCustomerHelp("why aren't my saved shifts on my phone", { limit: 3 });
  assert.ok(top);
  assert.equal(top.id, 'custom-shifts-on-phone');
  assert.ok(top.deepLinkIds.includes('schedule-builder'));
});
