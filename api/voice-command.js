// Optional AI parser for 86 Voice. The frontend has a safe local parser first.
// If GEMINI_API_KEY or GOOGLE_API_KEY is present, this route can help classify vague commands.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const { text = '' } = req.body || {};
    if (!apiKey || !String(text).trim()) return res.status(200).json({ intent: 'unknown' });

    const prompt = `You are a safe command parser for a restaurant management app. Parse the user's voice command into JSON only. Supported intents: inventory_zero, create_prep, post_message, maintenance, burn_log, navigate, navigate_schedule, help, unknown. Never execute actions. Include summary and needsConfirmation. User command: ${JSON.stringify(text)}`;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });
    if (!response.ok) return res.status(200).json({ intent: 'unknown' });
    const data = await response.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let parsed = {};
    try { parsed = JSON.parse(raw); } catch (e) { parsed = { intent: 'unknown' }; }
    return res.status(200).json(parsed || { intent: 'unknown' });
  } catch (err) {
    return res.status(200).json({ intent: 'unknown', error: err.message });
  }
};
