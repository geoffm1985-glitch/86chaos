function cleanText(value = '', max = 500) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanKey(value = '', fallback = 'unknown') {
  return cleanText(value, 200).replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 200) || fallback;
}

function envFlag(value = '') {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase().trim());
}

function getPostHogConfig() {
  const token = cleanText(
    process.env.POSTHOG_PROJECT_API_KEY ||
    process.env.POSTHOG_PROJECT_KEY ||
    process.env.POSTHOG_KEY ||
    process.env.REACT_APP_POSTHOG_KEY ||
    '',
    300
  );
  const host = cleanText(process.env.POSTHOG_HOST || process.env.REACT_APP_POSTHOG_HOST || 'https://us.i.posthog.com', 300).replace(/\/$/, '') || 'https://us.i.posthog.com';
  const disabled = envFlag(process.env.POSTHOG_DISABLED) || envFlag(process.env.REACT_APP_DISABLE_POSTHOG) || envFlag(process.env.REACT_APP_POSTHOG_DISABLED);
  return { token, host, enabled: Boolean(token) && !disabled };
}

function redactSensitive(value, depth = 0) {
  if (depth > 4) return '[depth-limit]';
  if (value == null) return value;
  if (typeof value === 'string') {
    const text = cleanText(value, 1200);
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return '[email]';
    if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(text)) return '[phone]';
    return text;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(item => redactSensitive(item, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    Object.entries(value).slice(0, 60).forEach(([key, nested]) => {
      const lower = String(key || '').toLowerCase();
      if (/(email|phone|token|secret|password|credential|authorization|auth|rawstack|stack|notes?|reason|wage|pay|salary|ssn|pin)/.test(lower)) {
        out[key] = '[redacted]';
      } else {
        out[key] = redactSensitive(nested, depth + 1);
      }
    });
    return out;
  }
  return cleanText(value);
}

async function capturePostHogEvent({ event = '', distinctId = '', properties = {}, groups = {} } = {}) {
  const config = getPostHogConfig();
  const eventName = cleanText(event, 120);
  const userId = cleanText(distinctId, 200);
  if (!config.enabled || !eventName || !userId || typeof fetch !== 'function') {
    return { attempted: false, enabled: config.enabled, skipped: true };
  }
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), Number(process.env.POSTHOG_TIMEOUT_MS || 2500) || 2500) : null;
  try {
    const body = {
      api_key: config.token,
      event: eventName,
      distinct_id: userId,
      properties: redactSensitive({
        ...properties,
        groups: Object.fromEntries(Object.entries(groups || {}).map(([key, value]) => [cleanKey(key, 'group'), cleanKey(value, 'group')]))
      })
    };
    const response = await fetch(`${config.host}/i/v0/e/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller?.signal
    });
    return { attempted: true, enabled: true, ok: response.ok, status: response.status };
  } catch (error) {
    return { attempted: true, enabled: true, ok: false, error: error?.name === 'AbortError' ? 'timeout' : cleanText(error?.message || error, 300) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

module.exports = {
  getPostHogConfig,
  capturePostHogEvent,
  redactSensitive
};
