const { initAdmin, requireAppCheckIfEnforced } = require('./_chaos-admin');
const { enforceRateLimit, sendRateLimited } = require('./_rate-limit');

const APP_VERSION = '16.0.4';

function cleanText(value = '', max = 500) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeVoiceText(value = '') {
  return cleanText(value).toLowerCase().replace(/[.,!?]/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanVoiceItemName(text = '') {
  return cleanText(text)
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/\b(all out of|out of|to|in|on|for|please|right now|today|tonight|this morning|this afternoon)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDeterministicEightySix(text = '') {
  const raw = cleanText(text, 600);
  const q = normalizeVoiceText(raw);
  if (!q) return null;
  let itemPhrase = '';
  if (/\b(86|eighty six)\b/.test(q)) {
    itemPhrase = q.replace(/\b(86|eighty six|item|the|please|send|post|alert|for|now|right now|an|a)\b/g, ' ');
  }
  const outPatterns = [
    /^(?:we are|we're|were)\s+(?:all\s+)?out of\s+(.+)$/,
    /^(?:we are|we're|were)\s+outta\s+(.+)$/,
    /^(?:we\s+)?ran out of\s+(.+)$/,
    /^(?:we\s+)?just ran out of\s+(.+)$/,
    /^out of\s+(.+)$/,
    /^all out of\s+(.+)$/,
    /^mark\s+(.+?)\s+(?:as\s+)?(?:86|eighty six|out of stock)$/,
    /^make\s+(.+?)\s+(?:86|eighty six|out of stock)$/
  ];
  if (!itemPhrase) {
    for (const pattern of outPatterns) {
      const match = q.match(pattern);
      if (match?.[1]) { itemPhrase = match[1]; break; }
    }
  }
  const requestedItemName = cleanVoiceItemName(itemPhrase);
  if (!requestedItemName || requestedItemName.length < 2) return null;
  return {
    intent: 'eighty_six_alert',
    label: `Confirm 86 alert: ${requestedItemName}`,
    requestedItemName,
    itemName: requestedItemName,
    menuMatchMethod: 'server-text-only',
    summary: `Confirm before sending an 86 alert for ${requestedItemName}. Inventory stock will not be changed.`,
    needsConfirmation: true,
    confidence: 1,
    source: 'deterministic-86-parser',
    version: APP_VERSION
  };
}

// Optional AI parser for 86 Voice. The frontend has a safe local parser first.
// If GEMINI_API_KEY or GOOGLE_API_KEY is present, this route can help classify vague non-86 commands.
function voiceModelCandidates() {
  return Array.from(new Set([
    process.env.VOICE_GEMINI_MODEL || process.env.GEMINI_MODEL || '',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ].map(v => String(v || '').trim()).filter(Boolean)));
}

function sanitizeModelCommand(parsed = {}) {
  const intent = String(parsed.intent || 'unknown').trim();
  const safe = { ...parsed, intent };
  if (intent === 'eighty_six_alert') {
    const requestedItemName = cleanVoiceItemName(parsed.requestedItemName || parsed.itemName || parsed.item || parsed.summary || '');
    return {
      intent: 'eighty_six_alert',
      label: requestedItemName ? `Confirm 86 alert: ${requestedItemName}` : 'Confirm 86 alert',
      requestedItemName,
      itemName: requestedItemName,
      summary: requestedItemName
        ? `Confirm before sending an 86 alert for ${requestedItemName}. Inventory stock will not be changed.`
        : 'Confirm the exact item before sending this 86 alert. Inventory stock will not be changed.',
      needsConfirmation: true,
      confidence: Math.min(Number(parsed.confidence || 0.5), 0.75),
      source: 'ai-fallback-86-needs-confirmation',
      version: APP_VERSION
    };
  }
  if (['inventory_edit', 'adjust_inventory', 'stock_update'].includes(intent)) {
    return { intent: 'unknown', summary: 'Voice inventory edits are blocked. Use Inventory manually so stock is not changed by mistake.', needsConfirmation: true, source: 'blocked-inventory-edit', version: APP_VERSION };
  }
  safe.needsConfirmation = parsed.needsConfirmation !== false;
  safe.version = APP_VERSION;
  return safe;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    try {
      const app = initAdmin();
      const appCheck = await requireAppCheckIfEnforced(app, req);
      if (!appCheck.ok) return res.status(appCheck.status || 401).json({ intent: 'unknown', error: appCheck.error, version: APP_VERSION });
      const db = app.firestore();
      let decoded = null;
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      if (token) decoded = await app.auth().verifyIdToken(token).catch(() => null);
      const voiceRate = await enforceRateLimit({ db, req, decoded, routeName: 'voice-command', limit: Number(process.env.VOICE_COMMAND_RATE_LIMIT || 30), windowMs: 60 * 1000 });
      if (!voiceRate.ok) return sendRateLimited(res, voiceRate);
    } catch (_) {}

    const { text = '' } = req.body || {};
    const rawText = cleanText(text, 600);
    if (!rawText) return res.status(200).json({ intent: 'unknown', version: APP_VERSION });

    const deterministic86 = parseDeterministicEightySix(rawText);
    if (deterministic86) return res.status(200).json(deterministic86);

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return res.status(200).json({ intent: 'unknown', version: APP_VERSION });

    const prompt = `You are a safe command parser for a restaurant management app. Parse the user's voice command into JSON only. Supported intents: eighty_six_alert, create_prep, post_message, maintenance, burn_log, navigate, navigate_schedule, help, unknown. The phrase "86 item" or "we are out of item" must be eighty_six_alert and must set needsConfirmation true. Never return inventory_edit or stock_update. Never execute actions. Include summary, confidence from 0 to 1, and needsConfirmation. User command: ${JSON.stringify(rawText)}`;
    let data = null;
    for (const model of voiceModelCandidates()) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.05 }
        })
      });
      if (response.ok) {
        data = await response.json().catch(() => null);
        break;
      }
      const rawError = await response.text().catch(() => '');
      if (!/not found|not supported|unsupported|unavailable/i.test(rawError)) break;
    }
    if (!data) return res.status(200).json({ intent: 'unknown', version: APP_VERSION });
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let parsed = {};
    try { parsed = JSON.parse(raw); } catch (e) { parsed = { intent: 'unknown' }; }
    return res.status(200).json(sanitizeModelCommand(parsed || { intent: 'unknown' }));
  } catch (err) {
    return res.status(200).json({ intent: 'unknown', error: err.message, version: APP_VERSION });
  }
};
