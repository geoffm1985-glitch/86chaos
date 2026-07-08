const { initAdmin } = require('./_chaos-admin');

function getCronSecret(req) {
  const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  return auth || String(req.headers['x-cron-secret'] || '').trim();
}

function collectTokens(user = {}) {
  const tokens = new Set();
  if (user.fcmToken) tokens.add(user.fcmToken);
  if (Array.isArray(user.fcmTokens)) user.fcmTokens.forEach(t => t && tokens.add(t));
  if (Array.isArray(user.pushTokens)) user.pushTokens.forEach(t => t && tokens.add(typeof t === 'string' ? t : t?.token));
  if (user.pushDevices && typeof user.pushDevices === 'object') {
    Object.values(user.pushDevices).forEach(device => {
      if (typeof device === 'string') tokens.add(device);
      if (device?.token) tokens.add(device.token);
      if (device?.fcmToken) tokens.add(device.fcmToken);
    });
  }
  return [...tokens].filter(Boolean);
}

function safeInt(value, fallback, min, max) {
  const parsed = parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

async function runWithConcurrency(items, limit, worker) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret || getCronSecret(req) !== expectedSecret) return res.status(401).json({ ok: false, error: 'Unauthorized cron request.' });

  const app = initAdmin();
  const db = app.firestore();
  const messaging = app.messaging();
  const nowIso = new Date().toISOString();
  const stats = { scanned: 0, claimed: 0, sent: 0, skipped: 0, failed: 0, noToken: 0 };
  const limit = safeInt(process.env.REMINDER_DISPATCH_QUERY_LIMIT, 200, 1, 500);
  const concurrency = safeInt(process.env.REMINDER_DISPATCH_CONCURRENCY, 12, 1, 25);

  try {
    const snap = await db.collection('personalReminders')
      .where('scheduledAt', '<=', nowIso)
      .limit(limit)
      .get();

    const processReminder = async (docSnap) => {
      stats.scanned += 1;
      const ref = db.collection('personalReminders').doc(docSnap.id);
      try {
        const claim = await db.runTransaction(async (tx) => {
          const fresh = await tx.get(ref);
          if (!fresh.exists) return { claimed: false, reason: 'missing' };
          const reminder = fresh.data() || {};
          if (reminder.status !== 'scheduled') return { claimed: false, reason: 'not_scheduled' };
          const dispatchKey = `${docSnap.id}:${reminder.scheduledAt || ''}`;
          if (reminder.dispatchKey === dispatchKey || reminder.dispatchedAt) return { claimed: false, reason: 'already_dispatched' };
          tx.update(ref, { status: 'dispatching', dispatchAttemptAt: nowIso, dispatchKey });
          return { claimed: true, reminder, dispatchKey };
        });

        if (!claim.claimed) {
          stats.skipped += 1;
          return;
        }

        stats.claimed += 1;
        const reminder = claim.reminder || {};
        const dispatchKey = claim.dispatchKey;
        const userId = reminder.userId || reminder.createdBy || '';
        const userSnap = userId ? await db.collection('users').doc(userId).get() : null;
        const user = userSnap?.exists ? userSnap.data() : {};
        const tokens = collectTokens(user);

        if (!tokens.length) {
          stats.noToken += 1;
          await ref.update({ status: 'no_push_token', dispatchKey, dispatchedAt: nowIso, dispatchError: 'No saved push token for reminder owner.' });
          return;
        }

        const payload = {
          notification: {
            title: '86 Chaos Reminder',
            body: reminder.title || 'Personal reminder'
          },
          data: {
            type: 'personal_reminder',
            reminderId: docSnap.id,
            restaurantId: reminder.restaurantId || '',
            click_action: '/?tab=reminders'
          },
          tokens
        };

        const result = await messaging.sendEachForMulticast(payload);
        if (result.successCount > 0) {
          stats.sent += 1;
          await ref.update({
            status: 'sent',
            dispatchedAt: nowIso,
            dispatchKey,
            pushSuccessCount: result.successCount,
            pushFailureCount: result.failureCount || 0
          });
        } else {
          stats.failed += 1;
          await ref.update({
            status: 'delivery_problem',
            dispatchedAt: nowIso,
            dispatchKey,
            pushFailureCount: result.failureCount || tokens.length,
            dispatchError: result.responses?.[0]?.error?.message || 'No push sends succeeded.'
          });
        }
      } catch (err) {
        stats.failed += 1;
        await ref.update({
          status: 'delivery_problem',
          dispatchedAt: nowIso,
          dispatchError: err.message || 'Dispatch failed.'
        }).catch(() => {});
      }
    };

    await runWithConcurrency(snap.docs, concurrency, processReminder);
    return res.status(200).json({ ok: true, now: nowIso, limit, concurrency, ...stats });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Reminder dispatch failed.', limit, concurrency, ...stats });
  }
};
