const crypto = require('crypto');

const MEBIBYTE = 1024 * 1024;

// Explicitly reviewed identifiers, verified against official OpenAI documentation
// on 2026-09-08. Unknown aliases/snapshots are denied, never compared numerically.
const OPENAI_CUSTOMER_MODELS = Object.freeze(['gpt-5-mini', 'gpt-5.5', 'gpt-5.5-2026-04-23']);
const INTERNAL_DIAGNOSTIC_MODELS = Object.freeze(['gpt-5-mini']);
const AI_ROUTES = Object.freeze({
  invoice: '/api/scan-invoice', menu: '/api/scan-menu', recipe: '/api/scan',
  voice: '/api/voice-command', help: '/api/help-assistant', manual: '/api/gemini-admin-manual',
  diagnostics: '/api/openai-diagnostics-explain', research: '/api/free-ai-services',
  order: '/api/python-order-intelligence', insights: '/api/python-ops-intelligence'
});

const GEMINI_MODEL_ALLOWLIST = Object.freeze([
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
]);

const AI_HARD_LIMITS = Object.freeze({
  invoice: Object.freeze({
    maxBytes: 20 * MEBIBYTE,
    maxPagesPerRequest: 40,
    maxImagePixels: 20_000_000,
    maxImageEdge: 6000,
    maxProviderCalls: 2,
    maxOutputTokens: 32768,
    compactMaxOutputTokens: 16384,
    repairMaxOutputTokens: 8192,
    maxRequestsPerMinute: 8
  }),
  menu: Object.freeze({
    maxBytes: 20 * MEBIBYTE,
    maxPagesPerRequest: 10,
    maxImagePixels: 20_000_000,
    maxImageEdge: 6000,
    maxProviderCalls: 1,
    maxOutputTokens: 8192,
    maxRequestsPerMinute: 6
  }),
  recipe: Object.freeze({
    maxBytes: 3 * MEBIBYTE,
    maxPagesPerRequest: 1,
    maxImagePixels: 12_000_000,
    maxImageEdge: 5000,
    maxProviderCalls: 1,
    maxOutputTokens: 2048,
    maxRequestsPerMinute: 4
  }),
  voice: Object.freeze({
    maxInputCharacters: 1200,
    maxProviderCalls: 1,
    maxOutputTokens: 512,
    maxRequestsPerMinute: 12
  }),
  manual: Object.freeze({
    maxProviderCalls: 3,
    maxOutputTokens: 8192,
    maxRequestsPerMinute: 4
  }),
  help: Object.freeze({ maxInputCharacters: 1200, maxProviderCalls: 1, maxOutputTokens: 650, maxRequestsPerMinute: 12 }),
  diagnostics: Object.freeze({ maxInputCharacters: 120000, maxProviderCalls: 1, maxOutputTokens: 5000, maxRequestsPerMinute: 8 }),
  research: Object.freeze({ maxInputCharacters: 160, maxProviderCalls: 1, maxOutputTokens: 1200, maxRequestsPerMinute: 4 }),
  order: Object.freeze({ maxProviderCalls: 1, maxOutputTokens: 2048, maxRequestsPerMinute: 4 }),
  insights: Object.freeze({ maxProviderCalls: 1, maxOutputTokens: 2048, maxRequestsPerMinute: 4 })
});

function normalizeProvider(provider = '') {
  if (provider === 'google_gemini') return 'gemini';
  if (provider === 'openai' || provider === 'gemini') return provider;
  throw policyError('AI provider is not allowlisted.', 'AI_PROVIDER_NOT_ALLOWED');
}

function assertApprovedModel(provider, model, internal = false) {
  const selectedProvider = normalizeProvider(provider);
  const selectedModel = selectedProvider === 'gemini' ? normalizeGeminiModel(model) : clean(model);
  const allowlist = selectedProvider === 'gemini' ? GEMINI_MODEL_ALLOWLIST
    : internal ? INTERNAL_DIAGNOSTIC_MODELS : OPENAI_CUSTOMER_MODELS;
  if (!allowlist.includes(selectedModel)) throw policyError('AI model is not permitted by the server policy.', 'AI_MODEL_NOT_ALLOWED', 403);
  return selectedModel;
}

function resolveAiPolicy({ feature, route, authority = null, provider = 'openai', env = process.env } = {}) {
  const limits = getFeaturePolicy(feature);
  if (AI_ROUTES[feature] !== route) throw policyError('AI workflow route is not registered.', 'AI_ROUTE_NOT_ALLOWED', 403);
  const internal = feature === 'diagnostics' && route === AI_ROUTES.diagnostics;
  // authority must come from the route's existing authorize() result, never a body.
  if (internal && !(authority?.ok === true && authority?.isSuperAdmin === true && authority?.decoded?.uid)) {
    throw policyError('Internal diagnostic authorization is required.', 'AI_INTERNAL_ONLY', 403);
  }
  const chosenProvider = normalizeProvider(provider);
  const configured = internal ? env.OPENAI_DIAGNOSTICS_MODEL
    : chosenProvider === 'openai' ? env[`${feature.toUpperCase()}_OPENAI_MODEL`] || env.CUSTOMER_OPENAI_MODEL
      : env[`${feature.toUpperCase()}_GEMINI_MODEL`];
  const model = assertApprovedModel(chosenProvider, configured || (chosenProvider === 'openai' ? 'gpt-5-mini' : 'gemini-2.5-flash-lite'), internal);
  return Object.freeze({ feature, route, provider: chosenProvider, model, actorType: internal ? 'internal-diagnostic' : 'customer',
    reasoningEffort: 'low', serviceTier: 'default', ...limits,
    fallbackAllowed: !internal && ['invoice', 'menu'].includes(feature) && env.AI_SCANNER_GEMINI_FALLBACK === 'true' });
}

function enforceClientAiSelection(req, contract, actor = {}, logger = console.warn) {
  let body = req?.body && typeof req.body === 'object' ? req.body : {};
  if (typeof req?.body === 'string') { try { body = JSON.parse(req.body) || {}; } catch (_) {} }
  const query = req?.query || {};
  const selections = [
    [contract.model, [body.model, body.requestedModel, body.aiModel, body.ai?.model, body.options?.model, query.model, req?.headers?.['x-ai-model'], req?.headers?.['x-openai-model']]],
    [contract.provider, [body.provider, query.provider, req?.headers?.['x-ai-provider']]],
    [contract.reasoningEffort, [body.reasoning_effort, body.reasoning?.effort, query.reasoning_effort]],
    [contract.serviceTier, [body.service_tier, query.service_tier]]
  ];
  const rejected = selections.flatMap(([approved, values]) => values.filter(value => value != null && value !== '' && value !== approved)).at(0);
  if (rejected === undefined) return contract;
  const safeModel = typeof rejected === 'string' && /^(?:gpt-|gemini-|o[1-9]|astra$|sol$)[a-z0-9.\/-]{0,65}$/i.test(rejected) ? rejected : '[unapproved selection]';
  logger(JSON.stringify({ code: 'AI_CLIENT_OVERRIDE_BLOCKED', feature: contract.feature, route: contract.route,
    workspaceId: clean(actor.restaurantId).slice(0, 100), uid: clean(actor.uid).slice(0, 100),
    requestedModel: safeModel, approvedReplacement: contract.model, timestamp: new Date().toISOString() }));
  throw policyError('AI models and limits are selected by 86 Chaos. This selection is not permitted.', 'AI_CLIENT_OVERRIDE_BLOCKED', 400);
}

function clean(value = '') {
  return String(value == null ? '' : value).trim();
}

function normalizeGeminiModel(value = '') {
  return clean(value).replace(/^models\//i, '');
}

function policyError(message, code = 'AI_POLICY_REJECTED', statusCode = 500) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function getFeaturePolicy(feature) {
  const key = clean(feature).toLowerCase();
  const policy = AI_HARD_LIMITS[key];
  if (!policy) throw policyError(`No hard AI policy exists for ${key || 'this feature'}.`, 'AI_POLICY_MISSING');
  return policy;
}

function clampInteger(value, fallback, { min = 1, max } = {}) {
  const parsed = Number.parseInt(value, 10);
  const safeFallback = Number.parseInt(fallback, 10);
  const chosen = Number.isFinite(parsed) && parsed >= min ? parsed : safeFallback;
  return Math.max(min, Math.min(Number(max), chosen));
}

function getHardOutputTokenLimit(feature, configuredValue, mode = 'primary') {
  const policy = getFeaturePolicy(feature);
  const hardMax = mode === 'compact'
    ? policy.compactMaxOutputTokens
    : mode === 'repair'
      ? policy.repairMaxOutputTokens
      : policy.maxOutputTokens;
  if (!hardMax) throw policyError(`No ${mode} output-token policy exists for ${feature}.`, 'AI_OUTPUT_POLICY_MISSING');
  return clampInteger(configuredValue, hardMax, { min: 128, max: hardMax });
}

function getHardInputByteLimit(feature, configuredValue) {
  const policy = getFeaturePolicy(feature);
  return clampInteger(configuredValue, policy.maxBytes, { min: 1024, max: policy.maxBytes });
}

function getHardRateLimit(feature, configuredValue) {
  const policy = getFeaturePolicy(feature);
  return clampInteger(configuredValue, policy.maxRequestsPerMinute, { min: 1, max: policy.maxRequestsPerMinute });
}

function getAllowedGeminiModels({ feature, configured = '', defaults = ['gemini-2.5-flash-lite'] } = {}) {
  getFeaturePolicy(feature);
  const configuredModels = clean(configured)
    .split(/[\s,;]+/)
    .map(normalizeGeminiModel)
    .filter(Boolean);
  const rejected = configuredModels.filter(model => !GEMINI_MODEL_ALLOWLIST.includes(model));
  if (rejected.length) {
    throw policyError(
      `The configured ${feature} model is not permitted by the hard cost policy: ${rejected.join(', ')}.`,
      'AI_MODEL_NOT_ALLOWED'
    );
  }
  const candidates = [...configuredModels, ...(defaults || []).map(normalizeGeminiModel)]
    .filter(model => GEMINI_MODEL_ALLOWLIST.includes(model));
  const unique = [...new Set(candidates)];
  if (!unique.length) throw policyError(`No allowlisted Gemini model is configured for ${feature}.`, 'AI_MODEL_NOT_ALLOWED');
  return unique;
}

function createProviderCallBudget(feature) {
  const policy = getFeaturePolicy(feature);
  let used = 0;
  const attempts = [];
  return {
    consume({ provider = 'gemini', model = '', attempt = 'generation', internal = false } = {}) {
      const approvedModel = assertApprovedModel(provider, model, internal && feature === 'diagnostics');
      if (used >= policy.maxProviderCalls) {
        throw policyError(
          `${feature} reached its hard ${policy.maxProviderCalls}-call AI budget. No additional model call was made.`,
          'AI_PROVIDER_CALL_LIMIT',
          502
        );
      }
      used += 1;
      attempts.push({ number: used, provider: normalizeProvider(provider), model: approvedModel, attempt: clean(attempt).slice(0, 60) || 'generation' });
      return used;
    },
    recordUsage(inputTokens = 0, outputTokens = 0) {
      if (!attempts.length) return;
      const last = attempts[attempts.length - 1];
      last.inputTokens = Math.max(0, Number(inputTokens) || 0); last.outputTokens = Math.max(0, Number(outputTokens) || 0);
      console.info(JSON.stringify({ code: 'AI_PROVIDER_USAGE', feature, provider: last.provider, model: last.model, providerCallCount: used, inputTokens: last.inputTokens, outputTokens: last.outputTokens }));
    },
    get inputTokens() { return attempts.reduce((sum, row) => sum + (row.inputTokens || 0), 0); },
    get outputTokens() { return attempts.reduce((sum, row) => sum + (row.outputTokens || 0), 0); },
    get used() { return used; },
    get remaining() { return Math.max(0, policy.maxProviderCalls - used); },
    get attempts() { return attempts.map(row => ({ ...row })); },
    maxCalls: policy.maxProviderCalls
  };
}

function assertInputWithinHardLimit(feature, byteLength) {
  const policy = getFeaturePolicy(feature);
  const bytes = Number(byteLength || 0);
  if (!Number.isFinite(bytes) || bytes < 1) throw policyError('The scanner did not receive a valid file.', 'AI_INPUT_INVALID', 400);
  if (bytes > policy.maxBytes) {
    throw policyError(
      `${feature[0].toUpperCase()}${feature.slice(1)} input exceeds the hard ${Math.round(policy.maxBytes / MEBIBYTE)}MB AI limit.`,
      'AI_INPUT_TOO_LARGE',
      413
    );
  }
  return bytes;
}

function assertPageCountWithinHardLimit(feature, pageCount) {
  const policy = getFeaturePolicy(feature);
  const pages = Number(pageCount || 0);
  if (!Number.isInteger(pages) || pages < 1) throw policyError('The scanner could not verify a safe page count.', 'AI_PAGE_COUNT_INVALID', 400);
  if (pages > policy.maxPagesPerRequest) {
    throw policyError(
      `${feature[0].toUpperCase()}${feature.slice(1)} scans are limited to ${policy.maxPagesPerRequest} pages per request. Split this file before scanning.`,
      'AI_REQUEST_PAGE_LIMIT',
      413
    );
  }
  return pages;
}

function detectMimeTypeFromBuffer(buffer, fallback = 'application/octet-stream') {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return clean(fallback).toLowerCase() || 'application/octet-stream';
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buffer.subarray(0, 3).toString('ascii') === 'GIF') return 'image/gif';
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp' && /heic|heix|hevc|mif1|msf1/i.test(buffer.subarray(8, 12).toString('ascii'))) return 'image/heic';
  return clean(fallback).toLowerCase() || 'application/octet-stream';
}

function readImageDimensions(buffer, mimeType = '') {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) return null;
  const type = clean(mimeType).toLowerCase().split(';')[0];

  if (type === 'image/png' && buffer.length >= 24) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (type === 'image/gif' && buffer.length >= 10) {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (type === 'image/jpeg') {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
      const marker = buffer[offset];
      offset += 1;
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (offset + 2 > buffer.length) break;
      const segmentLength = buffer.readUInt16BE(offset);
      if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
      const isStartOfFrame = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
      if (isStartOfFrame && segmentLength >= 7) {
        return { width: buffer.readUInt16BE(offset + 5), height: buffer.readUInt16BE(offset + 3) };
      }
      offset += segmentLength;
    }
  }
  if (type === 'image/webp' && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    const chunk = buffer.subarray(12, 16).toString('ascii');
    if (chunk === 'VP8X' && buffer.length >= 30) {
      const width = 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16);
      const height = 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16);
      return { width, height };
    }
    if (chunk === 'VP8 ' && buffer.length >= 30 && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
      const b0 = buffer[21]; const b1 = buffer[22]; const b2 = buffer[23]; const b3 = buffer[24];
      return {
        width: 1 + b0 + ((b1 & 0x3f) << 8),
        height: 1 + (b1 >> 6) + (b2 << 2) + ((b3 & 0x0f) << 10)
      };
    }
  }
  return null;
}

function assertImageDimensionsWithinHardLimit(feature, buffer, mimeType = '') {
  const type = clean(mimeType).toLowerCase().split(';')[0];
  if (!type.startsWith('image/')) return null;
  const supported = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!supported.includes(type)) {
    throw policyError('This image format cannot be size-verified safely. Convert it to JPEG, PNG, GIF, or WebP before scanning.', 'AI_IMAGE_DIMENSIONS_UNVERIFIED', 415);
  }
  const dimensions = readImageDimensions(buffer, type);
  if (!dimensions || !Number.isInteger(dimensions.width) || !Number.isInteger(dimensions.height) || dimensions.width < 1 || dimensions.height < 1) {
    throw policyError('The scanner could not verify this image\'s dimensions safely. Re-export it before scanning.', 'AI_IMAGE_DIMENSIONS_UNVERIFIED', 415);
  }
  const policy = getFeaturePolicy(feature);
  const pixels = dimensions.width * dimensions.height;
  if (dimensions.width > policy.maxImageEdge || dimensions.height > policy.maxImageEdge || pixels > policy.maxImagePixels) {
    throw policyError(
      `${feature[0].toUpperCase()}${feature.slice(1)} images are limited to ${policy.maxImageEdge}px per edge and ${Math.round(policy.maxImagePixels / 1_000_000)} megapixels. Resize this image before scanning.`,
      'AI_IMAGE_DIMENSIONS_TOO_LARGE',
      413
    );
  }
  return { ...dimensions, pixels };
}

function normalizeIdempotencyKey(value = '') {
  const key = clean(value);
  if (key.length < 12 || key.length > 180) {
    throw policyError('A valid idempotency key is required for this AI request.', 'AI_IDEMPOTENCY_KEY_REQUIRED', 400);
  }
  return key;
}

async function reserveAiRequest({ db, feature, restaurantId, uid, idempotencyKey }) {
  if (!db || typeof db.runTransaction !== 'function') throw policyError('AI request locking requires Firebase Admin access.', 'AI_LOCK_UNAVAILABLE');
  const key = normalizeIdempotencyKey(idempotencyKey);
  const lockId = crypto.createHash('sha256').update(`${feature}|${restaurantId}|${uid}|${key}`).digest('hex');
  const ref = db.collection('aiRequestLocks').doc(lockId);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const result = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const existing = snap.data() || {};
      const rawExpiry = existing.expiresAt;
      const expiryMs = typeof rawExpiry?.toMillis === 'function'
        ? rawExpiry.toMillis()
        : new Date(rawExpiry || 0).getTime();
      const expired = Number.isFinite(expiryMs) && expiryMs <= now.getTime();
      if (!expired && existing.status !== 'failed') {
        return { duplicate: true, status: existing.status || 'submitted' };
      }
    }
    tx.set(ref, {
      feature,
      restaurantId: clean(restaurantId),
      uid: clean(uid),
      idempotencyKeyHash: crypto.createHash('sha256').update(key).digest('hex'),
      status: 'submitted',
      createdAt: now,
      updatedAt: now,
      expiresAt
    });
    return { duplicate: false, status: 'submitted' };
  });
  return { ...result, ref, lockId };
}

async function completeAiRequestLock(lock, status = 'completed', details = {}) {
  if (!lock?.ref || lock.duplicate) return;
  const safeStatus = status === 'completed' ? 'completed' : 'failed';
  await lock.ref.set({
    status: safeStatus,
    updatedAt: new Date(),
    completedAt: new Date(),
    providerCallCount: Math.max(0, Number(details.providerCallCount || 0)),
    inputTokens: Math.max(0, Number(details.inputTokens || 0)), outputTokens: Math.max(0, Number(details.outputTokens || 0)),
    model: normalizeGeminiModel(details.model || ''),
    provider: clean(details.provider || ''),
    errorCode: clean(details.errorCode || '').slice(0, 80)
  }, { merge: true });
}

module.exports = {
  OPENAI_CUSTOMER_MODELS, INTERNAL_DIAGNOSTIC_MODELS, AI_ROUTES,
  normalizeProvider, assertApprovedModel, resolveAiPolicy, enforceClientAiSelection, policyError,
  GEMINI_MODEL_ALLOWLIST,
  AI_HARD_LIMITS,
  getFeaturePolicy,
  getAllowedGeminiModels,
  getHardOutputTokenLimit,
  getHardInputByteLimit,
  getHardRateLimit,
  createProviderCallBudget,
  assertInputWithinHardLimit,
  assertPageCountWithinHardLimit,
  detectMimeTypeFromBuffer,
  assertImageDimensionsWithinHardLimit,
  reserveAiRequest,
  completeAiRequestLock,
  _test: { clampInteger, normalizeGeminiModel, normalizeIdempotencyKey, readImageDimensions }
};
