// Optional AI parser for 86 Voice. The frontend has a safe local parser first.
// If GEMINI_API_KEY or GOOGLE_API_KEY is present, this route can help classify vague commands.
function voiceModelCandidates() {
  return Array.from(new Set([
    process.env.VOICE_GEMINI_MODEL || process.env.GEMINI_MODEL || '',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ].map(v => String(v || '').trim()).filter(Boolean)));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const { text = '' } = req.body || {};
    if (!apiKey || !String(text).trim()) return res.status(200).json({ intent: 'unknown' });

    const prompt = `You are a safe command parser for a restaurant management app. Parse the user's voice command into JSON only. Supported intents: eighty_six_alert, create_prep, post_message, maintenance, burn_log, navigate, navigate_schedule, help, unknown. The phrase “86 item” or “we are out of item” must be eighty_six_alert, never an inventory edit. Never execute actions. Include summary and needsConfirmation. User command: ${JSON.stringify(text)}`;
    let data = null;
    for (const model of voiceModelCandidates()) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });
      if (response.ok) {
        data = await response.json().catch(() => null);
        break;
      }
      const rawError = await response.text().catch(() => '');
      if (!/not found|not supported|unsupported|unavailable/i.test(rawError)) break;
    }
    if (!data) return res.status(200).json({ intent: 'unknown' });
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let parsed = {};
    try { parsed = JSON.parse(raw); } catch (e) { parsed = { intent: 'unknown' }; }
    return res.status(200).json(parsed || { intent: 'unknown' });
  } catch (err) {
    return res.status(200).json({ intent: 'unknown', error: err.message });
  }
};
