# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 86chaos-full-audit\05-schedule-builder-mutation.spec.cjs >> 05 Schedule Builder mutation and data-integrity checks >> Schedule Builder does not count OFF/request-off/event chips as worked hours
- Location: tests\86chaos-full-audit\05-schedule-builder-mutation.spec.cjs:63:3

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: locator.click: Test timeout of 90000ms exceeded.
Call log:
  - waiting for getByText('86 Chaos Release Gate QA 2026-08-11T16-24-32', { exact: true }).first().locator('xpath=ancestor-or-self::button[1]')
    - locator resolved to <button type="button" data-chaos-control-kind="informational" title="Open 86 Chaos Release Gate QA 2026-08-11T16-24-32Owner • AdminCurrent" aria-label="Open 86 Chaos Release Gate QA 2026-08-11T16-24-32Owner • AdminCurrent" class="w-full text-left rounded-xl border p-3 transition-all bg-[#D4A381]/10 border-[#D4A381] text-white chaos-release-tap-target">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="space-y-4">…</div> from <div role="presentation" class="chaos-modal-backdrop fixed inset-0 bg-[#12161A]/80 z-[60] flex items-center justify-center p-4 backdrop-blur-md transition-opacity">…</div> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="space-y-4">…</div> from <div role="presentation" class="chaos-modal-backdrop fixed inset-0 bg-[#12161A]/80 z-[60] flex items-center justify-center p-4 backdrop-blur-md transition-opacity">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <div class="space-y-4">…</div> from <div role="presentation" class="chaos-modal-backdrop fixed inset-0 bg-[#12161A]/80 z-[60] flex items-center justify-center p-4 backdrop-blur-md transition-opacity">…</div> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms
    - waiting for element to be visible, enabled and stable

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic "86 Chaos branding is always displayed" [ref=e6] [cursor=pointer]:
      - img "86 Chaos app icon" [ref=e7]
      - img "86 Chaos" [ref=e8]
    - button "Switch workspace. Active workspace 86 Chaos Release Gate QA 2026-08-11T16-24-32." [ref=e10] [cursor=pointer]: 86 Chaos Release Gate QA 2026-08-11T16-24-32 • Switch
    - generic [ref=e11]:
      - button "Report a problem" [ref=e12] [cursor=pointer]
      - button "Open navigation menu" [ref=e22] [cursor=pointer]
  - button "Open 86Voice" [ref=e26] [cursor=pointer]
  - dialog [ref=e30]:
    - generic [ref=e31]:
      - heading "Switch Workspace" [level=3] [ref=e32]
      - button "Close Switch Workspace" [active] [ref=e33] [cursor=pointer]
    - generic [ref=e38]:
      - generic [ref=e39]: One login can belong to more than one restaurant. Pick the workplace you are clocking in, scheduling, or managing right now.
      - button "Open 86 Chaos Release Gate QA 2026-08-04T15-57-57Owner • Admin" [ref=e40] [cursor=pointer]:
        - generic [ref=e42]:
          - generic [ref=e43]: 86 Chaos Release Gate QA 2026-08-04T15-57-57
          - generic [ref=e44]: Owner • Admin
      - button "Open 86 Chaos Release Gate QA 2026-08-08T20-23-04Owner • Admin" [ref=e45] [cursor=pointer]:
        - generic [ref=e47]:
          - generic [ref=e48]: 86 Chaos Release Gate QA 2026-08-08T20-23-04
          - generic [ref=e49]: Owner • Admin
      - button "Open 86 Chaos Release Gate QA 2026-08-11T16-24-32Owner • AdminCurrent" [ref=e50] [cursor=pointer]:
        - generic [ref=e51]:
          - generic [ref=e52]:
            - generic [ref=e53]: 86 Chaos Release Gate QA 2026-08-11T16-24-32
            - generic [ref=e54]: Owner • Admin
          - generic [ref=e55]: Current
      - button "Close" [ref=e56] [cursor=pointer]
  - dialog [ref=e57]:
    - generic [ref=e58]:
      - heading "Employee Quick Start" [level=3] [ref=e59]
      - button "Close Employee Quick Start" [ref=e60] [cursor=pointer]
    - generic [ref=e65]:
      - generic [ref=e66]: Step 1 of 5
      - generic [ref=e67]:
        - heading "Welcome to 86 Chaos" [level=3] [ref=e68]
        - paragraph [ref=e69]: This quick tour shows how to save the web app, clock in/out, view your schedule, read messages, and get help.
      - generic [ref=e70]:
        - button "Back" [disabled] [ref=e71]
        - button "Next" [ref=e72] [cursor=pointer]
      - button "Skip and don't show again" [ref=e73] [cursor=pointer]
  - main [ref=e74]:
    - generic "3 On Schedule 1 Clocked In 5 Needs Eyes" [ref=e75]
    - generic [ref=e76]:
      - generic [ref=e77]:
        - generic [ref=e78]: "86"
        - generic [ref=e79]:
          - generic [ref=e80]:
            - generic [ref=e81]: Tuesday, August 11, 2026
            - heading "Manager Brief" [level=1] [ref=e82]
            - paragraph [ref=e83]: 2 Python scan alerts need review.
            - paragraph [ref=e84]: 3 On Schedule 1 Clocked In 4 Needs Eyes
            - button "Refresh Brief" [ref=e85] [cursor=pointer]
          - generic [ref=e86]:
            - generic [ref=e87]:
              - generic [ref=e88]: "3"
              - generic [ref=e89]: On Schedule
            - generic [ref=e90]:
              - generic [ref=e91]: "1"
              - generic [ref=e92]: Clocked In
            - generic [ref=e93]:
              - generic [ref=e94]: "4"
              - generic [ref=e95]: Needs Eyes
      - generic [ref=e96]:
        - button "Open 86 Alerts" [ref=e97] [cursor=pointer]
        - button "Open Prep" [ref=e98] [cursor=pointer]
        - button "Open Messages" [ref=e99] [cursor=pointer]
        - button "Open Fix It" [ref=e100] [cursor=pointer]
      - generic [ref=e101]:
        - generic [ref=e102]:
          - generic [ref=e103]:
            - generic [ref=e104]:
              - generic [ref=e105]:
                - heading "Owner/Admin Alerts" [level=2] [ref=e106]
                - paragraph [ref=e110]: Python/System Admin scans can only send alerts here. They cannot change your restaurant data.
              - generic [ref=e111]: 2 open
            - generic [ref=e112]:
              - generic [ref=e114]:
                - generic [ref=e115]:
                  - generic [ref=e116]: python_alert • high
                  - generic [ref=e117]: QA Salmon 86 Alert
                  - generic [ref=e118]: QA Salmon Portion is at zero stock.
                - button "Open Acknowledge" [ref=e119] [cursor=pointer]: Acknowledge
              - generic [ref=e121]:
                - generic [ref=e122]:
                  - generic [ref=e123]: python_alert • critical
                  - generic [ref=e124]: QA Critical Fryer Maintenance
                  - generic [ref=e125]: "Fryer #2 needs service."
                - button "Open Acknowledge" [ref=e126] [cursor=pointer]: Acknowledge
          - generic [ref=e127]:
            - button "Open Need Attention" [ref=e128] [cursor=pointer]:
              - heading "Need Attention" [level=2] [ref=e129]
            - generic [ref=e132]:
              - generic [ref=e133]:
                - generic [ref=e134]:
                  - generic [ref=e135]: Owner/Admin alerts
                  - generic [ref=e136]: 2 Python scan alerts need review.
                  - button "Open" [ref=e137] [cursor=pointer]
                - button "Open Explain" [ref=e138] [cursor=pointer]: Explain
              - generic [ref=e139]:
                - generic [ref=e140]:
                  - generic [ref=e141]: Inventory below par
                  - generic [ref=e142]: 3 items need attention.
                  - button "Open" [ref=e143] [cursor=pointer]
                - button "Open Explain" [ref=e144] [cursor=pointer]: Explain
              - generic [ref=e145]:
                - generic [ref=e146]:
                  - generic [ref=e147]: Maintenance urgent
                  - generic [ref=e148]: 2 high priority issues open.
                  - button "Open" [ref=e149] [cursor=pointer]
                - button "Open Explain" [ref=e150] [cursor=pointer]: Explain
              - generic [ref=e151]:
                - generic [ref=e152]:
                  - generic [ref=e153]: "QA Fryer #2 pattern"
                  - generic [ref=e154]: 1 issue in 45 days. Consider service before the next rush/weekend.
                  - button "Open" [ref=e155] [cursor=pointer]
                - button "Open Explain" [ref=e156] [cursor=pointer]: Explain
          - generic [ref=e157]:
            - generic [ref=e158]:
              - heading "AI Service Assistants" [level=2] [ref=e159]
              - generic [ref=e162]: uses current app data
            - generic [ref=e163]:
              - button "mediumEvent prep forecast4 events in the next 7 days. Build prep around event notes, specials, and menu links." [ref=e164] [cursor=pointer]:
                - generic [ref=e165]: medium
                - generic [ref=e166]: Event prep forecast
                - generic [ref=e167]: 4 events in the next 7 days. Build prep around event notes, specials, and menu links.
              - button "mediumOpen prep pressure1 prep/task item still open. Review before service." [ref=e168] [cursor=pointer]:
                - generic [ref=e169]: medium
                - generic [ref=e170]: Open prep pressure
                - generic [ref=e171]: 1 prep/task item still open. Review before service.
              - 'button "highQA Fryer #2 pattern1 issue in 45 days. Consider service before the next rush/weekend." [ref=e172] [cursor=pointer]':
                - generic [ref=e173]: high
                - generic [ref=e174]: "QA Fryer #2 pattern"
                - generic [ref=e175]: 1 issue in 45 days. Consider service before the next rush/weekend.
          - generic [ref=e176]:
            - generic [ref=e177]:
              - heading "AI Ordering Attention" [level=2] [ref=e178]
              - button "Open AI Ordering" [ref=e181] [cursor=pointer]
            - generic [ref=e182]:
              - generic [ref=e183]:
                - generic [ref=e184]: QA Salmon Portion
                - generic [ref=e185]: Suggest 26 • Below par by 24
                - button "Open Review" [ref=e186] [cursor=pointer]: Review
              - generic [ref=e187]:
                - generic [ref=e188]: QA Fry Oil
                - generic [ref=e189]: Suggest 7 • Below par by 6
                - button "Open Review" [ref=e190] [cursor=pointer]: Review
              - generic [ref=e191]:
                - generic [ref=e192]: QA Romaine
                - generic [ref=e193]: Suggest 4 • Below par by 2
                - button "Open Review" [ref=e194] [cursor=pointer]: Review
          - generic [ref=e196]:
            - generic [ref=e197]:
              - heading "Python Ops Scan" [level=2] [ref=e198]
              - paragraph [ref=e201]: Runs the deeper ops check from Manager Brief, then lets you tap each finding to jump to the place that fixes it.
            - button "Run Ops Scan" [ref=e203] [cursor=pointer]
          - generic [ref=e204]:
            - heading "Role Home" [level=2] [ref=e205]
            - generic [ref=e206]:
              - generic [ref=e207]:
                - generic [ref=e208]: Labor
                - generic [ref=e209]: 1/3 clocked in
                - button "Open Manager Brief Labor" [ref=e210] [cursor=pointer]: Labor
              - generic [ref=e211]:
                - generic [ref=e212]: Requests
                - generic [ref=e213]: 0 pending
                - button "Open Review" [ref=e214] [cursor=pointer]: Review
              - generic [ref=e215]:
                - generic [ref=e216]: Kitchen Command
                - generic [ref=e217]: Open Kitchen Command Center
                - button "Open" [ref=e218] [cursor=pointer]
          - generic [ref=e219]:
            - generic [ref=e220]:
              - heading "Important Messages" [level=2] [ref=e221]
              - button "Open Board" [ref=e222] [cursor=pointer]
            - generic [ref=e224]:
              - generic [ref=e225]: 86 Alert • Full Audit
              - generic [ref=e226]: QA 86 Salmon message
        - generic [ref=e227]:
          - button "Open Setup Checklist5/7" [ref=e229] [cursor=pointer]:
            - heading "Setup Checklist" [level=2] [ref=e230]
            - generic [ref=e231]: 6/7
          - generic [ref=e232]:
            - heading "Recently Used" [level=2] [ref=e233]
            - paragraph [ref=e235]: Tabs you use will appear here.
          - button "Open My Preferences" [ref=e237] [cursor=pointer]:
            - heading "My Preferences" [level=2] [ref=e238]
  - generic [ref=e242]:
    - img "86 Chaos OS" [ref=e243]
    - generic [ref=e244]: Version 16.0.197
    - generic [ref=e245]: © 2026 Chilton App Works LLC
```

# Test source

```ts
  174 |   catch (_) { return ''; }
  175 | }
  176 | 
  177 | async function attachJson(testInfo, filename, data) {
  178 |   await testInfo.attach(filename, { body: JSON.stringify(data, null, 2), contentType: 'application/json' });
  179 | }
  180 | 
  181 | function isControlledValidationResponse(response) {
  182 |   const status = response.status();
  183 |   if (status !== 400 && status !== 404) return false;
  184 |   const url = response.url();
  185 |   const contentType = response.headers()['content-type'] || '';
  186 |   const expectedReject = /\/api\/(report-bug|scan|scan-menu|scan-invoice|voice-command|send-push|safe-write|notification-receipt|brand-logo|quickbooks|personal-reminder|alerts|login-bootstrap|whoami|admin|full-audit-qa-cleanup)/i.test(url);
  187 |   return expectedReject && /json|text\/plain|application\/problem/i.test(contentType || 'application/json');
  188 | }
  189 | 
  190 | function isIgnorableStaticAssetFailure(text = '') {
  191 |   return /ERR_ABORTED|ERR_CONNECTION_RESET|net::ERR_FAILED/i.test(text) && /\/(6136|6139|6240|wisco|app-icon|notification-badge)\.(jpg|png|webp|ico)/i.test(text);
  192 | }
  193 | 
  194 | function watchForProblems(page, problems, options = {}) {
  195 |   const nonfatal4xx = [];
  196 |   const seen = new Set();
  197 |   const pushProblem = (row) => {
  198 |     const key = `${row.type}|${row.status || ''}|${row.url || ''}|${row.message || row.failure || ''}`;
  199 |     if (seen.has(key)) return;
  200 |     seen.add(key);
  201 |     problems.push(row);
  202 |   };
  203 |   page.on('pageerror', (error) => pushProblem({ type: 'page-error', message: error.message, stack: String(error.stack || '').slice(0, 2500) }));
  204 |   page.on('console', (msg) => {
  205 |     const text = msg.text();
  206 |     if (msg.type() !== 'error') return;
  207 |     if (/favicon|ResizeObserver|ERR_ABORTED|401|403|net::ERR_BLOCKED_BY_CLIENT|analytics/i.test(text)) return;
  208 |     if (/Failed to load resource:.*status of (400|404)/i.test(text)) return;
  209 |     if (isIgnorableStaticAssetFailure(text)) return;
  210 |     pushProblem({ type: 'console-error', message: text.slice(0, 1600) });
  211 |   });
  212 |   page.on('response', async (response) => {
  213 |     const status = response.status();
  214 |     const url = response.url();
  215 |     if (/hot-update|sockjs|favicon/i.test(url)) return;
  216 |     if (status === 400 || status === 404) {
  217 |       const controlled = isControlledValidationResponse(response);
  218 |       const row = { type: 'controlled-4xx', method: response.request().method(), status, url: url.split('?')[0].slice(0, 260), contentType: response.headers()['content-type'] || '', controlled };
  219 |       if (controlled) {
  220 |         nonfatal4xx.push(row);
  221 |         if (options.recordNonfatal4xx) problems.nonfatal4xx = nonfatal4xx;
  222 |         return;
  223 |       }
  224 |       if (/\/(6136|6139|6240|wisco|app-icon|notification-badge)\.(jpg|png|webp|ico)/i.test(url)) return;
  225 |     }
  226 |     if (status >= 500) pushProblem({ type: 'http-5xx', method: response.request().method(), status, url: url.split('?')[0].slice(0, 260), contentType: response.headers()['content-type'] || '' });
  227 |   });
  228 |   page.on('requestfailed', (request) => {
  229 |     const url = request.url();
  230 |     const failure = request.failure()?.errorText || '';
  231 |     if (/favicon|hot-update|sockjs|jwe|ERR_ABORTED/i.test(`${failure} ${url}`)) return;
  232 |     if (isIgnorableStaticAssetFailure(`${failure} ${url}`)) return;
  233 |     pushProblem({ type: 'requestfailed', url: url.split('?')[0].slice(0, 260), failure });
  234 |   });
  235 |   return { nonfatal4xx };
  236 | }
  237 | 
  238 | function summarizeProblems(problems) {
  239 |   return problems.slice(0, 50).map(p => ({ ...p, message: p.message ? String(p.message).slice(0, 1000) : undefined }));
  240 | }
  241 | 
  242 | async function chooseQaWorkspace(page) {
  243 |   const preferred = envValue('CHAOS_QA_WORKSPACE_NAME', 'CHAOS_QA_WORKSPACE') || QA_WORKSPACE_NAME;
  244 |   const currentText = await bodyText(page, 12000);
  245 |   if (currentText.includes(preferred) && !/choose workspace|select workspace|select restaurant|choose restaurant/i.test(currentText)) return false;
  246 |   const openChooser = async () => {
  247 |     const chooserText = await bodyText(page, 12000);
  248 |     if (/choose workspace|select workspace|select restaurant|choose restaurant/i.test(chooserText)) return true;
  249 |     const switchers = [
  250 |       page.getByTitle(/switch workspace/i).first(),
  251 |       page.getByRole('button', { name: /switch workspace|switch restaurant|switch$/i }).first(),
  252 |       page.getByText(/\bSwitch\b/i).first()
  253 |     ];
  254 |     for (const candidate of switchers) {
  255 |       if (await candidate.isVisible({ timeout: 1200 }).catch(() => false)) {
  256 |         await candidate.click({ timeout: 2500 }).catch(() => {});
  257 |         await page.waitForTimeout(900);
  258 |         const nextText = await bodyText(page, 12000);
  259 |         if (/choose workspace|select workspace|select restaurant|choose restaurant/i.test(nextText) || nextText.includes(preferred)) return true;
  260 |       }
  261 |     }
  262 |     return false;
  263 |   };
  264 | 
  265 |   const chooserOpen = await openChooser();
  266 |   if (!chooserOpen) return false;
  267 |   const exact = page.getByText(preferred, { exact: true }).first();
  268 |   const partial = page.getByText(preferred, { exact: false }).first();
  269 |   let target = null;
  270 |   if (await exact.isVisible({ timeout: 5000 }).catch(() => false)) target = exact;
  271 |   else if (await partial.isVisible({ timeout: 3000 }).catch(() => false)) target = partial;
  272 |   if (!target) throw new Error(`The disposable QA workspace "${preferred}" was not available in the workspace chooser.`);
  273 |   const button = target.locator('xpath=ancestor-or-self::button[1]');
> 274 |   if (await button.count()) await button.click();
      |                                          ^ Error: locator.click: Test timeout of 90000ms exceeded.
  275 |   else await target.click();
  276 |   await page.waitForLoadState('domcontentloaded').catch(() => {});
  277 |   await page.waitForTimeout(1200);
  278 |   return true;
  279 | }
  280 | 
  281 | async function dismissNoise(page) {
  282 |   const closeNames = [/skip and don't show again/i, /skip/i, /got it/i, /close/i, /not now/i, /maybe later/i, /×/i];
  283 |   for (const name of closeNames) {
  284 |     try {
  285 |       const btn = page.getByRole('button', { name }).first();
  286 |       if (await btn.isVisible({ timeout: 700 }).catch(() => false)) await btn.click({ timeout: 1500 }).catch(() => {});
  287 |     } catch (_) {}
  288 |   }
  289 |   try { await page.keyboard.press('Escape'); } catch (_) {}
  290 | }
  291 | 
  292 | 
  293 | async function visibleDialogSnapshot(page) {
  294 |   return page.locator('[role="dialog"]:visible').evaluateAll((dialogs) => dialogs.map((dialog, index) => {
  295 |     const labelledBy = dialog.getAttribute('aria-labelledby') || '';
  296 |     const labelledNode = labelledBy ? document.getElementById(labelledBy) : null;
  297 |     const heading = dialog.querySelector('h1,h2,h3,[data-dialog-title]');
  298 |     const title = (dialog.getAttribute('aria-label') || labelledNode?.innerText || heading?.innerText || dialog.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  299 |     return { index, title, text: (dialog.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 260) };
  300 |   })).catch(() => []);
  301 | }
  302 | 
  303 | async function dismissBlockingDialogs(page, options = {}) {
  304 |   const maxPasses = options.maxPasses || 4;
  305 |   const dismissed = [];
  306 |   const dangerous = /delete|remove|archive|reset|restore|publish|approve|deny|confirm|yes|ok delete|permanently/i;
  307 |   for (let pass = 0; pass < maxPasses; pass += 1) {
  308 |     const dialogs = await visibleDialogSnapshot(page);
  309 |     const backdropCount = await page.locator('.chaos-modal-backdrop:visible').count().catch(() => 0);
  310 |     if (!dialogs.length && backdropCount === 0) return { ok: true, dismissed, remainingDialogs: [], backdropCount: 0 };
  311 |     const dialog = dialogs[0] || { title: 'modal backdrop', text: '' };
  312 |     const title = dialog.title || 'dialog';
  313 |     const candidates = [];
  314 |     if (title && title !== 'dialog' && title !== 'modal backdrop') candidates.push({ label: `Close ${title}`, exact: true });
  315 |     candidates.push(
  316 |       { label: "Skip and don't show again", exact: true },
  317 |       { label: 'Skip and don\'t show again', exact: true },
  318 |       { label: 'Got it', exact: true },
  319 |       { label: 'I understand', exact: true },
  320 |       { label: 'Done', exact: true },
  321 |       { label: 'Not now', exact: true },
  322 |       { label: 'Maybe later', exact: true },
  323 |       { label: 'Close', exact: true },
  324 |       { label: '×', exact: true }
  325 |     );
  326 |     let used = null;
  327 |     for (const candidate of candidates) {
  328 |       if (dangerous.test(candidate.label)) continue;
  329 |       const locator = page.getByRole('button', { name: candidate.label, exact: candidate.exact }).first();
  330 |       if (await locator.isVisible({ timeout: 650 }).catch(() => false)) {
  331 |         await locator.click({ timeout: 2500 });
  332 |         used = candidate.label;
  333 |         break;
  334 |       }
  335 |     }
  336 |     if (!used) {
  337 |       return { ok: false, dismissed, remainingDialogs: await visibleDialogSnapshot(page), backdropCount: await page.locator('.chaos-modal-backdrop:visible').count().catch(() => 0), failure: `Visible dialog could not be safely dismissed: ${title}` };
  338 |     }
  339 |     await page.waitForTimeout(400);
  340 |     await page.locator('.chaos-modal-backdrop:visible').first().waitFor({ state: 'hidden', timeout: 3500 }).catch(() => {});
  341 |     dismissed.push({ title, control: used });
  342 |   }
  343 |   const remainingDialogs = await visibleDialogSnapshot(page);
  344 |   const backdropCount = await page.locator('.chaos-modal-backdrop:visible').count().catch(() => 0);
  345 |   if (remainingDialogs.length || backdropCount) {
  346 |     return { ok: false, dismissed, remainingDialogs, backdropCount, failure: `Blocking dialogs remained after ${maxPasses} dismiss attempts.` };
  347 |   }
  348 |   return { ok: true, dismissed, remainingDialogs: [], backdropCount: 0 };
  349 | }
  350 | 
  351 | async function login(page, email, password, options = {}) {
  352 |   await page.goto(appUrl(options.tab || 'today'), { waitUntil: 'domcontentloaded', timeout: 45000 });
  353 |   await page.waitForLoadState('domcontentloaded');
  354 |   let text = await bodyText(page, 8000);
  355 |   if (!LOGIN_RE.test(text)) {
  356 |     await dismissNoise(page);
  357 |     return text;
  358 |   }
  359 |   await dismissBlockingDialogs(page, { maxPasses: 6 }).catch(() => null);
  360 |   const emailBox = page.getByRole('textbox', { name: /^Email Address$/i }).first();
  361 |   const passwordBox = page.locator('input[type="password"][autocomplete="current-password"], input[type="password"][aria-label="Password"]').first();
  362 |   await expect(emailBox, 'Login email box should be visible').toBeVisible({ timeout: 30000 });
  363 |   await emailBox.fill(email);
  364 |   await passwordBox.fill(password);
  365 |   const loginButton = page.getByRole('button', { name: /unlock system|sign in|log in|login|unlock/i }).first();
  366 |   await loginButton.click();
  367 |   await page.waitForLoadState('domcontentloaded').catch(() => {});
  368 |   await page.waitForTimeout(2500);
  369 |   await dismissBlockingDialogs(page, { maxPasses: 6 }).catch(() => null);
  370 |   await chooseQaWorkspace(page);
  371 |   await dismissBlockingDialogs(page, { maxPasses: 6 }).catch(() => null);
  372 |   await dismissNoise(page);
  373 |   text = await bodyText(page, 16000);
  374 |   if (LOGIN_RE.test(text) && /invalid|wrong|error|failed|not attached/i.test(text)) {
```