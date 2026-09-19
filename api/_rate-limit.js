function cleanKey(value = '') {
  return String(value || 'anonymous').replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 180);
}

function getCallerKey(req, decoded = null, routeName = 'api') {
  const uid = decoded?.uid || decoded?.user_id || '';
  const email = decoded?.email || '';
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  return cleanKey(`${routeName}:${uid || email || ip || 'unknown'}`);
}

async function enforceRateLimit({ db, req, decoded = null, routeName = 'api', limit = 30, windowMs = 60 * 1000 }) {
  if (!db || !req) return { ok: true, skipped: true };
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const key = getCallerKey(req, decoded, routeName);
  const ref = db.collection('apiRateLimits').doc(`${key}:${windowStart}`);
  const result = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const current = snap.exists ? Number(snap.data().count || 0) : 0;
    const next = current + 1;
    tx.set(ref, {
      key,
      routeName,
      count: next,
      limit,
      windowMs,
      windowStart: new Date(windowStart).toISOString(),
      updatedAt: new Date(now).toISOString(),
      expiresAt: new Date(windowStart + windowMs * 3).toISOString()
    }, { merge: true });
    return { ok: next <= limit, count: next };
  });
  return {
    ...result,
    key,
    routeName,
    limit,
    resetAt: new Date(windowStart + windowMs).toISOString()
  };
}

function sendRateLimited(res, result) {
  if (res && typeof res.setHeader === 'function') {
    res.setHeader('Retry-After', Math.max(1, Math.ceil((new Date(result.resetAt).getTime() - Date.now()) / 1000)));
    res.setHeader('X-RateLimit-Limit', String(result.limit || ''));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, (result.limit || 0) - (result.count || 0))));
  }
  return res.status(429).json({ ok: false, error: 'Too many requests. Wait a minute and try again.', rateLimited: true, resetAt: result.resetAt });
}

module.exports = { enforceRateLimit, sendRateLimited };
