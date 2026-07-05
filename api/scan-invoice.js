// 86chaos invoice scanner
// Extracts ALL visible invoice information from PDF or image files.
// Uses Gemini multimodal document understanding when GEMINI_API_KEY or GOOGLE_API_KEY is set.

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
    scannerVersion: '12.7.0-full-invoice-extraction'
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing GEMINI_API_KEY or GOOGLE_API_KEY in Vercel.' });

    const { fileBase64, mimeType = 'image/jpeg', fileName = 'invoice' } = req.body || {};
    if (!fileBase64) return res.status(400).json({ error: 'Missing fileBase64.' });

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const prompt = `
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

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: fileBase64 } }
        ]
      }],
      generationConfig: {
        temperature: 0,
        response_mime_type: 'application/json'
      }
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const raw = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Gemini invoice scan failed.', details: raw.slice(0, 1000) });
    }

    const gemini = JSON.parse(raw);
    const text = gemini?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
    if (!text) return res.status(502).json({ error: 'Gemini returned no invoice text.' });

    let parsed;
    try {
      parsed = JSON.parse(cleanJsonText(text));
    } catch (err) {
      return res.status(502).json({ error: 'Gemini returned invalid JSON.', rawText: text.slice(0, 4000) });
    }

    const normalized = normalizeInvoicePayload(parsed);
    normalized.scanFileName = fileName;
    normalized.scanMimeType = mimeType;
    normalized.processedAt = new Date().toISOString();

    return res.status(200).json(normalized);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Invoice scanner failed.' });
  }
};
