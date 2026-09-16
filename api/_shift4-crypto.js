'use strict';

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

function clean(value) { return String(value == null ? '' : value).trim(); }

function readRootKey(env = process.env) {
  const raw = clean(env.SHIFT4_TOKEN_ENCRYPTION_KEY);
  if (!raw) throw Object.assign(new Error('Shift4 token encryption is not configured.'), { code: 'configuration_incomplete' });
  let key;
  if (/^[a-f0-9]{64}$/i.test(raw)) key = Buffer.from(raw, 'hex');
  else {
    try { key = Buffer.from(raw, 'base64'); } catch (_) { key = Buffer.alloc(0); }
  }
  if (key.length !== 32) throw Object.assign(new Error('Shift4 token encryption key must decode to exactly 32 bytes.'), { code: 'configuration_incomplete' });
  return key;
}

function aadFor(restaurantId, keyVersion) {
  return Buffer.from(`86chaos|shift4|${clean(restaurantId)}|${clean(keyVersion)}`, 'utf8');
}

function encryptTokenBundle(bundle, restaurantId, options = {}) {
  const env = options.env || process.env;
  const key = options.key || readRootKey(env);
  const keyVersion = clean(options.keyVersion || env.SHIFT4_TOKEN_KEY_VERSION || 'v1');
  const iv = options.iv || crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(aadFor(restaurantId, keyVersion));
  const plaintext = Buffer.from(JSON.stringify(bundle || {}), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    algorithm: ALGORITHM,
    keyVersion,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64')
  };
}

function decryptTokenBundle(envelope, restaurantId, options = {}) {
  if (!envelope || envelope.algorithm !== ALGORITHM) throw Object.assign(new Error('Shift4 credential envelope is unavailable or unsupported.'), { code: 'authorization_expired' });
  const key = options.key || readRootKey(options.env || process.env);
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(envelope.iv, 'base64'));
    decipher.setAAD(aadFor(restaurantId, envelope.keyVersion));
    decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8'));
  } catch (_) {
    throw Object.assign(new Error('Shift4 credentials could not be decrypted with the configured key version.'), { code: 'authorization_expired' });
  }
}

function tokenBundleFromOAuth(payload, nowMs = Date.now(), options = {}) {
  const prior = options.priorBundle || {};
  const accessToken = typeof payload?.access_token === 'string' ? payload.access_token.trim() : '';
  const refreshToken = typeof payload?.refresh_token === 'string' && payload.refresh_token.trim() ? payload.refresh_token.trim() : (options.refresh ? String(prior.refreshToken || '') : '');
  if (!payload || !accessToken || !refreshToken) {
    throw Object.assign(new Error('Shift4 returned incomplete authorization credentials.'), { code: 'token_exchange_failed' });
  }
  let expiresIn = 86400;
  if (payload.expires_in != null) {
    if (typeof payload.expires_in !== 'number' || !Number.isFinite(payload.expires_in) || !Number.isSafeInteger(payload.expires_in) || payload.expires_in < 60 || payload.expires_in > 172800) {
      throw Object.assign(new Error('Shift4 returned an invalid access-token expiration.'), { code: 'token_exchange_failed' });
    }
    expiresIn = payload.expires_in;
  }
  let refreshExpiresAt = prior.refreshExpiresAt || null;
  if (payload.expiration != null) {
    if (typeof payload.expiration !== 'number' || !Number.isFinite(payload.expiration) || !Number.isSafeInteger(payload.expiration) || payload.expiration <= Math.floor(nowMs / 1000) || payload.expiration > 253402300799) {
      throw Object.assign(new Error('Shift4 returned an invalid refresh-token expiration.'), { code: 'token_exchange_failed' });
    }
    refreshExpiresAt = new Date(payload.expiration * 1000).toISOString();
  }
  return {
    accessToken,
    refreshToken,
    tokenType: String(payload.token_type || 'Bearer'),
    permissions: Array.isArray(payload.permissions) ? payload.permissions.filter(value => typeof value === 'string').map(value => value.slice(0, 160)) : (Array.isArray(prior.permissions) ? prior.permissions : []),
    accessExpiresAt: new Date(nowMs + expiresIn * 1000).toISOString(),
    refreshExpiresAt
  };
}

module.exports = { ALGORITHM, readRootKey, encryptTokenBundle, decryptTokenBundle, tokenBundleFromOAuth };
