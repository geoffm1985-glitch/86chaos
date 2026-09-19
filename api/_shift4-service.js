'use strict';

const crypto = require('crypto');
const { Shift4Client, Shift4Error } = require('./_shift4-client');
const { tokenBundleFromOAuth } = require('./_shift4-crypto');
const { allocateConnectionAttempt, readCredential, refreshCredentialTokens, updateCredentialMetadata } = require('./_shift4-storage');

const STATE_TTL_MS = 10 * 60 * 1000;
const OAUTH_COOKIE = '__Host-chaos_shift4_handoff';
const TICKET_RETRIEVAL_CONTRACT = Object.freeze({
  endpoint: 'GET /pos/v2/{locationId}/tickets', filterEncoding: 'filter[dateTimeFrom], filter[dateTimeTo]', historicalOnly: true,
  paginationVerified: false, boundarySemanticsVerified: false, filterTimestampVerified: false,
  reason: 'Shift4 documents the date filters and historical-only scope, but not endpoint-specific offset/limit support, a completion signal, boundary inclusivity, or which ticket timestamp is filtered.'
});

function shift4Config(env = process.env) {
  return { clientId: String(env.SHIFT4_CLIENT_ID || '').trim(), clientSecret: String(env.SHIFT4_CLIENT_SECRET || '').trim(), redirectUri: String(env.SHIFT4_OAUTH_REDIRECT_URI || '').trim(), appReturnUri: String(env.SHIFT4_APP_RETURN_URI || '').trim(), dineLocationIds: new Set(String(env.SHIFT4_DINE_ALLOWED_LOCATION_IDS || '').split(/[\s,;]+/).map(value => value.trim()).filter(Boolean)) };
}
function requireOAuthConfig(env = process.env) {
  const config = shift4Config(env);
  if (!config.clientId || !config.clientSecret || !config.redirectUri || !env.SHIFT4_TOKEN_ENCRYPTION_KEY) throw Object.assign(new Error('Shift4 server configuration is incomplete.'), { code: 'configuration_incomplete', statusCode: 503 });
  if (new URL(config.redirectUri).protocol !== 'https:') throw Object.assign(new Error('Shift4 OAuth callback must use HTTPS.'), { code: 'configuration_incomplete', statusCode: 503 });
  return config;
}
const stateHash = state => crypto.createHash('sha256').update(String(state || '')).digest('hex');
const secretHash = secret => crypto.createHash('sha256').update(String(secret || '')).digest('hex');
const projectIdFor = app => String(app?.options?.projectId || '').trim();

function serializeHandoffCookie({ secret, projectId }) { return Buffer.from(JSON.stringify({ v: 1, secret, projectId }), 'utf8').toString('base64url'); }
function parseCookies(req) {
  return Object.fromEntries(String(req?.headers?.cookie || '').split(';').map(part => part.trim()).filter(Boolean).map(part => { const index = part.indexOf('='); return index < 0 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))]; }));
}
function readHandoffCookie(req) {
  try {
    const parsed = JSON.parse(Buffer.from(parseCookies(req)[OAUTH_COOKIE] || '', 'base64url').toString('utf8'));
    if (parsed?.v !== 1 || String(parsed.secret || '').length < 32 || !String(parsed.projectId || '').trim()) throw new Error('invalid');
    return { secret: String(parsed.secret), projectId: String(parsed.projectId) };
  } catch (_) { throw Object.assign(new Error('Return to the initiating browser and restart Shift4 authorization.'), { code: 'browser_handoff_mismatch', statusCode: 400 }); }
}
function setHandoffCookie(res, handoff) { res.setHeader('Set-Cookie', `${OAUTH_COOKIE}=${encodeURIComponent(serializeHandoffCookie(handoff))}; Path=/; Max-Age=${Math.floor(STATE_TTL_MS / 1000)}; HttpOnly; Secure; SameSite=Lax`); }
function clearHandoffCookie(res) { res.setHeader('Set-Cookie', `${OAUTH_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`); }

async function createOAuthState(db, { uid, restaurantId, callbackUri, projectId, nowMs = Date.now() }) {
  const state = crypto.randomBytes(32).toString('base64url'); const browserSecret = crypto.randomBytes(32).toString('base64url'); const digest = stateHash(state);
  const generation = await allocateConnectionAttempt(db, restaurantId, digest, new Date(nowMs).toISOString());
  await db.collection('shift4OauthStates').doc(digest).set({ uid: String(uid), restaurantId: String(restaurantId), callbackUri: String(callbackUri), projectId: String(projectId || ''), browserSecretHash: secretHash(browserSecret), connectionGeneration: generation, createdAt: new Date(nowMs).toISOString(), expiresAtMs: nowMs + STATE_TTL_MS, usedAt: null });
  return { state, browserSecret, connectionGeneration: generation };
}
async function consumeOAuthState(db, state, { callbackUri, browserSecret, projectId, expectedUid = '', expectedRestaurantId = '', nowMs = Date.now() } = {}) {
  if (!state || String(state).length < 32) throw Object.assign(new Error('Shift4 authorization state is invalid.'), { code: 'invalid_state', statusCode: 400 });
  const ref = db.collection('shift4OauthStates').doc(stateHash(state)); let resolved;
  await db.runTransaction(async transaction => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw Object.assign(new Error('Shift4 authorization state is invalid.'), { code: 'invalid_state', statusCode: 400 });
    const data = snap.data() || {};
    if (data.usedAt) throw Object.assign(new Error('Shift4 authorization state was already used.'), { code: 'state_replayed', statusCode: 400 });
    if (Number(data.expiresAtMs || 0) <= nowMs) throw Object.assign(new Error('Shift4 authorization state expired. Start the connection again.'), { code: 'expired_state', statusCode: 400 });
    if (String(data.callbackUri || '') !== String(callbackUri || '')) throw Object.assign(new Error('Shift4 authorization callback did not match.'), { code: 'callback_mismatch', statusCode: 400 });
    const expectedSecret = Buffer.from(String(data.browserSecretHash || ''), 'utf8'); const actualSecret = Buffer.from(secretHash(browserSecret || ''), 'utf8');
    if (expectedSecret.length !== actualSecret.length || !crypto.timingSafeEqual(expectedSecret, actualSecret)) throw Object.assign(new Error('Shift4 authorization must finish in the initiating browser.'), { code: 'browser_handoff_mismatch', statusCode: 403 });
    if (!projectId || String(data.projectId || '') !== String(projectId)) throw Object.assign(new Error('Firebase project identity changed during Shift4 authorization.'), { code: 'project_mismatch', statusCode: 403 });
    if (expectedUid && String(data.uid) !== String(expectedUid)) throw Object.assign(new Error('Shift4 authorization user did not match.'), { code: 'user_mismatch', statusCode: 403 });
    if (expectedRestaurantId && String(data.restaurantId) !== String(expectedRestaurantId)) throw Object.assign(new Error('Shift4 authorization workspace did not match.'), { code: 'restaurant_mismatch', statusCode: 403 });
    transaction.update(ref, { usedAt: new Date(nowMs).toISOString() }); resolved = data;
  });
  return resolved;
}

function validateTimeZone(value) {
  const timeZone = String(value || '').trim();
  if (!timeZone) throw Object.assign(new Error('Shift4 location timezone is missing.'), { code: 'invalid_location_timezone', statusCode: 409 });
  try { new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date(0)); } catch (_) { throw Object.assign(new Error('Shift4 location timezone is invalid.'), { code: 'invalid_location_timezone', statusCode: 409 }); }
  return timeZone;
}
function locationSupport(entry, config = shift4Config()) {
  const location = entry?.location || entry || {}; const id = String(location.id ?? '');
  if (entry?.isAvailable === false) return { status: 'unsupported', reason: String(entry.reason || 'Shift4 reports this location is unavailable.') };
  if (config.dineLocationIds.has(id)) return { status: 'supported', reason: 'Shift4 Dine eligibility confirmed by server allowlist.' };
  return { status: 'unverified', reason: 'Shift4 does not identify the POS product in its normal location response. Add only a separately verified Shift4 Dine location ID to SHIFT4_DINE_ALLOWED_LOCATION_IDS.' };
}
function safeLocation(entry, config = shift4Config()) {
  const location = entry?.location || entry || {}; const support = locationSupport(entry, config); let timeZone = String(location.timeZone || '').trim(); let timeZoneStatus = 'valid';
  try { timeZone = validateTimeZone(timeZone); } catch (_) { timeZoneStatus = 'invalid'; }
  return { id: location.id == null ? null : String(location.id), name: String(location.name || 'Unnamed location'), timeZone, timeZoneStatus, countryCode: String(location.countryCode || ''), currency: String(location.currency || ''), brandRef: String(location.brandRef || ''), isAvailable: entry?.isAvailable !== false, availabilityReason: String(entry?.reason || ''), supportStatus: timeZoneStatus === 'valid' ? support.status : 'unsupported', supportReason: timeZoneStatus === 'valid' ? support.reason : 'Shift4 returned a missing or invalid IANA timezone for this location.' };
}

const providerRefreshFailure = error => ['authorization_expired', 'permission_insufficient'].includes(String(error?.code || ''));
async function freshCredential(db, restaurantId, options = {}) {
  const stored = await readCredential(db, restaurantId, options.cryptoOptions || {});
  if (!stored) throw Object.assign(new Error('Shift4 is not connected for this workspace.'), { code: 'not_connected', statusCode: 409 });
  let tokenBundle = stored.tokenBundle; const expiresAt = Date.parse(tokenBundle.accessExpiresAt || '');
  if (!Number.isFinite(expiresAt)) throw Object.assign(new Error('Stored Shift4 access-token expiration is invalid.'), { code: 'credential_decryption_failed', statusCode: 500 });
  if (expiresAt <= Date.now() + 5 * 60 * 1000) {
    const config = requireOAuthConfig(options.env || process.env); const client = options.client || new Shift4Client(options.clientOptions); let payload;
    try { payload = await client.refreshToken({ refreshToken: tokenBundle.refreshToken, clientId: config.clientId, clientSecret: config.clientSecret }); }
    catch (error) {
      if (providerRefreshFailure(error)) {
        try { await updateCredentialMetadata(db, restaurantId, { connectionStatus: 'authorization_required', refreshFailureAt: new Date().toISOString() }, { expectedGeneration: stored.data.connectionGeneration }); } catch (_) {}
        throw Object.assign(new Error('Shift4 rejected the refresh token. Reconnect Shift4.'), { code: 'refresh_rejected', statusCode: 401, cause: error });
      }
      throw error;
    }
    tokenBundle = tokenBundleFromOAuth(payload, Date.now(), { priorBundle: tokenBundle, refresh: true });
    const refreshed = await refreshCredentialTokens(db, restaurantId, stored, tokenBundle, { cryptoOptions: options.cryptoOptions || {} });
    return { stored: refreshed, tokenBundle };
  }
  return { stored, tokenBundle };
}

function publicError(error) {
  const code = String(error?.code || (error instanceof Shift4Error ? error.code : '') || 'unknown_error');
  const allowed = new Set(['configuration_incomplete','invalid_state','expired_state','state_replayed','callback_mismatch','browser_handoff_mismatch','project_mismatch','superseded_state','user_mismatch','restaurant_mismatch','account_inactive','membership_revoked','authorization_expired','refresh_rejected','credential_decryption_failed','credential_encryption_failed','credential_save_failed','credential_superseded','permission_insufficient','shift4_unavailable','rate_limited','timeout','network_error','malformed_response','unsupported_pos','unverified_pos','invalid_location_timezone','invalid_range','invalid_cursor','not_connected','api_contract_unverified','export_incomplete']);
  const safeCode = allowed.has(code) ? code : 'unknown_error';
  const messages = { configuration_incomplete: 'Shift4 server configuration is incomplete.', invalid_state: 'Shift4 authorization could not be verified.', expired_state: 'Shift4 authorization expired. Start again.', state_replayed: 'This Shift4 authorization was already used.', callback_mismatch: 'Shift4 callback validation failed.', browser_handoff_mismatch: 'Finish Shift4 authorization in the browser that started it, or restart the connection.', project_mismatch: 'Shift4 authorization did not return to the initiating Firebase project.', superseded_state: 'A newer Shift4 connection attempt replaced this one. Start again if needed.', user_mismatch: 'Shift4 authorization user did not match.', restaurant_mismatch: 'Shift4 authorization workspace did not match.', account_inactive: 'The initiating account is inactive or disabled.', membership_revoked: 'Workspace membership is inactive or revoked.', authorization_expired: 'Shift4 authorization is required.', refresh_rejected: 'Shift4 rejected the refresh token. Reconnect Shift4.', credential_decryption_failed: 'Stored Shift4 credentials could not be decrypted.', credential_encryption_failed: 'Shift4 credentials could not be encrypted.', credential_save_failed: 'Refreshed Shift4 credentials could not be saved.', credential_superseded: 'A newer Shift4 connection replaced this operation.', permission_insufficient: 'Shift4 did not grant the required read permission.', shift4_unavailable: 'Shift4 is temporarily unavailable.', rate_limited: 'Shift4 rate limited this request.', timeout: 'Shift4 did not respond before the safe timeout.', network_error: 'Shift4 could not be reached.', malformed_response: 'Shift4 returned data that 86 Chaos could not safely read.', unsupported_pos: 'This location is not supported by the Shift4 Dine connector.', unverified_pos: 'Shift4 Dine eligibility has not been verified for this location.', invalid_location_timezone: 'The Shift4 location timezone is missing or invalid.', invalid_range: 'Choose a real calendar date range of seven days or fewer.', invalid_cursor: 'The review cursor is invalid.', not_connected: 'Shift4 is not connected for this workspace.', api_contract_unverified: 'Shift4 ticket retrieval completeness cannot yet be proven from the published endpoint contract.', export_incomplete: 'The requested export could not be proven complete.', unknown_error: 'The Shift4 request failed safely.' };
  return { code: safeCode, message: messages[safeCode], retryAfterSeconds: error?.retryAfterMs ? Math.ceil(error.retryAfterMs / 1000) : undefined };
}

function parseDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '')); if (!match) return null;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]); const ms = Date.UTC(year, month - 1, day); const date = new Date(ms);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? { year, month, day, ms, key: match[0] } : null;
}
function zonedDateKey(now, timeZone) {
  validateTimeZone(timeZone); const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now instanceof Date ? now : new Date(now)); const map = Object.fromEntries(parts.map(part => [part.type, part.value])); return `${map.year}-${map.month}-${map.day}`;
}
function previousDateKey(now, timeZone) { const today = parseDateKey(zonedDateKey(now, timeZone)); return new Date(today.ms - 86400000).toISOString().slice(0, 10); }
function localDateRangeToUtc(from, to, timeZone) {
  const start = parseDateKey(from); const end = parseDateKey(to); validateTimeZone(timeZone);
  if (!start || !end || start.ms > end.ms || ((end.ms - start.ms) / 86400000) + 1 > 7) throw Object.assign(new Error('Invalid Shift4 date range.'), { code: 'invalid_range', statusCode: 400 });
  const localToUtc = date => { const base = date.ms; let guess = base; for (let i = 0; i < 5; i += 1) { const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess)); const map = Object.fromEntries(parts.map(part => [part.type, part.value])); const represented = Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), Number(map.hour), Number(map.minute), Number(map.second)); guess -= represented - base; } return guess; };
  const next = parseDateKey(new Date(end.ms + 86400000).toISOString().slice(0, 10));
  return { from: new Date(localToUtc(start)).toISOString(), to: new Date(localToUtc(next) - 1).toISOString(), requestedFrom: start.key, requestedTo: end.key, timeZone, boundaryConvention: 'inclusive local calendar dates converted to an inclusive UTC millisecond range; provider filter inclusivity remains unverified' };
}

module.exports = { STATE_TTL_MS, OAUTH_COOKIE, TICKET_RETRIEVAL_CONTRACT, shift4Config, requireOAuthConfig, stateHash, secretHash, projectIdFor, serializeHandoffCookie, readHandoffCookie, setHandoffCookie, clearHandoffCookie, createOAuthState, consumeOAuthState, validateTimeZone, locationSupport, safeLocation, freshCredential, publicError, parseDateKey, zonedDateKey, previousDateKey, localDateRangeToUtc };
