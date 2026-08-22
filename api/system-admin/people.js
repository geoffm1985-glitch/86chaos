const { admin, getAdminAppForRequest, authorize } = require('../_chaos-admin');
const {
  safePlatformUser,
  clean,
  platformUserIdentityKeys,
  workspaceMemberIdentityKeys,
  workspaceMemberIsActive,
  workspaceIdForMember
} = require('../system-admin-safe-rows.cjs');

function clampLimit(raw) {
  const parsed = Number(raw || 200);
  if (!Number.isFinite(parsed)) return 200;
  return Math.max(1, Math.min(Math.floor(parsed), 250));
}

async function loadCanonicalWorkspaceMemberIndex(db, { pageLimit = 250, maxPages = 80 } = {}) {
  const index = new Map();
  let cursor = '';
  let pages = 0;
  let scanned = 0;
  while (true) {
    pages += 1;
    if (pages > maxPages) throw new Error('Canonical workspaceMembers roster exceeded the safe pagination ceiling. Refusing to return an incomplete platform roster.');
    let q = db.collection('workspaceMembers')
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(pageLimit + 1);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    const docs = snap.docs || [];
    const pageDocs = docs.slice(0, pageLimit);
    scanned += pageDocs.length;
    for (const doc of pageDocs) {
      const data = doc.data() || {};
      if (!workspaceMemberIsActive(data)) continue;
      const workspaceId = workspaceIdForMember(data, doc.id);
      if (!workspaceId) continue;
      for (const key of workspaceMemberIdentityKeys(data, doc.id)) {
        if (!index.has(key)) index.set(key, new Set());
        index.get(key).add(workspaceId);
      }
    }
    if (docs.length <= pageLimit) break;
    const nextCursor = pageDocs[pageDocs.length - 1]?.id || '';
    if (!nextCursor || nextCursor === cursor) throw new Error('Canonical workspaceMembers pagination failed closed before returning an incomplete roster.');
    cursor = nextCursor;
  }
  return { index, pages, scanned };
}

function canonicalWorkspaceIdsForUser(userDoc, membershipIndex) {
  const data = userDoc.data() || {};
  const out = new Set();
  for (const key of platformUserIdentityKeys(data, userDoc.id)) {
    const matches = membershipIndex.get(key);
    if (!matches) continue;
    for (const workspaceId of matches) out.add(workspaceId);
  }
  return [...out];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  try {
    const app = getAdminAppForRequest(req);
    const ctx = await authorize(req, app, { allowTenantAdmin: false, allowCrossProjectMaster: true });
  if (!ctx.ok || ctx.isSuperAdmin !== true) {
    return res.status(ctx.status || 403).json({ ok: false, code: 'system-admin-required', error: ctx.error || 'System Administrator access is required.' });
  }
  const db = ctx.db || app.firestore();
  const limit = clampLimit(req.query?.limit);
  const cursor = clean(req.query?.cursor || '');
  let q = db.collection('users')
    .orderBy(admin.firestore.FieldPath.documentId())
    .limit(limit + 1);
  if (cursor) q = q.startAfter(cursor);
  const [snap, canonicalMemberships] = await Promise.all([
    q.get(),
    loadCanonicalWorkspaceMemberIndex(db)
  ]);
  const docs = snap.docs || [];
  const pageDocs = docs.slice(0, limit);
  const hasMore = docs.length > limit;
  const users = pageDocs.map(doc => safePlatformUser(doc, canonicalWorkspaceIdsForUser(doc, canonicalMemberships.index)));
  const nextCursor = hasMore && pageDocs.length ? pageDocs[pageDocs.length - 1].id : '';
  return res.status(200).json({
    ok: true,
    source: 'server',
    projectId: (ctx.app || app).options?.projectId || '',
    count: users.length,
    users,
    hasMore,
    nextCursor,
    membershipSource: 'workspaceMembers',
    membershipPages: canonicalMemberships.pages,
    membershipRowsScanned: canonicalMemberships.scanned,
    fetchedAt: new Date().toISOString()
  });
  } catch (error) {
    console.error('system-admin people failed:', error?.message || error);
    return res.status(500).json({ ok: false, code: 'system-admin-people-failed', error: 'Could not load people.' });
  }
};
module.exports.safePlatformUser = safePlatformUser;
module.exports.loadCanonicalWorkspaceMemberIndex = loadCanonicalWorkspaceMemberIndex;
module.exports.canonicalWorkspaceIdsForUser = canonicalWorkspaceIdsForUser;
