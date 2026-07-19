const DEFAULT_TIMEOUT_MS = 30000;

function bodySize(value) {
  return Buffer.byteLength(JSON.stringify(value || {}), 'utf8');
}

function getInternalSecret() {
  return String(process.env.PYTHON_INTERNAL_SECRET || process.env.CRON_SECRET || '').trim();
}

function getBaseUrl(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = forwardedProto || (process.env.VERCEL ? 'https' : 'http');
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwardedHost || req.headers.host || process.env.VERCEL_URL || '';
  if (!host) throw new Error('Cannot resolve this deployment host for Python function routing.');
  return `${proto}://${host}`;
}

async function callPythonFunction(req, route, payload, options = {}) {
  const maxPayloadBytes = Number(options.maxPayloadBytes || 1200000);
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  if (bodySize(payload) > maxPayloadBytes) {
    throw new Error(options.payloadError || 'Python function payload is too large. Narrow the date window or reduce history.');
  }
  const secret = getInternalSecret();
  if (!secret) {
    throw new Error('Python internal route secret is missing. Set CRON_SECRET or PYTHON_INTERNAL_SECRET in Vercel.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const target = `${getBaseUrl(req)}${route}`;
  try {
    const response = await fetch(target, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-86-python-internal': secret,
        'x-86-python-caller': options.caller || '86chaos-node-wrapper'
      },
      body: JSON.stringify(payload || {}),
      signal: controller.signal
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; }
    catch (err) { throw new Error(`Python function returned invalid JSON: ${err.message}`); }
    if (!response.ok || data?.ok === false) {
      const message = data?.error || data?.message || `Python function returned HTTP ${response.status}.`;
      throw new Error(message);
    }
    return data;
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('Python function timed out.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { callPythonFunction };
