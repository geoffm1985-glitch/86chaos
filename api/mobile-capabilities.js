// Public release readiness, with no credentials, tenant records or user data.
const { APP_VERSION } = require('./_version');
const { projectCredentialStatus } = require('./_firebase-project-admin');
module.exports = (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false });
  res.setHeader('Cache-Control', 'no-store');
  try {
    const projectId = 'cheers-34b8d';
    const configured = projectCredentialStatus(projectId).configured;
    return res.status(configured ? 200 : 503).json({ ok: configured, version: APP_VERSION, commit: process.env.VERCEL_GIT_COMMIT_SHA || null, projectId, productionCredentialsConfigured: configured,
      routes: ['/api/demand-history', '/api/operational-history', '/api/safe-write', '/api/free-ai-services'] });
  } catch (_) {
    return res.status(503).json({ ok: false, error: 'Mobile readiness is unavailable.' });
  }
};
