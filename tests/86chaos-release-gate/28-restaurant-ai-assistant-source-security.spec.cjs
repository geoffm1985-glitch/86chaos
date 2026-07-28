const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { APP_ROOT, CAPABILITIES, hasFeature, attachJson } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('28 Restaurant AI Assistant source and permission contract', () => {
  test('assistant features remain review-first, permission-aware, and free of client-side provider secrets', async ({}, testInfo) => {
    test.skip(!(hasFeature('aiOrderAssistant') || hasFeature('restaurantAiAssistants')), 'Restaurant AI Assistants are not present in this app version.');
    const read = (rel) => { try { return fs.readFileSync(path.join(APP_ROOT, rel), 'utf8'); } catch (_) { return ''; } };
    const files = [
      'src/core/aiOrderAssistant.js',
      'src/components/common.jsx',
      'src/features/inventory.jsx',
      'src/features/operations.jsx',
      'api/_ai-policy.js',
      'api/_ai-usage.js',
      'api/voice-command.js',
    ];
    const existing = files.filter(rel => fs.existsSync(path.join(APP_ROOT, rel)));
    const source = existing.map(read).join('\n');
    const checks = {
      hasAssistantImplementation: /assistant|recommendation|intelligence/i.test(source),
      reviewFirstLanguage: /review|draft|confirm|approval|manager/i.test(source),
      permissionOrPlanGate: /permission|plan|role|canAccess|featureGate|entitlement/i.test(source),
      noClientProviderSecret: !/(?:OPENAI|GEMINI|ANTHROPIC|AI)_API_KEY\s*[:=]\s*['"][^'"]+['"]/i.test(existing.filter(f => f.startsWith('src/')).map(read).join('\n')),
      noAutomaticOrderClaim: !/automatically\s+(?:send|submit|place).{0,40}order/i.test(source),
      noAutomaticPayrollClaim: !/automatically\s+(?:send|submit|run).{0,40}payroll/i.test(source),
    };
    await attachJson(testInfo, '28-restaurant-ai-assistant-source-security.json', { capabilities: CAPABILITIES, existing, checks });
    expect(Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name), 'Restaurant AI Assistant contract failed').toEqual([]);
  });
});
