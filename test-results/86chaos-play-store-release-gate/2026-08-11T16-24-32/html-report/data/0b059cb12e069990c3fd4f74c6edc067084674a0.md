# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 86chaos-full-audit\11-mobile-desktop-voice-upload.spec.cjs >> 11 mobile, desktop, 86Voice, and upload/scan UI >> 86Voice mic button is reachable, lifecycle-safe, and does not pass when missing
- Location: tests\86chaos-full-audit\11-mobile-desktop-voice-upload.spec.cjs:59:3

# Error details

```
Error: Authorized account must expose one stable accessible Open 86Voice control

expect(locator).toHaveCount(expected) failed

Locator:  getByRole('button', { name: /open 86voice/i })
Expected: 1
Received: 0
Timeout:  10000ms

Call log:
  - Authorized account must expose one stable accessible Open 86Voice control with timeout 10000ms
  - waiting for getByRole('button', { name: /open 86voice/i })
    23 × locator resolved to 0 elements
       - unexpected value "0"

```

# Page snapshot

```yaml
- generic [ref=e6]:
  - img "86 Chaos OS Logo" [ref=e7]
  - generic [ref=e8]:
    - generic [ref=e9]: Your password was accepted, but 86 Chaos could not load your account profile. Try the email in all lowercase once. If it still happens, ask a System Administrator to check that your profile email is lowercase and linked to your Firebase user.
    - group [ref=e10]:
      - generic "Login check details" [ref=e11] [cursor=pointer]
    - textbox "Email Address" [ref=e13]: 86chaos.qa.owner.20260729-1302@example.test
    - textbox "Password" [ref=e15]: Qa!g4NnvV4f5fJ3xXqrjU
    - generic [ref=e16] [cursor=pointer]:
      - checkbox "Remember Me" [checked] [ref=e17]
      - generic [ref=e18]: Remember Me
    - button "Unlock System" [ref=e19] [cursor=pointer]
    - generic [ref=e20]:
      - button "Forgot Password or Username?" [ref=e21] [cursor=pointer]
      - button "Privacy Policy & Terms of Service" [ref=e22] [cursor=pointer]
      - generic [ref=e23]: Version 16.0.197
```

# Test source

```ts
  5   | 
  6   | test.describe('11 mobile, desktop, 86Voice, and upload/scan UI', () => {
  7   |   test('mobile major tabs have no sideways overflow, hidden buttons, or one-letter keyboard-focus failures', async ({ browser }, testInfo) => {
  8   |     test.setTimeout(12 * 60 * 1000);
  9   |     const context = await browser.newContext({ ...devices['Pixel 7'] });
  10  |     const page = await context.newPage();
  11  |     const account = ownerLikeCreds();
  12  |     requireCreds(account, 'owner-like account');
  13  |     await login(page, account.email, account.password);
  14  |     const audits = [];
  15  |     for (const tab of mobileRoutes) {
  16  |       await gotoTab(page, tab, { settleMs: 1200 });
  17  |       const audit = await viewportAudit(page);
  18  |       audits.push({ tab, audit });
  19  |       expect(audit.horizontalOverflow, `${tab} should not have accidental horizontal overflow on mobile`).toBe(false);
  20  |       expect(audit.smallButtons.filter(b => !/×|x|i/i.test(b.text)).slice(0, 8), `${tab} should not have tiny important tap targets`).toEqual([]);
  21  |     }
  22  |     await gotoTab(page, 'events', { settleMs: 1000 });
  23  |     const inputs = page.locator('input:visible, textarea:visible');
  24  |     const count = await inputs.count().catch(() => 0);
  25  |     let focusEvidence = null;
  26  |     if (count > 0) {
  27  |       const input = inputs.first();
  28  |       await input.click({ timeout: 5000 }).catch(() => {});
  29  |       await input.type('QA', { delay: 100 }).catch(() => {});
  30  |       focusEvidence = await page.evaluate(() => ({ activeTag: document.activeElement?.tagName, value: document.activeElement?.value || '', placeholder: document.activeElement?.getAttribute?.('placeholder') || '' }));
  31  |       expect(['INPUT', 'TEXTAREA'].includes(focusEvidence.activeTag), 'Mobile typing should keep focus in the input/textarea after multiple characters').toBe(true);
  32  |     }
  33  |     await attachJson(testInfo, '11-mobile-audit.json', { audits, focusEvidence });
  34  |     await context.close();
  35  |   });
  36  | 
  37  |   test('desktop Schedule Builder grid is dense/readable with visible grid lines and full times', async ({ page }, testInfo) => {
  38  |     await page.setViewportSize({ width: 1440, height: 950 });
  39  |     const account = ownerLikeCreds();
  40  |     requireCreds(account, 'owner-like account');
  41  |     await login(page, account.email, account.password);
  42  |     const text = await gotoTab(page, 'schedule', { settleMs: 1800, maxText: 65000 });
  43  |     const audit = await viewportAudit(page);
  44  |     const gridEvidence = await page.evaluate(() => {
  45  |       const els = Array.from(document.querySelectorAll('body *'));
  46  |       const rows = els.map(el => {
  47  |         const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
  48  |         const s = window.getComputedStyle(el);
  49  |         const r = el.getBoundingClientRect();
  50  |         return { text: text.slice(0, 180), width: r.width, height: r.height, borderTop: s.borderTopColor, borderBottom: s.borderBottomColor, borderLeft: s.borderLeftColor, borderRight: s.borderRightColor, className: String(el.className || '').slice(0, 120) };
  51  |       }).filter(x => /schedule|Allen|\d{1,2}\s*[ap]\s*[-–]/i.test(x.text)).slice(0, 80);
  52  |       return rows;
  53  |     });
  54  |     await attachJson(testInfo, '11-desktop-schedule-grid.json', { audit, gridEvidence, sample: text.slice(0, 8000) });
  55  |     expect(audit.horizontalOverflow, 'Desktop should not have accidental body-level horizontal overflow').toBe(false);
  56  |     expect(text, 'Desktop schedule should expose full times like 10a-9p / 3p-9p when present').not.toMatch(/\b\.\.\.|…/);
  57  |   });
  58  | 
  59  |   test('86Voice mic button is reachable, lifecycle-safe, and does not pass when missing', async ({ page }, testInfo) => {
  60  |     await page.addInitScript(() => {
  61  |       window.__voiceRecognitionInstances = [];
  62  |       window.__voiceRecognitionState = { createdCount: 0, startedCount: 0, activeIds: [], maxConcurrentActive: 0, events: [] };
  63  |       const markInactive = (instance, reason) => {
  64  |         if (!instance.active) return;
  65  |         instance.active = false;
  66  |         window.__voiceRecognitionState.activeIds = window.__voiceRecognitionState.activeIds.filter(id => id !== instance.instanceId);
  67  |         window.__voiceRecognitionState.events.push({ id: instance.instanceId, type: reason, activeCount: window.__voiceRecognitionState.activeIds.length });
  68  |       };
  69  |       class MockSpeechRecognition {
  70  |         constructor() {
  71  |           this.instanceId = ++window.__voiceRecognitionState.createdCount;
  72  |           this.started = false; this.active = false; this.stopped = false; this.aborted = false; this.onresult = null; this.onerror = null; this.onend = null;
  73  |           window.__voiceRecognitionInstances.push(this);
  74  |           window.__voiceRecognitionState.events.push({ id: this.instanceId, type: 'created', activeCount: window.__voiceRecognitionState.activeIds.length });
  75  |         }
  76  |         start() {
  77  |           this.started = true;
  78  |           window.__voiceRecognitionState.startedCount += 1;
  79  |           if (!this.active) {
  80  |             this.active = true;
  81  |             window.__voiceRecognitionState.activeIds.push(this.instanceId);
  82  |             window.__voiceRecognitionState.maxConcurrentActive = Math.max(window.__voiceRecognitionState.maxConcurrentActive, window.__voiceRecognitionState.activeIds.length);
  83  |           }
  84  |           window.__voiceRecognitionState.events.push({ id: this.instanceId, type: 'started', activeCount: window.__voiceRecognitionState.activeIds.length });
  85  |         }
  86  |         stop() { this.stopped = true; markInactive(this, 'stopped'); if (typeof this.onend === 'function') this.onend(); }
  87  |         abort() { this.aborted = true; markInactive(this, 'aborted'); if (typeof this.onend === 'function') this.onend(); }
  88  |         emitFinal(text) { if (typeof this.onresult === 'function') this.onresult({ results: [{ 0: { transcript: text }, isFinal: true }] }); }
  89  |       }
  90  |       window.SpeechRecognition = MockSpeechRecognition;
  91  |       window.webkitSpeechRecognition = MockSpeechRecognition;
  92  |     });
  93  |     const account = ownerLikeCreds();
  94  |     requireCreds(account, 'owner-like account');
  95  |     await login(page, account.email, account.password);
  96  |     const beforeDismissalDialogs = await visibleDialogSnapshot(page);
  97  |     const modalDismissal = await dismissBlockingDialogs(page, { maxPasses: 4 });
  98  |     if (!modalDismissal.ok) {
  99  |       await attachJson(testInfo, '11-voice-modal-dismissal-failure.json', modalDismissal);
  100 |       throw new Error(modalDismissal.failure || 'Blocking dialog could not be dismissed before 86Voice interaction.');
  101 |     }
  102 |     const overlayBeforeVoice = await neutralizeTestingPreviewOverlays(page, { attach: (name, data) => attachJson(testInfo, name, data) });
  103 |     const text = await bodyText(page, 30000);
  104 |     const openVoice = page.getByRole('button', { name: /open 86voice/i });
> 105 |     await expect(openVoice, 'Authorized account must expose one stable accessible Open 86Voice control').toHaveCount(1, { timeout: 10_000 });
      |                                                                                                          ^ Error: Authorized account must expose one stable accessible Open 86Voice control
  106 |     const voiceButton = openVoice.first();
  107 |     const metrics = await voiceButton.evaluate((button) => {
  108 |       const rect = button.getBoundingClientRect();
  109 |       return { label: button.getAttribute('aria-label') || button.getAttribute('title') || button.innerText || '', width: Math.round(rect.width), height: Math.round(rect.height) };
  110 |     });
  111 |     expect(text, 'Voice/mic button should not show PREVIEW label').not.toMatch(/\bPREVIEW\b/i);
  112 |     expect(metrics.label, '86Voice button should have a real accessible label').toMatch(/86Voice|86 voice/i);
  113 |     expect(metrics.width, 'Mic/voice button should be wide enough to tap').toBeGreaterThanOrEqual(42);
  114 |     expect(metrics.height, 'Mic/voice button should be tall enough to tap').toBeGreaterThanOrEqual(38);
  115 | 
  116 |     const beforeOpenDismissal = await dismissBlockingDialogs(page, { maxPasses: 2 });
  117 |     if (!beforeOpenDismissal.ok) {
  118 |       await attachJson(testInfo, '11-voice-before-open-modal-dismissal-failure.json', beforeOpenDismissal);
  119 |       throw new Error(beforeOpenDismissal.failure || 'Blocking dialog remained before Open 86Voice click.');
  120 |     }
  121 |     await neutralizeTestingPreviewOverlays(page, { attach: (name, data) => attachJson(testInfo, name, data) });
  122 |     await voiceButton.click();
  123 |     const headerClose = page.getByRole('button', { name: 'Close 86Voice panel' });
  124 |     const floatingHide = page.getByRole('button', { name: 'Hide 86Voice assistant' });
  125 |     await expect(headerClose).toBeVisible({ timeout: 5000 });
  126 |     await expect(floatingHide).toBeVisible({ timeout: 5000 });
  127 |     await expect(page.locator('.voice-command-dock')).toHaveCount(1);
  128 |     await neutralizeTestingPreviewOverlays(page, { attach: (name, data) => attachJson(testInfo, name, data) });
  129 |     await headerClose.click();
  130 |     await expect(page.getByRole('button', { name: /open 86voice/i })).toBeVisible({ timeout: 5000 });
  131 | 
  132 |     await dismissBlockingDialogs(page, { maxPasses: 2 });
  133 |     await neutralizeTestingPreviewOverlays(page, { attach: (name, data) => attachJson(testInfo, name, data) });
  134 |     await page.getByRole('button', { name: /open 86voice/i }).click();
  135 |     await expect(headerClose).toBeVisible({ timeout: 5000 });
  136 |     await expect(floatingHide).toBeVisible({ timeout: 5000 });
  137 |     const maybeStart = page.getByRole('button', { name: /start listening|listen|microphone|start/i }).first();
  138 |     if (await maybeStart.isVisible({ timeout: 2500 }).catch(() => false)) {
  139 |       await maybeStart.click();
  140 |       await maybeStart.click().catch(() => {});
  141 |       const recognitionState = await page.evaluate(() => window.__voiceRecognitionState || {});
  142 |       expect(recognitionState.maxConcurrentActive || 0, 'Repeated start taps must not create duplicate simultaneous recognition sessions').toBeLessThanOrEqual(1);
  143 |       expect(recognitionState.startedCount || 0, 'Deterministic SpeechRecognition mock should be started by the real UI control').toBeGreaterThanOrEqual(1);
  144 |     }
  145 |     await neutralizeTestingPreviewOverlays(page, { attach: (name, data) => attachJson(testInfo, name, data) });
  146 |     await floatingHide.click();
  147 |     await expect(page.getByRole('button', { name: /open 86voice/i })).toBeVisible({ timeout: 5000 });
  148 |     const closedInstanceState = await page.evaluate(() => (window.__voiceRecognitionInstances || []).map(r => ({ started: r.started, stopped: r.stopped, aborted: r.aborted })));
  149 |     expect(closedInstanceState.every(r => !r.started || r.stopped || r.aborted), 'Closing from the floating hide control must stop active recognition').toBe(true);
  150 |     await neutralizeTestingPreviewOverlays(page, { attach: (name, data) => attachJson(testInfo, name, data) });
  151 |     await page.getByRole('button', { name: /open 86voice/i }).click();
  152 |     await expect(page.locator('.voice-command-dock')).toHaveCount(1);
  153 |     await attachJson(testInfo, '11-voice-button-metrics.json', { metrics, beforeDismissalDialogs, modalDismissal, beforeOpenDismissal, remainingDialogs: await visibleDialogSnapshot(page), backdropCount: await page.locator('.chaos-modal-backdrop:visible').count().catch(() => 0), voiceControlCount: await page.getByRole('button', { name: /86voice/i }).count().catch(() => 0), textSample: text.slice(0, 5000), instances: await page.evaluate(() => (window.__voiceRecognitionInstances || []).length), recognitionState: await page.evaluate(() => window.__voiceRecognitionState || {}), overlayBeforeVoice, closedInstanceState });
  154 |   });
  155 | 
  156 |   test('file upload / scan surfaces reject obvious broken display states', async ({ page }, testInfo) => {
  157 |     const account = ownerLikeCreds();
  158 |     requireCreds(account, 'owner-like account');
  159 |     await login(page, account.email, account.password);
  160 |     const inventory = await gotoTab(page, 'inventory', { settleMs: 1800, maxText: 60000 });
  161 |     const menu = await gotoTab(page, 'menu-intelligence', { settleMs: 1200, maxText: 40000 });
  162 |     await attachJson(testInfo, '11-upload-scan-surfaces.json', { inventorySample: inventory.slice(0, 6000), menuSample: menu.slice(0, 4000) });
  163 |     expect(`${inventory}\n${menu}`).toMatch(/upload|scan|invoice|menu|PDF|image|progress|timeout|compress/i);
  164 |     expect(`${inventory}\n${menu}`).not.toMatch(/Invalid Date|Infinity|undefined undefined|null null|\$NaN|NaN%|(?:^|[^A-Za-z])NaN(?:[^A-Za-z]|$)/i);
  165 |   });
  166 | });
  167 | 
```