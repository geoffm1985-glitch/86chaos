'use strict';

const { CUSTOMER_HELP_ARTICLES, HELP_DEEP_LINKS, searchCustomerHelp, makeDeterministicHelpAnswer } = require('../src/core/customerHelpKnowledge.cjs');

const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 12;
const buckets = new Map();

function clean(value = '', max = 1200) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function bearer(req = {}) { return String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim(); }
function boundedHistory(history = []) {
  if (!Array.isArray(history)) return [];
  return history.slice(-6).map(turn => ({ role: clean(turn?.role || '', 20), text: clean(turn?.text || turn?.content || '', 500) })).filter(t => t.text);
}
function rateKey(decoded = {}, req = {}) { return clean(decoded.uid || req.headers?.['x-forwarded-for'] || 'unknown', 200); }
function checkRateLimit(key, now = Date.now()) {
  const bucket = buckets.get(key) || { start: now, count: 0 };
  if (now - bucket.start > RATE_WINDOW_MS) { bucket.start = now; bucket.count = 0; }
  bucket.count += 1;
  buckets.set(key, bucket);
  return bucket.count <= RATE_LIMIT;
}
function validateModelResponse(raw = {}, fallback = {}) {
  const knownArticles = new Set(CUSTOMER_HELP_ARTICLES.map(a => a.id));
  const knownLinks = new Set(Object.keys(HELP_DEEP_LINKS));
  const sourceArticleIds = Array.isArray(raw.sourceArticleIds) ? raw.sourceArticleIds.filter(id => knownArticles.has(String(id))).slice(0, 5) : [];
  const suggestedDeepLinkIds = Array.isArray(raw.suggestedDeepLinkIds) ? raw.suggestedDeepLinkIds.filter(id => knownLinks.has(String(id))).slice(0, 6) : [];
  const answer = clean(raw.answer || fallback.answer || '', 1600);
  const confidence = Math.max(0, Math.min(1, Number(raw.confidence ?? fallback.confidence ?? 0.5)));
  return {
    ok: true,
    answer: answer || fallback.answer || 'I could not find enough Help material to answer that safely.',
    sourceArticleIds: sourceArticleIds.length ? sourceArticleIds : (fallback.sourceArticleIds || []).slice(0, 5),
    suggestedDeepLinkIds: suggestedDeepLinkIds.length ? suggestedDeepLinkIds : (fallback.suggestedDeepLinkIds || []).slice(0, 6),
    confidence,
    insufficientInformation: Boolean(raw.insufficientInformation || fallback.insufficientInformation || confidence < 0.35)
  };
}
function safeHelpResponse(question = '') {
  const local = makeDeterministicHelpAnswer(question);
  return validateModelResponse(local, local);
}
async function maybeCallGemini({ question, history, matches }) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.AI_GEMINI_API_KEY;
  if (!key || process.env.HELP_ASSISTANT_DISABLE_AI === 'true') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5500);
  try {
    const excerpts = matches.slice(0, 4).map(a => ({ id: a.id, title: a.title, summary: a.summary, sections: (a.sections || []).slice(0, 3) }));
    const instruction = [
      'Answer only from supplied 86 Chaos customer Help material.',
      'Use simple language. Do not invent app features or routes.',
      'Do not provide System Administrator, Firebase, release, diagnostic, or backend instructions.',
      'Do not claim you inspected real restaurant data.',
      'Return strict JSON with answer, sourceArticleIds, suggestedDeepLinkIds, confidence, insufficientInformation.'
    ].join(' ');
    const body = {
      contents: [{ role: 'user', parts: [{ text: `${instruction}\n\nQuestion: ${question}\nRecent turns: ${JSON.stringify(history).slice(0, 1800)}\nHelp excerpts: ${JSON.stringify(excerpts).slice(0, 7000)}` }] }],
      generationConfig: { maxOutputTokens: 650, temperature: 0.2, responseMimeType: 'application/json' }
    };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
    if (!res.ok) return null;
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return JSON.parse(text);
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
async function answerHelpQuestion({ question, history = [] }) {
  const cleanQuestion = clean(question, 1200);
  if (!cleanQuestion) return { ok: false, code: 'missing-question', answer: 'Type a Help question first.', sourceArticleIds: [], suggestedDeepLinkIds: [], confidence: 0, insufficientInformation: true };
  if (String(question || '').length > 1200) return { ok: false, code: 'question-too-long', answer: 'Please shorten the question and try again.', sourceArticleIds: [], suggestedDeepLinkIds: [], confidence: 0, insufficientInformation: true };
  const local = makeDeterministicHelpAnswer(cleanQuestion);
  const matches = local.matches || searchCustomerHelp(cleanQuestion, { limit: 5 });
  const ai = await maybeCallGemini({ question: cleanQuestion, history: boundedHistory(history), matches });
  return { ...validateModelResponse(ai || local, local), fallback: !ai };
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, code: 'method-not-allowed', error: 'Use POST.' });
  try {
    const { getAdminAppForRequest, readBody, requireAppCheckIfEnforced } = require('./_chaos-admin');
    const app = getAdminAppForRequest(req);
    const appCheck = await requireAppCheckIfEnforced(app, req);
    if (!appCheck.ok) return res.status(appCheck.status || 401).json({ ok: false, code: 'app-check-required', error: appCheck.error || 'App check required.' });
    const token = bearer(req);
    if (!token) return res.status(401).json({ ok: false, code: 'missing-token', error: 'Sign in to use Ask 86.' });
    const decoded = await app.auth().verifyIdToken(token);
    if (!checkRateLimit(rateKey(decoded, req))) return res.status(429).json({ ok: false, code: 'rate-limited', error: 'Ask 86 is taking a quick breather. Try again in a minute.' });
    const body = await readBody(req);
    const result = await answerHelpQuestion({ question: body.question, history: body.history });
    return res.status(result.ok === false ? 400 : 200).json(result);
  } catch (err) {
    return res.status(500).json({ ok: false, code: 'help-assistant-failed', error: 'Ask 86 could not answer right now. Local Help still works.', ...safeHelpResponse('help') });
  }
}

module.exports = handler;
module.exports._test = { clean, boundedHistory, checkRateLimit, validateModelResponse, safeHelpResponse, answerHelpQuestion, buckets };
