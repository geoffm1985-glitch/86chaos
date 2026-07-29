const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const WORKFLOWS = require('./mutation-workflow-manifest.cjs');
const {
  ROUTE_SPECS,
  ownerLikeCreds,
  requireCreds,
  login,
  gotoTab,
  attachJson,
  PERMISSION_GATE_RE,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');

const MUTATION_RE = /\b(save|add|create|delete|remove|deactivate|transfer|publish|send|submit|approve|deny|resolve|reopen|clock in|clock out|start break|end break|upload|scan|import|sync|connect|repair|restore|backup|reset|run|generate|apply|accept|receive|update stock|deduct|log waste|assign|offer|claim|cancel shift|archive)\b/i;
const SAFE_NAV_RE = /\b(open|close|view|details|back|next|previous|today|tomorrow|week|month|filter|search|clear|show|hide|expand|collapse|menu|settings|help|refresh|retry|print|copy|download|export|jump|calendar|schedule|inventory|recipe|message|maintenance|team|financial|event|reminder|tab|active workspace|report a problem|86 voice assistant|need attention|explain|review|labor|preferences|setup checklist|account security|profile|dashboard|home|go to|switch workspace)\b|^[<>×✕✖+-]$/i;
const INTENTIONAL_EXCLUDE_RE = /log out|sign out|delete account|log out everyone/i;

async function collectControls(page) {
  return page.locator('button:visible, a:visible, input:visible, select:visible, textarea:visible, [role="button"]:visible, [role="tab"]:visible, [role="menuitem"]:visible').evaluateAll((els) => {
    const roleFor = (el) => el.getAttribute('role') || ({ BUTTON: 'button', A: 'link', INPUT: 'input', SELECT: 'select', TEXTAREA: 'textarea' }[el.tagName] || el.tagName.toLowerCase());
    const labelFor = (el) => {
      const aria = el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || '';
      const text = (el.innerText || el.value || '').trim();
      const labelledBy = el.getAttribute('aria-labelledby');
      const labelled = labelledBy ? Array.from(document.querySelectorAll(labelledBy.split(/\s+/).map(id => `#${CSS.escape(id)}`).join(','))).map(x => x.textContent || '').join(' ') : '';
      return (aria || labelled || text).replace(/\s+/g, ' ').trim().slice(0, 180);
    };
    return els.map((el, index) => {
      const rect = el.getBoundingClientRect();
      return {
        index,
        tag: el.tagName.toLowerCase(),
        role: roleFor(el),
        label: labelFor(el),
        type: el.getAttribute('type') || '',
        disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        href: el.getAttribute('href') || '',
      };
    });
  });
}

test.describe('15 exhaustive interactive-control census', () => {
  test('every visible control has an accessible name and every mutating control is explicitly covered', async ({ page }, testInfo) => {
    test.setTimeout(25 * 60 * 1000);
    const account = ownerLikeCreds();
    requireCreds(account, 'owner-like account');
    await login(page, account.email, account.password);

    const records = [];
    for (const route of ROUTE_SPECS) {
      const text = await gotoTab(page, route.tab, { settleMs: 1100, maxText: 20000 });
      if (PERMISSION_GATE_RE.test(text)) continue;
      const controls = await collectControls(page);
      for (const control of controls) {
        const label = control.label || '';
        let classification = 'unclassified';
        if (control.disabled) classification = 'disabled';
        else if (INTENTIONAL_EXCLUDE_RE.test(label)) classification = 'destructive-session-control';
        else if (['input','textarea','select'].includes(control.tag) || ['input','textarea','select','search','date','number','checkbox','radio'].includes(control.role) || /^(search|date|number|checkbox|radio|email|tel|time|month)$/i.test(control.type)) classification = label ? 'form-or-filter-control' : 'unnamed-form-control';
        else if (['link','tab','menuitem'].includes(control.role) || /^(link|tab|menuitem)$/i.test(control.role) || /route|nav|menu|tab/i.test(label)) classification = 'navigation-control';
        else if (/\b(explain|review|need attention|setup checklist|active workspace|report a problem|86 voice assistant|voice assistant|preferences|labor|help center|refresh|copy|download|print|search)\b/i.test(label)) classification = 'known-informational-action';
        else if (MUTATION_RE.test(label)) {
          const workflow = WORKFLOWS.find(item => item.label.test(label));
          if (workflow) {
            const fullPath = path.join(process.cwd(), workflow.testFile);
            const source = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
            classification = source && workflow.evidence.test(source) ? 'mutation-covered-workflow' : 'mutation-workflow-missing-evidence';
          } else classification = 'mutation-requires-workflow';
        }
        else if (SAFE_NAV_RE.test(label) || control.role === 'tab' || control.type === 'search') classification = 'safe-navigation-or-filter';
        records.push({ route: route.tab, ...control, classification });
      }
    }

    const dedupe = new Map();
    for (const row of records) {
      const key = `${row.route}|${row.role}|${row.type}|${row.label}`;
      if (!dedupe.has(key)) dedupe.set(key, row);
    }
    const unique = [...dedupe.values()];
    const unnamed = unique.filter(x => !x.label && !x.disabled);
    const unclassified = unique.filter(x => x.classification === 'unclassified');
    const mutationUncovered = unique.filter(x => ['mutation-requires-workflow', 'mutation-workflow-missing-evidence'].includes(x.classification));
    const mobileProject = /mobile/i.test(testInfo.project.name || '');
    const smallTapTargets = mobileProject ? unique.filter(x => !x.disabled && ['button', 'link', 'tab', 'menuitem'].includes(x.role) && (x.width < 42 || x.height < 42)) : [];

    await attachJson(testInfo, '15-control-census.json', {
      totals: {
        observed: records.length,
        unique: unique.length,
        unnamed: unnamed.length,
        unclassified: unclassified.length,
        mutationControlsWithoutNamedWorkflow: mutationUncovered.length,
        smallTapTargets: smallTapTargets.length,
      },
      unnamed,
      unclassified,
      mutationUncovered,
      smallTapTargets,
      unique,
      note: 'A visible mutating control is not considered tested merely because its page rendered. It needs a named create/edit/delete/undo verification workflow in the release suite.',
    });

    expect(unnamed, 'Every visible enabled control must have an accessible name').toEqual([]);
    expect(unclassified, 'Every visible control must be intentionally classified by the release gate').toEqual([]);
    expect(mutationUncovered, 'Every visible mutating control needs an explicit end-to-end workflow test; route smoke tests do not count').toEqual([]);
    expect(smallTapTargets, 'All visible interactive controls must meet the 42x42 mobile tap-target minimum').toEqual([]);
  });
});
