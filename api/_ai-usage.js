const crypto = require('crypto');
const { PDFDocument } = require('pdf-lib');
const admin = require('firebase-admin');
const { norm, masterEmails, readWorkspaceMember, userHasWorkspace, profileForWorkspace } = require('./_chaos-admin');
const { assertPlanAllowsScan, isInternalTestingUser } = require('./_plan-access');

const DEFAULT_INVOICE_PAGE_LIMIT = 40;
const DEFAULT_MENU_PAGE_LIMIT = 10;
const VALID_SCAN_TYPES = new Set(['invoice', 'menu']);

function clean(value = '') {
  return String(value == null ? '' : value).trim();
}

function normEmail(value = '') {
  return clean(value).toLowerCase();
}

function masterAdminEmails() {
  return Array.from(new Set(masterEmails().map(normEmail).filter(Boolean)));
}

function isMasterAdminScanExempt(decoded = {}) {
  const email = normEmail(decoded.email);
  const verifiedEmailMatch = Boolean(email && decoded.email_verified !== false && masterAdminEmails().includes(email));
  const customClaimMatch = decoded.aiScanLimitBypass === true || decoded.masterAdmin === true || decoded.isMasterAdmin === true;
  return verifiedEmailMatch || customClaimMatch;
}

function getMonthKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date for AI usage month.');
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function usageDocumentId(restaurantId, monthKey) {
  return `${clean(restaurantId)}_${clean(monthKey)}`;
}

function defaultLimitFor(scanType) {
  return scanType === 'menu' ? DEFAULT_MENU_PAGE_LIMIT : DEFAULT_INVOICE_PAGE_LIMIT;
}

function usedFieldFor(scanType) {
  return scanType === 'menu' ? 'menuPagesUsed' : 'invoicePagesUsed';
}

function limitFieldFor(scanType) {
  return scanType === 'menu' ? 'menuPagesLimit' : 'invoicePagesLimit';
}

function scansFieldFor(scanType) {
  return scanType === 'menu' ? 'menuScansSubmitted' : 'invoiceScansSubmitted';
}

function processedFieldFor(scanType) {
  return scanType === 'menu' ? 'menuPagesProcessed' : 'invoicePagesProcessed';
}

function bypassPagesFieldFor(scanType) {
  return scanType === 'menu' ? 'menuBypassPagesProcessed' : 'invoiceBypassPagesProcessed';
}

function normalizePositiveInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function createIdempotencyEventId({ restaurantId, monthKey, scanType, idempotencyKey, userId = '' }) {
  const raw = `${clean(restaurantId)}|${clean(monthKey)}|${clean(scanType)}|${clean(userId)}|${clean(idempotencyKey)}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 48);
}

function getIdempotencyKey(req, body = {}) {
  return clean(
    body.idempotencyKey ||
    req?.headers?.['x-idempotency-key'] ||
    req?.headers?.['X-Idempotency-Key']
  );
}

async function resolvePdfPageCount(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
    const error = new Error('The PDF could not be read safely. Upload the PDF again or review it before scanning.');
    error.code = 'AI_PDF_PAGE_COUNT_REQUIRED';
    throw error;
  }
  try {
    const pdf = await PDFDocument.load(buffer, {
      ignoreEncryption: false,
      updateMetadata: false,
      throwOnInvalidObject: true
    });
    const pages = pdf.getPageCount();
    if (!Number.isInteger(pages) || pages < 1 || pages > 500) throw new Error('Unsafe PDF page count.');
    return pages;
  } catch (cause) {
    const error = new Error('The PDF page count could not be verified safely. Split, repair, or re-export the PDF before scanning.');
    error.code = 'AI_PDF_PAGE_COUNT_REQUIRED';
    error.cause = cause;
    throw error;
  }
}

async function resolveScanPageCount({ mimeType = '', buffer = null, files = null } = {}) {
  if (Array.isArray(files) && files.length) {
    let total = 0;
    for (const file of files) {
      total += await resolveScanPageCount(file);
    }
    return total;
  }

  const type = clean(mimeType).toLowerCase().split(';')[0];
  if (type === 'application/pdf') return resolvePdfPageCount(buffer);
  if (type.startsWith('image/')) return 1;

  const error = new Error('AI scans must use a supported image or PDF file.');
  error.code = 'AI_UNSUPPORTED_SCAN_FILE';
  throw error;
}

function firestoreTimestampToIso(value) {
  if (!value) return '';
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return '';
}

function serializeEventDoc(doc) {
  const data = doc?.data ? doc.data() : (doc || {});
  return {
    id: doc?.id || data.id || '',
    ...data,
    createdAt: firestoreTimestampToIso(data.createdAt),
    completedAt: firestoreTimestampToIso(data.completedAt)
  };
}

function usageDefaults(restaurantId, monthKey) {
  return {
    restaurantId,
    monthKey,
    invoicePagesUsed: 0,
    invoicePagesLimit: DEFAULT_INVOICE_PAGE_LIMIT,
    menuPagesUsed: 0,
    menuPagesLimit: DEFAULT_MENU_PAGE_LIMIT,
    invoiceScansSubmitted: 0,
    menuScansSubmitted: 0,
    invoicePagesProcessed: 0,
    menuPagesProcessed: 0,
    invoiceBypassPagesProcessed: 0,
    menuBypassPagesProcessed: 0,
    exemptPagesProcessed: 0
  };
}

async function checkAndReserveAiScanPages({
  db,
  restaurantId,
  scanType,
  pageCount,
  decoded,
  idempotencyKey,
  provider = '',
  model = '',
  sourceRoute = '',
  planScanLimits = null
}) {
  const cleanRestaurantId = clean(restaurantId);
  const cleanScanType = clean(scanType).toLowerCase();
  const cleanIdempotencyKey = clean(idempotencyKey);
  const safePageCount = normalizePositiveInteger(pageCount, 0);
  if (!db || typeof db.runTransaction !== 'function') throw new Error('AI page enforcement requires a matching Firebase Admin credential for this environment.');
  if (!cleanRestaurantId) throw new Error('restaurantId is required for AI usage enforcement.');
  if (!VALID_SCAN_TYPES.has(cleanScanType)) throw new Error('scanType must be invoice or menu.');
  if (safePageCount < 1) throw new Error('AI scan pageCount must be at least 1.');
  if (!cleanIdempotencyKey || cleanIdempotencyKey.length < 12 || cleanIdempotencyKey.length > 180) {
    const error = new Error('A valid idempotency key is required for AI scans. Refresh the app and try again.');
    error.code = 'AI_IDEMPOTENCY_KEY_REQUIRED';
    throw error;
  }

  const monthKey = getMonthKey();
  const usageId = usageDocumentId(cleanRestaurantId, monthKey);
  const eventId = createIdempotencyEventId({ restaurantId: cleanRestaurantId, monthKey, scanType: cleanScanType, userId: decoded?.uid || decoded?.user_id || decoded?.sub || '', idempotencyKey: cleanIdempotencyKey });
  const usageRef = db.collection('aiUsage').doc(usageId);
  const eventRef = usageRef.collection('events').doc(eventId);
  const limitBypass = isMasterAdminScanExempt(decoded) || isInternalTestingUser(decoded);
  const bypassReason = limitBypass ? 'master_admin_testing' : '';
  const now = admin.firestore.FieldValue.serverTimestamp();

  return db.runTransaction(async transaction => {
    const [usageSnap, existingEventSnap] = await Promise.all([
      transaction.get(usageRef),
      transaction.get(eventRef)
    ]);

    if (existingEventSnap.exists) {
      const existing = existingEventSnap.data() || {};
      return {
        ok: existing.status !== 'blocked',
        duplicate: true,
        blocked: existing.status === 'blocked',
        eventId,
        usageId,
        monthKey,
        scanType: cleanScanType,
        pageCount: normalizePositiveInteger(existing.pageCount, safePageCount),
        usedBefore: normalizePositiveInteger(existing.usedBefore, 0),
        usedAfter: normalizePositiveInteger(existing.usedAfter, 0),
        used: normalizePositiveInteger(existing.usedAfter, 0),
        limit: normalizePositiveInteger(existing.limit, defaultLimitFor(cleanScanType)),
        remaining: Math.max(0, normalizePositiveInteger(existing.limit, defaultLimitFor(cleanScanType)) - normalizePositiveInteger(existing.usedAfter, 0)),
        status: existing.status || 'submitted',
        limitBypass: existing.limitBypass === true,
        bypassReason: existing.bypassReason || '',
        wouldHaveExceededLimit: existing.wouldHaveExceededLimit === true,
        processedBefore: normalizePositiveInteger(existing.processedBefore, normalizePositiveInteger(existing.usedBefore, 0)),
        processedAfter: normalizePositiveInteger(existing.processedAfter, normalizePositiveInteger(existing.usedAfter, 0)),
        bypassPagesAfter: normalizePositiveInteger(existing.bypassPagesAfter, 0),
        eventRef,
        usageRef
      };
    }

    const existingUsage = usageSnap.exists ? usageSnap.data() || {} : {};
    const base = { ...usageDefaults(cleanRestaurantId, monthKey), ...existingUsage };
    const usedField = usedFieldFor(cleanScanType);
    const limitField = limitFieldFor(cleanScanType);
    const scansField = scansFieldFor(cleanScanType);
    const processedField = processedFieldFor(cleanScanType);
    const bypassPagesField = bypassPagesFieldFor(cleanScanType);
    const usedBefore = normalizePositiveInteger(base[usedField], 0);
    const configuredPlanLimit = planScanLimits && Object.prototype.hasOwnProperty.call(planScanLimits, limitField)
      ? Number(planScanLimits[limitField])
      : null;
    const existingLimit = normalizePositiveInteger(base[limitField], defaultLimitFor(cleanScanType));
    const limit = limitBypass
      ? Number.MAX_SAFE_INTEGER
      : (Number.isFinite(configuredPlanLimit) && configuredPlanLimit >= 0 ? Math.floor(configuredPlanLimit) : existingLimit);
    const processedBefore = Math.max(normalizePositiveInteger(base[processedField], 0), usedBefore);
    const bypassPagesBefore = normalizePositiveInteger(base[bypassPagesField], 0);
    const wouldHaveExceededLimit = usedBefore + safePageCount > limit;
    const userEmail = clean(decoded?.email);
    const userId = clean(decoded?.uid || decoded?.user_id || decoded?.sub);

    const commonEvent = {
      restaurantId: cleanRestaurantId,
      monthKey,
      userId,
      userEmail,
      scanType: cleanScanType,
      pageCount: safePageCount,
      provider: clean(provider),
      model: clean(model),
      idempotencyKey: cleanIdempotencyKey,
      sourceRoute: clean(sourceRoute),
      limitBypass,
      bypassReason,
      wouldHaveExceededLimit,
      usedBefore,
      processedBefore,
      limit,
      createdAt: now
    };

    const usageWrite = {
      restaurantId: cleanRestaurantId,
      monthKey,
      invoicePagesUsed: normalizePositiveInteger(base.invoicePagesUsed, 0),
      invoicePagesLimit: normalizePositiveInteger(base.invoicePagesLimit, DEFAULT_INVOICE_PAGE_LIMIT),
      menuPagesUsed: normalizePositiveInteger(base.menuPagesUsed, 0),
      menuPagesLimit: normalizePositiveInteger(base.menuPagesLimit, DEFAULT_MENU_PAGE_LIMIT),
      invoiceScansSubmitted: normalizePositiveInteger(base.invoiceScansSubmitted, 0),
      menuScansSubmitted: normalizePositiveInteger(base.menuScansSubmitted, 0),
      invoicePagesProcessed: Math.max(normalizePositiveInteger(base.invoicePagesProcessed, 0), normalizePositiveInteger(base.invoicePagesUsed, 0)),
      menuPagesProcessed: Math.max(normalizePositiveInteger(base.menuPagesProcessed, 0), normalizePositiveInteger(base.menuPagesUsed, 0)),
      invoiceBypassPagesProcessed: normalizePositiveInteger(base.invoiceBypassPagesProcessed, 0),
      menuBypassPagesProcessed: normalizePositiveInteger(base.menuBypassPagesProcessed, 0),
      exemptPagesProcessed: normalizePositiveInteger(base.exemptPagesProcessed, 0),
      updatedAt: now
    };
    if (!usageSnap.exists) usageWrite.createdAt = now;

    if (wouldHaveExceededLimit && !limitBypass) {
      transaction.set(usageRef, usageWrite, { merge: true });
      transaction.set(eventRef, {
        ...commonEvent,
        status: 'blocked',
        usedAfter: usedBefore,
        processedAfter: processedBefore,
        bypassPagesAfter: bypassPagesBefore,
        completedAt: now,
        errorMessage: `Monthly ${cleanScanType} scan page limit reached for the current 86 Chaos plan.`
      });
      return {
        ok: false,
        duplicate: false,
        blocked: true,
        eventId,
        usageId,
        monthKey,
        scanType: cleanScanType,
        pageCount: safePageCount,
        usedBefore,
        usedAfter: usedBefore,
        used: usedBefore,
        limit,
        remaining: Math.max(0, limit - usedBefore),
        status: 'blocked',
        limitBypass: false,
        bypassReason: '',
        wouldHaveExceededLimit: true,
        processedBefore,
        processedAfter: processedBefore,
        bypassPagesAfter: bypassPagesBefore,
        eventRef,
        usageRef
      };
    }

    const usedAfter = limitBypass ? usedBefore : usedBefore + safePageCount;
    const processedAfter = processedBefore + safePageCount;
    const bypassPagesAfter = bypassPagesBefore + (limitBypass ? safePageCount : 0);
    usageWrite[usedField] = usedAfter;
    usageWrite[processedField] = processedAfter;
    usageWrite[scansField] = normalizePositiveInteger(base[scansField], 0) + 1;
    if (limitBypass) {
      usageWrite.exemptPagesProcessed = normalizePositiveInteger(base.exemptPagesProcessed, 0) + safePageCount;
      usageWrite[bypassPagesField] = bypassPagesAfter;
    }

    transaction.set(usageRef, usageWrite, { merge: true });
    transaction.set(eventRef, {
      ...commonEvent,
      status: 'submitted',
      usedAfter,
      processedAfter,
      bypassPagesAfter
    });

    return {
      ok: true,
      duplicate: false,
      blocked: false,
      eventId,
      usageId,
      monthKey,
      scanType: cleanScanType,
      pageCount: safePageCount,
      usedBefore,
      usedAfter,
      used: usedAfter,
      limit,
      remaining: Math.max(0, limit - usedAfter),
      status: 'submitted',
      limitBypass,
      bypassReason,
      wouldHaveExceededLimit,
      processedBefore,
      processedAfter,
      bypassPagesAfter,
      eventRef,
      usageRef
    };
  });
}

function sanitizeErrorMessage(message = '') {
  return clean(message)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_API_KEY]')
    .replace(/-----BEGIN[\s\S]*?-----END[^-]+-----/g, '[REDACTED_PRIVATE_KEY]')
    .replace(/"(?:private_key|client_email|client_id|refresh_token)"\s*:\s*"[^"]+"/gi, '"[REDACTED_CREDENTIAL]"')
    .replace(/https:\/\/(?:firebasestorage\.googleapis\.com|storage\.googleapis\.com)\/[^\s"']+/gi, '[REDACTED_STORAGE_URL]')
    .replace(/https?:\/\/[^\s"']+[?&](?:X-Goog-Signature|token)=[^\s"']+/gi, '[REDACTED_SIGNED_URL]')
    .slice(0, 800);
}

async function completeAiScanUsageEvent({ db, reservation, status, errorMessage = '', estimatedInputTokens = null, estimatedOutputTokens = null, provider = '', model = '', providerCallCount = null, attempts = [] }) {
  if (!db || !reservation?.eventRef) return;
  const safeStatus = status === 'completed' ? 'completed' : 'failed';
  const update = {
    status: safeStatus,
    completedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  if (provider) update.provider = clean(provider);
  if (model) update.model = clean(model);
  if (safeStatus === 'failed') update.errorMessage = sanitizeErrorMessage(errorMessage || 'AI scan failed.');
  if (Number.isFinite(Number(estimatedInputTokens))) update.estimatedInputTokens = Math.max(0, Math.round(Number(estimatedInputTokens)));
  if (Number.isFinite(Number(estimatedOutputTokens))) update.estimatedOutputTokens = Math.max(0, Math.round(Number(estimatedOutputTokens)));
  if (Number.isFinite(Number(providerCallCount))) update.providerCallCount = Math.max(0, Math.round(Number(providerCallCount)));
  if (Array.isArray(attempts) && attempts.length) {
    update.providerAttempts = attempts.slice(0, 8).map(row => ({
      number: Math.max(1, Math.round(Number(row?.number || 1))),
      model: clean(row?.model).slice(0, 80),
      attempt: clean(row?.attempt).slice(0, 80)
    }));
  }
  await reservation.eventRef.set(update, { merge: true });
}

async function cancelAiScanReservation({ db, reservation }) {
  if (!db || !reservation?.eventRef || !reservation?.usageRef || reservation.duplicate) return;
  await db.runTransaction(async transaction => {
    const [usageSnap, eventSnap] = await Promise.all([
      transaction.get(reservation.usageRef),
      transaction.get(reservation.eventRef)
    ]);
    if (!eventSnap.exists || eventSnap.data()?.status !== 'submitted') return;
    if (usageSnap.exists) {
      const usage = usageSnap.data() || {};
      const usedField = usedFieldFor(reservation.scanType);
      const scansField = scansFieldFor(reservation.scanType);
      const processedField = processedFieldFor(reservation.scanType);
      const bypassPagesField = bypassPagesFieldFor(reservation.scanType);
      const usageUpdate = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        [scansField]: Math.max(0, normalizePositiveInteger(usage[scansField], 0) - 1),
        [processedField]: Math.max(0, Math.max(normalizePositiveInteger(usage[processedField], 0), normalizePositiveInteger(usage[usedField], 0)) - reservation.pageCount)
      };
      if (reservation.limitBypass) {
        usageUpdate.exemptPagesProcessed = Math.max(0, normalizePositiveInteger(usage.exemptPagesProcessed, 0) - reservation.pageCount);
        usageUpdate[bypassPagesField] = Math.max(0, normalizePositiveInteger(usage[bypassPagesField], 0) - reservation.pageCount);
      } else {
        usageUpdate[usedField] = Math.max(0, normalizePositiveInteger(usage[usedField], 0) - reservation.pageCount);
      }
      transaction.set(reservation.usageRef, usageUpdate, { merge: true });
    }
    transaction.delete(reservation.eventRef);
  });
}

async function getAiUsageSnapshot({ db, restaurantId, monthKey = getMonthKey(), eventLimit = 30 }) {
  const usageRef = db.collection('aiUsage').doc(usageDocumentId(restaurantId, monthKey));
  const safeEventLimit = Math.max(0, Math.min(100, normalizePositiveInteger(eventLimit, 30)));
  const eventPromise = safeEventLimit > 0
    ? usageRef.collection('events').orderBy('createdAt', 'desc').limit(safeEventLimit).get()
    : Promise.resolve({ docs: [] });
  const [usageSnap, eventSnap] = await Promise.all([usageRef.get(), eventPromise]);
  const usage = usageSnap.exists ? { ...usageDefaults(restaurantId, monthKey), ...usageSnap.data() } : usageDefaults(restaurantId, monthKey);
  usage.invoicePagesProcessed = Math.max(normalizePositiveInteger(usage.invoicePagesProcessed, 0), normalizePositiveInteger(usage.invoicePagesUsed, 0));
  usage.menuPagesProcessed = Math.max(normalizePositiveInteger(usage.menuPagesProcessed, 0), normalizePositiveInteger(usage.menuPagesUsed, 0));
  usage.invoiceBypassPagesProcessed = normalizePositiveInteger(usage.invoiceBypassPagesProcessed, 0);
  usage.menuBypassPagesProcessed = normalizePositiveInteger(usage.menuBypassPagesProcessed, 0);
  return {
    ...usage,
    createdAt: firestoreTimestampToIso(usage.createdAt),
    updatedAt: firestoreTimestampToIso(usage.updatedAt),
    events: eventSnap.docs.map(serializeEventDoc)
  };
}

async function updateAiUsageLimits({ db, restaurantId, monthKey = getMonthKey(), invoicePagesLimit, menuPagesLimit }) {
  const usageRef = db.collection('aiUsage').doc(usageDocumentId(restaurantId, monthKey));
  const now = admin.firestore.FieldValue.serverTimestamp();
  await db.runTransaction(async transaction => {
    const snap = await transaction.get(usageRef);
    const existing = snap.exists ? snap.data() || {} : usageDefaults(restaurantId, monthKey);
    const update = {
      restaurantId,
      monthKey,
      invoicePagesUsed: normalizePositiveInteger(existing.invoicePagesUsed, 0),
      invoicePagesLimit: normalizePositiveInteger(invoicePagesLimit, DEFAULT_INVOICE_PAGE_LIMIT),
      menuPagesUsed: normalizePositiveInteger(existing.menuPagesUsed, 0),
      menuPagesLimit: normalizePositiveInteger(menuPagesLimit, DEFAULT_MENU_PAGE_LIMIT),
      invoiceScansSubmitted: normalizePositiveInteger(existing.invoiceScansSubmitted, 0),
      menuScansSubmitted: normalizePositiveInteger(existing.menuScansSubmitted, 0),
      invoicePagesProcessed: Math.max(normalizePositiveInteger(existing.invoicePagesProcessed, 0), normalizePositiveInteger(existing.invoicePagesUsed, 0)),
      menuPagesProcessed: Math.max(normalizePositiveInteger(existing.menuPagesProcessed, 0), normalizePositiveInteger(existing.menuPagesUsed, 0)),
      invoiceBypassPagesProcessed: normalizePositiveInteger(existing.invoiceBypassPagesProcessed, 0),
      menuBypassPagesProcessed: normalizePositiveInteger(existing.menuBypassPagesProcessed, 0),
      exemptPagesProcessed: normalizePositiveInteger(existing.exemptPagesProcessed, 0),
      updatedAt: now
    };
    if (!snap.exists) update.createdAt = now;
    transaction.set(usageRef, update, { merge: true });
  });
  return getAiUsageSnapshot({ db, restaurantId, monthKey, eventLimit: 30 });
}


async function resetAiUsageCounters({ db, restaurantId, monthKey = getMonthKey(), resetBy = '' }) {
  const usageRef = db.collection('aiUsage').doc(usageDocumentId(restaurantId, monthKey));
  const now = admin.firestore.FieldValue.serverTimestamp();
  await usageRef.set({
    restaurantId,
    monthKey,
    invoicePagesUsed: 0,
    menuPagesUsed: 0,
    invoiceScansSubmitted: 0,
    menuScansSubmitted: 0,
    invoicePagesProcessed: 0,
    menuPagesProcessed: 0,
    invoiceBypassPagesProcessed: 0,
    menuBypassPagesProcessed: 0,
    exemptPagesProcessed: 0,
    resetAt: now,
    resetBy,
    updatedAt: now
  }, { merge: true });
  await usageRef.collection('events').add({
    type: 'usage_reset',
    scanType: 'all',
    pageCount: 0,
    userId: resetBy || 'system',
    userEmail: resetBy || '',
    createdAt: now,
    monthKey
  });
  return getAiUsageSnapshot({ db, restaurantId, monthKey, eventLimit: 30 });
}

async function authorizeAiScanWorkspace({ app, decoded, restaurantId, scanType }) {
  if (!app) throw new Error('AI page enforcement requires the matching Firebase service account in Vercel.');
  const cleanRestaurantId = clean(restaurantId);
  if (!cleanRestaurantId) throw new Error('restaurantId is required.');
  const db = app.firestore();
  const email = norm(decoded?.email);
  let userSnap = await db.collection('users').doc(decoded.uid).get();
  let userDocId = decoded.uid;
  let user = userSnap.exists ? userSnap.data() : null;
  if (!user && email) {
    const byEmail = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!byEmail.empty) {
      userSnap = byEmail.docs[0];
      userDocId = userSnap.id;
      user = userSnap.data();
    }
  }
  const isSuperAdmin = Boolean(
    decoded.superAdmin === true ||
    user?.isSuperAdmin === true ||
    user?.systemAccess?.superAdmin === true ||
    masterEmails().includes(email)
  );
  const member = isSuperAdmin ? null : await readWorkspaceMember(db, decoded.uid, email, cleanRestaurantId);
  const belongs = isSuperAdmin || userHasWorkspace(user || {}, cleanRestaurantId) || Boolean(member);
  if (!belongs) {
    const error = new Error('This account does not have access to the selected restaurant workspace.');
    error.statusCode = 403;
    throw error;
  }
  const workspaceUser = profileForWorkspace({ ...(user || {}), id: userDocId }, member, cleanRestaurantId);
  const permissions = workspaceUser?.permissions || {};
  const isOwnerOrAdmin = Boolean(
    isSuperAdmin ||
    workspaceUser?.isOwner === true ||
    workspaceUser?.accountOwner === true ||
    workspaceUser?.workspaceOwner === true ||
    workspaceUser?.isAdmin === true ||
    workspaceUser?.role === 'Owner' ||
    workspaceUser?.role === 'Admin'
  );
  const allowed = scanType === 'menu'
    ? Boolean(isOwnerOrAdmin || permissions.menuIntelligence === true || permissions.inventory === true)
    : scanType === 'recipe'
      ? Boolean(isOwnerOrAdmin || permissions.prep === true || permissions.team === true)
      : Boolean(isOwnerOrAdmin || permissions.inventory === true || permissions.team === true);
  if (!allowed) {
    const error = new Error(scanType === 'menu'
      ? 'Menu Intelligence access is required.'
      : scanType === 'recipe'
        ? 'Recipe or prep access is required for recipe scanning.'
        : 'Inventory editing access is required for invoice scanning.');
    error.statusCode = 403;
    throw error;
  }

  const restaurantSnap = await db.collection('restaurants').doc(cleanRestaurantId).get();
  const workspace = restaurantSnap.exists ? { id: restaurantSnap.id, ...restaurantSnap.data() } : { id: cleanRestaurantId };
  const planAccess = scanType === 'invoice' || scanType === 'menu'
    ? assertPlanAllowsScan({ workspace, decoded, user: workspaceUser || user || {}, scanType })
    : { subscription: null, plan: null, limits: null, isInternalTesting: isSuperAdmin };

  return {
    db,
    userDocId,
    accountUser: user || {},
    workspaceUser,
    member,
    isSuperAdmin,
    email,
    restaurantId: cleanRestaurantId,
    workspace,
    subscription: planAccess.subscription,
    plan: planAccess.plan,
    planScanLimits: planAccess.limits,
    isInternalTesting: planAccess.isInternalTesting
  };
}

function buildLimitResponse(reservation) {
  const scanLabel = reservation.scanType === 'menu' ? 'menu scan' : 'invoice scan';
  return {
    ok: false,
    code: 'AI_PAGE_LIMIT_REACHED',
    error: `Monthly ${scanLabel} page limit reached. Your current 86 Chaos plan includes ${reservation.limit} ${reservation.scanType} page(s) this month. Ask an owner or System Administrator to review Plan & Billing.`,
    scanType: reservation.scanType,
    pageCount: reservation.pageCount,
    used: reservation.usedBefore,
    limit: reservation.limit,
    remaining: Math.max(0, reservation.limit - reservation.usedBefore),
    monthKey: reservation.monthKey,
    processed: reservation.processedBefore
  };
}

function buildDuplicateResponse(reservation) {
  return {
    ok: false,
    code: 'AI_SCAN_ALREADY_SUBMITTED',
    scanType: reservation.scanType,
    pageCount: reservation.pageCount,
    status: reservation.status,
    used: reservation.used,
    limit: reservation.limit,
    remaining: reservation.remaining,
    monthKey: reservation.monthKey,
    processed: reservation.processedAfter,
    bypassPages: reservation.bypassPagesAfter
  };
}

module.exports = {
  DEFAULT_INVOICE_PAGE_LIMIT,
  DEFAULT_MENU_PAGE_LIMIT,
  getMonthKey,
  getIdempotencyKey,
  masterAdminEmails,
  isMasterAdminScanExempt,
  resolveScanPageCount,
  checkAndReserveAiScanPages,
  completeAiScanUsageEvent,
  cancelAiScanReservation,
  getAiUsageSnapshot,
  updateAiUsageLimits,
  resetAiUsageCounters,
  buildLimitResponse,
  buildDuplicateResponse,
  usageDocumentId,
  serializeEventDoc,
  authorizeAiScanWorkspace,
  __test: {
    createIdempotencyEventId,
    usageDefaults,
    sanitizeErrorMessage,
    normalizePositiveInteger
  }
};
