const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab, bodyText, attachJson } = require('./utils/audit-helpers.cjs');

test.describe('14 exports/imports and permanent regression graveyard', () => {
  test('export/import surfaces are reachable and exported-total screens do not show broken values', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const schedule = await gotoTab(page, 'schedule', { settleMs: 1500, maxText: 50000 });
    const financials = await gotoTab(page, 'financials', { settleMs: 1500, maxText: 60000 });
    const inventory = await gotoTab(page, 'inventory', { settleMs: 1500, maxText: 60000 });
    const joined = `${schedule}\n${financials}\n${inventory}`;
    await attachJson(testInfo, '14-export-import-surfaces.json', { schedule: schedule.slice(0, 4000), financials: financials.slice(0, 5000), inventory: inventory.slice(0, 5000) });
    expect(joined).toMatch(/export|csv|pdf|import|template|download|upload/i);
    expect(joined).not.toMatch(/Invalid Date|Infinity|undefined undefined|null null|\$NaN|NaN%|(?:^|[^A-Za-z])NaN(?:[^A-Za-z]|$)/i);
  });

  test('known bug graveyard stays dead: no AppleWebKit, fake dependency, preview mic label, broken presence/math strings, or bad System Admin label', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const tabs = ['today', 'schedule', 'events', 'godmode', 'financials', 'messages'];
    const samples = {};
    for (const tab of tabs) samples[tab] = (await gotoTab(page, tab, { settleMs: 1300, maxText: 40000 })).slice(0, 10000);
    const joined = Object.values(samples).join('\n');
    const findings = [];
    const checks = [
      ['raw AppleWebKit user agent', /Mozilla\/5\.0|AppleWebKit|KHTML, like Gecko/],
      ['presence all-online stale label', /Seen Active Today[\s\S]{0,80}\bONLINE\b/i],
      ['negative inactive days', /Inactive -\d+ days/i],
      ['mic preview label', /(?:microphone|\bmic\b|86\s*voice|voice assistant|86voice)[\s\S]{0,120}\bPREVIEW\b|\bPREVIEW\b[\s\S]{0,120}(?:microphone|\bmic\b|86\s*voice|voice assistant|86voice)/i],
      ['System Admin Branding / Display', /Branding\s*\/\s*Display/i],
      ['bad values', /Invalid Date|Infinity|undefined undefined|null null|\$NaN|NaN%|(?:^|[^A-Za-z])NaN(?:[^A-Za-z]|$)/i],
      ['bad package tarball visible', /@types\/yargs-16\.0\.12\.tgz/i],
    ];
    for (const [label, re] of checks) if (re.test(joined)) findings.push(label);
    await attachJson(testInfo, '14-regression-graveyard.json', { findings, samples });
    expect(findings, 'Known fixed bugs should not reappear anywhere visible in the tested surfaces').toEqual([]);
  });
});
