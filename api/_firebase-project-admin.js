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
      'CHAOS_TEST_FIREBASE_SERVICE_ACCOUNT_KEY'
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
      'FIREBASE_SERVICE_ACCOUNT_KEY_CHEERS_34B8D'
    ],
    projectId: ['FIREBASE_PRODUCTION_PROJECT_ID', 'PROD_FIREBASE_PROJECT_ID', 'REACT_APP_FIREBASE_PROJECT_ID'],
    clientEmail: ['FIREBASE_PRODUCTION_CLIENT_EMAIL', 'PROD_FIREBASE_CLIENT_EMAIL'],
    privateKey: ['FIREBASE_PRODUCTION_PRIVATE_KEY', 'PROD_FIREBASE_PRIVATE_KEY'],
    storageBucket: ['FIREBASE_PRODUCTION_STORAGE_BUCKET', 'PROD_FIREBASE_STORAGE_BUCKET', 'REACT_APP_FIREBASE_STORAGE_BUCKET']
  }
};

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
  const jsonNames = ['FIREBASE_SERVICE_ACCOUNT_KEY', 'FIREBASE_ADMIN_CREDENTIALS'];
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
  if (generic) {
    const genericProject = credentialProjectId(generic.credential);
    if (genericProject === projectId) return generic;
    if (!genericProject) {
      return { credential: { ...generic.credential, projectId }, source: `${generic.source} with ${projectId} fallback project id` };
    }
  }

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
    const credential = parseJsonCredential(String(raw), name);
    return credentialProjectId(credential);
  } catch (_) {
    return '';
  }
}

function getConfiguredDefaultProjectId() {
  // Server-to-server jobs like /api/dispatch-reminders have no Firebase ID
  // token. The safest default is the project embedded in the one normal
  // FIREBASE_SERVICE_ACCOUNT_KEY value, because that is the credential Vercel
  // can actually use. Do this before reading REACT_APP_* values so a browser
  // project id cannot force the server to ask for a second production key.
  for (const name of ['FIREBASE_SERVICE_ACCOUNT_KEY', 'FIREBASE_ADMIN_CREDENTIALS']) {
    const fromCredential = parseCredentialProjectIdFromEnv(name);
    if (fromCredential && TRUSTED_PROJECTS.includes(fromCredential)) return fromCredential;
  }

  const explicitServer = readFirstEnv([
    'FIREBASE_ADMIN_PROJECT_ID',
    'FIREBASE_SERVER_PROJECT_ID',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_TEST_PROJECT_ID',
    'TEST_FIREBASE_PROJECT_ID',
    'FIREBASE_PRODUCTION_PROJECT_ID',
    'PROD_FIREBASE_PROJECT_ID'
  ]);
  if (explicitServer && TRUSTED_PROJECTS.includes(explicitServer)) return explicitServer;

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

  const explicitBrowser = readFirstEnv([
    'REACT_APP_FIREBASE_PROJECT_ID',
    'REACT_APP_TEST_FIREBASE_PROJECT_ID'
  ]);
  if (explicitBrowser && TRUSTED_PROJECTS.includes(explicitBrowser)) return explicitBrowser;

  return '';
}

function getRequestedProjectId(req, fallback = '') {
  const token = getBearerToken(req);
  if (token) {
    try { return getTokenProjectId(token); }
    catch (_) {}
  }
  if (fallback) return clean(fallback);

  // Cron and other server-to-server calls do not carry a Firebase ID token, so
  // they cannot be project-resolved from auth. In testing deployments that are
  // treated by Vercel as a production environment, defaulting to the production
  // Firebase project can make the route ask for the wrong service account. Pick
  // the configured Firebase project/key first, then fall back to Vercel's env.
  const configuredProjectId = getConfiguredDefaultProjectId();
  if (configuredProjectId) return configuredProjectId;

  if (String(process.env.VERCEL_ENV || '').toLowerCase() === 'preview') return 'chaos-test-d1601';
  return 'cheers-34b8d';
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
    const recommended = wanted === 'chaos-test-d1601' ? 'FIREBASE_TEST_SERVICE_ACCOUNT_KEY' : 'FIREBASE_PRODUCTION_SERVICE_ACCOUNT_KEY';
    const genericProject = (() => {
      try {
        const generic = readGenericCredential();
        return generic ? credentialProjectId(generic.credential) : '';
      } catch (_) {
        return '';
      }
    })();
    const mismatchNote = genericProject && genericProject !== wanted
      ? ` The current FIREBASE_SERVICE_ACCOUNT_KEY belongs to ${genericProject}, so it cannot safely administer ${wanted}.`
      : '';
    throw new Error(
      `No usable server credential is configured for Firebase project ${wanted}. ` +
      `Use your normal FIREBASE_SERVICE_ACCOUNT_KEY env var with the complete Firebase service-account JSON for the project this deployment is using.${mismatchNote} ` +
      `You do not need a separate production-named key. Optional aliases are ${recommended}, FIREBASE_ADMIN_CREDENTIALS, or split FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY. Redeploy after changing Vercel env vars.`
    );
  }

  return admin.initializeApp({
    credential: admin.credential.cert(found.credential),
    projectId: wanted,
    storageBucket: getStorageBucketForProject(wanted)
  }, appName);
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
