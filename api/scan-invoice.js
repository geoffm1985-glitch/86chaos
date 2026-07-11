const { enforceRateLimit, sendRateLimited } = require('./_rate-limit');
const {
  inferInvoiceProductFields,
  classifyInvoiceRow,
  isPurchasedProductRow,
  productRowKey
} = require('./_invoice-classification');

// 86chaos invoice scanner
// Extracts ALL visible invoice information from PDF or image files.
// 13.1.10: Large-document scanner keeps non-product rows out of Stock Matcher/inventory updates.

const INVOICE_SCANNER_VERSION = '15.0.53';

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
  normalized.isInventoryLine = ['stock', 'non_food'].includes(classifyInvoiceRow(normalized).kind);
  return normalized;
}

function normalizeInvoicePayload(parsed) {
  const data = parsed && typeof parsed === 'object' ? parsed : {};
  const modelLineItems = Array.isArray(data.lineItems) ? data.lineItems : [];
  const allExtractedRows = Array.isArray(data.allExtractedRows)
    ? data.allExtractedRows
    : Array.isArray(data.invoiceRows)
      ? data.invoiceRows
      : modelLineItems;

  const annotateRow = (row, index) => {
    const normalized = normalizeRow(inferInvoiceProductFields(row), index, data);
    const classification = classifyInvoiceRow(normalized);
    return {
      ...normalized,
      ...classification.row,
      scannerClassification: classification.kind,
      classificationReason: classification.reason,
      classificationCategory: classification.category,
      isInventoryLine: ['stock', 'non_food'].includes(classification.kind)
    };
  };

  const normalizedAllRows = allExtractedRows.map(annotateRow);
  const normalizedModelLineItems = modelLineItems.map(annotateRow);

  // Build Stock Matcher from BOTH model lineItems and every extracted row. Food products
  // and purchased non-food supplies are both inventory candidates so gloves, paper goods,
  // chemicals, containers, and similar purchases cannot disappear behind an automatic filter.
  const productMap = new Map();
  [...normalizedModelLineItems, ...normalizedAllRows]
    .filter(row => ['stock', 'non_food'].includes(row.scannerClassification))
    .forEach(row => {
      const key = productRowKey(row);
      const existing = productMap.get(key) || {};
      productMap.set(key, {
        ...existing,
        ...row,
        isInventoryLine: true,
        rowType: row.scannerClassification === 'non_food' ? 'non_food_supply' : 'product'
      });
    });
  const productRows = Array.from(productMap.values());
  const productKeys = new Set(productRows.map(productRowKey));

  // Needs Review contains only purchase-like rows that lack enough evidence. Headers,
  // addresses, totals, tax, fees, and other document noise stay out of inventory.
  const reviewMap = new Map();
  normalizedAllRows
    .filter(row => row.scannerClassification === 'review')
    .filter(row => !productKeys.has(productRowKey(row)))
    .forEach(row => reviewMap.set(productRowKey(row), { ...row, isInventoryLine: false }));
  const skippedRows = Array.from(reviewMap.values());
  const ignoredDocumentRowCount = normalizedAllRows.filter(row => row.scannerClassification === 'document').length;

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
    ignoredDocumentRowCount,
    rawTranscription: data.rawTranscription || data.fullText || '',
    extractionNotes: data.extractionNotes || [],
    extractionWarnings: data.extractionWarnings || [],
    confidence: data.confidence || 'review',
    scannerVersion: INVOICE_SCANNER_VERSION
  };
}

const admin = require('firebase-admin');
const { getAdminAppForRequest, verifyRequestToken } = require('./_firebase-project-admin');
const {
  getIdempotencyKey,
  resolveScanPageCount,
  authorizeAiScanWorkspace,
  checkAndReserveAiScanPages,
  completeAiScanUsageEvent,
  cancelAiScanReservation,
  buildLimitResponse,
  buildDuplicateResponse
} = require('./_ai-usage');
const {
  getAllowedGeminiModels,
  getHardOutputTokenLimit,
  getHardInputByteLimit,
  getHardRateLimit,
  createProviderCallBudget,
  assertInputWithinHardLimit,
  assertPageCountWithinHardLimit,
  detectMimeTypeFromBuffer,
  assertImageDimensionsWithinHardLimit
} = require('./_ai-policy');

function initAdmin(req) {
  return getAdminAppForRequest(req, { requireCredentials: true });
}
function appCheckEnforced() {
  return ['true', '1', 'yes', 'enforce'].includes(String(process.env.APP_CHECK_ENFORCE || '').toLowerCase().trim());
}
async function requireAppCheckIfEnforced(adminApp, req) {
  if (!appCheckEnforced()) return { ok: true };
  const token = String(req.headers['x-firebase-appcheck'] || req.headers['X-Firebase-AppCheck'] || '').trim();
  if (!token) return { ok: false, status: 401, error: 'App Check verification is required. Refresh the app after deployment and try again.' };
  try {
    const verifier = typeof adminApp?.appCheck === 'function' ? adminApp.appCheck() : (typeof admin.appCheck === 'function' ? admin.appCheck(adminApp) : null);
    if (!verifier || typeof verifier.verifyToken !== 'function') throw new Error('Firebase Admin App Check verifier is not available in this runtime.');
    await verifier.verifyToken(token);
    return { ok: true };
  } catch (err) {
    return { ok: false, status: 401, error: `App Check verification failed: ${err.message}` };
  }
}


function requireTenantStoragePath(path = '', restaurantId = '', folder = '') {
  const clean = String(path || '').trim().replace(/^\/+/, '');
  const expectedRestaurantId = String(restaurantId || '').trim();
  const segments = clean.split('/');
  const invalid = !clean ||
    !expectedRestaurantId ||
    clean.includes('\\') ||
    segments.length < 3 ||
    segments[0] !== expectedRestaurantId ||
    segments[1] !== folder ||
    segments.slice(2).some(segment => !segment || segment === '.' || segment === '..');
  if (invalid) {
    const error = new Error('Invoice scan path must be inside this workspace\'s approved invoices folder.');
    error.statusCode = 403;
    throw error;
  }
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

async function readScanSource(reqBody, req, adminApp, authContext) {
  const body = reqBody || {};
  const fileName = body.fileName || 'invoice';
  const mimeType = detectMimeType(fileName, body.mimeType || '');
  const compression = body.compression && typeof body.compression === 'object' ? body.compression : null;

  // Preferred production path: browser uploads file directly to Firebase Storage,
  // then sends only the small storage path to Vercel. This avoids Vercel request limits.
  if (body.storagePath) {
    const expectedRest = String(body.restaurantId || '').trim();
    const storagePath = requireTenantStoragePath(body.storagePath, expectedRest, 'invoices');
    let metadata = {};
    let storageMimeType = '';
    let buffer;
    const preliminaryMimeType = detectMimeType(fileName, mimeType);
    const pdfLike = preliminaryMimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
    const maxBytes = getHardInputByteLimit('invoice', pdfLike
      ? process.env.INVOICE_SCAN_MAX_PDF_BYTES
      : process.env.INVOICE_SCAN_MAX_IMAGE_BYTES);

    if (!adminApp) {
      const err = new Error('Secure invoice storage verification is unavailable. Try the upload again.');
      err.statusCode = 503;
      throw err;
    }
    const bucket = adminApp.storage().bucket();
    const scanFile = bucket.file(storagePath);
    [metadata] = await scanFile.getMetadata().catch(() => ([{}]));
    storageMimeType = metadata?.contentType && metadata.contentType !== 'application/octet-stream' ? metadata.contentType : '';
    const uploadPurpose = metadata?.metadata?.purpose || '';
    if (uploadPurpose !== 'invoice-scan') {
      const err = new Error('This uploaded file is not marked as an invoice scan. Upload it again from Invoice Scanner.');
      err.statusCode = 400;
      throw err;
    }
    const reportedBytes = Number(metadata?.size || 0);
    if (reportedBytes && reportedBytes > maxBytes) {
      const err = new Error(`Invoice file is over the current ${Math.round(maxBytes / 1048576)}MB scanner limit.`);
      err.statusCode = 413;
      throw err;
    }
    [buffer] = await scanFile.download();

    const effectiveMimeType = detectMimeType(fileName, storageMimeType || mimeType);
    if (!/^image\//i.test(effectiveMimeType) && effectiveMimeType !== 'application/pdf') {
      const err = new Error('Invoice scans must be an image or PDF.');
      err.statusCode = 415;
      throw err;
    }
    if (buffer.length > maxBytes) {
      const err = new Error(`Invoice file is over the current ${Math.round(maxBytes / 1048576)}MB scanner limit.`);
      err.statusCode = 413;
      throw err;
    }
    return {
      fileBase64: null,
      fileBuffer: buffer,
      mimeType: effectiveMimeType,
      fileName,
      source: 'firebase-storage',
      storagePath,
      decodedUid: authContext.decoded.uid,
      originalBytes: buffer.length,
      compression
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
    originalBytes: Math.round((fileBase64.length * 3) / 4),
    compression
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
- lineItems MUST contain every purchased inventory item that a restaurant may need to count, including food, beverages, ingredients, paper goods, disposables, cleaning supplies, PPE, maintenance supplies, office supplies, and reusable smallwares/equipment.
- Distributor rows may be one dense OCR string. A row beginning with a purchased quantity and unit such as "1 CS", "2 EA", or "3 PK" is normally a product row when it also contains a pack size, SKU/product code, description, or price.
- Parse dense product strings into quantity, UOM, packSize, productCode, itemName, unitPrice, and totalPrice instead of putting the whole row in skipped/non-product output.
- A row with a strong purchase signature such as quantity + case/unit + pack/SKU/description is a product even if OCR or an earlier classifier mislabeled its rowType as note, header, or metadata.
- Do not classify chicken, meat, dairy, produce, sauces, dressings, or beverages as notes merely because their row formatting is unusual.
- Purchased non-food supplies MUST be placed in lineItems so they reach inventory matching. Examples: napkins, paper towels, gloves, chemicals, sanitizer, foil, plastic wrap, disposable cups/lids/straws/cutlery, takeout containers, trash bags, cleaning tools, office supplies, maintenance parts, and reusable equipment. Mark them with a specific rowType such as non_food_supply, cleaning_supply, packaging_supply, disposable_supply, equipment, or maintenance_supply.
- Do NOT put email addresses, From/To/Subject lines, vendor contact info, customer/bill-to/ship-to fields, headers, footers, page numbers, terms, totals, taxes, freight, deposits, fees, discounts, credits, payments, balances, notes, signatures, or account metadata in lineItems.
- Preserve every visible line/row in allExtractedRows, even if it is not an inventory item.
- If a value is unclear, include it as bestGuess and add a warning.
- Keep strings short and JSON-safe. Escape quotation marks inside values.
- rawTranscription may be a compact readable summary of the whole document; do not let rawTranscription make the JSON too large.
- For every purchased inventory row, including non-food supplies, include quantity, orderedQty, shippedQty, backOrderedQty, productCode/SKU/itemNumber, itemName, packSize, UOM, weight/catchWeight, unitPrice, totalPrice, tax, discount, deposit, and rawText.
- Mark non-product rows in allExtractedRows with rowType such as tax, freight, deposit, subtotal, total, discount, credit, payment, note, header, footer, contact, customer, metadata.
- Mark obvious purchased non-food supplies with a specific non-food rowType and include them in lineItems. They must be matched to inventory or deliberately added as a new inventory item before approval.
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
  const configured = process.env.INVOICE_SCAN_GEMINI_MODEL || process.env.GEMINI_INVOICE_MODEL || '';
  return getAllowedGeminiModels({
    feature: 'invoice',
    configured,
    defaults: ['gemini-2.5-flash-lite']
  });
}

async function repairGeminiJsonWithModel({ apiKey, model, badText, scanInputMethod, callBudget }) {
  const trimmed = String(badText || '').slice(0, 60000);
  if (!trimmed) throw new Error('No Gemini text was available for JSON repair.');
  const repairPrompt = `You are a JSON repair engine for an invoice scanner. Return ONLY valid JSON. Do not add markdown. Preserve all usable invoice fields and line rows from the broken text. If the text is cut off, keep the complete rows that are present, close every object/array, and add an extractionWarnings entry that says the AI response had to be repaired. Broken text:\n${trimmed}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: repairPrompt }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      maxOutputTokens: getHardOutputTokenLimit('invoice', process.env.INVOICE_REPAIR_MAX_OUTPUT_TOKENS, 'repair')
    }
  };
  callBudget.consume({ model, attempt: 'json-repair' });
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
  return {
    parsed,
    repairModel: model,
    repairFinishReason: gemini?.candidates?.[0]?.finishReason || '',
    inputTokens: Number(gemini?.usageMetadata?.promptTokenCount || 0),
    outputTokens: Number(gemini?.usageMetadata?.candidatesTokenCount || 0)
  };
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

async function callGeminiGenerate({ apiKey, model, body, timeoutMs, callBudget, attempt }) {
  callBudget.consume({ model, attempt });
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
  const maxOutputTokens = getHardOutputTokenLimit(
    'invoice',
    compact ? process.env.INVOICE_SCAN_COMPACT_MAX_OUTPUT_TOKENS : process.env.INVOICE_SCAN_MAX_OUTPUT_TOKENS,
    compact ? 'compact' : 'primary'
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

const invoiceScanMemoryRate = new Map();
function allowInvoiceScanWithoutDb(decoded, limit = 10, windowMs = 60 * 1000) {
  const key = String(decoded?.uid || decoded?.email || 'unknown');
  const now = Date.now();
  const row = invoiceScanMemoryRate.get(key) || { startedAt: now, count: 0 };
  if (now - row.startedAt >= windowMs) { row.startedAt = now; row.count = 0; }
  row.count += 1;
  invoiceScanMemoryRate.set(key, row);
  return row.count <= limit;
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let scanSource = null;
  let geminiFile = null;
  let usageReservation = null;
  let usageDb = null;
  let providerCallStarted = false;
  let usedModel = '';
  let providerCallBudget = null;
  let estimatedInputTokens = 0;
  let estimatedOutputTokens = 0;
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const restaurantId = String(body.restaurantId || '').trim();
    if (!restaurantId) return res.status(400).json({ error: 'restaurantId is required.' });

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing GEMINI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or GOOGLE_API_KEY in Vercel.' });

    const authContext = await verifyRequestToken(req, { requireProjectCredentials: true });
    const adminApp = authContext.app || initAdmin(req);
    const access = await authorizeAiScanWorkspace({ app: adminApp, decoded: authContext.decoded, restaurantId, scanType: 'invoice' });
    usageDb = access.db;
    const appCheck = await requireAppCheckIfEnforced(adminApp, req);
    if (!appCheck.ok) return res.status(appCheck.status || 401).json({ error: appCheck.error });
    const scanLimit = getHardRateLimit('invoice', process.env.SCAN_INVOICE_RATE_LIMIT);
    const invoiceRate = await enforceRateLimit({ db: usageDb, req, decoded: authContext.decoded, routeName: 'scan-invoice', limit: scanLimit, windowMs: 60 * 1000 });
    if (!invoiceRate.ok) return sendRateLimited(res, invoiceRate);

    scanSource = await readScanSource(body, req, adminApp, authContext);
    const { fileName = 'invoice' } = scanSource;
    const pageBuffer = scanSource.fileBuffer || (scanSource.fileBase64 ? Buffer.from(scanSource.fileBase64, 'base64') : null);
    assertInputWithinHardLimit('invoice', pageBuffer?.length || scanSource.originalBytes || 0);
    const mimeType = detectMimeTypeFromBuffer(pageBuffer, scanSource.mimeType || 'image/jpeg');
    scanSource.mimeType = mimeType;
    assertImageDimensionsWithinHardLimit('invoice', pageBuffer, mimeType);
    const pageCount = await resolveScanPageCount({ mimeType, buffer: pageBuffer });
    assertPageCountWithinHardLimit('invoice', pageCount);
    const modelCandidates = getInvoiceModelCandidates();
    const idempotencyKey = getIdempotencyKey(req, body);

    usageReservation = await checkAndReserveAiScanPages({
      db: usageDb,
      restaurantId,
      scanType: 'invoice',
      pageCount,
      decoded: authContext.decoded,
      idempotencyKey,
      provider: 'google_gemini',
      model: modelCandidates[0] || 'gemini-2.5-flash-lite',
      sourceRoute: '/api/scan-invoice'
    });
    if (usageReservation.blocked) return res.status(429).json(buildLimitResponse(usageReservation));
    if (usageReservation.duplicate) return res.status(409).json(buildDuplicateResponse(usageReservation));

    const model = modelCandidates[0];
    const inputMode = String(process.env.INVOICE_SCAN_INPUT_MODE || 'files').toLowerCase();
    const useGeminiFiles = inputMode !== 'inline' && scanSource.source === 'firebase-storage' && Buffer.isBuffer(scanSource.fileBuffer);

    let filePart;
    let scanInputMethod = 'inline-base64';

    if (useGeminiFiles) {
      providerCallStarted = true;
      geminiFile = await uploadToGeminiFiles(apiKey, scanSource);
      filePart = { fileData: { mimeType, fileUri: geminiFile.uri } };
      scanInputMethod = 'gemini-files-api';
    } else {
      const fileBase64 = scanSource.fileBase64 || scanSource.fileBuffer?.toString('base64');
      if (!fileBase64) throw new Error('No invoice file data available to scan.');
      filePart = { inlineData: { mimeType, data: fileBase64 } };
    }

    const timeoutMs = parseInt(process.env.INVOICE_SCAN_TIMEOUT_MS || '285000', 10);
    let parsed = null;
    let usedAttempt = '';
    let finishReason = '';
    let repairModel = '';
    let lastFailure = null;
    providerCallBudget = createProviderCallBudget('invoice');

    for (const candidateModel of modelCandidates) {
      const attempts = [
        { name: 'full-json', compact: false },
        { name: 'compact-json-retry', compact: true }
      ];

      for (const attempt of attempts) {
        try {
          const prompt = buildInvoicePrompt({ compact: attempt.compact });
          const generationBody = createGenerationBody(prompt, filePart, { compact: attempt.compact });
          providerCallStarted = true;
          const gemini = await callGeminiGenerate({
            apiKey,
            model: candidateModel,
            body: generationBody,
            timeoutMs,
            callBudget: providerCallBudget,
            attempt: attempt.name
          });
          const text = getGeminiCandidateText(gemini);
          finishReason = getGeminiFinishReason(gemini);
          estimatedInputTokens += Number(gemini?.usageMetadata?.promptTokenCount || 0);
          estimatedOutputTokens += Number(gemini?.usageMetadata?.candidatesTokenCount || 0);
          if (!text) throw new Error('Gemini returned no invoice text.');

          try {
            parsed = parseGeminiJson(text);
          } catch (parseErr) {
            lastFailure = parseErr;
            const wasTruncated = /MAX_TOKENS|LENGTH/i.test(finishReason) || !extractBalancedJson(text);
            if (!attempt.compact && wasTruncated) continue;
            try {
              const repaired = await repairGeminiJsonWithModel({ apiKey, model: candidateModel, badText: text, scanInputMethod, callBudget: providerCallBudget });
              parsed = repaired.parsed;
              repairModel = repaired.repairModel;
              finishReason = repaired.repairFinishReason || finishReason;
              estimatedInputTokens += Number(repaired.inputTokens || 0);
              estimatedOutputTokens += Number(repaired.outputTokens || 0);
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
      const parseError = new Error(lastFailure?.message || 'Gemini returned invalid JSON after repair attempts.');
      parseError.statusCode = 502;
      throw parseError;
    }

    const normalized = normalizeInvoicePayload(parsed);
    normalized.scanFileName = fileName;
    normalized.scanMimeType = mimeType;
    normalized.scanSource = scanSource?.source || 'unknown';
    normalized.scanInputMethod = scanInputMethod;
    normalized.scanStoragePath = scanSource?.storagePath || '';
    normalized.scanOriginalBytes = scanSource?.originalBytes || null;
    normalized.scanCompression = scanSource?.compression || null;
    normalized.geminiFileName = geminiFile?.name || '';
    normalized.processedAt = new Date().toISOString();
    normalized.scannerVersion = INVOICE_SCANNER_VERSION;
    normalized.scanModel = usedModel || model;
    normalized.scanAttempt = usedAttempt || 'full-json';
    normalized.scanFinishReason = finishReason || '';
    normalized.scanRepairModel = repairModel || '';
    normalized.firebaseProject = authContext.projectId;
    normalized.storageReadMode = 'firebase-admin';
    normalized.pageCount = pageCount;
    normalized.aiUsage = {
      monthKey: usageReservation.monthKey,
      pageCount,
      usedBefore: usageReservation.usedBefore,
      usedAfter: usageReservation.usedAfter,
      processedAfter: usageReservation.processedAfter,
      bypassPagesAfter: usageReservation.bypassPagesAfter,
      limit: usageReservation.limit,
      remaining: usageReservation.remaining,
      limitBypass: usageReservation.limitBypass,
      bypassReason: usageReservation.bypassReason,
      wouldHaveExceededLimit: usageReservation.wouldHaveExceededLimit
    };

    await completeAiScanUsageEvent({
      db: usageDb,
      reservation: usageReservation,
      status: 'completed',
      provider: 'google_gemini',
      model: usedModel || model,
      estimatedInputTokens,
      estimatedOutputTokens,
      providerCallCount: providerCallBudget?.used || 0,
      attempts: providerCallBudget?.attempts || []
    });
    if (geminiFile) deleteGeminiFileQuietly(apiKey, geminiFile);
    return res.status(200).json(normalized);
  } catch (err) {
    if (usageReservation && usageDb) {
      try {
        if (providerCallStarted) {
          await completeAiScanUsageEvent({
            db: usageDb,
            reservation: usageReservation,
            status: 'failed',
            errorMessage: err.message,
            provider: 'google_gemini',
            model: usedModel || providerCallBudget?.attempts?.[0]?.model || '',
            estimatedInputTokens,
            estimatedOutputTokens,
            providerCallCount: providerCallBudget?.used || 0,
            attempts: providerCallBudget?.attempts || []
          });
        } else {
          await cancelAiScanReservation({ db: usageDb, reservation: usageReservation });
        }
      } catch (usageError) {
        console.error('Invoice AI usage finalization failed:', usageError?.message || usageError);
      }
    }
    const isTimeout = err?.name === 'AbortError';
    const message = isTimeout
      ? 'Invoice scanner needed more time while AI was reading the file. Try again once, or scan fewer pages if this keeps happening.'
      : (err.message || 'Invoice scanner failed.');
    const status = err?.statusCode || (err?.code === 'AI_PDF_PAGE_COUNT_REQUIRED' ? 400 : (isTimeout ? 504 : (/authorization|token|permission|login/i.test(message) ? 401 : 500)));
    return res.status(status).json({
      error: message,
      code: err?.code || undefined,
      hint: message.toLowerCase().includes('payload')
        ? 'Upload the invoice through Firebase Storage mode instead of sending it through Vercel.'
        : undefined,
      scanSource: scanSource?.source || 'unknown',
      scannerVersion: INVOICE_SCANNER_VERSION
    });
  }
}
module.exports = handler;
module.exports.__test = {
  inferInvoiceProductFields,
  classifyInvoiceRow,
  isPurchasedProductRow,
  normalizeInvoicePayload,
  productRowKey
};
module.exports.config = {
  maxDuration: 300,
  memory: 1024
};
