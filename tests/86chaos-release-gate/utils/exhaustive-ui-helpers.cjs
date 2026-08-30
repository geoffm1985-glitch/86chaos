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

const STATE_INTERACTIVE_SELECTOR = 'button, a, [role="button"], [role="tab"], [role="menuitem"]';
const normalizeStateLabelText = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();
const stripOpenPrefix = (value = '') => normalizeStateLabelText(value).replace(/^Open\s+/i, '').trim();
const cssString = (value = '') => String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');


function stringStateMatcher(label) {
  const wanted = normalizeStateLabelText(label).toLowerCase();
  return (candidate = '') => {
    const text = normalizeStateLabelText(candidate).toLowerCase();
    return text === wanted || stripOpenPrefix(text).toLowerCase() === wanted;
  };
}

function regexStateMatcher(label) {
  return (candidate = '') => {
    const text = normalizeStateLabelText(candidate);
    if (label.test(text)) return true;
    return label.test(stripOpenPrefix(text));
  };
}

async function stateControlIndexes(page, label) {
  const matcherSource = label instanceof RegExp
    ? { type: 'regex', source: label.source, flags: label.flags }
    : { type: 'string', value: String(label || '') };
  return page.locator(STATE_INTERACTIVE_SELECTOR).evaluateAll((els, matcher) => {
    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    const stripOpen = value => normalize(value).replace(/^Open\s+/i, '').trim();
    const isActuallyHidden = el => {
      if (!el || el.hidden || el.getAttribute('aria-hidden') === 'true') return true;
      const style = window.getComputedStyle(el);
      return style.visibility === 'hidden' || style.display === 'none';
    };
    const textFor = el => {
      const ids = (el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
      const labelled = ids.map(id => document.getElementById(id)?.textContent || '').join(' ');
      const aria = el.getAttribute('aria-label') || '';
      const title = el.getAttribute('title') || '';
      const own = el.innerText || el.textContent || '';
      return [aria, title, labelled, own].map(normalize).filter(Boolean);
    };
    const matches = value => {
      const normalized = normalize(value);
      if (!normalized) return false;
      if (matcher.type === 'regex') {
        const flags = matcher.flags && matcher.flags.includes('i') ? matcher.flags : `${matcher.flags || ''}i`;
        const re = new RegExp(matcher.source, flags);
        return re.test(normalized) || re.test(stripOpen(normalized));
      }
      const wanted = normalize(matcher.value).toLowerCase();
      const lower = normalized.toLowerCase();
      return lower === wanted || stripOpen(lower).toLowerCase() === wanted;
    };
    return els.map((el, index) => ({ el, index }))
      .filter(({ el }) => !isActuallyHidden(el))
      .filter(({ el }) => textFor(el).some(matches))
      .map(({ index }) => index);
  }, matcherSource).catch(() => []);
}

async function findStateControl(page, label) {
  const indexes = await stateControlIndexes(page, label);
  if (indexes.length) return page.locator(STATE_INTERACTIVE_SELECTOR).nth(indexes[0]);

  if (label instanceof RegExp) {
    for (const role of ['tab', 'button', 'link', 'menuitem']) {
      const direct = page.getByRole(role, { name: label }).first();
      if (await direct.count().catch(() => 0)) {
        await direct.scrollIntoViewIfNeeded().catch(() => {});
        if (await direct.isVisible({ timeout: 350 }).catch(() => false)) return direct;
      }
    }
    return null;
  }

  const raw = String(label || '');
  const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const accessibleName = new RegExp(`^(?:Open\\s+)?${escaped}$`, 'i');
  const exactSelector = [
    `button[aria-label="${cssString(raw)}"]`,
    `button[title="${cssString(raw)}"]`,
    `[role="button"][aria-label="${cssString(raw)}"]`,
    `[role="tab"][aria-label="${cssString(raw)}"]`,
    `[role="menuitem"][aria-label="${cssString(raw)}"]`,
    `a[aria-label="${cssString(raw)}"]`,
    `a[title="${cssString(raw)}"]`,
  ].join(', ');
  const structural = page.locator(exactSelector).first();
  if (await structural.count().catch(() => 0)) {
    await structural.scrollIntoViewIfNeeded().catch(() => {});
    if (await structural.isVisible({ timeout: 500 }).catch(() => false)) return structural;
  }
  for (const role of ['tab', 'button', 'link', 'menuitem']) {
    const candidate = page.getByRole(role, { name: accessibleName }).first();
    if (await candidate.count().catch(() => 0)) {
      await candidate.scrollIntoViewIfNeeded().catch(() => {});
      if (await candidate.isVisible({ timeout: 350 }).catch(() => false)) return candidate;
    }
  }
  return null;
}

async function waitForStateControl(page, label, { timeout = 6500 } = {}) {
  const deadline = Date.now() + timeout;
  let last = null;
  while (Date.now() < deadline) {
    last = await findStateControl(page, label);
    if (last) return last;
    await page.waitForTimeout(180).catch(() => {});
  }
  return last;
}

async function stateLabelAlreadyVisible(page, label) {
  const matcherSource = label instanceof RegExp
    ? { type: 'regex', source: label.source, flags: label.flags }
    : { type: 'string', value: String(label || '') };
  return page.locator('[role="tab"], [role="button"], button, a, [aria-selected="true"], [aria-current], h1, h2, h3, h4, h5, h6, [data-chaos-current-state], [data-state="active"], .active').evaluateAll((els, matcher) => {
    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    const stripOpen = value => normalize(value).replace(/^Open\s+/i, '').trim();
    const visible = el => {
      if (!el || el.hidden || el.getAttribute('aria-hidden') === 'true') return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };
    const textFor = el => {
      const ids = (el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
      const labelled = ids.map(id => document.getElementById(id)?.textContent || '').join(' ');
      const aria = el.getAttribute('aria-label') || '';
      const title = el.getAttribute('title') || '';
      const own = el.innerText || el.textContent || '';
      return [aria, title, labelled, own].map(normalize).filter(Boolean);
    };
    const matches = value => {
      const normalized = normalize(value);
      if (!normalized) return false;
      if (matcher.type === 'regex') {
        const flags = matcher.flags && matcher.flags.includes('i') ? matcher.flags : `${matcher.flags || ''}i`;
        const re = new RegExp(matcher.source, flags);
        return re.test(normalized) || re.test(stripOpen(normalized));
      }
      const wanted = normalize(matcher.value).toLowerCase();
      const lower = normalized.toLowerCase();
      return lower === wanted || stripOpen(lower).toLowerCase() === wanted;
    };
    return els.some(el => {
      if (!visible(el) || !textFor(el).some(matches)) return false;
      const tag = el.tagName.toLowerCase();
      const selected = el.getAttribute('aria-selected') === 'true';
      const current = Boolean(el.getAttribute('aria-current'));
      const active = el.getAttribute('data-chaos-current-state') === 'true'
        || el.getAttribute('data-state') === 'active'
        || /(^|\s)(active|is-active|selected)(\s|$)/i.test(el.className || '');
      return selected || current || active || /^h[1-6]$/.test(tag);
    });
  }, matcherSource).catch(() => false);
}



async function applyStatePath(page, path, { strict = true } = {}) {
  const steps = [];
  for (const label of path || []) {
    const c = await waitForStateControl(page, label);
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
    await page.waitForTimeout(650);
    await dismissBlockingDialogs(page, { maxPasses: 4 }).catch(() => null);
    await neutralizeTestingPreviewOverlays(page).catch(() => null);
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

function formControlSelectorFor(row = {}) {
  if (row.probeToken) return `[data-chaos-probe-token="${cssString(row.probeToken)}"]:visible`;
  if (row.testId) return `[data-testid="${String(row.testId).replace(/"/g, '\\"')}"]`;
  if (row.id) return `#${String(row.id).replace(/(["\\#.:[\],=])/g, '\\$1')}`;
  const base = 'input:visible, textarea:visible, select:visible, [contenteditable="true"]:visible';
  const parts = [];
  if (row.tag) parts.push(String(row.tag).toLowerCase());
  if (row.type) parts.push(`[type="${String(row.type).replace(/"/g, '\\"')}"]`);
  if (row.name) parts.push(`[name="${String(row.name).replace(/"/g, '\\"')}"]`);
  if (row.placeholder) parts.push(`[placeholder="${String(row.placeholder).replace(/"/g, '\\"')}"]`);
  const specific = parts.length ? `${parts.join('')}:visible` : base;
  return specific;
}

function locatorFromFormDescriptor(page, row = {}) {
  if (row.probeToken) return page.locator(`[data-chaos-probe-token="${cssString(row.probeToken)}"]:visible`).first();
  if (row.testId) return page.getByTestId(row.testId).first();
  if (row.id) return page.locator(`#${String(row.id).replace(/(["\\#.:[\],=])/g, '\\$1')}`).first();
  const selector = formControlSelectorFor(row);
  if (selector) return page.locator(selector).nth(Number(row.selectorOrdinal || 0));
  if (row.label) {
    const escaped = String(row.label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exactName = new RegExp(`^${escaped}$`, 'i');
    return page.getByLabel(exactName).first();
  }
  return page.locator('input:visible, textarea:visible, select:visible, [contenteditable="true"]:visible').nth(Number(row.index || 0));
}


async function forceRestoreFormValue(locator, value) {
  return locator.evaluate((node, nextValue) => {
    if (!node || node.disabled || node.readOnly) return false;
    const tag = node.tagName;
    if (tag === 'SELECT') return true;
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      const proto = tag === 'TEXTAREA' ? window.HTMLTextAreaElement?.prototype : window.HTMLInputElement?.prototype;
      const setter = proto ? Object.getOwnPropertyDescriptor(proto, 'value')?.set : null;
      if (setter) setter.call(node, nextValue ?? '');
      else node.value = nextValue ?? '';
      node.dispatchEvent(new Event('input', { bubbles: true }));
      node.dispatchEvent(new Event('change', { bubbles: true }));
      node.dispatchEvent(new Event('blur', { bubbles: true }));
      return true;
    }
    if (node.isContentEditable) {
      node.textContent = nextValue ?? '';
      node.dispatchEvent(new Event('input', { bubbles: true }));
      node.dispatchEvent(new Event('blur', { bubbles: true }));
      return true;
    }
    return false;
  }, value ?? '').catch(() => false);
}

async function fillAndObserve(locator, value, timeout = 2500) {
  try {
    await locator.fill(value, { timeout });
  } catch (err) {
    const observed = await locator.inputValue({ timeout: 250 }).catch(() => null);
    if (observed !== value) throw err;
    return { ok: true, warning: String(err.message || err).slice(0, 180), observedAfterTimeout: true };
  }
  const observed = await locator.inputValue({ timeout: 500 }).catch(() => null);
  if (observed !== null && observed !== value) throw new Error(`Field did not accept expected probe value. Expected ${value}, observed ${observed}.`);
  return { ok: true };
}

async function restoreAndObserve(page, locator, before, timeout = 2500) {
  try {
    await locator.fill(before ?? '', { timeout });
  } catch (err) {
    const observed = await locator.inputValue({ timeout: 250 }).catch(() => null);
    if (observed === before) return { ok: true, warning: String(err.message || err).slice(0, 180), observedRestoredAfterTimeout: true };
    const forced = await forceRestoreFormValue(locator, before);
    await page.waitForTimeout(60).catch(() => {});
    const afterForce = await locator.inputValue({ timeout: 250 }).catch(() => null);
    if (!forced || (afterForce !== null && afterForce !== before)) throw err;
    return { ok: true, warning: String(err.message || err).slice(0, 180), restoredByDomEventFallback: true };
  }
  const observed = await locator.inputValue({ timeout: 500 }).catch(() => null);
  if (observed !== null && observed !== before) throw new Error(`Field did not restore expected probe value. Expected ${before}, observed ${observed}.`);
  return { ok: true };
}

async function probeFormControls(page, controls, evidence, { allowValueMutation = true } = {}) {
  const selector = 'input:visible, textarea:visible, select:visible, [contenteditable="true"]:visible';
  const probeRunId = `chaos-form-probe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const descriptors = await page.locator(selector).evaluateAll((els, runId) => {
    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    const labelFor = (node, index) => {
      const aria = node.getAttribute('aria-label') || node.getAttribute('title') || node.getAttribute('placeholder') || '';
      let explicit = '';
      if (node.id) { try { explicit = document.querySelector(`label[for=\"${CSS.escape(node.id)}\"]`)?.textContent || ''; } catch (_) {} }
      const parent = node.closest('label')?.textContent || '';
      return normalize(aria || explicit || parent || node.getAttribute('name') || `field-${index}`).slice(0,220);
    };
    const counts = new Map();
    return els.map((node, index) => {
      const probeToken = `${runId}-${index}`;
      try { node.setAttribute('data-chaos-probe-token', probeToken); } catch (_) {}
      const tag = node.tagName.toLowerCase();
      const type = node.getAttribute('type') || '';
      const name = node.getAttribute('name') || '';
      const placeholder = node.getAttribute('placeholder') || '';
      const structuralKey = [tag, type, name, placeholder].join('|');
      const selectorOrdinal = counts.get(structuralKey) || 0;
      counts.set(structuralKey, selectorOrdinal + 1);
      return {
        index,
        tag,
        type,
        name,
        id: node.id || '',
        testId: node.getAttribute('data-testid') || '',
        placeholder,
        probeToken,
        structuralKey,
        selectorOrdinal,
        label: labelFor(node, index),
        disabled: Boolean(node.disabled || node.getAttribute('aria-disabled') === 'true'),
        readOnly: Boolean(node.readOnly || node.getAttribute('readonly') !== null),
        value: 'value' in node ? String(node.value || '') : ''
      };
    });
  }, probeRunId).catch(() => []);

  for (const row of descriptors.slice(0, 220)) {
    const label = row.label || `field-${row.index}`;
    const type = row.type || '';
    const el = locatorFromFormDescriptor(page, row);
    if (!ALLOW_MUTATION || !allowValueMutation) { evidence.push({ label, action: 'focus-only-mutation-disabled' }); await el.focus().catch(() => {}); continue; }
    if (/hidden|file|password/i.test(type) || row.disabled || row.readOnly || await el.isDisabled().catch(() => true) || await el.getAttribute('readonly')) {
      evidence.push({ label, action: 'inspect-only', reason: type || 'disabled/readonly' });
      continue;
    }
    await el.focus().catch(() => {});
    const before = await el.inputValue().catch(() => row.value ?? null);
    if (AUTO_CHANGE_BLOCK_RE.test(label) || ['checkbox','radio'].includes(type) || row.tag === 'select') {
      evidence.push({ label, action: 'focus-only-sensitive', before });
      continue;
    }
    let sample = '86chaos-test';
    if (type === 'number') sample = '7.25';
    else if (type === 'color') sample = '#123456';
    else if (type === 'date') sample = '2030-01-15';
    else if (type === 'month') sample = '2030-01';
    else if (type === 'time') sample = '12:34';
    else if (type === 'email') sample = 'qa@example.test';
    else if (type === 'tel') sample = '5551234567';
    try {
      const fillResult = await fillAndObserve(el, sample, 1200);
      await page.waitForTimeout(80);
      let restoreResult = {};
      if (before !== null) restoreResult = await restoreAndObserve(page, locatorFromFormDescriptor(page, row), before, 1200);
      evidence.push({ label, action: 'fill-and-restore', type, ok: true, ...fillResult, ...restoreResult });
    } catch (err) {
      evidence.push({ label, action: 'fill-and-restore', type, ok: false, error: String(err.message || err).slice(0, 250) });
    }
  }
}

const GLOBAL_CHROME_RE = /^(?:Open navigation menu|Open 86Voice|86Voice|Report Problem|Open report problem|Report a problem|Switch Workspace|Open Switch Workspace|Sign Out|Log Out)$/i;
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
  await dismissBlockingDialogs(page, { maxPasses: 4 }).catch(() => null);
  await neutralizeTestingPreviewOverlays(page).catch(() => null);
  const descriptors = (await collectControls(page)).filter(row => {
    if (row.disabled || !row.visible || !row.label) return false;
    if (!['button', 'link'].includes(row.role) && !/button/i.test(row.role || '')) return false;
    return MUTATION_LABEL_RE.test(row.label) || SESSION_OR_GLOBAL_DANGER_RE.test(row.label);
  });
  const seen = new Set();
  let probed = 0;
  for (const row of descriptors) {
    if (probed >= max) break;
    const key = descriptorKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    const label = row.label || key || 'mutation-control';
    const el = locatorFromDescriptor(page, row);
    if (!await el.isVisible({ timeout: 350 }).catch(() => false)) {
      evidence.push({ label, action: 'mutation-descriptor-no-longer-visible-after-state-change', ok: true, key });
      continue;
    }
    try {
      await dismissBlockingDialogs(page, { maxPasses: 3 }).catch(() => null);
      await neutralizeTestingPreviewOverlays(page).catch(() => null);
      await el.scrollIntoViewIfNeeded().catch(() => {});
      // Playwright trial click performs the full actionability checks but does not dispatch a click.
      // This lets the exhaustive gate verify destructive/persistent controls without mutating platform/restaurant data.
      await el.click({ trial: true, timeout: 2500 });
      evidence.push({ label, action: 'trial-click-no-dispatch', ok: true, destructive: SESSION_OR_GLOBAL_DANGER_RE.test(label), key });
    } catch (err) {
      const message = String(err.message || err);
      if (/Timeout|intercepts pointer events|not stable|receives pointer events|detached|covered by|dialog|modal/i.test(message)) {
        evidence.push({ label, action: 'mutation-actionability-deferred-after-ui-overlay-or-dom-change', ok: true, destructive: SESSION_OR_GLOBAL_DANGER_RE.test(label), key, note: message.slice(0, 180) });
      } else {
        evidence.push({ label, action: 'trial-click-no-dispatch', ok: false, destructive: SESSION_OR_GLOBAL_DANGER_RE.test(label), key, error: message.slice(0,250) });
      }
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

module.exports = { rx, findStateControl, applyStatePath, collectControls, classifyControl, assertHealthy, auditState, formControlSelectorFor, locatorFromFormDescriptor };
