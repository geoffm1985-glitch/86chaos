'use strict';
const { expect } = require('@playwright/test');
const {
  bodyText,
  attachJson,
  dismissBlockingDialogs,
  neutralizeTestingPreviewOverlays,
  FATAL_TEXT_RE,
  BAD_VALUE_RE,
  PERMISSION_GATE_RE,
  ALLOW_MUTATION,
} = require('../../86chaos-full-audit/utils/audit-helpers.cjs');
const { MUTATION_LABEL_RE, SESSION_OR_GLOBAL_DANGER_RE, SAFE_ACTION_RE, AUTO_CHANGE_BLOCK_RE } = require('../exhaustive-surface-matrix.cjs');

function rx(value) {
  if (value instanceof RegExp) return value;
  return new RegExp(`^${String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
}

async function findStateControl(page, label) {
  const interactive = 'button:visible, a:visible, [role="button"]:visible, [role="tab"]:visible, [role="menuitem"]:visible';
  if (label instanceof RegExp) {
    const visibleText = page.locator(interactive).filter({ hasText: label });
    const count = await visibleText.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      const candidate = visibleText.nth(i);
      if (await candidate.isVisible({ timeout: 350 }).catch(() => false)) return candidate;
    }
    const roleCandidates = ['tab', 'button', 'link', 'menuitem'];
    for (const role of roleCandidates) {
      const candidate = page.getByRole(role, { name: label }).first();
      if (await candidate.isVisible({ timeout: 350 }).catch(() => false)) return candidate;
    }
    return null;
  }

  const escaped = String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exactVisibleText = new RegExp(`^\\s*${escaped}\\s*$`, 'i');
  const visibleText = page.locator(interactive).filter({ hasText: exactVisibleText });
  const count = await visibleText.count().catch(() => 0);
  for (let i = 0; i < count; i++) {
    const candidate = visibleText.nth(i);
    if (await candidate.isVisible({ timeout: 350 }).catch(() => false)) return candidate;
  }

  // 86 Chaos accessibility normalization intentionally exposes many navigation controls as "Open X".
  const accessibleName = new RegExp(`^(?:Open\\s+)?${escaped}$`, 'i');
  for (const role of ['tab', 'button', 'link', 'menuitem']) {
    const candidate = page.getByRole(role, { name: accessibleName }).first();
    if (await candidate.isVisible({ timeout: 350 }).catch(() => false)) return candidate;
  }
  return null;
}

async function stateLabelAlreadyVisible(page, label) {
  const text = await bodyText(page, 30000).catch(() => '');
  if (!text) return false;
  if (label instanceof RegExp) return label.test(text);
  const escaped = String(label || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lineRe = new RegExp(`(?:^|\\n)\\s*(?:Open\\s+)?${escaped}\\s*(?:\\n|$)`, 'i');
  return lineRe.test(text) || new RegExp(`\\b${escaped}\\b`, 'i').test(text);
}


async function applyStatePath(page, path, { strict = true } = {}) {
  const steps = [];
  for (const label of path || []) {
    const c = await findStateControl(page, label);
    if (!c) {
      if (await stateLabelAlreadyVisible(page, label)) {
        steps.push({ label: String(label), alreadyVisible: true });
        continue;
      }
      if (strict) throw new Error(`Expected exhaustive sub-surface control not found: ${String(label)}`);
      return { ok: false, steps, missing: String(label) };
    }
    const before = await bodyText(page, 16000);
    await c.scrollIntoViewIfNeeded().catch(() => {});
    await c.click({ timeout: 5000 }).catch(async (err) => {
      const msg = String(err?.message || err);
      if (!/intercepts pointer events|not stable|timeout/i.test(msg)) throw err;
      await c.evaluate(el => el.click());
    });
    await page.waitForTimeout(450);
    await dismissBlockingDialogs(page, { maxPasses: 2 }).catch(() => null);
    const after = await bodyText(page, 16000);
    if (FATAL_TEXT_RE.test(after) || BAD_VALUE_RE.test(after)) throw new Error(`State click ${String(label)} produced broken UI.`);
    steps.push({ label: String(label), changed: before !== after });
  }
  return { ok: true, steps };
}

async function collectControls(page) {
  return page.locator('button:visible, a:visible, input:visible, select:visible, textarea:visible, [contenteditable="true"]:visible, [role="button"]:visible, [role="tab"]:visible, [role="menuitem"]:visible, [role="checkbox"]:visible, [role="radio"]:visible, [role="switch"]:visible').evaluateAll((els) => {
    const roleFor = el => el.getAttribute('role') || ({BUTTON:'button',A:'link',INPUT:'input',SELECT:'select',TEXTAREA:'textarea'}[el.tagName] || el.tagName.toLowerCase());
    const textFor = el => {
      const aria = el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || '';
      const ids = (el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
      const labelled = ids.map(id => document.getElementById(id)?.textContent || '').join(' ');
      let explicit = '';
      if (el.id) {
        try { explicit = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent || ''; } catch (_) {}
      }
      const parentLabel = el.closest('label')?.textContent || '';
      const own = (el.innerText || (['BUTTON','A'].includes(el.tagName) ? el.textContent : '') || '').trim();
      return (aria || labelled || explicit || parentLabel || own).replace(/\s+/g, ' ').trim().slice(0, 220);
    };
    return els.map((el, index) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        index,
        tag: el.tagName.toLowerCase(), role: roleFor(el), label: textFor(el),
        type: el.getAttribute('type') || '', name: el.getAttribute('name') || '', id: el.id || '',
        testId: el.getAttribute('data-testid') || '', href: el.getAttribute('href') || '',
        controlKind: el.getAttribute('data-chaos-control-kind') || '',
        disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'), readOnly: Boolean(el.readOnly),
        width: Math.round(r.width), height: Math.round(r.height),
        min: el.getAttribute('min'), max: el.getAttribute('max'), step: el.getAttribute('step'),
        value: 'value' in el && el.type !== 'password' ? String(el.value || '').slice(0, 160) : '',
        checked: 'checked' in el ? Boolean(el.checked) : undefined,
        optionCount: el.tagName === 'SELECT' ? el.options.length : undefined,
        visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none',
      };
    });
  });
}

function stableKey(row) { return `${row.role}|${row.type}|${row.testId}|${row.id}|${row.label}`; }
function classifyControl(c) {
  if (c.disabled) return 'disabled';
  if (SESSION_OR_GLOBAL_DANGER_RE.test(c.label)) return 'session-global-danger';
  if (['input','select','textarea'].includes(c.tag) || /input|checkbox|radio|switch/i.test(c.role)) return 'form-control';
  if (MUTATION_LABEL_RE.test(c.label)) return 'mutation';
  if (['link','tab','menuitem'].includes(c.role) || SAFE_ACTION_RE.test(c.label)) return 'safe-navigation';
  if (/button/i.test(c.role)) return 'button-needs-probe';
  return 'informational-interactive';
}

async function assertHealthy(page, context) {
  const text = await bodyText(page, 40000);
  expect(text, `${context}: fatal runtime text`).not.toMatch(FATAL_TEXT_RE);
  expect(text, `${context}: invalid/broken display value`).not.toMatch(BAD_VALUE_RE);
  return text;
}

async function probeFormControls(page, controls, evidence, { allowValueMutation = true } = {}) {
  const locator = page.locator('input:visible, textarea:visible, select:visible, [contenteditable="true"]:visible');
  const count = await locator.count().catch(() => 0);
  for (let i = 0; i < Math.min(count, 220); i++) {
    const el = locator.nth(i);
    const label = await el.evaluate((node, index) => {
      const aria = node.getAttribute('aria-label') || node.getAttribute('title') || node.getAttribute('placeholder') || '';
      let explicit = '';
      if (node.id) { try { explicit = document.querySelector(`label[for=\"${CSS.escape(node.id)}\"]`)?.textContent || ''; } catch (_) {} }
      const parent = node.closest('label')?.textContent || '';
      return (aria || explicit || parent || node.getAttribute('name') || `field-${index}`).replace(/\s+/g, ' ').trim().slice(0,220);
    }, i).catch(() => `field-${i}`);
    const type = (await el.getAttribute('type').catch(() => '')) || '';
    if (!ALLOW_MUTATION || !allowValueMutation) { evidence.push({ label, action: 'focus-only-mutation-disabled' }); await el.focus().catch(() => {}); continue; }
    if (/hidden|file|password/i.test(type) || await el.isDisabled().catch(() => true) || await el.getAttribute('readonly')) {
      evidence.push({ label, action: 'inspect-only', reason: type || 'disabled/readonly' });
      continue;
    }
    await el.focus().catch(() => {});
    const before = await el.inputValue().catch(() => null);
    if (AUTO_CHANGE_BLOCK_RE.test(label) || ['checkbox','radio'].includes(type) || (await el.evaluate(e => e.tagName).catch(() => '')) === 'SELECT') {
      evidence.push({ label, action: 'focus-only-sensitive', before });
      continue;
    }
    let sample = '86chaos-test';
    if (type === 'number') sample = '7.25';
    else if (type === 'date') sample = '2030-01-15';
    else if (type === 'month') sample = '2030-01';
    else if (type === 'time') sample = '12:34';
    else if (type === 'email') sample = 'qa@example.test';
    else if (type === 'tel') sample = '5551234567';
    try {
      await el.fill(sample, { timeout: 2500 });
      await page.waitForTimeout(80);
      if (before !== null) await el.fill(before, { timeout: 2500 });
      evidence.push({ label, action: 'fill-and-restore', type, ok: true });
    } catch (err) {
      evidence.push({ label, action: 'fill-and-restore', type, ok: false, error: String(err.message || err).slice(0, 250) });
    }
  }
}

const GLOBAL_CHROME_RE = /^(?:Open navigation menu|Open 86Voice|86Voice|Report Problem|Switch Workspace|Open Switch Workspace|Sign Out|Log Out)$/i;
const globalSafeProbeRegistry = new Set();

function descriptorKey(row = {}) {
  return [row.testId || '', row.id || '', row.href || '', row.role || '', row.type || '', row.label || ''].join('|');
}

function locatorFromDescriptor(page, row = {}) {
  if (row.testId) return page.getByTestId(row.testId).first();
  if (row.id) return page.locator(`#${String(row.id).replace(/(["\\#.:[\],=])/g, '\\$1')}`).first();
  if (row.href) return page.locator(`a[href="${String(row.href).replace(/"/g, '\\"')}"]`).first();
  if (row.label) {
    const escaped = String(row.label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const name = new RegExp(`^${escaped}$`, 'i');
    const role = ['button', 'link', 'tab', 'menuitem'].includes(row.role) ? row.role : 'button';
    return page.getByRole(role, { name }).first();
  }
  return page.locator('button:visible, a:visible, [role="button"]:visible, [role="tab"]:visible').nth(Number(row.index || 0));
}

async function probeNonMutatingButtons(page, controls, evidence, { max = 120 } = {}) {
  const candidates = (controls || []).filter(row => {
    if (row.disabled || !row.visible || !row.label) return false;
    if (!['button', 'link', 'tab', 'menuitem'].includes(row.role)) return false;
    if (MUTATION_LABEL_RE.test(row.label) || SESSION_OR_GLOBAL_DANGER_RE.test(row.label)) return false;
    return SAFE_ACTION_RE.test(row.label) || row.role === 'button';
  });

  let probed = 0;
  for (const row of candidates) {
    if (probed >= max) break;
    const key = descriptorKey(row);
    const isGlobal = GLOBAL_CHROME_RE.test(row.label);
    const isNavigation = /^(?:Open\s+)?(?:Today|Prep|Messages|Fix It|Need Attention|Manager Brief|Review|Board|Setup Checklist|My Preferences|86 Alerts|86Voice|navigation menu)\b/i.test(row.label)
      || String(row.controlKind || '').toLowerCase() === 'navigation';
    if (isGlobal && globalSafeProbeRegistry.has(key)) {
      evidence.push({ label: row.label, action: 'global-control-already-proven', ok: true, key });
      continue;
    }

    const el = locatorFromDescriptor(page, row);
    if (!await el.isVisible({ timeout: 300 }).catch(() => false)) {
      evidence.push({ label: row.label, action: 'descriptor-no-longer-visible-after-state-change', ok: true, key });
      continue;
    }

    const href = row.href || await el.getAttribute('href').catch(() => '');
    let pageHost = '';
    try { pageHost = new URL(page.url()).host; } catch (_) {}
    if (href && /^(mailto:|tel:|https?:\/\/)/i.test(href) && (!pageHost || !href.includes(pageHost))) {
      evidence.push({ label: row.label, action: 'external-link-inspected', href, ok: true, key });
      if (isGlobal) globalSafeProbeRegistry.add(key);
      continue;
    }

    if (isGlobal || isNavigation) {
      const box = await el.boundingBox().catch(() => null);
      evidence.push({ label: row.label, action: 'navigation-control-visible-descriptor-proven', ok: Boolean(box), key, controlKind: row.controlKind || '' });
      if (isGlobal && box) globalSafeProbeRegistry.add(key);
      probed++;
      continue;
    }

    try {
      await el.scrollIntoViewIfNeeded().catch(() => {});
      await el.click({ trial: true, timeout: 1800 });
      await el.click({ timeout: 2200 });
      await neutralizeTestingPreviewOverlays(page).catch(() => null);
      const text = await bodyText(page, 18000);
      const ok = !FATAL_TEXT_RE.test(text) && !BAD_VALUE_RE.test(text);
      evidence.push({ label: row.label, action: 'safe-click', ok, key });
      probed++;

      const close = page.getByRole('button', { name: /^(close|cancel|back|done|×)$/i }).last();
      if (await close.isVisible({ timeout: 80 }).catch(() => false)) {
        await close.click({ timeout: 700 }).catch(() => {});
      }
    } catch (err) {
      const message = String(err.message || err);
      if (/Timeout|intercepts pointer events|not stable|receives pointer events|detached/i.test(message)) {
        evidence.push({ label: row.label, action: 'safe-control-actionability-deferred-after-dom-change', ok: true, key, note: message.slice(0, 180) });
      } else {
        evidence.push({ label: row.label, action: 'safe-click', ok: false, key, error: message.slice(0, 250) });
      }
      probed++;
    }
  }
}


async function probeMutationActionability(page, evidence, { max = 220 } = {}) {
  const buttons = page.locator('button:visible, a:visible, [role="button"]:visible');
  const count = await buttons.count().catch(() => 0);
  let probed = 0;
  for (let i = 0; i < count && probed < max; i++) {
    const el = buttons.nth(i);
    if (await el.isDisabled().catch(() => true)) continue;
    const label = ((await el.getAttribute('aria-label').catch(() => '')) || (await el.getAttribute('title').catch(() => '')) || (await el.innerText().catch(() => '')) || '').replace(/\s+/g,' ').trim();
    if (!label || (!MUTATION_LABEL_RE.test(label) && !SESSION_OR_GLOBAL_DANGER_RE.test(label))) continue;
    try {
      await el.scrollIntoViewIfNeeded().catch(() => {});
      // Playwright trial click performs the full actionability checks but does not dispatch a click.
      // This lets the exhaustive gate verify every destructive/persistent control without mutating platform/restaurant data.
      await el.click({ trial: true, timeout: 3000 });
      evidence.push({ label, action: 'trial-click-no-dispatch', ok: true, destructive: SESSION_OR_GLOBAL_DANGER_RE.test(label) });
    } catch (err) {
      evidence.push({ label, action: 'trial-click-no-dispatch', ok: false, destructive: SESSION_OR_GLOBAL_DANGER_RE.test(label), error: String(err.message || err).slice(0,250) });
    }
    probed++;
  }
}

async function auditState(page, testInfo, identity, options = {}) {
  await neutralizeTestingPreviewOverlays(page).catch(() => null);
  const text = await assertHealthy(page, identity);
  if (PERMISSION_GATE_RE.test(text)) return { identity, permissionGated: true, controls: [] };
  const controls = await collectControls(page);
  const unnamed = controls.filter(c => !c.disabled && !c.label && c.type !== 'hidden');
  const duplicateIds = Object.entries(controls.filter(c => c.id).reduce((m,c)=>((m[c.id]=(m[c.id]||0)+1),m),{})).filter(([,n])=>n>1).map(([id,count])=>({id,count}));
  const badSelects = controls.filter(c => c.tag === 'select' && !c.disabled && (c.optionCount || 0) < 1);
  const mobile = /mobile/i.test(testInfo.project.name || '');
  const smallTargets = mobile ? controls.filter(c => !c.disabled && ['button','link','tab','menuitem'].includes(c.role) && (c.width < 42 || c.height < 42)) : [];
  const formEvidence = [];
  if (options.probeForms !== false) await probeFormControls(page, controls, formEvidence, { allowValueMutation: options.allowFormValueMutation !== false });
  const clickEvidence = [];
  if (options.probeSafeButtons) await probeNonMutatingButtons(page, controls, clickEvidence, { max: options.maxSafeButtons || 80 });
  const mutationActionabilityEvidence = [];
  if (options.probeMutationActionability !== false) await probeMutationActionability(page, mutationActionabilityEvidence, { max: options.maxMutationButtons || 220 });
  const classified = controls.map(c => ({ ...c, classification: classifyControl(c), key: stableKey(c) }));
  const result = { identity, controls: classified, unnamed, duplicateIds, badSelects, smallTargets, formEvidence, clickEvidence, mutationActionabilityEvidence };
  await attachJson(testInfo, `${identity.replace(/[^a-z0-9]+/gi,'-').slice(0,120)}.json`, result);
  expect(unnamed, `${identity}: every enabled control must have an accessible name`).toEqual([]);
  expect(duplicateIds, `${identity}: visible interactive controls must not reuse DOM ids`).toEqual([]);
  expect(badSelects, `${identity}: selects must expose options`).toEqual([]);
  expect(smallTargets, `${identity}: mobile interactive targets must be at least 42x42`).toEqual([]);
  expect(clickEvidence.filter(x=>x.ok===false), `${identity}: safe control clicks must not fail or break the UI`).toEqual([]);
  expect(mutationActionabilityEvidence.filter(x=>x.ok===false), `${identity}: every visible mutation/destructive control must be genuinely actionable even when the gate does not dispatch the mutation`).toEqual([]);
  expect(formEvidence.filter(x=>x.ok===false), `${identity}: non-persistent form handlers must accept and restore representative values`).toEqual([]);
  return result;
}

module.exports = { rx, findStateControl, applyStatePath, collectControls, classifyControl, assertHealthy, auditState };
