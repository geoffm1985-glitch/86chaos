# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 86chaos-full-audit\10-presence-system-admin.spec.cjs >> 10 presence / Online Last Seen / System Administrator >> Online / Last Seen uses honest labels and never raw AppleWebKit/Mozilla soup or negative inactivity
- Location: tests\86chaos-full-audit\10-presence-system-admin.spec.cjs:5:3

# Error details

```
Error: System Administrator should include Online/Last Seen or People Directory presence surface

expect(received).toMatch(expected)

Expected pattern: /Online|Last Seen|Recently Active|Active Today|People Directory/i
Received string:  "Choose Workspace·
Pick which restaurant you are working in right now.·
86 Chaos Release Gate QA 2026-08-04T15-57-57·
KITCHEN • 88S1PJABUTDBBUNECXXE·
86 Chaos Release Gate QA 2026-08-08T20-23-04·
KITCHEN • QA_2026-08-08T20-23-04·
86 Chaos Release Gate QA 2026-08-11T16-24-32·
KITCHEN • QA_2026-08-11T16-24-32·
BACK TO LOGIN"
```

# Page snapshot

```yaml
- generic [ref=e6]:
  - img "86 Chaos OS Logo" [ref=e7]
  - generic [ref=e8]:
    - generic [ref=e9]:
      - heading "Choose Workspace" [level=2] [ref=e10]
      - paragraph [ref=e11]: Pick which restaurant you are working in right now.
    - generic [ref=e12]:
      - button "Open 86 Chaos Release Gate QA 2026-08-04T15-57-57Kitchen • 88S1pJabUtDBbunECxXE" [ref=e13] [cursor=pointer]:
        - paragraph [ref=e14]: 86 Chaos Release Gate QA 2026-08-04T15-57-57
        - paragraph [ref=e15]: Kitchen • 88S1pJabUtDBbunECxXE
      - button "Open 86 Chaos Release Gate QA 2026-08-08T20-23-04Kitchen • qa_2026-08-08T20-23-04" [ref=e16] [cursor=pointer]:
        - paragraph [ref=e17]: 86 Chaos Release Gate QA 2026-08-08T20-23-04
        - paragraph [ref=e18]: Kitchen • qa_2026-08-08T20-23-04
      - button "Open 86 Chaos Release Gate QA 2026-08-11T16-24-32Kitchen • qa_2026-08-11T16-24-32" [ref=e19] [cursor=pointer]:
        - paragraph [ref=e20]: 86 Chaos Release Gate QA 2026-08-11T16-24-32
        - paragraph [ref=e21]: Kitchen • qa_2026-08-11T16-24-32
    - button "Back to Login" [ref=e22] [cursor=pointer]
```

# Test source

```ts
  1  | const { test, expect } = require('@playwright/test');
  2  | const { ownerLikeCreds, creds, requireCreds, login, gotoTab, bodyText, attachJson, watchForProblems, summarizeProblems } = require('./utils/audit-helpers.cjs');
  3  | 
  4  | test.describe('10 presence / Online Last Seen / System Administrator', () => {
  5  |   test('Online / Last Seen uses honest labels and never raw AppleWebKit/Mozilla soup or negative inactivity', async ({ page }, testInfo) => {
  6  |     const account = creds('SYSTEM_ADMIN').email ? creds('SYSTEM_ADMIN') : ownerLikeCreds();
  7  |     requireCreds(account, 'system admin or owner-like account');
  8  |     const problems = [];
  9  |     watchForProblems(page, problems);
  10 |     await login(page, account.email, account.password);
  11 |     const text = await gotoTab(page, 'godmode', { settleMs: 2500, maxText: 70000 });
  12 |     const lower = text.toLowerCase();
  13 |     await attachJson(testInfo, '10-presence-system-admin.json', { sample: text.slice(0, 10000), problems: summarizeProblems(problems) });
  14 |     if (!/permission gate|not authorized|does not include/i.test(lower)) {
> 15 |       expect(text, 'System Administrator should include Online/Last Seen or People Directory presence surface').toMatch(/Online|Last Seen|Recently Active|Active Today|People Directory/i);
     |                                                                                                                 ^ Error: System Administrator should include Online/Last Seen or People Directory presence surface
  16 |       expect(text, 'Presence UI should not expose raw user-agent soup').not.toMatch(/Mozilla\/5\.0|AppleWebKit|KHTML, like Gecko/i);
  17 |       expect(text, 'Presence UI should never say Inactive -1 days or other negative day counts').not.toMatch(/Inactive -\d+ days/i);
  18 |       expect(text, 'Presence UI should split fresh online from stale activity').toMatch(/Online Now|Recently Active|Active Today|Last Seen/i);
  19 |       expect(text, 'RTDB 404 should be friendly fallback, not scary raw detail').not.toMatch(/RTDB REST 404|FirebaseError.*404/i);
  20 |     }
  21 |     expect(problems.filter(p => p.type === 'http-5xx'), 'Presence/System Admin should not produce API 500/504 responses').toEqual([]);
  22 |   });
  23 | 
  24 |   test('System Administrator danger actions are protected by typed confirmation wording', async ({ page }, testInfo) => {
  25 |     const account = creds('SYSTEM_ADMIN').email ? creds('SYSTEM_ADMIN') : ownerLikeCreds();
  26 |     requireCreds(account, 'system admin or owner-like account');
  27 |     await login(page, account.email, account.password);
  28 |     const text = await gotoTab(page, 'godmode', { settleMs: 2200, maxText: 70000 });
  29 |     await attachJson(testInfo, '10-system-admin-danger.json', { sample: text.slice(0, 9000) });
  30 |     if (!/permission gate|not authorized|does not include/i.test(text)) {
  31 |       expect(text, 'System Admin should not show Branding / Display nav label').not.toMatch(/Branding\s*\/\s*Display/i);
  32 |       expect(text, 'Dangerous admin actions should require typed confirmation or explicit confirmation language').toMatch(/confirm|type|LOG OUT USERS|danger|irreversible|Are you sure/i);
  33 |     }
  34 |   });
  35 | });
  36 | 
```