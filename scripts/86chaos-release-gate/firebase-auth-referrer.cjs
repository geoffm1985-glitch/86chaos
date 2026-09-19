'use strict';

const CANONICAL_FIREBASE_AUTH_REFERRER_URL = 'https://86chaos-git-testing-cheers-portal-s-projects.vercel.app';
const PRODUCTION_FIREBASE_PROJECT = 'cheers-34b8d';
const TEST_FIREBASE_PROJECT = 'chaos-test-d1601';

function normalizeOrigin(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) return '';
    if (url.pathname && url.pathname !== '/') return '';
    return url.origin;
  } catch (_) {
    return '';
  }
}

function firebaseAuthReferrerUrl(env = process.env) {
  return normalizeOrigin(env.CHAOS_FIREBASE_AUTH_REFERRER_URL || '');
}

function validateFirebaseAuthReferrer(options = {}) {
  const env = options.env || process.env;
  const raw = String(env.CHAOS_FIREBASE_AUTH_REFERRER_URL || '').trim();
  const referrerUrl = normalizeOrigin(raw);
  const firebaseProjectId = String(options.firebaseProjectId || env.REACT_APP_FIREBASE_PROJECT_ID || env.REACT_APP_TEST_FIREBASE_PROJECT_ID || '').trim();
  const errors = [];
  if (!raw) errors.push('CHAOS_FIREBASE_AUTH_REFERRER_URL is required for release-gate Firebase Auth REST requests.');
  else if (!referrerUrl) errors.push('CHAOS_FIREBASE_AUTH_REFERRER_URL must be an HTTPS origin with no credentials, port, path, query, or fragment.');
  else if (referrerUrl !== CANONICAL_FIREBASE_AUTH_REFERRER_URL) errors.push(`CHAOS_FIREBASE_AUTH_REFERRER_URL must equal the approved testing alias ${CANONICAL_FIREBASE_AUTH_REFERRER_URL}. Wildcards and immutable deployment hosts are not allowed.`);
  if (firebaseProjectId === PRODUCTION_FIREBASE_PROJECT) errors.push(`Firebase Auth release-gate requests refuse the production project ${PRODUCTION_FIREBASE_PROJECT}.`);
  if (firebaseProjectId && firebaseProjectId !== TEST_FIREBASE_PROJECT) errors.push(`Firebase Auth release-gate requests require ${TEST_FIREBASE_PROJECT}; received ${firebaseProjectId}.`);
  return { ok: errors.length === 0, errors, referrerUrl, firebaseProjectId };
}

function buildFirebaseAuthReferrerHeaders(extraHeaders = {}, options = {}) {
  const safeHeaders = {};
  for (const [name, value] of Object.entries(extraHeaders || {})) {
    const lower = String(name || '').toLowerCase();
    if (lower === 'origin' || lower === 'referer' || lower === 'referrer') continue;
    safeHeaders[name] = value;
  }
  const referrerUrl = options.referrerUrl || firebaseAuthReferrerUrl(options.env || process.env);
  if (!referrerUrl) throw new Error('CHAOS_FIREBASE_AUTH_REFERRER_URL is missing or invalid; refusing to send Firebase Auth REST credentials without the approved referrer.');
  safeHeaders.Origin = referrerUrl;
  safeHeaders.Referer = `${referrerUrl}/`;
  return safeHeaders;
}

module.exports = {
  CANONICAL_FIREBASE_AUTH_REFERRER_URL,
  PRODUCTION_FIREBASE_PROJECT,
  TEST_FIREBASE_PROJECT,
  normalizeOrigin,
  firebaseAuthReferrerUrl,
  validateFirebaseAuthReferrer,
  buildFirebaseAuthReferrerHeaders,
};
