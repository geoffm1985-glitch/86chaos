'use strict';

const { admin, getAdminAppForRequest, readBody, requireAppCheckIfEnforced, readWorkspaceMember, userHasWorkspace, profileForWorkspace, masterEmails, norm, clean } = require('./_chaos-admin');
const { decidePlatformAdminAuthority } = require('./_platform-admin-authority.cjs');
const { enforceRateLimit, sendRateLimited } = require('./_rate-limit');

const ACTIVE_CONFLICT_STATUSES = new Set(['pending', 'approved']);
const TERMINAL_CONFLICT_STATUSES = new Set(['denied', 'rejected', 'cancelled', 'canceled', 'archived', 'processed', 'completed']);
const MAX_CONFLICT_DATES = 14;

function bearer(req = {}) {
  return String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
}

function cleanString(value = '', max = 400) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function safeDate(value = '') {
  const text = cleanString(value, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  const d = new Date(`${text}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  const [y, m, day] = text.split('-').map(Number);
  if (d.getUTCFullYear() !== y || d.getUTCMonth() + 1 !== m || d.getUTCDate() !== day) return '';
  return text;
}

function parseDateList(body = {}) {
  const raw = Array.isArray(body.dates) ? body.dates : [body.date];
  const dates = [...new Set(raw.map(safeDate).filter(Boolean))];
  if (dates.length === 0) throw Object.assign(new Error('Choose a valid Request Off date.'), { status: 400, code: 'invalid-date' });
  if (dates.length > MAX_CONFLICT_DATES) throw Object.assign(new Error('Too many Request Off dates were checked at once.'), { status: 400, code: 'too-many-dates' });
  return dates;
}

function normalizeStatus(value = '') {
  return cleanString(value || 'pending', 40).toLowerCase();
}

function isActiveConflictRequest(request = {}) {
  if (request.archived === true || request.processed === true) return false;
  const status = normalizeStatus(request.status);
  if (TERMINAL_CONFLICT_STATUSES.has(status)) return false;
  return ACTIVE_CONFLICT_STATUSES.has(status || 'pending');
}

function identityValue(value = '') {
  return cleanString(value, 220).toLowerCase();
}

function collectIdentityAliases(...records) {
  const fields = [
    'id', 'uid', 'authUid', 'userId', 'accountUserId', 'employeeId', 'rosterUserId', 'scheduleUserId',
    'membershipId', 'workspaceMemberId', 'createdBy', 'requestedBy'
  ];
  const aliases = new Set();
  for (const record of records.filter(Boolean)) {
    for (const field of fields) {
      const value = identityValue(record?.[field]);
      if (value) aliases.add(value);
    }
  }
  return aliases;
}

function collectEmailAliases(...records) {
  const fields = ['email', 'emailLower', 'employeeEmail', 'userEmail', 'assignedEmail', 'authEmail'];
  const aliases = new Set();
  for (const record of records.filter(Boolean)) {
    for (const field of fields) {
      const value = identityValue(record?.[field]).replace(/^mailto:/, '');
      if (value && value.includes('@')) aliases.add(value);
    }
  }
  return aliases;
}

function requestBelongsToIdentity(request = {}, identity = {}) {
  const ids = collectIdentityAliases(identity, identity.member, identity.user);
  const emails = collectEmailAliases(identity, identity.member, identity.user);
  const requestIds = collectIdentityAliases(request);
  const requestEmails = collectEmailAliases(request);
  for (const id of requestIds) if (ids.has(id)) return true;
  for (const email of requestEmails) if (emails.has(email)) return true;
  return false;
}

function requestPersonKey(request = {}) {
  const personFields = ['authUid', 'uid', 'userId', 'accountUserId', 'employeeId', 'rosterUserId', 'scheduleUserId', 'membershipId', 'workspaceMemberId', 'createdBy', 'requestedBy'];
  for (const field of personFields) {
    const value = identityValue(request?.[field]);
    if (value) return `id:${value}`;
  }
  const emails = collectEmailAliases(request);
  const firstEmail = [...emails].find(Boolean);
  if (firstEmail) return `email:${firstEmail}`;
  const name = cleanString(request.userName || request.employeeName || request.name || '', 120).toLowerCase();
  return name ? `name:${name}` : '';
}

function safeDisplayName(record = {}) {
  const raw = cleanString(record.employeeName || record.userName || record.name || record.displayName || record.assignedName || '', 80);
  if (raw) return raw;
  const email = cleanString(record.employeeEmail || record.userEmail || record.email || '', 120);
  if (!email) return 'Another employee';
  return email.split('@')[0] || 'Another employee';
}

function memberDocId(uid, restaurantId) {
  return `${cleanString(uid).replace(/[^A-Za-z0-9_-]/g, '_')}_${cleanString(restaurantId).replace(/[^A-Za-z0-9_-]/g, '_')}`.slice(0, 240);
}

async function getUserByUidOrEmail(db, uid = '', email = '') {
  let userDocId = cleanString(uid, 180);
  let snap = userDocId ? await db.collection('users').doc(userDocId).get() : null;
  if (snap?.exists) return { id: snap.id, ...(snap.data() || {}) };
  const cleanEmail = norm(email || '');
  if (cleanEmail) {
    const byEmail = await db.collection('users').where('email', '==', cleanEmail).limit(1).get();
    if (!byEmail.empty) return { id: byEmail.docs[0].id, ...(byEmail.docs[0].data() || {}) };
  }
  return { id: userDocId, email: cleanEmail };
}

function userActive(user = {}) {
  return Boolean(user && typeof user === 'object' && Object.keys(user).length > 0 && user.isActive !== false && user.disabled !== true && user.accountDisabled !== true && user.deleted !== true && user.archived !== true);
}

function memberActive(member = {}) {
  return Boolean(member && typeof member === 'object' && Object.keys(member).length > 0 && member.isActive !== false && member.disabled !== true && member.archived !== true && member.deleted !== true);
}

function callerHasWorkspaceAccess(user = {}, member = null, restaurantId = '', isSystemAdmin = false) {
  return Boolean(isSystemAdmin || (userActive(user) && (userHasWorkspace(user, restaurantId) || memberActive(member))));
}

async function loadCallerContext(app, req, body = {}) {
  const token = bearer(req);
  if (!token) throw Object.assign(new Error('Authentication is required.'), { status: 401, code: 'missing-token' });
  const decoded = await app.auth().verifyIdToken(token);
  const db = app.firestore();
  const restaurantId = cleanString(body.restaurantId || '', 180);
  if (!restaurantId) throw Object.assign(new Error('Workspace is required.'), { status: 400, code: 'missing-workspace' });
  const email = norm(decoded.email || '');
  const user = await getUserByUidOrEmail(db, decoded.uid, email);
  const member = await readWorkspaceMember(db, decoded.uid, email || user.email || '', restaurantId);
  const workspaceProfile = profileForWorkspace({ ...(user || {}), id: user.id || decoded.uid }, member, restaurantId) || user || {};
  const platformAuthority = decidePlatformAdminAuthority({ decoded, profile: user || {}, masterEmails: masterEmails(), protectedRootEmails: masterEmails() });
  const isSystemAdmin = platformAuthority.superAdmin === true;
  if (!callerHasWorkspaceAccess(user, member, restaurantId, isSystemAdmin)) {
    throw Object.assign(new Error('You do not have active access to this workspace.'), { status: 403, code: 'no-workspace-access' });
  }
  return { app, db, decoded, uid: decoded.uid, email, user, userDocId: user.id || decoded.uid, member, restaurantId, workspaceProfile, isSystemAdmin, platformAuthority };
}

async function findMembershipByTarget(db, restaurantId, targetId = '', targetEmail = '') {
  const cleanTarget = cleanString(targetId, 180);
  const cleanEmail = norm(targetEmail || '');
  const directIds = [cleanTarget, cleanTarget ? memberDocId(cleanTarget, restaurantId) : ''].filter(Boolean);
  for (const id of directIds) {
    const snap = await db.collection('workspaceMembers').doc(id).get();
    if (snap.exists) {
      const data = snap.data() || {};
      if (String(data.restaurantId || '') === restaurantId) return { id: snap.id, ...data };
    }
  }
  const fields = ['userId', 'uid', 'authUid', 'employeeId', 'rosterUserId', 'scheduleUserId'];
  for (const field of fields) {
    if (!cleanTarget) continue;
    const snap = await db.collection('workspaceMembers').where('restaurantId', '==', restaurantId).where(field, '==', cleanTarget).limit(2).get();
    if (!snap.empty) return { id: snap.docs[0].id, ...(snap.docs[0].data() || {}) };
  }
  if (cleanEmail) {
    const byEmail = await db.collection('workspaceMembers').where('restaurantId', '==', restaurantId).where('email', '==', cleanEmail).limit(2).get();
    if (!byEmail.empty) return { id: byEmail.docs[0].id, ...(byEmail.docs[0].data() || {}) };
  }
  return null;
}

async function findUserByTarget(db, targetId = '', targetEmail = '') {
  const cleanTarget = cleanString(targetId, 180);
  const cleanEmail = norm(targetEmail || '');
  if (cleanTarget) {
    const snap = await db.collection('users').doc(cleanTarget).get();
    if (snap.exists) return { id: snap.id, ...(snap.data() || {}) };
    for (const field of ['uid', 'authUid', 'userId', 'accountUserId']) {
      const byField = await db.collection('users').where(field, '==', cleanTarget).limit(2).get();
      if (!byField.empty) return { id: byField.docs[0].id, ...(byField.docs[0].data() || {}) };
    }
  }
  if (cleanEmail) {
    const byEmail = await db.collection('users').where('email', '==', cleanEmail).limit(2).get();
    if (!byEmail.empty) return { id: byEmail.docs[0].id, ...(byEmail.docs[0].data() || {}) };
  }
  return null;
}

function activeEmbeddedMembership(user = {}, restaurantId = '') {
  const member = user?.memberships?.[restaurantId];
  return member && typeof member === 'object' && member.isActive !== false && member.disabled !== true && member.archived !== true && member.deleted !== true ? member : null;
}

function targetHasWorkspaceEvidence(user = {}, member = null, restaurantId = '') {
  if (member && memberActive(member) && String(member.restaurantId || '') === restaurantId) return true;
  if (!userActive(user || {})) return false;
  return Boolean(
    user?.restaurantId === restaurantId ||
    (Array.isArray(user?.workspaceIds) && user.workspaceIds.includes(restaurantId)) ||
    activeEmbeddedMembership(user, restaurantId)
  );
}

function effectiveTargetMember(user = {}, member = null, restaurantId = '') {
  if (member && memberActive(member) && String(member.restaurantId || restaurantId) === restaurantId) return member;
  const embedded = activeEmbeddedMembership(user, restaurantId) || {};
  if (!targetHasWorkspaceEvidence(user, member, restaurantId)) return null;
  return {
    ...embedded,
    id: embedded.id || embedded.membershipId || user.workspaceMemberId || user.membershipId || '',
    restaurantId,
    isActive: true,
    uid: embedded.uid || user.authUid || user.uid || '',
    authUid: embedded.authUid || user.authUid || user.uid || '',
    userId: embedded.userId || user.userId || user.id || '',
    accountUserId: embedded.accountUserId || user.accountUserId || user.id || '',
    employeeId: embedded.employeeId || user.employeeId || '',
    rosterUserId: embedded.rosterUserId || user.rosterUserId || '',
    scheduleUserId: embedded.scheduleUserId || user.scheduleUserId || '',
    email: embedded.email || user.email || user.employeeEmail || '',
    employeeEmail: embedded.employeeEmail || embedded.email || user.employeeEmail || user.email || '',
    name: embedded.name || embedded.employeeName || user.name || user.displayName || user.email || '',
    employeeName: embedded.employeeName || embedded.name || user.employeeName || user.name || user.displayName || ''
  };
}

async function authUserExists(ctx, uid = '') {
  const candidate = cleanString(uid, 180);
  if (!candidate || !ctx?.app?.auth) return false;
  try {
    const authApi = ctx.app.auth();
    if (!authApi || typeof authApi.getUser !== 'function') return false;
    await authApi.getUser(candidate);
    return true;
  } catch (_) { return false; }
}

async function resolveTargetAuthUid(ctx, targetUser = {}, targetMember = {}) {
  const trusted = [targetMember.authUid, targetUser.authUid, targetMember.uid, targetUser.uid, targetMember.firebaseUid, targetUser.firebaseUid]
    .map(value => cleanString(value, 180)).filter(Boolean);
  if (trusted.length) return trusted[0];
  for (const candidate of [targetUser.id, targetMember.userId, targetUser.userId, targetUser.accountUserId]) {
    const value = cleanString(candidate, 180);
    if (value && await authUserExists(ctx, value)) return value;
  }
  const email = norm(targetMember.employeeEmail || targetMember.email || targetUser.employeeEmail || targetUser.email || '');
  if (email && ctx?.app?.auth) {
    try {
      const authApi = ctx.app.auth();
      if (authApi && typeof authApi.getUserByEmail === 'function') {
        const authUser = await authApi.getUserByEmail(email);
        if (authUser?.uid) return cleanString(authUser.uid, 180);
      }
    } catch (_) {}
  }
  for (const candidate of [targetMember.accountAuthUid, targetUser.accountAuthUid, targetMember.authUserId, targetUser.authUserId]) {
    const value = cleanString(candidate, 180);
    if (value) return value;
  }
  throw Object.assign(new Error('Target employee Firebase Auth UID could not be resolved.'), { status: 409, code: 'target-auth-uid-unresolved' });
}

function buildTargetIdentity(targetUser = {}, targetMember = {}, restaurantId = '', provenAuthUid = '') {
  const authUid = cleanString(provenAuthUid || targetMember.authUid || targetMember.uid || targetUser.authUid || targetUser.uid || '', 180);
  const accountUserId = cleanString(targetMember.accountUserId || targetMember.userId || targetUser.id || targetUser.userId || authUid, 180);
  const scheduleUserId = cleanString(targetMember.scheduleUserId || targetMember.employeeId || targetMember.rosterUserId || targetMember.id || targetUser.scheduleUserId || targetUser.employeeId || targetUser.rosterUserId || accountUserId || authUid, 180);
  const employeeId = cleanString(targetMember.employeeId || targetUser.employeeId || scheduleUserId || authUid, 180);
  const rosterUserId = cleanString(targetMember.rosterUserId || targetMember.id || targetUser.rosterUserId || employeeId || scheduleUserId, 180);
  const email = norm(targetMember.employeeEmail || targetMember.email || targetUser.employeeEmail || targetUser.email || '');
  const name = cleanString(targetMember.employeeName || targetMember.name || targetUser.employeeName || targetUser.name || targetUser.displayName || email || 'Employee', 140);
  return {
    restaurantId,
    id: targetUser.id || accountUserId || authUid || targetMember.id || '',
    user: targetUser,
    member: targetMember,
    authUid,
    uid: authUid,
    userId: authUid || accountUserId,
    accountUserId,
    employeeId: authUid || employeeId,
    rosterUserId,
    scheduleUserId,
    membershipId: targetMember.id || '',
    workspaceMemberId: targetMember.id || '',
    email,
    employeeEmail: email,
    userEmail: email,
    name,
    employeeName: name,
    userName: name,
    displayName: name
  };
}

async function resolveTargetIdentity(ctx, body = {}) {
  const targetId = cleanString(body.targetUserId || body.ghostTargetUserId || body.impersonatedUserId || body.userId || '', 180);
  const targetEmail = norm(body.targetEmail || body.ghostTargetUserEmail || '');
  if (!targetId && !targetEmail) throw Object.assign(new Error('Ghost Mode target is required.'), { status: 400, code: 'missing-target' });
  const [targetUser, targetMember] = await Promise.all([
    findUserByTarget(ctx.db, targetId, targetEmail),
    findMembershipByTarget(ctx.db, ctx.restaurantId, targetId, targetEmail)
  ]);
  const finalUser = targetUser || (targetMember ? await findUserByTarget(ctx.db, targetMember.userId || targetMember.uid || targetMember.authUid || '', targetMember.email || '') : null);
  const fallbackMember = targetMember || (finalUser ? await readWorkspaceMember(ctx.db, finalUser.authUid || finalUser.uid || finalUser.id, finalUser.email || '', ctx.restaurantId) : null);
  const finalMember = effectiveTargetMember(finalUser || {}, fallbackMember, ctx.restaurantId);
  if (!finalUser) throw Object.assign(new Error('Target employee was not found.'), { status: 404, code: 'missing-target' });
  if (!targetHasWorkspaceEvidence(finalUser || {}, finalMember, ctx.restaurantId)) throw Object.assign(new Error('Target employee is not an active member of this workspace.'), { status: 403, code: 'inactive-target' });
  if (!userActive(finalUser || {})) throw Object.assign(new Error('Target employee account is inactive.'), { status: 403, code: 'inactive-target-account' });
  const authUid = await resolveTargetAuthUid(ctx, finalUser || {}, finalMember || {});
  return buildTargetIdentity(finalUser || {}, finalMember || {}, ctx.restaurantId, authUid);
}

function callerIdentity(ctx) {
  return buildTargetIdentity(ctx.user || {}, ctx.member || {}, ctx.restaurantId, ctx.uid || ctx.decoded?.uid || '');
}

async function resolveRequestingIdentity(ctx, body = {}) {
  const hasGhostTarget = Boolean(body.targetUserId || body.ghostTargetUserId || body.impersonatedUserId || body.targetEmail || body.ghostTargetUserEmail);
  if (hasGhostTarget) {
    if (!ctx.isSystemAdmin) throw Object.assign(new Error('System Administrator authority is required for Ghost Mode Request Off.'), { status: 403, code: 'ghost-admin-required' });
    return resolveTargetIdentity(ctx, body);
  }
  return callerIdentity(ctx);
}

function summarizeConflictRows(rows = [], requestingIdentity = {}) {
  const people = new Map();
  for (const row of rows) {
    if (!isActiveConflictRequest(row)) continue;
    if (requestBelongsToIdentity(row, requestingIdentity)) continue;
    const key = requestPersonKey(row);
    if (!key) continue;
    if (!people.has(key)) people.set(key, safeDisplayName(row));
  }
  const names = [...people.values()].slice(0, 8);
  return { hasConflict: people.size > 0, count: people.size, names };
}

async function listRequestsByDates(db, restaurantId, dates = []) {
  const rows = [];
  for (const date of dates) {
    const snap = await db.collection('timeOffRequests').where('restaurantId', '==', restaurantId).where('date', '==', date).limit(80).get();
    snap.forEach(doc => rows.push({ id: doc.id, ...(doc.data() || {}) }));
  }
  return rows;
}

async function handleConflicts(ctx, body) {
  const dates = parseDateList(body);
  const requestingIdentity = await resolveRequestingIdentity(ctx, body);
  const rows = await listRequestsByDates(ctx.db, ctx.restaurantId, dates);
  const conflicts = dates.map(date => ({
    date,
    ...summarizeConflictRows(rows.filter(row => row.date === date), requestingIdentity)
  }));
  return { ok: true, action: 'conflicts', restaurantId: ctx.restaurantId, conflicts };
}

function publicRequestShape(row = {}) {
  return {
    id: cleanString(row.id || '', 180),
    restaurantId: cleanString(row.restaurantId || row.workspaceId || '', 180),
    workspaceId: cleanString(row.workspaceId || row.restaurantId || '', 180),
    userId: cleanString(row.userId || '', 180),
    employeeId: cleanString(row.employeeId || '', 180),
    rosterUserId: cleanString(row.rosterUserId || '', 180),
    scheduleUserId: cleanString(row.scheduleUserId || '', 180),
    authUid: cleanString(row.authUid || '', 180),
    userName: safeDisplayName(row),
    employeeName: safeDisplayName(row),
    date: safeDate(row.date || '') || cleanString(row.date || '', 20),
    isPartial: row.isPartial === true,
    startTime: cleanString(row.startTime || '', 20),
    endTime: cleanString(row.endTime || '', 20),
    status: cleanString(row.status || 'pending', 40),
    archived: row.archived === true,
    processed: row.processed === true,
    requestedAt: cleanString(row.requestedAt || row.submittedAt || row.createdAt || row.requestTimestamp || '', 80),
    submittedAt: cleanString(row.submittedAt || row.requestedAt || row.createdAt || '', 80),
    createdAt: cleanString(row.createdAt || '', 80),
    updatedAt: cleanString(row.updatedAt || '', 80),
    requestedByName: cleanString(row.requestedByName || row.userName || row.employeeName || '', 120),
    previousStatus: cleanString(row.previousStatus || '', 40),
    approvedAt: cleanString(row.approvedAt || '', 80),
    approvedByName: cleanString(row.approvedByName || '', 120),
    deniedAt: cleanString(row.deniedAt || '', 80),
    deniedByName: cleanString(row.deniedByName || '', 120),
    cancelledAt: cleanString(row.cancelledAt || row.canceledAt || '', 80),
    archivedAt: cleanString(row.archivedAt || '', 80),
    publishedAt: cleanString(row.publishedAt || '', 80),
    publishedByName: cleanString(row.publishedByName || '', 120),
    scheduleId: cleanString(row.scheduleId || '', 180),
    unresolvedPublishedOverlap: row.unresolvedPublishedOverlap === true,
    overlapsPublishedSchedule: row.overlapsPublishedSchedule === true,
    source: cleanString(row.source || '', 80),
    submittedViaGhostMode: row.submittedViaGhostMode === true
  };
}

async function listTargetRequests(ctx, targetIdentity) {
  const snap = await ctx.db.collection('timeOffRequests').where('restaurantId', '==', ctx.restaurantId).where('userId', '==', targetIdentity.authUid || targetIdentity.userId).limit(120).get();
  const rows = [];
  snap.forEach(doc => {
    const row = { id: doc.id, ...(doc.data() || {}) };
    if (requestBelongsToIdentity(row, targetIdentity)) rows.push(publicRequestShape(row));
  });
  rows.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  return rows;
}

async function handleGhostList(ctx, body) {
  if (!ctx.isSystemAdmin) throw Object.assign(new Error('System Administrator authority is required for Ghost Mode Request Off.'), { status: 403, code: 'ghost-admin-required' });
  const targetIdentity = await resolveTargetIdentity(ctx, body);
  const requests = await listTargetRequests(ctx, targetIdentity);
  return { ok: true, action: 'ghost-list', restaurantId: ctx.restaurantId, target: { userId: targetIdentity.authUid || targetIdentity.userId, scheduleUserId: targetIdentity.scheduleUserId, displayName: targetIdentity.name }, requests };
}

function buildRequestPayload(ctx, target, date, body = {}) {
  const nowIso = new Date().toISOString();
  const isPartial = body.isPartial === true;
  return {
    restaurantId: ctx.restaurantId,
    workspaceId: ctx.restaurantId,
    userId: target.authUid || target.userId,
    employeeId: target.authUid || target.employeeId || target.userId,
    authUid: target.authUid || target.userId,
    accountUserId: target.accountUserId || target.userId,
    rosterUserId: target.rosterUserId || '',
    scheduleUserId: target.scheduleUserId || target.employeeId || target.userId,
    userEmail: target.email || '',
    employeeEmail: target.employeeEmail || target.email || '',
    userName: target.name || 'Employee',
    employeeName: target.employeeName || target.name || 'Employee',
    date,
    isPartial,
    startTime: isPartial ? cleanString(body.startTime || '', 20) : '',
    endTime: isPartial ? cleanString(body.endTime || '', 20) : '',
    status: 'pending',
    archived: false,
    processed: false,
    requestedAt: nowIso,
    requestedAtMs: Date.now(),
    requestTimestamp: nowIso,
    submittedAt: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
    createdBy: target.authUid || target.userId,
    requestedBy: target.authUid || target.userId,
    requestedByName: target.name || 'Employee',
    source: 'ghost_time_off_request',
    submittedViaGhostMode: true,
    ghostRealUserId: ctx.uid,
    ghostRealUserName: cleanString(ctx.workspaceProfile?.name || ctx.user?.name || ctx.email || 'System Administrator', 140),
    ghostTargetUserId: target.authUid || target.userId,
    ghostTargetUserName: target.name || 'Employee',
    submittedByAdminUid: ctx.uid,
    ghostSubmittedAt: nowIso
  };
}

async function writeGhostAudit(ctx, action, target, details = {}) {
  try {
    await ctx.db.collection('auditLogs').add({
      restaurantId: ctx.restaurantId,
      action,
      target: cleanString(target?.name || target?.employeeName || target?.userId || 'Request Off', 200),
      details: JSON.stringify({
        dates: details.dates || [],
        requestId: details.requestId || '',
        ghostMode: true,
        source: 'ghost_time_off_request'
      }),
      userId: ctx.uid,
      userName: `${cleanString(ctx.workspaceProfile?.name || ctx.user?.name || ctx.email || 'System Administrator', 160)} (Ghost as ${cleanString(target?.name || 'Employee', 120)})`,
      userEmail: cleanString(ctx.email || '', 160),
      ghostTargetUserId: target.authUid || target.userId || '',
      ghostTargetUserName: target.name || target.employeeName || '',
      ghostRealUserId: ctx.uid,
      ghostRealUserName: cleanString(ctx.workspaceProfile?.name || ctx.user?.name || ctx.email || 'System Administrator', 160),
      ghostWorkspaceId: ctx.restaurantId,
      isGhost: true,
      timestamp: new Date().toISOString(),
      serverTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      source: 'api/time-off-request'
    });
  } catch (_) {}
}

async function handleGhostCreate(ctx, body) {
  if (!ctx.isSystemAdmin) throw Object.assign(new Error('System Administrator authority is required for Ghost Mode Request Off.'), { status: 403, code: 'ghost-admin-required' });
  const target = await resolveTargetIdentity(ctx, body);
  const dates = parseDateList(body);
  const refs = [];
  for (const date of dates) {
    const payload = buildRequestPayload(ctx, target, date, body);
    const ref = await ctx.db.collection('timeOffRequests').add(payload);
    refs.push(ref.id);
  }
  await writeGhostAudit(ctx, 'GHOST_TIME_OFF_SUBMITTED', target, { dates, requestId: refs.join(',') });
  return { ok: true, action: 'ghost-create', requestIds: refs, created: refs.length };
}

async function handleGhostCancel(ctx, body) {
  if (!ctx.isSystemAdmin) throw Object.assign(new Error('System Administrator authority is required for Ghost Mode Request Off.'), { status: 403, code: 'ghost-admin-required' });
  const requestId = cleanString(body.requestId || body.id || '', 180);
  if (!requestId) throw Object.assign(new Error('Request Off entry is required.'), { status: 400, code: 'missing-request' });
  const target = await resolveTargetIdentity(ctx, body);
  const ref = ctx.db.collection('timeOffRequests').doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error('Request Off entry was not found.'), { status: 404, code: 'not-found' });
  const request = { id: snap.id, ...(snap.data() || {}) };
  if (String(request.restaurantId || request.workspaceId || '') !== ctx.restaurantId) throw Object.assign(new Error('Request Off entry belongs to another workspace.'), { status: 403, code: 'cross-workspace-request' });
  if (!requestBelongsToIdentity(request, target)) throw Object.assign(new Error('Target employee does not own this Request Off entry.'), { status: 403, code: 'not-target-request' });
  const status = normalizeStatus(request.status);
  if (!['pending', 'approved'].includes(status) || request.archived === true) throw Object.assign(new Error('Only active Request Off entries can be canceled here.'), { status: 409, code: 'not-cancellable' });
  const nowIso = new Date().toISOString();
  await ref.update({
    previousStatus: request.status || 'pending',
    status: 'cancelled',
    archived: true,
    cancelledAt: nowIso,
    cancelledBy: target.authUid || target.userId,
    updatedAt: nowIso,
    updatedBy: target.authUid || target.userId,
    cancelledViaGhostMode: true,
    ghostRealUserId: ctx.uid,
    ghostRealUserName: cleanString(ctx.workspaceProfile?.name || ctx.user?.name || ctx.email || 'System Administrator', 140),
    ghostTargetUserId: target.authUid || target.userId,
    ghostTargetUserName: target.name || 'Employee',
    submittedByAdminUid: ctx.uid,
    source: request.source || 'time_off_request'
  });
  await writeGhostAudit(ctx, 'GHOST_TIME_OFF_CANCELLED', target, { dates: [request.date || ''], requestId });
  return { ok: true, action: 'ghost-cancel', requestId };
}

async function routeAction(ctx, body = {}) {
  const action = cleanString(body.action || 'conflicts', 40).toLowerCase();
  if (action === 'conflicts') return handleConflicts(ctx, body);
  if (action === 'ghost-list') return handleGhostList(ctx, body);
  if (action === 'ghost-create') return handleGhostCreate(ctx, body);
  if (action === 'ghost-cancel') return handleGhostCancel(ctx, body);
  throw Object.assign(new Error('Unknown Request Off action.'), { status: 400, code: 'unknown-action' });
}

function safeError(err) {
  return cleanString(err?.message || err || 'Request Off action failed.', 240).replace(/(token|secret|private[_ -]?key|authorization)[=:]\s*[^\s,;}]+/gi, '$1=[redacted]');
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  let app;
  try {
    app = getAdminAppForRequest(req);
    const appCheck = await requireAppCheckIfEnforced(app, req);
    if (!appCheck.ok) return res.status(appCheck.status || 401).json({ ok: false, error: appCheck.error });
    const body = await readBody(req);
    const ctx = await loadCallerContext(app, req, body);
    const rate = await enforceRateLimit({ db: ctx.db, req, decoded: ctx.decoded, routeName: 'time-off-request', limit: Number(process.env.TIME_OFF_REQUEST_RATE_LIMIT || 80), windowMs: 60 * 1000 });
    if (!rate.ok) return sendRateLimited(res, rate);
    const result = await routeAction(ctx, body);
    return res.status(200).json(result);
  } catch (err) {
    const status = Number(err?.status || 500);
    const body = { ok: false, error: safeError(err), code: cleanString(err?.code || 'time-off-request-failed', 80) };
    return res.status(status >= 400 && status < 600 ? status : 500).json(body);
  }
}

module.exports = handler;
module.exports._test = {
  ACTIVE_CONFLICT_STATUSES,
  TERMINAL_CONFLICT_STATUSES,
  safeDate,
  parseDateList,
  isActiveConflictRequest,
  collectIdentityAliases,
  collectEmailAliases,
  requestBelongsToIdentity,
  summarizeConflictRows,
  publicRequestShape,
  activeEmbeddedMembership,
  userActive,
  memberActive,
  targetHasWorkspaceEvidence,
  effectiveTargetMember,
  resolveTargetAuthUid,
  resolveTargetIdentity,
  loadCallerContext,
  buildTargetIdentity,
  buildRequestPayload,
  routeAction
};
