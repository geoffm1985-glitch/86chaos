const { initAdmin, authorize, requireAppCheckIfEnforced, readBody, writeAudit } = require('./_chaos-admin');

const APP_VERSION = '15.0.41';
const DEFAULT_MODEL = 'gemini-3.5-flash';
const MAX_QUESTION_CHARS = 1600;
const MAX_CONTEXT_CHARS = 26000;

const ADMIN_MAP = [
  { section: 'Overview', useFor: 'Command Deck, action queue, master admin self-repair, backup/watchdog shortcuts, platform health summary.' },
  { section: 'Health Checks', useFor: 'API route manifest, environment separation, App Check/MFA/cron visibility, deployment readiness.' },
  { section: 'Security Center', useFor: 'Rules status, App Check, MFA readiness, risky users, account deletion requests, suspicious activity.' },
  { section: 'Workspaces', useFor: 'Restaurant/client routing, owner metadata, modules, plan status, demo modes, workspace support edits.' },
  { section: 'People', useFor: 'User profile routing, restaurantId, role, active status, MFA/token clues, possess-user troubleshooting.' },
  { section: 'Support', useFor: 'Crash reports, permission denied clues, raw inspector, broadcasts, pinned banners, support triage.' },
  { section: 'Forensics & Backups', useFor: 'Backup list/download/restore, restore drills, forensic bundle, audit history, emergency repair tools.' },
  { section: 'Operations', useFor: 'Global refresh, demo workspace, push test, orphan sweep, review stamp, cache clear, global lockdown.' },
  { section: 'Access Control', useFor: 'Grant/revoke platform Super Admin access. Use sparingly and verify exact email.' },
  { section: 'Manual', useFor: 'Question-driven admin support playbooks, relevant articles, Gemini manual assistant.' }
];

function cleanText(value, max = 4000) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function redactText(value, max = 4000) {
  return cleanText(value, max)
    .replace(/https:\/\/storage\.googleapis\.com\/[^\s)]+/gi, '[signed-storage-url-redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [redacted]')
    .replace(/AIza[0-9A-Za-z_\-]{20,}/g, '[google-api-key-redacted]')
    .replace(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g, '[private-key-redacted]');
}

function normalizeArticles(input) {
  const rows = Array.isArray(input) ? input : [];
  return rows.slice(0, 14).map((article, idx) => ({
    index: idx + 1,
    title: redactText(article?.title, 180) || `Article ${idx + 1}`,
    group: redactText(article?.group, 120) || 'System Administrator',
    keywords: redactText(article?.keywords, 500),
    body: Array.isArray(article?.body)
      ? article.body.slice(0, 12).map(line => redactText(line, 1000)).filter(Boolean)
      : []
  })).filter(article => article.title || article.body.length);
}

function normalizePlaybook(playbook = {}) {
  return {
    title: redactText(playbook.title, 180),
    likelyCause: redactText(playbook.likelyCause, 1000),
    firstChecks: Array.isArray(playbook.firstChecks) ? playbook.firstChecks.slice(0, 10).map(line => redactText(line, 800)).filter(Boolean) : [],
    fixSteps: Array.isArray(playbook.fixSteps) ? playbook.fixSteps.slice(0, 10).map(line => redactText(line, 800)).filter(Boolean) : [],
    doNot: Array.isArray(playbook.doNot) ? playbook.doNot.slice(0, 8).map(line => redactText(line, 800)).filter(Boolean) : [],
    escalation: redactText(playbook.escalation, 1000)
  };
}

function normalizeCurrentState(input = {}) {
  const state = input && typeof input === 'object' ? input : {};
  return {
    appVersion: redactText(state.appVersion, 80),
    browserVersion: redactText(state.browserVersion, 80),
    activeAdminSection: redactText(state.activeAdminSection, 80),
    vercelEnv: redactText(state.vercelEnv, 80),
    firebaseProjectId: redactText(state.firebaseProjectId, 100),
    storageBucket: redactText(state.storageBucket, 160),
    lastBackupAt: redactText(state.lastBackupAt, 120),
    lastBackupStatus: redactText(state.lastBackupStatus, 120),
    backupAgeHours: typeof state.backupAgeHours === 'number' ? Math.round(state.backupAgeHours * 10) / 10 : null,
    backupStale: Boolean(state.backupStale),
    nextBackupAt: redactText(state.nextBackupAt, 120),
    watchdogStatus: redactText(state.watchdogStatus, 120),
    healthOk: typeof state.healthOk === 'boolean' ? state.healthOk : null,
    healthAttentionCount: Number.isFinite(Number(state.healthAttentionCount)) ? Number(state.healthAttentionCount) : null,
    riskyUserCount: Number.isFinite(Number(state.riskyUserCount)) ? Number(state.riskyUserCount) : null,
    suspiciousActivityCount: Number.isFinite(Number(state.suspiciousActivityCount)) ? Number(state.suspiciousActivityCount) : null,
    notes: Array.isArray(state.notes) ? state.notes.slice(0, 8).map(line => redactText(line, 400)).filter(Boolean) : []
  };
}

function buildManualContext({ question, articles, playbook, currentState, runtime }) {
  const payload = {
    app: '86 Chaos',
    version: APP_VERSION,
    purpose: 'Generate a practical System Administrator Manual answer.',
    runtime,
    currentState,
    adminMap: ADMIN_MAP,
    question,
    matchedPlaybook: playbook,
    matchedManualArticles: articles,
    answerContract: {
      audience: '86 Chaos Super Admin troubleshooting a live restaurant/kitchen web app.',
      style: 'Specific, calm, step-by-step. Do not answer like a generic chatbot.',
      requiredSections: [
        'What this probably means',
        'Go here in System Administrator',
        'Do this in order',
        'How to know it worked',
        'What not to touch yet',
        'Deploy/publish separately',
        'Escalate if'
      ]
    }
  };
  return JSON.stringify(payload, null, 2).slice(0, MAX_CONTEXT_CHARS);
}

function extractGenerateContentText(data) {
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  const parts = candidates[0]?.content?.parts || [];
  return parts.map(part => part?.text || '').join('\n').trim();
}

function buildFallbackAnswer({ question, playbook, articles, currentState }) {
  const articleTitles = articles.slice(0, 4).map(a => `- ${a.title}`).join('\n') || '- No matched article was sent.';
  const firstChecks = (playbook.firstChecks || []).slice(0, 5).map((line, idx) => `${idx + 1}. ${line}`).join('\n') || '1. Open System Administrator -> Manual and narrow the question with the exact error text.';
  const fixSteps = (playbook.fixSteps || []).slice(0, 6).map((line, idx) => `${idx + 1}. ${line}`).join('\n') || '1. Confirm the affected user/workspace.\n2. Check Health Checks and Security Center.\n3. Make the smallest safe repair, then run diagnostics again.';
  const stateClue = currentState.backupStale ? `Current clue: backup appears stale at about ${currentState.backupAgeHours || 'unknown'} hour(s).` : 'Current clue: no urgent stale backup clue was sent with the question.';
  return [
    'What this probably means',
    playbook.likelyCause || `The manual matched this to: ${playbook.title || 'general System Administrator triage'}. ${stateClue}`,
    '',
    'Go here in System Administrator',
    'Start in System Administrator -> Manual. Then use the section named in the steps below. For backup/cron issues, use Overview and Forensics & Backups. For access issues, use People, Access Control, and Security Center.',
    '',
    'Do this in order',
    firstChecks,
    '',
    'Fix steps',
    fixSteps,
    '',
    'How to know it worked',
    'Run the same action again, then run Health Checks or Full System Diagnostics. The status should move from attention/stale/error to ok/verified, and the affected user or workspace should show the corrected value.',
    '',
    'What not to touch yet',
    (playbook.doNot || []).slice(0, 4).map(line => `- ${line}`).join('\n') || '- Do not publish stricter Firebase rules, delete users, restore backups, or rotate secrets until the smaller check confirms the real cause.',
    '',
    'Deploy/publish separately',
    'If you changed API routes, vercel.json, or env vars, redeploy Vercel. If you changed firestore.rules or storage.rules, publish those rules separately to the correct Firebase project after testing. If no code/rules/env changed, do not redeploy just to test a data repair.',
    '',
    'Relevant manual articles',
    articleTitles,
    '',
    `Question answered: ${question}`
  ].join('\n');
}

async function callGemini({ prompt, apiKey, model }) {
  const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey };
  const generationConfig = {
    temperature: 0.15,
    topP: 0.8,
    topK: 32,
    maxOutputTokens: 2200
  };
  const body = {
    systemInstruction: {
      parts: [{ text: 'You are the private 86 Chaos System Administrator Manual assistant. You write operational instructions for a Super Admin. Be exact, ordered, and safety-conscious.' }]
    },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig
  };
  const generateRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const generateData = await generateRes.json().catch(() => ({}));
  if (!generateRes.ok) {
    const generateMessage = generateData?.error?.message ? `generateContent API: ${generateData.error.message}` : `generateContent API HTTP ${generateRes.status}`;
    throw new Error(generateMessage);
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
    const question = redactText(body.question, MAX_QUESTION_CHARS);
    if (question.length < 3) return res.status(400).json({ ok: false, error: 'Ask a System Administrator manual question first.' });

    const articles = normalizeArticles(body.articles);
    const playbook = normalizePlaybook(body.playbook || {});
    const currentState = normalizeCurrentState(body.currentState || {});
    const model = cleanText(process.env.GEMINI_MODEL || process.env.GOOGLE_GENERATIVE_AI_MODEL || DEFAULT_MODEL, 80) || DEFAULT_MODEL;
    const runtime = {
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
      vercelEnv: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown'
    };
    const manualContext = buildManualContext({ question, articles, playbook, currentState, runtime });
    const prompt = [
      'Use only the JSON context below. If the context is missing a fact, say exactly where the admin should check it in the app instead of guessing.',
      'Write a better System Administrator Manual answer than a generic help bot. Include exact 86 Chaos screen names and button/action names when the context gives them.',
      'Give instructions that answer: where do I go, what do I click/read, what result proves it worked, and what requires Vercel/Firebase deployment outside the app.',
      'Never reveal secrets, signed URLs, customer private data, employee private data, service account JSON, or raw tokens.',
      'Use this exact plain-text format and keep it under 650 words:',
      'What this probably means',
      'Go here in System Administrator',
      'Do this in order',
      'How to know it worked',
      'What not to touch yet',
      'Deploy/publish separately',
      'Escalate if',
      '',
      manualContext
    ].join('\n');

    const started = Date.now();
    let result;
    let fallbackUsed = false;
    try {
      result = await callGemini({ prompt, apiKey, model });
    } catch (err) {
      fallbackUsed = true;
      result = { text: buildFallbackAnswer({ question, playbook, articles, currentState }), api: 'local-fallback', model, error: err.message || 'Gemini failed' };
    }

    const db = app.firestore();
    await writeAudit(db, ctx, 'GEMINI_ADMIN_MANUAL_QUERY', 'system-administrator/manual', `Manual answer generated with ${result.api}. Question: ${question.slice(0, 160)}`, ctx.restaurantId || 'platform');

    return res.status(200).json({
      ok: true,
      version: APP_VERSION,
      answer: result.text,
      model: result.model,
      api: result.api,
      fallbackUsed,
      geminiError: result.error || '',
      durationMs: Date.now() - started,
      articleCount: articles.length,
      generatedAt: new Date().toISOString(),
      answerShape: ['What this probably means', 'Go here in System Administrator', 'Do this in order', 'How to know it worked', 'What not to touch yet', 'Deploy/publish separately', 'Escalate if']
    });
  } catch (err) {
    return res.status(500).json({ ok: false, version: APP_VERSION, error: err.message || 'Gemini manual assistant failed.' });
  }
};
