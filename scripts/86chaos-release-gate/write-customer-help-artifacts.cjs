'use strict';
const fs = require('fs');
const path = require('path');
const help = require('../../src/core/customerHelpKnowledge.cjs');
function writeJson(rel, data) {
  const out = path.join(process.cwd(), rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(data, null, 2) + '\n');
  return out;
}
function buildAskValidation() {
  const questions = [
    'why aren\'t my schedules publishing',
    'employee can\'t see schedule',
    'how do I request off',
    'can\'t clock in',
    'where is schedule builder',
    'invoice didnt scan',
    'how do i install the app',
    'app icon is gray',
    '86voice cant hear me',
    'where is back office'
  ];
  const searchResults = questions.map(question => ({ question, topArticleIds: help.searchCustomerHelp(question, { limit: 3 }).map(a => a.id), answer: help.makeDeterministicHelpAnswer(question) }));
  return { ok: searchResults.every(r => r.topArticleIds.length > 0), version: help.CUSTOMER_HELP_VERSION, generatedAt: new Date().toISOString(), searchResults, grounding: { corpus: 'customer-help-only', firestoreAccess: false, storesConversation: false, validatesArticleIds: true, validatesDeepLinkIds: true } };
}
function main() {
  const coverage = { version: help.CUSTOMER_HELP_VERSION, generatedAt: new Date().toISOString(), coverage: help.buildCustomerHelpCoverage() };
  const validation = help.validateCustomerHelpCorpus();
  const ask = buildAskValidation();
  writeJson('public/customer-help-coverage.json', coverage);
  writeJson('public/customer-help-validation.json', validation);
  writeJson('public/ask-86-help-validation.json', ask);
  console.log(JSON.stringify({ ok: validation.ok && ask.ok, coverageCount: coverage.coverage.length, articles: help.CUSTOMER_HELP_ARTICLES.length }, null, 2));
  if (!validation.ok || !ask.ok) process.exit(1);
}
if (require.main === module) main();
module.exports = { buildAskValidation };
