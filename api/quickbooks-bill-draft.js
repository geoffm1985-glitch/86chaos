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
  req.on('data', chunk => { data += chunk; if (data.length > 2_000_000) reject(new Error('Request body too large')); });
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
  return { app, decoded };
};

const safeLine = (line = {}, index = 0) => ({
  lineNumber: Number(line.lineNumber || index + 1),
  description: clean(line.description || line.itemName || line.name || `Invoice line ${index + 1}`).slice(0, 500),
  quantity: Number(line.quantity || 1) || 1,
  unitCost: Number(line.unitCost || line.unitPrice || line.casePrice || 0) || 0,
  amount: Number(line.amount || line.totalPrice || line.extendedPrice || 0) || 0,
  accountName: clean(line.accountName || 'Food Purchases').slice(0, 160),
  inventoryItemId: clean(line.inventoryItemId || '').slice(0, 160),
  productCode: clean(line.productCode || '').slice(0, 120),
  sourceClassification: clean(line.sourceClassification || 'invoice_line').slice(0, 80)
});

const normalizeDraft = (draft = {}) => {
  const lines = Array.isArray(draft.lines) ? draft.lines.map(safeLine).filter(line => line.description || line.amount) : [];
  const lineTotal = lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  const totalAmount = Number(draft.totalAmount || lineTotal || 0) || 0;
  const issues = [];
  if (!clean(draft.vendorName)) issues.push('vendorName missing');
  if (!clean(draft.vendorId)) issues.push('vendor mapping missing');
  if (!lines.length) issues.push('no bill lines');
  if (!clean(draft.accountsPayable)) issues.push('accounts payable mapping missing');
  lines.forEach((line, idx) => { if (!line.accountName) issues.push(`line ${idx + 1} account missing`); });
  return {
    draftType: 'Bill',
    source: '86 Chaos invoice scan',
    invoiceId: clean(draft.invoiceId || ''),
    invoiceNumber: clean(draft.invoiceNumber || ''),
    invoiceDate: clean(draft.invoiceDate || ''),
    dueDate: clean(draft.dueDate || ''),
    vendorName: clean(draft.vendorName || ''),
    vendorId: clean(draft.vendorId || ''),
    vendorMatchSource: clean(draft.vendorMatchSource || ''),
    accountsPayable: clean(draft.accountsPayable || 'Accounts Payable'),
    totalAmount,
    lines,
    ownerApprovalRequired: true,
    sendStatus: 'not_sent',
    validationIssues: issues,
    quickBooksShape: {
      entity: 'Bill',
      note: 'Review-first payload prepared by 86 Chaos. Not sent unless server credentials, token storage, and owner approval are enabled.',
      vendorRef: draft.vendorId ? { value: draft.vendorId, name: draft.vendorName } : null,
      txnDate: draft.invoiceDate || null,
      docNumber: draft.invoiceNumber || null,
      totalAmt: totalAmount,
      lineCount: lines.length
    }
  };
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'POST only' });
  try {
    const { decoded } = await verifyUser(req);
    const body = await readBody(req);
    const mode = clean(body.mode || 'draft');
    const restaurantId = clean(body.restaurantId || '');
    const draft = normalizeDraft(body.draft || {});
    const canWriteLive = String(process.env.QUICKBOOKS_ALLOW_SERVER_WRITES || '').toLowerCase() === 'true';
    const hasClient = !!(process.env.QUICKBOOKS_CLIENT_ID || process.env.INTUIT_CLIENT_ID);
    const hasSecret = !!(process.env.QUICKBOOKS_CLIENT_SECRET || process.env.INTUIT_CLIENT_SECRET);
    const hasTokenStorage = !!(process.env.QUICKBOOKS_TOKEN_STORAGE_ENABLED || process.env.QUICKBOOKS_REFRESH_TOKEN);
    if (!restaurantId) return json(res, 400, { ok: false, message: 'restaurantId required' });
    if (mode === 'send') {
      const blockedReason = !canWriteLive ? 'QuickBooks live writes are disabled by server guardrail.'
        : !hasClient || !hasSecret ? 'QuickBooks client credentials are incomplete.'
        : !hasTokenStorage ? 'QuickBooks refresh-token storage is not configured.'
        : draft.validationIssues.length ? `Draft needs repair: ${draft.validationIssues.join(', ')}`
        : '';
      if (blockedReason) {
        return json(res, 200, {
          ok: true,
          sent: false,
          liveSyncEnabled: false,
          status: 'send_blocked',
          blockedReason,
          draft,
          requestedByUid: decoded.uid,
          message: 'Send blocked safely. Review mapping/credentials before any QuickBooks write.'
        });
      }
      return json(res, 200, {
        ok: true,
        sent: false,
        liveSyncEnabled: true,
        status: 'send_ready_not_implemented',
        draft,
        message: 'Live send guard passed, but the final QuickBooks write call is intentionally not implemented until token storage and callback QA are complete.'
      });
    }
    return json(res, 200, {
      ok: true,
      sent: false,
      liveSyncEnabled: false,
      status: draft.validationIssues.length ? 'needs_mapping' : 'draft_needs_review',
      validationIssues: draft.validationIssues,
      draft,
      message: draft.validationIssues.length ? 'Bill draft created, but mapping needs review.' : 'Bill draft created for owner/admin review. Nothing was sent to QuickBooks.'
    });
  } catch (error) {
    return json(res, 500, { ok: false, message: error?.message || 'QuickBooks bill draft failed safely.' });
  }
};
