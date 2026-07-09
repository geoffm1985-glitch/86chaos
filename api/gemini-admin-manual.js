const { initAdmin, authorize, requireAppCheckIfEnforced, readBody, writeAudit } = require('./_chaos-admin');

const APP_VERSION = '15.0.38';
const DEFAULT_MODEL = 'gemini-3.5-flash';
const MAX_QUESTION_CHARS = 1200;
const MAX_CONTEXT_CHARS = 18000;

function cleanText(value, max = 4000) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function normalizeArticles(input) {
  const rows = Array.isArray(input) ? input : [];
  return rows.slice(0, 10).map((article, idx) => ({
    index: idx + 1,
    title: cleanText(article?.title, 180) || `Article ${idx + 1}`,
    group: cleanText(article?.group, 120) || 'System Administrator',
    keywords: cleanText(article?.keywords, 400),
    body: Array.isArray(article?.body)
      ? article.body.slice(0, 8).map(line => cleanText(line, 900)).filter(Boolean)
      : []
  })).filter(article => article.title || article.body.length);
}

function normalizePlaybook(playbook = {}) {
  return {
    title: cleanText(playbook.title, 180),
    likelyCause: cleanText(playbook.likelyCause, 900),
    firstChecks: Array.isArray(playbook.firstChecks) ? playbook.firstChecks.slice(0, 8).map(line => cleanText(line, 700)).filter(Boolean) : [],
    fixSteps: Array.isArray(playbook.fixSteps) ? playbook.fixSteps.slice(0, 8).map(line => cleanText(line, 700)).filter(Boolean) : [],
    doNot: Array.isArray(playbook.doNot) ? playbook.doNot.slice(0, 6).map(line => cleanText(line, 700)).filter(Boolean) : [],
    escalation: cleanText(playbook.escalation, 800)
  };
}

function buildManualContext({ question, articles, playbook, runtime }) {
  const payload = {
    app: '86 Chaos',
    version: APP_VERSION,
    purpose: 'System Administrator support manual answer',
    runtime,
    question,
    matchedPlaybook: playbook,
    matchedManualArticles: articles
  };
  return JSON.stringify(payload, null, 2).slice(0, MAX_CONTEXT_CHARS);
}

function extractGenerateContentText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map(part => part?.text || '').join('\n').trim();
}

function extractInteractionsText(data) {
  if (typeof data?.output_text === 'string') return data.output_text.trim();
  if (typeof data?.text === 'string') return data.text.trim();
  if (typeof data?.response === 'string') return data.response.trim();
  const output = Array.isArray(data?.output) ? data.output : [];
  const chunks = [];
  for (const item of output) {
    if (typeof item?.text === 'string') chunks.push(item.text);
    if (Array.isArray(item?.content)) {
      item.content.forEach(part => {
        if (typeof part?.text === 'string') chunks.push(part.text);
      });
    }
  }
  return chunks.join('\n').trim();
}

async function callGemini({ prompt, apiKey, model }) {
  const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey };
  const interactionBody = { model, input: prompt };
  const interactionRes = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers,
    body: JSON.stringify(interactionBody)
  });
  const interactionData = await interactionRes.json().catch(() => ({}));
  if (interactionRes.ok) {
    const text = extractInteractionsText(interactionData);
    if (text) return { text, api: 'interactions', model };
  }

  const generateRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 1200 } })
  });
  const generateData = await generateRes.json().catch(() => ({}));
  if (!generateRes.ok) {
    const interactionMessage = interactionData?.error?.message ? `Interactions API: ${interactionData.error.message}` : `Interactions API HTTP ${interactionRes.status}`;
    const generateMessage = generateData?.error?.message ? `generateContent API: ${generateData.error.message}` : `generateContent API HTTP ${generateRes.status}`;
    throw new Error(`${interactionMessage}; ${generateMessage}`);
  }
  const text = extractGenerateContentText(generateData);
  if (!text) throw new Error('Gemini returned an empty manual answer.');
  return { text, api: 'generateContent', model };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST.' });
  try {
    const app = initAdmin();
    const appCheck = await requireAppCheckIfEnforced(app, req);
    if (!appCheck.ok) return res.status(appCheck.status || 401).json({ ok: false, error: appCheck.error });
    const ctx = await authorize(req, app, { allowTenantAdmin: false });
    if (!ctx.ok || !ctx.isSuperAdmin) return res.status(ctx.status || 403).json({ ok: false, error: ctx.error || 'Super admin required.' });

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) return res.status(400).json({ ok: false, error: 'Gemini is not configured. Add GEMINI_API_KEY in Vercel and redeploy.' });

    const body = await readBody(req);
    const question = cleanText(body.question, MAX_QUESTION_CHARS);
    if (question.length < 3) return res.status(400).json({ ok: false, error: 'Ask a System Administrator manual question first.' });

    const articles = normalizeArticles(body.articles);
    const playbook = normalizePlaybook(body.playbook || {});
    const model = cleanText(process.env.GEMINI_MODEL || process.env.GOOGLE_GENERATIVE_AI_MODEL || DEFAULT_MODEL, 80) || DEFAULT_MODEL;
    const runtime = {
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
      vercelEnv: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown'
    };
    const manualContext = buildManualContext({ question, articles, playbook, runtime });
    const prompt = [
      'You are the private System Administrator manual assistant inside 86 Chaos.',
      'Answer only from the provided manual/playbook context. Do not invent settings, secrets, customer data, or Firebase rules that are not in the context.',
      'Keep the answer practical and ordered for an admin who is troubleshooting a live restaurant app.',
      'Never reveal API keys, service account material, signed URLs, or private customer/employee data. If missing data is needed, ask the admin to check the named screen or route.',
      'Format the answer with: Likely cause, Check first, Fix steps, Avoid, and Escalate if needed.',
      '',
      manualContext
    ].join('\n');

    const started = Date.now();
    const result = await callGemini({ prompt, apiKey, model });
    const db = app.firestore();
    await writeAudit(db, ctx, 'GEMINI_ADMIN_MANUAL_QUERY', 'system-administrator/manual', `Gemini manual answer generated with ${result.api}. Question: ${question.slice(0, 160)}`, ctx.restaurantId || 'platform');

    return res.status(200).json({
      ok: true,
      version: APP_VERSION,
      answer: result.text,
      model: result.model,
      api: result.api,
      durationMs: Date.now() - started,
      articleCount: articles.length,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ ok: false, version: APP_VERSION, error: err.message || 'Gemini manual assistant failed.' });
  }
};
