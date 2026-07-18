const { initAdmin, authorize, requireAppCheckIfEnforced, readBody, writeAudit } = require('./_chaos-admin');
const { enforceRateLimit, sendRateLimited } = require('./_rate-limit');

const MAX_INPUT_BYTES = 120000;
const MAX_ARRAY_ITEMS = 80;
const MAX_STRING_LENGTH = 5000;
const MAX_REQUESTS_PER_MINUTE = 8;
const HARD_MAX_OUTPUT_TOKENS = 5000;
const ALLOWED_DIAGNOSTICS_MODELS = new Set(['gpt-5-mini']);

const SECRET_KEY_PATTERN = /(authorization|cookie|secret|private.?key|api.?key|access.?token|refresh.?token|id.?token|bearer|password|credential|signed.?url|download.?url|client.?secret)/i;
const PERSONAL_KEY_PATTERN = /(^|_)(email|phone|address|owneremail|useremail|clientemail|employeeemail|displayname|fullname)($|_)/i;
const SIGNED_URL_PATTERN = /(X-Goog-Signature|GoogleAccessId|X-Amz-Signature|Signature)=/i;
const JWT_PATTERN = /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g;
const OPENAI_KEY_PATTERN = /\bsk-[A-Za-z0-9_-]{12,}\b/g;
const GOOGLE_KEY_PATTERN = /\bAIza[A-Za-z0-9_-]{20,}\b/g;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
const PRIVATE_KEY_PATTERN = /-----BEGIN(?: RSA)? PRIVATE KEY-----[\s\S]*?-----END(?: RSA)? PRIVATE KEY-----/gi;

function redactString(value = '') {
  let text = String(value || '');
  if (SIGNED_URL_PATTERN.test(text)) return '[redacted signed URL]';
  text = text
    .replace(PRIVATE_KEY_PATTERN, '[redacted private key]')
    .replace(BEARER_PATTERN, 'Bearer [redacted]')
    .replace(JWT_PATTERN, '[redacted token]')
    .replace(OPENAI_KEY_PATTERN, '[redacted API key]')
    .replace(GOOGLE_KEY_PATTERN, '[redacted API key]');
  return text.length > MAX_STRING_LENGTH ? `${text.slice(0, MAX_STRING_LENGTH)}…[truncated]` : text;
}


function compactDiagnosticsValue(value, depth = 0) {
  if (depth > 4) return '[summary depth limit]';
  if (value === undefined) return undefined;
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.length > 900 ? `${value.slice(0, 900)}…[truncated]` : value;
  if (Array.isArray(value)) return value.slice(0, 30).map(item => compactDiagnosticsValue(item, depth + 1));
  if (typeof value === 'object') {
    const important = ['ok', 'status', 'code', 'error', 'message', 'warning', 'warnings', 'errors', 'ms', 'durationMs', 'generatedAt', 'lastRunAt', 'lastBackupAt', 'lastSuccessfulBackupAt', 'backupIntegrity', 'latestIntegrity', 'projectId', 'storageBucket', 'configured', 'serviceAccountSource', 'route', 'statusCode', 'count', 'total', 'failed', 'passed', 'checks', 'health', 'environment', 'platform', 'counts'];
    const cleaned = {};
    for (const key of important) {
      if (Object.prototype.hasOwnProperty.call(value, key)) cleaned[key] = compactDiagnosticsValue(value[key], depth + 1);
    }
    for (const [key, item] of Object.entries(value).slice(0, 40)) {
      if (cleaned[key] !== undefined || SECRET_KEY_PATTERN.test(key) || SIGNED_URL_PATTERN.test(String(item || ''))) continue;
      cleaned[key] = compactDiagnosticsValue(item, depth + 1);
    }
    return cleaned;
  }
  return String(value);
}

function fitDiagnosticsPayload(value) {
  const sanitized = sanitizeDiagnostics(value);
  let serialized = JSON.stringify(sanitized);
  if (Buffer.byteLength(serialized, 'utf8') <= MAX_INPUT_BYTES) return { payload: sanitized, compacted: false, bytes: Buffer.byteLength(serialized, 'utf8') };
  const compacted = compactDiagnosticsValue(sanitized);
  serialized = JSON.stringify(compacted);
  if (Buffer.byteLength(serialized, 'utf8') <= MAX_INPUT_BYTES) return { payload: compacted, compacted: true, bytes: Buffer.byteLength(serialized, 'utf8') };
  const emergency = {
    note: 'Diagnostics were still large after compaction; this emergency summary preserves top-level status only.',
    generatedAt: new Date().toISOString(),
    diagnostics: compactDiagnosticsValue(sanitized?.diagnostics || {}, 2),
    health: compactDiagnosticsValue(sanitized?.health || {}, 2),
    context: compactDiagnosticsValue(sanitized?.context || {}, 2)
  };
  return { payload: emergency, compacted: true, bytes: Buffer.byteLength(JSON.stringify(emergency), 'utf8') };
}

function sanitizeDiagnostics(value, depth = 0) {
  if (depth > 9) return '[truncated depth]';
  if (value === undefined) return undefined;
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY_ITEMS).map(item => sanitizeDiagnostics(item, depth + 1));
  if (typeof value === 'object') {
    const cleaned = {};
    Object.entries(value).slice(0, 250).forEach(([key, item]) => {
      if (SECRET_KEY_PATTERN.test(key)) {
        cleaned[key] = typeof item === 'boolean' ? item : '[redacted credential]';
      } else if (PERSONAL_KEY_PATTERN.test(String(key || '').toLowerCase())) {
        cleaned[key] = '[redacted personal data]';
      } else {
        cleaned[key] = sanitizeDiagnostics(item, depth + 1);
      }
    });
    return cleaned;
  }
  return redactString(value);
}

const guidanceSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'overallSeverity', 'noIssuesFound', 'issues'],
  properties: {
    summary: { type: 'string' },
    overallSeverity: { type: 'string', enum: ['info', 'low', 'medium', 'high', 'critical'] },
    noIssuesFound: { type: 'boolean' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['issue', 'severity', 'whatItMeans', 'likelyCause', 'repairSteps', 'whereToClick', 'deployPublishEnvNotes', 'verificationSteps', 'whenToEscalate'],
        properties: {
          issue: { type: 'string' },
          severity: { type: 'string', enum: ['info', 'low', 'medium', 'high', 'critical'] },
          whatItMeans: { type: 'string' },
          likelyCause: { type: 'string' },
          repairSteps: { type: 'array', items: { type: 'string' } },
          whereToClick: { type: 'array', items: { type: 'string' } },
          deployPublishEnvNotes: { type: 'array', items: { type: 'string' } },
          verificationSteps: { type: 'array', items: { type: 'string' } },
          whenToEscalate: { type: 'string' }
        }
      }
    }
  }
};

function extractOutputText(data = {}) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text.trim();
    }
  }
  return '';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST.' });
  try {
    const app = initAdmin(req);
    const appCheck = await requireAppCheckIfEnforced(app, req);
    if (!appCheck.ok) return res.status(appCheck.status || 401).json({ ok: false, error: appCheck.error });

    const ctx = await authorize(req, app, { allowTenantAdmin: false });
    if (!ctx.ok || !ctx.isSuperAdmin) return res.status(ctx.status || 403).json({ ok: false, error: ctx.error || 'Super Admin access is required.' });

    const db = app.firestore();
    const rate = await enforceRateLimit({
      db,
      req,
      decoded: ctx.decoded,
      routeName: 'openai-diagnostics-explain',
      limit: Math.min(MAX_REQUESTS_PER_MINUTE, Math.max(1, Number.parseInt(process.env.OPENAI_DIAGNOSTICS_RATE_LIMIT || MAX_REQUESTS_PER_MINUTE, 10) || MAX_REQUESTS_PER_MINUTE)),
      windowMs: 60 * 1000
    });
    if (!rate.ok) return sendRateLimited(res, rate);

    const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(503).json({
        ok: false,
        configured: false,
        code: 'OPENAI_NOT_CONFIGURED',
        error: 'OpenAI diagnostics is not configured. Add OPENAI_API_KEY in Vercel Environment Variables, redeploy, and try again.'
      });
    }

    const body = await readBody(req);
    if (!body?.diagnostics && !body?.health && !body?.context) {
      return res.status(400).json({ ok: false, error: 'Diagnostics or health data is required.' });
    }

    const fitted = fitDiagnosticsPayload({
      diagnostics: body.diagnostics || null,
      health: body.health || null,
      context: body.context || null
    });
    const sanitized = fitted.payload;
    const serialized = JSON.stringify(sanitized);

    const model = String(process.env.OPENAI_DIAGNOSTICS_MODEL || 'gpt-5-mini').trim();
    if (!ALLOWED_DIAGNOSTICS_MODELS.has(model)) {
      return res.status(500).json({
        ok: false,
        configured: true,
        code: 'AI_MODEL_NOT_ALLOWED',
        error: 'OPENAI_DIAGNOSTICS_MODEL is not permitted by the hard cost policy. Use gpt-5-mini.'
      });
    }
    const maxOutputTokens = Math.min(
      HARD_MAX_OUTPUT_TOKENS,
      Math.max(1000, Number.parseInt(process.env.OPENAI_DIAGNOSTICS_MAX_OUTPUT_TOKENS || HARD_MAX_OUTPUT_TOKENS, 10) || HARD_MAX_OUTPUT_TOKENS)
    );
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: maxOutputTokens,
        instructions: [
          'You are the 86 Chaos diagnostics repair assistant for a React, Firebase Auth/Firestore/Storage, and Vercel application.',
          'Analyze only the supplied redacted operational data. Never invent a failed check, secret value, customer record, click path, or deployment result.',
          'Give practical repair guidance that a System Administrator can follow. Prefer exact in-app paths such as System Administrator > Health Dashboard, Security Center, Backup Center, Support Diagnostics, or Deployment Readiness.',
          'Distinguish changes that require a Vercel redeploy, Firebase rules publish, Storage rules publish, Firebase Console action, environment variable update, or no deployment.',
          'If evidence is incomplete, say what must be checked next and lower the severity. Do not recommend disabling security controls as a shortcut.',
          'Return valid JSON matching the provided schema.'
        ].join('\n'),
        input: `Explain this redacted 86 Chaos diagnostics payload and produce repair guidance. Payload bytes: ${fitted.bytes}. Compacted: ${fitted.compacted ? 'yes' : 'no'}.\n${serialized}`,
        text: {
          format: {
            type: 'json_schema',
            name: 'diagnostics_repair_guidance',
            strict: true,
            schema: guidanceSchema
          }
        }
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const safeCode = String(data?.error?.code || data?.error?.type || 'OPENAI_REQUEST_FAILED');
      const safeMessage = response.status === 401
        ? 'OpenAI rejected the API key. Replace OPENAI_API_KEY in Vercel and redeploy.'
        : response.status === 429
          ? 'OpenAI rate or usage limits were reached. Check the OpenAI project limits and try again.'
          : `OpenAI diagnostics request failed (${safeCode}). Check the Vercel function logs and OpenAI project configuration.`;
      return res.status(502).json({ ok: false, configured: true, code: safeCode, error: safeMessage });
    }

    const outputText = extractOutputText(data);
    if (!outputText) return res.status(502).json({ ok: false, configured: true, error: 'OpenAI returned no diagnostics explanation.' });

    let guidance;
    try { guidance = JSON.parse(outputText); }
    catch (_) { return res.status(502).json({ ok: false, configured: true, error: 'OpenAI returned an unreadable diagnostics explanation.' }); }

    await writeAudit(db, ctx, 'OPENAI_DIAGNOSTICS_EXPLAIN', model, `Generated ${Array.isArray(guidance.issues) ? guidance.issues.length : 0} structured issue(s) from redacted diagnostics.`);
    return res.status(200).json({
      ok: true,
      configured: true,
      model,
      generatedAt: new Date().toISOString(),
      guidance
    });
  } catch (_) {
    return res.status(500).json({
      ok: false,
      configured: Boolean(process.env.OPENAI_API_KEY),
      error: 'OpenAI diagnostics explanation failed. Check the Vercel function logs for the server-side error.'
    });
  }
};
