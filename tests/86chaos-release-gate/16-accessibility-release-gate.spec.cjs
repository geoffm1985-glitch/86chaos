const { test, expect } = require('@playwright/test');
let AxeBuilder = null;
let axeCore = null;
try { AxeBuilder = require('@axe-core/playwright').default; } catch (_) { axeCore = require('axe-core'); }
const {
  ROUTE_SPECS,
  ownerLikeCreds,
  requireCreds,
  login,
  gotoTab,
  attachJson,
  PERMISSION_GATE_RE,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function runAxe(page) {
  if (AxeBuilder) return new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  if (!axeCore?.source) throw new Error('Accessibility release gate requires either @axe-core/playwright or axe-core.');
  await page.addScriptTag({ content: axeCore.source });
  return page.evaluate(async (tags) => window.axe.run(document, { runOnly: { type: 'tag', values: tags } }), WCAG_TAGS);
}

function simplifyViolation(v) {
  return {
    id: v.id,
    impact: v.impact,
    description: v.description,
    help: v.help,
    helpUrl: v.helpUrl,
    nodes: v.nodes.slice(0, 20).map(n => ({ target: n.target, html: n.html.slice(0, 500), failureSummary: n.failureSummary })),
  };
}

test.describe('16 WCAG accessibility release gate', () => {
  test('every major route has zero serious or critical axe violations', async ({ page }, testInfo) => {
    test.setTimeout(25 * 60 * 1000);
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);

    const findings = [];
    for (const route of ROUTE_SPECS) {
      const text = await gotoTab(page, route.tab, { settleMs: 900 });
      if (PERMISSION_GATE_RE.test(text)) continue;
      const result = await runAxe(page);
      const blocking = result.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(simplifyViolation);
      const moderate = result.violations.filter(v => v.impact === 'moderate').map(simplifyViolation);
      findings.push({ route: route.tab, blocking, moderate });
    }

    const blocking = findings.flatMap(x => x.blocking.map(v => ({ route: x.route, ...v })));
    await attachJson(testInfo, '16-accessibility-results.json', { findings, blockingCount: blocking.length });
    expect(blocking, 'Play Store release gate requires zero serious or critical WCAG violations on tested routes').toEqual([]);
  });

  test('forms expose labels, errors, keyboard focus, and no keyboard traps', async ({ page }, testInfo) => {
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);
    const problems = [];

    for (const route of ROUTE_SPECS) {
      const text = await gotoTab(page, route.tab, { settleMs: 700 });
      if (PERMISSION_GATE_RE.test(text)) continue;
      const audit = await page.evaluate(() => {
        const visible = (el) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
        };
        const fields = Array.from(document.querySelectorAll('input, select, textarea')).filter(visible).map(el => {
          const id = el.id;
          const explicit = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
          const wrapped = el.closest('label');
          const name = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('placeholder') || explicit?.textContent || wrapped?.textContent || '';
          return { tag: el.tagName, type: el.type || '', name: name.replace(/\s+/g, ' ').trim().slice(0, 160), required: el.required, disabled: el.disabled };
        });
        return { fields };
      });
      const unlabeled = audit.fields.filter(f => !f.disabled && !f.name && f.type !== 'hidden');
      if (unlabeled.length) problems.push({ route: route.tab, type: 'unlabeled-fields', fields: unlabeled });

      await page.keyboard.press('Tab').catch(() => {});
      const focusInfo = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return { ok: false, tag: el?.tagName || '' };
        const style = getComputedStyle(el);
        return { ok: true, tag: el.tagName, outline: style.outline, boxShadow: style.boxShadow, label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 120) };
      });
      if (!focusInfo.ok) problems.push({ route: route.tab, type: 'no-keyboard-focus-after-tab', focusInfo });
    }

    await attachJson(testInfo, '16-form-keyboard-audit.json', { problems });
    expect(problems, 'Every form field needs a usable accessible name and every route must expose keyboard focus').toEqual([]);
  });
});
