const { resolveAiPolicy, enforceClientAiSelection } = require('./_ai-policy');
const { initAdmin, requireAppCheckIfEnforced } = require('./_chaos-admin');
const { enforceRateLimit, sendRateLimited } = require('./_rate-limit');
const {
  getAllowedGeminiModels,
  getHardOutputTokenLimit,
  getHardRateLimit,
  createProviderCallBudget,
  getFeaturePolicy
} = require('./_ai-policy');

// Optional AI parser for 86 Voice. The frontend has a safe local parser first.
// If GEMINI_API_KEY or GOOGLE_API_KEY is present, this route can help classify vague commands.
function migrateLegacyVoiceModelConfig(value = '') {
  // Gemini 2.5 access is restricted for newer API projects and may return 404.
  // Keep any explicitly configured current model, but silently retire legacy 2.5
  // voice-only overrides so an old Vercel env value cannot break 86Voice.
  return String(value || '')
    .split(/[\s,;]+/)
    .map(model => model.trim())
    .filter(Boolean)
    .filter(model => !/^models\/gemini-2\.5-/i.test(model) && !/^gemini-2\.5-/i.test(model))
    .join(',');
}

function voiceModelCandidates() {
  return getAllowedGeminiModels({
    feature: 'voice',
    configured: migrateLegacyVoiceModelConfig(process.env.VOICE_GEMINI_MODEL || ''),
    defaults: ['gemini-3.5-flash-lite']
  });
}

function voiceTranscriptionModel() {
  // Keep transcription independent from the general voice-intent model.
  // A legacy 2.5 transcription override is deliberately migrated away because
  // newer Gemini API projects can receive HTTP 404 for that model family.
  return getAllowedGeminiModels({
    feature: 'voice',
    configured: migrateLegacyVoiceModelConfig(process.env.VOICE_TRANSCRIBE_GEMINI_MODEL || ''),
    defaults: ['gemini-3.5-flash-lite']
  })[0];
}

const VOICE_AUDIO_MAX_BYTES = 1_500_000;
const VOICE_AUDIO_MIME_TYPES = new Set([
  'audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg', 'audio/ogg;codecs=opus',
  'audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/aac', 'audio/flac', 'audio/m4a'
]);

function normalizeVoiceAudioMime(value = '') {
  return String(value || '').trim().toLowerCase().slice(0, 80);
}

function estimateBase64Bytes(value = '') {
  const clean = String(value || '').replace(/\s+/g, '');
  if (!clean) return 0;
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor(clean.length * 3 / 4) - padding);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const app = initAdmin(req);
    const appCheck = await requireAppCheckIfEnforced(app, req);
    if (!appCheck.ok) return res.status(appCheck.status || 401).json({ intent: 'unknown', error: appCheck.error });
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return res.status(401).json({ intent: 'unknown', error: 'Sign in before using AI voice parsing.' });
    const decoded = await app.auth().verifyIdToken(token, true);
    const db = app.firestore();
    enforceClientAiSelection(req, resolveAiPolicy({ feature: 'voice', route: '/api/voice-command', provider: 'gemini' }), { uid: decoded.uid });
    const voiceRate = await enforceRateLimit({ db, req, decoded, routeName: 'voice-command', limit: getHardRateLimit('voice', process.env.VOICE_COMMAND_RATE_LIMIT), windowMs: 60 * 1000 });
    if (!voiceRate.ok) return sendRateLimited(res, voiceRate);

    const mode = String(req.body?.mode || '').trim().toLowerCase();
    const audioBase64 = String(req.body?.audioBase64 || '').replace(/^data:[^,]+,/, '').replace(/\s+/g, '');
    const audioMimeType = normalizeVoiceAudioMime(req.body?.mimeType || 'audio/webm');
    const providerAudioMimeType = audioMimeType.split(';')[0];

    if (mode === 'transcribe' || audioBase64) {
      if (!apiKey) return res.status(503).json({ intent: 'unknown', error: 'Voice transcription is not configured on the server.' });
      if (!audioBase64) return res.status(400).json({ intent: 'unknown', error: 'Voice audio is missing.' });
      if (!VOICE_AUDIO_MIME_TYPES.has(audioMimeType)) return res.status(415).json({ intent: 'unknown', error: 'This microphone audio format is not supported.' });
      const audioBytes = estimateBase64Bytes(audioBase64);
      if (!audioBytes || audioBytes > VOICE_AUDIO_MAX_BYTES) return res.status(413).json({ intent: 'unknown', error: 'Voice clips must be short and under 1.5 MB.' });

      const model = voiceTranscriptionModel();
      const callBudget = createProviderCallBudget('voice');
      callBudget.consume({ model, attempt: 'voice-transcription' });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20 * 1000);
      let response;
      try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [
              { text: 'Transcribe the spoken restaurant command exactly. Return only the transcript text, with no labels, explanation, markdown, or quotation marks.' },
              { inlineData: { mimeType: providerAudioMimeType, data: audioBase64 } }
            ] }],
            generationConfig: { temperature: 0, maxOutputTokens: 256 }
          })
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) {
        const rawProviderError = await response.text().catch(() => '');
        let providerMessage = '';
        let providerCode = '';
        try {
          const parsed = JSON.parse(rawProviderError || '{}');
          providerMessage = String(parsed?.error?.message || '').slice(0, 500);
          providerCode = String(parsed?.error?.status || parsed?.error?.code || '').slice(0, 80);
        } catch (_) {
          providerMessage = String(rawProviderError || '').replace(/[\r\n]+/g, ' ').slice(0, 500);
        }
        console.warn(JSON.stringify({
          code: 'VOICE_TRANSCRIPTION_PROVIDER_REJECTED',
          provider: 'gemini',
          model,
          status: response.status || 502,
          providerCode,
          providerMessage,
          mimeType: providerAudioMimeType,
          audioBytes,
          uid: String(decoded?.uid || '').slice(0, 100),
          timestamp: new Date().toISOString()
        }));
        const status = response.status || 502;
        const userMessage = status === 403 || status === 404
          ? 'The configured voice transcription model is unavailable. Please try again after the server model is updated.'
          : status === 400 || status === 415 || status === 422
            ? 'The voice service could not read that recording. Tap Start Listening and try a short command again.'
            : 'The voice transcription service is temporarily unavailable. Please try again.';
        return res.status(status).json({ intent: 'unknown', error: userMessage, diagnosticCode: `VOICE_PROVIDER_${status}`, model });
      }
      const data = await response.json().catch(() => null);
      callBudget.recordUsage(data?.usageMetadata?.promptTokenCount, data?.usageMetadata?.candidatesTokenCount);
      const transcript = String(data?.candidates?.[0]?.content?.parts?.map(part => part?.text || '').join(' ') || '').trim().replace(/^['"]|['"]$/g, '');
      if (!transcript) return res.status(422).json({ intent: 'unknown', error: 'No clear speech was detected in the microphone clip.' });
      return res.status(200).json({ intent: 'transcript', transcript });
    }

    const text = String(req.body?.text || '').trim();
    if (!apiKey || !text) return res.status(200).json({ intent: 'unknown' });
    const maxInputCharacters = getFeaturePolicy('voice').maxInputCharacters;
    if (text.length > maxInputCharacters) return res.status(413).json({ intent: 'unknown', error: `Voice commands are limited to ${maxInputCharacters} characters.` });

    const prompt = `You are a safe command parser for a restaurant management app. Parse the user's voice command into JSON only. Supported intents: eighty_six_alert, create_prep, smart_prep, complete_list_item, upsert_task, create_personal_reminder, create_shared_reminder, menu_impact_answer, status_summary, out_of_stock_summary, undo_last_voice, post_message, maintenance, burn_log, navigate, navigate_schedule, help, unknown. The phrase “86 item” or “we are out of item” must be eighty_six_alert, never an inventory edit. Treat eighty_six_alert as high risk: never choose an inventory record, never claim a match, never execute it, and always set needsConfirmation true and highRisk true. Include only the spoken item phrase as requestedItemName. Never execute actions. Do not approve invoice scans, menu scans, payroll, daily close, financial, plan, admin, security, or integration changes. Include summary and needsConfirmation. User command: ${JSON.stringify(text)}`;
    let data = null;
    const callBudget = createProviderCallBudget('voice');
    for (const model of voiceModelCandidates()) {
      callBudget.consume({ model, attempt: 'voice-intent' });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15 * 1000);
      let response;
      try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0,
              maxOutputTokens: getHardOutputTokenLimit('voice', process.env.VOICE_MAX_OUTPUT_TOKENS)
            }
          })
        });
      } finally {
        clearTimeout(timeout);
      }
      if (response.ok) {
        data = await response.json().catch(() => null);
        callBudget.recordUsage(data?.usageMetadata?.promptTokenCount, data?.usageMetadata?.candidatesTokenCount);
        break;
      }
      const rawError = await response.text().catch(() => '');
      if (!/not found|not supported|unsupported|unavailable/i.test(rawError)) break;
    }
    if (!data) return res.status(200).json({ intent: 'unknown' });
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let parsed = {};
    try { parsed = JSON.parse(raw); } catch (e) { parsed = { intent: 'unknown' }; }
    if (parsed?.intent === 'eighty_six_alert') {
      parsed = {
        intent: 'eighty_six_alert',
        requestedItemName: String(parsed.requestedItemName || parsed.itemName || '').trim(),
        summary: parsed.summary || 'Possible 86 command requires strict local inventory review.',
        needsConfirmation: true,
        highRisk: true,
        aiMayNotSelectItem: true
      };
    }
    if (parsed && parsed.intent !== 'navigate' && parsed.intent !== 'help' && parsed.intent !== 'unknown') parsed.needsConfirmation = true;
    return res.status(200).json(parsed || { intent: 'unknown' });
  } catch (err) {
    const status = err?.statusCode || (/authorization|token|login|sign in/i.test(err?.message || '') ? 401 : 200);
    return res.status(status).json({ intent: 'unknown', error: err.message });
  }
};
