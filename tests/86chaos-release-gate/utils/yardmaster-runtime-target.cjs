'use strict';
const { getFirebaseTarget } = require('../../../scripts/86chaos-firebase-target.cjs');
const LOOPBACK_RE = /^(localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)$/i;
function releaseBaseUrl(env = process.env) {
  return env.APP_URL || env.CHAOS_BASE_URL || env.BASE_URL || env.PLAYWRIGHT_BASE_URL || '';
}
function isManagedYardmasterEmulator(env = process.env, base = releaseBaseUrl(env)) {
  let url;
  try { url = new URL(base); } catch (_) { return false; }
  let target;
  try { target = getFirebaseTarget(env); } catch (_) { return false; }
  return target.emulator === true
    && target.projectId === 'demo-86chaos'
    && env.CHAOS_BLOCK_LIVE_FIREBASE === '1'
    && LOOPBACK_RE.test(url.hostname)
    && url.protocol === 'http:';
}
module.exports = { releaseBaseUrl, isManagedYardmasterEmulator };
