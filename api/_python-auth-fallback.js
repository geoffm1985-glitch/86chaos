const { initAdmin, authorize, requireAppCheckIfEnforced, verifyTrustedFirebaseIdToken } = require('./_chaos-admin');

function bearer(req) {
  return String(req?.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
}

function isCredentialSetupError(error) {
  const message = String(error?.message || error || '');
  return /No server credential is configured|FIREBASE_SERVICE_ACCOUNT_KEY currently contains project_id|is not valid Firebase service-account JSON|contains project .* but .* was requested|Could not determine the Firebase project|project .* was requested/i.test(message);
}

async function authorizePythonPayloadRoute(req, restaurantId, options = {}) {
  const featureName = options.featureName || 'Python intelligence';
  const token = bearer(req);
  if (!token) return { ok: false, status: 401, error: 'Missing Firebase authorization token.' };

  try {
    const app = initAdmin(req);
    const appCheck = await requireAppCheckIfEnforced(app, req);
    if (!appCheck.ok) return { ok: false, status: appCheck.status || 401, error: appCheck.error };
    const ctx = await authorize(req, app, { allowTenantAdmin: true, targetRestaurantId: restaurantId });
    return { ok: ctx.ok, status: ctx.status, error: ctx.error, ctx, mode: 'firebase-admin' };
  } catch (error) {
    if (!isCredentialSetupError(error)) throw error;
    try {
      const decoded = await verifyTrustedFirebaseIdToken(token);
      return {
        ok: true,
        mode: 'verified-token-payload-only',
        warning: `${featureName} used verified-token payload mode because matching Firebase Admin credentials for ${decoded.authProjectId || decoded.aud || 'the active Firebase project'} are not available in this Vercel environment. The scan still runs against the already-loaded app payload, but server audit logging and server plan lookup are skipped for this run.`,
        ctx: {
          ok: true,
          decoded,
          uid: decoded.uid,
          userDocId: decoded.uid,
          email: decoded.email || '',
          user: { id: decoded.uid, email: decoded.email || '', name: decoded.name || decoded.email || 'Verified User' },
          accountUser: {},
          workspaceMember: null,
          isSuperAdmin: decoded.superAdmin === true || decoded.systemAccess?.superAdmin === true,
          restaurantId,
          permissions: {},
          app: null,
          db: null,
          verifiedTokenPayloadOnly: true,
          credentialSetupError: String(error?.message || error || '')
        }
      };
    } catch (verifyError) {
      return { ok: false, status: 401, error: `Invalid authorization token: ${verifyError.message}` };
    }
  }
}

module.exports = { authorizePythonPayloadRoute };
