# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 86chaos-release-gate\17-resilience-chunk-offline.spec.cjs >> 17 stale chunk, offline, refresh, and service-worker resilience >> one failed lazy chunk never leaves a permanent blank screen or reload loop
- Location: tests\86chaos-release-gate\17-resilience-chunk-offline.spec.cjs:17:3

# Error details

```
Error: The test must actually intercept one lazy JavaScript chunk

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - banner [ref=f1e4]:
    - generic "86 Chaos branding is always displayed" [ref=f1e6] [cursor=pointer]:
      - img "86 Chaos app icon" [ref=f1e7]
      - img "86 Chaos" [ref=f1e8]
    - button "Switch workspace. Active workspace 86 Chaos Release Gate QA 2026-08-11T16-24-32." [ref=f1e10] [cursor=pointer]: 86 Chaos Release Gate QA 2026-08-11T16-24-32 • Switch
    - generic [ref=f1e11]:
      - button "Report a problem" [ref=f1e12] [cursor=pointer]
      - button "Open navigation menu" [ref=f1e22] [cursor=pointer]
  - button "Open 86Voice" [ref=f1e25] [cursor=pointer]
  - dialog [ref=f1e29]:
    - generic [ref=f1e30]:
      - heading "Manager Quick Start" [level=3] [ref=f1e31]
      - button "Close Manager Quick Start" [active] [ref=f1e32] [cursor=pointer]
    - generic [ref=f1e37]:
      - generic [ref=f1e38]: Step 1 of 6
      - generic [ref=f1e39]:
        - heading "Workspace Setup" [level=3] [ref=f1e40]
        - paragraph [ref=f1e41]: This quick tour gets a new restaurant ready for staff, scheduling, clock rules, backups, and Help Center training.
      - generic [ref=f1e42]:
        - button "Back" [disabled] [ref=f1e43]
        - button "Next" [ref=f1e44] [cursor=pointer]
      - button "Skip and don't show again" [ref=f1e45] [cursor=pointer]
  - main [ref=f1e46]:
    - generic "0 On Schedule 0 Clocked In 0 Needs Eyes" [ref=f1e47]
    - generic [ref=f1e48]:
      - generic [ref=f1e49]:
        - generic [ref=f1e50]:
          - textbox "Search specs or ingredients..." [ref=f1e55]
          - combobox "Recipe field AllSauce/DressingMeat PrepAppetizerEntreeSideDessertCocktail" [ref=f1e57] [cursor=pointer]:
            - option "All" [selected]
            - option "Sauce/Dressing"
            - option "Meat Prep"
            - option "Appetizer"
            - option "Entree"
            - option "Side"
            - option "Dessert"
            - option "Cocktail"
        - generic [ref=f1e58]:
          - button "Open Keep Screen On" [ref=f1e60] [cursor=pointer]:
            - generic [ref=f1e67]: Keep Awake
          - generic [ref=f1e68]:
            - generic [ref=f1e69]:
              - generic "Take Photo" [ref=f1e70] [cursor=pointer]
              - generic "Upload File" [ref=f1e74] [cursor=pointer]
            - button "New Recipe / Spec" [ref=f1e76] [cursor=pointer]
      - generic [ref=f1e78]:
        - generic [ref=f1e81] [cursor=pointer]:
          - generic [ref=f1e82]: Prep
          - heading "QA Burger Prep" [level=3] [ref=f1e87]
          - generic [ref=f1e89]:
            - generic [ref=f1e90]: 30 mins
            - generic [ref=f1e96]: "Yield: 24 patties"
        - generic [ref=f1e104] [cursor=pointer]:
          - generic [ref=f1e105]: Entree
          - heading "QA Salmon BLT" [level=3] [ref=f1e110]
          - generic [ref=f1e112]:
            - generic [ref=f1e113]: 12 mins
            - generic [ref=f1e119]: "Yield: 1 plate"
  - generic [ref=f1e125]:
    - img "86 Chaos OS" [ref=f1e126]
    - generic [ref=f1e127]: Version 16.0.197
    - generic [ref=f1e128]: © 2026 Chilton App Works LLC
```

# Test source

```ts
  9   |   watchForProblems,
  10  |   summarizeProblems,
  11  | } = require('../86chaos-full-audit/utils/audit-helpers.cjs');
  12  | 
  13  | const RECOVERY_RE = /refresh app|update available|update required|reload|try again|new version|recover/i;
  14  | const FATAL_BLANK_RE = /^\s*$|Application error|Unhandled Runtime Error|White screen/i;
  15  | 
  16  | test.describe('17 stale chunk, offline, refresh, and service-worker resilience', () => {
  17  |   test('one failed lazy chunk never leaves a permanent blank screen or reload loop', async ({ page }, testInfo) => {
  18  |     test.setTimeout(8 * 60 * 1000);
  19  |     const account = ownerLikeCreds();
  20  |     requireCreds(account, 'owner-like account');
  21  |     const problems = [];
  22  |     watchForProblems(page, problems);
  23  |     await page.addInitScript(() => {
  24  |       window.__chaosRecoveryEvents = [];
  25  |       const record = (type, detail = {}) => { try { window.__chaosRecoveryEvents.push({ type, at: Date.now(), url: location.href, ...detail }); } catch (_) {} };
  26  |       const originalReplace = window.location.replace.bind(window.location);
  27  |       window.location.replace = (url) => { record('location.replace', { target: String(url || '') }); return originalReplace(url); };
  28  |       const originalReload = window.location.reload.bind(window.location);
  29  |       window.location.reload = () => { record('location.reload'); return originalReload(); };
  30  |       const originalSetItem = window.sessionStorage.setItem.bind(window.sessionStorage);
  31  |       window.sessionStorage.setItem = (key, value) => { if (/chaosReloadAt|chunk|recovery|autoReload/i.test(String(key))) record('sessionStorage.setItem', { key: String(key), value: String(value).slice(0, 120) }); return originalSetItem(key, value); };
  32  |     });
  33  |     await login(page, account.email, account.password, { tab: 'today' });
  34  | 
  35  |     let abortedUrl = '';
  36  |     let aborted = false;
  37  |     await page.route(/\/static\/js\/.*(?:chunk|\.js)/, async route => {
  38  |       const url = route.request().url();
  39  |       if (!aborted && !/main\.|runtime-main\.|firebase-messaging-sw/i.test(url)) {
  40  |         aborted = true;
  41  |         abortedUrl = url;
  42  |         await route.abort('failed');
  43  |         return;
  44  |       }
  45  |       await route.continue();
  46  |     });
  47  | 
  48  |     const reloads = [];
  49  |     page.on('framenavigated', frame => { if (frame === page.mainFrame()) reloads.push({ at: Date.now(), url: frame.url(), note: 'supporting-evidence-only' }); });
  50  |     await page.goto(appUrl('recipes'), { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  51  |     await page.waitForFunction(() => {
  52  |       const stateNode = document.querySelector('[data-chaos-recovery-state]');
  53  |       const text = (document.body?.innerText || '').trim();
  54  |       return Boolean(stateNode || text.length > 20);
  55  |     }, null, { timeout: 15000 }).catch(() => {});
  56  |     const firstText = await bodyText(page, 30000);
  57  |     const firstUrl = page.url();
  58  | 
  59  |     const recoveryControl = page.locator('[data-chaos-recovery-state], button[aria-label*="recover" i], button:has-text("REFRESH NOW")').first();
  60  |     await recoveryControl.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  61  |     const recoveryStateNodes = await page.locator('[data-chaos-recovery-state]').evaluateAll(nodes => nodes.map(node => ({ state: node.getAttribute('data-chaos-recovery-state'), text: (node.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 500) }))).catch(() => []);
  62  |     const finalText = await bodyText(page, 30000);
  63  |     const finalUrl = page.url();
  64  |     const recoveryEvents = await page.evaluate(() => window.__chaosRecoveryEvents || []).catch(() => []);
  65  |     const parsedStateWrites = recoveryEvents
  66  |       .filter(x => x.type === 'sessionStorage.setItem' && /chunkRecoveryState|chunk|recovery/i.test(String(x.key || '')))
  67  |       .map((x) => {
  68  |         try { return { ...JSON.parse(x.value || '{}'), eventAt: x.at, key: x.key }; } catch (_) { return null; }
  69  |       })
  70  |       .filter(Boolean);
  71  |     const stateTransitions = [...recoveryStateNodes, ...parsedStateWrites.map(row => ({ state: row.stage || '', autoReloadCount: Number(row.autoReloadCount || 0), eventAt: row.eventAt, key: row.key }))];
  72  |     const maxAutoReloadCount = Math.max(0, ...stateTransitions.map(row => Number(row.autoReloadCount || 0)).filter(Number.isFinite));
  73  |     const autoRecoveryStartedTransitions = stateTransitions.filter(row => row.state === 'auto-recovery-started').length;
  74  |     const recoveryStartedAt = Math.min(...stateTransitions.filter(row => row.state === 'auto-recovery-started' && row.eventAt).map(row => row.eventAt));
  75  |     const markerWrites = recoveryEvents.filter(x => /autoReloadInFlight|autoReloadUsed|chaosReloadAt/i.test(String(x.key || '')));
  76  |     const postRecoveryNavigations = recoveryEvents.filter(x => /location\.(replace|reload)/.test(String(x.type || '')) && (!Number.isFinite(recoveryStartedAt) || Number(x.at || 0) >= recoveryStartedAt));
  77  |     const uniqueAutoReloadUsedGenerations = new Set(markerWrites.filter(x => /autoReloadUsed/i.test(String(x.key || ''))).map(x => `${x.key || ''}:${x.value || ''}`)).size;
  78  |     const automaticRecoveryAttempts = Math.max(
  79  |       maxAutoReloadCount,
  80  |       autoRecoveryStartedTransitions,
  81  |       uniqueAutoReloadUsedGenerations ? 1 : 0,
  82  |       postRecoveryNavigations.length ? 1 : 0
  83  |     );
  84  | 
  85  |     await attachJson(testInfo, '17-chunk-failure-recovery.json', {
  86  |       aborted,
  87  |       abortedUrl,
  88  |       firstUrl,
  89  |       finalUrl,
  90  |       firstText: firstText.slice(0, 5000),
  91  |       finalText: finalText.slice(0, 5000),
  92  |       reloads,
  93  |       recoveryEvents,
  94  |       stateTransitions,
  95  |       recoveryStateNodes,
  96  |       maxAutoReloadCount,
  97  |       autoRecoveryStartedTransitions,
  98  |       recoveryStartedAt: Number.isFinite(recoveryStartedAt) ? recoveryStartedAt : null,
  99  |       markerWrites,
  100 |       postRecoveryNavigations,
  101 |       uniqueAutoReloadUsedGenerations,
  102 |       logicalAutomaticAttemptCount: automaticRecoveryAttempts,
  103 |       automaticRecoveryAttempts,
  104 |       firstNonemptyRecoveryUi: recoveryStateNodes[0]?.state || '',
  105 |       finalRouteState: finalUrl,
  106 |       problems: summarizeProblems(problems),
  107 |     });
  108 | 
> 109 |     expect(aborted, 'The test must actually intercept one lazy JavaScript chunk').toBe(true);
      |                                                                                   ^ Error: The test must actually intercept one lazy JavaScript chunk
  110 |     expect(firstText, 'Chunk failure must not produce a blank or fatal-only screen').not.toMatch(FATAL_BLANK_RE);
  111 |     expect(finalText, 'Repeated chunk failure must provide a usable update/recovery action').toMatch(RECOVERY_RE);
  112 |     expect(maxAutoReloadCount, 'Chunk recovery structured autoReloadCount must never exceed one').toBeLessThanOrEqual(1);
  113 |     expect(autoRecoveryStartedTransitions, 'Chunk recovery should start automatic recovery at most once').toBeLessThanOrEqual(1);
  114 |     expect(automaticRecoveryAttempts, 'Chunk recovery must not enter an infinite reload loop').toBeLessThanOrEqual(1);
  115 |   });
  116 | 
  117 |   test('brief offline period recovers without logout or permanent broken state', async ({ page, context }, testInfo) => {
  118 |     const account = ownerLikeCreds();
  119 |     requireCreds(account, 'owner-like account');
  120 |     await login(page, account.email, account.password, { tab: 'today' });
  121 |     const before = page.url();
  122 |     await context.setOffline(true);
  123 |     await page.goto(appUrl('inventory'), { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  124 |     await page.waitForTimeout(1200);
  125 |     const offlineText = await bodyText(page, 20000);
  126 |     await context.setOffline(false);
  127 |     await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  128 |     await page.waitForTimeout(2500);
  129 |     const recoveredText = await bodyText(page, 30000);
  130 |     await attachJson(testInfo, '17-offline-recovery.json', { before, offlineUrl: page.url(), offlineText: offlineText.slice(0, 4000), recoveredText: recoveredText.slice(0, 6000) });
  131 |     expect(recoveredText).not.toMatch(FATAL_BLANK_RE);
  132 |     expect(recoveredText).not.toMatch(/Email Address\s*Password|Unlock System/i);
  133 |   });
  134 | 
  135 |   test('HTML, version metadata, and service worker use safe deployment cache headers', async ({ request }, testInfo) => {
  136 |     const base = process.env.APP_URL || process.env.CHAOS_BASE_URL || process.env.BASE_URL;
  137 |     const urls = [
  138 |       new URL('/', base).toString(),
  139 |       new URL('/version.json', base).toString(),
  140 |       new URL('/firebase-messaging-sw.js', base).toString(),
  141 |     ];
  142 |     const results = [];
  143 |     for (const url of urls) {
  144 |       const response = await request.get(url, { failOnStatusCode: false });
  145 |       results.push({ url, status: response.status(), cacheControl: response.headers()['cache-control'] || '', contentType: response.headers()['content-type'] || '' });
  146 |     }
  147 |     await attachJson(testInfo, '17-cache-headers.json', { results });
  148 |     for (const row of results) expect(row.status, `${row.url} should load`).toBeLessThan(500);
  149 |     const html = results[0];
  150 |     const version = results[1];
  151 |     const sw = results[2];
  152 |     expect(html.cacheControl, 'index HTML must not be immutable').not.toMatch(/immutable/i);
  153 |     expect(version.cacheControl, 'version.json must revalidate and must not be immutable').not.toMatch(/immutable/i);
  154 |     expect(sw.cacheControl, 'service worker must revalidate and must not be immutable').not.toMatch(/immutable/i);
  155 |   });
  156 | });
  157 | 
```