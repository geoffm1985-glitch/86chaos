const { verifyRequestToken } = require('./_firebase-project-admin');
const { readBody, norm, masterEmails, readWorkspaceMember, userHasWorkspace, requireAppCheckIfEnforced, writeAudit } = require('./_chaos-admin');
const {
  getMonthKey,
  isMasterAdminScanExempt,
  getAiUsageSnapshot,
  updateAiUsageLimits
} = require('./_ai-usage');

function clean(value = '') {
  return String(value == null ? '' : value).trim();
}

function bool(value) {
  return value === true || ['true', '1', 'yes'].includes(String(value || '').toLowerCase());
}

async function loadCaller(app, decoded) {
  const db = app.firestore();
  const email = norm(decoded.email);
  let snap = await db.collection('users').doc(decoded.uid).get();
  let userDocId = decoded.uid;
  let user = snap.exists ? snap.data() : null;
  if (!user && email) {
    const byEmail = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!byEmail.empty) {
      snap = byEmail.docs[0];
      userDocId = snap.id;
      user = snap.data();
    }
  }
  const isSuperAdmin = Boolean(
    decoded.superAdmin === true ||
    user?.isSuperAdmin === true ||
    user?.systemAccess?.superAdmin === true ||
    masterEmails().includes(email)
  );
  return { db, email, userDocId, user: user || {}, isSuperAdmin };
}

async function canReadWorkspaceUsage(db, decoded, caller, restaurantId) {
  if (caller.isSuperAdmin) return true;
  if (!restaurantId) return false;
  if (userHasWorkspace(caller.user, restaurantId)) return true;
  const member = await readWorkspaceMember(db, decoded.uid, caller.email, restaurantId);
  return Boolean(member);
}

function parseMonthKey(value) {
  const key = clean(value) || getMonthKey();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) throw new Error('monthKey must use YYYY-MM format.');
  return key;
}

function parseEventLimit(value, fallback = 20) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? Math.max(1, Math.min(100, parsed)) : fallback;
}

async function listAllUsage({ db, monthKey, eventLimit = 12 }) {
  const [usageSnap, restaurantSnap] = await Promise.all([
    db.collection('aiUsage').where('monthKey', '==', monthKey).get(),
    db.collection('restaurants').get()
  ]);

  const usageRestaurantIds = usageSnap.docs.map(doc => clean(doc.data()?.restaurantId)).filter(Boolean);
  const restaurantRows = restaurantSnap.docs.map(doc => ({
    id: doc.id,
    name: doc.data()?.name || doc.data()?.restaurantName || doc.data()?.businessName || doc.id
  }));
  const restaurantIds = Array.from(new Set([
    ...restaurantRows.map(row => row.id),
    ...usageRestaurantIds
  ].filter(Boolean)));
  const names = Object.fromEntries(restaurantRows.map(row => [row.id, row.name]));

  const rows = await Promise.all(restaurantIds.map(restaurantId =>
    getAiUsageSnapshot({ db, restaurantId, monthKey, eventLimit })
  ));

  return rows.map(row => ({ ...row, restaurantName: names[row.restaurantId] || row.restaurantId }))
    .sort((a, b) => String(a.restaurantName || '').localeCompare(String(b.restaurantName || '')));
}

module.exports = async function handler(req, res) {
  try {
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    const auth = await verifyRequestToken(req, { requireProjectCredentials: true });
    const app = auth.app;
    if (!app) return res.status(500).json({ ok: false, code: 'AI_USAGE_ADMIN_REQUIRED', error: 'AI page enforcement requires the matching Firebase service account in Vercel.' });
    const appCheck = await requireAppCheckIfEnforced(app, req);
    if (!appCheck.ok) return res.status(appCheck.status || 401).json({ ok: false, error: appCheck.error });
    const caller = await loadCaller(app, auth.decoded);
    const monthKey = parseMonthKey(req.method === 'GET' ? req.query?.monthKey : (req.body?.monthKey || req.query?.monthKey));

    if (req.method === 'GET') {
      const restaurantId = clean(req.query?.restaurantId);
      const all = bool(req.query?.all);
      if (all) {
        if (!caller.isSuperAdmin) return res.status(403).json({ ok: false, error: 'Super Admin access is required.' });
        const rows = await listAllUsage({ db: caller.db, monthKey, eventLimit: parseEventLimit(req.query?.eventLimit, 12) });
        return res.status(200).json({ ok: true, monthKey, isSuperAdmin: true, isExempt: isMasterAdminScanExempt(auth.decoded), rows });
      }
      if (!restaurantId) return res.status(400).json({ ok: false, error: 'restaurantId is required.' });
      if (!(await canReadWorkspaceUsage(caller.db, auth.decoded, caller, restaurantId))) {
        return res.status(403).json({ ok: false, error: 'Workspace access is required.' });
      }
      const usage = await getAiUsageSnapshot({ db: caller.db, restaurantId, monthKey, eventLimit: caller.isSuperAdmin ? parseEventLimit(req.query?.eventLimit, 20) : 0 });
      const customerSafeUsage = caller.isSuperAdmin
        ? usage
        : Object.fromEntries(Object.entries(usage).filter(([key]) => !['events', 'exemptPagesProcessed'].includes(key)));
      return res.status(200).json({
        ok: true,
        monthKey,
        isSuperAdmin: caller.isSuperAdmin,
        isExempt: isMasterAdminScanExempt(auth.decoded),
        usage: customerSafeUsage
      });
    }

    if (!caller.isSuperAdmin) return res.status(403).json({ ok: false, error: 'Super Admin access is required to change AI page limits.' });
    const body = await readBody(req);
    const restaurantId = clean(body.restaurantId);
    if (!restaurantId) return res.status(400).json({ ok: false, error: 'restaurantId is required.' });
    const invoicePagesLimit = Number.parseInt(body.invoicePagesLimit, 10);
    const menuPagesLimit = Number.parseInt(body.menuPagesLimit, 10);
    if (!Number.isInteger(invoicePagesLimit) || invoicePagesLimit < 0 || invoicePagesLimit > 10000) {
      return res.status(400).json({ ok: false, error: 'invoicePagesLimit must be between 0 and 10000.' });
    }
    if (!Number.isInteger(menuPagesLimit) || menuPagesLimit < 0 || menuPagesLimit > 10000) {
      return res.status(400).json({ ok: false, error: 'menuPagesLimit must be between 0 and 10000.' });
    }
    const usage = await updateAiUsageLimits({ db: caller.db, restaurantId, monthKey, invoicePagesLimit, menuPagesLimit });
    await writeAudit(caller.db, {
      uid: auth.decoded.uid,
      userDocId: caller.userDocId,
      email: auth.decoded.email || '',
      user: caller.user,
      restaurantId
    }, 'AI_SCAN_LIMITS_UPDATED', restaurantId, `Invoice pages ${invoicePagesLimit}; menu pages ${menuPagesLimit}; month ${monthKey}.`, restaurantId);
    return res.status(200).json({ ok: true, usage });
  } catch (error) {
    const status = Number(error.statusCode) || (/authorization|token|login/i.test(error.message || '') ? 401 : 500);
    return res.status(status).json({ ok: false, error: error.message || 'AI usage request failed.' });
  }
};
