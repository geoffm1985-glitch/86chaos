const admin = require('firebase-admin');
const crypto = require('crypto');

const TRUSTED_PROJECTS = ['chaos-test-d1601', 'cheers-34b8d'];
const PROJECT_ENV_ALIASES = {
  'chaos-test-d1601': {
    json: [
      'FIREBASE_TEST_SERVICE_ACCOUNT_KEY',
      'TEST_FIREBASE_SERVICE_ACCOUNT_KEY',
      'FIREBASE_SERVICE_ACCOUNT_KEY_TESTING',
      'FIREBASE_SERVICE_ACCOUNT_KEY_PREVIEW',
      'FIREBASE_SERVICE_ACCOUNT_KEY_CHAOS_TEST_D1601',
      'CHAOS_TEST_FIREBASE_SERVICE_ACCOUNT_KEY',
      'FIREBASE_TEST_ADMIN_CREDENTIALS',
      'TEST_FIREBASE_ADMIN_CREDENTIALS',
      'FIREBASE_ADMIN_CREDENTIALS_TEST',
      'FIREBASE_ADMIN_CREDENTIALS_TESTING',
      'FIREBASE_ADMIN_CREDENTIALS_PREVIEW',
      'FIREBASE_TEST_SERVICE_ACCOUNT',
      'TEST_FIREBASE_SERVICE_ACCOUNT',
      'FIREBASE_SERVICE_ACCOUNT_TEST',
      'FIREBASE_SERVICE_ACCOUNT_TESTING',
      'FIREBASE_SERVICE_ACCOUNT_PREVIEW',
      'FIREBASE_SERVICE_ACCOUNT_KEY_TEST',
      'FIREBASE_TEST_SERVICE_ACCOUNT_JSON',
      'TEST_FIREBASE_SERVICE_ACCOUNT_JSON',
      'FIREBASE_TEST_ADMIN_CREDENTIALS_JSON',
      'TEST_FIREBASE_ADMIN_CREDENTIALS_JSON',
      'FIREBASE_ADMIN_TEST_CREDENTIALS',
      'FIREBASE_ADMIN_TEST_SERVICE_ACCOUNT_KEY',
      'CHAOS_TEST_D1601_FIREBASE_SERVICE_ACCOUNT_KEY',
      'CHAOS_TEST_D1601_SERVICE_ACCOUNT_KEY',
      'GOOGLE_TEST_APPLICATION_CREDENTIALS_JSON',
      'FIREBASE_PREVIEW_SERVICE_ACCOUNT_KEY',
      'VERCEL_PREVIEW_FIREBASE_SERVICE_ACCOUNT_KEY'
    ],
    projectId: ['FIREBASE_TEST_PROJECT_ID', 'TEST_FIREBASE_PROJECT_ID', 'REACT_APP_TEST_FIREBASE_PROJECT_ID'],
    clientEmail: ['FIREBASE_TEST_CLIENT_EMAIL', 'TEST_FIREBASE_CLIENT_EMAIL'],
    privateKey: ['FIREBASE_TEST_PRIVATE_KEY', 'TEST_FIREBASE_PRIVATE_KEY'],
    storageBucket: ['FIREBASE_TEST_STORAGE_BUCKET', 'TEST_FIREBASE_STORAGE_BUCKET', 'REACT_APP_TEST_FIREBASE_STORAGE_BUCKET']
  },
  'cheers-34b8d': {
    json: [
      'FIREBASE_PRODUCTION_SERVICE_ACCOUNT_KEY',
      'PROD_FIREBASE_SERVICE_ACCOUNT_KEY',
      'FIREBASE_PROD_SERVICE_ACCOUNT_KEY',
      'FIREBASE_SERVICE_ACCOUNT_KEY_PRODUCTION',
      'FIREBASE_SERVICE_ACCOUNT_KEY_CHEERS_34B8D',
      'FIREBASE_PRODUCTION_ADMIN_CREDENTIALS',
      'PROD_FIREBASE_ADMIN_CREDENTIALS',
      'FIREBASE_ADMIN_CREDENTIALS_PROD',
      'FIREBASE_ADMIN_CREDENTIALS_PRODUCTION',
      'FIREBASE_PRODUCTION_SERVICE_ACCOUNT',
      'PROD_FIREBASE_SERVICE_ACCOUNT',
      'FIREBASE_SERVICE_ACCOUNT_PROD',
      'FIREBASE_SERVICE_ACCOUNT_PRODUCTION',
      'FIREBASE_SERVICE_ACCOUNT_KEY_PROD',
      'FIREBASE_PROD_SERVICE_ACCOUNT_JSON',
      'PROD_FIREBASE_SERVICE_ACCOUNT_JSON',
      'FIREBASE_PRODUCTION_SERVICE_ACCOUNT_JSON',
      'FIREBASE_ADMIN_PROD_CREDENTIALS',
      'FIREBASE_ADMIN_PROD_SERVICE_ACCOUNT_KEY',
      'CHEERS_34B8D_FIREBASE_SERVICE_ACCOUNT_KEY',
      'CHEERS_34B8D_SERVICE_ACCOUNT_KEY',
      'GOOGLE_PROD_APPLICATION_CREDENTIALS_JSON'
    ],
    projectId: ['FIREBASE_PRODUCTION_PROJECT_ID', 'PROD_FIREBASE_PROJECT_ID', 'REACT_APP_FIREBASE_PROJECT_ID'],
    clientEmail: ['FIREBASE_PRODUCTION_CLIENT_EMAIL', 'PROD_FIREBASE_CLIENT_EMAIL'],
    privateKey: ['FIREBASE_PRODUCTION_PRIVATE_KEY', 'PROD_FIREBASE_PRIVATE_KEY'],
    storageBucket: ['FIREBASE_PRODUCTION_STORAGE_BUCKET', 'PROD_FIREBASE_STORAGE_BUCKET', 'REACT_APP_FIREBASE_STORAGE_BUCKET']
  }
};

const PROD_FIREBASE_HOSTS = new Set(['app.86chaos.com', '86chaos.com', 'www.86chaos.com']);

function requestHost(req) {
  const headers = req?.headers || {};
  const forwarded = String(headers['x-forwarded-host'] || headers['x-vercel-forwarded-host'] || '').split(',')[0].trim();
  const rawHost = forwarded || String(headers.host || '').split(',')[0].trim();
  return rawHost.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].toLowerCase();
}

function requestOriginHost(req) {
  const headers = req?.headers || {};
  for (const headerName of ['origin', 'referer']) {
    const raw = String(headers[headerName] || '').trim();
    if (!raw) continue;
    try { return new URL(raw).hostname.toLowerCase(); } catch (_) {}
  }
  return '';
}

function isProductionWebHost(hostname = '') {
  return PROD_FIREBASE_HOSTS.has(String(hostname || '').toLowerCase());
}

function deploymentLooksLikeTesting(req = null) {
  const explicitMode = String(process.env.FIREBASE_DEPLOYMENT_MODE || process.env.REACT_APP_FIREBASE_DEPLOYMENT_MODE || '').toLowerCase().trim();
  if (['test', 'testing', 'preview', 'staging', 'dev', 'development'].includes(explicitMode)) return true;
  if (['prod', 'production', 'live'].includes(explicitMode)) return false;

  const activeProject = String(process.env.FIREBASE_ACTIVE_PROJECT_ID || process.env.REACT_APP_FIREBASE_ACTIVE_PROJECT_ID || '').trim();
  if (activeProject === 'chaos-test-d1601') return true;
  if (activeProject === 'cheers-34b8d') return false;

  const host = requestHost(req) || requestOriginHost(req);
  if (host && !isProductionWebHost(host)) return true;

  const vercelEnv = String(process.env.VERCEL_ENV || '').toLowerCase().trim();
  if (vercelEnv === 'preview' || vercelEnv === 'development') return true;

  const gitRef = String(process.env.VERCEL_GIT_COMMIT_REF || process.env.VERCEL_BRANCH_URL || '').toLowerCase();
  if (/\b(test|testing|preview|staging|dev|development)\b/.test(gitRef)) return true;
  return false;
}

let secureTokenCertCache = { expiresAt: 0, certs: {} };

function clean(value = '') {
  return String(value == null ? '' : value).trim();
}

function readFirstEnv(names = []) {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

function parseJsonCredential(raw, sourceName) {
  const attempts = [];
  const original = String(raw || '').trim();
  if (original) attempts.push(original);
  if ((original.startsWith('\"') && original.endsWith('\"')) || (original.startsWith("'") && original.endsWith("'"))) {
    attempts.push(original.slice(1, -1));
  }
  try {
    if (original && /^[A-Za-z0-9+/=\r\n]+$/.test(original) && !original.includes('{')) {
      attempts.push(Buffer.from(original, 'base64').toString('utf8').trim());
    }
  } catch (_) {}

  for (const value of attempts) {
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
      return parsed;
    } catch (_) {}
  }
  throw new Error(`${sourceName} is not valid Firebase service-account JSON. Paste the complete service account JSON value, including project_id, client_email, and private_key.`);
}

function credentialProjectId(credential = {}) {
  return clean(credential.project_id || credential.projectId);
}

function normalizedCredential(credential = {}) {
  return {
    ...credential,
    projectId: credential.projectId || credential.project_id,
    clientEmail: credential.clientEmail || credential.client_email,
    privateKey: String(credential.privateKey || credential.private_key || '').replace(/\\n/g, '\n')
  };
}

function readGenericCredential() {
  const jsonNames = ['FIREBASE_SERVICE_ACCOUNT_KEY', 'FIREBASE_ADMIN_CREDENTIALS', 'FIREBASE_SERVICE_ACCOUNT_JSON', 'GOOGLE_APPLICATION_CREDENTIALS_JSON', 'GOOGLE_FIREBASE_SERVICE_ACCOUNT_KEY'];
  for (const name of jsonNames) {
    const raw = process.env[name];
    if (!raw || !String(raw).trim()) continue;
    const credential = parseJsonCredential(String(raw), name);
    return { credential: normalizedCredential(credential), source: name };
  }

  const projectId = clean(process.env.FIREBASE_PROJECT_ID);
  const clientEmail = clean(process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n').replace(/^"|"$/g, '');
  if (projectId && clientEmail && privateKey) {
    return { credential: { projectId, clientEmail, privateKey }, source: 'FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY' };
  }
  return null;
}

function readProjectCredential(projectId) {
  const aliases = PROJECT_ENV_ALIASES[projectId] || { json: [], projectId: [], clientEmail: [], privateKey: [], storageBucket: [] };

  // Backward compatibility: the original 86 Chaos deployment used one generic
  // FIREBASE_SERVICE_ACCOUNT_KEY. Honor it first when its embedded project_id
  // matches the requested Firebase project so testing deployments do not need a
  // separate production/test key split.
  const generic = readGenericCredential();
  if (generic && credentialProjectId(generic.credential) === projectId) return generic;

  for (const name of aliases.json || []) {
    const raw = process.env[name];
    if (!raw || !String(raw).trim()) continue;
    const credential = normalizedCredential(parseJsonCredential(String(raw), name));
    const foundProject = credentialProjectId(credential);
    if (foundProject && foundProject !== projectId) {
      throw new Error(`${name} contains project ${foundProject}, but ${projectId} was requested.`);
    }
    return { credential: { ...credential, projectId }, source: name };
  }

  const splitProject = readFirstEnv(aliases.projectId || []) || projectId;
  const splitEmail = readFirstEnv(aliases.clientEmail || []);
  const splitKey = readFirstEnv(aliases.privateKey || []).replace(/\\n/g, '\n').replace(/^"|"$/g, '');
  if (splitEmail && splitKey) {
    return {
      credential: { projectId: splitProject, clientEmail: splitEmail, privateKey: splitKey },
      source: `${projectId} project-specific split environment variables`
    };
  }

  return null;
}

function getDatabaseUrlForProject(projectId) {
  const direct = projectId === 'cheers-34b8d'
    ? (process.env.FIREBASE_PROD_DATABASE_URL || process.env.PROD_FIREBASE_DATABASE_URL || process.env.REACT_APP_PROD_FIREBASE_DATABASE_URL)
    : (process.env.FIREBASE_TEST_DATABASE_URL || process.env.TEST_FIREBASE_DATABASE_URL || process.env.REACT_APP_TEST_FIREBASE_DATABASE_URL);
  if (direct) return String(direct).trim();
  return projectId === 'cheers-34b8d'
    ? 'https://cheers-34b8d-default-rtdb.firebaseio.com'
    : 'https://chaos-test-d1601-default-rtdb.firebaseio.com';
}

function getStorageBucketForProject(projectId) {
  const aliases = PROJECT_ENV_ALIASES[projectId] || {};
  const projectSpecific = readFirstEnv(aliases.storageBucket || []);
  if (projectSpecific) return projectSpecific.replace(/^gs:\/\//, '');

  const genericCredential = readGenericCredential();
  if (genericCredential && credentialProjectId(genericCredential.credential) === projectId && process.env.FIREBASE_STORAGE_BUCKET) {
    return String(process.env.FIREBASE_STORAGE_BUCKET).replace(/^gs:\/\//, '').trim();
  }
  return `${projectId}.firebasestorage.app`;
}

function decodeJwtPart(value = '') {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(padded, 'base64');
}

function decodeJwtJson(value = '') {
  return JSON.parse(decodeJwtPart(value).toString('utf8'));
}

function getBearerToken(req) {
  return String(req?.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
}

function getTokenProjectId(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Malformed Firebase ID token.');
  return clean(decodeJwtJson(parts[1]).aud);
}

function parseCredentialProjectIdFromEnv(name) {
  const raw = process.env[name];
  if (!raw || !String(raw).trim()) return '';
  try {
    const credential = normalizedCredential(parseJsonCredential(String(raw), name));
    return credentialProjectId(credential);
  } catch (_) {
    return '';
  }
}

function readGenericCredentialProject() {
  try {
    const generic = readGenericCredential();
    const projectId = credentialProjectId(generic?.credential || {});
    return projectId && TRUSTED_PROJECTS.includes(projectId) ? { ...generic, projectId } : null;
  } catch (_) {
    return null;
  }
}

function getConfiguredDefaultProjectId(req = null) {
  // 86 Chaos uses one Firebase Admin JSON per deployment. For server-to-server
  // routes, the project_id inside FIREBASE_SERVICE_ACCOUNT_KEY is the source of
  // truth. This keeps testing deployments on chaos-test-d1601 even if an old
  // FIREBASE_PROJECT_ID env var still says cheers-34b8d.
  const generic = readGenericCredentialProject();
  if (generic?.projectId) return generic.projectId;

  const explicitPinnedServer = readFirstEnv([
    'FIREBASE_ACTIVE_PROJECT_ID',
    'FIREBASE_ADMIN_PROJECT_ID',
    'FIREBASE_SERVER_PROJECT_ID',
    'FIREBASE_TEST_PROJECT_ID',
    'TEST_FIREBASE_PROJECT_ID',
    'FIREBASE_PRODUCTION_PROJECT_ID',
    'PROD_FIREBASE_PROJECT_ID'
  ]);
  if (explicitPinnedServer && TRUSTED_PROJECTS.includes(explicitPinnedServer)) return explicitPinnedServer;

  const splitProjectId = clean(process.env.FIREBASE_PROJECT_ID);
  if (splitProjectId && TRUSTED_PROJECTS.includes(splitProjectId) && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) return splitProjectId;

  const projectSpecificJsonNames = [];
  for (const projectId of TRUSTED_PROJECTS) {
    const aliases = PROJECT_ENV_ALIASES[projectId] || {};
    for (const name of aliases.json || []) projectSpecificJsonNames.push({ name, projectId });
  }

  for (const { name, projectId } of projectSpecificJsonNames) {
    const raw = process.env[name];
    if (!raw || !String(raw).trim()) continue;
    const fromCredential = parseCredentialProjectIdFromEnv(name);
    if (fromCredential && TRUSTED_PROJECTS.includes(fromCredential)) return fromCredential;
    return projectId;
  }

  if (deploymentLooksLikeTesting(req)) return 'chaos-test-d1601';
  return 'cheers-34b8d';
}

function getRequestedProjectId(req, fallback = '') {
  const token = getBearerToken(req);
  if (token) {
    try { return getTokenProjectId(token); }
    catch (_) {}
  }

  if (fallback) return clean(fallback);
  return getConfiguredDefaultProjectId(req);
}

function appNameForProject(projectId) {
  return `86chaos-${String(projectId).replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

function getAdminAppForProject(projectId, { requireCredentials = true } = {}) {
  const wanted = clean(projectId);
  if (!wanted) throw new Error('Could not determine the Firebase project for this request.');
  if (!TRUSTED_PROJECTS.includes(wanted)) throw new Error(`Firebase project ${wanted} is not approved for 86 Chaos.`);

  const appName = appNameForProject(wanted);
  const existing = admin.apps.find(app => app.name === appName);
  if (existing) return existing;

  const found = readProjectCredential(wanted);
  if (!found) {
    if (!requireCredentials) return null;
    const generic = readGenericCredentialProject();
    const genericNote = generic?.projectId
      ? ` FIREBASE_SERVICE_ACCOUNT_KEY currently contains project_id ${generic.projectId}; this route requested ${wanted}.`
      : '';
    const recommended = wanted === 'chaos-test-d1601' ? 'FIREBASE_TEST_SERVICE_ACCOUNT_KEY' : 'FIREBASE_PRODUCTION_SERVICE_ACCOUNT_KEY';
    throw new Error(
      `No server credential is configured for Firebase project ${wanted}.` +
      genericNote + ' ' +
      `Use FIREBASE_SERVICE_ACCOUNT_KEY with the complete service-account JSON for the active deployment project. ` +
      `Testing should use project_id chaos-test-d1601; production should use project_id cheers-34b8d. ` +
      `Optional advanced aliases are ${recommended}, FIREBASE_ADMIN_CREDENTIALS, or split FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY. Redeploy after changing Vercel env vars.`
    );
  }

  const credentialProject = credentialProjectId(found.credential) || wanted;
  const finalProjectId = TRUSTED_PROJECTS.includes(credentialProject) ? credentialProject : wanted;
  const finalAppName = appNameForProject(finalProjectId);
  const finalExisting = admin.apps.find(app => app.name === finalAppName);
  if (finalExisting) return finalExisting;

  return admin.initializeApp({
    credential: admin.credential.cert({ ...found.credential, projectId: finalProjectId }),
    projectId: finalProjectId,
    storageBucket: getStorageBucketForProject(finalProjectId),
    databaseURL: getDatabaseUrlForProject(finalProjectId)
  }, finalAppName);
}

function getAdminAppForRequest(req, options = {}) {
  return getAdminAppForProject(getRequestedProjectId(req, options.fallbackProjectId), options);
}

async function loadSecureTokenCertificates() {
  if (secureTokenCertCache.expiresAt > Date.now() && Object.keys(secureTokenCertCache.certs).length) {
    return secureTokenCertCache.certs;
  }
  const response = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  if (!response.ok) throw new Error(`Could not load Firebase token certificates (${response.status}).`);
  const certs = await response.json();
  const cacheControl = String(response.headers.get('cache-control') || '');
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  secureTokenCertCache = {
    certs,
    expiresAt: Date.now() + Math.max(300, Math.min(maxAgeSeconds, 21600)) * 1000
  };
  return certs;
}

async function verifyTrustedFirebaseIdToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Malformed Firebase ID token.');
  const header = decodeJwtJson(parts[0]);
  const payload = decodeJwtJson(parts[1]);
  const projectId = clean(payload.aud);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Firebase ID token has an unsupported signature.');
  if (!TRUSTED_PROJECTS.includes(projectId)) throw new Error(`Firebase project ${projectId || 'unknown'} is not trusted.`);
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Firebase ID token issuer is invalid.');
  if (!payload.sub || String(payload.sub).length > 128) throw new Error('Firebase ID token subject is invalid.');
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(Number(payload.exp)) || Number(payload.exp) <= now) throw new Error('Firebase ID token has expired.');
  if (!Number.isFinite(Number(payload.iat)) || Number(payload.iat) > now + 300) throw new Error('Firebase ID token issued-at time is invalid.');
  const certs = await loadSecureTokenCertificates();
  const certificate = certs[header.kid];
  if (!certificate) throw new Error('Firebase token signing certificate is unavailable. Refresh and try again.');
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  if (!verifier.verify(certificate, decodeJwtPart(parts[2]))) throw new Error('Firebase ID token signature is invalid.');
  return { ...payload, uid: payload.sub, authProjectId: projectId };
}

async function verifyRequestToken(req, { requireProjectCredentials = false } = {}) {
  const token = getBearerToken(req);
  if (!token) throw new Error('Missing Firebase authorization token.');
  const projectId = getTokenProjectId(token);
  const app = getAdminAppForProject(projectId, { requireCredentials: false });
  if (app) {
    const decoded = await app.auth().verifyIdToken(token);
    return { decoded: { ...decoded, authProjectId: projectId }, app, projectId, token, verificationMode: 'firebase-admin' };
  }
  if (requireProjectCredentials) {
    getAdminAppForProject(projectId, { requireCredentials: true });
  }
  const decoded = await verifyTrustedFirebaseIdToken(token);
  return { decoded, app: null, projectId, token, verificationMode: 'google-public-key' };
}

function validateFirebaseDownloadUrl(downloadUrl, projectId, expectedStoragePath = '') {
  const raw = clean(downloadUrl);
  if (!raw) throw new Error('A secure Firebase download URL is required when matching server credentials are unavailable.');
  let url;
  try { url = new URL(raw); }
  catch (_) { throw new Error('The Firebase download URL is invalid.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com') {
    throw new Error('Only Firebase Storage download URLs are accepted.');
  }
  const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
  if (!match) throw new Error('The Firebase Storage download URL format is invalid.');
  const bucket = decodeURIComponent(match[1]);
  const objectPath = decodeURIComponent(match[2]);
  const expectedBucket = getStorageBucketForProject(projectId);
  if (bucket !== expectedBucket) throw new Error(`The uploaded file belongs to ${bucket}, not the active ${expectedBucket} bucket.`);
  if (expectedStoragePath && objectPath !== String(expectedStoragePath).replace(/^\/+/, '')) {
    throw new Error('The secure download URL does not match the uploaded file path.');
  }
  if (!url.searchParams.get('token')) throw new Error('The Firebase download URL is missing its temporary access token.');
  return { url: url.toString(), bucket, objectPath };
}

async function downloadFirebaseStorageUrl(downloadUrl, projectId, expectedStoragePath = '', maxBytes = 20 * 1024 * 1024) {
  const validated = validateFirebaseDownloadUrl(downloadUrl, projectId, expectedStoragePath);
  const response = await fetch(validated.url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Firebase Storage download failed (${response.status}). Upload the file again and retry.`);
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength && declaredLength > maxBytes) throw new Error(`Uploaded file exceeds the ${Math.round(maxBytes / 1048576)}MB scanner limit.`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maxBytes) throw new Error(`Uploaded file exceeds the ${Math.round(maxBytes / 1048576)}MB scanner limit.`);
  return {
    ...validated,
    buffer,
    contentType: response.headers.get('content-type') || 'application/octet-stream',
    size: buffer.length
  };
}

function projectCredentialStatus(projectId) {
  try {
    const found = readProjectCredential(projectId);
    return found
      ? { configured: true, projectId, source: found.source }
      : { configured: false, projectId, source: '', recommendedEnv: projectId === 'chaos-test-d1601' ? 'FIREBASE_TEST_SERVICE_ACCOUNT_KEY' : 'FIREBASE_PRODUCTION_SERVICE_ACCOUNT_KEY' };
  } catch (error) {
    return { configured: false, projectId, error: error.message };
  }
}

module.exports = {
  admin,
  TRUSTED_PROJECTS,
  getBearerToken,
  getTokenProjectId,
  getRequestedProjectId,
  getAdminAppForProject,
  getAdminAppForRequest,
  verifyTrustedFirebaseIdToken,
  verifyRequestToken,
  projectCredentialStatus,
  readProjectCredential,
  getStorageBucketForProject,
  validateFirebaseDownloadUrl,
  downloadFirebaseStorageUrl
};
