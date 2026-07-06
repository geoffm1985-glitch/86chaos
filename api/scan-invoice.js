// 86chaos invoice scanner
// Extracts ALL visible invoice information from PDF or image files.
// 13.1.9: Large-document scan handoff uses Gemini Files API instead of giant inline base64.

function cleanJsonText(text = '') {
  return String(text)
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

function normalizeInvoicePayload(parsed) {
  const data = parsed && typeof parsed === 'object' ? parsed : {};
  const lineItems = Array.isArray(data.lineItems) ? data.lineItems : [];
  const allExtractedRows = Array.isArray(data.allExtractedRows)
    ? data.allExtractedRows
    : Array.isArray(data.invoiceRows)
      ? data.invoiceRows
      : lineItems;

  const normalizedRows = allExtractedRows.map((row, index) => {
    const r = row && typeof row === 'object' ? row : { rawText: String(row || '') };
    const itemName = r.itemName || r.description || r.name || r.rawText || `Invoice Row ${index + 1}`;
    return {
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
  });

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
    lineItems: normalizedRows,
    allExtractedRows: normalizedRows,
    rawTranscription: data.rawTranscription || data.fullText || '',
    extractionNotes: data.extractionNotes || [],
    extractionWarnings: data.extractionWarnings || [],
    confidence: data.confidence || 'review',
    scannerVersion: '13.1.9'
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

function buildInvoicePrompt() {
  return `
You are the invoice extraction engine for a restaurant inventory system.

Your job: extract ABSOLUTELY EVERYTHING visible from this invoice, receipt, order guide, delivery ticket, statement, PDF, or image.

Rules:
- Return ONLY valid JSON. No markdown.
- Do not summarize.
- Do not skip tiny rows, handwritten notes, fees, credits, taxes, deposits, totals, PO numbers, terms, route numbers, vendor/customer info, page numbers, or footer notes.
- Preserve every visible line/row in allExtractedRows, even if it is not an inventory item.
- If a value is unclear, include it as bestGuess and add a warning.
- Keep rawTranscription as a readable transcription of the whole document.
- For inventory/product rows, include quantity, orderedQty, shippedQty, backOrderedQty, productCode/SKU/itemNumber, itemName, packSize, UOM, weight/catchWeight, unitPrice, totalPrice, tax, discount, deposit, and rawText.
- Mark non-product rows with rowType such as tax, freight, deposit, subtotal, total, discount, credit, payment, note, header, footer.
- For catch-weight foods like chicken, beef, fish, cheese, and produce, include weight and weightPerCaseLbs when visible or strongly implied by pack size.
- For longer multipage invoices, keep going until every visible row is represented in allExtractedRows.

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

function createGenerationBody(prompt, filePart) {
  const maxOutputTokens = parseInt(process.env.INVOICE_SCAN_MAX_OUTPUT_TOKENS || '65536', 10);
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
      response_mime_type: 'application/json',
      maxOutputTokens
    }
  };
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let scanSource = null;
  let geminiFile = null;
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing GEMINI_API_KEY or GOOGLE_API_KEY in Vercel.' });

    const adminApp = initAdmin();
    scanSource = await readScanSource(req.body || {}, req, adminApp);
    const { mimeType = 'image/jpeg', fileName = 'invoice' } = scanSource;
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const inputMode = String(process.env.INVOICE_SCAN_INPUT_MODE || 'files').toLowerCase();
    const useGeminiFiles = inputMode !== 'inline' && scanSource.source === 'firebase-storage' && Buffer.isBuffer(scanSource.fileBuffer);

    const prompt = buildInvoicePrompt();
    let filePart;
    let scanInputMethod = 'inline-base64';

    if (useGeminiFiles) {
      geminiFile = await uploadToGeminiFiles(apiKey, scanSource);
      filePart = { file_data: { mime_type: mimeType, file_uri: geminiFile.uri } };
      scanInputMethod = 'gemini-files-api';
    } else {
      const fileBase64 = scanSource.fileBase64 || scanSource.fileBuffer?.toString('base64');
      if (!fileBase64) throw new Error('No invoice file data available to scan.');
      filePart = { inline_data: { mime_type: mimeType, data: fileBase64 } };
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = createGenerationBody(prompt, filePart);

    const timeoutMs = parseInt(process.env.INVOICE_SCAN_TIMEOUT_MS || '285000', 10);
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
      return res.status(response.status).json({
        error: 'Gemini invoice scan failed.',
        details: raw.slice(0, 2000),
        scanSource: scanSource?.source || 'unknown',
        scanInputMethod,
        fileName: scanSource?.fileName || fileName,
        originalBytes: scanSource?.originalBytes || null
      });
    }

    const gemini = JSON.parse(raw);
    const text = gemini?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
    if (!text) return res.status(502).json({ error: 'Gemini returned no invoice text.', scanInputMethod });

    let parsed;
    try {
      parsed = JSON.parse(cleanJsonText(text));
    } catch (err) {
      return res.status(502).json({ error: 'Gemini returned invalid JSON.', rawText: text.slice(0, 4000), scanInputMethod });
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
    normalized.scannerVersion = '13.1.9';

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
      scannerVersion: '13.1.9'
    });
  }
}

module.exports = handler;
module.exports.config = {
  maxDuration: 300,
  memory: 1024
};
