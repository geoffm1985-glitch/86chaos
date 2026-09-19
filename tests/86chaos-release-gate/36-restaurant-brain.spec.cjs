const { test, expect } = require('@playwright/test');
const { runBrutalScenario } = require('../../test-tools/restaurant-brain-fixture.cjs');
test('brutal restaurant scanner E2E preserves human approval through menu impact and advisory ordering', async ({}, testInfo) => {
  const evidence = await runBrutalScenario();
  expect(evidence.paidCalls).toBe(0);
  await testInfo.attach('restaurant-brain-evidence.json', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
});
