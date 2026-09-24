'use strict';

const BRIDGE_VERSION = '1.0';
const APP_RELEASE = '17.0.34';
const SUPPORTED_CONTRACT_VERSIONS = Object.freeze(['1.0']);
const SERVER_CAPABILITIES = Object.freeze(['event.staging', 'receipt.read', 'reconciliation.read']);
const LIMITS = Object.freeze({
  maxBatchEvents: 20, maxRequestBytes: 256 * 1024, maxEventBytes: 32 * 1024,
  maxOrderItems: 100, maxObjectDepth: 8, maxIdentifierLength: 128,
  sequenceWindowSize: 256, maxBatchSequenceSpan: 256, maxAheadOfContiguous: 4096,
  defaultPageSize: 50, maxPageSize: 200, maxManifestEntries: 200,
  assertionLifetimeSeconds: 60, assertionClockToleranceSeconds: 30, accessTokenLifetimeSeconds: 300,
  tokenExchangesPerMinute: 12, eventRequestsPerMinute: 120, eventsPerMinute: 1000, readsPerMinute: 60,
  recommendedConcurrentSenders: 2
});

function bridgeEnvironment(env = process.env) {
  const value = String(env.POS_BRIDGE_ENVIRONMENT || env.FIREBASE_DEPLOYMENT_MODE || env.VERCEL_ENV || '').trim().toLowerCase();
  if (['production', 'prod'].includes(value)) return 'production';
  if (['testing', 'test', 'preview', 'staging', 'development', 'dev'].includes(value)) return value === 'prod' ? 'production' : value;
  return 'disabled';
}
function bridgeEnabled(env = process.env) {
  return ['1', 'true', 'yes', 'enabled'].includes(String(env.POS_BRIDGE_ENABLED || '').trim().toLowerCase()) && bridgeEnvironment(env) !== 'disabled';
}
function config(env = process.env) {
  const environment = bridgeEnvironment(env);
  const issuer = String(env.POS_BRIDGE_TOKEN_ISSUER || '').trim();
  const audience = String(env.POS_BRIDGE_TOKEN_AUDIENCE || '').trim();
  const tokenEndpointAudience = String(env.POS_BRIDGE_ASSERTION_AUDIENCE || '').trim();
  const keyId = String(env.POS_BRIDGE_SIGNING_KEY_ID || '').trim();
  const privateJwkRaw = String(env.POS_BRIDGE_SIGNING_PRIVATE_JWK || '').trim();
  if (!bridgeEnabled(env)) return { enabled: false, environment };
  if (!issuer || !audience || !tokenEndpointAudience || !keyId || !privateJwkRaw) {
    throw Object.assign(new Error('POS Bridge signing configuration is incomplete.'), { code: 'bridge_configuration_invalid', statusCode: 503 });
  }
  let privateJwk;
  try { privateJwk = JSON.parse(privateJwkRaw); } catch (_) {
    throw Object.assign(new Error('POS Bridge signing configuration is malformed.'), { code: 'bridge_configuration_invalid', statusCode: 503 });
  }
  if (privateJwk.kty !== 'EC' || privateJwk.crv !== 'P-256' || !privateJwk.d || privateJwk.alg && privateJwk.alg !== 'ES256') {
    throw Object.assign(new Error('POS Bridge signing key must be an ES256 P-256 private JWK.'), { code: 'bridge_configuration_invalid', statusCode: 503 });
  }
  return { enabled: true, environment, issuer, audience, tokenEndpointAudience, keyId, privateJwk };
}

module.exports = { BRIDGE_VERSION, APP_RELEASE, SUPPORTED_CONTRACT_VERSIONS, SERVER_CAPABILITIES, LIMITS, bridgeEnvironment, bridgeEnabled, config };
