const { admin, initAdmin, clean } = require('./_chaos-admin');

const json = (res, status, payload) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

const readBody = (req) => {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try { return Promise.resolve(JSON.parse(req.body)); } catch (_) { return Promise.reject(new Error('Invalid JSON body')); }
  }
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; if (data.length > 1_500_000) reject(new Error('Request body too large')); });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (err) { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
};

const verifyUser = async (req) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) throw new Error('Missing Firebase Auth token');
  const app = initAdmin(req);
  const authClient = app && typeof app.auth === 'function' ? app.auth() : admin.auth(app);
  const decoded = await authClient.verifyIdToken(token);
  return { decoded };
};

const safeRows = (rows = []) => Array.isArray(rows)
  ? rows.slice(0, 500).map(row => Array.isArray(row) ? row.slice(0, 12).map(cell => clean(cell).slice(0, 800)) : [clean(row).slice(0, 800)])
  : [];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'POST only' });
  try {
    const { decoded } = await verifyUser(req);
    const body = await readBody(req);
    const rows = safeRows(body.rows || []);
    const counts = body.counts || {};
    const blocked = Number(counts.blocked || 0) || 0;
    return json(res, 200, {
      ok: true,
      exported: false,
      status: blocked ? 'packet_needs_review' : 'packet_ready',
      requestedByUid: decoded.uid,
      restaurantId: clean(body.restaurantId || ''),
      closeMonth: clean(body.closeMonth || ''),
      rowCount: rows.length,
      counts: {
        billDrafts: Number(counts.billDrafts || 0) || 0,
        vendorCredits: Number(counts.vendorCredits || 0) || 0,
        blocked
      },
      message: blocked
        ? 'Accountant packet preflight completed. Repair queue still has items, so review before sending to accountant.'
        : 'Accountant packet preflight completed. Packet is ready to export for accountant review.',
      safety: 'This endpoint validates and summarizes the packet only. It does not email, post to QuickBooks, or change accounting records.'
    });
  } catch (error) {
    return json(res, 500, { ok: false, status: 'failed_safe', message: error?.message || 'Accountant export preflight failed safely.' });
  }
};
