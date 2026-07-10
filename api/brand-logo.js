const admin = require('firebase-admin');
const { getAdminAppForRequest } = require('./_firebase-project-admin');
const crypto = require('crypto');

function initAdmin(req) {
  return getAdminAppForRequest(req, { requireCredentials: true });
}

function norm(v) { return String(v || '').toLowerCase().trim(); }
function cleanString(v, fallback = '') { return String(v == null ? fallback : v).trim(); }
function safeFilenamePart(v, fallback = 'restaurant-logo.png') {
  const cleaned = cleanString(v, fallback).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
  return cleaned || fallback;
}
function masterEmails() {
  return [
    process.env.MASTER_ADMIN_EMAIL,
    process.env.MASTER_ADMIN_EMAILS
  ].filter(Boolean).flatMap(v => String(v).split(',')).map(norm).filter(Boolean);
}
function memberDocId(uid, restaurantId) {
  return `${cleanString(uid).replace(/[^A-Za-z0-9_-]/g, '_')}_${cleanString(restaurantId).replace(/[^A-Za-z0-9_-]/g, '_')}`.slice(0, 240);
}
function hasWorkspace(user, restaurantId) {
  return Boolean(user?.restaurantId === restaurantId || user?.activeRestaurantId === restaurantId || user?.defaultRestaurantId === restaurantId || user?.workspaceIds?.includes?.(restaurantId) || user?.memberships?.[restaurantId]?.isActive === true);
}
async function loadMembership(db, uid, email, restaurantId) {
  const direct = await db.collection('workspaceMembers').doc(memberDocId(uid, restaurantId)).get();
  if (direct.exists && direct.data()?.isActive !== false) return direct.data();
  if (email) {
    const snap = await db.collection('workspaceMembers').where('restaurantId', '==', restaurantId).where('email', '==', norm(email)).limit(1).get();
    if (!snap.empty && snap.docs[0].data()?.isActive !== false) return snap.docs[0].data();
  }
  return null;
}

function allowedImageType(contentType) {
  return ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml'].includes(norm(contentType));
}
function extensionFor(contentType, originalName = '') {
  const byType = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg'
  };
  const ext = byType[norm(contentType)];
  if (ext) return ext;
  const m = cleanString(originalName).match(/\.([a-zA-Z0-9]{2,5})$/);
  return m ? m[1].toLowerCase() : 'png';
}

async function verifyCaller(req, db, auth) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) throw new Error('Missing Firebase ID token. Log out and back in, then try again.');
  const decoded = await auth.verifyIdToken(token);
  const callerEmail = norm(decoded.email);

  let callerSnap = await db.collection('users').doc(decoded.uid).get();
  let callerDocId = decoded.uid;
  let caller = callerSnap.exists ? callerSnap.data() : null;

  if (!caller && callerEmail) {
    const emailSnap = await db.collection('users').where('email', '==', callerEmail).limit(1).get();
    if (!emailSnap.empty) {
      callerSnap = emailSnap.docs[0];
      callerDocId = callerSnap.id;
      caller = callerSnap.data();
    }
  }

  const userRestaurantId = cleanString(caller?.activeRestaurantId || caller?.restaurantId || caller?.defaultRestaurantId);
  const isSuperAdmin = Boolean(
    decoded.superAdmin === true ||
    caller?.isSuperAdmin === true ||
    caller?.systemAccess?.superAdmin === true ||
    masterEmails().includes(callerEmail)
  );

  return { decoded, caller: caller || {}, callerDocId, callerEmail, userRestaurantId, permissions: caller?.permissions || {}, isSuperAdmin, hasWorkspace: (restaurantId) => hasWorkspace(caller || {}, restaurantId), loadMembership: (restaurantId) => loadMembership(db, decoded.uid, callerEmail, restaurantId) };
}

function canManageBrandingFor(ctx, restaurant, targetRestaurantId, membership = null) {
  const restaurantOwnerEmail = norm(restaurant?.ownerEmail || restaurant?.ownerEmailLower || restaurant?.ownerUserEmail);
  const ownerId = cleanString(restaurant?.ownerUid || restaurant?.ownerUserId);
  const memberPerms = membership?.permissions || {};
  const callerOwnsTarget = Boolean(
    ctx.isSuperAdmin ||
    (ctx.hasWorkspace(targetRestaurantId) && (
      membership?.isOwner === true ||
      membership?.accountOwner === true ||
      membership?.workspaceOwner === true ||
      ctx.caller?.isOwner === true ||
      ctx.caller?.accountOwner === true ||
      ctx.caller?.owner === true ||
      ctx.caller?.workspaceOwner === true ||
      norm(ctx.caller?.accountRole) === 'owner'
    )) ||
    (restaurantOwnerEmail && restaurantOwnerEmail === ctx.callerEmail) ||
    (ownerId && (ownerId === ctx.decoded.uid || ownerId === ctx.callerDocId))
  );

  return Boolean(
    ctx.isSuperAdmin ||
    callerOwnsTarget ||
    (ctx.hasWorkspace(targetRestaurantId) && (
      membership?.isAdmin === true ||
      ctx.caller?.isAdmin === true ||
      memberPerms.branding === true ||
      memberPerms.settings === true ||
      ctx.permissions?.branding === true ||
      ctx.permissions?.settings === true
    ))
  );
}

async function writeAudit(db, ctx, targetRestaurantId, storagePath) {
  try {
    await db.collection('auditLogs').add({
      userId: ctx.callerDocId || ctx.decoded.uid,
      userName: ctx.caller?.name || ctx.callerEmail || 'Branding Manager',
      userEmail: ctx.callerEmail || '',
      action: 'BRANDING_LOGO_UPLOAD',
      target: targetRestaurantId,
      details: `Restaurant logo uploaded to ${storagePath}. 86 Chaos branding remains locked and visible.`,
      timestamp: new Date().toISOString(),
      restaurantId: targetRestaurantId,
      securityLevel: 'standard',
      whyThisMatters: 'Restaurant logos affect customer branding but cannot replace the locked 86 Chaos brand.'
    });
  } catch (_) {}
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const app = initAdmin(req);
    const db = app.firestore();
    const auth = app.auth();
    const ctx = await verifyCaller(req, db, auth);
    const body = req.body || {};
    const targetRestaurantId = safeFilenamePart(body.restaurantId || ctx.userRestaurantId, 'restaurant').replace(/\.+/g, '_');
    if (!targetRestaurantId) return res.status(400).json({ error: 'Missing restaurant workspace for logo upload.' });
    const membership = ctx.hasWorkspace(targetRestaurantId) ? (ctx.caller?.memberships?.[targetRestaurantId] || null) : await ctx.loadMembership(targetRestaurantId);
    if (!ctx.isSuperAdmin && !membership && !ctx.hasWorkspace(targetRestaurantId)) {
      return res.status(403).json({ error: 'Logo uploads can only be saved inside an active workspace membership.' });
    }

    const restSnap = await db.collection('restaurants').doc(targetRestaurantId).get();
    const restaurant = restSnap.exists ? restSnap.data() : {};
    if (!canManageBrandingFor(ctx, restaurant, targetRestaurantId, membership)) {
      return res.status(403).json({ error: 'Only the account owner, Super Admin, workspace admin, or a user with Branding/Settings permission can upload a restaurant logo.' });
    }

    const dataUrl = cleanString(body.dataUrl);
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Logo upload payload was not a valid image.' });

    const contentType = norm(body.contentType || match[1]);
    if (!allowedImageType(contentType)) return res.status(400).json({ error: 'Please upload a PNG, JPG, GIF, SVG, or WebP logo.' });

    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length) return res.status(400).json({ error: 'Logo image was empty.' });
    if (bytes.length > 3 * 1024 * 1024) return res.status(413).json({ error: 'Logo image is too large after preparation. Try a smaller logo file under 3MB.' });

    const bucket = app.storage().bucket();
    if (!bucket?.name) return res.status(500).json({ error: 'Firebase Storage bucket is not configured on the server.' });

    const ext = extensionFor(contentType, body.fileName);
    const original = safeFilenamePart(body.fileName || `restaurant-logo.${ext}`, `restaurant-logo.${ext}`).replace(/\.[a-zA-Z0-9]{2,5}$/, '');
    const token = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const storagePath = `${targetRestaurantId}/brandAssets/restaurant-logo-${Date.now()}-${original}.${ext}`;
    const file = bucket.file(storagePath);

    await file.save(bytes, {
      resumable: false,
      metadata: {
        contentType,
        cacheControl: 'public, max-age=3600',
        metadata: {
          firebaseStorageDownloadTokens: token,
          uploadedBy: ctx.callerEmail || ctx.decoded.uid,
          restaurantId: targetRestaurantId,
          purpose: 'restaurant-logo'
        }
      }
    });

    const encodedPath = encodeURIComponent(storagePath);
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
    await writeAudit(db, ctx, targetRestaurantId, storagePath);
    return res.status(200).json({ ok: true, url: downloadUrl, storagePath, bucket: bucket.name });
  } catch (err) {
    console.error('brand-logo upload failed', err);
    return res.status(500).json({ error: err.message || 'Restaurant logo upload failed.' });
  }
};

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    }
  }
};
