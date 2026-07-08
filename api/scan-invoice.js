// 86chaos invoice scanner
// Extracts ALL visible invoice information from PDF or image files.
// 13.1.10: Large-document scanner keeps non-product rows out of Stock Matcher/inventory updates.

const INVOICE_SCANNER_VERSION = '15.0.1';

function cleanJsonText(text = '') {
  return String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

function extractFencedJson(text = '') {
  const match = String(text || '').match(/```(?:json)?\s*([\s\S]*?)```/i);
  return match ? match[1].trim() : '';
}

function extractBalancedJson(text = '') {
  return extractBalancedJsonCandidates(text)[0] || '';
}

function extractBalancedJsonCandidates(text = '') {
  const raw = String(text || '');
  const candidates = [];

  for (let start = 0; start < raw.length; start += 1) {
    const opener = raw[start];
    if (opener !== '{' && opener !== '[') continue;

    const stack = [opener === '{' ? '}' : ']'];
    let inString = false;
    let escaped = false;

    for (let i = start + 1; i < raw.length; i += 1) {
      const ch = raw[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{') stack.push('}');
      else if (ch === '[') stack.push(']');
      else if (ch === '}' || ch === ']') {
        if (stack[stack.length - 1] !== ch) break;
        stack.pop();
        if (stack.length === 0) {
          candidates.push(raw.slice(start, i + 1).trim());
          break;
        }
      }
    }
  }

  return candidates.sort((a, b) => b.length - a.length);
}

function repairTruncatedJson(text = '') {
  const raw = cleanJsonText(text);
  const start = raw.search(/[\[{]/);
  if (start < 0) return '';

  let out = '';
  const stack = [];
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];
    out += ch;

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') {
      if (stack[stack.length - 1] === ch) stack.pop();
    }
  }

  if (inString) out += '"';
  out = out.trimEnd();
  if (/[:]\s*$/.test(out)) out += ' null';
  if (/,\s*$/.test(out)) out = out.replace(/,\s*$/, '');
  while (stack.length) out += stack.pop();
  return out.trim();
}

function normalizeJsonCandidate(text = '') {
  return cleanJsonText(text)
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/:\s*(undefined|NaN|Infinity|-Infinity)\s*([,}\]])/g, ': null$2')
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_\-$]*)\s*:/g, '$1"$2":')
    .trim();
}

function parseGeminiJson(text = '') {
  const raw = String(text || '').trim();
  const fenced = extractFencedJson(raw);
  const balanced = extractBalancedJsonCandidates(raw);
  const fencedBalanced = extractBalancedJsonCandidates(fenced);
  const baseCandidates = [
    raw,
    cleanJsonText(raw),
    fenced,
    cleanJsonText(fenced),
    ...balanced,
    ...fencedBalanced,
    repairTruncatedJson(raw),
    repairTruncatedJson(fenced)
  ].filter(Boolean);

  const candidates = [];
  for (const candidate of baseCandidates) {
    candidates.push(candidate);
    candidates.push(normalizeJsonCandidate(candidate));
    candidates.push(repairTruncatedJson(candidate));
    candidates.push(normalizeJsonCandidate(repairTruncatedJson(candidate)));
  }

  for (const candidate of Array.from(new Set(candidates.filter(Boolean)))) {
    try { return JSON.parse(candidate); }
    catch (_) {}
  }

  throw new Error('No valid JSON object could be extracted from Gemini response.');
}

function parseMoneyNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const cleaned = String(value).replace(/[$,]/g, '').replace(/[()]/g, '-').trim();
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function normalizeRow(row, index, data = {}) {
  const r = row && typeof row === 'object' ? row : { rawText: String(row || '') };
  const itemName = r.itemName || r.description || r.name || r.rawText || `Invoice Row ${index + 1}`;
  const normalized = {
    rowIndex: r.rowIndex ?? index + 1,
    rowType: r.rowType || r.lineType || r.type || 'item',
    productCode: r.productCode || r.sku || r.itemNumber || r.itemCode || r.code || r.pfgCode || '',
    itemName,
    description: r.description || itemName,
    quantity: r.quantity ?? r.qty ?? r.shippedQty ?? r.receivedQty ?? '',
    orderedQty: r.orderedQty ?? '',
    shippedQty: r.shippedQty ?? r.receivedQty ?? '',
    backOrderedQty: r.backOrderedQty ?? '',
    packSize: r.packSize || r.pack || r.size || r.uom || '',
    uom: r.uom || r.unitOfMeasure || '',
    weight: r.weight || r.catchWeight || '',
    unitPrice: r.unitPrice ?? r.casePrice ?? r.priceEach ?? '',
    totalPrice: r.totalPrice ?? r.extendedPrice ?? r.lineTotal ?? '',
    tax: r.tax ?? '',
    discount: r.discount ?? '',
    deposit: r.deposit ?? '',
    rawText: r.rawText || '',
    confidence: r.confidence || data.confidence || '',
    ...r
  };
  normalized.isInventoryLine = isPurchasedProductRow(normalized);
  return normalized;
}

function isPurchasedProductRow(row = {}) {
  const rowType = String(row.rowType || row.lineType || row.type || '').toLowerCase();
  const itemName = String(row.itemName || row.description || row.name || row.rawText || '').trim();
  const raw = String(row.rawText || '').trim();
  const combined = `${rowType} ${itemName} ${raw}`.toLowerCase();

  if (!itemName || itemName.length < 2) return false;

  // Explicit non-stock document/admin rows. These should be saved in allExtractedRows only,
  // never pushed into Stock Matcher or inventory updates.
  if (/(header|footer|note|memo|terms|customer|bill\s*to|ship\s*to|sold\s*to|remit|address|phone|email|metadata|page|route|invoice\s*(number|date)?|statement|subtotal|grand\s*total|total\s*due|balance|tax|freight|delivery|fuel|service\s*charge|fee|charge|deposit|discount|credit|payment|amount\s*due|change\s*due|signature)/i.test(combined)) return false;
  if (/(^|\s)(from|to|cc|bcc|subject|sent|date):/i.test(itemName)) return false;
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(itemName) || /no\s*reply|noreply|do\s*not\s*reply/i.test(combined)) return false;
  if (/https?:\/\/|www\.|\.com\b|\.net\b|\.org\b/i.test(itemName) && !hasValue(row.quantity)) return false;

  const qty = parseMoneyNumber(row.quantity ?? row.qty ?? row.shippedQty ?? row.receivedQty ?? row.orderedQty);
  const unitPrice = parseMoneyNumber(row.unitPrice ?? row.priceEach ?? row.casePrice);
  const totalPrice = parseMoneyNumber(row.totalPrice ?? row.extendedPrice ?? row.lineTotal);
  const hasQuantity = qty > 0;
  const hasPrice = unitPrice > 0 || totalPrice > 0;
  const hasSku = hasValue(row.productCode || row.sku || row.itemNumber || row.itemCode || row.code || row.pfgCode);
  const hasPack = hasValue(row.packSize || row.pack || row.size || row.uom || row.unitOfMeasure || row.weight || row.catchWeight);

  // Product rows on restaurant invoices almost always have a quantity plus at least
  // one purchasing signal: SKU/code, pack/UOM, unit price, or line total.
  if (!hasQuantity) return false;
  if (!(hasPrice || hasSku || hasPack)) return false;

  // A $0 row with no SKU and no pack is almost always a header/contact artifact.
  if (!hasPrice && !hasSku && !hasPack) return false;

  return true;
}

function normalizeInvoicePayload(parsed) {
  const data = parsed && typeof parsed === 'object' ? parsed : {};
  const modelLineItems = Array.isArray(data.lineItems) ? data.lineItems : [];
  const allExtractedRows = Array.isArray(data.allExtractedRows)
    ? data.allExtractedRows
    : Array.isArray(data.invoiceRows)
      ? data.invoiceRows
      : modelLineItems;

  const normalizedAllRows = allExtractedRows.map((row, index) => normalizeRow(row, index, data));
  const normalizedModelLineItems = modelLineItems.map((row, index) => normalizeRow(row, index, data));

  // Stock Matcher must only receive physical products that were purchased/delivered.
  // Keep the rest in allExtractedRows/raw audit so invoice history remains complete.
  const productRows = (normalizedModelLineItems.length ? normalizedModelLineItems : normalizedAllRows)
    .filter(isPurchasedProductRow)
    .map(row => ({ ...row, isInventoryLine: true }));

  const skippedRows = normalizedAllRows
    .filter(row => !isPurchasedProductRow(row))
    .map(row => ({ ...row, isInventoryLine: false }));

  return {
    vendorName: data.vendorName || data.vendor || data.supplierName || '',
    vendorAddress: data.vendorAddress || '',
    vendorPhone: data.vendorPhone || '',
    customerName: data.customerName || '',
    customerNumber: data.customerNumber || '',
    shipTo: data.shipTo || '',
    billTo: data.billTo || '',
    invoiceNumber: data.invoiceNumber || data.invoiceNo || data.documentNumber || '',
    invoiceDate: data.invoiceDate || data.date || '',
    dueDate: data.dueDate || '',
    deliveryDate: data.deliveryDate || '',
    poNumber: data.poNumber || data.purchaseOrder || '',
    routeNumber: data.routeNumber || '',
    salesperson: data.salesperson || data.rep || '',
    paymentTerms: data.paymentTerms || data.terms || '',
    subtotal: data.subtotal ?? '',
    taxTotal: data.taxTotal ?? data.tax ?? '',
    freightTotal: data.freightTotal ?? data.freight ?? data.deliveryFee ?? '',
    depositTotal: data.depositTotal ?? '',
    discountTotal: data.discountTotal ?? '',
    invoiceTotal: data.invoiceTotal ?? data.grandTotal ?? data.total ?? 0,
    balanceDue: data.balanceDue ?? '',
    charges: Array.isArray(data.charges) ? data.charges : [],
    credits: Array.isArray(data.credits) ? data.credits : [],
    payments: Array.isArray(data.payments) ? data.payments : [],
    lineItems: productRows,
    allExtractedRows: normalizedAllRows,
    skippedRows,
    rawTranscription: data.rawTranscription || data.fullText || '',
    extractionNotes: data.extractionNotes || [],
    extractionWarnings: data.extractionWarnings || [],
    confidence: data.confidence || 'review',
    scannerVersion: INVOICE_SCANNER_VERSION
  };
}

const admin = require('firebase-admin');

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    try { return JSON.parse(raw); }
    catch (err) { throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON.'); }
  }
  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  };
}

function initAdmin() {
  if (admin.apps.length) return admin.app();
  const serviceAccount = loadServiceAccount();
  const projectId = serviceAccount.project_id || serviceAccount.projectId;
  if (!projectId) throw new Error('Missing Firebase service account project id. Set FIREBASE_SERVICE_ACCOUNT_KEY in Vercel.');
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;
  return admin.initializeApp({ credential: admin.credential.cert(serviceAccount), storageBucket });
}

async function verifySignedIn(req, adminApp) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) throw new Error('Missing authorization token. Please log in again.');
  return adminApp.auth().verifyIdToken(token);
}

function sanitizeStoragePath(path = '') {
  const clean = String(path || '').replace(/^\/+/, '');
  if (!clean || clean.includes('..')) throw new Error('Invalid scan file path.');
  return clean;
}

function detectMimeType(fileName = '', providedMime = '') {
  const lower = String(fileName || '').toLowerCase();
  if (providedMime && providedMime !== 'application/octet-stream') return providedMime;
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

async function readScanSource(reqBody, req, adminApp) {
  const body = reqBody || {};
  const fileName = body.fileName || 'invoice';
  const mimeType = detectMimeType(fileName, body.mimeType || '');

  // Preferred production path: browser uploads file directly to Firebase Storage,
  // then sends only the small storage path to Vercel. This avoids Vercel request limits.
  if (body.storagePath) {
    const decoded = await verifySignedIn(req, adminApp);
    const storagePath = sanitizeStoragePath(body.storagePath);
    const expectedRest = String(body.restaurantId || '').trim();
    if (expectedRest && !storagePath.startsWith(`${expectedRest}/`)) {
      throw new Error('Scan file path does not match the selected workspace.');
    }
    const bucket = adminApp.storage().bucket();
    const [buffer] = await bucket.file(storagePath).download();
    const pdfLike = mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
    const maxBytes = pdfLike
      ? parseInt(process.env.INVOICE_SCAN_MAX_PDF_BYTES || String(100 * 1024 * 1024), 10)
      : parseInt(process.env.INVOICE_SCAN_MAX_IMAGE_BYTES || String(100 * 1024 * 1024), 10);
    if (buffer.length > maxBytes) {
      const mb = Math.round(maxBytes / (1024 * 1024));
      throw new Error(`Invoice file is over the current ${mb}MB scanner limit. Split it into smaller files or scan fewer pages at once.`);
    }
    return {
      fileBase64: null,
      fileBuffer: buffer,
      mimeType,
      fileName,
      source: 'firebase-storage',
      storagePath,
      decodedUid: decoded.uid,
      originalBytes: buffer.length
    };
  }

  // Legacy/fallback path for small images only. Large files should use storagePath.
  if (!body.fileBase64) throw new Error('Missing scan file. Please upload the invoice again.');
  const fileBase64 = String(body.fileBase64).replace(/^data:[^;]+;base64,/, '');
  return {
    fileBase64,
    fileBuffer: null,
    mimeType,
    fileName,
    source: 'inline-base64',
    originalBytes: Math.round((fileBase64.length * 3) / 4)
  };
}

async function uploadToGeminiFiles(apiKey, scanSource) {
  const fileBuffer = scanSource.fileBuffer;
  if (!Buffer.isBuffer(fileBuffer) || !fileBuffer.length) throw new Error('No invoice file buffer available for Gemini upload.');

  const startResponse = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(fileBuffer.length),
      'X-Goog-Upload-Header-Content-Type': scanSource.mimeType,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      file: {
        display_name: scanSource.fileName || 'invoice'
      }
    })
  });

  if (!startResponse.ok) {
    const raw = await startResponse.text();
    throw new Error(`Gemini file upload could not start. ${raw.slice(0, 500)}`);
  }

  const uploadUrl = startResponse.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('Gemini did not return a file upload URL.');

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(fileBuffer.length),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize'
    },
    body: fileBuffer
  });

  const uploadRaw = await uploadResponse.text();
  if (!uploadResponse.ok) {
    throw new Error(`Gemini file upload failed. ${uploadRaw.slice(0, 700)}`);
  }

  let uploadJson;
  try { uploadJson = JSON.parse(uploadRaw); }
  catch (err) { throw new Error(`Gemini file upload returned invalid JSON. ${uploadRaw.slice(0, 500)}`); }

  const file = uploadJson.file || uploadJson;
  if (!file?.uri) throw new Error('Gemini file upload finished but did not return a file URI.');
  return waitForGeminiFileActive(apiKey, file);
}

async function waitForGeminiFileActive(apiKey, file) {
  if (!file?.name) return file;
  let current = file;
  const maxWaitMs = parseInt(process.env.INVOICE_FILE_READY_TIMEOUT_MS || '90000', 10);
  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    const state = String(current.state || '').toUpperCase();
    if (!state || state === 'ACTIVE' || state === 'STATE_UNSPECIFIED') return current;
    if (state === 'FAILED') throw new Error('Gemini could not process the uploaded invoice file. Try rescanning or exporting the PDF again.');
    await new Promise(resolve => setTimeout(resolve, 2500));
    const check = await fetch(`https://generativelanguage.googleapis.com/v1beta/${current.name}?key=${encodeURIComponent(apiKey)}`);
    const raw = await check.text();
    if (!check.ok) throw new Error(`Could not check Gemini invoice file status. ${raw.slice(0, 500)}`);
    current = JSON.parse(raw);
  }

  throw new Error('Gemini is still preparing this invoice file. Try again in a minute, or scan fewer pages at once.');
}

async function deleteGeminiFileQuietly(apiKey, file) {
  try {
    if (!file?.name) return;
    await fetch(`https://generativelanguage.googleapis.com/v1beta/${file.name}?key=${encodeURIComponent(apiKey)}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('Could not delete temporary Gemini file:', err?.message || err);
  }
}

function buildInvoicePrompt({ compact = false } = {}) {
  const compactRules = compact ? `
Compact retry mode:
- The previous scan response was not usable JSON, usually because the model produced too much text or cut off the ending.
- Return a smaller JSON object that still includes vendor/invoice totals, all purchased product rows, and clear skipped/non-product rows.
- Keep rawTranscription short. If output size becomes risky, omit long prose before ever truncating JSON.
- Close every array/object. Valid JSON matters more than extra notes.` : '';

  return `
You are the invoice extraction engine for a restaurant inventory system.

Your job: extract invoice data for restaurant inventory. Extract product rows separately from document/header/account rows.

Rules:
- Return ONLY valid JSON. No markdown.
- Do not summarize.
- Do not skip tiny rows, handwritten notes, fees, credits, taxes, deposits, totals, PO numbers, terms, route numbers, vendor/customer info, page numbers, or footer notes.
- lineItems MUST contain ONLY physical products purchased/delivered that should be eligible to update inventory stock.
- Do NOT put email addresses, From/To/Subject lines, vendor contact info, customer/bill-to/ship-to fields, headers, footers, page numbers, terms, totals, taxes, freight, deposits, fees, discounts, credits, payments, balances, notes, signatures, or account metadata in lineItems.
- Preserve every visible line/row in allExtractedRows, even if it is not an inventory item.
- If a value is unclear, include it as bestGuess and add a warning.
- Keep strings short and JSON-safe. Escape quotation marks inside values.
- rawTranscription may be a compact readable summary of the whole document; do not let rawTranscription make the JSON too large.
- For inventory/product rows only, include quantity, orderedQty, shippedQty, backOrderedQty, productCode/SKU/itemNumber, itemName, packSize, UOM, weight/catchWeight, unitPrice, totalPrice, tax, discount, deposit, and rawText.
- Mark non-product rows in allExtractedRows with rowType such as tax, freight, deposit, subtotal, total, discount, credit, payment, note, header, footer, contact, customer, metadata.
- For catch-weight foods like chicken, beef, fish, cheese, and produce, include weight and weightPerCaseLbs when visible or strongly implied by pack size.
- For longer multipage invoices, keep going until every visible product row is represented in lineItems and every visible row is represented in allExtractedRows.
${compactRules}
Return this JSON shape:
{
  "vendorName": "",
  "vendorAddress": "",
  "vendorPhone": "",
  "customerName": "",
  "customerNumber": "",
  "shipTo": "",
  "billTo": "",
  "invoiceNumber": "",
  "invoiceDate": "",
  "dueDate": "",
  "deliveryDate": "",
  "poNumber": "",
  "routeNumber": "",
  "salesperson": "",
  "paymentTerms": "",
  "subtotal": 0,
  "taxTotal": 0,
  "freightTotal": 0,
  "depositTotal": 0,
  "discountTotal": 0,
  "invoiceTotal": 0,
  "balanceDue": 0,
  "charges": [],
  "credits": [],
  "payments": [],
  "lineItems": [],
  "allExtractedRows": [],
  "rawTranscription": "",
  "extractionNotes": [],
  "extractionWarnings": [],
  "confidence": "high|medium|low|review"
}`;
}

function getInvoiceModelCandidates() {
  const configured = process.env.INVOICE_SCAN_GEMINI_MODEL || process.env.GEMINI_INVOICE_MODEL || process.env.GEMINI_MODEL || '';
  return Array.from(new Set([
    configured,
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ].map(v => String(v || '').trim()).filter(Boolean)));
}

async function repairGeminiJsonWithModel({ apiKey, model, badText, scanInputMethod }) {
  const trimmed = String(badText || '').slice(0, 60000);
  if (!trimmed) throw new Error('No Gemini text was available for JSON repair.');
  const repairPrompt = `You are a JSON repair engine for an invoice scanner. Return ONLY valid JSON. Do not add markdown. Preserve all usable invoice fields and line rows from the broken text. If the text is cut off, keep the complete rows that are present, close every object/array, and add an extractionWarnings entry that says the AI response had to be repaired. Broken text:\n${trimmed}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: repairPrompt }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      maxOutputTokens: parseInt(process.env.INVOICE_REPAIR_MAX_OUTPUT_TOKENS || '32768', 10)
    }
  };
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const timeoutMs = parseInt(process.env.INVOICE_REPAIR_TIMEOUT_MS || '45000', 10);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
  const raw = await response.text();
  if (!response.ok) throw new Error(`Gemini JSON repair failed. ${raw.slice(0, 700)}`);
  let gemini;
  try { gemini = JSON.parse(raw || '{}'); }
  catch (_) { throw new Error('Gemini JSON repair route returned non-JSON API output.'); }
  const text = gemini?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
  const parsed = parseGeminiJson(text);
  if (parsed && typeof parsed === 'object') {
    parsed.extractionWarnings = Array.isArray(parsed.extractionWarnings) ? parsed.extractionWarnings : [];
    parsed.extractionWarnings.push(`Scanner repaired a malformed Gemini JSON response from ${scanInputMethod}.`);
  }
  return { parsed, repairModel: model, repairFinishReason: gemini?.candidates?.[0]?.finishReason || '' };
}

function getGeminiCandidateText(gemini = {}) {
  return gemini?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
}

function getGeminiFinishReason(gemini = {}) {
  return gemini?.candidates?.[0]?.finishReason || '';
}

function isModelFallbackError(message = '') {
  return /not found|not supported|unsupported|unavailable|deprecated|permission denied for model|model.*not/i.test(String(message || ''));
}

async function callGeminiGenerate({ apiKey, model, body, timeoutMs }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  const raw = await response.text();
  if (!response.ok) {
    let message = raw;
    try { message = JSON.parse(raw)?.error?.message || raw; }
    catch (_) {}
    const err = new Error(message || `Gemini invoice scan failed with ${response.status}.`);
    err.status = response.status;
    err.raw = raw;
    throw err;
  }

  let gemini;
  try { gemini = JSON.parse(raw || '{}'); }
  catch (err) {
    const apiErr = new Error(`Gemini invoice scan returned non-JSON API output. ${raw.slice(0, 700)}`);
    apiErr.raw = raw;
    throw apiErr;
  }
  return gemini;
}

function createGenerationBody(prompt, filePart, { compact = false } = {}) {
  const maxOutputTokens = parseInt(
    compact
      ? (process.env.INVOICE_SCAN_COMPACT_MAX_OUTPUT_TOKENS || '32768')
      : (process.env.INVOICE_SCAN_MAX_OUTPUT_TOKENS || '65536'),
    10
  );
  return {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        filePart
      ]
    }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      maxOutputTokens
    }
  };
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let scanSource = null;
  let geminiFile = null;
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing GEMINI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or GOOGLE_API_KEY in Vercel.' });

    const adminApp = initAdmin();
    scanSource = await readScanSource(req.body || {}, req, adminApp);
    const { mimeType = 'image/jpeg', fileName = 'invoice' } = scanSource;
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const inputMode = String(process.env.INVOICE_SCAN_INPUT_MODE || 'files').toLowerCase();
    const useGeminiFiles = inputMode !== 'inline' && scanSource.source === 'firebase-storage' && Buffer.isBuffer(scanSource.fileBuffer);

    let filePart;
    let scanInputMethod = 'inline-base64';

    if (useGeminiFiles) {
      geminiFile = await uploadToGeminiFiles(apiKey, scanSource);
      filePart = { fileData: { mimeType, fileUri: geminiFile.uri } };
      scanInputMethod = 'gemini-files-api';
    } else {
      const fileBase64 = scanSource.fileBase64 || scanSource.fileBuffer?.toString('base64');
      if (!fileBase64) throw new Error('No invoice file data available to scan.');
      filePart = { inlineData: { mimeType, data: fileBase64 } };
    }

    const timeoutMs = parseInt(process.env.INVOICE_SCAN_TIMEOUT_MS || '285000', 10);
    const modelCandidates = getInvoiceModelCandidates();
    let parsed = null;
    let usedModel = '';
    let usedAttempt = '';
    let finishReason = '';
    let repairModel = '';
    let lastFailure = null;

    for (const candidateModel of modelCandidates) {
      const attempts = [
        { name: 'full-json', compact: false },
        { name: 'compact-json-retry', compact: true }
      ];

      for (const attempt of attempts) {
        try {
          const prompt = buildInvoicePrompt({ compact: attempt.compact });
          const body = createGenerationBody(prompt, filePart, { compact: attempt.compact });
          const gemini = await callGeminiGenerate({ apiKey, model: candidateModel, body, timeoutMs });
          const text = getGeminiCandidateText(gemini);
          finishReason = getGeminiFinishReason(gemini);
          if (!text) throw new Error('Gemini returned no invoice text.');

          try {
            parsed = parseGeminiJson(text);
          } catch (parseErr) {
            lastFailure = parseErr;
            const wasTruncated = /MAX_TOKENS|LENGTH/i.test(finishReason) || !extractBalancedJson(text);
            if (!attempt.compact && wasTruncated) {
              // A cut-off first pass should be rescanned in compact mode instead of trying to save a half invoice.
              continue;
            }
            try {
              const repaired = await repairGeminiJsonWithModel({ apiKey, model: candidateModel, badText: text, scanInputMethod });
              parsed = repaired.parsed;
              repairModel = repaired.repairModel;
              finishReason = repaired.repairFinishReason || finishReason;
            } catch (repairErr) {
              lastFailure = repairErr;
              if (!attempt.compact) continue;
              throw repairErr;
            }
          }

          if (parsed) {
            usedModel = candidateModel;
            usedAttempt = attempt.name;
            break;
          }
        } catch (err) {
          lastFailure = err;
          if (isModelFallbackError(err.message)) break;
          if (!attempt.compact) continue;
        }
      }
      if (parsed) break;
    }

    if (!parsed) {
      return res.status(502).json({
        error: 'Gemini returned invalid JSON after repair attempts.',
        details: lastFailure?.message || 'Could not parse invoice scan response.',
        scanInputMethod,
        scanSource: scanSource?.source || 'unknown',
        fileName: scanSource?.fileName || fileName,
        originalBytes: scanSource?.originalBytes || null,
        scannerVersion: INVOICE_SCANNER_VERSION
      });
    }

    const normalized = normalizeInvoicePayload(parsed);
    normalized.scanFileName = fileName;
    normalized.scanMimeType = mimeType;
    normalized.scanSource = scanSource?.source || 'unknown';
    normalized.scanInputMethod = scanInputMethod;
    normalized.scanStoragePath = scanSource?.storagePath || '';
    normalized.scanOriginalBytes = scanSource?.originalBytes || null;
    normalized.geminiFileName = geminiFile?.name || '';
    normalized.processedAt = new Date().toISOString();
    normalized.scannerVersion = INVOICE_SCANNER_VERSION;
    normalized.scanModel = usedModel || model;
    normalized.scanAttempt = usedAttempt || 'full-json';
    normalized.scanFinishReason = finishReason || '';
    normalized.scanRepairModel = repairModel || '';

    if (geminiFile) deleteGeminiFileQuietly(apiKey, geminiFile);
    return res.status(200).json(normalized);
  } catch (err) {
    const isTimeout = err?.name === 'AbortError';
    const message = isTimeout
      ? 'Invoice scanner needed more time while AI was reading the file. Try again once, or scan fewer pages if this keeps happening.'
      : (err.message || 'Invoice scanner failed.');
    const status = isTimeout ? 504 : (/authorization|token|permission|login/i.test(message) ? 401 : 500);
    return res.status(status).json({
      error: message,
      hint: message.toLowerCase().includes('payload')
        ? 'Upload the invoice through Firebase Storage mode instead of sending it through Vercel.'
        : undefined,
      scanSource: scanSource?.source || 'unknown',
      scannerVersion: INVOICE_SCANNER_VERSION
    });
  }
}

module.exports = handler;
module.exports.config = {
  maxDuration: 300,
  memory: 1024
};
