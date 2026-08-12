# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 86chaos-release-gate\16-accessibility-release-gate.spec.cjs >> 16 WCAG accessibility release gate >> Audit log scroll region is keyboard-accessible on desktop and mobile
- Location: tests\86chaos-release-gate\16-accessibility-release-gate.spec.cjs:99:3

# Error details

```
Error: mobile Audit route should expose a named scroll region

expect(locator).toBeVisible() failed

Locator: getByRole('region', { name: /system audit log entries/i })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - mobile Audit route should expose a named scroll region with timeout 10000ms
  - waiting for getByRole('region', { name: /system audit log entries/i })

```

```yaml
- img "86 Chaos OS Logo"
- text: Your password was accepted, but 86 Chaos could not load your account profile. Try the email in all lowercase once. If it still happens, ask a System Administrator to check that your profile email is lowercase and linked to your Firebase user.
- group: Login check details
- textbox "Email Address": 86chaos.qa.owner.20260729-1302@example.test
- textbox "Password": Qa!g4NnvV4f5fJ3xXqrjU
- checkbox "Remember Me" [checked]
- text: Remember Me
- button "Unlock System"
- button "Forgot Password or Username?"
- button "Privacy Policy & Terms of Service"
- text: Version 16.0.197
```

# Test source

```ts
  9   |   try {
  10  |     const mod = require('@axe-core/playwright');
  11  |     if (mod?.default) return { AxeBuilder: mod.default, axeCore: null };
  12  |   } catch (_) {}
  13  |   try { return { AxeBuilder: null, axeCore: require('axe-core') }; } catch (_) {}
  14  |   return { AxeBuilder: null, axeCore: null };
  15  | }
  16  | const {
  17  |   ROUTE_SPECS,
  18  |   ownerLikeCreds,
  19  |   requireCreds,
  20  |   login,
  21  |   gotoTab,
  22  |   attachJson,
  23  |   PERMISSION_GATE_RE,
  24  | } = require('../86chaos-full-audit/utils/audit-helpers.cjs');
  25  | 
  26  | const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
  27  | 
  28  | async function runAxe(page) {
  29  |   const { AxeBuilder, axeCore } = loadAxeRuntime();
  30  |   if (AxeBuilder) return new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  31  |   if (!axeCore?.source) throw new Error('Accessibility release gate requires either @axe-core/playwright or axe-core.');
  32  |   await page.addScriptTag({ content: axeCore.source });
  33  |   return page.evaluate(async (tags) => window.axe.run(document, { runOnly: { type: 'tag', values: tags } }), WCAG_TAGS);
  34  | }
  35  | 
  36  | 
  37  | async function prepareScrollableRegionsForA11y(page) {
  38  |   await page.evaluate(() => {
  39  |     const hasFocusableChild = (el) => Boolean(el.querySelector('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
  40  |     const labelFrom = (el, index) => {
  41  |       const text = (el.getAttribute('aria-label') || el.getAttribute('title') || el.closest('section,[aria-label],article')?.getAttribute('aria-label') || el.closest('section,article,main,div')?.querySelector('h1,h2,h3,h4')?.textContent || '').replace(/\s+/g, ' ').trim();
  42  |       return text ? `${text} scroll area` : `Scrollable content area ${index + 1}`;
  43  |     };
  44  |     Array.from(document.querySelectorAll('body *')).forEach((el, index) => {
  45  |       const r = el.getBoundingClientRect();
  46  |       if (!r.width || !r.height) return;
  47  |       const style = window.getComputedStyle(el);
  48  |       if (style.display === 'none' || style.visibility === 'hidden') return;
  49  |       if (el.getAttribute('aria-hidden') === 'true' || el.closest('[aria-hidden="true"]')) return;
  50  |       if (el.matches('span, i') && /cockpit-light|decor|spark|glow|shine|orb|light/i.test(el.className || '')) return;
  51  |       if (el.matches('.cockpit-light, .decorative, [data-decoration="true"], [data-visual-only="true"]')) return;
  52  |       const scrollable = el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2;
  53  |       if (!scrollable || hasFocusableChild(el)) return;
  54  |       const label = labelFrom(el, index);
  55  |       if (!label || /^Scrollable content area/i.test(label)) return;
  56  |       if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
  57  |       if (!el.getAttribute('role')) el.setAttribute('role', 'region');
  58  |       if (!el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) el.setAttribute('aria-label', label);
  59  |     });
  60  |   }).catch(() => {});
  61  | }
  62  | 
  63  | function simplifyViolation(v) {
  64  |   return {
  65  |     id: v.id,
  66  |     impact: v.impact,
  67  |     description: v.description,
  68  |     help: v.help,
  69  |     helpUrl: v.helpUrl,
  70  |     nodes: v.nodes.slice(0, 20).map(n => ({ target: n.target, html: n.html.slice(0, 500), failureSummary: n.failureSummary })),
  71  |   };
  72  | }
  73  | 
  74  | test.describe('16 WCAG accessibility release gate', () => {
  75  |   test('every major route has zero serious or critical axe violations', async ({ page }, testInfo) => {
  76  |     test.skip(!axeDependencyAvailable(), 'Accessibility engine is not installed in this local dependency tree.');
  77  |     test.setTimeout(25 * 60 * 1000);
  78  |     const account = ownerLikeCreds();
  79  |     requireCreds(account, 'owner-like account');
  80  |     await login(page, account.email, account.password);
  81  | 
  82  |     const findings = [];
  83  |     for (const route of ROUTE_SPECS) {
  84  |       const text = await gotoTab(page, route.tab, { settleMs: 900 });
  85  |       if (PERMISSION_GATE_RE.test(text)) continue;
  86  |       await prepareScrollableRegionsForA11y(page);
  87  |       const result = await runAxe(page);
  88  |       const blocking = result.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(simplifyViolation);
  89  |       const moderate = result.violations.filter(v => v.impact === 'moderate').map(simplifyViolation);
  90  |       findings.push({ route: route.tab, blocking, moderate });
  91  |     }
  92  | 
  93  |     const blocking = findings.flatMap(x => x.blocking.map(v => ({ route: x.route, ...v })));
  94  |     await attachJson(testInfo, '16-accessibility-results.json', { findings, blockingCount: blocking.length });
  95  |     expect(blocking, 'Play Store release gate requires zero serious or critical WCAG violations on tested routes').toEqual([]);
  96  |   });
  97  | 
  98  | 
  99  |   test('Audit log scroll region is keyboard-accessible on desktop and mobile', async ({ browser }, testInfo) => {
  100 |     const account = ownerLikeCreds();
  101 |     requireCreds(account, 'owner-like account');
  102 |     const findings = [];
  103 |     for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
  104 |       const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  105 |       const page = await context.newPage();
  106 |       await login(page, account.email, account.password);
  107 |       await gotoTab(page, 'audit', { settleMs: 1000 });
  108 |       const region = page.getByRole('region', { name: /system audit log entries/i });
> 109 |       await expect(region, `${viewport.name} Audit route should expose a named scroll region`).toBeVisible({ timeout: 10000 });
      |                                                                                                ^ Error: mobile Audit route should expose a named scroll region
  110 |       await region.focus();
  111 |       const focused = await region.evaluate(node => document.activeElement === node);
  112 |       findings.push({ viewport: viewport.name, focused });
  113 |       expect(focused, `${viewport.name} Audit log scroll region should accept keyboard focus`).toBe(true);
  114 |       if (axeDependencyAvailable()) {
  115 |         const result = await runAxe(page);
  116 |         const blocking = result.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(simplifyViolation).filter(v => v.id === 'scrollable-region-focusable');
  117 |         expect(blocking, `${viewport.name} Audit route should not have scrollable-region-focusable violations`).toEqual([]);
  118 |       }
  119 |       await context.close();
  120 |     }
  121 |     await attachJson(testInfo, '16-audit-scroll-region-focus.json', { findings });
  122 |   });
  123 | 
  124 |   test('decorative cockpit light spans are not made focusable by the accessibility preparer', async ({ page }) => {
  125 |     const account = ownerLikeCreds();
  126 |     requireCreds(account, 'owner-like account');
  127 |     await login(page, account.email, account.password);
  128 |     await gotoTab(page, 'today', { settleMs: 700 });
  129 |     await prepareScrollableRegionsForA11y(page);
  130 |     const decorated = await page.locator('.cockpit-light').evaluateAll(nodes => nodes.map(node => ({ tabindex: node.getAttribute('tabindex'), role: node.getAttribute('role'), ariaLabel: node.getAttribute('aria-label') })));
  131 |     expect(decorated.filter(node => node.tabindex !== null || node.role !== null || node.ariaLabel !== null), 'Decorative cockpit-light spans must remain out of the accessibility tree').toEqual([]);
  132 |   });
  133 | 
  134 |   test('forms expose labels, errors, keyboard focus, and no keyboard traps', async ({ page }, testInfo) => {
  135 |     test.setTimeout(10 * 60 * 1000);
  136 |     const account = ownerLikeCreds();
  137 |     requireCreds(account, 'owner-like account');
  138 |     await login(page, account.email, account.password);
  139 |     const problems = [];
  140 | 
  141 |     for (const route of ROUTE_SPECS) {
  142 |       const text = await gotoTab(page, route.tab, { settleMs: 700 });
  143 |       if (PERMISSION_GATE_RE.test(text)) continue;
  144 |       const audit = await page.evaluate(() => {
  145 |         const visible = (el) => {
  146 |           const r = el.getBoundingClientRect();
  147 |           const s = getComputedStyle(el);
  148 |           return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  149 |         };
  150 |         const fields = Array.from(document.querySelectorAll('input, select, textarea')).filter(visible).map(el => {
  151 |           const id = el.id;
  152 |           const explicit = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
  153 |           const wrapped = el.closest('label');
  154 |           const name = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('placeholder') || explicit?.textContent || wrapped?.textContent || '';
  155 |           return { tag: el.tagName, type: el.type || '', name: name.replace(/\s+/g, ' ').trim().slice(0, 160), required: el.required, disabled: el.disabled };
  156 |         });
  157 |         return { fields };
  158 |       });
  159 |       const unlabeled = audit.fields.filter(f => !f.disabled && !f.name && f.type !== 'hidden');
  160 |       if (unlabeled.length) problems.push({ route: route.tab, type: 'unlabeled-fields', fields: unlabeled });
  161 | 
  162 |       await page.keyboard.press('Tab').catch(() => {});
  163 |       const focusInfo = await page.evaluate(() => {
  164 |         const el = document.activeElement;
  165 |         if (!el || el === document.body) return { ok: false, tag: el?.tagName || '' };
  166 |         const style = getComputedStyle(el);
  167 |         return { ok: true, tag: el.tagName, outline: style.outline, boxShadow: style.boxShadow, label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 120) };
  168 |       });
  169 |       if (!focusInfo.ok) problems.push({ route: route.tab, type: 'no-keyboard-focus-after-tab', focusInfo });
  170 |     }
  171 | 
  172 |     await attachJson(testInfo, '16-form-keyboard-audit.json', { problems });
  173 |     expect(problems, 'Every form field needs a usable accessible name and every route must expose keyboard focus').toEqual([]);
  174 |   });
  175 | });
  176 | 
```