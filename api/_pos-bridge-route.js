'use strict';
const { LIMITS, SUPPORTED_CONTRACT_VERSIONS } = require('./_pos-bridge-config');

function json(res, status, payload, headers = {}) {
  res.status(status); res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, String(value));
  res.end(JSON.stringify(payload));
}
function publicError(error) {
  const known = new Set(['bridge_disabled','bridge_configuration_invalid','invalid_request','unsupported_contract','invalid_assertion','assertion_replayed','invalid_access_token','installation_inactive','authority_changed','rate_limited','forbidden','not_found','conflict','payload_too_large']);
  const code = known.has(error?.code) ? error.code : 'bridge_error';
  const status = Number(error?.statusCode || ({ bridge_disabled:503, bridge_configuration_invalid:503, invalid_request:400, unsupported_contract:426, invalid_assertion:401, assertion_replayed:401, invalid_access_token:401, installation_inactive:401, authority_changed:401, rate_limited:429, forbidden:403, not_found:404, conflict:409, payload_too_large:413 }[code]) || 500);
  const safeMessages = {
    bridge_disabled:'POS Bridge is disabled.', bridge_configuration_invalid:'POS Bridge is unavailable.', invalid_request:'The request is invalid.', unsupported_contract:'The requested POS Bridge contract is unsupported.', invalid_assertion:'The client assertion is invalid.', assertion_replayed:'The client assertion has already been used.', invalid_access_token:'The bridge access token is invalid.', installation_inactive:'The installation is not active.', authority_changed:'Installation authority has changed.', rate_limited:'Rate limit exceeded.', forbidden:'Access is forbidden.', not_found:'Resource not found.', conflict:'The request conflicts with durable bridge evidence.', payload_too_large:'The request is too large.', bridge_error:'POS Bridge request failed.'
  };
  return { status, body: { ok:false, code, error:safeMessages[code] } };
}
function rawBodyBytes(req) {
  if (Buffer.isBuffer(req.body)) return req.body.length;
  if (typeof req.body === 'string') return Buffer.byteLength(req.body, 'utf8');
  try { return Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8'); } catch (_) { return LIMITS.maxRequestBytes + 1; }
}
function readBoundedJson(req) {
  if (String(req.headers?.['content-encoding'] || 'identity').toLowerCase() !== 'identity') throw Object.assign(new Error('Compressed requests are not accepted.'), { code:'invalid_request', statusCode:415 });
  const declared = Number(req.headers?.['content-length'] || 0);
  if (declared > LIMITS.maxRequestBytes || rawBodyBytes(req) > LIMITS.maxRequestBytes) throw Object.assign(new Error('Request too large.'), { code:'payload_too_large', statusCode:413 });
  if (!req.body) return {};
  if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  try { return JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body); } catch (_) { throw Object.assign(new Error('Invalid JSON.'), { code:'invalid_request', statusCode:400 }); }
}
function requireContract(req) {
  const version = String(req.headers?.['x-pos-bridge-contract'] || req.body?.contractVersion || '').trim();
  if (!SUPPORTED_CONTRACT_VERSIONS.includes(version)) throw Object.assign(new Error('Unsupported contract.'), { code:'unsupported_contract', statusCode:426 });
  return version;
}
function method(req, allowed) { if (!allowed.includes(req.method)) throw Object.assign(new Error('Method not allowed.'), { code:'invalid_request', statusCode:405 }); }
const AUTHORITY_OVERRIDE_KEYS=new Set(['restaurantId','locationId','sourceNamespaceId','tenantId','projectId','firebaseProjectId','environment','securityEpoch','credentialVersion']);
function rejectMachineAuthorityOverrides(req){for(const source of [req.body||{},req.query||{}])for(const key of Object.keys(source))if(AUTHORITY_OVERRIDE_KEYS.has(key))throw Object.assign(new Error('Authority overrides are forbidden.'),{code:'forbidden',statusCode:403});}
function assertKeys(source,allowed){const set=new Set(allowed);if(Object.keys(source||{}).some(key=>!set.has(key)))throw Object.assign(new Error('Unexpected request property.'),{code:'invalid_request',statusCode:400});}
function handler(fn) { return async (req, res) => { try { await fn(req, res); } catch (error) { const out=publicError(error); json(res,out.status,out.body, error?.retryAfter ? {'Retry-After':error.retryAfter}:{}); } }; }

module.exports = { json, publicError, rawBodyBytes, readBoundedJson, requireContract, method, rejectMachineAuthorityOverrides, assertKeys, handler };
