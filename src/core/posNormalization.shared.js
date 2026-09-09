'use strict';
const { finiteNumber } = globalThis.__86ChaosRestaurantPackShared;
const POS_FIELDS = ['recordType', 'date', 'posId', 'menuItemName', 'menuItemId', 'category', 'quantity', 'grossSales', 'netSales', 'laborCost', 'salesTax', 'tipsPaidOut', 'depositAmount'];
function parsePosCsv(text = '') {
  if (String(text).length > 500000) throw new Error('Split this import into files smaller than 500 KB.');
  const rows = []; let cells = []; let cell = ''; let quoted = false;
  for (let i = 0; i <= text.length; i++) {
    const char = text[i];
    if (char === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if ((char === ',' || char === '\n' || char === undefined) && !quoted) {
      cells.push(cell.replace(/\r$/, '').trim()); cell = '';
      if (char !== ',') { if (cells.some(Boolean)) rows.push(cells); cells = []; }
    } else if (char !== undefined) cell += char;
  }
  if (quoted) throw new Error('CSV has an unterminated quoted field.');
  if (rows.length < 2 || rows.length > 501) throw new Error('Import between 1 and 500 rows plus a header.');
  const headers = rows.shift();
  if (new Set(headers).size !== headers.length) throw new Error('CSV headers must be unique.');
  return { headers, rows: rows.map((cells, i) => { if (cells.length !== headers.length) throw new Error(`CSV row ${i + 2} has the wrong number of columns.`); return Object.fromEntries(headers.map((key, index) => [key, cells[index]])); }) };
}
function normalizePosImport({ rows = [], mapping = {}, provider = 'manual', restaurantId = '' }) {
  if (!restaurantId || !Array.isArray(rows) || !rows.length || rows.length > 500) throw new Error('A workspace and 1–500 rows are required.');
  const seen = new Set();
  const records = rows.map((row, i) => {
    const get = field => String(row[mapping[field] || field] ?? '').trim();
    const date = get('date');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error(`Row ${i + 1}: use a valid YYYY-MM-DD date.`);
    const recordType = get('recordType') || 'daily';
    if (!['daily', 'item', 'category'].includes(recordType)) throw new Error(`Row ${i + 1}: type must be daily, item, or category.`);
    const key = `${date}|${recordType}|${get('posId') || (recordType === 'daily' ? 'daily' : get('menuItemName') || get('category'))}`;
    if (seen.has(key)) throw new Error(`Row ${i + 1}: duplicate POS identity. Review the export before importing.`);
    seen.add(key);
    const record = { restaurantId, provider: String(provider).slice(0, 60), recordType, date, importedPosId: get('posId').slice(0, 160), sourceRow: i + 2,
      menuItemName: get('menuItemName').slice(0, 160), menuItemId: get('menuItemId').slice(0, 160), category: get('category').slice(0, 100), status: 'draft', approvalRequired: true };
    for (const field of ['quantity', 'grossSales', 'netSales', 'laborCost', 'salesTax', 'tipsPaidOut', 'depositAmount']) {
      const raw = get(field); const value = raw ? finiteNumber(raw.replace(/[$,]/g, '')) : null;
      if (raw && (value === null || Math.abs(value) > 100000000)) throw new Error(`Row ${i + 1}: invalid ${field}.`);
      record[field] = value;
    }
    if (recordType === 'item' && (!record.importedPosId || !record.menuItemName || record.quantity === null)) throw new Error(`Row ${i + 1}: item sales need a POS identifier, name, and count.`);
    if (recordType === 'category' && !record.category) throw new Error(`Row ${i + 1}: category is required.`);
    record.laborPercent = record.netSales > 0 && record.laborCost != null ? record.laborCost / record.netSales * 100 : null;
    record.mappingNeedsReview = recordType === 'item' && !record.menuItemId;
    return record;
  });
  return { schemaVersion: 1, provider, restaurantId, status: 'draft', approvalRequired: true, records };
}
const posNormalizationShared = { POS_FIELDS, parsePosCsv, normalizePosImport };

// One implementation for the browser and Node, using the existing shared-helper pattern.
(function publishPosNormalization(root) {
  if (!root) return;
  Object.defineProperty(root, '__86ChaosPosNormalizationShared', {
    value: posNormalizationShared,
    configurable: true,
    writable: true,
  });
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
