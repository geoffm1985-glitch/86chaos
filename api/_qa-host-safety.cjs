'use strict';

const CANONICAL_TESTING_HOST = 'testing.86chaos.com';
const PRODUCTION_86CHAOS_HOSTS = new Set(['86chaos.com', 'www.86chaos.com', 'app.86chaos.com']);

function normalizeRequestHost(value = '') {
  const raw = String(value || '').split(',')[0].trim().toLowerCase();
  if (!raw) return '';
  try {
    if (/^https?:\/\//i.test(raw)) return new URL(raw).hostname.toLowerCase().replace(/\.+$/, '');
  } catch (_) {}
  return raw.replace(/:\d+$/, '').replace(/\.+$/, '');
}

function isProductionQaHost(host = '') {
  const cleanHost = normalizeRequestHost(host);
  if (!cleanHost || cleanHost === CANONICAL_TESTING_HOST) return false;
  return PRODUCTION_86CHAOS_HOSTS.has(cleanHost) || /(^|\.)86chaos\.com$/i.test(cleanHost);
}

module.exports = {
  CANONICAL_TESTING_HOST,
  PRODUCTION_86CHAOS_HOSTS,
  normalizeRequestHost,
  isProductionQaHost,
};
