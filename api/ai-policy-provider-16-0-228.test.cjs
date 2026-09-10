const { test } = require('node:test'); const assert = require('node:assert/strict');
const policy = require('./_ai-policy'); const provider = require('./_ai-provider');
const { fakeFirestore } = require('../test-tools/fakeFirestore.cjs');
const { completeAiScanUsageEvent } = require('./_ai-usage');
const contract = (feature = 'invoice', env = {}) => policy.resolveAiPolicy({ feature, route: policyRoute(feature), env });
const policyRoute = feature => ({ invoice: '/api/scan-invoice', menu: '/api/scan-menu', recipe: '/api/scan', diagnostics: '/api/openai-diagnostics-explain' })[feature];
for (const model of ['astra', 'sol', 'gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.5-pro', 'gpt-5.5 Pro', 'gpt-6', 'gpt-99', 'gpt-5.5-future', 'o3-pro', 'unknown']) {
  test(`customer model ${model} fails closed before provider execution`, () => assert.throws(() => contract('invoice', { CUSTOMER_OPENAI_MODEL: model }), { code: 'AI_MODEL_NOT_ALLOWED' }));
}
for (const model of ['gpt-5-mini', 'gpt-5.5', 'gpt-5.5-2026-04-23']) test(`explicit customer model allowlist accepts ${model}`, () => assert.equal(contract('invoice', { INVOICE_OPENAI_MODEL: model }).model, model));
for (const request of [{ body: JSON.stringify({ model: 'astra' }) }, { body: { model: 'astra' } }, { body: { reasoning: { effort: 'xhigh' } } }, { query: { model: 'gpt-5.5-pro' } }, { headers: { 'x-ai-model': 'sol' } }, { body: { options: { model: 'gpt-6' } } }, { body: { model: 'low' } }, { body: { provider: 'untrusted' } }]) {
  test(`client cannot override approved selection ${JSON.stringify(request)}`, () => {
    const inputBody = { ...(typeof request.body === 'string' ? JSON.parse(request.body) : request.body), prompt: 'PRIVATE INVOICE', apiKey: 'SECRET' };
    const logs = []; assert.throws(() => policy.enforceClientAiSelection({ ...request, body: typeof request.body === 'string' ? JSON.stringify(inputBody) : inputBody }, contract(), { uid: 'u', restaurantId: 'r' }, row => logs.push(row)), { code: 'AI_CLIENT_OVERRIDE_BLOCKED' });
    assert.equal(logs.length, 1); assert(!logs[0].includes('PRIVATE INVOICE')); assert(!logs[0].includes('SECRET'));
  });
}
test('internal diagnostic authority is required and does not lift the customer workflow ceiling', () => {
  assert.throws(() => policy.resolveAiPolicy({ feature: 'diagnostics', route: policyRoute('diagnostics'), authority: { isSuperAdmin: true }, env: {} }), { code: 'AI_INTERNAL_ONLY' });
  const authority = { ok: true, isSuperAdmin: true, decoded: { uid: 'internal' } };
  const diagnostic = policy.resolveAiPolicy({ feature: 'diagnostics', route: policyRoute('diagnostics'), authority, env: {} }); assert.equal(diagnostic.actorType, 'internal-diagnostic');
  assert.throws(() => policy.resolveAiPolicy({ feature: 'diagnostics', route: policyRoute('diagnostics'), authority, env: { OPENAI_DIAGNOSTICS_MODEL: 'gpt-5.5' } }), { code: 'AI_MODEL_NOT_ALLOWED' });
  assert.throws(() => policy.resolveAiPolicy({ feature: 'invoice', route: policyRoute('invoice'), authority, env: { CUSTOMER_OPENAI_MODEL: 'gpt-6-astra' } }), { code: 'AI_MODEL_NOT_ALLOWED' });
  assert.equal(policy.resolveAiPolicy({ feature: 'invoice', route: policyRoute('invoice'), authority, env: {} }).actorType, 'customer');
  assert.throws(() => policy.resolveAiPolicy({ feature: 'invoice', route: '/api/custom-model', env: {} }), { code: 'AI_ROUTE_NOT_ALLOWED' });
});
const schema = { type: 'object', properties: { confidence: { type: 'string' } }, required: ['confidence'], additionalProperties: false };
const success = confidence => ({ ok: true, json: async () => ({ status: 'completed', usage: { input_tokens: 30, output_tokens: 12 }, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ confidence }) }] }] }) });
test('OpenAI is primary; low confidence never escalates or invokes fallback', async () => {
  const c = contract('invoice', { AI_SCANNER_GEMINI_FALLBACK: 'true' }); const budget = policy.createProviderCallBudget('invoice'); let fallbacks = 0;
  const result = await provider.scanWithPrimaryProvider({ contract: c, budget, env: { OPENAI_API_KEY: 'mock' }, schema, prompt: 'test', fetchImpl: async (url, options) => { const body = JSON.parse(options.body); assert.equal(body.model, c.model); assert.equal(body.reasoning.effort, 'low'); assert.equal(body.store, false); assert.equal(body.max_output_tokens, 32768); return success('low'); }, fallback: () => { fallbacks++; } });
  assert.equal(result.provider, 'openai'); assert.equal(fallbacks, 0); assert.equal(budget.used, 1); assert.equal(budget.inputTokens, 30);
});
test('controlled Gemini transport fallback shares the original two-call invoice budget', async () => {
  const c = contract('invoice', { AI_SCANNER_GEMINI_FALLBACK: 'true' }); const budget = policy.createProviderCallBudget('invoice');
  const result = await provider.scanWithPrimaryProvider({ contract: c, budget, env: { OPENAI_API_KEY: 'mock' }, schema, prompt: 'test', fetchImpl: async () => { throw new Error('offline'); }, fallback: async b => { b.consume({ provider: 'gemini', model: 'gemini-2.5-flash-lite' }); return { provider: 'gemini' }; } });
  assert.equal(result.provider, 'gemini'); assert.equal(budget.used, 2); assert.deepEqual(budget.attempts.map(row => row.provider), ['openai', 'gemini']);
  assert.throws(() => budget.consume({ provider: 'openai', model: 'gpt-5.5' }), { code: 'AI_PROVIDER_CALL_LIMIT' });
});
test('fallback is off by default and a menu failure cannot exceed its one-call budget', async () => {
  for (const c of [contract(), contract('menu', { AI_SCANNER_GEMINI_FALLBACK: 'true' })]) {
    let fallback = 0; const budget = policy.createProviderCallBudget(c.feature);
    await assert.rejects(provider.scanWithPrimaryProvider({ contract: c, budget, env: { OPENAI_API_KEY: 'mock' }, schema, fetchImpl: async () => { throw new Error('outage'); }, fallback: () => { fallback++; } }), { code: 'AI_PROVIDER_TRANSPORT' });
    assert.equal(fallback, 0); assert.equal(budget.used, 1);
  }
});
test('a declared outage can route menu extraction to Gemini before spending its call', async () => {
  const c = contract('menu', { AI_SCANNER_GEMINI_FALLBACK: 'true' }); const budget = policy.createProviderCallBudget('menu');
  const result = await provider.scanWithPrimaryProvider({ contract: c, budget, env: { AI_OPENAI_SCANNER_UNAVAILABLE: 'true' }, fetchImpl: () => { throw new Error('OpenAI must not execute'); }, fallback: async b => { b.consume({ provider: 'gemini', model: 'gemini-2.5-flash-lite' }); return { provider: 'gemini' }; } });
  assert.equal(result.provider, 'gemini'); assert.equal(budget.used, 1);
});
test('invalid structured output is not silently accepted or sent up an escalation ladder', async () => {
  const budget = policy.createProviderCallBudget('invoice'); let fallback = false;
  await assert.rejects(provider.scanWithPrimaryProvider({ contract: contract('invoice', { AI_SCANNER_GEMINI_FALLBACK: 'true' }), budget, schema, env: { OPENAI_API_KEY: 'mock' }, fetchImpl: async () => ({ ok: true, json: async () => ({ status: 'completed', usage: { input_tokens: 7, output_tokens: 8 }, output: [{ type: 'message', content: [{ type: 'output_text', text: '{}' }] }] }) }), fallback: () => { fallback = true; } }), { code: 'AI_STRUCTURED_RESULT_INVALID' });
  assert.equal(fallback, false); assert.equal(budget.inputTokens, 7); assert.equal(budget.outputTokens, 8);
});
test('usage evidence includes provider, model, token counts, attempts, and safe failures', async () => {
  const db = fakeFirestore(); const ref = db.collection('aiUsage').doc('r_month').collection('events').doc('event');
  await completeAiScanUsageEvent({ db, reservation: { eventRef: ref }, status: 'completed', provider: 'openai', model: 'gpt-5-mini', estimatedInputTokens: 30, estimatedOutputTokens: 12, providerCallCount: 1, attempts: [{ number: 1, provider: 'openai', model: 'gpt-5-mini', attempt: 'extraction', inputTokens: 30, outputTokens: 12 }] });
  const event = db.records.get(ref.path); assert.equal(event.provider, 'openai'); assert.equal(event.estimatedOutputTokens, 12); assert.equal(event.providerAttempts[0].inputTokens, 30);
});
test('hard byte/page/token/request/provider limits remain bounded', () => {
  assert.equal(policy.getHardOutputTokenLimit('invoice', 999999), 32768); assert.equal(policy.getHardRateLimit('invoice', 999), 8);
  assert.equal(policy.getFeaturePolicy('invoice').maxPagesPerRequest, 40); assert.equal(policy.getFeaturePolicy('menu').maxPagesPerRequest, 10);
  assert.throws(() => policy.assertInputWithinHardLimit('invoice', 21 * 1024 * 1024));
  const budget = policy.createProviderCallBudget('invoice'); assert.throws(() => budget.consume({ provider: 'openai', model: 'gpt-6' }), { code: 'AI_MODEL_NOT_ALLOWED' }); assert.equal(budget.used, 0);
});
