const { initAdmin, authorize, requireAppCheckIfEnforced, readBody, writeAudit } = require('./_chaos-admin');

const APP_VERSION = '16.0.3';
const DEFAULT_MODEL = process.env.OPENAI_DIAGNOSTICS_MODEL || process.env.OPENAI_MODEL || 'gpt-5-mini';
const MAX_REPORT_CHARS = 42000;

function cleanText(value = '', max = 4000) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function redact(value, max = MAX_REPORT_CHARS) {
  let text = typeof value === 'string' ? value : JSON.stringify(value || {}, null, 2);
  return cleanText(text, max)
    .replace(/https:\/\/storage\.googleapis\.com\/[^\s)"']+/gi, '[signed-storage-url-redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [redacted]')
    .replace(/AIza[0-9A-Za-z_\-]{20,}/g, '[google-api-key-redacted]')
    .replace(/sk-[A-Za-z0-9_\-]{20,}/g, '[openai-key-redacted]')
    .replace(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g, '[private-key-redacted]')
    .slice(0, max);
}

function buildLocalFallback(report = {}) {
  const backupStatus = report?.backupIntegrity?.status || report?.checks?.firestoreStatus?.value?.lastIntegrityStatus || 'unknown';
  const apiChecks = report?.clientHealth?.apiChecks || [];
  const failedApis = apiChecks.filter(c => c && c.ok === false).map(c => c.label || c.url).slice(0, 8);
  return {
    summary: 'OpenAI was unavailable, so 86 Chaos generated a local structured triage summary from the diagnostics report.',
    severity: failedApis.length || backupStatus === 'failed' ? 'high' : backupStatus === 'verified' ? 'low' : 'medium',
    likelyCause: failedApis.length ? 'One or more API or route checks reported attention and should be checked in Vercel logs.' : 'No single fatal error was obvious from the local fallback. Review backup freshness, API checks, and Security Center.',
    goTo: ['System Administrator -> Health Dashboard', 'System Administrator -> Security Center', 'System Administrator -> Backup Center & Audit Trail'],
    steps: [
      'Run Refresh Health and Full System Diagnostics again after the latest deploy finishes.',
      failedApis.length ? `Open Vercel logs for: ${failedApis.join(', ')}.` : 'Confirm API Routes shows ready or ok for the live deployment.',
      'Check Backup Integrity and Last Successful Sync before changing data.',
      'If rules or env vars were changed, verify the correct Firebase project and Vercel environment.'
    ],
    verification: ['Health Dashboard shows ok/ready checks.', 'Backup Integrity is verified or clearly explained.', 'The affected customer action works on the same deployment URL.'],
    doNotTouchYet: ['Do not restore a backup until you verify the current backup is good.', 'Do not publish hardened Firebase rules while admin access or user profile routing is uncertain.'],
    deployOrPublish: ['Redeploy Vercel only if API routes, vercel.json, frontend code, or env vars changed.', 'Publish Firestore or Storage rules only if the rules files changed and were tested against the correct Firebase project.'],
    escalateIf: ['The same route fails after redeploy.', 'Multiple workspaces are affected.', 'Backups are stale or failed and data changes are needed.'],
    confidence: 0.45,
    source: 'local-fallback'
  };
}

function normalizeExplanation(parsed, fallback) {
  const obj = parsed && typeof parsed === 'object' ? parsed : fallback;
  const arr = (v) => Array.isArray(v) ? v.map(x => cleanText(x, 700)).filter(Boolean).slice(0, 10) : [];
  return {
    summary: cleanText(obj.summary || fallback.summary, 1200),
    severity: ['low', 'medium', 'high', 'critical'].includes(String(obj.severity || '').toLowerCase()) ? String(obj.severity).toLowerCase() : fallback.severity,
    likelyCause: cleanText(obj.likelyCause || fallback.likelyCause, 1500),
    goTo: arr(obj.goTo).length ? arr(obj.goTo) : fallback.goTo,
    steps: arr(obj.steps).length ? arr(obj.steps) : fallback.steps,
    verification: arr(obj.verification).length ? arr(obj.verification) : fallback.verification,
    doNotTouchYet: arr(obj.doNotTouchYet).length ? arr(obj.doNotTouchYet) : fallback.doNotTouchYet,
    deployOrPublish: arr(obj.deployOrPublish).length ? arr(obj.deployOrPublish) : fallback.deployOrPublish,
    escalateIf: arr(obj.escalateIf).length ? arr(obj.escalateIf) : fallback.escalateIf,
    confidence: Math.max(0, Math.min(1, Number(obj.confidence || fallback.confidence || 0.6))),
    source: obj.source || 'openai-structured'
  };
}

async function callOpenAI({ apiKey, model, reportContext }) {
  const schema = {
    name: 'diagnostics_repair_steps',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        summary: { type: 'string' },
        severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        likelyCause: { type: 'string' },
        goTo: { type: 'array', items: { type: 'string' } },
        steps: { type: 'array', items: { type: 'string' } },
        verification: { type: 'array', items: { type: 'string' } },
        doNotTouchYet: { type: 'array', items: { type: 'string' } },
        deployOrPublish: { type: 'array', items: { type: 'string' } },
        escalateIf: { type: 'array', items: { type: 'string' } },
        confidence: { type: 'number' },
        source: { type: 'string' }
      },
      required: ['summary', 'severity', 'likelyCause', 'goTo', 'steps', 'verification', 'doNotTouchYet', 'deployOrPublish', 'escalateIf', 'confidence', 'source']
    }
  };
  const messages = [
    { role: 'system', content: 'You are the 86 Chaos diagnostics repair planner. Return only JSON that matches the schema. Be specific to System Administrator screens. Never expose secrets, signed URLs, tokens, service account values, or private customer/employee details.' },
    { role: 'user', content: `Analyze this 86 Chaos diagnostics data and create structured repair steps. Explain exactly where to go in System Administrator, what to do first, how to verify success, and what needs separate Vercel/Firebase deployment. Diagnostics JSON:\n${reportContext}` }
  ];
  const body = {
    model,
    messages,
    temperature: 0.1,
    response_format: { type: 'json_schema', json_schema: schema }
  };
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `OpenAI HTTP ${response.status}`);
  const content = data?.choices?.[0]?.message?.content || '{}';
  return { raw: JSON.parse(content), model: data?.model || model, finishReason: data?.choices?.[0]?.finish_reason || '' };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST.' });
  const started = Date.now();
  try {
    const app = initAdmin();
    const appCheck = await requireAppCheckIfEnforced(app, req);
    if (!appCheck.ok) return res.status(appCheck.status || 401).json({ ok: false, error: appCheck.error, version: APP_VERSION });
    const ctx = await authorize(req, app, { allowTenantAdmin: false });
    if (!ctx.ok || !ctx.isSuperAdmin) return res.status(ctx.status || 403).json({ ok: false, error: ctx.error || 'Super admin required.', version: APP_VERSION });
    const body = await readBody(req);
    const report = body.report || body.diagnostics || {};
    const fallback = buildLocalFallback(report);
    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_DIAGNOSTICS_API_KEY;
    if (!apiKey) return res.status(400).json({ ok: false, version: APP_VERSION, error: 'OpenAI diagnostics explanation is not configured. Add OPENAI_API_KEY in Vercel and redeploy.', fallback: normalizeExplanation(fallback, fallback) });
    const model = cleanText(process.env.OPENAI_DIAGNOSTICS_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL, 120) || DEFAULT_MODEL;
    const reportContext = redact({ report, currentUrl: body.currentUrl || '', appVersion: body.appVersion || APP_VERSION }, MAX_REPORT_CHARS);
    let explanation;
    let meta = {};
    try {
      const openai = await callOpenAI({ apiKey, model, reportContext });
      explanation = normalizeExplanation(openai.raw, fallback);
      meta = { model: openai.model, finishReason: openai.finishReason, source: 'openai-structured' };
    } catch (err) {
      explanation = normalizeExplanation({ ...fallback, summary: `${fallback.summary} OpenAI error: ${cleanText(err.message, 500)}`, source: 'local-fallback-after-openai-error' }, fallback);
      meta = { model, source: 'local-fallback-after-openai-error', error: err.message || 'OpenAI diagnostics explanation failed.' };
    }
    await writeAudit(app.firestore(), ctx, 'OPENAI_DIAGNOSTICS_EXPLAIN', 'system/fullSystemDiagnostics', `Diagnostics explanation generated. Severity: ${explanation.severity}. Source: ${meta.source}.`, ctx.restaurantId || 'platform');
    return res.status(200).json({ ok: true, version: APP_VERSION, explanation, meta, durationMs: Date.now() - started, generatedAt: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ ok: false, version: APP_VERSION, error: err.message || 'OpenAI diagnostics explanation failed.' });
  }
};
