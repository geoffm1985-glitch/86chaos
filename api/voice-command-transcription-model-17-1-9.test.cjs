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

test('17.1.9 transcription ignores legacy VOICE_GEMINI_MODEL and uses dedicated 3.5 audio model by default', async () => {
  const routePath = require.resolve('./voice-command.js');
  const adminPath = require.resolve('./_chaos-admin.js');
  const ratePath = require.resolve('./_rate-limit.js');
  const originals = new Map([[routePath, require.cache[routePath]], [adminPath, require.cache[adminPath]], [ratePath, require.cache[ratePath]]]);
  const originalFetch = global.fetch;
  const oldGeminiKey = process.env.GEMINI_API_KEY;
  const oldVoiceModel = process.env.VOICE_GEMINI_MODEL;
  const oldTranscribeModel = process.env.VOICE_TRANSCRIBE_GEMINI_MODEL;
  try {
    delete require.cache[routePath];
    require.cache[adminPath] = { id: adminPath, filename: adminPath, loaded: true, exports: {
      initAdmin: () => ({ auth: () => ({ verifyIdToken: async () => ({ uid: 'voice-user' }) }), firestore: () => ({}) }),
      requireAppCheckIfEnforced: async () => ({ ok: true }),
    }};
    require.cache[ratePath] = { id: ratePath, filename: ratePath, loaded: true, exports: {
      enforceRateLimit: async () => ({ ok: true }), sendRateLimited: () => { throw new Error('unexpected rate limit'); },
    }};
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.VOICE_GEMINI_MODEL = 'gemini-2.5-flash-lite';
    process.env.VOICE_TRANSCRIBE_GEMINI_MODEL = 'gemini-2.5-flash-lite';
    let providerUrl = '';
    global.fetch = async (url) => {
      providerUrl = String(url);
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'open help' }] } }], usageMetadata: {} }) };
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
    assert.equal(res.out.body.transcript, 'open help');
    assert.match(providerUrl, /gemini-3\.5-flash-lite:generateContent/);
    assert.doesNotMatch(providerUrl, /gemini-2\.5-flash-lite:generateContent/);
  } finally {
    global.fetch = originalFetch;
    if (oldGeminiKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldGeminiKey;
    if (oldVoiceModel === undefined) delete process.env.VOICE_GEMINI_MODEL; else process.env.VOICE_GEMINI_MODEL = oldVoiceModel;
    if (oldTranscribeModel === undefined) delete process.env.VOICE_TRANSCRIBE_GEMINI_MODEL; else process.env.VOICE_TRANSCRIBE_GEMINI_MODEL = oldTranscribeModel;
    for (const [key, value] of originals) {
      if (value) require.cache[key] = value; else delete require.cache[key];
    }
  }
});
