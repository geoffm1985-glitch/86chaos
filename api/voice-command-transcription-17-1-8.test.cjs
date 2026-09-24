'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

function mockResponse() {
  const out = { statusCode: 200, body: null };
  return {
    out,
    status(code) { out.statusCode = code; return this; },
    json(body) { out.body = body; return this; },
  };
}

test('17.1.8 authenticated voice route transcribes inline microphone audio through Gemini', async () => {
  const routePath = require.resolve('./voice-command.js');
  const adminPath = require.resolve('./_chaos-admin.js');
  const ratePath = require.resolve('./_rate-limit.js');
  const policyPath = require.resolve('./_ai-policy.js');
  const originals = new Map([[routePath, require.cache[routePath]], [adminPath, require.cache[adminPath]], [ratePath, require.cache[ratePath]], [policyPath, require.cache[policyPath]]]);
  const originalFetch = global.fetch;
  const oldGemini = process.env.GEMINI_API_KEY;
  try {
    delete require.cache[routePath];
    require.cache[adminPath] = { id: adminPath, filename: adminPath, loaded: true, exports: {
      initAdmin: () => ({ auth: () => ({ verifyIdToken: async () => ({ uid: 'voice-user' }) }), firestore: () => ({}) }),
      requireAppCheckIfEnforced: async () => ({ ok: true }),
    }};
    require.cache[ratePath] = { id: ratePath, filename: ratePath, loaded: true, exports: {
      enforceRateLimit: async () => ({ ok: true }), sendRateLimited: () => { throw new Error('unexpected rate limit'); },
    }};
    require.cache[policyPath] = { id: policyPath, filename: policyPath, loaded: true, exports: {
      resolveAiPolicy: () => ({ feature: 'voice', route: '/api/voice-command', provider: 'gemini', model: 'gemini-2.5-flash-lite' }),
      enforceClientAiSelection: () => {},
      getAllowedGeminiModels: () => ['gemini-2.5-flash-lite'],
      getHardOutputTokenLimit: () => 512,
      getHardRateLimit: () => 12,
      getFeaturePolicy: () => ({ maxInputCharacters: 1200 }),
      createProviderCallBudget: () => ({ consume: () => {}, recordUsage: () => {} }),
    }};
    process.env.GEMINI_API_KEY = 'test-key';
    let providerBody = null;
    global.fetch = async (url, options) => {
      assert.match(String(url), /gemini-2\.5-flash-lite:generateContent/);
      providerBody = JSON.parse(options.body);
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'open help' }] } }], usageMetadata: {} }) };
    };
    const handler = require('./voice-command.js');
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
      body: { mode: 'transcribe', mimeType: 'audio/webm;codecs=opus', audioBase64: Buffer.from('short fake audio').toString('base64') },
    };
    const res = mockResponse();
    await handler(req, res);
    assert.equal(res.out.statusCode, 200);
    assert.deepEqual(res.out.body, { intent: 'transcript', transcript: 'open help' });
    const parts = providerBody.contents[0].parts;
    assert.equal(parts[1].inlineData.mimeType, 'audio/webm');
    assert.equal(parts[1].inlineData.data, req.body.audioBase64);
  } finally {
    global.fetch = originalFetch;
    if (oldGemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldGemini;
    for (const [key, value] of originals) {
      if (value) require.cache[key] = value; else delete require.cache[key];
    }
  }
});
