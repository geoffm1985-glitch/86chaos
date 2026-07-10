const { initAdmin, authorize, requireAppCheckIfEnforced, readBody, writeAudit } = require('./_chaos-admin');

const APP_VERSION = '15.0.45';
const DEFAULT_MODEL = 'gemini-3.5-flash';
const MAX_QUESTION_CHARS = 1600;
const MAX_CONTEXT_CHARS = 26000;
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
const HARD_MAX_OUTPUT_TOKENS = 8192;
const AUTO_CONTINUE_LIMIT = 2;

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
      style: 'Specific, calm, step-by-step. Do not answer like a generic chatbot. Complete every sentence.',
      requiredSections: [
        'What this probably means',
        'Go here in System Administrator',
        'Do this in order',
        'How to know it worked',
        'What not to touch yet',
        'Deploy/publish separately',
        'Escalate if'
      ],
      completionRules: [
        'Prefer shorter complete instructions over long cut-off instructions.',
        'Do not end with an unfinished bullet, unfinished sentence, or dangling word such as if, because, and, or, when, with, for, to.',
        'If space is tight, summarize the Escalate if section in one complete sentence.'
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

function getGenerateContentFinishReason(data) {
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  return String(candidates[0]?.finishReason || '').trim();
}

function getManualMaxOutputTokens() {
  const raw = Number(process.env.GEMINI_MANUAL_MAX_OUTPUT_TOKENS || process.env.MANUAL_GEMINI_MAX_OUTPUT_TOKENS || DEFAULT_MAX_OUTPUT_TOKENS);
  if (!Number.isFinite(raw) || raw < 1200) return DEFAULT_MAX_OUTPUT_TOKENS;
  return Math.min(Math.round(raw), HARD_MAX_OUTPUT_TOKENS);
}

function answerLooksIncomplete(text = '') {
  const trimmed = String(text || '').trim();
  if (!trimmed) return true;
  const tail = trimmed.slice(-220).trim();
  if (/\b(if|because|and|or|when|while|with|for|to|from|that|the|a|an|by|after|before|unless|until)$/i.test(tail)) return true;
  if (/[,:;]$/.test(tail)) return true;
  if (/[-*•]\s*$/i.test(tail)) return true;
  const lastNonEmptyLine = trimmed.split(/\n+/).map(line => line.trim()).filter(Boolean).pop() || '';
  if (/^(Escalate if|Deploy\/publish separately|What not to touch yet|How to know it worked|Do this in order|Go here in System Administrator|What this probably means)$/i.test(lastNonEmptyLine)) return true;
  return false;
}

function smartAppendAnswer(base = '', continuation = '') {
  const left = String(base || '').trimEnd();
  const right = String(continuation || '').trim();
  if (!left) return right;
  if (!right) return left;
  if (/\b(if|because|and|or|when|while|with|for|to|from|that|the|a|an|by|after|before|unless|until)$|[,;:]$/i.test(left.trim())) {
    return `${left} ${right.replace(/^[-*•\s]+/, '')}`.trim();
  }
  return `${left}\n\n${right}`.trim();
}

function getIncompleteReason({ finishReason, text }) {
  if (String(finishReason || '').toUpperCase() === 'MAX_TOKENS') return 'Gemini hit the output limit.';
  if (answerLooksIncomplete(text)) return 'Answer appears to end mid-sentence.';
  return '';
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
    'Escalate if',
    playbook.escalation || 'Escalate if the issue affects multiple restaurants, the same repair fails twice, a backup/restore is involved, or the logs show permission denied after the expected role/rule checks pass.',
    '',
    'Relevant manual articles',
    articleTitles,
    '',
    `Question answered: ${question}`
  ].join('\n');
}

async function callGemini({ prompt, apiKey, model, maxOutputTokens, temperature = 0.15 }) {
  const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey };
  const generationConfig = {
    temperature,
    topP: 0.8,
    topK: 32,
    maxOutputTokens: maxOutputTokens || getManualMaxOutputTokens()
  };
  const body = {
    systemInstruction: {
      parts: [{ text: 'You are the private 86 Chaos System Administrator Manual assistant. You write operational instructions for a Super Admin. Be exact, ordered, safety-conscious, and finish every sentence.' }]
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
  return { text, api: 'generateContent', model, finishReason: getGenerateContentFinishReason(generateData), maxOutputTokens: generationConfig.maxOutputTokens };
}

function buildInitialPrompt({ manualContext }) {
  return [
    'Use only the JSON context below. If the context is missing a fact, say exactly where the admin should check it in the app instead of guessing.',
    'Write a better System Administrator Manual answer than a generic help bot. Include exact 86 Chaos screen names and button/action names when the context gives them.',
    'Give instructions that answer: where do I go, what do I click/read, what result proves it worked, and what requires Vercel/Firebase deployment outside the app.',
    'Never reveal secrets, signed URLs, customer private data, employee private data, service account JSON, or raw tokens.',
    'Use this exact plain-text format. Keep each section concise, but complete. Do not end on an unfinished sentence:',
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
}

function buildContinuationPrompt({ manualContext, partialAnswer }) {
  return [
    'Continue and finish the 86 Chaos System Administrator Manual answer below.',
    'Do not restart the answer. Do not repeat completed sections unless absolutely needed for clarity.',
    'Start exactly where the partial answer stopped, finish any incomplete bullet or sentence, and complete any missing required sections.',
    'Keep it concise. The final output must end with a complete sentence and must not end with if, because, and, or, when, with, for, to, a comma, or a colon.',
    'Never reveal secrets, signed URLs, customer private data, employee private data, service account JSON, or raw tokens.',
    '',
    'JSON context:',
    manualContext.slice(0, 18000),
    '',
    'Partial answer to continue:',
    String(partialAnswer || '').slice(-9000)
  ].join('\n');
}

async function generateCompleteAnswer({ prompt, manualContext, apiKey, model }) {
  const finishReasons = [];
  const maxOutputTokens = getManualMaxOutputTokens();
  let result = await callGemini({ prompt, apiKey, model, maxOutputTokens });
  let answer = result.text;
  finishReasons.push(result.finishReason || 'UNKNOWN');

  let incompleteReason = getIncompleteReason({ finishReason: result.finishReason, text: answer });
  let autoContinuationCount = 0;
  while (incompleteReason && autoContinuationCount < AUTO_CONTINUE_LIMIT) {
    autoContinuationCount += 1;
    const continuationPrompt = buildContinuationPrompt({ manualContext, partialAnswer: answer });
    const continuation = await callGemini({ prompt: continuationPrompt, apiKey, model, maxOutputTokens: Math.min(maxOutputTokens, 4096), temperature: 0.1 });
    finishReasons.push(continuation.finishReason || 'UNKNOWN');
    answer = smartAppendAnswer(answer, continuation.text);
    incompleteReason = getIncompleteReason({ finishReason: continuation.finishReason, text: answer });
  }

  return {
    text: answer,
    api: result.api,
    model: result.model,
    finishReason: finishReasons[finishReasons.length - 1] || result.finishReason || '',
    finishReasons,
    maxOutputTokens,
    autoContinuationCount,
    answerIncomplete: Boolean(incompleteReason),
    incompleteReason
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST.' });
  try {
    const app = initAdmin();
    const appCheck = await requireAppCheckIfEnforced(app, req);
    if (!appCheck.ok) return res.status(appCheck.status || 401).json({ ok: false, error: appCheck.error });
    const ctx = await authorize(req, app, { allowTenantAdmin: false, allowCrossProjectMaster: true });
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
    const started = Date.now();
    let result;
    let fallbackUsed = false;

    try {
      if (body.continueFrom) {
        const partialAnswer = redactText(body.continueFrom, 10000);
        const continuationPrompt = buildContinuationPrompt({ manualContext, partialAnswer });
        const continuation = await callGemini({ prompt: continuationPrompt, apiKey, model, maxOutputTokens: Math.min(getManualMaxOutputTokens(), 4096), temperature: 0.1 });
        const incompleteReason = getIncompleteReason({ finishReason: continuation.finishReason, text: continuation.text });
        result = {
          ...continuation,
          finishReasons: [continuation.finishReason || 'UNKNOWN'],
          autoContinuationCount: 0,
          answerIncomplete: Boolean(incompleteReason),
          incompleteReason,
          continuation: true
        };
      } else {
        const prompt = buildInitialPrompt({ manualContext });
        result = await generateCompleteAnswer({ prompt, manualContext, apiKey, model });
      }
    } catch (err) {
      fallbackUsed = true;
      result = {
        text: buildFallbackAnswer({ question, playbook, articles, currentState }),
        api: 'local-fallback',
        model,
        error: err.message || 'Gemini failed',
        finishReason: 'FALLBACK',
        finishReasons: ['FALLBACK'],
        autoContinuationCount: 0,
        answerIncomplete: false,
        incompleteReason: ''
      };
    }

    if (!ctx.crossProjectAuth) {
      const db = app.firestore();
      await writeAudit(db, ctx, body.continueFrom ? 'GEMINI_ADMIN_MANUAL_CONTINUE' : 'GEMINI_ADMIN_MANUAL_QUERY', 'system-administrator/manual', `Manual answer generated with ${result.api}. Question: ${question.slice(0, 160)}`, ctx.restaurantId || 'platform');
    }

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
      finishReason: result.finishReason || '',
      finishReasons: result.finishReasons || [],
      maxOutputTokens: result.maxOutputTokens || getManualMaxOutputTokens(),
      autoContinuationCount: result.autoContinuationCount || 0,
      answerIncomplete: Boolean(result.answerIncomplete),
      incompleteReason: result.incompleteReason || '',
      canContinue: Boolean(result.answerIncomplete && !fallbackUsed),
      continuation: Boolean(result.continuation),
      authProjectId: ctx.authProjectId || process.env.FIREBASE_PROJECT_ID || '',
      crossProjectAuth: Boolean(ctx.crossProjectAuth),
      answerShape: ['What this probably means', 'Go here in System Administrator', 'Do this in order', 'How to know it worked', 'What not to touch yet', 'Deploy/publish separately', 'Escalate if']
    });
  } catch (err) {
    return res.status(500).json({ ok: false, version: APP_VERSION, error: err.message || 'Gemini manual assistant failed.' });
  }
};
