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

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret || getCronSecret(req) !== expectedSecret) return res.status(401).json({ ok: false, error: 'Unauthorized cron request.' });

  const app = initAdmin();
  const db = app.firestore();
  const messaging = app.messaging();
  const nowIso = new Date().toISOString();
  const stats = { scanned: 0, sent: 0, skipped: 0, failed: 0, noToken: 0 };

  try {
    const snap = await db.collection('personalReminders')
      .where('scheduledAt', '<=', nowIso)
      .limit(200)
      .get();

    for (const docSnap of snap.docs) {
      stats.scanned += 1;
      const reminder = docSnap.data() || {};
      if (reminder.status !== 'scheduled') { stats.skipped += 1; continue; }
      const dispatchKey = `${docSnap.id}:${reminder.scheduledAt || ''}`;
      if (reminder.dispatchKey === dispatchKey || reminder.dispatchedAt) { stats.skipped += 1; continue; }
      const ref = db.collection('personalReminders').doc(docSnap.id);
      try {
        await ref.update({ status: 'dispatching', dispatchAttemptAt: nowIso, dispatchKey });
        const userId = reminder.userId || reminder.createdBy || '';
        const userSnap = userId ? await db.collection('users').doc(userId).get() : null;
        const user = userSnap?.exists ? userSnap.data() : {};
        const tokens = collectTokens(user);
        if (!tokens.length) {
          stats.noToken += 1;
          await ref.update({ status: 'no_push_token', dispatchKey, dispatchedAt: nowIso, dispatchError: 'No saved push token for reminder owner.' });
          continue;
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
        await ref.update({ status: 'delivery_problem', dispatchedAt: nowIso, dispatchKey, dispatchError: err.message || 'Dispatch failed.' }).catch(() => {});
      }
    }

    return res.status(200).json({ ok: true, now: nowIso, ...stats });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Reminder dispatch failed.', ...stats });
  }
};
