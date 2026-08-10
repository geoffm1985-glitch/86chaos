'use strict';
const fs = require('fs');
const path = require('path');

const CANONICAL_VERCEL_PROJECT_SLUG = '86chaos';
const RETIRED_VERCEL_PROJECT_SLUGS = ['cheers-portal-4oxv'];
const PRODUCTION_HOST = 'app.86chaos.com';
const TARGET_ENV_KEYS = ['APP_URL', 'CHAOS_BASE_URL', 'CHAOS_EXPECTED_VERSION', 'CHAOS_EXPECTED_VERCEL_PROJECT_SLUG'];

function parseEnvText(text = '') {
  const out = {};
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

function readEnvFile(file) {
  try {
    if (!file || !fs.existsSync(file)) return {};
    return parseEnvText(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return {};
  }
}

function normalizeUrlForCompare(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString().replace(/\/$/, '');
  } catch (_) {
    return raw.replace(/\/+$/, '');
  }
}

function hostOf(value = '') {
  try { return new URL(String(value || '').trim()).hostname.toLowerCase().replace(/\.+$/, ''); } catch (_) { return ''; }
}

function isProductionHost(host = '') {
  const clean = String(host || '').toLowerCase().replace(/\.+$/, '');
  return clean === PRODUCTION_HOST || clean === '86chaos.com' || clean === 'www.86chaos.com';
}

function isRetiredVercelHost(host = '') {
  const clean = String(host || '').toLowerCase();
  return RETIRED_VERCEL_PROJECT_SLUGS.some(slug => clean === `${slug}.vercel.app` || clean.startsWith(`${slug}-`) && clean.endsWith('.vercel.app'));
}

function isCanonicalVercelPreviewHost(host = '', slug = CANONICAL_VERCEL_PROJECT_SLUG) {
  const clean = String(host || '').toLowerCase().replace(/\.+$/, '');
  const expected = String(slug || CANONICAL_VERCEL_PROJECT_SLUG).toLowerCase();
  if (!clean.endsWith('.vercel.app')) return false;
  if (isRetiredVercelHost(clean)) return false;
  return clean === `${expected}.vercel.app` || clean.startsWith(`${expected}-`);
}

function inspectReleaseTargetEnvConflicts(root = process.cwd(), env = process.env, keys = TARGET_ENV_KEYS) {
  const testEnv = readEnvFile(path.join(root, '.env.test.local'));
  const localEnv = readEnvFile(path.join(root, '.env.local'));
  const errors = [];
  const values = {};
  for (const key of keys) {
    const processValue = String(env[key] || '').trim();
    const testValue = String(testEnv[key] || '').trim();
    const localValue = String(localEnv[key] || '').trim();
    values[key] = { process: processValue, envTestLocal: testValue, envLocal: localValue };
    const nonEmpty = [
      ['process environment', processValue],
      ['.env.test.local', testValue],
      ['.env.local', localValue],
    ].filter(([, value]) => value);
    for (let i = 0; i < nonEmpty.length; i += 1) {
      for (let j = i + 1; j < nonEmpty.length; j += 1) {
        const [aName, aValue] = nonEmpty[i];
        const [bName, bValue] = nonEmpty[j];
        const left = /URL$|BASE_URL$/.test(key) ? normalizeUrlForCompare(aValue) : aValue;
        const right = /URL$|BASE_URL$/.test(key) ? normalizeUrlForCompare(bValue) : bValue;
        if (left && right && left !== right) {
          errors.push(`Conflicting ${key} values detected. ${aName} points to ${aValue} while ${bName} points to ${bValue}. Clear the stale process variable or explicitly choose the intended target.`);
        }
      }
    }
  }
  return { ok: errors.length === 0, errors, values };
}

function validateReleaseTarget(options = {}) {
  const appUrl = String(options.appUrl || '').trim();
  const chaosBaseUrl = String(options.chaosBaseUrl || '').trim();
  const expectedSlug = String(options.expectedProjectSlug || CANONICAL_VERCEL_PROJECT_SLUG).trim() || CANONICAL_VERCEL_PROJECT_SLUG;
  const expectedVersion = String(options.expectedVersion || '').trim();
  const sourceVersion = String(options.sourceVersion || '').trim();
  const deployedVersion = String(options.deployedVersion || '').trim();
  const allowLocal = options.allowLocal === true;
  const errors = [];
  const warnings = [];
  const url = appUrl || chaosBaseUrl;
  const host = hostOf(url);
  const canonical = isCanonicalVercelPreviewHost(host, expectedSlug);
  const retired = isRetiredVercelHost(host);
  const production = isProductionHost(host);

  if (!url) errors.push('Missing APP_URL or CHAOS_BASE_URL. Use a non-production testing preview from canonical Vercel project 86chaos.');
  if (url && !host) errors.push(`APP_URL/CHAOS_BASE_URL is not a valid absolute URL: ${url}`);
  if (appUrl && chaosBaseUrl) {
    const a = normalizeUrlForCompare(appUrl);
    const b = normalizeUrlForCompare(chaosBaseUrl);
    const appHost = hostOf(appUrl);
    const baseHost = hostOf(chaosBaseUrl);
    if (appHost && baseHost && appHost !== baseHost) errors.push(`APP_URL and CHAOS_BASE_URL point to different hosts: ${appHost} vs ${baseHost}. Clear the stale value before any QA mutation.`);
    else if (a && b && a !== b) warnings.push(`APP_URL and CHAOS_BASE_URL differ only below the same host; APP_URL=${appUrl}, CHAOS_BASE_URL=${chaosBaseUrl}.`);
  }
  if (production) errors.push(`Mutating release-gate testing refuses production host ${host}. Use a non-production preview from canonical Vercel project ${expectedSlug}.`);
  if (retired) errors.push(`APP_URL belongs to retired Vercel project cheers-portal-4oxv. Use a testing preview from canonical project ${expectedSlug}.`);
  if (host && host.endsWith('.vercel.app') && !canonical) errors.push(`APP_URL host ${host} is not in the canonical Vercel project family ${expectedSlug}.`);
  if (host && !host.endsWith('.vercel.app') && !production && !allowLocal) errors.push(`APP_URL host ${host} is not a Vercel testing preview. Use a non-production preview from canonical project ${expectedSlug}.`);
  if (expectedVersion && sourceVersion && sourceVersion !== expectedVersion) errors.push(`Source version ${sourceVersion} does not match CHAOS_EXPECTED_VERSION ${expectedVersion}.`);
  if (expectedVersion && deployedVersion && deployedVersion !== expectedVersion) errors.push(`Testing preview is stale. Source/expected=${sourceVersion || expectedVersion}, deployed=${deployedVersion}. Deploy the current commit to canonical Vercel project ${expectedSlug}, then update APP_URL to that preview.`);
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    appUrl,
    chaosBaseUrl,
    hostname: host,
    canonicalVercelProjectSlug: expectedSlug,
    retiredVercelProject: retired ? 'cheers-portal-4oxv' : '',
    hostAppearsCanonical: canonical,
    productionHost: production,
    deployedVersion,
    expectedVersion,
    sourceVersion,
  };
}

module.exports = {
  CANONICAL_VERCEL_PROJECT_SLUG,
  RETIRED_VERCEL_PROJECT_SLUGS,
  PRODUCTION_HOST,
  TARGET_ENV_KEYS,
  parseEnvText,
  readEnvFile,
  normalizeUrlForCompare,
  hostOf,
  isProductionHost,
  isRetiredVercelHost,
  isCanonicalVercelPreviewHost,
  inspectReleaseTargetEnvConflicts,
  validateReleaseTarget,
};
