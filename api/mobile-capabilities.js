// Public release readiness, with no credentials, tenant records or user data.
const { APP_VERSION } = require('./_version');
const { projectCredentialStatus } = require('./_firebase-project-admin');
module.exports = (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false });
  const projectId = 'cheers-34b8d';
  const configured = projectCredentialStatus(projectId).configured;
  res.setHeader('Cache-Control', 'no-store');
  return res.status(configured ? 200 : 503).json({ ok: configured, version: APP_VERSION, projectId, productionCredentialsConfigured: configured,
    routes: ['/api/demand-history', '/api/operational-history', '/api/safe-write', '/api/free-ai-services'] });
};
